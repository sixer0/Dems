# Pre-commit whole run, wave H (2026-10-10)

Runner: test-runner agent. Every command run once, sequentially, from the repo root, sandbox off (loopback + PostgreSQL). No file changed except this report. `DEMS_SEAL_E2E`, `DEMS_DEV_SESSION_E2E`, `DEMS_DEV_SPEECH_SESSION_E2E`, `DEMS_KILL_MATRIX`, `DEMS_LOCAL_SESSION_ATTENDED`, `DEMS_USER_ATTENDED`: unset (`env | grep ^DEMS_` printed nothing). No re-run was needed (no red).

## Result: ALL GREEN, 0 reds

| # | command | exit | files / tests (passed / failed / skipped) | duration |
|---|---------|------|-------------------------------------------|----------|
| 1a | `npm run typecheck -w @dems/shared` | 0 | 0 TS errors | 3 s |
| 1b | `npm run typecheck -w @dems/core-server` | 0 | 0 TS errors | 8 s |
| 1c | `npm run typecheck -w @dems/core-web` | 0 | 0 TS errors | 12 s |
| 1d | `npm run typecheck -w @dems/mobile` | 0 | 0 TS errors | 5 s |
| 1e | `npm run typecheck -w @dems/capture-protocol` | 0 | 0 TS errors | 1 s |
| 1f | `npm run typecheck -w @dems/transcriber` | 0 | 0 TS errors | 1 s |
| 1g | `npm run typecheck -w @dems/mock-core` | 0 | 0 TS errors | 2 s |
| 2a | `npm run lint -w @dems/shared` (oxlint) | 0 | no output | 0 s |
| 2b | `npm run lint -w @dems/core-server` (oxlint) | 0 | no output | 0 s |
| 2c | `npm run lint -w @dems/core-web` (oxlint) | 0 | no output | 1 s |
| 2d | `npm run lint -w @dems/mobile` (eslint) | 0 | 0 errors, 1 warning (see below) | 14 s |
| 2e | `npm run lint -w @dems/capture-protocol` (oxlint) | 0 | no output | 0 s |
| 2f | `npm run lint -w @dems/transcriber` (oxlint) | 0 | no output | 1 s |
| 2g | `npm run lint -w @dems/mock-core` (oxlint) | 0 | no output | 0 s |
| 3 | `npm run test -w @dems/shared` | 0 | 113 files passed; 2546 tests passed / 0 failed / 0 skipped | 5 s |
| 4 | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | 0 | 329 files passed; 6467 tests passed / 0 failed / 0 skipped | 66 s |
| 5 | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | 0 | 183 files passed, 3 skipped (186); 2406 tests passed / 0 failed / 7 skipped (2413) | 224 s |
| 6 | `npm run test -w @dems/core-web` | 0 | 170 files passed; 2001 tests passed / 0 failed / 0 skipped | 79 s |
| 7 | `npx -w apps/mobile jest --maxWorkers=2` | 0 | 275 suites passed; 2610 tests passed / 0 failed / 0 skipped | 189 s |
| 8a | `npm run test -w @dems/transcriber` | 0 | 20 files passed; 561 tests passed / 0 failed / 3 skipped (564) | 15 s |
| 8b | `npm run test -w @dems/mock-core` | 0 | 4 files passed; 19 tests passed / 0 failed / 0 skipped | 4 s |

All commands were run with `</dev/null` (vitest and jest steps). Rows 3, 6, 8a and 8b were run as `npm run test -w <workspace>`.

## Red list

None.

## Notes (verbatim output, no attribution)

- Lint 2d warning, `apps/mobile/src/runtime/log.test.ts` 160:19: `warning  Array type using 'ReadonlyArray<T>' is forbidden. Use 'readonly T[]' instead  @typescript-eslint/array-type` (eslint exit 0; summary `1 problem (0 errors, 1 warning)`).
- Step 5 closing lines: `[test:db] forced drops that needed a retry: 1 (1 refusal(s) with SQLSTATE 42501 ...; each drop then went through)` and `[test:db] teardown: dropped 8 database(s) in 180 ms; 0 remain with the run prefix dems_test_local_tmowzoyz_`.
- Step 7 jest line: `A worker process has failed to exit gracefully and has been force exited.` (suites all passed, exit 0).
- Skips: 7 tests in 3 files in step 5, 3 tests in step 8a. Skipped names were not listed in the run output and were not looked up.
- Baseline from `driver_rules_d94.md` (core-server unit 3 failed, db 12 failed, core-web / mobile 3 `PrecheckCheckId` typecheck errors) no longer appears: all of those commands exited 0 with 0 failures.
- `packages/capture-protocol` has typecheck and lint only in this run (no test step was requested for it).
- Not run, by instruction: `adapters/local/__tests__/e2e/`, `test:real:*`, the four heavy-run flags, device / browser checks. Lane Cores were not started.

Logs of the run (raw output): scratchpad of this session only; not in git.
