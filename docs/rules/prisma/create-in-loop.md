# prisma/create-in-loop

Prisma create inside a loop. Default severity: high.

## Why

One `INSERT` per item. This rule takes precedence over `prisma/query-in-loop` for the same line.

## Bad

```ts
for (const row of rows) {
  await prisma.user.create({ data: row });
}
```

## Good

```ts
await prisma.user.createMany({ data: rows });
```

## When it's fine

When you need each created record back (`createMany` returns only a count), or relations must be created per row. Calls inside `$transaction([...])` are skipped.

## Config

```json
{ "rules": { "prisma/create-in-loop": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore prisma/create-in-loop`.
