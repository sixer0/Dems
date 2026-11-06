---
task_slug: input_av_core_adapter_plan
row: 116
milestone: M10 / WP-26b
date: 2026-10-13
agent: coder-execution (wave 11, agent A5)
tier: T3
status: complete (contract only: no Core route, no screen; nine driver decisions to confirm)
---

# Row 116 - the contract package of the installation acceptance and its revocation (operations 109, 110)

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`, `CS` = `apps/core-server`, `WEB` = `apps/core-web`. Built on `implementation/114_schema_set_c.md` (table `installation_acceptances`, section 3 "as built") and its request line; decisions U10, U11 (OQ-2), C2, C61 (2), C62, C67; security finding S13-13. ONE change set; `SH/openapi/openapi.json` written once, last, by the repository's generator.

Counts after the row: **110 operations (39 GET / 71 POST), 82 audit types, 51 actions, 15 permissions**; schema `[11, 'dbc-12']` untouched. No audit type was added: `INSTALLATION_ACCEPTED` and `INSTALLATION_ACCEPTANCE_REVOKED` (category SYSTEM) exist since row 19, with their closed detail lists in `CS/src/core/audit-details.ts:583-596`.

## 1. The two operations

Both: tag Device, mode `simulated`, access `CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION` (the access object of operations 101-107: TECHNICIAN only by U10, web console only), idle only (`409 CAPTURE_CONFIG_LOCKED`, no audit row), denial `ACCESS_DENIED`, exactly ONE audit entry on success (no `also`). Both descriptions state: **recording is not gated on an acceptance** (design addendum section 10, item 6).

| # | operationId | Method, path | Body | Success (Core only) | Audit on success |
|--:|---|---|---|---|---|
| 109 | `acceptInstallation` | POST `/api/v1/installation/acceptance` | `InstallationAcceptRequest` `{ siteAddress?, steps }` | 200 `InstallationAcceptance` | `INSTALLATION_ACCEPTED` (`acceptanceId`, `stepCount`, `passedCount`) |
| 110 | `revokeInstallationAcceptance` | POST `/api/v1/installation/acceptance/revoke` | `InstallationAcceptanceRevokeRequest` `{ reason }` | 200 `InstallationAcceptance` | `INSTALLATION_ACCEPTANCE_REVOKED` (`acceptanceId`) |

Statuses of both: 200, 400, 401, 403, 409, 422; the in-app simulator answers every one but 200.

What the client sends and what it does not. The body of 109 names the steps and the site address. Who, when, the software version, the copy of the Core's id / name / room and the diagnostics are the Core's own facts: no member exists for them (a body naming one is `422`). The body of 110 holds no id: the Core names the one acceptance in force from its own state.

Five schemas (`INSTALLATION_ACCEPTANCE_SCHEMAS`): `InstallationAcceptanceStep`, `InstallationAcceptanceDiagnostics`, `InstallationAcceptance`, `InstallationAcceptRequest`, `InstallationAcceptanceRevokeRequest`.

## 2. NO FREE JSON (S13-13): the closed key lists

Every object of the two documents is a strict object: a member outside its list is refused.

| List (constant) | Members |
|---|---|
| `INSTALLATION_ACCEPTANCE_STEP_KEYS` | `id` (a CODE, `^[A-Z][A-Z0-9_]{0,63}$`), `passed` (boolean), `detail` (a note on one line, or null) |
| `INSTALLATION_ACCEPTANCE_DIAGNOSTICS_KEYS` | `id`, `startedAt`, `completedAt`, `checks` - the Core's `DiagnosticsRun` |
| `INSTALLATION_ACCEPTANCE_DIAGNOSTICS_CHECK_KEYS` | `id`, `label`, `status`, `detail`, `params`, `resolvesAt` - `DiagnosticCheck` |
| `INSTALLATION_ACCEPTANCE_DIAGNOSTICS_PARAM_KEYS` (16) | `rule`, `cpuPercent`, `cpuTempC`, `storageState`, `fanRpm`, `linkUp`, `linkSpeedMbps`, `activePorts`, `totalPorts`, `tracks`, `reason`, `source`, `offsetMs`, `ntpServer`, `securityState`, `posture`; each value a text, a number, a boolean or null |

Held by `SH/test/api-installation-acceptance.test.ts`:
- the four lists ARE the members of the four objects (read from the schemas' shapes);
- none of the lists holds one of the 28 denied key names - read from `CS/src/db/schema/value-sets.ts` as text (28 names, `code` among them) - and each of the 28 is refused in a step, in the run, in a check, in `params` and in both request bodies;
- the list of `params` equals what `evaluateDiagnostic` of `SH/src/sim/maintenance.ts` can state (its `params` literals, read from the source); a run of the seeded Core parses;
- a step is flat (a list or a map as a member is refused); a value of `params` is never a list or a map (the fifth level does not exist).

## 3. The bounds: the table's

`INSTALLATION_ACCEPTANCE_LIMITS` = 32 steps; 8,192 bytes (`steps`) and 16,384 bytes (`diagnostics`); every text of either document 0 to 200 characters on one line; version 1 to 64, site texts 1 to 200 (one line); site address 1 to 500 (line breaks allowed); revoke reason 5 to 500. The test reads `CS/src/db/schema/installation.ts` and holds the ten fragments of its CHECKs (`<= 32`, `<= 8192`, `<= 16384`, `{0,200}`, `{1,64}`, `{1,200}`, `BETWEEN 1 AND 500`, `BETWEEN 5 AND 500`, the two depth paths).

| Rule | How the contract holds it | Measured against the database |
|---|---|---|
| Size | `installationDocumentBytes(value)`: the bytes of the text form `jsonb` prints (one blank after every colon and comma; a number without an exponent: `1e+21` as a 1 with 21 zeros, `1e-7` as `0.0000001`) | EQUAL on six documents (empty list, empty object, steps with multi-byte text and escapes, a four-level run, fifteen numbers with both exponent forms, 32 steps): `octet_length($1::jsonb::text)` = the function, on a throw-away database (PostgreSQL 18.4, UTF8). So a `23514` of a bound CHECK is not reachable through the contract |
| Characters | counted as code points (`'\u{1F600}'.repeat(200)` is taken, 201 refused) | EQUAL: 200 astral characters taken, 201 refused by the path of the bound CHECK |
| One line | `isInstallationControlCharacter`: U+0000-U+001F, U+007F-U+009F, U+2028, U+2029 | 28 code points asked of the same path (`like_regex "^[^[:cntrl:]]{0,200}$"`), database ctype `C`: 26 equal; **U+2028 and U+2029 are taken by this database and refused by the contract** (driver decision DD-4) |
| At the bound | 8,192 / 16,384 bytes are taken, one byte more is refused; 32 steps or 100 checks whose texts are each in bound are refused when too large together | shared test, built with `installationDocumentBytes` |

The measurement was a scratch database test (`CS/test/db/zz-row116-measure.db.test.ts`), written and removed by this agent in the session; four runs under `.locks/db-migrate.lock` (three ended red on the scratch's own settings query, the last on the two code points above - its finding), each `0 remain`.

`installationAcceptanceTextOf(value, max = 200)` makes a text of the Core storable (each control character or lone surrogate becomes one blank; cut to `max` code points; idempotent). It is for the Core's own diagnostics text only: what an operator typed is refused, never rewritten.

## 4. Refusals (`InstallationAcceptanceReason`, each with its sentence)

All on `409 INVALID_STATE`.

| Reason | Sentence | When |
|---|---|---|
| `INSTALLATION_ACCEPTANCE_IN_FORCE` | An installation acceptance is already in force. Revoke it first. | 109: the database's `23505 installation_acceptances_in_force_key` |
| `INSTALLATION_ACCEPTANCE_NOT_IN_FORCE` | No installation acceptance is in force. | 110: nothing to revoke; the simulator's answer |
| `INSTALLATION_DIAGNOSTICS_NOT_COMPLETE` | Run the diagnostics and wait until they end first. | 109: no run, or `completedAt` null |
| `INSTALLATION_DIAGNOSTICS_NOT_STORABLE` | The diagnostics of this Core cannot be stored with an acceptance. | 109: the Core's own run does not parse (a `params` key outside the list, more than 16,384 bytes) |
| `INSTALLATION_SITE_NOT_STORABLE` | The name, the room or the version of this Core cannot be stored with an acceptance. | 109: a copy outside its single-line bound |
| `INSTALLATION_ACCEPTANCE_NOT_AVAILABLE` | An installation is accepted on a Core server only. | 109: the in-app simulator only |

`422 INVALID_INPUT` is the body's schema (a member outside the key list, 33 steps, a text too long or of two lines, steps larger than 8,192 bytes, a reason outside 5 to 500). No refusal quotes the input.

## 5. The simulator: stated answers that change nothing

| # | Answer |
|--:|---|
| 109 | `409 INVALID_STATE` / `INSTALLATION_ACCEPTANCE_NOT_AVAILABLE` for a body of the right form; 400 / 422 otherwise |
| 110 | `409 INVALID_STATE` / `INSTALLATION_ACCEPTANCE_NOT_IN_FORCE` for a body of the right form; 400 / 422 otherwise |

Order as the Core's: 401, the role (403 for SUPERVISOR and INVESTIGATOR), the web-console condition (403 `WEB_CONSOLE_ONLY`), the idle lock (409 `CAPTURE_CONFIG_LOCKED`), then the body. Tested: the whole simulator state is the SAME object before and after nine calls (no audit row, no event, nothing stored); every offline status of both operations is produced through the simulator (flow 19 of `SH/test/openapi.test.ts`, the lock included).

## 6. Files

| File | Change |
|---|---|
| NEW `SH/src/api/installation-acceptance.ts` | limits, key lists, the text rule and the size rule, reasons and sentences, five schemas, two operations, examples |
| `SH/src/api/core-api.ts`, `examples.ts`, `index.ts`, `openapi.ts` | the two operations after 108, the five schemas, the examples, one barrel line, header counts |
| `SH/src/sim/api.ts` | two route lines, two handlers, one import block, the header |
| NEW `SH/test/api-installation-acceptance.test.ts` | 18 cases |
| `docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md` | rows 109 and 110 in the table of section 2.6 (the acceptance matrix composes its expectation from it) |
| `SH/openapi/openapi.json` | regenerated ONCE, last, by the repository's generator |

Generator line: `wrote openapi/openapi.json (all (committed): 110 operations, 2 security schemes, version 0.3.0; offline: 44 operations, 0 security schemes, version 0.2.0; 1678209 bytes)` (`node --import tsx scripts/gen-openapi.ts` from `packages/shared`); a later `--check`: "is up to date".

## 7. Count pins moved (each by its delta, from the values after row V3)

Operations 108 -> 110; POST 69 -> 71 (GET 39); offline scope 42 -> 44; simulated 41 -> 43 (live 67); paths 101 -> 103; registry schemas 184 -> 189, offline components 67 -> 70, schemas "added" 166 -> 171; one-permission rules 68 -> 70, rules with a permission 69 -> 71; operations with a condition 24 -> 26; Device tag 34 -> 36; request bodies 41 -> 43; Core-server-only statuses 34 -> 36; cookie-or-bearer 98 -> 100; examples of Core-answered operations 98 -> 100; operations no action reaches 63 -> 65; guard cells 972 -> 990, denied INVESTIGATOR 45 -> 47, SUPERVISOR 10 -> 12 (TECHNICIAN 34); web-only refusal rows TECHNICIAN 14 -> 16 (SUPERVISOR 7); `CAPTURE_COMMISSION` enforced at 7 -> 9 operations; composed rows of section 2.6 16 -> 18, delta rows 33 -> 35; guarded (not PUBLIC) 104 -> 106; unrouted routes 4 -> 6, unrouted free-text members 2 -> 5. No audit pin and no action pin moved. The web's Try-it: denied 12 -> 14 and allowed 96 unchanged - W1's lines (section 9).

24 pin files: 11 in `SH/test` (`api-registry`, `api-capture-commissioning`, `api-capture-discovery`, `api-domain-operations`, `api-examples`, `api-openapi-scope`, `api-stt-config`, `api-text-rule`, `api-verify-report`, `openapi`, `sim-api`), 7 Core unit (`modules/devices/__tests__/routes`, `modules/stt-config/__tests__/routes`, `plugins/permission-guard/__tests__/access-rules`, `decision`, `denial`, `guard`, `matrix`), 3 Core acceptance (`contract.test.ts`, `rbac-matrix.test.ts`, `rbac-matrix.support.ts`), 3 web (`live-api-reference-page`, `live-api-reference-document`, `scalar-config`). `CS/src/modules/rbac/__tests__/matrix.db.test.ts` needed no edit (run, green).

## 8. Named deferrals added (each pinned by literal, naming row 117; no response is faked)

| List | Entries |
|---|---|
| `LANDED_UNROUTED` / `UNROUTED_UNTIL` and the literal of block 1 in `CS/test/acceptance/contract.test.ts` | `POST /api/v1/installation/acceptance`, `POST /api/v1/installation/acceptance/revoke` / `acceptInstallation`, `revokeInstallationAcceptance` |
| the same file, block API-13 (unrouted free-text members) | `acceptInstallation body.siteAddress`, `acceptInstallation body.steps.0.detail`, `revokeInstallationAcceptance body.reason` |
| `DEFERRED_ROUTE` of `CS/test/acceptance/rbac-matrix.test.ts` | `acceptInstallation`, `revokeInstallationAcceptance` |

The router pin (107) and the routed-operation pin (104 = 110 - 6) did not move. One line of row 107's delta was completed in the same file: `new Set(router).size` 106 -> 107 (the case was red on it; said to A2 in `file_requests.md`).

## 9. Checks (2026-10-13, `--maxWorkers=2`)

| Check | Command | Result |
|---|---|---|
| The new contract test | `npx vitest run --maxWorkers=2 test/api-installation-acceptance.test.ts` in `packages/shared` | first run `1 failed, 17 passed` - the failure was in MY new test (60 checks were over the bound before any widening; 59); second run `Test Files 1 passed (1)`, `Tests 18 passed (18)` |
| Shared contract, simulator, live, client and i18n, after the regeneration | `npx vitest run --maxWorkers=2 test/api- test/openapi test/sim- test/live- test/client test/i18n` | `Test Files 78 passed (78)`, `Tests 2127 passed (2127)` (runs before it listed the pins: 40 red, then 4 that waited for the regeneration, then 1 missed pin, `api-capture-discovery.test.ts:175`) |
| Core unit pins, writer and fixture | `npx vitest run --project unit --maxWorkers=2 src/plugins/permission-guard/__tests__ src/modules/devices/__tests__/routes.test.ts src/modules/stt-config/__tests__/routes.test.ts src/engine/__tests__/hosted-actions.test.ts src/modules/capture-config/__tests__/routes.test.ts src/core/__tests__/writers.test.ts src/db/fixtures/__tests__/audit-details.test.ts` (sandbox off: loopback) | `Test Files 14 passed (14)`, `Tests 501 passed (501)` |
| Web pins | `npx vitest run --maxWorkers=2 src/test/live-api-reference-page.test.tsx src/test/live-api-reference-document.test.tsx src/test/scalar-config.test.ts` in `apps/core-web` | `Test Files 3 passed (3)`, `Tests 149 passed (149)` (with W1's deny entries of 109 / 110 in the tree) |
| Acceptance, the matrix and the two other files that walk every operation, on throw-away databases (`.locks/db-migrate.lock`, sandbox off) | `npx vitest run --project db --maxWorkers=2 test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts src/modules/rbac/__tests__/matrix.db.test.ts src/modules/devices/__tests__/simulated-no-source-class.db.test.ts src/engine/__tests__/api-headers.outcome.db.test.ts` | first run (three files) `Tests 3 failed, 106 passed (109)`: the Set-size line of row 107, my unrouted free-text literal, and `adoptCaptureCandidate 422 NOT PRODUCED` (not mine; gone in the next run); second run `Test Files 5 passed (5)`, `Tests 113 passed (113)`; `0 remain` |
| Typecheck | `npm run -s typecheck` in `packages/shared`, `apps/core-web`, `apps/mobile`, `apps/transcriber`, `apps/mock-core` | exit 0, five of five |
| Typecheck | the same in `apps/core-server` | exit 2, ONE error: `src/evidence-export/__tests__/export.test.ts(521,111)` TS2322 - a file of another row with uncommitted hunks; 0 lines in a file of this row |
| Lint | `npx oxlint` on the two new files | no finding |

Verification cell: "every count pin passes at the new number" - section 7, the runs above; "both operations have a stated simulator answer" - section 5, the description of each operation (a test matches the sentence), flow 19.

## 10. Requests and what was not served (`delegation_progress/file_requests.md`)

| Line | Content |
|---|---|
| to W1 | operations 109 and 110 join the web's Try-it deny list, under a reason of their own. SERVED by W1 in this wave (`STORED_RECORD`, denied 12 -> 14); my interim move of the allowed count (96 -> 98) was taken back to 96 by me when W1's entries were in the tree |
| to rows 117 / 118 | the contract as landed, ten points: the body, the Core's own facts, the mapping of 23505, the trimmed reason, one audit entry each, the deferrals to take out, a Core-side check of the key lists against `AUDIT_DETAIL_FORBIDDEN_KEYS`, and that there is NO read operation |
| to A2, A1, A4, the controller | what moved in the two acceptance files; the Set-size line; reds seen that are not mine |
| to the controller | three requests addressed to the shared writer that were NOT served: W1's four sentences of `common.captureSlotRefusal` (i18n; unruled product text), A4's text corrections of operation 108 and A2's of operation 103 (each restates a contract to as-built behaviour the controller has not adopted; together one description step and one regeneration) |

## 11. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | TWO operations, no read. A screen learns the state from the answers (`409 ..._IN_FORCE` / `..._NOT_IN_FORCE`) | the row and the brief name the acceptance and its revocation; a GET is a further contract step if row 118 needs the state on load |
| DD-2 | The diagnostics are NOT a request member: the Core copies its newest run; no run or an unfinished run is `409 INSTALLATION_DIAGNOSTICS_NOT_COMPLETE`; a failed check does not block | "the diagnostics run as it was at acceptance" (design 2.6); a client-sent run would be free JSON by another door. A failed check is recorded, as recording itself is not gated |
| DD-3 | A step is exactly `id` (a CODE), `passed`, `detail` (a one-line note or null); the step ids are NOT a closed value set | the fixture's three names; `code` is denied. The procedure of chapter 4 of the hardware acceptance names the steps, not the contract |
| DD-4 | U+2028 and U+2029 are refused as control characters although a database of ctype `C` takes them | a database whose ctype is a C-library locale refuses them; the contract is no looser on any host and stricter by two code points on this one. Measured (section 3) |
| DD-5 | The 16 names of `params` are the closed list, each value a scalar of any of the four kinds | S13-13 asks a closed list in code; a per-key type would refuse a Core that reports `null` for a reading. A new diagnostics value fails the shared test until it is listed |
| DD-6 | `completedAt` is required in the stored run (the Core's type allows null) | DD-2: only an ended run is recorded |
| DD-7 | The reason of a revocation is TRIMMED before it is counted and stored; a reason of blanks is refused | the house rule of a typed reason (`trimmedText`); the table would take five blanks |
| DD-8 | Tag Device, path `/api/v1/installation/...` | a System tag would enter the OFFLINE document's tag list, which is pinned byte-equal to its baseline; the commissioning operations it sits beside are Device |
| DD-9 | The simulator REFUSES both (409) instead of answering a synthetic record | the precedent of the stored commissioning writes (102, 106): a record that is not stored is not shown as accepted. The refusal of 109 is the in-app simulator's alone: a Core in capture mode `simulated` has the table and stores |

## 12. The double, and what stays unproven

The in-app simulator, pure schema and rule tests, the Core's schema files read as text, and one scratch measurement on a throw-away database. No device, no installation, no host. Unproven until row 117 and the hardware package: both routes, the one-in-force refusal through a route, the audit entries written, that a real diagnostics run of a production Core uses only the 16 names (its `detail` texts pass `installationAcceptanceTextOf`), that chapter 4 of the hardware acceptance yields at most 32 steps, and the ctype of the production database (DD-4).

Existing files were edited with the Edit tool only; `openapi.json` was written by the repository's generator, once. New files (Write): `SH/src/api/installation-acceptance.ts`, `SH/test/api-installation-acceptance.test.ts`, this record, `delegation_progress/row_116.md`, and the scratch test that was removed.

---
*Generated: 2026-10-13 14:05*
