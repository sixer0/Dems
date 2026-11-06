# coder-execution — row 84 (M7-W3: Core credential store, sealer, per-fragment AES-256-GCM)

- Date: 2026-10-09
- Status: **needs-review** — everything self-contained is built and tested; the row's gate checks
  that need rows 59, 82, 85, 115, 142 are not proven (listed in the note, §4).
- Note: `implementation/39_m7_encryption.md`

## Files created

- `apps/core-server/src/credential-store/errors.ts`
- `apps/core-server/src/credential-store/key-material.ts`
- `apps/core-server/src/credential-store/key-store.ts`
- `apps/core-server/src/credential-store/envelope.ts`
- `apps/core-server/src/credential-store/fragment-cipher.ts`
- `apps/core-server/src/credential-store/index.ts`
- `apps/core-server/src/credential-store/__tests__/store.test.ts`
- `apps/core-server/src/credential-store/__tests__/fragment-cipher.test.ts`
- `apps/core-server/src/credential-store/__tests__/static.test.ts`
- `apps/core-server/src/modules/stt-config/__tests__/credential-store.test.ts`
- `apps/core-server/src/modules/stt-config/__tests__/credential-store.db.test.ts`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/39_m7_encryption.md`

## Files changed

- `apps/core-server/src/modules/stt-config/index.ts` — import of the store, `storeSealer`, `onReady` hook, two constants
- `apps/core-server/src/modules/stt-config/seams.ts` — header text only
- `apps/core-server/src/modules/stt-config/__tests__/support.ts` — optional `dataDir` of `sttApp` (additive)
- `apps/core-server/test/static/imports.test.ts` — SHARED: one entry `'src/credential-store'` + one comment line in `CLOSED_UNITS` (Edit tool)
- `docs/.../delegation_progress/file_requests.md` — one appended line (F-84-1)

No commit, no lockfile write, no dependency, no edit under `src/db/**`, `apps/transcriber/**`,
`capture/signer/**`, `capture/adapters/**`, `app.ts`, `index.ts`, `config.ts`.

## Results

- unit: `src/credential-store` 58 passed (incl. the `KeyWrapSecrets` adapter for row 83: `store.keyWrapSecrets`); `src/modules/stt-config` all passed outside the sandbox
  (the 4 loopback-listener tests fail inside it with EPERM, as before this row)
- db (lock held): 14 passed (6 new, 8 existing unchanged)
- simulator `packages/shared/test/api-stt-config.test.ts`: 43 passed, file untouched
- typecheck / lint: nothing in this row's files
- Red, not this row's: `test/static/imports.test.ts` now lists `src/sealing` as an open unit (another row); `test/static/credentials.test.ts` (1) and `src/capture/__tests__/static.test.ts` (2)
  name `src/capture/adapters/local/*` (row 134); `tsc` errors in `adapters/local/*-helper-args.ts`
  (row 134) and `packages/shared/src/api/sim-actions.ts`, `src/live/source/bindings.ts`

## For the controller

1. F-84-1: `dems_app` cannot replace a stored camera credential (42501 on every UPDATE form). Wanted: `GRANT SELECT (device_id) ON public.capture_device_credentials TO dems_app;` (or an owner-owned write function) — exact statement and reasoning in the note §6.
2. D-84-1: new closed top-level unit `src/credential-store`; D-84-2: wiring by `onReady`, no `app.ts` edit, no boot step.
3. Rotation hook `credentialKeys.retainOnly` has no caller until rows 115 / 142: replaced keys accumulate.
4. Custody note §7: no escrow; export before any risk to `.data/`; backup policy of `.data/` is the user's decision (U-3).
5. `masterplan/02_plan.md` and `status_tasks.md` were not edited (driver rules D94).
