---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W95
date: 2026-10-07
agent: verifier
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W95, line 775)
status: PASS (short confirmation under D232/D233: 1 run + 1 verification run)
narrative_tier: 2
evidence_folder: verification/assets/e2e_final/ (prefix w95_, net_ctx_a)
---

# W95: SC3 shared state, web console and phone, on the rebuilt main instance (short confirmation)

Window: 2026-10-07 09:00 to 09:13 WIB. The phone (emulator-5554, `dems2_phone`) was paired fresh as **DEV-0003**
(see W94 §4) and signed in as budi.santoso (INVESTIGATOR) at 09:00:09 (AUD-000102, device DEV-0003). On the
biometric offer it got "Not now" (D231). The web was andi.pratama (SUPERVISOR) in context a (own headless shell,
raw CDP, OS-assigned port, ownership-checked, origin `http://127.0.0.1:5173` only). The prior depth is in
`test/07c_e2e_phone_lane1.md` Part B.

## Method (how each delay was measured)

- **Web to phone:** a 540 px `screenrecord --bugreport` on the phone around the web click. The device time is read
  from the overlay of the first frame that shows the change, and host = device + 49.86 s. The device-host offset
  was measured by a bracketed `date` read in the same command (45-55 ms brackets). The start of each interval is
  the server's own log time of `start 200` / `stop 202`.
- **Phone to web:** a background CDP watcher on the open page, which never navigates. Every 50 ms it evaluates the
  monitor's `data-session-state`, or the Dashboard's `session-recording` panel, and stamps each change with the host
  clock. Delays are therefore upper bounds of about 50 ms.
- Load during W95: 4.7 to 8.3 (limit 14).

## Evidence table

| Run | Step | Pass condition | Server time | Other client sees it | Delay | Result | Captures | Audit rows |
|---|---|---|---|---|---|---|---|---|
| 1 | web wizard creates and starts SES-20261007-0024; phone on Home | appears on the phone within 2 s | `start 200` 09:01:58.189 | phone frame device 09:01:09.254 = host 09:01:59.118 (Home turns "Session in progress"), "Recording SES-20261007-0024" drawn at +943 ms | **0.93 s** | PASS | `w95_r1_web_step1_filled.png`, `w95_r1_web_step2_gate.png`, `w95_r1_web_step3_ready.png`, `w95_r1_phone_web_start_frames.png`, `w95_r1_phone_web_start.mp4`, `w95_r1_web_after_start.png` | AUD-000103 `SESSION_CREATED` OPR-002 09:01:07.153; AUD-000105 `RECORDING_STARTED` OPR-002 09:01:58.184 |
| 1 | phone: monitor › End Session, reason, confirm | the web shows it stopped | `stop 202` 09:03:55.595 (principal OPR-001) | web Session Monitor `STOPPING` + finalization modal at 09:03:55.604; `SEALED` "Evidence EV-20261007-0014 sealed" at 09:04:03.297 | **+9 ms** | PASS | `w95_r1_phone_monitor.png`, `w95_r1_phone_end_dialog_reason.png`, `w95_r1_web_after_phone_stop_sealed.png`, `w95_r1_phone_after_stop.png` | AUD-000124 `RECORDING_STOPPED` OPR-001 09:03:55.592 `{"reason":"W95 stop on phone R1","durationMs":117408}`; AUD-000125 `EVIDENCE_SEALED` |
| 1 | reverse: phone wizard creates and starts SES-20261007-0025; web on Dashboard | the web shows it within 2 s | `start 200` 09:06:16.701 | Dashboard `session-recording` panel "REC 00:00:00" at 09:06:16.733 | **+32 ms** | PASS | `w95_r1_phone_wizard_step1_filled.png`, `…_step2_gate.png`, `…_step3_ready.png`, `w95_r1_phone_start.mp4`, `w95_r1_web_dashboard_recording.png` | AUD-000127 `SESSION_CREATED` OPR-001 09:05:24.631; AUD-000129 `RECORDING_STARTED` OPR-001 09:06:16.696 |
| 1 | web Session Monitor: hold End Session 1.8 s, reason, confirm; phone on the monitor | the phone shows it stopped | `stop 202` 09:06:56.355 | phone: last monitor frame device 09:06:07.667, "Finalizing evidence" at device 07.954 = host 09:06:57.818, Summary SEALED at host 09:07:03.78, no empty frame (per-frame spread never below 26) | **1.46 s** | PASS | `w95_r1_web_end_dialog.png`, `w95_r1_phone_web_stop_frames.png`, `w95_r1_phone_web_stop.mp4`, `w95_r1_phone_web_stop_frame_signatures.txt`, `w95_r1_web_after_web_stop.png` | AUD-000132 `RECORDING_STOPPED` OPR-002 09:06:56.349 `{"reason":"W95 stop on web R1"}`; AUD-000133 `EVIDENCE_SEALED` |
| 2 | web starts SES-20261007-0026 | within 2 s | `start 200` 09:09:15.330 | phone frame host 09:09:16.091 | **0.76 s** | PASS | `w95_r2_phone_web_start_frames.png`, `w95_r2_phone_web_start.mp4`, `w95_r2_web_after_start.png` | AUD-000135 `SESSION_CREATED` OPR-002; AUD-000137 `RECORDING_STARTED` OPR-002 09:09:15.326 |
| 2 | phone stops it | web shows it | `stop 202` 09:10:02.239 | web `STOPPING` 09:10:02.241, `SEALED` 09:10:09.410 | **+2 ms** | PASS | `w95_r2_phone_end_dialog_reason.png`, `w95_r2_web_after_phone_stop_sealed.png`, `w95_r2_phone_after_stop.png` | AUD-000143 `RECORDING_STOPPED` OPR-001 09:10:02.231 `{"reason":"W95 stop phone R2"}` (ENV-3: adb dropped the word "on"); AUD-000144 `EVIDENCE_SEALED` |
| 2 | phone starts SES-20261007-0027 | web within 2 s | `start 200` 09:11:26.550 | Dashboard panel "SES-20261007-0027 REC 00:00:00" at 09:11:26.585 | **+35 ms** | PASS | `w95_r2_phone_wizard_step1_filled.png`, `…_step2_gate.png`, `…_step3_ready.png`, `w95_r2_web_dashboard_recording.png` | AUD-000146 `SESSION_CREATED` OPR-001; AUD-000148 `RECORDING_STARTED` OPR-001 09:11:26.544 |
| 2 | web stops it, phone on the monitor | phone shows it | `stop 202` 09:11:53.269 | phone Finalizing at host 09:11:54.332, Summary at host 09:12:01.21, no empty frame | **1.06 s** | PASS | `w95_r2_web_end_dialog.png`, `w95_r2_phone_web_stop_frames.png`, `w95_r2_phone_web_stop.mp4`, `w95_r2_phone_web_stop_frame_signatures.txt` | AUD-000152 `RECORDING_STOPPED` OPR-002 09:11:53.265 `{"reason":"W95 stop on web R2"}`; AUD-000153 `EVIDENCE_SEALED` |
| all | browser network log | requests to the page origin only | — | Continuous log of context a from 09:08:26 to 09:39:44 (all of run 2, W96 and the end): **3,387 requests to `http://127.0.0.1:5173` and 17 sockets to `ws://127.0.0.1:5173`, no other origin**. Every API answer in the window is listed by method, path and status. Run 1 predates the continuous log. Its per-script records (sign-in, Paired Devices) show `http://127.0.0.1:5173` only | — | PASS (run 1: partial, see D-2) | `net_ctx_a.json`, `net_ctx_a.log` | — |

