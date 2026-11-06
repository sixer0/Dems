# coder-execution — integration pass D4

Status: **needs-review**. Note: `implementation/98_integration_pass_d4.md`. No commit, no migration.

## Items

1 done · 2 done (two blockers outside the pass: F-D4-1 verifier, F-D4-2 key ID) · 3 done, coverage
red on two cells that are not op 83 · 4 done · 5 NOT built (request) · 6 done · 7 listed · 8 done ·
9 done · 10 done · 11 answered · 12 done.

## Files

New:
- `apps/core-server/src/modules/sessions/audio-intervals.ts` + `__tests__/audio-intervals.test.ts`, `audio-intervals.db.test.ts`
- `apps/core-server/src/modules/transcripts/{routes.ts,revision-body.ts,store.ts}` + `__tests__/revision-body.test.ts`, `transcript-routes.db.test.ts`
- `apps/core-server/src/transcript-package/index.ts`
- `apps/core-server/src/evidence-verify/__tests__/development-key.test.ts`
- `apps/core-server/test/acceptance/contract.transcripts.ts`
- `apps/core-server/test/db/integration-d4.db.test.ts`
- `packages/shared/test/evidence-verify-development-key.test.ts`

Edited:
- `apps/core-server/src/app.ts` (one import, one unit line)
- `apps/core-server/src/modules/sessions/{routes.ts,operations.ts,index.ts}`, `__tests__/{static.test.ts,routes.test.ts}`
- `apps/core-server/src/modules/transcripts/index.ts` (the store moved to `store.ts`, same exports)
- `apps/core-server/src/db/mapping/{rows.ts,changes.ts}`, `__tests__/from-rows.test.ts`
- `apps/core-server/src/evidence-verify/index.ts`, `__tests__/core-verification.test.ts`
- `apps/core-server/test/acceptance/{contract.test.ts,rbac-matrix.test.ts}`
- pins: `test/static/{scaffold.test.ts,imports.test.ts}`, `src/capture/__tests__/static.test.ts` (P25 list), `src/plugins/permission-guard/__tests__/without-domain-modules.ts`
- `packages/shared/src/sim/{types.ts,api.ts,evidence.ts}`, `src/api/evidence.ts`, `src/evidence-verify/{report.ts,types.ts,verify.ts}`, `openapi/openapi.json` (generator)
- `packages/shared/test/{integration-c1.test.ts,sim-v2-parity.test.ts}`

## Requests filed

`delegation_progress/file_requests.md`, nine lines of pass D4 (16:24:16Z) and the LANDED line for the
mapping fixes.
