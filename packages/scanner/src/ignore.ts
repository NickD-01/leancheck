import picomatch from "picomatch";
import type { LeancheckConfig } from "./config.js";
import { DEFAULT_IGNORES } from "./constants.js";
import type { RawFinding } from "./types.js";

// Token must sit inside a // or /* comment; the optional rule id scopes it, bare means all rules.
const IGNORE_COMMENT = /(?:\/\/|\/\*)[^\n]*?leancheck-ignore(?:[ \t]+([a-z]+\/[a-z0-9-]+))?/g;

function ignoredRules(line: string | undefined): Set<string | null> {
  const found = new Set<string | null>();
  if (line === undefined) return found;
  for (const m of line.matchAll(IGNORE_COMMENT)) found.add(m[1] ?? null);
  return found;
}

function suppressedInline(lines: string[], finding: RawFinding): boolean {
  const here = ignoredRules(lines[finding.line - 1]);
  const above = ignoredRules(lines[finding.line - 2]);
  return [here, above].some((s) => s.has(null) || s.has(finding.ruleId));
}

export function applyIgnores(
  findings: RawFinding[],
  readFile: (file: string) => string,
  config: LeancheckConfig,
): RawFinding[] {
  const isIgnoredPath = picomatch([...DEFAULT_IGNORES, ...config.ignorePaths], { dot: true });
  const lineCache = new Map<string, string[]>();
  const linesOf = (file: string): string[] => {
    const cached = lineCache.get(file);
    if (cached) return cached;
    let lines: string[] = [];
    try {
      lines = readFile(file).split(/\r?\n/);
    } catch {
      // unreadable (deleted, non-source): no inline ignores can apply
    }
    lineCache.set(file, lines);
    return lines;
  };

  const kept: RawFinding[] = [];
  for (const f of findings) {
    const setting = config.rules[f.ruleId];
    if (setting === "off" || isIgnoredPath(f.file)) continue;
    if (suppressedInline(linesOf(f.file), f)) continue;
    kept.push(setting ? { ...f, severity: setting } : f);
  }
  return kept;
}
