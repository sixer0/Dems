---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: UI judging session - judge A1, the TABLET app on lane 2 (real capture on generated test sources)
date: 2026-10-11
agent: verifier (as a judge; no code changed, nothing fixed)
narrative_tier: 2
status: complete - 0 BLOCKER, 7 MAJOR, 17 MINOR, 14 NOTE; overall "yes with reservations"
tree: 035150b
surface: emulator-5556 (dems2_tablet, 2560 x 1600), DEV-0001 of dems_lane_2, Core 4422
window: 22:36 - 23:48 WIB
---

# Judging A1 - the tablet app, real-capture experience (lane 2)

## 1. Overall judgement

**Would I accept the tablet for a demonstration to a law-enforcement customer today: YES, WITH
RESERVATIONS.** The core flow is solid and pleasant: sign-in, New Session with a real device check,
a 3-2-1 countdown, a live recording with durable-fragment counters, microphone switch, marker and
snapshot, a reasoned stop, a six-step Finalizing that seals in about 8 seconds, a Summary with real
hashes, the item in Evidence, a Core-run Verify (clean PASS and a precise FAIL on the tampered item),
a two-camera sealed player with an audio-source band, an honest export wizard, and RBAC that mostly
says why a control is disabled. The copy is unusually honest about development sources, the
development signing key and what the tablet cannot do. The reservations are about TRUTH ON THE
EDGES and about a mode nobody had looked at: (1) Home keeps saying "SYSTEM READY - All systems
operational" while a seal is failing and being retried, and while a camera tile says "Not
reachable"; (2) a tablet-only operator is stuck when sealing is blocked; (3) the Core's network, PoE,
diagnostics and link-quality figures are synthetic but shown as facts on the real-capture lane;
(4) an item whose verification of record is FAIL still reads "Sealed" everywhere but one tab;
(5) with motion ON (the normal launch - every earlier gate ran with the `motion=off` test switch)
an uncaught Worklets error appears in the shared stepper and the Home status ring loses its text;
(6) "Install update" starts with no confirmation. I would demonstrate it on the happy path today
and keep a web console at hand; I would not hand it to a customer unattended.

Three of my own early suspicions turned out to be artefacts of the environment's launch form
(`?motion=off`) and are NOT product defects: the clock's seconds frozen at `:00`, and the live
microphone cards stuck at "-90 dBFS" (section 6, N-01).

## 2. Method and limits of this run

- Roles: INVESTIGATOR (22:38-23:08 and 23:34-23:41), SUPERVISOR (23:09-23:32), TECHNICIAN
  (23:41-23:45). Each signed in through the app's Login with the safe helper (fields checked empty,
  no value printed); "Enable biometric sign-in?" answered "Not now" every time.
- Driving: `adb` taps, `uiautomator` dumps (password-flagged nodes never printed, long hex masked),
  screenshots, two `screenrecord` clips cut into contact sheets, the lane 2 API through the session
  helper for cross-checks, and read-only source lookups to attribute a finding.
- Launch form: the environment's (`core=LIVE&motion=off`) until 23:33; then ONE relaunch without
  `motion=off` (to tell artefact from defect); the original form was restored at 23:46.
- Four recordings on the FAKE sources (CAM-01, CAM-02, MIC-01, MIC-02 only). Two ran longer than
  the 60 s of the brief: session 1 (1:27, judging steps took longer than planned) and session 4
  (1:47, see JT-23; I stopped it through the API with a reason). Disclosed, not hidden.
- 197 screenshots under `.cache/judging/tablet/`; the ones I READ are described in section 8. The
  others were captured as sequence frames and are not individually described (they are evidence on
  disk, not claims).

## 3. Screen by screen

