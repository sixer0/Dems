---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: test-expert
blueprint_step: 69
plan_row: W47
tier: 2
type: acceptance-test-report
implements: SC4; AC-B-15, AC-B-16, AC-B-81; SR-73
status: complete
---

# Acceptance test: the role-by-endpoint matrix (step 69, W47)

## 1. Result

**PASS.** Every one of the 75 operations of the contract registry answers each kind of caller as
the specification says, through the real pipeline stages. No defect of the access decision was
found. Two wording differences between the specification and the server are reported (section 13),
neither changes who may call what.

**Follow-up at 19:35 to 19:53 (decision D118): the fourth access condition, `DEVICE_CREDENTIAL`.** The
numbers of sections 1 to 17 are those of the gate (18:53, decision D117) except where a line says
"follow-up"; section 8.1 and the asset `assets/02_rbac_matrix_cells.md` are the current state.
Everything about the adaptation, with the lines changed, is in the last section.

| What | Result | Evidence |
|---|---|---|
| The row command `DEMS_TEST_STEP=69 npm run test:db -w @dems/core-server -- test/acceptance/rbac-matrix.test.ts` | exit 0, 1 file, 34 tests | `assets/02_row_command.log`, section 11 |
| Cells of the matrix: 75 operations for 16 callers | 1,200, each equal to the specification | `assets/02_rbac_matrix_cells.md` |
| of which the five callers of AC-B-15 (three roles, unauthenticated, unpaired device) | 375 of 375 | the same, table 1 |
| of which the five callers of the brief (anonymous, a paired device, three roles) | 375 of 375 | the same, tables 1 and 2 |
| Denied operator cells, each with exactly one row | 112: 100 `ACCESS_DENIED`, 12 `EXPORT_DENIED` (operations 42, 61, 62) | printed line "denied operator cells" |
| A permitted call that wrote a denial row | 0 | asserted per cell |
| A 401 or a `DEVICE_NOT_PAIRED` or a `DEMO_DISABLED` cell that wrote a row | 0 | asserted per cell |
| The four credential-misuse cells of AC-B-81 | 401 `CREDENTIAL_CONFLICT`, 403, 401, 401; no principal resolved; nothing changed | section 8.3 |
| Cells answered 429 | 0 of 1,574 (the whole file) | the last test of the file |
| The registry against spec §7 | 75 of 75 rows equal (method, path, access rule, conditions, audit rule) | section 4 |
| Can it fail? | 4 changes of the clone or the caller inside the file; 19 of 19 changes of production code through a transform outside the tree | section 9 |
| Typecheck, lint | exit 0, exit 0 | `assets/02_typecheck.log`, `assets/02_lint.log` |
| Follow-up D118: the row command on the tree of 19:35 | exit 0, 1 file, **37 tests**, 1,649 cells, 0 answered 429; 29 of 29 changes of production code or of the registry detected; the second step (operation 8) simulated: green with no change of the test files | the last section |
| Whole `db` project | 18:49 to 18:51, final file: 113 of 114 files, 1,662 of 1,665 tests (1 skipped); the one red file is another row's, in flight (`test/acceptance/shared-state.test.ts`) | section 11.3 |

## 2. What was tested, and why it matters

**What.** `apps/core-server/test/acceptance/rbac-matrix.test.ts` (with `rbac-matrix.support.ts`
beside it) builds the real server (the app factory with all fourteen modules and every request
stage) on a clone of the bulk template as the runtime role, boots it as the entry point boots it,
and sends one request per cell with `app.inject`. A cell is one operation of the registry for one
caller.

**Why it matters.** Success criterion SC4 is that the server, not a client, decides who may do
what, and that a refusal is audited. The module rows each showed one allowed and one refused call
per operation (rule M11); the guard row showed that stage 6 stands in front of every route, with a
stand-in for stage 4 and for the database (`registered-routes.test.ts`). This file is the one place
where all 75 operations are called by every kind of caller with real sessions, real devices and
real rows. For 23 hosted actions the simulator checks nothing itself (finding F60): the access
rule is the only check there is.

**How it was verified.** By the runner output quoted in section 11, by the matrix the test writes
(the asset), and by showing that the test fails when the clone, the caller or the server's code
is changed (section 9).

## 3. The callers: how "5 caller kinds" was read

The row says "75 operations for 5 caller kinds". The specification and the brief name them
differently, so both readings are in the file, each as five full columns.

| Reading | The five | Source |
|---|---|---|
| The specification | the three roles, an unauthenticated caller, **an unpaired device** | AC-B-15, `masterplan/01_specs.md:1746` |
| The brief of this row | anonymous, **a paired DEVICE** (device credential, no operator), the three roles | the delegation text |

The file runs 16 columns. Every column is 75 cells.

| Group | Column | What the request carries | Counted under (ID-P12) |
|---|---|---|---|
| AC-B-15 | `ANONYMOUS` | A signed-out web console: no credential; the web console `Origin` on a POST, none on a GET (a same-origin read, OR-3) | `class:web` (POST), `class:local` (GET) |
| AC-B-15 | `UNPAIRED_DEVICE` | No credential and no `Origin`, as the mobile app sends before pairing (decision D69) | `class:local` |
| AC-B-15 | `INVESTIGATOR`, `SUPERVISOR`, `TECHNICIAN` | The session cookie of the seeded operator; the web console `Origin` on a POST, none on a GET | `operator:<id>` |
| Paired device | `DEVICE` | The device credential of a device that redeemed a code the server issued, as a bearer value | `device:<id>` |
| Paired device | `<ROLE>@DEVICE` (three) | The session token of the seeded operator signed in on that device, as a bearer value | `operator:<id>` (shared with the web session) |
| Retired device | `RETIRED_DEVICE` | The credential of a device the supervisor revoked | `class:local` |
| Retired device | `RETIRED_DEVICE_SESSION` | The session token of an operator who was signed in on that device when it was revoked (edge case E3) | `class:local` |
| Retired device | `UNPAIRED_CREDENTIAL` | The old credential of a device that unpaired itself (state UNPAIRED) | `class:local` |
| AC-B-81 | `COOKIE_AND_BEARER` | A valid web cookie AND a valid device session token, web console `Origin` | not counted (refused at stage 4) |
| AC-B-81 | `BEARER_WITH_WEB_ORIGIN` | A valid device session token with a web console `Origin` | not counted (refused at stage 3) |
| AC-B-81 | `DEVICE_TOKEN_AS_COOKIE` | A device session's token in the cookie, web console `Origin` | `class:web` |
| AC-B-81 | `WEB_TOKEN_AS_BEARER` | A web session's token as a bearer value, no `Origin` | `class:local` |

For every cell the test also asserts **who stage 4 resolved the caller to** (a hook of the test
reads `request.principal` when the answer is sent): `ANONYMOUS`, `ANONYMOUS, retired device <id>`,
`DEVICE <id>`, or `OPERATOR <id> <role> on <device or the web console>`. A column is therefore
known to be the caller it claims to be.

Sign-ins, all through operation 2: seven on the main server (the three operators on the web
console, the three on the paired device, one on the device that is then revoked) and three on the
second server. Devices: three, each by operations 15 and 18. One of them is revoked through
operation 20, one unpairs itself through operation 22.

## 4. How a cell gets its expectation, and the registry against spec §7

**Generated.** The test loops over `CORE_API_OPERATIONS` (75 entries). `expectationOf` in
`rbac-matrix.support.ts` derives the answer of a cell from the registry entry's access rule, its
conditions and its denial type, from what the specification says about the caller (§4.1, §4.2,
§6.6, §7.3, §12.1), and from the role matrix **stored in the test's own database**
(`role_permissions`, read as `dems_owner`). The file holds no list of operations and no expectation
per operation. It does not import the server's decision function, its rule book or their constants.

| Access rule (registry) | No principal | Retired device | Paired DEVICE | OPERATOR on the web | OPERATOR on a device |
|---|---|---|---|---|---|
| `PUBLIC` (4) | allowed | 403 `DEVICE_REVOKED` + 1 row, except on what §6.6 lets it call | allowed | allowed | allowed |
| `DEVICE` (5) | 401 | 403 + 1 row | allowed | 403 `DEVICE_NOT_PAIRED`, no row | allowed |
| `AUTHENTICATED` (25) | 401 | 403 + 1 row | 401 | allowed | allowed |
| one permission (40), any-of (1) | 401 | 403 + 1 row | 401 | the stored matrix gives the role one of the permissions: allowed. Else 403 + 1 row | the same |

