---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave J, ROUND THREE of the web - driver J3-W (apps/core-web ONLY); the web findings round one left (implementation/168), the web halves of what J2-S built (implementation/172, contract J2-S 1-4), decisions D243, D244
date: 2026-10-12
agent: coder-execution (driver; rules D94 / D122 / D163; fix brief wave J)
narrative_tier: 2
status: complete - every BLOCKER, MAJOR and MINOR of report/judging_b1_web.md is fixed or carries a reason (section 2); NOTES in section 3
tree: 035150b + the uncommitted wave J (rounds one and two) + this round; no git write
proof: BY TEST ONLY - no lane was called, none restarted, no browser, no device (section 5)
---

# 173 - Fix wave J, round three, driver J3-W: the web console

Only `apps/core-web/**` was edited, plus this note, one claim line in
`delegation_progress/file_claims.md` and `delegation_progress/coder-execution_wave_j3_w.md`.
`packages/shared`, `apps/core-server`, `apps/mobile`, `scripts`, `README.md` were not touched. No
lane call, no lane restart, no browser, no device, no LOCAL_DEVICE source, nothing played aloud, no
install, no secret in this note. Contract totals are untouched (the console only READS two
operations it did not read before: 64 and 38).

## 1. Result in one table (the FINAL state after rounds one, two and three)

| Severity | In the report | Fixed | Not fixed |
|---|---|---|---|
| BLOCKER | 1 | 1 | 0 |
| MAJOR | 8 | 8 | 0 |
| MINOR | 20 | 20 (five of them keep ONE part unchanged, each with its reason: section 2) | 0 |
| NOTE | 21 | 7 whole, 4 in part | 10 (each with its reason: section 3) |
| GM-01, GM-02 | 2 | 2 | 0 |

Checks at the end (section 6): typecheck clean, lint clean (0 warnings), the whole core-web suite
once - 170 files / 2327 tests: 169 files green and ONE file red in the one whole run (4 tests of `test/live-runtime-startup.test.tsx`, caused by this round, fixed); that file and the tests of the two changed readers were run again: green. The whole suite was NOT run a second time (D122).

## 2. Every JW finding, final state

"r1" = round one (note 168, where its file:line and browser proof are), "r2" = J2-S (note 172),
"r3" = this round. Paths are under `apps/core-web/src/`. "Test" names the EXISTING test file that
took the case, unless marked (new).

### BLOCKER, MAJOR, GM

| Id | Sev. | Final state | Where |
|---|---|---|---|
| JW-01 | BLOCKER | fixed r1 | note 168 section 3 |
| JW-02 .. JW-09 | MAJOR | fixed r1 (8 of 8) | note 168 section 3 |
| GM-01, GM-02 | - | fixed r1 | note 168 section 3 |

Round three changed nothing of these; the whole suite (section 6) still holds their tests.

### MINOR

