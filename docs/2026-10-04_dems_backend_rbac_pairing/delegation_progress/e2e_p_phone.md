# E2E-P — phone `dems2_phone` (emulator-5554) + lane 1 (4421, web 5176)

| Field | Value |
|---|---|
| Agent | verifier |
| Status | complete |
| Window | 2026-10-06 09:37 – 10:59 (+07:00) |
| Report | `test/07c_e2e_phone_lane1.md` |
| Assets | `test/assets/e2e/p_phone/` (177 PNG, 8 MP4, `q/` 92 batches + `events.log`, `core_log_lane1_e2e_p.log`, `w1_network.log`, `w2_network.log`, `driver_console.log`, drivers `e2e_q.mts.txt`, `send.mjs.txt`, `raw2png.py.txt`, `scan.mts.txt`) |
| Verdict | PASS with 5 low-severity defects; no server-backed value differed from the Core |

## Milestones

- Part A: 27 / 27 mobile screens reached in LIVE as budi.santoso (INVESTIGATOR), each cross-checked against a Core API value; Recovery shown in its "not interrupted" state only (FAULT phase needs a server restart or fault injection, forbidden); the phone has no note action, its labelled marker was used (`MARKER_ADDED` #277).
- Part B (SC3): web start -> phone 0.81 s (screen recording; the first screencap-bracketed run was inconclusive at 1.09–2.70 s); phone stop -> web 84 ms and 68 ms; phone start -> web 52 ms; web stop -> phone 1.36 s (Finalizing at 2.54 s); browser origins only `http://127.0.0.1:5176` / `ws://127.0.0.1:5176`. Audit rows #359/#361/#388, #391/#393/#399, #402/#404/#410 quoted.
- Part C (SC4): INVESTIGATOR -> TECHNICIAN: w2 88 ms, phone toast 0.51 s, control 0.67 s (repeat 0.64 / 0.77 s); 403 `NOT_PERMITTED` + `ACCESS_DENIED` #415 (web) and #416 (phone, DEV-0001); `ROLE_CHANGED` #414 and #417 quoted; back to INVESTIGATOR: controls returned (phone 1.25 s in the first sample, 0.56 s in the repeat).
- End state: phone LIVE, signed out, on Login (Core online, paired as DEV-0001); budi.santoso INVESTIGATOR; last session SES-20261006-0034 SEALED and acknowledged; browsers closed, profiles removed, `/sdcard` clean, adb reverse rules unchanged.

## Defects for the controller

| ID | Severity | Summary |
|---|---|---|
| E2E-P-1 | Low | Bottom navigation: after switching to Evidence from inside the Sessions stack, the pill and gold icon stay on Sessions; the Sessions icon stays gold on later tabs |
| E2E-P-2 | Low | Stack Check copy says "wired to the local mock-core" while Live against core-server v0.2.0 |
| E2E-P-3 | Low | Home while recording: System Status timer and the bottom Recording bar differ by 1 s in the same frame |
| E2E-P-4 | Low | Stop from the web: the phone shows ~1.2 s of empty screen before Finalizing (a local stop shows it at once) |
| E2E-P-5 | Low, needs-review | Phone Start Session is not role-gated for TECHNICIAN (web locks it); the Core refuses with 403 and the app explains it |

## Blockers

None.

## Decisions / deviations to record

- PD-1: one `uiautomator dump` ran while the Login screen was showing (batch 084, 10:45:03, after sign-out; stale screen declaration in the driver's guard). It completed; no device change.
- PD-2: added `screenrecord --bugreport` clips (capture only, `/sdcard` cleaned) for sub-second phone timings, and one extra re-test session SES-20261006-0034 to triage ENV-2.
- ENV-1: load 24.6 at 09:52 -> paused to 11.9 (load guard).
- ENV-2: 10:12–10:15 phone UI lag (~30 s), one `auth/touch` timed out (never reached the Core), "Core Offline", self-recovered; coincided with raw 10 MB screencaps and load 11–24; driver switched to on-device PNG. The back-guard "Go to Home" anomaly in that window did not reproduce at load 4.9.
- O-1: SC4 change-back phone control 1.25 s once (> 1 s target), 0.56 s on repeat; the required change passed twice (0.67 s, 0.77 s).
- Pending for the user: biometric enrolment and sign-in — the touch point is the "Enable biometric sign-in on this tablet?" offer after a password sign-in (tap Enable, then touch the sensor at the system prompt); report §8.
- No tracked file was modified; `masterplan/02_plan.md` was not updated (writes limited by the brief to the report, the assets folder and this file).
- Secret scan: 194 text files (assets + report): password 0, token shapes 0.
