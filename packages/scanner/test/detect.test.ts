import { expect, test } from "vitest";
import { NotJsProjectError, detectProject } from "../src/detect.js";
import type { LeancheckConfig } from "../src/config.js";
import { tmpDirWith } from "./helpers.js";

const defaults: LeancheckConfig = { ignorePaths: [], rules: {}, packs: {}, jscpd: { minLines: 10 } };
const pkg = (deps: Record<string, string>, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ name: "x", dependencies: deps, ...extra });

test("single package with next + drizzle", async () => {
  const ws = await detectProject(
    tmpDirWith({ "package.json": pkg({ next: "16", react: "19", "drizzle-orm": "1" }) }),
    defaults,
  );
  expect(ws).toEqual([
    { dir: ".", absDir: expect.any(String), packs: ["core", "nextjs", "react", "drizzle"] },
  ]);
});

test("npm workspaces: each workspace gets its own packs", async () => {
  const root = tmpDirWith({
    "package.json": pkg({}, { workspaces: ["apps/*"] }),
    "apps/web/package.json": pkg({ next: "16", react: "19" }),
    "apps/api/package.json": pkg({ "drizzle-orm": "1" }),
  });
  const ws = await detectProject(root, defaults);
  const byDir = Object.fromEntries(ws.map((w) => [w.dir, w.packs]));
  expect(byDir).toEqual({
    "apps/web": ["core", "nextjs", "react"],
    "apps/api": ["core", "drizzle"],
  });
});

test("workspaces object form with root src/ includes root", async () => {
  const root = tmpDirWith({
    "package.json": pkg({ react: "19" }, { workspaces: { packages: ["pkgs/*"] } }),
    "src/index.ts": "",
    "pkgs/a/package.json": pkg({ prisma: "1" }),
  });
  const ws = await detectProject(root, defaults);
  expect(ws.map((w) => w.dir).sort()).toEqual([".", "pkgs/a"]);
  expect(ws.find((w) => w.dir === "pkgs/a")?.packs).toEqual(["core", "prisma"]);
});

test("pnpm-workspace.yaml with dep-less root", async () => {
  const root = tmpDirWith({
    "package.json": pkg({}),
    "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
    "apps/web/package.json": pkg({ next: "16" }),
    "packages/db/package.json": pkg({ "@prisma/client": "5" }),
  });
  const ws = await detectProject(root, defaults);
  expect(ws.map((w) => w.dir).sort()).toEqual(["apps/web", "packages/db"]);
});

test("config.packs.prisma=false removes prisma", async () => {
  const ws = await detectProject(tmpDirWith({ "package.json": pkg({ prisma: "5", react: "19" }) }), {
    ...defaults,
    packs: { prisma: false },
  });
  expect(ws[0]?.packs).toEqual(["core", "react"]);
});

test("throws NotJsProjectError when no package.json", async () => {
  await expect(detectProject(tmpDirWith({ "main.py": "" }), defaults)).rejects.toThrow(
    NotJsProjectError,
  );
});
