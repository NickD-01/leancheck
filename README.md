# leancheck

Finds efficiency problems in JavaScript and TypeScript codebases: N+1 queries, awaits that should run in parallel, unneeded client components, duplicated code, overlapping libraries, dead code. A deterministic scanner produces the findings; the Claude Code plugin then reads the code to confirm or reject each one and, only when you ask, fixes them behind a test gate.

> **Status: 0.1.2 pre-release.** The scanner has a test suite, fixture repos and [one real-application run](docs/acceptance/2026-10-first-real-run.md). Expect false positives and gaps. The plugin has not yet run end to end inside Claude Code, and its evals (`plugin/evals/`) have not been run.

## Why

AI-assisted code tends to work and be slow: a query per item in a loop, `await` after `await`, `"use client"` on everything, three date libraries. Linters do not catch these and an LLM reading a whole repo is slow and inconsistent. leancheck splits the job: fast, repeatable rules find candidates, then an LLM judges each candidate in context (a cursor-paginated loop is not an N+1), and fixes are applied one finding at a time with typecheck and tests as the gate.

### Prior art

| Existing tool | Gap |
| --- | --- |
| mcbader93/vibecheck skill | Scores Claude Code usage, not code |
| anti-slop / deslop skills | Diff-only style cleanup; no performance rules, no static tools |
| hossein-webdev/vibe-check | Broad production-readiness audit; no N+1, duplication or bundle-level code rules |
| adewale/audit-skill | LLM-only, language-generic performance audit |
| VibeDoctor (SaaS) | Performance checks target the deployed site; report-only |

As of 2026-10-29 none of these combined deterministic analyzers, stack-specific efficiency rules, LLM triage and test-gated fixes.

## Quick start: CLI

Requires Node 20.19 or newer. Install your project's dependencies first: dead-code results (via knip) are only accurate when `node_modules` is present.

```bash
npx leancheck scan .                       # table of findings
npx leancheck scan . --json                # JSON on stdout
npx leancheck scan . --out findings.json   # also write JSON to a file
```

The scanner never modifies your code. Findings are numbered `L-001`, `L-002`, ... ordered by severity, then file, then line.

Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | Scan completed (any number of findings) |
| 1 | Invalid `leancheck.config.json` |
| 2 | Not a JS/TS project (no `package.json`) |
| 3 | Usage error or internal error |

## Quick start: Claude Code plugin

```text
/plugin marketplace add NickD-01/leancheck
/plugin install leancheck@leancheck
```

Then in your project:

```text
/leancheck                    # scan, triage every finding, write .leancheck/report.md
/leancheck apps/web           # scan a sub-path
/leancheck fix L-003 L-007    # fix named findings
/leancheck fix all-high       # fix every confirmed high-severity finding
```

Report mode writes only inside `.leancheck/` (`findings.json`, `triage.json`, `report.md`) and never edits source. It runs the scanner via `npx leancheck@0.1.2`, so Node and network access are needed on first use.

### Fix mode

Fix mode touches only the findings you name. For each one it requires a clean git tree, applies the fix, runs typecheck and your test suite, and makes one `perf:` commit per fixed finding. It never pushes.

- A finding that fails typecheck or tests is rolled back. If a fix fails on tests that mock the old API, the attempted change is restored and saved as a patch in `.leancheck/failed/` so you can review it.
- Fixes that change behavior (adding a limit, changing ordering, swapping a library) need your explicit confirmation.
- Dependency changes (removing unused or duplicate packages) are skipped in 0.1.2.

## Rules

Each rule has a page under [`docs/rules/`](docs/rules) with a bad and good example and when to ignore it. Default severity in brackets.

