# Planted issues

Every leancheck rule ID is planted here at least once. `real` rows are genuine problems a triage
must keep; `trap` rows look suspicious but are correct code that triage must dismiss (the scanner
may or may not flag them). Lines are 1-based. `packages/scanner/test/integration.test.ts`
snapshots the scanner output for this repo.

| Rule ID | Location | Kind | Notes |
| --- | --- | --- | --- |
| core/await-in-loop | src/lib/notify.ts:5 | real | independent emails sent one at a time |
| core/await-in-loop | src/lib/export.ts:9 | trap | cursor pagination: each request needs the previous cursor (flagged) |
| core/await-in-loop | scripts/seed.ts:18 | trap | one-off seed script, cold path (not flagged: `scripts/` is ignored by default) |
| core/heavy-import | src/lib/stats.ts:1 | real | whole `lodash` imported for `sum`/`max` |
| core/heavy-import | src/lib/dates.ts:2 | real | whole `moment` imported |
| core/json-deep-clone | src/lib/cart.ts:5 | real | JSON round-trip instead of `structuredClone` |
| core/lookup-in-loop | src/lib/orders.ts:7 | real | `customers.find` inside `orders.map` |
| core/sequential-awaits | src/app/page.tsx:7 | real | products and orders fetched back to back |
| core/sequential-awaits | src/app/account/[id]/page.tsx:8 | trap | `listOrdersForUser(user.id)` depends on the previous await (not flagged) |
| core/sync-io-in-handler | src/app/api/report/route.ts:5 | real | `readFileSync` in an async route handler |
| core/duplicate-libraries | package.json:15 | real | `dayjs` and `moment` both declared |
| core/dead-code | package.json:14 | real | unused dependency `classnames` |
| core/dead-code | src/lib/dates.ts:8 | real | unused export `formatLegacyDate` |
| core/dead-code | src/lib/legacy-report.ts:1 | real | unused file |
| core/duplicate-code | src/lib/invoice-pdf.ts:1 | real | `renderLines` copied into src/lib/quote-pdf.ts:1 |
| drizzle/insert-in-loop | src/lib/import-products.ts:7 | real | one INSERT per product inside `rows.map` |
| drizzle/query-in-loop | src/lib/customers.ts:6 | real | `findFirst` per id inside `ids.map` |
| drizzle/select-all-columns | src/lib/customers.ts:10 | real | `select()` with no column list |
| drizzle/unbounded-select | src/lib/customers.ts:14 | real | product list query has no limit |
| nextjs/fetch-in-effect | src/components/live-stock.tsx:8 | real | stock fetched in `useEffect` after hydration |
| nextjs/unneeded-use-client | src/components/price-tag.tsx:1 | real | pure render component marked `"use client"` |
| nextjs/unneeded-use-client | src/components/quantity-picker.tsx:1 | trap | `"use client"` needed for `useState` and `onClick` (not flagged) |
| prisma/create-in-loop | src/lib/audit.ts:6 | real | one `create` per audit event inside `events.map` |
| prisma/query-in-loop | src/lib/audit.ts:10 | real | `findUnique` per id inside `ids.map` |
| prisma/unbounded-select | src/lib/audit.ts:14 | real | loads every row only to count them |
| react/derived-state-in-effect | src/components/order-total.tsx:11 | real | total mirrored into state from `lines` |
