# prisma/unbounded-select

Prisma `findMany` without `take`. Default severity: medium.

## Why

A `findMany` with no `take` loads every matching row, however many there are. AI-generated code often loads a user's whole history and then filters or sums it in JavaScript. That cost grows with every row, on every request. Adding `take` changes results, so a fix needs your confirmation.

## Bad

```ts
const events = await prisma.bookReadEvent.findMany({ where: { userId } });
const total = events.filter((e) => e.readAt >= start).length;
```

## Good

```ts
const total = await prisma.bookReadEvent.count({ where: { userId, readAt: { gte: start } } });
```

## When it's fine

Small lookup tables, queries bounded by their filter (a list of IDs, one order's line items), and jobs that need every row and page through them. Options passed as a variable or spread are not inspected.

## Config

```json
{ "rules": { "prisma/unbounded-select": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore prisma/unbounded-select`.
