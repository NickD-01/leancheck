---
type: llm
criteria: >-
  In the trace and final summary, every finding the agent marked fixed has exactly one commit whose subject starts with "perf:" and ends with "(leancheck L-00N)" for that ID, and no commit covers two IDs. Every finding that failed (for example because tests mock the old API) was restored: no partial edit left behind, optionally with a .leancheck/failed/L-00N.patch. Fixed OR failed-and-restored are both acceptable for each finding; do not require a particular number of fixes. The final full test suite and typecheck were run and are green, test files were never edited or skipped, the flagged traps (src/lib/export.ts, scripts/seed.ts) were not touched, and the summary is the table with an "Nothing was pushed." line.
focus: trace
---
Judge outcomes per finding.
