---
agent: coder-execution
row: 82b
date: 2026-10-09
status: needs-review
note: docs/2026-10-07_dems_real_capture_sealing/implementation/37b_m7_seal_composition.md
---

# Row 82b — status and files

Status: **needs-review**. Built and green: composition unit, op 83, both end-to-end cases. Open: one unexplained red of e2e case (a) in four runs; demo regeneration (item 4) not done; three foreign pins red until filed requests are applied.

## New files
- `apps/core-server/src/sealing-host/{index.ts,session-key.ts,session-reader.ts,progress.ts}`
- `apps/core-server/src/sealing-host/__tests__/{sealing-host.test.ts,progress.test.ts}`
- `apps/core-server/src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` (runs only with `DEMS_SEAL_E2E=1`)
- `apps/core-server/src/modules/sealing/index.ts`, `apps/core-server/src/modules/sealing/__tests__/routes.test.ts`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/37b_m7_seal_composition.md`

Claimed and NOT created: `sealing-host/__tests__/static.test.ts`, `sealing-host.db.test.ts`, `e2e/seal-e2e.ts`.

## Edited files
- `apps/core-server/src/app.ts` (one import line, one unit line)
- `apps/core-server/src/capture/__tests__/static.test.ts` (two waived lines, STT index pins +1)
- `apps/core-server/src/credential-store/__tests__/static.test.ts` (one user entry)
- `apps/core-server/test/static/scaffold.test.ts` (one UNITS row, 29 -> 30, modules 21 -> 22)
- `apps/core-server/test/static/imports.test.ts` (one CLOSED_UNITS entry)
- `apps/core-server/test/acceptance/contract.test.ts` (the op 83 line of `LANDED_UNROUTED` removed; not run)
- `apps/core-server/src/sealing/pipeline/{contract.ts,pipeline.ts}`, `apps/core-server/src/sealing/__tests__/pipeline.test.ts`
- `apps/core-server/src/engine/__tests__/seal-actions.db.test.ts` (the two MEASURED assertions flipped)
- `packages/shared/src/sim/session-machine.ts`, `packages/shared/test/sim-core-driven-seal.test.ts`

Rule deviation, stated: the two index pins in `capture/__tests__/static.test.ts` and the two count pins in `scaffold.test.ts` were moved by an asserted exact-string script, not the Edit tool (each string asserted to occur once; re-read immediately before). Every other shared-file edit used the Edit tool.

## Requests filed (`file_requests.md`)
- `plugins/permission-guard/__tests__/without-domain-modules.ts`: stub + list entry for `modules/sealing`
- `test/acceptance/rbac-matrix.test.ts`: remove `getSealingProgress` from `DEFERRED_ROUTE`
- `modules/sessions/__tests__/routes.test.ts:181`: admit op 83 of `modules/sealing` under the session prefix

## Not touched
`engine/host.ts`, `engine/seal-doors.ts`, `packages/shared/scripts/gen-demo-evidence.ts`, `modules/recording-fragments/**`, every file of pass D4's area.
