import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { DEFAULT_IGNORES } from "./constants.js";
import { detectProject, type Workspace } from "./detect.js";
import { assignIds, resolvePrecedence } from "./finalize.js";
import { applyIgnores } from "./ignore.js";
import { loadRules, type RuleDef } from "./rules/load.js";
import { runAstGrep } from "./runners/astgrep.js";
import { runDeps } from "./runners/deps.js";
import { DEFAULT_TIMEOUT_MS, describeFailure } from "./runners/exec.js";
import { runJscpd } from "./runners/jscpd.js";
import { runKnip } from "./runners/knip.js";
import type { Pack, RawFinding, RunnerError, ScanResult } from "./types.js";

type RunnerOutput = { findings: RawFinding[]; errors: RunnerError[] };

const versionSchema = z.object({ version: z.string() });

// src/ and dist/ both sit directly under the package root.
function scannerVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(path.resolve(here, "../package.json"), "utf8");
  return versionSchema.parse(JSON.parse(raw)).version;
}

type RunnerName = RunnerError["runner"];

// Runners are documented never to throw, but a stray rejection must not abort the whole scan.
async function guarded(
  runner: RunnerName,
  ws: Workspace,
  run: () => Promise<RunnerOutput>,
): Promise<RunnerOutput> {
  try {
    return await run();
  } catch (err) {
    const message = describeFailure(runner, err, DEFAULT_TIMEOUT_MS);
    return { findings: [], errors: [{ runner, workspace: ws.dir, message }] };
  }
}

const EMPTY: RunnerOutput = { findings: [], errors: [] };

// In a hybrid monorepo the root workspace also walks every child directory; the children are
// scanned on their own, so the root must not report them a second time.
function childDirsOf(ws: Workspace, all: Workspace[]): string[] {
  return ws.dir === "." ? all.filter((w) => w.dir !== ".").map((w) => w.dir) : [];
}

function outsideDirs(out: RunnerOutput, dirs: string[]): RunnerOutput {
  if (dirs.length === 0) return out;
  const inside = (file: string): boolean => dirs.some((d) => file.startsWith(`${d}/`));
  return { ...out, findings: out.findings.filter((f) => !inside(f.file)) };
}

async function runWorkspace(
  repoRoot: string,
  ws: Workspace,
  rules: RuleDef[],
  ignores: string[],
  minLines: number,
  childDirs: string[],
): Promise<RunnerOutput[]> {
  const wsRules = rules.filter((r) => ws.packs.includes(r.pack));
  const wsIgnores = [...ignores, ...childDirs.map((d) => `${d}/**`)];
  const core = ws.packs.includes("core");
  const coreOnly = (run: () => Promise<RunnerOutput>): Promise<RunnerOutput> =>
    core ? run() : Promise.resolve(EMPTY);
  const outs = await Promise.all([
    guarded("astgrep", ws, () => runAstGrep(repoRoot, ws, wsRules, wsIgnores)),
    coreOnly(() => guarded("deps", ws, () => runDeps(repoRoot, ws))),
    coreOnly(() => guarded("knip", ws, () => runKnip(repoRoot, ws))),
    coreOnly(() => guarded("jscpd", ws, () => runJscpd(repoRoot, ws, minLines, wsIgnores))),
  ]);
  return outs.map((o) => outsideDirs(o, childDirs));
}

export async function scan(inputPath: string): Promise<ScanResult> {
  const repoRoot = path.resolve(inputPath);
  const config = await loadConfig(repoRoot);
  const workspaces = await detectProject(repoRoot, config);
  const allPacks = [...new Set(workspaces.flatMap((w) => w.packs))];
  const rules = await loadRules(allPacks);
  const ignores = [...DEFAULT_IGNORES, ...config.ignorePaths];

  const raw: RawFinding[] = [];
  const runnerErrors: RunnerError[] = [];
  for (const ws of workspaces) {
    for (const out of await runWorkspace(repoRoot, ws, rules, ignores, config.jscpd.minLines, childDirsOf(ws, workspaces))) {
      raw.push(...out.findings);
      runnerErrors.push(...out.errors);
    }
  }

  const readSource = (file: string): string => readFileSync(path.join(repoRoot, file), "utf8");
  const kept = resolvePrecedence(applyIgnores(raw, readSource, config), rules);
  const packs: Record<string, Pack[]> = Object.fromEntries(workspaces.map((w) => [w.dir, w.packs]));
  return {
    version: scannerVersion(),
    scannedAt: new Date().toISOString(),
    workspaces: workspaces.map((w) => w.dir),
    packs,
    findings: assignIds(kept),
    runnerErrors,
  };
}
