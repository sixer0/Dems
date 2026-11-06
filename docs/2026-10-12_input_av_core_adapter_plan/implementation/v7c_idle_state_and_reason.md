# Row V7c - an idle camera is NOT READ; the refusal word of a listed profile without its stream row

Agent V7c, wave 12, track D, 2026-10-14. Status: **complete**. Size M.
Sources: decisions C126 (b), C130, C139; request lines 523 (row V7), 535 (row S86a), 562 (row NB) of `delegation_progress/file_requests.md`; `implementation/v7_profiles_stream_state_account.md` (F-V7-2), `implementation/s86a_assignment_stream_row.md`.
Single writer of `packages/shared` in this row; Edit tool only for existing files (new files: this record and `row_v7c.md`, with Write); the OpenAPI document by its generator (`npm run openapi:gen`). Nothing committed, nothing left running.

## 1. Item 1 - an idle camera must not read LIVE (C126 (b))

### 1.1 The choice: the member NULLABLE, no third value
`CaptureConfigCameraSchema.streamState` (`packages/shared/src/api/state-slices.ts:238`) is now `z.enum(CaptureStreamState).nullable()` and `CaptureConfigCamera.streamState` (`sim/types.ts`) `CaptureStreamState | null`. Why not a third value: the registry entry (`state-slices.ts:1193`, `CaptureDeviceStatus.streamState`) has always said "no stream state" with null - a registered camera's entry is null from its registration (`sim/capture-registry.ts:79`) and after every restart (`rows.ts` `captureDeviceFromRow`). A third value would give the same fact two spellings across the two slices, widen `CaptureStreamState` (op 44, the device command refusal `details.streamState`, every exhaustive switch in the clients) and break OD-22's two-value meaning. Null on the line = the entry's null: NOT READ.

### 1.2 The rule implemented, with its sources
"Registered camera" = an entry with an `adapter` member (`cameraNotReadAtRest`, NEW, `sim/camera-stream-fault.ts`), the shape `registerCaptureDevice` gives (`capture-registry.ts`) and `rows.ts` keeps (built-ins have no `adapter`; the row layer tells them by `BUILT_IN_CAPABILITIES`).

| Event | Registered camera (entry and every line naming it) | Source line |
|---|---|---|
| assignment (ops 78 / 79), empty or held slot | the entry's value: null at rest (until V7c: LIVE from `online`) | `sim/capture-config.ts` `assignCamera` |
| Core restart (rehydration) | null on the line, as on the entry | `apps/core-server/src/db/mapping/rows.ts` `captureConfigFromRow` |
| telemetry ingest `CONNECTED` | LIVE (the worker receives the stream: the one reading the engine knows) | `sim/capture-telemetry.ts` `cameraOfIngest` (unchanged) |
| ingest `WAITING`; `ENDED` while RECORDING | LOST, `online` false (unchanged) | same |
| ingest `ENDED` outside a recording (the worker closed its ingest after the stop) | NEW: null, `online` unchanged - unless a stream-family fault is active (stays LOST) | `capture-telemetry.ts` `notReadAfterStop` |
| a session's check reached the source / did not | LIVE / LOST (unchanged: the check reaches the stream) | `sim/capture-notices.ts` `withDeviceOnline` |
| stream-family fault raised | LOST (unchanged) | `camera-stream-fault.ts` `cameraStreamStateAfterFaults` |
| last stream-family fault cleared, device online | NEW: LIVE only while the session is RECORDING (the state in which the engine holds an ended ingest as a loss, `cameraOfIngest`), else null; the next `CONNECTED` frame (about 20 a second) says LIVE again if the stream is read | same |
| last clear, device not online | LOST until telemetry says CONNECTED (unchanged) | same |

What the engine does NOT know of a read: a preview (web `camera-preview.tsx`) and a connection test (operation 108) reach no engine transition about the stream; they state nothing, so they never say LIVE.

### 1.3 Real and simulated paths
The two built-in cameras of the demonstration model (CAM-01, CAM-02, no `adapter` member) keep the model's LIVE / LOST from the registry flag on both slices, as their registry entries already did (rows.ts :905): every simulator test passed UNEDITED (`sim-capture-telemetry` V7 cases, `sim-api` op 76 `LIVE`, `sim-capture-notices`, `sim-capture-config`...). A registered camera - every production camera (ONVIF_RTSP) and every adopted development source - follows 1.2 on the Core and in the simulator alike.

### 1.4 Consumers
Every consumer compiles: shared `tsc` 0; Core `tsc` only the 9 known errors of N13's protocol change (below); web `tsc -b` 0; mobile `tsc` 0. One compile fix in a Core test of mine: `capture-config.db.test.ts:43` local `Selector` type `streamState: string | null`. `sim/api.ts:422` and Core `status.ts:236` (op 44) fall back from a null line to the registry flag - op 44 still says LIVE at rest (request line). Clients' words for null: row W6 (request line).

## 2. Item 2 - the new refusal word (C130)

- Word: `CAMERA_PROFILE_WITHOUT_STREAM`. Sentence, in the contract's closed list `common.captureSlotRefusal` (`packages/shared/src/i18n/en/common.ts`, third key after the two profile words): "This camera was not assigned: the Core holds no stream facts for this profile, so the camera cannot record it. A connection test does not repair this. Adopt the camera again, then assign one of the profiles it states." (word for word the Core's `PROFILE_WITHOUT_STREAM_TEXT`, the `message`).
- Core: `CaptureProfileRefusal` gains the member; `PROFILE_WITHOUT_STREAM_REASON` = `CAMERA_PROFILE_WITHOUT_STREAM` (`routes.ts`; seam comment and file header updated). The judge and the table are unchanged.
- Pins: `test/i18n.test.ts` - first-three keys, full key list (6 -> 7), distinct sentences 6 -> 7, the sentence word for word. Core `routes.test.ts:735` and the S86a db case (`capture-config.db.test.ts` :1557, :1578) expect the literal word.

