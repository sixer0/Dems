---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: FXR-M device checklist (D243/D246; gateway_check/15c_fxr_mobile.md §4), run with W94-W96
date: 2026-10-07
agent: verifier
status: needs-review (7 of 9 checks PASS; 2 findings: FXR-DEV-1 Medium, FXR-DEV-2 Low)
narrative_tier: 2
evidence_folder: verification/assets/e2e_final/ (prefix fxr_, plus W95/W96 phone frames)
---

# FXR-M device checklist on phone (5554, DEV-0003) and tablet (5556, DEV-0004), one pass each

Window: 09:13 to 09:37 WIB. Both apps were relaunched with the current bundle (W94 §2) under `motion=off`, as
briefed. Clock-of-day readouts hold the minute at :00 under `motion=off` by design (D243, W93 R3), so only the
**recording-elapsed timers** were judged, not the header clocks. Recordings: SES-20261007-0028 (subject
"Retno Wulandari", 291 s) and SES-20261007-0029 ("Siti Rahmawati", 36 s), both started and stopped by the web
SUPERVISOR. Times are host time (device + 49.85 to 49.89 s).

## Checklist table

| # | Check (brief / 15c §4) | Phone 5554 | Tablet 5556 | Result | Evidence |
|---|---|---|---|---|---|
| 1 | Bottom Recording bar timer equals the monitor timer, no wrong digit (W93-1/3) | On Home, System Status = bottom bar in every frame (W95: 00:00:00-09 and 01-03; checklist: 00:00:14 = 14). At the Home→monitor hand-over the bar's last value 00:00:16 equals the monitor's first value 00:00:16. The monitor then rolls 16 → 19 after 0.45 s and never steps back | top Recording bar 00:01:57 = System Status 00:01:57; at the hand-over bar 00:02:00 = monitor 00:02:00 | PASS (equal, forward only). See O-1 for lag | `fxr_phone_bar_vs_monitor_frames.png`, `fxr_phone_home_to_monitor.mp4`, `w95_r1_phone_web_start_frames.png`, `fxr_tablet_bar_vs_monitor_frames.png`, `fxr_tablet_home_recording_bar_vs_status.png`, `fxr_tablet_home_to_monitor.mp4` |
| 2 | Audit rows and Devices rows stay drawn when the selection changes (W93-2/4) | Audit: opened #200 and #199 and came back; every row drawn. Devices: opened Camera 1 and MIC 1 and came back; every row drawn | Audit: selected #162 then #161, scrolled, selected #153, scrolled back. The previous row's border clears and no card empties. Devices: Camera 1 → MIC 1 → PoE Switch → Camera 2, every row drawn | PASS | `fxr_phone_audit_0..3*.png`, `fxr_phone_devices_0..3*.png`, `fxr_tablet_audit_0..4*.png`, `fxr_tablet_devices_0..4*.png` |
| 3 | No empty frame before Summary after a web stop (W93-6) | W95 run 1: monitor → Finalizing (+1.46 s) → Summary, per-frame spread never below 26. Run 2: +1.06 s, the same | Stop 2 (SES-0029, load 6.4): last monitor at host 09:34:04.525 → Finalizing 04.694 (+2.28 s) → Summary 12.361, no empty frame (minimum spread 16.6, on the darker Finalizing frames). Stop 1 (SES-0028): **not observable, see FXR-DEV-1** | PASS (phone; tablet stop 2) | `w95_r1_phone_web_stop_frames.png`, `w95_r2_phone_web_stop_frames.png`, `*_frame_signatures.txt`, `fxr_tablet_web_stop2_frames.png`, `fxr_tablet_web_stop2.mp4`, `fxr_tablet_web_stop2_frame_signatures.txt` |
| 4a | Stepper draws correctly in the wizard; the Summary lifecycle stepper is complete (W93-7) | wizard: horizontal stepper on steps 1, 2 and 3 (ring on the current step, checks on the done ones, connectors filled). Summary stepper: not captured on the phone (Finalizing frames show the pipeline completing step by step, `w95_r2_phone_web_stop_frames.png`) | wizard: vertical stepper (1 Session Info current, 2, 3). Summary SES-0029: six steps checked with full connectors | PASS (phone Summary stepper not captured) | `w95_r1_phone_wizard_step1_empty.png`, `…_step1_filled.png`, `…_step2_gate.png`, `…_step3_ready.png`, `fxr_tablet_wizard_step1_stepper.png`, `fxr_tablet_summary_sealed_after_stop2.png` |
| 4b | 15c §4 item 4: no "Unable to find SurfaceMountingManager" burst at the hand-over (W93-7) | **104 lines** in the web stop of SES-0028 (phone on the monitor) | **104 lines** in the web stop of SES-0029 (tablet on the monitor); 0 in the stop of SES-0028, when the tablet's state arrived 21 s late | **FAIL (FXR-DEV-2)** | `fxr_logcat_surface_mounting_manager.txt` |
| 5 | Tablet Sessions detail wraps names between words (W93-8) | — | "Retno Wulandari" and "Siti Rahmawati" (the 15c names, used as subjects of SES-0028/0029 because the rebuilt seed has neither), plus "Dewi Anggraini" and the four-word "W95 Phone Start R2". All on one line with the chip under the name, **no mid-word break** (at this width none needed to wrap) | PASS | `fxr_tablet_sessions_detail_retno_wulandari.png`, `fxr_tablet_sessions_detail_siti_rahmawati.png`, `fxr_tablet_sessions_detail_dewi.png`, `fxr_tablet_sessions_detail_0027.png` |
| 6 | 'Sealed' chip readable (W93-9) | Summary chip "SEALED" readable | Sessions detail: purple "Sealed" text on an opaque dark backplate over the photo, clearly readable (zoomed crop checked) | PASS | `w95_r1_phone_after_stop.png`, `fxr_tablet_sessions_detail_dewi.png` |
| 7 | While the role is unknown: "Checking your permissions..." (if observable) (W93-11) | not observed | not observed: the first Home frame after the tablet sign-in (device 09:15:52.903, after an empty frame at 52.686 and a sidebar-only frame at 52.889) already shows the final TECHNICIAN state | not observable (allowed by the brief) | `fxr_tablet_sign_in_to_home_frames.png`, `fxr_tablet_sign_in_to_home.mp4` |
| 8 | A TECHNICIAN sees Start Session locked (W93-11) | locked + "Requires the Investigator role" within 0.55-0.60 s of the role change (W96) | after sign-in as TECHNICIAN: Start Session dimmed + "Requires the Investigator role"; it unlocked live on the change back | PASS | `w96_r1_phone_to_tech_frames.png`, `w96_r2_phone_to_tech_frames.png`, `fxr_tablet_home_technician_locked.png`, `w96_r1_tablet_after_back.png` |

