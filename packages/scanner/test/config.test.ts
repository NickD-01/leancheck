import { expect, test } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";
import { tmpDirWith } from "./helpers.js";

test("returns defaults when no config file exists", async () => {
  const cfg = await loadConfig(tmpDirWith({}));
  expect(cfg).toEqual({ ignorePaths: [], rules: {}, packs: {}, jscpd: { minLines: 10 } });
});

test("merges a partial config over defaults", async () => {
  const cfg = await loadConfig(
    tmpDirWith({ "leancheck.config.json": '{"jscpd":{"minLines":20},"packs":{"prisma":false}}' }),
  );
  expect(cfg.jscpd.minLines).toBe(20);
  expect(cfg.packs.prisma).toBe(false);
});

test("rejects an unknown rule level with a ConfigError naming the path", async () => {
  const p = loadConfig(tmpDirWith({ "leancheck.config.json": '{"rules":{"core/dead-code":"loud"}}' }));
  await expect(p).rejects.toThrow(ConfigError);
  await expect(p).rejects.toThrow(/rules\.core\/dead-code/);
});

test("rejects malformed JSON with a ConfigError", async () => {
  await expect(loadConfig(tmpDirWith({ "leancheck.config.json": "{" }))).rejects.toThrow(ConfigError);
});

test("a config error with an empty path omits the 'at' clause", async () => {
  const err = await loadConfig(tmpDirWith({ "leancheck.config.json": '{"bogus":1}' })).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ConfigError);
  expect((err as ConfigError).message).not.toContain(" at ");
  expect((err as ConfigError).message).toMatch(/^Invalid leancheck\.config\.json: /);
});
