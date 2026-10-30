# core/duplicate-libraries

Multiple libraries that do the same job. Default severity: medium.

## Why

Two libraries from the same group in one `package.json` (dates: moment, dayjs, date-fns, luxon; http: axios, got, ky, node-fetch, superagent; ids: uuid, nanoid, cuid; utility: lodash, lodash-es, underscore, ramda; validation: zod, yup, joi, valibot, superstruct; classnames: classnames, clsx) means duplicated bundle weight and inconsistent usage. This finding comes from a built-in check on `package.json`, not from a YAML rule.

## Bad

```json
"dependencies": { "moment": "2.30.1", "dayjs": "1.11.13" }
```

## Good

Pick one, migrate usages, and remove the others from `package.json`.

## When it's fine

During a staged migration, or when a transitive need forces a second library.

## Config

```json
{ "rules": { "core/duplicate-libraries": "off" } }
```
Use the `rules` config option to change its severity (`"low"`, `"medium"` or `"high"`) or turn it off, as above.
