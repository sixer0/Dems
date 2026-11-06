---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution
item: finding F W3-3, decision D142 (static scan skips `.cache/`)
date: 2026-10-06
status: complete
evidence_tier: 3
---

# coder-execution progress: static scan skips `.cache/`

Status: **complete**. Evidence document: `gateway_check/04d_static_scan_cache.md`.

## Files created or updated

- `/Users/gsp-budi/Documents/DEMS/apps/core-server/test/static/scan.ts`: edited. `'.cache'` added to `SKIPPED_DIRECTORIES`; the comment line above it names `.cache/`. Nothing else.
- `/Users/gsp-budi/Documents/DEMS/apps/core-server/test/static/scan-skips.test.ts`: created (4 tests).
- `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/04d_static_scan_cache.md`: created.
- `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_static_scan_cache.md`: created (this file).
- `/Users/gsp-budi/Documents/DEMS/.cache/rollback/scan_cache/scan.ts.pre`: pre-image, git-ignored, sha256 `89bef96d28a37509dc2cdf4106b2e873864dd1071d4697d1b72588fd5fa9c9db`.

## Results

| Command | Exit | Last lines |
|---------|------|------------|
| `npm run test -w @dems/core-server -- --maxWorkers=2 test/static` | 0 | 12 files / 129 tests passed |
| `npm run test -w @dems/core-server -- --maxWorkers=2` | 0 | `Test Files  154 passed (154)`, `Tests  3916 passed (3916)` (baseline 153 / 3,912: +1 / +4, the new file) |
| `npm run typecheck -w @dems/core-server` | 0 | `> tsc --noEmit`, no output |
| `npm run lint -w @dems/core-server` | 0 | `> oxlint`, no output |

The new test was red before the edit (2 failed, 2 passed) and green after.

## Decisions and findings

- `.locks` and `.data` were NOT added: the scanner is only ever run on `apps/core-server`, `<repo>/apps` and `<repo>/packages` (29 `readTree(WORKSPACE...)` lines plus one line in `credentials.test.ts:41`); no call reads the repository root, where those two folders live, and `find apps packages -maxdepth 3` found neither. If a later guard reads the repository root it must add both (`.data` holds the cluster and the credential files).
- No existing test file tests `scan.ts`; a new file `scan-skips.test.ts` was created. It passes a root to the real `readTree` (temporary directory under `os.tmpdir()`, removed in `afterAll`; 0 leftovers).
- The real W3-3 scenario (a stray file in `apps/core-server/.cache/`) was not recreated, since that folder is outside the rows this change may write.
- No database command, no git write, no `cd`, no `timeout`.
