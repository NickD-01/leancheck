# drizzle/insert-in-loop

Drizzle row-by-row insert in a loop. Default severity: high.

## Why

One `INSERT` per item. This rule takes precedence over `drizzle/query-in-loop` for the same line.

## Bad

```ts
for (const row of rows) {
  await db.insert(items).values(row);
}
```

## Good

```ts
await db.insert(items).values(rows);
```
For very large arrays insert in chunks.

## When it's fine

The rule skips inserts whose value is already an array, a `chunk`/`batch` variable or a `slice`. Keep a per-row insert when each row needs its own generated result before the next step.

## Config

```json
{ "rules": { "drizzle/insert-in-loop": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore drizzle/insert-in-loop`.
