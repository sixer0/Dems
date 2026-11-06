---
task_id: RF2
task_slug: final-check-cf2-phone-tablet
date: 2026-10-06
agent: verifier
decision_refs: [D232, D233, D234, D235, D236]
status: needs-review
narrative_tier: 2
assets: test/assets/retest3/
before: test/10a_final_retest_phones.md (test/assets/retest2/ph/), test/10b_final_retest_tablet.md (test/assets/retest2/t/)
fixes_checked: gateway_check/13a_cf2_mobile_runtime.md (CF2-A), gateway_check/13b_cf2_mobile_screens.md (CF2-B)
---

# RF2: final independent check of the CF2 fixes on the phone and the tablet

## 1. Summary

**Checks: 7 / 7 PASS** on the brief's criteria. Every check had 2 runs and 1 verification run (D232/D233), with no loops.

Two new defects. Neither breaks a check's pass criterion:

- **RF2-1** (Low): the Sessions hub detail pane breaks a two-word subject name inside a word.
- **RF2-2** (Medium, proposed): on the tablet, a web stop about 11 s into a recording left the stopped session's "Recording" monitor on screen for 3.2 s and 6.7 s. In T3 the Summary came about 13.6 s after the Core sealed, at host load 2-4.

| # | Check | Run 1 | Run 2 | Verification | Result | Evidence file |
|---|---|---|---|---|---|---|
| 1 | Phone: start on the phone, web 5176 (andi) stops it after about 30 s | S1: no crash; Finalizing in the frame after the last monitor frame; timer max lag **1.37 s**, 0 frames > 2 s; 0 backward steps; 0 banner frames (1,025 timer frames, all decoded) | S2: same; max lag **1.79 s**, 0 > 2 s, 0 backward, 0 banner (479 frames) | S3: same; max lag **1.53 s**, 0 > 2 s, 0 backward, 0 banner (458 frames) | **PASS** | `c1_s1_web_stop_30s_frames.png`, `c1_s2_…`, `c1_s3_…`; `phone_frame_analysis.txt` |
| 2 | Phone: web stop right after Start (while "Starting..."): the stale monitor clears | X1: stopped session's monitor drawn **0.74 s**, then Finalizing, then Summary | X2: **0.63 s**, then Finalizing, then Summary | X3: **1.86 s**, then Finalizing, then Summary | **PASS** (all within the D236 residual of about 4 s) | `c2_x1_early_web_stop_frames.png`, `c2_x2_…`, `c2_x3_…`, `c2_x3_phone_early_web_stop_540px.mp4` |
| 3 | Phone: no empty frame between Ready and the monitor | S1, S2: 0 empty frames; native cross-fade, the monitor complete in its first frame | S3, X1: 0 | X2, X3: 0 | **PASS** (0 of 6 recordings) | Ready-to-monitor tiles in the six `c1_*` / `c2_*` sheets; `phone_frame_analysis.txt` (frame before the monitor `empty=False`) |
| 4 | Tablet: Evidence list, select rows one after another, scroll | E1: 0019, then 0018, then 0017; scroll down and back: every row drawn | E2: 0020, then 0016, then 0018; scroll, tap, scroll back: every row drawn | E3: 0015, then 0019, then 0020; scroll down and back: every row drawn | **PASS** (16 captures, 0 empty cards by pixel bands and by eye) | `c4_e1_*` … `c4_e3_*` |
| 5 | Tablet: Sessions hub, list and detail pane both readable | H1: 0028, then 0027, detail scrolled: list rows one line each, detail labels one line | H2: 0030, then 0026: readable | H3: 0025, 0027 again, 0029 after visiting Devices: readable | **PASS with RF2-1** ("Retno W/ulandari" twice, "Siti Rahm/awati" once) | `c5_h*`, `c5_rf2_1_subject_name_breaks_inside_word_crops.png` |
| 6 | Tablet: Network & Time, Last Sync date and time and Time Source in full | N1: "6 Oct 2026" over "22:39:22"; "GPS (GNSS" over "Stratum-1)" | N2: same (22:39:38) | N3: same | **PASS** | `c6_n1_network_time.png`, `c6_n2_…`, `c6_n3_…`, `c6_time_sync_card_n1_n2_n3_crops.png` |
| 7 | Tablet: session started on the tablet, stopped from web 5177 | T1: Finalizing **0.29 s** after the Core stop, then Summary; no crash | T2: Finalizing **3.19 s** after the stop, then Summary; no crash | T3: Finalizing **6.73 s** after the stop (after the seal), Summary 13.6 s after the seal; no crash | **PASS with RF2-2** | `c7_t1_web_stop_frames.png`, `c7_t2_…`, `c7_t3_…`, `c7_rf2_2_t3_finalizing_replayed_after_seal_frames.png`, `c7_rf2_2_t3_tablet_web_stop_to_summary_540px.mp4`, `tablet_session_runs.txt` |

