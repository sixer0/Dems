# c05 - suite run, batches 7 and 8 (uncommitted tree on task4/input-av-core-port, on top of 3b388746)

Tier 3. Run from the repository root, once each, in the order of the brief, the way `c04_suite_run_batch_6.md` ran them. No file changed by the checks (source, tests, snapshots, lockfile). Only writes: this record. Not run, as instructed: `make -C apps/capture-worker`, the capture worker's e2e or fixtures, scenario suites, emulators, Gradle. No file under `apps/capture-worker` judged. Previous run: c04 (no failure).
Logs: scratchpad `tc.log`, `lint.log`, `lint_plain.log`, `cs.log`, `mock.log`, `ws_<name>.log`, `db.log`, `hh.log`, `hs.log`, `hw_host.log`, `hw_camera.log`, `hw_camera2.log`, `scan.out`, `scancmp.mjs`.
Command prefix `rtk` on typecheck, lint (plus a plain re-run), core-server, mock-core, test:db, test:host-helper. Plain for the other workspaces (jest summary needs it).

## Commands

| # | Command | Sandbox | Exit | Summary |
|---|---|---|---|---|
| 1 | `npm run typecheck` | on | 0 | all 7 workspace `tsc` runs clean |
| 2 | `npm run lint` | on | 0 | no error, no warning (rtk run and plain re-run, both clean; oxlint prints nothing when clean) |
| 3a | `npm run test -w @dems/core-server` (unit) | off | 0 | Test Files 345 passed (345); Tests 7629 passed (7629); 135 s |
| 3b | `-w @dems/mock-core` | off | 0 | Test Files 4 passed (4); Tests 19 passed (19) |
| 3c | `-w @dems/capture-protocol` | off | 0 | 1 file; 31 passed |
| 3d | `-w @dems/shared` | on | 0 | 102 files; 2795 passed |
| 3e | `-w @dems/core-web` | on | 0 | 173 files; 2420 passed |
| 3f | `-w @dems/transcriber` | on | 0 | 18 files; 563 passed, 4 skipped (567) |
| 3g | `-w @dems/mobile` (jest) | on | 0 | Test Suites: 281 passed, 281 total; Tests: 3219 passed, 3219 total; Snapshots: 0 |
| 4 | `npm run test:db -- --maxWorkers=2` under `lockf -k -t 1800 .locks/db-migrate.lock` | off | 0 | Test Files 185 passed, 3 skipped (188); Tests 2799 passed, 7 skipped (2806); 266 s |
| 5a | `npm run test:host-helper` | on | 0 | Ran 58 tests, OK |
| 5b | `bash scripts/host/test_host_profile_scripts.sh` | on | 0 | RESULT: 171 passed, 0 failed (shellcheck not installed: skipped, as the script says) |
| 5c | `bash scripts/hardware-acceptance/test_hw_collectors_host.sh` | on | 0 | RESULT: 637 passed, 0 failed |
| 5d | `bash scripts/hardware-acceptance/test_hw_collectors_camera.sh` | on | 1, then 0 on the second run | run 1: RESULT: 534 passed, 1 failed (see F1); run 2: RESULT: 535 passed, 0 failed |
| 6a | `node --test scripts/secret-scan/` | on | 0 | tests 5, pass 5, fail 0 |
| 6b | `node scripts/secret-scan/count-only.mjs --tracked` | on | 1 (hits exist) | scanned 10728 files; TOTAL 103 in 59 files; see below |

The 1-minute load was 3 to 7 at the start of the core-server run and 19 to 23 after the mobile jest run (emulators of other lanes were running, not stopped by this run); the database suite ran at about 19 and passed. `npm run pg:status`: "OK, running". PostgreSQL was not started, stopped, initialised or reset; no `db:migrate`. Core-server unit tests that start the built relay / guard binaries and the Python test camera ran with the binaries present; none failed for a missing or mid-rebuild binary. 3b, 3c, 4 ran with the command sandbox off (listen / PostgreSQL / lock directory), as did `rtk`-less 3a.

Count notes against c04: core-server 335 -> 345 files, 7239 -> 7629 tests; shared 2783 -> 2795; core-web 172 -> 173 files, 2404 -> 2420; mobile 3220 -> 3219 tests (one fewer, suites 281 both; not investigated, no failure); host-profile 171 same; db 2594 -> 2799 tests.

