import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import { parse as parseYaml } from "yaml";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { loadRules } from "../src/rules/load.js";
import type { RuleLang } from "../src/rules/load.js";
import { matchSource } from "../src/runners/astgrep.js";

const rulesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../rules");

const testSchema = z.object({
  id: z.string(),
  valid: z.array(z.string()),
  invalid: z.array(z.string()),
  lang: z.enum(["ts", "tsx", "js", "jsx"]).default("ts"),
});

const allRules = await loadRules(["core", "drizzle", "prisma", "nextjs", "react"], rulesDir);
const specs = fg
  .sync("**/*.test.yml", { cwd: rulesDir, absolute: true })
  .sort()
  .map((f) => testSchema.parse(parseYaml(readFileSync(f, "utf8"))));

describe("rule fixtures", () => {
  test("every rule has a test file", () => {
    const tested = new Set(specs.map((s) => s.id));
    expect(allRules.map((r) => r.id).filter((id) => !tested.has(id))).toEqual([]);
  });

  for (const spec of specs) {
    const lang: RuleLang = spec.lang;
    describe(spec.id, () => {
      const rule = allRules.find((r) => r.id === spec.id);
      test("rule exists", () => expect(rule).toBeDefined());
      spec.invalid.forEach((src, i) => {
        test(`invalid #${i + 1} matches`, () => {
          if (!rule) throw new Error(`no rule ${spec.id}`);
          expect(matchSource(rule, src, lang).length).toBeGreaterThanOrEqual(1);
        });
      });
      spec.valid.forEach((src, i) => {
        test(`valid #${i + 1} does not match`, () => {
          if (!rule) throw new Error(`no rule ${spec.id}`);
          expect(matchSource(rule, src, lang)).toEqual([]);
        });
      });
    });
  }
});
