---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave K, driver M1 (apps/mobile, WITH the tablet) - G94b-01, G94b-04, G81b-03, the mount warnings (G75c-02, G89b-03)
date: 2026-10-11
agent: coder-execution
narrative_tier: 3
tree: 57b80a9 + the working-tree edits of wave K (no commit, no git write)
status: needs-review
---

# 142 - Fix wave K, driver M1 (apps/mobile, tablet `emulator-5556`, lane 2)

Status **needs-review**, for two reasons, both outside what a mobile driver can close:

1. **G94b-01 is closed on the client and OPEN on the server.** The cause is the shape of the file
   the Core serves (no seek index). The need is filed for S2 (`file_requests.md`, line "wave K M1");
   no wave K server driver built it (`contract_wave_k.md` holds no such member). Until it exists the
   tablet says, truthfully, that a position cannot be chosen.
2. **The mount warnings cannot reach 0 from JavaScript.** The cause is read to the line in two
   libraries; the cure is a native change (one Gradle build), which the brief tells me to report
   first and not to do.

G81b-03 and G94b-04 are fixed and proven on the tablet.

Paths below are under `apps/mobile/src/` unless they start elsewhere. Scratch, logs and pictures:
`.cache/gates/wave-k-m1/` (not in git).

## 0. What was proven where

| Item | On the TABLET (lane 2, real Core) | On the tablet with a PROTOTYPE file | By test only |
|---|---|---|---|
| G94b-01 cause | slider value, player answer, no duration, no new Core request (section 1.1) | the same file shape reproduces it; the same bytes + one `sidx` cure it (1.2) | - |
| G94b-01 client | scrubber disabled + its sentence on the Core's real stream, before and after the lane restart; Play / Pause run on; a tap changes nothing | three taps 25 / 50 / 90 % land, Play goes on from there, both pictures | the hand-over, the request order, the 422 fall-back (17 tests) |
| G94b-04 | Play brings the player to the top of the pane (pictures) | - | 1 test |
| G81b-03 | reproduced on a fresh session (pane box ends at 580); after the fix on a second fresh session the box holds its content and the three controls answer real taps | minimal pane on the device: before / after | 12 + 4 tests |
| Mount warnings | counts and the OWNER COMPONENT of every failing tag, per flow | minimal cases | none (no product change) |

## 1. G94b-01 (MAJOR) - tablet seek never reaches its target

### 1.1 Diagnosis on the device (item `EV-20261010-0020`, 96 s, supervisor, media volume 0)

Temporary log lines in the player (removed), one tap on the scrub track at 50 % while paused:

```
onChange 48000 / onChangeEnd 48000                       <- the kit Slider hands over the right value
seekTo {ms 48000, seconds 48, lead0 48, dur -9223372474941440, status loading}
after 700 ms  {lead 0, follow 0, status readyToPlay}     <- the player took 48 s and went to 0
after 2500 ms {lead 0, follow 0}
sourceLoad {duration -9223372474941440}                  <- the player has NO duration for this stream
```

Core log of lane 2 over the same seek: **0 new lines** (no range request). So: the slider is right,
the player receives the seek, and the Android player answers it with position 0 without asking the
Core for anything.

Why: the sealed camera file is `ftyp moov(mvex) (moof mdat)*`, no `sidx`, no `mfra`
(`implementation/20_m3_worker_engine.md:268`; by design, `skip_trailer`). Media3 1.9
(`node_modules/expo-video/android/build.gradle:21`) plays such a progressive file with an
unseekable seek map and no duration, and maps every seek to 0. (That last sentence is the
library's known behaviour - `FragmentedMp4Extractor`, `ProgressiveMediaPeriod.seekToUs`; I did
NOT read it in this tree, only compiled artefacts are in the Gradle cache. The device lines above
and the prototype below are the proof.) A browser seeks such a file by probing ranges, which is why
the web console seeks.

