import { expect, test } from "vitest";
import { toRepoRelative } from "../src/paths.js";

test("toRepoRelative converts backslashes", () => {
  expect(toRepoRelative("C:\\repo", "C:\\repo\\src\\a.ts")).toBe("src/a.ts");
});

test("toRepoRelative handles posix paths and root", () => {
  expect(toRepoRelative("/repo", "/repo/src/a.ts")).toBe("src/a.ts");
  expect(toRepoRelative("/repo", "/repo")).toBe(".");
});
