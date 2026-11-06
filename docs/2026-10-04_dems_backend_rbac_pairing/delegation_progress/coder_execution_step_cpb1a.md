---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: cpb1a
plan_row: controller row "CP-B1 fix round A" (after step 60, W38)
agent: coder-execution
date: 2026-10-04
status: complete
artifact: gateway_check/04a_cp_backend_fix_round_a.md
---

# CP-B1 fix round A: progress

All times WIB. No code, credential, token or hash is written here.

## Milestones

| Time | Milestone |
|---|---|
| 14:46 | Started. Read: the review `gateway_check/04_cp_backend_foundation.md` (every finding of the scope in full), the standing rules M1 to M13, P1 to P25, decisions D40, D52, D67, D76, D77, D83, D85, findings F38, F53, F60, F63, the logs of rows 08, 21 (§5, §6, §15), 26 (§11), 11b, database contract §6.4, §7. Decision D87 was not yet in `decisions.md`; the ruling was taken from the brief |
| 14:56:04 | Pre-images saved as FILE COPIES (the folder is untracked): `.cache/rollback/CPB1a/` (40 files of the write paths) with `.cache/rollback/CPB1a.pre.sha256` |
| 14:56:10 | Scratch copy of the workspace outside the repository (`$TMPDIR/…/scratchpad/cpb1a/tree`), with links to `node_modules`, `packages`, `docs` and the data folder. 14:56:17 first whole `unit` run there: 97 of 100 files green; one red was the copy's own (a missing link to `docs/`, added), two red tests in `src/modules/network-time/__tests__/` of the row in flight |
| 15:03:54 | CPB1-2 and CPB1-7 red on the old code: the review's table reproduced (rows B to D leak; row A `code: undefined`), and CPB1-23 reproduced under the key `err`. 15:04:04 green: 51 logger tests |
| about 15:14 | Controller note D88 (rule M15; whole projects only after a landing and at the end; a time-out in a file not touched is re-run alone). Followed: every mutation ran on the scratch copy; no file of the tree was changed except by the one landing |
| 15:06 to 15:27 | The static log test, the pool (option, boot check, `read`), the unit (statement guard, extended protocol, path pin), the lost connection, written and tested on the scratch copy |
| 15:27:53 | First run of the five new database test files on the scratch copy: 29 of 31; the two reds were one test of mine (it read a cached probe result). The cause was real: after a lost connection the pool's last probe result must not be reused. `connectionLost()` added to the pool plugin. 15:29:49: 31 of 31 |
| 15:30:17 | The new database tests on the OLD code (second scratch copy `before`): 24 failed, 7 passed (the 7 are premises and controls). Among the reds: an audit row appended through the unit's writer that was in no real table (F53), and `expected 500 to be 503` (CPB1-6) |
| 15:31:15 | Scratch copy synced with the tree's modules. 15:31:49 whole `unit` there: 110 files / 2,776 tests, exit 0. 15:32:39 `db` for core, engine, plugins, identity, rbac and the changed test files: 26 files / 363 tests, exit 0 |
| 15:35:18 to 15:39:52 | Mutation check on the scratch copy: `unit` 55 of 56 (L4 survived: one of my tests had a wrong premise about when the runtime writes a stack; repaired, then detected), `db` 8 of 8. The scratch sources have the same hashes before and after |
| 15:40:53 to 15:41:55 | Red before / green after for the pin findings on the two scratch copies (a new boot step, a new log key, a role-less backend): 11 runs, all as expected. Planted violations for the two static tests: 4 of 4 |
| 15:43:01 | The 40 pre-image files in the tree still equal the copies of 14:56:04; no other writer added a file to the four folders |
| **15:43:39** | **Landing, one step:** 36 files copied beside their targets and renamed within one second, production files in dependency order. The tree equals the scratch copy for the 36 files; no temporary file left. `.cache/rollback/CPB1a.post.sha256` written |
| 15:43:45, 15:43:52 | `npm run typecheck -w @dems/core-server` exit 0; `npm run lint -w @dems/core-server` exit 0, no warning |
| 15:43:59 | Whole `unit` on the tree: 110 files / 2,776 tests, exit 0 |
| 15:44:46 to 15:46:27 | Whole `db` on the tree (`DEMS_TEST_STEP=60a`, two workers): 80 files / 1,112 tests, exit 0; 0 databases remain with the run prefix; 0 forced drops needed a retry. No test of a module row turned red |
| 15:47:25, 15:47:31 | Typecheck exit 0, lint exit 0 again; the 36 landed files have the hashes of the landing |
| 15:48 | End state: 0 databases with the prefix `dems_test_step_60a_` (read from the catalog as `dems_owner`); PostgreSQL PID 19121, postmaster started 07:14:26; no process of this row runs; no port was bound |
| 15:50 | Document and 20 assets written |