## Findings

### FXR-DEV-1 (Medium): the tablet learned of a web stop 21.2 s late and kept showing "Recording"

- **Observed** (SES-20261007-0028; web `stop 202` at 09:30:25.739; tablet on the monitor):
  - the 20 s recording shows the tablet monitor still on "Recording", counting up to 00:05:07 at host 09:30:44.88;
  - before the stop, its timer already lagged (00:04:39 when the true elapsed time was 4:50).
- The app's own W93-28 diagnostics (`runtime.diag.sessionWindow`, `fxr_tablet_session_window_diag_ses0028.json`):
  - RECORDING → STOPPING at host ~09:30:46.9 (**+21.2 s**);
  - FINALIZING 1.3 s later;
  - SEALED at host ~09:30:55.2 (the Core sealed at 09:30:31.799, AUD-000190);
  - `deltasDropped: 0`, `deltasStale: 0`, `resyncs: 0`, `reconnects: 0`, `link: ONLINE`;
  - JS event-loop lag over the recording: `lagMaxMs` 4,463, 28 samples over 1 s.
- **Context:** host load 13.9 at the stop, after a peak of 17.23 at 09:28. On the next stop at load 6.4 the tablet
  followed in 2.28 s.
- **Reading (hypothesis, not verified):** no delta was dropped and the link never broke, so the delay sits between
  the socket and the store (a backlog on a JS thread starved under host load in the debug build) rather than in the
  Core. This is the RF2-2 / W93-28 family (D243: 7.7 / 12.4 s late), here larger. The records answer the question
  W93-28 was added for, so they are passed to W98 (release build, normal load).

### FXR-DEV-2 (Low): the Reanimated "Unable to find SurfaceMountingManager" burst at the Finalizing hand-over still occurs

- **Observed:** 104 `W/Reanimated … RetryableMountingLayerException: Unable to find SurfaceMountingManager for
  tag` lines per web stop, on the phone (SES-0028) and on the tablet (SES-0029). They come in seven tag groups of
  5, 7, 9, 11, 13, 15 and 44 lines: one per finalize pipeline step, then the Summary. No visible artifact: the
  pipeline draws full connectors and checks, and there is no empty frame.
- **Expected** (15c §4 item 4, after W93-7 "Stepper rest values in React"): no burst. The visual part (4a) passes;
  the logcat part does not.
- 0 credential or token shapes in these lines.

## Observations

- O-1: under host load the recording-elapsed readouts lag the true elapsed time and catch up by rolling forward:
  phone ~2.8 s at a Home→monitor hand-over (16 shown at 18.8 s, then 19 after 0.45 s), and tablet ~3 s (load 15)
  and ~11 s (load ~14, FXR-DEV-1). The two readouts always agree with each other and never step back. This is the
  D236 residual routed to W98 (release build).
- O-2: there is one fully empty frame (~200 ms) between Login and Home on the tablet after sign-in (device
  09:15:52.686), and a 13 ms frame with only the bottom bar between Home and the monitor on the phone. Same family as
  W93-10 (dark Login→Pair frame). Not in this checklist.
- O-3 (not established as a defect): the tablet Home mic tiles show "No signal" with a READY chip, also during a
  recording, while the monitor and wizard meters move.
- O-4: the tablet Sessions search placeholder "Search session ID, …" wraps to a clipped second line (cosmetic).

## Deviations

- D-1: one extra short recording (SES-0029, 36 s) completed the tablet half of check 3 after FXR-DEV-1 made stop 1
  unobservable. This is a single completing pass, not a loop (D232/D233).
- D-2: the 15c names "Retno Wulandari" and "Siti Rahmawati" do not exist in the W90 seed, so they were used as the
  subject names of the two checklist sessions.
- D-3: the load rose to 15.32 / 17.23 at 09:27-09:28. The tablet Home→monitor capture started at 15.32 (the check
  ran in the same command); actions then paused for about 2.5 min until the load was 12.57.
- D-4: the brief's checks were judged under `motion=off`. A Hermes-inspector stall (15c item 1) was not injected
  because it was not briefed. Item 8 (release build, W98) is out of scope.

---
*Generated: 2026-10-07 09:58*
*Last Updated: 2026-10-07 09:58*
