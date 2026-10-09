# coder-execution — integration pass A (D109)

Status: **complete** (one decision for the controller: a second `CREDENTIAL_STORE_USERS` entry). No commit.
Note: `implementation/90_integration_pass_a.md`.

## Files

New
- apps/core-server/src/transcription/credential-opener.ts
- apps/core-server/src/transcription/__tests__/encrypted-credential.test.ts
- apps/core-server/src/transcription/__tests__/dependencies.test.ts
- apps/core-server/src/evidence-verify/fragment-opener.ts
- apps/core-server/src/evidence-verify/__tests__/real-fragment-cipher.test.ts

Changed
- apps/transcriber/src/key-loader.ts, probe.ts, adapter.ts, index.ts, __tests__/key-loader.test.ts
- apps/core-server/src/transcription/index.ts, probe.ts, session.ts
- apps/core-server/src/modules/system/index.ts, __tests__/routes.test.ts, __tests__/static.test.ts
- apps/core-server/src/evidence-verify/index.ts, __tests__/support.ts
- apps/core-server/src/credential-store/__tests__/static.test.ts (two entries)
- apps/core-server/src/capture/__tests__/protocol-pins.test.ts (one assertion + its import)
- apps/core-server/package.json, package-lock.json (`@dems/transcriber` dev -> dependencies)

Not touched: app.ts, packages/shared/**, modules/stt-config/**, src/sealing/**, db/**, capture-worker/**, adapters/**, static.test.ts of capture.

## Items
1 done · 2 done · 3 done (in the module, no app.ts line needed) · 4 done · 5 done · 6 done · 7 respected.

## Results
transcriber 555 passed / 3 skipped, typecheck + lint clean; core unit set 524 passed / 4 failed (all other rows' files); core db (system, op92-booted) 44 passed; core typecheck 4 errors in other rows' files; 9 of 9 mutations red.
