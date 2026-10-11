---
task_id: 2026-10-07_dems_real_capture_sealing
row: 94 (M8 milestone gate - TARGETED RE-CHECK after fix wave K; independent +1 verification)
date: 2026-10-11 (run window 09:28 - 10:09 WIB)
agent: verifier (brief `delegation_progress/gate_brief_wave_g.md`; rules D94 / D122 / D163; D151; D230)
tree: b05106b + the uncommitted fix 151 (`git status`: four core-server files of fix 151 modified, two new test files; no other product file differs)
earlier: gateway_check/13_m8_gate.md (FAIL), 13b_m8_regate.md (FAIL)
narrative_tier: 2
status: complete
verdict: FAIL
---

# 13c - M8 targeted re-check (row 94): evidence consumption

## 1. Verdict

**FAIL - one blocking item.**

| Item of 13b | State now |
|---|---|
| **G94b-02 MAJOR** web tamper demonstration | **STILL OPEN in a real browser (G94c-01).** Google Chrome 154 (headless, muted) on lane 2's web: the altered file `VIDEO-02` stays a black tile, NO integrity sentence, no "Stopped" mark on the tile, Camera 1 plays to the end. While playing the tile area reads "This file has not loaded." and the sentence disappears at the end. Two runs (play through; open and seek past the fragment), same result. Cause established, section 4 |
| **G94b-01 MAJOR** tablet seek | **CLOSED.** Taps at about 25 / 50 / 90 % land within one fragment, both files play on; seek beyond the buffer on the 296 s item; seek on an interrupted item; position kept across a renewal after 70 s |
| `M8-PB-P` (was NOT PROVEN) | **PROVEN** on the phone (`DEV-0002`, lane 2): open, play, pause, two seeks, band, transcript with revisions, development mark, play past the 60 s lifetime, tamper stop. With G94c-03, -05, -06 (MINOR) |

Everything else driven here passes or carries a MINOR. `M8-CMP-1` stays blocked: licence decision
(user), unchanged, not driven.

The fix for G94b-02 works against the Core itself and does not work through the web console's own
origin. That is the only surface an operator has, so the item is not softened to a condition.

## 2. Start state (09:28)

| Item | State |
|---|---|
| Tree | `b05106b` + fix 151 uncommitted |
| Lanes | 1 RUNNING PID 52989 (4421 / web 5176, SIMULATED); 2 RUNNING PID 70017 (4422 / web 5177, REAL_DEVELOPMENT). Neither restarted nor reset by me |
| Lane 2 | selector `CAM-01` / `CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`; `session/current` = `SES-20261011-0043` SEALED; 29 alerts, active `ALR-000049` only (known); audit chain `ok`, 690 rows; seal rig OFF (read) |
| Devices | both awake, unlocked, on Login, fields empty, "Core online", "paired as DEV-0001" (tablet) / "DEV-0002" (phone); reverse rules `tcp:8081 -> 8081`, `tcp:4420 -> 4422` on both |
| Media volume found | phone 5 of 15, tablet 4 of 15. Brought to 0 (`Muted: true`, read back) with volume-down key events before any playback |
| Host | load 3.18 at the start, 3.51 at the end |

## 3. Items table

Surfaces: W2 = web lane 2 (Chrome 154 headless, `--mute-audio`), W1 = web lane 1, T = tablet,
P = phone, API = the Core through the helper session.

