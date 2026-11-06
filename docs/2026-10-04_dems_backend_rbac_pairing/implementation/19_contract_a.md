---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 41
plan_row: W19 (wave B2; contract-owner slot, second holder, P17)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: needs-review (the contract is written and verified; two assertions in test files of step 34 fail by design and this row may not edit them: section 12, finding F-1)
---

# 19 Contract A (blueprint step 41, plan row W19)

Row, verbatim: [W19] Contract A: the registry model (`access`, `audit`, `mode`, answering
services), the envelope with 15 new codes, additive constants, the widened health schema, the text
rule API-13 on every free-text schema, the builder scope (offline 10, all), and the operations of
areas 1, 2, 3 and 13 with their bodies. Writes: `packages/shared/src/api/**`,
`packages/shared/openapi/**`, `packages/shared/scripts/gen-openapi.ts`,
`packages/shared/test/{openapi,schemas,sim-api-validation}.test.ts`,
`packages/shared/test/api-*.test.ts`. Slot: contract owner. Implements AC-B-13; SR-64; input to
AC-B-93. Rollback R-PRE.

**Result: every item of the row is written. Two of the row's verification commands do not exit 0,
and both failures are in files this row may not edit.** The envelope's two new optional members
change a type that `packages/shared/test/client-types.test.ts:123` pins, and the five operations
that answer 204 without a body break a loop in `packages/shared/test/client-core.test.ts:118` that
expects an example and a schema for every success. Both follow from the specification, not from a
choice of this row. The instruction for that case was to stop and report, so the two files are
untouched and a verified patch for their owner is in
`implementation/assets/19_proposed_client_test_changes.patch` (section 12, F-1).

| Field | Value |
|---|---|
| Registry after the row | **37 operations**: the 10 existing ones and 27 new ones (area 1: 8, area 2: 5, area 3: 9, area 13: 5); 14 GET, 23 POST; 50 named schemas (18 existing, 32 new) |
| Access and audit | Every entry carries exactly one access rule and one audit rule: 4 PUBLIC, 5 DEVICE, 10 AUTHENTICATED, 18 with one permission, 0 any-of (the one any-of operation is in contract C) |
| The ten existing operations | Path, method, path parameter, request schema, response schemas: equal to `acaff20`. They gained `access`, `audit` and `services` only (section 7) |
| Scopes | `offline` (the default): 10 operations. `all`: 37 |
| Committed `openapi.json` | Scope `offline`. 95,021 → 96,541 bytes. Four hunks, all in two components, all required by the specification: `HealthResponse` (two) and `ApiError` (two). Every operation, tag, text and the other 16 components are byte-equal (section 7.3) |
| Error codes | 31 (16 existing, 15 new) |
| Existing assertions edited | **One**: `packages/shared/test/openapi.test.ts:177-178` at `acaff20` (section 11.1) |
| Tests added | 96 in 6 new files and 2 extended files; 24 of 24 single mutations detected (section 11) |
| `npm run test -w @dems/shared -- --maxWorkers=2` | **exit 1: 784 passed, 1 failed** (`client-core.test.ts:118`, F-1) |
| `npm run typecheck -w @dems/shared` | **exit 2: one error** (`client-types.test.ts:123`, F-1) |
| `gen-openapi.ts --check`; web tests; typecheck of core-web and mobile; lint of the three | exit 0; 438 / 438 with `scalar-config.test.ts` unchanged; exit 0; exit 0 |

Evidence files: `implementation/assets/19_gate.log` (the final run, 08:38:40 to 08:40:41 WIB),
`19_openapi_offline_diff.txt`, `19_literal_table_activation_errors.txt`,
`19_proposed_client_test_changes.patch`.

---

## 1. The registry model as implemented

File: `packages/shared/src/api/contract-model.ts` (new; re-exported by `core-api.ts`, so every
existing import keeps working).

| Member of an entry | Type | Values |
|---|---|---|
| `mode` | `CoreApiMode` (unchanged: two values) | `simulated`: the in-app simulator can answer it (the nine design-book operations). `live`: only a service answers it (the other 28) [CS:AR-1] |
| `services` | `readonly [CoreApiService, ...]` | `dems-mock-core` and `dems-core-server` for `getServiceHealth`; `dems-core-server` for every other operation |
| `access` | `CoreApiAccess` | `{ kind: 'PUBLIC' }`, `{ kind: 'DEVICE' }`, `{ kind: 'AUTHENTICATED' }`, `{ kind: 'PERMISSION', permission }`, `{ kind: 'ANY_OF', permissions: [a, b, ...] }`; optional `conditions` |
| `audit` | `CoreApiAudit` | `success`: one audit type of the shared vocabulary, or `NONE-R` or `NONE-P`. `denial`: `ACCESS_DENIED` or `EXPORT_DENIED` (RB-5). Optional `also`: the other row types the call can write (a failed attempt, a second outcome, a side effect) |
| `query` | `{ schema: CoreApiSchemaName }`, optional | The query parameters of a GET as one object schema (D36). No operation of contract A uses it |
| `rbac` | unchanged | Only the four simulated commands; it still feeds their `x-dems-rbac` |

Two types. `CoreApiOperation` is what a transport needs; `access`, `audit` and `services` are
optional there, so a table written by hand for a test stays valid (the client tests build such
tables). `CoreApiRegistryOperation extends CoreApiOperation` makes the three mandatory. The registry
is declared `as const satisfies readonly CoreApiRegistryOperation[]`, so an entry without an access
rule or an audit rule does not compile, and `test/api-registry.test.ts` checks every entry at run
time.

`conditions` (a choice of this row, section 12 DN-4) state what an operation needs on top of its
marker, so that the server's guard has one machine-readable place for them:

| Condition | Operations | Answer when it does not hold |
|---|---|---|
| `CONSOLE_IDENTITY` (ID-1) | `signIn` | 403 `DEVICE_NOT_PAIRED` |
| `DEVICE_SESSION` | `setBiometricEnrollment` | 403 `DEVICE_NOT_PAIRED` |
| `DEMO_FLAG` (DC-2) | the five demo operations | 403 `DEMO_DISABLED`, after the permission check |

Helpers: `describeCoreApiAccess(access)` gives the marker as [SP:§4.2] writes it (`PUBLIC`,
`PAIRING_MANAGE`, `ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)`); `coreApiAccessPermissions(access)` the
permissions it names; `listCoreApiOperations(scope)`; `isOfflineCoreApiOperation(operation)`.

Permissions and audit types are imported from `packages/shared/src/sim/vocabulary.ts` (12 and 53,
D37); nothing was added to the vocabulary.