| Id | Final state | Code (file:line) | Test (file:line) |
|---|---|---|---|
| JW-10 | fixed r1 | note 168 | box check of r1 |
| JW-11 | fixed r1 (GM-01) | note 168 | box check of r1 |
| JW-12 | fixed r1. One part NOT REPRODUCED in r1 and not in a test: "segments appear only after Open playback" (r1 saw four segments before the press) - on the re-drive list | note 168 | `features/evidence/__tests__/playback-link.test.ts` |
| JW-13 | **fixed** (r1 block + r2 server + r3): the block reads `item.markers` / `item.notes` BY NAME; the form's note (`origin: 'SESSION_FORM'`) is titled "Note from the session form" and carries NO clock time (its `at` is the creation of the session); two empty lists say "No markers or notes were recorded in this session."; a record that states neither member draws nothing; no snapshot is offered (an item has no such member). The raw custody codes were r1 | `features/evidence/session-annotations.tsx:34` (none), `:54` (form note) | `features/evidence/__tests__/cf-web-custody-media.test.tsx:261` (4 cases with the exported example `EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE`, incl. a control) |
| JW-14 | fixed r1 (a-d). Part (e) UNCHANGED WITH REASON: the ADMINISTRATION group is rendered only with its permission because PG-4 / AC-C-51 specify exactly that (pinned by `test/live-shell-admin.test.tsx`); the page behind it says why when opened by address (r1) | note 168 | note 168 |
| JW-15 | **fixed** r1, was "by code only": now proven - a document restored from the back / forward cache (`pageshow`, `persisted: true`) is reloaded, an ordinary show is not, and the shell installs and removes the guard | `lib/restored-page.ts:10` | `test/routes.test.tsx:306` |
| JW-16 | **fixed** r1, was "by code only": now proven for all five - Revise and Connect and "End Session?" stay open on a press outside and keep what was typed; Escape closes Revise and End Session and answers "Keep editing" on "Discard this session?"; the marker dialog's Cancel adds nothing. Each "stayed open" case first proves that the same press CLOSES a dismissable kit dialog | r1 files | `features/evidence/__tests__/transcript.test.tsx:293`, `features/devices/__tests__/camera-connect.test.tsx:296`, `features/session-monitor/__tests__/session-monitor.test.tsx:298`, `features/session-new/__tests__/session-new.test.tsx:369`; helper `test/press-outside.tsx` + its control `test/press-outside.test.tsx` (new) |
| JW-17 | fixed r1 | note 168 | note 168 |
| JW-18 | fixed r1 | note 168 | box check of r1 |
| JW-19 | **fixed by the ruling of D244**: "Lock console" ends the session; the Login then shows the DISTINCT notice, in exactly the ruled words, "Console locked — sign in to continue" (not the sign-out notice), and the sign-in returns to the page that was locked, filter and all. Part UNCHANGED WITH REASON: a session that stays open while the console is locked needs an operation the contract does not have (D244 ruled the notice instead) | `features/login/login-alert.tsx:194`, key `web.waveJ3.lock.notice`; return: `lib/lock-return.ts`, `components/shell/app-layout.tsx:68` (r1) | `test/live-shell-notices.test.tsx:609` (notice + return + a "Sign out" control), `test/live-login-page.test.tsx` and `features/login/__tests__/login-page.test.tsx` (the two pinned sentences, by delta) |
| JW-20 | **fixed as ruled**: the page names itself a developer diagnostic (r1) and is linked from NO operator navigation - not the sidebar, not the bottom tabs, not any link of a rendered page for any of the three roles, and no production file outside the page and its route names the path. Part UNCHANGED WITH REASON: it stays reachable by address for every role, because 01_specs §14.2 specifies a URL-only diagnostic | `features/stack-check/index.tsx` (r1), `components/shell/nav-items.ts:66` | `test/routes.test.tsx:281` |
| JW-21 | fixed r1 (Alerts page, the bell lists and counts every open alert) + r3 "Acknowledge all" (section 4). Part UNCHANGED WITH REASON: the menu's "Profile" row is not a link because the console has no profile page (the pages are the list of 01_specs §14.2); the row states who is signed in and is drawn as a non-interactive item | r3: `components/shell/use-acknowledge-all.ts:53`, `acknowledge-all.tsx`, `open-alerts.ts:63` | `test/live-shell-notices.test.tsx:124`, `components/shell/__tests__/open-alerts.test.ts:43` |
| JW-22 | fixed r1 (Sessions page) + **r3: the page states WHY a seal was given up** on a quarantined session, from the member `unsealableCause` of operation 38 BY NAME, through the shared reader `unsealableCauseOf(entry, alerts)`. The replicated slice has no column for it, so a Live console whose list holds a quarantined session walks operation 38 once (newest first, pages of 200, until every such session was seen) and lays the member over the slice entry; without the answer the session's alert states it; with neither the row says "The Core states no cause code for this session." | `features/sessions/causes.ts:72`, `model.ts:39`, `index.tsx:168` | `features/sessions/__tests__/model.test.ts:72` (5 cases with `SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE`, controls), `features/sessions/__tests__/page.test.tsx:66` (new: the page had no page test; 4 Live cases) |
| JW-23 | fixed r1; the Core's half is the contract text of J2-S 3 | note 168 | note 168 |
| JW-24 | **fixed** r1, was "by code only": now proven - the step reads "Add the chain head", no step is called "seal", and the result of a built file says it is not signed and not sealed | `features/security-audit/export-audit-dialog.tsx:320`, `:412` | `features/security-audit/__tests__/security-audit.test.tsx:448`, `test/live-security-audit-export.test.tsx:232` |
| JW-25 | fixed r1 | note 168 | note 168 |
| JW-26 | **fixed (web half, r3)** - section 4.1 | section 4.1 | section 4.1 |
| JW-27 | fixed r1 | note 168 | note 168 |
| JW-28 | fixed r1 | note 168 | r1: by code and one browser picture |
| JW-29 | fixed r2 (the README row, by J2-S: note 172 section 5) | `README.md:51` | - |

