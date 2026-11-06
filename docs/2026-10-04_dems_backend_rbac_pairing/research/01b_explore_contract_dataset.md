---
task_id: 2026-10-04_dems_backend_rbac_pairing
date: 2026-10-04
agent: explore
step: 2
scope: API contract (packages/shared/src/api, openapi, drift test, network constants and consumers); canonical demo dataset (sim/dataset.ts, sim/initial-state.ts, sim/generator.ts, sim/scenarios.ts, sim/demo-alignment.ts); src/demo-data and its join rule; media under packages/shared/assets
narrative_tier: 2
mode: read-only inventory (no source file changed, no process started, no web call)
---

# Row 2 Exploration: API Contract and Demo Dataset (Tier 2)

## Overview

This inventory maps what exists today so that a new PostgreSQL-backed backend can serve the contract and be seeded from the dataset. It reports structure only. It does not design the backend.

Baseline: git `HEAD` is `acaff20`. `git diff --stat HEAD -- packages/shared` printed nothing at run time, so the files below equal the committed baseline.

Headline numbers (each is verified in the section named in the last column):

| Quantity | Value | Section |
|---|---|---|
| Entries of `CORE_API_OPERATIONS` | **10** (1 LIVE, 9 SIMULATED) | 1.2 |
| Named schemas in `CORE_API_SCHEMAS` | 18 | 1.3 |
| Documented HTTP responses over all operations | 34 | 1.2 |
| Operations with an `rbac` block | 4 (3 use SESSION_START, 1 uses EVIDENCE_EXPORT) | 1.2 |
| Seeded operators / roles / permissions | 3 / 3 / 9 | 2.2 |
| Seeded evidence items (= session-history entries) | 13 | 2.2, 2.5 |
| Seeded audit rows / operational events (derived by static count) | 82 / 59 | 2.6 |
| Scenarios | 4 (`idle`, `recording`, `finalizing`, `fault-demo`) | 2.7 |
| DEMO packages in `src/demo-data` | 14 (13 DATASET + 1 RECORDING_SCENARIO) | 3 |
| Media under `packages/shared/assets/demo-media` | **198 files, 43,564,652 bytes** | 4 |
| Whole `packages/shared/assets` tree | 292 files, 48,231,787 bytes | 4 |

### How the information was obtained

| Source | Used for |
|---|---|
| Graft graph (`graft map`; `graft callers createOpenApiDocument`, `validateCoreApiResponse`, `matchCoreApiOperation`, `createIdleState`, `buildHistory`, `fetchHealth`, `todaySchedule`; `graft ask`) | Orientation (`packages/shared/src/api/` has 9 files and 69 symbols; `packages/shared/src/sim/` has 33 files; `packages/shared/src/demo-data/` has 7 files), and the caller lists quoted in 1.8, 2.1 and 3 |
| Direct inspection (`Read`, `grep`, `sed`, `find`, `stat`, `ls`, `diff -rq`, `git` read-only) | Everything else. `graft skeleton` answered "no definitions indexed for this file" for `core-api.ts` and `dataset.ts` (constant-heavy modules), so those were read in full |

Tool notes: the `Grep` tool was not available in this agent, so `grep` ran through the shell. The Graft MCP tools were not available, so the Graft CLI (0.18.0) was used.

---

## 1. API contract: `packages/shared/src/api/`

### 1.1 Module map

| File | Lines | Role | Status |
|---|---|---|---|
| `packages/shared/src/api/constants.ts` | 32 | Network constants (see 1.8) | EXISTING |
| `packages/shared/src/api/core-api.ts` | 731 | Error body, REST body schemas, `CORE_API_SCHEMAS`, `CORE_API_OPERATIONS`, `matchCoreApiOperation`, `validateCoreApiResponse` | EXISTING |
| `packages/shared/src/api/examples.ts` | 464 | `CORE_API_EXAMPLES` (keyed by operationId), `EXAMPLE_IDS`, `OPENAPI_EXAMPLE_INSTANT`, `HEARTBEAT_EXAMPLE` | EXISTING |
| `packages/shared/src/api/health.ts` | 50 | `HealthResponse`, `HealthResponseSchema`, `HEALTH_QUERY_KEY`, `fetchHealth` | EXISTING |
| `packages/shared/src/api/index.ts` | 10 | Barrel: constants, health, realtime-messages, patterns, session-schema, core-api, examples, openapi | EXISTING |
| `packages/shared/src/api/openapi.ts` | 391 | OpenAPI 3.1.0 builder, `API_BADGES`, `OPENAPI_ALLOWED_EXTENSION`, `createOpenApiDocument`, `serializeOpenApiDocument`, `listOpenApiOperations` | EXISTING |
| `packages/shared/src/api/patterns.ts` | 30 | ID and error-code regular expressions | EXISTING |
| `packages/shared/src/api/realtime-messages.ts` | 42 | `Heartbeat`, `HeartbeatSchema`, `WsServerMessageSchema` | EXISTING |
| `packages/shared/src/api/session-schema.ts` | 111 | `sessionCreateSchema`, `SESSION_INPUT_LIMITS`, `SESSION_CREATE_MESSAGES` | EXISTING |
| `packages/shared/openapi/openapi.json` | 95,021 bytes | Committed generated document | EXISTING |
| `packages/shared/scripts/gen-openapi.ts` | 67 | Generator and `--check` mode | EXISTING |
| `packages/shared/test/openapi.test.ts` | 436 | Drift test and contract-versus-simulator test | EXISTING |

Package export `@dems/shared/api` maps to `./src/api/index.ts` (`packages/shared/package.json:9`). The root entry also re-exports it (`packages/shared/src/index.ts:7`); no file under `apps/` imports the root entry (`grep "from '@dems/shared'" apps/` printed nothing).

Dependency direction to note: `core-api.ts` imports leaf modules of the simulator, `../sim/constants` and `../sim/vocabulary` (`core-api.ts:34-48`), while `sim/session-machine.ts:17` and `sim/engine.ts:29` import back from `../api/session-schema` and `./api`.

### 1.2 Operation table (one row per `CORE_API_OPERATIONS` entry)

Count verification:

```
$ grep -n "operationId: '" packages/shared/src/api/core-api.ts | wc -l
10
```

The array spans `core-api.ts:418-650`. `packages/shared/test/openapi.test.ts:100` asserts `expect(operations).toHaveLength(10)`.

| # | operationId | Method and path | Tag | Mode | Request body | Documented responses (status → body) | RBAC in contract (permission → roles; audit types) | Contract lines | Simulated handler |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `getServiceHealth` | GET `/api/v1/health` | Service | **live** | none | 200 → `HealthResponse` | none | `core-api.ts:419-432` | served by mock-core `apps/mock-core/src/app.ts:77` (row 5 covers it) |
| 2 | `createSession` | POST `/api/v1/session` | Session | simulated | `SessionCreateRequest`, required | 200, 201 → `SessionCommandResponse`; 400, 401, 403, 409, 422 → `ApiError` | SESSION_START → INVESTIGATOR, SUPERVISOR; audit `SESSION_CREATED` | `core-api.ts:433-462` | `sim/api.ts:364-385` |
| 3 | `startSession` | POST `/api/v1/session/{id}/start` | Session | simulated | `SessionStartRequest`, optional | 200, 202 → `SessionCommandResponse`; 400, 401, 403, 404, 409 → `ApiError` | SESSION_START → INVESTIGATOR, SUPERVISOR; audit `PRECHECK_PASSED`, `RECORDING_STARTED` | `core-api.ts:463-501` | `sim/api.ts:397-431` |
| 4 | `stopSession` | POST `/api/v1/session/{id}/stop` | Session | simulated | `SessionStopRequest`, required | 202 → `SessionCommandResponse`; 400, 401, 403, 404, 409, 422 → `ApiError` | SESSION_START → INVESTIGATOR, SUPERVISOR; audit `RECORDING_STOPPED` | `core-api.ts:502-532` | `sim/api.ts:432-446` |
| 5 | `getCurrentSession` | GET `/api/v1/session/current` | Session | simulated | none | 200 → `CurrentSessionResponse` | none | `core-api.ts:533-548` | `sim/api.ts:386-396` |
| 6 | `getDeviceHealth` | GET `/api/v1/device/health` | Device | simulated | none | 200 → `DeviceHealthResponse` | none | `core-api.ts:549-564` | `sim/api.ts:447-451` |
| 7 | `getAudioStatus` | GET `/api/v1/audio/status` | Device | simulated | none | 200 → `AudioStatusResponse` | none | `core-api.ts:565-580` | `sim/api.ts:452-456` |
| 8 | `getVideoStatus` | GET `/api/v1/video/status` | Device | simulated | none | 200 → `VideoStatusResponse` | none | `core-api.ts:581-593` | `sim/api.ts:457-461` |
| 9 | `getStorageStatus` | GET `/api/v1/storage/status` | Storage | simulated | none | 200 → `StorageStatusResponse` | none | `core-api.ts:594-609` | `sim/api.ts:462-466` |
| 10 | `exportEvidence` | POST `/api/v1/evidence/{id}/export` | Evidence | simulated | `EvidenceExportRequest`, required | 202 → `EvidenceExportAccepted`; 400, 401, 403, 404, 409, 422 → `ApiError` | EVIDENCE_EXPORT → SUPERVISOR; audit `EVIDENCE_EXPORTED`, `EXPORT_DENIED` | `core-api.ts:610-649` | `sim/api.ts:467-480` |

Sources and path parameters:
- `{id}` is a single path parameter named `id` (`CoreApiOperation.pathParam`, `core-api.ts:406`). Rows 3 and 4 use `SESSION_ID_PATTERN`; row 10 uses `EVIDENCE_ID_PATTERN` (`core-api.ts:482, 516, 627`).
- `source` field: rows 2 to 10 say "Design book §21.2" (row 10 also §19.2 and §19.3); row 1 says "masterplan/01_specs.md §2.5, §3.2 (demo; not in the design book)" (`core-api.ts:428`).
- Total documented responses: 1 + 7 + 7 + 7 + 1 + 1 + 1 + 1 + 1 + 7 = 34 (counted from the `responses` blocks).
- The simulated route table that the drift test compares against is `SIM_API_ROUTES` (`sim/api.ts:42-51`, 9 entries) and every simulated response carries `x-dems-simulated: 1` (`sim/api.ts:36-39`).

