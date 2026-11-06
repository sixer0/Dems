---
task_id: 2026-10-07_dems_real_capture_sealing
pass: D7 (client shell / recovery seams after rows 87, 92, 139)
date: 2026-10-10
agent: coder-execution
status: needs-review
---

# Integration pass D7 — failed start on mobile recovery, MB-06 in place, session-start wording on the shells, two Monitor leftovers

Status **needs-review**: all five items are built and their tests are green; nothing was run on a
device or in a browser, and situation C cannot be produced by the simulator (every test puts
`captureDurable` / the alert on the store as the Core sends them). Baseline `e296ce7` + wave D tree.
No commit, no migration, no new dependency, no new shared word. Each check ran once after its last
change (D122).

## 1. What was built

| Item | Where | What it does |
|---|---|---|
| 1 Mobile failed start | `apps/mobile/src/features/session-recovery/session-recovery-screen.tsx:140` (latch by session id), `:194` (branch), `:493` `FailedStartCard`, `:150` (Home after the close) | `FAULT` + explicit `captureDurable: false`: row 139's `FailedStartNotice` (title from `params.reason`, generic otherwise), the Devices pointer (`/devices`), "Close session" (the Core's recovery, the runtime's pending control, role reason under it). No "Session recovery" title, ring, pipeline, track rows, outcome card or evidence link. Held while the Core closes the session, then Home. A durable FAULT, and a session without the member, keep the recovery screen |
| 2 MB-06 | `apps/mobile/src/app/(app)/session/recovery.tsx:28-40` | A session this route showed in FAULT / RECOVERY that turns FINALIZING: `<SessionFinalizingScreen handover />` in the commit that drops the recovery view, then `<Redirect>`; `LayoutAnimationConfig skipExiting` as `live.tsx`. A deep link while another session finalizes keeps the screen's own notice |
| 3 Mobile Home tiles | `features/dashboard/system-status-card.tsx:58,107,165` | Connecting: title "Connecting cameras…", session id, no REC chip, no timer, neutral ring reading CONNECTING. Failed start: subtitle "No camera connected. Nothing was recorded." |
| 3 Mobile bell | `features/dashboard/home-model.ts:184` `failedStartAlertLabel`, `home-header.tsx:239` | `CAPTURE_FAULT` with `params.reason: NO_CAMERA_CONNECTED` -> "No camera connected. Nothing was recorded."; an active one without a cause while the open session is a failed start -> the generic sentence. The degraded camera was already named (row 138) |
| 3 Mobile bottom bar | `components/composed/nav/live-mini-bar.tsx:72,88,113` | "Connecting cameras…", no REC dot, no timer |
| 3 Mobile Sessions hub | `features/sessions/hub-top.tsx:71-82`, `session-status-chip.tsx:31`, `session-row.tsx:62` | Card and row: "Connecting cameras…", no REC dot / LIVE badge / timer. Failed start: the sentence in full, action "View details" (not "Open recovery") |
| 3 Web alert centre | `components/shell/failed-start-alert.ts` (new), `notifications-bell.tsx:84-89` | Same rule as the mobile bell (`data-notice="FAILED_START"`) |
| 3 Web Dashboard | `features/dashboard/sim-adapter.ts:38-53`, `system-ring-panel.tsx`, `hero-panel.tsx:30,172`, `active-session-panel.tsx:63,253,267,413` | Connecting: the ring shows the system's own state (no REC, no timer) with "Connecting cameras…" under it; hero line "Connecting cameras… SES-…"; session tile: the line, no REC chip, start time "—". Failed start: tile title / body from the reason, no "recover" wording |
| 4 Meters | web `features/session-monitor/audio-panel.tsx:72`; mobile `features/session-live/mic-card.tsx:65` (cards and Audio sheet) | While connecting the meter is not mounted: "CONNECTING" in its place |
| 4 Integrity panel | web `features/session-monitor/model.ts:285` | `selectIntegrity` keys on the durable recording: "Storage Write Verified" reads Standby while connecting |
| 5 Web entry points | see section 4 | Dashboard tile fixed; two places found and filed, not changed |

Rule used everywhere: only an explicit `captureDurable: false` counts; a session without the member
reads as before. Words: all from the shared vocabulary (`common.session.*`, `common.captureNotice.noCamera.*`,
`common.actions.viewDetails`, `session.audioSource.connecting.detail`).

## 2. Results

