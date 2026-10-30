import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Pack, Severity } from "./types.js";

export const CONFIG_FILE_NAME = "leancheck.config.json";
const DEFAULT_JSCPD_MIN_LINES = 10;

const configSchema = z
  .object({
    ignorePaths: z.array(z.string()).default([]),
    rules: z.record(z.string(), z.enum(["off", "high", "medium", "low"])).default({}),
    packs: z
      .object({
        core: z.boolean(),
        drizzle: z.boolean(),
        prisma: z.boolean(),
        nextjs: z.boolean(),
        react: z.boolean(),
      })
      .partial()
      .strict()
      .default({}),
    jscpd: z
      .object({ minLines: z.number().int().positive().default(DEFAULT_JSCPD_MIN_LINES) })
      .strict()
      .default({ minLines: DEFAULT_JSCPD_MIN_LINES }),
  })
  .strict();

export type LeancheckConfig = {
  ignorePaths: string[];
  rules: Record<string, "off" | Severity>;
  packs: Partial<Record<Pack, boolean>>;
  jscpd: { minLines: number };
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

async function readConfigText(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") return null;
    throw new ConfigError(`Could not read ${CONFIG_FILE_NAME}`);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ConfigError(`Invalid ${CONFIG_FILE_NAME}: not valid JSON`);
  }
}

export async function loadConfig(repoRoot: string): Promise<LeancheckConfig> {
  const text = await readConfigText(path.join(repoRoot, CONFIG_FILE_NAME));
  const raw: unknown = text === null ? {} : parseJson(text);
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue ? issue.path.map(String).join(".") : "";
    throw new ConfigError(`Invalid ${CONFIG_FILE_NAME}${where ? ` at ${where}` : ""}: ${issue?.message ?? "invalid"}`);
  }
  return parsed.data;
}
