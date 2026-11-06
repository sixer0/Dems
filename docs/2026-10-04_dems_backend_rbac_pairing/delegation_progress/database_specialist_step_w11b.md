---
task_id: 2026-10-04_dems_backend_rbac_pairing
plan_row: W11b (controller row; follow-up to W11, step 33)
agent: database-specialist (tier R)
date: 2026-10-04
status: complete
artifact: implementation/11b_db_helper_forced_drop_retry.md
---

# Row W11b: the test helper's forced drop, refused while an autovacuum worker is on the database

Times are WIB. No credential value appears in this file.

## Status

**complete.** The cause is reproduced, the fix is in the helper's drop and nowhere else, the
helper's tests, the typecheck, the lint and one whole `db` run pass, and no database of the row
remains. Detail and quoted output: `implementation/11b_db_helper_forced_drop_retry.md`.

## Milestones

| Time | What |
|---|---|
| 11:53 to 12:02 | Read the protocol, the helper, its document, the two rows' findings and the decisions; read the refusals out of the server log (lines of the refusal and of the statement only) |
| 12:02 | Controller note received: the reset row measured the cause for 11:22:56; consider a plain drop first; the teardown must not say "0 remain" while one remains |
| 12:03:02 to 12:03:27 | **Reproduced**: with an autovacuum worker on the database the forced drop by `dems_owner` gives `42501`; the plain drop goes through and the server log names the same process as an autovacuum process. Measured what `dems_owner` sees of a `dems_app` session and of a worker |
| 12:04:54 to 12:06:24 | Measured the plain drop: 5 s to refuse when a session is connected; the forced drop after it refused in 4 of 9 trials; the waiter for the database lock seen in `pg_locks` |
| 12:10 to 12:22 | The change, on a copy outside the repository: typecheck and lint exit 0; `unit` 8 files, 239 tests |
| 12:22:31 to 12:26:39 | The copy against PostgreSQL: `db` 11 files, 59 tests, three runs (two at once), exit 0 |
| 12:23:26 to 12:25:42 | The changed helper against a real autovacuum worker: `database.drop()` went through after 7 and 8 refusals; the owner of the run counted both |
| 12:27:46 | Pre-image taken (`.cache/rollback/W11b.pre.patch`, `.cache/rollback/W11b.pre/`), checked |
| **12:27:53** | **Applied in one command**: ten files (7 changed, 3 new) under `apps/core-server/test/helpers/db/` |
| 12:28:04 to 12:29:26 | In the repository: row command exit 0 (11 files, 59 tests); helper `unit` exit 0 (8 files, 239); typecheck exit 0; lint exit 0; whole `db` exit 0 (45 files, 623 tests); whole `unit` exit 0 (70 files, 1,848) |
| 12:32 | Mutations: 9 of 9 caught |
| 12:33:56, 12:35:23 | In a run of another row (label step 48) two forced drops were refused once each and went through at the next attempt: the fix at work (server log; artifact section 6.7) |
| 12:37:35 to 12:37:59 | Leak check: 312 files, 0 hold a credential value. Row command once more: exit 0. End state: no database of the row, PID 19121, settings digest unchanged |

## Files created or updated

Changed (7), all under `apps/core-server/test/helpers/db/`: `constants.ts`, `errors.ts`, `ddl.ts`,
`run.ts`, `session.ts`, `global-setup.ts`, `testing/fake-cluster.ts`.

New (3), same folder: `testing/refusing-driver.ts`, `__tests__/drop-retry.test.ts`,
`__tests__/drop-retry.db.test.ts`.

Documents: `implementation/11b_db_helper_forced_drop_retry.md`, this file, and 21 evidence files
`implementation/assets/11b_*` (the diff `11b_helper.diff`; four diagnosis scripts and their
output; the server-log lines; the test, typecheck and lint output; the mutations; the end state).

Rollback material, git-ignored: `.cache/rollback/W11b.pre.patch`, `.cache/rollback/W11b.pre/`
(seven files), `.cache/rollback/W11b.post.patch`.

