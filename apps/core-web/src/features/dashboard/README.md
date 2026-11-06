# src/features/dashboard

Up: [src/features](../README.md)

## Purpose

The Dashboard, the console's landing page after sign-in. Ten panels (test IDs `panel-a` to `panel-j`) on a grid of four rows: the hero with the room photo and the system ring, the status strip on the hero's lower edge, the evidence sealed today, the devices with their two commands, the active session, storage, security, the recent events and the quick actions. At 1920 x 1080 the rows fill the content area so the page does not scroll; below 1280 px the rows size to their content. Each panel sits in its own error boundary with a rate-limited retry. The panels load as their own chunk, so the page root renders at once and the panels follow with their enter choreography.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit and page tests of this folder |
| [`active-session-panel.tsx`](active-session-panel.tsx) | `ActiveSessionPanel`: the active session card (state, timer, camera thumbnails on the reach-gated live preview, start or open actions) |
| [`dash-panel.tsx`](dash-panel.tsx) | `DashPanel`, `PanelLink`, `PanelId`: the common panel frame with its enter beat |
| [`dashboard-model.ts`](dashboard-model.ts) | Pure view model: tones, units (`toTb`, `toGb`), mic summary, strip cell routes, the Active Session variant, events grouped by day, hourly chart data, quick actions with their role rule |
| [`dashboard-motion.ts`](dashboard-motion.ts) | Dashboard choreography: beat table (`DASH_BEATS`), panel variants and the hooks `usePanelVariants`, `useBeatDelay`, `useHeldBeat` |
| [`dashboard-panels.tsx`](dashboard-panels.tsx) | `DashboardPanels`: the ten panels in grid order, loaded as a separate chunk |
| [`dashboard.css`](dashboard.css) | Grid and panel surfaces per width tier |
| [`devices-panel.tsx`](devices-panel.tsx) | `DevicesPanel`: camera and mic tiles with the device menu (restart, test signal) and live previews |
| [`hero-panel.tsx`](hero-panel.tsx) | `HeroPanel`: the room photo, overline and tagline |
| [`index.tsx`](index.tsx) | `DashboardPage`: page root (`page-dashboard`) with a visually hidden heading; lazy-loads the panels |
| [`panel-boundary.tsx`](panel-boundary.tsx) | `PanelBoundary`: per-panel error boundary with a retry cooldown of 3 s, 6 s, 12 s (capped at 15 s) |
| [`quick-actions-panel.tsx`](quick-actions-panel.tsx) | `QuickActionsPanel`: the quick action cards, filtered by the role rule of the model |
| [`recent-events-panel.tsx`](recent-events-panel.tsx) | `RecentEventsPanel`: the latest six events |
| [`report.ts`](report.ts) | `reportDashboardError`, `newDashboardCorrelationId`: failure records through the console's page-report helper |
| [`sealed-today-panel.tsx`](sealed-today-panel.tsx) | `SealedTodayPanel`: evidence sealed today, the hourly chart and the latest item's manifest digest |
| [`security-panel.tsx`](security-panel.tsx) | `SecurityPanel`: the security posture, the time to the minute |
| [`sim-adapter.ts`](sim-adapter.ts) | Selectors over the data source: ring primitives, connecting cameras, blocked or retrying seals, open notice count, `useSealedManifestDigest` |
| [`status-bits.tsx`](status-bits.tsx) | `StatusDot`, `DrawIcon`, `Glint`: small status visuals |
| [`status-strip.tsx`](status-strip.tsx) | `StatusStripPanel`: the strip cells (cameras, mics, storage, time, network, security), each linking to its page |
| [`storage-panel.tsx`](storage-panel.tsx) | `StoragePanel`: used and free space (TB to one decimal, whole GB) |
| [`system-ring-panel.tsx`](system-ring-panel.tsx) | `SystemRingPanel`: the system state ring (the "SYSTEM READY" moment) |

## Main exports

- Screen: `DashboardPage` (`index.tsx`), root test ID `page-dashboard`; panels `ActiveSessionPanel`, `DevicesPanel`, `HeroPanel`, `QuickActionsPanel`, `RecentEventsPanel`, `SealedTodayPanel`, `SecurityPanel`, `StatusStripPanel`, `StoragePanel`, `SystemRingPanel`.
- Model: `dashboard-model.ts` (pure, no React or i18next).
- Hooks and readers: `useSealedManifestDigest` and the selectors in `sim-adapter.ts`; `usePanelVariants`, `useBeatDelay`, `useHeldBeat`.

Routes: `/dashboard` (route file `src/routes/_app/dashboard.tsx`; `/` redirects here).

## Core operations, state and shared modules

- Device commands through the `deviceCommand` action of `useCoreActions()`: operation 48 `restartDevice` and operation 49 `testDeviceSignal`. Operation 81 is retired; the panel sends it nowhere.
- Camera thumbnails use the reach-gated live preview of [`src/features/devices`](../devices/) (the Core's preview, operation 112).
- State slices read with `useSim` (directly or through selectors): `alerts`, `cameras`, `clock`, `evidence`, `mics`, `network`, `operators`, `security`, `session`, `time`.
- Shared modules: `@dems/shared/domain`, `@dems/shared/live`, `@dems/shared/realtime`, `@dems/shared/sim`, `@dems/shared/tokens`, and the hero stills from `@dems/shared/assets`.
- Console folders used: [`src/components/composed`](../../components/composed/), [`src/components/shell`](../../components/shell/), [`src/components/ui`](../../components/ui/), [`src/features/devices`](../devices/), [`src/lib`](../../lib/) (`capture-notices`, `core-errors`, `device-command-gate`, `event-words`, `own-capture`, `page-report`, `pending-control`, `seal-attention`, `system-statement`), [`src/motion`](../../motion/), [`src/runtime`](../../runtime/).

## Tests

- [`__tests__/`](__tests__/): `dashboard-model.test.tsx`, `dashboard.test.tsx`, `live-previews.test.tsx`, `session-start-d7.test.tsx`, `status-strip-narrow.test.tsx`.
- In `src/test`: [`live-dashboard-page.test.tsx`](../../test/live-dashboard-page.test.tsx), [`live-w0-page-logs.test.tsx`](../../test/live-w0-page-logs.test.tsx), [`real-core-facts.test.tsx`](../../test/real-core-facts.test.tsx), [`visual-audit-45b.test.tsx`](../../test/visual-audit-45b.test.tsx).

## Related decisions

- D46: mic tile channel taken from the track (`AUDIO-0N`) on the Dashboard and the monitor.
- D60: source half of row 110; follow-up row 110b owns `recent-events-panel.tsx` and `dashboard-model.ts`.
- D231, D232, D239, D249: live previews on the Dashboard camera tiles and the active-session thumbnail (fix wave W4-1), and the preview CPU check with the Dashboard open.
- D238: the Dashboard mic tile on the same track-status reader as Devices (routed to W4-1).