File layout (the folder's own style: one module per concern):

| File | Content | State |
|---|---|---|
| `contract-model.ts` | Tags, modes, services, access, audit, the two operation types | new (the tag, mode and operation types moved here from `core-api.ts`) |
| `text.ts` | The text rule API-13 | new |
| `identity.ts`, `administration.ts`, `pairing.ts`, `demo-controls.ts` | One area each: schemas, operations, examples | new |
| `operation-table.ts` | `CORE_API_OPERATION_TABLE` (section 8) | new |
| `operation-parts.ts`, `schema-parts.ts`, `example-parts.ts` | Shared texts, response specs, schema helpers, example placeholders. Not re-exported by `index.ts` | new |
| `core-api.ts` | The ten existing operations, the envelope, `CORE_API_SCHEMAS`, the table, the envelope-level answers, the helpers | changed |
| `openapi.ts`, `examples.ts`, `health.ts`, `constants.ts`, `patterns.ts`, `session-schema.ts`, `index.ts` | | changed, additively |

---

## 2. The 37 operations

Generated from the registry (`CORE_API_OPERATIONS`), not typed by hand. "Errors" lists the codes
each documented status names. Rows 1 to 10 are the existing operations; rows 11 to 37 are new.
The specification's operation number is in brackets.

| # | operationId | Method and path | Access | Audit on success; denial | Request | Success | Errors (per operation) | Mode |
|--:|---|---|---|---|---|---|---|---|
| 1 | `getServiceHealth` [1] | GET `/api/v1/health` | PUBLIC | NONE-R; ACCESS_DENIED | none | 200 `HealthResponse` | — | live |
| 2 | `createSession` [24] | POST `/api/v1/session` | SESSION_START | SESSION_CREATED; ACCESS_DENIED | `SessionCreateRequest` | 200, 201 `SessionCommandResponse` | 400, 401, 403, 409, 422 (as at `acaff20`) | simulated |
| 3 | `startSession` [25] | POST `/api/v1/session/{id}/start` | SESSION_START | RECORDING_STARTED (also PRECHECK_PASSED); ACCESS_DENIED | `SessionStartRequest` (optional) | 200, 202 `SessionCommandResponse` | 400, 401, 403, 404, 409 | simulated |
| 4 | `stopSession` [26] | POST `/api/v1/session/{id}/stop` | SESSION_START | RECORDING_STOPPED; ACCESS_DENIED | `SessionStopRequest` | 202 `SessionCommandResponse` | 400, 401, 403, 404, 409, 422 | simulated |
| 5 | `getCurrentSession` [27] | GET `/api/v1/session/current` | AUTHENTICATED | NONE-R; ACCESS_DENIED | none | 200 `CurrentSessionResponse` | — | simulated |
| 6 | `getDeviceHealth` [44] | GET `/api/v1/device/health` | AUTHENTICATED | NONE-R; ACCESS_DENIED | none | 200 `DeviceHealthResponse` | — | simulated |
| 7 | `getAudioStatus` [45] | GET `/api/v1/audio/status` | AUTHENTICATED | NONE-R; ACCESS_DENIED | none | 200 `AudioStatusResponse` | — | simulated |
| 8 | `getVideoStatus` [46] | GET `/api/v1/video/status` | AUTHENTICATED | NONE-R; ACCESS_DENIED | none | 200 `VideoStatusResponse` | — | simulated |
| 9 | `getStorageStatus` [53] | GET `/api/v1/storage/status` | AUTHENTICATED | NONE-R; ACCESS_DENIED | none | 200 `StorageStatusResponse` | — | simulated |
| 10 | `exportEvidence` [42] | POST `/api/v1/evidence/{id}/export` | EVIDENCE_EXPORT | EVIDENCE_EXPORTED; **EXPORT_DENIED** | `EvidenceExportRequest` | 202 `EvidenceExportAccepted` | 400, 401, 403, 404, 409, 422 | simulated |
| 11 | `signIn` [2] | POST `/api/v1/auth/sign-in` | PUBLIC + CONSOLE_IDENTITY | AUTH_SUCCESS (also AUTH_FAILED, AUTH_LOCKED); ACCESS_DENIED | `SignInRequest` | 200 `SignInResponse` | 400 INVALID_JSON; 401 INVALID_CREDENTIALS, NOT_SIGNED_IN; 403 DEVICE_NOT_PAIRED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_INPUT; 423 LOCKED | live |
| 12 | `getSignInStatus` [3] | GET `/api/v1/auth/status` | PUBLIC | NONE-R; ACCESS_DENIED | none | 200 `SignInStatus` | 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | live |
| 13 | `getAuthSession` [4] | GET `/api/v1/auth/session` | AUTHENTICATED | NONE-R; ACCESS_DENIED | none | 200 `AuthSessionInfo` | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | live |
| 14 | `signOut` [5] | POST `/api/v1/auth/sign-out` | AUTHENTICATED | AUTH_SIGNED_OUT; ACCESS_DENIED | `SignOutRequest` (optional) | **204** | 400; 401; 403; 422 | live |
| 15 | `touchSession` [6] | POST `/api/v1/auth/touch` | AUTHENTICATED | NONE-P; ACCESS_DENIED | none | 200 `AuthSessionExpiry` | 401; 403 | live |
| 16 | `setBiometricEnrollment` [7] | POST `/api/v1/auth/biometric` | AUTHENTICATED + DEVICE_SESSION | BIOMETRIC_ENROLLMENT_CHANGED; ACCESS_DENIED | `BiometricEnrollmentRequest` | 200 `BiometricEnrollment` | 400; 401; 403 DEVICE_NOT_PAIRED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 | live |
| 17 | `signInWithBiometric` [8] | POST `/api/v1/auth/biometric/sign-in` | DEVICE | AUTH_SUCCESS (also AUTH_FAILED, AUTH_LOCKED); ACCESS_DENIED | `BiometricSignInRequest` | 200 `SignInResponse` | 400; 401 INVALID_CREDENTIALS, NOT_SIGNED_IN; 403; 422; 423 LOCKED | live |
| 18 | `reportBiometricFailure` [9] | POST `/api/v1/auth/biometric/failure` | DEVICE | AUTH_FAILED (also AUTH_LOCKED); ACCESS_DENIED | `BiometricFailureRequest` | 200 `SignInStatus` | 400; 401; 403; 422 | live |
| 19 | `getRoleMatrix` [10] | GET `/api/v1/rbac/matrix` | AUTHENTICATED | NONE-R; ACCESS_DENIED | none | 200 `RoleMatrix` | 401; 403 | live |
| 20 | `listUsers` [11] | GET `/api/v1/admin/users` | USER_ADMIN | NONE-R; ACCESS_DENIED | none | 200 `AdminUserList` | 401; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | live |
| 21 | `assignUserRole` [12] | POST `/api/v1/admin/users/{id}/role` | USER_ADMIN | ROLE_CHANGED; ACCESS_DENIED | `UserRoleRequest` | 200 `AdminUser` | 400; 401; 403 NOT_PERMITTED; 404 NOT_FOUND; 409 LAST_ADMIN; 422 | live |
| 22 | `enableUser` [13] | POST `/api/v1/admin/users/{id}/enable` | USER_ADMIN | USER_ENABLED; ACCESS_DENIED | `UserStatusRequest` (optional) | 200 `AdminUser` | 400; 401; 403 NOT_PERMITTED; 404; 422 | live |
| 23 | `disableUser` [14] | POST `/api/v1/admin/users/{id}/disable` | USER_ADMIN | USER_DISABLED; ACCESS_DENIED | `UserStatusRequest` (optional) | 200 `AdminUser` | 400; 401; 403 NOT_PERMITTED; 404; 409 LAST_ADMIN; 422 | live |
| 24 | `issuePairingCode` [15] | POST `/api/v1/pairing/code` | PAIRING_MANAGE | PAIRING_CODE_ISSUED (also PAIRING_CODE_CLOSED); ACCESS_DENIED | none | 201 `PairingCodeIssued` | 401; 403 NOT_PERMITTED | live |
| 25 | `getPairingCodeStatus` [16] | GET `/api/v1/pairing/code` | PAIRING_MANAGE | NONE-R; ACCESS_DENIED | none | 200 `ActivePairingCode` | 401; 403 NOT_PERMITTED | live |
| 26 | `cancelPairingCode` [17] | POST `/api/v1/pairing/code/cancel` | PAIRING_MANAGE | PAIRING_CODE_CLOSED; ACCESS_DENIED | none | **204** | 401; 403 NOT_PERMITTED | live |
| 27 | `redeemPairingCode` [18] | POST `/api/v1/pairing/redeem` | PUBLIC | PAIRING_SUCCESS (also PAIRING_FAILED, PAIRING_LOCKED, PAIRING_CODE_CLOSED); ACCESS_DENIED | `PairingRedeemRequest` | 201 `PairingRedeemed` | 400; 401 INVALID_CODE, NOT_SIGNED_IN; 403 ORIGIN_NOT_ALLOWED; 422; 423 LOCKED | live |
| 28 | `listPairedDevices` [19] | GET `/api/v1/pairing/devices` | PAIRING_MANAGE | NONE-R; ACCESS_DENIED | none | 200 `PairedDeviceList` | 401; 403 NOT_PERMITTED | live |
| 29 | `revokeDevice` [20] | POST `/api/v1/pairing/devices/{id}/revoke` | PAIRING_MANAGE | DEVICE_REVOKED; ACCESS_DENIED | `DeviceRevokeRequest` | 200 `PairedDevice` | 400; 401; 403 NOT_PERMITTED; 404; 409 INVALID_STATE; 422 INVALID_REASON, INVALID_INPUT | live |
| 30 | `getDeviceRegistration` [21] | GET `/api/v1/pairing/device` | DEVICE | NONE-R; ACCESS_DENIED | none | 200 `DeviceRegistration` | 401; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | live |
| 31 | `unpairDevice` [22] | POST `/api/v1/pairing/device/unpair` | DEVICE | UNPAIRED; ACCESS_DENIED | none | **204** | 401; 403 | live |
| 32 | `rotateDeviceCredential` [23] | POST `/api/v1/pairing/device/credential` | DEVICE | DEVICE_CREDENTIAL_ROTATED; ACCESS_DENIED | none | 200 `DeviceCredentialRotated` | 401; 403 | live |
| 33 | `getDemoStatus` [71] | GET `/api/v1/demo/status` | DEMO_CONTROL + DEMO_FLAG | NONE-R; ACCESS_DENIED | none | 200 `DemoStatus` | 401; 403 NOT_PERMITTED, DEMO_DISABLED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | live |
| 34 | `loadScenario` [72] | POST `/api/v1/demo/scenario` | DEMO_CONTROL + DEMO_FLAG | SCENARIO_LOADED; ACCESS_DENIED | `ScenarioLoadRequest` | 200 `DemoEpoch` | 400; 401; 403 (as 33); 422 | live |
| 35 | `injectFault` [73] | POST `/api/v1/demo/faults` | DEMO_CONTROL + DEMO_FLAG | FAULT_RAISED (also AUDIT_CHAIN_DISCONTINUITY); ACCESS_DENIED | `DemoFaultRequest` | **204** | 400; 401; 403 (as 33); 404; 422 | live |
| 36 | `clearFault` [74] | POST `/api/v1/demo/faults/clear` | DEMO_CONTROL + DEMO_FLAG | FAULT_CLEARED; ACCESS_DENIED | `DemoFaultRequest` | **204** | 400; 401; 403 (as 33); 422 | live |
| 37 | `resetDemo` [75] | POST `/api/v1/demo/reset` | DEMO_CONTROL + DEMO_FLAG | SCENARIO_LOADED; ACCESS_DENIED | none | 200 `DemoEpoch` | 401; 403 (as 33) | live |

Rules the tables follow (and `api-registry.test.ts` enforces for the 27 new entries):

- Every new operation documents 403: the Origin guard applies to all of them. Every one that is not
  PUBLIC documents 401. An operation with a body documents 400 and 422. An operation with a
  permission names that permission and `NOT_PERMITTED` in its 403 [SP:§7.3].
- No operation repeats 405, 413, 429, 500 or 503: those are defined once (section 3.2).
- A GET writes no row (`NONE-R`); a POST never has `NONE-R`.
- A success has a schema unless it is 204. Five operations answer 204: `signOut`,
  `cancelPairingCode`, `unpairDevice`, `injectFault`, `clearFault`.
- The six operations whose body or answer holds a secret say so in their description (`signIn`,
  `setBiometricEnrollment`, `signInWithBiometric`, `issuePairingCode`, `redeemPairingCode`,
  `rotateDeviceCredential`) [CS:AR-3a].

New schemas (32), named as [SP:§7.18] names them; the bodies the specification writes inline got
a name here (DN-5): `SignInRequest`, `Operator`, `AuthSessionInfo`, `SignInResponse`,
`SignInStatus`, `SignOutRequest`, `AuthSessionExpiry`, `BiometricEnrollmentRequest`,
`BiometricEnrollment`, `BiometricSignInRequest`, `BiometricFailureRequest`, `RoleMatrix`,
`AdminUser`, `AdminUserList`, `UserRoleRequest`, `UserStatusRequest`, `PairingCodeIssued`,
`PairingCodeStatus`, `ActivePairingCode`, `PairingRedeemRequest`, `CoreIdentity`,
`PairingRedeemed`, `PairedDevice`, `PairedDeviceList`, `DeviceRevokeRequest`,
`DeviceRegistration`, `DeviceCredentialRotated`, `FaultTarget`, `DemoFaultRequest`,
`ScenarioLoadRequest`, `DemoEpoch`, `DemoStatus`.

Every new schema writes time as epoch milliseconds (API-5). Compile-time proofs in
`test/api-schemas.test.ts` hold four of them to the simulator's types: `Operator` is `SimOperator`,
`SignInStatus` is `LockoutStatus` plus `serverTime`, `FaultTarget` is `FaultTarget`,
`DemoStatus.activeFaults` is the `faults` slice.

---

## 3. The error envelope

### 3.1 Codes and members

`ApiErrorCode` (new) lists 31 codes: the 16 of `acaff20` in their order, then the 15 of [SP:§7.2]:
`INVALID_PATH`, `INVALID_CREDENTIALS`, `INVALID_CODE`, `ORIGIN_NOT_ALLOWED`, `DEVICE_NOT_PAIRED`,
`DEVICE_REVOKED`, `DEMO_DISABLED`, `RECORDING_ACTIVE`, `COMMAND_UNSUPPORTED`, `LAST_ADMIN`,
`PAYLOAD_TOO_LARGE`, `LOCKED`, `RATE_LIMITED`, `INTERNAL_ERROR`, `NOT_READY`.

`ApiErrorSchema` keeps `code` as a pattern-checked string, so the simulator's computed codes, the
typed client's own `TIMEOUT`, `NETWORK` and `CONTRACT_VIOLATION`, and any later code still parse.
Two optional members are added: `error.details` (a flat map of string, number, boolean or null)
and `error.requestId` (a non-empty string). A body without them parses to exactly what it was.
They are now kept by the parse; before, zod dropped them as unknown members, so the typed client
read `requestId` from the header only.

The answer the server scaffold builds today parses unchanged (`apps/core-server` unit tests:
526 / 526).

### 3.2 Answers defined once for every operation

`CORE_API_ENVELOPE_RESPONSES` (new), in the order of precedence of [SP:§7.3]:

| Status | Code | Stage | Header |
|--:|---|---|---|
| 400 | `INVALID_PATH` | routing | |
| 404 | `NOT_FOUND` (unknown route) | routing | |
| 405 | `METHOD_NOT_ALLOWED` | routing | `allow` |
| 503 | `NOT_READY` | pipeline | |
| 403 | `ORIGIN_NOT_ALLOWED` | pipeline | |
| 401 | `NOT_SIGNED_IN` with `details.reason: CREDENTIAL_CONFLICT` | pipeline | |
| 429 | `RATE_LIMITED` | pipeline | `retry-after` |
| 413 | `PAYLOAD_TOO_LARGE` | pipeline | |
| 500 | `INTERNAL_ERROR`, or the simulator's `SIMULATOR_ERROR` | pipeline | |

Seven of the nine are the statuses [SP:§7.2] defines "once at envelope level". The two refusals of
stages 3 and 4 are this row's addition (DN-2): both are decided before any access rule, for every
operation alike, and the ten existing operations may not gain a status in this row.

`validateCoreApiResponse(operationId, status, body)` now accepts a status the operation does not
document when it is a **pipeline** answer of this table with one of its codes (and its reason, for
the 401). A routing status is not accepted for a matched operation;
`validateCoreApiEnvelopeResponse(status, body)` (new) checks an answer that belongs to no
operation. A status nobody documents stays `UNDOCUMENTED_STATUS`.

---

## 4. The text rule API-13

File: `packages/shared/src/api/text.ts`. `isWellFormedText(value)` is false for a string that holds
U+0000 or an unpaired UTF-16 surrogate (a plain loop over the code units, because
`String.prototype.isWellFormed` is not in every runtime the contract loads in). `apiText()` is the
one string schema that carries the rule; when the rule fails it is the only issue of the field.

Where it is applied:

| Schemas | Members |
|---|---|
| Every schema of the 27 new operations, requests and answers | Every free-text string, through `apiText()` and the helpers of `schema-parts.ts`. Strings bound by a pattern or an enum refuse both inputs by their pattern |
| `SignInRequest` | `username`, and **`password`** (D30 D-b) |
| The ten existing operations, request side | `SessionCreateRequest` (`caseNumber`, `subjectName`, `investigatorId`, `room`, `notes`), `SessionStopRequest.reason`, `EvidenceExportRequest.reason` and `destination` |
| The ten existing operations, answer side | Untouched (AC-B-13): they describe what the simulator answers; a client never sends them |

The rule is a refinement, which JSON Schema cannot express: 16 of the 18 offline components are
byte-equal to `acaff20` (section 7.3).

Enforcement (`test/api-text-rule.test.ts`): a walker visits every string of every request-body
schema of the registry and of every new schema and fails when one accepts any of nine ill-formed
texts; a second test makes every string of every request example ill-formed, one at a time, and
expects a refusal.

The hypothesis of [DB:§13.1] is confirmed on this runtime:

```
Buffer.from('\ud83d', 'utf8').toString('hex')  →  efbfbd   (U+FFFD)
```

Through the simulated REST layer (`sim-api-validation.test.ts`): `POST /api/v1/session` with
U+0000 or an unpaired surrogate in `subjectName` answers 422 `INVALID_INPUT` and creates nothing.

---

## 5. Health, constants, patterns

- **`HealthResponse`** ([SP:§7.4]): `service` accepts `dems-mock-core` or `dems-core-server`;
  optional `ready: { database: boolean, engine: boolean }`. mock-core's answer parses unchanged.
- **Constants** (`constants.ts`, additive; no existing value changed): `CORE_SERVER_HOST`
  `127.0.0.1`, `CORE_SERVER_PORT` 4420, `CORE_SERVER_HTTP_ORIGIN`, `CORE_SERVER_WS_URL`,
  `CORE_SERVER_SERVICE_NAME` `dems-core-server` (the names of [PL:§3.4]; the scaffold's waiting
  comparison test now runs and passes); `API_BODY_LIMIT_BYTES` 65,536; the header names
  `REQUEST_ID_HEADER_NAME` `x-request-id` (D36), `EPOCH_HEADER_NAME` `x-dems-epoch`,
  `REVISION_HEADER_NAME` `x-dems-revision` (both stated as non-negative integers sent as decimal
  text, D36), `RETRY_AFTER_HEADER_NAME`, `ALLOW_HEADER_NAME`. A test holds them equal to the names
  the typed client reads.
- **Patterns** (`patterns.ts`, additive): `DEVICE_ID_PATTERN` `DEV-NNNN`, `PAIRING_CODE_ID_PATTERN`
  `PCD-NNNNNN` ([DB:§4.7, §4.8]), `PAIRING_CODE_PATTERN` (six digits), `PAIRING_QR_PAYLOAD_PATTERN`
  (`DEMS-PAIR:1:` and the code), and the three bearer secrets `SESSION_TOKEN_PATTERN`,
  `DEVICE_CREDENTIAL_PATTERN`, `BIOMETRIC_TOKEN_PATTERN` (a prefix and 43 base64url characters;
  DN-3).

---

## 6. The scope mechanism

`createOpenApiDocument({ scope })`, with `scope` one of `CoreApiScope.OFFLINE` (the default) and
`CoreApiScope.ALL`.

| | `offline` (default) | `all` |
|---|---|---|
| Operations | The ten a client can call without the Core server: `mode === simulated`, or answered by mock-core | Every entry: 37 |
| Components | The schemas those ten reach, directly or through a `$ref`, plus `Heartbeat`: the 18 of `acaff20`, in the same order | All 50 |
| Per operation | As at `acaff20` | Also `x-dems-access`, `x-dems-audit`, `x-dems-services`; a Core-server operation documents `x-request-id` on every answer and `x-dems-epoch` and `x-dems-revision` on a 2xx of a POST |
| `components.headers` | `XDemsSimulated` | Also `XRequestId`, `XDemsEpoch`, `XDemsRevision` (integers), `Allow`, `RetryAfter` |
| `components.responses` | none | The nine envelope-level answers |
| Tags | Service, Session, Device, Storage, Evidence, Realtime | Service, Identity, Administration, Pairing, Session, Device, Storage, Evidence, Demo, Realtime |
| `includeSimulated: false` | 1 operation (health), as today | 28 |

The call the web page makes today, `createOpenApiDocument({ includeSimulated })`, returns the
`offline` scope, so `apps/core-web/src/test/scalar-config.test.ts` passes with the file unchanged.

Generator (`packages/shared/scripts/gen-openapi.ts`): `OPENAPI_COMMITTED_SCOPE` is `offline`;
contract C sets it to `all`. Every run builds both scopes, so a registry that cannot be turned
into a document fails the check. `--scope <offline|all> --print` writes that scope to stdout and
no file.

```
$ node --import tsx packages/shared/scripts/gen-openapi.ts --check
packages/shared/openapi/openapi.json is up to date (offline (committed): 10 operations; all: 37 operations)
exit=0
```

Not built in the `all` scope (API-12; it belongs to contract C with the committed document of
that scope): the two security schemes, the server `http://127.0.0.1:4420`, `info.version` 0.2.0.
A test pins their absence so that the change is made on purpose.

---

## 7. The ten existing operations against the baseline

### 7.1 In the source

Every line removed from `core-api.ts` is one of: the model block that moved to
`contract-model.ts`, the declaration line of the array, a comment, the body of
`validateCoreApiResponse`, the three `z.string()` that became `apiText()`, the old code list.
Inside the ten entries nothing was removed; each gained three members:

```
$ git diff acaff20 --numstat -- packages/shared/src/api/core-api.ts
317	74	packages/shared/src/api/core-api.ts

$ git diff acaff20 -- packages/shared/src/api/core-api.ts | grep '^-' | grep -v '^---' \
    | grep -E "operationId|path:|method:|schema|responses|pathParam|requestBody|summary|description:|source:|tag:|mode:"
-  description: string;
-  /** Body schema; omitted for a response without a body. */
-  schema?: CoreApiSchemaName;
-  operationId: string;
-  method: CoreApiMethod;
-  path: string;
-  tag: CoreApiTag;
-  mode: CoreApiMode;
-  summary: string;
-  description: string;
-  source: string;
-  pathParam?: { name: 'id'; description: string; pattern: RegExp };
-  requestBody?: { schema: CoreApiSchemaName; required: boolean };
-  responses: Readonly<Record<number, CoreApiResponseSpec>>;
-export function findCoreApiOperation(operationId: string): CoreApiOperation | undefined {
- * the body must parse with that status's schema. For the sim handlers' tests and step 40 (CP-1).
```

Every removed line that names a member of an entry belongs to the two interfaces that moved to
`contract-model.ts`, to a helper's signature or to a comment. No line of an entry was removed.

### 7.2 In the registry (`test/api-registry.test.ts`, "AC-B-13")

The test compares, for each of the ten, operation ID, method, path, path-parameter pattern, request
schema and whether it is required, and the schema of every status with a literal table read from
the `openapi.json` of `acaff20`. It passes; the mutations M14 (an added status) and M15 (a changed
path) make it fail.

### 7.3 In the document (`test/api-openapi-scope.test.ts`)

SHA-256 of `JSON.stringify(section)`, baseline (`git show acaff20:packages/shared/openapi/openapi.json`)
against the offline document built now:

| Section | `acaff20` | Now | Equal |
|---|---|---|:-:|
| `[openapi, info]` | `932bce8c…bc213e` | `932bce8c…bc213e` | yes |
| `servers` | `81662220…76fc88` | `81662220…76fc88` | yes |
| `tags` | `eae2a20b…61d072` | `eae2a20b…61d072` | yes |
| `paths` (all ten operation objects) | `64d1bf9b…d98492` | `64d1bf9b…d98492` | yes |
| `components.headers` | `398f21cb…d53f67` | `398f21cb…d53f67` | yes |
| 16 components (all but the two below) | each equal | each equal | yes |
| `components.schemas.HealthResponse` | `df862263…898f4e` | `67973357…3324e9` | **no** |
| `components.schemas.ApiError` | `b38637a2…091c9f` | `97270133…384146` | **no** |

The test also undoes the documented additions on the two components and gets the baseline hash
back, so nothing else changed inside them.

The bytes that changed in the committed file (`assets/19_openapi_offline_diff.txt`; 4 hunks,
2 lines removed, 40 added):

| Hunk | Change | Required by |
|---|---|---|
| `HealthResponse.properties.service` | `"const": "dems-mock-core"` becomes `"enum": ["dems-mock-core", "dems-core-server"]` | [SP:§7.4] |
| `HealthResponse.properties.ready` | Added: an object with two required booleans; not in `required` | [SP:§7.4] |
| `ApiError…code.description` | The code list grows from 16 to 31 | [SP:§7.2] |
| `ApiError…details`, `ApiError…requestId` | Added, optional | [SP:§7.2] |

```
acaff20: 95,021 bytes, sha256 405660477abbe63c8bc66f11e5d0e3d3c65937b5e04f8437b55fe652e2192f20
now:     96,541 bytes, sha256 3d62fa662ad85295c1e207d2670673afd68229db935daa0659da6f8e3a21f6b3
```

The released 0.1.0 package is not rebuilt and is not affected; a rebuilt web page would show the
two widened components in its Models section and nothing else new.

---

## 8. The two gaps of D36

**Gap 1, the table with literal types.** `CORE_API_OPERATION_TABLE` exists, exported from
`packages/shared/src/api/operation-table.ts` and from `@dems/shared/api`. It is the registry's
table as written, `as const satisfies readonly CoreApiRegistryOperation[]`; `CORE_API_OPERATIONS`
is the same array with the widened type. A typed client built on it gets one typed `call` per
operation; `test/api-registry.test.ts` proves that at compile time (`CoreCallInput`,
`CoreCallSuccessOf`, four `@ts-expect-error` misuses) and at run time.

**It is not the typed client's default yet (deviation DR-1).** The client takes its default table
type from the exports of `core-api.ts`. Exporting the name there was measured: 18 type errors in
`packages/shared/test/client-core.test.ts` and 3 in `apps/mobile/src/runtime/dev-probes.ts`
(`assets/19_literal_table_activation_errors.txt`), all in files of step 34, which call the default
client with plain strings, empty bodies and `unknown` examples. So the name lives in a module the
client does not read. The switch is two lines in `core-api.ts` (declare the table there as
`export const CORE_API_OPERATION_TABLE`, delete `operation-table.ts`), once the owner has changed
those two files. Until then a caller opts in with `operations: CORE_API_OPERATION_TABLE`.

**Gap 2, the query member.** `CoreApiOperation.query?: { schema: CoreApiSchemaName }` exists; the
typed client already derives the query type from it (a compile-time test on a hand-built table).
The OpenAPI builder turns each member of the query schema into one `in: query` parameter
(`buildOpenApiQueryParameters`, tested on its own). No operation of contract A has a query.

Also from D36: the response header name `x-request-id` is pinned; `x-dems-epoch` and
`x-dems-revision` are stated as integers (constants, and the header components of the `all` scope).

The server scaffold's own gap of the same number (the health schema,
`apps/core-server/src/modules/health/health-schema.ts:4`) is closed on the contract side: the
shared schema now accepts its answer. Its local adapter and its marker are in files of row W08.