Then the conditions of the registry entry: `CONSOLE_IDENTITY` (403 `DEVICE_NOT_PAIRED` unless a
web console or a caller that speaks for a paired device), `DEVICE_SESSION` (403
`DEVICE_NOT_PAIRED` unless the session is bound to a device), `DEVICE_CREDENTIAL` (follow-up,
decision D118: 403 `DEVICE_NOT_PAIRED` with `details.reason: DEVICE_CREDENTIAL_REQUIRED` unless
the caller is the DEVICE principal itself; no row), `DEMO_FLAG` (403 `DEMO_DISABLED`
while the flag is off, after the permission). A condition the registry carries and the test does
not know stops the cell with an error: it is never read as "allowed". Two callers are refused before the access rule on
every operation: two credentials (401 `NOT_SIGNED_IN`, `details.reason: CREDENTIAL_CONFLICT`) and
a bearer value with a web console origin (403 `ORIGIN_NOT_ALLOWED`).

**The independent check of the registry (all 75 rows, mechanically).** `readSpecification()`
reads `masterplan/01_specs.md` (revision 2.2, 2,238 lines) as text. A table that no longer has the
form it reads stops the test with a message naming it. Five tests compare:

| Compared | From the document | Result |
|---|---|---|
| Operation numbers 1 to 75, each operation ID once | the rows of §7.4 to §7.16 | equal |
| Method, path, access marker, conditions, success audit rule, denial type of every operation | columns 3 to 5 of each row; "plus ID-1" (signIn), "must be bound to a device" (operation 7), the sentence above the table of §7.16 (demo flag) | **75 of 75 equal** |
| Counts by access kind | the markers | 4 `PUBLIC`, 5 `DEVICE`, 25 `AUTHENTICATED`, 40 one permission, 1 any-of, in both |
| Where each permission is enforced | §4.3, column "Enforced at" | equal for all 12 |
| The three exports of RB-5 and the code `FORBIDDEN` | RB-5 (42, 61, 62); "403 `FORBIDDEN`" in a row | registry denial type `EXPORT_DENIED` on exactly 42, 61, 62; `FORBIDDEN` on `exportEvidence` alone; the registry's 403 texts and examples agree |

And the stored matrix: `role_permissions` of the clone equals the table of §4.4 and the shared
`ROLE_PERMISSIONS` (3 roles, 12 permissions, 18 grants: 4, 10, 4). The derived matrix gives the
INVESTIGATOR 22 denied cells and the TECHNICIAN 31, the numbers AC-B-16 states (and the
SUPERVISOR 3).

That this check has teeth: with the registry changed so that operations 11 to 14 name another
permission the same role holds, every cell of the matrix stays green (the server and the
expectation follow the same registry) and exactly the two comparison tests go red (mutation P19,
section 9.2).

Note for the contract close-out (known, contract C finding F-8, not new): the six operations whose
permission every seeded role holds have no `NOT_PERMITTED` example among their 403 examples. The
text of their 403 answer names the code.

## 5. What a cell asserts

| Cell | Asserted |
|---|---|
| Every cell | The answer is not 429. Exactly one answer was seen for the request. Stage 4 resolved the caller the column names. Follow-up: the call took exactly as many places in the denial budget of its key as it wrote rows of a counted type, by the server's own count before and after the call |
| Refused by the access rule, audited (a missing permission; a retired device) | Status and code (`NOT_PERMITTED`, `FORBIDDEN` on `exportEvidence`, `DEVICE_REVOKED`); `error.details` names `operationId`, `permission`, `role` (or `reason: DEVICE_REVOKED`); **exactly one** new audit row, of the registry's denial type, with the actor (the operator; null for a device), the device (the session's device; null on the web), `details.operationId`, `details.permission` (`A_OR_B` for the any-of, decision D83 DN-1), `details.role`; an `ACCESS_DENIED` row has category SECURITY (RB-4); one event for an `EXPORT_DENIED`, none otherwise; the row count of every other table unchanged; the request did not pass stage 6 |
| Refused without a row (401; `DEVICE_NOT_PAIRED`; `DEMO_DISABLED`; the two early refusals) | Status, code and reason; **no** audit row, no event; every row count unchanged; did not pass stage 6. Follow-up: the reason is exact in every refused cell: the one the specification names, or none (that is what tells the refusal of the condition `DEVICE_CREDENTIAL` from the marker's) |
| Permitted | The request passed stage 6; the answer is none of the caller-refusal codes; its status is one the registry documents for the operation (or 400 `INVALID_JSON` where the body was no JSON); no `ACCESS_DENIED` or `EXPORT_DENIED` row was written |

"The row count of every other table" is one statement over all 30 tables of schema `public`
before and after the call. Two tables are the refusal's own (`audit_log`, `events`: asserted
exactly). One is not held: `health_snapshots`, which the engine writes by time. In the recorded run
it gained a row in 4 permitted cells and in 0 refused ones, so leaving it out changed no verdict;
it is left out so that the cells do not depend on when the engine writes it.

## 6. Cells do not disturb each other (rule 3)

**How "refused by access" is told from "refused by the handler".** Three ways, all asserted:

1. **The hook.** A `preParsing` hook of the test runs after the one `onRequest` hook of the request
   stages and before the body is read. A request a stage refused never reaches it. This is the
   deciding fact: it does not depend on a status. It is what detects a stage 6 that lets a caller
   through while the handler still refuses with the same status and code (mutation P15).
2. **The code.** `NOT_SIGNED_IN`, `NOT_PERMITTED`, `FORBIDDEN`, `DEVICE_REVOKED`,
   `DEVICE_NOT_PAIRED`, `DEMO_DISABLED`, `ORIGIN_NOT_ALLOWED` are refusals of the caller.
   `INVALID_CREDENTIALS`, `INVALID_CODE`, `LOCKED`, `NOT_FOUND`, a 409 and a 422 are answers of a
   handler.
3. **The row.** An audited refusal wrote its one row; a handler's answer wrote none of that type.

**What a cell sends.** Always from the registry: the path, the example value of `{id}`, the first
request example. The mode of an operation's cells is decided from its registry entry alone:

| Mode | When | What a permitted caller gets | Operations |
|---|---|---|--:|
| READ | a GET | the read (it changes nothing, API-2) | 27 |
| EXAMPLE | a POST | the handler runs on the registry's example input | 40 |
| ABSENT | a POST whose success would take a caller away or change who it is, with a path parameter | the example `{id}` with its digits replaced by nines names nothing: the handler answers its documented 404 and changes nothing | 3 (12, 14, 20) |
| PROBE | the same, without a path parameter | a body that is no JSON: stage 7 answers 400 `INVALID_JSON`, no handler runs | 5 (5, 22, 23, 72, 75) |

"Would take a caller away, change who it is, or replace the dataset" is read from the success row
of the registry entry: `AUTH_SIGNED_OUT`, `UNPAIRED`, `DEVICE_CREDENTIAL_ROTATED`, `DEVICE_REVOKED`,
`USER_DISABLED`, `ROLE_CHANGED`, `SCENARIO_LOADED`. So `signOut` never ends a caller's session,
`unpairDevice` and `revokeDevice` never retire the paired device, `disableUser` and
`assignUserRole` never touch a caller (the registry's example names `OPR-003`, the TECHNICIAN of
the matrix), and **`loadScenario` and `resetDemo` never run**: the test asserts that no cell wrote
`SCENARIO_LOADED` and that the epoch and the number of discarded chains are what they were at the
start, on both servers.

A refused cell is sent the same request as a permitted one. A refusal comes before the body is
read (SR-44), so the body cannot matter: the same 401 or 403 answers a valid body and one that is
no JSON.

**Order.** One column after the other, each in registry order. What a permitted command changes
is seen by later cells only as another documented answer of a handler, never as another access
decision. Examples from the recorded run: the INVESTIGATOR's `createSession` answers 201 and the
later ones 200 (equal input); the open session makes the TECHNICIAN's `restartServices` and
`startSoftwareUpdate` answer 409 `SESSION_ACTIVE`; after the SUPERVISOR archived the example
evidence, the same export on the device answers 409 `NOT_SEALED`; the third wrong pairing code
locks redeem for 60 s (423 `LOCKED`); the fifth failed sign-in attempt on the device console locks
it (423). Each of these is a status the registry documents for its operation.