Against the earlier failures:

| Defect | Before | Now |
|---|---|---|
| RF-PH-1 / RF-T-3 (timer frozen behind the Core) | holds up to 21 s; lag > 2.5 s in 12/14 recordings (`10a`, `retest2/ph/rfph1_timer_holds_while_feed_clock_runs.png`) | max lag 1.37-1.79 s, 0 frames > 2 s in 3/3 at load 5.7-6.8 |
| RF-PH-2 (stale monitor after an early web stop) | 2.7-7.1 s, once about 71 s (`retest2/ph/rfph2_stale_recording_monitor_after_early_web_stop.png`) | 0.63-1.86 s on the phone. But on the tablet, a stop about 11 s in gave 3.2 and 6.7 s (RF2-2) |
| RF-PH-3 / RF-T-4 (empty frame Ready -> monitor) | 7/18 recordings | 0/6. The empty frame at the Summary route swap remains (5/6 phone, 2/3 tablet), as routed to W93 by D236 |
| RF-T-1 (deselected Evidence row drawn empty) | 3/3 (`retest2/t/F1_undrawn_evidence_row_three_occurrences.png`) | 0 empty cards in 3/3 runs |
| RF-T-2 (Sessions detail pane about 206 dp) | labels split, subject not drawn (`retest2/t/D2_sessions_hub_with_detail_pane.png`) | pane centres x=1434 / 2186, the CF2-B split (361.5 / 342.5 dp); labels one line. RF2-1 is a remaining name wrap |
| RF-T-5 (Last Sync time, Time Source ellipsis) | "6 Oct 2026" only; "GPS (GNSS Str…" (`retest2/t/S06_network_time.png`) | both in full in 3/3 |

## 2. Environment and method

| Item | Value | How verified |
|---|---|---|
| Devices | phone `emulator-5554` (1080x2424, lane 1: Core 4421, web 5176); tablet `emulator-5556` (2560x1600, lane 2: Core 4422, web 5177). `emulator-5558` was listed by `adb devices` and not addressed | `adb devices -l`, `wm size` (22:17); the driver refuses any other serial (`driver_rf2q.mts.txt`, lines 38-44) |
| Relaunch | phone: force-stop 22:18:38.273, `am start … -d 'demsdemo:///login?core=LIVE&motion=off'` 22:18:40.2, Login "Core online" at 22:19:05. Tablet: force-stop 22:35:10.612, same link 22:35:12.253 (COLD, 4,149 ms), Login "Core online" at 22:35:31 | `phone_driver_batches.txt` batch 001; `tablet_driver_batches.txt` batch 001; `p01_…`, `t01_…` |
| Operators | budi.santoso (INVESTIGATOR) on both devices; andi.pratama (SUPERVISOR) on the web. The password is imported from the dataset constant, typed only into an IME password field, never printed | driver header; `POST /auth/sign-in 200` at 22:19:21.494 (phone), 22:35:46.555 (tablet), in `core_log_lines.txt` |
| Web | Playwright-cache headless shell, `--remote-debugging-port=0`. Phone lane: pid 3840, port 57257 (listener owned by pid 3840), 5,055 requests + 29 sockets, all to `127.0.0.1:5176`, 0 console errors. Tablet lane: pid 22111, port 61437 (owned), 3,233 requests + 19 sockets, all to `127.0.0.1:5177`, 0 console errors. Fresh profiles in TMPDIR, removed at the end | batches 002 and 014 (phone), 002 and 018 (tablet) |
| Driver | CF2-A's queue driver (`gateway_check/assets/13a_driver_cfq.mts.txt`, byte-identical copy checked with `cmp`), made lane-aware: serial, origin and Core log by `RF2_LANE`; `link` refuses `/` with `motion=`; tablet screenrecord at 1280x800; new verb `crash`. Run generators are CF2-A's `genrun/wizard/finish` (phone) and a new `trun.sh` (tablet). Frame tools are CF2-A's `analyze_run.py`, `lag.py`, `blank2.py` (phone), plus new `tscan.py`, `rows.py`, `pick.py` | `driver_*.txt`, `tool_*.txt` |
| Timing | Device - host offsets from 5 bracketed reads per run: phone -420 to -457 ms, tablet -452 to -467 ms. Phone frame times come from the `--bugreport` overlay (OCR); tablet frame times from one overlay reading per recording plus PTS | `phone_frame_analysis.txt`, `tablet_session_runs.txt` |
| Host load (1 min) | 22:15 8.45; phone runs 5.7-8.5; tablet 2.1-11.0 (11.04 at 22:38 for one batch). Never > 14, no pause needed | `uptime` before each run; `host load` in every batch |
| Window | 22:15-22:55 WIB | batch stamps |