| Screen | What it is for | What I did | What happened | Verdict |
|---|---|---|---|---|
| Login | Operator sign-in on a paired tablet | Empty submit; one wrong sign-in; sign-in as each role; read footer | "Enter your username." / "Enter your password."; "Invalid username or password. 4 attempts remaining" (password cleared, name kept); "Core online", "Core: DEMS-IR-01 - paired as DEV-0001", v2.4.1 | OK |
| Biometric offer | Offer after a password sign-in | "Not now" (4 times) | Dialog "Enable biometric sign-in on this tablet?" closes; Home | OK (biometrics skipped) |
| Pairing details | State of the pairing | Opened; Unpair -> "Keep paired"; Continue to sign-in | Ring "Paired with DEMS-IR-01 as DEV-0001", three completed steps, identity rows; Unpair asks first | OK; N-05 |
| Home | Status at a glance, start point | Every chip, badge, tile, bell, avatar menu, See All, quick actions; with an open session; with a blocked seal; after 62 s in the background; rotation request | Tiles navigate to Devices with the device's detail; bell and avatar popovers work; chips and badges do nothing; status ring untrue in two situations; ring text lost with motion on | FINDING JT-01, JT-08, JT-12, JT-13, JT-24 |
| New Session - Session Info | Create the session | All fields, validation, long-press gloss, auto case number, pickers, notes, header menu ("Start with last profile", "Clear form" seen) | Validation clear; name silently capped at 120; odd characters accepted and rendered verbatim everywhere | OK; JT-11, N-06 |
| New Session - Devices Check | The eight pre-checks | Normal run; with CAM-02 rigged; with MIC-01 rigged; "Run checks again"; mic rescan; Back; Cancel session | Pending -> Checking -> PASS in about 5-8 s; warning with acknowledgement; block with an actionable sentence | OK (strong); JT-22 |
| New Session - Ready | Review and arm | Countdown switch, stepper, Back, leave to Home and resume, Start | Summary rows, "All devices ready", 3-2-1 countdown with Cancel (seen in the recording) | OK; JT-12, JT-22 |
| Session Live | Monitor and control the recording | Timer, CAM 1 / CAM 2 tabs, mic switch both ways, marker, snapshot, Audio Monitor, Monitor settings, End Session with reason validation | All worked; a link drop mid-recording showed "Core link lost - recording continues on the Core. Reconnecting..." then "Resynced" | OK; JT-07, JT-09, JT-23 |
| Finalizing | Seal progress | Watched normal (7.8 s) and blocked (3 automatic retries, then blocked) | Steps with durations and percent; blocked copy is precise | OK; JT-02 |
| Session Summary | Result of the seal | Every row, hash sheet, lifecycle, Done, View in Evidence | Correct against the API; "Signed with a DEVELOPMENT key - not a production signature" | OK; N-07 |
| Sessions hub | History | Filters (All 59 / Sealed / Incomplete 5 / Today), search, sealed / interrupted / incomplete details | Counts consistent with the API; cancelled sessions are not listed at all | FINDING JT-12, JT-20; N-08 |
| Evidence list | Find items | Sort, density, search, status filters, row menu | All work; empty state "No evidence matches" + "Clear filters" | OK; JT-16, JT-20 |
| Evidence item - Media | Facts, player, transcript, exports | Play, pause, seek, both cameras, audio band, transcript, Revise sheet (cancelled), finished exports | Player starts in under 1 s; band shows the MIC-02 interval; transcript is static | FINDING JT-10, JT-11 |
| Evidence item - Metadata | The Core's record | Read | Facts plus the raw JSON "CORE RECORD" | OK; N-09 |
| Evidence item - Hash & Integrity | Verify, sealed values, custody | Verify on clean and tampered items | PASS in about 3 s with per-file rows; FAIL names the track and fragment | OK; JT-04 |
| Export wizard | Export a sealed item | Investigator (refused at step 1), supervisor (all six steps, one Package export) | "Exporting evidence requires the Supervisor role. Nothing has been sent to the Core server."; supervisor: EXP-000043 complete in under 2 s, "No file is sent to this tablet." | OK; JT-16 |
| Devices | Selector, registered devices, camera search | Camera and microphone changes and back, camera search, mic rescan, CAM-01 and CAM-04 details and tabs, device diagnostics | All work; picker is a clear sheet with Save | OK; JT-03, JT-12, JT-14 |
| Storage | Capacity and policy | Read; Manage Storage as investigator; See All | "View only - Your role (Investigator) can view the storage policy." | OK; JT-21 |
| Network & Time | Link and time source | Read; LAN Connection sheet | Time section honest; network section synthetic | FINDING JT-03 |
| Audit | Operator trail | Entry detail, Verify chain, category chips, More filters, search, Live switch | All work; chain PASS; no export of the audit log is offered on the tablet | OK |
| Settings | Preferences and status | Every section opened; Reduce motion on and off; diagnostics; profile sheet; Install update (technician) | Sections honest ("Read-only on this device", "Synthetic demo values") | FINDING JT-05, JT-06; N-03 |

