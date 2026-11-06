---
task_id: 2026-10-07_dems_real_capture_sealing
row: 67
title: M4-W3 web selector + query factories
date: 2026-10-09
agent: coder-execution
status: needs-review
tier: 3
---

# Row 67 — web capture device selector and query factories (M4-W3)

Workspace `apps/core-web`. Built against the shared registry, the simulator (ops 76-80 answered in
Simulated mode) and the contract-checked fake transport. The server module of ops 76-80 (row 66) is
not built: nothing here was run against a real Core.

## 1. What was built (file:line)

| Item | Where |
|---|---|
| WB-11 / E-17: keys `captureConfig`, `captureDevices` | `apps/core-web/src/runtime/query-bridge.ts:50` |
| WB-11: gate `useCaptureReadGate`, factories `captureConfigQueryOptions`, `captureDevicesQueryOptions` | `apps/core-web/src/lib/core-queries.ts:103,137,146` |
| ux §2.7: slice republish refreshes a filled entry, never creates one (`applyCaptureSlice`, `useCaptureSliceRefresh`) | `apps/core-web/src/lib/core-queries.ts:162,178` |
| Read states (waiting for link, loading, 403, 503, failed, ready), gates G1-G3 and G9, refusal map, read hook, commands (ops 79, 80, 48 with `{ confirm: true }`) | `apps/core-web/src/features/devices/capture-selector.ts:88,121,134,171,224,303` |
| WB-05: panel "Capture Device Selector" (kit Select + Save per camera line, "Make primary", locked banner, PoE cycle with AlertDialog, error + rate-limited Retry, empty state) | `apps/core-web/src/features/devices/capture-selector-panel.tsx:454`; mounted `features/devices/index.tsx:197` |
| "Checking your permissions..." (E-16) | `capture-selector-panel.tsx:363` and the per-control reason lines (`data-block="CHECKING"`) |
| Empty state with the marked slot for row 137 (`data-slot="camera-search-entry"`, empty) | `capture-selector-panel.tsx:398` |
| WB-07: System → Settings → Device Settings link to `/devices#capture-selector` | `apps/core-web/src/features/system/settings-panel.tsx:246` |
| WB-02: role chip (Primary / Standby, from `captureConfig`) on the Dashboard mic tiles | `apps/core-web/src/features/dashboard/devices-panel.tsx:271` |
| WB-06: Storage write-speed caption uses the Core's `writeBytesPerSec` in Live mode (was the simulator's nominal 8.2 GB/h) | `apps/core-web/src/features/storage/kpi-cards.tsx:43,68` |
| `PrecheckCheckId` typecheck errors closed (`MIC_PRIMARY` / `MIC_STANDBY`: icon, value enum, reason, device name) | `features/session-new/devices-step.tsx:33`, `features/session-new/model.ts:136,157,168` |
| Live test bed answers ops 76/77 from the model Core by default | `apps/core-web/src/runtime/testing/live-harness.ts:379` |
| Strings: one block `devices.selector.*` | `packages/shared/src/i18n/en/devices.ts:307` |
| Tests | `features/devices/__tests__/capture-selector.test.tsx` (13), `src/test/live-devices-capture-selector.test.tsx` (9); key pin updated in `src/test/live-runtime-bridge.test.tsx` |

Mediated work for row 117 (D95): `settings-panel.tsx` now holds one import + `<SttSettingsItem />`
(`:25,252`), its six earlier edits removed; its additions in `core-queries.ts` removed; the unused
key `system.settings.transcription` removed (no user found by grep). Row 78's accepted 16→17 pins
are untouched.

## 2. Real vs stand-in

- Real: the console's read, gates, commands and UI in both data modes; in Simulated mode an edit goes
  through the simulator's own ops 79/80 (RBAC, lock, one `CAPTURE_CONFIG_CHANGED` row).
- Stand-in: Live mode is proven only on the fake transport (registry-checked requests and answers).
- Not built here (by design or by scope):
  - `sourceClass` / "Development source" badge: the field is not in the shared slice schema yet (flow 12, row 139).
  - Camera search, connect, notifications (rows 137, 133, 139).
  - WB-10: no change. The meter is already keyed by mic input (`dbfs-meter.tsx:192-194`); the timeline draws `AUDIO_SWITCH` with the default node style and its existing title; stepper progress belongs to flow 3. Left to M5-W2 / the sealing rows.
  - E-17 names two more factories (transcript, export job): they belong to flows 5/6 and have no reader in this row; not added.
  - `updateCaptureConfig` (op 78) is not called by the web selector: the spec's web edit is one Save per field (ops 79/80).

## 3. Commands and results (2026-10-09)

