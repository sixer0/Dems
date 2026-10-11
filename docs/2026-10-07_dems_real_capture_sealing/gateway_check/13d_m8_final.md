---
task_id: 2026-10-07_dems_real_capture_sealing
row: 94 (M8 milestone gate - FINAL RE-CHECK after fix wave L; independent +1 verification)
date: 2026-10-11 (run window 14:18 - 14:43 WIB)
agent: verifier (brief `delegation_progress/gate_brief_wave_g.md`; rules D94 / D122 / D163; D151; D231, D235)
tree: 7b1aded (`git status`: only files under docs/ differ; no product file)
earlier: gateway_check/13_m8_gate.md (FAIL), 13b_m8_regate.md (FAIL), 13c_m8_recheck.md (FAIL on G94c-01)
narrative_tier: 2
status: complete
verdict: PASS WITH CONDITIONS
---

# 13d - M8 final re-check (row 94): evidence consumption

## 1. Verdict

**PASS WITH CONDITIONS.** No BLOCKER or MAJOR is open. One condition is a must-fix by my
recommendation; the controller rules on it.

| Item of 13c | State now |
|---|---|
| **G94c-01 MAJOR** web tamper demonstration | **CLOSED for the demonstration, with one remainder (G94d-01).** In my own Chrome 154 (headless, muted) through `127.0.0.1:5177`: open + Play shows the integrity sentence naming VIDEO-02 fragment 3 and the tile "Stopped" 5.8 s after the open, Camera 1 plays to its end, sentence and mark stay. The same as the investigator. The 409 at the cut's byte is seen, three probe requests. **Remainder: when playback ENDS within 4.0 s of the open (open, scrubber at 80 %, Play at once) the tile stays black and silent - 3 of 3 runs, still silent 25 s after the end. A second Play shows the sentence.** These are the steps of 13c's run 2; note 154's claim that this case is fixed holds only when playback outlasts the 4 s |
| G94c-02 | CLOSED (list updates under the open wizard, no reload) |
| G94c-03, -04, -05, -06 | CLOSED on the devices named |
| G94c-07 | not reproduced (three view-tree reads of 2.2 - 2.6 s on the stopped phone player) |

**Conditions**

| # | Condition | Owner |
|---|---|---|
| C-1 | Fix G94d-01 (section 4) with a test of "the leading file ends before the stall watch runs out", and re-drive item 1 (b) at 80 % in a browser | web driver, wave M |
| C-2 | G94d-02: decide whether two WARNING rows for one web stop are acceptable (2 of 5 stops) | server driver / controller, wave M |
| C-3 | `M8-CMP-1` stays blocked: licence decision | user (unchanged, not driven) |

Why not FAIL: the demonstration the spec asks for (PE-WH-07: the altered file stops with the
integrity sentence, the other plays) is met on the normal route for two roles, and the silent
case recovers at the next Play. Why not a plain PASS: sub-check 1 (b) as I first drove it failed,
reproducibly, and the result is a tampered file with no word. If the controller's rule is "every
sub-check of item 1 as written", (b) at 80 % did not pass and the row is FAIL on G94d-01 alone.

## 2. Start state (14:18)

| Item | State |
|---|---|
| Tree | `7b1aded`, no product file modified |
| Lanes | 1 RUNNING PID 13944 (4421 / web 5176); 2 RUNNING PID 13991 (4422 / web 5177); neither restarted nor reset by me |
| Lane 2 | selector `CAM-01` / `CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`; `session/current` `SES-20261011-0057` SEALED; 47 alerts, none active; chain ok, 981 rows; 40 items; seal rig OFF (read) |
| Devices | both awake, unlocked, on Login, fields empty, "Core online", paired as `DEV-0001` / `DEV-0002`; both reverse rules present; media volume found tablet 4, phone 5 -> 0 by volume-key events (read back 0, muted) before any playback |
| Host | load 3.10 at the start, 2.40 at the end |

## 3. Items table

W2 = web lane 2, W1 = web lane 1 (second browser profile), T = tablet, P = phone.