---

## 9. Files written

Tracked, changed (13; `git diff acaff20 --stat`: 815 insertions, 105 deletions):
`packages/shared/openapi/openapi.json`, `packages/shared/scripts/gen-openapi.ts`,
`packages/shared/src/api/{constants,core-api,examples,health,index,openapi,patterns,session-schema}.ts`,
`packages/shared/test/{openapi,schemas,sim-api-validation}.test.ts`.

New (16): `packages/shared/src/api/{administration,contract-model,demo-controls,example-parts,identity,operation-parts,operation-table,pairing,schema-parts,text}.ts`,
`packages/shared/test/{api-envelope,api-examples,api-openapi-scope,api-registry,api-schemas,api-text-rule}.test.ts`.

Outside the code: this document, `delegation_progress/coder_execution_step_41.md`, four files
under `implementation/assets/19_*`, and `.cache/rollback/W19.{pre,post}.patch` (git-ignored).

Not written: anything under `packages/shared/src/sim/`, `src/client/`, `src/live/`, any i18n file,
any `package.json`, anything in `apps/`, the client tests.

```
$ git diff acaff20 --stat -- packages/shared/src/sim apps/mock-core release
 packages/shared/src/sim/auth.ts       |  5 +++++
 packages/shared/src/sim/vocabulary.ts | 27 +++++++++++++++++++++++++++
 2 files changed, 32 insertions(+)                      (both are step 38's)
```

