# core/heavy-import

Whole-library import of a large dependency. Default severity: low.

## Why

Default or namespace imports of `lodash`, `moment`, `ramda` and `underscore` pull the entire library into the bundle, because these are hard to tree-shake.

## Bad

```ts
import _ from "lodash";
import moment from "moment";
```

## Good

```ts
import debounce from "lodash/debounce";
import { format } from "date-fns";
```

## When it's fine

Server-only code where bundle size does not matter, or when the library is already required elsewhere for another reason.

## Config

```json
{ "rules": { "core/heavy-import": "off" } }
```
Or change its severity with `"low"`, `"medium"` or `"high"`. Suppress one occurrence with a comment on the same or previous line: `// leancheck-ignore core/heavy-import`.
