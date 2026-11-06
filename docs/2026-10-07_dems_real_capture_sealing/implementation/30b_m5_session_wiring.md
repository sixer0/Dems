---
task_id: 2026-10-07_dems_real_capture_sealing
row: 71b (Core half of row 71)
date: 2026-10-09
agent: coder-execution
status: needs-review
---

# Row 71b — session wiring to the capture supervisor, fault life cycle, audio-source switch (Core)

Paths are below `apps/core-server/`. Baseline `e296ce7`. No commit, no migration (schema `[5, 'dbc-6']`).
Built against protocol 4 (`delegation_progress/contract_71a_protocol_landed.md`); the worker is the
`FakeWorkerProcess` in every test here. Each check was run once after its last change (D122).

## 1. What was built

| # | What | Where |
|--|--|--|
| 1 | NEW closed unit `src/capture-session` (`sessionCapture(app)`, built on first use, `app.ts` untouched): start, durable, end, stop, operation 81, hand-off events | `src/capture-session/index.ts`, `statements.ts` |
| 2 | Start INSIDE the unit that persists RECORDING: row 66's `assertRecordableSelector`, row 136's `buildSessionCaptureSources`, `captureDurable: false`, the four `session_capture_sources` rows in ONE statement, re-read + `assertSessionSourcesOfOperation` (MR-S1, MR-S6). Refusal = 409 `INVALID_STATE`, `details.reason: SOURCE_KIND_NOT_RECORDABLE`, unit not committed | `index.ts` `recordingStartedIn` |
| 3 | After the commit: microphones opened, `buildCapturePlan`, `app.capture.start` ONCE, cameras opened when the worker acknowledged; the recorder of row 59 is MOUNTED here (one `createFragmentRecorder` per session on `app.capture.on('record')`, store on the runtime pool) | `index.ts` `begin` |
| 4 | Durable rule (D84): first fragment record -> `captureDurable: true`; `FAULTED` / refused start -> failed start (FAULT, `startedAt` null, 0 bytes, no evidence item at recovery) or interrupted (FAULT, bytes kept, event `INTERRUPTED`). Durable = supervisor's `durable` OR the payload OR a camera file of the plan on the disk | `index.ts` `captureEnded`; `src/engine/capture-session.ts` |
| 5 | Stop: worker told FIRST (`app.capture.stop`, awaited to its exit), then the recorder's last rows, then every source handle closed (pass D3's request) | `index.ts` `afterStopCommitted`, `release` |
| 6 | A stop while nothing is durable is refused: 409 `INVALID_STATE`, `details.reason: CAPTURE_NOT_DURABLE` | `index.ts` `stopRequestedIn` |
| 7 | Operation 81 routed. Real: command -> the worker's `AUDIO_SOURCE_INTERVAL` record (before its ACK) -> ONE unit: state, closed + opened `session_audio_intervals` rows, `AUDIO_SOURCE_SWITCHED` with the C3 §5.2 keys (`fromInput, toInput, fromMs, toMs`, `sendingDeviceId` when the session is a paired device's). Simulated: the simulator's hosted action | `modules/sessions/routes.ts` (81); `index.ts` `switchReal` / `switchSimulated` |
| 8 | Engine capture doors (not on the `EngineHost` seam: `captureDoorsOf(app.engine)`): `markCaptureDurable`, `endCapture`, `clearCaptureFaults`; in-unit doors `markCaptureConnectingIn`, `switchCaptureAudioSourceIn`; `captureDurable` derived at rehydrate from the fragment rows (mode real) | `src/engine/host.ts` (capture blocks), `capture-session.ts`, `internal-actions.ts`, `types.ts`, `index.ts`, `limits.ts` |
| 9 | Supervisor on protocol 4: subjects are device IDs only; record subject rule (camera / microphone / none); `warning` event carries `reason`; `switchAudioSource` resolves with the interval record of its command; `ownFault` is the newest session's (R-3); proof-build `HELLO` refused, not retried (`CAPTURE_WORKER_PROOF_BUILD`) | `src/capture/supervisor.ts`, `types.ts` |
| 10 | Forwarder: reasons per (code, device), R-1..R-4, advisory reasons raise no fault (D127), notices for keyframe interval / `nearBound` / `ratePpm` at the limit (once per episode, log + error log) | `src/capture/forwarder.ts` |
| 11 | Capture unit: worker settings passed by name (`captureWorkerSettingArguments`, contract mic constants), stale capture faults cleared at boot (mode real), row 61's `mountCaptureBootChecks` mounted (D138), capture mode read through the one function | `src/capture/index.ts` |
| 12 | Sessions routes: start / stop hooks, operation 81 (`CAPTURE_SESSION_OPERATION_IDS`, beside the fifteen) | `modules/sessions/routes.ts`, `operations.ts`, `index.ts` |