## Files created or updated

In `apps/core-server` (36):

- Changed (20): `src/plugins/logger/error-log.ts`, `logger-options.ts`, `index.ts`; `src/plugins/db/index.ts`; `src/plugins/db/__tests__/db.test.ts`; `src/core/errors.ts`, `index.ts`, `pipeline.ts`, `types.ts`, `unit-of-work.ts`; `src/core/__tests__/support.ts`, `pipeline.test.ts`, `core-plugin.test.ts`, `static.test.ts`, `seeded.db.test.ts`, `boot-checks.db.test.ts`; `src/engine/__tests__/plugin.test.ts`, `commands.db.test.ts`, `restart.db.test.ts`; `test/db/boot-checks.db.test.ts`; `test/helpers/db/__tests__/drop-retry.db.test.ts`.
- New (16): `src/core/unit-statement.ts`; `src/core/__tests__/unit-statement.test.ts`, `connection-lost.test.ts`, `search-path.db.test.ts`, `unit-guard.db.test.ts`, `connection-lost.db.test.ts`; `src/plugins/db/__tests__/search-path.test.ts`, `read.test.ts`, `search-path.db.test.ts`; `src/plugins/logger/__tests__/error-keys.test.ts`, `safe-log-object.test.ts`, `error-keys.db.test.ts`; `test/static/log-calls.ts`, `log-calls.test.ts`, `search-path.test.ts`.

In the task folder: `gateway_check/04a_cp_backend_fix_round_a.md`; `gateway_check/assets/04a_*` (20 files: 14 run logs, the mutation script, the pin script, the landing script, the list of landed files, the two hash lists); this file.

Outside both: `.cache/rollback/CPB1a/` (40 pre-image copies), `.cache/rollback/CPB1a.pre.sha256`, `.cache/rollback/CPB1a.post.sha256`.

Not written: `app.ts`, `index.ts`, `config.ts`, any folder under `src/modules/`, `src/plugins/{permission-guard,authenticate,origin-guard,throttle,readiness,error-envelope,config}/`, `src/db/**`, the production files of `src/engine/`, `packages/shared`; `delegation_progress_report.md`, `status_tasks.md`, `decisions/decisions.md`, `masterplan/02_plan.md`.

## Outcome per finding

| Finding | Outcome |
|---|---|
| CPB1-2 (High) | Fixed: every `Error` in the object of a log line is replaced by the safe description at any key and depth; static test for `{ err }` and against child loggers |
| CPB1-7 (Medium) | Fixed: `describeError` follows `cause`; ONE helper `codedCauseOf` exported from `plugins/logger`. The other copies: structural round (S-4, S-5) |
| CPB1-23 (Low) | Fixed with CPB1-2 (deviation DV-1): it leaked a line of the statement under `err` too |
| CPB1-3 (High, F53, D87) | Fixed: (i) start-up option on the pool, (ii) check inside B-1, (iii) pin in the unit's third statement, (iv) static test. `TEMPORARY` not revoked, no role, grant or setting changed |
| CPB1-4 (Medium) | Fixed: row-statement rule and the extended protocol for every statement of a unit's user. What remains possible is stated in the document §2.4 |
| CPB1-6 (Medium) | Fixed: 503 `DATABASE_UNAVAILABLE`, readiness off until the next successful probe. Provoked for real by closing the client's socket; the server-side codes on a stand-in |
| CPB1-8 (Medium) | Added: `app.db.read(source, work)`. Three copies to replace (identity, rbac, pairing): S-1 to S-3 |
| CPB1-13 (Medium) | Fixed in the core's, the engine's and the schema row's boot test: relative order; the engine's log test closed for its own lines, a deny-list for the rest |
| CPB1-14, CPB1-15 | Fixed: the shutdown test polls; the helper test compares entries with a role. CPB1-14 could not be made to fail on demand (document §2.8) |

## Deviations, findings, decisions

Document §6: deviations DV-1 to DV-8, findings F-1 to F-11, decisions DN-1 to DN-7. The ones the controller should see first:

- **DV-2:** the allow-list of the log static test has ONE foundation entry (`src/plugins/readiness/index.ts:83`, `:85`, the name of a hold under the key `reason`); that file was outside the write paths for this fix. No module file violates the rule.
- **DV-4:** the statement guard is an allow-list of row statements. A module that sends `LOCK TABLE`, `SHOW`, `EXPLAIN`, `CALL` or `DO` through a unit is refused; none does today.
- **F-1:** F53 was a silent loss of audit rows on the old code, shown against PostgreSQL.
- **F-3:** the pairing row wrote a third copy of the read block (`src/modules/pairing/database.ts:25-38`).
- **F-10 (hypothesis, not run):** a session of `dems_app` may end another backend of `dems_app`; for the security review.
- Sentences for M5, M9 and M10 are in document §3.