Pass rules used:

- **Check 1.** Lag = (frame host time - Core `startedAt`) - drawn whole seconds. "Within about 2 s" means max lag ≤ 2.0 s; a perfect timer already reads up to 1 s behind.
- **Check 2.** Stale time = first frame of the stopped session's monitor to the first Finalizing frame. Pass at ≤ about 4 s (D236).
- **Check 3.** "Empty" = app-area standard deviation < 6.
- **Check 4.** A drawn card has max brightness > 200 and sd > 25 in its band. RF-T measured an empty card at max 51.

## 3. Phone (emulator-5554)

### 3.1 Check 1: web stop about 30 s after the start (S1, S2, S3)

| Run | Session | Core start / stop / seal (host) | Monitor frames | Max lag | Backward | Banner | Hand-over |
|---|---|---|---|---|---|---|---|
| S1 | SES-20261006-0087 -> EV-0074, load 5.72 | 22:20:53.909 / 22:21:22.391 / 22:21:30.054 | 1,025 (all decoded) | 1.37 s (f_049, the first second) | 0 | 0 | last monitor f_1067 (device 22:21:22.108) -> f_1068 "Finalizing evidence" (22:21:22.210), 0.26 s after the Core stop; Summary at the end |
| S2 | SES-0088 -> EV-0075, load 6.46 | 22:23:47.186 / 22:24:16.114 / 22:24:23.129 | 479 | 1.79 s (f_118) | 0 | 0 | f_521 -> f_522 Finalizing, 1.87 s after the stop |
| S3 (verification) | SES-0089 -> EV-0076, load 6.75 | 22:26:09.486 / 22:26:38.463 / 22:26:45.593 | 458 | 1.53 s (f_131) | 0 | 0 | f_499 -> f_500 Finalizing, 1.31 s after the stop |

Sampled frames (`c1_*` sheets). Each pair is the drawn timer against the Core's elapsed time at that frame:

| Run | ~3 s | ~10 s | ~20 s | last |
|---|---|---|---|---|
| S1 | 3 vs 3.6 | 10 vs 10.5 | 20 vs 20.5 | 28 vs 28.6 |
| S2 | 3 vs 4.2 | 10 vs 10.9 | 20 vs 20.8 | - |
| S3 | 3 vs 4.0 | 10 vs 10.9 | 20 vs 20.9 | - |

No "Core link lost" or "Resynced" band appears in any monitor frame. No crash:

- app pid 17766 from the relaunch to the end;
- 0 crash-class lines per run (`native_crash_class_counts.txt`).

Core lines (`core_log_lines.txt`): `POST /api/v1/session/:id/start 200` and `POST /api/v1/session/:id/stop 202` for each run. For example, S1: start 22:20:53.914, stop 22:21:22.395.

### 3.2 Check 2: web stop at once after Start (X1, X2, X3)

The web confirms End Session within about 0.4 s of the Core's start, which is the earliest moment the web allows. The phone shows "Starting..." for about 3 s while the start request runs.