| Rule | Severity | What it finds |
| --- | --- | --- |
| [core/await-in-loop](docs/rules/core/await-in-loop.md) | medium | `await` in a loop body |
| [core/sequential-awaits](docs/rules/core/sequential-awaits.md) | medium | independent awaits run back to back |
| [core/sync-io-in-handler](docs/rules/core/sync-io-in-handler.md) | high | `*Sync` filesystem calls in async functions |
| [core/lookup-in-loop](docs/rules/core/lookup-in-loop.md) | medium | `find`/`includes`/`indexOf` on an array inside a loop |
| [core/json-deep-clone](docs/rules/core/json-deep-clone.md) | medium | `JSON.parse(JSON.stringify(x))` |
| [core/heavy-import](docs/rules/core/heavy-import.md) | low | whole-library imports of lodash, moment, ramda, underscore |
| [core/duplicate-libraries](docs/rules/core/duplicate-libraries.md) | medium | two libraries doing the same job in `package.json` |
| [core/dead-code](docs/rules/core/dead-code.md) | low / medium | unused files, exports, dependencies (knip) |
| [core/duplicate-code](docs/rules/core/duplicate-code.md) | low / medium | duplicated blocks (jscpd) |
| [drizzle/query-in-loop](docs/rules/drizzle/query-in-loop.md) | high | N+1 queries |
| [drizzle/insert-in-loop](docs/rules/drizzle/insert-in-loop.md) | high | one INSERT per item |
| [drizzle/select-all-columns](docs/rules/drizzle/select-all-columns.md) | low | `select()` with no column list |
| [drizzle/unbounded-select](docs/rules/drizzle/unbounded-select.md) | medium | query with no `limit` |
| [prisma/query-in-loop](docs/rules/prisma/query-in-loop.md) | high | N+1 queries |
| [prisma/create-in-loop](docs/rules/prisma/create-in-loop.md) | high | one `create` per item |
| [nextjs/fetch-in-effect](docs/rules/nextjs/fetch-in-effect.md) | medium | data fetched in `useEffect` |
| [nextjs/unneeded-use-client](docs/rules/nextjs/unneeded-use-client.md) | medium | `"use client"` on a file that needs nothing from the browser |
| [react/derived-state-in-effect](docs/rules/react/derived-state-in-effect.md) | medium | state mirrored from props in an effect |

The Drizzle, Prisma, Next.js and React packs only run in workspaces that depend on `drizzle-orm`, `@prisma/client` (or `prisma`), `next` or `react`.

## Configuration

Optional `leancheck.config.json` in the scanned root. Unknown keys are an error (exit code 1).

```json
{
  "ignorePaths": ["scripts/**", "**/*.stories.tsx"],
  "rules": {
    "core/heavy-import": "off",
    "drizzle/unbounded-select": "high"
  },
  "packs": { "react": false },
  "jscpd": { "minLines": 15 }
}
```

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `ignorePaths` | glob[] | `[]` | Extra paths to drop, added to the defaults below |
| `rules` | `{ [ruleId]: "off" \| "high" \| "medium" \| "low" }` | `{}` | Disable a rule or override its severity |
| `packs` | `{ core, drizzle, prisma, nextjs, react: boolean }` | all detected packs on | Set a pack to `false` to turn it off; packs are never forced on |
| `jscpd.minLines` | integer | `10` | Minimum duplicated block size |

Always ignored: `**/node_modules/**`, `**/.next/**`, `**/dist/**`, `**/build/**`, `**/.leancheck/**`, `**/*.generated.*`, `**/*.d.ts`, `**/coverage/**`, `**/out/**`, `**/.vercel/**`, `**/.turbo/**`, `**/.output/**`, `**/.open-next/**`, `**/.wrangler/**`, `**/*.min.js`, `**/generated/**`.

### Ignore comments

Suppress one occurrence with a comment on the same line or the line above:

```ts
// leancheck-ignore drizzle/query-in-loop
for (const id of ids) await db.select().from(users).where(eq(users.id, id));

// leancheck-ignore          <- bare token: every rule
```

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for writing a rule.

## License

MIT
