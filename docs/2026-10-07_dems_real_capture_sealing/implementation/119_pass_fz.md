# 119 - Pass F-Z: the six reds of the wave-F checkpoint

Date 2026-10-10. Agent coder-execution. Source: `test/06_checkpoint_wave_f.md`. No commit, no migration. Each check run once (D122); one re-run after a fail (the typecheck, below).

| # | Red | Wrong side | Change |
|---|-----|-----------|--------|
| 1, 2 | `modules/sessions/__tests__/static.test.ts` rule M3 (`:106`, `:115`) | PRODUCT (`modules/sessions/routes.ts`, F-Y item 8 read `principal.kind` / `.operatorId`) | The static test is unchanged. The recovery handler now has ONE hand-on, `handOn = (door) => door.command(request.principal, hosted)`, used for both receivers: `sealingHost(app).failedSeal(id)` (the retry) and the unit of the open session (`onOpenSession(operationId, id, handOn)`). The count of principal uses stays 14, each an argument of a `.command(`. The sealing host reads who asked: `retryFailedSeal(sessionId, principal?: Principal)` (was `by?: { actorId }`) takes `operatorId` of an OPERATOR principal, else null; new door `failedSeal(sessionId).command(principal, hosted?)` calls it (inert host: false). `sealing-host.test.ts` audit case passes a principal instead of `{ actorId }`. |
| 3 | `modules/transcripts/__tests__/revision-reconcile.test.ts` (b) crash point 2 | TEST (verifier right: D187, fix F-M7c) | Before healing: failing = `V-11 REVISION_COUNT_MISMATCH` only AND notices contain `REVISION_APPEND_PENDING`. After healing: no failure, V-11 PASS, the notice is gone (new assertion). |
| 4 | `modules/transcripts/__tests__/transcript-routes.db.test.ts` R80-08 (b) | TEST | Same two assertions before the restart; after the boot step: no failure, notice gone, V-11 PASS, head 2. |
| 5 | `modules/evidence/__tests__/bulk.db.test.ts` export counter | TEST (product right: op 42 answers `jobId`) | Expectation gains `jobId: 'EXPJ-000091'` (`exportJobIdOf`: `EXPJ-` + the six digits of the export ID). |
| 6 | `apps/mobile/.../summary-live-static.test.ts` file list | TEST | `session-finalizing/unsealable-notice.tsx` read against every rule of the file: no simulator action hook, no `.actions`, no raw request / socket / address / storage / Live source, no `@/runtime/*` or `@/navigation/*` deep import, no link idiom of its own, no timer, no Core command, no gap marker. It holds; added to the list. Product file untouched. |

Intent of crash point 2 (a revision the table holds and the list lacks, staged file present -> healed -> verify clean): still proven in both tests - mismatch before, `reconcileRevisionLists` = 1 / boot step, list = staged bytes, folder = sealed folder, verify clean and notice-free after.

## Runs

| Check | Command | Result |
|-------|---------|--------|
| core unit | `npx vitest run --root apps/core-server --project unit src/modules/sessions src/modules/transcripts test/static src/sealing-host/__tests__/sealing-host.test.ts` | 24 files, 393 passed |
| core db (lock `.locks/db-migrate.lock`, sandbox off) | `--project db src/modules/sessions src/modules/transcripts src/modules/evidence` | 14 files, 193 passed; 3 throw-away databases dropped, 0 remain |
| mobile jest | `npx -w apps/mobile jest --maxWorkers=2 src/features/session-summary src/features/session-finalizing` | 12 suites, 90 passed |
| core typecheck | `npm run -w apps/core-server typecheck` | first run 1 error (TS2502, the `hosted` parameter name inside its own `typeof`), parameter renamed (type only), second run clean |
| after that rename | unit `src/modules/sessions` + `sealing-host.test.ts` | 5 files, 189 passed |
| core lint | `npm run -w apps/core-server lint` | clean |
| mobile typecheck / lint | `npm run -w apps/mobile typecheck` / `lint` | clean / 0 errors, 1 warning (`src/runtime/log.test.ts:160`, not this pass) |

Not proven again: the db project was run before the type-only rename in `routes.ts` (no runtime change; the unit static rule and typecheck were re-run after it).

## Decision for the controller

`SealingHost` has one more member (`failedSeal`) and `retryFailedSeal`'s second argument is now a `Principal`. The sealing host imports the TYPE `Principal` from `plugins/authenticate` (as the engine host does).
