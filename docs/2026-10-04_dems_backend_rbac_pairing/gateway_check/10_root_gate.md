---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W89 (blueprint 104) - GATE: root
agent: verifier (tier R)
date: 2026-10-07
source_plan: masterplan/02_plan.md row W89 (line 768), section 11.2 (gate commands), section 11.3 (ledger rules)
ledger: decisions/decisions.md D238
status: needs-review
narrative_tier: 3
---

# W89 - Root gate (section 11.2): PostgreSQL stopped, then `test:db` with it started

## 1. Verdict

**needs-review: everything passes except one point.** Every gate command meets or matches the D238 ledger, and `npm run test:db` exits 0 with PostgreSQL started. The one exception is the literal AC-B-58 check: root `npm test` with PostgreSQL stopped exited **1** in its single run.

- **Why it failed.** Two `@dems/mobile` tests hit the jest 5,000 ms timeout.
- **Load at the time.** The root script runs jest with no worker limit (GR-3), and load climbed to **16.73**. That is above the 14 pause threshold, even though the load check just before the run read 3.33.
- **Re-runs.** Each failing file passed when re-run alone right away (9/9 and 5/5). Both files also passed inside the per-workspace mobile run with `--maxWorkers=2` (181/181 suites, 1,932/1,932 tests).
- **Classification.** Under the brief's rule both are **flakes** that depend on load. They are not functional failures.

The controller needs to decide one thing: accept the flake record for AC-B-58, or order one more root `npm test` run at low load. Per D232/D233 I did not repeat it on my own.

## 2. Environment

| Item | Value | Evidence |
|---|---|---|
| Repo, HEAD | `/Users/gsp-budi/Documents/DEMS`, `057fc17` (working tree has 633 porcelain entries) | `git rev-parse --short HEAD`; `git status --porcelain \| wc -l` |
| Host | macOS 27.0.1 (Darwin 27.0.0), Node v26.8.2, npm 11.19.1, Vitest 5.0.3, jest 29.7.0 | `sw_vers`, `node -v`, `npm -v`, run headers |
| Start time, load | 2026-10-07 05:10:42 WIB, load 2.45 | `10_root_01_ports_before.log` |
| Ports before (step 1) | 4400, 4410, 4411, 4420-4423, 5173, 5176-5178 and 8081 all **free**; 4432 held by `postgres 19121 127.0.0.1:4432` | `assets/10_root_01_ports_before.log` |
| Sandbox | The PostgreSQL scripts, the mock-core suite, root `npm test` (it includes mock-core) and `test:db` ran outside the sandbox. In the sandbox the connection probe returns `connect probe: error:EPERM` and pg:status exits 2 (`10_root_02_pg_status_initial.log`). Typecheck, lint, shared, core-web, mobile, core-server unit and pg-scripts ran inside the sandbox | logs 02, 07, 10, 17 |
| Tracked files | Not modified. The `git status --porcelain` md5 is `9154ddad6702070334c7f8e2ba198cc4` both before the gate (05:11) and after it (05:24). No `*.tsbuildinfo` is tracked (`git ls-files \| grep -c tsbuildinfo` = 0) | shell output |
| Credentials | No credential file was printed, staged or passed as an argument. The logs mention `.data/pg.pwfile` only in pg:status's file-mode line (`600  .data/pg.pwfile`). A grep for `PASSWORD=` and for a URL carrying a password in `10_root_*` found nothing (rc=1) | shell output |
| Host PostgreSQL on 5432 | Not touched. Only the repo's `npm run pg:*` scripts were used, against 127.0.0.1:4432 | logs 03, 15 |

## 3. pg:status lines, before and after

| Moment | Lines (verbatim) | Exit | Log |
|---|---|---|---|
| Before stop | `server     RUNNING, PID 19121 (postmaster.pid: 127.0.0.1:4432, status "ready", connect probe: open)` / `HA-4 PASS \| a connection as dems_app with a wrong password: SQLSTATE 28P01` / `pg:status: OK, running` | 0 | `10_root_02_pg_status_before_stop.log` |
| `npm run pg:stop` | `pg:stop: stopped PID 19121; 127.0.0.1:4432 is free` | 0 | `10_root_03_pg_stop.log` |
| Stopped (step 2) | `server     NOT RUNNING. Start it with "npm run pg:start".` / `HA-4 not run (the server is stopped)` / `pg:status: stopped (file checks passed)`. `lsof -iTCP:4432 -sTCP:LISTEN` rc=1, also re-checked just before pg-scripts | 3 | `10_root_04_pg_status_stopped.log` |
| `npm run pg:start` | `pg:start: started, PID 48897, listening on 127.0.0.1:4432 (TCP only, no Unix socket)` | 0 | `10_root_15_pg_start.log` |
| Started (step 4) | `server     RUNNING, PID 48897 (postmaster.pid: 127.0.0.1:4432, status "ready", connect probe: open)` / `HA-4 PASS ...` / `pg:status: OK, running` | 0 | `10_root_16_pg_status_started.log` |
| Final (after test:db) | Same as "Started": PID 48897, `pg:status: OK, running`. HA-1 to HA-4 PASS | 0 | `10_root_18_pg_status_final.log` |

