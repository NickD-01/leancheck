# leancheck plugin evals

Three cases for `claude plugin eval`:

| Case | Checks |
| --- | --- |
| `report-planted` | Report mode on `fixtures/planted` (scaffolded without `PLANTED.md`): real findings confirmed, the two flagged traps (`src/lib/export.ts`, `scripts/seed.ts`) rejected, no source edits. |
| `fix-all-high` | Report then `fix all-high` on a git-initialised copy: tests run, `perf:` commits, no push, no test edits. Each fix must end fixed OR failed-and-restored (mock-bound tests make several fail, leaving `.leancheck/failed/L-00N.patch`); the suite must stay green. No fix count is asserted. |
| `fix-dirty-tree` | Same, but the scaffold leaves an uncommitted edit in `src/lib/stats.ts`: no commits, no edits, the agent asks the user to commit or stash. |

## Run

```bash
claude plugin eval ./plugin --scaffold --trust-plugin --allow-tools Bash Write Edit --model claude-sonnet-5-5 --runs 1
```

Needs `npm run build` first (`packages/scanner/dist/cli.js`), plus network for `npm install` in the fix cases.

**Status: this suite has not been run yet.** `claude` was not available when it was written, so every format detail below is taken from Claude Code's embedded reference and is unverified.

## Assumptions to check on the first run

- `case.yaml` `context.scaffold_script` is resolved relative to the case directory and runs with the eval workspace as the working directory. Invocation semantics are undocumented. Each case has a thin `scaffold.sh` wrapper that calls the shared `scaffold.sh` with a mode (`report`, `fix`, `dirty`).
- The scaffold finds the repo from the optional `EVAL_LEANCHECK_ROOT`, falling back to its own location (`plugin/evals/../..`), and writes the scanner command to `.leancheck-eval-cmd` in the workspace (git-ignored in the fix cases). The prompts tell the agent to run the scanner with `LEANCHECK_CMD` set to that file's contents, so no local path is stored in the repo.
- Graders use the `{source: file, path: .leancheck/triage.json}` target shape, which is **inferred**, not documented. If it is wrong, the `regex` graders in `report-planted` fail for format reasons.
- There is no exit-status grader: `tool_used` only proves a call was issued. "Suite green" and "one `perf:` commit per fixed ID" are judged by `llm` graders reading the trace; `no-test-edits` and `no-test-writes` cover `Edit` and `Write` respectively.
- `triage.json` entries carry IDs, not file paths, so per-file verdicts (traps rejected, reals confirmed) are checked by an `llm` grader joining with `findings.json`; the regex graders only prove confirmed and rejected entries exist.