## 4. Flows

| Flow | Steps | Result | Time felt |
|---|---|---|---|
| Wrong sign-in, sign-in, biometric offer | Empty submit, wrong pair, right pair, "Not now" | Messages correct; Home | sign-in about 2-3 s |
| Session (a) happy path, investigator | Form -> check -> Ready -> countdown -> record 1:27 -> mic switch x2 -> marker -> stop with reason -> Finalizing -> Summary -> Evidence | `SES-20261011-0086` -> `EV-20261011-0057`, SEALED, Verify PASS | check 5 s; cameras connect 6 s; seal 7.8 s |
| Session (b) ways out, supervisor | "Start with last profile"; Back at step 2; "Go to Home, keep the session open"; "Continue setup"; "Cancel session" | `SES-20261011-0087` cancelled; Home back to "Start Session" | instant |
| Source rig CAM-02 | Pre-check with the camera unreachable; alert on the bell; acknowledge; release; "Run checks again" | Warning, then all PASS | check about 8 s |
| Source rig MIC-01 | New session; pre-check blocked; mic rescan; release; "Run checks again"; Ready | Block, then PASS | check about 8 s |
| Session 3 with the seal rig | Record 55 s; snapshot; CAM 2; Audio Monitor; Monitor settings; stop; three automatic retries; blocked; release; retry through the API (operation 33, `POST session/{id}/recover`, 202) | `SES-20261011-0088` -> `EV-20261011-0058`, SEALED 260.9 s after the stop; the tablet went to the Summary by itself within 4 s of the retry | retries 30 s + 120 s; blocked state reached after about 3.5 min |
| Session 4, motion on | Same flow by coordinates; meters observed | `SES-20261011-0089` -> `EV-20261011-0059`, SEALED; stopped through the API (JT-23) | - |
| Verify clean / tampered | Hash & Integrity -> Verify | PASS 15 rows / FAIL "VIDEO-02 fragment 3 tampered" | about 3 s |
| Player | Play, seek, pause; tampered; revised; interrupted | Works; tamper stop at 0:03; interrupted end sentence at 0:24 | start under 1 s |
| Export, permitted | Six steps, Package, "Encrypted USB drive" | `EXP-000043`, item EXPORTED, custody row, finished-exports row | under 2 s |
| Export, not permitted | Detail button / row menu as investigator | Disabled with reason / refused at step 1 | - |
| Selector | VIDEO-02 CAM-02 -> CAM-04 -> CAM-02; primary MIC-01 -> MIC-02 -> MIC-01 | Saved and read back each time; final state the FAKE defaults | about 1 s |
| Camera search, mic rescan | One run each | Stub candidate "127.0.0.1, FAKE-CAM-1, New", Connect disabled with the web pointer; "MIC-01: Ready, MIC-02: Ready" | search about 5 s |
| Background for 62 s | HOME key, wait, reopen | Still signed in, Home fresh | instant |
| Rotation | `user_rotation 1` requested | Stays landscape: rotation is locked | - |

## 5. Findings, by severity

Attribution: P = product defect, D = dev-lane artefact, L = known limit, ? = could not tell.

### MAJOR

