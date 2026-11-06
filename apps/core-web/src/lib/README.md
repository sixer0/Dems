# apps/core-web/src/lib

Up: [src](../README.md)

## Purpose

Shared, page-independent code of the web console: where the Core is (endpoint and health reads), the single query definitions for Core keys that several pages read, the one error presenter for Core refusals, the one map from Core codes to operator words, the one statement of system state, and small helpers (downloads, pending controls, effect starts, class names). Pages under [`../features/`](../features/README.md) and the shell under [`../components/`](../components/README.md) import from here (as `src/lib/<file>` through the path alias); this folder imports from no feature.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit tests of this folder. |
| [`capture-notices.ts`](capture-notices.ts) | The no-device notifications of the console, read only from the Core's `alerts` slice: one notice per Core alert, told apart by reason; device and microphone input names (`captureNoticeOf`, `activeCaptureNotices`, `captureNoticeText`, `micInputName`). |
| [`core-endpoint.ts`](core-endpoint.ts) | Where the page finds the Core in each mode: REST origin and heartbeat socket URL, the allowed page origins, and the two public reads `fetchCoreHealth` (`GET /api/v1/health`) and `fetchCorePanelFirmware` (`GET /api/v1/lcd/panel-info`, operation 114). In Simulated dev and test builds the origin is `http://127.0.0.1:4400`; with `VITE_DEMS_CORE_ORIGIN=same-origin` (packaged build) it is the page's own origin. |
| [`core-errors.ts`](core-errors.ts) | The refusal presenter: one place that words what the Core answered to a call, so a refusal reads the same on every page (`describeCoreError`, `presentCoreError`, `useCoreErrorPresenter`, `requiredRoleForPermission`). Coalesces repeated offline toasts and reports to the web error sink. |
| [`core-page-walk.ts`](core-page-walk.ts) | The one paged walk of Core lists for client-built export files: `walkAuditChain` (operation 59, stored audit chain) and `walkAllEvents` (operation 63, every operational event). Asks before every page whether to go on; a sign-out ends the walk with `SIGNED_OUT_PAGE`. |
| [`core-queries.ts`](core-queries.ts) | One `@tanstack/react-query` factory per Core key read by more than one page, with its permission gate inside: role matrix (operation 10, `getRoleMatrix`), paired devices (19, `listPairedDevices`), capture config (76, `getCaptureConfig`), capture devices (77, `getCaptureDevices`), audio source intervals (82, `listAudioSourceIntervals`). |
| [`denied-page.ts`](denied-page.ts) | Notes which page a route guard refused and for which permission, so the shell can say why the operator landed on the Dashboard (`noteDeniedPage`, `takeDeniedPage`). |
| [`device-command-gate.ts`](device-command-gate.ts) | One gate model for device commands of the Dashboard tile menu and the Devices menu: permission per command and the blocking reason, for example Restart (operation 48 `restartDevice`) refused while recording (`deviceCommandGate`, `useDeviceCommandGate`). |
| [`download.ts`](download.ts) | The console's one Blob-URL download (`downloadBlob`, `downloadJsonFile`); revokes the URL after `DOWNLOAD_REVOKE_DELAY_MS`. |
| [`effect-start.ts`](effect-start.ts) | `deferEffectStart`: the one way to start a Core command or query refresh from an effect, so React StrictMode's double mount sends it once. |
| [`event-words.ts`](event-words.ts) | The one map from a Core code (audit type, event type, custody action, fault kind, severity, pre-check value, seal cause) to operator words; unknown codes are shown readably (`codeWords`, `eventTitle`, `custodyActionWords`, `faultClearedStillInFault`). |
| [`health-query.ts`](health-query.ts) | The one definition of the `['health']` query (`healthQueryOptions`, `useHealth`), read through `fetchCoreHealth`. |
| [`lock-return.ts`](lock-return.ts) | "Lock console" returns to the locked page after the next sign-in (`markConsoleLocked`, `takeConsoleLocked`). |
| [`own-capture.ts`](own-capture.ts) | The one rule for "this session is a recording of the Core's own capture" and the related platform facts: what a surface may state about such a session (`isOwnCapture`, `useOwnCaptureCore`, `usePlatformNotReported`, `useReportedSigningKey`). |
| [`packaged-csp.ts`](packaged-csp.ts) | Content-Security-Policy of the packaged build, as response header and as `<meta>` tag, plus the Vite plugin that adds the tag (`packagedCsp`, `packagedCspPlugin`, `isPackagedBuild`). |
| [`page-report.ts`](page-report.ts) | A page's own log reporter (`createPageReporter`, `reportUsersError`): writes to the in-memory web error sink of [`../runtime/`](../runtime/README.md); nothing is sent over the network. |
| [`panel-firmware-query.ts`](panel-firmware-query.ts) | The one definition of the `['panel-firmware']` query (operation 114 `getPanelFirmware`), shown on the sign-in screen. |
| [`pending-control.ts`](pending-control.ts) | "Busy at once, spinner late": the one pending-control hook for buttons that send a Core command (`usePendingControl`, `usePendingReveal`). |
| [`presentation-mode.ts`](presentation-mode.ts) | Presentation mode flag in `sessionStorage` (`dems.presentation.v1`), read and set by Login and System (`getPresentationMode`, `setPresentationMode`, `usePresentationMode`). |
| [`product-versions.ts`](product-versions.ts) | One version per component on every surface that shows versions, from operation 64 `getSystemStatus` (`systemStatusQueryOptions`, `useProductVersions`, `useSystemComponents`). |
| [`restored-page.ts`](restored-page.ts) | `installRestoredPageGuard`: a page restored from the browser's back/forward cache is reloaded, so a signed-out session is not shown again. |
| [`seal-attention.ts`](seal-attention.ts) | The console's reading of a seal that is blocked or retried, for the seal dialog, the Monitor banner and the Dashboard row (`useSealAttention`, `sealAttentionLine`). |
| [`sideways-scroll.ts`](sideways-scroll.ts) | Tells when a sideways-scrolling container has more content to the side (`sidewaysMoreOf`, `useSidewaysMore`). |
| [`system-statement.ts`](system-statement.ts) | The one statement of system state used by the header pill, the Dashboard ring and the pre-check (`systemStatementOf`, `useSystemStatement`, `linkLostOf`). |
| [`tone-icons.ts`](tone-icons.ts) | Maps the icon names stored in `@dems/shared/tokens` to `lucide-react` components (`TONE_ICONS`). |
| [`utils.ts`](utils.ts) | `cn`: tailwind-merge configured to know the design typography tokens are font sizes. |

