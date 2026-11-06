# RF-PH — final independent re-test, phones (progress file, parallel run)

| Field | Value |
|---|---|
| Row | RF-PH (final re-test after CF-M1 / CF-M2; decisions D213, D211, D216, D218) |
| Agent | verifier |
| Devices | emulator-5554 (dems2_phone, lane 1: Core 4421, web 5176); emulator-5558 (dems2_phone2, main: Core 4420, web 5173). emulator-5556 not touched |
| Status | needs-review (complete; new defects RF-PH-1..4) |

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 16:35 | Inputs read (D211, D213, D216, D218, 12a, 12b, 08b, 08d); host load 5.98; both phones focused, no keyguard; adb reverse lists read (not changed) |
| 16:37 | Own queue driver started for both lanes (CF-M1 driver with the Hermes inspector and the stall helper removed, a 2.5 s password-capture guard and a load guard added) |
| 16:38 | Both phones force-stopped and relaunched at `demsdemo:///login?core=LIVE&motion=off`; both LIVE, Core online (phone DEV-0001, phone2 DEV-0019) |
| 16:40 | budi.santoso signed in on the phone (sign-in 200); andi.pratama on web 5176 (headless shell, OS-assigned DevTools port, ownership checked) |
| 16:42 | R00 calibration run (uiautomator dump fails on the live monitor; recording ended before the stop: not counted) |
| 16:47 | R01 (bookmark variant) done; detector validated on CF-M1's pre-fix recordings (E3: 58 banner frames; E2: 1 backward step) |
| 16:50 | R-P-1 loop R02-R12 started |
| 17:11 | R02-R12 done: 0 crashes, 0 red screens, 0 crash-class native lines, 0 false banners, 0 backward timer steps; every recorded monitor -> next frame is Finalizing. Found: timer holds behind the Core under load (RF-PH-1), stale 'Recording' monitor when the web stop lands before the monitor is drawn (R11: 71 s; RF-PH-2), one empty frame at Ready -> monitor and at Evidence sealed -> Summary (RF-PH-3). R10 incident: the bookmark popover did not open, the second tap opened the phone's own End Session dialog; hand-over not recorded |
| 17:18 | Extra runs R13-R16 started (two stops about 7 s after the start, one bookmark, one 30 s) so that at least 10 runs have the stop land on a drawn monitor |
| 17:28-17:40 | phone2: 4 revokes (R-S-1: S1 674 ms, I1 882 ms, S2 616 ms, I2 823 ms at load 3.7-5.4, no dark frame) and 4 hand-offs (R-S-2: 0 unreachable frames); phone2 now DEV-0023. H3 recording showed the redeemed code in frame 2: blacked out, original deleted, driver delay added. One AUTH_FAILED on main (AUD-000301) |
| 17:40-17:44 | RF-PH-4: after an idle expiry the phone's Login showed only the emblem for at least 3 min; relaunched. One uiautomator dump hit Login (slip) |
| 17:46-17:53 | R-P-3 PASS (one Back to Settings), smoke 5/5 incl. Hash & Integrity reading the Core's stored verification (NOT_RUN and PASS); phone signed out |
| 17:55-17:57 | R18 (30 s stop at load 5): clean, timer lag 2.5 s |
| about 18:05 and later | Controller trim, then user rule (2 runs + 1 verification per check; no more loops). No new runs after it |
| 18:11-18:13 | RF-PH-4 repeat (queued earlier, waiting and captures only): not reproduced, full Login with the "Session expired" dialog |
| 18:23-18:39 | A queued capture hung at host load 27.4; the lane-1 driver was ended by its 2 h limit; the session stalled until 20:35 |
| 20:35-20:37 | End state checked: both phones LIVE, signed out, on Login; phone2 DEV-0023 (only Paired); both current sessions SEALED; budi INVESTIGATOR; browsers and drivers closed; secret scan 0/0 |
| Status | needs-review: report `test/10a_final_retest_phones.md`, assets `test/assets/retest2/ph/` (97 files) |
