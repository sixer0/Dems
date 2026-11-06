---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: cpb1b1
plan_row: controller row "CP-B1 fix round B1" (after step 60, W38; after fix round A)
agent: coder-execution
date: 2026-10-04
status: complete
artifact: gateway_check/04b_cp_backend_fix_round_b1.md
---

# CP-B1 fix round B1: progress

All times WIB. No code, credential, token or hash is written here.

## Milestones

| Time | Milestone |
|---|---|
| 17:03 | Started. Read: the review `gateway_check/04_cp_backend_foundation.md` (§4.3, §4.4, §7, §8), round A's report (§3, §4), the standing rules M1 to M16, P9 to P11, P15, P21 to P24, decisions D62, D77, D78, D83, D87, D93, D95, D96, findings F53, F63, F71, the biometric row's log §9 and §17 to §19, the guard row's log §8, §9. Decision D105 was not yet in `decisions.md`; the ruling was taken from the brief and from the biometric row's §9 |
| 17:04:21 | Pre-images saved as FILE COPIES (the folder is untracked): `.cache/rollback/CPB1b1/` (`src/`, `test/` and the four configuration files, 523 files) with `.cache/rollback/CPB1b1.pre.sha256` |
| 17:04:35 | Scratch copy outside the repository (`$TMPDIR/…/scratchpad/cpb1b1/tree`). Whole `unit` there: 137 files / 3,536 tests, exit 0: the controller's baseline |
| 17:11:29 | **Item 2 landed** (11 entries): the window helper is `src/core/windows.ts`; new static test `test/static/imports.test.ts`. Whole `unit` on the tree 17:11:34: 138 of 139 files, 3,569 of 3,570; the one red is the sessions follow-up's (`sessions/__tests__/static.test.ts`, its new file `text-body.ts`) |
| 17:15:16 | Item 3 on the scratch copy against PostgreSQL: store, seed, engine 8 files / 111 tests |
| 17:15:47 | **Item 3 landed** (19 entries): the store is `src/db/store/`; `src/db/seed/store.ts` is a one-line shim; the import line of `src/db/fixtures/load.ts` in the same step (the fixture row had not changed that file). Whole `unit` 17:15:53: 140 / 3,583, exit 0 |
| 17:19:55 | Item 4 on the scratch copy against PostgreSQL: 8 files / 129 |
| 17:20:12 | **Item 4 landed** (9 entries): identity, rbac and pairing read through `app.db.read`. Whole `unit` 17:20:12: 139 of 140 files, 3,596 of 3,599; the three reds are the fixture follow-up's (`db/fixtures/__tests__/audit-details.test.ts`, changed by its writer in that minute) |
| 17:23:23 | Item 5 on the scratch copy against PostgreSQL: 21 files / 237 |
| 17:23:55 | **Item 5 landed** (8 entries): pairing and administration call `revokeBiometricTokens`. Whole `unit` 17:23:55: 140 / 3,602, exit 0 |
| 17:24:46 to 17:27:58 | **Whole `db` on the tree after items 3 to 5** (`DEMS_TEST_STEP=60b`, two workers): 108 files, 1,540 passed + 1 skipped, exit 0; one forced drop needed a retry (autovacuum, D76); 0 databases remain |
| 17:28:18 | Item 1 on the scratch copy against PostgreSQL (the denials of operations 2 to 6 through the real stages): 11 files / 208. Mutation M-1 on two scratch copies: a stage 6 that allows everything was hidden by the route hooks (7 of 7 green) and is detected without them (2 red) |
| 17:29:08 | **Item 1 landed** (4 entries): no route hook in the identity core; identity and health use `routeOfOperation`; new static test `test/static/routes.test.ts`. Whole `unit` 17:29:08: 141 / 3,604, exit 0 |
| 17:30 to 17:34 | Items 6, 7, 8, 10 on the scratch copy: mutations M-6a, M-6b, M-7; database runs 16 files / 191 (authenticate, identity), 4 files / 42 + 1 skipped (demo) |
| 17:34:23 | **Item 6 landed** (2). Whole `unit`: 141 / 3,605, exit 0 |
| 17:34:59 | **Item 7 landed** (1): the test block retitled. Whole `unit`: 141 / 3,605, exit 0 |
| 17:35:36 | **Item 8 landed** (5): the hold's name under the key `hold`; the allow-list of the log static test is empty. Whole `unit`: 141 / 3,606, exit 0 |
| 17:36:10 | **Item 10 landed** (2): two comments. Whole `unit`: 141 / 3,606, exit 0 |
| 17:37 to 17:44 | Item 9 on the scratch copy: `test/support/` (10 files), the old paths as shims, 247 import specifiers in 122 test files of landed rows. Whole `unit` there at 17:41:08 found one static guard that allowed `DROP DATABASE` by folder (the reset support had moved): the one file named in its list. 17:42:09 whole `unit` 141 / 3,606; 17:42:46 `db` 52 files / 676, with the in-flight users of the shims (realtime first contact, the acceptance test) |
| 17:44:25 | **Item 9 landed** (143 entries, renamed within one second). Whole `unit` 17:44:27: 141 / 3,609, exit 0 |
| 17:44:58, 17:45:02 | `npm run typecheck -w @dems/core-server` exit 0; `npm run lint -w @dems/core-server` exit 0, no warning |
| 17:45:10 to 17:46:28 | **Whole `db` on the tree at the end**: 108 files, 1,540 passed + 1 skipped, exit 0; 0 forced drops needed a retry; 0 databases remain |
| 17:47 | Planted violations for the new and changed static tests, scratch copy only: 10 of 10 detected |
| 17:47:46 to 17:48:18 | Final state on the tree: whole `unit` 141 files / 3,609 tests, exit 0; typecheck exit 0; lint exit 0, no warning |
| 17:48:42 | End state: 0 databases with the prefix `dems_test_step_60b_` (read from the catalog as `dems_owner`); PostgreSQL PID 19121, postmaster started 07:14:26; no process of this row runs; no port was bound. The scratch copy's link to the data folder removed. `.cache/rollback/CPB1b1.post.sha256`, `CPB1b1.landed.txt`, `CPB1b1.new.txt` written |
| 17:52 | Document and 38 assets written |

