import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { RULE_ID as DUPLICATE_LIBRARIES_ID } from "../runners/deps.js";
import { RULE_ID as DUPLICATE_CODE_ID } from "../runners/jscpd.js";
import { RULE_ID as DEAD_CODE_ID } from "../runners/knip.js";
import type { Category, Confidence, Pack, Severity } from "../types.js";
import { FILTERS } from "./filters.js";

export type RuleLang = "ts" | "tsx" | "js" | "jsx";
export type RuleDef = {
  id: string;
  pack: Pack;
  category: Category;
  severity: Severity;
  confidence: Confidence;
  message: string;
  fixHint: string;
  languages: RuleLang[];
  rule: unknown;
  constraints?: unknown;
  utils?: unknown;
  filter?: string;
  supersedes?: string[];
};

const ALL_LANGS: RuleLang[] = ["ts", "tsx", "js", "jsx"];

const ruleSchema = z.object({
  id: z.string().regex(/^[a-z]+\/[a-z0-9-]+$/),
  pack: z.enum(["core", "drizzle", "prisma", "nextjs", "react"]),
  category: z.enum(["perf", "bloat", "dup"]),
  severity: z.enum(["high", "medium", "low"]),
  confidence: z.enum(["high", "medium"]),
  message: z.string().min(1),
  fixHint: z.string().min(1),
  languages: z.array(z.enum(["ts", "tsx", "js", "jsx"])).min(1).default(ALL_LANGS),
  rule: z.unknown().refine((v) => v !== undefined && v !== null, "rule is required"),
  constraints: z.unknown().optional(),
  utils: z.unknown().optional(),
  filter: z.string().optional(),
  supersedes: z.array(z.string()).optional(),
});

const SHARED_UTILS_FILE = "_shared/utils.yml";

export function resolveRulesDir(candidates: string[]): string {
  const found = candidates.find(
    (c) => existsSync(path.join(c, "core")) && existsSync(path.join(c, SHARED_UTILS_FILE)),
  );
  if (!found) throw new Error(`Rules directory not found (looked in ${candidates.join(", ")})`);
  return found;
}

// src/rules/ (vitest) and dist/ (tsup bundle) sit at different depths from the shipped rules dir.
function defaultRulesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return resolveRulesDir([path.resolve(here, "../../rules"), path.resolve(here, "../rules")]);
}

const RULE_FILE_IGNORES = ["**/*.test.yml", "_shared/**"];

const ruleIdSchema = z.object({ id: z.string() });

export async function allRuleIds(rulesDir?: string): Promise<string[]> {
  const dir = rulesDir ?? defaultRulesDir();
  if (!existsSync(dir)) throw new Error(`Rules directory not found: ${dir}`);
  const files = (
    await fg("**/*.yml", { cwd: dir, absolute: true, ignore: RULE_FILE_IGNORES })
  ).sort();
  const yamlIds = await Promise.all(
    files.map(async (file) => ruleIdSchema.parse(parseYaml(await readFile(file, "utf8"))).id),
  );
  // The deps, knip and jscpd runners have no rule YAML. Read their ids here, not at module
  // load, so tests that mock a runner module can still import this file.
  return [...yamlIds, DUPLICATE_LIBRARIES_ID, DEAD_CODE_ID, DUPLICATE_CODE_ID];
}

const sharedUtilsSchema = z.record(z.string(), z.unknown());

async function readSharedUtils(dir: string): Promise<Record<string, unknown>> {
  const file = path.join(dir, SHARED_UTILS_FILE);
  if (!existsSync(file)) return {};
  const parsed = sharedUtilsSchema.safeParse(parseYaml(await readFile(file, "utf8")));
  if (!parsed.success) throw new Error(`Invalid shared utils ${file}: ${parsed.error.message}`);
  return parsed.data;
}

function mergeUtils(shared: Record<string, unknown>, local: unknown): unknown {
  if (Object.keys(shared).length === 0) return local;
  const own = typeof local === "object" && local !== null ? local : {};
  return { ...shared, ...own };
}

async function readRule(file: string, shared: Record<string, unknown>): Promise<RuleDef> {
  const parsed = ruleSchema.safeParse(parseYaml(await readFile(file, "utf8")));
  if (!parsed.success) {
    throw new Error(`Invalid rule file ${file}: ${parsed.error.message}`);
  }
  const def = { ...parsed.data, utils: mergeUtils(shared, parsed.data.utils) };
  if (def.filter !== undefined && !Object.hasOwn(FILTERS, def.filter)) {
    throw new Error(`Rule ${def.id} (${file}) names unknown filter "${def.filter}"`);
  }
  return def;
}

export async function loadRules(packs: Pack[], rulesDir?: string): Promise<RuleDef[]> {
  const dir = rulesDir ?? defaultRulesDir();
  if (!existsSync(dir)) throw new Error(`Rules directory not found: ${dir}`);
  const files = (
    await fg("**/*.yml", { cwd: dir, absolute: true, ignore: RULE_FILE_IGNORES })
  ).sort();
  const shared = await readSharedUtils(dir);
  const seen = new Map<string, string>();
  const rules: RuleDef[] = [];
  for (const file of files) {
    const def = await readRule(file, shared);
    const prior = seen.get(def.id);
    if (prior) throw new Error(`Duplicate rule id ${def.id} in ${prior} and ${file}`);
    seen.set(def.id, file);
    if (packs.includes(def.pack)) rules.push(def);
  }
  return rules;
}
