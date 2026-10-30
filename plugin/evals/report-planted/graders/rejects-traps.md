---
type: regex
pattern: '"verdict":\s*"rejected"'
match: contains
target: {source: file, path: .leancheck/triage.json}
---
At least one rejected entry exists; per-file verdicts are judged by verdicts-by-file. Inferred target shape.
