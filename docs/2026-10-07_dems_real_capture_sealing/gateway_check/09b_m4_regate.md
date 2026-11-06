---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 70 (M4 milestone gate, independent +1) - RE-GATE
date: 2026-10-10
agent: verifier
narrative_tier: 2
tree: commit 74fd1f1 (product code unchanged by this gate; `git status` = documentation only)
supersedes: nothing - read together with gateway_check/09_m4_gate.md (first gate, FAIL)
status: needs-review
verdict: FAIL (one blocking item, G70b-01) - see section 1
---

# 09b - M4 milestone gate, re-gate (row 70)

Run window 19:11-19:45 WIB on the environment of `initialization/06_gate_environment_regate.md`.
No product or test file changed, no git write, no install. Evidence under the git-ignored
`.cache/gates/70b/` (45 screenshots, 1 start log). Surfaces: W1 / W2 = web console lane 1
(SIMULATED, 5176) / lane 2 (REAL_DEVELOPMENT + camera stub, 5177), headless Chromium over CDP,
signed in with the session helper's cookie (no password typed in a browser); T = tablet
`emulator-5556` on lane 2; P = phone `emulator-5554` on lane 1. Audit rows are from
`GET /api/v1/audit` of the lane; "Core log" is `.locks/core-server.lane<N>.log`.

**Lane 2 was restarted once by this gate (19:37)** - section 8 says why and what it changed.

## 1. Verdict

**FAIL - one blocking item.** Everything the first gate could not run was run, and almost all of
it passed: the stub launcher works on a live lane, discovery and the connect dialog behave as
specified on web and tablet, the three first-gate blockers are closed. The verdict is FAIL because
a named clause of `M4-CONN-W` fails live with a MAJOR defect, and a gate row cannot close with a
Major open:

| # | Blocking item | Owner |
|---|---|---|
| G70b-01 | A camera added through "Add as camera" **cannot be assigned through the selector until the Core is restarted**: `422 DEVELOPMENT_SOURCE_NOT_ALLOWED`, shown as "This source can only be used in the development configuration." on a Core that IS in the development configuration. After a lane restart the same assignment succeeds | coder-execution (capture adapter registry / capture-config), then one targeted re-drive |

Needs a ruling, not a fix (unchanged from the first gate, now with the means named):
`M4-NODEV-B-*` and `M4-MIC-ACTIVE-*` are still NOT PROVEN on any client - nothing on a lane can
make ONE generated source unreachable (section 3.3).

First-gate blockers: **B-1 closed, B-2 (G70-01) closed, B-3 (G70-02) closed** (section 2).

## 2. Entry condition and the first gate's blockers

| Item | State now | Evidence |
|---|---|---|
| "0 Blocker / Major open" of review 69 (R69-01..03, D181 / D184) | MET, carried | Verified in code and test at the first gate; the fixes are inside the whole suites of `test/08_precommit_wave_h.md` (0 failed). R69-01 re-proven live here (section 5). Not re-read line by line in this run |
| B-1 no way to give a running lane the stub | **CLOSED** | lane 2 runs `--with-camera-stub`; Core log `LANE_CAMERA_STUB_STARTED ... bound discovery:127.0.0.1:63879,device:127.0.0.1:64850,rtsp:127.0.0.1:64851`; searches, tests and an adoption driven from clients (3.1, 3.2). The launcher also survived a stop / start by this gate (new ports 49344 / 52021 / 52022, new fixture file, mode file back to `NORMAL`) |
| B-2 = G70-01 SIMULATED Core states a source class | **CLOSED** | W1 Devices: 0 badge elements, 0 "Development source", 0 "Test source" before AND after the microphone re-read; result rows "MIC 1 (MIC-01) Ready / MIC 2 (MIC-02) Ready" - `w1_mic_rescan.png` |
| B-3 = G70-02 no client assigns a third microphone | **CLOSED** on web and tablet with `MIC-03`; phone shows the same sheet on its lane's two microphones | section 3.4 |
| New at this gate | **1 MAJOR open: G70b-01** | section 6 |

## 3. Checks

### 3.1 Discovery

