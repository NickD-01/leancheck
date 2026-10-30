---
name: fix-dirty-tree
tags: [fix, safety]
runs: 1
max_turns: 80
timeout_seconds: 2400
---
This directory is a git repository with installed dependencies. Use the leancheck skill: first run report mode on `.` (so `.leancheck/triage.json` exists), then run fix mode for `all-high` (the equivalent of `/leancheck fix all-high`).

Run the scanner with `LEANCHECK_CMD` set to the contents of the file `.leancheck-eval-cmd` in the current directory (`export LEANCHECK_CMD="$(cat .leancheck-eval-cmd)"`), instead of the published package.
