---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: UI judging session - judge B1, the WEB CONSOLE on lane 2 (real capture on generated test sources) and lane 1 (simulated, demo controls)
date: 2026-10-12
agent: verifier (as a judge; no code changed, nothing fixed)
narrative_tier: 2
status: complete - 1 BLOCKER, 8 MAJOR, 20 MINOR, 21 NOTE; overall "yes with reservations"
tree: 035150b
surface: headless Chrome (audio muted), two profiles; lane 2 http://127.0.0.1:5177/ and lane 1 http://127.0.0.1:5176/; 1440x900, with 1280x800 and 1920x1080 on Dashboard, Session Monitor, Evidence list and the pre-check
window: 23:49 (11 Oct) - 00:40 (12 Oct) WIB
---

# Judging B1 - the web console on both lanes

Evidence folder: `.cache/judging/web/` (screenshots `NNN_*.png`; `exports/` holds the two downloads;
`dl2/` the manifest and audit downloads; `tools/` my driver scripts; `work/` step files and the
browser logs). Everything was done through the pages of the console in a real headless browser. The
lane API (helper supervisor session) was used only to read the Core's side of a fact (session state,
selector, alerts) and to switch the two rigs. No credential, pairing code, fixture account, token or
signed path is in this file, in a file name or in a kept screenshot (two slips of mine are in
section 7). Long hex runs are shortened.

## 1. Overall judgement

**Would I accept the web console for a demonstration to a law-enforcement customer today: YES, WITH
RESERVATIONS - and on the real-capture lane it is the strongest of the three surfaces.** The core
story is complete and fast on lane 2: the form with a real device check, a 3-2-1 countdown, a
Session Monitor that says what is durable, a microphone switch, marker / note / snapshot, a reasoned
stop, a six-step seal in 9 s, an item with a Core-run Verify (15 of 15, under 1 s), a two-camera
sealed player with an audio-source band and a clear integrity stop on the tampered file, a signed
transcript revision, a Package export that the product's own verifier accepts (`RESULT: PASS`), a
camera search with a careful Connect dialog, pairing with a code shown once, and an audit trail with
a chain check and an export. Where the tablet was untrue, the web is mostly right: during seal
retries the pill, the ring and the Monitor all say so from the first failure; a blocked seal has a
working "Retry sealing"; the Dashboard answers "Not reported" instead of inventing a LAN address,
and nearly every synthetic card carries a "Synthetic demo values" chip. My reservations are about
the same thing the device judges found - **statements that are not true at the edges**: on the
simulated lane an unsealed, interrupted recording still verifies PASS (JW-01) and a "Composite"
export is delivered as "Package" (JW-03); on the real lane "Download manifest" hands out a file that
calls a really sealed item `simulated` (JW-02); the header pill says "SECURE - All systems
operational" while its own popover, the Dashboard and the Security page say "Not reported" and while
a camera is unreachable (JW-04, JW-05); the tampered item still reads "Sealed" (JW-09); "Install
update" runs at one click (JW-06); the simulated lane shows a photograph as a live feed without any
DEMO word (JW-07); and both microphones read "NO SIGNAL" beside "PASS" on the screen that gates
recording (JW-08). Add layout that does not fit 1440x900 (the Evidence table hides its Status and
its row menu), and I would run the demonstration myself on the happy path at 1920 wide, and would
not leave a customer alone with it.

## 2. Method and limits

- Roles: INVESTIGATOR (lane 2, 23:52 - 00:03), SUPERVISOR (lane 2, 00:03 - 00:17; lane 1, 00:11 -
  00:26 and 00:28), TECHNICIAN (lane 2, 00:17 - 00:21; lane 1, 00:26 - 00:28). Every sign-in was
  typed into the Login form from a private 0600 file read at use; nothing was printed.
