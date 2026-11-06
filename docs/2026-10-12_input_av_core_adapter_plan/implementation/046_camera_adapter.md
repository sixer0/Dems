---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 46
milestone: M3 / WP-06b
date: 2026-10-13
agent: coder-execution (batch 7, agent Y)
tier: T3
requirement: P12-B2, P12-F01, P12-F05 (a), F03 (the bound of one open); AD-02 (1) the reader's half, AD-02 (2), AD-03 (1) (6) the holder's half, AD-05 (1), AD-08, AD-09 (3); BR-07 (3) (4), BR-08; S13-01 and S13-02 through the adapter; RC-2, RC-3 (i); decisions C34 to C37, C40
status: complete - built and proven at adapter level on doubles; registered nowhere; 16 driver decisions for the controller (section 8)
---

# Row 46: the production camera adapter (`openSource` through the relay)

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server/src`.

## 1. Statement

A production camera can be opened by the Core: `createOnvifRelayCameraAdapter(devices, deps).openSource(deviceId, target, signal)` reads the stored credential through its reader, asks the camera once for the stream address of the plan's profile, starts the capture relay through the production door with the session's ingest address, and resolves when the relay says the worker took its push. It is bounded at 25,000 ms, a started relay is killed and waited for at the bound and after an aborted open, `close()` ends the relay within a bound, and every way an open can fail is a named code.

The adapter is **registered nowhere**. The class-C stub `CS/capture/adapters/camera/onvif-rtsp.ts` is not edited and stays what the loader names; a real registry refuses the built adapter (`CAPTURE_ADAPTER_INVALID`); no production source imports it (static rule A-9). No boot can reach it before the lift (WP-13, rows 85 and 88).

## 2. Change set

| File | State | What |
|---|---|---|
| `CS/capture/adapters/camera/onvif-relay.ts` | new | the adapter: order of an open, the bound, the handle, the relay's exit codes as named refusals (`CameraOpenRefusal`, `CameraOpenError`), the report source `relayReports`, `relayEnded`, `tell`, `counts()`; `pullUrl` refuses `CAPTURE_CAMERA_LOCATOR_RESOLVED_AT_OPEN` |
| `CS/capture/adapters/camera/relay-start.ts` | new | the ONE caller of `credentialAtInjection`; the start message in the relay's form; the reader of the relay's report line |
| `CS/capture/adapters/credential.ts` | modified | `credentialFreeLocator` only: the closed query rule of row 174 stands here now; a bare `?` and any `#` are refused (row 174's blocking request) |
| `CS/capture/adapters/camera/onvif-session.ts` | modified | the moved rule removed; `locatorOf` calls `credentialFreeLocator(address)` on the whole text. No read, export or bound changed |
| `CS/capture/adapters/types.ts` | modified | `CameraSourceTarget` gains two OPTIONAL members, `sessionId` and `attempt` (requests of rows 145, 179, 48) |
| `CS/capture/adapters/__tests__/static.test.ts` | modified, additive | A-2 third case: "no caller" becomes "exactly one caller, `camera/relay-start.ts`, at one line"; new rule A-9 (built production adapters named by no production source), with row 67's file |
| `CS/capture/adapters/__tests__/credential.test.ts` | modified, additive | one case: the query rule at the injection point (4 admitted forms written byte for byte into the start message, 14 refused) |
| `CS/capture-session/__tests__/ingest-address.test.ts` | modified | the closed list `READERS`: one entry, the adapter's file (row 47's request) |
| `CS/capture/adapters/camera/__tests__/onvif-relay.test.ts` | new | T-1 and T-3: 26 unit cases, doubles only |
| `CS/modules/capture-config/__tests__/camera-adapter-open.db.test.ts` | new | T-2: 10 cases with the real relay, the test camera, the real worker and a throw-away database |
| `apps/core-server/test/support/stored-camera-address.ts` | new | the permissive stored-address rule, loopback only, defined under `test/` (AD-02 (2)) |
| `apps/capture-worker/test-fixtures/row046_adapter_listener.py` | new | the listener side of T-2: one session of the release worker through the existing harness, imported read-only |

