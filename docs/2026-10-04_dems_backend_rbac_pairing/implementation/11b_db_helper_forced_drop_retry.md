---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
plan_row: W11b (controller row; follow-up to W11, step 33)
title: The test helper's forced drop, when PostgreSQL refuses it because an autovacuum worker is on the database
date: 2026-10-04
agent: database-specialist (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
amends: implementation/11_db_test_helper.md (how sections 6, 7 and 11 describe the drop of a database)
evidence_tier: 3
status: complete
follow_up: section 14 (decisions D110 and D111), 2026-10-04 17:44 to 18:20 WIB; status complete; section 15 (decision D134, third follow-up of D114), 2026-10-05 16:07 to 16:52 WIB
---

# W11b: the forced drop of the test helper is repeated when a background worker blocks it

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`.
Commands that open a database connection ran with the per-command sandbox bypass (P10, D32); a
first attempt inside the sandbox failed with `EPERM`, as D32 says. Quoted output is unchanged
except where a note says so; lines `ERROR: failed to copy trust settings of system certificate`
(printed by the tool chain inside the sandbox, nothing of this project) are left out. **No
credential value appears in this document or in its assets**: role names, database names, process
numbers, counts, times and SQLSTATEs only.

## 1. Result

| Item | Result |
|---|---|
| Cause | **Reproduced.** The backend that blocks the forced drop is an **autovacuum worker**: `DROP DATABASE ... WITH (FORCE)` by `dems_owner` is refused with SQLSTATE `42501` "permission denied to terminate process" while one is on the database (section 3.2). The process number `dems_owner` saw as "a backend without a role" is the one the server log names as an autovacuum process |
| What `dems_owner` sees of a backend it does not own | `datid`, `datname`, `pid`, `usesysid`, `usename`, `application_name`. Not `backend_type`, not `state`, no time, and the statement reads `<insufficient privilege>`. A worker has **no role** (`usename` NULL); that is what tells it from a client session (section 3.1) |
| The fix | In the helper's drop only (`ddl.ts` `dropDatabase`): on that refusal the helper reads who is on the database. A client session of another role: fails at once and names role and application. Otherwise: waits 250 ms and sends the same statement again, 20 attempts at most; then fails with the last error and with what was on the database (section 4) |
| Order of the statements | **Forced first, as before.** A plain drop first was measured and not chosen: it takes the server 5 s to refuse it when anything is connected, and it makes the forced drop after it fail in 4 of 9 trials (section 3.4) |
| The changed helper against a real autovacuum worker | `database.drop()` went through after 7 and after 8 refusals (1.8 s and 2.1 s) on two databases of 600,000 rows; the owner of the run counted both (section 6.2) |
| One line in the teardown summary | `[test:db] forced drops that needed a retry: <n>`, printed once per run before the `teardown:` line, counting the drops of every test file's process too (section 4.4) |
| "0 remain" while a database remains | Cannot happen: the number is read from `pg_database` after the drops. A database left by a refused drop is tried again by the teardown through the same retry; proven with tests on the stand-in and on the real server (sections 4.5, 5) |
| Helper's own tests | `DEMS_TEST_STEP=33b npm run test:db -w @dems/core-server -- test/helpers/db`: **exit 0, 11 files, 59 tests** (52 as before, 7 new). `unit` tests of the helper: **exit 0, 8 files, 239 tests** (196 as before, 43 new) |
| Existing helper tests | **All 17 files pass unchanged**; no line of an existing test file was edited. Test support `testing/fake-cluster.ts` was extended |
| Guards | Unchanged and still tested: `names.ts` was not touched; `dems_demo`, lanes, `postgres`, the templates of PostgreSQL and other runs are refused before a statement is sent, whatever the retry policy |
| Typecheck, lint | `npm run typecheck -w @dems/core-server` exit 0; `npm run lint -w @dems/core-server` exit 0 |
| One whole `db` run | Exit 0: 45 files, 623 tests, 0 failed; the line is there (`forced drops that needed a retry: 0`). No failure of another row to name in this run |
| Whole `unit` run | Exit 0: 70 files, 1,848 tests |
| Mutations | 9 of 9 caught by the new tests (section 5.3) |
| PostgreSQL | PID 19121, started 07:14:26, as before. No role changed, no setting changed (digest equal to the reset row's of 11:00 and 11:44), nothing granted, no connection as `dems_admin`, nothing on port 5432 |
| Databases of this row | None remains (12:30:03 and 12:37:59). At 12:30:03 `pg_database` held `dems_demo`, the three lanes, `postgres`, `template0`, `template1` and nothing else |
| In other rows' runs since the change | Two forced drops were refused once each (12:33:56 and 12:35:23, a run labelled step 48) and went through at the next attempt: no second refusal in the log, both databases gone (section 6.7) |

## 2. The evidence at the start

`.data/postgres.log` (mode 600; only the lines below were read out; `assets/11b_server_log_refusals.log`):

| Time | Database | Who | What is known |
|---|---|---|---|
| 07:12:24, 07:16:01 | `dems_trial_a` | provisioning trial (W07) | On purpose: trial step T5-h |
| 10:45:39.658 | `dems_test_step_43_..._f01_cleanup` | a run labelled step 43 (W21) | The file failed as a whole, its tests passed (F54) |
| 11:22:56.685, .686, .712 | `dems_test_step_51_..._f02_rfbulk` | a run labelled step 51 (W29, the reset row) | The reset row read the database's own statistics before it removed it: autovacuum analysed five of its tables at 11:22:56.702 to .716 (`assets/29_helper_forced_drop_refused.log`) |
| 11:35:59.771 | `dems_test_step_47_..._f02_isolation_b` | a run labelled step 47 (W25, the bulk-fixture row) | 6 of 6 tests passed, the file failed |
| 12:08:38.697 | `dems_test_step_46_..._tpl_schema` | a run labelled step 46 (W24) | While this row worked; with the helper as it was. A template, so the drop was the teardown's |
| 12:15:49.556, 12:20:14.778 | `dems_test_step_48_..._f05_recording`, `..._f05_w26_boot_twice` | two runs labelled step 48 (W26) | The same |

Every one has the same two lines: `ERROR:  permission denied to terminate process` and
`DETAIL:  Only roles with privileges of the role whose process is being terminated or with
privileges of the "pg_signal_backend" role may terminate this process.` Six events in other
rows' runs between 10:45 and 12:20; none of another row's run between the change (12:27:53) and
the reading of the log (12:31:43).

The log cannot confirm the cause of the events of 10:45:39 and 11:35:59 after the fact: the
cluster logs an autovacuum action only above ten minutes (`log_autovacuum_min_duration` is
`600000 ms`; the log holds 0 lines `automatic analyze of table` and 0 `automatic vacuum of
table`), and the statistics of a database go with the database. What the log does show: 16 lines
`FATAL:  terminating autovacuum process due to administrator command` at 11:58 and 28 at 12:31. The server writes that line when it ends a worker itself, at a plain drop, a rename
or a copy of a template, so workers are on test databases at such instants all the time.

## 3. Diagnosis

Three scratch scripts outside the repository (`assets/11b_diag_1.mts.txt`, `_2`, `_3`), run with
`tsx` as `dems_owner` through the helper's own modules (read as they were; nothing of the
repository was written). They created databases of their own run prefix only
(`dems_test_step_33b_<stamp>_`) and dropped them.

### 3.1 What `dems_owner` can see in `pg_stat_activity` (measured, 12:03:02 and 12:03:17)

`dems_owner` and `dems_app` are not superusers and are members of neither `pg_signal_backend` nor
`pg_read_all_stats` (read from `pg_roles`, `pg_has_role`). All 22 columns were read:

| Column | A `dems_app` client session | An autovacuum worker | The reader's own session |
|---|---|---|---|
| `datid`, `datname` | the database | the database | set |
| `pid` | set | set | set |
| `usesysid`, `usename` | `dems_app` | **NULL** | `dems_owner` |
| `application_name` | as the client set it (`dems-w11b-held-app`) | empty | set |
| `backend_type` | **NULL** | **NULL** | `client backend` |
| `state`, `backend_start`, `xact_start`, `query_start`, `state_change` | NULL | NULL | set |
| `client_addr`, `client_port` | NULL | NULL | set |
| `backend_xmin` | NULL | set | set |
| `query` | `<insufficient privilege>` | `<insufficient privilege>` | its text |
| `leader_pid`, `client_hostname`, `wait_event_type`, `wait_event`, `backend_xid`, `query_id` | NULL | NULL | NULL |

So the helper cannot ask for the backend type; it decides on the role: a backend on the database
with no role is a background worker of the server, one with a role other than `dems_owner` is a
client session the owner may not end. This confirms finding F-1 of `11_db_test_helper.md` and
adds the row of the worker. The seven backends without a database (checkpointer and the like)
and the one with `usename = dems_admin` and no database (W11's F-3) show nothing else either.

### 3.2 The autovacuum worker (reproduced, 12:03:13 to 12:03:27; `assets/11b_diag_1_run.log`)

Two clones, 600,000 rows inserted into each, then a poll every 4 ms for a backend without a role
on the database.

| | Database `..._f02_diag_av_forced` | Database `..._f03_diag_av_plain` |
|---|---|---|
| The backend without a role arrived | 3.5 s after the load | 13.5 s after the load, pid 39677 |
| Statement at that instant | forced drop | plain drop |
| Outcome | `42501` "permission denied to terminate process", the same message and DETAIL as in section 2, at once | Dropped in 67 ms |
| Then | The same statement 250 ms later went through. The worker was seen for 227 ms | The server log, 12:03:27.305: `[39677] FATAL:  terminating autovacuum process due to administrator command` |

The process number that `dems_owner` saw without a role is the one the server calls an autovacuum
process. That is the kind of backend; the worker comes by itself to a database that has just been
written to (settings: `autovacuum = on`, `autovacuum_naptime = 60 s`, 3 workers).

### 3.3 A client session of another role (12:03:02)

With a `dems_app` session held on a clone: the forced drop is refused in under 1 ms with the same
`42501`, message and DETAIL; nothing is ended (the session still answers); after the session is
released the forced drop goes through. The two causes give the same error; only the catalog tells
them apart.

### 3.4 The plain drop, and why it does not go first (`assets/11b_diag_2_run.log`, `_3_run.log`)

| Measured | Result |
|---|---|
| Plain drop with a `dems_app` session on the database | `55006` after **5,078 ms** ("There is 1 other session using the database.") |
| Plain drop with a leftover `dems_owner` session | `55006` after 5,043, 5,081, 5,051, 5,042, 4,979, 5,079, 5,043, 5,041 and 4,977 ms (9 trials). It does not fail fast |
| Plain drop with only an autovacuum worker | Dropped in 67 ms: the server ends the worker itself |
| Forced drop right after that failed plain drop (leftover `dems_owner` session) | **Refused with `42501` in 4 of 9 trials**. In the three trials where it was then repeated, 100 or 250 ms later, it went through; in the first the database went with the run's teardown |
| Forced drop first (leftover `dems_owner` session) | 4 of 4 dropped in 114 to 117 ms |
| Why the forced drop after a plain one is refused | Seen in `pg_locks` (12:06:13): while the plain drop waits its five seconds, a backend without a role asks for the lock on the database object (`RowExclusiveLock`, not granted; first seen after 262 ms; 3 of 4 trials had such a waiter). When the plain drop fails, that backend enters; 2 ms later the forced drop finds it (the same pid, `usename` NULL) |

So "plain first, forced second" costs five seconds exactly in the case the forced form exists for
(a leftover session of the helper's own role), queues an autovacuum worker behind the database
lock meanwhile, and still needs the retry. Forced first with a bounded retry covers every case
with one statement.

### 3.5 What remains a hypothesis

- That the events of 10:45:39, 11:35:59, 12:08:38, 12:15:49 and 12:20:14 were autovacuum workers.
  It fits (same error, a database just written to, tests passed, no leak reported, the pre-drop
  check of the helper had seen no session of another role), and the reset row measured it for
  11:22:56; for these five it cannot be shown after the fact (section 2). The fix does not depend
  on it: it reads the catalog at each refusal.
- How long a worker stays on a real test database under heavy load. Measured: 14 ms for five
  tables of a seeded database (the reset row), 227 ms and about 2 s for a table of 600,000 rows
  (sections 3.2, 6.2; about 40 MB by the row size, not measured).

## 4. The change

Ten files under `apps/core-server/test/helpers/db/`: 7 changed, 3 new; 1,227 lines added, 20
removed. `apps/core-server/test/global-setup.db.ts` was not changed (the summary line is printed
by `helpers/db/global-setup.ts`). The diff: `assets/11b_helper.diff`.

| File | Change |
|---|---|
| `constants.ts` | `DROP_RETRY_ATTEMPTS = 20`, `DROP_RETRY_PAUSE_MS = 250` |
| `errors.ts` | One more error code, `DROP_REFUSED` |
| `ddl.ts` | `dropDatabase` returns `{ refusals }` and repeats the one forced statement (section 4.1); `backendsOn`, `clientsOfOtherRoles`, `describeBackends`, `isTerminateRefusal`, `notifyRun`. The file still writes exactly five statements on databases; the drop is the same text as before |
| `run.ts` | `#dropGuarded` passes the retry policy and records a retried drop; the owner of a run listens for the reports of its test files; `TeardownReport.retriedDrops`; `RunOptions.dropRetry` (tests shorten it); the message of the check before a drop names the application too |
| `session.ts` | `OwnerSession.listen`; the driver seam knows the `notification` event; the real driver factory is exported for test support |
| `global-setup.ts` | `retriedDropsLine`, printed once before the `teardown:` line |
| `testing/fake-cluster.ts` | The stand-in cluster knows a backend without a role, refusals that end, the catalog read, `LISTEN` and `pg_notify` |
| `testing/refusing-driver.ts` (new) | The real driver with the first forced drops answered by the refusal instead of being sent |
| `__tests__/drop-retry.test.ts` (new) | 43 tests, project `unit` |
| `__tests__/drop-retry.db.test.ts` (new) | 7 tests, project `db` |

### 4.1 What the drop does now

```
check before the drop (unchanged): wait up to 5 s for sessions of another role to end;
    one left  ->  SESSIONS_REMAIN, no DROP is sent
DROP DATABASE IF EXISTS "<name>" WITH (FORCE)
    done                                              ->  return (the normal case: one statement)
    any error but 42501 "permission denied to terminate process"  ->  thrown as it is, no retry
    that refusal:
        read role, application name and count of every backend on the database
        a client session of a role other than dems_owner  ->  SESSIONS_REMAIN (role, application), no retry
        the 20th refusal  ->  DROP_REFUSED: the last error as cause, and what was on the database
        otherwise         ->  wait 250 ms, send the same statement again
```

| Case | Before | Now |
|---|---|---|
| Nothing connected | One statement | The same |
| A leftover `dems_owner` session | The forced drop ends it | The same |
| An autovacuum worker on the database | `42501`; the file failed; the database stayed for the teardown, which could fail the same way | The drop goes through at a later attempt; the file passes; counted in the summary |
| A `dems_app` session still open before the drop | `SESSIONS_REMAIN`, no DROP sent | The same; the message now names the application (`1 of role dems_app (application "...")`) |
| A `dems_app` session that connects after that check | Raw `42501` of the server | `SESSIONS_REMAIN` with role and application, after one statement; not repeated |
| Still refused after 20 attempts | (not applicable) | `DROP_REFUSED` with the last error and what was connected; the database is left to the teardown |
| Another error (`55006`, not the owner, a template) | Thrown | Thrown as it is |

No message holds a statement text: the helper never selects the `query` column (a test pins the
statement it sends).

### 4.2 Why this is simple and holds

- One statement form. The forced drop was already right for every case but one; the one is a
  backend that leaves by itself, so asking again is enough. No second form, no storage parameter,
  no grant, no setting.
- The decision is made on what the role can see (section 3.1), read at each refusal, not assumed.
- It is bounded: 20 attempts, 19 waits of 250 ms. The largest stay measured was 8 refusals, on a
  table with about forty times the rows the bulk fixture adds.
- A leak cannot hide behind it: the retry happens only when no client session of another role is
  on the database.
- The server checks every backend before it ends one (measured in section 3.3: the held session
  still answered), so a refused attempt changes nothing.

### 4.3 What was not done

No role was changed and nothing was granted; `postgresql.conf` and every setting are as they
were; nothing connected as `dems_admin`. No per-table storage parameter: the retry alone was
enough against the real worker (section 6.2). Nothing outside `test/helpers/db/**` was written
(the fixtures, the reset, the seed, the core, the schema and every `package.json` are as they
were).

### 4.4 The line in the teardown summary

```
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 112 ms; 0 remain with the run prefix dems_test_step_33b_tmdb7hti_
```

With retried drops: `forced drops that needed a retry: 2 (15 refusal(s) with SQLSTATE 42501 while
a backend that the owner role may not end, such as an autovacuum worker, was on the database;
each drop then went through)`.

A test file drops its database in a worker process, the summary is printed by the main process,
and the helper writes no file (its static test). So a test file's run tells the owner of the run
with `pg_notify` on a channel named like the run prefix, on the maintenance database, where both
sessions are; the owner's session runs `LISTEN` once at its start. The payload is a database name
and a count. A report that cannot be sent is dropped silently; the owner ignores anything that is
not such a report. The line is printed before the `teardown:` line, so that the last line of a
run is what it was.

### 4.5 A database that a refused drop leaves

- The teardown lists every database with the run prefix and drops each through the same
  `#dropGuarded`, so the retry applies there too; so does the stale sweep.
- `remaining` is read from `pg_database` after the drops (`run.ts`, `teardown`). If one remains,
  the summary says `1 remain` and the run fails with `CLEANUP_INCOMPLETE` and the reason.
- Tests: `drop-retry.test.ts` "refused at every attempt in the file; the worker leaves during the
  teardown" and "refused at every attempt of the teardown too: reported as remaining";
  `drop-retry.db.test.ts` "a database that cannot be dropped: the summary says "1 remain", never
  "0 remain", and the run fails" (real server).

## 5. Tests

### 5.1 New

| File | Project | Tests | What |
|---|---|--:|---|
| `__tests__/drop-retry.test.ts` | `unit` | 43 | A stand-in runner that refuses n times and then succeeds (1, 2, 7, 19); the bound (default 20 and 250 ms pinned; `DROP_REFUSED` with the last error as cause and what was connected); the wait; the client leak (one statement, role and application, the worker and the own leftover not named); the statement the helper reads with; five errors that are not retried; on the stand-in cluster: a file's drop with a worker that leaves, the report to the owner of the run, the teardown that tries again, "remaining" when it stays refused, the stale sweep, and nine protected names refused before a statement with a retry policy of 50 attempts |
| `__tests__/drop-retry.db.test.ts` | `db` | 7 | Against PostgreSQL: what `dems_owner` sees of a `dems_app` session; **the client leak**: a `dems_app` session held on a clone, the forced drop sent, PostgreSQL's own `42501`, `SESSIONS_REMAIN` with `dems_app` and the application name, no statement text, one drop and one catalog read, the session still answers, then released and dropped; the same leak found before the drop; the retry with the refusal injected at the driver seam, reported by the file's run and counted by the owner's teardown; the two forms of the summary line; "1 remain" |

The names of all 50, as run: `assets/11b_new_unit_tests_verbose.log`,
`assets/11b_new_db_tests_verbose.log`.

Not in the suite: the refusal by a real autovacuum worker, which cannot be summoned (it came
after 3.5 s to 2 minutes in four reproductions). It was run by hand against the changed helper
(section 6.2); in the suite the refusal is injected at the driver seam and everything else is the
real server.

### 5.2 Existing

All 17 existing test files of the helper pass unchanged (7 `unit`, 10 `db`); no line of them was
edited, so there is no pinned count or line to name. `static.test.ts` still finds five statements
on databases in `ddl.ts`, one place that builds a client, and none of the forbidden statements.
`guards.db.test.ts`, `run.test.ts` (14 names refused before a statement) and `names.test.ts` are
as they were and pass.

### 5.3 Mutations (`assets/11b_mutations.log`, 12:32:26; on the scratch copy)

| Mutation | New tests that fail |
|---|--:|
| M1 no retry at all | 22 |
| M2 a client leak is retried like a worker | 4 |
| M3 no bound | 5 |
| M4 every `42501` is retried | 2 |
| M5 no wait between attempts | 1 |
| M6 the test file does not report | 1 |
| M7 the owner does not listen | 2 |
| M8 the teardown report without the retried drops | 2 |
| M9 the retry policy of the run is not passed on | 6 |

## 6. Verification

### 6.1 Applied in one step

Developed and proven on a copy outside the repository
(`$TMPDIR/.../scratchpad/w11b/tree`, with links to `node_modules`, `src`, `test/db` and the data
folder): typecheck and lint exit 0; `unit` 8 files, 239 tests; `db` 11 files, 59 tests in three
runs, two of them at the same time (`assets/11b_scratch_db_runs.log`). At 12:27:46 the repository
folder was still equal to the copy taken at the start; at **12:27:53** the ten files were put in
place by one command (a temporary copy beside each target, then renames in the order
`constants`, `errors`, `session`, `fake-cluster`, `ddl`, `run`, `global-setup`, the three new
files, so that every state in between was consistent); afterwards the folder equals the scratch
copy and no temporary file is left.

### 6.2 The changed helper against a real autovacuum worker (12:23:26 to 12:25:42; `assets/11b_diag_4_changed_helper_run.log`)

A run and a test file's run attached to it, as in a worker of Vitest; two clones with 600,000
rows; `database.drop()` (the public path) at the instant a backend without a role appeared:

```
[12:25:35.684] fix_av_a: database.drop() while a backend without a role (pid 62950) was on it {"ms":1777,"threw":null,"dropped":true,"databaseExists":false,"retriedDropsOfTheFileRun":[{"name":"dems_test_step_33b_tmdaz29d_f01_fix_av_a","refusals":7}]}
[12:25:41.981] fix_av_b: database.drop() while a backend without a role (pid 63003) was on it {"ms":2069,"threw":null,"dropped":true,"databaseExists":false,"retriedDropsOfTheFileRun":[...,{"name":"dems_test_step_33b_tmdaz29d_f02_fix_av_b","refusals":8}]}
[12:25:42.010] teardown report of the owner {"dropped":["dems_test_step_33b_tmdaz29d_tpl_x_diag"],"remaining":[],"failed":[],"retriedDrops":[{"name":"..._f01_fix_av_a","refusals":7},{"name":"..._f02_fix_av_b","refusals":8}]}
[12:25:42.011] the line of the global setup: forced drops that needed a retry: 2 (15 refusal(s) with SQLSTATE 42501 while a backend that the owner role may not end, such as an autovacuum worker, was on the database; each drop then went through)
[12:25:42.014] databases with the prefix dems_test_step_33b_ now []
```

(The second line is shortened where marked `...`.) The server log holds the 15 refusals, 250 ms
apart: 12:25:33.908 to 12:25:35.414 and 12:25:39.914 to 12:25:41.690.

### 6.3 The helper's own tests, in the repository

```
$ DEMS_TEST_STEP=33b npm run test:db -w @dems/core-server -- test/helpers/db      (12:28:04)
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_33b_tmdb6t3n_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_33b_tmdb6t3n_tpl_schema: built in 78 ms (create 28 ms, hook 49 ms)
[test:db] template dems_test_step_33b_tmdb6t3n_tpl_seed: built in 119 ms (create 39 ms, hook 79 ms)
 Test Files  11 passed (11)
      Tests  59 passed (59)
   Start at  12:28:05
   Duration  8.81s (tests 98%, import 1%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 4 database(s) in 62 ms; 0 remain with the run prefix dems_test_step_33b_tmdb6t3n_
exit=0
```

```
$ npm run test -w @dems/core-server -- --maxWorkers=2 test/helpers/db              (12:28:18, inside the sandbox)
 Test Files  8 passed (8)
      Tests  239 passed (239)
exit=0
```

### 6.4 Typecheck and lint (12:28:19, 12:28:22; `assets/11b_typecheck_lint.log`)

```
> tsc --noEmit
exit=0
> oxlint
src/plugins/readiness/__tests__/readiness.test.ts:250:11: warning eslint(no-unused-vars): Variable 'app' is declared but never used. ...
src/plugins/readiness/__tests__/readiness.test.ts:251:11: warning eslint(no-unused-vars): Variable 'unit' is declared but never used. ...
exit=0
```

The two warnings are in a file of a row in flight (P11); none in `test/helpers/db`.

### 6.5 One whole `db` run (12:28:29; `assets/11b_db_whole.log`)

```
$ DEMS_TEST_STEP=33b npm run test:db -w @dems/core-server
 Test Files  45 passed (45)
      Tests  623 passed (623)
   Start at  12:28:29
   Duration  40.60s (tests 90%, import 9%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 112 ms; 0 remain with the run prefix dems_test_step_33b_tmdb7hti_
exit=0
```

No test failed, so there is no failure of another row to name and no second run to record. The
whole `unit` project at 12:29:15: 70 files, 1,848 tests, exit 0 (`assets/11b_unit_whole.log`).

### 6.6 End state (12:30:03 and, after the last test run of the row, 12:37:59; `assets/11b_final_state.log`)

At 12:30:03 `pg_database` held seven rows: `dems_demo`, `dems_lane_1`, `dems_lane_2`,
`dems_lane_3`, `postgres`, `template0`, `template1`; no advisory lock. The asset file holds the
reading of 12:37:59, taken after a last run of the row command (12:37:45: exit 0, 11 files, 59
tests, `forced drops that needed a retry: 0`, `0 remain`):

```
2026-10-04 12:37:59 WIB
19121 Sun Oct  4 07:14:26 2026
postgres.pid file: 19121
session         dems_owner (superuser false) on 127.0.0.1:4432, PostgreSQL 18.4, postmaster started 2026-10-04 07:14:26 WIB
databases with the prefix dems_test_step_33b: 0
role            {"role":"dems_app","rolsuper":false,"rolcreatedb":false,"rolcreaterole":false,"signal_backend":false,"read_all_stats":false}
role            {"role":"dems_owner","rolsuper":false,"rolcreatedb":true,"rolcreaterole":false,"signal_backend":false,"read_all_stats":false}
pg_roles        3 role(s) outside pg_*
autovacuum      autovacuum=on, autovacuum_naptime=60
backends on databases with the prefix dems_test_step_33b: 0
```

(Three lines of the file are left out of this quote: `pg_database`, `pg_settings` and `advisory
locks`.) At that instant another row's run was in progress (nine databases
`dems_test_step_48_tmdbmqkh_*`, its liveness lock, the clone lock and one lock of class 442001);
they are not this row's and are in the asset file as read.

