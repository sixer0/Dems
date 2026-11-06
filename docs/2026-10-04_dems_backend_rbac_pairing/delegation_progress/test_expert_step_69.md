---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: test-expert
step: 69
plan_row: W47
status: complete
---

# Progress: step 69 (W47), the role-by-endpoint matrix

**Status: complete.** Report: `test/02_rbac_matrix.md`.

## What was done

| Time | What |
|---|---|
| 18:00 | Started. Read the row (blueprint line 351), P1 to P25, the standing rules M1 to M16, spec §2.3, §4, §5.1, §5.2, §6.6, §7, §12.1, §14.2, the guard row's log §3, §6, §7, the decisions D83, D85, D88, D95, D104, D105, D106, D109 and the findings F25, F60, F64, F65 |
| 18:05 | `.locks/postgres.pid` = 19121. `test/support/` exists: the file imports from it, not from the `__tests__/support.ts` shims |
| 18:15 | `rbac-matrix.support.ts`: the reader of the specification and the derivation of a cell's expectation. Tried against the document and the registry without a database: 75 of 75 rows equal |
| 18:19 | First run of `rbac-matrix.test.ts` (14 columns): 30 of 31 tests green; the red one was a too strict check of the test itself (the six operations of contract C F-8 have no `NOT_PERMITTED` example), corrected |
| 18:25 | A web console sends its `Origin` on a POST only; a fourth "can it fail" test; the row's category; 32 tests green |
| 18:27 to 18:31 | 19 changes of production code through a transform outside the tree (rule M15): 19 detected |
| 18:32 | Two more retired-device columns (a session on a revoked device; the old credential of an unpaired device): 16 columns, 34 tests green |
| 18:38 to 18:41 | Whole `db` project: 111 of 112 files green; the red one is another row's (`test/db/catalog.db.test.ts`, a 5 s limit at load 12.7), green alone at 18:43 |
| 18:44 | Last change of the test file (the printed reason of a cell; the reason asserted by name in the AC-B-81 test). Row command exit 0 at 18:44:34 and 18:44:52; the 19 changes run again: 19 detected |
| 18:49 to 18:51 | Whole `db` project on the final file: 113 of 114 files, 1,662 of 1,665 tests (1 skipped); the red file is another row's, in flight (`test/acceptance/shared-state.test.ts`, 2 tests) |
| 18:51:53 | End state: 0 databases of the prefix `dems_test_step_69_`, 0 test databases of any row, `.locks/postgres.pid` 19121, no process left |

## Follow-up 69b: the condition `DEVICE_CREDENTIAL` (decision D118)

**Status: complete.** Report: `test/02_rbac_matrix.md`, the last section ("Follow-up: the condition `DEVICE_CREDENTIAL`").

| Time | What |
|---|---|
| 19:35 | The controller's gate on step 69: PASS (D117), rulings DN-1 to DN-3 taken. Brief of the follow-up read; the registry (`contract-model.ts:94-114`, `pairing.ts:469`) and the document (`01_specs.md:64, 405, 654, 660, 756, 860`) read |
| 19:38 | The unchanged test on the changed tree: 5 of 34 red, exactly at row 23 (the comparison with spec §7, the three `@DEVICE` cells) |
| 19:39 to 19:43 | Support file: the reader knows the fourth text, the reason is read from §7.2, the expectation knows the condition (generic, a `default` that throws for an unknown one). Test file: the reason exact in every refused cell, the place in the denial budget per cell, three new tests |
| 19:44 | The second step simulated outside the tree (operation 8 with the condition in the registry and in a copy of the document): one new test red, a too strict line of this row's own (it pinned 0 budget places for the device's own permitted call). Corrected at 19:45 |
| 19:45 to 19:50 | Baseline and 30 changes through the scratch harness: baseline green; P01 to P19, Q01 to Q09 and F02 detected (29 of 29); F01, the simulated second step, green with no change of the test files |
| 19:51 | Last change of the test file: the printed matrix shows the conditions of a row. Row command exit 0 at 19:52:20 (37 tests) and 19:52:29 (verbose, the asset written again); static guards exit 0; typecheck and lint exit 0; six of the mutation runs again, same results |
| 19:53:27 | End state: 0 test databases of any row, `.locks/postgres.pid` 19121, no process left; no file of the tree changed except this row's two test files |

