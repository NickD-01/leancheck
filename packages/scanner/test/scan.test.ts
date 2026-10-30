import { afterEach, describe, expect, test, vi } from "vitest";
import { runAstGrep } from "../src/runners/astgrep.js";
import { runJscpd } from "../src/runners/jscpd.js";
import { runKnip } from "../src/runners/knip.js";
import { scan } from "../src/scan.js";
import { tmpDirWith } from "./helpers.js";

vi.mock("../src/runners/knip.js", () => ({
  runKnip: vi.fn(async () => ({ findings: [], errors: [] })),
}));
// jscpd stubbed too: its temp dirs in os.tmpdir() would race the jscpd runner's own cleanup test.
vi.mock("../src/runners/jscpd.js", () => ({
  runJscpd: vi.fn(async () => ({ findings: [], errors: [] })),
}));

vi.mock("../src/runners/astgrep.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/runners/astgrep.js")>();
  return { ...actual, runAstGrep: vi.fn(actual.runAstGrep) };
});

const CLONE = "export const c = (x: unknown) => JSON.parse(JSON.stringify(x));\n";

afterEach(() => vi.mocked(runKnip).mockClear());

describe("scan", () => {
  test("file paths are forward-slash and repo-relative", async () => {
    const dir = tmpDirWith({
      "package.json": JSON.stringify({ name: "root", workspaces: ["packages/*"] }),
      "packages/app/package.json": JSON.stringify({ name: "app" }),
      "packages/app/src/deep/clone.ts": CLONE,
    });
    const result = await scan(dir);
    const clone = result.findings.find((f) => f.ruleId === "core/json-deep-clone");
    expect(clone?.file).toBe("packages/app/src/deep/clone.ts");
    for (const f of result.findings) {
      expect(f.file).not.toContain("\\");
      expect(f.file).not.toMatch(/^([a-zA-Z]:|\/)/);
    }
    expect(result.workspaces).toContain("packages/app");
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("a failing runner yields runnerErrors but the scan completes", async () => {
    vi.mocked(runKnip).mockResolvedValueOnce({
      findings: [],
      errors: [{ runner: "knip", workspace: ".", message: "knip bin missing" }],
    });
    const dir = tmpDirWith({
      "package.json": JSON.stringify({ name: "root" }),
      "src/clone.ts": CLONE,
    });
    const result = await scan(dir);
    expect(result.runnerErrors).toEqual([{ runner: "knip", workspace: ".", message: "knip bin missing" }]);
    expect(result.findings.some((f) => f.ruleId === "core/json-deep-clone")).toBe(true);
    expect(result.findings[0]?.id).toBe("L-001");
  });

  test("inline ignore comments are honoured", async () => {
    const dir = tmpDirWith({
      "package.json": JSON.stringify({ name: "root" }),
      "src/clone.ts": `// leancheck-ignore core/json-deep-clone\n${CLONE}`,
    });
    const result = await scan(dir);
    expect(result.findings.some((f) => f.ruleId === "core/json-deep-clone")).toBe(false);
  });

  test("a runner that throws becomes a RunnerError and other runners' findings survive", async () => {
    vi.mocked(runAstGrep).mockRejectedValueOnce(new Error("glob exploded"));
    vi.mocked(runKnip).mockResolvedValueOnce({
      findings: [
        {
          ruleId: "core/dead-code",
          pack: "core",
          category: "bloat",
          severity: "low",
          confidence: "high",
          workspace: ".",
          file: "src/clone.ts",
          line: 1,
          endLine: 1,
          snippet: "c",
          message: "Unused export c",
          fixHint: "remove",
          docsUrl: "u",
        },
      ],
      errors: [],
    });
    const dir = tmpDirWith({ "package.json": JSON.stringify({ name: "root" }), "src/clone.ts": CLONE });
    const result = await scan(dir);
    expect(result.runnerErrors).toHaveLength(1);
    expect(result.runnerErrors[0]).toMatchObject({ runner: "astgrep", workspace: "." });
    expect(result.runnerErrors[0]?.message).toContain("glob exploded");
    expect(result.findings.map((f) => f.ruleId)).toEqual(["core/dead-code"]);
  });

  test("default ignores cover coverage/ output", async () => {
    const dir = tmpDirWith({
      "package.json": JSON.stringify({ name: "root" }),
      "src/ok.ts": "export const ok = 1;\n",
      "coverage/clone.ts": CLONE,
    });
    const result = await scan(dir);
    expect(result.findings.some((f) => f.file.startsWith("coverage/"))).toBe(false);
  });

  test("hybrid monorepo: a child workspace file is reported once, not by the root too", async () => {
    const dir = tmpDirWith({
      "package.json": JSON.stringify({ name: "root", workspaces: ["packages/*"] }),
      "src/index.ts": "export const i = 1;\n",
      "packages/a/package.json": JSON.stringify({ name: "a" }),
      "packages/a/src/x.ts": CLONE,
    });
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.ruleId === "core/json-deep-clone");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.workspace).toBe("packages/a");
  });

  test("hybrid monorepo: root findings under a child dir are dropped for other runners", async () => {
    const finding = (workspace: string, file: string) => ({
      ruleId: "core/dead-code", pack: "core" as const, category: "bloat" as const,
      severity: "low" as const, confidence: "high" as const, workspace, file, line: 1,
      endLine: 1, snippet: "c", message: "m", fixHint: "f", docsUrl: "u",
    });
    vi.mocked(runKnip).mockImplementation(async (_root, ws) => ({
      findings: [finding(ws.dir, "packages/a/src/x.ts")],
      errors: [],
    }));
    const dir = tmpDirWith({
      "package.json": JSON.stringify({ name: "root", workspaces: ["packages/*"] }),
      "src/index.ts": "export const i = 1;\n",
      "packages/a/package.json": JSON.stringify({ name: "a" }),
      "packages/a/src/x.ts": "export const x = 1;\n",
    });
    try {
      const result = await scan(dir);
      expect(result.findings.filter((f) => f.ruleId === "core/dead-code")).toHaveLength(1);
    } finally {
      vi.mocked(runKnip).mockImplementation(async () => ({ findings: [], errors: [] }));
    }
  });

  test('"packs": {"core": false} skips the deps, knip and jscpd runners', async () => {
    vi.mocked(runJscpd).mockClear();
    const dir = tmpDirWith({
      "package.json": JSON.stringify({ name: "root", dependencies: { react: "19.0.0" } }),
      "leancheck.config.json": JSON.stringify({ packs: { core: false } }),
      "src/ok.ts": "export const ok = 1;\n",
    });
    await scan(dir);
    expect(runKnip).not.toHaveBeenCalled();
    expect(runJscpd).not.toHaveBeenCalled();
  });
});
