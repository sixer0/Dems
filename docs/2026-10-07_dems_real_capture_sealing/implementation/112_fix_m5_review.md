---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: fix_m5_review
date: 2026-10-10
agent: coder-execution
source_review: gateway_check/18_m5_code_review.md (row 74) + R63-03 of gateway_check/16_m3_code_review.md (D179) + F-M6's request (D180)
status: complete — needs-review on the items marked below
---

# 112 — Fix pass F-M5 (code review row 74, milestone M5)

Tree: `abf742f` + the working tree of the wave. No commit, no migration (schema 6 / `dbc-7`), no
OpenAPI change (no contract text changed). Every check below was run ONCE unless a line says why it
was run again.

## 1. Findings

| Finding | Reproduced? | Fix | Test | Status |
|---|---|---|---|---|
| **R74-01** MAJOR | Yes — `packages/shared/test/sim-m5-review.test.ts` red on `abf742f` (one alert, one row) | D84 R-3 INSIDE the shared failed start: a capture-wide fault that began before this session's `startedAt` is another session's and is ended first (`endStaleCaptureFault`, `packages/shared/src/sim/capture-session.ts`). R-4 stays "ended by the next start" (the rule the Core's engine has and `sim-capture-start.test.ts:215` pins); the fault is NOT cleared with the closed session — see decision 1 | `sim-m5-review.test.ts` (3 cases), `capture-session-parity.test.ts` "a failed start ends the capture-wide fault an EARLIER session left" (both sides, with a control) | fixed |
| **R74-02** MAJOR | Yes — same file, red (two entries, wrong input, role always PRIMARY) | `audioSourceIntervalsOf` (`packages/shared/src/sim/api.ts`) reads EVERY `AUDIO_SWITCH` item of the session's timeline; each item now holds the media boundary (`params.atMs`); `seq` 1-based; `role` from the selector snapshot line; `switchedBy` from the audit row of that boundary | three switches both directions, control, same answer as the REST layer | fixed. Limit: the timeline is a ring of 200 items — a session with more than about 200 timeline items after a switch falls back to the pair's one boundary |
| **R74-03** MAJOR | Yes (by the old sentence; `faults.ts:167-168`) | ONE wording source `packages/shared/src/sim/capture-fault-wording.ts` (15 reasons, neutral sentence for an unknown reason, severity per reason); `describeFault` words by `facts.reason` and names the device "Camera 2 (CAM-02)"; the status flag (`selectors.ts`) uses the alert's words; i18n `common.captureFault` IS the table (imported). Degraded start: the forwarder raises NO critical fault for `CAMERA_NOT_CONNECTED`; the capture session tells `CAMERA_NOT_CONNECTED` and the notices unit raises the existing WARNING (`session-start.ts`) — one event, one alert. Mobile: `captureFaultLine` on the Home alert line. Web: the bell and the Monitor banner show `alert.message`, which is now the shared sentence | `sim-m5-fault-wording.test.ts` (11), `capture/__tests__/fault-wording.test.ts` (17: enumerates `CaptureWarningReason` + `FINAL_CRASH_CODES` + the Core's own codes — a new protocol reason without a sentence fails), `forwarder-advisories.test.ts`, `session-start.test.ts` (+3), `situation-c.test.tsx`, db `fm5_camera_not_connected` | fixed; wording to the M4 wording review |
| **R74-04** MAJOR (ruled, D177) | Yes — no field of ev §B.5 can say it | **Option (a) + (b): no field bent.** (a) The audit trail holds it and is in the sealed package: `audit-session-extract.jsonl` is every `audit_log` row `WHERE session_id = $1` (`sealing-host/session-reader.ts:45`), and the microphone faults are raised while the session is open, so their `FAULT_RAISED` / `FAULT_CLEARED` rows carry the session ID, the device, `reason: MIC_DISCONNECTED`, their `at`, and — since R74-03 — a true sentence. (b) erratum proposal, §4 below | db `fm5_mics_lost` (raise x2, clear x1, the predicate's control) | closed as ruled; the erratum is decision 2 |
| Q2 / R74-13 | Yes — C3 §5.2 names no member for a wall instant | No code path for it. Stated where it is read (`capture-session/index.ts` header): the row's `at` is the instant of THE UNIT THAT RECORDED THE SWITCH (after the worker's acknowledgement); the boundary's wall instant is `session_audio_intervals.from_at` / `to_at`; the command's arrival instant is stored nowhere. Erratum §4 | — | documented; erratum is decision 3 |
| Q5 / R74-10 | Yes — the copies differed in channel, lookup and "previous active", and (once a fault is worded by reason) in the alert's words | The engine file RE-EXPORTS the five shared transitions; the switch is one shared function `applyAudioSourceSwitch` used by both (`session-machine.ts`, `engine/capture-session.ts`) | parity file: identity of the five, the sixth pair on 3 states x 3 inputs with a control | fixed. Consequence: the engine's failed start now hands `reason` / `evidenceFiles` to the FAULT_RAISED row when it makes the raise itself (it gave them to the alert only) |
| Q7 / R74-09 | Yes — no closer but `release` | `sessionCapture(app).shutdown()` + `registerSessionCaptureShutdown` (an `onClose` hook, registered by the sessions module): worker stopped first (`SHUTDOWN`), then the session signal aborted and every handle closed. The signal is what reaches a camera helper inside its settle window (`camera-helper.ts:304-318` kills on abort); a source that comes up after the abort is closed at once | db `fm5_shutdown_recording`, `fm5_shutdown_starting` (a source still being opened), `fm5_shutdown_close` (`app.close()` alone) | fixed |
| Q1 / R74-17 | Yes — `SWITCH_NOT_REALISED` through the stub | The stub writes the interval of the start, the record of a switch BEFORE its ACK, no record for the active role, `NO_SUCH_MIC`, `AUDIO_TIMELINE_END` at STOP. Also: its HELLO names a release word (F-M3's R63-04 rule ended it otherwise) | `ipc.test.ts` new case; two pins of the file follow (`lastRecordSeq` 1 -> 2, a switch answer `null` -> the record) | fixed |
| R74-05 MINOR | Yes — red | Simulator row: `fromInput`, `toInput`, `fromMs`, `toMs` | `sim-m5-review.test.ts`; pins updated in `sim-v2-parity.test.ts`, web `audio-source.test.tsx`, mobile `mic-source.test.tsx` | fixed. The in-app simulator writes no `sendingDeviceId` (decision 4) |
| R74-06 MINOR | (a) by reading; (b) see note | (a) rows + audit row are written from the record whatever the engine's transition says; the answer names what feeds the track. (b) a record seen while the call waited is RECORDED when the acknowledgement times out, not refused. (c) the unit is run once more before the fallback. A record nobody waits for is now ended by the supervisor (`SWITCH_NOT_COMMANDED`, F-M3) — the net in `onRecord` is unreachable while that rule stands | db `fm5_switch_left`, `fm5_switch_late`, `fm5_switch_silent` (control) | fixed |
| R74-07 MINOR | by reading | Durable media is always handed over: `IGNORED` or a failed door with durable media tells `INTERRUPTED`; the door is asked twice; the log line follows `durable` | db `fm5_end_ignored` | fixed |
| R74-08 MINOR | by reading | NOT FIXED. Taking the stop and the end off the one chain changes the ordering every exit path relies on; it needs its own row with the timing cases. Partly eased: the shutdown does not wait for `begin`, and the `ended` guards in `begin` are live now (a shutdown sets it while `begin` runs) | — | open |
| R74-11 MINOR | Yes — red | The demo clear of `CAPTURE_FAULT` leaves the capture-wide fault alone while the open session is a failed start (`faults.ts`) | `sim-m5-review.test.ts` with its control | fixed |
| R74-12 MINOR | Yes — red on the real route | Mobile: `failedStartClosingOf` (RECOVERY + `captureDurable: false`), read by the recovery screen | `failed-start.test.tsx` (+1), `situation-c.test.tsx` (+1) | fixed |
| R74-14 MINOR | (1) by reading | (1) `failedStartAtRehydrateTransition` + one `else` branch in the rehydrate's capture block (`host.ts`). (2) NOT FIXED: the engine host has no file seam; the boot's `resume()` decides by the file | transition: parity file. **The host wiring has no test of its own** | (1) needs-review, (2) open |
| R74-16 NOTE | — | misplaced comment removed with the copies; `captureDurableTransition` header says it is not on the path | — | done |
| R74-15, -18, -19 NOTE | — | not changed. -15 is a spec question (holder semantics of stop / cancel / recover / marker / note / snapshot); -18 unreachable today; -19 (a) the boot clear still resolves the cause alert of a failed start, (b) 21 ms vs 0 is correct on each side | — | listed |
| **R63-03** MAJOR (D179) | Yes — 7 cases red | Forwarder: `KEYFRAME_INTERVAL_ABOVE_BOUND` (the ACTIVE warning or the record, once) and `AV_OFFSET_NEAR_BOUND` (`clocks[].nearBound`; resolved when false) are named advisory alerts like `MIC_RATE_AT_LIMIT`; all three are resolved when the supervisor leaves the session (IDLE / FAULTED / CLOSED) or another session records | `forwarder-advisories.test.ts` (8); one pin of `fault-lifecycle.test.ts` follows (`[]` -> the advisory raise; "no fault" unchanged) | fixed |
| D179 (a) | — | sentence for `FRAGMENT_SIZE_BOUND_REACHED` (advisory, INFO) | enumeration test | done. No shared advisory NOTICE exists for it yet (`capture-notices.ts` has three reasons): the forwarder raises nothing for it — decision 5 |
| D179 (b) | by F-M3's type | A stop that is not clean (`CaptureStopOutcome.clean === false`) is handed over as `INTERRUPTED` with the cause and raises the capture-wide fault with reason `CAPTURE_STOP_NOT_CLEAN`; a capture-wide fault without a reason reads "The capture stopped unexpectedly before the recording was ended. The recording was interrupted." | db `fm5_stop_not_clean` + control | fixed |
| D180 (F-M6) | Yes — red | A capture that recorded nothing tells the transcription unit the end from the moment the tap path was asked, whether or not `begin` ran | db `fm5_failed_before_begin` + control. The rig's transcriber is a double: that the call removes the folder is F-M6's test | fixed |

Red first, honestly: R74-01, -02, -05, -11, -12, R63-03, the stub, D180 and the mobile wording were
SEEN red. The capture-session db cases (R74-06, -07, -09, CAMERA_NOT_CONNECTED, R74-04) were written
before the code but could not be run red: the app did not boot then (another pass's route without an
access rule). The wording and parity additions were run after their code.

## 2. What the client bands read (R74-02)

- Web Monitor band: operation 82 (`session-monitor/audio-source.ts`) — the simulator's list in
  simulated capture (fixed here), the table in real capture.
- Mobile Session Live: no interval band; it reads the session's pair only.
- Evidence band (web and mobile `features/evidence/audio-source-band.tsx`): the sealed manifest's
  `audio.sourceIntervals`, built from `session_audio_intervals` — the same rows operation 82 reads in
  real capture. A simulated item has no such list.

## 3. Existing tests my changes moved (all updated, each with a comment)

`fault-lifecycle.test.ts` (1), `ipc.test.ts` (2), `sim-v2-parity.test.ts` (1), web
`audio-source.test.tsx` (1), mobile `mic-source.test.tsx` (1), mobile `session-start-home.test.tsx`
(1: "Capture fault" -> the shared sentence). Kinds that may still move in suites I did not run:
client tests that pin an alert's `message` of a `CAPTURE_FAULT`, the bare label "Capture fault" on an
alert line, or the audit keys `fromInputId` / `toInputId` / `deviceId`; server tests that count
`raiseCaptureWarning` calls for a keyframe warning or expect a fault for `CAMERA_NOT_CONNECTED`.

## 4. Erratum proposals (for the controller)

1. **ev §B.5 (R74-04).** Add per interval `audio.sourceIntervals[].missingSamples` (n, not null, 0 when
   whole), fed by the worker: `AUDIO_TIMELINE_END` gains `missing: [{ deviceId, samples }]` per
   interval (the worker counts `m->missing` already, `audio.c:449`), carried through a new column of
   `session_audio_intervals`. Until then the verify report should say "capture faults are in the
   audit extract".
2. **D142 (1) / D144 (5).** Replace "both times are kept in the audit row" by: "the audit row holds the
   media times `fromMs` / `toMs` and its own `at` = the instant the switch was recorded (after the
   acknowledgement); the boundary's wall instant is `session_audio_intervals.from_at`; the arrival
   instant of the command is not stored".

## 5. Not proven here

- No browser, emulator or device run; no run against the built worker.
- `host.ts` rehydrate branch (R74-14 (1)): no test of the wiring.
- Whole suites: the test runner's (list in `delegation_progress/coder_execution_fix_m5.md`).
- Red tests in the tree that are other passes' in-flight edits, by file: `test/static/imports.test.ts`
  (`src/db/seed/demo-helper.ts`, `src/engine/index.ts`), `test/static/network.test.ts` and
  `capture/__tests__/static.test.ts` (`adapters/camera/onvif-session.ts`), `engine/__tests__/static.test.ts`
  (`engine/export-doors.ts`); typecheck `capture/__tests__/records.test.ts:231,248` (F-M3's stop outcome).
