---
task_id: R-W
task_slug: retest_web
date: 2026-10-06
agent: verifier
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (D201 re-test round)
inputs: decisions D197, D198, D201, D202, D204, D207; gateway_check/11a_efix_core.md, 11b_efix_web.md (incl. FX-W2); test/07a_e2e_web_supervisor.md and test/assets/e2e/w1_supervisor/ (before pictures); test/assets/e2e/w2_roles/25_investigator_dashboard_camera1_menu.png
narrative_tier: 2
status: needs-review
---

# R-W: web re-test after the E-fix round (lane 3)

I re-ran each web step that failed in the end-to-end round in a real headless browser, then walked every web page once. The browser was the Playwright-cache `chrome-headless-shell` 1243, driven over raw CDP. The target was lane 3: Core `http://127.0.0.1:4423` (`dems_lane_3`, demo controls on) and the Live web console `http://127.0.0.1:5178`. One Simulated-mode check ran on the main console `http://127.0.0.1:5173` by controller ruling, because mock-core accepts only that origin (§2, O-RW-6). Every result below is compared with the round-1 screenshot of the same step (the "before"). It is also checked against the Core's request log (`.cache/manual/lane3-server.log`, request lines only, extract `assets/retest/w_web/rw_core_requests.txt`) and the audit chain.

**Summary**

- **Targeted re-tests:** 10 of 10 PASS.
  - Lane 3: E2E-W1-2 as SUPERVISOR, E2E-W2-1 as INVESTIGATOR, E2E-W1-3, E2E-W1-4 in Live, E2E-W1-5, E2E-W1-6, E2E-W1-7, the note drawer and timeline title, and E2E-W1-1 (custody actor of the stop).
  - The SIMULATED half of E2E-W1-4 passed on the **main console `http://127.0.0.1:5173`**, by controller ruling (option (a), 13:00 WIB). It could not run on lane 3, for two reasons. At 12:31–12:34 WIB no mock-core ran on 4400. Once the controller started mock-core at 12:50, it refused the heartbeat WebSocket from the lane-3 origin `127.0.0.1:5178` with 403, because it accepts only `127.0.0.1:5173`, `localhost:5173` and its own origins (O-RW-6). The check on 5173 ran in a fresh, separate browser profile. No Live sign-in was made, and no request reached the Core 4420: the console's `/api/` and `/ws` paths were failed inside the browser. Result: EV-20261006-0012 in Simulated shows the bundled package as its metadata, with no "another record" notice.
- **Smoke walk:** 16 of 16 pages PASS. Every page had 0 console errors, 0 console warnings, 0 exceptions, and only page-origin network traffic.
- **Regression:** none found.
- **New finding:** R-W-1 (Low). At 1440x900 the chain-of-custody table overflows its card when a row has a multi-word Detail, so the stop reason is cut until scrolled sideways. The same overflow exists with the pre-fix CSS. The E2E-W1-7 fix adds 15 px to it.
- **Incident:** IN-RW-1, a process slip of mine (README line printed into my own tool output). Nothing was written to any file.

## 1. Environment

| Item | Value | Source |
|---|---|---|
| Core server | `dems-core-server` 0.2.0, API v1, `127.0.0.1:4423`, database `dems_lane_3`, `demoControls: true`. Booted 05:12:07Z (12:12:07 WIB) on the E-fix code | `lane3-server.log` line "configuration loaded"; `GET /api/v1/health` 05:22:48Z: `status ok`, uptime 641 s, `ws.clients 0` |
| Web console | `http://127.0.0.1:5178`, Live (Vite proxies `/api/v1` and `/ws` to 4423). Vite hot-reloaded the FX-W2 files at 12:13:04 to 12:13:36 WIB (`i18n/en/evidence.ts`, `paired-devices/devices-panel.tsx`, `devices/device-drawer.tsx`, `i18n/en/session.ts`, `session-monitor/action-bar.tsx`) | `.cache/manual/lane3-web.log` tail |
| Browser | `HeadlessChrome/153.0.8010.12`, `~/Library/Caches/ms-playwright/chromium_headless_shell-1243`, raw CDP, viewport 1440x900 (390x844, 1280x800 and 1920x1080 where stated) | `/json/version` in each run log |
| DevTools | One browser per run, `--remote-debugging-port=0`. The port was read from the profile's `DevToolsActivePort`. Before connecting, the listener was checked with `lsof -a -p <pid>` and `/json/version` had to name the spawned browser. Ports per run: 50127, 50363, 50540, 50719, 50999, 51202, 51590, 52133; 55210 for the 12:51 re-run; 58352 and 58754 for the two 5173 runs | `r*_log.txt` first line |
| Isolation | Fresh profile `/tmp/claude-501/rw_profile_*` per run, removed at close. After the last run (12:44), 0 profiles and 0 `chrome-headless-shell` processes were left (unsandboxed `ps`). After the 12:51 re-run, 0 `rw_profile_*` profiles and 0 headless processes of this row; the browsers running then belong to other rows' profiles and were not touched. CDP `Fetch` interception failed every request to an origin other than `http://127.0.0.1:5178`: 0 blocked in every run. WebSockets are not covered by `Fetch`, so they were recorded through `Network.webSocketCreated` | run logs; `*_console_network.json` |
| Host | Load average 3.6 to 7.6 before the runs (`uptime` before each run, peak 7.56 at 12:33), below 14 | `uptime` |
| Window | 05:26:05Z to 05:42:48Z (12:26 to 12:42 WIB): 8 browser runs. After the controller started mock-core: one more run, 05:51:32Z to 05:51:50Z (CDP port 55210; load 9.15 before it). On the main console (ruling (a)): 05:58:30Z to 06:00:08Z, two runs (load 4.93 and 5.71 before them) | `r*_log.txt` |
| Main console (one check only) | `http://127.0.0.1:5173`, granted by the controller for the Simulated check alone. The R-S pairing row was using 5173 in Live in its own browser; this row never touched that browser. Allowlist enforced in this row's browser (`rw_driver_rt_lib_main.mjs.txt`): `http://127.0.0.1:5173` without `/api/` and `/ws` (CDP `Fetch` plus `Network.setBlockedURLs`), and WebSockets only to `ws://127.0.0.1:4400/ws` and Vite's `ws://127.0.0.1:5173/` (a WebSocket constructor guard injected before any document) | `r4_simulated_main_console_network.json`; `rw_main_core_window.txt` |
| mock-core | `127.0.0.1:4400`, started by the controller at 12:50 WIB (log starts 05:50:12Z "Server listening"); node pid 66413 listening (`lsof`). Not stopped by this row | `.cache/manual/mock-core.log`; `rw_mockcore_ws_rejections.txt` |
| Core log | 114 request lines in the window: OPR-002 ×65, OPR-001 ×3, anonymous ×46. Statuses: 200 ×95, 202 ×1, 204 ×9, 401 ×9. All 9 401s are the signed-out `GET /auth/session` probe of a fresh Login page. 0 lines at warn or above. No principal other than this row's two operators | `rw_core_requests.txt`; level scan of `lane3-server.log` since 05:25Z |