- Driver: my own CDP script (`tools/jw.mjs`, derived from the gates' `cdp.mjs`): real mouse and key
  events, page text, control lists, geometry reads, network status of non-GET calls, console errors
  with every line that held a media or signed path dropped. Downloads were directed to
  `.cache/judging/web/dl1|dl2`.
- Sessions on the FAKE sources of lane 2: `SES-20261011-0090` (2 min 02 s - longer than the 60 s
  of the brief: my End Session dialog was closed by the driver and I needed a second run; disclosed)
  and `SES-20261012-0091` (48 s, the seal-rig run). On lane 1: one simulated recording (1 min 03 s,
  ended by the demo fault "Storage full", recovered to INCOMPLETE) and one setup that I discarded.
- 171 screenshots; the ones I OPENED as pictures are described in section 9. The others were read
  through the page text taken in the same step (they are evidence on disk, not claims).

## 3. Screen by screen

L2 = lane 2 (real capture on generated sources), L1 = lane 1 (simulated).

| Screen | What it is for | What I did | What happened | Verdict |
|---|---|---|---|---|
| Login (L2, L1) | Operator sign-in, Core status strip, data mode | Deep link while signed out; Tab order; empty submit; ONE wrong sign-in; reveal control; sign-in as each role; sign-out; Lock console; Back after sign-out | Deep link kept as `?redirect=` and honoured after sign-in; "Enter your username." / "Enter your password."; "Invalid username or password. 4 attempts remaining" (password cleared, name kept); Tab: username, password, reveal, Sign In, Demo operators, data mode, trust line; "You have been signed out." / "Console locked. Sign in again to continue." | OK; JW-15, JW-19, N-01, N-02 |
| Shell: header, nav | Clock, device chip, LIVE chip, bell, operator menu, status pill, sidebar | Every header control; popovers; Escape; Tab through the nav; sidebar collapse control seen; Back / Forward; reload on each page | "Skip to main content" first; focus visible on every stop; pill opens "INTEGRITY CHECKS"; bell "LATEST ALERTS"; menu Profile (not a link) / Lock console / Sign out; filters, tab and page are kept in the URL and survive a reload | OK; JW-04, JW-05, JW-21 |
| 404 | Unknown address | `/no/such/page` | A bare card "Page not found - The page you asked for does not exist. - Dashboard", outside the shell | OK; N-03 |
| Dashboard (L2) | State at a glance | Every card, strip chip, tile menu, quick action, link; at rest, with a setup open, during seal retries, blocked; 3 widths | Ring READY / ATTENTION "SEALING IS BEING RETRIED" / CRITICAL "NO NEW SESSION UNTIL IT IS SEALED"; strip "Security: Not reported", "Network: Not reported"; active-session card follows the session ("Session setup in progress - Armed - Pre-check 8 of 8 - Continue setup") | OK (strong); JW-04, JW-08, JW-18, JW-28 |
| Dashboard (L1) | The same, simulated | Read | "SECURE - HEALTHY - OPERATIONAL", "TPM 2.0 Verified", "Secure Boot Enabled", `192.168.10.21`, "GNSS Synchronized" with no DEMO / SIMULATED word; header chip "LIVE" | FINDING JW-07 |
| New Session 1 - form (L2, L1) | Create the session | Bad case number, 130-character name, notes, fill-in button, investigator suggestions, Cancel / Keep editing, reload, Back from step 2 | "Use the case format LP/YYYY/MMDD-NNNN."; name cut at 120 without a word; Back from step 2 returns to an editable form (better than the tablet) | OK; JW-17 |
| New Session 2 - Devices Check (L2, L1) | The eight checks | Normal run; `source-rig 2 unreachable CAM-02`; "Re-run checks" after release; 3 widths | 8 of 8 in about 3 s; WARN "1 warning needs acknowledgement" with "Acknowledge warnings", "Search again", "Re-run checks"; after release "All checks passed" and the alert leaves the bell | OK; JW-08, JW-11 |
| New Session 3 - Ready, countdown | Review and arm | Leave to Dashboard and Monitor and return; second tab; countdown on; "Cancel countdown" (L1); Start | Second tab lands on step 3 of the same session and follows into the recording; countdown overlay "3 - Cancel countdown" | OK; JW-17 |
| Session Monitor (L2) | Supervise and control | At rest, in setup, recording, sealing, retried, blocked, sealed; camera tabs; fullscreen; Pause Monitoring; Re-verify; mic switch (dialog, Cancel by Escape, confirm); marker; note; snapshot; End Session (hold, reason validation) | "Recording. The first fragment is durable on the evidence volume"; meters -14 / -21 dBFS; audio source "MIC 1 from 0:00 to 0:16, MIC 2 from 0:16"; timeline rows for each action; "Enter a reason of at least 5 characters." | OK (strong); JW-08, JW-13, JW-18, N-08 to N-12 |
| Session Monitor (L1) | The same, simulated | One recording, marker, faults raised from the Demo panel, recovery | "SESSION ACTIVE & SECURE - All integrity checks passing"; a still photograph as the feed with "REC" and "1080p - 25 fps - H.264"; "FAULT - Storage full - Start recovery"; recovery "Session marked INCOMPLETE. It will never be sealed (SYS-008)." | FINDING JW-07; N-06 |
| Seal dialog | Seal progress and result | Normal (9.1 s); with `seal-rig 2 blocked` | Six steps with durations; "SEALED - Evidence EV-20261011-0060 sealed - Sealed 9.1 s after the recording ended - Signed with a DEVELOPMENT key - not a production signature"; retried: "retry 1 of 3, in 5 s ... You can close this window. The session stays open on the Core." | OK (strong) |
| Evidence list (L2, L1) | Find items | Counters, status chips, two selects, dates, search by id / case / session id, sort, pagination, row checkboxes, row menu, preview pane; 3 widths | Filters and page live in the URL; preview pane shows "Last verification FAIL / Not verified"; at 1440 and 1280 the Status column and the row menu are outside the visible table | FINDING JW-10, JW-09, JW-25 |
| Evidence item - header, Media (L2) | Facts, player, transcript, revisions | New item, tampered `EV-20261009-0005`, revised `EV-20261010-0020`, interrupted `EV-20261010-0017`; Play; keyboard seek; click on a segment; Revise | Both files play in step (1280x720), audio band with the playhead source; tampered: "Stopped: this file failed its integrity check at fragment 3." on Camera 2, also after a seek to 80 % + Play; interrupted: "End of the sealed recording at 0:29: the recording was interrupted, so it ends here."; revision 1 signed and listed with author, base and reason | OK (strong); JW-09, JW-12, JW-13, JW-16 |
| Evidence item - Metadata | The Core's record | Read | Raw JSON "The Core server's record of this item." | OK; N-13 |
| Evidence item - Hash & Integrity | Verify, sealed values, lifecycle, custody | Verify on a clean item, on both tampered items, on the incomplete simulated item | L2 clean: PASS, 15 of 15, "Stored bytes PASS - decrypted bytes PASS - fragment chain PASS", 759 ms; L2 tampered: FAIL, "VIDEO-02 fragment 3 tampered (stored-bytes hash mismatch; chain broken from fragment 3)", 11 of 15; L1 tampered: FAIL on AUDIO-02 with a DEMO note; L1 incomplete: PASS 6 of 6 | OK on L2; FINDING JW-01 on L1 |
| Export wizard (L2, L1) | Export a sealed item | As investigator (to the refusal); as supervisor: Composite and Package on L2, Composite on L1, the tampered item on L1; download; `evidence:verify-export` | Investigator stopped at step 2 "Export requires EVIDENCE_EXPORT (Supervisor)"; L2 Package: `EXP-000045` complete, 124 MB archive, verifier X-01..X-07 PASS; L2 Composite: job FAILED "Composite video is not available in this build."; L1 Composite: "Complete - Package"; L1 tampered: "Export blocked - Tampered evidence cannot be exported." | OK for Package; FINDING JW-03 |
| "Download manifest" | A copy of the manifest | Pressed on the new L2 item | Toast "Manifest downloaded (DEMO)"; file `EV-20261011-0060-manifest.simulated.json` with `"simulated": true` | FINDING JW-02 |
| Devices & Inputs (L2) | Roster, tiles, drawers, selector, camera search, microphone re-scan | All three roles; VIDEO-02 CAM-02 -> CAM-04 -> CAM-06 -> CAM-02; primary MIC-01 -> MIC-02 -> MIC-01; search; Connect dialog without and with the stub's account; abandon; re-scan; drawers of CAM-04 and CAM-01 | "Capture configuration saved" each time, read back through the API at the end (defaults); search "1 found - 1 new - 0 already registered"; test without a password: "This camera asks for a user name and a password. None was sent."; with it: "Connection works. This camera can be added. 1 usable video profile" | OK (strong); JW-23, N-14, N-15 |
| Devices & Inputs (L1) | The same, simulated | Camera search; camera picker | "Camera search is not available on this Core yet." (503 NOT_READY); choosing the other track's camera is refused by the Core (422) | OK; N-16 |
| Storage (L2) | Capacity, policy | Read; Manage Storage opened and cancelled | Real figures plus chipped synthetic cards; "No change to apply" until something changes; Escape closes | OK; JW-03 (activity rows), JW-28 |
| Network & Time (L2) | Time source, network | Read | Time honest ("no lock, stratum, offset or last synchronisation exists"); network cards chipped "Synthetic demo values" | OK; JW-23 |
| Security & Audit (L2, L1) | Posture, controls, keys, chain, audit log, role matrix | Verify chain; Earlier chains; type filter; Export audit with reason validation; download | L2 "Posture: not reported - 2 of 9 controls active, 7 not reported"; "PASS Verified 1000 entries at 00:11:31 - Stored chain: verified, 1384 rows"; export `EXP-000046` with 1384 rows | OK (honest); JW-24, N-17 |
| System & Maintenance (L2, L1) | Services, health, update, diagnostics, identity, settings | Read as supervisor and technician; Run Diagnostics (L1); Install update (L1 only); STT settings (L2, technician) | Every synthetic card chipped on L2; diagnostics 8 rows; update ran at one click; STT saved and put back | FINDING JW-06; JW-14, JW-26 |
| Demo Control Panel (L1) | Scenarios and faults | Each of 11 faults on and off during a recording; each of 4 scenarios | Pill and bell follow within 2 s; scenario loads ask first and say what is discarded | OK; N-06, not judged: Power fail, Capture fault |
| Users & Roles (L2) | Operators, role matrix | Row menus, Change role dialog (cancelled) | "Disable user... At least one enabled user must keep user administration." disabled for the own row | OK |
| Paired Devices (L2) | Pairing | Issue code, reload, Cancel code; Revoke not pressed | Code shown once inline with "Expires in" and "5 attempts left"; after a reload "The code itself is shown only once."; "Pairing code cancelled" | OK; JW-10 |
| API Reference | OpenAPI of the Core | Opened | 97 operations, "Try it sends real requests to the Core server as <operator>" | OK; N-18 |
| `/stack-check` | A developer scaffold page | Opened by address as investigator | "Stack check - placeholder ... wired to the local mock-core heartbeat. Show test toast" | FINDING JW-20 |

## 4. Flows

| Flow | Steps | Result | Time felt |
|---|---|---|---|
| Deep link while signed out | `/evidence/EV-20261009-0005` -> Login -> sign-in | Lands on the item | sign-in 1.2 s |
| Wrong sign-in | One unknown user | Message with the attempts left; the lock-out was NOT reached (on purpose) | under 1 s |
| Session expiry | Console left idle on the Session Monitor for 16 minutes | Login with "Your session expired after 15 minutes without activity. Sign in again." and the page kept in `?redirect=` | - |
| New session, lane 2, investigator | Form -> check -> Ready -> Start -> mic switch -> marker -> note -> snapshot -> stop with reason -> seal dialog -> item | `SES-20261011-0090` -> `EV-20261011-0060`, SEALED, Verify PASS 15 of 15 | check 3 s; first durable fragment 4 s; seal 9.1 s (transcript 8.1 s) |
| Ways out | Cancel at step 1 (Keep editing); reload at step 1; Back at step 2; leave to Dashboard / Monitor and "Continue setup"; second tab; Cancel countdown (L1); Discard session at step 2 (L1) | All work; the reload loses the form | instant |
| Source rig | `unreachable CAM-02` -> pre-check WARN -> bell 1 alert -> release -> "Re-run checks" -> pass | As designed; the row text is cut at every width (JW-11) | check 2.8 s |
| Seal rig | `blocked` -> 48 s session -> retries 1 to 3 -> blocked after 2 min 34 s -> release -> "Retry sealing" | Pill "SEALING RETRIED" then CRITICAL "Sealing is blocked"; ring ATTENTION then CRITICAL; sealed 2 s after the (second) press: `EV-20261012-0061` | retries 5 s, 30 s, 120 s |
| Player | Play, keyboard seek, End, tamper stop, seek 80 % + Play, interrupted end | Works | playback starts in under 1 s |
| Transcript revision | Revise segment, short reason (button stays disabled), valid reason | `TRV-000001`, listed with author, base, signature key, reason | 2 s |
| Export, Package (L2) | 4 steps, download, verifier | `EXP-000045`, 123,952,638 bytes, `RESULT: PASS` | job under 35 s (not timed more closely) |
| Export, Composite | L2: accepted then FAILED; L1: "Complete - Package" | JW-03 | 3 s |
| Selector | Camera and microphone changes and back | Saved at once, defaults at the end | 1 s each |
| Camera search and Connect | Search, test without and with the account, abandon | Nothing adopted | search 2 s; test 2-4 s |
| Pairing code | Issue, reload, cancel | Shown once | 1 s |
| Audit | Chain check, filter, export | PASS; `EXP-000046` | 2 s |
| STT settings | Speaker labelling off, Save, on, Save, reload | Revision 14 then 15; as found | 2 s each |
| Demo faults (L1) | 11 faults on / off during a recording | "Storage full" stops the recording (FAULT), recovery to INCOMPLETE | pill within 2 s |
| Demo scenarios (L1) | recording, finalizing, fault-demo, idle | Each asks first; fault-demo: CRITICAL, 3 alerts | 3 s |
| Install update (L1) | One click as technician | Runs at once; 6 steps in about 8 s | JW-06 |

Nothing took longer than 2 s from click to response except the waits that are the product's own
(pre-check 3 s, seal 9 s, the export job, the rig's retry intervals).

## 5. Findings, by severity

Attribution: P = product defect, S = simulated-lane answer or asset, D = dev-lane artefact, L = known
limit, ? = could not tell. "Same as J..." marks a defect a device judge already recorded: I judged
the same fact on the web and say what the web does.

### BLOCKER

| Id | Finding | Steps | Expected, and why | Evidence | Attr. |
|---|---|---|---|---|---|
| JW-01 | **Lane 1: an interrupted, unsealed recording shows "SEALED VALUES", a manifest hash and a signature, and verifies PASS on the web too.** Same root as JA2-01. | Supervisor on lane 1: start a session, Demo panel -> "Storage full" (the recording goes to FAULT), Session Monitor -> "Start recovery" -> "Session marked INCOMPLETE. It will never be sealed (SYS-008)." -> Evidence -> the item (status "Recorded", lifecycle at "Recording 2/12") -> Hash & Integrity -> Verify. | An item the console has just declared never-to-be-sealed must not list sealed values and must not turn green. The web does mark the signature "(simulated)", but the verdict "PASS - 6 of 6 checks - Ed25519 signature PASS VALID" and the toast "Integrity verified: EV-20261012-0015 PASS" carry no such mark. | `152_l1_incomplete_hash` (text read), `153_l1_incomplete_verify` (opened: chip "Recorded", lifecycle at step 2, "PASS", toast "Integrity verified: EV-20261012-0015 PASS"); `POST evidence/EV-20261012-0015/verify` 200 `ok true` | S + P |

### MAJOR

| Id | Finding | Steps | Expected, and why | Evidence | Attr. |
|---|---|---|---|---|---|
| JW-02 | **Lane 2: "Download manifest" gives a file that calls a really sealed item simulated.** Toast "Manifest downloaded (DEMO)"; file `EV-20261011-0060-manifest.simulated.json`, 807 bytes, first key `"simulated": true`; inside it the item's real hashes and a signature object that says `"simulated": false, "developmentKey": true`. It is a summary built by the console, not the signed manifest. | Item `EV-20261011-0060` -> More -> Download manifest. | On the real-capture lane the control must deliver the sealed, signed manifest or not be offered (the tablet says "not available", JT-15). A downloaded file is what an operator hands on; "simulated" on real evidence is false, and the file contradicts itself. | Toast text; the file in `dl2/` (keys read, hex shortened) | P |
| JW-03 | **"Composite" can be chosen on both lanes; lane 1 delivers "Package" without a word; lane 2 accepts it, writes an export id and an audit event, then the job fails.** Lane 1: "Accepted - EXP-000032 ... Export job EXPJ-000032 - Complete - Package". Lane 2: "Accepted - EXP-000044 - Audit event AUD-001361 ... Export job EXPJ-000044 - FAILED - Composite - Composite video is not available in this build.", while the stepper shows "Export 4/4: Done", and Storage and Network & Time list "Evidence exported - EV-20261011-0060" for that attempt (three such rows for one successful export). The review step (4) never shows the chosen output. | Export -> output "Composite" -> Next -> Request authorisation -> Next -> Next -> Export. | The answer to the controller's question: lane 1 web = the phone's JA2-03 exactly; lane 2 web is honest in the end but only after four steps and an audit row. A choice that cannot be honoured must be disabled with its reason at step 1. The item itself stays "Sealed" with no custody row - good. | `158_l1_export_composite_result`, `078_l2_export_result` (texts read); Storage activity text at 00:15 | P (worse than the known limit on lane 1) |
| JW-04 | **"Security" is answered three ways on the lane 2 web, and the header contradicts its own popover.** (1) Header pill, on every page, by default: "SECURE - All systems operational". (2) The pill's popover: "Evidence encryption (AES-256-GCM): Not reported", "TPM 2.0 and Secure Boot: Not reported", "Enclosure tamper seal: Not reported"; Dashboard strip "Security: Not reported", card "Platform security: not reported", tile "Security Posture - NOT REPORTED - No issues detected"; Security & Audit "Posture: not reported - 2 of 9 controls active, 7 not reported". (3) New Session: "Security PASS" on the form and "Security - READY - PASS" in the pre-check. Also: "Evidence encryption: Not reported" beside a Verify that reports "decrypted bytes PASS" and a Monitor that says "Media Protection - Encrypted at seal - Passing". | Sign in; read the pill, click it; Dashboard; `/session/new`; `/security-audit`; Verify an item. | The controller's question (JT-03: four answers on the tablet): on the web THREE (SECURE / Not reported / PASS). The honest one is "Not reported"; the pill and the pre-check row should say that. The synthetic network values of JT-03 are NOT repeated by the web (see JW-23). | `004`, `005b`, `009_l2_pill_click` (text read), `025_l2_step2_pass`, `103_l2_chain_verified` | P |
| JW-05 | **The pill stays "SECURE - All systems operational" while a capture camera is unreachable and the bell holds its alert.** Same as JT-01 (b). (JT-01 (a) is NOT on the web: during the seal retries the pill reads "SEALING RETRIED - The Core is running the seal again", the ring "ATTENTION - SEALING IS BEING RETRIED", and both turn CRITICAL when it is blocked.) | `source-rig 2 unreachable CAM-02`, New Session to step 2. | "Camera 2 (CAM-02) is not reachable" and "All systems operational" cannot both be on one screen. | `090_l2_precheck_cam02_unreachable_1440` | P |
| JW-06 | **"Install update" runs at one click on the web too.** Same as JT-06. The click sends `POST system/update` (202) at once; a toast says "Installing v2.5.0 - The signed bundle is checked, installed to the inactive slot, then rebooted." | Lane 1, technician: System & Maintenance -> Install update. (Not pressed on lane 2, where the button is disabled: A1's run left "Up to date - v2.5.0".) | Every other consequential control here asks first (scenario load, mic switch, discard, end session). | `161_l1_install_clicked` (text read), network line | P |
| JW-07 | **The simulated lane shows its Session Monitor, pre-check and Dashboard without one DEMO or SIMULATED word, under a header chip "LIVE".** A still photograph is the "LIVE SESSION FEED" with "REC 00:00:04" and "1080p - 25 fps - H.264"; the banner reads "SESSION ACTIVE & SECURE - Recording in progress - All integrity checks passing"; the integrity card "Encryption Active AES-256 - Passing"; the Dashboard "TPM 2.0 Verified - Secure Boot Enabled", `192.168.10.21`. The only mark is a few pixels burnt into the picture (JA2-12). Lane 1's Storage and Network & Time pages carry no "Synthetic demo values" chip at all (counted: 0), while the same cards on lane 2 are chipped. The phone labels its feed DEMO; the web's own Evidence pages do ("DEMO package", "DEMO excerpt", "Manifest signature (simulated)"). | Lane 1: Dashboard; New Session; Session Monitor while recording. | The demonstration lane is the one a customer sees first. What is simulated must say so on the screen, as the Evidence pages and the phone already do. "LIVE" (the console's data mode) reads as "this is live". | `142_l1_step2_done`, `144_l1_monitor_rec` | P (S for the assets) |
| JW-08 | **Both microphones read "NO SIGNAL" beside "READY - PASS" whenever no capture is open (lane 2).** Dashboard tiles "MIC 1 - READY ... NO SIGNAL"; pre-check: rows "MIC (primary) READY PASS", "MIC (standby) READY PASS" and, in the same view, "MICROPHONE LEVELS ... NO SIGNAL / NO SIGNAL" above a Gate Policy card that lists "MIC no signal" under "Needs acknowledgement"; Devices; the Monitor after a seal. During a recording the same meters read -14 / -21 dBFS. | Lane 2: Dashboard; New Session step 2. | "NO SIGNAL" is the product's own fault word. A level that is not measured outside a recording should say "Not measured" (as "A/V sync - Not measured" does). On the gating screen an investigator sees PASS and NO SIGNAL for the same microphone. Not the known "READY beside Not checked": this one names a fault. | `005b`, `025_l2_step2_pass`, `109_l2_retry_pressed` | P |
| JW-09 | **The tampered item, whose verdict of record is FAIL, still reads "Sealed".** Same as JT-04. On the web: list row "Sealed", header chip "Sealed", fact "Status: Sealed", lifecycle "Sealed local evidence 8/12: Active". The web does better in two places: the list's preview pane says "Last verification FAIL", and the Hash & Integrity tab opens on "FAIL - Last verification FAIL - 11 Oct 2026 22:57:10". | Evidence -> search `0005` -> row -> Open details. | The list row and the status chip must carry a stored FAIL (interrupted items carry their own line). | `062_l2_tampered_list_preview` (text read), `065_l2_tampered_player_stop` | P |

### MINOR

| Id | Finding | Evidence | Attr. |
|---|---|---|---|
| JW-10 | **Tables do not fit the reference width.** Evidence list: the table is 908 px wide in a 776 px container at 1440x900 (669 px at 1280x800): the Status column is cut to "Seale..." and the row menu is outside the view; only an inner horizontal scroll far below reaches it. It fits at 1920. Paired Devices at 1440: the "Action" column ("Revoke...") is cut off and the "Paired" cell wraps to seven lines. | `015_l2_evidence_list`, geometry read (menu button not hit-testable at 1440 and 1280), `118_l2_revoke_dialog` | P |
| JW-11 | **GM-01 is worse than described: the unreachable-camera sentence is cut at ALL three widths.** The row needs 779 px and has 222 px (1280), 287 px (1440), 472 px (1920), single line with an ellipsis and no tooltip: "Camera 2 (CAM-02) is not reachable. The sessi..." - the consequence ("The session will record one camera only.") is the part that is hidden. The bell popover shows the whole sentence. | `090`, `091`, `092_l2_precheck_cam02_unreachable_*`, geometry read | P |
| JW-12 | Transcript (same as JT-10): no segment is marked while the recording plays (checked at 0:14 and 0:20), and a click on a segment does not seek (position 30.4 s after a click on "0:06-0:09"). The segments appear only after "Open playback"; before that the tab shows "Sealed original - immutable" over nothing. The "Transcript model" block (model, quantisation, a 64-character hash) sits between the player and the text, so the text is below the fold. | `053_l2_player_playing`; DOM read of the segment rows (no active state) | P |
| JW-13 | What the operator adds is not on the item (same as JT-11): marker "Judge B1 marker", note "Judge B1 session note", the snapshot (the Monitor counts "1 snapshot this session") and the form's "Notes" appear on no tab of `EV-20261011-0060`. The custody table prints raw codes (`RECORDING_STOPPED`, `VERIFY_FAILED`, `SESSION_INCOMPLETE`, "STORAGE_FULL; recovered", "Cause: CAPTURE_FAULT"). | Text search of the three tabs: 0 hits; `051_l2_item_0060_verify_pass` (text read) | P |
| JW-14 | RBAC is said five different ways. (a) Disabled with a reason: "Export Evidence: Requires the Supervisor role", "Requires the SUPERVISOR or TECHNICIAN role", "Your role cannot end sessions.", "At least one enabled user must keep user administration." (b) Disabled with NO reason: Play and "Open playback" for the technician; "Start New Session" on the technician's Dashboard; "Install update", "Restart services", "Export logs" for the role that lacks them. (c) Enabled, then refused two steps later: Export for the investigator and the technician (item button and row menu), stopped at "Authorise" with the raw permission name `EVIDENCE_EXPORT`. (d) Silent redirect to the Dashboard: `/admin/users`, `/admin/devices`, `/session/new` by address. (e) Hidden: the Administration group. | `072_l2_export_inv_step2` (text read), control lists as each role | P |
| JW-15 | After "Sign out", the browser's Back can bring back a page that still shows the operator as signed in. Seen once for many seconds on API Reference ("Logged in as AKP Andi Pratama", the supervisor's navigation) after signing out on another page; on an evidence item the restored page asked the Core, got 401 and went to Login within about a second. Pages that poll correct themselves; a page that does not, stays. | Driver output at 00:17 (the restored page answered my "signed in?" check); `GET evidence/... 401` on the second try | P |
| JW-16 | Dialogs: a click outside closes the transcript "Revise" dialog, the camera "Connect" dialog (with a typed account) and "End Session?" and discards what was typed, without a question. Escape closes every dialog I tried EXCEPT "Discard this session?" (focus is trapped correctly between its two buttons; Escape does nothing). The marker dialog has no Cancel button, only the X. | Driver reads (`dialogOpenAfterOutsideClick false`; "dialog after Escape: 1") | P |
| JW-17 | New Session copy and small behaviour: "Recording starts at once and is sealed when you end the session." stays when the countdown is on (the mirror of JT-22); the Monitor says "Finish the pre-recording checks to start recording." for a session that is Armed with 8 of 8; a reload at step 1 empties the form without a warning; each press of "Fill in the next case number" takes a number from the Core (9805 was burnt by my reload); only "Subject Type" carries the required mark though three fields are required; the disabled "Next" gives no reason; the name is cut at 120 characters silently; the Gate Policy card says "lens fault" blocks recording while an unreachable camera only warns. | `093_l2_countdown`; texts read at steps 1-3; `POST session/case-number` twice | P |
| JW-18 | Cut and overlapping text at 1440x900: "AUDIO M..." (heading pushed by the switch button), "Investigator Note Ad...", "Time Source - Core system clock (U...", "Sealed Eviden...", "Secure Boot: not rep...", "This Core reports no ...", control descriptions on Security & Audit ("This Core does not read a TP..."), "436.0 GB Free" touching the next label, the Recent Events list showing two and a half rows. At 1280x800 the Session Monitor's headings ("CAMERA & INPUT ST...", "LIVE AUDIT E..."), its audit rows ("Sign-in suc...", "Transcripti...") and its storage card (labels printed over each other) are not readable, and the Dashboard chips read "rimary" and "andby". Clean at 1920x1080. | `014`, `038`, `103`, `133_l2_dashboard_1280`, `136_l2_monitor_1280` | P |
| JW-19 | "Lock console" is a sign-out (same as JT-18): `POST auth/sign-out`, the user name is emptied, and the next sign-in opens the Dashboard, not the page that was locked. The wording differs from Sign out ("Console locked. Sign in again to continue."), which is honest; the function is not a lock. | `073_l2_lock_console`; network line | P |
| JW-20 | A developer scaffold is part of the console: `/stack-check` ("Stack check - placeholder ... HeroUI v3 on Tailwind 4 ... wired to the local mock-core heartbeat - Show test toast") opens for an investigator by address. (Same family as JA2-29.) | Page text at 23:53 | P |
| JW-21 | Alerts cannot be worked on the web (same as JA2-25): there is no alerts page ("View all events" opens the audit log), the bell lists active alerts only and has no Acknowledge control, and a cleared alert leaves it unacknowledged - on lane 1 the Core held 12 alerts, all inactive, none acknowledged, while the bell said "Notifications". The header menu's "Profile" row is not a link. | bell popover text in the blocked state (no control in it); `GET alerts` on lane 1 at 00:24 | P |
| JW-22 | The four quarantined sessions, and cancelled sessions, exist nowhere on the web console: there is no session history page (the tablet has a Sessions hub), and the Evidence search for `SES-20261011-0041` answers "No evidence matches these filters". The console speaks of a quarantine only while its alert is active (ring / pill copy "A recording could not be sealed ... kept in quarantine on the Core. Recording is not blocked."). An operator at the web console can therefore neither find them nor learn what to do. | `120_l2_search_quarantined_session`; copy read in `i18n-web.ts:258-260` | P |
| JW-23 | Synthetic or unproven facts on lane 2 that carry NO "Synthetic demo values" chip (the full list I found; everything else on Storage, Network & Time, System and Devices is chipped): (1) a camera drawer's Health tab "LINK QUALITY - NOW 99.7% - Derived from the Core's data - last 90 samples" on a generated source that is "Not checked" (same as JT-03's Camera Health; its time axis reads 19:00 - 20:29 at 00:20); (2) Devices header "ALL DEVICES READY 7/7 - Every input and link is operating normally", whose seven include the three chipped synthetic "other devices"; (3) Network & Time header "HOST SYSTEM CLOCK - CONNECTED"; (4) the selector accepts `CAM-04` / `CAM-06` (dead ports) with "Capture configuration saved", the Core answers `online true, streamState LIVE`, and the tile reads "Camera 2 - READY". The tablet's LAN address, PoE watts, bandwidth and diagnostics rows ARE chipped on the web. | `132_l2_cam01_health`; `083_l2_selector_cam04` (text read); `113_l2_network_time` (text read) | P (Core answers) |
| JW-24 | "Export Audit Log" shows five steps including "Hash and seal - Done", and says "The file is built here from the Core's audit list". The downloaded JSON has the rows and the chain head and no signature or seal. Either sign it or do not call it sealed. | Dialog text; keys of `dems-audit-EXP-000046.json` | P |
| JW-25 | The Evidence list has a checkbox on every row and "Select all rows"; selecting offers nothing (no bulk action appears). | `121_l2_evidence_bulk` (text read) | P |
| JW-26 | One product, five version statements: Login and sidebar "v2.4.1"; System "v2.5.0 - slot B" after the demo update (same as JA2-30); Login strip "dems-core-server 0.2.0"; API Reference "v0.3.0"; Paired Devices "android - 0.1.0" for the app that calls itself v2.4.1. | Texts read on each page | P / S |
| JW-27 | An interrupted recording is easy to miss in the lists: lane 1's item reads only "Recorded" (same as JA2-07); lane 2's interrupted items do carry "Sealed - recording was interrupted" on the item page, with the raw "Cause: CAPTURE_FAULT". | `150_l1_evidence_list` (text read); `068_l2_item_0017_interrupted` (text read) | P |
| JW-28 | The Dashboard's storage card says "Sealed Evidence 33" (0 after midnight) without the word "today" (same as JT-21); the Storage page says "1 today"; the Evidence page counts 43 sealed. The card titled "ACTIVE SESSION" shows a session that was sealed 16 minutes ago. | `005b_l2_dashboard_inv_full`, `108_l2_dashboard_blocked` | P |
| JW-29 | README names a Login button "Use security key (simulated)" that signs the Supervisor in; the Login page (Live data mode, both lanes) has no such button. | README.md:51 and :208; control list of the Login | P (doc or product) |

### NOTE

| Id | Note |
|---|---|
| N-01 | The Login password field mirrors what is typed into its `value` attribute (length read, never the content). The camera Connect dialog does it right: no `value` attribute, `autocomplete` off / new-password, a reveal control, fields locked after a good test, empty again after Close. |
| N-02 | The wrong-sign-in counter ("4 attempts remaining") answered for a user name that does not exist; I did not test what the fifth does. |
| N-03 | The 404 card stands on an empty page outside the shell (no header, no navigation). |
| N-04 | The console calls itself "DEMS EDGE CLIENT" (also the tablet app's name) and its browser title is "DEMS Edge Client - Core Console"; "Operator tablet link", "Tablet Control", "DEMS Tablet App" speak of the tablet where a phone may be paired. |
| N-05 | Specification language in operator copy (same family as N-02 of A1 and JA2-29): "(design book §19.3)", "DESIGN BOOK §20.3 / §24 / §24.1 / §10.2", "(SYS-008)", "EVIDENCE_EXPORT", "this phase shows no live preview", "V-08 - One-fragment tamper expectation", fault ids "EVT-04", "OD-11", "NM-07" in the Demo panel. The Recording Indicator's label "SEDANG MEREKAM" is the only Indonesian UI string and sits beside "STANDBY". |
| N-06 | The Demo panel's own toasts ("Camera loss injected - Audit: Fault raised") are the only toasts I saw for a fault; whether an alert toast appears on other pages was not judged. "Storage full" during a recording stops it; the pill then keeps "CRITICAL - Critical fault: Storage full" after the fault is cleared, which is right (the session is in FAULT) but reads as a stuck alert until one opens the Monitor. |
| N-07 | The export wizard's "Authorise" step is the operator authorising himself: "Request authorisation" turns to "Authorised" at once. It is a role check presented as an approval. |
| N-08 | "Retry sealing": my first press, about 2 s after opening the Monitor from the Dashboard, sent no request and changed nothing; the second press 40 s later sealed the session in 2 s (toast "Sealing is run again."). Possibly a layout shift under the pointer of my driver; not reproduced. Worth one check by hand. |
| N-09 | During the retries and the blocked state the Monitor's timeline held only "Recording Started", and its Live Audit Events showed no row for a failed seal attempt between "Recording ended" (00:10:27) and the seal (00:14:26). If the audit chain holds none, a blocked seal leaves no trail. Not checked against the full audit list. |
| N-10 | "retry 2 of 3, in 30 s" does not count down (same as N-11 of A1); the Monitor shows "Evidence ID EV-20261012-0061" before the item exists (same as N-07 of A1); the pill's popover still said "Recording pipeline - OK" during the retries. |
| N-11 | "Pause Monitoring" turns into "Resume Monitoring" and changes nothing visible where there is no preview; "Re-verify" gives no visible answer; "Make primary" swaps the microphones at once (the Monitor's switch asks first); the selector saves a camera on a dead port without a warning. |
| N-12 | Audio source "MIC 1 from 0:00 to 1:48" beside "Duration 00:01:47"; the sealed Monitor's timeline keeps only "Recording Started". |
| N-13 | Metadata is a raw JSON block (same as N-09 of A1). The revision dialog numbers segments from 0 ("Revise segment 3" is the fourth). The subject `Judge B1 Web <i>One</i>` is shown verbatim everywhere (no markup is rendered) - good. |
| N-14 | The microphone "Search again" lists "MIC 3 (MIC-03) - Ready - This Mac's microphone" (the Core's own enumeration; see section 8). The roster and both pickers list `CAM-03` / `MIC-03`. |
| N-15 | Paired Devices shows both devices as "sdk_gphone64_arm64" (emulator names: D); the online state is a small dot with no word. |
| N-16 | Lane 1: "Camera search is not available on this Core yet." beside "Searching connects to nothing." (same as JA2-N10); the camera picker offers the other track's camera and the Core refuses it with 422 (same as JA2-24; the web's message was not captured). |
| N-17 | Lane 1 Security & Audit says "SECURITY POSTURE SECURE - 9 of 9 controls active" under a header pill that at that moment read "ATTENTION - Some checks need attention" (a demo fault raised from the phone). Keys carry DEMO / SIMULATED chips; the nine controls do not. |
| N-18 | The integrity stop differs by surface: on the web Camera 2 stops with its sentence and "Camera 1 plays on" (by its own text); on the tablet playback stops (JT-17). On lane 1 the tampered demo item's MIC 2 plays without any stop (bundled DEMO media). One rule for all three would be easier to explain. |
| N-19 | After I switched to MIC 2 at 0:16 and did not switch back, the sealed transcript ends at 0:16 of 2:02 (four segments). MIC-02 carries no speech fixture: D. The item still says "Transcript assembled" with no hint that 1 min 46 s has none. |
| N-20 | Dashboard after a full load: for about 2 s the counters show other numbers (32 then 33; 55 % then 56 %) and the ring has no text (a count-up and a fade); they settle. The rolling clock exposes every digit column as text (same as N-10 of A1). The header shifts sideways when the pill's text gets longer. |
| N-21 | Console (browser) messages: no script error in any flow. Seen: 401 on `auth/session` before sign-in (expected), WebSocket closed on Back / Forward, one `[core-web] live` warning on the tampered item's player. Two lines held a media path and were not copied. |

## 6. Cross-surface consistency (the controller's questions)

| Question | Answer from the web |
|---|---|
| Same item on list / item page / Dashboard / audit | `EV-20261011-0060`: list 00:02:02 - 124 MB - Sealed; item 00:02:02 - 124 MB - Sealed - 23:56:24 to 23:58:26; seal dialog and Monitor the same id and manifest prefix `66423e8c...`; archive 123,952,638 bytes. Consistent. Sealed-count wording differs (JW-28). |
| "Security" answers (JT-03: four on the tablet) | Three on the web (JW-04): SECURE / Not reported / PASS. |
| Tampered item reads "Sealed" (JT-04) | Yes on the web too (JW-09), with FAIL in the preview pane and on the integrity tab. |
| Home READY during seal retries (JT-01 a) | NOT on the web: pill, ring and banner say "retried" from the first failure and CRITICAL when blocked. |
| Home READY beside an unreachable camera (JT-01 b) | Yes on the web (JW-05). |
| Blocked seal on a tablet-only site (JT-02) | The web has "Retry sealing" on the banner; it sealed in 2 s (N-08 for my first press). |
| Synthetic Core facts shown as real on lane 2 (JT-03) | The web chips almost all of them. Without a chip: link quality in the device drawer, "ALL DEVICES READY 7/7", "CONNECTED" in the Network & Time header, READY / LIVE for cameras on dead ports (JW-23). |
| "Separate tracks, never mixed" (JT-07) | **The tablet's sentence is not true for a lane 2 item.** The item's facts on the web: "SEALED FORMAT (SIGNED MANIFEST) - VIDEO-01, VIDEO-02", the Core record's `tracks` = those two, and Verify lists "Audio interval 1: MIC-01 - Audio interval 2: MIC-02". One audio programme that changes source by interval, inside the camera files; no AUDIO-01 / AUDIO-02 files. The web's Monitor says the same ("Audio source - MIC 1 from 0:00 to 0:16 - MIC 2 from 0:16") and does not make the tablet's claim. The four-track model (VIDEO-01/02, AUDIO-01 "MIC 1 - Interviewer", AUDIO-02 "MIC 2 - Subject") is what lane 1's simulated items show - the sentence belongs to that model. |
| "Install update" without confirmation (JT-06) | The same on the web (JW-06). |
| Composite delivered as Package (JA2-03) | Lane 1 web: the same. Lane 2 web: accepted, then FAILED with a true sentence (JW-03). |
| Incomplete item verifies PASS (JA2-01) | The same on the lane 1 web (JW-01). |
| Marker / snapshot / notes after the seal (JT-11, JA2-08) | Not shown on the web either (JW-13). |
| Transcript following (JT-10) | Not on the web either (JW-12). |
| Lock console (JT-18) | A sign-out on the web too, with its own wording (JW-19). |
| Alerts (JA2-25) | No alerts page and no acknowledge on the web (JW-21). |
| Versions (JA2-30) | The same split on the web, plus three more numbers (JW-26). |

## 7. RBAC as felt

| Role | Cannot | How the console says it | Verdict |
|---|---|---|---|
| Investigator | Export | Dashboard quick action disabled: "Export Evidence: Requires the Supervisor role"; item button and row menu ENABLED, refused at step 2 | JW-14 |
| Investigator | Archive | Menu item disabled (no reason read) | - |
| Investigator | Camera search, selector, microphone re-scan | Disabled + "Requires the SUPERVISOR or TECHNICIAN role" | Good |
| Investigator, technician | Users & Roles, Paired Devices | Hidden in the navigation; by address a silent redirect to the Dashboard | JW-14 |
| Supervisor | Install update, Restart services | Disabled, no reason | JW-14 |
| Technician | Start a session | Dashboard button disabled, no reason; `/session/new` redirects silently; Monitor: "Your role cannot end sessions." | JW-14 |
| Technician | Play | "Play" and "Open playback" disabled, no reason (same as JT-16) | JW-14 |
| Technician | Export | Enabled, refused at step 2 | JW-14 |
| Technician | Demo controls (lane 1) | The switch is not offered | Good |
| Supervisor | Disable the own account | Disabled + "At least one enabled user must keep user administration." | Good |

No press ended in a raw error page; the one raw string is the permission name `EVIDENCE_EXPORT`.

## 8. Not judged, skipped, and my own slips

Not judged, and why:
- The lock-out wording after five wrong sign-ins (one wrong sign-in only, as instructed).
- The 8-hour limit of a session: not reachable. (The 15-minute idle expiry WAS judged: section 10.)
- Adopting the found camera ("Add as camera" was offered after the good test; not pressed).
- "Revoke" of a paired device (not pressed; at 1440 its column is cut, JW-10); "Change role" and
  "Disable user" (dialog read, cancelled); "Apply" in Manage Storage; "Restart services";
  "Export logs"; "Test signal" (announces a tone), "Identify", "Restart" of a device; Archive.
- Demo faults "Power fail" and "Capture fault" (they need a second recording on lane 1); the three
  time-source switches; "Reset demo"; Presentation mode, Reduce motion, clock format switches.
- The "Simulated" data mode of the Login (it would leave the Core; both lanes were judged in Live).
- The unsealable rig (not on my list). The phone's and the tablet's side of anything.
- A screen reader. Tab order, focus rings and labels were read from the DOM only.
- The seal dialog's "View in Evidence" and the sidebar collapse were seen, not pressed.

Skipped:
- **Biometrics** (D151): the web has no biometric control; nothing to answer. Skipped, not passed.
- **Local devices** (D163): `CAM-03` and `MIC-03` were never selected, pre-checked or started; my
  picker helper refuses both names. The product lists them in the roster and in both pickers, and
  the microphone re-scan I was asked to press answered "MIC 3 (MIC-03) - Ready" (the Core's own
  enumeration, as on the tablet). The selector was read back through the API after every change.

My own slips (nothing of them is in a kept file):
- The first "Download manifest" click landed in `~/Downloads` (my download folder was not yet in
  force). I moved that one file, which I had created seconds before, into `dl2/` as
  `...first_click.json`; nothing else in `~/Downloads` was touched.
- One control dump printed the stub's fixture USER NAME into my tool output, and one screenshot
  showed it in the dialog. I deleted that screenshot (`089`, my own file) and masked such fields in
  the driver. The secret was never printed.
- Session 1 ran 2 min 02 s instead of 45-60 s (my End Session dialog was closed between two driver
  runs). The slots file holds one line of mine written 40 s too early ("sealed by Retry sealing")
  and its correction.
- I pressed "Install update" on lane 1 as allowed; lane 1 now reads "v2.5.0 - slot B" and I know no
  console control that reverts it (a scenario load does not).

## 9. Screenshots opened as pictures (under `.cache/judging/web/`)

| File | One line |
|---|---|
| `001_l2_deeplink_signed_out` | Login: emblem, status strip (core-server 0.2.0, time, Database / Engine Ready, Core link Online, Mode Live), form, data-mode switch |
| `003_l2_login_wrong` | "Invalid username or password. 4 attempts remaining", both fields red, name kept |
| `004_l2_after_signin_deeplink` | The tampered item's page after the redirect: chip "Sealed", "Development source", Play / Export / More |
| `005b_l2_dashboard_inv_full` | Dashboard READY ring, six strip chips, sealed session card, four device tiles with "NO SIGNAL", storage ring 56 %, "NOT REPORTED" tiles |
| `010_l2_404` | The lone "Page not found" card on a black page |
| `011_l2_inv_admin_users` | The Dashboard an investigator lands on after `/admin/users`; ring without text and "32" two seconds after the load |
| `014_l2_session_monitor_idle` | Monitor after a seal: "SESSION SEALED" banner, cut integrity rows, storage ring touching its labels |
| `015_l2_evidence_list` | Evidence at 1440: Status column cut to "Seale", no row menu in view, preview pane with "Last verification Not verified" |
| `025_l2_step2_pass` | Devices Check all PASS beside two "NO SIGNAL" meters and the Gate Policy card |
| `038_l2_monitor_rec_c` | Recording: REC 00:00:42, meters -16 / -21 dBFS, five timeline rows, bell 1, "AUDIO M..." |
| `046_l2_seal_done` | Seal dialog at 100 %: six green steps, SEALED stamp, manifest prefix, development-key lines |
| `053_l2_player_playing` | Sealed player: two colour-bar pictures, 0:03 / 2:02, audio band MIC 1 0:00-0:16 / MIC 2 0:16-2:02, transcript model block above the first segment |
| `065_l2_tampered_player_stop` | Tampered item: Camera 1 playing, Camera 2 "Stopped: this file failed its integrity check at fragment 3.", red banner with the explanation |
| `088_l2_connect_tested` | Devices page with the search result row "127.0.0.1 - FAKE-CAM-1 - New - Connect" (the dialog had closed) |
| `090_l2_precheck_cam02_unreachable_1440` | Pre-check WARN: "Camera 2 (CAM-02) is not reachable. The sessi..." cut; pill still "SECURE"; bell 1 |
| `093_l2_countdown` | Countdown "3" with "Cancel countdown" over the dimmed Ready card |
| `103_l2_chain_verified` | Security & Audit: "Not reported" posture, 2 of 9, "PASS Verified 1000 entries", cut control descriptions; pill "SEALING RETRIED" |
| `109_l2_retry_pressed` | Monitor blocked: red banner "SEALING BLOCKED" with "Retry sealing", pill CRITICAL, bell 1, both meters "NO SIGNAL" (`107_l2_bell_blocked` was re-taken on the Dashboard with the bell popover open and read as text) |
| `108_l2_dashboard_blocked` | Dashboard: red ring "SYSTEM CRITICAL - NO NEW SESSION UNTIL IT IS SEALED", card "Sealing blocked - Open Session Monitor" |
| `118_l2_revoke_dialog` | Paired Devices: table without its Action column, toast "Pairing code cancelled" |
| `133_l2_dashboard_1280`, `136_l2_monitor_1280` | 1280x800: clipped chips ("rimary", "andby"), cut headings and audit rows, overprinted storage labels |
| `142_l1_step2_done` | Lane 1 pre-check: two room photographs as camera previews, "MIC 1 - Interviewer -52 dBFS", "MIC 2 - Subject -19 dBFS" |
| `144_l1_monitor_rec` | Lane 1 recording: a photograph as the live feed with REC, "SESSION ACTIVE & SECURE", no DEMO word |
| `153_l1_incomplete_verify` | Lane 1 incomplete item: status "Recorded", lifecycle at "Recording", verdict "PASS - 6 of 6 checks", green toast |
| `145_l1_demo_panel` | System page: About / Identity with its chip, Settings accordion, the Demo Control Panel header with the DEMO chip and switch |

## 10. State left (read back 00:33 - 00:38)

- **My browsers:** both headless Chrome instances stopped; lane 1 was signed out by "Sign out"
  ("You have been signed out."), lane 2 by its own idle limit (below). The private sign-in file and
  my helper script in `.cache/gate-env/` are removed; both helper API sessions were signed out (204)
  and their jars removed (`session_lane2_INVESTIGATOR.jar` there is not mine and was left).
- **Session expiry, judged at the end:** the lane 2 console, left untouched on the Session Monitor
  from 00:21, stood on `/login?redirect=%2Fsession` at 00:37 with "Your session expired after 15
  minutes without activity. Sign in again." - clear, and the page is kept for the next sign-in. At
  00:32 (11 minutes idle) it was still signed in. OK. (`170_l2_idle_check`, text read.)
- **Lane 2** (read through the API at 00:37): selector `CAM-01`, `CAM-02`, `MIC-01` PRIMARY,
  `MIC-02` STANDBY; seal rig OFF, source rig OFF (both read back); transcription settings as found
  (enabled, cpu-local, speaker labelling on; revision 15 after my off / on); audit chain `view.ok
  true`, `stored.ok true` (1,433 rows). Not reset, not restarted. **A session is open and it is not
  mine:** `SES-20261012-0093`, RECORDING, judge B2's tablet session (slot line 00:15), with one
  active INFO alert that belongs to it. I raised no alert that is still active.
- **Added on lane 2 by me:** `EV-20261011-0060` (now EXPORTED by `EXP-000045`; one failed Composite
  job `EXP-000044`; verified twice; transcript revision `TRV-000001`), `EV-20261012-0061` (SEALED
  after the blocked-seal run); one more FAIL verification row on `EV-20261009-0005`; audit export
  `EXP-000046`; one pairing code issued and cancelled; case number 9805 consumed without a session.
  Nothing adopted, nothing revoked, no user or policy changed.
- **Lane 1:** no session open, scenario `idle`, no active fault, 0 alerts, selector on the defaults.
  The four scenario loads rebuilt the data set, so my simulated session, its incomplete item and the
  demo export exist only in my screenshots; the steps reproduce them. **Changed and not put back:**
  the demo update reads "v2.5.0 - slot B" (JW-06).
- **Slots file:** my lines for lane 2 (23:54 - 23:58 and 00:05 - 00:14, with both rigs) and lane 1
  (00:21 - 00:27, 00:28) all end in "free".
- No product source, test or other document changed; `masterplan/02_plan.md` not written.

---
*Generated: 2026-10-12 00:40 WIB*