## 4. Gate table

Phase A ran with PostgreSQL **stopped** (05:11 to 05:22). Phase B ran with it **started** (05:22 to 05:24). Every count is quoted verbatim from its log; `assets/10_root_20_count_lines.txt` has the extracted lines with log line numbers.

| # | Command | Exit | Count (verbatim) | Ledger (D238) | Result | Load before |
|---|---|--:|---|---|---|---|
| A1 | `npm run typecheck` (root, 5 workspaces) | 0 | `npm run typecheck  38.80s user ... 25.012 total` | exit 0 | PASS | 2.22 |
| A2 | `npm run lint` (root; oxlint x4, eslint for mobile) | 0 | no diagnostics printed; `12.956 total` | exit 0 | PASS | 2.91 |
| A3 | `npm test` (root, no worker limit) | **1** | shared `Test Files  70 passed (70)` / `Tests  1848 passed (1848)`; core-server unit `155 passed (155)` / `3926 passed (3926)`; core-web `111 passed (111)` / `1436 passed (1436)`; **mobile `Test Suites: 2 failed, 179 passed, 181 total` / `Tests:       2 failed, 1930 passed, 1932 total`**; mock-core `4 passed (4)` / `19 passed (19)` | exit 0 | **FAIL (flake, see section 5)** | 3.33 (peaked at 16.73 during the run) |
| A3-r1 | `npx jest src/features/session-new/live-session-new-followups.test.tsx` (in `apps/mobile`, alone, immediately after) | 0 | `Test Suites: 1 passed, 1 total` / `Tests:       9 passed, 9 total` | - | PASS (flake confirmed) | 12.50 |
| A3-r2 | `npx jest src/features/more/more-live.test.tsx` (alone, immediately after) | 0 | `Test Suites: 1 passed, 1 total` / `Tests:       5 passed, 5 total` | - | PASS (flake confirmed) | 11.66 |
| A4 | `npm run test -w @dems/shared -- --maxWorkers=2` | 0 | `Test Files  70 passed (70)` / `Tests  1848 passed (1848)` | 70 / 1,848 | PASS (equal) | 10.73 |
| A5 | `npm run test -w @dems/mock-core -- --maxWorkers=2` (outside the sandbox) | 0 | `Test Files  4 passed (4)` / `Tests  19 passed (19)` | 19 (baseline 4 files) | PASS (equal) | 9.36 |
| A6 | `npm run test -w @dems/core-web -- --maxWorkers=2` | 0 | `Test Files  111 passed (111)` / `Tests  1436 passed (1436)` | 111 / 1,436 | PASS (equal) | 8.23 |
| A7 | `npm run test -w @dems/mobile -- --maxWorkers=2` | 0 | `Test Suites: 181 passed, 181 total` / `Tests:       1932 passed, 1932 total` | 181 / 1,932 | PASS (equal) | 4.73 |
| A8 | `npm run test -w @dems/core-server -- --maxWorkers=2` (project `unit`) | 0 | `Test Files  155 passed (155)` / `Tests  3926 passed (3926)` | 155 / 3,926 | PASS (equal) | 4.89 |
| A9 | `npm run test:pg-scripts` | 0 | `ℹ tests 57` / `ℹ pass 57` / `ℹ fail 0` | 57 | PASS (equal) | 5.92 |
| B1 | `npm run test:db` (project `db`, PostgreSQL started, outside the sandbox) | 0 | `Test Files  124 passed (124)` / `Tests  1751 passed (1751)` | 124 / 1,751 | PASS (equal) | 5.30 |

All counts equal the ledger, so the L-4 "above the ledger" correction does not apply.

D195 C2-R1: `apps/core-server/test/db/pg-behaviours.db.test.ts` is among the 124 db files and passed on the running cluster, which has the old settings. That matches the routing of its adaptation into W90.