Not touched: `onvif-rtsp.ts`, `real.ts`, `registry.ts`, `index.ts`, `errors.ts`, `production-door.ts`, the capture fence files, `capture-session/index.ts`, `test/static/credentials.test.ts` (no entry was needed), anything of `apps/capture-worker/src`, the worker build.

## 3. The contract, as built

**The order of an open** (`onvif-relay.ts`, `openSource`):

| Step | What | A failure is |
|---|---|---|
| 0 | refusals before anything is asked: aborted signal; unknown device; **no profile in the target (C36: no default stands in)**; no session or attempt; no relay program; a live relay of the same device AND profile | `CAPTURE_ADAPTER_ABORTED`, `CAPTURE_DEVICE_UNKNOWN`, `CAPTURE_PROFILE_UNKNOWN`, `CAPTURE_CAMERA_SESSION_UNKNOWN`, `..._RELAY_NOT_CONFIGURED`, `..._ALREADY_OPEN` |
| 1 | `deps.stream(deviceId, profile)`: the stored facts (the camera as a candidate at its stored address, the ONVIF token of the profile code) | none stored: `CAPTURE_PROFILE_UNKNOWN`; a failed read: `..._STREAM_FACTS_NOT_READ` |
| 2 | `deps.credentials.sessionOpen(deviceId, sessionId)`, once. The reader's gate holds the stored address to the destination rule BEFORE the reveal; reveal and audit entry are one unit of the reader. The adapter opens no unit of work | `..._CREDENTIAL_NOT_READ`, reason = the reader's code |
| 3 | `deps.locator.locate(candidate, sealed, token, signal)`: one authenticated `GetStreamUri` | `..._AUTHENTICATION_REFUSED`, `..._UNREACHABLE`, `..._LOCATOR_REFUSED`, reason = the ONVIF reason |
| 4 | `startCameraRelay`: `credentialAtInjection(locator, sealed)` as the member `access` of `{"type":"start","mode":"record","ingest":...,"attempt":n,"access":{...}}`; the door starts the program with no argument and an empty environment | `CAPTURE_LOCATOR_INVALID`; `..._RELAY_NOT_STARTED`, reason = the door's code |
| 5 | the relay's line `{"report":"push_established","v":1,"attempt":n}` on standard output (row 42's form, read from its header in the tree), or the relay's end | the exit code as a named refusal (table below) |

**Bounds.** One open: `CAMERA_OPEN_BOUND_MS` 25,000. Close: the end of standard input, then `SIGKILL` after `CAMERA_RELAY_STOP_BOUND_MS` 3,000, then a wait of `CAMERA_RELAY_REAP_BOUND_MS` 2,000; a relay that is still there is `CAPTURE_CAMERA_RELAY_NOT_REAPED` and a note, and is forgotten only when it ends. Timers come from the capture timer seam; the file reads no clock.

**Exit codes of the relay** (the list of `apps/capture-worker/src/relay/relay.h`, read by a unit case that fails when a code has no word here):

| Relay | Named refusal |
|---|---|
| 20 `CAMERA_UNREACHABLE` | `CAPTURE_CAMERA_UNREACHABLE` (an absent camera, C35 a) |
| 22 `AUTH_SCHEME_NOT_ALLOWED` | `CAPTURE_CAMERA_AUTH_SCHEME_REFUSED` (S13-01) |
| 23 `AUTH_REFUSED` | `CAPTURE_CAMERA_AUTHENTICATION_REFUSED` |
| 24 `LOCATOR_NOT_FOUND` | `CAPTURE_CAMERA_LOCATOR_REFUSED` |
| 21, 25, 26, 27, 28, 29, 30, 33 | `CAPTURE_CAMERA_STREAM_REFUSED` |
| 31 `CAMERA_STALLED`, 32 `CAMERA_LOST` | `CAPTURE_CAMERA_STREAM_LOST` |
| 40 `INGEST_REFUSED` | `CAPTURE_CAMERA_INGEST_REFUSED` (the worker did not take the push: its gate, C40 (2)) |
| 41 `INGEST_LOST` | `CAPTURE_CAMERA_INGEST_LOST` |
| 0 without a close | `CAPTURE_CAMERA_RELAY_STOPPED` |
| 2, 10, 11, 12, 13, 42, 43, 70, a signal, an unknown code | `CAPTURE_CAMERA_RELAY_FAILED` |

