---
type: llm
criteria: Joining .leancheck/triage.json entries to .leancheck/findings.json by id, every finding in a non-trap location is confirmed (or at worst uncertain only for core/duplicate-code) and the flagged traps src/lib/export.ts (await-in-loop, cursor pagination) and scripts/seed.ts (await-in-loop, seed script) are rejected with a reason naming that evidence. The traps src/app/account/[id]/page.tsx and src/components/quantity-picker.tsx must not appear as confirmed findings.
focus: files
---
Judge the verdicts per file, not by counts.
