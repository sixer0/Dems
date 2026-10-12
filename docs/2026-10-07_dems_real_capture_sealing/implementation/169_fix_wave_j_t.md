---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave J, driver J-T (apps/mobile: stepper and motion runtime, evidence, session flow, update screen, keyboard) with the TABLET emulator-5556 (DEV-0001, lane 2)
date: 2026-10-12
agent: coder-execution (rules D94 / D122 / D163; brief fix_brief_wave_j.md)
narrative_tier: 2
status: needs-review - the nine headline items are fixed and proven on the tablet in the NORMAL launch form except where section 4 says "by test"; 28 findings of the area are NOT fixed and are listed with the reason (most: not reached in this run)
tree: 035150b + wave J (no git write)
---

# 169 - Fix wave J, driver J-T

The run was cut twice (an API limit, a network failure). After each cut the state was read back before
anything else: no edit was left half-applied (every edit was one completed replacement; `tsc` was clean
for my files each time), no session of mine was open, both rigs read OFF, both reverse rules intact.

## 1. The nine headline items

| # | Finding | Cause (file:line at the time) | Fix | Test (EXISTING file unless "new module") | Proven |
|---|---|---|---|---|---|
| 1 | JM-01 / JT-05 BLOCKER: "[Worklets] Tried to synchronously call a Remote Function ... scaleFor" + "two children with the same key" | `components/composed/stepper.tsx:263` `scaleFor` was a plain arrow function called from `FillMotion`'s `useAnimatedStyle` (`:310`). `:358-360`: `FadeMotion key={ringRun.id}` and `HaloMotion key={haloRun.id}` are siblings and both count from 1 (the collision is as old as the overlays; wave K's chip key only added a third keyed sibling) | `scaleFor` is a worklet (`'worklet'` directive, `stepper.tsx:263-275`); every overlay key names its overlay (`ring-`, `halo-`, `chip-`, `check-`, `fill-`) | `stepper.test.tsx` "JM-01 - a step change of the shared stepper (full / reduced motion)": six steps in both orientations, no key warning; overlays mounted in full motion, none in reduced. Red first: the suite guard below failed three existing full-motion stepper tests with "useAnimatedStyle: stepperTsx1 calls scaleFor" - the name the device printed | LIVE: reproduced 2 of 2 before the fix (tablet, normal launch, export "Next"); after it the export wizard ran to "Complete" three times (EXP-000048, -049, -050), zero `Worklets` / key lines |
| 1b | Every other worklet that calls a non-worklet | Audit of every `useAnimatedStyle` / `useAnimatedProps` / `useDerivedValue` / `useAnimatedReaction` / `useFrameCallback` / completion callback in `apps/mobile/src` (about 110 worklets in 50 files; no `Gesture.*`, `runOnUI`, `runOnJS`, scroll handler or custom layout animation exists): `stepper.tsx:310` was the ONLY unsafe one. Worklets that call something, all safe: `dbfs-meter.tsx:158,178,211,222,292,296` (callees in `dbfs-meter.math.ts`, all `'worklet'`; Skia `rect` / `rrect` / `vec`), `glow-ring.tsx:210,233`, `rolling-number.tsx:167,333`, `camera-feed.tsx:325,360-367`, `login-ambient.tsx:72,116,170-173`, `marker-flight.tsx:69,77`, `live-feed.tsx:131`, `mic-card.tsx:115`, `device-mic-meter.tsx:72` (`scheduleOnRN` only), `capacity-ring.tsx:95`, `debug-overlay.tsx:53`; the rest call nothing | A suite-wide guard: `jest.setup.ts` wraps Reanimated's six hooks and reads what the Worklets Babel plugin wrote on each worklet (`__closure`, `__initData.code`): a captured function without `__workletHash` that the worklet's source CALLS fails the test in `afterEach` (`src/motion/testing/worklet-closure.ts`, new module). Library entry points are allowed by identity, from the module instances each test file really loads (the Skia mock included) | `motion/testing/worklet-closure.test.ts` (new module's own test; planted offender found, hand-over not reported, nested call found) | by test; whole suite: zero guard failures |
| 1c | JM-01 d: after the error the Login had no emblem / title / card; Home empty; the sheet did not resize | One uncaught worklet error ends Reanimated's style loop for the process (`react-native-reanimated/src/mappers.ts` `scheduledMapperRun`: the reschedule is the statement after `mapperRun()`). Then (i) every view shown by an animation stays hidden; (ii) the Login's four "rest" styles were `useAnimatedStyle`s swapped in after mount - Reanimated gives an animated style's value to React only in a view's first render (`AnimatedComponent.tsx` `_isFirstRender`, `filterOutAnimatedStyles`), so the swap drew nothing | (a) `features/login/use-login-choreography.ts`: the resting picture is four PLAIN styles; the animated ones are used only while a shake / exit plays. (b) `motion/ui-runtime-watch.ts` (new module): an error reported by the UI runtime is taken at the global handler, recorded (`motion.uiRuntime.stalled`), passed on as NOT fatal; `UiRuntimeBoundary` (`motion-policy-provider.tsx`, mounted in `app/_layout.tsx`) replaces the screens by a plain notice and the app restarts itself (`reloadAppAsync`), at most once per 60 s; a second error inside 60 s leaves the notice with "Restart the app". (c) A heartbeat (5 beats of 4 s) only SUSPECTS: reduced policy with `still` settings (the layout builders return no animation), taken back by the first answered beat | `login-entrance-rest.test.tsx` "JM-01 d"; `motion/ui-runtime-watch.test.tsx` (new module: trap, guard time, heartbeat, boundary) | LIVE with the stepper defect STILL IN PLACE: error -> black frame -> complete Login about 28 s later (debug build, Metro); a second error 59 s later -> the notice "The display stopped" with its button -> button pressed -> Login complete. After the fix: sign-out -> complete Login |
| 2 | JM-02: action-bar presses ignored | The press was never lost. The kit asks `@gorhom/bottom-sheet` to slide in once; the library drops the request silently while its first layout is unfinished (`handleSnapToIndex`: `if (!isLayoutReady) return`). The kit then is "open" with nothing on screen and a transparent overlay that eats the next press and closes it. Probe on the tablet: state `open: true, laidOut: true`, no sheet, 1 opening in 7 presses | `features/evidence/sheet-frame.tsx` `useConfirmedOpen`: the open is confirmed by the library's own `onAnimate`; none within 250 ms -> the request is made again (up to 6 times), then the frame closes and records it | NOT covered by a jest test (the library's layout gate does not exist in jsdom) - say so | LIVE, `adb input tap` (a finger was NOT available): Export 10 of 10 (twice; 7 and 9 of the 10 needed one retry), Play 10 of 10 at volume 0 (label alternates, position 0:01 -> 0:10). Phone: by code only |
| 3 | JM-03: a just-sealed item missing from the list | Reproduced with a session recorded ON the tablet (not with one ended through the API): the item was in the list's data and in the view tree ONE ROW ABOVE the viewport. FlashList 2 keeps the visible content in place when rows are inserted before it (`maintainVisibleContentPosition`, on by default) | `evidence-list-screen.tsx` and `sessions/sessions-screen.tsx`: `maintainVisibleContentPosition={{ disabled: true }}` | `evidence-list.test.tsx` "JM-03" (the prop; jsdom has no scroll position) | LIVE: SES-20261012-0099 recorded on the tablet -> Done -> Evidence from the rail: EV-20261012-0069 is the first row, no refresh |
| 4 | JT-02: "Retry sealing" on the devices | Ruling D228 (1) | `session-finalizing/seal-attention.tsx` `SealRetryControl`: button + confirmation naming the session -> operation 33 for investigator / supervisor; other roles read who can; the sentence "no retry control" is gone. Used by the Finalizing notice (both layouts) and the Sessions hub (`hub-top.tsx`). Refusals go to the shared presenter first | `session-finalizing-screen.test.tsx` "JT-02 on tabletLandscape / phonePortrait" (REPLACES the wave L case); `summary-live-static.test.ts` extended | LIVE: `seal-rig 2 blocked` -> SES-20261012-0096 (45 s) -> ALR-000165 SEAL_BLOCKED -> `release` -> "Retry sealing" pressed ON THE TABLET, confirmed -> SEALED as EV-20261012-0066; rig OFF. Home's entry: NOT built (section 3) |
| 5 | JT-04 / JA2-01 / -02 / -03 client halves | - | JT-04: `evidence-chips.tsx` `verificationFailed` -> "Sealed · verification FAILED" (danger) in the list row (chip + spoken label), item header and Status fact. JA2-01: `evidence-detail.tsx`: `!hasSealedValues(item)` -> a "Not sealed" notice in place of the integrity tab (no hash, no Verify, no verdict). JA2-02: `item-facts.ts` words `DEMONSTRATION_RECORD`; `live-integrity-tab.tsx` DEMONSTRATION chip on a verdict with `demonstration: true`. JA2-03: `export-sheet.tsx` reads `exportKinds` BY NAME (`item-facts.ts`): Composite disabled with its reason, never requested; member absent = Package only | `evidence-list.test.tsx` "JT-04"; `evidence-detail.test.tsx` contract examples `neverSealed`, `simulatedSealed` (imported, fed unmodified); `live-evidence-export.test.tsx` "JA2-03" x3 (REPLACES "Composite chosen") | LIVE on the restarted lane 2: never-sealed `EV-20261009-0006` -> "Not sealed ... nothing to verify", no Verify control; Composite node DISABLED with "Composite video is not available in this build." JT-04 chip, the demonstration chip and the simulated lane: by test (lane 1 is the phone's) |
| 6 | JT-06 Install update | - | `settings/maintenance-section.tsx`: confirmation (version, slot, restart) before operation 67; `isUpdaterNotAvailable(update)` -> "Software update is not available on this Core.", no version, no control | `rbac/role-gate-r2.test.tsx` (REPLACES "a press starts the update"; + no-updater case with `UPDATE_NOT_AVAILABLE_EXAMPLE`); `live-settings-sites.test.tsx` adapted | LIVE (technician, lane 2 after the restart): the card reads the sentence, no Install control. The confirmation: by test (lane 2 has no updater any more) |
| 7 | JT-07 Audio Monitor sheet | The sentence and "Interviewer / Subject" describe the simulated lane's two tracks | `session-live/monitor-sheets.tsx`: own capture -> "This Core records one audio track, from the active microphone. The standby microphone is recorded only after you switch to it; the sealed item lists which microphone fed the track, and when. The two are never mixed."; cards named MIC 1 / MIC 2. Simulated wording unchanged. Basis: an item's `tracks` VIDEO-01 / VIDEO-02 with `audioSourceIntervals`, the card's own "inside AUDIO-01" rule; masterplan 05 / 06 were NOT re-read in this run | `session-live-screen.test.tsx` "JT-07" + control | by test only |
| 8 | JT-23 / JM-04 keyboard; JM-05 empty microphone cards | Keyboard: when the field that opened it is REMOVED Android hands focus to the next field of the window (the Evidence search field under the sheet) and keeps the keyboard - "a keyboard with a search key over a screen with no field". JM-05: the meter is a canvas fed on the UI runtime; nothing readable until its first paint | `lib/keyboard.ts` `putKeyboardAway` (now + once after 300 ms): export submit, End Session confirm, a closing evidence sheet, every route change (`navigation/root-navigator.tsx`). `session-live/mic-card.tsx`: a React-drawn state line per card ("Receiving audio" / "No signal" / "Not measured" / "Waiting ..."), hidden while the cameras connect | `live-session-live-link.test.tsx` "JM-05". Keyboard: NO jest test (it is the platform's focus hand-over) | LIVE: keyboard gone 1.5 s after End Session (twice) and after the export submit and Done; at 00:00:06 the cards read "Receiving audio". NOT fixed: the canvas itself is still empty in those first seconds (cause not found) |
| 9 | B8 remainder, RC-7 link, PiP log | - | NOT done: W93-10, -19, -26, -27, B15, RC-7 (section 3). PiP: the three `VideoView`s already pass `allowsPictureInPicture={false}` (`play-sheet.tsx:130`, `sealed-player.tsx:564`, `camera-feed.tsx:276`); the line is logged by the library's own layout path (`expo-video` `applyRectHint` -> `setPictureInPictureParams` on an activity not declared for PiP) | - | not fixed: needs the config plugin (a native build) or a library change |

## 2. Other findings fixed

| Id | Sev. | Fix | Test |
|---|---|---|---|
| JT-03 (Settings half handed over by J-P) | MAJOR | `maintenance-section.tsx`: rows over hardware the Core does not read are "Not reported", headline and "Last run" line use the Devices sheet's `summaryOf`. LIVE: "1 check needs attention · 4 checks are not reported by this Core" | none added (the shared rule is tested in the devices folder) - gap |
| JT-16 (ruling) | MINOR | `runtime/core-errors.ts` `requiredRolesFor` / `roleNamesText`, `rbac/use-role-gate.ts`: the sentence names every role that may act ("Requires the Investigator or Supervisor role") | 11 test files moved to the new sentence; `role-gate-r2.test.tsx` pure cases |
| NEW (found while proving JT-06; hard form of JM-09) | MAJOR | A technician who signed in while another operator's Summary was unacknowledged was HELD on it (Back routed back; Done refused: "acknowledgeSummary needs permission SESSION_START"). `runtime/sim-runtime-provider.tsx:116`: an operator who may not acknowledge is not routed to a Summary. LIVE: technician lands on Home | `runtime/route-sync.test.ts` |
| N-03 follow-up, static rule | - | `runtime/live-settings.test.tsx` (release build draws no Core link control, J-P's change); Home presentation renamed `CAMERAS_CONNECTING` so that `link-notice-static` holds; `pairing-handoff-routes.test.tsx` pin moved for the boundary; three recovery tests and one evidence test moved to J-S's sentences | - |

## 3. NOT fixed

| Id | Sev. | Reason |
|---|---|---|
| JT-02 Home entry | part of MAJOR | Home's action opens Finalizing, where the button is; a compact control on Home itself was offered to J-P by a request line and not built by either of us |
| JM-06 (switch dialog 2.5-4.5 s late), JM-07 (blank frame on a phone tab change), JM-08 (sheet with motion, dialog without; outside tap discards the wizard) | MINOR | not reached. JM-08 is a design decision as well (which form) |
| JM-09 (tablet opens on another operator's session) | MINOR | only its blocking form (technician) is fixed; "set up by another operator" wording needs a ruling |
| JT-08 (ring text lost) | MINOR | not reproduced: Home drew its ring after every sign-in, Done and restart of this run; consistent with JM-01 as its cause, not proven |
| JT-09 (End differs by motion mode; toast over the button) | MINOR | not reached |
| JT-10 (transcript does not follow the playhead), JT-11 / JA2-08 (marker, snapshot, notes not shown afterwards) | MINOR | not reached; JT-11 needs members of the item page |
| JT-12 (truncations), JT-13 (controls that do nothing), JT-14 (row tap swallowed on chips) | MINOR | not reached |
| JT-15 / JA2-21 ("Download manifest") | MINOR | not reached; J-S 4 gives the rule (remove for an item sealed on this Core, point to Export) |
| JT-17 (action-bar Play after the integrity stop) | MINOR | not reached. Seen in passing: Play at the end of a clip toggles "playing" at 0:57 / 0:57 without restarting |
| JT-18 ("Lock console" signs out) | MINOR | not reached (`auth/auth-provider.tsx:245`) |
| JT-19 (Android Back on Home leaves without a question) | MINOR | not reached |
| JT-20 (detail pane keeps a filtered-out item), JT-22 (stale New Session copy), JT-24 (Home with an open setup) | MINOR | not reached |
| JA2-06, -07, -09, -10, -17, -19, -20, -22, -23, -36, -37 | MINOR | not reached (session and evidence screens on the phone) |
| JA2-16 remainder (phone bell / account menu as a sheet in the accessibility tree) | MINOR | ruling received, not built |
| B8: W93-10, -19, -26, -27; B15; RC-7 on-screen link | - | not reached; each still needs what note 163 section 6 names |
| N-02 / JA2-29 app-side spec ids, N-07, N-08, N-10, N-11, N-12, JM-N1..N7 | NOTE | not reached (J-S removed the SHARED ids) |
| `E/ExpoVideo` PiP line | NOTE | native build or library change |

Counts (my areas, by the reports' severity): BLOCKER 1 fixed / 0 not; MAJOR fixed 9 (JM-02, JM-03, JT-02 except the Home entry, JT-04, JT-06, JT-07, the client halves of JA2-01, -02, -03) + JT-03's Settings half + 1 new / 0 wholly open; MINOR fixed 4 (JM-04 / JT-23, JM-05 in words, JT-16) / about 28 not fixed; NOTES: none worked.

## 4. Proven live versus by test

Live, tablet, NORMAL launch (`force-stop`, then `monkey ... LAUNCHER 1`), lane 2: everything marked LIVE in
sections 1 and 2. Logcat over Session New -> Live -> End with a reason -> Finalizing -> Summary -> Done
(SES-20261012-0097 and -0099, both recorded on the tablet), three exports, ten Export and ten Play presses,
the list, sign-out: ZERO `Worklets` lines and zero duplicate-key lines. Five Verify presses were sent with
zero such lines, but my filter did not read the verdict headings: not a proof of five verdicts.
By test only: the phone layout of every fix, JT-07, the JT-04 chip, the demonstration chip, the install
confirmation, Composite refused by an older Core.
Not proven at all: a release build (what the trap and `reloadAppAsync` do there); JM-02 with a finger.

## 5. Things to know

- A heartbeat FALSE POSITIVE was seen (host load 60: screen captures hung, three beats unanswered, runtime
  alive). Hence five beats and the way back; the heartbeat never restarts the app.
- Metro serves edits to both devices: a half-written import of the other mobile driver stopped the tablet's
  bundle once, and the lanes' restart at 06:01 signed the tablet out mid-script - one scripted run then typed
  the subject text into the Login's username field and opened the "Demo operators" disclosure. No sign-in was
  sent; the app was force-stopped (fields empty again). The script now refuses to tap unless Home is read.
- Lane 2 data added: SES-20261012-0094 .. -0097 and -0099 (EV-20261012-0064 .. -0067, -0069), exports
  EXP-000048 .. -050 of EV-20261012-0063, alert ALR-000165, one diagnostics run (09:01).
- Recordings were 45-60 s on the FAKE sources; no local device was selected, pre-checked or started.

## 6. Checks for the test runner

| Check | Command | Expect |
|---|---|---|
| mobile typecheck | `npm run -s typecheck -w apps/mobile` | 0 errors (run by me: 0) |
| mobile lint | `npm run -s lint -w apps/mobile` | 0 errors, 0 warnings |
| whole mobile suite | `npx -w apps/mobile jest` | see section 7 |

## 7. Whole mobile suite (run by me, apps/mobile being mine alone at the end)

Typecheck 0 errors; lint 0 errors, 0 warnings. The suite was run four times as the work went on (275 suites, 3,068 tests at the end):

| Run | Result | What failed |
|---|---|---|
| 1 (before the hand-over fixes) | 16 failed | sentences J-S changed, my install confirmation, the static rules, J-P's left-overs - all repaired (section 2) |
| 2 | 9 failed | the RBAC sentence in four files, `role-gate` pure cases - repaired; `back-guard`, `pairing-gate` passed alone |
| 3 | 3 failed | two route-sync tests (my Summary rule held an UNKNOWN role too - corrected: a known role only), one diagnostics test that passes alone |
| 4 (last) | 2 failed of 3,068 | `auth/live-auth.test.tsx` (cold start) and `capture-selector/local-source-start-notice.test.tsx` - neither touched by this wave; BOTH PASS ALONE (49 of 49) |

NO whole run was green: the host load was 8 to 18 during run 4 (other agents), above the brief's 6, and the two files of run 4 differ from those of run 3. The runner should repeat the whole suite once on a quiet host. Zero failures of the worklet guard in any run after its Skia fix.

## 8. Re-drive list for the confirmation judge (normal launch form)

1. Supervisor: Evidence -> a sealed item -> Export -> six steps -> "Complete", three times; Back / Next reachable at every step; Composite disabled with its reason; no keyboard over the result.
2. Ten presses each of Export and Play (with a finger if one is available).
3. A session recorded ON the tablet: microphone cards say a word from the first seconds; End with the keyboard open: no keyboard over Finalizing; Done; Evidence from the rail: the new item is the first row.
4. `seal-rig 2 blocked` -> session -> blocked -> `release` -> "Retry sealing" on the tablet (investigator or supervisor; technician reads who can) -> sealed.
5. Sign out -> the Login is complete. Technician sign-in while a Summary is unacknowledged: Home, not the Summary.
6. Technician: Settings -> System Maintenance: no Install control on lane 2; diagnostics rows "Not reported".
7. Phone (lane 1): Install update asks first; a never-sealed item has no Verify; a simulated verdict carries DEMONSTRATION; the tampered item reads "Sealed · verification FAILED" in the list.

---
*Generated: 2026-10-12 09:30 WIB*
