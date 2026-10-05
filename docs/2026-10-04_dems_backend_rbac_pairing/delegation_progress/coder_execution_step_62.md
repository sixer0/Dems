---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 62
plan_row: W40
agent: coder-execution
date: 2026-10-04
status: complete
output: implementation/40_modules_system_alerts.md
---

# Step 62 (W40): progress of the system module and the alerts module

Times are WIB. The document of the row is `implementation/40_modules_system_alerts.md`; evidence
is under `implementation/assets/40_*` (19 files).

## Status

**complete**, with one stated exception to AC-B-71, seven findings, two contract gaps and three
decisions for the controller.

## Milestones

| Time | Milestone |
|---|---|
| 15:47 | Inputs read; pre-images of the two stubs saved under `.cache/rollback/` |
| 15:53 | Production code of both modules written; typecheck exit 0 |
| 16:04 | Unit tests of both folders green (177 at that time) |
| 16:09 to 16:17 | Database tests written and green (55) |
| 16:20 to 16:41 | Mutation check: 86 mutations, unit and database; two test changes made because of survivors |
| 16:42 to 16:46 | Final runs: row unit 180, row database 55, whole `unit` 136 files / 3,527, whole `db` 106 files / 1,516, typecheck and lint exit 0 without a warning, end state |

## Verification, as run

| Item | Result |
|---|---|
| MODG, system and alerts | 5 = 5 and 2 = 2 (printed by the tests) |
| 409 `SESSION_ACTIVE` for `restartServices` and `startSoftwareUpdate` during a session | PASS in CREATE, PRECHECK, ARMED, RECORDING, STOPPING |
| AC-B-71 | 12 of 13 raised alerts have one `FAULT_RAISED` row; the `AUDIT_TAMPER` alert has one `AUDIT_CHAIN_DISCONTINUITY` row (spec §7.16). Not shown on the bulk template |
| SR-82, AC-B-89 | No audit row, exactly one info line with the operator ID and the alert ID or the changed names, no value; no line for a call that changed nothing or was refused |
| Row tests | unit: 6 files, 180 tests, exit 0 (16:42:35); database: 3 files, 55 tests, exit 0 (16:42:17) |
| Whole projects | `unit` 136 files / 3,527 tests exit 0 (16:42:38); `db` 106 files / 1,516 tests exit 0 (16:43:30) |
| Typecheck, lint | exit 0, exit 0, no warning (16:45). Red at 16:05 and 16:17 in files of other rows |
| Mutation check | Unit: 83 of 86 on the first pass, 84 after one added assertion; the other two are equal in behaviour and fail the static test on a scratch copy. Database alone: 71 detected and 1 refused at boot on the first pass, 13 survive after one fix |
| End state | 0 databases with `dems_test_step_62_`; `.locks/postgres.pid` 19121 |

## Things the controller should know before accepting

1. **Two test changes were made after mutation survivors.** M49 (no unit assertion on the answer
   body of a settings change) and M03 (three of this row's assertions built the expected value
   with the function under test). Both are fixed; the full set of mutations was not run again
   afterwards.
2. **The over-time claim is narrower than the brief's.** The engine's own state follows the
   simulator tick for tick and the audit rows are equal hash for hash. The committed state, which
   operation 64 answers, is up to one second behind for `diagnostics`, `update` and `services`,
   and for 18 ticks it showed `device.softwareVersion: 2.5.0` beside `update.state: RUNNING`
   (finding F-W40-1).
3. **AC-B-71 as worded does not hold for the kind `AUDIT_TAMPER`.**
4. **An unknown key in a settings body is dropped (200), not refused with 422**, as the contract
   says (API-4) and against the wording of the brief.
5. One lint warning at 16:05 was this row's own and was fixed.

## Findings and gaps (details in the document, section 10)

- CONTRACT-GAP-W40-1: 400 `INVALID_JSON` on the four body-less POSTs is not documented.
- CONTRACT-GAP-W40-2: the `FAULT_RAISED` sentence in the alerts descriptions.
- F-W40-1 snapshot pacing of the engine host and operation 64.
- F-W40-2 AC-B-71 and the `AUDIT_TAMPER` alert; the audit row carries no alert ID.
- F-W40-3 on the bulk template 0 of 88 fixture fault alerts match a row by text and target.
- F-W40-4 an alert older than the newest 100 cannot be acknowledged.
- F-W40-5 `startSoftwareUpdate` answers 202, not 409, when an update runs or none is available.
- F-W40-6 the simulated restart of the services has no duration.
- F-W40-7 503 after a committed settings change when the engine stops in that instant.

## Decisions needed

- DN-1: no log line for a call that changed nothing (the specification is silent).
- DN-2: route F-W40-1 to the engine's owner, or accept it as a residual.
- DN-3: read AC-B-71 as "an audit row of its fault".

## Not verified

No listening server; no bearer session of a paired device through the real stages; no
`DEVICE_REVOKED`; a refused `runDiagnostics` only with a principal built for the unit test; no
WARN or FAIL diagnostics verdict on the real engine; round trips measured for operations 68 and
70 only.

## Files created or updated

Production: `apps/core-server/src/modules/system/{index,operations,settings,status}.ts`,
`apps/core-server/src/modules/alerts/{index,acknowledge}.ts`.

Tests: `apps/core-server/src/modules/system/__tests__/{routes.test,settings.test,static.test,system.db.test,effects.db.test,support,static-rules}.ts`,
`apps/core-server/src/modules/alerts/__tests__/{routes.test,acknowledge.test,static.test,alerts.db.test}.ts`.

Documents: `implementation/40_modules_system_alerts.md`, `implementation/assets/40_*` (19 files),
this file. Pre-images: `.cache/rollback/W40.system.index.ts.pre`, `W40.alerts.index.ts.pre`.

Not written (parallel run): `masterplan/02_plan.md`, `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`, `implementation/99_implementation_report.md`.