All 16 rows (`SESSION_CREATED`, `RECORDING_STARTED`, `RECORDING_STOPPED`, `EVIDENCE_SEALED` for SES-0024 to SES-0027)
are in `w95_audit_rows.json` / `.log`.

## Observations (not W95 failures)

- O-1: on every phone frame the Home System Status timer equals the bottom Recording bar (00:00:00 to 00:00:09 in
  `w95_r1_phone_web_start_frames.png`, 00:00:01 to 03 in run 2). This is FXR-M evidence and is used in the checklist.
- O-2: the session-command audit rows written by the phone carry `deviceId: null`. Sign-in rows name the device
  (AUD-000102 DEV-0003). W95 does not ask for the device; recorded for W99/W101 only, not established as a defect.
- O-3: in run 1 the phone's first changed frame shows the System Status card mid-redraw (a red dot only) for 14 ms
  before the full "Session in progress" card (`f_0003` vs `f_0004` in the sheet). This is cosmetic, and the same
  happens in run 2.

## Deviations

- D-1: the web wizard was driven through its own controls by CDP (`drv_web.mjs.txt`: real mouse events at element
  centres, `Input.insertText` into fields, a 1.8 s mouse hold on End Session). The phone wizard was driven by taps
  at UI-dump coordinates (the wizard screens) or screencap coordinates (Home, monitor, dialog).
- D-2: the continuous network log started at 09:08:26, after run 1. So the "origin only" condition is proven
  continuously for run 2 (the verification run) and partially for run 1.
- D-3: the back key once opened the wizard's "Discard this session?" dialog (the keyboard was already closed). It was
  answered "Keep editing" and nothing was discarded (`w95_r1_phone_wizard_step1_filled.png`).

---
*Generated: 2026-10-07 09:52*
*Last Updated: 2026-10-07 09:52*
