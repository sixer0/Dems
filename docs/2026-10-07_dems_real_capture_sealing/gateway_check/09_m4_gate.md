---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 70 (M4 milestone gate, independent +1)
date: 2026-10-10
agent: verifier
narrative_tier: 2
tree: commit f293221 (product code unchanged by this gate)
status: needs-review
verdict: FAIL (gate not passable as run - see section 1)
---

# 09 - M4 milestone gate (row 70)

Run window 12:43-13:07 WIB on the standing environment of `initialization/05_gate_environment_up.md`.
No product or test file was changed, no git write, no install. Evidence files are under the
git-ignored `.cache/gates/70/` (11 screenshots, 6 test logs).

## 1. Verdict

**FAIL - the gate cannot be closed on today's evidence.** Not because the product broke where it was
driven (it did not: every flow that could be driven behaved as specified, with one labelled
exception), but because the largest part of the row's client checks could not be run at all:

| # | Blocking item | Owner |
|---|---|---|
| B-1 | **No supported way exists to make a RUNNING lane's Core see the fake ONVIF stub.** Every stub-dependent client check (search states, candidate list, connect dialog, five outcomes, Add as camera, lock-out guard, abandon, owner, empty search / notification A, situation B, Connect pointer on tablet / phone) is NOT PROVEN in a browser or on a device. What is missing is named in section 6 | controller (decide: build the lane launcher of `10_test_strategy.md` CR-5, or rule that component + db tests close these checks) |
| B-2 | `M4-DEVSRC-LABEL-W` fails on one surface: a Core in SIMULATED capture draws the development badge in the microphone re-read result (finding G70-01) | coder-execution (rows 133 / 137) |
| B-3 | No client offers a control to assign a registered microphone other than the two built-in lines; `MIC-03` can be selected by API only (finding G70-02) - needs a ruling whether this is in M4's scope | controller, then coder-execution |

What IS proven is listed in sections 2 and 3: the entry condition holds, the three MAJORs of review
69 are fixed in code and test, and the local-device notice works on the web console and the tablet
against the real lane-2 Core with nothing sent before the notice.

## 2. Entry condition - "0 Blocker / Major open" for M4

| Finding | Fix read in code | Test run now (once) | Proven live | State |
|---|---|---|---|---|
| R69-01 notice before a local-device pre-check | web `apps/core-web/src/features/session-new/index.tsx:309` (`localGate.guard(() => createAndCheck)`), `:488` (retry), gate `features/devices/local-source-gate.ts`; mobile `apps/mobile/src/features/session-new/use-session-new.ts:264` (`askLocalSource(send, ...)`), `:287` (retry), gate `capture-selector/local-source-notice.tsx:104-133` | web: `live-session-new-local-notice.test.tsx`, `live-local-source-on.test.tsx`, `features/devices` = 12 files / 121 tests passed (`.cache/gates/70/entry_web_tests.log`); mobile: 48 suites / 399 passed incl. `local-source-notice.test.tsx`, `local-source-notice-model.test.ts` (`entry_mobile_tests.log`) | YES, web and tablet, section 4 | FIXED |
| R69-02 "is on" on mobile Session New / Live / Home | `registered-devices-model.ts` `sourceOnKeyOf`; badge components | `source-on-home.test.tsx`, `source-on-session-live.test.tsx`, `source-on-session-live-offscreen.test.tsx`, `registered-devices-model.test.ts` PASS in the run above | NO - needs an open local device: user-attended, not run (gate 75 `M5-SEC-PRIV-2-*`) | FIXED in code and test; not proven on device |
| R69-03 REAL_PRODUCTION lists no development devices | `apps/core-server/src/capture/fence/sources.ts:166` `storedDeviceListingOf`, applied at rehydration | `src/modules/devices/__tests__/source-class.db.test.ts` 1 file / 7 passed, case `:146` "R69-03: stored development devices (LOCAL_DEVICE and FAKE), unassigned, are in no list of a production Core; the rows stay stored"; teardown `0 remain` (`entry_r69_03_db.log`) | not started on a standing database, as instructed | FIXED |
| D181 (7) / D184 Start Recording notice, consent never remembered | web `index.tsx:501` `localGate.guard(start, 'START')`; mobile `use-session-new.ts:290` | `local-source-start-notice.test.tsx` PASS (mobile), web D181 cases in the file above PASS | NO - a start needs a confirmed pre-check: user-attended, not run | FIXED in code and test |
| D181 (3) lock-out guard counts credential-bearing rejections only | `modules/capture-discovery/connect/limits.ts` | `src/modules/capture-discovery` in `m4_core_unit.log` (45 files / 709 passed) and `m4_core_db.log` (11 files / 107 passed) | NO (stub) | FIXED in code and test |