Ports: `VIDEO-01` -> 127.0.0.1:8554, `VIDEO-02` -> 8556. Files: `<mediaStoreDir>/SESSION-<id>/VIDEO-0n.mp4`.

## 2. Fault life cycle (D84)

- R-1 / R-2: protocol 4 forbids a null subject and a role word; the supervisor ends a worker that sends either (`WARNING_SUBJECT_UNKNOWN`).
- R-3: a supervisor fault of another session than the held one = clear, then raise (two `FAULT_RAISED` rows).
- R-4: first `RECORDING` of a session, and the boot in mode real: `clearCaptureFaults` (every active `MIC_SILENT` / `CAPTURE_FAULT` of the engine, each with `FAULT_CLEARED`).
- Never demo op 74, never an automatic switch.

## 3. `captureDurable` across a restart

Derived at rehydrate from "a `recording_fragments` row of the session exists" (no column). SUFFICIENT
for what is presented. NOT sufficient to decide a failed start: a Core that went down between the
worker's write and the row insert reads `false` while a camera file exists. So after a restart the
member never drops evidence by itself; row 82's RECOVERY must walk the camera files
(`validateCameraFile` / `insertMissing`) before a session is treated as a failed start. No migration asked.

## 4. Results

| Check | Command | Result |
|--|--|--|
| Session wiring on PostgreSQL (12 cases) | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture-session` (sandbox off) | 12 passed |
| Capture unit tests incl. new `fault-lifecycle.test.ts` (15), sessions unit tests, `test/static`, engine static | `npx vitest run --root apps/core-server --project unit src/capture/__tests__ src/modules/sessions/__tests__ test/static src/engine/__tests__/static.test.ts` | 600 passed, 3 failed: `app.ts` frozen-file pin (mount lines of rows 90 / 91), the two baseline MODG route-list tests |
| core-server typecheck | `npx tsc --noEmit -p apps/core-server` | 0 errors in this row's files; 28 in `src/engine/__tests__/seal-actions.db.test.ts` (row 82, in flight) and `modules/recording-fragments/__tests__/recording-fragments.db.test.ts` :212-213 (protocol 4 fixture, request filed) |
| core-server lint | `npm run lint -w @dems/core-server` | 0 findings in this row's files |

Negative controls (evidence integrity): class refusal x3 (no registry, another class, no opener) against
the good start; failed start against the interrupted control and the file-on-disk case; stop order
against "source closed first" (one `FAULT_RAISED CAPTURE_FAULT@CAM-02`); proof build against a release `HELLO`.

## 5. Not proven / limits

1. No real worker ran: 71a's e2e against this supervisor is a runner item (section 8).
2. HTTP level in mode real is not exercised (the db test drives the unit as the route does); the routes are covered in mode simulated only.
3. The engine knows a fault by (kind, device): `MIC_DISCONNECTED` and `MIC_RATE_AT_LIMIT` of one microphone are ONE `CAPTURE_FAULT` there (raised by the first, cleared after the last); the forwarder keeps them apart. Separate alerts per reason need the shared simulator (request filed).
4. Advisory keyframe interval, `nearBound` and the rate limit reach the log and the error log, not an operator alert (no notice reason exists in the shared contract; request filed). The rate limit also raises the worker's `CAPTURE_FAULT` on that microphone, which IS an alert.
5. `FIRST_VIDEO_SAMPLE.skipped / skippedSpanMs` is carried in the `STOPPED` / `INTERRUPTED` events (`firstVideo`) and logged; no session column holds it.
6. A simulator fault that moves a RECORDING session to FAULT by itself does not stop the worker (only capture-side ends and operator stops do).
7. Operation 82 is not routed. Transcriber session open / close is not wired here (only the tap path is asked).
8. No unit test of the pure transitions alone; they are exercised through the db test.

## 6. To wire

- Row 82: subscribe `sessionCapture(app).on(...)` — `INTERRUPTED` (interrupted seal) and `STOPPED` (normal seal): `{ sessionId, files: [{ trackId, deviceId, path }], firstVideo, fragmentRowsBehind }`; RECOVERY decides failed start vs interrupted from the files; move the engine file-count pin by its delta.
- Row 139: `CONNECTING` / `STARTED { cameras, camerasNotOpened }` / `DURABLE` / `FAILED_START { cause }` for 'connecting cameras', the degraded warning and `notifyNoCameraConnected`; `reason: NO_CAMERA_CONNECTED`, `evidenceFiles: 0` on the fault row is not written yet.
- Row 140: `sessionCapture(app).replace({...})` is the test seam; production ports come from the fence.
- Row 61: a config key for `ingestOpenWindowMs` (today the protocol default, `CAPTURE_WORKER_PROCESS_SETTINGS`).

## 7. Device / browser flows for gate 75

- Flow A: development session start -> 'connecting cameras' -> 'recording' at the first fragment; four source rows; stop -> no fault alert.
- Flow B: start with no camera -> FAULT after the ingest-open window, no evidence item after recovery.
- Flow C: switch microphone on web and on the tablet: one `AUDIO_SOURCE_SWITCHED` row, `sendingDeviceId` = the tablet's `DEV-NNNN`, interval rows in media ms.
- Flow D: stop pressed while 'connecting cameras' -> refused with the stated text.
- Flow E: kill the worker after the first fragment -> FAULT, interrupted hand-off.

## 8. Checks for the test runner

| Command | Lock | Expected |
|--|--|--|
| `make -C apps/capture-worker e2e` (71a's `sup_*`, `kc1`, `kc3`, `sup_nocam` on this supervisor) | heavy-host | as 71a states; proves the v4 records pass the supervisor |
| `npm run test -w @dems/core-server` | none | baseline + `app.ts` pin (rows 90 / 91) + `api-headers` (row 91) + engine file-count pin until row 82 moves it |
| `npm run test:db -w @dems/core-server` | db-migrate | real-mode boots of `fence.db.test.ts`, `integration-c1.db.test.ts`, `capture-actions.db.test.ts` need `realBootFixture()` since the boot checks are mounted (request filed) |

## 9. Decisions taken

1. The wiring is a unit of its own (`src/capture-session`), not `modules/sessions`: that module's static rules forbid own rows and `scope.unit`.
2. The capture start runs in the background after the commit; the start answers 200 with `captureDurable: false`.
3. Failed start = `startedAt` null + 0 bytes, so the existing recovery makes no evidence item (no simulator change).
4. Stop while not durable is refused (new `details.reason: CAPTURE_NOT_DURABLE`); helper leftovers refuse a start with 503 `NOT_READY` (`CAPTURE_HELPERS_LEFT`). Neither reason is in C3 §4 yet.
5. Capture doors are beside the `EngineHost` seam, so six foreign engine test doubles stay untouched.
6. Audit `fromMs` is the stored interval row's start (21 ms for the first interval), `toMs` the record's boundary; the row's `at` is the Core instant of the command's unit, `from_at` the capture instant of the boundary (both times kept, D142 (c)).
7. A switch that the worker realised but whose unit failed: the interval rows are written apart, the answer is 503, the error log has it.
8. Operation 81 is kept beside the fifteen session operations (`CAPTURE_SESSION_OPERATION_IDS`) so the MODG ledger of 24-38 is not widened here.
9. Out-of-map edits: `test/support/capture.ts`, `capture-stub-worker.mjs` (protocol 4 fixtures), `test/static/imports.test.ts` (one closed-unit entry), `engine/{types,internal-actions,limits,index}.ts`, one python-scripted type edit of three signature lines in `engine/host.ts` (rule deviation: not the Edit tool; diff checked, row 82's blocks intact).
