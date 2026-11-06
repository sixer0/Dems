---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: RF-PH (final independent re-test of CF-M1 and CF-M2 on the phones)
agent: verifier
date: 2026-10-06
narrative_tier: 2
status: needs-review
verdict: "R-P-1 PASS at the hand-over (16 recorded web stops: 0 crashes, 0 red or black screens, monitor -> Finalizing every time); R-P-2 PASS on its two criteria (0 false banners, 0 backward timer steps) but the timer HOLDS behind the Core under load (RF-PH-1); R-P-3 PASS; R-S-2 PASS (4 hand-offs, 0 'unreachable' frames); R-S-1 measured (616-882 ms at load 3.7-5.4, no dark frame); smoke 5/5. New: RF-PH-1..4 (RF-PH-4 seen 1 of 2). R-S-1 and the extra repetitions were trimmed by the controller after they had run"
assets: test/assets/retest2/ph/
references: decisions D211, D213, D216, D218; gateway_check/12a_cf_mobile_runtime.md, 12b_cf_mobile_screens.md; test/08b_retest_phone.md, 08d_retest_pairing.md
---

# RF-PH: final independent re-test on the phones (emulator-5554, emulator-5558)

Times are WIB (+07:00). "host" is the Mac clock (Core logs). "device" is the phone clock that `screenrecord --bugreport` burns into every frame. The offset device - host was measured before each recording (`p clock`, 5 bracketed reads): phone -427 to -457 ms, phone2 -670 to -677 ms.

## 0. Controller trim and user rule (received after the work was done)

Two controller messages arrived after the device work had finished:

1. About 18:05: stop the R-P-1 loop after R13-R16, drop check 5 (R-S-1; ruled to W98 in D218), do one R-S-2 hand-off, and do one pass of R-P-3 and smoke.
2. Later, the user's rule: two runs plus one verification per check; detailed repetition only in the final pre-handover session; no more loop runs.

By then the following had already run:

- R-P-1: 18 runs. R17 (an attempt to repeat RF-PH-2) and R18 ran after R13-R16, before the trim.
- R-S-1: 4 revokes, measured 17:29-17:39. Check 5 counts as **dropped by controller instruction**: the numbers are reported because they exist and are a measurement only (D218).
- R-S-2: 4 hand-offs, where one was asked for.

R-P-3 and smoke were done once. Nothing ran after the messages except:

- the RF-PH-4 idle repeat, which was already queued and only waited and captured (§6.4);
- the end-state checks: two Core reads per lane and the dismissal of the expiry dialog (§8).

No session was left recording.

## 1. Environment

| Item | Value | Evidence |
|---|---|---|
| Phones | dems2_phone = `emulator-5554` (1080 x 2424; lane 1: adb reverse `tcp:4420 -> tcp:4421`, Core 4421, web 5176). dems2_phone2 = `emulator-5558` (1080 x 2424; main: `tcp:4420 -> tcp:4420`, web 5173). `emulator-5556` was never addressed | `adb devices -l`, `wm size`, `adb reverse --list` (16:35, read only, not changed) |
| Device state | `isKeyguardShowing=false` and the DEMS app focused at every batch. The driver checks before each line and stops on a keyguard; it never stopped | driver batch outputs |
| Fresh bundle | `am force-stop`, then `am start -a VIEW -d 'demsdemo:///login?core=LIVE&motion=off'` on both phones at 16:38. Both showed LIVE Login, "Core online", phone "paired as DEV-0001", phone2 "paired as DEV-0019". The phone was relaunched again the same way at 17:44 to recover from RF-PH-4 | `rf_00_phone_relaunched_login_live_dev0001.png`, `rf_01_phone2_relaunched_login_live_dev0019.png`, `rfph4_login_normal_after_relaunch.png` |
| Core | lane 1: `dems-core-server 0.2.0`, api v1, database and engine ready, uptime 16,085 s at 16:40:12. Main: 4420 (request lines in `.cache/manual/main-server.log`) | `GET /api/v1/health` (16:40:12) |
| Web | Playwright-cache headless shell `chromium_headless_shell-1243` (HeadlessChrome/153.0.8010.12) over raw CDP, `--remote-debugging-port=0`. The port was read from `DevToolsActivePort`, and `lsof` showed the listener belonged to the spawned pid each time. Fresh profiles in `$TMPDIR` (removed on exit). Origins only `127.0.0.1:5176` (andi.pratama, SUPERVISOR) and `127.0.0.1:5173` (andi.pratama) | driver outputs (`w1: ... listener owned by pid ...`) |
| Driver | `rf_driver_rfq.mts.txt` = CF-M1's queue driver with these changes: the Hermes inspector command and the stall helper are removed, so there were no JS stalls and no inspector use at all; no capture within 2.5 s of typing into a password field; a load guard before each `screenrecord` (it waits while the 1-min load is above 14); a `marker` pattern; the hand-off recording starts 1.2 s after the 201 (added after H3, §5.2). Batch scripts `rf_driver_*.sh.txt`. Frame tools `rf_tools_*.py.txt`, which reuse CF-M1's `fx.py` glyph templates | `test/assets/retest2/ph/` |
| Frame judgement | Every frame of every recording was extracted (passthrough) and judged by script:<br>- device time from the overlay;<br>- monitor = the REC dot found;<br>- banner = yellow or green band above the REC row, or the row shifted down;<br>- timer = six digits decoded by templates;<br>- empty frame = the app area (y 60-1170 of 540 x 1212) is uniform (sd < 6). The status bar and the gesture pill are excluded, which a whole-frame test misses;<br>- red screen = more than 35 % red.<br>The detector was validated on CF-M1's pre-fix recordings: E3 gives 58 banner frames, E2 gives the backward step 03:28 -> 03:23 | `rf_detector_positive_controls.txt` |
| Host load | 1-min load 3.0-14.0 at the starts of the recordings (the R-P-1 loop paused 13 times while the load was above 14; peak 27.3 at 16:53). The tablet row and its headless shell ran in parallel | loop logs; `host load` line in each batch |
| Recordings in assets | Re-encoded to 540 px wide with the frame count and timestamps kept (passthrough; for example R01: 798 frames before and after). The device-time overlay is burnt in. The analysis ran on the original frames | `rp1_*.mp4`, `rp3_*.mp4`, `rs1_*.mp4`, `rs2_*.mp4` |

