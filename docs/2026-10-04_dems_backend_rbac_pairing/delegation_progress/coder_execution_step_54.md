---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 54
plan_row: W32
agent: coder-execution
date: 2026-10-04
status: complete
artifact: implementation/32_pairing_device_registry.md
---

# Step 54 (W32): pairing and the device registry: progress

All times WIB. No code, credential, token or hash is written here.

## Milestones

| Time | Milestone |
|---|---|
| 14:13 | Started. Read: gate report M1 to M13, blueprint row 54 and P1 to P25, spec §4.7, §5, §6, §7.2, §7.3, §7.7, §13, database contract §4.7 to §4.11 and §5, the documents of the identity core, the guard, the core services, the engine host, the request guards, the typed client proof, the bulk fixture, the contract file `pairing.ts`, decisions D62 to D83 |
| 14:21 | Pre-images saved as file copies: `.cache/rollback/W32.pairing.index.ts.pre`, `.cache/rollback/W32.readiness.test.ts.pre` |
| 14:21 | Controller note D84: new gaps are named `CONTRACT-GAP-W32-n`. Followed (four gaps, document §16) |
| about 14:33 | Controller note D85: three test files of the guard row red by design, owner fix pending; not edited, not worked around. In this row's whole-project runs they were green from 14:49:09 on, and in the final runs |
| 14:35 | The module's 13 production files written; typecheck clean in the folder (errors at that minute in `modules/admin`, `modules/evidence` tests of rows in flight) |
| 14:39 | First database run of the folder: 1 file, 15 tests, exit 0 |
| 14:45 | Controller note D87, rule M14: the three log calls of the folder changed from `{ code }` to `{ err }`; a static test pins the keys; the secret scan runs two failing statements |
| 14:48 | By-design change in `readiness.test.ts`: this row's stub assertion (three lines), re-read first (document §15) |
| 14:49 | Whole `unit`: 2 failed in two files of the guard row that its owner was writing at 14:48 (noise, P11); both files alone at 14:49:09: 21 of 21 |
| 15:10 | Whole `db` project: 74 files, 1,071 tests, exit 0. 15:11 whole `unit`: 101 files, 2,647 tests, exit 0 |
| 15:13 | Controller note D88, rule M15: the mutation check runs through a transform in a scratch runner configuration outside the repository. No file of the tree was ever mutated by this row |
| 15:17 to 15:31 | Mutation check, first pass: 98 mutations through the scratch harness (no file of the tree changed): 95 detected, 3 survived (M36, M76, M79) |
| 15:31 | Two test additions for M76 and M79 (`sequence.db.test.ts`, `routes.test.ts`); second pass 15:31:13 to 15:32:06: both detected; M36 is an equivalent mutant. Total 97 of 98 |
| 15:32 | Verbose runs of the folder saved as assets: `unit` 4 files / 63 tests (15:32:24), `db` 7 files / 79 tests (15:32:27) |
| 15:33 to 15:36 | Final runs (`implementation/assets/32_final_runs.log`): typecheck exit 0, lint exit 0 without a warning, row `unit` 4 / 63, row `db` 7 / 79, whole `unit` 102 files / 2,661 tests exit 0 (15:34:06), whole `db` 75 files / 1,081 tests exit 0 (15:36:10) |
| 15:36 | End state: 0 databases with the prefix `dems_test_step_54_`, `.locks/postgres.pid` 19121, the scratch link removed |

## Files created or updated

Created under `apps/core-server/src/modules/pairing/`: `index.ts` (replaces the stub of W08),
`routes.ts`, `redeem.ts`, `codes.ts`, `devices.ts`, `resolver.ts`, `store.ts`, `activity.ts`,
`redeem-lock.ts`, `secrets.ts`, `presence.ts`, `database.ts`, `limits.ts`; under its
`__tests__/`: `support.ts`, `routes.test.ts`, `static.test.ts`, `secrets.test.ts`,
`redeem-lock.test.ts`, `lifecycle.db.test.ts`, `devices.db.test.ts`, `concurrency.db.test.ts`,
`secrets.db.test.ts`, `sequence.db.test.ts`, `engine.db.test.ts`, `registry.db.test.ts`.

