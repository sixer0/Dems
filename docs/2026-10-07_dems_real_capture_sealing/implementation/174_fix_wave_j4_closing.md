---
task: 2026-10-07_dems_real_capture_sealing
row: fix wave J, closing pass J4 - seven controller rulings across packages/shared, apps/core-server (test only), apps/core-web, apps/mobile
date: 2026-10-12
agent: coder-execution
tree: commit 035150b + the uncommitted fix wave J
status: complete (items 1-6 changed and tested; item 7 checked, no change needed)
---

# Fix wave J - closing pass J4

Conditions of this pass: the user was trying the product by hand on both lanes and both emulators.
No lane was called, restarted or stopped; no device, no adb, no browser, no rig; no git write. Only
single test files were run, one at a time, host load 1.9 - 2.6 at each start. Nothing below was SEEN
live: every claim is a test or a reading of the code, and says which.

## 1. Per item

### Item 1 - "Acknowledge all" never sweeps up an unsealable notice (done)

| | |
|---|---|
| Rule | `apps/core-web/src/components/shell/open-alerts.ts:61` `acknowledgeAllPlan(alerts)`: an UNSEALABLE notice is in "all" for NO role. The function no longer takes a role (so no role can change the answer) and the plan no longer has `closedNotices`; `leftNotices` counts the notices that are still open (active, or not acknowledged). |
| Caller | `components/shell/use-acknowledge-all.ts:58` (the role selector is gone). |
| Confirmation | `components/shell/acknowledge-all.tsx:34`: the count in the title, the body and the button as before; the "your acknowledgement closes it" paragraph is removed; the "left" paragraph is drawn for every role. Words `i18n-web.ts:545`: "N notices of recordings that could not be sealed (kept in quarantine) are not included. They are left for individual acknowledgement, each on its own row." (`confirmClosed_*` removed). |
| Tests | `components/shell/__tests__/open-alerts.test.ts:61` (never in "all"; arity 1; CONTROL: the same alert without the notice's mark IS in "all"; only-notices case). `test/live-shell-notices.test.tsx:175`: REPLACES round three's supervisor case - a supervisor gets count 3, the same "left" sentence, no "closes", three POSTs, the notice id not sent, and the notice's own row control is still there. The investigator case pins the new sentence. |

Unchanged on purpose: the notice's own row (`notifications-bell.tsx` `UnsealableNoticeRow`) - that is
where it is acknowledged, one by one.

### Item 2 - one lock sentence, in the shared key (done)

| | |
|---|---|
| Shared | `packages/shared/src/i18n/en/login.ts:85` `login.notices.consoleLocked` = "Console locked — sign in to continue". |
| Web | `apps/core-web/src/features/login/login-alert.tsx:194` reads the shared key; `web.waveJ3.lock` removed from `i18n-web.ts`. |
| Mobile | `apps/mobile/src/features/login/login-card.tsx:513` already read the shared key (the mobile driver had no copy of its own; it shipped the OLD shared sentence). No source change: the new words arrive through the key. |
| Tests | shared `test/i18n.test.ts:228` pins the ruled words, and that no other shared text says "console locked". Web pins THE KEY: `test/live-shell-notices.test.tsx:627`, `test/live-login-page.test.tsx:591`, `features/login/__tests__/login-page.test.tsx:391`. Mobile `features/login/login.test.tsx:337` pins the key (plus the ruled words once). |

### Item 3 - the Live log export of a Core in its own capture states what it is (done)

| | |
|---|---|
| Builder | `apps/core-web/src/features/system/live-log-export.ts:153`: new input `ownCapture`. True: NO `demo` member, notice `LOG_EXPORT_NOTICE_OWN_CAPTURE` (`:133`): "Log export of this DEMS Core server: the audit chain and the events this Core recorded, read from every page of both lists; services and diagnostics as this Core reported them to the console." Absent / false: `demo: true` and the old sentence, word for word (`LOG_EXPORT_NOTICE_DEMO`). `LogExportFile.demo` is now optional. |
| Caller | `features/system/export-logs-dialog.tsx:113`: `ownCapture: versions.ownCore` (the one reader `isOwnCaptureCoreState`, through `useSystemComponents`). |
| Tests | `test/live-system-export.test.tsx:295`: a Live case on a Core that states `time.hostClock` - the downloaded file has no `demo` key, its notice matches no /demo|simulat|synthetic/, the rows / events are the Core's, `components` is there; a builder case (the flag changes the two members and nothing else). The existing A8 case now also pins the simulated lane's `demo: true` and its sentence (control). |

Not touched: the SIMULATED-mode export (`demo: true`, "DEMO - simulated log export ..."), the
diagnostics download (`features/system/diagnostics.tsx:137`) and the evidence export download
(`features/evidence/export-download.ts:169`) - both still write `demo: true`; they were not in the
ruling. See decision 2.

### Item 4 - the blocked-seal sentence names the devices' control too (done; live only after a lane restart)

| | |
|---|---|
| Sentence | `packages/shared/src/sim/seal-blocked.ts:70` `SEAL_RETRY_HOW_SENTENCE` = `an investigator or a supervisor presses "Retry sealing" on the Session Monitor of the web console or on the session's screen of the tablet or phone, or the Core is restarted.` The example alert both clients test against carries it (`:228`). `apps/core-server/src/sealing/pipeline/way-out.ts` was NOT edited: its nine hints end with the shared constant. |
| Bound | `SEAL_BLOCKED_MESSAGE_MAX` stays 600: `way-out.test.ts` case "5. every notice fits the door" and the per-cause loop pass with the longer sentence. |
| Tests | server `src/sealing/__tests__/way-out.test.ts:668` (exact sentence, control against the old tail, example alert); shared `test/sim-seal-blocked-unsealable.test.ts:73`; web `test/selector-in-force.test.tsx:370`; mobile `features/session-finalizing/session-finalizing-screen.test.tsx:433` (the Finalizing notice, on tablet and phone, shows the Core's sentence with "on the session's screen of the tablet or phone"). |

NEEDS A LANE RESTART TO BE SEEN: the alert's text is written by the Core when the seal becomes
blocked. Both running Cores booted with the old sentence and keep it until their next start; an alert
already stored keeps its text for good. The clients draw the Core's sentence as sent, so no client
shows the new words before that. Not restarted.

Two comments still quote the old sentence as history and were left:
`apps/core-server/src/engine/sealing-notice-doors.ts:120`, `apps/mobile/src/features/session-finalizing/seal-attention.tsx:18`.

### Item 5 - tablet bell and account menu in the sheet form (done; not seen on the tablet)

| | |
|---|---|
| Change | `apps/mobile/src/features/dashboard/home-header.tsx:97`: `AlertsBell` (`:199`) and `AccountMenu` (`:327`) have ONE form in every layout class - the `SheetFrame` the phone uses. The kit `Popover` / `Menu` branches, the `sheet` prop and two unused styles are removed. |
| Test | `features/dashboard/dashboard-screen.test.tsx:319`, on `tabletLandscape` and `tabletPortrait`: the bell's sheet is drawn and no popover; the content sits under a view marked `accessibilityViewIsModal` with no opaque accessible host node above it on the way; title, alert row, a named "Acknowledge", the link and a labelled Close; the acknowledge still works. Account: name, three labelled buttons, the lock sentence, the kit Menu's item text absent, Lock console ends the sign-in. |
| Harness | `features/dashboard/session-start-home.test.tsx:36` now mocks the sheet library the way `dashboard-screen.test.tsx` does: its bell case runs on the tablet window and opened a Popover before; the real sheet library cannot run under jest. No assertion of that file changed. |

What the test does NOT prove: that the Android accessibility tree of the tablet holds the nodes (the
phone's proof was a `uiautomator dump`, note 171), and how a bottom sheet looks at 1280 x 800. The
Settings sheets already use this frame on the tablet. See the re-drive list.

### Item 6 - JT-17 has its test; the code was right (done, no source change)

`apps/mobile/src/features/evidence/sealed-player.test.tsx`:
- `:869` - a player error on a session that has not ended (how a refused, tampered fragment reaches the
  player; the event of G94b-10), then the action bar's Play: no `play()` on either player, no position
  written, no new media session, the stop sentence and "Play" label stay, the view is scrolled to the
  player although the operator had scrolled away; a second press the same; "Open again" asks for the
  sessions.
- `:904` CONTROL - after a plain Pause the action bar's Play starts both players.
- `:914` - Play at the END of the recording writes 0 to both players, plays, and the time reads 0:00.

Code under test: `sealed-player.tsx:501` (the guard) and `:346` (restart from the start). All three
passed against the code as it was. NOT mutation-proven: removing the guard to see the test fail would
have hot-reloaded a broken player into the tablet the user was using; by reading, without the guard
`play()` is called and the first `toEqual(before.plays)` fails. The stop drawn in the test is the
"position" form; the "integrity" form (a FAIL of record on the item) differs only in its sentence
(`verifiedFailure`), not in the guard.

### Item 7 - End Session gesture (checked; no change)

The hold already has its on-screen hint: `apps/mobile/src/features/session-live/end-session.tsx:211`
draws `session.actions.endSession.holdHint` = "Hold to end the session"
(`packages/shared/src/i18n/en/session.ts:253`) under the button whenever motion is full and the
button is not blocked; a short tap turns it into the assertive "nudge". Pinned by
`features/session-live/session-live-screen.test.tsx:216`. Under reduced motion the control is a tap
and shows no hold hint - as the motion spec says.

## 2. Checks run (once each; a second run only after a failure)

| Check | Result |
|---|---|
| web `components/shell/__tests__/open-alerts.test.ts` | 8 passed |
| web `test/live-shell-notices.test.tsx` | first run 1 failed (MY new assertion looked for the wrong test id of the notice's row control), second 28 passed |
| web `test/live-login-page.test.tsx` | 32 passed |
| web `features/login/__tests__/login-page.test.tsx` | 18 passed |
| web `test/selector-in-force.test.tsx` | 24 passed |
| web `test/live-system-export.test.tsx` | 15 passed |
| shared `test/i18n.test.ts` | 15 passed |
| shared `test/sim-seal-blocked-unsealable.test.ts` | 23 passed |
| server (unit project) `src/sealing/__tests__/way-out.test.ts` | 31 passed |
| mobile `features/dashboard/dashboard-screen.test.tsx` | 19 passed |
| mobile `features/evidence/sealed-player.test.tsx` | first run 1 failed (my assertion expected ONE scroll; the press and the player each ask: two, both to the player), second 45 passed |
| mobile `features/login/login.test.tsx` | 25 passed |
| mobile `features/session-finalizing/session-finalizing-screen.test.tsx` | 25 passed |
| mobile `features/dashboard/session-start-home.test.tsx` (reads the changed header) | first run 1 failed (the real sheet library under jest - see item 5), second 26 passed |
| mobile `features/dashboard/{home-live,home-notice-tiles}.test.tsx`, `home-more-live-static.test.ts` (read the changed header; not edited) | 21, 19, 8 passed |
| typecheck + lint: packages/shared, apps/core-server, apps/core-web, apps/mobile | all eight exit 0, no output |

Totals 97 operations / 36 GET / 61 POST / 67 audit types and schema 6: no operation, schema, audit
type or contract member was added or changed (two sentences, one web-only file member made optional).

## 3. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm run -s test -w packages/shared` | - | green (the two sentences are read by many suites) |
| `npm run -s test -w apps/core-server` (unit project) | - | the baseline of the wave; nothing new from `way-out.test.ts` |
| `npm run -s test -w apps/core-web` | - | green; watch for any other pin of "Acknowledge all" or of the lock sentence I did not find by search |
| `npm run -s test -w apps/mobile` | heavy-host; both apps idle | green; watch every file that opens the Home bell or avatar on a tablet window without the sheet-library mock (I found and fixed one; search `home-bell` / `home-avatar` found four files, all run) |
| db project of the Core | `.locks/db-migrate.lock` | unchanged by this pass (no server source edited) |

## 4. Re-drive list for the confirmation judge

1. Web, lane 2, as a supervisor with an open unsealable notice and two other alerts: bell >
   "Acknowledge all (n)" - n does not count the notice, the dialog names the notices left, after the
   run the notice is still open with its own "Acknowledge".
2. Web and both devices: "Lock console" - the Login reads "Console locked — sign in to continue".
3. Web, lane 2: System > Export logs - the file has no `demo` member and its notice says it is this
   Core's record; lane 1: `demo: true` and the DEMO sentence.
4. AFTER A LANE RESTART, lane 2 with the seal rig blocked: the alert on web, tablet and phone names
   the web console's Session Monitor AND the session's screen of the tablet or phone.
5. Tablet (normal launch form), Home: the bell and the avatar open a sheet; TalkBack / `uiautomator
   dump` reads "Latest alerts", each alert, its "Acknowledge: ...", "View all events", "Close", and the
   account's name, role, three buttons; Back closes it without leaving the app. Judge the look of a
   bottom sheet on the tablet's Home (decision 1).
6. Tablet, tampered item: Play, wait for the integrity stop, press the action bar's Play - nothing
   restarts, the stop sentence is in view (item 6 is proven by test only).

## 5. Decisions for the controller

1. Item 5 removes the tablet's anchored popover and menu altogether (one form, no dead branch). If the
   bottom sheet reads badly on the 1280-wide Home, the alternative is a centred kit `Dialog` for the
   wide classes - a design choice I did not make blind.
2. Two other downloads of a Live console still write `demo: true` on a Core in its own capture: the
   diagnostics report (`features/system/diagnostics.tsx:137`) and the evidence export file
   (`features/evidence/export-download.ts:169`). Not in the ruling, not changed; the same rule would
   apply to them.
3. The own-capture notice says "services and diagnostics as this Core reported them to the console":
   those two members come from the console's replica of the Core's state, not from a page walk. If a
   real-capture Core's diagnostics are "not reported" (D244), the file carries what the replica holds.
4. The file-claims line of this pass was written at its end, not before the first edit.

## 6. State left

Source edits hot-reloaded into the running web consoles and apps as they were saved (each file whole;
readers before callers). Visible to the user at once: items 1, 2, 3, 5. Item 4 after a Core restart.
No lane, device, browser or database was touched; no temporary file left in the tree.

---
*Generated: 2026-10-12 11:36 WIB*