## 2. Summary

| Check | Result | Key numbers |
|---|---|---|
| **R-P-1** web stop while the phone records on the monitor (phone budi.santoso, web 5176 andi.pratama), plain runs | **PASS at the hand-over** | 18 web stops R01-R18, every session SEALED. 16 hand-overs recorded:<br>- 12 with the stop landing on a drawn monitor (R01-R04, R06, R07, R09, R12-R16, R18);<br>- 4 with the stop landing before the monitor was drawn (R05, R08, R17, and R11, whose hand-over was not recorded).<br>Results: **0 crashes, 0 red screens, 0 black screens, 0 crash-class native lines** in 18 runs (`addViewAt`, `Tried to remove view`, `handleHostException`, `reactInstance is null`, `FATAL EXCEPTION`, `IndexOutOfBoundsException`). **Last monitor frame -> next frame = Finalizing card in 16/16**, with 0 empty frames after the monitor. Core 202 -> Finalizing drawn: 0.62-10.0 s. Variants: early (R02, R05, R08, R11, R17), about 7 s (R13, R16), about 30 s (R03, R06, R09, R12, R15, R18), right after a Bookmark (R01, R04, R07, R14: stop 0.65-1.08 s after the marker's 204). Incidents: R00 calibration (not counted), R10 (§3.2) |
| **R-P-2** false "Core link lost" / timer backwards | **PASS on both criteria, with a new defect** | **0 banner frames** in 18 recordings (7,188 frames; 5,951 monitor frames). **0 backward steps** in 5,951 decoded timer readings (0 undecoded). But the timer **holds** behind the Core:<br>- lag above 2.5 s in 12 of the 14 recordings that show the monitor before the stop;<br>- above 5 s in 7 of them;<br>- up to 21 s at 00:00:00 (R10) and 17.5 s at 00:00:14 (R09), while the JS-driven feed timestamp keeps running.<br>That is **RF-PH-1** |
| **R-P-3** Settings > Device Settings with a device detail open | **PASS** | Camera 1 detail open in Devices -> More -> Settings -> Device Settings: the Devices list opens at its root (no detail frame in the recording), and **one Back** returns to Settings (17:47:02.8-17:47:07.6, recorded) |
| **R-S-2** pairing hand-off, phone2 | **PASS** | 4 hand-offs (H1-H4), each after a revoke of phone2's own device. **0 frames** with "Core server unreachable" or "Use Simulated mode" (classified on all 258 frames, plus a visual check). Login 2.82-3.12 s after the redeem's 201. 0 empty frames. 0 `SYNC_TIMEOUT` lines in the app log |
| **R-S-1** revoke-to-Pair (measurement, D218) | **dropped by controller instruction** (ran before it arrived; figures for the record) | Signed out: **674 ms** (S1, load 5.1) and **616 ms** (S2, load 5.4). Signed in: **882 ms** (I1, load 4.5) and **823 ms** (I2, load 3.9). **No dark frame** in any of the four. Only the low-load case was measured (§5.1) |
| **Smoke** (phone) | **5/5** | Home, Sessions, Evidence detail, Devices, Settings. On the Hash & Integrity tab the heading shows the Core's stored verification: EV-20261006-0063 (Core `NOT_RUN`) reads "Not verified yet"; EV-20261005-0014 (Core `PASS` at 00:20:19, custody VERIFIED OPR-001) reads "Verified by the Core · Last verification PASS · 6 Oct 2026 00:20:19 UTC+07:00 · AKP Budi Santoso" |
| New defects | 4 | RF-PH-1 Medium (timer holds behind the Core under load); RF-PH-2 Medium (stale "Recording" monitor when the web stop lands before the monitor is drawn, 71 s in R11); RF-PH-3 Low (one empty frame at Ready -> monitor and at Evidence sealed -> Summary); RF-PH-4 Medium, intermittent (Login stuck emblem-only after an idle sign-out; 1 of 2) |

## 3. R-P-1 and R-P-2: runs on the phone (lane 1)

Each run:

1. Summary "Done", Home, Start Session wizard (case number auto, Tersangka, subject "RF PH Rnn"), Next, pre-checks, Ready.
2. The web goes to `/session` (ARMED). One recording starts.
3. Start Recording (3-2-1 countdown), then the web stop at the variant's moment.
4. The web waits for STOPPING, then SEALED. The recording is pulled, the Summary captured, then the native W/E/F log of the app process, the JS log, the Core request lines and the session's audit rows are saved.

### 3.1 Run table

"On mon" = the phone had drawn the monitor before the Core's stop. "202 -> Fin" = the Core's stop answer to the first Finalizing frame (host time). "Max lag" = the largest (Core elapsed - drawn timer) before the stop.

| Run | Action | Result | Timing | Recording/log file |
|---|---|---|---|---|
| R01 | bm: Bookmark (marker 204 16:47:50.150), web stop 0.65 s later; SES-0060 / EV-0047; load 7.6 | on mon; banner 0, blank 0, red 0, backward 0, crash lines 0; monitor -> Finalizing | stop 202 16:47:50.799 (+32.5 s); 202 -> Fin 0.62 s; max lag 3.7 s (start) | `rp1_r01_web_stop.mp4`, `rp1_core_log_audit_per_run.txt` |
| R02 | early; SES-0061 / EV-0048; load 6.3 | on mon (drawn 0.12 s before the stop); all 0; -> Finalizing | 202 16:50:50.508 (+1.0 s); 202 -> Fin 2.23 s; lag 1.3 s | `rp1_r02_web_stop.mp4` |
| R03 | s30; SES-0062 / EV-0049; load 12.4 | on mon; all 0; -> Finalizing | 202 16:52:22.386 (+31.3 s); 202 -> Fin **8.17 s**; lag **7.8 s** (timer 24 held 16:52:15.9-22.6 while the feed stamp ran 14 -> 20) | `rp1_r03_web_stop.mp4` |
| R04 | bm (marker 16:55:27.929), stop 0.86 s later; SES-0063 / EV-0050; load 10.9 | on mon; all 0; -> Finalizing | 202 16:55:28.785 (+13.8 s); 3.01 s; lag 4.5 s | `rp1_r04_web_stop.mp4` |
| R05 | early; SES-0064 / EV-0051; load 10.9 | **stop before the monitor** (monitor drawn +0.85 s after the stop, held 2.7 s); all 0; -> Finalizing | 202 16:56:29.757 (+1.2 s); 3.77 s | `rp1_r05_web_stop.mp4` |
| R06 | s30; SES-0065 / EV-0052; load 9.0 | on mon; all 0; -> Finalizing | 202 16:57:59.630 (+30.3 s); 3.00 s; lag 6.3 s (start) | `rp1_r06_web_stop.mp4` |
| R07 | bm (marker 16:59:45.841), stop 0.88 s later; SES-0066 / EV-0053; load 11.6 | on mon; all 0; -> Finalizing | 202 16:59:46.720 (+14.7 s); 1.96 s; lag 4.4 s | `rp1_r07_web_stop.mp4` |
| R08 | early; SES-0067 / EV-0054; load 11.8 | **stop before the monitor** (monitor drawn +1.1 s after the stop, held **7.1 s**, "Recording 00:00:00"); all 0; -> Finalizing | 202 17:01:11.040 (+1.2 s); **9.08 s** | `rp1_r08_web_stop.mp4` |
| R09 | s30; SES-0068 / EV-0055; load 9.7 | on mon; all 0; -> Finalizing | 202 17:02:49.004 (+33.3 s); **8.24 s**; lag **19.5 s** (0 until 17:02:31.1, then 14 held to the end while the feed stamp ran 29 -> 53) | `rp1_r09_web_stop.mp4` |
| R10 | bm, **incident**: the Bookmark popover did not open; the driver's second tap (meant for "Add marker") opened the phone's own End Session dialog; no marker; web stop at +40.4 s with that dialog open; SES-0069 / EV-0056; load 14.0 | on mon (dialog over it); banner 0, blank 0, crash lines 0. **Hand-over not recorded** (the 34 s recording ended 13 s before the stop). The capture 13 s after the stop shows Finalizing at 50 % (Core SEALED at +7.5 s) | 202 17:05:30.761; lag **21 s** (00:00:00 the whole recording; feed stamp 17:05:08 -> 16) | `rp1_r10_web_stop.mp4`, `rp1_r10_after_finalizing_13s_after_web_stop.png` |
| R11 | early; SES-0070 / EV-0057; load 11.7 | **stop before the monitor**: the phone showed "Starting..." until 17:07:21.49, then one empty frame, then the monitor "Recording 00:00:00" of the already stopped session. **Still on that monitor at 17:07:50** (32 s after the stop, 24 s after SEALED). The app log has the route resync to Finalizing at device 17:08:29.4 (**about 71 s after the stop**) and to Summary at 17:08:42.0. The 15 s recording ended at 17:07:26.5 (it stopped early, no watchdog kill). **RF-PH-2** | 202 17:07:18.462 (+2.5 s) | `rp1_r11_web_stop.mp4`, `rfph2_r11_recording_monitor_32s_after_web_stop.png`, `rfph2_rfph4_device_js_log_extracts.txt` |
| R12 | s30; SES-0071 / EV-0058; load 12.4 | on mon; all 0; -> Finalizing | 202 17:10:19.410 (+30.7 s); 2.64 s; lag **15.6 s** (0 until 17:10:04.4) | `rp1_r12_web_stop.mp4` |
| R13 | e5; SES-0072 / EV-0059; load 10.4 | on mon (7 s); all 0; -> Finalizing | 202 17:19:36.510 (+8.5 s); 6.13 s; lag 8.8 s (00:00:00 for the whole monitor time) | `rp1_r13_web_stop.mp4` |
| R14 | bm (marker 17:21:01.460), stop 1.08 s later; SES-0073 / EV-0060; load 11.7 | on mon; all 0; -> Finalizing | 202 17:21:02.541 (+14.7 s); 2.68 s; lag 3.8 s | `rp1_r14_web_stop.mp4` |
| R15 | s30; SES-0074 / EV-0061; load 10.3 | on mon; all 0; -> Finalizing | 202 17:22:49.750 (+30.3 s); 2.04 s; lag 3.7 s | `rp1_r15_web_stop.mp4` |
| R16 | e5; SES-0075 / EV-0062; load 9.1 | on mon (5 s); all 0; -> Finalizing | 202 17:24:07.387 (+8.2 s); **10.0 s**; lag 8.5 s (00:00:00 throughout) | `rp1_r16_web_stop.mp4` |
| R17 | xearly (an attempt to repeat RF-PH-2); SES-0076 / EV-0063; load 9.7 | stop before the monitor (monitor drawn +1.3 s after the stop, held 4.5 s at 00:00:00); all 0; -> Finalizing | 202 17:25:50.919 (+0.4 s); 6.74 s | `rp1_r17_web_stop.mp4` |
| R18 | s30, low load; SES-0077 / EV-0064; load 5.3 | on mon; all 0; -> Finalizing | 202 17:56:30.766 (+30.0 s); 1.44 s; lag 2.5 s | `rp1_r18_web_stop.mp4` |

Per run:

- Core request lines, the session record and the audit rows are in `rp1_core_log_audit_per_run.txt`. Every run has SESSION_CREATED, PRECHECK_PASSED and RECORDING_STARTED (OPR-001), RECORDING_STOPPED (**OPR-002**, with the run's reason) and EVIDENCE_SEALED; bookmark runs also have MARKER_ADDED (OPR-001).
- Frame facts are in `rp1_frame_analysis.jsonl` and `rp1_runs_summary.jsonl`; native counts in `rp1_native_log_counts.jsonl`.
- The last monitor frame and the next frame of all 16 recorded hand-overs are in `rp1_handover_last_monitor_and_next_frame_16_runs.png`. Each next frame is the "Finalizing evidence" card. In bookmark runs the "Marker added" toast stays over it.

### 3.2 Incidents

- **R00 (calibration, not counted).** `uiautomator dump` fails on the live monitor (`cat /sdcard/rfph.xml` fails three times). The 60 s recording ended before the stop at +71 s and then hung; it was killed by the watchdog. Coordinates were taken from captures from then on.
- **R10.** Under load the Bookmark tap did not open the popover within 3 s. The next tap, meant for "Add marker" (it sits where End Session is), opened the phone's own End Session dialog. The web stop came 40 s after the start with that dialog open, and the hand-over was not recorded. It counts as a web stop, not as a bookmark run.
- **R11's recording** ended at 15 s of a 28 s limit. No hang was reported, so the cause is unknown.

### 3.3 Native log observation (not a crash)

All 18 runs had 0 crash-class lines. They did have **17,211** W-level `Reanimated: synchronouslyUpdateUIProps failed for tag N ... RetryableMountingLayerException: Unable to find SurfaceMountingManager for tag` lines. This is the warning family that preceded R-P-1's crash in D213.

- They come at every screen change of the run: wizard steps, the hand-over, Finalizing -> Summary.
- Between 0 and 937 per run fall within -1 s to +10 s of the stop.
- No visible effect in any frame. Reanimated catches them.

It is reported as an observation. It may be worth a look by whoever owns the Reanimated usage.

## 4. R-P-3 and smoke (phone, one pass)

| Run | Action | Result | Timing | Recording/log file |
|---|---|---|---|---|
| R-P-3 step 1 | Devices tab, then Camera 1 | detail "Camera 1" open (CAM-01, DL-2, 3.8.14) | 17:46:22-25 | `rp3_01_devices_list.png`, `rp3_02_device_detail_camera1_open.png`, `rp3_device_settings_one_back.mp4` |
| R-P-3 step 2 | More tab, then Settings | Settings (System section) | 17:46:28-47 | `rp3_03_more_tab.png`, `rp3_04_settings.png` |
| R-P-3 step 3 | Device Settings | **Devices list at its root, no detail frame** (recording: Settings -> list fade, 17:47:02.8-04.3) | 17:47:02.8 | `rp3_05_device_settings_opens_devices_list_clean.png` |
| R-P-3 step 4 | **one** Back (`KEYCODE_BACK`) | **Settings** | 17:47:06.3 -> 07.6 | `rp3_06_one_back_returns_to_settings.png` |
| Smoke Home | Home tab | Ready for Recording, 2/2, 2/2, 20 %, recent EV-0063/62/61 | 17:50:47 | `sm_01_home.png` |
| Smoke Sessions | Sessions tab | SES-0076 ... SES-0072 sealed, durations equal to the runs (for example R15 00:00:30) | 17:50:51 | `sm_02_sessions.png` |
| Smoke Evidence detail | EV-20261006-0063, then Hash & Integrity | heading **"Not verified yet"** + "The Core holds no verification of this item yet" = Core `verification: NOT_RUN` | 17:51:26-47 | `sm_03_evidence_detail_ev0063.png`, `sm_03b_evidence_ev0063_hash_integrity_not_verified_yet.png` |
| Smoke Evidence detail (Core PASS) | search EV-20261005-0014, then Hash & Integrity | **"Verified by the Core"**, "Last verification PASS · 6 Oct 2026 00:20:19 UTC+07:00 · AKP Budi Santoso" = Core `verification: PASS, at 1791220819622` (00:20:19.622 +07:00), custody VERIFIED OPR-001 | 17:52:25 | `sm_03c_evidence_ev20261005_0014_hash_integrity_verified_by_core.png` |
| Smoke Devices | Devices tab | cameras and mics Online, PoE "1 active · 1 spare", Tablet Connected | 17:50:55 | `sm_04_devices.png` |
| Smoke Settings | More, then Settings | Account Investigator AKP Budi Santoso; Application; System | 17:52:57 | `sm_05_settings.png` |

Core values read through web 5176 (andi.pratama) at 17:50: `GET /api/v1/evidence?limit=100` gave 63 items, of which only EV-20261005-0014 has a stored verification (PASS).

## 5. Phone2 (main): R-S-1 and R-S-2

Order: S1 (signed-out revoke of DEV-0019) -> H1 -> sign in -> I1 -> H2 -> S2 -> H3 -> sign in -> I2 -> H4.

- Each revoke: andi.pratama on web 5173 revoked phone2's own device. The driver refuses any id other than the one phone2 last paired as, and every revoke was the only Paired row.
- Each code was issued with the blur mask injected and checked before the web screenshot, typed digit by digit by the driver (never printed), and redeemed.
- The app's "signed in" state for I1/I2 was the Session Summary of SES-20261006-0025, where budi lands after sign-in on main. It was not acknowledged, so main's state was not changed.

| Run | Action | Result | Timing | Recording/log file |
|---|---|---|---|---|
| S1 | revoke DEV-0019, phone2 signed out on Login; load 5.10 / 4.93 (before / at the revoke) | Login -> cross-fade -> Pair; **no dark frame**; 0 "unreachable" frames | revoke 200 17:29:07.108; first change +573 ms; **Pair +674 ms** | `rs1_s1_revoke_signed_out.mp4`, `rs1_revoke_to_pair_frames_4_revokes.png` |
| H1 | code issued 17:30:09.827, redeem 201 17:30:16.043 -> DEV-0020 | paired view -> Login, 0 unreachable, 0 empty | Login +2,957 ms | `rs2_h1_pairing_handoff.mp4`, `rs2_h1_after_login_dev0020.png` |
| I1 | revoke DEV-0020, budi signed in (Summary); load 4.51 | Summary -> cross-fade -> Pair; no dark frame | revoke 200 17:33:06.284; change +835 ms; **Pair +882 ms** | `rs1_i1_revoke_signed_in.mp4` |
| H2 | redeem 201 17:34:12.498 -> DEV-0021 | 0 unreachable, 0 empty | Login +2,822 ms | `rs2_h2_pairing_handoff.mp4` |
| S2 | revoke DEV-0021, signed out; load 5.37 / 5.18 | Login -> Pair; no dark frame | revoke 200 17:34:47.820; change +534 ms; **Pair +616 ms** | `rs1_s2_revoke_signed_out.mp4` |
| H3 | redeem 201 17:35:28.171 -> DEV-0022 | 0 unreachable, 0 empty. Frames 1-2 blacked out (§5.2) | Login +3,115 ms | `rs2_h3_pairing_handoff.mp4` |
| I2 | revoke DEV-0022, signed in (Summary); load 3.88 / 3.73 | Summary -> Pair; no dark frame | revoke 200 17:39:22.962; change +793 ms; **Pair +823 ms** | `rs1_i2_revoke_signed_in.mp4` |
| H4 | redeem 201 17:40:03.033 -> **DEV-0023** | 0 unreachable, 0 empty | Login +2,938 ms | `rs2_h4_pairing_handoff.mp4`, `rs2_h4_after_login_dev0023.png` |

Audit rows on main (newest first, from `GET /api/v1/audit?order=DESC`):

| Event | Rows |
|---|---|
| S1 / H1 | AUD-000296 DEVICE_REVOKED OPR-002 DEV-0019 "RF-PH revoke timing S1"; AUD-000298 PAIRING_CODE_ISSUED OPR-002; AUD-000299 PAIRING_SUCCESS DEV-0020 |
| I1 / H2 | AUD-000305 DEVICE_REVOKED DEV-0020; AUD-000307/308 issue and success DEV-0021 |
| S2 / H3 | AUD-000310 DEVICE_REVOKED DEV-0021; AUD-000312/313 issue and success DEV-0022 |
| I2 / H4 | AUD-000317 DEVICE_REVOKED DEV-0022; AUD-000319/320 issue and success DEV-0023 |
| After every revoke and redeem | TABLET_LINK_CHANGED |

Core lines (main) of every revoke: `POST /api/v1/pairing/devices/:id/revoke 200`, then `[socket closed]` within 8 ms, then `[socket opened]` 0.7-1.0 s later. For each redeem: `POST /api/v1/pairing/code 201` and `POST /api/v1/pairing/redeem 201`. All are in `rs_phone2_batches_core_log_audit.txt`; the frame timings are in `rs_revoke_and_handoff_frame_timings.txt`.

### 5.1 R-S-1 reading

- At host load 3.7-5.4 every revoke reached a fully drawn Pair screen in **616-882 ms**. There was no dark boot-anchor frame and no "unreachable" frame, in both states.
- Signed-in was about 200 ms slower than signed-out (823 and 882 ms against 616 and 674 ms).
- This agrees with CF-M1's 475-776 ms at load 5-6. It does **not** test the load at or above 10 where CF-M1 measured 1.3-2.4 s.
- The load was low because the lane-1 loop had finished. W98 (release build) remains the decision point.

### 5.2 Secret hygiene incident: redeemed code in two frames (H3)

- In H3 the recording started after the app logged its 201, as designed. The app's UI still showed "Pairing..." with the typed digits for about 0.6 s, and frame 2 of the recording showed the already-redeemed code. Frame 1 is screenrecord's info card.
- The check was made on heavily blurred thumbnails only. The digits were partly discernible there, so the code was seen in that blurred view; it was never printed or written as text.
- What was done:
  - frames 1-2 were blacked out in the MP4 (ffmpeg drawbox, then checked: frames 1-2 have a maximum luma of 0 and frame 3 is intact; 64 frames in both versions);
  - the original MP4 was deleted and the two extracted frames overwritten with black;
  - the driver was changed to start the hand-off recording 1.2 s after the 201. H4 started at +1.9 s on the paired view.
- The code was single-use and already redeemed. H1, H2 and H4 began on the "Tablet paired" view (checked the same way). The count-only scans after each redeem found the code 0 times in the device JS log, the main server log and the driver's event log.

## 6. Defects

### RF-PH-1 (Medium): the monitor timer holds behind the Core under load (not backwards)

**What.**

- After the start, and again after a JS stall, the timer stays on one value for 5-21 s while the Core records. It then jumps forward to the true time.
- **Lag above 2.5 s in 12 of 14** recordings with a monitor before the stop; **above 5 s in 7** (R03 7.8, R06 6.3, R09 19.5, R10 21.0, R12 15.6, R13 8.8, R16 8.5 s).
- In R13 and R16 the timer read 00:00:00 for the whole 5-7 s the monitor was shown. The Summary then showed the right lengths (00:00:08).
- At load 5.3 (R18) the lag was 2.5 s.

**Why it matters.**

- The operator sees a frozen recording timer (00:00:00 for up to 21 s) while the Core records.
- R-P-2's backwards defect is gone (0 backward steps), but the timer still does not track the Core under the host load this environment runs at (9-14).

**How verified.**

- Every monitor frame was decoded by the glyph templates (5,951 readings, 0 undecoded). The lag is (Core elapsed at the frame's host time - drawn value): `rf_tools_lag.py.txt`, `rp1_runs_summary.jsonl`.
- The holds are not a frozen JS thread. The feed's burnt-in timestamp keeps running meanwhile, and under `motion=off` it is a 1 Hz JS `setInterval` on the device clock (`apps/mobile/src/components/media/camera-feed.tsx:340-352`). For example, R09 shows timer 00:00:14 from host 17:02:31.1 to 17:02:56.9 while the feed stamp goes 17:02:29 -> 17:02:38 -> 17:02:53.
- There was no banner, and the Core logged no socket close or open for the phone during any run.
- Frames: `rfph1_timer_holds_while_feed_clock_runs.png`.

**Hypothesis (not proven).** The timer reads the Live store's clock, published every `CLOCK_TICK_MS` through the Live source's timers (`packages/shared/src/live/source/live-sim.ts:2568`), which CF-M1 wrapped in `createStallTolerantTimers` (`apps/mobile/src/runtime/stall-tolerant-timers.ts`).

- There, a callback more than 250 ms late yields 50 ms, up to 20 times.
- On a starved emulator each 50 ms yield can itself fire more than 250 ms late. The bound "about 1 s" then becomes 20 late yields, which is many seconds.
- A second candidate is the Live clock's never-backwards hold (`packages/shared/src/live/source/clock.ts`) after late heartbeat samples.

Either way it is a side effect worth checking against CF-M1's R-P-2 fix.

### RF-PH-2 (Medium): stale "Recording" monitor when the web stop lands before the monitor is drawn

**What.** When the web stop reached the Core while the phone still showed "Starting..." (R05, R08, R11, R17), the phone then drew the monitor of the already-stopped session ("Recording 00:00:00", End Session enabled). It stayed there:

| Run | Monitor held | Core 202 -> Finalizing |
|---|---|---|
| R05 | 2.7 s | 3.8 s |
| R17 | 4.5 s | 6.7 s |
| R08 | 7.1 s | 9.1 s |
| **R11** | still on the monitor at 17:07:50, 32 s after the stop and 24 s after the Core sealed | route resync to Finalizing at device 17:08:29.4 (about 71 s), to Summary at 17:08:42.0 |

No crash and no blank screen at that hand-over.

**Why it matters.** The phone shows an active recording for a session the Core has already sealed. A stop from the web (another operator) in the first second is a normal case.

**How verified.**

- Frames and captures: `rfph2_stale_recording_monitor_after_early_web_stop.png`, `rfph2_r11_recording_monitor_32s_after_web_stop.png`.
- App log: `rfph2_rfph4_device_js_log_extracts.txt`. The R11 lines are quoted from a logcat read made between 17:11 and 17:18, because the ring buffer had rotated by 18:06.
- Core: `rp1_core_log_audit_per_run.txt`.
- An attempt to repeat it (R17) gave the 4.5 s form, not the 71 s one.

**Hypothesis.**

- The in-place Finalizing hand-over (`apps/mobile/src/app/(app)/session/live.tsx`) reacts to the stop transition while the monitor is mounted. Here the monitor mounted after that transition, so only the route resync was left, and it ran late.
- RF-PH-1's starved Live-source timers are a likely common cause.

### RF-PH-3 (Low): one empty frame at two route changes

**What.** 16 frames in 13 of 18 recordings show only the app background, the status bar and the gesture pill, for 7-109 ms:

| Route change | Count | Runs |
|---|---|---|
| Ready ("Starting...") -> monitor | 7 | R07, R08, R09, R10, R11, R12, R16 |
| "Evidence sealed" card -> Session Summary | 9 | R02, R04, R05, R07, R12, R13, R15, R16, R18 |

**Never** at monitor -> Finalizing (0 in 16 hand-overs) and never in R-P-3 or the hand-offs.

**Why it matters.**

- R-P-1 asked for 0 blank frames. The hand-over meets that; the run as a whole does not.
- It is the same empty-anchor class as the revoke dark frame that D218 sent to W93.
- CF-M1's whole-frame detector could not see these frames, because the pill and the status bar keep the whole-frame sd above 6.

**How verified.** `rf_tools_blank2.py.txt`, `rp1_empty_frames.jsonl`, `rfph3_empty_frames_at_route_changes.png`.

### RF-PH-4 (Medium, intermittent: 1 of 2 idle expiries): after an idle sign-out, Login shows only the emblem

**What.**

- At host 17:40:50.6 the Core closed budi's (OPR-001) and andi's sockets with 4401. The app logged `auth.sessionEnd` `IDLE_EXPIRED` at device 17:40:50.250. The phone was on the Summary of R17, 15 min after its last activity.
- The phone then showed **only the emblem ring on the dark background: no title, no form, no Core line**. This lasted at least 3 min 10 s: identical captures at 17:41:38, 17:42:46 and 17:44:01 (pixel difference below the status bar: none), and a 10 s recording with no new frame.
- The app process stayed focused. Its log shows an 8 s `getAuthSession` time-out, then a 401 re-check, and nothing after.
- Recovered by a relaunch (force-stop, then the login deep link) at 17:44. A normal sign-out from More at 17:53 showed the full Login ("You have been signed out.").

**Why it matters.** An operator whose session idles out cannot sign in again without killing the app.

**How verified.** `rfph4_login_emblem_only_48s_after_idle_sign_out.png`, `rfph4_login_emblem_only_3min_after_idle_sign_out.png`, `rfph4_login_emblem_only_static_10s.mp4`, `rfph4_login_normal_after_relaunch.png`, and the log extract.

**Repeat attempt.** §6.4.

### 6.4 RF-PH-4 repeat attempt (idle on a Summary)

**Not reproduced (1 attempt).**

- After R18 the phone was left signed in on R18's Summary (capture 18:02:11).
- The Core expired OPR-001 at host 18:11:00.860 (socket closed 4401, then `GET /api/v1/auth/session 401`).
- At 18:12:17 and 18:13:14 the phone showed the **full Login** with the "Session expired ... Recording on the Core is not affected." dialog (`rfph4_repeat_00_phone_idle_on_summary_1802.png`, `rfph4_repeat_01_session_expired_dialog_full_login_1812.png`).

RF-PH-4 therefore stands as **observed once in 2 idle expiries**.

- The difference at 17:40 was that both operators expired together. The phone's first `getAuthSession` after the expiry timed out (8 s) at a host load of 4-5.
- The cause is unknown.

## 7. Slips and rule notes

- **One `uiautomator dump` while Login was showing** (17:41:18). The phone had been signed out by the idle expiry 28 s before, without the driver knowing; the batch had declared "devices". The dump output listed ids only (empty fields, no text). After that no dump was used; all coordinates came from captures.
- **One AUTH_FAILED on main** (AUD-000301, 17:31:32, OPR-001 from DEV-0020, `INVALID_CREDENTIALS`, `attemptsRemaining 4`).
  - The password was typed after moving focus with the Enter key from the username field (inputType was a password field).
  - The driver force-stopped the app before any capture.
  - The cause was not established. Hypothesis: characters lost while the IME switched fields; CF-M1 had the same at 15:38.
  - Every later sign-in tapped the password field first and succeeded (5 of 5).
- **No Hermes inspector use, no JS stalls.** No lock, PIN, fingerprint, settings, adb reverse, server, Vite, Metro, mock-core or emulator change. The biometric offer was answered "Not now" each time.
- Only phone2's own devices were revoked (DEV-0019 to DEV-0022). Nothing touched 4422/4423, 5177/5178, PostgreSQL or *:5432. No tracked file was modified.
- `screenrecord` hung once (R00) and was killed by the watchdog.
- **The lane-1 driver was ended by its 2 h background limit** at about 18:39.
  - A queued capture (`rfph4_repeat_03`) hung in `adb screencap` from 18:23 to 18:39, at a host load of **27.4** (not from this row's work; nothing of this row ran then). The capture failed.
  - The driver's browser was killed with it. Its leftover profile directory in `$TMPDIR` was removed at 20:35, and the leftover `/sdcard/rfph.png` was deleted.
  - The session then stalled until 20:35.
  - When the driver was restarted at 20:35, it executed the end-state batch that had been queued at 18:2x. Its tap (540, 1364) landed on the Login screen (the expiry dialog had already been dismissed by hand) and only opened the keyboard's floating toolbar, which is visible in `end_phone_login_signed_out_live.png`. Nothing was typed. Its web lines failed ("w1 not open"), and the lane-1 reads were repeated in a fresh batch.
- `rf_tools_fx_py_pts_fix.py.txt` is CF-M1's `fx.py` with one change: `ffprobe` pts values with a trailing comma (seen on the re-encoded H3) are parsed.

## 8. End state (checked 20:35-20:37)

| Item | State | Evidence |
|---|---|---|
| dems2_phone (emulator-5554) | LIVE, **Login, signed out** ("Your session expired ... Sign in again." banner after the dialog was dismissed), Core online, paired as DEV-0001; focused, no keyguard | `end_phone_login_signed_out_live.png` (20:35:52); `dumpsys window` 20:35 |
| dems2_phone2 (emulator-5558) | LIVE, **Login, signed out**, Core online, **paired as DEV-0023**, which is the newest device and the only Paired row on main | `end_phone2_login_signed_out_live_dev0023.png` (20:36:04); `pd-state-DEV-0023=Paired`, DEV-0022/0021 Revoked (20:36:17) |
| Recording | nothing: lane 1 current session SES-20261006-0077 **SEALED**; main current SES-20261006-0025 **SEALED** | `GET /api/v1/session/current` 20:36:38 (lane 1), 20:36:13 (main) |
| Roles | budi.santoso **INVESTIGATOR**, andi.pratama SUPERVISOR, rina.wijaya TECHNICIAN, on both lanes | `GET /api/v1/admin/users` 20:36:14 (main), 20:36:38 (lane 1) |
| Browsers and drivers | andi signed out on both webs (`sign-out 204`, 20:36:17 and 20:36:38). All headless shells and drivers ended; 0 processes left, 0 `rf-ph-*` profiles in `$TMPDIR`, no file of this row on either `/sdcard` | `ps`, `ls` at 20:36:40 |
| Devices revoked | only phone2's own: DEV-0019, DEV-0020, DEV-0021, DEV-0022 (audit AUD-000296, -305, -310, -317) | §5 |
| Secret scan | 244 text files (report, progress file, assets, driver queues, batch outputs): **0** occurrences of the demo password (count only, the constant read inside the scanner), **0** `ses_` / `dvc_` / `bio_` token shapes. Codes were never printed; the count-only scans after each redeem found 0 | `scan.mts` in the session scratchpad; §5.2 |

## 9. Screenshot index

| File | Caption |
|---|---|
| `rf_00_phone_relaunched_login_live_dev0001.png` | Phone after the forced relaunch: LIVE Login, Core online, paired as DEV-0001 (16:38) |
| `rf_01_phone2_relaunched_login_live_dev0019.png` | Phone2 after the forced relaunch: LIVE Login, Core online, paired as DEV-0019 (16:38) |
| `rp1_r01_bookmark_popover_on_monitor.png` | R01: Add Marker sheet over the monitor (16:47:29) |
| `rp1_handover_last_monitor_and_next_frame_16_runs.png` | Last monitor frame and next frame of the 16 recorded web stops; every next frame is Finalizing |
| `rp1_r10_after_finalizing_13s_after_web_stop.png` | R10: Finalizing 50 % 13 s after the web stop (Core sealed at +7.5 s) |
| `rfph1_timer_holds_while_feed_clock_runs.png` | RF-PH-1: timer held at 0 / 14 / 24 while the feed timestamp ran (R09, R10, R03, R13, R16); R18 at load 5 for contrast |
| `rfph2_stale_recording_monitor_after_early_web_stop.png` | RF-PH-2: R11 Starting..., empty frame, monitor of the stopped session; R08 stale monitor |
| `rfph2_r11_recording_monitor_32s_after_web_stop.png` | RF-PH-2: R11 still "Recording 00:00:00" at 17:07:50, 24 s after the Core sealed |
| `rfph3_empty_frames_at_route_changes.png` | RF-PH-3: empty frame between Ready and the monitor (R08) and between Evidence sealed and Summary (R02) |
| `rp3_01_devices_list.png` | R-P-3: Devices list |
| `rp3_02_device_detail_camera1_open.png` | R-P-3: Camera 1 detail open in the Devices tab |
| `rp3_03_more_tab.png` | R-P-3: More tab |
| `rp3_04_settings.png` | R-P-3: Settings, System section |
| `rp3_05_device_settings_opens_devices_list_clean.png` | R-P-3: Device Settings opens the Devices list at its root (no detail) |
| `rp3_06_one_back_returns_to_settings.png` | R-P-3: one Back returns to Settings |
| `sm_01_home.png` | Smoke: Home (LIVE) |
| `sm_02_sessions.png` | Smoke: Sessions hub |
| `sm_03_evidence_detail_ev0063.png` | Smoke: Evidence detail EV-20261006-0063 |
| `sm_03b_evidence_ev0063_hash_integrity_not_verified_yet.png` | Smoke: Hash & Integrity "Not verified yet" = Core NOT_RUN |
| `sm_03c_evidence_ev20261005_0014_hash_integrity_verified_by_core.png` | Smoke: Hash & Integrity "Verified by the Core", last verification PASS 00:20:19, AKP Budi Santoso = Core record |
| `sm_04_devices.png` | Smoke: Devices |
| `sm_05_settings.png` | Smoke: Settings |
| `rfph4_login_emblem_only_48s_after_idle_sign_out.png` | RF-PH-4: Login emblem only, 48 s after the idle sign-out (17:41:38) |
| `rfph4_login_emblem_only_3min_after_idle_sign_out.png` | RF-PH-4: unchanged at 17:44:01 |
| `rfph4_login_normal_after_relaunch.png` | RF-PH-4: full Login after the relaunch (17:44:43) |
| `rs1_s1_before_login_signed_out.png` | R-S-1 S1: phone2 on Login before the revoke |
| `rs1_s1_after_pair.png` | R-S-1 S1: Pair "Pairing revoked" after the revoke |
| `rs1_i1_before_summary_signed_in.png` | R-S-1 I1: phone2 signed in (Session Summary) before the revoke |
| `rs1_i1_after_pair.png` | R-S-1 I1: Pair after the signed-in revoke |
| `rs1_s2_after_pair.png` | R-S-1 S2: Pair after the revoke |
| `rs1_i2_after_pair.png` | R-S-1 I2: Pair after the revoke |
| `rs1_revoke_to_pair_frames_4_revokes.png` | R-S-1: last screen, first change and first Pair frame of the four revokes |
| `rs2_pairing_handoff_frames_4_handoffs.png` | R-S-2: first frame, first Login frame and last frame of the four hand-offs |
| `rs2_h1_after_login_dev0020.png` | R-S-2 H1: Login after the hand-off, paired as DEV-0020 |
| `rs2_h2_after_login_dev0021.png` | R-S-2 H2: Login, paired as DEV-0021 |
| `rs2_h3_after_login_dev0022.png` | R-S-2 H3: Login, paired as DEV-0022 |
| `rs2_h4_after_login_dev0023.png` | R-S-2 H4: Login, paired as DEV-0023 |
| `rfph4_repeat_00_phone_idle_on_summary_1802.png` | RF-PH-4 repeat: phone left signed in on R18's Summary (18:02) |
| `rfph4_repeat_01_session_expired_dialog_full_login_1812.png` | RF-PH-4 repeat: after the idle expiry, full Login with the "Session expired" dialog (18:12); not reproduced |
| `end_phone_login_signed_out_live.png` | End state: phone LIVE, Login, signed out (20:35) |
| `end_phone2_login_signed_out_live_dev0023.png` | End state: phone2 LIVE, Login, signed out, paired as DEV-0023 (20:36) |

Other assets:

| Kind | Files |
|---|---|
| Recordings | `rp1_r01_web_stop.mp4` ... `rp1_r18_web_stop.mp4`, `rp3_device_settings_one_back.mp4`, `rs1_*.mp4`, `rs2_*.mp4`, `rfph4_login_emblem_only_static_10s.mp4` |
| Data | `rp1_runs_summary.jsonl`, `rp1_frame_analysis.jsonl`, `rp1_empty_frames.jsonl`, `rp1_native_log_counts.jsonl`, `rp1_core_log_audit_per_run.txt`, `rs_phone2_batches_core_log_audit.txt`, `rs_revoke_and_handoff_frame_timings.txt`, `rfph2_rfph4_device_js_log_extracts.txt`, `rf_detector_positive_controls.txt` |
| Drivers and tools | `rf_driver_*.txt`, `rf_tools_*.txt` |
