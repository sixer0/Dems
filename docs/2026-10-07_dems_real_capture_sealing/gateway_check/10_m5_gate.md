---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 75 (M5 milestone gate, independent +1)
date: 2026-10-10
agent: verifier
narrative_tier: 2
tree: commit f293221 (product code unchanged by this gate)
status: needs-review
verdict: FAIL (three blocking items, section 1; the main line of M5 works end to end)
---

# 10 - M5 milestone gate (row 75)

Run window 13:10-13:45 WIB on the standing environment of `initialization/05_gate_environment_up.md`.
No product or test file was changed, no git write, no install. No local device (`CAM-03` / `MIC-03`)
was selected, pre-checked or started; no attendance variable was set; the fingerprint sensor was never
touched. Evidence files are under the git-ignored `.cache/gates/75/`.

Surfaces: **W2** = web console lane 2 (REAL_DEVELOPMENT, 5177), **T** = tablet `emulator-5556` on lane 2,
**W1** = web console lane 1 (SIMULATED + demo controls, 5176), **P** = phone `emulator-5554` on lane 1.
Web = headless Chromium over CDP, signed in by the cookie of `gate-session.mts`; devices = `adb` taps
and `uiautomator` / screenshots; sign-in on the devices through the username / password path.

## 1. Verdict

**FAIL.** What M5 is about works when driven through the product: on real capture with the four FAKE
sources a session goes connecting -> recording -> switch (web, tablet, API) -> stop -> sealed, the
interval rows and the audit rows are right, the holder rule holds, the worker stops cleanly, a killed
worker gives the interrupted hand-over the spec names, and the simulator now behaves as review 74
asked (R74-01, -02, -03 confirmed live). The gate fails on three things it found:

| # | Blocking item | Finding | Owner |
|---|---|---|---|
| B-1 | The audit trail of a REAL session - and the sealed package's `audit-session-extract.jsonl` - holds simulator-invented integrity rows (`FRAME_HASH` with random digests, also for a track `AUDIO-02` that a real package does not have; `WRITE_VERIFIED` with invented byte counts; `TIMESTAMP_CONFIRMED` "GNSS") | G75-01 MAJOR | coder-execution (shared generator / engine in real capture); gate 89 must re-check the extract |
| B-2 | `M5-SW-P` fails one named assertion: the `AUDIO_SOURCE_SWITCHED` row of a switch sent from the phone on lane 1 carries no sending device (`deviceId` null, no `sendingDeviceId`) | G75-02 MAJOR | coder-execution (hosted op 81 of a Core in SIMULATED capture), or a ruling that the assertion is proven on the tablet / real path only |
| B-3 | After a worker crash the session surfaces do not name the interruption: web Monitor and tablet Session Summary end on "SESSION SEALED / Evidence sealed" like a normal stop; only the alert (bell, Home flag) says it | G75-03 MAJOR | coder-execution (web Monitor, mobile summary), wording to the UX owner |

Not proven and therefore open beside these (section 6): the file analyser on a product-driven recording,
every local-device check, the phone's Home / bottom bar / Sessions hub while connecting, MB-06.

## 2. Start state

| Step | Result |
|---|---|
| `lane.sh stop 2` (first stop) | `lane 2 stopped (was PID 44593); port 4422 is free`. Core log line 187 of `.locks/core-server.lane2.log` (quoted before the next start truncated the log): `{"level":30,"time":1791612652357,"pid":44593,...,"code":"CAPTURE_SUPERVISOR_STOPPED","msg":"capture supervisor stopped"}`, followed by `engine stopped`, `pipeline closed ... "drained":true,"abandoned":0`, `shutdown complete` - **gate 64's condition C5: met** |
| `reset 2`, `start 2` | exit 0; `audit head seq 83`; v2 demo packages `EV-20261009-0005`, `EV-20261008-0001`; ready, PID 58707 |
| `stop 1`, `reset 1`, `start 1` | exit 0; `audit head seq 83`; ready, PID 58599 |
| Health | both `ready {database:true, engine:true}` through the web proxies |
| Lane 2 mode / selector | boot audit row `SYSTEM_BOOT {captureOperation: REAL_DEVELOPMENT}`; `GET capture/config`: `CAM-01`, `CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked: false`; `GET capture/devices`: those four `adapter: FAKE, sourceClass: DEVELOPMENT` (`CAM-03` / `MIC-03` registered `LOCAL_DEVICE`, in no selector) |
| Devices | both `DEV-0001`, `state: PAIRED`, `online: true`, `pairedAt` unchanged (1791426649334 / 1791426674169); app relaunched per the operating sheet: Login, "Core online", "paired as DEV-0001" |

