import { SEVERITY_ORDER } from "./constants.js";
import type { RuleDef } from "./rules/load.js";
import type { Finding, RawFinding } from "./types.js";

const MIN_ID_DIGITS = 3;

const overlaps = (a: RawFinding, b: RawFinding): boolean =>
  a.file === b.file && a.line <= b.endLine && b.line <= a.endLine;

export function resolvePrecedence(findings: RawFinding[], rules: RuleDef[]): RawFinding[] {
  const supersededBy = new Map<string, Set<string>>();
  for (const rule of rules) {
    for (const loser of rule.supersedes ?? []) {
      supersededBy.set(loser, (supersededBy.get(loser) ?? new Set()).add(rule.id));
    }
  }
  return findings.filter((f) => {
    const winners = supersededBy.get(f.ruleId);
    if (!winners) return true;
    return !findings.some((other) => winners.has(other.ruleId) && overlaps(f, other));
  });
}

export function assignIds(findings: RawFinding[]): Finding[] {
  return [...findings]
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
        a.line - b.line,
    )
    .map((f, i) => ({ ...f, id: `L-${String(i + 1).padStart(MIN_ID_DIGITS, "0")}` }));
}