| Check | Surface | Result | Evidence |
|---|---|---|---|
| M4-DISC-W | W2 | PASS | "Search for cameras": button disabled at once, 84 ms "Searching the network for cameras... / This takes up to 3 seconds." (no countdown), 3086 ms "1 found - 1 new - 0 already registered / Searched 1 network." with ONE row `127.0.0.1 / FAKE-CAM-1 / Development source - Test source / Fake Camera 1 / New / Connect`, trust sentence, "Searched at 19:13:50. Kept until 19:23:50. Only you see this list, on this device." - `w2_disc_searching.png`, `w2_disc_result.png`. Audit seq 93 `CAPTURE_DISCOVERY_SEARCHED {scope CAMERA_NETWORK, searchId DSC-000002, responderCount 1, newCount 1, operationId startCaptureDiscovery}`. After the adoption "Search again" replaced the list (row "Already registered CAM-04 ... View device", no Connect); after the restart: New + Connect again. Row count = N = 1 each time. Conflict rows: not producible with one stub device |
| Loopback only | Core | PASS | Core log `CAPTURE_DISCOVERY_SEARCHED ... datagramsSent 4, datagramsReceived 4, datagramsAccepted 4, sendErrors 0, dropped {}`; `lsof -a -p <core> -i` before and after the restart: every socket on `127.0.0.1` (4422, the stub's UDP + two TCP ports, PostgreSQL 4432). The log line prints no destination: "loopback only" rests on the socket list + the launcher's construction (note 124 section 2) |
| M4-DISC-OWNER-W | W2, second browser profile, TECHNICIAN | PASS | Same lane, other operator: panel idle ("Search for cameras ... Searching connects to nothing."), no list; `GET capture/discovery` as that operator: `{"search":null,"candidates":[]}`; as the owner: the candidate. With the empty-search alert raised the second operator saw the banner + alert-centre item only - `w2_owner_second_operator.png` |
| M4-DISC-EMPTY-W (notification A) | W2, preset `EMPTY` | PASS | Panel: "No camera answered the search / Check that each camera is powered and on the same network as the Core, then search again." + "Search again"; page banner "No camera found / The last search found no camera on the network." + "Search again"; bell "Notifications, 1 new alert", alert centre ONE item - `w2_disc_empty_result.png`, `w2_disc_empty_top.png`, `w2_disc_empty_bell.png`. `GET alerts`: one `SYSTEM WARNING {reason CAPTURE_DISCOVERY_EMPTY, searchId DSC-000003}`. Audit seq 108 `responderCount 0`. Not driven: five searches (two were made: web + tablet -> still 1 alert) |
| M4-DISC-EMPTY-T | T, preset `EMPTY` | PASS | The web's alert was already on the tablet ("No camera found" card + "Search again"); the tablet's own search: "No camera answered the search" + "Search again", audit seq 110 with `deviceId DEV-0001`; `GET alerts` still ONE alert. Then preset `NORMAL` + "Search again": list drawn, the banner gone, alert `active: false` (0 stale banners) - `t2_disc_empty.png`, `t2_disc_result_registered.png` |
| M4-DISC-T | T | PASS (progress frame not captured) | Before the restart: "1 found - 0 new - 1 already registered", row "127.0.0.1 / FAKE-CAM-1 / Fake Camera 1 / Already registered CAM-04 / View device" with the badge. After the restart: "1 found - 1 new", row "New" + badge "Development source / Test source", freshness + "Only you see this list, on this device." - `t2_disc_new_candidate_connect_pointer.png`. Audit seq 136 `deviceId DEV-0001`. The "searching" state was not caught (a uiautomator dump takes longer than the 3 s window; `t2_disc_searching.png` shows the idle panel just before the tap took effect) |
| M4-DISC-P, M4-DISC-EMPTY-P | P | NOT PROVEN on the phone | The phone is on lane 1 (SIMULATED): "Search for cameras" answers `POST capture/discovery 503`, the panel reads "Camera search is not available on this Core yet." + Retry - `p1_disc_not_available.png`. A candidate on the phone needs the phone on lane 2 = a new pairing (not asked). Same component as the tablet; jest `capture-selector/camera-search.test.tsx` |
| M4-DISC-RBAC-T | T, INVESTIGATOR | PASS ("Checking..." not observed) | "Search for cameras" DISABLED + "Requires the Supervisor or Technician role"; the four "Change" controls and "Search again for microphones" DISABLED, the role sentence once at the foot; Core log after that sign-in: `sign-in`, `auth/touch`, `health` only - 0 calls of op 94 - `t2_devices_investigator.png` |
| M4-DISC-RBAC-W / -P | - | carried | PASS at the first gate; not re-driven (D122) |

### 3.2 Connect (web, lane 2)

| Check | Result | Evidence |
|---|---|---|
| M4-CONN-W - dialog | PASS | "Connect Fake Camera 1": Address `127.0.0.1`; "The Core will connect to `http://127.0.0.1:64850/onvif/device_service`" (scheme, host, port, path); make / model; device reference; "This device has not been verified..."; badge; and the tick "I have checked that http://127.0.0.1:64850/onvif/device_service is this camera" - Test stays disabled until it is ticked - `w2_connect_dialog_open.png`. For this DEVELOPMENT candidate the two fields sit behind the switch "Enter a user name and password" ("This development source needs no password.") |
| M4-CONN-W - fields | PASS | Switch on: two inputs, both empty (`value` length 0), `autocomplete="off"` / `"new-password"`, `data-1p-ignore`, `data-lpignore`, `data-bwignore`, password `type="password"`, reveal `aria-pressed="false"`. Test disabled with the user name only; enabled only with both typed and the tick |
| M4-SEC-UI-1 | PASS for what was driven; two parts NOT RUN | While typed (13 + 13 characters): `getAttribute('value')` is `null` on both inputs; the typed strings occur 0 times in `documentElement.outerHTML`, the page text, `location.href`, `localStorage`, `sessionStorage`, `document.cookie`, and in 0 console lines; the same after every outcome and after close. A refused test clears the password field. NOT RUN: "after a saved console login" (the headless profile holds no stored login; only the anti-autofill attributes were read), the reveal control's behaviour when pressed, the API reference "Try it" deny list (10) - web tests `live-api-reference-*.test.tsx` only |
| Outcome: fixture account, `NORMAL` | PASS | "Connection works. This camera can be added. / 1 usable video profile" + "Add as camera" - `w2_conn_success.png`; audit seq 96 `CAPTURE_CONNECTION_TESTED {outcome REACHABLE}` |
| Outcome: `AUTH_SCHEME` | PASS | "This camera only accepts a sign-in method that this system does not use. The password was not sent. / A camera with this setting cannot be connected by this version of the system. Typing the password again does not help." - never "wrong password" - `w2_conn_AUTH_SCHEME.png`. Did not count against the guard (see G70b-05) |
| Outcome: `UNREACHABLE` | PASS | "The camera did not answer. Check its power and network cable, then test again." (audit `UNREACHABLE`) |
| Outcome: `NO_PROFILE` | PASS | "The camera answered, but it offers no video profile this system can use. Change the video settings on the camera, then test again." (audit `WRONG_PROFILE`) |
| Outcome: `NOT_H264` | PASS | "The camera answered, but none of its video profiles is H.264. Set the camera to H.264, then test again." (audit `NOT_H264`) |
| Outcome: a WRONG account, once | PASS | "The camera refused this user name or password. / 1 more attempt before testing this camera is paused." - `w2_conn_wrong_account.png`; audit seq 95 `{outcome AUTHENTICATION_FAILED, guardTripped false}`. No outcome drew another outcome's message |
| M4-CONN-GUARD-W | PASS for the one refusal; lock-out half by tests | The attempts text follows the server (2 -> "1 more attempt" after one refusal; back to "2 more attempts" after a reachable test); no client countdown. Two refusals + the lock-out sentence + disabled Test: NOT DRIVEN by instruction (it would hold tests of 127.0.0.1 for 30 minutes); `capture-discovery/connect/__tests__/limits.test.ts` inside the unit suite of note 08 |
| M4-CONN-NOCRED-1 | UI half PASS; API half by tests | Fields open empty, never pre-filled; Test disabled until both are typed (switch on). `422 CREDENTIAL_REQUIRED` for a PRODUCTION candidate with 0 outbound requests: not drivable (the stub is a DEVELOPMENT candidate) - db / unit suites |
| M4-CONN-ABANDON-W | PASS for Close | Closed after a successful test: dialog gone, 0 inputs hold a typed value; reopened: switch off, tick off, no fields; switch on: both empty. `GET capture/devices`: still 7; candidate `status NEW, deviceId null`. Not driven: Escape, sign-out. Not read: the row count of `capture_device_credentials` (no database access by rule) |
| "Add as camera" (op 96) | PASS | `POST .../adopt` 201; "CAM-04 was added. / FAKE-CAM-1 / Password stored. / The camera is registered but not yet used. Assign it to Camera 1 or Camera 2." - `w2_conn_added.png`; roster card "Camera CAM-04 - Ready - Development source / Test source - Not assigned"; the search row turned "Already registered CAM-04 ... View device". Audit seq 103 `CAPTURE_CONNECTION_TESTED (adoptCaptureCandidate)`, 104 `CAPTURE_CREDENTIAL_SET {deviceId CAM-04}`, 105 `CAPTURE_CANDIDATE_ADOPTED {credentialSet true}` - no credential text in any row or log line |
| **Assign the added camera through the selector** | **FAIL (G70b-01)**, then PASS after a restart | Selector "Camera for Camera 2" offers `CAM-04 - FAKE-CAM-1 - Development source`; Save -> `POST capture/cameras/CAM-04/source` **422**, under the control: "This source can only be used in the development configuration." - `w2_selector_cam04_assigned.png`; selector unchanged, no audit row. After the lane restart the same press answered 200: line "VIDEO-02 - CAM-04 - FAKE-CAM-1", roster "Feeds Camera 2", audit seq 126 - `w2_selector_cam04_assigned_after_restart.png`; put back at once (seq 127, `CAM-04 -> CAM-02`). No pre-check was run with CAM-04 on a track |
| M4-CONN-LOCK-W | PASS | With `SES-20261010-0024` open on lane 2 (created from the web, pre-check passed on the four FAKE sources): Connect DISABLED, beside it and as its description "A camera cannot be connected while a session is open."; selector panel locked with its sentence; 0 toasts; "Search again" enabled and it ran (audit seq 131, with the session id); `POST .../candidates/<id>/test` -> `409 CAPTURE_CONFIG_LOCKED` - `w2_connect_locked_session_open.png`. Session cancelled after (seq 132, from ARMED). During RECORDING: not driven (gate 75's area) |
| M4-CONN-PTR-T | PASS | Tablet, NEW candidate listed: button "Connect" DISABLED, label "Connect 127.0.0.1. Connect this camera from the web console.", the sentence under the row, and "Camera passwords are entered on the web console only. Open Devices on the web console and search there."; view tree: `password fields: 0, EditText: 0`; Core log for the flow: `POST capture/discovery` 1, `GET capture/discovery` 4 - 0 calls of ops 95 / 96 / 89 - `t2_disc_new_candidate_connect_pointer.png` |
| M4-CONN-PTR-P | NOT PROVEN on the phone | No candidate can be listed on lane 1. Devices screen there: `password fields: 0, EditText: 0`. Component: `capture-selector/camera-search.test.tsx`; static `no-credential-inputs.static.test.ts` |

### 3.3 Notifications

| Check | Result | What could and could not be reached |
|---|---|---|
| M4-NODEV-A (clients) | PASS | = `M4-DISC-EMPTY-W/-T` above: one alert in the Core across web (two operators) and tablet, resolved by the next search with a responder |
| M4-NODEV-B-W/-T/-P, M4-NODEV-NOCFG-T | **NOT PROVEN** | Lane 2 has no control that stops ONE generated camera or microphone (no stub preset does it: the presets act on the discovery / connect stub, not on `CAM-01` / `CAM-02`; a real-mode Core has no demo controls). Lane 1 has the demo controls but answers the M2 rule: `POST demo/faults {kind CAMERA_LOSS, target {cameraId VIDEO-02}}` -> pre-check "Video Lens 2 / Camera 2 lens fault / BLOCK", audit `PRECHECK_BLOCKED {reasons LENS_FAULT}` - `w1_precheck_camera_loss.png` - not the R-10 warning row with the search count. Missing means: a development switch that makes one FAKE source of lane 2 unreachable at pre-check. Server rule: `src/capture-notices` in the suites of note 08 |
| M4-MIC-ACTIVE-W/-T/-P | **NOT PROVEN** | Same gap. Lane 1 with `MIC_NO_SIGNAL`: "MIC (primary): no signal / WARN" + "Acknowledge warnings" (the M2 rule) - `w1_precheck_mic_no_signal.png` - not "blocked with its sentence" |

### 3.4 Selector, G70-02, spot-checks

| Check | Surface | Result | Evidence |
|---|---|---|---|
| G70-02 | W2 | PASS | Primary line offers `MIC-01` (selected), `MIC-02 ... already on the standby line` DISABLED, `MIC-03 - MacBook Air Microphone - This Mac's microphone - Development source`; the standby line mirrors it - `w2_selector_mic_options.png`. `MIC-03` saved on the primary line (SELECT ONLY): `POST capture/config {mics:[{MIC-03 PRIMARY},{MIC-02 STANDBY}]}` 200; line shows "Not fit for recording yet. Use it for development checks only." - `w2_selector_mic03_primary.png`; audit seq 106 `CAPTURE_CONFIG_CHANGED {field SOURCE, scope MIC, from MIC-01, to MIC-03, operationId updateCaptureConfig}`; put back 12 s later (seq 107), confirmed by `GET capture/config`. The limit sentence shows on the LINE once selected, not inside the option |
| G70-02 + G70-05 | T | PASS | Sheet "Standby microphone / Every registered microphone. The primary microphone stays as it is.": `MIC-01` DISABLED "This is the primary microphone. One microphone cannot be on both lines."; `MIC-02`; `MIC-03 ... Core Mac's microphone` with "Not fit for recording yet..." - `t2_sheet_standby_mic.png`. `MIC-03` saved on the standby line: `GET capture/config` = MIC-01 PRIMARY / MIC-03 STANDBY; audit seq 112 `CAPTURE_CONFIG_CHANGED ... operationId updateCaptureConfig` with **`deviceId DEV-0001`** (G70-05 closed, by a paired device's own request); the web page followed without a reload (AUDIO-02 card "This Mac's microphone") - `t2_selector_mic03_standby.png`, `w2_audio_cards_mic03_standby.png`; put back (seq 113, `DEV-0001`), confirmed |
| G70-02 | P | PASS on lane 1's devices | Sheet lists every registered microphone of that Core (`MIC-01` DISABLED with the reason, `MIC-02`) - `p1_sheet_standby_mic.png`. A third microphone exists only on lane 2 |
| Nothing opened by the selects | Core | PASS | `pgrep -fl ffmpeg`: no process at each step; Core log of the first lane-2 process (boot to stop): 0 lines under `/api/v1/session`, 0 "precheck" |
| M4-SEL-W (spot) | W2 | PASS | One Save = one row: seq 126 `{field SOURCE, from CAM-02, to CAM-04, trackId VIDEO-02, operationId setCaptureCameraSource}`; the refused 422 edit wrote none. Capture operation REAL_DEVELOPMENT |
| M4-LOCK-1 (spot) | W1 + API | PASS | Session open (PRECHECK): `POST capture/mics/MIC-02/primary` -> `409 CAPTURE_CONFIG_LOCKED`, roles unchanged, `locked: true`, no audit row; panel + each control carry the sentence, all nine controls disabled, 0 toasts - `w1_selector_locked.png` |
| M4-MIC-RESCAN-W (spot) | W1 | PASS | One `POST capture/inputs/rescan`, 0 calls of op 93; rows + "Microphones are not searched on the network."; audit seq 96 `{scope MIC_LOCAL, responderCount 2}`. (T, lane 2: rows MIC-01 / -02 / -03 Ready, audit seq 114 with `DEV-0001` - `t2_mic_rescan.png`) |
| M4-SEL-T / -P, M4-FAKE-1 | - | carried | PASS at the first gate |
| M4-PC-1 | - | PARTIAL, unchanged | "Checking your permissions..." not observed live at either gate; pinned by web `devices-gate70-minors.test.tsx` |

### 3.5 Development label, previews (G70-01 / G70-03)

| Surface | Result | Evidence |
|---|---|---|
| W1 Devices (SIMULATED) | PASS | 0 badges anywhere incl. the re-read result; tiles show the room picture with the caption `... VIDEO-01 / LIVE / DEMO` - `w1_devices_tiles.png`, `w1_mic_rescan.png`; Session New step 2 the same pictures - `w1_precheck_camera_loss.png` |
| P Home / Devices (SIMULATED) | PASS | 0 badges on selector rows, sheet, re-read result; device rows keep the demo picture - `p1_home.png`, `p1_mic_rescan.png`, `p1_devices_investigator_foot.png` |
| W2 Devices | PASS | Tiles "No preview / Camera N - CAM-0N - ... / Online" with "Development source / Test source"; roster cards CAM-03 "This Mac's camera", CAM-04 "Test source"; selector lines and options; search row; connect dialog - `w2_devices_cam03_named.png`, `w2_disc_result.png` |
| W2 Session New step 2 | PASS | Badge on the four pre-check rows, two "No preview" tiles, no picture, no "LIVE" - `w2_session_new_step2.png` |
| W2 Dashboard | PASS | Four tiles with the badge, two "No preview"; the only picture is the page's hero banner, not a camera - `w2_dashboard.png` |
| W2 Session Monitor | PASS | Feed panel badge + neutral frame, input tiles "No preview" - `w2_monitor_precheck.png` |
| T Devices / Home / Session New | PASS, one surface left | Rows and detail "No preview"; Home tiles "No preview" ("Core Mac's camera" while CAM-03 was named); Session New previews "No preview" - `t2_devices_rows_detail.png`, `t2_home_cam03_named.png`, `t2_priv_notice.png`. Left: Home "Recent Sessions" thumbs (G70b-04) |
| G70-07 | PASS | W2 audio card title "MIC 1 - Interviewer (Ch 1)" whole, with the badge and with the longer sub line - `w2_audio_cards_mic03_standby.png` |

### 3.6 Minors of the first gate

| Finding | Result | Evidence |
|---|---|---|
| G70-04 | PASS for the two named controls; a sibling found | Tablet: after the re-read settled the control reads "Search again for microphones" (no "busy"); after "Not now" Session New's Next reads "Next" (it read "Next, busy" only while the notice stood). Phone re-read: same. New: G70b-03 |
| G70-05 | PASS | seq 112 / 113 carry `DEV-0001` |
| G70-06 | PASS | Phone, INVESTIGATOR: one role sentence in the search card, one at the foot of Capture Sources (one `capture-selector-gate` node) |
| G70-07 | PASS | above |
| G70-08 | W2 PASS; T NOT PROVEN live | section 5 |
| G70-09 / strict schema | PASS | Lane 1: `POST demo/faults {"kind":"CAMERA_LOSS","cameraId":"VIDEO-02"}` -> `422 INVALID_INPUT`, `activeFaults []`. With `target.cameraId VIDEO-02` the fault lands on VIDEO-02 |
| `lane.sh start 1 --with-camera-stub` | NOT RUN (lane 1 is up) | `scripts/lane/lane.sh:139` prints "camera stub IGNORED"; library case `test/support/lane-camera-stub.test.ts:76` (`LANE_CAMERA_STUB_IGNORED`). `test/static/lane-camera-stub.test.ts` pins where the launcher is run; it has no case for the printed word |

### 3.7 Regression / quality (`M4-RG-*`, `M4-QA-1`)

PASS by mapping. `test/08_precommit_wave_h.md` (D212): typecheck 0 errors and lint 0 errors in 7
workspaces; shared 113 files / 2546; core-server unit 329 / 6467; core-server db 183 files / 2406
(7 skipped: env-gated heavy files); core-web 170 / 2001; mobile 275 suites / 2610; transcriber 561
(3 skipped); mock-core 19 - 0 failed. Stated limit: that run was made on the working tree that was
then committed as `74fd1f1` (a pre-commit run), not on a checkout of the commit; today
`git status --porcelain` lists documentation only. No suite was run by this gate.

## 4. Local devices - what was and was not done

`CAM-03` was named on `VIDEO-01` once (seq 115) and `MIC-03` on a line twice (seq 106, 112), each
through a selector edit that only stores, each put back and confirmed. No pre-check, no start, no
confirm of a notice with a local source named; neither attendance variable set; no TCC / System
Settings. `pgrep -fl ffmpeg` returned nothing at every step.

## 5. Privacy notices (CAM-03 named on VIDEO-01 of lane 2), every notice cancelled

| Step | Surface | Result | Evidence |
|---|---|---|---|
| Next | W2 | PASS | `alertdialog` "Turn on a local device / This will turn on this Mac's camera (CAM-03). / The device check opens the device. Nothing is sent to the Core until you confirm." - `w2_priv_notice.png`. Every non-GET under `/api/v1/session` was set to fail in the browser (CDP): 0 attempted |
| "Not now", Next again, "Not now", reload | W2 | PASS | Step 1, no session id; the second press asks again; after reload step 1, no notice. Core log for the flow: `GET auth/session`, `capture/config`, `capture/devices`, `POST auth/touch` only |
| G70-08 fail closed | W2 | PASS | With `GET capture/config` and `capture/devices` held unanswered in the tab: banner "Checking the capture sources...", Next DISABLED with that sentence as its description, before and after the form is filled; a press did nothing; 0 session writes - `w2_g7008_checking_sources.png` |
| Next | T | PASS | "This will turn on the Core Mac's camera (CAM-03)." with "Turn on and run the check" / "Not now" - `t2_priv_notice.png`; Core log after the press: one `auth/touch` |
| "Not now", Next again, "Not now", relaunch | T | PASS | Next reads "Next"; the second press asks again; after force-stop + launch: `auth/session` 401, `auth/status`, `pairing/device`, `auth/touch` - no create, no pre-check; pairing kept |
| G70-08 fail closed | T | NOT PROVEN live | With the path cut (`adb reverse --remove tcp:4420`, restored after) the app KEPT what it knew: previews still said "Core Mac's camera", Next stayed enabled and a press showed the notice (safe: nothing can be sent, and it still asks). The "unknown" state exists only between sign-in and the first device list and could not be held from outside. `capture-selector/wave-h-sources-known{,-gate}.test.tsx` |
| Phone | P | NOT PROVEN on device | Lane 1 is SIMULATED (no notice by rule) |
| Start Recording notice, "is on" lines, reload at step 2 | all | user-attended, not run | Each needs a confirmed pre-check. Tests: web `live-session-new-local-notice.test.tsx` (D181 cases), `session-new/__tests__/wave-h-z2-countdown-sources.test.tsx`; mobile `local-source-start-notice.test.tsx` |
| Selector put back | W2 | DONE | seq 118 `CAM-03 -> CAM-01`; `GET capture/config`: CAM-01, CAM-02, MIC-01 PRIMARY, MIC-02 STANDBY |

## 6. Findings

| ID | Severity | What | Steps / evidence | Spec |
|---|---|---|---|---|
| **G70b-01** | **MAJOR** | A camera adopted through op 96 is refused by the selector until the Core restarts, with a sentence that is false on that Core | Lane 2 web: search, test with the fixture account, "Add as camera" (CAM-04), then selector "Camera for Camera 2" = CAM-04, Save -> `422 {reason DEVELOPMENT_SOURCE_NOT_ALLOWED, deviceId CAM-04}`, "This source can only be used in the development configuration." (`w2_selector_cam04_assigned.png`; reproduced by API). After `lane.sh stop 2` / `start 2`: 200. By reading (not debugged): `capture/adapters/registry.ts` fills its device map only in `register(adapter)` at boot; `assertAssignable` -> `describe` throws `DEVICE_UNKNOWN` for a device adopted since, and `capture-config/routes.ts:158` reports EVERY adapter refusal as `DEVELOPMENT_SOURCE_NOT_ALLOWED`. `capture-discovery.db.test.ts:593` assigns an adopted camera and gets 200 - in a test server, so the booted-lane path is not covered | `M4-CONN-W` "a development source added ... and then assigned through the selector"; the dialog's own "Assign it to Camera 1 or Camera 2". The same registry serves REAL_PRODUCTION (class C, not driven): likely the same there - hypothesis |
| G70b-02 | MINOR | The dialog says "This development source needs no password.", a test without one answers "The camera refused this user name or password." (none was entered) | `w2_conn_no_credential.png`; audit seq 101 `{outcome AUTHENTICATION_FAILED, authenticated false}`; not counted by the guard. Partly the stub's nature (it wants its account) | ux 8d: each outcome's message matches what happened |
| G70b-03 | MINOR (accessibility) | Tablet: after a Save in the microphone sheet both microphone rows of Capture Sources lose their label and read only "busy" - still so 10 s later and after a re-read | uiautomator: `capture-selector-row-MIC-01` / `-MIC-02` `content-desc="busy"` (before the save: "MIC-01, USB condenser microphone UM-1 - USB"); camera rows keep theirs | ux 14.3; same class as G70-04, another control |
| G70b-04 | MINOR | Tablet Home on the real-capture lane: "Recent Sessions" rows draw the stock room picture as thumb | `t2_home_cam03_named.png` | ruling D196 on G70-03 (no stock picture on a real-capture Core); note 129 item 6 fixed the Sessions rows only |
| G70b-05 | NOTE | An outcome that does not count still prints the counter: the scheme refusal reads "Typing the password again does not help." followed by "2 more attempts before testing this camera is paused."; the audit row of a scheme refusal is `AUTHENTICATION_FAILED`, the same as a wrong account | `w2_conn_AUTH_SCHEME.png`; audit seq 97 vs 95 | wording / audit precision |
| G70b-06 | NOTE | States that are not the device's: a track naming the Mac's camera (never opened) reads "Online / Stream live" with PoE port and bitrate; after the restart CAM-04 (its address is a dead port) reads "Ready" / "Reachable" / "Stream live" when assigned | `w2_devices_cam03_named.png`, `w2_selector_cam04_assigned_after_restart.png` | ux 8f: "is on" is the only on-state |
| G70b-07 | NOTE | Search ids restart with the Core: the audit chain of lane 2 holds `DSC-000001` and `DSC-000002` twice (seq 89 / 93 and 128 / 131) | audit | id uniqueness inside one chain |
| G70b-08 | NOTE | Note 06 inferred the 7th capture device of lane 2 to be an earlier `CAM-04`; it was `POE-SWITCH`. `CAM-04` exists only since this gate | `GET capture/devices` at 19:12 | environment sheet |

## 7. Skipped, user-attended, not covered

| Item | Reason |
|---|---|
| Biometric sign-in | skipped by the user's instruction (D151); the offer was answered "Not now" at each of 6 device sign-ins; the sensor was never touched |
| Confirm path of every local-device notice, Start Recording notice, "is on" lines, a pre-check or start with `CAM-03` / `MIC-03` | user-attended, not run |
| Real-LAN discovery `M4-DISC-LAN-1` | NOT RUN (reason: forbidden by the gate brief; a stub lane cannot probe a network by construction) |
| Second wrong account / lock-out sentence | not driven by instruction |
| `M4-NODEV-B-*`, `M4-NODEV-NOCFG-T`, `M4-MIC-ACTIVE-*` | no means on a lane (3.3) |
| Phone halves of discovery / connect pointer / notice | the phone is on the SIMULATED lane |
| Saved-login autofill, reveal control pressed, API reference deny list, Escape / sign-out exits of the dialog, five empty searches, conflict rows, search refusal during RECORDING | not driven |
| A pre-check with the adopted `CAM-04` on a track | not driven (its address died with the restart) |

Lapses of this gate: (1) I adopted the stub before driving `M4-CONN-LOCK-W` and `M4-CONN-PTR-T`;
with one stub device there was then no NEW candidate left, which is why lane 2 was restarted.
(2) The fixture user name of the FIRST stub start is legible in `w2_conn_success.png` and
`w2_conn_AUTH_SCHEME.png` (a fixture of the fake device, dead since the restart).

## 8. Environment as left - what later gates inherit

| Item | State |
|---|---|
| Lane 2 | RUNNING, **PID 7264, restarted 19:37** with `stop 2` then `start 2 --with-camera-stub --speech-mic` (not piped; output `.cache/gates/70b/start_2.log`, 0600). **New stub ports** discovery UDP 49344, device TCP 52021, RTSP TCP 52022; **new fixture account**: read `.locks/camera-stub.lane2.fixture` - the values in note 06 section 7.2 and `.cache/gate-env/regate/start_2.log` are dead. Boot: 0 errors, the one expected warn `INSTALLATION_IDENTITY_NOT_CONFIGURED`. Preset `NORMAL` |
| Lane 2 selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked: false` (read after everything) |
| Lane 2 adopted camera | **`CAM-04`** (FAKE, DEVELOPMENT, address `127.0.0.1:64850` = a port of the stopped stub), unassigned, with a stored credential (the old fixture account; `CAPTURE_CREDENTIAL_SET` seq 104). A lane reset keeps it. A search now lists the stub as NEW again; adopting it makes `CAM-05`. Do not put `CAM-04` on a track for a recording |
| Lane 2 data | audit head about seq 142 (seed 83): searches (camera 7, microphone 1), 9 connection tests, adoption 3 rows, 8 selector rows, `SES-20261010-0024` created / pre-check passed / cancelled from ARMED, sign-ins. One alert `CAPTURE_DISCOVERY_EMPTY`, resolved. Tests of 127.0.0.1 are NOT locked (one refusal, cleared). No session open |
| Lane 1 | RUNNING (PID 3547, untouched). Audit about seq 108: `SES-20261010-0024` created / `PRECHECK_BLOCKED` / cancelled, two demo faults raised and cleared (`activeFaults []`), two resolved alerts, one microphone re-read each from web and phone. Selector unchanged, unlocked |
| Devices | both on Login, "Core online", "paired as DEV-0001", reverse rules intact (phone 4421, tablet 4422; the tablet's `tcp:4420` rule was removed for under a minute and restored). No re-pairing, no lock change, no reboot. The apps were force-stopped and relaunched several times |
| Sessions | every helper session signed out (204), the three cookie jars removed; device operator sessions end by idle expiry; the three headless browsers stopped |
| Web dev servers, Metro, PostgreSQL | untouched |

## 9. Screenshots (`.cache/gates/70b/`, each read)

| File | Shows |
|---|---|
| `w2_disc_searching.png` | lane 2 Camera Search: "Searching the network for cameras... / This takes up to 3 seconds.", button busy |
| `w2_disc_result.png` | "1 found - 1 new - 0 already registered", row 127.0.0.1 / FAKE-CAM-1 with badge / Fake Camera 1 / New / Connect |
| `w2_connect_dialog_open.png` | connect dialog: address, full target URL, reference, badge, switch off, tick, Test disabled |
| `w2_conn_wrong_account.png` | refused account: red "The camera refused this user name or password. / 1 more attempt...", password field emptied |
| `w2_conn_success.png` | green "Connection works. This camera can be added. / 1 usable video profile", "Add as camera" |
| `w2_conn_AUTH_SCHEME.png` | "This camera only accepts a sign-in method that this system does not use. The password was not sent." |
| `w2_conn_no_credential.png` | switch off, "needs no password" above "The camera refused this user name or password." (G70b-02) |
| `w2_conn_added.png` | "CAM-04 was added. / Password stored. / ... Assign it to Camera 1 or Camera 2." |
| `w2_selector_cam04_assigned.png` | selector: CAM-04 chosen for Camera 2, red "This source can only be used in the development configuration." (G70b-01) |
| `w2_selector_cam04_assigned_after_restart.png` | after the restart: Camera 2 line "VIDEO-02 - CAM-04 - FAKE-CAM-1", no error |
| `w2_selector_mic_options.png` | primary-line list: MIC-01 ticked, MIC-02 greyed "already on the standby line", MIC-03 "This Mac's microphone" |
| `w2_selector_mic03_primary.png` | MIC-03 on the primary line with "Not fit for recording yet. Use it for development checks only." |
| `w2_audio_cards_mic03_standby.png` | audio cards with whole titles; AUDIO-02 "This Mac's microphone"; roster "Standby microphone"; empty-search panel below |
| `w2_devices_cam03_named.png` | Devices with CAM-03 named: two "No preview" tiles, roster cards CAM-03 "Feeds Camera 1" and CAM-04, toast "Capture configuration saved" |
| `w2_disc_empty_result.png` | "No camera answered the search" + "Search again", bell with 1 |
| `w2_disc_empty_top.png` | the same panel with the selector below, bell with 1 |
| `w2_disc_empty_bell.png` | banner "No camera found / The last search found no camera on the network." and the alert centre with that one item |
| `w2_owner_second_operator.png` | the TECHNICIAN's Devices page: idle "Search for cameras", no list |
| `w2_priv_notice.png` | web notice "Turn on a local device / This will turn on this Mac's camera (CAM-03)." over step 1 |
| `w2_g7008_checking_sources.png` | Session New step 1: banner "Checking the capture sources...", Next greyed |
| `w2_session_new_step2.png` | lane 2 step 2: badges on four rows, two "No preview" tiles, Time Sync NOTE "host system clock" |
| `w2_dashboard.png` | Dashboard: four badged tiles, two "No preview"; hero banner picture at the top |
| `w2_monitor_precheck.png` | Session Monitor during setup: badge on the feed, "No preview" input tiles |
| `w2_connect_locked_session_open.png` | Connect greyed with "A camera cannot be connected while a session is open.", selector lock sentence |
| `w1_devices_tiles.png` | lane 1 Devices: two room pictures captioned LIVE / DEMO, no badge |
| `w1_mic_rescan.png` | lane 1 re-read rows MIC 1 / MIC 2 Ready, no badge anywhere |
| `w1_selector_locked.png` | lane 1 selector locked: sentence on the panel and under each greyed control |
| `w1_precheck_camera_loss.png` | lane 1 step 2: "Video Lens 2 / Camera 2 lens fault / BLOCK", Camera 2 "NO SIGNAL" |
| `w1_precheck_mic_no_signal.png` | lane 1 step 2: "MIC (primary): no signal / WARN", "Acknowledge warnings" |
| `t2_disc_searching.png` | tablet Devices just before the search took effect (idle panel) - NOT the searching state |
| `t2_disc_empty.png` | tablet: "No camera found" card + "No camera answered the search" + two "Search again" |
| `t2_disc_result_registered.png` | tablet: "1 found - 0 new - 1 already registered", "Already registered CAM-04", "View device" |
| `t2_disc_new_candidate_connect_pointer.png` | tablet: New candidate, greyed Connect, "Connect this camera from the web console.", passwords-on-web note |
| `t2_sheet_standby_mic.png` | tablet sheet: MIC-01 with its refusal sentence, MIC-02 selected, MIC-03 "Core Mac's microphone" + limit sentence |
| `t2_selector_mic03_standby.png` | tablet Capture Sources with MIC-03 Standby, "Core Mac's microphone" |
| `t2_mic_rescan.png` | tablet re-read: MIC-01 / MIC-02 / MIC-03 Ready |
| `t2_devices_investigator.png` | tablet as INVESTIGATOR: greyed search + role sentence, greyed Change buttons |
| `t2_devices_rows_detail.png` | tablet device rows with badges, Camera 2 detail "No preview / Reachable" |
| `t2_home_cam03_named.png` | tablet Home: "No preview" tiles ("Core Mac's camera"), Recent Sessions with room thumbs (G70b-04) |
| `t2_priv_notice.png` | tablet notice "... the Core Mac's camera (CAM-03).", two buttons, Next busy behind |
| `p1_home.png` | phone Home on lane 1: 2/2 cameras, 2/2 microphones, recent sessions |
| `p1_disc_not_available.png` | phone: "Camera search is not available on this Core yet." + Retry |
| `p1_sheet_standby_mic.png` | phone sheet: MIC-01 Primary with the refusal sentence, MIC-02 Standby selected |
| `p1_mic_rescan.png` | phone re-read: MIC-01 / MIC-02 Ready, no badge |
| `p1_devices_investigator_foot.png` | phone device rows (demo pictures) below Capture Sources; the role sentence itself is above the frame (read by uiautomator) |

---
*Generated: 2026-10-10 19:50 WIB*
