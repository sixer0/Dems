# coder-execution — row 83 (M7-W2: package + manifest v2 + Signer)

- Status: **complete** for the self-contained part (optimistic scheduling, D92); the row's gate checks `M7-VV-SRV`, `M7-TP-1`, `M7-KM-C-S1..S6`, `M7-REF-1` are NOT run (need rows 59, 82, 85).
- Date: 2026-10-09. No commit, no lockfile write, no new dependency, no schema or migration touched, no key provisioned under `.data/`.
- Note: `implementation/38_m7_package_signer.md`.

## Files created
- `packages/shared/src/evidence-package/`: `index.ts`, `layout.ts`, `canonical.ts`, `manifest.ts`, `hash.ts`, `fragments.ts`, `signature-file.ts`, `source-class.ts`, `build.ts`, `media-time.ts`, `example.ts`, `errors.ts`
- `packages/shared/test/evidence-package.test.ts`
- `apps/core-server/src/capture/signer/`: `index.ts`, `types.ts`, `host-key.ts`, `der.ts`, `seal.ts`, `key-record.ts`, `__tests__/signer.test.ts`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/38_m7_package_signer.md`

## Shared files edited (Edit tool, additive)
- `packages/shared/package.json` — one export line `./evidence-package`
- `apps/core-server/src/capture/index.ts` — `export * from './signer'` (+ one comment line)
- `apps/core-server/src/capture/__tests__/static.test.ts` — signer file list pinned; `src/capture/signer/host-key.ts` added as the ONE pinned file for the file system (G-R2) and the cryptography module (G-R8)

## Requests filed (`file_requests.md`, both non-blocking)
- row 84: a `KeyWrapSecrets` backed by the credential store
- `packages/shared/src/api/redaction.ts`: `mts` prefix (SEC35-13) — not done by this row

## Results
- shared `test/evidence-package.test.ts`: 155 passed; signer tests: 16 passed; v1 demo tests untouched and green.
- Red tests seen, none from this row: `adapters/local/process-door.ts`, `adapters/local/pipe-files.ts` (3 static guards), adapter file-list pin; typecheck `adapters/local/*-helper-args.ts`, `shared/src/api/sim-actions.ts`, `live/source/bindings.ts`; shared suite `api-domain-operations`, `i18n`, `live-source-bindings` (one whole-suite run of `packages/shared` was made after the `package.json` edit).

## Decisions and blockers for the controller
See note §2: D-83-1 (119 + 9 split), D-83-2 (encrypted file, keychain not used; honest limit), D-83-6 (ms rounding to confirm), D-83-8 (SEC35-13 open), and the `sealing.steps[]` / `signedAt` determinism risk for row 82.
