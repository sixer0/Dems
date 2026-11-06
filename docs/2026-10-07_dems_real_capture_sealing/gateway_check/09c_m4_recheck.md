---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 70 (M4 milestone gate) - TARGETED RE-CHECK after fix waves I and K
date: 2026-10-11
agent: verifier
narrative_tier: 2
tree: commit b05106b + the uncommitted fix 151 (`git status`: four core-server files of fix 151, documentation); no product or test file changed by this run
read_with: gateway_check/09_m4_gate.md (first gate, FAIL), gateway_check/09b_m4_regate.md (re-gate, FAIL on G70b-01)
status: needs-review
verdict: FAIL (one blocking item, G70c-01, found by this re-check) - G70b-01 is CLOSED
---

# 09c - M4 targeted re-check (row 70)

Run window 03:49-04:12 WIB on the environment of `initialization/08_gate_environment_wave_k.md`
(section "After fix 151": lane 2 Core PID 55401, not restarted by me). Not a full gate: the nine
items of the brief, one run each. No product or test file changed, no git write, no install, no
lane restart, no reset. Evidence under the git-ignored `.cache/gates/70c/` (25 screenshots, each
read; scratch tools). Surfaces: W2 = web console of lane 2 (5177), headless Chromium over CDP with
the session helper's cookie; T = tablet `emulator-5556` (`DEV-0001`); P = phone `emulator-5554`
(`DEV-0002`), both on lane 2. Lane 1 was mine but no item needed it: not touched.

The stub's fixture account was typed into the fake device's dialog from
`.locks/camera-stub.lane2.fixture` by a script that never printed it; it is in no file, file name,
log or screenshot of this run (dialog screenshots: switch off, or the outcome box only).

## 1. Verdict

**FAIL - one blocking item (G70c-01, MAJOR, new).** The item that failed the re-gate is fixed:

| Item | State |
|---|---|
| **G70b-01** (adopted camera refused until a restart) | **CLOSED.** `CAM-05` adopted and assigned through the web selector at once, same Core process: `POST capture/cameras/CAM-05/source` 200, one `CAPTURE_CONFIG_CHANGED` row (seq 560), seen on the tablet's selector |
| G70b-02, -03, -04, -05, -07 | CLOSED (section 2) |
| G70b-06 | selector lines fixed on web, tablet, phone; remainders in G70c-02 |
| Phone `M4-DISC-P`, `M4-DISC-EMPTY-P`, `M4-CONN-PTR-P`, G70-02 | PASS (were NOT PROVEN) |
| Tablet G70-08 fail closed | PASS live (was NOT PROVEN) - with a method note (G70c-07) |

What blocks:

| # | Blocking item | Owner |
|---|---|---|
| **G70c-01** | On the tablet, **Home and Session New name the wrong camera after the selector is changed**: with `CAM-03` (the Core Mac's camera) on `VIDEO-01`, the Home tile and the Session New preview read "Camera 1 · Camera CAM-01" with the badge "Development source / Test source"; with `CAM-05` on `VIDEO-02` they read "Camera CAM-02". The tablet's own Devices selector and the web are right. The re-gate saw "Core Mac's camera" on these tiles (09b section 3.5) - a check that passed then fails now | coder-execution (apps/mobile), then one device re-drive |

Severity reasoning, for the controller to rule: the row is about which source feeds a track and
about the local-device label; the screen an operator starts a session from states a generated test
source while the track names this Mac's real camera. The privacy notice still comes first and names
the right device (section 2, item 7), which is why this is not a BLOCKER. If the controller rules it
MINOR, the row's verdict is PASS WITH CONDITIONS (G70c-01, -02, -03 to coder-execution; the two NOT
PROVEN groups of section 5 to the controller).

## 2. Items