| Run | Session | Core start -> stop | Stopped session's monitor drawn | Core stop -> Finalizing | Then |
|---|---|---|---|---|---|
| X1 | SES-0090 -> EV-0077, load 6.89 | 22:28:20.855 -> 21.274 (0.42 s) | device 22:28:21.043 -> 21.787 = **0.74 s** (timer 00:00:00) | 0.97 s | Summary (SEALED 22:28:27) |
| X2 | SES-0091 -> EV-0078, load 7.06 | 22:31:02.595 -> 03.055 (0.46 s) | 22:31:02.798 -> 03.424 = **0.63 s** | 0.79 s | Summary |
| X3 (verification) | SES-0092 -> EV-0079, load 8.07 | 22:32:41.804 -> 42.205 (0.40 s) | 22:32:42.057 -> 43.916 = **1.86 s** | 2.17 s | Summary |

All three are within the D236 residual (≤ about 4 s), with 0 banners, 0 backward steps and no crash.

### 3.3 Check 3: Ready -> monitor

Six recordings (S1-S3, X1-X3): the frame before the first monitor frame is **never empty**. The `c1`/`c2` sheets show the change as a native cross-fade: "Ready to record" fades under the monitor, which is complete in its first frame. **0 / 6.**

Out of scope for check 3, recorded as an observation: the known single empty frame at the Summary route swap (identical Summary frames before and after) appears in S2, S3, X1, X2 and X3 (f_560, f_536, f_096, f_094, f_109). D236 routed it to W93 (`animation: 'none'`).

### 3.4 Phone end state

- Summary Done, then Home "Core Live" (`p10_…`), then More -> Sign out: `POST /api/v1/auth/sign-out 204` at 22:34:29.080.
- Login: "You have been signed out.", "Core online" (`p12_phone_end_login_signed_out_live.png`, 22:34:33).
- `GET /session/current` shows SES-20261006-0092 SEALED: nothing recording.
- Web: sign-out 204, then `auth/session 401`.

## 4. Tablet (emulator-5556)

### 4.1 Check 4: Evidence list

Row bands checked by pixels (`tool_rows.py.txt`; every band max 236-254, sd 33-59) and by eye:

| Run | Steps (host) | Result |
|---|---|---|
| E1 | select 0019 (22:36:26), 0018 (29), 0017 (32); scroll down (35) and back (39) | 0019 and 0018 drawn after losing the selection; all rows drawn after scrolling (`c4_e1_c_select_0017.png`, `c4_e1_d_scrolled_down.png`) |
| E2 | select 0020 (22:37:10), 0016 (13), 0018 (16); scroll, tap, scroll back | All drawn. The short scroll left 0018 under the tap, so it re-selected 0018 (file named for that) |
| E3 (verification) | select 0015 (22:37:32), 0019 (35), 0020 (38); scroll down and back | All drawn (`c4_e3_e_scrolled_back.png`) |

### 4.2 Check 5: Sessions hub

- `pane-list` centre x=1434, `pane-detail` centre x=2186 (dump, 22:38:14). These equal CF2-B's measured panes ([1072..1795] and [1843..2528]: 361.5 / 342.5 dp).
- List rows: ID, date, name, chip and duration each on one line in every capture.
- Detail pane: labels on one line. Case number, investigator, room, start, end, duration, size and evidence ID are each on one line (`c5_h1_c_detail_scrolled.png`).
- Defect RF2-1: two-word subject names break inside the second word: "Retno W / ulandari" (SES-0027, H1 and H3), "Siti Rahm / awati" (SES-0025, H3). "Dewi / Lestari" breaks between the words. "Uji Dua" fits.
- Dump `session-detail-subject` "Subject, Retno Wulandari": the node holds the whole name (22:39:17).

### 4.3 Check 6: Network & Time

N1 (22:39:33), N2 (22:39:40) and N3 (22:39:47), each entered from another screen:

- Last Sync shows "6 Oct 2026" over the time (22:39:22, 22:39:38, 22:39:38).
- Time Source shows "GPS (GNSS" over "Stratum-1)".
- Server 192.168.10.1 is on one line; values are right-aligned (`c6_time_sync_card_n1_n2_n3_crops.png`).

### 4.4 Check 7: tablet session, web stop