## Files created or updated

- **Documents:** `gateway_check/04b_cp_backend_fix_round_b1.md`; `gateway_check/assets/04b_*` (38 files); this file.
- **Rollback:** `.cache/rollback/CPB1b1/` (pre-images), `.cache/rollback/CPB1b1.pre.sha256`, `CPB1b1.post.sha256`, `CPB1b1.landed.txt`, `CPB1b1.new.txt`.
- **`apps/core-server` (181 paths):** 19 new, 162 changed (24 production, 9 test-support files at their old paths, 129 test files of which 108 in import specifiers only), 2 old paths gone (both moved). The full list is `.cache/rollback/CPB1b1.landed.txt`; by item in `gateway_check/assets/04b_landed_lists.txt`; the document's section 7 names them by kind.

Not written: `delegation_progress_report.md`, `status_tasks.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md` (parallel run, P8).

## Blockers

None.

## For the controller

- **Deviations** DV-1 to DV-13, **findings** F-1 to F-9, **decisions** DN-1 to DN-7: document section 4. DV-13 is a rule not kept to the letter: some read-only inspection commands were run with a `cd` into `apps/core-server`; no test, build, database or landing command was.
- **Most important to rule on:** DN-2 (three more copies of the read block exist: `modules/admin/index.ts:150-162` in this round's folders but not in the brief's list, `modules/evidence/index.ts:172-190`, `modules/sessions/history.ts:81-100`); DN-4 (CPB1-21: reword NL-6); DN-5 (two shims have no importer and can go now).
- **For round B2:** document section 5 (the import cycle with exact lines, the 35 imports by file name across units, every shim with its importers and when it can go).
- **Rows in flight:** nothing they import was removed. Their files use the old paths of the test support, which re-export; the two reds seen during this round were in their own folders (17:11:34 sessions, 17:20:12 fixtures) and were green at the next run.
