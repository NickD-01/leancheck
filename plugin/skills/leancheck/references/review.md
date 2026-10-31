# Targeted review

The scanner sees patterns. This pass finds what needs an understanding of the code: how a request flows, what a user action triggers, what gets sent and to whom. Spend the reading budget where the cost is, and report only what you verified in the code.

## Budget

Read up to 25 files, and at least 20 in any app that has that many source files. Finish all four groups below before stopping. Findings already reported by the scanner don't need rereading.

## Pick the files

Work through these in order and skip what doesn't exist:

1. **Entry points** — the database schema, auth and session helpers, rate-limit helpers, route handlers, server actions, webhooks, cron and queue functions, and middleware. Check first whether middleware protects them.
2. **Costly calls** — files that call an LLM, a paid API, a mail or SMS provider, or do uploads, file parsing or image work.
3. **Heavy screens** — the main list, dashboard and editor pages and the data functions behind them. Prefer the largest files, and files the scanner flagged several times.
4. **Busy client code** — components with editors, typing or cursor handlers, polling, and large `"use client"` trees.

## Checklist

### Entry points
- No session or ownership check on data a user shouldn't reach. Check the object is the caller's, not only that a caller exists.
- No rate limit on login, signup, password reset, uploads, or anything that spends money per call.
- No size cap before buffering a body or upload, or parsing happens before the cap.
- An outbound `fetch` or SDK call with no timeout, holding the request until the platform kills it.
- Slow work done inline when the response could return first: email, webhooks, recalculation.
- CPU-heavy work on the request path, such as password hashing in pure JavaScript or parsing large files.
- Responses that return more than the client uses, or fields it shouldn't see.
- A limit or counter that reads, then writes, so parallel requests all pass. Login-attempt caps and rate limits matter most.
- Server-side requests to user-supplied URLs, checked by hostname string only, so private IPs stay reachable (SSRF).
- Limits keyed on a client-supplied header such as `x-forwarded-for` when nothing guarantees the proxy overwrites it.

### Data flow
- Frequent queries whose filter doesn't match an index in the schema, including deletes and writes.
- Several sequential queries on every authenticated request, or a write on every request such as `last_used_at`.
- Many queries sharing a connection pool of one, so `Promise.all` gains nothing.
- Rows loaded and then filtered, sorted, counted or paged in JavaScript.
- A value recomputed from full history on every write, instead of updated incrementally.
- Sequential I/O per item through recursion or nested helpers, which the scanner can't follow.
- Serial calls to a rate-limited API with no cap on item count.
- Whole-document writes for a small change, such as saving a full tree to edit one file.
- Pointless round trips, such as writing a temporary file only to read it back.
- A check-then-write sequence that races, where a unique constraint or upsert would do.
- Work repeated per request that could be cached, especially data that never changes.

### Client behaviour
- Requests fired by keystrokes, cursor moves or scrolling without debounce and cancellation.
- Stale closures in long-lived handlers, or timers that are never cleared.
- More sent to the server than it uses, such as a whole file when it reads a few lines.
- Two requests in sequence for what one server render could provide.
- Results held only in the browser, so a refresh repeats a paid call.

### Client bundle
- Large libraries (editors, charts, spreadsheet, PDF) imported statically instead of with `next/dynamic` or `import()`.
- Two libraries or two copies shipped for one job.
- Whole pages or tables marked `"use client"` to hold a little state, when a small client island would do.
- Full query rows passed as props to client components.
- Render-blocking fonts or CSS loaded by hand instead of through the framework.

## What counts

Report a finding when it costs users, money or data in production. Leave out style, naming, and small refactors with no effect at runtime. Don't repeat a scanner finding; if you find its root cause, add that to its triage entry. Say so when a cost depends on data you can't see.

Severity: `high` when it risks money, data exposure or downtime, or runs on every request of a main flow. `medium` when it degrades a main flow as data grows. `low` otherwise.

## Entry format

Write `.leancheck/review.json` as `{ "filesRead": number, "entries": ReviewEntry[] }`, ordered by severity:

```ts
type ReviewEntry = {
  id: string;                 // "R-001", "R-002", ...
  category: "perf" | "reliability" | "security" | "bundle";
  severity: "high" | "medium" | "low";
  file: string;               // relative to <target>
  line: number;
  problem: string;            // one sentence, naming the evidence
  impact: string;             // who pays, and how it scales
  fix: string;                // a concrete change for this code
  effort: "S" | "M" | "L";
};
```
