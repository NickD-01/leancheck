import type { ScanResult, Severity } from "./types.js";

const HEADERS = ["ID", "SEV", "RULE", "LOCATION", "MESSAGE"];
const COLUMN_GAP = "  ";

function pad(rows: string[][]): string[] {
  const widths = HEADERS.map((_, c) => Math.max(...rows.map((r) => (r[c] ?? "").length)));
  return rows.map((r) =>
    r
      .map((cell, c) => (c === r.length - 1 ? cell : cell.padEnd(widths[c] ?? 0)))
      .join(COLUMN_GAP),
  );
}

export function formatTable(result: ScanResult): string {
  const count = (s: Severity) => result.findings.filter((f) => f.severity === s).length;
  const summary =
    `${result.findings.length} findings (${count("high")} high, ${count("medium")} medium, ` +
    `${count("low")} low) in ${result.workspaces.length} workspace(s); ` +
    `${result.runnerErrors.length} runner error(s)`;
  if (result.findings.length === 0) return `${summary}\n`;
  const rows = [
    HEADERS,
    ...result.findings.map((f) => [f.id, f.severity, f.ruleId, `${f.file}:${f.line}`, f.message]),
  ];
  return `${pad(rows).join("\n")}\n\n${summary}\n`;
}
