---
task_id: 2026-10-07_dems_real_capture_sealing
row: 94 (M8 milestone gate - independent +1 verification)
date: 2026-10-10
agent: verifier (brief `delegation_progress/gate_brief_wave_g.md`, D193; rules D94 / D122 / D163; D151)
tree: f293221 (product code unchanged: `git log -1` of the M8 folders = f293221; working tree differs in documentation only)
narrative_tier: 2
status: complete
verdict: FAIL
---

# 13 - M8 gate (row 94): media streaming, export, playback UI

## 1. Verdict

**FAIL.** The server half of M8 works live on a product-sealed item (signed media session, Range
serving, case scope, export job, signed download, blanking). The milestone's operator flows do not:

| Blocking item | Short |
|---|---|
| **G94-01 BLOCKER** | No client can open the sealed player: operation 40 of the Core never answers `media.source: LIVE_STREAM`, the one condition both clients use. Web, tablet and phone show "No DEMO media" for a REAL sealed item |
| **G94-02 BLOCKER** | Tablet (same app on the phone): "Play" on a REAL item opens "Evidence player, EV-..." and shows the app's bundled demo picture with the real session's time burned in and no demo label. The recording is a test pattern; what is shown is not the recording |
| **G94-03 MAJOR** | "Download export" delivers the archive only. The export manifest and its signature never leave the Core, so the project's receiver-side verify fails on what the product delivered (`X-01 EXPORT_MANIFEST_UNREADABLE`); it passes only after copying two files from the Core's folder by shell |
| **G94-04 MAJOR** | The audio-source band is empty on a product-sealed item ("This item carries no audio-source intervals.") although the session had two switches, the manifest holds three intervals and operation 82 returns them |
| **G94-05 MAJOR** | An export made on a tablet / phone says "Download from the web console." - the web console has no surface that lists or downloads an earlier export; the download exists only inside the dialog that requested it |

Entry condition (0 Blocker / Major of review 93 open): met (section 2).
`M8-CMP-1` is not passed by design: **blocked: licence decision (user)**.

Everything about the web player in section 4 marked "HARNESS" was observed with operation 40's
answer rewritten in my own browser tab (`NONE` -> `LIVE_STREAM`, by CDP; no product file changed).
It tells what the player does once G94-01 is fixed. It is not a product path and proves no check.

Run window 14:49-16:40 WIB. Between 15:14 and 16:25 nothing ran (one tool call of mine waited; the
environment was untouched and healthy when I came back; sessions had expired and were renewed).

## 2. Entry condition - review 93

Read in the code at `f293221`, tests run by me once: `npx vitest run --root apps/core-server
--project unit src/evidence-export src/modules/evidence-export src/modules/media-stream
src/media-stream src/modules/transcripts/__tests__` -> `Test Files 18 passed (18)` / `Tests 205
passed (205)`, exit 0 (`.cache/gates/94/entry_core_unit.log`). The db files (`export-e2e`,
`export-restart`, `export-doors`, `media-stream.db`, `transcript-routes.db`, `contract`,
`rbac-matrix`) are in gate 64's whole db run on `f293221`: `177 passed | 3 skipped`, `2381 passed`
(`gateway_check/08_m3_gate.md:50`).

