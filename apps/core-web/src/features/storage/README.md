# src/features/storage

Up: [src/features](../README.md)

## Purpose

The Storage page of the web console (`/storage`): the capacity ring, KPI cards, usage and sealed-per-hour charts, the volumes with health and temperatures, storage activity, the retention calculator and the storage policy with its "Manage Storage" drawer. It reads the simulator or, in Live mode, the Core's replicated `storage` and `health` state.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Model and page tests of this feature |
| [`activity-panel.tsx`](activity-panel.tsx) | `ActivityPanel`: newest storage activity rows in a scrolling list |
| [`capacity-panel.tsx`](capacity-panel.tsx) | `CapacityPanel`: the capacity ring with scale ticks and legend |
| [`chart-skeleton.tsx`](chart-skeleton.tsx) | `ChartSkeletonPanel`: the chart panel frame while the lazy chart chunk (Recharts) loads |
| [`choreography.ts`](choreography.ts) | Enter order and timings of the page (M-PG-STOR): ring sweep, KPI counters, chart draw, volume fill |
| [`index.tsx`](index.tsx) | `StoragePage`: page layout composing every panel; root `data-testid="page-storage"` |
| [`kpi-cards.tsx`](kpi-cards.tsx) | `KpiCards`: the headline storage figures (write rate, free space and others) |
| [`log.ts`](log.ts) | Structured error record of the page (`logStorageError`, correlation IDs) written to the page's own log |
| [`manage-drawer.tsx`](manage-drawer.tsx) | `ManageStorageDrawer`: changes the storage policy through `setStoragePolicy` (operation 55), SUPERVISOR or TECHNICIAN |
| [`model.ts`](model.ts) | Pure model: unit formatting, the retention formula, storage levels and thresholds, chart and list view models |
| [`panel.tsx`](panel.tsx) | `StoragePanel` card frame and `StoragePanelBoundary` error boundary |
| [`policy-panel.tsx`](policy-panel.tsx) | `PolicyPanel`: volume fill with the LOW (85 %) and FULL (98 %) thresholds, retention policy, "Manage Storage" button |
| [`retention-calculator.tsx`](retention-calculator.tsx) | `RetentionCalculator`: two number inputs with sliders and a meter, computing retention from operator input |
| [`sealed-chart.tsx`](sealed-chart.tsx) | `SealedChartPanel`: bar chart of sealed items per hour |
| [`sim-adapter.ts`](sim-adapter.ts) | Re-exports the simulator's storage views under the page's names: volume health, temperature and its series |
| [`sparkline-path.ts`](sparkline-path.ts) | `sparklinePath`: SVG path for a sparkline, or `null` under two points |
| [`sparkline.tsx`](sparkline.tsx) | `Sparkline`: accessible sparkline component |
| [`status-banner.tsx`](status-banner.tsx) | `StorageBanner`: header banner READY / LOW / FULL with free space and remaining time |
| [`storage.css`](storage.css) | Page styles |
| [`usage-chart.tsx`](usage-chart.tsx) | `UsageChartPanel`: 24-hour area chart over `storage.history` |
| [`use-new-rows.ts`](use-new-rows.ts) | `useNewRowIds`: IDs that arrived after the first render, for the row highlight |
| [`use-storage-alerts.ts`](use-storage-alerts.ts) | `useStorageAlerts`, `useEscalationKey`: a toast and one pulse on a LOW or FULL escalation seen while the page is open |
| [`volumes-panel.tsx`](volumes-panel.tsx) | `VolumesPanel`: volumes, temperatures and SMART values; in Live mode the footnote says the SMART counters are derived by the console, as the Core reports none |

## Main exports

- `StoragePage` (`index.tsx`), the route component.
- Panels: `CapacityPanel`, `KpiCards`, `UsageChartPanel`, `SealedChartPanel`, `VolumesPanel`, `ActivityPanel`, `RetentionCalculator`, `PolicyPanel`, `ManageStorageDrawer`, `StorageBanner`.
- Model and hooks: `model.ts`, `sim-adapter.ts`, `useStorageAlerts`, `useNewRowIds`.

Routes: `/storage` (`src/routes/_app/storage.tsx`).

## Core operations, state and shared modules

- Operation 55 `setStoragePolicy` (`manage-drawer.tsx`).
- State read: `storage` (with `storage.history`), `health`, the sealed-per-hour view, drive health and temperature views of the simulator.
- Shared modules: `@dems/shared/sim`, `@dems/shared/live`, `@dems/shared/tokens`, `@dems/shared/realtime`.
- Console folders: [`src/runtime`](../../runtime/) (`webErrorSink`), [`src/lib`](../../lib/), [`src/components`](../../components/).

## Tests

- [`__tests__/`](__tests__/): `storage-model.test.tsx`, `storage-page.test.tsx`.
- Page-level test in [`src/test`](../../test/): `live-storage-page.test.tsx`.

## Related decisions

- D52: on an own-capture Core the Storage domain shows "Not reported" where there is no real producer; the retention calculator keeps its body (operator input).
- D63: the storage list shows a session still in FAULT with an amber dot.
