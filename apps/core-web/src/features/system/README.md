# src/features/system

Up: [src/features](../README.md)

## Purpose

The System and Maintenance page of the web console (`/system`): quick actions, the board of the Core services, health sparklines, the software update card, the About panel, the console settings (including the Transcription (STT) configuration), Diagnostics and Maintenance with the log export, the front-panel (LCD) setup for the vendor accounts, and the Demo Control Panel. In Simulated mode every panel reads the in-browser simulator; in Live mode the panels read the Core's replicated state and call the Core's operations.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit and page tests of this feature |
| [`about-panel.tsx`](about-panel.tsx) | `AboutPanel`: the About list (12 items); in Live mode the component versions come from the Core's own statement (operation 64), never the model's field |
| [`choreography.ts`](choreography.ts) | Enter order and timings of the page's panels (M-PG-SYS motion spec): panel beat, row stagger, diagnostics bar fill |
| [`demo-panel.tsx`](demo-panel.tsx) | `DemoPanel`: the Demo Control Panel (inject or clear faults, load a scenario, recover, reset the clip or the demo) over the simulator actions |
| [`diagnostics.tsx`](diagnostics.tsx) | `MaintenancePanel` and `DiagnosticsModal`: Run Diagnostics (one bar per check, then a summary), Restart services and Export logs; the restart button is disabled with a reason on a Core in its own capture (operation 66 refused) |
| [`export-logs-dialog.tsx`](export-logs-dialog.tsx) | `ExportLogsDialog`: collects the reason the Core requires for a log export (5 to 500 characters, operation 62) and treats the Core's 422 as the judge |
| [`health-panel.tsx`](health-panel.tsx) | `HealthPanel`: plain-SVG streaming health sparklines (no animation) |
| [`index.tsx`](index.tsx) | `SystemPage`: the page layout (12 columns from 1280 px) that composes every panel; root `data-testid="page-system"` |
| [`live-log-export.ts`](live-log-export.ts) | Builds the log export file in Live mode from the stored audit chain (operation 59 `listAuditRows`) and every event (operation 63 `listEvents`), after the Core accepted the export; the Core writes no file itself |
| [`live.ts`](live.ts) | Pure helpers and small hooks of Live mode: `useSystemLiveMode`, `useDemoPanelVisible` (when the Demo Control Panel may show), `usePanelSetupVisible`, `newestOwnRow` |
| [`log.ts`](log.ts) | The page's own log reporter (`reportSystemError`, `logSystemError`, correlation IDs) bound to the console's page reporter; records stay in the page log, never sent anywhere |
| [`model.ts`](model.ts) | Pure view models: required role per action, service tones and counts, banner tone, uptime format, sparkline path, update view, NVMe partitions, diagnostics summary |
| [`panel-setup-panel.tsx`](panel-setup-panel.tsx) | `PanelSetupPanel`: the pre-delivery front-panel setup (the two words and the logo of the LCD panel), shown only to the two vendor accounts; the Core checks the same identity rule on every request |
| [`panel.tsx`](panel.tsx) | `SystemPanel` card frame (header with chip, summary figure, switch) and `SystemPanelBoundary`, its error boundary |
| [`quick-actions.tsx`](quick-actions.tsx) | `QuickActions`: Run Diagnostics, Review Audit, Export Evidence, Software Update |
| [`services-panel.tsx`](services-panel.tsx) | `ServicesPanel`: the 17 Core services with responsibility, status chip and uptime |
| [`settings-panel.tsx`](settings-panel.tsx) | `SettingsPanel`: console preferences (the Core's `settings` slice, operation 68), active camera, links to the maintenance and identity panels, and the STT settings item |
| [`sim-adapter.ts`](sim-adapter.ts) | Reads and writes over the simulator: uptime anchors, `restartCoreServices`, presentation mode, console preferences (stored per browser, `PREFS_STORAGE_KEY`), the Demo Control Panel's open flag |
| [`status-banner.tsx`](status-banner.tsx) | `SystemBanner`: the header banner (services line and "running, version, slot") |
| [`stt-config-model.ts`](stt-config-model.ts) | Pure rules of the Transcription (STT) configuration: draft, validation, update body; the draft never holds a credential the Core returned |
| [`stt-config-queries.ts`](stt-config-queries.ts) | The STT section's Core calls: operation 90 `getSttConfig` (query), 91 `updateSttConfig`, 92 `testSttConnection`, with their gate |
| [`stt-config-section.tsx`](stt-config-section.tsx) | `SttConfigSection` and `SttSettingsItem`: the STT form with the permission-gated Save and Test connection controls |
| [`system.css`](system.css) | Page styles; only transform, opacity and colours transition |
| [`update-panel.tsx`](update-panel.tsx) | `UpdatePanel`: software update card (A/B slots, rollback target, `startSoftwareUpdate`) |
| [`use-sim-command.ts`](use-sim-command.ts) | `useSimCommand` (runs a command with structured logging and a toast) and `useStartDiagnostics` (`runDiagnostics`) |

## Main exports

- `SystemPage` (`index.tsx`), the route component.
- Panels: `AboutPanel`, `DemoPanel`, `MaintenancePanel`, `DiagnosticsModal`, `ExportLogsDialog`, `HealthPanel`, `PanelSetupPanel`, `QuickActions`, `ServicesPanel`, `SettingsPanel`, `SttConfigSection`, `SystemBanner`, `UpdatePanel`.
- Model and hooks: `model.ts` (pure view models), `live.ts` (`useSystemLiveMode`, `useDemoPanelVisible`, `usePanelSetupVisible`), `use-sim-command.ts`, `stt-config-queries.ts` (`sttConfigQueryOptions`, `useSttConfigGate`), `live-log-export.ts` (`buildLogExportFile`).

Routes: `/system` (`src/routes/_app/system.tsx`).

## Core operations, state and shared modules

- Operations named in the code: 59 `listAuditRows`, 60 (audit chain lineage, demo reset), 61 and 62 (export accepted, `exportLogs` with a reason), 63 `listEvents`, 64 (component versions), 66 `restartServices`, 68 (console `settings`), 90 `getSttConfig`, 91 `updateSttConfig`, 92 `testSttConnection`.
- Simulator and Core actions: `runDiagnostics`, `exportLogs`, `restartServices`, `setPresentationMode`, `updateSettings`, `resetDemo`, `startSoftwareUpdate`, `setActiveCamera`, and the demo actions `inject`, `clearFault`, `loadScenario`, `recover`, `resetClip`.
- `useSim` state slices: `device`, `audit`, `faults`, `diagnostics`, `auth`, `update`, `settings`, the services view.
- Shared modules: `@dems/shared/sim`, `@dems/shared/live`, `@dems/shared/api`, `@dems/shared/realtime`, `@dems/shared/tokens`.
- Console folders: [`src/lib`](../../lib/) (page reporter, Core errors), [`src/runtime`](../../runtime/) (`webErrorSink`), [`src/components`](../../components/).

## Tests

- [`__tests__/`](__tests__/): `demo-failed-start.test.tsx`, `stt-config-model.test.ts`, `system-model.test.tsx`, `system-page.test.tsx`.
- Page-level tests in [`src/test`](../../test/): `live-system-export.test.tsx`, `live-system-stt-config.test.tsx`, `live-system-stt-secret.test.tsx`, `live-system-demo.test.tsx`, `live-system-settings.test.tsx`.

## Related decisions

From `decisions.md` of the 2026-11-05 audit:

- D52: on an own-capture Core the System page shows "Not reported" for model-only values; Diagnostics and Maintenance keep their bodies.
- D57: About panel on an own-capture Core (no synthetic chip, model-only fields "Not reported").
- D63: the system demo panel keeps the hash-chained audit record text unchanged.
- D74, D76: UI checks of `/system` (settings wording, capture-worker version shown).
- D81, D83: operation 66 `restartServices` refused on an own-capture Core; the console disables the button with a reason.
