---
task_id: R-T
task_slug: retest-tablet-lane2
date: 2026-10-06
agent: verifier
decision_refs: [D196, D200, D201, D202, D203, D205, D206, D208]
status: complete
narrative_tier: 2
assets: test/assets/retest/t_tablet/
before: test/07d_e2e_tablet_lane2.md, test/assets/e2e/t_tablet/
---

# R-T — tablet re-test after E-fix (lane 2): the failed and flagged steps of E2E-T, then a smoke walk of every tablet screen

## 1. Environment

| Item | Value | How verified |
|---|---|---|
| Device | `dems2_tablet`, adb serial `emulator-5556`, 2560 × 1600, tablet landscape layout (navigation rail and list/detail panes) | `adb -s emulator-5556 shell wm size` (12:39) |
| App | `com.dems.demo.tablet`, debug build, JavaScript from Metro 8081 | `pm list packages` (12:39) |
| Fresh bundle | `am force-stop com.dems.demo.tablet` at 12:43:10.371, then `am start -a android.intent.action.VIEW -d 'demsdemo:///login?core=LIVE&motion=off' com.dems.demo.tablet` at 12:43:11.913. Metro printed `Android Bundled … expo-router/entry.js` and the tablet's `Live source ready` at 12:43:16.101 (correlation ID `Lmuw960fr`, new after the relaunch) | `q/002.out`; `.cache/manual/metro.log` lines 742 and 753 |
| Reverse rules, unchanged at start and end | `tcp:8081 → 8081`, `tcp:4420 → 4422` | `adb -s emulator-5556 reverse --list` at 12:39 and 13:12 |
| Core | lane 2, `http://127.0.0.1:4422`, `dems-core-server` 0.2.0, API v1, database and engine ready. Running since the 12:14 restart with FX-C's engine (D206): boot log `epoch 6`, `auditTotal 185` | `GET /api/v1/health` at 12:39:45 (uptime 1,657,823 ms) and 13:12:38 (3,631,339 ms); head of `.cache/manual/lane2-server.log` |
| Web console | `http://127.0.0.1:5177`, Live, Vite proxy to 4422 | `GET /` 200, `GET /api/v1/health` through 5177 200 (12:39) |
| Browser | Playwright-cache `chromium_headless_shell-1243` (HeadlessChrome 153.0.8010.12), `--remote-debugging-port=0`. The port (52670) was read from `DevToolsActivePort` and checked with `lsof`: the listener was pid 57858, the process this row started. Fresh profile in the temp folder. Origin only `http://127.0.0.1:5177`: 987 requests and 6 sockets, no other host, 0 console errors. The browser was stopped at 12:59:57 and the profile removed | `misc/web_chrome_launch.txt`; `wq/net_final.txt` last line; `drivers/chrome_launch.sh.txt` |
| Operators | `budi.santoso` INVESTIGATOR (OPR-001), `andi.pratama` SUPERVISOR (OPR-002), `rina.wijaya` TECHNICIAN (OPR-003). The drivers read the password from `packages/shared/src/sim/dataset.ts` and never print it | drivers; §7 |
| Timing method | Core times come from the lane-2 log and API records (host clock). Web reactions come from polling the page every 100 ms (host clock). The tablet transition comes from `screenrecord --bugreport --size 1280x800`: device time is printed on every frame, and a frame is written only when the screen changes. Device times were converted with the measured device clock offset (device − host): −337, −337, −341, −305, −354 ms at 12:47:54.958 and −342, −344, −346, −347, −347 ms at 12:48:44.957; median **−343 ms** | `q/012.out`, `q/013.out`; `rec/j_stop.mp4`; `rec/j_stop_frame_pts.txt` |
| Host load | 1-minute load 4.17–8.44 for the whole window (12:39 4.93, 12:45 6.38, 12:47 8.15, 12:52 6.32, 13:00 8.44, 13:04 6.90, 13:12 4.94). Never above 14, so no pause. Round 1 ran at 22–24 | `uptime` before each heavy step |
| Window | Part 1 12:43–12:59, Part 2 13:00–13:10, end state checked at 13:12 | `q/events.log`, `wq/events.log` |

Method. The round-1 drivers were reused: `drivers/rt_drive_q.mts.txt` is `t_drive_q.mts` plus the verbs `forcestop`, `clock`, `rec`, `jswarn` and `top`; `drivers/rt_web_q.mjs.txt` is `t_web_q.mjs` with only its header changed; `corelog`, `qsend` and the launch script are also there. Each tablet step runs from a numbered command file only after the previous capture has been read. The driver taps only while the app has the focus and no keyguard shows. It types the password only into an IME password field, and takes no capture between the password and a `sign-in 200`. Captures are on-device PNG (`exec-out screencap -p`). Core log lines (`core_log_lane2_window.txt`, 57 lines, 12:42:50–13:11:00) carry time, method, route and status only. A line is tagged `[tablet]` when the app logged its request ID.

## 2. Summary

