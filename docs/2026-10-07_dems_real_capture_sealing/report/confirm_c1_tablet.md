---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: CONFIRMATION of fix wave J - judge C1, the TABLET on lane 2 (real capture on generated test sources), NORMAL launch form (motion on)
date: 2026-10-12
agent: verifier (as a judge; no code changed, nothing fixed)
narrative_tier: 2
status: complete - 30 CONFIRMED, 3 NOT CONFIRMED, 9 NOT RE-DRIVEN; new findings 1 MAJOR, 7 MINOR, 3 NOTE; overall "yes with reservations"
tree: b4b0c25
surface: emulator-5556 (dems2_tablet, 2560 x 1600), DEV-0001 of dems_lane_2, Core 4422 (PID 49674)
window: 12:40 - 13:38 WIB
evidence: .cache/judging/confirm-tablet/ (141 PNG, view/ reduced copies and contact sheets, rec/ 2 screen recordings, logs/ 11 logcat cuts, tools/)
---

# Confirmation C1 - the tablet after fix wave J, normal launch form

## 1. Overall judgement

**Would I accept the tablet for a demonstration to a law-enforcement customer today: YES, WITH
RESERVATIONS.** The finding that made judge B2 say "no" is gone: in the normal launch form the export
wizard ran to "Complete" twice, the Finalizing stepper ran in three seals, the Login was complete after
both sign-outs, and no `scaleFor` Worklets line and no duplicate-key line was logged in the whole hour.
Every MAJOR of the two first reports held when I drove it: Home tells the truth (camera unreachable,
seal being retried, seal blocked, link cut within 0.8 s), "Retry sealing" pressed on the tablet sealed
the blocked session, the tampered item reads "Sealed · verification FAILED" in three places, synthetic
facts are "Not reported" or under the DEMO chip, security has one answer everywhere, the software
update is "not available on this Core", the Audio Monitor sentence is true for the item the session
produced.

The reservations are about Session Live under load and about three things a customer would SEE:
(1) in all four recordings made on the lane during my hour the app logged "The animation runtime
stopped answering its heartbeat", and in my two recordings **End Session did not answer four of six
holds** (the second recording ran 3:35 instead of 45 s), the timer stood still for 8 s at a time, the
Audio Monitor sheet came about 10 s after its press - host load was 7.5 to 17.7 with two other judges
working, so I cannot say how much is the product (CT-01); (2) the Home ring lost its text after a
session's Done and stayed empty (JT-08, reported "not reproducible", reproduced); (3) list rows
overlap after a filter or search change in Evidence and Sessions (CT-02), and the row of the tampered
item - the row a demonstration points at - is squeezed out of shape by its new chip (CT-03). I would
demonstrate it on a QUIET host, rehearsed, with the web console at hand; I would not run it beside
other heavy work on the same machine.

## 2. Method, limits, disclosures

- Launch form: the tablet was found on Login in the normal form (note 12) and was never relaunched or
  force-stopped by me; one process (PID 6945) for the whole run. Reverse rules read back at the start,
  after the link cut and at the end: `tcp:8081 tcp:8081`, `tcp:4420 tcp:4422`.
