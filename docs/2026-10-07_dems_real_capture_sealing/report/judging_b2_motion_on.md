---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: UI judging session - judge B2 - BOTH devices in their NORMAL launch form, motion ON
date: 2026-10-12
agent: verifier (as a judge; no code changed, nothing fixed)
narrative_tier: 2
status: complete - 1 BLOCKER, 2 MAJOR (new) + 2 MAJOR of phase A confirmed, 6 MINOR, 7 NOTE; overall "no, not in the normal launch form"
tree: 035150b
surfaces: tablet emulator-5556 (DEV-0001, lane 2, Core 4422); phone emulator-5554 (DEV-0002, lane 1, Core 4421)
window: 23:50 (11 Oct) - 00:42 (12 Oct) WIB
evidence: .cache/judging/motion/ (108 PNG, view/ reduced copies and contact sheets, rec/ 18 screen recordings, logs/ 27 logcat cuts, tools/)
---

# Judging B2 - the product as shipped: normal launch, motion on

## 1. Overall judgement

**Would I accept the two devices, started the way an operator starts them, for a demonstration to a
law-enforcement customer today: NO.** With motion on, most of what phase A liked is still there and
some of it is better: the clocks tick, the meters move, the countdown can be cancelled by hand, the
Finalizing steps animate, the Summary's controls answer, the sealed player plays and seeks. But the
shared stepper throws an uncaught error (JT-05) every time the export wizard goes from step 1 to
step 2, and what follows is worse than phase A could see: the export sheet stops resizing so
"Next" cannot be reached and the export cannot be finished, and after the next sign-out the tablet's
Login is drawn WITHOUT its sign-in card - nobody can sign in until the app is killed. I got that
Login twice. The same error also appeared on a tablet that was merely signed in and idle while the
web judge ended a session on the same lane. Phase A's "yes with reservations" was earned in a mode
(`motion=off`) that hides all of this. With the app's own "Reduce motion" switch ON the error does
not occur and the export completes - so a demonstration today is possible only with that switch on,
which is not the product as designed.

## 2. How the gates launched the apps, and what a normal launch is

| | Command | Effect |
|---|---|---|
| Gates and phase A (note 05 line 182, note 06 line 230, note 11 section 8) | `adb -s <serial> shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///login?core=LIVE&motion=off" com.dems.demo.tablet'` | `core=LIVE` is written to the stored preferences (`apps/mobile/src/runtime/debug.ts:17-23`). `motion=off` is the D43 test switch: policy `reduced`, every ambient loop paused, clocks held to the minute, meters and their readouts held (`apps/mobile/src/motion/policy.ts:9-19`, `home-header.tsx:158-165`, `device-tiles.tsx:45,127-209`). It is NOT stored: it lasts for the app process |
| Normal launch (what I used) | `adb -s <serial> shell am force-stop com.dems.demo.tablet` then `adb -s <serial> shell monkey -p com.dems.demo.tablet -c android.intent.category.LAUNCHER 1` (the launcher icon, `com.dems.demo.tablet/.MainActivity`, no URL) | No motion switch in the new process, so the policy is `full`; the Core link stays LIVE because that choice is stored. Both devices came up on Login, paired, "Core online"; reverse rules unchanged |

Android system animation scales on BOTH devices: `window_animation_scale=1.0`,
`transition_animation_scale=1.0`, `animator_duration_scale=null` (never set = the default 1.0). No gate
left them at 0; I changed no system setting; "system animations off" is not a limit of this run.

Tooling consequence: with motion on `uiautomator dump` answers "could not get idle state" on Login and
Home (both devices at times) - the reason the test switch exists. I drove those screens by
coordinates and screenshots; dumps worked on New Session, Summary, Evidence and Settings.

## 3. Findings, by severity

Attribution: P = product defect, E = environment / tooling, ? = not established.

### BLOCKER