| Check | Command | Result |
|---|---|---|
| Items 1, 2 + the folder (harness touched) | `npm test -w apps/mobile -- src/features/session-recovery --maxWorkers=2` | 7 suites, 72 / 72 (new: `failed-start` 7, `recovery-finalizing-handover` 4) |
| Item 3 mobile: Home tiles, bottom bar, bell | `npm test -w apps/mobile -- src/features/dashboard/session-start-home.test.tsx --maxWorkers=2` | 4 / 4 |
| Item 3 mobile: Sessions hub; item 4 mobile | `npm test -w apps/mobile -- src/features/sessions/session-start-hub.test.tsx src/features/session-live/connecting-meters.test.tsx --maxWorkers=2` | 2 / 2 and 2 / 2 |
| Item 3 web (Dashboard, alert centre), item 4 web | `npx vitest run --root apps/core-web src/features/dashboard/__tests__/session-start-d7.test.tsx src/features/session-monitor/__tests__/connecting-leftovers.test.tsx` | 3 / 3 and 2 / 2 |
| Typecheck | `npm run typecheck -w apps/mobile` / `-w apps/core-web` | mobile 0 errors; web 7 errors, all in row 139's `session-monitor/__tests__/situation-c.test.tsx:132-141` (filed) |
| Lint | `npm run lint -w apps/mobile` / `-w apps/core-web` | mobile 0 errors (1 known warning, `runtime/log.test.ts:160`); web 0 |

Controls in the tests: a durable FAULT and a FAULT without the member keep the recovery screen; each
placement reads "Recording" (dot, timer, meter) before `captureDurable: false` and again after
`true`; a capture fault without a cause on a session that is not a failed start keeps its own label;
a deep link into recovery while another session finalizes is not handed over.

Not proven: device / browser; the first frame on real hardware (B9 stays open, D121); a real
resumed seal (the test sets FINALIZING on the store); Live client mode for any of the placements.
Jest prints the kit's `[colorKit.RGB]` console error where a HeroUI button mounts in a popover or in
row 139's notice; it is there without this pass too.

## 3. Decisions taken (for the controller)

1. **A failed start has no recovery hand-off on mobile**: after "Close session" the same words stay
   (no analysis view), and the screen goes Home when the session has left the store (OP-125-5).
2. **The failed start is held by session id** from the moment it is seen, because row 139's rule
   reads FAULT only and the close passes through RECOVERY.
3. **MB-06 hands over only a session the route showed as interrupted**, and only at FINALIZING
   (SEALED keeps the existing paths).
4. **Connecting on the Home / Dashboard ring = the system's own state, not the recording ring**:
   web maps the flag severity (READY / ATTENTION / CRITICAL); mobile draws the neutral ring with the
   word CONNECTING.
