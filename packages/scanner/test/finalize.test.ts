import { describe, expect, test } from "vitest";
import { assignIds, resolvePrecedence } from "../src/finalize.js";
import type { RuleDef } from "../src/rules/load.js";
import type { RawFinding, Severity } from "../src/types.js";

function raw(
  ruleId: string,
  file: string,
  line: number,
  severity: Severity = "medium",
  endLine = line,
): RawFinding {
  return {
    ruleId,
    pack: "core",
    category: "perf",
    severity,
    confidence: "high",
    workspace: ".",
    file,
    line,
    endLine,
    snippet: "x",
    message: "m",
    fixHint: "h",
    docsUrl: "u",
  };
}
const low = (file: string, line: number) => raw("core/x", file, line, "low");
const high = (file: string, line: number) => raw("core/x", file, line, "high");

function rule(id: string, supersedes?: string[]): RuleDef {
  return {
    id,
    pack: "core",
    category: "perf",
    severity: "high",
    confidence: "high",
    message: "m",
    fixHint: "h",
    languages: ["ts"],
    rule: {},
    ...(supersedes ? { supersedes } : {}),
  };
}

describe("resolvePrecedence", () => {
  const rules = [rule("drizzle/insert-in-loop", ["core/query-in-loop"]), rule("core/query-in-loop")];

  test("insert-in-loop supersedes query-in-loop on same lines", () => {
    const out = resolvePrecedence(
      [raw("drizzle/insert-in-loop", "a.ts", 5, "high", 8), raw("core/query-in-loop", "a.ts", 6, "high", 7)],
      rules,
    );
    expect(out.map((f) => f.ruleId)).toEqual(["drizzle/insert-in-loop"]);
  });

  test("keeps the superseded rule on other files or non-overlapping lines", () => {
    const out = resolvePrecedence(
      [
        raw("drizzle/insert-in-loop", "a.ts", 5, "high", 8),
        raw("core/query-in-loop", "b.ts", 6),
        raw("core/query-in-loop", "a.ts", 20),
      ],
      rules,
    );
    expect(out).toHaveLength(3);
  });
});

describe("assignIds", () => {
  test("IDs ordered high→low, then file, then line", () => {
    expect(assignIds([low("b.ts", 1), high("z.ts", 9), high("a.ts", 5)]).map((f) => [f.id, f.file])).toEqual([
      ["L-001", "a.ts"],
      ["L-002", "z.ts"],
      ["L-003", "b.ts"],
    ]);
  });

  test("orders by line within a file and pads past 999", () => {
    const many = Array.from({ length: 1000 }, (_, i) => high("a.ts", 1000 - i));
    const out = assignIds(many);
    expect(out[0]).toMatchObject({ id: "L-001", line: 1 });
    expect(out[999]?.id).toBe("L-1000");
  });
});
