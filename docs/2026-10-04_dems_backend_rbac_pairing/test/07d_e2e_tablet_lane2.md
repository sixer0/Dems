---
task_id: E2E-T
task_slug: e2e-tablet-lane2
date: 2026-10-06
agent: verifier
decision_refs: [D191, D194]
status: needs-review
narrative_tier: 2
assets: test/assets/e2e/t_tablet/
---

# E2E-T — every tablet screen in Live mode, and a cross-client recording journey (lane 2)

## 1. Environment

| Item | Value | How verified |
|---|---|---|
| Device | `dems2_tablet`, adb serial `emulator-5556`, 2560 × 1600, density 320 (tablet landscape layout: navigation rail + list/detail panes) | `adb -s emulator-5556 shell wm size` / `wm density` |
| App | `com.dems.demo.tablet` (debug build, JavaScript from Metro 8081) | `pm list packages \| grep -i dems` |
| Launch | `am start -a android.intent.action.VIEW -d 'demsdemo:///login?core=LIVE&motion=off' com.dems.demo.tablet` (URL single-quoted in one device-shell string) | `drivers/t_drive_q.mts.txt`, `link` verb |
| Reverse rules (unchanged, start and end) | `tcp:8081 → 8081`, `tcp:4420 → 4422` | `adb -s emulator-5556 reverse --list` at 09:38 and 10:58 |
| Core server | lane 2, `http://127.0.0.1:4422`, `dems-core-server` 0.2.0, api v1, database ready, engine ready | `GET /api/v1/health` 09:38:04 (`"status":"ok"`) |
| Web console | `http://127.0.0.1:5177` (Live, Vite proxy to 4422) | `GET /` 200; `/api/v1/health` via 5177 200 |
| Browser | Playwright-cache `chromium_headless_shell-1243` (HeadlessChrome 153.0.8010.12), fresh profile in `$TMPDIR/e2e_t_chrome_profile` (removed at the end), raw CDP on 127.0.0.1:9476, viewport 1600 × 1000 | `web/chrome_launch.txt`; `wq/events.log` line 1 |
| Network origins of the page | `http://127.0.0.1:5177` (1,114 requests) and `ws://127.0.0.1:5177` (5 sockets) in the final window; one `data:image/svg+xml` inline icon (no network). No `localhost`, no other host | `wq/net_final.txt` last lines; `wq1/net_signin.txt` |
| Operators | `budi.santoso` INVESTIGATOR (OPR-001), `andi.pratama` SUPERVISOR (OPR-002), `rina.wijaya` TECHNICIAN (OPR-003); password read from `packages/shared/src/sim/dataset.ts` by the drivers, never printed | drivers; secret scan §8 |
| Load guard | 1-minute load above 14 twice (22.02 at 09:52, 23.56 at 09:59): paused 70 s and 120 s until below 14 | `drivers/load_pauses.txt` |
| Window | Part A 09:43–10:29, Part B 10:30–10:58 (second short latency run R2 10:52–10:56), end state 11:04 | driver event logs `q/events.log`, `q2/events.log`, `wq*/events.log` |