Settings: the reset row's read-only script, run at 12:30:18 and again at 12:37:59, prints `375
visible setting(s), digest 6373391cbc111bce33dc5cf487c0c1e8; pg_db_role_setting 0 row(s)`, the
value that row recorded at 11:00 and 11:44. (The other digest in the asset file, `68b90376...`,
is from this row's own script, whose session has another application name and the helper's lock
timeout; it does not compare.)

Leak check at 12:37:35: 312 files (the helper folder, this document, the progress file, the 21
assets, the rollback material and the scratch folder) compared in memory with the password
values of the two connection files the helper reads; 0 contain one.

### 6.7 After the change, in other rows' runs (server log, read 12:38)

| Time | Database | Refusals in the log | Now |
|---|---|--:|---|
| 12:33:56.467 | `dems_test_step_48_tmdberu1_f02_isolation_a` | 1 | Gone |
| 12:35:23.840 | `dems_test_step_48_tmdbhywu_f03_cleanup` | 1 | Gone |

They are the databases of the helper's own files `isolation-a` and `cleanup`; `cleanup` is the
file that failed at 10:45:39, and `isolation-b`, the twin of `isolation-a`, the one that failed
at 11:35:59. The helper sends a drop only after it has seen no session of another role on the
database, and repeats it only if it still sees none. One refusal each and no second one: the
next attempt, 250 ms later, went through. Before the change each would have failed its file.
The output of those runs is not this row's to quote; by the code their summary line reads
`forced drops that needed a retry: 1` (not seen by this row).

Five more refusals since the change are deliberate: the new test "a client session of another
role at the forced drop" in whole-project runs of other rows (`..._client_leak`, finding F-9).

## 7. Test ledger (P24)

`@dems/core-server` only.

| Project | Helper folder before | Helper folder after | Whole project after | New file |
|---|---|---|---|---|
| `unit` | 7 files, 196 tests | 8 files, 239 tests | 70 files, 1,848 tests (12:29:15) | `test/helpers/db/__tests__/drop-retry.test.ts` (43) |
| `db` | 10 files, 52 tests | 11 files, 59 tests | 45 files, 623 tests (12:28:29) | `test/helpers/db/__tests__/drop-retry.db.test.ts` (7) |

"Before" is the ledger of `11_db_test_helper.md` section 10; "after" minus the new files gives
the same numbers. No whole-project total was taken before the change (other rows were adding
files during the row).

## 8. Findings

| ID | Finding | Evidence |
|---|---|---|
| F-1 | The forced drop by `dems_owner` is refused while an autovacuum worker is on the database; the worker is seen by `dems_owner` as a backend with a database and no role | Section 3.2 |
| F-2 | `dems_owner` cannot read `backend_type` of a backend it does not own; a query that filters on it, or on `state`, finds neither a `dems_app` session nor a worker | Section 3.1 |
| F-3 | A plain `DROP DATABASE` waits 5 s before it reports that the database is in use, and a rename does the same (the reset row's F-4). While it waits, an autovacuum worker can queue for the database; it enters when the statement fails | Section 3.4 |
| F-4 | The refusal happened six times in other rows' runs between 10:45 and 12:20, three of them in the last 20 minutes before the change, and twice more in the ten minutes after it, where the retry absorbed it: more often as more rows use the database | Sections 2, 6.7 |
| F-5 | A worker reached a freshly written database after 3.5 s, 13.5 s and about 2 minutes, and stayed 227 ms to about 2 s on a 600,000-row table. The 20 attempts cover about 4.75 s | Sections 3.2, 6.2 |
| F-6 | `apps/core-server/` is untracked, so the P23 command `git diff acaff20 -- <paths>` prints nothing for it (0 bytes at 12:27:35). The pre-image was taken another way (section 10) | Section 10 |
| F-7 | Every `test:db` run prints one more `[test:db]` line. A row or a gate that quotes the output sees it; the `teardown:` line is unchanged and is still the last line | Section 4.4 |
| F-8 | The bulk-fixture row's own retry around the drop (`dropWhenQuiet`) and the reset row's "plain drop first" in its tests are no longer needed for this cause. They do no harm; the plain form costs 5 s whenever a session is still on the database | `25_db_bulk_fixture.md` F-4; `29_db_reset_routine.md` F-1 |
| F-9 | Each run of `drop-retry.db.test.ts` adds one deliberate refusal to the server log (`..._client_leak`), and a retried drop adds one per refused attempt | `assets/11b_server_log_refusals.log` |

## 9. Deviations

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | The count in the summary needs a channel between processes: `LISTEN` in the owner's session, `pg_notify` from a test file's session. The row text names the drop only | Without it the line would count the main process alone, where almost no file drop happens, and would read 0 while files retried. No file, no table, no setting; informational and best effort |
| DV-2 | One new error code, `DROP_REFUSED`; a leak found after a refusal uses the existing `SESSIONS_REMAIN` | The bounded failure is neither a leak nor an incomplete cleanup |
| DV-3 | `session.ts` exports its driver factory; `RunOptions` gains `dropRetry` | Test support wraps the real driver instead of building a second client; tests shorten the wait |
| DV-4 | The wording of the existing `SESSIONS_REMAIN` message gained the application name | The row asks for a message that names user and application. Every existing assertion on it still holds |
| DV-5 | The P23 pre-image is not the output of the P23 command | F-6 |
| DV-6 | Two read-only commands contained `cd /Users/gsp-budi/Documents/DEMS` (the workspace root itself, not a subfolder), one of them in a subshell | A slip; no command ran from another directory |
| DV-7 | The reset row's read-only scratch script was run once | For a settings digest that can be compared with that row's |
| DV-8 | `11_db_test_helper.md`, `masterplan/02_plan.md` (it has no row W11b) and the shared trackers were not edited; `implementation/99_implementation_report.md` was not written | Parallel run (P8); this document and the progress file are the record |

## 10. Rollback (not executed)

The paths are untracked, so the pre-image is: `.cache/rollback/W11b.pre.patch` (the seven changed
files as they were, as a patch that adds them; checked: applied into an empty folder it gives
files equal to the originals), the same seven files as copies under `.cache/rollback/W11b.pre/`,
and the change itself as `.cache/rollback/W11b.post.patch` (equal to `assets/11b_helper.diff`).

```sh
# from /Users/gsp-budi/Documents/DEMS; checked with --check at 12:27:53 and again after the assets were written
git apply -R docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/11b_helper.diff
```

(Since the follow-up of section 14 this diff does not reverse alone: see finding FU-8 there.)
It restores the seven files and removes the three new ones. After it the helper is as W11 left
it: the forced drop is sent once, and the refusal fails the file again. No database object and no
server state belongs to this change.

## 11. Decisions for the controller to record

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | DV-1: the notification channel for the count | Accept. The alternative is a line that counts the main process only |
| DN-2 | The bound of 20 attempts, 250 ms apart | Keep. Watch the new line: if a run ever reports about 10 refusals for one drop, raise `DROP_RETRY_ATTEMPTS` (one constant) |
| DN-3 | The plain form | Not used (section 3.4). If DN-2 ever fires, the next step is a plain drop as the retry when nothing with a role is on the database: the server then ends the worker itself (67 ms measured) |
| DN-4 | F-8: the two rows' own work-arounds | Leave them; tell their owners they may remove them at their next edit |
| DN-5 | `11_db_test_helper.md` | Its section 6 step 9, the row "The helper closes its pools..." of section 7 and TI-10 in section 11 now read with this document; amend at the next document slot |
| DN-6 | F54, F58: the watched failures of helper files | Close: cause reproduced, fix in place. The single events before 12:27:53 are consistent with it and not provable one by one (section 3.5) |
| DN-7 | F-7: the extra output line | Add to the briefs of rows that quote or parse `test:db` output |
| DN-8 | F-6: P23 for untracked paths | Say in P23 that a row saves copies when the path is not tracked |

## 12. Not done, not verified

- No test in the suite meets a real autovacuum worker (section 5.1).
- The events listed in section 3.5 were not proven one by one.
- Nothing was measured under a load average above 9 (it was 2 to 9 during the row).
- The other rows' work-arounds were not removed (not this row's paths).

## 13. Verification list of the row

| Check | Result | Section |
|---|---|---|
| The helper's own tests pass: `db` and `unit` | Exit 0: 11 files, 59 tests; exit 0: 8 files, 239 tests | 6.3 |
| Typecheck and lint of the workspace | Exit 0, exit 0 | 6.4 |
| One whole `db` run with the summary line; failures of other rows named | Exit 0, 45 files, 623 tests; the line is there; no failure | 6.5 |
| What `dems_owner` can see of a foreign backend | `datid`, `datname`, `pid`, `usesysid`, `usename`, `application_name` | 3.1 |
| The diagnosis | Reproduced; an autovacuum worker | 3.2 |
| The client-leak case against PostgreSQL | Fails with role and application name, no statement text; released and cleaned up | 5.1 |
| The guards unchanged | `names.ts` untouched; existing guard tests pass; nine names refused with a 50-attempt policy | 5.1, 5.2 |
| Every existing helper test passes unchanged | Yes, 17 files | 5.2 |
| No database of the row's prefix remains; PostgreSQL PID 19121 | Yes | 6.6 |
| The fix at work in another row's run | Two refusals at 12:33:56 and 12:35:23, each followed by a drop that went through | 6.7 |

## 14. Follow-up: test limits under load (decision D110)

Controller follow-up after the gate of this row (D76), with one addition (decision D111, a run
that was stopped before its teardown; section 14.7). 2026-10-04, 17:44 to 18:20 WIB; test label
`DEMS_TEST_STEP=33c`. Every command ran from `/Users/gsp-budi/Documents/DEMS`; database commands
with the per-command sandbox bypass. No credential value appears here or in the assets
`implementation/assets/11b_fu_*` (20 files).

### 14.1 Result

| Item | Result |
|---|---|
| The three time-outs of today (14:58, 15:06, 17:25) | Three different tests of the helper; each asks for a template or a clone INSIDE the test, so its wait for the clone lock ran under the runner's default of 5 s. On a quiet host the three take 0.2 to 0.8 s (section 14.2) |
| Limits as caps | `vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });` at the top of all 12 database test files of the helper and of the three database fixtures its nested-run test starts. `vitest.config.ts` was not touched |
| The line takes effect | Proven with a probe outside the tree: with it a 5.5 s test and a 10.5 s hook pass; without it they fail at 5,004 ms and 10,007 ms (section 14.3) |
| A cap is not a wait | Unchanged and changed copy run alternately, three runs each, one worker: sum of the file medians 12,261 ms before, 12,298 ms after (+0.3 %); no file differs by more than 65 ms, inside its own run-to-run spread (section 14.4) |
| The helper's `unit` tests | 239 tests take 487 ms in all; the slowest single test 94 ms. None waits anywhere near 5 s: no limit added (section 14.5) |
| Bounds inside the helper | **No constant changed.** No bound of the helper has failed a run in any evidence file of any row. The drop retry: 25 real drops were refused since the fix, each exactly once, in about 36,200 drops; the bound stays 20 attempts, 250 ms apart (section 14.6) |
| The one place that can fail a healthy run | Not a constant: a call of the helper from inside a test runs under the caller's test limit, 5 s by default, while the helper's own waits are allowed 120 s (lock) and 9.75 s (one drop). 24 database test files of other rows look exposed by a text scan (section 14.6) |
| The stopped run `dems_test_step_64m_tmdoqjg5_*` (D111) | Shown dead, then removed through a new guarded entry of the helper, `TestRun.dropDeadRun(prefix)`: 3 databases dropped at 18:13:12, 0 remain. The stale sweep's age rule is unchanged (section 14.7) |
| Helper's own tests, final state | `db`: **12 files, 66 tests, exit 0**. `unit`: **9 files, 308 tests, exit 0** |
| Typecheck, lint | Exit 0 and exit 0; nothing in `test/helpers/db` |
| One whole `db` run, `--maxWorkers=2` | **Exit 0: 109 files, 1,547 passed, 1 skipped, 0 failed** (18:13:25). No failure to name. The skipped test is another row's pending one |
| Whole `unit` run | Exit 0: 142 files, 3,678 tests (18:14:58) |
| PostgreSQL | PID 19121, started 07:14:26. No role, grant or setting changed (settings digest `6373391c...`, as before). No database of the prefix `dems_test_step_33c` remains |

### 14.2 What happened at 14:58, 15:06 and 17:25

| Time | Test that hit "Test timed out in 5000ms" | The run | The same test on a quiet host (three runs, ms) |
|---|---|---|---|
| 14:58:22 | `sweep.db.test.ts` > drops a run that is older than six hours and dead ... (the file's second test then failed as a consequence) | Load average 17; whole `db` 179 s instead of 128 s (`assets/36_final_runs.log`) | 679, 759, 561 |
| 15:06:09 | `templates.db.test.ts` > a hook that throws: the half-built database is dropped ... | Whole `db` 225 s | 274, 226, 353 |
| 17:25:18 | `templates.db.test.ts` > a template nobody plugged a hook in for ... | Load average 7.76; whole `db` 196 s; the bulk template took 3,065 ms in that run (`test/assets/06_whole_db_1725.log`) | 297, 226, 318 |

What the three have in common: each builds a template or takes a clone inside the test body
(the sweep test six times, the other two twice and once). Every such request waits for the clone
lock, advisory lock `(442002, 0)`, which is one lock for all runs on the host (TI-7).

Measured (`assets/11b_fu_evidence_of_bounds.log`, `11b_fu_lockwait.log`):

| What | Number |
|---|---|
| How long ONE builder holds the clone lock: the bulk template, as 38 runs of today printed it | 1,216 ms to 3,504 ms; median 1,366; ninth decile 2,391 |
| Requests for the clone lock during one whole `db` run on a quiet host (17:58, load 1.5 to 4.0; a probe asking 706 times in 78 s) | Median 0.2 ms; 99th percentile 62 ms; **longest 1,396 ms**; 2 waits of a second or more, none of 2.5 s |
| The same mechanism inside one run with two workers (section 14.4) | A test of `cleanup` waited about 0.9 s for the lock that `templates` held beside it |

So one bulk build of another run costs a waiting test up to 3.5 s of its 5 s, and two builders
in a row cost more than 5 s. With six to eight agents each starting whole runs, that is expected
to happen. **That the three events were such waits is a hypothesis**: no run recorded its lock
waits, and the numbers above are from a quiet host. It fits (tests that take 0.2 to 0.8 s alone,
more than 5 s under load, all three with lock requests in the test body; row W53 came to the same
reading, its DN-7). The limits below hold whatever the cause was.

### 14.3 The change: limits in the helper's database test files

`assets/11b_fu_test_limits.diff`: 14 files, 86 lines added, 14 removed. Applied in one command at
**17:57:02**, after it was proven on a copy outside the tree.

```ts
// Limits as caps, not waits (decision D110). A clone or a template that a test asks for waits
// for the clone lock, which another run on this host may hold for seconds while it builds its
// bulk template; with the runner's default of 5 s such a wait failed a healthy test under load.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });
```

| File (`apps/core-server/test/helpers/db/`) | Change |
|---|---|
| `__tests__/cleanup`, `clone-lock`, `drop-retry`, `global-setup`, `guards`, `nested-run`, `sweep`, `templates`, `timing` `.db.test.ts` (9) | `vi` added to the Vitest import; the line after the imports, before the first hook and test are registered |
| `__tests__/isolation-a.db.test.ts`, `isolation-b.db.test.ts` | An import of `vi` and the line before `defineIsolationSuite(...)`; their tests are defined by `testing/isolation-suite.ts`, which the probe below covers |
| `__tests__/dead-run.db.test.ts` (new, section 14.7) | Carries the line from the start |
| `selfcheck/convention.selfcheck.ts`, `throwing-test.selfcheck.ts`, `throwing-hook.selfcheck.ts` | The same line. They are database tests too: `nested-run.db.test.ts` starts a Vitest of its own on them, and `convention` builds a bulk template inside a test |
| `__tests__/clone-lock.db.test.ts` line 33 (now 41) | By design: `TEST_TIMEOUT_MS` was `60_000`, a cap of its own on the three tests; it is `120_000` now, the same as the file's |

Left as they are: `nested-run.db.test.ts` (100 s per test, 90 s for the child process: already
caps, and the outer one stays above the inner), `timing.db.test.ts` (120 s on its one test),
`index.ts` (the helper's own `beforeAll` and `afterAll` already carry 180 s),
`selfcheck/never-runs.selfcheck.ts` (it has no database and must never run).

**Does the line take effect in Vitest 5.0.3?** A probe in the scratch copy, removed afterwards
(`assets/11b_fu_limits_probe.log`): a suite defined by an imported module, with a hook of 10.5 s
and a test of 5.5 s.

```
 x control: a test that takes 5.5 s 5004ms                      Error: Test timed out in 5000ms.
   control, no limits (the hook)  10007ms                       Error: Hook timed out in 10000ms.
 v with the limits: a test that takes 5.5 s 5503ms              (file: 1 test passed, 16007ms)