| Run | UTC | Operator | Covers |
|---|---|---|---|
| `r1_sup_dashboard` | 05:26:05–05:26:38 | andi.pratama (SUPERVISOR) | E2E-W1-2, E2E-W1-5, E2E-W1-6 |
| `r1_inv_dashboard` | 05:28:15–05:28:36 | budi.santoso (INVESTIGATOR) | E2E-W2-1 |
| `r1_evidence_live` | 05:29:56–05:30:27 | andi.pratama | E2E-W1-3, E2E-W1-7, E2E-W1-4 (Live) |
| `r1_simulated_attempt1` | 05:31:22–05:32:56 | none (Sign In disabled) | E2E-W1-4 (Simulated): blocked; the run ended in Simulated |
| `r1_simulated` | 05:34:03–05:34:21 | none | E2E-W1-4 (Simulated): blocked; switched back to Live |
| `r1_simulated_mockcore` | 05:51:32–05:51:50 | none (Sign In disabled) | E2E-W1-4 (Simulated), re-run with mock-core up: still blocked (403 origin); switched back to Live |
| `r4_simulated_main_attempt1` | 05:58:30–05:58:56 | andi.pratama in **Simulated** on 5173 | Stopped at opening item 0012: a row press on a wide screen only selects the preview card (`list-page.tsx:192`). Profile removed; only the in-browser simulator was signed in |
| `r4_simulated_main` | 05:59:33–06:00:08 | andi.pratama in **Simulated** on 5173 | E2E-W1-4 (Simulated): PASS; signed out; selector back to Live |
| `r1_note_custody` | 05:35:54–05:36:52 | andi.pratama | note drawer and timeline title; E2E-W1-1 |
| `r2_smoke` | 05:39:08–05:40:44 | andi.pratama | Part 2 smoke walk |
| `r3_custody_probe` | 05:42:17–05:42:48 | andi.pratama | R-W-1 measurement (read-only) |

**Order chosen.** Loading the demo Recording scenario rebuilds the lane-3 dataset and discards the audit chain. So the evidence re-tests, which need the stored PASS on EV-20261006-0012, ran first, and the scenario run came after them.

## 2. Part 1: targeted re-tests

All "after" files are under `test/assets/retest/w_web/`. All "before" files are round-1 captures under `test/assets/e2e/`.

