---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: confirmation session of fix wave M (not a gate, no row verdict)
date: 2026-10-11
agent: verifier (independent; rules of delegation_progress/gate_brief_wave_g.md + the additions of the task)
narrative_tier: 2
tree: commit a5d75ed (read at the start; working tree: two untracked docs, no product change)
environment: initialization/10_gate_environment_wave_m.md (lane 2, Core PID 57092, both devices on lane 2)
status: needs-review
---

# 14 - Confirmation of fix wave M

Run window 16:37 - 17:06 WIB. Lane 2 only (lane 1 was not called). No product, test or doc file
edited; this is the only file written under `docs/`. No lane restart, no reset. No LOCAL_DEVICE source
selected, pre-checked or started (the selector's option `CAM-03` was listed and not chosen). Biometric
offer answered "Not now" on both devices: **skipped by the user's instruction**. The stub's fixture
account was typed from its file at use and is in no file or picture of this run. Browser: Google
Chrome headless, `--mute-audio`, 1440 x 900, own fresh profile, the helper's session cookie. Nothing
was played on a device (tablet media volume 4 -> 0 for the item page -> 4; phone 5, untouched).
Nothing downloaded. Scratch: `.cache/gates/wave-m-confirm/` (23 pictures in `shots/`, each read by me;
tools copied from the earlier sessions' scratch with the paths changed).

**Status needs-review** because of GM-01 and GM-02 (two MINOR findings on surfaces wave M touched)
and the lapses of section 5.

## 1. Items

| Item | Surface | Result | Evidence |
|---|---|---|---|
| 1 G94d-01, 80 % + Play at once, run 1 | web | **CONFIRMED** | Camera 1 6.2 -> 8.0 s; sentence "This recording failed its integrity check at VIDEO-02 fragment 3." + "... Camera 2 is stopped. Camera 1 plays on. Run Verify for the full result." and tile "Stopped: this file failed its integrity check at fragment 3." 5.62 s after the open, unchanged 8 s after the end; 3 probe requests, the third `bytes=2257425-4354576 -> 409`; VIDEO-02 events `timeupdate ... rs=0` did not cancel the watch. `w1_b80_run1_end_plus_8s.png` |
| 1 the same, runs 2 and 3 | web | **CONFIRMED** (3 of 3) | 5.55 s and 5.63 s after the open; sentence + tile stay; 1 x 409 each. `w1_b80_run2_...`, `w1_b80_run3_...` |
| 1 95 % + Play | web | **CONFIRMED** | Camera 2 clock at 8.0 with `rs=0`; sentence + tile 3.70 s after the open, stay; 1 x 409. `w1_c95_end_plus_8s.png` |
| 1 Play through from 0 | web | **CONFIRMED** | sentence + tile 5.79 s after the open while playing (0:04 of 0:08), Camera 1 plays to 8.0, both stay. `w1_a_through_sentence_while_playing.png` |
| 1 clean item `EV-20261008-0001` afterwards | web | **CONFIRMED** | both files `readyState 4`, 1280 wide, 0 -> 8.0 s, ended; no sentence, no tile mark, 0 probe requests, 0 x 409. `w1_d_clean_end_plus_8s.png` |
| 1 G94d-02, one WARNING row per stop | Core audit | **CONFIRMED** | stop of run 1: rows 1177, 1178 (INFO, opened) and exactly ONE WARNING row 1179 "Media stream stopped: VIDEO-02 fragment 3 (FRAGMENT_NOT_AUTHENTIC)"; stop of the play-through run (77 s later): 1186, 1187 and exactly ONE WARNING row 1188. Core log of the run: 2 error lines `FRAGMENT_NOT_AUTHENTIC` (one per row), 18 warn lines "stopped again" (`repeated`). See observation O-1 |
| 2 M-S2, adopted camera passes its pre-check without a restart | web + Core | **CONFIRMED** | Devices opened (the probe read) -> search "1 found · 1 new" (`DSC-000010`) -> connect dialog, fixture account typed from the file, "Connection works. This camera can be added." (`w2_01_connect_test_works_fields_masked.png`) -> "Add as camera": "CAM-06 was added." (op answer 201, `adapter FAKE`) -> selector "Camera for Camera 2" = `CAM-06`, Save 200 -> Session New from the web: `SES-20261011-0077` `ARMED`, `LENS_2 PASS READY`, outcome PASS, 0 notices, no new alert, no `CAPTURE_DEVICE_UNREACHABLE` row (rows 1191-1198) (`w2_02_precheck_cam06_on_video02_pass.png`, tile "Camera 2 · CAM-06") -> "Cancel" -> "Discard session" (204, `session/current` null) -> selector back to `CAM-02`, Save 200, read back. **Core PID 57092 before, after the adoption, after the pre-check and at the end** |
| 3 notification B, camera | web | **CONFIRMED** with GM-01 | `source-rig 2 unreachable CAM-02` -> `SES-20261011-0078`: row "Video Lens 2 ... WARN" with the sentence "Camera 2 (CAM-02) is not reachable. The session will record one camera only. It did not answer the pre-check. A search found 1 camera." (in the markup; drawn cut - GM-01); "1 warning needs acknowledgement"; choices "Search again" (enabled, supervisor), "Re-run checks", "Acknowledge warnings", Cancel; Next disabled; bell "1 new alert": "Camera 2 (CAM-02) is not reachable. It did not answer the pre-check. A search found 1 camera."; Core: ONE alert `ALR-000115` WARNING `CAPTURE_DEVICE_UNREACHABLE`, `phase PRECHECK`, `cause UNREACHABLE`, `searchResponderCount 1`; rows 1202 `CAPTURE_DISCOVERY_SEARCHED` (`trigger PRECHECK`), 1203 `CAPTURE_DEVICE_UNREACHABLE` (`degraded true`); log `LANE_SOURCE_RIG_ON CAM-02`. `w3_01_...`, `w3_02_...`, `w3_03_...` |
| 3 release, re-run | web | **CONFIRMED** | rig OFF (read) -> "Re-run checks": `ARMED`, `LENS_2 PASS`, no "not reachable" on the page, no acknowledge box, bell without a count, `ALR-000115` `active false` with `resolvedAt`; cancelled in the UI (204) |
| 3 notification B, microphone | tablet (supervisor) | **CONFIRMED** with GM-03 | `source-rig 2 unreachable MIC-01` -> `SES-20261011-0079`: "Recording is blocked", "MIC 1 (MIC-01) is the active microphone and is not reachable. Cancel this session, make MIC 2 (MIC-02) the primary microphone on Devices, then start again." (the wording of spec 8g.3), row "MIC (primary) ... BLOCK", "Search again" + "Re-reads the microphones connected to the Core...", Next disabled; Core: outcome BLOCK, `ALR-000116` WARNING `deviceKind MIC`, `cause DEVICE_NOT_FOUND` (no count, as the contract says), rows 1209 `CAPTURE_DEVICE_UNREACHABLE` (`degraded false`), 1210 `PRECHECK_BLOCKED`. `t3_01_tablet_precheck_mic01_unreachable.png`. Release -> "Run checks again": "All checks passed", `ARMED`, alert `active false`; cancelled (item 4) |
| 3 `source-rig 2 status` | lane | **CONFIRMED** | `OFF`, read after each release and at the end |
| 4 tablet, ARMED: on-screen Back | tablet | **CONFIRMED** | ONE press -> "Cancel this session?" with "Keep session", "Go to Home, keep the session open", "Cancel session" and the sentence saying what each does; "Keep session" closes it, session still `ARMED` |
| 4 tablet, ARMED: system Back | tablet | **CONFIRMED** | the same dialog, the same three choices |
| 4 "Go to Home, keep the session open" | tablet | **CONFIRMED** | Home "Ready for Recording", action "Continue setup", session still `ARMED` on the API; "Continue setup" -> step 3 with "Start Recording" |
| 4 header "Cancel session" | tablet | **CONFIRMED** | opens the same confirm; "Cancel session" -> `session/current` null, Home "Start Session". Not drawn at step 1 before a session exists |
| 4 cancelled from the WEB while the form is open | tablet | **CONFIRMED** | `SES-20261011-0080` armed on the tablet, cancelled in the web UI (Cancel -> Discard session, 204): "The session was cancelled / SES-20261011-0080 was cancelled on another client. Nothing was recorded. This form was cleared: enter the details again to start a new session."; case number and subject name show their hints, Next disabled; Back leaves to Home with no question. `t4_04_form_cleared_after_web_cancel.png` |
| 4 phone: Back + header "Cancel session" | phone (investigator) | **CONFIRMED** | `SES-20261011-0081` `ARMED`: on-screen Back -> the three choices; "Keep session"; header "Cancel session" -> the confirm -> "Cancel session" -> `session/current` null, Home |
| 5 G70d-02 at rest | tablet | **CONFIRMED** | list rows `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`: "Not checked"; names "MIC 1 · Primary", "MIC 2 · Standby"; detail chip + "Status" row of all four: "Not checked"; "Online" 0, "Interviewer" 0 on the screen |
| 5 G70d-02 at rest | phone | **CONFIRMED** | the same four rows, the same two names; detail chip + "Status" row of all four: "Not checked" |
| 5 cameras "Live" while recording | phone | **CONFIRMED** | `SES-20261011-0082`, 11 s: "Camera 1 ... Live", "Camera 2 ... Live". `p5_11_phone_devices_while_recording.png` |
| 5 cameras "Live" while recording | tablet | **CONFIRMED** (third recording, section 5) | `SES-20261011-0084`, 7 s: "Camera 1 ... Live", "Camera 2 ... Live". `t5_30_tablet_devices_camera_rows_while_recording.png`. The detail chip while recording was not read |
| 5 G75e-01, recording starts with the phone's Home on a hidden tab | phone | **CONFIRMED** | phone on Evidence, recording started on the tablet (`SES-20261011-0082`), Home opened at 8 s: tile "Camera / Live / 2/2" drawn, "Microphone / Reachable / 2/2". `p5_10_phone_home_tile_after_hidden_tab_start.png` |
| 5 tablet Home tiles while recording | tablet | **CONFIRMED** (second recording) | `SES-20261011-0083`, 11 s: four tiles drawn - "No preview / Camera 1 · Camera CAM-01", "Camera 2 · Camera CAM-02", MIC 1 "Reachable / Active", MIC 2 "Reachable / Standby". The camera chips read "READY" (engine word, ruled out of this task by D231). `t5_20_tablet_home_while_recording.png` |
| 6 G89d-03 tabs at the first scroll position | tablet | **CONFIRMED** | `EV-20261011-0054`: pinned strip `[1318,176][2528,276]`, scroll view from 276, action bar `[1318,1398][2528,1536]` - no intersection; real taps on "Hash & Integrity" -> "Not verified yet ... Verify", "Metadata" -> the record (`t6_02_item_tab_metadata_by_tap.png`, one hash line masked in the file), "Media" -> "Sealed recording ... Open playback"; export-sheet nodes 0 after each tap |
| 6 whole durations in the list | tablet | **CONFIRMED** | "00:01:23", "00:00:47", "00:00:31", "00:00:47"; duration `[734,618][850,650]` against the menu button `[1136,570][1216,650]` - no intersection |
| 7 Session New meters, no id before a session | web | **CONFIRMED** | step 1 beside the SEALED `SES-20261011-0076`: no header chip, 0 session ids on the page; after the create: chip `SES-20261011-0077`, "MIC 1 · MIC-01 · Primary microphone · Generated test source" / "MIC 2 · MIC-02 · Standby microphone · Generated test source"; "Interviewer" 0, "- Subject" 0 |
| 7 tamper tile's sentence against the API | web | **NOT CONFIRMED** against the whole trail - GM-02 | tile: "28 PASS • 1 FAIL", "21 of the 50 items of this Core have no verify run in these rows." API: evidence list 50; audit list walked, 1229 rows: 32 items have a verify row (31 PASS, 1 FAIL) -> 18 without. The tile's numbers equal the NEWEST 1000 rows (29 items, 28 + 1; 50 - 29 = 21). `w7_03_security_audit_tamper_tile.png` |
| 7 Monitor integrity card of the sealed session | web | **CONFIRMED** | `SES-20261011-0083`: "Capture - The recording has ended", "Media Protection - Encrypted at seal", "Audit Log Hash Chain - SHA-256", "Time Source - Core system clock (UTC+07:00)", "37 fragments saved ... 47 MB", per-camera counts, "Fragment hashes and the signature are stated on the evidence item: EV-20261011-0054"; 0 hits each for "Encryption Active", "Secure Timestamp", "Storage Write Verified", "AES-256", "RTC", "Hash Chain Active", "DEMO", "imulated", "GNSS", "TPM". `w7_02_monitor_sealed_0083_integrity_card.png` |
| 7 blocked / retried / open-notice ring and pill | web | not re-driven (by the task) | cited: `implementation/159_fix_wave_m_w.md` sections 3.2, 3.3 |
| 8 logcat, items 3-6 (16:47:09 - 17:03:51, cleared after sign-in) | tablet, phone | **CONFIRMED** with O-3 | `ReactNativeJS` lines: tablet 167, phone 126, all level I; 0 at E or W; 0 `FATAL EXCEPTION`, 0 `ANR in`; runtime records of level error: 0; of level warn: 1 (tablet, `features.sessionNew.cancelledElsewhere`, `SES-20261011-0080` - the intended record). E-level lines of the app's process: tablet 285, phone 100 - all graphics (`SurfaceTexture ... EGLConsumer is not attached`, `EGL_emulation`, `Surface`). Mount warnings counted only: 2,772 / 1,109 |
| 8 Core log of lane 2 | `.locks/core-server.lane2.log` | **CONFIRMED** | session `-0082` (create to seal): 51 info, 3 warn, 0 error; the next start `-0083`: 44 info, 3 warn, 0 error; `-0084`: 46 info, 4 warn, 0 error. Warn: `CAPTURE_FIRST_VIDEO_HELD` x2 and `CAPTURE_MIC_RATE_AT_LIMIT` x1 per session, one "transcriber log entry". `CAPTURE_SUPERVISOR_FAULT_OVER`: 0 lines (no worker-killed session preceded a start; not provoked) |

## 2. Findings

| ID | Severity | What | Evidence |
|---|---|---|---|
| **GM-01** | MINOR | Web Session New, notification B at 1440 x 900: the warn row's sentence is drawn on one line with an ellipsis - "Camera 2 (CAM-02) is not reachable. The sessi..." (the element needs 779 px and has 287; `white-space: nowrap`, no title). The consequence the spec's start rule states to the operator ("The session will record one camera only", `08_client_ux_spec.md` 8g.3) is readable nowhere on the step: the acknowledge box says only "Review the warnings and acknowledge them to continue.", the bell gives the search count but not the consequence. The operator acknowledges a warning whose effect is not shown | `w3_01_web_precheck_cam02_unreachable.png`, `w3_02_web_precheck_cam02_lower_part.png` |
| **GM-02** | MINOR | Security & Audit tamper tile (G89d-02): the count of items without a verify run is taken over the audit VIEW (the newest 1000 rows; the page itself says "229 older entries rotated out of the ring buffer"). `EV-20261010-0014`, `-0018`, `-0019` were verified in rows 94, 146, 147 and are counted as having no verify run: 21 stated, 18 in the trail. The sentence says "in these rows", so it is not false as worded, but the number grows by itself as rows rotate out and no longer answers "which items were never verified". The driver's proof (12 of 41 at 1084 rows) was made when the gap was within its window | section 1, item 7 |
| **GM-03** | NOTE | Tablet Session New, blocked alert: "... then start again.." (two full stops: the joined sentence ends with one and the template adds one) | `t3_01_tablet_precheck_mic01_unreachable.png` |
| **GM-04** | NOTE | Web Monitor, integrity card of a SEALED session: "37 fragments saved · last 37 s ago" - the "ago" still counts after the recording has ended and sealed | `w7_02_monitor_sealed_0083_integrity_card.png` |
| **GM-05** | NOTE | Tablet, while recording: the Devices detail of MIC 2 (standby) reads "-90 dBFS" with an empty meter; Home, 5 s earlier in the same recording, reads "-21 dBFS" for MIC 2. One observation each; which one is the Core's value was not checked | `t5_20_...`, `t5_21_tablet_devices_rows_while_recording.png` |

Observations (no finding):

- **O-1.** A tamper stop repeated by the same operator in the same sign-in session within 60 s of the
  first row writes NO further WARNING row, also when it is a new opening of the item (runs 2, 3 and the
  95 % run: rows "opened" only; warn log lines `repeated`). This is the documented rule (`service.ts`
  header, "ONE STOP, ONE ROW", key = operator, sign-in session, item, file, fragment, code; life =
  `EVIDENCE_MEDIA_SESSION_TTL_MS` 60 s). The two stops outside each other's window each wrote one row.
- **O-2.** Web connect dialog at 1440 x 900: my tool's click at the centre of the three-line label "I
  have checked that ... is this camera" closed the dialog (nothing was sent; the typed account went
  with the dialog). After scrolling the label into the middle the same click ticked it. What covered
  the label's centre was not established (hypothesis: the dialog's fixed button row).
