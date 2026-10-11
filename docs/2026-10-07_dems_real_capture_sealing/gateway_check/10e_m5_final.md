---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 75 (M5) FINAL RE-CHECK after fix wave L
date: 2026-10-11
agent: verifier (independent +1; brief `delegation_progress/gate_brief_wave_g.md`; environment `initialization/09_gate_environment_wave_l.md` with notes 06 / 08)
narrative_tier: 2
tree: commit 7b1aded (`git rev-parse --short HEAD` at 13:15; `git status --short` outside `docs/`: empty; no product or test file changed by me)
builds_on: gateway_check/10_m5_gate.md (FAIL), 10b (FAIL), 10c (FAIL, narrowly), 10d_m5_m6_recheck.md (PASS WITH CONDITIONS; G75d-01, -02 held must-fix by D228)
status: needs-review
verdict_m5: PASS WITH CONDITIONS
---

# 10e - Final re-check of row 75 (M5)

Only the items of the task, one run each - with ONE exception stated in section 7 (a): item 5 was
driven twice because my pictures of the first run were stale. Nothing was played, on a device or
in the browser (browsers with `--mute-audio`, no player opened). No local device (`CAM-03` /
`MIC-03`) was selected, pre-checked or started; no attendance variable set; the fingerprint sensor
never touched (the biometric offer answered "Not now" three times: tablet 1, phone 2 - skipped by
the user's instruction, never passed). The camera stub was not used and its fixture file not read.
No fixture account, pairing code, password, token or key material is in this file or in a file
name. Lane 2 was never reset or restarted; lane 1 not touched. Every `curl` / `adb` / `lane.sh`
call ran outside the command sandbox. Evidence under the git-ignored `.cache/gates/75e/`.

Surfaces: **W2** web lane 2 (5177), headless Chromium over CDP with the helper's cookie (one page
as the supervisor, one as the technician and later the investigator), a page sampler every 90 ms;
**T** tablet `emulator-5556` = `DEV-0001` (signed in as the investigator), **P** phone
`emulator-5554` = `DEV-0002` (as the supervisor) - `adb` taps, `uiautomator`, screenshots, one
screen recording; **API** = lane 2's Core through the web origin; **LOG** = lane 2's Core log
(copied to `core_lane2.log`), the two logcats.

Run window 13:15 - 13:52 WIB. Host load 4.0 at the start, 2.6 at the end.

## 1. Verdict for M5: PASS WITH CONDITIONS

Both must-fix findings of D228 are closed, driven live on `7b1aded`:

- **G75d-02 CLOSED.** A blocked seal names "Retry sealing" on the web console's Session Monitor and
  who presses it; the control is on the Monitor banner and in the seal dialog for an investigator
  and a supervisor, not for a technician (who reads who can); tablet and phone say the same, say
  they have no retry control and offer "Go to Home". After `release` the session stayed blocked
  until "Retry sealing" was pressed IN THE WEB UI (banner, as the investigator): sealed in 1.4 s,
  alert resolved, every surface normal, verify PASS 15 of 15.
- **G75d-01 CLOSED.** An UNSEALABLE notice stays active and is stated as an OPEN NOTICE that does
  not block recording on the web pill, the Dashboard ring, tablet Home and phone Home; a healthy
  session recorded beside it shows "SESSION ACTIVE" and seals; a technician's acknowledgement
  leaves it active; the supervisor's "Acknowledge and close" on the PHONE's bell resolved it with
  one `FAULT_CLEARED` row naming the notice's session, the operator and `DEV-0002`; all surfaces
  back to normal with no restart.

G75d-03, -04, -05, -07 are closed; G75d-06 is closed on the surfaces the task names with one
remainder (G75e-02); G75d-08 is closed on the tablet. No BLOCKER and no MAJOR is open by my rating.

Conditions (each with an owner):

| # | Condition | Finding | Owner |
|---|---|---|---|
| C1 | Phone Home: the Camera tile is drawn EMPTY while a session records (two sessions) | G75e-01 | coder-execution (mobile), wave M |
| C2 | Web Session New step 2 still labels the meters "MIC 1 - Interviewer" / "MIC 2 - Subject" on a real-capture Core (dataset roles; the primary is not named) | G75e-02 | coder-execution (web), wave M |
| C3 | After a worker-killed session the Core writes an error-level `CAPTURE_FAULT` naming the PREVIOUS (sealed) session at the next session's healthy start (log only: no alert, no audit row) | G75e-03 | coder-execution (core-server), wave M |
| C4 | Web Dashboard ring while a session records beside an open notice: "SECURE • HEALTHY • RECORDING" - the notice is on the pill only | G75e-04 | controller (ruling: is the ring under D228 (2) while recording?) |
| C5 | Still NOT PROVEN live, carried from 10d: the start-refusal sentence (`SESSION_KEY_NOT_OF_SESSION` at start), G75c-06 on lane 1, tablet Settings > About TPM row; new: the PHONE's recovery screen during the Core's interrupted seal has no picture (section 3.5) | - | controller: accept the tests or schedule |
| C6 | Known, not re-reported: G75c-03 (cause words on the interrupted notice, next task), G70d-02 / -03 / -04 / -06, mount warnings (ruled limit D224 (2); counts in 3.7) | - | as ruled |

## 2. Start state (13:15)

