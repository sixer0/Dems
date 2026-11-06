# src/features/paired-devices

Up: [src/features](../README.md)

## Purpose

The Paired Devices page of the web console (`/admin/devices`, permission `PAIRING_MANAGE`): issue and cancel a pairing code for a tablet, follow its status with a countdown, and list and revoke the paired devices. Live mode only; in Simulated mode the page shows its "Live mode only" state. The pairing code returned by the Core is held in memory on this page load only and is never logged, stored or put in a query cache.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit tests and the test bed of this feature |
| [`choreography.ts`](choreography.ts) | Enter beats of the page |
| [`code-display.tsx`](code-display.tsx) | `CodeDigits`, `CodeQr`, `Countdown`: the code digits, its QR form and the countdown |
| [`code-memory.ts`](code-memory.ts) | The only memory of the pairing code (answer of operation 15): hold, reveal, cancel, end, replace, forget; `useCodeMemory` |
| [`devices-panel.tsx`](devices-panel.tsx) | `DevicesPanel`: the device list from operation 19 under `CORE_QUERY_KEYS.pairedDevices` (shared with the Devices drawer), with revoke |
| [`index.tsx`](index.tsx) | `PairedDevicesPage`: page layout; root `data-testid="page-paired-devices"` |
| [`issue-panel.tsx`](issue-panel.tsx) | `IssuePanel`: issue, show and cancel a pairing code, with its states (idle, active, redeemed, closed, error) |
| [`live-data.ts`](live-data.ts) | Live reads and sends: `usePairingReads` (operations 16 and 19), `issueCode` (15), `cancelCode` (17), `revokeDevice` (20), `callFailureOf` |
| [`model.ts`](model.ts) | Pure rules: issue-panel state, closed reason, seconds left, countdown format and tone |
| [`paired-devices.css`](paired-devices.css) | Page styles (`pd-*` classes) |
| [`panel.tsx`](panel.tsx) | `Panel` card frame and `PanelErrorBoundary` |
| [`report.ts`](report.ts) | `reportPairingError`: the page's own log reporter; a pairing code is never passed to it |
| [`revoke-dialog.tsx`](revoke-dialog.tsx) | `RevokeDialog`: confirm and send `revokeDevice` (operation 20) |

## Main exports

- `PairedDevicesPage` (`index.tsx`), the route component.
- Panels: `IssuePanel`, `DevicesPanel`, `RevokeDialog`, `CodeDigits`, `CodeQr`, `Countdown`.
- Model and hooks: `model.ts` (`issuePanelState`), `code-memory.ts` (`useCodeMemory`), `live-data.ts` (`usePairingReads`).

Routes: `/admin/devices` (`src/routes/_app/admin/devices.tsx`). The route guard `src/routes/_app/admin/-guard.ts` sends an operator without `PAIRING_MANAGE` to `/dashboard` in Live mode; the Core decides every call.

## Core operations, state and shared modules

- Operations as named in `live-data.ts`: 15 `issuePairingCode`, 16 `getPairingCodeStatus`, 17 `cancelPairingCode`, 19 `listPairedDevices`, 20 `revokeDevice`, all through the Live source's client.
- Query keys `CORE_QUERY_KEYS.pairingCode` and `CORE_QUERY_KEYS.pairedDevices`; the shell's bridge refetches them on `admin.changed` and on a resync.
- Shared modules: `@dems/shared/api`, `@dems/shared/client`, `@dems/shared/live`, `@dems/shared/realtime`, `@dems/shared/sim`.
- Console folders: [`src/lib`](../../lib/) (`core-queries.ts`, Core errors, page reporter), [`src/routes/_app/admin`](../../routes/_app/admin/).

## Tests

- [`__tests__/`](__tests__/): `code-memory.test.ts`, `model.test.ts` and the test bed `pd-bed.tsx`.
- Page-level tests in [`src/test`](../../test/): `live-paired-devices-memory.test.tsx`, `live-paired-devices-list.test.tsx`, `live-paired-devices-issue.test.tsx`, `live-shell-admin.test.tsx`.

## Related decisions

- D202, D226: a pairing code is issued in the console at `/admin/devices` to re-pair a tablet; the code is never written down.