Lapse to record: my first reset command piped `lane.sh start 2` into `tail`; the detached Core kept the
pipe open and the command hung. I ended my own shell, then stopped and started lane 2 once more with
its output in a file (so lane 2 was stopped twice; its database was reset once, before any use).

## 3. Entry condition - "0 Blocker / Major open" for M5

| Finding | Fix read in code | Test run now (once, on f293221) | Proven live | State |
|---|---|---|---|---|
| R74-01 two failed starts = two alerts, two rows | `packages/shared/src/sim/capture-session.ts:143` `endStaleCaptureFault`, called at `:114` | `packages/shared/test/sim-m5-review.test.ts` + `sim-m5-fault-wording.test.ts`: 2 files / 19 passed; `engine/__tests__/capture-session-parity.test.ts` in the run below | YES, lane 1: `SES-..-0026` and `-0027` failed in a row -> `ALR-000016` and `ALR-000022`, `FAULT_RAISED` seq 134 and 146, each with its own `sessionId`, `reason: NO_CAMERA_CONNECTED`, `evidenceFiles: 0` | FIXED |
| R74-02 simulator op 82 after several switches | `packages/shared/src/sim/api.ts:779-795` (`audioSourceIntervalsOf` reads every `AUDIO_SWITCH` item) | same shared run | YES, lane 1, three switches: seq 1 MIC-01 PRIMARY 0-11253, seq 2 MIC-02 STANDBY 11253-37383, seq 3 MIC-01 PRIMARY 37383-41847, seq 4 MIC-02 STANDBY 41847-; web band segments `[MIC-01, MIC-02, MIC-01, MIC-02]` | FIXED |
| R74-03 wording per reason; degraded start = warning | `packages/shared/src/sim/capture-fault-wording.ts:27` (`CAPTURE_FAULT_SENTENCES`), `faults.ts:128-178`; `capture/forwarder.ts` (no fault for `CAMERA_NOT_CONNECTED`) | `capture/__tests__/fault-wording.test.ts`, `forwarder-advisories.test.ts`, `capture-session-parity.test.ts`: 3 files / 43 passed | YES for the reasons a lane can raise: "No camera connected. Nothing was recorded."; "Camera 2 (CAM-02) is not connected. The session is recording one camera only. It did not connect in time." (WARNING); worker kill: "The capture stopped unexpectedly before the recording was ended. The recording was interrupted."; never "a recording file stopped growing". Residue: G75-05, G75-09 | FIXED (two wording leftovers, MINOR) |
| R74-04 lost audio in the package | ruled D177 / D182: no manifest field; the microphone fault rows are in the session's audit extract (`sealing-host/session-reader.ts:15`) | db cases of note 112 inside gate 64's whole db run on f293221 (2381 passed) | NOT driven (no way to fail a FAKE microphone on a lane). The extract of today's session A does hold the session's rows - and the invented ones of G75-01 | CLOSED AS RULED; its worth now also depends on G75-01 and on R88-06 (gate 89) |
| R63-03 advisories reach the operator | `capture/forwarder.ts:312-363` (`adviseOn` / `adviseOff`) | `forwarder-advisories.test.ts` in the run above | NOT raised: the FAKE sources produced no advisory in two sessions (`GET alerts` = `[]` during session A) | FIXED in code and test; not seen live |

Product code is unchanged since the commit: `git status` shows five README files and docs only
(`git diff --stat HEAD -- apps packages scripts`: 3 README files).

Entry condition: **met** (0 BLOCKER, 0 MAJOR of review 74 open; R74-04 by ruling).

## 4. Checks

### 4.1 Lane 2 - real capture, FAKE sources

