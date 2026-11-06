---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 50
plan_row: W28
title: RBAC permission guard (HB-7), the stored matrix, operation 10 and the integration of pipeline stages 3 to 6
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§2.3, §4, §5.1 ID-P12 and ID-P13, §6.6, §7.2, §7.3, §7.6, §12.1, §13.1, §14.2); masterplan/03_database_contract.md rev 2.2 (§4.1 to §4.3)
evidence_tier: 3
status: complete
---

# W28: the permission guard, the stored matrix, operation 10 and stages 3 to 6 together

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
the session never changed into a subfolder. Database commands ran with the per-command sandbox
bypass (P10). Quoted runner output is unchanged except that the sandbox's certificate warning
lines are left out.

**No password, token, cookie value, hash or other credential appears in this document.** The demo
password is named by its constant only. A test takes a token from an answer and hands it on in a
header; none is printed, and no test name holds one.

**Follow-ups, written after the gate of this row:** "Follow-up: tests that pinned the route list
(decision D85)", which also holds decision D88, and after it "Follow-up: the condition
`DEVICE_CREDENTIAL` on operation 23 (CPS1-3, decisions D113, D118)", the last section. Sections 1 to 21
describe the state at 14:08; the test counts, the mutation result and the check of the stored
grants of the first follow-up replace what sections 5, 11, 12 and 13 say, and the second follow-up
replaces what sections 3 and 6 say about an operator's session of a device on operation 23 and
about the key `cause` of the stage's log line (now `refusedBy`).

## 1. Result

| Item | Result |
|---|---|
| Row tests, `unit` (7 files of the two folders) | **Exit 0**: 7 files, 142 tests, 0 failed (14:05:35) (section 11.1) |
| Row tests, `db` (3 files, `DEMS_TEST_STEP=50`) | **Exit 0**: 3 files, 111 tests, 0 failed; 0 databases remain with the run prefix (14:05:36) (section 11.1) |
| A route without an access rule or an audit rule | The app fails to boot: `app.ready()` rejects with an `AccessRuleError` that names the route and the operation (codes of section 4). Tested with a route no registry entry covers, with a route that borrows the name of a PUBLIC operation, and with real module routes whose registry entry lost its access rule or its audit rule |
| A denied call | 403 `NOT_PERMITTED`, exactly ONE `ACCESS_DENIED` row naming actor, operation, permission and role, committed before the answer; decided before the body is read: an oversized, a malformed and a schema-breaking body all answer 403 (401 without a session), where the holder of the permission gets 413, 400 and 422 |
| An allowed call | No row, no place in the denial budget, the handler is reached |
| The HTTP decision table of spec §14.2 | 40 cells (4 credential rows, 5 origin values, GET and POST), each with a test ID, through the REAL stages 3 to 6: all give the stated answer. Among them `signIn` with the instance's own origin and no bearer: 403 `DEVICE_NOT_PAIRED`; a POST with the cookie and the own origin: 403 `ORIGIN_NOT_ALLOWED` |
| 100 denied calls of one operator within 10 s | Exactly 20 rows, the other 80 answer 429; one millisecond before the 60 s window ends still 429, at its end 403 and a 21st row. 100 at once: 20 rows, 80 × 429 |
| 31 requests with 31 different unknown bearer values | One bucket: 30 × 401, the 31st 429; no row, no place in the denial budget |
| The role matrix | Read from PostgreSQL, never written into the guard: a role change and a changed grant decide the NEXT request of the same session, both ways, with no sign-in and no reload |
| Operation 10 `getRoleMatrix` | 200 for each role, on the web and on a device; valid against the contract; 3 roles, 12 permissions, 18 grants, `editable: false`; 401 without a session; route list equals the registry (section 11.3) |
| Whole `unit` project | **Exit 0**: 77 files, 1,992 tests, 0 failed (14:05:51) |
| Whole `db` project (`DEMS_TEST_STEP=50`) | **Exit 0**: 48 files, 740 tests, 0 failed; forced drops that needed a retry: 0; 0 databases remain with the run prefix (14:06:12) |
| Typecheck, lint of the workspace | Exit 0; exit 0 with no warning (14:05:48 and 14:05:51) |
| Mutation check | 73 of 73 planted defects detected (section 12) |
| Other rows' tests | 12 test files failed by design once stage 6 was real; ONE patch of 20 inserted lines in ten files, applied under ruling D82 (section 14) |
| PostgreSQL | Never stopped or reconfigured: `.locks/postgres.pid` is 19121. No database with this row's prefix remains (section 20) |

## 2. What was written

Production code (7 files, 1,421 lines):

| File | Lines | What it is |
|---|--:|---|
| `apps/core-server/src/plugins/permission-guard/index.ts` | 374 | The plugin: the `onRoute` collection, the boot check of `ready()`, the stage handler, the denial path, the controls (`permissionGuard(app)`), `routeOfOperation` |
| `…/permission-guard/access-rules.ts` | 427 | The rule book compiled from the contract registry: one rule per operation, which route gets which rule, the problems that stop a boot. Pure |
| `…/permission-guard/decision.ts` | 162 | `decideAccess(rule, caller)`: the decision of stage 6. Pure |
| `…/permission-guard/denial.ts` | 158 | What a refusal answers and what it writes. Pure builders |
| `…/permission-guard/matrix.ts` | 139 | The one statement that reads the stored matrix, its check against the vocabulary, the shape of operation 10 |
| `…/permission-guard/router-table.ts` | 73 | The routes of the router read back from Fastify's printed route table (ruling D82, condition 4) |
| `apps/core-server/src/modules/rbac/index.ts` | 88 | Operation 10 and the boot step `rbac.matrix` |

Tests (10 files, 253 tests) and test support (1 file), 3,638 lines:

| Project | File | Tests |
|---|---|--:|
| `unit` | `src/plugins/permission-guard/__tests__/access-rules.test.ts` | 35 |
| `unit` | `…/__tests__/decision.test.ts` | 28 |
| `unit` | `…/__tests__/denial.test.ts` | 17 |
| `unit` | `…/__tests__/guard.test.ts` | 29 |
| `unit` | `…/__tests__/boot-registry.test.ts` | 9 |
| `unit` | `…/__tests__/static.test.ts` | 13 |
| `unit` | `src/modules/rbac/__tests__/routes.test.ts` | 11 |
| `db` | `src/plugins/permission-guard/__tests__/pipeline.db.test.ts` | 58 |
| `db` | `…/__tests__/denial.db.test.ts` | 29 |
| `db` | `src/modules/rbac/__tests__/matrix.db.test.ts` | 24 |

`src/plugins/permission-guard/__tests__/support.ts` is test support, not a test file: `guardApp`
(the real app on a clone with NO stage replaced), `registryRoutes` (stand-in routes built from
registry entries), `webOperator` and `deviceOperator` (a signed-in operator as a header),
`passScratchRoutes`. Other rows may import it.

Changed outside the two folders, under ruling D82: ten test files of other rows (section 14).
Not changed: `app.ts`, `index.ts`, `config.ts`, the contract, the schema.

## 3. The decision function

`decideAccess(rule, caller)` in `decision.ts`. `rule` is the registry's; `caller` is
`request.principal` as stage 4 set it, plus two facts read only where the rule asks for them.

| Access kind (operations) | ANONYMOUS | A retired device | DEVICE (paired, no operator) | OPERATOR, web session | OPERATOR, device session |
|---|---|---|---|---|---|
| `PUBLIC` (4) | allow | **403 `DEVICE_REVOKED`, audited**; allow on `getServiceHealth` and `redeemPairingCode` | allow | allow | allow |
| `DEVICE` (5) | 401 `NOT_SIGNED_IN` | **403 `DEVICE_REVOKED`, audited** | allow | 403 `DEVICE_NOT_PAIRED` | allow |
| `AUTHENTICATED` (25) | 401 | **403 `DEVICE_REVOKED`, audited** | 401 | allow | allow |
| a permission (40) | 401 | **403 `DEVICE_REVOKED`, audited** | 401 | holds it: allow. Else **403 `NOT_PERMITTED`, audited** (`FORBIDDEN` on `exportEvidence`) | the same |
| any-of (1) | 401 | **403 `DEVICE_REVOKED`, audited** | 401 | holds one: allow. Else **403 `NOT_PERMITTED`, audited** | the same |

Then, for a caller the table allows, the conditions of the rule, in the order of spec §7.3 line 7:

| Condition | Operations | Refusal | Audited |
|---|---|---|---|
| `CONSOLE_IDENTITY` | `signIn` | 403 `DEVICE_NOT_PAIRED` when the caller is neither a web console (web console `Origin`, no `Authorization`) nor a paired device | no |
| `DEVICE_SESSION` | `setBiometricEnrollment` | 403 `DEVICE_NOT_PAIRED` when the session is not bound to a device | no |
| `DEMO_FLAG` | the five demo operations | 403 `DEMO_DISABLED` while the server's demo flag is off; the permission is decided first, so a caller without `DEMO_CONTROL` gets `NOT_PERMITTED` whatever the flag (DC-1) | no, one log line (DC-2) |

Every refusal, cell by cell:

| Refusal | Status and code | Row | Place in the denial budget | Log |
|---|---|---|---|---|
| No principal where the rule needs an operator or a device | 401 `NOT_SIGNED_IN` | none (RB-6: no actor can be named) | none | the request line |
| A retired device | 403 `DEVICE_REVOKED`, `details.reason: DEVICE_REVOKED` | one `ACCESS_DENIED`: actor null, the device ID, `{ operationId, reason: DEVICE_REVOKED }` | one, in `class:local` (or `class:web`) | one `warn` line |
| A missing permission | 403 `NOT_PERMITTED` (`FORBIDDEN` on `exportEvidence`), `details: { operationId, permission, role }` | one `ACCESS_DENIED`; `EXPORT_DENIED` with its event on the three exports (section 6) | one, under `operator:<id>` | one `warn` line |
| No console identity; a device-only operation called from a web session | 403 `DEVICE_NOT_PAIRED` | none | none | one `warn` line |
| The demo flag is off | 403 `DEMO_DISABLED` | none | none | one `warn` line |
| The key already holds 20 refusals | 429 `RATE_LIMITED` with `retry-after`, from stage 5 or from `consume` | none | none | the throttle's line, once per window |

The function is pure: no database, no clock, no request. It reads nothing of a body, a query
string, a header or a path, so no refusal can depend on request data (a static test of the folder
asserts that no file of the guard reads `request.body`, `.query`, `.headers`, `.cookies` or the
raw URL).

**Where the truth is at request time (rule 4 of the brief): ONE answer.** The permissions of an
OPERATOR are the ones stage 4 read from `role_permissions` with the session lookup of THIS
request (`request.principal.permissions`; RB-3, SR-13). The decision uses those and nothing else.
The guard keeps no matrix for deciding and remembers nothing between two requests (RB-2). So:

| Change | Takes effect | Tested |
|---|---|---|
| The operator's role changes (the administration row, W33) | At the next request of every session of that operator, on the web and on a device; no new sign-in, no reload, nothing to call | `denial.db.test.ts` "a role change applies to the next request of the SAME session …": 403, 403, role changed in the clone, 200, 200, the session answer names the new role and its permissions, the device session 200, role changed back, 403, 403 |
| A grant of the stored matrix changes | At the next request | the same file, "a changed GRANT applies to the next request too …"; `matrix.db.test.ts` "answers what is stored at the moment of the call …" |
| The same, as a defect | Mutations M09 (a matrix written into the guard) and M47 (the decision of a session cached) are both detected | section 12 |

The matrix that the boot step loads (section 5) is a consistency check and nothing else.

## 4. The boot check: deny by default (RB-1, SR-43, AC-B-12)

A route gets a rule in exactly two ways:

1. it IS an operation of the contract registry: same method, same path (`{id}` as `:id`), and
   `config.operationId` naming it. The rule is the registry entry's `access` and `audit`;
2. it is the realtime channel, `GET /ws` (`WS_PATH` of the contract): the one route outside the
   REST registry. Its rule is fixed in `access-rules.ts`: open at the handshake to every caller
   that passed stages 3 to 5, no permission, no row, a retired device included; the channel
   decides what a socket may see and closes an unknown or retired credential with 4401 or 4403
   (spec §9.2, §14.2 upgrade table).

A route cannot bring a rule of its own, and production code has no switch that gives it one.

What stops the boot, each with a coded `AccessRuleError` that names the route and the operation,
one `error` log line and one `fatal` entry in the persistent error log:

| Code | Meaning |
|---|---|
| `ROUTE_WITHOUT_RULES` | The route is no operation of the registry: it has no access rule and no audit rule |
| `ROUTE_NOT_THE_OPERATION` | The route names a registry operation whose method or path is another (it cannot borrow the rule of a PUBLIC operation) |
| `OPERATION_ID_MISMATCH` | A registry path whose `config.operationId` is missing or names another operation (stages 2 and 5 read that member too) |
| `ACCESS_RULE_MISSING`, `AUDIT_RULE_MISSING` | The registry entry of a registered route lacks the rule |
| `ACCESS_RULE_INVALID`, `AUDIT_RULE_INVALID` | An unknown kind or condition, an any-of with fewer than two permissions, a success rule that is no audit type and no marker, a denial type the guard cannot write |
| `PERMISSION_NOT_IN_VOCABULARY` | The access rule names a permission the shared vocabulary does not hold |
| `PERMISSION_NOT_STORED` | The access rule of a registered route names a permission the stored matrix does not hold (boot step) |
| `STORED_MATRIX_MISMATCH` | The stored roles or permissions are not exactly the shared vocabulary (boot step) |

A registry operation whose route is NOT registered does not stop the boot: the module rows add
their routes one by one. The conformance row (W52) compares both directions with what this row
exposes: `permissionGuard(app).registeredRules()` (the operations that have a route) against
`permissionGuard(app).rules.operationIds` (the 75 of the registry).

### 4.1 Where a route without a rule is stopped (ruling D82, condition 4)

| The route was added | `app.ready()` | Boot step `rbac.matrix` (`checkRouter`), before the listener | A request |
|---|---|---|---|
| By a unit, or by any plugin registered after the units | **Rejects**: `AccessRuleError`, the code of the problem, the route by name | not reached | not reached |
| To the instance itself before the plugins ran (top level, before `ready()`) | Resolves: see below | **Stops the boot**: `BootError` at `rbac.matrix`, cause `AccessRuleError` `ROUTE_WITHOUT_RULES` naming the route | 500 `INTERNAL_ERROR`, fail closed, in an app that was never booted (only a test) |
| The same, at a registry path, with a missing or wrong `config.operationId` | Resolves | **Not detectable** (below) | 500 `INTERNAL_ERROR`; the log line carries `OPERATION_ID_MISMATCH` |