### What round one's section 6 listed as "not fixed", closed

| Round-one line | Now |
|---|---|
| JW-13 second half (no `markers` / `notes` on a sealed item) | A misreading (note 172 section 1): the Core sent two empty lists. Fixed above; the form's note is kept on new items since r2 |
| JW-19 "is a sign-out" | Ruled (D244): distinct notice + return. Fixed above |
| JW-20 open to every role | Ruled: kept by spec; not linked; says what it is. Fixed above |
| JW-26 five versions | Ruled (D244 / J2-S 2): one version per component. Fixed, section 4.1 |
| JW-29 README | Fixed by J2-S |
| JW-14 (e) | The reason stands (PG-4 / AC-C-51) |

## 3. The NOTES, final state

| Id | Final state | Where / reason |
|---|---|---|
| N-01 | **fixed r3**: the typed password is no longer mirrored into the field's `value` attribute (React writes it for a controlled input; an observer on that one attribute takes it off in the same task). The field's own value is untouched | `features/login/auth-card.tsx:103`; test `features/login/__tests__/login-page.test.tsx:258` (with the user-name field as the control) |
| N-02 | not changed - not a defect: the same "attempts remaining" answer for a user name that does not exist is what keeps the form from telling which names exist; the counter is the Core's | - |
| N-03 | part (r1: a refused page lands inside the shell). The not-found card itself stays outside the shell: an unknown address is answered by the root route, before any guard knows the operator; it links to the Dashboard | - |
| N-04 | not changed - a naming decision for the user ("DEMS EDGE CLIENT"; "tablet" where a phone may be paired). The words are the shared vocabulary of both clients (`packages/shared/src/i18n`, not this driver's) | decision 7 |
| N-05 | web half fixed r1 (no `EVIDENCE_EXPORT` in the wizard). The remaining specification words are sentences of the shared tree (owner: the shared / server driver) | - |
| N-06 | not a defect (the judge: "which is right") | - |
| N-07 | **fixed r3**: the wizard's second step is a check of the operator's OWN role and is worded so - "Role check", "Check my role", "Your role may export" (it read "Authorise", "Request authorisation", "Authorised") | `features/evidence/export-wizard.tsx:188`; test `test/live-evidence-export.test.tsx:110` |
| N-08 | not reproduced (the judge's own doubt). A press on "Retry sealing" sends one request in the existing tests (`features/session-monitor/__tests__/unsealable-notice.test.tsx`, `test/live-session-monitor-actions.test.tsx`). On the re-drive list | - |
| N-09 | Core fact: whether a failed seal attempt writes an audit row is the server's; the Monitor lists the rows it is sent | owner: server |
| N-10 | third part fixed r1. "retry 2 of 3, in 30 s" is the Core's own sentence with a delay, not an instant (no member says WHEN the next attempt runs), so the console cannot count it down without inventing a clock; the evidence id shown before the item exists is the id the Core assigned to the session | owner: server (a `nextAttemptAt` member) |
| N-11 | fourth part fixed r1. "Pause Monitoring" and "Re-verify" DO draw an answer in code ("Monitoring paused. Recording continues." on feed and meters; the chip "N rows verified", held by `test/live-session-monitor-panels.test.tsx`) - not reproduced without a browser, on the re-drive list. "Make primary" at rest is a reversible selector change said by its toast; the Monitor's switch asks first because it changes a recording under way | - |
| N-12 | Core facts: "to 1:48" is the media time of the audio interval, "00:01:47" the session's duration; both are floored the same way by the console (`formatMediaTime`, `formatDuration`). The sealed Monitor's timeline is the list the Core keeps | owner: server |
| N-13 | **fixed r3**: the operator counts segments from 1 ("Revise segment 2" for index 1; the request keeps the index). The raw JSON of the Metadata tab is the tab's purpose ("The Core server's record of this item") | `features/evidence/transcript-model.ts:270`; test `features/evidence/__tests__/transcript.test.tsx:260` |
| N-14 | by the user's rule: the Core lists this Mac's devices; no agent selects them (D163). Not a console defect | - |
| N-15 | **fixed r3** for the console's part: the online state is also a WORD beside the dot. The two names "sdk_gphone64_arm64" are the emulators' own (dev-lane artefact) | `features/paired-devices/devices-panel.tsx:258`; test `test/live-paired-devices-list.test.tsx:137` |
| N-16 | not changed: both sentences are true on a simulated Core (searching connects to nothing; this Core has no search). The picker cannot disable "the other track's camera": the Core allows one camera on two tracks with different profiles and refuses only the same profile (`packages/shared/src/sim/capture-config.ts:58`) - the refusal has its sentence | - |
| N-17 | fixed r1 | note 168 |
| N-18 | a decision: one integrity-stop rule for web, tablet and the simulated lane | decision 7 |
| N-19 | **fixed r3** (the console's part): a transcript whose last segment ends 30 s or more before the recording does says so with both times ("The last transcribed segment ends at 0:16. The recording runs 2:02: this transcript has no text after 0:16."). It states no cause. That MIC-02 carries no speech fixture is a dev-lane artefact | `features/evidence/transcript-model.ts:285`, `transcript-pane.tsx:216`; test `features/evidence/__tests__/transcript.test.tsx:260` |
| N-20 | third part fixed r1. The count-up, the ring's fade and the rolling clock are the motion specification (03_motion_spec); the clock's text is one "hh:mm:ss" for assistive technology (`test/routes.test.tsx`, `top-bar-clock`) | - |
| N-21 | no defect (no script error in any flow) | - |

## 4. What was built in round three

### 4.1 JW-26 - ONE version per component (contract J2-S 2)

The rule is ONE place: `lib/product-versions.ts:68` `productVersionsOf` (pure) and `:107`
`useSystemComponents`. The console's own version is ONE constant: `version.ts:8`
`WEB_CONSOLE_VERSION`, held equal to `package.json` by `lib/__tests__/product-versions.test.ts` (new
module, its own file).

- **The console now CALLS operation 64** (`getSystemStatus`) - no client did. It is read only where
  its answer is shown: a Live console, signed in, link up, on a Core in its OWN capture
  (`isOwnCaptureCoreState`). One read per page load serves every surface. The members are read BY
  NAME: `components.core.version`, `components.captureWorker?.version`, `components.apiContract.version`.
- On such a Core NO surface shows the model's `2.4.1` / `2.5.0` as the real thing. A surface asks
  `modelVersion`, gets `null` and draws the named components instead:

| Surface | On a Core in its own capture | Code |
|---|---|---|
| System > About | a block "Software components": Core server, Capture worker (only when stated), API contract, Web console; the summary's "Software release" row, the SBOM's release row and the drift check (three model fields) are not drawn; identity "Core software" = the Core's statement; "Tablet app" = "Each paired device states its own app version: see Paired Devices" | `features/system/about-panel.tsx:92` |
| System > Settings > About | "Core server 0.2.0 · Web console 0.1.0 · <device id>" | `features/system/settings-panel.tsx:294` |
| Sidebar footer | "Web console 0.1.0" / "Core server 0.2.0" (it read "v2.4.1") | `components/shell/sidebar.tsx:286` |
| Header, device tooltip | the component lines (it read "Serial ... Firmware v2.4.1 ... Build ...", three model values) | `components/shell/top-bar.tsx:211` |
| Devices, front-panel drawer "Firmware" | "Not reported" | `features/devices/device-drawer.tsx:527` |
| Devices, front-panel LCD | "FW NOT REPORTED" | `features/devices/lcd-display.tsx:222` |
| Log export file | `softwareVersion` = the Core's (or `not-reported`), plus `components` | `features/system/export-logs-dialog.tsx`, `live-log-export.ts` |
| System banner ("17 of 17 running · v2.4.1 · slot A"), the SBOM's build id | UNCHANGED, under the "Synthetic demo values" chip the block already carries (client rule 3 allows exactly that) | `features/system/status-banner.tsx:62` |
| Update card | nothing: a Core without an updater draws no version (r1) | `features/system/update-panel.tsx` |
| Security controls, "Signed firmware" | "This Core reports no firmware signature." (wave K) | - |

- A Core that answers WITHOUT `components` (an older Core - **both lanes until they are restarted**),
  or a refused read: the Core's rows read "Not reported", never a model value; a failed read writes
  ONE record (`ProductVersions.getSystemStatus`), no toast.
- **Login**: before a sign-in a Live console cannot know which Core answers, so its footer states
  only what is its own - "Web console 0.1.0" - and the strip above states the Core's (operation 1).
  `features/login/index.tsx:194`. The in-app simulator keeps "v2.4.1" (it IS the demonstration).
- **SIMULATED lane: unchanged and pinned.** Operation 64 is not asked; About, banner, update card,
  drift check, Settings and the sidebar footer read v2.4.1 as before.

Tests (with the exported example `SYSTEM_COMPONENTS_EXAMPLE`):
`test/live-system-settings.test.tsx:117` - five cases: the own-capture page (one GET; the four rows
by name; the rule over the whole document: every element whose text holds 2.4.1 or 2.5.0 is inside
a block that carries the chip); no capture worker stated; an older Core; a refused read; the
SIMULATED control. `test/live-login-page.test.tsx:410`; `test/real-core-facts.test.tsx:882` (+ its
simulated control); `lib/__tests__/product-versions.test.ts`.

### 4.2 The bell's "Acknowledge all" (the web's side of "84 new alerts")

`components/shell/open-alerts.ts:63` `acknowledgeAllPlan` (pure), `use-acknowledge-all.ts:53` (state
and run), `acknowledge-all.tsx` (button and confirmation), on the bell
(`notifications-bell.tsx:86`) and on the Alerts page (`features/alerts/index.tsx:47`).

- Offered to EVERY signed-in role (operation 70 is open to all of them), from two alerts on.
- One press opens a confirmation that NAMES THE COUNT ("Acknowledge 84 alerts?"), says the faults
  behind them are not cleared, and says what happens to the notices of recordings that could not be
  sealed. Cancel sends nothing.
- Confirm: ONE request per alert through the existing operation 70, one after the other, oldest
  first; the control reads "Acknowledging n of N". No new operation.
- "All" = every unacknowledged alert, the ones the Core resolved INCLUDED. UNSEALABLE notices are
  in "all" only for a role that holds the review permission (`canResolveUnsealable`: its
  acknowledgement closes them and writes the audit row - the confirmation says so); for every other
  role they are left out and the confirmation says a supervisor closes them.
- A refused acknowledgement STOPS the run: the presenter words the cause, one record goes to the
  console's log, a toast says "n of N alerts acknowledged. The rest is unchanged." - never "all".
- The ids are fixed at the press: what the confirmation names is what is sent.
- The state lives in the bell, not in its popover (which closes when the confirmation opens).

Tests: `components/shell/__tests__/open-alerts.test.ts:43` (4 cases, incl. the backlog of 84);
`test/live-shell-notices.test.tsx:124` (4 Live cases: an investigator - count, confirmation text,
three POSTs in order, the notice left; a supervisor - the notice in "all" and the "closes it"
sentence; Cancel and a run stopped by a refusal; the one-alert control).

### 4.3 The audit table at 1280

A VISIBLE CUE, not a fit: `lib/sideways-scroll.ts:23` `useSidewaysMore`,
`features/security-audit/audit-log-panel.tsx:644`, `security-audit.css:653`. When the table is wider
than its card it says on which side its other columns are ("More columns to the right: scroll the
table sideways", an arrow, and a gold edge on that side of the table); it follows the scroll (right
-> both -> left) and is not drawn when the table fits. Test:
`features/security-audit/__tests__/security-audit.test.tsx:378` (jsdom has no layout: the widths
1144 / 1008 are given to the element; with its fits-control and the one-pixel tolerance).
**Why not "fit":** the seven columns have fixed widths that sum to 1144 px; fitting them into
1008 px means narrowing cells whose text the rule of round one forbids to cut, and without a browser
I cannot measure which text still fits. The cue is deterministic; the fit is a job for a driver with
a browser (decision 5).

### 4.4 Test harness

`runtime/testing/live-harness.ts:412` answers operation 64 (the served slices + the contract's
`components`, with the capture worker only when the served state is a Core in its own capture) and
`:431` operation 38 (the served history in one page), so a Live test that opens such a page finds
what a model Core holds.

## 5. What is proven how

**Everything of this round is proven BY TEST ONLY.** No lane was called, none restarted, no browser
was driven, no device touched (the brief: a mobile driver holds both devices; the lanes run older
server code). Nothing here was seen on a screen. In particular:

- NOT seen in a browser: the look of the "Software components" block, of the two footer lines in the
  sidebar, of "Acknowledge all" in the bell popover and its dialog, of the sideways cue and its edge,
  of the form-note line, of the cause line on the Sessions page, of the online word, of the
  transcript's tail note. Their text, their presence and their absence are tested; their geometry
  (cut text, overlap at 1280 / 1440 / 1920) is NOT - the box check of round one must be run again.
- By code only, no test: the header's device tooltip on a Core in its own capture
  (`components/shell/top-bar.tsx:211`), the front-panel drawer's "Not reported"
  (`device-drawer.tsx:527`) and the LCD line (an SVG; the Devices page test asserts that no "v2.4.1"
  is in the document), the log export file's `components` member.
- Against the REAL Core nothing was run: operation 64's `components` and operation 38's
  `unsealableCause` exist only after the lanes are restarted with the code of J2-S; the tests use
  the exported examples on the contract-checked fake transport. "Acknowledge all" was not run
  against the Core's request limit (84 requests in a row): if the Core limits them, the run stops
  with "n of N" and a second press continues - by test for a scripted 429, not live.

## 6. Checks

| Check | Command | Result |
|---|---|---|
| typecheck | `npm run -s typecheck -w apps/core-web` | clean (after the last edit) |
| lint | `npm run -s lint -w apps/core-web` | clean, 0 warnings (after the last edit) |
| whole suite, ONE run (started 10:35:41, 1-minute load 5.88 at its start; 31.8 at its end - other agents) | `npm test -w apps/core-web` | **170 files: 169 passed, 1 failed; 2327 tests: 2323 passed, 4 failed** (89 s). The failed file: `src/test/live-runtime-startup.test.tsx`, four tests of AC-C-106 ("after a session end the page's query cache holds no Core entry") |
| the cause, and the fix | - | MINE: the two new readers (`lib/product-versions.ts`, `features/sessions/causes.ts`) used a disabled `useQuery`; a disabled observer still puts an entry under `['core', ...]` into the cache, and the shell (sidebar, header) mounts one on every page. Both readers now mount NO observer while their gate is closed (`useQueries` over an empty list). No test was changed for it |
| second run, only what failed + the tests of the two changed readers (load 14) | `npx vitest run --root apps/core-web src/test/live-runtime-startup.test.tsx src/test/live-system-settings.test.tsx src/features/sessions src/lib/__tests__ src/test/real-core-facts.test.tsx` | **14 files, 262 tests passed** |

**Not proven: a whole run on the tree as delivered.** The one whole run was on the tree BEFORE the
two-file fix of the readers; after it only the 14 files above were run (D122: a second run only of
what failed). **Check for the test runner: `npm test -w apps/core-web` once more on a quiet host**
(expected: 170 files, 2327 tests, 0 failed).

New test files of this round (each
named after its module or page, none per wave): `lib/__tests__/product-versions.test.ts` (new
module), `features/sessions/__tests__/page.test.tsx` (the Sessions page had only a model test),
`test/press-outside.test.tsx` (the control of the helper `test/press-outside.tsx`). Every other
case went into the existing test file of its feature.

## 7. Files changed (round three)

- New: `src/version.ts`, `src/lib/product-versions.ts`, `src/lib/sideways-scroll.ts`,
  `src/components/component-versions.tsx`, `src/components/component-version-text.ts`,
  `src/components/shell/acknowledge-all.tsx`, `src/components/shell/use-acknowledge-all.ts`,
  `src/features/sessions/causes.ts`; tests `src/lib/__tests__/product-versions.test.ts`,
  `src/features/sessions/__tests__/page.test.tsx`, `src/test/press-outside.tsx`,
  `src/test/press-outside.test.tsx`.
- Edited (production): `src/i18n-web.ts` (block `web.waveJ3`, appended), `src/lib/core-queries.ts`
  (two operation names), `src/lib/lock-return.ts` (comment), `src/components/shell/{sidebar,top-bar,
  notifications-bell}.tsx`, `open-alerts.ts`, `shell.css`, `src/features/login/{index,auth-card,
  login-alert}.tsx`, `src/features/system/{about-panel,settings-panel,export-logs-dialog}.tsx`,
  `live-log-export.ts`, `src/features/devices/{device-drawer,lcd-display}.tsx`,
  `src/features/evidence/{session-annotations,transcript-pane,transcript-revise-dialog,
  export-wizard,detail-page}.tsx`, `transcript-model.ts`, `src/features/sessions/{index.tsx,model.ts,
  sessions.css}`, `src/features/alerts/index.tsx`, `src/features/security-audit/{audit-log-panel.tsx,
  security-audit.css}`, `src/features/paired-devices/{devices-panel.tsx,paired-devices.css}`,
  `src/runtime/testing/live-harness.ts` (two default answers).
- Edited (existing tests, by delta): `src/test/{live-system-settings,live-login-page,real-core-facts,
  live-shell-notices,live-shell-admin,routes,live-security-audit-export,live-evidence-export,
  live-paired-devices-list}.test.tsx`, `src/features/evidence/__tests__/{cf-web-custody-media,
  transcript}.test.tsx`, `src/features/sessions/__tests__/model.test.ts`,
  `src/features/login/__tests__/login-page.test.tsx`,
  `src/features/security-audit/__tests__/security-audit.test.tsx`,
  `src/features/devices/__tests__/camera-connect.test.tsx`,
  `src/features/session-monitor/__tests__/session-monitor.test.tsx`,
  `src/features/session-new/__tests__/session-new.test.tsx`,
  `src/components/shell/__tests__/open-alerts.test.ts`.
- Docs: this note; one claim line in `delegation_progress/file_claims.md`;
  `delegation_progress/coder-execution_wave_j3_w.md`.

Two pins were moved because the product changed, not weakened: the Lock notice's sentence (two
tests, the ruled words) and the list of shell files that call an action
(`test/live-shell-admin.test.tsx:674`, + `use-acknowledge-all.ts`).

## 8. Seen, not changed

- The shared sentence `login.notices.consoleLocked` ("Console locked. Sign in again to continue.")
  is no longer read by the web console (it reads `web.waveJ3.lock.notice`); it stays in the shared
  tree for whoever still reads it.
- The Live log export file still carries `demo: true` and "synthetic demo data" in its notice on a
  Core in its own capture (`features/system/live-log-export.ts`): a statement about the Core's data
  that is not true there. Not a JW finding; one line for the next pass.
- On the SIMULATED lane after the demo update the sidebar reads v2.4.1 and the System page v2.5.0
  (the model's own two values; the lane is pinned unchanged by the brief).
- Markers and notes travel with the item to every role that may read it (note 172, decision 5): the
  block shows what the Core sends.

## 9. Decisions for the controller

1. **The Login footer of a Live console reads "Web console 0.1.0" on BOTH lanes** (it read
   "v2.4.1"): before a sign-in the console cannot tell a simulated Core from a real one, and showing
   the model's number on a real Core's Login would break client rule 3. This is the one visible
   change on the SIMULATED lane (contract J2-S 2, client rule 5). The in-app simulator is unchanged.
2. **Both lanes must be restarted** before the confirmation judge sees the Core's versions, the
   cause on the Sessions page and the form's note (the code of J2-S). The web dev servers serve this
   round's web code at once; against the OLD Core the component rows read "Not reported" and the
   quarantined rows read the cause only from their alert.
3. Operation 64 is read only on a Core in its own capture; operation 38 only when the Sessions page
   lists a quarantined session. Both are reads every signed-in role may make.
4. "Acknowledge all": from two alerts; a reviewing role's "all" CLOSES the unsealable notices (the
   confirmation says so and counts them); requests go one after the other and the run stops at the
   first refusal. If the user wants the notices never swept up by "all", it is one line
   (`acknowledgeAllPlan`).
5. The audit table got the CUE, not the fit (no browser to measure text). A fit needs a driver with
   a browser: the widths are `COLUMNS` in `features/security-audit/audit-log-panel.tsx:89`.
6. The password field's `value` attribute is removed by an observer (N-01); the proper form is an
   uncontrolled field as in the camera Connect dialog - a rework of the login controller, not done.
7. For the user, unchanged: N-04 (the console's name; "tablet" where a phone may be paired), N-18
   (one integrity-stop rule for all three surfaces), a true locked state for "Lock console" (a
   contract operation), whether the console and the app should carry the Core's number (note 172).
8. For the server (not web): N-09 (an audit row per failed seal attempt), N-10 (a member that says
   when the next seal attempt runs), N-12 (two lengths of one recording).

## 10. Re-drive list for the confirmation judge (after the lane restart; nothing of it was seen live)

1. L2, any role: System > About - "Software components" = Core server 0.2.0, Capture worker
   capture-worker/0.5.0, API contract 0.3.0, Web console 0.1.0; no "v2.4.1" outside a block with
   the "Synthetic demo values" chip; sidebar footer two lines; hover the device block in the header;
   Devices > front panel drawer and LCD. L1: the same pages read v2.4.1 as before, no component
   block. Both lanes signed out: the Login footer "Web console 0.1.0", the strip "dems-core-server 0.2.0".
2. L2: a 45-60 s recording on the FAKE sources with a form note, one marker, one note, one
   snapshot; the item's Media tab: "Markers and notes of the session" with "Note from the session
   form" first, the marker's time pressable, no snapshot. An older item without annotations: "No
   markers or notes were recorded in this session." `EV-20261011-0060`: its marker and its note.
3. L2: Sessions page - each of the four quarantined rows states "Why it could not be sealed (the
   code the Core recorded): ...".
4. Either lane: user menu > Lock console on a page with a filter in the address -> Login with
   "Console locked — sign in to continue" -> sign in -> the same page. Then Sign out: the other notice.
5. L2 (84 open alerts): bell > "Acknowledge all (n)" as an investigator - the confirmation names the
   count and the notices left; confirm; watch "n of N", the toast, the badge. As a supervisor: the
   notices are in "all". Note whether the Core's request limit stops the run. Alerts page: the same control.
6. L2 at 1280x800: Security & Audit - the audit table shows "More columns to the right: scroll the
   table sideways" and the gold edge; scroll it; at 1920 no cue. BOX CHECK at 1280 / 1440 / 1920 on
   System, Sessions, Alerts, an evidence item, Paired Devices, Security & Audit and the bell popover
   (new text everywhere).
7. `/stack-check` by address as each role: opens, says "Developer diagnostic"; no link to it anywhere.
8. After Sign out: browser Back on API Reference (JW-15). Revise / Connect / End Session: a click
   outside keeps the dialog; Escape on "Discard this session?" (JW-16).
9. Export wizard step 2: "Role check" / "Check my role" / "Your role may export". Transcript: the
   dialog of the fourth segment reads "Revise segment 4"; `EV-20261011-0060`: the tail note "ends at
   0:16 ... runs 2:02". Paired Devices: "Online" / "Offline" beside the dot. Login: the password
   field has no `value` attribute while typing.
10. Not reproduced by test, worth one look: N-08 (the first press on "Retry sealing"), N-11 (what
    "Pause Monitoring" and "Re-verify" show on lane 2), JW-12 (segments before "Open playback").

---
*Generated: 2026-10-12 WIB*