Files updated by the follow-up: `apps/core-server/test/acceptance/rbac-matrix.test.ts`,
`apps/core-server/test/acceptance/rbac-matrix.support.ts`, `test/02_rbac_matrix.md`,
`test/assets/02_rbac_matrix_cells.md`, 12 new assets `test/assets/02b_*`, this file. No production
file, no other row's test, no configuration. No whole-suite run (as ruled).

| Command | Result |
|---|---|
| `DEMS_TEST_STEP=69b npm run test:db -w @dems/core-server -- test/acceptance/rbac-matrix.test.ts --maxWorkers=2` | exit 0 at 19:52:20: 1 file, 37 tests passed, 8.49 s; 0 databases remain |
| `npm run test -w @dems/core-server -- test/static --maxWorkers=2` | exit 0 at 19:52:30: 9 files, 112 tests |
| `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | exit 0, exit 0 at 19:52:01 |

Cells per column after the follow-up: `INVESTIGATOR@DEVICE` 52 let through and 23 refused (22
with a row), `SUPERVISOR@DEVICE` 71 and 4 (3), `TECHNICIAN@DEVICE` 43 and 32 (31); the other 13
columns unchanged. 1,649 cells in the file, 1,200 in the matrix, 0 answered 429.

Findings of the follow-up (report, section F.7): F-W47-4 (Info: the second step needs the registry
and the document in one step, with the words `needs the device's own credential`), F-W47-5 (Info:
this row's own too strict line, found by the simulation, corrected), F-W47-6 (Info: the budget
place is now asserted per cell). No defect of the server.

Ledger (P24): project `db` +3 tests in `test/acceptance/rbac-matrix.test.ts` (34 to 37); no new file.

## Files created or updated

| Path | What |
|---|---|
| `apps/core-server/test/acceptance/rbac-matrix.test.ts` | new: the acceptance test (34 tests) |
| `apps/core-server/test/acceptance/rbac-matrix.support.ts` | new: its support (no test) |
| `docs/2026-10-04_dems_backend_rbac_pairing/test/02_rbac_matrix.md` | new: the report |
| `docs/2026-10-04_dems_backend_rbac_pairing/test/assets/02_*` | new: 16 assets (the matrix, the logs, the mutation harness, the end state) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/test_expert_step_69.md` | this file |

Not written, by the parallel-run rule (P8, CLAUDE.md §3.4): `masterplan/02_plan.md`,
`status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`,
`test/01_test_report.md`, `implementation/99_implementation_report.md`. No production file, no
other row's test, no configuration.

## Verification (quoted in the report, section 11)

| Command | Result |
|---|---|
| `DEMS_TEST_STEP=69 npm run test:db -w @dems/core-server -- test/acceptance/rbac-matrix.test.ts` | exit 0 at 18:44:34: 1 file, 34 tests passed, 7.71 s |
| `npm run typecheck -w @dems/core-server` | exit 0 at 18:49:15 (exit 2 at 18:44:14: two errors in another row's `test/acceptance/shared-state.support.ts`, none in this row's files) |
| `npm run lint -w @dems/core-server` | exit 0, no warning |
| `npm run test -w @dems/core-server -- test/static --maxWorkers=2` (the static guards that read the test tree) | exit 0 at 18:53:03: 9 files, 112 tests |
| Whole `db` project, `--maxWorkers=2` | 18:49:22 to 18:51:38: 113 of 114 files, 1,662 passed, 2 failed, 1 skipped; both failures in `test/acceptance/shared-state.test.ts` (the two-client row W49, in flight). Earlier run 18:38 to 18:41: 111 of 112, the red one `test/db/catalog.db.test.ts` (a 5 s limit at load 12.67), green alone at 18:43:58 |
| Databases of this row's prefix left | 0 (and 0 test databases of any row at 18:51:53) |
| `.locks/postgres.pid` | 19121 |

## Findings, deviations, decisions

In the report, section 13: F-W47-1 (Low, wording of ID-1 b), F-W47-2 (Info, wording of §6.6),
F-W47-3 (Info, a limit of this test); DV-1 to DV-5; DN-1 to DN-3. No defect of the access decision
was found.

## Ledger (P24)

Project `db`: +1 file, +34 tests (`test/acceptance/rbac-matrix.test.ts`). Project `unit`: nothing.
