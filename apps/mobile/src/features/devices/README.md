# `apps/mobile/src/features/devices`

Up: [`src/features/`](../README.md)

## Purpose

Devices & Inputs at `/devices` and the device detail at `/devices/[deviceId]` (a pane on tablets): the built-in camera and microphone rows, the registered devices beyond the built-in ids, device status, health chart, diagnostics, device commands (test signal, restart) and the live camera preview. The preview asks the Core for operation 112 `createCameraPreviewSession` through a reach gate and reads the MJPEG stream through the runtime's `camera-stream-transport.ts`.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `busy-state.ts` | Re-export of the runtime's `busyState`. |
| `camera-live-preview.test.tsx` | Test: The tablet's live camera preview as a consumer mounts it, `<CameraPreview livePreview />`. |
| `camera-live-stream.test.ts` | Test: The pure parts and the stream of the tablet's live camera preview. `expo/fetch` is stood in for by a controllable fake; the framing below is the one the Core writes ... |
| `camera-live-stream.ts` | The live camera preview stream of the tablet. |
| `camera-no-preview.test.tsx` | Test: On a Core in REAL capture no bundled demo picture stands where a camera picture would be. Devices & Inputs on the tablet and the phone: the row thumbnails ... |
| `camera-preview.tsx` | The camera picture of a tile, or the neutral "No preview" tile. The bundled demo media are the picture of the SIMULATED Core. On a Core in REAL capture they showed where a camera picture would be - also for the track ... |
| `camera-reach-gate.test.tsx` | Test: The tablet's reach gate of the live camera preview, the twin of the web's row 130 / 130b gate (`apps/core-web/src/features/devices/camera-live-preview.ts:211-285`). |
| `camera-reach-gate.tsx` | The reach gate of the tablet's live camera preview. The tablet twin of the web console's row 130 / 130b gate (`apps/core-web/src/features/devices/camera-live-preview.ts:211-285` and `reach-gated-preview.tsx`). |
| `device-command-dialog.tsx` | Confirmation for the device commands. The dialog is portalled above the simulator's provider, so the command runs through the caller's `onConfirm`, which holds the actions; a refusal shows a friendly toast and goes ... |
| `device-detail-screen.tsx` | Device detail at `/devices/[deviceId]`. |
| `device-detail.tsx` | Device detail body, shared by the phone route (`/devices/[deviceId]`, `variant="screen"`) and the tablet detail pane (`variant="pane"`). |
| `device-ids.ts` | Device identities of the Devices & Inputs screens. The IDs are the simulator's; the Home tiles link to `/devices/<deviceId>` with the same IDs. Shared by `devices-model.ts` and `sim-adapter.ts`. |
| `device-mic-meter.tsx` | C-2 DbfsMeter for one microphone channel. The meter is fed by `useAudioSharedValues(channel)`, so a 20 Hz audio frame causes zero React renders; the accessibility value refreshes at 1 Hz. This feature keeps its own ... |
| `device-row-deselect-drawn.test.tsx` | Test: Tests "W93-4: the Devices row that loses the selection is still drawn (tablet landscape)". |
| `device-row.tsx` | One Devices & Inputs row. A kit `ListGroup.Item` |
| `device-status-chip.tsx` | Device status chip. Faults escalate calmly: when the status rises in severity the chip pulses its scale ONCE over `escalationPulseMs` and then holds the new colour; a recovery or a same-rank change just swaps the ... |
| `devices-live-static.test.ts` | Test: Tests "Devices takes the Core through the light Live API (CLG c, AC-C-53)". |
| `devices-model.test.ts` | Test: Pure model of the Devices & Inputs screens: status codes and their calm escalation order, the design book's 2-port PoE view, the derived 1 Hz health lines and the 1 s mic peak sampler on the simulator clock ... |
| `devices-model.ts` | Pure model of the mobile Devices & Inputs screens. No React, no simulator instance: plain reads of `SimState` that return primitives or flat records, so every `useSim` selector built on them stays flat. Device IDs ... |
| `devices-screen.test.tsx` | Test: Devices & Inputs: the MB 7 list on a phone, the pushed device detail (Overview / Health / Log, diagnostics sheet, test signal, Technician-only restart, clip reset), calm fault escalation (03M P7) and the tablet list ... |
| `devices-screen.tsx` | Devices & Inputs at `/devices`. |
| `devices-states.test.tsx` | Test: Tests "E2E-T-2: Devices always shows loading, data or an error with a Retry". |
| `diagnostics-sheet.tsx` | Run diagnostics (04_mobile_specs §4.12 V5: `Button` "Run diagnostics" → `BottomSheet` of checks, `Spinner` → `StatusChip`, via `runDiagnostics()`). |
| `health-chart.tsx` | Health sparkline of one device (04_mobile_specs §4.12 V5 "Health: `victory-native` `CartesianChart` + `Line` (1 Hz, no animation)"). |
| `i18n.ts` | English copy of the `devices` feature, mounted at `features.devices.*` through `src/i18n/features.ts`. |
| `live-devices-health-caption.test.tsx` | Test: Tests "the LIVE texts". |
| `live-devices-sites.test.tsx` | Test: Devices & Inputs in LIVE mode — settle sites S2-8 (Run diagnostics, operation 65), S3-2 (the device-command dialog: Test signal, operation 49; Restart, operation 48) and S5-4 (the Restart ... |
| `panel-boundary.tsx` | Panel error boundary for Devices & Inputs: a copy of step 77's `features/dashboard/panel-boundary.tsx`, as the Storage folder keeps one (P6: no shared component outside the screen folders). |
| `real-capture-one-rule.test.tsx` | Test: On a Core in its own capture a screen states the Core's own fact, "Not reported", or nothing; a block that still shows values of the ... |
| `registered-device-detail.tsx` | "View device" of a registered device beyond the built-in ids: the body of the detail pane / screen, with what the Core's device list says of it and nothing else. No preview, no health line, no log and no command are ... |
| `registered-device-route.test.tsx` | Test: A registered device whose id is a built-in id but which stands on ANOTHER device's line opens ITS OWN details, never the fixed row's built-in detail; on the tablet the highlight follows the selected ... |
| `registered-device-rows.tsx` | The rows of the registered devices beyond the built-in ids (task 3, R-11, blueprint row 140; ruling D137 (2); ux §8f.2 "Devices rows", §8f.3), inside the Camera Devices and the Audio Inputs sections of Devices & ... |
| `registered-devices-model.test.ts` | Test: The pure roster of the devices the Core registered beyond the built-in ids (ruling D137 (2); ux §8f flow 12, §8f.3; D83, D128, D131, D136 (3)). |
| `registered-devices-model.ts` | The registered devices beyond the built-in ids, as the tablet and the phone draw them (task 3, R-11, blueprint row 140; rulings D137 (2), D128, D136 (3); ux spec §8f flow 12, §8f.3). |
| `registered-devices.test.tsx` | Test: The rows and the details of the registered devices beyond the built-in ids on the tablet and the phone (ruling D137 (2); ux §8f.2 "Devices rows", §8f.3; D83, D128, D131). |
| `sim-adapter.ts` | Local simulator adapters for the mobile Devices & Inputs screens. Everything here is a pure read of `SimState`; nothing is written back to the simulator. The web page carries the same gaps as SIM-GAP-W48-1 and W48-4; ... |
| `stream-facts.ts` | THE STREAM FACTS OF A VIDEO TRACK, AS THE CORE THIS APP SHOWS STATES THEM. The tablet's side of the rule the web console holds in `apps/core-web/src/features/devices/stream-facts.ts`. |
| `use-devices-data.ts` | Simulator reads for the Devices & Inputs screens. Every `useSim` selector returns a primitive, a store-owned reference or a flat tuple of them, so a 20 Hz audio frame or a 1 Hz health tick re-renders only what ... |
| `use-pending-press.ts` | Re-export of the runtime's `usePendingPress`. |
| `use-sheet-presence.tsx` | Mount-on-demand for kit sheets: a copy of the session monitor's pattern, kept in this feature because another feature's files are not shared code (P6). |

## Main exports

- Screens: `DeviceDetailScreen` (`device-detail-screen.tsx`), `DevicesScreen` (`devices-screen.tsx`).
- Hooks: `useCameraStreamClaim`, `useRealCaptureView`, `useCameraPreviewRetryStanding`, `useCameraReachGate`, `useNoProducerView`, `useNoProducerWord`, `useRegisteredDevices`, `useRegisteredDevice`, `useDeviceDetailTarget`, `useRegisteredStateWord`, `useDeviceStatuses`, `useDeviceStatus`, `useAssignedSource`, `useSourceRow`, `useIsRecording`, `useCanManageDevices`, `useCamera`, `useMic`, `useBookPoe`, `useTabletLink`, `useDeviceLog`, `useHealthSeries`, `useMicLevelSeries`, `usePendingPress`, `useSheetPresence`, `useSheetBack`.
- Components: `NoPreviewTile`, `CameraPreview`, `LiveCameraPreview`, `PreviewThumb`, `DevicePreviewTryAgain`, `ReachGatedCameraPreview`, `DeviceCommandDialog`, `DeviceDetail`, `DeviceMicMeter`, `DeviceRow`, `DeviceStatusChip`, `DeviceStatusDot`, `NoProducerNotice`, `DiagnosticsSheet`, `HealthChart`, `RegisteredDeviceDetail`, `RegisteredDeviceRows`, `SheetContentSignal`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectCan`, `selectRole`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `deviceCommand`, `resetClip`, `runDiagnostics`.
- Operations called directly on the Live client (`useMobileLive()?.client.call`): `createCameraPreviewSession` (`camera-live-stream.ts`).

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

15 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D173: row 190: `drawnByOwnTile`.
- D185: row 194: `camera-reach-gate.tsx`.
- D187: row 191: one reader of track source and status.
- D198: row 201: device detail commands blocked on own capture.
- D203: row 202: tablet-offline alert words.
- D213: row 198: no synthetic values on own capture.
- D215: row 227: attention devices skip set.
- D216: row 195: live preview built.
- D218: row 195: preview through `runtime/camera-stream-transport.ts`.
- D219: row 196: live preview call sites.
- D220: row 222: registered device detail target.
- D251: row 233: tablet list highlight.
- D252: row 232: "No preview" wording.
- D254: row 231: release the preview on blur.
- D255: row 229: audio inputs per channel.
- D259: row 219: `camera-live-preview.test.tsx` ownership.