| # | Item | Surface | Result | Evidence |
|---|---|---|---|---|
| 1 | G70b-01: search, test, add, assign at once | W2, T | **PASS** | Search: stub listed New (`DSC-000003`). Test with the fixture account: "Connection works. This camera can be added. / 1 usable video profile" (`w2_conn_success.png`; audit seq 552 `REACHABLE`). "Add as camera": `POST .../adopt` 201 `deviceId CAM-05`, host `127.0.0.1:50651`; dialog "CAM-05 was added. / Password stored. / ... Assign it to Camera 1 or Camera 2." (`w2_conn_added.png`); audit 557 (test by `adoptCaptureCandidate`), 558 `CAPTURE_CREDENTIAL_SET`, 559 `CAPTURE_CANDIDATE_ADOPTED` - no credential text in a row. Selector "Camera for Camera 2" offered `CAM-05` without a reload; Save: `POST capture/cameras/CAM-05/source` **200**, line "VIDEO-02 · CAM-05 · FAKE-CAM-1 · Profile H264_720P30", toast "Capture configuration saved" (`w2_selector_cam05_assigned.png`); exactly one row, seq 560 `{field SOURCE, from CAM-02, to CAM-05, trackId VIDEO-02, operationId setCaptureCameraSource}`. Core PID 55401 before and after (no restart). Tablet Devices: `capture-selector-row-VIDEO-02` = "Video track 2, CAM-05 · FAKE-CAM-1, Reachable". Put back: seq 563 `CAM-04 -> CAM-02` (after the CAM-04 step), `GET capture/config` = CAM-01 / CAM-02 |
| 1 | `CAM-04` (dead port) on a track | W2 | PASS as specified ("accepted or refused with its own reason"): **accepted** | `POST capture/cameras/CAM-04/source` 200, line "VIDEO-02 · CAM-04 · FAKE-CAM-1", chip "Reachable" (`w2_selector_cam04.png`); seq 562; put back 19 s later. No pre-check was run. That a camera whose address answers nothing reads "Reachable": G70c-02 |
| 1 | A refusal reads its own reason | API + tests | PASS for what a lane can provoke; adapter refusals by tests | Unknown id `CAM-99`, a microphone (`MIC-01`) and `POE-SWITCH` as a camera source: `404 NOT_FOUND` "The capture registry has no such device."; `CAM-01` on `VIDEO-02` while it feeds `VIDEO-01`: `422 INVALID_INPUT`. None answered `DEVELOPMENT_SOURCE_NOT_ALLOWED`; none wrote a row; selector unchanged. An ADAPTER refusal (`PRODUCTION_SOURCE_NOT_ALLOWED`, `CAPTURE_DEVICE_NOT_SERVED`, `CAPTURE_DEVICE_CLASS_MISMATCH`) cannot be provoked on lane 2 (every registered camera is a served development device). Run once here: `npx vitest run --root apps/core-server --project unit src/modules/capture-config/__tests__/wave-i-a2-refusal-reasons.test.ts src/capture/fence/__tests__/wave-i-a2-admit.test.ts` -> `Test Files 2 passed (2) / Tests 7 passed (7)` |
| 2 | G70b-02: development-source sentence; test without a credential | W2 | **PASS** | Dialog: "A development source can be tested without a password. If the test asks for one, turn on "Enter a user name and password"." - "needs no password" occurs 0 times (`w2_connect_dialog_open.png`). Test with the switch off: "This camera asks for a user name and a password. None was sent. / Turn on "Enter a user name and password", type them, then test again."; no attempts line (`camera-connect-attempts` absent) (`w2_conn_no_credential.png`); answer `{outcome AUTHENTICATION_FAILED, authenticated false, failedAttemptsRemaining 2}`; audit seq 549 |
| 2 | G70b-05: preset `AUTH_SCHEME` | W2 | **PASS** | "This camera only accepts a sign-in method that this system does not use. The password was not sent. / A camera with this setting cannot be connected by this version of the system. Typing the password again does not help." - no remaining-attempts line, "more attempt" 0 times in the dialog (`w2_conn_AUTH_SCHEME.png`); answer carries `reason SCHEME_NOT_ALLOWED`, `failedAttemptsRemaining 2`; audit seq 550 `details.reason: SCHEME_NOT_ALLOWED`. Preset back to `NORMAL` (read back) |
| 2 | ONE wrong account (control: the counter still shows where it counts) | W2 | PASS | "The camera refused this user name or password. / 1 more attempt before testing this camera is paused." (`w2_conn_wrong_account.png`); password field emptied; seq 551. The reachable test after it: `failedAttemptsRemaining 2` again - 127.0.0.1 is not locked |
| 3 | G70b-07: search ids continue | W2, P, audit | **PASS** | The chain held `DSC-000001` (seq 88, an earlier Core process). This process (started 03:43) gave `DSC-000002` (seq 547) and `DSC-000003` (seq 548) from the web, `DSC-000004..6` (seq 554-556, `DEV-0002`) from the phone. Whole chain at the end: six search rows, six ids, none twice. The continuation across a restart is shown by 000001 -> 000002 over the 03:43 restart; I restarted nothing |
| 4 | G70b-03: microphone rows after a Save | T | **PASS** (in-flight frame not caught) | Sheet "Standby microphone", `MIC-03` chosen, Save (select only, seq 564 `DEV-0001`). uiautomator at once and 10 s later: `capture-selector-row-MIC-01` = "MIC-01, USB condenser microphone UM-1 · USB, Primary", `capture-selector-row-MIC-03` = "MIC-03, MacBook Air Microphone · AVFOUNDATION, Standby"; camera rows keep theirs; after the put-back (seq 565) "MIC-02, ... · USB, Standby". "busy" in none of the three dumps. `busy` WHILE the request is out: a dump takes longer than the request - not observed; jest `capture-selector/wave-i-c-row-labels.test.tsx` |
| 4 | G70b-04: Home "Recent Sessions" thumbs | T | **PASS** | Three rows with the neutral crossed-picture tile, no room picture; `home-recent-row-N-thumb` = "EV-20261011-0026. No preview: this build shows no live picture." (`t2_home_recent_sessions.png`) |
| 5 | G70b-06: source status of a source nobody opened | W2, T, P | selector lines **PASS**; remainders = G70c-02; "Stream live while recording" NOT DRIVEN | Idle selector lines read "Reachable" and no "Stream live" on web (four lines, `w2_selector_idle.png`), tablet and phone (`capture-selector-stream-VIDEO-0N` "Reachable"). `CAM-03` and `CAM-04` named on a line (items 7 and 1) read "Reachable" on web and tablet. Tablet Home microphone tiles "Reachable", chips "Time: Host system clock", "Security: Not reported". Not as the fix notes word it: section 4, G70c-02. No recording was made in this re-check, so "Stream live" returning during RECORDING was not driven (web `wave-i-b-source-state.test.tsx`, mobile `wave-i-c-row-labels.test.tsx`) |
| 6 | `M4-DISC-P` | P (TECHNICIAN) | **PASS** | Tap "Search for cameras": progress bar, "Searching the network for cameras... / This takes up to 3 seconds.", the button busy (`p2_disc_searching.png`); then "1 found · 1 new · 0 already registered / Searched 1 network.", row "127.0.0.1 / FAKE-CAM-1 / Fake Camera 1 / New" with "Development source / Test source", trust sentence, "Searched at 03:53:53. Kept until 04:03:53. / Only you see this list, on this device." (`p2_disc_result.png`); audit seq 554 with `deviceId DEV-0002` |
| 6 | `M4-CONN-PTR-P` | P | **PASS** | "Connect" DISABLED, label "Connect 127.0.0.1. Connect this camera from the web console.", the sentence under the row and "Camera passwords are entered on the web console only. Open Devices on the web console and search there."; view tree `password fields: 0, EditText: 0` before and after a tap on the disabled control; Core log: 0 requests of the phone's operator to a `candidates` route |
| 6 | `M4-DISC-EMPTY-P` | P, preset `EMPTY` | **PASS** | "No camera answered the search / Check that each camera is powered and on the same network as the Core, then search again." + the card "No camera found / The last search found no camera on the network." + two "Search again" (`p2_disc_empty.png`); ONE alert `ALR-000036` WARNING `{reason CAPTURE_DISCOVERY_EMPTY, searchId DSC-000005}`; audit seq 555 `responderCount 0`. Preset `NORMAL`, "Search again": list drawn, card gone, alert `active false` with `resolvedAt` |
| 6 | G70-02 on the phone, lane 2's microphones | P | **PASS** | Sheet "Standby microphone / Every registered microphone. The primary microphone stays as it is.": `MIC-01` DISABLED "This is the primary microphone. One microphone cannot be on both lines."; `MIC-02`; `MIC-03` "Core Mac's microphone" with "Not fit for recording yet. Use it for development checks only." (`p2_sheet_standby_mic03.png`). `MIC-03` saved on the standby line, SELECT ONLY: row "MIC-03, MacBook Air Microphone · AVFOUNDATION, Standby" (`p2_selector_mic03_standby.png`); audit seq 566 `CAPTURE_CONFIG_CHANGED {from MIC-02, to MIC-03, operationId updateCaptureConfig}` with **`deviceId DEV-0002`**. Put back: seq 567 (`DEV-0002`), `GET capture/config` = MIC-01 PRIMARY / MIC-02 STANDBY. The put-back took 66 s, not "at once": G70c-03 and section 6 |
| 7 | Tablet G70-08 fail closed | T (+ W2 for the selector) | **PASS** | `CAM-03` named on `VIDEO-01` from the web (select only, seq 568; `w2_selector_cam03_track1.png`). Tablet Session New, form filled, Next: notice "Turn on a local device / This will turn on the Core Mac's camera (CAM-03). / The device check opens the device. Nothing is sent to the Core until you confirm." with "Turn on and run the check" / "Not now" (`t2_priv_notice.png`); **"Not now"** pressed; the confirm was never pressed. Path cut, link down (how: G70c-07): banner "Core server unreachable / This device is not connected to the Core server. Recording can start once the connection is back.", line "Checking the capture sources…", Next **DISABLED**; a press on it changed nothing (`t2_g7008_link_cut.png`). Rule restored (`reverse tcp:4420 tcp:4422`): within 5 s Next enabled, banner gone, Core `ws.clients 3`; Home "Core Live". Form discarded; selector back (seq 569 `CAM-03 -> CAM-01`). Core log from before seq 568 to after seq 569: non-GET requests = 5 `auth/touch` and the 2 selector writes; 0 session writes, 0 lines with "precheck", 0 warn / error lines. `pgrep -fl "ffmpeg\|avfoundation\|capture-worker"`: nothing, at every step. No session row in the audit |
| 8 | Boot log `locked true` vs API `locked false` | code + live | **The API is true; the log line is wrong; no client showed a lock** | G70c-04 |
| 9 | `M4-NODEV-B-*`, `M4-MIC-ACTIVE-*` | - | still NOT PROVEN | section 5 |

