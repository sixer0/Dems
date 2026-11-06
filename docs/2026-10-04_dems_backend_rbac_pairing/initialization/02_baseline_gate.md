VERDICT: PASS-WITH-NOTES

> **What this verdict covers.** Row 13 measured the baseline completely and changed nothing. Typecheck and lint are green in all four workspaces; the shared, mock-core and mobile tests are green.
> **The baseline test gate is not all green:** `npm run test -w @dems/core-web` exits 1 with **2 failing tests of 438**. Both fail because of the wall clock (date and time of day), not because of any change in this task. They are named and explained in section 6. If the controller's rubric treats any failing baseline test as FAIL, read this verdict as FAIL for the core-web test command only.

| Field | Value |
|---|---|
| Task | 2026-10-04_dems_backend_rbac_pairing, blueprint row 13 (FIRM), phase initialization |
| Agent | verifier |
| Run window | 2026-10-04 01:48:28 to 01:57:50 WIB (UTC+7) |
| Tree | commit `acaff20` plus uncommitted files under `docs/` only |
| Toolchain (from the commands) | node v26.8.2, npm 11.19.1, tsc 6.0.3, vitest 5.0.3, jest 29.7.0, oxlint 1.86.0, eslint 9.39.5 |
| Raw logs | session scratchpad `/private/tmp/claude-501/-Users-gsp-budi-Documents-DEMS/0d71fd65-4a51-4019-9c48-5c92d11bbdaf/scratchpad/row13/` (session-scoped; the lines that matter are quoted below) |

---

## 1. Result at a glance

| Workspace | Typecheck exit | Lint exit | Test exit | Test files / suites | Tests | Runner duration | Against the 2026-10-01 reference |
|---|---|---|---|---|---|---|---|
| `@dems/shared` | 0 | 0 | 0 | 28 passed (28) | 508 passed (508) | 1.97 s | Same (508) |
| `@dems/mock-core` | 0 | 0 | 0 (sandbox bypass; 1 inside the sandbox, EPERM) | 4 passed (4) | 19 passed (19) | 3.73 s | Same (19) |
| `@dems/core-web` | 0 | 0 | **1** | 2 failed, 37 passed (39) | **2 failed, 436 passed (438)** | 33.91 s | Same total (438); **2 now fail** (reference: 438 passed) |
| `@dems/mobile` | 0 | 0 | 0 | 72 passed, 72 total | 833 passed, 833 total | 47.484 s | Same (833, 72 suites) |

Root scripts: `npm run typecheck` exit 0, `npm run lint` exit 0. Root `npm test` was not run as one command (section 9).

---

## 2. Tree state before and after

Command, before (01:48:28 WIB): `git log --oneline -1` and `git status --porcelain`.

```
acaff20 feat: DEMS demo - web console, mobile app, shared simulator, packaging
 M docs/2026-09-30_dems_demo_stack_setup/decisions/decisions.md
 M docs/2026-09-30_dems_demo_stack_setup/delegation_progress_report.md
 M docs/2026-09-30_dems_demo_stack_setup/status_tasks.md
?? docs/2026-09-30_dems_demo_stack_setup/delegation_progress/git_specialist_step_66.md
?? docs/2026-09-30_dems_demo_stack_setup/report/
?? docs/2026-10-04_dems_backend_rbac_pairing/
```

`git rev-parse HEAD` = `acaff203288d4d7b4ad1e744b1aff8716817c52c` (before and after).

After (01:55:58 WIB, and again at 01:57:50 after the last command): the same six lines. `diff status_before.txt status_after.txt` printed nothing (`IDENTICAL`).

