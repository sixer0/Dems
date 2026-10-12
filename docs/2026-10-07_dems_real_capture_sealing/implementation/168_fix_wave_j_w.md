---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave J, driver J-W - the web console (apps/core-web only); findings of report/judging_b1_web.md, the web halves of JT-01/-03/-04/-06/-07 and JA2-01..03, GM-01, GM-02; decision D243
date: 2026-10-12
agent: coder-execution (driver; rules D94 / D122 / D163; fix briefs wave J, M, L, K)
narrative_tier: 2
status: complete - see section 1 for the counts and section 6 for what is not fixed
tree: 035150b + the uncommitted work of wave J (J-S consistent at 05:58)
---

# 168 - Fix wave J, driver J-W: the web console

No git write. Only `apps/core-web/**` was edited, plus this note, three lines in
`delegation_progress/contract_wave_j.md` / `judging_slots.md` and one claim line. `packages/shared`,
`apps/core-server`, `apps/mobile`, `scripts` were not touched. No LOCAL_DEVICE source was selected,
pre-checked or started (the selector was read before the one lane 2 session: `CAM-01`, `CAM-02`,
`MIC-01`, `MIC-02`). Nothing was played aloud (headless Chrome, `--mute-audio`). No secret, pairing
code, fixture account or signed path is in this note or in a kept picture; the sign-in values were
read from the README into a private 0600 file, typed from it and the file is removed.

## 1. Result in one table

| Severity | In the report | Fixed | Fixed in part | Not fixed (reason in section 6) |
|---|---|---|---|---|
| BLOCKER | 1 | 1 | 0 | 0 |
| MAJOR | 8 | 8 | 0 | 0 |
| MINOR | 20 | 15 | 3 (JW-13, JW-19, JW-20) | 2 (JW-26, JW-29) |
| NOTE | 21 | 9 | - | 12 (listed) |
| GM-01, GM-02 | 2 | 2 | 0 | 0 |

Checks at the end: core-web typecheck clean, lint clean (0 warnings), whole core-web suite 167 files /
2280 tests green (section 5).

## 2. The rules that were built (each is ONE place)

