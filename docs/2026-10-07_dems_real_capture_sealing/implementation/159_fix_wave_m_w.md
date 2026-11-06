---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave M, driver M-W (apps/core-web) - web findings of the final re-checks 70, 75, 89, 94
date: 2026-10-11
agent: coder-execution
narrative_tier: 2
tree: commit 7b1aded + the working tree of wave M (no commit, no git write)
contract: delegation_progress/contract_wave_m.md (M-S adds no member; nothing new is read here)
decisions: D232, D234, D235, D236
status: complete
---

# 159 - Fix wave M, driver M-W (core-web)

Area: `apps/core-web` only (17 production files, 6 existing test files, no new file). `packages/shared`,
`apps/core-server`, `apps/mobile`, `scripts` untouched. No git write. Lane 2's web console was driven in
**Google Chrome 154, headless, `--mute-audio`, over CDP at 1440 x 900**, with the helper's session cookie
(my own copy of the helper, jar in my own folder; no password typed or printed). Nothing was played aloud;
no LOCAL_DEVICE source selected, pre-checked or started; no attendance variable; `.data/pg*.env` not read;
nothing downloaded (`~/Downloads`: 0 `DEMS-export*` before and after). Paths are relative to
`apps/core-web/src/` unless they start with another root. Run window 14:47 - 15:25 WIB. Evidence:
`.cache/gates/wave-m-w/` (git-ignored; 39 pictures in `shots/`, logs with tokens blanked at write).

## 1. Findings

| Finding | Cause (file:line at `7b1aded`) | Change | Existing test file that took the test | LIVE |
|---|---|---|---|---|
| **G94d-01** (must-fix) | `features/evidence/sealed-player.tsx:658` read `currentTime > 0 \|\| readyState >= 1` on `timeupdate` as life; `onAlive` (`:346-349`) cancelled the stall watch | 2.1 | `features/evidence/__tests__/wave-k-w-player.test.tsx` | **PROVEN** (a) (b) x3 (c) (d), section 3.1 |
| **G75e-04** (D234 (1)) | `features/dashboard/system-ring-panel.tsx:52` `noticeOnly` needed `ring.state === 'READY'`; a RECORDING ring fell to `dashboard.systemRing.statusLine.RECORDING` | 2.2 | `test/wave-l-w-real-core.test.tsx` ("G75d-01 / G75d-03") | **PROVEN**, 3.3 |
| **G75e-06 (a)** | `components/shell/secure-pill.tsx:103-107` and the ring knew the open notice and BLOCKED only; nothing read RETRYING | 2.2 | the same describe | **PROVEN** with the rig, 3.2 |
| **G75e-06 (b)** | `features/session-monitor/seal-attention.tsx:50-54` drew the step sentence, the detail sentence and the alert's message - all begin with the cause | 2.2 | `features/session-monitor/__tests__/wave-i-b-seal-blocked.test.tsx` (the pin "all three are drawn" REPLACED) | **PROVEN**: cause x1 in the dialog, 3.2 |
| **G75e-05** | `features/session-monitor/status-banner.tsx:146` offered recovery for every FAULT that is not a failed start; `model.ts:241` knew no "the Core is sealing" | 2.2 | `features/session-monitor/__tests__/situation-c.test.tsx` | **PROVEN** with a worker kill, 3.4 |
| **G75e-02** | `features/session-new/devices-step.tsx:258-263` labelled both meters `common.tracks.AUDIO-0n` | 2.3 | `features/session-new/__tests__/copy-round-live-words.test.tsx` | **PROVEN**, 3.5 |
| **G70d-05 (a)** | `features/session-new/index.tsx:109` `s.session?.id` - the slice keeps the last SEALED session | 2.3 | `features/session-new/__tests__/session-new.test.tsx` ("guards") | **PROVEN**, 3.5 |
| **G89d-02** | `features/security-audit/tamper-panel.tsx:72-83` counted verify rows and stated no item count | 2.4 | `test/wave-l-w-real-core.test.tsx` ("G89c-02") | **PROVEN** against the API, 3.6 |
| **G89d-05** | `features/session-monitor/session-monitor.css`: `.sm-invitation` 0.86 alpha (`:393`); `.sm-inputs-grid` rows `minmax(0, 1fr)` (`:996`) under tiles of `min-height: 60px`; the 72 px meter of the density block (`:1407-1409`) in halves that have 48 px since the audio-source footer | 2.4 | none (layout; jsdom has none) | **PROVEN** by picture and by measured boxes, 3.7 |
| **G89d-06** | `features/session-monitor/integrity-panel.tsx:246-248` one sentence for every state | 2.4 | `test/wave-l-w-real-core.test.tsx` ("G89c-03") | **PROVEN**, 3.7 |
| **F-1 of 12d** | - (read only) | - | - | **READ after my restart**, 3.8 |

