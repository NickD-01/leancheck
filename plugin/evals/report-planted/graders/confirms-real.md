---
type: regex
pattern: '"verdict":\s*"confirmed"'
match: contains
target: {source: file, path: .leancheck/triage.json}
---
triage.json holds at least one confirmed entry. (source/path target shape is inferred, see README.)