| Rule | Where | Readers |
|---|---|---|
| ONE statement of system state: `systemStatementOf(facts)`, a pure table of nine rows (UNKNOWN, CORE_OFFLINE, CRITICAL, ATTENTION, SEAL_RETRYING, ALERT_ACTIVE, OPEN_NOTICE, NO_FAULT_REPORTED, SECURE), guarded by the shared `systemTruthOf(state).allOperational` (contract J-S 13) | `src/lib/system-statement.ts` | header pill (`components/shell/secure-pill.tsx`), Dashboard ring (`features/dashboard/system-ring-panel.tsx`) |
| "This Core is the demonstration" = `!isOwnCaptureCoreState(state)` (contract J-S 7); the mark `DemoMark` | `src/components/demonstration-core.ts`, `demo-mark.tsx` | mode chip, every Monitor panel + banner, pre-check cards, Dashboard ring / strip / cards, Storage, Network & Time, System, Devices, Security panels, every bundled picture (`components/media/camera-feed.tsx`) |
| "The role may not": a control is DISABLED with a VISIBLE reason naming the role(s) (`RoleReason`); a refused page says so | `src/components/role-reason.tsx`, `role-reason-text.ts`, `src/lib/denied-page.ts` | evidence item (Play, Export), list row menu, preview, bulk export, sealed player, Dashboard "Start New Session", System (Install, Restart, Export logs), route guards |
| An item that was never sealed (`hasSealedValues`) shows no sealed value, manifest, signature, Verify or verdict | `features/evidence/item-marks.tsx` (`NotSealedMark`, `NotSealedStatement`), `integrity-tab.tsx`, `use-verification.ts` | list row, preview, header, Hash & Integrity, Media |
| A FAIL of record is said on the status itself (`verificationOfRecordFailed`) | `features/evidence/status-label.ts`, `chips.tsx` | every `EvidenceStatusChip` (list, preview, header, Status fact) + the lifecycle |
| An export output follows the Core's `exportKinds` (`exportKindOffer`) | `features/evidence/item-facts.ts`, `export-wizard.tsx` | wizard |
| A source the Core never checked is "Not checked" (`useTrackReach`, the rule of `source-state.ts`) | `features/devices/track-reach.ts` | Devices camera tile, Dashboard tile, Dashboard strip, Monitor input tile |
| The bell lists and counts every alert still OPEN for the operator (ruling; the phone's rule) | `components/shell/open-alerts.ts` | `notifications-bell.tsx`, new page `/alerts` |
| No text is cut by an ellipsis: 47 CSS rules turned from `nowrap + ellipsis` to wrapping, 6 `truncate` classes removed; the Dashboard (1280-1599) and the Session Monitor (all desktop widths) size their rows to their content with a minimum, and the page scrolls | the feature stylesheets (list in section 7) | every page |

## 3. Every finding

L1 = lane 1 (simulated), L2 = lane 2 (real capture on generated sources). "Test" names the EXISTING
test file that took the test (D233), or the new module's own file. Browser pictures are under
`.cache/judging/wave-j-w/` (section 4).

### BLOCKER and MAJOR

| Id | Sev. | Fixed - how | Code | Test | Proven live |
|---|---|---|---|---|---|
| JW-01 (JA2-01 web half) | BLOCKER | A never-sealed item: Hash & Integrity shows "This item was never sealed ... nothing to verify" and NO verify card, NO sealed values, manifest, signature or verdict; the header and the list row carry "Not sealed" (with the cause where the item states one); Export disabled; the list's Verify entry disabled; no manifest entry in More; the Media tab says "The recording is not sealed"; `run()` sends nothing for such an item (the Core answers `409 NOT_SEALED`) | `features/evidence/integrity-tab.tsx` (the `!sealed` branch), `item-marks.tsx`, `detail-page.tsx`, `evidence-table.tsx`, `preview-card.tsx`, `use-verification.ts` | `features/evidence/__tests__/evidence-integrity.test.tsx` "wave J: a never-sealed item ..." (+ negative control); `item-facts.test.tsx` contract example `neverSealed` | L1 after the restart: session `SES-20261012-0024`, demo fault STORAGE_FULL, recovery "Session marked INCOMPLETE. It will never be sealed." -> `EV-20261012-0014`: `p01_l1_incomplete_item_integrity`, `p01b_..._list_row`; the Core refuses op 41 with 409 NOT_SEALED |
| JW-02 | MAJOR | "Download manifest": for an item sealed on this Core the entry is disabled and says "The signed manifest is part of the export package. Use Export."; for a DEMO item it is "Download DEMO manifest summary" (toast "DEMO manifest summary downloaded"); for a never-sealed item it does not exist (contract J-S 4) | `features/evidence/detail-page.tsx` (`manifestKind`) | covered by the JW-01 case (no manifest entry) and by the suite's existing manifest cases | L2 `EV-20261012-0063`: `p02_l2_real_item_manifest_menu`; nothing was downloaded (`dl2/` empty) |
| JW-03 (JA2-03 web half) | MAJOR | Composite follows `exportKinds`: stated unavailable -> option disabled, reason on the step ("Composite: Composite video is not available in this build."), never sent; member absent -> not offered; the review step states the output; the wizard's last step is "done" only when the Core's job is COMPLETE (error tone when it FAILED); the activity lists word `exportPhase: REQUESTED` as "Export requested" (`lib/event-words.ts`: Storage, Network & Time, Dashboard) | `features/evidence/export-wizard.tsx`, `item-facts.ts`, `export-job-status.tsx`, `lib/event-words.ts` | `features/evidence/__tests__/export-job.test.tsx` (three cases replace "Composite chosen"), `item-facts.test.tsx` "wave J: the export outputs" | L2 `p03_l2_export_composite_disabled`, L1 `p03b_l1_...`; no POST was sent by the page; a direct POST with `kind: COMPOSITE` is refused 409 COMMAND_UNSUPPORTED on L1 |
| JW-04 (JT-03 web half) | MAJOR | The pill of a Core that states `platformNotReported` reads "NO FAULT REPORTED - Platform security: not reported" (neutral tone), never SECURE; the pre-check's SECURITY row and the form's readiness row read "Not reported" (the Core's note `SECURITY_PLATFORM_NOT_REPORTED`); diagnostics rows the Core does not report read "Not reported" and are not counted | `lib/system-statement.ts`, `secure-pill.tsx`, `features/session-new/{model.ts,devices-step.tsx,info-step.tsx}`, `features/system/{model.ts,diagnostics.tsx}` | `test/integrity-checks.test.ts` (20-row table), `features/session-new/__tests__/session-new-model.test.tsx`, `features/system/__tests__/system-model.test.tsx`, `features/dashboard/__tests__/dashboard.test.tsx` | L2 `p04_l2_dashboard_pill_popover_1440`, `p08b_l2_precheck_pass_security_not_reported` |
| JW-05 (JT-01 web half) | MAJOR | An active alert no flag stands for turns the pill to "ALERT ACTIVE - 1 active alert" and the ring to ATTENTION "1 ACTIVE ALERT" with the Core's sentence; a lost Core link reads "CORE OFFLINE - State unknown" on both | the same module; `system-ring-panel.tsx` | the same table; `dashboard.test.tsx` "JW-05 / JT-01" | L2 with `source-rig 2 unreachable CAM-02`: pill "ALERT ACTIVE / 1 active alert" on the pre-check (`p08_l2_precheck_cam02_unreachable_*`); back to "NO FAULT REPORTED" after the release. The lost link is proven by test only (the Live link test of the Storage page now reads "CORE OFFLINE / State unknown") |
| JW-06 (JT-06 web half) | MAJOR | "Install update" opens a confirmation: version, inactive slot, the restart and what it costs; Cancel starts nothing. A Core that states `updaterNotAvailable` shows "Software update is not available on this Core" and no Install control | `features/system/update-panel.tsx` | `features/system/__tests__/system-page.test.tsx`, `test/live-system-maintenance.test.tsx` (helper `confirmInstall`) | L1 technician: `p05_l1_install_update_confirm`, cancelled, no request; L2: `p06_l2_system_update_not_available` |
| JW-07 | MAJOR | The demonstration is marked: mode chip "LIVE · DEMO CORE"; "DEMO · SIMULATED" on the Monitor banner, the Dashboard ring and strip; "DEMO" on every Monitor panel, the pre-check cards, Dashboard cards, Storage / Network / System / Devices / Security panels and on every bundled picture | `components/demo-mark.tsx`, `demonstration-core.ts`, the panel wrappers | `dashboard.test.tsx` "JW-07" (+ negative control: a Core in its own capture draws none); the Live page tests now allow the word only inside the mark (`test/demo-words.ts`) | L1: `p07a` (pre-check), `p07b` (Monitor recording), `p07c` (Dashboard), `p07d` (Storage, 7 marks), `p07e` (Network, 6 marks) |
| JW-08 | MAJOR | A frame with `notMeasured` draws "Not measured", no bars, no number, never "NO SIGNAL" (`isLevelNotMeasured`). The four unchipped facts: camera Health series carry the chip; the Devices banner of a Core in its own capture reads "NO DEVICE FAULT REPORTED"; the Network banner reads "Network not reported"; a camera nobody checked reads "Not checked" on the Devices tile, the Dashboard tile and strip and the Monitor tile | `components/composed/dbfs-meter.tsx`, `features/devices/{health-chart,devices-banner,camera-tile,track-reach}.ts(x)`, `features/network-time/status-banner.tsx`, `features/dashboard/{devices-panel,status-strip}.tsx`, `features/session-monitor/inputs-panel.tsx` | `components/composed/__tests__/dbfs-meter.test.tsx` (+ negative control) | L2 at rest: all four meters "Not measured", tiles and strip "Not checked" (`p04b_l2_dashboard_1440`); during the recording the meters read levels (`p11_l2_monitor_recording_1440`) |
| JW-09 (JT-04 web half) | MAJOR | The status chip reads "Sealed · verification FAILED" (danger) wherever it is drawn; the lifecycle stage carries "The verification of record FAILED" | `features/evidence/{status-label.ts,chips.tsx,integrity-tab.tsx}` | `evidence-integrity.test.tsx` "JW-09" (two cases) | L2 `EV-20261009-0005`: list row, header chip, Status fact, lifecycle (`p09a`, `p09b`) |

### GM-01, GM-02 and headline 9

| Id | Fixed - how | Code | Test | Proven live |
|---|---|---|---|---|
| GM-01 / JW-11 | The check row's sentence wraps; no ellipsis (and the sweep of section 2) | `features/session-new/session-new.css` | box check | L2: the whole sentence "Camera 2 (CAM-02) is not reachable. The session will record one camera only. It did not answer the pre-check. A search found 1 camera." at 1280, 1440, 1920, box check 0 cut (`p08_*`) |
| GM-02 | The tamper tile and its sentence read the Core's `evidenceVerification` of operation `getSecurityStatus` | `features/security-audit/evidence-verification.ts`, `tamper-panel.tsx` | static pin of `test/live-security-audit-page.test.tsx` moved by delta | L2: tile "36 PASS • 1 FAIL", "25 of the 62 sealed items of this Core have no verification of record." = the API member `{sealed 62, passed 36, failed 1, neverVerified 25}` = my own count over the 63 listed items |
| JW-22 (headline 9) | New page `/session/history` "Sessions" over the replicated `sessionHistory` (operation 38) with `incompleteSessionFactOf`: state, cause by name, "recording kept in quarantine - what to do"; linked from the Dashboard ("All sessions"), the Monitor and the Evidence page; an Evidence search that names a session without an item says so with a link | `features/sessions/**`, `routes/_app/session/history.tsx`, `features/evidence/list-page.tsx` | `features/sessions/__tests__/model.test.ts` (new module) | L2: 65 sessions, 5 not sealed, 4 in quarantine (`t10_l2_sessions_incomplete`); `/evidence?q=SES-20261011-0041` -> "1 session matches this search and has no evidence item (not sealed). Show in Sessions"; L1: `p09c_l1_sessions_incomplete` |

### MINOR

| Id | Fixed - how (code) | Test / proof |
|---|---|---|
| JW-10 | Evidence table and Paired Devices table have the whole width below 1600 px (`evidence.css`, `list-page.tsx` PREVIEW_QUERY, `paired-devices.css`) | box check: no inner sideways scroll at 1280 / 1440 on both pages |
| JW-12 (JT-10) | The transcript follows the playback (active segment marked) and a segment's time is a button that seeks / opens the playback there; the model block moved under the text (`features/evidence/playback-link.ts`, `sealed-player.tsx`, `transcript-pane.tsx`) | `features/evidence/__tests__/playback-link.test.ts` (new module); L2 `EV-20261012-0068`: press on "0:06-0:09" -> both videos at 9.2 s, segment 1 active (`p12`). "Segments appear only after Open playback" was not reproduced: 4 segments were there before the press |
| JW-13 (JT-11) | PART: the custody table shows the action's name (code as title) and fault names inside details; "Cause: Capture fault" on the interrupted mark; a new block "Markers and notes of the session" draws `item.markers` / `item.notes` when the item carries them (`session-annotations.tsx`) | `cf-web-custody-media.test.tsx`, `item-facts.test.tsx` by delta. NOT fixed: a sealed item of lane 2 carries no `markers` / `notes` member - see section 6 |
| JW-14 | ONE rule (section 2). (b) visible reasons: Play / Open playback, Start New Session, Install, Restart, Export logs; (c) Export disabled with its reason on the item, the row menu, the preview and the bulk bar - the wizard is not opened for a role that may not export, and its step names the role, never `EVIDENCE_EXPORT`; (d) the guard still leaves for the Dashboard (the specified leave, AC-C-50 / RC-3) and the shell now SAYS it: "Users & Roles: not available to your role - Requires the Supervisor role" | `evidence-export.test.tsx` and `test/live-evidence-export.test.tsx` (the denied-path cases REPLACED), `test/routes.test.tsx`, `dashboard.test.tsx`, `system-page.test.tsx`; L2 as investigator and technician: `p10a` .. `p10d`. (e) the hidden ADMINISTRATION group stays hidden: section 6 |
| JW-15 | A shell restored from the back / forward cache reloads (`lib/restored-page.ts`, installed by `app-layout.tsx`) | by code only - not reproduced in the headless browser |
| JW-16 | Revise, Connect and End Session no longer close on a click outside; Escape answers "Discard this session?"; the marker dialog has Cancel | L2: Cancel present on the marker dialog; the rest by code |
| JW-17 | Start hint follows the countdown switch; the Monitor says "The pre-recording checks are done" for an ARMED session; a reload with unsent input asks (beforeunload); the case number is asked once per form; required marks on case number and name; the disabled Next says why; the name limit is said; the gate policy card of a Core in its own capture lists its own rule | L2: "Fill in the required fields to continue.", two presses -> ONE `POST session/case-number`, policy card text, hint "Recording starts after the 3-2-1 countdown ..." |
| JW-18 | Section 2, last row; partition names in a legend; microphone tiles wrap | box check, section 4 |
| JW-19 (JT-18) | PART: after "Lock console" the next sign-in returns to the locked page (`lib/lock-return.ts`) | `test/live-shell-notices.test.tsx` by delta. It is still a sign-out: section 6 |
| JW-20 | PART: the page says "Developer diagnostic of this console build ..." | section 6 |
| JW-21 (JA2-25) | New page `/alerts` (every alert, state in words, Acknowledge); the bell lists every OPEN alert (active, or resolved and not acknowledged - tagged), newest 20, each with Acknowledge; the badge counts them (the ruling) | `components/shell/__tests__/open-alerts.test.ts` (new module); L2: "Notifications, 84 new alerts", 20 rows, first "... / Resolved, not acknowledged / Acknowledge" (`p21`) |
| JW-23 | see JW-08 | |
| JW-24 | The step reads "Add the chain head"; the result says the file is not signed and not sealed | by code |
| JW-25 | The bulk bar (it existed: "N selected - Export N") is now disabled with its reason for a role that may not export; the judge's "nothing is offered" was not reproduced as a supervisor | `test/live-evidence-export.test.tsx` |
| JW-27 | "Recorded" + "Not sealed" on the row of a never-sealed item (L1 `p01b`); the cause by its name | see JW-01 |
| JW-28 (JT-21) | "Sealed today" on the Dashboard storage card; the card is titled "LAST SESSION" when its session is sealed | by code; L2 picture `t01` |
| JW-26, JW-29 | not fixed | section 6 |

### NOTES

Fixed (one line or plainly wrong): N-03 partly (a refused page lands inside the shell with its
sentence), N-05 (web half: "EVIDENCE_EXPORT" gone from the wizard; the shared sentences are J-S's),
N-10 third part (the pill no longer says SECURE during retries - already so; kept by the table),
N-11 fourth part (a camera on a dead port reads "Not checked"), N-13 third part (unchanged, good),
N-17 (the nine controls of lane 1 carry the DEMO mark on their panel), N-20 third part (the pill's
subtitle is short for the new states), JW-N: the readiness glance reads "Host system clock"
instead of "WARN" for the host-clock note, and the Dashboard strip agrees with the tiles.
Not changed: N-01, N-02, N-04, N-06, N-07, N-08, N-09, N-12, N-14, N-15, N-16, N-18, N-19, N-21
(section 6).

## 4. Browser proof (after my restart of both lanes at 06:01)

Tool: my copy of the judges' CDP driver (`.cache/judging/wave-j-w/tools/`), two headless muted
Chrome profiles. Pictures `p*.png` are the proofs, `t*.png` working shots. BOX CHECK (`box.js`:
text cut by an ellipsis or a clipped box, a text sticking out of its card, a scroll container that
hides content sideways, text boxes lying over each other) at 1280x800, 1440x900 and 1920x1080:

| Lane | Pages | Result |
|---|---|---|
| 2 | Dashboard, Session Monitor (at rest, recording, sealed-interrupted), Evidence list, two items, Devices, Storage, Network & Time, System, Users & Roles, Paired Devices, Sessions, Alerts, New Session steps 1 and 2 (also with the unreachable-camera warning) | 0 cut, 0 clipped, 0 overlap at all three widths; Security & Audit at 1280: the hash-chain strip (by design) and the audit table (1144 px in 1008) scroll sideways |
| 1 | Dashboard, Monitor, Evidence, the incomplete item, Devices, Storage, Network & Time, Security & Audit, System, Sessions, Alerts | the same |

Sessions I ran: L2 `SES-20261012-0098` on the FAKE sources (pre-check with `source-rig 2
unreachable CAM-02`, released, re-run PASS, started 06:07:22). **It was interrupted by the product
19 s in ("The capture worker stopped responding and was ended by the Core") while the host load
was above 20**; the Core sealed it by itself as `EV-20261012-0068` (SEALED, interrupted). I count
that as a dev-host artefact, not a web finding; it gave the interrupted item for the proofs.
**NOT proven live: the seal dialog of a normal 45-60 s recording on lane 2** (I did not start a
second recording under that load) - its code was not changed except the DEMO marks around it.
L1 `SES-20261012-0024` (9 s, demo fault, INCOMPLETE).

## 5. Checks

| Check | Command | Result |
|---|---|---|
| typecheck | `npm run typecheck -w apps/core-web` | clean |
| lint | `npm run lint -w apps/core-web` | clean, 0 warnings |
| whole suite, first run (06:00, load 5.3) | `npm test -w apps/core-web` | 166 files, 2276 tests passed |
| whole suite, FINAL run (09:0x, 1-minute load 5.98 at its start) on the tree as delivered | `npm test -w apps/core-web` | **167 files, 2280 tests passed, 0 failed** (81 s) |

Checks for the test runner: `npm test -w apps/core-web` once more on a quiet host (the files
`test/shell-motion.test.tsx` and other timing tests fail at random with the load above 15 -
different tests on each run, none in a second run alone at low load).

## 6. Not fixed, and why

| Id | Reason |
|---|---|
| JW-13 second half (markers, notes, snapshots on a sealed item of lane 2) | The Core's sealed item carries no `markers` / `notes` member (`EV-20261012-0068`: both absent); the block is built and draws them when sent. Needs a server change (owner: J-S / the controller) |
| JW-19 "Lock console is a sign-out" | No operation keeps a locked session; a real lock is a contract change. Decision for the user |
| JW-20 `/stack-check` open to every role | 01_specs §14.2 keeps it as a URL-only diagnostic and 12 tests mount it as an investigator; gating or removing it is a ruling. I tried a role gate and took it back |
| JW-26 five version statements | Which number is THE product version is a decision (sidebar constant 2.4.1, service build 0.2.0, API 0.3.0, app 0.1.0, demo update 2.5.0) |
| JW-29 README names a "security key" button | A document (not my area) or a product decision |
| JW-14 (e) hidden ADMINISTRATION group | PG-4 / AC-C-51 specify that the entries are rendered only with their permission (pinned by `live-shell-admin`); the page behind them now says why |
| N-01, N-02, N-04, N-06..N-09, N-12, N-14..N-16, N-18, N-19, N-21 | not one-line: N-09 / N-19 / N-14 / N-16 are Core facts; N-04 naming and N-18 one integrity-stop rule are decisions; N-08 not reproduced |

## 7. Seen, not changed

- After "Sign out" from an item page the Login once carried `?redirect=` (seen once in the browser,
  not on the second try). Not from this wave's lock change (the test pins `{}` for a sign-out).
- A refused page whose permission is taken away while it is open now shows two notices (the
  shell's role notice and the new "not available to your role").
- The Monitor's integrity card breaks "(UTC+07:00)" inside the token at 1440.
- `apps/core-web/.tanstack/tmp/` appeared (untracked; the router plugin's scratch folder of the
  running dev servers). Not mine to delete; it may want a `.gitignore` line.
- `src/routeTree.gen.ts` was regenerated by the dev servers for the two new routes.

## 8. Decisions for the controller

1. The Dashboard (1280-1599) and the Session Monitor no longer FIT the window: rows have a minimum
   and grow; the page scrolls. AC-60 (no scroll at 1920) still holds for the Dashboard; the Monitor
   at 1920x1080 is now a little taller than the window.
2. Route guards keep the redirect and add the sentence (not a "no access" page), because the leave
   is specified (AC-C-50, RC-3).
3. The export "denied path" (D-6: one refused POST per row, EXPORT_DENIED rows) can no longer be
   entered from the page; its tests are replaced. The wizard's denial code stays for a Core that
   refuses a role the console thought allowed.
4. An active INFO alert changes no system statement (it is on the bell).
5. The bell counts every unacknowledged alert: lane 2 reads "9+" (84) until somebody acknowledges.
6. Both lanes were restarted ONCE, at 06:01, after "JS consistent at 05:58"; no server or shared
   source file is newer than that boot, so they were not restarted again.

## 9. Re-drive list for the confirmation judge

1. L1: session -> demo fault "Storage full" -> recovery -> the item: Hash & Integrity, header, list row, More menu.
2. L2: More on a sealed item; Export -> output list; the tampered item `EV-20261009-0005` in list / header / lifecycle.
3. L2: pill, popover, ring, strip at rest; `source-rig 2 unreachable CAM-02` + pre-check at 1280 / 1440 / 1920; release.
4. L2: one 45-60 s recording for the Monitor and the seal dialog (not proven here).
5. L1 technician: Install update -> confirmation; L2: the update card.
6. L1: DEMO marks on Dashboard, pre-check, Monitor, Storage, Network & Time.
7. Each role: Export / Play / Start / Install reasons; `/admin/users` and `/session/new` by address.
8. Sessions page, Evidence search by a quarantined session id, Alerts page and the bell.
9. Transcript: play and press a segment's time.

---
*Generated: 2026-10-12 08:55 WIB*