| Defect | Before (round-1 file) | After (new file) | Observed | Result | Log / audit line |
|---|---|---|---|---|---|
| **E2E-W1-2** Dashboard camera menu, SUPERVISOR | `w1_supervisor/08_dashboard_camera1_menu.png` (Test signal disabled, "Requires the Technician role") | `p1_w1_2_sup_camera1_menu.png`, `p1_w1_2_sup_camera1_menu_full.png`, `p1_w1_2_sup_test_signal_toast.png` | Camera 1 menu items: Details (enabled), **Test signal (enabled, no hint)**, Restart (disabled, "Requires the Technician role"). Pressed Test signal once and got the toast "Test signal sent to Camera 1". Reopened the menu afterwards: same three states | **PASS** | `05:26:18.285Z POST /api/v1/device/:id/test-signal 204 operator:OPR-002`; audit 123 `DEVICE_COMMAND` INFO OPR-002 CAM-01 "Test signal sent to Camera 1 (simulated)" 05:26:18.281Z |
| **E2E-W2-1** Dashboard camera menu, INVESTIGATOR | `w2_roles/25_investigator_dashboard_camera1_menu.png` (Test signal disabled) | `p1_w1_2_inv_camera1_menu.png`, `p1_w1_2_inv_camera1_menu_full.png`, `p1_w1_2_inv_test_signal_toast.png` | Signed in as budi.santoso (user menu "Role: Investigator"). Menu: Details enabled, **Test signal enabled**, Restart disabled with "Requires the Technician role". Pressed once and got the toast "Test signal sent to Camera 1" | **PASS** | `05:28:27.452Z POST /api/v1/device/:id/test-signal 204 operator:OPR-001`; audit 126 `DEVICE_COMMAND` OPR-001 CAM-01 05:28:27.449Z |
| **E2E-W1-3** Integrity card opens on the Core's stored verdict | `w1_supervisor/71_evidence_detail_integrity_after_reload.png` ("NOT VERIFIED, 0 of 6 checks" while the Core held PASS) | `p1_w1_3_integrity_on_open.png`, `p1_w1_3_integrity_on_open_full.png`, `p1_w1_3_integrity_after_reload.png`, `p1_w1_3_integrity_after_verify.png`, `p1_w1_3_integrity_after_verify_reload.png` | The Core record of EV-20261006-0012 held `verification {PASS, 05:03:06.900Z}`, last custody `VERIFIED` OPR-002 at the same instant. **On open**: chip PASS, `data-verdict-source="record"`, line "Last verification PASS · 6 Oct 2026 12:03:06 UTC+07:00 · AKP Andi Pratama", button "Verify again", hint "Verify again to see each check." **After reload** (`Page.reload`): identical. **Verify again**: toast "Integrity verified: EV-20261006-0012 PASS"; chip PASS with source `run`; the line moved to "… 12:30:11 UTC+07:00 · AKP Andi Pratama". The Core then held `{PASS, 05:30:11.861Z}` and custody went from 5 to 6 entries. **Second reload**: source `record`, line 12:30:11. The new run is the stored one | **PASS** | `05:30:11.866Z POST /api/v1/evidence/:id/verify 200 operator:OPR-002`; audit 129 `EVIDENCE_VERIFIED` OPR-002 05:30:11.861Z (previous: audit 120, 05:03:06.900Z) |
| **E2E-W1-4 (Live)** Metadata tab of EV-20261006-0012 | `w1_supervisor/66_evidence_detail_metadata.png`, `w1_supervisor/67_evidence_detail_metadata_document.png` (manifest of EV-20261001-0012 shown as this item's, no notice) | `p1_w1_4_live_metadata_tab.png`, `p1_w1_4_live_metadata_package_heading.png` | `data-package="foreign"`, `data-package-id="EV-20261001-0012"`. The first section (DOM order and left column, x=252) is "Record of this item" with the CORE RECORD chip. It opens with the notice "The bundled DEMO package is another record. This item plays the demo media of the bundled package EV-20261001-0012 (session SES-20261001-0022, recorded 1 Oct 2026). Its documents describe that package, not this item. This item's metadata is the Core record." Under it is the Core JSON (`"record": "CORE"`, EV-20261006-0012, SES-20261006-0022, LP/2026/1005-0004). The second section (x=837) is headed "Bundled DEMO package · EV-20261001-0012" with the DEMO chip and the documents manifest.json, metadata.json, signature.sig, audit extract. No manifest-fields block. Header chip `demo` | **PASS** | reads only (`GET /api/v1/evidence/:id 200`) |
| **E2E-W1-4 (SIMULATED)** FX-W2 ruling: the package is the item's own metadata, no notice | none (ruling D204/D207, proven in vitest only) | Run 1 (no mock-core, 12:34): `p1_w1_4_sim_01_login_live_selector.png`, `p1_w1_4_sim_02_switch_to_simulated_dialog.png`, `p1_w1_4_sim_03_login_simulated.png`, `p1_w1_4_sim_05_switch_to_live_dialog.png`, `p1_w1_4_sim_06_login_live_again.png`. Run 2 (mock-core up, 12:51): `p1_w1_4_simok_01_login_live_selector.png`, `p1_w1_4_simok_02_switch_to_simulated_dialog.png`, `p1_w1_4_simok_03_login_simulated.png`, `p1_w1_4_simok_05_switch_to_live_dialog.png`, `p1_w1_4_simok_06_login_live_again.png`. **Main console 5173 (13:00, the result):** `p4_main_sim_01_login_simulated.png`, `p4_main_sim_02_metadata_tab.png`, `p4_main_sim_03_hash_integrity.png`, `p4_main_sim_04_login_live_again.png` | **Result on the main console `http://127.0.0.1:5173`** (ruling (a); run `r4_simulated_main`). This row's own fresh profile started in Live with the Core paths failed in the browser. Selector → Simulated → confirm: stored `SIMULATED`, `data-core-mode=SIMULATED`, no Alert, **CORE LINK Online** (mock-core heartbeat accepted from 5173), **Sign In enabled**. Simulated sign-in as andi.pratama: Dashboard, shell mode SIMULATED. Evidence (sidebar): the list shows EV-20261006-0013 … EV-20261005-0004, and today's item 0012 is **EV-20261006-0012**. Row press → preview card shows the item → Open → `/evidence/EV-20261006-0012`. **Metadata tab:** `data-package="demo"`; **no `evidence-foreign-package` notice, and no "is another record" text anywhere on the page**. Headings: "Manifest fields (Design Book §11.3) DEMO", "Package contents · SESSION-SES-20261001-0022", "Session notes". 13 manifest fields from the bundled package (1 Session ID SES-20261001-0022 … 5 LP/2026/0930-0004, 6 1 Oct 2026 08:56:15 – 09:12:51, … 13 SEALED), plus the package tree. The header keeps the item's own re-dated values (EV-20261006-0012, SES-20261006-0022, LP/2026/1005-0004, 6 Oct 2026). That is the FX-W2 ruling: in Simulated the package is the item's own content by construction. **Hash & Integrity:** one capture; chip NOT_RUN (source `none`, nothing verified in this simulator session). Signed out through the user menu ("You have been signed out."). Selector → Live → confirm: stored `LIVE`, `data-core-mode=LIVE`. The Login strip reads "CORE LINK Offline" and "Core service unreachable at 127.0.0.1:5173" **because this row's browser failed the Live paths on purpose**. **Lane-3 attempts (kept as evidence).** **Both runs.** Login Data mode was Live (`dems.core.mode.v1` absent). Pressed Simulated: dialog "Switch to Simulated mode? You will be signed out and the console reloads. Simulated data and Live data are separate." Confirmed: the page reloaded to `/login` with the selector on SIMULATED, stored `SIMULATED`, `data-core-mode=SIMULATED`. The page then showed the Alert "**Core service unreachable at 127.0.0.1:4400.** Retry", CORE LINK Offline, and **Sign In disabled**. **Run 1** (and its attempt 1): nothing listened on 4400 (`ERR_CONNECTION_REFUSED`). Attempt 1 waited 20 s for Sign In to enable, then typed and pressed anyway and waited 25 s more: no dashboard, as expected with Sign In disabled. **Run 2**, with mock-core running (controller, 12:50): every heartbeat upgrade from the page was refused. mock-core logged 5× `GET /ws origin=http://127.0.0.1:5178` → "ws origin rejected", status 403, between 05:51:38.359Z and 05:51:42.565Z. The browser recorded "Error during WebSocket handshake: Unexpected response code: 403". Item 0012 cannot be opened in Simulated on this console, so the ruling could not be observed in a browser. The driver does continue to item 0012's Metadata tab and the indicator switch-back once Sign In is enabled; it never reached that part. Both lane-3 runs switched back with the Login selector Live: dialog "Switch to Live mode?…" → stored `LIVE`, strip "DATABASE Ready · ENGINE Ready · CORE LINK Online · MODE Live". The shell's mode indicator could not be used for the way back: it exists only after a sign-in | **PASS** on the main console 5173 (lane 3: BLOCKED, environment, O-RW-6) | 5173 run: no Core contact. In the browser: `/api/v1/auth/session` ×3 and `/api/v1/health` ×2 were failed with `blockedReason: inspector`, and 7 `ws://127.0.0.1:5173/ws` constructions were refused by the guard. Only `ws://127.0.0.1:5173/` (Vite) and `ws://127.0.0.1:4400/ws` connected (101). Main Core log 05:58–06:00Z: 0 `auth/` lines. Its only other lines are another client's 10-second anonymous health poll, which started before and continued after this row's browser, and OPR-002 reads of the R-S row (`rw_main_core_window.txt`). mock-core since 05:58:25Z: "ws client connected/disconnected" from origin 5173, 0 rejected. Console in the Simulated pages: 0 errors, 0 warnings, 0 exceptions. In the two Live Login phases, 5 `[core-web] live` errors and 3 warnings: the Live client reporting the paths this row blocked (induced, not a product finding). Lane-3 evidence: Sign In gate: `apps/core-web/src/features/login/login-model.ts:61-63` ("Sign In needs the Core: it is disabled while the heartbeat is offline"). Run 2's cause: mock-core's WebSocket Origin allowlist `ALLOWED_WS_ORIGINS` = `WEB_DEV_ORIGINS` (`http://127.0.0.1:5173`, `http://localhost:5173`) + `SELF_ORIGINS` (`packages/shared/src/api/constants.ts:27-29`; check in `apps/mock-core/src/heartbeat.ts:20,62-66`). mock-core has no setting to add an origin; its only environment variable is `LOG_LEVEL`. Evidence: `rw_mockcore_ws_rejections.txt`, `r1_simulated_mockcore_log.txt`, `r1_simulated_mockcore_console_network.json`. No Core (4423) request in Simulated mode |
| **E2E-W1-5** Ring word inside the ring | `w1_supervisor/05_dashboard_after_sign_in.png` (1440), `w1_supervisor/24_dashboard_narrow_390x844.png` (390) | `p1_w1_5_ring_1440x900.png`, `p1_w1_5_ring_390x844.png`, `p1_w1_5_6_dashboard_1440x900.png`, `p1_w1_5_6_dashboard_390x844.png` | **1440x900:** ring 258 px, state ATTENTION, word font 24.608 px, `data-fit-scale="0.769"`. **390x844:** ring 284 px, 29.344 px, `data-fit-scale="0.917"`. **Pixel check** (`rw_ring_pixels.log`: warm pixels counted by distance from the ring centre). At 1440 the word's ink ends at d=89 px and the inner ring's stroke starts at d=93, leaving an empty band at d=90–92. At 390 the ink ends at d=98 and the ring starts at d=103, leaving an empty band at d=99–102. The same check on FX-W's pre-fix crops (`11b_before_d4_ring_*`) finds no empty band: the ink runs into the ring and past it. The visual check agrees: the word sits inside the ring with air on both sides. (A box measurement from the text Range gave −1.2 px at 1440. The em box is taller than the capitals' ink, so the pixel check is the measure used) | **PASS** | — |
| **E2E-W1-6** Status strip at 390x844 | `w1_supervisor/24_dashboard_narrow_390x844.png` (labels overlap, "Connected" cut) | `p1_w1_6_strip_390x844.png`, `p1_w1_6_strip_1440x900.png`, `p1_w1_5_6_dashboard_390x844.png` | 390x844: 6 cells in 3 rows (2 per row). Cell-box overlaps 0, value-into-next-cell overruns 0, truncated values 0, off-screen cells 0, page `scrollWidth` 390. Values: Ready, Ready, 3.2 TB Free, Synchronized, Secure, Connected. 1440x900: 1 row, 0 overlaps, 0 truncated ("Synchronized" in full) | **PASS** | — |
| **E2E-W1-7** Custody date and time not split inside tokens at 1440x900 | `w1_supervisor/69_evidence_detail_chain_of_custody.png` ("6 Oct 20 / 26 09:5 / 8:24") | `p1_w1_7_custody_1440x900.png` | All 6 custody rows of EV-20261006-0012 render the Time cell as exactly 2 lines, a date token and a clock token, e.g. `["6 Oct 2026", "12:30:11"]`, … `["6 Oct 2026", "09:14:49"]`. Every line matched `^\d{1,2} [A-Z][a-z]{2} \d{4}$` or `^\d{2}:\d{2}:\d{2}$` (measured per character) | **PASS** | — |
| **Note drawer title** as SUPERVISOR + timeline title | `w1_supervisor/153_session_monitor_note_drawer.png` (drawer "Investigator note" for the SUPERVISOR) | `p1_note_01_demo_load_recording_confirm.png`, `p1_note_02_demo_recording_loaded.png`, `p1_note_03_session_monitor_recording.png`, `p1_note_04_supervisor_note_drawer.png`, `p1_note_05_timeline_supervisor_note_added.png`, `p1_note_09_session_monitor_after_seal.png` | Demo before: scenario idle, epoch 27, 0 faults, no session. Loaded the Recording scenario (confirm "Load the Recording scenario? Every console connected to this Core server sees the new data at once. The current audit chain is discarded; its row count and head hash stay on record."). Result: epoch 28, session SES-20261006-0024 RECORDING, investigator OPR-001, recording started 05:17:28.826Z by the scenario history. **Drawer**: `aria-label="Supervisor note"`, heading "Supervisor note", `data-role="SUPERVISOR"`. Saved one note: toast "Note added". **Timeline** NOTE items: "12:20:38 **Investigator Note Added** Subject identity and rights read and confirmed" (the scenario's own note, audit 108 OPR-001) and "12:36:23 **Supervisor Note Added** R-W re-test note: …". On screen the timeline column ends the long title with an ellipsis ("Supervisor Note Ad…", `p1_note_09`); the DOM holds the full title | **PASS** | `05:36:11.381Z POST /api/v1/demo/scenario 200 operator:OPR-002` (audit 219 `SCENARIO_LOADED` OPR-002); `05:36:23.963Z POST /api/v1/session/:id/notes 204 operator:OPR-002`; audit 221 `NOTE_ADDED` OPR-002 "Supervisor note added" |
| **E2E-W1-1** custody actor of RECORDING_STOPPED (supervisor stops a session another operator started) | `w1_supervisor/162_evidence_new_item_custody.png` (round 1: custody "RECORDING_STOPPED · AKP Budi Santoso" vs audit 236 OPR-002) | `p1_note_06_end_session_dialog.png`, `p1_note_07_session_sealed.png`, `p1_note_08_sealed_item_custody_full.png`, `p1_note_08b_sealed_item_custody.png` | End Session held 2.6 s → dialog "End Session? Recording ends, then the evidence is finalized and sealed. This cannot be undone." → reason → End Session → "Evidence EV-20261006-0014 sealed · Sealed 6.3 s after the recording ended". **Custody on screen:** SEALED · System · 12:36:38; **RECORDING_STOPPED · AKP Andi Pratama** · 12:36:31 · "R-W re-test: interview ended by the supervisor from the web console"; RECORDING_STARTED · AKP Budi Santoso · 12:17:28. **Core record:** `RECORDING_STARTED actorId OPR-001 05:17:28.826Z`, **`RECORDING_STOPPED actorId OPR-002 05:36:31.921Z`**, `SEALED actorId null 05:36:38.215Z`; notes by OPR-001 and OPR-002. The **audit rows agree**: 222 `RECORDING_STOPPED` actorId **OPR-002** 05:36:31.921Z; 86 `RECORDING_STARTED` actorId OPR-001 05:17:28.826Z. Operators: OPR-001 = AKP Budi Santoso (INVESTIGATOR), OPR-002 = AKP Andi Pratama (SUPERVISOR) | **PASS** | `05:36:31.924Z POST /api/v1/session/:id/stop 202 operator:OPR-002`; audit 222 and 86 as quoted |

Not re-tested here, by the brief: the live Operator column of Paired Devices (the pairing row covers it).

## 3. Part 2: smoke walk as SUPERVISOR (1440x900)

Method: one browser and one sign-in, pages reached through the sidebar. Two exceptions: Stack Check was opened by URL, as in round 1, and the evidence detail was opened by URL because my driver's selector found no anchor in the list. Every page was captured after a 2.5 s settle. Console and network facts come from CDP (`Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Log.entryAdded`, `Network.requestWillBeSent`, `Network.webSocketCreated`), attributed per page in `r2_smoke_console_network.json`.

| Page | Result | Screenshot | Console/network |
|---|---|---|---|
| Login | PASS: Live, strip "DATABASE Ready · ENGINE Ready · CORE LINK Online · MODE Live" | `p2_01_login.png` | 0 errors / 0 warnings / 0 exceptions. Log: one "401" for the signed-out `GET /api/v1/auth/session` probe (expected). 441 requests, all `http://127.0.0.1:5178` (+1 `blob:`). ws `127.0.0.1:5178/` (Vite HMR) and `/ws` |
| Stack Check | PASS: heartbeat chip "Live" | `p2_02_stack_check.png` | 0/0/0; 257 requests, origin 5178 only; ws 5178 |
| Dashboard | PASS: LIVE, ring "1 ISSUE" | `p2_03_dashboard.png` | 0/0/0; 171, 5178 only |
| Start New Session (step 1) | PASS: `/session/new?step=1`, Next disabled on the empty form. Nothing created (no `POST /session` in the log) | `p2_04_start_new_session_step1.png` | 0/0/0; 16, 5178 only |
| Session Monitor | PASS: "SESSION SEALED Evidence EV-20261006-0014 sealed • Ready for the next session"; timeline shows both notes ("Investigator Note Added", "Supervisor Note Added") | `p2_05_session_monitor.png` | 0/0/0; 24, 5178 only |
| Evidence list | PASS: "1–10 of 14" (the rebuilt dataset plus the item sealed in Part 1) | `p2_06_evidence_list.png` | 0/0/0; 107 + 1 inline `data:` image |
| Evidence detail: Media tab | PASS: EV-20261006-0012, tab selected | `p2_07a_evidence_detail_media.png` | 0/0/0 for the whole detail page; 963 requests (media and Vite modules), 5178 only |
| Evidence detail: Metadata tab | PASS: `data-package="foreign"` in Live (as E2E-W1-4) | `p2_07b_evidence_detail_metadata.png` | as above |
| Evidence detail: Hash & Integrity tab | PASS: "NOT VERIFIED", no "Last verification" line. Consistent with the Core: after the scenario rebuilt the dataset, EV-20261006-0012 holds `verification {NOT_RUN, at: null}`, custody RECORDING_STARTED, SEALED (`r3_custody_probe_observations.json`). This is the "never verified" case of FX-W §2 | `p2_07c_evidence_detail_integrity.png` | as above |
| Devices & Inputs (+ drawer) | PASS: Camera 1 menu Details, Test signal, Identify (blink) enabled, Restart disabled "Requires the Technician role". Details opened the drawer "Camera 1 · CAM-01 READY" (Overview, Health, Log); Escape closed it | `p2_08a_devices.png`, `p2_08b_devices_camera1_drawer.png` | 0/0/0; 50, 5178 only |
| Storage | PASS | `p2_09_storage.png` | 0/0/0; 24, 5178 only |
| Network & Time | PASS | `p2_10_network_time.png` | 0/0/0; 19, 5178 only |
| Security & Audit | PASS | `p2_11_security_audit.png` | 0/0/0; 29, 5178 only |
| System & Maintenance | PASS: Demo Control Panel visible with the DEMO badge and the "Demo controls" switch. The switch is off in this fresh profile ("Demo tooling is hidden…") | `p2_12a_system.png`, `p2_12b_system_demo_control_panel.png` | 0/0/0; 22, 5178 only |
| Users & Roles | PASS | `p2_13_users_roles.png` | 0/0/0; 15, 5178 only |
| Paired Devices | PASS: "0 paired · 0 online", no code element | `p2_14_paired_devices.png` | 0/0/0; 16, 5178 only |
| API Reference (one live Try it) | PASS: banner "CORE SERVER ONLINE • dems-core-server v0.2.0 • READY · Try it goes to the Core server through 127.0.0.1:5178, as the signed-in operator". Service liveness → Test Request → Send: "7ms · 238 B · 200 OK", body `"status": "ok"`, `ready.database/engine true`, `ws.clients 1`. Client closed | `p2_15a_api_reference.png`, `p2_15b_api_reference_try_it_health_response.png` | 0/0/0; 36, 5178 only. Core: `05:40:34.806Z GET /api/v1/health 200 operator:OPR-002` (response `serverTime` 05:40:34.805Z) |
| Sign out (user menu) | PASS: menu "Profile AKP Andi Pratama · Role: Supervisor · Lock console · Sign out" → Login, state `signed-out`, "You have been signed out." | `p2_16_signed_out.png` | 0/0/0. `05:40:41.197Z POST /api/v1/auth/sign-out 204 operator:OPR-002` |

Whole walk: 0 blocked requests. Every http request went to `http://127.0.0.1:5178`, apart from inline `data:` and `blob:` URLs, which are not network. Every socket went to `ws://127.0.0.1:5178`. No request went to `localhost`, 4420 to 4422 or 5173/5176/5177.

## 4. Defects (R-W-n)

| ID | Severity | Page | Defect | Repro | Expected | Observed | Evidence |
|---|---|---|---|---|---|---|---|
| **R-W-1** | Low (new finding, not a regression: present with the pre-fix CSS too) | Evidence detail → Hash & Integrity → Chain of custody | At 1440x900 and narrower, the custody table is wider than its card when a row carries a multi-word Detail (here the stop reason). The Detail column is cut at the card edge until the user scrolls sideways | Lane 3, EV-20261006-0014 (sealed in Part 1 with a reason) → Hash & Integrity → Chain of custody, viewport 1440x900 | The table fits its card, or the Detail wraps inside it | Table 472 px in a 441 px `.table__scroll-container` (`overflow-x: auto`): 31 px of horizontal scroll. The RECORDING_STOPPED Detail shows 62 of 92 px ("intervie", "supervis" cut). Column widths: Time 106, Action 187 ("RECORDING_STOPPED"), Actor 87, Detail 92. At 1280x800 the overflow is 97 px and 0 px of the Detail is visible. At 1920x1080 it fits (631/631). With the pre-E2E-W1-7 CSS re-injected in my own browser only (cell `word-break: break-all`, tokens `white-space: normal`), the overflow is 16 px at 1440 and 82 px at 1280 (Time 91 px). So the overflow predates FX-W, and the date token kept on one line by FX-W adds 15 px. That is a measured approximation: the pre-fix DOM had one span, and I applied the old CSS to the new two-span DOM. Scrolled right, the full reason is readable (`p3_…_scrolled_right`). The headless shell runs with `--hide-scrollbars`; whether a real browser draws a scrollbar depends on the platform | `p1_note_08b_sealed_item_custody.png`, `p2_07d_custody_detail_column_ev0014.png`, `p3_custody_ev0014_1440x900_scrolled_right.png`, `p3_custody_ev0014_1920x1080.png`, `r3_custody_probe_observations.json`, `r2_smoke_observations.json` (custody probe) |

**E2E-W1-4 Simulated: resolved by the controller's ruling (a).** On lane 3 the check was blocked (no mock-core at first; then mock-core's origin allowlist). The controller granted `http://127.0.0.1:5173` for this one check. It ran there at 12:59–13:00 WIB and passed (§2). Options (b) and (c) of the earlier version of this section are no longer needed for this row. The lane allowlist question stays open as O-RW-6.