## 2. Per finding

### 2.1 G94d-01 - the stall watch rests on data received

**Reproduced first** (14:52, `EV-20261009-0005`, lane 2, the player of `7b1aded` put back for one run):
open, scrubber at 80 %, Play at once -> Camera 1 6.2 -> 8.0 s, ended 4.0 s after the open; VIDEO-02 black, no
sentence, no tile mark, 0 probe requests, 0 x 409, unchanged 8 s after the end; events of VIDEO-02
`play@1.55 (t=6.0, rs=0) waiting@1.55 stalled@3.35 timeupdate@3.65 (t=7.8, rs=0) pause@3.65` - the
verifier's measurement (`shots/repro_b_seek80_3_end_plus_tail.png`).

**Change** (`features/evidence/sealed-player.tsx`):
- `holdsData` (`:103`): an element holds data when `readyState >= HAVE_METADATA` or it has a buffered range.
  **The clock is never read.**
- Two facts per file: `alive` (it RECEIVED data: `loadedmetadata` / `canplay` / `playing`, or `holdsData` at
  a `timeupdate` / `progress`) and `waitingFor` (its element said `waiting` / `stalled` and has not said
  since that it can play: `canplay`, `playing`, or `readyState >= HAVE_FUTURE_DATA` at a `timeupdate` /
  `progress`). A file is settled when it is alive AND does not wait; **only then its watch goes**
  (`refresh` `:357`, `watch` `:379`, `onWaitingFor` `:396`). When the watch runs out it reads the element
  again and asks only an unsettled file.
- **At the END of the leading file** (`askUnsettledAtEnd` `:406`, called before the pause, `:730`): every
  other open file that has delivered no data, or still waits, is asked about at once - one question per
  file and session, as before.
- So: a `timeupdate` with `readyState 0` changes nothing wherever a seek put the clock (the finding); a file
  that DID load and waits at an altered fragment keeps its watch through the `timeupdate` (readyState 1-2)
  the pause fires, and is asked at the end of the other file (the re-check's hypothesis).
- Unchanged: the probe (`media-session.ts` not touched), the sentence, the "Stopped" tile, the other file
  playing on, the media-error path.

### 2.2 G75e-04, G75e-06, G75e-05

- **Ring while recording beside an open notice** (`system-ring-panel.tsx:58`): `noticeRecording` - the ring
  stays the recording ring (REC, timer), its line reads "OPEN NOTICE • RECORDING", its caption the notice's
  sentence with the session. Same finding, second half: on a Core that states
  `security.platformNotReported` a recording with NO notice reads "RECORDING • NO FAULT REPORTED", not
  "SECURE • HEALTHY • RECORDING" (the simulated lane keeps its line).
- **A seal that is being retried** - one reader `sealRetryingSessionOf` (`lib/seal-attention.ts:55`):
  `sealAttentionOf` RETRYING, **or** the retry RUN itself (session FINALIZING, of the Core's own capture, a
  step at `attempt > 1`). The second half was added after the browser showed it: with RETRYING alone the
  pill read "SECURE / All systems operational" for the length of each retry run (picture
  `a1_dashboard_retrying_1.png`, taken at the +5 s run). Pill: "SEALING RETRIED / The Core is running the
  seal again" (`secure-pill.tsx:110`, `data-seal-retrying`, before the open notice; a real fault keeps its
  words). Ring: ATTENTION "SEALING IS BEING RETRIED / The seal of session ... did not complete. The Core
  runs it again by itself. The recording is kept on the Core." Not this state: BLOCKED (CRITICAL by its
  alert), the simulator's session at `attempt > 1` (there the attempt grows on a recovery alone).