---

## 10. Verification (final run on the finished tree, 08:38:40 to 08:40:41 WIB)

Full output: `implementation/assets/19_gate.log`.

```
$ npm run test -w @dems/shared -- --maxWorkers=2
 ❯ test/client-core.test.ts (63 tests | 1 failed) 21ms
 FAIL  test/client-core.test.ts > AC-C-01: every registry operation is callable > calls each operation and returns every documented example as a typed success or a typed error envelope
Error: no example for signOut 204
 ❯ test/client-core.test.ts:118:22
 Test Files  1 failed | 43 passed (44)
      Tests  1 failed | 784 passed (785)
exit=1

$ node --import tsx packages/shared/scripts/gen-openapi.ts --check
packages/shared/openapi/openapi.json is up to date (offline (committed): 10 operations; all: 37 operations)
exit=0

$ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  39 passed (39)
      Tests  438 passed (438)
exit=0

$ git diff --stat acaff20 -- apps/core-web/src/test/scalar-config.test.ts   (prints nothing when unchanged)
(end)

$ npm run typecheck -w @dems/shared
test/client-types.test.ts(123,46): error TS2344: Type '{ code: string; message: string; }' does not satisfy the constraint '{ message: string; code: string; details: ...; requestId: ...; }'.
exit=2
$ npm run typecheck -w @dems/core-web        exit=0
$ npm run typecheck -w @dems/mobile          exit=0
$ npm run typecheck -w @dems/mock-core       exit=0
$ npm run typecheck -w @dems/core-server     exit=0
$ npm run lint -w @dems/shared               exit=0
$ npm run lint -w @dems/core-web             exit=0
$ npm run lint -w @dems/mobile               exit=0

Not gates of this row, run because the change reaches these workspaces:
$ npm run test -w @dems/core-server -- --maxWorkers=2    Test Files 24 passed (24), Tests 526 passed (526), exit=0
$ npm run test -w @dems/mobile -- --maxWorkers=2         Test Suites: 72 passed, Tests: 833 passed, exit=0
```

