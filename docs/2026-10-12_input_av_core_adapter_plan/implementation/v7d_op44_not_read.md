# Row V7d - operation 44 / 46 and the slice builders say NOT READ; the sweep of flag-derived stream states

Agent V7d, wave 12, track D, 2026-10-14. Status: **complete**. Size S.
Sources: decision C141 (rulings on request lines 567 and 568), C126 (b); `implementation/v7c_idle_state_and_reason.md`; request lines 567, 568 of `delegation_progress/file_requests.md`.
Single writer of `packages/shared/**` in this row, of `apps/core-server/src/modules/devices/status.ts` and `modules/capture-config/slices.ts`. Edit tool only for existing files (new files: this record and `row_v7d.md`, with Write); `openapi.json` by its generator. Nothing committed, nothing left running. No device, no port of the reserved list; the two loopback-stub test files ran under `.locks/heavy-host.lock`, the db tests on the db project's throw-away clones under `.locks/db-migrate.lock`.

## 1. Item 1 - operation 44 (and 46) say NOT READ (request line 567)

One step, both builders and the contract:

| Place | Before | After |
|---|---|---|
| `packages/shared/src/api/core-api.ts:424` `VideoTrackStatusSchema.streamState` | `z.enum(CaptureStreamState)` | `.nullable()`, description: null = NOT READ (a registered camera at rest, or a track without a source); never derived from `online` |
| `packages/shared/src/sim/api.ts:272` `ApiVideoTrack.streamState` | `CaptureStreamState` | `CaptureStreamState \| null` |
| `packages/shared/src/sim/api.ts:424` (simulator `videoTracks`) | `slot?.streamState ?? (camera.online ? LIVE : LOST)` | `slot?.streamState ?? null` |
| `apps/core-server/src/modules/devices/status.ts:238` (`videoTracksOf`, ops 44 + 46) | `slot?.streamState ?? (camera.online ? 'LIVE' : 'LOST')` | `slot?.streamState ?? null` (doc comment :216-221 updated) |

The schema is shared by operation 44 (`DeviceHealthResponse.cameras`) and 46 (`VideoStatusResponse.tracks`), so both moved together; the parity of the Core's builder with the simulator's is kept (same expression).

