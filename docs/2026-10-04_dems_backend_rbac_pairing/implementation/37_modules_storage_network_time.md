---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
step: 59
plan_row: W37
date: 2026-10-04
agent: coder-execution
tier: 3
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
spec: masterplan/01_specs.md rev 2.2, §7.2, §7.11, §7.12, §7.17 member 34, §8.4 (Q15)
status: complete
---

# Step 59 (W37): the storage module and the network-time module

Two module folders of the Core server, filled in one row: `apps/core-server/src/modules/storage/`
(operations 53 to 55) and `apps/core-server/src/modules/network-time/` (operations 56 and 57).
Times are WIB, 2026-10-04. Evidence files are under `implementation/assets/37_*`.

## 1. Result

| Item of the row | Result | Evidence |
|---|---|---|
| MODG, storage: the route list equals the registry operations | PASS: 3 = 3 | section 5.1 |
| MODG, network-time: the route list equals the registry operations | PASS: 2 = 2 | section 5.1 |
| `setStoragePolicy` is allowed for a holder of either permission | PASS: SUPERVISOR (holds EVIDENCE_REVIEW only) 200; TECHNICIAN (holds MAINTENANCE only) 200, through the real stages 3 to 6 with the grants read from PostgreSQL | section 6.1 |
| ... and refused for a holder of neither | PASS: INVESTIGATOR 403 `NOT_PERMITTED`, by the guard, one `ACCESS_DENIED` row with `details.permission: EVIDENCE_REVIEW_OR_MAINTENANCE`, before the body is read; also a TECHNICIAN whose role lost MAINTENANCE in the clone | section 6.1 |
| A policy change is present after an app restart with its `STORAGE_POLICY_CHANGED` row | PASS: `engine.stop()`, `app.close()`, a new app on the same clone; the policy, the stored row, the audit row (same sequence and hash) and the chain | section 6.2 |
| Time values follow the injected clock | PASS: per second, across a three-hour jump, with a standing clock, on two servers with two clocks, across a restart | section 6.3 |
| Nothing reads the system time or the host's network state (static, both folders) | PASS | section 6.4 |
| Row command `DEMS_TEST_STEP=59 npm run test:db -w @dems/core-server -- --maxWorkers=2 src/modules/storage src/modules/network-time` | 2 files, 29 tests, exit 0 (15:01:14) | section 7.1 |
| Unit tests of the two folders | 5 files, 130 tests, exit 0 (15:01:06) | section 7.1 |
| Whole `unit` project | 101 files, 2,647 tests, exit 0 (15:01:30) | section 7.2 |
| Whole `db` project | 71 files, 1,047 tests, exit 0 (15:02:30) | section 7.2 |
| `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | exit 0, exit 0, no warning (15:02) | section 7.2 |
| Mutation check of the modules' own logic | 47 of 47 detected by the unit tests; 30 of 31 behaviour mutations detected by the database tests alone | section 8 |
| No database of the prefix `dems_test_step_59_` remains; `.locks/postgres.pid` | 0; 19121 | section 12 |
| New contract, schema or simulator gap | none (`CONTRACT-GAP-W37-n`, `SCHEMA-GAP-W37-n`, `SIM-GAP-W37-n`: none allocated) | section 9 |

Status: **complete**. Two findings and one decision for the controller are in sections 9 and 11.

## 2. What was written

| File | Lines | Change | Content |
|---|--:|---|---|
| `apps/core-server/src/modules/storage/index.ts` | 109 | replaces the stub of W08 | The plugin `storageModule`; three routes; `STORAGE_MODULE_OPERATIONS`, `STORAGE_POLICY_ACTION` |
| `apps/core-server/src/modules/storage/status.ts` | 47 | new | `storageStatusOf(state)`: the design-book summary of operation 53 |
| `apps/core-server/src/modules/storage/policy.ts` | 24 | new | `policyPatchOf(body)`: what of a body reaches the hosted action |
| `apps/core-server/src/modules/network-time/index.ts` | 71 | replaces the stub of W08 | The plugin `networkTimeModule`; two routes; `NETWORK_TIME_MODULE_OPERATIONS` |
| `apps/core-server/src/modules/storage/__tests__/routes.test.ts` | 591 | new, project `unit` | 52 tests |
| `apps/core-server/src/modules/storage/__tests__/projection.test.ts` | 133 | new, project `unit` | 16 tests |
| `apps/core-server/src/modules/storage/__tests__/static.test.ts` | 144 | new, project `unit` | 18 tests |
| `apps/core-server/src/modules/storage/__tests__/storage.db.test.ts` | 563 | new, project `db` | 18 tests |
| `apps/core-server/src/modules/storage/__tests__/support.ts` | 394 | new, test support | The engine double, the two app builders, the registry side of the gate |
| `apps/core-server/src/modules/storage/__tests__/static-rules.ts` | 211 | new, test support | The patterns of the static tests with their positive controls |
| `apps/core-server/src/modules/network-time/__tests__/routes.test.ts` | 401 | new, project `unit` | 28 tests |
| `apps/core-server/src/modules/network-time/__tests__/static.test.ts` | 121 | new, project `unit` | 16 tests |
| `apps/core-server/src/modules/network-time/__tests__/network-time.db.test.ts` | 279 | new, project `db` | 11 tests |

Nothing else was edited: not `app.ts`, not the contract, the schema, a migration, the mapping,
the seed, the core, the engine, a plugin or another module (rule M1). No package was added.
Both plugins keep the export name the frozen app factory imports (`test/static/scaffold.test.ts`
passes; a static test of each folder pins the line).

## 3. The operation table of both modules

| # | operationId | Method and path | Access (registry) | Audit on success | Request | 200 answer | Recipe |
|--:|---|---|---|---|---|---|---|
| 53 | `getStorageStatus` | GET `/api/v1/storage/status` | `AUTHENTICATED` | none (read) | none | `StorageStatusResponse` | read of the committed state, projected |
| 54 | `getStorageDetail` | GET `/api/v1/storage/detail` | `AUTHENTICATED` | none (read) | none | `StorageDetail`: slices `storage`, `storagePolicy` | read of the committed state |
| 55 | `setStoragePolicy` | POST `/api/v1/storage/policy` | `ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)` | `STORAGE_POLICY_CHANGED`; none when unchanged | `StoragePolicyRequest` (three optional members; days 1 to 3,650) | `StoragePolicySlice` | hosted action `setStoragePolicy` |
| 56 | `getNetworkStatus` | GET `/api/v1/network/status` | `AUTHENTICATED` | none (read) | none | `NetworkStatus`: slices `network`, `tabletLink` | read of the committed state |
| 57 | `getTimeStatus` | GET `/api/v1/time/status` | `AUTHENTICATED` | none (read) | none | `TimeStatus`: slice `time` under its name | read of the committed state |

Sources: `packages/shared/src/api/core-api.ts:795-812` (53), `storage.ts:90-138` (54, 55),
`network-time.ts:64-108` (56, 57); `sim-actions.ts` (`setStoragePolicy: hosted('setStoragePolicy')`).

## 4. The handler recipe per operation (rule M13)

Every route is `routes.route({ ...routeOfOperation(registryEntry('<operationId>')), schema, handler })`
(rule M2). The schema objects are the contract's own (tested by identity against
`CORE_API_SCHEMAS[<the name the registry entry gives>]`). No route has a hook, and its
configuration holds the operation ID and nothing else.

| # | Recipe | Code |
|--:|---|---|
| 53 | Server-side read, no pipeline: `storageStatusOf(app.engine.state())`. The state is taken once, so the summary and the retention policy in it belong to one committed state. The projection is the simulator's own `storageStatus` of `sim/api.ts` (not exported by the shared package), rebuilt on the shared selector `storageSummary`: the arithmetic stays the simulator's | `storage/index.ts:79-84`, `status.ts:22-47` |
| 54 | Server-side read: `const { storage, storagePolicy } = app.engine.state(); return { storage, storagePolicy }` | `storage/index.ts:86-94` |
| 55 | **Hosted** (rule M4): `const { epoch, revision } = await app.engine.command(request.principal, 'setStoragePolicy', policyPatchOf(request.body))`; then the committed slice is read (`app.engine.slice('storagePolicy')`), then the headers `x-dems-epoch` and `x-dems-revision` are set from the OUTCOME (API-7), then the slice is answered. The principal is passed as it is. The patch holds a member exactly when the body held it. Nothing is caught: a refusal of the simulator, a unit that was not committed and a stopped engine propagate as the engine host's `ApiFailure` | `storage/index.ts:96-108`, `policy.ts:18-24` |
| 56 | Server-side read: `const { network, tabletLink } = app.engine.state(); return { network, tabletLink }` | `network-time/index.ts:55-63` |
| 57 | Server-side read: `({ time: app.engine.slice('time') })` | `network-time/index.ts:65-70` |

No operation of this row is server-native: there is no `app.pipeline.run`, no table of the
modules' own, no audit row and no event written by the modules, no publication. The row of
`storage_policy`, the audit row and the event of a policy change are written by the engine host's
unit, from what the shared action did.

What the modules do NOT do, each held by a static test of its folder: read a role, a permission,
a session, a device or the kind of the caller; write a denial row or build a refusal; add a hook;
read a clock of any kind; import a module of the runtime; call a simulator action or read the
hosted `Sim`; write a log line. Rule M14 (decision D87): neither folder contains a log call, so
no error is logged under any key.

**Error paths and the persistent error log.** The modules contain no `catch`. An `ApiFailure`
is answered by the error envelope. Anything else answers 500 `INTERNAL_ERROR` with no detail, and
the envelope writes one error line and one entry of the persistent error log by the error's name;
tested per operation with an error log file (`S-R` and `N-R`, "an unexpected failure answers 500
... and is in the log and in the persistent error log by its name": 3 and 2 entries).

## 5. The module gate (MODG)

### 5.1 The route lists, printed by the tests (15:01:06, `assets/37_own_unit_verbose.log`)

```
[w37] MODG routes of src/modules/storage:   GET /api/v1/storage/status getStorageStatus | GET /api/v1/storage/detail getStorageDetail | POST /api/v1/storage/policy setStoragePolicy
[w37] MODG registry, tag Storage (53-55):   GET /api/v1/storage/status getStorageStatus | GET /api/v1/storage/detail getStorageDetail | POST /api/v1/storage/policy setStoragePolicy
[w37] MODG routes of src/modules/network-time: GET /api/v1/network/status getNetworkStatus | GET /api/v1/time/status getTimeStatus
[w37] MODG registry, tag Network (56-57):      GET /api/v1/network/status getNetworkStatus | GET /api/v1/time/status getTimeStatus
```

The module side is everything the plugin registers on an EMPTY Fastify instance (no prefix is
assumed); the registry side is every operation of the tag. A second test finds the same routes in
the real app and nothing else under the modules' paths.

### 5.2 Status table per operation, with the test for each

Files: `S-R` `storage/__tests__/routes.test.ts`, `S-P` `projection.test.ts`, `S-S` `static.test.ts`,
`S-D` `storage.db.test.ts`; `N-R`, `N-S`, `N-D` the same in `network-time/__tests__/`. Every
answer named here is checked with `validateCoreApiResponse(operationId, status, body)`.

| # | Status and code | Who produces it | Test |
|--:|---|---|---|
| 53 | 200 | the module | `S-R` "reads the summary" (3 roles; equal to the simulator's own REST answer); recording, `STORAGE_LOW`, `STORAGE_FULL`; `S-D` "reads the summary and the detail" (3 roles; equal to the hosted simulator's answer and to the contract example), "the summary is the hosted simulator's own answer in every state" |
| 53 | 401 `NOT_SIGNED_IN` | stage 6 | `S-R` "nobody", "a paired device without an operator"; `S-D` "the refusals are the guard's" |
| 53 | 403 `ORIGIN_NOT_ALLOWED` | stage 3 | `S-D` "the refusals are the guard's" |
| 54 | 200 | the module | `S-R` "reads the two slices in their wire form" (3 roles), "answers the slice as it is"; `S-D` "reads the summary and the detail" |
| 54 | 401; 403 `ORIGIN_NOT_ALLOWED`; 403 `DEVICE_REVOKED` with its one row | stages 6, 3, 6 | `S-R` as 53; `S-D` "the refusals are the guard's" |
| 55 | 200, changed | the module, through the hosted action | `S-R` "a holder of EVIDENCE_REVIEW changes the policy", "a holder of MAINTENANCE changes it too"; `S-D` the two tests of the same names, "an operator on a paired device" |
| 55 | 200, unchanged, no row | the same | `S-R` "a body that changes nothing" (3 bodies); `S-D` "a body that changes nothing ... writes nothing" |
| 55 | 400 `INVALID_JSON` | stage 7 | `S-R` "400 INVALID_JSON" (5 bodies); `S-D` "422 INVALID_INPUT for a value outside the bounds" (last part) |
| 55 | 401 `NOT_SIGNED_IN` | stage 6 | `S-R` "nobody", "a paired device"; `S-D` "the refusals are the guard's" |
| 55 | 403 `NOT_PERMITTED`, one `ACCESS_DENIED` row | stage 6 | `S-R` "the any-of: a holder of neither"; `S-D` "a holder of neither is refused by the guard", "a TECHNICIAN whose role loses MAINTENANCE" |
| 55 | 403 `NOT_PERMITTED` with `details.simCode`, no row | the hosted action itself (finding F-W37-1) | `S-D` "finding F-W37-1" |
| 55 | 422 `INVALID_INPUT`, `details.in: body` | stage 7, the contract's schema | `S-R` "422 INVALID_INPUT" (11 bodies), "the bounds are accepted"; `S-D` "422 INVALID_INPUT for a value outside the bounds" |
| 55 | 422 `INVALID_INPUT`, `details.simCode: POLICY_RANGE` | the hosted action (not reachable through the route: the schema refuses first) | `S-R` "the bounds are the simulator's" and "a refusal of the engine host is left to propagate"; `S-D` "the bounds are the simulator's on the real host too" |
| 56 | 200 | the module | `N-R` "reads the two slices in their wire form" (3 roles), "the tablet link is the engine's slice", "whatever the committed slice holds"; `N-D` "reads the network status and the time status" |
| 56, 57 | 401; 403 `ORIGIN_NOT_ALLOWED`; 403 `DEVICE_REVOKED` with one row each | stages 6, 3, 6 | `N-R` "nobody", "a paired device"; `N-D` "the refusals are the guard's" |
| 57 | 200 | the module | `N-R` "reads the slice under its name" (3 roles), "a lost time source"; `N-D` "reads the network status and the time status" |
| all | 405 with `allow` | stage 1 | `S-R`, `N-R` "405 with `allow`"; `N-D` "the refusals are the guard's" |
| all | 503 `NOT_READY` | stage 2, or the engine host when it stopped | `S-R`, `N-R` "503 NOT_READY"; `S-D` restart test (after `engine.stop()`); `N-D` "two servers" (after `engine.stop()`) |
| all | 500 `INTERNAL_ERROR` | the envelope | `S-R`, `N-R` "an unexpected failure"; `N-R` "a slice that does not fit the contract never leaves the server" |

AC-B-68, for the test report's operation-to-test table:

| # | Success test | Denial test | Validation test |
|--:|---|---|---|
| 53 | yes | no permission; 401 and 403 of the guard tested | no body |
| 54 | yes | no permission; 401 and 403 of the guard tested | no body |
| 55 | yes (changed and unchanged) | yes: 403 for a holder of neither, one row | yes: 422 (11 bodies), 400 (5 bodies) |
| 56 | yes | no permission; 401 and 403 of the guard tested | no body |
| 57 | yes | no permission; 401 and 403 of the guard tested | no body |

The role-by-operation decision is the guard's; the full matrix is test row W47.

## 6. The verification items of the row

### 6.1 The any-of (`storage.db.test.ts`, the real stages 3 to 6, grants read from PostgreSQL)

The seeded matrix already holds all three cases, so no clone change is needed for the main proof.
The test first reads it from the clone ("the stored matrix decides"): SUPERVISOR holds
`EVIDENCE_REVIEW` and not `MAINTENANCE`; TECHNICIAN holds `MAINTENANCE` and not `EVIDENCE_REVIEW`;
INVESTIGATOR holds neither.

| Caller | Call | Answer | Stored |
|---|---|---|---|
| SUPERVISOR (EVIDENCE_REVIEW) | `{ retentionPolicy: 'YEAR_1' }` | 200 `{ YEAR_1, 365, true }` | `audit_log` +1, `events` +1 and no other count changed; row `STORAGE_POLICY_CHANGED`, actor the SUPERVISOR, device `HDD-EVIDENCE`, `at` the manual clock, details the three values; `storage_policy` updated, `updated_at` the manual clock |
| TECHNICIAN (MAINTENANCE) | `{ autoArchive: false, retentionDays: 400 }` | 200 `{ YEAR_1, 400, false }` | one row, actor the TECHNICIAN |
| INVESTIGATOR (neither) | three bodies: a valid one, one that stage 7 would refuse (`retentionDays: 0`), none | 403 `NOT_PERMITTED`, `details: { operationId: setStoragePolicy, permission: EVIDENCE_REVIEW_OR_MAINTENANCE, role: INVESTIGATOR }` each time | one `ACCESS_DENIED` row per call (WARNING, actor the INVESTIGATOR, message `Access denied: role INVESTIGATOR holds none of EVIDENCE_REVIEW, MAINTENANCE (setStoragePolicy)`); the policy unchanged |
| TECHNICIAN after `DELETE FROM role_permissions` of its `MAINTENANCE` grant in the clone (as `dems_owner`, test only) | `{ retentionDays: 77 }` | 403 `NOT_PERMITTED`, the same details with role TECHNICIAN | one `ACCESS_DENIED` row; with the grant back, the same call answers 200 |
| TECHNICIAN on a paired device (bearer session, no `Origin`) | `{ retentionPolicy: 'DAYS_30' }` | 200; no `Set-Cookie` | one row, actor the TECHNICIAN |

The header check of the first call: `x-dems-epoch` is the engine's epoch and `x-dems-revision` is
the revision of the ONE published change of cause `command`, which replaces the slice
`storagePolicy` and appends the audit row `STORAGE_POLICY_CHANGED`; the revision moved by exactly 1.
An unchanged policy (three bodies) writes nothing in any table, publishes nothing and answers the
current revision.

### 6.2 Durable across a restart (`storage.db.test.ts`, "a policy change is durable", on a clone of its own)

1. First app, booted: SUPERVISOR sets `{ retentionPolicy: 'CASE_CLOSURE', autoArchive: false }`:
   200 `{ CASE_CLOSURE, 3650, false }`; the last stored audit row is `STORAGE_POLICY_CHANGED`.
2. `await first.engine.stop()`: the three operations answer 503 `NOT_READY`. `await first.app.close()`.
3. A new app from `buildApp` on the same clone, its clock 90 s later, booted: epoch = the first
   epoch + 1.
4. There: `engine.slice('storagePolicy')` and the row of `storage_policy` hold the policy
   (`updated_at` still the instant of the change); a TECHNICIAN's new session reads it through
   operations 54 and 53; the trail up to the stop is byte-equal, the one `STORAGE_POLICY_CHANGED`
   row is the same object (sequence, hash, actor, time) and is in the audit ring the new engine
   rehydrated; the only row after the stop is the new sign-in's; the chain verifies.
5. A further change in the new process appends sequence +1 on the previous hash, in the new epoch.

### 6.3 Time values follow the injected clock

The server clock is a manual clock behind the seam `clock`; the engine runs on it (ENG-13). The
modules read no clock: they answer what the engine stamped.

Three kinds of instant can be in an answer: the seed's (at or before 2026-10-01 10:00 WIB, the
instant the seed template is written at: stored history points), the server's (at or after the
manual clock's start, 2031-01-01), and anything else, in between, where this machine's own clock
stands. The tests assert that the third set is empty, with a guard that the machine's clock is in
that gap.

| Test (`network-time.db.test.ts`, real engine host) | What it shows |
|---|---|
| "at the boot" | `tabletLink` is `{ OFFLINE, changedAt: <clock start> }` (the first start sets the link at the server clock); every other instant of the two answers is the seed's; none is in the gap; more than 100 instants checked |
| "second by second" | 20 s of the manual clock add exactly the 21 whole seconds from the start to now to `network.bandwidth.history` (the first is the second of the first tick); `time.lastSyncAt` moved onto a whole second of the manual clock; a new `time.history` point; none later than the clock |
| "a jump" | The clock is moved 3 h ahead in one step; after ONE tick the newest bandwidth point, the newest time-history point and `lastSyncAt` are exactly that instant; the point before it kept its instant, 3 h earlier. The same clock ended the idle sessions: the old cookie answers 401 |
| "a clock that stands still" | Five ticks and 50 ms of real time change no value |
| "the tablet link is set by the server" | `app.engine.setTabletLink('CONNECTED')` at a later instant: `changedAt` is that instant; back to OFFLINE 11 s later: that instant |
| "two servers, two clocks" | A second server on another clone with its clock a year later answers instants a year later, at the same real time. After its stop and a new app ten minutes later on the clock: the two answers equal the last answers before the stop (the stored snapshot); the first tick stamps at the new clock; no point lies in the ten minutes the server was down |

Database-free (`network-time/__tests__/routes.test.ts`, the engine double, which runs the real
shared simulator): per second for 20 s, a 3 h jump, a standing clock.

For storage: the audit row, the event and `storage_policy.updated_at` of a policy change carry
the manual clock's instant (section 6.1); operation 53 holds no instant at all (`S-P` "no instant
is in the answer").

### 6.4 Static: no system time, no host network state (both folders)

`storage/__tests__/static.test.ts` (18 tests) and `network-time/__tests__/static.test.ts` (16
tests) read the production sources of their folder as text, comments removed. Patterns and their
positive controls are in `storage/__tests__/static-rules.ts`: each pattern must find each of its
planted texts (one per alternative; 24 patterns).

| Rule | Asserted for both folders |
|---|---|
| Time | No `Date.now(`, `new Date`, `Date(`, `Date.parse`, `Date.UTC`, `performance.now`, `hrtime`; no timer; and no clock of any kind (`clock`, `.now(`) |
| Host | No import of `os`, `dns`, `net`, `dgram`, `tls`, `http`, `https`, `http2`, `child_process`, `cluster`, `fs`, `worker_threads`, `crypto`, `process`, with or without `node:`, and no `node:*` at all; the import list of each folder is pinned (network-time: the contract, Fastify's types, the guard's route helper); no `networkInterfaces`, `hostname`, local or remote address or port, `lookup(`, `process.`, `fetch(`, socket, `app.server`, `app.addresses` |
| M3 | No `Permission`, `OperatorRole`, `permissions`, `.role`, a principal kind, `.operatorId`, `.sessionId`, `.deviceId`, `principal.`; no `ACCESS_DENIED`, `EXPORT_DENIED`, `NOT_PERMITTED`, `FORBIDDEN`, `ApiFailure`, `denialBudget`; no hook; no `catch`. Storage names the principal once, as the first argument of `app.engine.command(`; network-time not at all |
| M4, M5 | No `pipeline`, `auditWriter`, `unit.`, `app.db`, `.query(`, statement keyword, `app.publish`; of the engine only `state`, `slice` and (storage) `command`; no `engineControl`, `simulator(`, `.actions`, `*Transition`, `pending(` |
| M2 | 3 and 2 `.route({` calls, each `...routeOfOperation(registryEntry('<id>'))`; no method shorthand; no literal path |
| Request data | Storage reads `request.principal` and `request.body`, once each; the handlers of the four reads take no request at all |
| Other | No slot provided or replaced, no import from a `__tests__` folder, no console, no random source, no log call (rule M14) |

## 7. Runner output

### 7.1 The tests of the row

`npm run test -w @dems/core-server -- --maxWorkers=2 --silent=false --reporter=verbose src/modules/storage src/modules/network-time` (15:01:06, exit 0; `assets/37_own_unit_verbose.log`):

```
 Test Files  5 passed (5)
      Tests  130 passed (130)
   Start at  15:01:06
```

`DEMS_TEST_STEP=59 npm run test:db -w @dems/core-server -- --maxWorkers=2 --silent=false --reporter=verbose src/modules/storage src/modules/network-time` (15:01:14, exit 0; `assets/37_own_db_verbose.log`):

```
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_59_tmdia365_
 Test Files  2 passed (2)
      Tests  29 passed (29)
   Start at  15:01:15
   Duration  7.99s (tests 42%, transform 39%, import 19%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 181 ms; 0 remain with the run prefix dems_test_step_59_tmdia365_
```

### 7.2 Whole projects, typecheck, lint (final state)

`npm run test -w @dems/core-server -- --maxWorkers=2` (15:01:30, exit 0; `assets/37_unit_whole.log`):

```
 Test Files  101 passed (101)
      Tests  2647 passed (2647)
   Start at  15:01:30
   Duration  42.85s (import 57%, tests 37%, transform 6%)
```

`DEMS_TEST_STEP=59 npm run test:db -w @dems/core-server -- --maxWorkers=2` (15:02:30, exit 0; `assets/37_db_whole.log`):

```
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_59_tmdic73q_
 Test Files  71 passed (71)
      Tests  1047 passed (1047)
   Start at  15:02:31
   Duration  169.02s (tests 86%, import 13%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 416 ms; 0 remain with the run prefix dems_test_step_59_tmdic73q_
```

`npm run typecheck -w @dems/core-server`: exit 0 (15:02). `npm run lint -w @dems/core-server`:
exit 0, no warning (15:02). Both in `assets/37_typecheck_lint.log`.

### 7.3 Every run of the whole projects and what was not this row's (P11, decision D85)

| Time | Command | Result | Not this row's |
|---|---|---|---|
| 14:24 | `guard.test.ts` alone, with the five routes in the tree | 12 failed, 17 passed | **Red by design, decision D85, owner fix pending at that time.** `guard.test.ts:139` pinned the list of registered operations; `:202`, `:309`, `:376` registered stand-in routes for operations that now have a route (`FastifyError: Method 'GET' already declared for route '/api/v1/storage/status'`, `Method 'POST' already declared for route '/api/v1/storage/policy'`). Not edited by this row. `assets/37_guard_unit_red_by_design_1424.log` |
| 14:35 | typecheck | exit 2 | `src/modules/admin/__tests__/rule.test.ts(11,127): error TS2345` (the administration row in flight) |
| 14:35 | lint | exit 0, 2 warnings | `src/modules/admin/__tests__/users.db.test.ts:118`, `static.test.ts:328` (the same row) |
| 14:49:03 | typecheck | exit 2 | `src/plugins/permission-guard/__tests__/registered-routes.test.ts(147,83)` and `(171,84)`: TS2345 (the guard owner's fix of D85 in flight) |
| 14:49:26 | whole `unit` | 95 files, 2,526 tests, exit 0 | — (the fix of D85 had landed for `guard.test.ts`) |
| 14:50:00 | whole `db` | 65 files, 989 tests, exit 0 | one forced drop needed a retry (SQLSTATE 42501, an autovacuum worker on a database; the helper's retry of W11b went through) |
| 15:01:30 | whole `unit` | 101 files, 2,647 tests, exit 0 | — |
| 15:02:30 | whole `db` | 71 files, 1,047 tests, exit 0 | — |
| 15:02 | typecheck, lint | exit 0, exit 0 | — |

At the final runs the three files of decision D85 (`guard.test.ts`, `denial.db.test.ts`,
`matrix.db.test.ts`) were green: the owner's fix was in the tree. This row edited none of them and
has no workaround for them in production code.

### 7.4 Test ledger (P24)

| Project | Controller baseline 14:11 | Final run of this row | This row's files | This row's tests |
|---|---|---|---|--:|
| `unit` | 77 files, 1,992 tests | 101 files, 2,647 tests (15:01:30) | `src/modules/storage/__tests__/routes.test.ts` (52), `projection.test.ts` (16), `static.test.ts` (18); `src/modules/network-time/__tests__/routes.test.ts` (28), `static.test.ts` (16) | 130 in 5 files |
| `db` | 48 files, 740 tests | 71 files, 1,047 tests (15:02:30) | `src/modules/storage/__tests__/storage.db.test.ts` (18); `src/modules/network-time/__tests__/network-time.db.test.ts` (11) | 29 in 2 files |

The rest of the growth (19 unit files with 525 tests, 21 database files with 278 tests) belongs to
the rows that ran at the same time; this row did not attribute it file by file. No existing test
was changed by this row. Other workspaces were not touched and not run.

## 8. Mutation check (rule M11)

A script outside the repository (`assets/37_mutate.mjs.txt`) changes ONE place of a production
file of the two folders, runs the tests of both folders, puts the file back and checks its hash.
Full output: `assets/37_mutations.log`.

| Run | Window | Mutations | Detected | Survived |
|---|---|--:|--:|--:|
| Unit tests of the two folders | 14:53:30 to 14:56:18 | 47 | 47 | 0 |
| Database tests of the two folders alone (behaviour mutations only) | 14:56:26 to 15:00:57 | 31 | 30 | 1 |

The 47: 19 in `storage/index.ts` (the wrong answer of 53 and 54, two state reads, the hosted
action not run, another action, the headers swapped, missing, taken before the command or set
before the read, a copy of the principal, the raw body, a stale or merged answer, no body schema,
a role check in the handler, a hook, swapped registry entries, a schema of its own, a caught
refusal), 12 in `status.ts` (each member), 5 in `policy.ts`, 11 in `network-time/index.ts` (a
missing slice, two state reads, the system time and the server clock stamped at the request, the
slice without its name, another slice, swapped entries, a link that is always up, a schema of its
own, a read of the caller).

Stated plainly:

- Three mutations are detected only by a static test, because their behaviour is equal for every
  body the schema lets through: `M09` (the whole validated body instead of the patch: the schema
  has already dropped every other key), `M11` (the body merged over the committed slice: equal to
  the slice after a commit), `M46` (a read of the caller that changes no answer).
- The survivor of the database run is `M44` ("the link is always up"): the seed's link is up and
  no action of the engine brings it down, so only the database-free test, which sets the slice,
  detects it. In a first database run two more survived (`M22` "the state is always READY", `M23`
  "the write rate is 0"); the database test of operation 53 then got three references that do not
  use this module's code (the hosted simulator's own REST answer, the contract example, a
  recording and the two storage faults run through the engine), and both are detected now.
- Not run: a mutation that registers an extra route. It would stop `app.ready()` of every app in
  every row's tests for its duration (the guard refuses a route without a rule), while five other
  rows were running whole projects. The MODG test on the empty instance covers it.
- The mutation windows above are times at which another row's whole-project run could have seen a
  mutated file of these two folders for a few seconds.

## 9. Measured round trips of one command (rule M13)

`storage.db.test.ts`, "measured: the statements of one command", with the engine row's counting
pool (statements on connections of units of work; the session lookup of stage 4 runs on the pool
and is not counted). 15:01:15, `assets/37_own_db_verbose.log`:

| Request | Statements | Of which the command's transaction |
|---|--:|--:|
| `POST /api/v1/storage/policy`, a change | 15 | 10 |
| `POST /api/v1/storage/policy`, unchanged | 5 | 5 |
| `GET /api/v1/storage/status` and `GET /api/v1/storage/detail` | 0 | — |

The change, in order (the first five are stage 4's unit that records the session's activity for a
POST; it sent nothing for the second POST at the same clock instant):

```
BEGIN ISOLATION LEVEL READ COMMITTED
SELECT seq, hash FROM public.audit_chain_lock()
SELECT set_config('statement_timeout', $1, true)
UPDATE public.auth_sessions SET last_seen_at = $2 WHERE id = $1 AND ende...
COMMIT
BEGIN ISOLATION LEVEL READ COMMITTED                       -- the command's unit
SELECT seq, hash FROM public.audit_chain_lock()
SELECT set_config('statement_timeout', $1, true)
select "id", "username", "rank", "name", "display_name", ... -- the operators mirror (ENG-3)
insert into "audit_log" (...)                              -- STORAGE_POLICY_CHANGED
insert into "events" (...)
UPDATE public.engine_counters SET next_value = GREATEST(next_value, $2) ...
update "storage_policy" set "retention_policy" = $1, "retention_days" = ...
update "engine_counters" set "next_value" = $1 where ...
COMMIT
```

An unchanged policy sends the unit's frame and the operators mirror: `BEGIN`, the chain lock,
`set_config`, the mirror, `COMMIT`, and no write. The four reads of this row send no statement of
their own: the committed state is in memory.

## 10. Contract gaps, findings

**Contract gaps: none.** No `CONTRACT-GAP-W37-n`, `SCHEMA-GAP-W37-n` or `SIM-GAP-W37-n` was
allocated (decision D84). Every answer of the five operations validated against the registry.
The example of the any-of refusal (`storage.ts:179`) is CONTRACT-GAP-5 of the guard row, unchanged.

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-W37-1 | **A stored grant that the shared table does not have passes the guard and is refused by the hosted action itself, without an audit row.** `setStoragePolicy` is one of the hosted actions the simulator checks on its own, against the shared `ROLE_PERMISSIONS` table, while stage 6 decides on the stored matrix. With `MAINTENANCE` granted to INVESTIGATOR in the clone: 403 `NOT_PERMITTED`, `details: { simCode: NOT_PERMITTED, permission: 'EVIDENCE_REVIEW \| MAINTENANCE' }`, no `ACCESS_DENIED` row, nothing changed. The other direction is consistent: a grant taken away is refused by the guard with its row | `storage.db.test.ts`, "finding F-W37-1" (15:01:15) | Not reachable on a seeded server: the matrix cannot be edited through the API (RB-9) and equals the shared table (AC-B-17). It holds for every hosted action the simulator checks itself, not only for this one. The module writes no row for it (rule M3). Decision DN-1 |
| F-W37-2 | **An engine that is stopped between the commit of a policy change and the answer gives 503 `NOT_READY` although the change is stored.** The handler reads the committed slice after `command` resolved (the host's rule: never answer from the pending state); `engine.slice()` refuses once a stop has begun. A reset or a shutdown that begins in that instant loses the answer, not the change. `storage_policy` is a kept table of a reset, so the change is still there afterwards. The handler sets the two headers after the read, so such a 503 carries no revision | `storage/__tests__/routes.test.ts`, "finding F-W37-2" (with the engine double); mutation `M47` | Residual, stated in the file header. A client learns the policy from the replicated state. If the controller wants it closed: the host would have to hand the committed slice back in the outcome of `command` |
| F-W37-3 | The 422 of the simulator (`POLICY_RANGE`) cannot be reached through the route: the contract's request schema has the same bounds and refuses first, with `details: { in: 'body' }`. The two sets of bounds agree, tested value by value (days -1, 0, 1, 2, 3649, 3650, 3651, 1.5 and every policy name) | `S-R` "the bounds are the simulator's"; `S-D` "the bounds are the simulator's on the real host too" | A client sees one form of the 422 for this operation |
| F-W37-4 | A POST without any body is a valid "change nothing": the scaffold's parser reads an empty body as `{}`, so `setStoragePolicy` answers 200 with the current policy and writes nothing, although the registry marks the body as required | `S-R` "a body that changes nothing (no body at all)" | For the Storage screens of W71 and W79: nothing to do; noted so that nobody reads the 200 as a change |
| F-W37-5 | A policy name and a number of days can disagree: `{ retentionDays: 400 }` under `YEAR_1` is stored as `YEAR_1` with 400 days (the simulator's rule: the days follow the name only when the name is sent alone) | `S-D` "a holder of MAINTENANCE changes it too" | For the Storage screens: show the days, not a number derived from the name |
| F-W37-6 | For authors of database tests: a manual clock moved by more than the idle limit ends the sessions the test signed in (the same clock expires them); and the seed template's instant (2026-10-01) is three days from today's machine clock, so "far from the system time" cannot tell a seeded instant from a system one. This row's clock tests sign in again after the jump and classify instants as seed, server or neither | `network-time.db.test.ts`, the first two failures of 14:40 | Into the briefs of W47 and W53 if useful |
| F-W37-7 | Before the first tick of a process the three hardware slices hold what was stored: on a fresh seed, the seed's history points. The first tick adds one 1 Hz point at the second it falls in, so 20 s of ticks add 21 points | `N-D` "at the boot", "second by second" | For W58 and the client rows that draw the series |

## 11. Deviations, and decisions for the controller

| ID | Deviation from the row text | Reason |
|---|---|---|
| DV-1 | The "holder of neither" of the main proof is the seeded INVESTIGATOR, not a role changed in the clone | The seeded matrix holds all three cases (checked in the test from the stored tables). The clone change the brief describes is done as well: a TECHNICIAN without `MAINTENANCE` |
| DV-2 | The test support and the static rules live in `storage/__tests__/` and are imported by the network-time tests | Both folders are this row's; the alternative is two copies of 600 lines |
| DV-3 | The database-free tests put a double behind the seam `engine`. It runs the REAL shared simulator with the engine host's exported actor scope and refusal mapping; it stores nothing | A real host needs PostgreSQL. The same operations run on the real host in the two database files |
| DV-4 | Test support of five other rows is imported read-only (core, engine, identity, permission guard, the seed template's instant) | Their files say other rows may |
| DV-5 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes them (P8) |
| DV-6 | One mutation was not run (an extra route) | Section 8 |
| DV-7 | A recording, two demo faults and the tablet link are driven through `app.engine` in one database test | Only to bring states about for operation 53 and 56; the operations for them are other modules' |

| ID | Decision | Recommendation |
|---|---|---|
| DN-1 | F-W37-1: the stored matrix and the shared table can disagree for the hosted actions the simulator checks itself | Accept as a residual, and let the matrix test W47 or the boot step of the guard assert that the stored GRANTS equal the shared table (today the boot step compares the vocabulary only, D83 DN-7). Then the case cannot arise on a server that started |
| DN-2 | F-W37-2: 503 after a committed change when a stop begins at that instant | Accept (a stop means a resync for every client); or schedule the host change named in the finding |
| DN-3 | Clients and the any-of refusal (F64): besides the guard's code `EVIDENCE_REVIEW_OR_MAINTENANCE`, the simulator's label `EVIDENCE_REVIEW \| MAINTENANCE` can appear in `details.permission` in the configuration of F-W37-1 | Nothing to build; into the note for W83 beside CONTRACT-GAP-5 |

## 12. End state and cleanup (15:05:32)

A scratch script outside the repository, as `dems_owner`, through the test helper's own reader of
the connection file; it prints names and counts (`assets/37_end_state.mts.txt`, `37_end_state.log`):

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_59_*): 0
test databases of all rows at this moment: 11
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
```

- `.locks/postgres.pid`: 19121, the process started 07:14:26, as before. PostgreSQL was never
  stopped or reconfigured. Nothing connected as the bootstrap superuser. `dems_demo` and the lane
  databases were never connected to by this row.
- No port was bound, no process was started that still runs, no emulator and no lane was used.
  `apps/core-server/logs/` was not written: the two tests that need an error log file write it
  under the system's temporary directory and remove it.
- Database commands ran with the per-command sandbox bypass (rule M12): the sandbox refuses the
  loopback connection to 127.0.0.1:4432 (`EPERM`, the helper's message of 14:38:20). No `cd`, no
  `timeout`, no `rm` outside the temporary directory.
- Scratch files (the mutation script, its backups, runner outputs) are in the session's
  scratchpad, outside the repository; what is evidence is kept as text under
  `implementation/assets/37_*` (10 files).
- The four production files are byte-equal before and after each mutation run (hashes compared).

## 13. Rollback (R-NEW; not executed)

`apps/core-server/` is untracked, so the pre-images are file copies:

| Pre-image under `.cache/rollback/` | Restores |
|---|---|
| `W37.storage.index.ts.pre` (SHA-256 `e335e39a…2c9de8`) | `apps/core-server/src/modules/storage/index.ts` (the stub of W08) |
| `W37.network-time.index.ts.pre` (SHA-256 `5103ccf8…b72c0f`) | `apps/core-server/src/modules/network-time/index.ts` (the stub of W08) |

Steps: copy the two pre-images back over the two `index.ts` files; remove `status.ts`,
`policy.ts` and `__tests__/` under `src/modules/storage/`, and `__tests__/` under
`src/modules/network-time/`. Nothing else: no package, no schema, no contract file, no database
and no host setting was changed. With the stubs back the five operations answer 404, and the
Storage, Network and Time pages of the clients have no Live source for their reads.

## 14. Not done, and not verified by this row

- No request went through a listening server: every request is `app.inject` (P18). The first
  real HTTP run of these routes is the backend gate W58.
- The role-by-operation matrix over all 75 operations is W47's; here each operation has allowed
  and refused calls.
- The realtime side of a policy change (a `delta` with the replaced `storagePolicy` slice reaching
  a socket) is W42's; here the publication handed to `app.publish` is checked.
- A link that is down was not produced on the real engine host for operation 56 (no engine
  action brings the link down); the database-free test covers it.
- The clients (W71, W79 and the Network and Time pages) were not run against these routes.
