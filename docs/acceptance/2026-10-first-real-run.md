# First run on a real application

Scanner run on a private production codebase (Next.js App Router, React, Drizzle, 36 source files), October 2026. Counts only; no code from that project is published here.

| Measure | Result |
|---|---|
| Scan time | about 2 seconds |
| Runner errors | 0, once dependencies were installed |
| Findings | 22 (2 high, 8 medium, 12 low) |
| Confirmed in triage | 10 |
| Rejected in triage | 11 (seven type exports, two one-off script findings, two small bounded lists) |
| Uncertain | 1 |

Raw scanner precision was about 45%, mostly because of unused type exports that are part of an exported shape. Version 0.1.3 no longer reports those, which removes six of the seven.

The confirmed findings were mostly low severity, as expected for a small, carefully written codebase: one unused dependency, two unbounded list queries, one write loop in a webhook handler, one duplicated schema block, and unnecessary exports. One medium-severity finding was fixable in a single line.

Triage followed the skill's report mode inside Claude Code with the published 0.1.2 package. The headless `claude -p` path and fix mode on a real application have not been tested; fix mode has only run in simulations on `fixtures/planted`.

## Second run: a public vibe-coded app

Next.js and Prisma, 283 TypeScript files, 28,000 lines. Configuration files were removed and dependencies were not installed for safety, so the dead-code results are not reliable and are left out here.

Against a separate Claude code review of the same repository (12 findings):

| | leancheck | Claude review |
|---|---|---|
| Cost | 22 seconds, no tokens | about 100 seconds, about 140,000 tokens |
| Found by both | 2 problem areas | 2 problem areas |
| Found only by this side | 5 N+1 loops in push notifications, 1 write loop | 10 areas, mostly unbounded reads and full-history recomputation |

Of 11 high-severity findings, 9 looked real on inspection, after one deliberate fallback was rejected and one unclear case set aside. Prisma has no unbounded-query rule yet, which is the largest gap. leancheck complements a review; it does not replace one.

## Third run: after adding `prisma/unbounded-select`

The same app, compared with the same review. Of the 15 locations the review named, leancheck now reaches 14, within ten lines; 13 come from the new rule. The one miss is repeated counting in a sync function that runs on every action.

That recall has a price. The rule reports 76 places, and in a sample of 14 about 6 mattered; the rest were small tables. leancheck finds where to look, but triage still has to decide what matters. The review's ranking was better, and it explained causes such as filtering in JavaScript after loading everything.

## Fourth run: blind test on two unseen apps

Two public vibe-coded apps were chosen before scanning, and leancheck 0.1.4 was frozen. A separate review and a separate triage each worked without seeing the other's result. Dead-code findings are left out because configuration files were removed and dependencies were not installed.

| | App with Drizzle | App with Prisma |
|---|---|---|
| Size | 3,700 lines | 18,200 lines |
| Findings triaged | 25 | 40 |
| Confirmed, uncertain, rejected | 16, 0, 9 | 27, 1, 12 |
| Review findings also reached by leancheck | 1 of 8, partly | 4 of 10 |

On unseen code leancheck reached 5 of 18 review findings, about 28%. The misses were mostly outside its rules: missing rate limits and auth, request storms in the editor, oversized payloads, and bundle size. Only 3 of 43 confirmed findings were above low severity, and all 3 matched review findings. leancheck found duplicated code and unneeded column selection that the reviews did not report, and triage correctly rejected a custom async `writeFileSync` wrapper.

## Triage on 76 `findMany` findings

| Verdict | Count |
|---|---|
| Confirmed | 21 |
| Uncertain | 10 |
| Rejected | 45 |

Of 18 places named by the earlier review, 15 were confirmed, 3 were uncertain and none were rejected. Four of its top five matched the review's main problems. The triage did not see that review.

## Fix mode on a real application

Run on a copy of the application from the first run, with six findings selected.

| Outcome | Count |
|---|---|
| Fixed and committed | 5 |
| Skipped (dependency change) | 1 |
| Failed | 0 |

Typecheck and all 39 tests stayed green, but tests covered only one of the five fixes. Reading the diffs showed the gates were not enough: a `limit: 50` broke a customer-name lookup built from the same rows, which no test covered. Version 0.1.5 therefore skips behaviour changes on untested code.

## Fifth run: adding a targeted review

The skill gained a checklist-driven review (`references/review.md`). On a first unseen app it reached 3 of 12 review findings. The checklist then gained generic items for indexes, race conditions, SSRF and repeated per-request queries, plus a minimum of 20 files.

It was then tested on a second unseen app, next to two independent plain reviews, to learn what a realistic score is. These overlaps are hand-judged on one app.

| Compared with | Plain review A | Plain review B | leancheck |
|---|---|---|---|
| Findings of review A also reached | n/a | 10 of 11 | 9 of 11 |
| Findings of review B also reached | 9 of 12 | n/a | 7 of 12 |
| Tokens | 159,000 | 159,000 | 177,000 |

A second plain review reaches about 83% of the first; leancheck reaches about 70%. leancheck also reported 4 issues neither review named. Its top 10 is mostly medium severity. It costs about 11% more tokens than a plain review, so it doesn't yet save tokens.