**Finding 1.2-A: only 10 operations exist; the clients use far more behaviour than the contract names.**
- What: the contract has no operation for sign-in, session or token handling, pairing, evidence list or detail, verification, audit list, device control, diagnostics, maintenance, settings, demo controls, or user and role administration. The OpenAPI description says so itself (`openapi.ts:155-162`: "authentication or login, pairing, metadata submission, evidence list, audit list or verification endpoints (left out here on purpose)"). The simulator has 42 `SimActions` members by the blueprint's count (`packages/shared/src/sim/types.ts:985-1094`, row 1 owns the exact table).
- Why it matters: a backend that serves "this contract" serves 10 operations; every other feature the apps show has no wire shape yet. Rows 15 and 98 extend the contract.
- Verified: read `core-api.ts:418-650`, `openapi.ts:155-162`; operation count command above.

**Finding 1.2-B: the six read operations and the health operation have no permission and no 401 or 403 response.**
- What: operations 1 and 5 to 9 document only status 200 and have no `rbac` field (`core-api.ts:429-431, 545-547, 561-563, 577-579, 590-592, 606-608`). In the simulator only `createSession`, `startSession` and `stopSession` call `sessionAccess` (`sim/api.ts:354-362`, used at 369, 401, 436); the GET handlers do not.
- Why it matters: in a server with RBAC every read needs an authentication rule; the contract currently says reads are open. The blueprint's operation-to-permission table (row 15) has to decide this; the contract cannot be used as the source of read permissions.
- Verified: grep `sessionAccess(` in `sim/api.ts` (4 hits: definition plus 3 calls).

**Finding 1.2-C: the contract's roles list for each RBAC operation is checked against the simulator's role table.**
- What: `x-dems-rbac.roles` must equal the roles that hold the permission per `roleHas` (`openapi.test.ts:129-133`). The roles lists in the contract are literal arrays (`core-api.ts:459, 498, 529, 646`).
- Why it matters: adding a permission or changing the matrix (Q9, Q10) forces a matching edit in `core-api.ts` or the test goes red.
- Verified: read the test lines cited.

### 1.3 Schemas (`CORE_API_SCHEMAS`, 18 entries, `core-api.ts:337-357`)

| Component name | Defined at | Used by |
|---|---|---|
| `HealthResponse` | `health.ts:23-35` | op 1 (200) |
| `SessionCreateRequest` | `session-schema.ts:74-106` | op 2 request |
| `SessionStartRequest` | `core-api.ts:100-108` | op 3 request |
| `SessionStopRequest` | `core-api.ts:110-119` | op 4 request |
| `SessionCommandResponse` | `core-api.ts:121-128` | ops 2, 3, 4 |
| `PrecheckItem` | `core-api.ts:130-138` | inside `SessionResource.precheck.items` (exactly 8) |
| `SessionResource` | `core-api.ts:140-171` | inside `CurrentSessionResponse` (18 top-level fields) |
| `CurrentSessionResponse` | `core-api.ts:173-179` | op 5 |
| `VideoTrackStatus` | `core-api.ts:185-199` | `VideoStatusResponse`, `DeviceHealthResponse.cameras` |
| `AudioChannelStatus` | `core-api.ts:201-216` | `AudioStatusResponse`, `DeviceHealthResponse.audio` |
| `VideoStatusResponse` | `core-api.ts:218-221` | op 8 |
| `AudioStatusResponse` | `core-api.ts:223-228` | op 7 |
| `StorageStatusResponse` | `core-api.ts:230-258` | op 9, `DeviceHealthResponse.storage` |
| `DeviceHealthResponse` | `core-api.ts:260-294` | op 6 |
| `EvidenceExportRequest` | `core-api.ts:300-315` | op 10 request |
| `EvidenceExportAccepted` | `core-api.ts:317-326` | op 10 (202) |
| `ApiError` | `core-api.ts:81-94` | every 4xx and 5xx |
| `Heartbeat` | `realtime-messages.ts:25-34` | WebSocket message (no REST operation) |

Value sets the schemas import: from `domain/enums` `LensState, MicState, SecurityState, SessionState, StorageState, TimeSource, TrackId, TrackRecState` (`core-api.ts:24-33`); from `sim/vocabulary` `FaultKind, OperatorRole, Permission, PrecheckCheckId, PrecheckStatus, RecordingProfileId, RetentionPolicyId, SecurityPosture, ServiceStatus, Severity, SubjectType, SystemState` (`core-api.ts:35-48`). `SessionState` has 9 values: CREATE, PRECHECK, ARMED, RECORDING, STOPPING, FINALIZING, SEALED, FAULT, RECOVERY (`domain/enums.ts:14-24`).

Fixed values worth knowing: stop and export reasons need at least 5 characters after trimming (`STOP_REASON_MIN_LENGTH = 5`, `EXPORT_REASON_MIN_LENGTH`, `sim/constants.ts:71-73`); export destination is cut at 120 characters (`core-api.ts:66`); video tracks are literal 1080p, 25 fps, H.264 (`core-api.ts:194-196`); timestamps are ISO-8601 with an offset, the simulator writes `+07:00` (`core-api.ts:68-69`).

Session create limits (`SESSION_INPUT_LIMITS`, `session-schema.ts:28-34`): case number length 17, subject name at most 120, room at most 80, notes at most 2,000. Default room is `Interview Room 1` (`session-schema.ts:37`). Messages are i18n keys in the `sessionNew.info.*` namespace (`session-schema.ts:40-56`).

Why it matters: these shapes are what the backend must serialise. The stored fields behind them (session, tracks, storage, time, security, services) are listed in section 2.2.

### 1.4 Badges, modes and vendor extensions

| Item | Value | Source |
|---|---|---|
| `API_BADGES` | `LIVE` (tone success), `SIMULATED` (warning), `RBAC_AUDIT` named `RBAC + AUDIT` (danger) | `openapi.ts:61-65` |
| Badge assignment | `LIVE` when `mode === 'live'`, otherwise `SIMULATED`; `RBAC + AUDIT` is added only when the operation has `rbac` **and** tag `Evidence` | `openapi.ts:245-252` |
| Resulting badge counts | `LIVE` on 1 operation, `SIMULATED` on 9, `RBAC + AUDIT` on 1 (`exportEvidence`) | `openapi.test.ts:113-120` |
| Mode enum | `CoreApiMode = { LIVE: 'live', SIMULATED: 'simulated' }` (two values only) | `core-api.ts:374` |
| Allowed `x-` extensions | `^x-(badges$\|dems-)`; the document uses `x-badges`, `x-dems-mode`, `x-dems-source`, `x-dems-rbac` | `openapi.ts:69, 109-112` |
| Simulated header | name `x-dems-simulated`, value `1`; documented as component `XDemsSimulated`, `required: true` on every simulated response | `openapi.ts:57-58, 201, 301-303, 359-365` |
| Tags | Service, Session, Device, Storage, Evidence, Realtime (6); `Realtime` carries the WebSocket description | `core-api.ts:363-370`, `openapi.ts:167-194` |
| Web consumers of `API_BADGES` | `scalar-theme.ts:27` (chip styling) and `server-strip.tsx:5` (legend and spec version); `api-document.ts` and `renderer-panel.tsx` only handle the built document (the badges reach them through `x-badges`) | `apps/core-web/src/features/api-reference/` |

Why it matters: a Live backend that answers all operations breaks the model "one LIVE operation, nine SIMULATED". The `mode` enum, the badge logic, the `includeSimulated` filter (`openapi.ts:324-327`, web toggle `api-reference/index.tsx:35-62`) and `simAwareFetch` routing (health goes to the network, every other `/api/v1/*` call goes to the in-browser simulator: `sim-fetch.ts:106-125`) all assume that split. Row 17's API Reference work has to change them together.

Verified: read the cited lines; consumer list from `grep -rn "CoreApiMode\|'x-dems-mode'\|includeSimulated"`.

### 1.5 Error envelope

- Schema `ApiErrorSchema`: `{ error: { code: string matching /^[A-Z][A-Z0-9_]*$/, message: string min 1 } }` (`core-api.ts:81-94`, `patterns.ts:30`). Message text is "Operator-safe English text. Never contains credentials."
- The documented code list has **16** codes (`core-api.ts:88`): INVALID_JSON, NOT_SIGNED_IN, NOT_PERMITTED, FORBIDDEN, NOT_FOUND, METHOD_NOT_ALLOWED, SESSION_ACTIVE, INVALID_INPUT, INVALID_STATE, PRECHECK_RUNNING, PRECHECK_WARNINGS, PRECHECK_BLOCKED, INVALID_REASON, NOT_SEALED, SECURITY_FAULT, SIMULATOR_ERROR.
- The simulator's literal `fail(status, 'CODE', …)` calls emit (counted from `sim/api.ts`): 400 INVALID_JSON (1), 400 INVALID_PATH (2), 401 NOT_SIGNED_IN (2), 403 NOT_PERMITTED (2), 404 NOT_FOUND (4), 405 METHOD_NOT_ALLOWED (1), 409 PRECHECK_BLOCKED, PRECHECK_RUNNING, PRECHECK_WARNINGS (1 each), 409 INVALID_STATE (3), 422 INVALID_INPUT (1), 422 INVALID_REASON (2), 500 SIMULATOR_ERROR (1). SESSION_ACTIVE, NOT_SEALED, SECURITY_FAULT and FORBIDDEN arrive through computed reasons (`sim/api.ts:340, 376`).

