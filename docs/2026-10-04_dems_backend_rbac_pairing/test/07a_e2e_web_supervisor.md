---
task_id: E2E-W1
task_slug: e2e_web_supervisor
date: 2026-10-06
agent: verifier
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (D191, D194)
status: needs-review
---

# E2E-W1: every web console page in Live mode as SUPERVISOR (lane 3)

One continuous operator walk through every page of the DEMS web console, in Live mode, as `andi.pratama` (SUPERVISOR), through a real headless Chromium driven over raw CDP, against the real Core server and PostgreSQL of lane 3. Every command each page offers was pressed with real mouse events, then checked against the Core server's request log and the audit chain.

**Summary: pages 15 / 15 visited. Commands: 189 exercised: 177 PASS, 8 FAIL (6 distinct defects: 1 High, 3 Medium, 2 Low), 4 BLOCKED. 4 more items are not offered by the page (N/A).** No server error: 0 lines at warn or above in the Core log. Every network request of the page went to `127.0.0.1:5178` (http and ws). Two incidents are recorded: IN-1 (another agent's driver used my browser at 09:42; caused by E2E-W2, not a product defect) and IN-2 (my own process slip with an already expired pairing code, scrubbed; no screenshot affected).

## 1. Environment

| Item | Value | Source |
|---|---|---|
| Core server | `dems-core-server` 0.2.0, API v1, `http://127.0.0.1:4423`, database `dems_lane_3`, `"demoControls":true` | `GET /api/v1/health` (09:36 and 10:42 WIB, both `"status":"ok"`, database and engine ready); `.cache/manual/lane3-server.log` boot line |
| Web console | `@dems/core-web` 0.1.0 on Vite 8.3.1, `http://127.0.0.1:5178`, Live (proxies `/api/v1` and `/ws` to 4423); React 19.2.3, HeroUI 3.2.6, TanStack Router 1.170.40 | `.cache/manual/lane3-web.log`; `node_modules/*/package.json` |
| Browser | Playwright cache `chromium_headless_shell-1243`: `HeadlessChrome/153.0.8010.12` (Chrome for Testing 153.0.8010.12, protocol 1.3, V8 15.3.76.4), fresh profile under `$TMPDIR` (removed afterwards), `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"`, viewport 1440x900 (one capture at 390x844) | `/json/version` |
| DevTools port | 09:41 port 9431 (collision, IN-1, attempt discarded); 09:43 to 10:27 port 9473; from 10:27 an OS-assigned port (`--remote-debugging-port=0`, read from the profile's `DevToolsActivePort`; listener PID checked equal to the browser PID; every connection refuses an endpoint whose `/json/version` does not name that browser) | §7 IN-1 |
| Host | macOS 27.0.1, Node v26.8.2; load average 4 to 9 during the walk (below 14) | `uptime` |
| Walk | 2026-10-06 02:44:01Z to 03:42:31Z (09:44 to 10:42 WIB); aborted attempt 0 at 09:41:54 to 09:43 WIB | `assets/e2e/w1_supervisor/w1_markers.jsonl` |
| Hot reload | None: the Vite log has no HMR line, and all 10 page loads in the CDP record are the driver's own navigations | `w1_cdp_events.jsonl` (`nav` events) |

**Method.** One browser stays up for the whole walk. A background recorder (second CDP client) writes every request (method, URL, status), every WebSocket handshake and the type of each frame (never the payload), console errors and warnings, exceptions and Log entries to `w1_cdp_events.jsonl`. Each step is a short script run by `w1_driver_run.mjs.txt`. The step's source is appended verbatim to `w1_steps_driver.mjs.txt` (the replayable driver), and its marker goes to `w1_markers.jsonl`. `w1_driver_summarize.mjs.txt` splits the Core log (`w1_core_requests.txt`: time, method, route, status, principal) and the browser record by marker into `w1_step_index.json`. Audit rows were read with the page's own cookie (`GET /api/v1/audit?order=DESC`). The demo password is read from README inside `w1_driver_lib.mjs.txt` and only ever handed to `Input.insertText`. Every text the driver records passes a redaction that masks the password, any 6-digit run (also export, audit and diagnostics IDs such as `EXP-######`) and, from step 73, any 3+3 digit group.

**Audit chain epochs.** Seq numbers restart when a demo action rebuilds the chain. Epoch 24 rows 95 to 126 come from the walk until the scenario load. Epoch 25 rows 219 to 237 belong to the Recording scenario (the seeded history ends at 218). Epoch 26 rows 83 to 97 follow the demo reset (the fresh dataset seeds 82 rows).

**Totals from the record** (`w1_page_console_network.json`): 298 Core request lines (200 ×249, 201 ×3, 202 ×9, 204 ×28, 401 ×6, 404 ×3). Request origins: `http://127.0.0.1:5178` ×5411, `ws://127.0.0.1:5178` ×28, plus 5 inline `data:` images (origin "null", not network). Socket frames: meters 64,391, delta 3,503, heartbeat 3,509, hello 18, snapshot 12, admin.changed 10, session.ended 4 (Vite HMR "connected" 10). 0 crashes. The 401s are the signed-out session probe at page load (×4), the intended wrong password, and one audit read by my driver while the console was locked. The 404s are my driver's own probe of a non-existent route `GET /api/v1/device` (×3). All 4xx lines are expected or driver-caused.

## 2. Login (`/login`)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| L1 | Open `/login` (fresh profile, nothing stored) | Live preselected, Data mode selector on Live, Core status strip | `data-core-mode=LIVE`, state `idle`. Selector: Simulated `false`, Live `true`. Strip: "dems-core-server 0.2.0 · DATABASE Ready · ENGINE Ready · CORE LINK Online · MODE Live". Trust line "Core server on this computer • web console, no pairing required" | PASS | assets/e2e/w1_supervisor/01_login_live_idle.png | `GET /auth/session 401` (signed-out probe), `GET /auth/status 200`, `GET /health 200` |
| L2 | One wrong password for `andi.pratama` | Refused, alert, password cleared | "Invalid username or password. 4 attempts remaining"; state `error`; password 0 characters, username kept (12) | PASS | assets/e2e/w1_supervisor/02_login_wrong_password_before.png, assets/e2e/w1_supervisor/02_login_wrong_password_after.png | `POST /api/v1/auth/sign-in 401`; audit 97 `AUTH_FAILED` WARNING OPR-002 |
| L3 | Data mode → Simulated, then Cancel | Confirmation; nothing stored on cancel | "Switch to Simulated mode? You will be signed out and the console reloads…"; cancelled; `dems.core.mode.v1` absent; Live still checked | PASS | assets/e2e/w1_supervisor/03_login_mode_switch_dialog.png | none |
| L4 | Sign in through the form (password from README, not echoed) | Dashboard; cookie not readable by script | Dashboard, "Account menu: AKP Andi Pratama"; `document.cookie` length 0 (HttpOnly) | PASS | assets/e2e/w1_supervisor/04_login_filled_before_sign_in.png, assets/e2e/w1_supervisor/05_dashboard_after_sign_in.png | `POST /api/v1/auth/sign-in 200`; audit 98 `AUTH_SUCCESS` |
| L5 | Password visibility toggle (with the non-secret text "visible-test-text") | Toggles the field type | `password` → `text` → `password` | PASS | assets/e2e/w1_supervisor/198_login_password_toggle_visible_test_text.png | none |
| L6 | "Demo operators" disclosure | — | Not opened: it shows the demo password, which may not appear on any capture (rule) | BLOCKED (rule) | — | — |
| L7 | User menu → Lock console, then sign in again | Signed out with the lock wording | "Console locked. Sign in again to continue.", state `signed-out`; sign-in again OK | PASS | assets/e2e/w1_supervisor/193_lock_console.png, assets/e2e/w1_supervisor/194_signed_in_after_lock.png | `POST /auth/sign-out 204` (03:40:12Z); audit 94 `AUTH_SIGNED_OUT` "Console locked by operator", 95 `AUTH_SUCCESS` (epoch 26) |
| L8 | Deep link `/evidence/EV-20261006-0012` while signed out | Login with a return path | `/login?redirect=%2Fevidence%2FEV-20261006-0012`; detail not shown | PASS | assets/e2e/w1_supervisor/197_deep_link_signed_out.png | `GET /auth/session 401` |

## 3. Stack Check (`/stack-check`, URL only)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| S1 | Open by URL (full load, signed in) | Live heartbeat from the Core | Heartbeat chip "Live"; sequence 650 → 652 (2.2 s) → 654; "core-server v0.2.0 · api v1"; clients 1. Copy still says "wired to the local mock-core heartbeat" (O-1) | PASS | assets/e2e/w1_supervisor/06_stack_check_live.png | `GET /auth/session 200`; socket heartbeats |
| S2 | Show test toast | Toast | "Toasts ready · HeroUI toast queue is wired." | PASS | assets/e2e/w1_supervisor/07_stack_check_test_toast.png | none |

## 4. Dashboard (`/dashboard`)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| D1 | Landing after sign-in | LIVE data in every panel | LIVE chip; "SYSTEM ATTENTION 1 ISSUE"; strip 2 cameras, 2 microphones Ready, storage 3.2 TB free, GNSS synchronized, security secure, network connected; 6 sealed today; recent events show this walk's sign-in | PASS | assets/e2e/w1_supervisor/05_dashboard_after_sign_in.png | frames `hello`, `snapshot`, `delta`, `heartbeat`, `meters` |
| D1b | Hero ring layout at 1440x900 | Status word inside the ring | "ATTENTION" is wider than the inner ring: first and last letters cut by the ring stroke | FAIL (E2E-W1-5, Low) | assets/e2e/w1_supervisor/05_dashboard_after_sign_in.png | — |
| D2 | Camera 1 actions menu | Items per the SUPERVISOR's permissions (contract op 49 `testDeviceSignal` = `DIAGNOSTICS_RUN`, held by SUPERVISOR) | "Details" enabled; "Test signal" **disabled, "Requires the Technician role"**; "Restart" disabled (correct: `DEVICE_MANAGE`) | FAIL (E2E-W1-2) | assets/e2e/w1_supervisor/08_dashboard_camera1_menu.png | — |
| D3 | Details | `/devices` (`devices-panel.tsx:105`) | `/devices` | PASS | assets/e2e/w1_supervisor/09_dashboard_camera1_details.png | — |
| D4 | MIC 1 actions menu | As D2 | Same as D2 | FAIL (E2E-W1-2) | assets/e2e/w1_supervisor/10_dashboard_mic1_menu.png | — |
| D5 | More start options | Menu | "Start with last profile", "Start from template…" | PASS | assets/e2e/w1_supervisor/11_dashboard_more_start_options.png | — |
| D6 | Start with last profile | Wizard | `/session/new?step=1`, empty case, default profile (O-6) | PASS | assets/e2e/w1_supervisor/199_dashboard_start_with_last_profile.png | none until Next |
| D7 | Start from template… | Wizard / template | `/session/new?step=1`, no template choice (O-6) | PASS | assets/e2e/w1_supervisor/200_dashboard_start_from_template.png | none |
| D8 | Notifications bell | Popover | "LATEST ALERTS · No new alerts · View all events" | PASS | assets/e2e/w1_supervisor/12_dashboard_notifications.png | — |
| D9 | ATTENTION pill | Integrity list | 8 checks OK, "Operator tablet link: Needs attention" (no paired tablet on lane 3), "Open Security & Audit" | PASS | assets/e2e/w1_supervisor/13_dashboard_attention_pill.png | — |
| D10 | Device ID (hover; a press does nothing by design: tooltip trigger, `top-bar.tsx:204-226`) | Tooltip | "Serial DEC-2026-IR01-… • Firmware v2.4.1 • Build BSP 6.1.57 / DT r3" | PASS | assets/e2e/w1_supervisor/14_dashboard_device_id.png, assets/e2e/w1_supervisor/18_dashboard_tooltip_device_id.png | — |
| D11 | LIVE indicator → dialog → Cancel | Switch dialog; Live kept | "Switch to Simulated mode?…"; cancelled; LIVE kept; nothing stored | PASS | assets/e2e/w1_supervisor/15_dashboard_mode_indicator_dialog.png | — |
| D12 | Security tile TPM (press, then hover; tooltip trigger, `security-panel.tsx:81-99`) | Tooltip | "TPM 2.0 · Secure Boot Enabled · AES-256-GCM · SHA-256" | PASS | assets/e2e/w1_supervisor/16_dashboard_tile_tpm.png, assets/e2e/w1_supervisor/17_dashboard_tooltip_tpm.png | — |
| D13 | Open Evidence Queue | Evidence, recorded items | `/evidence?status=RECORDED` | PASS | assets/e2e/w1_supervisor/19_dashboard_open_evidence_queue.png | — |
| D14 | Strip "GNSS / Time" (the other five strip links: `/devices` ×2, `/storage`, `/security-audit`, `/network-time`, read from the DOM) | `/network-time` | `/network-time` | PASS | assets/e2e/w1_supervisor/20_dashboard_strip_time.png | — |
| D15 | View All Events | `/security-audit` | same | PASS | assets/e2e/w1_supervisor/21_dashboard_view_all_events.png | `GET /rbac/matrix 200` |
| D16 | Quick action Run Diagnostics (others by href: Review Audit `/security-audit`, Export Evidence `/evidence`, Open Maintenance `/system`) | `/system` | same | PASS | assets/e2e/w1_supervisor/22_dashboard_quick_run_diagnostics.png | — |
| D17 | Sealed evidence "View All" | `/evidence` | same | PASS | assets/e2e/w1_supervisor/23_dashboard_sealed_view_all.png | — |
| D18 | Start New Session | Wizard step 1 | `/session/new?step=1` (§5) | PASS | assets/e2e/w1_supervisor/26_session_new_info_step_empty.png | — |
| D19 | Narrow layout 390x844 | Bottom tabs, no horizontal overflow, legible strip | Bottom tabs Home/Sessions/Evidence/Devices/More; `scrollWidth` 390 (no overflow); **status strip labels overlap** ("3.2 TB Free" over "Synchronized" over "Secure"; "Connected" cut off) | FAIL (E2E-W1-6, Low) | assets/e2e/w1_supervisor/24_dashboard_narrow_390x844.png | — |
| D20 | Reload of the deep link `/devices` while signed in | Stays signed in on the same page | `/devices` again, no Login | PASS | assets/e2e/w1_supervisor/25_reload_deep_link_devices.png | `GET /auth/session 200` |
| D21 | Dashboard while two demo faults are active (§12) | Reacts live | Ring "3 ISSUES", pill "CRITICAL An integrity check failed", "2 Cameras 1 of 2 online" | PASS | assets/e2e/w1_supervisor/145_demo_two_faults_dashboard.png | frames `delta` |

## 5. Start New Session (`/session/new`)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| N1 | Open from the Dashboard | Step 1, Next disabled | Step 1; case `maxLength` 17, name 120, notes 2000; investigator defaults to AKP Andi Pratama (OPR-002); Next disabled | PASS | assets/e2e/w1_supervisor/26_session_new_info_step_empty.png | — |
| N2 | Case number "ABC-123" | Inline error, Next disabled, nothing sent | "Use the case format LP/YYYY/MMDD-NNNN."; Next disabled; no request | PASS | assets/e2e/w1_supervisor/27_session_new_case_number_invalid.png | none |
| N3 | "Fill in the next case number" | Core reserves a number | `LP/2026/1006-0008` | PASS | assets/e2e/w1_supervisor/31_session_new_info_step_filled.png | `POST /api/v1/session/case-number 200` |
| N4 | Subject type Saksi; name "Ahmad Fauzi (E2E-W1 walk)" | Set | Set; preview updates | PASS | assets/e2e/w1_supervisor/31_session_new_info_step_filled.png | — |
| N5 | Investigator suggestions | Operators who may lead | "AKP Budi Santoso Investigator", "AKP Andi Pratama Supervisor" | PASS | assets/e2e/w1_supervisor/28_session_new_investigator_suggestions.png | — |
| N6 | Room select | Options | "Interview Room 1" (only option) | PASS | assets/e2e/w1_supervisor/29_session_new_room_select.png | — |
| N7 | Recording profile select | Options | "Standard (1080p / 25 fps)" (only option) | PASS | assets/e2e/w1_supervisor/30_session_new_profile_select.png | — |
| N8 | Notes | Counter, preview | "62 / 2,000"; preview "DEVICE READINESS 7 of 8 ready · Core Machine BLOCK" | PASS | assets/e2e/w1_supervisor/31_session_new_info_step_filled.png | — |
| N9 | Next | Session created, pre-checks run | `SES-20261006-0024`; CORE BLOCK "Core link offline", 7 PASS; Alert "Recording is blocked… No paired tablet is connected to the Core server…"; Next disabled | PASS | assets/e2e/w1_supervisor/32_session_new_devices_step_checks.png, assets/e2e/w1_supervisor/33_session_new_devices_step_core_blocked.png | `POST /api/v1/session 201`, `POST /session/:id/precheck 202`; audit 99 `SESSION_CREATED`, 100 `PRECHECK_BLOCKED` |
| N10 | Re-run checks | Runs again | "2 of 8 checks complete", then blocked again | PASS | assets/e2e/w1_supervisor/34_session_new_rerun_in_progress.png, assets/e2e/w1_supervisor/35_session_new_rerun_blocked_again.png | `POST …/precheck/retry 202`; audit 101 `PRECHECK_BLOCKED` |
| N11 | Back | Step 1 with data kept | Case and session ID kept | PASS | assets/e2e/w1_supervisor/36_session_new_back_to_info.png | — |
| N12 | Confirm step and Start Recording | — | Not reachable: lane 3 has 0 paired devices, so the Core's gate blocks on the Core link, as README "Known limits" states ("A Live recording needs a paired tablet connected"). The recording commands were exercised through the demo "Recording" scenario instead (§6 M4 to M15) | BLOCKED (environment) | assets/e2e/w1_supervisor/33_session_new_devices_step_core_blocked.png | — |
| N13 | Cancel → Discard session | Session cancelled | "Discard this session?…"; toast "Session discarded."; Dashboard | PASS | assets/e2e/w1_supervisor/37_session_new_cancel_dialog.png, assets/e2e/w1_supervisor/38_session_new_cancelled.png | `POST …/cancel 204`; audit 102 `SESSION_CANCELLED` |

## 6. Session Monitor (`/session`)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| M1 | Open with no recording | NO SESSION, recording controls disabled | Banner "NO SESSION"; Pause, Marker, Note, Snapshot, End disabled | PASS | assets/e2e/w1_supervisor/39_session_monitor_idle.png | — |
| M2 | Camera 2 | Active camera changes | VIDEO-02 checked | PASS | assets/e2e/w1_supervisor/40_session_monitor_camera2.png | `POST /api/v1/video/active-camera 204` |
| M3 | Re-verify | Chain check | "Verifying…" → "PASS • 102 rows" | PASS | assets/e2e/w1_supervisor/41_session_monitor_reverify_running.png, assets/e2e/w1_supervisor/42_session_monitor_reverify_done.png | `GET /api/v1/audit/chain 200` |
| M4 | Open during the demo Recording scenario (§12 Sy24) | Live timer and meters | "SESSION ACTIVE & SECURE"; duration 00:19:11 → 00:19:14 in 3.1 s; meters −51/−52/−18/−15 → −12/−15/−51/−51 dBFS; Core `SES-20261006-0024` RECORDING | PASS | assets/e2e/w1_supervisor/149_session_monitor_recording_reading_1.png, assets/e2e/w1_supervisor/150_session_monitor_recording_reading_2.png | `GET /session/current 200`; about 19.5 meter frames/s |
| M5 | Add Marker "E2E-W1 marker: subject asked for water" | Marker recorded | Toast "Marker added at 10:22:03" | PASS | assets/e2e/w1_supervisor/151_session_monitor_marker_input.png, assets/e2e/w1_supervisor/152_session_monitor_marker_added.png | `POST /session/:id/markers 204`; audit 227 `MARKER_ADDED` OPR-002 (epoch 25) |
| M6 | Session Note | Note recorded | Toast "Note added"; drawer closed | PASS | assets/e2e/w1_supervisor/153_session_monitor_note_drawer.png, assets/e2e/w1_supervisor/154_session_monitor_note_added.png | `POST …/notes 204`; audit 229 `NOTE_ADDED` |
| M7 | Pause Monitoring / Resume Monitoring | Client view toggles; recording continues | Label toggles; duration keeps running; Core still RECORDING; no request | PASS | assets/e2e/w1_supervisor/155_session_monitor_paused.png | none |
| M8 | Snapshot | Snapshot on the timeline | "Snapshot captured Camera 1 at 10:22:34 • attached to the session timeline" | PASS | assets/e2e/w1_supervisor/156_session_monitor_snapshot.png | `POST …/snapshots 204`; audit 232 `SNAPSHOT_TAKEN` |
| M9 | Camera 2 while recording | Switch | VIDEO-02 checked, then back to VIDEO-01 | PASS | — | `POST /video/active-camera 204` ×2 |
| M10 | Fullscreen | Feed overlay | In-app overlay with "REC 00:20:07"; Escape closes it | PASS | assets/e2e/w1_supervisor/157_session_monitor_fullscreen.png | — |
| M11 | End Session (press and hold, `END_HOLD_MS` 1500) | Dialog | "End Session? Recording ends, then the evidence is finalized and sealed. This cannot be undone." | PASS | assets/e2e/w1_supervisor/158_session_monitor_end_dialog.png | — |
| M12 | Reason "Interview completed (E2E-W1 walk, lane 3)" → End Session | Finalize, seal | Six steps done; "Evidence EV-20261006-0014 sealed · Sealed 6.5 s after the recording ended"; Core session SEALED | PASS | assets/e2e/w1_supervisor/159_session_monitor_finalizing.png, assets/e2e/w1_supervisor/160_session_monitor_sealed.png | `POST …/stop 202`; audit 236 `RECORDING_STOPPED` **actor OPR-002**, 237 `EVIDENCE_SEALED` |
| M13 | View evidence | Detail of the new item | `EV-20261006-0014`; Core record markers include "E2E-W1 marker: subject asked for water"; 2 notes | PASS | assets/e2e/w1_supervisor/161_evidence_detail_new_sealed_item.png | `GET /evidence/:id 200` |
| M14 | Chain of custody of the new item | RECORDING_STOPPED by the operator who ended it (OPR-002, as audit 236 says) | Custody "RECORDING_STOPPED · **AKP Budi Santoso** · Interview completed (E2E-W1 walk, lane 3)"; Core record `custody[1].actorId = OPR-001` | FAIL (E2E-W1-1, High) | assets/e2e/w1_supervisor/162_evidence_new_item_custody.png | `GET /evidence/EV-20261006-0014 200` vs audit 236 |
| M15 | Session Monitor after sealing | Sealed state | "SESSION SEALED · Evidence EV-20261006-0014 sealed • Ready for the next session" | PASS | assets/e2e/w1_supervisor/163_session_monitor_after_seal.png | — |

## 7. Evidence list (`/evidence`)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| E1 | Open | The Core's items, paged | "1–10 of 13"; filters All 13, Recorded 1, Sealed 10, Exported 1, Under Review 1, Archived 0 | PASS | assets/e2e/w1_supervisor/43_evidence_list_live.png | — |
| E2 | Search "Indah" | One match | `EV-20261006-0012` Indah Permata; URL `?q=Indah` | PASS | assets/e2e/w1_supervisor/44_evidence_search_indah.png | — |
| E3 | Clear search | All again | "1–10 of 13" | PASS | — | — |
| E4 | Status Sealed (first try: driver clicked the radiogroup's centre, re-run on the radio) | 10 Sealed | 10 rows, all Sealed; `?status=SEALED` | PASS | assets/e2e/w1_supervisor/45_evidence_filter_sealed.png | — |
| E5 | Under Review | 1 | 1 row Under Review | PASS | assets/e2e/w1_supervisor/46_evidence_filter_under_review.png | — |
| E6 | Recorded | 1 | 1 row Recorded | PASS | assets/e2e/w1_supervisor/47_evidence_filter_recorded.png | — |
| E7 | Archived (0) | Empty state | "No evidence matches these filters… Clear filters" | PASS | assets/e2e/w1_supervisor/48_evidence_filter_archived_empty.png | — |
| E8 | Subject type Saksi | Only Saksi | 8 rows, all Saksi; `?caseType=SAKSI` | PASS | assets/e2e/w1_supervisor/49_evidence_filter_subject_saksi.png | — |
| E9 | + Investigator AKP Andi Pratama | Combined | 3 rows; `&investigator=OPR-002` | PASS | assets/e2e/w1_supervisor/50_evidence_filter_saksi_andi.png | — |
| E10 | Clear filters | All | "1–10 of 13" | PASS | — | — |
| E11 | Date from 2026-10-06 (keystrokes into the native date control did not register in the headless shell; set through the native value setter and an `input` event, the same `onChange` path) | From that day | 5 rows of 6 Oct; `?from=2026-10-06` | PASS | assets/e2e/w1_supervisor/51_evidence_filter_date_from.png | — |
| E12 | Date to 2026-10-05 (before from) | Empty | Empty state, no inline hint (O-11) | PASS | assets/e2e/w1_supervisor/52_evidence_filter_date_to_before_from.png | — |
| E13 | Date to 2026-10-06 | One day | 5 rows | PASS | assets/e2e/w1_supervisor/53_evidence_filter_date_range_one_day.png | — |
| E14 | Sort Subject, twice | Ascending, descending, across all items | Budi Hartono … Siti Rahma; then Yusuf Pratomo … Hendra Wijaya (`aria-sort` follows) | PASS | assets/e2e/w1_supervisor/54_evidence_sort_subject_first.png, assets/e2e/w1_supervisor/55_evidence_sort_subject_second.png | — |
| E15 | Sort Duration | Ascending | 00:11:36 … 00:37:00 | PASS | assets/e2e/w1_supervisor/56_evidence_sort_duration.png | — |
| E16 | Sort Evidence ID, twice | Asc then desc | EV-20261004-0001 first, then EV-20261006-0013 first | PASS | — | — |
| E17 | Page 2, Previous, Next | Paging | "11–13 of 13" (`?page=2`) ↔ "1–10 of 13" | PASS | assets/e2e/w1_supervisor/57_evidence_page_2.png | — |
| E18 | Row menu of EV-20261006-0012 | Actions | View, Verify, Export, Archive | PASS | assets/e2e/w1_supervisor/58_evidence_row_menu.png | — |
| E19 | Row menu → Verify | Core verdict | Opens `?tab=integrity`; toast "Integrity verified: EV-20261006-0012 PASS" | PASS | assets/e2e/w1_supervisor/61_evidence_row_verify.png | `POST /evidence/:id/verify 200`; audit 103 `EVIDENCE_VERIFIED` |
| E20 | Select one row | Bulk bar | "1 item selected · Export 1 item · Clear selection" | PASS | assets/e2e/w1_supervisor/59_evidence_bulk_bar_one_selected.png | — |
| E21 | Bulk export → wizard → Cancel | Wizard | 4-step wizard for EV-20261006-0012; cancelled | PASS | assets/e2e/w1_supervisor/60_evidence_bulk_export_wizard.png | none |
| E22 | Row menu → Archive (EV-20261004-0001) | Archived (spec B-1: no confirmation) | Toast "EV-20261004-0001 archived"; row Archived; counts Sealed 8, Exported 2, Archived 1 | PASS | assets/e2e/w1_supervisor/83_evidence_archive_dialog.png, assets/e2e/w1_supervisor/84_evidence_archived_row.png | `POST /evidence/:id/archive 204`; audit 107 `EVIDENCE_ARCHIVED` |
| E23 | Row menu → View | Detail | `/evidence/EV-20261006-0012` | PASS | assets/e2e/w1_supervisor/62_evidence_detail_overview.png | `GET /evidence/:id 200` |

## 8. Evidence detail (`/evidence/:id`)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| V1 | Header (overview) | The Core's record | "Sealed · DEMO package · EV-20261006-0012 · 6 Oct 2026 01:06:24 – 01:21:24 · LP/2026/1005-0004 · Indah Permata Saksi · AKP Andi Pratama · 00:15:00 · 2 GB · SES-20261006-0022"; tabs Media, Metadata, Hash & Integrity | PASS | assets/e2e/w1_supervisor/62_evidence_detail_overview.png | — |
| V2 | Media: Play | Plays | Video and two audio tracks playing (t 3.3 s); all media from `127.0.0.1:5178` | PASS | assets/e2e/w1_supervisor/63_evidence_detail_media_playing.png | — |
| V3 | Camera 2, MIC 2 | Switch | VIDEO-02.mp4, AUDIO-02 selected | PASS | assets/e2e/w1_supervisor/64_evidence_detail_media_camera2_mic2.png | — |
| V4 | Pause; track AUDIO-02 | Pause, select | Paused at 7.5 s; tracks VIDEO-02 and AUDIO-02 selected | PASS | assets/e2e/w1_supervisor/65_evidence_detail_media_track_audio02.png | — |
| V5 | Header "Play" | Media tab plays | Media tab; three elements playing | PASS | assets/e2e/w1_supervisor/202_evidence_header_play.png | — |
| V6 | Metadata tab | This item's manifest, or a notice that the bundled package is another record | Manifest fields Session `SES-20261001-0022`, case `LP/2026/0930-0004`, 1 Oct 2026 08:56:15 – 09:12:51; **no notice** that these differ from the Core's record (SES-20261006-0022, LP/2026/1005-0004, 6 Oct) | FAIL (E2E-W1-4) | assets/e2e/w1_supervisor/66_evidence_detail_metadata.png | — |
| V7 | Metadata → `metadata.json` | Same item | `"evidenceId": "EV-20261001-0012"` on the page of EV-20261006-0012 | FAIL (E2E-W1-4) | assets/e2e/w1_supervisor/67_evidence_detail_metadata_document.png | — |
| V8 | Hash & Integrity tab, chain of custody | Sealed values, custody | Sealed values (DEMO); custody VERIFIED (AKP Andi Pratama, 09:58:24), SEALED (System), RECORDING_STARTED | PASS | assets/e2e/w1_supervisor/68_evidence_detail_integrity.png, assets/e2e/w1_supervisor/69_evidence_detail_chain_of_custody.png | — |
| V9 | Verify again | Core verdict, custody row | "Verify again" → PASS 6/6; custody gains VERIFIED 09:59:26 | PASS | assets/e2e/w1_supervisor/70_evidence_detail_verify_again.png | `POST …/verify 200`; audit 104 `EVIDENCE_VERIFIED` |
| V10 | Reload the detail at `?tab=integrity` | The Core's stored verdict | Card "Verdict of the Core server" shows **NOT VERIFIED, 0 of 6 checks**, while the Core record holds `verification {status: PASS, at 02:59:26Z}` and the list preview shows "Last verification PASS" | FAIL (E2E-W1-3) | assets/e2e/w1_supervisor/71_evidence_detail_integrity_after_reload.png, assets/e2e/w1_supervisor/72_evidence_list_preview_after_verify.png | `GET /evidence/:id 200` |
| V11 | More menu | Items | Copy ID, Download manifest, Archive | PASS | assets/e2e/w1_supervisor/73_evidence_detail_more_menu.png | — |
| V12 | Copy ID | Clipboard | Toast "Evidence ID copied"; clipboard `EV-20261006-0012` | PASS | assets/e2e/w1_supervisor/74_evidence_detail_copy_id.png | — |
| V13 | Download manifest | File | `EV-20261006-0012-manifest.demo.json` (4,771 B); toast "Manifest downloaded (DEMO)" | PASS | assets/e2e/w1_supervisor/75_evidence_detail_download_manifest.png | none (client-side) |
| V14 | Export: reason "abc" → Next | Refused on press | Stays on step 1, "Enter a reason of at least 5 characters.", field `aria-invalid` | PASS | assets/e2e/w1_supervisor/76_evidence_export_reason_too_short.png, assets/e2e/w1_supervisor/79_evidence_export_short_reason_pressed.png | none |
| V15 | Reason + destination | 3 destinations | "Case file transfer / Encrypted USB drive / Export/Transfer network (simulated)"; USB chosen | PASS | assets/e2e/w1_supervisor/77_evidence_export_reason_filled.png | — |
| V16 | Request authorisation | Role check | "Authorised" (client-side for a permitted role, spec D-6; see O-2) | PASS | assets/e2e/w1_supervisor/78_evidence_export_authorise_step.png | none |
| V17 | Verify source | Core verdict | 6/6 PASS "Verified by the Core server" | PASS | assets/e2e/w1_supervisor/80_evidence_export_verify_source.png | `POST …/verify 200`; audit 105 |
| V18 | Export | Accepted, audited | "Accepted · EXP-######", "Audit event AUD-######", file name | PASS | assets/e2e/w1_supervisor/81_evidence_export_results.png | `POST …/export 202`; audit 106 `EVIDENCE_EXPORTED` |
| V19 | Download | File | `EXP-######-EV-20261006-0012-export-manifest.demo.json` (3,303 B) | PASS | assets/e2e/w1_supervisor/82_evidence_export_downloaded.png | none |
| V20 | Close; Back to Evidence | List | `/evidence` | PASS | — | — |
| V21 | Review: approve or reject | — | The page offers no review, approve or reject command (More: Copy ID, Download manifest, Archive) | N/A | — | — |

## 9. Devices & Inputs (`/devices`)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| Dv1 | Open | Live state | "1 DEVICE NEEDS ATTENTION · Tablet Control: OFFLINE"; alert "Tablet control offline · Recording continues on the Core…" | PASS | assets/e2e/w1_supervisor/85_devices_live.png | — |
| Dv2 | Camera 1 device menu | Per role | Details, Test signal, Identify (blink) enabled; Restart disabled "Requires the Technician role" | PASS | assets/e2e/w1_supervisor/86_devices_camera1_menu.png | — |
| Dv3 | Details → drawer Overview | Drawer | CAM-01 READY, firmware 3.8.14, track VIDEO-01, PoE CAM 1 | PASS | assets/e2e/w1_supervisor/87_devices_camera1_drawer_overview.png | — |
| Dv4 | Drawer Health | Chart | "LINK QUALITY NOW 99.4% · Derived from the Core's data · last 90 samples" | PASS | assets/e2e/w1_supervisor/88_devices_camera1_drawer_health.png | — |
| Dv5 | Drawer Log | Log | Log tab shown (empty state) | PASS | assets/e2e/w1_supervisor/89_devices_camera1_drawer_log.png | — |
| Dv6 | Test signal | Accepted | Toast "Test signal sent to Camera 1" | PASS | assets/e2e/w1_supervisor/90_devices_camera1_test_signal.png | `POST /api/v1/device/:id/test-signal 204`; audit 108 `DEVICE_COMMAND` CAM-01 |
| Dv7 | Identify (blink) | Accepted | Toast "Camera 1 is blinking its indicator" | PASS | assets/e2e/w1_supervisor/91_devices_camera1_identify.png | `POST /device/:id/identify 204`; audit 109 |
| Dv8 | MIC 1 device menu | Per role | Same four items as Dv2 | PASS | assets/e2e/w1_supervisor/92_devices_mic1_menu.png | — |
| Dv9 | Camera 2 tile | Drawer | Camera 2 drawer (CAM-02) | PASS | assets/e2e/w1_supervisor/93_devices_camera2_tile.png | — |
| Dv10 | Front panel LCD DOWN, ENTER, BACK, UP | Pages | 1/4 status → 2/4 network ("TABLET OFFLINE", PoE 18.6 W) → BACK, UP → 1/4 | PASS | assets/e2e/w1_supervisor/95_devices_front_panel_lcd_enter.png | — |
| Dv11 | Port MGMT LAN | Tablet drawer | Tablet Control drawer "Paired devices 0 paired, 0 online · Open Paired Devices" | PASS | assets/e2e/w1_supervisor/96_devices_port_mgmt_lan.png | `GET /pairing/devices 200` |
| Dv12 | Other device Tablet Control | Same | Same; link to `/admin/devices` | PASS | assets/e2e/w1_supervisor/97_devices_tablet_control_drawer.png | `GET /pairing/devices 200` |
| Dv13 | MIC 1 under the demo fault (§12) | NO SIGNAL | "2 DEVICES NEED ATTENTION · MIC 1: NO SIGNAL · +1 more"; MIC 1 card NO SIGNAL | PASS | assets/e2e/w1_supervisor/141_demo_fault_devices_mic1_no_signal.png | frames `delta` |

The audio input cards and the LEDs carry `role="button"` wrappers but are display elements (`audio-input-card.tsx:86-88`, `front-panel.tsx:96`). A press showed nothing, and so did a hover (assets/e2e/w1_supervisor/94_devices_audio_input_mic1.png, assets/e2e/w1_supervisor/98_devices_led_fault_tooltip.png). Clip reset appears only while a channel is clipped (not shown during this step).

## 10. Storage (`/storage`)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| St1 | Open | Live state | "STORAGE READY · 3.2 TB free · about 389h 45m of recording left" | PASS | assets/e2e/w1_supervisor/99_storage_live.png | — |
| St2 | Calculator: video Mbps Increase ×2, retention days Decrease ×1 | Recompute | 8.0 → 9.0 Mbps, 90 → 89 days; total 18.3 → 20.3 Mbps, "Required for 89 days 3.58 TB 89%", "about 99 days" | PASS | assets/e2e/w1_supervisor/100_storage_calculator_before.png, assets/e2e/w1_supervisor/100_storage_calculator_changed.png | none (client-side) |
| St3 | Reset to book example | Restore | 8.0 Mbps, 90 days, "about 110 days" | PASS | assets/e2e/w1_supervisor/100b_storage_calculator_reset.png | none |
| St4 | Manage Storage | Drawer | 90 days, auto-archive on, Apply "No change to apply" (disabled) | PASS | assets/e2e/w1_supervisor/101_storage_manage_drawer.png | `GET /storage/status 200` |
| St5 | Retention 1 year → Apply | Applied, audited | Toast "Storage policy updated" | PASS | assets/e2e/w1_supervisor/102_storage_policy_pending_change.png, assets/e2e/w1_supervisor/103_storage_policy_applied.png | `POST /storage/policy 200`; audit 110 `STORAGE_POLICY_CHANGED` "YEAR_1 (365 days)" |
| St6 | Back to 90 days → Apply | Restored | Toast; Core `DAYS_90` | PASS | assets/e2e/w1_supervisor/104_storage_policy_restored.png | `POST 200`; audit 111 "DAYS_90" |
| St7 | Auto-archive off → Apply | Applied | Core `retention.autoArchive=false` | PASS | assets/e2e/w1_supervisor/105_storage_auto_archive_off_pending.png | `POST 200`; audit 112 (O-4) |
| St8 | Auto-archive on → Apply | Restored | Core `autoArchive=true` | PASS | assets/e2e/w1_supervisor/106_storage_auto_archive_restored.png | `POST 200`; audit 113 |
| St9 | View sealed (link) | Evidence, sealed | `/evidence?status=SEALED` | PASS | — | — |

Driver note: the first two auto-archive presses hit the switch's description text and changed nothing (Apply stayed disabled, no request, no audit row). The pass is the later press on the switch's own label.

## 11. Network & Time (`/network-time`)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| Nt1 | Open | Live state | "SYNCHRONIZED • CONNECTED · GNSS · stratum 1 · 192.168.10.21"; source GPS; offset +3.2 ms; tablet alert "Recording continues on the Core. The tablet resyncs when it reconnects." | PASS | assets/e2e/w1_supervisor/107_network_time_live.png | — |
| Nt2 | Values over 4 s | Live updates | Clock 10:11:26 → 10:11:30; last sync "11 s ago" → "15 s ago"; offset +4.0 → +1.8 ms; bandwidth 14.3/3.3 → 13.2/2.7 Mbps | PASS | assets/e2e/w1_supervisor/108_network_time_charts.png | frames `delta` |
| Nt3 | Time sync or other command | — | The page offers no command by design (`71_web_storage_network_time.md:154`: no `useCoreActions`); the time source was switched from the Demo Control Panel instead (Sy21) | N/A | — | — |

## 12. Security & Audit (`/security-audit`)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| Sa1 | Open | Posture, chain, log | "SECURITY POSTURE SECURE · 9 of 9 controls active • Audit chain intact"; "113 entries linked"; this walk's rows #109 to #113 at the top, live | PASS | assets/e2e/w1_supervisor/109_security_audit_live.png | `GET /rbac/matrix 200` |
| Sa2 | Verify chain | PASS | "PASS · Verified 113 entries at 10:12:03" | PASS | assets/e2e/w1_supervisor/110_security_audit_verify_chain.png | `GET /api/v1/audit/chain 200` |
| Sa3 | Show in log | Log at the head | Scrolls to the audit log; head #113 visible | PASS | assets/e2e/w1_supervisor/111_security_audit_show_in_log.png | — |
| Sa4 | Search "Storage" | 4 rows | #110 to #113 Storage policy changed | PASS | assets/e2e/w1_supervisor/112_security_audit_search_storage.png | — |
| Sa5 | Type Authentication | AUTH rows | #98 sign-in, #97 failed, #96/#95 (IN-1 rows), #94 … | PASS | assets/e2e/w1_supervisor/113_security_audit_filter_authentication.png | — |
| Sa6 | + Severity Warning | One row | Only #97 "Sign-in failed via Password AKP Andi Pratama (username typed, unverified)" | PASS | assets/e2e/w1_supervisor/114_security_audit_filter_auth_warning.png | — |
| Sa7 | Operator AKP Andi Pratama (options: Budi Santoso, Andi Pratama, Rina Wijaya, System) | Own rows | Rows of OPR-002 | PASS | assets/e2e/w1_supervisor/115_security_audit_filter_operator.png | — |
| Sa8 | Earlier chains | Lineage | "Epoch 18 • 156 rows • head 7987f351fef4… Reset at 6 Oct 2026 02:06:24 by AKP Andi Pratama • scenario Idle" (O-15) | PASS | assets/e2e/w1_supervisor/116_security_audit_earlier_chains.png | — |
| Sa9 | Live switch off, then on | Toggles | on → off → on (the driver's first restore click had no target, so a second step turned it on) | PASS | assets/e2e/w1_supervisor/117_security_audit_live_off.png, assets/e2e/w1_supervisor/121_security_audit_live_on_again.png | none |
| Sa10 | Export audit: reason → Export | Recorded; file built | "Export ID EXP-###### · Entries 113 · Chain at export PASS"; file `dems-audit-EXP-######.json` downloaded at once (65,449 B, rows seq 1 to 113, password absent) | PASS | assets/e2e/w1_supervisor/118_security_audit_export_dialog.png, assets/e2e/w1_supervisor/119_security_audit_export_result.png | `POST /api/v1/audit/export 202`; audit 114 `AUDIT_EXPORTED` "113 rows" |
| Sa11 | Download again | Second file | No second file: the throw-away headless profile's automatic-downloads limiter (O-9) | BLOCKED (environment) | assets/e2e/w1_supervisor/120_security_audit_export_downloaded.png | none |
| Sa12 | Sessions list, sign-out of own browser sessions | — | The page offers no sessions list or per-session sign-out (`features/security-audit`: posture, controls, keys, chain, audit, auth, tamper, custody, rbac panels). Sign-out was exercised from the user menu (§17) | N/A | — | — |

## 13. System & Maintenance with the Demo Control Panel (`/system`; demo actions on lane 3 only)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| Sy1 | Open | 8 panels incl. demo | "ALL CORE SERVICES RUNNING · 16 of 16 · v2.4.1 · slot A"; panels quick, services, health, update, maintenance, about, settings, demo | PASS | assets/e2e/w1_supervisor/122_system_live.png | `GET /demo/status 200` (scenario idle, epoch 24) |
| Sy2 | Run Diagnostics | 8 checks | "All checks passed · 8 of 8" (CPU, SMART, fan, network/PoE, cameras, microphones, time, TPM/Secure Boot) | PASS | assets/e2e/w1_supervisor/123_system_diagnostics_running.png, assets/e2e/w1_supervisor/124_system_diagnostics_done.png | `POST /system/diagnostics 202`; audit 115 `DIAGNOSTICS_RUN` |
| Sy3 | Run again | Again | 8 of 8 | PASS | — | 202; audit 116 |
| Sy4 | Close the modal | Closes | Escape did not close it (O-16); its Close button did | PASS | — | — |
| Sy5 | Install update (hover) | Locked for SUPERVISOR | "Requires the Technician role" | PASS | assets/e2e/w1_supervisor/125_system_install_update_locked.png | — |
| Sy6 | Restart services (hover) | Locked | "Requires the Technician role" | PASS | assets/e2e/w1_supervisor/126_system_restart_services_locked.png | — |
| Sy7 | Export logs with no reason | Refused | "Enter a reason of at least 5 characters."; dialog stays | PASS | assets/e2e/w1_supervisor/127_system_export_logs_reason_required.png | none |
| Sy8 | Export logs with a reason | Recorded, file, toast | Toast "Logs exported · EXP-… · 116 audit rows and 139 events in the file"; the file of this first export was held back by the headless profile (O-9) | PASS | assets/e2e/w1_supervisor/128_system_export_logs_progress.png, assets/e2e/w1_supervisor/129_system_export_logs_done.png | `POST /logs/export 202`, `GET /events 200`; audit 117 `AUDIT_EXPORTED` |
| Sy9 | Export logs again (automatic downloads granted over CDP) | File | `dems-logs-DEMS-IR-01-EXP-######.json` 118,543 B: 117 audit rows, 140 events, 16 services | PASS | assets/e2e/w1_supervisor/130_system_export_logs_downloaded.png | 202; audit 118 |
| Sy10 | Quick action Software Update | Goes to the update panel | Update panel in view, the action focused | PASS | assets/e2e/w1_supervisor/201_system_quick_software_update.png | — |
| Sy11 | Settings: Account | Operator | "AKP Andi Pratama · Role: Supervisor · Sign-in method: Password" | PASS | assets/e2e/w1_supervisor/131_system_settings_account.png | — |
| Sy12 | Presentation mode on, then off | Stored per tab | `dems.presentation.v1` "1" → "0" | PASS | assets/e2e/w1_supervisor/132_system_presentation_mode_on.png | `POST /api/v1/settings 200` |
| Sy13 | Reduce motion on, then off | Toggles | false → true → false | PASS | assets/e2e/w1_supervisor/133_system_reduce_motion_toggled.png | — |
| Sy14 | Clock format 12-hour, then 24-hour | Saved | Radio 12 → 24; saved (O-5) | PASS | assets/e2e/w1_supervisor/134_system_clock_12h.png | `POST /settings 200` |
| Sy15 | Notifications: warning toasts off, then on | Toggles | [on, off] → [off, off] → [on, off] | PASS | assets/e2e/w1_supervisor/135_system_notifications_toggled.png | `POST /settings 200` |
| Sy16 | Device Settings: live camera Camera 2, then Camera 1 | Switch | Camera 2, then Camera 1 | PASS | assets/e2e/w1_supervisor/136_system_active_camera_video02.png | `POST /video/active-camera 204` ×2 |
| Sy17 | Security & Privacy, System Maintenance, About | Open | "AUTOMATIC LOCK After 15 minutes…"; "Go to maintenance"; "DEMS Edge Client v2.4.1 · DEMS-IR-01 · Show identity" | PASS | assets/e2e/w1_supervisor/137_system_settings_maintenance.png, assets/e2e/w1_supervisor/138_system_settings_about.png | — |
| Sy18 | Demo controls switch on | Tooling | Scenario, faults (12), time source, audit rows written | PASS | assets/e2e/w1_supervisor/139_system_demo_panel_open.png | — |
| Sy19 | Fault MIC 1 no signal | Raised; pages react | "1 fault active"; toast "MIC 1 no signal injected · Audit: Fault raised"; banner "15 of 16 running"; Devices NO SIGNAL (Dv13) | PASS | assets/e2e/w1_supervisor/140_demo_fault_mic1_no_signal_raised.png | `POST /demo/faults 204`; audit 119 `FAULT_RAISED` MIC-01 (actor null, O-3) |
| Sy20 | Same switch again (clear) | Cleared | "0 faults active" | PASS | assets/e2e/w1_supervisor/142_demo_fault_mic1_cleared.png | `POST /demo/faults/clear 204`; audit 120 `FAULT_CLEARED` |
| Sy21 | Time source NTP fallback, then GNSS lock | GNSS loss and back | Audit "GNSS signal lost — time from NTP", then cleared | PASS | assets/e2e/w1_supervisor/143_demo_time_source_ntp.png | `POST /demo/faults 204`, `/clear 204`; audit 121, 122 |
| Sy22 | Faults Camera loss + Fan stall | Two raised | "2 faults active"; banner "2 SERVICES NEED ATTENTION 14 of 16" | PASS | assets/e2e/w1_supervisor/144_demo_two_faults_raised.png | audit 123 `FAULT_RAISED` CRITICAL CAM-01, 124 fan |
| Sy23 | Clear all faults | All cleared | Toast "All faults cleared"; 16 of 16 | PASS | assets/e2e/w1_supervisor/146_demo_clear_all_faults.png | `POST /demo/faults/clear 204` (+ `POST /audio/clip/reset 204`); audit 125, 126 |
| Sy24 | Scenario Recording → Load → confirm | Confirm; new epoch | "Load the Recording scenario? … The current audit chain is discarded; its row count and head hash stay on record."; epoch 24 → 25; scenario recording | PASS | assets/e2e/w1_supervisor/147_demo_load_recording_confirm.png, assets/e2e/w1_supervisor/148_demo_scenario_recording_loaded.png | `POST /api/v1/demo/scenario 200`; audit 219 `SCENARIO_LOADED` OPR-002 (epoch 25) |
| Sy25 | Reset demo → confirm (with the session sealed) | New epoch, idle, toast; still signed in | "Reset the Core demo data? … A session is open on the Core server: the rebuild replaces it."; toast "Demo reset: idle scenario, faults cleared"; epoch 25 → 26; signed in | PASS | assets/e2e/w1_supervisor/164_demo_reset_confirm.png, assets/e2e/w1_supervisor/165_demo_reset_done.png | `POST /api/v1/demo/reset 200`; audit 83 `SCENARIO_LOADED` "Demo reset (fresh dataset)" OPR-002 (epoch 26) |

The demo panel's own Presentation mode switch (`system-demo-presentation`) was not toggled separately; it is the same preference as Sy12.

## 14. Users & Roles (`/admin/users`)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| U1 | Open | Users and matrix | "3 users · 3 enabled": OPR-001 Investigator, OPR-002 Supervisor (You), OPR-003 Technician; matrix "Read-only", 18 grants; SUPERVISOR holds SESSION_START, SESSION_NOTE, EVIDENCE_VIEW, EVIDENCE_REVIEW, EVIDENCE_EXPORT, AUDIT_EXPORT, **DIAGNOSTICS_RUN**, PAIRING_MANAGE, USER_ADMIN, DEMO_CONTROL | PASS | assets/e2e/w1_supervisor/166_users_roles_live.png | `GET /admin/users 200`, `GET /rbac/matrix 200` |
| U2 | Own row menu | Self-protection | "Change role…"; "Disable user…" disabled "At least one enabled user must keep user administration." | PASS | assets/e2e/w1_supervisor/167_users_roles_own_role_dialog_hint.png | — |
| U3 | Own role dialog → Cancel | Last-administrator hint | INVESTIGATOR and TECHNICIAN blocked, own-role warning; cancelled | PASS | assets/e2e/w1_supervisor/167_users_roles_own_role_dialog_hint.png | none |
| U4 | OPR-003 → Investigator (reason given) | Changed, audited | Diff "GAINS Start sessions, Add notes and markers · LOSES Manage devices, Maintenance and updates"; toast "Role of Rina Wijaya is now Investigator"; Core OPR-003 INVESTIGATOR | PASS | assets/e2e/w1_supervisor/168_users_roles_change_role_dialog.png, assets/e2e/w1_supervisor/169_users_roles_role_changed.png | `POST /admin/users/:id/role 200`; audit 84 `ROLE_CHANGED` "TECHNICIAN to INVESTIGATOR" |
| U5 | OPR-003 back to Technician | Restored | Toast "… is now Technician"; Core OPR-003 TECHNICIAN | PASS | assets/e2e/w1_supervisor/170a_users_roles_restore_role_dialog.png, assets/e2e/w1_supervisor/170_users_roles_role_restored.png | 200; audit 85 `ROLE_CHANGED` |
| U6 | Disable OPR-001 (reason given) | Disabled, sessions ended | "Disable AKP Budi Santoso? Their sessions end at once…"; toast "AKP Budi Santoso is disabled · Their sessions have ended."; row Disabled; Core enabled=false | PASS | assets/e2e/w1_supervisor/171_users_roles_disable_dialog.png, assets/e2e/w1_supervisor/172_users_roles_user_disabled.png | `POST /admin/users/:id/disable 200`; audit 86 `USER_DISABLED` "sessions ended: 0" |
| U7 | Enable OPR-001 | Enabled | Menu while disabled "Change role…, Enable user"; toast "… is enabled · They can sign in again."; Core enabled=true | PASS | assets/e2e/w1_supervisor/173_users_roles_enable_dialog.png, assets/e2e/w1_supervisor/174_users_roles_user_enabled.png | `POST /admin/users/:id/enable 200`; audit 87 `USER_ENABLED` |
| U8 | Create user, password reset | — | Not offered by the page (row menu: Change role, Disable/Enable only) | N/A | — | — |

End state: OPR-001 INVESTIGATOR on, OPR-002 SUPERVISOR on, OPR-003 TECHNICIAN on (the Core's own list after U7).

## 15. Paired Devices (`/admin/devices`)

Masking: before the first code was issued, a style blurring `pd-code` and `pd-qr` (18 px) was injected, with a MutationObserver that blurs any text node holding a 6-digit or 3+3 digit group. The computed `filter` of both elements was checked to read `blur(18px)` before every capture (otherwise no capture). Screenshots 179, 181 and 182 were then inspected visually: the code and the QR are unreadable.

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| P1 | Open | Registry | "0 paired · 0 online"; "No device has been paired yet…"; "Issue pairing code" | PASS | assets/e2e/w1_supervisor/178_paired_devices_live_empty.png | `GET /pairing/code 200`, `GET /pairing/devices 200` |
| P2 | Issue pairing code (masked) | Code, QR, countdown, attempts | Code and QR shown (blurred in the capture), "4:59", "5 attempts left", "Cancel code" | PASS | assets/e2e/w1_supervisor/179_paired_devices_code_issued_masked.png | `POST /api/v1/pairing/code 201`; audit 90 `PAIRING_CODE_ISSUED` (message names the code record `PCD-…`, not the code) |
| P3 | Cancel code | Closed | Toast "Pairing code cancelled"; panel back to "Issue pairing code" | PASS | assets/e2e/w1_supervisor/180_paired_devices_code_cancelled.png | `POST /pairing/code/cancel 204`; audit 91 `PAIRING_CODE_CLOSED` "cancelled" |
| P4 | Issue a second code | Code | Issued, masked | PASS | assets/e2e/w1_supervisor/181_paired_devices_second_code_masked.png | 201; audit 92 |
| P5 | Leave it 5 min, page open | Expired | "The code expired." at 03:34:28Z; Issue button back; Core `active: null` (O-12) | PASS | assets/e2e/w1_supervisor/182_paired_devices_code_expired.png | audit 93 `PAIRING_CODE_CLOSED` "expired" 03:34:28.418Z (sweep, actor null) |
| P6 | Revoke a device | — | Lane 3 has no paired device (0 paired), so revoke cannot be offered | BLOCKED (no device) | — | — |

## 16. API Reference (`/developer/api`)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| A1 | Open | Live document | "CORE SERVER ONLINE • dems-core-server v0.2.0 • READY · Try it goes to the Core server through 127.0.0.1:5178, as the signed-in operator"; base URL `http://127.0.0.1:5178`; spec v0.2.1; 75 operations; warning "Try it sends real requests… as AKP Andi Pratama" | PASS | assets/e2e/w1_supervisor/183_api_reference_live.png | `GET /health 200` (banner poll, 10 s) |
| A2 | Operation "Service liveness" | Opens | `#tag/service/GET/api/v1/health` | PASS | assets/e2e/w1_supervisor/184_api_reference_health_operation.png | — |
| A3 | Test Request | Client | Client "Server: http://127.0.0.1:5178 … Try it sends real requests as the signed-in operator" | PASS | assets/e2e/w1_supervisor/185_api_reference_client_health.png | — |
| A4 | Send (health) | 200 | "3ms 238 B 200 OK"; body `"status": "ok"`, version 0.2.0, ready database/engine true | PASS | assets/e2e/w1_supervisor/186_api_reference_health_response.png | `GET /api/v1/health 200` (03:36:25Z) |
| A5 | Storage status → Test Request → Send (authenticated read) | 200 with the page's cookie | "5ms 487 B 200 OK"; body state READY, 4 TB total, volumes | PASS | assets/e2e/w1_supervisor/187_api_reference_storage_status_operation.png, assets/e2e/w1_supervisor/187b_api_reference_storage_client.png, assets/e2e/w1_supervisor/188_api_reference_storage_status_response.png | `GET /api/v1/storage/status 200 operator:OPR-002` (03:38:20.802Z) |
| A6 | Close the client | Closes | Escape ignored; the "Close Client" × closed it (O-16) | PASS | assets/e2e/w1_supervisor/192_api_reference_client_closed.png | — |
| A7 | Copy base URL | Clipboard | Toast "Base URL copied"; clipboard `http://127.0.0.1:5178` | PASS | assets/e2e/w1_supervisor/190_api_reference_copy_base_url.png | — |
| A8 | Download openapi.json | File | `openapi.json` 900,888 B, OpenAPI 3.1.0, info.version 0.2.1, 75 operations; toast "openapi.json saved" | PASS | assets/e2e/w1_supervisor/191_api_reference_download_openapi.png | — |
| A9 | Realtime panel | Live socket facts | "ONLINE", `ws://127.0.0.1:5178/ws`, sequence 3797 → 3890, epoch 26, clients 1, 19.5 meter frames/s, last 5 messages (types only on screen) | PASS | assets/e2e/w1_supervisor/187b_api_reference_storage_client.png, assets/e2e/w1_supervisor/192_api_reference_client_closed.png | — |

## 17. Sign out (user menu)

| Step | Action | Expected | Observed | Result | Screenshot | Route+status / audit row |
|---|---|---|---|---|---|---|
| X1 | User menu | Items | "Profile AKP Andi Pratama · Role: Supervisor · Lock console · Sign out" | PASS | assets/e2e/w1_supervisor/175_user_menu_open.png, assets/e2e/w1_supervisor/195_final_user_menu.png | — |
| X2 | Sign out (before the controller-ordered browser relaunch, 03:27Z) | Login, signed-out state | "You have been signed out.", state `signed-out` | PASS | assets/e2e/w1_supervisor/176_signed_out_before_relaunch.png | `POST /auth/sign-out 204`; audit 88 `AUTH_SIGNED_OUT` |
| X3 | Final sign out (03:40:35Z; and once more at the end, 03:42:29Z) | Same; no session cookie | "You have been signed out."; the browser's cookie list for the origin was empty | PASS | assets/e2e/w1_supervisor/196_final_signed_out.png, assets/e2e/w1_supervisor/203_final_sign_out_end_of_walk.png | `POST /auth/sign-out 204` ×2; audit 96 `AUTH_SIGNED_OUT` (the row of 03:42:29 was not read: reading the audit needs a sign-in) |
| X4 | Signed-out deep link | Login with return path | As L8 | PASS | assets/e2e/w1_supervisor/197_deep_link_signed_out.png | — |

## 18. Console and network per page (CDP Runtime / Log events)

Source: `w1_step_index.json` (per step) and `w1_page_console_network.json` (whole walk).

| Page | Console errors / warnings | Log entries (network) | Origins |
|---|---|---|---|
| Login | none | "Failed to load resource: 401" for the signed-out `GET /auth/session` probe (×4 across the walk) and for the wrong-password `POST /auth/sign-in` (both expected) | 127.0.0.1:5178 only |
| Stack Check, Dashboard, Start New Session, Evidence list and detail, Devices, Storage, Network & Time, Security & Audit, Users & Roles, Paired Devices | none | none | 127.0.0.1:5178 only (plus inline `data:` SVG icons) |
| Session Monitor | 1 warning at 03:23:22Z, during finalization: "[core-web] camera feed fallback … video timeout; showing the procedural feed" (O-8) | none | 127.0.0.1:5178 only (plus the snapshot as an inline `data:` JPEG) |
| System & Demo | none | "404" for my driver's probe `GET /api/v1/device` (not a page request) | 127.0.0.1:5178 only |
| API Reference | 1 warning at 03:38:20Z from the Scalar client: "We're trying to add a Cookie header, but browsers often omit them for cross-origin requests…" (O-8) | none | 127.0.0.1:5178 only |
| Lock / sign-out | none | "401" for my driver's audit read while locked | 127.0.0.1:5178 only |

Every request and socket of the walk went to the page origin `127.0.0.1:5178` (5,411 http, 28 ws). 0 requests went to `localhost`, to 4420 to 4422 or 5173/5176/5177 (the aborted attempt 0 shows the other agent's navigation to 5173, §19 IN-1).

## 19. Incidents

| ID | What | Evidence | Effect and handling |
|---|---|---|---|
| **IN-1** (caused by E2E-W2, not a product defect) | At 09:41:55 WIB another agent started a headless shell on the same fixed DevTools port 9431, one second after mine. Mine held `127.0.0.1:9431` (pid 63921); theirs bound `[::1]:9431` (pid 63935). Their driver reached my browser through `127.0.0.1:9431`, navigated it to `http://127.0.0.1:5173/login` (the main instance, which I never touch), then typed into my lane-3 page and signed `budi.santoso` in | `lsof -iTCP:9431` (two listeners); `aborted_run0_port_collision/w1_cdp_events.jsonl` (navigation to 5173, `POST /api/v1/auth/sign-in 200` at 02:42:09.6Z that my step never sent); Core log 02:42:09.636Z `POST /auth/sign-in 200`, then `operator:OPR-001` socket and three reads; audit 95 `AUTH_SUCCESS` OPR-001 (epoch 24) | I signed that OPR-001 session out from my own browser (audit 96 `AUTH_SIGNED_OUT` OPR-001, 02:43:25Z), moved attempt 0's files to `aborted_run0_port_collision/`, removed the profile and restarted on 9473 (verified free). At 10:27, per the controller's note, I relaunched on an OS-assigned port read from `DevToolsActivePort`, checked the listener PID, and made the driver refuse any endpoint that is not that browser. The controller's description matches this evidence. No later step was affected. During the walk window the Core log shows only `operator:OPR-002` and anonymous requests (OPR-001: 0) |
| **IN-2** (process slip of this row) | After the second code expired (P5), the panel still shows the expired code as two groups of three digits. My step read that panel's text; my redaction then covered only 6 contiguous digits, so the expired code appeared in this agent's own tool output and in one line of `w1_observations.jsonl` | Step 73 | The code was already dead: closed as EXPIRED by the Core (audit 93) before it was read, single-use and 5-minute by design. Within minutes I replaced it in the file with `### ###` and widened the redaction in the library, recorder and summarizer to 3+3 groups. It appears on no screenshot (blurred, checked visually). The final count-only scan finds 0 such groups in any output file. Disclosed here, value not repeated |

## 20. Defects

| ID | Severity | Page | Defect | Repro | Expected | Observed | Evidence |
|---|---|---|---|---|---|---|---|
| **E2E-W1-1** | High | Session Monitor / Evidence (custody) | The chain of custody names the session's creator, not the operator who acted, for RECORDING_STOPPED (and RECORDING_STARTED) | Lane 3, demo scenario Recording (session created and started by OPR-001); sign in as OPR-002; Session Monitor → End Session (hold) → reason → confirm → View evidence → Hash & Integrity → Chain of custody | RECORDING_STOPPED actor = OPR-002, who ended the recording, as the audit row of the same instant says. VERIFIED custody rows do name the acting operator (V8) | Custody "RECORDING_STOPPED · AKP Budi Santoso"; Core record `GET /api/v1/evidence/EV-20261006-0014` → `custody[1] = {action: RECORDING_STOPPED, actorId: OPR-001, at: 03:23:20.254Z}`; audit 236 `RECORDING_STOPPED` `actorId: OPR-002` at 03:23:20.254Z | assets/e2e/w1_supervisor/162_evidence_new_item_custody.png; `w1_observations.jsonl` step "63c custody actor"; code `packages/shared/src/sim/session-machine.ts:840-841` (`actorId: session.createdBy` for both entries) |
| **E2E-W1-2** | Medium | Dashboard | The Dashboard's device menus disable "Test signal" for SUPERVISOR with "Requires the Technician role", although the Core grants it and the Devices page offers it | Sign in as SUPERVISOR → Dashboard → Camera 1 (or MIC 1) actions | Test signal enabled for a role holding `DIAGNOSTICS_RUN` (contract op 49 `testDeviceSignal`, `packages/shared/src/api/devices.ts:13`; SUPERVISOR holds it per the role matrix, U1) | Disabled with the Technician hint. The same command from Devices was accepted (`POST /api/v1/device/:id/test-signal 204`, audit 108) | assets/e2e/w1_supervisor/08_dashboard_camera1_menu.png, assets/e2e/w1_supervisor/10_dashboard_mic1_menu.png, assets/e2e/w1_supervisor/90_devices_camera1_test_signal.png; code `apps/core-web/src/features/dashboard/devices-panel.tsx:44,158` (`disabledKeys` gates `test` and `restart` on `DEVICE_MANAGE`). Note: W63's lane check recorded the Dashboard behaviour as expected (its spec S20 groups Test signal under DEVICE_MANAGE), so the dashboard spec disagrees with the contract: a ruling is needed |
| **E2E-W1-3** | Medium | Evidence detail | The integrity card titled "Verdict of the Core server" opens as "NOT VERIFIED, 0 of 6 checks" even when the Core's record holds a PASS verification, while the list preview shows "Last verification PASS" for the same item | Verify EV-20261006-0012 (PASS), then reload `/evidence/EV-20261006-0012?tab=integrity`; compare with the list's preview card | The card shows the Core's stored verdict (or says it has not been re-run in this view) | "NOT VERIFIED"; Core `evidence.verification = {status: PASS, at: 02:59:26.833Z}`; list preview "Last verification PASS" | assets/e2e/w1_supervisor/71_evidence_detail_integrity_after_reload.png, assets/e2e/w1_supervisor/72_evidence_list_preview_after_verify.png; code `apps/core-web/src/features/evidence/integrity-tab.tsx:53-54` (`state.verdict ?? 'NOT_RUN'`, the stored verification is not read). No spec line fixes the initial state (69 spec A6 covers the run): ruling needed |
| **E2E-W1-4** | Medium | Evidence detail, Metadata tab | For a Live item joined to a bundled DEMO package by number, the Metadata tab shows that package's manifest (another item: evidence ID, session, case, times) with no notice that it differs from the Core's record | Open EV-20261006-0012 → Metadata → `metadata.json` | This item's record, or a visible notice that the bundled package is a different record (as the Integrity tab does for hash differences, §14 point 7) | Manifest Session `SES-20261001-0022`, case `LP/2026/0930-0004`, 1 Oct 2026 08:56–09:12, `"evidenceId": "EV-20261001-0012"`; header and Core record: `SES-20261006-0022`, `LP/2026/1005-0004`, 2026-10-05T18:06:24Z | assets/e2e/w1_supervisor/66_evidence_detail_metadata.png, assets/e2e/w1_supervisor/67_evidence_detail_metadata_document.png; `w1_observations.jsonl` step "27e core record". Related known finding F69-4 (Metadata tab not reworded for Live mode, for W87/W88) |
| **E2E-W1-5** | Low | Dashboard | Hero ring: the status word "ATTENTION" is wider than the inner ring at 1440x900 (letters cut by the ring stroke) | Any attention state, 1440x900 | Word inside the ring | Overflows both sides | assets/e2e/w1_supervisor/05_dashboard_after_sign_in.png (also 16, 145) |
| **E2E-W1-6** | Low | Dashboard, 390x844 | Status strip labels overlap at 390 px | Viewport 390x844, Dashboard | Legible labels | "3.2 TB Free" overlaps "Synchronized", which overlaps "Secure"; "Connected" cut at the right edge | assets/e2e/w1_supervisor/24_dashboard_narrow_390x844.png |

### Observations (no FAIL: by design, environment, or no spec line)

| ID | Observation | Evidence |
|---|---|---|
| O-1 | Stack Check (a placeholder page) says "wired to the local mock-core heartbeat" in Live mode, where the heartbeat comes from the Core server | 06 |
| O-2 | Export wizard authorise step says "Every attempt is recorded in the audit log", but for a permitted role it sends nothing (spec D-6); only the export itself is audited (106) | 78; step index 32a/32b |
| O-3 | `FAULT_RAISED` / `FAULT_CLEARED` rows from operator-injected demo faults carry `actorId: null` (System); `SCENARIO_LOADED` names the operator | audit 119 to 126 |
| O-4 | An auto-archive-only policy change is audited as "Retention policy set to DAYS_90 (90 days)" (the message does not mention auto-archive; `details` not inspected) | audit 112, 113 |
| O-5 | The 12-hour clock choice is saved (`POST /api/v1/settings 200`) but nothing in the console reads `timeFormat` (only `settings-panel.tsx:148-149`) | 134 |
| O-6 | "Start with last profile" and "Start from template…" both open an empty step 1 (`active-session-panel.tsx:108`, `onOption` ignores the key) | 199, 200 |
| O-7 | The API Reference curl sample sends cookie `dems_session_4420`; lane 3's cookie is `dems_session_4423`. The document states the pattern `dems_session_<listen port>` with the main instance as the example (`packages/shared/src/api/openapi.ts:121-123, 484`) | 187b |
| O-8 | Two console warnings: the camera feed fallback during finalization (03:23:22Z) and the Scalar client's cookie-header notice (03:38:20Z) | §18 |
| O-9 | In the throw-away headless profile, a second automatic download from the origin is held back by Chrome's automatic-downloads limiter. Affected: the first log-bundle file (Sy8) and Security & Audit "Download again" (Sa11). After `Browser.setPermission automatic-downloads granted` the next export downloaded (Sy9). A real browser asks the user; not attributed to the app | step index 49c, 50 |
| O-10 | Archive runs without a confirmation (spec B-1) | 83 |
| O-11 | A date range with "to" before "from" shows the generic empty state, no inline hint | 52 |
| O-12 | After expiry the expired code and QR stay on screen, dimmed, under "The code expired." (blurred in the capture) | 182 |
| O-13 | Pairing audit messages name the code record `PCD-…`, not the code (correct per SR-54) | audit 90 to 93 |
| O-14 | The Recording scenario's session reused `SES-20261006-0024`, the ID of the session cancelled in epoch 24 (IDs are per rebuilt dataset) | audit 102 vs 217 to 237 |
| O-15 | "Earlier chains" listed one chain (epoch 18, reset 02:06:24) while the epoch read 24 at the start of the walk; whether epochs 19 to 23 discarded chains was not investigated (unknown) | 116; `GET /demo/status` |
| O-16 | Escape does not close the diagnostics modal or the Scalar Try it client (their Close buttons do); other dialogs and overlays close on Escape | Sy4, A6 |
| O-17 | The Recording scenario was used because a Live recording needs a connected paired tablet; Start Recording from the wizard (N12) still needs a run with a paired device (E2E-T covers a tablet-started session) | N12 |

## 21. State left on lane 3

`dems_lane_3` after the walk, as read through the console and its API: demo epoch 26, scenario idle, 0 active faults. Users at their seeded roles, all enabled (Core list after U7). Storage policy 90 days with auto-archive on (Core after St8). No active pairing code (expired, audit 93); 0 paired devices. The console signed out (`POST /auth/sign-out 204` 03:42:29Z). The walk's evidence changes (export of EV-20261006-0012, archive of EV-20261004-0001, the sealed EV-20261006-0014) belonged to epochs 24 and 25; the demo reset rebuilt the dataset (not re-checked item by item). Servers 4423 and 5178 still answered at 10:42 WIB (`"status":"ok"`, HTTP 200). The browser, the recorder, both profiles and the download folder were stopped or removed. No server, Vite, Metro, emulator or PostgreSQL was started, stopped or touched; no port outside 5178, 4423 and my DevTools ports was used.

## 22. Secret hygiene

Final count-only scan of every output file of this row, including this report and the progress file (17 text files, 208 PNG files byte-scanned for the password): password occurrences 0 (text and PNG); `ses_`/`dvc_`/`bio_` tokens 0. Two 6-digit runs remain and neither is a code: the byte count of `openapi.json` in `w1_observations.jsonl`, and the 280-second wait (written in milliseconds) in `w1_steps_driver.mjs.txt`. Five 3+3 digit matches remain, all source line ranges in the two documents (`top-bar.tsx`, `session-machine.ts` ×2, `settings-panel.tsx`, `openapi.ts`). The data files hold 0. Every context was checked with the digits masked. The Vite HMR socket query `token=` (Vite's dev-server token, not an app credential) was replaced with `token=***` in both events files. Pairing codes appear on no screenshot (blur verified by computed style and visually). Request bodies, cookie values and frame payloads were never recorded.

## 23. Screenshot index

Paths relative to this file: `assets/e2e/w1_supervisor/`.

- 01_login_live_idle.png: Login in Live mode, Data mode selector on Live, Core status strip
- 02_login_wrong_password_before.png: form filled with a wrong password (masked field)
- 02_login_wrong_password_after.png: "Invalid username or password. 4 attempts remaining"
- 03_login_mode_switch_dialog.png: "Switch to Simulated mode?" confirmation (cancelled)
- 04_login_filled_before_sign_in.png: form filled for andi.pratama (password field masked)
- 05_dashboard_after_sign_in.png: Dashboard after sign-in, LIVE, attention ring (E2E-W1-5)
- 06_stack_check_live.png: Stack Check with the live Core heartbeat
- 07_stack_check_test_toast.png: Stack Check test toast
- 08_dashboard_camera1_menu.png: Camera 1 menu, Test signal disabled for SUPERVISOR (E2E-W1-2)
- 09_dashboard_camera1_details.png: Details → Devices page
- 10_dashboard_mic1_menu.png: MIC 1 menu, same gating (E2E-W1-2)
- 11_dashboard_more_start_options.png: More start options menu
- 12_dashboard_notifications.png: notifications popover, no new alerts
- 13_dashboard_attention_pill.png: integrity checks, operator tablet link needs attention
- 14_dashboard_device_id.png: Device ID pressed (tooltip trigger, no popover)
- 15_dashboard_mode_indicator_dialog.png: LIVE indicator → switch dialog
- 16_dashboard_tile_tpm.png: TPM tile pressed (tooltip trigger)
- 17_dashboard_tooltip_tpm.png: TPM tile tooltip on hover
- 18_dashboard_tooltip_device_id.png: Device ID tooltip on hover
- 19_dashboard_open_evidence_queue.png: Open Evidence Queue → evidence, status RECORDED
- 20_dashboard_strip_time.png: strip GNSS/Time → Network & Time
- 21_dashboard_view_all_events.png: View All Events → Security & Audit
- 22_dashboard_quick_run_diagnostics.png: quick action Run Diagnostics → System
- 23_dashboard_sealed_view_all.png: sealed evidence View All → Evidence
- 24_dashboard_narrow_390x844.png: Dashboard at 390x844, bottom tabs, strip overlap (E2E-W1-6)
- 25_reload_deep_link_devices.png: reload of /devices while signed in
- 26_session_new_info_step_empty.png: wizard step 1, empty
- 27_session_new_case_number_invalid.png: invalid case number, inline rule
- 28_session_new_investigator_suggestions.png: investigator suggestions
- 29_session_new_room_select.png: room select
- 30_session_new_profile_select.png: recording profile select
- 31_session_new_info_step_filled.png: step 1 filled, preview with readiness
- 32_session_new_devices_step_checks.png: step 2 pre-checks, Core BLOCK
- 33_session_new_devices_step_core_blocked.png: "Recording is blocked" alert, no paired tablet
- 34_session_new_rerun_in_progress.png: re-run checks in progress
- 35_session_new_rerun_blocked_again.png: re-run blocked again
- 36_session_new_back_to_info.png: Back to step 1, data kept
- 37_session_new_cancel_dialog.png: "Discard this session?" dialog
- 38_session_new_cancelled.png: "Session discarded." on the Dashboard
- 39_session_monitor_idle.png: Session Monitor, no session
- 40_session_monitor_camera2.png: Camera 2 selected (idle)
- 41_session_monitor_reverify_running.png: Re-verify running
- 42_session_monitor_reverify_done.png: chain result PASS • 102 rows
- 43_evidence_list_live.png: Evidence list, 13 items
- 44_evidence_search_indah.png: search "Indah"
- 45_evidence_filter_sealed.png: status Sealed, 10
- 46_evidence_filter_under_review.png: status Under Review, 1
- 47_evidence_filter_recorded.png: status Recorded, 1
- 48_evidence_filter_archived_empty.png: status Archived, empty state
- 49_evidence_filter_subject_saksi.png: subject Saksi, 8
- 50_evidence_filter_saksi_andi.png: Saksi + Andi Pratama, 3
- 51_evidence_filter_date_from.png: from 2026-10-06, 5
- 52_evidence_filter_date_to_before_from.png: to before from, empty
- 53_evidence_filter_date_range_one_day.png: one-day range, 5
- 54_evidence_sort_subject_first.png: sort Subject ascending
- 55_evidence_sort_subject_second.png: sort Subject descending
- 56_evidence_sort_duration.png: sort Duration ascending
- 57_evidence_page_2.png: page 2, 11–13 of 13
- 58_evidence_row_menu.png: row menu View/Verify/Export/Archive
- 59_evidence_bulk_bar_one_selected.png: bulk bar, 1 selected
- 60_evidence_bulk_export_wizard.png: bulk export wizard (cancelled)
- 61_evidence_row_verify.png: row Verify → integrity PASS toast
- 62_evidence_detail_overview.png: evidence detail header
- 63_evidence_detail_media_playing.png: media playing
- 64_evidence_detail_media_camera2_mic2.png: Camera 2 and MIC 2
- 65_evidence_detail_media_track_audio02.png: paused, track AUDIO-02
- 66_evidence_detail_metadata.png: Metadata tab with another item's manifest (E2E-W1-4)
- 67_evidence_detail_metadata_document.png: metadata.json of EV-20261001-0012 (E2E-W1-4)
- 68_evidence_detail_integrity.png: Hash & Integrity tab
- 69_evidence_detail_chain_of_custody.png: chain of custody
- 70_evidence_detail_verify_again.png: Verify again PASS
- 71_evidence_detail_integrity_after_reload.png: after reload, "NOT VERIFIED" (E2E-W1-3)
- 72_evidence_list_preview_after_verify.png: list preview "Last verification PASS" (E2E-W1-3)
- 73_evidence_detail_more_menu.png: More menu
- 74_evidence_detail_copy_id.png: "Evidence ID copied"
- 75_evidence_detail_download_manifest.png: "Manifest downloaded (DEMO)"
- 76_evidence_export_reason_too_short.png: export reason step with a short reason
- 77_evidence_export_reason_filled.png: reason and destination filled
- 78_evidence_export_authorise_step.png: authorise step
- 79_evidence_export_short_reason_pressed.png: Next with a short reason refused
- 80_evidence_export_verify_source.png: verify source 6/6 PASS
- 81_evidence_export_results.png: export accepted
- 82_evidence_export_downloaded.png: export manifest downloaded
- 83_evidence_archive_dialog.png: "EV-20261004-0001 archived" toast
- 84_evidence_archived_row.png: archived row and updated counts
- 85_devices_live.png: Devices & Inputs, tablet offline banner
- 86_devices_camera1_menu.png: Camera 1 menu on Devices (Test signal enabled)
- 87_devices_camera1_drawer_overview.png: Camera 1 drawer Overview
- 88_devices_camera1_drawer_health.png: drawer Health
- 89_devices_camera1_drawer_log.png: drawer Log
- 90_devices_camera1_test_signal.png: "Test signal sent to Camera 1"
- 91_devices_camera1_identify.png: "Camera 1 is blinking its indicator"
- 92_devices_mic1_menu.png: MIC 1 menu on Devices
- 93_devices_camera2_tile.png: Camera 2 tile → drawer
- 94_devices_audio_input_mic1.png: MIC 1 card pressed (display element)
- 95_devices_front_panel_lcd_enter.png: front panel LCD page 2/4
- 96_devices_port_mgmt_lan.png: MGMT LAN port → Tablet Control drawer
- 97_devices_tablet_control_drawer.png: Tablet Control drawer, 0 paired
- 98_devices_led_fault_tooltip.png: LED hover (display element)
- 99_storage_live.png: Storage page
- 100_storage_calculator_before.png: calculator before changes
- 100_storage_calculator_changed.png: calculator after Increase/Decrease
- 100b_storage_calculator_reset.png: calculator reset to the book example
- 101_storage_manage_drawer.png: Manage Storage drawer
- 102_storage_policy_pending_change.png: retention 1 year pending
- 103_storage_policy_applied.png: "Storage policy updated"
- 104_storage_policy_restored.png: back to 90 days
- 105_storage_auto_archive_off_pending.png: auto-archive off pending
- 106_storage_auto_archive_restored.png: auto-archive back on
- 107_network_time_live.png: Network & Time
- 108_network_time_charts.png: Network & Time charts, live values
- 109_security_audit_live.png: Security & Audit with this walk's rows
- 110_security_audit_verify_chain.png: Verify chain PASS 113
- 111_security_audit_show_in_log.png: Show in log
- 112_security_audit_search_storage.png: search "Storage"
- 113_security_audit_filter_authentication.png: type Authentication
- 114_security_audit_filter_auth_warning.png: Authentication + Warning, row #97
- 115_security_audit_filter_operator.png: operator Andi Pratama
- 116_security_audit_earlier_chains.png: earlier chains list
- 117_security_audit_live_off.png: Live switch off
- 118_security_audit_export_dialog.png: Export audit dialog
- 119_security_audit_export_result.png: export result, chain PASS
- 120_security_audit_export_downloaded.png: Download again (no second file, O-9)
- 121_security_audit_live_on_again.png: Live switch on again
- 122_system_live.png: System & Maintenance
- 123_system_diagnostics_running.png: diagnostics running
- 124_system_diagnostics_done.png: diagnostics 8 of 8 passed
- 125_system_install_update_locked.png: Install update locked for SUPERVISOR
- 126_system_restart_services_locked.png: Restart services locked
- 127_system_export_logs_reason_required.png: Export logs, reason required
- 128_system_export_logs_progress.png: "Logs exported" toast
- 129_system_export_logs_done.png: export logs dialog closed
- 130_system_export_logs_downloaded.png: second export with the file downloaded
- 131_system_settings_account.png: settings Account
- 132_system_presentation_mode_on.png: presentation mode on
- 133_system_reduce_motion_toggled.png: reduce motion toggled
- 134_system_clock_12h.png: clock format 12-hour
- 135_system_notifications_toggled.png: notifications switch toggled
- 136_system_active_camera_video02.png: live camera Camera 2
- 137_system_settings_maintenance.png: settings System Maintenance
- 138_system_settings_about.png: settings About
- 139_system_demo_panel_open.png: Demo Control Panel open
- 140_demo_fault_mic1_no_signal_raised.png: MIC 1 no signal injected
- 141_demo_fault_devices_mic1_no_signal.png: Devices shows MIC 1 NO SIGNAL
- 142_demo_fault_mic1_cleared.png: fault cleared
- 143_demo_time_source_ntp.png: time source NTP fallback
- 144_demo_two_faults_raised.png: camera loss + fan stall
- 145_demo_two_faults_dashboard.png: Dashboard with two faults
- 146_demo_clear_all_faults.png: "All faults cleared"
- 147_demo_load_recording_confirm.png: Load Recording scenario confirmation
- 148_demo_scenario_recording_loaded.png: Recording scenario loaded
- 149_session_monitor_recording_reading_1.png: recording, first reading
- 150_session_monitor_recording_reading_2.png: recording, second reading (timer, meters moved)
- 151_session_monitor_marker_input.png: Add Marker input
- 152_session_monitor_marker_added.png: "Marker added"
- 153_session_monitor_note_drawer.png: Session Note drawer
- 154_session_monitor_note_added.png: "Note added"
- 155_session_monitor_paused.png: monitoring paused
- 156_session_monitor_snapshot.png: snapshot captured
- 157_session_monitor_fullscreen.png: fullscreen feed overlay
- 158_session_monitor_end_dialog.png: End Session dialog
- 159_session_monitor_finalizing.png: finalization in progress
- 160_session_monitor_sealed.png: EV-20261006-0014 sealed
- 161_evidence_detail_new_sealed_item.png: new sealed item detail
- 162_evidence_new_item_custody.png: custody names AKP Budi Santoso for the stop (E2E-W1-1)
- 163_session_monitor_after_seal.png: Session Monitor, SESSION SEALED
- 164_demo_reset_confirm.png: Reset demo confirmation
- 165_demo_reset_done.png: "Demo reset: idle scenario, faults cleared"
- 166_users_roles_live.png: Users & Roles with the role matrix
- 167_users_roles_own_role_dialog_hint.png: own role dialog, last-administrator hint
- 168_users_roles_change_role_dialog.png: change role dialog for OPR-003
- 169_users_roles_role_changed.png: Rina Wijaya now Investigator
- 170a_users_roles_restore_role_dialog.png: restore role dialog
- 170_users_roles_role_restored.png: Rina Wijaya back to Technician
- 171_users_roles_disable_dialog.png: disable dialog for OPR-001
- 172_users_roles_user_disabled.png: AKP Budi Santoso disabled
- 173_users_roles_enable_dialog.png: enable dialog
- 174_users_roles_user_enabled.png: AKP Budi Santoso enabled
- 175_user_menu_open.png: user menu open
- 176_signed_out_before_relaunch.png: signed out before the browser relaunch
- 177_relaunch_signed_in_again.png: signed in again in the relaunched browser
- 178_paired_devices_live_empty.png: Paired Devices, 0 paired
- 179_paired_devices_code_issued_masked.png: code issued (code and QR blurred)
- 180_paired_devices_code_cancelled.png: code cancelled
- 181_paired_devices_second_code_masked.png: second code issued (blurred)
- 182_paired_devices_code_expired.png: "The code expired." (blurred)
- 183_api_reference_live.png: API Reference in Live mode
- 184_api_reference_health_operation.png: health operation
- 185_api_reference_client_health.png: Try it client for health
- 186_api_reference_health_response.png: health response 200 OK
- 187_api_reference_storage_status_operation.png: storage status operation
- 187b_api_reference_storage_client.png: storage operation with the realtime panel
- 188_api_reference_storage_status_response.png: storage status response 200 OK (authenticated)
- 190_api_reference_copy_base_url.png: "Base URL copied"
- 191_api_reference_download_openapi.png: "openapi.json saved"
- 192_api_reference_client_closed.png: client closed, realtime panel live
- 193_lock_console.png: "Console locked. Sign in again to continue."
- 194_signed_in_after_lock.png: signed in after the lock
- 195_final_user_menu.png: user menu before the final sign-out
- 196_final_signed_out.png: "You have been signed out."
- 197_deep_link_signed_out.png: deep link while signed out → Login with redirect
- 198_login_password_toggle_visible_test_text.png: password toggle with a non-secret test text
- 199_dashboard_start_with_last_profile.png: Start with last profile → step 1
- 200_dashboard_start_from_template.png: Start from template → step 1
- 201_system_quick_software_update.png: quick action Software Update
- 202_evidence_header_play.png: header Play on the detail page
- 203_final_sign_out_end_of_walk.png: final sign-out at the end of the walk
- aborted_run0_port_collision/01_login_live_idle.png: attempt 0 (IN-1), page taken over by the other agent's driver (not evidence of the product)

## 24. Files of this row

- `test/07a_e2e_web_supervisor.md` (this report)
- `test/assets/e2e/w1_supervisor/`: 207 screenshots; `w1_core_requests.txt`; `w1_cdp_events.jsonl`; `w1_markers.jsonl`; `w1_observations.jsonl`; `w1_step_index.json`; `w1_page_console_network.json`; drivers `w1_steps_driver.mjs.txt`, `w1_driver_lib.mjs.txt`, `w1_driver_recorder.mjs.txt`, `w1_driver_run.mjs.txt`, `w1_driver_summarize.mjs.txt`; `aborted_run0_port_collision/` (IN-1)
- `delegation_progress/e2e_w1_supervisor.md`

---
*Generated: 2026-10-06 10:44 WIB*
*Last Updated: 2026-10-06 10:58 WIB*
