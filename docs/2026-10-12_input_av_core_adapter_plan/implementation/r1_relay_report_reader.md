---
task_id: 2026-10-12_input_av_core_adapter_plan
row: R1 (finding F3-01 of verification/060_m3_review.md)
date: 2026-10-13
agent: coder-execution (agent R1, track D)
tier: T3
builds_on: implementation/043 (the relay's two lines), 046 (the adapter and its reader), 048 / 188 (pairing; C34, C35, C37), 049 / 085c (camera watch; the watch fault sink, C60 (2)), 182 (C40), 191 / 191b (the audio gap as a fact of the evidence: the model)
status: complete on this Mac's doubles; the Core now reads both lines and raises at once. Five driver decisions to confirm (section 8); one request for the contract members a video absence still lacks (section 6)
---

# Row R1: the Core reads the relay's `camera_lost` and `camera_reopened`

Paths are relative to `/Users/gsp-budi/Documents/DEMS`; `CS` = `apps/core-server/src`. No C was changed and nothing under `apps/capture-worker` was built: the relay binary is the one of 13:39 today. No real camera, no credential; loopback only.

## 1. The finding, and the result

| | Before | After |
|---|---|---|
| The relay's `camera_lost` / `camera_reopened` (row 43) at the Core | counted as unknown lines and dropped (`relay-start.ts`, one form known) | two more fixed forms, read with the strictness of the established line |
| A camera lost inside a session and back again | NOTHING at the Core: no fault, no row, no log entry - ever | the fault of THAT camera raised by the relay's first line, cleared by its re-open line |
| A camera lost inside a session that stays away | the first word was the relay's end: 62.14 s after the loss line (`implementation/043` section 5; six waits = 62 s) | the fault at the first line; the relay's later end adds no second fault |
| **Measured, camera's loss to the Core's fault** | stated: never (camera back) / 62.14 s (camera away) | **1 ms to the line read by the Core, 25 ms to the fault active on the engine** (polled every 10 ms; section 5) |

## 2. What was built

| File | Change |
|---|---|
| `CS/capture/adapters/camera/relay-start.ts` | THE READER (it stands in this file, not in `onvif-relay.ts` as the brief says): `RelayReportKind.CAMERA_LOST` / `CAMERA_REOPENED`; `RelayReport` is a union of three; two anchored patterns in the relay's own member order and number form; `reportOf`; constants `RELAY_LOSS_CAUSES` (20, 23, 31, 32), `RELAY_RETRY_TRIES` (6), `RELAY_COUNT_MAX`. Line bound, split-chunk joining, overflow drop and `rejected()` are unchanged |
| `CS/capture/adapters/camera/onvif-relay.ts` | `CameraLegReport`; `CameraRelayReport.leg?`; `inForce` (the C37 half of `reported`, now for every line), `hand`, `legReported` (order rules); three members of `Slot` (`established`, `lastLoss`, `lossOpen`); `counts().outOfOrderReports`; note code `CAPTURE_RELAY_REPORT_OUT_OF_ORDER` |
| `CS/capture/adapters/camera/camera-watch.ts` | only where the reports feed it: `pushEstablished` reads the member `leg` first (LOST: raise; REOPENED: clear its own raise); `lostLegs` beside `lostStreams`; `relayEnded` reads `end.profile` (a told loss ends with its relay: no second fault); `lost()` is the union |
| `CS/capture-session/ingest-pairing.ts` | the INTERFACE only: `RelayIngestReport.leg?` and `RelayCameraLeg`. No statement of the pairing changed |
| `CS/capture-session/index.ts` | the one call site: a report with `leg` goes to `cameraLegSaid`, never to `relayReported`; `cameraLegSaid`, `cameraOpenAgain`; the close of an open absence in `release`; two members of `Live`; one header paragraph |
| Tests EXTENDED | `camera/__tests__/onvif-relay.test.ts` (+7 cases; 4 existing pins moved by consequence, section 7), `camera/__tests__/camera-watch.test.ts` (+5), `capture-session/__tests__/ingest-pairing.test.ts` (+3), `capture-session/__tests__/session-capture.db.test.ts` (+2; the `relays()` helper gained `leg`), `modules/capture-config/__tests__/camera-adapter-open.db.test.ts` (+1 scenario; `adapterWith`, two imports, one constant) |

## 3. The rules, as built

**The reader** (form of one line). `{"report":"camera_lost","v":1,"attempt":<1..999999999>,"loss":<1..999999999>,"cause":<20|23|31|32>}` and `{"report":"camera_reopened","v":1,"attempt":..,"loss":..,"tries":<1..6>,"held_back":<0..999999999>,"gap_ms":<0..999999999>}`: closed member set in the relay's order, version 1, no sign, no leading zero, at most 9 digits, 512-byte line bound. Anything else is counted and dropped as before - also a word the Core does not know (`camera_gone`) and the marks of the relay's standard error.

**The adapter** (whose word, and in which order).

| Arrives | Outcome |
|---|---|
| any line of a relay that is being ended, of an attempt a later open superseded, or naming another attempt than the relay's own | dropped, counted (`droppedReports`), noted - C37, exactly as for the established line |
| `camera_lost` before the push is established | dropped, `outOfOrderReports`, noted (no loss inside a session) |
| `camera_lost` with the next number, none open | told at once: `{ sessionId, deviceId, attempt, leg: { event: 'LOST', profile, loss, cause } }`, cause = the relay's exit word |
| `camera_lost` with a number said already | dropped, noted |
| `camera_lost` with a HIGHER number while one is open, or skipping a number | taken as the open loss and noted; told only if no absence was open (nothing told twice) |
| `camera_reopened` of the loss that is open | told: `leg: { event: 'REOPENED', profile, loss, tries, heldBack, gapMs }` |
| `camera_reopened` of anything else | dropped, noted - the loss that was told stays told |

Each doubt is settled toward the fault standing. Both leg reports travel on the EXISTING source `relayReports`, marked by the member `leg` (driver decision 1).

**The watch.** A camera is lost while it has an ended relay with no push since (row 49) OR a stream whose leg a live relay said it lost: ONE fault for both (`CAPTURE_FAULT` / `CAMERA_STREAM_ENDED` about the camera - the worker's own key, C40). It clears only its own raise (C60 (2), `raisedHere` and the sink's `owned`), and only for the stream AND relay (session, attempt) whose loss it was told. A relay closed with its loss open is ended by the established push of a LATER relay of that camera, not by one of the same worker.

**The session.** `cameraLegSaid` drops what is of another session, of a device outside the plan, of an attempt not in force (one info line each, first 8), or not of the form. It writes NO fault and ends NOTHING.

**The pairing: unchanged.** Proven three ways: the pure unit holds an open camera through 182 s without a report; the control (a re-open told as a second relay report or seen as a second connect) is still `RELAY_REPORTED_TWICE` / `WORKER_CONNECTED_TWICE`; a source pin: the session calls `relayReported` at ONE line, in the `else` of `report.leg !== undefined`. The worker's side of a re-open was run for real (section 5): `ingest_connected` 1, gate refusals 0.

## 4. What the session's record states about the absence

Read first: the session stores no interval for a camera (`session_audio_intervals` is audio only; `facts.ts` holds `cameras[].ended` for a camera GIVEN UP, C3); the manifest lists an absent camera as "the track the manifest does not list" (README, sealed packages) and has no member for a gap inside a track.

| Form that exists | What it states now | Signed? |
|---|---|---|
| Audit row `FAULT_RAISED` (`CAPTURE_FAULT`, reason `CAMERA_STREAM_ENDED`, `device_id` the camera) | the earlier bound: its `at` | no (audit extract, known limit 7) |
| Audit row `FAULT_CLEARED` (same kind and reason; the camera in `details.target`, device column null) | the later bound: its `at`. Measured: 3,048 ms between the two rows, equal to the relay's own `gap_ms` 3,048 | no |
| Error log `CAPTURE_CAMERA_ABSENT_IN_SESSION` (warn) | session, camera, profile, attempt, the relay's loss number, cause, `lostAt` | not in the package |
| Error log `CAPTURE_CAMERA_BACK_IN_SESSION` (warn) | the same and `backAt`, `absentMs`, the relay's `relayGapMs`, `heldBack`, `tries`; `laterAttempt` when a later worker's pairing ended it | not in the package |
| Error log `CAPTURE_CAMERA_ABSENT_AT_END` (warn) | an absence open at the end of the capture: `lostAt`, `endedAt`, `absentAtLeastMs` | not in the package |
| The operator | ONE critical notice per absence, resolved at the re-open | - |

**NOT YET STATED** (request filed, section 6): no audit type holds the bounds in ms; no member of the signed manifest says that a listed track has a gap, or how long; the facts file has no member for it; the notice's sentence "Its recording ended there" is untrue while the relay is re-opening.

## 5. Checks (this Mac, 2026-10-13; sandbox off for ports, processes, PostgreSQL)

| Check | Command (in `apps/core-server` unless said) | Result line |
|---|---|---|
| Reader, adapter, watch, session units, composition, log calls (after the last source edit) | `npx vitest run --project unit --maxWorkers=2 <the two camera test files> src/capture-session/__tests__ src/__tests__/capture-composition.test.ts test/static/log-calls.test.ts` | `Test Files 7 passed (7)`, `Tests 201 passed (201)`. Run 1 of the two camera files: `2 failed, 77 passed` - two existing pins (`Slot` text, a `counts()` literal), moved |
| Session database suite | repository root: `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && npx vitest run --project db --maxWorkers=2 src/capture-session/__tests__/session-capture.db.test.ts'` | run 1 `1 failed, 94 passed (95)`: MY new case read the wall clock where the rig has a manual one; run 2 `Tests 95 passed (95)`; run 3 (after two lint edits of the session file and one more case) `Tests 96 passed (96)`, `0 remain` |
| THE SCENARIO, with the whole T-2 file | `(ulimit -c 0; lockf db-migrate.lock ... camera-adapter-open.db.test.ts)`; the file takes the heavy-host lock itself, per case | run 1 `1 failed, 11 passed (12)`: the 11 existing cases green; MINE failed on an assertion (the clear row's device column is null) |
| The scenario alone | the same with `-t "finding F3-01"` | run 2 failed in my measure line (the camera's dropped stream counts 70 pictures, not 60); **run 3 `Tests 1 passed, 11 skipped (12)`** - a third run, the failure was in my own new test both times |
| Static set | `npx vitest run --project unit --maxWorkers=2 test/static <capture-config static> <adapters static> <capture static> capture-composition.test.ts real.test.ts` | `1 failed, 399 passed (400)`: `src/capture/__tests__/static.test.ts:646`, NOT mine (row B1's `./onvif-reply-guard`) |
| Typecheck | `npx tsc --noEmit -p .` | 0 errors in this row's files; 7 errors in `src/capture/boot/__tests__/checks.test.ts` and `program-checks.test.ts` (boot rows in flight) |
| Lint | `npx oxlint <the 10 touched files>` | 3 warnings in my code, fixed; 0 after |

**The scenario's line** (real relay, test camera `--drop-after-frames 60 --drop-count 1 --drop-style fin --first-keyframe-delay-ms 400 --first-keyframe-fill inter`, real worker through `row046_adapter_listener.py`, the watch, `watchFaultSinkOf` on the real engine, PostgreSQL):

```
[r1 F3-01] camera ended the stream (fault_drop, in mid group) -> the relay's loss line read by the Core: 1 ms;
-> the fault active on the engine: 25 ms (polled every 10 ms); raise asked 0 ms after the line;
absence: FAULT_RAISED to FAULT_CLEARED 3048 ms on the audit rows, the relay's own gap 3048 ms, held back 25;
cleared 11 ms after the re-open line;
worker {"ingest_connected":1,"gate_refusals":0,"file_frames":86,"decode_error_lines":0}
```

Asserted in it: told in order `ESTABLISHED, LOST, REOPENED`; one raise and one clear asked; the relay alive at the fault and after the re-open, 0 `relayEnded`, exit 0 at the close (the capture's source was NOT ended); `droppedReports` 0, `outOfOrderReports` 0; two audit rows in order; the worker's result above with `control_recorded: true`, `leftovers: 0`. Load average during the run: 11.5 to 12.9.

Not re-run after the last edit: the scenario was run before a one-line lint edit of `camera-watch.ts` (`dropLegs` walks the map without a copy); the 201 unit cases ran after it.

## 6. Requests (three lines in `delegation_progress/file_requests.md`)

1. To the single writer of `packages/shared` / `packages/capture-protocol`: audit type `CAPTURE_VIDEO_ABSENT_IN_SESSION` with its closed details; a signed, optional manifest member `tracks[].absentInSession[]` with the verifier's acceptance and the facts-file member; a warning reason for an absence that can end, with wording and its `WATCH_FAULT_SUBJECT` entry; one README known limit until then. Not blocking; before M6.
2. To row 88 and the composition's writer - information: nothing new is wired; three conditions (the hub hands the report object on unchanged; `relayEnded` hands the whole end; a further listener reads `leg` first) and one composition test asked.
3. Reds seen that are not this row's.

## 7. Existing result lines changed, each the direct consequence

| Where | Change |
|---|---|
| `onvif-relay.test.ts`, three `counts()` literals | gain `outOfOrderReports: 0` |
| `onvif-relay.test.ts`, the pinned text of `interface Slot` | gains the three members (a flag and two numbers; still no address) |

## 8. DRIVER DECISIONS for the controller

1. **The two leg reports travel on the existing source `relayReports`, marked by `leg`** - not on new callbacks. Reason: the only path from the adapter to the session and the watch is the composition's hub, which is not this row's file; with new callbacks the finding would stay open in the product until another row wired them, silently. The risk taken instead is loud: a listener that ignores `leg` would count a second relay report and end the capture. Both listeners read `leg` first; pinned by tests.
2. **The fault is the existing `CAMERA_STREAM_ENDED` of that camera** (critical): one key with the worker's and the watch's word, so one notice (C40). Its sentence is imprecise for an absence that ends (request 1 (3)).
3. **A doubt about order is settled toward the fault**: a higher loss number is taken, a re-open that matches nothing is dropped.
4. **The session writes the absence to the persistent error log, level warn, and writes no audit row of its own**: no type exists, and none was added.
5. **`relay-start.ts` was edited** (the reader lives there); claimed in the first line.

## 9. Unproven here

| What | Where it goes |
|---|---|
| A real camera's loss and return (a stall instead of a close, a reboot longer than one try) | `9A/H-10` to `H-12`, `H-21` to `H-23` |
| The camera that stays away through the session suite with a real relay (62 s): unit-level only here (the relay's end after a told loss adds no fault) | row 141 / the hardware package |
| The composed product: the lift is row 88; the watch is attached nowhere yet | row 88, with request 2 |
| The seal of a session with a video gap (what `tracks[].durationMs` says) | request 1 (2) |
| Two streams of one camera with one leg lost, on a real relay | unit only |
| Linux | everything |

## 10. Rules kept

Edit tool only for every existing file (5 source files, 5 test files, `file_claims.md`, `file_requests.md`); new files with Write (this record, `row_r1.md`). Nothing committed, staged, stashed or reverted; no full suite. `db-migrate.lock` taken before the heavy-host lock; the heavy-host lock held by the test file per case only. Worker listeners 8559 / 8561, test camera 8565, ONVIF double 8557, loopback only; throw-away databases, `0 remain`. Not touched: `packages/shared`, `packages/capture-protocol`, `capture-composition.ts`, the fence, the static lists, boot, the helper table, anything under `apps/capture-worker`.

---
*Generated: 2026-10-13*