- **O-3.** The graphics error lines of the app's process occur through the whole run (every minute from
  16:47 to 17:02), not only at sign-in. None is a JS or app-code line.
- **O-4.** Seen, known or out of scope: web Devices "ALL DEVICES READY 7/7", camera tiles and the
  detail "Status READY" (engine words, D231); phone More "Network & Time, Time RTC" (G89d-01); roster
  rows draw "Not checked" in a green chip (note 160, seen 3); two `CAPTURE_CONNECTION_TESTED` rows for
  one pressed test and one adoption (1192, 1193).

## 3. NOT PROVEN / not covered

- The phone's "Go to Home, keep the session open" and "Continue setup" (tablet driven; the phone's Back
  and header control driven).
- G70d-03 (a), a dead Back: not met. Each Back was pressed once and the screen read before the next press.
- G75e-01: the platform mechanism stays unknown; the reproduced condition is confirmed fixed, one run.
- Notification B: "Search again" not pressed; no start after an acknowledgement; both cameras
  unreachable; the standby microphone; the web Devices page ("Not reachable" row, banner) during the
  notice was not opened; the phone was not re-driven.
- `GET session/current` showed the pre-check item with `status`, `value`, `reason` and no `params`
  member, while `contract_wave_m.md` lists `params { deviceId, rule }`. The clients drew the right
  sentence, so they read it somewhere; whether the member is in the realtime slice only was not checked.
