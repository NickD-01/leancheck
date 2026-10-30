# core/duplicate-code

Duplicated code blocks. Default severity: medium (25+ lines) or low.

## Why

Reported by [jscpd](https://github.com/kucherenko/jscpd). A duplicated block of at least `jscpd.minLines` lines (default 10) appears in two places; blocks of 25 lines or more are `medium`. Duplicates drift apart and double the maintenance.

## Bad

Two handlers that share the same 30-line validation-and-save sequence.

## Good

Extract the shared part into a function used by both.

## When it's fine

Boilerplate, test setup, or code that is expected to diverge. Raise the threshold with `"jscpd": { "minLines": 20 }` or exclude paths with `ignorePaths`.

## Config

```json
{ "rules": { "core/duplicate-code": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore core/duplicate-code`.