| Id | Finding | Steps | Expected, and why | Evidence | Attr. |
|---|---|---|---|---|---|
| JT-01 | **Home says "SYSTEM READY / SECURE - HEALTHY - OPERATIONAL / Ready for Recording / All systems operational" when it is not true.** (a) For about 3.5 minutes while a seal fails and is retried: no alert, header READY, only the quick action changes to "View finalization" - yet the Core takes no new session. (b) With Camera 2's tile red "Not reachable" and one new alert on the bell. | (a) `seal-rig 2 blocked`, end a session, "Go to Home". (b) `source-rig 2 unreachable CAM-02`, run the pre-check, "Go to Home, keep the session open". | Home is the operator's one-glance truth. It did turn CRITICAL "Sealing blocked" after the third retry - the same state should show from the first failure, and an unreachable capture camera must not coexist with "All systems operational". Worse than the known "READY beside Not checked". | `161_home_blocked` (READY during retries), `143_home_session_open` (READY beside "Not reachable" and bell 1); later `home-header-state` = CRITICAL at 23:29:55 | P |
| JT-02 | **A tablet-only operator is stuck when sealing is blocked.** The tablet says so itself: "This device has no retry control: the retry is pressed on the web console." and "The Core records no new session until this one is sealed." | As JT-01 (a), wait for "Sealing is blocked". | The room device should be able to ask for the retry (the roles named for it - investigator, supervisor - are the tablet's users), or the demo must always have a web console in the room. The wording itself is exemplary. Answer to the controller's question: yes, stuck. | `164_finalization_blocked`; retry sent through the API sealed it at once | L / P |
| JT-03 | **Synthetic Core facts are shown as real on the real-capture lane.** Network & Time: "LAN Connection Connected", IP `192.168.10.21`, "Interview LAN", gateway, "PoE Network Active 2 of 2 ports", "18.6 W of 60 W", a moving bandwidth figure. Diagnostics: "Storage (SMART) PASS", "Fan and thermal PASS", "Network and PoE PASS", "Security (TPM, Secure Boot) PASS". Camera Health: "Link quality 99.9% - Derived from the Core's data" on a fake source that is "Not checked". Meanwhile Home says "Security: Not reported" under a ring that says "SECURE", and the pre-check says "Security READY PASS". | Network & Time; LAN Connection; Settings -> System Maintenance -> Run diagnostics; Devices -> Camera 1 -> Health. | The same screen is honest about time ("GNSS, network time and a hardware clock are not configured") and storage ("Not reported"); About is marked "Synthetic demo values". These values need the same mark or "Not reported". Four different answers about "security" on one device is not defensible in front of this customer. | `090_inv_network-time`; `GET network/status` (jittering synthetic values); diagnostics sheet text; Health tab text | P (Core answers) |
| JT-04 | **An item whose verification of record is FAIL still reads "Sealed" (lock chip) in the list, on the Media tab and in the Status fact.** Only the Hash & Integrity tab and the player's stop sentence tell. The Core already held a FAIL from 16:34 before I pressed anything. | Evidence -> search `EV-20261009-0005` -> Hash & Integrity -> Verify -> back to Media / the list. | A stored FAIL verdict is the most important fact about an evidence item; the list row and the status must carry it (the interrupted items do carry their own line). | `071_tampered_verify` (FAIL, toast) vs `072_tampered_media_after_fail` (row and Status "Sealed") | P |
| JT-05 | **Uncaught error with motion ON: "[Worklets] Tried to synchronously call a Remote Function. Called "scaleFor" on the UI Runtime." at `stepper.tsx:310`**, plus React "Encountered two children with the same key, `1`" (5 lines). Red error overlay ("Log 2 of 3") over the app. Every earlier gate and most of this session ran with the `motion=off` test switch, where the stepper does not animate. | Launch WITHOUT `motion=off`, sign in as technician, Settings -> System Maintenance -> Install update. | The shared stepper (New Session, Finalizing, export, update) must not throw under the normal motion policy. In a release build this is a UI-thread error, not an overlay. Motion-on needs a full pass of its own. | `195_tech_install_b`; logcat `E/ReactNativeJS` lines in `work/logcat_tech.txt` | P |
| JT-06 | **"Install update" starts at once, with no confirmation**, a sequence that names "Install to INACTIVE System Slot" and "Reboot". (The Core "runs a demonstration update: no software is installed"; the lane 2 Core kept its PID and uptime.) The caption under the running button still says "Your role does not include the demo controls." | As JT-05. | Every other consequential control asks first (unpair, archive, test signal, mic switch, cancel session). I pressed it to read the dialog; there was none. Side effect: lane 2's demo update now reads "Installed v2.5.0 - slot B". | `194_tech_install` (toast "Installing v2.5.0", step 1 running) | P |
| JT-07 | **The Audio Monitor sheet states "MIC 1 and MIC 2 are separate tracks and are never mixed." and labels them "MIC 1 - Interviewer", "MIC 2 - Subject".** The real-capture model on this lane is one active microphone with a standby: the sealed item has two VIDEO files and "Audio interval 1: MIC-01 / interval 2: MIC-02 / interval 3: MIC-01", and the cards beside the sheet say "Active" / "Standby". | Session Live -> Audio Monitor tile. | The sentence and the role names describe a recording this lane does not make. If two separate audio tracks are in fact sealed, then the item page hides them - one of the two is wrong. | `155_live_audio_monitor`; item record `tracks` = VIDEO-01, VIDEO-02; `audioSourceIntervals` 3 rows | P (needs the owner's ruling on which is true) |

### MINOR

| Id | Finding | Evidence | Attr. |
|---|---|---|---|
| JT-08 | With motion on, the Home status ring loses its text ("SYSTEM / READY / SECURE..."): an empty ring after a session's Done and a return from the background; it stays empty after leaving Home and returning, also with Reduce motion on. A fresh sign-in draws it again. Highly visible in a demonstration. | `181_after_background`, `183_ring_check`, `184_ring_after_nav`, `186_rm_home_a`; present in `190_home_tech` | P |
| JT-09 | End Session behaves differently by motion mode and can be hidden: with `motion=off` a tap opens the dialog, with motion on a tap only answers "Hold to end the session"; the bottom toast ("Marker added...", "Active microphone...") lies over the button for 2-3 s and swallowed my tap; the "Core link lost" / "Resynced" banner pushes every control down by about 50 px. | `toast_sheet` (toast over the button at 00:52-00:54), `041_end_dialog` (no dialog after the tap), `live4_end_sheet` | P |
| JT-10 | The transcript does not follow the playhead and a tap on a segment does not seek; the transcript sits below the fold, so it cannot be read beside the picture. | `058` and `059` pixel-identical 5 s apart during playback; position 0:35 after a tap on segment 0:10; no playhead code in `transcript-pane.tsx` | P |
| JT-11 | What the operator adds during a session is not visible afterwards: the marker "Judge marker 1" is in the Core's record but nowhere on the item or the player; "Snapshot captured" / "Snapshot 1 - Camera 1" produces no image and says nothing about that (contract: "No image file is produced"); the "Notes (Optional)" typed on the form are not on Ready, Summary, Session Details or the item. | Item record `markers` 1 row, `notes` []; audit `SESSION_CREATED` details hold case and subject type only | P |
| JT-12 | Truncation of the one part that matters: Sessions rows "SES-20261011-0..." (every row, the number is cut); selector "Video trac..." for both tracks; "Not assigned - CAM-..."; "Sealed - recording was i..."; the subject on Ready and Finalizing cut at about 17 characters with half the row free; bell alert rows two lines only; search placeholders cut. Home camera tile titles shrink to about half the size of "MIC 1" and the "No preview" icon is clipped. | `083_session_incomplete`, `123_cam04_saved`, `128_detail_cam04`, `080_interrupted_play`, `030_ready_step`, `144_bell_alert`, `007_home_investigator` (crop) | P |
| JT-13 | Controls that look and report tappable but do nothing: Home chips (Security, Time, Network, Storage), the READY and "Core Live" badges, Devices Check rows (the Time Sync "NOTE" is never explained), the completed step 1 in the stepper, selector rows. | `008_home-chip-*` (Home unchanged after each tap) | P |
| JT-14 | A device row opens its detail only when tapped away from its chips: a tap on the middle of the row (on "Development source" / the state chip) is swallowed. The state chip "Not checked" is grey for assigned cameras and green for unassigned ones. | Taps at (867, y) nothing, at (1175, y) detail; `128_detail_cam04` | P |
| JT-15 | "Download manifest" is offered enabled, then answers "Manifest download is not available on this tablet." | `064_download_manifest` | P |
| JT-16 | RBAC said three ways for one fact: the item's Export button is disabled with "Export requires the Supervisor role." but the row menu offers Export enabled (refused at step 1); for a technician Play is disabled with no reason at all; "Start Session" says "Requires the Investigator role" although a supervisor starts sessions too, and the caption sits under "View Evidence". | `068_row_menu`, `069_row_export_investigator`, `192_tech_evidence`, `190_home_tech` | P |
| JT-17 | After the integrity stop in the player the inner Play is disabled, but the action bar's Play starts playback again and runs to 0:08 with Camera 2 frozen. | `075_tampered_play_c`, `076_tampered_play_again` | P |
| JT-18 | "Lock console" signs the operator out completely ("You have been signed out.", both fields empty) - the same as "Sign out"; the menu's "Profile" opens Settings, not the profile sheet. | `013_lock_console`, `012_profile` | P |
| JT-19 | Android Back on Home leaves the app without a question; reopening it shows Login. The audit has no "Signed out" row for that session (only "Tablet link changed"), so a server session is left to expire. | `009_after_back_relaunch`; audit rows 1252-1255 | P |
| JT-20 | The detail pane keeps an item or session that the filter or search has removed from the list (Evidence and Sessions). | `068_row_menu` (list Exported, detail a Sealed item) | P |
| JT-21 | Storage: "Sealed Evidence: 31" is today's count without the word "today" (the lane holds about 60 items); "Est. Remaining: Not reported" although the Core's `storage/status` carries `estimatedRemainingMs`. | Storage text at 23:01; API answer | P |
| JT-22 | Stale or hidden copy in New Session: the caption "Recording starts after a 3-2-1 countdown." stays when the switch is off; "The same eight checks run when you continue." stays after the checks; "Run checks again" is below eight rows and vanishes after a pass; Back at step 2 opens "Cancel this session?" (step 1 can never be corrected). | Ready dump with the switch off; `142_back_from_step2` | P |
| JT-23 | The soft keyboard came up over Session Live with no visible field and stayed through Finalizing, covering End Session; ESC did not close it (its own hide key did). I had tapped the feed area and sent text after the "Hold to end" answer. Needs a repro by hand; I ended that recording through the API. | `177_live4_state`, `178_after_api_stop` | ? |
| JT-24 | Home with an open setup or an armed session shows nothing but a renamed button ("Continue setup"); a second operator would not know a session is open. | `143_home_session_open`, Home dump while armed | P |

### NOTE

| Id | Note |
|---|---|
| N-01 | ARTEFACTS of `?motion=off`, not defects: the Home and System Time clocks show seconds frozen at `:00` (`home-header.tsx:165` floors to the minute under the test switch); the live microphone cards read "-90 dBFS" with no bars for a whole recording while the Audio Monitor sheet read -15 / -21. With motion on both work (clock ticking, cards -16 / -21 and moving), also with Reduce motion on (clock). Worth knowing: gates run in a mode where the operator's meters look dead. |
| N-02 | Internal references in user copy: "EVIDENCE LIFECYCLE (§19.1)", "Configuration identity (design book §24.1)", "not part of this phase", "(SYS-008)", "Cause: CAPTURE_FAULT", "Earlier chains: 15, discarded by demo resets or scenario loads". |
| N-03 | Development controls in an investigator's Settings: "Core link source: Simulated / mock-core heartbeat / Live" with "through adb reverse", "Performance overlay". Not pressed (risk to the pairing). |
| N-04 | The launcher names the app "DEMS Tablet Demo"; the app calls itself "DEMS Edge Client". |
| N-05 | Pairing details is titled "Pair this tablet" on a paired tablet; Unpair is reachable from Login without a sign-in (it does ask first). |
| N-06 | The case-number helper uses a scan-frame icon for "Fill in the next case number"; the name field stops at 120 characters without a counter; "Start with last profile" copies the last INVESTIGATOR too, whoever is signed in. |
| N-07 | Summary and item: "Speaker labels: speaker labels unavailable" while Settings says "Speaker labelling: On, Credential: Not set"; the 12-stage lifecycle strip is cut at the edge; after a blocked seal "Close tracks 260.6 s" carries the whole wait; the Finalizing card shows an Evidence ID before the item exists. |
| N-08 | Cancelled sessions appear nowhere in the hub (ids skip); the seed session reads "Incomplete" in Sessions and "Recorded" in Evidence; the detail's hero is a stock room photograph; quarantined sessions say only "It will never be sealed (SYS-008)." with no next step. |
| N-09 | Metadata is a raw JSON block; subject types stay Indonesian (long-press gloss on the form only). |
| N-10 | Accessibility: popovers and portalled dialogs (bell, avatar menu, Cancel session, Manage storage) are not in the `uiautomator` tree - a screen reader's reach could not be shown; the scrubber's value is raw milliseconds ("72595"); "Desti-nation" carries a soft hyphen; radio rows expose no checked state; the rolling digits expose every digit column as text. |
| N-11 | Blocked Finalizing: "retry 3 of 3, in 120 s" does not count down. Pre-check warning: "A search found 1 camera." (the stub, not the missing camera) invites a wrong conclusion. |
| N-12 | Camera 2's player tile sits lower than Camera 1's once the "Development source" chips are drawn (after Verify). |
| N-13 | Composite is selectable in the export wizard with no notice (known limit; I did not submit one). |
| N-14 | Logcat: no app JS error in the investigator and supervisor phases (`motion=off`); `SurfaceMountingManager` warnings 1,329 and 612 lines (count only); `ExpoVideo` "picture-in-picture" error 18 lines (library). |

## 6. RBAC as felt on the device

| Role | Cannot | How the app says it | Verdict |
|---|---|---|---|
| Investigator | Export | Button disabled + "Export requires the Supervisor role."; row menu enabled then refused at step 1 with "Nothing has been sent to the Core server." | Good / JT-16 |
| Investigator | Archive | Menu item disabled + "Archiving needs the Supervisor role" | Good |
| Investigator | Change capture sources, search cameras, rescan microphones | Disabled + "Requires the Supervisor or Technician role" | Good |
| Investigator | Storage policy | Sheet opens "View only - Your role (Investigator) can view the storage policy. A Supervisor or Technician changes it." | Excellent |
| Investigator | Install update | Disabled + "Requires the Technician role" | Good |
| Supervisor | Restart a device | Disabled + "Requires the Technician role" | Good |
| Supervisor, technician | Connect a found camera | Disabled + "Connect this camera from the web console." | Good |
| Technician | Start a session | Disabled + "Requires the Investigator role" (Home and Sessions) | Good / JT-16 wording |
| Technician | Play, Export | Export with reason; Play disabled WITHOUT a reason | JT-16 |
| Everyone | Transcription settings | "Read-only on this device. Change the transcription settings from the web console." | Good |

No failing press with a raw error was met; the refusals are worded.

## 7. Not judged, and why

- Speech-to-text enable / disable as a technician: the tablet's page is read-only by design; left
  as found ("Enabled").
- Export of the audit log: not offered on the tablet.
- Countdown "Cancel" by a press: my tap arrived after the three seconds (tooling); seen only in the
  recording. That is how session 3 started; I used it as the seal-rig session.
- Session expiry and the 15-minute auto-lock: never reached (no idle gap of that length).
- "Test signal" (dialog read, cancelled: it announces a test tone - sound rule); "Restart" as a
  technician; "Apply policy" in Manage storage; Archive confirm; Unpair confirm; "Core link source"
  switch (could cost the pairing); Presentation mode, Haptics, Notifications switches, Meter size,
  Performance overlay, the password eye, the "Demo operators" disclosure (prints the demo password);
  pull to refresh (not tried); a Composite export (known limit); "Clear form" (seen, not pressed);
  Devices and Storage as a technician.
- The unsealable rig: not run, as instructed. The four quarantined sessions were read in Sessions.
- The motion-on mode beyond one session, Home, Settings and Maintenance: it deserves its own pass
  (JT-05, JT-08).

## 8. Skipped

- **Biometrics** (D151): every offer answered "Not now"; no fingerprint event, no lock or PIN
  change; the "Biometric sign-in" switch in Settings not touched. Skipped, not passed.
- **Local devices** (D163): `CAM-03` and `MIC-03` were never selected, pre-checked or started, and
  their rows were never tapped. They are LISTED by the product in both pickers ("MacBook Air Camera
  / Core Mac's camera", "MacBook Air Microphone ... Not fit for recording yet"), and the microphone
  re-scan the prompt asked for answered "MIC-03: Ready" in the pre-check notice (the Core's own
  enumeration). No selector line ever named them (read back after each change and at the end).

## 9. Screenshots read (under `.cache/judging/tablet/`)

| File | One line |
|---|---|
| `001_launch_login` | Login: emblem, fields with hints, "Core online", dev toast at the bottom |
| `002_pairing_details` | "Pair this tablet" with the Paired ring, three done steps, Continue / Unpair |
| `005_login_wrong` | "Invalid username or password. 4 attempts remaining", both fields red |
| `007_home_investigator` | Home READY, four device tiles "Not checked", 30 sealed today |
| `008_home-chip-security` | Home unchanged after tapping the Security chip |
| `010_home-bell`, `010_home-avatar` | "Latest alerts / No new alerts / View all events"; menu Profile / Lock console / Sign out |
| `012_profile` | Settings, App Preferences with "Core link source" |
| `020_session_new`, `023_long_name`, `024`-`027` | The form; case error and capped name; investigator picker; room and profile lists; header menu |
| `028_devices_check_t1/t2`, `030_ready_step` | Checks running then all PASS; Ready with the subject cut |
| `031`-`044` | Session Live: connecting, mic switch dialog, timeline, Add Marker, End dialog with "Enter a reason of at least 5 characters." |
| `045`, `047`, `048` | Finalizing at 33 % and 83 %; Summary SEALED |
| `050_summary_hash_full` | Hash sheet "Manifest hash, SHA-256, hex" |
| `051`, `055`-`064` | Item in Evidence; Verify PASS with the development banners; player playing, paused at 1:12; More menu; manifest toast |
| `065`, `068`, `069` | List options; row menu with Export enabled; refused export at step 1 |
| `071`, `072`, `075`, `076` | Tampered item: FAIL; Media still "Sealed"; player stopped at 0:03; playing again at 0:06 |
| `077`, `080` | Revised transcript with dashed revision blocks; interrupted item playing |
| `083`, `090_inv_network-time`, `091_clock_a/b` (crops), `093` | Sessions with an incomplete session; Network & Time; clock frozen at 23:02:00 twice; Manage storage "View only" |
| `096`, `103` | Audit with More filters; Profile sheet with permissions |
| `112`, `113`, `117`, `118`, `120` | Export step 3, Composite selected, transcript end, supervisor More menu, same |
| `122`, `123`, `128`, `130` | Camera picker; selector with "Video trac..."; Camera Devices list; test-signal dialog |
| `141`, `142`, `143`, `144` (crop), `147` | CAM-02 warning; "Cancel this session?"; Home READY beside "Not reachable"; bell alert row; same dialog from Cancel |
| `153`, `155`, `157` | Snapshot captured; Audio Monitor sheet; Monitor settings |
| `161`, `163` (crop), `164` | Home READY during retries; blocked alert row; "Sealing is blocked" screen |
| `170`, `171`, `173`, `174_live4_a/b` (crops) | Relaunch with motion on; Home with ticking clock; checks passed; live cards at -16 / -21 dBFS |
| `176`-`178`, `181`-`186`, `188`-`190`, `192`, `194`, `195` | Keyboard over Session Live; Finalizing under the keyboard; empty ring after background; ticking clock with Reduce motion; menu; Login; technician Home and item; "Installing v2.5.0"; the error overlay |
| `work/countdown_sheet`, `toast_sheet`, `live4_end_sheet` | Contact sheets: 3-2-1 with Cancel; the toast over End Session; "Hold to end the session", link lost, Resynced |

## 10. State left (read back 23:46-23:48)

- Tablet: on Login, launched in the environment's form (`core=LIVE&motion=off`), dev toast closed,
  both fields empty, reverse rules `tcp:8081 -> 8081`, `tcp:4420 -> 4422`, rotation setting as found,
  media volume 4 (as found; it was 0 during the session). Reduce motion off (as found).
- Lane 2: no session open (`session/current` = `SES-20261011-0089`, SEALED); selector `CAM-01`,
  `CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY; seal rig OFF, source rig OFF; 73 alerts, none active;
  audit chain `view.ok true`, `stored.ok true`, 1,327 rows. Not reset, not restarted.
- Added by this session: items `EV-20261011-0057` (EXPORTED, `EXP-000043`, verified twice),
  `-0058`, `-0059` (SEALED); session `SES-20261011-0087` cancelled; one new FAIL verification row on
  `EV-20261009-0005`; one PASS on `-0057`.
- Changed and NOT put back: the Core's demonstration update state now reads "Installed v2.5.0 -
  slot B" (JT-06: no confirmation; I do not know a tablet control that reverts it).
- Possibly left to expire on the Core: operator sessions of the Back exit (22:40) and of the
  technician (my sign-out tap before the relaunch was not read back).
- Helper API sessions signed out (204), jar removed. Slots file: slot and both rigs marked free
  (one line carries 23:26 where the clock said 23:24).

---
*Generated: 2026-10-11 23:55*
