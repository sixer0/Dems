---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 70 (M4 milestone gate) - FINAL RE-CHECK after fix wave L
date: 2026-10-11
agent: verifier
narrative_tier: 2
tree: commit 7b1aded (`git rev-parse --short HEAD`); working tree: documentation only (`decisions.md` modified, two untracked notes); no product or test file changed by this run
read_with: gateway_check/09_m4_gate.md (FAIL), 09b_m4_regate.md (FAIL, G70b-01), 09c_m4_recheck.md (FAIL, G70c-01)
status: needs-review
verdict: PASS WITH CONDITIONS - G70c-01 is CLOSED; no BLOCKER / MAJOR open; `M4-NODEV-B-*` is still NOT PROVEN (the approved method does not provoke it)
---

# 09d - M4 final re-check (row 70)

Run window 12:51-13:10 WIB on the environment of `initialization/09_gate_environment_wave_l.md`
(lane 2 Core PID 13991, not restarted, not reset; lane 1 PID 13944). Seven items of the brief, one
run each. No product or test file changed, no git write, no install, no lane restart, no reset, the
seal rig never switched (read `OFF` at the end). Evidence under the git-ignored `.cache/gates/70d/`
(41 screenshots, each read; two logcats; scratch tools). Surfaces: W2 = web console of lane 2
(5177), headless Chromium over CDP with the session helper's cookie; W1 = lane 1 (5176); T = tablet
`emulator-5556` (`DEV-0001`); P = phone `emulator-5554` (`DEV-0002`), both on lane 2, both signed in
as the seed supervisor through the app's Login (fields checked empty first, content never printed;
biometric offer answered "Not now" on both).

No fixture account, pairing code, password or token is in this file, in a file name, or in a
screenshot of this run. The stub's fixture file was not read; no connection test and no adoption
was made.

## 1. Verdict

**PASS WITH CONDITIONS.** The one blocking item of 09c is fixed and proven on every surface that
names a track's camera; nothing of BLOCKER or MAJOR class was met. The row's history:

| Gate | Blocking item | State now |
|---|---|---|
| 09 (first gate) | several | closed by 09b / 09c (their sections 2) |
| 09b | G70b-01 (adopted camera refused until a restart) | CLOSED at 09c |
| 09c | **G70c-01** (tablet Home / Session New name the camera a track had before) | **CLOSED here** (section 2, item 1) |
| 09c minors / notes | G70c-02 .. -08 | -03, -04, -05, -06, -08 CLOSED; -02 closed on the surfaces the fix names, with a remainder (G70d-02); -07 was a method note |

Conditions:

| # | Condition | Owner |
|---|---|---|
| C1 | `M4-NODEV-B-W / -T / -P` and `M4-NODEV-NOCFG-T` stay **NOT PROVEN live**. The method approved in D227 (2) was driven and does NOT make a source unreachable: with `CAM-04` (dead address) on `VIDEO-02` the pre-check answers `LENS_2 PASS / READY` from the tablet and from the web (G70d-01). The rule is held by tests only (`src/capture-notices`, unit and db). A ruling is needed: accept as a limit of this completion line (as `M4-MIC-ACTIVE-*` in D227 (3)), or add a development switch that fails one FAKE source | controller |
| C2 | `M4-MIC-ACTIVE-W / -T / -P`: unchanged, NOT PROVEN live, ruled a limit in D227 (3) | controller (already ruled) |
| C3 | G70d-02 (MINOR): "Online" for the four selected sources at rest on the tablet's and the phone's Devices list and device detail, beside "Not checked" on the same pane; simulator role names "Interviewer" / "Subject" on lane 2 | coder-execution (apps/mobile; one web line) |
| C4 | G70d-03 (MINOR): tablet Session New - Back does nothing at the Devices Check step of an armed session; a session cancelled from another client leaves its details and an enabled Next on the tablet's form | coder-execution (apps/mobile) |
| C5 | The audio pair on the DEVICES (item 2): Home tiles draw no role at rest, so "MIC-02 is the primary" is visible on the devices only on their Devices selector; the hook-level proof is fix 157's test | controller (accept) |
| C6 | Biometric steps (skipped by the user's instruction) and every confirm path of a local-device notice (user-attended, not run) - as in 09b section 7 | user |

## 2. Items

| # | Item | Surface | Result | Evidence |
|---|---|---|---|---|
| 1 | G70c-01 with `CAM-05` on `VIDEO-02` (sealed session `SES-20261011-0048` current: `GET session/current` = `SEALED`) | W2 selector | **PASS** | Save on "Camera for Camera 2": `POST capture/cameras/CAM-05/source` 200, line "VIDEO-02 · CAM-05 · Generated test source · Profile H264_720P30 / Not checked" (`w2_02_selector_cam05.png`); audit seq 886 |
| 1 | | T Home | **PASS** | 8 s after the save: `home-device-VIDEO-02-feed-name` = "Camera 2 · Camera CAM-05", state "Not checked", badge "Development source / Test source"; Camera 1 "Camera CAM-01" (`t_01_home_cam05.png`) |
| 1 | | T Session New (step 1, the preview column with the camera tiles) | **PASS** | `session-new-feed-CAM-2-name` = "Camera 2 · Camera CAM-05", "Not checked" (`t_02_session_new_cam05.png`) |
| 1 | | P Home | shows NO camera name (by design) | "Cameras: 2 of 2. Not checked", "Microphones: 2 of 2. Primary not checked" - counts only, before and after the change (`p_00_home_baseline.png`) |
| 1 | | P Session New | shows NO camera name at step 1 | form only, no preview column (`p_01_session_new_cam05.png`). The phone names a track's camera only on its Devices selector (item 3: "Video track 2, CAM-02") and under an open session; the selector-in-force rule on the phone is by test (`wave-l-m-selector-in-force.test.ts`) |
| 1 | | W2 Dashboard | **PASS** | tiles "Camera 1 · CAM-01 · Generated test source", "Camera 2 · CAM-05 · Generated test source" (`w2_03_dashboard_cam05.png`) |
| 1 | | W2 Devices | **PASS** | tile "Camera 2 · CAM-05 · Generated test source / Not checked"; roster card `CAM-05` "Feeds Camera 2" |
| 1 | | W2 Session New | shows NO camera name at step 1 | "DEVICE READINESS 7 of 8 ready", rows by lens, no source id (`w2_04_session_new_cam05.png`); with an open session its step 2 names "Camera 2 · CAM-04 · Generated test source" (item 5, `w2_13_precheck_result_cam04.png`) |
| 1 | `CAM-02` put back | W2, T | **PASS** | `POST capture/cameras/CAM-02/source` 200 (seq 887, 72 s after 886). T Session New, still open, followed without a reload: "Camera 2 · Camera CAM-02"; W2 Devices and Dashboard "Camera 2 · CAM-02 · Generated test source"; T Home "Camera CAM-02" (read later, `t_06_home_mic02_primary.png`) |
| 1 | LOCAL naming: `CAM-03` on `VIDEO-01`, SELECT ONLY | W2 | **PASS** | seq 888 at 12:56:20; line "VIDEO-01 · CAM-03 · MacBook Air Camera · Profile H264_720P30", "This Mac's camera" (`w2_05_selector_cam03.png`) |
| 1 | | T Session New | **PASS** | `session-new-feed-CAM-1-name` = "Camera 1 · Core Mac's camera", "Not checked"; no "Camera CAM-01" (`t_03_session_new_cam03.png`) |
| 1 | | T privacy notice | **PASS** | Next (form filled before the selection): "Turn on a local device / This will turn on the Core Mac's camera (CAM-03). / The device check opens the device. Nothing is sent to the Core until you confirm." - the same device as the tile behind it (`t_04_priv_notice.png`). **"Not now"** pressed; the confirm was never pressed |
| 1 | | T Home | **PASS** | after discarding the form: `home-device-VIDEO-01-feed-name` = "Camera 1 · Core Mac's camera", `-source-kind` = "Core Mac's camera" - no "Test source" on that tile; Camera 2 keeps "Test source" (`t_05_home_cam03.png`) |
| 1 | `CAM-01` put back at once | W2, API, T | **PASS** | seq 889 at 12:56:59 - `CAM-03` was named for **39 s**. `GET capture/config` = `CAM-01` / `CAM-02`, `locked false`; T Home "Camera 1 · Camera CAM-01". `pgrep -fl "ffmpeg\|avfoundation\|capture-worker"`: nothing before the selection, after the put-back and at the end. Between 888 and 889 the audit holds no row (no session, no pre-check): the notice's "Not now" sent nothing |
| 2 | Audio pair: `MIC-02` PRIMARY / `MIC-01` STANDBY ("Make primary" on the web selector; sealed session current) | W2 selector | **PASS** | `POST capture/mics/MIC-02/primary` 200, seq 890; lines "MIC-01 ... Standby", "MIC-02 ... Primary" |
| 2 | | W2 Dashboard devices panel | **PASS** | "MIC 1 ... Standby", "MIC 2 ... Primary" (`w2_06_dashboard_mic02_primary.png`) |
| 2 | | W2 Session Monitor audio panel | **PASS** | `data-active-input="MIC-02"`; "MIC 1 Standby", "MIC 2 Active" - beside the sealed session's own fact "Audio source: MIC 1 from 0:00 to 0:47" (decision 1 of note 157) (`w2_07_monitor_mic02_primary.png`; the panel's texts overlap at 1440 x 900, G70d-05) |
| 2 | | T Home microphone tiles | **no role drawn at rest** | "MIC 1, Not checked", "MIC 2, Not checked" - neither tile says Primary / Standby or names an input (`t_06_home_mic02_primary.png`). Nothing wrong is stated; the expected "names MIC-02 as the primary" cannot be read here (C5) |
| 2 | | P Home | **no input named** | "Microphones: 2 of 2. Primary not checked" (`p_02_home_mic02_primary.png`) |
| 2 | | T Devices selector (where the tablet does name the pair) | **PASS** | rows "MIC-02, Primary", "MIC-01, Standby" (`t_07_devices_selector_mic02_primary.png`) |
| 2 | put back | W2, API, T | **PASS** | `POST capture/mics/MIC-01/primary` 200, seq 891 (68 s); `GET capture/config` `MIC-01 PRIMARY` / `MIC-02 STANDBY`; Dashboard "MIC 1 Primary / MIC 2 Standby"; Monitor `data-active-input="MIC-01"`, "MIC 1 Active / MIC 2 Standby"; T selector "MIC-01, Primary" / "MIC-02, Standby" |
| 3 | G70c-02 "Not checked" at rest - web | W2 | **PASS** | Devices tiles "Camera 1 · CAM-01 · Generated test source / Not checked" (both); roster `CAM-03`, `CAM-04`, `CAM-05`, `MIC-03` "Not checked"; drawer of `CAM-04`: "Not checked", "Source: Generated test source", "Model: Generated test source", "Address 127.0.0.1:64850" (`w2_09_drawer_cam04.png`); four selector lines "Not checked"; `CAM-05` and `CAM-04` ON a track "Not checked" (`w2_02`, `w2_10_selector_cam04.png`). Word counts over the page text of Dashboard, Monitor, Devices, Network & Time, Storage, System: "Reachable" 0, "Live" 0 (the Monitor's own subtitle aside), "Online" 1 (Devices summary "OTHER DEVICES 3/3 Online", under its chip) |
| 3 | G70c-02 - tablet / phone, the surfaces fix 155 names | T, P | **PASS** | camera sheet "Camera for Video track 2": `CAM-01` .. `CAM-05` each "Not checked", incl. `CAM-04` / `CAM-05` on dead ports and `CAM-03` (`t_08_sheet_camera_track2.png`, `p_05_sheet_chip_tap_cam05.png`); selector lines "Video track 1, CAM-01, Not checked" (T `t_07`, P `p_03_devices_top.png`); T Home tiles and chips "Not checked" (`t_00_home_baseline.png`); P Home "Not checked" / "Primary not checked"; roster rows `CAM-03/-04/-05`, `MIC-03` "Not checked" |
| 3 | G70c-02 - tablet / phone, Devices list rows and detail of the four SELECTED sources | T, P | **FAIL (remainder)** | G70d-02: "Online" |
| 3 | generated sources named as generated | W2, T, P | **PASS** | W2 page-text counts on the six pages: "Dual-lens" 0, "DL-2" 0, "condenser" 0, "UM-1" 0, "GAIN" 0, "PHANTOM" 0, "Lens 1" 0. T: selector "CAM-01" with no model, microphone rows without "USB"; list rows "Generated test source"; detail of `CAM-01`: "Source: Generated test source", "Format: H264_720P30" (`t_11_detail_cam01.png`); detail of `MIC-01`: Status, Device ID, Source, Clip latch, Recording track - no gain, no phantom power (`t_12_detail_mic01.png`). P: the same rows (`p_06_devices_list.png`). Remainder: the names "MIC 1 – Interviewer" / "MIC 2 – Subject" (G70d-02) |
| 3 | "Synthetic demo values" chip - where seen | W2, T, P | **PASS** | W2 Devices: SUMMARY "OTHER DEVICES" and "PORTS LINKED", OTHER DEVICES, FRONT PANEL, PORT MAP; Network & Time: `network`, `domains`; Storage: `usage`, `volumes`, `calculator`; System: `system-banner`, `services`, `health`, `update`, `maintenance` (test ids `synthetic-values-*`). T: Devices "Other Devices" header (`t_09_devices_list_mics.png`), Health tab of `CAM-01` ("Link quality (%) ... Now 99.5%" under the chip). P: Devices "Other Devices" header (`p_06`) |
| 3 | lane 1 keeps its demo names | W1 | **PASS** | Devices: "Dual-lens" 10, "DL-2" 9, "condenser" 8, "UM-1" 8, "GAIN" 2, "PHANTOM" 2, "Lens 1" present; "Not checked" 0, "Generated test source" 0, "Development source" 0, "Synthetic demo values" 0; tiles with the room picture and "1080p · 25 fps" (`w1_01_devices_lane1.png`) |
| 4 | G70c-03: tap ON the "Development source" chip of an option row | P | **PASS** | sheet "Camera for Video track 2", tap at (363, 1872) = the chip of the `CAM-05` row (FAKE): `capture-source-option-CAM-05` `selected true`, the row framed, Save enabled (`p_05_sheet_chip_tap_cam05.png`). Cancel pressed - nothing saved, `GET capture/config` unchanged (so no put-back was needed) |
| 4 | G70c-06: tablet Session New with the link down | T | **PASS** | `adb -s emulator-5556 reconnect` at 13:01:23: banner "Core server unreachable / This device is not connected to the Core server. Recording can start once the connection is back.", "Checking the capture sources…", Next disabled; card "Live device status / Not connected to the Core server. The device status is not known until the connection is back.", **"Core Machine OFFLINE"**, "Video Lens 1 Not known", "Video Lens 2 Not known" - no "ONLINE" on the screen, three reads 4 s apart (`t_13_session_new_link_down.png`). Both rules restored and read back (`tcp:8081 tcp:8081`, `tcp:4420 tcp:4422`); 8 s later "Core Machine ONLINE", banner gone; Home "Core Live"; Core `ws.clients 3` |
| 4 | G70c-04: boot line | Core log | **PASS** | `.locks/core-server.lane2.log:29` `CAPTURE_CONFIG_LOADED devices 9, revision 2, locked false` on a database whose last session is `SEALED`; `GET capture/config` `locked false` |
| 4 | G70c-05: a search with no session open | W2, audit | **PASS** | "Search for cameras" at 13:02:29 (`POST capture/discovery` 202): audit seq 892 `CAPTURE_DISCOVERY_SEARCHED`, row `sessionId` null, `details` = `{scope CAMERA_NETWORK, outcome COMPLETE, trigger MANUAL, newCount 1, searchId DSC-000007, responderCount 1, registeredCount 0, ...}` - no `sessionId` member (the session slot held the SEALED `SES-...-0048` at that time) |
| 4 | G70c-08: a card for an unassigned registered camera | W2 Devices | **PASS** | while `CAM-05` fed Camera 2: "REGISTERED CAMERAS: Camera CAM-02 · Not checked · Not assigned", then `CAM-03`, `CAM-04`, `CAM-05` ("Feeds Camera 2"); after the put-back the `CAM-02` card is gone and `CAM-05` reads "Not assigned" |
| 5 | `M4-NODEV-B-T`: `CAM-04` on `VIDEO-02` (seq 893), new session on the tablet, Devices Check | T | **NOT PROVEN - the dead camera is NOT reported** | G70d-01. Session `SES-20261011-0049` (seq 894, `DEV-0001`); "8 of 8 checked / All checks passed"; "Video Lens 2, READY, PASS" (`t_14_precheck_running.png`, `t_15_precheck_result.png`); `session/current`: `ARMED`, `precheck.outcome PASS`, `LENS_2 {status PASS, value READY}`; audit 895 `PRECHECK_PASSED {warnings 0}`. No warning row, no sentence, no "Search again" / "choose another source" offered; no alert (37, none active); no `CAPTURE_DEVICE_UNREACHABLE` row; no pre-check search (no `trigger PRECHECK` row); Core log of the window: 0 warn / error lines. Recording was NOT started |
| 5 | `M4-NODEV-B-P` (the same session seen on the phone) | P | NOT PROVEN, same | Home "Ready for Recording", action "Continue setup" (`p_07_home_session_armed.png`); "Continue setup" -> step 3 "Ready to record ... Devices: All devices ready", "Start Recording" (not pressed) (`p_08_session_new_step2_cam04.png`) |
| 5 | `M4-NODEV-B-W`: the same from the web | W2 | NOT PROVEN, same | first the tablet's session seen on the web: step 3 "READY TO RECORD ... All devices ready" (`w2_11_session_new_step2_cam04.png`); cancelled there ("Cancel" -> "Discard session": `POST session/SES-20261011-0049/cancel` 204, seq 896 `SESSION_CANCELLED {fromState ARMED}`). Then a new session on the web: `SES-20261011-0050` (seq 897), `POST .../precheck` 202, "8 of 8 checks complete / All checks passed", "Video Lens 2 · Development source · Test source · READY · PASS", preview "Camera 2 · CAM-04 · Generated test source / Not checked" (`w2_12_precheck_running.png`, `w2_13_precheck_result_cam04.png`); seq 898 `PRECHECK_PASSED`; cancelled (204, seq 899) |
| 5 | put back, no session open | W2, API | **PASS** | seq 900 `CAM-04 -> CAM-02`; `GET capture/config` = `CAM-01` / `CAM-02` `H264_720P30`, `MIC-01 PRIMARY` / `MIC-02 STANDBY`, `locked false`; `GET session/current` = `{"session": null}`; alerts 37, none active |
| 6 | spot-check: a search lists the stub as NEW after this start | W2 | **PASS** - stopped there | "1 found · 1 new · 0 already registered / Searched 1 network.", row "127.0.0.1 / FAKE-CAM-1 / Development source · Test source / Fake Camera 1 / New / Connect", "Searched at 13:02:29. Kept until 13:12:29. Only you see this list, on this device." (`w2_08_search_new.png`). "Connect" not pressed: no connection test, no adoption, no `CAM-06` |
| 7 | Logcat over items 1-5 | T, P | **PASS** | T: 111,174 lines 12:52:17 - 13:07:38 (reader resumed at 13:01:22.6 after the transport reset, from the device buffer); P: 58,079 lines. `E/ReactNativeJS`: **0 / 0**; `FATAL EXCEPTION` / `ANR in`: 0 / 0; token shapes: 0 / 0; mount warnings: 0 / 0. `W/ReactNativeJS`: T 10 lines at 13:01:23, all one message ("Cannot connect to Expo CLI ... URL: localhost:8081") = my own cut of the adb rules; P 0 |

## 3. Findings

| ID | Severity | What | Steps / evidence | Spec |
|---|---|---|---|---|
| **G70d-01** | MINOR (and the reason C1 stays open) | A registered FAKE camera whose stored address answers nothing passes the pre-check as "READY / PASS"; the approved method cannot make situation B happen on a lane | Item 5, both clients. Cause, read in code: the generated adapter never dials the stored address - `apps/core-server/src/capture/adapters/fake/camera.ts:26` (`host` is "Host and port of the fake's locator"), `:122` (the locator is built from it), and a source fails only through the test hook `failOpen` (`:42`, `:134`). So `CAM-04` (adopted from the stub at `127.0.0.1:64850`, a port nothing listens on) is as openable as `CAM-02`. Not a wrong recording (the source is a generated picture and is labelled so); but the pre-check row states "READY" for a registered camera nobody reached, and R-10 situation B has no live proof on any client | `10_test_strategy.md:349` (`M4-NODEV-B-W/-T/-P`: warning row naming the device with the search count, start after acknowledging); specs R-10 AC-2, AC-4, AC-5; D227 (2) |
| **G70d-02** | MINOR | Remainder of G70c-02 on the devices: the Devices LIST rows and the device DETAIL of the four selected sources read "Online" at rest, beside "Not checked" for the same source on the same pane; simulator role names remain | T list: `device-status-CAM-01` / `-CAM-02` / `-MIC-01` / `-MIC-02` = "Online" (green dot) while the roster rows under them read "Not checked" (`t_09_devices_list_mics.png`, `t_10_devices_list_cameras.png`). T detail of `CAM-01`: tile "Camera 1 · Camera CAM-01 / Not checked", chip "Online", row "Status: Online" (`t_11_detail_cam01.png`); `MIC-01`: chip and Status "Online" with the meter "No signal" (`t_12_detail_mic01.png`). P list: the same four "Online" (`p_06_devices_list.png`). Names: "MIC 1 – Interviewer", "MIC 2 – Subject" on T / P list and detail, and "MIC 1 - Interviewer" / "MIC 2 - Subject" on W2 Session New step 2 (`w2_13_precheck_result_cam04.png`) - the roles of the simulator's room on a Core whose microphones are generated tones (the web sweep of note 154 removed "Interviewer" from Devices and Dashboard: count 0 there). Fix 155's table lists sheet, selector lines, Home tiles, "No preview" tile, roster; these rows are not in it | ruling in D231 ("'Not checked' on both clients for a source at rest"); contract_wave_l section 5 (generated sources named as generated) |
| **G70d-03** | MINOR | Tablet Session New: no way back at the Devices Check step of an armed session; a session cancelled elsewhere leaves a stale, startable form | (a) After the pre-check passed (`SES-...-0049`, ARMED) the on-screen Back (`session-new-back`, three taps) and the system Back changed nothing: no discard dialog, same screen (`t_16_after_back.png`). The only control was Next. I cancelled from the web. (b) After that cancel (and after the web's own `SES-...-0050` was created and cancelled) the tablet's Session New stood at step 1 holding the cancelled session's case number and subject, Next enabled, and its on-screen Back again did nothing (`t_17_session_new_after_cancel.png`, 13:08); the system Back then opened "Discard this session? / The details you entered will be lost and the session is cancelled." - for a session that no longer exists. Before any session was created the same arrow worked (12:54, 12:56). 09c listed the dead arrow under "seen, not examined". Cause NOT established | ux: every step of the wizard has a way out; a screen follows the session's state |
| G70d-04 | NOTE | "Not checked" beside "READY / PASS" for the same source | After a passed pre-check the camera tile beside the rows still reads "Not checked" on T (`t_15_precheck_result.png`) and W2 (`w2_13`); before any check W2 Session New step 1 reads "DEVICE READINESS 7 of 8 ready ... Video Lens 2" green with `CAM-05` (dead port) on the track, T "Live device status ... Video Lens 1 READY", W2 Dashboard / Devices tiles "READY" above "Not checked", strip "2 Cameras Ready", "ALL DEVICES READY 7/7". The engine words were ruled out of this task (D231: "engine 'READY' tiles ... are not in this task"; note 155 "Not changed (as ruled)"): listed so the ruling is taken with the pictures. The Core still sends `online true, streamState LIVE` and no `checkedAt` for every line (D217 (6)) | D231; D217 (6) |
| G70d-05 | NOTE | Three smaller things seen | (a) W2 Session New step 1 shows the id of the SEALED session (`SES-20261011-0048`) in the header chip of a session not yet created (`w2_04_session_new_cam05.png`). (b) W2 Session Monitor, audio panel at 1440 x 900 with a sealed session: "Audio source" and its bar are drawn over the two "NO SIGNAL" lines, the tiles show "Standby" / "Active" without "MIC 1" / "MIC 2" in view (`w2_07_monitor_mic02_primary.png`; the page text and `data-active-input` are right). (c) The pre-check rows name the microphones ("Primary microphone · MIC-01") but not the cameras ("Video Lens 2" + badge only) on T and W2 - the camera id is on the preview tile beside them | ux 8f.2; G89c-08 class |
| G70d-06 | NOTE (method) | The phone's "Change" of Video track 2 opened its sheet only on my third tap | taps at (874, 1277) at about 13:00:10 and 13:00:20, screen read 2 s and 2.5 s after each: no sheet; third tap, read after 4 s: sheet open. Not established whether the sheet opens slower than 2.5 s on this emulator and my second tap closed it; no error line in logcat. Later re-checks: wait 4 s after "Change" before a second tap | - |

Not findings: the tablet's "Network: Connected" chip and "13 items sealed today" (not M4); audit
`PRECHECK_PASSED {warnings 0}` beside a `TIME` row of status `WARN` shown as "NOTE" (M2 rule, not
examined).

## 4. What stays NOT PROVEN

| Check | Why | Missing means |
|---|---|---|
| `M4-NODEV-B-W / -T / -P`, `M4-NODEV-NOCFG-T` | driven with the approved method; the generated adapter ignores the stored address (G70d-01), so no source was unreachable: no check row, no sentence, no choices, no alert, no audit row to judge | a development switch that fails ONE FAKE source at open (the adapter already has `failOpen` for tests), or a ruling that tests are the proof |
| `M4-MIC-ACTIVE-W / -T / -P` | no means (D227 (3)) | as ruled |
| Item 2 on T Home / P Home as a SCREEN | the role is drawn only while a session records; none was recorded here | one recording with the selector changed after a sealed session - or accept fix 157's hook test |
| Item 1 on the phone's Session New | the phone names sources only under an open session, where the session's own snapshot is the rule | by test |
| "Live" on a sheet option / tile WHILE a session records; "Stream live" on the selector line | no recording in this re-check (note 155 section 4, item 3) | one recorded session with the sheet / selector in view |
| The alert / audit rows of situation B, "a later reachable run leaves 0 banners" | follows from the first row | as there |
| Unchanged from 09b section 7 / 09c section 5 | biometric steps (skipped by the user's instruction: the offer was answered "Not now" on both devices, the sensor never touched); the confirm path of every local-device notice, any pre-check or start with `CAM-03` / `MIC-03` (user-attended, not run); `M4-DISC-LAN-1`; the lock-out sentence; adapter refusals of ops 78 / 79 live | as there |

## 5. Local devices, lapses

- `CAM-03` was named on `VIDEO-01` once, 39 s (seq 888 -> 889), select only. No pre-check, no
  start, no confirm of the notice ("Not now"), no attendance variable, no TCC. `MIC-03` was never
  selected. `pgrep` for ffmpeg / avfoundation / a capture worker: nothing at every read.
- `CAM-04` (dead address) was on `VIDEO-02` for 3 min 28 s (seq 893 -> 900) with two pre-checks -
  the method of D227 (2); nothing was recorded on it.
- The tablet's adb transport was reset once (item 4, as the brief says); both rules restored and
  read back; the logcat reader of the tablet died with it and was resumed from the device buffer.
- Lapse 1: two pre-check sessions were created where the brief pictured one per client and a
  cancel from the tablet; the tablet offered no cancel at that step (G70d-03), so the tablet's
  session was cancelled from the web.
- Lapse 2: three taps to open the phone's sheet (G70d-06).
- Lapse 3: the first command of the run was started inside the command sandbox, where adb could
  not reach its server (a stray `adb` start attempt that ended by itself); everything after ran
  outside it, as the environment note says.

## 6. Environment as left (13:10)

| Item | State |
|---|---|
| Lane 2 Core | RUNNING, PID 13991, not restarted, not reset. Stub preset `NORMAL` (mode file read, never written); stub ports unchanged; seal rig `OFF` (read, never switched) |
| Selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` (read after everything) |
| Session | none open. **`GET session/current` now answers `{"session": null}`** - the slot no longer holds the SEALED `SES-20261011-0048` (the two cancelled sessions replaced it) |
| Added to lane 2 | Two sessions created and CANCELLED from `ARMED`, never recorded: **`SES-20261011-0049`** (tablet, case `LP/2026/1011-9602`) and **`SES-20261011-0050`** (web, case `LP/2026/1011-9603`). The next session is `SES-20261011-0051`; the next case number `-9604`. Audit: 883 -> **902 rows** read (19: 2 device sign-ins, 8 selector rows 886-891, 893, 900; 1 search `DSC-000007`; 2 x created / pre-check passed / cancelled; 2 device sign-outs), then the helper's own sign-out; chain `view.ok true, stored.ok true`, 902 checked, `firstBadSeq null`. Alerts: 37 -> **37**, none active (no alert raised). Evidence: 35 items, unchanged. Capture devices: 9, unchanged (no adoption). Search ids at `DSC-000007` |
| Lane 1, web 5176 / 5177, Metro | running, untouched except one helper sign-in / sign-out on lane 1 and page reads |
| Devices | both signed out through the app (seq 901 `DEV-0002`, 902 `DEV-0001`), on Login ("You have been signed out."), fields showing only their hints, "Core online", "paired as DEV-0001" / "DEV-0002"; `GET pairing/devices`: both `PAIRED`, online; reverse rules `tcp:8081 tcp:8081`, `tcp:4420 tcp:4422` read back on both; Core `ws.clients 2`. No re-pairing, no lock change, no reboot, no app restart, biometric not enabled, volume not touched, nothing played |
| Helpers | lane 2 and lane 1 helper sessions signed out (204; lane 2 then 401), both jars removed; both headless browsers stopped, their profiles removed; logcat readers stopped |

## 7. What the next final re-checks must know

1. `session/current` of lane 2 is **null** now, not a SEALED session. A re-check that needs "a
   sealed session as the current one" (the order of G70c-01 / fix 157) must seal one first.
2. `CAM-04` / `CAM-05` on a track do NOT fail a pre-check or a start: the generated adapter does
   not read the stored address (G70d-01). Do not plan a no-device case on them.
3. Tablet Session New: once a pre-check has run there is no Back at step 2; cancel an armed
   session from the web ("Cancel" -> "Discard session", `POST session/{id}/cancel`, no body
   needed, 204) or go Next. If a session is cancelled from another client, leave the tablet's
   form with the SYSTEM Back and "Discard session" (G70d-03).
4. The stub is still a NEW candidate (nothing adopted): "Connect" and the phone pointer can be
   driven without a restart; an adoption gives `CAM-06`.
5. On the devices, read a source's state on the selector line, the sheet, the Home tile or the
   roster - the Devices list row and the detail chip of a selected source still say "Online"
   (G70d-02).
6. Wait about 4 s after "Change" on the phone before judging that a sheet did not open.
7. The web console's selector is driven reliably over CDP by clicking the line's listbox button,
   the option, then `selector-save-<TRACK>`; "Make primary" is `selector-primary-<INPUT>`
   (`.cache/gates/70d/pick.sh`).

## 8. Screenshots (`.cache/gates/70d/`, each read)

| File | Shows |
|---|---|
| `t_00_home_baseline.png` | tablet Home at rest: four tiles "Not checked", "Camera CAM-01" / "Camera CAM-02", dev toast at the bottom |
| `t_01_home_cam05.png` | tablet Home with CAM-05 selected: tile "Camera 2 · Camera CAM-05", "Not checked" |
| `t_02_session_new_cam05.png` | tablet Session New step 1, empty form: preview "Camera 2 · Camera CAM-05 / Not checked", "Core Machine ONLINE" |
| `t_03_session_new_cam03.png` | tablet Session New, form filled, CAM-03 on track 1: preview "Camera 1 · Core Mac's camera / Not checked" |
| `t_04_priv_notice.png` | notice "Turn on a local device / This will turn on the Core Mac's camera (CAM-03).", "Turn on and run the check" / "Not now", Next busy behind |
| `t_05_home_cam03.png` | tablet Home with CAM-03 on track 1: tile "Core Mac's camera" under the badge, "Camera 1 · Core Mac's camera"; Camera 2 "Test source" |
| `t_06_home_mic02_primary.png` | tablet Home with MIC-02 primary: "MIC 1 Not checked", "MIC 2 Not checked", no role; cameras back to CAM-01 / CAM-02 |
| `t_07_devices_selector_mic02_primary.png` | tablet Devices selector: "MIC-02 Primary", "MIC-01 Standby", camera lines "Not checked", no model, no "USB" |
| `t_08_sheet_camera_track2.png` | tablet sheet "Camera for Video track 2": CAM-01..05 each "Not checked", CAM-03 "Core Mac's camera" |
| `t_09_devices_list_mics.png` | tablet Devices list: "MIC 1 – Interviewer" / "MIC 2 – Subject" "Online", MIC-03 "Not checked", "Other Devices" with the chip "Synthetic demo values" |
| `t_10_devices_list_cameras.png` | tablet Devices list: "Camera 2 · Generated test source · Online", CAM-03 / -04 / -05 "Not checked" |
| `t_11_detail_cam01.png` | tablet detail of Camera 1: tile "Not checked", chip "Online", "Status Online", "Device ID CAM-01" |
| `t_12_detail_mic01.png` | tablet detail "MIC 1 – Interviewer": "No signal", chip "Online", Source "Generated test source", Clip latch, no gain / phantom |
| `t_13_session_new_link_down.png` | tablet Session New with the link down: banner "Core server unreachable", "Core Machine OFFLINE", "Video Lens 1 Not known", Next greyed |
| `t_14_precheck_running.png` | tablet Devices Check running, "5 of 8 checked", "Video Lens 2 READY PASS", preview "Camera 2 · Camera CAM-04 / Not checked" |
| `t_15_precheck_result.png` | tablet Devices Check done: "All checks passed", every row PASS, CAM-04 on the preview tile |
| `t_16_after_back.png` | the same screen after Back was pressed (on-screen and system): unchanged, no dialog |
| `t_17_session_new_after_cancel.png` | tablet Session New step 1 at 13:08 still holding the cancelled session's case number and subject, Next enabled |
| `p_00_home_baseline.png` | phone Home at rest: "Camera Not checked 2/2", "Microphone Primary not... 2/2", dev toast |
| `p_01_session_new_cam05.png` | phone Session New step 1: form only, no camera named |
| `p_02_home_mic02_primary.png` | phone Home with MIC-02 primary: the same counts, no input named |
| `p_03_devices_top.png` | phone Devices: selector lines "CAM-01 / CAM-02 Not checked", "MIC-01 Primary", "MIC-02 Standby", badges |
| `p_04_sheet_camera_track2.png` | phone sheet "Camera for Video track 2": CAM-01..05 each "Not checked", CAM-02 framed, Save greyed |
| `p_05_sheet_chip_tap_cam05.png` | the same sheet after the tap on the chip of CAM-05: that row framed, Save enabled |
| `p_06_devices_list.png` | phone Devices list: "MIC 1 – Interviewer" / "MIC 2 – Subject" "Online", MIC-03 "Not checked", "Other Devices" with the chip |
| `p_07_home_session_armed.png` | phone Home while the tablet's session is armed: "Ready for Recording", "Continue setup" |
| `p_08_session_new_step2_cam04.png` | phone step 3 "Ready to record": case, subject, "Devices: All devices ready", "Start Recording" (not pressed) |
| `w2_01_devices_rest_top.png` | lane 2 Devices at rest: tiles "READY" + "No preview ... Generated test source / Not checked", roster CAM-03 / -04 / -05 "Not checked", summary chips "Synthetic demo values" |
| `w2_02_selector_cam05.png` | selector: Camera 2 "VIDEO-02 · CAM-05 · Generated test source", four lines "Not checked", toast "Capture configuration saved", chips on FRONT PANEL / PORT MAP |
| `w2_03_dashboard_cam05.png` | Dashboard: tile "Camera 2 · CAM-05 · ...", "Not checked"; strip "2 Cameras Ready"; ACTIVE SESSION "Sealed" |
| `w2_04_session_new_cam05.png` | web Session New step 1: empty form, "DEVICE READINESS 7 of 8 ready", header chip `SES-20261011-0048` |
| `w2_05_selector_cam03.png` | selector: Camera 1 "VIDEO-01 · CAM-03 · MacBook Air Camera", "This Mac's camera", saved |
| `w2_06_dashboard_mic02_primary.png` | Dashboard: "MIC 1 Standby", "MIC 2 Primary" |
| `w2_07_monitor_mic02_primary.png` | Session Monitor of the sealed session: audio tiles "Standby" / "Active" (texts overlapping), "Configured profile", banner "SESSION SEALED" |
| `w2_08_search_new.png` | Camera Search: "1 found · 1 new · 0 already registered", row 127.0.0.1 / FAKE-CAM-1 / Fake Camera 1 / New / Connect |
| `w2_09_drawer_cam04.png` | drawer "Camera CAM-04 ... Not checked", Source and Model "Generated test source", Address 127.0.0.1:64850, "Not assigned" |
| `w2_10_selector_cam04.png` | selector: Camera 2 "VIDEO-02 · CAM-04 · Generated test source / Not checked", saved; search row "New" above |
| `w2_11_session_new_step2_cam04.png` | web step 3 for the tablet's session `SES-20261011-0049`: "READY TO RECORD", "All devices ready", "Start Recording" (not pressed) |
| `w2_12_precheck_running.png` | web Devices Check of `SES-20261011-0050` running, "3 of 8", "Video Lens 2 READY PASS", preview "Camera 2 · CAM-04", "MIC 1 - Interviewer" |
| `w2_13_precheck_result_cam04.png` | the same done: "All checks passed", "8 of 8 checks complete", Time Sync NOTE |
| `w1_01_devices_lane1.png` | lane 1 Devices: room pictures, "Lens 1 · VIDEO-01", "Dual-lens DL-2 on PoE CAM 1", GAIN / PHANTOM POWER, no development badge |

---
*Generated: 2026-10-11 13:14 WIB*
