# coder-execution — row 115 (STT configuration at runtime, R-8, M6)

Status: **needs-review** (2026-10-09). Implementation note: `implementation/54_m6_stt_config_runtime.md`.

## Why not complete

1. **Session snapshot is not in the session record.** No column exists for it (dbc-3 §B.10 / §B.13); no migration was written. The snapshot is held in process memory behind a port. Blocking request to rows 129/130 in `file_requests.md`.
2. **`ENCRYPTED` credential is not opened.** `apps/transcriber` has no entry for an opened secret (the brief assumed one). Answered `CREDENTIAL_UNAVAILABLE` without a connection. Request to row 79.
3. **Engine guard (N-2) not in production wiring**: `createEngineGuard` is not exported by `@dems/transcriber`. Same request.
4. **Service state not yet read by `modules/system`**: one-line request to row 62.

## Files

New:
- `apps/core-server/src/transcription/{index,host,credential-reveal,probe,snapshot,session,boot,log}.ts`
- `apps/core-server/src/transcription/__tests__/{support.ts,probe.test.ts,session.test.ts,boot.test.ts}`
- `apps/core-server/src/modules/stt-config/__tests__/op92-booted.db.test.ts`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/54_m6_stt_config_runtime.md`

Changed (owned):
- `apps/core-server/src/modules/stt-config/index.ts` (mount, default probe, state note), `seams.ts` (header), `change.ts` (F-115-1), `__tests__/routes.test.ts`, `__tests__/static.test.ts` (`STT_REVEAL_CALLERS` = one file)

Changed (shared, smallest edit):
- `apps/core-server/test/static/imports.test.ts` (one `CLOSED_UNITS` entry + comment)
- `packages/shared/src/api/transcription.ts` (`STT_ENDPOINT_FORBIDDEN_PATTERN`, `isSttConfigEndpoint`, one applier line, one description)
- `packages/shared/test/api-stt-config.test.ts` (one added test, one import)
- `packages/shared/openapi/openapi.json` (regenerated under the npm lock: one description line; 92 / 35 / 57 unchanged)
- `delegation_progress/file_requests.md` (five appended lines)

Not touched: `app.ts`, `index.ts`, `config.ts`, `apps/transcriber/**`, `sealing/**`, `credential-store/**`, `db/**`, `capture/**`, `modules/system/**`, any lockfile.

## Results

- core-server lint 0; typecheck clean in this row's files (2 errors from another row's in-flight edit: `plugins/permission-guard/decision.ts:223`, `test/acceptance/rbac-matrix.support.ts:623`).
- Unit (own files + module + system + static guards): 415 passed, 2 failed — both `test/static/credentials.test.ts`, both naming `src/capture/adapters/local/__tests__/mic-helper.generated.test.ts:176`.
- db (`src/modules/stt-config`, throw-away databases, under the db lock): 23 passed; booted-server file run 3 times.
- shared `api-stt-config.test.ts` 44 passed; transcriber `backends` + `static` 201 passed.
- 12 of 12 mutations red.

## Decisions for the controller

D-115-1 host file vs frozen config keys; D-115-3 torn-checkpoint rule; F-115-1 plaintext guard from 8 bytes on (ruling wanted); the snapshot column; the `log` / `transcriberLog` alias to drop after row 116.