## Main exports

- Endpoint and public reads: `coreHttpOrigin`, `coreWsUrl`, `isLiveCore`, `fetchCoreHealth`, `fetchCorePanelFirmware`, `healthQueryOptions`, `panelFirmwareQueryOptions`.
- Core read queries and gates: `captureConfigQueryOptions`, `captureDevicesQueryOptions`, `pairedDevicesQueryOptions`, `audioSourceIntervalsQueryOptions`, `systemStatusQueryOptions`, `useCaptureReadGate`, `usePairedDevicesGate`, `useRoleMatrixGate`.
- Errors and reporting: `useCoreErrorPresenter`, `describeCoreError`, `createPageReporter`.
- Words and statements: `codeWords`, `eventTitle`, `captureNoticeOf`, `systemStatementOf`, `useSystemStatement`, `useSealAttention`, `useProductVersions`.
- Controls and helpers: `usePendingControl`, `deferEffectStart`, `useDeviceCommandGate`, `downloadBlob`, `cn`, `TONE_ICONS`.

## Core operations, state and shared modules

- Core operations: 10 `getRoleMatrix`, 19 `listPairedDevices`, 59 `listAuditRows`, 63 `listEvents`, 64 `getSystemStatus`, 76 `getCaptureConfig`, 77 `getCaptureDevices`, 82 `listAudioSourceIntervals`, 114 `getPanelFirmware` (and `GET /api/v1/health`). Operation 48 `restartDevice` and 33 (fault recover) are referenced by the command gate and the event words, not called here.
- State slices read through `@dems/shared/sim` selectors: `alerts` (capture notices, system statement), session and seal state (seal attention, own capture).
- Shared package modules: `@dems/shared/api`, `@dems/shared/client`, `@dems/shared/live`, `@dems/shared/sim`, `@dems/shared/domain`, `@dems/shared/i18n`, `@dems/shared/tokens`.
- Console folders used: [`../runtime/`](../runtime/README.md) (error sink, live host, query keys, `useWebLive`), [`../motion/`](../motion/README.md) (imported by `pending-control.ts`).

## Tests

- [`__tests__/`](__tests__/): `core-endpoint`, `live-core-endpoint`, `core-page-walk`, `core-queries`, `device-command-gate`, `download`, `event-words`, `live-core-errors`, `packaged-csp`, `product-versions`.
- Page-level tests in [`../test/`](../test/README.md), for example `live-pending-control.test.tsx`, `integrity-checks.test.ts`, `live-strict-mode-starts.test.tsx`, `real-core-facts.test.tsx`.

## Related decisions

From `decisions.md` of the 2026-11-05 audit:

- D60: row 110b owns `apps/core-web/src/lib/event-words.ts`; the web shows a FAULT_CLEARED whose session is still in fault (`faultClearedStillInFault`).
- D52: on an own-capture Core the web shows "Not reported" instead of replicated model values; `own-capture.ts` holds the console side of the own-capture rule.