| Id | Finding | Steps | Expected | Evidence | Attr. |
|---|---|---|---|---|---|
| JM-01 | **The shared stepper's uncaught error (JT-05) is reproducible, and after it the tablet degrades until it cannot be signed into.** Error: `[Worklets] Tried to synchronously call a Remote Function. Called "scaleFor" on the UI Runtime.` at `stepper.tsx:310:68` (`FillMotion`: `useAnimatedStyle` calls the plain function `scaleFor` of line 263), always together with React "Encountered two children with the same key, `1`" at `stepper.tsx:359` (`StepBadge`: `FadeMotion key={ringRun.id}` and `HaloMotion key={haloRun.id}` are siblings). What followed, in this order: (a) a full-screen red "Uncaught Error" overlay (debug build); (b) the export sheet kept the height of step 1: at step 3 "Composite" is cut and Back / Next are off the sheet; dragging moves the short sheet around with the page's Play / Export / More showing under it - **the export cannot be completed**; (c) the Home clock ran 71-72 s behind the device and host clock (00:29:47 shown at 00:30:59) and stayed behind; (d) **after "Sign out" the Login has no emblem, no title and no sign-in card** - only the background and two captions; the view tree holds no text field, plus a stray "Bottom Sheet" node and a "busy" spinner; unchanged after 20 s, after Android Back and a return from the launcher. Only a force-stop brings the Login back. | Normal launch, sign in as Supervisor, Evidence, a sealed item, Export, "Next". Then close the sheet, avatar, Sign out. | The wizard advances; the Login is complete after every sign-out. A room device that cannot be signed into is out of service. | Deterministic: 2 of 2 presses of "Next" (00:28:46, 00:40:37; logs `t09_export_next_jt05`, `t16_export_next_repro2`). `t058_jt05_overlay_export_next`, `t060`-`t064` (sheet), `t066`/`t067` (clock), `t068`, `t069_login_without_card_after_jt05`. Control in the same form WITHOUT the error: sign-out at 00:27 gave a complete Login (`t052`), Home clock exact (`t093`, 00:39:16 = host). Also found without my doing anything: tablet signed in on Home, B1 ended a web session on lane 2 - 8 key errors + the Worklets error at 23:58:31-36, the overlay still up 17 minutes later (`t010_jt05_overlay_found_on_idle_tablet`), and under it the same Login without its card (`t016_login_without_card`) | P. Not established: what a release build does at (a) (a debug overlay there, an unhandled UI-thread error here); why my own two Finalizing runs and the New Session wizard did NOT raise it (vertical steppers; phone's horizontal New Session stepper did not either) while the export wizard always does; which screen's stepper fired at 23:58 |

### MAJOR

| Id | Finding | Steps | Expected | Evidence | Attr. |
|---|---|---|---|---|---|
| JM-02 | **Action-bar buttons of the evidence item sometimes ignore a press with motion on, silently.** Phone, demo item `EV-20261011-0013`, "Play": 4 presses, 0 opened the player (the media tile "Play Camera 1" beside it opened it at once); the same button after a relaunch with `motion=off`: opened on the first press. Tablet, supervisor, "Export": on `EV-20261012-0062` two presses nothing, the third (150 ms) opened the wizard; on `EV-20261012-0063` six presses nothing (the neighbour "More" answered at once); back on `-0062` it opened on the first press. With the app's Reduce motion ON: 2 of 2 opened. | Normal launch; item page; press Play (phone) / Export (tablet, supervisor). | A press opens the player / the wizard, or says why not. | `p031`, `p035`, `p036` vs `p043_motionoff_actionbar_play`; `t054`-`t057`, `t094`-`t098`; recording `rec/p_play_tap.mp4` | ? - presses were `adb shell input tap` (zero-length) and one 120-150 ms press; the pattern (same control, same item, differs by mode) points at the product, but it must be confirmed with a finger |
| JM-03 | **A sealed item is missing from the Evidence list until the list is pulled down.** Phone: `EV-20261012-0014` sealed 00:04:49, on Home's "Recent Sessions" at once, absent from the Evidence list at 00:06 and still at 00:13; present after a pull to refresh. Tablet: `EV-20261012-0062` sealed 00:23:20, absent at 00:26 (list opened via the rail), present after a pull. When I arrived through "View in Evidence" under Reduce motion the list did hold the new item. | Record and seal; Done; open Evidence from the bar / rail (the Evidence screen had been opened earlier in the same sign-in). | The recording just made is the first row. "Where is my recording?" is the first question after a session. | Dumps at 00:06, 00:13 (phone), 00:26 (tablet): 0 rows with the new id, then first row after the pull | P - found in passing; I did not test it with `motion=off` |

**Phase A findings confirmed with motion on (not counted again):**

| Id | Answer |
|---|---|
| JA2-05 (alert toast) | **Missing in both modes - not an animated element that fails to mount.** Phone on Home, motion on, `STORAGE_FULL` raised on lane 1 at 23:58:23 while filming: the status card turned "Recording Blocked - A critical fault needs action - Evidence storage full", the Storage tile 99 % red, the bell got its badge; no toast in the 14 s recording (the recorder produced no new frame after the change settled). Source: `apps/mobile/src/features/settings/settings-prefs.ts:12-13` says of the notification switches "no alert-toast consumer reads them yet"; the only alert toast in the app is the GNSS one of the Network & Time hook (`use-network-time.ts:92`). `rec/p_fault_storage_full_home.mp4`, `view/p_fault_sheet2.jpg` |
| JA2-04 (Home while the link is down) | **At least 140 s, and until the link returned.** Link cut 00:09:26 (`adb reconnect`, no rules): chip "Core Offline" within 2 s; "Ready for Recording - All systems operational" at every reading from +2 s to +99 s and again at +140 s (00:11:46). Rules restored and read back (`tcp:8081 tcp:8081`, `tcp:4420 tcp:4421`): "Core Live" within 11 s, pairing kept |
| JT-05 | See JM-01 |
| JT-23 (keyboard) | See JM-04 |

### MINOR

| Id | Finding | Evidence | Attr. |
|---|---|---|---|
| JM-04 | **The soft keyboard is not dismissed when the field that opened it goes away (JT-23, reproduced by hand).** (1) Tablet, End Session WITH the keyboard open: nothing is lost - the dialog moves up and its own "Keep recording" / "End Session" stay above the keyboard (only the page's big End Session button is covered, which is not needed then); the keyboard then lingers over Finalizing for under a second. (2) Phone: after "End Session" the keyboard stays over Finalizing for the whole seal (about 8 s), covering step 6 and the closing sentence. (3) Tablet export wizard: after "Export" the keyboard stays over the result and covers everything below "Reason", including "Done". (4) A keyboard with a search key came up over Devices, a screen with no text field, and stayed; ESC did not close it and one tap on the rail's "Evidence" was swallowed while it was up. The operator gets out with the keyboard's own hide key (bottom left) or Android Back. Trigger of (4) not pinned: it followed blind taps of mine on Home (section 8) after the export dialog | `t039_end_keyboard`, `view/t_finalizing_sheet.jpg`; `view/p_finalizing_sheet.jpg`; `t078_rm_export_done`; `t081_phantom_keyboard_on_devices`, `t082`-`t085` | P |
| JM-05 | Tablet Session Live, motion on: the two microphone cards are EMPTY for the first 12 s of a recording - "CONNECTING" disappears when the recording starts, then no meter, no number, no word until 00:00:12; from then on the meters move (MIC 1 between -11 and -30 dBFS, MIC 2 at -21). In the same seconds the big timer skipped (shown values per second of film: 02, 05, 05, 05, 08, 08, 10, 12, 12, 14, 14, 17, then one per second). Host load 4-5 and a screen recording were running | `t030_live_a`, `view/t_live_meters_sheet.jpg`, `rec/t_live.mp4` | P for the empty cards; ? for the timer (load) |
| JM-06 | Tablet, during a recording: the "Switch the active microphone" dialog came 2.5 to 4.5 s after the press, three times out of three (no dialog 1.5 s and 2.5 s after the press, present at about 4-5 s). A second tap made while waiting lands outside the late dialog and dismisses it without a word. On the phone the same dialog was up within 1.5 s. Same load caveat | `t031`-`t036` with the timer values 00:14 / 00:24 / 00:41 / 01:05 | ? (P or load) |
| JM-07 | Phone bottom bar: every change of tab shows a completely empty screen (header included) for 116 to 333 ms before the new page fades in - 5 of 5 changes | `rec/p_bell_avatar_tabs.mp4`, measured per frame; `view/p_tabs_sheet.jpg` | P |
| JM-08 | The export wizard is two different things: with motion on a bottom sheet, with Reduce motion a centred dialog. In the dialog form a tap outside discards the wizard at once, without a question (my "Next" aimed at the sheet's position did that); JA2-20 said the same of the phone | `t057` vs `t072_073`, `t074` | P |
| JM-09 | After a sign-in the tablet opens on whatever the lane's session is, whoever made it: at 23:55 on the Ready step of the web judge's armed session with "Start Recording" one tap away, at 00:18 on the web judge's unacknowledged Session Summary. Nothing says "this session was set up by another operator on the web console" | `t003_after_signin`, `t018_after_signin` | P (to rule: intended?) |

### NOTE

| Id | Note |
|---|---|
| JM-N1 | Library "SurfaceMountingManager" warnings with motion on, counted as events (`synchronouslyUpdateUIProps failed for tag N`; each is a 140-180 line stack, so the log volume is large). Tablet: sign-in + Home + bell 474 (two bursts) / second sign-in, Summary (hash sheet), View in Evidence 536 / form + Devices Check 352 / recording + stop + Finalizing 111 / player 19 / sign-in as supervisor + Evidence 184 / Reduce motion ON: export 4 + 6, session + Finalizing 8, Summary + Settings 77. Phone: Home, bell, tabs, New Session, 60 s live 0 / stop + Finalizing 68 / player 7 / (motion=off run: item + player 27). Count only |
| JM-N2 | Other log lines: `E/ExpoVideo: Current activity does not support picture-in-picture` (2-6 per screen with video, both devices); `W/unknown:ReactNative: Can't cancel already finished gesture` once on each device in the player; `E/ReactNativeJNI: FabricUIManagerBinding::reportMount: Surface with id 11 is not found` once after each error overlay; `W/ReactNativeJS: [Reanimated] Reduced motion setting is overwritten with mode 'never'` at each launch; three "Require cycle" warnings in `packages/shared/src/sim` at each launch. No `AndroidRuntime` line, no crash |
| JM-N3 | The app's Reduce motion is NOT the test switch: the Home clock, the session timer and the meters stay live (good - an operator who turns it on keeps true readouts); End Session answers a tap instead of a hold, as under the test switch; the wizard is a dialog; `uiautomator` still cannot reach idle on Home. Gates that need a quiet tree could not use it instead of `motion=off` |
| JM-N4 | The Login's emblem, title and card are drawn by an entry animation: a normal cold launch showed a black screen with only the dev toast for about 25 s (Metro cold) and then the Login builds up. JM-01 (d) is that build-up never running |
| JM-N5 | Phone: the item opened through "View in Evidence" has a back arrow labelled "Back to Evidence" that leads to Home. Phone dialogs have no dimming: "Switch to MIC 2" shows through under the switch dialog (`p011`; JA2-N5) |
| JM-N6 | With "Recording Blocked" on the phone's Home (storage full) "Start Session" keeps its full gold look (`view/p_fault_sheet2.jpg`); not pressed |
| JM-N7 | On the tablet's Evidence detail for the web judge's item `EV-20261012-0061` Play and Export were disabled for the investigator (`t020`); I did not look for the reason |

Counts: BLOCKER 1, MAJOR 2 new (+ JA2-04, JA2-05 confirmed), MINOR 6, NOTE 7.

## 4. Comparison: test switch against the normal launch

| Thing | With `motion=off` (as phase A reported) | With motion on (this run) |
|---|---|---|
| Home / System Time clock | seconds frozen at `:00` for the whole minute (N-01, JA2-34) | ticks every second, equal to host time in a healthy run (`view/t_home_sheet.jpg`, `t093`); 71-72 s behind after the JM-01 episode |
| Session timer | not reported as a defect | rolls every second on both devices; skipped seconds in the first 15 s on the tablet under load (JM-05); still live under Reduce motion |
| Microphone meters | cards stuck at "-90 dBFS", no bars, for a whole recording (N-01, JA2-34) | move: tablet MIC 1 -11..-30, MIC 2 -21; phone -53 / -15, following the switch; but EMPTY cards for the first 12 s on the tablet (JM-05); Home tiles read "- dBFS" at rest |
| Stepper | static; no error in any gate | New Session (both devices) and Finalizing (both, 3 runs) animate without an error; **export wizard step 1 to 2 throws every time** (JM-01); with Reduce motion: no error, wizard to the end (`EXP-000047`) |
| Tablet Summary's controls (G81b-03) | defect tied to reduced motion | fresh Summary, motion ON: a "Sealed files" row opened its hash sheet and Close closed it (2 Summaries), "View in Evidence" opened the item, "Done" went Home with the status ring's text present. Fresh Summary, Reduce motion ON: the same three answered. G81b-03 not seen in either mode |
| Home status ring text (JT-08) | lost after Done / background | present after Done and after sign-in in healthy runs (`t041_042`, `t065`); I did not reproduce JT-08 - A1 saw it in a session where JT-05 had the chance to fire, which fits JM-01 but is not proven |
| End Session | a tap opens the dialog | a tap answers "Hold to end the session" (toast at the top, over the header on the phone); a 1.6 s hold opens the dialog |
| Countdown | Cancel seen only in a recording (A1's tap was late) | pressed by hand at "2": back on Ready at once, session still ARMED, no overlay left (`view/t_countdown_sheet.jpg`) |
| Alert toasts | none (JA2-05) | none - missing in both modes |
| Sheets, dialogs, popovers | open and close | hash sheet, marker popover, bell popover, avatar menu, phone player sheet, End and switch dialogs: all finish, nothing half-open - EXCEPT the export sheet after the error (JM-01 b) and the slow switch dialog (JM-06) |
| Screen changes | - | tablet: no flicker seen; phone: a blank flash at every tab change (JM-07) |
| Evidence action bar | Play opens the player at once (phone, my own check) | presses sometimes ignored (JM-02) |
| `uiautomator` | reaches idle everywhere | "could not get idle state" on Login and Home |

## 5. Error catalogue (motion on)

| # | Text (first lines) | Screen and action | How often | UI visibly broken | Source named |
|---|---|---|---|---|---|
| 1 | `E/ReactNativeJS: [Error: [Worklets] Tried to synchronously call a Remote Function. Called "scaleFor" on the UI Runtime.` / `See https://docs.swmansion.com/react-native-worklets/docs/guides/troubleshooting#tried-to-synchronously-call-a-remote-function` | Tablet: export wizard "Next" at step 1 (2 of 2); tablet idle on Home while a web session ended (1) | 3 in this run | Yes: red overlay, then JM-01 (b)-(d) | `stepper.tsx:310:68`, call stack `[UI]: stepperTsx1` |
| 2 | `E/ReactNativeJS: 'Encountered two children with the same key, %s. Keys should be unique ...', '1'` (once `'2'`) | With #1 every time (1 line each at the wizard; 8 lines in 5 s on the idle tablet at 23:58; 2 lines at 00:10:30 during the web judge's blocked seal; 1 line 30 s after the first wizard error) | 13 lines | Overlay "Console Error" behind #1 | `stepper.tsx:359:8`, component `StepBadge` |
| 3 | `W/Reanimated: synchronouslyUpdateUIProps failed for tag N` / `java.lang.reflect.InvocationTargetException` / `Caused by: ...RetryableMountingLayerException: Unable to find SurfaceMountingManager for tag N` | Every screen change that unmounts animated views (JM-N1) | about 1,900 events | No | library (react-native-reanimated `NativeProxy.kt:256`, via react-native-svg draw) |
| 4 | `E/ExpoVideo: Current activity does not support picture-in-picture...` | Any screen with a video view | 2-6 per screen | No | library configuration |
| 5 | `E/ReactNativeJNI: FabricUIManagerBinding::reportMount: Surface with id 11 is not found` | After dismissing the overlay of #1 | 2 | No (the overlay's own surface) | React Native |
| 6 | `W/unknown:ReactNative: Can't cancel already finished gesture...` | Player, both devices | 2 | No | React Native |
| 7 | `W/ReactNativeJS: [Reanimated] Reduced motion setting is overwritten with mode 'never'.`; `Require cycle: packages/shared/src/sim/session-machine.ts -> ...` (3) | Launch | each launch | No | app configuration / shared sim |

Screens that raised a Worklets / Reanimated ERROR or a React key warning: the export wizard (always),
and an idle signed-in tablet during another console's session end. Screens walked WITHOUT one: Login,
Home, bell, avatar menu, New Session (3 steps), countdown, Session Live, Finalizing, Summary, Evidence
list and item, Verify, sealed and demo players, Settings (App Preferences), phone tabs and More.

## 6. Flows

| Flow | Steps | Result | Time felt |
|---|---|---|---|
| Phone core flow (lane 1) | sign-in, "Not now", Home, New Session, check, Ready, record with one microphone switch, hold End, reason with keyboard open, Finalizing, Summary, item, Verify, demo player (volume 0: play, seek to 29:35, CAM 2, pause) | `SES-20261012-0024` -> `EV-20261012-0014`, SEALED, "Verified by the Core". Recording ran 1:17 | check about 5 s, seal 8 s, Verify under 2 s |
| Phone: critical fault on Home | `STORAGE_FULL` raised and cleared through lane 1's API, filmed | Card, tile and bell follow within a second; no toast | - |
| Phone: link cut | `adb reconnect`, 140 s, both rules restored | JA2-04 confirmed; pairing kept | back in 11 s |
| Tablet session 1, investigator, motion on | form, check, Ready, countdown CANCELLED by hand, start again, record with a microphone switch (third try, JM-06) and a marker, hold End, reason with keyboard open, Finalizing, Summary (row, sheet, Done), Evidence (pull), Verify, sealed player (volume 0: play, seek to 1:17, band and "Audio at the playhead: MIC 2", pause) | `SES-20261012-0092` -> `EV-20261012-0062`, SEALED 9.1 s after the stop, Verify PASS. Recording ran 1:48 | check 6 s, cameras connect 5 s, player opens in 2 s |
| Tablet export, supervisor, motion on | Export, Next | JM-01: cannot be completed | - |
| Tablet with Reduce motion ON | switch on; export wizard to the end on `-0062`; session 2 (57 s, tap End, Finalizing, Summary row + sheet + View in Evidence); switch off | `EXP-000047`, item EXPORTED; `SES-20261012-0093` -> `EV-20261012-0063` SEALED in 7.6 s; no JS error | export under 3 s |

Does the app's reduced mode behave like the test switch? For the defects yes (JT-05 gone, End by
tap); for the readouts no - and that is the better behaviour (JM-N3).

## 7. Not judged, and why

- A release build: every run is a debug build with Metro; what the uncaught error does there is unknown.
- JM-02 with a finger; JM-03 with `motion=off`.
- A deliberate repeat of "idle tablet while another console ends a session" (seen once, not driven).
- The microphone switch BACK on the tablet and a frame-by-frame look at the timeline (entries
  "Recording Started", "Microphone Switched", "Marker Added" appeared with their times; the dialogs
  cost the minute).
- A fault during a recording on the phone; the tampered item; Verify FAIL; Sessions hub; Devices,
  Storage, Network & Time, Audit with motion on; the technician role; "Install update" (A1's
  reproduction - not pressed again: it changes lane 2's update state).
- Auto-lock: the tablet was found signed out under the overlay after 17 minutes; whether that was the
  15-minute lock or the session's expiry I cannot say.
- TalkBack. Sound (nothing was played aloud).

## 8. Disclosures

- Recording lengths over the brief's 45-60 s: phone 1:17, tablet session 1 1:48 (slow dialogs, JM-06);
  tablet session 2 0:57.
- Stray taps of mine at 00:35 on the tablet: a form-filling sequence was sent while the app was still
  on Home (the dump had failed "not idle"). They opened Devices with the detail of Camera 2
  (`CAM-02`, a generated source) and nothing else; the selector was read back unchanged (`CAM-01`,
  `CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY). No local device was selected, pre-checked or started.
- The web judge's unacknowledged Summary of `SES-20261012-0091` was open on the tablet after my
  sign-in; I used its rows and "View in Evidence" (B1 had released the slot at 00:14).
- Text typed with `adb input text` lost two characters once ("Jging"): tooling.
- Screenshots: 108 PNG. Read as pictures (alone, cropped or in a montage): `p002`, `p003`, `p010`,
  `p011`, `p014`/`p015`, `p016`, `p030`, `p031`, `p033`, `p035`, `p036`, `p043`, `t001`-`t003`,
  `t006`, `t007` (crop), `t010`-`t013`, `t016`-`t018`, `t030`-`t039`, `t041`/`t042`, `t050`, `t051`
  (crop), `t052`-`t054`, `t057`-`t068`, `t070`, `t072`-`t078`, `t080`-`t085`, `t090`, `t093` (crop),
  `t094`, `t096`, `t098`, and the contact sheets in `view/` named above. The others were read through
  the dump or the file size taken at the same moment, or not at all (`p004`, `p012`, `p013`, `p020`,
  `p021`, `p032`, `p034`, `p040`-`p042`, `t004`, `t005`, `t014`, `t015`, `t020`, `t021`, `t040`,
  `t055`, `t056`, `t069`, `t071`, `t079`, `t091`, `t092`, `t095`, `t097`, `t099`, `t100`).

## 9. Skipped

- Biometrics (D151): every offer answered "Not now" (phone 2, tablet 4); no fingerprint event, no lock
  change. Skipped, not passed.
- Local devices (D163): `CAM-03` / `MIC-03` never selected, pre-checked, started or tapped.

## 10. State left (read back 00:41-00:42)

- Tablet: Login in the note's form (`core=LIVE&motion=off`), both fields empty (hint only), "Core
  online", "paired as DEV-0001", the dev toast showing (not closed); reverse rules `tcp:8081 tcp:8081`,
  `tcp:4420 tcp:4422`; media volume 4 (as found; 0 during playback); Reduce motion off (as found).
  The last supervisor sign-out was tapped but not read back before the force-stop.
- Phone: Login in the note's form, "You have been signed out.", paired as DEV-0002; rules
  `tcp:8081 tcp:8081`, `tcp:4420 tcp:4421`; media volume 4 (as found).
- Lane 2: no session open (`SES-20261012-0093` SEALED, summary acknowledged); selector on the FAKE
  defaults; 81 alerts, none active; no rig used. Added: `EV-20261012-0062` (EXPORTED, `EXP-000047`),
  `EV-20261012-0063` (SEALED). Not reset, not restarted.
- Lane 1: read back at 00:15 - `SES-20261012-0024` SEALED and acknowledged, `EV-20261012-0014`, the
  demo fault cleared, `ALR-000001` acknowledged, scenario idle. (The web judge used the lane after me.)
- Helper sessions signed out or expired, my two jars removed. Slots file: both of my lines released.
- No product source, test or other document changed; `masterplan/02_plan.md` not written.

---
*Generated: 2026-10-12 00:50 WIB*
