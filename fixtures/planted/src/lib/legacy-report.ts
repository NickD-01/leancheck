type ReportRow = { label: string; valueCents: number };

export function renderLegacyReport(rows: ReportRow[]): string {
  return rows.map((row) => `${row.label}: ${(row.valueCents / 100).toFixed(2)}`).join("\n");
}