| Item | Read |
|---|---|
| Lanes | 1 RUNNING PID 13944, 2 RUNNING PID 13991 (REAL_DEVELOPMENT), health ok, `ws.clients 2`; seal rig OFF |
| Lane 2 | `session/current` null; selector `CAM-01` / `CAM-02` `H264_720P30`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`; 37 alerts, none active; audit chain `ok`, 906 rows |
| Devices | both awake, no keyguard, on Login, both fields showing only their hint, "Core online", "paired as DEV-0001" / "DEV-0002"; reverse rules `tcp:8081 -> 8081`, `tcp:4420 -> 4422` on both |

## 3. Items

### 3.0 Items table

| Item | Surface | Result |
|---|---|---|
| 1 blocked after the automatic retries; attempts and waits | LOG, W2, T, P | PASS (4 attempts: t+0, +5 s, +35 s, +155 s) |
| 1 the Core's alert sentence names "Retry sealing", where, and who | API | PASS |
| 1 retry control for investigator / supervisor, banner + dialog | W2 | PASS |
| 1 no control for a technician, who reads who can | W2 | PASS |
| 1 tablet / phone Finalizing say the same, way to Home | T, P | PASS |
| 1 release -> "Retry sealing" pressed in the web UI -> sealed, alert resolved, surfaces normal, verify PASS | W2, API, T, P | PASS (15 of 15) |
| 1 rig `status` OFF | lane | PASS |
| 2 UNSEALABLE end, notice ACTIVE | API, LOG | PASS |
| 2 OPEN NOTICE on web pill, Dashboard ring, tablet Home, phone Home | W2, T, P | PASS |
| 2 healthy session beside the notice: "SESSION ACTIVE", seals | W2, API | PASS (ring while recording: G75e-04) |
| 2 technician's acknowledgement recorded, notice stays active | API | PASS (recorded on the alert only: G75e-07) |
| 2 supervisor acknowledges on the PHONE's bell: resolved, one `FAULT_CLEARED` with session, operator, device | P, API | PASS |
| 2 surfaces back to normal, no restart | W2, T, P | PASS |
| 2 rig released, OFF; quarantine folder exists | lane, FILE | PASS |
| 3 G75d-03 Dashboard ring while blocked | W2 | PASS |
| 3 G75d-04 dialog at the unsealable end | W2 | PASS |
| 4 G75d-05 Monitor's profile | W2 | PASS |
| 4 G75d-06 generated sources named as generated: Dashboard, Monitor, Devices, selector | W2 | PASS (Session New step 2: G75e-02) |
| 4 G75d-07 chip on every model block; "3/3" beside "7/7" | W2 | PASS |
| 5 G75d-08 tablet during the Core's interrupted seal | T | PASS (second run, by screen recording) |
| 5 the same on the phone | P | NOT PROVEN by picture (route log + the Finalizing frame only) |
| 5 "interrupted" on web / tablet / phone / op 40 | W2, T, P, API | PASS |
| 6 after a sealed session, selector change named for the NEXT recording; put back | W2 | PASS |
| 7 B9 zero app ERROR lines | logcat T, P | PASS (library lines listed) |
| 7 Core log: no error line through the healthy seals | LOG | PASS for the seals; one error line at a healthy START (G75e-03) |

### 3.1 Item 1 - G75d-02: `SES-20261011-0051` -> `EV-20261011-0038`

`seal-rig 2 blocked` 13:16:36. Session created, pre-checked (8 of 8) and started ON THE TABLET
(audit seq 909-911 carry `DEV-0001`), `RECORDING` 13:18:22, stopped through the API with a reason
at 13:19:07.7 (45.4 s).

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Attempts and waits | LOG | PASS | `SEALER_FAILED` `CLOSE_TRACKS` attempt 1 at 13:19:08.012, attempt 2 at 13:19:13.136 (+5 s), attempt 3 at 13:19:43.172 (+30 s), attempt 4 at 13:21:43.223 (+120 s): the first run and three automatic retries; warn `LANE_SEAL_RIG_BOUND` `mode BLOCKED` at 13:19:08.001. W2 sampler: "Sealing is being retried (retry 1 of 3, in 5 s) / (retry 2 of 3, in 30 s) / (retry 3 of 3, in 120 s). The Core's key store cannot be used: the seal stopped and can be tried again." |
| Blocked | API, W2 | PASS | 13:21:43.3 banner "SEALING BLOCKED"; `ALR-000072` CRITICAL `{reason SEAL_BLOCKED, cause SEALER_FAILED, step CLOSE_TRACKS, detail SESSION_KEY_STORE_UNAVAILABLE}` active; session stays `FINALIZING`; op 83 `resumed false` |
| The alert sentence | API | PASS | "Sealing of this session is blocked. The Core's key store cannot be used: the seal stopped and can be tried again. Check the Core's key store (the credential store folder of the data directory: a private folder the server user can write), then retry the seal: an investigator or a supervisor presses "Retry sealing" on the Session Monitor of the web console, or the Core is restarted. The Core records no new session until this one is sealed." No "start recovery" |
| Supervisor: dialog + banner | W2 | PASS | dialog buttons `["Retry sealing", "Close"]`, text "Sealing stopped after 3 automatic retries. / An investigator or a supervisor can retry. When the cause is resolved, retry the seal here." (`w2_1_02`); after "Close": banner button `sm-seal-retry-banner` "Retry sealing" (`w2_1_05`) |
| Investigator: dialog + banner | W2 | PASS | header "AKP Budi Santoso / CRITICAL / Sealing is blocked"; buttons `sm-seal-retry-banner` and `sm-seal-retry-dialog` |
| Technician: no control, reads who can | W2 | PASS | header "Rina Wijaya"; buttons matching "retry" on the page: `[]`; banner and dialog read "Sealing stopped after 3 automatic retries. An investigator or a supervisor can retry." (`w2_1_03`) |
| Tablet / phone Finalizing | T, P | PASS | `t_1_03`, `p_1_03`: "Sealing is blocked", the Core's sentence as written, "Sealing stopped after 3 automatic retries: the Core now waits and does not run it again by itself.", "A technician or the administrator of the Core has to resolve the cause on the Core.", "This device has no retry control: the retry is pressed on the web console.", "You can leave this screen. ...", "Go to Home"; "Go to Home" pressed on both -> Home "Sealing blocked", ring CRITICAL, "Sealing blocked: view", the new-session reason (`t_1_04`, `p_1_04`) |
| Release | lane, API | PASS | `seal-rig 2 release` 13:22:51 ("OFF", read twice); 23 s later `session/current` still `FINALIZING` (no self-retry, as designed) |
| "Retry sealing" in the web UI | W2, API | PASS | pressed on the Monitor BANNER as the investigator at 13:23:14: network `POST session/SES-20261011-0051/recover 202`, toast "Sealing is run again."; `SEALED` `sealedAt` 13:23:15.535; seq 913 `RECOVERY_STARTED` "Sealing of session ... is run again on demand (SEALER_FAILED)" `{reason SEAL_RETRY}` actor `OPR-001`, seq 914 `EVIDENCE_SEALED`; log `SEALING_RETRY_ON_DEMAND` (info) |
| Back to normal | W2, T, P, API | PASS | `ALR-000072` `active false`, `resolvedAt` 13:23:15.7; supervisor's page: banner "SESSION SEALED", header "SECURE / All systems operational" at 13:23:15.78; tablet and phone moved to the session's Summary by themselves ("SEALED", "Sealed 247.8 s after the recording ended", `t_1_05`), then Home "Ready for Recording"; no "Resumed after restart" in any sampler line |
| Verify | API | PASS | op 41 on `EV-20261011-0038`: `overall PASS`, 15 of 15, `manifestOk`, `signatureOk` true |
| Rig | lane | PASS | `status`: OFF |

### 3.2 Item 2 - G75d-01: `SES-20261011-0052` (no item)

`seal-rig 2 unsealable` 13:24:17; session through the API (investigator), `RECORDING` 13:24:23.5,
stopped 13:25:08.6 (45.1 s).

| Check | Surface | Result | Evidence |
|---|---|---|---|
| The end | LOG, API | PASS | `SEALER_FAILED` attempts 1, 2, 3 at 13:25:08.8, 13:25:14.1, 13:25:44.1; `SEALING_SESSION_UNSEALABLE` 13:25:44.166; seq 921 `SESSION_INCOMPLETE` `{reason UNSEALABLE, cause SESSION_KEY_NOT_OF_SESSION, quarantinedFiles 5}`; `session/current` null, op 83 404 |
| The notice is active | API | PASS | `ALR-000075` CRITICAL `{reason UNSEALABLE, cause SESSION_KEY_NOT_OF_SESSION, sessionId SES-20261011-0052}`, `active true` |
| Quarantine (name + size only) | FILE | PASS | `.data/media/dems_lane_2/sessions/.quarantine/SES-20261011-0052/`, 49,468 KiB, `drwx------`; no `SESSION-SES-20261011-0052` in the store. Nothing in it was opened |
| Web pill | W2 | PASS | "OPEN NOTICE / 1 recording could not be sealed" from the end of the session until the acknowledgement (every sampler line of the next session carries it) |
| Dashboard ring | W2 | PASS | "SYSTEM ATTENTION / OPEN NOTICE • RECORDING NOT BLOCKED / A recording could not be sealed (SES-20261011-0052). Its files were kept in quarantine on the Core. Recording is not blocked." with "Start New Session" offered (`w2_2_02`) |
| Tablet Home (investigator) | T | PASS | header chip "OPEN NOTICE", ring "READY" with "OPEN NOTICE • RECORDING NOT BLOCKED" inside, "Ready for Recording · open notice", the sentence, "A supervisor acknowledges this notice to close it.", bell "1", "Start Session" (`t_2_03`) |
| Phone Home (supervisor) | P | PASS | amber ring, "Ready for Recording · open notice", the sentence, "Acknowledge this notice to close it: open the alerts (the bell).", bell "1" (`p_2_03`) |
| Tablet / phone at the end of the session they followed | T, P | PASS | "Session SES-20261011-0052 / This recording could not be sealed. Its files were kept in quarantine on the Core. / Cause code: SESSION_KEY_NOT_OF_SESSION / Recording is not blocked: a new session can be started." + who closes it, above "No finalization in progress / Go to Home" (`t_2_02`, `p_2_02`). No code in brackets |
| A NEW healthy session beside the notice | W2, API | PASS | `SES-20261011-0053` created, pre-checked and started in the WEB UI as the supervisor (form, "Next", "Next", "Start Recording"); Monitor banner "SESSION ACTIVE / Recording. The first fragment is durable on the evidence volume", pill "OPEN NOTICE" (`w2_2_04`); 0 sampler lines with a fault or "could not be sealed" in the banner; stopped at 45.1 s, sealed 13:28:15.4 -> `EV-20261011-0040`, verify PASS 15 of 15; no error-level log line from its start to its seal |
| Technician acknowledges | API | PASS | op 70 with the technician's helper session: 204; alert `active true, acknowledged true, resolvedAt null`; no audit row (G75e-07). The investigator's web bell reads the plain sentence, "Session SES-20261011-0052 · Cause code: ...", "A supervisor acknowledges this notice to close it." and has no button (`w2_2_05`) |
| Supervisor acknowledges on the PHONE's bell | P, API | PASS | bell popover: "Session SES-20261011-0052: This recording could not be sealed. Its files were kept in quarantine on the Core.", "Cause code: ...", "Acknowledge and close" (`p_2_05`) - shown for a notice the technician had already acknowledged; pressed 13:29:05: alert `active false, acknowledged true, resolvedAt` 13:29:05.6; ONE row seq 929 `FAULT_CLEARED` `sessionId SES-20261011-0052`, actor `OPR-002`, `deviceId DEV-0002`, `{reason UNSEALABLE, cause ..., alertId ALR-000075, operationId acknowledgeAlert}` |
| Back to normal, no restart | W2, T, P | PASS | phone "Ready for Recording / All systems operational", bell without a count, "No new alerts" (`p_2_06`); tablet chip "READY", "Ready for Recording"; web pill "SECURE / All systems operational", ring "READY / OPERATIONAL • NO FAULT REPORTED"; 0 active alerts. The Core ran on PID 13991 throughout |
| Rig | lane | PASS | released at 13:26 right after the unsealable end (before the healthy session - earlier than the task's order, on purpose); `status` OFF then and at the end |

Which bell: the web's was proven by driver L-W and the tablet's by driver L-M; this run proves the
**PHONE's** independently.

### 3.3 Item 3 - G75d-03, G75d-04

| Check | Surface | Result | Evidence |
|---|---|---|---|
| G75d-03 | W2 | PASS | while blocked: ring "SYSTEM CRITICAL / NO NEW SESSION UNTIL IT IS SEALED / Sealing of session SES-20261011-0051 is blocked. The Core records no new session until it is sealed. The recording is kept on the Core."; card "Sealing blocked" with "Open Session Monitor" only (`w2_1_04`) |
| G75d-04 | W2 | PASS | the dialog at the unsealable end, whole text: "Recording not sealed / Session SES-20261011-0052 / This recording could not be sealed. Its files were kept in quarantine on the Core. / Cause code: SESSION_KEY_NOT_OF_SESSION / Close" (`w2_2_01`). No percentage, no steps, no "Resumed after restart", no code in brackets. The retry sentences before it: "Sealing is being retried (retry n of 3, in ...). A session key of an earlier session with this session number is in the Core's key store. A session key is never reused." - no "cannot be sealed" |

### 3.4 Item 4 - G75d-05, -06, -07 on lane 2's web

| Check | Result | Evidence |
|---|---|---|
| G75d-05 | PASS | Monitor > Session Details: "Configured profile / VIDEO-01: H264_720P30 · VIDEO-02: H264_720P30" during the recording of `-0051`, while blocked, and on the sealed `-0055`. "Standard (1080p / 25 fps)" is on the Session New form and its Ready step only (the form's choice, ruled out of this task) |
| G75d-06 Dashboard, Monitor, Devices, selector | PASS | "Camera 1 · CAM-01 · Generated test source" on the Dashboard tiles, the Monitor feed and status tiles, the Devices tiles; selector lines "VIDEO-01 · CAM-01 · Generated test source · Profile H264_720P30", options "CAM-0n · Generated test source · Development source", "MIC-01 · Generated test source"; Monitor and Dashboard "MIC 1" / "MIC 2"; Devices audio cards "MIC 1 / MIC-01 · AUDIO-01" with no gain / phantom row. 0 x "Dual-lens", "UM-1", "USB input", "PHANTOM", "GAIN" in the Devices text |
| G75d-06 remainder | G75e-02 | Session New step 2, MICROPHONE LEVELS: "MIC 1 - Interviewer", "MIC 2 - Subject" |
| G75d-07 the contradiction | PASS | "OTHER DEVICES 3/3 / Online / PoE · relay · tablet link" beside "ALL DEVICES READY 7/7"; port map "GNSS SMA - Not configured" |

The chip, block by block (pages read as the technician at 13:19-13:20; `during_*.txt`,
`during_*_chips.txt`):

| Page | Block | Chip | Note |
|---|---|---|---|
| Devices | banner "ALL DEVICES READY 7/7" | no | engine track state (ruled out of this task, D231) |
| Devices | CAMERA DEVICES, REGISTERED CAMERAS, AUDIO INPUTS, REGISTERED MICROPHONES, CAMERA SEARCH, CAPTURE DEVICE SELECTOR | no | no model value read in them |
| Devices | SUMMARY: CAMERAS, MICROPHONES | no | counts of the selector's tracks |
| Devices | SUMMARY: OTHER DEVICES, PORTS LINKED | **yes**, **yes** | |
| Devices | OTHER DEVICES (PoE switch, recording indicator, tablet control; GNSS and TPM rows read "Not configured" / "Not reported") | **yes** | |
| Devices | FRONT PANEL, PORT MAP | **yes**, **yes** | |
| Network & Time | banner "HOST SYSTEM CLOCK • CONNECTED" | no | "CONNECTED" is one model word without a chip (remainder R-3 of note 154) |
| Network & Time | SYSTEM TIME, TIME SOURCE, RECORDING TIMESTAMPS, A/V SYNC, TIME-SOURCE HIERARCHY, TIME-OFFSET HISTORY, NETWORK AND TIME EVENTS | no | host clock / "Not measured" / audit rows |
| Network & Time | NETWORK STATUS (address, PoE budget, bandwidth), NETWORK DOMAINS (VLANs) | **yes**, **yes** | |
| Storage | CAPACITY, WRITE SPEED, SESSION SIZE, EST. REMAINING, RETENTION DAYS, SEALED PER HOUR, RECENT STORAGE ACTIVITY, STORAGE POLICY | no | the host volume (`df`: 926 GiB, 53 % used), "Not reported", stored configuration, audit rows; the caption "Evidence HDD · 1.0 TB" under the ring is a model name without a chip (R-3) |
| Storage | USAGE OVER 24 H, VOLUMES & HEALTH (SMART), RETENTION CALCULATOR | **yes** x 3 | |
| System | banner "ALL CORE SERVICES RUNNING", SERVICES, HEALTH, SOFTWARE UPDATE, DIAGNOSTICS & MAINTENANCE, ABOUT / IDENTITY | **yes** x 6 | |
| System | QUICK ACTIONS, SETTINGS | no | links and console preferences |

I found no block of model values without a chip. Two single model words stand outside a chip
(R-3, known).

### 3.5 Item 5 - G75d-08: worker kill

Run A: `SES-20261011-0054` started on the tablet 13:30:27, capture worker killed (`KILL`) at
13:30:45.4, sealed 13:30:55.0 -> `EV-20261011-0041`. Run B: `SES-20261011-0055`, started on the
tablet 13:33:27, killed 13:33:44.3, sealed 13:33:53 -> `EV-20261011-0042`.

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Tablet while the Core seals | T | PASS (run B) | screen recording, one frame per second (`t_5b_sheet`, `t_5b_recovery_sealing`): after the kill the Session Live screen stands for about 4 frames with the timeline row "Fault Detected / The capture worker process was killed."; then "Session recovery" with the chip **"Sealing"**, "Recording was interrupted — sealing what was recorded / The capture stopped unexpectedly before the recording was ended. The recording was interrupted. / The Core is sealing the recording up to the interruption. Nothing has to be started here: this screen moves on by itself.", the only control "Go to Home" (4 frames); then "Finalizing evidence" with the interrupted notice and the steps; then the Summary. **No "Start recovery" in any frame.** Logcat: route `/session/recovery` at 13:33:45.46, Summary at 13:34:00.60 |
| Phone while the Core seals | P | NOT PROVEN by picture | run A: logcat shows the same route (`/session/recovery` 13:30:45.80, Summary 13:30:58.65); my one phone frame of that window shows "Finalizing evidence / Recording was interrupted — sealing what was recorded" (`p_5_k1`). The recovery screen itself was not caught; in run B the phone app was not in the foreground (section 7 (b)) |
| Web | W2 | PASS with a note | both runs: for 0.1-0.3 s the banner read "SESSION ACTIVE / Capture fault / Start recovery" (13:30:45.64-45.74; 13:33:44.36-44.45), then "Sealing evidence • step 1 of 6", then "Sealed — recording was interrupted" (G75e-05) |
| Sealed as interrupted, the same word | W2, T, P, API | PASS | W2 banner and card "Sealed — recording was interrupted / EV-... · The capture stopped unexpectedly before the recording was ended. The recording was interrupted. The evidence holds the recording up to the interruption."; T and P Summary chip "Interrupted" + the same title and sentence (`t_5_02`); op 40 `interrupted true`, `interruptedCause CAPTURE_FAULT`, `files[].profile` `H264_720P30` twice; verify PASS 15 of 15 on both items |
| Rows | audit | PASS | per run: `FAULT_RAISED` "The capture worker process was killed." `{reason WORKER_KILLED, fromState RECORDING}`, `RECOVERY_STARTED`, `EVIDENCE_SEALED`, `RECOVERY_COMPLETED`, ONE `FAULT_CLEARED`; alerts `ALR-000080`, `-000085` resolved; timeline ONE row "Fault Detected" |

### 3.6 Item 6 - the shared rule after a sealed session (web)

`session/current` = `SES-20261011-0055` SEALED. Through the web selector (Devices): VIDEO-02 ->
`CAM-05` (`POST capture/cameras/CAM-05/source 200`, seq 949), "Make primary" on `MIC-02` (seq 950).
`CAM-05` was selected and once pre-checked (a FAKE source), never started.

| Surface | Reads | Result |
|---|---|---|
| Monitor (the sealed session current) | CAMERA & INPUT STATUS "Camera 2 · CAM-05 · Generated test source / Not checked"; audio panel `data-active-input="MIC-02"`, "MIC 1 Standby", "MIC 2 Active"; "Configured profile VIDEO-01: H264_720P30 · VIDEO-02: H264_720P30" (`w2_6_01`) | PASS. The card states the profile, not the cameras; the session's own facts stay beside it ("Camera 2 (CAM-02) · 6 fragments saved", "Audio source MIC 1 from 0:00") - note G75e-08 (c) |
| Dashboard | "Camera 2 · CAM-05 · Generated test source", "MIC 1 Standby", "MIC 2 Primary" (`w2_6_02`) | PASS |
| Session New | step 1 names no source; step 2 (session `SES-20261011-0056` created and pre-checked for this read, then cancelled from the web: `POST .../cancel 204`, seq 951-953): "Camera 2 · CAM-05 · Generated test source" (`w2_6_04`) | PASS for the camera; the microphones: G75e-02 |
| Put back | VIDEO-02 -> `CAM-02` (seq 954), "Make primary" on `MIC-01` (seq 955); `GET capture/config`: `CAM-01` / `CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`; Dashboard "Camera 2 · CAM-02", "MIC 1 Primary", "MIC 2 Standby"; Monitor "MIC 1 Active", "MIC 2 Standby", "Camera 2 · CAM-02" | PASS |

### 3.7 Item 7 - B9

Logcat of the app's process, level E / F, per window:

| Window | Tablet | Phone |
|---|---|---|
| Item 1 (13:16-13:24) | 109 "EGLConsumer is not attached to an OpenGL ES context", 28 `EGL_emulation`, 6 `Surface` | 10 / 8 / 7 |
| Item 2 (13:24-13:30) | 45 / 32 / 8 | 17 / 14 / 13 |
| Item 5 (13:30-13:35) | 68 / 26 / 7 | 14 / 12 / 8, and 5 React Native library lines (below) |

`ReactNativeJS`: tablet 170 lines, all level I; phone 129 level I and 1 level W ("[Reanimated]
Reduced motion setting is overwritten", at my relaunch). 0 `FATAL EXCEPTION`, 0 `ANR in`.
**Zero app ERROR lines.** The 5 library lines on the phone are of my own doing (section 7 (b)):
13:32:30 "Stopping surface [1]", "Tried to remove non-existent frame callback", "Surface [1] was
stopped"; 13:34:35 "Skipping batch of MountItems; was stopped [1]", `ReactNativeJNI` "Surface with
id 1 is not found".

Mount warnings ("Unable to find SurfaceMountingManager"), counted only: tablet 218 / 214 / 229,
phone 2 / 7 / 4.

Core log of lane 2 since my start (960 lines: 926 info, 23 warn, 11 error):

| Lines at error level | Of |
|---|---|
| 4 x `SEALER_FAILED` (`SES-...-0051`, attempts 1-4) | the blocked rig |
| 3 x `SEALER_FAILED` (`SES-...-0052`, attempts 1-3), 1 x `SEALING_SESSION_UNSEALABLE` | the unsealable rig |
| 2 x `CAPTURE_FAULT` `reason WORKER_KILLED` (`-0054` 13:30:45.586, `-0055` 13:33:44.308) | my two kills |
| 1 x `CAPTURE_FAULT` `sessionId SES-20261011-0054`, `reason null`, 13:33:27.583 | NOT of a fault I made: G75e-03 |

No error-level line through the healthy seals (`-0053`; the retried seal of `-0051`; the two
interrupted seals after their fault line). Warn lines: 10 `CAPTURE_FIRST_VIDEO_HELD`, 5
`CAPTURE_MIC_RATE_AT_LIMIT`, 2 `LANE_SEAL_RIG_BOUND`, 2 `CAPTURE_WORKER_DOWN`, 2
`CAPTURE_INTERRUPTED`, 2 transcriber log entries.

## 4. Findings

| ID | Severity | What | Evidence | Spec / ruling |
|---|---|---|---|---|
| **G75e-01** | MINOR | Phone Home while a session records: the first status tile (Camera) is an empty box; Microphone "Reachable 2/2" and Storage are drawn. Seen in two sessions (`-0053` at 6 s, `-0054` at 16 s); at rest the tile reads "Camera / Not checked / 2/2" | `p_2_04`, `p_5_01` | note 155: the phone tile reads "Live" while recording |
| **G75e-02** | MINOR | Web Session New step 2, MICROPHONE LEVELS: "MIC 1 - Interviewer", "MIC 2 - Subject" on a real-capture Core - dataset roles of the simulator; with `MIC-02` primary the two labels do not say which line is primary. The tablet's recovery screen ("Analysis details": "MIC 1 - Interviewer · AUDIO-01") shows the same names (device side known as G70d-02) | `w2_2_03`, `w2_6_04`, `t_5b_recovery_sealing` | D228 (3) / G75d-06: a generated source is named as generated; Monitor and Dashboard already read "MIC 1" / "MIC 2" |
| **G75e-03** | MINOR | At the healthy START of the session after a worker-killed one, the Core logs at error level `CAPTURE_FAULT` "capture fault: the capture worker cannot be kept running" with `sessionId` and `correlationId` of the PREVIOUS, already sealed session and `reason null` (13:33:27.583, 59 ms after `start` of `-0055` answered 200). No alert, no audit row, the new recording was not affected. Seen once (the only start that followed a kill) | `core_lane2.log` | G75c-08: no error-level line where nothing failed |
| **G75e-04** | MINOR - ruling asked | Web Dashboard ring while a session records beside an open notice: "REC 00:00:18 / SECURE • HEALTHY • RECORDING". The pill beside it says "OPEN NOTICE"; the ring drops the notice for the length of the recording, and says "SECURE" on a Core whose security posture is "not reported". Tablet Home in the same state says "RECORDING" only (no claim) | `w2_2_05` | D228 (2): while the notice is active no surface says SECURE without it |
| G75e-05 | NOTE | Web Monitor after a worker kill: "SESSION ACTIVE / Capture fault / Start recovery" for 0.1-0.3 s before "Sealing evidence" (the web twin of G75d-08, a flash; both runs) | `l2_5_web.log`, `l2_5b_web.log` | - |
| G75e-06 | NOTE | (a) During the 155 s of automatic seal retries the header pill reads "SECURE / All systems operational" beside "SEALING RETRIED" (it turns CRITICAL when blocked). (b) The blocked dialog states "The Core's key store cannot be used" four times (step sentence, cause line, alert sentence) | `l2_1_web.log`, `during_devices.png`, `w2_1_02` | - |
| G75e-07 | NOTE | A technician's acknowledgement of the notice is recorded only as `acknowledged true` on the alert: no audit row, and nothing states who acknowledged (as built, note 153 re-drive 1) | 3.2 | task: "is recorded" |
| G75e-08 | NOTE | (a) `RECORDING_STARTED` rows carry `{timeSource: "RTC"}` on a Core whose surfaces say "Host system clock" (for re-check 89). (b) `EV-20261011-0039` was reserved for the unsealable session and exists nowhere; Dashboard recent events still list "Finalization started / EV-20261011-0039" (known kind, G75d-09 (c)). (c) Monitor of a sealed session after a selector change shows the next pair's "Active / Standby" chips beside that session's "Audio source MIC 1 from 0:00". (d) Tablet Home clock stands at "hh:mm:00" (known, G75d-09 (d)). (e) After the kill the tablet's Session Live still reads "Recording 00:00:16" with "VIDEO 1 REC" for about 4 s beside the new "Fault Detected" row (emulator under load; route change 1.4 s after the kill in run B, 3.5 s in run A). (f) Tablet Home chip "Network: Connected" (a model word) beside "Security: Not reported" | 3.1-3.6 | - |
| G75e-09 | NOTE (not M5) | Phone: the system Back key on Home ends the app's activity; at the relaunch the app stood on Login while the Core kept the device's operator session (`signedInOperatorId OPR-002`) - also after a new sign-in and a sign-out - until it expired idle (seq 961) | section 7 (b) | - |

## 5. Which findings of 10d are now closed

| Finding | State |
|---|---|
| G75d-01 (must-fix) | **closed** (3.2) |
| G75d-02 (must-fix) | **closed** (3.1) |
| G75d-03, -04, -05, -07 | closed (3.3, 3.4) |
| G75d-06 | closed on Dashboard, Monitor, Devices, selector; remainder G75e-02 |
| G75d-08 | closed on the tablet (3.5); phone by route log |
| G75d-09 (a) | closed: op 83 `resumed false` through the on-demand retry |
| G75d-09 (b)-(g) | not in this re-check; (c), (d) met again |

## 6. NOT PROVEN, and not covered

1. The phone's recovery screen while the Core seals an interrupted prefix (3.5).
2. Carried from 10d: the start-refusal sentence live; G75c-06 on lane 1; tablet Settings > About
   TPM row.
3. The tablet's bell and the web's bell for the acknowledgement were not driven by me (the
   drivers' proofs stand); the investigator's "Retry sealing" in the DIALOG and the supervisor's
   press were seen as controls, not pressed (one retry exists per blocked session).
4. A restart of lane 2 with an open notice (skipped as the task says).
5. The chip pages were read as the technician while `-0051` was in its retries; lane 1 was not
   read.
6. No test file was run. `masterplan/02_plan.md` and `99_implementation_report.md` were not
   written: the task asked for this one file.

## 7. Lapses of mine

(a) Item 5 ran twice. In run A my screenshots took up to 4.7 s each on the loaded host and showed
stale frames, so the screen of the sealing window was not caught; I ran it once more with a screen
recording. Lane 2 holds one interrupted item more for it.
(b) A Back key I sent to close the phone's bell popover ended the app's activity (13:32:30); the
phone was on the launcher during run B and came back on Login at my relaunch (13:34:35). I signed
in and out once more to leave it clean (seq 957, 958).
(c) The rig was released right after the unsealable end, not at the end of item 2.
(d) `SES-20261011-0056` was created and cancelled only to read Session New step 2.
(e) From 13:39 to 13:51 I read pictures and sent nothing: the investigator's and the technician's
helper sessions expired by themselves (seq 959, 960).

## 8. Screenshots (`.cache/gates/75e/`)

Read as pictures:

| File | Shows |
|---|---|
| `t_1_01_live.png` | tablet Session Live of `-0051` at 00:00:08: "No preview / CAM 1 · Camera CAM-01 / Reachable", MIC 1 Active, MIC 2 Standby, chips VIDEO 1 REC / VIDEO 2 REC |
| `t_1_02_finalizing_retry.png` | tablet "Sealing is being retried (retry 2 of 3, in 30 s) ...", "The Core runs the seal again by itself.", "Go to Home", step 1 red |
| `p_1_02_retry.png` | the same on the phone |
| `t_1_03_finalizing_blocked.png` | tablet "Sealing is blocked": the Core's sentence with "Retry sealing", three more sentences, "Go to Home" |
| `p_1_03_finalizing_blocked.png` | the same on the phone |
| `w2_1_02_sup_dialog_blocked.png` | web dialog "Sealing is blocked" as the supervisor with the button "Retry sealing" and "Close" |
| `w2_1_03_tech_monitor_blocked.png` | the same dialog as the technician: "An investigator or a supervisor can retry.", no button |
| `w2_1_04_tech_dashboard_blocked.png` | Dashboard as the technician: pill CRITICAL, ring "SYSTEM CRITICAL / NO NEW SESSION UNTIL IT IS SEALED", card "Sealing blocked" |
| `w2_1_05_sup_banner_blocked.png` | Monitor as the supervisor: banner "SEALING BLOCKED" with "Retry sealing" at its right; audio tiles overlapping (known G70d-06) |
| `t_1_04_home_blocked.png` | tablet Home: chip and ring CRITICAL, "Sealing blocked", "Sealing blocked: view", the new-session sentence |
| `p_1_04_home_blocked.png` | phone Home: "Sealing blocked", tiles "Not checked", the new-session sentence |
| `t_1_05_after_retry.png` | tablet Summary of `-0051`: "SEALED", "Sealed 247.8 s after the recording ended", time chips "Host system clock" |
| `t_2_02_unsealable_end.png` | tablet: the notice of `-0052` with "Cause code:", "Recording is not blocked", "A supervisor acknowledges this notice to close it." above "No finalization in progress / Go to Home" |
| `p_2_02_unsealable_end.png` | the same on the phone, last line "Acknowledge this notice to close it: open the alerts (the bell) on Home." |
| `w2_2_01_unsealable_dialog.png` | web dialog "Recording not sealed", the plain sentence, "Cause code: ...", "Close" |
| `t_2_03_home_open_notice.png` | tablet Home: chip "OPEN NOTICE", amber ring "READY / OPEN NOTICE • RECORDING NOT BLOCKED", the sentence, bell "1" |
| `p_2_03_home_open_notice.png` | phone Home: amber ring, "Ready for Recording · open notice", the sentence, bell "1" |
| `w2_2_02_dashboard_open_notice.png` | Dashboard: pill "OPEN NOTICE", ring "SYSTEM ATTENTION / OPEN NOTICE • RECORDING NOT BLOCKED", "Start New Session" |
| `w2_2_04_monitor_recording_beside_notice.png` | Monitor of `-0053`: "SESSION ACTIVE", REC 00:00:05, pill "OPEN NOTICE" |
| `t_2_04_home_recording_beside_notice.png` | tablet Home during `-0053`: chip and ring "RECORDING", tiles READY / Reachable, bell "2" |
| `p_2_04_home_recording_beside_notice.png` | phone Home during `-0053`: "Session in progress", the Camera tile EMPTY |
| `w2_2_05_inv_bell.png` | Dashboard as the investigator during `-0053`: bell with the notice and "A supervisor acknowledges this notice to close it."; ring "SECURE • HEALTHY • RECORDING" |
| `p_2_05_bell_supervisor.png` | phone bell popover with "Acknowledge and close" |
| `p_2_06_after_ack.png` | phone after the acknowledgement: "No new alerts", bell without a count |
| `p_5_01_home_recording.png` | phone Home during `-0054`: Camera tile EMPTY again; bell popover with the microphone-rate alert |
| `t_5_k0.png`, `t_5_k1.png` | run A, stale frames: Session Live "Recording 00:00:18" with the row "Fault Detected" |
| `t_5_k2.png`, `t_5_k4.png` | run A: tablet "Finalizing evidence / Recording was interrupted — sealing what was recorded", 0 % and 33 % |
| `p_5_k1.png` | run A: the same Finalizing screen on the phone, 0 % |
| `t_5b_sheet.png` | run B, 16 frames at one per second: Session Live, "Session recovery" with the chip "Sealing" (4 frames), Finalizing |
| `t_5b_recovery_sealing.png` | run B, one full frame: "Session recovery / Sealing / ... The Core is sealing the recording up to the interruption. Nothing has to be started here ... / Go to Home" |
| `t_5_02_summary.png` | tablet Summary of `-0054`: chip "Interrupted", "Sealed — recording was interrupted", "Sealed 9.6 s after the recording ended" |
| `w2_6_01_monitor_cam05_mic02.png` | Monitor with the sealed `-0055` current after the selector change: audio tiles "Standby" / "Active" |
| `w2_6_02_dashboard_cam05_mic02.png` | Dashboard: "Camera 2 · CAM-05", MIC 1 "Standby", MIC 2 "Primary", 17 items sealed today |
| `w2_6_04_session_new_step2_cam05.png` | Session New step 2: "Camera 2 · CAM-05 · Generated test source / Not checked", meters "MIC 1 - Interviewer" / "MIC 2 - Subject" |
| `during_devices.png` | Devices top: tiles "Generated test source / Not checked", "OTHER DEVICES 3/3" and "PORTS LINKED 7/7" with the chip |

Taken, NOT read as pictures (their text was read from the DOM or the view tree):
`p_1_01_home_recording`, `p_1_05_after_retry`, `t_2_01_finalizing_retry`, `p_2_01_finalizing_retry`,
`t_2_06_after_ack`, `t_5_01_live_before_kill`, `t_5_k3`, `t_5_k5`, `t_5_k6`, `p_5_k3`, `p_5_k5`,
`p_5_02_summary`, `t_9_01_home_end`, `p_9_01_home_end`, `w2_1_01_monitor_recording`,
`w2_1_06_inv_dialog_blocked`, `w2_2_03_session_new_step2`, `w2_2_06_dashboard_after_ack`,
`w2_6_03_session_new_step1`, `w2_6_05_dashboard_put_back`, `w2_6_06_monitor_put_back`,
`during_network-time`, `during_storage`, `during_system`.

Other files there: sampler logs `l2_1_web`, `l2_1b_web`, `l2_2_web`, `l2_2b_web`, `l2_5_web`,
`l2_5b_web`; session logs `ses_*.log`; `core_lane2.log`; the two logcats; `audit_l2.json`; the two
screen recordings `rec_emulator-*.mp4` (the app's own screens); page texts; my scratch scripts.

## 9. Environment as left (13:52)

| Item | State |
|---|---|
| Lanes | 1 RUNNING PID 13944 (not touched); 2 RUNNING PID 13991 - never restarted, never reset; health ok, `ws.clients 2`. Web 5176 / 5177, Metro, PostgreSQL untouched |
| Seal rig | **OFF** (`status` read at 13:26, 13:39, 13:51) |
| Selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02`, both `H264_720P30`; `MIC-01` PRIMARY, `MIC-02` STANDBY; `locked false` |
| Session | none open; `session/current` null (the last act was the cancelled `-0056`). Next session `SES-20261011-0057`, next item `EV-20261011-0043` |
| Alerts | 46, **none active** |
| Audit | chain `view.ok true`, `stored.ok true` at 958 rows (13:39); 961 rows at 13:51, then my supervisor sign-out |
| Devices | tablet and phone signed out through the app, on Login, both fields showing only their hint, "Core online", "paired as DEV-0001" / "DEV-0002"; `pairing/devices` both `PAIRED`, online; both reverse rules read back on both; no re-pairing, no link cut, no lock change, no reboot, biometric not enabled; media volume not touched; the temporary screen recordings removed from the devices |
| Helpers | supervisor helper signed out (204), the other two had expired; no jar left in `.cache/gate-env/`; both headless browsers stopped, their profiles removed; logcat readers stopped; no `capture-worker` process |

