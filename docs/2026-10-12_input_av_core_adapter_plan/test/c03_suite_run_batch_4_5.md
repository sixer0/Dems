# c03 - suite run, batches 4-5 (uncommitted tree on task4/input-av-core-port, on top of b7ed4c60)

Tier 3. Run from the repository root, no file changed by the checks (source, tests, snapshots, lockfile). The only writes are the git-ignored build outputs under `apps/capture-worker/build` (step 6) and this record. Checked: worker announce gate and version 0.6.0, production process door, credential reader, selector contract with the unassigned slot, session start, client camera facts, audio card listing, typed-address search contract, integration passes I-3 and I-4, host scripts. Previous runs: `c01_suite_run_batch_1_2.md`, `c02_suite_run_batch_3.md`.
Logs: scratchpad `tc.log`, `lint.log`, `cs.log`, `mock.log`, `ws_<name>.log`, `db.log`, `hh.log`, `hs.log`, `make.log`, `scan.out`, `base.txt`, `untracked.txt`.
Command prefix: `rtk` on typecheck, lint, the workspace test runs, host-helper.

## Commands

| # | Command | Sandbox | 1-min load before | Time | Exit | Summary |
|---|---|---|---|---|---|---|
| 1 | `npm run typecheck` | on | 0.95 | 32 s | 0 | all 7 workspace `tsc` runs clean |
| 2 | `npm run lint` | on | ~1 | 17 s | 0 | no error; 1 oxlint warning (see below) |
| 3a | `npm run test -w @dems/core-server` (unit project) | off | 2.67 | 110 s | **1** | 330 of 331 files passed; 7067 passed, 1 failed |
| 3b | `npm run test -w @dems/mock-core` | off | 2.35 | 4 s | 0 | 4 files; 19 passed |
| 3c | `npm run test -w @dems/capture-protocol` | on | 3.10 | <1 s | 0 | 1 file; 31 passed |
| 3d | `npm run test -w @dems/shared` | on | 3.10 | 5 s | **1** | 101 of 102 files passed; 2722 passed, 1 failed |
| 3e | `npm run test -w @dems/core-web` | on | 3.89 | 78 s | 0 | 172 files; 2373 passed |
| 3f | `npm run test -w @dems/transcriber` | on | 25.81 (the baseline-script run was going) | 20 s | 0 | 18 files; 563 passed, 4 skipped |
| 3g | `npm run test -w @dems/mobile` (jest) | on | 19.53 (same cause) | 207 s | 0 | exit 0; `rtk` printed no jest summary line, so no suite/test count is recorded |
| 4 | `npm run test:db -- --maxWorkers=2` under `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock` | off | 3.62 | 212 s | **1** | 179 files passed, 1 failed, 3 skipped; 2540 passed, 1 failed, 7 skipped |
| 5a | `npm run test:host-helper` | on | 3.40 | 17 s | 0 | Ran 58 tests, OK |
| 5b | `bash scripts/host/test_host_profile_scripts.sh` | on | 3.40 | - | 0 | RESULT: 171 passed, 0 failed (shellcheck not installed: skipped, as the script says) |
| 6 | `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock make -C apps/capture-worker` | off | 2.63 | 36 s | 0 | static rules OK, self-test refusals as required, unit checks hold (announce_test: all 187 checks hold; writer, anchor, micwatch, start_checks, log_test, sink_kill_test hold), worker built |
| 7a | `node --test scripts/secret-scan/` | on | - | 1 s | 0 | 5 tests, 5 pass, 0 fail |
| 7b | `node scripts/secret-scan/count-only.mjs --tracked` | on | - | <1 s | 1 (hits exist, as at baseline) | see below |

3a, 3b, 4 and 6 ran with the command sandbox off (listen / PostgreSQL / lock directory); the rest inside it. The `make` run did not start the worker; no `make e2e`, no fixture. `npm run pg:status` (sandbox off): "OK, running". PostgreSQL was not started, stopped, initialised or reset; no `db:migrate`.

## Databases touched by `test:db`

PostgreSQL 18.4 on 127.0.0.1:4432, helper role `dems_owner`, code under test `dems_app`, run prefix `dems_test_local_tmt5irzb_`. Throw-away templates and clones of that prefix only; stale sweep dropped 0; teardown "dropped 8 database(s) in 195 ms; 0 remain with the run prefix". The demo database and the lane databases were not touched.

