import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { docsUrlFor } from "../constants.js";
import type { Workspace } from "../detect.js";
import { toRepoRelative } from "../paths.js";
import type { RawFinding, RunnerError, Severity } from "../types.js";
import {
  DEFAULT_TIMEOUT_MS,
  type RunnerOptions,
  describeFailure,
  execBin,
  resolvePackageBin,
} from "./exec.js";

export const RULE_ID = "core/dead-code";
const FIX_HINT = "Remove it, or confirm it is intentionally kept and add it to the knip config.";

const namedItems = z.array(z.object({ name: z.string(), line: z.number().int().optional() }));

const knipSchema = z.object({
  issues: z.array(
    z.object({
      file: z.string(),
      files: namedItems.default([]),
      exports: namedItems.default([]),
      types: namedItems.default([]),
      dependencies: namedItems.default([]),
      devDependencies: namedItems.default([]),
    }),
  ),
});

export type KnipOptions = RunnerOptions;

// A type referenced again in its own file is part of that file's exported shape;
// dropping `export` removes nothing at runtime, so it isn't worth a finding.
function usedInOwnFile(source: string, name: string): boolean {
  return (source.match(new RegExp(String.raw`\b${name}\b`, "g")) ?? []).length > 1;
}

function readSource(absPath: string): string {
  try {
    return readFileSync(absPath, "utf8");
  } catch {
    return "";
  }
}

export function normalizeKnip(
  json: unknown,
  repoRoot: string,
  ws: Workspace,
  read: (absPath: string) => string = readSource,
): RawFinding[] {
  const parsed = knipSchema.parse(json);
  const findings: RawFinding[] = [];
  const add = (
    file: string,
    line: number,
    snippet: string,
    message: string,
    severity: Severity,
  ): void => {
    findings.push({
      ruleId: RULE_ID,
      pack: "core",
      category: "bloat",
      severity,
      confidence: "high",
      workspace: ws.dir,
      file: toRepoRelative(repoRoot, path.join(ws.absDir, file)),
      line,
      endLine: line,
      snippet,
      message,
      fixHint: FIX_HINT,
      docsUrl: docsUrlFor(RULE_ID),
    });
  };

  for (const issue of parsed.issues) {
    for (const item of issue.files) add(item.name, 1, item.name, "Unused file", "low");
    const source = issue.types.length > 0 ? read(path.join(ws.absDir, issue.file)) : "";
    const types = issue.types.filter((item) => !usedInOwnFile(source, item.name));
    for (const item of [...issue.exports, ...types]) {
      add(issue.file, item.line ?? 1, item.name, `Unused export ${item.name}`, "low");
    }
    for (const item of [...issue.dependencies, ...issue.devDependencies]) {
      add(issue.file, item.line ?? 1, item.name, `Unused dependency ${item.name}`, "medium");
    }
  }
  return findings;
}

// knip 6 loads ESM through require(); Node < 20.19 only supports that behind a flag.
function nodeFlags(): string[] {
  return process.features.require_module ? [] : ["--experimental-require-module"];
}

export async function runKnip(
  repoRoot: string,
  ws: Workspace,
  opts: KnipOptions = {},
): Promise<{ findings: RawFinding[]; errors: RunnerError[] }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fail = (message: string) => ({
    findings: [],
    errors: [{ runner: "knip" as const, workspace: ws.dir, message }],
  });
  try {
    const bin = opts.bin ?? resolvePackageBin("knip");
    const stdout = await execBin({
      bin,
      args: ["--reporter", "json", "--no-progress", "--no-exit-code"],
      cwd: ws.absDir,
      timeoutMs,
      nodeFlags: nodeFlags(),
    });
    return { findings: normalizeKnip(JSON.parse(stdout), repoRoot, ws), errors: [] };
  } catch (err) {
    return fail(describeFailure("knip", err, timeoutMs));
  }
}