Not edited, on purpose: `apps/core-server/test/global-setup.db.ts` (the summary line is printed by
`helpers/db/global-setup.ts`), every existing test file of the helper, `names.ts` (the guards),
anything outside `test/helpers/db/`, `implementation/11_db_test_helper.md`,
`masterplan/02_plan.md` (it has no row W11b), `delegation_progress_report.md`, `status_tasks.md`,
`decisions/decisions.md`.

## Verification (quoted in the artifact)

| Check | Result |
|---|---|
| `DEMS_TEST_STEP=33b npm run test:db -w @dems/core-server -- test/helpers/db` | Exit 0: 11 files, 59 tests (12:28:04) |
| `npm run test -w @dems/core-server -- --maxWorkers=2 test/helpers/db` | Exit 0: 8 files, 239 tests (12:28:18) |
| `npm run typecheck -w @dems/core-server` | Exit 0 (12:28:19) |
| `npm run lint -w @dems/core-server` | Exit 0 (12:28:22); two warnings in `src/plugins/readiness/__tests__/readiness.test.ts`, a file of a row in flight |
| Whole `db` project | Exit 0: 45 files, 623 tests; `[test:db] forced drops that needed a retry: 0`; no failure of another row in this run |
| Whole `unit` project | Exit 0: 70 files, 1,848 tests |
| What `dems_owner` sees of a foreign backend | `datid`, `datname`, `pid`, `usesysid`, `usename`, `application_name`; nothing else |
| Diagnosis | Reproduced: an autovacuum worker |
| Databases with the prefix `dems_test_step_33b` | 0 |
| PostgreSQL | PID 19121, started 07:14:26; roles and settings unchanged |

## Findings (for the controller to record)

1. The blocker is an autovacuum worker; `dems_owner` sees it as a backend with a database and no
   role. `backend_type` is not visible to it for any backend it does not own.
2. A plain drop takes 5 s to refuse when a session is on the database, and the forced drop after
   it is refused in 4 of 9 trials: a worker queues behind the database lock meanwhile.
3. The refusal hit other rows' runs six times between 10:45 and 12:20 (three times while this row
   worked). After the change it happened twice more in a run of another row (12:33:56, 12:35:23)
   and the retry absorbed both.
4. `apps/core-server/` is untracked: the P23 command prints nothing for it.
5. Every `test:db` run prints one more line before the `teardown:` line.
6. The bulk-fixture row's own drop retry and the reset row's "plain drop first" in its tests are
   no longer needed for this cause.
7. Each run of the new database test adds one deliberate refusal to the server log.

## Deviations

1. A notification channel (`LISTEN` in the owner's session, `pg_notify` from a test file's
   session) carries the count to the summary line; the row text names the drop only.
2. One new error code, `DROP_REFUSED`; two additions to the helper's seams (`RunOptions.dropRetry`,
   the exported driver factory).
3. The message of the existing `SESSIONS_REMAIN` refusal now also names the application.
4. The pre-image is not the output of the P23 command (finding 4).
5. Two read-only commands contained `cd` to the workspace root itself (not a subfolder).
6. The reset row's read-only scratch script was run once, for a comparable settings digest.
7. `implementation/99_implementation_report.md` and the plan's tracking table were not written
   (parallel run; no plan row).

## Decisions needed

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | The notification channel for the count | Accept |
| DN-2 | The bound of 20 attempts, 250 ms apart | Keep; raise the one constant if a run reports about 10 refusals for one drop |
| DN-3 | The plain form | Not used; it is the next step only if DN-2 fires |
| DN-4 | The two rows' own work-arounds | Leave; their owners may remove them |
| DN-5 | `11_db_test_helper.md` sections 6, 7, 11 | Amend at the next document slot |
| DN-6 | F54, F58 | Close |
| DN-7 | The extra output line | Into the briefs of rows that quote `test:db` output |
| DN-8 | P23 for untracked paths | Say that a row saves copies |

## Blockers

