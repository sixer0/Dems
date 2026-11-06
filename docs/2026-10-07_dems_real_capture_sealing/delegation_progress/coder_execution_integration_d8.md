# coder-execution — integration pass D8

Status: **needs-review** (2026-10-10). Note: `implementation/102_integration_pass_d8.md`.

| Item | State |
|--|--|
| 1 Model provenance | done for `cpu-local` (name = adapter id, version = host file, quantisation = model file header, SHA-256 = Core hash of the model file); `omlx-server` has no source -> PARTIAL, named. Decision D-D8-1 open (source of field 85) |
| 2 Boot-time notice listener | done (`registerCaptureNotices`, `onReady`; first-use attach removed) |
| 3 Failed-start keys | forwarder half done + proven; alert / audit row when the forwarder raises first wait for pass D6 (request filed; one `it.fails` follows it) |
| 4 D-71c-2 | not done: one condition in `capture-session/index.ts` (not this pass's area) — request filed; erratum sentence in the note |
| 5 codec | not done: no protocol change needed, `capture/fragments.ts` + `sealing-host/session-reader.ts` are not this pass's — request filed |

## Files (below `apps/core-server/`)

NEW
- `src/transcription/model-provenance.ts`
- `src/transcription/__tests__/model-provenance.test.ts`
- `src/capture-notices/__tests__/boot-listener.test.ts`

EDITED
- `src/transcription/host.ts` (optional `cpuLocal.modelVersions`)
- `src/transcription/session-run.ts` (the port answers a code; `provenanceCode`)
- `src/transcription/index.ts` (default of the port = the production provider; exports)
- `src/transcription/__tests__/session-run.test.ts` (three cases; the engine double)
- `src/transcription/__tests__/support.ts` (one appended helper)
- `src/capture-notices/index.ts` (`registerCaptureNotices`; first-use attach removed)
- `src/capture-notices/__tests__/session-start.db.test.ts` (rig: nothing uses the unit before a start; one obsolete expectation corrected)
- `src/modules/capture-inputs/index.ts` (one import member, one call line, comment)
- `src/capture/forwarder.ts` (failed-start keys on the raise)
- `src/capture/__tests__/forwarder.test.ts` (three cases), `src/capture/__tests__/forwarder-engine.test.ts` (two cases, one `it.fails`)

Docs: `delegation_progress/file_claims.md` (five lines), `delegation_progress/file_requests.md` (three lines).

NOT touched: `src/sealing/**`, `src/sealing-host/**`, `src/core/audit-details.ts`, `src/capture-session/**`, `packages/shared/**`, `apps/transcriber/**`, `app.ts`, the manifest schema, any client, `.data/**`.

## Results

Unit (touched files + static guards): 33 files, 438 passed, 1 expected fail, 0 skipped. Db `session-start.db.test.ts`: 4 passed (after one corrected expectation). Lint exit 0. Typecheck: 0 errors in this pass's files; 1 error in `test/acceptance/rbac-matrix.test.ts:807` (pass D6, in flight).

The STT server on port 8000 was not called. No commit, no migration, no download.
