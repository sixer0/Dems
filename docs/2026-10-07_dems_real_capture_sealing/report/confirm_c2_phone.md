---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: CONFIRMATION of fix wave J - judge C2 - PHONE app on lane 1 (SIMULATED Core, demo controls), NORMAL launch form (motion ON)
date: 2026-10-12
agent: verifier (confirmation judge C2; brief delegation_progress/judging_brief.md; environment initialization/12_environment_confirmation.md)
narrative_tier: 2
status: complete - 45 findings re-checked: 32 CONFIRMED, 4 NOT CONFIRMED (all in part), 9 NOT RE-DRIVEN; new: 1 MAJOR, 9 MINOR, 3 NOTE; no code changed
tree: b4b0c25
device: emulator-5554 (dems2_phone, 1080 x 2424), DEV-0002 of dems_lane_1
window: 12:41 - 13:35 WIB
evidence: .cache/judging/confirm-phone/ (145 PNG, view/ reduced copies and montages m_*.jpg, rec/ 8 screen recordings with contact sheets, cut/ the link-cut series, logs/ 11 logcat cuts, txt/ view-tree texts per screen, tools/)
---

# Confirmation C2 - the phone, simulated lane, normal launch form

Every statement below was read on the phone (screenshot, screen recording, or `uiautomator dump`
where the screen could idle) unless it says "Core": the lane's API through a supervisor helper
session was used only to raise / clear demo faults and to read the Core's side of a fact. Launch
form of record every time: `am force-stop com.dems.demo.tablet`, then `monkey ... LAUNCHER 1`;
reverse rules read back after every relaunch and after the link cut: `tcp:8081 tcp:8081`,
`tcp:4420 tcp:4421`. No credential, pairing code or token is in this file, a file name or a
screenshot name; hashes are not quoted. Biometrics skipped ("Not now", 3 sign-ins). No local
device exists on lane 1; none was selected.

## 1. Overall judgement