**Finding 1.5-A: `INVALID_PATH` is emitted (400) but is not in the documented code list.**
- Source: emitted at `sim/api.ts:493, 504`; the list at `core-api.ts:88` has no such code. Unknown routes (404 `NOT_FOUND`) and wrong methods (405 `METHOD_NOT_ALLOWED`, with an `allow` header, `sim/api.ts:511-514`) are not in any operation's `responses` either.
- Why it matters: the drift test checks only documented statuses per operation, so the generic 400, 404, 405 and 500 answers have no contract row. A backend needs them defined once (envelope-level) rather than per operation.
- Verified: `grep -n "fail([0-9]*, '[A-Z_]*'" sim/api.ts` and a read of the `ApiErrorSchema` description.

### 1.6 Generator script and drift test

| Item | What exists | Source |
|---|---|---|
| Generator | `renderOpenApiJson()` = `serializeOpenApiDocument(createOpenApiDocument())`; default run writes `packages/shared/openapi/openapi.json` (2-space JSON plus trailing newline); `--check` writes nothing and exits 1 when missing or stale | `scripts/gen-openapi.ts:24-47` |
| How it is run | `npm run openapi:gen -w @dems/shared` (script `tsx scripts/gen-openapi.ts`); inside the Claude sandbox the tsx CLI fails with listen EPERM, so `node --import tsx scripts/gen-openapi.ts` from `packages/shared` is the documented fallback | `packages/shared/package.json:28`; `gen-openapi.ts:9-11` |
| Determinism | No clock, no RNG, no network: built from constants and zod schemas only | `gen-openapi.ts:5-8` |
| Component schemas | `z.toJSONSchema` on a registry of `CORE_API_SCHEMAS`, draft 2020-12, `io: 'input'`, `unrepresentable: 'throw'`; drops the date-time regex and the ±2^53 integer bounds | `openapi.ts:216-243` |
| Document identity | `openapi: 3.1.0`, `info.title: DEMS Core API`, `info.version: 0.1.0`, one server `http://127.0.0.1:4400` | `openapi.ts:51-54, 348-354` |
| Committed file | `packages/shared/openapi/openapi.json`, 95,021 bytes, last modified 2026-10-01 10:07 (same minute as `core-api.ts` and `examples.ts`) | `ls -l`, `stat` |
| Drift test | `packages/shared/test/openapi.test.ts`, 436 lines, 21 `it(` blocks, 5 `describe` groups (lines 77, 202, 255, 316, 400) | grep |

