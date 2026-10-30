import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Workspace } from "../src/detect.js";
import { normalizeKnip, runKnip } from "../src/runners/knip.js";
import { tmpDirWith } from "./helpers.js";

const fixture: unknown = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "knip-output.json"),
    "utf8",
  ),
);

function rootWorkspace(absDir: string): Workspace {
  return { dir: ".", absDir, packs: ["core"] };
}

describe("normalizeKnip", () => {
  it("maps the recorded output to exactly three findings", () => {
    const root = "/repo";
    const findings = normalizeKnip(fixture, root, rootWorkspace(root));
    const byMessage = Object.fromEntries(findings.map((f) => [f.message, f]));
    expect(findings).toHaveLength(3);

    expect(byMessage["Unused file"]).toMatchObject({
      ruleId: "core/dead-code",
      pack: "core",
      category: "bloat",
      confidence: "high",
      severity: "low",
      file: "src/orphan.ts",
      line: 1,
      endLine: 1,
      snippet: "src/orphan.ts",
      workspace: ".",
    });
    expect(byMessage["Unused export unusedExport"]).toMatchObject({
      severity: "low",
      file: "src/util.ts",
      line: 2,
      endLine: 2,
      snippet: "unusedExport",
    });
    expect(byMessage["Unused dependency left-pad"]).toMatchObject({
      severity: "medium",
      file: "package.json",
      line: 7,
      snippet: "left-pad",
    });
  });

  it("makes files repo-relative for a nested workspace", () => {
    const root = "/repo";
    const ws: Workspace = { dir: "apps/web", absDir: "/repo/apps/web", packs: ["core"] };
    const files = normalizeKnip(fixture, root, ws).map((f) => f.file);
    expect(files).toContain("apps/web/src/orphan.ts");
    expect(files).toContain("apps/web/package.json");
  });

  it("ignores unknown keys and rejects malformed output", () => {
    expect(normalizeKnip({ issues: [], extra: 1 }, "/r", rootWorkspace("/r"))).toEqual([]);
    expect(() => normalizeKnip({ nope: true }, "/r", rootWorkspace("/r"))).toThrow();
  });
});

describe("runKnip", () => {
  it("reports a RunnerError when knip fails with non-JSON stderr", async () => {
    const dir = tmpDirWith({
      "fail.js": 'process.stderr.write("boom: not json"); process.exit(1);',
    });
    const result = await runKnip(dir, rootWorkspace(dir), { bin: path.join(dir, "fail.js") });
    expect(result.findings).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ runner: "knip", workspace: "." });
    expect(result.errors[0]?.message).toContain("boom");
  });

  it("reports a RunnerError when stdout is not valid knip JSON", async () => {
    const dir = tmpDirWith({ "junk.js": 'process.stdout.write("not json");' });
    const result = await runKnip(dir, rootWorkspace(dir), { bin: path.join(dir, "junk.js") });
    expect(result.findings).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.runner).toBe("knip");
  });

  it("reports a timeout RunnerError", async () => {
    const dir = tmpDirWith({ "sleep.js": "setTimeout(() => {}, 30000);" });
    const result = await runKnip(dir, rootWorkspace(dir), {
      bin: path.join(dir, "sleep.js"),
      timeoutMs: 300,
    });
    expect(result.findings).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("timed out");
  });

  it("runs the pinned knip on a real project", async () => {
    const dir = tmpDirWith({
      "package.json": JSON.stringify({
        name: "sample",
        version: "1.0.0",
        type: "module",
        main: "src/index.ts",
        dependencies: { "left-pad": "1.3.0" },
      }),
      "tsconfig.json": JSON.stringify({ compilerOptions: { module: "esnext", target: "es2022" } }),
      "src/index.ts": 'import { used } from "./util.js";\nexport const x = used;\n',
      "src/util.ts": "export const used = 1;\nexport const unusedExport = 2;\n",
      "src/orphan.ts": "export const orphan = 1;\n",
    });
    const result = await runKnip(dir, rootWorkspace(dir));
    expect(result.errors).toEqual([]);
    expect(result.findings.map((f) => f.message).sort()).toEqual([
      "Unused dependency left-pad",
      "Unused export unusedExport",
      "Unused file",
    ]);
  }, 60_000);
});
