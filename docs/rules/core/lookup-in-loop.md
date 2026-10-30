# core/lookup-in-loop

Linear array lookup inside a loop. Default severity: medium.

## Why

`includes`, `indexOf`, `find`, `filter` or `some` on an array inside a loop or `map`/`forEach` callback is O(n) per iteration, so the whole thing is quadratic. A filter skips receivers that are bound by the loop itself (for example the row array of an outer `map`).

## Bad

```ts
const enriched = orders.map((o) => ({
  ...o,
  user: users.find((u) => u.id === o.userId),
}));
```

## Good

```ts
const byId = new Map(users.map((u) => [u.id, u]));
const enriched = orders.map((o) => ({ ...o, user: byId.get(o.userId) }));
```

## When it's fine

Small, bounded arrays (a handful of entries) where building a Map costs more than it saves.

## Config

```json
{ "rules": { "core/lookup-in-loop": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore core/lookup-in-loop`.
