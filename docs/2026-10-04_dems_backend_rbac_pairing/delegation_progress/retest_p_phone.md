---
row: R-P (re-test, phone emulator-5554 + lane 1) after E-fix
agent: verifier
date: 2026-10-06
status: needs-review
---

# R-P progress

| Time (WIB) | Milestone |
|---|---|
| 12:38 | Inputs read: D196, D199-D208; 07c (round 1); 11a §1/§5, 11c §1/§2/§6/§11, 11d §1-2 and FX-M2b; round-1 driver `e2e_q.mts.txt`, `send.mjs.txt`, batches q/059-073, 091. Load 3.42. |
| 12:41 | Environment read (outside the sandbox): emulator-5554 online, keyguard false, DEMS focused; reverse `tcp:8081->8081`, `tcp:4420->4421` (unchanged); lane 1 health ok 0.2.0 (uptime 1767 s, ws clients 1); web 5176 /login 200. Parallel R-W uses lane 3 (4423/5178), not lane 1. |
| 12:44 | Driver started (`rt_q.mts`: OS-assigned CDP port + lsof ownership, on-device PNG via /sdcard, dumps need a screen declared in the batch). Relaunch: force-stop + `demsdemo:///login?core=LIVE&motion=off`, full bundle load 12 s, "Live source ready" 12:44:51. |
| 12:45 | budi.santoso signed in (`POST /auth/sign-in 200`); biometric offer recorded (not enabled); web w1 andi.pratama on an OS-assigned port (53253, owned by its pid). |
| 12:47-12:49 | E2E-P-1: 3 repetitions, 18/18 captures with icon, label, pill and border on the active tab (pixel metric that reproduces the round-1 failure on the round-1 pictures). PASS. |
| 12:49-12:58 | Smoke walk: Home, Sessions, session detail, Evidence + detail (3 tabs, custody list), Devices + Camera 1, More, Storage, Network & Time, Audit, Settings + 8 rows, About, Stack Check (E2E-P-2 PASS: "Data source: Live ... Core server"), Install update locked for INVESTIGATOR. New: Settings > Device Settings pushes the Devices list over an open Camera 1 detail (Back goes to the detail; reproduced). |
| 12:58-13:01 | SES-20261006-0035 created/started on the phone by budi. E2E-P-3 PASS (8/8 captures, 28/28 recorded frames equal). Observed at hand-off: false "Core link lost" banner and a monitor timer going 12 -> 13 -> 04 -> 07 -> 08 -> 20. |
| 13:03-13:04 | E2E-P-4 FAIL: andi stopped on the web (stop 202 13:03:57.649); the phone showed "Core link lost", timer back to 04:12, "Resynced" still Recording, then blank 13:04:03.65 and a native RedBox "addViewAt: failed to insert view [22216] into parent [20378] at index 1"; logcat: React instance destroyed (handleHostException). Dismiss -> black screen. Phone socket closed only at 13:04:15.554 (1001). Web idle expiry at 13:01:17 (re-signed in). |
| 13:07 | Custody on the Core and on the web: RECORDING_STARTED AKP Budi Santoso (#455), RECORDING_STOPPED AKP Andi Pratama (#478, "RP web stop by supervisor"), EVIDENCE_SEALED #479 (EV-20261006-0023). |
| 13:09-13:11 | Recovery: force-stop + brief's launch link, budi signed in, route sync to Summary SES-0035 (SEALED 13:04:04, 00:04:21, 595.8 MB = Core). Custody on the phone: "Recording stopped · AKP Andi Pratama", "Recording started · AKP Budi Santoso". PASS. |
| 13:12-13:14 | Repeat SES-20261006-0036: start hand-off clean (799 frames, no notice, timer monotonic); web stop 202 13:14:18.412 -> phone Finalizing at +0.55 s with no frame between; sealed EV-20261006-0024; Summary. E2E-P-4 = FAIL overall (run 1 crash, run 2 pass). |
| 13:16-13:18 | Live role change: to TECHNICIAN Core 200 13:16:30.448, toast +0.23 s, Start Session locked +0.32 s; back Core 200 13:17:43.842, toast +0.24 s, enabled +0.30 s (ROLE_CHANGED #507/#508). Sign-out budi -> Login. |
| 13:19-13:25 | rina (TECHNICIAN): Home/hub Start and Continue setup locked with hint, `/session/new` link -> Home with one toast and one info record, Install update enabled (not pressed); web setup session SES-0037 created and cancelled. andi (SUPERVISOR) on the phone: Install update locked. Three sign-outs land on Login. |
| 13:26 | End state: phone LIVE Login signed out; budi INVESTIGATOR; session/current null; audit chain ok 517; w1 signed out, browser killed, profile removed; reverse rules unchanged; /sdcard clean. F80: 0 toasts in 128 captures and 1,119 frames. |
| 13:34 | Report `test/08b_retest_phone.md` written; secret scan: password 0, token shapes 0 (25 digit-pair hits: 23 tap/swipe coordinates in `q/*.cmd`, 2 quoted examples in the report). Status needs-review: R-P-1 High, R-P-2 Medium, R-P-3 Low. |
