---
row: R-T (re-test, tablet) after E-fix
agent: verifier
date: 2026-10-06
status: complete
report: test/08c_retest_tablet.md
assets: test/assets/retest/t_tablet/
---

# R-T progress

| Time (WIB) | Milestone |
|---|---|
| 12:39 | Inputs read: D196, D200-D208; 07d (round 1); 11a §1/§3/§5, 11c §5/§6, 11d §2-§4 and FX-M2b; round-1 drivers. Load 4.93. |
| 12:39 | Read-only checks: emulator-5556 online, focus `com.dems.demo.tablet/.MainActivity`, `isKeyguardShowing=false`; reverse `tcp:8081 -> 8081`, `tcp:4420 -> 4422`; Core 4422 health ok (uptime 1,657 s), web 5177 `/` 200. |
| 12:44 | Drivers adapted into `$TMPDIR/rt_t/` (tablet driver + verbs forcestop, clock, rec, jswarn, top; web driver unchanged apart from its header; corelog; qsend). |
| 12:43 | App force-stopped and relaunched at `login?core=LIVE&motion=off` (Metro `Android Bundled` line, `Live source ready` 12:43:16). Login: Core online, paired DEV-0001. |
| 12:43-12:44 | budi.santoso signed in (`POST /auth/sign-in 200` 12:43:53), biometric offer Not now. Headless shell launched (OS-assigned CDP port, pid ownership checked); andi.pratama signed in on 5177 (12:45:04). |
| 12:45-12:48 | Journey: SES-20261006-0027 created/prechecked/started on the tablet; web note -> tablet "Supervisor Note Added"; web drawer "Supervisor note"; web stop 12:47:58.344; tablet screenrecord (`--bugreport`) shows Live -> Finalizing card with no frame between (device 12:47:59.112 -> 59.304); Core sealed 12:48:05.477 -> tablet "Evidence sealed" device 12:48:06.223 (= host 12:48:06.566, +1.09 s). |
| 12:50-12:52 | EV-20261006-0017: tablet Metadata tab shows CORE RECORD; custody on tablet + web: started AKP Budi Santoso, stopped AKP Andi Pratama = audit #193 OPR-001 / #209 OPR-002. |
| 12:52-12:55 | E2E-T-2 / E2E-P-1: 5 of 5 cycles (Evidence detail -> More -> tap outside -> rail Devices): Devices visible with data at 1.5 s, rail indicator on Devices each time. Note: the probe launch for the note latency failed (wrong temp path); first tablet capture 9.0 s after the Core note line (bound, not a latency). |
| 12:55-12:59 | O-2: Install update disabled + "Requires the Technician role" (`enabled="false"`). budi signed out; rina.wijaya (TECHNICIAN): Home Start Session disabled + "Requires the Investigator role" (tap opens nothing), Sessions hub Start disabled (`enabled="false"`), deep link `/session/new` -> Home + toast; no `POST /session`. rina signed out. |
| 12:59-13:00 | Web signed out (sign-out 204, session 401); headless shell pid stopped, profile removed. |
| 13:00-13:10 | Part 2 smoke walk as budi: 26/26 screens captured (Login .. sign out -> Login). |
| 13:10-13:12 | JS log: 0 E lines, 1 W line (Reanimated override at launch), 0 CORE_OFFLINE; Core log window 57 lines; end state verified (LIVE, signed out, Login; reverse rules unchanged; keyguard false; nothing recording). Load 4.17-8.44 throughout, no pause. |
| 13:13-13:25 | Before/after comparison captures C1-C7; report `test/08c_retest_tablet.md` written. |

## Result

complete. Targeted 12/12 PASS + seal-delay measurement (1.09 s, was 4.2-4.7 s; ~0.9 s behind the web -> W98); "Continue setup" variant not run (would need a setup session left on lane 2). Smoke 26/26. F80 toast 0. 4 new Low defects R-T-1..4 (all also visible in round-1 captures). Web observation O-RT-1 (Media tab "Its record comes from the simulator." in LIVE) for R-W.

## Deviations / incidents

- D-RT-1: background note probe did not start (`$TMPDIR` differs outside the sandbox); note latency not measured (bound <= 9.0 s).
- D-RT-2: TECHNICIAN deep link to `/session/new` (read-only guard check); two raw `uiautomator` dumps outside the driver (System Maintenance, Sessions hub) for the `enabled` attribute.
- IN-RT-1: a read-only grep of `packages/shared/src/sim/dataset.ts` for the export names printed the password-constant line into this agent's tool output once (~12:41). No file written; artifact scan below.

## Files created

- `test/08c_retest_tablet.md`
- `delegation_progress/retest_t_tablet.md`
- `test/assets/retest/t_tablet/` (top-level PNG captures, `rec/`, `q/`, `wq/`, `misc/`, `drivers/`, `core_log_lane2_window.txt`, `jslog_tablet_full.txt`, `jserr_tablet_full.txt`, `jswarn_tablet_full.txt`)

## Secret scan

13:26:27, count-only (`test/assets/retest/t_tablet/drivers/scan.mts.txt`): 160 text files; password exact 0; password loose 0; token shapes 0; 40 3+3-digit shapes, all tap or swipe coordinates in `q/*.cmd` (no pairing code in this row).