- **The blocked dialog states the cause once** (`seal-attention.tsx`, `saidAlready` in
  `lib/seal-attention.ts:39`): the alert's whole message is drawn (cause, what restores the seal, what it
  costs); the step sentence and the detail sentence only where their leading clause is not in it.
- **G75e-05** (`model.ts:183` `coreSealsInterruptedPrefix`, the mobile rule of note 155 item 5, with
  `isSelfCaptureCore`): `FAULT` from `RECORDING`, `startedAt` set, `captureDurable: true` on a Core in its
  own capture -> `BannerModel.coreSealing`. The banner reads "Recording interrupted / <reason>. The Core is
  sealing the recording up to the interruption. Nothing has to be started here." (warning tone), **no
  "Start recovery"**; the feed card the same, no button. Every other FAULT keeps its recovery.

### 2.3 G75e-02, G70d-05 (a)

- `devices-step.tsx:303` `MicMeter`: on a Core in its own capture (`useSelfCaptureCore`, the rule of the
  Monitor's audio panel) the label is built from the SELECTOR IN FORCE (`selectorInForce`,
  `micInputOfChannel`, `audioPairOfSelector`): input, source id, role, and "Generated test source" for
  `adapter: FAKE`. The simulated lane keeps `common.tracks.AUDIO-0n`.
- `index.tsx:115`: the wizard's session id is `isSessionActive(session) ? id : null` - no id in the header
  (or in the Ready summary) from a SEALED session of the slice.

### 2.4 G89d-02, G89d-05, G89d-06

