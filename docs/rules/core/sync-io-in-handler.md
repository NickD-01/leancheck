# core/sync-io-in-handler

Synchronous filesystem call in an async function. Default severity: high.

## Why

`readFileSync`, `writeFileSync`, `existsSync`, `readdirSync`, `statSync` and friends block the event loop. In a request handler that stalls every concurrent request.

## Bad

```ts
export async function GET() {
  const text = fs.readFileSync("data.txt", "utf8");
  return new Response(text);
}
```

## Good

```ts
import { readFile } from "node:fs/promises";

export async function GET() {
  const text = await readFile("data.txt", "utf8");
  return new Response(text);
}
```

## When it's fine

Module top level (runs once at startup), CLI scripts and build tooling. The rule only fires inside async functions and ignores calls in nested non-async callbacks.

## Config

```json
{ "rules": { "core/sync-io-in-handler": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore core/sync-io-in-handler`.