| Check | Before | After | Result |
|---|---|---|---|
| `git status --porcelain` | 6 lines above | Same 6 lines (checked again at 02:00:40, after this row's two files were written) | Identical |
| `git status --porcelain --untracked-files=all \| grep -v ' docs/'` | 0 lines | 0 lines | No tracked or untracked non-ignored file outside `docs/` changed |
| `git diff \| shasum -a 256` (content of the modified tracked files) | `f64cd9a3…c7ef88b` | `f64cd9a3…c7ef88b` | Identical |
| `git status --porcelain --untracked-files=all` | 26 lines | 31 lines | 5 new files, all under this task's `docs/` folder and written by other agents (`delegation_progress/data_collector_step_6.md`, `explore_step_1.md`, `explore_step_4.md`, `research/01d_explore_mobile.md`, `research/02c_collection_server_runtime.md`). This row's two files were written after the snapshot |
| Ignored paths (`git status --porcelain --ignored`, `!!` lines) | 23 | 26 | 3 new ignored `.DS_Store` files (note N-7) |
| `*.tsbuildinfo` outside `node_modules` | none | none | `tsc -b` writes only `apps/core-web/node_modules/.tmp/*.tsbuildinfo` (ignored) |

---

## 3. Typecheck

Command per workspace: `npm run typecheck -w <workspace>`.

| Workspace | Script (echoed by npm) | Exit | Wall |
|---|---|---|---|
| `@dems/shared` | `tsc --noEmit` | 0 | 2 s |
| `@dems/mock-core` | `tsc --noEmit` | 0 | under 1 s |
| `@dems/core-web` | `tsc -b` | 0 | 8 s |
| `@dems/mobile` | `tsc --noEmit` | 0 | 4 s |

Root: `npm run typecheck` printed the four scripts in the order shared, core-web, mobile, mock-core and ended with **exit 0** (14 s).

The check is not empty (extra read-only runs of the same compiler):

| Workspace | Command | Output |
|---|---|---|
| shared | `tsc -p packages/shared/tsconfig.json --noEmit --extendedDiagnostics` | `Files: 767`, `Lines of TypeScript: 34537`, `Check time: 0.54s`, exit 0 |
| mock-core | same with `apps/mock-core` | `Files: 509`, `Lines of TypeScript: 4462`, `Check time: 0.30s`, exit 0 |
| mobile | same with `apps/mobile` | `Files: 2662`, `Lines of TypeScript: 82235`, `Check time: 2.21s`, exit 0 |
| core-web | `tsc -b apps/core-web/tsconfig.json --verbose` | Both projects reported `is out of date because output file … does not exist` and were built (`tsconfig.app.json`, `tsconfig.node.json`), exit 0. With `noEmit: true` the build runs the full check every time; no `.js` file was emitted |

---

## 4. Lint

Command per workspace: `npm run lint -w <workspace>`.

| Workspace | Script (echoed by npm) | Exit | Wall | Output |
|---|---|---|---|---|
| `@dems/shared` | `oxlint` | 0 | under 1 s | none |
| `@dems/mock-core` | `oxlint` | 0 | under 1 s | none |
| `@dems/core-web` | `oxlint` | 0 | 1 s | none |
| `@dems/mobile` | `eslint .` | 0 | 9 s | none |

Root: `npm run lint` ended with **exit 0** (9 s).

oxlint 1.86.0 and eslint print nothing when there is nothing to report. To show that files were really linted, the same linters were run once more with a JSON reporter (`npm exec -w <workspace> -- oxlint -f json`, `npm exec -w @dems/mobile -- eslint . --format json`):

| Workspace | Files linted | Rules | Diagnostics | Exit |
|---|---|---|---|---|
| shared | 115 | 96 | 0 | 0 |
| mock-core | 11 | 96 | 0 | 0 |
| core-web | 343 | 116 | 0 | 0 |
| mobile | 427 | not reported by eslint | 0 errors, 0 warnings, 0 fatal | 0 |

---

## 5. Tests (two workers at most, one workspace at a time)

The flag reached each runner: npm echoed `vitest run --maxWorkers=2` and `jest --maxWorkers=2`.

### 5.1 `@dems/shared`: `npm run test -w @dems/shared -- --maxWorkers=2`, exit 0

```
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/packages/shared
 Test Files  28 passed (28)
      Tests  508 passed (508)
   Start at  01:50:12
   Duration  1.97s (tests 51%, import 33%, transform 14%, worker 2%)
```

### 5.2 `@dems/mock-core`: `npm run test -w @dems/mock-core -- --maxWorkers=2`

Run 1, inside the sandbox, **exit 1**. Cause: the sandbox refuses local port binding.

```
Error: listen EPERM: operation not permitted 127.0.0.1
DEMS Web Demo: cannot listen on port 0 (EPERM).
 Test Files  3 failed | 1 passed (4)
      Tests  4 failed | 5 passed | 10 skipped (19)
     Errors  1 error
   Start at  01:50:19
   Duration  5.27s (tests 94%, import 4%, transform 2%)
```

Run 2, the same command **with the sandbox bypass** (the only bypassed command of this row), **exit 0**.

```
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/mock-core
 Test Files  4 passed (4)
      Tests  19 passed (19)
   Start at  01:50:52
   Duration  3.73s (tests 95%, import 3%, transform 2%)
```

- No test was skipped in run 2: ports 4410 and 4411 were free, so the fallback test ran (`lsof -nP -iTCP:4410 -iTCP:4411 -sTCP:LISTEN` printed nothing before and after).
- `pgrep -fl dems-web-launcher` printed nothing before and after: the launcher child processes that the test starts were gone when it ended.
- The four failures of run 1 are sandbox effects, not baseline failures (all pass in run 2):

| Test (file > suite > title) | Symptom inside the sandbox |
|---|---|
| `test/heartbeat.test.ts` > WS /ws heartbeat > binds 127.0.0.1, streams increasing heartbeats and closes clients with 1001 | `listen EPERM` |
| `test/standalone-launcher.test.ts` > standalone launcher: lifecycle > SIGTERM closes WS clients with 1001 and exits 0 | `cannot listen on port 0 (EPERM)` |
| `test/standalone-launcher.test.ts` > standalone launcher: lifecycle > --self-test exits 0 and reports every asset hash; a tampered file exits 1 | `expected 1 to be +0` (launcher exit code) |
| `test/standalone-launcher.test.ts` > standalone launcher: lifecycle > --port is strict when the port is busy | `Test timed out in 5000ms`, with an unhandled `listen EPERM` |

The 10 skipped tests of run 1 belong to two suites whose `beforeAll` failed on the same bind (`standalone launcher: HTTP + WS on one loopback origin`, `WS origin allowlist`).

### 5.3 `@dems/core-web`: `npm run test -w @dems/core-web -- --maxWorkers=2`, **exit 1**

```
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-web
 Test Files  2 failed | 37 passed (39)
      Tests  2 failed | 436 passed (438)
   Start at  01:51:01
   Duration  33.91s (tests 70%, import 13%, environment 11%, setup 4%, transform 2%)
npm error Lifecycle script `test` failed with error:
npm error code 1
```

Neither failure is a timeout. Details in section 6.

### 5.4 `@dems/mobile`: `npm run test -w @dems/mobile -- --maxWorkers=2`, exit 0

```
Test Suites: 72 passed, 72 total
Tests:       833 passed, 833 total
Snapshots:   0 total
Time:        47.484 s
Ran all test suites.
```

Started 01:53:33 WIB, wall 48 s. The log holds 72 `PASS` lines and 0 `FAIL` lines.

---

## 6. Failing tests on the baseline

Both are **pre-existing on the baseline**: no file outside `docs/` differs from commit `acaff20` (section 2), and no row of this task has changed code yet.

| ID | File | Suite > test title | Assertion | Kind |
|---|---|---|---|---|
| F-1 | `apps/core-web/src/test/sim-fetch.test.ts` (line 121) | simAwareFetch: SIMULATED answers > export as SUPERVISOR: 202 with an EVIDENCE_EXPORTED audit row (the demo-data payload) | `AssertionError: expected 404 to be 202` | Assertion; depends on the calendar date |
| F-2 | `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` (line 139) | Storage page (01_specs §14.5.5) > AC-75: the ring shows 20% labelled USED, with "3.2 TB free of 4.0 TB" (after the sweep beat) | Expected `Sealed Evidence7 today`, received `Sealed Evidence5 today` | Assertion; depends on the time of day |

### 6.1 Second run (both runs recorded)

`npm run test -w @dems/core-web -- --maxWorkers=2 src/test/sim-fetch.test.ts src/features/storage/__tests__/storage-page.test.tsx` at 01:51:53 WIB, exit 1, same two failures with the same messages:

```
 Test Files  2 failed (2)
      Tests  2 failed | 22 passed (24)
   Start at  01:51:53
   Duration  3.51s (tests 67%, transform 11%, environment 10%, import 8%, setup 4%)
```

The failures are deterministic at this time, not load noise (`uptime` showed a 1-minute load average of 2.45 to 2.94 during the run; P9 states 10 cores).

### 6.2 Why they fail (read-only diagnosis, no file changed)

**F-1: the test uses an evidence ID that only exists on 2026-10-01.**

- The test exports `DEMO_EVIDENCE_INDEX.apiExamples.evidenceExport.evidenceId`, which is the fixed string `EV-20260930-0004` (`packages/shared/src/demo-data/packages.generated.ts:3697`).
- The simulator builds evidence IDs from the wall clock: `EV-<YYYYMMDD>-<seq>` (`packages/shared/src/sim/dataset.ts:202-203`), and item 4 is placed "one day ago" (`dataset.ts:312-314`, `:512`, `:562`).
- So `EV-20260930-0004` exists only while the WIB date is 2026-10-01. On any other date the lookup misses and the export returns 404 (`packages/shared/src/sim/evidence-actions.ts:148-149`).

**F-2: before about 02:25 WIB fewer than 7 items are "sealed today".**

- Today's seven sessions are scheduled backwards from 25 minutes before now, in slots of at least 20 minutes (`dataset.ts:454-467`). Early in the morning the oldest ones fall on the previous WIB day.
- The source says so: "Before about 02:50 WIB the oldest slots fall on the previous day, so Sealed Today is lower than 7 there (documented edge case)" (`dataset.ts:451-452`). The predecessor logged it as H-32-1, "documented, not tested" (`docs/2026-09-30_dems_demo_stack_setup/implementation/13_sim_engine.md:304`).
- The test hard-codes 7. This run started at 01:51 WIB.

**Evidence 1: the seeding function, called with chosen times** (`node --import tsx <scratchpad>/diag.mts`, which imports `buildHistory` and `startOfWibDay` and writes nothing; exit 0):

| `now` (WIB) | Sealed today | ID of item 4 | `EV-20260930-0004` present |
|---|---|---|---|
| 2026-10-04 00:10 | 0 | `EV-20261003-0004` | no |
| 2026-10-04 01:00 | 2 | `EV-20261003-0004` | no |
| 2026-10-04 01:51 (this run) | 5 | `EV-20261003-0004` | no |
| 2026-10-04 02:00 | 5 | `EV-20261003-0004` | no |
| 2026-10-04 02:20 and 02:24 | 6 | `EV-20261003-0004` | no |
| 2026-10-04 02:25, 02:30, 02:50, 03:00, 07:00, 12:00, 23:59 | 7 | `EV-20261003-0004` | no |
| 2026-10-01 12:00 (predecessor's day) | 7 | `EV-20260930-0004` | **yes** |
| 2026-10-02 12:00 | 7 | `EV-20261001-0004` | no |
| 2026-10-03 12:00 | 7 | `EV-20261002-0004` | no |

The measured threshold is 02:25 WIB; the source comment says "about 02:50".

**Evidence 2: the two test files under a shifted clock** (diagnostic only; a preload in the scratchpad shifts `Date`, passed with `NODE_OPTIONS=--import`; the repository is untouched):

| Clock set to | Result | Runner lines |
|---|---|---|
| 2026-10-01 12:00 WIB | Both pass, exit 0 | `Test Files  2 passed (2)`, `Tests  24 passed (24)`, `Start at  12:00:00` |
| 2026-10-04 12:00 WIB | F-2 passes, F-1 still fails, exit 1 | `Test Files  1 failed \| 1 passed (2)`, `Tests  1 failed \| 23 passed (24)`, `AssertionError: expected 404 to be 202` |

**Conclusion.**

| ID | Fails when | Passes when |
|---|---|---|
| F-1 | The WIB date is not 2026-10-01 (shown for 2026-10-04; the seeding table shows the same for 10-02 and 10-03) | The WIB date is 2026-10-01 |
| F-2 | The suite runs between 00:00 and about 02:25 WIB | Any later time of day |

Not checked: whether other tests become clock-sensitive at other dates or times. At 01:50 to 01:54 WIB the shared (508) and mobile (833) suites passed in full.

---

## 7. Comparison with the predecessor's numbers (2026-10-01)

Reference source: `docs/2026-09-30_dems_demo_stack_setup/verification/01_verification.md:23` and `report/report.md:43-44` ("shared 508, core-web 438, mobile 833 (72 suites), mock-core 19").

| Workspace | Reference | This run | Difference |
|---|---|---|---|
| shared | 508 tests passed | 508 passed (28 files) | None |
| mock-core | 19 tests | 19 passed (4 files) | None in the count. The predecessor's root run showed `18 passed \| 1 skipped (19)`; here all 19 ran |
| core-web | 438 tests passed | 438 tests, **436 passed, 2 failed** (39 files, 2 failed) | Same number of tests; F-1 and F-2 fail today (section 6) |
| mobile | 833 tests, 72 suites | 833 passed, 72 suites | None |

---

## 8. Notes

| ID | Note | Evidence |
|---|---|---|
| N-1 | **Sandbox bypass used once**, for the mock-core test re-run only (port binding). The test binds loopback only: ephemeral ports and 4410/4411, as the row expected. Ports 5173-5175 and 4400 were not used | Section 5.2 |
| N-2 | **The root script does not forward extra arguments.** `npm run typecheck -- --pretty` ran `npm run typecheck --workspaces --if-present --pretty`, printed `npm warn Unknown cli config "--pretty"`, and the workspaces still ran plain `tsc --noEmit`. The root `test` script has the same shape (`package.json:34`), so `npm test -- --maxWorkers=2` from the root does not limit the workers (inferred for `test`; measured for `typecheck`). The per-workspace form used here does forward the flag | `root_forwarding_probe.log`; section 5 |
| N-3 | Every sandboxed run prints `ERROR: failed to copy trust settings of system certificate-25291` many times (240 lines in the core-web log). The bypassed run prints none. It is sandbox noise, not test output (cause not investigated) | `grep -c "trust settings"` per log |
| N-4 | jest ends with "A worker process has failed to exit gracefully and has been force exited…"; the exit code is still 0 | `test_mobile.log:86373` |
| N-5 | No process was left behind: `ps` shows no vitest, jest or launcher process; nothing listens on 4410/4411. All runners were foreground commands that ended on their own, so there was no PID to stop (P7) | `ps -axo pid,etime,command`, `lsof` |
| N-6 | The sandboxed mock-core run left three temporary folders `/tmp/claude-501/dems-launcher-*` (56 KB each, 01:50:20), because its failing tests never reached their clean-up. They are outside the repository and were not removed | `stat`, `du -sh` |
| N-7 | Three ignored `.DS_Store` files appeared during the window (`packages/shared/` 01:50:17, `packages/` 01:50:25, `apps/mock-core/` 01:51:35). No command of this row writes such files; the cause was not determined. They are git-ignored | `git status --porcelain --ignored`, `stat` |
| N-8 | `masterplan/02_plan.md` does not exist yet, so there was no tracking table to update | `ls` of the task folder |

---

## 9. Not done, and limits

- Root `npm test` was not run as a single command. It would need the sandbox bypass for the whole run (mock-core), and the row limits the bypass to the failing command. Since `@dems/core-web` exits 1, the root command cannot exit 0 on this tree at this time (inference from section 5.3, not a measurement).
- No server, emulator, `adb`, build or install was started. No source file was modified. No git write was made.
- F-2 was not re-run after 02:25 WIB with the real clock; its pass at a later time of day is shown only under the shifted clock (section 6.2).
- The diagnosis in section 6.2 explains the two failures; no fix was attempted.

---

## 10. Commands run (complete list, in order)

| # | Command | Sandbox | Exit |
|---|---|---|---|
| 1 | `git log --oneline -1`, `git rev-parse HEAD`, `git status --porcelain` (also `--untracked-files=all`, `--ignored`), `git diff \| shasum -a 256` | in | 0 |
| 2 | `npm run typecheck -w <ws>` for the four workspaces | in | 0, 0, 0, 0 |
| 3 | `tsc -p <ws>/tsconfig.json --noEmit --extendedDiagnostics` (shared, mock-core, mobile); `tsc -b apps/core-web/tsconfig.json --verbose` | in | 0 each |
| 4 | `npm run lint -w <ws>` for the four workspaces | in | 0, 0, 0, 0 |
| 5 | `npm exec -w <ws> -- oxlint -f json` (three workspaces); `npm exec -w @dems/mobile -- eslint . --format json` | in | 0 each |
| 6 | `npm run test -w @dems/shared -- --maxWorkers=2` | in | 0 |
| 7 | `npm run test -w @dems/mock-core -- --maxWorkers=2` | in | 1 (EPERM) |
| 8 | Same as 7, with `lsof` and `pgrep` before and after | **bypass** | 0 |
| 9 | `npm run test -w @dems/core-web -- --maxWorkers=2` | in | 1 |
| 10 | Same as 9, limited to the two failing files | in | 1 |
| 11 | `node --import tsx <scratchpad>/diag.mts` (a first try with the `tsx` CLI failed inside the sandbox on its IPC pipe, `listen EPERM`) | in | 0 |
| 12 | `npm run test -w @dems/mobile -- --maxWorkers=2` | in | 0 |
| 13 | `npm run typecheck` and `npm run lint` from the root | in | 0, 0 |
| 14 | Command 10 twice more with `DEMS_FAKE_NOW` and `NODE_OPTIONS="--import <scratchpad>/fake-clock.mjs"` (diagnostic) | in | 0 (2026-10-01), 1 (2026-10-04 12:00) |
| 15 | The after-snapshots of command 1; `ps`, `lsof`, `stat` checks | in | 0 |
| 16 | `npm run typecheck -- --pretty` (argument forwarding probe, N-2) | in | 0 |

---
*Generated: 2026-10-04 02:00 WIB by verifier (row 13)*