**What a permitted call was answered, per operation** (asset, table 7; all columns):

| Answer | Operations (spec numbers) |
|---|---|
| 200 (a read) | 1, 3, 4, 10, 11, 16, 19, 21, 27, 38, 39, 40, 44, 45, 46, 47, 53, 54, 56, 57, 58, 59, 60, 63, 64, 69, 71 |
| 200 | 6, 7, 9, 13, 32, 41, 55, 68 |
| 201, or 200 for equal input | 24 |
| 201 | 15 |
| 202 | 61, 62, 65; 42 (and 409 `NOT_SEALED` once archived) |
| 204 | 17, 37, 43, 48, 49, 50, 51, 52, 70, 73, 74 |
| 401 `INVALID_CREDENTIALS` (the example password is a placeholder), 423 `LOCKED` | 2, 8 |
| 401 `INVALID_CODE` (the example code is `000000`), 423 `LOCKED` | 18 |
| 404 `NOT_FOUND` (the example session ID is not the open session) | 25, 26, 28, 29, 30, 31, 33, 34, 35, 36 |
| 404 `NOT_FOUND` (mode ABSENT) | 12, 14, 20 |
| 409 `SESSION_ACTIVE` (a session is open) | 66, 67 |
| 400 `INVALID_JSON` (mode PROBE) | 5, 22, 23, 72, 75 |

## 7. The denial budget and the throttle (F25, GS-20)

Two limits would turn cells into 429: 20 audited refusals per key per 60 s (ID-P13) and 30
requests per 60 s for a caller without a principal (ID-P12). Both numbers are read from the
specification. The test counts, per throttle key, the requests at the strict limit and the rows of
the six counted types (`ACCESS_DENIED`, `EXPORT_DENIED`, `AUTH_FAILED`, `AUTH_LOCKED`,
`PAIRING_FAILED`, `PAIRING_LOCKED`) that each cell wrote. Before a request of a key that holds 20
refusals or 30 strict requests, it **advances the manual clock by 60 s**, which ends every open
window, and touches its six sessions so that none becomes idle.

| Fact (recorded run) | Value |
|---|---|
| Windows of 60 s used | 30 |
| Cells answered 429 | 0 of 1,574 |
| Log lines "rate limit reached" | 0 |
| The server's own count of each key's refusals (`throttleControl(app).inspect`) against the test's, at the end of every window | equal in every window, for every key |

The last line is more than the row asked for: it shows that every refusal row, the handlers' own
(`AUTH_FAILED`, `PAIRING_FAILED` and the two lock rows) included, took exactly one place in the
budget of the key that caused it.

## 8. The matrix

The full matrix, operation by caller, with status, code and the rows written, is the asset
`assets/02_rbac_matrix_cells.md` (7 tables, written by the test when `DEMS_W47_MATRIX_FILE` names
a file; nothing is written otherwise).

### 8.1 Per column (the follow-up run; the three `@DEVICE` lines changed with decision D118)