Root `npm run typecheck` was not run as one command; the five workspace commands above are its
parts. The mock-core test suite was not run (P5).

| Verification item of the row | Result |
|---|---|
| Shared tests exit 0 | **No**: 784 of 785; the one failure is F-1 (b) |
| `gen-openapi.ts --check` exit 0 | Yes |
| 37 operations in the `all` scope (10 existing, 27 new), each with `access` and `audit` | Yes (sections 1, 2) |
| The ten existing ones equal their baseline path, method and schemas | Yes (section 7) |
| The `offline` scope yields ten | Yes |
| Web tests 438 passed with `scalar-config.test.ts` unchanged | Yes |
| The `client-*` tests pass unchanged | **No**: unchanged, and 75 of 76 pass; `client-types.test.ts:123` fails the typecheck (F-1) |
| Typecheck and lint exit 0 for the three workspaces | Lint yes. Typecheck: core-web and mobile yes; **shared no** (one error, F-1 (a)) |
| Nothing from this row under `src/sim`, `apps/mock-core`, `release` | Yes |

---

## 11. Tests

### 11.1 Existing assertions edited (one)

| File and lines at `acaff20` | Before | After (now lines 204-209) | Why |
|---|---|---|---|
| `packages/shared/test/openapi.test.ts:177-178` | Title "generates one component per contract schema, from the zod schemas"; `expect(Object.keys(document.components.schemas)).toEqual(Object.keys(CORE_API_SCHEMAS))` | Title "… per contract schema of its scope …"; the offline document's components equal the 18 baseline names (a literal list, added at line 54); those are the first 18 keys of `CORE_API_SCHEMAS`; the `all` scope's components equal every key | By design ([SP:§7.19]; [PL:CO-4]): the registry holds 50 schemas, the offline document the 18 its ten operations use. The old statement stays true for the `all` scope and is asserted there |

