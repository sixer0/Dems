---
task_id: RF-T
task_slug: final-retest-tablet-lane2
date: 2026-10-06
agent: verifier
decision_refs: [D212, D216, D218]
status: needs-review
narrative_tier: 2
assets: test/assets/retest2/t/
before: test/08c_retest_tablet.md, test/assets/retest/t_tablet/
---

# RF-T — final independent re-test on the tablet: CF-M2 (R-T-1..4) and CF-M1 (web-stop hand-over) in the tablet layout

## 1. Environment

| Item | Value | How verified |
|---|---|---|
| Device | `dems2_tablet`, adb serial `emulator-5556`, 2560 × 1600, tablet landscape layout (navigation rail, list and detail panes). Only this serial was addressed; `emulator-5554` and `-5558` were listed by `adb devices` and not touched | `adb devices -l`, `wm size` (16:35) |
| App | `com.dems.demo.tablet`, debug build, JavaScript from Metro 8081 | driver `pid` verb |
| Fresh bundle | `am force-stop` at 16:38:07.335, then `am start -a android.intent.action.VIEW -d 'demsdemo:///login?core=LIVE&motion=off'` at 16:38:09.300. The app process changed from pid 8856 to **12423**, which then stayed the same until the end (17:27:30). Metro printed three `Android Bundled … expo-router/entry.js` lines and two `Live source ready` lines at 16:38:21.630 and 22.846 (another device relaunched at the same moment). The tablet's first request after the relaunch: device 16:38:23.254 `GET /api/v1/auth/session 401`, Core 16:38:22.285 `[tablet]` | `q/001.out`, `q/002.out`; `.cache/manual/metro.log` lines 1404–1434; `core_log_lane2_window.txt` |
| Reverse rules, unchanged at start and end | `tcp:8081 → 8081`, `tcp:4420 → 4422` | `adb -s emulator-5556 reverse --list` at 16:35 and 17:27 |
| Core | lane 2 `http://127.0.0.1:4422`, `dems-core-server` 0.2.0, API v1, database and engine ready, uptime 15,830,491 ms at 16:35:58 (running since the 12:12 start). Nothing was started or stopped | `GET /api/v1/health` (16:35:58) |
| Web console | `http://127.0.0.1:5177`, Live, proxied to 4422 (`GET /` 200; `/api/v1/health` through 5177 200) | curl (16:35) |
| Browser | Playwright-cache `chromium_headless_shell-1243`, raw CDP, `--remote-debugging-port=0`. **Instance 1**: port 52619 from `DevToolsActivePort`, `lsof` listener pid 4668 = the launched process; 16:41:50–17:10:11. **Instance 2** (relaunch, §7 D-RF-T-2): port 60306, listener pid 51266 = launched process; 17:10:20–17:27:19. Fresh profile in `/tmp/claude-501/rf_t/` each time, removed at the end. Instance 2 made 928 requests and 5 sockets, all to `127.0.0.1:5177`, with 0 console errors | `misc/web_chrome_launch.txt`; `wq/net_final.txt` (last lines) |
| Operators | `budi.santoso` INVESTIGATOR (OPR-001) on the tablet; `andi.pratama` SUPERVISOR (OPR-002) on the web. The drivers import the password from the shared dataset constant and never print it | drivers; §7 |
| Timing method | Core times come from the lane-2 log (`request completed` lines) and from the audit rows. Web times come from the web driver (host clock). Tablet times come from `screenrecord --bugreport --size 1280x800`: each frame carries the device time, and a frame is only written when the screen changes. Device time per frame = the first overlay time + the frame's PTS (checked against a second overlay in every clip). Device − host clock offsets were measured with 5 bracketed reads before each clip: median −461 ms (16:44:49), −456 (16:51:58), −455 (17:07:32), −473 (17:11:12), −479 ms (17:16:40) | `q/017.out`, `q/027.out`, `q/034.out`, `q/036.out`, `q/041.out`; `rec/*_frame_pts.txt` |
| Host load (1 min) | 16:35 10.21 · 16:37 7.98 · 16:41 5.78 · 16:44 11.56 · 16:50 6.02 · 16:51 12.07 · 17:03 13.94, then 16.97: **paused** until 11.97 at 17:07:07 · 17:16 5.77 | `uptime` before each heavy step |
| Window | 16:35–17:28 | `q/events.log`, `wq/events.log` |

Method. R-T's drivers were reused and stored as `drivers/*.txt`:

- `rf_drive_q.mts` is `rt_drive_q.mts` with four changes: a start number, a 1,800 s idle limit, a `screenrecord` watchdog (kill after the time limit + 12 s; it never fired), and the verbs `crash` and `pid`.
- `rf_web_q.mjs` is `rt_web_q.mjs` with a start number added.
- `qsend`, `corelog`, `scan` and the launcher only had their paths changed.
- New: `frames.py`, `summarise.py` and `render_clusters.py`, the frame analysers (§4).

The driver taps only while the app has the focus and no keyguard shows. It types the password only into an IME password field, and takes no capture between the password and the `sign-in 200`. The first capture after the tablet sign-in came at 16:39:04, 5.4 s after the 16:38:58.765 Core answer.

`uiautomator dump` ran 12 times, on Evidence, Network & Time, the Sessions hub and More only; each dump file was deleted on the device.

## 2. Summary