### 1.2 Prototype on the device (what would cure it)

A generated 96 s file of the same shape (`ffmpeg ... frag_keyframe+empty_moov+default_base_moof+
skip_trailer`, a test pattern with a seconds counter, silent), served from a throw-away loopback
server on 127.0.0.1:8559 (an allowed fixture port; `adb reverse` added for the run and removed),
the player pointed at it by one temporary line (removed). No `Authorization` header went to it.

| File | `sourceLoad` duration | Tap 50 % (48 s) | Requests of the player |
|---|---|---|---|
| `plain.mp4` (no index) | unset | 0:23 -> **0:00** | none on the seek |
| `indexed.mp4` = the same bytes + ONE `sidx` box (496 bytes, 38 fragments) after `moov` | **97.3 s** | **0:48** | one `Range: bytes=<start of that fragment>-` per file |

With the index and the final client code: taps at 25 / 90 / 50 % read 0:23 / 1:29 / 0:48 (asked
24 / 86.4 / 48 s; the scrubber steps by 1 s and the track is 1142 px, so within 1 s - the UX spec
states no figure; the second player follows inside `PLAYER_SYNC_TOLERANCE_S`). Play after the
seek to 0:48: both pictures show the counter 53 at 0:52-0:53
(`evidence_indexed_play_from_048.png`). Thumb drags: `input swipe` from the thumb to 75 % -> 1:12
(72 s asked); explicit down / move / up to 65 % -> 1:04 (63 s asked). Two things I could not judge
without a finger: a drag that STARTS beside the thumb (78 px off) does nothing, and
`input draganddrop` (which holds before it moves) landed 7-15 s short twice. Neither is the
finding; both are for the re-check with a hand.

Scripts: `.cache/gates/wave-k-m1/proto/mksidx.py` (builds the `sidx` - the algorithm S2 needs),
`serve.py`.

### 1.3 Why the client cannot cure it alone

- expo-video takes one URL + headers; no hook for a seek map.
- A playlist built on the tablet (`data:` / `file:`) loses the `Authorization` header of the range
  requests: `node_modules/expo-video/android/src/main/java/expo/modules/video/utils/DataSourceUtils.kt:19-25`
  gives the header-carrying source only to an `http` URI.
- HLS from the Core would make every segment a NEW request; the media token gates the start of a
  request for 60 s (`apps/core-server/src/media-stream/service.ts`, decision D-90-9).

### 1.4 The need filed for S2 (`delegation_progress/file_requests.md`, "wave K M1")