L-6: all 61 simulator-dependent files pass in A6 and A7, since both workspaces are fully green. I did not run a diff of those files against `acaff20` because the brief did not ask for it.

## 5. Failures and owners

| Run | File / test | Symptom | Re-run alone | Owner (row / file) |
|---|---|---|---|---|
| A3 | `apps/mobile/src/features/session-new/live-session-new-followups.test.tsx:166`: "a confirmed cancel (answer-first): "Keep session" is disabled and does not close the dialog while the cancel is out; the wizard leaves on the Core's answer" | `thrown: "Exceeded timeout of 5000 ms for a test."` (file took 26.835 s). The test sets `b.answerDelayMs = 1_000` and runs on real time, so under load 16.7 it goes past jest's default 5 s | PASS 9/9 (A3-r1); also PASS inside A7 | Row **M1** wrote the F5 tests (`delegation_progress/coder_execution_m1.md:48`; `gateway_check/09b_m1_mobile_consolidation.md:119`). The uncommitted diff on the file (+5/-3) is the copy round's import change (`gateway_check/08c_copy_round.md:234`). Inference: the copy round did not touch the timing |
| A3 | `apps/mobile/src/features/more/more-live.test.tsx:76`: "the footer reads "Core Live" and names the Core server as the source of the data; nothing claims a simulation, in any layout class" | `thrown: "Exceeded timeout of 5000 ms for a test."` (file took 36.054 s). It loops over every layout class in one test | PASS 5/5 (A3-r2); also PASS inside A7 | Row **W66** (step 88): `delegation_progress/coder_execution_step_88.md:12`; `implementation/66_mobile_home_more.md:157` |

Also observed, non-blocking: jest printed "A worker process has failed to exit gracefully and has been force exited" once in A3 and once in A7, which points to a teardown leak somewhere in mobile. Neither run failed because of it. I am not assigning an owner because jest does not name the file.

Proposal, not applied (no code changes in this row): to make AC-B-58 robust, give these two tests an explicit timeout, or use fake timers for the 1 s answer delay. Another option is to run root `npm test` only at low load. The owners above would decide which. One open question: whether this is in scope before W90, or whether it belongs to the mobile code review (W93).

## 6. Deviations and notes

- **Load threshold.** I checked `uptime` before every heavy suite (column "Load before"). Load was below 14 at every start. During A3 it rose to 16.73, because the root script hands jest and Vitest all cores. I did not start another suite until it was back under 14 (wait loop; 13.24 at 05:16).
- **Plan tracking not edited.** The brief forbids editing tracked files outside the report, its assets, the progress file and one row in `delegation_progress_report.md`. So the row status of W89 in `masterplan/02_plan.md` is left to the controller.
- **Logs are git-ignored.** The `10_root_*.log` files match `.gitignore:48 *.log`, and two of them are about 22 MB of mobile console output. The verbatim count lines are copied into `assets/10_root_20_count_lines.txt` so they can be tracked.

## 7. Final state

- PostgreSQL is **STARTED**: PID 48897 on `127.0.0.1:4432`, `pg:status: OK, running`, HA-1 to HA-4 PASS (`10_root_18_pg_status_final.log`). Ready for W90.
- Ports 4400, 4410, 4411, 4420-4423, 5173, 5176-5178 and 8081 are free (`10_root_19_ports_after.log`).
- No Core server, Vite, Metro or emulator was started or touched.

## 8. Evidence files (`gateway_check/assets/`)

`10_root_01_ports_before.log`, `10_root_02_pg_status_initial.log` (inside the sandbox, EPERM), `10_root_02_pg_status_before_stop.log`, `10_root_03_pg_stop.log`, `10_root_04_pg_status_stopped.log`, `10_root_05_typecheck.log`, `10_root_06_lint.log`, `10_root_07_npm_test_root.log`, `10_root_08_rerun_mobile_live-session-new-followups.log`, `10_root_08_rerun_mobile_more-live.log`, `10_root_09_shared.log`, `10_root_10_mock_core.log`, `10_root_11_core_web.log`, `10_root_12_mobile.log`, `10_root_13_core_server_unit.log`, `10_root_14_pg_scripts.log`, `10_root_15_pg_start.log`, `10_root_16_pg_status_started.log`, `10_root_17_test_db.log`, `10_root_18_pg_status_final.log`, `10_root_19_ports_after.log`, `10_root_20_count_lines.txt`.

---
*Generated: 2026-10-07 05:25 WIB*
