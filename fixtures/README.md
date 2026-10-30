# Fixture repos

`planted/` and `clean/` are small Next.js app-router + Drizzle + React projects. The scanner
treats them as data: they are not npm workspaces of this repo, and the root vitest and
TypeScript configs do not compile them. `packages/scanner/test/integration.test.ts` scans both:

- `planted/` must trigger every leancheck rule ID. `planted/PLANTED.md` lists each planted issue
  and each trap.
- `clean/` must produce zero findings, with no ignore comments and no `leancheck.config.json`.

## Scanned without installed dependencies

The integration test does not run `npm install` in the fixtures, so it stays fast and works
offline. knip therefore runs with no `node_modules`, which costs it two kinds of insight.
Both fixtures are written so this changes nothing:

- **Peer dependencies are invisible.** Without `next`'s own package.json, knip cannot see that
  `next` needs `react-dom` as a peer, so it reports `react-dom` and `@types/react-dom` as
  unused. Each fixture imports `react-dom` directly (a `SubmitButton` that uses
  `useFormStatus`), so the dependency is genuinely used.
- **Package binaries cannot be resolved.** A bare-binary script such as `"seed": "tsx
  scripts/seed.ts"` makes knip report the `tsx` devDependency as unused, because it cannot map
  the binary to a package. `planted/` runs the seed script as `node --import tsx
  scripts/seed.ts`, which knip reads as a reference to the `tsx` package. Fixture scripts may call
  bare binaries only from packages that have a knip plugin (`next`, `vitest`).

With dependencies installed, knip reports the same dead-code items for `planted/`. To run the
planted fixture's own tests, install it (`npm install` inside `fixtures/planted`, whose
`node_modules` is gitignored) and run `npx vitest run` there.
