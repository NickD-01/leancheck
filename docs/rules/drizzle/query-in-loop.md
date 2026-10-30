# drizzle/query-in-loop

Drizzle query inside a loop (N+1). Default severity: high.

## Why

A `select`, `update`, `delete` or `db.query.*` call inside a loop or iteration callback is one database round trip per item.

## Bad

```ts
for (const id of ids) {
  await db.select().from(users).where(eq(users.id, id));
}
```

## Good

```ts
const rows = await db.select().from(users).where(inArray(users.id, ids));
```

## When it's fine

Batched work where each iteration handles a chunk, or tiny loops over a fixed handful of items. Updates with per-row values often have no single-statement form; triage decides.

## Config

```json
{ "rules": { "drizzle/query-in-loop": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore drizzle/query-in-loop`.
