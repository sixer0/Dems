---
row: E2E-W2
agent: verifier
date: 2026-10-06
status: needs-review
report: test/07b_e2e_web_roles_consoles.md
assets: test/assets/e2e/w2_roles/
---

# E2E-W2 progress (verifier)

## Status

**needs-review.** All walks, refusals and live checks ran; the artifacts exist. Review is needed for one known UI-vs-matrix defect (E2E-W2-1 = F63-1) and two incidents caused by this row (IN-1, IN-2), which the controller has to record. Nothing was fixed, no server was started or stopped, and no tracked file was modified.

## Result in one table

| Part | Result |
|---|---|
| A: routes × roles | 14/14 INVESTIGATOR, 14/14 TECHNICIAN, by navigation (9/9 entries) and by deep link (14/14) |
| A: matrix checks | INVESTIGATOR 61/62 (FAIL = E2E-W2-1); TECHNICIAN 62/62 (one driver expectation re-judged, report §4.2 note a) |
| A: allowed actions | INVESTIGATOR 10, incl. a full Live recording: start → note → stop → sealed EV-20261006-0014. TECHNICIAN 8, incl. the unintended IN-2 |
| A: refusals | 9/9 page-context calls → 403 `NOT_PERMITTED` + one `ACCESS_DENIED` row each (seq 109–112, 135–139), read back as SUPERVISOR; plus 2 UI export refusals → `EXPORT_DENIED` seq 105, 128 |
| B: two consoles live | 7/7 PASS, no reload. Core audit row → other console: start 101 ms, note 24, stop 351, counter (8→9) 266, archive 431, storage 24 / 35 |
| Origins / console / secrets | only `http://127.0.0.1:5173` + `ws://127.0.0.1:5173`; 0 exceptions, 0 console.error/warn; password and tokens in 0 of 166 files |

## INCIDENT IN-1, 09:42: devtools port collision with another row's browser (E2E-W1, lane 3)

