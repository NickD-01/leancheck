import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { DOCS_BASE_URL, docsUrlFor } from "../src/constants.js";
import { allRuleIds } from "../src/rules/load.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const docsDir = path.join(repoRoot, "docs", "rules");

describe("rule docs", () => {
  test("every rule id has docs/rules/<id>.md", async () => {
    const missing = (await allRuleIds()).filter((id) => !existsSync(path.join(docsDir, `${id}.md`)));
    expect(missing).toEqual([]);
  });

  test("docs URLs point into docs/rules", () => {
    expect(DOCS_BASE_URL).not.toContain("OWNER");
    expect(DOCS_BASE_URL.endsWith("/docs/rules")).toBe(true);
    expect(docsUrlFor("core/await-in-loop")).toBe(`${DOCS_BASE_URL}/core/await-in-loop.md`);
  });
});