**What it tells.** `relayReports.subscribe(listener)`: `{ sessionId, deviceId, attempt }` per established push - the shape of `RelayIngestReports` of the session unit, successes only (C34: the source the production composition must hand to the session). `relayEnded`: a relay that ends by itself after its open, once. `tell`: notes the file cannot log itself (static rule G-R4: only `capture/index.ts` logs). A refused open is a thrown error with a code; the session persists it (`CAPTURE_CAMERA_NOT_OPENED`).

**C37 at the adapter.** A report of a relay that is being ended (close, aborted signal, failed open) or of an attempt that a later open of the same session superseded is dropped, counted (`counts().droppedReports`) and noted; it never reaches the pairing. A report that names another attempt than the relay's own start message is dropped and noted.

**What is kept.** Per live relay: device, profile, session, attempt, the process. No camera address, no locator, no ingest address, no credential (unit case "the sources": the ingest address stands at ONE line, as an argument of the relay start).

## 4. Checks (this Mac, 2026-10-13; loopback only; sandbox off for ports, processes and PostgreSQL)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Unit, run 1 | `npx vitest run --project unit --maxWorkers=2 <the new unit file, both static files of the capture folder and the adapter layer, credential.test, onvif-session.test, ingest-address.test, test/static/credentials.test>` | `1 failed, 184 passed (185)`: the relay header had gained exit code 43 while row 42 was being written; the Core's table followed |
| Unit, run 2 | the same | `Test Files 7 passed (7)`, `Tests 185 passed (185)` |
| T-2, run 1 | `(ulimit -c 0; /usr/bin/lockf -k -t 1800 ../../.locks/heavy-host.lock /usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 <the T-2 file>)` | `Tests 10 passed (10)`, 25.2 s, `0 remain` |
| Static, once | `npx vitest run --project unit --maxWorkers=2 test/static src/modules/capture-config/__tests__/static.test.ts src/capture-session/__tests__ src/capture/adapters/__tests__` | `1 failed, 290 passed (291)`: rule R-6 of the capture-config module (a test that imports the credential wiring must stand in that module's test folder). The T-2 file was moved there |
| T-2, run 2 (after the move) | as run 1, `--silent=false` | `Tests 10 passed (10)`, 25.3 s |
| T-2, run 3 | as run 2 | `Tests 10 passed (10)`, 25.1 s. A third run of a green file: the close times of the 20 cycles read 0 to 1 ms, so the run was repeated with the exit code of every relay recorded and asserted (all 0: ended by the order to stop, none by itself, none killed) |
| Static again | `npx vitest run --project unit --maxWorkers=2 test/static <the three static files> <the unit file>` | `1 failed, 296 passed (297)`: `test/static/guard-family.test.ts:65`, not this row's (section 7). After two lint fixes in the unit file: `Test Files 2 passed (2)`, `Tests 47 passed (47)` |
| Typecheck | `npx tsc --noEmit -p .` | exit 0 (one error in the new T-2 file on the first call, fixed) |
| Lint | `npx oxlint <the touched files>` | 0 warnings after 2 fixes in the unit file |
| Secret scan | `node scripts/secret-scan/count-only.mjs <the new and changed files> .cache/row046-camera-adapter` | `ingest-secret: 0`; `camera-credential: 3` in two existing test files of other rows (`onvif-session.test.ts` 2, `probe-answer.test.ts` 1), 0 in this row's files and in the run folder |

**The row's verification cell.**

| Cell | Evidence |
|---|---|
| T-1 unit (order, bound, codes) passes | 26 cases: order `stream, reader, locate, door`; the start message compared byte for byte with the relay's form; refusals before anything with 0 calls; 25,000 ms at each step on a manual timer, the relay killed and the open rejecting only when it has ended; every exit code of the header mapped; close, kill at 3,000 ms, not reaped at 2,000 ms; one report of a relay that dies; C37 |
| T-2 adapter level with the real relay and the worker's harness gives a decodable file | H.264: opened in 93 ms, file `h264` 1920x1080, 105 pictures, 0 decode-error lines, worker gate refusals 0, the control recorded, 0 leftovers. HEVC: opened in 48 ms, file `hevc` 1920x1080, 100 pictures, 0 decode-error lines, gate refusals 0 (run 3; runs 1 and 2: 105 / 98 to 100 pictures) |
| T-3 the adapter handed to a real registry is refused `CAPTURE_ADAPTER_INVALID` | refused in `REAL_PRODUCTION` and in `REAL_DEVELOPMENT`, nothing registered (`list()`, `openerKinds()`, `cameraAdapters()` empty); `SIMULATED`: `CAPTURE_ADAPTER_KIND_NOT_ALLOWED` |

**The delegation's list.**

| Asked | Evidence (T-2 unless said) |
|---|---|
| video reaches the listener at the session's address, H.264 and HEVC | above; the worker's `ingest_connected` for camera 1: 1 per run |
| the audit entry of the reveal exists | 1 entry per open, `session_id` = the session, details exactly `deviceId` and `reason: SESSION_OPEN`; 20 entries for 20 cycles; requests to the ONVIF double that carried the credential: 1 `GetStreamUri` per open |
| no credential, locator or address element in any log line, error, argv or env | 61 texts of the run (account, secret, locators, stream path, 28 ingest addresses and their last elements) searched: log sink 0, persistent error log 0, audit trail 0, thrown errors 0, reports/ends/notes 0; `ps -o args=` of the relay: 1 word, 0 occurrences; `ps eww` (arguments and environment): 0; the worker's log: 0 elements of the ingest paths; count-only scan of the run folder: 0 |
| wrong password: the named refusal, nothing pushed | at the ONVIF read: `CAPTURE_CAMERA_AUTHENTICATION_REFUSED`, 0 relays, 1 request with the credential, final; at the camera through the relay: the same code with reason `AUTH_REFUSED`, the camera counted `auth_digest_refused` 1, the listener saw 0 connections |
| a Basic-only camera: refused, `auth_basic` 0 | `CAPTURE_CAMERA_AUTH_SCHEME_REFUSED` (reason `AUTH_SCHEME_NOT_ALLOWED`); the camera's counters: `requests` 1, `auth_none` 1, no `auth_basic`; 0 connections at the listener |
| a stored loopback or public address: refused before any reveal | with the PRODUCT'S rule: `127.0.0.1:8557`, `8.8.8.8`, the host's own `192.168.50.1` and link-local `169.254.10.20:80` each `CAPTURE_CAMERA_CREDENTIAL_NOT_READ` / `CAPTURE_CREDENTIAL_ADDRESS_REFUSED` with 0 reveal entries, 0 requests, 0 relays; control: an address of the camera subnet is admitted (1 reveal) |
| no profile: refused | `CAPTURE_PROFILE_UNKNOWN` with 0 reveals, 0 requests, 0 relays (also for a profile the device has no stream of) |
| `close()` ends the relay; no process left after 20 cycles | 20 relays, 20 different process IDs, each gone after its close, exit code 0 each, close 0 to 1 ms against the sink (12 to 36 ms toward the real worker, over runs 2 and 3), 20 `ANNOUNCE` lines byte-identical to the session's address, 1.9 MB of pictures at the listener; in the whole file 26 relays started, 0 alive |
| a relay that dies: the handle reports it once | the listener cut under the push: ONE `relayEnded`, `CAPTURE_CAMERA_INGEST_LOST`; the close after it adds none |
| the read is outside any unit of work (a test that fails if moved inside) | an open called from inside `app.pipeline.run`: refused, reason `CAPTURE_CREDENTIAL_REVEAL_FAILED`, 0 reveals, 0 relays, error-log cause `PIPELINE_REENTRANT`; the same open outside comes up. Static half: neither source file names a pipeline, a unit or a commit |

## 5. Doubles, and why the listener has two forms

- Camera: `apps/capture-worker/test-fixtures/rtsp_test_camera.py` on 8565 (H.264, HEVC, `--challenge basic`), its synthetic account read from its file.
- ONVIF: the scripted device `test/support/onvif-odd-device.ts` on 8557, because its `GetStreamUri` answer is the test's to write (it names the test camera). The fake ONVIF stub with `profileSet` answers its own RTSP responder, which is no camera; it is not used by this row. The locator read against that stub is proven by rows 26 and 174.
- Listener (a): the REAL release worker, one session per codec, through its own harness (`row046_adapter_listener.py` over `e11_listener_path.py`), ports 8559 and 8561, with the harness' FFmpeg pusher as the control on camera 2. It proves the decodable file and that the worker's announce gate takes the relay's push.
- Listener (b): a small RTSP sink of the test file on 8563 that answers the push handshake with success. Used where a listener is needed many times or at a chosen moment (20 cycles, a cut push, a listener that must stay untouched): a worker session listens once and for 12 s, 20 of them would hold the heavy-host lock for minutes.
- Reader: the real wiring on a throw-away clone of the seed. For the loopback doubles the stored-address rule is the test value under `test/support`; for the refusal cases it is `decideDestination` itself.
- The stored stream facts (`stream`) are a function of the test: the composition that reads `capture_device_streams` is row 85.
- Ingest address: the harness builds the worker's; the sink's is built by the test in the form of `capture/ingest-address.ts` on the sink's port (the product's ports 8554 and 8556 belong to the emulators here).