## 3. Item 3 - decision C139 (request line 562 of row NB)
`packages/shared/src/api/security-audit.ts` `SYSTEM_BOOT_HOST_DETAILS_EXAMPLE` gains `microphonePermission: 'NOT_KNOWN'` and one doc sentence (darwin only; the boot opens no device and does not read the system's privacy database, SM-15). The example does not reach `openapi.json` (the generator's diff names only the three `streamState` places).

## 4. Tests and mutations (each a temporary Edit, seen RED, reverted; leftover grep empty)

New: `packages/shared/test/sim-capture-telemetry.test.ts` describe "row V7c" (4 cases); `apps/core-server/src/db/mapping/__tests__/from-rows.test.ts` describe "row V7c" (1 case).

| Mutation | RED |
|---|---|
| M1 empty-slot assignment falls back `?? (online ? LIVE : LOST)` | "an assignment reads nothing" (line 'LIVE', expected null) |
| M1b held-slot assignment `device.streamState ?? entry.streamState` | the same case |
| M2 `notReadAfterStop` says nothing | "LIVE only while read" |
| M2b the fault guard of `notReadAfterStop` removed | "a stream fault" (null, expected LOST) |
| M3 the clear always says LIVE | "a stream fault" (idle leg) |
| M3b the clear never says LIVE for a registered camera | "a stream fault" (recording leg) |
| M4 schema `.nullable()` removed | "the contract" |
| M5 `captureConfigFromRow` LIVE/LOST from `enabled` for every camera | from-rows "row V7c" |
| M6 `PROFILE_WITHOUT_STREAM_REASON` back to `CAMERA_PROFILE_NOT_OF_DEVICE` | routes.test "the word"; db "row S86a (C-1)" (PROFILE_1 leg) |

## 5. Checks (result lines)
- Shared: `vitest` sim-capture*, sim-api, i18n, api-*, live-source-bindings, state*: `Test Files 29 passed (29)`, `Tests 998 passed (998)`; sim-evidence-item-kind + sim-sending-device: `Tests 55 passed (55)`; `tsc --noEmit` exit 0; `oxlint` exit 0.
- OpenAPI: `npm run openapi:gen` (sandbox off: tsx's IPC pipe) "wrote openapi/openapi.json (all (committed): 110 operations, 2 security schemes, version 0.3.0; offline: 44 operations ...)"; diff against the pre-run file = the three `streamState` schemas (anyOf enum | null) and their description.
- Core unit (`--project unit`): capture-config module, db/mapping, forwarder-engine, capture-notices, devices: 706 passed; the 20 reds were `camera-network/__tests__/service.test.ts` and `factory-scan/__tests__/service.test.ts` - loopback stub tests refused by the sandbox (EPERM), files not touched here and not reading `streamState` or the refusal word. NOT RE-RUN: the re-run queued on `.locks/heavy-host.lock` for 23 minutes behind another session's `capture-worker/test/e2e.py` (holding it 50 minutes) and was stopped by me; nothing of mine left running. Open for the controller's per-commit run.
- Core db (throw-away clones, `.locks/db-migrate.lock`): capture-config.db, engine capture-actions.db, test/db/device-upsert.db, adapters device-upsert.db: `Test Files 4 passed (4)`, `Tests 57 passed (57)`.
- Core `tsc --noEmit`: exit 2, ONLY the 9 known errors of N13: `capture/__tests__/fault-lifecycle.test.ts` (1), `forwarder-advisories.test.ts` (1), `forwarder-engine.test.ts` (2), `capture/adapters/mic-transport.ts` (2), `capture/fence/__tests__/development-session.db.test.ts` (2), `test/support/capture.ts` (1). `oxlint` of the five Core files: exit 0.
- Web: `tsc -b` exit 0, `oxlint` exit 0; devices + session-monitor + real-core-facts: `Tests 1 failed | 430 passed (431)` - the red is `selector-microphones.test.tsx` row 234 `named` list (the new word; W6's, request line).
- Mobile: `tsc --noEmit` exit 0, `eslint .` exit 0; capture-selector + devices: `Test Suites: 38 passed`, `Tests: 485 passed`.
- Counts: unchanged by this row - no operation, audit type, action or verify notice added, no count pin moved (the generator states 110 operations); only the i18n group `captureSlotRefusal` 6 -> 7.

## 6. Requests left (file_requests.md)
W6 web: the `named` pin (blocking that one test); W6 mobile: `PROFILE_REFUSAL_REASONS`; W6 both: words for a null stream state; CB + next shared writer: op 44 still LIVE at rest; owner of `capture-config/slices.ts`: the builders still derive LIVE/LOST.

## 7. Driver decisions
- DD-1: "registered" = an entry with `adapter`; the built-in pair keeps the demonstration model's LIVE/LOST on lines and on restart (the entry's precedent, rows.ts :905), so the simulator's demo and tests stay unchanged.
- DD-2: the clear restores LIVE for a registered camera only while RECORDING; otherwise null, corrected within one telemetry frame when the stream is in fact read.
- DD-3: an ENDED ingest outside a recording makes a registered camera NOT READ; an abandoned pre-check that said LIVE (`withDeviceOnline`) stays LIVE until the next ENDED or a restart - not closed here (no session-end transition was touched).
