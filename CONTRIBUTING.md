# Contributing

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Node 20.19 or newer. Commits use `type: description` (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`), one logical change each. TypeScript is strict: no `any`, and every `as` cast needs a comment saying why. No `console.log` in source; CLI output goes through `process.stdout.write` / `process.stderr.write`.

## Run the plugin against a local build

Point the plugin at your build instead of the published package. Set `LEANCHECK_CMD` before starting Claude Code (build first with `npm run build`):

```bash
export LEANCHECK_CMD="node <abs>/packages/scanner/dist/cli.js"
```

Contributions that change the published package need a changeset: `npx changeset`.

## Writing a rule

Rules are [ast-grep](https://ast-grep.github.io) rules in YAML under `packages/scanner/rules/<pack>/<name>.yml`. Packs are exactly `core`, `drizzle`, `prisma`, `nextjs`, `react`. Each rule needs three files:

1. `rules/<pack>/<name>.yml` the rule
2. `rules/<pack>/<name>.test.yml` valid and invalid snippets
3. `docs/rules/<pack>/<name>.md` the docs page (sections: Why, Bad, Good, When it's fine, Config)

`packages/scanner/test/rules.test.ts` fails if a rule has no test file, and `docs.test.ts` fails if it has no docs page.

### Rule YAML

```yaml
id: core/await-in-loop        # <pack>/<name>, lowercase, hyphens
pack: core
category: perf                # perf | bloat | dup
severity: medium              # high | medium | low
confidence: medium            # high | medium
message: await inside a loop runs iterations one after another instead of concurrently.
fixHint: If iterations are independent, collect the promises and use Promise.all.
languages: [tsx, jsx]         # optional; default is ts, tsx, js, jsx
filter: someFilterName        # optional, see Filters
supersedes: [core/other-rule] # optional, see Supersedes
rule:                         # the ast-grep rule object
  kind: await_expression
  inside: { ... }
```

`rule`, `constraints` and `utils` are standard ast-grep. `rules/_shared/utils.yml` holds utils merged into every rule (for example `in-loop`, which matches code inside a loop body or an iteration callback); a rule's own `utils` win on name clashes. Pick severity by cost: `high` for per-item I/O and event-loop blocking, `medium` for avoidable latency or bundle weight, `low` for minor waste.

### Test YAML

```yaml
id: core/await-in-loop
lang: ts                 # ts | tsx | js | jsx, default ts
invalid:                 # every snippet must produce at least one match
  - "async function f(ids: string[]) { for (const id of ids) { await load(id); } }"
valid:                   # no snippet may match
  - "async function f(ids: string[]) { await Promise.all(ids.map((id) => load(id))); }"
```

Write the invalid snippets first and watch the test fail, then write the rule. Test files run through the same matcher (including filters) as the real scan.

### Traps

The `valid` list is where precision comes from. Always add the look-alikes that are correct code: the same method on an unrelated object (`d3.select`, `cache.delete`), work inside a closure that is only created in the loop, batched or chunked variants, `for await`, and arrays that are the loop's own variable. A rule that cannot tell a trap from a real problem should lower its confidence or get a filter, not ship noisy.

### Filters

Some conditions are awkward in pure ast-grep. A named TypeScript filter in `packages/scanner/src/rules/filters.ts` takes the matched node and its root and returns `true` to keep the match. Register it in `FILTERS` and reference it with `filter:` in the rule YAML. Filters must be pure and fast; an unregistered filter name makes `loadRules` throw, so the scan exits 3. Cover the filter with `valid` snippets.

### Supersedes

`supersedes: [other/rule]` drops findings of the other rule whose line range overlaps a finding of this rule in the same file, so one problem is reported once (`drizzle/insert-in-loop` supersedes `drizzle/query-in-loop`).

### Runner-based rules

`core/dead-code` (knip), `core/duplicate-code` (jscpd) and `core/duplicate-libraries` (a `package.json` check) have no YAML; they live in `packages/scanner/src/runners/`. They still need a docs page, and their IDs are listed by `allRuleIds()`.

## Fixture repos

`fixtures/planted` must trigger every rule ID; `fixtures/clean` must produce zero findings. If you add a rule, plant it in `fixtures/planted` (and list it in `PLANTED.md`), and make sure `clean` stays clean. The integration test snapshots the planted output.

## Docs

Rule docs live in `docs/rules/<pack>/<name>.md`; the scanner links to them from each finding (`DOCS_BASE_URL` in `packages/scanner/src/constants.ts`).
