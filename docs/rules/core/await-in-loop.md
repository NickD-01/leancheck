# core/await-in-loop

await inside a loop. Default severity: medium.

## Why

Each iteration waits for the previous one, so N independent calls take N times the latency of one. The scanner flags `await` in the body of `for`, `for...in` and `while` loops (not `for await`, and not inside a nested function).

## Bad

```ts
for (const id of ids) {
  results.push(await load(id));
}
```

## Good

```ts
const results = await Promise.all(ids.map((id) => load(id)));
```
For large lists use a concurrency-limited pool instead of an unbounded `Promise.all`.

## When it's fine

When each iteration needs the previous result: cursor pagination, retries with backoff, or work that must be serialised (rate limits, ordered writes).

## Config

```json
{ "rules": { "core/await-in-loop": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore core/await-in-loop`.
