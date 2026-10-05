---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
step: 62
plan_row: W40
date: 2026-10-04
agent: coder-execution
tier: 3
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
spec: masterplan/01_specs.md rev 2.2, §7.2, §7.3, §7.14, §7.15, §7.17 members 29, 32, 35, 36, 38, 39, §13.2; SR-82; AC-B-71, AC-B-89
status: complete
---

# Step 62 (W40): the system module and the alerts module

Two module folders of the Core server, filled in one row: `apps/core-server/src/modules/system/`
(operations 64 to 68) and `apps/core-server/src/modules/alerts/` (operations 69 and 70).
Times are WIB, 2026-10-04. Evidence files are under `implementation/assets/40_*`.

## 1. Result

| Item of the row | Result | Evidence |
|---|---|---|
| MODG, system: the route list equals the registry operations | PASS: 5 = 5 | section 5.1 |
| MODG, alerts: the route list equals the registry operations | PASS: 2 = 2 | section 5.1 |
| `restartServices` and `startSoftwareUpdate` during a session answer 409 `SESSION_ACTIVE` | PASS, in CREATE, PRECHECK, ARMED, RECORDING and STOPPING, with `details.simCode`; no row, no revision. One stated limit: `startSoftwareUpdate` answers 202 and not 409 when an update already runs or no version is available, session or not (the simulator's order; finding F-W40-5) | section 6.1 |
| Every raised alert has a `FAULT_RAISED` audit row (AC-B-71) | **PASS WITH ONE EXCEPTION.** 13 alerts raised through the engine: 12 have exactly one `FAULT_RAISED` row; the alert of kind `AUDIT_TAMPER` has exactly one `AUDIT_CHAIN_DISCONTINUITY` row instead, as spec §7.16 (operation 73) says. Also shown for the alert the engine raises itself at a restart. Not shown on the bulk template (finding F-W40-3) | section 6.2 |
| `acknowledgeAlert` and `updateSettings` write no audit row and exactly one log line with the operator ID and the alert ID or the changed key names, and none of their values (SR-82, AC-B-89) | PASS for a call that changes something. A call that changes nothing and a refused call write NO line: the specification does not say, the brief does; decision DN-1 | section 6.3 |
| An acknowledgement and a settings change survive a restart | PASS: `engine.stop()`, `app.close()`, a new app on the same clone | sections 6.4, 6.5 |
| What a command does over time is the simulator's, hash for hash | PASS for the audit rows. **The claim for the state is narrower than the brief's:** the engine's own state follows the simulator tick for tick; the COMMITTED state, which operation 64 answers, is up to one second behind for `diagnostics`, `update` and `services` (finding F-W40-1) | section 6.6 |
| Row unit tests | 6 files, 180 tests, exit 0 (16:42:35) | section 7.1 |
| Row command `DEMS_TEST_STEP=62 npm run test:db ...` | 3 files, 55 tests, exit 0 (16:42:17) | section 7.1 |
| Whole `unit` project | 136 files, 3,527 tests, exit 0 (16:42:38) | section 7.2 |
| Whole `db` project | 106 files, 1,516 tests, exit 0 (16:43:30) | section 7.2 |
| `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | exit 0, exit 0, no warning (16:45). Two earlier typecheck runs were red in files of other rows | sections 7.2, 7.3 |
| Mutation check of the modules' own logic | 86 mutations. Unit tests: 83 detected on the first pass, 84 after one assertion was added because of a survivor. The other two are equal in behaviour and are refused by the static test. Database tests alone: 71 detected and 1 refused at boot on the first pass; 13 survive after one test defect was fixed | section 8 |
| No database of the prefix `dems_test_step_62_` remains; `.locks/postgres.pid` | 0; 19121 | section 12 |
| Contract gaps | `CONTRACT-GAP-W40-1`, `CONTRACT-GAP-W40-2` | section 10 |

Status: **complete**, with one stated exception to AC-B-71, seven findings and two decisions for
the controller (sections 10 and 11). What was not verified is in section 14.

## 2. What was written

| File | Lines | Change | Content |
|---|--:|---|---|
| `apps/core-server/src/modules/system/index.ts` | 150 | replaces the stub of W08 | The plugin `systemModule`; five routes |
| `apps/core-server/src/modules/system/operations.ts` | 39 | new | `SYSTEM_MODULE_OPERATIONS`, `SYSTEM_ACTION_OF_OPERATION`, `registryEntry` |
| `apps/core-server/src/modules/system/settings.ts` | 64 | new | `settingsPatchOf`, `changedSettingsKeys`, `settingsChangeLine`, the message and the unit label |
| `apps/core-server/src/modules/system/status.ts` | 29 | new | `systemStatusOf(state)`: the five slices of operation 64 |
| `apps/core-server/src/modules/alerts/index.ts` | 103 | replaces the stub of W08 | The plugin `alertsModule`; two routes; `ALERTS_MODULE_OPERATIONS`, `ACKNOWLEDGE_ACTION` |
| `apps/core-server/src/modules/alerts/acknowledge.ts` | 48 | new | `becameAcknowledged`, `acknowledgementLine`, the message and the unit label |
| `apps/core-server/src/modules/system/__tests__/routes.test.ts` | 849 | new, project `unit` | 74 tests |
| `apps/core-server/src/modules/system/__tests__/settings.test.ts` | 136 | new, project `unit` | 14 tests |
| `apps/core-server/src/modules/system/__tests__/static.test.ts` | 191 | new, project `unit` | 22 tests |
| `apps/core-server/src/modules/system/__tests__/system.db.test.ts` | 686 | new, project `db` | 31 tests |
| `apps/core-server/src/modules/system/__tests__/effects.db.test.ts` | 411 | new, project `db` | 4 tests |
| `apps/core-server/src/modules/system/__tests__/support.ts` | 598 | new, test support | The engine double (with `run`), the two app builders, the registry side of the gate, readers of the captured log |
| `apps/core-server/src/modules/system/__tests__/static-rules.ts` | 211 | new, test support | The patterns of the static tests with their positive controls |
| `apps/core-server/src/modules/alerts/__tests__/routes.test.ts` | 542 | new, project `unit` | 38 tests |
| `apps/core-server/src/modules/alerts/__tests__/acknowledge.test.ts` | 84 | new, project `unit` | 9 tests |
| `apps/core-server/src/modules/alerts/__tests__/static.test.ts` | 175 | new, project `unit` | 23 tests |
| `apps/core-server/src/modules/alerts/__tests__/alerts.db.test.ts` | 564 | new, project `db` | 20 tests |

Nothing else was edited: not `app.ts`, not the contract, the schema, a migration, the mapping,
the seed, the core, the engine, a plugin or another module (rule M1). No package was added. Both
plugins keep the export name the frozen app factory imports; a static test of each folder pins
the line. The two modules share no production code (a static test of the alerts folder holds
that); they share test support, which lives in `system/__tests__/`. No existing test of another
row was changed.

## 3. The operation table of both modules

| # | operationId | Method and path | Access (registry) | Audit on success | Request | Success answer | Recipe |
|--:|---|---|---|---|---|---|---|
| 64 | `getSystemStatus` | GET `/api/v1/system/status` | `AUTHENTICATED` | none (read) | none | 200 `SystemStatus`: slices `device`, `services`, `update`, `diagnostics`, `settings` | read of the committed state |
| 65 | `runDiagnostics` | POST `/api/v1/system/diagnostics` | `DIAGNOSTICS_RUN` | `DIAGNOSTICS_RUN`; none while a run is in progress | none | 202 `{ runId }` | hosted action `runDiagnostics` |
| 66 | `restartServices` | POST `/api/v1/system/services/restart` | `MAINTENANCE` | `DEVICE_COMMAND` (`details.scope: CORE_SERVICES`) | none | 200 `{ restarted }` | hosted action `restartServices` |
| 67 | `startSoftwareUpdate` | POST `/api/v1/system/update` | `MAINTENANCE` | `UPDATE_STARTED`; none when nothing started | none | 202, no body | hosted action `startSoftwareUpdate` |
| 68 | `updateSettings` | POST `/api/v1/settings` | `AUTHENTICATED` | none (parity); one log line | `SettingsUpdateRequest` (four optional members) | 200 `SettingsSlice` | hosted action `updateSettings` in a unit of the module |
| 69 | `listAlerts` | GET `/api/v1/alerts` | `AUTHENTICATED` | none (read) | none | 200 `{ alerts }` | read of the committed slice |
| 70 | `acknowledgeAlert` | POST `/api/v1/alerts/{id}/acknowledge` | `AUTHENTICATED` | none (parity); one log line | none; `{id}` `ALR-NNNNNN` | 204, no body | hosted action `acknowledgeAlert` in a unit of the module |

Sources: `packages/shared/src/api/system.ts` (64 to 68), `alerts.ts` (69, 70), `sim-actions.ts`
(`runDiagnostics`, `startSoftwareUpdate`, `restartServices`, `acknowledgeAlert` hosted, one
operation each; `setPresentationMode` and `updateSettings` both `hosted('updateSettings')`).

## 4. The handler recipe per operation (rule M13)

Every route is `routes.route({ ...routeOfOperation(registryEntry('<operationId>')), schema, handler })`
(rule M2). The schema objects are the contract's own (tested by identity against
`CORE_API_SCHEMAS`). No route has a hook, and its configuration holds the operation ID and
nothing else.

| # | Recipe | Code |
|--:|---|---|
| 64 | Server-side read, no pipeline: `systemStatusOf(app.engine.state())`. The state is taken once | `system/index.ts`, `status.ts` |
| 65 | **Hosted** (rule M4): `const { value: runId, epoch, revision } = await app.engine.command(request.principal, 'runDiagnostics')`; the two headers from the outcome; 202 `{ runId }` | `system/index.ts` |
| 66 | **Hosted**: `app.engine.command(request.principal, 'restartServices')`; 200 `{ restarted }` with the number the action returned | `system/index.ts` |
| 67 | **Hosted**: `app.engine.command(request.principal, 'startSoftwareUpdate')`; 202 without a body | `system/index.ts` |
| 68 | **Hosted, in a unit of the module**: `app.engine.run('system.updateSettings', scope => ...)` with ONE hosted action inside. The unit reads `scope.pending().settings`, runs `scope.command(caller, 'updateSettings', patch)`, reads the pending settings again and returns the NAMES of the members that differ, sorted. After the unit resolved (the commit): the log line when a name changed, then `app.engine.slice('settings')`, then the two headers, then that slice as the answer | `system/index.ts`, `settings.ts` |
| 69 | Server-side read: `({ alerts: app.engine.slice('alerts') })` | `alerts/index.ts` |
| 70 | **Hosted, in a unit of the module**: `app.engine.run('alerts.acknowledgeAlert', scope => ...)`: the pending alerts, `scope.command(caller, 'acknowledgeAlert', id)`, the pending alerts again; the unit returns whether the alert of that ID became acknowledged. After the commit: the log line when it did, then 204 with the two headers | `alerts/index.ts`, `acknowledge.ts` |

**Why 68 and 70 use `engine.run`.** What changed must be read before and after the action on the
same state. Read outside the unit, another console's change could be counted as this caller's.
The database tests show it: three consoles setting the same setting to the same value at once
produce one line, three consoles acknowledging the same alert at once produce one line. The
sessions module uses the same form (decision D94 DN-1). The answer never comes from
`scope.pending()`: operation 68 answers the committed slice, operation 70 has no body.

**Operation 68 and its two actions.** The contract maps `updateSettings` and
`setPresentationMode` to operation 68. The route runs `updateSettings` for every body, because a
body may name any of the four members and `setPresentationMode` is the same transition with one
member. `setPresentationMode` was run against PostgreSQL through `app.engine.command` in a test
(engine host finding F-11); no route runs it.

No operation of this row is server-native: no `app.pipeline.run`, no table of the modules' own,
no audit row and no event written by the modules, no publication. The principal is passed on as
it is. Its operator ID is read in one place per module, the function that builds the log line;
nothing is decided by it (static tests).

**Error paths and the persistent error log.** The modules contain no `catch`. An `ApiFailure` is
answered by the error envelope. Anything else answers 500 `INTERNAL_ERROR` with no detail, and the
envelope writes one error line and one entry of the persistent error log by the error's name:
tested for all seven operations with an error log file (5 and 2 entries).

### The exact shape of the two log lines

Written with `request.log.info(fields, message)`, so each carries the request ID of the request
line. Printed by the unit tests (`assets/40_own_unit_verbose.log`):

```
[w40] the log line of updateSettings: {"level":30,"time":"<time>","pid":"<pid>","hostname":"<host>","reqId":"<request id>","operatorId":"OPR-001","changedKeys":["notifySound","notifyWarnings","presentationMode","timeFormat"],"msg":"settings changed"}
[w40] the log line of acknowledgeAlert: {"level":30,"time":"<time>","pid":"<pid>","hostname":"<host>","reqId":"<request id>","operatorId":"OPR-001","alertId":"ALR-000001","msg":"alert acknowledged"}
```

| Line | Level | Message | Fields of the module | Never in it |
|---|---|---|---|---|
| Settings change | info (30) | `settings changed` | `operatorId` (text), `changedKeys` (the names of the settings whose value changed, sorted) | a value of a setting, the request body, the patch, the slice; the session ID, the device ID, the role |
| Acknowledgement | info (30) | `alert acknowledged` | `operatorId` (text), `alertId` (the validated `{id}` of the path) | the alert's text, kind, target or severity; the session ID, the device ID, the role |

The names in `changedKeys` come from the `settings` slice before and after the action, never from
the request body. These are plain fields, not an error object (rule M14).

## 5. The module gate (MODG)

### 5.1 The route lists, printed by the tests (16:42:35, `assets/40_own_unit_verbose.log`)

```
[w40] MODG routes of src/modules/system:   GET /api/v1/system/status getSystemStatus | POST /api/v1/system/diagnostics runDiagnostics | POST /api/v1/system/services/restart restartServices | POST /api/v1/system/update startSoftwareUpdate | POST /api/v1/settings updateSettings
[w40] MODG registry, tag System (64-68):   GET /api/v1/system/status getSystemStatus | POST /api/v1/system/diagnostics runDiagnostics | POST /api/v1/system/services/restart restartServices | POST /api/v1/system/update startSoftwareUpdate | POST /api/v1/settings updateSettings
[w40] MODG routes of src/modules/alerts:   GET /api/v1/alerts listAlerts | POST /api/v1/alerts/:id/acknowledge acknowledgeAlert
[w40] MODG registry, tag Alerts (69-70):   GET /api/v1/alerts listAlerts | POST /api/v1/alerts/:id/acknowledge acknowledgeAlert
```

The module side is everything the plugin registers on an empty Fastify instance; the registry
side is every operation of the tag, with `{id}` written in the router's form by the test itself.
A second test finds the same routes in the real app and nothing else under the modules' paths.

### 5.2 Status table per operation, with the test for each

Files: `Y-R` `system/__tests__/routes.test.ts`, `Y-D` `system.db.test.ts`, `Y-E`
`effects.db.test.ts`; `A-R` `alerts/__tests__/routes.test.ts`, `A-D` `alerts.db.test.ts`. Every
answer named here is checked with `validateCoreApiResponse(operationId, status, body)`.

| # | Status and code | Who produces it | Test |
|--:|---|---|---|
| 64 | 200 | the module | `Y-R` "reads the five slices" (3 roles), "follows the state"; `Y-D` "reads the five slices" (3 roles), "equal the stored ones"; `Y-E` reads during and after an update |
| 64 | 401 `NOT_SIGNED_IN` | stage 6 | `Y-R` "nobody without a session"; `Y-D` "nobody without a session" |
| 65 | 202 | the module, through the hosted action | `Y-R` "starts a run" (3 roles), "while a run is in progress", "once the eight checks have resolved"; `Y-D` "a run by each role in turn"; `Y-E` |
| 65 | 401; 403 `NOT_PERMITTED` with one denial row | stage 6 | `Y-R` "nobody", "a caller without DIAGNOSTICS_RUN" (a principal built for the test: every seeded role holds the permission) |
| 66 | 200 | the module, through the hosted action | `Y-R` "a TECHNICIAN restarts", "the number is the simulator's"; `Y-D` "66: a TECHNICIAN restarts"; `Y-E` |
| 66, 67 | 403 `NOT_PERMITTED`, one `ACCESS_DENIED` row | stage 6 | `Y-R` "lacks MAINTENANCE" (2 roles each); `Y-D` "INVESTIGATOR and SUPERVISOR are refused by the guard" |
| 66, 67 | 409 `SESSION_ACTIVE`, `details.simCode` | the hosted action | `Y-R` "while a session is open" (4 states each); `Y-D` "409 SESSION_ACTIVE ... in every state" (5 states) |
| 66, 67 | 401 | stage 6 | `Y-R` "nobody without a session" |
| 67 | 202 | the module, through the hosted action | `Y-R` "starts the update", "a second call", "once the update has completed", "the order is the simulator's"; `Y-D` "67: a TECHNICIAN starts the update"; `Y-E` |
| 68 | 200, changed | the module, through the hosted action | `Y-R` "changes a setting" (3 roles), "SR-82, AC-B-89"; `Y-D` "changes settings" (3 roles), the two concurrency tests, the restart test |
| 68 | 200, unchanged | the same | `Y-R` "a call that changes nothing" (4 bodies); `Y-D` the same (3 bodies) |
| 68 | 400 `INVALID_JSON` | stage 7 | `Y-R` "a body that is no JSON object" (3 bodies) |
| 68 | 401 | stage 6 | `Y-R`, `Y-D` "nobody without a session" |
| 68 | 422 `INVALID_INPUT`, `details.in: body` | stage 7, the contract's schema | `Y-R` "a wrong type or value" (6 bodies); `Y-D` the same (3 bodies) |
| 65 to 68 | 403 `ORIGIN_NOT_ALLOWED` | stage 3 | `Y-D` "from an origin that is not the web console's" |
| 69 | 200 | the module | `A-R` "the idle Core", "reads the alerts slice" (3 roles), "a ring of 100"; `A-D` "reads an empty list" (3 roles), the AC-B-71 test, the bulk test |
| 69 | 401 | stage 6 | `A-R`, `A-D` "nobody without a session" |
| 70 | 204, acknowledged | the module, through the hosted action | `A-R` "acknowledges an alert" (3 roles); `A-D` the same (3 roles), the concurrency and restart tests |
| 70 | 204, nothing changed | the same | `A-R` "a second acknowledgement", "an alert the Core does not have"; `A-D` "a call that changes nothing" |
| 70 | 401; 403 `ORIGIN_NOT_ALLOWED` | stages 6, 3 | `A-R` "nobody"; `A-D` "a refused call", "from an origin" |
| 70 | 422 `INVALID_INPUT`, `details.in: params` | stage 7 | `A-R` "an `{id}` outside the registry's pattern" (7 values); `A-D` "a refused call" (3 values) |
| all | 503 `NOT_READY` | stage 2, or the engine host | `Y-R`, `A-R` "an engine that is not running", "a unit that is not committed"; `Y-D`, `A-D` after `engine.stop()` |
| all | 500 `INTERNAL_ERROR` | the envelope | `Y-R`, `A-R` "an unexpected failure" |
| 65, 66, 67, 70 | 400 `INVALID_JSON` for a body that is no JSON object | stage 7 | `Y-R` "the three commands without a request body", `A-R` "takes no body". **Not valid against the contract** (`UNDOCUMENTED_STATUS`): CONTRACT-GAP-W40-1 |

The role-by-operation decision is the guard's; the full matrix is test row W47.

## 6. The verification items of the row

### 6.1 409 `SESSION_ACTIVE` (`system.db.test.ts`, a clone of its own)

A session is opened through hosted commands of the engine (`setTabletLink('CONNECTED')`,
`createSession`, `beginPrecheck`, ticks, `startRecording`, `stopRecording`); no route of the
sessions module is used. In each state both commands are called by the TECHNICIAN.

```
[w40] restartServices and startSoftwareUpdate with an open session: 409 SESSION_ACTIVE, details { simCode: SESSION_ACTIVE, from: <state>, event: <action> }, from CREATE, PRECHECK, ARMED, RECORDING, STOPPING; no row, no revision
```

Each refusal: valid against the contract, no `x-dems-epoch` and no `x-dems-revision`, the trail
length and the revision unchanged, the committed state the same object, no row naming the
TECHNICIAN, and nobody left signed in on the engine. Once the session is SEALED both commands
run (200 and 202, one row each): a sealed session is not "active" in the simulator.

### 6.2 AC-B-71 (`alerts.db.test.ts`, 16:42:17, `assets/40_own_db_verbose.log`)

Thirteen faults were injected with `app.engine.command(principal, 'inject', kind, target)`: every
fault kind, and a tampered evidence item. The list of operation 69 was then compared with the
stored trail read as `dems_owner`. The audit row holds no alert ID (the simulator writes the row
from the fault), so an alert's row is the one with its kind, target, instant, text and severity.

```
[w40] AC-B-71: 13 alerts listed; audit rows: 12 FAULT_RAISED + 1 AUDIT_CHAIN_DISCONTINUITY (kind AUDIT_TAMPER); one row per alert:
  ALR-000001 CAMERA_LOSS target VIDEO-02 -> seq 87 FAULT_RAISED
  ALR-000002 MIC_NO_SIGNAL target AUDIO-02 -> seq 88 FAULT_RAISED
  ALR-000003 MIC_CLIP target AUDIO-01 -> seq 89 FAULT_RAISED
  ALR-000004 STORAGE_LOW target null -> seq 90 FAULT_RAISED
  ALR-000005 STORAGE_FULL target null -> seq 91 FAULT_RAISED
  ALR-000006 GNSS_LOSS target RTC -> seq 92 FAULT_RAISED
  ALR-000007 TAMPER target null -> seq 93 FAULT_RAISED
  ALR-000008 TAMPER target evidence:EV-20260929-0001:VIDEO-01 -> seq 94 FAULT_RAISED
  ALR-000009 FAN_STALL target null -> seq 95 FAULT_RAISED
  ALR-000010 POWER_FAIL target null -> seq 96 FAULT_RAISED
  ALR-000011 TPM_FAILURE target null -> seq 97 FAULT_RAISED
  ALR-000012 SECURITY_FAULT target null -> seq 98 FAULT_RAISED
  ALR-000013 AUDIT_TAMPER target seq:94 -> seq 99 AUDIT_CHAIN_DISCONTINUITY
```

Asserted: every alert has exactly one such row; no row of the two types exists without an alert;
what the list answers is what the table `alerts` holds. **The criterion as worded ("a
`FAULT_RAISED` row") holds for 12 of the 13.** The thirteenth is the demo tamper of the audit
view, whose row type is `AUDIT_CHAIN_DISCONTINUITY` by the specification's own table.

The same check after a restart, for an alert no command raised (section 6.5): the engine's
restart rule raised `POWER_FAIL` for the recording that was running, with one `FAULT_RAISED` row,
actor null.

### 6.3 SR-82, AC-B-89: no audit row, one log line

With PostgreSQL (`system.db.test.ts`, `alerts.db.test.ts`), per role:

```
[w40] updateSettings by INVESTIGATOR: 200; audit rows +0, events +0, tables +{}; published [["replace settings"]]; log line {"operatorId":"OPR-001","changedKeys":["timeFormat"]} "settings changed" level 30
[w40] updateSettings by SUPERVISOR: 200; audit rows +0, events +0, tables +{}; published [["replace settings"]]; log line {"operatorId":"OPR-002","changedKeys":["notifySound","presentationMode"]} "settings changed" level 30
[w40] updateSettings by TECHNICIAN: 200; audit rows +0, events +0, tables +{}; published [["replace settings"]]; log line {"operatorId":"OPR-003","changedKeys":["notifyWarnings","timeFormat"]} "settings changed" level 30
[w40] acknowledgeAlert by INVESTIGATOR: 204; audit rows +0, events +0, tables +{}; published [["replace alerts"]]; log line {"operatorId":"OPR-001","alertId":"ALR-000001"} "alert acknowledged" level 30
[w40] acknowledgeAlert by SUPERVISOR: 204; audit rows +0, events +0, tables +{}; published [["replace alerts"]]; log line {"operatorId":"OPR-002","alertId":"ALR-000002"} "alert acknowledged" level 30
[w40] acknowledgeAlert by TECHNICIAN: 204; audit rows +0, events +0, tables +{}; published [["replace alerts"]]; log line {"operatorId":"OPR-003","alertId":"ALR-000003"} "alert acknowledged" level 30
```

| Assertion | How |
|---|---|
| No audit row | The stored trail has the same length before and after; the row count of all 30 tables is unchanged; no event |
| Exactly one line | The lines the log gained during the call are filtered by the message: one; its own members are exactly the two fields; level 30; its `reqId` is the request line's |
| No value | No line of the call has a member named after a setting, or named `body`, `settings`, `patch`, `value`, `before`, `after`; no string value is `12` or `24`; the module's line holds no boolean. For an alert: no member `kind`, `severity`, `target`, `params`, `alert`, `active`, `acknowledged`; the alert's text is in no string |
| Nothing for a call that changed nothing | The same values, an empty object, only an unknown key; the alert again, an unknown alert: 200 or 204, no line, no publication, the same revision |
| Nothing for a refused call | 422, 401, 403 `ORIGIN_NOT_ALLOWED`, 503 after `engine.stop()`, a unit that was not committed (unit test): no line |
| One line when several consoles race | Three simultaneous calls with the same change: 200 or 204 three times, one line. Two simultaneous calls with different changes: two lines, each with its own name |

One case writes the line although the answer is an error: an engine that stops between the commit
of a settings change and the read of the committed slice answers 503, the change is stored, and
the line is in the log (unit test; finding F-W40-7).

**An unknown key is dropped, not refused.** The brief says unknown keys are refused with 422. The
contract says the request body is an open object and an unknown key is dropped (API-4). The module
follows the contract: `{ theme: ... }` answers 200, changes nothing, writes no line, and neither
the key nor its value reaches the action or the log. A wrong type or value is refused with 422.

### 6.4 Settings across a restart (`system.db.test.ts`, a clone of its own)

```
[w40] settings across a restart: epoch 1 -> 2; console_settings {"presentationMode":true,"timeFormat":"12","notifyWarnings":false,"notifySound":true} with updated_at unchanged; audit rows about settings: 0; a change in the new process logged [{"operatorId":"OPR-001","changedKeys":["presentationMode"]}]
```

After `engine.stop()` the five operations answer 503 and a refused change writes no line. After
`app.close()` and a new app 90 s later on the same clone: the engine's slice and the row of
`console_settings` hold the four values, a TECHNICIAN reads them through operation 64, the trail
up to the stop is equal row for row, and no row of either process is about a setting.

### 6.5 Alerts across a restart (`alerts.db.test.ts`, a clone of its own)

```
[w40] alerts across a restart: epoch 1 -> 2; before the stop [["ALR-000002","MIC_NO_SIGNAL",true],["ALR-000004","FAN_STALL",false]]; after the start the same two and ALR-000006 POWER_FAIL (raised by the engine's restart rule, at 0 ms from the stop) with FAULT_RAISED seq 94, actor null; one FAULT_RAISED row per alert: ALR-000002 -> seq 91, ALR-000004 -> seq 92, ALR-000006 -> seq 94
```

A recording was running at the stop. In the new process the two alerts are as they were (the
acknowledgement survived, in the list and in the table), the third was raised by the engine
itself, and the new process acknowledges on with its own lines.

### 6.6 Over time (`effects.db.test.ts`)

Each effect is held against the shared simulator in two ways: the shared transition and the
shared tick step applied to the engine's own state (hash for hash), and a reference simulator
with the same seed and, for its random streams, the server's epoch, given the same commands and
ticks.

```
[w40] runDiagnostics DIAG-000001 over 105 ticks (5.25 s): checks resolved at +ms 389, 924, 1491, 1934, 2381, 2706, 3254, 3715; ticks that changed the run: 8 (+400: 1 | +950: 2 | +1500: 3 | +1950: 4 | +2400: 5 | +2750: 6 | +3300: 7 | +3750: 8); every tick = advanceDiagnostics on the engine's state = the reference simulator; committed diagnostics behind the engine's own on 48 ticks, at most 700 ms; completedAt +3715 ms; audit rows 1, events 2
[w40] restartServices: 200 { restarted: 16 }; all 16 services started at the command's instant; stored row = the shared transition's (hash ed01bc151abf…) = the reference simulator's content; 100 ticks afterwards: no service changed, no row
[w40] startSoftwareUpdate over 207 ticks (10.35 s): steps resolved at +ms 842, 1988, 3467, 4886, 7886, 8826 (+850: 1 done | +2000: 2 done | +3500: 3 done | +4900: 4 done | +7900: 5 done | +8850: 6 done); stored rows UPDATE_STARTED, SYSTEM_BOOT (+7886), UPDATE_COMPLETED (+8826) = the shared code's on the engine's state (seq, id, hash) = the reference simulator's content; committed update behind the engine's own on 90 ticks, at most 900 ms; committed states with device.softwareVersion 2.5.0 beside update.state RUNNING: 18 ticks (+8850 to +9700 ms); 16 services restarted at the reboot; version 2.5.0, slot B
[w40] the file's sequence: 5 stored audit rows = the reference simulator's 5 (at, type, category, severity, actor, device, message, details): DIAGNOSTICS_RUN, DEVICE_COMMAND, UPDATE_STARTED, SYSTEM_BOOT, UPDATE_COMPLETED; chain ok over 91 rows
```

What this proves, and what it does not:

- **Proved.** The schedule of a run and of an update is the shared transition's, instant for
  instant. Every stored audit row is the shared code's row on the engine's state: sequence, ID
  and hash. The engine's own state equals the reference simulator's at every tick.
- **Not as the brief put it.** The first version of this test asserted that the COMMITTED state
  follows tick for tick. It failed: the engine host commits the hardware snapshot, which holds
  `diagnostics`, `update` and `services`, at most once per second of the server clock on a tick
  (decision D77 DN-2). The test now asserts what is true: after each tick the committed slice is
  the engine's own, or it is still the one committed before and has waited less than a second.
  So operation 64 can show a resolved check or step up to a second late (finding F-W40-1).
- **The restart of the services has no duration.** One row and `startedAt = now` for every
  service that is not stopped. The brief's "services going down and up" does not exist in the
  simulator (as finding F-4 of the devices row); the test shows that nothing changes over 100
  ticks afterwards.

## 7. Runner output

### 7.1 The tests of the row

`npm run test -w @dems/core-server -- --maxWorkers=2 --silent=false --reporter=verbose src/modules/system src/modules/alerts`
(16:42:35, exit 0; `assets/40_own_unit_verbose.log`):

```
 Test Files  6 passed (6)
      Tests  180 passed (180)
   Start at  16:42:35
```

`DEMS_TEST_STEP=62 npm run test:db -w @dems/core-server -- --maxWorkers=2 --silent=false --reporter=verbose src/modules/system src/modules/alerts`
(16:42:17, exit 0; `assets/40_own_db_verbose.log`):

```
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_62_tmdmyhhk_
 Test Files  3 passed (3)
      Tests  55 passed (55)
   Start at  16:42:17
   Duration  7.29s (tests 62%, transform 20%, import 17%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 3 database(s) in 136 ms; 0 remain with the run prefix dems_test_step_62_tmdmyhhk_
```

Each database file sets `vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 })`.

### 7.2 Whole projects, typecheck, lint (final state)

`npm run test -w @dems/core-server -- --maxWorkers=2` (16:42:38, exit 0; `assets/40_unit_whole.log`):

```
 Test Files  136 passed (136)
      Tests  3527 passed (3527)
   Start at  16:42:38
   Duration  43.38s (import 62%, tests 33%, transform 5%, worker 1%)
```

`DEMS_TEST_STEP=62 npm run test:db -w @dems/core-server -- --maxWorkers=2` (16:43:30, exit 0; `assets/40_db_whole.log`):

```
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_62_tmdn0it3_
 Test Files  106 passed (106)
      Tests  1516 passed (1516)
   Start at  16:43:30
   Duration  126.69s (tests 80%, import 18%, transform 2%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 232 ms; 0 remain with the run prefix dems_test_step_62_tmdn0it3_
```

`npm run typecheck -w @dems/core-server`: exit 0, 0 errors. `npm run lint -w @dems/core-server`:
exit 0, no warning. Both ended 16:45:56; `assets/40_typecheck_lint.log`.

Each whole project was run once, at the end.

### 7.3 Earlier runs that were not green (P11)

| Time | Command | Result | Whose |
|---|---|---|---|
| 16:05 | typecheck | exit 2 | `src/modules/health/__tests__/health.test.ts(131,39)` TS2322 and `src/modules/security-audit/__tests__/chain.db.test.ts(236,93)` TS2339: other rows in flight. Seen on screen only; no file was kept |
| 16:05 | lint | exit 0, 4 warnings | Three in other rows' files (`src/realtime/hub.ts:854`, `:857`; `security-audit/__tests__/chain.db.test.ts:19`). **One was this row's** (`alerts/__tests__/routes.test.ts:218`, a useless spread), fixed at once |
| 16:17 | typecheck | exit 2, 2 errors | Both in `src/realtime/__tests__/support.ts` (the realtime row); `assets/40_typecheck_red_1617.log` |
| 16:45 | typecheck, lint | exit 0, exit 0 | — |

Failures of this row's own tests while they were being written, each a mistake in the test and
fixed: four assertions that counted the start-up's log lines as a call's; the unit AC-B-71 test
twice (a ring row altered by the demo tamper; a `FAULT_RAISED` row of the dataset's own history);
the detail key of the guard's denial row (`operationId`, not `operation`); and the three effects
tests of section 6.6, whose first assertion was wrong about the engine.

### 7.4 Test ledger (P24)

| Project | Baseline of the brief (15:40) | Final run of this row | This row's files | This row's tests |
|---|---|---|---|--:|
| `unit` | 102 files, 2,661 tests | 136 files, 3,527 tests (16:42:38) | `system/__tests__/routes.test.ts` (74), `settings.test.ts` (14), `static.test.ts` (22); `alerts/__tests__/routes.test.ts` (38), `acknowledge.test.ts` (9), `static.test.ts` (23) | 180 in 6 files |
| `db` | 75 files, 1,081 tests | 106 files, 1,516 tests (16:43:30) | `system/__tests__/system.db.test.ts` (31), `effects.db.test.ts` (4); `alerts/__tests__/alerts.db.test.ts` (20) | 55 in 3 files |

The rest of the growth (28 unit files with 686 tests, 28 database files with 380 tests) belongs
to the rows that ran at the same time; this row did not attribute it. Other workspaces were not
touched and not run.

## 8. Mutation check (rule M11, rule M15)

A scratch Vitest configuration outside the repository gives ONE production file to the runner
with ONE text replaced (a `load` transform; `assets/40_mutation_harness.*`, `40_mutations.json`).
No file of the repository was changed: the six production files have the same SHA-256 before the
first run (16:20) and after the last. 86 mutations: 5 in `status.ts`, 12 in `settings.ts`, 4 in
`operations.ts`, 32 in `system/index.ts`, 24 in `alerts/index.ts`, 9 in `acknowledge.ts`.

A mutation counts as surviving only when the runner prints `N passed (N)`
(`assets/40_mutations_classified.log`). A first, looser reading of the output had listed one run
in which every test was skipped as a survivor; it is not one.

| Pass | When | Suite | Mutations | Tests failed | Survived | Neither |
|---|---|---|--:|--:|---|---|
| Unit, pass 1 | 16:20:31 to 16:24:20 | 178 tests | 86 | 83 | M34, M48, M49 | 0 |
| Unit, the three again | 16:25:03 | 180 tests | 3 | 1 (M49) | M34, M48 | 0 |
| Database, pass 1 | 16:26:21 to 16:40:19 | 55 tests | 86 | 71 | 14 | 1 (M53: the app does not boot, all 55 skipped) |
| Database, M01 to M05 again | 16:41:16 | 55 tests | 5 | 5 | — | 0 |

**Two changes to the tests were made because of survivors, after the fact:**

1. **M49** ("the answer of operation 68 always says presentation mode is off") survived the unit
   tests: no unit test compared the answer body of a call that switches presentation mode on.
   One assertion was added; M49 is detected since.
2. **M03** ("operation 64 always answers `update.state: IDLE`") survived the database tests. The
   cause was a defect in three of this row's own assertions, which built the expected value with
   `systemStatusOf`, the function under test (`system.db.test.ts`, `effects.db.test.ts`,
   `routes.test.ts`). The three now pick the slices from the state themselves, and the effects
   test reads operation 64 during and after the update. M03 is detected since; M01 and M02 went
   from 1 failing test to 5.

The other mutations were not run again after these two changes: 83 of the unit results are
against the 178-test suite, 81 of the database results against the files before the second
change. Both changes only add or replace assertions.

**M34 and M48** are equal in behaviour for every body the schema lets through (the validated body
as the patch; the answer as the slice with the patch over it). No behaviour test can see them.
The real `system/__tests__/static.test.ts`, run against a copy of the sources outside the
repository with the mutation applied (`assets/40_mutations_static_copy.log`): 22 passed on the
unmutated copy, 1 failed with M34, 2 failed with M48.

**The 13 that the database tests alone do not detect**, each detected by the unit tests unless
noted:

| Mutations | Why the database tests cannot see it |
|---|---|
| M16, M85 (message text), M17, M86 (unit label) | The tests import the constants; a pure test pins the texts |
| M22 (two reads of the engine), M32, M74 (a copy of the principal) | Only the engine double counts reads and compares by reference |
| M52, M77 (no response schema) | Only the bare-route test sees the schema object |
| M27 (a fixed `restarted: 16`) | No engine action stops a service, so 15 cannot be produced on the real host |
| M47 (the line written after the committed read) | Differs only when the engine stops between commit and read |
| M34, M48 | Equal in behaviour; the static test |

M27 and M47 were not foreseen: a list of expected database survivors written before the run named
11 mutations (two of them under wrong IDs: M76 and M79 were written for M74 and M77) and missed
these two and M03.

## 9. Measured round trips of one command (rule M13)

With the engine row's counting pool (statements on connections of units of work; the session
lookup of stage 4 runs on the pool and is not counted). `assets/40_own_db_verbose.log`.

| Request | Statements | Of which the command's transaction |
|---|--:|--:|
| `POST /api/v1/settings`, a change | 11 | 6 |
| `POST /api/v1/settings`, unchanged | 5 | 5 |
| `POST /api/v1/alerts/{id}/acknowledge`, a change | 11 | 6 |
| `POST /api/v1/alerts/{id}/acknowledge`, unchanged | 5 | 5 |
| `GET /api/v1/system/status`, `GET /api/v1/alerts` | 0 | — |

A change, in order (the first five are stage 4's unit that records the session's activity):

```
BEGIN ISOLATION LEVEL READ COMMITTED
SELECT seq, hash FROM public.audit_chain_lock()
SELECT set_config('statement_timeout', $1, true), set_config('search_p...
UPDATE public.auth_sessions SET last_seen_at = $2 WHERE id = $1 AND en...
COMMIT
BEGIN ISOLATION LEVEL READ COMMITTED                        -- the module's unit
SELECT seq, hash FROM public.audit_chain_lock()
SELECT set_config('statement_timeout', $1, true), set_config('search_p...
select "id", "username", "rank", "name", "display_name", ... -- the operators mirror (ENG-3)
update "console_settings" set "time_format" = $1, "updated_at" = $2 wh...   -- or: update "alerts" set "acknowledged" = $1 where "alerts"."id" = $2
COMMIT
```

No `audit_log` and no `events` statement in either. The unchanged form sends the unit's frame and
the mirror, and no write. The other three commands were not measured.

## 10. Contract gaps, findings

### CONTRACT-GAP-W40-1: a POST without a request body documents no 400

`runDiagnostics`, `restartServices`, `startSoftwareUpdate` and `acknowledgeAlert` take no body.
Stage 7 still answers 400 `INVALID_JSON` to a body that is no JSON object, and the registry
documents no 400 for them:

```
[w40] runDiagnostics: body [1] answers 400 INVALID_JSON; against the contract: {"ok":false,"reason":"UNDOCUMENTED_STATUS","issues":["400"]}
```

(the same line for the other three). It is the gap of the devices row (CONTRACT-GAP-W36-1) on
four more operations. Text for the close-out row W83, either: add `400: INVALID_JSON` to
`responses` of the three in `packages/shared/src/api/system.ts` and of `acknowledgeAlert` in
`alerts.ts`, with the example `{ invalidJson: ERROR_EXAMPLES.invalidJson }`; or define 400
`INVALID_JSON` once at envelope level, as 400 `INVALID_PATH` is, which covers every body-less POST.

### CONTRACT-GAP-W40-2: the sentence about `FAULT_RAISED` in the alerts descriptions

`alerts.ts`, description of `listAlerts`: "Every alert was raised by a fault, and raising it wrote
a FAULT_RAISED audit row." Two cases differ: the kind `AUDIT_TAMPER` writes
`AUDIT_CHAIN_DISCONTINUITY`, and the schema allows the kind `SYSTEM` "for an alert no fault
raised". Text for W83: "Every alert of a fault kind was raised by a fault, and raising it wrote a
FAULT_RAISED audit row (AUDIT_CHAIN_DISCONTINUITY for the kind AUDIT_TAMPER)." The same sentence
is in the file's header comment.

### Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-W40-1 | **Operation 64 can be up to one second behind the engine, and for part of a second it can contradict itself.** The engine host commits the hardware snapshot (`diagnostics`, `update`, `services`) on a tick at most once per second of the server clock; records (`device`, audit rows, events) are committed at once. Measured: the committed `diagnostics` was behind on 48 of 105 ticks, the committed `update` on 90 of 207, at most 700 and 900 ms. For 18 ticks (+8,850 to +9,700 ms) the committed state held `device.softwareVersion: 2.5.0` beside `update.state: RUNNING` and `currentVersion: 2.4.1`; the `UPDATE_COMPLETED` row was already stored | `effects.db.test.ts`; section 6.6 | Not fixable in the module (it may not read the engine's working state). The realtime `state` topic carries the same committed state. For the engine's owner: a tick that commits a record of the maintenance subsystem could commit the snapshot with it, as a tick with a changed fault does. Decision DN-2 |
| F-W40-2 | AC-B-71 holds as "one audit row per alert", not literally as "a `FAULT_RAISED` row": the `AUDIT_TAMPER` alert has `AUDIT_CHAIN_DISCONTINUITY`. The row carries no alert ID; alert and row are linked by kind, target, instant, text and severity | section 6.2 | For the test report (W47, W52) and CONTRACT-GAP-W40-2 |
| F-W40-3 | **AC-B-71 was not shown on the bulk template.** Of the 88 listed fault alerts of the fixture, 0 have a `FAULT_RAISED` row with the alert's kind, target, instant and text; 88 have one with its kind and instant. The fixture's rows differ from its alerts in text, target or severity. Fixture data, not raised by a server | `alerts.db.test.ts`, bulk test (printed, not asserted) | A test that asserts AC-B-71 on `tpl_bulk` with the alert's text would fail. For the fixture's owner if W47 or W52 want it |
| F-W40-4 | A stored alert older than the newest 100 cannot be acknowledged: the engine's ring does not hold it, so the call answers 204 and changes nothing. Operation 69 lists the ring only (100 of 250 on the bulk template) | `alerts.db.test.ts`, bulk test | As in the simulator. For the client rows: there is no way to page to older alerts |
| F-W40-5 | `startSoftwareUpdate` answers 202 and changes nothing when an update already runs or no version is available, also while a session is open: the simulator checks those two before the session | `routes.test.ts` "the order is the simulator's" | The 409 exists only when an update could start. A note for W83 beside the operation's description |
| F-W40-6 | The simulated restart of the services has no duration: one row, every running service started now, nothing afterwards | section 6.6 | The brief's "going down and up" was not built: it does not exist |
| F-W40-7 | An engine that stops between the commit of a settings change and the answer gives 503 although the change is stored (as finding F-W37-2). The log line is written in that case. `acknowledgeAlert` reads nothing after its unit and answers 204 | `routes.test.ts` (both folders) | Residual, as accepted for storage (D88 DN-2) |

No `SCHEMA-GAP` and no `SIM-GAP` was allocated.

## 11. Deviations, and decisions for the controller

| ID | Deviation from the row text | Reason |
|---|---|---|
| DV-1 | An unknown key of a settings body is dropped (200), not refused with 422 | The contract (API-4); section 6.3 |
| DV-2 | The over-time proof asserts the engine's own state tick for tick and a bound of one second for the committed state, not the committed state tick for tick | Finding F-W40-1 |
| DV-3 | Nothing "goes down and up" in the restart test | Finding F-W40-6 |
| DV-4 | The test support and the static rules live in `system/__tests__/` and are imported by the alerts tests | Both folders are this row's |
| DV-5 | The over-time test reads the hosted simulator through the engine's test control `simulator()` | To tell the engine's own state from the committed one. No module reads it (static tests) |
| DV-6 | Test support of five other rows is imported read-only (core, engine, identity, the seed's reference host, the scaffold's log capture and static scanner) | Their files say other rows may, or earlier rows did the same (D77 DV-8) |
| DV-7 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run (P8) |
| DV-8 | The mutation run of the database tests took 14 minutes (86 runs of three files) | One pass, this row's files only; no whole-project suite ran during it |

| ID | Decision | Recommendation |
|---|---|---|
| DN-1 | Whether a call that changes nothing writes a log line. The specification says "one log line each" and names "the settings keys that changed"; it does not speak of a call that changes nothing. Built: no line | Accept: a line with an empty list of names would say that nothing happened. If "one line per call" is wanted, it is one condition in each handler |
| DN-2 | Finding F-W40-1 | Route to the engine's owner with fix round B, or accept as a residual and tell the client rows that the system page can lag by a second |
| DN-3 | The wording of AC-B-71 against spec §7.16 | Read AC-B-71 as "an audit row of its fault", and take CONTRACT-GAP-W40-2 into W83 |

## 12. End state and cleanup (16:46:07)

A scratch script outside the repository, as `dems_owner`, through the test helper's own reader of
the connection file; it prints names and counts (`assets/40_end_state.mts.txt`, `40_end_state.log`):

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_62_*): 0
test databases of all rows at this moment: 3
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
postgres.pid: 19121
```

- `.locks/postgres.pid`: 19121, the process started 07:14:26. PostgreSQL was never stopped or
  reconfigured. `dems_demo` and the lane databases were never connected to by this row.
- No port was bound, no process was started that still runs, no emulator and no lane was used.
- Database commands ran with the per-command sandbox bypass (rule M12). No `timeout` command.
  Most commands began with `cd` to the workspace root itself; none entered a subfolder.
- The two links to the repository's `node_modules` and the copy of the sources that the mutation
  check used were under the session's scratchpad and were removed. The unit tests write their
  error log files under the system's temporary directory and remove them.

## 13. Rollback (R-NEW; not executed)

`apps/core-server/` is untracked, so the pre-images are file copies:

| Pre-image under `.cache/rollback/` | SHA-256 | Restores |
|---|---|---|
| `W40.system.index.ts.pre` | `adc95025…f96cf8` | `apps/core-server/src/modules/system/index.ts` (the stub of W08) |
| `W40.alerts.index.ts.pre` | `693b779a…13866f` | `apps/core-server/src/modules/alerts/index.ts` (the stub of W08) |

Steps: copy the two pre-images back over the two `index.ts` files; remove `operations.ts`,
`settings.ts`, `status.ts` and `__tests__/` under `src/modules/system/`, and `acknowledge.ts` and
`__tests__/` under `src/modules/alerts/`. Nothing else: no package, no schema, no contract file,
no database and no host setting was changed. With the stubs back the seven operations answer 404.

## 14. Not done, and not verified by this row

- No request went through a listening server: every request is `app.inject` (P18).
- No caller on a paired device (a bearer session) was sent through the real stages for these
  seven operations, and 403 `DEVICE_REVOKED` was not exercised for them.
- The refusal of `runDiagnostics` for a role without the permission is shown only in the unit
  test, with a principal built for it: every seeded role holds `DIAGNOSTICS_RUN`.
- On the real engine every diagnostics check ended PASS. A WARN or FAIL verdict was not produced
  there.
- Round trips were measured for operations 68 and 70 only.
- The realtime side (a `delta` reaching a socket) is W42's; here the publication handed to
  `app.publish` is checked.
- The role-by-operation matrix over all 75 operations is W47's.
- After the two test changes of section 8 the full set of mutations was not run again.