5. **No meter is mounted while connecting** (a placeholder of the card meter's height), instead of a
   flat meter that would read NO SIGNAL.
6. **Sessions hub action for a failed start is "View details"** (existing word); it opens the
   recovery route, which now shows the failed start.
7. The bell rule lives in its own file on the web (lint: a component file exports components only).

## 4. Item 5 — what was found on the web

| Place | State |
|---|---|
| Dashboard, Active Session tile ("Session fault … Open the Session Monitor to recover it") | fixed here |
| Session Monitor: "Close session" -> `recover` -> phase RECOVERY opens the recovery overlay (`index.tsx:89-90`, `finalization-modal.tsx:73,100`) for a session that recorded nothing | **not changed** (row 139's files, outside the two leftovers); filed in `file_requests.md`. Read from the code, not run |
| System page, demo panel (`features/system/demo-panel.tsx:329`): "run recovery to close it as Incomplete" for any FAULT | not changed; Simulated-only control; filed with the line above |
| Web has no Sessions list; the Evidence archive shows no item for a failed start (none exists) | nothing to do |

Also not done: Dashboard camera tiles "NO SIGNAL" for situation C come from the device slice (no
wording change); mobile Home quick action still reads "Open recovery" for a failed start; the
mobile session detail of a closed failed start reads the ordinary "incomplete, no evidence" text.

## 5. Device / browser flows added to the gate-75 list (not run)

- **F5 — failed start on tablet and phone** (`M5-NODEV-C-T`, `-P`): start with both camera sources
  stopped; the recovery route shows the notice, Devices pointer and "Close session", no pipeline or
  track rows; Close -> Home, no evidence item; with one durable fragment before the fault: the
  ordinary recovery screen.
- **F6 — MB-06 resumed seal** (with `M7-FF-TAB` / `-PHONE`): Core restart during sealing while the
  device shows Recovery; no empty frame Recovery -> Finalizing -> Summary; B9 logcat count during it.
- **F7 — connecting on the shells** (with F1): during "Connecting cameras…" open Home, the bottom
  bar, the Sessions hub (tablet + phone) and the web Dashboard: no REC, no timer, no meter anywhere;
  after the first fragment all read Recording.
- **F8 — alert centre wording** (with F2 / F3): web bell and Home bell read "No camera connected.
  Nothing was recorded." and "Camera 2 (CAM-02) is not connected".
- **F9 — Monitor while connecting** (with F1, web + tablet + phone): no audio meter, web integrity
  panel "Standby".

## 6. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm test -w apps/mobile -- --maxWorkers=2` | none | the six new files green; no other file changes result (folders touched: session-recovery, dashboard, sessions, session-live, components/composed/nav, the recovery route) |
| `npm test -w @dems/core-web` | none | the two new files green; dashboard, session-monitor and shell tests unchanged |
| `npm run typecheck -w apps/core-web` after row 139's test file is corrected | none | 0 errors |
| Flows F5-F9 | heavy-host for the worker | as written; gate 75 |

## 7. Follow-up (controller decision D158, 2026-10-10)

Status **needs-review**. The two request lines of this pass (file_requests.md, "pass D7") are closed by it.

| Item | Where | What was done |
|---|---|---|
| 1 Web Monitor, close of a failed start | `features/session-monitor/model.ts` `selectFailedStartClosing` (RECOVERY with `captureDurable: false`), `selectBanner` RECOVERY case, feed `failedStart`; `index.tsx` (session held by id; no recovery overlay for it); `status-banner.tsx` (no control while closing); `live-feed-panel.tsx` (the failed-start words in RECOVERY too) | "Close session" opens no overlay and shows no recovery wording: the failed-start banner and feed text stay, without control, until the session leaves the store; then the Monitor is idle (the place §8e.2 / OP-125-5 name: the fault presentation, then the idle state). A durable FAULT still opens the recovery overlay |
| 2 Row 139's test types | `session-monitor/__tests__/situation-c.test.tsx:129` | the helper's return type is `Pick<SimAlert, 'kind' \| 'active' \| 'params'>[]`; no assertion changed |
| 3 System demo panel | `features/system/demo-panel.tsx` (`selectDemoContext.failedStart`, the hint and the button) | failed start: "No camera connected. Nothing was recorded." (generic title without a cause), button "Close session"; any other FAULT as before |
| 4 Mobile quick action | `features/dashboard/quick-actions.tsx` | "View details" for a failed start |
| 4 Mobile session detail | `features/sessions/sessions-model.ts` (`SessionRow.recordedNothing`, optional), `session-detail.tsx` `useClosedFailedStart` | A closed INCOMPLETE session that never started, with no evidence item and no byte: "Recording did not start. Nothing was recorded."; "No camera connected. …" when a `CAPTURE_FAULT` alert with `params.reason: NO_CAMERA_CONNECTED` was raised between that session's creation and its end |

Results (each once after its last change):

| Check | Result |
|---|---|
| Item 1 test BEFORE the fix | red as predicted: `finalization-modal` in the document after the press (`failed-start-close.test.tsx:110`) |
| `npx vitest run --root apps/core-web src/features/session-monitor/__tests__ src/features/system/__tests__/demo-failed-start.test.tsx src/features/dashboard/__tests__/session-start-d7.test.tsx` | 8 files, 64 / 65. New: `failed-start-close` 2 / 2 (with the durable control), `demo-failed-start` 1 / 1; `situation-c` 8 / 8. One red not from this pass: `audio-source.test.tsx:255` (the audio-source band segment after a switch reads another `data-input`; band / shared simulator intervals, passes D5 / D6 — no line of this pass is on that path) |
| `npm test -w apps/mobile -- src/features/sessions/session-start-hub.test.tsx src/features/dashboard/session-start-home.test.tsx --maxWorkers=2` | 3 / 3 and 4 / 4 |
| `npm run typecheck -w @dems/core-web` | exit 0 |
| `npm run typecheck -w apps/mobile`; lint of both apps | 0 errors (mobile: the one known warning) |

Decisions taken: (8) "closing" on the web is read from the store (RECOVERY + `captureDurable: false`
can only be a failed start) and, for the overlay, also held by session id; (9) a closed failed start
is recognised in the history by its facts (INCOMPLETE, never started, no evidence, 0 bytes) — the
history entry carries no reason, so a session that faulted before recording for another cause reads
the same generic sentence, which is true for it; the no-camera cause is taken from the alert in that
session's time window. Not proven: browser / device; a Core that drops `captureDurable` during
RECOVERY would show the ordinary recovery banner (the overlay stays closed by the id hold).

Gate-75 additions: **F5w** — web: close a failed start on the Monitor: no dialog, banner stays, then
idle; durable fault: the recovery dialog as before. **F5** gains: Home quick action "View details",
and the closed session's detail on tablet / phone.