### Observations (no FAIL)

| ID | Observation | Evidence |
|---|---|---|
| O-RW-1 | In Simulated mode the console's heartbeat client opens `ws://127.0.0.1:4400/ws`, which is not the page origin. This is by design for the dev build ("127.0.0.1:4400 in dev", `features/home/use-health.ts:10`; README Start: mock-core on 4400). Before 12:50 every attempt was `ERR_CONNECTION_REFUSED` (nothing listened there). In the 12:51 run mock-core answered each upgrade with 403. No data was exchanged in either case. Live mode stays page-origin only | `r1_simulated_console_network.json`, `r1_simulated_attempt1_console_network.json`, `r1_simulated_mockcore_console_network.json` |
| O-RW-2 | The Session Note action button's text at 1440 reads "Session Note". FX-W2 made its subtitle follow the role ("Add supervisor note"), but the subtitle is not in the button's rendered text at this width. Not checked further: the brief asks for the drawer title, which is correct | `r1_note_custody_observations.json` (`monitor.noteAction`) |
| O-RW-3 | The scenario load (epoch 27 → 28) rebuilt the dataset. The ID EV-20261006-0014 is reused by the item sealed here (SES-20261006-0024, sealed 12:36:38 WIB). It is not the round-1 record of that ID, which was discarded by round 1's own demo reset (same as O-14 of round 1) | `r1_note_custody_observations.json` |
| O-RW-4 | The capture mask blurred 5 text nodes made of exactly six digits on the Metadata tab. They were not identified further; no pairing page was open. The Paired Devices page showed no code element | `r1_evidence_live_log.txt`, `r2_smoke_log.txt` ("masked 5") |
| O-RW-5 | `p1_note_05_timeline_supervisor_note_added.png` was taken while the "Note added" toast covers the end of the timeline title. `p1_note_09_session_monitor_after_seal.png` and `p2_05_session_monitor.png` show the same item uncovered. `p1_note_05b_timeline_clip.png` is a mis-aimed clip: it shows the top of the page, not the timeline | screenshots |
| O-RW-6 | The lane consoles (5176, 5177, 5178) offer the Data mode selector, but Simulated mode cannot sign in on them even with mock-core running: mock-core's heartbeat WebSocket accepts only `127.0.0.1:5173`, `localhost:5173` and its own origins. README §Live mode step 4 ("Simulated mode on the same page still needs mock-core for Sign In") is written for the main instance on 5173. I record this as a test-environment limit, not a product defect: the 0.1.0 packages and the main instance are unaffected. Whether the lanes should support Simulated is for the controller. **Because of this, the Simulated check of E2E-W1-4 ran on the main console 5173** (controller ruling (a), §2) | `rw_mockcore_ws_rejections.txt`; `packages/shared/src/api/constants.ts:27-29`; `apps/mock-core/src/heartbeat.ts:20,62-66` |