Session A `SES-20261010-0024` was created, pre-checked, started and stopped from the **web console**
(operator OPR-001) and observed on the tablet, which sent one of the switches. Session B
`SES-20261010-0025` was created, pre-checked and started from the **tablet** and observed on the web.

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Create -> pre-check, four FAKE sources | W2, T | PASS | W2: "All checks passed", 8 of 8, each lens / microphone row "Development source / Test source". T: the same rows with "Primary microphone - MIC-01", "Standby microphone - MIC-02". Audit seq 97-98, 152-153 |
| Start: connecting (`M5-NODEV-C-W/-T` F1) | W2, T | PASS | Session A, page log at 100 ms: 13:23:04.807 banner "CONNECTING CAMERAS... / Connecting cameras... Recording has not started.", no REC, `Duration 00:00:00`, End Session disabled with "Nothing is recorded yet: the cameras are still connecting. The session ends by itself if no camera connects."; API `RECORDING, captureDurable: false` at 13:23:04.844. Session B: `w2_10_connecting.png`, `t2_10_connecting.png` |
| Recording only from the first durable fragment | W2, T, API | PASS | `captureDurable: true` at 13:23:06.875; Core log `CAPTURE_SYNC_LEVEL ... CAM-01 ... F_FULLFSYNC` at ...386824; REC and timer on the page from 13:23:06.871. Worker `capture-worker` + four helper processes running (`pgrep`) |
| Switch from the web (`M5-SW-W`, op 81) | W2 | PASS for the client and record assertions | confirm dialog "Switch the active microphone to MIC 2? ... written to the audit log."; chips swap; band "MIC 1 from 0:00 to 2:22 / MIC 2 from 2:22"; audit seq 128 `AUDIO_SOURCE_SWITCHED {fromInput MIC-01, toInput MIC-02, fromMs 21, toMs 142171}` actor OPR-001, no device (a web console has none) |
| Switch from the tablet (`M5-SW-T`) | T | PASS for the client and record assertions | `t2_06_switch_confirm.png`; audit seq 130 `{fromInput MIC-02, toInput MIC-01, fromMs 142171, toMs 161701, sendingDeviceId DEV-0001}`, `deviceId DEV-0001`; the web band followed without a reload: "MIC 2 from 2:22 to 2:41 / MIC 1 from 2:41" |
| The other client follows | T, W2 | PASS | `t2_05_after_web_switch.png` (MIC 2 Active after the web's switch, timeline "Microphone Switched"); `w2_05_after_switch3.png` |
| `session_audio_intervals` through op 82 | API | PASS | after four switches: seq 1 `MIC-01 PRIMARY 21-142171 START`, seq 2 `MIC-02 STANDBY 142171-161701 MANUAL OPR-001`, seq 3 `MIC-01 PRIMARY 161701-165521 OPR-001`, seq 4 `MIC-02 STANDBY 165521- OPR-002` (then a fifth by the creator); 1-based, contiguous, the input that feeds the track, roles of the selector |
| One `AUDIO_SOURCE_SWITCHED` per switch, contract keys | audit API | PASS | seq 128, 130, 134, 141: four switches, four rows, keys `fromInput, toInput, fromMs, toMs (+ sendingDeviceId)` |
| Holder rule (403 + one audited denial) | API | PASS | second INVESTIGATOR (OPR-003, role assigned for the check, see 9): `403 NOT_PERMITTED {permission SESSION_START, role INVESTIGATOR, reason SESSION_HOLDER}`, one row seq 139 `ACCESS_DENIED {reason SESSION_HOLDER}`, no switch. Creator: 200 (seq 128, 141). SUPERVISOR OPR-002: 200 (seq 134). The TECHNICIAN as seeded: 403 by role (seq 133) |
| Advisory alerts | W2, API | none raised | `GET alerts` = `[]` during session A |
| No auto-switch (`M5-WARN-1`, live half) | API | PASS (observation) | intervals changed only at the five commands |
| Stop | W2 | PASS | End Session dialog with a reason; `RECORDING -> STOPPING 13:26:47.314 -> FINALIZING .483 -> SEALED 13:26:48.833`; Core log: no capture fault, `SEALING_COMPLETE ... EV-20261010-0014 ... "interrupted": false`; `pgrep -fl 'capture-worker\|ffmpeg'` empty 4 s later. T: `t2_08_after_stop.png`, then Session Summary SEALED, Duration 00:03:42, 226.8 MB |
| Hand-over to sealing | W2, T | noted | sealed 1.3 s after the end; the seal itself is gate 89's |
| Interrupted case (`pkill -KILL -f build/capture-worker` at 13:29:25, session B durable) | Core | PASS against cap A.3 option C | `CAPTURE_WORKER_DOWN ... "signal":"SIGKILL","restartInMs":null` (no respawn); `CAPTURE_INTERRUPTED ... "cause":"EXITED","outcome":"INTERRUPTED","durable":true`; `SEALING_COMPLETE ... EV-20261010-0015 ... "interrupted": true`; custody `RECORDING_INTERRUPTED / CAPTURE_FAULT`; audit seq 159 `FAULT_RAISED`, 160 `RECOVERY_STARTED`, 161 `EVIDENCE_SEALED`, 162 `RECOVERY_COMPLETED`; no process left |
| ... a fault with a true sentence | alert | PASS | `ALR-000014 CRITICAL CAPTURE_FAULT` "The capture stopped unexpectedly before the recording was ended. The recording was interrupted." (web bell `w2_12_bell_after_kill.png`, tablet Home flag and bell `t2_13_bell_interrupted.png`) |
| ... the interruption shown by name on web and tablet | W2, T | **FAIL** | G75-03: Monitor ends on "SESSION SEALED / Evidence EV-20261010-0015 sealed - Ready for the next session", the seal dialog and the tablet summary say "Evidence sealed" / "SEALED"; the word "interrupted" is on neither (`w2_13_sealed_interrupted_monitor.png`, `uiautomator` dump of the summary) |

### 4.2 Lane 1 - simulated capture, demo controls

Sessions: S1 `-0024` (API start, three switches from web / phone / web), S2 `-0025` (no camera, started
in the web UI, closed on the web), S3 `-0026` (no camera, started on the phone, closed on the phone),
S4 `-0027` (no camera, API), S5 `-0028` (camera 2 lost), S6 `-0029` (both cameras, ended on the phone).
The demo control is `POST demo/faults {kind: CAMERA_LOSS, target: {cameraId}}` set between ARMED and Start.

| Check | Surface | Result | Evidence |
|---|---|---|---|
| F1 connecting -> recording | W1, P | PASS | W1 (S2, S5, S6 page logs): "CONNECTING CAMERAS... / Connecting cameras... Recording has not started.", End Session disabled with its sentence, then REC + timer. P: `p1_09_connecting.png` |
| F2 no camera: failed start (`M5-NODEV-C-W`) | W1 | PASS except the meters | `w1_02_failed_start.png`: banner "FAULT / No camera connected. Nothing was recorded." + "Close session", feed card with "Open Devices", Start Time and Duration "-", no REC, no timer. **Meters are drawn** (G75-04). API: `FAULT, captureDurable: false, startedAt: null` 1.0 s after the start |
| F2 on the phone (`M5-NODEV-C-P`, F5) | P | PASS | `p1_06_failed_start_home.png`: the failed-start notice (`session-failed-start-NO_CAMERA_CONNECTED`), "Open Devices", "Close session", "Go to Home"; no pipeline, no track rows, no recovery wording |
| F2 one alert, one row, no evidence | API | PASS | S2: `ALR-000010 CRITICAL CAPTURE_FAULT {reason NO_CAMERA_CONNECTED, evidenceFiles 0}`, one `FAULT_RAISED` seq 120; after the close: history `INCOMPLETE`, `startedAt` null, 0 bytes, `evidenceId` null; newest evidence item still S1's |
| F5w close on the web opens no recovery overlay | W1 | PASS | after "Close session": 0 dialogs; banner stays without a control for 3 s, then "NO SESSION / No interview is being recorded." (`w1_04_closing_failed_start.png`, page log 13:35:49-52) |
| F5 close on the phone | P | PASS | "Close session" -> Home, no recovery screen; the phone also returned to Home by itself when the web closed S2 |
| F3 degraded start: Core | API | PASS | S5: `RECORDING`, durable; `ALR-000027 WARNING SYSTEM {reason CAPTURE_DEVICE_UNREACHABLE, deviceId CAM-02, phase SESSION_START, cause NOT_CONNECTED}`; one row seq 158 `CAPTURE_DEVICE_UNREACHABLE {degraded: true}`; no capture fault |
| F3 degraded start: clients | W1, P | **NOT PROVEN as specified** | the demo control's own CRITICAL `CAMERA_LOSS` takes the banner: "FAULT / Recording continues - Camera signal lost" (`w1_06_degraded_monitor.png`); camera 2 tile NO SIGNAL, timer and camera 1 run. The warning naming the camera is in the bell only. Phone Home: "Recording Blocked" while recording (`p1_12_degraded.png`). G75-07 |
| F3 cleared by the next session | API, W1 | PASS | S6 durable at 13:40:05: `ALR-000027` resolved, gone from the open bell in the same second |
| F4 stop while connecting | API | PASS | S1: `409 {"code":"INVALID_STATE","details":{"from":"RECORDING","event":"stopRecording","reason":"CAPTURE_NOT_DURABLE"}}` (the code is `INVALID_STATE`; `CAPTURE_NOT_DURABLE` is `details.reason`); the session stayed RECORDING |
| R74-01 two failed starts in a row | API | PASS | section 3 |
| R74-02 op 82 after three switches (`M5-SW-P` list half) | W1, P, API | PASS | section 3; switches sent from web, phone (`p1_03_switch_confirm.png`), web; the phone followed the web (`p1_02_session_live.png`) |
| `M5-SW-P` sending device | audit | **FAIL** | G75-02: seq 103 (the phone's switch) `deviceId: null`, no `sendingDeviceId`; Core log principal `operator:OPR-001` |
| R74-03 wording per reason | W1, P | PASS with two leftovers | "No camera connected. Nothing was recorded."; the degraded sentence; `MIC_SILENT`: "MIC 1 - Interviewer: silent below -50 dBFS for 10 s", banner "ATTENTION / Recording continues - Microphone silent". Leftovers G75-05, G75-09 |
| F7 "Connecting cameras..." on the web Dashboard | W1 | PASS | S3 page log 13:37:07.5-08.5: "Connecting cameras... SES-20261010-0026", no REC, no elapsed timer |
| F7 phone Home / bottom bar / Sessions hub | P | NOT PROVEN | the simulator connects for 1 s; my one screenshot burst on Home showed the state before the start (`seq/p1_S6_1.png`). Jest only (`session-start-home`, `session-start-hub`) |
| F8 alert centre wording | W1, P | PASS | web bell: both sentences (`w1_03_bell_failed_start.png`, `w1_07_bell_degraded.png`); phone Home flag "No camera connected. Nothing was recorded." (the phone bell was not opened) |
| F9 Monitor while connecting | W1, W2, P, T | PARTIAL | audio cards read "CONNECTING" without a meter on all four (`w2_10`, `t2_10`, `p1_09`). Web: the "Camera & Input Status" panel under them still draws both microphone meters (G75-04); integrity panel: one row "Standby", three rows "Active" with a chain head |
| Dashboard failed start | W1 | PASS | `w1_05_dashboard_failed_start.png`: "No camera connected / Fault / Nothing was recorded.", both camera tiles NO SIGNAL |
| F6 MB-06 resumed seal | P | NOT RUN | no demo control produces it (it needs a Core restart during sealing) |
| Durable fault -> ordinary recovery (control of F5 / F5w) | W1, P | NOT PROVEN | the demo `CAPTURE_FAULT` does not fault the session (it stays RECORDING, G75-09); `failed-start-close.test.tsx`, `failed-start.test.tsx` only |
| Demo fault ignores `cameraId` (gate 70's G70-09) | API | explained, not a targeting defect | `{"kind":"CAMERA_LOSS","target":{"cameraId":"VIDEO-02"}}` -> `activeFaults [{target: VIDEO-02}]`. A top-level `"cameraId"` is accepted (204) and ignored -> the default camera (G75-14) |

### 4.3 Software checks of the row (by mapping; code unchanged since the runs)

| Check | Result | Evidence |
|---|---|---|
| `M5-RG-*` core-server unit + db | PASS | gate 64 on f293221 (`gateway_check/08_m3_gate.md` lines 49-50): 309 files / 6247 passed; 177 files / 2381 passed, 6 skipped |
| `M5-RG-*` shared, capture-protocol, core-web, mock-core, mobile | PASS by `test/06_checkpoint_wave_f.md` B3-B9 + pass F-Z, as mapped by gate 64 (lines 51-52); not re-run as wholes on f293221 | my targeted runs today: shared 19, core unit 43 |
| `M5-QA-1` typecheck + lint | PASS | `test/06` B1 / B2 and gate 64 line 55 |
| `M5-GAP-1` | PASS by record | `implementation/30_m5_mic_switch.md:73` (`m5_gap_analyser` PASS, the 1,000-sample control FAIL as required); inside the 122-check worker series of D188 (aggregate exit 0). Not re-run |
| `M5-WARN-1` | PASS by record | `apps/capture-worker/test/micwatch_test.c` in the same series; live: no switch without a command |
| `M5-NODEV-C-1` (+1) | PASS on the simulator lane; real-worker half by record | lane 1 above; `capture-notices/__tests__/session-start{,.db}.test.ts` in gate 64's runs. A lane cannot stop a FAKE camera, so the 0-camera start on REAL capture was not driven |
| `M5-SRC-REC-1` read | PASS by record | `capture-session/__tests__/session-capture.db.test.ts`, `capture/fence/__tests__/development-session.db.test.ts` in gate 64's db run |
| `M5-SEC-SRC-1` | NOT PROVEN by me | no test names the ID; `SOURCE_KIND_NOT_RECORDABLE` is asserted in `session-capture.db.test.ts` and `capture-config/__tests__/plan.test.ts`; the socket snapshot / push attempt was not located or run |
| `M5-LOCAL-E2E-1` (+1) | PARTIAL | the FAKE-source half is today's session A / B through the product (two camera tracks sealed each). The local-device half is the user's |
| `M5-SW-W/T/P` file assertions (one AAC stream, sample count, continuity, boundary within one quantum) | NOT PROVEN on today's recordings | no analyser was run on the sealed files; worker-level proof in the D188 series |
| "Checking your permissions..." | NOT OBSERVED | as at gate 70 |

## 5. Findings

| ID | Severity | What | Steps / evidence | Spec |
|---|---|---|---|---|
| G75-01 | **MAJOR** | In REAL capture the shared simulator's generator keeps writing its "integrity stream" for the session: 25 `FRAME_HASH` rows (random `sha256`, `segment 1`, tracks VIDEO-01 7, VIDEO-02 8, AUDIO-01 4, **AUDIO-02 6**), 7 `WRITE_VERIFIED` (`bytesWritten` up to 235,355,944; the package is 226.8 MB), 7 `TIMESTAMP_CONFIRMED {source GNSS}` - in the Core's audit chain with `sessionId` and in the SEALED package's `audit-session-extract.jsonl` of `SES-20261010-0024`. The Monitor shows them as fact: "Evidence Auto-Save - Segment 1 saved (235 MB)", "CHAIN HEAD", "Video frame hash recorded", "Write Speed 2.3 MB/s" | lane 2, any recording; `GET audit` seq 100-137; type count of the extract file. `packages/shared/src/sim/generator.ts:5-8` has no capture-mode condition; no decision or note mentions it (`grep FRAME_HASH` over the task folder: 0 hits) | a real evidence package must not carry invented integrity statements; R74-04 was closed on the audit extract being the truthful record |
| G75-02 | **MAJOR** (fails `M5-SW-P`) | A Core in SIMULATED capture writes `AUDIO_SOURCE_SWITCHED` without the sending device for a switch sent by the paired phone. The real path names it (`capture-session/index.ts:1103`, lane 2 seq 130) | lane 1 seq 103 | row 75 "`AUDIO_SOURCE_SWITCHED` with sending device ID audited"; `10_test_strategy.md` `M5-SW-P`; SEC35-17. Review 74 left it "not determined" (R74-05) |
| G75-03 | **MAJOR** | A recording ended by a worker crash is presented on the session surfaces as an ordinary seal. Web: for about 100 ms "SESSION ACTIVE & SECURE / Capture fault / Start recovery", then "SESSION SEALED"; timeline "Fault Detected NM-07" and "Critical fault: CAPTURE_FAULT" (codes, no sentence). Tablet: "Finalizing evidence", then Summary "SEALED" | session B; `w2_13_...png`, `t2_11_after_kill.png`, summary dump | ux flow 4: "Crash during recording: durable part presented as 'interrupted'" (the evidence badge is gate 89's) |
| G75-04 | MINOR (fails a named assertion of `M5-NODEV-C-W`, F9) | Web draws microphone meters where the spec says none: (a) while connecting, the Monitor's "Camera & Input Status" panel (`w2_10_connecting.png`: MIC 1 / MIC 2 bars, -21 dBFS); (b) in a failed start, the Audio Monitor cards, the status panel and the Dashboard tiles (-52 dBFS; `w1_02`, `w1_05`) | S2, S3, session B | ux 8e.2 "no meters"; `M5-NODEV-C-W` "0 generated meters" |
| G75-05 | MINOR | The clear row of a no-camera fault is worded with another cause: `FAULT_CLEARED` "The capture stopped unexpectedly before the recording was ended. The recording was interrupted. - cleared" (lane 1 seq 127, 145, 157). On lane 2 the worker-crash alert and its `FAULT_RAISED` carry no `reason` | audit lists | R74-03: one true sentence per reason |
| G75-06 | MINOR | Demo operation 74 `clearFault {CAPTURE_FAULT}` resolved the alert of a failed start once its session was closed (`ALR-000010`, seq 127) | lane 1 after S2 | `M5-NODEV-C-1`: "cleared only by the capture side in a later session, never by demo op 74" (R74-11's fix covers the open session only) |
| G75-07 | MINOR | Degraded start on the simulator: (a) no Monitor surface shows the warning naming the camera - the demo fault's CRITICAL banner stands there; (b) phone Home reads "Recording Blocked / A critical fault needs action" while a recording runs; (c) the warning stays active after its session ended, still saying "The session is recording one camera only"; (d) with the camera back, the NEXT pre-check ends WARN `LENS_2 UNREACHABLE "CAM-02 is not reachable"` and the start needs `acknowledgeWarnings` | S5, S6 | ux 8e.2 degraded row; 8e.4 |
| G75-08 | MINOR | The interrupted session is SEALED with `stoppedAt: null`; the web Monitor's Duration keeps counting (00:01:49 for a 22 s recording); the tablet summary says 00:00:22 | session B | consistency of one fact on two clients |
| G75-09 | MINOR | Demo `CAPTURE_FAULT` during a recording: the alert says "The recording was interrupted." while the session stays RECORDING and the banner says "Recording continues - Capture fault" | S6 | R74-03 |
| G75-10 | MINOR | After the interrupted seal the capture fault stays active until the next start: tablet Home "SYSTEM CRITICAL / Recording Blocked" beside an enabled "Start Session"; web header "CRITICAL - An integrity check failed" | lane 2 now (`ALR-000014`); `t2_13_bell_interrupted.png` | nothing is blocked and no integrity check failed |
| G75-11 | MINOR | A failed start leaves `RECORDING_STARTED` in the audit log, "Recording Started" in the Monitor timeline and "Recording session started" in the Dashboard events | S2-S4 (seq 119, 133, 144) | ux 8e.2: no wording that suggests evidence exists |
| G75-12 | NOTE | One-frame mixtures: title "CONNECTING CAMERAS..." over "Recording in progress" for 90-180 ms at the change to recording | page logs | cosmetic |
| G75-13 | NOTE | Reproduced from gate 70: G70-04 (tablet "Next" / "Start Recording" announce "busy" while idle), G70-03 (Session Live and Home draw a stock room picture captioned "LIVE / DEMO" during a real recording), G70-05 (`RECORDING_STOPPED` from the phone, seq 190, has no device) | T, P | - |
| G75-14 | NOTE | `POST demo/faults` accepts and ignores unknown top-level members (`cameraId` outside `target`): 204, default camera | lane 1 | the cause of G70-09 |
| G75-15 | NOTE | The seed has one INVESTIGATOR; the holder refusal can only be shown by assigning that role to a second operator | section 9 | - |

## 6. Not covered, and why

1. File-level assertions of `M5-SW-*` on a product-driven recording (no analyser run on the sealed files).
2. Situation C and the degraded start on REAL capture: a lane cannot stop one generated source.
3. F6 (MB-06), the durable-fault recovery control, the phone's Home / bottom bar / Sessions hub and the
   tablet's shells while connecting, the phone bell, "Search again" under the role and lock rules in
   situation C, the closed-failed-start detail on the phone.
4. `M5-SEC-SRC-1` (REAL_PRODUCTION, socket snapshot).
5. Advisory alerts and both-microphones-lost (R63-03, R74-04) live: the FAKE sources raise neither.
6. Whole-suite runs on f293221 for shared, web and mobile (mapped, as at gate 64).
7. The plan's tracking table and `implementation/99_implementation_report.md` were not written: the
   task asked for this one file.

## 7. Skipped list

| Item | Reason |
|---|---|
| `M5-SEC-PRIV-2-W / -T / -P` ("is on" line), the Start Recording notice (115 section 5), `M5-LOCAL-E2E-1` local half, `M5-LOCAL-CLAP-1` | user-attended, not run. No local selector was set at this gate. Component evidence: `live-local-source-on.test.tsx`, `registered-devices.test.tsx` (web), `local-source-notice.test.tsx`, `local-source-start-notice.test.tsx`, `source-on-*.test.tsx`, `registered-devices-model.test.ts` (mobile) - green at gate 70 (121 web, 399 mobile). The notice itself was driven to "Not now" at gate 70. No clap record exists yet (`71_r11...md:128`: not run) |
| Biometric sign-in | skipped by the user's instruction (D151); the "Enable biometric sign-in" offer was declined ("Not now") once on each device |
| Real-LAN discovery, camera search on lane 2 | not part of this gate; not pressed |

## 8. Screenshots (`.cache/gates/75/`)

Read by me:

| File | Shows |
|---|---|
| `t2_03_home_recording.png` | tablet Home during session A: "Recording SES-20261010-0024", REC 00:00:58, the biometric offer over it |
| `t2_04_session_live.png` | tablet Session Live: Recording 00:02:06, MIC 1 Active, MIC 2 Standby with badges, "Switch to MIC 2", stock room picture "LIVE / DEMO" |
| `t2_05_after_web_switch.png` | the same after the web's switch: MIC 2 Active, timeline "Microphone Switched ... MIC-02" |
| `t2_06_switch_confirm.png` | tablet dialog "Switch the active microphone to MIC 1?" |
| `t2_08_after_stop.png` | tablet "Finalizing evidence" 16 %, Recording length 00:03:42, EV-20261010-0014 |
| `t2_10_connecting.png` | tablet Session Live of session B: "Connecting cameras...", VIDEO 1 / 2 CONNECTING, both audio cards "CONNECTING", End Session dimmed with its sentence |
| `w2_10_connecting.png` | web Monitor of session B: banner and feed card "Connecting cameras...", Duration 00:00:00, End Session dimmed; meters in the lower status panel |
| `t2_11_after_kill.png` | tablet 4 s after the kill: "Finalizing evidence" 16 %, Recording length "-" |
| `w2_05_after_switch3.png` | web Monitor recording: timeline with three "Microphone Switched" rows, the band under the audio cards, "Evidence Auto-Save Segment 1 saved (235 MB)" |
| `w2_13_sealed_interrupted_monitor.png` | web after the interrupted seal: "SESSION SEALED", Duration 00:01:49, header "CRITICAL An integrity check failed", timeline "Fault Detected NM-07" |
| `t2_13_bell_interrupted.png` | tablet Home "SYSTEM CRITICAL / Recording Blocked" with the interruption sentence, bell item, "Start Session" enabled |
| `p1_01_home_recording.png` | phone Home in S1: "Session in progress", REC 00:00:13, the biometric offer |
| `p1_02_session_live.png` | phone Session Live: Recording 00:00:23, MIC 2 Active after the web's switch, no badge |
| `p1_03_switch_confirm.png` | phone dialog "Switch the active microphone to MIC 1?" |
| `p1_06_failed_start_home.png` | phone failed-start notice: "No camera connected / Nothing was recorded...", Open Devices, Close session, Go to Home |
| `p1_09_connecting.png` | phone Session Live: "Connecting cameras...", NO SIGNAL / CONNECTING, audio cards "CONNECTING", End Session dimmed with its sentence |
| `p1_12_degraded.png` | phone Home in S5: "Recording Blocked ... Camera 2 offline", Camera 1/2, mini bar "Recording 00:00:04" |
| `p1_14_end_dialog.png` | phone "End Session?" dialog with the required reason |
| `w1_02_failed_start.png` | web Monitor failed start: FAULT banner, "No camera connected" card, both cameras NO SIGNAL, microphone meters drawn |
| `w1_05_dashboard_failed_start.png` | web Dashboard: Active Session "No camera connected / Fault / Nothing was recorded.", camera tiles NO SIGNAL |
| `w1_06_degraded_monitor.png` | web Monitor in S5: "FAULT / Recording continues - Camera signal lost", REC 00:00:03, Camera 2 OFFLINE |
| `seq/p1_S6_1.png` | phone Home 0.6 s after S6's start: still "Ready for Recording / Continue setup" |

Taken but NOT read as pictures (the text beside them was read from the DOM or the view tree instead):
`w2_00`, `w2_01`, `w2_02_start_1-3`, `w2_03`, `w2_04`, `w2_06`, `w2_11`, `w2_12`, `t2_02`, `t2_07`,
`t2_12`, `p1_00`, `p1_04`, `p1_05`, `p1_07`, `p1_08`, `p1_10`, `p1_11`, `p1_13`, `w1_01`, `w1_03`,
`w1_04`, `w1_07`, `w1_08`, and the rest of `seq/`.

## 9. Environment as left - what later gates must know

| Item | State |
|---|---|
| Lanes | 1 and 2 RUNNING (PIDs 58599 / 58707), web 5176 / 5177 up; both were reset to the seed at 13:10-13:18 and then used as below |
| Lane 2 sealed items (real capture, FAKE sources, development key) | **`EV-20261010-0014`** = `SES-20261010-0024`, clean stop, 00:03:42, 226.8 MB, five audio intervals (four switches by OPR-001 / tablet / OPR-002); **`EV-20261010-0015`** = `SES-20261010-0025`, INTERRUPTED (worker killed), 22 s, 19.7 MB, custody `RECORDING_INTERRUPTED`. Both hold the invented rows of G75-01 in their audit extract. Plus the seed's `EV-20261009-0005` (altered) and `EV-20261008-0001` |
| Lane 2 open items | no session open (`-0025` SEALED, summary acknowledged, selector unlocked: CAM-01, CAM-02, MIC-01 PRIMARY, MIC-02 STANDBY). **`ALR-000014` CAPTURE_FAULT is still ACTIVE** (it clears at the next recording): tablet Home and the web header read CRITICAL until then |
| Lane 2 operators | OPR-003 was given the INVESTIGATOR role for one call and put back (`ROLE_CHANGED` seq 136, 140; now TECHNICIAN) |
| Lane 1 | six sessions `-0024..-0029`: three sealed (simulated: `EV-20261010-0014`, `-0015`, `-0016`), three INCOMPLETE failed starts (`-0025..-0027`, no evidence item); no session open, no active alert, `activeFaults: []` |
| Audit chains | lane 1 to about seq 195, lane 2 to about seq 170 (sign-ins, sessions, switches, two `ACCESS_DENIED`, fault rows). A gate that counts from the seed should reset its lane first |
| Devices | both on Login, "Core online", "paired as DEV-0001", reverse rules intact (4421 / 4422); no re-pairing, no lock change, biometric not enabled |
| Processes | no `capture-worker` / `ffmpeg` left; my two headless browsers stopped; my cookie jars signed out and removed |
| Tooling notes | `lane.sh start` must not be piped (the detached Core holds the pipe): redirect to a file. `uiautomator dump` fails ("could not get idle state") on animated screens (Session Live, Home while recording): use screenshots there. The Core's API session expires after a few idle minutes: sign in again before a late read |

---
*Generated: 2026-10-10 13:50 WIB*