Entry condition: **met** (0 BLOCKER, 0 MAJOR of review 69 open).

## 3. Checks

Surface: W1 / W2 = web console lane 1 (SIMULATED, 5176) / lane 2 (REAL_DEVELOPMENT, 5177), headless
Chromium over CDP; T = tablet `emulator-5556` on lane 2; P = phone `emulator-5554` on lane 1.
Audit rows quoted are from `GET /api/v1/audit` of the lane.

### 3.1 Plan section D checks

| Check | Surface | Result | Evidence |
|---|---|---|---|
| M4-SEL-W | W2 | PASS | "Make primary" on MIC-02: roles swap in the panel, exactly one row seq 91 `CAPTURE_CONFIG_CHANGED {field ROLE, from STANDBY, to PRIMARY, inputId MIC-02, permission CAPTURE_CONFIG, operationId setPrimaryMic}`; reverted, seq 92. Camera line: seq 98 `{field SOURCE, from CAM-01, to CAM-03, trackId VIDEO-01, operationId setCaptureCameraSource}` and seq 102 back. `captureConfig` / `captureDevices` lines carry `sourceClass` on lane 2. Capture operation: REAL_DEVELOPMENT. Not run: "a candidate id is refused (422)" (no candidate exists on a lane) |
| M4-SEL-T | T | PASS | sheet "Change the primary microphone" -> MIC-02 -> Save: row roles swap, one row seq 96; the web page of lane 2 showed the new roles without a reload; reverted, seq 97 |
| M4-SEL-P | P | PASS | same on lane 1: seq 100, reverted seq 101. Capture operation: SIMULATED |
| M4-LOCK-1 | W1 + API | PASS | with session `SES-20261010-0024` open (PRECHECK): `POST /capture/mics/MIC-02/primary` -> `409 CAPTURE_CONFIG_LOCKED`, roles unchanged, no audit row; op 97 answered 200 (not locked, seq 94); the selector shows "The capture configuration cannot be changed while a session is open." on the panel and under each control, all five controls disabled, 0 toasts - `w1_selector_locked.png`. Ops 89 / 95 / 96 under lock: NOT PROVEN live (no candidate); db suite `m4_core_db.log` |
| M4-FAKE-1 | software | PASS | `src/capture/adapters` + `test/support` in `m4_core_unit.log` (709 passed) |
| M4-PC-1 | W2, P | PARTIAL | the refused state is proven (below, RBAC); "Checking your permissions..." was not observed (already resolved 200 ms after navigation); unit inventory in the web / mobile runs |
| M4-RG-* / M4-QA-1 | software | PASS by mapping, with a limit | `test/06_checkpoint_wave_f.md` B1-B9: typecheck and lint exit 0 in 7 workspaces; suites green except 6 reds, each closed by `implementation/119_pass_fz.md` with targeted runs. **Limit:** no whole-suite run exists on `f293221` itself (the checkpoint ran on `abf742f` + uncommitted work, F-Z ran targeted files). M4 files re-run now: core unit 709, core db 107, shared 71, web 121, mobile 399, all passed |

### 3.2 Client checks of section A.4a.6