| Column | Let through by stage 6 | 401 | 403 | With a denial row | Not as specified |
|---|--:|--:|--:|--:|--:|
| `ANONYMOUS` | 4 | 71 | 0 | 0 | 0 |
| `UNPAIRED_DEVICE` | 3 | 71 | 1 (`signIn`: `DEVICE_NOT_PAIRED`) | 0 | 0 |
| `INVESTIGATOR` | 47 | 0 | 28 (22 by permission, 6 `DEVICE_NOT_PAIRED`) | 22 | 0 |
| `SUPERVISOR` | 66 | 0 | 9 (3 + 6) | 3 | 0 |
| `TECHNICIAN` | 38 | 0 | 37 (31 + 6) | 31 | 0 |
| `DEVICE` | 9 (4 `PUBLIC`, 5 `DEVICE`) | 66 | 0 | 0 | 0 |
| `INVESTIGATOR@DEVICE` | 52 (53 before D118) | 0 | 23 (22 by permission, 1 `DEVICE_NOT_PAIRED` for the device's own credential) | 22 | 0 |
| `SUPERVISOR@DEVICE` | 71 (72 before D118) | 0 | 4 (3 + 1) | 3 | 0 |
| `TECHNICIAN@DEVICE` | 43 (44 before D118) | 0 | 32 (31 + 1) | 31 | 0 |
| `RETIRED_DEVICE` | 2 (health, redeem) | 0 | 73 `DEVICE_REVOKED` | 73 | 0 |
| `RETIRED_DEVICE_SESSION` | 2 | 0 | 73 | 73 | 0 |
| `UNPAIRED_CREDENTIAL` | 2 | 0 | 73 | 73 | 0 |
| `COOKIE_AND_BEARER` | 0 | 75 (`CREDENTIAL_CONFLICT`) | 0 | 0 | 0 |
| `BEARER_WITH_WEB_ORIGIN` | 0 | 0 | 75 `ORIGIN_NOT_ALLOWED` | 0 | 0 |
| `DEVICE_TOKEN_AS_COOKIE` | 4 | 71 | 0 | 0 | 0 |
| `WEB_TOKEN_AS_BEARER` | 3 | 71 | 1 | 0 | 0 |

The 6 `DEVICE_NOT_PAIRED` cells of a web session are the five `DEVICE` operations (8, 9, 21, 22,
23) and `setBiometricEnrollment` (7); none carries a reason. The one `DEVICE_NOT_PAIRED` cell of
each `@DEVICE` column is `rotateDeviceCredential` (23), with `details.reason:
DEVICE_CREDENTIAL_REQUIRED`, no row and no place in the denial budget (decision D118). The table
is the state of the follow-up run; the counts are derived by the test, none is written in it.

### 8.2 The six operations with no denied operator cell on seeded data

Every seeded role holds `EVIDENCE_VIEW` and `DIAGNOSTICS_RUN`, so operations 39, 40, 41, 49, 50
and 65 have no denied operator cell (contract C, finding F-8). The test derives these two
permissions and six operations from the stored matrix and the registry, then, **in its own clone,
as `dems_owner`, after the boot**, removes both grants from one role at a time, reads the stored
matrix again and runs that role's cells on the web and on the device: 36 cells, each 403
`NOT_PERMITTED` with exactly one `ACCESS_DENIED` row naming actor, device, operation, permission
and role (asset, table 6). The grants are put back and the stored matrix is asserted equal to what
it was; the same callers then pass stage 6 again (18 cells). The guard decides from PostgreSQL per
request, so nothing is reloaded and no session signs in again.

### 8.3 The four credential-misuse cells of AC-B-81

On `getAuthSession`, the first operation of §7 that any signed-in operator may call:

| Caller | Answer | Principal resolved | Rows | Passed stage 6 |
|---|---|---|--:|---|
| The cookie and a bearer value together | 401 `NOT_SIGNED_IN`, `details.reason: CREDENTIAL_CONFLICT` | none (`ANONYMOUS`) | 0 | no |
| A bearer value with a web console origin | 403 `ORIGIN_NOT_ALLOWED` | none | 0 | no |
| A device session's token sent as the cookie | 401 `NOT_SIGNED_IN` | none | 0 | no |
| A web session's token sent as a bearer value | 401 `NOT_SIGNED_IN` | none | 0 | no |

All four credentials are valid on their own transport. The four callers are also run over all 75
operations (300 cells): the first two are refused on every operation, health included, as ID-12
and OR-4 say; the last two are anonymous callers, refused on all 71 operations that need a
principal. None passed stage 6 on such an operation and none wrote a row. Afterwards the two
sessions whose tokens were borrowed still answer 200, each on its own transport: nothing was
ended.

### 8.4 The demo flag

Flag ON (the main server): the holder of `DEMO_CONTROL` passes stage 6 on all five demo
operations, on the web and on the device; `loadScenario` and `resetDemo` were sent with a body that
is no JSON and answered 400. Flag OFF (a second server on a second clone, 20 cells; asset, table
5): the SUPERVISOR gets 403 `DEMO_DISABLED` with no row on all five; the INVESTIGATOR and the
TECHNICIAN get 403 `NOT_PERMITTED` with one `ACCESS_DENIED` row, whatever the flag (DC-1); nobody
gets 401. No request of that table passed stage 6 (also AC-B-56).

## 9. Can it fail?

### 9.1 Inside the file: the clone or the caller is changed, the expectation is not

Four tests of the file run whole columns against expectations that do not know about the change,
and assert WHICH cells go red. Commands are sent with a body that is no JSON in these runs, so
nothing is executed.

| Change | Red cells | How they are red |
|---|---|---|
| A grant added in the clone after the boot (the one that moves the most cells: TECHNICIAN gets `SESSION_START`) | exactly 10 of 75: the ten operations that permission opens | let through by stage 6, no row |
| A grant removed (INVESTIGATOR loses `SESSION_START`) | exactly the same 10 of 75 | 403 where the specification allows |
| The credential of a retired device in the column of the paired one | 75 of 75; the five `DEVICE` operations answer 403 `DEVICE_REVOKED` | status, row, resolved principal |
| The session of the TECHNICIAN in the column of the INVESTIGATOR | 75 of 75; on the 18 operations both roles are refused on, status, code and row count are as expected and the cell is red **only** because the row and the answer name the wrong actor and role | the naming assertions |

### 9.2 Outside the tree: 19 changes of production code, 19 detected

Rule M15: no file of the tree was changed. A scratch runner configuration outside the repository
adds one load-time transform of one source file to the package's own configuration
(`assets/02_mutation_harness.vitest.config.mjs.txt`, `assets/02_mutations.json`,
`assets/02_mutations.log`). Each original text is still in its file exactly once, and the newest
modification time of the mutated files is 17:29, before this row started (18:00).

| # | File | Change | Tests red |
|---|---|---|--:|
| baseline | none | the tree as it is, through the scratch configuration | 0 of 34 |
| P01 | `permission-guard/decision.ts` | `AUTHENTICATED` lets a paired DEVICE through | 3 |
| P02 | `permission-guard/decision.ts` | the permission is not checked | 14 |
| P03 | `permission-guard/decision.ts` | a retired device is not refused | 5 |
| P04 | `permission-guard/index.ts` | the denial row is not written | 17 |
| P05 | `permission-guard/index.ts` | a refusal takes no place in the denial budget | 1 (the budget comparison) |
| P06 | `authenticate/index.ts` | two credentials are not refused at stage 4 | 5 |
| P07 | `permission-guard/decision.ts` | the demo flag is not checked for an operator | 2 |
| P08 | `permission-guard/denial.ts` | the `ACCESS_DENIED` row names no actor | 12 |
| P09 | `permission-guard/denial.ts` | `exportAudit` writes `ACCESS_DENIED` instead of `EXPORT_DENIED` | 9 |
| P10 | `origin-guard/origin-decision.ts` | a bearer request with a web console origin passes | 4 |
| P11 | `identity/session-store.ts` | the cookie also resolves a device session (ID-13) | 4 |
| P12 | `permission-guard/decision.ts` | a `DEVICE` operation is open to a web session | 7 |
| P13 | `throttle/limits.ts` | the denial budget is 19 | 13 (cells answered 429) |
| P14 | `permission-guard/decision.ts` | the condition `DEVICE_SESSION` is not held | 7 |
| P15 | `permission-guard/decision.ts` | the condition `CONSOLE_IDENTITY` is not held at stage 6; the sign-in route still refuses with the same status and code | 5 (by the hook: "stage 6 let the request through") |
| P16 | `permission-guard/denial.ts` | the row and the answer name another permission | 12 |
| P17 | `permission-guard/access-rules.ts` | a retired device may also call `getSignInStatus` | 4 |
| P18 | `throttle/limits.ts` | the strict limit is 29 | 7 (cells answered 429) |
| P19 | `packages/shared/src/api/administration.ts` | the REGISTRY names another permission on operations 11 to 14 | 2 (the two comparisons with spec §7 and §4.3; the matrix stays green, as it must) |

## 10. Performance

One server for the matrix, one for the flag-off table; one sign-in per caller and transport; two
reads of the database per cell (the new audit rows; one statement with the 30 row counts).

| Measure (recorded runs, 18:33 to 18:45, other rows' runs on the host) | Value |
|---|---|
| The whole command, templates included | 7.4 s, 7.7 s (default reporter); 8.8 s, 9.3 s (verbose reporter, with the matrix written). Of that about 1.8 s builds the three templates of the run and about 6 s is the tests |
| One column of 75 cells | 0.09 to 0.33 s |
| Requests in the file | 1,574 cells, plus the preparation and the session touches |
| Caps in the file | 120 s per test, 180 s per hook (`vi.setConfig`); nothing waits for real time |

## 11. Verification

### 11.1 The row command

```
$ DEMS_TEST_STEP=69 npm run test:db -w @dems/core-server -- test/acceptance/rbac-matrix.test.ts
> @dems/core-server@0.2.0 test:db
> vitest run --project db test/acceptance/rbac-matrix.test.ts


 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server

[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_69_tmdsm2ld_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_69_tmdsm2ld_tpl_schema: built in 114 ms (create 39 ms, hook 73 ms)
[test:db] template dems_test_step_69_tmdsm2ld_tpl_seed: built in 197 ms (create 66 ms, hook 130 ms)
[test:db] bulk fixture: dems_test_step_69_tmdsm2ld_tpl_bulk as dems_owner; clock 2026-10-01T03:00:00.000Z; seed 20261004
[test:db] bulk fixture: every minimum of the 30 tables is met; audit head seq 5000, hash 26e251887c667e1e...; digest e58f1ae233811851...; build 190 ms, write 1201 ms, total 1393 ms

 Test Files  1 passed (1)
      Tests  34 passed (34)
   Start at  18:44:26
   Duration  7.71s (tests 80%, transform 12%, import 7%)

[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 3 database(s) in 115 ms; 0 remain with the run prefix dems_test_step_69_tmdsm2ld_
exit 0 at 18:44:34
```

`assets/02_row_command.log`. With the verbose reporter (`assets/02_row_command_verbose.log`) the
34 tests are listed by name and the test prints, among others:

```
[w47] spec §7 (revision 2.2, 2238 lines) against the registry: 75 of 75 rows equal in method, path, access rule, conditions and audit rule; exports 42, 61, 62
[w47] denied cells per role on the stored matrix: {"INVESTIGATOR":22,"SUPERVISOR":3,"TECHNICIAN":31}; permissions every role holds: EVIDENCE_VIEW, DIAGNOSTICS_RUN (operations 39, 40, 41, 49, 50, 65)
[w47] denied operator cells: 112, each with one row (12 EXPORT_DENIED)
[w47] AC-B-81 on getAuthSession: COOKIE_AND_BEARER 401 NOT_SIGNED_IN (CREDENTIAL_CONFLICT) | BEARER_WITH_WEB_ORIGIN 403 ORIGIN_NOT_ALLOWED | DEVICE_TOKEN_AS_COOKIE 401 NOT_SIGNED_IN | WEB_TOKEN_AS_BEARER 401 NOT_SIGNED_IN
[w47] grant removed (EVIDENCE_VIEW, DIAGNOSTICS_RUN): 36 cells: 0 let through by stage 6, 0 × 401, 36 × 403; 36 with a denial row; 0 × 429; 0 not as specified
[w47] demo flag off: 20 cells: 0 let through by stage 6, 5 × 401, 15 × 403; 10 with a denial row; 0 × 429; 0 not as specified
[w47] can it fail, a grant added (TECHNICIAN: SESSION_START): 10 of 75 cells red (createSession, startSession, stopSession, beginPrecheck, retryPrecheck, acknowledgePrecheckWarnings, cancelSession, scanCaseNumber, recoverSession, acknowledgeSessionSummary)
[w47] can it fail, a grant removed (INVESTIGATOR: SESSION_START): 10 of 75 cells red (createSession, startSession, stopSession, beginPrecheck, retryPrecheck, acknowledgePrecheckWarnings, cancelSession, scanCaseNumber, recoverSession, acknowledgeSessionSummary)
[w47] can it fail, a retired device in the PAIRED column: 75 of 75 cells red
[w47] can it fail, the session of the TECHNICIAN in the column of the INVESTIGATOR: 75 of 75 cells red; 18 of them only by the actor and the role their row and their answer name
[w47] 1574 cells (MATRIX 1200, GRANT_REMOVED 36, GRANT_RESTORED 18, FLAG_OFF 20, CAN_IT_FAIL 300); 429: 0; windows of 60 s used: 30; limits: 20 refusals and 30 requests per key and window
[w47] row counts from the first cell to the last: audit_log 5017 to 5612, events 3662 to 3728, health_snapshots 1508 to 1512; health_snapshots gained a row in 4 permitted and 0 refused cells
```

### 11.2 Typecheck and lint

`npm run typecheck -w @dems/core-server`: exit 0 at 18:49:15. `npm run lint -w @dems/core-server`
(oxlint): exit 0 at 18:49:15, no warning (`assets/02_typecheck.log`, `assets/02_lint.log`). Both
were also exit 0 at 18:33:17. In between, at 18:44:14, the typecheck was exit 2 with two errors in
another row's file and none in this row's (section 15).

The static guards of the `unit` project read the test tree too (credentials, imports, logging).
With the two new files in place, `npm run test -w @dems/core-server -- test/static --maxWorkers=2`:
9 files, 112 tests passed, exit 0 at 18:53:03 (`assets/02_static_guards.log`). The whole `unit`
project was not run: this row adds nothing to it.

### 11.3 The whole `db` project

`DEMS_TEST_STEP=69 npm run test:db -w @dems/core-server -- --maxWorkers=2`, twice: after the
coherent change (all 16 columns) and at the end, on the final file. Not in a loop (rule M15).

| Run | Files | Tests | Red, and whose |
|---|---|---|---|
| 18:38:38 to 18:41:36 (`assets/02_whole_db_1838.log`) | 111 passed, 1 failed (112) | 1,645 passed, 1 failed, 1 skipped (1,647) | `test/db/catalog.db.test.ts` > "a clone of tpl_schema: 30 tables, 69 indexes, 5 functions": `Test timed out in 5000ms`. The schema row's file (W17), not touched by this row. The 1-minute load average was 12.67 at the end of the run (guard of P9: 10). **Alone at 18:43:58: 10 of 10 passed** (`assets/02_catalog_alone.log`). Load noise (P11, M15) |
| 18:49:22 to 18:51:38 (`assets/02_whole_db_1849.log`), the final file | 113 passed, 1 failed (114) | 1,662 passed, 2 failed, 1 skipped (1,665) | `test/acceptance/shared-state.test.ts`, 2 tests (`AssertionError: expected [ 'hello', 'heartbeat', …(3) ] to deeply equal [ 'hello', 'heartbeat', …(4) ]`). The two-client row's file (W49), being written while the run went: it and its support file changed at 18:46, 18:47 and 18:51. In-flight work of another row (P11) |

`rbac-matrix.test.ts` is not among the failed files of either run (the default reporter lists only those). The run of 18:38 used the file
before its last change (18:44: the reason of a cell is printed and asserted by name), the run of
18:49 the final file. The skipped test is the demo row's pending one (decision D106).

```
 Test Files  1 failed | 113 passed (114)
      Tests  2 failed | 1662 passed | 1 skipped (1665)
   Start at  18:49:22
   Duration  136.24s (tests 79%, import 19%, transform 2%)
[test:db] teardown: dropped 8 database(s) in 340 ms; 0 remain with the run prefix dems_test_step_69_tmdsua94_
```

### 11.4 End state

`assets/02_end_state.txt`, taken at 18:51:53 as `dems_owner` on the maintenance database
`postgres` (SELECT on the catalog only; `dems_demo` and the lanes were never connected to):

```
session: role=dems_owner database=postgres server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_69_*): 0
test databases of all rows at this moment: 0
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
.locks/postgres.pid: 19121
```

No process of this row is left: it started no listener, no server and no device command. No file
of the tree was changed except the two new files of the row. Every database command ran with the
per-command sandbox bypass (P10); the first attempt inside the sandbox was refused by the helper
with `POSTGRES_UNREACHABLE` (EPERM), as designed.

## 12. Requirement to test

| Requirement | What it asks | Test (all in `test/acceptance/rbac-matrix.test.ts`) |
|---|---|---|
| SC4 | The server enforces the role matrix on every operation and audits a refusal | The 16 column tests (1,200 cells); "375 cells for the five callers ..."; the five registry tests; the two stored-matrix tests |
| AC-B-15 | All 75 operations for five callers; every cell equals §4.4 and §7; the misuse callers are further cells of the same file | "the matrix, 75 operations: AC-B-15 ..." (5 columns, 375 cells); "... a paired device ..." (4 columns); "375 cells for the five callers of AC-B-15, and 375 for anonymous, a paired device and the three roles" |
| AC-B-16 | Every denied operator cell wrote exactly one row (`EXPORT_DENIED` on 42, 61, 62) naming actor, operation and permission; an allowed call wrote none; INVESTIGATOR 22, TECHNICIAN 31; the clock is advanced after at most 20 denied cells of one key; no 429 | Each cell (section 5); "AC-B-16: every denied cell of an operator ..."; "the derived matrix gives the INVESTIGATOR 22 denied cells and the TECHNICIAN 31 ..."; "no cell of this file was answered 429 ..." |
| AC-B-81 | Cookie and bearer: 401 with `CREDENTIAL_CONFLICT`; bearer with a web console origin: 403; each token on the other transport: 401; none resolves a principal or changes state | "AC-B-81, SR-73: the four credential-misuse cells ..."; the four misuse columns (300 cells) |
| SR-73 | One credential per request; a session is bound to its transport | The same; mutations P06, P10, P11 |
| SR-44 (supporting) | The rule is evaluated before the body is read | A refused cell is sent the same body as a permitted one, and one that is no JSON in the "can it fail" runs: the answer is the refusal |
| SR-45, RB-4, RB-5, RB-6 (supporting) | One denial row per refused call; none for an allowed call or a 401; a retired device's row names the device | Each cell; the three retired-device columns (219 audited refusals) |
| DC-1, DC-2, AC-B-56 (supporting) | The permission before the demo flag; `DEMO_DISABLED` without a row | "the demo operations with the demo flag OFF ..." |
| ID-P12, ID-P13, F25, GS-20 (supporting) | The limits, and that the matrix stays inside them | Section 7 |
| Decision D118 (CPS1-3), spec §4.2, §6.3 T7, §7.2, §7.7 row 23 (follow-up) | An operation that needs the device's own credential refuses a session of the device with 403 `DEVICE_NOT_PAIRED`, `details.reason: DEVICE_CREDENTIAL_REQUIRED`, no row, no place in the budget | The three `@DEVICE` columns; "decision D118, the condition DEVICE_CREDENTIAL: ..."; "the condition DEVICE_CREDENTIAL (decision D118): the reason of its refusal is the same in the document (§7.2) and in the registry ..."; the control "the session of an operator on the device presented where the cell expects the device itself ..." |
| Contract C F-8 | The six operations without a denied cell | "a role that loses the permission is refused ..." (36 cells) |

## 13. Findings, deviations, decisions

### 13.1 Findings

No finding is a defect of the access decision.

| ID | Severity | What | Reproduction | Proposed handling |
|---|---|---|---|---|
| F-W47-1 | Low (specification wording) | ID-1 (b) says `signIn` is accepted from "a paired device: the request carries a valid device credential" and that "any other caller gets 403 `DEVICE_NOT_PAIRED`" (`01_specs.md:546`). The server also accepts the sign-in of a caller that presents a **session token bound to a paired device** (`src/modules/identity/console.ts:35-49`: "its device credential, or a session that is bound to it"; the guard's log §3 says "nor a paired device"). ID-6 (rotation, `01_specs.md:551`) needs a session to be presentable with a sign-in. The matrix follows the server's recorded reading | `POST /api/v1/auth/sign-in` with `Authorization: Bearer <the ses_ token of a device session>` and the registry's example body: 401 `INVALID_CREDENTIALS` and one `AUTH_FAILED` row (the handler ran), not 403. Asset, table 2, row 2, the three `@DEVICE` columns | Decision for the controller: add "or a session bound to a paired device" to ID-1 (b) at the next revision of the specification. No code change. Not a security concern: the session is bound to a PAIRED device and a password is still needed |
| F-W47-2 | Info (specification wording) | The first line of the table of §6.6 (`01_specs.md:694`) treats "no credential" and "state UNPAIRED" alike: "401 elsewhere". A device in state UNPAIRED that still presents its old credential is answered 403 `DEVICE_REVOKED` with one `ACCESS_DENIED` row per call, as §4.1, §7.2 ("REVOKED or UNPAIRED") and RB-6 say. Both are in the matrix: `UNPAIRED_DEVICE` (no credential: 401) and `UNPAIRED_CREDENTIAL` (the old credential: 403 and a row) | Pair a device, call `unpairDevice` with its credential (204), call `getAuthSession` with the same credential: 403 `DEVICE_REVOKED`, one row with `device_id` and `details.reason: DEVICE_REVOKED`. Asset, table 3 | None needed. The mobile app deletes the credential when it unpairs, so the 401 line is the real one. The pairing-lifecycle row (W48) should expect the same |
| F-W47-3 | Info (limit of this test) | The limiter library counts in its own windows of 60 s of real time. The test's comparison of its refusal count with the server's (section 7) assumes that one window of the manual clock lasts less than 60 s of real time. In the recorded runs a window lasted well under a second | Not reproduced. It would show as "the server counts 0 refusals of <key>, the test counted n" in the last test, on a host where one column takes more than a minute | Named so that such a red is read as load, re-run alone, before it is judged |

Known and not new, met again here: a POST without a request body answers 400 `INVALID_JSON` to a
body that is no JSON, which the registry does not document for those operations
(CONTRACT-GAP-W36-1, CONTRACT-GAP-W40-1). The PROBE mode of this file relies on that answer for
five operations (5, 22, 23, 72, 75). If the contract close-out changes it, those cells need another
way of not running the handler.

### 13.2 Deviations from the row text

| # | Deviation | Why |
|---|---|---|
| DV-1 | 16 columns (1,200 cells) instead of 5 (375). Both readings of "5 caller kinds" are among them, each asserted as 375 cells | AC-B-15 names an unpaired device, the brief a paired one. The generator makes a further column cost one line; the retired device and the bearer path are lines of the same decision table (§4.1, §6.6) |
| DV-2 | The misuse callers of AC-B-81 run over all 75 operations (300 cells), not over one | "The credential-misuse callers ... are further cells of the same file" (AC-B-15); ID-12 says "on every operation" |
| DV-3 | A second file, `rbac-matrix.support.ts`, beside the test | Allowed by the brief. It holds the reader of the specification and the derivation of the expectation, and imports no Vitest, no app and no server code |
| DV-4 | Production code was mutated, through a transform outside the tree (section 9.2), in addition to the changes of the clone and of the caller that the brief asks for | Rule M15 allows it; it is the only way to show that the row and budget assertions can fail. No file of the tree changed |
| DV-5 | `masterplan/02_plan.md`, `test/01_test_report.md` and `implementation/99_implementation_report.md` were not written | Parallel run (P8, CLAUDE.md §3.4): shared files are the controller's |

### 13.3 Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| DN-1 | Which reading of "5 caller kinds" the gate W58 counts | Either: both are 375 of 375 |
| DN-2 | F-W47-1: the wording of ID-1 (b) | Add the session bound to a paired device to the specification; no code change |
| DN-3 | Whether the comparison of the registry with spec §7 by reading the document stays in the test | Keep. It costs nothing at run time and is the only check that fails when the registry itself drifts (P19). A new revision of the specification that changes the form of a table stops the test with a message that names the table |

## 14. What this test does NOT cover

| Not covered | Where it is |
|---|---|
| Whether a 2xx body or an error body validates against the contract schema | The contract-conformance row (W52, `test/acceptance/contract.test.ts`) |
| The success path of the eight commands sent as ABSENT or PROBE (5, 12, 14, 20, 22, 23, 72, 75), and of the ten session commands whose example ID is not the open session (404 here) | The module rows (identity, admin, pairing, demo, sessions) |
| `GET /ws`: the one route outside the registry | The realtime row (W42) and the two-client row (W49) |
| A role change through operation 12 and its effect on the next request and on the sockets (AC-B-18 to AC-B-22) | The administration row (W33) and the end-to-end row W96. Here only a changed GRANT is shown to decide the next request |
| A disabled operator, an expired or ended session, the lockouts as such | The identity and administration rows |
| The other cells of the HTTP decision table of §14.2 (a foreign origin, `null`, the instance's own origin, a cookie GET with an `Origin`) | The guard row's `pipeline.db.test.ts` (40 cells) |
| The 429 itself (AC-B-75) | The guard row's `denial.db.test.ts`. Here: that it does not occur, and that it is detected when a limit is lowered (P13, P18) |
| Concurrency; a real listener; a browser; a device; a lane instance | The gate W58 and the end-to-end rows |
| The seed template | Not needed: the bulk fixture was available (DF-1 not taken) |
| A device whose credential was rotated; a session of an UNPAIRED device | The pairing-lifecycle row (W48) |

## 15. Test ledger (P24) and parallel-run noise

| Project | Added by this row |
|---|---|
| `db` | 1 file, 34 tests: `test/acceptance/rbac-matrix.test.ts` |
| `unit` | none |

Whole `db` project: 108 files and 1,541 tests at the baseline the brief gives (17:48 to 17:54),
114 files and 1,665 tests at 18:51. This row added one file and 34 tests; the other five files are
other rows' (`contract.test.ts`, `pairing-lifecycle.test.ts`, `shared-state.test.ts` under
`test/acceptance/` among them).

Noise of the parallel run (P11), each with its time:

| Time | What | Whose | Second run |
|---|---|---|---|
| 18:41 | `test/db/catalog.db.test.ts`, one test past its 5 s limit, load average 12.67 | the schema row (W17) | alone at 18:43:58: 10 of 10 |
| 18:44:14 | `npm run typecheck`: exit 2, two errors, both in `test/acceptance/shared-state.support.ts` (lines 409 and 887) | the two-client row (W49), in flight | 18:49:15: exit 0 (`assets/02_typecheck_1844_noise.log`, `assets/02_typecheck.log`) |
| 18:51 | `test/acceptance/shared-state.test.ts`, 2 tests red in the whole run | the two-client row (W49), in flight | not re-run: the file was still being written |

For the controller: the 1-minute load average was above the guard of P9 (10) at 18:41 (12.67)
while this row's first whole run and other rows' runs overlapped.

## 16. Rollback (R-NEW; not executed)

Delete `apps/core-server/test/acceptance/rbac-matrix.test.ts` and
`apps/core-server/test/acceptance/rbac-matrix.support.ts`. Nothing else in the tree was written.

## 17. Assets (`test/assets/`)

| File | What |
|---|---|
| `02_rbac_matrix_cells.md` | The matrix as the test wrote it: 7 tables, operation by caller, status, code, rows written |
| `02_row_command.log` | The row command, default reporter |
| `02_row_command_verbose.log` | The same with the verbose reporter: every test by name, every printed line |
| `02_typecheck.log`, `02_lint.log` | Typecheck and lint |
| `02_static_guards.log` | The static guard tests of the `unit` project with the two new files in the tree |
| `02_mutation_harness.vitest.config.mjs.txt`, `02_mutation_harness.run.sh.txt`, `02_mutations.json`, `02_mutations.log` | The scratch runner configuration, its script, the 19 changes and their result |
| `02_whole_db_1838.log`, `02_whole_db_1849.log` | The whole `db` project, twice |
| `02_catalog_alone.log` | The one file of another row that timed out under load, alone |
| `02_typecheck_1844_noise.log` | The typecheck at 18:44 with another row's two errors |
| `02b_*` | The follow-up of decision D118: see the last section |
| `02_end_state.txt`, `02_end_state.mts.txt` | Databases, processes and files at the end, and the scratch script that read them |

## Follow-up: the condition `DEVICE_CREDENTIAL` (decision D118)

### F.1 What changed in the tree (19:34, not by this row), and what the specification says

| Where | What |
|---|---|
| Registry, `packages/shared/src/api/contract-model.ts:94-114` | A fourth access condition, `CoreApiAccessCondition.DEVICE_CREDENTIAL`, and `DEVICE_CREDENTIAL_REQUIRED_REASON = 'DEVICE_CREDENTIAL_REQUIRED'` |
| Registry, `packages/shared/src/api/pairing.ts:469` | Operation 23 `rotateDeviceCredential`: `access: { ...DEVICE_ACCESS, conditions: [CoreApiAccessCondition.DEVICE_CREDENTIAL] }` |
| Specification, `masterplan/01_specs.md:64` (revision line), `:405` (marker `DEVICE`), `:654` (T7), `:660`, `:756` (the code table), `:860` (row 23) | Row 23's access cell reads `` `DEVICE`; needs the device's own credential ``. Only the device itself, with its credential as the bearer value, may rotate. The session token of an operator who is signed in on the device is refused at stage 6 with 403 `DEVICE_NOT_PAIRED` and `details.reason: DEVICE_CREDENTIAL_REQUIRED`, "without an audit row and without a place in the denial budget" |

The expectation of this test was written from those lines of the document and from the registry
entry. The guard's code was read only to write the mutations of section F.5.

### F.2 Before: the unchanged test on the changed tree

`assets/02b_before_adaptation.log`, 19:38:35 to 19:38:48, the two files as they were at 18:44:
**5 of 34 tests red**, exactly where the change is.

| Red | Why |
|---|---|
| "every registry entry has the method, the path, the access rule, the conditions and the audit rule of its row" | row 23: the registry carries `DEVICE_CREDENTIAL`, the reader of the document gave no condition (it did not know the fourth text) |
| The three `@DEVICE` columns | `23 rotateDeviceCredential as <ROLE>@DEVICE (expected allowed): refused before the body was read: 403 DEVICE_NOT_PAIRED` |
| The last test (the whole file equals the specification) | the same three cells |

### F.3 The lines changed, before and after

`apps/core-server/test/acceptance/rbac-matrix.support.ts` (494 to 530 lines):

| Lines now | Before | After |
|---|---|---|
| `:178-194`, the reader `conditionsOf` | Three texts: `plus ID-1`, `must be bound to a device`, the sentence above the table of §7.16 | A fourth, keyed on the words of the row, whichever operation it is: `if (/needs the device's own credential/.test(accessCell)) conditions.push(CoreApiAccessCondition.DEVICE_CREDENTIAL);` |
| `:96-101`, `:244-247`, `:263`, `Specification.deviceCredentialReason` | not read | The reason is read from the document, from the line of `DEVICE_NOT_PAIRED` in §7.2: `` /\| 403 \| `DEVICE_NOT_PAIRED` \|[^\n]*needs the device's own credential[^\n]*\(`details\.reason: (\w+)`\)/ `` |
| `:363-364`, `ExpectationInput.deviceCredentialReason` | absent | The reason the expectation puts into the refusal |
| `:424-454`, the conditions of `expectationOf` | Three `if`s; a condition the file did not know was passed over, so its caller was "allowed" | A `switch` over the registry's conditions with four cases and a `default` that throws ("... carries the condition X, for which this test has no expectation"). The new case: `if (identity.kind !== 'DEVICE') return refused(403, 'DEVICE_NOT_PAIRED', { reason: input.deviceCredentialReason });` with no row. It names no operation |

`apps/core-server/test/acceptance/rbac-matrix.test.ts` (1,345 to 1,462 lines):

| Lines now | Before | After |
|---|---|---|
| `:138-153`, `expectationFor` | Four call sites each spelled `expectationOf({ ..., retiredDeviceMayCall, denialCode })` | One helper fills what the expectation takes from the document, the reason included |
| `:155-161`, `needDeviceCredential()` | absent | The operations whose row of §7 says "needs the device's own credential": from the DOCUMENT, not from the registry |
| `:753-755`, `:784-785`, `:801-802`, the place in the denial budget | Compared once per window of 60 s (`nextWindow`) | Also in EVERY cell: `throttleControl(app).inspect(key).used` before and after the call; `if (places !== counted) say(...)`, where `counted` is the number of rows of a counted type the call wrote. A refusal without a row must take no place |
| `:817-820`, the reason of a refusal | Asserted where the expectation named one; an answer could carry a reason where none was expected | Exact in every refused cell: `const wantedReason = expectation.details['reason'] ?? null; if (reason !== wantedReason) say(...)`. This is what tells the condition's refusal (a session on the device) from the marker's (a web session) |
| `:975-986`, new test in the comparison block | absent | "the condition DEVICE_CREDENTIAL (decision D118): the reason of its refusal is the same in the document (§7.2) and in the registry, and it stands only on the marker DEVICE" |
| `:1110-1138`, new test in "the matrix as a whole" | absent | "decision D118, the condition DEVICE_CREDENTIAL: on every operation that carries it the device itself passes; a session of an operator on the device is refused with 403 DEVICE_NOT_PAIRED and the reason, no row and no place in the denial budget; a web session is refused by the marker, without a reason" (also: a retired device 403 `DEVICE_REVOKED` with its row and its place; nobody 401) |
| `:1310-1330`, new control in "can the matrix fail?" | absent | "the session of an operator on the device presented where the cell expects the device itself: every cell is red, and an operation that needs the device's own credential answers 403 with the reason, no row and no place in the budget" |
| `:1102`, the misuse test | `expect(guarded).toHaveLength(4 * 71)` | `MISUSE_COLUMNS.length * spec.operations.filter((operation) => operation.access !== 'PUBLIC').length` |
| `:1381-1383`, `tableOf`, the printed matrix | The marker of a row | The marker and its conditions, for example `` `DEVICE` + `DEVICE_CREDENTIAL` `` |

**No count per condition is written in either file.** The cells of an operation follow its registry
entry and its row of §7; the per-column numbers of section 8.1 are printed by the test, not
asserted.

### F.4 After: the new cells

| Caller on an operation that needs the device's own credential (today: 23) | Answer | Rows | Places in the budget | Passed stage 6 |
|---|---|--:|--:|---|
| `DEVICE` (the device credential) | let through (here 400 `INVALID_JSON`: the cell is sent with a body that is no JSON, so nothing is rotated) | 0 | 0 | yes |
| `INVESTIGATOR@DEVICE`, `SUPERVISOR@DEVICE`, `TECHNICIAN@DEVICE` | 403 `DEVICE_NOT_PAIRED`, `details.reason: DEVICE_CREDENTIAL_REQUIRED` | 0 | 0 | no |
| `INVESTIGATOR`, `SUPERVISOR`, `TECHNICIAN` (web) | 403 `DEVICE_NOT_PAIRED`, no reason (the marker) | 0 | 0 | no |
| The three retired-device columns | 403 `DEVICE_REVOKED` (`reason: DEVICE_REVOKED`) | 1 `ACCESS_DENIED` | 1 | no |
| `ANONYMOUS`, `UNPAIRED_DEVICE` | 401 `NOT_SIGNED_IN` | 0 | 0 | no |

Per column (the matrix is still 16 columns of 75 cells, 1,200 cells; only three lines moved):

| Column | Let through, before to after | 403, before to after | With a denial row |
|---|---|---|---|
| `INVESTIGATOR@DEVICE` | 53 to 52 | 22 to 23 | 22, unchanged |
| `SUPERVISOR@DEVICE` | 72 to 71 | 3 to 4 | 3, unchanged |
| `TECHNICIAN@DEVICE` | 44 to 43 | 31 to 32 | 31, unchanged |
| The other 13 columns | unchanged | unchanged | unchanged |

The file now runs 37 tests (34 before) and 1,649 cells (1,574 before: one more control of 75
cells). The denied operator cells with a row are still 112. The budget comparison of F25 stayed
exact: per window as before, and now also per cell, in all 1,649 cells.

### F.5 Can it fail?

**In the file.** The new control presents a session of an operator on the device in the column of
the DEVICE: 75 of 75 cells red; on the operations that need the device's own credential the cell
expects "allowed" and gets 403 with the reason, no row and no place; the other `DEVICE`
operations pass stage 6 for the session and are red only by who stage 4 resolved.

**Outside the tree** (rule M15; `assets/02b_mutation_harness.vitest.config.mjs.txt`,
`assets/02b_mutations.json`, `assets/02b_mutations.log`, 19:45:42 to 19:50:54). The harness can now
change several files in one run and can hand the test a changed COPY of the specification (in the
scratch folder; the test's support file is transformed in memory to read the copy). Nothing in
the tree changed: every original text is still in its file exactly once (30 of 30), and the newest
change of the files named is 19:34, the landing of the condition itself.

| # | Change | Result |
|---|---|---|
| baseline | none | 37 of 37 green |
| P01 to P19 | the 19 changes of section 9.2, again | 19 of 19 detected (P05, a refusal that takes no place in the budget, now turns 16 tests red instead of 1: the place is asserted per cell) |
| Q01 | The guard does not evaluate the condition | 6 red: the three `@DEVICE` columns ("stage 6 let the request through"), the named test, the control, the last test |
| Q02 | The guard writes an `ACCESS_DENIED` row for the refusal (and takes a place) | 7 red |
| Q03 | The answer carries no reason | 6 red (`error.details.reason is null, not "DEVICE_CREDENTIAL_REQUIRED"`) |
| Q04 | **The registry loses the condition** on operation 23 (the document keeps it) | 4 red: both comparisons with the document, the named test of D118 and the control (both take the operations from the document). **All 16 columns of the matrix green**, as they must be: the server and the expectation follow the same registry |
| Q05 | A `DEVICE_NOT_PAIRED` refusal takes a place in the budget without a row | 17 red |
| Q06 | The condition refuses the device itself too | 4 red (the `DEVICE` column) |
| Q07 | A web session is answered with the reason of the condition (the condition before the marker) | 8 red (the three web columns: a reason where the specification names none) |
| Q08 | The answer carries another reason | 6 red |
| Q09 | A retired device is not decided before the condition | 6 red (the three retired-device columns) |
| **F01** | **The second step, simulated**: operation 8 `signInWithBiometric` gets the condition in the registry AND the words `needs the device's own credential` in its row of a copy of the document | **37 of 37 green, with no change of the test files.** Printed: `DEVICE_CREDENTIAL ... on: 8 signInWithBiometric, 23 rotateDeviceCredential`; the `@DEVICE` columns 51 / 70 / 42 let through and 24 / 5 / 33 refused |
| F02 | The second step half done: the registry only, the document unchanged | 3 red: both comparisons and the control. The columns green |

29 of 29 changes that must be detected are (P01 to P19, Q01 to Q09, F02); F01 is the one that
must be green, and is. After the last change of the test file
(19:51, the printed matrix only) the baseline, Q01 to Q04 and F01 were run once more with the same
results (`assets/02b_mutations_final_file.log`).

### F.6 Verification (the final files: test 19:51, support 19:39)

```
$ DEMS_TEST_STEP=69b npm run test:db -w @dems/core-server -- test/acceptance/rbac-matrix.test.ts --maxWorkers=2
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_69b_tmdvqzdh_
 Test Files  1 passed (1)
      Tests  37 passed (37)
   Start at  19:52:11
   Duration  8.49s (tests 84%, transform 11%, import 6%)
[test:db] teardown: dropped 3 database(s) in 102 ms; 0 remain with the run prefix dems_test_step_69b_tmdvqzdh_
exit 0 at 19:52:20
```

Printed by the verbose run (`assets/02b_row_command_verbose.log`, exit 0 at 19:52:29):

```
[w47] DEVICE_CREDENTIAL (reason DEVICE_CREDENTIAL_REQUIRED) on: 23 rotateDeviceCredential
[w47] INVESTIGATOR@DEVICE: 75 cells: 52 let through by stage 6, 0 × 401, 23 × 403; 22 with a denial row; 0 × 429; 0 not as specified
[w47] SUPERVISOR@DEVICE: 75 cells: 71 let through by stage 6, 0 × 401, 4 × 403; 3 with a denial row; 0 × 429; 0 not as specified
[w47] TECHNICIAN@DEVICE: 75 cells: 43 let through by stage 6, 0 × 401, 32 × 403; 31 with a denial row; 0 × 429; 0 not as specified
[w47] D118 on rotateDeviceCredential: DEVICE 400 INVALID_JSON (no JSON) | a session on the device 403 DEVICE_NOT_PAIRED (DEVICE_CREDENTIAL_REQUIRED), rows 0, places 0 | a web session 403 DEVICE_NOT_PAIRED | a retired device 403 DEVICE_REVOKED · ACCESS_DENIED
[w47] can it fail, a session on the device in the column of the DEVICE: 75 of 75 cells red; refused for the device's own credential: rotateDeviceCredential
[w47] 1649 cells (MATRIX 1200, GRANT_REMOVED 36, GRANT_RESTORED 18, FLAG_OFF 20, CAN_IT_FAIL 375); 429: 0; windows of 60 s used: 31; limits: 20 refusals and 30 requests per key and window
```

| Command | Result |
|---|---|
| The static guards that scan the test tree: `npm run test -w @dems/core-server -- test/static --maxWorkers=2` | 9 files, 112 tests passed, exit 0 at 19:52:30 (`assets/02b_static_guards.log`) |
| `npm run typecheck -w @dems/core-server` | exit 0 at 19:52:01 (`assets/02b_typecheck.log`) |
| `npm run lint -w @dems/core-server` | exit 0 at 19:52:01, no warning (`assets/02b_lint.log`) |
| End state, 19:53:27 (`assets/02b_end_state.txt`) | 0 test databases of any row in the instance; `.locks/postgres.pid` 19121 (the postmaster of 07:14); no process of this row left |

No whole-suite run was made, as the controller ruled. No red of another row was met in these
runs (this row ran only its own file and the static guards).

`assets/02_rbac_matrix_cells.md` was written again by the run of 19:52:20 and now prints the
conditions of a row beside its marker. Row 23 in table 2 reads:

```
| 23 | `rotateDeviceCredential` | `DEVICE` + `DEVICE_CREDENTIAL` | 400 INVALID_JSON (no JSON) | 403 DEVICE_NOT_PAIRED (DEVICE_CREDENTIAL_REQUIRED) | 403 DEVICE_NOT_PAIRED (DEVICE_CREDENTIAL_REQUIRED) | 403 DEVICE_NOT_PAIRED (DEVICE_CREDENTIAL_REQUIRED) |
```

### F.7 Findings of the follow-up

No defect of the server: every cell of the condition answers as §4.2, §6.3 and §7.2 say.

| ID | Severity | What | Reproduction | Handling |
|---|---|---|---|---|
| F-W47-4 | Info (for the second step, operation 8) | The test files need no change when operation 8 gets the condition, **if** the registry entry and the row of the document change in the same step and the row's access cell holds the words `needs the device's own credential` exactly (the reader's key). With the registry alone, the comparison with §7 is red until the document follows | F01 (green) and F02 (3 red) of section F.5 | Tell the identity follow-up: same step, same words. The line of `DEVICE_NOT_PAIRED` in §7.2 already holds the reason and needs no change |
| F-W47-5 | Info (a defect of this row's own first draft, found by the simulation and corrected before any recorded run) | The first draft of the named test of D118 pinned "0 places in the budget" for the device's own permitted call. For operation 8 the device's call with the registry's example token is a failed sign-in with its own `AUTH_FAILED` row and its own place, so the simulated second step was red in that one test (19:44:44). The assertion now says of the device only that stage 6 let it through and that no denial row was written | `assets/02b_mutations.log` holds the corrected state (F01 green); the first run is in section F.5 by its time only | None. Named because it is why the simulation was worth running |
| F-W47-6 | Info (stronger than before, no finding against the server) | The place in the denial budget is now asserted per cell: in all 1,649 cells the call took exactly as many places as it wrote rows of a counted type. The limit named as F-W47-3 (the limiter's own window of real time) applies to this assertion too | not reproduced | None |

### F.8 Assets of the follow-up (`test/assets/`)

| File | What |
|---|---|
| `02_rbac_matrix_cells.md` | The matrix, written again at 19:52 |
| `02b_before_adaptation.log` | The unchanged test on the changed tree: 5 of 34 red |
| `02b_row_command.log`, `02b_row_command_verbose.log` | The row command on the final files |
| `02b_static_guards.log`, `02b_typecheck.log`, `02b_lint.log` | The static guards, typecheck, lint |
| `02b_mutation_harness.vitest.config.mjs.txt`, `02b_mutation_harness.run.sh.txt`, `02b_mutations.json` | The scratch runner configuration of the follow-up, its script, the 30 changes |
| `02b_mutations.log`, `02b_mutations_final_file.log` | Their results: the baseline and the 30 changes at 19:45 to 19:50; six of the runs again after the last change of the test file |
| `02b_end_state.txt` | Databases, files and modification times at 19:53 |

---
*Generated: 2026-10-04*
*Last updated: 2026-10-04 19:54 (follow-up of decision D118)*
