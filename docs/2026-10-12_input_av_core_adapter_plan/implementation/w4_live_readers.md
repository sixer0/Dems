---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: coder-execution (agent W4, track D)
row: W4
type: the web and tablet readers of a camera's facts on a live Core
narrative_tier: 1
source: verification/060c_m3_review_third_pass.md (R-01 to R-06), verification/060b_m3_review_second_pass.md (S-01), implementation/v6_commissioning_review_changes.md (item 7), implementation/r2_m3_review_follow_ups.md (item 4a); decisions C36, C95, C98, C105
status: needs-review
---

# Row W4: what a client shows of a camera on a live Core

## 0. Frame

| Question | Answer |
|---|---|
| What | Six items of the brief: R-01 (bitrate), R-02 (the tablet's device detail), the readers that do not reach a real Core (R-03 to R-06, F3-07), the state-stream slice of S-01 on the readers' side, F3-06 for the operator, a stale fact after a camera fault |
| Why | Decision C98 routes the reader findings of review 60c to this row; gate M3 (row 61) waits for it. Decision C36: a default never stands in for what a stream states |
| Who | Agent W4, single writer of `apps/core-web` and `apps/mobile` in this wave. `packages/shared` belongs to agent R1b and was not touched |
| Where | `apps/core-web/src/features/{devices,session-monitor,session-new}`, `apps/core-web/src/i18n-web.ts`, `apps/mobile/src/features/{devices,session-live}` |
| How | The source of each fact was traced first (section 1); one rule per app (`stream-facts.ts`); each reader moved to it; tests in the existing file of their subject |
| Status | needs-review: one item is left with a request for a ruling (section 4, item 3, the tablet's feed chip) and four driver decisions wait for confirmation (section 6) |

No browser check and no emulator check was made. No dev server was started; ports 4423, 5173 and 5178 were not touched. Everything below is proven in jsdom (web) and the Jest renderer (tablet) against the apps' own live test beds and the in-app simulator's state. What a layout looks like in a real browser at 1280 / 1440 / 1920, and on the tablet, is NOT proven (section 7).

## 1. What was found before anything was changed

| Fact | Evidence |
|---|---|
| A camera's `bitrateMbps` has one writer, the simulator's literal `9` | `packages/shared/src/sim/initial-state.ts:300, 316`; the Core passes it on at `apps/core-server/src/modules/devices/status.ts:234`; text search of `packages/shared/src` and `apps/core-server/src` |
| The contract's member is NOT nullable | `packages/shared/src/api/state-slices.ts:558` (`bitrateMbps: amount()`), `core-api.ts:427` (`z.number().nonnegative()`) |
| The three stream facts ARE nullable since row V6 | `state-slices.ts:528-541` |
| Neither client calls operations 44 / 46 / 47 | text search of `apps/core-web/src`, `apps/mobile/src`, `packages/shared/src/live` for the device reads: no call. The clients read the `cameras` slice of the state stream |
| That slice still holds the simulator's `1080p / 25 / H.264` on a real Core | rows B2 and V6 (request line of row V6, `file_requests.md:459`); `withCameraStreamFacts` is applied in the three device reads only (`devices/index.ts:121-154`) |
| What the Core DOES state to a client about a track's stream is the selector line: its stored profile code | `captureConfig.cameras[].profile` of the state stream (and the open session's snapshot); the Core derives the three facts of operations 44 / 46 / 47 from exactly that code (`cameraStreamFactsOf`, `devices/status.ts:146`) |

Consequence for item 4: the slice TYPE is nullable, so what remained is a reader-side change - but a null check on the slice would not do it, because the slice's VALUES are the simulator's on a real Core. The readers therefore read the selector line in force and decode its code as the Core does.

## 2. The rule (one per app)

`apps/core-web/src/features/devices/stream-facts.ts` and `apps/mobile/src/features/devices/stream-facts.ts`.

| The Core this client shows | Picture, rate, codec | A camera in fault |
|---|---|---|
| Simulated client mode, or a Core in simulated capture | the `cameras` slice, exactly as before | as before |
| a Core in real capture | the stored stream statement of the track's selector line in force; "Not stated" where the line names none or its code is no statement | the fault is said in the place of the facts |

The fault of a track, from what the Core reports, in this order: the selector line's lost stream or unreachable source (web: by `sourceLineState`, the existing one rule of a source line); an active "not reachable" notice naming the line's camera; the camera slice's own fault of the track (`online: false`, a lens fault). The words are existing ones: "Stream lost" (`devices.selector.stream.LOST`), "Not reachable" (`common.developmentRoster.notReachable`), "No signal" (`common.status.noSignal`).

## 3. What an operator now sees on a live Core

| Surface | A track with a stored statement | A track without stream facts | A camera in fault |
|---|---|---|---|
| Web, Devices tile | row "Format: 2560x1920 • HEVC"; no bitrate row, no PoE row | row "Format: Not stated"; no bitrate row | row "Format: Stream lost" / "Not reachable" / "No signal"; the stored facts are not drawn |
| Web, device drawer | "Format" = the stored facts; bitrate, model, firmware, port "Not reported" (unchanged) | "Format" = "Not stated" | "Format" = the fault |
| Web, "No preview" tile (Dashboard, Session New pre-check, Session Monitor feed) | on the state line: "Not checked · Format: 720p • 30 fps" | "... · Format: Not stated" | the state line says the fault as before; no format |
| Web, Session Monitor input cards | "720p • 30 fps" beside the thumb | "Not stated" | the fault |
| Tablet, device detail of a production camera | status, id, "Format: 2160p • HEVC", recording state. No model, firmware, PoE port, bitrate; no "Synthetic demo values" chip | "Format: Not stated" | "Format: Stream lost" / "Not reachable" / "No signal" |
| Tablet, live feed chip | not drawn (unchanged; section 4, item 3) | not drawn | not drawn |

Before this row: the web tile showed "9 Mbps" while a session recorded and no format at all; the drawer said "Not reported" for the format; the tablet showed the simulator's whole record under a chip.

## 4. The six items

| # | Item | Result |
|---|---|---|
| 1 | R-01, the bitrate | DONE by the mode, with a request. `measuredFiguresShown` answers `bitrate: false` on a Core in real capture, recording or not; R-06: no row and no literal `?? 9` for a track the slice does not carry. The contract's member is not nullable: the nullable member is requested (section 5, line 1). Simulated mode keeps "9 Mbps" |
| 2 | R-02, the tablet's device detail | DONE. `cameraDetailFactsOf`: a camera on a Core in real capture with any adapter but `FAKE` is `STATED` - status, id, the stored stream facts ("Not stated" where null, the fault where reported), recording state. `detailFactsOf` is unchanged and still rules microphones and the other blocks |
| 3 | `CameraPreview` and the readers that do not reach a real Core | DONE on the web; the tablet's feed chip LEFT with a request. Web: the "No preview" tile states the track's stored format itself (R-03; the caller's `label` is covered by the tile's own name line: the track and the device its selector line names); the tile, drawer and input-card guards became the rule of section 2 (R-04); `selectFeed` no longer falls back to the first camera (R-05; the tablet's `live-feed.tsx` had the same fallback: removed); the pre-check tile reads the slice instead of the literal `1080p / 25` (F3-07). Tablet feed: section 6, D-2 |
| 4 | The state-stream slice of S-01 | DONE on the readers' side: on a Core in real capture no reader of either app reads `resolution`, `fps` or `codec` of the slice any more (the only remaining slice reads are the branches drawn off a real-capture Core). The decode is a second and third statement of one code form: requested into `packages/shared` (section 5, line 2) |
| 5 | F3-06 for the operator | DONE on the web. `connectRefusal` maps `409` + reason `COMMISSIONING_NOT_CONFIGURED` to the new kind `NETWORK_NOT_CONFIGURED`; the dialog says "This camera cannot be tested yet: the camera network of this Core is not configured." and "A technician chooses the camera interface and the camera subnet on the "Camera network setup" screen (Administration). Then test the connection again. Nothing was sent to the camera." The Test button stays usable. The shared i18n has no such sentence: worded in `i18n-web.ts` with a request to move it (section 5, line 3). The tablet has no candidate connection test |
| 6 | A stale value after a camera loss | DONE. Where the Core reports a camera's fault, every reader of section 3 says the fault in the place of the stored facts. Simulated mode is unchanged (its NO SIGNAL tile keeps the dataset's format, as the review noted) |

## 5. Requests left in `delegation_progress/file_requests.md` (four lines, `row W4`)

1. R1b, then the Core's devices module: `bitrateMbps` nullable in `CamerasSliceSchema` (`state-slices.ts:558`), the video track status (`core-api.ts:427`), `CameraStatus` and `ApiVideoTrack`; then null from the Core in a real capture operation. Blocking: no.
2. R1b, then the three callers: one shared function for "what a stored profile code states of its stream" (today `cameraStreamFactsOf` of the Core and the two client copies). Blocking: no.
3. R1b (i18n): move `web.source.networkNotConfigured.*` beside `common.captureConnect.*`. Row R2's open line on operation 108 is restated there. Blocking: no.
4. The controller: one ruling for both clients on a format beside a RECORDING of the Core's own capture (D-2 below). Blocking: yes for calling item 3 closed on the tablet's feed.

## 6. Driver decisions, for the controller to confirm

| # | Decision | Reason |
|---|---|---|
| D-1 | The clients DECODE the selector line's profile code (a copy of the Core's `cameraStreamFactsOf` in each app) instead of showing "Not stated" everywhere by the mode | The brief asks for "the stored stream facts, Not stated where null"; the slice cannot give them on a real Core and no client calls operations 44 / 46 / 47. The copies hold the same table of cases as each other; request line 2 removes them |
| D-2 | The tablet's live-feed chip is NOT changed, while the web's Session Monitor DOES state the stored format during a recording | `connecting-meters.test.tsx:186-197` pins ruling D222 (2): no format chip and no text `1080p` beside a recording of the Core's own capture. It is not a pin of "a simulator value shown in LIVE mode", so the brief's rule on pins did not let this row edit it; the web has no such pin and the brief's item 3 names its readers. The two clients therefore differ on this one place until the ruling of request line 4 |
| D-3 | In fault the facts are REPLACED by the fault word in the fact rows, and simply not drawn on the "No preview" tile | The tile's state line already says the fault by the existing rule (`sourceLineState`); its wording was not changed, so no existing pin of that line moved |
| D-4 | The "No preview" tile draws the format ON its state line ("Not checked · Format: ..."), not as a fifth line | Fix waves L and Q measured the Dashboard tile's box for four lines (44 px of box for 64 px of text at 1440); a fifth line could not be checked without a browser. The Devices tile does not repeat it (its fact row states it); the Monitor's thumb has no room (the card states it) |

