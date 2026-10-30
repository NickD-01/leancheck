import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { docsUrlFor } from "../constants.js";
import type { Workspace } from "../detect.js";
import { toRepoRelative } from "../paths.js";
import type { RawFinding, RunnerError } from "../types.js";
import {
  DEFAULT_TIMEOUT_MS,
  type RunnerOptions,
  describeFailure,
  execBin,
  resolvePackageDir,
} from "./exec.js";

export const RULE_ID = "core/duplicate-code";
const FIX_HINT = "Extract a shared helper.";
const MEDIUM_MIN_LINES = 25;
const MAX_SNIPPET_CHARS = 200;
const FORMATS = "typescript,javascript,tsx,jsx";
const REPORT_FILE = "jscpd-report.json";

const fileRef = z.object({ name: z.string(), start: z.number().int(), end: z.number().int() });

const jscpdSchema = z.object({
  duplicates: z.array(
    z.object({
      lines: z.number().int(),
      fragment: z.string(),
      firstFile: fileRef,
      secondFile: fileRef,
    }),
  ),
});

export type JscpdOptions = RunnerOptions;

type PlatformMap = {
  getPlatformKey: () => string | null;
  PLATFORM_MAP: Record<string, { packageName: string }>;
};

// The npm bin is a launcher that spawnSync()s the native binary, so a timeout would orphan
// the native process. Resolve the native binary exactly as the launcher does.
export function resolveJscpdBin(): string {
  const dir = resolvePackageDir("jscpd");
  const dirRequire = createRequire(path.join(dir, "package.json"));
  const platform = dirRequire("./platform-map.js") as PlatformMap; // untyped CJS helper shipped with jscpd
  const key = platform.getPlatformKey();
  const entry = key ? platform.PLATFORM_MAP[key] : undefined;
  if (!entry) throw new Error("jscpd has no prebuilt binary for this platform");
  let pkgJson: string;
  try {
    pkgJson = dirRequire.resolve(`${entry.packageName}/package.json`, { paths: [dir] });
  } catch {
    throw new Error(`jscpd platform package ${entry.packageName} is not installed`);
  }
  const name = process.platform === "win32" ? "jscpd.exe" : "jscpd";
  return path.join(path.dirname(pkgJson), "bin", name);
}

export function normalizeJscpd(json: unknown, repoRoot: string, ws: Workspace): RawFinding[] {
  const parsed = jscpdSchema.parse(json);
  // jscpd emits paths relative to the scan cwd, with backslashes on Windows.
  const repoFile = (name: string): string =>
    toRepoRelative(repoRoot, path.join(ws.absDir, name.replaceAll("\\", "/")));

  return parsed.duplicates.map((dup) => ({
    ruleId: RULE_ID,
    pack: "core",
    category: "dup",
    severity: dup.lines >= MEDIUM_MIN_LINES ? "medium" : "low",
    confidence: "high",
    workspace: ws.dir,
    file: repoFile(dup.firstFile.name),
    line: dup.firstFile.start,
    endLine: dup.firstFile.end,
    snippet: dup.fragment.slice(0, MAX_SNIPPET_CHARS),
    message: `Duplicated ${dup.lines} lines (also in ${repoFile(dup.secondFile.name)}:${dup.secondFile.start})`,
    fixHint: FIX_HINT,
    docsUrl: docsUrlFor(RULE_ID),
  }));
}

export async function runJscpd(
  repoRoot: string,
  ws: Workspace,
  minLines: number,
  ignores: string[],
  opts: JscpdOptions = {},
): Promise<{ findings: RawFinding[]; errors: RunnerError[] }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let outDir: string | undefined;
  try {
    const bin = opts.bin ?? resolveJscpdBin();
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), "leancheck-jscpd-"));
    const args = [
      "--min-lines", String(minLines),
      "--reporters", "json",
      "--output", outDir,
      "--silent",
      "--format", FORMATS,
      ...(ignores.length > 0 ? ["--ignore", ignores.join(",")] : []),
      ".",
    ];
    await execBin({ bin, args, cwd: ws.absDir, timeoutMs });
    const report: unknown = JSON.parse(fs.readFileSync(path.join(outDir, REPORT_FILE), "utf8"));
    return { findings: normalizeJscpd(report, repoRoot, ws), errors: [] };
  } catch (err) {
    const message = describeFailure("jscpd", err, timeoutMs);
    return { findings: [], errors: [{ runner: "jscpd", workspace: ws.dir, message }] };
  } finally {
    if (outDir) fs.rmSync(outDir, { recursive: true, force: true });
  }
}