Operation 88 gains one optional body member (proposed `seekIndex: true`) and echoes it; the media
route of such a session serves the INDEXED VIEW: init segment unchanged, one `sidx` built from the
signed manifest (timescale 1000, one reference per fragment: plaintext length, `mediaDurationMs`,
`keyframe`), every fragment unchanged; lengths and ranges are those of the view; the token says
which view it serves. The sealed bytes, hashes, export and Verify are untouched.
**State: not built in wave K** (S2's "consistent" line predates the request; KR did not take it).

### 1.5 What the client does now

| File:line | Change |
|---|---|
| `features/evidence/sealed-playback.ts:101-117` | `SeekAvailability`, `seekAvailabilityOf(duration)`: a duration = can be sought; none (0, NaN, infinity, Android's unset marker) = cannot |
| `features/evidence/sealed-player.tsx:129-161`, `:351-357` | the leading player's `sourceLoad` decides, per set of sessions; one `warn` in the persistent runtime log (`evidence.playback.seek`: item, file, whether the Core said it sent the index - never the source) |
| `sealed-player.tsx:159` `align`, `:306-308` `seekTo` | on a stream that cannot be sought NOTHING is written to a player: no seek, and the second file is no longer "re-aligned" (that write restarted it at 0) |
| `sealed-player.tsx:510`, `:523-527` Slider + caption | scrubber `isDisabled`, sentence `features.evidence-player.noSeek`: "A position cannot be chosen: the Core server sent this recording without a seek index. Play and Pause work." |
| `features/evidence/media-session.ts:100-146` | `SEEK_INDEX_MEMBER` (the proposed name, one constant); sent ONLY when the contract of this build holds the member (`registryKnowsSeekIndex()` reads `EvidenceMediaSessionRequestSchema` by name - today: not sent, the request is byte-for-byte as before); a Core that answers 422 to it is asked again without it, once; `MediaSession.indexed` |
| NEW `features/evidence/sealed-player-i18n.ts`, `i18n/features.ts` (+1 entry) | the sentence (M2 owns `features/evidence/i18n.ts`) |

On the real Core (before and after the lane restart): `uiautomator` reads the scrubber
`enabled=false`, the sentence, time running 0:06 -> 0:14 through a tap on the track
(`evidence_noindex_disabled.png`, `evidence_real_core_no_index.png`,
`evidence_after_restart_player.png`). The playhead no longer jumps to 0:00.

Known and unchanged: after a session RENEWAL (a pause past 60 s, then Play) the player still starts
the new stream from 0:00 on a stream without an index - it cannot do otherwise; the time shown is
the player's own. It ends with the index.

## 2. G94b-04 - Play started the player below the fold

`features/evidence/evidence-detail.tsx:126-130`, `:287-295`, `:415`: a ref on the detail's scroll view, the tabs block reports
its `y` (`onLayout`, testID `evidence-detail-tabs-block`), the Play action calls
`scrollTo({ y, animated: false })` after it raises the play token (my lines only; M2 holds the
Export block of that file). On the tablet: after Play the tab row is the first line of the pane and
both pictures, the scrubber and Pause are on screen (`s9.png`, the three pictures above).
NOT done: the action bar still reads "Play" while the player plays (the gate's second sentence);
the player's own button reads "Pause".

## 3. G81b-03 (MAJOR) - Summary controls take no tap on the tablet

### 3.1 Reproduced

Past sessions opened by their route did NOT show it (three tried: pane box = content). A fresh
session did (`SES-20261011-0034`, 67 s, FAKE sources): Summary scrolled to its end,
`pane-summary [1085,176][2400,580]`, `summary-actions` at y 1376, `summary-sealed-members`
492-1344. The pane is short by exactly the "Sealed files" block, which arrives from the Core after
the pane mounted.

### 3.2 Cause - one minimal case on the device

A pane whose content grows 1.5 s after its mount (40 dp -> 400 dp, a button at the bottom), the app
launched with `motion=off` as every gate launches it:

| Wrapper | Box after the growth | Tap on the button |
|---|---|---|
| the shared `Pane` (`layout={PANE_REFLOW}`, `ReduceMotion.System`) | stays 40 dp | not delivered |
| `Animated.View` + `LinearTransition...reduceMotion(ReduceMotion.System)` | stays | not delivered |
| `Animated.View` + `LinearTransition.duration(0).reduceMotion(ReduceMotion.Always)` (what `layoutTransition()` returned when reduced) | stays | not delivered |
| `Animated.View` + `LinearTransition...reduceMotion(ReduceMotion.Never)` | grows | delivered |
| plain `View` | grows | delivered |
| the shared `Pane` AFTER the fix | grows | delivered |

So: on this stack (Reanimated 4.5.1, new architecture) a layout transition that is REDUCED is
skipped without the new frame being applied. It hits every user with reduced motion, and every
gate. `layout/pane-layout.tsx` gave every pane such a transition.

### 3.3 Fix - once, in the two shared places

| File | Change |
|---|---|
| `layout/pane-layout.tsx:20-33`, `:117` | `paneReflowFor(policy)`: the spring under full motion, NO `layout` prop under reduced motion; `Pane` reads `useMotionPolicy()` |
| `motion/builders.ts:258-272` `layoutTransition` | reduced = `undefined` (was a zero-length `ReduceMotion.Always` transition - the third row above). One caller: `features/dashboard/system-status-card.tsx:85` (M2's folder; not edited, the prop takes `undefined`) |
| `layout/index.ts` | exports `paneReflowFor` |

### 3.4 Proof on the tablet

Second fresh session `SES-20261011-0035` (64 s, FAKE sources), Summary scrolled to its end:
`pane-summary [1085,176][2400,1488]`, `summary-actions [1085,1376][2400,1488]` inside it
(`evidence_summary_fresh_after_fix.png`). Real taps: "Transcript hash" row -> the hash sheet opens;
"View in Evidence" -> Evidence detail, Core line `POST session/:id/summary/acknowledge 204`;
"Done" -> Home (pressed on the same session's Summary reopened by its route, since the first
button had left the screen - the two buttons are one row of the same pane).

### 3.5 The same pattern elsewhere - what I checked

- Every screen that uses the shared `Pane` gets the fix with it: audit, dashboard, devices,
  evidence list, network-time, pairing, session-finalizing, session-live, session-new,
  session-recovery, session-summary, sessions, settings, storage.
- Tablet, by the view tree (a control whose top edge is below its pane's bottom edge while on
  screen), at the top and scrolled: Home, Sessions, Evidence, Devices, Storage, Network & Time,
  Audit, Settings, Session New step 1 - 0 on each.
- Other Reanimated layout transitions in the source: only `components/composed/session-timeline.tsx`
  (already none when reduced). Now a static rule.
- Phone: NOT driven (the phone is idle and its lane is stopped). By code and test: the phone
  Summary's one pane had the same transition, so its "Sealed files" rows were exposed to the same
  fault; its two buttons are pinned outside the scroll view, which is why the gate saw them work.
- No absolutely positioned content in `features/session-summary/` (grep: none).

## 4. Mount warnings ("Unable to find SurfaceMountingManager") - cause found, NOT removable in JS

### 4.1 What it is (read from one stack and four library files)

Every line is `Reanimated: synchronouslyUpdateUIProps failed for tag N`, and its stack ends in
`com.horcrux.svg.VirtualView.setClientRect` <- `SvgView.onDraw`. The chain:

1. `node_modules/react-native-svg/android/src/main/java/com/horcrux/svg/VirtualView.java:585-620` -
   every SVG element dispatches a layout event from INSIDE Android's draw pass when its rectangle
   is new (so: once per element of every icon drawn for the first time). Unconditional.
2. `node_modules/react-native-reanimated/android/src/main/java/com/swmansion/reanimated/NodesManager.kt:126-135, :195-212` -
   Reanimated listens to every event; inside a draw pass it calls `performNonLayoutOperations`.
3. `.../Common/cpp/reanimated/NativeModules/ReanimatedModuleProxy.cpp:815-824` + `Fabric/updates/UpdatesRegistry.cpp:165-175` -
   that pushes the props of EVERY view in its registry (`getPendingUpdates` returns the whole
   registry, it removes nothing) straight to the native views.
4. `.../android/src/main/java/com/swmansion/reanimated/NativeProxy.kt:248-262` - a tag with no
   mounted view makes React Native throw `RetryableMountingLayerException`; Reanimated catches it
   and logs the warning with the whole stack.
5. A view that React has just removed stays in that registry until the mount hook
   (`Fabric/ReanimatedMountHook.cpp:51`) runs - after the draw pass of the same frame.

So **warnings = (kit-animated views removed in a commit) x (SVG elements first drawn in the same
frame)**. Nothing is wrong on screen; the props of a removed view have no target.

### 4.2 Proven on the device: the owner of every failing tag

A temporary recorder (React's commit hook: tag -> owner chain; removed) answered for each failing
tag; `dumpsys activity top` confirmed each is NOT in the view hierarchy afterwards.

| Flow | Lines | Tags | Who owns the tags (all REMOVED in that commit) |
|---|---|---|---|
| Session New open + fill | 0 | - | |
| **Next = the pre-check commit** | **192** (run 1), **208** (run 2) | 4 x 47-52 | step 1's controls: two `Select.TriggerIndicator` (investigator, room), the `session-new-scan` Button, the `session-new-profile-menu` Button |
| to Ready | 0 | - | |
| **Session Live mount** | **8** | 1 x 8 | the `monitor-mic-switch` Button (a first copy replaced) |
| stop -> Finalizing -> Summary | 0 (both runs) | - | |
| **item opening** | **79**, **19** (two items) | 1 | the kit `Spinner` of `evidence-transcript-loading` (TranscriptPane) |
| **Verify, five presses** | **77 each (385)** | 1 | the kit `Spinner` inside `evidence-verify` |
| **player open** | **6** | 2 x 3 | the `evidence-playback-open` Button and its `Spinner` |
| **export wizard to "Reason"** (no export made) | **2** | 1 | the kit `Spinner` of the verify-source step |
| Evidence list mount (seen once) | 395 | 40 x 10 | the row `PressableFeedback` and row-menu Buttons of a first copy of the list |

Minimal cases on a scratch panel (all 0): 30 icons alone; one animated view alone; both in one
commit; a kit Spinner replaced by 30 icons after 80 ms / 1.5 s; a running animated view replaced
by icons. A light commit clears the registry before the next draw; the real screens' heavier
commits do not. The class is therefore every kit control with press feedback (each `Button`, each
row, each `Select`) plus the Spinner - not the Spinner alone, which is why wave I's screen-by-screen
spinner swap could not reach 0, and why I changed NO product file for this item: there is no
shared JavaScript place that stops a kit control from being in Reanimated's registry, and none that
stops the SVG events.

### 4.3 What reaches 0 (native; needs ONE Gradle build - not done, reported first as told)

| Option | Change | Note |
|---|---|---|
| **A (recommended)** | `react-native-reanimated` `NativeProxy.kt:253-258`: skip a tag that has no mounted view (the non-enforcing lookup of the mounting manager) before `updatePropsSynchronously`; 3-4 lines, through the project's patch mechanism | exact, silences nothing else; the props of a view that is gone have no target |
| B | `react-native-svg` `VirtualView.java:610-620`: dispatch the layout event only when an `onLayout` handler exists | removes the trigger for every listener; wider behaviour change |
| C | accept and re-word the acceptance of D217 (2) / row 87's criterion: "0 lines that name a MOUNTED view" | no build; the count stays |

No upstream issue is cited: I searched nothing on the network.

## 5. Tests and checks (each once after its fix)

| Command | Result |
|---|---|
| `npx jest src/features/evidence/wave-k-m1-seek.test.tsx` | 17 passed (seek hand-over at 25 / 50 / 90 %; no write on a stream without an index; the request order; 422 fall-back with its control; bring-into-view) |
| `npx jest src/layout/wave-k-m1-pane-reduced.test.tsx` | 12 passed (no `layout` prop under the three reduced causes; control under full motion; three static rules) |
| `npx jest src/features/session-summary/wave-k-m1-tablet-taps.test.tsx` | 4 passed (tablet + phone; Done acknowledges and leaves; control) |
| `src/motion/builders.test.ts` (one case moved by delta) | passed |
| attribution run: the evidence player tests, `session-summary`, `layout`, `motion`, `i18n` | first run 24 of 25 suites: 1 red, mine (`live-evidence-static.test.ts`, the file-list pin: + `sealed-player-i18n.ts`), moved by one line, re-run 12 passed. 268 tests |
| `npm run -w @dems/mobile typecheck` | exit 0 (two typing errors of my new tests fixed first) |
| `npm run -w @dems/mobile lint` | 0 errors, the 1 known warning (`runtime/log.test.ts:160`). One error of mine fixed first (a state write inside an effect in the player) |

Red-first: no git write, so no red run on the old code. Controls kept in the same files: the
re-alignment and the seek under a stream WITH a duration, the full-motion pane, the non-422
refusals. The device tables of sections 1 and 3 are the "before".

## 6. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm run -w @dems/mobile test` | none | 0 failed; +3 files of this driver (33 tests) beside M2's |
| `npm run -w @dems/mobile typecheck`, `lint` | none | 0 errors; the one known warning |

## 7. Re-drive list (device)

1. G81b-03, tablet AND phone: fresh session, Summary to its end: `pane-summary` holds
   `summary-actions`; a "Sealed files" row, "View in Evidence", "Done" each answer. Launch once
   WITHOUT `motion=off` too (the spring path was only tested, not driven).
2. G94b-04: Play in the action bar -> the player is on screen.
3. G94b-01 today: scrubber disabled with its sentence; a tap does not move the playhead.
   AFTER the server sends the index: the sentence is gone, three seeks, Play from there, a drag
   with a finger (start beside the thumb; a held drag), a seek after 60 s (renewal), the phone.
4. Mount warnings: only after a ruling on section 4.3.

## 8. Decisions for the controller

1. **Indexed view on the media route** (section 1.4): build it (a server row + a lane restart +
   one registry member; the client then needs the ruled name in `SEEK_INDEX_MEMBER` and nothing
   else), or rule that the tablet has no seek. G94b-01 stays open on the server until then.
2. **Mount warnings**: option A, B or C of section 4.3. A and B need the one Gradle build.
3. **Reduced motion = no pane re-flow animation** (it was meant to be instant already; it is now
   truly none). Full motion is unchanged.
4. The sentence for a stream without an index is new product copy (section 1.5).
5. `layoutTransition()` now returns `undefined` when reduced - `system-status-card.tsx` (M2's
   folder) takes it as it is.

## 9. State left (01:50 WIB)

| Item | State |
|---|---|
| Lane 2 | RESTARTED by me at **01:39:49-01:39:51** (after "KR consistent at 01:19"): `stop 2`, `start 2 --with-camera-stub --speech-mic`, output in `.cache/gates/wave-k-m1/start_2.log` (0600, not read into this note). PID 26649. New stub ports and fixture account (not read) |
| `ALR-000016` | **cleared at the restart**: active before, `active false` after; no active alert |
| Selector | `CAM-01` / `CAM-02` (profile now `H264_720P30`, corrected by the start) / `MIC-01` PRIMARY / `MIC-02` STANDBY, `locked false`; no local device selected at any time |
| Session | none open. Two sessions made, both SEALED on FAKE sources: `SES-20261011-0034` / `EV-20261011-0023` (67 s; its summary was left without "Done" - the next session started normally) and `SES-20261011-0035` / `EV-20261011-0024` (64 s, acknowledged) |
| Lane 2 data | media-session, verify (5 on `-0021`) and audit rows from my playbacks on `-0020`, `-0021`, `-0022`, `-0024`; no export made (the wizard was closed at "Reason"); no item state changed |
| Seal rig | OFF (status read only) |
| Tablet | on Login, "Core online", "paired as DEV-0001", reverse rules 8081 and 4420 -> 4422 only (the 8559 rule removed); not locked, no lock touched, no fingerprint; relaunched with `motion=off` |
| **Media volume** | **4 of 15, not 5**: muted with volume-down keys for every playback; five volume-up keys brought it to 4 and four more did not move it. One step to put back |
| Helpers | loopback server stopped; helper session signed out (204), jar removed; no temporary code in `apps/mobile/src` (`grep KM1` = 0; the two scratch files are in `.cache/gates/wave-k-m1/diag-src/`) |
| Phone, lane 1 | not touched |

---
*Generated: 2026-10-11 01:50 WIB*