## 5. Incident

| ID | What | Effect and handling |
|---|---|---|
| **IN-RW-1** (process slip of this row, about 12:33 WIB) | To find out why Simulated Sign In was disabled, I ran `grep -n -i -E "4400\|mock-core\|Simulated" README.md`. My exclusion filter removed password and PIN lines but not the "Live mode pairing code" row (README line 50). That row prints the README's published Simulated-mode pairing code. It appeared once in my own tool output | Nothing was written to any file. The count-only scan below finds that code in 0 of this row's files. It is the fixed, published demo code of Simulated mode, not a Live code. No Live pairing code was issued or shown. Same class as IN-FXW-1 (D204); the value is not repeated here.

**Confirmed (asked by the controller):** I re-read that tool output in my session transcript; I did not re-run the grep. The only secret-class value it printed is the README's **published Simulated-mode demo pairing code** (README line 50).

- No password: lines containing "password" were filtered out, and the one Quick start sentence that names an operator (README line 297) was cut at 220 characters, before any password.
- No PIN: lines containing "PIN" were filtered out.
- No Live pairing code, session token or other credential.

**No later step greps README.** After 12:33 README was opened only inside node processes that print no README text: the drivers (password into `Input.insertText`), the count-only `secret_scan.mjs` (prints counts), and one boolean check ("sim code located: true", "password located: true") |

