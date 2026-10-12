---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: UI judging session - judge A2 - PHONE app on lane 1 (SIMULATED Core, demo controls)
date: 2026-10-11
agent: verifier (judge A2; brief delegation_progress/judging_brief.md; environment initialization/11_gate_environment_judging.md)
narrative_tier: 2
status: complete - judged; 1 BLOCKER, 4 MAJOR, 33 MINOR, 12 NOTE; no code changed
tree: 035150b
device: emulator-5554 (dems2_phone, 1080 x 2424), DEV-0002 of dems_lane_1
window: 22:36 - 23:42 WIB
---

# Judging A2 - the phone app, demonstration (simulated) experience

Evidence folder: `.cache/judging/phone/` (268 full-size PNG; `view/` holds reduced copies and the
`m_*.jpg` montages I read; `205_toast_check.mp4` is one 7 s screen recording; `tools/` holds my
helper scripts). Everything below was done through the phone's UI; the lane's API (supervisor
helper session) was used only to raise / clear demo faults, load scenarios and read the Core's side
of a fact. No credential, pairing code or token is in this file, in a file name or in a screenshot
(the "Demo operators" disclosure was opened but not captured; one sign-in mishap of mine is listed
in section 6). Hashes are shortened.

## 1. Overall judgement

**Yes with reservations - and not before JA2-01 to JA2-05 are closed or scripted around.** As a
juror I would let this phone app be shown to a law-enforcement customer for its recording flow: New
Session, the devices check, the countdown, Session Live, the stop with a reason, Finalizing, the
Summary, the Sessions hub, the recovery of an interrupted session, the Audit screen and the
tampered-item verification are clear, fast (tap to response under 1 s almost everywhere, sealing
about 7 s) and well worded, and the app is honest in many small places ("DEMO media - bundled with
this application, not a recording of this Core", "SIGNATURE (SIMULATED)", "Demonstration: no
archive is written"). What I would not accept in front of that customer is what the Evidence page
says after those flows: a session that the recovery screen has just declared "INCOMPLETE - it will
never be sealed" shows per-track hashes labelled "Sealed", a manifest hash, a signature, and turns
"Verified by the Core - PASS" at one tap (JA2-01); a freshly sealed session says "no sealed package
of this item is in the evidence store" and cannot be played (JA2-02); an export asked as
"Composite" is "accepted" as "Package" without a word (JA2-03); Home says "Ready for Recording -
All systems operational" while the Core link is down (JA2-04); and the alert toasts the Settings
promise for critical faults do not come (JA2-05). The rest is a long list of phone polish: "tablet"
wording everywhere, truncated names and titles, sheets and popovers that are invisible to
accessibility tools, specification ids in user copy.

## 2. Screen by screen

| # | Screen (role) | What it is for / what I did | What happened | Verdict |
|---|---|---|---|---|
| 1 | Login | Launch state, Pairing details, Demo operators, empty submit, one wrong sign-in, sign-in as each role | Paired state shown ("Core online", "paired as DEV-0002"); validation per field; "Invalid username or password. 4 attempts remaining"; sign-in about 3 s to Home | OK with FINDING JA2-13, -14, -15 |
| 2 | Pair this tablet (Login and More) | Read the paired state, opened Unpair and chose "Keep paired" | Clear stepper and identity; Unpair has a confirmation | OK; NOTE JA2-N3; JA2-13 |
| 3 | Biometric offer | Answered "Not now" every time (5 sign-ins) | Closes, Home shown | OK (biometrics skipped) |
| 4 | Home (all roles) | Status ring, three tiles, quick actions, recent rows, bell, avatar menu, Core chip | Reacts to faults within 0.5 s; role gate "Requires the Investigator role" for the technician | FINDING JA2-04, -05, -11, -25, -26, -28, -32, -N1 |
| 5 | Bell popover | Empty, 1 alert, 5 alerts, acknowledge, after clear | Works, closes on an outside tap; latest 5 only | FINDING JA2-25, -16 |
| 6 | Avatar menu | Profile, Lock console, Sign out | Profile opens the Settings index; Lock console signs out | FINDING JA2-35, -18 |
| 7 | New Session 1 - Session Info | Every field, bad case number, fill button, subject type long-press, three pickers, "last profile" menu, Back with data | Validation on blur, "Tersangka means Suspect", Discard dialog | OK; JA2-36, JA2-N6 |
| 8 | New Session 2 - Devices Check | Pass, blocked by a camera fault, "Run checks again", Back, Cancel session | 8 checks in about 3 s; "Recording is blocked - Video Lens 1 (FAULT)" | OK; FINDING JA2-10, -12, -22, -23 |
| 9 | New Session 3 - Ready + countdown | Summary rows, countdown switch, Start, Cancel in the countdown, resume from Home | 3-2-1 overlay with Cancel; resume lands on Ready | OK; FINDING JA2-09 |
| 10 | Session Live | Timer, feed with DEMO label, meters, switch microphone and back, snapshot, marker, timeline, Audio Monitor, monitor settings (camera 2, pause), Back, End Session | All work; Back asks "Leave the monitor?" | OK; FINDING JA2-06, -19, -N8 |
| 11 | End Session dialog | Reason of 3 characters, valid reason | Button stays disabled under 5 characters | OK; FINDING JA2-36 |
| 12 | Finalizing | Watched twice (own stop, scenario) | 6 steps with times, closes by itself | OK |
| 13 | Session Summary | Every row, a full hash, sealed files, pipeline, lifecycle, Done, View in Evidence | Clear; signature carries a SIMULATED chip | OK; FINDING JA2-37 |
| 14 | Session recovery | Power-fail interruption, Go to Home, Open recovery, Start recovery, outcome, Acknowledge, View evidence item | 5 stages in about 8 s, outcome INCOMPLETE | OK; FINDING JA2-17, -29, -37 |
| 15 | Sessions hub + Session Details | Search, All / Sealed / Incomplete / Today, sealed and incomplete detail | Incomplete session is marked and explained here | OK |
| 16 | Evidence list | Search, status chips, list options (sort, density), row menu as each role | Works; 15 items scroll smoothly | OK; FINDING JA2-27, -07 |
| 17 | Evidence item - Media | New item, incomplete item, clean demo item, tampered demo item | Demo items carry the DEMO media notice; own items have no media | FINDING JA2-02, -07, -08 |
| 18 | Evidence item - Metadata | New item | Raw JSON "CORE RECORD" | FINDING JA2-29 |
| 19 | Evidence item - Hash & Integrity + Verify | Clean, tampered, new, incomplete | Tampered item: red MIC 2 mismatch, "Verification failed on the Core" - very good; incomplete item verifies PASS | FINDING JA2-01, -02; OK for the tampered item |
| 20 | Evidence player (DEMO) | Volume 0 first; CAM 1 / CAM 2, MIC 1 / MIC 2, seek, pause | "Bundled demo package", "DEMO excerpt"; plays, seeks | OK; JA2-16; NOTE JA2-N9 |
| 21 | Export wizard (supervisor) | 6 steps, both outputs, reason, result | "Export accepted", "Demonstration: no archive is written." | FINDING JA2-03, -20 |
| 22 | Archive (supervisor), Download manifest | Archived one item; manifest download | Archive works; manifest: "not available on this tablet" | OK; FINDING JA2-21 |
| 23 | Devices & Inputs | List, camera search, capture selector (change and put back), microphone re-scan | Search: "not available on this Core yet"; mic swap works; camera change refused | OK; FINDING JA2-24, -27, -33 |
| 24 | Device detail (MIC 2, MIC 1, CAM 1, CAM 2, Recording Indicator) | Overview / Health / Log, Reset clip, Diagnostics, Test signal, Restart (technician) | All work | OK; FINDING JA2-12, -26, -33, -34 |
| 25 | Storage + Manage storage | Capacity, activity, See All, retention policy change and back | Policy saved, written to the activity list | OK; FINDING JA2-27, -38 |
| 26 | Network & Time | LAN sheet, time hierarchy, camera clocks, system time | Follows GNSS loss (NTP) | OK; FINDING JA2-34 |
| 27 | Audit | Chain strip, Verify, tamper notice, Show entry, Acknowledge, search, category, More filters, Live switch | Excellent; search by session id works | OK; FINDING JA2-31 |
| 28 | Settings index + App Preferences, Notifications, Security & Privacy, Capture, Transcription status, System Maintenance, About | Opened each; toggled Presentation mode and Haptics and back; diagnostics; demo update (technician); phone demo controls (supervisor) | Work | FINDING JA2-05, -29, -30, -35; NOTE JA2-N4, -N10 |
| 29 | More | Operator card, four destinations, Pairing, About | Works | FINDING JA2-35 |
| 30 | Landscape | Rotated once | NOT locked to portrait | FINDING JA2-18 |

## 3. Flows

| Flow | Steps | Result | Time felt |
|---|---|---|---|
| Wrong sign-in, sign-in | Empty submit; unknown user; investigator | Messages correct; attempts counter shown | answer about 2 s; sign-in to Home about 3 s |
| Sign-out / Lock console | Avatar menu, More, Security section | Both end on Login with "You have been signed out." | under 2 s |
| Background 68 s | Home key, wait, relaunch | Same screen, still signed in (auto-lock is fixed at 15 min) | instant |
| Core link cut and restored | `adb reconnect`, 26 s without rules, both rules restored and read back | Chip "Core Offline" within 10 s; New Session shows "Core server unreachable"; back to "Core Live" within 5 s; pairing kept | - |
| New session, happy path (SES-...-0024) | Info, check, countdown, 2 min 23 s recording with microphone switch, snapshot, marker, leave to Home and back, stop with reason | SEALED, item EV-...-0014, "Sealed 7.3 s after the recording ended" | check 3 s, seal 7 s |
| Ways out | Back at step 1 (Discard dialog), Back at step 2 (three-way dialog), Go to Home and "Continue setup", countdown Cancel, Cancel session | Each works; cancelled session leaves no row | under 1 s each |
| Failed start | Camera loss raised, New Session | Blocked at Devices Check; after the clear "Run checks again" passes | 3 s |
| Faults during a recording (SES-...-0026) | MIC no signal, camera loss, MIC clip, storage low, GNSS loss, tamper, fan stall, then power fail | Live shows meter / feed / chip changes; power fail opens Session recovery | change visible within about 1 s |
| Recovery to INCOMPLETE | Go to Home, "Open recovery", Start recovery, Acknowledge | INCOMPLETE, item EV-...-0015 "recorded, unsealed" | 8 s |
| Faults at rest | Camera loss, storage full, TPM failure, security fault, audit tamper, clip latch | Home "Recording Blocked" with the cause line; Audit "Discontinuity ... breaks at entry #176" | 0.5 s |
| Alert acknowledge / clear | Bell popover Acknowledge; clear through the API | Badge follows; cleared alerts leave the popover | 1 s |
| Verify clean / tampered | Row menu Verify, item Verify | PASS / "Integrity check FAILED", MIC 2 in red | under 1 s |
| DEMO player | Play on two demo items at volume 0 | Plays, camera and microphone switch, seek | starts in about 2 s |
| Demo export (supervisor) | 6-step wizard, twice | EXPORTED, "no archive is written" | 3 s |
| Capture selector | Camera change (refused), primary microphone swap and back, re-scan | Selector ends on the defaults | 2 s |
| Technician | Restart camera, demo update, mic swap and back | All accepted; Start Session and demo controls refused with a role line | restart instant, update 8 s |
| Scenarios | recording, finalizing, fault-demo, idle through the API | The phone follows each within 3 s | - |

## 4. Findings

Classification key: P = product defect, S = simulated-lane artefact (the simulated Core's answer or
the demo assets), E = environment / emulator.

### BLOCKER

| Id | Finding | Steps | Expected, and why | Evidence | Class |
|---|---|---|---|---|---|
| JA2-01 | An INCOMPLETE, unsealed recording shows "Sealed" hashes, a manifest hash and a signature, and verifies "Verified by the Core - PASS" | Investigator: start a session, raise the demo fault POWER_FAIL during the recording, Start recovery, on the outcome tap "View evidence item", tab Hash & Integrity, Verify | The recovery screen has just said "Session marked INCOMPLETE. It will never be sealed" and the item says "The recording is not sealed". An unsealed item must not carry rows labelled "Sealed", a manifest and a signature, and must not turn green on Verify: this is the integrity statement of the product | `098`, `099` (four tracks "Sealed <hash>", "Stored -", MANIFEST SHA-256, SIGNATURE (SIMULATED), Key), `100` (toast "Evidence EV-...-0015 verified by the Core", "Last verification PASS"); Core answer for the item: `status RECORDED`, `sealedAt null`, `verification.status PASS`, `integritySource SIMULATED`, manifest and signature present | S + P: the simulated Core produces it; the phone shows it under a "Core record" chip with no SIMULATED mark on the verdict |

### MAJOR

| Id | Finding | Steps | Expected, and why | Evidence | Class |
|---|---|---|---|---|---|
| JA2-02 | A session sealed a minute ago has "no sealed package ... in the evidence store", cannot be played, and still verifies PASS | Happy path, then "View in Evidence" | The Summary lists "Store sealed evidence package 1.0 s" as done; the item page then says "This recording has no playable media on this Core. No sealed package of this item is in the evidence store of this Core." with Play disabled, and Verify answers "Verified by the Core". For a demonstration, record - seal - play is the core story; the two screens contradict each other | `053` (pipeline), `055`, `056` ("This is a simulated item: the Core server keeps no transcript for it."), `060`/`061` (PASS) | S; the wording and the unmarked PASS are P |
| JA2-03 | Export output "Composite" is accepted and delivered as "Package" without notice | Supervisor: item, Export, Next, Next, choose Composite, Next, reason, Export (done twice, on two items) | The known limit says composite export is not available; here the phone lets the operator pick it and answers "Export accepted ... Export job EXPJ-... Complete - Package". A choice that is not honoured must be refused or disabled | `177` (Composite selected), `178` (job "Package"), also `167`, `174` | P (worse than the known limit) |
| JA2-04 | Home says "Ready for Recording - All systems operational" while the Core is unreachable | Signed in on Home, cut the link (`adb reconnect`, no reverse rules), wait 20 s | The chip turns to "Core Offline" but the status ring stays green and the tiles keep 2/2, 2/2, 20 % as if current. Without the Core the phone knows nothing; the status must say so (New Session does: "Core server unreachable") | `153_link_cut_b` (in montage `m_153`), dump at 23:11:14 | P |
| JA2-05 | The alert toasts promised in Settings do not appear | Settings, Notifications: "Choose which alert toasts this device shows ... Critical alerts always show and stay until acknowledged." Then raise STORAGE_FULL while Home is filmed | No toast in 3.5 s of recording (only the bell badge and the status card change). Also none seen for camera loss on Home, and for MIC no signal, camera loss, tamper, fan stall on Session Live (screenshots 1.2 - 2.5 s after each). The only alert toasts I ever saw were "GNSS signal lost" and "GNSS lock restored", after scenario loads | `205_toast_check.mp4`, `view/205_toast_frames.jpg`, `204`, `071`, `081`, `084`, `087`; `248`, `252_b` (the GNSS toasts) | P |

### MINOR

| Id | Finding | Steps / where | Expected | Evidence | Class |
|---|---|---|---|---|---|
| JA2-06 | The ACTIVE microphone losing its signal is easy to miss on Session Live | Raise MIC_NO_SIGNAL during a recording | Only the small meter says "NO SIGNAL / -90 dBFS" and the timeline counts one more; the header stays "Recording", the chip row (VIDEO 1, VIDEO 2, STORAGE, TIME) has no audio chip, nothing suggests "Switch to MIC 2" | `081`, `082`, `083` | P |
| JA2-07 | An interrupted session's item looks like any other outside the Sessions hub | Evidence list, item page, Home "Recent Sessions" for EV-...-0015 | Status "Recorded" only; no "Incomplete" mark, no cause; the custody line reads "POWER_FAIL; recovered" (raw code). The Sessions hub does it right | `097`, `098`, `101`, `140` | P |
| JA2-08 | A marker and a snapshot taken during the recording appear nowhere afterwards | Bookmark "Subject confirms identity" + Snapshot, then Summary, Session Details, all three item tabs | The Core keeps the marker (`markers[0].label`); the phone shows neither | `039`-`042`; text search of the three tabs: 0 hits | P |
| JA2-09 | The subject's name is cut on the last screen before recording and on Finalizing | Subject of 17-21 characters, step Ready | "Judge A2 W..." beside the chip; the Summary wraps the same name correctly | `030`, `067`, `049_d` | P |
| JA2-10 | Title "Start New Sessi..." at steps 2 and 3 | New Session after step 1 | The "Cancel session" button squeezes the title | `028`, `065` | P |
| JA2-11 | Home's main action reads "Return to live s..." during a recording | Home while recording | The one action that matters is cut | `045`, `237_b` | P |
| JA2-12 | Camera 2's on-picture label is mirrored, and the DEMO label is tiny | Devices Check preview, Camera 2 detail | Reads "OMED - EVIL - S0-OEDIV - S0-MAC" backwards; in the evidence player the same camera is correct. The DEMO word is about 8 px high | `view/028_crop.png`, `224`, `225` | S (asset) |
| JA2-13 | "tablet" on a phone | Login caption, biometric offer, "Pair this tablet", "Tablet paired", verify text "this tablet shows it as it is", "not available on this tablet", About "Tablet app", Devices "Tablet Control", export "No file is sent to this tablet" | Device-neutral wording ("this device") on the phone layout | `001`, `002`, `007`, `058`, `063`, `175` | P |
| JA2-14 | Login loses its footer | Any notice or field error on Login | The version line is 3 px high and invisible even on a clean Login; with a notice the trust line sits under the gesture bar and "Pairing details" leaves the screen; after a failed sign-in the keyboard reopens over "Sign In" | `001` (dump: `login-version` 996x3), `006`, `160` | P |
| JA2-15 | "Sign In" is announced as "busy" after a failed sign-in | Wrong sign-in, then read the button | Content description stays `busy` until the screen is left | dumps at 22:39 | P |
| JA2-16 | Sheets and popovers are not in the view tree | Bell popover, avatar menu, investigator / room / profile pickers, row menus, evidence player, Manage storage, audit More filters, camera / microphone pickers | A screen reader cannot reach them while the page underneath stays exposed (dialogs and the hash sheet are exposed correctly). The export wizard's radio rows expose no checked state | dumps beside `009`, `010`, `024`, `147`, `193`, `167` | P (to confirm with TalkBack) |
| JA2-17 | Recovery track rows are announced "..., Waiting" while they show INTACT | Recovery outcome | Stale accessibility labels | dump beside `094` | P |
| JA2-18 | Not locked to portrait; a tap went through the avatar menu after rotating back | Rotate to landscape and back on Home, avatar, "Sign out" | Landscape works but shows a quarter of Home and the nav highlight pill sits beside its icon. After the round trip the tap on "Sign out" opened the Devices tab instead (the tile under the menu), the menu stayed open over Devices and a 4-minute-old toast reappeared. Seen once; without a rotation the same taps sign out | `157`, `158`, `159` | P |
| JA2-19 | A black screen for 1.5 s or more when a recording is ended from outside | Power-fail fault on Session Live; scenario load while on Live | A transition or a notice instead of an empty screen | `088_a`, `252_a` | P |
| JA2-20 | Export wizard on a phone | Supervisor export | Stepper labels break inside words ("Authoriz-e", "Destinati-on"); a tap outside the dialog discards the wizard and the typed reason without asking; on the result the disclaimer and "Done" are below the fold | `167`, `m_169`, `174`, `175` | P |
| JA2-21 | "Download manifest" is offered and then says it is not available | Item, More, Download manifest | Hide or disable it with the reason, as Archive does | `062`, `063` | P |
| JA2-22 | Completed steps of the New Session stepper are buttons that do nothing | Tap "Session Info" at step 3 | Either go back or do not announce a button | dumps at 22:51 | P |
| JA2-23 | "Run checks again" is below eight rows | Blocked Devices Check | The remedy belongs beside "Recording is blocked" | `075`, `076` | P |
| JA2-24 | "Choice not accepted - Nothing was changed" without a reason | Devices, Change camera of Video track 1, pick CAM-02, Save | The picker offers the camera that feeds the other track without a warning and the refusal does not say why (the microphone picker explains its swap) | `184`, `185` | P |
| JA2-25 | Alerts can only be handled five at a time and vanish unacknowledged | Raise more than five; clear a fault before acknowledging | No alerts screen ("View all events" opens the Audit, which has no acknowledge); a cleared alert leaves the phone although the Core keeps it unacknowledged (5 such rows at 23:00); rows jump after each acknowledge | `091`, `103`-`107`, alerts read through the API | P |
| JA2-26 | The clip latch leaves a false-sounding banner | Raise and clear MIC_CLIP with no session | Home stays "Attention Needed - 1 check" and Devices says "MIC 2: Clipping - Recording continues on the Core." although nothing records; nothing says that "Reset clip" in the microphone's detail ends it | `108`, `110`, `112`, `113` | P |
| JA2-27 | Clipped or cut text | Devices: the first letter of "Microphones are not searched ..." is cut, model text ends "UM-1.."; Evidence search hint wraps and loses its second line; Storage activity "Storage policy changed - 365 days - ..."; "Export requires the Supervisor role." floats over scrolled content | Wrap or shorten | `view/014_crop.png`, `176`, `179`, `m_194`, `099` | P |
| JA2-28 | "Recent Sessions" lists evidence ids | Home | Rows read EV-... and open Session Details of a SES-... id | `008`, check at 23:39 | P |
| JA2-29 | Specification and developer language in operator copy | "EVIDENCE LIFECYCLE (section 19.1)", "(SYS-008)" three times, "EVT-05/06" in the timeline, "design book section 24.1", "not part of this phase", "Live uses the Core server on this computer through adb reverse", "THIRD_PARTY_NOTICES.md at the root of the repository", "Sources: not recorded (v1 package)", a "Stack check - placeholder" page reachable from About with no header, raw JSON on the Metadata tab | Operator wording; developer pages out of the product menu | `058`, `096`, `083`, `216`, `203`, `m_218`, `057` | P |
| JA2-30 | "Install update" starts at once | Technician, System Maintenance | No confirmation for an install with a reboot step (a camera restart asks first); afterwards About says v2.5.0 while More and Login say 2.4.1 | `226`-`228`, dumps at 23:32 | P / S |
| JA2-31 | Audit keeps an old verdict | Clear the audit-tamper fault | Chip "Chain OK" above "FAIL Breaks at entry #176" until Verify is pressed again; and "FAIL ..." directly above "Stored chain verified through entry #181" reads as a contradiction | `129`, `126` | P |
| JA2-32 | The Core chip on Home is a control that does nothing | Tap "Core Live" | Announced clickable, label "Core link: Live (Live)" | `011` | P |
| JA2-33 | Two statements about devices that do not fit | Devices | "Recording Indicator - Active" with a red beacon while nothing records (its detail: Lamp Off); the list says "A live preview of the cameras is not part of this phase" while the camera detail's picture is labelled "Live preview" | `233`, `235`, `191` | P |
| JA2-34 | With the launch switch `motion=off` two readouts are wrong | Network & Time; a microphone's detail | "System Time" shows hh:mm:00 for the whole minute; the large meter shows "-90 dBFS" and no bars while Health shows -17.8 dBFS. Both are right with `motion=full`. To check: does Settings, "Reduce motion" do the same? | `201`, `m_119`, `view/231_clock_crops.png`, `m_234` | E, possibly P |
| JA2-35 | Menu names that do not match | Avatar "Profile" opens the Settings index; "Lock console" is a sign-out with the sign-out notice; More says "Settings - 7 sections" over 8 rows (investigator) or 10 (supervisor, technician); "Device Settings" opens the Devices tab | One name per thing | `012`, `013`, dumps | P |
| JA2-36 | Free-text fields | End Session reason, subject name | No hint that 5 characters are needed (the button only stays grey); the keyboard's autocorrect changed my text ("abc" to "ABC") and underlines names | `047`, `048`, `024` | P |
| JA2-37 | Numbers that need a second look | Summary, recovery | "Sealed files" lists two video tracks and a transcript hash while "Hashes" lists four tracks; "Finalize transcript" and "Transcript hash" on an item that "keeps no transcript"; recovery "Last good segment ... 00:00:02 of media" beside "Recorded length 00:01:10" | `054`, `m_052`, `096` | S |
| JA2-38 | Storage counts do not match the Evidence list | Storage | "Sealed Evidence 7, Pending 1" with 13 items (10 sealed), then "8 / 2" with 15 | `015`, `193` | S |

### NOTE

| Id | Note |
|---|---|
| JA2-N1 | Home never says that this Core is simulated: the chip reads "Core Live". The truth is told item by item (DEMO, SIMULATED), not once for the whole lane. |
| JA2-N2 | A technician can open and play every interview (EVIDENCE_VIEW in the role matrix). Intended for this customer? |
| JA2-N3 | "Unpair" is reachable from Login without a sign-in, and by a technician from More; only a confirmation stands in front of it. |
| JA2-N4 | The phone's own demo controls list 9 faults; the README names 11 for the web (no TPM failure, security fault, audit tamper on the phone). The first tap on the "Demo controls" row did not open it. |
| JA2-N5 | Dialogs have no dimming behind them; over a busy page the dialog is hard to tell from the cards (`003`, `007`). |
| JA2-N6 | The "fill in the next case number" button wears a scan icon. The demo operator rows on Login are announced by name and user name only, without the role (read from the view tree; that disclosure was kept out of the captures). |
| JA2-N7 | Toasts cover "End Session" (bottom) or the header with Back (top) for a few seconds (`036`, `038`, `061`). |
| JA2-N8 | "Audio Monitor" shows larger meters; nothing is played. The name suggests listening. The button "Bookmark" opens "Add Marker". |
| JA2-N9 | In the DEMO player the picture's burnt-in date is 2026-09-30 on an item of 10 Oct, and the clock in the picture restarts while the position says 20 minutes; the "DEMO excerpt" chip and the line "excerpt of 40 s, repeated" cover it. |
| JA2-N10 | "Camera search is not available on this Core yet." with "Retry": on a simulated Core "yet" and "Retry" lead nowhere. "Searching connects to nothing." is an odd sentence. Archive asks for no reason while Export does. |
| JA2-N11 | After a scenario load the phone can stay on a screen of the old data set ("This session is still being finalized" for a session that records, then "This session has not ended yet"); two taps lead back. Session and evidence numbers are reused after a demo reset. |
| JA2-N12 | Logcat: no app ERROR line and no ReactNativeJS warning in any flow; "SurfaceMountingManager" 153 lines in the first flow, 6 in the last (known); 84 system lines "MediaPlayerWrapper: Timeout while waiting for metadata to sync for com.dems.demo.tablet" during the first session (system log, not the app's). |

Counts: BLOCKER 1, MAJOR 4, MINOR 33, NOTE 12.

Not reported again (known): login cards print the demo password; generated sources; `profileId`;
engine words; GM-01 / GM-02 (web / tablet). The composite export is reported as JA2-03 because it
looks worse than described.

## 5. Phone-specific judgement

- One hand: the primary action sits at the bottom on every flow screen (Next, Start Recording, End
  Session, Start recovery, Done / View in Evidence, Play / Export / More) - good. Back, "Cancel
  session", the bell, the avatar and the timeline button are at the top.
- Keyboard: marker sheet and reason dialogs move above the keyboard; Login does not (JA2-14).
- Safe areas: nothing under the status bar; the Login footer under the gesture bar (JA2-14).
- Long lists: Evidence (15), Audit (200+), Sessions scroll smoothly; no jump.
- Accessibility labels: Home, New Session, Summary, recovery and item pages have full, sensible
  content descriptions ("Cameras: 2 of 2 online", "Step 2 of 3, Devices Check, blocked"). Gaps:
  JA2-15, -16, -17; "PoE Switch, , 1 active" (empty middle); a soft hyphen inside "Destination".
  Session Live could not be dumped during a recording (known tooling limit), so its labels were not
  read.
- RBAC as felt: the investigator sees "Requires the Supervisor or Technician role" (camera search,
  selector, re-scan), "Export requires the Supervisor role.", "Archiving needs the Supervisor
  role", "Requires the Technician role" (Restart); the technician sees "Requires the Investigator
  role" under Start Session (Home and Sessions) and "Your role does not include the demo controls."
  All refusals are stated before the tap, in one sentence, next to the control - good. One slip:
  the list's row menu shows "Export" to the investigator as an ordinary entry (`142`, `144`; not
  tapped) although the item page disables Export with its reason.

## 6. What I could not judge, and what went wrong on my side

- Auto-lock (fixed at 15 minutes), the lock-out after five wrong sign-ins (one wrong sign-in only),
  a new pairing or an unpair (the pairing was kept), TalkBack itself (view tree only).
- A real Core process restart (the lane was not stopped); TPM failure, security fault and storage
  full during a recording (raised at rest only); "Close session" on the recovery screen (not
  offered in my run).
- The seed items in states RECORDED and UNDER_REVIEW, the effect of each Notifications switch, the
  "Reduce motion" switch, the developer switch "Core link source" (it could drop the pairing).
- Audit export: no control for it on the phone. STT: read-only status on the phone.
- The lane's web console page was not opened; the API was used.
- Mine: in the first sign-in the helper typed into fields that moved after a validation message,
  and the sign-in value landed in the username field (visible on the device for some seconds,
  never printed, never captured; cleared by key events). After that I passed the positions that
  hold once the message is gone.
- Mine: the media volume was lowered to 0 by key events before any playback (read back 0). Putting
  it back, the speaker index stays at 4 of 15 (found 5): seven key-up events and the media-session
  command did not move it further.
- 268 screenshots were taken; roughly half were opened as pictures (alone or in the
  `view/m_*.jpg` montages), the others were read through the view-tree dump taken at the same
  moment, so not every screenshot has its own one-line description here. Of the ones cited above,
  `204`, `226`-`228`, `129`, `097`, `098`, `110`, `113` (alone) and `216` were read by dump only.
- The media volume read 6 once in the middle of the first recording, after key-down events had
  brought it to 1 (nothing was playing; no playback had been started yet). Not explained, not seen
  again.

## 7. Skipped

- Biometrics (D151): every offer answered "Not now"; the biometric switch in Security & Privacy
  not touched; no fingerprint event; no lock change. Skipped, not passed.
- Local devices (D163): lane 1 offers only CAM-01, CAM-02, MIC-01, MIC-02; nothing local was
  listed, selected or started.

## 8. State left

- Phone: Login, signed out, paired as DEV-0002; reverse rules `tcp:8081 tcp:8081` and
  `tcp:4420 tcp:4421` (read back 23:39); auto-rotate as found; launch switch `motion=off` put back
  (it was `full` for two minutes for JA2-34); media volume 4 of 15 (found 5, see section 6).
- Lane 1: Core and web up, never stopped, `lane.sh reset 1` NOT used. The demo data set was
  replaced four times through the API (`demo/scenario`: recording, finalizing, fault-demo, idle),
  so it is the seed again: 13 items, tampered EV-20261010-0005, no session, no alert, no active
  fault, scenario idle, audit chain ok (83 rows), selector CAM-01 / CAM-02 / MIC-01 primary /
  MIC-02 standby, retention 90 days, software 2.4.1. My sessions SES-...-0024 / -0026 and items
  EV-...-0014 / -0015 exist only in the screenshots; the findings reproduce from the steps.
- Helper session signed out (204), its jar removed. No rig used. Lane 2 and the tablet not touched.
- No product source, test or other document changed; `masterplan/02_plan.md` and
  `judging_slots.md` not written (own lane, no rig).

---
*Generated: 2026-10-11 23:50 WIB*
