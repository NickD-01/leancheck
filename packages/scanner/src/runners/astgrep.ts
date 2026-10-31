import { readFile } from "node:fs/promises";
import { Lang, parse } from "@ast-grep/napi";
import type { NapiConfig, SgNode } from "@ast-grep/napi";
import fg from "fast-glob";
import { docsUrlFor } from "../constants.js";
import type { Workspace } from "../detect.js";
import { toRepoRelative } from "../paths.js";
import { FILTERS } from "../rules/filters.js";
import type { RuleDef, RuleLang } from "../rules/load.js";
import type { RawFinding, RunnerError } from "../types.js";

type Match = { line: number; endLine: number; snippet: string };

const SOURCE_GLOB = "**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}";
const SNIPPET_MAX = 200;

const NAPI_LANG: Record<RuleLang, Lang> = {
  ts: Lang.TypeScript,
  tsx: Lang.Tsx,
  js: Lang.JavaScript,
  jsx: Lang.JavaScript, // tree-sitter-javascript already parses JSX
};

const EXT_LANG: Record<string, RuleLang> = {
  ts: "ts",
  mts: "ts",
  cts: "ts",
  tsx: "tsx",
  js: "js",
  mjs: "js",
  cjs: "js",
  jsx: "jsx",
};

class ParseError extends Error {}

function langForFile(file: string): RuleLang | undefined {
  return EXT_LANG[file.slice(file.lastIndexOf(".") + 1)];
}

function toConfig(rule: RuleDef): NapiConfig {
  // rule/constraints/utils are unvalidated YAML objects; ast-grep checks their shape at match time.
  return {
    rule: rule.rule,
    constraints: rule.constraints,
    utils: rule.utils,
  } as NapiConfig;
}

function collect(rule: RuleDef, root: SgNode): Match[] {
  const keep = rule.filter ? FILTERS[rule.filter] : undefined;
  return root
    .findAll(toConfig(rule))
    .filter((node) => (keep ? keep(node, root) : true))
    .map((node) => {
      const range = node.range();
      return {
        line: range.start.line + 1,
        endLine: range.end.line + 1,
        snippet: node.text().slice(0, SNIPPET_MAX),
      };
    });
}

function parseRoot(source: string, lang: RuleLang): SgNode {
  const root = parse(NAPI_LANG[lang], source).root();
  // tree-sitter recovers from syntax errors, so an ERROR node is the only failure signal.
  // A bare & in JSX text is valid JSX that the grammar still reports as ERROR.
  if (root.find({ rule: { kind: "ERROR", not: { regex: "^&" } } })) throw new ParseError("syntax error");
  return root;
}

export function matchSource(rule: RuleDef, source: string, lang: RuleLang): Match[] {
  return collect(rule, parseRoot(source, lang));
}

function toFinding(rule: RuleDef, ws: Workspace, file: string, m: Match): RawFinding {
  return {
    ruleId: rule.id,
    pack: rule.pack,
    category: rule.category,
    severity: rule.severity,
    confidence: rule.confidence,
    workspace: ws.dir,
    file,
    line: m.line,
    endLine: m.endLine,
    snippet: m.snippet,
    message: rule.message,
    fixHint: rule.fixHint,
    docsUrl: docsUrlFor(rule.id),
  };
}

async function scanFile(
  repoRoot: string,
  ws: Workspace,
  rules: RuleDef[],
  abs: string,
): Promise<{ findings: RawFinding[]; error?: RunnerError }> {
  const file = toRepoRelative(repoRoot, abs);
  const lang = langForFile(abs);
  if (!lang) return { findings: [] };
  const applicable = rules.filter((r) => r.languages.includes(lang));
  if (applicable.length === 0) return { findings: [] };
  try {
    const root = parseRoot(await readFile(abs, "utf8"), lang);
    const findings = applicable.flatMap((r) =>
      collect(r, root).map((m) => toFinding(r, ws, file, m)),
    );
    return { findings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { findings: [], error: { runner: "astgrep", workspace: ws.dir, file, message } };
  }
}

export async function runAstGrep(
  repoRoot: string,
  ws: Workspace,
  rules: RuleDef[],
  ignores: string[],
): Promise<{ findings: RawFinding[]; errors: RunnerError[] }> {
  const files = (
    await fg(SOURCE_GLOB, { cwd: ws.absDir, absolute: true, ignore: ignores, dot: true })
  ).sort();
  const findings: RawFinding[] = [];
  const errors: RunnerError[] = [];
  for (const abs of files) {
    const result = await scanFile(repoRoot, ws, rules, abs);
    findings.push(...result.findings);
    if (result.error) errors.push(result.error);
  }
  return { findings, errors };
}