| # | Item | Surface | Result | Evidence |
|---|---|---|---|---|
| 1 | G94b-02 web tamper stop, playing through | W2 | **FAIL (G94c-01)** | section 4 |
| 1 | G94b-02, open and seek straight past the fragment | W2 | **FAIL (G94c-01)** | section 4 |
| 1 | network panel | W2 | recorded | every `/media/mts_<91>` answer the browser saw is 206; NO 409 reached the browser in either run; the probe's one request `bytes=0-` got 206 with `content-length 4287353` and was cancelled by the page 10.0 s later |
| 1 | audit rows of one stop | W2 | recorded, differs from the fix note | run 1: seq 691, 692 "Media session opened" + seq 693 WARNING "Media stream stopped: VIDEO-02 fragment 3 (FRAGMENT_NOT_AUTHENTIC)", `bytesServed 2257425` = three rows in all (note 141 expected one served + one WARNING on top of the browser's own). Run 2: seq 697, 698 only - no WARNING (inside the 60 s one-row window of seq 696, written by my own diagnostic, section 4) |
| 1 | the clean item right after | W2 | PASS | `EV-20261008-0001`: both files `readyState 4`, 1280 wide, 0 -> 8.02 s, no alert, no "has not loaded" 5.5 s after the open nor while playing; 22 x 206, rows 699-700 only |
| 2 | G94b-01 seek at 25 / 50 / 90 % | T | **PASS** | `EV-20261010-0015` (60.8 s). Tap at 25 %: "0:14" 1.5 s after, "0:18" 3.7 s later. 50 %: "0:30", then "0:34". 90 %: "0:56", then "0:59". Both pictures differ between the two frames of each pair (`shots/t_02`, `t_03`, `t_04`). Landing place = reading minus the time since the tap: about 13, 29, 55 s against 15.2, 30.4, 54.7 - inside the 2-3 s fragment |
| 2 | seek beyond the buffer | T | PASS | `EV-20261010-0014` (296 s): tap at 25 %: "1:11 / 4:56", then "1:15", both pictures moving (`shots/t_05`) |
| 2 | seek on an interrupted item | T | PASS | `EV-20261010-0017`: tap at 50 %: "0:17 / 0:31" playing; plays to "0:29 / 0:31", Play (`shots/t_08`) |
| 2 | 70 s across a renewal after a seek | T | PASS | `-0014`: seek 09:39:38 to 1:10; at 09:40:51 "2:25", still playing on the first session (`shots/t_06`); Pause, Play: "Renewing the media session...", "2:26", then "2:30" with Pause (`shots/t_07`); two new rows seq 715-716, `DEV-0001` |
| 2 | action bar reads "Pause" while playing | T | PASS | `shots/t_01`, `t_07` |
| 2 | Play brings the player into view (G94b-04) | T | PASS on `-0015` / `-0014` / `-0017`; **not on the short item** (G94c-06) | `shots/t_01`: after Play the tab row is the first line, both pictures, scrubber, Pause visible |
| 3 | `M8-PB-P` open, play, pause | P | **PASS** | `EV-20261010-0020`: Play in the action bar -> two rows seq 736-737 with `DEV-0002`; two test patterns stacked, "0:03 / 1:36", player control and action bar read "Pause" (`shots/p_03`); Pause holds the position (0:23) |
| 3 | seek, two targets | P | PASS | tap at 30 %: "0:27", then "0:31"; tap at 70 %: "1:09", then "1:13"; pictures moving (`shots/p_04`, `p_05`) |
| 3 | band, transcript below, revisions | P | PASS | view tree: "MIC 1, 0:00 to 1:36", legend "Development source", "Audio at the playhead: MIC 1"; "Transcript assembled", "Inside the sealed package", the model lines; "Sealed original - immutable"; segments 1-3 each with "Revision N · derived, not part of the sealed transcript · by <author>" and the revised text under the original |
| 3 | development mark | P | PASS as ruled | header `evidence-detail-development`, list row chip, band legend; camera tiles carry none (D224 (4)) |
| 3 | interrupted item's end (G94b-09) | P | **FAIL, MINOR (G94c-03)** | `EV-20261011-0031`: header "Sealed - recording was interrupted, Cause: CAPTURE_FAULT"; the player ends at "0:24 / 0:26", Play, no sentence |
| 3 | play past the 60 s lifetime | P | PASS | sessions issued 09:53:16; still playing at 09:54:40 "0:51" and 4 s later "0:56" (`shots/p_06`), no new session, no error |
| 3 | background / foreground | P | **PASS for the position, MINOR G94c-05** | Home 8 s, back: position kept ("0:18" before, "0:19" after, `shots/p_08`), no error, no session asked. The player stands still while both controls read "Pause" |
| 4 | tamper stop | T | PASS | `EV-20261009-0005`: "Playback stopped at 0:03 and did not resume. A recording that fails its integrity check stops at the failed fragment: run Verify to see which."; rows seq 721, 722 (opened) + **ONE** WARNING seq 723, `DEV-0001`, `bytesServed 2257513` |
| 4 | tamper stop | P | PASS | the same sentence, "Open again", "0:03 / 0:08" (`shots/p_14`); rows seq 746, 747 + **ONE** WARNING seq 748, `DEV-0002` |
| 5 | export control without `access.export` | T (TECHNICIAN) | PASS | `EV-20261011-0029`: Export `enabled=false`, caption "Export requires the Supervisor role." above the action bar; a press opens nothing. No "Request authorization" control is offered on this path. Rows after the sign-in (seq 733) up to the sign-out (734): none - 0 `EXPORT_DENIED` |
| 5 | export control without `access.export` | P (INVESTIGATOR) | PASS | `EV-20261011-0032`: Play enabled, Export `enabled=false`, the same caption; the press opens no sheet; audit unchanged at seq 735 |
| 5 | export as a permitted role, sending device (G94b-03) | T (SUPERVISOR) | PASS | `EV-20261010-0015`: Authorize -> "Source verified by the Core: PASS" -> Destination -> Reason -> "Complete", "The export is stored on the Core (EXP-000038).", "Download from the web console." Rows seq 724 `EVIDENCE_VERIFIED` and seq 725 `EVIDENCE_EXPORTED` both `dev= DEV-0001` |
| 5 | default destination (G94b-12) | T | PASS | `evidence-export-destination-caseFile` `checked=true` on arrival; row 725 `destination "Case file transfer"` |
| 5 | finished-exports list refreshes (G94b-05) | T | PASS | 2 s after "Done", without reopening: status "Exported", "FINISHED EXPORTS, EXP-000038 · Package, Download from the web console." |
| 5 | stepper badges (G94b-13) | T | PASS | `shots/t_10`: six check marks, Authorize .. Done (second export `EXP-000039`, section 8) |
| 6 | default destination | W2 | PASS | wizard of `EV-20261011-0032` opens with "Case file transfer" selected, no "(simulated)"; op 40 `exportDestinationDefault "Case file transfer"` |
| 6 | job sentence follows `archiveOnCore` | W2, W1 | PASS | W2: "The export is stored on the Core server. ..."; the job states `archive {bytes 47287400, sha256}`. W1: next row |
| 6 | ONE signed download | W2 | PASS | "Download export" once: `GET /exports/exs_<95>` 200, `content-length 47287400`, `cache-control: no-store`. File `.cache/gates/94c/exports/DEMS-export-EXP-000037.zip`, 47,287,400 bytes; its sha256 equals `archive.sha256` of op 87 (`7d12...d90f`). Rows seq 705 verified, 706 requested, 707 downloaded |
| 6 | receiver's command | CLI | PASS | `npm run evidence:verify-export -- <archive>`: X-01..X-07 PASS, "development sources: yes", "anchored: no - no --trust given", `RESULT: PASS` |
| 6 | ONE negative control | CLI, copy | PASS | one byte flipped in the middle of `fragments/VIDEO-01.mp4` of a copy: exit 1; X-04 `ENTRY_HASH_MISMATCH:fragments/VIDEO-01.mp4`; X-06 `PLAINTEXT_HASH_MISMATCH:VIDEO-01`, `FRAGMENT_PLAINTEXT_MISMATCH:VIDEO-01:11`; `RESULT: FAIL` (`work/negative_control.txt`; the copy removed) |
| 6 | finished-exports list after the export | W2 | **FAIL, MINOR (G94c-02)** | section 5 |
| 6 | demo export on the simulated lane (G94b-06) | W1 | PASS | `EV-20261011-0012`: DEMO chip, destinations "(simulated)", result "Demonstration: no archive is written." and "DEMO export manifest (JSON). No archive exists for this item."; no "stored on the Core" |
| 7 | development mark on tiles and legend (G94b-07) | W2 | PASS | `-0016`: both tiles "Development source", legend "MIC 1 ... Development source / Test source", "MIC 2 ..." |
| 7 | the same | T, P | PASS as ruled | legend marks present; tiles none (header mark until Verify) |
| 7 | "no interval" at 0:00 (G94b-08) | W2 | PASS | `-0016` at "0:00 / 1:09": "Audio at the playhead: MIC 1" |
| 7 | the same | T | **FAIL, MINOR (G94c-04)** | `-0016`, playback opened and not started, "0:00 / 1:09": "Audio at the playhead: no interval" |
| 7 | interrupted item's end sentence (G94b-09) | W2 | PASS | `-0017`: "End of the sealed recording at 0:29: the recording was interrupted, so it ends here.", "0:29 / 0:31" |
| 7 | the same | T | **FAIL, MINOR (G94c-03)** | `-0017` at "0:29 / 0:31": no such element in the view tree (`shots/t_08`) |
| 8 | no `access.play`: control disabled, no failing press | T (TECHNICIAN) | PASS | `-0029`: Play `enabled=false`, "You are not permitted to play this recording."; the press writes nothing |
| 8 | operator change with the PLAYER open | T | PASS | supervisor plays `-0029` to 0:04, signs out (seq 730); technician signs in (733) and opens the SAME item first: no row until the sign-out (734) - 0 `ACCESS_DENIED` |
| 9 | B9 logcat | T | PASS | 09:36:05 - 10:07:13, 170,388 lines: 0 `FATAL EXCEPTION` / `ANR in`, 0 token shapes, **0 `ReactNativeJS` error lines**. Error-level lines of the app process: ExoPlayer "Playback error ... Source error ... InvalidResponseCodeException" once (09:43:03, the tamper demonstration, expected); `ExpoVideo` picture-in-picture x36; `MediaCodec` x24; emulator graphics lines (`EGL_emulation` x44, `SurfaceTexture ... EGLConsumer` x30, "Failed to query component interface" x12, `Surface` x4) |
| 9 | B9 logcat | P | PASS | 09:36:05 - 10:07:15, 106,792 lines: 0 fatal, 0 token shapes, 0 `ReactNativeJS` error lines; the one ExoPlayer playback error at 10:01:50 (tamper, expected); `ExpoVideo` x12, `MediaCodec` x12, graphics lines |
| 9 | mount warnings (limit D224 (2), counted, not judged) | T | 579 | by flow: `-0015` open + play 55; three seeks, `-0014` open and seek 257; renewal 45; `-0017` and `-0016` 61; tamper 0; export wizards 38 + 6 + 41; export 2 and close 20; sign-out, technician 56 |
| 9 | the same | P | 274 | investigator item 43; `-0020` play and seeks 65; `-0031` 111; tamper item 41 + 14 |

## 4. G94c-01 (= G94b-02, MAJOR): what the browser does, and why

Steps: W2, supervisor, `/evidence/EV-20261009-0005`, "Open playback", wait, Play.

| Time (UTC) | Seen |
|---|---|
| 02:29:57 | two `POST media-sessions` 201; both elements get `/media/mts_<91>`; range requests, all 206 |
| 02:29:59 - 02:30:15 | `VIDEO-01` `readyState 4`, 1280 wide; `VIDEO-02` `readyState 0`, `networkState 2`, no `error`, width 0. Panel: no alert, no note |
| 02:30:05.4 | the probe: `GET /media/mts_<91>`, `range: bytes=0-` -> 206, `content-range bytes 0-4287352/4287353`, `content-length 4287353`. NO second request follows |
| 02:30:15.4 | that request ends `net::ERR_ABORTED canceled=true`, exactly 10.0 s later (the probe's own time limit); console warning `[core-web] live` |
| 02:30:16 - 02:30:22 | Play: Camera 1 runs 0.95 -> 6.96 s. Under the Camera 2 tile: **"This file has not loaded."** `[role=alert]` elements in the panel: none (`shots/w2_01`) |
| 02:30:25 | end: "0:08 / 0:08", Play; "This file has not loaded." is gone; Camera 2 black, no word (`shots/w2_02`) |

Second run (open, click the scrubber at 80 %, Play): position 6 s, Camera 1 plays 6 -> 8.02 s and
ends; Camera 2 black; no alert, no note at any sample; no probe request in the log (the file ends
before the 4 s watch runs out).

Cause, measured with one media session of the helper for `VIDEO-02` (token never printed):

| Request `range: bytes=0-` | Answer |
|---|---|
| straight at the Core `127.0.0.1:4422` | 206, 2,257,425 bytes, the connection ends in 0.009 s (`curl` exit 18, transfer closed short) |
| through the web origin `127.0.0.1:5177` | 206, 2,257,425 bytes, then **nothing: the connection stays open**; `curl -m 12` gives up after 12.0 s (exit 28) |
| through the web origin, `range: bytes=2257425-` | 409 `MEDIA_NOT_AVAILABLE`, `reason FRAGMENT_NOT_AUTHENTIC, fileId VIDEO-02, seq 3` - correct |

So the Core cuts the stream as designed, and the web console's dev-server proxy does not pass the
cut on: the browser's read neither rejects nor ends. `probeMediaSession`
(`apps/core-web/src/features/evidence/media-session.ts:265-295`) waits in `drain`, is aborted by its
own 10 s timer and returns `UNKNOWN`; it never asks from the byte of the cut, so it never reads the
409. The player then words the file as "has not loaded". The component tests of note 141 model a
read that rejects or ends short; neither happens on this origin. Note 141 listed exactly this as
NOT PROVEN.

Spec: PE-WH-07 and note 127 section 9 - "the tampered item's VIDEO-02 stops with the integrity
sentence at the altered fragment, VIDEO-01 plays". Not met on the web.

What a fix has to hold (not designed here): the probe must reach the 409 even when a cut stream
hangs - for example a short idle limit on the read after which it asks from the bytes received, or
the Core's `ranges` / fragment table used to ask at the fragment starts directly. The sentence
"This file has not loaded." must also not vanish at the end of playback.

## 5. Findings of this re-check

| ID | Severity | What | Steps and evidence | Spec |
|---|---|---|---|---|
| **G94c-01** | **MAJOR** | G94b-02 is not closed: the web tamper demonstration still tells the operator nothing about integrity | section 4 | PE-WH-07; note 127 section 9 |
| G94c-02 | MINOR | Web: after an export the item reads "Status Exported" and "FINISHED EXPORTS: No finished export of this item." until the page is loaded again | W2, `EV-20261011-0032`: export `EXP-000037` Complete 09:34:01, Download, Close; read at once and again at 09:35:09: the same; after a reload "EXP-000037 · Package, Finished 11 Oct 2026 09:34:00, Download export" | PE-WH-13 (1); G94b-05 was fixed on mobile only |
| G94c-03 | MINOR | Tablet and phone: an interrupted recording still ends early in the player without a word (G94b-09 fixed on the web only) | T `EV-20261010-0017` "0:29 / 0:31"; P `EV-20261011-0031` "0:24 / 0:26"; no sentence in the view tree; the header names the interruption | the task's "plays its prefix and says so"; note 143 lists it as not taken |
| G94c-04 | MINOR | Tablet: "Audio at the playhead: no interval" at 0:00 (G94b-08 fixed on the web only) | T `-0016`, "Open playback", not started: `evidence-band-now` reads "no interval" beside "MIC 1, 0:00 to 0:28". Phone at 0:00 not read | ux 6.7 |
| G94c-05 | MINOR | Phone: after background / foreground the player stands still while its control and the action bar read "Pause"; the first press only turns the label to "Play", the second plays | P `-0020` playing at 0:18, Home 8 s, back: "0:19" at +1.5 s, +5 s and about 60 s later; tree: `evidence-sealed-toggle-playing`, `evidence-action-play-label-pause`; press: label "Play", still 0:19; press: 0:19 -> 0:23 (`shots/p_08`) | ux flow 5; the same class as the "renewal lost its Pause state" of note 145 |
| G94c-06 | MINOR | On a short item Play leaves the player half below the fold, and the tamper stop sentence out of view | T and P, `EV-20261009-0005` (no transcript): after Play the tab row is mid-screen, the tiles are cut by the action bar, the stop sentence and "Open again" need a swipe (`shots/t_09`, `p_13`, then `p_14`) | G94b-04; ux flow 5 step 1 |
| G94c-07 | NOTE | Phone, stopped tamper player: the screen never becomes idle for `uiautomator` ("could not get idle state" for minutes) - something keeps animating on a stopped player | P after the stop, 10:02 - 10:07 | - |

## 6. State of 13b's findings

| Finding | State |
|---|---|
| G94b-01 MAJOR | CLOSED (items 2) |
| G94b-02 MAJOR | **OPEN** (G94c-01) |
| G94b-03 | CLOSED (rows 724, 725 carry `DEV-0001`) |
| G94b-04 | CLOSED for items with a transcript, both halves; remainder G94c-06 |
| G94b-05 | CLOSED on the tablet; open on the web (G94c-02) |
| G94b-06 | CLOSED on W1. Phone on the simulated lane: not driven (lane 1 has no device) |
| G94b-07 | CLOSED: web tiles and legend; mobile legend; mobile tiles as ruled |
| G94b-08 | CLOSED on the web; open on the tablet (G94c-04) |
| G94b-09 | CLOSED on the web; open on tablet and phone (G94c-03) |
| G94b-10 | CLOSED: one WARNING row per stop on tablet and on phone; the phone sentence and time agree ("0:03") |
| G94b-11, -12 | CLOSED: "Case file transfer" pre-selected on web and tablet from the Core's default |
| G94b-13 | CLOSED: six badges painted |
| G89b-09 / D223 (1) | CLOSED on tablet and phone: disabled with its sentence, no row from a press |

## 7. Skipped / user-attended / what stays NOT PROVEN

| Item | State |
|---|---|
| Biometric offer after each device sign-in (tablet x2, phone x2) | skipped by the user's instruction (D151): "Not now" each time; no fingerprint touched |
| Local-device flows | none: no LOCAL_DEVICE source selected, pre-checked or started; no local-device media opened |
| Web tamper stop "refusal while playing through" as a mid-play event | NOT PROVEN as such: on this item `VIDEO-02` never becomes ready in Chrome, so there is no mid-play refusal to see; both runs are "the file never loads" |
| A drag of the scrubber thumb with a finger (note 145 re-drive 1) | NOT PROVEN: taps only |
| One-camera item on a device | NOT PROVEN: none on lane 2 |
| "no interval" at 0:00 on the PHONE | not read |
| Demo export on the phone on the simulated lane (G94b-06 phone half) | NOT PROVEN: lane 1 has no device |
| The explicit "Request authorization" path on a device, the export wizard from the tablet LIST's row menu | not reached: with `access.export false` no send control is offered on the item; the row menu did not open at my one tap (not judged) |
| Kill / stop during an export (G94-12), sign-out during playback, the "media session ended" sentence | not driven |
| `M8-CMP-1` | blocked: licence decision (user) |
| Suites, typecheck, lint | not run by me (not in this re-check) |
| New recording | none made |

## 8. Tooling lapses

- The headless browser saved the ONE download to the user's `~/Downloads` (the download-folder
  setting of my tool did not hold). I moved that one file, `DEMS-export-EXP-000037.zip`, into
  `.cache/gates/94c/exports/` at once; nothing else in that folder was touched.
- I cropped away my first stepper picture. To have the picture I made a SECOND tablet export
  (`EXP-000039` of `EV-20261011-0029`, rows seq 726-727). Lane 2 holds one export more than the
  task needed.
- A mis-scrolled list tap opened the export wizard on the tampered item on the tablet (closed
  before "Next"; audit unchanged at seq 723) and, on the phone, item `EV-20261011-0023` (no Play
  pressed, no row).
- My diagnostic of section 4 issued two media sessions through the API and wrote one WARNING stop
  row (seq 694-696).
- One tool output of mine printed an export's manifest hash and signature unmasked (public values
  of op 87; in no file and not in this report).
