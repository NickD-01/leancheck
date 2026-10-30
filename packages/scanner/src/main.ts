import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ConfigError } from "./config.js";
import { NotJsProjectError } from "./detect.js";
import { formatTable } from "./format.js";
import { scan } from "./scan.js";

const USAGE = "Usage: leancheck scan [path] [--json] [--out <file>]\n";

const EXIT_OK = 0;
const EXIT_CONFIG = 1;
const EXIT_NOT_JS = 2;
const EXIT_USAGE = 3;

type Args = { path: string; json: boolean; out?: string };

function parseArgs(argv: string[]): Args | null {
  const [command, ...rest] = argv;
  if (command !== "scan") return null;
  let target = ".";
  let json = false;
  let out: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] as string; // index is bounded by rest.length
    if (arg === "--json") json = true;
    else if (arg === "--out") {
      out = rest[++i];
      if (out === undefined) return null;
    } else if (arg.startsWith("-")) return null;
    else target = arg;
  }
  return out === undefined ? { path: target, json } : { path: target, json, out };
}

function fail(message: string, code: number): number {
  process.stderr.write(`${message}\n`);
  return code;
}

const MIN_NODE = [20, 19] as const;

export function nodeVersionWarning(version: string): string | null {
  const [major = 0, minor = 0] = version.split(".").map(Number);
  const ok = major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
  return ok ? null : `leancheck requires Node >=${MIN_NODE.join(".")}, found ${version}; some checks may fail`;
}

export async function main(argv: string[]): Promise<number> {
  const warning = nodeVersionWarning(process.versions.node);
  if (warning) process.stderr.write(`${warning}\n`);
  const args = parseArgs(argv);
  if (!args) return fail(USAGE.trimEnd(), EXIT_USAGE);
  try {
    const result = await scan(args.path);
    const json = `${JSON.stringify(result, null, 2)}\n`;
    if (args.out !== undefined) {
      await mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
      await writeFile(args.out, json);
    }
    process.stdout.write(args.json ? json : formatTable(result));
    return EXIT_OK;
  } catch (err) {
    if (err instanceof ConfigError) return fail(err.message, EXIT_CONFIG);
    if (err instanceof NotJsProjectError) return fail(err.message, EXIT_NOT_JS);
    throw err;
  }
}
