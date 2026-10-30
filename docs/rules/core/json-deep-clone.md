# core/json-deep-clone

Deep clone via JSON round-trip. Default severity: medium.

## Why

`JSON.parse(JSON.stringify(x))` is slow, and it silently drops `undefined`, functions and `Symbol`s, turns `Date` into strings, and throws on `Map`, `Set` and cycles.

## Bad

```ts
const copy = JSON.parse(JSON.stringify(state));
```

## Good

```ts
const copy = structuredClone(state);
```

## When it's fine

When you deliberately want JSON semantics (stripping non-serialisable fields, or normalising data before sending it). Add a `leancheck-ignore core/json-deep-clone` comment to record that intent.

## Config

```json
{ "rules": { "core/json-deep-clone": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore core/json-deep-clone`.