None.

---

## Follow-up: test limits under load (decision D110) and the stopped run (decision D111)

2026-10-04, 17:44 to 18:21 WIB; test label `33c`. Detail and quoted output:
`implementation/11b_db_helper_forced_drop_retry.md` section 14.

### Status

**complete.**

### Milestones

| Time | What |
|---|---|
| 17:44 to 17:48 | Read D76, D89, D110 and the three recorded time-outs (`assets/36_final_runs.log`, `test/assets/06_whole_db_1725.log`); found the helper folder changed in one test file by the checkpoint round CP-B1 (by design, kept) |
| 17:48:53 | Helper `unit` tests with per-test durations: 239 tests, 487 ms in all, slowest 94 ms |
| 17:49:05 to 17:49:40 | Helper `db` tests, three runs before any change: 59 of 59 each |
| 17:51:40 | Probe outside the tree: the limits line takes effect for a test, a hook and a suite defined by an imported module; the controls fail at 5 s and 10 s |
| 17:53:10 to 17:56:33 | Unchanged and changed copy run alternately, two workers and one worker, three runs each: no file slower with one worker (sum of medians +0.3 %) |
| **17:57:02** | **Limits applied in one command**: 14 files (11 test files, 3 nested-run fixtures) |
| 17:57:14 to 17:59:28 | In the repository: helper `db` 11 files / 59, helper `unit` 8 files / 239, typecheck and lint exit 0, whole `db` 108 files / 1,540 passed, 1 skipped, exit 0; a probe beside it measured the wait for the clone lock (longest 1,396 ms) |
| 18:02 | Controller addition D111 received |
| 18:03:51 | The run `dems_test_step_64m_tmdoqjg5_*` shown dead: liveness lock free, no backend on its three databases, no Vitest process |
| 18:05 to 18:11 | `TestRun.dropDeadRun` built and proven on the copy outside the tree: `unit` 9 files / 308, `db` 12 files / 66 (three runs, two at once), 11 of 11 mutations caught |
| **18:12:00** | **The entry applied in one command**: 4 helper files changed, 2 test files new |
| 18:12:10 to 18:12:26 | In the repository: helper `db` 12 files / 66 exit 0; helper `unit` 9 files / 308 exit 0; typecheck exit 0; lint exit 0 |
| **18:13:12** | **The three databases of the stopped run removed through the entry**: 3 dropped, 0 remain; `pg_database` 7 rows |
| 18:13:25 to 18:15:23 | Whole `db`, two workers: 109 files, 1,547 passed, 1 skipped, exit 0. Whole `unit`: 142 files, 3,678 tests, exit 0 |
| 18:15:32 | End state: no database of the prefix 33c; PID 19121; settings digest unchanged; one live run of another row (step 74), untouched |

### Files created or updated

Under `apps/core-server/test/helpers/db/`:

- Limits (14 files, one line and its comment each): `__tests__/cleanup.db.test.ts`,
  `clone-lock.db.test.ts` (also `TEST_TIMEOUT_MS` 60 s to 120 s), `drop-retry.db.test.ts`,
  `global-setup.db.test.ts`, `guards.db.test.ts`, `isolation-a.db.test.ts`,
  `isolation-b.db.test.ts`, `nested-run.db.test.ts`, `sweep.db.test.ts`, `templates.db.test.ts`,
  `timing.db.test.ts`; `selfcheck/convention.selfcheck.ts`, `throwing-hook.selfcheck.ts`,
  `throwing-test.selfcheck.ts`.
- The dead-run entry: changed `run.ts`, `names.ts`, `errors.ts`, `constants.ts`; new
  `__tests__/dead-run.test.ts`, `__tests__/dead-run.db.test.ts`.

Documents: section 14 appended to `implementation/11b_db_helper_forced_drop_retry.md`; this
part of this file; 20 evidence files `implementation/assets/11b_fu_*`.

