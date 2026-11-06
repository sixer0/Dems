---
task_id: 2026-10-07_dems_real_capture_sealing
row: 94 (M8 milestone gate - RE-GATE after fix waves H and I; independent +1 verification)
date: 2026-10-11 (run window 2026-10-10 23:41 - 2026-10-11 00:26 WIB)
agent: verifier (brief `delegation_progress/gate_brief_wave_g.md`; rules D94 / D122 / D163; D151; D230)
tree: 57b80a9 (`git diff --stat HEAD -- apps packages scripts` empty: the working tree differs in documentation only)
first_gate: gateway_check/13_m8_gate.md (FAIL, on f293221)
narrative_tier: 2
status: complete
verdict: FAIL
---

# 13b - M8 re-gate (row 94): evidence consumption

## 1. Verdict

**FAIL.** Every blocking item of the first gate is closed: the sealed player opens through the
product on web and tablet, the audio-source band draws, the download is one self-contained archive
that the receiver's command passes with nothing else, finished exports are listed on the item.
Two operator flows named by this gate do not hold, and one check could not be run:

| Blocking item | Short |
|---|---|
| **G94b-01 MAJOR** | Tablet: a seek never reaches the chosen position. Every seek gesture that the player answered (four taps on the scrub track, two of five drags of the thumb) left the playhead at **0:00**; playback then starts again from the beginning. `M8-PB-T` requires "seek works" |
| **G94b-02 MAJOR** | Web, tamper demonstration: the altered camera file (`VIDEO-02`) is a **black tile with no word**; Camera 1 plays to the end; no integrity sentence, no stop. Two runs, identical. The Core refuses correctly and writes its WARNING rows; the player tells the operator nothing |
| `M8-PB-P` NOT PROVEN | The phone is on lane 1, which holds no sealed (v2) item: the sealed player was never opened in the phone layout. Proven on the phone: the demo player, the "no playable media" state, the demo export |

`M8-CMP-1` stays **blocked: licence decision (user)**, unchanged.

