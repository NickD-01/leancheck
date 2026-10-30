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
