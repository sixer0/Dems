---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier R)
blueprint_row: 58 (plan W36, devices module, operations 44 to 52)
date: 2026-10-04
status: complete
evidence_tier: 3
---

# coder-execution progress: step 58 (W36, devices module)

Status: **complete** (15:16), with one decision open for the controller (DN-1, BE-GAP-W36-1).
Every check of the row is met at the final runs: the row's own tests exit 0 (3 `unit` files with
87 tests, 2 `db` files with 39 tests), the whole `unit` project (101 files, 2,647 tests) and the
whole `db` project (74 files, 1,071 tests) exit 0, typecheck and lint exit 0 with no warning,
63 of 64 planted defects are detected (the survivor is an equivalent mutant), no database with
this row's prefix remains, and `.locks/postgres.pid` is 19121 as before.

Full record: `implementation/36_module_devices.md`. All times WIB. No credential, token, hash or
password is in this file.

## What exists now

- `apps/core-server/src/modules/devices/`: the nine routes of operations 44 to 52, each built
  from its registry entry (`routeOfOperation`).
- Reads 44 to 47 answer from the engine's committed state (`app.engine.state()`); 47 answers the
  seven slices under their slice names. No unit of work, no statement, no publication.
- Commands 48 to 52 are hosted actions through `app.engine.command(request.principal, …)`:
  `deviceCommand` with RESTART, TEST_SIGNAL or IDENTIFY, `setActiveCamera`, `resetClip`; 204 with
  `x-dems-epoch` and `x-dems-revision` of the outcome. The module writes no row, checks no
  permission, catches nothing and logs nothing.
- `restartDevice` during a recording: 409 `RECORDING_ACTIVE`; a command the device does not
  support: 409 `COMMAND_UNSUPPORTED`; an unknown device: 404 `NOT_FOUND`; each with
  `details.simCode`, no row, no revision.
