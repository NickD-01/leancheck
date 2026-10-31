# Triage guide

How to judge each leancheck finding. The scanner already filters many false positives (see "Already handled" below), so do not reject a finding just because it *could* be one of those cases — check the code. What remains for you is what a pattern matcher cannot know: data flow between iterations, where the code runs, how big the data is, and what the framework loads by convention.

## Universal checks (every rule)

1. **Hot or cold path?** Find who calls the code. Trace imports one or two levels if the file itself does not make it obvious.
   - Hot: route handlers, API endpoints, server actions, pages/layouts rendered per request, components rendered on every render, middleware, queue consumers and cron jobs that process production data, library functions called from any of these.
   - Cold: seed scripts, migrations, one-off or maintenance CLI scripts (often under `scripts/`, run via a `package.json` script or by hand), build-time code (`generateStaticParams`, static generation, config files such as `next.config.*`, `tailwind.config.*`), tests, fixtures, mocks, storybook, dev-only tooling.
   - A **perf** finding (`category: "perf"`) on a cold path is **rejected**: the cost is paid once by a developer, not by users. Say which cold path it is and why (e.g. "one-off seed script run by hand"). Exception: a script that runs on a schedule against production-sized data is not cold — judge it as hot.
2. **Comments and names are evidence, not proof.** A comment such as "pages must be fetched in order" is a strong hint; verify it against the code before relying on it.
3. **Test, fixture and generated files.** Findings inside them are rejected unless the problem leaks into production code (e.g. a test helper imported by app code).
4. **Is the fix behaviour-preserving?** If not, the finding can still be confirmed, but set `behaviorChange: true`.

## Already handled by the scanner

You do not need to re-check these; they are filtered before findings reach you: loops whose receiver is the loop variable itself, writes already chunked/batched, `$transaction(items.map(...))`, `const [x] = await db.select()...` single-row selects, subqueries, `$dynamic()` query builders, effects that only call setters with literals, `"use client"` wrappers at a client boundary, paths in the default ignore list, `leancheck-ignore <ruleId>` comments.

## Medium-confidence rules — check before confirming

### core/await-in-loop

`await` inside a `for` / `for…of` / `while` body.

Confirm when iterations are independent: each call uses only the loop item and values computed before the loop, and nothing after the loop depends on the calls having happened in order.

Reject when:
- **Loop-carried dependency** — iteration N uses iteration N−1's result: cursor or offset pagination (`while (page.nextCursor) page = await fetch(page.nextCursor)`), a running balance or accumulator passed into the next call, a token refreshed by the previous call.
- **Early exit on a result** — `break`/`return` based on what an awaited call returned (search until found, first success wins). Parallelising would do all the work anyway.
- **Retry, polling and backoff loops** — `while (!done) { await sleep(); … }`, `for (attempt…)`. Sequencing is the point.
- **Ordering is a side-effect requirement** — writes that must land in order (event logs, sequential IDs, ordered writes inside one transaction; a transaction runs on one connection, so `Promise.all` would not parallelise it anyway), or a stream/socket written in order.
- `for await (… of stream)` consuming an async iterator — that is the iterator protocol, not a missed `Promise.all`.
- Cold path (see universal checks).

Rate limits are **not** a reason to reject. If the calls hit an external API, a mail/SMS provider, or a database with limited connections, confirm and make the fix a concurrency-limited pool (e.g. `p-limit`, or chunks of N with `Promise.all`) instead of an unbounded `Promise.all`; effort usually `M`. If the loop length is unbounded and user-controlled, mention that in `impact`.

`behaviorChange`: `true` when partial-failure semantics change (the sequential loop stopped at the first error; `Promise.all` starts every call and rejects on the first failure — consider `Promise.allSettled` to keep reporting per-item failures) or when callers observe ordering. Otherwise `false`.

### core/sequential-awaits

Two consecutive awaited declarations where the second does not reference the first's variable. The scanner already skips direct references.

Confirm when both calls are independent reads (two queries, two fetches) on a hot path.

