# drizzle/select-all-columns

Drizzle select() without a column list. Default severity: low.

## Why

`db.select().from(t)` reads every column, including large text and JSON columns you may not use.

## Bad

```ts
const rows = await db.select().from(users);
```

## Good

```ts
const rows = await db.select({ id: users.id, name: users.name }).from(users);
```

## When it's fine

When you really need the whole row (returning an entity as-is), or the table is narrow.

## Config

```json
{ "rules": { "drizzle/select-all-columns": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore drizzle/select-all-columns`.