Every other assertion of the three pinned files is unchanged and still passes on the offline scope:
10 operations, exactly one LIVE, the four `x-dems-rbac` operations, no security scheme, one host,
the simulator comparison. `schemas.test.ts` gained one `describe` (3 tests, from line 57);
`sim-api-validation.test.ts` gained one `describe` (3 tests, lines 96-118) and one import name.

### 11.2 Tests added (96)

| File | Tests | Subject |
|---|--:|---|
| `test/api-registry.test.ts` (new) | 26 | 37 operations; the 27 against a literal table of the specification; the ten against their baseline; access and audit of every entry; counts; conditions; services and scopes; structure (API-2, API-3, [SP:§7.3]); routing without overlap; the literal table and the typed client; all 37 operations called through the typed client, a 204 included; the `query` member |
| `test/api-text-rule.test.ts` (new) | 12 | API-13 |
| `test/api-envelope.test.ts` (new) | 13 | 31 codes; `details` and `requestId`; the envelope-level answers; the two validators; the constants and header names |
| `test/api-openapi-scope.test.ts` (new) | 18 | The offline scope against the baseline hashes; the `all` scope; the query parameters |
| `test/api-examples.test.ts` (new) | 8 | Every new operation has examples that parse; they follow the canonical dataset; no example holds a secret |
| `test/api-schemas.test.ts` (new) | 13 | The schemas of the four areas; four compile-time proofs against the simulator's types |
| `test/schemas.test.ts` | +3 | The widened health body |
| `test/sim-api-validation.test.ts` | +3 | The text rule through the simulated REST layer |

