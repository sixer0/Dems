---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution
blueprint_row: 23 (plan row W01, early proof a, wave E1)
date: 2026-10-04
status: complete
evidence_tier: 3
---

# coder-execution progress: step 23 (W01, baseline test fix)

Status: complete

Row window: 2026-10-04 06:26:37 to 06:36:32 WIB (about 10 of the 30 minutes). The first command of
this row is later than the docs commit `4b708c8` (2026-10-04T06:25:02+07:00), which is the SC1 order.

## Result

| Property | Value |
|---|---|
| Change | The two suites' local helpers (`makeSim`, `mount`) pass `clock: createManualClock(<2026-10-01 10:00 WIB>)` and save the sign-in record with the same instant instead of `Date.now()` |
| Files edited | `apps/core-web/src/test/sim-fetch.test.ts`, `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` (12 lines added and 1 replaced in each) |
| Assertions changed | none |
| Production files, helpers, manifests | none touched |
| Fallback of plan section 6 | not used |
| Sandbox bypass | none |
| Processes left running | none (`ps`: no vitest process) |

## W01's state

| File | `git hash-object` |
|---|---|
| `apps/core-web/src/test/sim-fetch.test.ts` | `9e8b97c80da596e0ae6e9b37aa69b64e99e3bbdd` |
| `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` | `71f6f0337f2339d8e8d66ef232d7334dc0b67d1d` |

Before the edit (equal to `acaff20`): `9c33898b9324feaf15a3cfa0e24014ccd2693bdb` and `6606806cd714a8911d087a9a09d6d351a7155c7e`.

## Verification (output quoted in implementation/01_baseline_test_fix.md section 3)

| # | Check | Result |
|---|---|---|
| 1 | `npm run test -w @dems/core-web -- --maxWorkers=2` | Run 1 (06:29:48 WIB): `Test Files  39 passed (39)`, `Tests  438 passed (438)`, exit 0. Run 2 (06:34:57): exit 1 before any test, `vite.config.ts` was mid-edit by W05 (P11 noise). Run 3 (06:35:18): `Test Files  39 passed (39)`, `Tests  438 passed (438)`, exit 0 |
| 2 | The two files under the shifted-clock preload | `2026-10-04T00:10:00+07:00`: `Tests  24 passed (24)`, `Start at  00:10:00`, exit 0. `2026-10-02T12:00:00+07:00`: `Tests  24 passed (24)`, `Start at  12:00:00`, exit 0. Before the fix the same two commands gave `2 failed \| 22 passed (24)` and `1 failed \| 23 passed (24)` |
| 3 | `npm run typecheck -w @dems/core-web`; `npm run lint -w @dems/core-web` | exit 0 and exit 0 (twice each) |
| 4 | `git hash-object`; `git status --porcelain` | The two values above. At 06:30:54 WIB the status held exactly the two test files plus documents |

## Test ledger (P24)

| Workspace | Before | After | New test files |
|---|---|---|---|
| `@dems/core-web` | 438 tests in 39 files, 2 failing by name (F20) | 438 passed of 438 in 39 files | none |

Other workspaces: not run by this row.

## Findings

