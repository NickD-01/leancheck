import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";

export const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const MAX_ERROR_CHARS = 500;

const execFileAsync = promisify(execFile);

export type RunnerOptions = { bin?: string; timeoutMs?: number };

// Some packages (knip, jscpd) have no `main` or do not export ./package.json, so
// require.resolve cannot find them; probe the node_modules lookup paths directly.
export function resolvePackageDir(pkgName: string): string {
  const require = createRequire(import.meta.url);
  for (const base of require.resolve.paths(pkgName) ?? []) {
    if (existsSync(path.join(base, pkgName, "package.json"))) return path.join(base, pkgName);
  }
  throw new Error(`could not locate ${pkgName} package.json`);
}

export function resolvePackageBin(pkgName: string, binName: string = pkgName): string {
  const dir = resolvePackageDir(pkgName);
  const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as {
    bin?: string | Record<string, string>;
  }; // package.json is trusted npm metadata; `bin` is either a string or a map
  const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.[binName];
  if (!rel) throw new Error(`${pkgName} package.json has no bin entry`);
  return path.resolve(dir, rel);
}

// Node prints these on stderr for require(esm) before the real error; they would fill the truncated message.
const NOISE_LINE = /ExperimentalWarning|--trace-warnings/;

type ExecFailure = Error & { killed?: boolean; stderr?: string };

export function describeFailure(runner: string, err: unknown, timeoutMs: number): string {
  const failure = err as ExecFailure; // execFile rejects with an Error carrying killed/stderr
  if (failure.killed) return `${runner} timed out after ${timeoutMs}ms`;
  const stderr = (failure.stderr ?? "")
    .split(/\r?\n/)
    .filter((line) => !NOISE_LINE.test(line))
    .join("\n")
    .trim();
  const detail = stderr || (err instanceof Error ? err.message : String(err));
  return `${runner} failed: ${detail.slice(0, MAX_ERROR_CHARS)}`;
}

export type ExecSpec = {
  bin: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  nodeFlags?: string[];
};

const SCRIPT_EXT = /\.(c|m)?js$/;

// JS bins run under the current node; native binaries run directly so a timeout kills them.
export async function execBin(spec: ExecSpec): Promise<string> {
  const [file, args] = SCRIPT_EXT.test(spec.bin)
    ? [process.execPath, [...(spec.nodeFlags ?? []), spec.bin, ...spec.args]]
    : [spec.bin, spec.args];
  const { stdout } = await execFileAsync(file, args, {
    cwd: spec.cwd,
    timeout: spec.timeoutMs,
    maxBuffer: MAX_BUFFER_BYTES,
    windowsHide: true,
  });
  return stdout;
}