## 6. State left on lane 3

- **Demo and session:** epoch 28, scenario label "recording", 0 active faults. Session SES-20261006-0024 is **SEALED** as EV-20261006-0014 (2 notes, custody start OPR-001 and stop OPR-002). No active session. No demo reset was run.
- **Discarded audit rows:** the scenario load discarded the epoch-27 audit chain, keeping its row count and head hash on record. That chain held the FX-W rows and this row's audit rows 123, 126 (Test signal) and 129 (Verify). Their evidence remains in this row's observations and in the Core request log.
- **EV-20261006-0012:** the rebuilt dataset holds it as `NOT_RUN`. The PASS that FX-W left was in the discarded epoch.
- **Untouched:** users and roles. No pairing code. No fault. Restart services and Install update were not pressed.
- **Sign-out and cleanup:** last sign-out `05:42:45.818Z POST /api/v1/auth/sign-out 204`. No browser and no profile left.
- **Not touched at all:** any server, Vite, Metro, emulator or PostgreSQL, ports 5176/5177 and 4420 to 4422. Port 5173 was used only for the one granted Simulated check, with the Core paths blocked, so 4420 was never reached.
- **mock-core:** started by the controller at 12:50, left running, not stopped. This row's only contact with it was the console's own 5 refused heartbeat upgrades at 12:51.
- **Re-run cleanup:** the 12:51 run signed nobody in on the Core: Sign In was disabled, and the Live Login page's reads are anonymous. Its browser and profile were removed.
- **Main console 5173** (one Simulated check, ruling (a)):
  - No Live sign-in, and no request from this row reached the Core 4420 (main Core log: 0 `auth/` lines in the window).
  - The R-S row's browser was not touched.
  - The Simulated session was signed out, and this row's profile was switched back to Live and then deleted.
  - The Simulated mode lives in the browser only (localStorage of a deleted profile), so nothing persists on the main instance.
  - Two runs: the first stopped before opening the item and its profile was removed with the simulator session in it.

