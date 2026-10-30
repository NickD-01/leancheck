---
name: fix-all-high
tags: [fix]
runs: 1
max_turns: 150
timeout_seconds: 3600
---
This directory is a git repository with a clean tree and installed dependencies. Use the leancheck skill: first run report mode on `.` (so `.leancheck/triage.json` exists), then run fix mode for `all-high` (the equivalent of `/leancheck fix all-high`).

Run the scanner with `LEANCHECK_CMD` set to the contents of the file `.leancheck-eval-cmd` in the current directory (`export LEANCHECK_CMD="$(cat .leancheck-eval-cmd)"`), instead of the published package. If a fix needs your consent (behaviour change, uncertain, typecheck-only), decline it and carry on with the rest. Finish with the skill's summary table.