Two consequences, both intended:
- a null LINE (registered camera at rest) answers null (until now LIVE from the hardware slice's `online`);
- a track WITHOUT a line (unassigned slot, `sourceDeviceId: null`) answers null too (until now LIVE / LOST from the built-in camera of the port - a stream of a source that does not exist).

The simulator's built-in demo cameras keep their simulated values exactly: CAM-01 / CAM-02 always have their selector lines in the demonstration model (`sim/initial-state.ts:159-160`, `LIVE`), the lines keep the model's value since V7c (`sim/capture-config.ts` assignment takes the entry's value; the built-in entries carry `LIVE` / `LOST`), and the builders now read only the line. Every existing simulator and op 44/46 test passed UNEDITED (sim-api, status.test, devices.db).

## 2. Item 2 - the slice builders (request line 568)

`apps/core-server/src/modules/capture-config/slices.ts`: NEW `BUILT_IN_DEVICE_IDS` (:77, from `DEFAULT_CAPTURE_DEVICES`, the same derivation as `rows.ts` `BUILT_IN_CAPABILITIES`) and `streamStateAtRest` (:80): built-in -> `enabled ? 'LIVE' : 'LOST'`; any other -> null. Used by `captureConfigSliceOf` (:139, the camera line) and `captureDevicesSliceOf` (:178, the camera entry). The builders now agree with `rows.ts` `captureConfigFromRow` / `captureDeviceFromRow` (V7c). The import of `db/mapping` was NOT taken (module imports are pinned; the row layer itself says it mirrors this module).

## 3. Item 3 - the sweep (grep `streamState` and `'LIVE'` over `packages/shared/src` and `apps/core-server/src`, tests excluded)

| Place | States | Verdict |
|---|---|---|
| `shared/src/sim/capture-notices.ts:316` `withDeviceOnline` (clear of `CAPTURE_DEVICE_UNREACHABLE`, phases PRECHECK / PRESENCE / SESSION_START) | LIVE for every camera that ANSWERED | **MADE CONSISTENT (fixed here).** The answer is a read of the camera's CONTROL service - the Core's probe asks the adapter's `profiles` (`apps/core-server/src/capture-notices/probe.ts` header, "a camera is asked through a READ of its adapter (`profiles`, by default)") - not of its stream. V7c's table and the header of `camera-stream-fault.ts` called it "the check reaches the stream"; the probe says otherwise. Now, for a REGISTERED camera (`cameraNotReadAtRest`): a `LIVE` the ingest stated is kept, `LOST` is kept while a stream-family fault is active, else NULL. The built-in pair keeps LIVE. This also closes V7c's DD-3 (an abandoned pre-check left LIVE). |
| same, the raise (`online` false) | LOST | correct as is: a camera that does not answer delivers no stream; LOST is the negative result of a read, and what OD-22 means |
| `shared/src/sim/api.ts:424`, `core-server/.../devices/status.ts:238` | LIVE / LOST from `online` | made consistent (item 1) |
| `core-server/.../capture-config/slices.ts:139`, `:178` | LIVE / LOST from `enabled` | made consistent (item 2) |
| `core-server/src/db/mapping/rows.ts:905`, `:989` | built-in by `enabled`, else null | correct as is (V7c) |
| `shared/src/sim/capture-telemetry.ts:116-118` `cameraOfIngest`, `:128` `notReadAfterStop`, `:149` | LIVE on CONNECTED, LOST on WAITING / ENDED under a recording, null after the stop; LOST over an active fault | correct: these ARE readings of the stream (the worker's ingest) |
| `shared/src/sim/camera-stream-fault.ts:111` (last clear of a stream fault) | LIVE for a registered camera only while RECORDING, else null | correct as is (V7c DD-2): while recording the ingest is read and the next frame (WAITING -> LOST) corrects a camera that is not; stated as a bound, not a flag |
| `shared/src/sim/capture-config.ts:240`, `:248` (assignment) | the entry's value | correct (V7c) |
| `shared/src/sim/capture-registry.ts:79`, `:166` (register, re-address) | null | correct |
| `shared/src/sim/initial-state.ts:106-160`, `api/state-examples.ts:336-406`, `api/examples.ts:195`, `:209` | LIVE for CAM-01 / CAM-02, null for others | correct: the demonstration model's built-in pair and examples of it |
| `shared/src/api/capture-discovery.ts:947`, `:1323` | null | correct (registered camera examples) |
| `shared/src/api/devices.ts:313`, `:328` (op 48 words: `CAMERA_NOT_LOST`, `details.streamState: LIVE`) | words only | correct as is: OD-22's PoE cycle is enforced nowhere and `CAMERA_NOT_LOST` is produced nowhere (C126 (a)); no state is derived from it. If OD-22 is ever built, "not lost" must include NULL |
| `'LIVE'` hits of `HeartbeatState`, `CoreMode`, `CoreApiMode`, `API_BADGES`, i18n `coreMode` | not a stream state | out of scope |
| Core: no other `streamState` / `'LIVE'` literal outside the four files above (grep) | - | - |
| CLIENTS (not mine): `apps/mobile/.../capture-source-sheet.tsx:198` `option.streamState ?? 'LIVE'`; web `camera-preview.tsx:100` `data-state` 'ONLINE' for a null line | a flag-free LIVE / ONLINE for an unread stream | request line to W6 |

Descriptions kept true: `state-slices.ts` `CaptureConfigCameraSchema.streamState` (the sentence "or a session's check reached the source" replaced by "a pre-check or re-scan that reached the camera read its control service, not its stream, and states NULL") and the header of `camera-stream-fault.ts` (same correction).

## 4. Tests and mutations (each a temporary Edit, seen RED, reverted; leftover grep empty)

New (one describe appended to each subject's existing file; no existing case edited):
- `packages/shared/test/sim-api.test.ts:730` "row V7d" (1 case: ops 44 and 46 equal, null for a registered camera at rest while `online` is true, null for a track without a line, CONTROL built-in LIVE);
- `packages/shared/test/sim-capture-notices.test.ts:493` "row V7d" (2 cases: PRECHECK and PRESENCE clears -> null, raise -> LOST, CONTROL CAM-01 LIVE; a LIVE of the ingest kept; an active stream fault keeps LOST until its own clear, then null);
- `apps/core-server/src/modules/devices/__tests__/status.test.ts:790` "row V7d" (1 case, the Core's builders);
- `apps/core-server/src/modules/capture-config/__tests__/slices.test.ts:363` "row V7d" (1 case, both slices, enabled and disabled, CONTROL CAM-01 LIVE / LOST).

| Mutation | RED |
|---|---|
| M1 `sim/api.ts` fallback `?? (camera.online ? LIVE : LOST)` back | sim-api "row V7d" |
| M2 `withDeviceOnline` LIVE for every answering camera | notices "row V7d" both cases |
| M3 the ingest's LIVE not kept (null always) | notices "the answer keeps what a reading stated" (LIVE leg) |
| M4 the active stream fault ignored | the same case (fault leg; M3 reverted, run alone) |
| M5 `.nullable()` removed from `VideoTrackStatusSchema` | sim-api "row V7d" + 4 existing unassigned-track cases (the bodies now carry null) |
| M6 `status.ts` fallback back | status.test "row V7d" |
| M7 `streamStateAtRest` by `enabled` for every camera | slices.test "row V7d" |
| M7b only the entry builder (:178) back to the old form | slices.test "row V7d" (entry leg) |

## 5. Checks (result lines)
- Shared: `vitest` sim-capture*, sim-api, api-*, openapi, live-source*: `Test Files 37 passed`, 2 failed = the two OpenAPI drift tests BEFORE regeneration; after `openapi:gen`: openapi, api-openapi-scope, api-registry, api-domain-operations, sim-api, sim-capture-notices `Test Files 6 passed (6)`, `Tests 184 passed (184)`. `tsc --noEmit` exit 0; `oxlint` (7 files) exit 0.
- OpenAPI: `npm run openapi:gen` (sandbox off: tsx's IPC pipe, `listen EPERM` in the sandbox) "wrote openapi/openapi.json (all (committed): 110 operations, 2 security schemes, version 0.3.0; offline: 44 operations ...)". Diff against the copy taken before (`.cache/task4-v7d/openapi.before.json`, git-ignored): the `VideoTrackStatus` member `streamState` (enum -> anyOf enum | null, with its description) and the three copies of the `CaptureConfigCamera` description sentence. Nothing else.
- Counts unchanged: 110 operations (`api-registry.test.ts:353` green), 85 audit types / 52 actions / 9 notices untouched (no type, action or notice added; no count pin moved).
- Core unit (`--project unit`): modules/devices, modules/capture-config, capture-notices, db/mapping, forwarder-engine: `Tests 20 failed | 708 passed (728)` - the 20 = `capture-config/camera-network/__tests__/service.test.ts` (7) and `factory-scan/__tests__/service.test.ts` (13), `listen EPERM 127.0.0.1` in the sandbox; re-run with the sandbox off under `.locks/heavy-host.lock`: `Test Files 2 passed (2)`, `Tests 156 passed (156)`. `oxlint` (4 files) exit 0.
- Core db (throw-away clones, `.locks/db-migrate.lock`): devices.db, capture-config.db, capture-inputs no-device.db, engine capture-actions.db, capture-notices session-start.db, precheck-unassigned.db: `Test Files 6 passed (6)`, `Tests 98 passed (98)`.
- Core `tsc --noEmit`: exit 2, ONLY the 9 known errors of N13's protocol kind: `capture/__tests__/fault-lifecycle.test.ts` (1), `forwarder-advisories.test.ts` (1), `forwarder-engine.test.ts` (2), `capture/adapters/mic-transport.ts` (2), `capture/fence/__tests__/development-session.db.test.ts` (2), `test/support/capture.ts` (1). No other.
- Web `tsc -b` exit 0; mobile `tsc --noEmit` exit 0 (rendering of null: W6).

## 6. Requests left
One line in `file_requests.md` to W6: ops 44/46 nullable (no client calls them today besides `apps/mobile/src/runtime/dev-probes.ts`); after a passing check a registered camera is null, not LIVE; the tablet's `capture-source-sheet.tsx:198` `?? 'LIVE'` and the web's `camera-preview.tsx:100` 'ONLINE' for a null line.

## 7. Driver decisions (for the controller to confirm)
- DD-1: `withDeviceOnline` is fixed in this row (it is in packages/shared, my area; item 3 says "fix the ones in your files"). The answer of a check is a control-service read, so it never says LIVE for a registered camera; it keeps an ingest's LIVE and a fault's LOST. The raise still says LOST.
- DD-2: a track WITHOUT a line answers null on ops 44/46 (the same `?? null`), not the built-in camera's flag - consistent with `sourceDeviceId: null` (row 150).
- DD-3: `slices.ts` derives "built-in" from `DEFAULT_CAPTURE_DEVICES` locally rather than importing `rows.ts` (module import pins; the row layer already mirrors this module by design).

## 8. Unproven (hardware package)
Nothing here reaches a device. Whether a real camera's ingest says CONNECTED promptly enough that a not-read line turns LIVE within a frame of a recording start is a hardware fact (9A/H, the camera chapters); the doubles here are the simulator's state and hand-built committed states.
