import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { LeancheckConfig } from "./config.js";
import { toRepoRelative } from "./paths.js";
import type { Pack } from "./types.js";

export type Workspace = { dir: string; absDir: string; packs: Pack[] };

export class NotJsProjectError extends Error {}

const PACK_ORDER: Pack[] = ["core", "nextjs", "react", "drizzle", "prisma"];
const DEP_TO_PACK: Record<string, Pack> = {
  next: "nextjs",
  react: "react",
  "drizzle-orm": "drizzle",
  "@prisma/client": "prisma",
  prisma: "prisma",
};

const globList = z.array(z.string());
const packageJsonSchema = z
  .object({
    dependencies: z.record(z.string(), z.unknown()).optional(),
    devDependencies: z.record(z.string(), z.unknown()).optional(),
    workspaces: z.union([globList, z.object({ packages: globList })]).optional(),
  })
  .passthrough();
const pnpmSchema = z.object({ packages: globList.optional() }).passthrough();

type PackageJson = z.infer<typeof packageJsonSchema>;

async function readPackageJson(dir: string): Promise<PackageJson | null> {
  try {
    const raw = await readFile(path.join(dir, "package.json"), "utf8");
    const parsed = packageJsonSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function readPnpmGlobs(repoRoot: string): Promise<string[]> {
  try {
    const raw = await readFile(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");
    const parsed = pnpmSchema.safeParse(parseYaml(raw));
    return parsed.success ? (parsed.data.packages ?? []) : [];
  } catch {
    return [];
  }
}

function npmGlobs(pkg: PackageJson): string[] {
  if (!pkg.workspaces) return [];
  return Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages;
}

function detectPacks(pkg: PackageJson, config: LeancheckConfig): Pack[] {
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const found = new Set<Pack>(["core"]);
  for (const name of names) {
    const pack = DEP_TO_PACK[name];
    if (pack) found.add(pack);
  }
  return PACK_ORDER.filter((p) => found.has(p) && config.packs[p] !== false);
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function hasSourceDir(dir: string): Promise<boolean> {
  return (await isDir(path.join(dir, "src"))) || (await isDir(path.join(dir, "app")));
}

async function expandWorkspaceDirs(repoRoot: string, globs: string[]): Promise<string[]> {
  const positive = globs.filter((g) => !g.startsWith("!"));
  const negative = globs.filter((g) => g.startsWith("!")).map((g) => g.slice(1));
  const matches = await fg(positive, {
    cwd: repoRoot,
    onlyDirectories: true,
    absolute: true,
    ignore: ["**/node_modules/**", ...negative],
  });
  return [...new Set(matches)].sort();
}

async function toWorkspace(
  repoRoot: string,
  absDir: string,
  pkg: PackageJson,
  config: LeancheckConfig,
): Promise<Workspace> {
  return { dir: toRepoRelative(repoRoot, absDir), absDir, packs: detectPacks(pkg, config) };
}

export async function detectProject(
  repoRoot: string,
  config: LeancheckConfig,
): Promise<Workspace[]> {
  const rootPkg = await readPackageJson(repoRoot);
  if (!rootPkg) throw new NotJsProjectError(`No package.json found in ${repoRoot}`);

  const globs = [...npmGlobs(rootPkg), ...(await readPnpmGlobs(repoRoot))];
  if (globs.length === 0) return [await toWorkspace(repoRoot, repoRoot, rootPkg, config)];

  const workspaces: Workspace[] = [];
  if (await hasSourceDir(repoRoot)) {
    workspaces.push(await toWorkspace(repoRoot, repoRoot, rootPkg, config));
  }
  for (const absDir of await expandWorkspaceDirs(repoRoot, globs)) {
    const pkg = await readPackageJson(absDir);
    if (pkg) workspaces.push(await toWorkspace(repoRoot, absDir, pkg, config));
  }
  return workspaces;
}
