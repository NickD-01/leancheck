import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { Workspace } from "../src/detect.js";
import { normalizeJscpd, resolveJscpdBin, runJscpd } from "../src/runners/jscpd.js";
import { tmpDirWith } from "./helpers.js";

const fixture: unknown = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "jscpd-output.json"),
    "utf8",
  ),
);

function rootWorkspace(absDir: string): Workspace {
  return { dir: ".", absDir, packs: ["core"] };
}

const block = (n: number, prefix: string): string =>
  Array.from(
    { length: n },
    (_, i) => `  const ${prefix}${i} = compute(${i}, "v${i}");\n  total += ${prefix}${i} * ${i + 3};`,
  ).join("\n");

const source = (name: string, tail: string): string =>
  `export function ${name}(): number {\n  let total = 0;\n${block(6, "a")}\n  log("${name}");\n${tail}\n${block(15, "b")}\n  return total;\n}\n`;

describe("normalizeJscpd", () => {
  it("maps the recorded output to a low and a medium finding anchored on firstFile", () => {
    const findings = normalizeJscpd(fixture, "/repo", rootWorkspace("/repo"));
    expect(findings).toHaveLength(2);
    const [small, large] = findings;
    expect(small).toMatchObject({
      ruleId: "core/duplicate-code",
      pack: "core",
      category: "dup",
      severity: "low",
      confidence: "high",
      workspace: ".",
      file: "src/a.ts",
      line: 1,
      endLine: 15,
      message: "Duplicated 15 lines (also in src/b.ts:1)",
      fixHint: "Extract a shared helper.",
    });
    expect(large).toMatchObject({
      severity: "medium",
      line: 16,
      endLine: 48,
      message: "Duplicated 33 lines (also in src/b.ts:16)",
    });
    expect(small?.snippet.length).toBeLessThanOrEqual(200);
    expect(small?.snippet.startsWith("export function first")).toBe(true);
    expect(large?.snippet).toHaveLength(200);
  });

  it("uses the 25-line threshold for medium severity", () => {
    const dup = (lines: number) => ({
      duplicates: [
        {
          lines,
          fragment: "x",
          firstFile: { name: "a.ts", start: 1, end: lines },
          secondFile: { name: "b.ts", start: 5, end: lines + 4 },
        },
      ],
    });
    const severity = (lines: number) =>
      normalizeJscpd(dup(lines), "/r", rootWorkspace("/r"))[0]?.severity;
    expect(severity(24)).toBe("low");
    expect(severity(25)).toBe("medium");
  });

  it("makes files repo-relative for a nested workspace", () => {
    const ws: Workspace = { dir: "apps/web", absDir: "/repo/apps/web", packs: ["core"] };
    const f = normalizeJscpd(fixture, "/repo", ws)[0];
    expect(f?.file).toBe("apps/web/src/a.ts");
    expect(f?.message).toContain("also in apps/web/src/b.ts:1");
  });

  it("rejects malformed output", () => {
    expect(normalizeJscpd({ duplicates: [] }, "/r", rootWorkspace("/r"))).toEqual([]);
    expect(() => normalizeJscpd({ nope: true }, "/r", rootWorkspace("/r"))).toThrow();
  });
});

describe("resolveJscpdBin", () => {
  it("resolves an existing native binary, not the node launcher", () => {
    const bin = resolveJscpdBin();
    expect(fs.existsSync(bin)).toBe(true);
    expect(bin).not.toMatch(/.js$/);
  });
});

describe("runJscpd", () => {
  it("reports a RunnerError when jscpd fails", async () => {
    const dir = tmpDirWith({
      "fail.js": 'process.stderr.write("boom: bad flag"); process.exit(2);',
    });
    const result = await runJscpd(dir, rootWorkspace(dir), 10, [], {
      bin: path.join(dir, "fail.js"),
    });
    expect(result.findings).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ runner: "jscpd", workspace: "." });
    expect(result.errors[0]?.message).toContain("boom");
  });

  it("reports a RunnerError when no report is written", async () => {
    const dir = tmpDirWith({ "noop.js": "" });
    const result = await runJscpd(dir, rootWorkspace(dir), 10, [], {
      bin: path.join(dir, "noop.js"),
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.runner).toBe("jscpd");
  });

  it("reports a timeout RunnerError and cleans its temp dir", async () => {
    const dir = tmpDirWith({ "sleep.js": "setTimeout(() => {}, 30000);" });
    // Track this call's own temp dir: other test files run real jscpd scans in parallel,
    // so a before/after listing of os.tmpdir() would race them.
    const mkdtemp = vi.spyOn(fs, "mkdtempSync");
    try {
      const result = await runJscpd(dir, rootWorkspace(dir), 10, [], {
        bin: path.join(dir, "sleep.js"),
        timeoutMs: 300,
      });
      expect(result.errors[0]?.message).toContain("timed out");
      const outDir = mkdtemp.mock.results[0]?.value;
      expect(outDir).toEqual(expect.stringContaining("leancheck-jscpd-"));
      expect(fs.existsSync(String(outDir))).toBe(false);
    } finally {
      mkdtemp.mockRestore();
    }
  });

  it("runs the pinned jscpd on a real project and honors ignores", async () => {
    const dir = tmpDirWith({
      "src/a.ts": source("first", "  total += 1;"),
      "src/b.ts": source("second", "  total += 2;"),
    });
    const result = await runJscpd(dir, rootWorkspace(dir), 10, []);
    expect(result.errors).toEqual([]);
    expect(result.findings.map((f) => f.severity).sort()).toEqual(["low", "medium"]);
    expect(result.findings.every((f) => f.file === "src/a.ts")).toBe(true);

    const ignored = await runJscpd(dir, rootWorkspace(dir), 10, ["**/b.ts"]);
    expect(ignored.errors).toEqual([]);
    expect(ignored.findings).toEqual([]);
  }, 60_000);
});