### 11.3 Can the tests fail? (24 single changes, each restored)

Each change was made to one source file of this row, the nine test files of this row were run, and
the file was restored (`git diff` against the saved post-image: equal). 24 of 24 were detected:
a wrong path; a wrong access marker; a wrong audit rule; U+0000 let through; a lone low surrogate
let through; the password without the text rule; the password without the code-unit bound; the
stop reason without the rule; health narrowed again; `requestId` dropped; a code missing; the
default scope set to `all`; the registry metadata leaking into the offline document; an existing
operation with one more response; an existing operation with another path; a demo operation without
the demo-flag condition; the published demo password in an example; a credential-shaped example
that is not the placeholder; a wrong port constant; a pipeline answer accepted with any code; a
routing status accepted for a matched operation; health answered by the Core server only; the
export with `ACCESS_DENIED`; the pairing code without its pattern.

### 11.4 Test ledger (P24)

| Workspace | Before this row | After | Note |
|---|---|---|---|
| `@dems/shared` | 680 passed in 37 files (07:56 WIB, before the first edit) | **785 in 44 files: 784 passed, 1 failed** | +96 tests and +6 files are this row's. +9 tests and +1 file (`live-light-constants.test.ts`) arrived from step 40 while this row ran (689 in 38 files at 08:18, before this row's first test file) |
| `@dems/core-web` | 438 in 39 | 438 passed in 39 | no change |
| `@dems/mobile` | 833 in 72 suites | 833 passed in 72 | no change |
| `@dems/core-server` (unit) | 526 in 24 at this row's first run | 526 passed in 24 | no change; its waiting constants comparison now runs |

Expected shared total = 689 + 96 = 785. The gate does not pass: failed is 1 (F-1).

---

## 12. Findings, deviations and decisions for the controller (P22)

### Findings

