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
