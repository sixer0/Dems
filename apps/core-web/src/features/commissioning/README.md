# src/features/commissioning

Up: [src/features](../README.md)

## Purpose

The commissioning screen of the camera network (`/admin/commissioning`), for TECHNICIAN only (`CAPTURE_COMMISSION`): the network settings of the capture network, the factory address scan, the temporary host address, the set-IP job for a scanned camera, and the installation acceptance with its revocation. Every write is carried out only by a Core in production capture operation; any other Core refuses it and the screen says so. Nothing scans by itself.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Tests of this feature |
| [`acceptance-model.ts`](acceptance-model.ts) | Requests, refusals and form rules of the installation acceptance (operation 109 `acceptInstallation`) and its revocation (operation 110 `revokeInstallationAcceptance`) |
| [`acceptance.tsx`](acceptance.tsx) | `AcceptancePanel`: the acceptance form, its steps and the revoke form |
| [`commissioning.css`](commissioning.css) | Screen styles (`com-*` classes); nothing animates |
| [`index.tsx`](index.tsx) | `CommissioningPage`: role check, the three base panels (network settings, scan, temporary host address) plus the set-IP and acceptance panels; root `data-testid="page-commissioning"` |
| [`model.ts`](model.ts) | Requests, refusals and form rules of operations 101 to 105: `readNetworkConfig`, `updateNetworkConfig`, `scanFactoryCameras`, `readHostAlias`, `removeHostAlias`; works in both data modes |
| [`parts.tsx`](parts.tsx) | Shared panel pieces: the card with its error boundary, the rate-limited retry button, the refusal alert |
| [`refusal.ts`](refusal.ts) | Hooks that word and record a refused request, shared by every panel |
| [`report.ts`](report.ts) | `reportCommissioningError`: the screen's own log through the console's page reporter; no address or credential in a record |
| [`set-ip-model.ts`](set-ip-model.ts) | Requests, refusals and form rules of the set-IP job: operation 106 `setCameraNetwork` and 107 `getCameraNetworkJob` (polling) |
| [`set-ip.tsx`](set-ip.tsx) | `SetIpPanel`: the set-IP screens, started from a row of the scan result, with a camera account typed for one job and never stored |

## Main exports

- `CommissioningPage` (`index.tsx`), the route component.
- Panels: `AcceptancePanel`, `SetIpPanel`, and the shared `Panel`, `PanelErrorBoundary`, `RetryButton`, `RefusalAlert`.
- Models: `model.ts`, `set-ip-model.ts`, `acceptance-model.ts`.

Routes: `/admin/commissioning` (`src/routes/_app/admin/commissioning.tsx`). The route guard `src/routes/_app/admin/-guard.ts` (`requireCorePermission`) sends an operator without `CAPTURE_COMMISSION` to `/dashboard` in Live mode; the Core decides every call.

## Core operations, state and shared modules

- Operations 101 and 102 (network configuration), 103 (factory camera scan), 104 and 105 (temporary host address), 106 `setCameraNetwork` and 107 `getCameraNetworkJob`, 109 `acceptInstallation` and 110 `revokeInstallationAcceptance`.
- Reads use `@tanstack/react-query`; the settings form uses `react-hook-form` with `zod` through `@hookform/resolvers/zod`.
- Shared modules: `@dems/shared/api`, `@dems/shared/client`, `@dems/shared/live`, `@dems/shared/realtime`, `@dems/shared/sim`.
- Console folders: [`src/lib`](../../lib/) (page reporter, Core errors), [`src/routes/_app/admin`](../../routes/_app/admin/).

## Tests

- [`__tests__/`](__tests__/): `commissioning.test.tsx`.
- Page-level test in [`src/test`](../../test/): `live-shell-admin.test.tsx`.

## Related decisions

- D78: the stored camera segment is checked through the signed-in console (camera network and commissioning view).
- D80: storing `interfaceName` through operation 102 on `/admin/commissioning` needs a TECHNICIAN (a user action).
- D140, D141: `commissioning.test.tsx` scan case noted as a load flake; passed in the full run.