| ID | Finding | Evidence |
|---|---|---|
| W01-F1 | **A third clock-dependent web test exists and is not fixed** (outside this row's write paths): `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx:216-226`, "shows today's sealed count and six recent events grouped by day at UTC+07:00". It fails every day from 00:00 to about 00:25 WIB (`expected '0' not to be '0'`, line 221) and on any date whose evidence IDs do not contain `-2026` (`expected 0 to be greater than 0`, lines 219-220; shown for 2027-02-01). Its helper has the same shape as the two repaired ones (`issuedAt: Date.now()`, no clock, lines 79-88) | Full suite under the preload at `2026-10-04T00:10`: `1 failed \| 437 passed (438)`; the file alone fails at 00:10, 00:20, 00:24 and passes at 00:26, 00:35, 00:50; full suite at `2027-02-01T12:00`: `1 failed \| 437 passed (438)` |
| W01-F2 | Nine more web test files or helpers seed a simulator from the wall clock, and two use a manual clock that starts at `Date.now()` (list in 01_baseline_test_fix.md section 5). At the instants tried (00:10, 06:29, 06:35 and 23:58 on 2026-10-04; 2027-02-01 12:00) only the dashboard test fails. Other instants were not tried | `grep` for `createSim(` without `createManualClock`; the runs of section 5 |
| W01-F3 | A vitest run in `@dems/core-web` fails at start-up while `apps/core-web/vite.config.ts` is half written (W05's path): `[PARSE_ERROR] Expected ")" but found EOF`, `vite.config.ts:66:4`. The re-run passed | Run 2 and run 3 above |
| W01-F4 | Assumption PA-05 holds: the fixed clock is enough, and the fallback (deriving the ID and the count from simulator state) was not needed. The sign-in record's timestamp was pinned too; by reading the code it does not decide the result, and a run with the clock line alone was not made | 01_baseline_test_fix.md section 2.4 |
| W01-F5 | `pgrep` does not work inside the sandbox (`sysmond service not found`); `ps -axo pid,etime,command` does | Command output of this row |

## Deviations from the plan

| ID | Deviation | Reason |
|---|---|---|
| W01-DR1 | `sim-fetch.test.ts` takes the instant from `DEMO_EVIDENCE_INDEX.datasetNow` (`2026-10-01T10:00:00.000+07:00`) instead of a literal | The test already takes its evidence ID from that object, so the ID and the clock share one source (D10(a)); same pattern as `features/evidence/__tests__/harness.ts:25`. `storage-page.test.tsx` uses the literal `2026-10-01T10:00:00+07:00`, as `security-audit.test.tsx:36` does |
| W01-DR2 | Both helpers also replace `issuedAt: Date.now()` by the fixed instant | So that no wall-clock value enters the simulator; same pattern as the two suites named above |
| W01-DR3 | Extra runs beyond the row's verification: two more instants for the two files and three full-suite runs plus six single-file runs under the preload | To answer the open point of the baseline gate report ("whether other tests become clock-sensitive"); they produced W01-F1. No file was changed because of them |
| W01-DR4 | `implementation/99_implementation_report.md`, `masterplan/02_plan.md` and `status_tasks.md` were not written | Shared files in a parallel run (five rows of wave E1 in flight); the plan's row table has no status column. The row's record is this file and `implementation/01_baseline_test_fix.md` |
| W01-DR5 | Three test commands were void (`No test files found`): a shell variable passed the two file names as one word. Repeated correctly; no effect on the result | Mistake of this row, recorded for completeness |

## Decisions needed from the controller

| ID | Decision | Options |
|---|---|---|
| W01-D1 | What to do about W01-F1. GR-5 / P24 say that from W01 on no failure is accepted, yet a gate that runs between 00:00 and about 00:25 WIB will show one failing web test | (a) a small fix slot with the recipe of this row for `dashboard.test.tsx` (one helper, plus the `-2026` filter of line 219, which a fixed clock at 2026-10-01 also satisfies); it is a recorded change to an existing test under L-5, and the file would need the same treatment as the two files of W01 (a recorded `git hash-object` value and a pre-image rollback), because W63 (Web Dashboard, wave C1, 02_plan.md:737) owns `apps/core-web/src/features/dashboard/**` and its client gate item (a) compares existing test files with `acaff20`; or (b) a gate rule that accepts this one test by name inside that window; or (c) no gate run in that window |
| W01-D2 | Whether to pin the remaining wall-clock suites of W01-F2 in advance. Nothing fails at the instants tried | Leave as is (suggested), or a sweep of more instants by a test or verification row |

## Rollback

`git checkout acaff20 -- apps/core-web/src/test/sim-fetch.test.ts apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` (R-CO; not executed).

## Files created or updated

| Path | Action |
|---|---|
| `apps/core-web/src/test/sim-fetch.test.ts` | modified |
| `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` | modified |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/01_baseline_test_fix.md` | created |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_23.md` | created (this file) |
| `.cache/w01/` (git-ignored scratch: `fake-clock.mjs` and run logs) | created |

Blockers: none.