| Finding | State | Code | Test (passed in my run unless marked) | Live |
|---|---|---|---|---|
| R93-01 BLOCKER export jobs never provided; op 87 fabricates | FIXED | `sealing-host/index.ts:604` `provideCoreEvidenceExport(app, { signer: signingNow })`; `evidence-export/host.ts:293-321`; `service.ts:192-203` (`503 NOT_READY / EXPORT_JOBS_NOT_AVAILABLE`), `:237` | `routes.test.ts` "R93-01" x3 | op 87 answered RUNNING then COMPLETE with the EXPORT's own hash (`58d47115...`, the seal's is `61c1d3a3...`); three files per export in `export/` |
| R93-02 BLOCKER case scope on ops 84-86 | FIXED | `modules/transcripts/routes.ts:91`, `:313-341` (`holdsCase`); `evidence-export/service.ts:174-175` | `routes.test.ts` "the REAL-evidence case scope on operations 42 and 87" x2; `download.test.ts` "case scope holds at the route"; transcripts tests in the same run | TECHNICIAN on the REAL item: op 84, op 86, op 88 each `403 NOT_PERMITTED`, `details.reason: EVIDENCE_CASE_SCOPE`, audit rows seq 121-123 |
| R93-03 MAJOR custody at request time | FIXED | `sim/evidence-actions.ts:220-222`, `:257`; `engine/export-doors.ts:25`; `evidence-export/host.ts:208` | `jobs.test.ts` "R93-03" x4; `routes.test.ts` "R93-03" x2 | section 4, `M8-EXP-1` row: SEALED / custody 4 while RUNNING, EXPORTED / custody 5 at COMPLETE |
| R93-04 MAJOR `.partial` after a death | FIXED | `evidence-export/boot-sweep.ts`; boot step `evidenceExport.sweepPartials` (`host.ts:228`) | `boot-sweep.test.ts` "R93-04" x4 | boot line `"step":"evidenceExport.sweepPartials","msg":"boot step passed"`. A kill could not be produced (section 6) |
| R93-05 MAJOR no download | FIXED as a route; see G94-03 / G94-05 for what it does not deliver | `modules/evidence-export/index.ts` (`GET /exports/:token`); `download-token.ts` | `download-token.test.ts`, `download.test.ts` | the browser saved `DEMS-export-EXP-000033.zip`, 136 096 844 bytes |

## 3. What was made

Lane 2 at a pristine seed (`stop 2`, `reset 2`, `start 2`: `audit head seq 83`, two v2 demo
packages). STT switched off in the web settings (`STT_CONFIG_CHANGED enabled:false revision 6`).

| Item | How | Facts |
|---|---|---|
| `EV-20261010-0014` = `SES-20261010-0024` | web console, SUPERVISOR starts, Investigator field set to the seed INVESTIGATOR; FAKE sources; two microphone switches in the Monitor (audit seq 92: to MIC-02 at 17 601 ms; seq 94: to MIC-01 at 49 001 ms); ended with a reason | REAL, holder `OPR-001`, 134 145 ms, 135 952 761 bytes, two files, "Sealed 0.8 s after the recording ended", manifest `61c1d3a3...`, transcript DISABLED |
| one-camera item | NOT made: a lane cannot make one FAKE camera absent (gate 89, `12_m7_gate.md:103`; no option in `scripts/lane/lane.sh`) | tests only: `export-one-camera.test.ts`, `media-stream/__tests__/one-camera.test.ts` (both in my run) |

## 4. Checks

Surfaces: W2 = web lane 2, T = tablet lane 2, P = phone, W1 = web lane 1, API = the Core through
the web origin with the seed operators' sessions. Tokens are never printed; `<TOKEN n>` is my blank.