Everything below was driven through the product's own surfaces. No harness rewrote an answer in
this gate (the first gate's section 4.1 is not repeated). One step is marked FORCED: a refused
media request was provoked by setting the video position from the page console.

## 2. Start state (23:41)

| Item | State |
|---|---|
| Tree | `57b80a9`; product folders identical to HEAD |
| Lanes | 1 RUNNING PID 49865 (4421 / web 5176, SIMULATED); 2 RUNNING PID 82871 (4422 / web 5177, REAL_DEVELOPMENT). Neither restarted nor reset by me |
| Lane 2 | selector `CAM-01`, `CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`; no session open; audit chain `ok`, 260 rows; one active alert `ALR-000016` (G75c-01, known); 22 items, 9 REAL (`EV-20261010-0014..-0022`), no export |
| Devices | both awake, unlocked, on Login, "Core online", "paired as DEV-0001", reverse rules 8081 and 4420 -> 4421 (phone) / 4422 (tablet); media volume 5 of 15 on both |
| Host | load 5.64 at the start, 1.98 at the end |

## 3. Entry condition - the BLOCKER / MAJOR items of the first gate

| Finding | State | Evidence of this run |
|---|---|---|
| G94-01 BLOCKER operation 40 never answers `LIVE_STREAM` | CLOSED | op 40 on every REAL item and both seed-sealed demo items: `media { source: LIVE_STREAM, fileIds: [VIDEO-01, VIDEO-02] }`; W2 "Sealed recording ... Open playback" opens two `video` elements on `/media/mts_<91>`; T opens the sealed player from Play |
| G94-02 BLOCKER bundled picture on a REAL item (mobile) | CLOSED on the tablet | `shots/t2_01_item0020_open.png`: the hero of a REAL item is empty; Play opens the sealed files (`t2_03`). Phone, simulated item: "This recording has no playable media on this Core.", Play disabled, no picture (`p1_01`) |
| G94-03 MAJOR the download is the zip only | CLOSED | section 6: the archive's last two entries are `export/EXP-<id>.manifest.json` / `.sig`; `npm run evidence:verify-export -- <archive>` PASS on the download alone |
| G94-04 MAJOR empty audio-source band | CLOSED | W2 `-0016`: "MIC 1 0:00-0:28, MIC 2 0:28-1:09"; "Audio at the playhead" changes from MIC 1 to MIC 2 between 25.3 s and 29.3 s of playback. T: the band of `-0020` and `-0017` |
| G94-05 MAJOR a finished export only from the dialog | CLOSED, with G94b-05 | W2 item page: "FINISHED EXPORTS, EXP-000032, Package, Finished ..., Download export" (`shots/w2_15_finished_exports_0016.png`); the press answers 200 with the archive length. T: "EXP-000033, Package ... Download from the web console." |

Review 93's items were confirmed at the first gate and are not re-read here.

## 4. Checks

Surfaces: W2 = web lane 2, T = tablet lane 2, P = phone lane 1, W1 = web lane 1, API = the Core
through the web origin with the seed operators' sessions. Tokens: prefix and length only.

### 4.1 Sealed player

| Check | Surface | Result | Evidence |
|---|---|---|---|
| M8-PB-W open, both files | W2 | PASS | `-0016` (69 s, one microphone switch): opening the page writes NO audit row and asks no media session. "Open playback" -> two `POST .../media-sessions` 201 (`cache-control: no-store`), two `video` elements, same-origin `/media/mts_<91 chars>`, 1280x720, duration 69.9 s, a moving test pattern in both (`shots/w2_02_item0016_player_opened.png`). No plaintext file URL: the only media requests are `/media/mts_...` with `Range` headers, answers 206 with `content-range`. First bytes served: `ftyp` (decrypted; the store holds ciphertext, gate 89) |
| M8-PB-W play, seek | W2 | PASS | play 0 -> 69.9 s, the two positions within 0.1 s; seeks to 0:17, 0:50, 0:09 followed by both files, playback continuing |
| track switch | W2, T | no such control | both camera files are shown side by side, one play / time / scrub control; the second element is muted (one embedded audio track). ux 6.6: "Two synchronised players + band" |
| band and switch intervals | W2, T | PASS, with G94b-08 | band from the manifest's intervals; the sentence under it follows the playhead across the switch. At 0:00 it reads "no interval" (G81b-10, judged in section 7) |
| transcript beside the player | W2, T | PASS as specified; it does not follow the playhead | segments with their times beside the player. No segment is marked while playing (no attribute or class changes on any segment over a whole playback). The ux spec asks no highlight (7.2 lists segments, states, revisions; 6.7 names only the band) - NOTE, not a finding |
| revised text | W2, T | PASS | `-0020`: segments 1-4 carry `data-revised=true`; each shows the sealed original first ("Sealed original - immutable"), then "Revision N, derived, not part of the sealed transcript, by <author>" and the revised text. Revision 4 shows its planted text "Berapa lama?" (G81b-01, known). T: the same lines (`evidence-transcript-original-N`, `evidence-transcript-derived-text-N`) |
| **play past the 60 s TTL** | W2 | **PASS** (first gate: NOT PROVEN) | `-0014` (295.9 s): 198 s of continuous playback, sampled every 10 s, never paused, no error (`web_ttl_0014.log`; `shots/w2_06_item0014_playing_past_ttl.png`, 3:17 / 4:56). The player asked a new pair of sessions at 55.3 s, 110.6 s and 165.8 s after the first (before each expiry); each renewal costs about 1 s of playhead (51.0 -> 60.1 over 10 s of wall time). No 4xx, no console line with a token. 8 audit rows for the 198 s |
| paused past the TTL, then Play or seek | W2 | PASS | Play 66 s after the last issue: two new sessions, playback resumes at the same position. Seek after expiry: the same |
| a refused request after expiry (FORCED) | W2 | PASS, with the known limit of G94-08 | position set from the console 66 s after the issue: two 403 answers; the player replaced both sources silently (two new sessions), stayed paused at its own position, showed NO integrity sentence; Play went on (0:03 -> 0:06). The browser's own console printed the refused, already expired path twice (`LOG.error`, `mts_<91>`): the limit note 123 section 5 states |
| a copied media URL | API | PASS | live token: owning session 206; another session of the SAME supervisor 403 `MEDIA_SESSION_INVALID`; investigator 403 `MEDIA_SESSION_INVALID`; no cookie 401 `NOT_SIGNED_IN`. 72 s after the issue, owning session: 403 `MEDIA_SESSION_EXPIRED`. Each refused use by a signed-in operator wrote one `ACCESS_DENIED` row (seq 272, 273) |
| interrupted item | W2, T | PASS, with G94b-09 | `-0017`: header and list row "Sealed - recording was interrupted, Cause: CAPTURE_FAULT" (both surfaces). Plays its prefix: stops at 29.6 s, paused, "0:29 / 0:31" (`shots/t2_13_item0017_end.png`). The PLAYER says nothing at the early end |
| speech item `-0020` | W2, T | PASS | plays (W2 6 s; T the whole 96 s); transcript and revisions as above |
| development mark | W2, T | PASS on the item; G94b-07 for the player | chip "Development source" on the list row and the header; Hash & Integrity: "Signed with a DEVELOPMENT key - not a production signature". The camera tiles read "Camera 1, sealed file" and the band legend "MIC 1" with no development mark |
| M8-PB-T open, play | T | PASS, with G94b-04 | supervisor, `-0020`: Play -> two media sessions (rows carry `DEV-0001`), both files play (`shots/t2_03_item0020_scrolled.png`: two test patterns, 0:30 / 1:36, Pause, band, transcript). The player opens BELOW the visible part of the pane: after the press the screen does not change (`shots/t2_01_item0020_open.png` before and after are the same picture) |
| play past the TTL | T | PASS for playback; the renewal is on demand by design | sessions issued 23:48:30; still playing at 23:49:41 (1:10) and 23:50:01 (1:30) (`shots/t2_04`, `t2_05`). No new session during plain playback (`sealed-player.tsx:16`: "renews ON DEMAND, never on a timer"); a renewal at the next Play / seek on a session at its end: seen three times (rows 287-288, 289-290, 291-292) |
| **seek** | T | **FAIL (G94b-01)** | section 5 |
| background / foreground | T | PASS | playing at 0:04, Home for 8 s, back: paused at 0:04 with both pictures (`shots/t2_10_after_foreground_4s.png`); no session asked, no error line |
| rotate | T, P | not specified | ux flow 5 names no rotation behaviour; not driven |
| M8-PB-P | P | **NOT PROVEN** | lane 1 has no v2 item (13 seed items + 2 simulated sessions). Proven on the phone: section 4.5 |
| logcat (B9) | T | PASS for errors; **380** mount-warning lines | cleared 23:47:11, read 00:13: 137 076 lines, 0 `FATAL EXCEPTION` / `ANR in`, 0 token shapes. Error lines of the app process: ExoPlayer `Source error ... Response code: 409` x2 (the tamper demonstration, expected), `ExpoVideo: Current activity does not support picture-in-picture` x20, emulator graphics lines (`EGL_emulation`, `SurfaceTexture ... EGLConsumer`), `MediaCodec: Media Quality Service not found` x18. `Unable to find SurfaceMountingManager` (G89b-03): **380 lines** over the player and export flows - by minute 23:48 85, 23:54 37, 23:56 6, 00:07 130, 00:08-00:13 122 |
| logcat (B9) | P | PASS | cleared before the sign-in: 20 258 lines, 0 fatal, 0 token shapes, 10 mount-warning lines |

### 4.2 Access and audit

`access` of operation 40 on a REAL item: SUPERVISOR `play, readTranscript, export`; INVESTIGATOR
(the holder) `play, readTranscript`; TECHNICIAN none (outside the case scope). Seed-sealed demo
items: `play` and `readTranscript` true for all three.

| Check | Surface | Result | Evidence |
|---|---|---|---|
| `access.play` on the controls | W2, T | PASS | TECHNICIAN on `-0016` (W2) and `-0021`, `-0019` (T): Play and "Open playback" DISABLED, "You are not permitted to play this recording." (`shots/t2_24_item0021_technician.png`). INVESTIGATOR: enabled |
| `access.readTranscript` | W2, T | PASS on a first view; G81b-02 reproduced once | TECHNICIAN: "You are not permitted to read this transcript."; W2 sent no operation 84 / 86 and no row was written. T, item never opened in that app run (`-0019`): no row. T, item the previous operator had opened (`-0021`): two `ACCESS_DENIED` rows (seq 351, 352; known, wave K) |
| a permitted view | W2, T | PASS | opening an item writes no row on either surface. One `EVIDENCE_MEDIA_SERVED` row per media-session issue ("Media session opened for VIDEO-0N", `bytesServed 0`, `signed true`, `expiresAt`), i.e. two per open and two per renewal; no row per range (the 166 range requests of the first open and playback wrote none). Tablet rows carry `DEV-0001` |
| `access.export` on the controls | W2, T | NOT disabled - by the wizard's design; judged in section 7 (G89b-09) | TECHNICIAN on W2: Export opens the wizard, step 2 states "Technician, Export requires EVIDENCE_EXPORT (Supervisor)", "Request authorisation" -> "Export not permitted ... recorded in the audit log", ONE `EXPORT_DENIED` row (seq 330), item unchanged. INVESTIGATOR on T: the press itself shows "Your role cannot export ..." and writes ONE `EXPORT_DENIED` row with `DEV-0001` (seq 348) |
| a refused action writes its row | API, W2, T | PASS | op 88 as TECHNICIAN on a REAL item: 403 `NOT_PERMITTED`, one `ACCESS_DENIED` `EVIDENCE_CASE_SCOPE` (seq 362); the refused media and download uses below; the two `EXPORT_DENIED` rows |
| case scope | API, T | PASS | INVESTIGATOR (holder) op 88: 201. TECHNICIAN: 403. T, TECHNICIAN on the clean seed-sealed item `EV-20261008-0001`: plays to 0:08 / 0:08, two session rows, no denial (PE-WH-02) |

### 4.3 Export

| Check | Surface | Result | Evidence |
|---|---|---|---|
| reason field | W2, T | PASS | W2: empty and "abcd" stay on step 1, "Enter a reason of at least 5 characters."; T: the same sentence and Export DISABLED |
| REAL item's dialog | W2, T | PASS (G94-09 closed) | no DEMO chip, no "(simulated)", "The export is stored on the Core server. The destination is recorded with it; nothing is sent to it from here." |
| export of the clean item | W2 | PASS | `-0016`, supervisor: Authorised -> "PASS, Verified by the Core server" -> "Accepted, EXP-000032", "Export job EXPJ-000032, Running, Package, 0% done" -> "Complete" about 2 s later with the manifest hash and signature and "Download export". Item `EXPORTED`. Row seq 332 `EVIDENCE_EXPORTED` `{kind: PACKAGE, reason, exportId, destination}` (G94-10 closed) |
| export of the revised speech item | W2 | PASS | `-0020`: `EXP-000033`, Complete within 5 s; row seq 341 |
| progress | W2 | PASS as built | only "0% done" and "Complete" were ever shown (jobs last 0.4-5 s here) |
| `exports[]` | API, W2, T | PASS | op 40 for the supervisor: `exportId, jobId, kind, completedAt, exportedBy, archiveBytes, archiveSha256`; the investigator's and technician's answers carry no `exports` member |
| signed download | W2 + API | PASS | W2 "Download export" (dialog, then the item's list): `GET /exports/exs_<95 chars>` 200, `content-length 69580032`. My headless browser discards downloads, so the kept files were fetched with the link operation 87 gives (`download.path`, TTL 60.0 s): 200, `content-type application/zip`, `content-disposition: attachment; filename="DEMS-export-EXP-000032.zip"`, `cache-control: no-store` |
| the link's binding | API | PASS as specified - the link is NOT single use | same link again inside its 60 s, same session: **200** (`download-token.ts`: "A token is not single-use ... until `expiresAt`"; C3 section 7 "replay window = this TTL"). Another session of the same supervisor: 403 `EXPORT_DOWNLOAD_INVALID`; investigator: 403 (role); no cookie: 401; 66 s after the issue, owning session: 403 `EXPORT_DOWNLOAD_EXPIRED`. Refused uses by signed-in operators: `ACCESS_DENIED` rows seq 337, 338 |
| the archives | file | kept | `.cache/gates/94b/exports/DEMS-export-EXP-000032.zip`, 69 580 032 bytes, sha256 `6426eb0ce9531c24348f2128fc76f999b42f23c1d498e06dc1f95f6598ac08c4`; `DEMS-export-EXP-000033.zip`, 96 935 298 bytes, sha256 `94f1ae3f6c13f50adb65b1150e07658c6164f96c423f2a250ab38cd73ccff561`. Each equals `archive.sha256` of operation 87, `archiveSha256` of operation 40 and `details.archiveSha256` of its download row. 13 entries each, the export manifest and signature last |
| M8-EXP-1 receiver's command | CLI | **PASS** (first gate: FAIL) | `npm run evidence:verify-export -- <archive>` on each download alone: X-01..X-07 PASS, "development sources: yes", "anchored: no - no --trust given", `RESULT: PASS`. With `--sha256 <the Core's value>`: "compared with the given value", PASS. With `--trust <certificateSha256 of the export manifest>` and `--sha256`: "anchored: yes", PASS |
| negative controls | CLI, on copies | PASS, 14 of 14 fail on a named check | section 6 |
| export from the tablet | T | PASS, with G94b-03, G94b-05 | `-0022`, supervisor: Authorized -> Verify source -> Destination -> Reason -> "Export accepted", "Export job EXPJ-000034 Complete Package", "The export is stored on the Core (EXP-000034). Download from the web console.", "No file is sent to this tablet." (`shots/t2_21_export_done.png`) |
| export audit rows | audit | PASS for content; G94b-03 for the sending device | request, download and failure rows as the first gate read them, plus `kind` and `archiveSha256`. No token, no key in any row |
| after the export | API | PASS | op 41 on `-0016`: overall PASS; status `EXPORTED`; custody ends with the download entries |

### 4.4 Tamper demonstration (`EV-20261009-0005`, `VIDEO-02` fragment 3)

| Check | Surface | Result | Evidence |
|---|---|---|---|
| the Core | API | PASS | ranges starting in fragment 3 (`2257425-`, `2359296-`, `3244032-`): 409 `MEDIA_NOT_AVAILABLE`, `reason FRAGMENT_NOT_AUTHENTIC, fileId VIDEO-02, seq 3`. `2228224-` (just before it): 206 and exactly 29 201 bytes, ending at the fragment's start - no byte of the failed fragment is sent. Fragment 4 is served (206). One WARNING row per stopped stream: "Media stream stopped: VIDEO-02 fragment 3 (FRAGMENT_NOT_AUTHENTIC)" |
| the player | T | PASS, with G94b-10 | both files play, then stop; "Playback stopped at 0:03 and did not resume. A recording that fails its integrity check stops at the failed fragment: run Verify to see which.", "Open again", Play disabled (`shots/t2_16_tamper_after.png`). The untampered file stops with it. The sentence does not name the file or fragment; Verify does (gate 89) |
| the player | W2 | **FAIL (G94b-02)** | section 5 |

### 4.5 Simulated lane 1

| Check | Surface | Result | Evidence |
|---|---|---|---|
| demo item | W1 | PASS | `EV-20261010-0013`: chip "DEMO package", "DEMO media - bundled with this application, not a recording of this Core", "DEMO excerpt: each track is a 0:34 clip ...", `data-playback=bundled` |
| simulated session item | W1 | PASS | `EV-20261010-0015`: "No DEMO media", "No DEMO package for this item: the Core server's record only.", no player; transcript "This is a simulated item: the Core server keeps no transcript for it." |
| demo export | W1 | PASS, with G94b-06 | dialog with the DEMO chip and three destinations "(simulated)"; result "DEMO export manifest (JSON). No archive exists for this item." (`shots/w1_02_demo_export_done.png`); op 40 lists no export, op 87 has no `download` member |
| demo item | P | PASS | "DEMO media - bundled with this application, not a recording of this Core"; Play Camera 1 opens "Evidence player" with the chips "Bundled demo package" and "DEMO excerpt", the stock demo picture with "DEMO" in its caption, time advancing (picture read, not kept) |
| simulated session item | P | PASS | "This recording has no playable media on this Core.", "No sealed package of this item is in the evidence store of this Core.", Play disabled (`shots/p1_01_sim_item_no_media.png`) |
| demo export | P | PASS, with G94b-06 | destinations "(simulated)"; "Export accepted", "The Core recorded this export. No file is sent to this tablet." |

### 4.6 Spot checks of what the first gate passed (one run each)

| Check | Result | Evidence |
|---|---|---|
| M8-RNG-1 | PASS | `-0016` `VIDEO-01`: `bytes=0-99` 206 `0-99/35118626`; `1000000-1000999` 206; `bytes=-17` 206 `35118609-35118625`; `999999999999-` 416 `bytes */35118626`; headers `video/mp4`, `accept-ranges: bytes`, `cache-control: no-store`, `cross-origin-resource-policy: same-origin`, `referrer-policy: no-referrer` |
| M8-EV-SCOPE-1 | PASS | section 4.2 |
| 409 while one runs | PASS | two requests at once on `-0014`: `202 {EXP-000035, QUEUED}` and `409 EXPORT_IN_PROGRESS` |
| M8-CMP-1 | NOT PASSED - blocked: licence decision (user) | `-0019`, `kind: COMPOSITE`: job FAILED, row `EVIDENCE_EXPORT_FAILED {COMPOSITE, COMPOSITE_ENCODER_NOT_SELECTED}`; item stays SEALED |
| M8-BLK-1 | PASS | `grep -cE '(mts\|exs)_[A-Za-z0-9_-]{16,}'` = 0 in: Core logs lane 1 and 2, Vite logs lane 1 and 2, Metro log, both logcats, the headless browser's own log. Page URL and storage: no token. The `video` element's `src` holds the live path (known) |
| M8-XAU-1 | PASS | rows of this gate (seq 261-370): 65 `EVIDENCE_MEDIA_SERVED`, 11 `EVIDENCE_EXPORTED`, 1 `EVIDENCE_EXPORT_FAILED`, 2 `EXPORT_DENIED`, 7 `ACCESS_DENIED`, 4 `EVIDENCE_VERIFIED`, sign-ins / expiries / sign-outs; chain `ok` at 370 |
| Sign-out during playback | not re-run | first gate PASS; the player files changed in wave H |

## 5. Findings of this re-gate

| ID | Severity | What | Steps and evidence | Spec |
|---|---|---|---|---|
| **G94b-01** | **MAJOR** | Tablet sealed player: no seek reaches its target; the playhead goes to (or stays at) 0:00 | T, supervisor, `-0020` (96 s). (1) after the end, tap on the scrub track at about 21 s: two new media sessions at that instant (rows 287-288, so the tap reached the player's `seekTo`), time "0:00 / 1:36" (`shots/t2_06_item0020_seek_after_ttl.png`). (2) tap at about 48 s inside a live session: "0:00"; Play then ran 0:00 -> 0:05. (3) with the session expired, tap at 48 s: two new sessions (rows 289-290), "0:00" - the position was 0:05 before. (4) tap at 71 s, live session: "0:00"; Play ran 0:00 -> 0:04. (5) five drags of the thumb (`input swipe` 0.6-2 s, explicit down / move / up, `draganddrop`): the first three changed nothing and asked no session although the session had expired; the fourth put 0:04 back to "0:00"; the fifth left it there. Cause NOT established - two hypotheses, neither verified: the kit Slider's tap hands over the value 0, or the Android player cannot seek in these fragmented files and restarts. A finger was not available to me; the taps are real touch events and did reach the handler | `M8-PB-T`: "same on emulators" as `M8-PB-W` "seek works"; ux flow 5 |
| **G94b-02** | **MAJOR** | Web tamper demonstration: the altered file is a black tile, nothing is said | W2, supervisor, `EV-20261009-0005`, Open playback, Play - twice. `VIDEO-02`: `readyState 0`, `networkState 2`, no `error`, no size, from the open to the end; `VIDEO-01` plays 0 -> 8.0 s; the panel holds no alert, no stop sentence, no "Open again" (test ids of the panel: the two videos, toggle, time, scrub, band only) (`shots/w2_09_tamper_stopped.png`). Audit: WARNING rows "Media stream stopped: VIDEO-02 fragment 3 (FRAGMENT_NOT_AUTHENTIC)" (seq 315, 316). The tablet shows the integrity sentence for the same item | PE-WH-07 and note 127 section 9: "the tampered item's VIDEO-02 stops with the integrity sentence at the altered fragment, VIDEO-01 plays" |
| G94b-03 | MINOR | An export sent from the tablet, and the tablet's verify before it, carry no sending device | T export of `-0022`: seq 344 `EVIDENCE_VERIFIED` and seq 345 `EVIDENCE_EXPORTED` have `deviceId: null`. The same tablet's media rows, its sign-in and its `EXPORT_DENIED` row (seq 348) carry `DEV-0001` | D216 (2); G89b-04 (verify rows) - the export row is new |
| G94b-04 | MINOR | Tablet: Play starts the sealed player below the fold | T, any REAL item, Play in the action bar: two sessions are issued and playback starts, the visible screen does not change; the player is one swipe further down. The action bar keeps reading "Play" while it plays | ux flow 5 step 1 |
| G94b-05 | MINOR | Tablet: after an export the item says "Exported" and "No finished export of this item." | T, `-0022`: close the sheet after Complete -> status chip "Exported", section "FINISHED EXPORTS: No finished export of this item."; still so 3 s later; correct ("EXP-000034, Package ... Download from the web console.") after another item was opened and this one again. Not checked on the web (I navigated) | PE-WH-13 (1) |
| G94b-06 | MINOR | Simulated lane: the export result says "The export is stored on the Core (EXP-0000NN)." | W1 `EV-20261010-0012` and P `EV-20261010-0011`: the sentence stands beside "No archive exists for this item." (web); op 40 lists no export, op 87 has no `archive` and no `download`. The phone sheet has no DEMO chip (the destinations read "(simulated)") | check 6 of the task: no claim of a sealed package where there is none; G94-09 family |
| G94b-07 | MINOR | No development mark on the camera tiles and the band legend of the sealed player | W2, T: "Camera 1, sealed file", "MIC 1 0:00-0:28"; the mark is on the row, the header and Hash & Integrity only | ux 6.6 row PE-125-06: "on each camera file recorded from a development source; band segments of a development microphone carry it in their legend" |
| G94b-08 | MINOR | "Audio at the playhead: no interval" at 0:00 (G81b-10, judged) | the first interval of the manifest starts at `fromMs 21` (`-0016`), the legend beside it reads "MIC 1 0:00-0:28". Both clients; it corrects itself in the first second of playback | ux 6.7 |
| G94b-09 | MINOR | The interrupted recording ends early in the player without a word | `-0017`: "0:29 / 0:31", paused, no sentence; the header names the interruption | the task's "plays its prefix and says so"; D207 names list row and header only |
| G94b-10 | NOTE | Tablet tamper stop: "stopped at 0:03" beside the time "0:04"; one stop wrote four WARNING rows (the player asked the refused place three more times, seq 303-306) | `shots/t2_16_tamper_after.png` | PE-WH-04 "ONE row when serving stops" |
| G94b-11 | NOTE | An export request without a destination is recorded as "Case file transfer (simulated)" on the real-capture lane | API requests seq 364, 365. The clients always send one | G94-09 family |
| G94b-12 | NOTE | Default destination differs: web "Case file transfer", tablet and phone "Encrypted USB drive" | sections 4.3, 4.5 | - |
| G94b-13 | NOTE | The tablet export sheet draws only the first stepper badge as done at Complete (G94-13 second half, unchanged) | `shots/t2_21_export_done.png` | - |

## 6. Receiver's command - negative controls (copies only; each copy removed after its run)

Tool output kept in `.cache/gates/94b/negative_controls.txt`. Exit status 1 for every case.

| # | Change on a copy | Archive | Checks that FAIL (as the tool names them) |
|---|---|---|---|
| 1 | one byte flipped in `fragments/VIDEO-01.mp4` | EXP-000032 | X-04 `ENTRY_HASH_MISMATCH:fragments/VIDEO-01.mp4`; X-06 `PLAINTEXT_HASH_MISMATCH:VIDEO-01`, `FRAGMENT_PLAINTEXT_MISMATCH:VIDEO-01:15` |
| 2 | one byte flipped in `session-manifest.json` | 32 | X-04 `ENTRY_HASH_MISMATCH`; X-05 `V-03:FAIL:MANIFEST_HASH_MISMATCH`, `SESSION_MANIFEST_NOT_THE_EXPORTED_ONE`, `DEVELOPMENT_MARK_MISMATCH` |
| 3 | one byte flipped in the export manifest | 32 | X-01 `EXPORT_MANIFEST_HASH_MISMATCH` |
| 4 | one byte flipped in `transcript/transcript.json` | 32 | X-04 `ENTRY_HASH_MISMATCH`; X-05 `V-10:FAIL:TRANSCRIPT_HASH_MISMATCH` |
| 5 | 1 000 000 bytes cut out of `fragments/VIDEO-02.mp4` | 32 | X-04 `ENTRY_HASH_MISMATCH`; X-06 `PLAINTEXT_HASH_MISMATCH:VIDEO-02`, `FRAGMENT_PLAINTEXT_MISMATCH:VIDEO-02:14` and every later fragment |
| 6 | `fragments/VIDEO-02.mp4` removed | 32 | X-04 `ENTRY_MISSING`; X-05 `V-14:FAIL:DECLARED_FILE_MISSING`; X-06 `CAMERA_FILE_MISSING:VIDEO-02` |
| 7 | `transcript/notes.txt` added | 32 | X-04 `UNEXPECTED_ENTRY:transcript/notes.txt`; X-05 `V-14:FAIL:UNEXPECTED_FILE` |
| 8 | `export/extra.bin` added | 32 | X-04 `UNEXPECTED_ENTRY:export/extra.bin` |
| 9 | `README.txt` added at the top level | 32 | X-04 `UNEXPECTED_ENTRY:README.txt`; X-05 `V-14:FAIL:UNEXPECTED_FILE` |
| 10 | one byte flipped inside a revised text of `transcript-revisions.json` | 33 | X-04 `ENTRY_HASH_MISMATCH`; X-05 `V-11:FAIL:REVISION_BODY_HASH_MISMATCH` |
| 11 | the LAST revision removed (4 -> 3) | 33 | **X-04 `ENTRY_HASH_MISMATCH:transcript/transcript-revisions.json` only** |
| 12 | ALL revisions removed (4 -> 0) | 33 | **X-04 `ENTRY_HASH_MISMATCH:transcript/transcript-revisions.json` only** |
| 13 | untouched archive, wrong `--sha256` | 32 | X-03 `ARCHIVE_HASH_MISMATCH` |
| 14 | untouched archive, wrong `--trust` | 32 | X-02 `EXPORT_CERTIFICATE_NOT_TRUSTED`; X-05 `V-13:FAIL:CERTIFICATE_NOT_TRUSTED`, `DEVELOPMENT_MARK_MISMATCH`; "development sources: not established" |

Two exact statements:

- **G89b-02 in an export.** A shortened revision list IS caught, by the EXPORT manifest: the
  revisions file is one of `package.entries` with its own hash, so cases 11 and 12 fail X-04. The
  sealed package's own checks (X-05, V-11) still pass for a shortened list, as gate 89 found for
  the folder. An export therefore pins the revision list as it was at export time; the package
  folder alone does not.
- **`EXPORT_FOLDER_UNEXPECTED_FILE`** is not a code of the receiver's command (the name occurs
  only in `evidence-verify/__tests__/fix-m7b-export-notice.test.ts`). An added file is named
  `UNEXPECTED_ENTRY:<path>` under X-04, plus `V-14 UNEXPECTED_FILE` when it lies in the package's
  part of the archive.

## 7. The two findings handed to this gate

| Finding | Judgement |
|---|---|
| **G89b-09** Export enabled where `access.export` is false | Not disabled on any client. This is the export flow's own design, older than this task: `export-wizard.tsx:80-82` ("a role without EVIDENCE_EXPORT gets the danger Alert and an EXPORT_DENIED audit row, section 19.3 rule 2") and ux 5 row G8 (`403 EXPORT_DENIED`). What happens: web - the wizard states the required role BEFORE anything is sent, the request is refused, one `EXPORT_DENIED` row, item unchanged; tablet - the press itself sends the request and writes the WARNING row at once, with no statement before it. No export, no custody entry, no file. **For a ruling:** if the rule "disabled with a reason, not a failing press" is to hold for export as it does for Play, both clients change; if the audited attempt is wanted, the tablet should at least state the requirement before it sends, as the web does |
| **G81b-10** "no interval" at 0:00; two media rows on open with nothing played | (a) reproduced on web and tablet: G94b-08, cosmetic, the data's first interval starts at 21 ms. (b) NOT a defect as specified: opening an ITEM writes no row on either client; the two rows are written when the operator presses "Open playback" / Play, one per media-session issue, and say "Media session opened" (PE-WH-04: "ONE row per media-session ISSUE ... so no token exists that the trail does not know of"). A web operator who opens playback and never presses Play does leave two such rows |

## 8. Regression and quality (`M8-RG-*`, `M8-QA-1`) - mapped, nothing re-run by me

| Check | State | Source |
|---|---|---|
| typecheck and lint, 7 workspaces | GREEN | `test/09_precommit_wave_i.md` rows 1a-g, 2a-g |
| shared 2570, capture-protocol 31, core-server unit 6517, core-web 2069, transcriber 561, mock-core 19 | GREEN | `test/09` rows 3-8b |
| core-server db | 2 files / 3 tests RED in 09, then green | 09 row 5: 2419 passed, 3 failed (stale pins); `implementation/138_pin_moves_wave_i.md`: the two files re-run, `51 passed` |
| mobile | 1 test RED in 09, then green | 09 row 7: 2692 passed, 1 failed; 138 section 3: the suite re-run, `10 passed` |
| seal e2e 3, kill matrix 35 of 35, development-session e2e 2 + 2 skipped, contract guards | GREEN | 09 rows 9-12c |

Limits, stated: the whole db and mobile suites were NOT run again after 138's three test-file
changes (138 re-ran the three files only); I did not compare 09's tree with `57b80a9` file by
file; I ran no suite. The M8 unit files of the first gate's entry run were not re-run.

## 9. First-gate findings: state

| Finding | State |
|---|---|
| G94-01, -02, -03, -04, -05 | CLOSED (section 3). G94-01 / -02 in the PHONE layout: not proven (no v2 item on lane 1) |
| G94-06 117 rows per open | CLOSED: 2 rows per open, 2 per renewal; 8 rows for 198 s of playback |
| G94-07 TTL stop worded as an integrity failure | CLOSED: no integrity sentence on expiry in any run; a refused request was recovered silently. The sentence "media session ended" itself was never produced |
| G94-08 browser prints the signed path | CLOSED with its stated limit: no product flow produced a refused request; the forced one was printed twice by the browser (expired path) |
| G94-09 DEMO chip on a REAL item's export dialog | CLOSED on the clients; remainders G94b-06, G94b-11 |
| G94-10 no `details.kind` | CLOSED |
| G94-11 archives accumulate | as ruled (kept, listed). Lane 2 now holds four: `EXP-000032` 69.6 MB, `-33` 96.9 MB, `-34` (tablet), `-35` 302.0 MB; store 1.2 GB |
| G94-12 a stop lets an export finish | NOT RE-DRIVEN: needs a lane stop inside a job of 0.4-5 s; tests only (`wave-h-c1.test.ts`) |
| G94-13 first tap / stepper badges | first-tap half not met in my flows (overlays answered first); badge half unchanged (G94b-13) |
| G94-14 "No DEMO media" on a REAL item | CLOSED |
| NOT PROVEN of the first gate | renewal in plain playback (web): PROVEN. Mobile sealed player on a device: PROVEN on the tablet except seek. `M8-REV-1` live: revisions shown as derived on web and tablet, and an export with four revisions passes V-10 / V-11 (the sealed transcript's hash unchanged). Phone, one-camera item, kill during an export, the 409 wording in a UI: still not proven |

## 10. Skipped / user-attended / not covered

| Item | State |
|---|---|
| Biometric offer after each device sign-in (tablet x3, phone x1) | skipped by the user's instruction (D151): "Not now" each time; no fingerprint touched |
| Local-device flows | none: no LOCAL_DEVICE source selected, pre-checked or started; no local-device media opened |
| `M8-PB-P` on a sealed item | NOT PROVEN (lane 1 has none; no re-pairing was allowed for) |
| One-camera item; kill / stop during an export (G94-12); sign-out during playback | not driven (no rig / a lane stop / not re-run) |
| "media session ended" sentence and its Play (web and tablet) | not produced |
| Rotation | not specified for the player; not driven |
| Server STT backend, STT speed | not touched (D230) |
| Physical-device playback | class C |
| New recording | none made |

## 11. Tooling lapses

- Two "expiry" probes of mine ran BEFORE the expiry. The media one answered 206 (100 bytes); the
  export one downloaded the archive again and my tool printed the start of it (audit-extract lines
  and the public development certificate; no token, no secret). Both were repeated correctly.
- `EXP-000032` carries FIVE "downloaded" audit rows and custody entries for one kept file: two
  browser downloads the headless browser discarded, the kept one, the replay check, the early probe.
- `adb shell cmd media_session volume --stream 3 --set 0` did not change the volume (it still read
  5). I muted with volume-down key events instead (reading 0, `Muted: true`) before any device
  playback, and raised it back to 5 with volume-up key events at the end.
- One empty "Sign In" press on the phone (validation sentences only).
- The demo-operator list's control ids appeared in my own tool output; none is in this report.

All playback was muted: web in a headless browser started with `--mute-audio`; devices at media
volume 0 as above.

## 12. Screenshots (`.cache/gates/94b/shots/`) - every file kept was read

| File | Shows |
|---|---|
| `w2_02_item0016_player_opened.png` | web item `-0016`: two colour-bar test patterns "Camera 1 / 2, sealed file", 0:00 / 1:09, band MIC 1 0:00-0:28 and MIC 2 0:28-1:09, "no interval" |
| `w2_06_item0014_playing_past_ttl.png` | web `-0014` playing at 3:17 / 4:56, both patterns, band, transcript with Revise buttons |
| `w2_09_tamper_stopped.png` | web tamper item at 0:08 / 0:08: Camera 1 pattern, Camera 2 a black tile, no message |
| `w2_15_finished_exports_0016.png` | web `-0016` "Exported", "FINISHED EXPORTS, EXP-000032, Package", "Download export" |
| `w1_02_demo_export_done.png` | lane 1 export dialog: DEMO chip, Complete, "The export is stored on the Core", "DEMO export manifest (JSON). No archive exists for this item." |
| `t2_01_item0020_open.png` | tablet `-0020`: empty hero, "Development source", facts, "No finished export", Play / Export / More |
| `t2_03_item0020_scrolled.png` | tablet sealed player: two test patterns, Pause, 0:30 / 1:36, band, transcript |
| `t2_04_item0020_past_ttl_a.png`, `t2_05_item0020_past_ttl_b.png` | the same playing at 1:10 and 1:30 |
| `t2_06_item0020_seek_after_ttl.png` | tablet after a seek tap: Play, 0:00 / 1:36, "no interval" |
| `t2_10_after_foreground_4s.png` | tablet after background / foreground: paused at 0:04 |
| `t2_13_item0017_end.png` | tablet interrupted item at 0:29 / 0:31, list rows "Sealed - recording was i..." |
| `t2_16_tamper_after.png` | tablet tamper item: the integrity sentence, "Open again", Play greyed, 0:04 / 0:08 |
| `t2_21_export_done.png` | tablet export sheet: "Export accepted", EXP-000034, Complete, "Download from the web console." |
| `t2_24_item0021_technician.png` | tablet as technician: "You are not permitted to play this recording.", Play greyed, Export enabled |
| `p1_01_sim_item_no_media.png` | phone simulated item: "This recording has no playable media on this Core.", Play greyed |

Thirty further screenshots whose text I had read from the DOM or the view tree, and the one
picture of the bundled demo media, were removed.

## 13. Environment as left (00:26)

| Item | State |
|---|---|
| Lanes | 1 RUNNING PID 49865, 2 RUNNING PID 82871 - neither restarted nor reset; web 5176 / 5177, Metro, PostgreSQL, the stub and its preset untouched |
| Lane 2 selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` - never changed |
| Lane 2 session | none open; `session/current` = `SES-20261010-0033` SEALED; no recording made |
| Lane 2 items | `-0014`, `-0016`, `-0020`, `-0022` now `EXPORTED` (`EXP-000035`, `-32`, `-33`, `-34`); `-0019` carries one failed COMPOSITE request (`EXP-000036`), still SEALED. Many "media session", "downloaded" and "verified" custody / audit entries on the items I opened |
| Lane 2 audit | chain `ok`, 370 rows at 00:24, then my four sign-outs; `ALR-000016` still the one active alert |
| Lane 1 | `EV-20261010-0012` and `-0011` now `EXPORTED` (simulated exports `EXP-000032`, `-33`); chain `ok`, 161 rows, then one sign-out |
| Devices | both signed out, on Login, "Core online", "paired as DEV-0001", reverse rules intact; media volume 5 on both (as found); no re-pairing, no lock change, no reboot, biometric not enabled |
| Helpers | every helper session signed out (204, then 401), jars removed; headless browser and observer stopped, profile removed; no `capture-worker` / `ffmpeg` / `whisper` process |
| My files | only under `.cache/gates/94b/` (194 MB): `exports/` two archives, 159 MB; `work/` the tool outputs of the 12 tampered copies, 48 kB (the copies themselves removed); `shots/` 16 pictures; `tools/`; logs (`web_net_A.log` tokens blanked at write, two logcats, `negative_controls.txt`) |

For the fix wave: (1) G94b-01 needs a decision on the cause first - read the slider value and the
player's answer at one tap; (2) G94b-02: the web player has no path for a file that never becomes
ready; (3) after both, this gate's tablet seek, the web tamper run and the phone's sealed player
are what remain to drive - the phone needs a lane with a v2 item.

---
*Generated: 2026-10-11 00:40 WIB*
