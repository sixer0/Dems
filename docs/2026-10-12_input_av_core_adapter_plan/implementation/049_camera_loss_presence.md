---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 49
milestone: M3 / WP-06c
date: 2026-10-13
agent: coder-execution (batch 8, agent SC)
tier: T3
requirement: WP-06c of design addendum 8.1; static rules G-R2 and G-R10 kept (addendum 8.3; plan review, WP-06 verdict); rulings C35, C40
status: needs-review - the watch is built and proven on doubles; its production time reader does not exist (one request, blocking for presence and clock in row 85)
---

# Row 49: camera loss, presence and clock offset

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server/src`.

## 1. Statement

A production camera has a watch: `createCameraWatch(dependencies)` in `CS/capture/adapters/camera/camera-watch.ts`.

- **Loss.** A relay that ends by itself after its open (the adapter's `relayEnded`, row 46) raises ONE fault per camera through a sink handed in; the next established push of that camera clears it. The fault is the worker's own key for the same event, `CAPTURE_FAULT` / `CAMERA_STREAM_ENDED` / the camera's id, so the engine holds one fault whoever says it first (C40).
- **Presence.** A watched camera is asked the ONVIF time every 3,000 ms without a credential. Two reads in a row without an answer make it `ABSENT`, told once; the first answer after that makes it `PRESENT`, told once. `check` is one read for the pre-check.
- **Clock offset.** `clockOffsetMs`: the camera's clock minus the Core's, whole milliseconds, from one read, the Core's instant taken at the middle of the read. The adapter's `ntpOffsetMs` is this function when the composition hands it in (`clock`); without it the member refuses as class C, as before.

The watch is **registered nowhere**, as the adapter is. It opens no socket and imports no module of the host, no ONVIF package and no credential type.

**What is not built.** The watch asks through a seam, `CameraTimeReader`. The value of that seam in production must be a facade of `CS/capture/adapters/camera/onvif-session.ts`, the one importer of the ONVIF package; neither facade of today hands the clock value out, and that file belongs to another agent in this batch. So presence and the clock offset are proven against a scripted reader and cannot run against a device until the facade lands (request in section 6). Presence by TCP, ping or a stream port was not built: static rules G-R2 and G-R10 leave it no place.

## 2. Change set

| File | State | What |
|---|---|---|
| `CS/capture/adapters/camera/camera-watch.ts` | new | the watch: `relayEnded`, `pushEstablished`, `watch`, `unwatch`, `presence`, `lost`, `check`, `clockOffsetMs`, `close`; constants `CAMERA_PRESENCE_INTERVAL_MS` 3,000, `CAMERA_PRESENCE_FAILURES` 2, `CAMERA_TIME_READ_BOUND_MS` 2,000, `CAMERA_CLOCK_BOUND_MS` 2,000; `CameraClockError` with three codes |
| `CS/capture/adapters/camera/onvif-relay.ts` | modified, additive | one optional dependency `clock`; `ntpOffsetMs` calls it for a served camera (unknown device: `CAPTURE_DEVICE_UNKNOWN`); one comment line |
| `CS/capture/adapters/camera/__tests__/camera-watch.test.ts` | new | 16 cases |
| `CS/capture/adapters/camera/__tests__/onvif-relay.test.ts` | modified, additive | 2 cases (the adapter wired to the watch; `ntpOffsetMs`), 1 import line |

Not touched: `onvif-session.ts`, `relay-start.ts`, `onvif-rtsp.ts`, `adapters/types.ts`, `errors.ts`, every static-rule list (no entry was needed: both static files pass with the new file in the tree), `packages/shared`.

## 3. The contract, as built

| Member | What it does | Refusals |
|---|---|---|
| `relayEnded({ deviceId, code })` | first lost stream of a camera: `faults.raise(...)` once, `onChange({ event: STREAM_LOST, cause })`; a further lost stream of the same camera is counted only | none; a sink or observer that throws is reported |
| `pushEstablished({ deviceId })` | when every lost stream of the camera has a push again: `faults.clear(...)` once, `onChange(STREAM_RETURNED)`; a camera that was not lost: nothing | none |
| `watch` / `unwatch` / `close` | the heartbeat; reads of one camera never overlap; a running read is cut | none |
| `presence(deviceId)` | `UNKNOWN`, `PRESENT`, `ABSENT` | - |
| `check(deviceId, signal)` | `{ present, clockOffsetMs, clockWithinBound }` from one read; touches no state | `CAPTURE_ADAPTER_ABORTED`, `CAPTURE_DEVICE_UNKNOWN`, `CAPTURE_CAMERA_CLOCK_ADDRESS_NOT_READ` |
| `clockOffsetMs(deviceId)` | the offset | `CAPTURE_CAMERA_CLOCK_NOT_ANSWERED`, `..._NOT_STATED`, `..._ADDRESS_NOT_READ`, `CAPTURE_DEVICE_UNKNOWN` |

Not an absence, reported by a code and counted as nothing: a stored address that cannot be read (`CAMERA_WATCH_CANDIDATE_NOT_READ`), a reader that refuses before it asks (`CAMERA_WATCH_READ_REFUSED`). A device that answers and is no ONVIF device counts as no answer.

"Audit writers for camera loss and camera unreachable": the audit entry of a loss is the engine's `FAULT_RAISED` / `FAULT_CLEARED` row behind the sink (`raiseCaptureWarning`, `clearCaptureWarning`); the file writes no row and the capture folder logs in one place (G-R4). For "unreachable" see driver decision 1.

## 4. Checks (this Mac, 2026-10-13; no process, no port, no database)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Unit and static, one run | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/camera/__tests__/camera-watch.test.ts src/capture/adapters/camera/__tests__/onvif-relay.test.ts src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts` | `Test Files 1 failed | 3 passed (4)`, `Tests 1 failed | 120 passed (121)` |
| The one red | `onvif-relay.test.ts`, case "the sources ...", the pin of the lines of `relay-start.ts` that name `ingest` | not this row's: `relay-start.ts` gained a probe mode from another agent while this row ran (section 6). Not edited, not re-run |
| The two files of this row again, at the end of the batch (09:30 WIB) | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/camera/__tests__/onvif-relay.test.ts src/capture/adapters/camera/__tests__/camera-watch.test.ts` | `Test Files 2 passed (2)`, `Tests 44 passed (44)`: the pin of `relay-start.ts` was moved by its owner meanwhile. A second run of a file that had been red, not edited by this row in between |
| Typecheck, at the end of the batch | `npx tsc --noEmit -p .` | exit 0 |
| Typecheck, first run | `npx tsc --noEmit -p .` | exit 2 with ONE error, `src/engine/host.ts(770,7)` TS2345 (`registerCaptureMicrophone` missing: the in-flight engine row of agent G). 0 errors in this row's files |

The row's verification cell:

| Cell | Evidence |
|---|---|
| a killed fixture raises 1 fault and clears 1 | `onvif-relay.test.ts` "row 49: a killed fixture ...": the adapter wired to the watch as row 85 will wire it; the relay double ends with exit code 32 (`CAMERA_LOST`): 1 raise with the key above, 0 clears; a refused re-open (exit 20) clears nothing; the next established open: 1 clear; a source the session closes: nothing more. Presence, the same cell by the heartbeat: `camera-watch.test.ts` "one read every 3000 ms ...": 1 `UNREACHABLE` after two silent reads, 1 `REACHABLE` at the first answer |
| reveal entries for presence: 0 | by construction: the file's imports are exactly `@dems/capture-protocol`, `../../types`, `../errors`, `../types`; no word of a credential stands in its code (case "reveal entries for presence: 0 by construction"); `ntpOffsetMs` through the adapter makes 0 reader calls, 0 locator reads, 0 processes |
| no socket module is imported under the capture folder | `src/capture/__tests__/static.test.ts` passes unchanged (G-R2 "no file of the folder opens a socket", G-R9, G-R10 / G-R11) with the new file in the tree |

## 5. Doubles, and what stays unproven

The "fixture" is the door double of row 46's unit file (a relay whose end the test writes) and a scripted time reader. No real relay, test camera or device was started by this row.

| Unproven | Where it closes |
|---|---|
| The time read against any ONVIF device, double or real (the facade does not exist) | the request of section 6, then row 85's tests against the fake ONVIF stub |
| A real camera's answer to an unauthenticated `GetSystemDateAndTime` (whether it answers without a login, and what instant it names: a hypothesis until a device is asked) and the 2,000 ms bound of one read | `9A/H-09` (clock offset), `9A/H-10` |
| A real relay ending on a pulled camera, through to the engine's fault and its audit rows | row 46's T-2 showed `relayEnded` once with a real relay; the engine half is row 85 with rows 43 and 44; `9A/H-11` ("the fault is raised and cleared") |
| The camera's wall clock inside 2,000 ms on the bench | `9A/H-09` |

## 6. Requests filed (`delegation_progress/file_requests.md`)

1. **Blocking for row 85's presence and clock wiring**: the facade `createOnvifTimeReader` in `onvif-session.ts` (one unauthenticated `GetSystemDateAndTime`, the value handed out as milliseconds) with the one pin of the static list that moves (the export list, two names).
2. Row 85: the wiring, and one open point - the forwarder's own table of the worker's faults does not learn a clear that goes to the engine directly.
3. A red of another owner: `onvif-relay.test.ts`, the `ingest` pin of `relay-start.ts` (likely agent T2, row 50).

Left to named rows: the destination rule in front of `candidate` at every presence read (row 143); the stream-level connection test (row 50); the relay's reconnect, after which a returned push exists inside one session (row 43).

## 7. DRIVER DECISIONS for the controller to confirm

1. **Presence raises no fault.** An absent camera is told by `onChange`, `presence` and `check` only. Reasons: C35 and C40 give the absent camera of a start ONE notice, the session's; the shared wording has no reason for "unreachable outside a session"; row 19's ten audit types hold none for it. If a fault is wanted it needs a reason word and its sentence in `packages/shared` first.
2. **A loss is cleared by the next established push of that camera**, not by the end of the session. The forwarder's rule R-4 (every capture fault cleared when a new session records) covers a camera that never returns.
3. **Any end of a relay by itself is a loss** of that camera, whatever its code (the camera stalled, the worker went away, the relay failed): the camera is no longer recorded. The code travels as `cause` of the change, not in the fault.
4. **One fault per camera**, although a camera may fill two tracks with two profiles: the fault key has no profile. It is cleared when as many pushes returned as streams were lost.
5. **3,000 ms / 2 failures / 2,000 ms per read** are the values of the tested scheme (`research/01_explore_input_av.md` H-26 and the direct ONVIF check).
6. **The time reader is a seam and no interim reader was built** over the existing connection test with no credential: it would send up to three unauthenticated requests per beat, two of them to operations a camera keeps behind authentication.
7. **`check` and `clockOffsetMs` do not feed the heartbeat's state.**
8. **A sink that refuses is reported and not asked again.**

The Edit-only rule was kept: the two existing files were changed with the Edit tool after reading them; the two new files were written with Write and then edited. Nothing was committed, staged or stashed.

---
*Generated: 2026-10-13*