| Check | Surface | Result | Evidence |
|---|---|---|---|
| M8-RG-* | suites | PASS (D122, unchanged code) | gate 64 on `f293221`: core unit `309 files / 6247 passed`, core db `177 passed, 3 skipped / 2381 passed`; `test/06` B3 shared `2476`, B4 `31`, B7 web `1900`, B8 mobile `249 of 250` + the one file re-run green by gate 64, B9a / B9b. Since then documentation only (`git diff --stat HEAD -- apps packages`: three README files) |
| M8-QA-1 | typecheck / lint | PASS (same) | `test/06` B1 / B2 exit 0 in 7 workspaces; gate 64 re-ran core-server and mobile |
| M8-PB-W | W2 | **FAIL** (G94-01, G94-04) | `shots/w2_03_itemA_media_tab.png`: "No DEMO media", "No DEMO package for this item: the Core server's record only.", Play disabled, no player. op 40: `"media":{"source":"NONE","packageSuffix":null}` |
| M8-PB-T | T | **FAIL** (G94-01, G94-02) | view tree: `evidence-media-panel-bundled`, "No DEMO media for this item on this device."; Play opens `evidence-play-sheet-dialog` "Evidence player, EV-20261010-0014" with a bundled demo picture |
| M8-PB-P | P | **FAIL by cause, not driven on the phone** | The phone runs the tablet's app and the same Core answer decides; I did not spend two pairings to see the same screen (section 6) |
| M8-RNG-1 | unit + API | PASS | 44 named cases in my run (`ranges.test.ts`, `routes.test.ts` "M8-RNG-1"). Live on the product-sealed file: `bytes=0-99` -> 206 `content-range: bytes 0-99/68363781`, first box `ftyp`; `bytes=1000000-1000999` -> 206; `bytes=-17` -> 206 `68363764-68363780`; `bytes=999999999999-` -> 416 `bytes */68363781`; `content-type video/mp4`, `accept-ranges bytes`, `cache-control no-store`, `cross-origin-resource-policy same-origin`, `referrer-policy no-referrer` (`api_media_scope.txt`) |
| M8-EV-SCOPE-1 | API + W2 | PASS | holder INVESTIGATOR 201; SUPERVISOR 201; TECHNICIAN `403 NOT_PERMITTED`, `reason EVIDENCE_CASE_SCOPE`, one `ACCESS_DENIED` row per attempt (seq 121; from the UI seq 1201). W2 (HARNESS for the button to exist): "Your role cannot play this evidence item.", `role=alert`, no video element (`shots/w2_15_technician_refused.png`, text read from the DOM) |
| media session binding | API | PASS | TTL 60.0 s; the token with another operator's session 403 `MEDIA_SESSION_INVALID`; without a cookie 401; three changed characters 403; 3 s after `expiresAt` 403 `MEDIA_SESSION_EXPIRED` |
| M8-BLK-1 | unit + greps | PASS, with G94-08 | tests "M8-BLK-1" x4 in my run. `grep -c 'mts_\|exs_'`: Core log lane 2 = 0, Vite log lane 2 = 0, lane 1 logs = 0, Metro log = 0, tablet logcat (23 003 lines) = 0, phone logcat = 0, headless Chrome's own log = 0. Page URL, local / session storage: no token. Proxy on an error (flow 7): `http proxy error: /media/[signed path not printed]` twice when I stopped the Core during playback. The audit rows hold `fileId`, `signed`, `rangeStart`, `rangeEnd`, `bytesServed`, `expiresAt` only |
| M8-EXP-1 | W2 + receiver verify | **FAIL as an operator flow** (G94-03); the job and the download PASS | Export -> `Running`, `0% done` -> `Complete` in 0.7 s (`export_pkg_poll.txt`: `08:14:30.404Z status=SEALED custody=4 | RUNNING`, `08:14:31.205Z status=EXPORTED custody=5 lastCustody=EXPORTED | COMPLETE`); before the wizard: SEALED / custody 3 (the 4th entry is the wizard's own verify). "Download export" -> `GET /exports/exs_<TOKEN 95>` 200, `content-length 136096844`, file `DEMS-export-EXP-000033.zip`, SHA-256 `6573306d1ed79b157ad3c6e29011347af547c058e2061e556fa44336a004b025`, 7 entries. Receiver verify (the project's `verifyExportAtDestination`, no key of the Core): on the downloaded archive alone `ok:false`, `X-01 FAIL EXPORT_MANIFEST_UNREADABLE`, X-02..X-07 `BLOCKED`; with `EXP-000033.manifest.json` / `.sig` copied from the Core's `export/` folder `ok:true`, X-01..X-07 PASS, `development:true`, `anchored:true` (`receiver_verify_full.txt`) |
| download binding | API | PASS | another session of the same supervisor 403 `EXPORT_DOWNLOAD_INVALID`; INVESTIGATOR 403; no cookie 401; two changed characters 403; own session 200 `content-disposition: attachment; filename="DEMS-export-EXP-000033.zip"`, `cache-control: no-store`; a `Range` header is ignored (200, whole length); 3 s after `expiresAt` 403 `EXPORT_DOWNLOAD_EXPIRED` (`api_export_binding.txt`) |
| 409 while one runs | API | PASS | two requests at once: `202 { EXP-000034, QUEUED, EXPJ-000034 }` and `409 EXPORT_IN_PROGRESS` "An export job is already running for this evidence item." Not seen in a UI (a job lasts 0.7 s) |
| M8-XAU-1 | audit + tests | PASS, with G94-10 | request `EVIDENCE_EXPORTED` "Export of evidence ... requested" `{reason, exportId, eventKind, destination}`; failure `EVIDENCE_EXPORT_FAILED` `{kind, jobId, reason}`; download `EVIDENCE_EXPORTED` `{bytes, jobId, reason: EXPORT_DOWNLOADED, eventKind}` + custody `EXPORT_DOWNLOADED`. Completion is the custody entry `EXPORTED`, no audit row (D185). No token, no key, no credential-shaped value in any row. File half: tests "the secret sweep and M8-XAU-1" x4 in my run |
| M8-CMP-1 | W2, T | **NOT PASSED - blocked: licence decision (user)** | W2: job `FAILED`, "Composite", "Derived output - not the sealed evidence", "Composite video is not available in this build." (`role=status`); status stays, custody 11 -> 12 (the wizard's verify only), nothing written to `export/`; audit seq 1222 request `kind: COMPOSITE`, seq 1223 `EVIDENCE_EXPORT_FAILED {COMPOSITE, EXPJ-000035, COMPOSITE_ENCODER_NOT_SELECTED}`. T: `evidence-export-job-FAILED`, the same sentence. The stand-in encoder path: tests "M8-CMP-1" x5 in my run |
| flow 6 on mobile | T | PASS as worded, with G94-05 | `shots/t2_05_export_done.png`: "Export job EXPJ-000036 Complete Package", "The export is stored on the Core (EXP-000036). Download from the web console.", "No file is sent to this tablet." Phone: not driven |
| transcript pane | W2, T, API | DISABLED state PASS; other states not reachable | W2 and T: "Transcript disabled by configuration" (`evidence-transcript-DISABLED`). op 84 / 86 on item A: 409 `TRANSCRIPT_NOT_READY`, `NO_SEALED_TRANSCRIPT`; on both v2 demo items: 409, `SIMULATED_ITEM` |
| M8-REV-1 | unit; live | **NOT PROVEN live** (as at gate 81) | no item on lane 2 carries a sealed transcript with text (FAKE sources carry no speech; the demo items answer `SIMULATED_ITEM`). Unit / db only: the transcripts tests in my run and gate 64's db run |
| simulated lane | W1, P, API | PASS | `EV-20261010-0013` on lane 1: op 40 `DEMO_PACKAGE / 0013`; op 88 409 `MEDIA_NOT_AVAILABLE / NOT_A_SEALED_PACKAGE`; op 42 202, op 87 COMPLETE with no `download` member, item EXPORTED with its custody entry in the same step. W1 page: `data-playback="bundled"`, "DEMO package", "DEMO excerpt". Phone: the bundled media panel with four tracks; the Play sheet opened (text only, no picture kept) |

### 4.1 The web player behind G94-01 (HARNESS, proves no check)

| Observation | What happened |
|---|---|
| Open, play | two `video` elements, same-origin `/media/mts_<TOKEN 91>`, 1280x720, duration 134.6 s; the second muted; a moving test pattern plays in both, time advances (`shots/w2_07_playing_past_ttl.png`); the two positions stay within 0.1 s |
| Seek | forward to 1:49 and back to 0:17, both files follow, playback continues |
| Plain playback past the TTL | 111 s continuous, no stop (`web_play_ttl_run1.txt`). This did NOT exercise the renewal: Chrome had asked for the rest of each file in one open-ended request before the expiry, and an answer in flight is not cut by expiry (D-90-9). A 134 s recording cannot show what a long one does |
| Pause past the TTL, then Play | the player asked operation 88 twice (201, 201) before any media request, loaded both files again and went on at the same position, Pause shown (`web_pause_resume_run.txt`) |
| Seek after the TTL | the same: two new sessions at the click, then 206 answers; no refusal reached the page |
| A request refused for expiry (forced with a 150 kB/s throttle on my tab) | first time: one renewal, playback resumes. Second time at the same place: "Playback stopped at 0:02 and did not resume. A recording that fails its integrity check stops at the failed fragment: run Verify to see which." + "Open again" (`shots/w2_12_stopped_state.png`); "Open again" recovered. See G94-07, G94-08 |
| Sign-out in a second tab | within 1 s the playing tab was on `/login` with no video element (`web_signout_run.txt`) |
| Requests per open | about 110 range requests for the 134 s file pair (Chrome reads the fragment index of an fMP4 by aborted open-ended requests), each one an `EVIDENCE_MEDIA_SERVED` row: G94-06 |
| Flow 8 (autoplay rule after a renewal) | not produced |

## 5. Findings

| ID | Severity | What | Steps and evidence | Spec |
|---|---|---|---|---|
| G94-01 | BLOCKER | The sealed player can never open through the product. `apps/core-server/src/modules/evidence/media.ts:28-32` answers `DEMO_PACKAGE` or `NONE` only (file last changed in `b90a3c6`); `modules/evidence/index.ts:223` is its one caller; no non-test file of the Core writes `LIVE_STREAM`. Both clients require it: `apps/core-web/src/features/evidence/detail-page.tsx:109`, `apps/mobile/src/features/evidence/evidence-detail.tsx:117`. The client tests stub operation 40 with `LIVE_STREAM` (`media-session-canary.test.tsx:98`) | W2, SUPERVISOR: Evidence -> `EV-20261010-0014`: "No DEMO media", Play disabled. T: "No DEMO media for this item on this device." `curl` op 40: `"media":{"source":"NONE"}` | ux flow 5 step 1 (`08_client_ux_spec.md:453`): "`media.source: LIVE_STREAM` means a signed media session is required"; C3 op 40 |
| G94-02 | BLOCKER | T (and P by the same file): Play on a REAL item opens the v1 Play sheet with the app's demo camera picture, the item's ID in the title and the session's own clock burned in, with no "simulated" / "demo" chip (`play-sheet.tsx:9-16`: in Live mode with no bundled media "neither chip shows"). The operator sees a picture that is not the recording | T, SUPERVISOR: Evidence -> the item -> Play. View tree: `evidence-play-sheet-dialog` "Evidence player, EV-20261010-0014". The screenshot was removed (media rule); the picture was the bundled demo room, not the recorded test pattern | ux flow 5: "playback is of the sealed files"; OD-12 |
| G94-03 | MAJOR | The download hands out `EXP-<id>.zip` only. `EXP-<id>.manifest.json` and `.sig` stay in `<package>/export/`; the UI shows both values cut ("58d47115887f3c99...9e91e8fcdf81cd5c"). The fix's own e2e reads the two files from the package folder (`export-e2e.db.test.ts:276-277`). No receiver tool is shipped: `verifyExportAtDestination` has no entry point outside the tests | section 4, `M8-EXP-1` | ev §G.1 (export manifest, export signature); test strategy `M8-EXP-1` "checked at the destination folder by the receiver-side verify" |
| G94-04 | MAJOR | The audio-source band never draws for a product-sealed item. The player reads `item.audioSourceIntervals` (`item-v2.ts:168`); the Core's item has no such member; operation 82 (`GET /api/v1/session/SES-20261010-0024/audio-source`) returns the three intervals and the manifest holds them under `audio.sourceIntervals` | HARNESS view: "This item carries no audio-source intervals." | ux flow 5 step 4: band from operation 82 |
| G94-05 | MAJOR | A finished export can be downloaded only from the dialog that requested it, while it is open. The web item page of an EXPORTED item has no export panel (`ExportJobStatus` is used by `export-wizard.tsx:507` and `export-sheet.tsx:469` only). The tablet's "Download from the web console." points at nothing | T: export `EXP-000036` COMPLETE; W2: reopen the item: Play / Export / More, no export listed | ux §6.6 web download; README:509 |
| G94-06 | MINOR | One "Open playback" of a 134 s item wrote 117 `EVIDENCE_MEDIA_SERVED` rows (audit total 124 -> 241); every renewal repeats it. After about ten opens the chain held 1 202 rows. A long recording scales with its fragment count | `browserA_tab0.log`: 113 media requests in the second 07:59:02Z | C3 §5.2 one row per answered range (as built); R93-11 |
| G94-07 | MINOR | A stop caused only by token expiry is worded as a possible integrity failure ("A recording that fails its integrity check stops at the failed fragment: run Verify to see which.") on an intact recording. Seen only under my throttle; any stall longer than the TTL twice at one place gives it | section 4.1 | D152 (D5-2) wording |
| G94-08 | MINOR | When a media request is refused, the browser's own console prints the full signed path ("Failed to load resource: ... 403 (Forbidden) http://127.0.0.1:5177/media/mts_..."), four times in this gate. The token was already expired each time and is bound to the session; the app's own lines hold none. The `video` element's `src` attribute also holds the live path (page markup) | `browserA_tab0.log` lines `LOG.error [HOLDS-TOKEN]` | brief item 3 "never appears in ... the browser console"; R93-22 |
| G94-09 | MINOR | The web export dialog of a REAL item carries a "DEMO" chip, three destinations named "(simulated)", and beside "Download export" a second "Download" of `EXP-000032-EV-...-export-manifest.demo.json` with "DEMO export manifest (JSON). No archive exists for this item." - false while the archive exists | `shots/w2_17_export_complete.png` | G89-03 family; `i18n/en/evidence.ts:397` |
| G94-10 | MINOR | A PACKAGE request row has no `details.kind` (the web sends `kind` only for COMPOSITE) | audit seq 1204, 1209 against seq 1222 | `03_api_contract.md:902` "with `details.kind: PACKAGE|COMPOSITE`" |
| G94-11 | NOTE | Finished archives (decrypted, 136 MB each) accumulate in `export/`: five after this gate's exports, none removed by the product | `ls .../export/` | review 93 question 7 (known) |
| G94-12 | NOTE | `lane.sh stop 2` during a running export let the job finish (a `.partial` of 144 465 bytes was on disk during the stop; after the start `EXP-000038` was COMPLETE with its three files). Good behaviour; it means flow 3 cannot be driven with the lane script | `kill_export_fire.txt`, `lane2_stop_2.log` | flow 3 of note 114 |
| G94-13 | NOTE | T: the first tap on "View in Evidence" did not navigate, the second did (G81-13 again; tooling or product not determined). The tablet's export sheet draws only the first stepper badge as done while the view tree says all six are "completed" (`shots/t2_05_export_done.png`) | - | - |
| G94-14 | NOTE | Reproduced on the playback surface, not re-investigated: the REAL item's header says "No DEMO media" (G81-10) | `shots/w2_03_itemA_media_tab.png` | - |

## 6. Skipped, not covered, not proven

| Item | State | Why |
|---|---|---|
| Biometric offer after sign-in (T, P) | skipped by the user's instruction (D151) | dismissed with "Not now"; no fingerprint touched |
| Local-device flows | none in this gate | no LOCAL_DEVICE source selected or started |
| Phone re-point to lane 2 and `M8-PB-P` on the device | NOT RUN | the task allowed it; with G94-01 the result is fixed by the Core's answer and the app is the tablet's, so two new pairings would have bought one more "No DEMO media" screen. The phone stayed on lane 1 with its pairing |
| The mobile sealed player on a device (play, seek, renewal past 60 s, sign-out, logcat during playback) | NOT PROVEN | unreachable (G94-01); I built no interception for the app. The D140 / D149 risk on a device is still open |
| Renewal during PLAIN playback of a long recording (web) | NOT PROVEN | needs a recording larger than what the browser asks for in one request |
| One-camera playback (flow 5 of note 114) | NOT DRIVEN | no supported way to make a FAKE camera absent; tests only |
| Kill during an export (flow 3) | NOT DRIVEN | G94-12; `boot-sweep.test.ts` (4, my run) and `export-e2e.db` / `export-restart.db` (gate 64's run) |
| `M8-REV-1`, transcript states other than DISABLED | NOT PROVEN live | no item with text |
| 409 wording in a UI, flow 8 (autoplay) | not produced | a job lasts 0.7 s; no renewal without a gesture occurred |
| Physical-device playback | class C | not scheduled |
| `47_m9_docs.md` sentences for this gate | checked against what I saw | "Download export", the 60 s link, the mobile sentence, the composite sentence: as built. The README does not say that the export manifest and signature are not downloaded, nor that the download exists only in the open dialog |

Screens under `.cache/gates/94/shots/`. Read as pictures: `w2_03_itemA_media_tab.png` (item page,
"No DEMO media", Play greyed), `w2_07_playing_past_ttl.png` (HARNESS: two colour-bar test patterns,
1:51 / 2:14, "This item carries no audio-source intervals."), `w2_17_export_complete.png` (export
dialog: DEMO chip, Complete, cut hash and signature, "Download export", the DEMO manifest line),
`t2_05_export_done.png` (tablet: export Complete, "Download from the web console."). Taken and not
read as pictures (their text was read from the DOM or the view tree): the other `w2_*` and `t2_*`
files. Removed: the tablet Play sheet picture and the lane 1 item picture (bundled demo media).

## 7. Tooling lapses

- My view-tree reader over-blanked one caption on the Login (it matched the word "password"); no
  demo password line was printed in this gate.
- Six aborted API downloads of mine wrote "downloaded" audit and custody rows on lane 2 (gone with
  the reset).
- The 71-minute pause named in section 1.

## 8. Environment as left

| Item | State |
|---|---|
| Lane 2 | RUNNING (PID 77722), reset to the seed at the end (`audit head seq 83`, two v2 demo packages, media store holds `SESSION-SES-20261008-0011` and `-0015` only), 0 warn / error lines. STT switched back on before the reset (`enabled: true`, `revision 7`; the table survives a reset) |
| Lane 1 | RUNNING (PID 72245), NOT reset by me. Added by this gate: one supervisor sign-in / sign-out by API, one sign-in on the phone, `EV-20261010-0013` exported twice by API (PACKAGE `EXP-000032`: item now EXPORTED; COMPOSITE `EXP-000033`). The controller may reset it |
| Tablet | lane 2, relaunched to Login, "Core online", "paired as DEV-0001", reverse rules 8081 / 4420 -> 4422 |
| Phone | lane 1, never re-pointed, no new pairing; relaunched to Login, "paired as DEV-0001", reverse rules 8081 / 4420 -> 4421. Its supervisor session on lane 1 was not signed out in the app (force-stop); it ends by idle expiry |
| Processes | my headless Chrome, observer, interceptor and throttle stopped; no `capture-worker` / `ffmpeg`; web 5176 / 5177 and Metro untouched |
| Files | removed: the downloaded archive, the unzipped folder, both destination folders, every cookie jar, the browser profile. Kept under `.cache/gates/94/`: `tools/`, the run logs, `browserA_tab0.log` (tokens blanked at write), `logcat_tablet.txt`, lane logs, screenshots. Kept under `.cache/gate-env/`: `g94-device-login.mts` (types a seed sign-in by constant name; holds no value) |
| For the fix rows | (1) G94-01 is one rule in `modules/evidence/media.ts` plus the mobile Play button's branch (G94-02); after it, this gate's device half must be run in full, phone included; (2) the web player was sound in everything I could reach behind the harness; (3) a recording of several minutes is needed to judge the TTL on plain playback |

---
*Generated: 2026-10-10 16:45 WIB*