| Command | Result |
|---|---|
| `npm run typecheck -w @dems/core-web` | exit 0 (the two `PrecheckCheckId` errors are closed) |
| `npm run lint -w @dems/core-web` | 0 warnings |
| `npm run test -w @dems/core-web -- --maxWorkers=2 <39 touched files + static guards>` (devices, system, session-new, dashboard, storage, lib, live-devices-*, live-runtime-bridge, live-static-ac-c-53, live-runtime-static, live-system-stt-*, live-system-settings, live-dashboard-*, live-storage-page, live-strict-mode-starts, routes, fxr-w-nits, live-w0-page-logs) | 39 files, 506 tests passed (before the last two small edits); re-run of the selector, devices, system, AC-C-53 and stt-config files afterwards: all passed |
| `npm run test -w @dems/shared -- test/i18n.test.ts test/i18n-vocabulary-sync.test.ts` | 50 passed |
| Negative control: role and lock rules removed from `selectorEditGate` | 5 tests red, file restored |

Whole-workspace suite (`M4-RG-WEB`) not run by this row (driver rule): the controller runs it.

## 4. To wire / re-check when row 66 lands

1. Ops 76/77 against the real module: answer shape equals the slices; both answer for every role.
2. The Core republishes `captureConfig` after 79/80 and when a session opens or closes (`locked`); the panel relies on that republish (or on the refetch after a 409) to show the lock in Live mode.
3. Real refusals: `409 CAPTURE_CONFIG_LOCKED` with no audit row, `404` unknown id, `422` with `details.reason: DEVELOPMENT_SOURCE_NOT_ALLOWED`, `503` with `details.reason: CAPTURE_NOT_READY`.
4. Audit row of an edit: C3 §5.2 lists `operationId, scope, field, trackId/inputId, deviceId, from, to`; R-1 AC-1 and M4-SEL-W ask for "the permission" in the row. The simulator writes no `permission` key. Needs a ruling before M4-SEL-W is asserted.
5. Op 48 for a camera with `{ confirm: true }`, `409 CAMERA_NOT_LOST`. Note: the existing kebab "Restart" on camera tiles (shared Live source `deviceCommand`) sends no `confirm`; if row 66 enforces it, that menu item is refused for cameras. Outside this row's files.
6. A shared action `setCaptureConfig` was appearing in `packages/shared` during this wave; the selector does not use it.

## 5. Device/browser checks left for the gate (scripted flow, lane web on 127.0.0.1, 2 + 1)

Flow W-SEL (one session per role):
1. SUPERVISOR, idle: open Devices → selector shows 2 camera lines, 2 mic lines; on load the controls pass through "Checking your permissions..." (M4-PC-1).
2. Change VIDEO-01 to another registered camera (incl. an adopted `CAM-NN`), Save → line changes, exactly one `CAPTURE_CONFIG_CHANGED` row, slice republished (M4-SEL-W); state the lane's capture operation.
3. Make MIC-02 primary → roles swap in one republish; Dashboard mic tiles show the new roles.
4. Open a session from the tablet → locked banner, controls disabled; force an edit → `409`, no audit row (M4-LOCK-1 client half).
5. INVESTIGATOR: selector readable, edits disabled with "Requires the SUPERVISOR or TECHNICIAN role".
6. Stop the camera stream → line shows "Stream lost", PoE cycle offered (TECHNICIAN enabled, others disabled with reason); confirm → request sent.
7. System → Settings → Device Settings → "Open the capture device selector" lands on the panel.
8. Pull the link → "Waiting for the link", no control enabled; restore → lines return.
9. Storage page while recording: write-speed caption follows the Core's rate.

## 6. Decisions and deviations

- D-67-1: strings live in one block `devices.selector.*` (own namespace); the checking sentence is there too, not in `common.rbac`. A shared key for web + mobile would be cleaner; controller's call.
- D-67-2: in Live mode the two capture entries are refreshed from the replicated slices only after a gated read filled them; a read in flight is invalidated instead of overwritten.
- D-67-3: G9 is drawn on the selector's camera line (only when the stream is LOST) and reuses `deviceCommandGate`; the existing kebab menu was not changed.
- D-67-4: the role sentence names every role holding `CAPTURE_CONFIG` ("SUPERVISOR or TECHNICIAN", ux §2.4).
- Deviation, before the D95 rule arrived: the first i18n insertions (`common.ts`, `devices.ts`, `system.ts`) were made by a scripted insert. The `common.ts` and `system.ts` keys were then removed with the Edit tool; `git diff` of `common.ts` is empty. All later shared-file edits used the Edit tool.
- Not proven by a test: the System entry link (typecheck only) and the `#capture-selector` scroll.