## 6. Unproven without hardware, and the check that proves it

| What | Check |
|---|---|
| A real camera's `GetStreamUri` answer (its query form, a host name instead of an address, a plain-number token) through `locate` and the relay's locator rule (IPv4 in digits only) | `9A/H-10`, `9A/H-17` |
| The relay's own RTSP client against a real camera's Digest variant, description and packet forms (candidate (a), decisions C38 and C39: the user has not ruled) | `9A/H-10`, `H-11`, `H-12`, `H-23` |
| The time from the start to "push established" against the 25,000 ms bound and the 30,000 ms window; a camera absent at the start | `9A/H-21`, `9A/H-22` |
| The pairing of the relay's report with the worker's connect report inside 5,000 ms on the real host | `9A/H-17` |
| Linux: the door's core-file limit check and the relay's own hygiene in the process table | `9A/H-01`, `9A/H-24`; container rows 79 and 141 |
| A real relay stopped AT the 25 s bound and one left by an aborted open, counted as survivors (here: the door double on a manual timer, and 26 real relays ended by close) | row 44 (E-12 with E-7's count) |
| The relay's reconnect inside a session and its second reveal (`relayRestart`) | row 43; `9A/H-12` |

## 7. Left to named rows; requests

| Left | Row |
|---|---|
| `capture-session/index.ts` fills `sessionId` and `attempt` at its one target line (until then the built adapter refuses `CAPTURE_CAMERA_SESSION_UNKNOWN`) | the session file's writer; request filed |
| The composition: the door, `captureRelayPath`, the readers' wiring, `stream` from `capture_device_streams`, `relayReports` handed to the session (C34), `relayEnded`, `tell` | rows 85, 88; request filed |
| The destination rule applied by the ADAPTER on the candidate it dials, and at presence reads; the five refused classes as a gate; "no permissive value under `src/`" | row 143 |
| Presence, clock offset, the loss callback behind `relayEnded` | row 49 |
| `testConnection`, the codec read from the stream, the lock-out guard counting a refused stream authentication (S13-04 (d)) | row 50 (the relay's probe line exists since row 42) |
| The session's half of C37 (a superseded report that does reach the pairing) and of C40 (2) (one notice, not two) | the relay-report wiring, rows 43 / 44 with the session file's writer |
| E-12 over the relay's own output streams in three failure runs | row 44 |
| `sourceFacts` on `AudioInputAdapter` (row 71's request on `types.ts`) | not served: integration pass (answer filed) |

Requests filed in `delegation_progress/file_requests.md`: 3 of row 46 (the relay's interface, updated to "row 42's form adopted"; the session's target line; the composition), 1 answer to rows 67 and 71, 1 red of another owner: `apps/core-server/test/static/guard-family.test.ts:65` expects the old tag list of `apps/capture-worker/check.sh` (likely agent W, row 142).

Static-list requests of row 67: SERVED (rule A-9 holds `audio/usb-audio-production`); `test/static/credentials.test.ts`: no entry asked, none made.

## 8. DRIVER DECISIONS for the controller to confirm

1. **Files outside the profile's Ownership Area line, taken because the controller routed them to row 46** (`file_ownership.md`: row 174 "carried as a requirement of row 46"; `CameraSourceTarget.attempt` "-> row 46"; row 47's `READERS`): `credential.ts` (one function), `onvif-session.ts` (the moved rule), `types.ts` (one interface), `ingest-address.test.ts` (one list entry).
2. **`sessionId` beside `attempt` on `CameraSourceTarget`**, both optional: the reader's `sessionOpen` requires the session (row 145) and the report names it. The adapter refuses an open without them.
3. **An open resolves at the relay's `push_established` line**, not when the start message was taken: a wrong password or a refused push is then a refusal of the open, and the report reaches the pairing before the open resolves.
4. **`stream` hands the adapter a `CameraCandidate`**: the adapter composes no address. Who forms the service address of an adopted camera from the stored `host[:port]` is open (row 85 or 50).
5. **`CameraOpenError` with its closed code list lives in the adapter file**; `errors.ts` was not edited. `reason` carries the code word of the unit underneath and nothing else.
6. **3,000 ms to stop, 2,000 ms to be reaped**; a relay not reaped is a named failure of the close.
7. **A signal aborted AFTER the open closes the source by its order to stop** (kill at the bound), so the last pictures are not cut; aborted DURING the open it is an immediate kill.
8. **C37 as built**: superseded = the source is being ended, or a later attempt of the same session was opened by this adapter. A second report of a live relay is handed on unchanged (the pairing judges it: `RELAY_REPORTED_TWICE`).
9. **`discover`, `testConnection`, `profiles`, `ntpOffsetMs` refuse as class C in this file**: the row's cells give it `openSource` and `pullUrl` only.
10. **Rule A-9 is a NEW static rule**, not one of SR-1 to SR-4: additive and stricter (it admits nothing). A-2's third case changed as row 45 announced.
11. **The T-2 file stands in `modules/capture-config/__tests__/`** (rule R-6), not beside the adapter.
12. **A refused credential at an open is not counted by the lock-out guard here** and nothing is retried: one refused request per open.
13. **The reader's gate and the adapter's candidate read the stored address separately**; the adapter-side rule on the candidate is row 143.
14. **The Core always states `attempt` in the start message**; the relay's `attempt: 0` ("none stated") is refused as a report, and an attempt above the relay's bound is refused before anything is started.
15. **The report reader's line bound is 512 bytes** (record mode); a probe line is no report of a record-mode relay and is counted and dropped.
16. **Three runs of the green T-2 file** (rows above): the second after the move, the third to check a measurement.

The Edit-only rule was kept: every existing file was changed with the Edit tool after reading it; new files were written once and then edited; one new file of this row was moved by `mv` before it had ever been committed. Nothing was committed, staged or stashed.

---
*Generated: 2026-10-13*