| Run | Session | Core start / stop / seal (host) | Last monitor -> Finalizing (device) | Stop -> Finalizing | Summary |
|---|---|---|---|---|---|
| T1 | SES-20261006-0031 -> EV-0021, load 3.65 | 22:41:29.072 / 22:41:39.823 / 22:41:46.552 | f_541 22:41:39.589 -> f_542 22:41:39.657 | **0.29 s** | in place; 0 empty frames in 593 |
| T2 | SES-0032 -> EV-0022, load 2.17 | 22:48:30.569 / 22:48:41.672 / 22:48:48.816 | f_432 22:48:44.008 (timer held 00:00:11) -> f_433 22:48:44.397 | **3.19 s** | in place; 1 empty frame at the route swap (f_470) |
| T3 (verification) | SES-0033 -> EV-0023, load 3.77 | 22:50:53.017 / 22:51:04.446 / 22:51:10.839 | f_532 22:51:10.479 -> f_533 22:51:10.713 | **6.73 s** (after the seal) | Finalizing steps replayed: 33 % at 22:51:16.9, 83 % at 22:51:20.1. Summary first at device 22:51:24.001 (about 13.6 s after the seal); JS log 22:51:23.229 `runtime.routeSync.transition` "Resynced route to the session state" {SEALED}; 1 empty frame at the route swap (f_575) |

No crash in any run:

- app pid 24946 throughout;
- 0 crash-class lines (`native_crash_class_counts.txt`);
- the whole-window scan holds only the `uiautomator` launcher's own lines (`tablet_crash_scan_whole_window.txt`).

The Core log shows no socket close or open on lane 2 between the start and the seal of any run (`core_log_lines.txt`). The link was therefore not lost; why the tablet learned the stop late is **not established**.

### 4.5 Tablet end state

- T3 Summary, scrolled, Done (`summary/acknowledge 204`, 22:53:50.284).
- Settings -> Account -> Sign out: `POST /api/v1/auth/sign-out 204` at 22:54:26.584.
- Login: "You have been signed out.", "Core online", "paired as DEV-0001" (`t20_tablet_end_login_signed_out_live.png`, 22:54:31).
- `GET /session/current` shows SES-20261006-0033 SEALED.
- Web: sign-out 204, then `auth/session 401`.

## 5. Defects (RF2-n)

