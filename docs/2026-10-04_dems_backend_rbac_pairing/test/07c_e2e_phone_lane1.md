---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: E2E-P (D191, D194)
agent: verifier
date: 2026-10-06
narrative_tier: 2
status: complete
verdict: PASS with 5 low-severity defects (no wrong server-backed value found)
assets: test/assets/e2e/p_phone/
---

# E2E-P: every mobile screen on the phone in Live mode, and the SC3 and SC4 journeys with the web console (lane 1)

## 1. Environment

| Item | Value | Evidence |
|---|---|---|
| Phone | AVD `dems2_phone`, adb serial `emulator-5554`, 1080 x 2424, density 420; app `com.dems.demo.tablet` (debug build, JavaScript from Metro 8081) | `adb devices -l`, `pm list packages`, `wm size` (09:37) |
| Device state at start | `isKeyguardShowing=false`, DEMS app focused, Login screen in LIVE showing "Core online · Core: DEMS-IR-01 • paired as DEV-0001" | `00_initial_state.png` |
| adb reverse (never changed) | `tcp:8081 -> tcp:8081`, `tcp:4420 -> tcp:4421`, the same at the start (09:37) and the end (10:46) | `adb reverse --list` |
| Core server | lane 1, `http://127.0.0.1:4421`, `dems-core-server 0.2.0`, api v1, database ready, engine ready, heartbeat 1000 ms | `GET /api/v1/health` (09:37:32) |
| Web console | `http://127.0.0.1:5176` (Live, Vite proxy to 4421); `data-core-mode="LIVE"` on the Login page | batch 001 |
| Browsers | Playwright cache `chromium_headless_shell-1243` (HeadlessChrome/153.0.8010.12), two processes with fresh profiles in `$TMPDIR` (removed at the end), raw CDP on 127.0.0.1:9561 (w1) and :9562 (w2), `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1` | driver `e2e_q.mts.txt` (`openCtx`) |
| Operators | w1 = `andi.pratama` (SUPERVISOR); w2 and the phone = `budi.santoso` (INVESTIGATOR at the start and at the end) | `GET /api/v1/admin/users` (09:45:24, 10:45:51) |
| Driver | one queue driver for the phone and both browsers (`e2e_q.mts.txt`, client `send.mjs.txt`): numbered batches `q/NNN.cmd` -> `q/NNN.out`, every line time-stamped (host clock, start of each command); full trail in `q/events.log` (92 batches) | `q/` |
| Timing method | Core times from the server log (host clock); web reactions by polling the page every 50 ms (host clock); phone reactions from `screenrecord --bugreport` (device time printed on every frame, a frame is written only when the screen changes) corrected by the measured device clock offset (device = host - 247 to 259 ms, 5 bracketed reads before each timed step, `p clock`) | `q/058.out`, `q/067.out`, `q/073.out` |
| Window | 09:37 to 10:53 (+07:00) | `core_log_lane1_e2e_p.log` |
| Host load | 3.9 to 24.6 (1-minute); paused 09:52 to 09:54 for the guard (> 14), see ENV-1 | `uptime` |

## 2. Summary

| Part | Result | Detail |
|---|---|---|
| A — every mobile screen | **27 / 27 screens reached in LIVE**, every server-backed value matched the Core | 2 with a note: Recovery shows its "not interrupted" state only (the FAULT phase needs a server restart or fault injection, both forbidden); the phone has no "note" action, its labelled marker (Bookmark) was used |
| B — SC3 shared state | **6 / 6 steps PASS** (4 required, 2 repeats) | web start -> phone: **0.81 s** (screen recording; the first, screencap-bracketed run gave only 1.09 to 2.70 s); phone stop -> web: **84 ms** and **68 ms**; phone start -> web: **52 ms**; web stop -> phone: recording view left at **1.36 s**, Finalizing visible at 2.54 s; browser origins: only `http://127.0.0.1:5176` and `ws://127.0.0.1:5176` |
| C — SC4 role change | **5 / 5 steps PASS** | INVESTIGATOR -> TECHNICIAN: w2 **88 ms**, phone toast **0.51 s**, phone control **0.67 s** (repeat: w2 <= 201 ms, phone 0.64 / 0.77 s); denied calls 403 + `ACCESS_DENIED` from w2 and from the phone; `ROLE_CHANGED` quoted; back to INVESTIGATOR: w2 <= 255 ms, phone toast 0.88 s, phone control **1.25 s** (over 1 s, O-1) and 0.56 s on the repeat |
| Defects | 5, all Low (E2E-P-1 to E2E-P-5) | bottom-nav highlight, stale Stack Check copy, two Home timers 1 s apart, blank 1.2 s screen on a remote stop, Start Session not role-gated on the phone |
| End state | met | phone LIVE, signed out, Login ("You have been signed out.", Core online, paired as DEV-0001) — `99j_end_state_login_live_signed_out.png`; budi.santoso INVESTIGATOR; last session SES-20261006-0034 SEALED, its summary acknowledged; no browser, port or `/sdcard` file left |

## 3. Part A — every mobile screen (LIVE, budi.santoso)

Sign-in: username typed by the driver, password typed by the driver only after the IME reported a password editor (`inputType 0x80081`), never printed; `POST /api/v1/auth/sign-in 200 device:DEV-0001` at 09:48:10.659, then the socket reopened as `operator:OPR-001` (09:48:10.967). The biometric offer was declined with the app's own "Not now". "Core log lines" quote the lane-1 server log (method, route, status, principal) in the screen's window; most screens send no request because the phone reads the Core's replicated state over its socket — the cross-check proves the replica carries the Core's values.