## Failures (3)

| # | Workspace | Test file | Test name | Assertion | Points at |
|---|---|---|---|---|---|
| F1 | `apps/core-server` (unit) | `src/capture/__tests__/forwarder.test.ts:433` | which launcher the capture unit is built with > mode real with a worker program: the supervisor starts THAT program, with fixed arguments and an empty environment | `toEqual([... , ...captureWorkerSettingArguments(CAPTURE_WORKER_PROCESS_SETTINGS)])`: received `--ingest-open-window-ms 30000`, expected `15000` | `src/capture/worker-arguments.ts:62-82` (`captureWorkerArguments(logPath, production)`; `src/capture/index.ts:171` passes `operation === CaptureOperation.REAL_PRODUCTION`). `mode real` now resolves to `REAL_PRODUCTION`, so the worker gets `CAPTURE_WORKER_PRODUCTION_SETTINGS` (window `PRODUCTION_INGEST_OPEN_WINDOW_MS` = 30000), while the test still builds the expected list from `CAPTURE_WORKER_PROCESS_SETTINGS`. The test file is unmodified in the tree (stale expectation, or the operation selection is wrong - the controller judges) |
| F2 | `packages/shared` | `test/api-stt-config.test.ts:308` | the model identifier: one shared pattern, used by operation 91 > the OpenAPI document carries the pattern on the existing member: no new schema, the totals do not move | `expect(Object.keys(document.components.schemas)).toHaveLength(171)`: got 172 | The schema count moved 171 -> 172 with "the optional body of op 93 (task 4 row 94)"; `test/api-openapi-scope.test.ts:555` is already updated to 172, `api-stt-config.test.ts` (unmodified) still pins 171. Source side: `packages/shared/src/api/core-api.ts`, `openapi/openapi.json` |
| F3 | `apps/core-server` (db project) | `test/acceptance/contract.test.ts:2074` | SC6: what the whole file received > the coverage: every documented status of every operation was produced, or is listed with the reason why not | `expect(missing).toEqual([])`: received `[ 'startCaptureDiscovery 422' ]` | The documented 422 of `startCaptureDiscovery` (the typed-address search contract, op 93) is produced by no request in the acceptance file and is not in its list of unproduced statuses; the status is declared in `packages/shared/src/api/core-api.ts` / `capture-discovery.ts`. The test file is modified in the tree but does not cover this cell |

c02 had no failure; these three are new with batches 4-5. No sandbox-caused failure (`listen EPERM`) appeared.

## Lint warning (exit 0)

`apps/core-server/src/modules/capture-config/credential-reader.ts:204:38: warning eslint(no-useless-escape): Unnecessary escape character '-'` (oxlint; untracked new file). Not an error; the run exited 0.

## Secret scan (count only, tracked tree, working-tree content)

`scanned 10554 file(s); skipped 0`

| Needle | Count |
|---|---|
| session-token | 20 |
| device-credential | 8 |
| biometric-token | 8 |
| database-locator | 8 |
| camera-credential | 54 |
| ingest-secret | 0 |
| TOTAL | 98 in 58 files |

camera-credential: 54 hits in 34 files, the baseline. The baseline was rebuilt from `git show HEAD:<path>` with the scan's own `countIn` (58 files, 98 hits); the per-file, per-needle list is identical to the working tree's tracked files: no new file, none dropped, no count moved. `--tracked` does not read new untracked files, so they were scanned separately with the same `countIn` (105 untracked, not-ignored files; counts and names only, no text printed):

| New (untracked) file | Hits |
|---|---|
| `apps/capture-worker/test/announce_test.c` | ingest-secret = 3 |
| `scripts/hardware-acceptance/test_hw_collectors_host.sh` | database-locator = 2, camera-credential = 1 |

Total 6 hits in 2 new files. Both are test files with synthetic placeholders by the task's account, but the matched text was not inspected; the controller judges whether either must be reworded before the commit (the `.sh` file sits under `scripts/hardware-acceptance/`, where another agent may still be writing). If both enter the commit the tracked camera-credential count becomes 55 in 35 files, ingest-secret 3, database-locator 10.

## Not run

Capture worker e2e, scenario suites that start the worker, emulators, Gradle (as instructed).

## Result

Blocked on 3 failures (F1, F2, F3); every other check green. Nothing was fixed.