| Measure | Result |
|---|---|
| Targeted re-tests (Part 1) | **12 / 12 PASS**, plus 1 measurement (the seal delay). Note labels on the tablet and the web, no empty frame on stop, custody on the tablet and the web, Metadata tab, Devices × 5 with the rail highlight, Install update locked, TECHNICIAN Start locked on Home and the Sessions hub, F80, E2E-T-1. Not exercised: the "Continue setup" variant (§3, row 13) |
| Seal delay, Core sealed → tablet "Evidence sealed" | **1.09 s** (1.08–1.10 s across the clock-offset samples). Round 1: 4.19 / 4.69 s at load 22–24. The web showed SEALED at +0.17 s. Better, but still about 0.9 s behind the web: a W98 measurement item |
| Empty frame between Live and Finalizing | **None.** Frame 80 (Live, device 12:47:59.112) is followed by frame 81 (Finalizing card, 12:47:59.304), 192 ms later. None of the 131 recorded frames is blank (lowest content-area standard deviation 11.1; the round-1 blank frames measure 0.0) |
| Custody | Tablet, web and Core record: RECORDING_STARTED = AKP Budi Santoso (OPR-001), RECORDING_STOPPED = **AKP Andi Pratama (OPR-002)**, matching audit #193 and #209 |
| Smoke walk (Part 2) | **26 / 26 screens** captured in the tablet layout as budi.santoso, each server-backed value consistent (§4) |
| F80 "Open debugger to view warnings" toast | **0** occurrences in 73 tablet captures. JS log since the relaunch: 1 `W/ReactNativeJS` line, the Reanimated reduced-motion override at launch (12:43:15.688), which LogBox already ignores (11c §6 #5). 0 `E/ReactNativeJS` lines |
| E2E-T-1 (red CORE_OFFLINE) | None. 0 `CORE_OFFLINE`, `unreachable` or `TIMEOUT` lines in the JS log, and 20 of 20 keep-alives answered 200. The load stayed low, so this does not re-test the starved-thread case |
| New defects | **4 Low**, all present in round-1 captures too but not reported then (§5). One web observation goes to R-W |
| End state | Tablet app in LIVE, signed out, on Login: "You have been signed out.", Core online, "Core: DEMS-IR-01 • paired as DEV-0001" (`P17_signout_lands_on_login.png`, 13:10:19). Nothing recording: the only session of the row, SES-20261006-0027, was SEALED at 12:48:05, and no `POST /session` or `/start` appears after 12:46:34. Web signed out (`POST /auth/sign-out 204`, then `GET /auth/session 401` at 12:59:43). Browser closed and profile removed. Reverse rules unchanged; keyguard never shown |

## 3. Part 1 — targeted re-tests (before / after)

"Before" = the round-1 capture under `test/assets/e2e/t_tablet/`; "After" = this row's capture under `test/assets/retest/t_tablet/`. Times are host-clock local (UTC+07:00); tablet device times are given with their host equivalent (offset −343 ms).

| # | Item | Before (round-1 file) | After (new file) | Observed (timestamps) | Result | Log / audit line |
|---|---|---|---|---|---|---|
| 0 | Relaunch so the new bundle loads (precondition) | `00_initial_state.png` | `00_before_relaunch.png`, `01_login_live_after_relaunch.png` | force-stop 12:43:10.371; link 12:43:11.913; `Live source ready` 12:43:16.101; Login "Core online", "Core: DEMS-IR-01 • paired as DEV-0001"; budi signed in, biometric offer → Not now (`02_biometric_offer_budi.png`, `03_home_budi_after_not_now.png`) | PASS | 12:43:16.125 `GET /api/v1/auth/session 401` [tablet]; 12:43:16.126 `GET /api/v1/pairing/device 200`; 12:43:16.130 `GET /api/v1/auth/status 200`; 12:43:53.028 `POST /api/v1/auth/sign-in 200` |
| 1 | Journey setup: tablet (budi) creates, prechecks and starts; web (andi) sees it | `B01`–`B08`, `B03_web_dashboard_session_appears.png` | `J01_wizard_step1.png`, `J02_wizard_step1_filled.png`, `J05_wizard_step2_devices_check.png`, `J06_wizard_step3_ready.png`, `J07_countdown.png`, `J08_tablet_live_monitor.png`, `J03_web_dashboard_session_appears.png`, `J04_web_dashboard_recording.png`, `J09_web_session_monitor.png` | SES-20261006-0027, LP/2026/1006-0011, Retno Wulandari (Tersangka). Web Dashboard showed the session at 12:45:57.238 (**+88 ms** after `POST /session 201`) and REC at 12:46:34.582 (**+66 ms** after `start 200`). Precheck 8 of 8 | PASS | 12:45:57.150 `POST /api/v1/session 201` [tablet]; 12:45:57.396 `POST /api/v1/session/:id/precheck 202`; 12:46:34.516 `POST /api/v1/session/:id/start 200`; audit #191 `SESSION_CREATED` OPR-001 (`cd5f5c98`), #193 `RECORDING_STARTED` OPR-001 12:46:34.506 (`094e3309`) |
| 2 | **E2E-T-5** tablet timeline title of a supervisor's note | `B12a_tablet_note_probe.png`: "Investigator Note Added · Investigator note · …" | `J12a_tablet_note_after_web_save.png`, `C1_note_label_before_B12a_after_J12a.png`; also recording frame `rec/j_stop_frames/f_0080.png` | Web Save 12:47:14.389. The tablet shows "12:47:14 **Supervisor Note Added** · Supervisor note · Supervisor note R-T: confirm subject ID before questioning". Latency was **not measured**: the parallel probe failed to start (deviation D-RT-1), and the first tablet capture (12:47:23.448, 9.0 s after the Core line) already shows the note | PASS | 12:47:14.403 `POST /api/v1/session/:id/notes 204` [web]; audit #199 `NOTE_ADDED` OPR-002 "Supervisor note added", `noteId NOTE-000019`, length 58 (`c58de6c5`) |
| 3 | **E2E-T-5** web note drawer and timeline | `B11_web_note_drawer.png` (D202: drawer title "Investigator note") | `J10_web_note_drawer_supervisor.png`, `J13_web_note_saved.png` | Drawer dialog text "**Supervisor note** · Note 0 / 2000 · Cancel · Save note". Session Note action subtitle "Add supervisor note"; web timeline "12:47:14 Supervisor Note Added" | PASS | same as #2 |
| 4 | **E2E-T-4** no empty frame between Live and Finalizing on a web stop | `B17_stop_probe_01.png`, `B17_stop_probe_02.png` (blank, 10:41:35.174–35.778), `R2_08_stop_probe_02.png` | `rec/j_stop.mp4`, `J17_tablet_stop_transition_frames_f78_f85.png`, `C7_stop_transition_before_B17_after_f80_f81.png`, frames `rec/j_stop_frames/f_0081.png` (overlay f=80) and `f_0082.png` (f=81) | Web confirm 12:47:58.327; Core `stoppedAt` 12:47:58.344. Last Live frame: device 12:47:59.112 (host ≈ 12:47:59.455, +1.11 s), timer 00:01:23. Next frame: device 12:47:59.304 (host ≈ 12:47:59.647, **+1.30 s**), the Finalizing card "Ending recording and closing tracks…". No frame in between; 131 frames, none blank. Round-1 "leaves Live" was 0.9–1.4 s, so that lag is unchanged | PASS | 12:47:58.359 `POST /api/v1/session/:id/stop 202` [web]; audit #209 `RECORDING_STOPPED` OPR-002 12:47:58.344, reason "Interview completed (R-T web stop by supervisor)", `durationMs` 83838 (`755f21eb`) |
| 5 | **E2E-T-4** delay Core seal → tablet "Evidence sealed" | 4.19 s (`B20_tablet_evidence_sealed.png`) / 4.69 s (`R2_08_stop_probe_13.png`) | `J19_tablet_seal_frames_f100_f107.png`, `rec/j_stop_frames/f_0103.png` (f=102, Finalizing 83 %), `rec/j_stop_frames/f_0104.png` (f=103, Evidence sealed), `J21_tablet_after_stop_recording.png`, `J21b_tablet_summary_bottom.png`, web `J18_web_sealed.png` | Core `sealedAt` 12:48:05.477. Tablet: 83 % at device 12:48:05.530; "Evidence sealed EV-20261006-0017 · Sealed 7.1 s after the recording ended" at device 12:48:06.223 = host 12:48:06.566, **+1.09 s**. Web finalization modal SEALED at 12:48:05.642 (+0.17 s). Summary on the tablet afterwards | MEASURED: 1.09 s (was 4.2–4.7 s). About 0.9 s behind the web → W98 | audit #210 `EVIDENCE_SEALED` 12:48:05.477, 4 tracks, 190,964,333 B (`9c00491a`); 12:48:06.977 `GET /api/v1/session/current 200` [web] |
| 6 | **Custody on the tablet** (R1 / E2E-T-3) | `B29_tablet_evidence_custody.png`: "Recording stopped · AKP Budi Santoso" | `J29_tablet_evidence_custody.png`, `P07d_evidence_detail_custody.png`, `C2_custody_before_B29_after_J29.png` | EV-20261006-0017: "Sealed 6 Oct 2026 12:48:05 · System"; "Recording stopped 6 Oct 2026 12:47:58 · **AKP Andi Pratama** · Interview completed (R-T web stop by supervisor)"; "Recording started 6 Oct 2026 12:46:34 · **AKP Budi Santoso**" | PASS | Core record (`wq/api_1791265946636.json`): custody `RECORDING_STARTED actorId OPR-001`, `RECORDING_STOPPED actorId OPR-002`, `SEALED actorId null`. Same actors as audit #193 OPR-001 and #209 OPR-002 (`wq/api_1791265946644.json`). 12:50:48.513 `GET /api/v1/evidence/:id 200` [tablet] |
| 7 | **Custody on the web** | `B25_web_evidence_integrity.png` (stop by AKP Budi Santoso) | `J25b_web_evidence_custody.png`, `J25_web_evidence_integrity_custody.png` | Chain of custody: 12:48:05 SEALED System; 12:47:58 RECORDING_STOPPED **AKP Andi Pratama**, the reason; 12:46:34 RECORDING_STARTED **AKP Budi Santoso** | PASS | 12:52:26.635 `GET /api/v1/evidence/:id 200` [web]; 12:52:26.643 `GET /api/v1/audit 200` [web] |
| 8 | **E2E-T-6** Metadata tab shows the Core record | `B27_tablet_evidence_metadata.png`: only "No DEMO package for this item: the manifest is not on this device." | `J27_tablet_evidence_metadata.png`, `J27b_tablet_evidence_metadata_scrolled.png`, `P07b_evidence_detail_metadata.png`, `C3_metadata_before_B27_after_J27b.png`; web `J24_web_evidence_metadata.png` | "No DEMO package for this item: the Core server's record only." then "CORE RECORD" and the record. Keys in the web's order with the web's values: `record "CORE"`, `note`, `evidenceId EV-20261006-0017`, `sessionId SES-20261006-0027`, `caseNumber LP/2026/1006-0011`, `subject {Retno Wulandari, TERSANGKA}`, `investigatorId OPR-001`, `room`, `recordedAt 2026-10-06T12:46:34.506+07:00`, `endedAt …12:47:58.344…`, `sealedAt …12:48:05.477…`, `status SEALED`, `lifecycleStage SEALED_LOCAL_EVIDENCE`, `manifestHash 5a6c0781…c4c025` | PASS | uiautomator `evidence-metadata-none`, `evidence-record-title "CORE RECORD"`, `evidence-record-json` (`q/tablet_new_evidence_metadata.txt`); API values as in #6 |
| 9 | **E2E-T-2 + E2E-P-1** Evidence detail → (More, tap outside) → rail Devices, 5 times | `12_devices_blank_after_7min.png` (blank > 4 min, rail indicator on Evidence), `misc/paint_probe_a.png` | `T2_c1a_evidence_more_menu.png`, `T2_c1_devices_1500ms.png`, `T2_c2a_evidence_detail.png`, `T2_c2_devices_1500ms.png`, `T2_c3a_evidence_detail.png`, `T2_c3_devices_1500ms.png`, `T2_c4a_evidence_detail.png`, `T2_c4_devices_1500ms.png`, `T2_c5a_evidence_detail.png`, `T2_c5_devices_1500ms.png`, `T2_devices_cycles_1_to_5_sheet.png`, `C6_devices_before_12blank_after_T2c1.png` | Rail taps at 12:53:01.051, 12:53:51.574, 12:54:03.195, 12:54:33.292 and 12:54:45.380. Every capture 1.5 s after the tap shows "Devices & Inputs" with Camera 1/2 Online, MIC 1/2 Online, PoE Switch "1 active · 1 spare", Recording Indicator Active, Tablet Control Connected. The rail card is on **Devices** (gold), Evidence is grey. uiautomator, 5 of 5: `screen-devices` present, 3 `devices-section-*`, `nav-rail-indicator [16,480][447,576]` = `nav-item-devices` bounds (round 1: no `screen-*` node) | PASS 5/5 | no request (store-fed screen); dumps `q/t2_c1_devices.txt` to `q/t2_c5_devices.txt` |
| 10 | **O-2 / R2** Install update for INVESTIGATOR | `18g_settings_system_maintenance.png` (Install update enabled) | `O2_a_settings_budi.png`, `O2_b_system_maintenance_budi.png`, `C4_install_update_before_18g_after_O2b.png`, `misc/o2_install_update_enabled_attr.txt` | Software Update: "Install update" dimmed, then "**Requires the Technician role**". uiautomator `settings-update-install enabled="false"`. "Your role does not include the demo controls." Not pressed (D197 rule) | PASS | no request |
| 11 | **R2** TECHNICIAN Home Start Session | `22_home_technician.png` (enabled), `22_technician_session_create_refused_403.png` (Core refused 403) | `R2_b_technician_after_signin.png`, `R2_c_home_technician_start_locked.png`, `R2_d_home_technician_after_locked_tap.png`, `C5_technician_home_before_22_after_R2c.png`, `R2_h_more_technician.png` | rina.wijaya signed in. Quick Actions: Start Session dimmed, then "**Requires the Investigator role**". A tap at 12:57:49.341 opened nothing: R2_d is byte-identical to R2_c (782,615 bytes each). More: "Rina Wijaya · Technician · OPR-003 · Signed in 12:57". Extra: the deep link `demsdemo:///session/new` at 12:58:48.647 went to Home with the toast "Not permitted · Requires the Investigator role" (`R2_f_technician_session_new_link_1500ms.png`, `R2_g_technician_session_new_link_4s.png`), and the app wrote an `info` record `features.sessionNew.entryRefused` at 12:58:48.427 (not `console.warn`) | PASS | 12:57:23.039 `POST /api/v1/auth/sign-in 200` [tablet]; **no** `POST /api/v1/session` after 12:45:57; 12:59:18.242 `POST /api/v1/auth/sign-out 204` |
| 12 | **R2** TECHNICIAN Sessions hub Start | (no TECHNICIAN hub capture in round 1; INVESTIGATOR hub `07_sessions_hub.png`, Start enabled) | `R2_e_sessions_hub_technician_start_locked.png`, `misc/r2_sessions_start_enabled_attr.txt` | "Start New Session" dimmed, then "**Requires the Investigator role**". uiautomator `sessions-start enabled="false"`, `sessions-start-locked` text present. Filters All 17 / Sealed 16 / Incomplete 1 / Today 3 | PASS | none |
| 13 | **R2** "Continue setup" variant | — | — | The variant shows only while a setup session is in progress. Leaving one on lane 2 to show it would change the shared lane, so it was **not exercised** on the device (FX-M2's `role-gate-r2.test.tsx` covers `startsWizard`) | NOT RUN | — |
| 14 | **F80** debug warnings toast | D196 F80 (seen on the phone rows); round-1 tablet: red LogBox of E2E-T-1, `11_logbox_touch_core_offline_error.png` | all 73 tablet captures of this row (bottom bands reviewed); `jswarn_tablet_full.txt`, `jserr_tablet_full.txt` | **0** toasts. JS log 12:42:52–13:10:20: one `W/ReactNativeJS` line ("[Reanimated] Reduced motion setting is overwritten with mode 'always'", 12:43:15.688, at launch, ignored by LogBox per 11c §6 #5; `01_login_live_after_relaunch.png` at 12:43:25 shows no toast); 0 `E/ReactNativeJS`; every `[runtime]` record `level: 'info'` | PASS | — |
| 15 | **E2E-T-1** red CORE_OFFLINE while the Core is up | `11_logbox_touch_core_offline_error.png` (09:52:29) | no red bar in any capture; `jslog_tablet_full.txt` | 20 of 20 `POST /api/v1/auth/touch 200` (about one a minute from 12:45:23 to 13:09:54) and 3 `GET /api/v1/health 200` on Stack Check. 0 `CORE_OFFLINE`, 0 `unreachable`, 0 `TIMEOUT`, 0 `No answer within` in the JS log. Not reproducible on demand: the host load was 4–8 and the JS thread was not starved | PASS (none observed; not a stress test) | the 20 touch lines in `core_log_lane2_window.txt`, all 200 |

**Targeted count:** rows 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 14 and 15 = 12 PASS. Row 5 is a measurement, row 13 was not run, rows 0–1 are journey steps.

## 4. Part 2 — smoke walk of every tablet screen (budi.santoso, INVESTIGATOR)

Signed in at 13:00:19 (`POST /api/v1/auth/sign-in 200` 13:00:19.531 [tablet]; biometric offer → Not now, `P02_after_signin_offer.png`).

| # | Screen | Result | Capture | Value check |
|---|---|---|---|---|
| S1 | Login (LIVE, signed out) | PASS | `P01_login_signed_out.png` | "You have been signed out.", Core online, "Core: DEMS-IR-01 • paired as DEV-0001" = 12:43:16.126 `GET /pairing/device 200`. Password empty; Demo operators not opened |
| S2 | Home | PASS | `P03_home.png` | "3 Items sealed today" = EV-20261006-0017, -0016, -0015 (all of 6 Oct; the evidence list agrees); Storage 20 % used; Core Live; READY. No uiautomator (rule) |
| S3 | Sessions hub | PASS | `P04_sessions_hub.png` | All 17 / Sealed 16 / Incomplete 1 / Today 3. Round 1's Core history was 14 (13 SEALED, 1 INCOMPLETE); since then SES-20261006-0025 and -0026 (round 1) and -0027 (this row) were sealed. Start New Session enabled for INVESTIGATOR |
| S4 | Session detail (SES-20261006-0027) | PASS | `P05_session_detail.png` | LP/2026/1006-0011, Retno Wulandari Tersangka, AKP Budi Santoso, Interview Room 1, 12:46:34–12:47:58 = `GET /session/current` answer (`wq/api_1791265686981.json`) |
| S5 | Evidence list | PASS | `P06_evidence_list_and_detail.png` | EV-20261006-0017 Sealed 00:01:23; -0016 Sealed; -0015 Archived (round 1) |
| S6 | Evidence detail — Media | PASS | `P07a_evidence_detail_media.png` | "No DEMO media for this item on this device." Header: 191.0 MB = 190,964,333 B, 00:01:23 = 83,838 ms |
| S7 | Evidence detail — Metadata | PASS | `P07b_evidence_detail_metadata.png` | CORE RECORD (as Part 1 #8) |
| S8 | Evidence detail — Hash & Integrity (and custody) | PASS (R-T-2) | `P07c_evidence_detail_hash_integrity.png`, `P07d_evidence_detail_custody.png`, `J28_tablet_evidence_hash_integrity.png`, `J28b_tablet_evidence_hash_scrolled.png` | VIDEO-01 `64f89aed…8fb3bc0a78c33282`, VIDEO-02 `96e7c1e7…fb531481befb2228`, MIC 1 `b2f0d7cf…dbbacc3aff42a7d4`, MIC 2 `15c382e7…3617dfd443aa797d`, manifest `5a6c0781…69d0f699d8c4c025`, signature `36ed3c40…c0e0426eea02ce68`, KEY-EVSIGN-01 = API and web `J25`; custody as Part 1 #6. Heading reads "Verified by the Core" for an unverified item (R-T-2) |
| S9 | Evidence detail — More menu | PASS (R-T-1) | `P07e_evidence_more_menu.png`, `misc/p07e_more_menu_crop_brightened.png` | "Archiving needs the Supervisor role" (EVIDENCE_REVIEW is SUPERVISOR-only), Download manifest. The disabled Archive item shows no title (R-T-1). Closed without choosing |
| S10 | Devices | PASS | `P08_devices.png` | Camera 1/2 Online, MIC 1/2 Online, PoE "1 active · 1 spare", Recording Indicator Active, Tablet Control Connected. Same set as round 1's `GET /device/inventory`; not re-fetched |
| S11 | Device detail (Camera 1) | PASS | `P09_device_detail_camera1.png` | CAM-01 Online, "Dual-lens IP camera DL-2 (lens 1)" = round-1 inventory `cameras[0]`; Diagnostics and Test signal enabled; Restart disabled "Requires the Technician role" (DEVICE_MANAGE) |
| S12 | More | PASS | `P10_more.png` | AKP Budi Santoso · Investigator · OPR-001 · "Signed in 13:00" = sign-in 13:00:19; Pairing "Paired · Core: Interview Room 1"; footer DEMO · Core Live · "Data from the Core server" |
| S13 | Storage | PASS | `P11_storage.png` | 20 % used, 3.2 TB free of 4.0 TB, 805 GB used, retention 90 days; session size 0.19 GB SES-20261006-0027 = 190,964,333 B |
| S14 | Network & Time | PASS (R-T-3) | `P12_network_time.png` | LAN Connected, PoE Active, GNSS/NTP Synchronized UTC+07:00, server 192.168.10.1, GNSS Active, NTP and RTC Standby = round-1 `GET /network/status` and `/time/status`. Clock seconds held at :00 by `motion=off` (round-1 O-3, by design). Label "Bandwidt" clipped (R-T-3) |
| S15 | Audit | PASS | `P13_audit.png` | HEAD `8b8f60fd`, 216 entries, Chain OK. API at 12:52 gave total 211, head `d5fd218c…`; the five auth rows since then (budi out 12:56:46, rina in 12:57:23, rina out 12:59:18, andi out 12:59:43, budi in 13:00:19) are the top rows shown, and each matches a Core log line |
| S16 | Settings — App Preferences | PASS | `P14a_settings_app_preferences.png` | Core link source **Live** selected; reduce motion off, haptics on, presentation mode off |
| S17 | Settings — Notifications | PASS | `P14b_settings_notifications.png` | local toggles, "Saved on this console only (demo)"; no server value |
| S18 | Settings — Security & Privacy | PASS | `P14c_settings_security_privacy.png` | biometric off (declined), auto-lock 15 min "Fixed … by the demo policy", Core pairing Paired |
| S19 | Settings — Device Settings | PASS | `P14d_settings_device_settings_opens_devices.png` | opens the Devices screen (same data as S10) |
| S20 | Settings — Storage Management | PASS | `P14e_settings_storage_management.png` | opens Storage (same data as S13) |
| S21 | Settings — Network & Time | PASS | `P14f_settings_network_time.png` | opens Network & Time (same data as S14) |
| S22 | Settings — System Maintenance | PASS | `P14g_settings_system_maintenance.png` | "Last run 10:09:56: 8 passed" (round-1 A14 run); Install update locked "Requires the Technician role" (as Part 1 #10) |
| S23 | Settings — About DEMS | PASS | `P14h_settings_about.png` | v2.4.1, DEMS-IR-01, Interview Room 1, DEC-2026-IR01-000117, BSP 6.1.57 / DT r3, TPM 2.0 (fw 7.2.3.1), PRV-2026-0117 = round-1 inventory `identity` |
| S24 | Settings — Account / Profile sheet | PASS | `P14i_settings_account_profile.png`, `P14j_profile_closed.png` | AKP Budi Santoso, Role Investigator, OPR-001, budi.santoso; permissions Start sessions, Add notes and markers, View evidence, Run diagnostics = INVESTIGATOR grants |
| S25 | Stack Check | PASS | `P15_stack_check.png` | "core-server v0.2.0 · api v1" = `GET /health` (13:08:34.520, 13:08:44.532, 13:08:54.548 `GET /api/v1/health 200` [tablet]); heartbeat Live. Copy now reads "Data source: Live. Data, Heartbeat and Service come from the Core server over adb reverse." (round-1 `19_stack_check.png` said "wired to the local mock-core": E2E-P-2's fix is visible on the tablet too) |
| S26 | Start Session wizard, step 1 (not started), then sign out → Login | PASS | `P16a_home_before_wizard.png`, `P16_start_session_wizard_step1.png`, `P16b_after_wizard_back.png`, `P17a_more_before_signout.png`, `P17_signout_lands_on_login.png` | Wizard "Session Info": Investigator AKP Budi Santoso, Room Interview Room 1, profile Standard (1080p / 25 fps), Next disabled until filled, live device status from the Core. Back → Home; no `POST /session` sent. More → Sign out: 13:10:11.974 `POST /api/v1/auth/sign-out 204` [tablet], then `GET /auth/status 200`; landed on **Login** with "You have been signed out." |

## 5. Defects (R-T-n)

None of the round-1 defects this row re-tested recurs. The four items below are Low; each is also visible in a round-1 capture but was not reported then.

| ID | Severity | Where | Expected | Observed | Repro | Evidence |
|---|---|---|---|---|---|---|
| R-T-1 | Low | mobile Evidence detail → More menu (`features/evidence/evidence-detail.tsx:338-346`, `Menu.Item` `evidence-more-archive`, `isDisabled`, `variant="danger"`) | a disabled item still shows its title ("Archive") with the reason under it | the item draws only the description "Archiving needs the Supervisor role"; the title area is empty (pixels flat at luminance 37, no glyph). Same in round-1 `10i_evidence_more_menu.png` | as INVESTIGATOR: Evidence → any item → More | `P07e_evidence_more_menu.png`, `misc/p07e_more_menu_crop_brightened.png`, round-1 `10i_evidence_more_menu.png` |
| R-T-2 | Low | mobile Evidence → Hash & Integrity card (`features/evidence/live-integrity-tab.tsx:133-135`; `evidence-model.ts:349-374`) | the card heading follows the Core's verdict, like the web after E2E-W1-3 (the web card reads "NOT VERIFIED · Verdict of the Core server", `J25_web_evidence_integrity_custody.png`) | the heading is always "Verified by the Core". For EV-20261006-0017, whose Core record says `verification.status NOT_RUN`, the card reads "Verified by the Core" over "Not verified on this screen yet". The view model reads only an on-screen Verify answer, not the item's stored `verification`. **Hypothesis, from code only (not run on the device):** an item the Core already verified would also show "Not verified on this screen yet" | open any unverified item → Hash & Integrity | `J28_tablet_evidence_hash_integrity.png`, `P07c_evidence_detail_hash_integrity.png`, `wq/api_1791265946636.json` (`verification`); round-1 `10e_evidence_tab_hash_integrity.png` |
| R-T-3 | Low | mobile Network & Time → Network Status, Bandwidth row (tablet layout) | the label "Bandwidth" is readable | the sparkline overlaps the label, which reads "Bandwidt" | rail → Network & Time | `P12_network_time.png`, `P14f_settings_network_time.png`; round-1 `16_network_time.png` |
| R-T-4 | Low | mobile Sessions hub list column (tablet layout) | session rows show the session ID, date, subject chip and duration legibly | the narrow column cuts the session ID and date to "SES-…" / "6 Oct …". The subject chip wraps to three lines ("Ters / angk / a") and the duration to two ("00:01:" / "23") | rail → Sessions | `P04_sessions_hub.png`, `R2_e_sessions_hub_technician_start_locked.png`; round-1 `07_sessions_hub.png` |

### Observations (not counted as defects)

- **O-RT-1 (web, for R-W / the controller).** In LIVE, the web Evidence detail Media tab of a Core-recorded item says "No DEMO media · This item has no DEMO package, so there is nothing to play. Its record comes from the simulator." The record comes from the Core server (`J23_web_evidence_detail.png`, 12:52:12). This row only looked at that page in passing.
- **O-RT-2.** The tablet still leaves Live 1.1–1.3 s after the Core's stop (round 1: 0.9–1.4 s). The web, the client that issued the stop, showed its finalization modal at 12:47:58.717 (+0.37 s). Like the seal delay (Part 1 #5), this goes to W98 as a measurement.
- **O-RT-3.** Supervisor-note latency to the tablet was not measured in this round (D-RT-1). It is bounded only by ≤ 9.0 s; round 1 measured ≤ 2.4 s. Nothing suggests a regression, but the number is not established.
- **O-RT-4.** The Stack Check heading still reads "Stack check · placeholder" (copy).
- **O-RT-5.** Every password sign-in shows the biometric offer again; "Not now" was chosen each time and nothing was enrolled (expected while nothing is enrolled).

## 6. State changes on lane 2 made by this row

| Change | Detail |
|---|---|
| Recording | Session SES-20261006-0027: created, prechecked and started by OPR-001 on the tablet; note NOTE-000019 by OPR-002; stopped by OPR-002 from the web; sealed as EV-20261006-0017 (SEALED, not verified, not archived); summary acknowledged by OPR-001 |
| Sign-ins and sign-outs | budi.santoso twice and rina.wijaya once on the tablet; andi.pratama once on the web |
| Audit | 185 entries at boot; 211 at 12:52 (head `d5fd218c…`); 216 at 13:05 (tablet Audit, HEAD `8b8f60fd`); plus the final sign-out row at 13:10 |
| Not done | No reset, scenario, fault, role or operator change. No Verify, Archive, Install update, Restart, diagnostics or test signal. No setup session left behind |

## 7. Rules, deviations and secret check

- **Device security.** No PIN typed. No lock, PIN or fingerprint set, changed or cleared; no `locksettings`, no `adb emu finger`, no settings change. `isKeyguardShowing=false` at every focus check and at 13:12.
- **adb scope.** `device-session.sh` was not used. Only `emulator-5556` was addressed, and the reverse rules were not touched.
- **Servers.** No server, Vite, Metro or emulator was started or stopped. Ports 4420/4421/4423, 5173/5176/5178 and 5432 and PostgreSQL were not touched.
- **App launch and dumps.** The app was never launched at `/` with `motion=` (links used: `/login?core=LIVE&motion=off`, `/more`, `/home`, `/stack-check`, `/session/new`). No `uiautomator dump` while Login, Summary or Home showed.
- **Files.** No tracked file was modified, and no test suite was run. This row's two temporary device files were deleted: `/sdcard/j_stop.mp4` by the driver after the pull, and `/sdcard/rt_t.xml` (the uiautomator dump) at 13:27.
- **D-RT-1 (deviation).** The background probe that should have captured the tablet while the web saved the note did not start. Inside an unsandboxed command `$TMPDIR` points elsewhere, so the redirect path did not exist. The note was captured afterwards (Part 1 #2), so its latency is unmeasured (O-RT-3).
- **D-RT-2 (beyond the brief, read-only).**
  - The TECHNICIAN deep link to `/session/new` checked the R2 entry guard; no request was sent.
  - Two `uiautomator` dumps were run outside the driver: System Maintenance at 12:56 and the Sessions hub at 12:58, neither of them Login, Summary or Home. They read the `enabled` attribute; only the node attributes were written (`misc/*_enabled_attr.txt`).
- **IN-RT-1 (incident, own tool output).** At about 12:41, a read-only `grep` of `packages/shared/src/sim/dataset.ts` for the export names `DEMO_OPERATOR_PASSWORD` and `OPERATORS` printed the line that defines the password constant into this agent's tool output once.
  - Nothing was written to any file, and every artifact scans clean (below).
  - The constant is the published demo password (README quick start), but the rule was broken.
  - Rule for later rows: confirm exports with `grep -c`, or print the identifier only (`grep -o 'export const [A-Z_]*'`). Never print a matching line of `dataset.ts`.
- **Secret scan.** The scan is count-only. The password is read from the dataset constant and is also matched case-insensitively with separators (space, `_`, `-`, `.`, or none). The scan also checks `dvc_` / `ses_` / `bio_` token shapes and six-digit codes written with a separator. Result: see `delegation_progress/retest_t_tablet.md` (final line) and the line below.

Scan at 13:26:27 (`drivers/scan.mts.txt`, run with `node --import tsx`) over `test/assets/retest/t_tablet/`, this report and `delegation_progress/retest_t_tablet.md`: **160 text files; password exact 0; password loose 0; token shapes 0**. It also found 40 3+3-digit shapes, and all 40 are tap or swipe screen coordinates in `q/*.cmd` (for example `tap 867 480`). No pairing code was issued or shown in this row. The screenshots cannot be text-scanned. The Login captures show an empty password field and a closed "Demo operators" panel, and no capture was taken between a typed password and its `sign-in 200`.

## 8. Screenshot index

Tablet captures are 2560 × 1600 on-device PNG (`adb exec-out screencap -p`). Web captures are 1600 × 1000 CDP `Page.captureScreenshot`. Recording frames are 960 × 600, scaled from the 1280 × 800 `screenrecord --bugreport` clip; the device time is printed top left with the frame number `f=N`, and file `f_NNNN` = overlay `f=NNNN−1`.

| File | Caption |
|---|---|
| `00_before_relaunch.png` | tablet before the row (Login, LIVE), 12:43:00 |
| `01_login_live_after_relaunch.png` | Login after force-stop and cold relaunch: Core online, paired DEV-0001 |
| `02_biometric_offer_budi.png` | biometric offer after budi's sign-in; Not now chosen |
| `03_home_budi_after_not_now.png` | Home, INVESTIGATOR, before the journey |
| `J01_wizard_step1.png` | Start Session wizard step 1 (journey) |
| `J02_wizard_step1_filled.png` | step 1 filled: scanned case number, Tersangka, Retno Wulandari |
| `J03_web_dashboard_session_appears.png` | web Dashboard (andi): "Session setup in progress SES-20261006-0027", +88 ms after create |
| `J04_web_dashboard_recording.png` | web Dashboard at REC 00:00:00 (+66 ms after start) |
| `J05_wizard_step2_devices_check.png` | tablet Devices Check 8 of 8 |
| `J06_wizard_step3_ready.png` | tablet Ready step |
| `J07_countdown.png` | tablet 3-2-1 countdown |
| `J08_tablet_live_monitor.png` | tablet Live monitor, recording |
| `J09_web_session_monitor.png` | web Session Monitor, RECORDING 00:00:22 |
| `J10_web_note_drawer_supervisor.png` | web note drawer titled "Supervisor note" (E2E-T-5 web) |
| `J12a_tablet_note_after_web_save.png` | tablet timeline: "Supervisor Note Added · Supervisor note · …" (E2E-T-5) |
| `J13_web_note_saved.png` | web timeline "Supervisor Note Added", "Note added" toast |
| `J16_web_end_dialog.png` | web End Session dialog with the reason typed |
| `J17_tablet_stop_transition_frames_f78_f85.png` | recording frames 78–85 (overlay numbers): Live then Finalizing card, no blank frame (E2E-T-4) |
| `J18_web_sealed.png` | web finalization modal SEALED, "Sealed 7.1 s after the recording ended" |
| `J19_tablet_seal_frames_f100_f107.png` | recording frames 100–107: Finalizing 83 % then "Evidence sealed" at device 12:48:06.223 |
| `J21_tablet_after_stop_recording.png` | tablet Summary after the seal |
| `J21b_tablet_summary_bottom.png` | tablet Summary bottom: Done / View in Evidence |
| `J23_web_evidence_detail.png` | web Evidence detail EV-20261006-0017, Media tab (O-RT-1 wording) |
| `J24_web_evidence_metadata.png` | web Metadata tab: Core record JSON |
| `J25_web_evidence_integrity_custody.png` | web Hash & Integrity: NOT VERIFIED, sealed values, lifecycle |
| `J25b_web_evidence_custody.png` | web chain of custody: RECORDING_STOPPED AKP Andi Pratama, RECORDING_STARTED AKP Budi Santoso |
| `J26_tablet_evidence_detail_new.png` | tablet Evidence detail of the new item after "View in Evidence" |
| `J27_tablet_evidence_metadata.png` | tablet Metadata tab: "the Core server's record only", CORE RECORD (E2E-T-6) |
| `J27b_tablet_evidence_metadata_scrolled.png` | tablet Metadata tab scrolled: the record's keys and values |
| `J28_tablet_evidence_hash_integrity.png` | tablet Hash & Integrity: card and per-track SHA-256 (R-T-2 heading) |
| `J28b_tablet_evidence_hash_scrolled.png` | tablet manifest hash, signature, lifecycle, custody start |
| `J29_tablet_evidence_custody.png` | tablet chain of custody: stopped by AKP Andi Pratama, started by AKP Budi Santoso |
| `T2_c1a_evidence_more_menu.png` | E2E-T-2 cycle 1: Evidence detail More menu open (round-1 path) |
| `T2_c1_devices_1500ms.png` | cycle 1: Devices with data 1.5 s after the rail tap; rail on Devices |
| `T2_c2a_evidence_detail.png` | cycle 2: Evidence detail before More |
| `T2_c2_devices_1500ms.png` | cycle 2: Devices with data; rail on Devices |
| `T2_c3a_evidence_detail.png` | cycle 3: Evidence detail before More |
| `T2_c3_devices_1500ms.png` | cycle 3: Devices with data; rail on Devices |
| `T2_c4a_evidence_detail.png` | cycle 4: Evidence detail before More |
| `T2_c4_devices_1500ms.png` | cycle 4: Devices with data; rail on Devices |
| `T2_c5a_evidence_detail.png` | cycle 5: Evidence detail before More |
| `T2_c5_devices_1500ms.png` | cycle 5: Devices with data; rail on Devices |
| `T2_devices_cycles_1_to_5_sheet.png` | sheet of the five Devices captures and one Evidence detail |
| `O2_a_settings_budi.png` | Settings as INVESTIGATOR (App Preferences, Live selected) |
| `O2_b_system_maintenance_budi.png` | System Maintenance: Install update disabled, "Requires the Technician role" (O-2) |
| `O2_c_more_budi.png` | More (budi) before signing out for the TECHNICIAN check |
| `R2_a_signed_out_login.png` | Login after budi's sign-out |
| `R2_b_technician_after_signin.png` | rina signed in; biometric offer over Home |
| `R2_c_home_technician_start_locked.png` | TECHNICIAN Home: Start Session disabled, "Requires the Investigator role" |
| `R2_d_home_technician_after_locked_tap.png` | after tapping the locked Start Session: unchanged (byte-identical) |
| `R2_e_sessions_hub_technician_start_locked.png` | TECHNICIAN Sessions hub: Start New Session disabled, hint |
| `R2_f_technician_session_new_link_1500ms.png` | deep link to `/session/new` as TECHNICIAN: Home + toast "Not permitted" |
| `R2_g_technician_session_new_link_4s.png` | 4 s later: Home, toast gone |
| `R2_h_more_technician.png` | More: Rina Wijaya · Technician · OPR-003 |
| `P01_login_signed_out.png` | smoke S1: Login, signed out, Core online |
| `P02_after_signin_offer.png` | budi's Part 2 sign-in: biometric offer over Home |
| `P03_home.png` | smoke S2: Home |
| `P04_sessions_hub.png` | smoke S3: Sessions hub, All 17 / Sealed 16 / Incomplete 1 / Today 3 |
| `P05_session_detail.png` | smoke S4: Session detail SES-20261006-0027 |
| `P06_evidence_list_and_detail.png` | smoke S5: Evidence list |
| `P07a_evidence_detail_media.png` | smoke S6: Evidence detail, Media |
| `P07b_evidence_detail_metadata.png` | smoke S7: Evidence detail, Metadata (CORE RECORD) |
| `P07c_evidence_detail_hash_integrity.png` | smoke S8: Evidence detail, Hash & Integrity |
| `P07d_evidence_detail_custody.png` | smoke S8: lifecycle and chain of custody |
| `P07e_evidence_more_menu.png` | smoke S9: More menu (Archive reason, Download manifest; R-T-1) |
| `P08_devices.png` | smoke S10: Devices |
| `P09_device_detail_camera1.png` | smoke S11: Camera 1 detail, Restart disabled for INVESTIGATOR |
| `P10_more.png` | smoke S12: More |
| `P11_storage.png` | smoke S13: Storage |
| `P12_network_time.png` | smoke S14: Network & Time (R-T-3 label) |
| `P13_audit.png` | smoke S15: Audit, HEAD 8b8f60fd, 216 entries |
| `P14a_settings_app_preferences.png` | smoke S16: Settings, App Preferences |
| `P14b_settings_notifications.png` | smoke S17: Settings, Notifications |
| `P14c_settings_security_privacy.png` | smoke S18: Settings, Security & Privacy |
| `P14d_settings_device_settings_opens_devices.png` | smoke S19: Device Settings opens Devices |
| `P14e_settings_storage_management.png` | smoke S20: Storage Management opens Storage |
| `P14f_settings_network_time.png` | smoke S21: Settings Network & Time opens Network & Time |
| `P14g_settings_system_maintenance.png` | smoke S22: System Maintenance |
| `P14h_settings_about.png` | smoke S23: About DEMS |
| `P14i_settings_account_profile.png` | smoke S24: Account / Profile sheet |
| `P14j_profile_closed.png` | profile sheet closed (About shown) |
| `P15_stack_check.png` | smoke S25: Stack Check, core-server v0.2.0 · api v1, Data source Live |
| `P16a_home_before_wizard.png` | Home before opening the wizard |
| `P16_start_session_wizard_step1.png` | smoke S26: Start Session wizard step 1 (not started) |
| `P16b_after_wizard_back.png` | Back from the wizard: Home, nothing created |
| `P17a_more_before_signout.png` | More before the final sign-out |
| `P17_signout_lands_on_login.png` | smoke S26 / end state: signed out, Login, LIVE, Core online |
| `W01_web_dashboard_supervisor.png` | web Dashboard after andi's sign-in (before the journey) |
| `C1_note_label_before_B12a_after_J12a.png` | before/after crop: "Investigator Note Added" → "Supervisor Note Added" |
| `C2_custody_before_B29_after_J29.png` | before/after: custody stop by AKP Budi Santoso → AKP Andi Pratama |
| `C3_metadata_before_B27_after_J27b.png` | before/after: empty Metadata tab → Core record |
| `C4_install_update_before_18g_after_O2b.png` | before/after: Install update enabled → disabled with hint |
| `C5_technician_home_before_22_after_R2c.png` | before/after: TECHNICIAN Start Session enabled → disabled with hint |
| `C6_devices_before_12blank_after_T2c1.png` | before/after: blank Devices pane → Devices with data |
| `C7_stop_transition_before_B17_after_f80_f81.png` | before: two blank probe frames; after: Live frame 80 → Finalizing frame 81 |
| `misc/p07e_more_menu_crop_brightened.png` | brightened crop of the More menu: no Archive title (R-T-1) |
| `rec/j_stop_frames/f_0080.png` | overlay f=79, device 12:47:59.078: Live, timeline shows the supervisor note |
| `rec/j_stop_frames/f_0081.png` | overlay f=80, device 12:47:59.112: last Live frame |
| `rec/j_stop_frames/f_0082.png` | overlay f=81, device 12:47:59.304: Finalizing card in place |
| `rec/j_stop_frames/f_0083.png` | overlay f=82, device 12:48:00.112: Finalizing |
| `rec/j_stop_frames/f_0102.png` | overlay f=101, device 12:48:05.518: Finalizing 83 % |
| `rec/j_stop_frames/f_0103.png` | overlay f=102, device 12:48:05.530: Finalizing 83 % |
| `rec/j_stop_frames/f_0104.png` | overlay f=103, device 12:48:06.223: "Evidence sealed" (first frame) |
| `rec/j_stop_frames/f_0105.png` | overlay f=104, device 12:48:06.237: "Evidence sealed", Open summary |

Other assets:

| File or folder | Content |
|---|---|
| `rec/j_stop.mp4` | the 1280 × 800 `screenrecord --bugreport` clip of the web stop (131 frames, 12:47:55–12:48:28 device time) |
| `rec/j_stop_frames/` | every frame of the clip (131 PNG, `-fps_mode passthrough`) |
| `rec/j_stop_frame_pts.txt` | frame file → presentation time |
| `core_log_lane2_window.txt` | lane-2 Core request lines 12:42:50–13:11:00 (time, method, route, status, client tag) |
| `jslog_tablet_full.txt` | the tablet's `[DEMS-LIVE]` request lines since the relaunch (41) |
| `jserr_tablet_full.txt` | error-filter lines of the tablet JS log (0) |
| `jswarn_tablet_full.txt` | `W/` and `E/ReactNativeJS` lines (1, Reanimated) |
| `q/` | tablet command files, outputs, `events.log`, uiautomator dumps |
| `wq/` | web command files, outputs, `events.log`, scrubbed API answers, `net_final.txt` |
| `misc/web_chrome_launch.txt`, `misc/o2_install_update_enabled_attr.txt`, `misc/r2_sessions_start_enabled_attr.txt` | browser ownership record; `enabled` attributes |
| `drivers/` | `rt_drive_q.mts.txt`, `rt_web_q.mjs.txt`, `corelog.mjs.txt`, `qsend.mjs.txt`, `chrome_launch.sh.txt`, `scan.mts.txt`, driver consoles, T0 |

---
*Generated: 2026-10-06 13:25*
