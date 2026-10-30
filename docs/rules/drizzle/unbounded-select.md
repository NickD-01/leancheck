# drizzle/unbounded-select

Drizzle query without a limit. Default severity: medium.

## Why

A `select()...from()` chain or `findMany` with no `.limit()` loads every matching row. It is fine until the table grows. Adding a limit changes results, so a fix needs your confirmation.

## Bad

```ts
const rows = await db.select().from(users).where(eq(users.active, true));
```

## Good

```ts
const rows = await db.select().from(users).where(eq(users.active, true)).limit(50);
```

## When it's fine

Small lookup tables, aggregates, queries filtered down to one row, subqueries, and `$dynamic()` queries that get a limit later. The rule skips most of these; options passed as a variable are not inspected.

## Config

```json
{ "rules": { "drizzle/unbounded-select": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore drizzle/unbounded-select`.