- The effect over time is the simulator's, proven with the manual timer against a reference
  simulator: the two seconds of a test tone, the CLIP latch, and the audit rows of a sequence of
  nine commands (equal to the shared transition's rows, hash for hash).

## Verification (runner output quoted in `36_module_devices.md`, section 9)

| Check | Result | Time |
|---|---|---|
| Own `unit` tests (`src/modules/devices`) | exit 0: 3 files, 87 tests | 14:55:15 |
| Own `db` tests, `DEMS_TEST_STEP=58` | exit 0: 2 files, 39 tests; "0 remain with the run prefix dems_test_step_58_tmdi3jaw_" | 14:57:19 |
| MODG: route list equals the registry | both lists printed, nine routes | 14:55:15 |
| Whole `unit` project | exit 0: 101 files, 2,647 tests | 15:05:28 |
| Whole `db` project, `DEMS_TEST_STEP=58` | exit 0: 74 files, 1,071 tests; forced drops that needed a retry: 0; 0 databases remain | 15:10:43 |
| `npm run typecheck -w @dems/core-server` | exit 0 | 15:09:55 |
| `npm run lint -w @dems/core-server` | exit 0, no warning | 15:10:11 |
| Mutation check | 63 of 64 detected; M15 (a body on a 204) is equivalent | 14:46 to 14:51 |
| End state | 0 databases with the prefix `dems_test_step_58_`; `.locks/postgres.pid` 19121 | 15:14:02 |

Earlier whole-project runs, with what was red in OTHER rows' files (never in this folder):
14:52 both exit 0 (96 files / 2,540; 67 files / 1,006); 14:57 `unit` red in two test files of
the storage row; 14:58 `db` red in one file of the storage row and in the helper's
`sweep.db.test.ts` (5 s time-out under load); 15:06 `db` red in one test of the sessions row and
in the helper's `templates.db.test.ts` (5 s time-out under load); typecheck red twice at 14:55 in
a test file of the pairing row. The two helper files pass alone (15:10:22).

Test ledger (P24), `@dems/core-server`: this row adds `unit` +3 files, +87 tests and `db` +2
files, +39 tests. New test files, all under `src/modules/devices/__tests__/`: `routes.test.ts`
(33), `status.test.ts` (35), `static.test.ts` (19), `devices.db.test.ts` (36),
`effects.db.test.ts` (3). No existing test of any row was edited.

## Files created or updated

Created:

- `apps/core-server/src/modules/devices/operations.ts`
- `apps/core-server/src/modules/devices/status.ts`
- `apps/core-server/src/modules/devices/__tests__/support.ts`
- `apps/core-server/src/modules/devices/__tests__/routes.test.ts`
- `apps/core-server/src/modules/devices/__tests__/status.test.ts`
- `apps/core-server/src/modules/devices/__tests__/static.test.ts`
- `apps/core-server/src/modules/devices/__tests__/devices.db.test.ts`
- `apps/core-server/src/modules/devices/__tests__/effects.db.test.ts`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/36_module_devices.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/36_test_unit_verbose.txt`,
  `36_test_db_verbose.txt`, `36_final_runs.log`, `36_mutations.json`, `36_mutations.log`,
  `36_mutation_harness.vitest.config.mjs.txt`, `36_mutation_harness.run.sh.txt`,
  `36_end_state.mts.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_58.md`
- `.cache/rollback/W36.devices-index.ts.pre` (pre-image of the stub; not tracked)

Updated:

- `apps/core-server/src/modules/devices/index.ts` (the scaffold's stub replaced; the export
  `devicesModule` kept)

Not written (parallel run, P8): `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

## Gaps, with the text for their owners (full text in `36_module_devices.md`, sections 5 and 6)

- **CONTRACT-GAP-3** (W83): add `DEVICE_COMMAND_OPERATIONS` (command to operation ID) and
  `deviceCommandOfOperation` to `packages/shared/src/api/sim-actions.ts`; then the server's
  `DEVICE_COMMAND_OF_OPERATION` and the Live source's `DEVICE_COMMAND_OPERATION_INDEX` both go.
- **CONTRACT-GAP-W36-1** (W83): a POST without a request body answers 400 `INVALID_JSON` for a
  body that is no JSON object; the registry documents no 400 there (operations 48 to 50, and
  every other body-less POST).
- **BE-GAP-W36-1** (the engine host's owner): the seam returns no meter frame, so `dbfs` and
  `peak` of operations 44 and 45 are answered from the mic's state and do not follow the 20 Hz
  levels. Request: `EngineHost.meters(): EngineMeterFrame | null`, five lines.

## Findings, deviations, decisions (P22)

Findings F-1 to F-14, deviations DV-1 to DV-5 and decisions DN-1 to DN-4: sections 12 and 13 of
the row document. The ones the controller should see first:

- DN-1: accept the level adapter of operations 44 and 45 until the engine offers `meters()`.
- F-5 / DN-3: a 403 WITHOUT an `ACCESS_DENIED` row is possible when a grant exists only in the
  stored matrix: the guard lets the call through and the simulator's own permission check (the
  shared static matrix) refuses it. Not reachable while the stored matrix equals the shared one.
  For W45 and W47.
- F-4: the simulated restart has no duration (one row, no slice changes); the row's example "a
  restart that completes after N ticks" does not exist in the simulator.
- F-14: the test helper's own tests time out at 5 s under the load of the parallel run (three
  time-outs in two whole `db` runs; the 1-minute load average was 17 at 15:10).
- F-13: one stray scratch file of this row existed in `apps/core-server/` for under a minute at
  14:29 and was moved out; it never ran.

Rules confirmed for this row: M14 (the folder holds no log call: static test), M15 (the mutation
check changed no file of the tree: a transform in a scratch runner configuration), D84 (new gap
IDs carry the row: `CONTRACT-GAP-W36-1`, `BE-GAP-W36-1`, `SIM-GAP-W36-1`), D85 (the three guard
files were green in every whole-project run of this row from 14:52 on).

## Rollback (R-NEW; not executed)

```sh
# from /Users/gsp-budi/Documents/DEMS
rm -rf apps/core-server/src/modules/devices
mkdir -p apps/core-server/src/modules/devices
cp .cache/rollback/W36.devices-index.ts.pre apps/core-server/src/modules/devices/index.ts
```

---
*Generated: 2026-10-04 15:17 WIB*
