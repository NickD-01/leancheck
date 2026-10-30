# nextjs/fetch-in-effect

Data fetched inside useEffect. Default severity: medium.

## Why

`fetch`/`axios` in a `useEffect` starts only after hydration, so the page renders empty, then requests, then re-renders: a waterfall and a loading flash.

## Bad

```tsx
useEffect(() => {
  fetch("/api/items").then((r) => r.json()).then(setItems);
}, []);
```

## Good

Fetch in a server component or route loader and pass the data down as props; on the client use SWR or TanStack Query.

## When it's fine

Genuinely client-only data: user-triggered refreshes, polling, data behind browser-only state. Event-handler fetches are not flagged.

## Config

```json
{ "rules": { "nextjs/fetch-in-effect": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore nextjs/fetch-in-effect`.
