---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 75 (M5 milestone gate, RE-GATE, independent +1)
date: 2026-10-10
agent: verifier
narrative_tier: 2
tree: commit 74fd1f1 (product code unchanged by this gate)
supersedes: nothing - read with gateway_check/10_m5_gate.md (first gate, FAIL)
status: blocked
verdict: FAIL (M5 cannot be closed: no real-capture session reached SEALED on lane 2; G75-03 not re-driven; one new MAJOR)
---

# 10b - M5 milestone re-gate (row 75)

Run window 19:49-20:06 WIB on the environment of `initialization/06_gate_environment_regate.md` as
amended by `09b_m4_regate.md` section 8. No product or test file changed, no git write, no install.
No local device (`CAM-03` / `MIC-03`) selected, pre-checked or started; no attendance variable set;
the fingerprint sensor never touched; `CAM-04` not put on a track; the camera stub not used.
Evidence under the git-ignored `.cache/gates/75b/`. Every command against the lanes and the
emulators ran outside the command sandbox (loopback and adb are closed inside it), as the operating
sheet says.

Surfaces: **W2** web lane 2 (5177, REAL_DEVELOPMENT), **T** tablet `emulator-5556` on lane 2,
**W1** web lane 1 (5176, SIMULATED + demo controls), **P** phone `emulator-5554` on lane 1.
Web = headless Chromium over CDP with the cookie of `gate-session.mts`; devices = `adb` taps,
`uiautomator`, screenshots; device sign-in through the "Demo operators" list (values never printed).
Both overlays were answered before the first tap on each device (toast X; "Not now").

## 1. Verdict

**FAIL - and blocked for the real-capture half.**

The first real-capture session of this re-gate (tablet, lane 2) went create -> pre-check ->
connecting -> recording (71 s) -> one switch -> stop correctly, and then **could not be sealed**:
`SEALER_FAILED` at step `CLOSE_TRACKS`, four attempts, then the CRITICAL alert "Sealing of this
session is blocked. The session key could not be used ...". The session stays `FINALIZING`, the Core
refuses every new session (`409 SESSION_ACTIVE`), and the two ways out the project offers both end
closed: a restart of the lane repeats the failure (attempt 5, `SEALING_SESSION_BLOCKED`), and
`lane.sh reset 2` is refused by its own guard (`RESET_BLOCKED_REAL_EVIDENCE`: the unsealed folder is
an "unreadable package directory"). I did not go around either control (section 6, G75b-01).

Consequences for the gate:

