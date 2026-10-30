# nextjs/unneeded-use-client

"use client" that nothing needs. Default severity: medium.

## Why

A `"use client"` directive makes the whole module and its imports client JavaScript. If the file uses no hooks, event handlers, browser APIs or class components, it can stay a server component.

## Bad

```tsx
"use client";
export function Card({ title }: { title: string }) {
  return <div>{title}</div>;
}
```

## Good

Remove the directive. Keep it only on leaf components that need interactivity.

## When it's fine

Files that import client-only modules or are required to be client components by a third-party library. The rule is conservative: any hook, `on*` handler, `window`/`document` use or `createContext` keeps the file.

## Config

```json
{ "rules": { "nextjs/unneeded-use-client": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore nextjs/unneeded-use-client`.
