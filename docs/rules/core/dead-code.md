# core/dead-code

Unused files, exports and dependencies. Default severity: low (medium for dependencies).

## Why

Reported by [knip](https://knip.dev). Unused files and exports are `low`; unused dependencies are `medium` because they add install and bundle weight. Install the project's dependencies before scanning: knip resolves imports through `node_modules`, and without it some results are wrong.

## Bad

```ts
export function legacyHelper() {}
```
Never imported anywhere.

## Good

Delete it, or keep it on purpose and tell knip (a `knip.json` entry or `ignoreDependencies`).

## When it's fine

Public API of a library, framework entry points that knip cannot see (route files, config loaded by convention), and dependencies used only by tooling. These are the most common false positives; triage reads the code before keeping them.

## Config

```json
{ "rules": { "core/dead-code": "off" } }
```
Use the `rules` config option to change its severity (`"low"`, `"medium"` or `"high"`) or turn it off, as above.
