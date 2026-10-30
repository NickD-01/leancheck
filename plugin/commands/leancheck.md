---
description: Scan a JS/TS codebase for efficiency problems, triage and rank them, or fix named findings behind a test gate
argument-hint: "[path] | fix <ids…|all-high>"
---

Use the `leancheck` skill to handle this request. Arguments: `$ARGUMENTS`

Route on the first argument:

- **No arguments, or a path** (e.g. `/leancheck`, `/leancheck apps/web`) → run the skill's **report mode** on that path (default `.`). Report mode never edits source code; it only writes files under `.leancheck/`.
- **`fix` followed by finding IDs or `all-high`** (e.g. `/leancheck fix L-003 L-007`, `/leancheck fix all-high`) → run the skill's **fix mode** by following its `references/fix-loop.md` for exactly those findings. Never fix anything that was not named.
- **`fix` with nothing after it** → ask which finding IDs to fix (or `all-high`); do not guess.