- The helper session expired twice after 15 minutes (rows seq 731, 749); signed in again each time.
- `cmd media_session` was not used; volume by key events only.

## 9. Screenshots (`.cache/gates/94c/shots/`) - every file kept was read; test-pattern frames only

| File | Shows |
|---|---|
| `w2_01_tamper_playing_not_loaded.png` | web tamper item playing at 0:07: Camera 1 colour bars, Camera 2 a black tile, development marks on both tiles and the legend, no alert |
| `w2_02_tamper_end_no_sentence.png` | the same at 0:08 / 0:08, Play: Camera 2 black, no sentence anywhere |
| `t_01_item0015_after_play.png` | tablet `-0015` after Play: player at the top of the pane, two test patterns, "Pause" in the player and the action bar, 0:02 / 1:00, band with two marked microphones |
| `t_02_item0015_seek25.png` | two frames after the 25 % tap: 0:14 and 0:18, both patterns changed |
| `t_03_item0015_seek50.png` | two frames after the 50 % tap: 0:30 and 0:34 |
| `t_04_item0015_seek90.png` | two frames after the 90 % tap: 0:56 and 0:59 |
| `t_05_item0014_seek25.png` | 296 s item after the 25 % tap: 1:11 and 1:15 of 4:56 |
| `t_06_item0014_70s_then_pause.png` | the same item 73 s later: 2:25 and 2:26, Pause |
| `t_07_item0014_paused_then_play.png` | paused at 2:26 with "Renewing the media session...", then 2:30 with Pause in both places |
| `t_08_item0017_seek50_then_end.png` | interrupted item: 0:17 after the 50 % tap, then 0:29 / 0:31 with Play and no end sentence |
| `t_09_tamper_stop.png` | tablet tamper item after the stop: facts card, tab row mid-screen, the two tiles cut by the action bar, the sentence not in view |
| `t_10_export_complete_badges.png` | tablet export sheet of `-0029`: six check badges, "Export accepted", EXP-000039, Complete, "Download from the web console." |
| `p_03_item0020_playing.png` | phone `-0020`: two test patterns stacked, Pause, 0:03 / 1:36, action bar Pause / Export / More |
| `p_04_item0020_seek30.png` | phone after the 30 % tap: 0:27 and 0:31 |
| `p_05_item0020_seek70.png` | phone after the 70 % tap: 1:09 and 1:13 |
| `p_06_item0020_past_ttl.png` | phone 84 s and 89 s after the session issue: 0:51 and 0:56, Pause |
| `p_08_background_foreground.png` | phone before Home 0:18; after the return 0:19 twice, control "Pause" |
| `p_13_tamper_stop.png` | phone tamper item after Play: facts card, tab row low on the screen, Camera 1 tile cut by the action bar |
| `p_14_tamper_scrolled.png` | the same scrolled: both tiles, the stop sentence, "Open again", 0:03 / 0:08 |

