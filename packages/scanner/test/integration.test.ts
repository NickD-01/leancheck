import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { allRuleIds } from "../src/rules/load.js";
import { scan } from "../src/scan.js";

// Fixtures are scanned without installing their dependencies; see fixtures/README.md.
const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");
const PLANTED = path.join(fixturesDir, "planted");
const CLEAN = path.join(fixturesDir, "clean");

// knip and jscpd spawn real processes; on a cold machine they take several seconds each.
const TIMEOUT_MS = 60_000;

describe("allRuleIds", () => {
  test("lists the 15 ast-grep rules plus the 3 runner rules", async () => {
    const ids = await allRuleIds();
    expect(ids).toHaveLength(18);
    expect(new Set(ids).size).toBe(18);
    expect(ids).toEqual(
      expect.arrayContaining(["core/duplicate-libraries", "core/dead-code", "core/duplicate-code"]),
    );
  });

  test("rejects a missing rules directory instead of throwing at import", async () => {
    await expect(allRuleIds(path.join(fixturesDir, "no-such-rules"))).rejects.toThrow(
      "Rules directory not found",
    );
  });
});

describe("fixture repos", () => {
  test(
    "planted fixture: every rule ID fires at least once",
    async () => {
      const r = await scan(PLANTED);
      expect(new Set(r.findings.map((f) => f.ruleId))).toEqual(new Set(await allRuleIds()));
      expect(r.runnerErrors).toEqual([]);
    },
    TIMEOUT_MS,
  );

  test(
    "planted fixture snapshot",
    async () => {
      const r = await scan(PLANTED);
      expect(
        r.findings.map(({ id, ruleId, file, line }) => ({ id, ruleId, file, line })),
      ).toMatchSnapshot();
    },
    TIMEOUT_MS,
  );

  test(
    "clean fixture: zero findings",
    async () => {
      const r = await scan(CLEAN);
      expect(r.findings).toEqual([]);
      expect(r.runnerErrors).toEqual([]);
    },
    TIMEOUT_MS,
  );
});
