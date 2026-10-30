# core/sequential-awaits

Independent awaits run back to back. Default severity: medium.

## Why

`const a = await f(); const b = await g();` waits for `f` before even starting `g`. If `g` does not use `a`, the total time is the sum instead of the maximum.

## Bad

```ts
const user = await getUser();
const posts = await getPosts();
```

## Good

```ts
const [user, posts] = await Promise.all([getUser(), getPosts()]);
```

## When it's fine

When the second call depends on the first (uses its result), when something between them must run first, or when the calls must be ordered for side-effect reasons. The rule skips the first two cases.

## Config

```json
{ "rules": { "core/sequential-awaits": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore core/sequential-awaits`.
