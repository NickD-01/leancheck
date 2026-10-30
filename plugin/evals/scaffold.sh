#!/usr/bin/env bash
# Usage: scaffold.sh <report|fix|dirty> — run with the eval workspace as cwd.
set -euo pipefail
MODE="${1:-report}"
# EVAL_LEANCHECK_ROOT is optional; default is the repo containing this script. pwd -W gives a Windows path that native node understands.
ROOT="${EVAL_LEANCHECK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && { pwd -W 2>/dev/null || pwd; })}"
SRC="$ROOT/fixtures/planted"

tar -C "$SRC" --exclude=PLANTED.md --exclude=node_modules -cf - . | tar -xf -
printf 'node "%s/packages/scanner/dist/cli.js"' "$ROOT" > .leancheck-eval-cmd

if [ "$MODE" = "report" ]; then
  exit 0
fi

git init -q
git config user.email "eval@leancheck.invalid"
git config user.name "leancheck eval"
printf 'node_modules\n.leancheck\n.leancheck-eval-cmd\n' > .gitignore
git add -A
git commit -q -m "chore: fixture baseline"

npm install --ignore-scripts --no-audit --no-fund
npx prisma generate

if [ "$MODE" = "dirty" ]; then
  printf '\n// local work in progress\n' >> src/lib/stats.ts
fi
