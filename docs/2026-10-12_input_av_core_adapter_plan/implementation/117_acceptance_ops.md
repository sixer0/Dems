---
task_slug: input_av_core_adapter_plan
row: 117
milestone: M10 / WP-26b
date: 2026-10-13
agent: coder-execution (driver, track D)
tier: T3
status: complete (both routes live; the acceptance pair has 6 reds left, all of row 106b's operations 104 / 105; seven driver decisions to confirm)
---

# Row 117 - the live installation acceptance and its revocation (operations 109, 110)

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `IA` = `CS/src/modules/capture-config/installation-acceptance`. Built on `implementation/116_acceptance_contract.md` (the contract, its schemas, refusals and nine decisions adopted by C80), `implementation/114_schema_set_c.md` (table `installation_acceptances`, section 3 "as built"), the two request lines of those rows; decisions U10, U11 (OQ-2), C2, C61 (2), C80; security finding S13-13. Nothing of `packages/shared`, the schema, the migrations, `app.ts` or `apps/core-web` was edited.

## 1. What was built

| Part | File | Content |
|---|---|---|
| The statements | NEW `IA/store.ts` | `INSERT ... RETURNING` (no conflict clause) and ONE `UPDATE ... SET revoked_at, revoked_by, revoke_reason WHERE revoked_at IS NULL RETURNING`; `isInForceViolation` = SQLSTATE 23505 by `installation_acceptances_in_force_key` and nothing else. NO read statement exists |
| The operations | NEW `IA/service.ts` | `acceptInstallation`, `revokeInstallationAcceptance`, `storableDiagnosticsOf`, `installationAcceptanceOf` |
| The routes | NEW `IA/routes.ts` | two `.route({ ...routeOfOperation(...) })` with the contract's strict body schemas and `InstallationAcceptanceSchema` as the 200 answer |
| The mount | NEW `IA/index.ts` | `mountInstallationAcceptance(app)`: the host on a unit of the engine (`app.engine.run`), the persistent failure sink, `installationAcceptanceControl(app).replaceForTest({ store })` for tests |
| The module-list entry | `CS/src/modules/capture-config/index.ts` | one import, one mount line after `mountCaptureHostAlias`, one header paragraph, one export line (the test control) |

Both operations: access from the registry entry (stage 6: `CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION`, so TECHNICIAN on the web console only), idle only, ONE unit of work for the table row and exactly ONE audit entry.

## 2. Order of the answers (each refusal stores nothing and writes no audit row)

| # | Operation 109 | Operation 110 |
|--:|---|---|
| 1 | 401 / 403 (stage 6; one `ACCESS_DENIED` row for a 403), before the body is used | the same |
| 2 | 400 body is no JSON; 422 body outside its strict schema | the same |
| 3 | 409 `CAPTURE_CONFIG_LOCKED` - a session is open (asked before the unit and again inside it) | the same |
| 4 | 409 `INSTALLATION_DIAGNOSTICS_NOT_COMPLETE` - no run, or `completedAt` null | 409 `INSTALLATION_ACCEPTANCE_NOT_IN_FORCE` - the UPDATE changed no row |
| 5 | 409 `INSTALLATION_DIAGNOSTICS_NOT_STORABLE` - the Core's own run does not parse after its texts were made one line | 200 - the three revoke columns, ONE `INSTALLATION_ACCEPTANCE_REVOKED` entry |
| 6 | 409 `INSTALLATION_SITE_NOT_STORABLE` - id, name, room or version outside its one-line bound (never cut) | |
| 7 | 409 `INSTALLATION_ACCEPTANCE_IN_FORCE` - THE DATABASE refused the INSERT (23505 by the in-force index) | |
| 8 | 200 - the row, ONE `INSTALLATION_ACCEPTED` entry | |

"One in force" is never asked first: the INSERT is sent and the index answers; the UPDATE is sent and its row count answers. The unit that lost its INSERT is left by the refusal (rolled back); the engine goes on committing (measured: `suspended` false after it).

What the Core reads itself: who (`principal.operatorId`), when (`app.clock.now()`), the software version (`CORE_SERVER_VERSION`), `device.id` / `.name` / `.room` and `diagnostics` of the state the unit sees (`scope.pending()`). The copy of the run: every `label`, `detail` and text value of `params` through `installationAcceptanceTextOf`, a `params` member without a value left out, every other member carried as it is, then `InstallationAcceptanceDiagnosticsSchema`. Nothing is dropped silently: a member the closed lists do not name refuses the acceptance.

Audit details: `INSTALLATION_ACCEPTED { acceptanceId, stepCount, passedCount, operationId, permission }`; `INSTALLATION_ACCEPTANCE_REVOKED { acceptanceId, operationId, permission }` (the closed lists of row 19, `CS/src/core/audit-details.ts`). Never a step, a site text, a diagnostics text or the typed reason; the log lines carry the type, the record id and a count.

A database error that is not the in-force answer (a CHECK, 23514, included) is persisted (`app.errorLog`, with SQLSTATE and constraint name, no value of the row) and leaves as it is: `500`.

## 3. Where a denied key name is refused

BY THE ROUTE, BEFORE THE DATABASE: both bodies are strict objects at every level, so each of the 28 names of `AUDIT_DETAIL_FORBIDDEN_KEYS` (and every other member outside a key list) is `422` before any statement. Tested: each of the 28 as a member of a step, as a member of the body and at depth inside a value of a step (`service.test.ts`, by import of the Core's constant); six such bodies through the booted route with no row, no audit row and no line in the error log (`routes.db.test.ts`).

THE DATABASE IS THE BACKSTOP: with the folder's own statement as `dems_app`, a denied name in a step answers 23514 `installation_acceptances_steps_no_secret_keys_check`, at the fourth level of the diagnostics `..._diagnostics_no_secret_keys_check`; a two-line text `..._steps_bound_check`; a nested step `..._steps_check`. Through the route with a store that sends what the route never would: `500`, the failure persisted with `23514` and the constraint name, no row, no entry.

## 4. Recording is not gated

Nothing reads an acceptance. Held by `service.test.ts`: outside `src/db/` the table is named by `IA/store.ts` alone; the folder is imported by `capture-config/index.ts` alone; no file under `capture-session`, `capture`, `engine`, `sealing`, `sealing-host`, `modules/sessions` names an acceptance; the folder exports no reader and its store has `insert` and `revoke` only; a planted reader is seen (positive control). On the database: a session opens with an acceptance in force and with none.

## 5. The named deferrals ended (by delta; Edit tool; re-read before each)

| File | Change |
|---|---|
| `CS/test/acceptance/contract.test.ts` | `LANDED_UNROUTED` and `UNROUTED_UNTIL` lost the two routes; the literal of unrouted ids lost `acceptInstallation`, `revokeInstallationAcceptance`; the unrouted free-text literal lost the three members of 109 / 110 (walked now); router pin 107 -> 109 on both lines; ONE new area case "the installation acceptance" (202 run, 409 not complete, 409 not in force, three 422, 200, 409 in force, 200 revoke, two 401); two lines in area 4 (409 `CAPTURE_CONFIG_LOCKED` of both with a session open); three comment lines |
| `CS/test/acceptance/rbac-matrix.test.ts` | `DEFERRED_ROUTE` lost the two ids; routed operations 104 -> 106; `routedDelta` INVESTIGATOR 20 -> 22, SUPERVISOR 3 -> 5; `cellsOf('SUPERVISOR')` gained the two ids; three comment lines |

No other list needed an entry: `OTHER_UNITS` of `capture-config/__tests__/routes.test.ts` covers `/api/v1/capture/` only; `test/static/scaffold.test.ts` and the P25 block of `capture/__tests__/static.test.ts` pin `app.ts`, which was not edited.

## 6. Checks (2026-10-13, `--maxWorkers=2`; database runs with the sandbox off, throw-away databases under `.locks/db-migrate.lock`)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Unit tests of the folder | `npx vitest run --project unit --maxWorkers=2 src/modules/capture-config/installation-acceptance` | `Test Files 1 passed (1)`, `Tests 22 passed (22)` (first run; run again after a lint-only change of the test: the same line) |
| Database tests of the folder | `npx vitest run --project db --maxWorkers=2 src/modules/capture-config/installation-acceptance/__tests__/routes.db.test.ts` | first run `Tests 2 failed, 12 passed (14)`: both failures in MY new test (a fixture row stamped 1 ms after the clock, so its revocation met `revoked_at_check`; the second failed by the row the first left). Second run, with that case made a test of its own: `Test Files 1 passed (1)`, `Tests 15 passed (15)`, `0 remain` |
| The acceptance pair | `npx vitest run --project db --maxWorkers=2 test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | `Tests 6 failed, 75 passed (81)`, `0 remain`. ALL SIX are operations 104 / 105 of row 106b (mounted, deferrals not ended yet): `contract.test.ts:577`, `:637`, `:2575` (the two alias routes reported routed); `rbac-matrix.test.ts:1279` (the two ids), `:1302` (106 against 108), `:1360` (22 / 5 against 24 / 7). None names 109 / 110; my area case, the idle-lock lines, the free-text walk and the coverage block passed |
| The other walkers of every operation, and the neighbour | `npx vitest run --project db --maxWorkers=2 src/modules/rbac/__tests__/matrix.db.test.ts src/modules/devices/__tests__/simulated-no-source-class.db.test.ts src/engine/__tests__/api-headers.outcome.db.test.ts src/modules/capture-config/network/__tests__/routes.db.test.ts` | `Test Files 4 passed (4)`, `Tests 45 passed (45)`, `0 remain` |
| The static set and the neighbouring unit tests | `npx vitest run --project unit --maxWorkers=2 test/static src/modules/capture-config src/plugins/permission-guard src/modules/devices/__tests__/routes.test.ts src/capture/__tests__/static.test.ts src/modules/__tests__ src/engine/__tests__/hosted-actions.test.ts` | `Test Files 1 failed, 40 passed (41)`, `Tests 1 failed, 764 passed (765)`. The one red is `src/modules/capture-config/factory-scan/__tests__/service.test.ts` "the file itself: it logs through its host only ..." (`catch {` 7 expected, 8 found): row 106b's folder, not edited |
| Typecheck | `npx tsc --noEmit` | exit 0 (two earlier runs each showed one error in `packages/shared` while agent V4 was writing it: `sim/api.ts(48,3)`, then `api/capture-discovery.ts(1559,24)`; none in a file of this row) |
| Lint | `npx oxlint src/modules/capture-config/installation-acceptance src/modules/capture-config/index.ts` | no finding (three warnings in my unit test were fixed) |

What the tests of the folder hold:

| Subject | Where |
|---|---|
| Every refusal of section 2, each with no statement where none is due, no row, no entry | `service.test.ts` (22 cases), `routes.db.test.ts` |
| RBAC: 401 without a session; 403 INVESTIGATOR and SUPERVISOR; 403 `WEB_CONSOLE_ONLY` for the TECHNICIAN on a tablet; ONE `ACCESS_DENIED` row each, before the body is used; only the TECHNICIAN on the web console passes | `routes.db.test.ts` |
| Two acceptances at the same moment | through the route: of two requests sent together one is 200 and one is 409 `INSTALLATION_ACCEPTANCE_IN_FORCE`, one row in force, ONE entry. On two open transactions of `dems_app` with the folder's statement: the second INSERT waits, and is refused by the in-force index when the first commits |
| The audit entry exactly once per committed change, none on a refusal | every case counts the trail; the last case counts the whole file: accepted entries = rows written by an operation, revoked entries = revoked rows |
| A unit that fails after its statement stores nothing (accept) and leaves the acceptance in force (revoke) | both files |
| The Core's own facts: the version constant, the device copy, the run check for check; a failed check is recorded | both files |
| Device text of the run made one line of 200 characters; a member outside the lists refuses the acceptance | `service.test.ts` |

## 7. Requests (`delegation_progress/file_requests.md`, four lines)

| To | Content |
|---|---|
| 106b, V4, the controller | what moved in the two acceptance files, the six reds that are 106b's, the values after 106b's own delta (router 111, routed 108, `routedDelta` 24 / 7), and the red seen in 106b's `factory-scan` test |
| the owner of `db/reset/kept-tables.ts` | NOW DUE (row 114's line, C61 (5)): the table is written from this row on and a demo reset still empties it; blocking before an acceptance is recorded on a database a reset can run on |
| V4 / the contract's writer | no schema of 109 / 110 is wrong against the table. Three text points: the Core judges the body before the idle lock; `..._IN_FORCE` is the last refusal of 109; the clock finding of DD-6. One stale comment in A5's pin file |
| row 118 | the routes as built and how a form learns the state |

## 8. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | The routes are a FOLDER of `modules/capture-config` (`installation-acceptance/`), mounted by one line there; no new unit in `app.ts` | `app.ts` is frozen (P25) and a new unit needs a waiver plus entries in two static lists other agents write; rows 108, 107 and 106b took the same way and it was adopted. The brief's "ONE named entry" is the mount line. The path stays `/api/v1/installation/...` (C80) |
| DD-2 | The software version of the record is `CORE_SERVER_VERSION`, not `device.softwareVersion` of the state | truth rule 3f (`modules/system/status.ts`): the state's version is the hosted model's; the Core's version is its one constant, what operation 1 and a sealed manifest state |
| DD-3 | The database's 23505 is CAUGHT and mapped; the INSERT has no `ON CONFLICT DO NOTHING` | the brief and record 114 name the violation as the judge. Consequence: the unit is rolled back by the refusal - nothing else was written in it |
| DD-4 | `..._IN_FORCE` is the LAST refusal of 109 | it can only be the database's answer to the INSERT; asking earlier is the pre-check the brief forbids |
| DD-5 | Every member of the Core's run is carried into the copy; an unknown member refuses the acceptance (`..._NOT_STORABLE`) instead of being dropped | S13-13 and "the run as it was": a silent drop would store a record that is not the run. A new diagnostics value fails the shared key-list test first (record 116 DD-5) |
| DD-6 | A revocation the table refuses by `installation_acceptances_revoked_at_check` (the server clock went back past `accepted_at`) is a `500` with the failure persisted; the instant is NOT bent to `accepted_at` | a stored instant that is not the clock's would be a false record; the contract names no refusal for it. Measured in `routes.db.test.ts`. A named 409 is a contract step |
| DD-7 | The folder offers NO reader, not even for tests; the tests read the table as the owner | "nothing reads an acceptance to allow or refuse a recording" is then a property of the folder's door, held by a test |

## 9. The doubles, and what stays unproven

The Core of the database tests is in SIMULATED capture (it stores the record as any Core does); its diagnostics run is the hosted model's, started by the hosted action and ended by the engine's ticks on a clock the test moves. The unit tests use a store in memory that refuses a second row in force as the database does, and a unit that commits or forgets. No device, no installation, no host. Unproven until the hardware package: that the diagnostics run of a production Core uses only the 16 `params` names and fits 16,384 bytes after its texts are made one line (otherwise every acceptance there answers `INSTALLATION_DIAGNOSTICS_NOT_STORABLE`), that `core_device` of an installed Core holds a one-line id, name and room of at most 200 characters, the ctype of the production database (record 116 DD-4), and the procedure of chapter 4 of the hardware acceptance (at most 32 steps). Not built here: the screen (row 118); the kept-table entry of a demo reset (request).

Existing files were edited with the Edit tool only, each after a re-read, one small additive edit at a time; no list was rewritten. New files (Write): the four source files and two test files of `IA`, this record, `delegation_progress/row_117.md`.

---
*Generated: 2026-10-13 14:10*
