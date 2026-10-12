# c02 - suite run, batch 3 (uncommitted tree on task4/input-av-core-port, on top of 7969f0fa)

Tier 3. Run from the repository root, no file changed (not source, tests, snapshots or lockfile). Checked: schema set A (schema version 7, operations 97 -> 99), ONVIF session profiles, alias helper files, integration pass I-2. Previous run: `c01_suite_run_batch_1_2.md`.
Logs: scratchpad `tc.log`, `lint.log`, `cs.log`, `mock.log`, `ws_<name>.log`, `db.log`, `hh.log`, `ss.log`, `scan.out`.
Command prefix: `rtk` on typecheck and lint (it prints only the command echo on a clean run).

## Commands

| # | Command | Sandbox | 1-min load before | Time | Exit | Summary |
|---|---|---|---|---|---|---|
| 1 | `npm run typecheck` | on | 5.22 | 34 s | 0 | all 7 workspace `tsc` runs clean |
| 2 | `npm run lint` | on | 5.76 | 17 s | 0 | oxlint x6 + eslint, no findings |
| 3a | `npm run test -w @dems/core-server` (unit project) | off | 4.96 | 110 s | 0 | 325 files passed; 6942 tests passed |
| 3b | `npm run test -w @dems/mock-core` | off | 5.62 | 4 s | 0 | 4 files passed; 19 tests passed |
| 3c | `npm run test -w @dems/capture-protocol` | on | 5.81 | <1 s | 0 | 1 file; 31 passed |
| 3d | `npm run test -w @dems/shared` | on | - | 6 s | 0 | 102 files; 2697 passed |
| 3e | `npm run test -w @dems/core-web` | on | - | 96 s | 0 | 172 files; 2367 passed |
| 3f | `npm run test -w @dems/transcriber` | on | - | 16 s | 0 | 18 files; 563 passed, 4 skipped |
| 3g | `npm run test -w @dems/mobile` (jest) | on | - | 257 s | 0 | 281 suites; 3166 tests passed |
| 4 | `npm run test:db -- --maxWorkers=2` under `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock` | off | 7.33 | 219 s | 0 | 179 files passed, 3 skipped; 2522 tests passed, 7 skipped |
| 5 | `npm run test:host-helper` | on | 5.02 | 18 s | 0 | Ran 58 tests, OK |
| 6a | `node --test scripts/secret-scan/` | on | ~5 | 1 s | 0 | 5 tests, 5 pass, 0 fail |
| 6b | `node scripts/secret-scan/count-only.mjs --tracked` | on | ~5 | <1 s | 1 (hits exist, as at baseline) | see below |

3c-3g ran one after another in one shell loop; the 1-minute load before 3g was not sampled, it read 15.81 right after 3g ended (the mobile jest run). Before step 4 the run waited until the 1-minute load was below 8 (it read 7.33 at start).

`npm run pg:status`: inside the sandbox it printed "running by PID and files; the connection checks could not run from this process"; with the sandbox off it printed "OK, running". PostgreSQL was not started, stopped, initialised or reset.

## Databases touched by `test:db`

From its own output: PostgreSQL 18.4 on 127.0.0.1:4432, helper role `dems_owner`, code under test `dems_app`, run prefix `dems_test_local_tmt1udc9_`. The suite built its own throw-away templates (`..._tpl_schema`, `..._tpl_seed`, `..._tpl_bulk`) and clones, and its teardown dropped 8 databases, "0 remain with the run prefix". One forced drop needed a retry (SQLSTATE 42501 while an autovacuum worker was on the database; the drop then went through). No `db:migrate` was run; the demo database and the lane databases were not touched by this run.

## Failures

None. Every check exited 0 except the secret-scan count (exit 1 by design when any needle hits; unchanged from baseline).

Change against c01: the one genuine failure of c01 (`apps/core-server/test/static/search-path.test.ts`, "Temporary" in `src/db/fixtures/operations.ts`) no longer occurs; the core-server unit project is 325 of 325 files green, and the sandbox-off run was done up front for core-server and mock-core, so no `listen EPERM` failure appeared.

## Secret scan (count only, tracked tree, working-tree content)

`scanned 10506 file(s); skipped 0`

| Needle | Count |
|---|---|
| session-token | 20 |
| device-credential | 8 |
| biometric-token | 8 |
| database-locator | 8 |
| camera-credential | 54 |
| ingest-secret | 0 |
| TOTAL | 98 in 58 files |

camera-credential: 54 hits in 34 files, the same as the baseline (54 in 34). The baseline list was rebuilt for commit 7969f0fa from `git show HEAD:<path>` with the scan's own `countIn`; the per-file list of all six needles (58 files, 98 hits) is identical to the working tree's, so there is no new file, no file that dropped out, and no count moved. Matched text was never printed or stored; only counts and file names.

## Not run

Capture worker e2e, scenario suites, emulators, Gradle (as instructed).

## Result

Complete. All checks green on the uncommitted tree; secret-scan counts unchanged from the baseline.