Seven further pictures whose text I had read from the DOM or the view tree were removed.

## 10. Environment as left (10:09)

| Item | State |
|---|---|
| Lanes | 1 RUNNING PID 52989, 2 RUNNING PID 70017 - neither restarted nor reset; web 5176 / 5177 answer 200; Metro, PostgreSQL, the stub untouched |
| Selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` (read after everything; never changed) |
| Session | none open; `session/current` = `SES-20261011-0043` SEALED; no recording made |
| Seal rig | OFF (`status` read only) |
| Lane 2 data | 31 items. Now `EXPORTED`: `EV-20261011-0032` (`EXP-000037`, downloaded once), `EV-20261010-0015` (`EXP-000038`), `EV-20261011-0029` (`EXP-000039`). Media-session rows on `-0005`, `-0001`, `-0014`, `-0015`, `-0016`, `-0017`, `-0020`, `-0029`, `-0031`; four WARNING stop rows on `-0005` (seq 693, 696, 723, 748). Alerts 29, active `ALR-000049` only. Audit chain `ok`, 751 rows, then my last sign-out |
| Lane 1 | `EV-20261011-0012` now `EXPORTED` (simulated `EXP-000032`); chain `ok`, 100 rows, then my sign-out; still no device |
| Devices | both signed out through the app, on Login, fields empty, "Core online", "paired as DEV-0001" / "DEV-0002"; `pairing/devices` both online; reverse rules `tcp:8081 -> 8081`, `tcp:4420 -> 4422` read back on both; media volume back as found (phone 5, tablet 4); no re-pairing, no lock change, no reboot, biometric not enabled |
| Helpers | every helper session signed out (204, then 401), no jar left; headless Chrome and the observer stopped, the profile removed; logcat readers stopped; no `capture-worker` / `ffmpeg` / `whisper` process |
| My files | only under `.cache/gates/94c/` (92 MB): `exports/DEMS-export-EXP-000037.zip` 45 MB; `work/negative_control.txt` (the tampered copy removed); `shots/` 19 pictures; `tools/`; `web_net_tamper.log` (tokens blanked at write), two logcats, `chrome_w2.log`. 0 token shapes in any of them |

For the fix: G94c-01 first (section 4 names the place and the measured cause); G94c-02 .. -06 are
the mobile / web halves of minors that were fixed on one client only. After the fix, the re-drive is
item 1 alone, in a real browser through the web origin.

---
*Generated: 2026-10-11 10:15 WIB*