**Yes with reservations.** The one BLOCKER and the four MAJOR findings of judging A2, and the
phone halves of JM-01, JM-02 and JM-03, are fixed as the drivers say, seen on the phone in the
normal launch form: a never-sealed recording now says "Not sealed ... nothing to verify" and the
Core refuses to verify it; a sealed simulated session is called a demonstration record without
media on the Summary, on the item and in the verdict; Composite is disabled with its reason; Home
says "Core offline — state unknown" within 3 s of a cut link; critical and warning toasts come,
stay and leave as Settings promises. Logcat over eleven flows: **0** `Worklets` lines, **0**
duplicate-key lines, **0** `colorKit` / "not a valid color" lines, and **one** app ERROR record
(the animation heartbeat's stall notice under host load 12, CP-11).

The reservation is new and is visible to anyone: **on the first opening of the Evidence list and
of the Sessions hub after every sign-in the rows are laid out wrong and stay so** - rows overlap,
one row is hidden under another, and on Sessions the first row lies over "Start New Session" and
the search field (CP-01, 6 of 6 first openings, three roles). Leaving the tab and coming back
heals it. A demonstrator who opens Evidence right after signing in shows a broken screen. The
other new findings are polish and residue: the keyboard that stays over the export result and
hides "Demonstration: no archive is written." (CP-02), the crushed list row of the tampered item
(CP-03), a "Verify" entry still offered in the row menu of a never-sealed item (CP-04), and the
list rows that call a demonstration record simply "Sealed" (CP-05).

## 2. Confirmation table

C = CONFIRMED, NC = NOT CONFIRMED, NRD = NOT RE-DRIVEN. Screenshot names are files in
`.cache/judging/confirm-phone/` (`view/<name>.jpg` is the copy I read).

### 2.1 BLOCKER / MAJOR

| Id | Result | Evidence |
|---|---|---|
| JA2-01 (BLOCKER) | **C** | `SES-20261012-0027`, demo fault POWER_FAIL at 12:46:35 during the recording, Start recovery, outcome "INCOMPLETE ... It will never be sealed", record `EV-20261012-0017`. Item page: "Incomplete session — not sealed / Interrupted. Its recording is kept as a record that was never sealed."; tab Hash & Integrity holds exactly "Not sealed" and "This recording was never sealed. It has no sealed hash, no manifest and no signature, and there is nothing to verify." - no hash row, no manifest, no signature, no Verify control (`031`, dump). Play disabled with "The recording is not sealed."; More holds only Archive (disabled with its reason) (`032`). Core: `POST evidence/EV-20261012-0017/verify` -> 409 `NOT_SEALED`; the item has 0 tracks and its only 64-hex value is the null digest. Residue: CP-04 |
| JA2-02 (MAJOR) | **C**, with a reservation for the list | `SES-20261012-0028` -> `EV-20261012-0018`, sealed 12:52:01. The four statements: **Summary** (`044`): "DEMONSTRATION / Demonstration record of a simulated session: no media was recorded. This Core runs in simulated capture: the feeds, the recording state and the integrity statements it shows are a demonstration." **Item** (`046`): "This recording has no playable media on this Core. / Demonstration record of a simulated session: no media was recorded."; Play disabled with the same sentence. **Verify** (`049`, `050`): "Verified by the Core", chips "Core record" and "DEMONSTRATION", "Last verification PASS · 12 Oct 2026 12:53:33 UTC+07:00". **List** (`053`): the row says "Sealed" and nothing else - see CP-05. Seed demo item `EV-20261012-0013`: "DEMO media — bundled with this application, not a recording of this Core"; player "Bundled demo package", "DEMO excerpt", plays at volume 0 (`076`) |
| JA2-03 (MAJOR) | **C**, with a reservation (CP-02) | Supervisor, `EV-20261012-0013`, wizard step 3 (`097`): "Composite" greyed, "Composite video is not available in this build."; a tap on it selects nothing. Package export: "Export accepted", `EXP-000032`, job "Complete · Package", "Demonstration: no archive is written.", "The Core recorded this export. No file is sent to this device." (`110`). A tap outside the sheet did not discard the wizard |
| JA2-04 (MAJOR) | **C** | `adb reconnect` at 13:00:11 (`cut/sheet_cut.jpg`, 41 shots): +1.4 s still "Ready"; **+2.6 s** chip "Core Offline", card "Core offline — state unknown / This device has no link to the Core server. What is shown is the last known state.", tiles "Not known / —", ring neutral, Start Session dimmed with "Core offline. A session cannot be started from this device until the link returns." (`065`); the same at every shot to +23.5 s. Both rules restored at +24.2 s and read back; offline at +3.8 s after the restore, **"Core Live / Ready for Recording / 2/2, 2/2, 20 %" at +4.6 s**. Pairing kept |
| JA2-05 (MAJOR) | **C** | At rest (`rec/rest_critical_sheet.jpg`): STORAGE_FULL at 12:58:23, toast "Storage full / Critical alert at 12:58:23. It stays until it is acknowledged." + "Acknowledge" 2 s later, there for 10 s, gone within 1 s of the tap; the Core's alert acknowledged. During a recording (`rec/f_pf/sheet_1.jpg`, `022`): POWER_FAIL -> toast "Power failure / Critical alert ..." over the hand-over notice and the recovery screen, left on "Acknowledge" (`023`). Warning during a recording (`rec/f_mic/sheet.jpg`): "Microphone no signal / Alert at 12:50:52. The bell lists it.", leaves by itself after about 5 s. Switches: section 4. Residue: CP-06 |
| JM-01 / JT-05 (phone) | **C** | Export wizard step 1 -> 6 twice with motion on: 0 `Worklets`, 0 duplicate-key lines (`logs/f07`, `f08`); the Login after each sign-out and lock is complete (`086`, `170`) |
| JM-02 (phone) | **C** | `EV-20261012-0013`, action bar "Play" by `adb input tap`, the player closed with Back between presses: **10 of 10** opened the player (`view/m_play10.jpg`; the closed state between presses `view/m_play10_closed.jpg`) |
| JM-03 (phone) | **C** | With the Evidence tab opened earlier in the same sign-in: `EV-20261012-0017` was the first row at 12:46 and `EV-20261012-0018` the first row at 12:53, each without a pull (`026`, `053`). But see CP-01 for how the list looked at 12:46 |

### 2.2 MINOR claimed fixed (and the phone halves of tablet / motion ids)

| Id | Result | Evidence |
|---|---|---|
| JA2-06 | C | MIC_NO_SIGNAL on the active microphone: card "NO SIGNAL / -90 dBFS / No signal" and a block "MIC 1: no signal / The active microphone delivers no audio. The recording continues without sound from it until the signal returns or you switch." with "Switch to MIC 2" (`rec/f_mic/sheet.jpg`, `041`) |
| JA2-07 | C | List row and item header "Incomplete session — not sealed"; Home "· Incomplete, not sealed"; Sessions chip "Incomplete". The row's line is cut to "Incomplete session — n…" (CP-07) and the status chip is a green "Recorded" (CP-08) |
| JA2-08 | NRD | No marker or snapshot was made in my two sessions |
| JA2-09 | C | Ready: "Confirmation Judge Phone" whole on two lines (dump, `015`); Finalizing: subject whole (`rec/finalizing_sheet.jpg`) |
| JA2-10 | C | "Start New Session" whole beside "Cancel session" (`013`) |
| JA2-11 | C | Home during a recording: "Return to live session" on two lines (`020`) |
| JA2-13 | C | "this device" on Login, the biometric offer, the lock sentence, the export result, the verdict text; "Device Control", "Device app". One raw word left: audit rows "Device link changed · System · TABLET" (`130`; CP-12) |
| JA2-14 | C for the footer; the failed-sign-in half NRD | Trust line, pairing line and "App v0.1.0" visible on a clean Login (`091`) and under a notice (`170`). No wrong sign-in was typed. After Lock console the Login opens with the keyboard over "Sign In" (`086`) |
| JA2-15 | NRD | No wrong sign-in typed |
| JA2-16 | C for the bell and the account menu | Signed in on Home, `uiautomator dump`: "Latest alerts", the alert's text, "Acknowledge: Microphone no signal · 10:57:53 · resolved, not acknowledged", "View all events", "Close"; account: name, "Role: Investigator", "Settings and profile", "Lock console", its sentence, "Sign out", "Close". Back closed each; `topResumedActivity` stayed the app. Still outside the tree: the item's "More" menu and the list's row menu (popovers; `032`, `036`). The player sheet could not be dumped while playing |
| JA2-17 | NRD | The analysis rows of the recovery outcome were not dumped |
| JA2-19 | C | Film of POWER_FAIL on Session Live at 4 frames a second: "The recording was interrupted / Opening session recovery…" for about 2 s, then the recovery screen; no empty frame (`rec/f_pf/sheet_1.jpg`) |
| JA2-20 | **NC in part** | One label under the badges ("Step 3 of 6 · Destination") and no discard on an outside tap: confirmed. "The result fits": not while the keyboard is up - CP-02 |
| JA2-21 | NRD | A never-sealed item has no manifest entry (confirmed). The disabled entry with its reason on a sealed item was not opened |
| JA2-22 | C | Completed steps are disabled text nodes "Step 1 of 3, Session Info, completed" (dump) |
| JA2-23, -24, -26, -31 | NRD | No blocked devices check, no selector change, no clip fault, no audit-tamper fault raised |
| JA2-25 | C | Bell with 12 open alerts: every one listed with "resolved, not acknowledged" and its own Acknowledge, badge "9+" (`063`). Of 11 quick taps on the first row's Acknowledge only 4 acknowledged (the rows move up after each); there is no "Acknowledge all" on the phone |
| JA2-27 | **NC in part** | Devices: the sentence is whole (`078`). Still: the search hints end "…case number.." (`026`, `067`); the two reason lines float over scrolled content (`047`) |
| JA2-28 | C | Recent Sessions rows read SES ids (`005`) |
| JA2-29 | C for ids | No "AC-", "SEC-", "SYS-", "M4-", "EVT-", "OD-", "§", "design book", "placeholder" in the texts of 14 screens (`txt/`, grep). In this development build App Preferences still shows "Developer / Core link source / mock-core heartbeat ... on this computer" and About "Stack diagnostics (developer)" - said to be absent from a release build, which I cannot check. Metadata tab: raw JSON (by decision) |
| JA2-30 / JT-06 | C | Technician: "Install update v2.5.0? / ... installs it to the inactive system slot (B) and restarts into it. No session can be started while it runs. / The Core server runs a demonstration update: no software is installed." -> "Not now"; still "Installed v2.4.1 · slot A"; Core `update.state IDLE` (`127`, `128`) |
| JA2-32 | **NC** | `home-core-link` "Core link: Live (Live)" and the "Simulated Core" chip are still `clickable="true"` in the view tree (dump at 12:43). Not tapped |
| JA2-33 | C | "Recording Indicator / Lamp off"; "Status only. This build shows no live picture of the cameras." |
| JA2-34 | C in the normal form | System Time ticks (13:29:14, :16); microphone detail meter live at -53 dBFS (`view/m_134_135.jpg`, `view/m_140_142.jpg`). `motion=off` not driven |
| JA2-35 / JT-18 | C | "Settings and profile"; More "10 items" over 10 rows (supervisor); Lock console -> Login "Console locked — sign in to continue" (`086`) |
| JA2-36 | C | "At least 5 characters. 0 / 500" before any error (`042`); typed text was not altered (the suggestion strip still shows) |
| JA2-38 | C | "Sealed today", "Recorded, not sealed" |
| JM-04 (phone) | **NC in part** | After End Session the keyboard is gone on Finalizing (`rec/finalizing_sheet.jpg`). After "Export" it stays - CP-02 |
| JM-07 | NRD | Not measured per frame |
| JM-08 | C | The wizard and the player are sheets with motion on; outside tap keeps the wizard |
| JM-09 | C, live | While I was on Network & Time the web judge's session ended: the phone opened its Summary with "This session was recorded by AKP Andi Pratama (OPR-002), not by you. You can read its summary and acknowledge it with Done." (`084`) |
| JT-16 (phone) | C | "Requires the Investigator or Supervisor role" |
| JT-19 | C | First Back on Home: "Press Back again to leave DEMS." and the app stays (`009`) |

Declared not fixed by the drivers and seen unchanged: JA2-12 (Camera 2's label mirrored, `view/014_crop.png`),
JA2-37 (see CP-05), JA2-18 (no portrait lock - landscape judged in CP-09), JM-N5 ("Back to Evidence" on
an item opened from the Summary leads to Home).

Counts: **32 CONFIRMED, 4 NOT CONFIRMED (JA2-20, JA2-27, JM-04 in part; JA2-32), 9 NOT RE-DRIVEN**
(JA2-08, -15, -17, -21, -23, -24, -26, -31, JM-07).

## 3. Demo truth, RBAC

| Check | Result |
|---|---|
| Home chip | "Simulated Core · demonstration" on every Home, also "Recording Blocked" and "Session in progress" |
| DEMO on Session Live feeds, pre-check | Only the picture's own burnt-in "CAM-01 \| VIDEO-01 \| LIVE \| DEMO" (about 8 px high); no word of the app on either screen - CP-10 |
| Integrity statements | Verdicts carry "DEMONSTRATION" (sealed item PASS, tampered item FAIL); "SIGNATURE (SIMULATED)"; before a Verify the tab says only "Core record" |
| Camera search | Supervisor: "This Core is simulated: it has no camera search. Camera search is a function of a Core in real capture. The cameras of this demonstration are listed under Camera Devices." with the button disabled (`111`) |
| Install update | Confirmation naming v2.5.0, slot B and the restart; cancelled |
| Lock console | "Console locked — sign in to continue" |
| "Retry sealing" | Not offered on Home, Sessions, Summary, Finalizing (nothing was blocked) |
| RBAC, investigator | Item "Export" disabled: "Export requires the Supervisor role."; "Archive": "Archiving needs the Supervisor role"; "Search for cameras", the four selector "Change" controls and "Search again": disabled, "Requires the Supervisor or Technician role" |
| RBAC, technician | Home "Start Session" and Sessions "Start New Session" disabled: "Requires the Investigator or Supervisor role"; row menu "Export": "Requires the Supervisor role"; "The demo controls require the Supervisor role." |
| RBAC, supervisor (extra) | "Install update" disabled: "Requires the Technician role" |

No control was found that is enabled and then refused by role.

## 4. Settings -> Notifications: effect of each switch

Found: all four ON. Filmed with all four OFF, then ON (`rec/sw_off_sheet.jpg`, `rec/sw_on_sheet.jpg`,
`rec/sw_mic_sheet.jpg`). Left: all four ON (`060`).

| Switch | OFF | ON |
|---|---|---|
| Cameras and microphones | MIC_NO_SIGNAL: no toast in 7 s | "Microphone no signal" |
| Storage | STORAGE_LOW: no toast | "Storage low" |
| Time sources | GNSS_LOSS: no toast | "GNSS signal lost" |
| Enclosure and system | FAN_STALL: no toast | "Fan stalled" |
| Critical alerts (locked) | - | always: "Storage full", "Power failure", and "Camera signal lost" (CP-06) |

## 5. New findings

| Id | Sev. | Finding | Steps | Evidence |
|---|---|---|---|---|
| CP-01 | **MAJOR** | **The Evidence list and the Sessions hub are laid out wrong the first time they are opened after a sign-in, and stay so.** Rows overlap; one row is hidden under the next; a gap follows the first row; five rows sit 20 px to the left and are cut at the right. On Sessions the first row lies over "Start New Session" and the search field. Unchanged after 10 s and after scrolling; correct after leaving the tab and returning. Not in the first judges' reports of `035150b` | Normal launch, sign in, tap "Evidence" (or "Sessions") | 6 of 6 first openings: investigator 12:46 (`026`-`029`) and 13:01 (`067`, `view/m_068_070.jpg`), supervisor 13:13 (`view/m_092_094.jpg`), technician 13:24 (`view/m_124_126.jpg`). Not established: the cause; whether it needs motion on |
| CP-02 | MINOR | After "Export" the keyboard stays although its field is gone; the sheet grows under the status bar and the lower half of the result - "Demonstration: no archive is written.", the "no file is sent" line and "Done" - is covered until Back is pressed | Wizard step 4, type a reason, "Export" | `108`, `109` (keyboard still shown 15 s later), `110` (after Back: everything fits) |
| CP-03 | MINOR | The list row of the tampered item is crushed by its chip "Sealed · verification FAILED": the id is drawn about 6 px high, date "11 Oct …", name "Dewi…", the subject chip wraps to "Lain / nya", duration "00:29…" | Evidence, search "0005" | `163_tampered_row` |
| CP-04 | MINOR | A never-sealed item's row menu still offers an enabled "Verify" (Export beside it is disabled with a reason). It opens the item on "Not sealed ... nothing to verify" - no verdict, no PASS. The Metadata tab prints `"manifestHash"` and `"signature"` with zero placeholders and `"lifecycleStage": "RECORDING"` for an ended session | Evidence, row menu of `EV-20261012-0017`; item, Metadata | `036`, `037`, `034`, `035` |
| CP-05 | MINOR | A demonstration record is not marked outside its banner: the Evidence, Sessions and Home rows say "Sealed"; Summary and item give "174.5 MB" and "VIDEO-01 · sealed file" hashes beside "no media was recorded"; Finalizing runs "Store sealed evidence package" with no mark; export step 2 says "Source verified by the Core: PASS" without the mark | Seal a session on lane 1 | `053`, `067`, `048`, `rec/finalizing_sheet.jpg`, dump of step 2 |
| CP-06 | MINOR | Settings lists "Camera loss" under the switch "Cameras and microphones", but a camera loss is CRITICAL and shows with the switch off; the "Critical alerts" row does not name it. Also: a critical toast that nobody acknowledged leaves when the fault is cleared, against "stay until acknowledged" (the bell keeps it) | Switch off, raise CAMERA_LOSS; clear it | `rec/sw_off_sheet.jpg`, first frames of `rec/sw_on_sheet.jpg` |
| CP-07 | MINOR | Cut text left: "Incomplete session — n…" on every incomplete row; "Confirmation Judge …" in rows and "Confirmation Judge P…" on the item's Subject line (Ready and Summary wrap the same name); search hints | Lists, item | `053`, `032` |
| CP-08 | MINOR | A never-sealed, interrupted record wears a green "Recorded" chip with a dot - the colour of the "Online" chips - on the row, the header and the Status line | Evidence | `053`, `030` |
| CP-09 | MINOR | Landscape is usable, not good: a rail layout with "Microp" (title cut), "View Evi…", the status-bar clock over the rail, and the primary action below the fold. Rotating back shows the landscape arrangement squeezed into portrait for about 4 s (cards displaced, Quick Actions missing), then recovers; the account sheet works afterwards (JA2-18's tap-through not seen) | Rotate once on Home and back | `150_landscape_home`, `151`, `152`, `view/m_153_155.jpg` |
| CP-10 | MINOR | Session Live and the Devices Check carry no DEMO word of the app; the only mark is in the bundled picture, and Camera 2's is mirrored | New Session step 2; Session Live | `view/014_crop.png`, `017` |
| CP-11 | NOTE | The one app ERROR of the run: `motion.uiRuntime.stalled` "The animation runtime stopped answering its heartbeat." (5 misses of 4 s; "still form for the rest of the process") at 13:10:35, host load 12, device load 6, my view-tree dumps running; a red notice in the development build. In the same minute the phone, signed in as investigator and reading Network & Time, was moved by itself to the web judge's Finalizing and Summary - no word before it moved | - | `logs/f06_walk_foreign_session.txt`, `084` |
| CP-12 | NOTE | Small things: audit rows name the device "TABLET"; the exported item says "Finished exports: not reported" right after "Complete"; Storage activity reads "Fault raised · Storage full SES-20261012-0028" for a session that had ended; a Sessions row of a sealed session opens the item, and its Back leads to the Evidence list; no demonstration word on Network & Time | - | `130`, `111` (first take), `txt/080_storage.txt` |
| CP-13 | NOTE | Typing with `adb input text` while no field had focus closed the export sheet and the item page and left a keyboard over the Evidence list that ESC did not close (Back did). Hardware-key input only; not reproduced by touch | - | `100`, `104`, `logs/f07` |

## 6. Logcat (cleared after each sign-in, read after each flow)

| Flow | App ERROR | `Worklets` | duplicate key | `colorKit` / "not a valid color" | SurfaceMountingManager events (library, count only) |
|---|---|---|---|---|---|
| f01 Home, sheets, Back | 0 | 0 | 0 | 0 | 0 |
| f02 session, POWER_FAIL, recovery, item | 0 | 0 | 0 | 0 | 790 |
| f03 sealed session, Summary, Verify | 0 | 0 | 0 | 0 | 358 |
| f04 toasts, switches, bell | 0 | 0 | 0 | 0 | 16 |
| f05 demo player, 10 presses | 0 | 0 | 0 | 0 | 58 |
| f06 lists, Devices, Storage, the web judge's session | **1** (CP-11) | 0 | 0 | 0 | 1,989 |
| f07, f08 export wizard | 0 | 0 | 0 | 0 | 40, 62 |
| f09 supervisor Settings | 0 | 0 | 0 | 0 | 0 |
| f10 technician, Audit, rotation, tampered item | 0 | 0 | 0 | 0 | 328 |
| f11 sign-out, Login | 0 | 0 | 0 | 0 | 203 |

Colours looked at on chips, badges and the player (Sealed violet, Exported blue, FAIL red, DEMO
amber, meters, toasts): nothing missing or wrong except the judgement of CP-08. `E/ExpoVideo`
picture-in-picture lines (library): 49. `AndroidRuntime` lines are `uiautomator`'s own.

## 7. Not judged, and what went wrong on my side

- Not judged: a wrong sign-in (JA2-14 second half, JA2-15); markers and snapshots; a blocked
  devices check; the selector; clip and audit-tamper faults; the Pair screen; Manage storage;
  TalkBack; a release build; `motion=off`; the tablet.
- A second link cut that I did not intend: my command line ran the cut script twice (13:00:11 and
  about 13:01, 20 s). Both rules were restored and read back each time; pairing kept.
- Recording lengths: 0:34 (interrupted) and **1:16**, over the 45 s asked.
- My helper session was displaced when the phone signed in as the same supervisor (the Core
  answered 401 afterwards); I signed it in again for the end-state read. At the end I removed its
  jar after a sign-out call to a wrong path (404): that session was not signed out and expires by
  itself.
- A failed `uiautomator dump` left the previous screen's file on the device and my helper read it
  twice as if it were current (Network & Time); corrected in the helper. Nothing in section 2
  rests on those two reads.
- One Android Back on the Login left the app for the launcher; the app was relaunched in the form
  of record.
- 145 screenshots were taken; the ones cited were read as pictures (alone or in a montage) or
  through the dump taken at the same moment.
- `masterplan/02_plan.md` was not written (as the first judges).

## 8. State left (read back 13:33 - 13:35)

- Phone: Login in the normal launch form, fields showing only their hints, "Core online", "paired
  as DEV-0002"; rules `tcp:8081 tcp:8081`, `tcp:4420 tcp:4421`; auto-rotate as found; Settings
  -> Notifications as found (four ON). **Media volume 5 of 15 (found 4)**: after 0 for the
  playback the key events and the media-session command would not bring it to 4 any more.
- Lane 1: no session open; `activeFaults []`, scenario idle; 17 alerts, none active, one
  unacknowledged and not mine (`ALR-000007`, found); selector `CAM-01`, `CAM-02`, `MIC-01`,
  `MIC-02`, unlocked; audit chain ok (299 rows); update not installed (2.4.1, slot A, IDLE).
  Added by me: `SES-20261012-0027` INCOMPLETE (`EV-20261012-0017`, never sealed),
  `SES-20261012-0028` SEALED (`EV-20261012-0018`), export `EXP-000032` of `EV-20261012-0013`
  (now EXPORTED). The web judge's summary of `SES-20261012-0029` was left with Back, not "Done".
- Slots file: my two lines (held 12:45, free 13:00). Lane 2 and the tablet not touched. No rig.
  No product source, test or other document changed.

---
*Generated: 2026-10-12 13:40 WIB*
