import { expect, test } from "vitest";
import { describeFailure } from "../src/runners/exec.js";

test("describeFailure drops Node experimental-warning noise so the real cause shows", () => {
  const stderr = [
    "(node:1) ExperimentalWarning: CommonJS module is loading ES Module using require()",
    "(Use `node --trace-warnings ...` to show where the warning was created)",
    "Error: Cannot find module 'foo'",
  ].join("\n");
  const msg = describeFailure("knip", Object.assign(new Error("x"), { stderr }), 1000);
  expect(msg).toBe("knip failed: Error: Cannot find module 'foo'");
});
