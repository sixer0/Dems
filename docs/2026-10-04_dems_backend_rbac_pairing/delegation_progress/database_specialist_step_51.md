---
task_id: 2026-10-04_dems_backend_rbac_pairing
blueprint_row: 51
plan_row: W29
agent: database-specialist (tier R)
date: 2026-10-04
status: complete
artifact: implementation/29_db_reset_routine.md
---

# Step 51 (W29): the reset routine HB-3, `db:reset`, and the three lane databases

Times are WIB. No credential value appears in this file.

## Status

**complete** for everything the row owns. The whole `db` project exits 1 in four tests of three
files that belong to rows running at the same time (the engine-host row now registers a boot step
that other rows' boot-check tests pin). Every test of this row passes in each of those runs.
Detail: `implementation/29_db_reset_routine.md` section 13.4.

## Milestones

| Time | What |
|---|---|
| 10:58 to 11:00 | Baseline: `unit` 41 files / 1,281 tests, `db` 27 files / 382 tests, both exit 0; `db:status dems_demo` recorded; PostgreSQL PID 19121; `pg_database` held `dems_demo` and no lane |
| 11:00 to 11:16 | Routine written (`src/db/reset`: `routine.ts`, `names.ts`, `kept-tables.ts`, `plan.ts`, `errors.ts`, `cli.ts`, `index.ts`); typecheck exit 0 |
| 11:16 to 11:17 | First resets on a test database passed end to end; one defect of the row's own found and fixed (an `ORDER BY` on a text alias) |
| 11:22 | Failure matrix: a forced failure at each of the 15 checkpoints before the swap, and real failures at R-0 to R-8; the target untouched every time |
| 11:22:56 to 11:24:22 | The test helper's forced drop of one of this row's databases was refused (an autovacuum worker was on it); proven from the database's statistics; the leftover dropped with a plain drop; the row's tests now drop their databases plainly first |
| 11:31 to 11:34 | Unit tests (6 files, 157), database tests (4 files, 69); whole `unit` and whole `db` green with this row's files |
| 11:36:42 to 11:36:43 | **`dems_lane_1`, `dems_lane_2`, `dems_lane_3` built** by `db:reset` under `.locks/db-migrate.lock`: exit 0 each, 162 to 163 ms each; `db:status` exit 0 each: owner `dems_owner`, 301 rows in 21 of 30 tables, lineage 0 |
| 11:37:32 | The three lanes read as `dems_app` through the server's loader (port 4421 to 4423): boot checks B-2 to B-9 pass, B-8 `digests=ok` |
| 11:41:17 | Row command exit 0: 4 files, 69 tests. Typecheck and lint exit 0 (11:41:06) |
| 11:44:24 | End state: `dems_demo` and the three lanes, no leftover; `db:status dems_demo` identical to 10:58:44; PID 19121 unchanged |
| 11:45 | Whole `unit`: 51 files, 1,541 tests, exit 0. Whole `db`: 468 of 472, the 4 failures in files of other rows |

## Files created (all new; nothing else was edited)

`apps/core-server/src/db/reset/`: `routine.ts`, `names.ts`, `kept-tables.ts`, `plan.ts`,
`errors.ts`, `cli.ts`, `index.ts`; `__tests__/reset.db.test.ts`,
`__tests__/reset-failures.db.test.ts`, `__tests__/guard.db.test.ts`, `__tests__/cli.db.test.ts`,
`__tests__/guard.test.ts`, `__tests__/names.test.ts`, `__tests__/kept-tables.test.ts`,
`__tests__/plan.test.ts`, `__tests__/cli.test.ts`, `__tests__/static.test.ts`,
`__tests__/support.ts`, `__tests__/pools.ts`, `__tests__/guard-cases.ts`.

Documents: `implementation/29_db_reset_routine.md`, this file, and 27 evidence files
`implementation/assets/29_*`.

Host change (H-15): the databases `dems_lane_1`, `dems_lane_2`, `dems_lane_3` in the project-local
cluster on `127.0.0.1:4432`, owner `dems_owner`, seeded as of 2026-10-04 11:36:42 to 11:36:43 WIB.
`dems_demo` was not reset and not changed.

Not edited, on purpose: `masterplan/02_plan.md` (a shared file in a parallel run; the controller
updates the tracking row), `delegation_progress_report.md`, `status_tasks.md`,
`decisions/decisions.md`.

## Verification (quoted in the artifact)

| Check | Result |
|---|---|
| `DEMS_TEST_STEP=51 npm run test:db -w @dems/core-server -- src/db/reset` | exit 0; 4 files, 69 tests (11:41:18); T-RS-1 to T-RS-6 in it |
| Two resets: two lineage rows, the first byte-equal | Yes; the row is quoted in section 6 |
| The routine's sessions | `dems_owner` only, at most two, none after R-9 |
| A stubbed superuser answer | `RESET_ROLE_PRIVILEGED` before R-1; one statement sent |
| Kept tables | Byte-equal after one and after two resets (record dump and contract checksum) |
| A failure before the swap | Target untouched: same OID, same digest of all 30 tables, nothing left; 15 forced, and real ones at every step |
| `db:reset` for the three lanes; `db:status` | exit 0 each; seed counts, owner `dems_owner` |
| `db:status dems_demo` before and after | The same 45 lines |
| `npm run typecheck -w @dems/core-server`; `npm run lint -w @dems/core-server` | exit 0; exit 0 |
| `npm run test -w @dems/core-server -- --maxWorkers=2` | exit 0: 51 files, 1,541 tests (11:45:02) |
| Whole `db` project | exit 1: 468 of 472 (11:45:21); the 4 failures are `test/db/boot-checks.db.test.ts` (1), `src/core/__tests__/boot-checks.db.test.ts` (2), `src/core/__tests__/seeded.db.test.ts` (1): not this row |
| No credential | The two documents, the 27 evidence files and `src/db/reset/**` searched for both role passwords and the demo password: 0 occurrences each (11:52:05) |
| Cleanup | No database of this row's prefix, no staging or previous copy; PostgreSQL PID 19121 unchanged; no role created, no setting changed (digest equal) |

## Blockers

None for this row.

## Findings for the controller (F-n of the artifact, section 15)

1. **The test helper's forced drop is refused (42501) while an autovacuum worker is connected to
   the database**; the file then fails and a database is left behind. Measured at 11:22:56. A plain
   drop works. The same refusal is in the server log at 10:45:39 for another row's run (F-1).
2. An `ORDER BY` on a column that the select list casts to text sorts as text; the row's own
   first version had it, fixed with a test of eleven lineage rows (F-2).
3. **A bulk-fixture database cannot be reset**, by design: its kept rows name operators the seed
   does not create. Probed once: refused at R-5 with 23503, the database untouched (F-3).
4. DA-04, PG-09, PG-27 and DA-08 confirmed by running (F-4).
5. A session that connects, writes and disconnects between R-3 and R-7 is not seen; the
   procedures exclude it (F-5).
6. The whole `db` project is red in four tests of other rows since the engine-host row registers
   a boot step (F-6).
7. The brief cites D62; `decisions/decisions.md` ended at D61 when it was read (F-7).

## Deviations from the plan and the contract

| ID | Deviation |
|---|---|
| CONTRACT-DEVIATION-1 | R-0 says the routine holds `.locks/db-migrate.lock` on `dems_demo`. The lock is the caller's `lockf`, as for `db:migrate` (D54 DN-8); the command prints that for `dems_demo`. The routine takes the advisory lock (442001, slot) itself |
| CONTRACT-DEVIATION-2 | R-1 counts sessions that have a role (not every row of `pg_stat_activity`): autovacuum workers would otherwise refuse a reset at random |
| CONTRACT-DEVIATION-3 | R-6's count rule for the two seeded kept tables when the old database was never seeded: the seed's rows stay |
| Scope added | R-6 compares every carried row image, text for text, before the swap; the role check runs on each of the three connections |

`SCHEMA-GAP`: none.

## Decisions needed (DN-n of the artifact, section 16)

DN-1 who holds the migrate lock for a reset of `dems_demo`, and that the server-triggered reset
takes no file lock. DN-2 accept CONTRACT-DEVIATION-2 and -3. DN-3 route the forced-drop finding to
the helper's owner. DN-4 tell W43 and W53 to test resets on `tpl_seed` clones. DN-5 tell W43 and
W26 that a reset inside the server must not add 1 to the epoch again. DN-6 accept the three small
choices (a never-seeded target gets a `SCENARIO_LOADED` row with `previousRows` 0; `last_reset_at`
of a first build is `now`; the detail `reset` is always present). DN-7 the controller updates the
tracking row of W29.

## Follow-up: load-sensitive wait (controller request after D74)

Status: **complete**. Detail: `implementation/29_db_reset_routine.md` section 21. Evidence:
`implementation/assets/29b_*` (16 files).

| Time | What |
|---|---|
| 12:45:45, 12:45:48 | The failure reproduced at the first attempt, at a load average of 1.40: two runs of `reset-failures.db.test.ts` at once; 1 and 2 failures with the engine row's assertion, one of them in the test in which the routine opens no connection |
| 12:47:26 | A second thing measured with the routine unchanged: at the moment `resetDatabase` settles the driver has not yet closed the owner connection (6 of 6 new tests red) |
| 12:49:08 | The routine awaits the close: the same 6 tests green |
| 12:53:59 | Row command alone: 4 files, 75 tests, exit 0 |
| 12:54:30, 12:54:33 | The reproduction pair again: 54 of 54 and 54 of 54 |
| 12:55:18 to 12:59:42 | Ten runs of the file in a row with six whole-project `db` runs in flight: ten times 54 of 54, exit 0; the six whole runs each 45 files / 629 tests, exit 0 |
| 12:59:54 to 13:00:27 | Whole `unit` 70 files / 1,850 tests exit 0; typecheck exit 0; lint exit 0 with no warning; whole `db` 45 files / 629 tests exit 0 |
| 13:01:44 | Cluster: `dems_demo`, the three lanes, no database of this row's prefix; PID 19121; settings digest unchanged |

**Cause (a defect of this row's TEST, not load and not a short wait):** the test asked
`pg_stat_activity` for sessions with a fixed `application_name`; a second run of the same file on
the same cluster has the same name on the shared maintenance database, and the test took that
run's connection for its own.

**Also found (a real defect of this row's ROUTINE, said plainly):** `resetDatabase` resolved
before the driver had closed its owner connection, because the driver's `pool.end()` resolves when
it has asked its clients to close. Fixed in `routine.ts` (`closePool`: waits for the pool's
`remove` event, bounded at 5 s with a warning); tests in both projects. No effect on a reset was
found; it did not cause the reported failures.

**Changed in the tests:** an application name unique to the run and the file; `untilNoSession`, a
poll with a 30 s cap that throws with what was still connected (count, role, application name),
called only after the routine's promise settled; a `quiet()` step before every reset that must go
through; the routine's `sessionDrainMs` shortened only in the four calls that hold a session on
purpose (its production default of 3 s is unchanged); T-RS-5 counts connections from the driver;
test and hook time limits raised to caps. The plain-drop work-around is kept, with the same poll.

**Files changed (all under `apps/core-server/src/db/reset/`):** `routine.ts`, `index.ts`,
`__tests__/support.ts`, `__tests__/pools.ts`, `__tests__/reset-failures.db.test.ts`,
`__tests__/reset.db.test.ts`, `__tests__/cli.db.test.ts`, `__tests__/guard.test.ts`. Documents:
section 21 of the artifact, this section, 16 files `assets/29b_*`.

**Ledger against the baseline of 12:37:** `unit` 70 / 1,848 to 70 / 1,850 (+3 this row in
`guard.test.ts`; −1 in `plugins/readiness/__tests__/readiness.test.ts`, not this row); `db`
45 / 623 to 45 / 629 (+6 this row in `reset-failures.db.test.ts`). This row now: `unit` 6 files /
160 tests, `db` 4 files / 75 tests.

**Findings for the controller:** F-8 a test that reads `pg_stat_activity` or `pg_locks` on the
shared maintenance database must key its question by something of its own run (other rows' tests
with a fixed application name have the same latent failure when two runs overlap). F-9 the
routine's early resolve (fixed). F-10 the driver's `pool.end()` resolves before the sockets have
ended, and the server lists a backend a moment longer: a "no session" check belongs after the
close and must poll (it concerns the demo-control row's quiesce and any shutdown test). F-11 the
engine row's reading "short wait under load" was not the cause: reproduced at a load average of
1.40.

---
*Generated: 2026-10-04 11:52 WIB*
*Last Updated: 2026-10-04 13:05 WIB (follow-up)*
