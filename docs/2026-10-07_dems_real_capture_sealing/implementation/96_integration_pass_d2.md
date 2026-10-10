---
task_id: 2026-10-07_dems_real_capture_sealing
pass: integration D2 (client seams: web console + mobile)
date: 2026-10-09
agent: coder-execution
baseline: e296ce7
status: needs-review (software complete; one foreign typecheck error blocks `tsc -b` of core-web; meters of a third microphone open)
tier: 3
---

# 96 — Integration pass D2 (client seams)

No commit, no dependency, no lockfile write, no emulator / adb / browser / build. Web paths are under
`apps/core-web/src/`, mobile paths under `apps/mobile/src/`.

## 1. Items

| # | Item | State | Where (file:line) |
|---|---|---|---|
| 1 | Mobile badge from the Core's `sourceClass` only (D131) | done | `demoControls` removed from the rule and from every caller: `features/capture-selector/capture-notices-model.ts:199,210`, `development-source-badge.tsx:26`, `capture-source-sheet.tsx` (`SourceBadgeMode`), `capture-selector.tsx` (`LineBadge`), `use-capture-selector.ts` (`badgeMode`), `use-camera-search.tsx`, `camera-search-panel.tsx:58`. Live mode stays a condition (D83: Simulated client mode has no Core) |
| 2 | Badge mounts | done | Mobile: Session Live mic card `features/session-live/mic-card.tsx:156`, camera on screen `live-feed.tsx:212`, Home tiles `features/dashboard/device-tiles.tsx:100,102`; new `TrackSourceBadge` / `MicInputSourceBadge` (`development-source-badge.tsx:104,114`: device of the session's selector snapshot, else the stored selector). Web: Monitor camera `features/session-monitor/live-feed-panel.tsx:148`, mic meters `audio-panel.tsx:60`, Dashboard tiles `features/dashboard/devices-panel.tsx:312,338`. `source-badge.tsx` now imports `devices.css` (its two classes are needed outside the Devices page). Evidence pages untouched |
| 3 | Web Dashboard kebab Restart of a camera (D100) | done | Live mode + camera tile: confirmation dialog (the Devices page's words), then `POE_CYCLE` -> op 48 with `{ confirm: true }` through the shared binding; `CAMERA_NOT_LOST` said as on Devices. `devices-panel.tsx:118,255`. Microphone tiles and Simulated mode unchanged |
| 4 | WB-07 System entry link | done | `features/system/settings-panel.tsx:251` (row 137's request, as written) |
| 5 | Microphones by the Core's id | done for names / pair / selectors / live code; NOT done for meters and the fixed Devices roster (section 4) | One rule per app, ids typed `string`: web `lib/capture-notices.ts:139,149,157` (`micInputName`, `otherMicInput`, `captureDeviceName`), hook `features/devices/source-class.ts:94`; mobile `features/capture-selector/mic-input-name.ts`, hook `development-source-badge.tsx:49`. Live code: `features/session-monitor/audio-source.ts:143,155` + `audio-source-controls.tsx` + `timeline-panel.tsx`, band `components/composed/audio-source-band(.math).ts[x]` (colour by position); mobile `features/session-live/mic-source-model.ts:145,164`, `use-mic-source.ts`, `mic-source-controls.tsx`. Notices / pre-check / re-read rows: "Microphone 3 (MIC-03)". New copy key `common.captureDeviceName.microphone` (`packages/shared/src/i18n/en/common.ts:914`, one appended block) |
| 6 | `live-shell-notices.test.tsx` | run once: 22 passed; left as it is | — |
| 7 | (controller, after D1a) redaction of `{ field: 'credential.password', value }` | done | Web canary ran red on the old negative control, flipped: both `credential.password` and `credential.username` records must be blanked, with a control that another field keeps its value (`features/devices/__tests__/camera-connect-canary.test.tsx`, "the two lines"). Mobile `runtime/log.test.ts` ran green (32) and pins no gap: unchanged |

Item 5 and D1b: D1b's widened types were already in the tree when the checks ran (`AudioSourceState.activeInputId: CaptureMicInputId`, meters `inputs` as a record). The client code uses `string` ids and one cast at `actions.switchAudioSource(...)`, so it compiles against both forms.

Naming rule (both apps): the Core marks the device as its local microphone (`sourceClass: DEVELOPMENT`, `adapter: LOCAL_DEVICE`, Live mode) -> "This Mac's microphone" (web) / "Core Mac's microphone" (mobile); `MIC-01` / `MIC-02` -> "MIC 1" / "MIC 2" (unchanged words); `MIC-NN` -> "Microphone N"; anything else -> the id. The standby of a pair = the session's `audioSource`, else the other line of the session's selector snapshot / stored selector, else the built-in other.

## 2. Commands and results (2026-10-09, each once; repeats only after a fail)

| Command | Result |
|---|---|
| `npx -w apps/mobile jest --maxWorkers=2 src/features/capture-selector/{development-source-rule.test.tsx,mic-input-name.test.ts,capture-notices-model.test.ts} src/features/session-live/mic-source-model.test.ts` | 4 suites, 43 tests passed |
| `npx -w apps/mobile jest --maxWorkers=2 src/features/dashboard/development-source-tiles.test.tsx src/features/session-live/development-source-mounts.test.tsx` | 2 suites, 2 tests passed (Live beds, contract-checked fake transport) |
| `npm run test -w @dems/core-web -- --maxWorkers=2 src/test/live-d2-client-seams.test.tsx src/features/devices/__tests__/mic-input-name.test.tsx src/test/live-dashboard-devices.test.tsx` | first run: 3 failed in the new file (my own miss: `micName` not defined in `AudioSourceFooter`; the Monitor panel fell to its error boundary) — fixed; second run of the new file: 7 passed. The other two files passed in the first run (26 tests with the 4 that passed in the new file) |
| `... src/features/devices/__tests__/camera-connect-canary.test.tsx` (item 7) | run 1: 1 failed = the pinned gap is closed (expected); after the flip: 1 failed (my control used `profileToken`, which the rule blanks as a token — corrected to `model`); run 3: 2 passed |
| `... src/test/live-shell-notices.test.tsx` (item 6) | 22 passed |
| `npx -w apps/mobile jest --maxWorkers=2 src/runtime/log.test.ts` (item 7) | 32 passed |
| Static guards: mobile 15 files; web `live-static-ac-c-53`, `live-runtime-static` | mobile 130 passed, 1 failed: `features/evidence/live-evidence-static.test.ts` "reads the folder: every production file" — row 92's folder (in flight), not this pass; web 15 passed |
| `npm run -w apps/mobile typecheck` | no error |
| `npm run typecheck -w @dems/core-web` (`tsc -b`) | **1 error, not this pass's: `packages/shared/src/sim/types.ts(20,3) TS6196 'MicInputId' is declared but never used`** (pass D1b's file, in flight; same after one retry). `npx tsc -p apps/core-web/tsconfig.app.json --noEmit` shows that error and no other: 0 errors in core-web files |
| `npm run lint -w @dems/core-web` | 0 |
| `npm run -w apps/mobile lint` | 0 errors, 1 old warning (`runtime/log.test.ts:160`) |

Failing-first: item 1's "demo flag ON" cases cannot pass under the old rule (`!demoControls`), by reading; no mutation round was run (D122 rule 6). The web seam test caught a real defect of this pass (above).

Changed existing tests: `apps/core-web/src/test/live-dashboard-devices.test.tsx` — camera Restart cases follow the confirmed cycle (one confirmation step in the `press` helper, the cycle's toast, body `{ confirm: true }`, record `command: 'POE_CYCLE'`); no assertion removed. `capture-notices-model.test.ts` (mobile): the demo-flag cases rewritten to the D131 rule. `mic-source-model.test.ts` (mobile): cases added. `camera-connect-canary.test.tsx`: item 7.

## 3. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm run test -w @dems/core-web -- --maxWorkers=2 src/features/session-monitor src/features/devices src/features/dashboard src/features/system src/features/session-new src/test/live-session-monitor-*.test.tsx src/test/live-devices-*.test.tsx src/test/live-dashboard-*.test.tsx src/test/live-system-settings.test.tsx` | none | green; a red in `session-monitor` audio-source / timeline or in the dashboard tiles goes back to pass D2 (their production files were edited, their own test files were not run here) |
| `npx -w apps/mobile jest --maxWorkers=2 src/features/session-live src/features/dashboard src/features/capture-selector src/features/devices src/features/session-new` | none | green; same rule |
| `npx vitest run --root packages/shared test/i18n.test.ts test/i18n-vocabulary-sync.test.ts` | none | green (one appended block in `i18n/en/common.ts`) |
| `npm run typecheck -w @dems/core-web` after D1b removes its unused import | none | exit 0 |

## 4. Open — to wire / for the controller

1. **Meters and role chips of a third microphone.** The meters and the "Active / Standby" chips are keyed by channel -> input through the shared table `MIC_INPUT_OF_CHANNEL` (`AUDIO-01` -> `MIC-01`, `AUDIO-02` -> `MIC-02`) in `components/composed/dbfs-meter.tsx`, `apps/mobile/src/runtime/use-audio-shared-values.ts`, `session-monitor/audio-panel.tsx:52`, mobile `inputOfChannel`. When the session's pair is `MIC-03` / `MIC-01`, the names, the toggle, the confirmation, the band and the notices are right, but the `AUDIO-02` meter reads `inputs['MIC-02']` (absent) and no card says "Active". The mapping must come from the Core (the selector line of each channel, or `mics[].deviceId`); it sits in `packages/shared/src/sim/audio.ts` (D1b) and the two runtimes. Needs a ruling on which member maps a channel to an input.
2. **The fixed Devices roster.** The Devices pages of both apps list a closed set (`DeviceId`: `MIC-01`, `MIC-02`, ...) with drawers / detail screens. A `MIC-03` appears in the selector, the sheet, the re-read rows and the notices, not as a roster card. Same limit as `CAM-03` (row 137 §5.6, row 138 §3).
3. Label wording: "Microphone 3" (the brief) beside "MIC 1" / "MIC 2" (existing copy). One key (`common.captureDeviceName.microphone`) if "MIC 3" is preferred.
4. Selector rows and the mobile re-read rows keep the raw id as their title (as built by rows 67 / 68 / 138); the badge's kind text names a local microphone there.
5. Files edited outside §9 by the brief's items 2 and 5 (declared in `file_claims.md`): web `features/session-monitor/{audio-panel,live-feed-panel,audio-source-controls,timeline-panel}.tsx`, `audio-source.ts`, `components/composed/audio-source-band(.math)`, `lib/capture-notices.ts`, `test/live-dashboard-devices.test.tsx`; mobile `features/session-live/{mic-source-model.ts,use-mic-source.ts,mic-source-controls.tsx}` beyond the badge mounts; one block in the shared `i18n/en/common.ts`.

## 5. Additions to the gate-70 device / browser flows

| Flow (owner note) | Added step | Asserts |
|---|---|---|
| **W-DEVSRC** (row 137 §6) | development configuration: also open Dashboard and Session Monitor (a recording) | badge on the tiles / meters of the development devices (`source-badge-dashboard-*`, `source-badge-monitor-*`); flag off: 0 badges there |
| **W-DISC** (row 137 §6) | start from System -> "Search for cameras" | lands on Devices at the search panel; nothing is sent by the link |
| new step in **W-DEVSRC** or the M4 command flow | Dashboard -> a camera tile kebab -> Restart | confirmation dialog; one op 48 with `{ confirm: true }`; a camera that is not lost answers the "not lost" sentence; no plain `RESTART` |
| **F6 label** (row 138 §6) | also Home tiles and Session Live (camera on screen, mic cards) | badge on the development devices; flag off: 0 badges. A Core in SIMULATED capture: 0 badges whatever its demo flag (D131; needs row 139's server pin) |
| **W-MIC / F5** (rows 137 / 138) | with the local microphone `MIC-03` in the selector pair | names read "This Mac's microphone" / "Core Mac's microphone" in the switch confirmation and the notices; open item 1 decides the meters |