```

(The marks of the reporter are written as `x` and `v`.) No mutation was made in the tree (M15).

### 14.4 A cap is not a wait: durations before and after (`assets/11b_fu_durations_before_after.log`)

Unchanged copy and changed copy in two scratch trees of the same layout, run alternately against
the project's PostgreSQL, three runs each, 17:55:05 to 17:56:33, load average 1.7 to 2.0. Sum of
the test durations per file, from the JSON reporter. **One worker**, so that no file runs beside
another:

| File | Before (ms, three runs) | After (ms, three runs) | Median before | Median after |
|---|---|---|--:|--:|
| `cleanup.db.test.ts` | 1889, 1883, 1857 | 2069, 1837, 1948 | 1883 | 1948 |
| `clone-lock.db.test.ts` | 1247, 1250, 1239 | 1258, 1231, 1265 | 1247 | 1258 |
| `drop-retry.db.test.ts` | 1399, 1394, 1390 | 1385, 1341, 1411 | 1394 | 1385 |
| `global-setup.db.test.ts` | 516, 565, 562 | 544, 533, 591 | 562 | 544 |
| `guards.db.test.ts` | 300, 334, 339 | 301, 336, 331 | 334 | 331 |
| `isolation-a.db.test.ts` | 25, 25, 25 | 26, 26, 26 | 25 | 26 |
| `isolation-b.db.test.ts` | 26, 25, 25 | 26, 26, 26 | 25 | 26 |
| `nested-run.db.test.ts` | 2211, 2174, 2192 | 2141, 2185, 2185 | 2192 | 2185 |
| `sweep.db.test.ts` | 525, 527, 548 | 537, 530, 546 | 527 | 537 |
| `templates.db.test.ts` | 2819, 2717, 2711 | 2577, 2694, 2730 | 2717 | 2694 |
| `timing.db.test.ts` | 1301, 1358, 1355 | 1359, 1364, 1389 | 1355 | 1364 |
| Sum of the medians | | | **12,261** | **12,298** (+0.3 %) |

Whole runs: 14.40, 14.42, 14.41 s before; 14.37, 14.34, 14.64 s after. All twelve runs of the
comparison: 59 of 59 tests, exit 0.

With **two workers** the sum is equal too (15,766 ms before, 15,733 ms after), but the files
differ, in both directions: `cleanup` 2,143 to 3,217 ms, `nested-run` 3,358 to 2,536 ms. That is
not the limits. The runner orders the files by size and by the durations it has cached, and in
the changed tree it started `cleanup` beside `templates` in all three runs. One test of
`cleanup` (two templates and a clone) then took about 1,200 ms instead of 260 to 470 ms, which
fits a wait for the clone lock: `templates` holds it for about 1.1 s on purpose in its test "a
hook that leaves a session open". With one worker that neighbour does not exist
and the file takes the same time. It is the mechanism of section 14.2 at small scale.

### 14.5 The `unit` tests of the helper

Eight files, 239 tests, before the change (17:48:53; `assets/11b_fu_evidence_of_bounds.log`
part 8): 487 ms of test time in all. Per file 2 to 258 ms. One test takes 50 ms or more:
`drop-retry.test.ts` "waits between two attempts", 94 ms (three waits of 30 ms). None opens a
connection or takes a lock. The largest is 53 times below the default of 5 s: no limit was added.

### 14.6 The bounds inside the helper

| Bound | Value | What today's runs show | Changed |
|---|---|---|---|
| Wait for the clone lock (`lock_timeout` of the helper's session; `CLONE_LOCK_TIMEOUT`) | 120 s | 0 evidence files of other rows hold `CLONE_LOCK_TIMEOUT`. Longest hold by one builder 3.5 s; longest wait measured 1.4 s | No |
| The helper's own hooks (`useTestDatabase`: clone, close, drop) | 180 s | No failure recorded | No |
| Template build: bulk under the clone lock; `tpl_schema` and `tpl_seed` by the global setup | no limit of its own | Bulk 1.2 to 3.5 s (38 runs); the other two 75 to 1,405 ms (200 builds, median 127) | No |
| Sessions must be gone before a template is locked or a database dropped | 5 s | 0 files with "left sessions open" or "sessions are still open" outside this row's deliberate tests | No |
| **Drop retry** | **20 attempts, 250 ms apart (4.75 s of waits)** | Since the fix at 12:27:53 the server log holds 115 refused forced drops: 90 are the deliberate client-leak test (never retried), **25 are real, each refused exactly once**; the next attempt went through every time. About 36,200 databases were dropped in that time (forced checkpoints in the log). 169 summary lines in evidence files: 155 say 0, 11 say 1, 3 are this row's reproduction. The largest number of refusals for one real drop is 1; D76 DN-2 names about 10 | No. The bound stays 20 |
| Connect (`connectionTimeoutMillis`; in a pool it is also the wait for a free connection: at most 5 for `dems_app`, 2 for `dems_owner`) | 5 s | 0 files with a connect time-out | No |
| Reachability probe at the start of a run | 1.5 s | 0 files of other rows with `POSTGRES_UNREACHABLE` | No |
| Teardown of a run | no limit of its own | 121 lines: median 118 ms, longest 1,741 ms; none left a database | No |
| Settle time of `dropDeadRun` (new, section 14.7) | 3 s | New bound | New |

The "7 and 8 refusals" belong to this row's own reproduction on two tables of 600,000 rows
(section 6.2), not to the reset row; no real run has come near them.

**The one place.** It is not a constant of the helper. `db.another()`, `withTestDatabase()`,
`run.createDatabase()`, `run.ensureTemplate()` and `database.drop()` called from inside a test
run under that TEST's limit, 5 s unless the file says otherwise, while the helper may rightly
wait much longer inside them: up to 120 s for the clone lock, and for one drop up to 5 s for
sessions to leave plus 4.75 s of retries. A drop that needs its whole allowance cannot fit into
5 s. The helper's own hooks carry 180 s, so a file that only uses `useTestDatabase` is not
affected.

By a text scan (`assets/11b_fu_other_rows_scan.log`; a list on the level of a hypothesis, the
scan reads words): of 99 database test files outside the helper folder, 31 set limits with
`vi.setConfig`, 44 take their clone through `useTestDatabase` only, and **24 call the helper for
a clone or a template in the file itself and set no limit of any kind** (5 under `test/db/`, 19
under `src/`). Also seen in the whole run of 17:58 on a quiet host: one test of
`src/db/fixtures/__tests__/bulk-fixture.db.test.ts` takes 3,083 ms with the default of 5 s.

### 14.7 A run that was stopped before its teardown (decision D111)

**What was there.** `dems_test_step_64m_tmdoqjg5_f01_backpressure`, `..._tpl_schema`,
`..._tpl_seed`: a run that started at 17:20:43 (its stamp) and was stopped at 17:21.

**Is it dead?** Read as the owner role through the helper's own session at 18:03:51 and again at
18:13:08 (`assets/11b_fu_runs_state_1803.log`, `11b_fu_dead_run_64m.log`):

| Evidence | Result |
|---|---|
| The run's entry in what the helper keeps: the advisory lock `(442002, k)` that the owner of a run holds for as long as its session exists | No session holds it. At both readings no liveness lock was held in the cluster at all |
| Backends on the three databases (`pg_stat_activity`: `datname`, `usename`, `application_name`) | None with a role, none without |
| The owner process | The helper records no process number; the lock is its record. Read from the process list at both times: no Vitest process of this user was running at all |

**The age rule, and why it exists.** The stale sweep drops a database of another run only when
that run is older than six hours (`STALE_AFTER_SECONDS`, the start second is in the stamp) AND
its liveness lock is free. It runs unattended at the start of every `test:db` of every row,
nobody names anything, and it must never touch a run that a parallel row may be using
(TI-12). The lock alone is not enough for that: a run can be in use while its lock is free (its
workers outlive a killed main process for a moment; the helper's own tests close a run and go on
using its database), and age is the one fact the sweep can read from a name. For this run the
rule would have released the databases at 23:20:43.

**What was not done.** The sweep takes its clock from an option that exists for tests. A clock
set six hours ahead would have made every young run on the host look old and left the lock as
the only guard for all of them. That is weakening the guard; it was not used.

**What was built instead**, in the helper (`assets/11b_fu_dead_run.diff`; applied in one command
at **18:12:00**): `TestRun.dropDeadRun(prefix)`, for ONE run that somebody names. The age plays
no part; the helper proves what it can prove and refuses otherwise:

| Step | Check | Refusal |
|---|---|---|
| 1 | The text is exactly a run prefix, `dems_test_<label>_<stamp>_` with its last underscore, and not the caller's own. `dems_demo`, a lane, `postgres`, `template0`, `template1`, a database name, a pattern are not run prefixes | `DbGuardError`, before any statement |
| 2 | The caller is the owner of a run of its own (a test file's attached run cannot) | `RUN_NOT_OWNER` |
| 3 | No session holds the named run's liveness lock: its owner is gone. The caller takes the lock and holds it while it works | `RUN_ALIVE`, after one statement. This is what protects the clones and the templates of a live run |
| 4 | No client session of ANY role is on a database of the run, now and again after a settle time (3 s) | `SESSIONS_REMAIN`, naming role, application and database. Nothing is ended, not even a session of the owner role, which a forced drop would end |
| 5 | Each database goes through the name guard (`guardDeadRunDatabase`: of the named run only) and the usual drop with its bounded retry; clones first, templates after `IS_TEMPLATE false` | Reported as `failed` and `remaining`, read from the catalog |

| File | Change |
|---|---|
| `run.ts` | `dropDeadRun`, `DeadRunReport`, a private read of the client sessions of a prefix |
| `names.ts` | `parseRunPrefix`, `DeadRunClaim`, `guardDeadRunDatabase` (it adds no cast: it ends in the existing guard, applied to the named run) |
| `errors.ts`, `constants.ts` | The code `RUN_ALIVE`; `DEAD_RUN_SETTLE_MS = 3_000` |
| `__tests__/dead-run.test.ts` (new, `unit`) | 69 tests on the stand-in cluster: 27 texts that are not a run prefix (no statement sent); the caller's own run; an attached and a closed run; a live run (one statement, its locked templates stay); a session of the runtime role and of the owner role; a session that connects during the settle time; the two looks; the statements of a clean removal and that the sweep of the same instant leaves that run; the retry; a database that cannot be dropped |
| `__tests__/dead-run.db.test.ts` (new, `db`) | 7 tests against PostgreSQL: a real run closed without a teardown is removed by name while the sweep leaves it; **the run the file itself runs in, and a second live run, are refused with `RUN_ALIVE`** and nothing of them changes; a dead run with a held session of `dems_app`, and of `dems_owner`, is refused and the session still answers; `dems_demo`, the lanes, `postgres`, the templates of PostgreSQL and a database name are refused with the statement count unchanged |

Mutations, on the scratch copy outside the tree (`assets/11b_fu_dead_run_mutations.log`): 11 of
11 caught (a live run not refused; sessions ignored; no second look; the owner role not counted;
the own run; a test file may call; the lock kept; every test database listed; a prefix followed
by more text; the guard passing another run; the guard passing the own run).

**Used for the three databases** (`assets/11b_fu_dead_run_64m.log`; the caller is a short
script outside the tree, `assets/11b_fu_drop_dead_run.mts.txt`, that starts a run and calls the
entry; it builds no statement). First what it refuses on the real cluster, each before any
statement: `dems_demo`, `dems_lane_1_`, `postgres`, `template0`, the prefix without its last
underscore, and `dems_test_step_64m_tmdoqjg5_tpl_schema`. Then:

```
$ DEMS_TEST_STEP=33c node node_modules/tsx/dist/cli.mjs <scratch>/drop-dead-run.mts dems_test_step_64m_tmdoqjg5_
[18:13:08.988] caller: run dems_test_step_33c_tmdr5wgf_* as dems_owner on 127.0.0.1:4432, PostgreSQL 18.4
[18:13:08.988] asked to remove the run dems_test_step_64m_tmdoqjg5_*
[18:13:12.128] dropped 3 database(s) in 3140 ms:
    dems_test_step_64m_tmdoqjg5_f01_backpressure
    dems_test_step_64m_tmdoqjg5_tpl_schema
    dems_test_step_64m_tmdoqjg5_tpl_seed
    remaining with that prefix: 0
    forced drops that needed a retry: 0