- Roles: SUPERVISOR 12:42-13:34 ("Not now" to the biometric offer), TECHNICIAN 13:35-13:36 ("Not
  now"). `uiautomator dump` failed at Login ("could not get idle state"), so the safe helper's field
  check could not run: the fields were read EMPTY from the screenshot (hints "Username" / "Password")
  and the seed sign-in was typed by coordinates with `g94-device-login.mts` (no value printed).
- Presses were `adb shell input tap` / `input swipe` (holds). **A finger was not available.**
- Two other judges worked at the same time (C2 phone on lane 1, C3 web on lane 2). C3 ran two
  sessions on lane 2 (12:56, 13:00 with the seal rig) while I was signed in; what the tablet showed
  during them is used as evidence where I say "observed on C3's session". Slot lines written before my
  rig and session use and after (13:06, 13:15 x2, 13:24, 13:38).
- **Recordings over the brief's 45-60 s: `SES-20261012-0105` 1:36 and `SES-20261012-0106` 3:35** (End
  Session did not answer, CT-01). Neither was interrupted by the product; the Core log holds no
  capture-worker fault (10 error lines in all: 8 `SEALER_FAILED` of the two rigged seals, 2
  `FRAGMENT_NOT_AUTHENTIC` of the tampered item's playback).
- Stray input of mine: (a) at 12:51 and 12:53 a scripted `input text` meant for the export Reason
  field went into the Evidence search field (my tool tapped the counter, not the field - see CT-06 for
  what the product then did); (b) at 13:17 a tap on the feed area and the text "C1 rig session end"
  were sent while no End dialog was open (CT-01 / JT-23); the text is in no record I could find; (c)
  at 13:19 a tap meant for End Session opened the debug build's log overlay (dismissed). No local
  device was selected, pre-checked, started or tapped.
- Screenshots: 141 PNG. READ as pictures (alone, cropped or in a sheet): `c000`-`c002`, `c004`,
  `c007`, `c009`, `c012` (sheet), `c013`, `c014`, `c019`-`c021`, `c025`-`c027`, `c028_029` (crop),
  `c030`-`c036`, `c037` (sheet), `c038`, `c040`, `c042`, `c044`, `c047`, `c049`, `c053`-`c055`,
  `c057`-`c060`, `c061` (sheet), `c064`, `c067` (sheet of `rec/c_live_start.mp4`), `c068` (sheet),
  `c069`-`c080`, `c082`, `c083_blocked_4`, `c085`, `c087`, `c088`, `c090_091` and `c093` (crops),
  `c092`, `c096` and `c101` (sheets), `c104`, `c109`, `c110`, `c111_113` (crops), `c114`, `c115`,
  `c118`, `c119`, `c121`. The others were read through the view tree taken at the same moment or not
  at all.

## 3. The checklist: every BLOCKER and MAJOR of JT / JM, and every MINOR claimed fixed

| Id | Sev. | Result | Evidence |
|---|---|---|---|
| JM-01 / JT-05 stepper error, sheet, clock, Login | BLOCKER | **CONFIRMED** | Export wizard to "Complete" twice on `EV-20261012-0072`: `EXP-000054` (12:50), `EXP-000055` (12:55); the sheet resized at every step, Back / Next reachable, result sheet whole with "Done" (`c014`, `c025`). Finalizing stepper animated through `SES-…-0105` (`c061`), `-0106` and C3's `-0104`. Login complete (emblem, title, card) after "Lock console" (`c118`) and after "Sign out" (`c121`). Home clock equal to the host clock at every reading. Logcat, 11 cuts: 0 lines with `scaleFor` / "Remote Function", 0 "same key" |
| JM-02 action bar presses | MAJOR | **CONFIRMED** (adb taps) | Export: 10 of 10 opened the wizard at the first press (view tree `evidence-export-sheet-close` after each). Play: 10 of 10 toggled, label alternating Pause / Play in 11 consecutive frames (`c012` sheet). Other sheets at the first press: bell 4 of 4, account 3 of 3, device Diagnostics 5 of 5 (`c096`), Settings "Run diagnostics" 6 of 6 (`c101`), "Retry sealing" confirmation 1 of 1, Audio Monitor 1 of 1 - but about 10 s late (CT-01) |
| JM-03 new item missing from the list | MAJOR | **CONFIRMED** | `SES-…-0105` recorded on the tablet, sealed 13:12:50, Done, Evidence from the rail (opened earlier in the same sign-in), no pull: first row `EV-20261012-0075` (`c066`, view tree) |
| JT-01 truth of Home | MAJOR | **CONFIRMED** | (b) `source-rig 2 unreachable CAM-02` + pre-check: Home "SYSTEM ATTENTION / Attention Needed / 1 check needs attention / Camera 2 (CAM-02): not reachable", header ATTENTION, tile "Not reachable", bell 1 (`c047`). (c) link cut 13:14:54: "SYSTEM OFFLINE / STATE UNKNOWN / Core offline — state unknown … What is shown is the last known state", tiles "Not known", in the first frame, **0.8 s** after the cut (`c068`); both rules restored and read back, "Core Live" within 12 s. (a) observed on C3's rigged session: "ATTENTION / Sealing is being retried … The recording is kept on the Core", "View finalization", "A new session cannot be started …" from the first failure (`c036`, `c037`), then at 13:04:08 "CRITICAL / Sealing blocked" with "Retry sealing" on Home; on my own rigged session Finalizing said the same (`c082`, `c083`) |
| JT-02 retry on the device | MAJOR | **CONFIRMED** | `seal-rig 2 blocked` -> `SES-…-0106` -> blocked 13:22:39 (`ALR-000218`) -> `release` (status OFF) -> "Retry sealing" on the tablet's Finalizing, ONE press + its confirmation naming the session (13:23:57) -> SEALED 13:23:59 as `EV-20261012-0076`; the Summary opened by itself (`c084`, `c085`; API `session/current`) |
| JT-03 synthetic facts shown as real | MAJOR | **CONFIRMED** | Home ring "SECURITY NOT REPORTED", chips "Security: Not reported", "Network: Not reported"; pre-check row "Security, Not reported, NOTE - this Core reads no TPM and no Secure Boot state"; Devices > Camera 1: no LAN IP / PoE / bandwidth row at all, Health "Not reported - This Core reports no health history for this source"; Network & Time: LAN, PoE, Bandwidth "Not reported", "Device link Connected", "This Core does not report its network"; diagnostics (device sheet and Settings sheet): Storage (SMART), Fan and thermal, Network and PoE, Security (TPM, Secure Boot) "Not reported"; About: "Core server 0.2.0", "Capture worker capture-worker/0.5.0", "API contract 0.3.0", "Mobile app 0.1.0", TPM "Not reported", serial / BSP / provisioning under "Synthetic demo values" + DEMO chip; no `2.4.1` / `2.5.0` anywhere. **Security: one answer in five places, no second answer found.** Microphones at rest: Home tiles and New Session meters "Not measured / — dBFS" |
| JT-04 FAIL of record on the item | MAJOR | **CONFIRMED** (see CT-03) | `EV-20261009-0005`: list row chip and spoken label, header chip, Status fact all "Sealed · verification FAILED" in red (`c004`). Verify x2: "Verification failed on the Core", "FAIL: VIDEO-02 does not match the sealed manifest", "VIDEO-02 fragment 3 tampered (stored-bytes hash mismatch; chain broken from fragment 3)", "11 of 15 checks passed" (12:44:04, 12:44:20). Clean `EV-20261012-0072` x3: "Verified by the Core", "PASS: every hash matches the sealed manifest", "15 of 15 checks passed" (12:45:48, 12:46:00, 12:46:14). Five presses, five verdicts read |
| JT-06 Install update | MAJOR | **CONFIRMED** on this Core; confirmation dialog NOT RE-DRIVEN | Supervisor and technician: "Software update is not available on this Core.", no version, no Install control (0 nodes with "install") (`c100`, `c120`). The confirmation before an install cannot be reached on lane 2 (no updater) |
| JT-07 Audio Monitor sentence | MAJOR | **CONFIRMED** | During `SES-…-0105`: "This Core records one audio track, from the active microphone. The standby microphone is recorded only after you switch to it; the sealed item lists which microphone fed the track, and when. The two are never mixed.", cards "MIC 1" / "MIC 2" (`c055`). The items it produced: tracks VIDEO-01, VIDEO-02; one audio interval MIC-01 PRIMARY 0:00 to the end (API `evidence/EV-20261012-0076`; band "MIC 1 0:00–…" on the item). The sentence is true |
| JA2-05 alert toast on the tablet | MAJOR | **CONFIRMED** (see CT-04) | Critical toast with the Core's sentence, "Critical alert at 13:04:08. It stays until it is acknowledged." and "Acknowledge", up for at least 50 s on Home and on Network & Time (`c037`, `c038`); again at 13:22:39 on Finalizing (`c083`) |
| J4-4 blocked-seal sentence | - | **CONFIRMED** | The alert and the Finalizing notice name "the Session Monitor of the web console or … the session's screen of the tablet or phone" |
| J4-5 / N-10 bell and account as sheets | MINOR | **CONFIRMED** | `uiautomator dump`: "Latest alerts", each alert's text, "Acknowledge: <alert>" (labelled), "View all events", "Close"; account: name, "Role: Supervisor", "Settings and profile", "Lock console", its sentence, "Sign out", "Close". Android Back closed each; `topResumedActivity` stayed the app. The look is acceptable (`c030`, `c031`) |
| Acknowledge on an alert | - | **CONFIRMED** | `ALR-000200` (warning) and `ALR-000218` (critical) acknowledged from the bell: the control goes, the badge counts down (`c049`) |
| JW-26 mobile half (versions) | MINOR | **CONFIRMED** | About as above; Login "App v0.1.0"; rail "v0.1.0" |
| `unsealableCause` / N-08 | NOTE | **CONFIRMED** | Sessions > Incomplete > `SES-20261011-0065`: "Recorded, could not be sealed. No evidence item exists; the recordings are kept in the quarantine folder of the Core. Why the seal was given up: session key not of session." |
| JT-11 form note on the item | MINOR | **CONFIRMED** (markers not driven) | `EV-20261012-0075`: "Markers and notes of the session - Note from the session form: C1 form note: interpreter present" |
| JT-12 truncations | MINOR | **CONFIRMED** for what I saw | Session row ids whole; Home tile names full size; the long alert sentence whole in the bell. Still cut: the Evidence search hint (wraps into a clipped second line, `c009`), "Confirmation C3 We..", "Incomplete session — …" in rows |
| JT-15 Download manifest | MINOR | **CONFIRMED** | More: "Download manifest" disabled, "The signed manifest is part of the export package. Use Export." (`c114`) |
| JT-16 RBAC sentence | MINOR | **CONFIRMED** (sentence); row menu and Play reason not driven | Technician Home: "Requires the Investigator or Supervisor role" (`c119`) |
| JT-17 action-bar Play after the integrity stop | MINOR | **CONFIRMED**, with a remainder | Tampered item: stop at 0:04 with "This recording failed its integrity check (Verify: VIDEO-02 fragment 3).", inner Play disabled; action-bar Play pressed twice: position stays 0:04, nothing restarts (`c007`). Remainder: the button stays enabled and labelled "Play" and gives no answer of its own |
| JT-18 Lock console | MINOR | **CONFIRMED** | Sheet says "Ends your sign-in on this device. Sign in again to continue."; Login: "Console locked — sign in to continue" (`c118`) |
| JT-19 Back on Home | MINOR | **CONFIRMED** (one press) | Back on Home: the app stays (`topResumedActivity` the app) |
| JT-20 detail follows the filter | MINOR | **CONFIRMED** (see CT-02) | "EV-20261012-0075 is not in this list … Clear filters" |
| JT-21 storage labels | MINOR | **CONFIRMED** (label); "Est. Remaining: Not reported" as listed open | "Sealed today 16", "Recorded, not sealed 1" (`c092`) |
| JT-23 / JM-04 (1)-(3) keyboard after the reason | MINOR | **CONFIRMED** | After End Session with the keyboard open: `mInputShown=false` 2 s later, both sessions, nothing over Finalizing (`c061`, `c082`); after the export submit: gone, result and "Done" free (twice) |
| JT-24 Home with an open setup | MINOR | **CONFIRMED** | "Session SES-…-0105 is being set up by you. The Core takes no other session until it is started or cancelled."; armed: "… is armed by you: recording starts with one press." (`c032`, `c047`) |
| JM-05 words on the microphone cards | MINOR | **CONFIRMED** (words); canvas open as listed, and longer | Film at 1 frame/s (`c067`): "CONNECTING" 7 s, then "Receiving audio" on both cards from the first frame of "Recording". **Meter canvas empty for at least the first 21 s** of `SES-…-0105` (host load 10-12; drawn at 0:55); drawn by 0:17 in `SES-…-0106` (load 7.5). Reported earlier: 2.4-7 s and 12 s |
| JT-03 extras of round two (mic tiles, New Session meters, Home network chip, pre-check note) | MAJOR part | **CONFIRMED** | as in the JT-03 row |
| **JT-08 Home ring loses its text** | MINOR | **NOT CONFIRMED** (reported "not reproducible 7 of 7") | After Done of `SES-…-0106` the ring was EMPTY - no "SYSTEM / READY / SECURITY NOT REPORTED" - at 13:25:54, 13:26:09, 13:26:19 and after Storage and back (`c088`, `c090_091`, `c093`); "Ready for Recording" under it stayed. Fresh sign-in drew it again (`c119`). Not the entry animation: that one shows a travelling dot for about 3 s (`c027`, `c036`) and then the text (`c028_029`) |
| **JT-09 End Session hold** ("a full hold completes", round two) | MINOR | **NOT CONFIRMED** | Holds on "End Session" (`input swipe` in place): 1.9 s at 0:55 of session one - no dialog after 2.5 s and 10 s; 2.6 s - dialog. Session two: 1.9 s at 0:44 - no dialog; 2.6 s - no dialog within 1.5 s (and none later); 3.0 s during the stalled form - none; 3.0 s at 3:20 - dialog. 2 of 6 (`c057`-`c059`, `c071`-`c080`). The hint "Hold to end the session" is shown. See CT-01 |
| **JT-23 original / JM-04 (4) keyboard over a screen with no field** | MINOR | **NOT CONFIRMED** | Session Live, 13:17: after a hold that opened nothing, one tap on the feed area: the soft keyboard came up with no field and no dialog on screen and covered End Session; ESC did not close it; the keyboard's own hide key did (`c072`-`c075`). This is A1's JT-23 exactly |
| JT-10 transcript seeks | MINOR | NOT RE-DRIVEN | One tap on "0:10–0:13" with the player closed did nothing visible; not driven with the player open (time) |
| JT-13, JT-14 dead controls, row tap on chips | MINOR | NOT RE-DRIVEN | time; I tapped rows beside their chips |
| JT-22 New Session copy | MINOR | NOT RE-DRIVEN | only "Run checks again" above the rows and "All checks passed" seen |
| JM-06 switch dialog late | MINOR | NOT RE-DRIVEN (not claimed fixed) | microphone switch not pressed; the Audio Monitor sheet was about 10 s late (CT-01) |
| JM-07 phone tabs | MINOR | NOT RE-DRIVEN | phone |
| JM-08 one surface in both motion modes | MINOR | NOT RE-DRIVEN | Reduce motion left off (the normal form was the brief); with motion on the wizard is a sheet |
| JM-09 another operator's session | MINOR | NOT RE-DRIVEN | C3 used the same operator account, so no "another operator" case arose; see CT-05 |
| JT-06 install confirmation | MAJOR part | NOT RE-DRIVEN | lane 2 has no updater (phone judge's item) |
| Never-sealed item (JA2-01 on this lane) | BLOCKER (phone) | **CONFIRMED** | `EV-20261009-0006`: "Incomplete session — not sealed"; Hash & Integrity: "Not sealed - This recording was never sealed. It has no sealed hash, no manifest and no signature, and there is nothing to verify."; no Verify control; Export disabled (`c109`) |
| Composite in the wizard (JA2-03 / N-13) | MAJOR (phone) | **CONFIRMED** | Step 3: "Composite" disabled, "Composite video is not available in this build." |

Counts: **30 CONFIRMED** (4 of them with a part not driven, said in the row), **3 NOT CONFIRMED**
(JT-08, JT-09 hold, JT-23 phantom keyboard - all MINOR), **9 NOT RE-DRIVEN** (JT-10, JT-13, JT-14,
JT-22, JM-06, JM-07, JM-08, JM-09, the install confirmation). Every BLOCKER and MAJOR of both
reports: CONFIRMED.

## 4. New findings

Attribution: P = product, E = environment / tooling, ? = not established.

| Id | Sev. | Finding | Steps | Evidence | Attr. |
|---|---|---|---|---|---|
| CT-01 | **MAJOR** | **During a recording the tablet stops answering for seconds at a time, and End Session cannot be relied on.** In 4 of 4 recordings of the lane in this hour the app logged the ERROR `motion.uiRuntime.stalled` "The animation runtime stopped answering its heartbeat." (5 beats of 4 s; 12:57:07, 13:01:12, 13:12:05, 13:17:41). What I saw with it: the big timer showed 00:00:02 for 5 s, 00:00:13 for 8 s, then 00:00:21 (film); the Session Timeline stayed EMPTY for the whole of session one (no "Recording Started" up to 1:15; it was there at 0:17 in session two); the Audio Monitor sheet came about 10 s after its press; 4 of 6 holds on End Session opened nothing (JT-09 row); at 13:18 the screen changed to the fallback form in mid-recording - both meters gone, End Session 38 px lower, its hold hint gone, timer standing at 00:01:58 for at least 6 s - and came back by itself by 13:19. Result: session two ran 3:35 for an intended 45 s. The app process used 96 % (idle on Login) to 213 % CPU and 1.9 GB (50 % of the tablet's memory) | Record a session on the tablet while the host is loaded; press Audio Monitor at 0:10; hold End Session 1.9 s | `logs/l04b`, `l05`, `l06`; `c067` (sheet), `c053`-`c059`, `c071`-`c080`; `top` at 13:19 and 13:36; host load 9.6 at 12:41, 13.9 at 12:58, 11.7 at 13:11, 7.5 at 13:16, 17.7 at 13:18 | ? - a debug build on an emulator beside two other judges; the drivers saw the same at load 12. The recordings themselves were whole (both sealed, Verify not run on them). Needs: one recording on a quiet host, and a release build |
| CT-02 | MINOR | **List rows overlap after a filter or search change.** Evidence: after clearing a search / switching All - Recorded - All the second row sits about 65 px low: a gap under row 1, and row 3 drawn over row 2's last line and menu; unchanged by scrolling and by another filter change. Sessions > "Incomplete": `SES-20261011-0052` is almost wholly under `SES-20261011-0045` (only its id shows) | Evidence: search an id, clear it (or tap Recorded, then All). Sessions: tap "Incomplete · 5" | `c020`, `c110`, `c111_113`; `c104` (same picture 3 s later) | P - both lists got `maintainVisibleContentPosition={{ disabled: true }}` and the JT-20 change in this wave; not there at the first visit (`c003`) |
| CT-03 | MINOR | **The list row of the tampered item is squeezed out of shape by its chip.** "Sealed · verification FAILED" takes the row's width: the id is shrunk to an unreadable size, the date reads "9 Oct…", the name "Dew…", "Lainnya" breaks into "Lai / nny / a", "Development source" into five lines, the duration "00:0…" | Evidence, search `EV-20261009-0005` | `c004`, `view/c004_row_crop.png` | P (JT-04's chip + JT-12's shrinking id) |
| CT-04 | MINOR | **The critical toast is as large as the Core's sentence and says something that is not so.** Five lines plus a caption across the whole width: it covers the page title, the clock, the bell, the account button and the rail's "Home" and "Sessions" on every screen, and repeats word for word the notice under it on Finalizing. It says "It stays until it is acknowledged", yet it was gone once the seal succeeded while the alert was still "resolved, not acknowledged" in the bell | Seal rig blocked; wait for the block; open another page; then retry the seal | `c038`, `c083_blocked_4`, `c087` | P |
| CT-05 | MINOR | **The tablet takes the operator off the page in use when a session run from the web console ends or seals.** Three times: from Evidence (between two exports) and from Network & Time to the Session Summary of C3's sessions, from Home to their Finalizing. No word says why; the same account was signed in on both consoles ("set up by you") | Sign in on the tablet, open Evidence; run and end a session on the web console of the same Core | `c026`, `c035`, `c040` | P (to rule: intended for the room device? then a line saying so) |
| CT-06 | MINOR | **The Evidence search field keeps the keyboard focus behind sheets.** With the export wizard open at "Reason" and its field not yet tapped, typed text went into the search field behind the sheet; the filter hid the selected item and the wizard was gone without a word. Clearing the search with its X raises the keyboard again | Evidence: search, pick an item, Export to step 4, type without tapping the field (hardware keyboard or `input text`) | `c019`, `c021` | P, met through my tool's wrong tap (E) |
| CT-07 | MINOR | Two answers under "Software Update" for one fact: supervisor "Demo controls are turned off on the Core server. They appear when it runs with its demo flag on."; technician "The demo controls require the Supervisor role." - on a Core where no role has them | Settings > System Maintenance as each role | view trees at 13:29 and 13:35 | P |
| CT-08 | MINOR | New Session and Ready say "Recording Profile: Standard (1080p / 25 fps)"; the item the session seals says "Sealed format (signed manifest) Camera 1: H264_720P30, Camera 2: H264_720P30" (the lane's selector profile). Possibly the known "`profileId` label" item; listed because the two statements are now one press apart | New Session; then the sealed item | view trees of Ready and of `EV-20261012-0075` | P / known |
| CT-N1 | NOTE | The tablet's bell has no "Acknowledge all": my two recordings raised 15 INFO alerts "MIC-0x: rate correction is at its limit" (host load) and the badge read "9+"; each needs its own press (I acknowledged them through the API) | `c087` | P |
| CT-N2 | NOTE | Small things: the scrubber's spoken value is "4014.9999999999995" (N-10, now with float noise); the item's "More" menu is still an anchored popover outside the view tree; the never-sealed seed item carries a "GNSS" time chip and a GREEN "Recorded" chip on a Core that says GNSS is not configured; Storage "Retention 90 days / 90 days"; diagnostics "Cameras PASS" beside tiles "Not checked"; Camera 2's player tile still lower than Camera 1's (N-12); the account sheet's group label reads "AKP Andi Pratama, Role: Supervisor, Ends your sign-in on this device…" | `c007`, `c109`, `c092` | P |
| CT-N3 | NOTE | Debug build only: the "Open debugger" / error toast lies over "Done" on the Summary and over End Session in the fallback form; a tap on it opens the log overlay. It cost me one Done press and one End press | `c064`, `c076`, `c077` | E |

## 5. Logcat (cleared after each sign-in, read after each flow; 11 cuts under `logs/`)

| Line | Count |
|---|---|
| `[Worklets] Tried to synchronously call a Remote Function … scaleFor` | **0** |
| React "two children with the same key" | **0** |
| `colorKit` / "is not a valid color" | **0** (and no wrong or missing colour seen on chips, badges or the player) |
| `E/ReactNativeJS` `motion.uiRuntime.stalled` (heartbeat) | **4** (3 in the saved cuts, the one of 13:01:12 read from the on-screen toast before a clear) - CT-01 |
| `E/unknown:MountItemDispatcher` "Unhandled SoftException … ViewCommand … blur … Unable to find viewState" | 2 (12:51:07, 12:55:27: each export submit; no visible effect) |
| `E/ExpoVideo` picture-in-picture | 12 lines (library) |
| `E/ReactNativeJNI` "Surface with id 11 is not found" | 1 (after the debug overlay) |
| `E/AndroidRuntime` | 0 |
| Library "SurfaceMountingManager" (`synchronouslyUpdateUIProps failed for tag N`), events | 5,869 in the saved cuts (bursts: 2,240 around C3's first session, 1,622 in my rig session, 930 at the technician sign-in); count only |

## 6. Flows

| Flow | Result | Time felt |
|---|---|---|
| Sign-in (supervisor, technician), "Not now" | Home; technician lands on Home | 4-5 s |
| Export wizard to Complete x2, supervisor | `EXP-000054`, `EXP-000055`; item EXPORTED | each under 3 s after "Export" |
| Verify x5; tampered playback | 2 FAIL, 3 PASS; integrity stop at 0:04 | 3-4 s per verdict |
| Session one on the tablet (form with a note, source rig on CAM-02, Home, release, re-check, record, Audio Monitor, End with the keyboard open, Finalizing, Summary, Done, Evidence) | `SES-20261012-0105` -> `EV-20261012-0075`, SEALED 23.7 s after the stop; 1:36 | check 8-10 s; cameras connect 7 s |
| Link cut and back | offline in 0.8 s; "Core Live" within 12 s; pairing kept | - |
| Session two with the seal rig | `SES-20261012-0106` -> blocked after 3 retries (2 min 37 s) -> release -> "Retry sealing" on the tablet -> `EV-20261012-0076`, SEALED 2 s after the press; 3:35 | - |
| Lock console; sign-out | notice on a complete Login; "You have been signed out." on a complete Login | 5 s |

## 7. Not judged, skipped

- A finger; a release build; a quiet host (CT-01 rests on a loaded one).
- The microphone switch, markers, snapshot, countdown cancel, Reduce motion, the Audit screen, Storage
  policy sheet, camera search, selector changes (the selector was only read), TalkBack.
- **Biometrics** (D151): both offers answered "Not now"; no fingerprint event; no lock change. Skipped,
  not passed.
- **Local devices** (D163): `CAM-03` ("Core Mac's camera") is listed in Devices; its row and `MIC-03`
  were never tapped, selected, pre-checked or started. The selector read `CAM-01`, `CAM-02`, `MIC-01`
  primary, `MIC-02` standby at 13:26 (tablet) and 13:36 (API).

## 8. State left (read back 13:36-13:38)

- Tablet: on Login in the normal launch form (never relaunched), "You have been signed out.", fields
  showing their hints, no keyboard, "Core online", "paired as DEV-0001"; rules `tcp:8081 tcp:8081`,
  `tcp:4420 tcp:4422`; media volume 4 (as found; 0 from 12:44).
- Lane 2: no session open (`SES-20261012-0106` SEALED, summary acknowledged with Done); seal rig OFF,
  source rig OFF; selector on the FAKE defaults, `locked false`; alerts: 0 active, 0 unacknowledged
  (`ALR-000200` and `-000218` acknowledged on the tablet, `-000202` … `-000217` through the API); audit
  chain `view.ok true`, `stored.ok true`, 1,789 rows. Not reset, not restarted.
- Added by me: `EV-20261012-0075`, `-0076` (SEALED); exports `EXP-000054`, `-055` of `EV-20261012-0072`
  (now EXPORTED); 2 FAIL verification rows on `EV-20261009-0005`, 3 PASS on `-0072`; 11
  diagnostics runs. C3's two Summaries were left by the back arrow, not acknowledged by me.
- Helper API session signed out (204), jar removed. Slots file: my five lines, the last one "finished".
- No product source, test or other document changed; `masterplan/02_plan.md` not written.

---
*Generated: 2026-10-12 13:45 WIB*