## Databases touched by `test:db`

PostgreSQL 18.4 on 127.0.0.1:4432, helper role `dems_owner`, code under test `dems_app`, run prefix `dems_test_local_tmttjf80_`. Throw-away templates `..._tpl_schema`, `..._tpl_seed`, `..._tpl_bulk` plus clones of that prefix only; stale sweep dropped 0; teardown: "dropped 8 database(s) in 214 ms; 0 remain with the run prefix". One forced drop needed a retry after SQLSTATE 42501 (autovacuum backend on the database); it then went through. The demo database and the lane databases were not touched; none left. No `CLONE_SLOTS_EXHAUSTED` anywhere in the log.

The two named files (the rtk summary prints no per-file lines; read from the vitest results cache `apps/core-server/node_modules/.vite/vitest/<hash>/results.json`, written by this run at 10:30):

- `src/capture/fence/__tests__/fence.db.test.ts`: failed=false, 12.5 s.
- `src/capture-session/__tests__/session-capture.db.test.ts`: failed=false, 29.3 s.

Both passed; `names.ts` (now `apps/core-server/test/helpers/db/names.ts:186`) did not refuse.

## Failures

F1 (transient, not a defect of the code under test). Workspace: scripts/hardware-acceptance. File: `scripts/hardware-acceptance/test_hw_collectors_camera.sh`, run 1 only. Check: section "7. nothing was written outside the evidence folder; nothing in the package changed", line 443: `expect 'files changed under scripts/hardware-acceptance/: 0 (checksums before and after are equal)' cmp -s "$RUN/manifest.before" "$RUN/manifest.after"`. The manifest (`manifest()` in `test_hw_common.sh:155`) hashes every file of the folder, including the `.md` files; another agent saved `HW-ACCEPTANCE-2-HOST-HELPER-AUDIO.md` at 10:31:38, inside the run (also `HW-ACCEPTANCE-1-FRAME.md` at 10:29:06, before it). Run 2, started at 10:31:58 with the folder quiet, passed all 535 checks. Nothing was fixed. Consequence: the test is fragile against an edit of the folder during a run; it needs a quiet folder.

No other failure. No lint warning.

## Secret scan (count only; counts and names, never matched text)

`--tracked`: `scanned 10728 file(s); skipped 0`; TOTAL 103 in 59 files. Compared with HEAD 3b388746 using the same `countIn` (scratch `scancmp.mjs`: per-file diff of HEAD against the working tree for tracked files, and a separate scan of the 185 not-ignored untracked files).

| Needle | Working tree, tracked | HEAD 3b388746 | Last baseline (brief) |
|---|---|---|---|
| session-token | 20 | 20 | - |
| device-credential | 8 | 8 | - |
| biometric-token | 8 | 8 | - |
| database-locator | 8 | 8 | - |
| camera-credential | 55 (34 files) | 54 (34 files) | 54 in 34 files |
| ingest-secret | 4 (2 files) | 4 (2 files) | 4, tests only |

ingest-secret: `apps/capture-worker/test/announce_test.c` = 3 (known, synthetic), `apps/core-server/src/capture/__tests__/supervisor.test.ts` = 1 (known, synthetic; both committed). No change.

NEW in the tracked tree (one hit, no new file):

- `apps/core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts`: camera-credential 2 at HEAD, 3 in the working tree (modified tracked test file, uncommitted). Matched text not inspected; the controller judges.

UNTRACKED files (185 not-ignored, scanned separately):

| Untracked file | Hits |
|---|---|
| `scripts/hardware-acceptance/test_hw_collectors_host.sh` | database-locator = 2, camera-credential = 1 (known, judged synthetic) |
| `scripts/hardware-acceptance/test_hw_collectors_camera.sh` | camera-credential = 1 (NEW file with a hit, not in the known list; the camera collector test, for the controller to judge) |

No other untracked file has a hit. `apps/input-av/data/` was skipped by the scanners and not opened.

## Result

Complete. Every check exit 0 except: the secret scan's expected hits (exit 1), and the camera collector test, whose first run failed one check because another agent edited a file of the folder during the run; the repeat passed. Items for the controller: camera-credential +1 in `onvif-session.test.ts`; new hit file `test_hw_collectors_camera.sh`. Nothing was fixed.
