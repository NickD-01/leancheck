# react/derived-state-in-effect

Derived state synced in useEffect. Default severity: medium.

## Why

`useEffect(() => setX(f(props)), [props])` renders once with stale state, then again with the new value. The value can be computed during render.

## Bad

```tsx
const [double, setDouble] = useState(0);
useEffect(() => { setDouble(props.a * 2); }, [props.a]);
```

## Good

```tsx
const double = props.a * 2;
```
Wrap in `useMemo` only if the computation is expensive.

## When it's fine

Effects that also do something else (subscriptions, fetches, timers, cleanup). The rule only fires when the effect body consists of state setters.

## Config

```json
{ "rules": { "react/derived-state-in-effect": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore react/derived-state-in-effect`.