Method: two queue drivers. The tablet driver (`drivers/t_drive_q.mts.txt`, adapted from W67's `67_drive_q.mts.txt`) runs one numbered command file at a time after the previous screencap was read; it taps only when the app has the focus and no keyguard shows, types the password only when the IME's `curEditorInfo` of the app is a password field, and refuses any screencap between the password and a `sign-in 200`. The web driver (`drivers/t_web_q.mjs.txt`, adapted from the W65/W69 lane CDP drivers) does the same for the console. Server-backed values were checked against the Core API through the 5177 page's own same-origin `fetch` (answers stored in `wq*/api_*.json`, token shapes and the password scrubbed). Core log lines come from `.cache/manual/lane2-server.log` (method, route, status only) through `drivers/corelog.mjs.txt`, which tags a line `[tablet]` when its request ID is one the app logged as `[DEMS-LIVE] METHOD path status requestId` in logcat. Full extract: `core_log_lane2_window.txt` (221 request lines); the app's own request lines: `jslog_tablet_full.txt` (77 lines).

## 2. Summary

| Measure | Result |
|---|---|
| Part A screens | **36 / 38** reached and captured in the tablet layout (§3); 2 not reachable under this row's rules (Session Recovery needs a fault or scenario injection, forbidden on lane 2; Developer gallery is a debug-only sample page, not opened). Server-backed value matched on every reached screen that shows one |
| Part B journey | **10 / 10 steps executed**, 9 PASS, 1 PASS with a defect in the record (custody actor, E2E-T-3) (§4) |
| Back-guard | PASS — "Recording continues on the Core. Leave the monitor?" with "Stay on monitor" / "Go to Home" (`B14`), Stay kept the monitor (`B15`) |
| Key timings | Tablet create → web Dashboard shows the session: **+20 ms** after the Core's `POST /session 201`; tablet Start → web Dashboard shows `REC 00:00:00`: **+41 ms** (R2); web note → on tablet timeline: **≤ 2.4 s** (first capture); web stop → tablet leaves Live: **0.9–1.4 s** (R2) / **≤ 2.3 s** (run 1); Core sealed → web SEALED: **+0.11 / +0.15 s**; Core sealed → tablet "Evidence sealed": **+4.19 / +4.69 s** (E2E-T-4) |
| Value parity web ↔ tablet ↔ Core API | 4 track SHA-256, manifest hash, signature, case, subject, investigator, room, times, duration, size, status and custody entries **identical on both clients and in the API** (§4.2) |
| Defects | **7** (0 High, 3 Medium, 4 Low) — §5 |
| End state | Tablet app in LIVE mode, signed out, on Login ("Core online", "Core: DEMS-IR-01 • paired as DEV-0001", `99_final_login_live_signed_out.png`, 11:04:49); web signed out (`POST /auth/sign-out 204`, then `GET /auth/session 401`); no session recording (last session `SES-20261006-0026` SEALED at 10:54:48; no `POST /session` or `/start` in the Core log after 10:54:01); headless browser stopped, profile removed; reverse rules unchanged |

## 3. Part A — every mobile screen in the tablet layout

INVESTIGATOR (`budi.santoso`) unless the row says otherwise. "Core log" = the lane-2 request lines of that step (`[tablet]` lines only unless noted; the app's keep-alive `POST /api/v1/auth/touch 200` runs about once a minute and is listed once).

| # | Screen | How reached | Server-backed value checked | Result | Screencap | Core log lines |
|---|---|---|---|---|---|---|
| A1 | Login (LIVE) | deep link `login?core=LIVE&motion=off` after `am force-stop` (cold) | "Core online", "Core: DEMS-IR-01 • paired as DEV-0001" = `GET /pairing/device 200`; no role chip, no pairing-code hint | PASS | `01_login_live_cold.png`, `02_login_username_filled.png` (password empty) | 09:43:39.736 `GET /api/v1/auth/session 401`; 09:43:39.743 `GET /api/v1/pairing/device 200`; 09:43:40.044 `GET /api/v1/auth/status 200` |
| A2 | Sign-in + biometric offer | username typed (IME 0x80001), password typed only into IME 0x80081, keypad Go | `POST /auth/sign-in 200`; offer "Enable biometric sign-in on this tablet?" → **Not now** (nothing enrolled) | PASS | `03_biometric_offer.png` | 09:44:07.663 `POST /api/v1/auth/sign-in 200` |
| A3 | Session Summary (auto-opened) | after sign-in the app opened the unacknowledged summary of SES-20261005-0024 (left by row W65) | SES-20261005-0024 SEALED, LP/2026/1005-0008, Ahmad Fauzi, EV-20261005-0014 = `GET /evidence/EV-20261005-0014` and `GET /session/current` | PASS | `04_summary_after_signin.png`, `05_summary_prior_session_bottom.png` | 09:46:41.521 `POST /api/v1/session/:id/summary/acknowledge 204` (Done) |
| A4 | Home | Done on the Summary | "0 Items sealed today", recent EV-20261005-0014 / -0013 / -0012, "Storage: 20% used" = `GET /evidence` (14 items, newest -0014) and `GET /storage/status` (`usedPercent` 20) | PASS | `06_home_investigator.png` | touch only |
| A5 | Sessions hub | rail → Sessions | filter counts All 14 / Sealed 13 / Incomplete 1 / Today 0 = `GET /session/history` (14: 13 SEALED, 1 INCOMPLETE SES-20261003-0016 POWER_FAIL) | PASS | `07_sessions_hub.png`; dump `q/sessions_hub.txt` | touch only (list from the live snapshot) |
| A6 | Session detail | row SES-20261005-0024 | case, subject, investigator, room, start 22:40:38, end 22:40:53, 00:00:15, 35.3 MB, EV-20261005-0014 = `GET /session/current` / `GET /evidence/{id}` (`durationMs` 15515, `sizeBytes` 35,339,722) | PASS | `08_session_detail.png`, `08b_session_detail_scrolled.png` | touch only |
| A7 | Evidence list | rail → Evidence | 14 rows, newest EV-20261005-0014 Sealed = `GET /evidence` `items.length` 14 | PASS | `09_evidence_list.png`; dump `q/evidence_list.txt` | touch only |
| A8 | Evidence detail — Media | row EV-20261005-0014 | "No DEMO media for this item on this device" = API `media.source "NONE"` | PASS (see E2E-T-1: a red LogBox error appeared over this screen) | `10a_evidence_tab_media.png`, `11_logbox_touch_core_offline_error.png` | 09:52:25.521 `GET /api/v1/evidence/:id 200` |
| A9 | Evidence detail — Metadata | tab Metadata | header facts match the API; tab body only "No DEMO package for this item: the manifest is not on this device." (E2E-T-6) | PASS (parity gap Low) | `10c_evidence_tab_metadata.png`, `10d_…_scrolled.png` | none |
| A10 | Evidence detail — Hash & Integrity | tab Hash & Integrity, scrolled | manifest `d0daa3a3…303b85d2`, signature `8dd88547…92a686a`, KEY-EVSIGN-01, track VIDEO-01 `d4a2af9a…`, custody Sealed 22:41:01 System / Recording stopped / started 22:40:38 by AKP Andi Pratama = API `custody` (OPR-002) | PASS | `10e`, `10f`, `10g`, `10h_evidence_hash_*.png`; dump `q/evidence_more_menu.txt` | none |
| A11 | Evidence — More menu | More | Verify / Archive (disabled "Archiving needs the Supervisor role") / Download manifest; RBAC: EVIDENCE_REVIEW not granted to INVESTIGATOR (`GET /rbac/matrix`) | PASS | `10i_evidence_more_menu.png` | none |
| A12 | Devices list | rail → Devices | Camera 1/2 Online, MIC 1/2 Online, PoE Switch "1 active · 1 spare", Recording Indicator, Tablet Control Connected = `GET /device/inventory` | PASS on retry; **first attempt blank > 4 min (E2E-T-2)** | `12_devices_blank_after_7min.png`, `misc/paint_probe_a…i.png`, `12_devices_list.png` (= `12c`) | touch only |
| A13 | Device detail (Camera 1) — Overview / Health / Log | row Camera 1, tabs | CAM-01 Online, model "Dual-lens IP camera DL-2 (lens 1)", firmware 3.8.14, PoE CAM 1, 1080p · 25 fps · H.264 = inventory `cameras[0]`; Log "10:09:06 Device command sent · Test signal" | PASS | `14_device_detail_cam01.png`, `14e_device_tab_health.png`, `14f_device_tab_log.png`; `14i_device_detail_poe_switch.png` (18.6 W of 60 W = `GET /network/status` `poe.drawW` 18.6, `budgetW` 60) | — |
| A14 | Device actions | Test signal → confirm; Restart; Diagnostics | Test signal: `POST /device/:id/test-signal 204` + audit #113 `DEVICE_COMMAND {"command":"TEST_SIGNAL"}` OPR-001; Restart disabled "Requires the Technician role" (DEVICE_MANAGE = TECHNICIAN only); Diagnostics 8 / 8 PASS + audit #114 `DIAGNOSTICS_RUN` | PASS | `14b_device_test_signal_dialog.png`, `14c_…_result.png`, `14d_device_restart_disabled_tap.png`, `14g_device_diagnostics.png`, `14h_device_diagnostics_done.png` | 10:09:06.834 `POST /api/v1/device/:id/test-signal 204`; 10:09:53.269 `POST /api/v1/system/diagnostics 202` |
| A15 | More | deep link `demsdemo:///more` | AKP Budi Santoso · Investigator · OPR-001 · "Signed in 09:44" = `GET /admin/users` `lastSignInAt` 09:44:07; Pairing "Paired · Core: Interview Room 1"; footer "Core Live · Data from the Core server" | PASS | `15_more.png` | touch only |
| A16 | Storage | rail → Storage | 20 % used, 3.2 TB free of 4.0 TB, 804 GB used, retention 90 days = `GET /storage/detail` (HDD-EVIDENCE 804,035,339,722 of 4,000,000,000,000; `retention.days` 90) and web Dashboard (20 %, 3.2 TB) | PASS | `13_storage.png` | touch only |
| A17 | Network & Time | rail → Network & Time | LAN Connected, PoE Active, NTP server 192.168.10.1, GNSS active, UTC+07:00 = `GET /network/status` / `GET /time/status` (`ntp.server` 192.168.10.1, `source` GNSS, locked); clock seconds held at :00 by `?motion=off` (by design, O-3) | PASS | `16_network_time.png`, `16b_network_time_clock_check.png` | touch only |
| A18 | Audit | rail → Audit; entry #113; Verify | HEAD `65d8ef27`, 114 entries = `GET /audit/chain` (`head 65d8ef27…`, `checked 114`, stored ok); Verify → "PASS Checked 114 entries at 10:13:40 · Stored chain verified through entry #114"; entry #113 JSON = audit row #113 | PASS | `17_audit.png`, `17b_audit_entry_and_verify.png` | 10:13:37.251 `GET /api/v1/audit/chain 200` |
| A19 | Settings — App Preferences | rail → Settings | Core link source **Live** selected; presentation mode off | PASS | `18_settings.png` | none |
| A20 | Settings — Notifications | row | local alert toggles ("Saved on this console only (demo)") — no server value | PASS (n/a value) | `18b_settings_notifications.png` | none |
| A21 | Settings — Security & Privacy | row | biometric off (declined), auto-lock fixed 15 min "by the demo policy"; Core pairing Paired | PASS | `18c_settings_security_privacy.png` | none |
| A22 | Settings — Device Settings | row | opens the Devices screen (same data as A12) | PASS | `18d_settings_device_settings_opens_devices.png` | none |
| A23 | Settings — Storage Management | row | opens the Storage screen (`screen-storage`, same data as A16) | PASS | `18e_settings_storage_management.png` | none |
| A24 | Settings — Network & Time | row | opens the Network & Time screen (`screen-network-time`) | PASS | `18f_settings_network_time.png` | none |
| A25 | Settings — System Maintenance | row | "Last run 10:09:56: 8 passed" = the A14 run; "Your role does not include the demo controls" (DEMO_CONTROL = SUPERVISOR only); Install update shown (O-2, not pressed) | PASS | `18g_settings_system_maintenance.png` | none |
| A26 | Settings — About DEMS | row | v2.4.1, DEMS-IR-01, serial DEC-2026-IR01-000117, BSP 6.1.57 / DT r3, TPM fw 7.2.3.1, PRV-2026-0117 = `GET /device/inventory` `identity` | PASS | `18h_settings_about.png` | none |
| A27 | Settings — Account / Profile sheet | account row | permissions Start sessions, Add notes and markers, View evidence, Run diagnostics = RBAC grants of INVESTIGATOR (SESSION_START, SESSION_NOTE, EVIDENCE_VIEW, DIAGNOSTICS_RUN) | PASS | `18i_settings_account_profile.png` | none |
| A28 | Stack Check | deep link `demsdemo:///stack-check` | "core-server v0.2.0 · api v1", heartbeat Live = `GET /health` (`version 0.2.0`, `apiVersion v1`) | PASS | `19_stack_check.png` | 10:20:23.893 `GET /api/v1/health 200` |
| A29 | Sign out → Login | More → Sign out | "You have been signed out." + Core online | PASS | `20_signout_step.png` | 10:21:00.646 `POST /api/v1/auth/sign-out 204`; 10:21:02.231 `GET /api/v1/auth/status 200` |
| A30 | TECHNICIAN sign-in | `rina.wijaya`, same password procedure | `POST /auth/sign-in 200` | PASS | `21_login_technician_username.png` (password empty), `22_technician_after_signin.png` | 10:22:01.588 `POST /api/v1/auth/sign-in 200` |
| A31 | TECHNICIAN Home | after sign-in (no biometric offer this time) | same Home as A4; Start Session not disabled (consistent with spec 04 §6.3, O-1) | PASS | `22_home_technician.png` | — |
| A32 | TECHNICIAN Start Session (refused) | `session/new?step=1`, scan, Tersangka, name, Next | Core refuses: `POST /session 403`; toast "Not permitted · Requires the Investigator role" + inline "The session could not be created · Your role cannot start sessions"; Discard leaves (no session created) | PASS | `22_technician_session_create_refused_403.png` (= `22j`), `22f`, `22g`, `23a_technician_leave_wizard.png` | 10:26:25.175 `POST /api/v1/session 403` |
| A33 | TECHNICIAN More | deep link `/more` | Rina Wijaya · Technician · OPR-003 · "Signed in 10:22" | PASS | `23_more_technician.png` | touch only |
| A34 | TECHNICIAN device detail | rail → Devices → Camera 1 | Restart **enabled** for TECHNICIAN (DEVICE_MANAGE) vs disabled for INVESTIGATOR (A14) | PASS | `23b_technician_device_detail_restart_enabled.png` | touch only |
| A35 | Sign out (TECHNICIAN), back to budi.santoso | More → Sign out; force-stop; cold launch; sign-in budi; Not now | `POST /auth/sign-out 204`; `POST /auth/sign-in 200` | PASS | `24_signed_out_after_technician.png`, `25_login_fresh_partB.png`, `26_partB_signed_in_offer.png` | 10:28:49.302 `POST /api/v1/auth/sign-out 204`; 10:31:34.597 `POST /api/v1/auth/sign-in 200` |
| A36 | Pairing details | Login → "Pairing details" (read-only; Unpair not touched) | "Paired with DEMS-IR-01 as DEV-0001", paired at 4 Oct 2026 21:15:24 | PASS | `28b_pairing_details.png`; dump `q/pairing_details.txt` | none |
| A37 | Session Recovery | — | needs an interrupted session (fault or scenario injection) — forbidden on lane 2 | NOT RUN (rule) | — | — |
| A38 | Developer gallery | — | debug-only component samples, no server value | NOT RUN | — | — |

The Part B screens (Start Session steps 1–3, countdown, Live monitor, back-guard dialog, Finalizing, Evidence sealed, Summary) are in §4.

## 4. Part B — cross-client recording journey

### 4.1 Steps

Times are host-clock local (UTC+07:00); "Core" = the lane-2 Core log time of the request's completion; delays are against that line.

| Step | Action | Expected | Observed (timestamps, delay ms) | Result | Captures | Audit row |
|---|---|---|---|---|---|---|
| B1 | Tablet (budi): Home → Start Session; scan case number, Tersangka, "Siti Rahmawati"; Next | session created, 8 checks, Ready | Core `POST /session 201` 10:33:22.789, `POST /session/:id/precheck 202` 10:33:23.046; "All checks passed, 8 of 8"; Ready: LP/2026/1006-0009, Siti Rahmawati, AKP Budi Santoso, Interview Room 1, Standard 1080p/25 | PASS | `B00`, `B01`, `B02`, `B05_wizard_step2_devices_check.png`, `B06_wizard_step3_ready.png` | #124 `SESSION_CREATED` OPR-001 10:33:22 (`6067efbd`); #125 `PRECHECK_PASSED` 10:33:26 |
| B2 | Web (andi, SUPERVISOR) Dashboard open before B1 | the session appears within 2 s | Dashboard "Session setup in progress · SES-20261006-0025 · Pre-check 0 of 8" at **10:33:22.809 = +20 ms** after `POST /session 201` | PASS | `B03_web_dashboard_session_appears.png`; `wq/002.out` | — |
| B3 | Tablet: Start Recording (3-2-1 on) → Live | Live monitor; web shows REC within 2 s with the timer and meters moving | Core `POST /session/:id/start 200` 10:36:59.115; tablet monitor "Active Session SES-20261006-0025 · Recording 00:00:02" at 10:37:03; web socket `delta` frames at 10:36:59.117 / .172; Dashboard REC card + hero "SESSION IN PROGRESS · REC 00:01:2x" (`B04`, 10:38:23). Precise Dashboard REC latency measured in R2: Core start 10:54:01.035 → Dashboard `REC 00:00:00` at **10:54:01.076 = +41 ms**. Session Monitor (in-app navigation 10:38:48.375 → RECORDING at 10:38:48.654): readings 10:38:51 duration 00:01:51, MIC 1 −52 / MIC 2 −18 dBFS; 10:38:55 duration 00:01:55, MIC 1 −51 / MIC 2 −18 (timer +4 s, MIC 1 meter moved). R2: 00:00:23 (−17/−52) → 00:00:26 (−16/−52) | PASS | `B07_countdown.png`, `B08_tablet_live_monitor.png`, `B04_web_dashboard_recording.png`, `B09_web_session_monitor_1.png`, `B10_web_session_monitor_2.png`, `R2_03_web_dashboard_rec_first.png`, `R2_04_…_plus3s.png`, `R2_06/07_web_monitor_*.png` | #126 `RECORDING_STARTED` OPR-001 10:36:59 (`405a83f7`) |
| B4 | Web: Session Note "Supervisor note E2E-T: confirm subject ID before questioning" → Save | the note shows on the tablet | web Save 10:39:51.398; Core `POST /session/:id/notes 204` 10:39:51.424; tablet timeline "10:39:51 Investigator Note Added · Investigator note · Supervisor note E2E-T: confirm subject ID before questioning" in the **first** probe capture at 10:39:53.803 (**≤ 2.38 s**) | PASS (label Low, E2E-T-5) | `B11_web_note_drawer.png`, `B13_web_note_saved.png`, `B12a_tablet_note_probe.png` | #152 `NOTE_ADDED` OPR-002 10:39:51 (`c3dc155f`), `noteId NOTE-000010`, length 60 |
| B5 | Tablet back-guard: back arrow on the Live monitor | guard dialog | "Recording continues on the Core. Leave the monitor?" — Stay on monitor / Go to Home (10:40:37); Stay → monitor kept, recording 00:03:36+ | PASS | `B14_back_guard_dialog.png`, `B15_back_guard_stayed.png` | — |
| B6 | Web: End Session, reason "Interview completed (E2E-T web stop by supervisor)", confirm | tablet leaves Live → Finalizing → Summary | web confirm 10:41:32.863; Core `POST /session/:id/stop 202` 10:41:32.883; tablet: first probe 10:41:35.174 already off Live (transition frame); Finalizing 0 % at 10:41:36.391 (+3.5 s); 83 % at 10:41:43.077; "Evidence sealed EV-20261006-0015 · Sealed 6.9 s after the recording ended" at 10:41:43.927; Summary 10:41:47.781. Web finalization modal SEALED at 10:41:39.890 (Core `sealedAt` 10:41:39.740, +0.15 s). R2: Core stop 10:54:41.931; tablet still Live at 10:54:42.834 (+0.90 s), off Live at 10:54:43.363 (+1.43 s), Finalizing 10:54:45.732, sealed screen 10:54:53.245 (Core sealed 10:54:48.559, +4.69 s); web SEALED 10:54:48.671 (+0.11 s) | PASS (tablet seal lag Low, E2E-T-4) | `B16_web_end_dialog.png`, `B17_stop_probe_01…24.png`, `B19_tablet_finalizing_0pct.png`, `B19b_tablet_finalizing_83pct.png`, `B20_tablet_evidence_sealed.png`, `B21_tablet_summary.png`, `B21b/c`, `B18_web_sealed.png`, `R2_08_stop_probe_01…16.png`, `R2_09_web_sealed.png` | #170 `RECORDING_STOPPED` **OPR-002** 10:41:32 (`089d372e`), reason as typed, `durationMs` 273768; #171 `EVIDENCE_SEALED` 10:41:39 (`738bbe49`) |
| B7 | New evidence in web Evidence and tablet Evidence | EV-20261006-0015 on both | web modal "View in Evidence" → `/evidence/EV-20261006-0015` (10:43:31); web list row "Archived" later (`B40`); tablet Summary → "View in Evidence" (Core `summary/acknowledge 204` 10:45:29.435, `GET /evidence/:id 200` 10:45:30.764): list top row EV-20261006-0015 Sealed, detail opened | PASS | `B22_web_evidence_list.png` (modal), `B23_web_evidence_detail.png`, `B40_web_evidence_list.png`, `B26_tablet_evidence_detail_new.png` | #172 `SUMMARY_ACKNOWLEDGED` OPR-001 10:45:29 |
| B8 | Open on both: metadata, integrity/hash, chain of custody | values match | §4.2: all values identical on web, tablet and `GET /evidence/EV-20261006-0015`; custody actor of RECORDING_STOPPED is wrong in the record (both clients faithfully show it) | PASS / defect E2E-T-3 | `B24_web_evidence_metadata.png`, `B25_web_evidence_integrity.png`, `B27_tablet_evidence_metadata.png`, `B28_tablet_evidence_hash_integrity.png`, `B28b_tablet_evidence_track_hashes.png`, `B29_tablet_evidence_custody.png`, `B21c_tablet_summary_bottom.png` | — |
| B9 | Web (SUPERVISOR) review: **Verify** | verdict on web; change visible on tablet | Core `POST /evidence/:id/verify 200` 10:47:45.552; web "PASS · 6 of 6 checks", custody "VERIFIED · AKP Andi Pratama"; tablet custody "Verified by the Core, 6 Oct 2026 10:47:45 · AKP Andi Pratama" (seen at 10:48:22, the first look at that section; no new `GET /evidence` — pushed over the socket) | PASS | `B30_web_evidence_verified.png`, `B31c_tablet_custody_after_web_verify.png` | #173 `EVIDENCE_VERIFIED` OPR-002 10:47:45 (`fc9fcf15`), `manifestOk true`, `signatureOk true`, `failedTracks ""` |
| B10 | Web (SUPERVISOR, EVIDENCE_REVIEW) review: **Archive** | status change on tablet | Core `POST /evidence/:id/archive 204` 10:48:57.367 (web archives straight from the More menu, O-4); tablet list chip and detail "Archived", custody "Archived, 10:48:57 · AKP Andi Pratama" in the first capture at 10:49:13.870 (≤ 16.5 s; no new `GET` — pushed) | PASS | `B32_web_evidence_more_menu.png`, `B33_web_archive_confirm.png` (toast "EV-20261006-0015 archived"), `B35a_tablet_after_web_archive.png`, `B35b_tablet_after_web_archive_top.png` | #174 `EVIDENCE_ARCHIVED` OPR-002 10:48:57 (`f4da4206`), `retentionPolicy DAYS_90` |

Security & Audit on the web (`/security-audit`, filtered by `SES-20261006-0025`, 49 of 174 entries) shows rows #124 Session created, #125 Pre-check passed, #126 Recording started (AKP Budi Santoso), #170 Recording ended (AKP Andi Pratama), #171 Evidence sealed, #172 Summary acknowledged, #173 Evidence verified, #174 Evidence archived, every row "Linked" (`B36_web_security_audit_table.png`, `B38_web_audit_session_start_rows.png`; API copies `wq/api_1791258287277.json`, `wq/api_1791258584389.json`, `wq/api_1791258584397.json`). Chain head after the journey: `f4da4206a0d039be…` (174 entries).

### 4.2 Value parity for EV-20261006-0015 (SES-20261006-0025)

| Value | Core API (`GET /evidence/EV-20261006-0015`) | Web | Tablet | Match |
|---|---|---|---|---|
| Case / subject / type | LP/2026/1006-0009 · Siti Rahmawati · TERSANGKA | same (`B23`) | same (`B26`) | yes |
| Investigator / room | OPR-001 · Interview Room 1 | AKP Budi Santoso · Interview Room 1 | AKP Budi Santoso · Interview Room 1 | yes |
| Recorded / ended / sealed | 10:36:59.107 / 10:41:32.875 / 10:41:39.740 | 10:36:59 – 10:41:32 | 10:36:59 – 10:41:32; Summary "Sealed 6 Oct 2026 10:41:39" | yes |
| Duration / size | 273,768 ms / 623,582,667 B | 00:04:33 / 624 MB | 00:04:33 / 623.6 MB | yes (rounding) |
| VIDEO-01 SHA-256 | `3e21bfe8f015ff7d…236802b6ba7a46cc` | `3e21bfe8f015ff7d…236802b6ba7a46cc` | `3e21bfe8f015ff7dac6a71286a78de084b9dbc1f9504c112236802b6ba7a46cc` | yes |
| VIDEO-02 SHA-256 | `435b8f01db8d5af7…cc0340d3cd777d8d` | same | same (full value in dump) | yes |
| AUDIO-01 SHA-256 | `17717bfb63b937d6…08e4b2a49b62aca2` | same | same | yes |
| AUDIO-02 SHA-256 | `8ccdfe8d8b058475…66bb4668377d6c25` | same | same | yes |
| Manifest hash | `91643f0adadc1d3efe14d8320200154ee5e848a87e8f321d5107a937a051b90c` | same | same | yes |
| Signature (simulated) / key | `65055de400a12c8d…f6daf7275425ea11` / KEY-EVSIGN-01 | same | same | yes |
| Custody | RECORDING_STARTED OPR-001; RECORDING_STOPPED **OPR-001** (detail = the web reason); SEALED system; later VERIFIED OPR-002, ARCHIVED OPR-002 | same five entries | same five entries | yes between clients; **record disagrees with audit #170 (OPR-002)** → E2E-T-3 |
| Note | NOTE-000010 by OPR-002 | on the monitor timeline | on the monitor timeline | yes |

## 5. Defects

| ID | Severity | Where | Expected | Observed | Repro | Evidence |
|---|---|---|---|---|---|---|
| E2E-T-1 | Medium | mobile Live runtime, keep-alive touch (`live-sim.ts` `touch` → `reportRejection`) | a background keep-alive that the Core answered is not shown as an error; at most a warning while the link stays ONLINE | a red LogBox error "The Core server is unreachable (CORE_OFFLINE)" over Evidence detail at 09:52:29, `level: 'error'`, `source: live.action.touch`, `errorCode: TIMEOUT`, `link: 'ONLINE'` — while the Core logged that touch `POST /api/v1/auth/touch 200` at 09:52:25.468 in 28 ms. The client's 8 s budget ran out because the JS thread was saturated (host load 22.02 at 09:52; `mqt_v_js` at 81–106 % CPU at 10:04). Plausibly the kind of "error message" the user reported in D191 (hypothesis) | sign in on the tablet in LIVE, keep the host loaded (load ≥ 20), wait for a touch to exceed 8 s | `11_logbox_touch_core_offline_error.png`, `11_logbox_touch_core_offline_logcat.txt`, `core_log_lane2_window.txt` 09:52:25.468 |
| E2E-T-2 | Medium | mobile tablet navigation rail → Devices | the Devices list renders | from Evidence detail (More menu just closed by a tap outside) → rail "Devices" at 09:59:21: content pane stayed **blank for more than 4 min** (captures 09:59:29–10:06:13), rail indicator still on Evidence, `uiautomator` found only the rail (no `screen-*` node), app frame counter frozen at 614 frames; tapping Storage rendered Storage at once, and Devices from Storage then rendered within 4 s. Not reproduced on the second attempt; host load 23.6 at the time | Evidence → row → More → tap outside → rail Devices (once) | `misc/paint_probe_a…i.png`, `12_devices_blank_after_7min.png`, `q/devices_list.txt`, `12b/12c_devices_retry_*.png` |
| E2E-T-3 | Medium | Core server, evidence custody of a session stopped by another operator | the RECORDING_STOPPED custody entry names who stopped (audit #170: OPR-002 AKP Andi Pratama) | custody `RECORDING_STOPPED actorId "OPR-001"` (AKP Budi Santoso, who started), detail = the supervisor's reason; both clients show "Recording stopped · AKP Budi Santoso". The two server records disagree on the actor | start on the tablet as budi.santoso, stop from the web Session Monitor as andi.pratama, compare `GET /api/v1/evidence/{id}` `custody` with `GET /api/v1/audit?sessionId=…` type RECORDING_STOPPED | `wq/api_1791258189285.json`, `wq/api_1791258287277.json` (#170), `B25_web_evidence_integrity.png`, `B29_tablet_evidence_custody.png` |
| E2E-T-4 | Low | mobile Finalizing screen | follows the Core's finalization | the tablet shows "Evidence sealed" **4.19 s / 4.69 s after** the Core sealed (web: 0.15 s / 0.11 s); before Finalizing a blank frame of about 2 s on both runs (10:41:35.174–35.778; 10:54:43.363–45.097) | stop from the web, capture the tablet every ~0.6 s | `B17_stop_probe_01…13.png`, `R2_08_stop_probe_02…13.png` |
| E2E-T-5 | Low | mobile Live timeline copy | a supervisor's note is labelled neutrally or with its author's role | "Investigator Note Added · Investigator note" for a note by OPR-002 (SUPERVISOR) | B4 | `B12a_tablet_note_probe.png`; API note `authorId OPR-002` |
| E2E-T-6 | Low | mobile Evidence → Metadata tab (Core-only item) | parity with the web Metadata tab, which shows the Core record (JSON) | tablet tab body only "No DEMO package for this item: the manifest is not on this device."; the facts are in the header card (and match) | open any `media.source NONE` item | `B27_tablet_evidence_metadata.png` vs `B24_web_evidence_metadata.png` |
| E2E-T-7 | Low (hypothesis) | mobile app process memory | steady memory over a long sitting | TOTAL PSS 1.41 GB (10:04) → 1.62 GB (10:25) → 1.71 GB (10:28), native heap 1.01 → 1.25 GB; 0.63 GB after force-stop and relaunch (10:30). May contribute to E2E-T-1/-2; debug build, cause not established | `dumpsys meminfo com.dems.demo.tablet` over a 45-min sitting | this report §5; commands in the drivers' session (read-only) |

### Observations (not counted as defects)

- **O-1** TECHNICIAN Home/More look the same as INVESTIGATOR's; Start Session stays enabled and the Core refuses with 403 + toast + inline error. Consistent with `masterplan/04_client_integration_spec.md` §6.3 (mobile "disabled, not removed" list = Start recovery, storage policy, device restart, archive, export). The role limit shows on Restart (enabled only for TECHNICIAN) and the refused create.
- **O-2** INVESTIGATOR sees "Install update" enabled in System Maintenance though `startSoftwareUpdate` needs MAINTENANCE (TECHNICIAN). Not pressed (it would change lane state). The mobile list of §6.3 does not include update; for the spec owner.
- **O-3** Network & Time clock shows seconds held at :00 — by design under `?motion=off` (`network-time-model.ts:127` `heldSecond`).
- **O-4** Web Archive from the detail More menu archives without a confirmation; the mobile app has "Archive {id}?" (`features/evidence/i18n.ts:171`). Parity note.
- **O-5** The web sign-in idle-expired at 10:00:34 and 10:20:56, 15 min after sign-in — scripted `fetch` calls are not user activity (auto-lock 15 min by policy).
- **O-6** The first Next press in the TECHNICIAN wizard right after dismissing the keyboard with BACK sent no request; the second press did (403). Likely the tap was consumed by the IME dismissal; procedure note.

## 6. State changes on lane 2 made by this row

Sessions SES-20261006-0025 (SEALED, evidence EV-20261006-0015 verified then **archived**) and SES-20261006-0026 (R2, SEALED, EV-20261006-0016); note NOTE-000010; summary acknowledgements of SES-20261005-0024 (left unacknowledged by W65), -0025 and -0026; one diagnostics run; one test signal on CAM-01; sign-ins/outs of the three operators. No reset, scenario, fault, role or operator change; no setup session left (the TECHNICIAN create was refused). Audit 114 → 174 entries + R2 rows; chain intact.

## 7. Screenshot index

Tablet captures are 2560 × 1600 `adb exec-out screencap -p`; web captures 1600 × 1000 CDP `Page.captureScreenshot`.

| File | Caption |
|---|---|
| `00_initial_state.png` | tablet before the row (Login, LIVE) |
| `01_login_live.png`, `01_login_live_cold.png` | Login LIVE (warm link; cold launch after force-stop) |
| `02_login_username_filled.png` | username typed, password empty |
| `03_biometric_offer.png` | biometric offer; Not now chosen |
| `04_summary_after_signin.png`, `05_summary_prior_session_bottom.png` | auto-opened Summary of SES-20261005-0024 |
| `06_home_investigator.png` | Home, INVESTIGATOR |
| `07_sessions_hub.png` | Sessions hub, filters All 14 / Sealed 13 / Incomplete 1 |
| `08_session_detail.png`, `08b_session_detail_scrolled.png` | session detail SES-20261005-0024 |
| `09_evidence_list.png` | Evidence list (14) |
| `10_evidence_detail.png`, `10a_evidence_tab_media.png`, `10b_…` | Evidence detail Media (first capture carries the LogBox of E2E-T-1) |
| `10c_evidence_tab_metadata.png`, `10d_…` | Metadata tab |
| `10e`–`10h_evidence_hash_*` | Hash & Integrity, lifecycle, chain of custody |
| `10i_evidence_more_menu.png` | Evidence More menu (Archive disabled for INVESTIGATOR) |
| `11_logbox_touch_core_offline_error.png` (+ `_logcat.txt`) | E2E-T-1 red error over Evidence |
| `12_devices_blank_after_7min.png`, `misc/paint_probe_*.png` | E2E-T-2 blank Devices pane and probes |
| `12_devices_list.png`, `12b_devices_retry_4s.png`, `12c_devices_retry_10s.png` | Devices list (retry) |
| `13_storage.png` | Storage |
| `14_device_detail_cam01.png`, `14e_device_tab_health.png`, `14f_device_tab_log.png`, `14i_device_detail_poe_switch.png` | device detail tabs; PoE switch |
| `14b_device_test_signal_dialog.png`, `14c_device_test_signal_result.png` | Test signal confirm and result |
| `14d_device_restart_disabled_tap.png` | Restart disabled for INVESTIGATOR |
| `14g_device_diagnostics.png`, `14h_device_diagnostics_done.png` | Run Diagnostics 4/8 → all passed |
| `15_more.png` | More, INVESTIGATOR |
| `16_network_time.png`, `16b_network_time_clock_check.png` | Network & Time |
| `17_audit.png`, `17b_audit_entry_and_verify.png` | Audit list; entry #113 + Verify PASS 114 |
| `18_settings.png` … `18i_settings_account_profile.png` | Settings sections A19–A27 |
| `19_stack_check.png` | Stack Check (core-server v0.2.0 · api v1) |
| `20_signout_step.png` | signed out → Login |
| `21_login_technician_username.png`, `22_technician_after_signin.png`, `22_home_technician.png` | TECHNICIAN sign-in and Home |
| `22b`–`22k_technician_*`, `22_technician_session_create_refused_403.png`, `23a_technician_leave_wizard.png` | TECHNICIAN wizard, 403 refusal, discard |
| `23_more_technician.png`, `23b_technician_device_detail_restart_enabled.png` | TECHNICIAN More; Restart enabled |
| `24_signed_out_after_technician.png`, `25_login_fresh_partB.png`, `26_partB_signed_in_offer.png` | back to budi.santoso |
| `28b_pairing_details.png` | Pairing details (read-only) |
| `B00`–`B08` | Part B tablet: Home, wizard steps, Devices Check 8/8, Ready, countdown, Live monitor |
| `B03_web_dashboard_session_appears.png`, `B04_web_dashboard_recording.png` | web Dashboard: setup in progress (+20 ms); recording |
| `B09_web_session_monitor_1.png`, `B10_web_session_monitor_2.png` | web Session Monitor 4 s apart |
| `B11_web_note_drawer.png`, `B13_web_note_saved.png`, `B12a`–`B12f_tablet_note_probe.png` | supervisor note; on the tablet timeline |
| `B14_back_guard_dialog.png`, `B15_back_guard_stayed.png` | back-guard dialog; Stay |
| `B16_web_end_dialog.png`, `B18_web_sealed.png` | web End Session; SEALED |
| `B17_stop_probe_01…24.png`, `B19_tablet_finalizing_0pct.png`, `B19b_tablet_finalizing_83pct.png`, `B20_tablet_evidence_sealed.png`, `B21_tablet_summary.png`, `B21b/c` | tablet after the web stop: transition, Finalizing, sealed, Summary (hashes) |
| `B22`–`B25` | web: sealed modal, evidence detail, Metadata, Hash & Integrity + custody |
| `B26`–`B29` | tablet: new evidence list/detail, Metadata, Hash & Integrity, custody |
| `B30_web_evidence_verified.png`, `B31a/b/c` | web Verify PASS; tablet custody "Verified by the Core" |
| `B32_web_evidence_more_menu.png`, `B33_web_archive_confirm.png`, `B35a/b` | web Archive; tablet "Archived" |
| `B36_web_security_audit*.png`, `B37_web_audit_filtered.png`, `B38_web_audit_session_start_rows.png` | web Security & Audit rows #124–#174 |
| `B39_tablet_sessions_hub_after_journey.png`, `B40_web_evidence_list.png` | both new sessions/evidence on both clients |
| `R2_01`–`R2_11` | second short run: Dashboard REC latency (+41 ms), monitor readings, stop probes, Summary |
| `W01`–`W03` | web Dashboard (supervisor), web Devices |
| `99_final_login_live_signed_out.png` | end state: LIVE, signed out, Login |

Other assets: `q/` and `q2/` (tablet command files, outputs, per-step screencaps, `uiautomator` dumps, `events.log`), `wq1/`, `wq2/`, `wq/` (web queue runs, network and socket-frame logs, scrubbed API answers), `core_log_lane2_window.txt`, `jslog_tablet_full.txt`, `jserr_tablet_full.txt`, `drivers/*.txt`, `misc/` (probe and mis-navigation captures: `misnav_18f/g/h` are taps meant for Settings rows that landed on the Devices screen, because the previous row (Device Settings) had already navigated there; repeated correctly afterwards), `web/chrome_launch.txt`.

## 8. Rules and secret check

- No PIN typed, no lock/fingerprint/`locksettings`/`emu finger`/settings change; keyguard never shown (`isKeyguardShowing=false` at every focus check and at 11:04). `device-session.sh` not used; only `emulator-5556` addressed; reverse rules unchanged. No server, Vite, Metro or emulator started or stopped; no reset/scenario/fault; no role or operator change; ports 4420/4421/4423/5173/5176/5178/5432 not touched; PostgreSQL not touched. No `uiautomator dump` while Login, Summary or Home showed. The app was never launched at `/` with `motion=`.
- Secret scan (count only, the password read from the dataset constant by `$TMPDIR/scan.mts`): **349 text files under `test/assets/e2e/t_tablet/`, password hits 0, `dvc_`/`ses_`/`bio_` token shapes 0** (11:05). Re-run at 11:10 over the asset folder, this report and `delegation_progress/e2e_t_tablet.md`: 362 text files, password hits 0, token shapes 0.
- No tracked file modified; no test suite run.

---
*Generated: 2026-10-06 11:10*
