import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { main, nodeVersionWarning } from "../src/main.js";
import type { ScanResult } from "../src/types.js";
import { tmpDirWith } from "./helpers.js";

vi.mock("../src/runners/knip.js", () => ({
  runKnip: vi.fn(async () => ({ findings: [], errors: [] })),
}));
// jscpd stubbed too: its temp dirs in os.tmpdir() would race the jscpd runner's own cleanup test.
vi.mock("../src/runners/jscpd.js", () => ({
  runJscpd: vi.fn(async () => ({ findings: [], errors: [] })),
}));

let out = "";
let err = "";

beforeEach(() => {
  out = "";
  err = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    err += String(chunk);
    return true;
  });
});
afterEach(() => vi.restoreAllMocks());

const CLONE = "export const c = (x: unknown) => JSON.parse(JSON.stringify(x));\n";

describe("main", () => {
  test("exit 2 and stderr message for non-JS dir", async () => {
    const dir = tmpDirWith({ "readme.txt": "hi" });
    expect(await main(["scan", dir])).toBe(2);
    expect(err).toContain("package.json");
  });

  test("exit 1 for invalid config", async () => {
    const dir = tmpDirWith({ "package.json": "{}", "leancheck.config.json": "{ nope" });
    expect(await main(["scan", dir])).toBe(1);
    expect(err).toContain("leancheck.config.json");
  });

  test("exit 3 on unknown arguments", async () => {
    expect(await main(["scan", "--bogus"])).toBe(3);
    expect(err).toContain("Usage");
  });

  test("prints a table with columns and summary line", async () => {
    const dir = tmpDirWith({ "package.json": "{}", "src/c.ts": CLONE });
    expect(await main(["scan", dir])).toBe(0);
    expect(out).toMatch(/ID\s+SEV\s+RULE\s+LOCATION\s+MESSAGE/);
    expect(out).toMatch(/L-001\s+medium\s+core\/json-deep-clone\s+src\/c\.ts:1\s+/);
    expect(out).toMatch(/1 findings \(0 high, 1 medium, 0 low\) in 1 workspace\(s\); 0 runner error\(s\)/);
  });

  test("--json --out writes ScanResult and exits 0", async () => {
    const dir = tmpDirWith({ "package.json": "{}", "src/c.ts": CLONE });
    const outFile = path.join(os.tmpdir(), `leancheck-out-${Date.now()}`, "nested", "result.json");
    expect(await main(["scan", dir, "--json", "--out", outFile])).toBe(0);
    // test reads back JSON this process just produced
    const written = JSON.parse(fs.readFileSync(outFile, "utf8")) as ScanResult;
    expect(written.findings.map((f) => f.ruleId)).toContain("core/json-deep-clone");
    expect(JSON.parse(out)).toEqual(written);
  });

  test("--out alone writes the file and still prints the table", async () => {
    const dir = tmpDirWith({ "package.json": "{}", "src/c.ts": CLONE });
    const outFile = path.join(dir, ".leancheck", "r.json");
    expect(await main(["scan", dir, "--out", outFile])).toBe(0);
    expect(fs.existsSync(outFile)).toBe(true);
    expect(out).toContain("ID");
  });
});

describe("nodeVersionWarning", () => {
  test("warns below 20.19 and stays silent otherwise", () => {
    expect(nodeVersionWarning("20.18.1")).toBe(
      "leancheck requires Node >=20.19, found 20.18.1; some checks may fail",
    );
    expect(nodeVersionWarning("18.0.0")).toContain("found 18.0.0");
    expect(nodeVersionWarning("20.19.0")).toBeNull();
    expect(nodeVersionWarning("22.1.0")).toBeNull();
  });
});