## 7. Secret hygiene

I ran a count-only scan (`secret_scan.mjs`, scratchpad) over every file under `test/assets/retest/w_web/` and over `delegation_progress/retest_w_web.md`: 105 files, of which 60 PNGs were byte-scanned, before this report was written. The re-scan after the 12:51 run and this update is recorded in the progress file. Results:

- demo password: 0;
- README Simulated pairing code: 0;
- `ses_`/`dvc_`/`bio_` tokens: 0;
- six-digit runs: 0;
- 3+3 digit groups (with any separator): 0.

The password is read inside the driver from the README table and only handed to `Input.insertText`. All 3 operators share the same password cell; I checked that as a boolean and never printed it. Run logs and observations pass a redaction filter that covers the password, 6-digit runs, 3+3 groups with separators, session-token prefixes and `token=` values. Request bodies, cookie values and socket payloads were never recorded. The final re-scan including this report is recorded in `delegation_progress/retest_w_web.md`.

## 8. Screenshot index

| File | Caption |
|---|---|
| `p1_w1_2_sup_camera1_menu.png` | SUPERVISOR, Dashboard Camera 1 menu: Test signal enabled, Restart disabled "Requires the Technician role" (clip) |
| `p1_w1_2_sup_camera1_menu_full.png` | Same menu, full page |
| `p1_w1_2_sup_test_signal_toast.png` | SUPERVISOR pressed Test signal once: toast "Test signal sent to Camera 1" |
| `p1_w1_2_inv_camera1_menu.png` | INVESTIGATOR, Dashboard Camera 1 menu: Test signal enabled, Restart disabled with the Technician hint (clip) |
| `p1_w1_2_inv_camera1_menu_full.png` | Same menu, full page |
| `p1_w1_2_inv_test_signal_toast.png` | INVESTIGATOR pressed Test signal once: toast "Test signal sent to Camera 1" |
| `p1_w1_3_integrity_on_open.png` | EV-20261006-0012 integrity card on open: PASS from the Core record, "Last verification PASS · 12:03:06 · AKP Andi Pratama" |
| `p1_w1_3_integrity_on_open_full.png` | Same, full page |
| `p1_w1_3_integrity_after_reload.png` | After reload: same stored PASS line |
| `p1_w1_3_integrity_after_verify.png` | After Verify again: PASS, the line moved to 12:30:11 |
| `p1_w1_3_integrity_after_verify_reload.png` | Reload after Verify: the stored line is the new run (12:30:11) |
| `p1_w1_4_live_metadata_tab.png` | Live Metadata of EV-20261006-0012: notice, Core record first, package under "Bundled DEMO package · EV-20261001-0012" |
| `p1_w1_4_live_metadata_package_heading.png` | Same tab scrolled to the package documents heading |
| `p1_w1_4_sim_01_login_live_selector.png` | Login, Data mode selector on Live (fresh profile) |
| `p1_w1_4_sim_02_switch_to_simulated_dialog.png` | "Switch to Simulated mode?" confirmation |
| `p1_w1_4_sim_03_login_simulated.png` | Login in Simulated: "Core service unreachable at 127.0.0.1:4400", CORE LINK Offline, Sign In disabled (blocked) |
| `p1_w1_4_sim_05_switch_to_live_dialog.png` | "Switch to Live mode?" confirmation from the Login selector |
| `p1_w1_4_sim_06_login_live_again.png` | Back in Live: selector Live, strip CORE LINK Online, MODE Live |
| `p1_w1_4_simok_01_login_live_selector.png` | Re-run with mock-core up (12:51): Login, Data mode selector on Live |
| `p1_w1_4_simok_02_switch_to_simulated_dialog.png` | Re-run: "Switch to Simulated mode?" confirmation |
| `p1_w1_4_simok_03_login_simulated.png` | Re-run: Simulated Login still "Core service unreachable at 127.0.0.1:4400", Sign In disabled (mock-core refused origin 127.0.0.1:5178 with 403) |
| `p1_w1_4_simok_05_switch_to_live_dialog.png` | Re-run: "Switch to Live mode?" confirmation from the Login selector |
| `p1_w1_4_simok_06_login_live_again.png` | Re-run: back in Live, selector Live, strip CORE LINK Online, MODE Live |
| `p4_main_sim_attempt1_01_login_simulated.png` | Main console 5173, attempt 1: Simulated Login with CORE LINK Online and Sign In enabled (the run stopped before opening the item) |
| `p4_main_sim_01_login_simulated.png` | Main console 5173: Simulated Login, CORE LINK Online (mock-core accepts 5173), Sign In enabled |
| `p4_main_sim_02_metadata_tab.png` | Main console 5173, Simulated: EV-20261006-0012 Metadata shows the bundled package as its metadata (manifest fields, documents), no "another record" notice |
| `p4_main_sim_03_hash_integrity.png` | Main console 5173, Simulated: EV-20261006-0012 Hash & Integrity (NOT_RUN in this simulator session) |
| `p4_main_sim_04_login_live_again.png` | Main console 5173: after sign-out, selector back to Live (Core offline on screen because this browser blocked the Live paths on purpose) |
| `p1_w1_5_6_dashboard_1440x900.png` | Dashboard 1440x900 after the fix (ring and strip) |
| `p1_w1_5_ring_1440x900.png` | Ring crop 1440x900: ATTENTION inside the inner ring (fit 0.769) |
| `p1_w1_6_strip_1440x900.png` | Status strip 1440x900: one row, values in full |
| `p1_w1_5_6_dashboard_390x844.png` | Dashboard 390x844 after the fix |
| `p1_w1_5_ring_390x844.png` | Ring crop 390x844: ATTENTION inside the inner ring (fit 0.917) |
| `p1_w1_6_strip_390x844.png` | Status strip 390x844: 3 rows of 2, no overlap |
| `p1_w1_7_custody_1440x900.png` | EV-20261006-0012 chain of custody 1440x900: date and time as whole tokens on two lines |
| `p1_note_01_demo_load_recording_confirm.png` | System & Demo Control: "Load the Recording scenario?" confirmation (lane 3) |
| `p1_note_02_demo_recording_loaded.png` | Scenario Recording loaded (epoch 28) |
| `p1_note_03_session_monitor_recording.png` | Session Monitor: SESSION ACTIVE & SECURE, SES-20261006-0024 recording |
| `p1_note_04_supervisor_note_drawer.png` | Note drawer titled "Supervisor note" with the note typed |
| `p1_note_05_timeline_supervisor_note_added.png` | Note saved: toast "Note added"; timeline item partly under the toast |
| `p1_note_05b_timeline_clip.png` | Mis-aimed clip (page top, not the timeline); kept for completeness |
| `p1_note_06_end_session_dialog.png` | End Session dialog after press and hold |
| `p1_note_07_session_sealed.png` | Finalization: "Evidence EV-20261006-0014 sealed · Sealed 6.3 s after the recording ended" |
| `p1_note_08_sealed_item_custody_full.png` | Sealed item, Hash & Integrity, custody in view: RECORDING_STOPPED · AKP Andi Pratama |
| `p1_note_08b_sealed_item_custody.png` | Custody clip: SEALED System; RECORDING_STOPPED AKP Andi Pratama with the reason; RECORDING_STARTED AKP Budi Santoso |
| `p1_note_09_session_monitor_after_seal.png` | Session Monitor after sealing; timeline "Supervisor Note Ad…" uncovered |
| `p2_01_login.png` | Smoke: Login (Live, Core status strip) |
| `p2_02_stack_check.png` | Smoke: Stack Check, heartbeat Live |
| `p2_03_dashboard.png` | Smoke: Dashboard |
| `p2_04_start_new_session_step1.png` | Smoke: Start New Session, step 1 (nothing created) |
| `p2_05_session_monitor.png` | Smoke: Session Monitor (sealed state, both notes in the timeline) |
| `p2_06_evidence_list.png` | Smoke: Evidence list, 1–10 of 14 |
| `p2_07a_evidence_detail_media.png` | Smoke: Evidence detail, Media tab |
| `p2_07b_evidence_detail_metadata.png` | Smoke: Evidence detail, Metadata tab |
| `p2_07c_evidence_detail_integrity.png` | Smoke: Evidence detail, Hash & Integrity tab (NOT_RUN, as the Core) |
| `p2_07d_custody_detail_column_ev0014.png` | R-W-1: EV-20261006-0014 custody at 1440x900, Detail column cut at the card edge |
| `p2_08a_devices.png` | Smoke: Devices & Inputs |
| `p2_08b_devices_camera1_drawer.png` | Smoke: Camera 1 device drawer (Overview) |
| `p2_09_storage.png` | Smoke: Storage |
| `p2_10_network_time.png` | Smoke: Network & Time |
| `p2_11_security_audit.png` | Smoke: Security & Audit |
| `p2_12a_system.png` | Smoke: System & Maintenance (top) |
| `p2_12b_system_demo_control_panel.png` | Smoke: System & Maintenance, Demo Control Panel visible |
| `p2_13_users_roles.png` | Smoke: Users & Roles |
| `p2_14_paired_devices.png` | Smoke: Paired Devices, 0 paired, no code |
| `p2_15a_api_reference.png` | Smoke: API Reference, Core server online |
| `p2_15b_api_reference_try_it_health_response.png` | Smoke: Try it GET /api/v1/health → 200 OK, 238 B |
| `p2_16_signed_out.png` | Smoke: signed out through the user menu |
| `p3_custody_ev0014_1440x900_scrolled_right.png` | R-W-1: same custody table scrolled right; the full reason is readable |
| `p3_custody_ev0014_1920x1080.png` | R-W-1: at 1920x1080 the custody table fits its card |

