import type { Severity } from "./types.js";

export const DEFAULT_IGNORES: readonly string[] = [
  "**/node_modules/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/.leancheck/**",
  "**/*.generated.*",
  "**/*.d.ts",
  "**/coverage/**",
  "**/out/**",
  "**/.vercel/**",
  "**/.turbo/**",
  "**/.output/**",
  "**/.open-next/**",
  "**/.wrangler/**",
  "**/*.min.js",
  "**/generated/**",
];

export const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export const DOCS_BASE_URL = "https://github.com/NickD-01/leancheck/blob/main/docs/rules";

export function docsUrlFor(ruleId: string): string {
  return `${DOCS_BASE_URL}/${ruleId}.md`;
}
