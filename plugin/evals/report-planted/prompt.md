---
name: report-planted
tags: [report]
runs: 1
max_turns: 60
timeout_seconds: 1200
---
Use the leancheck skill in report mode on the current directory (the equivalent of `/leancheck`).

Run the scanner with `LEANCHECK_CMD` set to the contents of the file `.leancheck-eval-cmd` in the current directory (`export LEANCHECK_CMD="$(cat .leancheck-eval-cmd)"`), instead of the published package. Triage every finding by reading the code and write `.leancheck/triage.json` and `.leancheck/report.md`. Do not edit any source file.
