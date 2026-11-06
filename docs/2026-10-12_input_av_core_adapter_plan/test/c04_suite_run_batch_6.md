# c04 - suite run, batch 6 (uncommitted tree on task4/input-av-core-port, on top of 6e6707dd)

Tier 3. Run from the repository root, once each, in the order of the brief. No file changed by the checks (source, tests, snapshots, lockfile). Only writes: git-ignored build outputs under `apps/capture-worker/build` (step 6) and this record. Checked: relay program and hardening, protocol reason members, unassigned selector slots (Core, shared simulator, web, mobile), microphone operations live path, ALSA configuration generator and Linux helper arguments, session pairing, supervisor restart, integration pass I-6. Previous run: `c03_suite_run_batch_4_5.md` (3 failures F1-F3; none recurs).
Logs: scratchpad `tc.log`, `lint.log`, `lint_plain.log`, `cs.log`, `mock.log`, `ws_<name>.log`, `db.log`, `hh.log`, `hs.log`, `make.log`, `make_full.log`, `scan.out`, `scancmp.mjs`, `ss_test.log`.
Command prefix `rtk` on all, except the mobile run (no `rtk`, to get the jest summary) and the second lint run (plain, to see warnings).

## Commands

| # | Command | Sandbox | 1-min load before | Time | Exit | Summary |
|---|---|---|---|---|---|---|
| 1 | `npm run typecheck` | on | 1.09 | 32 s | 0 | all 7 workspace `tsc` runs clean |
| 2 | `npm run lint` | on | ~1.5 | 16 s | 0 | no error, no warning (rtk run and a plain re-run of the same command, both clean) |
| 3a | `npm run test -w @dems/core-server` (unit) | off | 2.15 | 112 s | 0 | Test Files 335 passed (335); Tests 7239 passed (7239) |
| 3b | `npm run test -w @dems/mock-core` | off | 3.05 | 4 s | 0 | Test Files 4 passed; Tests 19 passed |
| 3c | `-w @dems/capture-protocol` | on | - | <1 s | 0 | 1 file; 31 passed |
| 3d | `-w @dems/shared` | on | - | 5 s | 0 | 102 files; 2783 passed |
| 3e | `-w @dems/core-web` | on | - | 73 s | 0 | 172 files; 2404 passed |
| 3f | `-w @dems/transcriber` | on | - | 15 s | 0 | 18 files; 563 passed, 4 skipped (567) |
| 3g | `-w @dems/mobile` (jest, no rtk) | on | 9.30 (other agents) | 153 s | 0 | Test Suites: 281 passed, 281 total; Tests: 3220 passed, 3220 total; Snapshots: 0 |
| 4 | `npm run test:db -- --maxWorkers=2` under `lockf -k -t 1800 .locks/db-migrate.lock` | off | 9.49 | 234 s | 0 | Test Files 181 passed, 3 skipped (184); Tests 2594 passed, 7 skipped (2601) |
| 5a | `npm run test:host-helper` | on | - | 19 s | 0 | Ran 58 tests, OK |
| 5b | `bash scripts/host/test_host_profile_scripts.sh` | on | - | 2 s | 0 | RESULT: 171 passed, 0 failed (shellcheck not installed: skipped, as the script says) |
| 6 | `lockf -k -t 1800 .locks/heavy-host.lock make -C apps/capture-worker` | off | 3.88 | 136 s | 0 | see below |
| 7a | `node --test scripts/secret-scan/` | on | - | <1 s | 0 | tests 5, pass 5, fail 0 |
| 7b | `node scripts/secret-scan/count-only.mjs --tracked` | on | - | <1 s | 1 (hits exist) | see below |

3a, 3b, 4 and 6 ran with the command sandbox off (listen / PostgreSQL / lock directory); `rtk recall` also needed it off; the rest inside it. The sandbox-on runs printed `failed to copy trust settings of system certificate` lines (host noise, not test output). `npm run pg:status` (sandbox off): "OK, running". PostgreSQL was not started, stopped, initialised or reset; no `db:migrate`. The `make` run did not start the worker; no `make e2e`, no fixture, no port bound by hand.

## Databases touched by `test:db`

PostgreSQL 18.4 on 127.0.0.1:4432, helper role `dems_owner`, code under test `dems_app`, run prefix `dems_test_local_tmtfeny3_`. Throw-away templates and clones of that prefix only; stale sweep dropped 0; teardown "dropped 8 database(s) in 219 ms; 0 remain with the run prefix" (one forced drop needed a retry after SQLSTATE 42501 while an autovacuum backend was on the database; the drop then went through). The demo database and the lane databases were not touched; none left.

## Step 6, worker build (rc 0)

Static rules OK, self-test: 58 refusals "refused as required" plus the "accepted as required" control; unit checks hold: announce_test (all 187 checks hold), anchor_test, writer_test, micwatch_test, start_checks, log_test, sink_kill_test (200 kills, violations 0), each with its negative controls failing as required. Relay:

- `relay-check.sh: src/relay: static rules OK (S13-01 Digest only ... )`
- `relay_unit_test: 376 checks passed; the 34 named malformed-input cases of review 06: 34 of 34 pass`
- `relay-asan` (AddressSanitizer + UndefinedBehaviorSanitizer): `relay_unit_test: 376 checks passed; ... 34 of 34 pass`; three negative controls fail as required (case 32: 1 sanitizer report; case 9: 3 failed check lines; case 34 M-2: 6 failed check lines)
- `relay_fuzz`: head 263552, wire 110336, challenge 298304, description 249984, rtp 97792, client 7872, start 221504 inputs, each "no failure"; total `relay_fuzz: 1249344 inputs over 7 entry point(s) in 14.0 s, seed 186: 0 failures`.

## Failures

None.

## Lint warnings

None (c03 had one in `credential-reader.ts:204`; gone).

## Secret scan (count only; counts and names, never matched text)

`--tracked`: `scanned 10644 file(s); skipped 0`; TOTAL 102 in 59 files.

| Needle | Count (working tree, tracked) | Count (HEAD 6e6707dd, same `countIn`) |
|---|---|---|
| session-token | 20 | 20 |
| device-credential | 8 | 8 |
| biometric-token | 8 | 8 |
| database-locator | 8 | 8 |
| camera-credential | 54 (34 files) | 54 (34 files) |
| ingest-secret | 4 (2 files) | 3 (1 file) |

Note on the baseline: `apps/capture-worker/test/announce_test.c` (ingest-secret 3, the known synthetic file) is no longer untracked: commit 6e6707dd contains it, so the "ingest-secret 0" baseline of the brief is now 3 at HEAD. Against HEAD the only per-file difference is one:

- `apps/core-server/src/capture/__tests__/supervisor.test.ts`: HEAD camera-credential=1; working tree camera-credential=1, **ingest-secret=1 (new)**. Matched text not inspected; the controller judges (modified tracked test file, uncommitted).

Camera-credential: 54 hits in 34 files, no file new, none dropped, no count moved.

UNTRACKED files (113 not-ignored, scanned separately with the same `countIn`):

| Untracked file | Hits |
|---|---|
| `scripts/hardware-acceptance/test_hw_collectors_host.sh` | database-locator = 2, camera-credential = 1 (known, judged synthetic) |

No other untracked file has a hit.

## Not run

Capture worker e2e, scenario suites that start the worker, emulators, Gradle (as instructed).

## Result

Complete. Every check exit 0 except the secret scan's expected hits; no failure, no lint warning. One item for the controller: the new ingest-secret hit in `supervisor.test.ts`. Nothing was fixed.