- The tablet's detail chip of a camera while recording; the simulated lane (lane 1) on any surface.
- `CAPTURE_SUPERVISOR_FAULT_OVER`: not seen (nothing provoked it).
- Selector with `MIC-02` primary; Monitor at 1920 x 1080 (both listed as not driven in note 159).
- Biometric steps: skipped by the user's instruction, never passed.

## 4. State left (17:06 WIB)

| Item | State |
|---|---|
| Lanes | lane 1 RUNNING (PID 57048, not called); lane 2 RUNNING (**PID 57092**, never restarted, never reset); health ok, `ws.clients 2` |
| Selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` (read) |
| Session | none open: `session/current` = `SES-20261011-0084`, `SEALED` |
| Rigs | seal rig OFF (never switched), source rig OFF (switched twice: `CAM-02` 16:44:53 - 16:45:58, `MIC-01` 16:49:39 - 16:50:45); both read at the end |
| Alerts | 66, none active |
| Stub | preset `NORMAL` (mode file read, never written) |
| Devices | both signed out through the app, on Login ("You have been signed out."), both fields showing only their hints, `DEV-0001` / `DEV-0002` `PAIRED`, online; reverse rules `tcp:8081 -> 8081`, `tcp:4420 -> 4422` read back on both; media volume 4 / 5 as found; no lock change, no reboot |
| Helpers | helper supervisor session signed out (204, then 401), jar removed; Chrome stopped, its profile removed; logcat readers stopped; `~/Downloads`: 0 `DEMS-export*` |

**Added to lane 2 by this session**

- Capture device **`CAM-06`** (FAKE, the stub on device port 56570, credential stored), registered, on
  no track. The stub now answers a search as "already registered".
- Sessions cancelled from ARMED / PRECHECK, never recorded: `SES-20261011-0077`, `-0078` (web),
  `-0079`, `-0080` (tablet), `-0081` (phone).
- Recorded and sealed on the FAKE sources: `-0082` -> `EV-20261011-0053` (31.6 s), `-0083` ->
  `EV-20261011-0054` (47.0 s), `-0084` -> `EV-20261011-0055` (83.2 s). Evidence list: 51 items.
- Alerts `ALR-000115` (`CAM-02`), `ALR-000116` (`MIC-01`), both resolved by the passing re-runs; three
  INFO `MIC_RATE_AT_LIMIT` alerts of the recordings, inactive.
- Searches `DSC-000010` (manual), `DSC-000011` (pre-check). Media sessions: 5 openings of
  `EV-20261009-0005` (2 WARNING stop rows: 1179, 1188), 1 of `EV-20261008-0001`.
- Audit: stored chain `ok`, **1238 rows** checked, `firstBadSeq null` (1176 at my start), then one
  helper sign-out and two device sign-outs. Includes device and helper sign-ins, two selector changes
  (`CAM-06`, back to `CAM-02`), and `SUMMARY_ACKNOWLEDGED` rows written when the devices left the
  Summary screens of the three recordings.

## 5. Lapses of this session

1. **Three recordings instead of one.** In the first (`-0082`) my blind taps on the tablet dismissed
   the "Leave the monitor?" dialog, so the tablet's Home and Devices were not seen; I also stopped it
   at 31.6 s, not 45. The second (`-0083`, 47.0 s) gave the tablet Home tiles, but the Devices list
   stood on its microphone rows. The third (`-0084`, started through the API) gave the tablet's camera
   rows; a hanging `uiautomator` read delayed its stop to 83.2 s. None of the three was a re-run after
   a product fail: each completed a check my own driving had missed.
2. The connect dialog closed once with the fixture account typed in its fields (O-2). Nothing was sent
   and nothing was printed.
3. Pictures: 23 kept and read; the others I took (duplicates of states read from the view tree) were
   removed from my scratch folder instead of being kept unread.
4. The rig-use log in `contract_wave_m.md` was not written (the task allowed one file under `docs/`);
   nothing else ran on the lanes.

---
*Generated: 2026-10-11 17:08 WIB*