Added to lane 2 (real capture, FAKE sources, development key; every sealed item verifies PASS 15
of 15 with `files[].profile` `H264_720P30` twice; the lane now holds 39 items):

| Item | Session | Kind | Length | Size | Made by |
|---|---|---|---|---|---|
| `EV-20261011-0038` | `SES-20261011-0051` | clean, blocked then sealed (rig; four failed attempts, then "Retry sealing" in the web UI) | 45.4 s | 44.9 MB | TABLET start (`DEV-0001`), API stop |
| - | `SES-20261011-0052` | **UNSEALABLE, in quarantine** (rig); `EV-20261011-0039` does not exist | 45.1 s | 49,468 KiB in quarantine | API |
| `EV-20261011-0040` | `SES-20261011-0053` | clean | 45.1 s | 44.6 MB | WEB UI start, API stop |
| `EV-20261011-0041` | `SES-20261011-0054` | interrupted (`CAPTURE_FAULT`, worker killed) | 18.1 s | 15.6 MB | TABLET |
| `EV-20261011-0042` | `SES-20261011-0055` | interrupted (the same) | 17.1 s | 14.6 MB | TABLET |
| - | `SES-20261011-0056` | created, pre-checked, cancelled | - | - | WEB UI |

Alerts of this run, all inactive: `ALR-000072` (CRITICAL `SEAL_BLOCKED`, resolved by the retry),
`ALR-000075` (CRITICAL `UNSEALABLE`, acknowledged and resolved from the phone), `ALR-000080` and
`ALR-000085` (CRITICAL `WORKER_KILLED`, resolved at the seal), five INFO `MIC_RATE_AT_LIMIT`.
Quarantine now holds three folders (`-0041`, `-0045`, `-0052`): a later reset of lane 2 needs the
FAKE-only option. Four selector rows (seq 949, 950, 954, 955) net to no change.

## 10. What the next final re-checks must know

1. `session/current` of lane 2 is null again (a cancelled session was the last act): a re-check
   that needs "a sealed session as the current one" must seal one first.
2. Screenshots by `adb exec-out screencap` take up to 5 s while the Core transcribes and show
   stale frames: for anything timed use `adb shell screenrecord --time-limit <s>` and cut frames
   with `ffmpeg` (no `drawtext` filter in this build), then remove the file from the device.
3. The phone's bell opens a popover that `uiautomator` does not list: read it from a screenshot and
   tap by coordinate ("Acknowledge and close" at about 588, 734). Do NOT close it with the Back
   key: on Home that ends the app's activity and the relaunch stands on Login.
4. The web "Retry sealing" controls are `sm-seal-retry-banner` and `sm-seal-retry-dialog`; the
   dialog must be closed before the banner's button can be clicked.
5. The rig binds to one session; releasing it right after that session's end is safe.
6. `POST session/case-number` gives the next case number; the web form's "Fill in the next case
   number" button does the same.
7. After a worker-killed session the next start writes one stray error-level `CAPTURE_FAULT` line
   (G75e-03): do not read it as a fault of the new session.

---
*Generated: 2026-10-11 13:58 WIB*