## 3. Item 8 - which `locked` is true

- Boot line (`.locks/core-server.lane2.log:29`): `CAPTURE_CONFIG_LOADED devices 8, revision 2, locked true`.
  Its source: `apps/core-server/src/modules/capture-config/store.ts:58` reads
  `EXISTS (SELECT 1 FROM public.active_session) AS session_open`, `:159` `locked = row?.session_open === true`,
  logged by `boot.ts:55`. The table still holds the row of the last session, which is `SEALED`
  (`GET session/current` = `SES-20261011-0037`, `SEALED`). The line therefore says "a session row
  exists", not "a session is open".
- API: `routes.ts:170` answers `locked: isSessionActive(state.session)`;
  `packages/shared/src/sim/session-machine.ts:130-132`: active = not null and not `SEALED`. So
  `locked false` - and it is the truth: nine selector writes were accepted with 200 in this run.
- `snapshot.locked` has one reader in the tree, the log call (`grep "\.locked\b"`: `boot.ts:55`).
- Clients: no wrong lock anywhere. Web: the four Save controls and "Connect" worked, no lock
  sentence on the panel. Tablet and phone: every "Change" enabled, sheets saved, no lock notice.

## 4. Findings

| ID | Severity | What | Steps / evidence | Spec |
|---|---|---|---|---|
| **G70c-01** | **MAJOR** | Tablet Home and Session New keep naming the camera a track had before: the selector's change does not reach these tiles | (a) Web: `VIDEO-01 = CAM-03`. Tablet Devices selector: "Video track 1, CAM-03 · MacBook Air Camera", "Core Mac's camera" (`t2_selector_cam03_track1.png`). Tablet Home, read 60 s later after navigating away and back: tile "Camera 1 · Camera CAM-01", badge "Development source / Test source" (`t2_home_cam03_named.png`; `home-device-VIDEO-01-feed-name`, `-source-kind`). Session New preview: "Camera 1 · Camera CAM-01" (`t2_session_new_cam03_named.png`), still so beside the notice that says "the Core Mac's camera (CAM-03)" (`t2_priv_notice.png`). (b) With `VIDEO-02 = CAM-05`: Home tile "Camera 2 · Camera CAM-02" after a fresh sign-in; web tile at the same time "Camera 2 · CAM-05 · FAKE-CAM-1". Cause NOT established. Hypothesis: these tiles read `state.session?.captureConfig ?? state.captureConfig` (`apps/mobile/src/features/devices/camera-preview.tsx:78`, `capture-selector/development-source-badge.tsx:169`) and the tablet's store still holds the selector snapshot of the last, SEALED session, which then hides the current selector; lane 2 had no earlier session when 09b saw the right words. Operation `session/current` itself answers `captureConfig: null` for that session, so the hypothesis needs the store's content to confirm. The phone's Session New and the pre-check rows use the same expression: not looked at | 09b section 3.5 (PASS then: "Core Mac's camera" on the Home tiles); ux 8f.2 (the one badge states the source of the line); D196 |
| G70c-02 | MINOR | Remainders of G70b-06 - states that are not checked facts, outside the selector lines | Tablet sheet "Camera for Video track 2": every option reads "Live" - `CAM-03` (never opened), `CAM-04` (address `127.0.0.1:64850`, nothing listens), `CAM-05` - with nothing recording (`t2_sheet_camera_track2.png`). Web camera tiles read "Online" under "No preview"; web roster cards and the drawer read "Ready" for `CAM-03` and `CAM-04` (`w2_drawer_cam04.png`). Phone Home tiles: "Cameras: 2 of 2 online. Online", "Microphones: 2 of 2 ready. Online". `CAM-04` on a track reads "Reachable" (`w2_selector_cam04.png`). The Core still sends `online true, streamState LIVE` for every line (deferred: D217 (6), `checkedAt`) | ux 8f; contract note A2 section 4 (client rule: "Live" only while RECORDING) |
| G70c-03 | MINOR | Phone source sheet: a tap in the middle of an option row does not select it | With `MIC-03` on the standby line, two taps at the centre of the `MIC-02` row (540,1026) left Save disabled; a tap on the row's title line selected it. At phone width the "Development source" chip (its own clickable node, x 161-560) wraps into the middle of the row and takes the tap (`p2_sheet_standby_mic03.png`). On the tablet the chip sits at the left and the row's centre is free | ux 14 (touch targets); the row is the control |
| G70c-04 | NOTE | The boot line `CAPTURE_CONFIG_LOADED ... locked true` is false while the last session is `SEALED` | section 3 | a log states facts; `locked` = a session is open (OD-10) |
| G70c-05 | NOTE | Every `CAPTURE_DISCOVERY_SEARCHED` row of this run carries `details.sessionId: SES-20261011-0037` - a sealed, acknowledged session; no session was open | audit seq 547, 548, 554, 555, 556 | the row names the session a search ran in (09b seq 131: an OPEN session) |
| G70c-06 | NOTE | Tablet Session New with the link down: the banner says "Core server unreachable" while "Live device status" beside it still reads "Core Machine ONLINE", "Video Lens 1 READY" | `t2_g7008_link_cut.png` | one statement of the link per screen |
| G70c-07 | NOTE (method / environment) | `adb reverse --remove tcp:4420` does not close the app's established socket: for 2 min 51 s after the removal the tablet read "ONLINE", Next stayed enabled and the Core counted `ws.clients 3` - truthfully, the socket was alive. This is why 09b could not prove the item | The link left "Online" only after `adb -s emulator-5556 reconnect` (resets that device's adb transport; `ws.clients 2`); it also drops the `tcp:8081` rule, restored at once | re-drive list of note 134 item 6: say "reset the transport", not only "remove the rule" |
| G70c-08 | NOTE | Web "Registered cameras" does not list a camera that left a track: while `CAM-05` fed Camera 2 the roster showed `CAM-03`, `CAM-04`, `CAM-05` and no card for the then unassigned `CAM-02` (the selector offered it) | page text at 03:56 (item 1) | roster = every registered camera not shown as a tile |