## 7. Tests

### 7.1 Existing pins that moved (each pinned a simulator value shown in LIVE mode)

| File | What moved |
|---|---|
| `apps/core-web/src/features/devices/__tests__/source-state.test.tsx`, case "PoE port and bitrate ..." | `measuredFiguresShown({ realCapture: true, recording: true })`: `bitrate: true` -> `bitrate: false`. The figure it admitted was the simulator's 9 |
| `apps/mobile/src/features/devices/real-capture-one-rule.test.tsx`, case "blocks that keep model values carry the chip: a camera and a microphone of another adapter" | the CAMERA half: it pinned the chip and "PoE CAM 1" for a production camera on a real Core. Now: no chip, no port, the stored facts. The microphone half is unchanged; the case was renamed |

Every other existing test of both apps passed unedited, the pure pin of `detailFactsOf` (`MODEL_VALUES` for every non-`FAKE` adapter) included: the camera has its own function.

### 7.2 New cases (each in the existing file of its subject)

| File | Cases |
|---|---|
| web `source-state.test.tsx` | `storedStreamFactsOf` (five codes with the Core's answers, eleven that state nothing); `trackFactsOf` (Simulated: the slice unchanged and no fault judged; live: stated facts although the slice says otherwise, null facts for a code that is none and for no line, four faults, the other track untouched); the bitrate control in Simulated mode while recording |
| web `camera-no-preview.test.tsx`, block "row W4" (7 cases, live bed) | Devices: stated facts, "Not stated", no bitrate, no PoE, nothing of the slice, the drawer; Devices while a session records: still no bitrate; a camera in fault with the other track as control; Dashboard: the format on the state line, `aria-describedby`; Dashboard in fault; Session New and Session Monitor; CONTROL: a Core in simulated capture reads the slice with PoE and "9 Mbps" as before |
| web `camera-connect.test.tsx`, `camera-connect-canary.test.tsx` | the mapping with two controls; the dialog: kind, both sentences, the screen's name, not the general sentence, not the Core's message, no toast, Test still enabled, no typed value reported, and `CANDIDATE_NOT_TESTABLE` keeps its own kind |
| tablet `real-capture-one-rule.test.tsx` | `cameraDetailFactsOf`; `storedStreamFactsOf` (the web's table); `statedTrackOf` (stated, null, no line, three faults, control); the detail of a production camera on both window classes: stated facts, null facts, a fault |

Simulated mode unchanged is held by the existing suites, which passed unedited (`devices-page.test.tsx`, `dashboard.test.tsx`, `session-monitor.test.tsx`, `session-new.test.tsx`, the tablet's `devices-screen.test.tsx`, `session-live-screen.test.tsx`, `connecting-meters.test.tsx` and the "CONTROL - the simulated lane" block).

### 7.3 Checks

| Check | Command | Result line |
|---|---|---|
| Web, targeted, first run after the product edits | `npx vitest run src/features/devices src/features/dashboard src/features/session-monitor src/features/session-new src/test/real-core-facts.test.tsx ... --maxWorkers=2` | `Test Files 1 failed, 42 passed (43)`, `Tests 1 failed, 580 passed (581)`: the one red was the bitrate pin of 7.1 |
| Web, the four files with new cases | `npx vitest run camera-no-preview source-state camera-connect camera-connect-canary --maxWorkers=2` | first run `2 failed, 52 passed (54)`: both were this row's own fixtures (an empty profile the contract refuses; the selector in force of a recording is the session's snapshot, which the fixture had not set); after the fixture fix `camera-no-preview`: `Tests 15 passed (15)` |
| Web, final targeted run (devices, dashboard, session-monitor, session-new, commissioning, media, and the live / pin files of `src/test` that touch them) | `npx vitest run src/features/devices src/features/dashboard src/features/session-monitor src/features/session-new src/features/commissioning src/components/media src/test/real-core-facts.test.tsx src/test/live-devices src/test/live-dashboard src/test/live-session-monitor src/test/live-session-new src/test/live-w0-camera-words.test.tsx src/test/selector-in-force.test.tsx src/test/visual-audit-45b.test.tsx src/test/live-static-ac-c-53.test.ts src/test/live-local-source-on.test.tsx src/test/live-cf-web-media.test.tsx src/test/live-gap-indicator-connecting.test.tsx --maxWorkers=2` | `Test Files 59 passed (59)`, `Tests 772 passed (772)` |
| Tablet, devices and session-live | `npx jest src/features/devices src/features/session-live --maxWorkers=2` | `Test Suites: 36 passed, 36 total`, `Tests: 409 passed, 409 total` (run twice: the first run's summary was lost in console output, so it was repeated with `--silent`; both passed) |
| Tablet, capture-selector, home, session-new (with the static `selector-in-force` pin) | `npx jest src/features/capture-selector src/features/home src/features/session-new --maxWorkers=2 --silent` | `Test Suites: 38 passed, 38 total`, `Tests: 436 passed, 436 total` |
| Typecheck | `npx tsc -b` (core-web); `npx tsc --noEmit` (mobile) | exit 0 each |
| Lint | `npx oxlint` (core-web); `npm run lint` = `eslint .` (mobile) | exit 0 each, no finding printed |

Not run: any full suite of either app (driver rule 7), the shared and Core suites (no file of theirs changed), a browser, an emulator.

## 8. What stays unproven

- The look of the format on the "No preview" tile's state line in a real browser: whether "Not checked · Format: 2560x1920" wraps in a narrow Dashboard tile at 1280. jsdom has no layout.
- That a real Core's selector line carries a statement-form profile for an adopted production camera end to end on this console: the cases set the line in the served state; no real camera or Core was used.
- That the fault sources chosen (the line, the notice, the slice) are the ones the Core's camera watch raises for a production camera inside a session: read from the existing readers, not traced into the Core.

## 9. Edit-only statement

Every existing file was changed with the Edit tool, each edit small and made after reading the place. No scripted replace, no shell write, no whole-file rewrite. New files with Write: the two `stream-facts.ts` modules, this record and `delegation_progress/row_w4.md`.

---
*Generated: 2026-10-13*
*Last Updated: 2026-10-13*
