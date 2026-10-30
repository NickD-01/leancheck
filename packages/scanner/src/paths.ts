import path from "node:path";

const toForwardSlashes = (p: string): string => p.replaceAll("\\", "/");

// posix-only relative() so Windows-style input resolves identically on any host OS.
export function toRepoRelative(repoRoot: string, absPath: string): string {
  const rel = path.posix.relative(toForwardSlashes(repoRoot), toForwardSlashes(absPath));
  return rel === "" ? "." : rel;
}
