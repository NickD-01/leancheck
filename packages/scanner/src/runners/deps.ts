import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { docsUrlFor } from "../constants.js";
import type { Workspace } from "../detect.js";
import { toRepoRelative } from "../paths.js";
import type { RawFinding, RunnerError } from "../types.js";

export const OVERLAP_GROUPS: Readonly<Record<string, readonly string[]>> = {
  dates: ["moment", "dayjs", "date-fns", "luxon"],
  http: ["axios", "got", "ky", "node-fetch", "superagent"],
  ids: ["uuid", "nanoid", "cuid", "@paralleldrive/cuid2"],
  utility: ["lodash", "lodash-es", "underscore", "ramda"],
  validation: ["zod", "yup", "joi", "valibot", "superstruct"],
  classnames: ["classnames", "clsx"],
};

export const RULE_ID = "core/duplicate-libraries";
const FIX_HINT = "Standardise on one; remove the others after migrating usages.";
const SECTION_OPEN = /^\s*"(?:dependencies|devDependencies)"\s*:\s*\{/;
const SECTION_CLOSE = /^\s*\}/;
const KEY_LINE = /^\s*"([^"]+)"\s*:/;

const packageJsonSchema = z.object({
  dependencies: z.record(z.string(), z.unknown()).optional(),
  devDependencies: z.record(z.string(), z.unknown()).optional(),
});

type DepLocation = { line: number; text: string };

function locateDeps(raw: string): Map<string, DepLocation> {
  const found = new Map<string, DepLocation>();
  let inSection = false;
  raw.split(/\r?\n/).forEach((text, index) => {
    if (SECTION_OPEN.test(text)) {
      inSection = true;
      return;
    }
    if (!inSection) return;
    if (SECTION_CLOSE.test(text)) {
      inSection = false;
      return;
    }
    const name = KEY_LINE.exec(text)?.[1];
    if (name && !found.has(name)) found.set(name, { line: index + 1, text: text.trim() });
  });
  return found;
}

function buildFinding(
  ws: Workspace,
  file: string,
  group: string,
  present: { name: string; loc: DepLocation }[],
): RawFinding {
  const first = present.reduce((a, b) => (b.loc.line < a.loc.line ? b : a));
  return {
    ruleId: RULE_ID,
    pack: "core",
    category: "bloat",
    severity: "medium",
    confidence: "high",
    workspace: ws.dir,
    file,
    line: first.loc.line,
    endLine: first.loc.line,
    snippet: first.loc.text,
    message: `Multiple ${group} libraries: ${present.map((p) => p.name).join(", ")}`,
    fixHint: FIX_HINT,
    docsUrl: docsUrlFor(RULE_ID),
  };
}

export async function runDeps(
  repoRoot: string,
  ws: Workspace,
): Promise<{ findings: RawFinding[]; errors: RunnerError[] }> {
  const abs = path.join(ws.absDir, "package.json");
  const file = toRepoRelative(repoRoot, abs);
  let raw: string;
  let pkg: z.infer<typeof packageJsonSchema>;
  try {
    raw = await readFile(abs, "utf8");
    pkg = packageJsonSchema.parse(JSON.parse(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      findings: [],
      errors: [{ runner: "deps", workspace: ws.dir, file, message }],
    };
  }

  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  const locations = locateDeps(raw);
  const findings: RawFinding[] = [];
  for (const [group, members] of Object.entries(OVERLAP_GROUPS)) {
    const present = members
      .filter((name) => declared.has(name))
      .map((name) => ({
        name,
        loc: locations.get(name) ?? { line: 1, text: `"${name}"` },
      }));
    if (present.length >= 2) findings.push(buildFinding(ws, file, group, present));
  }
  return { findings, errors: [] };
}