| What | Detail |
|---|---|
| When | 09:41:54 another agent session (parent pid 44482, driver `node recorder.mjs` pid 63950) started `chrome-headless-shell` pid 63921 on `127.0.0.1:9431`. At 09:41:55 this row started its own headless shell (pid 63935) on the same port 9431, which could only bind `[::1]:9431` |
| Effect | This row's readiness probe and driver reached `http://127.0.0.1:9431`, which was the OTHER row's browser. Its page had been moved to `http://127.0.0.1:5178` (lane 3, E2E-W1's lane). This row's sign-in step typed the seeded INVESTIGATOR into that page |
| What reached lane 3 (`.cache/manual/lane3-server.log`, request lines) | 09:42:08.234 `GET /api/v1/auth/session 401`; 09:42:08.235 `GET /api/v1/auth/status 200`; 09:42:08.371 `GET /api/v1/health 200`; **09:42:09.636 `POST /api/v1/auth/sign-in 200`** (OPR-001 budi.santoso, INVESTIGATOR, on `dems_lane_3`); 09:42:13.220 `GET /api/v1/session/current 200`; 09:42:13.225 `GET /api/v1/network/status 200`; 09:42:13.228 `GET /api/v1/auth/session 200` (principal `operator:OPR-001`). Nothing else: no command and no change of state other than the sign-in |
| Consequence for E2E-W1 | That browser (pid 63921) then held an INVESTIGATOR web session on lane 3. If E2E-W1 had a session in that page at 09:42:09, rotation ended it (ID-6). Its screenshots or recording after 09:42:08 may show `AKP Budi Santoso` |
| What this row did | Stopped its own launcher and browser at once (pid 63934/63935; profile removed). Did NOT connect to pid 63921 again and did not sign the lane 3 session out (it is in the other row's browser; idle expiry about 09:57) |
| Fix in this row's driver | No fixed port: `--remote-debugging-port=0`, the endpoint read from the browser's own `DevTools listening on ws://…` line, the listener PID checked to be this browser's, and an origin guard that aborts any step whose page is not at 5173 |
| Lesson for other rows | Fixed devtools ports collide between parallel rows. Use port 0 and the browser's own endpoint line |

## INCIDENT IN-2, 10:06:06: Restart services pressed once on the main instance (unintended)

A leftover line at `w2_part_a.mjs.txt:392` (`clickSel('[data-testid="system-restart-services"]', 'scroll only')`) pressed nothing for INVESTIGATOR (button disabled) but pressed **Restart services** as TECHNICIAN: `POST /api/v1/system/services/restart 200 operator:OPR-003` (reqId `a0979f3f-a9f7-4f44-b134-4e181d5dfbc8`). The role is allowed (MAINTENANCE). The simulated effect is limited to the services' start time and one `DEVICE_COMMAND` audit row (`packages/shared/src/sim/maintenance.ts:251-275`). The Core log shows no socket drop and health answering normally afterwards. It is recorded because it was not intended on the shared instance during E2E-S.

## Defects for the controller

| ID | Severity | Summary |
|---|---|---|
| E2E-W2-1 | Low (known F63-1, D152 "console stays stricter") | The Dashboard device-tile menu disables Test signal for INVESTIGATOR (gate DEVICE_MANAGE, `features/dashboard/devices-panel.tsx:44`), but op 49 needs only DIAGNOSTICS_RUN. The Devices page offers it and the Core accepts it (204, 09:57:30.297) |

Observations, not defects: O-1, Export enabled on the Evidence pages for roles without EVIDENCE_EXPORT (by design D-6, the Core refuses and audits); O-2, an in-flight `POST /auth/touch` aborted by a full navigation is logged as `CORE_OFFLINE` at error level (Vite terminal, 10:14:51), although the Core answered 200.

## Decisions taken in this row (for decisions.md)

1. Restart services and Install update are not exercised on the shared main instance (allowed for TECHNICIAN, but disruptive during E2E-S). IN-2 broke this once by accident.
2. Refusal probes use only reads and harmless commands: never role, user, pairing, revoke, reset, scenario or fault operations.
3. The Live recording (Part A and Part B) ran only while the Core's tablet link was CONNECTED through E2E-S's paired phone, and each recording was kept under 30 s.
4. Part B's evidence review archived this row's own recording (EV-20261006-0015), not a seeded item. The storage policy was changed and restored.

## State left on `dems_demo`

Two sealed recordings (EV-20261006-0014, EV-20261006-0015), EV-20261006-0015 archived, audit rows of this row's verifies, device commands, refusals and IN-2. Auto-archive restored to Enabled. This row's own web sessions were all signed out, except the exploration session (expired idle 09:59:20) and the scratch trial session (closed without a sign-out, idle expiry about 10:08).

## Milestones

- 09:36 inputs read (D191, D194, RBAC matrix, registry, per-page docs, W86 driver)
- 09:37 health: 4420 `status ok`, 5173 HTTP 200
- 09:42 IN-1; driver fixed; 09:44 exploration on 5173
- 09:50–09:53 scratch trial walk (INVESTIGATOR)
- 09:55–10:00 INVESTIGATOR walk, refusals, Live recording, sign-out
- 10:00 load 23.98 → paused until 12.64 (10:02:30)
- 10:02–10:07 TECHNICIAN walk (IN-2 at 10:06:06), refusals, sign-out
- 10:08:24 E2E-S revoked its device; 10:12:13 re-paired (DEV-0002)
- 10:12–10:15 Part B two consoles, 7/7, audit read as SUPERVISOR, both signed out
- 10:16–10:18 below-the-fold supplement for both roles
- 10:25 report written; secret scan 0/166; temporary profiles and files removed

## Files created by this row

- `test/07b_e2e_web_roles_consoles.md`
- `delegation_progress/e2e_w2_roles.md` (this file)
- `test/assets/e2e/w2_roles/`: 138 PNG; 10 JSON (`w2_part_a_{investigator,technician}.json`, `w2_part_a2_refusals_{investigator,technician}.json`, `w2_part_a3_session_investigator.json`, `w2_part_a4_signout_{investigator,technician}.json`, `w2_part_a5_supplement_{investigator,technician}.json`, `w2_part_b_two_consoles.json`); 2 logs (`w2_driver.log`, `w2_core_request_lines.log`); 14 drivers `*.mjs.txt`