| Measure | Result |
|---|---|
| Targeted items R-T-1..R-T-4 | **3 / 4 PASS, 1 PARTIAL.** R-T-1, R-T-2 (all three parts) and R-T-3 pass. R-T-4: the list column passes, but the detail pane shrank to about 206 dp: the subject name is not drawn and labels break inside words (new defect RF-T-2) |
| Crash check: 3 web stops while the tablet records on the monitor | **3 / 3: 0 crashes, Finalizing in the frame right after the last Live frame each time, 0 false "Core link lost" banner frames, 0 backward timer steps.** No blank frame at any Live→Finalizing hand-over. But 3 single blank frames at other screen changes in the same recordings (RF-T-4), and the monitor timer **froze**: 10.1 s at 00:00:17 in run 1, ≥ 7.3 s at 00:00:00 in run 2 (RF-T-3). Strictly, the "0 blank frames" criterion is not met over the whole recordings |
| Smoke walk (tablet layout) | **8 / 8 screens PASS**: Home, Sessions hub, Evidence detail (Media, Metadata, Hash & Integrity, custody), Devices, Storage, Network & Time, Audit, Settings. Sign out lands on Login. Values agree with the Core (audit total 278 / head `9de12f12` on both) |
| New defects | **5**: RF-T-1 (proposed Medium) the Evidence row that loses the selection is drawn empty, 3/3; RF-T-2 (Medium) Sessions hub detail pane squeezed; RF-T-3 (Medium) monitor timer freezes; RF-T-4 (Low) single blank frames at route changes; RF-T-5 (Low) Network & Time "Last Sync" time hidden (also in round 1, not reported then) |
| Crash-class log lines | **0** (`addViewAt`, `Tried to remove view`, `handleHostException`, `reactInstance is null`, `FATAL`, `IndexOutOfBounds`) from 16:37:50 to 17:27:30. The app pid was 12423 throughout. Also 3,667 Reanimated `W` lines "synchronouslyUpdateUIProps failed for tag N" (O-RF-T-2) |
| JS log | 1 `W/ReactNativeJS` line (the Reanimated reduced-motion notice at launch, 16:38:21.639); 0 `E/ReactNativeJS`; no link-loss, offline or timeout record |
| End state | Tablet on Login in LIVE: "You have been signed out.", Core online, "Core: DEMS-IR-01 • paired as DEV-0001" (`S09_signout_lands_on_login.png`, 17:26:46; `POST /auth/sign-out 204` 17:26:40.143). Nothing recording: `GET /session/current` shows SES-20261006-0030 SEALED (17:27:09). Web signed out (`sign-out 204`, then `auth/session 401`). Browser closed, profile removed, no listener on 60306. Reverse rules unchanged; no recording or dump file left on the device; keyguard never shown |

## 3. Targeted items (before / after)

"Before" = R-T capture under `test/assets/retest/t_tablet/`; "After" = this row's capture under `test/assets/retest2/t/`. Times are host-clock local (UTC+07:00); device times are given with their host equivalent.