| # | Blocking item | Owner |
|---|---|---|
| B-1 | **G75b-01 (MAJOR)** - a real-capture session on lane 2 cannot be sealed in this environment, and nothing an agent may do restores the lane | controller / user decision on the lane (section 6), then coder-execution for the cause |
| B-2 | **G75-03 stays OPEN (not re-driven)** - the interrupted-seal naming on web, tablet and API needs a sealed interrupted session; none can be made while lane 2 is blocked. Same for G75-08 and G75-10 on real capture and G75-05's second half (`reason: WORKER_KILLED`) | re-gate again once lane 2 seals |
| B-3 | The mandatory web-driven real-capture session, the sealed item, the tablet Summary and the audit extract of a NEW sealed session (G75-01's last proof) were not reachable | same |

What IS proven now: G75-02 closed (sending device on the simulated lane), G75-04, -05 (first half),
-06, -07, -09, -10 (simulated lane), -11 (web), -14 closed; G75-01 closed for the live audit chain
and the Monitor of a real recording (no invented row, no invented panel fact); the host-clock time
wording on the session surfaces; the checkpoint facts on web and tablet; F7 on the phone Home.

## 2. Start state

| Item | Read at 19:49 |
|---|---|
| Tree | `74fd1f1`; `git status --short` outside `docs/`: 0 lines |
| Lanes | 1 RUNNING PID 3547; 2 RUNNING PID 7264 (gate 70b's restart); both `ready {database, engine}` |
| Lane 2 | selector `CAM-01`, `CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked: false`; no session; `GET time/status`: `hostClock: true, source: RTC, locked: false`; STT `enabled: true, backend: cpu-local` (not changed by me); 13 evidence items, the two v2 seed items `interrupted: false`; audit head seq 148 |
| Lane 1 | no session, `activeFaults []`, audit head about seq 113 |
| Devices | both awake, no keyguard, Login, "Core online", "paired as DEV-0001", reverse rules 4421 / 4422 |

## 3. Entry condition

Unchanged from the first gate (0 BLOCKER / MAJOR of review 74 open). The three MAJORs of the first
gate were the fix wave's targets:

| First-gate finding | Fix note | State after this re-gate |
|---|---|---|
| G75-01 invented integrity rows in real capture | 120 (driver A) | **CLOSED for the live chain and the Monitor**: `GET audit?sessionId=SES-20261010-0025` on lane 2 = `SESSION_CREATED`, `PRECHECK_PASSED`, `RECORDING_STARTED {timeSource: RTC}`, `AUDIO_SOURCE_SWITCHED`, `RECORDING_STOPPED` - no `FRAME_HASH` / `WRITE_VERIFIED` / `TIMESTAMP_CONFIRMED`. **The sealed `audit-session-extract.jsonl` of a new session: NOT PROVEN (no seal)** - the seal e2e of `test/07` asserts it on the rig |
| G75-02 no sending device on the simulated lane | 121 (driver B) | **CLOSED** (section 4.2) |
| G75-03 interrupted seal reads as a plain seal | 121 (B), 123 (C2), 127 (R) | **OPEN - NOT RE-DRIVEN** (lane 2 blocked before the kill check; no interrupted item exists on either lane) |

## 4. Checks

### 4.1 Lane 2 - real capture, FAKE sources: session `SES-20261010-0025` from the TABLET

| Check | Surface | Result | Evidence |
|---|---|---|---|
| New session, form | T | PASS | case number filled by "Fill in the next case number" (`LP/2026/1010-7003`), Saksi, name typed; `SESSION_CREATED` seq 149 |
| G70-04 "Next" announces "busy" while idle | T | PASS (closed) | raw node: `resource-id="session-new-next" content-desc="Next" enabled="true"`, no "busy" |
| Pre-check, four FAKE sources | T, API | PASS | "8 of 8 checked", "All checks passed"; lens / microphone rows "Development source / Test source", "Primary microphone - MIC-01", "Standby microphone - MIC-02"; `PRECHECK_PASSED {warnings: 0, acknowledged: false}` seq 150 |
| Time source wording in the pre-check | T, API | PASS | row "Time Sync, Host system clock, NOTE"; API item `TIME: WARN, HOST_SYSTEM_CLOCK, "Time source: host system clock (no GNSS)"` with outcome `PASS` and no acknowledgement asked |
| Start: connecting | T, API | PASS | API `RECORDING, captureDurable: false` 19:52:21.471 -> `true` 19:52:23.543 (`l2_T_start_poll.log`); `t2_02_connecting.png`: "Connecting cameras...", VIDEO 1 / 2 CONNECTING, both audio cards "CONNECTING" with no meter, no REC, no timer, End Session dimmed with "Nothing is recorded yet: the cameras are still connecting. The session ends by itself if no camera connects."; chip "TIME Host system clock" |
| Recording from the first durable fragment | API, Core log | PASS | `CAPTURE_SYNC_LEVEL ... CAM-01 ... F_FULLFSYNC` 19:52:23.470, CAM-02 19:52:24.968 |
| Checkpoint facts (D209 item 4, D210) | W2, T | PASS | W2 at 00:00:20: "Durable Fragments / 15 fragments saved - last 0 s ago - 18 MB / Camera 1 (CAM-01) - 8 fragments saved - 9.9 MB / Camera 2 (CAM-02) - 7 fragments saved - 8.3 MB"; later 36 / 46 MB, then 57 / 72 MB after the stop (the two files on disk: 36.2 MB + 35.5 MB). T: the same block under the strip (`t2_04_switch_confirm.png`: "20 fragments saved - last 3 s ago - 23.8 MB"). `session/current` over REST carries no `captureCheckpoints` member (`null` in every poll line): the clients get it over the socket |
| Monitor panel in real capture (G75-01, A-2; Z2 item 1) | W2 | PASS | banner "SESSION ACTIVE / Recording. The first fragment is durable on the evidence volume" (no "& SECURE"); panel "Capture ... Passing / Media Protection: Not encrypted during recording. The media is encrypted when the session is sealed / Audit Log Hash Chain SHA-256 / Time Source: Core system clock (UTC+07:00)"; no "Write Speed", no "Evidence Auto-Save", no "GNSS" in the panel. Leftover: G75b-06 |
| Tablet timeline in real capture (A-3) | T | PASS | only "Recording Started" and "Microphone Switched"; no Auto-Save / System Check / Device Health rows (`t2_06_end_dialog.png`) |
| Switch from the tablet (`M5-SW-T`, client + record) | T, API | PASS | dialog "Switch the active microphone to MIC 2? Recording continues. MIC 1 becomes the standby microphone. The switch is written to the audit log."; op 82: seq 1 `MIC-01 PRIMARY 21-50931 START`, seq 2 `MIC-02 STANDBY 50931- MANUAL OPR-001`; W2 followed without a reload: "MIC 1 from 0:00 to 0:50 / MIC 2 from 0:50", timeline "19:53:11, Microphone Switched, MIC 1 to MIC 2" |
| Sending device on the switch row | audit | PASS | seq 152 `AUDIO_SOURCE_SWITCHED`, `deviceId: DEV-0001`, `details.sendingDeviceId: DEV-0001` |
| Sending device on the other rows the tablet sent | audit | **not carried** (G75b-04) | seq 149 `SESSION_CREATED`, 150 `PRECHECK_PASSED`, 151 `RECORDING_STARTED`, 153 `RECORDING_STOPPED`: `deviceId: null`. The tablet's own `AUTH_SUCCESS` (seq 148) carries `DEV-0001` |
| Stop | T, API | PASS up to the hand-over | End Session dialog with the required reason; `RECORDING -> FINALIZING` 19:53:32.9, `stoppedAt 19:53:32.831`, `RECORDING_STOPPED {durationMs: 71497}`; no `capture-worker` / `ffmpeg` process 26 s later; `TRANSCRIBER_SESSION_CLOSED phase COMPLETE` 19:53:40 |
| Sealing states -> sealed item | T, W2, API | **FAIL** (G75b-01) | op 83: `CLOSE_TRACKS: error`, five steps `pending`, `progressPct 0`, `resumed: true`; Core log `SEALER_FAILED ... step CLOSE_TRACKS` attempts 1-4 at 19:53:33, :38, 19:54:08, 19:56:08; then `ALR-000005 CRITICAL SYSTEM {reason: SEAL_BLOCKED, cause: SEALER_FAILED, step: CLOSE_TRACKS}` |
| What the session surfaces say of a blocked seal | T, W2 | **FAIL** (G75b-02) | T (`t2_07a_finalizing_failed.png`, view tree after the alert): "Finalizing evidence / 0% complete / Resumed after restart", step 1 red ("interrupted"), "Sealing runs on the Core and takes a few seconds. This screen closes by itself."; Back does nothing. W2 (`w2_03_seal_blocked.png`): modal "Finalizing evidence / 0% complete / Resumed after restart / Close tracks 1/6: Fault", no sentence, Escape does not close it. The blocked sentence is on the Dashboard bell only (`w2_06_bell_seal_blocked.png`) |
| Tablet Summary, sealed item visible, audit extract of the package | T, W2 | NOT PROVEN | no seal |
| Session from the WEB (create -> ... -> sealed) | W2 | NOT PROVEN | `POST session` on lane 2 answers `409 SESSION_ACTIVE {sessionId: SES-20261010-0025}` |
| Interrupted case: worker kill, naming on web / tablet / API, `stoppedAt`, Duration, no CRITICAL afterwards, `reason: WORKER_KILLED` (G75-03, -08, -10, -05b) | W2, T, API | NOT PROVEN | no session can record on lane 2 |
| B9 on the tablet | T logcat | PARTIAL | cleared 19:51:21, read 19:55 (`logcat_T_session1.txt`). Hand-over Monitor -> Finalizing (19:53:32 on): **0** "Unable to find SurfaceMountingManager" lines. The Summary was never reached. Outside the hand-over: 269 such lines, tag `Reanimated`, level W - 261 at 19:51:45-49 (Session New step 1 -> the pre-check step) and 8 at 19:52:22 (mount of Session Live) - G75b-05. `ReactNativeJS`: 24 lines, all level I. Level-E lines of the app's process: `EGL_emulation` / "EGLConsumer is not attached to an OpenGL ES context" / `Surface` (the emulator's graphics layer; 0 from the app's JS) |

### 4.2 Lane 1 - simulated capture, demo controls (web + phone)

Sessions: S1 `SES-20261010-0025` (API start, switch on the phone, stopped on the phone, sealed
`EV-20261010-0014`), S2 `-0026` (both cameras lost: failed start, closed on the phone), S3 `-0027`
(camera 2 lost: degraded, sealed `EV-20261010-0015`), S4 `-0028` (pre-check only, cancelled).

| Check | Surface | Result | Evidence |
|---|---|---|---|
| **`M5-SW-P` sending device (G75-02)** | audit | **PASS - closed** | S1 seq 119 `AUDIO_SOURCE_SWITCHED {fromInput MIC-01, toInput MIC-02, fromMs 0, toMs 45251, sendingDeviceId DEV-0001}`, `deviceId: DEV-0001`; sent from the phone's dialog (`p1_03_switch_confirm.png`); op 82 two intervals, contiguous |
| F1 connecting, **no meter (G75-04a)** | W1 | PASS - closed | page log `l1_S1_web.log`: 19:59:38.074 "CONNECTING CAMERAS... / Connecting cameras... Recording has not started.", `dBFS` strings 0, meter nodes 0, no REC, Duration 00:00:00, End Session disabled; 19:59:39.085 "SESSION ACTIVE & SECURE", meters back |
| F7 phone Home + bottom bar while connecting (was NOT PROVEN) | P | **PASS** | `p1_01_home_connecting.png`: status card "Connecting cameras... SES-20261010-0025", bottom bar "Connecting cameras... SES-20261010-0025", no REC, no timer. Sessions hub: still NOT PROVEN (1 s window) |
| Demo fault wording, web (G75-09) | W1, API | PASS - closed | `ALR-000005 CRITICAL CAPTURE_FAULT` "The demo control raised a capture fault. The recording is not affected." `{reason: DEMO_CAPTURE_FAULT}`; banner "FAULT / Recording continues - Capture fault"; session stays RECORDING. Leftover: the header reads "CRITICAL / An integrity check failed" (G75b-07) |
| Demo fault wording, phone (G75-07b) | P | PASS - closed | `p1_05_home_demo_capture_fault.png`: "Recording - critical fault / Recording SES-20261010-0025 continues. A critical fault needs action / The demo control raised a capture fault. The recording is not affected." - not "Recording Blocked". Session Live itself shows no fault line, only a badge on the timeline icon (`p1_04_...png`) |
| Clear row wording of the demo fault | audit | PASS | seq 125 `FAULT_CLEARED` "The demo control raised a capture fault. The recording is not affected. - cleared" |
| Strict demo-fault schema (G75-14) | API | PASS - closed | `POST demo/faults {"kind":"CAMERA_LOSS","cameraId":"VIDEO-02"}` -> `422 INVALID_INPUT` |
| Stop from the phone, simulated seal | P, W1, API | PASS | `RECORDING -> STOPPING 20:01:24.075 -> FINALIZING 20:01:25.508 -> SEALED 20:01:30.355`; W1 dialog "Finalizing evidence ... step 1..6 of 6" then "SESSION SEALED / Evidence EV-20261010-0014 sealed - Ready for the next session"; P Summary "SEALED", Duration 00:01:46, 241.6 MB, time source chips "GNSS" (true for the simulated lane) |
| **B9 on the phone, simulated seal** | P logcat | **PASS** | cleared 19:58, read 20:01:50 (`logcat_P_S1.txt`, 4330 lines; flow Home -> Session Live -> switch -> Home -> Session Live -> End -> Finalizing -> Summary): **0** "SurfaceMountingManager" lines, 0 `ReactNativeJS` W / E lines; level-E lines of the app's process are the emulator's: "EGLConsumer is not attached" 193, `EGL_emulation` 22, `ExpoVideo` "Current activity does not support picture-in-picture" 5, `Surface` 5, `MediaCodec` 2 |
| Sending device on the phone's stop | audit | not carried (G75b-04) | S1 seq 127 `RECORDING_STOPPED`, `deviceId: null` |
| F2 failed start, **no meter (G75-04b)**, no timer | W1, API | PASS - closed | `l1_S2_web.log`: 20:02:33.431 "FAULT / No camera connected. Nothing was recorded. / Close session", `dBFS` 0, meters 0, no REC, Duration "-"; audio cards and status panel read "RECORDING DID NOT START"; API `FAULT, captureDurable: false, startedAt: null`; one `FAULT_RAISED {reason NO_CAMERA_CONNECTED, evidenceFiles 0}` seq 136, one alert `ALR-000012` |
| Failed start: timeline and Dashboard (G75-11) | W1 | PASS - closed on the web | Monitor timeline: only "Fault Detected - No camera connected. Nothing was recorded." (no "Recording Started", no code); Dashboard: "No camera connected / Fault / Nothing was recorded.", microphone tiles "RECORDING DID NOT START", Recent Events "Recording did not start". The audit row `RECORDING_STARTED` seq 134 stays (ruled, D207) |
| Failed start on the phone, close (F5) | P | PASS | `p1_09_failed_start.png`: "No camera connected / Nothing was recorded. Check the cameras on Devices, then close this session and start a new one.", Open Devices, Close session, Go to Home; "Close session" -> Home, no recovery screen; history `INCOMPLETE`, `startedAt` null, 0 bytes, no evidence item |
| Demo op 74 never clears a capture-originated fault (G75-06) | API | PASS - closed | `POST demo/faults/clear {kind: CAPTURE_FAULT}` -> 204; `ALR-000012` still `active: true`; no `FAULT_CLEARED` row for it |
| A closed session's fault is a warning (G75-10b) | P, W1 | PASS - closed on the simulated lane | P Home "Attention Needed / 1 check needs attention / No camera connected. Nothing was recorded.", "Start Session" enabled; W1 "ATTENTION / Some checks need attention ... Recording is still possible." |
| Clear row of the no-camera fault (G75-05, first half) | audit | PASS - closed | at S3's start: seq 146 `FAULT_CLEARED` "No camera connected. Nothing was recorded. - cleared" `{reason: NO_CAMERA_CONNECTED}`; `ALR-000012` inactive |
| F3 degraded start: the warning on the Monitor (G75-07a; was NOT PROVEN) | W1 | **PASS** | banner "FAULT / Recording continues - Camera signal lost" plus its own line `sm-banner-degraded`: "Camera 2 (CAM-02) is not connected. The session is recording one camera only. It did not connect in time."; one row seq 147 `CAPTURE_DEVICE_UNREACHABLE {phase SESSION_START, degraded true, deviceId CAM-02}`, `ALR-000017 WARNING` |
| F3 on the phone Home (G75-07b) | P | PASS | `p1_11_home_degraded.png`: "Recording - critical fault / Recording SES-20261010-0027 continues ... / Camera 2 offline", Camera 1/2, bar "Recording 00:00:05" |
| The warning ends with its session; next pre-check PASS (G75-07c, d) | API | PASS - closed | after S3 sealed: `ALR-000017 active: false`; camera fault cleared; S4 pre-check `ARMED, PASS`, no WARN item, no acknowledgement |

### 4.3 Spot-check of what passed at the first gate (one item per group)

| Group of the first gate | Item re-seen now | Result |
|---|---|---|
| 4.1 create / pre-check / connecting / durable | tablet session above | PASS |
| 4.1 switch, intervals, one row per switch | tablet switch, op 82, seq 152 | PASS |
| 4.1 stop without a leftover process | `pgrep` empty after the stop | PASS |
| 4.1 holder rule; interrupted case against cap A.3; the fault sentence of a kill | - | NOT RE-SEEN (lane 2 blocked) |
| 4.2 F1, F2, F5, F3 Core, F8 wording, Dashboard failed start | S1-S3 above | PASS |
| 4.2 F4 stop refused while connecting; R74-01 two failed starts; R74-02 three switches | - | not re-driven (one item per group was taken) |

### 4.4 Regression / quality checks of the row (mapped, not re-run)

| Check | Result | Evidence |
|---|---|---|
| `M5-RG-*` | PASS by `test/08_precommit_wave_h.md` | shared 2546, core-server unit 6467, db 2406 (7 skipped), core-web 2001, mobile 2610, transcriber 561 (3 skipped), mock-core 19 - 0 failed, on the tree committed as `74fd1f1` |
| `M5-QA-1` | PASS by the same file | typecheck 0 errors and lint clean in 7 workspaces (1 eslint warning in `apps/mobile/src/runtime/log.test.ts`) |
| Tree unchanged since | PASS | `git status --short` outside `docs/`: 0 lines; `git diff --stat HEAD -- apps packages scripts`: empty (read at 20:06) |
| `M5-GAP-1`, `M5-WARN-1`, `M5-SRC-REC-1`, `M5-NODEV-C-1` real-worker half | by record, as at the first gate | not re-run; the worker was not changed by wave H (D202) |
| `M5-SEC-SRC-1`; file-analyser assertions of `M5-SW-*` on a product recording | NOT PROVEN | no means added by wave H; no sealed recording of this run |

## 5. Which first-gate findings are closed

| Finding | State | Where proven |
|---|---|---|
| G75-01 MAJOR | closed for the live audit chain and both Monitors; the package extract of a new seal NOT PROVEN | 4.1 |
| G75-02 MAJOR | **closed** | 4.2 |
| G75-03 MAJOR | **OPEN - not re-driven** | - |
| G75-04 | closed (web, connecting and failed start, Monitor and Dashboard) on lane 1; the tablet's connecting cards on lane 2. The web status panel while connecting on LANE 2 was not logged | 4.1, 4.2 |
| G75-05 | first half closed; second half (`WORKER_KILLED` on the crash alert) not re-driven | 4.2 |
| G75-06, G75-07 (a-d), G75-09, G75-14 | closed | 4.2 |
| G75-08 | not re-driven | - |
| G75-10 | (b) closed on the simulated lane; (a) the clear at an interrupted seal not re-driven | 4.2 |
| G75-11 | closed on the web; the audit row stays by ruling | 4.2 |
| G75-12 one-frame mixtures | still there, NOTE: "SESSION SETUP / Connecting cameras..." and "CONNECTING CAMERAS... / Recording in progress" for about 90 ms each (`l1_S1_web.log`) | - |
| G75-13 | G70-04 closed; the stock picture gone from the tablet's real-capture surfaces ("No preview"); the device on `RECORDING_STOPPED` still missing -> G75b-04 | 4.1 |
| G75-15 | not touched | - |

## 6. Findings of this re-gate

| ID | Severity | What | Steps / evidence | Spec / ruling |
|---|---|---|---|---|
| **G75b-01** | **MAJOR (blocks the gate)** | A real-capture session on lane 2 cannot be sealed, and the lane cannot be restored with the project's tools. **Seen:** `SEALER_FAILED` at `CLOSE_TRACKS` x5; alert "The session key could not be used"; `lane.sh stop 2` + `start 2` -> `SEALING_SESSION_BLOCKED` again; `lane.sh reset 2` -> exit 1, "refused: real sealed evidence exists and a reset would destroy it (RESET_BLOCKED_REAL_EVIDENCE) ... 0 REAL package(s) and 1 unreadable package director(y/ies) [SESSION-SES-20261010-0025]. Nothing was changed." **Cause - a hypothesis from a directory listing and the code, not from a log line (the log names no cause):** the lane's key store `.data/credential-store/session-keys-5eb7.../` holds `KID-SES-20261010-0025.key` dated 13:29 - the key of the FIRST gate's session B, made by the build before wave H, with no binding file (the stores written by this build hold `KID-...key` + `KID-...blob`). Session numbers start again after a reset, so tonight's session got the same id; `sealing-host/session-key.ts` finds a key it owns whose binding is not this session's and throws `SESSION_KEY_NOT_OF_SESSION` -> `SEALER_FAILED`. `KID-SES-20261010-0024.key` (13:26) lies beside it. The reset of 19:04 (this build) left both: it destroys the keys of the sessions it clears, and those sessions had been cleared by earlier resets of the older build | lane 2, any session whose id meets an old key; `.cache/gates/75b/reset_2.log`, `start_2.log`, Core log lines quoted in 4.1 | D203 ruling 6 accepted "a seal in flight across the upgrade fails by name until a reset" - here a reset had been run and did not clear it, and after the failed seal the reset itself is refused. Three product points for the owner: (1) a reset leaves session keys of sessions it no longer knows while it re-issues their ids; (2) `SEALER_FAILED` is logged with no cause code (the alert has the sentence, the log line has `step`, `attempt`, `retriable` only); (3) a blocked seal + the real-evidence guard = no exit on a development lane |
| G75b-02 | MAJOR for the surface (flow 4 "visible states"), MINOR if a blocked seal is ruled out of M5 | A blocked seal is not stated on the session surfaces. Tablet Finalizing and the web seal dialog keep "Finalizing evidence / 0% complete / **Resumed after restart**" (no restart had happened: `resumed: true` is set by the retry) and, on the tablet, "Sealing ... takes a few seconds. This screen closes by itself."; neither shows the alert's sentence nor the retry notice (`sealRetryingNotice` / `sealWaitingNotice` exist in `sealing/pipeline/way-out.ts`; op 83's steps carry no text member); the tablet screen cannot be left (Back), the web dialog cannot be closed (Escape) | 19:54-19:57, `t2_07a_finalizing_failed.png`, `w2_03_seal_blocked.png`, view tree of the tablet | D186 (1): a blocked seal "must be VISIBLE"; ux flow 4 |
| G75b-03 | MINOR (wording in the audit chain of a real-capture Core) | A graceful `lane.sh stop 2` while the session was FINALIZING wrote `FAULT_RAISED` "Power fail detected - recovery marker written" `{kind: POWER_FAIL, evt: EVT-21, fromState: FINALIZING}` with the session id (seq 155, `deviceId: DEMS-IR-01`) and a CRITICAL alert `ALR-000006`; the start wrote `TABLET_LINK_CHANGED` "Tablet control offline - recording continues" (seq 156, nothing was recording) and `RECOVERY_STARTED {faultKind: POWER_FAIL}` (seq 158). No power failed; these rows would be in the session's audit extract | lane 2 audit seq 155-158 | wording rule of the fix brief: a sentence states what the Core knows; ruling of G75-01 |
| G75b-04 | MINOR (ruling asked) | Of the rows a paired device sent, only `AUDIO_SOURCE_SWITCHED` (and the sign-in) names the device. `SESSION_CREATED`, `PRECHECK_PASSED`, `RECORDING_STARTED`, `RECORDING_STOPPED` sent from the tablet (lane 2 seq 149-151, 153) and `RECORDING_STOPPED` from the phone (lane 1 seq 127) have `deviceId: null` | audit lists | row 75 names the switch row only; G70-05 was closed for the selector rows; G75-13 left the stop row as a NOTE |
| G75b-05 | MINOR | B9 in the wide reading fails outside the hand-over: 269 `Reanimated` warnings "Unable to find SurfaceMountingManager for tag" on the tablet between Session New step 1 and the pre-check step (261 in 5 s) and at the mount of Session Live (8). The hand-over itself: 0. The phone on lane 1: 0 in the whole flow (it entered Session Live from Home, not through Session New) | `logcat_T_session1.txt` | driver B's criterion is "from the stop to the Summary = 0" (met as far as the flow went); the task's wording is "zero app error lines" |
| G75b-06 | MINOR | Time and storage claims a real-capture Core cannot make remain outside the session surfaces: web Dashboard strip "GNSS / Time - RTC holdover" and card "GNSS / Time Sync - RTC HOLDOVER", tablet Home chip "GNSS / Time: RTC", Dashboard "TPM / Secure Boot ACTIVE - TPM 2.0 Verified"; Monitor "STORAGE DURING SESSION - Session Size 47 MB" at 00:00:20 while the durable fragments were 18 MB | `w2_06_bell_seal_blocked.png`, `t2_00_home.png`, W2 text at 19:52:42 | D210 lists the Home / Dashboard / header time chips as left open; "holdover" says a synchronised clock was lost, which is not the case for a host clock |
| G75b-07 | MINOR | The web header reads "CRITICAL / An integrity check failed" for any critical alert: a demo capture fault (lane 1) and a blocked seal + "power fail" (lane 2). No integrity check failed in either case | W1 at 20:00, `w2_06_bell_seal_blocked.png` | G75-10 named this sentence; fixed for the closed-session case only |
| G75b-08 | NOTE | Tablet and web timelines say "Recording Started" at the instant of the start command, while the screen still reads "Connecting cameras..." (`t2_02_connecting.png`) | - | cosmetic beside 8e.2 |
| G75b-09 | NOTE | Tablet Home "Recent Sessions" on lane 2 still draws the room picture as the row thumbnail (`t2_00_home.png`) - gate 70b's G70b-04 | - | - |
| G75b-10 | NOTE | On the simulated lane a failed start is followed by `TIMESTAMP_CONFIRMED` "Secure timestamp confirmed - GNSS" (lane 1 seq 135) | - | simulator only |
| G75b-11 | NOTE (environment) | The Core's API session of the helper expired between two calls about 10 minutes apart (seq 154 `AUTH_EXPIRED ... 15 min idle` for a session used 6 minutes before) | - | not examined |

## 7. Skipped / user-attended

| Item | Reason |
|---|---|
| Biometric sign-in | skipped by the user's instruction (D151); the offer was answered "Not now" once on each device; never passed |
| `M5-SEC-PRIV-2-W / -T / -P`, the Start Recording notice, `M5-LOCAL-E2E-1` local half, `M5-LOCAL-CLAP-1` | user-attended, not run; no local selector was set |
| Camera search / stub / `CAM-04` | not part of this gate; not pressed, not assigned |

## 8. Not covered, and why

1. Everything that needs a second real-capture session or a seal on lane 2 (list B-2, B-3 of section 1): the lane is blocked by G75b-01.
2. The sealed package's audit extract and manifest time facts of a NEW session (gate 89's re-gate reads them; the rig proof is `test/07`).
3. F6 (MB-06), the durable-fault recovery control, the phone Sessions hub while connecting, `M5-SEC-SRC-1`, the file analyser on a product recording, advisories live: no means, as at the first gate.
4. A situation-C start on REAL capture: a lane cannot stop a generated source.
5. The plan's tracking table and `implementation/99_implementation_report.md`: the task asked for this one file.