| Check | Surface | Result | Evidence |
|---|---|---|---|
| M4-DISC-W, -T, -P | W, T, P | NOT PROVEN | B-1. Lane 1: `POST /capture/discovery` -> `503 NOT_READY`, the panel reads "Camera search is not available on this Core yet." (`w1_search_lane1.png`; phone the same with a Retry button), no audit row. Lane 2: not pressed - it would send a real WS-Discovery multicast (`capture-discovery/index.ts`: `realCapture ? own : null`), forbidden by the brief |
| M4-DISC-EMPTY-W/T/P (notification A) | - | NOT PROVEN | B-1 |
| M4-DISC-RBAC-W | W2 | PASS (one part not observed) | INVESTIGATOR: both search buttons and the microphone "Search again" disabled, sentence "Requires the SUPERVISOR or TECHNICIAN role" tied by `aria-describedby`; request log of that principal: 0 calls of op 94 (`GET auth/session`, `capture/config`, `capture/devices` only) - `w2_devices_investigator.png`. "Checking..." first: not observed |
| M4-DISC-RBAC-P | P | PASS (same limit) | `camera-search-action` disabled + "Requires the Supervisor or Technician role"; selector and re-read controls disabled; log after opening Devices: 0 calls of op 94 - `p1_devices_investigator.png` |
| M4-DISC-RBAC-T | T | NOT RUN | time; the same component as the phone |
| M4-DISC-OWNER-W | - | NOT PROVEN | B-1 |
| M4-CONN-W, -ABANDON-W, -GUARD-W, M4-SEC-UI-1, M4-CONN-NOCRED-1 (UI half) | - | NOT PROVEN in a browser | B-1: no candidate, so the connect dialog cannot be opened on a lane. The target row, the two uncontrolled fields, "no `value` attribute while typing", reveal off, the five outcomes are proven by `camera-connect-canary.test.tsx` and the `features/devices` files only (121 passed). The API-reference "Try it" refusal (deny list 10) was not driven |
| M4-CONN-LOCK-W | W1 | PARTIAL | selector lock proven (M4-LOCK-1); "Connect disabled with its sentence": NOT PROVEN (no candidate); search control stayed enabled with a session open in PRECHECK |
| M4-CONN-PTR-T / -P | T, P | PARTIAL | 0 password fields and 0 text inputs in the view tree of the Devices screen on both devices (`uiautomator`: `password fields: 0 EditText: 0`); static test `no-credential-inputs.static.test.ts` PASS. "Connect shown disabled with the web-console sentence": NOT PROVEN (no candidate) |
| M4-NODEV-B-W/T/P, M4-NODEV-NOCFG-T, M4-MIC-ACTIVE-W/T/P | - | NOT PROVEN | a lane has no way to stop one generated camera or microphone: lane 2 has no demo controls, and on lane 1 the simulated pre-check answers the M2 rule (a `CAMERA_LOSS` fault reads "Camera 1 lens fault", BLOCK, audit `PRECHECK_BLOCKED {reasons LENS_FAULT}`), not the R-10 rule. Server rule: `src/capture-notices` in the unit and db runs |
| M4-MIC-RESCAN-W | W2 | PASS | one `POST /capture/inputs/rescan` 200, 0 calls of op 93; rows "MIC 1 (MIC-01)", "MIC 2 (MIC-02)", "MIC 3 (MIC-03)" each Ready, the description "Microphones are not searched on the network", audit seq 90 `{scope MIC_LOCAL, responderCount 3}` - `w2_mic_rescan.png` |
| M4-MIC-RESCAN-T | T | PASS | one request, rows MIC-01 / MIC-02 / MIC-03 Ready, "Checked at", audit seq 95 with `deviceId DEV-0001` |
| M4-MIC-RESCAN-P | P | PASS | one request, rows MIC-01 / MIC-02, audit seq 99 |
| M4-DEVSRC-LABEL-W | W2 / W1 | **FAIL on one surface** | W2: badge "Development source" + "Test source" on camera tiles, audio cards, selector lines and options; "This Mac's camera / microphone" on the roster cards and drawer; never "Simulated". W1: 0 badges and 0 roster cards on the page - but the microphone re-read result draws the badge (G70-01, `w1_mic_rescan_simulated_lane.png`). Search list, pre-check and monitor tiles: not driven |
| M4-DEVSRC-LABEL-T | T | PASS for the surfaces driven | selector rows, source sheet, Home tiles and roster rows / detail carry the badge with "Test source" / "Core Mac's camera" / "Core Mac's microphone" - `t2_devices.png`, `t2_home_local_camera_tile.png` |
| M4-DEVSRC-LABEL-P | P | PASS for the surfaces driven | lane 1: 0 badges on the selector, on the Devices screen and in the re-read result - `p1_devices.png` |
| M4-DEVSRC-LOCAL, M4-UX-UNIT, M4-UX-VOC-1, M4-UX-A11Y-1 | software | PASS | the web, mobile and shared runs above (i18n parity in `m4_shared.log`) |
| Roster cards / detail | W2, T | PASS | CAM-03 / MIC-03 cards "Not assigned", then "Feeds Camera 1" while selected; drawer / detail pane with the limits text (variable frame rate; microphone "Not fit for recording yet...") |