| Item | Before (file) | After (file) | Observed (timestamps) | Result | Log / audit line |
|---|---|---|---|---|---|
| 0 Relaunch (precondition) | `00_before_relaunch.png` (R-T) | `00_before_relaunch.png`, `01_login_live_after_relaunch.png`, `02_after_signin_budi.png`, `03_home_budi_after_not_now.png` | force-stop 16:38:07.335, link 16:38:09.300, Login "Core online", "paired as DEV-0001" at 16:38:27; budi signed in, biometric offer → Not now | PASS | 16:38:22.285 `GET /api/v1/auth/session 401` [tablet]; 16:38:58.765 `POST /api/v1/auth/sign-in 200` [tablet]; audit #220 `AUTH_SUCCESS` OPR-001 16:38:58.756 |
| **R-T-1** disabled Archive item in Evidence detail → More shows its title with the reason under it | `P07e_evidence_more_menu.png`, `misc/p07e_more_menu_crop_brightened.png` (no title) | `A1_evidence_detail_more_menu_0017.png` (16:39:52), `A2_evidence_row_menu_0017.png` (16:40:15), comparison `A3_archive_title_before_P07e_after_A1_A2.png` | Detail More menu: "**Archive**" (danger colour, dimmed), then "Archiving needs the Supervisor role" under it, then "Download manifest". List row menu (⋮ of EV-20261006-0017): View, Verify, Export, "**Archive**" with the same reason under it. Both menus closed without choosing anything | **PASS** | no request (the menu is local). The popover is not in the uiautomator window, so the pixels are the evidence |
| **R-T-2a** item the Core verified: EV-20261006-0015 | `J28_tablet_evidence_hash_integrity.png`, `P07c_evidence_detail_hash_integrity.png` (always "Verified by the Core") | `B2_hash_integrity_0015_verified.png` (16:41:44) | Heading "**Verified by the Core**", "Core record", then "**Last verification PASS · 6 Oct 2026 10:47:45 UTC+07:00 · AKP Andi Pratama**", "Verify again to see each check.", button "Verify again". uiautomator: `evidence-integrity-heading-PASS`, `evidence-verify-last-PASS` | **PASS** | Core record (`wq/api_1791279749617.json`): `verification {status PASS, at 10:47:45.548}`, custody `VERIFIED` OPR-002 10:47:45.548. 16:41:00.415 `GET /api/v1/evidence/:id 200` [tablet] |
| **R-T-2b** item never verified: EV-20261006-0017 | as above | `B1_hash_integrity_0017_not_verified.png` (16:40:30), `B1b_hash_integrity_0017_not_verified_scrolled.png`, `B3_tablet_0017_before_web_verify.png` (16:44:35) | Heading "**Not verified yet**", "The Core holds no verification of this item yet. Verify asks the Core now.", button "Verify". uiautomator `evidence-integrity-heading-NOT_RUN`, `evidence-verdict-pending` | **PASS** | Core record (`wq/api_1791279749624.json`): `verification {status NOT_RUN, at null}`; no VERIFIED custody entry |
| **R-T-2c** web Verify (andi) on EV-0017 → tablet heading changes without a reload | — (not testable in R-T) | web `W02_web_evidence_0017_integrity_before.png`, `W03_web_evidence_0017_after_verify.png`; tablet `B4_tablet_0017_after_web_verify_no_reload.png` (16:45:10), `B5_rt2_recording_frames_f1_to_f4_before_after_web_verify.png`, `rec/rt2_verify.mp4` | Web Verify pressed 16:44:59.589. Tablet recording: overlay f=1 (file `f_0002`) device 16:44:48.854 "Not verified yet"; the **next** frame f=2 (`f_0003`) device **16:44:59.399** (host ≈ 16:44:59.860) reads "Verified by the Core · Last verification PASS · 6 Oct 2026 16:44:59 UTC+07:00 · AKP Andi Pratama", button "Verify again". That is **+0.23 s** after the Core's verify line, with no tablet request in between | **PASS** | 16:44:59.626 `POST /api/v1/evidence/:id/verify 200` [web]; audit **#222** `EVIDENCE_VERIFIED` OPR-002 16:44:59.608 "Evidence EV-20261006-0017 verified: every hash matches" (`d269388b`). Tablet JS log: no `GET /evidence` between 16:42:58.920 and 17:24:01.195, so the update came over the live socket |
| **R-T-3** Network & Time: "Bandwidth" label whole, chart under it | `P12_network_time.png` ("Bandwidt" under the bars) | `C1_network_time_bandwidth.png` (16:47:01), `C2_bandwidth_before_P12_left_after_C1_right.png`, `S06_network_time.png` (17:25:35) | "Bandwidth" whole, the bars on their own line below it, readout "12.4 Mbps / ↑ 3.8 Mbps" on the right. uiautomator: `network-time-bandwidth-stacked` present; label [1349,490][1579,530], bars [1349,538][1541,618] (no overlap) | **PASS** | no request (store-fed screen) |
| **R-T-4a** Sessions hub list column: subject type, duration, session ID and date each on one line | `P04_sessions_hub.png` ("SES-…", "6 Oct …", "Ters/angk/a", "00:01:/23") | `D1_sessions_hub_list_column.png` (16:48:13), `D2_sessions_hub_with_detail_pane.png` (16:48:45), `S02_sessions_hub.png` | Every row: "SES-20261006-0027", "6 Oct 2026 12:46", "Retno Wulandari", chip "Tersangka" and "00:01:23", each on one line, with no ellipsis. Chip [1276,320][1429,360], duration [1445,324][1561,356] on one line; ID [1276,196][1848,232]. `pane-list` [1072,48][2067,1536] = 995 px ≈ 497 dp | **PASS** | none |
| **R-T-4b** detail pane still usable | `P05_session_detail.png` (≈ 1,000 px wide pane, one line per label and value) | `D2_sessions_hub_with_detail_pane.png`, `D3_sessions_hub_detail_pane_scrolled.png`, `D3b_sessions_hub_detail_pane_scrolled_end.png`, comparison `D4_sessions_hub_before_P05_left_after_D2_right.png` | `pane-detail` [2115,48][2528,1536] = 413 px ≈ **206 dp** (CF-M2's plan: ≈ 348 dp). Labels break inside words ("Case Num ber", "Subj ect", "Inve stiga tor", "Inter view Roo m", "Durati on", "Evid ence ID"). Case number on 3 lines, evidence ID on 2 ("EV-20261 006-0017"), chip "Tersang ka". **The subject name is not drawn**: the Subject row shows only the chip; uiautomator has no text node "Retno Wulandari", though the row's label is "Subject, Retno Wulandari". The pane scrolls and the other values are readable | **FAIL → RF-T-2** | none |

**Targeted count:** R-T-1, R-T-2 (a, b, c) and R-T-3 pass; R-T-4 is partial (list pass, detail pane fail).

## 4. Crash check: 3 runs of "tablet records on the monitor → web 5177 stops it"

**What was done.** Each run:

1. budi starts a session on the tablet (wizard, 3-2-1 countdown, monitor).
2. andi opens the Session Monitor on the web, opens End Session, types a reason and confirms while the tablet shows the monitor.
3. The tablet is recorded with device-time stamps from before Start Recording (run 2: see D-RF-T-1) until the Summary.

These were plain runs: no stall was injected and no inspector was used.

**How frames were judged** (`drivers/frames.py.txt`, `summarise.py.txt`; per-run facts in `rec/analysis/`):

- **Blank**: the content-area standard deviation is below 6. The blank frames measure 0.6; the lowest non-blank frame measures 15.4.
- **Monitor**: the red End Session button is present. **Hand-over**: the last monitor frame and the frame after it.
- **Banner**: the "LIVE SESSION FEED" header row moves down (baseline y = 95 in every monitor frame), or amber or green pixels appear in the band under the app header. A banner is a HeroUI `Alert`, warning (amber) or success (green), in its own slot above the content (`connection-banner.tsx:43-48`).
- **Timer**: the six digits of the `monitor-timer` are segmented and matched to labelled glyph templates (34 templates; the minimum distance between templates of different digits is 14 bits, and a match is accepted at ≤ 6). 0 frames were unreadable in the final pass.

| Run | Result | Timing (host, UTC+07:00) | Recording |
|---|---|---|---|
| 1: SES-20261006-0028 → EV-20261006-0018, "Uji Satu", monitor 31 s | **No crash** (pid 12423 before and after; 0 crash-class lines). **Finalizing**: the last Live frame (f=853, device 16:52:36.093) is followed by "Finalizing evidence" (f=854, device 16:52:36.293, +200 ms). **No banner** (0 of 730 monitor frames). **Timer: 0 backward steps**, but it **held 00:00:17 for 10.13 s** (device 16:52:21.811 → 31.945) and jumped to 00:00:26, while the feed overlay clock (16:52:21 → 31) and the MIC readouts kept changing (`E1_08_…`). At the start it held 00:00:00 for 2.21 s, then showed 3. **2 single blank frames** away from the hand-over (RF-T-4) | Core start 16:52:04.344 (audit #225); web confirm 16:52:35.493; Core stop 16:52:35.510 (#227; request 16:52:35.521 [web]); tablet leaves Live ≈ 16:52:36.749 (**+1.24 s**); sealed 16:52:42.675 (#228); web "Evidence sealed" 16:52:42.898. Load 12.07 | `rec/e_run1.mp4` (890 frames); `E1_06_run1_handover_frames_f852_to_f855.png`, `E1_08_run1_timer_hold_17_frames_f514_to_f746.png`, `E1_09_run1_single_blank_frames_start_f121_to_f124_and_summary_f876_to_f879.png`; `rec/analysis/e_run1_summary.txt` |
| 2: SES-20261006-0029 → EV-20261006-0019, "Uji Dua", monitor 3 min 42 s (D-RF-T-1, D-RF-T-2) | **No crash** (pid 12423; 0 crash-class lines). **Finalizing**: last Live f=381 device 17:11:21.326 → f=382 "Finalizing evidence" 17:11:21.466 (+140 ms). **No banner** (0 of 462 monitor frames in the two clips). **Timer: 0 backward steps.** Stop clip: 212 → 221, one step each 0.4–1.2 s, lag 0.06–0.68 s. Start clip: **00:00:00 for the whole 7.3 s** of monitor it holds (device 17:07:42.253 → 49.517, i.e. 3.3–10.6 s after the Core start), with empty meters and no feed overlay (`E2_07_…`). **1 single blank frame** before the monitor (RF-T-4) | Core start 17:07:39.397 (#233); web session expired 17:07:35.553 (#232), first stop command failed; relaunch, andi in 17:10:47 (#262); web confirm 17:11:21.272; Core stop 17:11:21.284 (#269); tablet leaves Live ≈ 17:11:21.939 (**+0.66 s**); sealed 17:11:27.996 (#270); web "Evidence sealed" 17:11:28.131. Load 11.97 at 17:07:07; no check before the 17:11 stop (D-RF-T-4) | `rec/e_run2.mp4` (start clip, 154 frames, ends device 17:07:49.5), `rec/e_run2b.mp4` (stop clip, 434 frames); `E2_07_run2_start_timer_hold_0_frames_f74_to_f154.png`, `E2_08_run2_handover_frames_f380_to_f383.png`, `E2_09_run2_single_blank_frame_start_f70_to_f73.png`; `rec/analysis/e_run2_start_summary.txt`, `e_run2b_summary.txt` |
| 3: SES-20261006-0030 → EV-20261006-0020, "Uji Tiga", monitor 24 s | **No crash** (pid 12423; 0 crash-class lines). **Finalizing**: last Live f=990 device 17:17:09.709 → f=991 "Finalizing evidence" 17:17:09.862 (+152 ms). **No banner** (0 of 839). **Timer: 0 backward steps**, 24 steps, lag 0.13–0.46 s; only the start hold (00:00:00 for 1.88 s, then 2). **0 blank frames** in 1,039, including the start and the Summary change | Core start 17:16:45.137 (#274); web confirm 17:17:09.407; Core stop 17:17:09.422 (#276); tablet leaves Live ≈ 17:17:10.341 (**+0.92 s**); sealed 17:17:16.061 (#277); web "Evidence sealed" 17:17:16.178. Load 5.77 | `rec/e_run3.mp4` (1,039 frames); `E3_04_run3_handover_frames_f989_to_f992.png`; `rec/analysis/e_run3_summary.txt` |

**Link evidence.** The tablet's operator socket (opened 16:38:58.831) has no close line in the Core log through the end of run 3. The only closes in the window belong to the web: 1001 on page loads, and 4401 by the server at 17:07:35.588, the idle expiry. So any banner would have been false. None appeared, and the JS log has no offline, stale or timeout record.

**Countdown and screens.** The 3-2-1 countdown appears in each clip (run 1: "3" device 16:52:00.772, "1" until 16:52:03.312), then "Starting…", then the monitor. After "Evidence sealed", "Open summary" leads to the Session Summary (EV-0018 00:00:31, EV-0019 00:03:41, EV-0020 00:00:24, matching the Core).

## 5. Smoke walk (tablet layout, budi.santoso)

| # | Screen | Result | Capture (time) | Value check |
|---|---|---|---|---|
| S1 | Home | PASS | `S01_home.png` (17:22:08) | "6 Items sealed today" = EV-0015..EV-0020, all of 6 Oct; recent EV-0020 17:17, EV-0019 17:11, EV-0018 16:52; Core Live; READY; Storage 20 % used |
| S2 | Sessions hub | PASS (RF-T-2 in the detail pane) | `S02_sessions_hub.png` (17:22:46) | All 20 / Sealed 19 / Incomplete 1 / Today 6 (R-T: 17/16/1/3, plus this row's three sessions). The list kept its scroll position when new rows arrived above (O-RF-T-6) |
| S3 | Evidence detail: Media | PASS (RF-T-1 in the list) | `S03_evidence_list_scrolled_top.png` (17:23:35), `S03a_evidence_detail_media.png` (17:24:07) | EV-20261006-0020, 6 Oct 2026 17:16:45 – 17:17:09, LP/2026/1006-0014, Uji Tiga Tersangka, AKP Budi Santoso, Interview Room 1, 00:00:24, 55.3 MB = `bytesWritten` 55,315,833, Sealed; "No DEMO media for this item on this device." |
| S3b | Evidence detail: Metadata | PASS | `S03b_evidence_detail_metadata.png` (17:24:35) | "the Core server's record only", CORE RECORD: `evidenceId EV-20261006-0020`, `sessionId SES-20261006-0030`, `recordedAt …17:16:45.137`, `endedAt …17:17:09.422`, `sealedAt …17:17:16.061`, `status SEALED` = `GET /session/current` (`wq/api_1791282429376.json`) |
| S3c | Evidence detail: Hash & Integrity | PASS | `S03c_evidence_detail_hash_integrity.png` (17:24:44) | "Not verified yet" (correct: EV-0020 was never verified); per-track SHA-256 VIDEO-01 `7f6ebef7…3e1093fdd641` = the Summary's `7f6ebef7…93fdd641` |
| S3d | Evidence detail: custody | PASS | `S03d_evidence_detail_custody.png` (17:24:49) | Sealed 17:17:16 System; Recording stopped 17:17:09 **AKP Andi Pratama** "Interview completed (RF-T run 3 web stop)"; Recording started 17:16:45 AKP Budi Santoso = audit #277, #276, #274 |
| S4 | Devices | PASS | `S04_devices.png` (17:25:29) | Camera 1/2 Online, MIC 1/2 Online, PoE "1 active · 1 spare", Recording Indicator Active, Tablet Control Connected (same set as R-T `P08`) |
| S5 | Storage | PASS | `S05_storage.png` (17:25:32) | 20 % used, 3.2 TB free of 4.0 TB, Used 806 GB, Sealed Evidence 6, Pending 1; session size 0.05 GB SES-20261006-0030 (= 55.3 MB); recent "Evidence sealed EV-20261006-0020" 17:17:16 |
| S6 | Network & Time | PASS (RF-T-5) | `S06_network_time.png` (17:25:35) | LAN Connected, PoE Active, Bandwidth stacked (R-T-3), GNSS/NTP Synchronized UTC+07:00, server 192.168.10.1, GNSS Active, NTP and RTC Standby |
| S7 | Audit | PASS | `S07_audit.png` (17:25:39) | HEAD `9de12f12`, 278 entries, Chain OK; top row 17:21:40 "Summary acknowledged · AKP Budi Santoso · SES-20261006-0030" = API total 278, head `9de12f12…` (`wq/api_1791282373949.json`, 17:26:13) |
| S8 | Settings | PASS | `S08_settings.png` (17:25:43) | App Preferences: Core link source **Live** selected; Account "Investigator · AKP Budi Santoso" |
| S9 | More → Sign out → Login | PASS | `S09a_more_before_signout.png` (17:26:29), `S09_signout_lands_on_login.png` (17:26:46) | More: "AKP Budi Santoso · Investigator · OPR-001 · Signed in 16:38", Pairing "Paired · Core: Interview Room 1". Sign out 17:26:40.066 → `POST /api/v1/auth/sign-out 204` 17:26:40.143 [tablet], `GET /auth/status 200` 17:26:43.090; Login "You have been signed out." |

## 6. Defects (RF-T-n)

| ID | Severity (proposed) | Where | Expected | Observed | Repro | Evidence |
|---|---|---|---|---|---|---|
| RF-T-1 | Medium | mobile Evidence list (tablet layout, list and detail panes) | A row that loses the selection is drawn normally | The row that **loses** the selection is drawn as an **empty card**, and stays empty: it survives scrolling, and lasted from 16:43:02 to the end of the row, until it was selected again. The row is in the accessibility tree with its texts and bounds (`evidence-row-EV-20261006-0017` [496,376][1238,580]); pixels are flat (mean 18, max 51 vs 45/254 for a drawn row). Seen **3 of 3** times: select EV-0015 (EV-0017 empty, 16:41:03; the capture 17 s later is byte-identical), select EV-0017 (EV-0015 empty, 16:43:02), select EV-0020 (EV-0017 empty, 17:24:07). Not in any earlier tablet capture (pixel scan of all full-size captures in `e2e/t_tablet` and `retest/t_tablet`); whether those rounds ever moved the selection between two rows was not checked. **Hypothesis, from code only:** the selected row mounts `GlowLayer` (Reanimated animated opacity) as its first child only while selected (`features/evidence/evidence-row.tsx:42`, `motion/glow-layer.tsx:112-126`). Its in-place removal on deselection is a candidate for the same class as R-P-1. CF-M2 also changed `evidence-row.tsx` (R-T-1 row menu) | Evidence → select one item → select another | `F1_undrawn_evidence_row_three_occurrences.png`, `B2a_evidence_detail_0015.png`, `B2a2_evidence_list_recheck_blank_row.png`, `B3a_select_0017_again.png`, `B3b_list_scrolled_down.png`, `B3c_list_scrolled_back.png`, `S03a_evidence_detail_media.png`; dumps `q/blank_row_check.txt`, `q/blank_row_check2.txt` |
| RF-T-2 | Medium | mobile Sessions hub, expanded layout (`features/sessions/sessions-screen.tsx`, CF-M2 R-T-4) | List at least 360 dp and the detail pane gets the rest, about 348 dp with the extended rail (CF-M2 §6) | `pane-list` 995 px ≈ **497 dp**, `pane-detail` 413 px ≈ **206 dp**. In the detail pane: the subject name is not drawn (no text node; the row label has it), labels break inside words, the case number wraps over 3 lines and the evidence ID over 2, and the subject chip wraps. Round 1 had a wide detail pane with every row on one line. A regression from R-T-4's fix: the list gained more than intended | Sessions → select a session | `D2_sessions_hub_with_detail_pane.png`, `D3_sessions_hub_detail_pane_scrolled.png`, `D4_sessions_hub_before_P05_left_after_D2_right.png`; `q/rt4_sessions_hub_selected.txt` (`pane-list`, `pane-detail`, `session-detail-subject`) |
| RF-T-3 | Medium | mobile Live monitor timer (`monitor-timer`) and the feed's REC chip | The timer follows the elapsed recording time once a second | **Freezes, then jumps** (never backwards). Run 1: 00:00:17 held **10.13 s** (device 16:52:21.811 → 31.945), then 00:00:26; the feed overlay clock and the MIC dBFS readouts kept updating meanwhile, and the REC chip also read 00:00:17 (f=699). Run 2: 00:00:00 for **≥ 7.3 s** after the monitor appeared (3.3–10.6 s after the Core start), with empty meters and no feed overlay. Start holds of 2.21 s (run 1) and 1.88 s (run 3). Runs 1 and 2 ran at load ≈ 12, run 3 at 5.8 (start hold only). **Hypothesis, from code only:** the timer is `elapsedSecondsAt(s.session?.startedAt, s.clock.now)` (`features/session-live/use-monitor.ts:78-80`), so the store's clock value stopped advancing while other data did. Not established | start a recording on the tablet under host load ≈ 12, watch the monitor | `E1_08_run1_timer_hold_17_frames_f514_to_f746.png`, `E2_07_run2_start_timer_hold_0_frames_f74_to_f154.png`; `rec/analysis/e_run1_summary.txt`, `e_run2_start_summary.txt`, `e_run3_summary.txt` |
| RF-T-4 | Low | mobile route changes around a recording | No empty frame between screens | One fully blank frame (sd 0.6) when a screen is replaced. Ready "Starting…" → monitor: run 1 device 16:52:06.945 (between 06.893 and 07.029); run 2 17:07:42.189 (between 42.107 and 42.253); not in run 3. "Evidence sealed" → Session Summary: run 1 16:52:51.231 (between 51.214 and 51.259); not in runs 2 and 3. **None at the Live → Finalizing hand-over** (CF-M1's target). R-T's clip of the Summary change had no blank frame (lowest sd 11.0) | record a session start and end on the tablet | `E1_09_run1_single_blank_frames_start_f121_to_f124_and_summary_f876_to_f879.png`, `E2_09_run2_single_blank_frame_start_f70_to_f73.png`; `rec/e_run1_frames/f_0124.png`, `f_0879.png`; `rec/e_run2_frames/f_0073.png` |
| RF-T-5 | Low | mobile Network & Time → Time Synchronization card (tablet third pane) | "Last Sync" shows date and time | Only "6 Oct 2026" is drawn; the value node holds "6 Oct 2026 16:46:47" in a one-line box [2197,381][2464,421]. "Time Source" ends in an ellipsis: "GPS (GNSS Str…" for "GPS (GNSS Stratum-1)". **Present in R-T's `P12_network_time.png` too**, not reported then (same narrow-pane class as R-T-3) | rail → Network & Time | `C1_network_time_bandwidth.png`, `C2_bandwidth_before_P12_left_after_C1_right.png` (lower half), `q/rt3_network_time.txt` lines 261–266 |

### Observations (not counted as defects)

- **O-RF-T-1.** Run 3's first Done on the Summary (17:21:39.975) reached the Core: `summary/acknowledge 204` at 17:21:40.144. The screen stayed on the Summary for at least 4 s (`E3_05_summary_bottom_run3.png` and the capture at 17:21:43.986 are byte-identical). A second tap at 17:22:04.064 opened Home. Runs 1 and 2 opened Home on the first tap.
- **O-RF-T-2.** There are 3,667 Reanimated `W` lines "synchronouslyUpdateUIProps failed for tag N" (`RetryableMountingLayerException: Unable to find SurfaceMountingManager`). Per minute: 16:39 (28), 16:48 (20), 16:51–52 (1,098), 17:02 (376), 17:11 (782), 17:16–17 (1,363). They are not crashes, and none fall at the RF-T-1 deselection minutes (16:41, 16:43). CF-M1 linked this class to an animation that updates a removed view (`misc/crash_final.txt`).
- **O-RF-T-3 (web, for R-W).** During the web Verify, the web card read "VERIFYING … Last verification PASS · 16:44:59 · AKP Andi Pratama · Verifying… 0 of 6 checks" at +107 ms. That is, the new verdict line was shown before its checks were revealed, which is the situation CF-M2 pinned on mobile (`wq/003.out`).
- **O-RF-T-4.** The tablet left Live 1.24 / 0.66 / 0.92 s after the Core's `RECORDING_STOPPED` (R-T: 1.1–1.3 s). This stays a W98 measurement.
- **O-RF-T-5.** The web session expired after 15 minutes idle (audit #232 `AUTH_EXPIRED` "Operator session expired after 15 min idle", Core socket close 4401). This is the policy working; it caused D-RF-T-2.
- **O-RF-T-6.** The Evidence and Sessions lists keep their scroll position when new items arrive above, so the three new items were above the visible window until scrolled (`S03_evidence_list_scrolled_top.png`).
- **O-RF-T-7.** The Home MIC tiles read "No signal" while idle. They did in R-T's `P03_home.png` and in this row's first Home capture too, so this is unchanged.

## 7. State changes on lane 2, rules, deviations and secret check

| Change | Detail |
|---|---|
| Recordings | SES-20261006-0028, -0029, -0030: created, prechecked and started by OPR-001 on the tablet, stopped by OPR-002 from the web, sealed as EV-20261006-0018, -0019, -0020 (SEALED, not verified, not archived), summaries acknowledged by OPR-001 (#229, #271, #278) |
| Verification | EV-20261006-0017 verified PASS by OPR-002 from the web (#222), as the brief asked |
| Sign-ins and sign-outs | budi on the tablet 16:38:58 (#220) and out 17:26:40; andi on the web 16:42:27 (#221), expired 17:07:35 (#232), in again 17:10:47 (#262), out 17:27:09 |
| Audit | 217 rows before this row (last: 13:10:11 sign-out); 278 at 17:26:13 (head `9de12f12`); plus the two sign-out rows after it (not read back) |
| Not done | No reset, scenario, fault, role or operator change. No Archive, Export, Install update, Restart, diagnostics or test signal. No setup session left behind |

- **Device security.** No PIN was typed. No lock, PIN or fingerprint was set, changed or cleared. No `locksettings`, `adb emu finger`, settings change or Hermes inspector was used. `isKeyguardShowing=false` at every focus check and at 17:27:30.
- **adb scope.** Only `emulator-5556` was used. `device-session.sh` was not used, and the reverse rules were not touched. Device files (`/sdcard/rt2_verify.mp4`, `e_run*.mp4`, `rf_t.xml`) were deleted after each pull or dump; none were left at 17:27.
- **Servers.** No server, Vite, Metro, mock-core or emulator was started or stopped. 4420/4421/4423, 5173/5176/5178, PostgreSQL and *:5432 were not touched.
- **App launch and dumps.** The app was never launched at `/` with `motion=`. Links used: `/login?core=LIVE&motion=off` and `/more`. No `uiautomator dump` ran while Login, Summary or Home showed.
- **Files.** No tracked file was modified, and no test suite was run. Writes went only to `test/assets/retest2/t/`, this report, and `delegation_progress/rf_t_tablet.md`. Size: 650 MB, mostly the 2,527 frames extracted from the five clips (10 + 890 + 154 + 434 + 1,039). They can be recreated with `ffmpeg -i <clip>.mp4 -fps_mode passthrough -vf scale=960:-1 f_%04d.png` and can be pruned by the controller.
- **D-RF-T-1 (deviation).** The tablet driver was started under the tool's default 30-minute background limit and was stopped at about 17:07:50, during run 2.
  - Run 2's first recording ended at device 17:07:49.5 (start clip, 154 frames).
  - The driver was restarted at command 035 with a 2-hour limit, and the stop was recorded in a second clip from 17:11:11.
  - Device 17:07:49.5–17:11:11.3 (the middle of the monitor) was **not recorded**.
  - In the restarted driver, `waitlog` matched older lines because its seen-set was empty (q/040). Create, precheck and start times for run 3 were taken from the Core log instead.
- **D-RF-T-2 (deviation).** The web sat idle from 16:52:44 to 17:07, and andi's session expired (#232).
  - The first run-2 stop command (`wq/009`) found the page on `/login` ("Open Session Monitor": not found), so the session kept recording.
  - Chrome instance 1 (pid 4668) was stopped at 17:10:11, before its own 30-minute limit. Instance 2 was launched with the same checks, andi signed in again, and the stop followed at 17:11:21.
  - **Instance 1's in-memory request and origin log (16:42–17:10) was lost**, because it was not saved before the stop. For that window, the web's requests are evidenced only by the `[web/other]` lines in `core_log_lane2_window.txt`, all to the lane-2 Core through 5177, and by the driver navigating only to `http://127.0.0.1:5177`.
  - Run 2's monitor therefore lasted 3 min 42 s instead of about 30 s.
- **D-RF-T-3.** The `crash` verb's pattern also matched Reanimated warnings and the uiautomator launcher (`AndroidRuntime`). Counts are reported split: strict crash-class 0, Reanimated 3,667, launcher 60 (12 dumps × 5).
- **D-RF-T-4.** No `uptime` check before the 17:11 stop: a live recording had to be ended. Load was 11.97 at 17:07:07 and 5.77 at 17:16.
- **Secret scan.** See the last line of `delegation_progress/rf_t_tablet.md` and the line below. The scan is count-only. The password comes from the dataset constant and is never printed; it is also matched loosely (case-insensitive, with separators). The scan also checks `dvc_` / `ses_` / `bio_` token shapes and 3+3-digit code shapes. README and `dataset.ts` were never grepped. The Login captures show empty fields and a closed "Demo operators" panel; no capture was taken within 2 s of typing a password.

Scan at 17:33:48 (`drivers/scan.mts.txt`, run with `node --import tsx`) over `test/assets/retest2/t/`, this report and `delegation_progress/rf_t_tablet.md`: **197 text files; password exact 0; password loose 0; token shapes 0.** It also found 39 3+3-digit shapes, all tap or swipe screen coordinates in `q/*.cmd` (for example `tap 1736 379`). No pairing code was issued or shown in this row. Screenshots cannot be text-scanned.

## 8. Screenshot index

Tablet captures are 2560 × 1600 on-device PNG (`exec-out screencap -p`). Web captures are 1600 × 1000 CDP `Page.captureScreenshot`. Frame sheets are built from the 960 × 600 frames of the `screenrecord --bugreport` clips. The overlay prints the device time and `f=N` top left; file `f_NNNN` = overlay `f=NNNN−1`.

| File | Caption |
|---|---|
| `00_before_relaunch.png` | tablet before the row: Login, LIVE, Core online, paired DEV-0001 (16:37:56) |
| `01_login_live_after_relaunch.png` | Login after force-stop and cold relaunch (16:38:27) |
| `02_after_signin_budi.png` | biometric offer after budi's sign-in over Home; Not now chosen |
| `03_home_budi_after_not_now.png` | Home, INVESTIGATOR, before the checks |
| `04_evidence_list.png` | Evidence list, nothing selected |
| `05_evidence_detail_0017.png` | EV-20261006-0017 detail, Media tab |
| `A1_evidence_detail_more_menu_0017.png` | R-T-1: detail More menu, "Archive" title over "Archiving needs the Supervisor role" |
| `A1b_more_menu_closed.png` | detail More menu closed without choosing |
| `A2_evidence_row_menu_0017.png` | R-T-1: list row menu, View / Verify / Export / "Archive" title over its reason |
| `A3_archive_title_before_P07e_after_A1_A2.png` | R-T-1 comparison: R-T before (no title), detail menu after, row menu after |
| `B1_hash_integrity_0017_not_verified.png` | R-T-2: EV-0017 Hash & Integrity, "Not verified yet" |
| `B1b_hash_integrity_0017_not_verified_scrolled.png` | R-T-2: EV-0017 card in full, "The Core holds no verification of this item yet" |
| `B2a_evidence_detail_0015.png` | EV-0015 selected; RF-T-1 first occurrence: EV-0017 row drawn empty |
| `B2a2_evidence_list_recheck_blank_row.png` | RF-T-1: the same screen 17 s later, byte-identical |
| `B2_hash_integrity_0015_verified.png` | R-T-2: EV-0015 "Verified by the Core", last verification PASS 10:47:45 AKP Andi Pratama |
| `B3a_select_0017_again.png` | RF-T-1 second occurrence: EV-0017 selected, EV-0015 row drawn empty |
| `B3b_list_scrolled_down.png` | RF-T-1: the empty card scrolls with the list |
| `B3c_list_scrolled_back.png` | RF-T-1: still empty after scrolling back |
| `B3_tablet_0017_before_web_verify.png` | R-T-2c: tablet on EV-0017 "Not verified yet" before the web Verify |
| `B4_tablet_0017_after_web_verify_no_reload.png` | R-T-2c: tablet after the web Verify, "Verified by the Core", last verification 16:44:59 AKP Andi Pratama, no reload |
| `B5_rt2_recording_frames_f1_to_f4_before_after_web_verify.png` | R-T-2c: recording frames, "Not verified yet" at device 16:44:48.854, "Verified by the Core" at 16:44:59.399 |
| `C1_network_time_bandwidth.png` | R-T-3: Network & Time, "Bandwidth" whole with the bars under it |
| `C2_bandwidth_before_P12_left_after_C1_right.png` | R-T-3 comparison: R-T "Bandwidt" left, now whole right; lower half shows RF-T-5 in both |
| `D1_sessions_hub_list_column.png` | R-T-4: Sessions hub list column, each value on one line, nothing selected |
| `D2_sessions_hub_with_detail_pane.png` | R-T-4 / RF-T-2: list column fits; detail pane about 206 dp, subject name missing, labels broken |
| `D3_sessions_hub_detail_pane_scrolled.png` | RF-T-2: detail pane scrolled, "Inter view Roo m", "Durati on", "Evid ence ID" |
| `D3b_sessions_hub_detail_pane_scrolled_end.png` | RF-T-2: detail pane at its end |
| `D4_sessions_hub_before_P05_left_after_D2_right.png` | R-T-4 comparison: R-T narrow list and wide detail left, now wide list and narrow detail right |
| `E1_01_wizard_step1.png` | run 1: Start New Session, step 1 empty |
| `E1_02_wizard_step1_filled.png` | run 1: step 1 filled, LP/2026/1006-0012, Tersangka, Uji Satu |
| `E1_03_wizard_step2_devices_check.png` | run 1: Devices Check 8 of 8, all checks passed |
| `E1_04_wizard_step3_ready.png` | run 1: Ready to record |
| `E1_05_tablet_after_run1.png` | run 1: Session Summary, SES-20261006-0028 sealed, EV-20261006-0018, 00:00:31 |
| `E1_06_run1_handover_frames_f852_to_f855.png` | run 1: last Live frames, then "Finalizing evidence" at device 16:52:36.293, no blank frame |
| `E1_07_summary_bottom.png` | run 1: Summary bottom, Done and View in Evidence |
| `E1_08_run1_timer_hold_17_frames_f514_to_f746.png` | RF-T-3: run 1 timer at 00:00:17 from 16:52:21.977 to 31.878 while the feed clock runs, then 00:00:26 |
| `E1_09_run1_single_blank_frames_start_f121_to_f124_and_summary_f876_to_f879.png` | RF-T-4: run 1 single blank frames, "Starting…" to monitor and "Evidence sealed" to Summary |
| `E2_00_after_done_run1.png` | Home after run 1, 4 items sealed today |
| `E2_01_wizard_step1_filled.png` | run 2: step 1 filled, LP/2026/1006-0013, Tersangka, Uji Dua |
| `E2_02_wizard_step3_ready.png` | run 2: Ready to record |
| `E2_03_ready_before_start.png` | run 2: still on Ready after the load pause (17:07:18) |
| `E2_04_tablet_monitor_still_recording.png` | run 2: tablet still on the monitor at 17:10:52 after the failed web stop |
| `E2_05_tablet_after_run2.png` | run 2: Session Summary after the web stop |
| `E2_06_summary_bottom_run2.png` | run 2: Summary bottom, EV-20261006-0019, 00:03:41 |
| `E2_07_run2_start_timer_hold_0_frames_f74_to_f154.png` | RF-T-3: run 2 timer and REC chip at 00:00:00 from 17:07:42.253 to 49.517, meters empty |
| `E2_08_run2_handover_frames_f380_to_f383.png` | run 2: last Live frames at 00:03:41, then "Finalizing evidence" at device 17:11:21.466 |
| `E2_09_run2_single_blank_frame_start_f70_to_f73.png` | RF-T-4: run 2 blank frame between "Starting…" and the monitor at device 17:07:42.189 |
| `E3_00_home_before_run3.png` | Home before run 3, 5 items sealed today |
| `E3_01_wizard_step1_filled.png` | run 3: step 1 filled, LP/2026/1006-0014, Tersangka, Uji Tiga |
| `E3_02_wizard_step3_ready.png` | run 3: Ready to record |
| `E3_03_tablet_after_run3.png` | run 3: Session Summary after the web stop |
| `E3_04_run3_handover_frames_f989_to_f992.png` | run 3: last Live frames at 00:00:24, then "Finalizing evidence" at device 17:17:09.862 |
| `E3_05_summary_bottom_run3.png` | run 3: Summary bottom, EV-20261006-0020; the first Done left this screen in place (O-RF-T-1) |
| `F1_undrawn_evidence_row_three_occurrences.png` | RF-T-1: the three occurrences side by side |
| `S01_home.png` | smoke: Home, 6 items sealed today |
| `S02_sessions_hub.png` | smoke: Sessions hub, All 20 / Sealed 19 / Incomplete 1 / Today 6 |
| `S03_evidence_list_scrolled_top.png` | smoke: Evidence list scrolled to the top, EV-0020 / 0019 / 0018 above EV-0017 |
| `S03a_evidence_detail_media.png` | smoke: EV-0020 detail, Media tab; RF-T-1 third occurrence (EV-0017 row empty) |
| `S03b_evidence_detail_metadata.png` | smoke: EV-0020 Metadata tab, CORE RECORD |
| `S03c_evidence_detail_hash_integrity.png` | smoke: EV-0020 Hash & Integrity, "Not verified yet", per-track SHA-256 |
| `S03d_evidence_detail_custody.png` | smoke: EV-0020 chain of custody, stopped by AKP Andi Pratama, started by AKP Budi Santoso |
| `S04_devices.png` | smoke: Devices & Inputs |
| `S05_storage.png` | smoke: Storage, 20 % used, 6 sealed, SES-20261006-0030 0.05 GB |
| `S06_network_time.png` | smoke: Network & Time, Bandwidth stacked |
| `S07_audit.png` | smoke: Audit, HEAD 9de12f12, 278 entries, Chain OK |
| `S08_settings.png` | smoke: Settings, App Preferences, Core link source Live |
| `S09a_more_before_signout.png` | smoke: More, AKP Budi Santoso, Sign out |
| `S09_signout_lands_on_login.png` | smoke: Login after sign out, "You have been signed out.", Core online, paired DEV-0001 |
| `W01_web_dashboard_andi.png` | web: Dashboard after andi's sign-in (16:42:29) |
| `W02_web_evidence_0017_integrity_before.png` | web: EV-0017 Hash & Integrity, NOT VERIFIED, before Verify |
| `W03_web_evidence_0017_after_verify.png` | web: EV-0017 after Verify, PASS, last verification 16:44:59 AKP Andi Pratama, 6 of 6 checks |
| `W10_web_run1_sealed.png` | web: run 1 finalization modal, Evidence sealed SES-20261006-0028 |
| `W11_web_run2_sealed.png` | web: run 2 finalization modal, Evidence sealed SES-20261006-0029 |
| `W12_web_run3_sealed.png` | web: run 3 finalization modal, Evidence sealed SES-20261006-0030 |

Other artifacts (not screenshots), all under `test/assets/retest2/t/`:

- **Recordings:** `rec/rt2_verify.mp4`, `rec/e_run1.mp4`, `rec/e_run2.mp4`, `rec/e_run2b.mp4`, `rec/e_run3.mp4`, each with its frames folder and `*_frame_pts.txt`.
- **Per-run frame facts and summaries:** `rec/analysis/*_frame_facts.json`, `rec/analysis/*_summary.txt`, and the digit templates `rec/analysis/timer_digit_templates.json`.
- **Core log:** `core_log_lane2_window.txt` (91 lines, 16:37–17:28; time, method, route, status, client).
- **JS logs:** `jslog_tablet_full.txt`, `jswarn_tablet_full.txt`, `jserr_tablet_full.txt`.
- **Logcat extracts:** `misc/crash_after_run1.txt`, `misc/crash_after_run2.txt`, `misc/crash_after_run3.txt`, `misc/crash_final.txt`.
- **Browser launch record:** `misc/web_chrome_launch.txt`.
- **Driver queues:** `q/*.cmd`, `q/*.out`, uiautomator extracts `q/*.txt`; `wq/*.cmd`, `wq/*.out`, API answers `wq/api_*.json`, `wq/net_final.txt`.
- **Drivers:** `drivers/*.txt`.