What the test asserts (and which assertions are tied to today's single-origin, ten-operation shape):

| Assertion | Lines | Ties to |
|---|---|---|
| Document is valid OpenAPI 3.1 for `@scalar/openapi-parser` and every `$ref` resolves | 81-89 | stays valid after additions |
| Exactly 10 operations; exactly 1 LIVE (`get /api/v1/health`) and the 9 book §21.2 endpoints SIMULATED; `LIVE` badge count 1 and `SIMULATED` count 9 | 99-116 | **must change** when operations are added or modes change |
| Only `exportEvidence` has the `RBAC + AUDIT` badge; the set with `x-dems-rbac` is exactly createSession, exportEvidence, startSession, stopSession; roles equal the `roleHas` holders | 118-134 | **must change** with new permissions or operations |
| Committed `openapi.json` equals the rebuilt text byte for byte | 136-140 | regeneration needed after every contract edit |
| Only `x-badges` and `x-dems-*` extensions; **no `security` and no `securitySchemes`**; the only host in the text is `127.0.0.1:4400` | 152-164 | **must change** for a Live auth scheme and a second origin |
| `servers` equals `[CORE_HTTP_ORIGIN]`; `x-dems-simulated` documented on simulated responses only | 166-175 | **must change** if the server list changes |
| Components equal `Object.keys(CORE_API_SCHEMAS)` | 177-185 | new schemas are picked up |
| `WS /ws` is described in the Realtime tag and its example parses with `HeartbeatSchema` | 187-192 | **must change** with a richer socket protocol |
| `includeSimulated: false` keeps only `getServiceHealth` and tags Service, Realtime | 194-199 | **must change** with the mode split |
| Every documented response with a body has an example and every example parses; request and path examples parse | 209-246 | new operations need examples |
| `matchCoreApiOperation` routes every operation and rejects unknown paths and bad percent-encoding | 255-273 | routing table is built from the same array |
| `SIM_API_ROUTES` equals the 9 simulated operations; **every documented status of every simulated operation is produced by the real simulator**, and every response parses | 316-395 | **must change** (simulator and contract are compared) |
| Examples agree with the canonical dataset at 2026-10-01 10:00 WIB | 400-435 | date-relative dataset (section 2.8) |

Why it matters: the guard test is the safest place to learn what a contract extension breaks. It also compares the contract with the in-process simulator, not with a server, so a backend needs its own conformance test against the same `validateCoreApiResponse` (`core-api.ts:716-731`). Callers of that function per Graft: `apps/core-web/src/test/sim-fetch.test.ts`, `packages/shared/test/openapi.test.ts`, `packages/shared/test/sim-api-validation.test.ts`. Callers of `createOpenApiDocument`: `apps/core-web/src/features/api-reference/api-document.ts:133`, `core-endpoint.test.tsx`, `gen-openapi.ts:25, 44`, `openapi.test.ts`. Caller of `matchCoreApiOperation`: `openapi.test.ts` only.

Guard constraint for this row: `gen-openapi.ts` writes by default, so it was **not** run. The test was not run either (P7).

Related contract tests: `schemas.test.ts` (5 `it`), `session-schema.test.ts` (7), `sim-api.test.ts` (12), `sim-api-validation.test.ts` (12), all in `packages/shared/test/`.

### 1.7 Realtime message schemas

| Item | What exists | Source |
|---|---|---|
| Message union | `WsServerMessageSchema = z.discriminatedUnion('type', [HeartbeatSchema])`: one member only | `realtime-messages.ts:36` |
| `Heartbeat` fields | `type: 'heartbeat'`, `v: 1`, `seq` (int ≥ 0), `serverTime` (ISO), `uptimeMs`, `intervalMs: 1000`, `clients`, `sessionState: SessionState \| null` | `realtime-messages.ts:25-34` |
| Direction | Server to client only; messages sent by clients are ignored | `openapi.ts:181` |
| Path and URL | `WS_PATH = '/ws'`, `CORE_WS_URL = 'ws://127.0.0.1:4400/ws'` | `constants.ts:17-18` |
| Origin rule | Upgrades from origins other than `WEB_DEV_ORIGINS` and `SELF_ORIGINS` are refused with 403 | `openapi.ts:179`; `apps/mock-core/src/heartbeat.ts:20` |
| Compile-time exactness | `Exact<...>` type checks pin schema to interface | `realtime-messages.ts:38-42` |
| Client behaviour | Stale after 2,500 ms without a beat; reconnect delays 500, 1000, 2000, 4000, 8000 ms (last repeats) plus up to 250 ms jitter | `constants.ts:20-24`; `packages/shared/src/realtime/heartbeat-client.ts:103-105, 213` |

`sessionState` is always `null` in this phase ("D4: no simulator in mock-core", `realtime-messages.ts:18`). No message carries meter levels, audit rows, events, role changes or pairing changes today.

Why it matters: every realtime feature the backend adds (20 Hz meters, session state, permission change, pairing change, resync) has no schema; the discriminated union is the extension point. Consumers of the schema: `heartbeat-client.ts:164`, web `use-realtime-feed.ts:18, 84`, mock-core `scripts/ws-probe.ts:12, 75`, tests (`schemas.test.ts`, `heartbeat.test.ts`, `standalone-launcher.test.ts:201`, `openapi.test.ts:191`).

### 1.8 Network constants and every consumer

All values are literals with no environment override in the shared package (`constants.ts:4` says "there are no environment overrides"). The web app adds one build-time switch in its own code: `VITE_DEMS_CORE_ORIGIN=same-origin` selects the page origin (`apps/core-web/src/lib/core-endpoint.ts:36-44`, typed in `env.d.ts:6-14`).

| Constant | Value | Defined | Consumers (file:line, non-test unless marked) |
|---|---|---|---|
| `MOCK_CORE_HOST` | `127.0.0.1` | `constants.ts:8` | `apps/mock-core/src/index.ts:5, 51` |
| `MOCK_CORE_PORT` | `4400` | `constants.ts:9` | `apps/mock-core/src/index.ts:5, 51` |
| `CORE_HTTP_ORIGIN` | `http://127.0.0.1:4400` | `constants.ts:10` | `health.ts:2, 47`; `openapi.ts:29, 150, 350`; web `lib/core-endpoint.ts:20, 43, 61-70`; web `api-reference/api-document.ts:17, 118, 121`; mobile `features/login/login-model.ts:15, 79`; tests |
| `API_BASE_PATH` | `/api/v1` | `constants.ts:13` | `core-api.ts:49, 436, 466, 505, 536, 552, 568, 584, 597, 613`; web `api-reference/sim-fetch.ts:20, 31, 98` |
| `HEALTH_PATH` | `/api/v1/health` | `constants.ts:15` | `health.ts:2, 47-48`; `core-api.ts:49, 422`; mock-core `src/app.ts:11, 77`; web `sim-fetch.ts:20, 106`; **duplicated literal** in `apps/mock-core/standalone/dems-web-launcher.cjs:37` |
| `WS_PATH` | `/ws` | `constants.ts:17` | mock-core `src/app.ts:15, 85`, `src/heartbeat.ts:15, 91`; web `lib/core-endpoint.ts:24, 50`; **duplicated literal** `dems-web-launcher.cjs:38` |
| `CORE_WS_URL` | `ws://127.0.0.1:4400/ws` | `constants.ts:18` | `realtime/heartbeat-context.tsx:2, 22`; `openapi.ts:30, 175`; web `lib/core-endpoint.ts:21, 48`, `api-reference/api-document.ts:18, 121`; mock-core `scripts/ws-probe.ts:12, 16` |
| `HEARTBEAT_INTERVAL_MS` | `1000` | `constants.ts:20` | `openapi.ts:31, 177`; mock-core `src/app.ts:12, 86`, `src/heartbeat.ts:12, 56, 83`; web `api-reference/realtime-panel.tsx:6, 126`; **duplicated literal** `dems-web-launcher.cjs:39` |
| `HEARTBEAT_STALE_AFTER_MS` | `2500` | `constants.ts:21` | `realtime/heartbeat-client.ts:16, 213`; `openapi.ts:32, 180` |
| `RECONNECT_BACKOFF_MS` | `[500, 1000, 2000, 4000, 8000]` | `constants.ts:23` | `realtime/heartbeat-client.ts:17, 103-104`; `openapi.ts:33, 180` |
| `RECONNECT_JITTER_MS` | `250` | `constants.ts:24` | `realtime/heartbeat-client.ts:18, 105`; `openapi.ts:34, 180` |
| `WEB_DEV_ORIGINS` | `http://127.0.0.1:5173`, `http://localhost:5173` | `constants.ts:27` | mock-core `src/app.ts:14, 39`, `src/heartbeat.ts:14, 20`; web `lib/core-endpoint.ts:23, 55` |
| `SELF_ORIGINS` | `http://127.0.0.1:4400`, `http://localhost:4400` | `constants.ts:29` | mock-core `src/heartbeat.ts:13, 20` |
| `SERVICE_NAME` | `dems-mock-core` | `constants.ts:31` | mock-core `src/app.ts:13, 79`; **duplicated literal** `dems-web-launcher.cjs:40`; `health.ts:7, 25` hard-code the same literal in the type and the schema |
| `API_VERSION` | `v1` | `constants.ts:32` | mock-core `src/app.ts:10, 81`; **duplicated literal** `dems-web-launcher.cjs:41`; `health.ts:10, 27` |

Other places that hard-code the same endpoint without importing the constants (non-test):
- `apps/mobile/package.json:18`: `"reverse": "adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081"`.
- `apps/mobile/scripts/device-session.sh:35, 238, 449-459`: `adb reverse tcp:4400 tcp:4400` per serial.
- `packages/shared/openapi/openapi.json`: 4 lines contain `4400` (lines 11, 12, 38, 50).
- `scripts/release/build-web-packages.ts:462-470, 744, 820, 856`: packaged launcher addresses (4410-4419).

Counts of files importing `@dems/shared/api` (grep, includes tests): 39 files, of which 25 are non-test (web 16, mobile 5, mock-core 4) and 14 are tests (web 10, mobile 1, mock-core 3). Heartbeat client and hook consumers (`useHeartbeat`, `HeartbeatProvider`, `createHeartbeatClient`): 12 files (web `routes/__root.tsx`, `features/home/home-page.tsx`, `features/api-reference/service-banner.tsx`, `use-realtime-feed.ts`, `features/login/use-login-controller.ts`; mobile `providers/app-providers.tsx`, `features/home/home-screen.tsx`, `runtime/resync-bus.ts`, `runtime/sim-runtime-provider.tsx`; plus tests).

The guard that keeps the launcher copy in step with these constants is `apps/mock-core/test/standalone-launcher.test.ts:156-160` (row 5 owns the coupling analysis).

Why it matters for the task: a second backend on another port means `CORE_HTTP_ORIGIN`, `CORE_WS_URL`, `MOCK_CORE_PORT`, `WEB_DEV_ORIGINS`, `SELF_ORIGINS` and `SERVICE_NAME` are all single-valued today. The web CORS allowlist covers only port 5173 (`constants.ts:27`), and the OpenAPI test pins the only host to `127.0.0.1:4400` (`openapi.test.ts:161-163`). Mobile reaches the Core through `adb reverse tcp:4400` only (`apps/mobile/package.json:18`).

Verified: `grep -rnE` over `apps/`, `packages/`, `scripts/` for each constant name, then per-file import lists; Graft `callers fetchHealth` returned `fetchCoreHealth` (`apps/core-web/src/lib/core-endpoint.ts:63-75`) and `useHealth` (`apps/mobile/src/features/home/use-health.ts:7-9`).

### 1.9 ID and format patterns (`patterns.ts`)

| Pattern | Regex | Example in source | Source |
|---|---|---|---|
| Session ID | `/^SES-\d{8}-\d{4}$/` | `SES-20261001-0024` | `patterns.ts:11` |
| Evidence ID | `/^EV-\d{8}-\d{4}$/` | `EV-20260930-0004` | `patterns.ts:14` |
| Operator ID | `/^OPR-\d{3}$/` ("Never a username") | `OPR-001` | `patterns.ts:17` |
| Export ID | `/^EXP-\d{6}$/` | `EXP-000042` | `patterns.ts:20` |
| Case number | `LP/{YYYY}/{MMDD}-NNNN` | `LP/2026/1001-0007` | `patterns.ts:27` |
| Error code | `/^[A-Z][A-Z0-9_]*$/` | `NOT_SIGNED_IN` | `patterns.ts:30` |

Other minted IDs in the dataset: audit `AUD-NNNNNN` (`sim/events.ts:112-114`), event `LOG-NNNNNN` (`events.ts:216-218`), item IDs `PREFIX-NNNNNN` from `meta.counters.item` (`events.ts:297-306`). Dates inside session and evidence IDs and in case numbers are the WIB calendar day of creation (`patterns.ts:6-8`), so IDs depend on the seed date (section 2.8).

### 1.10 The stale description of predecessor known issue KI-18

Predecessor wording (`docs/2026-09-30_dems_demo_stack_setup/verification/01_verification.md:190`): "**core-api.ts description is stale for packages.** `packages/shared/src/api/core-api.ts:427` reads "**Live**: served by mock-core on 127.0.0.1:4400 (CORS allows the web dev origins)". In the packaged launcher the origin is 127.0.0.1:4410, same-origin | D113; quoted line | Post-demo doc fix and OpenAPI regeneration".

The line in the code today (`packages/shared/src/api/core-api.ts:427`, inside `getServiceHealth.description`, lines 426-427):

```
'Liveness of the local mock-core service. **Live**: served by mock-core on 127.0.0.1:4400 (CORS allows the web dev origins). This is not the device health snapshot; that is `GET /api/v1/device/health`.',
```

The stale statement is repeated in places a correction must cover (all verified by reading the lines):

| Place | Text (shortened) | Source |
|---|---|---|
| `core-api.ts` header table | "LIVE `GET /api/v1/health`, mock-core on 127.0.0.1:4400" and "SIMULATED the 9 §21.2 endpoints" | `core-api.ts:5-8` |
| `openapi.ts` header | "10 operations … health is LIVE (mock-core) and the 9 … endpoints SIMULATED" | `openapi.ts:5-6` |
| Info summary | "one live endpoint on the local mock-core, nine simulated in the browser" | `openapi.ts:141-142` |
| Badge legend row | "**LIVE** Served over the network by mock-core at `${CORE_HTTP_ORIGIN}`" | `openapi.ts:150` |
| Tag text | Service "Liveness of the local mock-core service. **LIVE.**"; Realtime "**LIVE** WebSocket … served by mock-core" | `openapi.ts:168, 175` |
| Server description | "Local mock-core. It serves GET /api/v1/health and WS /ws; the simulated endpoints are answered in the browser." | `openapi.ts:351-352` |
| Committed JSON | the same texts at `openapi.json` lines 6, 12, 18, 38, 50 | `grep -n "mock-core\|4400" openapi.json` |
| Web re-pointing | `api-document.ts` rewrites only the origin and WS URL strings of the shared document, not the "mock-core" wording | `apps/core-web/src/features/api-reference/api-document.ts:110-121` |

Why it matters: the backend changes who answers which operation, so these statements become wrong for more than packages. Blueprint row 98 plans to correct KI-18 and regenerate (`02_structured.md`, row 98); `openapi.test.ts:136-140` forces the regeneration. This row changed nothing.

---

## 2. Canonical dataset: `packages/shared/src/sim/`

### 2.1 Source map

| File | Lines | What it holds | Source of truth for |
|---|---|---|---|
| `sim/dataset.ts` | 882 | Device constants, operators, demo password and pairing code constants (names only here), services, storage-at-load, ID formats, recording scenario, evidence and today history seeds, `todaySchedule`, `bootTimeFor`, `buildHistory` | Seeds and date rules |
| `sim/initial-state.ts` | 420 | `createIdleState({ now, seed })` builds the full `SimState` (30 slices) and replays the history rows through the audit chain | The idle baseline |
| `sim/generator.ts` | 215 | **Runtime** event and audit generator (Poisson recording stream, idle events). Not a seeder | Live activity rates |
| `sim/scenarios.ts` | 229 | `buildScenarioState`, `loadScenarioState` (4 scenarios) | Demo controls |
| `sim/demo-alignment.ts` | 266 | Constants copied from the DEMO packages (cert, key, per-package hashes, tamper and export facts) and `demoPackageIntegrityFor` | Link to `src/demo-data` |
| `sim/vocabulary.ts` | 598 | Closed value sets (roles, permissions, audit types, event types, statuses) | Enumerations |
| `sim/auth.ts` | 387 | `ROLE_PERMISSIONS`, lockout, sign-in | Role matrix |
| `sim/constants.ts` | 136 | Timing, ring sizes, storage sizes, auth and pairing limits | Numeric constants |
| `sim/clock.ts` | 131 | WIB date arithmetic (fixed `+07:00`, no `Intl`) | Date rules |

Graft callers (graph evidence): `createIdleState` is called by `createSim` (`sim/engine.ts:166-363`), `loadScenarioState` (`scenarios.ts:195-229`), `gen-demo-evidence.ts` `loadSimulatorItems` (`scripts/gen-demo-evidence.ts:304-341`) and five test files. `buildHistory` is called by `createIdleState` and by `gen-demo-media.ts` `datasetSessions` (`scripts/gen-demo-media.ts:1115-1153`). `todaySchedule` is called by `bootTimeFor` and `placeHistory`.

Seed determinism: `DEFAULT_SEED = 20261001` (`sim/constants.ts:9`); streams come from `mulberry32` and `deriveSeed` (`sim/rng.ts:10, 35`); scenario streams are keyed by seed and scenario name (`scenarios.ts:45-47`). The audit chain is `hash = sha256(prevHash ‖ canonicalJSON(body))` over `seq, id, at, type, category, severity, actorId, message, sessionId, evidenceId, deviceId, details` (`events.ts:64-84`); genesis is 64 zero characters (`constants.ts:44`); audit ring 1,000 rows and event ring 500 (`constants.ts:35-36`).

### 2.2 Seeded entities: count and file:line

`createIdleState` (`initial-state.ts:138-420`) builds the state below. "Durable" here only means "present at seed"; which slices are engine-held or streamed is for rows 14 and 15.

| Entity | Count at seed | File:line | Notes |
|---|---|---|---|
| Operators | **3** | `sim/dataset.ts:119-147` (ids `113-117`); copied into state at `initial-state.ts:167` | See 2.3 |
| Roles | **3** | `sim/vocabulary.ts:16-21` | INVESTIGATOR, SUPERVISOR, TECHNICIAN |
| Permissions | **9** | `sim/vocabulary.ts:23-34` | See 2.4 |
| Role-permission grants | 4 + 7 + 4 = 15 | `sim/auth.ts:46-67` | See 2.4 |
| Auth session | 1, signed out at seed | `initial-state.ts:168` (`signedOutAuth`, `auth.ts:111-113`) | `dems.auth` storage key at `constants.ts:16` |
| Auth lockout | 1, empty | `initial-state.ts:169` | Policy 5 failures in 5 min, 60 s lock, 15 min idle (`constants.ts:51-54`) |
| Core device | **1** (`DEMS-IR-01`, "Interview Room 1", product "DEMS Edge Client", software 2.4.1, update 2.5.0) | `dataset.ts:47-53`; state at `initial-state.ts:159-166` | See 2.5 |
| Device identity record | 1 with 14 fields | `dataset.ts:72-89` | serial, hardware UUID, board revisions, BSP, TPM, camera firmware, provisioning record, certificate id |
| Recording profile | **1** (`STANDARD_1080P25`, H.264, 25 fps, 18.3 Mbps) | `dataset.ts:55-64`; `constants.ts:131` | |
| Pairing | 1 record, `PAIRED`, `pairedAt = bootAt + 4 min`, certificate fingerprint from the DEMO certificate | `initial-state.ts:170-179`; fingerprint `dataset.ts:96` | `PairingState` has UNPAIRED, PAIRED, FAILED (`vocabulary.ts:236-240`) |
| Tablet link | 1, CONNECTED, `changedAt = now` | `initial-state.ts:180` | |
| Cameras | **2** (`VIDEO-01`/`CAM-01`, `VIDEO-02`/`CAM-02`; both on PoE port `POE_CAM_1`) | `initial-state.ts:186-220` | |
| Microphones | **2** (`AUDIO-01`/`MIC-01` Interviewer, `AUDIO-02`/`MIC-02` Subject; gain 32 dB, phantom on) | `initial-state.ts:221-246` | |
| Audio frames | 2 silent frames | `initial-state.ts:247`, `silentFrame` at `69-71` | runtime meters |
| Core services | **16** (`SVC-01`..`SVC-16`, all RUNNING, started at boot) | names `dataset.ts:168-185`; state `initial-state.ts:355-361` | |
| Other devices | **3** (PoE Switch, Recording Indicator, Tablet Control) | `initial-state.ts:372-376` | |
| Ports | **7** | `initial-state.ts:377-385` | |
| Network | 1 record (LAN `Interview LAN`, link 1,000 Mbps, PoE budget 60 W) with **4** domains (CAMERA vlan 10, MANAGEMENT 20, SERVICE_UPDATE 30, EXPORT_TRANSFER 40) | `dataset.ts:160-165`; `initial-state.ts:291-307` (domains `301-306`) | |
| Storage volumes | **2** (`NVME-SYS` 2 TB with 212 GB used; `HDD-EVIDENCE` 4 TB with 804 GB used) | `dataset.ts:188-193`; `constants.ts:125-129`; `initial-state.ts:250-265` | decimal units |
| Storage history | **24** hourly points | `initial-state.ts:270-273`; `STORAGE_HISTORY_POINTS` `constants.ts:40` | derived from evidence sizes (`dataset.ts:875-879`) |
| Storage policy | 1 (`DAYS_90`, 90 days, auto-archive on) | `initial-state.ts:278` | |
| Time record | 1 (GNSS, stratum 1, offset 3 ms, 11 satellites, NTP `192.168.10.1`) | `initial-state.ts:279-290` | |
| Security record | 1 (SECURE, TPM ok, secure boot, AES-256-GCM, SHA-256) | `initial-state.ts:308-354` | |
| Security controls | **6** (TPM, SECURE_BOOT, ENCRYPTION, HASH_CHAIN, TAMPER, SIGNED_FIRMWARE) | `initial-state.ts:316-323` | |
| Security keys | **3** (`DEVICE_CERT`, `EVIDENCE_SIGNING_KEY`, `TLS_SERVER`) | `initial-state.ts:324-353` | first two are the Ed25519 DEMO values from `demo-alignment.ts:35-47` |
| Update record | 1 with **6** steps | `initial-state.ts:392-407` (steps `397-404`) | |
| Settings | 1 | `initial-state.ts:79-84, 408` | presentation mode, time format, notifications |
| Session (active) | 0 (`null`) | `initial-state.ts:181` | scenarios create one |
| Session history entries | **13** | built `dataset.ts:800-818`; stored `initial-state.ts:184`; asserted `test/sim-contract.test.ts:168` | 12 SEALED, 1 INCOMPLETE |
| Evidence items | **13** | seeds `dataset.ts:268-353` (6) and `357-421` (7); built `768-798`; stored `initial-state.ts:386`; asserted `test/demo-evidence.test.ts:190` | See 2.5 |
| Evidence tracks | **52** (4 per item: VIDEO-01, VIDEO-02, AUDIO-01, AUDIO-02) | `sim/evidence.ts:48-53, 122-136, 150-171` | share of bytes 49 %, 49 %, 1 %, 1 % (`evidence.ts:40-46`) |
| Custody entries | **28** (2 per item, plus REVIEW_OPENED on 0003 and EXPORTED on 0004) | `dataset.ts:579-584, 721, 741-746` | derived by count |
| Audit rows | **82** | rows built `dataset.ts:586-862`; replayed `initial-state.ts:411-419` | static count, see 2.6 |
| Operational events | **59** | same | static count, see 2.6 |
| Counters | event, session, caseNumber, evidence, item | `initial-state.ts:150-156`; `dataset.ts:228-232` (session 24, caseNumber 8, evidence 14) | event counter ends at 60 after replay (1 + 59, derived) |
| Alerts, faults, diagnostics | 0, 0 active, `null` | `initial-state.ts:388, 390, 391` | |
| Health series | up to 120 back-filled points per series (health, bandwidth, time offset, mic levels, write rate) | `initial-state.ts:106-136`; `SERIES_POINTS` `constants.ts:39` | runtime series |
| Tampered item | **1** (EV 0005, track AUDIO-02) | `demo-alignment.ts:46-47`; applied `dataset.ts:577, 789-790` | |
| Exported item | **1** (EV 0004, `EXP-000031`) | `dataset.ts:104-110, 737-766`; `demo-alignment.ts:51-52` | |
| Recording scenario session | 1 (session 0024, case seq 7, "Ahmad Fauzi", 00:18:42 elapsed) | `dataset.ts:215-225` | created by scenarios, sealed into evidence 0014 |

State slices not seeded with rows are listed in `SNAPSHOT_KEYS` (30 keys, `sim/store.ts:24-55`; blueprint F-A2).

### 2.3 Operators (synthetic) and the credential constants

| id | username | rank | name | role | Source |
|---|---|---|---|---|---|
| `OPR-001` | `budi.santoso` | AKP | Budi Santoso | INVESTIGATOR | `dataset.ts:120-128` |
| `OPR-002` | `andi.pratama` | AKP | Andi Pratama | SUPERVISOR | `dataset.ts:129-137` |
| `OPR-003` | `rina.wijaya` | none | Rina Wijaya | TECHNICIAN | `dataset.ts:138-146` |

Each record also has `displayName` (rank plus name) and `initials` (`BS`, `AP`, `RW`).

Credential constants, cited by name only (P19):
- `DEMO_OPERATOR_PASSWORD` (`dataset.ts:153`): one shared password for all three operators. It is compared in plain text by the simulator (`auth.ts:292`). It is displayed in both clients' login screens (web `features/login/auth-card.tsx:20, 427` and `use-login-controller.ts:27, 251`; mobile `features/login/login-card.tsx:34, 489, 504`). Its literal also appears in `README.md`, `scripts/release/build-web-packages.ts` and several test files (files found by `grep -l`; not quoted here).
- `DEMO_PAIRING_CODE` (`dataset.ts:157`): one fixed 6-digit code (`PAIRING_CODE_LENGTH = 6`, `constants.ts:61`) compared in `sim/pairing.ts:47-51`. Shown in the mobile login demo hint (`login-card.tsx:35, 506`).
- `SECURITY_KEY_OPERATOR_ID` (`dataset.ts:155`) is `OPERATOR_IDS.ANDI`; the security-key sign-in signs in as that operator (`auth.ts:312`).

Why it matters: the backend's operator rows need an identity per operator, a role and a password hash; the seed has no password column today, only one shared constant. The pairing code is a single constant, while the target flow issues one-time codes.

### 2.4 Roles, permissions and the matrix (`sim/auth.ts:46-67`)

| Permission | INVESTIGATOR | SUPERVISOR | TECHNICIAN |
|---|---|---|---|
| SESSION_START | yes | yes | no |
| SESSION_NOTE | yes | yes | no |
| EVIDENCE_VIEW | yes | yes | yes |
| EVIDENCE_REVIEW | no | yes | no |
| EVIDENCE_EXPORT | no | yes | no |
| AUDIT_EXPORT | no | yes | no |
| DEVICE_MANAGE | no | no | yes |
| DIAGNOSTICS_RUN | yes | yes | yes |
| MAINTENANCE | no | no | yes |

Grants: INVESTIGATOR 4, SUPERVISOR 7 (the investigator set plus EVIDENCE_REVIEW, EVIDENCE_EXPORT, AUDIT_EXPORT), TECHNICIAN 4. `roleHas` is at `auth.ts:69-72`; `requirePermission` at `auth.ts:78-91` (throws NOT_SIGNED_IN or NOT_PERMITTED). No permission covers user administration or pairing management today (`vocabulary.ts:23-34` lists all 9).

### 2.5 Core device and evidence items

**Core device** (`dataset.ts:47-53`; state `initial-state.ts:159-166`): id `DEMS-IR-01`, name and room `Interview Room 1` (the only entry of `ROOMS`), product `DEMS Edge Client`, software `2.4.1`, update available `2.5.0`. Network facts (synthetic private addresses): `dataset.ts:160-165`. The DEMO device certificate and signing key facts are constants in `demo-alignment.ts:35-47` (key id `DEMO-KEY-EVSIGN-01`, Ed25519, certificate valid to 2030-12-31).

**Evidence and session history** (13 items; times resolved by `placeHistory`, `dataset.ts:510-548`):

| EV seq | Session seq | When | Duration | Subject (type) | Investigator | Status | Outcome | Case rule | Flags |
|---|---|---|---|---|---|---|---|---|---|
| 0001 | 0011 | today minus 2 days, 09:15 WIB | 42 min | Siti Rahma (SAKSI) | OPR-001 | SEALED | SEALED | case seq 1 | |
| 0002 | 0012 | today minus 2 days, 13:40 | 55 min | Budi Hartono (SAKSI) | OPR-002 | SEALED | SEALED | case seq 2 | |
| 0003 | 0013 | today minus 1 day, 08:50 | 68 min | Rudi Setiawan (TERSANGKA) | OPR-001 | UNDER_REVIEW | SEALED | case seq 3 | review opened by OPR-002 two hours after the end |
| 0004 | 0014 | today minus 1 day, 10:35 | 37 min | Maya Lestari (SAKSI) | OPR-001 | EXPORTED | SEALED | case seq 4 | exported by OPR-002 five hours after the end as `EXP-000031` |
| 0005 | 0015 | today minus 1 day, 13:20 | 29 min | Dewi Anggraini (LAINNYA) | OPR-002 | SEALED | SEALED | case seq 5 | **tampered**, AUDIO-02 |
| 0006 | 0016 | today minus 1 day, 15:45 | 24 min | Hendra Wijaya (SAKSI) | OPR-001 | RECORDED | INCOMPLETE | case seq 6 | power fail, recovered, never sealed (`sealedAt` null) |
| 0007 | 0017 | today (schedule) | by schedule | Rahmat Hidayat (SAKSI) | OPR-001 | SEALED | SEALED | continues case of EV 0003 | |
| 0008 | 0018 | today | by schedule | Nur Aini (SAKSI) | OPR-002 | SEALED | SEALED | continues case of EV 0001 | |
| 0009 | 0019 | today | by schedule | Yusuf Pratomo (TERSANGKA) | OPR-001 | SEALED | SEALED | continues case of EV 0003 | |
| 0010 | 0020 | today | by schedule | Sri Wahyuni (LAINNYA) | OPR-002 | SEALED | SEALED | continues case of EV 0005 | |
| 0011 | 0021 | today | by schedule | Fajar Nugroho (SAKSI) | OPR-001 | SEALED | SEALED | continues case of EV 0002 | |
| 0012 | 0022 | today | by schedule | Indah Permata (SAKSI) | OPR-002 | SEALED | SEALED | continues case of EV 0004 | |
| 0013 | 0023 | today | by schedule | Wahyu Saputra (TERSANGKA) | OPR-001 | SEALED | SEALED | continues case of EV 0006 | |

Sources: previous-day seeds `dataset.ts:268-353`; today seeds `dataset.ts:357-421` (the `caseOf` field gives the continued case); status distribution SEALED 10, EXPORTED 1, UNDER_REVIEW 1, RECORDED 1 (counted from the seeds). Case numbers: items 0001 to 0006 open cases 0001 to 0006; case seq 7 belongs to the recording scenario (`dataset.ts:211-225`).

Per-item derived fields (`dataset.ts:560-565, 768-798`): `sizeBytes = recordingBytes(duration)` at 8.2 GB per hour (`dataset.ts:207-209`, `constants.ts:133`); `sealedAt = endedAt + 9 s` (`HISTORY_SEAL_DELAY_MS`, `dataset.ts:429`); `verification` starts as `NOT_RUN`; start and end time source `GNSS`; `lifecycleStage` from `EVIDENCE_STATUS_STAGE` (`evidence.ts:173-179`); `integritySource` is `DEMO_PACKAGE` when the DEMO package joins (all 13 do; `dataset.ts:566`).

### 2.6 Seeded audit rows and events (derived by static count)

Counts were derived by reading `buildHistory` (`dataset.ts:551-869`); the code was **not executed** (P7). Row 16 or a seed test should confirm them by running `createIdleState`.

| Group | Audit rows | Events | Source |
|---|---|---|---|
| Per sealed history item (12 items): AUTH_SUCCESS, SESSION_CREATED, PRECHECK_PASSED, RECORDING_STARTED, RECORDING_STOPPED, EVIDENCE_SEALED | 6 each = 72 | 4 each = 48 (AUTH_LOGIN, SESSION_CREATED, RECORDING_STARTED, EVIDENCE_SEALED) | `dataset.ts:586-640, 687-717` |
| The INCOMPLETE item (0006): first four as above, then FAULT_RAISED, RECOVERY_STARTED, SESSION_INCOMPLETE | 7 | 5 | `dataset.ts:586-640, 642-686` |
| EV 0003 review: EVIDENCE_REVIEW_OPENED | 1 | 1 (EVIDENCE_REVIEW) | `dataset.ts:719-736` |
| EV 0004 export: EVIDENCE_EXPORTED (details: destination, reason, `exportId`) | 1 | 1 (EVIDENCE_EXPORTED) | `dataset.ts:737-766` |
| Boot: SYSTEM_BOOT; events SYSTEM_BOOT, TIME_SYNC, HEALTH_CHECK_OK, UPDATE_AVAILABLE | 1 | 4 | `dataset.ts:821-862` |
| **Total** | **82** | **59** | |

Rows are sorted by time and appended through the hash chain (`dataset.ts:865`; `initial-state.ts:411-419`). Their messages contain dated session and evidence IDs, and their `at` values depend on `now`, so the chain hashes differ with the seed date (section 2.8).

Vocabulary sizes (line-pattern counts, `grep -c` over the object bodies in `sim/vocabulary.ts`): `AuditType` 44 values (lines 291-344), `SimEventType` 46 values (lines 395-449). Row 1 owns the exact vocabulary tables.

### 2.7 Scenarios (4)

`ScenarioName` = `idle`, `recording`, `finalizing`, `fault-demo` (`vocabulary.ts:227-233`). Built by `buildScenarioState` (`scenarios.ts:160-193`) from the idle baseline by running the real transitions; applied by `loadScenarioState` (`scenarios.ts:195-229`), which also writes a `SCENARIO_LOADED` audit row and event and keeps auth, lockout, pairing, tablet link, epoch and settings.

| Scenario | What it produces | Source |
|---|---|---|
| `idle` | the dataset at `now` (no session) | `scenarios.ts:161` |
| `recording` | session 0024 (case seq 7, Ahmad Fauzi, TERSANGKA, OPR-001, `Interview Room 1`) recording, 00:18:42 elapsed, with a note at +190 s, a marker at +465 s, an audio peak at +680 s and a snapshot at +905 s | `dataset.ts:215-225`; `scenarios.ts:79-158, 167-169` |
| `finalizing` | the same session, stopped 1.6 s ago (reason "Interview completed"), finalization running | `scenarios.ts:170-176` |
| `fault-demo` | recording with CAMERA_LOSS on VIDEO-02 at now-95 s, MIC_CLIP on AUDIO-02 at now-60 s, GNSS_LOSS at now-40 s | `scenarios.ts:177-183` |

Demo controls on the action surface: `loadScenario(name)` and `resetDemo()` (`sim/types.ts:1059-1061`). Sealing session 0024 yields evidence 0014 (`IDLE_COUNTERS.evidence = 14`) with the package hashes when case and subject match (`test/sim-demo-data-alignment.test.ts:173-231`).

### 2.8 Date-relative rules

| Rule | Behaviour | Source |
|---|---|---|
| Time zone | Fixed `+07:00` (WIB), plain arithmetic, no `Intl` | `constants.ts:47-48`; `clock.ts:1-11, 54-130` |
| ID dating | `SES-{YYYYMMDD}-NNNN`, `EV-{YYYYMMDD}-NNNN`, `LP/{YYYY}/{MMDD}-NNNN` use the WIB date of the item's creation (`formatYmd`, `formatMmdd`) | `dataset.ts:196-204`; `clock.ts:95-104` |
| Previous days | Items 0001 and 0002 are placed two WIB days before `now`, items 0003 to 0006 one day before, at fixed hour and minute; start is creation + 2 min; end is start + duration | `dataset.ts:268-353, 510-527`; `clock.ts:90-93` |
| Today | Items 0007 to 0013 follow `todaySchedule(now)`: newest ends 25 min before `now`; slots between 07:00 WIB and that end; each slot 20 to 70 min; each recording fills 58 to 78 % of its slot (shares `0.72, 0.6, 0.78, 0.66, 0.58, 0.75, 0.68`); creation is 90 s before start | `dataset.ts:431-468` |
| Early morning edge | If a slot would be under 20 min, slots spread from 00:30 WIB; before about 02:50 WIB the oldest slots fall on the previous day, so "Sealed Today" is below 7 | `dataset.ts:451-452, 458` |
| Case numbers | Items 0001 to 0006 get `caseNumberFor(seq, createdAt)`; today's items reuse the case of the item named in `caseOf` | `dataset.ts:525, 528, 544` |
| Boot time | Before the first of today's sessions by 32 min, and at least 45 min before `now` | `dataset.ts:471-475` |
| Pairing time | `pairedAt = bootAt + 4 min` | `initial-state.ts:176` |
| Time record | `lastSyncAt = now - 12 s`; TLS certificate `expiresAt = now + 300 days`; the DEMO certificate expiry is a fixed date (2030-12-31) | `initial-state.ts:285, 350`; `demo-alignment.ts:37` |
| Storage history | 24 hourly points ending at `now` | `initial-state.ts:270-273` |
| Join with DEMO packages | Ignores the dated parts of IDs and case numbers (section 3) | `join.ts:1-20`; `demo-alignment.ts:243-257` |

Why it matters (edge case E13 of the blueprint): the seed produces different IDs, timestamps and audit hashes on a different run date. The committed DEMO packages and examples are frozen at `2026-10-01T10:00:00.000+07:00` (`packages.generated.ts:10-11`; `examples.ts:39-41`). The join rule is what keeps them attached across dates. A PostgreSQL seed has to choose a clock rule (seed run date versus a fixed as-of date); this row records the existing behaviour only.

Verified: read all cited code; no execution.

### 2.9 Runtime generator (`sim/generator.ts`)

Not a seeder: it produces live activity (`createGeneratorSubsystem`, `generator.ts:171-215`).
- While RECORDING: arrivals as a Poisson process with mean 8,000 ms (`RECORDING_EVENT_MEAN_MS`, `constants.ts:30`); each arrival is chosen by a roll: below 0.45 a `FRAME_HASH` audit row (with a 64-hex hash), below 0.8 a `WRITE_VERIFIED` audit row (plus an AUTOSAVE timeline item and event at most once per minute), otherwise a `TIMESTAMP_CONFIRMED` audit row (plus a CHECK timeline item every 2 minutes); a HEALTH item every 5 minutes (`generator.ts:35-127`; constants `TIMELINE_*_MS`).
- Otherwise: one idle event every 60 s, choosing among health check, time sync and storage integrity (`IDLE_EVENT_INTERVAL_MS`, `constants.ts:32`; `generator.ts:130-158`).
- Catch-up after a hidden period: at most 120 rows (`GENERATOR_CATCH_UP_MAX`, `constants.ts:84`; `generator.ts:192-195`).
- `replayRecordingActivity` fills scenarios up to 00:18:42 (`generator.ts:161-169`).

Why it matters: an unbounded stream of audit rows (about 7.5 per minute while recording) goes through the hash chain; the 1,000-row ring means the simulator drops old rows, while a database keeps all rows. The stream's rate is the audit-append load the backend will see from the engine (edge case E12).

---

## 3. `src/demo-data/` and its join rule

### 3.1 Files

| File | Lines | Role | Status |
|---|---|---|---|
| `packages/shared/src/demo-data/index.ts` | 44 | Barrel, `getDemoEvidenceDocuments`, `demoVerificationTrust`, `demoAssetUrl` | EXISTING |
| `packages/shared/src/demo-data/types.ts` | 312 | Schema tags, `PACKAGE_ITEM_FILES` (6 files), `MANIFEST_FIELDS` (13), `EXPORT_MANIFEST_ITEMS` (8), `DemoEvidencePackage`, `DemoEvidenceIndex` | EXISTING |
| `packages/shared/src/demo-data/lookup.ts` | 37 | `demoIdSuffix`, `listDemoEvidencePackages`, `getDemoEvidencePackage`, `getDemoEvidencePackageBySession` | EXISTING |
| `packages/shared/src/demo-data/join.ts` | 54 | `demoCaseSequence`, `matchDemoPackage` (the one join) | EXISTING |
| `packages/shared/src/demo-data/verify.ts` | 488 | Pure verification helpers (hash, Ed25519, certificate, audit extract, export package) | EXISTING |
| `packages/shared/src/demo-data/packages.generated.ts` | 3,709 | `DEMO_EVIDENCE_INDEX` (generated) | EXISTING, generated |
| `packages/shared/src/demo-data/documents.generated.ts` | 94 | Manifest, metadata, signature text per package and the PEM certificate (generated) | EXISTING, generated |

Generated by `packages/shared/scripts/gen-demo-evidence.ts` (header: "Do not edit: re-run the generator"). The script needs the macOS `zip` CLI and has no `package.json` script (`gen-demo-evidence.ts:34`); it was not run. It loads the dataset through `createIdleState` at `--as-of` (`gen-demo-evidence.ts:304-341`) and takes the 14th item from the simulator's `finalizing` scenario.

### 3.2 What the index contains

Counted from `packages.generated.ts` (`grep -c`):
- 14 package entries (lines starting with six spaces and `"evidenceSuffix"`): 13 with `origin: DATASET`, 1 with `RECORDING_SCENARIO`.
- 1 tampered package (`"tampered": true`, evidence 0005); 1 export entry (`"export": {` at line 1001, evidence 0004); 13 packages with `"export": null`; 1 package with `finalizationStatus: INCOMPLETE` (line 1379, evidence 0006).
- Header: `asOf: 2026-10-01T10:00`, `datasetNow: 2026-10-01T10:00:00.000+07:00`, `joinKey: evidenceSuffix`, `assetRoot: packages/shared/assets` (lines 10-15).
- Index keys: `key` (Ed25519, key id `DEMO-KEY-EVSIGN-01`, a published seed phrase and a public key), `certificate`, `tamperedEvidenceSuffix: 0005`, `exportedEvidenceSuffixes: [0004]`, `liveSession: { sessionSuffix: 0024, evidenceSuffixWhenSealed: 0014 }`, `packages`, `apiExamples` (`packages.generated.ts:16-41, 3685`).
- Each package entry holds ids and suffixes, case number, subject, investigator, ISO timestamps at `+07:00`, `recordingDurationMs`, `excerptDurationMs`, `folder`, `files` (container, metadata, manifest, signature, certificate, auditExtract, each with path, bytes and SHA-256), `tracks` (4: stored media path, poster, thumbnail, mobile rendition, sealed hash), `signature`, `audit` summary, `export`, `verification` (`types.ts:202-236`).

Note on the DEMO key: the private key is derived from a published phrase (`DemoSigningKeyInfo.seedPhrase`, `types.ts:238-247`), so signatures prove nothing (stated in the index notice). It is demo material, not a secret.

### 3.3 The join rule

Quoted from `join.ts:1-20`: a simulator evidence item and a DEMO package describe the same interview when the evidence suffix matches (`EV-…-NNNN`, the D61 join key), the session suffix matches (`SES-…-NNNN`), the case **sequence** matches (the `NNNN` of `LP/YYYY/MMDD-NNNN`) and the subject name matches. "The dated parts of the IDs and of the case number are ignored on purpose" so media, hashes and verification join on any demo day.

Implementation: `matchDemoPackage(evidence, session?)` at `join.ts:43-54` (`demoCaseSequence` at `join.ts:24`); suffix extraction `lookup.ts:9-21` (`^(?:(EV|SES)-\d{8}-)?(\d{1,4})$`, namespace-checked); the simulator holds an equivalent table-based join in `sim/demo-alignment.ts:243-257` (`demoPackageIntegrityFor`), used by `sim/evidence.ts:151, 270, 353`. A session recorded live that seals into evidence 0014 with another case sequence or subject joins nothing and stays `SIMULATED` (`join.ts:15-17`).

Evidence suffixes and session suffixes are separate namespaces: session 0014 is evidence 0004, while evidence 0014 is the recording scenario's item (`demo-data/index.ts:11-13`).

Guards: `test/sim-demo-data-alignment.test.ts` rebuilds the alignment table from the index (line 68), asserts that `src/sim` never imports `demo-data` (line 91, keeps the web entry chunk small), checks all 13 DATASET items (lines 100-127), the tampered item (129-145), the export counter continuing at `EXP-000032` (162-171), and the join on another calendar day (236-247). `test/demo-evidence.test.ts:190` asserts 13 evidence items.

### 3.4 Consumers of `@dems/shared/demo-data`

Non-test files (Graft and `grep -rln`): web `features/evidence/{export-download, use-verification, index, sim-adapter, integrity-tab, demo-assets, model, media-tab, metadata-tab, manifest-summary, check-list, labels}`, `features/api-reference/api-document.ts`, `features/security-audit/{sim-adapter, use-security-data}`, `features/session-monitor/finalization-modal.tsx`, `features/system/demo-panel.tsx`; mobile `features/evidence/{evidence-media, metadata-tab, evidence-model}.ts(x)` and `components/media/demo-media.ts`; shared `api/examples.ts`, `sim/demo-alignment.ts` (comment only), `scripts/gen-demo-evidence.ts`. 34 files in all (including tests; `grep -rln '@dems/shared/demo-data'` over `apps/`, `packages/shared/{src,test,scripts}` and `scripts/`).

Why it matters: the evidence screens read packages, hashes and verification from this index, not from simulator state. The backend's evidence rows and its seed must either reproduce this join or supply the same fields (hashes, manifest digest, track list, media paths) through the API.

---

## 4. Media under `assets/`

The only `assets/` tree that holds demo media is `packages/shared/assets` (the repository has no root `assets/`: `ls /Users/gsp-budi/Documents/DEMS/assets` → "No such file or directory"). `apps/mobile/assets` holds a bundled copy of the mobile subset.

### 4.1 Listing commands and their output

```
$ A=/Users/gsp-budi/Documents/DEMS/packages/shared/assets
$ for d in brand demo-evidence demo-media hero; do echo "== $d: files=$(find $A/$d -type f | wc -l | tr -d ' ') bytes=$(find $A/$d -type f -exec stat -f %z {} + | awk '{s+=$1} END {print s}') du=$(du -sh $A/$d | cut -f1)"; done
== brand: files=3 bytes=462376 du=456K
== demo-evidence: files=89 bytes=2796503 du=2.9M
== demo-media: files=198 bytes=43564652 du= 42M
== hero: files=2 bytes=1408256 du=1.3M
$ echo "TOTAL files=$(find $A -type f | wc -l | tr -d ' ') bytes=..."
TOTAL files=292 bytes=48231787
$ du -sh $A
47M	/Users/gsp-budi/Documents/DEMS/packages/shared/assets
$ find $A -name .DS_Store      (printed nothing)
```

**Media file count: 198 files; total size: 43,564,652 bytes (41.55 MiB; `du -sh` shows 42M), including `README.md` (5,266 bytes) and `media-index.json` (81,632 bytes).** Without those two files the media are 196 files and 43,477,754 bytes (41.46 MiB), which matches the README's own line "Media size (without this README and the index): 41.46 MiB" (`demo-media/README.md`).

### 4.2 Breakdown

| Folder | Files | Bytes | Content |
|---|---|---|---|
| `demo-media/evidence/NNNN/` (13 folders, 0001 to 0013) | 104 (8 each) | 28,804,863 | per item: `VIDEO-01.mp4`, `VIDEO-02.mp4`, `AUDIO-01.m4a`, `AUDIO-02.m4a`, two `.poster.jpg`, two `.thumb.jpg`; item size range 1,912,284 bytes (0010) to 2,741,011 bytes (0003) |
| `demo-media/live/` | 8 | 2,026,623 | loops for the recording scenario (`VIDEO-01.loop.mp4`, `VIDEO-02.loop.mp4`, `AUDIO-01.loop.m4a`, `AUDIO-02.loop.m4a`, posters and thumbnails) |
| `demo-media/mobile/` | 84 | 12,646,268 | 640x360 subset, flat Android-safe names (`evidence_0001_video_01.mp4`, …) |
| `demo-media/README.md`, `media-index.json` | 2 | 86,898 | layout, provenance, hashes |
| `demo-media` total | **198** | **43,564,652** | |
| `demo-evidence/SESSION-<session id>/` (14 folders) | 89 (14 packages x 6 files, plus export and altered-media files, plus README) | 2,796,503 | packages: `evidence-container.json`, `metadata.json`, `manifest.json`, `signature.sig`, `device-certificate.pem`, `audit-session-extract.jsonl`; `SESSION-SES-20260930-0014/export/` holds `EXP-000031.zip` (2,276,249 bytes), `export-manifest.json`, `export-manifest.sig`; `SESSION-SES-20260930-0015/media/` holds the altered AUDIO-02 |
| `brand/` | 3 | 462,376 | icon foreground, icon monochrome, splash (PNG, 1024) |
| `hero/` | 2 | 1,408,256 | `room-1600.jpg` (326,153), `room-2560.jpg` (1,082,103) |
| **`assets` total** | **292** | **48,231,787** | |

The four folders sum to 48,231,787 bytes (462,376 + 2,796,503 + 43,564,652 + 1,408,256).

By extension inside `demo-media`: `.jpg` 84 files 2,354,573 bytes; `.m4a` 56 files 11,041,794 bytes; `.mp4` 56 files 30,081,387 bytes; `.json` 1; `.md` 1. Across the whole `assets` tree: 86 jpg, 57 m4a, 56 mp4, 44 json, 15 sig, 14 pem, 14 jsonl, 3 png, 2 md, 1 zip (sum 292).

Technical profile (`demo-media/media-index.json`, head): H.264 High, 1280x720, 25 fps, no audio stream; audio AAC mono 48 kHz 48 kbps; mobile 640x360, Main profile, 24 kHz 32 kbps. Clips are 31 to 47 second excerpts of each recording (`demo-media/README.md`; `core-web/src/components/media/demo-media.ts` header).

### 4.3 Bundled copy and consumers

- `apps/mobile/assets/media/`: 84 files, 12,646,268 bytes, **identical** to `demo-media/mobile/` (`diff -rq` printed nothing). Only step 72 of the predecessor writes it (`apps/mobile/src/components/media/demo-media.ts` header).
- Web: one Vite glob per consumer, `?url`, eager; no `data:` inlining (`apps/core-web/vite.config.ts:20-21`); `features/evidence/demo-assets.ts` globs `demo-media/evidence/*/*`, `demo-media/live/*` and `demo-evidence/**` (PEM excluded because Vite denies it; the certificate text comes from `DEMO_DEVICE_CERTIFICATE_PEM`); `components/media/demo-media.ts` globs live and evidence media; `features/dashboard/hero-panel.tsx` and `features/login/brand-panel.tsx` use the hero image.
- Mobile: static `require` map in `apps/mobile/src/components/media/demo-media.ts`, with a test that fails if the map and the folder differ.
- Paths in the index are relative to `packages/shared/assets/` (package export `@dems/shared/assets/*`, `package.json:16`).
- Generators (not run): `scripts/gen-demo-media.ts` needs Homebrew `ffmpeg` and `espeak-ng` (`demo-media/README.md`, "Regenerate"); `gen-demo-evidence.ts` needs the `zip` CLI. Both accept `--as-of` and are deterministic for one `--as-of`.
- Provenance: stills derive from `hero/room-2560.jpg` (Pexels licence, recorded in `THIRD_PARTY_NOTICES.md`); voices are eSpeak NG output (`demo-media/README.md`, "Provenance and licences").

Why it matters: the 41.5 MiB of media are static files joined to evidence by suffix. In a backend that serves them (IQ 8), these are 196 files in two sets (desktop 720p and mobile 360p), plus 14 package folders for verification. Nothing in the repository stores media bytes in a database today.

---

## 5. Findings the next rows must account for (index)

| ID | What | Why it matters | How verified | Source |
|---|---|---|---|---|
| R2-1 | `CORE_API_OPERATIONS` has exactly 10 entries; 34 documented responses; 1 LIVE, 9 SIMULATED | Defines what "this contract" is today and the scale of the extension | `grep -c` and test line 100 | `core-api.ts:418-650`; `openapi.test.ts:99-116` |
| R2-2 | No auth, pairing, evidence, audit, device-control, settings, demo or user-admin operation exists in the contract | Rows 15 and 98 write all of them | read; `openapi.ts:155-162` | `openapi.ts:155-162` |
| R2-3 | Reads carry no permission, no 401 and no 403 | Server-side RBAC needs a rule for every read | read plus `sessionAccess` grep | `core-api.ts:545-608`; `sim/api.ts:354-362, 369, 401, 436` |
| R2-4 | `mode` is a two-value enum driving badges, tags, filter and Try-it routing | A fully live API changes the whole mode model | read | `core-api.ts:374`; `openapi.ts:245-252, 324-327`; `sim-fetch.ts:106-125` |
| R2-5 | `INVALID_PATH`, generic 404, 405 and 500 answers are not in any operation's responses | Envelope-level errors need one definition | grep of `fail(` | `sim/api.ts:493, 504, 508-516`; `core-api.ts:88` |
| R2-6 | The drift test pins 10 operations, one LIVE, no security scheme, one host, and compares against the in-process simulator | A list of assertions that change by design (table in 1.6) | read | `openapi.test.ts:99-199, 316-395` |
| R2-7 | Realtime union has one member (`heartbeat`), `sessionState` always null | No schema exists for meters, state, permission or pairing events | read | `realtime-messages.ts:25-36` |
| R2-8 | Every network constant is single-valued; five duplicated literals sit in the standalone launcher; web allowlist covers port 5173 only | A second origin touches constants, CORS, launcher test and OpenAPI test | grep per constant | table 1.8 |
| R2-9 | KI-18 stale text at `core-api.ts:427` is repeated in 8 places including `openapi.json` | The correction needs one pass over all of them plus regeneration | read | section 1.10 |
| R2-10 | Dataset: 3 operators, 3 roles, 9 permissions, 15 grants, 1 device, 13 evidence items with 52 tracks, 82 audit rows and 59 events (derived), 4 scenarios | The seed mapping source list | read; counts derived statically | section 2.2 |
| R2-11 | One shared demo password constant and one fixed pairing code constant, both shown in the login screens | The target needs per-operator credentials and one-time codes; the constants are demo display data in both clients | read; names only | `dataset.ts:153, 157`; section 2.3 |
| R2-12 | All dataset dates and IDs derive from the seed date; DEMO packages and examples are frozen at 2026-10-01 10:00 WIB and join on suffixes | The seed date rule and the join must be chosen together | read | section 2.8, 3.3 |
| R2-13 | The audit generator would write about 7.5 rows per minute while recording; the simulator drops rows beyond 1,000 | Append load and retention differ in a database | read | section 2.9 |
| R2-14 | Media: 198 files, 43,564,652 bytes in `demo-media`; 292 files, 48,231,787 bytes in `assets`; mobile copy identical | Sizing and serving for IQ 8 | listing commands in 4.1 | section 4 |

---

## Gaps / Needs Investigation

1. **Audit and event seed counts (82 and 59) are derived, not executed.** A test or script that calls `createIdleState` with a fixed `now` and counts `audit.rows` and `events` would confirm them. Owner: row 16 or the seed row (the blueprint's rows 29 and 105 check seed integrity).
2. **Hash-chain values of the seeded audit rows were not computed.** They depend on `now`; a backend seed must recompute them (not copy them).
3. **Whether `openapi.json` currently matches the sources was not tested** (the test and the generator were not run, P7). The committed file and sources share a modification minute (2026-10-01 10:07) and `git diff HEAD -- packages/shared` is empty; row 13 runs the test baseline.
4. **`sim/types.ts` was only touched through references** (`SimActions`, `loadScenario`, `resetDemo` line numbers); the full action table belongs to row 1.
5. **The packaged launcher, mock-core internals and `scripts/release/` were cited only where they mention the shared constants**; row 5 owns them.
6. **Per-package file lists of `demo-evidence`** were counted by folder, not enumerated one by one; the index (`packages.generated.ts`) lists every path with bytes and SHA-256 if a row needs them.
7. **The 44 and 46 vocabulary counts are line-pattern counts** and should be re-confirmed by row 1 with the compiler's view of the object keys.

## Deviations from the instructions

- The agent's own definition names the output `research/01_explore.md`; the row and the controller's message name `research/01b_explore_contract_dataset.md`, which is what was written.
- Seed values of the demo password and the pairing code appear in the output of a few `grep` commands that were run for this inventory; they are not reproduced in this file (P19). Row 20 should treat the files named in 2.3 as the places where the literal sits.

---
*Generated: 2026-10-04*
*Last Updated: 2026-10-04*
