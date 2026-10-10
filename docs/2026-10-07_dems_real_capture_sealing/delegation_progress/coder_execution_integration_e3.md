# coder-execution - integration pass E3

Status: **needs-review** (7 of 7 items done; two one-condition edits in closed foreign files, one ruling asked).
Note: `implementation/109_integration_pass_e3.md`. No commit, no migration, no lockfile write.

## Files (`C` = `apps/core-server/`)

| Item | Files |
|---|---|
| 1 | `C/test/db/device-upsert.db.test.ts` |
| 2 | `C/src/modules/capture-config/__tests__/integration-d1b.db.test.ts` |
| 3 | `C/src/modules/transcripts/heads.ts`, `__tests__/transcript-routes.db.test.ts` (one pin), NEW `__tests__/heads.test.ts` |
| 4 | `C/src/capture/adapters/__tests__/static.test.ts` |
| 5 | `C/test/acceptance/contract.test.ts` |
| 6 | NEW `C/src/db/seed/{demo-packages.ts,demo-core.ts,demo-helper.ts}`, `C/src/db/seed/{seed.ts,cli.ts,index.ts}`, NEW `C/src/db/seed/__tests__/demo-packages.test.ts`, `__tests__/cli.test.ts` (fixture members); NEW `C/src/sealing-host/demo-seed/seed-hook.ts`, `demo-seed/index.ts` (export line, `DEMO_SOURCE_ROWS`), NEW `C/src/sealing-host/__tests__/demo-seed-hook.test.ts`; `C/src/db/mapping/rows.ts` (`signatureFromRow`), `mapping/__tests__/{from-rows,static}.test.ts`; `C/src/db/reset/{real-evidence.ts,routine.ts,cli.ts}`, `reset/__tests__/real-evidence.test.ts`, `C/test/db/set4-rules.test.ts` (statement pin); `C/src/evidence-verify/index.ts` (two predicates), NEW `evidence-verify/__tests__/seed-sealed-item.test.ts`; NEW `C/test/acceptance/demo-seed-v2.test.ts` |
| 6, foreign | `C/src/sealing-host/index.ts` (one import member + one condition in `findItem`); `packages/shared/src/sim/session-machine.ts` (one condition in `recordEvidenceVerificationTransition`) + `packages/shared/test/sim-core-driven-seal.test.ts` (one case) |
| 7 | `C/test/support/fake-onvif-stub.ts`, `fake-onvif-stub.test.ts` |
| Docs | this file, `implementation/109_integration_pass_e3.md`, three lines in `file_claims.md`, two notice lines in `file_requests.md` |

## Blockers / decisions

None blocking. Decisions E3-1 to E3-7 in the note, section 5; E3-3 (shared media root) needs a ruling before the standing databases are reseeded.