## 9. Files of this row

Under `test/assets/retest/w_web/`:

- **Screenshots:** the 70 listed above.
- **Per run** (11 runs: `r1_sup_dashboard`, `r1_inv_dashboard`, `r1_evidence_live`, `r1_simulated_attempt1`, `r1_simulated`, `r1_simulated_mockcore`, `r4_simulated_main_attempt1`, `r4_simulated_main`, `r1_note_custody`, `r2_smoke`, `r3_custody_probe`): `<run>_log.txt`, `<run>_observations.json`, `<run>_cdp_events.jsonl`, `<run>_console_network.json`.
- **Core request lines:** `rw_core_requests.txt`.
- **mock-core WebSocket refusals:** `rw_mockcore_ws_rejections.txt`.
- **Main Core request lines in the 5173 window:** `rw_main_core_window.txt`.
- **Ring pixel check:** `rw_ring_pixels.log`.
- **Drivers as `.txt`:** `rw_driver_rt_lib.mjs.txt`, `rw_driver_rt_measure.mjs.txt`, `rw_driver_r1_dashboard.mjs.txt`, `rw_driver_r1_evidence_live.mjs.txt`, `rw_driver_r1_simulated.mjs.txt`, `rw_driver_r1_simulated_mockcore.mjs.txt` (the same driver with distinct output names and in-app navigation to the evidence list), `rw_driver_rt_lib_main.mjs.txt` and `rw_driver_r4_simulated_main.mjs.txt` (main-console variant with the strict allowlist), `rw_driver_r1_note_custody.mjs.txt`, `rw_driver_r2_smoke.mjs.txt`, `rw_driver_r3_custody_probe.mjs.txt`, `rw_driver_ring_pixels.mjs.txt`, `rw_driver_loglines.mjs.txt`.

Also this report and `delegation_progress/retest_w_web.md`. No tracked file was modified.

---
*Generated: 2026-10-06 12:48 WIB*
*Last Updated: 2026-10-06 13:04 WIB (E2E-W1-4 Simulated: lane-3 re-run with mock-core, then PASS on the main console 5173 by ruling (a); IN-RW-1 confirmation)*