Rollback material, git-ignored: `.cache/rollback/W11b_followup.pre/` and `.pre.patch` (14
files), `W11b_followup.post.patch`; `W11b_followup2.pre/` and `.pre.patch` (4 files),
`W11b_followup2.post.patch`.

Database change: the three databases `dems_test_step_64m_tmdoqjg5_f01_backpressure`,
`..._tpl_schema`, `..._tpl_seed` were dropped at 18:13:12 (decision D111).

Not edited: `vitest.config.ts`, any `package.json`, `test/support/`, any file outside
`test/helpers/db/`, the shared trackers.

### Verification (quoted in the artifact, section 14.8)

| Check | Result |
|---|---|
| `DEMS_TEST_STEP=33c npm run test:db -w @dems/core-server -- --maxWorkers=2 test/helpers/db` | Exit 0: 12 files, 66 tests (18:12:10) |
| `npm run test -w @dems/core-server -- --maxWorkers=2 test/helpers/db` | Exit 0: 9 files, 308 tests (18:12:21) |
| `npm run typecheck -w @dems/core-server` | Exit 0 |
| `npm run lint -w @dems/core-server` | Exit 0; one warning in `test/acceptance/rbac-matrix.support.ts`, another row's file (18:12:26) |
| Whole `db`, `--maxWorkers=2` | Exit 0: 109 files, 1,547 passed, 1 skipped (another row's pending test); no failure to name (18:13:25) |
| Whole `unit` | Exit 0: 142 files, 3,678 tests (18:14:58) |
| File durations before and after, one worker | Sum of medians 12,261 ms and 12,298 ms; largest difference of one file 65 ms |
| Databases with the prefix `dems_test_step_33c` | 0 |
| PostgreSQL | PID 19121, started 07:14:26; roles and settings unchanged |
| Leak check (18:22:12) | 868 files, 0 hold a credential value |
| Last reading (18:23:17) | `pg_database` 7 rows; no test run with a database |

### Findings

1. The three time-outs were in tests that ask for a template or a clone inside the test body, so
   the wait for the clone lock ran under the default of 5 s. One bulk build holds that lock 1.2
   to 3.5 s (38 runs). That the three events were such waits is a hypothesis: no run recorded it.
2. No bound inside the helper failed a run in any evidence file of any row. No constant changed.
3. The drop retry: 25 real refusals since the fix, each followed by a drop that went through at
   the next attempt, in about 36,200 drops. "7 and 8" were this row's reproduction on
   600,000-row tables.
4. By a text scan, 24 database test files of other rows call the helper for a clone or a
   template in the file and set no limit. One test of `bulk-fixture.db.test.ts` takes 3.1 s on a
   quiet host under the default of 5 s.
5. With two workers, the helper's own tests that hold the clone lock on purpose make a file
   beside them wait about a second.
6. The stale sweep's age rule (six hours) exists because the sweep is unattended and a run can
   be in use while its lock is free; it was not weakened. A named removal proves instead: an
   exact run prefix, a free liveness lock, and no client session of any role, twice.
7. The first diff of the row no longer reverses alone (the follow-up diffs and the checkpoint's
   edit of one test file sit on top).

### Deviations

1. The three nested-run fixtures got the limits too.
2. One existing cap raised (`clone-lock`, 60 s to 120 s).
3. Decision D111 changed helper code, not only tests.
4. The entry is called through a script kept as an asset; no npm script.
5. The process list was read (Vitest processes of this user).

### Decisions needed

| ID | Question | Recommendation |
|---|---|---|
| FU-DN-1 | The 24 files of other rows | Their owners add the line, or the helper sets the limits where `useTestDatabase` is called (it would only raise a limit). Not done: it changes every row's limits |
| FU-DN-2 | The drop retry | Keep 20 attempts at 250 ms |
| FU-DN-3 | An npm script for `dropDeadRun` | One line in the server's `package.json` by its owner |
| FU-DN-4 | Settle time 3 s; "no session of any role" for a named removal | Accept |
| FU-DN-5 | The 3.1 s test of the bulk fixture | Tell its owner |

### Blockers

None.