- `security-audit/core-verify-rows.ts:59` `itemsWithoutVerifyRow(rows, ids)` over the replicated
  `evidence` slice (the Core's own list); `tamper-panel.tsx:111` one sentence under the chips: "12 of the 41
  items of this Core have no verify run in these rows." / "Every one of the n items ...". Simulated lane:
  not drawn.
- Layout (`session-monitor.css`, `inputs-panel.tsx`): (1) the sealed / idle card is opaque; (2) at the
  1280-1599 density each microphone of AUDIO MONITOR is ONE ROW - name (never the cut part), role chip, the
  development mark as its icon (its words stay in the markup for a screen reader), a 16 px meter with its
  readout beside it; (3) CAMERA & INPUT STATUS rows are never lower than a tile (68 px); where two rows do
  not fit the card body scrolls and shows the wave L cue "More below - scroll". 1600 px and wider: unchanged
  except (1) and the row minimum.
- `integrity-panel.tsx:115`: on a SEALED session the closing sentence reads "Fragment hashes and the
  signature are stated on the evidence item: EV-..." with the id a link to the item; unsealed: unchanged.

## 3. Proven LIVE in the browser (lane 2)

### 3.1 G94d-01 (supervisor; before my restart, on the code as delivered)

| | Run | Result | Probe requests |
|---|---|---|---|
| (a) | open `EV-20261009-0005`, Play 1.5 s later, to the end | sentence "This recording failed its integrity check at VIDEO-02 fragment 3." + "... Camera 2 is stopped. Camera 1 plays on. Run Verify for the full result." and tile "Stopped: this file failed its integrity check at fragment 3." **5.79 s after the open**; Camera 1 0 -> 8.0 s; both still there 8 s after the end | 3 (`bytes=0-2097151` 206; `2097152-4194303` 206, cancelled 1.5 s later; **`2257425-4354576` -> 409**); 1 x 409 |
| (b) x3 | open, scrubber at 80 %, Play at once | **3 of 3**: Camera 1 6.2 -> 8.0, ends 3.7 s after the open; the first probe request leaves **at the end** (+3.7 s, before the 4 s watch); sentence + tile **5.63 / 5.55 / 5.58 s after the open**, still there 8 s after the end (`b_seek80_run{1,2,3}_3_end_plus_tail.png`) | 3 each, the same three; 1 x 409 each |
| (c) | open, scrubber at 50 %, Play | sentence + tile 5.83 s after the open, stay | 3; 1 x 409 |
| (d) | clean `EV-20261008-0001` right after, Play through | both files `readyState 4`, 1280 wide, 0 -> 8.0 s, both ended; **no sentence, no tile note** | **0 probe requests**, 0 x 409 (21 x 206, the element's own) |
| (d2) | clean item, scrubber at 80 %, Play | both end at 8.0; no sentence | **0**, 0 x 409 |

The browser's own console line for the refused request carried a path: counted (0-2 per run), never written.

### 3.2 G75e-06 - seal rig `blocked` (announced in `contract_wave_m.md`), `SES-20261011-0064`

`seal-rig 2 blocked` 15:10:31; session through the API (stop body with a reason), `RECORDING` 15:10:42,
stopped 15:11:26 (45 s).

| When | Surface | Read |
|---|---|---|
| 15:11:31 - 15:12:33 (retries 1, 2) | Dashboard | pill "SEALING RETRIED / ..." `data-state ATTENTION`, `data-seal-retrying`; ring "SYSTEM ATTENTION / SEALING IS BEING RETRIED / ... session SES-20261011-0064 ..." - one state for the whole minute at 300 ms sampling. The picture taken at 15:11:31.8 caught "SECURE" during the +5 s retry RUN: the cause of the second half of the rule (2.2) |
| 15:12:43 | Monitor | pill the same; banner "SEALING RETRIED / Sealing is being retried (retry 3 of 3, in ... s). The Core's key store cannot be used ..."; dialog RETRYING, cause x1 |
| 15:14:01.9 (+155 s) | Monitor | pill "CRITICAL / Sealing is blocked"; banner "SEALING BLOCKED"; **dialog BLOCKED: "The Core's key store cannot be used" x1, "3 automatic retries" x1** - title, the alert's message, "The recording is kept on the Core.", what you can do, "Sealing stopped after 3 automatic retries.", who can retry, [Retry sealing], the close note (`a2_monitor_retry_blocked_2.png`) |
| 15:14:10 | lane | `seal-rig 2 release` -> OFF (read); 4 s later still `FINALIZING` |
| 15:14:20 | Monitor | **"Retry sealing" pressed in the dialog** -> toast "Sealing is run again."; `SEALED` `sealedAt` 15:14:21.253, `EV-20261011-0045`; pill "SECURE"; op 41 PASS 15 of 15; 0 active alerts |

After the rule was completed (2.2) the retry state was sampled again at **50 ms** through the stop and the
+5 s retry run of the next session (3.3): "SEALING RETRIED" from 15:16:45.47 on with no change for 19 s.
The one frame before it (15:16:45.31, pill "SECURE", ring "OPERATIONAL • NO FAULT REPORTED") is the first
run of the seal, before anything failed.

### 3.3 G75e-04 - seal rig `unsealable`, `SES-20261011-0065`, then a healthy session beside the notice

`seal-rig 2 unsealable` 15:15:46; session stopped 15:16:44; UNSEALABLE at +35 s: `session/current` null,
`ALR-000097` CRITICAL `UNSEALABLE` active; rig `release` 15:17:28 (OFF, read). Healthy
`SES-20261011-0066` through the API, `RECORDING` 15:17:36:

- Dashboard at 15:17:41 (`b2_dashboard_notice_recording_1.png`): pill "OPEN NOTICE / 1 recording could not
  be sealed"; **ring "REC 00:00:05 / OPEN NOTICE • RECORDING"**, caption "A recording could not be sealed
  (SES-20261011-0065). Its files were kept in quarantine on the Core. Recording is not blocked."; no
  "SECURE", no "HEALTHY" on the ring; unchanged for the 30 s sampled.
- Sealed (read 15:18:42) -> `EV-20261011-0047`. Then, as the supervisor, the web bell: "This recording could not be
  sealed. ... / Session SES-20261011-0065 · Cause code: SESSION_KEY_NOT_OF_SESSION / Acknowledge and close"
  pressed: `POST alerts/ALR-000097/acknowledge 204`; alert `active false, acknowledged true, resolvedAt`
  set; pill "SECURE", ring "OPERATIONAL • NO FAULT REPORTED"; 0 active alerts.

### 3.4 G75e-05 - worker kill, `SES-20261011-0068`

Capture worker killed (`KILL`) at 15:20:44.269 during the recording; Monitor sampled every 40 ms:

| At | Banner |
|---|---|
| 15:20:44.326 | "Recording continues • Capture fault" `[FAULT]` (session still RECORDING, the alert first; 60 ms) |
| 15:20:44.386 | "Capture fault. The Core is sealing the recording up to the interruption. Nothing has to be started here." `[FAULT core-sealing]`, **no control**; feed card "Recording interrupted / ..." |
| 15:20:44.990 | "Sealing evidence • step 3 of 6" |
| 15:20:53.286 | "Sealed — recording was interrupted / EV-20261011-0049 · ..." |

Buttons reading "Start recovery" on the page: **0 in every sample**. Item `interrupted true`,
`interruptedCause CAPTURE_FAULT`, op 41 PASS 15 of 15; its alert resolved.

### 3.5 G75e-02, G70d-05 (a) - Session New in the web UI (15:09)

Step 1 with `session/current` = the SEALED `SES-20261011-0062`: header shows "Step 1 of 3" only, **no
session chip**, the page does not hold that id (`w3_session_new_step1_no_id.png`). "Fill in the next case
number", Saksi, a subject, Next -> `SES-20261011-0063` created and pre-checked: header chip
"SES-20261011-0063"; MICROPHONE LEVELS **"MIC 1 · MIC-01 · Primary microphone · Generated test source"** /
**"MIC 2 · MIC-02 · Standby microphone · Generated test source"**; "Interviewer" 0, "- Subject" 0 on the
page (`w3_session_new_step2_meters.png`). Cancelled from the web (`POST .../cancel 204`). The case
"MIC-02 primary" was not driven live (the selector was not changed): by test.

### 3.6 G89d-02 (15:09)

Tile "LAST VERIFY RUN PER ITEM / 28 PASS • 1 FAIL", chip `EV-20261009-0005: VIDEO-02 fragment 3 failed
verification`, and **"12 of the 41 items of this Core have no verify run in these rows."**
(`w4_tamper_tile_not_verified.png`). Against the API at the same minute: evidence list 41 items
(`nextCursor null`); audit list walked (1084 rows): 29 items have a verify row, newest PASS 28, FAIL 1;
41 - 29 = 12.

### 3.7 G89d-05, G89d-06 - Monitor of a sealed session at 1440 x 900

Before (`m0_monitor_sealed_before_css.png`, `SES-20261011-0062`): the three overlaps of the finding; measured:
input grid 95 px for two rows of 60 px tiles (the MIC tiles start 7 px inside the camera tiles), audio halves
48 px for 67 px of content (the meter box 444-516 over the name row and the footer at 501). After
(`m1_...`, `m1b_...`, `m1c_...`, `m2_monitor_sealed_1440x900.png`): the sealed card opaque; AUDIO MONITOR
"● MIC 1 [Active] ⚑ ▮▮▮ NO SIGNAL" / "● MIC 2 [Standby] ..." in two rows above "Audio source", no element
cut (measured: every child of the name row inside it); CAMERA & INPUT STATUS: the camera row, the cue, the
MIC row after a scroll; a box-intersection check over name, role, meter, footer and the four tiles: **0
overlaps**. While recording (`a0_monitor_recording_audio.png`): "MIC 1 / Active / −11 dBFS", "MIC 2 / Standby
/ −21 dBFS" in the same rows. G89d-06 on `SES-20261011-0062` and `-0068`: "Fragment hashes and the
signature are stated on the evidence item: EV-20261011-0049", link `/evidence/EV-20261011-0049`
(`m2_integrity_card_sealed_note.png`).

### 3.8 Condition F-1 of 12d - the integrity card of a sealed session AFTER a Core restart

Lane 2 restarted by me at 15:08 (section 6). `session/current` = `SES-20261011-0062` `SEALED`,
**`captureDurable` absent** (the state 12c found broken). Monitor, EVIDENCE INTEGRITY, read from the DOM
at 15:08 (`f1_integrity_card_after_restart.png`, `f1_monitor_sealed_after_restart.png`), `data-own-core="true"`:

> Capture - Evidence EV-20261011-0044 is sealed. Verify it on its Evidence page. - Standby | Audit Log Hash
> Chain - SHA-256 - Passing | Time Source - Core system clock (UTC+07:00) - Standby | CHAIN HEAD (12 hex) |
> Re-verify

Word search on `main`: "Encryption Active", "Secure Timestamp", "Storage Write Verified", "AES-256", "RTC",
"Hash Chain Active", "DEMO", "imulated", "GNSS": **0 hits each**. The Core's facts or nothing; no simulator
row. (The fragment counts and the closing sentence of 2.4 belong to the capture member and are not drawn in
this state.)

## 4. Tests and commands (one run each; a second run only after a red)

| Check | Command (repo root) | Result |
|---|---|---|
| Player | `npx vitest run --root apps/core-web src/features/evidence/__tests__/wave-k-w-player.test.tsx` | `Tests 29 passed (29)` (5 new "G94d-01 (wave M)"; the wave L case "a `timeupdate` at clock 0 is no sign of life" REPLACED by them) |
| Player, red-first | the same with `:658`'s rule put back and the end question removed (in memory, restored) | `4 failed \| 1 passed \| 24 skipped` - the four cases; the control passes |
| Items 2-4, red-first | the four files below against the production files of `7b1aded` (i18n kept; restored) | `14 failed \| 58 passed (72)`: every new case red. Three of the 14 are controls that fail there only for a member / test id that did not exist |
| Items 2-4 | `... src/features/session-monitor/__tests__/situation-c.test.tsx src/test/wave-l-w-real-core.test.tsx src/features/session-new/__tests__/copy-round-live-words.test.tsx src/features/session-new/__tests__/session-new.test.tsx` | `Test Files 4 passed / Tests 72 passed` |
| Folders of every changed feature | `npx vitest run --root apps/core-web src/features/{session-monitor,dashboard,security-audit,session-new,evidence,devices} src/components/shell src/lib src/test` | once: `2 failed \| 156 passed (158)`, `1 failed \| 1946 passed` - below |
| After the fix of that one | `... wave-i-b-seal-blocked.test.tsx src/test/wave-l-w-real-core.test.tsx` | `Test Files 2 passed / Tests 56 passed` |
| `shell-motion` | `npm test -w apps/core-web -- src/test/shell-motion.test.tsx` | `Tests 30 passed (30)` |
| Typecheck / lint | `npm run typecheck -w apps/core-web`, `npm run lint -w apps/core-web` | clean, no warning (after the last edit) |

The two red of the folder run: (1) `wave-i-b-seal-blocked.test.tsx` "says sealing is blocked ..." pinned that
the step sentence, the detail sentence AND the message are all drawn - the repetition G75e-06 (b) removes;
the case was rewritten in place to the "cause once" rule (my first copy of that case in the wave L file was
removed: one test, in the dialog's own file). (2) `shell-motion.test.tsx` reads
`${cwd}/src/components/shell/shell.css`: it fails only when started from the repository root with `--root`
(my invocation); with the workspace's own command it passes.

No new test file. No shared member, no contract example added or read anew.

## 5. Seen, not changed (scope closed)

1. Monitor at 1440 x 900, SESSION DETAILS: the labels "Interview Room" and "Configured profile" wrap to two
   lines in a 32 px row (38 px of content) and touch the next row's label. Cause: the density block's
   `.sm-kv-row { grid-template-columns: minmax(0, 0.72fr) ... }` (87 px label column).
2. Monitor and Dashboard at 1440 x 900, STORAGE: the ring "55 % USED" is cut at the card's lower edge and
   "449.6 GB Free" touches the next column's bullet.
3. Monitor banner while BLOCKED: "Sealing stopped after 3 automatic retries" twice (the step sentence and
   the retry control's line) - the banner, not the dialog of G75e-06 (b).
4. Monitor after a worker kill: for one 60 ms sample the banner reads "Recording continues • Capture fault"
   (the alert arrives while the session still says RECORDING) before the "Core is sealing" state.
5. The banner's title keeps the previous state's words for the 120 ms of its cross-fade ("SESSION ACTIVE"
   over the new detail) - the same in every transition.
6. The FAKE microphone lines' pre-check rows read "MIC (primary)" / "MIC (standby)" with no source id (the
   cameras "Video Lens 1 / 2": G70d-05 (c), not in this wave's list).
7. Player: when the LEADING file is the altered one and the other file ends first, the toggle stays "Pause"
   until the watch has answered (the end handler is the leading file's). Not driven; no such item.
8. Dashboard, "Security Posture ... 2 active alerts" while one UNSEALABLE notice and a running session's
   INFO alert were active - a count of every active alert, not of faults.

## 6. Environment: what I did and the state left (15:25)

| Item | State |
|---|---|
| Lane 2 | **restarted ONCE by me** after "MS consistent at 15:00": stop 15:08:10, ready 15:08:12, PID 34466, `start 2 --with-camera-stub --speech-mic` redirected to `.cache/gates/wave-m-w/start_2.log` (0600; the two fixture lines removed from my copy), no reset; "seal rig ... OFF", "source rig ... OFF". Announced in `contract_wave_m.md` |
| Rigs | seal rig used twice (blocked 15:10:31 - 15:14:10; unsealable 15:15:46 - 15:17:28), announced and "free" written; **OFF** (read 15:24). Source rig never switched by me: OFF (read) |
| My sessions | `SES-20261011-0062` -> `EV-20261011-0044` (layout, F-1); `-0063` created in the web UI, cancelled; `-0064` -> `EV-...-0045` (blocked, sealed by the web retry, verify PASS); `-0065` UNSEALABLE (quarantined; `EV-...-0046` does not exist); `-0066` -> `EV-...-0047` (healthy beside the notice); `-0067` -> `EV-...-0048` (lapse 1 below); `-0068` -> `EV-...-0049` (worker kill, interrupted, verify PASS). **None open**: `session/current` null at 15:24 (not by me - another client's session came and went after `-0068`) |
| Alerts | 56, **none active**; `ALR-000097` (UNSEALABLE, `-0065`) resolved by the supervisor's acknowledgement in the web bell |
| Selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` (read; never changed by me) |
| Lane 2 data | 45 items; chain `stored.ok true`, 1129 rows; quarantine now four folders (`-0041`, `-0045`, `-0052`, `-0065`: names only); error-level Core lines since the restart: 9, all the rig's (`SEALER_FAILED` x7, `SEALING_SESSION_UNSEALABLE`) and the kill's (`CAPTURE_FAULT` of `-0068`). Media-session rows from 3.1: 6 opens of `EV-20261009-0005` (with the Core's WARNING stop rows, one per stop outside its 60 s window) and 2 of `EV-20261008-0001` |
| Browser, helper | Chrome stopped, its profile removed; helper session signed out (204, then 401), jar removed; no jar of mine anywhere. The shared `.cache/gate-env/session_lane2_*.jar` was never written by me |
| Scratch | only `.cache/gates/wave-m-w/` |

Lapses of mine: (1) the first worker-kill attempt missed - my process pattern matched nothing and the
session's own stop arrived at the same second, so `SES-20261011-0067` is one extra healthy 22 s session
(sealed, `EV-20261011-0048`); the second attempt is 3.4. (2) one kept picture showed a 24-character
shortened manifest hash; it was masked in the file (`a3_after_retry_1.png`). (3) For two red-first runs the
dev server of lane 2 served the committed files of the files under test for about a minute each (about 14:52 and 15:02).

## 7. Decisions for the controller

- **D-1 (retry state).** "Sealing is being retried" on pill and ring also covers the retry RUN (own
  capture, FINALIZING, `attempt > 1`), so after a Core restart that resumes a seal the pill reads "SEALING
  RETRIED / The Core is running the seal again" until it is sealed. True as worded; the alternative (only
  between runs) shows "SECURE" during each run.
- **D-2 (ring, no notice).** A recording on a Core that reports no posture reads "RECORDING • NO FAULT
  REPORTED" instead of "SECURE • HEALTHY • RECORDING" (the second half of G75e-04's text, the one rule of
  wave L).
- **D-3 (blocked dialog).** The single statement is the ALERT's message; the step sentence ("... the Core
  now waits and does not run it again by itself") is no longer in the dialog where the message holds its
  cause. It stays on the banner.
- **D-4 (layout).** The audio rows show the development mark as an icon at 1280-1599 px (words kept for a
  screen reader); the input card scrolls at that size. Both change the simulated lane's look at that
  width too (CSS only).
- **D-5 (G89d-02 total).** "the items of this Core" = the replicated `evidence` slice (41 on lane 2: seed
  demonstration items included, as the list shows them).

## 8. Checks for the test runner, and the re-drive list

| Command | Lock | Expected |
|---|---|---|
| `npm test -w apps/core-web` (whole workspace, once per commit) | none | 0 failed |
| `npm run typecheck -w apps/core-web && npm run lint -w apps/core-web` | none | clean |

Re-drive (browser, lane 2, through the web origin, headless, muted): (1) G94d-01 -
`node .cache/gates/wave-m-w/tools/tamper.mjs <profile> http://127.0.0.1:5177 EV-20261009-0005 seek <label> <jar>`
(80 %, Play at once): sentence about 5.6 s after the open; `SEEK_FX=0.5`; then `EV-20261008-0001` with 0
probe requests. (2) rig `blocked`, one 45 s session: pill + ring during the 155 s (`tools/obs.mjs` samples
them), the dialog's cause once, `release`, "Retry sealing". (3) rig `unsealable`, then a healthy session:
ring "OPEN NOTICE • RECORDING"; acknowledge as supervisor. (4) a worker kill during a recording
(`pgrep -f -- "--heartbeat-ms"`, `kill -KILL`): no "Start recovery" in a 40 ms sampling. (5) Session New:
no chip at step 1 beside a sealed session; the two meter names; with `MIC-02` primary (NOT driven by me).
(6) Security & Audit: the sentence against `evidence` and the audit list. (7) Monitor of a sealed session
at 1440 x 900; and once at 1920 x 1080 (NOT driven by me: the wide layout was read in the CSS only).
(8) F-1: read again after any later restart only if the card's code changes.

## 9. Files

CHANGED (production): `components/shell/secure-pill.tsx`; `features/dashboard/{sim-adapter.ts,system-ring-panel.tsx}`;
`features/evidence/sealed-player.tsx`; `features/security-audit/{core-verify-rows.ts,tamper-panel.tsx}`;
`features/session-monitor/{inputs-panel,integrity-panel,live-feed-panel,seal-attention,status-banner}.tsx`,
`model.ts`, `session-monitor.css`; `features/session-new/{devices-step,index}.tsx`; `lib/seal-attention.ts`;
`i18n-web.ts` (one new block `web.waveM`, append-only).
CHANGED (tests, existing files only): `features/evidence/__tests__/wave-k-w-player.test.tsx`;
`features/session-monitor/__tests__/{situation-c,wave-i-b-seal-blocked}.test.tsx`;
`features/session-new/__tests__/{copy-round-live-words,session-new}.test.tsx`; `test/wave-l-w-real-core.test.tsx`.
Docs: this note; `delegation_progress/file_claims.md` (one line); `contract_wave_m.md` (the restart line and
the two rig lines). Plan table, `status_tasks.md`, `99_implementation_report.md`: not written (driver rules).

---
*Generated: 2026-10-11 15:27 WIB*
