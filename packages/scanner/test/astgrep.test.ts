import { rmSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { docsUrlFor } from "../src/constants.js";
import type { Workspace } from "../src/detect.js";
import { loadRules, resolveRulesDir } from "../src/rules/load.js";
import type { RuleDef } from "../src/rules/load.js";
import { runAstGrep } from "../src/runners/astgrep.js";
import { tmpDirWith } from "./helpers.js";

const CLONE = "export const c = JSON.parse(JSON.stringify(value));\n";
const RULE_BODY =
  "id: core/a\npack: core\ncategory: perf\nseverity: low\nconfidence: high\nmessage: m\nfixHint: f\n";
const dirs: string[] = [];

async function cloneRules(): Promise<RuleDef[]> {
  return (await loadRules(["core"])).filter((r) => r.id === "core/json-deep-clone");
}

function setup(files: Record<string, string>): { root: string; ws: Workspace } {
  const root = tmpDirWith(files);
  dirs.push(root);
  return { root, ws: { dir: ".", absDir: root, packs: ["core"] } };
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("loadRules", () => {
  test("loads shipped json-deep-clone for core only", async () => {
    expect((await loadRules(["core"])).map((r) => r.id)).toContain("core/json-deep-clone");
    expect((await loadRules(["react"])).map((r) => r.id)).not.toContain("core/json-deep-clone");
  });

  test("filters by pack and defaults languages to all four", async () => {
    const { root } = setup({ "a.yml": `${RULE_BODY}rule:
  pattern: foo($X)
` });
    expect(await loadRules(["react"], root)).toEqual([]);
    const [rule] = await loadRules(["core"], root);
    expect(rule?.languages).toEqual(["ts", "tsx", "js", "jsx"]);
  });

  test("throws when an explicit rules dir does not exist", async () => {
    const { root } = setup({});
    await expect(loadRules(["core"], `${root}/missing`)).rejects.toThrow(/Rules directory not found/);
  });

  test("resolveRulesDir returns the first existing candidate", () => {
    const { root } = setup({ "b/core/x.yml": "", "b/_shared/utils.yml": "" });
    expect(resolveRulesDir([`${root}/a`, `${root}/b`, root])).toBe(`${root}/b`);
  });

  test("resolveRulesDir skips a rules dir lacking core/ and _shared/utils.yml", () => {
    const { root } = setup({
      "unrelated/x.yml": "",
      "real/core/x.yml": "",
      "real/_shared/utils.yml": "",
    });
    expect(resolveRulesDir([`${root}/unrelated`, `${root}/real`])).toBe(`${root}/real`);
  });

  test("resolveRulesDir throws listing candidates when none exist", () => {
    expect(() => resolveRulesDir(["/nope/one", "/nope/two"])).toThrow(
      /Rules directory not found.*\/nope\/one.*\/nope\/two/,
    );
  });

  test("throws on unknown filter", async () => {
    const { root } = setup({ "a.yml": `${RULE_BODY}filter: nope\nrule:\n  pattern: foo($X)\n` });
    await expect(loadRules(["core"], root)).rejects.toThrow(/unknown filter "nope"/);
  });

  test("throws on duplicate ids", async () => {
    const body = `${RULE_BODY}rule:\n  pattern: foo($X)\n`;
    const { root } = setup({ "a.yml": body, "sub/b.yml": body });
    await expect(loadRules(["core"], root)).rejects.toThrow(/Duplicate rule id core\/a/);
  });
});

describe("runAstGrep", () => {
  test("scans .ts, .tsx, .js, .jsx, .mjs, .cjs", async () => {
    const files = Object.fromEntries(
      ["ts", "tsx", "js", "jsx", "mjs", "cjs"].map((e) => [`src/a.${e}`, CLONE]),
    );
    const { root, ws } = setup(files);
    const { findings, errors } = await runAstGrep(root, ws, await cloneRules(), []);
    expect(errors).toEqual([]);
    expect(findings).toHaveLength(6);
  });

  test("skips unparseable file and records a runnerError", async () => {
    const { root, ws } = setup({ "src/ok.ts": CLONE, "src/broken.ts": "const = = (;\n" });
    const { findings, errors } = await runAstGrep(root, ws, await cloneRules(), []);
    expect(errors).toEqual([expect.objectContaining({ runner: "astgrep", file: "src/broken.ts" })]);
    expect(findings).toHaveLength(1);
  });

  test("respects ignore globs", async () => {
    const { root, ws } = setup({ "src/a.ts": CLONE, "dist/b.ts": CLONE });
    const { findings } = await runAstGrep(root, ws, await cloneRules(), ["**/dist/**"]);
    expect(findings.map((f) => f.file)).toEqual(["src/a.ts"]);
  });

  test("finding carries rule metadata and docsUrl", async () => {
    const { root, ws } = setup({ "src/a.ts": `\n${CLONE}` });
    const { findings } = await runAstGrep(root, ws, await cloneRules(), []);
    expect(findings).toEqual([
      {
        ruleId: "core/json-deep-clone",
        pack: "core",
        category: "perf",
        severity: "medium",
        confidence: "high",
        workspace: ".",
        file: "src/a.ts",
        line: 2,
        endLine: 2,
        snippet: "JSON.parse(JSON.stringify(value))",
        message: expect.stringContaining("Deep clone"),
        fixHint: "Use structuredClone(value).",
        docsUrl: docsUrlFor("core/json-deep-clone"),
      },
    ]);
  });
});

describe("loadRules shared utils", () => {
  const USER_RULE = `${RULE_BODY}rule:\n  kind: call_expression\n  matches: marker\n`;
  const UTIL = (kind: string) => `marker:\n  kind: ${kind}\n`;

  test("merges _shared/utils.yml into rules and does not load it as a rule", async () => {
    const { root } = setup({ "a.yml": USER_RULE, "_shared/utils.yml": UTIL("call_expression") });
    const rules = await loadRules(["core"], root);
    expect(rules.map((r) => r.id)).toEqual(["core/a"]);
    expect(rules[0]?.utils).toEqual({ marker: { kind: "call_expression" } });
  });

  test("rule-local util keys win over shared ones", async () => {
    const { root } = setup({
      "a.yml": `${USER_RULE}utils:\n  marker:\n    kind: identifier\n  other:\n    kind: number\n`,
      "_shared/utils.yml": UTIL("call_expression"),
    });
    const [rule] = await loadRules(["core"], root);
    expect(rule?.utils).toEqual({ marker: { kind: "identifier" }, other: { kind: "number" } });
  });

  test("shared utils are usable by the matcher", async () => {
    const { root, ws } = setup({
      "a.yml": USER_RULE,
      "_shared/utils.yml": UTIL("call_expression"),
      "src/x.ts": "foo();\n",
    });
    const rules = await loadRules(["core"], root);
    const { findings } = await runAstGrep(root, ws, rules, []);
    expect(findings.map((f) => f.file)).toEqual(["src/x.ts"]);
  });
});