[18:13:12.130] caller's run closed: dropped 0, remaining 0
exit=0
```

| | Before (18:13:08) | After (18:13:12) |
|---|---|---|
| `pg_database` | 10 rows | 7 rows: `dems_demo`, `dems_lane_1`, `dems_lane_2`, `dems_lane_3`, `postgres`, `template0`, `template1` |
| The three databases | Present; lock free; no backend | Gone |
| Test runs with a database | 1 (this one) | 0 |
| Liveness locks held | 0 | 0 |

The next whole run printed `stale sweep: dropped 0; kept 0 of younger runs` (18:13:25); the runs
before it had printed `kept 3`.

**Runs that were alive.** At the three readings around the removal (18:03:51, 18:13:08,
18:13:12) no test run had a database or held a liveness lock. At the end state (18:15:32) one
did, and it is another row's: `dems_test_step_74_tmdr9w5x_*`, two databases, started 18:15:32,
its lock held by backend 68199 (application `dems-test-run`). It was not touched; a call that
named it would have been refused at step 3. No other run of the labels the controller named
(67, 69, 70, 48b) had a database at those four instants.

**What the proof does not cover.** A worker process of a stopped run that is still alive but
holds no session on the run's databases cannot be seen from SQL. If its databases are removed,
its next statement fails in a run that no longer has an owner to report to. For this run no
Vitest process existed.

**For the next stopped run.** From `/Users/gsp-budi/Documents/DEMS`, with the sandbox bypass:
a script of the form of `assets/11b_fu_drop_dead_run.mts.txt` and
`DEMS_TEST_STEP=<row> node node_modules/tsx/dist/cli.mjs <script> <prefix>`. There is no npm
script for it: `package.json` is not this row's.

### 14.8 Verification (final state of the tree)

```
$ DEMS_TEST_STEP=33c npm run test:db -w @dems/core-server -- --maxWorkers=2 test/helpers/db      (18:12:10)
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_33c_tmdr4ao5_
[test:db] stale sweep: dropped 0; kept 3 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
 Test Files  12 passed (12)
      Tests  66 passed (66)
   Start at  18:12:10
   Duration  10.59s (tests 98%, import 1%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 4 database(s) in 112 ms; 0 remain with the run prefix dems_test_step_33c_tmdr4ao5_
exit=0

$ npm run test -w @dems/core-server -- --maxWorkers=2 test/helpers/db                              (18:12:21)
 Test Files  9 passed (9)
      Tests  308 passed (308)
exit=0

$ npm run typecheck -w @dems/core-server      (18:12:21)   exit=0
$ npm run lint -w @dems/core-server           (18:12:26)   exit=0
```

Lint printed one warning, in `test/acceptance/rbac-matrix.support.ts` (another row's file, P11,
18:12:26); none in `test/helpers/db`. (Two reporter options that write the JSON report to a
scratch file are left out of the first command line above.)

```
$ DEMS_TEST_STEP=33c npm run test:db -w @dems/core-server -- --maxWorkers=2                       (18:13:25, load average 2.2 to 3.6)
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
 Test Files  109 passed (109)
      Tests  1547 passed | 1 skipped (1548)
   Start at  18:13:25
   Duration  82.41s (tests 82%, import 17%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 216 ms; 0 remain with the run prefix dems_test_step_33c_tmdr6dez_
exit=0
```

No test failed, so no failure outside this folder is to be named. The skipped test is
`src/modules/demo/__tests__/reset-failures.db.test.ts` > "finding F-5 ... PENDING (engine)",
another row's. An earlier whole run, after the limits and before the dead-run entry (17:58:10):
108 files, 1,540 passed, 1 skipped, exit 0. Whole `unit` project at 18:14:58: 142 files, 3,678
tests, exit 0.

End state at 18:15:32 (`assets/11b_fu_final_state.log`): PostgreSQL process 19121, started
07:14:26, `.locks/postgres.pid` 19121; `pg_database` 9 rows: `dems_demo`, the three lanes,
`postgres`, `template0`, `template1`, and the two databases of the live run of step 74 named in
section 14.7; databases with the prefix `dems_test_step_33c`: 0; `dems_owner` and `dems_app` as
before (no superuser, neither `pg_signal_backend` nor `pg_read_all_stats`); settings digest by
the reset row's script `6373391cbc111bce33dc5cf487c0c1e8`, as at 11:00, 11:44 and 12:37.

A last reading at 18:23:17: process 19121; `pg_database` 7 rows (`dems_demo`, the three lanes,
`postgres`, `template0`, `template1`); no test run with a database, no liveness lock held. The
configuration files of the workspace carry their dates of the morning (`vitest.config.ts`
06:33, `apps/core-server/package.json` 07:30, root `package.json` 06:36).

Leak check at 18:22:12: 868 files (the helper folder, this document, the progress file, the 41
assets `11b_*`, the rollback material and the scratch folder) compared in memory with the
password values of the two connection files the helper reads; 0 contain one.

### 14.9 Test ledger of the follow-up (P24)

| Project | Helper folder before (12:28) | After | New file |
|---|---|---|---|
| `unit` | 8 files, 239 tests | 9 files, 308 tests | `test/helpers/db/__tests__/dead-run.test.ts` (69) |
| `db` | 11 files, 59 tests | 12 files, 66 tests | `test/helpers/db/__tests__/dead-run.db.test.ts` (7) |

Whole projects at the end: `db` 109 files, 1,548 tests; `unit` 142 files, 3,678 tests. No test
was removed. Existing tests changed by design: none in their assertions; 14 files got the line
of section 14.3, and one constant of `clone-lock.db.test.ts` went from 60 s to 120 s.

### 14.10 Findings, deviations, decisions

| ID | Finding | Evidence |
|---|---|---|
| FU-1 | The time-outs come with waits for the clone lock inside a test body under the default of 5 s; one bulk build holds the lock 1.2 to 3.5 s. Per event it is a hypothesis | Section 14.2 |
| FU-2 | 24 database test files of other rows ask the helper for a clone or a template in the file and set no limit (text scan) | Section 14.6 |
| FU-3 | `bulk-fixture.db.test.ts`: one test takes 3.1 s on a quiet host under a limit of 5 s | Whole run of 17:58, JSON report |
| FU-4 | Inside one run, the helper's own `templates` and `clone-lock` tests hold the clone lock on purpose (about 1.1 s, 0.35 s, 0.25 s); a file that runs beside them waits that long | Section 14.4 |
| FU-5 | The drop retry has needed one retry at most in real runs; "7 and 8" were this row's 600,000-row reproduction | Section 14.6 |
| FU-6 | `timing.db.test.ts` asserts two sanity bounds (median clone below 4 s; template build, lock wait included, below 20 s). Today: 29 to 31 ms and 44 to 92 ms. Not changed; no evidence of a failure | Baseline runs of 17:49 |
| FU-7 | `drop-retry.db.test.ts` had been corrected by the checkpoint round CP-B1 at 15:27 (an assertion of this row that an autovacuum worker could meet). Kept as it is | `gateway_check/04a_cp_backend_fix_round_a.md` |
| FU-8 | The first diff of this row, `assets/11b_helper.diff`, no longer reverses alone: the two follow-up diffs must be reversed first (rehearsed on a copy: they restore the state of 17:50:28 exactly), and then the checkpoint's edit of `drop-retry.db.test.ts` stands in its way | Rehearsal at 18:19 |

| ID | Deviation | Reason |
|---|---|---|
| FU-DV-1 | The three nested-run fixtures (`selfcheck/*.selfcheck.ts`) got the limits; the brief names `__tests__/*.db.test.ts` | They are database tests with the same exposure, one level down |
| FU-DV-2 | `TEST_TIMEOUT_MS` of `clone-lock.db.test.ts` raised from 60 s to 120 s | One value per file |
| FU-DV-3 | D111 changed helper code (four files), not only tests | The controller's option "build it in the helper with tests" |
| FU-DV-4 | The entry is called through a script kept as an asset; there is no npm script | `package.json` is not this row's |
| FU-DV-5 | The process list was read twice (Vitest processes of this user, start times) | D111: "its owner process is gone" |
| FU-DV-6 | The scratch copies link to `node_modules`, `packages`, `src`, `test/db`, `test/acceptance`, `test/support` and the data folder; the links were removed at the end | Proving outside the tree |

| ID | Question | Recommendation |
|---|---|---|
| FU-DN-1 | FU-2: the 24 files of other rows | Either their owners add the line, or the helper sets the two limits itself where `useTestDatabase` is called (one place, and it would only raise a limit, never lower one). The second covers files that do not exist yet; it also turns a hanging test in any database file from a 5 s failure into a 120 s one. Not done: it changes every row's limits |
| FU-DN-2 | The drop retry (D76 DN-2) | Keep 20 attempts at 250 ms |
| FU-DN-3 | An npm script for `dropDeadRun` | Worth one line in `apps/core-server/package.json` by whoever owns it, for example `test:db:drop-run`, calling a small command file; until then the script of section 14.7 |
| FU-DN-4 | The settle time of 3 s and the rule "no session of any role" for a named removal | Accept |
| FU-DN-5 | FU-3 | Tell the fixture row's owner: that test needs a limit |

Rollback of the follow-up (not executed; rehearsed on a copy outside the repository):

```sh
# from /Users/gsp-budi/Documents/DEMS
git apply -R docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/11b_fu_dead_run.diff
git apply -R docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/11b_fu_test_limits.diff
```

Pre-images: `.cache/rollback/W11b_followup.pre/` (14 files) and `W11b_followup2.pre/` (4 files),
each with a patch that adds them. The three databases of the stopped run are not restored by a
rollback; they were leftovers.

---

### 15. Third follow-up: the helper sets the limits and takes the needs of a test file (decision D134, reassigned by D140/DR-13)

*Written 2026-10-05 16:07 to 16:52 WIB (message time 09:07 UTC), the same day the local variant died. Row label for every database run: `DEMS_TEST_STEP=33d` (DV-W3-1). Pre-images: `.cache/rollback/W11b3/db/` (the whole folder as found, 55 `.ts` files) + `SHA256SUMS`; the two dead attempts' own pre-images (`W11b_followup3.pre/`, `W11b_followup3b.pre/`) are intact and are what the audits below diff against.*

D114 item 3: the helper sets the two limits itself where a test asks for a database, and D134 adds the explicit per-request way to state what a test needs — a wait floor, a connection wait, a quiet cluster — applied inside the helper, with the helper's own tests proving each limit. The work was split across two dead attempts and landed complete in the tree without a report; **this round wrote nothing to the tree**. What it did: audited the handover, proved every limit with the folder's and the projects' runs, ran 11 mutations against the needs mechanism in a scratch copy, removed one stray artifact the dead variant left in `apps/core-server/.cache/`, and measured everything W58 needs (D140: this folder is the last blocker before the backend gate).

**Result**

| Question | Answer |
|----------|--------|
| Is the follow-up finished? | **Yes.** The limits mechanism (round A, Oct 4) and the needs mechanism (round B, Oct 5) are both complete in the tree, each proven by its own test files; this round verified and measured them. **Zero writes to `test/helpers/db` were needed.** |
| The three reds D140 named? | `static.test.ts`, `clone-lock.db.test.ts`, `needs.db.test.ts` — all pass, alone (16:10) and in every folder and project run. The reds tracked the dead agent's live edits (its last saves were 10:46–10:57; D140 was written 10:33, and B2b's own report says the helper red count "grew and shifted… tracking that agent's live edits"). |
| Helper database project | `npm run test:db -w @dems/core-server -- test/helpers/db`: exit 0, **15 files / 90 tests** (12→15 files, 66→90 tests; was 11/60 before W11b, 12/66 after W11b and after follow-up 2). Repeat 16:25 exit 0. |
| Helper database-free project | `npm run test -w @dems/core-server -- --maxWorkers=2 test/helpers/db`: exit 0, **11 files / 394 tests** (9/308 after follow-up 2; +18 `limits.test.ts` +66 `needs.test.ts` +2 F-8 tests in `static.test.ts`). |
| Whole `db` project | `DEMS_TEST_STEP=33d npm run test:db -w @dems/core-server`: exit 0, **122 files / 1,740 tests** (D139's 121/1,727 + `needs.db.test.ts` 13), twice (16:28 load 10.75, 16:32), 0 retries, **0 databases left with the prefix `dems_test_step_33d_`** after every run. |
| Whole `unit` project | `npm run test -w @dems/core-server -- --maxWorkers=2`: first run (16:29) exit 1 — 2 failures in another row's `test/static/audit-protection.test.ts`, caused by a stray JSON report the dead variant left in `apps/core-server/.cache/` (15.8), not by the helper; after the cause was ended, exit 0: **153 files / 3,912 tests** (16:34). |
| Typecheck, lint | `npm run typecheck -w @dems/core-server` exit 0; `npm run lint -w @dems/core-server` exit 0, no warning (16:38). |
| Guard script | `npm run test:db:drop-run`: no args → usage, exit 2; `-- dems_demo` → **REFUSED (GUARD_NOT_A_TEST_DATABASE)** before any statement, exit 1 (16:35:19, quoted in 15.7). |
| The flake | D114's own symptom — `clone-lock.db.test.ts` at 5 s and `timing.db.test.ts`'s drop at 10 s under load: the caps are now applied by the helper itself to every importing file of the database project, so the 24 exposed files (14.2) needed no edit and no file inside the helper states the limits by hand any more. Whole-db ran green at load 10.75/8.13 (quote 15.7), the class of load the symptom needed. |
| Mutations | **11 of 11 caught** against the needs mechanism in a scratch copy outside the repository (15.8), on top of the 9 limits mutations round A had already run (its own `assets/11b_fu3_mutations.log`). |
| The cluster | PID 19121, started Oct 4 07:14:26, never stopped or restarted; `pg_database` 7 rows; roles unchanged; settings digest `6373391cbc111bce33dc5cf487c0c1e8` — the same as 11:00/12:37/13:01/18:15 and as every other row's final check; 0 advisory locks; 0 backends on test databases at 16:38. |

#### 15.1 The state as found, and what the two dead attempts each left

The handover (D140/DR-13) described one dead predecessor; the tree holds the work of **two**:

| What | Written by | Evidence |
|------|-----------|----------|
| `index.ts`: `applyDatabaseTestLimits()` run at import in a database project, `raisedTestLimits`, `currentTestLimits`, `isNoLimit`; the per-file cap lines removed from the 12 `__tests__/*.db.test.ts` and 3 `selfcheck/*.selfcheck.ts`; `constants.ts` gained `DB_TEST_TIMEOUT_MS`/`DB_HOOK_TIMEOUT_MS`; new `__tests__/limits.test.ts` (18), `limits.db.test.ts` (6), `limits-own.db.test.ts` (5) | **Round A — the first D134 attempt, Oct 4 ~20:35–22:05**, died at the session break. It measured itself: whole db 121/1,719 exit 0 at 20:50, whole unit 148/3,812 exit 0 at 20:50, helper unit 10/325 at 20:47, its own limits mutations M0–M9 — its assets are all in the folder: `11b_fu3_db_whole.log`, `11b_fu3_unit_whole.log`, `11b_fu3_helper_db.log`, `11b_fu3_helper_unit.log`, `11b_fu3_helper_limits.diff`, `11b_fu3_limits_probe.log`, `11b_fu3_mutations.log`, `11b_fu3_sample_durations.log`, `11b_fu3_tree_scan.log`, `11b_fu3_whole_ab.log`, `11b_fu3_final_state.log` (Oct 4 20:51–20:55). Its `.cache/rollback/W11b_followup3.pre.patch` is empty: it died before writing the patch and the report. | diff vs `W11b_followup3.pre/` → `assets/11b_fu3_roundA_limits.diff` (759 lines, 17 files) |
| `constants.ts`: `DB_NEED_MAX_MS` 900 s, `CLUSTER_QUIET_BUDGET_MS` 5 s; `errors.ts`: `NEEDS_INVALID`; `index.ts`: `DatabaseNeeds` + `normalizeNeeds`/`limitsWithNeeds`/`helperHookTimeout`/`connectTimeoutWithNeed` + the wiring into `useTestDatabase`, `another` and `withTestDatabase`; `session.ts`: per-pool `connectTimeoutMs`; `run.ts`: `TestDatabase.#needs`, `CloneTiming.quiet`, `clusterQuietBudgetMs`; `ddl.ts`: `cloneLockSessionsElsewhere` + `waitForQuietCluster`; `testing/fake-cluster.ts` answers the new `pg_locks` read; new `__tests__/needs.test.ts` (66), `needs.db.test.ts` (13); `static.test.ts` updated (pool-line count 2→3, new F-8 describe) | **Round B — the local variant that died mid-task Oct 5 ~10:17–10:57** (D140's reopen). It left no measurement and no report; its last saves (10:46–10:57) are what turned D140's named reds green. | diff vs `W11b_followup3b.pre/` → `assets/11b_fu3_roundB_needs.diff` (674 lines, 8 files) |
| `provided.ts`, `dead-run.test.ts`, `dead-run.db.test.ts` | **Not round-3 work** — the handover's list is partly wrong. `provided.ts` dates from W11 itself (Oct 4 07:47; named in `11_db_test_helper.md` §4 and in `static.test.ts`'s file list); the dead-run pair is D114 item 2 / follow-up 2 (Oct 4 18:12/20:47, section 14.7). Content confirms both. (Finding W3-2.) | file dates, section 14 |

**Audit of the landed code (read in full, against the contract):** the needs fields are validated where they are stated and refused with `NEEDS_INVALID` before anything is asked of the cluster (`index.ts:222`–`257`); a stated limit is only ever a floor (`limitsWithNeeds`: never below the D114 caps, never touching "no limit" — a session started with `--test-timeout=0` stays open); the helper's own hooks never fall below 180 s (`helperHookTimeout`); `connectTimeoutMs` reaches only that clone's two pools, TI-14's five and two ceilings unmoved (`run.ts:672`–`678`, `session.ts:247`–`253`); `quietCluster` costs nothing where it is not asked (`QUIET_NOT_ASKED`, `run.ts:570`); and the queue read is keyed by its own session — `pid <> pg_backend_pid()` (`ddl.ts:348`), which is finding F-8 of 29_db_reset_routine section 21 applied to the new read, with `static.test.ts:240`–`254` pinning that `pg_locks` is read in `ddl.ts` only and that this one read is keyed. No `pg_stat_activity` read was added; no session is ended by any needs path. The public shape is backward compatible: `needs` is optional everywhere, `timings.quiet` is an addition; **no file outside `test/helpers/db/**` was edited by any round of this follow-up** (verified against the pre-images).

#### 15.2 What the helper now does where a test asks for a database

- **At import** (round A): in a run of the database project, `index.ts` raises the runner's two limits for the importing file — 5 s → 120 s per test, 10 s → 180 s per hook — never lowering, never raising "no limit" (`applyDatabaseTestLimits`, `index.ts:296`–`301`). The 24 files follow-up 2 exposed (14.2) are covered without an edit; the 14 module-row files that set their own lower limits (60 s/120 s) keep them — the imports run first, `vi.setConfig` in the file body after — pinned by `limits-own.db.test.ts`.
- **Per request** (round B): `useTestDatabase({ template, needs })` with `needs.testTimeoutMs`/`needs.hookTimeoutMs` (floors up to `DB_NEED_MAX_MS` = 900 s, raised at registration and again by `db.another`), `needs.connectTimeoutMs` (the wait floor of both pools of that clone, never below the helper's own 5 s) and `needs.quietCluster` (look for an empty clone-lock queue before each clone, at most 5 s, reported as `timings.quiet {waitedMs, obtained, budgetMs}`; it takes no lock, ends nothing, and clones anyway when the bound passes — the same rule as the bounded drop retry). The same options reach `withTestDatabase` and `db.another` (`index.ts:199`–`210`, `439`–`476`).

#### 15.3 The tests that prove each limit (P24 ledger)

| File | Project | Tests | Proves |
|------|---------|-------|--------|
| `limits.test.ts` (new, 18) | unit | the raise-only rule, "no limit" kept, NaN → cap, unreadable limits → caps, a database-free import keeps its limits |
| `limits.db.test.ts` (new, 6) | db | in a real database run: a file with **no limit line of its own** is at ≥ 120 s/180 s before its first hook is registered; a limit on one test stays that test's own |
| `limits-own.db.test.ts` (new, 5) | db | a file's own later limits win, lower or higher; the helper never re-raises them while the file runs |
| `needs.test.ts` (new, 66) | unit | every refusal (`NEEDS_INVALID`: zero, negative, fraction, NaN, infinity, above the ceiling, non-boolean quiet); the floor semantics; the helper-hook floor; the connect floor; on the stand-in cluster: the reads and their order (`FROM pg_locks` before the `CREATE DATABASE`), asking again while busy, giving up at the bound, **no lock taken for the wait**, the budgets, the defaults |
| `needs.db.test.ts` (new, 13) | db | against the real server: the floors apply and `task.timeout` is the stated one; both real pools carry the connect floor with TI-14's ceilings; a refusal happens with 0 statements sent; the keying read shows `counted 1, keyed by the reader 0` while this very session holds the clone lock (`assets/11b_fu3_needs_console.log`); a quiet request on a busy lock waited 200 ms of its 200 ms bound, did not end the holder, and cloned in 38 ms |
| `static.test.ts` (updated, 17→19) | unit | the pool now reads `connectionTimeoutMillis:` in three places; the new F-8 describe pins the one keyed `pg_locks` read |

Folder: database-free 9→11 files, 308→394 tests; database 12→15 files, 66→90 tests. Whole projects: `unit` 153/3,912 (D130's 08:59 baseline 152/3,845 = +66 +2 here, and −1 in a non-helper file landed by the fix rounds that rewrote a test this morning — finding W3-5); `db` 122/1,740 = D139's 121/1,727 + 13, exact.

#### 15.4 What this round did, and did not do

Read the whole folder against the contract; audited both pre-images; saved its own pre-images; ran the measurements below; ran 11 mutations in a scratch tree; found and moved the stray artifact; wrote this section, the round-3 `11b_fu3_*` assets and `delegation_progress/database_specialist_step_w11b3.md`. It changed **no line of any program**: the audit found nothing to fix (the tree hashes were re-checked against the pre-image after every phase: unchanged). It touched no other row's file, `scripts/pg/**`, `src/db/schema`, any migration, role, grant or setting; the cluster was never restarted or stopped. Every database command ran as `dems_owner` with `DEMS_TEST_STEP=33d` and the per-command bypass (P10, P15; DV-W3-2: in this session the TCP bypass applied without a visible denial; recorded as-is).

#### 15.5 The three named reds (D140), proven green

| File | Alone | In the folder | In the whole project |
|------|-------|---------------|----------------------|
| `static.test.ts` | 19 passed, exit 0, 16:10:23 | 11/394 exit 0 (16:12) | 153/3,912 exit 0 (16:34) |
| `clone-lock.db.test.ts` | 3 passed, exit 0, 16:10:41 (prefix `…tmfg5twb_`, 0 remain) | 15/90 exit 0 (16:11, 16:25) | 122/1,740 exit 0 ×2 (16:28, 16:32) |
| `needs.db.test.ts` | 13 passed, exit 0, 16:10:32 (prefix `…tmfg5k69_`, 0 remain) | ditto | ditto |

#### 15.6 What it took

| File | Lines | What |
|------|-------|------|
| `implementation/11b_db_helper_forced_drop_retry.md` | +~120 | this section; the front-matter `follow_up:` line names it |
| `assets/11b_fu3_folder_db.log`, `11b_fu3_whole_db_1.log`, `11b_fu3_whole_db_2.log` | 19/54/54 | the folder command and both whole-db runs, in full |
| `assets/11b_fu3_whole_unit_1_with_stray.log`, `11b_fu3_whole_unit_2.log`, `11b_fu3_new_file_counts.log`, `11b_fu3_typecheck_lint.log` | 71/13/21/12 | the red unit run with the stray cause, the green repeat, per-file counts, the two gates |
| `assets/11b_fu3_droprun_guard.log`, `11b_fu3_cluster_state.log`, `11b_fu3_needs_console.log` | 13/17/28 | the guard's usage and refusal, the final cluster state (W29's read-only script, DV-W3-3), the keying/quiet console lines |
| `assets/11b_fu3_needs_mutations.log` | 54 | the 11-mutation loop: apply → catch → revert per mutation |
| `assets/11b_fu3_roundA_limits.diff`, `assets/11b_fu3_roundB_needs.diff` | 759/674 | what each dead attempt actually wrote, reconstructed from its own pre-image — also the way to undo round A or B if the controller ever wants to |
| `assets/11b_fu3_stray_report.log` | 13 | the stray JSON: path, mtime 11:06, size, sha256, counts of the two forbidden phrases (counts only, no excerpt), where it was moved to |
| `delegation_progress/database_specialist_step_w11b3.md` | new | the handover file for this row |

#### 15.7 Proofs

```text
$ DEMS_TEST_STEP=33d npm run test:db -w @dems/core-server -- test/helpers/db          (16:25:05)
 Test Files  15 passed (15)   Tests  90 passed (90)   exit=0
 [test:db] forced drops that needed a retry: 0
 [test:db] teardown: dropped 4 database(s) in 179 ms; 0 remain with the run prefix dems_test_step_33d_tmfgtt3k_
   (the same command at 16:11: exit 0, 15/90, prefix tmfg6kbl_, 0 remain; and the unit half:
    npm run test -w @dems/core-server -- --maxWorkers=2 test/helpers/db → exit 0, 11/394 at 16:12)
```

```text
$ DEMS_TEST_STEP=33d npm run test:db -w @dems/core-server                              (16:25:21–16:28)
 Test Files  122 passed (122)   Tests  1740 passed (1740)   exit=0
 [test:db] forced drops that needed a retry: 0
 [test:db] teardown: dropped 8 database(s) in 475 ms; 0 remain with the run prefix dems_test_step_33d_tmfguamo_
 load at end: 10.75 7.64 5.78        (the other two agents were running; the run stayed green)
$ DEMS_TEST_STEP=33d npm run test:db -w @dems/core-server                              (16:29:48–16:32, the repeat that shows the flake is gone)
 Test Files  122 passed (122)   Tests  1740 passed (1740)   exit=0     0 remain with the run prefix     load 8.13 7.53 6.14
$ npm run test -w @dems/core-server -- --maxWorkers=2                                  (16:34:29)
 Test Files  153 passed (153)   Tests  3912 passed (3912)   exit=0
   — the first run of 16:29 was exit 1: 2 failed | 3,910 passed, both in test/static/audit-protection.test.ts,
     caused by the stray artifact of 15.8 (recorded per P11: red run assets/11b_fu3_whole_unit_1_with_stray.log,
     green repeat assets/11b_fu3_whole_unit_2.log; audit-protection alone then ran 9/9 exit 0 at 16:33)
```

| File | Project | Tests |
|------|---------|-------|
| `limits.test.ts` | unit | 18 passed, exit 0 |
| `needs.test.ts` | unit | 66 passed, exit 0 |
| `static.test.ts` | unit | 19 passed, exit 0 |
| `limits.db.test.ts` | db | 6 passed, exit 0 |
| `limits-own.db.test.ts` | db | 5 passed, exit 0 |
| `needs.db.test.ts` | db | 13 passed, exit 0 |

**The guard** (`apps/core-server/test/drop-dead-run.ts`, another row's file — run, not edited):

```text
$ npm run test:db:drop-run -w @dems/core-server                     (16:35:19)   exit=2
 usage: drop-dead-run.ts <run prefix: dems_test_<label>_<stamp>_>   (one prefix, exactly)
$ DEMS_TEST_STEP=33d npm run test:db:drop-run -w @dems/core-server -- dems_demo   (16:35:19)   exit=1
 [16:35:19.865] caller: run dems_test_step_33d_tmfhav9x_* as dems_owner on 127.0.0.1:4432, PostgreSQL 18.4
 [16:35:19.866] asked to remove the run dems_demo*
 [16:35:19.866] REFUSED (GUARD_NOT_A_TEST_DATABASE): refused before any statement: "dems_demo" is not the
                prefix of a test run (dems_test_<label>_<stamp>_, with its last underscore).
 [16:35:19.868] caller's run closed: dropped 0, remaining 0
```

**Typecheck and lint** (16:38:07 / 16:38:14): both exit 0, no warning: `assets/11b_fu3_typecheck_lint.log`.

**The cluster at the end** (16:38:33, the reset routine's read-only evidence script, run once, DV-W3-3): `assets/11b_fu3_cluster_state.log` — `dems_owner` (superuser false) on 127.0.0.1:4432, PostgreSQL 18.4, postmaster started 2026-10-04 07:14:26 (PID 19121, the `.locks/postgres.pid` line unchanged the whole day); `pg_database` 7 rows (demo, three lanes, `postgres`, `template0/1`); **no `dems_test_*` database of any run, none with the prefix `dems_test_step_33d_`**; the three roles as W02/W03 left them; 375 visible settings, digest `6373391cbc111bce33dc5cf487c0c1e8` — the same as 11:00/11:44/12:37/13:01 and as follow-up 2 at 18:15; 0 advisory locks; 1 client session (the script's own, ended).

**What this follow-up did not do:** no program line was written by this round; nothing was deleted (the one file moved out of the tree is preserved with its hash); no role, grant, `pg_hba` or server setting touched; nothing under `scripts/pg/**` written; no file outside `apps/core-server/test/helpers/db/**` edited; the cluster never restarted or stopped; no credential or connection value appears in any file or log (15.10).

#### 15.8 The 11 mutations of the needs mechanism

Scratch tree outside the repository (`$TMPDIR/kilo/w11b3/tree`: copies of `test/helpers/db` and `test/static`, links for `src`/`node_modules`/`packages`/`.data`); baselines green before the loop (unit 103, db 24) and after it; the repository tree hash-verified untouched. Full apply/catch/revert log: `assets/11b_fu3_needs_mutations.log`.

| ID | Mutation | Caught by |
|----|----------|-----------|
| M1 | a stated need becomes a CEILING: `max`→`min` in `limitWithStatedNeed` | 16 tests: `needs.test.ts` (the floor rules, "never turns a cap… into a shorter limit") + `needs.db.test.ts` (the floors, the stated `task.timeout`) |
| M2 | the ceiling `DB_NEED_MAX_MS` is not checked | 7 `needs.test.ts` refusals ("one above the ceiling", "a value in seconds instead of milliseconds", infinity) |
| M3 | the helper's own hooks may be shortened by a stated need | `needs.test.ts` "are never shortened by a file that states a shorter hook need" |
| M4 | the connect floor drops below the helper's own 5 s | `needs.test.ts` "is never shortened below the helper's own 5 s" |
| M5 | the driver ignores the stated connect wait (`options.connectTimeoutMs ??` removed) | 7 tests: `needs.test.ts` pools, `needs.db.test.ts` "hands the connect floor to the two real pools…" + `static.test.ts`'s D26 line count |
| M6 | the quiet request is ignored (always `QUIET_NOT_ASKED`) | 7 tests: `needs.test.ts` stand-in reads/order/retry/give-up + `needs.db.test.ts`'s quiet group |
| M7 | the queue read loses its keying (`pid <> pg_backend_pid()` removed — the F-8 regression) | `static.test.ts` F-8 "and that one read leaves its own session out" |
| M8 | the import-time raise becomes a lowering (`raisedLimit` returns current) | 14 tests: `limits.test.ts` rules + `limits.db.test.ts` atCollection + `limits-own.db.test.ts` |
| M9 | the import-time side effect is removed | 5 tests: `limits.db.test.ts` + `limits-own.db.test.ts` (and every folder file would flake at 5 s — round A's probe, `assets/11b_fu3_limits_probe.log`, showed exactly this symptom) |
| M10 | the whole-number check is removed | 7 refusals: `needs.test.ts` fraction/NaN per field + `needs.db.test.ts` "refuses a need that is no whole number of milliseconds" |
| M11 | `db.another` applies the file's connect need instead of the merged one | `needs.db.test.ts` "applies a need stated inside a running test to its own clone, not to the test's limit" |

**11 of 11 caught** — every limit the helper sets, and every need a file states, has a test that fails when the rule is broken. (Round A had already mutated the limits half: its M0–M9 table, including "M9 survived → `limits-own.db.test.ts` was strengthened", is in `assets/11b_fu3_mutations.log` from 20:29.)

**The stray artifact.** The dead local variant ran its whole-db proof with `--reporter=json --outputFile.json=.cache/w11b3-db-whole.json`, which lands in `apps/core-server/.cache/` — **inside** the workspace that `test/static/audit-protection.test.ts` scans. The file is git-ignored (`.gitignore:47`) but `SKIPPED_DIRECTORIES` (`apps/core-server/test/static/scan.ts:19`) does not skip `.cache`, so its minified line 1 — carrying the words `session_replication_role` and `DROP DATABASE` from the names of other rows' tests — matched both T-AO-4 guards red (1 occurrence per rule). This round moved the file out of the tree (nothing deleted; sha256 `2ad511cd4bbd79815c92757b3f670cfb1ecd1bd23bea900caec1d46e00f29266` recorded in `assets/11b_fu3_stray_report.log`, copy preserved in `$TMPDIR/kilo/w11b3/stray/`); `audit-protection.test.ts` then passed 9/9 and the whole unit went green. **That file is another row's and not mine to fix** — finding W3-3 hands the durable fix to the controller: either add `.cache` to `SKIPPED_DIRECTORIES` (`test/static/scan.ts:19`), or tighten D30: a json report's `--outputFile` must point at the repository-root `.cache/` (where the checkpoint rounds write), never `apps/core-server/.cache/`.

#### 15.9 Ledger for the controller (P24)

| Project | Before this follow-up | After |
|---------|------------------------|-------|
| database-free, `test/helpers/db` | 10 / 326 at the 09:07 handover (round A's files landed, round B's did not) | **11 / 394** exit 0 |
| database, `test/helpers/db` | 14 / 77 (round A: 12/66 + `limits.db` 6 + `limits-own.db` 5) | **15 / 90** exit 0 (the handover's "db project 15 files" counted `needs.db.test.ts` early: 66+6+5+13 = 90) |
| `db` project whole | 122 / 1,727 (D139 measured 121/1,727 before the limits trio; then +6 +5) | **122 / 1,740** exit 0 twice, 0 retried drops, 0 remain (33d) |
| `unit` project whole | 152 / 3,845 at D130's 08:59 baseline; round A measured 148/3,812 at 20:50 on Oct 4 | **153 / 3,912** exit 0 (first 16:29 run exit 1 by the stray artifact — finding W3-3 — repeat green) |
| typecheck / lint | exit 0 both (D139) | exit 0, no warning, 16:38 |
| folder delta, exact | unit 308 + 18 (limits) + 66 (needs) + 2 (static F-8) = 394 | db 66 + 6 + 5 + 13 = 90 |

#### 15.10 Credentials

This follow-up printed and wrote no value from any connection file. The files written this round — this section, the round-3 `11b_fu3_*` assets, `delegation_progress/database_specialist_step_w11b3.md`, the stray report — were compared in memory against the two role passwords and the demo operator password: the passwords match **zero** files, and the strings in the folder and documents are field names only (`dems_pg_owner_password`, `dems_pg_runtime_password`, `pool_password`). Re-checked after this section and the assets were written: `assets/11b_fu3_no_credential.log` (counts and file list only; the moved `.cache` JSON was scanned too and holds none).

#### 15.11 Findings, deviations, decisions

| Ref | Item | Detail |
|-----|------|--------|
| F W3-1 | Handover verified | The folder as found was **complete but unmeasured**: round A's limits half (fully measured Oct 4, no report) + round B's needs half (code and tests complete, zero measurements). Nothing was missing; no line needed fixing. |
| F W3-2 | D140's list partly wrong | `provided.ts` is W11-original, the dead-run pair belongs to follow-up 2 — the actual round-3 additions are the five `limits.*`/`needs.*` test files, the 20:47 strip and the eight round-B files (15.1). |
| F W3-3 | Scan gap outside this row | `test/static/scan.ts:19` does not skip `.cache`, and `test/static/audit-protection.test.ts:82,90` read the whole workspace — any json test report written under `apps/core-server/.cache/` reddens another row's T-AO-4 guard. Cured this round only by moving the stray file; the durable fix (add `.cache` to the skip set, or tighten D30's `--outputFile` rule) belongs to the owner of `test/static` — **file:line reported, not edited**. |
| F W3-4 | The three reds | All three pass alone, in the folder, in both whole projects, twice. **No residual helper flake found in any run.** |
| F W3-5 | Whole-unit −1 | 3,845 + 68 (this folder) = 3,913 against the 3,912 measured: one test in a non-helper file was removed or rewritten by the fix rounds that landed between 09:00 and 16:34 (consistent with D139 items 9/12); not this row's path, reported for the ledger owner. |
| F W3-6 | Load guard (P9) | The first whole-db proof **ended** at 1-minute load 10.75 (started below the threshold, no lane-3 use, nothing paused); exit 0 regardless. Recorded for the gate. |
| DV W3-1 | Label | Round A used `DEMS_TEST_STEP=33d` on Oct 4; this round kept 33d. No other label was used, and no other row's databases were touched by any run (0 stale swept every run). |
| DV W3-2 | Bypass (P10) | Every database command ran with the per-command bypass; in this session no sandbox denial occurred, so none needed lifting. |
| DV W3-3 | Borrowed script | The reset routine's read-only evidence script (`assets/29_cluster_state.ts.txt`) run once, as-is, from `$TMPDIR`. |
| DV W3-4 | Scratch | Mutations only outside the tree; the tree hashes re-checked unchanged after the loop (house rule M15). |
| DN W3-1 | **D134/D114 item 3 closed** | The helper applies the limits itself at import; `needs` is the public per-request shape (`testTimeoutMs`, `hookTimeoutMs`, `connectTimeoutMs`, `quietCluster`; ceiling `DB_NEED_MAX_MS` 900 s; quiet bound 5 s; refusal code `NEEDS_INVALID`; report field `timings.quiet`). Backward compatible: no other row's test file was edited by any round and none needs an edit. The controller may close D134 and schedule W58. |
| DN W3-2 | What "connection limit" means here | Realized as the `connectTimeoutMs` wait floor. TI-14's pool ceilings (5 app / 2 owner) are deliberately NOT opened per request: they are a contract invariant, and every test that touches a pool re-pins them. |
| DN W3-3 | Cap lines kept elsewhere | The 19 module-row files that still set the caps explicitly are left to their owners — they duplicate the helper's raise harmlessly (a limit at the cap is kept); removal is optional cleanup, not part of this row. |
| DN W3-4 | Stray cleanup done in this row | The dead variant is this row's predecessor; its scratch artifact was moved, not deleted, and the scan gap reported rather than fixed — the `test/static` owner decides (F W3-3). |

#### 15.12 Rollback of this follow-up

Nothing to roll back: **this round changed no tree file** (hashes re-verified against `.cache/rollback/W11b3/SHA256SUMS`, taken 16:08 before any command). The one move it made out of the tree — the stray `.cache` JSON — is reversible by putting the preserved copy back. Should the controller want to undo the follow-up's landed work instead: `assets/11b_fu3_roundB_needs.diff` (needs half) and `assets/11b_fu3_roundA_limits.diff` (limits half) apply in reverse against the state as found; the authoritative pre-states are `.cache/rollback/W11b_followup3b.pre/` (before round B) and `.cache/rollback/W11b_followup3.pre/` (before round A). Per house rule M15 these forward diffs are not re-applied blindly: round B's intermediate states were never snapshotted.

#### 15.13 Verification checklist

| Check | Result |
|-------|--------|
| State established first | `git status --porcelain` (whole folder untracked against `accaff20`), both predecessors' pre-images diffed, every new file read in full — 15.1 |
| Handover claims verified, not trusted | provided.ts/dead-run pair corrected (F W3-2); the named reds proven green by running them (15.5) |
| Goal of D114 item 3 met and proven | caps applied by the helper at import; needs applied per request; every limit has a failing test when mutated (11/11 + round A's 9); the six files that prove it = 108 new tests |
| Public shape backward compatible | `needs` optional; `timings.quiet` additive; the 14 files with lower own limits keep them (pinned by `limits-own.db.test.ts`); no other row's file edited or needing an edit (15.4) |
| Whole folder green | unit 11/394 exit 0, db 15/90 exit 0, the exact commands quoted (15.7) |
| Whole projects green | db 122/1,740 exit 0 twice (the repeat proves the flake is gone; 0 retries, 0 left with the prefix); unit 153/3,912 exit 0 with both runs recorded (P11) |
| typecheck / lint | exit 0, no warning |
| Guard script | refuses a non-test database (`GUARD_NOT_A_TEST_DATABASE`, before any statement, exit 1); usage exit 2 |
| Rules kept | no role/grant/pg_hba/setting touched; nothing under `scripts/pg/**`; nothing deleted; cluster PID 19121 never restarted; settings digest unchanged; `dems_admin` never used; no credential printed |
| Documentation contract | section 15 appended, sections 3–14 untouched (only the front-matter `follow_up:` line names it); only this row's progress file written; `status_tasks.md`/`delegation_progress_report.md`/`decisions/decisions.md` untouched |

---
*Generated: 2026-10-04 12:36 WIB · Last Updated: 2026-10-05 16:52 WIB (section 15: third follow-up of W11b, decisions D114/D134 — the two dead attempts' work verified, measured and closed; final folder re-run 16:51 exit 0, prefix `tmfhznft_`, 0 remain; tree hash-verified unchanged since the 16:08 pre-image)*
