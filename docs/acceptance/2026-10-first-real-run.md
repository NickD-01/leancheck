# First run on a real application

Scanner run on a private production codebase (Next.js App Router, React, Drizzle, 36 source files), October 2026. Counts only; no code from that project is published here.

| Measure | Result |
|---|---|
| Scan time | about 2 seconds |
| Runner errors | 0, once dependencies were installed |
| Findings | 22 (2 high, 8 medium, 12 low) |
| Confirmed in manual triage | 17 |
| Rejected in manual triage | 4 (one-off script, data bounded by its parent, very small lists) |
| Uncertain | 1 |

Raw scanner precision was about 77%. The confirmed findings were mostly low severity, as expected for a small, carefully written codebase: one unused dependency, two unbounded list queries, one write loop in a webhook handler, one duplicated schema block, and unnecessary exports.

Triage was done by hand following `references/triage.md`, not by the plugin running inside Claude Code. Fix mode has only run in simulations on `fixtures/planted`.