Why `ready()` cannot see a route that was added at the top level: Fastify calls the `onRoute`
hooks at the moment a route is defined, with the hooks that exist then, and a plugin's function
(the guard's included) runs only inside `ready()`. The only hook that exists that early is the
one `app.ts` adds for the 404 and 405 answers; its route table is private to the frozen file.

What the boot step does about it: `checkRouter()` reads EVERY route of the router from Fastify's
printed route table (`app.printRoutes()`, the radix tree; `router-table.ts`) and holds each one
against the registry by method and path. A table it cannot read stops the boot as well.

What is and is not detectable, measured:

| Fact | Evidence |
|---|---|
| The printed tree gives back exactly the routes the guard was shown | `guard.test.ts` "the printed route table gives back exactly the routes the guard was shown: all 75 operations and the socket" (76 routes) |
| The flat form (`commonPrefix: false`) is not usable: it prints a wildcard route without the path in front of it (`/api/v1/wild/*` appears as `* (GET)`) | a scratch run at 13:24; the default tree form is used instead |
| `app.findRoute()` of Fastify 5.12.5 returns `handler`, `params` and `searchParams`: no route configuration | the same run. So the `config.operationId` of a route the guard was never shown cannot be read at boot; a mismatch is refused at that route's first request |
| In the server's own start no route is added before the plugins run | a static test: no file loaded before the guard (`app.ts`, `index.ts`, `config.ts`, `src/core/**`, `src/plugins/**`) registers a route; routes are registered under `src/modules/**` and `src/realtime/**` only |

A test takes stage 6 out with the scaffold's own `app.stages.replace('accessRule', …)`. When the
stage is replaced before `ready()`, the route check is skipped and one `warn` line says so
(`the access rule stage was replaced: …`); `checkRouter()` does the same. Two static tests keep
that away from production: no production file replaces a stage or a seam, and none imports from
a `__tests__` folder.

## 5. The stored matrix: the boot step and the reload entry

`roles`, `permissions` and `role_permissions` are read with ONE statement (one snapshot), on the
runtime pool, which may only SELECT them (database contract §7.3; tested: INSERT, UPDATE and
DELETE as `dems_app` answer SQLSTATE 42501).

**Boot step `rbac.matrix`**, registered by `modules/rbac`, so it runs after `engine.rehydrate`:

1. `checkRouter()`: section 4.1;
2. `reloadMatrix()`: every permission that the rule of a registered route names must be stored
   (`PERMISSION_NOT_STORED`, naming the operation), and the stored roles and the stored
   permissions must be exactly the shared vocabulary (`STORED_MATRIX_MISMATCH`, naming what is
   missing and what is unknown). **Corrected by decision D88 (follow-up, section F.6):** which
   role holds which permission IS checked since then: the stored grants must be exactly the
   shared role table (`STORED_GRANTS_MISMATCH`, naming the first difference). Until 15:15 this
   item said that the grants were not checked.

Its place after the engine's step does not matter for a request: the entry point opens the
listener only after the last boot step has passed, so no request can arrive between the two
steps, and a step that fails stops the process before it listens. Placing it there keeps every
boot that other rows' tests stop at `engine.rehydrate` as it is.

**The reload entry**, for the reset row (W43) after it has swapped the database, and for tests:

```ts
import { permissionGuard } from '../../plugins/permission-guard';

permissionGuard(app).reloadMatrix(): Promise<LoadedMatrix>
// LoadedMatrix = { roles: readonly string[]; permissions: readonly string[];
//                  grants: readonly { role: string; permission: string }[]; loadedAt: number }
// rejects with an AccessRuleError (logged and persisted) when the stored matrix does not fit;
// the last good matrix stays in permissionGuard(app).matrix()
```

**The administration row (W33) calls nothing after a role change.** The decision reads the
caller's permissions with every request (section 3), so `assignUserRole` only has to commit.

## 6. The denial row, and the ruling for the any-of (decision D64 DN-12)

Written in its own unit of work (`rbac.denied`), AFTER `await app.denialBudget.consume(request)`
and BEFORE the answer leaves. If the row cannot be written the request is still refused: 503
`NOT_READY` when the database does not answer, 500 when the insert itself fails.

| Refusal | Type | Severity | Actor | Device | Details | Message |
|---|---|---|---|---|---|---|
| A missing permission | `ACCESS_DENIED` | WARNING | the operator | the session's device, null on the web | `{ operationId, permission, role }` | `Access denied: role TECHNICIAN lacks SESSION_START (startSession)` |
| The same on the any-of | `ACCESS_DENIED` | WARNING | the operator | the same | `{ operationId: 'setStoragePolicy', permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE', role }` | `Access denied: role INVESTIGATOR holds none of EVIDENCE_REVIEW, MAINTENANCE (setStoragePolicy)` |
| A retired device | `ACCESS_DENIED` | WARNING | null | the device | `{ operationId, reason: 'DEVICE_REVOKED' }` | `Access denied: device DEV-0003 is no longer paired (getAuthSession)` |
| `exportEvidence` (RB-5) | `EXPORT_DENIED`, and the event `EXPORT_DENIED` | WARNING | the operator | the session's device | `{ operationId, permission, role, eventKind: 'UNAUTHORIZED_EXPORT' }`; the row's `evidenceId` | `Export of EV-20261001-0001 denied: role INVESTIGATOR lacks EVIDENCE_EXPORT` |
| `exportAudit`, `exportLogs` (RB-5) | `EXPORT_DENIED`, and the event | WARNING | the operator | the same | the same plus `scope: 'AUDIT'` or `'LOGS'` | `Audit export denied: …`, `Log export denied: …` |

A row never holds a request body, a query string, a header, a token or a credential. The one
value taken from the request is the evidence ID in the path of `exportEvidence`, and only when it
matches the registry's own pattern for that parameter; otherwise the row names no evidence. It
is what the simulator's row names and what the custody view of both clients reads. The export
rows and events equal the shared simulator's, member by member, with `operationId` and
`permission` added (tested against a running simulator in `denial.test.ts`).

**The ruling for the any-of.** `details.permission` is the alternatives of the rule in registry
order, joined with `_OR_`: **`EVIDENCE_REVIEW_OR_MAINTENANCE`**, in the audit row and in
`error.details` of the answer alike.

| Why this form | |
|---|---|
| It is storable | The audit writer's closed list for `ACCESS_DENIED` accepts `permission` only as one SCREAMING_SNAKE_CASE code (`core/audit-details.ts`). The contract's placeholder `ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)` and the simulator's label `EVIDENCE_REVIEW \| MAINTENANCE` are both refused by it. No key was missing and nothing of the core was changed |
| It loses nothing | It names every alternative, and it splits back into them: no permission of the vocabulary holds `_OR_` (tested); `permissionsOfDenialCode(code)` is exported for the matrix test (W47) |
| One form in both places | The row and the answer name the same three values |

**The exact example text for the contract close-out row (W83), CONTRACT-GAP-5.** In
`packages/shared/src/api/storage.ts:179`, replace

```ts
permission: 'ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)',
```

with

```ts
permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE',
```

and the comment above it (`:174`) with "RB-4 names `operationId`, `permission` and `role`; for
the one any-of the permission is its alternatives joined with `_OR_`." The whole answer, as the
server sends it:

```json
{ "error": { "code": "NOT_PERMITTED", "message": "Your role does not allow this action. The attempt was audited.",
             "details": { "operationId": "setStoragePolicy", "permission": "EVIDENCE_REVIEW_OR_MAINTENANCE", "role": "INVESTIGATOR" },
             "requestId": "…" } }
```

## 7. The HTTP decision table of spec §14.2, with a test ID per cell

`pipeline.db.test.ts`, block "AC-B-73: the decision table for HTTP requests of spec §14.2,
through the real stages 3 to 6". No stage is replaced. The cookie is the session of the seeded
SUPERVISOR on the web console; the bearer value is the session of the seeded INVESTIGATOR on a
paired device. A cell with a credential is sent to `getAuthSession` (GET) and `touchSession`
(POST); a cell without one to `getSignInStatus` (GET) and `signIn` (POST, with the right
password). The fourth column of the specification is tested with both of its values. Every 403 in
the table that is not named otherwise is `ORIGIN_NOT_ALLOWED`.

| Credential present | 1 No `Origin` | 2 One of the instance's own origins | 3 A web console origin | 4 Any other origin | 5 The literal `null` |
|---|---|---|---|---|---|
| **C** Cookie | `H-C1-GET` 200; `H-C1-POST` 403 | `H-C2-GET` 403; `H-C2-POST` 403 | `H-C3-GET` 200; `H-C3-POST` 200 | `H-C4-GET` 403; `H-C4-POST` 403 | `H-C5-GET` 403; `H-C5-POST` 403 |
| **B** Bearer | `H-B1-GET` 200; `H-B1-POST` 200 | `H-B2-GET` 200; `H-B2-POST` 200 | `H-B3-GET` 403; `H-B3-POST` 403 | `H-B4-GET` 403; `H-B4-POST` 403 | `H-B5-GET` 403; `H-B5-POST` 403 |
| **N** None | `H-N1-GET` 200 (the web console's lock state); `H-N1-POST` `signIn` 403 `DEVICE_NOT_PAIRED` | `H-N2-GET` 200; `H-N2-POST` `signIn` 403 `DEVICE_NOT_PAIRED` | `H-N3-GET` 200; `H-N3-POST` `signIn` 200 with `Set-Cookie` | `H-N4-GET` 403; `H-N4-POST` 403 | `H-N5-GET` 403; `H-N5-POST` 403 |
| **X** Cookie and bearer | `H-X1-GET` 401 `NOT_SIGNED_IN` with `CREDENTIAL_CONFLICT`; `H-X1-POST` 403 | `H-X2-GET` 403; `H-X2-POST` 403 | `H-X3-GET` 401 with `CREDENTIAL_CONFLICT`; `H-X3-POST` 401 with `CREDENTIAL_CONFLICT` | `H-X4-GET` 403; `H-X4-POST` 403 | `H-X5-GET` 403; `H-X5-POST` 403 |

Each cell also asserts what it must not do: no audit row (only `H-N3-POST` writes one,
`AUTH_SUCCESS`), no `Set-Cookie` (only `H-N3-POST`), and for an accepted cell that the session of
the credential that was sent answers. Beside the table, in the same block: an anonymous caller on
an AUTHENTICATED operation answers 401 from stage 6 in columns 1 to 3; `signIn` with the own
origin answers 403 for three different bodies, a non-JSON one included, takes no sign-in attempt
and writes no row, and stage 6's own log line is there three times; a paired device's credential
signs in with no `Origin` and with the own origin.

Further blocks of the file:

| Block | What it shows |
|---|---|
| AC-B-43 | A POST with a foreign `Origin`, with the cookie and no `Origin`, and with the cookie and the own origin: 403 each; the same POST with a web console origin: 200 |
| AC-B-74 | `http://localhost:5173`, `null`, `http://127.0.0.1:5173/`, `HTTP://127.0.0.1:5173`, `http://127.0.0.1:5174`: 403 `ORIGIN_NOT_ALLOWED` on a POST with the cookie, on a sign-in without a credential, and on the handshake request of the socket with and without a bearer value |
| Decision D69 | A REST call with no `Origin`, `Host: 127.0.0.1:4420`, `User-Agent: okhttp/4.12.0` and the bearer session: 200 on GET and POST. Five variants of `Host` and `User-Agent` (another port, another host, a browser's agent, none): the same three answers each time. The handshake request with `Origin: http://127.0.0.1:4420` and the bearer value passes stages 3 to 6, also beside another instance's cookie and an unrelated one (F55) |
| The socket route at stage 6 | Anonymous, an unknown bearer value and a retired device all pass; none writes a row or takes a place in the budget |
| AC-B-84 (REST) | 31 different unknown bearer values: 30 × 401, then 429; the class is then used up for every caller without a principal and for nobody with one; 60 s later it is counted afresh. 31 requests of one operator: 31 × 200 |
| OR-5 | No answer of the file carries an `Access-Control-Allow-*` header |

Not proven here: a real WebSocket handshake. The handshake request is sent with `app.inject`
through the stages to a stand-in route; the upgrade itself is the realtime row's (W42).

## 8. What a module row must and must not do

| A module MUST | Why |
|---|---|
| Register each route from its registry entry: `app.route({ ...routeOfOperation(operation), schema, handler })` (`routeOfOperation` is exported by `plugins/permission-guard`) | The guard accepts a route only in that form: the registry's method and path, and `config.operationId` naming it. Anything else stops `app.ready()` |
| Leave who may call to stage 6 | The access rule is the registry's. For the 23 hosted actions the simulator does not check, stage 6 is the ONLY check there is (engine host F-6) |
| Pass `request.principal` on as it is (`app.engine.command(request.principal, …)`) | The actor of every row comes from the session |
| Count its OWN audited refusals: `await app.denialBudget.consume(request)` before an `AUTH_FAILED`, `AUTH_LOCKED`, `PAIRING_FAILED` or `PAIRING_LOCKED` row | Only the rows of this guard (`ACCESS_DENIED`, `EXPORT_DENIED`) are counted here |
| Map a too-short reason to `INVALID_REASON` where the specification names it | Stage 7 is after the guard; nothing here touches a body |
| In a database-free test, give the principal its permissions: `app.stages.replace('authenticate', (request) => { request.principal = { kind: 'OPERATOR', …, role, permissions: ROLE_PERMISSIONS[role] }; })` | The decision uses the permissions on the principal. With the real stage 4 they come from PostgreSQL |

| A module MUST NOT | Why |
|---|---|
| Check a permission, a role, a session or a device in a handler or in a route hook | It would be a second, unlisted rule. A static test of this row asserts it for `modules/rbac`; each module row should assert the same for its folder |
| Write an `ACCESS_DENIED` or an `EXPORT_DENIED` row | The guard writes exactly one per refused call. A hosted export action is never reached by a caller without the permission, so the simulator's own `EXPORT_DENIED` branch does not run |
| Register a route that is no registry operation, or put a rule into a route's configuration | No such mechanism exists; the boot stops |
| Replace a stage or a seam outside a test | A static test over the whole server refuses it |
| Call `permissionGuard(app).reloadMatrix()` after a role change | Not needed (section 5) |
| Expect a 403 to depend on the body | A caller without the right is refused before the body is read; a module's body errors are seen by permitted callers only |

For a test of a module that adds SCRATCH routes to the real app: `passScratchRoutes(app)` after
`ready()` (only routes that are no registry operation pass; every registry route keeps the real
guard), or `app.stages.replace('accessRule', () => {})` before `ready()` for a file that is not
about who may call.

The realtime row (W42) registers `GET /ws` and nothing else is needed: the guard has its rule.

## 9. The identity routes' own checks (DV-7 of the identity row)

Order and answers agree: the guard refuses with the same functions the identity routes use
(`notSignedIn()`, `deviceRevoked()`, `deviceNotPaired()`, `consoleIdentityOf`), and it runs
first. All identity tests pass with the real stage 6 in front, unchanged.

| Route-level check | Now | Recommendation |
|---|---|---|
| `onRequest: operatorOnly` of operations 4, 5, 6 | Never refuses: stage 6 answered 401 or 403 before it | Can go (code review W38). `operatorSessionOf(request)` in the handlers stays: it returns the session |
| `onRequest` of `signIn` (`requireConsoleIdentity`) | Never refuses | Can go. The call in the handler stays: it returns the console identity the sign-in needs |
| `refuseRetiredDevice` in the handler of `getSignInStatus` | Never refuses | Can go |

They produce no second row (tested: a retired device on operations 2 and 3 writes ONE row each).
A side effect while they stay: they hide a defect of stage 6 from an HTTP test. Mutation M45
(every caller counts as a console) survived the first pass for exactly that reason and is now
detected by the stage's own log line (section 12).

## 10. Operation 10 `getRoleMatrix`

`GET /api/v1/rbac/matrix`, access `AUTHENTICATED`, audit `NONE-R`, no body. The handler reads
the three tables with the one statement at every call and answers
`{ roles, permissions, grants, editable: false }` through the contract's `RoleMatrixSchema`:
roles and permissions in their stored order, grants by role and then by permission. It checks
nothing about the caller. A read that fails answers 503 `NOT_READY`, is logged by its code only,
written to the error log and reported to readiness.

## 11. Verification

### 11.1 The row's own tests

Unit, 14:05:35 (`npm run test -w @dems/core-server -- --maxWorkers=2 --reporter=verbose src/plugins/permission-guard src/modules/rbac`):

```
 Test Files  7 passed (7)
      Tests  142 passed (142)
```

Database, 14:05:36 (`DEMS_TEST_STEP=50 npm run test:db -w @dems/core-server -- --maxWorkers=2 --reporter=verbose src/plugins/permission-guard src/modules/rbac`):

```
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_50_tmdfpdbp_
 Test Files  3 passed (3)
      Tests  111 passed (111)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 38 ms; 0 remain with the run prefix dems_test_step_50_tmdfpdbp_
```

Both exit 0. Every test by name: `implementation/assets/28_test_unit_verbose.txt` (142 pass
marks) and `28_test_db_verbose.txt` (111). Earlier runs of the same files, each exit 0: database
13:43:46 (2 files, 85 tests), 13:47 (3 files, 109), 13:57 (3 files, 110); unit 13:36 (5 files,
121), 13:57 (7 files, 142). One run was red on this row's own side: 13:46:33, three tests of
`matrix.db.test.ts` that compared the answer of operation 10 with the contract's example grant by
grant (finding F-4); they now compare the two as sets and the server's order separately.

### 11.2 Whole projects, typecheck, lint (final state)

From `/Users/gsp-budi/Documents/DEMS`, one after the other (`implementation/assets/28_final_runs.log`):

```
# npm run typecheck -w @dems/core-server                       (14:05:48)   exit 0
> tsc --noEmit

# npm run lint -w @dems/core-server                            (14:05:51)   exit 0, no warning
> oxlint

# npm run test -w @dems/core-server -- --maxWorkers=2          (14:05:51)   exit 0
 Test Files  77 passed (77)
      Tests  1992 passed (1992)
   Duration  13.82s (import 58%, tests 37%, transform 4%, worker 1%)

# DEMS_TEST_STEP=50 npm run test:db -w @dems/core-server -- --maxWorkers=2   (14:06:12)   exit 0
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_50_tmdfqcfo_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
 Test Files  48 passed (48)
      Tests  740 passed (740)
   Duration  50.04s (tests 90%, import 9%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 133 ms; 0 remain with the run prefix dems_test_step_50_tmdfqcfo_
```

Every run of the whole projects in this row:

| Time | Project | Tree | Result |
|---|---|---|---|
| 13:08:02 | `unit` | before the first edit | exit 0: 70 files, 1,850 tests (the baseline; the reset row's follow-up had added 3 since 12:52) |
| 13:15:47 | `unit` | the guard, no other file touched | exit 1: 8 files failed, 128 tests failed, 22 skipped, 1,700 passed: by design (section 14) |
| 13:16:30 | `db` | the same | exit 1: 5 files failed, 9 tests failed, 620 passed: 8 by design, 1 fixed on this row's side (section 14) |
| 13:26:24 | `unit` | with the patch of D82, before this row's tests | exit 0: 70 files, 1,850 tests |
| 13:26:40 | `db` | the same | exit 0: 45 files, 629 tests |
| 13:47 | `unit` | with this row's tests | exit 0: 77 files, 1,991 tests; lint exit 0 with two warnings in two of this row's test files, removed at once |
| 14:05:51 | `unit` | final | exit 0: 77 files, 1,992 tests |
| 14:06:12 | `db` | final | exit 0: 48 files, 740 tests |

No run of this row was red in a file of a row in flight (P11): the reset row's follow-up and the
shared-package review did not disturb the workspace's typecheck or tests at any of these times.

### 11.3 The module gate (MODG)

Route list of the module against the registry, as the test prints both
(`src/modules/rbac/__tests__/routes.test.ts`):

```
[w28] MODG routes of src/modules/rbac: GET /api/v1/rbac/matrix getRoleMatrix
[w28] MODG registry, operation 10:     GET /api/v1/rbac/matrix getRoleMatrix
```

| Gate item | Met by |
|---|---|
| Route list equals registry operation 10 | the test above; "the area has five operations in the registry: 10 is this module's, 11 to 14 are the administration row's" |
| A success test | `matrix.db.test.ts` "INVESTIGATOR / SUPERVISOR / TECHNICIAN reads the matrix: 200, valid against the contract …", "a session on a paired device reads it too" |
| A denial test if it carries a permission | It carries none (`AUTHENTICATED`). Its refusals are tested: 401 without a session, 401 for a paired device without an operator, 403 `DEVICE_REVOKED` with its row, 403 for a foreign `Origin` |
| A validation test if it has a body | It has none; POST on the path answers 405 with `allow: GET` |
| In-process, own clones, no port | `DEMS_TEST_STEP=50`; every request is `app.inject`; `app.server.listening` is asserted false after a boot |

### 11.4 The cases of plan W28

| Case | Test | Result |
|---|---|---|
| An app with a route that lacks an access rule or an audit rule fails to boot | `guard.test.ts` block "RB-1, AC-B-12: the boot check of app.ready()" (9 tests); `boot-registry.test.ts` (a module's route whose registry entry lost its access rule: `getRoleMatrix`, `signIn`, `getServiceHealth`; its audit rule: `getRoleMatrix`, `touchSession`, `getServiceHealth`); `matrix.db.test.ts` "a route that a plugin registers without a rule never gets as far as the boot steps" | PASS |
| A denied call answers 403 and writes exactly one `ACCESS_DENIED` row naming actor, operation and permission | `denial.db.test.ts` "a denied call answers 403 NOT_PERMITTED and writes exactly one ACCESS_DENIED row …" | PASS |
| … decided before the body is read | `denial.db.test.ts` block "SR-44" (4 bodies × nobody and a role without the permission; the holder gets 413, 400, 422, 400, 200) | PASS |
| An allowed call writes none | `denial.db.test.ts` "an allowed call writes no row, takes no place in the budget and reaches its handler" | PASS |
| Every cell of the HTTP decision table of spec §14.2 | `pipeline.db.test.ts`, 40 cells (section 7) | PASS |
| `signIn` with the own origin and no bearer: 403 `DEVICE_NOT_PAIRED` | `H-N2-POST`; "SR-69: signIn with the own origin and no bearer …" | PASS |
| A POST with the cookie and the own origin: 403 | `H-C2-POST`; "AC-B-43 …" | PASS |
| 100 denied calls of one operator within 10 s: exactly 20 rows, 80 × 429; after 60 s audited again | `denial.db.test.ts` "100 denied calls within 10 s write exactly 20 rows while the other 80 answer 429; after the 60 s window a denial is audited again"; "100 denied calls at once …" | PASS |
| 31 requests with 31 different unknown bearer values share one bucket | `pipeline.db.test.ts` "31 requests with 31 different unknown bearer values share one bucket …" | PASS |

## 12. Mutation check

73 defects were planted one at a time and the row's own tests (7 `unit` files, 3 `db` files) run
on each. **73 of 73 detected.** No file of the repository was changed for it: the harness of the
identity row was reused, a scratch Vitest configuration outside the repository whose one
transform hands ONE production file to Vitest with ONE text replaced
(`implementation/assets/28_mutation_harness.vitest.config.mjs.txt`, `28_mutation_harness.run.sh.txt`,
`28_mutations.json`; result lines `28_mutations_pass1.log`, `28_mutations.log`). The runner
writes Vitest's output into a file and reads it afterwards, so no pipe is closed under a running
database test (the cause the identity row suspected for its leftover template database).

| Pass | Result |
|---|---|
| First, 13:50:54 to 13:57:03, against 141 unit and 109 database tests | 72 detected. **M45 survived**: "every caller counts as a console" (`consoleIdentity: true` in the stage). The identity route's own check behind the stage gave the same 403, so no HTTP test could see that the stage had stopped applying ID-1 (finding F-5) |
| What was done | The stage's own `warn` line is now asserted: `pipeline.db.test.ts` "SR-69 …" counts three lines with `operationId: signIn, cause: CONSOLE_IDENTITY`; `guard.test.ts` gained "the console rule ID-1 is applied by the stage itself …". Added for coverage, not for a survivor: one test (SR-46) and the handshake assertions of AC-B-74 |
| Second, 13:58:06 to 14:05:17, all 73 again, against 142 unit and 110 database tests | **73 detected**; M45: 1 unit test and 1 database test fail |
| Afterwards | One database test was added (the refusals with an `Upgrade` header, finding F-8): 111. It is not about a planted defect |

Among the 73, by file:

| File | Mutations | Examples |
|---|---|---|
| `decision.ts` | M01 to M17 | A retired device not refused on a PUBLIC operation, or never; AUTHENTICATED lets everybody, or a paired device, through; the permission not checked; the any-of needs both, or checks only its first; **a matrix written into the guard (M09)**; a DEVICE operation open to a web session, or to nobody's credential; each of the three conditions not applied; the conditions before the permission (DC-1); the session's device not named |
| `access-rules.ts` | M18 to M30 | A retired device may read the sign-in status, or is refused on health; a route gets the rule of the operation it NAMES; a registry route without `operationId` accepted; **a route that is no registry operation gets an open rule (M22)**; an entry without an audit rule, or without an access rule, compiled all the same; an unknown permission accepted; the any-of joined as the simulator writes it; all exports `FORBIDDEN`; any method, or any path under `/ws`, as the socket; the exports refused with `ACCESS_DENIED` |
| `index.ts` (the stage and the audit path) | M31 to M48 | No place taken in the budget; the place taken AFTER the row; no row; two rows; no event for an export; the answer not waiting for the row; an allowed call writing a row; a 401 taking a place; **a route without a rule let through at request time (M39)**; the boot check of `ready()` refusing nothing; `checkRouter` ignoring a route, or looking at GET only; the path ID unchecked; every caller a console; the demo flag read as on; **the decision of a session cached (M47)**; a replaced stage not announced |
| `denial.ts` | M49 to M61 | No actor; no permission; no role; another operation; a retired device's row without its reason, or without its device; 401 instead of 403, both ways; no details in the answer; severity INFO; no evidence ID; no scope |
| `matrix.ts` | M62 to M67 | A permission that is not stored accepted; an unknown or a missing stored name accepted; `editable: true`; the grants or the permissions in another order |
| `modules/rbac/index.ts` | M68 to M71 | The boot step without the router walk, or without the matrix; operation 10 answering the matrix as loaded at boot, or dropping a grant |
| `router-table.ts` | M72, M73 | Only the first method of a route; fragments of deeper nodes kept |

Limits of the check: each mutation is one text replaced in one file; the static test file reads
the sources from disk, not through the transform, so it cannot see a mutation (the rules it
keeps are positive controls of their own).

## 13. Test ledger (P24)

`@dems/core-server` only. No other workspace was written.

| Project | Before | After (final) | This row |
|---|---|---|---|
| `unit` | 70 files, 1,850 tests (13:08:02) | 77 files, 1,992 tests, 0 failed (14:05:51) | **+7 files, +142 tests** |
| `db` | 45 files, 629 tests (13:26:40; the controller's baseline) | 48 files, 740 tests, 0 failed (14:06:12) | **+3 files, +111 tests** |

Expected total = baseline + additions: 1,850 + 142 = 1,992 and 629 + 111 = 740. The ten adapted
files of other rows keep their test counts: no test was added to or removed from them.

| Project | File | Tests |
|---|---|--:|
| `unit` | `src/plugins/permission-guard/__tests__/access-rules.test.ts` | 35 |
| `unit` | `src/plugins/permission-guard/__tests__/decision.test.ts` | 28 |
| `unit` | `src/plugins/permission-guard/__tests__/denial.test.ts` | 17 |
| `unit` | `src/plugins/permission-guard/__tests__/guard.test.ts` | 29 |
| `unit` | `src/plugins/permission-guard/__tests__/boot-registry.test.ts` | 9 |
| `unit` | `src/plugins/permission-guard/__tests__/static.test.ts` | 13 |
| `unit` | `src/modules/rbac/__tests__/routes.test.ts` | 11 |
| `db` | `src/plugins/permission-guard/__tests__/pipeline.db.test.ts` | 58 |
| `db` | `src/plugins/permission-guard/__tests__/denial.db.test.ts` | 29 |
| `db` | `src/modules/rbac/__tests__/matrix.db.test.ts` | 24 |

Test support, not a test file: `src/plugins/permission-guard/__tests__/support.ts`.

## 14. Existing tests changed by design (ruling D82)

With the real stage 6 in the tree and no other file touched, 12 test files of other rows failed
(13:15 `unit`: 8 files, 128 tests failed, 22 skipped; 13:16 `db`: 5 files, 9 tests failed). Two
causes, both by design:

- deny by default: a scratch route is no operation of the registry, so it has no rule. It answers
  500 at request time, or stops `ready()` when a child plugin registers it;
- the boot step `rbac.matrix` is one more entry in two pinned lists of passed boot steps.

One failure was NOT by design and was fixed on this row's side: `src/engine/__tests__/commands.db.test.ts:729`
allows only a closed set of log keys, and the boot step logged its counts under three new keys.
That line is removed; the readiness plugin's "boot step passed" line says the same.

Reported to the controller at 13:22 with file, line, failure text and the proposed change, proven
on a scratch copy of the workspace (unit: every file but one passed, the one being
`test/db/contract-inventory.test.ts`, which reads `docs/` by a relative path the copy lacked;
db: the affected files, 11 files and 129 tests, passed). Ruling D82: apply the patch as it is.
Applied at 13:24:59 after `git apply --check`; pre-images saved first (section 21). The patch:
`implementation/assets/28_by_design_test_changes.patch` (10 files, 20 insertions, 1 deletion).

| # | File and line (after) | Before | After | Reason |
|--:|---|---|---|---|
| 1 | `src/plugins/logger/__tests__/log-capture.test.ts:81` | the set-up replaces `originGuard`, `authenticate`, `throttle` after `ready()` | + `app.stages.replace('accessRule', () => {});` | Scratch routes `/api/v1/probe/:id`, `/boom/:id`, `/twice`, `/by-hand` |
| 2 | `src/modules/identity/__tests__/tokens-cookie.test.ts:77-78` | `await instance.ready();` | + a comment and `instance.stages.replace('accessRule', () => {});` | Scratch routes `/api/v1/scratch/set`, `/clear` |
| 3 | `src/plugins/authenticate/__tests__/authenticate.test.ts:132-133` | `await app.ready();` | + a comment and the same line | Four scratch routes under `/api/v1/scratch` |
| 4 | `src/plugins/error-envelope/__tests__/error-envelope.test.ts:68-69` | `app.stages.replace('readiness', () => {});` | + a comment and the same line | Seven scratch routes (`/api/v1/thing…`, `/boom`, `/refused`, `/wrong-answer`) |
| 5 | `src/plugins/readiness/__tests__/readiness.test.ts:20-21` | `prepare?.(app);` then `await app.ready();` | + a comment and the same line BEFORE `ready()` | Scratch routes `/api/v1/anything…`; one test registers its route in a child plugin, which the boot check sees |
| 6 | `src/plugins/readiness/__tests__/readiness.test.ts:83` | the hold test's own app | + the same line before `ready()` | The same scratch route |
| 7 | `src/plugins/origin-guard/__tests__/guard-test-app.ts:75-76` | `await app.ready();` | + a comment and the same line | The shared builder of `origin-guard.test.ts`, `throttle.test.ts`, `denial-budget.test.ts`, `windows-limits.test.ts`: scratch routes `/api/v1/scratch/:id` and each file's own |
| 8 | `src/plugins/response-headers/__tests__/response-headers.test.ts:88-89` | `await app.ready();` | + a comment and the same line | Five scratch routes (the file's second app replaced the stage already) |
| 9 | `src/core/__tests__/seeded.db.test.ts:41-42` | the list ends with `'engine.rehydrate'` | + a comment and `'rbac.matrix'` | The new boot step passes last |
| 10 | `src/engine/__tests__/restart.db.test.ts:24` | `BOOT_STEPS = [… 'engine.rehydrate']` | `[… 'engine.rehydrate', 'rbac.matrix']` | The same |
| 11 | `src/modules/identity/__tests__/support.ts:21` | — | + `import { passScratchRoutes } from '../../../plugins/permission-guard/__tests__/support';` | For the line below |
| 12 | `src/modules/identity/__tests__/support.ts:95-96` | `await app.ready();` | + a comment and `if (options.routes !== undefined) passScratchRoutes(app);` | `sessions.db.test.ts` and `authenticate.db.test.ts` add scratch routes through `identityApp(db, { routes })`; operations 2 to 6 keep the REAL guard |

**None of the assertions of the seven set-ups that now replace `accessRule` was about stage 6**
(condition 2 of the ruling), file by file:

| File | What it tests | Mentions of the access stage |
|---|---|---|
| `log-capture.test.ts` | The log: the route pattern, redaction, no body, no credential | One loop that replaces all five stages by no-ops (`:290`) |
| `tokens-cookie.test.ts` | Token form, the cookie's attributes | none |
| `authenticate.test.ts` | Stage 4: the credential decision table, activity, the throttle key | none |
| `error-envelope.test.ts` | Stage 1 and stage 7: 400, 404, 405, 413, 422, 500, the envelope | none |
| `readiness.test.ts` | Stage 2, the order of the five stages, the seams, the boot steps | The slot's NAME in the list of stages (`:109`), and recorders it puts into all five slots to show the order (`:128`): assertions about the scaffold's order, not about what stage 6 does |
| `guard-test-app.ts` and its users | Stage 3 (`origin-guard.test.ts`), stage 5 (`throttle.test.ts`, `windows-limits.test.ts`), the denial budget (`denial-budget.test.ts`) | `origin-guard.test.ts:388-394` and `throttle.test.ts:326-340` put a recorder into the slot to show that a refusal of stage 3 or 5 comes BEFORE it; `denial-budget.test.ts` puts its own stand-in guard there to show how a caller of `consume` behaves. Each replaces the slot again after the builder's line, so they run as before |
| `response-headers.test.ts` | The header set of OR-9 on every answer | Its second app already replaced all four guard stages |

What they lost is nothing they asserted. What the tree gained in exchange: stages 3 to 6 are now
run together, unreplaced, by `pipeline.db.test.ts`, `denial.db.test.ts` and `matrix.db.test.ts`
(sections 7 and 11.4), and the identity row's database tests run operations 2 to 6 with the real
stage 6 in front.

**No "still a stub" assertion of this row existed in `readiness.test.ts`** (standing rule D52):
the file named no stub of stage 6 at 12:53, so nothing was deleted. The file changed only by
lines 5 and 6 of the table.

`passScratchRoutes` (condition 3): it lets through ONLY routes that are no registry operation.
Asserted in `guard.test.ts` "lets a route that is no registry operation pass, and leaves the real
guard on every registry operation": after the call, a scratch route answers 200, a scratch route
that borrows the name `signOut` answers 200 (it is no registry operation), and `startSession` and
`listUsers` answer 401 for nobody, 403 with a row for a TECHNICIAN and 200 for a SUPERVISOR. It
lives under `__tests__/`; the static test "no production file imports from a __tests__ folder"
covers every production file of the server.

## 15. Requirement to test

| Requirement | Where it is met | Test |
|---|---|---|
| SR-13 (no privilege in a session or a token; read per request) | The decision uses the principal's permissions of this request; the guard holds no matrix for deciding | `denial.db.test.ts` block "AC-B-18, RB-2, RB-3" (3 tests); `decision.test.ts` block "RB-3" (5 tests); mutations M09, M47 |
| SR-43, AC-B-12 (deny by default; a route without its two rules cannot boot) | Section 4 | `guard.test.ts` block "RB-1, AC-B-12"; `boot-registry.test.ts`; `access-rules.test.ts` blocks "which route gets which rule", "a registry entry that cannot be compiled" (14 defects); `matrix.db.test.ts` block "a boot that the matrix step stops" |
| SR-44 (every request, before the body) | The stage runs in the one `onRequest` hook; the function is pure | `denial.db.test.ts` block "SR-44"; `guard.test.ts` "a denial is decided before the body is read …"; `static.test.ts` "SR-44: read no body, no query string, no header …" |
| SR-45 (one row per refused call, none for an allowed one, none beyond the budget) | Section 6 | `denial.db.test.ts` block "RB-4, SR-45" (7 tests), block "AC-B-75"; `guard.test.ts` "a denied call answers 403 and commits exactly one row in one unit …" |
| SR-46 (the server decides, a client's table is a hint) | Nothing of a request is read | `denial.db.test.ts` "SR-46: nothing a client says about its role or its permissions is read …" |
| SR-69, AC-B-73 (two Origin lists; the own origin is no console) | Stage 3 of W23 and the console rule at stage 6 | `pipeline.db.test.ts`: 40 cells; "SR-69 …" |
| SR-71, AC-B-75 (one operator) (the denial budget) | `consume` before the row | `denial.db.test.ts` block "AC-B-75, SR-71" (4 tests); `guard.test.ts` "SR-71 …", "100 denied calls at once …" |
| SR-75, AC-B-84 (REST) (the throttle key) | Stages 4 and 5 of W24 and W23, run together here | `pipeline.db.test.ts` block "AC-B-84 (REST), SR-75" |
| AC-B-16, unit form | All 75 operations for each caller | `decision.test.ts` block "AC-B-16, unit form: all 75 operations for nine callers" (675 cells; 22, 3 and 31 denied cells); `matrix.db.test.ts` the same against the STORED matrix (450 cells) |
| AC-B-18 (a role change applies to the next request) | Section 3 | `denial.db.test.ts` "a role change applies to the next request of the SAME session …". The HTTP form through `assignUserRole` is the administration row's (W33) |
| AC-B-43 | Stage 3 with the other stages real | `pipeline.db.test.ts` "AC-B-43 …"; "OR-5: no answer carries an Access-Control-Allow-* header" |
| AC-B-74 | The same | `pipeline.db.test.ts` "AC-B-74: … " (5 origins; POST and the handshake request) |
| RB-5 (the three exports) | Section 6 | `denial.db.test.ts` block "RB-5" (4 tests); `denial.test.ts` block "RB-5: the export refusals keep the simulator row and event" |
| RB-6, D78 DN-9 (a retired device) | Section 3 | `denial.db.test.ts` block "RB-6, decision D78" (4 tests, the last with five different retired credentials) |
| RB-9 (the matrix is read-only) | Operation 10; the runtime role's privileges | `matrix.db.test.ts` "RB-9 …" |
| AC-B-17 (the seeded matrix equals the shared table) | — | `matrix.db.test.ts` "AC-B-17, RB-7 …" |
| D69 (what the mobile app sends) | Nothing keys on `Host`, `User-Agent` or the presence of an `Origin` | `pipeline.db.test.ts` block "decision D69" (4 tests) |
| Contract row F-8 (six operations with no denied case in seeded data) | Denied in the clone by taking a grant away as `dems_owner` (the role set is closed by a CHECK, so no test role can be added) | `denial.db.test.ts` "a changed GRANT applies to the next request too …" (`listEvidence`, `runDiagnostics`); `decision.test.ts` "F-8 of the contract row …" (all six) |

## 16. What the specification left open, and this row's choices

| # | Open point | Choice |
|--:|---|---|
| 1 | `details.permission` of an any-of refusal | `A_OR_B` (section 6) |
| 2 | Where the truth of a permission is at request time | The principal's permissions as stage 4 read them (section 3) |
| 3 | The socket route and the guard | The one fixed rule outside the registry: open at the handshake, no row (section 4) |
| 4 | Who writes the `EXPORT_DENIED` row of a caller without the permission | The guard, with the event, before the body is read; the hosted action is not reached |
| 5 | The evidence ID of that row | The path's ID when it has the registry's form, else none |
| 6 | Which operations a retired device may still call | `getServiceHealth`, `redeemPairingCode` and the socket handshake (spec §6.6); 403 with its row on every other one, `signIn` and `getSignInStatus` included (D78) |
| 7 | The 401 text of a DEVICE operation | "This operation needs the credential of a paired device." (the contract's example); "Sign in first." elsewhere |
| 8 | A device-only operation called from a web session | 403 `DEVICE_NOT_PAIRED`, no row (spec §7.2), text "This operation is available on a paired device only." |
| 9 | The order of the conditions | Principal, permission, `DEVICE_NOT_PAIRED`, `DEMO_DISABLED` (spec §7.3 line 7) |
| 10 | Whether an unaudited 403 is logged | One `warn` line for every 403 of the guard, with the code, the operation, the rule and `audited`; none for a 401 |
| 11 | A denial whose row cannot be written | Refused all the same: 503 or 500, never let through |
| 12 | The position of the matrix step | After `engine.rehydrate` (section 5) |
| 13 | What the boot step checks of the grants | Nothing: the vocabulary must be exact, the grants are data |
| 14 | A route added before the plugins ran | Stopped by the boot step; refused with 500 at request time in an app that is never booted (section 4.1) |
| 15 | Severity of a denial row | WARNING, as the simulator's `EXPORT_DENIED` |
| 16 | Order of the grants in the answer of operation 10 | Role, then permission, each by its stored `sort_order` |

## 17. Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-1 | 12 test files of other rows relied on the stub at stage 6 | Section 14 | Adapted under D82 |
| F-2 | The engine row's log test allows a closed set of log keys for every line of a booted app | `src/engine/__tests__/commands.db.test.ts:715-729` | A boot step of any later row that logs a new key fails that test. This row logs nothing on a pass |
| F-3 | **The any-of permission has three spellings.** The registry's marker `ANY-OF(A, B)`, the simulator's `A \| B` (`sim/auth.ts:88`), and now the server's `A_OR_B`. The Live source uses `details.permission` when the answer has it (`live/source/rebuild-error.ts:111`), so in Live mode `SimPermissionError.permission` of a refused `setStoragePolicy` is `EVIDENCE_REVIEW_OR_MAINTENANCE`, in Simulated mode `EVIDENCE_REVIEW \| MAINTENANCE`. The web's `requiredRoleFor` finds a role for neither (`use-sim-command.ts:31`), so the toast is the same | reading; not run in a client | Decision DN-1 |
| F-4 | The contract's example of `getRoleMatrix` lists SUPERVISOR's grants in the order of the shared `ROLE_PERMISSIONS` array; the server answers in the stored order. Same 18 grants | `administration.ts:291-293`; `matrix.db.test.ts` compares them as sets | CONTRACT-GAP-6, example text only |
| F-5 | The identity routes' own checks hide a defect of stage 6 from an HTTP test of operations 2 to 6 | Mutation M45 survived the first pass; M03 (AUTHENTICATED lets everybody through) failed a single database test | Section 9; decision DN-8 |
| F-6 | Fastify gives back no configuration of a registered route (`findRoute`), and the flat printed table drops the prefix of a wildcard route | Section 4.1 | The `operationId` of a route the guard was never shown is checked at its first request, not at boot |
| F-7 | **While an operator holds 20 refusals, every REST request of that operator answers 429, allowed ones included, for up to 60 s** (as ID-P13 says). Twenty clicks on a control the role may not use lock the operator out of everything but health for the rest of the window | `denial.db.test.ts` "100 denied calls within 10 s …": the allowed `setStoragePolicy` answers 429 with `retry-after: 50` | As specified. For the client rows: a 429 after refusals needs its own wording (LB-10), and a client should not offer a control the session's permissions exclude |
| F-8 | A request with an `Upgrade` header is not blocked by stage 5's budget check, and still cannot write more than 20 rows: `consume` refuses the 21st | `denial.db.test.ts` "a request with an Upgrade header is not blocked by the budget check of stage 5, and still cannot write a 21st row …": 25 calls, 20 × 403, 5 × 429, 20 rows | The bound of SR-71 holds for every request form |
| F-9 | The guard's `EXPORT_DENIED` row names the device of the session; the simulator's names none. The details gain `operationId` and `permission` | `denial.test.ts` block "RB-5" | Additive; the custody view reads `evidenceId`, `details.scope` and `details.role`, which are as before |
| F-10 | The stored vocabulary must be EXACTLY the shared one for the server to boot. A permission or a role added to the shared vocabulary needs a seed or a migration of `permissions` or `roles` in every database (`dems_demo`, the lanes) before the next start | `matrix.ts` `checkStoredMatrix`; `matrix.db.test.ts` block "a boot that the matrix step stops" | By design (fail closed). For any later row that adds a permission |
| F-11 | A failed denial write answers 500 when the insert itself fails and 503 when the database does not answer | `guard.test.ts` "a denial whose row cannot be written is still refused …" | Either way refused; the difference is the core's error classes |
| F-12 | The test support of the identity row and of this row import each other (`identityApp` uses `passScratchRoutes`; `guardApp` uses the identity row's sign-in helpers) | `support.ts` of both folders | Test files only; both use the other at call time. If it ever bites, the sign-in helpers move into a third file |
| F-13 | No `SCHEMA-GAP`, no `SIM-GAP`. The audit writer's list for `ACCESS_DENIED` had every key this row needs | `access-rules.test.ts` "is a value the audit writer accepts …"; `denial.test.ts` "for every operation and every role …" (129 rows checked) | — |

## 18. Deviations from the row text

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | Rule 3 of the brief says the role holds a permission "per the loaded matrix". The decision uses the permissions stage 4 read for the request; the loaded matrix decides nothing | RB-2, RB-3, SR-13; rule 4 of the brief asks for one answer (section 3) |
| DV-2 | Ten test files of other rows were edited | Ruling D82 (section 14) |
| DV-3 | No stub assertion was deleted in `readiness.test.ts` | None of this row's existed |
| DV-4 | `checkRouter` and `router-table.ts` are not in the brief | Ruling D82, condition 4 |
| DV-5 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes them (P8) |
| DV-6 | The second half of AC-B-75 (five retired credentials, at most 20 rows) is tested here although it is the pairing row's | It costs one test with the registry stand-in, and it is the guard that writes those rows |
| DV-7 | Test support is exported for other rows (`guardApp`, `registryRoutes`, `passScratchRoutes`, `webOperator`, `deviceOperator`) | Every module row needs a signed-in operator in front of a guarded route |
| DV-8 | The upgrade cells of AC-B-74 and D69 are sent with `app.inject` to a stand-in for `GET /ws` | The socket route is the realtime row's (W42); stated as not proven in section 7 |

## 19. Decisions for the controller

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | The any-of form `A_OR_B` in the row and in the answer (section 6; F-3) | Accept, and give W83 the example text (CONTRACT-GAP-5). If the Live error should carry the simulator's spelling, the Live source maps it (`permissionsOfDenialCode(value).join(' \| ')`); the alternative, widening the audit writer's list to accept `A \| B`, puts a second spelling into the stored trail |
| DN-2 | The truth of a permission at request time is the principal's list; W33 calls nothing after a role change; `reloadMatrix()` is for W43 after a database swap (sections 3, 5) | Accept; tell W33 and W43 |
| DN-3 | `GET /ws` is the one route outside the registry that the guard accepts, with a fixed open rule (section 4) | Accept; tell W42: it registers the route and nothing else, and it must close a retired or unknown credential itself (4403, 4401) |
| DN-4 | The guard writes `EXPORT_DENIED` and its event for a caller without the permission, with the path's evidence ID when it has the right form (section 6) | Accept; tell W35 and W39 that their modules write no denial row and that a denied export never reaches the hosted action |
| DN-5 | A retired device may call `getServiceHealth`, `redeemPairingCode` and the socket handshake, and nothing else | Accept (spec §6.6, D78) |
| DN-6 | Where a route without a rule is stopped (section 4.1). `checkRouter()` could also run inside `ready()`: then `ready()` itself rejects for a top-level scratch route, and six of the set-ups of section 14 (rows 1 to 4, 7, 8) must replace the stage BEFORE `ready()` instead of after | Leave it in the boot step: the server's own start always runs the boot steps before it listens, and the patch of D82 stays as ruled. Decide in the code review (W38) if `ready()` should be the only gate |
| DN-7 | The stored vocabulary must be exact for the server to boot (F-10) | Accept; a later row that adds a permission plans its seed change with it |
| DN-8 | The identity routes' own `onRequest` checks (section 9; F-5) | Remove them in the code review W38; keep the two handler calls that return a value |
| DN-9 | CONTRACT-GAP-5 (the any-of example, section 6) and CONTRACT-GAP-6 (the order of the grants in the `getRoleMatrix` example, F-4) | Route both to W83; neither changes a schema |
| DN-10 | F-7: the budget of an operator also blocks that operator's allowed calls | As specified; note it for the client rows and the security review W45 |
| DN-11 | Pass to W32 to W43: section 8. Pass to W47: every refusal within the budget is audited, the 21st of a key within 60 s answers 429, so the matrix test resets the budget (`throttleControl(app).reset()`) or advances the clock after at most 20 denied cells of one key; `permissionsOfDenialCode` reads the any-of row. Pass to W52: `registeredRules()` against `rules.operationIds` | To record |

## 20. End state and cleanup

At 14:07:09 (a scratch script outside the repository, as `dems_owner`, through the test
helper's own reader of the connection file; it prints names and counts;
`implementation/assets/28_end_state.mts.txt`):

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_50_*): 0
test databases of all rows at this moment: 0
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
```

- `.locks/postgres.pid`: 19121, the process started 07:14:26, as before. PostgreSQL was never
  stopped or reconfigured. Nothing connected as the bootstrap superuser.
- `dems_demo` and the lane databases were never connected to by this row: every test ran on a
  clone of the helper (`DEMS_TEST_STEP=50`), and the four further clones of `matrix.db.test.ts`
  are dropped with their file.
- No port was bound and no process of this row is left: the two background commands (the
  mutation passes) ended by themselves. `apps/core-server/logs/` does not exist: a test that
  needs an error log file writes it under the system's temporary directory and removes it.
- `git diff --stat acaff20 -- apps/mock-core release scripts/release` prints nothing.
- Scratch files of the row were under the session's scratchpad, outside the repository. The
  proof copy of the workspace for section 14 and the mutation harness are removed (their links
  into the repository first, so that nothing of the repository was touched); the saved runner
  outputs remain there. What is evidence is kept as text under `implementation/assets/28_*`.

## 21. Rollback (R-NEW; not executed)

Pre-images, saved before the first edit of each file (file copies: `apps/core-server/` is
untracked):

| Pre-image under `.cache/rollback/` | Restores |
|---|---|
| `W28.permission-guard-index.ts.pre` | `src/plugins/permission-guard/index.ts` (the stub of W08) |
| `W28.rbac-index.ts.pre` | `src/modules/rbac/index.ts` (the stub of W08) |
| `W28.plugins-logger.log-capture.test.ts.pre`, `W28.modules-identity.tokens-cookie.test.ts.pre`, `W28.plugins-authenticate.authenticate.test.ts.pre`, `W28.plugins-error-envelope.error-envelope.test.ts.pre`, `W28.plugins-readiness.readiness.test.ts.pre`, `W28.plugins-origin-guard.guard-test-app.ts.pre`, `W28.plugins-response-headers.response-headers.test.ts.pre`, `W28.core.seeded.db.test.ts.pre`, `W28.engine.restart.db.test.ts.pre`, `W28.modules-identity.support.ts.pre` | the ten test files of section 14 |

Steps, in this order:

1. Reverse the patch of section 14: `git apply -R docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28_by_design_test_changes.patch`
   (or copy the ten pre-images back). It must be reversed together with step 2: two of its lines
   expect the boot step, and one imports this row's test support.
2. Copy the two stub pre-images back over the two `index.ts` files, and remove the files this row
   added: `access-rules.ts`, `decision.ts`, `denial.ts`, `matrix.ts`, `router-table.ts` and
   `__tests__/` under `src/plugins/permission-guard/`, and `__tests__/` under `src/modules/rbac/`.
3. Nothing else: no package, no schema, no contract file, no database and no host setting was
   changed by this row.

With the stubs back, every request passes stage 6 again: NOTHING IS PROTECTED, and the rows that
depend on this one (W32 to W43, W47, W52) lose their guard.

---

## Follow-up: tests that pinned the route list (decision D85)

This section also holds the item the controller added to the same follow-up: decision D88 DN-1,
the stored grants are asserted at boot and at a reload (F.6). Sources: review finding CPB1-1
(`gateway_check/04_cp_backend_foundation.md` §4.1), the reports of two module rows at 14:33, and
finding F65 of the storage row. Written 14:37 to 15:55 on 2026-10-04; all times WIB.

Where this section differs from sections 5, 11, 12 and 13 above (the state at 14:08), this
section holds. Section 5 is corrected in place, with a mark.

What changed, in one view:

| Item | Files changed | Production code |
|---|---|---|
| D85: the tests no longer depend on which modules have landed | 7 test files of this row changed, 2 added | None |
| D88: the stored grants must be exactly the shared role table | 4 production files and 5 test files of this row changed, 1 test file added | `matrix.ts`, `access-rules.ts`, `index.ts` of the plugin; the header of `modules/rbac/index.ts` |

No file of another row was written. No password, token, cookie value, hash or pairing code is in
this section or in its assets.

### F.1 What was wrong (D85)

The tests of this row were written when seven operations had a route. They pinned that moment in
five ways, and the first four broke when the module rows registered their routes:

| What the test did | Where (before) | What happened once modules registered routes |
|---|---|---|
| Compared the list of ALL registered operations with a fixed list of seven, and derived "the 68 without a route" from it | `guard.test.ts:131-139`, `:208` | `expected [ 'getServiceHealth', 'signIn', …(43) ] to deeply equal [ …(5) ]`; 68 was no longer the number |
| Registered a stand-in route for a registry operation on the real app | `support.ts:75-86` (`registryRoutes`), called at `guard.test.ts:192, :202, :283, :309, :376, :561`, `:297` and `:500` (by hand), `denial.db.test.ts:88-99`, `matrix.db.test.ts:79, :351` | `FST_ERR_DUPLICATED_ROUTE` in the set-up, as soon as the owning module had the route |
| Used two real operations as "operations whose route is NOT registered" | `boot-registry.test.ts:88-95` | Both are registered now, so the boot stopped where the test expected it not to |
| Expected one code as the FIRST problem of an empty matrix | `modules/rbac/__tests__/routes.test.ts:187` | With routes that name permissions, `PERMISSION_NOT_STORED` comes first |
| Pinned the whole list of passed boot steps (finding CPB1-13) | `modules/rbac/__tests__/matrix.db.test.ts:48, :95, :353, :389` | Not red yet; it would be with the next row that adds a boot step |

Measured on the tree at 14:37:48, before the first edit: `unit`, this row's files: 3 files
failed, 20 tests failed, 122 passed (142); at 14:41:08 `db`, this row's files: 2 files failed in
their set-up (`denial.db.test.ts`, `matrix.db.test.ts`), 53 tests skipped, 58 passed.

### F.2 The design that was chosen, per test group (D85)

The controller offered (A) stand-ins only where the app has no route, and (B) the reviewer's: the
app under test built without the domain modules. Criterion: green now, still green when the next
module lands, and no loss of what the tests prove. The choice is a mix:

| Test group | Files | App | Why |
|---|---|---|---|
| The stage in the pipeline: one row per refusal, the budget, the body, the boot check, early routes, the full registry under the guard, `passScratchRoutes` | `guard.test.ts` | **(B)** without the domain modules | These tests need a handler that says "reached" and a route they may register in a wrong form. Without the domain modules no stand-in can ever stand beside a module's route, and the tests stay as they were accepted, assertion for assertion |
| Stages 3 to 6 against PostgreSQL: the decision table, the denial rows, the budget, a role change, the boot step | `pipeline.db.test.ts`, `denial.db.test.ts`, `matrix.db.test.ts` | **(B)** | The same, and a permitted call must end in a stand-in: a module's real handler would change the clone (a role, a policy, a pairing code) under the next test. Every STAGE is still the server's own |
| A registry entry without a rule stops the boot | `boot-registry.test.ts` | **(B)** | Its routes are those of the units that are always there (health, the identity core, this module); the "operation without a route" is now an entry the file adds to the table |
| **(A)** as the second line, in all of the above | `support.ts` `registryRoutes`, `channelRoute` | (as above) | A stand-in is added only where `app.hasRoute(…)` finds none. (B) cannot take out the biometric operations, which will be registered by the identity module (W41), a unit these tests need |
| What the server REALLY registers, and that stage 6 stands in front of each of those routes | `registered-routes.test.ts` (new) | **the real app**, every module as it is in the tree | Everything is derived from `permissionGuard(app).registeredRules()`; no operation of a module is named, nothing is counted, no route is added. It asks only what does not depend on a handler |
| Operation 10 against the registry (MODG), a failed read, an empty matrix, a matrix with other grants | `modules/rbac/__tests__/routes.test.ts` | the real app | It calls this module's own route only; the one assertion that depended on other modules is now a "contains" |
| The rules, the decision table over all 75 operations, the rows, the check of a stored matrix, the static guards | `access-rules.test.ts`, `decision.test.ts`, `denial.test.ts`, `matrix.test.ts` (new, F.6), `static.test.ts` | no app | Unchanged by D85 |

How (B) is done: `src/plugins/permission-guard/__tests__/without-domain-modules.ts`, imported as
the FIRST import of a test file. It replaces the unit of each of the eleven domain modules and of
the realtime channel by one that adds no route (`vi.mock` of the module's `index.ts`; every other
export of the module is kept; `pairing` still provides `deviceResolver`, the realtime unit
`publish`). `app.ts` is not touched and has no new option. The first test of `guard.test.ts`
asserts that it took effect: every registered operation is one of health, the identity area or
operation 10.

Rule M10 with its addition (finding CPB1-1) holds in every file: no assertion on the total list
of registered routes or of boot steps, and no stand-in route for a registry operation on the real
app. `registered-routes.test.ts`, the one file on the real app that sends requests to module
routes, registers nothing.

### F.3 Every change of D85, before and after

The whole diff: `implementation/assets/28b_route_list_follow_up.patch` (7 files, 284 lines added,
75 removed) against the pre-images `.cache/rollback/W28b.*.pre`. Two files are new. The line
numbers are those of the tree at the end of this follow-up (the D88 edits of F.6 moved some).

| # | File and lines (after) | Before | After |
|--:|---|---|---|
| 1 | `guard.test.ts:1-13` | Header; no module is taken out | Header says what the file's app is; `import './without-domain-modules';` as the first import |
| 2 | `guard.test.ts:148-153` | `REGISTERED_NOW` = seven names; `NOT_YET_REGISTERED` = the registry without them | `ALL_OPERATIONS` (the registry); `NEEDED_HERE` (the seven operations this row's tests call on the real units); `OF_THE_REAL_UNITS` (health, the identity AREA of the registry, operation 10) |
| 3 | `guard.test.ts:156-173` | `expect(registered ids).toEqual(REGISTERED_NOW)` | No list: no problems; none twice; each rule IS `rules.ruleOf(id)` at its registry method and path; the seven of `NEEDED_HERE` are among them; none is outside the three real units |
| 4 | `guard.test.ts:236-260` | "all 68 of them": stand-ins for `NOT_YET_REGISTERED`, `toHaveLength(68)`, a stand-in for `/ws` by hand | "EVERY operation of the registry can be registered under the guard": `registryRoutes(instance, ALL_OPERATIONS)` adds a stand-in where the app has no route and returns which; registered = the registry + the socket, each once, each with its registry rule; stand-ins + the real units' routes = the registry, no operation in both. No count of stand-ins |
| 5 | `guard.test.ts:355-366` | The printed table: stand-ins for `NOT_YET_REGISTERED`, `toHaveLength(76)` | Stand-ins where no route is; length = the registry + 1 |
| 6 | `support.ts:1-38` | Header | Header states the two kinds of test app and the rule for each (its final wording was written with F.6: comments only, in `28c_stored_grants_d88.patch`) |
| 7 | `support.ts:88-114` | `registryRoutes` registers every named operation; returns `reached` | Skips an operation that has a route (`app.hasRoute`); returns the operations it added a stand-in for |
| 8 | `support.ts:116-158` | (not there) | `channelRoute` (the socket stand-in, only where none is), `recordPassed` with `PassedRequest` (a `preParsing` hook: what stage 6 let through), `MALFORMED_JSON` |
| 9 | `support.ts:162-249` | `GuardApp { reached, devices }` | + `standIns`, `passed`; `buildGuardApp` records what passed and which stand-ins were added |
| 10 | `boot-registry.test.ts:6-11` | Real app | `import './without-domain-modules';` and the reason |
| 11 | `boot-registry.test.ts:96-127` | `without('listUsers', 'audit'); without('startSession', 'access');` as the unregistered operations | Two entries the file adds to the table (`w28NoRouteRead` without its audit rule, `w28NoRouteCommand` without its access rule): the boot passes, the rule book names each defect. One test more: the same entry WITH a route stops the boot (`AUDIT_RULE_MISSING`) |
| 12 | `denial.db.test.ts:3-16` | Header; real app | Header; `import './without-domain-modules';`. No other line changed: its 29 tests are as accepted |
| 13 | `pipeline.db.test.ts:6-18` | Header; real app | Header; `import './without-domain-modules';` |
| 14 | `pipeline.db.test.ts:73-90` | A stand-in for `/ws` by hand, whose handler answered the principal | `channelRoute(instance)`; `handshake(headers)` reads who stage 4 made of the caller from `guard.passed` |
| 15 | `pipeline.db.test.ts:356-380` | Seven assertions on the stand-in's body (`{ principal: … }`) | The same seven on `handshake(…)`: `[200, 'OPERATOR']`, `[200, 'DEVICE']`, `[200, 'ANONYMOUS']`; one more: a refused handshake request never passed stage 6 (`[403, null]`) |
| 16 | `matrix.db.test.ts:5-13` | Header; real app | Header; the import |
| 17 | `matrix.db.test.ts:54-55`, `:101-111` | `BOOT_STEPS` = eleven names; `expect(passed).toEqual(BOOT_STEPS)` | `STEPS_BEFORE` = the ten steps this row's step comes after; `rbac.matrix` passed once, and after each of them (CPB1-13) |
| 18 | `matrix.db.test.ts:414-446` | Passed steps `toEqual(BOOT_STEPS.slice(0, -1))`; the problems = exactly `listUsers`, `assignUserRole`, the mismatch | Passed steps contain `STEPS_BEFORE` and not `rbac.matrix`; the problems = one for every registered route that names `USER_ADMIN`, read from the app, then the mismatch; `listUsers` among them |
| 19 | `matrix.db.test.ts:448-457`, `:484-498` | (no premise); passed steps `toEqual(…)` | The premise is asserted (no registered route names `DEMO_CONTROL`); passed steps as in 18 |
| 20 | `modules/rbac/__tests__/routes.test.ts:12`, `:184-207` | `rejects.toMatchObject({ code: 'STORED_MATRIX_MISMATCH' })` | The problems CONTAIN the two mismatches of the vocabulary (roles, permissions); every other problem is `PERMISSION_NOT_STORED` for a permission that a registered route names, read from the app |
| 21 | `without-domain-modules.ts` (new, 94 lines) | (not there) | Section F.2 |
| 22 | `registered-routes.test.ts` (new, 213 lines, 6 tests) | (not there) | Section F.4 |

### F.4 Which test now proves what (D85)

| What must be proven | Before | Now |
|---|---|---|
| Every registered route is a registry operation with its rules | `guard.test.ts` on the real app, with a pinned list | `registered-routes.test.ts` "every one is a registry operation at its registry route, with the rule of its registry entry, and none is there twice" (the real app, derived); `guard.test.ts` first test (the app without the domain modules) |
| Every operation of the registry can stand under the guard | "all 68 of them" | `guard.test.ts` "EVERY operation of the registry can be registered under the guard …" (75 and the socket, by `hasRoute`) |
| The router walk finds what the boot check was shown | `guard.test.ts` (76 routes) | the same test without the count; and `registered-routes.test.ts` "the walk of the router finds exactly the routes the boot check was shown, and passes" on the real app |
| Stage 6 stands in front of the routes the MODULES registered | not tested (no module had a route) | `registered-routes.test.ts`, four tests over every registered operation: nobody gets 401 and no row; a role without the permission gets 403 with the three details and exactly one row, before the handler; a role with it passes stage 6 on every command (400 for a body that is no JSON; a demo operation 403 `DEMO_DISABLED`); a retired device gets 403 with one row except where it may call |
| An entry whose route is not registered does not stop the boot | two real operations | two entries of the file's own; and the reverse case, the same entry with a route |
| One row per refusal, the budget, the body, the any-of, the exports, a role change, the HTTP table | 29 + 58 + 29 tests | the same tests, unchanged in their assertions, in an app that cannot collide |
| The socket route passes stage 6 for every caller | a stand-in's own answer | the record of what passed stage 6 |
| The matrix step runs after the engine's and stops the boot | a pinned list | order and membership |

### F.5 Still green when the next module lands (proof)

A scratch copy of the workspace under the session's scratchpad, taken at 14:50. In the copy every
operation that had no route got a REAL one, from the unit that will own it, with a handler of its
own (it answers 418):

| Unit in the copy | Routes added |
|---|---|
| `modules/system` | `getSystemStatus`, `runDiagnostics`, `restartServices`, `startSoftwareUpdate`, `updateSettings` |
| `modules/alerts` | `listAlerts`, `acknowledgeAlert` |
| `modules/security-audit` | `getSecurityStatus`, `listAuditRows`, `verifyAuditChain`, `exportAudit`, `exportLogs`, `listEvents` |
| `modules/demo` | the five demo operations |
| `modules/identity` (the biometric row, W41) | `setBiometricEnrollment`, `signInWithBiometric`, `reportBiometricFailure` |
| `realtime` (W42) | `GET /ws` |

A scratch script on the copy, at 14:51 and at 15:49: `registered in the scratch copy: 76 | not registered: (none) | socket: true`.
The tree at 14:51 and again at 15:26:09: 54 operations registered, 21 not (the 21 of the table
above), no socket route, `problems []`.

This row's files in the copy, run with the tests of D85 (14:51) and again with the final state of
the two folders, F.6 included (15:49; the copy of the two folders was compared with the tree
first: no difference):

```
14:51:09  unit, src/plugins/permission-guard src/modules/rbac            (the D85 state)
 Test Files  8 passed (8)
      Tests  149 passed (149)
14:51:23  db, the same two folders (DEMS_TEST_STEP=50b)
 Test Files  3 passed (3)
      Tests  111 passed (111)
[test:db] teardown: dropped 2 database(s) in 78 ms; 0 remain with the run prefix dems_test_step_50b_tmdhtocr_

15:49:27  unit, the same two folders, --maxWorkers=2                     (the final state)
 Test Files  9 passed (9)
      Tests  162 passed (162)
15:49:32  db, the same two folders (DEMS_TEST_STEP=50b), --maxWorkers=2
 Test Files  3 passed (3)
      Tests  115 passed (115)
[test:db] teardown: dropped 2 database(s) in 72 ms; 0 remain with the run prefix dems_test_step_50b_tmdkigv7_
```

So with ALL 75 operations and the socket route registered by their units, every file of this row
passes. The identity unit is not taken out by (B), so its three new routes were really there in
the (B) files: `registryRoutes` skipped them. The copy is removed (F.10).

Not proven: a module whose unit does not load at all (an import error in a file a row is
writing). `without-domain-modules.ts` falls back to the stub alone for such a module; the two
real-app files of this row would be red with every other test that builds the real app.

### F.6 Decision D88 DN-1: the stored grants are asserted at boot and at a reload

Finding F65 of the storage row: stage 6 decides from PostgreSQL, the hosted simulator's own
checks decide from the shared table. With a stored grant that the shared table lacks, a call
passes the guard and is refused by the hosted action with 403 and NO audit row. Ruling: the boot
step also asserts that the stored grants equal the shared table exactly; `reloadMatrix()` applies
the same assertion.

**The one source.** `ROLE_PERMISSIONS` of `@dems/shared/sim`
(`packages/shared/src/sim/auth.ts:53`), the table that the simulator's check `roleHas` reads
(`auth.ts:74-76`). `matrix.ts:20` imports it; no grant is typed in this row's production code.
A static test holds that: the name of the table occurs in one production file of the two
folders, imported from `@dems/shared/sim`, and no role is named in the code of the two folders
(`static.test.ts:143-153`, with a positive control).

**What is asserted** (`matrix.ts:109-122` `firstGrantDifference`, called from
`checkStoredMatrix` at `matrix.ts:163-173`): the stored `(role, permission)` pairs are the same
SET as the pairs of the shared table; the stored order does not matter. Today that is 18 pairs;
the number is not in the code.

**Where it runs.** In `permissionGuard(app).reloadMatrix()` (`index.ts:355-375`), which the boot
step `rbac.matrix` calls after `checkRouter()` (`modules/rbac/index.ts:58-59`) and which the
reset row calls after a database swap. Nowhere else.

**What stops, and what is said.** One problem, the FIRST difference only:

| Member | Value |
|---|---|
| Thrown | `AccessRuleError`, `code: 'STORED_GRANTS_MISMATCH'` (`access-rules.ts:61`); at boot it is the `cause` of the `BootError` with `stepId: 'rbac.matrix'`, and the server does not listen |
| `problems` | exactly one: `{ code: 'STORED_GRANTS_MISMATCH', operationId: null, route: null, detail }` |
| `detail` | `missing grant: <ROLE> <PERMISSION>` (the shared table has it, it is not stored) or `extra grant: <ROLE> <PERMISSION>` (it is stored, the shared table lacks it) |
| Order of "first" | every missing grant, by role and then by permission in the order of the vocabulary; then every extra grant, in the stored order |
| Log line | level 50, `code`, `problems` (the one problem), message `the stored role matrix does not fit the access rules` |
| Persistent error log | level `fatal`, source `permissionGuard.reloadMatrix`, `code`, `context: { codes, operations: '', routes: '', details }` where `details` is the one `detail` |
| `matrix()` | unchanged: the last matrix that passed, or null at a boot |

Nothing else of the matrix is logged or thrown: no other grant, no list, no count. The role and
the permission in `detail` are always names of the shared vocabulary, never free text from the
database: the grants are compared only once the stored roles and the stored permissions ARE the
shared vocabulary (`matrix.ts:163`), and `role_permissions` references those two tables. When
the vocabulary differs, that difference is the cause and is what is reported
(`STORED_MATRIX_MISMATCH`, as before), without a second problem for the grants that follow from it.

**It is a check at boot and at a reload, not per request.** The decision of a request still uses
the permissions that stage 4 read with that request (section 3). So a grant that is changed in a
RUNNING server still decides the next request, both ways, with no reload and no restart, exactly
as before D88; a reload or a boot after such a change is refused. Tested:
`matrix.db.test.ts:372-387` (the technician's `setStoragePolicy`: 200, then 403 `NOT_PERMITTED`
once the grant is deleted, a reload then rejects with `missing grant: TECHNICIAN MAINTENANCE`,
then 200 again and a reload that passes once it is restored). The tests of other rows that
change a grant after the boot are untouched and green: `src/modules/storage/__tests__/storage.db.test.ts`
(1 file, 18 tests, exit 0 at 15:20:51 and at 15:47:50, not edited), and those of the evidence,
administration and devices rows, which change a grant after their boot as well, in the whole
`db` run of F.7.

**Every change of D88, before and after.** The diff:
`implementation/assets/28c_stored_grants_d88.patch` (10 files, 382 lines added, 37 removed)
against the pre-images `.cache/rollback/W28c.*.pre` (the state after D85).

| # | File and lines (after) | Before | After |
|--:|---|---|---|
| D1 | `access-rules.ts:60-61` | (not there) | `STORED_GRANTS_MISMATCH` in `AccessRuleErrorCode`, with its description |
| D2 | `matrix.ts:7-10` | "the stored vocabulary must be exactly the shared one, and every permission that the access rule of a registered route names must be stored" | The same, "and the stored grants must be exactly the shared role table (decision D88)"; `reloadMatrix()` is named beside the boot step |
| D3 | `matrix.ts:20` | `import { OperatorRole, Permission } from '@dems/shared/sim';` | `import { OperatorRole, Permission, ROLE_PERMISSIONS } from '@dems/shared/sim';` |
| D4 | `matrix.ts:94-122` | (not there) | `GrantDifference { direction: 'missing' \| 'extra'; role; permission }` and `firstGrantDifference(grants)`. The role of a stored grant is looked up among the table's OWN members (`Object.hasOwn`, `:118`): a role named `constructor` is an extra grant, not an error of the lookup |
| D5 | `matrix.ts:124-141` | "Which role holds which permission is NOT checked: the grants are data (spec §4.4), the seed writes them, and the test of AC-B-17 compares them with the shared table." | Three checks; why the third; only the first difference; only once the vocabulary is the shared one; "a check at boot and at a reload … not asked per request" |
| D6 | `matrix.ts:163-173` | (not there) | The third check: one problem `STORED_GRANTS_MISMATCH` with the detail of the table above |
| D7 | `index.ts:125`, `:128` | (not there) | `firstGrantDifference` and `type GrantDifference` exported |
| D8 | `index.ts:162-167` | The comment of `reloadMatrix`: rejects for the vocabulary or a permission that is not stored | Adds the grants, and that the last matrix that passed stays in `matrix()` |
| D9 | `index.ts:209-223` | `problemContext(problems)` gave `{ operations, routes, codes }` to the persistent error log | `{ codes, operations, routes, details }`: what each problem says, joined with `; `. Without it the error log of a grant difference held the code only, and the ruling asks for the role, the permission and the direction. It also applies to route problems (F.9, FDV-2) |
| D10 | `modules/rbac/index.ts:17-22` | Header: the step stops the boot for the vocabulary or a permission that is not stored | Adds the grants and the reason (decision D88) |
| D11 | `guard.test.ts:191-196` | `context: { codes: 'ROUTE_WITHOUT_RULES', operations: '', routes: 'GET /api/v1/scratch' }` | The same with `details: 'the route is no operation of the contract registry: it has no access rule and no audit rule'` (follows from D9) |
| D12 | `matrix.test.ts` (new, 136 lines, 11 tests) | (not there) | The check as a pure function: see the test table below |
| D13 | `static.test.ts:46-47`, `:143-153` | 13 tests | A fourteenth: one source for the grants, no role named in the two folders |
| D14 | `matrix.db.test.ts:319-411` | One test: "takes a changed grant, and keeps the last good matrix when the stored vocabulary no longer fits": after a deleted grant `reloadMatrix()` RESOLVED with 17 grants | Three tests: a reload reads anew and stamps, and REJECTS a missing and an extra grant, keeping the last good matrix, with the two log lines; the per-request test; the vocabulary test as it was |
| D15 | `matrix.db.test.ts:459-482` | (not there) | Two boot tests on clones whose grants were changed before the boot (one extra, one missing) |
| D16 | `modules/rbac/__tests__/routes.test.ts:6`, `:209-242` | Import of the type `OperatorRole`; (no test) | Import of `OperatorRole`, `Permission`; one test with the stand-in pool: the shared grants pass, one extra and one missing are refused, and what is logged |
| D17 | `support.ts:20-37`, `:95-97` | Comments | Comments only (item 6 of F.3) |

By design, one assertion of this row's own accepted tests was reversed (D14): a reload after a
deleted grant used to resolve and must now reject. Nothing else that was accepted was weakened.

**The tests of D88.**

| Test | File | Project | What it proves |
|---|---|---|---|
| "is the shared vocabulary with exactly the 18 grants of the shared role table, for the rules of all 75 operations"; "whatever the order the grants are stored in" | `matrix.test.ts` | unit | The matrix of the seed passes; the comparison is one of sets |
| "a stored grant the shared table lacks …"; "a grant of the shared table that is not stored …" | `matrix.test.ts` | unit | The code, and the detail with direction, role and permission, and nothing else |
| "only the FIRST difference is named …" | `matrix.test.ts` | unit | The order of "first"; one problem however many grants differ |
| "every single grant of the shared table is needed, and every single other pair is refused" | `matrix.test.ts` | unit | Each of the 18 pairs alone missing, and each of the 18 other pairs of 3 roles by 12 permissions alone extra, is found |
| "a grant of a role or a permission the vocabulary does not hold is an extra one" | `matrix.test.ts` | unit | No lookup of an unknown name passes, nor of a name every object answers to (`constructor`, `toString`, `__proto__`, `hasOwnProperty`) |
| "the grants are compared only once the vocabulary is the shared one …" | `matrix.test.ts` | unit | A vocabulary difference is reported alone |
| "decision D88: reloadMatrix refuses a matrix whose grants are not the shared role table, and passes the one that is" | `modules/rbac/__tests__/routes.test.ts` | unit | The reload entry on the real app; `matrix()` stays null; ONE log line, and no other role or permission in it |
| "decision D88: a clone whose grants were changed BEFORE the boot (one extra grant) does not boot …" | `matrix.db.test.ts` | db | `INSERT … ('INVESTIGATOR', 'MAINTENANCE')` as the owner in a clone, then the boot: stopped at `rbac.matrix` after the ten earlier steps, cause `STORED_GRANTS_MISMATCH` with `extra grant: INVESTIGATOR MAINTENANCE`, no listener, no matrix, one log line |
| "… (one missing grant) does not boot …" | `matrix.db.test.ts` | db | `DELETE … 'SUPERVISOR', 'EVIDENCE_EXPORT'`: the same, `missing grant: SUPERVISOR EVIDENCE_EXPORT` |
| "reads the matrix anew and stamps it; decision D88: a grant that was changed is refused at the reload …" | `matrix.db.test.ts` | db | Against PostgreSQL: a reload passes and is stamped by the server clock; a missing and an extra grant are refused and the last good matrix is kept; the two log lines |
| "the grants assertion is a check at boot and at a reload, not per request …" | `matrix.db.test.ts` | db | The paragraph above |
| "decision D88: the grants the stored matrix is compared with have ONE source …" | `static.test.ts` | unit | The one source |

### F.7 Verification (the final state, D85 and D88 together)

Every command ran from the workspace root. `unit`, typecheck and lint ran inside the sandbox;
`db` ran with the per-command bypass (P10) and `DEMS_TEST_STEP=50b`. Every test run had
`--maxWorkers=2` (the controller's note on the load). Summary lines of all runs:
`implementation/assets/28c_final_runs.log`; the verbose lists of this row's tests:
`28c_test_unit_verbose.txt`, `28c_test_db_verbose.txt`.

| Check | Result | Time |
|---|---|---|
| This row's `unit` files: `npm run test -w @dems/core-server -- src/plugins/permission-guard src/modules/rbac --maxWorkers=2` | **Exit 0**: 9 files, 162 tests | 15:48:10 |
| This row's `db` files: `DEMS_TEST_STEP=50b npm run test:db -w @dems/core-server -- src/plugins/permission-guard src/modules/rbac --maxWorkers=2` | **Exit 0**: 3 files, 115 tests; forced drops that needed a retry: 0; 0 databases remain with the run prefix | 15:47:46 |
| The storage row's `db` file, not edited: `… -- src/modules/storage --maxWorkers=2` | **Exit 0**: 1 file, 18 tests | 15:20:51 and 15:47:50 |
| Whole `unit` project: `npm run test -w @dems/core-server -- --maxWorkers=2` | **Exit 0**: 102 files, 2,661 tests; again **exit 0**: 110 files, 2,776 tests (rows landed test files in between) | 15:43:06; 15:48:36 |
| Whole `db` project: `DEMS_TEST_STEP=50b npm run test:db -w @dems/core-server -- --maxWorkers=2` | First run **exit 1**: 2 files of another row failed (7 tests), 73 files and 1,074 tests passed: in-flight work, below. Second run **exit 0**: 80 files, 1,112 tests; forced drops that needed a retry: 0; 0 databases remain | 15:44:28; 15:47:21 |
| `npm run typecheck -w @dems/core-server` | **Exit 0** | 15:48:14 |
| `npm run lint -w @dems/core-server` | **Exit 0**, no finding | 15:48:14 |
| The proof copy of F.5, final state | unit 9 files / 162 tests, db 3 files / 115 tests, both exit 0 | 15:49:27; 15:49:32 |
| Mutation check (F.8) | 88 of 88 detected | 15:22:59 to 15:42:26 |

The state after D85 alone, before F.6, as it was reported to the controller when the three red
files turned green:

| Check (D85 state) | Result | Time |
|---|---|---|
| This row's `unit` files | Exit 0: 8 files, 149 tests | 14:49 |
| This row's `db` files, `DEMS_TEST_STEP=50b` | Exit 0: 3 files, 111 tests | 14:50 |
| Whole `unit` project | Exit 0: 96 files, 2,540 tests | 14:51:49 |
| Whole `db` project, `DEMS_TEST_STEP=50b` | Exit 0: 67 files, 1,006 tests; forced drops that needed a retry: 0; 0 databases remain with the run prefix `dems_test_step_50b_tmdhve66_` | 14:52:26 |
| Mutation check | 73 of 73 detected | 14:55:03 to 15:13:57 |

The final state, quoted:

```
15:48:08  unit, this row's two folders
 Test Files  9 passed (9)
      Tests  162 passed (162)

15:47:41  db, this row's two folders
 Test Files  3 passed (3)
      Tests  115 passed (115)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 80 ms; 0 remain with the run prefix dems_test_step_50b_tmdkfhkl_

15:48:15  unit, the whole project
 Test Files  110 passed (110)
      Tests  2776 passed (2776)

15:45:34  db, the whole project (second run)
 Test Files  80 passed (80)
      Tests  1112 passed (1112)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 304 ms; 0 remain with the run prefix dems_test_step_50b_tmdkbyr1_
```

**The red of the first whole `db` run (15:43:13 to 15:44:28), in-flight work of another row
(P11).** Not in this row's folders, and not touched:

```
 FAIL  |db| src/core/__tests__/boot-checks.db.test.ts > …   (6 tests)
 FAIL  |db| src/core/__tests__/seeded.db.test.ts > a seeded database > passes the nine boot checks in order; B-8 verifies every seeded row
TypeError: passedAmong is not a function
 Test Files  2 failed | 73 passed (75)
      Tests  7 failed | 1074 passed (1081)
```

`passedAmong` is a helper of `src/core/__tests__/support.ts`, the support file of the core row.
`src/core/**` is the folder the controller named as being changed by a second agent; files of it
were written at 15:37 to 15:42 (`src/core/types.ts` at 15:42:41, thirty seconds before the run).
The two files alone at 15:44:56: exit 0, 2 files, 8 tests. The whole project again at 15:45:34:
exit 0. The cause of the one red run was not established; that it came from the files being
written at that moment is a hypothesis. Every file of this row passed in both runs.

Test ledger (P24), this row's files in `@dems/core-server`:

| State | `unit` | `db` |
|---|---|---|
| At the gate of the row (14:08) | 7 files, 142 tests | 3 files, 111 tests |
| After D85 (14:50) | 8 files, 149 tests (+`registered-routes.test.ts` 6, +1 in `boot-registry.test.ts`) | 3 files, 111 tests |
| After D88 (15:48) | 9 files, 162 tests (+`matrix.test.ts` 11, +1 in `routes.test.ts`, +1 in `static.test.ts`) | 3 files, 115 tests (+4 in `matrix.db.test.ts`: the reload test became three, two boot tests) |

Per file now: `access-rules.test.ts` 35, `decision.test.ts` 28, `denial.test.ts` 17,
`static.test.ts` 14, `guard.test.ts` 29, `boot-registry.test.ts` 10, `registered-routes.test.ts` 6,
`matrix.test.ts` 11, `modules/rbac/__tests__/routes.test.ts` 12; `pipeline.db.test.ts` 58,
`denial.db.test.ts` 29, `modules/rbac/__tests__/matrix.db.test.ts` 28. No test was removed and
none is skipped.

### F.8 Mutation check with the changed tests

The harness of section 12, unchanged: a scratch Vitest configuration with ONE transform that hands
one production file to Vitest with one text replaced. No file of the workspace tree was mutated
(rule M15), so no other row's run could see a planted defect. The harness was outside the
repository and is removed; its configuration is byte for byte the asset
`28_mutation_harness.vitest.config.mjs.txt`, its two run scripts are
`28c_mutation_harness.run.sh.txt` and `28c_mutation_harness.run2.sh.txt`, the list is
`28c_mutations.json`.

| Run | Mutations | Against | Result |
|---|---|---|---|
| After D85, 14:55:03 to 15:13:57 | the 73 of section 12 | the tests of D85 (unit 149, db 111) | **73 of 73 detected**: 63 by a unit test, 10 by the `db` files only (M35, M44, M47, M63, M66 to M71). Log: `28b_mutations.log` |
| After D88, 15:22:59 to 15:40:11 | 87: the 73 and 14 new ones for the grants check (M74 to M87); both projects for each | the tests of D88 (unit 161, then 162; db 115) | **87 of 87 detected**: 61 by both projects, 17 by a unit test only, 9 by the `db` files only (M35, M44, M47, M66 to M71). Log: `28c_mutations.log` |
| Re-run on the final state, 15:40:34 to 15:42:26 | M01 to M40 (they had run before the last production edit, one line of `matrix.ts` at 15:31:21) and the new M88; `unit` first, `db` only where no unit test detects | the final state (unit 162, db 115) | **41 of 41 detected**: 40 by a unit test, M35 by the `db` files. Log: `28c_mutations_rerun.log` |

**Final: 88 of 88 planted defects are detected by the tests as they are now.** The base under the
harness with no mutation: unit 9 files / 161 tests and db 3 files / 115 tests, both exit 0
(15:23). M63 (a stored name the server does not know is accepted), which only a `db` test
detected before, is now detected by a unit test as well (`matrix.test.ts`).

The fifteen mutations of D88:

| ID | Planted defect | unit | db |
|---|---|---|---|
| M74 | The stored grants are not compared at all | 4 failed | 4 failed |
| M75 | A grant of the shared table that is not stored is accepted | 4 failed | 3 failed |
| M76 | A stored grant the shared table lacks is accepted | 5 failed | 2 failed |
| M77 | A missing grant is named as an extra one | 4 failed | 3 failed |
| M78 | The grants are compared although the vocabulary differs | 4 failed | 2 failed |
| M79 | A grant of a role the vocabulary does not hold is accepted | 1 failed | passed (the database cannot hold such a grant) |
| M80 | A grant difference carries the code of the vocabulary check | 3 failed | 4 failed |
| M81 | Only the first role is compared for missing grants | 3 failed | 2 failed |
| M82 | The difference names no permission | 3 failed | 4 failed |
| M83 | A refused matrix replaces the last good one | 2 failed | 5 failed |
| M84 | A refused matrix is logged and taken (the reload does not throw) | 2 failed | 7 failed |
| M85 | The persistent error log loses what the problems say | 1 failed | passed (asserted in `guard.test.ts` only) |
| M86 | The log line of a refused matrix lists the stored grants | 1 failed | 2 failed |
| M87 | Only the first 18 stored grants are compared for extra ones | 5 failed | 1 failed |
| M88 | The role of a stored grant is looked up among inherited members too (`constructor`, `toString`) | 1 failed | not run |

Not covered by a mutation: the static test of the one source (F.6). It reads the files on disk,
which the transform does not change; it has a positive control instead.

### F.9 Findings, deviations and decisions of the follow-up

| ID | Finding | Effect |
|---|---|---|
| FU-1 | `vi.mock` in a helper that a test file imports FIRST holds for the whole module graph of that file (Vitest 5.0.3): measured, `guard.test.ts` passes on a tree where 54 operations are registered by modules | One shared helper is enough; no mock lines in the test files. The import order is what makes it work, and the first test of `guard.test.ts` fails if it ever does not |
| FU-2 | (B) cannot take out a route that a unit the tests NEED registers: the biometric operations will come from the identity module | `registryRoutes` asks the app (`hasRoute`) as well; proven in the copy of F.5 |
| FU-3 | A top-level route (before the plugins run) cannot ask `hasRoute` for a module's route: none exists yet. A registry operation is registered there only in an app without its module | Stated in `registryRoutes`; the two tests that do it are in `guard.test.ts` (B) |
| FU-4 | The real server at 14:51 and at 15:26: 54 operations registered, all with their registry rule; for every one of them stage 6 refuses nobody's call, the call of a role without the permission and a retired device BEFORE the module's handler, with exactly one row where a row is due | `registered-routes.test.ts`; first evidence of the guard in front of the module rows' real routes. The matrix with real data and the allowed side of a GET stay with W47 |
| FU-5 | In-flight noise (P11), none in this row's folders: typecheck at 14:51:42 exit 2, one error in `src/modules/pairing/__tests__/routes.test.ts(184,94)`; lint at 14:51 exit 0 with 10 warnings in `src/modules/evidence/__tests__/*` (6) and `src/modules/pairing/__tests__/*` (4). Both were gone at 15:20: typecheck and lint exit 0 with no finding; at 15:43 to 15:44 one whole `db` run was red in two files of `src/core/__tests__/` (F.7), green alone at 15:44:56 and in the whole run of 15:45:34 | None |
| FU-6 | Not touched by this follow-up, and still open for a ruling: finding CPB1-5 (a replaced stage 6 lets `checkRouter` warn and return), CPB1-10 (this plugin imports the identity module's index), CPB1-24 (the boot step reads a printed table) | Production code of this row; unchanged |
| FU-7 | D88 closes the gap of F65 at a boot and at a reload only. A grant that is changed in a RUNNING server (by hand, as the owner: no operation of the server can, RB-9) is applied by stage 6 from the next request on, and nothing compares it with the shared table until the next boot or reload. In that window an extra grant still lets a call pass the guard and be refused by the hosted action without an audit row | As ruled ("a boot / reload check, not a per-request check"). The runtime role cannot write the three tables (SQLSTATE 42501, tested), so it takes the owner's hand. A periodic comparison would be a new decision |
| FU-8 | A database whose grants were edited no longer boots, and `reloadMatrix()` after a database swap rejects for it: the reset row (W43) must treat `STORED_GRANTS_MISMATCH` like `STORED_MATRIX_MISMATCH` (the swapped database is refused, the last good matrix stays) | For W43; `LoadedMatrix` and the signature of `reloadMatrix()` are unchanged |
| FU-9 | A later row that changes the shared role table must change the seed in the same step, or no database boots (as DN-7 of section 19 said for the vocabulary) | For every row that touches `ROLE_PERMISSIONS` |
| FU-10 | The message of an `AccessRuleError` reads `… STORED_GRANTS_MISMATCH : extra grant: …` for a problem without an operation and a route (a blank before the colon; the same form as `STORED_MATRIX_MISMATCH` had). Not changed here: cosmetic, and the tests read `code` and `problems` | None |

Deviations:

| ID | Deviation | Why |
|---|---|---|
| FDV-1 | The first design of the D85 fix (stand-ins everywhere by `hasRoute`, and synthetic operations through a mocked registry) was dropped after the controller's addition on CPB1-1; `guard.test.ts` was restored from its pre-image and edited again | Rule M10's addition: no stand-in for a registry operation on the real app |
| FDV-2 | D88 also changed what the persistent error log holds for ROUTE problems: its context gained `details` (D9). One accepted assertion of `guard.test.ts` gained that member (D11) | The ruling asks that the error names the role, the permission and the direction; the error log's context held codes, operations and routes only. `detail` texts are written by this row and hold identifiers, never anything a caller sent |
| FDV-3 | The new code `STORED_GRANTS_MISMATCH` instead of a new detail under `STORED_MATRIX_MISMATCH` | "a coded error naming the first difference": a boot that stops for an edited grant is told apart from one that stops for a missing vocabulary by its code alone |
| FDV-4 | Two edits were made while the mutation run of 15:22 to 15:40 was under way: the fourteenth static test (15:26:49; the unit totals of the log are 161 up to M16 and 162 from M17 on) and the own-member lookup in `matrix.ts` with its test lines (15:31:21, while M39 ran) | The first cannot hide a mutation. For the second, M01 to M40 were run again on the final state (F.8), so every one of the 88 results is of the final state |

Decisions for the controller to record:

| ID | Decision | Recommendation |
|---|---|---|
| FDN-1 | The test apps of this row: (B) for five files, (A) inside them as the second line, and one real-app file that derives everything (F.2) | Accept |
| FDN-2 | `without-domain-modules.ts` is test support other rows may import for an app without the domain modules; it is not for a test of what the server registers | Tell the module rows that still pin a route or a boot-step list |
| FDN-3 | D88 as built: code `STORED_GRANTS_MISMATCH`; detail `missing grant: ROLE PERMISSION` or `extra grant: ROLE PERMISSION`; first difference only; compared only when the vocabulary is the shared one; boot and reload only | Accept; tell W43 (FU-8) and the rows of FU-9 |
| FDN-4 | The error-log context of the guard's problem lists now has `details` (FDV-2) | Accept |
| FDN-5 | FU-7: the window between a hand edit of a grant in a running server and the next boot or reload | Accept as ruled, or rule a periodic comparison |

### F.10 End state, cleanup and rollback of the follow-up

End state at 15:48:55, read as `dems_owner` (names and counts only; the script is
`28c_end_state.mts.txt`):

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_50_* and dems_test_step_50b_*): 0
test databases of all rows at this moment: 0
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
```

`.locks/postgres.pid` is 19121, the process started 07:14:26: PostgreSQL was never stopped or
reconfigured. The tests ran on the helper's cloned databases only, and nothing connected as the
administrator role. The proof run of 15:49 after it left `0 remain with the run prefix
dems_test_step_50b_tmdkigv7_`.

Cleanup: the scratch copy of the workspace, the mutation harness and the two scratch trees used
to check the patches were under the session's scratchpad, outside the repository. Their links
into the workspace were removed first, then the folders; the linked folders of the workspace are
intact. No process of this row is left and no port was bound.

Files of the follow-up:

| Kind | Files |
|---|---|
| Production, changed (D88) | `src/plugins/permission-guard/access-rules.ts`, `matrix.ts`, `index.ts`; `src/modules/rbac/index.ts` (header) |
| Tests, changed | `src/plugins/permission-guard/__tests__/support.ts`, `guard.test.ts`, `boot-registry.test.ts`, `denial.db.test.ts`, `pipeline.db.test.ts`, `static.test.ts`; `src/modules/rbac/__tests__/matrix.db.test.ts`, `routes.test.ts` |
| Tests, added | `src/plugins/permission-guard/__tests__/without-domain-modules.ts`, `registered-routes.test.ts`, `matrix.test.ts` |
| Assets, under `implementation/assets/` | `28b_route_list_follow_up.patch`, `28b_mutations.log`, `28c_stored_grants_d88.patch`, `28c_mutations.json`, `28c_mutations.log`, `28c_mutations_rerun.log`, `28c_mutation_harness.run.sh.txt`, `28c_mutation_harness.run2.sh.txt`, `28c_test_unit_verbose.txt`, `28c_test_db_verbose.txt`, `28c_final_runs.log`, `28c_end_state.mts.txt` |
| Pre-images (P23; `apps/core-server` is not tracked) | `.cache/rollback/W28b.*.pre` (7: the state before D85), `.cache/rollback/W28c.*.pre` (9: the state before D88) |
| Not written | `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, any file of another row |

Rollback (not executed):

1. D88 alone: `patch -R -p1 < docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28c_stored_grants_d88.patch`
   from the workspace root, or copy the nine `W28c.*.pre` files back and remove `matrix.test.ts`.
   Checked in a scratch tree: the reversed patch gives the nine pre-images byte for byte. The
   server then boots again on a database whose grants differ from the shared table (finding F65
   is open again).
2. D85 as well: after step 1, `patch -R -p1 < …/28b_route_list_follow_up.patch`, or copy the
   seven `W28b.*.pre` files back, and remove `without-domain-modules.ts` and
   `registered-routes.test.ts`. This row's tests are then red again on a tree where modules have
   registered routes (F.1).
3. Nothing else: no package, no schema, no contract file, no database and no host setting was
   changed by the follow-up.

---

## Follow-up: the condition `DEVICE_CREDENTIAL` on operation 23 (CPS1-3, decisions D113, D118)

Finding CPS1-3 of the security checkpoint CP-S1 (`gateway_check/05_cp_access_control_security.md`):
a session token of a device, which ends when it is idle and at its absolute limit, could call
operation 23 `rotateDeviceCredential` and obtain a device credential that never expires. Ruling
D113: operation 23 needs the device's own credential, said in the registry, decided by stage 6.
Ruling D118: the same condition goes on operation 8 in a later step, by another row.

Written 2026-10-04, 19:22 to 19:58 WIB. Evidence tier 3. Every command ran from the workspace
root; database commands with the per-command sandbox bypass and `DEMS_TEST_STEP=50c`; every test
run with `--maxWorkers=2`. **No credential, token, code or hash is in this section or in its
assets**: tests compare stored bytes and print a yes or a no.

### G.1 What was landed, in one step

| Time | Action | Result |
|---|---|---|
| 19:23:47, 19:34:58 | `git apply --check docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/27c_condition_op23.patch` | exit 0, both times |
| 19:34:58 | 18 pre-images copied to `.cache/rollback/guard_condition_op23/` (the six files the patch writes among them) | 18 files |
| 19:34:58 | `git apply` of the same patch (plain: not `--index`; no other git write of any kind) | exit 0: `packages/shared/src/api/{contract-model,example-parts,pairing}.ts`, `packages/shared/test/{api-registry,api-openapi-scope}.test.ts`, `packages/shared/openapi/openapi.json` |
| 19:34:58 | The evaluation in three files of the guard, the tests, the specification (G.2 to G.6), by scripts that replace exact text and write nothing unless every text is found once | written |
| 19:35:08 | `npm run typecheck -w @dems/core-server` | **exit 0**, ten seconds after the patch |

The contract half is the contract owner's (`implementation/27_contract_c.md` section 15), applied
unchanged. `27c_condition_op8_addon.patch` was not applied, and nothing under
`src/modules/identity/**`, `src/realtime/**`, `src/core/**`, `src/engine/**`, `test/helpers/**`
or `test/acceptance/**` was written.

### G.2 The evaluation

It names no operation: whichever rule of the registry carries the condition gets the decision
(decision D118 needs no change of these files; a unit test puts the condition on each of the
other four `DEVICE` rules and gets the same answers, G.3).

| # | File and lines (after) | Before | After |
|--:|---|---|---|
| P1 | `permission-guard/decision.ts:17`, `:25-26`, `:29-41` | Header: an OPERATOR on a device is allowed on every `DEVICE` operation; "`CONSOLE_IDENTITY` and `DEVICE_SESSION` answer 403 `DEVICE_NOT_PAIRED` … None of the three writes a row" | The cell is `allow †` with its note; three conditions answer `DEVICE_NOT_PAIRED`, none of the four writes a row; what `DEVICE_CREDENTIAL` means and why; a condition without a case is never passed over |
| P2 | `decision.ts:67-70` | "403, no row: no console identity, or a device-only operation called by a web session" | The third case is named |
| P3 | `decision.ts:94-102` | `readonly cause: typeof CoreApiAccessCondition.CONSOLE_IDENTITY \| typeof CoreApiAccessCondition.DEVICE_SESSION \| 'DEVICE_OPERATION';` | The union gains `typeof CoreApiAccessCondition.DEVICE_CREDENTIAL` |
| P4 | `decision.ts:169-173` | (no case: `decideConditions` passed the condition over) | `case CoreApiAccessCondition.DEVICE_CREDENTIAL: if (principal.kind !== 'DEVICE') return refuse({ kind: AccessRefusalKind.DEVICE_NOT_PAIRED, cause: condition }); break;` |
| P5 | `decision.ts:177-181` | The `switch` had no `default` | `default`: the condition is typed `never` there, and it throws `the access rule of <operation> carries a condition that stage 6 does not evaluate: <condition>` (G.9, CF-2) |
| P6 | `permission-guard/denial.ts:20-26` | (not there) | Header: the three answers of `DEVICE_NOT_PAIRED`, none with a row or a place in the budget |
| P7 | `denial.ts:33` | `import { ApiErrorCode, CoreApiAccessCondition } from '@dems/shared/api';` | `… CoreApiAccessCondition, DEVICE_CREDENTIAL_REQUIRED_REASON } …` (the constant the patch exports) |
| P8 | `denial.ts:50-51` | (not there) | `const OWN_CREDENTIAL_TEXT = "This operation needs the device's own credential.";` |
| P9 | `denial.ts:69-73` | `return refusal.cause === CoreApiAccessCondition.CONSOLE_IDENTITY ? deviceNotPaired() : new ApiFailure(403, ApiErrorCode.DEVICE_NOT_PAIRED, DEVICE_ONLY_TEXT);` | The console rule as before; for the cause `DEVICE_CREDENTIAL`: `new ApiFailure(403, ApiErrorCode.DEVICE_NOT_PAIRED, OWN_CREDENTIAL_TEXT, { details: { reason: DEVICE_CREDENTIAL_REQUIRED_REASON } })`; every other cause as before |
| P10 | `permission-guard/index.ts:285-287` | `...(refusal.kind === AccessRefusalKind.DEVICE_NOT_PAIRED ? { cause: refusal.cause } : {}),` | The same member under the key `refusedBy` (G.9, CF-1) |

Not changed: `denialRecordOf` and `isAudited`. A `DEVICE_NOT_PAIRED` of any cause has no record,
so the stage takes no place in the denial budget and runs no unit of work for it (ruling on
FU-4). The order of stage 6 is as it was: a retired device, then the marker, then the permission,
then the conditions.

What operation 23 answers now:

| Caller | Before the step | After the step |
|---|---|---|
| The device, with its device credential | 200, the rotation | The same |
| The session token of an operator who is signed in on the device | **200: a new device credential** | **403 `DEVICE_NOT_PAIRED`**, message `This operation needs the device's own credential.`, `details: { reason: 'DEVICE_CREDENTIAL_REQUIRED' }`; decided before the body is read; no audit row, no place in the denial budget, nothing stored |
| A web console session | 403 `DEVICE_NOT_PAIRED`, `This operation is available on a paired device only.`, no details (the marker) | The same |
| No credential | 401 `NOT_SIGNED_IN` | The same |
| A retired device | 403 `DEVICE_REVOKED` with one `ACCESS_DENIED` row | The same: it is refused before the condition is looked at |

The log line of the refusal: level 40, `code: 'DEVICE_NOT_PAIRED'`, `operationId`, `access: 'DEVICE'`,
`refusedBy: 'DEVICE_CREDENTIAL'`, `audited: false`, the principal by reference. No member named
`reason`, `cause`, `error` or `e` (standing rule M14); `details.reason` is in the answer only.

### G.3 This row's tests

| File | Change | What it proves now |
|---|---|---|
| `__tests__/access-rules.test.ts:92-117` | The test of the conditions (was `:92-102`) | The rules carry exactly the conditions of the registry, in its order; `['rotateDeviceCredential', DEVICE_CREDENTIAL]` is among them, after `setBiometricEnrollment` and before the demo operations; every holder of the condition is a `DEVICE` rule; the seven other pairs are the closed list they were (G.9, CF-4) |
| `__tests__/decision.test.ts:63-68` | The model `expected()` | An operator on a device is refused on a `DEVICE` operation whose registry entry carries the condition: read from the registry, no operation named. It is the model of the 675-cell test |
| `__tests__/decision.test.ts:279-294` | "a DEVICE operation called by a web console session …" | Over the registry's `DEVICE` operations: a web session is refused by the marker, the device is allowed, an operator on the device is allowed unless the entry carries the condition |
| `__tests__/decision.test.ts:331-405` | Six tests added | Operation 23 carries the condition; the device holds it and no role's session on the device does, whatever it is granted, not audited; a retired device, no principal and a web session are answered by the marker first; the console identity and the demo flag change nothing; **decision D118**: the condition put on each other `DEVICE` rule decides the same way with no change of the source; a condition without a case throws |
| `__tests__/denial.test.ts:3-10`, `:120-145` | One test added | The answer: 403, the code, the text, `details.reason`; equal in code, message and details to the example the contract documents for operation 23, and valid against the contract; no record; a web session keeps the old text and no details; the answer depends on the cause, not on the operation |
| `__tests__/guard.test.ts:488` | `cause: 'CONSOLE_IDENTITY'` becomes `refusedBy: 'CONSOLE_IDENTITY'` | The log key (P10) |
| `__tests__/guard.test.ts:492-528` | One test added (the app without the domain modules, a stand-in for operation 23) | In the pipeline: the session of an operator on the device gets the 403 with its reason, the handler is not reached, no row, no unit of work, budget `used: 0`, one warn line with `refusedBy` and none of the four names; a web session gets the marker's answer; a retired device `DEVICE_REVOKED` with one row; the device reaches the handler |
| `__tests__/pipeline.db.test.ts:272` | `line['cause']` becomes `line['refusedBy']` | The log key (P10) |
| `__tests__/device-credential.db.test.ts` (new, 275 lines, 6 tests) | Added | Below |

`device-credential.db.test.ts` runs on **the real app**, every module as it is in the tree, on a
clone of the seed template as `dems_app`: the device is paired through the pairing module, the
operator signs in on it through the identity module, stages 3 to 6 are the server's own. It
registers no route and replaces no stage (rule M10).

| Test | What it proves |
|---|---|
| "the rule the server registered for operation 23 is the marker DEVICE with the condition, and no permission" | What the server applies is the registry's rule |
| "the session token of an operator who is signed in on the device is refused …" | Three attempts: each 403 `DEVICE_NOT_PAIRED` with the text and the reason, valid against the contract, the answer holds nothing but the error. **No row** (the trail has the same length), **no place** (`inspect('operator:<id>')` gives `used: 0`), **nothing changed** (the stored credential and its "next" are the same bytes, no rotation time, state `PAIRED`), the session still answers on `getAuthSession` and on `getDeviceRegistration`, the device credential still works. The log: three warn lines with `refusedBy: 'DEVICE_CREDENTIAL'`, none of the four names, no credential form. Positive control of "no place": an audited refusal of the same session (a read the role lacks the permission for, found in `registeredRules()`) takes one place and writes one row; one more rotation attempt adds neither |
| "the refusal is decided before the body is read, on every route the server registered with the condition …" | For every registered rule that carries the condition (found, not named): the session gets the 403 with a body that is no JSON; the device gets 400 `INVALID_JSON` from stage 7, so it passed stage 6 and no handler ran. Nothing written, nothing changed |
| "the device credential rotates: 200 and the one row of the rotation …" | 200, valid against the contract, one `DEVICE_CREDENTIAL_ROTATED` row, a "next" is stored; the open session of the device is untouched and still refused, and does not replace the pending credential; a device nobody is signed in on rotates too |
| "a web console session still gets the refusal of the marker DEVICE …" | 403 `DEVICE_NOT_PAIRED`, the old text, no details, no row, no place; the log says `refusedBy: 'DEVICE_OPERATION'` |
| "a retired device still gets 403 DEVICE_REVOKED with its one row …" | The order: after a revoke the device credential gets `DEVICE_REVOKED` with `details.reason: DEVICE_REVOKED` and one `ACCESS_DENIED` row naming operation 23; the former session never gets the condition's answer |

Test ledger (P24), this row's files: `unit` 9 files, 162 tests before and **170** after
(`decision.test.ts` 28 to 34, `denial.test.ts` 17 to 18, `guard.test.ts` 29 to 30); `db` 3 files,
115 tests before and **4 files, 121** after (the new file's 6). No test was removed or skipped.
One accepted assertion was reversed by design: `decision.test.ts` asserted that an operator on a
device is allowed on all five `DEVICE` operations; for operation 23 it is now refused.

### G.4 By-design changes in test files outside the guard's folder (granted)

| # | File and lines (after) | Before | After |
|--:|---|---|---|
| B1 | `src/modules/pairing/__tests__/routes.test.ts:128-131` (was `:128`) | `for (const operationId of DEVICE_ONLY) expect(rules.get(operationId), operationId).toMatchObject({ kind: CoreApiAccessKind.DEVICE, permissions: [], conditions: [] });` | A comment naming CPS1-3 and D113, and the same loop with `conditions: operationId === 'rotateDeviceCredential' ? ['DEVICE_CREDENTIAL'] : []` |
| B2 | `src/modules/pairing/__tests__/devices.db.test.ts:536-540` (was `:536-537`) | `// Through the operator's session of the device this time.` and `const second = ((await devicePost(pairing.app, ROTATE, token)).json() as { deviceCredential: string }).deviceCredential;` | `expect(outcomeOf(await devicePost(pairing.app, ROTATE, token))).toEqual([403, 'DEVICE_NOT_PAIRED']);` and then `const second = ((await devicePost(pairing.app, ROTATE, device.credential)).json() as { deviceCredential: string }).deviceCredential;` with two comments. The rest of the test is unchanged, so the second rotation still replaces the pending credential and the promotion is still tested |
| B3 | `src/modules/rbac/__tests__/matrix.db.test.ts:158-163` (was `:158`) | `if (access.kind === CoreApiAccessKind.DEVICE) return principal.deviceId === null ? 'DEVICE_NOT_PAIRED' : 'ALLOW';` | The model reads the condition: `const ownCredential = (access.conditions ?? []).includes(CoreApiAccessCondition.DEVICE_CREDENTIAL); return principal.deviceId === null \|\| ownCredential ? 'DEVICE_NOT_PAIRED' : 'ALLOW';` |
| B4 | `src/modules/pairing/__tests__/concurrency.db.test.ts:387-388` (after the old `:386`) | The list of racers ended with `devicePost(pairing.app, TOUCH, token),` | One racer appended at the end, so no index moved: `devicePost(pairing.app, ROTATE, device.credential),` with its comment |
| B5 | `concurrency.db.test.ts:396-400` (was `:394`) | `if (answer.statusCode === 403) expect(errorOf(answer).code).toBe('DEVICE_REVOKED');` | `if (index === 5) expect(answer.statusCode, 'a session token never rotates').not.toBe(200);` and `if (answer.statusCode === 403) expect(index === 5 ? ['DEVICE_REVOKED', 'DEVICE_NOT_PAIRED'] : ['DEVICE_REVOKED']).toContain(errorOf(answer).code);` with a comment: answer 5 is the rotation with the session token |
| B6 | `concurrency.db.test.ts:421-430` (after the old `:414`) | (not there) | For the appended racer: `expect([200, 403]).toContain(appended?.statusCode);` and, if it answered 200, the credential it returned is presented once on `getDeviceRegistration` and is refused: `[401, 403]`, a 403 being `DEVICE_REVOKED`. The value is never printed |

B4 to B6 were granted by the controller's ruling of about 19:37 on the red this row reported at
19:35:46 (`AssertionError: expected 'DEVICE_NOT_PAIRED' to be 'DEVICE_REVOKED'` at the old
`:394:67`): the test raced a rotation with the session token against the revoke. In B6 a 401 is
allowed beside `DEVICE_REVOKED` because two rotations with the device credential are in the race
(the old `:380` and the appended one): the later one replaces the pending credential of the
earlier, and a replaced value names no device any more. Nothing else in these four files was
changed.

### G.5 The specification (`masterplan/01_specs.md`): one rule, six lines

`git diff --stat`: 1 file changed, 6 insertions, 5 deletions. The line numbers of the grant
(read at 19:20) were checked and were right; the added line moved the others by one.

| Line (after; before) | Before | After |
|---|---|---|
| `:64` (new) | (the revision table ended with the row of revision 2.2) | One row: "Rule patch after the security checkpoint CP-S1 (the revision number is not raised): operation 23 … needs the device's own credential; a session token of the device is refused with 403 `DEVICE_NOT_PAIRED` and `details.reason: DEVICE_CREDENTIAL_REQUIRED`, without an audit row (registry condition `DEVICE_CREDENTIAL`)", naming CPS1-3, D113, D118 and sections 4.2, 6.3, 7.2, 7.7 |
| `:405` (`:404`), section 4.2, marker `DEVICE` | "… (biometric sign-in, its own registration, unpair, credential rotation)" | The same, then: "Credential rotation needs the device's own credential: the session of an OPERATOR bound to the device does not hold it (registry condition `DEVICE_CREDENTIAL`; finding CPS1-3, decision D113)" |
| `:654` (`:653`), section 6.3, T7 | Who: "The device"; note ends "A lost answer leaves the old one valid" | Who: "The device, with its own credential (not the session of an operator who is signed in on it)"; the note adds: "A session token of the device is refused with 403 `DEVICE_NOT_PAIRED` (`details.reason: DEVICE_CREDENTIAL_REQUIRED`), and nothing is stored" |
| `:660` (`:659`), section 6.3, the note on operation 23 | Ends "… revoking the device ends it [SDR:SD-29] (residual R-06)." | The same, then "**Who may rotate**": only the device itself, with the device credential as the bearer value; the session token is refused at stage 6 with the code and the reason, without an audit row and without a place in the denial budget, and why; the registry's condition |
| `:756` (`:755`), section 7.2, the code table | "… a device-only operation called by a web session" | The same, then: "an operation that needs the device's own credential, called with a session of the device (`details.reason: DEVICE_CREDENTIAL_REQUIRED`)" |
| `:860` (`:859`), section 7.7, row 23 | Access cell `` `DEVICE` `` | Access cell `` `DEVICE`; needs the device's own credential ``, exactly (checked by splitting the row into its cells). No other cell of the row changed |

Not changed, on purpose: the front matter (`revision: 2.2`, `last_updated`), the "specific
errors" cell of row 23, and `:802` (the order of stage 6), which already says "403
`DEVICE_NOT_PAIRED`" after the permission and holds for the new case.

### G.6 Verification

Summary lines of every run: `implementation/assets/28d_final_runs.log`. Verbose lists of this
row's tests: `28d_test_unit_verbose.txt`, `28d_test_db_verbose.txt`.

| Check | Result | Time |
|---|---|---|
| `npm run test -w @dems/shared -- --maxWorkers=2` | **Exit 0**: 68 files, 1,813 tests (as expected) | 19:36:27 |
| `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | **Exit 0**: "openapi.json is up to date (all (committed): 75 operations, 2 security schemes, version 0.2.0; offline: 10 operations, 0 security schemes, version 0.1.0)" | 19:36:27 |
| `npm run typecheck -w @dems/shared`; `npm run lint -w @dems/shared` | **Exit 0**; **exit 0**, no finding | 19:36:30 |
| `npm run typecheck -w @dems/core-web` | **Exit 0** | 19:36:47 |
| `npm run typecheck -w @dems/mobile` | **Exit 0** | 19:36:52 |
| `npm run typecheck -w @dems/core-server` | **Exit 0**, four times | 19:35:08, 19:36:59, 19:38:05, 19:48:25 |
| `npm run lint -w @dems/core-server` | **Exit 0**, no finding, three times | 19:35:21, 19:38:05, 19:48:25 |
| This row's `unit` files (`src/plugins/permission-guard src/modules/rbac`) | **Exit 0**: 9 files, 170 tests | 19:49:23 |
| The same with `src/modules/pairing/__tests__/routes.test.ts` and `test/static` | **Exit 0**: 19 files, 297 tests | 19:35:21, 19:48:18 |
| This row's `db` files, `DEMS_TEST_STEP=50c` | **Exit 0**: 4 files, 121 tests; forced drops that needed a retry: 0; 0 databases remain with the run prefix | 19:35:32, 19:47:57 |
| The pairing folder, `db` | Before the ruling on `concurrency.db.test.ts`: exit 1, 1 failed, 78 passed (19:35:46). After it: the changed test alone three times exit 0 (14 tests each), then the folder **exit 0**: 7 files, 79 tests | 19:38:15 to 19:38:31 |
| The two granted pairing `db` files, final | **Exit 0**: 2 files, 30 tests | 19:48:03 |
| ONE whole `unit` run of `@dems/core-server` | **Exit 0**: 146 files, 3,783 tests | 19:38:37 to 19:39:20 |
| ONE whole `db` run of `@dems/core-server` | **Exit 1**: 118 files, 2 failed (5 tests), 116 passed; 1,696 tests passed; forced drops that needed a retry: 0; 0 databases remain. Both failures are outside this row's folders and neither is by design of this step: G.8 | 19:39:27 to 19:42:18 |
| The acceptance folder (`test/acceptance`), after its owner's change | **Exit 0**: 5 files, 124 tests (`contract` 34, `pairing-lifecycle` 31, `rbac-matrix` 37, `restart` 16, `shared-state` 6) | 19:49:38 to 19:49:57 |
| The tests fail without the evaluation; mutation check | 19 tests red without it; 12 of 12 mutations detected (G.7) | 19:44 to 19:47 |
| End state | No database of this row's prefix; no listener was started; `.locks/postgres.pid` 19121 (G.10) | 19:48:03 |

```
19:36:18  npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1813 passed (1813)

19:49:19  unit, this row's two folders
 Test Files  9 passed (9)
      Tests  170 passed (170)

19:47:50  db, this row's two folders (DEMS_TEST_STEP=50c)
 Test Files  4 passed (4)
      Tests  121 passed (121)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 100 ms; 0 remain with the run prefix dems_test_step_50c_tmdvjqbd_

19:38:37  unit, the whole project
 Test Files  146 passed (146)
      Tests  3783 passed (3783)

19:39:27  db, the whole project
 Test Files  2 failed | 116 passed (118)
      Tests  5 failed | 1696 passed (1701)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 391 ms; 0 remain with the run prefix dems_test_step_50c_tmdv5ry6_

19:49:38  db, test/acceptance
 Test Files  5 passed (5)
      Tests  124 passed (124)
```

### G.7 The tests fail without the evaluation; mutation check (out of the tree)

One scratch Vitest configuration outside the repository (the pattern of section 12 and of
`test/assets/02_mutation_harness.vitest.config.mjs.txt`): the workspace's own configuration plus
ONE load-time transform. **No file of the tree was changed for it** (rule M15), so no other row's
run, and no lane backend started from the tree, could see a planted defect. Configuration, run
script and list: `28d_harness.vitest.config.mjs.txt`, `28d_harness.run.sh.txt`,
`28d_mutations.json`. The harness is removed.

**Without the evaluation** (19:44:32 to 19:44:42): `decision.ts`, `denial.ts` and `index.ts` of
the guard served from their pre-images, the contract as it is in the tree, that is the state the
contract owner refused to land. This row's tests (`28d_without_evaluation.log`):

| Project | Without the evaluation | With it (the same harness, no transform) |
|---|---|---|
| `unit` | 3 files failed; **11 tests failed**, 159 passed | 9 files, 170 passed |
| `db` | 3 files failed; **8 tests failed**, 113 passed | 4 files, 121 passed |

Red among them: four of the six new tests of `decision.test.ts`, the new test of
`denial.test.ts`, the new test of `guard.test.ts`, four of the six tests of
`device-credential.db.test.ts`, the three "on a paired device" cells of the 675-cell test, the
three of `matrix.db.test.ts`. The two tests of the new `db` file that stay green are the ones
that must: the rule is compiled from the registry whether or not it is evaluated, and a retired
device was refused before. (Two more are red for the log key of P10 alone.)

**Twelve single mutations** of the new logic (19:45:09 to 19:47:23), `28d_mutations.log`:
**12 of 12 detected**, 11 by both projects, C04 by a unit test only.

| ID | Planted defect | unit | db |
|---|---|---|---|
| C01 | The case is empty: the condition is looked at and never refuses | 9 failed | 6 failed |
| C02 | An operator on a device holds the condition | 9 failed | 6 failed |
| C03 | Turned round: the device is refused, the session passes | 10 failed | 6 failed |
| C04 | A condition without a case is passed over | 1 failed | passed (no rule of the registry has one) |
| C05 | `DEVICE_CREDENTIAL` has no case and reaches the default | 13 failed | 6 failed |
| C06 | The answer carries no reason | 2 failed | 2 failed |
| C07 | The answer has the text of the marker's refusal | 2 failed | 1 failed |
| C08 | A web console session gets the reason too | 3 failed | 1 failed |
| C09 | The answer has another code | 2 failed | 3 failed |
| C10 | The refusal writes a row and takes a place in the denial budget | 3 failed | 3 failed |
| C11 | The log line names what refused under the key `cause` again | 2 failed | 3 failed |
| C12 | The log line does not say what refused | 2 failed | 3 failed |

Not checked by a mutation: the contract half (the contract owner's 15 mutations,
`27c_mutations.log`), and the 88 older mutations of section F.8, which were not run again.

### G.8 Red tests outside this row's folders

| Test | Where and when | By design of this step? | State at the end |
|---|---|---|---|
| `src/modules/pairing/__tests__/concurrency.db.test.ts`, "the device is revoked exactly once; …" (pairing row) | 19:35:46, the folder run: `AssertionError: expected 'DEVICE_NOT_PAIRED' to be 'DEVICE_REVOKED'` at `:394:67` | **Yes**: it raced a rotation with the session token. Not in the first grant: reported to the controller, ruled, changed (G.4, B4 to B6) | Green: three runs alone, the folder, and the final run of 19:48:03 |
| `test/acceptance/rbac-matrix.test.ts`, three tests "…@DEVICE: the seeded … signed in on a paired device" (reported at `:986:26`) and "no cell of this file was answered 429 …" (`:1339:75`) (row W47) | The whole `db` run of 19:39:27: `23 rotateDeviceCredential as INVESTIGATOR@DEVICE (expected 403 DEVICE_NOT_PAIRED): error.details.reason is "DEVICE_CREDENTIAL_REQUIRED", not undefined`, and the same for the two other roles | By design of this step, **and already being adapted by its owner during that run**: `rbac-matrix.support.ts` was saved at 19:39:36 and `rbac-matrix.test.ts` at 19:41:29, both inside the run. The model already expected the 403; the reason was the part still missing | Green alone at 19:43:03 (37 tests) and in the folder run of 19:49:57. No change of this row |
| `src/modules/demo/__tests__/reset-failures.db.test.ts`, "RUN through a failed reset: the stored chain is intact …" (demo row; the engine and clock fix round is in flight) | The whole `db` run of 19:39:27: `AssertionError: expected [ …(87) ] to have a length of 86 but got 87` at `:391:23`; alone at 19:42:54: the same | **No.** Run at 19:44:52 through the harness with the three guard files AND the three contract sources served from their pre-images (the server as it was before this step): the same failure. `src/engine/host.ts` was saved at 19:32:13 by the fix round | Red, not this row's; reported |

No other test of the whole runs was red. At the end no test under `test/acceptance/**` is red.

### G.9 Findings, deviations and decisions

| ID | Kind | Content |
|---|---|---|
| CF-1 | Finding, fixed here; deviation | The stage's refusal line carried what refused under the key `cause` since the row was built. Standing rule M14 names that key, and the server-wide static test did not see it: `test/static/log-calls.ts:127` skips a member that arrives through a spread, and this one did (`...(cond ? { cause } : {})`). The value was never an error (one of four fixed names). Renamed to `refusedBy` (P10); the only readers were two assertions of this row's tests. For the owner of the static test: a member inside a conditional spread is not scanned |
| CF-2 | Deviation, for a ruling | The brief asked for a fourth case. The `switch` also got a `default` that refuses (P5). Reason: the contract owner found that a condition the guard does not evaluate was passed over in silence (`27_contract_c.md` 15.2), which is why this step had to land in one piece. Now such a condition stops the server's type check (the `never`), and at run time nobody is let through on it. Consequence for later steps: a patch that ADDS a member to the vocabulary cannot land without its case here. Decision D118 adds no member, so it is not affected |
| CF-3 | Info | No boot check refuses the condition on another marker than `DEVICE`. There it fails closed for an operator (always refused); the contract's own test pins the marker (`api-registry.test.ts`, "the condition stands on the marker DEVICE only") |
| CF-4 | Deviation | `access-rules.test.ts` does not pin the holders of `DEVICE_CREDENTIAL` as a closed list: it asserts that the rules equal the registry, that operation 23 is among the holders and where it stands, and that every holder is a `DEVICE` rule. The seven pairs of the other conditions stay a closed list. Reason: decision D118; the closed list is the registry's own test's |
| CF-5 | As ruled (FU-4) | The refusal leaves no audit row and takes no place in the denial budget, so a session token can repeat the attempt as often as the throttle of stage 5 lets it, and what remains is one warn line per attempt in the server's log. Whether the attempt should leave a row is for the final security review |
| CF-6 | Info, for the contract close-out | The message of the refusal is typed twice: in the contract's example (`example-parts.ts`) and in `denial.ts` (`OWN_CREDENTIAL_TEXT`). The contract exports the reason and not the message. A unit test holds the two together (`denial.test.ts:120-145`) |
| CF-7 | Info, for the owner of `test/acceptance/contract.test.ts` | `:1456` lists `rotateDeviceCredential 403 DEVICE_NOT_PAIRED` as the known gap `CONTRACT-GAP-W32-3`. The 403 text of operation 23 now names `DEVICE_NOT_PAIRED` for a session of the device; the refusal of a web console session by the marker is still not named there (finding FU-6 of the contract row). The test is green; whether the entry stays is its owner's |
| CF-8 | Info | Unchanged and still as the contract row judged them: operation 22 `unpairDevice` takes a session of the device (FU-3), and operation 8 `signInWithBiometric` waits for decision D118 |
| CF-9 | Info, for the pairing row | In `concurrency.db.test.ts` the assertion "a credential returned in flight is refused after the revoke" is on the appended racer only, as granted. The older racer at `:380` is a rotation with the device credential too and could get the same assertion |
| CF-10 | Info | The specification's revision number, its `last_updated` and the "specific errors" cell of row 23 were left as they are (the grant covers the six lines of G.5) |

Decisions for the controller to record: accept CF-1 (the log key `refusedBy`), rule on CF-2 (the
`default` that refuses), accept CF-4 (the test is not a closed list for this one condition), and
pass CF-1's note to the owner of `test/static/log-calls.ts`, CF-7 to the acceptance row, CF-9 to
the pairing row, the red demo test of G.8 to the engine fix round.

### G.10 End state, cleanup, rollback

End state at 19:48:03, read as `dems_owner` (names and counts only): 0 databases with the prefix
`dems_test_step_50` (the suffixes `b` and `c` included); 9 test databases of other rows existed
at that moment; the project databases are `dems_demo`, `dems_lane_1`, `dems_lane_2`,
`dems_lane_3`, none of which a test of this row connected to; `.locks/postgres.pid` is 19121,
started 07:14:26. No listener was started by this row: every request was `app.inject`. Every run
reached its teardown.

Cleanup: the scratch harness was under the session's scratchpad; its link into the workspace
was removed first, then the folder.

Files of this step:

| Kind | Files |
|---|---|
| Contract (the contract owner's patch, applied) | `packages/shared/src/api/contract-model.ts`, `example-parts.ts`, `pairing.ts`; `packages/shared/test/api-registry.test.ts`, `api-openapi-scope.test.ts`; `packages/shared/openapi/openapi.json` |
| Production, changed | `apps/core-server/src/plugins/permission-guard/decision.ts`, `denial.ts`, `index.ts` |
| This row's tests, changed | `apps/core-server/src/plugins/permission-guard/__tests__/access-rules.test.ts`, `decision.test.ts`, `denial.test.ts`, `guard.test.ts`, `pipeline.db.test.ts` |
| This row's tests, added | `apps/core-server/src/plugins/permission-guard/__tests__/device-credential.db.test.ts` |
| By design, granted | `apps/core-server/src/modules/rbac/__tests__/matrix.db.test.ts`; `apps/core-server/src/modules/pairing/__tests__/routes.test.ts`, `devices.db.test.ts`, `concurrency.db.test.ts` |
| Specification | `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md` (six lines) |
| Assets, under `implementation/assets/` | `28d_guard_condition_op23.patch` (14 files, 552 lines added, 31 removed: everything of this step but the contract patch), `28d_harness.vitest.config.mjs.txt`, `28d_harness.run.sh.txt`, `28d_mutations.json`, `28d_mutations.log`, `28d_without_evaluation.log`, `28d_test_unit_verbose.txt`, `28d_test_db_verbose.txt`, `28d_final_runs.log` |
| Pre-images | `.cache/rollback/guard_condition_op23/` (19 files) |
| Not written | `delegation_progress_report.md`, `status_tasks.md`, `decisions/decisions.md`, `gateway_check/01_gate_report.md`, `masterplan/02_plan.md`; nothing under `test/acceptance/**`, `src/modules/identity/**`, `src/realtime/**`, `src/core/**`, `src/engine/**`, `test/helpers/**` |

Rollback (not executed; `git apply -R --check` of both patches: exit 0, after the last run). The two halves go back TOGETHER,
or the tree does not type check:

```
git apply -R docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28d_guard_condition_op23.patch
git apply -R docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/27c_condition_op23.patch
```

or copy the 19 pre-images back and remove `device-credential.db.test.ts`. After it a session
token of a device can rotate the device credential again: finding CPS1-3 is open. The acceptance
row's adaptation of `rbac-matrix` would then be red and has to go back with it.
