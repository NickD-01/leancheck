# prisma/query-in-loop

Prisma query inside a loop (N+1). Default severity: high.

## Why

A `findUnique`, `findMany`, `update`, `delete`, `count`, `upsert` and similar call on a Prisma client inside a loop or iteration callback runs once per item.

## Bad

```ts
for (const id of ids) {
  await prisma.user.findUnique({ where: { id } });
}
```

## Good

```ts
const users = await prisma.user.findMany({ where: { id: { in: ids } } });
```

## When it's fine

Calls wrapped in `prisma.$transaction([...])`, batched chunks, or objects that merely look like Prisma (the rule checks the client name and receiver shape).

## Config

```json
{ "rules": { "prisma/query-in-loop": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore prisma/query-in-loop`.
