---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: CONFIRMATION of fix wave J - judge C3, the WEB CONSOLE on lane 2 (real capture on generated test sources) and lane 1 (simulated, demo controls)
date: 2026-10-12
agent: verifier (as a confirmation judge; no code changed, nothing fixed)
narrative_tier: 2
status: complete - 31 checklist items: 28 CONFIRMED, 3 NOT CONFIRMED (JW-10, JW-13 in one part, JW-18), 0 not re-driven as a whole (parts not re-driven are named per row); 8 new findings (0 BLOCKER, 0 MAJOR, 3 MINOR, 5 NOTE); overall "yes with reservations"
tree: b4b0c25
surface: headless Chrome (audio muted), two profiles; lane 2 http://127.0.0.1:5177/ and lane 1 http://127.0.0.1:5176/; 1440x900, with 1280x800 and 1920x1080 where a row says so
window: 12:42 - 13:29 WIB
---

# Confirmation C3 - the web console on both lanes after fix wave J

Evidence folder: `.cache/judging/confirm-web/` (screenshots `cNNN_*.png`; `dl2/` and `dl1/` hold the
downloads; `tools/` my driver scripts, derived from the earlier judges' CDP driver; `work/` the step
logs). Everything below was done through the pages of the console in a real headless browser. The
lane API (a helper supervisor session on lane 2) was used only to READ the Core's side of a fact
(evidence list, alerts, selector). The rigs were switched with `scripts/lane/lane.sh`. No credential,
pairing code, fixture account, token or signed path is in this file, in a file name or in a kept
screenshot; long hex runs are shortened. Sign-ins were typed into the Login form from a private 0600
file that is removed.

## 1. Overall judgement

**Would I accept the web console for a demonstration to a law-enforcement customer today: YES, WITH
RESERVATIONS - and the reservations are now about layout, not about truth.** The one BLOCKER and all
eight MAJOR findings of the first report are fixed as the drivers claim, and I saw each of them in a
browser: a never-sealed item shows no sealed value, no manifest, no signature, no verify control and
no verdict; the tampered item reads "Sealed · verification FAILED" in the list, the header, the
Status fact and the lifecycle on both lanes; "Download manifest" of a real item is disabled and
points to Export; Composite is disabled with its reason on both lanes and no request leaves the
page; the system state is said ONE way on lane 2 (pill, popover, ring, strip, Security & Audit, the
form's readiness row and the pre-check row all say "not reported"), turns to "ALERT ACTIVE" about
1.3 s after an unreachable camera is found, to "SEALING RETRIED" 0.25 s after a seal fails, to
"CRITICAL - Sealing is blocked" when it is blocked, and to "CORE OFFLINE - State unknown" 2.75 s
after the console loses the Core; "Install update" asks first on lane 1 and does not exist on lane 2;
the simulated lane is marked on every page I opened; the microphones read "Not measured" at rest.
Round three's items, proven only by component tests until now, hold in the browser too: one version
per component, the bell with "Acknowledge all" (89 requests, 89 accepted, none refused), the session
history with the four quarantined sessions and their cause, the notes block, the lock notice and the
return to the locked page, a log export without a `demo` member, the sideways cue of the audit
table, role reasons on every disabled control I found. A full session from the web on lane 2 sealed
in 20.0 s, verified 15 of 15, played from both files, stopped on the tampered file, and its Package
export passed the product's own verifier (`RESULT: PASS`). What is left: the Evidence table again
hides its Status column and its row menu - now at 1280 AND at 1920, because one long subject name
widens the table (JW-10); the "AUDIO MONITOR" heading breaks inside the word, on lane 1 at 1440x900
into one or two letters per line (CW-01); the Dashboard's camera tiles clip their own text at 1440
and 1280 (CW-02); three custody actions still print their raw code (JW-13, one part). None of these
states something false. I would run the demonstration at 1440x900 and keep the Evidence list out of
1280 and 1920 until the table is fixed.

## 2. Method and limits

- Roles: SUPERVISOR (lane 2, 12:42 - 12:52 and 12:54 - 13:28; lane 1, 13:02 - 13:12 and 13:18 -
  13:26), INVESTIGATOR (lane 2, 12:52 - 12:53), TECHNICIAN (lane 2, 12:53 - 12:54; lane 1, 13:12 -
  13:13).
- Sessions I ran (all announced in `delegation_progress/judging_slots.md`, all released):
  lane 2 `SES-20261012-0103` (web, form note, source rig at the pre-check, 1 min 05 s - 5 s over the
  60 s of the brief, my end dialog took two presses) -> `EV-20261012-0073`; lane 2
  `SES-20261012-0104` (web, 48 s, seal rig blocked -> retried -> blocked 13:04:08 -> released ->
  "Retry sealing") -> `EV-20261012-0074`; lane 1 `SES-20261012-0029` (web, 28 s, sealed as the
  demonstration record `EV-20261012-0019`); lane 1 setup `SES-20261012-0030`, discarded.
- Box check: the earlier driver's `box.js` (text cut by an ellipsis or a clipped box, a text
  sticking out of its card, a scroll container hiding content sideways, text boxes over each other)
  at 1280x800, 1440x900 and 1920x1080, plus my own geometry reads where a picture disagreed with it
  (the box check does NOT see a word broken inside itself nor a text clipped by a picture box:
  CW-01 and CW-02 were found by opening the pictures).
