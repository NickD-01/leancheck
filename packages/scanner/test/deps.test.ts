import { describe, expect, it } from "vitest";
import type { Workspace } from "../src/detect.js";
import { OVERLAP_GROUPS, runDeps } from "../src/runners/deps.js";
import { tmpDirWith } from "./helpers.js";

function wsFor(dir: string, rel = "."): Workspace {
  return {
    dir: rel,
    absDir: rel === "." ? dir : `${dir}/${rel}`,
    packs: ["core"],
  };
}

describe("runDeps", () => {
  it("reports one finding per overlapping group with the first dep's line", async () => {
    const root = tmpDirWith({
      "package.json": [
        "{",
        '  "name": "x",',
        '  "dependencies": {',
        '    "dayjs": "1.0.0",',
        '    "moment": "2.0.0",',
        '    "zod": "3.0.0",',
        '    "yup": "1.0.0"',
        "  }",
        "}",
      ].join("\n"),
    });
    const { findings, errors } = await runDeps(root, wsFor(root));
    expect(errors).toEqual([]);
    expect(findings).toHaveLength(2);
    const dates = findings.find((f) => f.message.startsWith("Multiple dates"));
    expect(dates).toMatchObject({
      ruleId: "core/duplicate-libraries",
      pack: "core",
      category: "bloat",
      severity: "medium",
      confidence: "high",
      file: "package.json",
      line: 4,
      endLine: 4,
      snippet: '"dayjs": "1.0.0",',
      message: "Multiple dates libraries: moment, dayjs",
      fixHint: "Standardise on one; remove the others after migrating usages.",
    });
    const validation = findings.find((f) => f.message.startsWith("Multiple validation"));
    expect(validation?.line).toBe(6);
    expect(validation?.message).toBe("Multiple validation libraries: zod, yup");
    expect(validation?.docsUrl).toContain("core/duplicate-libraries");
  });

  it("reports nothing when each group has a single library", async () => {
    const root = tmpDirWith({
      "package.json": JSON.stringify({
        dependencies: { dayjs: "1", axios: "1", zod: "3" },
      }),
    });
    const result = await runDeps(root, wsFor(root));
    expect(result).toEqual({ findings: [], errors: [] });
  });

  it("counts devDependencies and uses the earliest line across sections", async () => {
    const root = tmpDirWith({
      "apps/web/package.json": [
        "{",
        '  "devDependencies": {',
        '    "clsx": "2.0.0"',
        "  },",
        '  "dependencies": {',
        '    "classnames": "2.0.0"',
        "  }",
        "}",
      ].join("\n"),
    });
    const { findings } = await runDeps(root, wsFor(root, "apps/web"));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "apps/web/package.json",
      workspace: "apps/web",
      line: 3,
      message: "Multiple classnames libraries: classnames, clsx",
    });
  });

  it("ignores names that only appear outside dependency sections", async () => {
    const root = tmpDirWith({
      "package.json": [
        "{",
        '  "peerDependencies": {',
        '    "moment": "2.0.0"',
        "  },",
        '  "dependencies": {',
        '    "dayjs": "1.0.0"',
        "  }",
        "}",
      ].join("\n"),
    });
    const { findings } = await runDeps(root, wsFor(root));
    expect(findings).toEqual([]);
  });

  it("returns a runner error instead of throwing on invalid package.json", async () => {
    const root = tmpDirWith({ "package.json": "{ not json" });
    const { findings, errors } = await runDeps(root, wsFor(root));
    expect(findings).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      runner: "deps",
      workspace: ".",
      file: "package.json",
    });
  });

  it("exposes the overlap groups", () => {
    expect(OVERLAP_GROUPS.ids).toContain("@paralleldrive/cuid2");
    expect(Object.keys(OVERLAP_GROUPS)).toHaveLength(6);
  });
});
