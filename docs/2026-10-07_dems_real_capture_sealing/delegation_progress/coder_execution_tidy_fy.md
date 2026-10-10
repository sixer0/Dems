# coder-execution - tidy pass F-Y

- Status: complete (needs-review on the decisions of `implementation/118_tidy_pass_fy.md` section 4).
- Scope: brief items 1-7; items 8-10 and the sync-level alert by controller decision D189.
- No commit, no migration, no lockfile write. OpenAPI regenerated once under `.locks/npm.lock`.

## Files
New: `apps/core-server/src/capture/adapters/camera/connection-target.ts`, `src/capture/__tests__/tidy-fy.test.ts`, `src/capture-session/__tests__/facts-fy.test.ts`, `src/evidence-verify/__tests__/r88-19-codes.test.ts`, `packages/shared/test/sim-fy-clock-offset.test.ts`, `implementation/118_tidy_pass_fy.md`.

Edited (core-server): `src/capture/forwarder.ts`, `src/capture/index.ts` (one export), `src/capture/adapters/index.ts` (one export line), `src/capture/adapters/camera/onvif-session.ts`, `src/capture/adapters/camera/__tests__/onvif-session.test.ts`, `src/capture/adapters/__tests__/static.test.ts` (file list), `src/capture-session/index.ts`, `src/capture-session/facts.ts`, `src/capture-session/__tests__/session-capture.db.test.ts`, `src/sealing-host/session-reader.ts` (one member + comment), `src/modules/recording-fragments/index.ts` (header), `src/modules/sessions/routes.ts` (one argument), `src/modules/sessions/__tests__/recover-failed-seal.db.test.ts`, `test/support/capture.ts`, `test/support/capture-stub-worker.mjs`.

Edited (shared): `src/sim/capture-notices.ts`, `src/sim/capture-fault-wording.ts`, `src/api/evidence.ts`, `openapi/openapi.json` (generator), `test/integration-d1b.test.ts` (one case).

Mutated and restored byte-exactly: `apps/core-server/src/capture/supervisor.ts` (item 7).

## Results
Core unit 1054 passed (66 files) + 13 + 28; capture db 52 (capture-session) and the fence / notices files green; op 33 db 1; shared 2475 of 2476 on the full run, the one (an enumeration pin) fixed and its file re-run; typecheck and lint clean on both workspaces.

## Open
Whole-workspace and client suites, and the heavy run with the built worker: list in section 5 of the note.