- 90 screenshots; the ones I OPENED as pictures are named in section 8. The others were read
  through the page text taken in the same step. Four pictures taken with the "whole page" option
  (`c005`, `c008`, `c017`, `c028`) show the header clock printed over the bell: an artefact of that
  capture mode (the plain capture `c029` of the same page is clean), not a product defect.
- LOCAL DEVICES (D163): `CAM-03` / `MIC-03` were never selected, pre-checked or started; I changed
  no selector line at all (read back through the API before my first session: `CAM-01`, `CAM-02`,
  `MIC-01` PRIMARY, `MIC-02` STANDBY; no line names the local devices).

## 3. The checklist: every BLOCKER, MAJOR and MINOR of `judging_b1_web.md`, and GM-01 / GM-02

L2 = lane 2, L1 = lane 1. Quoted text is what the page said.

| Id | Sev. | Verdict | Evidence |
|---|---|---|---|
| JW-01 | BLOCKER | CONFIRMED | L1 `EV-20261012-0014` (INCOMPLETE session): list row "Recorded · Not sealed"; header chips "Recorded / Core record / Not sealed"; Hash & Integrity: "This item was never sealed - The recording ended before it could be sealed. There are no sealed values, no manifest and no signature, and there is nothing to verify."; no verify control in the DOM, no "SEALED VALUES" block, 0 hex runs, no PASS word; More menu = "Copy ID / Archive" (no manifest entry); row menu "Verify - Not sealed" disabled, Export disabled; Media "The recording is not sealed." (`c061`, `c062`). L2's seeded never-sealed `EV-20261009-0006` reads "Recorded / DEMO package / Not sealed" |
| JW-02 | MAJOR | CONFIRMED | L2 real item (`EV-20261009-0005`, `EV-20261012-0072` as investigator): "Download manifest - The signed manifest is part of the export package. Use Export.", disabled (`c009`). L2 DEMONSTRATION item `EV-20261010-0007`: entry "Download DEMO manifest summary", toast "DEMO manifest summary downloaded", file `EV-20261010-0007-manifest.demo.json` = the bundled demo package's own manifest (it keeps `demo: true` and "DEMO - synthetic evidence package ... Not evidence": the driver's kept row 7 of note 175). The CONSOLE-WRITTEN file of a demonstration item (export of `EV-20261008-0002`, `EXP-000052`): name `EXP-000052-EV-20261008-0002-export-manifest.demo.json`, NO member named `demo` or `simulated` anywhere, `demonstrationItem: true`, notice: "Export manifest summary of a demonstration item this DEMS Core server holds, written by the web console from the bundled package of that item. It is not a recording of this Core and not evidence: the Core makes no export archive for a demonstration item. A recording sealed on this Core is exported by the Core itself, as a signed archive." NOT RE-DRIVEN: the `...-manifest.core-record.json` form (note 175 F3) - every demonstration item of lane 2 has its bundled package joined (seven opened: all "DEMO package") |
| JW-03 | MAJOR | CONFIRMED | L2 `EV-20261012-0072` and L1 `EV-20261012-0019`: output list "Package" and "Composite · Composite video is not available in this build." with `aria-disabled=true`; the step says "Composite: Composite video is not available in this build."; a press on it leaves "Package"; network panel: only `POST auth/touch`, no export request (`c010`, `c011`, `c077`). The review step states "Export output - Package" |
| JW-04 | MAJOR | CONFIRMED | L2, one answer: pill "NO FAULT REPORTED - Platform security: not reported"; popover "Evidence encryption (AES-256-GCM): Not reported / TPM 2.0 and Secure Boot: Not reported / Enclosure tamper seal: Not reported"; ring "READY - OPERATIONAL • NO FAULT REPORTED - No fault is reported. A new session can be started."; strip "Security - Not reported"; card "Platform security: not reported", "Security Posture - NOT REPORTED"; Security & Audit "Posture: not reported - 2 of 9 controls active, 7 not reported"; form readiness "Security - Not reported"; pre-check row "Security - This Core reads no TPM, Secure Boot or enclosure state. Nothing was checked. - Not reported" (`c002`, `c003`, `c004`, `c037`). No "SECURE" and no "PASS" for security anywhere on L2 |
| JW-05 | MAJOR | CONFIRMED | `source-rig 2 unreachable CAM-02`: pill "ALERT ACTIVE - 1 active alert" 2.85 s after pressing Next on the form (the check itself starts about 1.5 s in), bell "1 new alert"; ring "ATTENTION - 1 ACTIVE ALERT - CAM-02 is not reachable" (`c033`, `c036`). After `release` + "Re-run checks": "All checks passed", pill back to "NO FAULT REPORTED", 0 banners (`c037`). Seal rig: pill "SEALING RETRIED - The Core is running the seal again" 0.25 s after the end of the session, ring "ATTENTION - SEALING IS BEING RETRIED - The seal of session SES-20261012-0104 did not complete. The Core runs it again by itself."; blocked: pill "CRITICAL - Sealing is blocked", ring "CRITICAL - NO NEW SESSION UNTIL IT IS SEALED" (`c052`..`c056`). **Core offline, first time in a browser:** with the tab's network cut, pill "CORE OFFLINE - State unknown" after 2.75 s, ring "UNKNOWN - CORE OFFLINE • STATE UNKNOWN", mode chip "LIVE · OFFLINE", banner "Core server unreachable - The screen shows the last state received. Reconnecting… - Switch to Simulated mode" (`c064`); with only the API path blocked, an action answers "Core server unreachable. Nothing was changed."; restored: pill back |
| JW-06 | MAJOR | CONFIRMED | L1 technician: "Install v2.5.0? - The signed bundle is checked and installed to the inactive slot B. The running version v2.4.1 stays in its slot as the rollback target. - The Core then restarts into the new slot. The console and every paired device lose the Core for the length of the restart. No session can be recorded meanwhile. - DEMO - Cancel / Install and restart"; CANCELLED: no request, card still "Available" (`c078`). L1 supervisor: "Install update - Requires the Technician role". L2: "SOFTWARE UPDATE - Not available - Software update is not available on this Core. It has no updater: nothing can be installed from here."; no Install control |
| JW-07 | MAJOR | CONFIRMED | L1 mode chip "LIVE · DEMO CORE". Marks counted: Dashboard 9 ("DEMO · SIMULATED" on ring and strip, "DEMO" on cards), pre-check 5 (Devices Check, both previews, levels), Monitor while recording 12 (banner "SESSION ACTIVE & SECURE ... DEMO · SIMULATED", every panel, the picture), Storage 7, Network & Time 6, Devices 10, Security & Audit 12, System 10 (`c070`..`c074`, `c074` opened). Remark: the SEAL DIALOG of the simulated lane carries no mark (CW-04) |
| JW-08 | MAJOR | CONFIRMED | L2 at rest: Dashboard, pre-check, Devices and the sealed Monitor read "Not measured" for both microphones (0 "NO SIGNAL"); during the recording -13 / -21 dBFS. Cameras nobody checked: "NOT CHECKED" / "Not checked" on tile, strip and pre-check previews. Three of the four unchipped facts re-checked: camera Health "LINK QUALITY (%) - Synthetic demo values"; Devices banner no longer "ALL DEVICES READY 7/7" (it read "1 DEVICE NEEDS ATTENTION - Operator device: OFFLINE", true at that moment: Paired Devices said "2 paired · 0 online"; "PORTS LINKED 7/7" is chipped); Network banner "HOST SYSTEM CLOCK • NETWORK NOT REPORTED". NOT RE-DRIVEN: a camera on a dead port (I changed no selector line; lane 2 was held by the tablet judge afterwards) |
| JW-09 | MAJOR | CONFIRMED | L2 `EV-20261009-0005`: list row "Sealed · verification FAILED", header chip the same, "Status - Sealed · verification FAILED", lifecycle "Sealed local evidence - The verification of record FAILED - 8/12: Fault", verdict "FAIL - Last verification FAIL · 12 Oct 2026 10:24:25" (`c006`, `c007`, `c008`). L1 `EV-20261011-0005`: "Sealed" while it had no verification of record; after ONE Verify (FAIL) list row, header, Status and lifecycle read the same four statements (`c092`) |
| JW-10 | MINOR | **NOT CONFIRMED** | Paired Devices: fits at all three widths. **Evidence list, L2, after a fresh load at each width:** 1440: fits (1184 in 1184, row menu hit-testable). **1280: table 1180 px in 1024** - the Status cell (x 1204-1352) and the row menu (x 1352-1416) lie outside the container (right edge 1260); the row menu is not hit-testable. **1920 (with the preview pane): 1276 px in 1077** - Status and row menu outside again (`c080`, `c081` opened: no Status column, no Actions in view). The Subject column is 509 px wide: it takes the width of the longest subject on the page ("Round Two Wijayakusuma Hadiningrat J2M form note Counsel present"). The first report found 1920 clean; with a long name it is not. L1 (short names) fits at all three |
| JW-11 / GM-01 | MINOR | CONFIRMED | The row reads whole at all three widths: "Camera 2 (CAM-02) is not reachable. The session will record one camera only. It did not answer the pre-check. A search found 1 camera." - 4 lines in 222 px at 1280, 3 lines in 287 px at 1440, 2 lines in 472 px at 1920; `white-space: normal`, no ellipsis, scroll size = client size; box check 0 cut (`c033`, `c034`, `c035`) |
| JW-12 | MINOR | CONFIRMED | `EV-20261011-0060` and `EV-20261012-0073`: the segments are on the page BEFORE "Open playback"; while playing, segment 1 is the active one at 0:03; a press on "0:10–0:13" puts both videos at 12.5 s with segment 3 active; on the new item a press on "0:45–0:50" -> 48.3 s, segment 10 active; a press on the marker's time seeks too. The model block is under the text (`c030`, `c031`, `c048`) |
| JW-13 | MINOR | CONFIRMED for the notes block; **NOT CONFIRMED for one part** | `EV-20261012-0073`: "Markers and notes of the session - 12:56:34 UTC+07:00 · Marker 1: C3 marker - Note from the session form: C3 form note: counsel present, interview in Indonesian. - 12:56:38 UTC+07:00 · Note: C3 in-session note" (the form's note labelled, no clock time; no snapshot, as stated); `EV-20261011-0060` shows judge B1's marker and note; items with none: "No markers or notes were recorded in this session." **Not confirmed: the custody table still prints three actions as their code** - "VERIFY_FAILED" (20 rows on `EV-20261009-0005`), "VERIFIED", "SEALED" (the cell's title equals its text), beside worded ones ("Recording started", "Recording ended", title `RECORDING_STOPPED`). L1's incomplete item is worded ("Session marked incomplete - Storage full; recovered") |
| JW-14 | MINOR | CONFIRMED | Investigator, L2 (disabled, each with its sentence): Export on the item "Requires the Supervisor role"; row menu Export and Archive "Requires the Supervisor role"; Dashboard "Export Evidence" disabled; Devices "Search for cameras", "Search again", four selector Saves, "Make primary": "Requires the SUPERVISOR or TECHNICIAN role"; System "Restart services - Requires the Technician role", "Export logs - Requires the Supervisor role". Technician, L2: "Start New Session" and "More start options - Requires the Investigator or Supervisor role"; "Play: Requires the Investigator or Supervisor role"; "Export: Requires the Supervisor role"; "Open playback - You are not permitted to play this recording. Requires the Investigator or Supervisor role"; "Export logs - Requires the Supervisor role". Refused pages: `/admin/users` as investigator -> Dashboard with "Users & Roles: not available to your role - Requires the Supervisor role"; `/session/new` as technician -> "Start New Session: not available to your role - Requires the Investigator or Supervisor role"; `/admin/devices` -> "Paired Devices: not available to your role - Requires the Supervisor role" (`c026`, `c027`, `c032`). The wizard says "Role check / Check my role / Your role may export"; no `EVIDENCE_EXPORT` |
| JW-15 | MINOR | CONFIRMED | After "Sign out" ("You have been signed out."): Back -> `/api-reference` with no operator shown as signed in; Back again -> `/login?redirect=...` |
| JW-16 | MINOR | CONFIRMED (one part not re-driven) | "Revise segment 4": a press outside leaves it open with the typed text, Escape closes it. "End Session?": a press outside leaves it open and keeps "abc". "Discard this session?" (L1): Escape closes it and stays on the form ("Keep editing"). The marker dialog has "Cancel / Add marker". NOT RE-DRIVEN: the camera Connect dialog (it needs a camera search on lane 2, which the tablet judge held) |
| JW-17 | MINOR | CONFIRMED (two parts not re-driven) | Hint follows the switch: on "Recording starts after the 3-2-1 countdown and is sealed when you end the session.", off "Recording starts at once and is sealed when you end the session."; armed Monitor: "The pre-recording checks are done. Start the recording from the session setup."; two presses on "Fill in the next case number" = ONE `POST session/case-number`; required marks on Case Number, Subject Type, Subject Name; "Fill in the required fields to continue." beside the disabled Next; L2 gate policy "Blocks recording: Core offline, storage full, security fault, no camera reachable - Needs acknowledgement: A camera or a microphone that does not answer ...". NOT RE-DRIVEN: the reload question, the name limit |
| JW-18 | MINOR | **NOT CONFIRMED** | The box check finds 0 cut / 0 clipped / 0 overlap on every page of both lanes at all three widths (section 5), and the first report's ellipses are gone. But opened as pictures: (1) the heading "AUDIO MONITOR" is broken INSIDE the word - CW-01; (2) the Dashboard's camera tiles clip their own lines at 1440 and 1280 - CW-02. Text is no longer cut by an ellipsis; it is still not readable in these two places |
| JW-19 | MINOR | CONFIRMED | "Lock console" on `/evidence?q=EV-20261009-0005` -> `/login?redirect=%2Fevidence%3Fq%3D...` with "Console locked — sign in to continue"; both fields empty; sign-in -> `/evidence?q=EV-20261009-0005` (`c024`). "Sign out" gives the other notice |
| JW-20 | MINOR | CONFIRMED | `/stack-check` as investigator: "Developer diagnostic of this console build. It is not an operator page and shows no evidence."; no link with that address on the Dashboard or in the navigation |
| JW-21 | MINOR | CONFIRMED | Alerts page "95 alerts · 0 not acknowledged" (after my run), each row with state in words; bell: section 4 |
| JW-22 | MINOR | CONFIRMED | `/session/history` L2: "72 sessions · 5 not sealed - 4 recordings are kept in quarantine - A recording in quarantine was not sealed and is not evidence. The administrator of this installation recovers the files from the quarantine folder of the Core."; each of `SES-20261011-0041`, `-0045`, `-0052`, `-0065`: "Not sealed · recording kept in quarantine - The session recorded, but it could not be sealed. It has no evidence item. ... What to do: tell the administrator of this installation, who recovers the files from the Core; record the interview again if it is needed as evidence. - Why it could not be sealed (the code the Core recorded): SESSION_KEY_NOT_OF_SESSION" (`c016`, `c017`). Evidence search `SES-20261011-0041`: "1 session matches this search and has no evidence item (not sealed). Show in Sessions" (`c018`) |
| JW-23 | MINOR | CONFIRMED | as JW-08 (three of four; the selector part not re-driven) |
| JW-24 | MINOR | CONFIRMED | One audit export (`EXP-000057`): steps "Authorize operator / Verify audit chain / Build export package / Add the chain head / Write custody event"; result "The file holds the audit rows and the head of the hash chain. It is not signed and not sealed ..." (`c089`) |
| JW-25 | MINOR | CONFIRMED | One row selected as supervisor: "1 item selected", "Export 1 item", "Clear selection" (`c088`) |
| JW-26 | MINOR | CONFIRMED | section 4 |
| JW-27 | MINOR | CONFIRMED | L1 rows "Recorded · Not sealed" for the three never-sealed records; L2 `EV-20261012-0068`: "Sealed — recording was interrupted", "Cause: Capture fault" |
| JW-28 | MINOR | CONFIRMED | L2 Dashboard: "Sealed today 12"; the card is "LAST SESSION" when its session is sealed and "ACTIVE SESSION" during a setup or a seal |
| JW-29 | MINOR | CONFIRMED | `README.md:51` now says the button exists in Simulated data mode only and that the Live Login has none; the Live Login of both lanes has none |
| GM-01 | - | CONFIRMED | as JW-11 |
| GM-02 | - | CONFIRMED | L2 tile "LAST VERIFY RUN PER ITEM - 42 PASS • 1 FAIL - EV-20261009-0005: VIDEO-02 fragment 3 failed verification - Counted by the Core over every sealed item - 27 of the 70 sealed items of this Core have no verification of record." 42 + 1 + 27 = 70 = the Evidence page's 52 sealed + 17 exported + 1 under review at that moment |

Counts: **28 CONFIRMED, 3 NOT CONFIRMED (JW-10; JW-13 in its custody part; JW-18), 0 NOT RE-DRIVEN as
a whole.** Parts not re-driven inside a confirmed row: JW-02 (`core-record.json`), JW-08 / JW-23 (a
camera on a dead port), JW-16 (Connect dialog), JW-17 (reload question, name limit).

## 4. Round three, first time in a browser

| Item | Verdict | What I saw |
|---|---|---|
| Versions, L2 | CONFIRMED | System › About: "SOFTWARE COMPONENTS - Each version is stated by its own component ... They are not demo values. - Core server 0.2.0 - Capture worker capture-worker/0.5.0 - API contract 0.3.0 - Web console 0.1.0"; "DEMS Core software 0.2.0"; "DEMS device app - Each paired device states its own app version: see Paired Devices". The only texts holding 2.4.1 / 2.5.0 on the page: "17 of 17 running · v2.5.0 · slot B" and "dems-core-2.5.0+..." - both inside a block with the "Synthetic demo values" chip. Sidebar footer "Core server 0.2.0 / Web console 0.1.0". Login footer (signed out, both lanes) "Web console 0.1.0", strip "dems-core-server 0.2.0". Header, device block on hover: "Core server 0.2.0 • Capture worker capture-worker/0.5.0 • API contract 0.3.0 • Web console 0.1.0" (`c093`) |
| Versions, L1 | CONFIRMED (as pinned) | "17 of 17 running · v2.4.1 · slot A", "SOFTWARE RELEASE v2.4.1", "DEMS Core software 2.4.1", update card "INSTALLED v2.4.1 / AVAILABLE v2.5.0"; no component block; sidebar "v2.4.1" |
| Bell: count, list, tags | CONFIRMED | "Notifications, 89 new alerts" (the API: 89 unacknowledged of 95, 0 active); popover "LATEST ALERTS - Acknowledge all (89)", 20 rows, each "Resolved, not acknowledged" with its own "Acknowledge", links "All alerts" / "View all events"; 360 x 546 px, an inner scroll of 2657 px, box check clean (`c019` opened) |
| "Acknowledge all" | CONFIRMED; one part NOT RE-DRIVEN | Confirmation: "Acknowledge 89 alerts? - 89 alerts are marked as acknowledged for every console of this Core, one after the other. The faults behind them are not cleared by this. - Cancel / Acknowledge 89 alerts" (`c020`). Run ONCE as supervisor: **89 requests `POST alerts/{id}/acknowledge`, 89 answered 204, none refused by a request limit**; the badge went 89 -> 54 -> 24 -> 0 within 0.6 s, so "Acknowledging n of N" was too fast to read; no toast was on the page 1.5 s after; afterwards bell "No new alerts", Alerts page "95 alerts · 0 not acknowledged". **NOT RE-DRIVEN: the sentence that names the UNSEALABLE notices left out, and their one-by-one acknowledgement** - lane 2 holds four such notices (`ALR-000049`, `-0062`, `-0075`, `-0097`) and all four were ALREADY acknowledged before I came, so none was open, the confirmation had nothing to name, and "all" could not touch them. The unsealable rig was not on my list. I acknowledged none of them |
| Single acknowledge | CONFIRMED | My five alerts (unreachable camera, three microphone rate notes, the blocked seal) acknowledged one by one in the bell: five `204`, bell "No new alerts" |
| Session history, Evidence search | CONFIRMED | JW-22 |
| Notes block | CONFIRMED | JW-13 |
| Lock console | CONFIRMED | JW-19 |
| Live log export, L2 | CONFIRMED | `dems-logs-DEMS-IR-01-EXP-000053.json`: no `demo` member (0 members named `demo` or `simulated` in the whole file), notice "Log export of this DEMS Core server: the audit chain and the events this Core recorded, read from every page of both lists; services and diagnostics as this Core reported them to the console.", `softwareVersion` 0.2.0, `components` core / captureWorker / apiContract / webConsole. Control on L1 (`EXP-000033`): `demo: true`, "DEMO - log export of the DEMS Core server (synthetic demo data). ..." |
| Audit table at 1280 | CONFIRMED | "More columns to the right: scroll the table sideways"; scrolled 60 px: "More columns on both sides ..."; at the end: "More columns to the left ..."; no cue at 1440 and 1920 (`c025`) |
| RBAC reasons, refused page | CONFIRMED | JW-14 |
| Password field | CONFIRMED | no `value` attribute while typed |
| Blocked-seal sentence (the Core was restarted) | CONFIRMED | dialog, banner and bell carry the new sentence: "... then retry the seal: an investigator or a supervisor presses "Retry sealing" on the Session Monitor of the web console or on the session's screen of the tablet or phone, or the Core is restarted." The cause "The Core's key store cannot be used: the seal stopped and can be tried again." stands ONCE in the dialog (`c055` opened); remark CW-07 |

## 5. The full session on lane 2 from the web, and the layout check

| Step | Result |
|---|---|
| Form | case number filled in (`LP/2026/1012-9907`), Saksi, name, a note of 54 characters; readiness "6 of 6 ready ... Security - Not reported" |
| Pre-check | with the source rig: WARN on Video Lens 2, the whole sentence; after release: "All checks passed", 8 of 8 |
| Ready, countdown | "Recording starts in 3 / 2 / 1 - Cancel countdown", then "Connecting cameras…", Monitor 3.2 s after the press |
| Monitor | "SESSION ACTIVE - Recording. The first fragment is durable on the evidence volume"; meters -13 / -21 dBFS; "Media Protection - Not encrypted during recording. The media is encrypted when the session is sealed"; marker and note added (timeline rows); "Pause Monitoring" -> "Monitoring paused. Recording continues." (N-11 seen); "Re-verify": no visible answer found |
| Stop | hold on End Session; "Enter a reason of at least 5 characters." for "abc"; ended with a reason |
| Seal dialog (round one could not re-prove it) | six steps with durations: Close tracks 0.5 s, Finalize hashes 0.2 s, Finalize transcript 19.2 s, Build manifest 0.1 s, Sign manifest 0.0 s, Store sealed evidence package 0.0 s; "SEALED - Evidence EV-20261012-0073 sealed - Sealed 20.0 s after the recording ended - Signed with a DEVELOPMENT key — not a production signature - Recorded from development sources - not from production devices." (`c042`) |
| Verify | "PASS ... 15 of 15 checks passed", V-01..V-15 each PASS, 776 ms (`c047`) |
| Player | both files 1280x720, in step (3.6 / 3.7 s); seek by a segment to 48.3 / 48.4 s. Tampered `EV-20261009-0005`: Camera 2 "Stopped: this file failed its integrity check at fragment 3.", "The Core server refused the fragment: it does not match the sealed package, and none of its bytes was sent. Camera 2 is stopped. Camera 1 plays on."; scrubber to 80 % + Play at once: the stop sentence is there from the first sample (0.1 s), Camera 2 never plays (`c050`, `c051`) |
| Package export | `EXP-000056`, "Complete - Package", "Download export" -> `DEMS-export-EXP-000056.zip`, 65,070,192 bytes; `npm run evidence:verify-export -- <archive>` once: X-01..X-07 PASS, `RESULT: PASS` |
| Seal rig session | retries 1 to 3 said on dialog, banner, pill, ring and the Dashboard card; blocked at 13:04:08; after `release`, "Retry sealing" on the banner: ONE `POST session/SES-20261012-0104/recover` (202), "Sealing is run again.", "SESSION SEALED" 0.75 s later, `EV-20261012-0074`, Verify 15 of 15. (My first press sent nothing: it was aimed at the banner's button while the blocked dialog had just opened over it, so it landed on the dialog's backdrop and closed the dialog. That is the likely cause of N-08 of the first report: a driver artefact, not a dead button) |

Box check (0 cut, 0 clipped, 0 overlap, no page-wide sideways scroll unless stated):

| Lane | Pages at 1280 / 1440 / 1920 | Result |
|---|---|---|
| 2 | Dashboard, Monitor (recording, sealed), Session New step 2 (with the warning), Evidence item, Devices, Storage, Network & Time, System, Session history, Alerts, Users & Roles, Paired Devices, the bell popover with 89 alerts (1440) and with the blocked alert | clean |
| 2 | Evidence list | **inner sideways scroll at 1280 and 1920 (JW-10)** |
| 2 | Security & Audit | 1280: the hash-chain strip and the audit table scroll sideways, the table with its cue; 1440, 1920 clean |
| 1 | Dashboard, Monitor, Evidence list, the incomplete item, Devices, Storage, Network & Time, System, Session history, Alerts, Users & Roles, Paired Devices | clean; Security & Audit as on lane 2 |

What the box check cannot see is in CW-01 and CW-02.

## 6. New findings

| Id | Sev. | Finding | Steps | Evidence |
|---|---|---|---|---|
| CW-01 | MINOR | **The heading "AUDIO MONITOR" on the Session Monitor breaks inside the word.** L1 at 1440x900: one or two letters per line ("A / U / DI / O / M / O / NI / T / O / R"), the heading box is 20 px wide and 200 px high (10 lines), pushed by the DEMO chip and the "Switch to MIC 2" button. L2 at 1280x800: "AUDI / O / MON / ITOR". Same cause (`overflow-wrap: break-word` where the ellipsis was): "SHA- / 256" and "GNSS (UTC+0 / 7:00)" in the integrity card. The first report's "AUDIO M..." became this | L1: start a session, Session Monitor at 1440x900. L2: the same at 1280x800 | `c074` (opened), `c040` (opened); geometry read |
| CW-02 | MINOR | **The Dashboard's camera tiles clip their own text at 1440x900 and 1280x800 (lane 2).** In each tile the picture box is 44 px high at 1440 (29 px at 1280) for three lines that need 64 px (80 px): "No preview" is cut at the top and the tile's "Not checked" at the bottom; at 1280 "No preview" is also covered by the "Development source" badge. Clean at 1920 | L2 Dashboard at 1440x900 | `c002`, `c021` (opened: "No preview" half hidden above the caption, a cut line under it); geometry read |
| CW-03 | NOTE | **Console warning of the app: "[core-web] missing i18n key"**, once, on lane 2 in the page load that held my first session (sign-in 12:54 -> form -> pre-check with the unreachable-camera warning -> Dashboard with the alert -> bell -> Ready -> countdown -> Monitor recording; first read on the Monitor at 12:56:23). One operator text was therefore drawn from a key that does not exist. WHICH key I could not read (my driver prints the warning's object collapsed). Narrowed afterwards with the console's own list (`getMissingI18nKeys()` of `src/i18n.ts`, asked in the running page): it is EMPTY after a walk at rest over the Monitor (sealed), Dashboard, pill popover, bell, New Session step 1, Evidence, Devices, Storage, Network & Time, Security & Audit, System, Users & Roles, Paired Devices; lane 1 never warned, and the second lane 2 session (no rig at the pre-check, no countdown, no marker or note) had a clean console from the blocked state on. So the key belongs to one of: the pre-check warning row, the alert-active Dashboard or bell row, the countdown, or the recording Monitor | L2: the steps above with the browser console open, then `getMissingI18nKeys()` | driver console lines at 12:56 - 12:57; the empty list at 13:27 |
| CW-04 | MINOR | **The seal dialog of the simulated lane carries no DEMO / SIMULATED mark and a chip "LIVE".** "Evidence sealed - ... SEALED - Evidence EV-20261012-0019 sealed - Sealed 6.3 s after the recording ended - Manifest SHA-256 [LIVE] ... - No DEMO package exists for this item." Every panel behind it is marked; the one window that announces "sealed" is not, and "LIVE" there reads as "real" | L1: end a session from the web | `c075` (opened) |
| CW-05 | NOTE | The bell popover's two foot links stand together as "All alertsView all events" (no space between them), and "Resolved, not acknowledged" wraps over three lines beside the Acknowledge button | L2 bell with many alerts | `c019` (opened) |
| CW-06 | NOTE | Uncaught console exception "AbortError: Transition was skipped. New ViewTransition started" when "Discard session" leaves for the Dashboard (L1). Nothing visible breaks | L1: New Session to step 3, Cancel, Discard session | driver console line at 13:22 |
| CW-07 | NOTE | The blocked-seal dialog says its cause once, but repeats the rest: "Sealing is blocked" three times (title, heading, first sentence), "no new session until this one is sealed" twice, the retry instruction three times ("presses Retry sealing ...", "An investigator or a supervisor can retry.", "retry the seal here"); during the retries "Sealing is being retried" stands three times. The pill's popover still lists "Recording pipeline - OK" and "Cameras and microphones - OK" during retries, in the blocked state and beside tiles that say "Not checked" (N-10 of the first report, unchanged) | L2 seal rig | `c055` (opened), popover text |
| CW-08 | NOTE | Small things: (a) the export of the demonstration item `EV-20261009-0004` is accepted as `EXP-000051` and offers the download "EXP-000031.zip - DEMO prebuilt export package EXP-000031" - another export's number; its review step says "Case file transfer (simulated)" on lane 2. (b) System › Quick actions on lane 2 still offers "Software Update - Signed A/B system update" above a card that says no updater exists. (c) L2 log export: `services` holds the 17 synthetic services under a notice that says "as this Core reported them" (the driver's own decision 3 of note 174). (d) "Re-verify" on the Monitor gave no answer I could find. (e) The camera Health chart's time axis read 13:50 - 15:19 at 13:15 (under the synthetic chip). (f) New Session shows "Recording Profile - Standard (1080p / 25 fps)" for a session whose configured and sealed profile is `H264_720P30` (the known `profileId` label, now beside the true value on the Monitor) | - | page texts |

No BLOCKER and no MAJOR came with the fixes. Console errors of the app itself in all flows: none
(seen: the expected 401 on `auth/session` before a sign-in, WebSocket lines on Back / Forward, the
expected 409 on the transcript of a demonstration item, CW-03, CW-06).

## 7. Not judged, and my own slips

- Not re-driven (named in the rows): the `core-record.json` manifest form, a camera on a dead port,
  the Connect dialog, the reload question and the name limit of the form, the sentence naming
  unsealable notices in "Acknowledge all" (none was open), the Devices front-panel drawer's
  firmware row and LCD line, the name of the missing i18n key (CW-03: it would have needed a third
  session on lane 2, which my list did not have).
- Not pressed: "Install and restart", "Restart services", "Revoke", "Archive", any selector change,
  a camera search on lane 2.
- Biometrics: the web has none. Local devices: never selected (section 2).
- Slips: session one ran 1 min 05 s instead of 45-60 s. My first helper sign-in wrote the shared jar
  path `.cache/gate-env/session_lane2_SUPERVISOR.jar`; I copied it to my own folder at once and used
  only the copy (the shared file was written anew by another judge later and is not mine: left). The first "Core offline" run cut the whole tab (the console's own files too), so a
  page change went blank; the second run blocked only the API path and is the one quoted for pages.

## 8. Screenshots opened as pictures (under `.cache/judging/confirm-web/`)

| File | One line |
|---|---|
| `c002_l2_dashboard_1440` | L2 Dashboard: ring READY "OPERATIONAL • NO FAULT REPORTED", pill "NO FAULT REPORTED", strip "Not reported", camera tiles with clipped lines (CW-02) |
| `c019_l2_bell_popover_1440` | Bell popover: "Acknowledge all (89)", rows tagged "Resolved, not acknowledged", the long blocked-seal sentence wrapped whole, foot links run together |
| `c021_l2_ack_all_after` | Dashboard after the run: bell without a badge, no toast |
| `c028_l2_inv_item_0060_media` / `c029_l2_inv_header_plain` | The same item page: whole-page capture with the clock over the bell (capture artefact) and the plain capture, clean; "Export: Requires the Supervisor role" |
| `c040_l2_monitor_recording_1280` | L2 Monitor recording at 1280: "AUDI O MON ITOR", "SHA- 256", toast "Note added" over the action bar |
| `c055_l2_monitor_blocked` | "Sealing is blocked" dialog: cause once, the new sentence naming web console and tablet or phone, "Retry sealing" |
| `c074_l1_monitor_recording` | L1 Monitor recording: "LIVE · DEMO CORE", "DEMO · SIMULATED" banner, DEMO on every panel and on the picture; the heading "AUDIO MONITOR" as a column of letters (CW-01) |
| `c075_l1_seal_dialog` | L1 seal dialog: six steps, SEALED, chip "LIVE", no DEMO mark (CW-04) |
| `c081_l2_evidence_list_1920` | Evidence at 1920: columns end at "Duration · Size"; no Status, no row menu (JW-10) |

## 9. State left (read back at the end)

See the final lines of `delegation_progress/judging_slots.md` (my lines for lane 2: 12:54 - 13:06
with both rigs; lane 1: 13:09 - 13:11 and 13:21 - 13:22; all end in "free").

- **Lane 2:** no session open by me (`SES-20261012-0103` and `-0104` SEALED); both rigs OFF (`status`
  read back after each use); selector untouched (FAKE defaults); my five alerts acknowledged; the 89
  older alerts acknowledged by the one "Acknowledge all" run the brief asked for; the four
  unsealable notices as found (already acknowledged). Added by me: `EV-20261012-0073` (EXPORTED by
  `EXP-000056`), `EV-20261012-0074`; exports `EXP-000051` and `EXP-000052` of two demonstration items
  (`EV-20261008-0002` went SEALED -> EXPORTED), log export `EXP-000053`, audit export `EXP-000057`;
  two case numbers. Not reset, not restarted. The tablet judge C1 took the lane at 13:06.
- **Lane 1:** no session open by me (`SES-20261012-0029` SEALED as `EV-20261012-0019`,
  `SES-20261012-0030` cancelled); no demo fault raised; the demo update NOT installed (confirmation
  cancelled); one FAIL verification of record on `EV-20261011-0005`; log export `EXP-000033`.
- Both headless browsers stopped (PIDs gone), both consoles signed out by "Sign out" (a later
  `/dashboard` answered `/login?redirect=`), both browser profiles, the private sign-in file and my
  copy of the helper jar removed; my one helper API session (lane 2) had expired by itself (401 at
  13:27). Rigs read back at 13:28: seal rig OFF, source rig OFF.
- No product source, test or other document changed; `masterplan/02_plan.md` not written.

---
*Generated: 2026-10-12 13:29 WIB*