### 3.3 Checks the row names that were not run by instruction

| Check | State |
|---|---|
| `M4-DISC-LAN-1` real-LAN probe | NOT RUN (reason: the gate brief forbids real network discovery) - the row accepts `NOT RUN (reason)` |
| `M4-SEC-DISC-1`, `-3`, `M4-DISC-REC-1`, `M4-CONN-NOCRED-1` (0 outbound requests), the other server checks of A.4a.1-5 | software only: inside the unit / db runs quoted; not re-derived one by one |

## 4. Privacy notices (R69-01, D181 (7), D184) - driven to the notice, every notice cancelled

Read first: operation 79 / 78 runs `assertAssignable` and the engine command `setCaptureConfig` only
(`modules/capture-config/routes.ts:189-200`); the only callers that start a local helper are the
adapter's `open` (pre-check, start) - no timer or boot step opens a device. On that basis lane 2's
`VIDEO-01` was set to `CAM-03` through the web selector (audit seq 98). After the save: one request
in the Core log, no helper process, no `sourceOpen`.

| Step | Surface | Result | Evidence |
|---|---|---|---|
| Session New, Next | W2 | PASS | dialog (`alertdialog`) "Turn on a local device / This will turn on this Mac's camera (CAM-03). / The device check opens the device. Nothing is sent to the Core until you confirm." with "Not now" and "Turn on and run the check" - `w2_notice_precheck_local_camera.png`. As an independent barrier every non-GET request under `/api/v1/session` was failed in the browser by CDP: 0 were attempted |
| "Not now", then Next again | W2 | PASS | back on step 1, no session id; the second press shows the notice again; 0 requests |
| Reload | W2 | PASS | step 1, no notice, 0 requests. Core log for the whole flow: 2 x `GET /auth/session`, nothing else |
| Session New, Next | T | PASS | "This will turn on the Core Mac's camera (CAM-03)." - `t2_notice_precheck_local_camera.png`; Core log after the press: empty |
| "Not now", Next again, relaunch | T | PASS | step 1; the next press asks again; after a force-stop and relaunch only `auth/session`, `auth/status`, `pairing/device`, `auth/touch` reached the Core; no `beginPrecheck`, no create, no helper process at any time; pairing `DEV-0001` kept |
| Phone | P | NOT PROVEN on device | the phone is on lane 1 (SIMULATED: no notice by rule); a re-point costs a new pairing. Same component as the tablet; jest only |
| Reload at step 2 / "Run the device check", "Re-run checks", Start Recording notice, "is on" lines | all | user-attended, not run | each needs one confirmed pre-check, which opens the camera |
| Selector put back | W2 | DONE | seq 102 `CAM-03 -> CAM-01`; `GET /capture/config`: CAM-01, CAM-02, MIC-01 PRIMARY, MIC-02 STANDBY, `locked: false` |

No session was created on lane 2. The local microphone was never selected.

## 5. Findings

