---
row: R-W (re-test, web) after E-fix
agent: verifier
date: 2026-10-06
status: needs-review
report: test/08a_retest_web.md
assets: test/assets/retest/w_web/
---

# R-W progress

| Time (WIB) | Milestone |
|---|---|
| 12:19 | Inputs read: D197, D198, D201, D202, D204, D207; 11a, 11b (+FX-W2); 07a; drivers 11b_driver_*.mjs.txt and w1_*.mjs.txt. Load 4.44. |
| 12:22 | Lane 3 reachable outside the sandbox: Core 4423 health ok (uptime 641 s, boot 12:12:07 WIB, ws clients 0); web 5178 /login 200. |
| 12:26 | E2E-W1-2 SUPERVISOR: Test signal enabled, pressed once, 204 + audit 123 DEVICE_COMMAND OPR-002; Restart disabled "Requires the Technician role". E2E-W1-5/-6 measured at 1440x900 and 390x844. |
| 12:28 | E2E-W2-1 INVESTIGATOR: same, 204 + audit 126 DEVICE_COMMAND OPR-001. |
| 12:30 | E2E-W1-3 PASS (stored PASS on open and after reload; Verify moved the line to 12:30:11; audit 129). E2E-W1-7 PASS. E2E-W1-4 Live PASS. |
| 12:31-12:34 | E2E-W1-4 Simulated BLOCKED: Sign In disabled, "Core service unreachable at 127.0.0.1:4400" (no mock-core on lane 3; README says Simulated Sign In needs it). Switched back to Live via the Login selector (stored LIVE). |
| 12:33 | IN-RW-1: README grep printed the README's published Simulated pairing code into my tool output once; nothing written to files. |
| 12:36 | Demo Recording scenario loaded (epoch 28); note drawer "Supervisor note", timeline "Supervisor Note Added"; ended the session as SUPERVISOR; custody RECORDING_STOPPED = AKP Andi Pratama = audit 222 OPR-002. |
| 12:39-12:40 | Part 2 smoke walk: 16/16 pages PASS, 0 console errors/warnings/exceptions, origin 127.0.0.1:5178 only; Try it health 200. |
| 12:42 | R-W-1 probe (custody table overflow at 1440x900: 31 px; 16 px with the pre-fix CSS). |
| 12:44 | Cleanup verified: 0 headless processes, 0 profiles. Core log 05:25Z+: 0 warn lines. |
| 12:48 | Report written: test/08a_retest_web.md. |
| 12:50 | Controller: mock-core started on 127.0.0.1:4400 (log .cache/manual/mock-core.log); asked for the Simulated half of E2E-W1-4. |
| 12:51 | Re-run (`r1_simulated_mockcore`, CDP port 55210, load 9.15): Simulated Sign In still disabled. mock-core refused all 5 heartbeat upgrades from origin http://127.0.0.1:5178 with 403 "ws origin rejected" (allowlist 127.0.0.1:5173, localhost:5173, own origins: packages/shared/src/api/constants.ts:27-29, apps/mock-core/src/heartbeat.ts:20,62-66). Switched back to Live (stored LIVE, CORE LINK Online). E2E-W1-4 Simulated stays BLOCKED (environment). mock-core left running. |
| 12:58 | Report updated (E2E-W1-4 Simulated row, summary, O-RW-1, O-RW-6, IN-RW-1 confirmation, state, screenshot index: 65 files). |
| 13:00 | Controller ruling (a): http://127.0.0.1:5173 granted for the one Simulated check (R-S row uses 5173 Live in its own browser: not touched). |
| 12:58:30-12:58:56 | `r4_simulated_main_attempt1` (CDP port 58352): Simulated Sign In enabled on 5173 (CORE LINK Online); stopped at opening item 0012 (a wide-screen row press only selects the preview card). Simulator session only; profile removed. |
| 12:59:33-13:00:08 | `r4_simulated_main` (CDP port 58754): Simulated sign-in andi.pratama -> Evidence -> EV-20261006-0012 (preview Open) -> Metadata `data-package="demo"`, NO 'another record' notice, 13 manifest fields + package tree -> one Hash & Integrity capture -> sign out -> selector back to Live (stored LIVE). E2E-W1-4 Simulated: PASS. No Core 4420 contact: /api/ (5) failed in-browser (inspector), /ws (7) refused by the guard; main Core log window 0 `auth/` lines; mock-core 0 rejections from 5173. |
| 13:04 | Report updated (summary 10/10 PASS, environment, run table, Simulated row, resolution, O-RW-6, state, index: 70 files, file list). |

## Result

- Targeted re-tests: 10/10 PASS. E2E-W1-4 Simulated passed on the main console 5173 (ruling (a)), because on lane 3 it was blocked: first no mock-core, then mock-core rejecting origin 5178 with 403 (O-RW-6).
- Smoke pages: 16/16 PASS. No regression.
- New defect: R-W-1 (Low), custody table overflow with a multi-word Detail at <=1440 px (pre-existing; +15 px from E2E-W1-7's nowrap date token).
- Incident: IN-RW-1 (tool output only). Confirmed from the transcript, without re-running the grep: it printed only README's published Simulated-mode demo pairing code (no password, PIN, Live code or token). No later step greps README.
- E2E-W1-4 Simulated: resolved by ruling (a) (see 13:00 rows). Open question for the controller: Simulated mode on lane consoles (O-RW-6).

## Final secret scan

See the line appended below by the final scan.
- 12:49 WIB final count-only scan (106 files incl. this file and 08a_retest_web.md; 60 PNG byte-scanned): {"files":106,"png":60,"password":0,"simCode":0,"tokens":0,"six":0,"threeThree":0}
- 12:59 WIB final count-only scan after the 12:51 re-run (117 files incl. this file and 08a_retest_web.md; 65 PNG byte-scanned): {"files":117,"png":65,"password":0,"simCode":0,"tokens":0,"six":0,"threeThree":0}
- 13:05 WIB final count-only scan after the 5173 Simulated check (133 files incl. this file and 08a_retest_web.md; 70 PNG byte-scanned): {"files":133,"png":70,"password":0,"simCode":0,"tokens":0,"six":0,"threeThree":0}