| # | Screen | How reached | Server-backed value checked | Result | Screencap | Core log lines |
|---|---|---|---|---|---|---|
| 1 | Login (LIVE) | launch `demsdemo:///login?core=LIVE&motion=off` (already up) | "paired as DEV-0001" = `GET /pairing/devices`: DEV-0001 PAIRED, pairedAt 5 Oct 16:32:31 | PASS | `01_login_live`, `02_login_username_typed`, `03_after_signin` | `POST /api/v1/auth/sign-in 200 device:DEV-0001`; `[socket opened] operator:OPR-001` |
| 2 | Biometric offer | shown after the password sign-in | (local offer; declining sends nothing) | PASS | `04_biometric_offer` | `POST /api/v1/auth/touch 200 operator:OPR-001` |
| 3 | Home | after "Not now" | Storage 20 % = `GET /storage/status` usedPercent 20; Recent "EV-20261006-0017 Today 01:53" = history[0] evidenceId, endedAt 01:53:56 | PASS | `05_home` | `POST /api/v1/auth/touch 200` (09:49:07.899) |
| 4 | Sessions hub | bottom tab Sessions | rows SES-0029 Incomplete 00:00:17, SES-0028 Sealed 00:00:48, …, SES-0023 00:47:36 = `GET /session/history` (durationMs 17531, 48700, 2856000) | PASS | `06_sessions_hub` | none (0 requests) |
| 5 | Session detail | tap the INCOMPLETE row SES-20261006-0029 (a SEALED row opens its evidence on phones by design, `sessions-model.ts:274-276`; `07a_…`) | LP/2026/1006-0013, "Dewi W73 Device", 01:53:38 – 01:53:56, EV-20261006-0017, power failure = history item | PASS | `07_session_detail_incomplete`, `07a_sessions_sealed_row_opens_evidence_detail` | `GET /api/v1/evidence/:id 200` (07a); `POST /api/v1/auth/touch 200` |
| 6 | Evidence list | bottom tab Evidence | EV-0017 Recorded 00:00:17, EV-0016…0012 Sealed = `GET /evidence` status, durationMs | PASS (see E2E-P-1) | `08_evidence_list` | `POST /api/v1/auth/touch 200` |
| 7 | Evidence detail | tap EV-20261005-0014; tab Hash & Integrity | manifest `f45dc4dd…84dbc9`, Camera 1 SHA-256 `61f385fb…cfe8ca`, 00:01:39, 227.2 MB = `GET /evidence` manifestHash, tracks[0].sha256, durationMs 99729, sizeBytes 227160500 | PASS | `09_evidence_detail`, `09b_…hash`, `09c_…track_hashes` | `GET /api/v1/evidence/:id 200 operator:OPR-001` (09:54:39.551) |
| 8 | Devices list | bottom tab Devices | cameras and mics Online, PoE "1 active · 1 spare", Tablet Connected = `GET /device/inventory` (online, ports POE_CAM_2_AUX spare, tabletLink CONNECTED); "Recording Indicator: Active" vs Core status "Standby" is by design (O-2) | PASS | `10_devices_list` | none |
| 9 | Device detail | tap Camera 1 | DL-2 (lens 1), firmware 3.8.14, PoE CAM 1, 1080p · 25 fps · H.264, 9 Mbps = inventory cameras[0]; Restart disabled "Requires the Technician role" (INVESTIGATOR has no DEVICE_MANAGE in `GET /rbac/matrix`) | PASS | `11_device_detail_cam01`, `11b_…scrolled` | `POST /api/v1/auth/touch 200` |
| 10 | More | bottom tab More | "AKP Budi Santoso · Investigator · OPR-001" = `GET /admin/users`; "Audit, 248 events" = `GET /audit` total 248 (09:59:48) | PASS | `12_more`, `12b_more_footer` | none |
| 11 | Storage | More › Storage | 804 GB used, 3.2 TB free of 4.0 TB, 20 %; sheet "Current: 90 days · auto-archive on", view-only for Investigator = `GET /storage/detail` (usedBytes 804474445167, DAYS_90, autoArchive true) | PASS | `13_storage`, `13b_storage_manage_sheet_investigator` | `POST /api/v1/auth/touch 200` |
| 12 | Network & Time | More › Network & Time | GNSS 10 satellites, NTP 192.168.10.1, PoE 2 of 2, last sync 09:58:54 = `GET /time/status` (satellites 10, ntp.server, lastSyncAt 09:58:54), `GET /network/status` (activePorts 2/2) | PASS | `14_network_time` | none |
| 13 | Audit | More › Audit | 248 entries, head `71805972`, row 248 "Sign-in succeeded · AKP Budi Santoso · Password · DEV-0001" = `GET /audit` (248, AUTH_SUCCESS OPR-001 09:48:10), `GET /audit/chain` head `718059724282…` ok | PASS | `15_audit` | `POST /api/v1/auth/touch 200` |
| 14 | Settings | More › Settings | account row "Investigator, AKP Budi Santoso" = admin/users | PASS | `16_settings` | none |
| 15 | Settings › App Preferences | row | Core link source = Live (the client's mode; its requests reach 4421 as operator:OPR-001) | PASS | `17_…`, `17b_…` | none |
| 16 | Settings › Notifications | row | device-local toggles; no Core value exists | PASS (N/A) | `18_settings_notifications` | none |
| 17 | Settings › Security & Privacy (+ Core pairing) | row; link Core pairing | "Paired with DEMS-IR-01 as DEV-0001", paired at 5 Oct 2026 16:32:31, certificate `76:0B:E9:29…` = `GET /pairing/devices` pairedAt, `GET /security/status` DEVICE_CERT fingerprint; Biometric sign-in off | PASS | `19_…`, `19b_…`, `19c_settings_security_core_pairing` | none |
| 18 | Settings › System Maintenance | row | "v2.5.0 available" = `GET /system/status` update.availableVersion 2.5.0; "Your role does not include the demo controls" (DEMO_CONTROL is SUPERVISOR only) | PASS | `20_…`, `20b_…` | none from the phone |
| 19 | Settings › About DEMS | row | v2.4.1, DEMS-IR-01, serial DEC-2026-IR01-000117, PRV-2026-0117 = inventory device.identity | PASS | `21_…`, `21b_…` | none |
| 20 | Settings › Profile sheet | account row | role Investigator, permissions SESSION_START, SESSION_NOTE, EVIDENCE_VIEW, DIAGNOSTICS_RUN = `GET /rbac/matrix` grants of INVESTIGATOR | PASS | `23_settings_profile_sheet` | `POST /api/v1/auth/touch 200` |
| 21 | Stack Check | About › Stack diagnostics | "core-server v0.2.0 · api v1", Live, heartbeat 2600 -> 2607 in about 7 s = health version 0.2.0, heartbeatIntervalMs 1000 | PASS (E2E-P-2 copy) | `22_stack_check`, `22b_…` | `GET /api/v1/health 200 operator:OPR-001` |
| 22 | Start Session step 1 | Home › Start Session | case LP/2026/1006-0014 (filled from the replica) = the created session's caseNumber | PASS | `24_…`, `25_…filled` | none before Next |
| 23 | Start Session step 2 (Core gate) | Next | "All checks passed", 8 of 8, Core Machine ONLINE PASS = `GET /session/current` precheck PASS, 8 items PASS | PASS | `26_start_session_step2_gate` | `POST /api/v1/session 201`, `POST /api/v1/session/:id/precheck 202` |
| 24 | Start Session step 3 (Ready, 3-2-1) | Next; Start Recording | session SES-20261006-0030 -> RECORDING, startedAt 10:07:59 | PASS | `27_…ready`, `28_countdown_00/01` | `POST /api/v1/session/:id/start 200` (10:07:59.377) |
| 25 | Live / Monitor | hand-off after the countdown | timer 00:00:43 at 10:08:43.19 = Core elapsed 43.8 s; meters −15 / −52 dBFS = `GET /audio/status` −14.68 / −51.65 | PASS (O-4) | `29b_live_monitor_b`, `30_monitor_timer_00` | none (frames over the socket) |
| 26 | Monitor › Bookmark (the phone's note) | Bookmark tile, label "E2E-P phone note" | `MARKER_ADDED` #277 "Marker added: E2E-P phone note", details {index 1, label}; evidence EV-0018 markers[0].label | PASS (O-6) | `31_…sheet`, `31b_…typed`, `32_monitor_marker_added` | `POST /api/v1/session/:id/markers 204` |
| 27 | Back-guard dialog | Android Back on the monitor | "Recording continues on the Core. Leave the monitor?" Stay on monitor / Go to Home; Go to Home reaches Home (re-test 10:49:55: dialog closes 1.6 s, Home at about 2 s) and Home shows "Session in progress … Return to live session" | PASS (ENV-2) | `33_back_guard_dialog`, `99d_…`, `99f_retest_go_home_frames`, `36b_after_go_home_settled` | none |
| 28 | Recovery | force-stop during RECORDING, relaunch LIVE: Login (`41`), sign-in, route sync straight back to the monitor (`42`, `43`; 00:09:36 at 10:17:35 = Core elapsed 575.9 s); then deep link `demsdemo:///session/recovery` | "This session is not interrupted · Recovery runs only after a critical fault stops a session · Return to the session" — correct for a RECORDING session without fault. The FAULT phase was **not reachable** honestly: a forced app stop leaves the Core recording, and a server restart or fault injection is forbidden on lane 1 | PASS (idle state only) | `41_relaunch_after_forcestop`, `42_…route_sync`, `44_recovery_deeplink_while_recording` | `[socket closed] operator:OPR-001`; `GET /auth/session 401`, `GET /pairing/device 200`, `GET /auth/status 200` (device); `POST /auth/sign-in 200` |
| 29 | Stop (End Session dialog) | End Session, reason "E2E-P phone stop", confirm | `RECORDING_STOPPED` #356 reason "E2E-P phone stop", durationMs 682444 | PASS | `46_end_session_dialog`, `46b_…typed` | `POST /api/v1/session/:id/stop 202` (10:19:21.820) |
| 30 | Finalizing | automatic | 0 % -> 17 % -> 33 % -> 50 %, EV-20261006-0018 = `EVIDENCE_SEALED` #357 at 10:19:29 | PASS | `47_finalizing_00` … `_05` | none (socket) |
| 31 | Summary | automatic | SEALED SES-0030, 10:07:59 – 10:19:21, 00:11:22, 1.6 GB, sealed 10:19:29 = `GET /evidence/EV-20261006-0018` (durationMs 682444, sizeBytes 1554455778, sealedAt 10:19:29); "View in Evidence" acknowledged it (`SUMMARY_ACKNOWLEDGED` #358) | PASS | `48_summary`, `49_after_summary_done` | `POST /api/v1/session/:id/summary/acknowledge 204`, `GET /api/v1/evidence/:id 200` |

Counted against the brief's list (Login, Home, Sessions + detail, Evidence + detail, Devices + detail, More, Storage, Network & Time, Audit, Settings + 5 sections, Stack Check, Start Session, Live/Monitor, Stop, Finalizing, Summary, Recovery, back-guard, plus the Pair screen): **27 / 27**. Not exercised: `dev-gallery` (debug-only gallery) and `+not-found`.

Audit rows of the Part A session SES-20261006-0030 (`GET /api/v1/audit?type=…&sessionId=…`, batch 052):

```
252 SESSION_CREATED      OPR-001 10:07:18 {"caseNumber":"LP/2026/1006-0014","subjectType":"TERSANGKA"}
253 PRECHECK_PASSED      OPR-001 10:07:23 {"by":"system","warnings":0,"acknowledged":false}
254 RECORDING_STARTED    OPR-001 10:07:59 {"timeSource":"GNSS"}
277 MARKER_ADDED         OPR-001 10:10:47 {"index":1,"label":"E2E-P phone note"}
356 RECORDING_STOPPED    OPR-001 10:19:21 {"reason":"E2E-P phone stop","durationMs":682444}
357 EVIDENCE_SEALED      (system) 10:19:29 {"tracks":4,"sizeBytes":1554455778,"manifestHash":"069e7aaf…"}
358 SUMMARY_ACKNOWLEDGED OPR-001 10:20:11 {}
```

## 4. Part B — SC3 shared state (web w1 andi.pratama <-> phone budi.santoso)

| Step | Action | Expected | Observed (timestamps, delay) | Result | Captures | Audit row |
|---|---|---|---|---|---|---|
| B1 run 1 | w1 Session New wizard (scan, Tersangka, name, gate 8/8, Ready, Start with 3-2-1); phone on Home | session appears on the phone within 2 s | Core `POST …/SES-20261006-0031/start 200` 10:22:42.256; phone screencaps: last without it `54_…06` (started 10:22:43.341), first with "Session in progress · Recording SES-20261006-0031 · REC 00:00:00" `54_…07` (10:22:44.192–44.957) -> **1.09 to 2.70 s** (each screencap takes 0.6–0.9 s: too coarse to decide) | inconclusive -> re-run | `51`, `52`, `53`, `54_sc3_s1_phone_00…13`, `55_sc3_s1_web_after_start`; `52p` (phone shows "Continue setup" after the web's create) | `SESSION_CREATED` #359 OPR-002 10:21:48.240; `RECORDING_STARTED` #361 OPR-002 10:22:42.248 |
| B1 run 2 | same, SES-20261006-0033, phone screen-recorded | within 2 s | Core 200 10:31:47.668 (browser 47.659 -> 47.671); phone frame f=1 device 10:31:44.113 "Ready for Recording", next frame f=2 device 10:31:48.225 = host 10:31:48.477 (offset −252 ms) "Session in progress SES-20261006-0033" -> **0.81 s** | **PASS** | `67_sc3_s1b_web_ready`, `68_sc3_s1b_web_recording`, `69_sc3_s1b_phone_transition_frames_f1_f11`, `68p_…`, `sc3_s1b_phone.mp4` | `SESSION_CREATED` #402 OPR-002 10:31:17.948; `RECORDING_STARTED` #404 OPR-002 10:31:47.663 |
| B2 run 1 | phone: Return to live session, End Session, reason "SC3 stop on phone", confirm (10:26:39.993) | the web shows it stopped | Core `stop 202` 10:26:40.776; w1 Session Monitor `data-session-state=STOPPING` at 10:26:40.860 (**+84 ms**), finalization modal SEALED 10:26:48.029 ("EV-20261006-0019 sealed 7.1 s after the recording ended") | **PASS** | `56_…before_stop`, `56q_…end_dialog`, `57_sc3_s2_web_after_phone_stop`, `58_sc3_s2_web_sealed`, `58p_…summary` | `RECORDING_STOPPED` #388 OPR-001 10:26:40.767 {"reason":"SC3 stop on phone","durationMs":238519}; `EVIDENCE_SEALED` #389 |
| B2 run 2 | phone stops SES-0033 (confirm 10:32:59.075) | as above | Core 202 10:32:59.160; w1 STOPPING 10:32:59.228 (**+68 ms**), SEALED 10:33:05.545 | **PASS** | `70_…end_dialog`, `71_…after_phone_stop`, `71b_…sealed`, `72_…summary` | `RECORDING_STOPPED` #410 OPR-001 10:32:59.156 (reason as typed into the field: "SC3  on phone 2", ENV-3); `EVIDENCE_SEALED` #411 |
| B3a | reverse: phone wizard (SES-20261006-0032), Start Recording; w1 on the Dashboard | the web shows it within 2 s | Core `start 200` 10:28:20.912; w1 Dashboard `session-recording` panel "REC … SES-20261006-0032 … LP/2026/1006-0016" at 10:28:20.964 (**+52 ms**) | **PASS** | `60_…step1`, `61_…ready`, `62_sc3_s3_web_dashboard_recording` (captured mid-entrance), `62p_…monitor` | `SESSION_CREATED` #391 OPR-001 10:27:47.403; `RECORDING_STARTED` #393 OPR-001 10:28:20.907 |
| B3b | w1 Session Monitor: End Session, reason "SC3 stop on web", confirm (10:28:55.634); phone on the monitor, screen-recorded | the phone shows it stopped | Core `stop 202` 10:28:55.650; phone frame f=30 device 10:28:56.532 still Recording, f=31 device 10:28:56.765 = host 10:28:57.012 the monitor is gone (**+1.36 s**), blank until "Finalizing evidence" fades in at device 10:28:57.947 (+2.54 s, E2E-P-4), "Evidence sealed EV-20261006-0020" at device 10:29:03.239 | **PASS** | `63_sc3_s3_web_end_dialog`, `64_sc3_s3_web_after_stop`, `65_sc3_s3_phone_transition_frames_f27_f42`, `64p_…`, `66_…summary_pending`, `sc3_s3_phone.mp4` | `RECORDING_STOPPED` #399 OPR-002 10:28:55.644 {"reason":"SC3 stop on web","durationMs":34737}; `EVIDENCE_SEALED` #400 |
| B4 | browser network log | requests to the page origin only | w1: `{"http://127.0.0.1:5176":4798,"ws://127.0.0.1:5176":29}`; w2: `{"http://127.0.0.1:5176":863,"ws://127.0.0.1:5176":5}` (every request and socket of both profiles, 09:45–10:46; other hosts were unresolvable by launch flag) | **PASS** | `w1_network.log`, `w2_network.log` | — |

Note on B1 run 1: the web start went through the UI; the driver's `type` verb ends its selector at the first space, so the word "input" (meant as part of the selector) was typed as text and the subject name became "input SC3 Web Start" (visible on `55_…`; a driver artifact, not an app fault).

## 5. Part C — SC4 live role change (w1 SUPERVISOR, w2 and phone budi.santoso)

Role-bound controls watched: **web w2** — Dashboard "Start New Session" (`start-new-session`) vs `start-new-session-locked` ("Requires the Investigator role"); **phone** — Camera 1 detail "Restart" (enabled only with DEVICE_MANAGE, hint "Requires the Technician role" otherwise) and the runtime toast "Your role is now …". No new sign-in happened during C: the phone's last sign-in was 10:17:28.564 and w2's own first sign-in 10:34:48.312 (before C1); the server log has no `auth/sign-in` between 10:34:48.312 and the re-test sign-in at 10:48:45.689 (`core_log_lane1_e2e_p.log` lines 196 and 257).

| Step | Action | Expected | Observed (timestamps, delay) | Result | Captures | Audit row |
|---|---|---|---|---|---|---|
| C0 | before | INVESTIGATOR controls | w2 Start New Session enabled; phone Restart disabled + "Requires the Technician role"; w1 Users & Roles budi.santoso Investigator | PASS | `73_sc4_w2_budi_dashboard_before`, `74_sc4_w1_users_roles_before`, `75_sc4_phone_device_detail_before` | — |
| C1 | w1 Users & Roles: row menu › Change role › Technician › Change role (10:35:41.117) | controls change on the phone and w2 within 1 s, no new sign-in | Core `POST /api/v1/admin/users/:id/role 200` 10:35:41.135; w2 locked at 10:35:41.223 (**+88 ms**), toast "Your role is now Technician. The available actions have changed.", aria-label "Start New Session: Requires the Investigator role"; w1 toast "Role of AKP Budi Santoso is now Technician" 10:35:41.265; phone toast by device 10:35:41.385 = host 41.642 (**+0.51 s**), Restart enabled, hint gone at device 10:35:41.544 = host 41.801 (**+0.67 s**) | **PASS** | `76_…dialog_technician`, `77_sc4_w2_after_change_locked`, `77b_…`, `79_sc4_phone_frames_restart_control`, `79b_…toast_f2_f3_f6`, `78_…`, `sc4_to_tech_phone.mp4` | `ROLE_CHANGED` #414 OPR-002 10:35:41.127 "Role of OPR-001 changed from INVESTIGATOR to TECHNICIAN" {"to":"TECHNICIAN","from":"INVESTIGATOR","targetOperatorId":"OPR-001"} |
| C2 | now-denied call: w2 page request `POST /api/v1/session`; phone Start Session wizard › Next | 403 + `ACCESS_DENIED` | w2: 403 `NOT_PERMITTED` {"operationId":"createSession","permission":"SESSION_START","role":"TECHNICIAN"} (10:37:05.354, `[request refused by the access rule]`); phone: `POST /api/v1/session 403 NOT_PERMITTED` 10:38:01.203, the app shows "Not permitted · Requires the Investigator role" and "The session could not be created" | **PASS** | `83_sc4_phone_create_refused`, `81_…`, `82_…`, `85w_sc4_w2_technician_dashboard` | `ACCESS_DENIED` #415 OPR-001 10:37:05.349 (web); #416 OPR-001 10:38:01.193 deviceId DEV-0001 (phone) — "Access denied: role TECHNICIAN lacks SESSION_START (createSession)" |
| C3 | change back: Investigator (10:41:16.269) | controls return | Core 200 10:41:16.320; w2 unlocked at the first poll 10:41:16.575 (**<= 255 ms**), toast "Your role is now Investigator…"; phone toast device 10:41:16.956 = host 17.204 (+0.88 s), Restart disabled + hint device 10:41:17.320 = host 17.568 (**+1.25 s**, O-1) | PASS (controls returned; phone over 1 s in this sample) | `86_…dialog_back_to_investigator`, `90_sc4_w2_after_back_unlocked`, `90b_…`, `92_sc4_phone_frames_back_f1_f4`, `91_…`, `sc4_back_phone.mp4` | `ROLE_CHANGED` #417 OPR-002 10:41:16.305 "Role of OPR-001 changed from TECHNICIAN to INVESTIGATOR" |
| C4 | repeat cycle at load 7 (to Technician 10:42:42.858, back 10:43:46.156) | as C1 / C3 | to Technician: Core 200 10:42:42.919, w2 <= 201 ms, phone toast +0.64 s, control +0.77 s; back: Core 200 10:43:46.172, w2 <= 61 ms, phone toast +0.47 s, control +0.56 s | **PASS** | `93_sc4_cycle2_phone_frames_to_technician`, `94_sc4_cycle2_phone_frames_back`, `sc4_cycle2_*.mp4` | two further `ROLE_CHANGED` rows (server log `POST /admin/users/:id/role 200` 10:42:42.919 and 10:43:46.172; sequence numbers not read) |
| C5 | end | budi.santoso INVESTIGATOR | `GET /admin/users` 10:45:51: OPR-001 INVESTIGATOR enabled; phone More 10:52:15 "Investigator" | **PASS** | `95_…`, `96_more_before_sign_out` | — |

"<=" values for w2: the first poll after the confirm press already found the new state, so the figure is an upper bound.

## 6. Defects

| ID | Severity | Where | Repro | Expected | Observed | Evidence |
|---|---|---|---|---|---|---|
| E2E-P-1 | Low (UI) | phone bottom navigation | Sessions tab › tap the INCOMPLETE row (session detail) › tap the Evidence tab; then Devices, More (motion=off) | the pill and the gold icon move to the active tab | on Evidence the pill and the gold icon stay on Sessions, only the "Evidence" label turns gold (and stays so on the detail); on Devices and More the pill moves but the Sessions icon stays gold | `90a_defect_e2e_p1_bottom_nav_crops.png` (rows: Home, Sessions, Evidence, Devices, More), `08_evidence_list`, `09c_…`, `10_…`, `17_…` |
| E2E-P-2 | Low (copy) | Stack Check (About › Stack diagnostics) | open it in LIVE | copy matching the Live link | card text "wired to the local mock-core over adb reverse" while the service line shows "core-server v0.2.0 · api v1" and the chip "Live" | `22_stack_check` |
| E2E-P-3 | Low (UI) | Home while recording | Home during a recording | the two timers of the same session agree | System Status timer and the bottom "Recording" bar differ by 1 s in the same frame: 00:04:32 vs 00:04:31 (`36b`), 00:00:27 vs 00:00:26 (`99f`, frame device 10:49:58.274) | `36b_after_go_home_settled`, `99f_retest_go_home_frames` |
| E2E-P-4 | Low (UI) | phone monitor, stop from another client | phone on the monitor; stop the session on the web | the monitor hands over to Finalizing as for a local stop | about 1.2 s of empty screen (device 10:28:56.765 to 57.947) before "Finalizing evidence" fades in; a phone-initiated stop shows Finalizing over the monitor at once (`47_finalizing_00`, 0.6 s after the stop) | `65_sc3_s3_phone_transition_frames_f27_f42`, `sc3_s3_phone.mp4` |
| E2E-P-5 | Low (client parity; needs-review) | phone Home › Start Session for a role without SESSION_START | change budi.santoso to TECHNICIAN, tap Start Session on the phone | entry gated like the web (locked button / route guard) | the phone shows Start Session and opens the wizard (investigator list falls back to AKP Andi Pratama); Next is refused by the Core (403, `ACCESS_DENIED` #416) and the app explains it. Not a security gap — the Core enforces it — but the two clients differ | `80_…`, `81_…`, `82_…`, `83_sc4_phone_create_refused`; `session-new-screen.tsx:153-203` handles only a permission lost while open |

No server-backed value on any screen differed from the Core (every cross-check in §3 matched).

## 7. Observations, environment and process notes

| ID | Kind | Note | Evidence |
|---|---|---|---|
| O-1 | timing | SC4 change back, first sample: phone control 1.25 s after the Core (toast 0.88 s); repeat 0.56 s. The required change (to TECHNICIAN) was 0.67 s and 0.77 s | `92_…`, `94_…` |
| O-2 | by design | Devices list "Recording Indicator: Active" while the Core's status text is "Standby": the phone maps relay online -> ACTIVE (`apps/mobile/src/features/devices/devices-model.ts:99-101`) | `10_devices_list`, inventory output in `q/014.out` |
| O-3 | timing | first sign-in: the button still read "Signing in…" with "Connecting to Core…" 3.5 s after the 200; Home by 09:48:36 (not seen on the later sign-ins) | `03_after_signin`, `03b_…` |
| O-4 | timing | at the monitor hand-off the first frame read 00:00:05 at Core elapsed 7.9 s with a "Resynced" banner; 36 s later it matched exactly | `29b_…`, `30_monitor_timer_00` |
| O-5 | web (out of scope) | Session New header on w1 showed the previous session ID (SES-…-0030) before a new session existed | `w1_probe_session_new_step1.png` |
| O-6 | scope | the phone monitor has no "note" action (Snapshot, Bookmark, Audio Monitor, Settings); the labelled marker was used; notes exist on the web Session Monitor | `29b_…`, `31_…` |
| ENV-1 | host | load 24.6 at 09:52 > 14: paused until 11.9 (09:54:20) | §1 |
| ENV-2 | host / emulator | 10:12–10:15: the phone's UI lagged about 30 s behind the Core (timers stale), a `POST /api/v1/auth/touch` timed out after 8000 ms and never reached the Core, the app showed "Core Offline" with dev-build LogBox notices, then recovered by itself (10:15:13: Core Live, timer = Core elapsed). It coincided with 10 MB raw screencaps through adb and load 11–24; the driver switched to on-device PNG. The back-guard "Go to Home" misbehaved only in this window and works at load 4.9 (re-test, §3 #27) | `38_home_timer_check_02`, `39_core_offline_check`, `36_go_home_00…04`, `99f_…` |
| ENV-3 | harness | `adb shell input text` once dropped a word ("SC3 stop on phone 2" arrived as "SC3  on phone 2"); the Core stored what the field showed (#410) | `70_sc3_s2b_phone_end_dialog` |
| ENV-4 | expected | w1 was signed out by the Core after 15 min without a touch (`AUTH_EXPIRED` #250 10:02:54; the first, closed browser #249 10:00:20); the page returned to Login | `w1_expired_probe.png`, `q/027.out` |
| PD-1 | process deviation | one `uiautomator dump` ran while the Login screen showed (batch 084, 10:45:03, right after sign-out; the driver's guard used a stale screen declaration). It completed; nothing on the device changed | `q/084.out` |
| PD-2 | process | added beyond the brief: `screenrecord --bugreport` clips for timing (capture only; `/sdcard` files removed), and a re-test session SES-20261006-0034 (10:48–10:52) to triage ENV-2 | `q/087…091.out` |

Lane-1 records created by this row: sessions SES-20261006-0030 to 0034 (all SEALED, every summary acknowledged), evidence EV-20261006-0018 to 0021 (and the sealed evidence of 0034), `MARKER_ADDED` #277, two `ACCESS_DENIED`, four `ROLE_CHANGED`. Audit chain after the run: `GET /audit/chain` view ok, stored ok, 420 rows checked (10:45:51).

## 8. Pending — biometric sign-in (the user's touch)

Not run by me (fingerprint touches belong to the user). The app is left at the starting state for it:

1. **State now:** Login screen in LIVE, signed out, "Core online · Core: DEMS-IR-01 • paired as DEV-0001"; the fingerprint button is inactive with "Sign in with your password once to enable biometric sign-in on this tablet." (`99j_end_state_login_live_signed_out.png`).
2. Sign in with the password as budi.santoso. The app then shows **"Enable biometric sign-in on this tablet? — Enable / Not now"** (`04_biometric_offer.png`, `42_after_resignin_route_sync.png`). **This is the point for the touch:** tap **Enable**; Android's system biometric prompt appears; touch the sensor (emulator Extended controls › Fingerprint, or the user's own command). The same switch is in Settings › Security & Privacy › "Biometric sign-in" (now off, `19_settings_security.png`).
3. Expected per the contract: `POST /api/v1/auth/biometric` (setBiometricEnrollment) succeeds and a `BIOMETRIC_ENROLLMENT_CHANGED` audit row appears; after Sign out, the Login fingerprint button ("Use biometric login") is active; tapping it shows the system prompt; a touch sends `POST /api/v1/auth/biometric/sign-in` and an `AUTH_SUCCESS` row follows. None of this was observed by me.

## 9. Secret handling

The password was read from `packages/shared/src/sim/dataset.ts` inside the driver and never printed, logged or written; on the phone it was typed only into an editor the IME reported as a password field, and screencaps were refused until the sign-in answered 200. Scan (`scan.mts.txt`, counts only) of the 193 text files under `test/assets/e2e/p_phone/` plus this report (194 files, 10:59): **password 0, `dvc_`/`ses_`/`bio_` token shapes 0**; phone JavaScript log since 09:45: token shapes 0; `lane1-server.log`: token shapes 0.

## 10. Screenshot index (file -> caption)

Phone screencaps are 1080 x 2424 (`adb exec-out screencap -p`; batches 004–044 used raw frames converted on the host); web screenshots are 1440 x 900 headless Chromium. All under `test/assets/e2e/p_phone/`.

| File | Caption |
|---|---|
| `00_initial_state.png` | Phone at the start: LIVE Login, Core online, paired as DEV-0001 |
| `01_login_live.png`, `01b_…`, `02_login_username_typed.png` | Login, username field focused, username typed (password empty) |
| `03_after_signin.png`, `03b_after_signin_t2.png` | "Signing in…" just after the 200; Home with the biometric offer |
| `04_biometric_offer.png` | "Enable biometric sign-in on this tablet?" (declined with Not now) |
| `05_home.png` | Home LIVE: Ready for Recording, 2/2, 2/2, 20 %, Recent EV-0017/16/15 |
| `06_sessions_hub.png` | Sessions hub from the Core's history |
| `07_session_detail_incomplete.png` | Session detail SES-20261006-0029, INCOMPLETE, power failure |
| `07a_sessions_sealed_row_opens_evidence_detail.png` | A sealed row opens Evidence Details EV-20261006-0016 (by design on phones) |
| `08_evidence_list.png` | Evidence list (E2E-P-1 visible in the bottom bar) |
| `09_evidence_detail.png`, `09b_…hash.png`, `09c_…track_hashes.png` | EV-20261005-0014: facts, Hash & Integrity, per-track SHA-256 |
| `10_devices_list.png` | Devices & Inputs |
| `11_device_detail_cam01.png`, `11b_…scrolled.png` | Camera 1 detail; Restart disabled for Investigator |
| `12_more.png`, `12b_more_footer.png` | More: operator card, console tiles, footer "Data from the Core server" |
| `13_storage.png`, `13b_storage_manage_sheet_investigator.png` | Storage; Manage Storage view-only for Investigator |
| `14_network_time.png` | Network & Time |
| `15_audit.png` | Operator audit, 248 entries, chain OK |
| `16_settings.png` | Settings list |
| `17_settings_preferences.png`, `17b_…scrolled.png` | App Preferences, Core link source Live |
| `18_settings_notifications.png` | Notifications |
| `19_settings_security.png`, `19b_…`, `19c_settings_security_core_pairing.png` | Security & Privacy; Core pairing (DEV-0001, certificate fingerprint) |
| `20_settings_maintenance.png`, `20b_…` | System Maintenance: v2.5.0 available, demo controls not in role |
| `21_settings_about.png`, `21b_…` | About DEMS: v2.4.1, configuration identity |
| `22_stack_check.png`, `22b_…` | Stack Check: core-server v0.2.0, heartbeat 2600 -> 2607 (E2E-P-2) |
| `23_settings_profile_sheet.png` | Profile sheet: role and permissions |
| `24a_home_before_start.png` | Home before Start Session |
| `24_start_session_step1.png`, `25_…filled.png` | Start Session step 1 empty and filled (LP/2026/1006-0014) |
| `26_start_session_step2_gate.png` | Core gate: All checks passed, 8 of 8 |
| `27_start_session_step3_ready.png`, `28_countdown_00/01.png` | Ready; Start Recording pressed |
| `29_live_monitor_a.png`, `29b_live_monitor_b.png` | "Starting…" then the monitor (Resynced banner, 00:00:05) |
| `30_monitor_timer_00…02.png` | Monitor 00:00:43 with meters −15 / −52 dBFS |
| `31_monitor_bookmark_sheet.png`, `31b_…typed.png`, `32_monitor_marker_added.png` | Bookmark sheet, label typed, marker added |
| `33_back_guard_dialog.png` | Back-guard dialog |
| `34_home_while_recording.png`, `35_return_to_live_monitor.png` | During ENV-2: still the monitor after Go to Home |
| `36a_back_guard_again.png`, `36_go_home_00…04.png`, `36b_after_go_home_settled.png` | Second Go to Home during ENV-2 (link-lost banner, Resynced), Home 30 s later |
| `37a_…`, `37b_…`, `38_home_timer_check_00…02.png`, `39_core_offline_check.png` | ENV-2: stale timers, "Core Offline", recovery to Core Live |
| `40_home_recording_logbox_dismissed.png` | Home while recording after closing the dev LogBox notices |
| `41_relaunch_after_forcestop.png`, `42_after_resignin_route_sync.png`, `43_monitor_resumed_after_relaunch.png` | Force-stop + relaunch: Login, sign-in, monitor resumed (00:09:36) |
| `44_recovery_deeplink_while_recording.png`, `45_…` | Recovery: "This session is not interrupted"; back to the session |
| `46_end_session_dialog.png`, `46b_…typed.png` | End Session dialog, reason typed |
| `47_finalizing_00…05.png` | Finalizing evidence 0 % -> 50 %, EV-20261006-0018 |
| `48_summary.png`, `49_after_summary_done.png` | Session Summary SEALED; View in Evidence EV-0018 |
| `50_home_after_part_a.png` | Home after Part A |
| `51_sc3_web_step1_filled.png`, `52_sc3_web_step2_gate.png`, `53_sc3_web_step3_ready.png` | w1 Session New (SES-0031) |
| `52p_sc3_phone_after_web_create.png` | Phone Home "Continue setup" after the web's create |
| `54_sc3_s1_phone_00…13.png`, `55_sc3_s1_web_after_start.png` | B1 run 1: phone frames; w1 Session Monitor RECORDING |
| `56_…`, `56p_…`, `56q_…`, `57_…`, `58_…`, `58p_…` | B2 run 1: before, phone dialog, web STOPPING, web SEALED, phone summary |
| `59_…`, `59w_…`, `60_…`, `61_…`, `62_…`, `62p_…` | B3a: phone wizard start, web Dashboard recording |
| `63_…`, `64_…`, `64p_…`, `65_sc3_s3_phone_transition_frames_f27_f42.png`, `66_…`, `66b_…` | B3b: web stop, phone transition frames (E2E-P-4), phone summary |
| `67_…`, `68_…`, `68p_…`, `69_sc3_s1b_phone_transition_frames_f1_f11.png` | B1 run 2: web Ready, web RECORDING, phone frames (0.81 s) |
| `70_…`, `71_…`, `71b_…`, `72_…`, `72b_…` | B2 run 2 |
| `73_…`, `74_…`, `75_…`, `76_…` | SC4 before; role dialog to Technician |
| `77_sc4_w2_after_change_locked.png`, `77b_…`, `78_…`, `79_…`, `79b_…` | C1: w2 locked + toast; w1 toast; phone frames toast and Restart |
| `80_…`, `81_…`, `81b_…`, `82_…`, `83_sc4_phone_create_refused.png`, `84_…`, `87_…`, `88_…` | C2 / E2E-P-5: phone as TECHNICIAN, wizard, 403 shown, draft discarded (no Core call) |
| `85_…`, `85w_…`, `89_…` | phone wizard still open; w2 as TECHNICIAN; phone Camera 1 as TECHNICIAN (Restart enabled) |
| `86_…`, `90_sc4_w2_after_back_unlocked.png`, `90b_…`, `91_…`, `92_…` | C3: back to Investigator |
| `90a_defect_e2e_p1_bottom_nav_crops.png` | E2E-P-1 crops of the bottom bar |
| `93_…`, `94_…` | C4 repeat-cycle phone frames |
| `95_…`, `96_…`, `97_sign_out_step.png`, `98_end_state_login_live_signed_out.png` | End of SC4; More (Investigator); sign out; Login |
| `99a_…` to `99j_end_state_login_live_signed_out.png` | Re-test of Go to Home at low load (`99f` frames), stop, summary SES-0034, final Login (end state) |
| `w1_dashboard_supervisor_probe.png`, `w1_expired_probe.png`, `w1_probe_session_new_step1.png` | w1 dashboard as SUPERVISOR; w1 after idle expiry; Session New step 1 |
| `*.mp4` | `screenrecord --bugreport` clips used for the phone timings |

Text assets: `core_log_lane1_e2e_p.log` (lane-1 server log 09:45–10:53, reduced to method, route, status, principal), `q/` (every batch and its output, `events.log`), `w1_network.log`, `w2_network.log`, `driver_console.log`, `e2e_q.mts.txt`, `send.mjs.txt`, `raw2png.py.txt`, `scan.mts.txt`.

---
*Generated: 2026-10-06 10:58 +07:00*
