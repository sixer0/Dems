---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: database-specialist (tier R)
blueprint_row: 33 (plan W11, template-clone test helper HB-12 and the global setup of the project db)
date: 2026-10-04
status: complete
evidence_tier: 3
---

# database-specialist progress: step 33 (W11, template-clone test helper)

Status: **complete**. `npm run test:db -w @dems/core-server -- test/helpers/db` exits 0
(10 files, 52 tests, 08:33:42). Two test files get two clones and each sees only its own row; no
database with the run prefix remains; a request to drop `dems_demo` or a younger database of
another run is refused before a statement is sent; templates and clones belong to `dems_owner`;
the first clone took 26 to 35 ms. The PostgreSQL server was never stopped (PID 19121 throughout).

Output document: `implementation/11_db_test_helper.md` (evidence for every line below). No
credential value is in either document: file names, key names, role names, database names,
counts and times only.

## Milestones (WIB)

| Time | Event |
|---|---|
| about 07:28 | Row started; inputs read (blueprint row 33, P1 to P25, plan W11, contract §7 and §10, TD-12, the provisioning record, D26, D27, D32) |
| about 07:45 | Read-only probe as `dems_owner`: `EPERM` inside the sandbox, PostgreSQL 18.4 outside; `dems_owner` is not a superuser. The scaffold's static tests (landed 07:37) read, so that the helper's files satisfy them |
| 07:55:16 | First `unit` run of the helper: 156 tests in 5 files |
| 07:58:26 | First `test:db` run (two isolation files): 10 of 12 pass. Finding F-1: `backend_type` is hidden for another role's sessions; corrected in `ddl.ts` |
| 08:07 | First run of the whole `db` suite: 47 of 51. A test waited on its own session (200 s): findings F-9, F-10; the helper's session now queues its statements |
| 08:12:20 | `db` suite: 51 of 51 |
| 08:13:56 | 52 of 52 with the self-check run for hook modules found by convention |
| 08:15 | Three runs at the same time: 52 of 52 each. Root typecheck red in `@dems/shared` (another row in flight, P11) |
| 08:21 to 08:25 | Runs at the same time found two weak tests (a third by review); corrected; 12 of 12 runs pass (four at a time, three rounds) |
| 08:29 | Measured: one suite run drops 93 databases and adds 217 lines to the server log; column visibility of `pg_stat_activity` confirmed by a scratch script |
| 08:33 | Last edit (a test uses the server's own pool factory). 08:33:42 row command exit 0; 6 of 6 runs pass (three at a time, two rounds) |
| 08:34:44 to 08:35:45 | Final evidence: verbose run (52 pass marks), isolation run, catalog (no `dems_test_*`), `unit` 526 of 526 inside the sandbox, typecheck and lint of the workspace exit 0, root typecheck exit 2 in a file of `@dems/shared`, `test:db` inside the sandbox exit 1 with the sandbox message |
| 08:40 | Both documents written |

## Files created or updated

Workspace (the owned write paths of W11; nothing else was written):

- `apps/core-server/test/global-setup.db.ts`
- `apps/core-server/test/helpers/db/index.ts`, `hooks.ts`, `global-setup.ts`, `run.ts`, `names.ts`, `ddl.ts`, `session.ts`, `credentials.ts`, `endpoint.ts`, `constants.ts`, `errors.ts`, `provided.ts`
- `apps/core-server/test/helpers/db/testing/probe-hooks.ts`, `fake-cluster.ts`, `isolation-suite.ts`, `private-run.ts`, `closed-port.ts`
- `apps/core-server/test/helpers/db/selfcheck/vitest.selfcheck.config.ts`, `global-setup.unreachable.ts`, `global-setup.convention.ts`, `convention-workspace.ts`, `never-runs.selfcheck.ts`, `throwing-test.selfcheck.ts`, `throwing-hook.selfcheck.ts`, `convention.selfcheck.ts`
- `apps/core-server/test/helpers/db/selfcheck/convention-workspace/test/db/template-hook.schema.ts`, `.../src/db/seed/__tests__/template-hook.seed.ts`, `.../src/db/fixtures/__tests__/template-hook.bulk.ts`
- `apps/core-server/test/helpers/db/__tests__/` project `unit`: `credentials.test.ts`, `endpoint.test.ts`, `hooks.test.ts`, `names.test.ts`, `run.test.ts`, `session.test.ts`, `static.test.ts`
- `apps/core-server/test/helpers/db/__tests__/` project `db`: `cleanup.db.test.ts`, `clone-lock.db.test.ts`, `global-setup.db.test.ts`, `guards.db.test.ts`, `isolation-a.db.test.ts`, `isolation-b.db.test.ts`, `nested-run.db.test.ts`, `sweep.db.test.ts`, `templates.db.test.ts`, `timing.db.test.ts`

46 files, 6,257 lines. Task folder:

- `implementation/11_db_test_helper.md`
- `delegation_progress/database_specialist_step_33.md` (this file)

Not edited: `vitest.config.ts`, any `package.json`, the lockfile, any file of another row. No
rollback was run. Scratch scripts (a catalog listing, a visibility check, the leak check) are in
the session scratchpad, outside the repository; test logs are in the two temporary directories
of the session.

## Processes and databases (P7)

- No process of this row is left: every Vitest run and its child runs ended; the scratch scripts
  ended. PostgreSQL was not started or stopped by this row (PID 19121, started 07:14:26, in the
  first command and at 08:34:54).
- No database of this row is left: `pg_database` holds `postgres`, `template0`, `template1`
  (08:34:54). No session on a test database, no advisory lock of class 442002.
- Side effect on a shared file: `.data/postgres.log` grew from 9,739 bytes to 1,794,816 bytes
  through this row's test runs (finding F-4). Nothing was deleted or truncated.

## Test ledger (P24), `@dems/core-server`

| Project | Before | After | This row's files |
|---|---|---|---|
| `db` | 0 files, 0 tests | 10 files, 52 tests, 0 failed | `cleanup.db.test.ts` 7, `clone-lock.db.test.ts` 3, `global-setup.db.test.ts` 6, `guards.db.test.ts` 5, `isolation-a.db.test.ts` 6, `isolation-b.db.test.ts` 6, `nested-run.db.test.ts` 3, `sweep.db.test.ts` 3, `templates.db.test.ts` 12, `timing.db.test.ts` 1 |
| `unit` | 17 files, 330 tests (other rows) | 24 files, 526 tests, 0 failed | `credentials.test.ts` 30, `endpoint.test.ts` 30, `hooks.test.ts` 8, `names.test.ts` 43, `run.test.ts` 50, `session.test.ts` 18, `static.test.ts` 17 (7 files, 196 tests) |

No other workspace was touched. No existing test was changed.

## Measured (for the budgets of later rows)

| What | Value |
|---|---|
| Template build from the empty template, one-table hook | 32 to 82 ms (create 26 to 33 ms, hook 5 to 8 ms) |
| First clone | 26 to 35 ms |
| Clone, median of 15 | 27 to 40 ms |
| Drop, median | 9 to 18 ms; an occasional one 100 to 300 ms |
| Whole `test:db` of this row's tests (10 files, 52 tests) | 7.2 to 8.5 s; 25 s when four such runs go at once |
| Whole `test:db` of two files with one template and two clones | 0.51 to 0.54 s wall clock |

## Findings (F-n of the output document, section 12)

| ID | Finding |
|---|---|
| F-1 | For another role's session `dems_owner` sees `datname`, `usename`, `application_name`; `backend_type`, `state`, `client_addr` are NULL. A filter on the backend type hides every `dems_app` session. Refines PG-27; matters for the reset routine |
| F-2 | A unique or foreign-key violation writes the key value into the server log (`DETAIL: Key (...)=(...)`), with default logging. Refines PG-16 and NL-5 |
| F-3 | One row of `pg_stat_activity` always has `usename = dems_admin` and no database: a background process of the server (hypothesis: the logical replication launcher), not a client |
| F-4 | Two checkpoint lines in the server log per dropped test database; one run of this row's suite adds 217 lines, 40 kB. The log is not rotated |
| F-5 | The scaffold's pool allows 10 connections; TI-14 says five |
| F-6 | Vitest prints "No test files found" before the error of a global setup that threw |
| F-7 | Vitest hides passed tests and their output in an agent environment; evidence runs need `--reporter=verbose --silent=false` |
| F-8 | `lock_timeout` bounds a wait for an advisory lock (`55P03`) |
| F-9 | The `pg` driver deprecates concurrent `query()` calls on one client; the helper's session queues its statements |
| F-10 | A session that waits for the clone lock holds back its later statements; a test must not use `db.run` while its own clone waits |
| F-11 | Root typecheck red at 08:15, 08:26 and 08:35 in files of other rows (`@dems/shared`, once `@dems/core-web`) |
| F-12 | The helper opens one short session of `dems_app` on `postgres` per run, for the role check |

## Deviations (DV-n of the output document, section 13)

| ID | Deviation |
|---|---|
| DV-1 | `test:db` attaches only; it does not start PostgreSQL (TI-1, GR-2 and plan §3.4 say "attaches to or starts") |
| DV-2 | Private templates `<prefix>tpl_x_<name>` beside the three of TI-2 |
| DV-3 | The clone lock is held for the whole build of `tpl_bulk` and of a private template (§10.1), around `CREATE DATABASE` only for `tpl_schema` and `tpl_seed` (TI-7) |
| DV-4 | Imports from W08: `src/config.ts`, `src/plugins/db` (one test), `test/static/scan.ts` (one test) |
| DV-5 | Seven test files in the project `unit`, not named by the row |
| DV-6 | A self-check Vitest configuration and fixtures inside the helper folder; one test starts Vitest as a child process three times |
| DV-7 | With a leaked `dems_app` session the drop is not sent; the file fails with `SESSIONS_REMAIN` |
| DV-8 | `masterplan/02_plan.md`, `status_tasks.md`, `implementation/99_implementation_report.md` not written (parallel run, P8) |
| DV-9 | `lock_timeout` 120 s on the helper's session; 180 s for a file's `beforeAll` and `afterAll` |

## Decisions for the controller (DN-n of the output document, section 14)

| ID | Decision needed | Recommendation |
|---|---|---|
| DN-1 | Should `test:db` start PostgreSQL when it is down? | Keep attach-only; amend the wording of TI-1, GR-2 and plan §3.4 |
| DN-2 | Private template names `tpl_x_<name>` | Accept; add to TI-2 |
| DN-3 | Second use of lock key 442002: `(442002, k)`, k from 1, is "this run is alive" | Record beside the lock keys of plan §3.4 |
| DN-4 | Clone lock held while `tpl_bulk` is built | Accept; W25 measures its hook |
| DN-5 | F-1 | Tell W29 and W17: never filter `pg_stat_activity` on `backend_type`, `state` or `query` for another role's sessions |
| DN-6 | F-2 | Route to W45 and to W17's log check |
| DN-7 | F-5 | Rule 5 or 10 connections; the file is W08's |
| DN-8 | F-11 | Re-run the root typecheck at the next gate |
| DN-9 | F-4 | Tell W17 and W86 that the server log is not empty after tests |
| DN-10 | Hook module paths: `test/db/template-hook.schema.ts` (W17), `src/db/seed/__tests__/template-hook.seed.ts` (W20), `src/db/fixtures/__tests__/template-hook.bulk.ts` (W25); each exports `templateHook` | Add to the delegations of those rows |
| DN-11 | W11 depends on W08 (DV-4) | Record |

## Blockers

None.

## Leak check

A scratch script takes the two password values of `.data/pg.owner.env` and `.data/pg.env` as
search patterns and prints counts only; no value is printed or stored.

| Time | Scanned | Files that contain a credential value |
|---|---|--:|
| 08:19 | `apps/core-server/test/`, this task's `docs/` folder, the sandbox temporary directory, the scratch scripts, `.data/postgres.log`, the Vite caches of the workspace (93,372 files, most of them unrelated files of the temporary directory) | **0** |
| 08:40:46, after both documents were written | `apps/core-server/test/`, this task's `docs/` folder (this file and the output document included), the scratch scripts, `.data/postgres.log`, the Vite caches of the workspace, and the 90 test logs of this row in the two temporary directories (317 files) | **0** |

---
*Generated: 2026-10-04 08:41 WIB*
*Last Updated: 2026-10-04 08:41 WIB*