| # | Item | Surface | Result | Evidence |
|---|---|---|---|---|
| 1a | open, Play 1.5 s later, to the end (supervisor) | W2 | **PASS** | sentence "This recording failed its integrity check at VIDEO-02 fragment 3." + "The Core server refused the fragment ... Camera 2 is stopped. Camera 1 plays on. Run Verify for the full result." and tile "Stopped: this file failed its integrity check at fragment 3." first seen **5.78 s after the open** (Camera 1 at 4.2 s); Camera 1 0 -> 8.0 s, ended; sentence and tile still there 8 s after the end (`a_through_1`, `a_through_3`) |
| 1b | open, scrubber at 80 %, Play at once | W2 | **FAIL (G94d-01)** | Camera 1 6.3 -> 8.0 s, ends 4.0 s after the open; Camera 2 black, no sentence, no tile mark, no probe request, no 409; unchanged 8 s and (second run) 25 s after the end (`b_seek_3`). Second run after the fail: the same. Third run with the element's events logged: the same, cause in section 4 |
| 1b | open, scrubber at 50 % (past fragment 3), Play | W2 | PASS | sentence + tile 5.83 s after the open while Camera 1 plays; both stay after the end (`b3_seek50_3`) |
| 1b | open, scrubber at 80 %, Play 3.7 s after the open | W2 | PASS | sentence + tile 5.81 s after the open, just after the end; stay |
| 1c | clean `EV-20261008-0001` right after | W2 | PASS | both files `readyState 4`, 1280 wide, 0 -> 8.0 s, both ended; no alert, no tile note; 25 x 206, 0 x 409, no probe (`c_clean_3`) |
| 1d | network | W2 | PASS | probe = **3 requests**, 4.0 s after the open: `bytes=0-2097151` 206; `bytes=2097152-4194303` 206, cancelled by the page 1.5 s later; **`bytes=2257425-4354576` -> 409**, len 305. Run (a) in all: 17 x 206, 1 x 409. The browser's own console line for the refused request carried a path: counted (1-2 per run), never written |
| 1e | audit rows of ONE stop | API | recorded; **G94d-02** | run (a): seq 982, 983 "Media session opened" + **two** WARNING "Media stream stopped: VIDEO-02 fragment 3 (FRAGMENT_NOT_AUTHENTIC)" seq 984, 985, 3 ms apart (`rangeStart 1146880` and `2228224`: the media element's own two range requests; the probe adds none). Of my five web stops outside the 60 s window: two wrote 2 WARNING rows (984-985, 1004-1005), three wrote 1 (992, 999, 1009) |
| 1f | the same as the INVESTIGATOR | W2 | PASS | "Logged in as AKP Budi Santoso"; sentence + tile 5.78 s after the open, Camera 1 to the end, both stay; 409 at the same byte, 3 probe requests; rows seq 1007, 1008 + ONE WARNING 1009, actor `OPR-001` (`f_investigator_3`) |
| 1g | lane 1 demo tamper item `EV-20261010-0005` | W1 | PASS (unchanged behaviour) | "DEMO package"; Media tab = "DEMO excerpt / DEMO media - bundled with this application, not a recording of this Core", the old excerpt player (no sealed player, no integrity alert; Play ran 3.7 s, state read only, no picture kept); Hash & Integrity -> Verify: "FAIL ... 6 of 6 checks ... AUDIO-02 · MIC 2 - Subject SHA-256 FAIL", "Sources: not recorded (v1 package)", "DEMO - recomputed" (`w1_01`, cropped to the verify card) |
| 2 | finished-exports list after an export, wizard open | W2 | **PASS** | `EV-20261011-0043`, `EXP-000041`: POST 202 at 14:31:10; job COMPLETE and, in the same sample (+2.1 s), the page behind the wizard reads "FINISHED EXPORTS / EXP-000041 · Package / Finished 11 Oct 2026 14:31:10 / Download export"; **0 document navigations**, ONE read of the item (op 40) at the job's end; page load time unchanged (14:27:59). While the job ran (about 1.5 s) the card read "No finished export of this item." beside "Exported" - true at that moment |
| 2 | ONE signed download, into my folder | W2 | PASS | "Download export" once: `GET /exports/exs_<95>` 200, `content-length 47562300`, `cache-control: no-store`; `.cache/gates/94d/exports/DEMS-export-EXP-000041.zip`, 47,562,300 bytes, sha256 equal to the job's `archive.sha256`; nothing in `~/Downloads` (count of `DEMS-export*` there 0 before and after). Rows seq 1011 verified, 1012 requested, 1013 downloaded |
| 2 | receiver's command | CLI | PASS | `npm run evidence:verify-export -- <archive>`: X-01..X-07 PASS, "development sources: yes", "anchored: no - no --trust given", `RESULT: PASS`, exit 0 (`work/verify_export_EXP-000041.txt`) |
| 2 | wizard CLOSED before the job ends | W2 | stated, **not a finding** | second export `EXP-000042` of the same item: Export pressed, Escape 20 ms later. The page kept listing `EXP-000041` only for the 30 s watched and 38 s later (no op 40 read, job COMPLETE on the Core). After in-app navigation (Back to Evidence -> Open details, no reload) it lists both (`w2_exports_list_after_navigation`). So: stale while the page stays open, right once the item is read again |
| 3 | G94c-03 interrupted end, tablet | T | **PASS** | `EV-20261010-0017` at "0:29 / 0:31": "End of the sealed recording at 0:29: the recording was interrupted, so it ends here." (`t_02`) |
| 3 | G94c-03, phone | P | **PASS** | `EV-20261011-0031` at "0:24 / 0:26": "End of the sealed recording at 0:24: the recording was interrupted, so it ends here." (`p_01`) |
| 3 | the web's sentence, for comparison | W2 | same | `EV-20261010-0017` at "0:29 / 0:31": "End of the sealed recording at 0:29: the recording was interrupted, so it ends here." |
| 3 | G94c-04 "no interval" at 0:00 | T | **PASS** | `EV-20261010-0015`, "Open playback", not started, "0:00 / 1:00": "Audio at the playhead: MIC 1" |
| 3 | G94c-05 background / foreground | P | **PASS** | `EV-20261010-0020` playing ("Pause", 0:56 -> 0:58); Home 8 s; back: both controls "Play", "0:59" standing in two frames 4.8 s apart; ONE press: "Pause", 1:00 -> 1:04 (`p_04`) |
| 3 | G94c-06 short tampered item, Play | T | **PASS** | no scroll by me: tab row first, both tiles, the stop sentence, "Open again", scrubber, "0:03 / 0:08" all in view (`t_04`) |
| 3 | G94c-06 | P | **PASS** | tab row first, both tiles and the whole stop sentence in view above the action bar (`p_05`); "Open again" is the next line below |
| 3 | G94c-07 stopped tamper player idle | P | PASS (not reproduced) | three `uiautomator dump` in a row 9 s after Play: 2.2 s, 2.5 s, 2.6 s, each complete |
| 4 | seek at about 50 % | T | PASS | `-0015` (60.3 s), playing, tap at the scrubber's middle: "0:31" at +1.7 s, "0:35" at +5.4 s, both pictures changed; landing about 29.3 s against 30.1 (`t_03`) |
| 4 | play / pause / one seek | P | PASS | `-0020`: Play -> two patterns, "Pause", "0:05 / 1:36" (`p_02`); tap at 50 %: "0:50" at +1.7 s, "0:53" at +5.4 s (`p_03`); Pause holds "0:54" in two reads 3 s apart |
| 4 | tamper stop writes ONE WARNING row | T | PASS | seq 1024, 1025 opened + ONE WARNING 1026, `DEV-0001`, `OPR-001`; sentence "Playback stopped at 0:03 and did not resume. A recording that fails its integrity check stops at the failed fragment: run Verify to see which." |
| 4 | the same | P | PASS | seq 1033, 1034 + ONE WARNING 1035, `DEV-0002`, `OPR-002`; the same sentence |
| 4 | export control without `access.export` | T (INVESTIGATOR) | PASS | Export `enabled=false`, "Export requires the Supervisor role."; a press opens nothing; audit unchanged at seq 1026 - 0 `EXPORT_DENIED` |
| 5 | per-track profile beside the player | W2, T (P seen too) | PASS (glance) | W2 `-0005` and `-0043`: "SEALED FORMAT (SIGNED MANIFEST) VIDEO-01 H264_720P30 VIDEO-02 H264_720P30"; T `-0005` "Camera 1: H264_720P30 / Camera 2: H264_720P30", `-0015` / `-0017` "H264_1080P25" (what their manifests state); P `-0031` 720P30 |
| 5 | development mark on the legend | W2, T | PASS (glance) | W2: "MIC 1 0:00-0:08 Development source / Test source"; T: "Development source" beside MIC 1 and MIC 2 (`t_03`) |
| 6 | logcat | T | PASS | 14:33:56 - 14:42:38 (cleared after the sign-in; covers the sign-out), 39,438 lines: 0 `FATAL EXCEPTION` / `ANR in`, 0 token shapes, **0 `ReactNativeJS` error lines** (39 info). Listed, not counted: ExoPlayer "Playback error ... Source error" ONCE at 14:37:06 (the tamper stop; 16 lines of one trace). Other error-level lines of the app process, the known media / emulator-graphics classes: `ExpoVideo` 18, `MediaCodec` 12, `EGL_emulation` 16, the process's own graphics tag 12, `Surface` 2 |
| 6 | logcat | P | PASS | 14:33:57 - 14:42:39, 87,443 lines: 0 fatal, 0 token shapes, 0 `ReactNativeJS` error lines (41 info); the ONE ExoPlayer playback error at 14:41:21; `ExpoVideo` 12, `MediaCodec` 12, `EGL_emulation` 16, graphics tag 12, `Surface` 2 |
| 6 | mount warnings (counted only) | T / P | 318 / 1116 | `Reanimated ... RetryableMountingLayerException` |

## 4. Findings

| ID | Severity | What | Steps and evidence | Spec |
|---|---|---|---|---|
| **G94d-01** | **MINOR, must-fix by my recommendation (C-1)** | Web: the tampered file stays a black tile with no word when playback ends within 4.0 s of the open | W2, supervisor, `/evidence/EV-20261009-0005`: Open playback; 1.5 s later click the scrubber at 80 % and press Play. Camera 1 plays 6.3 -> 8.0 s and ends about 4.0 s after the open. No `evidence-playback-integrity`, no `evidence-sealed-integrity-VIDEO-02`, no "has not loaded", no probe request, 0 x 409 - at the end, 8 s after and 25 s after (3 of 3 runs; `shots/b_seek_3_end_plus_tail.png`, `web_net_b_seek.log`, `web_net_b2_seek.log`). Pressing Play again shows the sentence 5.5 s later. With Play 3.7 s after the open, or the scrubber at 50 %, the sentence comes | PE-WH-07; note 127 section 9; 13c section 4 (run 2); note 154 section 2.1 claims this case |
| G94d-02 | MINOR | Web: one tamper stop sometimes writes TWO WARNING audit rows | seq 984 + 985 (3 ms apart) and 1004 + 1005 (19 ms apart), same operator, session, file, fragment; three other stops wrote one. Tablet and phone: one each | G94b-10 ("ONE audit row"); `media-stream/service.ts` comment "the same stop asked for again ... is a log line" |
| G94d-03 | NOTE | Web: an export whose wizard is closed before the job ends is not listed until the item is read again | item 2, third row. Known (note 156 section 8); right after in-app navigation | PE-WH-13 (1) |

**Cause of G94d-01, measured.** Events of the VIDEO-02 element in the failing run:
`play@1.58 (t=6.0, readyState 0)`, `waiting@1.58`, `stalled@3.33`, `timeupdate@3.67 (t=7.8, readyState 0)`,
`pause@3.67`. The seek sets the clock of the file that never loaded; when the leading file ends,
the player pauses every element; that pause fires `timeupdate` on VIDEO-02 with `currentTime 7.8`.
`apps/core-web/src/features/evidence/sealed-player.tsx:658` takes
`currentTime > 0 || readyState >= 1` as a sign of life, so `onAlive` (`:346-349`) cancels the
4 s stall watch (`STALL_CHECK_MS`, `:54`) 0.3 s before it would ask the Core, and marks the file
alive, so no later watch starts until an element event (`waiting` at the next Play) starts one.
Wave L's guard covers only a clock at 0; the player's own seek / re-align moves that clock.
HYPOTHESIS, read from the same lines and NOT driven (lane 2 has no such item): a file that DID
load and is altered in its last 4 s would lose its watch the same way when the other file ends -
there `readyState >= 1` is true, so a fix should not rest on the clock test alone.

**Cause of G94d-02, read.** `apps/core-server/src/media-stream/service.ts` `recordServed`: the
stop is remembered only after its row is committed, so two range requests of one element that are
cut at the same moment both pass the "already known" test.

## 5. State of 13c's findings

| Finding | State |
|---|---|
| G94c-01 MAJOR | CLOSED as a MAJOR (items 1a, 1c-1f); remainder G94d-01 |
| G94c-02 | CLOSED; the closed-wizard case stated (G94d-03) |
| G94c-03 | CLOSED on tablet and phone; the three sentences are the same words |
| G94c-04 | CLOSED on the tablet |
| G94c-05 | CLOSED on the phone |
| G94c-06 | CLOSED on tablet and phone |
| G94c-07 | not reproduced |

Not reported again, met as known: G89d-03 (tablet list duration cut to "00:00", `t_02`), the
mount warnings, the emulator graphics error lines.

## 6. Skipped / user-attended / NOT PROVEN

| Item | State |
|---|---|
| Biometric offer after the two device sign-ins | skipped by the user's instruction (D151): "Not now" on both; no fingerprint touched |
| Local-device flows | none: no LOCAL_DEVICE source selected, pre-checked or started; no local-device media opened |
| Tamper stop on an item whose altered fragment lies late in a file that loads | NOT PROVEN: no such item (the hypothesis of section 4) |
| G94d-01 with a real mouse in a headed browser | NOT PROVEN: headless Chrome over CDP only |
| A production web origin without the dev proxy | NOT PROVEN: none exists in the project (note 154) |
| "no interval" at 0:00 on the phone; legend mark on the phone | not read in this session (13c / note 155 hold them) |
| Phone on the simulated lane | NOT PROVEN: lane 1 has no device |
| Export from a device, stepper, denied-role control on the phone, renewal, 70 s play, seek beyond the buffer | not re-driven (passed in 13c; not in this session's list) |
| `M8-CMP-1` | blocked: licence decision (user) |
| Suites, typecheck, lint | not run by me (`test/11_precommit_wave_l.md` is the runner's) |
| New recording | none made |

## 7. Tooling lapses

- After the fail of 1 (b) I made the allowed second run and then FIVE diagnostic opens of the
  tampered item (50 %, late Play, events logged, early Pause, Play again): 10 web opens of
  `EV-20261009-0005` in all, 5 WARNING stop events (7 rows) by the supervisor, 1 by the investigator.
- My click helper mis-aimed in the export wizard (the viewport override of a CDP session is
  dropped at disconnect and the dialog re-centres): about five clicks landed on the dialog's
  background with no effect, and "Request authorisation" of the first wizard was pressed with the
  keyboard. Not a product defect; fixed in the tool (600 ms settle).
- A SECOND export of `EV-20261011-0043` (`EXP-000042`) was made for the closed-wizard case.
- Two tool outputs of mine printed the audit chain's head hash unmasked, one the shortened hashes
  of the wizard and of lane 1's published DEMO package (in no file, not in this report).
- The first lane 1 screenshot held the bundled DEMO poster picture; it was cropped to the verify
  card before it was kept.
- On lane 1 the DEMO excerpt has one unmuted audio element; the browser ran with `--mute-audio`.

## 8. Screenshots (`.cache/gates/94d/shots/`, 16 files, each read; test-pattern frames only)

| File | Shows |
|---|---|
| `a_through_1_sentence_while_playing.png` | web tamper item playing at 0:04: Camera 1 colour bars, Camera 2 tile "Stopped: this file failed its integrity check at fragment 3.", the red integrity alert, sealed-format card, legend with the development mark |
| `a_through_3_end_plus_tail.png` | the same 8 s after the end, 0:08 / 0:08, Play: alert and tile still there |
| `b_seek_3_end_plus_tail.png` | G94d-01: 0:08 / 0:08 after the 80 % seek: Camera 2 a black tile, no alert, no word |
| `b3_seek50_3_end_plus_tail.png` | after the 50 % seek: alert and "Stopped" tile at 0:08 / 0:08 |
| `c_clean_3_end_plus_tail.png` | clean item at 0:08 / 0:08: two colour-bar tiles, no alert |
| `f_investigator_3_end_plus_tail.png` | investigator ("AKP Budi Santoso", no administration menu): alert and "Stopped" tile after the end |
| `w1_01_lane1_tamper_item_verify.png` | lane 1 Hash & Integrity card: FAIL, 6 of 6 checks, AUDIO-02 row red |
| `w2_exports_list_after_navigation.png` | `-0043` "Exported", FINISHED EXPORTS with EXP-000042 and EXP-000041, sealed-format card |
| `t_02_0017_end.png` | tablet interrupted item at 0:29 / 0:31 with the end sentence under the tiles |
| `t_03_0015_seek50.png` | tablet two frames after the 50 % tap: 0:31 and 0:35, Pause, legend marks |
| `t_04_tamper_after_play.png` | tablet tamper item after Play: tabs first, two tiles, stop sentence, Open again, 0:03 / 0:08, disabled Export with its caption |
| `p_01_0031_end.png` | phone interrupted item at 0:24 / 0:26 with the end sentence |
| `p_02_0020_playing.png` | phone `-0020` playing: two stacked patterns, Pause in player and action bar, 0:05 / 1:36 |
| `p_03_0020_seek50.png` | phone two frames after the 50 % tap: 0:50 and 0:53 |
| `p_04_background_foreground.png` | phone before Home (Pause, 0:56 / 0:58), after the return (Play, 0:59 twice), after one press (Pause, 1:00 / 1:04) |
| `p_05_tamper_after_play.png` | phone tamper item after Play: tabs, two tiles, the whole stop sentence above the action bar |

## 9. Environment as left (14:43)

| Item | State |
|---|---|
| Lanes | 1 RUNNING PID 13944, 2 RUNNING PID 13991 - neither restarted nor reset; web 5176 / 5177 answer 200; Metro, PostgreSQL, the stub untouched |
| Selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` (read last; never changed) |
| Session | none open; `session/current` = `SES-20261011-0057` SEALED; no recording made |
| Seal rig | OFF (`status` read at the start and the end; never switched) |
| Alerts | 47, none active |
| Lane 2 data | 40 items; `EV-20261011-0043` now `EXPORTED` (`EXP-000041` downloaded once, `EXP-000042`); one verify row on it (seq 1011) and one from the second wizard; media-session rows on `-0005`, `-0001`, `-0017`, `-0015`, `-0031`, `-0020`; WARNING stop rows on `-0005`: seq 984, 985, 992, 999, 1004, 1005, 1009, 1026, 1035. Chain ok, 1037 rows, then my last sign-out |
| Lane 1 | one FAIL verify row on `EV-20261010-0005`, one supervisor sign-in / sign-out; still no device |
| Devices | both signed out through the app, on Login, fields empty, "Core online", paired as `DEV-0001` / `DEV-0002`, both online; reverse rules `tcp:8081 -> 8081`, `tcp:4420 -> 4422` read back on both; media volume back as found (tablet 4, phone 5); no re-pairing, no lock change, no reboot, biometric not enabled |
| Helpers | every helper session signed out (204, then 401), no jar left; both headless Chrome processes stopped, both profiles removed; logcat readers stopped; no capture-worker / ffmpeg / whisper process |
| My files | only under `.cache/gates/94d/` (68 MB): `exports/DEMS-export-EXP-000041.zip` 45 MB; `shots/` 16; `work/`; `tools/`; eleven `web_net_*.log` (tokens blanked at write), two logcats, two Chrome logs. 0 token shapes in any of them |

## 10. What the next check must know

1. Re-drive of C-1: `node .cache/gates/94d/tools/tamper.mjs <profile> http://127.0.0.1:5177 EV-20261009-0005 seek <label> <jar>` reproduces G94d-01 as it stands (scrubber at 80 %, Play 1.9 s after the open); `SEEK_FX`, `PLAY_DELAY`, `TAIL_MS`, `REPLAY` vary it.
2. A CDP session's viewport override ends with the session: wait about 600 ms after setting it before clicking in a dialog.
3. A download lands in the chosen folder when `Browser.setDownloadBehavior` is sent on a browser-level connection that STAYS OPEN until the download ends (`tools/export_run.mjs`).
4. `uiautomator dump` does not return while a player plays; it returns at once on a paused or stopped one.
5. The evidence list's search field opens an item without scrolling on both devices (`tools/find.sh`).

---
*Generated: 2026-10-11 14:50 WIB*