## 9. Screenshots (`.cache/gates/75b/`)

Read by me:

| File | Shows |
|---|---|
| `t2_00_home.png` | tablet Home on lane 2 with the "Enable biometric sign-in on this tablet?" offer over it; "No preview" camera tiles, room thumbnails in Recent Sessions |
| `t2_02_connecting.png` | tablet Session Live: "Connecting cameras...", both audio cards "CONNECTING", End Session dimmed with its sentence, chip "TIME Host system clock" |
| `t2_04_switch_confirm.png` | tablet dialog "Switch the active microphone to MIC 2?"; behind it "Durable Fragments 20 fragments saved - last 3 s ago - 23.8 MB" |
| `t2_06_end_dialog.png` | tablet "End Session?" with the required reason; timeline with two rows; 45 fragments / 57.6 MB |
| `t2_07a_finalizing_failed.png` | tablet "Finalizing evidence / 0% complete / Resumed after restart", step 1 red, "This screen closes by itself.", EV-20261010-0014, length 00:01:11 |
| `w2_03_seal_blocked.png` | web lane 2 modal "Finalizing evidence", 0 %, "Resumed after restart", "Close tracks" red with a cross, five grey steps |
| `w2_06_bell_seal_blocked.png` | web lane 2 Dashboard after the restart: SYSTEM CRITICAL 2 ISSUES, bell with "Power fail detected - recovery marker written" and the whole blocked-seal sentence, header "An integrity check failed", "Finalizing evidence Step 1 of 6" |
| `p1_01_home_connecting.png` | phone Home: "Connecting cameras... SES-20261010-0025" in the status card and the bottom bar |
| `p1_02_session_live.png` | phone Session Live on lane 1: Recording 00:00:26, MIC 1 Active, room picture "LIVE / DEMO" |
| `p1_03_switch_confirm.png` | phone dialog "Switch the active microphone to MIC 2?" |
| `p1_04_demo_capture_fault_live.png` | phone Session Live after the switch (MIC 2 Active) during the demo capture fault: no fault line, badge 3 on the timeline icon |
| `p1_05_home_demo_capture_fault.png` | phone Home "Recording - critical fault" with the demo-fault sentence, bar "Recording 00:01:21" |
| `p1_06_end_dialog.png` | phone "End Session?" with the required reason |
| `p1_09_failed_start.png` | phone failed-start notice "No camera connected", Open Devices, Close session, Go to Home |
| `p1_11_home_degraded.png` | phone Home in S3: "Recording - critical fault ... Camera 2 offline", Camera 1/2 |

