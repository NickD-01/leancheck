export type Pack = "core" | "drizzle" | "prisma" | "nextjs" | "react";
export type Category = "perf" | "bloat" | "dup";
export type Severity = "high" | "medium" | "low";
export type Confidence = "high" | "medium";

export type Finding = {
  id: string;
  ruleId: string;
  pack: Pack;
  category: Category;
  severity: Severity;
  confidence: Confidence;
  workspace: string;
  file: string;
  line: number;
  endLine: number;
  snippet: string;
  message: string;
  fixHint: string;
  docsUrl: string;
};

export type RawFinding = Omit<Finding, "id">;

export type RunnerError = {
  runner: "astgrep" | "knip" | "jscpd" | "deps";
  workspace: string;
  file?: string;
  message: string;
};

export type ScanResult = {
  version: string;
  scannedAt: string;
  workspaces: string[];
  packs: Record<string, Pack[]>;
  findings: Finding[];
  runnerErrors: RunnerError[];
};