| ID | Severity | What | Steps / evidence | Spec |
|---|---|---|---|---|
| G70-01 | MINOR (fails a named assertion) | On a Core in SIMULATED capture the microphone re-read result shows "Development source / Test source" on MIC-01 and MIC-02. Cause seen at the API: operation 97 on lane 1 answers `"adapter":"FAKE","sourceClass":"DEVELOPMENT"` for the built-ins, while `GET /capture/devices` of the same Core sends neither | lane 1 web, Devices, "Search again" in the audio panel - `w1_mic_rescan_simulated_lane.png`. The phone on the same lane draws no badge there | D91 R-2 option A, PE-128-75, D131 ("a Core in simulated capture sends no `sourceClass` for its built-ins"); `M4-DEVSRC-LABEL-W` "0 badges" |
| G70-02 | MAJOR pending a ruling | No client can assign a registered microphone that is not one of the two selector lines. Web: the microphone section has only "Make primary" (`capture-selector-panel.tsx` `MicRow`); tablet / phone: the sheet lists MIC-01 and MIC-02 only. `MIC-03` shows "Not assigned" with no way in; pair replacement (D133 (1)) exists on operation 78 only | lane 2 web selector and tablet sheet as read; cameras do offer CAM-03 | specs R-1 ("which microphone is primary / standby ... editable from all three clients"), `08_client_ux_spec.md:1022` (development configuration: microphone 1 is this Mac's microphone). Consequence: the user's attended local-microphone run cannot be set up from a client |
| G70-03 | MINOR | Fixed stock pictures stand where a camera picture would be, on a real-capture Core: Devices tiles, tablet Home tiles and Session New previews show a conference-room still captioned `CAM-01 | VIDEO-01 | LIVE | DEMO`, also for the track that names "Core Mac's camera" while that camera is off, and beside the sentence "this phase shows no live preview" | `t2_home_local_camera_tile.png`, `t2_notice_precheck_local_camera.png` | an operator can read it as the Mac's camera being on; ux 8f "is on" is the only on-state |
| G70-04 | MINOR (accessibility) | Tablet and phone: after the action ended the control's accessibility label stays "busy" - "Search again for microphones, busy" after the result is drawn, and Session New's Next reads only "busy" (visible text "Next") after "Not now". The control still works | `uiautomator` dumps during the flows | ux 14.3 (state of a control is its real state) |
| G70-05 | NOTE | `CAPTURE_CONFIG_CHANGED` rows written from the tablet / phone carry no sending device (`deviceId` null), while `CAPTURE_DISCOVERY_SEARCHED` from the same device carries `DEV-0001` | lane 2 seq 95 vs 96; lane 1 seq 99 vs 100 | consistency of attribution; not checked against the audit spec |
| G70-06 | NOTE | Phone, INVESTIGATOR: the role sentence is drawn twice in a row at the foot of Capture Sources | `p1_devices_investigator.png` | cosmetic |
| G70-07 | NOTE | Web lane 2: the audio card title is cut to "MIC 1 - Inter..." once the badge is drawn | `w2_devices_investigator.png` | cosmetic |
| G70-08 | NOTE | The client notice is the only barrier before a local device is opened: the Core asks for no confirmation, and the web rule passes straight through while `captureDevices` is not loaded (`local-source-gate.ts` `guard`: `if (!local) action()`). Not reproduced | by reading | D181 accepted a client rule; recorded for the security review |
| G70-09 | NOTE | Demo control `POST /demo/faults {kind CAMERA_LOSS, cameraId VIDEO-02}` raised the fault on VIDEO-01 | lane 1, `demo/status` | outside M4 |

## 6. Not covered, and why

1. **Stub-dependent client flows (B-1).** The stub reaches a Core only through
   `captureDiscoveryControl(app).provideAdapter(...)` inside a test process (`rbac-matrix`, `contract`,
   `capture-discovery.db`, `session-expiry.db`). `scripts/lane/lane.sh` has no stub option, the
   module has no configuration key for a probe target (by design, CR-5 / SEC35-27), and the
   launcher CR-5 describes ("under `apps/core-server/test/support/` ... builds the app with the fake
   adapter registry") does not exist as something that serves a lane port to a browser or a device.
   Missing: one test-support launcher that boots a lane database's Core on the lane port with the
   stub adapter provided, plus a way to switch the stub's modes (N devices, empty, auth-failed,
   wrong profile, not H.264, Basic-only) while the client is driven.
2. Web console Simulated data mode was tried as a stand-in for the dialog and dropped: on a lane's
   dev server it needs the mock Core on 4400, which is not part of this environment.
3. Saved-console-login autofill (`M4-SEC-UI-1`): needs a browser profile with a stored login and the
   dialog; not run.
4. Situation B and the active-microphone rule on clients: no supported way to make one generated
   source unreachable on a lane.
5. `M4-DISC-RBAC-T`, TECHNICIAN role, lock state on the phone (the phone is held on Session New
   while a session is in PRECHECK, so its Devices screen cannot be opened then).
6. A whole-suite run on `f293221`.

## 7. Skipped list

| Item | Reason |
|---|---|
| Biometric sign-in / re-authentication | skipped by the user's instruction (D151); the "Enable biometric sign-in" offer was declined ("Not now") on each sign-in; the sensor was never touched |
| Confirm path of every local-device notice; "is on" lines; Start Recording notice; reload at step 2 | user-attended, not run |
| Real-LAN discovery (`M4-DISC-LAN-1`), any camera search on lane 2 | forbidden by the gate brief |
| REAL_PRODUCTION lane | not started; the db test is the proof |

## 8. Screenshots (`.cache/gates/70/`, each read)

| File | Shows |
|---|---|
| `w1_search_lane1.png` | lane 1 Devices: amber line "Camera search is not available on this Core yet.", no badge on cards or selector |
| `w1_selector_locked.png` | lane 1 selector with the lock sentence on the panel and under each disabled control, session open |
| `w1_mic_rescan_simulated_lane.png` | lane 1 re-read result with the development badge on MIC 1 / MIC 2 (G70-01) |
| `w2_mic_rescan.png` | lane 2 roster card "This Mac's microphone", re-read rows MIC 1-3 with badges, "Checked at" |
| `w2_devices_investigator.png` | lane 2 as INVESTIGATOR: search disabled with the role sentence; badges on tiles; roster card CAM-03 |
| `w2_notice_precheck_local_camera.png` | web notice "Turn on a local device ... this Mac's camera (CAM-03)" over step 1 |
| `t2_devices.png` | tablet Devices: search card, selector rows with "Development source / Test source" |
| `t2_home_local_camera_tile.png` | tablet Home: Camera 1 tile "Core Mac's camera" with a stock room picture (G70-03) |
| `t2_notice_precheck_local_camera.png` | tablet notice "... the Core Mac's camera (CAM-03)", Next busy behind it |
| `p1_devices.png` | phone Devices on lane 1: search card, four selector rows, no badge |
| `p1_devices_investigator.png` | phone as INVESTIGATOR: controls disabled, role sentence (twice at the foot) |

## 9. Environment as left

| Item | State |
|---|---|
| Lanes | 1 and 2 RUNNING (PIDs 44664 / 44593, unchanged), web 5176 / 5177 up, never restarted or reset |
| Lane 2 selector | CAM-01, CAM-02, MIC-01 PRIMARY, MIC-02 STANDBY, unlocked (confirmed by `GET /capture/config`) |
| Sessions | lane 1: one session `SES-20261010-0024` created and CANCELLED from PRECHECK; lane 2: none |
| Demo faults (lane 1) | one `CAMERA_LOSS` raised and cleared; `activeFaults: []` |
| Audit chains | both lanes grew from the seed's seq 83 to a little over 100 (last read: lane 1 seq 101, lane 2 seq 102, before the final sign-ins / sign-outs): sign-ins / sign-outs of seed operators, `CAPTURE_DISCOVERY_SEARCHED (MIC_LOCAL)` 3 on lane 1 and 2 on lane 2, `CAPTURE_CONFIG_CHANGED` 2 on lane 1 and 6 on lane 2, on lane 1 also `FAULT_RAISED`, `SESSION_CREATED`, `PRECHECK_BLOCKED`, `SESSION_CANCELLED`, `FAULT_CLEARED`. A later gate that counts audit rows or alerts from seed should reset both lanes first |
| Alerts | lane 1 may hold the resolved alert of the cleared fault; not inspected |
| Devices | both on Login, "Core online", "paired as DEV-0001", reverse rules intact (4421 / 4422); no re-pairing; no lock change |
| Adopted cameras, candidates | none |
| My sessions | all signed out; cookie jars removed; the three headless browsers stopped |
| Tracked files | `README.md`, `THIRD_PARTY_NOTICES.md`, `apps/capture-worker/README.md` and two asset READMEs became modified at 12:56-13:00 by another agent - not by this gate |

Lapse to record: one page-text read of the web Login printed the published demo password of the
"Demo operators" disclosure into this agent's tool output. It is in no file.

---
*Generated: 2026-10-10 13:10 WIB*