**F-1 (blocks the row's gate). Two assertions in step 34's client tests fail by design.** The
files are not this row's and were not edited (`stat`: 07:02:48 and 07:12:48, in the gate log).

| | Where | What fails | Cause, with its source |
|---|---|---|---|
| (a) | `packages/shared/test/client-types.test.ts:123` | `expectTypeOf(result.error).toEqualTypeOf<{ code: string; message: string }>()` is a compile error (TS2344); `npm run typecheck -w @dems/shared` exits 2 | The envelope member gained the optional `details` and `requestId` [SP:§7.2]. The runtime tests of that file pass |
| (b) | `packages/shared/test/client-core.test.ts:118`, then `:129-130` | The loop over every registry operation calls `example(operationId, status)` for every status and throws `no example for signOut 204`; behind it `expect(schemaName).toBeDefined()` would fail for every 2xx without a body | Five operations answer 204 without a body [SP:§7.5, §7.7, §7.16]. The client itself handles a bodiless success (its own test table has a 204) |

Proposed change for the owner, 4 lines replaced by 8
(`implementation/assets/19_proposed_client_test_changes.patch`): in (a) compare with
`ApiError['error']` and keep the old shape as a `toExtend`; in (b) take the example only for a
status that has a schema and expect `data` to be undefined otherwise. Checked on temporary copies
of the two files (created under an `api-tmp-` name in this row's path and deleted): the three
client test files give 76 passed of 76, and the copies add no type error. This row's own
`api-registry.test.ts` runs the corrected loop over all 37 operations and passes.

**F-2. The literal table as the typed client's default breaks 21 lines in two files of step 34**
(section 8; `assets/19_literal_table_activation_errors.txt`). It is why DR-1 exists.

**F-3. zod's `.max(n)` counts code points, not UTF-16 code units.** Measured on zod 4.6.5:
`z.string().max(2)` accepts two astral characters (four code units). D30 D-a assumed the opposite,
and the password hash wrapper counts `password.length`
(`apps/core-server/src/modules/identity/password-hash/password-hash.ts:192`). With the body written
exactly as `z.string().min(1).max(128)`, a password of 65 to 128 astral characters would pass the
contract and make the wrapper throw `PASSWORD_TOO_LONG`. `SignInRequest.password` therefore also
carries `value.length <= 128` (DN-1). The other limits of the new schemas (device name 60, platform
32, version 32, reasons 500) are compared with PostgreSQL `char_length`, which also counts code
points, so they agree as they are. Present at the baseline and not changed here: `sessionCreateSchema`
accepts a subject name of 120 code points, and the simulator's `isValidSessionInput` refuses one
above 120 code units.

**F-4. No new key can be added to `SESSION_CREATE_MESSAGES` by a contract row.**
`apps/core-web/src/features/session-new/__tests__/session-new.test.tsx:155` requires an i18n
resource for every value of that map, and i18n files are not this row's. The text rule's message on
the session fields is therefore the contract's English sentence (`API_TEXT_RULE_MESSAGE`), which a
form would show as it is. A first version of this row added a key; the web suite caught it
(437 of 438) and it was removed.

**F-5. A reason that is too short: `INVALID_INPUT` or `INVALID_REASON`?** [SP:§7.7] gives
`revokeDevice` a 422 `INVALID_REASON`. `DeviceRevokeRequest.reason` has its minimum of 5 in the
schema, as `SessionStopRequest` and `EvidenceExportRequest` always had, so stage 7 of the server
answers 422 `INVALID_INPUT` before the handler runs. The simulator answers `INVALID_REASON` because
it checks the reason itself. The pairing row (and the rows of stop and export) must map a `reason`
issue to `INVALID_REASON`, or the table needs a ruling. The 422 of `revokeDevice` documents both
codes.

**F-6. The vendor-extension check of `openapi.test.ts:154-156` counts header names.** It collects
every key that starts with `x-`, the names inside a `headers` map included. It passes on the
offline document only because its one header, `x-dems-simulated`, happens to match `^x-dems-`. In
the `all` scope `x-request-id` is a header name. `api-openapi-scope.test.ts` skips `headers` maps;
contract C needs the same when it moves that assertion to the `all` scope.

**F-7. A stale comment, left as it is.** `session-schema.ts:19-20` says the keys marked "(add)" are
not in the i18n resources yet; the web test of F-4 shows they are.

**F-8. The scaffold's local health adapter can go.** `apps/core-server/src/modules/health/health-schema.ts`
restates the two widened members and carries the marker `CONTRACT-GAP-1`; the shared schema now has
both. The file is W08's.

### Deviations from the plan

| ID | Deviation | Why |
|---|---|---|
| DR-1 | `CORE_API_OPERATION_TABLE` is exported from `operation-table.ts` and `@dems/shared/api`, not from `core-api.ts`, so it is not the typed client's default table type yet | F-2: the faithful placement breaks the typecheck of `@dems/shared` in 18 more places and of `@dems/mobile` in 3. D36's own clause (export under that name, keep the widened view) is met |
| DR-2 | The row's status is `needs-review`: two verification commands do not exit 0 | F-1 |
| DR-3 | `implementation/99_implementation_report.md`, `masterplan/02_plan.md` and `status_tasks.md` were not written | The parallel-run contract of this delegation (P8) |
| DR-4 | Two temporary edits, both restored: the measurement of F-2 changed `core-api.ts` and `index.ts` for one typecheck run (restored, `cmp` equal); the check of F-1's patch created and deleted two copies of the client tests under `packages/shared/test/api-tmp-*` | To report measured facts instead of estimates |

### Decisions needed

| ID | Decision | This row's choice |
|---|---|---|
| DN-0 | **Who changes the two client test lines of F-1**, as a recorded by-design test change (P24) | Not this row. The patch is ready and checked |
| DN-1 | The password bound: code units, on top of `.max(128)` (F-3) | Added, so the contract and the wrapper of W09 agree. D30 D-a's wording should be corrected: zod counts code points |
| DN-2 | The envelope-level set: the seven statuses of [SP:§7.2] plus 403 `ORIGIN_NOT_ALLOWED` and 401 `NOT_SIGNED_IN` with `CREDENTIAL_CONFLICT` | Added. The alternative is that contract C documents 401 and 403 on the six reads and on health |
| DN-3 | Token forms in answers: `ses_`, `dvc_`, `bio_` and 43 base64url characters. The specification states the form for the first two (ID-P6, PR-P8) and only "256-bit" for the third. In requests, the biometric token is any text of 1 to 256 characters, so that every value sent is an attempt the server counts | As stated; the biometric row follows it or raises a gap |
| DN-4 | `access.conditions` (`CONSOLE_IDENTITY`, `DEVICE_SESSION`, `DEMO_FLAG`) as part of the model | Added: the guard needs to know which operations check the demo flag |
| DN-5 | Names of the bodies the specification writes inline (section 2), and three nested components (`Operator`, `CoreIdentity`, `FaultTarget`) | As listed |
| DN-6 | Optional administration reasons: at most 500 characters after trimming, empty allowed and meaning none. The specification gives no bound | As stated |
| DN-7 | `AuthSessionInfo.method` is `PASSWORD` or `BIOMETRIC` only ([DB:AUTH_METHOD]) | As stated |
| DN-8 | When to make the literal table the client's default (DR-1) | After the owner of step 34 has changed its two files, or never, with callers opting in |

---

## 13. Open points for contract B, contract C and the close-out

| For | Point |
|---|---|
| W22 (B) | The realtime union and the 28 slice schemas. `Operator` (the `operators` slice) and `FaultTarget` exist as named components |
| W27 (C) | API-12 in the `all` scope: two security schemes (they follow from `access`: none for PUBLIC, bearer for DEVICE, cookie or bearer otherwise), the server `127.0.0.1:4420`, `info.version` 0.2.0. Then `OPENAPI_COMMITTED_SCOPE = 'all'`; the test "what contract C still owes this scope" changes by design |
| W27 | The info summary, the info description and the tag texts describe the offline document; in the `all` scope they are wrong in places ("left out here on purpose") |
| W27 | [SP:§7.19]: the six reads gain a documented 401; the simulator comparison of `openapi.test.ts` must then be limited to the statuses the simulator can produce |
| W27 | The one any-of: `{ kind: 'ANY_OF', permissions: [EVIDENCE_REVIEW, MAINTENANCE] }`. The first `query` schemas and the paging constants of API-9 |
| W27 | `x-dems-rbac` for the 41 permission operations: the matrix is in `sim/auth.ts`, which is not a leaf module, so the registry does not restate role holders. `x-dems-access` carries the permission |
| W27 | F-6 |
| W83 | KI-18, eight places, untouched. Their lines today: `core-api.ts:5-8` (header table) and `:485` (the health description; `:427` at `acaff20`); `openapi.ts:5-6` (header), `:178` (info summary), `:186` (badge legend row), `:204` and `:219` (the Service and Realtime tag texts), `:552` (server description); the same texts in `openapi.json`; `apps/core-web/src/features/api-reference/api-document.ts:110-121` is the web's. No new entry repeats the sentence (a test checks the 27 descriptions) |
| W83 or W84 | Badges of the `all` scope: a new operation carries `LIVE`. The neutral `CORE SERVER` badge of [CS:AR-2] can be derived from `x-dems-services` |
| W23, W24, W28, W32, W43 | `operation.access`, `operation.audit`, `CORE_API_ENVELOPE_RESPONSES`, `ApiErrorCode`, `API_BODY_LIMIT_BYTES`, the header name constants are there to import. F-5 |
| W12's owner | F-1, F-2 |

---

## 14. Rollback (R-PRE)

Pre-image: `.cache/rollback/W19.pre.patch` (0 bytes: the paths equalled `acaff20`). Post-image:
`.cache/rollback/W19.post.patch` (70,897 bytes).

```
git checkout acaff20 -- packages/shared/src/api packages/shared/openapi packages/shared/scripts/gen-openapi.ts \
  packages/shared/test/openapi.test.ts packages/shared/test/schemas.test.ts packages/shared/test/sim-api-validation.test.ts
git apply --allow-empty .cache/rollback/W19.pre.patch
rm packages/shared/src/api/{administration,contract-model,demo-controls,example-parts,identity,operation-parts,operation-table,pairing,schema-parts,text}.ts
rm packages/shared/test/api-{envelope,examples,openapi-scope,registry,schemas,text-rule}.test.ts
```

The rollback also removes the `CORE_SERVER_*` constants; the scaffold's comparison test then skips
again, as it is written to do.

---

## 15. Not done here

Areas 4 to 12 and the realtime union; the committed document of the `all` scope; server and client
code; any i18n text; the correction of KI-18; the two client test lines of F-1.

*Written 2026-10-04 08:45 WIB.*