| ID | Severity (proposed) | Where | Expected | Observed | Repro | Evidence |
|---|---|---|---|---|---|---|
| RF2-1 | Low | mobile Sessions hub, expanded tablet layout, detail pane, Subject row (`features/sessions/session-detail.tsx` and CF2-B's 342.5 dp pane) | The name wraps between words or fits | The name breaks inside a word next to the "Tersangka" chip: "Retno W / ulandari" (SES-0027, 2/2), "Siti Rahm / awati" (SES-0025, 1/1). "Dewi / Lestari" wraps between words. The value is still readable and the node holds the full text. CF2-B's device proof covered SES-0026/0028/0029 only | Sessions -> select SES-20261006-0027 or -0025 | `c5_rf2_1_subject_name_breaks_inside_word_crops.png`, `c5_h1_b_select_0027.png`, `c5_h3_a_select_0025.png` |
| RF2-2 | Medium | mobile tablet, session monitor and replica after a web stop (the RF-PH-2 family; CF2-A §2.4 "replica learning the seal late") | After a web stop the monitor hands over to Finalizing within about 1-2 s (phone: 0.26-2.17 s in 6 runs) and the Summary follows the seal | A stop about 11 s into the recording: Finalizing 0.29 s (T1), **3.19 s** (T2) and **6.73 s** (T3) after the Core stop. Until then the "Recording" monitor holds the frozen timer. In T3 Finalizing came only after the Core had already sealed, then replayed its steps, and the Summary came about 13.6 s after the seal ("Resynced route", device 22:51:23.229). Host load 2.2-3.8, so not explained by host load. Exceeds the about 4 s residual D236 accepted (measured on the phone at load 9-11). Cause not established: no socket close in the Core log | Tablet: start a session, web 5177 End Session about 10 s after RECORDING (2 of 3 runs) | `c7_t2_web_stop_frames.png`, `c7_t3_web_stop_frames.png`, `c7_rf2_2_t3_finalizing_replayed_after_seal_frames.png`, `c7_rf2_2_t3_tablet_web_stop_to_summary_540px.mp4`, `tablet_session_runs.txt`, `device_js_logs_per_run.txt` |

Observations (already known or routed; not counted as defects):

- **O-RF2-1** The single empty frame at the Summary route swap: phone 5/6, tablet 2/3. This is the D236 residual routed to W93.
- **O-RF2-2** Clocks with seconds held at ":00".
  - Home header "22:35:00" at 22:35:52 and "22:47:00" at 22:47:26.
  - Network & Time System Time card "22:39:00" at 22:39:33, 22:39:40 and 22:39:47 (`o_rf2_system_time_card_seconds_held_at_00.png`).
  - This is O-CF2-B-1, routed to W93 by D235. The System Time card is a second place it shows.
- **O-RF2-3** Reanimated "Unable to find SurfaceMountingManager" warnings: 1,370-1,623 per run, the same structural counts CF2-A measured (routed to W93).
- **O-RF2-4** W-level "Handler … on a dead thread" lines (MediaCodec and Choreographer handlers) at the monitor hand-over: 2-8 matched lines in S3, X2, X3, T1 and T3. They are warnings; the process kept running.
- **O-RF2-5** The faded "Sealed" chip on the Sessions detail hero (O-CF2-B-2) is still visible in every `c5_*` capture.

## 6. Rules held, deviations

Held:

- Only emulator-5554 and emulator-5556 were addressed.
- No PIN, lock, fingerprint, `locksettings`, `adb emu finger` or settings change. No Hermes inspector. No `device-session.sh`.
- `adb reverse` was unchanged: 5554 `tcp:8081 -> 8081`, `tcp:4420 -> 4421`; 5556 `tcp:4420 -> 4422`. Checked at 22:17 and 22:55.
- `/` was never launched with `motion=`. No server, Vite, Metro, mock-core or emulator was started or stopped. No reset, scenario, fault or role change. Nothing on *:5432.
- Web origins were 127.0.0.1:5176 and 127.0.0.1:5177 only.
- The biometric offer was answered "Not now" on both devices.
- No capture within 2 s of a password: the first captures came 6.45 s (phone) and 6.27 s (tablet) after the Enter key.
- uiautomator dumps: phone 3 (More only); tablet 9 (Evidence 2, Sessions 3, Settings 1, Account 3). None on Login, Summary or Home.
- No tracked file was modified.
- Secret scan of the 20 text assets: password occurrences 0, token-shaped strings 0 (count-only scan, constant imported, never printed).
- Extracted frame folders were deleted after the contact sheets were made (706 MB). Recordings kept: two, re-encoded to 540 px (24 s and 27 s).

Deviations:

- **D-RF2-1 — T2 first attempt (22:43-22:46) aborted, no session created.**
  - The tablet Summary must be scrolled before Done is reachable; RF-T scrolled first, and my first generator did not.
  - The wizard taps therefore landed on the T1 Summary. One tap opened the VIDEO-01 hash sheet (a public evidence hash), and "RF2 T2" was typed into that sheet's read-only value field (unchanged afterwards).
  - On the web, End Session was pressed on the already SEALED session: no reason field, and the confirm was not found. Nothing was stopped.
  - Recovery: close the sheet, scroll, Done (`d1_t2_*` captures). The generator was fixed, and T2 was then run from Home. That run is the one counted as run 2.
  - The aborted recording is not kept.
- **D-RF2-2 — E2's tap after a short scroll** re-selected the already selected 0018 instead of 0014. E2 still had three selection changes and two scrolls with every row drawn.
- **D-RF2-3 — One phone batch** sent an invalid regular expression to `ids` on More. The dump ran (More is allowed); the filter failed, and the next batch repeated it.

## 7. Screenshot index

| File | Caption |
|---|---|
| `p01_phone_login_live_after_relaunch.png` | Phone Login after force-stop and relaunch with `demsdemo:///login?core=LIVE&motion=off`, "Core online" (22:19:05) |
| `p02_phone_after_signin_summary_with_biometric_offer.png` | Phone after budi's sign-in: pending Summary SES-0086 with the biometric offer, answered "Not now" (22:19:27) |
| `c1_s1_web_stop_30s_frames.png` | Check 1 S1: Ready -> monitor cross-fade, timer 3/10/20/28 s against Core 3.6/10.5/20.5/28.6 s, last monitor -> Finalizing -> Summary |
| `c1_s2_web_stop_30s_frames.png` | Check 1 S2: the same; plus the known empty frame at the Summary route swap (f_560) |
| `c1_s3_web_stop_30s_frames.png` | Check 1 S3 (verification): the same; route-swap empty frame f_536 |
| `c2_x1_early_web_stop_frames.png` | Check 2 X1: stopped session's monitor at 00:00:00 for 0.74 s, then Finalizing, then Summary |
| `c2_x2_early_web_stop_frames.png` | Check 2 X2: stale monitor 0.63 s, then Finalizing, then Summary |
| `c2_x3_early_web_stop_frames.png` | Check 2 X3 (verification): stale monitor 1.86 s, then Finalizing, then Summary |
| `p10_phone_home_after_six_runs.png` | Phone Home after the six runs: Core Live, Ready, recent EV-0079/0078/0077 (22:33:55) |
| `p12_phone_end_login_signed_out_live.png` | Phone end state: Login, "You have been signed out.", Core online (22:34:33) |
| `t01_tablet_login_live_after_relaunch.png` | Tablet Login after force-stop and relaunch, "Core online", paired as DEV-0001 (22:35:31) |
| `t02_tablet_home_after_signin_biometric_offer.png` | Tablet Home after budi's sign-in with the biometric offer; the header clock shows 22:35:00 at 22:35:52 (O-RF2-2) |
| `c4_e0_evidence_list_before_selection.png` | Check 4: Evidence list before any selection (22:36:15) |
| `c4_e1_a_select_0019.png` | Check 4 E1: EV-0019 selected |
| `c4_e1_b_select_0018.png` | Check 4 E1: EV-0018 selected, EV-0019 drawn after losing the selection |
| `c4_e1_c_select_0017.png` | Check 4 E1: EV-0017 selected, EV-0018 and EV-0019 drawn |
| `c4_e1_d_scrolled_down.png` | Check 4 E1: list scrolled down, every row drawn |
| `c4_e1_e_scrolled_back.png` | Check 4 E1: scrolled back, every row drawn |
| `c4_e2_a_select_0020.png` | Check 4 E2: EV-0020 selected |
| `c4_e2_b_select_0016.png` | Check 4 E2: EV-0016 selected, EV-0020 drawn |
| `c4_e2_c_select_0018.png` | Check 4 E2: EV-0018 selected, EV-0016 drawn |
| `c4_e2_d_scrolled_tap_landed_on_0018_again.png` | Check 4 E2: after a short scroll the tap re-selected EV-0018 (D-RF2-2); all rows drawn |
| `c4_e2_e_scrolled_back.png` | Check 4 E2: scrolled back, all rows drawn |
| `c4_e3_a_select_0015.png` | Check 4 E3: EV-0015 selected (partly visible row) |
| `c4_e3_b_select_0019.png` | Check 4 E3: EV-0019 selected, others drawn |
| `c4_e3_c_select_0020.png` | Check 4 E3: EV-0020 selected, EV-0019 drawn |
| `c4_e3_d_scrolled_down.png` | Check 4 E3: scrolled down, every row drawn |
| `c4_e3_e_scrolled_back.png` | Check 4 E3 (verification): scrolled back, every row drawn |
| `c5_h0_sessions_hub_list.png` | Check 5: Sessions hub before selection |
| `c5_h1_a_select_0028.png` | Check 5 H1: SES-0028 selected, detail pane readable |
| `c5_h1_b_select_0027.png` | Check 5 H1: SES-0027 selected; the subject wraps "Retno W / ulandari" (RF2-1) |
| `c5_h1_c_detail_scrolled.png` | Check 5 H1: detail pane scrolled to Evidence ID, every label and value on one line |
| `c5_h2_a_select_0030.png` | Check 5 H2: SES-0030 selected |
| `c5_h2_b_select_0026.png` | Check 5 H2: SES-0026 selected, "Dewi / Lestari" wraps between words; SES-0027 row drawn after deselection |
| `c5_h3_a_select_0025.png` | Check 5 H3: SES-0025 selected, "Siti Rahm / awati" (RF2-1) |
| `c5_h3_b_select_0027_again.png` | Check 5 H3: SES-0027 again, same mid-word break (RF2-1, 2/2) |
| `c5_h3_c_after_devices_select_0029.png` | Check 5 H3 (verification): after visiting Devices, SES-0029 selected, all one line |
| `c5_rf2_1_subject_name_breaks_inside_word_crops.png` | RF2-1: Subject-row crops of the five detail panes |
| `c6_n1_network_time.png` | Check 6 N1: Network & Time; Last Sync "6 Oct 2026 / 22:39:22", Time Source "GPS (GNSS / Stratum-1)" |
| `c6_n2_network_time.png` | Check 6 N2: the same after re-entering from Storage |
| `c6_n3_network_time.png` | Check 6 N3 (verification): the same after re-entering from Evidence |
| `c6_time_sync_card_n1_n2_n3_crops.png` | Check 6: Time Synchronization card crops of N1, N2, N3 |
| `o_rf2_system_time_card_seconds_held_at_00.png` | O-RF2-2: System Time card reads 22:39:00 in captures at 22:39:33, :40, :47 |
| `c7_t1_a_wizard_step1_filled.png` | Check 7 T1: tablet wizard step 1 filled (case LP/2026/1006-0015, Tersangka, "RF2 T1") |
| `c7_t1_b_ready.png` | Check 7 T1: wizard Ready step before Start Recording |
| `c7_t1_web_stop_frames.png` | Check 7 T1: first monitor frame, last monitor frame -> Finalizing (0.29 s after the stop), Summary |
| `c7_t1_c_after_summary.png` | Check 7 T1: Summary SES-0031 SEALED (22:42:27) |
| `c7_t2_b_ready.png` | Check 7 T2: wizard Ready step |
| `c7_t2_web_stop_frames.png` | Check 7 T2: monitor held 00:00:11 until Finalizing 3.19 s after the stop (RF2-2); route-swap empty frame f_470 |
| `c7_t2_c_after_summary.png` | Check 7 T2: Summary SES-0032 SEALED (22:49:29) |
| `c7_t3_b_ready.png` | Check 7 T3: wizard Ready step, "RF2 T3" |
| `c7_t3_web_stop_frames.png` | Check 7 T3 (verification): monitor until Finalizing 6.73 s after the stop (RF2-2), route-swap empty frame f_575, Summary |
| `c7_rf2_2_t3_finalizing_replayed_after_seal_frames.png` | RF2-2: T3 Finalizing steps still running at device 22:51:13-20 after the 22:51:10.8 seal; Summary at 22:51:24.0 |
| `c7_t3_c_after_summary.png` | Check 7 T3: Summary SES-0033 SEALED (22:51:52) |
| `d1_t2_first_attempt_taps_landed_on_summary.png` | D-RF2-1: aborted T2 attempt, the wizard taps landed on the T1 Summary (Done not yet scrolled into view) |
| `d1_t2_recovery_summary_scrolled_to_done.png` | D-RF2-1: recovery, the Summary scrolled to Done / View in Evidence |
| `t20_tablet_end_login_signed_out_live.png` | Tablet end state: Login, "You have been signed out.", Core online, paired as DEV-0001 (22:54:31) |

Other assets (`test/assets/retest3/`):

- Recordings: `c2_x3_phone_early_web_stop_540px.mp4`, `c7_rf2_2_t3_tablet_web_stop_to_summary_540px.mp4`.
- Analyses: `phone_frame_analysis.txt`, `phone_frame_analysis_raw_json.txt`, `tablet_session_runs.txt`, `native_crash_class_counts.txt`, `phone_crash_scan_whole_window.txt`, `tablet_crash_scan_whole_window.txt`.
- Logs: `core_log_lines.txt`, `device_js_logs_per_run.txt`.
- Driver records: `phone_driver_batches.txt`, `tablet_driver_batches.txt` (every command and redacted output).
- Drivers and tools: `driver_rf2q.mts.txt`, `driver_{run,genrun,wizard,finish,trun,an}.sh.txt`, `tool_{pick,rows,tscan}.py.txt`.

## 8. End state (verified 22:55)

- **emulator-5554:** app focused, no keyguard, Login, signed out, Core online. The last session SES-20261006-0092 is SEALED.
- **emulator-5556:** app focused, Login, signed out, Core online. SES-20261006-0033 is SEALED.
- **Device processes and files:** no screenrecord process on either device; no rf2 file left on /sdcard. The pre-existing `w67.xml` and `e2e_t.xml` are not mine and were left in place.
- **Host:** both browsers closed; no headless shell or driver process; no profile left in TMPDIR. Host load 2.72.

---
*Generated: 2026-10-06 22:58*