Reject when:
- **Hidden dependency** — the second call depends on the first through shared state rather than a variable: the first writes, the second reads what was written; the first sets up a session, context, lock or cache the second relies on.
- **Guard first** — the first await is an auth/permission/existence check whose failure must stop the second from running (`await requireUser()` then load that user's data). Running them concurrently would do unauthorised work.
- **Ordered writes** — both are writes whose order matters, especially inside a transaction.
- Cold path.

`behaviorChange`: `true` if the first call can throw and the second has side effects (concurrent start means the side effect happens even when the first fails); `false` for two pure reads.

### core/lookup-in-loop

`.find/.filter/.includes/.indexOf/.some` on an array inside a loop or `.map/.forEach` callback.

Confirm when both the outer collection and the searched array are data-sized (query results, request payloads, user lists) — the work is O(n·m).

Reject when the searched array is small and bounded by construction (a constant list of a few options, enum values, a fixed set of roles) or the outer loop runs a fixed handful of times.

Fix: build a `Map`/`Set` once before the loop. To preserve `.find` semantics (first match wins) build the map so the first occurrence is kept. Effort `S`. `behaviorChange: false` when duplicates are handled that way.

### core/heavy-import

Whole-library import (`import _ from "lodash"`, `import moment from "moment"`, …).

Confirm when the module is reachable from application code — client bundles (raise severity to `medium` if it lands in a client component's import graph) or server code such as server components, route handlers and serverless/edge functions, where it still costs cold-start time, memory and install size (keep `low`). This holds even when only one or two functions are used; that just makes the fix easier.

Reject when the import is only on a cold path (build scripts, CLI tools, seed scripts, tests), or when the "whole-library" import is actually tree-shakeable for the bundler in use (e.g. named imports from an ES-module build such as `lodash-es`). If the importing code is itself dead (a `core/dead-code` finding), still confirm and make the fix "remove with the dead code".

Fix: per-function imports (`lodash/sum`), a native equivalent, or a smaller library. Effort `S` for one or two calls, `L` when the library is used across many files. `behaviorChange: true` when the replacement differs in edge cases (date formatting tokens and locales when leaving `moment`; lodash helpers that skip `undefined`/`NaN` where a native reduce would not). Check those edge cases against how the result is used.

### drizzle/unbounded-select, prisma/unbounded-select

`findMany` / `select().from()` without a limit (`take` in Prisma). Also confirm when the rows are loaded only to be counted, summed or filtered in JavaScript: the fix is `count`, `aggregate`, `groupBy` or a narrower `where`, which keeps results identical (`behaviorChange: false`).

Confirm when the table grows with usage (orders, events, messages, products, users, logs) and the query is not filtered down to a bounded set.

Reject when:
- **Small by design** — lookup/enum/config tables (countries, roles, plans, settings, feature flags) whose row count does not grow with users.
- **Bounded by the filter** — filtered on a unique key or a relation that is small by construction (a user's settings rows, an order's line items with a business cap).
- The caller genuinely needs every row and already streams or batches it (an export job that pages through results).

Mark `uncertain` when growth depends on production data you cannot see; say what row count would make it a problem.

Adding a limit changes results: `behaviorChange: true`. Trace every consumer of the rows first and name in `fix` what breaks: a lookup map built from the same rows silently loses entries once the list is cut. The fix should name a limit and how the caller pages (cursor or offset). Effort `M` if callers must handle pagination.

### drizzle/select-all-columns

`db.select().from(t)` with no column map.

Find every consumer of the result (follow the function's callers). Confirm when the consumers together read only a subset of the columns — it is a cheap fix, and the gain grows with table width and with large columns (text bodies, JSON, blobs, embeddings); keep severity `low` for narrow tables, raise it for wide ones. Also confirm when the full row is sent to the client (an over-exposure smell as well — mention it).

Reject when the consumers use every column, or the full row is genuinely required (e.g. passed to an update, spread into a full-object cache, or returned as the API's documented shape).

Fix: list the used columns. `behaviorChange: false` when every consumer only reads the selected fields (TypeScript will flag missing ones — say so); `true` if the row is returned from an API. Effort `S`.

### nextjs/fetch-in-effect

`useEffect` containing `fetch(` in an app-router client component.

Confirm when the data could be fetched on the server and passed as props: it depends only on route params or props available at render time, and the component shows a loading state until the effect finishes (a request waterfall plus loading flash on every page view).

Reject or mark `uncertain` when the fetch must happen in the browser: it is triggered by user interaction or client-only state (search-as-you-type, form input), polls or subscribes for live updates on an interval, reads browser-only data (`localStorage`, geolocation, window size), or the component is rendered in a context with no server render. A one-shot fetch on mount keyed only by a prop is **not** live updating — it is the confirmable case, even if the value is "live" data.

Fix: move the fetch into the nearest server component (or route loader) and pass the value as a prop; keep a client island only for interaction. If real client-side fetching is needed, a data library (SWR, TanStack Query). Effort `M`. `behaviorChange: false` if the value is equally fresh; note it when server rendering would cache the value.

## High-confidence rules — quick sanity check

These are almost always real. Confirm after a quick look unless one of the listed exceptions applies.

### drizzle/query-in-loop, prisma/query-in-loop

A query per item (N+1), including inside `Promise.all(items.map(...))` — concurrency does not remove the round trips or the connection-pool pressure. Reject only on a cold path or when the loop is bounded to a tiny constant. Fix: one query with `inArray` / `IN` / `where: { id: { in: ids } }` (or a relational query), then map results back by key; preserve result order and handling of missing IDs (`behaviorChange: false` if you do). Effort `S`–`M`. Severity stays `high` on hot paths.

### drizzle/insert-in-loop, prisma/create-in-loop

One INSERT per item. Fix: `insert(t).values(rows)` / `createMany({ data: rows })`. Check before confirming the fix shape: whether the per-row code needs each inserted row's returned ID (Drizzle `returning()` works on multi-row inserts; Prisma `createMany` returns only a count — use `createManyAndReturn` where available, or the fix is `M`), and whether unique-conflict handling per row is required. `behaviorChange`: `false` for a plain multi-row insert; `true` only if the code relies on per-row conflict handling or partial success. Reject only on a cold path (seed/migration scripts).

### core/json-deep-clone

`JSON.parse(JSON.stringify(x))`. Fix: `structuredClone(x)`. `behaviorChange`: `structuredClone` keeps `Date`, `Map`, `Set` and `undefined` where the JSON round-trip converted or dropped them, and throws on functions — check whether any consumer relied on the JSON behaviour (e.g. dates becoming strings). Usually `false`.

### core/sync-io-in-handler

`fs.*Sync` inside an async function or route handler. Confirm on request paths. Reject in CLI entry points, build-time code, config loading at module startup that runs once, and scripts — blocking there is harmless. Fix: the `fs/promises` equivalent with `await`; effort `S`.

### nextjs/unneeded-use-client

`"use client"` file with no hooks, event handler props or browser globals. Before confirming, check that nothing in the file needs the client indirectly: it uses a library that only works client-side, or it exports something other than components that client code relies on being a client module. If **every** importer is itself a client component, removing the directive gains nothing (the module is client code either way) — reject as no gain. If at least one server component imports it, the directive is forcing it into the client bundle there — confirm. Fix: remove the directive; effort `S`.

### react/derived-state-in-effect

State mirrored from props/state via `useEffect`. Fix: compute during render (with `useMemo` only if expensive). Check the setter is not also called elsewhere (user edits that override the derived value make it real state — then reject or mark uncertain). Effort `S`. `behaviorChange: false`.

### core/duplicate-libraries

Two or more dependencies from one overlap group (dates, HTTP clients, IDs, utility belts…). Confirm when both are used in source; if one is unused, that is a `core/dead-code` finding — still confirm here and make the fix "drop the unused one". Note an in-progress migration (comments, an ADR) in `reason` but still confirm. Fix: standardise on one; effort `M`–`L`; `behaviorChange: true` when outputs differ (formatting tokens, default timezones, error shapes).

### core/dead-code

From knip: unused files, exports, or dependencies. Before confirming, search the whole repo for the name (`grep -r`), because these are used without a static import:
- **Framework conventions** — Next.js route files and their exports (`page`, `layout`, `route`, `loading`, `error`, `not-found`, `middleware`, `generateMetadata`, `generateStaticParams`, `metadata`, `revalidate`, `dynamic`), `instrumentation.*`, config files (`next.config.*`, `drizzle.config.*`, `tailwind.config.*`, `postcss.config.*`, `vitest.config.*`, `eslint.config.*`).
- **Dynamic references** — `import()` with a computed path, `require` by string, files referenced in `package.json` scripts / `bin` / `exports` / `main`, CI workflows, Dockerfiles.
- **Dependencies used outside source** — CLIs run from `scripts`, PostCSS/Tailwind/ESLint/Babel plugins named in config, peer dependencies, `@types/*` packages for libraries that are used.
- **Public API** — exports of a published library package's entry point are used by its consumers.

Reject when any of these applies (name it). Otherwise confirm. Fix: delete the file/export or remove the dependency; effort `S`; `behaviorChange: false`.

### core/duplicate-code

From jscpd: duplicated blocks. Read both locations (the message names the second one).
- Reject when either copy is in generated code, tests, fixtures or vendored files, or the two copies are intentionally independent (different packages that must not depend on each other — note it).
- Mark `uncertain` when the blocks look alike but have already started to diverge in meaning.
- Otherwise confirm. Fix: extract one shared helper and call it from both places; effort `M`; `behaviorChange: false` if both copies are identical.

## Writing good entries

- `reason` names the evidence: the line that carries the dependency, the caller that makes it hot, the script that makes it cold, the table that is small by design.
- `impact` says how it scales: "one round trip per order on every dashboard load", "adds ~70 kB to every client bundle", "runs once during seeding".
- `fix` is specific to this code, ready to apply in fix mode.
