import { describe, expect, test } from "vitest";
import type { LeancheckConfig } from "../src/config.js";
import { applyIgnores } from "../src/ignore.js";
import type { RawFinding } from "../src/types.js";

const CONFIG: LeancheckConfig = { ignorePaths: [], rules: {}, packs: {}, jscpd: { minLines: 10 } };

function raw(ruleId: string, line: number, file = "src/a.ts"): RawFinding {
  return {
    ruleId,
    pack: "core",
    category: "perf",
    severity: "medium",
    confidence: "high",
    workspace: ".",
    file,
    line,
    endLine: line,
    snippet: "x",
    message: "m",
    fixHint: "h",
    docsUrl: "u",
  };
}

const reader = (text: string) => () => text;

describe("applyIgnores", () => {
  test("line-above // comment suppresses that rule only", () => {
    const src = ["// leancheck-ignore core/a", "code();", "code();"].join("\n");
    const out = applyIgnores([raw("core/a", 2), raw("core/b", 2), raw("core/a", 3)], reader(src), CONFIG);
    expect(out.map((f) => [f.ruleId, f.line])).toEqual([
      ["core/b", 2],
      ["core/a", 3],
    ]);
  });

  test("same-line trailing comment suppresses", () => {
    const src = "code(); // leancheck-ignore core/a";
    expect(applyIgnores([raw("core/a", 1)], reader(src), CONFIG)).toEqual([]);
  });

  test("bare leancheck-ignore suppresses all rules", () => {
    const src = "/* leancheck-ignore */\ncode();";
    expect(applyIgnores([raw("core/a", 2), raw("core/b", 2)], reader(src), CONFIG)).toEqual([]);
  });

  test("JSX {/* leancheck-ignore ... */} suppresses next line", () => {
    const src = ["<div>", "  {/* leancheck-ignore react/inline-fn */}", "  <Foo />", "</div>"].join("\n");
    const out = applyIgnores([raw("react/inline-fn", 3), raw("react/inline-fn", 4)], reader(src), CONFIG);
    expect(out.map((f) => f.line)).toEqual([4]);
  });

  test("a token outside a comment does not suppress", () => {
    const src = 'const s = "leancheck-ignore core/a";\ncode();';
    expect(applyIgnores([raw("core/a", 2)], reader(src), CONFIG)).toHaveLength(1);
  });

  test("config 'off' drops; config severity overrides", () => {
    const config: LeancheckConfig = { ...CONFIG, rules: { "core/a": "off", "core/b": "high" } };
    const out = applyIgnores([raw("core/a", 1), raw("core/b", 1), raw("core/c", 1)], reader(""), config);
    expect(out.map((f) => [f.ruleId, f.severity])).toEqual([
      ["core/b", "high"],
      ["core/c", "medium"],
    ]);
  });

  test("drops findings in default-ignored and ignorePaths files", () => {
    const config: LeancheckConfig = { ...CONFIG, ignorePaths: ["legacy/**"] };
    const out = applyIgnores(
      [
        raw("core/a", 1, "src/ok.ts"),
        raw("core/a", 1, "node_modules/x/index.js"),
        raw("core/a", 1, "packages/w/dist/out.js"),
        raw("core/a", 1, "src/types.d.ts"),
        raw("core/a", 1, "legacy/old.ts"),
        raw("core/a", 1, "package.json"),
      ],
      reader(""),
      config,
    );
    expect(out.map((f) => f.file)).toEqual(["src/ok.ts", "package.json"]);
  });

  test("unreadable file does not throw", () => {
    const throwing = () => {
      throw new Error("ENOENT");
    };
    expect(applyIgnores([raw("core/a", 1)], throwing, CONFIG)).toHaveLength(1);
  });
});
