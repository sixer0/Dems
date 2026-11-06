# src/features/network-time

Up: [src/features](../README.md)

## Purpose

The Network and Time page of the web console (`/network-time`): the system time hero, the time-source tiers (GNSS, NTP, RTC), the network cards with PoE ports and bandwidth, the domains diagram, the time-offset chart and a compact event log. Everything is read from the simulator's state or, in Live mode, from the Core's replicated state.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Model and page tests of this feature |
| [`charts.tsx`](charts.tsx) | `BandwidthSparkline` and `OffsetChart`: the two Recharts views, loaded as their own chunk, never animated |
| [`choreography.ts`](choreography.ts) | Enter order and timings of the page (M-PG-NET) |
| [`domains-panel.tsx`](domains-panel.tsx) | `DomainsPanel`: the network domains diagram with animated beams |
| [`events-panel.tsx`](events-panel.tsx) | `EventsPanel`: compact log of time and network events, newest first |
| [`hierarchy-panel.tsx`](hierarchy-panel.tsx) | `HierarchyPanel`: time-source tiers with the satellites in view (drawing capped at 8) |
| [`index.tsx`](index.tsx) | `NetworkTimePage`: page layout; root `data-testid="page-network-time"` |
| [`log.ts`](log.ts) | Structured error record of the page (`logNetworkTimeError`, correlation IDs) to the page's own log |
| [`model.ts`](model.ts) | Pure view maths: time tiers and levels, tones, network level, offset formatting |
| [`network-panel.tsx`](network-panel.tsx) | `NetworkPanel`: network cards, PoE ports with link LEDs, bandwidth |
| [`network-time.css`](network-time.css) | Page styles |
| [`offset-panel.tsx`](offset-panel.tsx) | `OffsetPanel`: time-offset history over `time.history` (one point per 10 s, at most 120) |
| [`panel.tsx`](panel.tsx) | `NetworkTimePanel` card frame and `NetworkTimeBoundary` error boundary |
| [`sim-adapter.ts`](sim-adapter.ts) | Re-exports the simulator's network and time views under the page's names |
| [`status-banner.tsx`](status-banner.tsx) | `NetworkTimeBanner`: header banner with the time half and the network half |
| [`system-time-panel.tsx`](system-time-panel.tsx) | `SystemTimePanel`: the clock at UTC+07:00, zone and sync chips, the timestamp chain and the A/V sync strip |
| [`use-network-time-alerts.ts`](use-network-time-alerts.ts) | `useNetworkTimeAlerts`, `useTimeEscalationKey`: toasts on GNSS loss, fall to RTC and tablet link loss |

## Main exports

- `NetworkTimePage` (`index.tsx`), the route component.
- Panels: `SystemTimePanel`, `HierarchyPanel`, `NetworkPanel`, `DomainsPanel`, `OffsetPanel`, `EventsPanel`, `NetworkTimeBanner`.
- Model and hooks: `model.ts`, `sim-adapter.ts`, `useNetworkTimeAlerts`.

Routes: `/network-time` (`src/routes/_app/network-time.tsx`).

## Core operations, state and shared modules

- No Core operation is called by this folder; it reads state only: `time` (with `time.history`), the network and domain views and the A/V sync view of the simulator.
- Shared modules: `@dems/shared/sim`, `@dems/shared/domain`, `@dems/shared/realtime`, `@dems/shared/tokens`.
- Console folders: [`src/runtime`](../../runtime/) (`webErrorSink`), [`src/components`](../../components/).

## Tests

- [`__tests__/`](__tests__/): `network-time-model.test.tsx`, `network-time-page.test.tsx`.
- Page-level test in [`src/test`](../../test/): `live-w0-page-logs.test.tsx`.

## Related decisions

- D52: on an own-capture Core the Network and Time domains show "Not reported" where there is no real producer.
- D63: the network-time list shows a session still in FAULT with an amber dot.
