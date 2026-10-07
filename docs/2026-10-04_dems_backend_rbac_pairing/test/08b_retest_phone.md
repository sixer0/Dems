---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: R-P (re-test after E-fix, D201-D208)
agent: verifier
date: 2026-10-06
narrative_tier: 2
status: needs-review
verdict: FAIL on E2E-P-4 (the app's React instance was destroyed on a web stop, 1 of 2 runs); 7 of 8 targeted items PASS; smoke walk 26/26
assets: test/assets/retest/p_phone/
before: test/07c_e2e_phone_lane1.md and test/assets/e2e/p_phone/
---

# R-P: phone re-test after E-fix (emulator-5554, lane 1)

## 1. Environment

| Item | Value | Evidence |
|---|---|---|
| Phone | AVD `dems2_phone`, adb serial `emulator-5554`, 1080 x 2424; app `com.dems.demo.tablet` (debug build, JavaScript from Metro) | `adb devices -l`, `wm size` (12:41) |
| Device state | `isKeyguardShowing=false` at the start, at every batch (driver check) and at the end (13:26:48); DEMS app focused | `q/001.out`, `q/059.out` |
| adb reverse (never changed) | `tcp:8081 -> tcp:8081`, `tcp:4420 -> tcp:4421`, the same at 12:41 and at 13:27 | `adb reverse --list` |
| Core | lane 1 `http://127.0.0.1:4421`, `dems-core-server 0.2.0`, api v1, database and engine ready, uptime 1767 s at 12:41 (the 12:14 restart with FX-C's engine) | `GET /api/v1/health` (12:41:35, 12:57:54) |
| Web console | `http://127.0.0.1:5176`, `data-core-mode="LIVE"` on Login | `q/004.out` |
| Fresh JS bundle | `am force-stop` then `am start -a android.intent.action.VIEW -d 'demsdemo:///login?core=LIVE&motion=off'` at 12:44:37; the start returned after 12.4 s (full bundle load); device log "Live source ready" 12:44:51.3 | `q/001.out` |
| Browser | Playwright cache `chromium_headless_shell-1243` (HeadlessChrome/153.0.8010.12), one profile (w1) in `$TMPDIR`, `--remote-debugging-port=0`; port read from the profile's `DevToolsActivePort` (53253), `lsof` showed the listener belongs to the spawned pid 60346; `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1`; closed and the profile removed at 13:26:50 | `q/004.out`, `rt_q.mts.txt` (`openCtx`) |
| Operators | phone: budi.santoso (INVESTIGATOR), rina.wijaya (TECHNICIAN), andi.pratama (SUPERVISOR); web w1: andi.pratama | `GET /api/v1/admin/users` (12:46:20, 13:26:47) |
| Driver | `rt_q.mts.txt` = the round-1 queue driver `e2e_q.mts.txt` with five changes (header of the file): on-device PNG written to `/sdcard` and pulled; OS-assigned DevTools port with an ownership check; `username <operator>`; a `uiautomator dump` needs a screen declared in the same batch; `warnlog` (W/E-level `ReactNativeJS` lines). Batches `q/NNN.cmd` -> `q/NNN.out` (59 batches), trail `q/events.log` | `q/` |
| Timing method | Core times from `.cache/manual/lane1-server.log` (host clock). Phone times from `screenrecord --bugreport` (device time on every frame; a frame is written only when the screen changes), converted with the measured offset device = host - 318 to 336 ms (`p clock`, 5 bracketed reads before each timed step) | `q/033.out`, `q/042.out`, `q/044.out`, `q/046.out`, `q/051.out` |
| Window | 12:44 to 13:27 (+07:00) | `core_log_lane1_retest_p.log` |
| Host load | 1-minute 3.4 to 8.8 (checked before every heavy step); never above 14 | `uptime` |

## 2. Summary

| Part | Result | Detail |
|---|---|---|
| Part 1, targeted | **7 / 8 PASS, 1 FAIL** | PASS: E2E-P-1, E2E-P-2, E2E-P-3, custody (E2E-W1-1 / E2E-T-3), E2E-P-5 + O-2 with the live role change, F80, sign-out lands on Login. **FAIL: E2E-P-4** — run 1: the phone never reached Finalizing; it showed a false "Core link lost" banner, then a blank frame, then a native RedBox `addViewAt: failed to insert view [22216] into parent [20378] at index 1`, and the device log shows the React instance destroyed (black screen after Dismiss; relaunch and sign-in needed). Run 2: monitor -> Finalizing directly, no blank frame, 0.55 s after the Core's 202 |
| Part 2, smoke walk | **26 / 26 screens reached in LIVE**, every server value checked matched the Core | cross-check on two screens: storage 20 % (Home, More, Storage) and audit 452 entries / head `120336bf` (More, Audit) |
| F80 toast | **0** captures of 128 phone captures, **0** of 1,119 recorded frames | device JS log: 2 W-level lines (Reanimated reduced-motion override at each launch, kept out of LogBox by design), 0 E-level lines. The RedBox of R-P-1 is a native exception, not the F80 toast |
| New defects | 3 | R-P-1 High (crash on a web stop), R-P-2 Medium (false link-lost banner and timer running backwards at the monitor hand-off, 1 of 2 starts), R-P-3 Low (Settings > Device Settings stacks the Devices list over an open device detail) |
| End state | met | phone LIVE, signed out, Login ("You have been signed out.", Core online, paired as DEV-0001) `113_end_state_login_live_signed_out.png`; budi.santoso INVESTIGATOR (13:26:47); `GET /session/current` null (nothing recording); browser closed, profile removed; `/sdcard` has no file of this row |

## 3. Part 1 — targeted re-tests

Before = round-1 file under `test/assets/e2e/` (or the file named); After = file under `test/assets/retest/p_phone/`. Log lines = `core_log_lane1_retest_p.log` (method, route, status).

| Item | Before (round-1 file) | After (new file) | Observed (timestamps) | Result | Log / audit line |
|---|---|---|---|---|---|
| **E2E-P-1** bottom-tab highlight | `p_phone/90a_defect_e2e_p1_bottom_nav_crops.png`, `p_phone/08_evidence_list.png` | `22_p1_after_bottom_nav_crops_all_reps.png`, `p1_nav_metrics.txt`, captures `10_` to `21_` | Sessions > INCOMPLETE row SES-20261006-0029 (session detail) > Evidence tab > Devices tab, 3 repetitions (12:47:02, 12:48:15, 12:48:44; motion=off), each tab captured 1.2 s and 3 s after the tap, plus Sessions again and More: **18 / 18 captures** have the gold icon, gold label, pill fill and pill border on the active tab and on no other tab. The same pixel metric run on the round-1 pictures reports the round-1 failure (Evidence: icon and pill on Sessions, label on Evidence; Devices and More: Sessions icon still gold) | **PASS** | `POST /api/v1/auth/touch 200` (12:48:32) only; tab switches send nothing |
| **E2E-P-2** proof / source text | `p_phone/22_stack_check.png` ("wired to the local mock-core over adb reverse") | `47_stack_check_p2.png`, `47c_stack_check_p2_scrolled.png` | About DEMS > Stack diagnostics, 12:57:34: "Data source: Live. Data, Heartbeat and Service come from the Core server over adb reverse."; Service "core-server v0.2.0 · api v1"; heartbeat 2723 -> 2743 in 19.6 s (health uptime 2746 s at 12:57:54); no "mock-core" on the screen | **PASS** | `GET /api/v1/health 200` 12:57:30.747, 12:57:40.852, 12:57:50.899 |
| **E2E-P-3** Home timer = Recording bar | `p_phone/36b_after_go_home_settled.png` (00:04:32 vs 00:04:31), `p_phone/99f_retest_go_home_frames.png` | `58_p3_after_home_timer_vs_bar_captures.png`, `59_p3_after_home_timer_vs_bar_every_frame.png`, `p3_home_bar.mp4` | Home during SES-20261006-0035: **8 / 8 captures** 13:01:29.6-13:01:33.8 equal (00:01:53 ... 00:01:57; Core elapsed at the first = 113.5 s); screen recording device 13:01:33.822-13:01:43.827: **28 / 28 frames** equal (00:01:57 ... 00:02:07) | **PASS** | `POST /api/v1/session/:id/start 200` 12:59:36.092 |
| **E2E-P-4** web stop -> phone Finalizing, no blank frame | `p_phone/65_sc3_s3_phone_transition_frames_f27_f42.png` (1.2 s blank) | run 1: `65_p4_after_phone_frames_f58_f163.png`, `p4_web_stop.mp4`, `64_p4_phone_after_web_stop.png`, `66_p4_after_redbox_dismiss.png`, `68_p4_device_log_app_process_1303_1304.txt`; run 2: `81_p4b_after_phone_frames_f25_f59.png`, `p4b_web_stop.mp4` | **Run 1** (SES-0035, offset -326 ms): w1 confirm 13:03:57.636, Core 202 13:03:57.649, web STOPPING +83 ms, web SEALED 13:04:04.425 (EV-20261006-0023). Phone (host time): still "Recording 00:04:22" at 13:04:00.30; 13:04:00.36 banner "Core link lost — recording continues on the Core. Reconnecting…", timer back to 00:04:12, End Session disabled; 13:04:02.17 "Resynced", still Recording 00:04:15; last monitor frame 13:04:03.84; blank 13:04:03.98; device log 13:04:03.495 `IllegalStateException: Tried to remove view [21688] of parent [20372] at index 0`, 13:04:03.662 `addViewAt: failed to insert view [22216] into parent [20378] at index 1`, 13:04:03.762 `ReactHost.handleHostException` -> `getOrCreateDestroyTask` -> "reactInstance is null. Dropping work."; RedBox from 13:04:04.86; Dismiss (13:06:53) -> black screen. Finalizing and Summary never drawn. **Run 2** (SES-0036, offset -335 ms): confirm 13:14:18.403, Core 202 13:14:18.412; last monitor frame 13:14:18.742, next frame 13:14:18.960 = Finalizing card "Ending recording and closing tracks…" fully drawn (**+0.55 s, no frame between**); "Evidence sealed EV-20261006-0024" 13:14:25.447 (web 13:14:24.994); Summary 13:14:26.217 | **FAIL** (1 of 2 runs crashed; R-P-1) | `POST /api/v1/session/:id/stop 202` 13:03:57.649 and 13:14:18.412; `[socket closed]` 13:04:15.554 (the phone's operator socket, code 1001 — 18 s after the stop, 12 s after the crash; no socket event between the stop and the crash); audit `RECORDING_STOPPED` #478 |
| **Custody** (E2E-W1-1 / E2E-T-3) | `w1_supervisor/69_evidence_detail_chain_of_custody.png` (lane 3, stop attributed to the creator); lane-1 items EV-0019/0020/0021 by the old rule (`gateway_check/11a_efix_core.md` §5) | `73_custody_phone_ev0023_integrity_custody.png`, `67_custody_web_ev0023_integrity_tab.png`, `67b_custody_web_ev0023_crop.png` | SES-20261006-0035 started on the phone by budi.santoso, stopped on the web by andi.pratama. EV-20261006-0023 chain of custody — **phone** (13:11:34, `evidence-custody-1/2`): "Recording stopped, 6 Oct 2026 13:03:57 · AKP Andi Pratama · RP web stop by supervisor", "Recording started, 6 Oct 2026 12:59:36 · AKP Budi Santoso"; **web** (13:07:51): `RECORDING_STOPPED` AKP Andi Pratama, `RECORDING_STARTED` AKP Budi Santoso; **Core record** `custody`: STARTED OPR-001 05:59:36.081Z, STOPPED OPR-002 06:03:57.642Z | **PASS** | audit #455 `RECORDING_STARTED` OPR-001 12:59:36.081; #478 `RECORDING_STOPPED` OPR-002 13:03:57.642 {"reason":"RP web stop by supervisor","durationMs":261561}; #479 `EVIDENCE_SEALED` 13:04:04.258 manifest `e52f31f5…` |
| **E2E-P-5 + O-2** (ruling R2), TECHNICIAN | `p_phone/81_sc4_phone_start_session_as_technician.png`, `p_phone/83_sc4_phone_create_refused.png` | `98_p5_rina_home_start_locked.png`, `98b_…`, `99_p5_rina_sessions_hub_start_locked.png`, `101_p5_deeplink_session_new_frames_one_toast.png`, `p5_deeplink.mp4`, `100_…`, `103_p5_rina_home_continue_setup_locked.png`, `103b_…`, `104_p5_rina_sessions_hub_continue_setup_locked.png` | rina.wijaya: Home "Start Session" dimmed + "Requires the Investigator role"; a press opens nothing (13:20:27). Sessions hub `sessions-start-locked` "Requires the Investigator role"; a press keeps `screen-sessions`. Warm link `demsdemo:///session/new` (13:20:51.8): toast "Not permitted · Requires the Investigator role" from 13:20:53.16 to between 13:20:55.43 and 13:20:56.36, **one toast** in 35 frames, no wizard frame, ends on Home; one `info` record `features.sessionNew.entryRefused` "Start Session refused: the role lacks SESSION_START". With a setup session created on the web by andi (SES-20261006-0037, ARMED): Home "Continue setup" and hub "Continue session setup" disabled with the same hint; then cancelled on the web | **PASS** | deep link: no request; `POST /api/v1/session 201` 13:21:56.837 and `POST /api/v1/session/:id/cancel 204` 13:22:40.380 (web) |
| O-2 Install update | `p_phone/20_settings_maintenance.png`; tablet `t_tablet/18g_settings_system_maintenance.png` | `40_settings_maintenance_budi_investigator.png`, `111_o2_andi_supervisor_maintenance_install_locked.png`, `106_o2_rina_maintenance_install_enabled.png` | INVESTIGATOR budi: Install update disabled, `settings-update-install-locked` "Requires the Technician role" (12:54:17); SUPERVISOR andi: disabled, same hint (13:24:44); TECHNICIAN rina: enabled, no hint (13:22:59; not pressed, D197 rule) | **PASS** | none |
| Live role change (budi signed in on the phone) | `p_phone/79_sc4_phone_frames_restart_control.png`, `p_phone/92_sc4_phone_frames_back_f1_f4.png` (O-1 1.25 s) | `87_role_to_technician_phone_frames_f2_f6.png`, `role_to_tech.mp4`, `85_…`, `88_role_phone_sessions_hub_technician_locked.png`; `92_role_back_to_investigator_phone_frames_f2_f6.png`, `role_back_inv.mp4`, `90_…`, `93_…` | To TECHNICIAN: Core 200 13:16:30.448; phone toast 13:16:30.676 (**+0.23 s**); Start Session disabled + hint 13:16:30.763 (**+0.32 s**); hub locked (13:17:26). Back to INVESTIGATOR: Core 200 13:17:43.842; toast 13:17:44.086 (+0.24 s); Start Session enabled, hint gone 13:17:44.145 (**+0.30 s**); hub "Start New Session" unlocked (13:18:34). No sign-in between 13:10:38 and 13:19:51 (server log). budi INVESTIGATOR at 13:17:55 and 13:26:47 | **PASS** | `POST /api/v1/admin/users/:id/role 200` 13:16:30.448, 13:17:43.842; `ROLE_CHANGED` #507 OPR-002 "INVESTIGATOR to TECHNICIAN", #508 OPR-002 "TECHNICIAN to INVESTIGATOR" |
| **F80** warnings toast | D196, D199; `p_phone/39_core_offline_check.png` (LogBox toasts) | `f80_capture_scan.txt`, `f80.py.txt` | 128 phone captures and 1,119 recorded frames scanned with a detector that flags the round-1 toast pictures: **0** with the toast; every capture was also looked at. Device JS log 12:44:31-13:25:18: W-level 2 lines, both `[Reanimated] Reduced motion setting is overwritten with mode 'always'` at the two launches (12:44:50.079, 13:10:04.816; LogBox-ignored, `11c` §6 #5); E-level 0 | **PASS** (toast); see R-P-1 for the RedBox | — |
| **E2E-S-1 part 2** sign-out lands on Login | `s_pairing/07_phone_signed_out_login.png` (paired Pair view) | `95_e2e_s1_after_sign_out_budi.png`, `107_e2e_s1_after_sign_out_rina.png`, `112_e2e_s1_after_sign_out_andi_end_state.png` | three sign-outs from More (13:18:42 budi, 13:23:19 rina, 13:24:53 andi): each lands on Login with "You have been signed out.", Core online, paired as DEV-0001 | **PASS** (3 / 3) | `POST /api/v1/auth/sign-out 204` 13:18:44.415, 13:23:22.219, 13:24:56.809 |

## 4. Part 2 — smoke walk (budi.santoso, LIVE)

| Screen | Result | Capture | Value check (screen = Core) |
|---|---|---|---|
| Login | PASS | `01_login_live_after_relaunch.png` | "Core online · paired as DEV-0001" = `GET /api/v1/pairing/device 200` and `GET /auth/status 200` from the phone at 12:44:50 |
| Home | PASS | `04_home.png` | Storage 20 % = `GET /storage/status` usedPercent 20; Recent "EV-20261006-0022 Today 10:51" = history[0] evidenceId, endedAt 10:51:21 |
| Sessions hub | PASS | `05_sessions_hub.png`, `05b_sessions_filter_incomplete.png` | SES-0034 00:01:50, SES-0033 00:01:11, SES-0032 00:00:34 = `GET /session/history` durationMs 110184, 71493, 34737 |
| Session detail | PASS | `10_p1_r1_a_session_detail.png` | SES-20261006-0029 INCOMPLETE, 01:53:38 – 01:53:56, LP/2026/1006-0013, power failure, EV-0017 (same values as the round-1 API read, 07c §3 #5) |
| Evidence list | PASS | `23_evidence_list.png` | EV-0022 Sealed 00:01:50; EV-0017 Recorded = `GET /evidence/EV-20261006-0022` status SEALED, durationMs 110184 |
| Evidence detail — Media | PASS | `24_evidence_detail_media.png`, `24b_…` | 00:01:50, 251.0 MB = durationMs 110184, sizeBytes 250974667; "No DEMO media for this item" = media.source NONE |
| Evidence detail — Metadata | PASS | `25_evidence_detail_metadata.png`, `25b_…` | "CORE RECORD" JSON of the Core item (E2E-T-6 fix visible on the phone) |
| Evidence detail — Hash & Integrity | PASS | `26_…`, `26b_…`, `26c_…`, `26d_evidence_detail_integrity_custody_list.png` | Camera 1 SHA-256 `e2d60cd8…095830`, manifest `5e88d79f…3da474`, signature `c672cf96…`, custody 3 rows (started/stopped AKP Budi Santoso, sealed System) = `GET /evidence/EV-20261006-0022` |
| Devices list | PASS | `27_devices_list.png` | Cameras and mics Online, PoE "1 active · 1 spare", Tablet Connected = `GET /device/inventory` (POE_CAM_2_AUX spare, tabletLink CONNECTED) |
| Device detail (Camera 1) | PASS | `28_device_detail_cam01.png`, `28b_…` | CAM-01, DL-2 (lens 1), firmware 3.8.14, PoE CAM 1, 1080p · 25 fps · H.264, 9 Mbps = inventory cameras[0]; Restart disabled "Requires the Technician role" |
| More | PASS | `29_more.png` | "AKP Budi Santoso · Investigator · OPR-001"; "Audit, 452 events" = `GET /audit` total 452; Storage 20 % |
| Storage | PASS | `30_storage.png` | 807 GB used, 3.2 TB free of 4.0 TB, 20 % = usedBytes 807065137224, freeBytes 3192934862776 |
| Network & Time | PASS | `31_network_time.png` | GNSS active, server 192.168.10.1 = `GET /time/status` source GNSS locked, ntp.server 192.168.10.1 |
| Audit | PASS | `32_audit.png` | HEAD `120336bf`, 452 entries, Chain OK; newest row "Sign-in succeeded · AKP Andi Pratama" 12:46:17 = `GET /audit/chain` head `120336bf8c04…`, ok, 452 |
| Settings | PASS | `33_settings.png` | account row "Investigator, AKP Budi Santoso" |
| Settings > App Preferences | PASS | `34_settings_preferences.png`, `34b_…` | Core link source "Live" |
| Settings > Notifications | PASS | `35_settings_notifications.png` | device-local toggles (no Core value) |
| Settings > Security & Privacy | PASS | `36_settings_security.png`, `36b_…` | Biometric sign-in off; Core pairing "Paired" |
| Settings > Device Settings | PASS (R-P-3) | `37_settings_device_settings.png`, `44_…`, `44b_…`, `44c_…`, `45_…`, `45b_repro_back_1.png` | opens Devices & Inputs (same values as `27_`) |
| Settings > Storage Management | PASS | `42_settings_storage_management_row.png`, `42b_after_back_from_storage_management.png` | opens Storage (807 GB, 20 %); Back returns to Settings |
| Settings > Network & Time | PASS | `43_settings_network_time_row.png` | opens Network & Time; Back returns to Settings |
| Settings > System Maintenance | PASS | `40_settings_maintenance_budi_investigator.png`, `40b_…` | "v2.5.0 available" = `GET /system/status` (round-1 read); Install update locked for INVESTIGATOR (O-2) |
| Settings > About DEMS | PASS | `46_settings_about.png`, `46b_…` | v2.4.1, DEMS-IR-01, DEC-2026-IR01-000117, PRV-2026-0117 = inventory device.identity |
| Stack Check | PASS | `47_stack_check_p2.png`, `47b_…`, `47c_…` | core-server v0.2.0 · api v1 = health version 0.2.0 (E2E-P-2) |
| Start Session step 1 | PASS | `49_start_session_step1.png` | empty form, investigator "AKP Budi Santoso" (this row then continued for Part 1: `50_` to `52_`) |
| Sign out | PASS | `94_more_before_sign_out.png`, `95_e2e_s1_after_sign_out_budi.png` | More "Investigator"; Login after `POST /auth/sign-out 204` |

**Cross-check of one server value on two screens:** storage `usedPercent 20` (`GET /api/v1/storage/status`, 12:46:20) shows as 20 % on Home (`04_home.png`), on the More Storage tile (`29_more.png`) and on Storage (`30_storage.png`); audit `total 452`, head `120336bf…` (`GET /api/v1/audit` 12:51:55, `/audit/chain` 12:52:28) shows as "Audit, 452 events" on More and "HEAD 120336bf · 452 entries" on Audit.

## 5. Defects (new in this round)

| ID | Severity | Where | Repro | Expected | Observed | Evidence |
|---|---|---|---|---|---|---|
| **R-P-1** | **High** (app's React instance destroyed; D191's "black screen" symptom) | phone Live monitor, stop made on the web | budi starts a session on the phone (wizard), stays on the monitor; andi presses End Session on the web Session Monitor | the monitor hands over to Finalizing (the FX-M2 hand-over) | run 1 (13:03:57): 2.7 s after the Core's 202 the monitor shows "Core link lost — recording continues on the Core. Reconnecting…" with the timer back from 00:04:22 to 00:04:12 and End Session disabled, then "Resynced" (still Recording), then a blank frame, then a native RedBox `addViewAt: failed to insert view [22216] into parent [20378] at index 1` (`IllegalStateException`, `SurfaceMountingManager.addViewAt:389`, preceded by `Tried to remove view [21688] of parent [20372] at index 0, but got view tag 19014`); `ReactHost.handleHostException` destroys the React instance ("reactInstance is null. Dropping work."); Dismiss leaves a black screen; the phone's socket closes 12 s later; relaunch + sign-in route to the Summary. Run 2 (13:14:18) handed over correctly. Ancestors of the failing parent are `react-native-screens` `ScreenContentWrapper` / `Screen` / `ScreenStack`, and Reanimated `NativeProxy.performOperations` is in the mount stack. **Hypothesis (unproven):** the in-place Finalizing render plus `<Redirect>` of `app/(app)/session/live.tsx:16-27` (FX-M2) meets a Reanimated layout animation of the link banner in the same screen; a debug build shows a RedBox, a release build would likely lose the UI in the same way. 1 of 2 runs | `65_p4_after_phone_frames_f58_f163.png`, `p4_web_stop.mp4`, `64_p4_phone_after_web_stop.png`, `66_p4_after_redbox_dismiss.png`, `66b_…`, `68_p4_device_log_app_process_1303_1304.txt`, `69_…` to `71_…`, server log 13:03:57.649 / 13:04:15.554 |
| **R-P-2** | Medium (needs-review; intermittent) | phone Live monitor, hand-off after Start Recording | start a recording from the phone wizard; watch the monitor for 20 s | timer increases with the Core's elapsed time; no link notice while the socket is up | run 1 (SES-0035, start 12:59:36): at 12:59:41.8 "Core link lost — recording continues on the Core. Reconnecting…" (End Session disabled), "Resynced" at 12:59:46.5; the monitor timer read 00:00:12, 13, **04**, 07, 08, 20 in captures 12:59:51.7-12:59:56.9 (Core elapsed 15.6-20.8 s); the back-guard dialog appeared 5-9 s after Back. The Core logged no socket close or open in that window. Run 2 (SES-0036): 799 frames over 20 s, no notice, timer monotonic and within 1 s of the Core. The same false notice preceded R-P-1. Round-1 family: O-4 ("Resynced" at the hand-off); `11c` C-4 hypothesis (link marked STALE before queued messages run) | `53_live_monitor.png`, `54_back_guard_dialog.png`, `55_p3_home_recording_00…05.png`, `56b_run1_start_handoff_monitor_timer_crops.png`, `82_repeat_start_handoff_frames_top.png`, `p4b_start_handoff.mp4` |
| **R-P-3** | Low (navigation) | Settings > Device Settings | open Camera 1 detail in the Devices tab; More > Settings > Device Settings; press Back | Back returns to Settings | Device Settings shows the Devices list; Back shows the Camera 1 detail left in the Devices stack, a second Back the Devices list, a third Back Settings. Without a detail in the Devices stack one Back returns to Settings. The row's target is `href: '/devices'` (`apps/mobile/src/features/settings/settings-model.ts:46`), so the list is pushed onto that tab's stack (inference from the observed stack, not traced) | `37_…`, `38_settings_storage_management.png` and `39_settings_network_time.png` (what Back showed, see the index), `44_…`, `44b_…`, `44c_…`, `45_repro_device_settings_with_cam_detail_in_stack.png`, `45b_repro_back_1.png`, `q/020.out`, `q/022.out`, `q/023.out` |

Observations (not defects):

| ID | Note | Evidence |
|---|---|---|
| O-1 | Deep link `/session/new` as TECHNICIAN: Home is drawn dark for about 0.2 s under the toast (frames device 13:20:53.003-53.214) and fades back; it ends on Home with one toast | `101_p5_deeplink_session_new_frames_one_toast.png` |
| O-2 | The Hash & Integrity card is titled "Verified by the Core" with "Not verified on this screen yet" while the Core reports `verification.status NOT_RUN` for EV-0022 (copy reads as a verdict) | `26b_evidence_detail_integrity_scrolled.png`, `q/012.out` |
| ENV-1 | w1 (andi) was signed out by the Core after 15 min without a touch (`[socket closed]` code 4401 at 13:01:17, then `GET /auth/session 401`); signed in again at 13:03:33. Expected behaviour (07c ENV-4) | `61a_web_after_idle_expiry.png`, `q/031.out`, `q/032.out` |
| ENV-2 | After the crash the app was restored with the brief's own launch command (force-stop + `/login?core=LIVE&motion=off`) and a password sign-in; the route sync opened the pending Summary of SES-0035 (sealed 13:04:04, 00:04:21, 595.8 MB = Core) | `69_…`, `70_…`, `71_summary_ses0035_after_relaunch.png` |

## 6. Pending — biometric sign-in (the user's touch)

Not run by me. The screen where it happens was reached four times: after each password sign-in the app shows **"Enable biometric sign-in on this tablet? — Enable / Not now"** (`03_after_signin_biometric_offer.png` budi, `70_after_resignin_route.png` budi over the Summary, `97_rina_after_signin.png`, `109_andi_after_signin.png`); I pressed "Not now" each time. The touch point: tap **Enable**, then touch the sensor in the Android system prompt (emulator Extended controls > Fingerprint, or the user's own command). The Login fingerprint button is inactive now with "Sign in with your password once to enable biometric sign-in on this tablet." (`113_end_state_login_live_signed_out.png`). Settings > Security & Privacy "Biometric sign-in" is off (`36_settings_security.png`).

## 7. Process notes and deviations

| ID | Note |
|---|---|
| PD-1 | Before the run (12:43) a `grep` for the line number of the dataset's password constant printed the demo password into my own tool output once. No file holds it (scan in §8). |
| PD-2 | Batch 028 declared "home" while the monitor with the late back-guard dialog was showing (my "Go to Home" tap landed before the dialog appeared). Only screencaps ran in that batch, no `uiautomator dump`. The files `55_p3_home_recording_00…05.png` therefore show the monitor, and `38_settings_storage_management.png` / `39_settings_network_time.png` show what Back produced (R-P-3); the files were kept and the index says what each one shows. |
| PD-3 | Added beyond the brief: a second phone session SES-20261006-0036 to test E2E-P-4 again, a setup session SES-20261006-0037 created and cancelled on the web to test "Continue setup", and the app relaunch after the crash. |
| PD-4 | One `uiautomator dump` failed on Stack Check (animated screen); nothing changed on the device. |

Lane-1 records created by this row: SES-20261006-0035 (EV-20261006-0023, SEALED, summary acknowledged 13:11:17), SES-20261006-0036 (EV-20261006-0024, SEALED, summary acknowledged 13:16:03), SES-20261006-0037 (cancelled 13:22:40), `ROLE_CHANGED` #507 and #508, sign-ins/outs of the three operators. Audit chain at the end: view ok, stored ok, 517 rows (13:26:47).

## 8. Secret handling

The password was read inside the driver from the shared dataset constant and never printed by the driver; on the phone it was typed only after the IME reported a password editor (`inputType 0x80081`) and no screencap ran until the sign-in answered 200 (`q/003`, `q/038`, `q/049`, `q/056`). Scan (`scan.mts.txt`, counts only, 13:34) of the 137 text files under `test/assets/retest/p_phone/` plus this report and `delegation_progress/retest_p_phone.md`: **demo password 0, `dvc_`/`ses_`/`bio_` token shapes 0**; six digits in two groups of three with a space or hyphen: 25 — 23 screen coordinates in the driver's own `p tap` / `p swipe` lines (`q/006.cmd` … `q/050.cmd`) and the 2 example lines quoted in this sentence (`p tap 470 662`, `p swipe 540 1900 540 900 600`); no pairing code was issued or shown in this row. The device log excerpt and the server-log extract hold no principal tokens. PD-1 (the agent's own tool output, no file) is the only exposure.

## 9. Screenshot index

Phone captures are 1080 x 2424 on-device PNG (`screencap -p` to `/sdcard`, pulled, deleted); web screenshots 1440 x 900; sheets are built from these captures or from recorded frames. All files are in `test/assets/retest/p_phone/`.

| File | Caption |
|---|---|
| `00_before_relaunch.png` | Phone before the relaunch: LIVE Login, Core online, paired as DEV-0001 |
| `01_login_live_after_relaunch.png` | Login after force-stop and relaunch with the full new bundle |
| `02_login_username_typed_budi.png` | Username budi.santoso typed, password empty |
| `03_after_signin_biometric_offer.png` | Home with the biometric offer after budi's sign-in (biometric point) |
| `04_home.png` | Home LIVE: Ready for Recording, 2/2, 2/2, 20 %, Recent EV-0022 |
| `05_sessions_hub.png` | Sessions hub from the Core history |
| `05b_sessions_filter_incomplete.png` | Sessions hub filtered to Incomplete |
| `10_p1_r1_a_session_detail.png` | E2E-P-1 rep 1: session detail SES-0029, Sessions highlighted |
| `11_p1_r1_b_evidence_t1.png` | E2E-P-1 rep 1: Evidence tab 1.2 s after the tap |
| `11_p1_r1_b_evidence_t3.png` | E2E-P-1 rep 1: Evidence tab 3 s after the tap |
| `12_p1_r1_c_devices_t1.png` | E2E-P-1 rep 1: Devices tab 1.2 s after the tap |
| `12_p1_r1_c_devices_t3.png` | E2E-P-1 rep 1: Devices tab 3 s after the tap |
| `13_p1_r2_0_sessions_tab_again.png` | E2E-P-1 rep 2: Sessions tab again (detail kept in its stack) |
| `14_p1_r2_a_session_detail.png` | E2E-P-1 rep 2: session detail re-opened |
| `15_p1_r2_b_evidence_t1.png` | E2E-P-1 rep 2: Evidence 1.2 s |
| `15_p1_r2_b_evidence_t3.png` | E2E-P-1 rep 2: Evidence 3 s |
| `16_p1_r2_c_devices_t1.png` | E2E-P-1 rep 2: Devices 1.2 s |
| `16_p1_r2_c_devices_t3.png` | E2E-P-1 rep 2: Devices 3 s |
| `17_p1_r3_0_sessions_tab_again.png` | E2E-P-1 rep 3: Sessions tab again |
| `18_p1_r3_a_session_detail.png` | E2E-P-1 rep 3: session detail re-opened |
| `19_p1_r3_b_evidence_t1.png` | E2E-P-1 rep 3: Evidence 1.2 s |
| `19_p1_r3_b_evidence_t3.png` | E2E-P-1 rep 3: Evidence 3 s |
| `20_p1_r3_c_devices_t1.png` | E2E-P-1 rep 3: Devices 1.2 s |
| `20_p1_r3_c_devices_t3.png` | E2E-P-1 rep 3: Devices 3 s |
| `21_p1_r3_d_more.png` | E2E-P-1 rep 3: More tab |
| `22_p1_after_bottom_nav_crops_all_reps.png` | E2E-P-1 after: bottom-bar crops of all 18 captures with the measured active tab |
| `23_evidence_list.png` | Evidence list |
| `24_evidence_detail_media.png` | EV-0022 detail, Media tab |
| `24b_evidence_detail_media_scrolled.png` | EV-0022 Media tab scrolled |
| `25_evidence_detail_metadata.png` | EV-0022 Metadata tab: Core record |
| `25b_evidence_detail_metadata_scrolled.png` | EV-0022 Metadata tab scrolled |
| `26_evidence_detail_integrity.png` | EV-0022 Hash & Integrity tab |
| `26b_evidence_detail_integrity_scrolled.png` | EV-0022 verify card and per-track SHA-256 |
| `26c_evidence_detail_integrity_custody.png` | EV-0022 manifest, signature, lifecycle |
| `26d_evidence_detail_integrity_custody_list.png` | EV-0022 chain of custody |
| `27_devices_list.png` | Devices & Inputs |
| `28_device_detail_cam01.png` | Camera 1 detail |
| `28b_device_detail_cam01_scrolled.png` | Camera 1 actions: Restart disabled for Investigator |
| `29_more.png` | More: operator card, Storage 20 %, Audit 452 events |
| `30_storage.png` | Storage: 807 GB used, 3.2 TB free, 20 % |
| `31_network_time.png` | Network & Time: GNSS, 192.168.10.1 |
| `32_audit.png` | Audit: HEAD 120336bf, 452 entries, Chain OK |
| `33_settings.png` | Settings list |
| `34_settings_preferences.png` | App Preferences: Core link source Live |
| `34b_settings_preferences_scrolled.png` | App Preferences scrolled |
| `35_settings_notifications.png` | Notifications |
| `36_settings_security.png` | Security & Privacy: biometric off |
| `36b_settings_security_scrolled.png` | Security & Privacy scrolled |
| `37_settings_device_settings.png` | Settings > Device Settings opened the Devices list |
| `38_settings_storage_management.png` | Not Storage Management: what Back from Device Settings showed — the Camera 1 detail left in the Devices stack (R-P-3) |
| `39_settings_network_time.png` | Not Network & Time: what the second Back showed — the Devices list (R-P-3) |
| `40_settings_maintenance_budi_investigator.png` | System Maintenance as INVESTIGATOR: Install update locked, "Requires the Technician role" |
| `40b_settings_maintenance_budi_investigator_scrolled.png` | Same, scrolled; demo controls not in role |
| `41_settings_back_from_maintenance.png` | Back to Settings |
| `42_settings_storage_management_row.png` | Settings > Storage Management opens Storage |
| `42b_after_back_from_storage_management.png` | Back returns to Settings |
| `43_settings_network_time_row.png` | Settings > Network & Time opens Network & Time |
| `44_settings_device_settings_row_repro.png` | R-P-3 control: Device Settings with no detail in the Devices stack |
| `44b_back_1_from_device_settings.png` | R-P-3 control: one Back returns to Settings |
| `44c_back_2_from_device_settings.png` | R-P-3 control: second Back reaches More |
| `45_repro_device_settings_with_cam_detail_in_stack.png` | R-P-3 repro: Device Settings with Camera 1 detail in the Devices stack |
| `45b_repro_back_1.png` | R-P-3 repro: first Back shows the Camera 1 detail |
| `46_settings_about.png` | About DEMS |
| `46b_settings_about_scrolled.png` | About DEMS scrolled: Stack diagnostics link |
| `47_stack_check_p2.png` | E2E-P-2 after: "Data source: Live … Core server", core-server v0.2.0 |
| `47b_stack_check_p2_t2.png` | Stack Check 17 s later (heartbeat advancing) |
| `47c_stack_check_p2_scrolled.png` | Stack Check after the scroll gesture |
| `48_home_before_start.png` | Home before Start Session |
| `49_start_session_step1.png` | Start Session step 1, empty (smoke) |
| `50_start_session_step1_filled.png` | Step 1 filled: LP/2026/1006-0019, Tersangka, RP Phone Start |
| `51_start_session_step2_gate.png` | Step 2: all checks passed, 8 of 8 |
| `52_start_session_step3_ready.png` | Step 3: Ready to record |
| `53_live_monitor.png` | R-P-2: monitor 00:00:05 with the false "Core link lost" notice |
| `54_back_guard_dialog.png` | Monitor "Resynced" 1.5 s after Back (dialog not yet shown) |
| `55_p3_home_recording_00.png` | R-P-2: monitor with the back-guard dialog, timer 00:00:12 (12:59:51.7) |
| `55_p3_home_recording_01.png` | R-P-2: timer 00:00:13 (12:59:52.7) |
| `55_p3_home_recording_02.png` | R-P-2: timer 00:00:04 (12:59:53.4), running backwards |
| `55_p3_home_recording_03.png` | R-P-2: timer 00:00:07 (12:59:54.5) |
| `55_p3_home_recording_04.png` | R-P-2: timer 00:00:08 (12:59:55.4) |
| `55_p3_home_recording_05.png` | R-P-2: timer 00:00:20 (12:59:56.9), caught up |
| `56_monitor_dialog_state_check.png` | Monitor 00:01:19 = Core elapsed, dialog still open |
| `56b_run1_start_handoff_monitor_timer_crops.png` | R-P-2 sheet: notice and timer values of run 1 |
| `57_p3_home_recording_00.png` | E2E-P-3: Home 00:01:53 = bar 00:01:53 |
| `57_p3_home_recording_01.png` | E2E-P-3: 00:01:54 / 00:01:54 |
| `57_p3_home_recording_02.png` | E2E-P-3: 00:01:54 / 00:01:54 |
| `57_p3_home_recording_03.png` | E2E-P-3: 00:01:55 / 00:01:55 |
| `57_p3_home_recording_04.png` | E2E-P-3: 00:01:55 / 00:01:55 |
| `57_p3_home_recording_05.png` | E2E-P-3: 00:01:56 / 00:01:56 |
| `57_p3_home_recording_06.png` | E2E-P-3: 00:01:56 / 00:01:56 |
| `57_p3_home_recording_07.png` | E2E-P-3: 00:01:57 / 00:01:57 |
| `58_p3_after_home_timer_vs_bar_captures.png` | E2E-P-3 after: Home timer vs Recording bar, 8 captures |
| `59_p3_after_home_timer_vs_bar_every_frame.png` | E2E-P-3 after: device time, Home timer, bar, 28 recorded frames |
| `60_p4_phone_monitor_before_web_stop.png` | Phone monitor before the web stop, run 1 |
| `61_p4_web_session_monitor_before_stop.png` | w1 Session Monitor RECORDING, run 1 |
| `61a_web_after_idle_expiry.png` | w1 Login after the 15-minute idle expiry (ENV-1) |
| `62_p4_web_end_dialog.png` | w1 End Session dialog, reason typed, run 1 |
| `63_p4_web_after_stop_sealed.png` | w1 Evidence sealed EV-20261006-0023 |
| `64_p4_phone_after_web_stop.png` | R-P-1: phone RedBox "addViewAt: failed to insert view" |
| `65_p4_after_phone_frames_f58_f163.png` | E2E-P-4 run 1 frames: Recording, link-lost notice, Resynced, blank, RedBox |
| `66_p4_after_redbox_dismiss.png` | R-P-1: black screen after Dismiss |
| `66b_p4_after_redbox_dismiss_t2.png` | R-P-1: still black 3 s later |
| `67_custody_web_ev0023_integrity_tab.png` | Custody on the web: EV-0023 Hash & Integrity tab |
| `67b_custody_web_ev0023_crop.png` | Custody on the web: STOPPED AKP Andi Pratama, STARTED AKP Budi Santoso |
| `69_relaunch_after_crash_login.png` | Login after force-stop and relaunch (recovery) |
| `70_after_resignin_route.png` | After sign-in: route sync to Summary SES-0035, biometric offer |
| `70b_after_resignin_route_t2.png` | Same 3 s later |
| `71_summary_ses0035_after_relaunch.png` | Summary SES-0035 SEALED, 00:04:21, 595.8 MB |
| `72_custody_phone_ev0023_detail.png` | EV-0023 evidence detail on the phone |
| `73_custody_phone_ev0023_integrity_custody.png` | Custody on the phone: stopped AKP Andi Pratama, started AKP Budi Santoso |
| `74_home_before_repeat.png` | Home before the repeat session |
| `75_repeat_step3_ready.png` | Repeat session SES-0036 Ready |
| `76_repeat_monitor_settled.png` | Repeat monitor, settled |
| `77_p4b_web_end_dialog.png` | w1 End Session dialog, run 2 |
| `78_p4b_phone_monitor_before_stop.png` | Phone monitor before the web stop, run 2 |
| `79_p4b_web_after_stop_sealed.png` | w1 Evidence sealed EV-20261006-0024 |
| `80_p4b_phone_after_web_stop.png` | Phone Summary SES-0036 after run 2 |
| `81_p4b_after_phone_frames_f25_f59.png` | E2E-P-4 run 2 frames: monitor -> Finalizing with no frame between, sealed, Summary |
| `82_repeat_start_handoff_frames_top.png` | R-P-2 control: run-2 start hand-off, timer monotonic, no notice |
| `83_home_after_summary_done_investigator.png` | Home after Done, INVESTIGATOR |
| `84_role_web_dialog_to_technician.png` | w1 Change role dialog: Technician |
| `85_role_phone_home_technician_locked.png` | Phone Home as TECHNICIAN: Start Session locked + hint |
| `86_role_web_after_change_technician.png` | w1 Users & Roles after the change |
| `87_role_to_technician_phone_frames_f2_f6.png` | Live role change to TECHNICIAN: toast +0.23 s, locked +0.32 s |
| `88_role_phone_sessions_hub_technician_locked.png` | Sessions hub locked as TECHNICIAN |
| `89_role_web_dialog_back_to_investigator.png` | w1 Change role dialog: Investigator |
| `90_role_phone_home_investigator_enabled.png` | Phone Home as INVESTIGATOR again: Start Session enabled |
| `91_role_web_after_back_investigator.png` | w1 Users & Roles after the change back |
| `92_role_back_to_investigator_phone_frames_f2_f6.png` | Change back: toast +0.24 s, enabled +0.30 s |
| `93_sessions_hub_investigator_unlocked.png` | Sessions hub unlocked as INVESTIGATOR |
| `94_more_before_sign_out.png` | More before budi's sign-out (Investigator) |
| `95_e2e_s1_after_sign_out_budi.png` | E2E-S-1: Login after budi's sign-out |
| `95b_e2e_s1_after_sign_out_budi_t2.png` | Same 2 s later |
| `96_login_username_typed_rina.png` | Username rina.wijaya typed |
| `97_rina_after_signin.png` | rina's Home with the biometric offer |
| `98_p5_rina_home_start_locked.png` | E2E-P-5: TECHNICIAN Home, Start Session locked + hint |
| `98b_p5_rina_home_after_press_locked_start.png` | E2E-P-5: after pressing the locked Start Session, still Home |
| `99_p5_rina_sessions_hub_start_locked.png` | E2E-P-5: Sessions hub locked + hint |
| `100_p5_rina_after_deeplink_session_new.png` | E2E-P-5: Home after the `/session/new` deep link |
| `101_p5_deeplink_session_new_frames_one_toast.png` | E2E-P-5: deep-link frames, one toast, no wizard |
| `102_p5_web_setup_session_created.png` | w1 setup session SES-0037 created (for Continue setup) |
| `103_p5_rina_home_continue_setup_locked.png` | E2E-P-5: Home "Continue setup" locked + hint |
| `103b_p5_rina_home_after_press_continue_setup.png` | E2E-P-5: after pressing the locked Continue setup, still Home |
| `104_p5_rina_sessions_hub_continue_setup_locked.png` | E2E-P-5: hub "Continue session setup" locked + hint |
| `105_p5_rina_sessions_hub_after_web_cancel.png` | Hub after the web cancelled SES-0037 |
| `106_o2_rina_maintenance_install_enabled.png` | O-2: TECHNICIAN System Maintenance, Install update enabled (not pressed) |
| `107_e2e_s1_after_sign_out_rina.png` | E2E-S-1: Login after rina's sign-out |
| `108_login_username_typed_andi.png` | Username andi.pratama typed on the phone |
| `109_andi_after_signin.png` | andi's Home with the biometric offer |
| `110_andi_home_supervisor.png` | andi's Home (SUPERVISOR) |
| `111_o2_andi_supervisor_maintenance_install_locked.png` | O-2: SUPERVISOR System Maintenance, Install update locked + hint |
| `112_e2e_s1_after_sign_out_andi_end_state.png` | E2E-S-1: Login after andi's sign-out |
| `113_end_state_login_live_signed_out.png` | End state: LIVE Login, signed out, Core online |
| `p3_home_bar.mp4` | E2E-P-3 screen recording (device time on every frame) |
| `p4_web_stop.mp4` | E2E-P-4 run 1 screen recording (R-P-1) |
| `p4b_start_handoff.mp4` | Run-2 start hand-off screen recording (R-P-2 control) |
| `p4b_web_stop.mp4` | E2E-P-4 run 2 screen recording |
| `p5_deeplink.mp4` | Deep link `/session/new` as TECHNICIAN screen recording |
| `role_to_tech.mp4` | Live role change to TECHNICIAN screen recording |
| `role_back_inv.mp4` | Live role change back to INVESTIGATOR screen recording |

Text assets: `core_log_lane1_retest_p.log`, `68_p4_device_log_app_process_1303_1304.txt`, `w1_network.log` (origins: `http://127.0.0.1:5176` 3270, `ws://127.0.0.1:5176` 20), `q/` (59 batches, `events.log`), `driver_console.log`, `rt_q.mts.txt`, `send.mjs.txt`, `navbar.py.txt` + `p1_nav_metrics.txt`, `p3sheet.py.txt`, `fsheet.py.txt`, `topsheet.py.txt`, `montage.py.txt`, `f80.py.txt` + `f80_capture_scan.txt`, `p4_run1_frame_metrics.txt`.

---
*Generated: 2026-10-06 13:35 +07:00*