Updated outside the folder: `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts`
(three lines, by design).

Documents: `implementation/32_pairing_device_registry.md`; this file; assets
`implementation/assets/32_test_unit_verbose.txt`, `32_test_db_verbose.txt`,
`32_mutation_harness.vitest.config.mjs.txt`, `32_mutation_harness.run.sh.txt`,
`32_mutations.json`, `32_mutations.log`, `32_final_runs.log`, `32_end_state.mts.txt`.

Not written (parallel run): `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

## Findings, deviations, decisions

See the document: §16 (CONTRACT-GAP-W32-1 to -4), §18 (F-1 to F-9), §19 (DV-1 to DV-7), §20
(DN-1 to DN-13).

## Verification

From `implementation/assets/32_final_runs.log`:

```
=== 15:32:48 typecheck: npm run typecheck -w @dems/core-server
exit 0 (15:33:00)
=== 15:33:00 lint: npm run lint -w @dems/core-server
exit 0 (15:33:01)
=== 15:33:01 row, unit: npm run test -w @dems/core-server -- --maxWorkers=2 src/modules/pairing
 Test Files  4 passed (4)
      Tests  63 passed (63)
exit 0 (15:33:03)
=== 15:33:03 row, db: DEMS_TEST_STEP=54 npm run test:db -w @dems/core-server -- --maxWorkers=2 src/modules/pairing
 Test Files  7 passed (7)
      Tests  79 passed (79)
[test:db] teardown: dropped 3 database(s) in 344 ms; 0 remain with the run prefix dems_test_step_54_tmdjr36y_
exit 0 (15:33:18)
=== 15:33:18 whole unit: npm run test -w @dems/core-server -- --maxWorkers=2
 Test Files  102 passed (102)
      Tests  2661 passed (2661)
exit 0 (15:34:06)
=== 15:34:06 whole db: DEMS_TEST_STEP=54 npm run test:db -w @dems/core-server -- --maxWorkers=2
 Test Files  75 passed (75)
      Tests  1081 passed (1081)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 565 ms; 0 remain with the run prefix dems_test_step_54_tmdjsuqp_
exit 0 (15:36:10)
```

Printed by the tests (15:32:27):

```
[w32] AC-B-76 burst 1: 20 concurrent wrong redeems: statuses {"401":2,"423":18}; rows {"PAIRING_FAILED":3,"PAIRING_LOCKED":17}; PAIRING_FAILED attemptsRemaining 2, 1, 0; failed_attempts of the code 3, state ACTIVE
[w32] AC-B-76 burst 2 (60 s later): statuses {"401":2,"423":18}; rows {"PAIRING_FAILED":3,"PAIRING_CODE_CLOSED":1,"PAIRING_LOCKED":17}; failed_attempts of the code 5, state EXHAUSTED
[w32] AC-B-77: two concurrent redeems of the right code: [[201,null],[401,"INVALID_CODE"]]; 1 device row, rows {"PAIRING_SUCCESS":1,"PAIRING_FAILED":1}
[w32] AC-B-75: 25 calls with 5 retired device credentials: statuses {"403":20,"429":5}; 20 ACCESS_DENIED rows, all under class:local
[w32] AC-B-41 rows: 34 audit rows and 19 events of the journey; 0 codes, 0 credentials
[w32] AC-B-29 log capture: 33995 characters, 149 lines, 47 request lines; 0 codes, 0 credentials, 0 markers, 0 hashes
```

Ledger: `unit` + 4 files / 63 tests, `db` + 7 files / 79 tests, all under
`apps/core-server/src/modules/pairing/__tests__/`. Mutation check: 97 of 98, one equivalent.
