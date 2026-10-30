import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { resolvePrecedence } from "../src/finalize.js";
import { loadRules } from "../src/rules/load.js";
import type { RuleLang } from "../src/rules/load.js";
import { matchSource } from "../src/runners/astgrep.js";
import type { RawFinding } from "../src/types.js";

const rulesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../rules");
const rules = await loadRules(["drizzle", "prisma"], rulesDir);

function findingsFor(source: string, lang: RuleLang = "ts"): RawFinding[] {
  return rules.flatMap((rule) =>
    matchSource(rule, source, lang).map((m) => ({
      ruleId: rule.id,
      pack: rule.pack,
      category: rule.category,
      severity: rule.severity,
      confidence: rule.confidence,
      workspace: ".",
      file: "a.ts",
      line: m.line,
      endLine: m.endLine,
      snippet: m.snippet,
      message: rule.message,
      fixHint: rule.fixHint,
      docsUrl: "u",
    })),
  );
}

const ids = (fs: RawFinding[]) => fs.map((f) => f.ruleId).sort();

describe("orm rule precedence", () => {
  test("drizzle insert in a loop reports only insert-in-loop", () => {
    const src = "async function f(rows: R[]) { for (const row of rows) { await db.insert(t).values(row); } }";
    const raw = findingsFor(src);
    expect(ids(raw)).toEqual(["drizzle/insert-in-loop", "drizzle/query-in-loop"]);
    expect(ids(resolvePrecedence(raw, rules))).toEqual(["drizzle/insert-in-loop"]);
  });

  test("drizzle update in a loop still reports query-in-loop", () => {
    const src = "async function f(rows: R[]) { for (const r of rows) { await db.update(t).set(r).where(w); } }";
    expect(ids(resolvePrecedence(findingsFor(src), rules))).toEqual(["drizzle/query-in-loop"]);
  });

  test("prisma create in a loop reports only create-in-loop", () => {
    const src = "async function f(rows: R[]) { for (const r of rows) { await prisma.user.create({ data: r }); } }";
    expect(ids(resolvePrecedence(findingsFor(src), rules))).toEqual(["prisma/create-in-loop"]);
  });
});

describe("orm rules supersede the generic loop rule", () => {
  test("a query in a loop isn't also reported as await-in-loop", async () => {
    const all = await loadRules(["core", "drizzle"], rulesDir);
    const src = "async function f(ids: I[]) { for (const id of ids) { await db.delete(t).where(eq(t.id, id)); } }";
    const raw = all.flatMap((rule) =>
      matchSource(rule, src, "ts").map((m) => ({
        ruleId: rule.id,
        pack: rule.pack,
        category: rule.category,
        severity: rule.severity,
        confidence: rule.confidence,
        workspace: ".",
        file: "a.ts",
        line: m.line,
        endLine: m.endLine,
        snippet: m.snippet,
        message: rule.message,
        fixHint: rule.fixHint,
        docsUrl: "u",
      })),
    );
    expect(ids(raw)).toContain("core/await-in-loop");
    expect(ids(resolvePrecedence(raw, all))).toEqual(["drizzle/query-in-loop"]);
  });
});
