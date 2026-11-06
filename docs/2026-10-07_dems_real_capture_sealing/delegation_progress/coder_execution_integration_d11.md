# coder-execution — integration pass D11

Status: **needs-review** (8 of 8 items done; decisions D11-1 and D11-3 want a ruling).
Report: `implementation/105_integration_pass_d11.md`. No commit, no migration, no local device.

## Files

New
- `apps/core-server/src/modules/devices/source-facts.ts`
- `apps/core-server/src/modules/devices/__tests__/source-facts.test.ts`
- `apps/core-server/src/modules/transcripts/heads.ts`

Edited — core-server
- `src/engine/fact-doors.ts`, `src/engine/host.ts` (four blocks marked "Source-fact block"), `src/engine/errors.ts` (one line + comment), `src/engine/__tests__/errors.test.ts`, `src/engine/__tests__/capture-actions.db.test.ts` (fixture)
- `src/modules/devices/index.ts`, `src/modules/devices/__tests__/{static.test.ts,source-class.db.test.ts}`
- `src/modules/transcripts/{index.ts,statements.ts}`, `src/modules/transcripts/__tests__/transcript-routes.db.test.ts`
- `src/modules/demo/{reset.ts,host.ts}`, `src/modules/demo/__tests__/{support.ts,reset-order.test.ts,static.test.ts,reset-failures.db.test.ts}`
- `src/modules/sessions/__tests__/{pure.test.ts,operations.db.test.ts}`
- `src/capture/fence/__tests__/development-session.db.test.ts`
- `test/acceptance/contract.test.ts` (the `resetDemo 409` block)

Edited — shared
- `src/sim/api.ts` (`toApiSession`, `ApiSession`), `src/api/core-api.ts` (four words of the op 26 text), `openapi/openapi.json` (generator, `npm.lock`; one line), `test/sim-api.test.ts`

Edited — mobile
- `src/runtime/live-no-raw-fetch.test.tsx`, `src/runtime/link-notice-static.test.ts`

Task folder
- `delegation_progress/file_claims.md` (two lines), `delegation_progress/file_requests.md` (three lines: closures, two findings)

## Blockers
None.

## Open, routed
- `transcript-routes.db.test.ts`: 5 older cases red (`V-10 TRANSCRIPT_MODEL_MISMATCH`, pass D10 item 6) — finding in `file_requests.md`.
- Reset guard store root vs `config.mediaStoreDir` — finding in `file_requests.md`.
- Not taken (not in the list): unifying `engine/capture-session.ts` with the shared copy; row 92's wording of `transcriptModel`.

## Follow-up (decision D165) — status: needs-review, both items done

New
- `apps/core-server/src/modules/demo/__tests__/reset-store-root.db.test.ts`

Edited
- `apps/core-server/src/db/commands/evidence-store.ts` (`evidenceStoreRootOf`; the subpath is the configuration's constant)
- `apps/core-server/src/db/reset/{cli.ts,routine.ts (comment of `evidenceStoreDir` only)}`
- `apps/core-server/src/modules/demo/{reset.ts,host.ts}`, `__tests__/{support.ts,reset-order.test.ts,routes.test.ts,static.test.ts}`
- `apps/core-server/src/modules/transcripts/__tests__/transcript-routes.db.test.ts` (the rig)
- `delegation_progress/file_claims.md`, `file_requests.md` (closures + one new finding: shared media root of a db run)

Open, routed: contract walk plants a package in the run's shared media root (flake of parallel reset db files); `db:reset` from a shell without `DEMS_MEDIA_DIR` (D11-9).