Seen, not examined (not findings): the Session New form states "Recording Profile: Standard (1080p /
25 fps)" on a lane whose lines state `H264_720P30`; the tablet's on-screen Back arrow of Session New
did not answer two `input tap`s (the system Back opened the discard dialog); the phone's Home avatar
did not answer a tap (sign-out is under More).

## 5. What stays NOT PROVEN

| Check | Why | Missing means |
|---|---|---|
| `M4-NODEV-B-W/-T/-P`, `M4-NODEV-NOCFG-T` | Nothing new makes ONE generated source of lane 2 unreachable at a pre-check: the stub's presets (`NORMAL`, `AUTH_SCHEME`, `UNREACHABLE`, `NO_PROFILE`, `NOT_H264`, `EMPTY`) act on discovery / connect; `demo/status` on lane 2 answers 403 (no demo controls); the seal rig acts on the seal. One candidate, NOT tried because the environment sheet forbids it without a ruling: `CAM-04` (dead address) on a track and a pre-check - whether the generated adapter reads the stored address is not known | a ruling to pre-check with `CAM-04` on a track, or a development switch per FAKE source |
| `M4-MIC-ACTIVE-W/-T/-P` | No means at all: no preset or switch stops or mutes one generated microphone | a development switch per FAKE microphone |
| "Stream live" only while RECORDING (item 5, second half) | no recording in this re-check | one recorded session on the FAKE sources with the selector open |
| `busy` on a microphone row while its Save is in flight | shorter than a uiautomator dump | jest only |
| Adapter refusals of ops 78 / 79 live | lane 2 has no device its registry refuses | a production-class row on a development lane (tests cover it) |
| Unchanged from 09b section 7 | biometric steps (skipped by the user's instruction: the offer was answered "Not now" on both devices, the sensor never touched); the confirm path of every local-device notice, the Start Recording notice, any pre-check or start with `CAM-03` / `MIC-03` (user-attended, not run); `M4-DISC-LAN-1`; the second wrong account / lock-out sentence; saved-login autofill, reveal control, API reference deny list | as there |

## 6. Local devices, lapses

- `CAM-03` was named on `VIDEO-01` once (seq 568 -> 569, about 7 minutes: I verified on the
  tablet's selector that the app knew the line before pressing Next - after G70c-01 showed the
  preview did not - and the first cut did not cut). `MIC-03` was named on the standby line twice:
  tablet (seq 564 -> 565, 33 s) and phone (seq 566 -> 567, 66 s). Each was a selector edit that only
  stores. No pre-check, no start, no confirm of a notice, no attendance variable, no TCC.
  `pgrep` for ffmpeg / avfoundation / a capture worker: nothing at every step.
- Lapse 1: the phone put-back of `MIC-02` took 66 s (two taps that selected nothing, G70c-03).
- Lapse 2: two requests of my script came faster than the Core's spacing and were answered 429
  (`DISCOVERY_RATE_LIMITED`, `CONNECTION_TEST_RATE_LIMITED`); the console showed "The Core server
  is limiting requests from this console. Try again in N s."; neither wrote an audit row or counted
  against the lock-out guard; each was repeated once after the window.
- Lapse 3: one mis-aimed click on the web opened nothing that stayed.
- The tablet's adb transport was reset once (G70c-07) - not named by the brief; both reverse rules
  of the tablet were restored and read back.

## 7. Environment as left

| Item | State |
|---|---|
| Lane 2 Core | RUNNING, PID 55401, not restarted, not reset. Stub preset `NORMAL` (read back); stub ports unchanged (device 50651); seal rig OFF (read, never switched) |
| Selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` (read after everything) |
| Added to lane 2 | **`CAM-05`** (FAKE, DEVELOPMENT, `FAKE-CAM-1`, host `127.0.0.1:50651` = the running stub, unassigned, credential stored = this start's fixture account; dead after the next restart of lane 2, like `CAM-04`). A search now lists the stub as "Already registered CAM-05": **no NEW candidate is left until lane 2 restarts.** Audit: 546 -> **571 rows** (25: 5 searches `DSC-000002..6`, 5 connection tests, 2 adoption rows, 9 selector rows, 2 device sign-ins, 2 device sign-outs; the helper's own sign-out followed as row 572), chain `view.ok true, stored.ok true`, 571 checked. Alerts: 17 -> **18**, none active (`ALR-000036` `CAPTURE_DISCOVERY_EMPTY`, resolved). Evidence: unchanged, 26 items. No session created; `session/current` = `SES-20261011-0037` `SEALED` |
| Lane 1, web 5176 / 5177, Metro | untouched, answering 200 |
| Devices | both on Login, "Core online", "paired as DEV-0001" (tablet) / "DEV-0002" (phone); reverse rules `tcp:8081 -> 8081`, `tcp:4420 -> 4422` on both (read back); operators signed out through the app (seq 570, 571). No re-pairing, no lock change, no reboot, no app restart |
| Sessions, browser | helper session signed out (204, then 401), jar removed; my headless browser stopped, its profile removed |

## 8. What later re-checks must know

1. Lane 2 holds `CAM-04` (dead address) and `CAM-05` (the running stub). No NEW discovery candidate
   exists until a restart; a re-check that needs "Connect" or the phone pointer must restart lane 2
   first (new stub ports, new fixture account, `CAM-05` then dead too).
2. Both devices' Home / Session New tiles do not follow a selector change on this lane (G70c-01): do
   not read a tile as proof of what a track records - read the Devices selector or `GET capture/config`.
3. To take a device's Core link down, reset the transport (`adb -s <serial> reconnect`) after removing
   the rule, then restore BOTH rules; the rule removal alone leaves the socket up (G70c-07).
4. The connection-test and search spacing guards answer 429 to a script that presses within about
   3 s; a 429 costs nothing.
5. Search ids on lane 2 are now at `DSC-000006`; the next is `DSC-000007`.
6. The boot line's `locked` is not the selector's lock (G70c-04).

## 9. Screenshots (`.cache/gates/70c/`, each read)

| File | Shows |
|---|---|
| `w2_selector_idle.png` | lane 2 selector idle: four lines each "Reachable", badges, no "Stream live" |
| `w2_disc_searching.png` | Camera Search: "Searching the network for cameras... / This takes up to 3 seconds.", button busy |
| `w2_disc_result.png` | "1 found · 1 new · 0 already registered", row 127.0.0.1 / FAKE-CAM-1 with badge / New / Connect |
| `w2_connect_dialog_open.png` | connect dialog, switch off: target URL, badge, the ruled development-source sentence, Test disabled |
| `w2_conn_no_credential.png` | switch off, tick on: red "This camera asks for a user name and a password. None was sent." + what to do |
| `w2_conn_AUTH_SCHEME.png` | outcome box only: the sign-in-method sentences, no attempts line |
| `w2_conn_wrong_account.png` | outcome box only: "The camera refused this user name or password. / 1 more attempt..." |
| `w2_conn_success.png` | outcome box only: green "Connection works. This camera can be added. / 1 usable video profile" |
| `w2_conn_added.png` | "CAM-05 was added. / FAKE-CAM-1 / Password stored. / ... Assign it to Camera 1 or Camera 2." |
| `w2_selector_cam05_assigned.png` | Camera 2 line "VIDEO-02 · CAM-05 · FAKE-CAM-1", search row "Already registered CAM-05", toast "Capture configuration saved" |
| `w2_selector_cam04.png` | Camera 2 line "VIDEO-02 · CAM-04 · FAKE-CAM-1 · Reachable", saved |
| `w2_selector_cam03_track1.png` | Camera 1 line "VIDEO-01 · CAM-03 · MacBook Air Camera", "This Mac's camera", saved |
| `w2_drawer_cam04.png` | drawer "Camera CAM-04 ... Ready", address 127.0.0.1:64850; behind it tiles "Online", roster cards "Ready" |
| `t2_home_recent_sessions.png` | tablet Home: Recent Sessions with three neutral "no picture" thumbs; tiles "No preview"; chips "Security: Not reported", "Time: Host system clock" |
| `t2_sheet_camera_track2.png` | tablet sheet "Camera for Video track 2": CAM-01..05, each with a green "Live" chip (G70c-02) |
| `t2_selector_cam03_track1.png` | tablet Devices: "Video track 1 / CAM-03 · MacBook Air ... / Reachable / Core Mac's camera" |
| `t2_home_cam03_named.png` | tablet Home at 04:02 with CAM-03 on track 1: tile still "Camera 1 · Camera CAM-01", "Test source" (G70c-01) |
| `t2_session_new_cam03_named.png` | tablet Session New, form filled, CAM-03 on track 1: preview "Camera 1 · Camera CAM-01 / Reachable" (G70c-01) |
| `t2_priv_notice.png` | tablet notice "Turn on a local device / This will turn on the Core Mac's camera (CAM-03).", two buttons, Next busy behind |
| `t2_g7008_link_cut.png` | tablet with the link down: banner "Core server unreachable", "Checking the capture sources...", Next greyed; "Core Machine ONLINE" beside it (G70c-06) |
| `p2_disc_searching.png` | phone: progress bar, "Searching the network for cameras... / This takes up to 3 seconds.", busy "Search again" |
| `p2_disc_result.png` | phone: "1 found · 1 new", candidate New with the development badge, greyed Connect, "Connect this camera from the web console.", passwords-on-web note |
| `p2_disc_empty.png` | phone: card "No camera found" + "No camera answered the search", two "Search again" |
| `p2_selector_mic03_standby.png` | phone Capture Sources: MIC-03 Standby, "Core Mac's microphone" |
| `p2_sheet_standby_mic03.png` | phone sheet with MIC-03 on standby: MIC-01 with its refusal sentence, MIC-02 "Not assigned" (chip wrapped mid-row), MIC-03 selected with the limit sentence, Save greyed |

---
*Generated: 2026-10-11 04:15 WIB*
