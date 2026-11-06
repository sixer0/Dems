---
task: 2026-10-07_dems_real_capture_sealing
row: 85 (M7-W4) — verify v2, operation 41
agent: coder-execution
date: 2026-10-09
status: needs-review
note: implementation/40_m7_verify_v2.md
---

# Row 85 — status

**needs-review.** Built and green: the 14 checks V-01 to V-14 (shared, pure), the Core unit, the
dispatch of operation 41, the tests (each check: pass + tamper; 17 of 17 mutations red; restored
byte-exactly). **Not done:** operation 41 does not verify a real package in production — nothing
can record a verdict the Core computed (blocking request in `file_requests.md`), the fragment
opener is behind row 84's pinned user list, and no sealed package exists (rows 59, 82).
`M7-VV-SRV` and `M7-TP-1` are proven only on packages of this row's test builder.

## Files

New:
- `packages/shared/src/evidence-verify/{index,types,revisions,verify}.ts`
- `packages/shared/test/evidence-verify.test.ts`
- `apps/core-server/src/evidence-verify/{index,package-reader}.ts`
- `apps/core-server/src/evidence-verify/__tests__/{support.ts,verify-v2.test.ts,core-verification.test.ts}`
- `apps/core-server/src/modules/evidence/real-verification.ts`
- `docs/.../implementation/40_m7_verify_v2.md`, this file

Changed (own module): `apps/core-server/src/modules/evidence/index.ts` (operation 41 handler, one
import, one re-export, header), `__tests__/routes.test.ts` (+6 tests, one import),
`__tests__/static.test.ts` (the new file in two pinned lists, +2 tests).

Changed (shared files, one additive Edit each): `packages/shared/package.json` (export
`./evidence-verify`), `apps/core-server/test/static/imports.test.ts` (`'src/evidence-verify'` in
`CLOSED_UNITS`).

Appended: 4 lines in `delegation_progress/file_requests.md` (verdict recorder — blocking;
credential-store user entry; response schema members; spec gaps).

Not touched: `db/**`, `capture/signer/**`, `packages/shared/src/evidence-package/**`,
`credential-store/**`, `packages/shared/src/api/**`, `app.ts`, `index.ts`, `config.ts`, lockfile.

## Results

- core-server `src/evidence-verify`: 67 passed.
- core-server `src/modules/evidence` unit tests: the one known-red MODG test (`routes.test.ts:198`),
  unchanged; everything else green.
- core-server `test/static`: 3 failed, all foreign (`adapters/local` test file, `src/transcription`).
- shared `test/evidence-verify.test.ts` + `test/demo-evidence.test.ts`: 25 passed.
- typecheck: no error in a row-85 file (foreign: `src/sealing/**`, `shared/test/evidence-package.test.ts:453`).
- lint: both workspaces exit 0.

## Decisions for the controller

D-85-1 to D-85-8 in the note §5. The ones that need a ruling: the recorder (who adds the internal
action), D-85-2 (V-02 byte-range rule differs from the spec's wording), D-85-4 (revision file and
retained-certificate place are this row's invention), D-85-6 (the report is not in the response).
