---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave Q, driver Q-M (apps/mobile; tablet emulator-5556 lane 2, phone emulator-5554 lane 1; NORMAL launch form)
date: 2026-10-12
agent: coder-execution (rules D94 / D122 / D163; briefs fix_brief_wave_j.md, fix_brief_wave_l.md; decision D246)
narrative_tier: 2
status: needs-review - CT-01 is a PRODUCT defect whose main cause is found (a library path) and whose amplifiers are removed, but the timer still stands for 8-11 s at moments of a recording and the cause of that remainder is NOT established; End Session is 10 of 10 in every sample after the fix; whole mobile suite green on its second run
tree: b4b0c25 + this wave (no git write, no Gradle build, no install)
evidence: .cache/wave-q/m/ (0700): rec/q1..q8.mp4, logs/rec*_meta.txt, logs/rec*_full.txt, logs/presses_*.txt, logs/suite1.log, suite2.log, view/*.jpg, tools/
---

# 176 - Fix wave Q, driver Q-M

## 1. The quiet window (13:42 - 14:05, 23 minutes)

**The host could not be brought below a 1-minute load of 3.** With nobody else running anything the load
stood at 5.4 - 7.1. Its makers (`ps`, 13:47): the tablet emulator alone 175 - 260 % CPU with the app in
the foreground (the app's own ambient animations: 118 % inside the guest on Home, 96 - 185 % on Login),
the user's Chrome about 85 %, WindowServer 50 %, the Claude desktop app 30 %; all processes together 400 %
of 1000 % (60 % idle). The phone app was force-stopped for the window. I measured at that floor and say so;
"quiet" below means "nobody else ran a test, a browser or a build".

### 1.1 CT-01 - numbers

| | Rec 1 `SES-20261012-0107` | Rec 2 `-0108` | Rec 3 `-0109` | Rec 4 `-0110` (reduced motion) |
|---|---|---|---|---|
| App process | **PID 6945, running since before 12:40 (judge C1's whole hour)** | fresh (force-stop + normal launch, 1 min old) | the same, 5 min old, after 5 rounds through all eight rail pages | the same, 9 min old |
| Host load 1-min, start / end | 6.95 / 10.07 | 6.24 / 10.15 | 4.63 / 8.80 | - / 8.62 |
| `motion.uiRuntime.stalled` records | **2** (25 s and 91 s after the start) | 0 | 0 | 0 |
| Screen switched to the fallback form | **yes, twice** (and back at 13:49:31) | no | no | n/a |
| Longest stretch the timer stood (film, 1 frame/s) | **about 52 s** (at 00:00:36), then about 27 s (at 00:01:28) | 4.5 s (the "Connecting cameras" phase, no timer drawn) and 2.4 s | 7 s (at 00:00:45, with the End dialog open) | not filmed |
| Audio Monitor sheet after its press | **not open after 17 s** (never seen in the 130 s film) | 0.5 - 0.8 s (film at 4 frames/s) | under 5 s (capture) | - |
| Core link | **lost for about 50 s** ("Core link lost - recording continues on the Core"; End Session disabled) | kept | kept | kept |
| logcat lines in the buffer | **770,000+** (the ring buffer was full; logd 92 % CPU, kswapd 37 %) | 18,592 | 6,983 | - |
| `W/Reanimated synchronouslyUpdateUIProps failed for tag N` | **4,519 in the buffer, on 73 distinct tags**, bursts of 1,480 and 1,188 in one second | 88 on 8 tags | 16 on 2 tags | 8 |
| Threads (`top -H`, 8 samples) | JS 25 - 45 %, UI 19 - 37 %, RenderThread 5 - 40 %; guest: sys 96 - 164 %, irq 48 - 118 % | JS 10 - 62 %, UI 21 - 54 % | similar | - |
| `gfxinfo` janky frames / 99th percentile | 27.6 % / 300 ms | 17.7 % / 101 ms | 24.1 % / 150 ms | - |
| Recording length | **4:04** (the device could not end it earlier) | 1:00 | **2:25** (my end step missed once) | 1:09 |

**Verdict: CT-01 is a product defect, present with nobody else on the host. It is not a starved-host
artefact - and it depends on how long the app process has lived.** In the process the judges had used for
an hour the tablet was unusable 25 s into a recording; a one-minute-old process on the same host recorded
60 s without one stall.

### 1.2 The cause that was found (file:line)

`react-native-reanimated` 4.5.1, Android:
`android/src/main/java/com/swmansion/reanimated/NodesManager.kt:205-213` - every event dispatched on the UI
thread calls `performOperationsRespectingDrawPass()`; inside a draw pass that is
`performNonLayoutOperations()` -> `Common/cpp/reanimated/NativeModules/ReanimatedModuleProxy.cpp:815-823`
-> `UpdatesRegistry::getPendingUpdates()` (`Fabric/updates/UpdatesRegistry.cpp:165-175`), which returns
**every entry of the registry**, not the pending ones -> `NativeProxy.kt:248-262`
`synchronouslyUpdateUIProps`, which for each tag whose native view no longer exists catches a
`RetryableMountingLayerException` ("Unable to find SurfaceMountingManager for tag") and **logs it with its
stack** (`Log.w(..., e)`, about 190 frames inside a draw). The events that arrive inside a draw pass are
`react-native-svg`'s layout events: `VirtualView.setClientRect` (`VirtualView.java:586-616`) dispatches one
per SVG element whose rectangle changed - every icon of a screen when it mounts (3,755 of the 4,114
failures of the first buffer came through that frame; 220 through `ScreenFragment.dispatchTransitionProgressEvent`).

So one mount of a screen costs (SVG elements) x (registry entries of dead views) exceptions with a stack
each, on the UI thread. In the hour-old process 73 dead tags stood in the registry (22 of them from before
my sign-in, about 95 failures each during 2 minutes); in the fresh process 2 - 9 tags failed for 2 - 3 s
after a transition and were then removed. **Why the entries of the old process were never removed is NOT
established** (tried and ruled out, each probed by "does a tag fail again 10 s later": one forced
whole-tree remount, a Login left idle for 7 minutes before the sign-in, scrolling both lists and leaving
their tabs, a reduce-motion switch on and off, three recordings - none left a persistent tag).

The amplifier that was ours: `src/motion/ui-runtime-watch.ts:176-202` (wave J's heartbeat) took five
unanswered beats for a stopped animation runtime and `motion-policy-provider.tsx:172` then remounted EVERY
screen (`<Fragment key=...>`), twice per suspicion - each remount is exactly the mount burst above, so the
detector produced the stall it had detected, flipped End Session between "hold" and "tap", and dropped
open dialogs.

### 1.3 What was changed for CT-01, and what the same measurement says after it

| Change | Where | Test |
|---|---|---|
| The heartbeat tells a STOPPED mapper loop from a BUSY device: each beat goes out through a reaction AND as a direct job (`scheduleOnUI`); only "the direct job came back, the reaction did not" counts as a miss; nothing back = busy = no judgement (one `warn` `motion.uiRuntime.busy` per stretch); a late JS beat is not judged | `src/motion/ui-runtime-watch.ts` (`useUiRuntimeWatch`) | `src/motion/ui-runtime-watch.test.tsx` "CT-01: a BUSY device ...", "CT-01: busy beats between real misses ..." |
| The timer: already drawn from the Core clock by a plain timer (`src/runtime/recording-elapsed.ts:83`); no change - a standing timer is a standing UI or JS thread | - | - |
| End Session, the open dialog, the keyboard: sections 1.4 and 2 | | |

After the change, tablet, normal launch, process 48 - 55 minutes old with six sessions behind it
(`rec7`, `rec8`; `rec5` 17:54 long):

| | Rec 5 (`-0113`) | Rec 7 (`-0116`) | Rec 8 (`-0117`, filmed WITHOUT screen captures) |
|---|---|---|---|
| Host load start / end | 12 / 21 (Q-W's runs + my own jest on purpose) | 7.2 / 17.8 | 13.0 / 10.5 |
| `motion.uiRuntime.stalled` / fallback switch | **0 / none** | **0 / none** | **0 / none** |
| `motion.uiRuntime.busy` (warn) | 3 | 1 | 0 |
| Failed synchronous updates / distinct tags | - | 18 / 3 | 87 / 9 |
| App ERROR records, `Worklets`, duplicate-key | 0, 0, 0 | 0, 0, 0 | 0, 0, 0 |
| Longest timer standstill (film) | - | 10 s twice (screen captures ran during the film) | **8 s (at 00:00:09) and 11 s (at 00:00:35, from the tap that opened the End dialog)** |
| Audio Monitor sheet | - | 16.9 s (with captures) | open within the 6 s before its close tap (film) |
| Mic-switch confirmation (JM-06) | - | 0.8 s | - |

**CT-01 is therefore improved, not closed.** The screen no longer switches form and the app logs no error,
but the timer still stood for 8 and 11 s in a recording on a host at load 10 - 13 (both emulators' own
load; the phone app was up again). That remainder is not the exception flood (87 failures) and its cause is
not established - the first seconds of a recording and the opening of a sheet or dialog are where it sits
(wave J2 measured the same at recording start, JM-05). It needs a JS profile in a RELEASE build; neither
was possible here (no Gradle build).

### 1.4 JT-09 - End Session

| Sample | Host load | Result |
|---|---|---|
| BEFORE the fix, quiet window, 2.0 s holds: rec 1 (old process, fallback form) | 7 - 10 | **1 of 5** (4 lost in the fallback form) |
| BEFORE, rec 2 and rec 3 (fresh process, full motion) | 5 - 10 | 4 of 4, 4 of 4 |
| BEFORE, reduced motion (the app's switch), taps, rec 4 | 8.6 - 11.2 | 10 of 10 |
| AFTER, tablet, full motion: 10 taps + 10 holds of 2.0 s | 9.3 - 12.3 (Q-W's runs) | **20 of 20** |
| AFTER, tablet, loaded ON PURPOSE (`npx jest src/features/evidence` in parallel): 5 taps + 5 holds | 12.7 -> 21.5 | **10 of 10** (the first after 19 s, the others after 1 - 4 s) |
| AFTER, tablet, final recording: 5 taps + 5 holds | 7.2 -> 21 | **10 of 10** |
| AFTER, phone, full motion: 5 taps + 5 holds | 7.9 | **10 of 10** |

Cause of "4 of 6" (`src/features/session-live/end-session.tsx`, before): under `reduced` (the fallback form
the heartbeat switched to in mid-recording) `onLongPress` returned at once, and the platform delivers no
`onPress` after a long press - **a HOLD was the one gesture that could not end a session in that form**,
and a tap did nothing in the full form; the form changed under the finger. Fix (the ruling): every completed
touch - a tap, a hold that reaches 1.5 s, a release whose own timestamps say 1.5 s - opens the SAME reason
dialog in both motion modes; one hint in both ("Tap or hold. A reason is asked before anything ends.").
An open dialog is no longer closed by a moment of "connecting" (seen live after a link resync: the dialog
went with the typed reason and left its keyboard). With the link lost the button is disabled and says why.
Tests: `session-live-screen.test.tsx` "a tap opens the reason Dialog ...", "JT-09 (full motion / reduced
motion) ..."; `situation-c.test.tsx` "an End dialog that is already open stays open ...".

NOT a "quiet host" proof: no sample after the fix ran below load 7 (section 1, and Q-W worked from 14:05).
One loaded-host sample before my detector was improved lost the Core link (button disabled, 8 presses not
countable) - disclosed in `logs/presses_t_full_loaded.txt`.

## 2. Every finding

L = proven live in the normal launch form; T = by test. Paths under `apps/mobile/src/`.

| Id | Sev. | Result | Cause -> change | Test (existing file) | Proof |
|---|---|---|---|---|---|
| CT-01 | MAJOR | **PART** | section 1.2 / 1.3 | `motion/ui-runtime-watch.test.tsx` | L (numbers above); remainder open |
| JT-09 | MINOR | fixed | section 1.4 | `session-live/session-live-screen.test.tsx`, `situation-c.test.tsx` | L 40 of 40 |
| CP-01 | MAJOR | fixed | The controller's hypothesis held: `maintainVisibleContentPosition={{ disabled: true }}` (wave J) takes FlashList's scroll anchor away; the list then corrects its offset itself while it measures. Reproduced on the phone 2 of 3 with it, 0 of 2 without. -> `lib/list-position.ts` `LIST_KEEP_POSITION` (`autoscrollToTopThreshold`), used by `evidence/evidence-list-screen.tsx` and `sessions/sessions-screen.tsx` | `evidence/evidence-list.test.tsx` "JM-03 + CP-01", `sessions/sessions-screen.test.tsx` "CP-01 + JM-03" | L: first openings after a sign-in correct 4 of 4 Evidence (phone x3, tablet x1) and 4 of 4 Sessions; NOT six per device |
| CT-02 | MINOR | fixed | same cause | same | L tablet: Sessions "Incomplete · 6", Evidence Recorded -> All, search and clear |
| JM-03 (re-proof) | MAJOR | holds | a reader at the top is scrolled to a new first row; a changed search or filter starts at the top (`useTopOnQueryChange`: found here - with the anchor, clearing a search left the list standing at the old item) | `evidence-list.test.tsx` "a changed search takes the list to its first row" | L tablet `EV-20261012-0084` first row after Done, no pull; phone `EV-20261012-0021` first row |
| CT-03 / CP-03 | MINOR | fixed | `evidence/evidence-row.tsx`: the chip sat in the trailing column and took the body's width -> a failed verification has a line of its own; names wrap to two lines | covered by `evidence-list.test.tsx` "JT-04" (the chip's test id and words) - no layout assertion | L both devices |
| JT-08 | MINOR | fixed | `components/composed/glow-ring.tsx:240` - the words were visible ONLY through an animated style; React's own value was the opacity 0 of the mount, re-applied after a dropped settled value. -> the content RESTS in a plain style once the runtime reports the value 1 applied | `components/composed/glow-ring.test.tsx` "JT-08 (full motion)", "(reduced motion)", "a replay" | L: after Done of the rig session (blocked -> release -> Retry sealing) and after Done in a 55-minute-old process the words are there. A first version (rest on a JS timer) left them DIM on the loaded tablet - corrected |
| JT-23 orig. / JM-04 / CT-06 / CP-02 / CP-13 | MINOR | fixed | `lib/keyboard.ts`, `lib/keyboard-guard.tsx`, `lib/sheet-open.ts`: ONE rule - a sheet that opens or closes, a dialog with a field that closes (`end-session.tsx`), a route change put the keyboard away through BOTH focus owners (React Native's and the keyboard library's); a keyboard that is up with no focused field is hidden by the guard, which keeps looking while a keyboard is up | `lib/sheet-open.test.tsx` "the keyboard's one rule" (5 cases) | L: keyboard gone 2 s after End Session (tablet x3, phone) and 2 s after "Export" on the phone - the result, "Demonstration: no archive is written." and "Done" all visible; one orphan keyboard hidden by the guard on the tablet. CT-06's typing-behind-the-sheet case: T only |
| CT-04 | MINOR | fixed | `providers/toast-area.tsx` (the kit's `contentWrapper`): toasts lie under the header row and beside the rail; `alerts/alert-toasts-model.ts` `alertToastLabel`: the first sentence only; `alerts/i18n.ts`: "It stays until it is acknowledged or the Core reports it resolved. The bell keeps it until it is acknowledged." | `providers/app-providers.test.tsx` "CT-04", `settings/settings-model.test.ts` "CT-04", `dashboard/home-live.test.tsx` | L tablet (seal blocked: title, clock, bell, account, rail free) and phone (STORAGE_FULL: header and tab bar free; it left on the clear, the bell kept the alert) |
| CP-06 | MINOR | fixed | `settings/settings-model.ts` `NOTIFICATION_KINDS` listed CAMERA_LOSS and AUDIT_TAMPER under switches -> switches list only what they silence; critical kinds from `FAULT_SEVERITY` are named apart as "always shown" | `settings-model.test.ts` "CP-06", `settings-screen.test.tsx` | L phone |
| CT-05 | MINOR | fixed | `runtime/session-route-sync.tsx`: in LIVE mode a session this device never stood on a flow screen of does not navigate; `runtime/foreign-session-signal.ts` + `sessions/foreign-session-toasts.tsx` tell it once per phase | `runtime/session-route-sync-live.test.tsx` (the D169 case REPLACED, a control, two CT-05 cases) | L tablet: `SES-20261012-0115` run through the API as OPR-001 - the tablet stayed on Network & Time through end and seal, toast shown |
| CT-07 | MINOR | fixed | `settings/settings-model.ts` `demoControlsAccess`: the flag first - on a Core without it every role reads the one caption | `settings/settings-live-model.test.ts` | T only (no technician sign-in was made) |
| CT-08 | MINOR | fixed | `session-new/configured-profile.ts`, `session-info-step.tsx`, `ready-step.tsx`: own capture -> the selector lines in force, never the `profileId` label | `session-new/session-new-screen.test.tsx` "CT-08" | L tablet: "VIDEO-01: H264_720P30 · VIDEO-02: H264_720P30" |
| CP-04 | MINOR | fixed | `evidence-row.tsx` row menu: Verify disabled with "Not sealed — nothing to verify" | none added (gap) | L phone |
| CP-05 | MINOR | PART | Evidence rows (`isDemoItem`) and Sessions rows (`useSimulatedCoreLink`) carry a "DEMO" chip (spoken "DEMONSTRATION"). Not done: Home rows (they make no sealed statement), the size and hash rows of Summary / item, the Finalizing step names, export step 2 | `evidence/live-evidence-static.test.ts` (idiom list) only - gap | L phone; on lane 2 the seeded item the Core sealed itself is NOT marked (first version marked it - corrected) |
| CP-07 | MINOR | fixed | names two lines (rows, item Subject), the never-sealed line two lines | none (gap) | L phone |
| CP-08 | MINOR | fixed | `evidence/evidence-chips.tsx` `neverSealed`: "Not sealed", warning tone, in row, header, Status fact | none (gap) | L phone row; header and fact not looked at |
| CP-09 | MINOR | PART | landscape Home: action above the tiles, labels shrink before they are cut (`dashboard-screen.tsx`, `quick-actions.tsx`, `status-tiles.tsx`). Not fixed: the action is only partly above the fold; the status-bar clock over the rail; the 2 - 4 s of landscape arrangement after rotating back (the navigation chrome is rebuilt late) | none | L phone |
| CP-10 | MINOR | fixed | "Simulated Core · demonstration" chip on the Devices Check and the monitor's strip (`devices-check-step.tsx`, `status-strip.tsx`) | `session-new/live-session-new-sites.test.tsx` (pin adapted) | L phone |
| JA2-20 / JA2-27 | MINOR | fixed | search hints "Search ID, subject or case" (whole on both devices; full sentence spoken); the two reason lines are one block with the action bar (`evidence-detail.tsx`) | none | L hints; the reason block was not looked at after the change |
| JA2-32 | MINOR | **not fixed** | the kit `Chip` IS a React Native `Pressable`, which always sets the native click listener; role "text" and no pointer events are already set (wave J). Removing `clickable` needs a chip that is not the kit's - a ruling |
| CP-11 | NOTE | = CT-01 | | | |
| CP-12, CT-N1, CT-N2 | NOTE | not done | "TABLET" in audit rows and "Finished exports: not reported" are the Core's values; no "Acknowledge all" in the device bell (a feature); the rest not reached |
| CT-N3 | NOTE | not the product's | debug build toast |

Counts: MAJOR 1 fixed (CP-01), 1 part (CT-01); MINOR 16 fixed, 2 part (CP-05, CP-09), 1 not fixed (JA2-32); NOTES 0 worked.

## 3. The 9 + 9 rows the judges did not re-drive

| Id | Now |
|---|---|
| JM-06 | driven: mic-switch confirmation 0.8 s after its press (tablet, load 7 - 17) |
| JM-09 | superseded in part by CT-05 (live); the sign-in case keeps wave J's notice - seen live on the phone (Summary of Q-W's session with the sentence) |
| JA2-08 / JT-11 | not driven; `features/evidence/session-annotations.test.tsx` (not run alone here; in the green suite) |
| JT-10 | not driven; `features/evidence/playback-link.test.ts` |
| JT-13 / JA2-22 | not driven; `components/composed/stepper.test.tsx` "JA2-22" |
| JT-22 | not driven; `features/session-new/session-new-screen.test.tsx` "JT-22" |
| JM-08 | not driven; `features/evidence/play-sheet.test.tsx` "JM-08" |
| JA2-17 | not driven; `features/session-recovery/session-recovery-screen.test.tsx` |
| JT-14, JM-07, JA2-15, -21, -23, -24, -26, -31 | **neither driven nor checked against a test by me** - open |

## 4. Proof at the end

| Check | Result |
|---|---|
| `npx tsc --noEmit` (apps/mobile) | no output |
| `npm run -s lint` (apps/mobile) | no output (first run: 1 error `react-hooks/set-state-in-effect` and 2 warnings, mine - fixed) |
| whole mobile suite, run 1, load 5.4 at the start | **1 suite failed, 2 tests** (`pairing/pairing-handoff-routes.test.tsx`: a static pin of `app/_layout.tsx`; my keyboard guard stood inside the boot gate - moved out) |
| whole mobile suite, run 2, load 4.9 at the start | **281 suites, 3,152 tests passed, exit 0**, 172 s (`logs/suite2.log`) |
| logcat over the device proofs | 0 app ERROR records, 0 `Worklets`, 0 duplicate-key in the windows read (rec 5, 7, 8, the phone session, both final launches). Not app records but ERROR-level lines: one `E/unknown:MountItemDispatcher` SoftException (a blur sent to a removed field, phone export); earlier, while files were half-saved, one `Property 'useState' doesn't exist` route error on the phone (my own edit in flight) and the QUIET-WINDOW records of section 1.1 |

## 5. Disclosures

- Recordings over 60 s: `-0107` 4:04, `-0109` 2:25 (quiet window), `-0113` **17:54** (40 End Session presses and two reruns of a detector that mis-read), `-0116` 5:00. FAKE sources only; `CAM-03` / `MIC-03` never selected, pre-checked or started.
- Blind taps that went wrong: on the phone a search typed while the Sessions tab was up opened and left "Start New Session" (nothing created, checked through the API); a sign-in typed while the Login was still moving left a fragment in the username field - cleared, fields read empty, then signed in; on the tablet "confirm" missed twice.
- I pressed Done on two Summaries of Q-W's sessions (`SES-20261012-0112` lane 2, `-0031` lane 1) to take the slots (same operator account on lane 2).
- Lane 2's Core log was not read for errors.
- A temporary line in `ui-runtime-watch.ts` (one forced suspicion, an experiment) was removed again; it caused one full reload of the tablet app.

## 6. Decisions for the controller

1. **CT-01 needs a native answer**: Reanimated's draw-pass path logs a stack per dead tag per event. A patch (no stack, or skip tags without a view) or a library version without it needs a Gradle build - not allowed in this wave. Until then: a demonstration should start from a freshly launched app.
2. CT-01's remainder (8 - 11 s standstills) needs a profile in a release build.
3. CT-05 covers the route sync only. After a SIGN-IN the boot router still opens an unacknowledged Summary of a session run elsewhere (seen twice today) - the same ruling would apply there.
4. D169's pinned test was replaced (a session sealed elsewhere during an outage is told, not opened).
5. JA2-32: an own non-pressable chip, or accept.
6. The shared key `session.actions.endSession.holdHint` is no longer read by the mobile app (the web still reads it); `system.settings.notifyCriticalAlways` ("stay until acknowledged") is no longer read by the mobile Settings and is not what the toast does.
7. `demoControlsAccess` now answers `flag-off` before `not-permitted`.

## 7. State left (read back 15:52)

Both devices on Login in the normal launch form, fields showing their hints, "Core online", `DEV-0001` /
`DEV-0002`; rules tablet `tcp:8081 tcp:8081`, `tcp:4420 tcp:4422`, phone `tcp:8081 tcp:8081`,
`tcp:4420 tcp:4421`; the dev toast showing on both; media volume not touched (nothing was played); the
phone's auto-rotate as found (on). Lane 2: no session open (`SES-20261012-0117` SEALED, acknowledged), both
rigs OFF, selector on the FAKE defaults, 0 active and 0 unacknowledged alerts of mine. Lane 1: no session
open (`SES-20261012-0032` SEALED, acknowledged), no active fault, `ALR-000007` (found) left. Helper sessions
signed out, no jar left. Slots file: my lines, the last one "free".

---
*Generated: 2026-10-12 15:58 WIB*