Taken, NOT read as pictures (their text was read from the DOM or the view tree): `w2_00_dashboard`,
`w2_01_monitor_recording_tablet_session`, `w2_02_seal_failed_monitor`, `w2_04_seal_blocked_bell`,
`w2_05_dashboard_seal_blocked`, `t2_01_precheck`, `t2_03_recording`, `t2_05_after_switch`,
`t2_07_seal_blocked`, `t2_08_seal_blocked_after_back`, `p1_00_after_login`, `p1_07_finalizing`,
`p1_08_summary`, `p1_10_home_after_failed_start`, `w1_01`..`w1_04`, and every `seq_*` file.

## 10. Environment as left - what later gates must know

| Item | State |
|---|---|
| **Lane 2 is BLOCKED** | RUNNING, **PID 15110, restarted by me at 19:57** (`lane.sh stop 2`, a REFUSED `reset 2` that changed nothing, `start 2 --with-camera-stub --speech-mic`, not piped; output `.cache/gates/75b/start_2.log`, 0600). `SES-20261010-0025` is `FINALIZING` with `CLOSE_TRACKS: error`; `EV-20261010-0014` is reserved for it, not sealed. **No session can be created on lane 2** (`409 SESSION_ACTIVE`). Two CRITICAL alerts active: `ALR-000005` (seal blocked), `ALR-000006` (the "power fail" of my stop). Every start of the lane tries the seal again and fails |
| What restores lane 2 - NOT done by me, each needs the controller's or the user's word | (a) take the old key `KID-SES-20261010-0025.key` (13:29) out of `.data/credential-store/session-keys-5eb7d694.../`, then restart: by the code the sealer then makes a new key bound to this session and the seal should complete - a change to a key store, and a rename / delete under `.data/`; or (b) remove the unsealed folder `SESSION-SES-20261010-0025` so that `reset 2` passes its guard - destroys the recording (generated test pictures, 72 MB). In both cases `KID-SES-20261010-0024.key` (13:26) is still there: a lane whose next session is numbered `-0024` fails the same way. I chose neither: the first goes around a fail-closed check of the key store, the second around the reset's evidence guard |
| Lane 2 selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY - unchanged, but `locked: true` while the session is open. `CAM-04` untouched, unassigned |
| Lane 2 stub | new ports at this start: discovery UDP 60425, device TCP 56497, RTSP TCP 56498; **new fixture account** in `.locks/camera-stub.lane2.fixture` (gate 70b's values are dead); preset `NORMAL` |
| Lane 2 data | audit head about seq 162 (gate 70b left 148): one tablet sign-in, the session's five rows, `AUTH_EXPIRED`, seq 155-158 of the restart, helper sign-ins / sign-outs. One unsealed recording folder (two camera files, 36.2 + 35.5 MB, FAKE sources). No sealed item was added |
| Lane 1 | RUNNING (PID 3547, never restarted). New: sealed (simulated) `EV-20261010-0014` = `SES-20261010-0025`, `EV-20261010-0015` = `SES-20261010-0027` (camera 2 lost); `SES-20261010-0026` INCOMPLETE (failed start, no item); `SES-20261010-0028` cancelled from ARMED. No session open, `activeFaults []`, 0 active alerts (`ALR-000005` .. `ALR-000017` all resolved). Audit head about seq 165 |
| Devices | both relaunched, on Login, "Core online", "paired as DEV-0001", reverse rules intact (4421 / 4422). No re-pairing, no lock change, no reboot, biometric not enabled |
| Sessions, processes | the four helper sessions signed out (204), jars removed; both headless browsers stopped; no `capture-worker` / `ffmpeg` / `whisper` process; web dev servers, Metro, PostgreSQL untouched |
| Tooling notes | every `curl` / `adb` / `lane.sh` call needs the sandbox off; `uiautomator dump` fails on Session Live and on Home while recording (use screenshots); in zsh an unquoted variable holding `-H name:value` is ONE argument - write the header out |

---
*Generated: 2026-10-10 20:15 WIB*
