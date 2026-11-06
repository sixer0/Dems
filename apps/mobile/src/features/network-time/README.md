# `apps/mobile/src/features/network-time`

Up: [`src/features/`](../README.md)

## Purpose

Network & Time at `/network-time`: the network status card (LAN, PoE, bandwidth bars), the time synchronisation card with the GNSS > NTP > RTC tier row and the GNSS orbit, the system time card and the camera clock card from `capture-selector`. Values the Core does not report read "Not reported".

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `bandwidth-bars.tsx` | The N2 bandwidth sparkline: 12 bars, streaming at 1 Hz with animation OFF (data, not decoration; 03M M-PG-NET "isAnimationActive=false"). |
| `bandwidth-row-fit.test.tsx` | Test: Tests "R-T-3: the Bandwidth label keeps its room". |
| `camera-clocks.test.ts` | Test: Camera clock rows of Network & Time. Pure model. |
| `card-boundary.tsx` | Card error boundary for the Network & Time screen (same pattern as the Home panel boundary; P6: another feature's files are not shared code, so this feature keeps its own copy). |
| `gnss-orbit.tsx` | The GNSS orbit animation, a fixed-size Skia canvas around the GNSS icon. |
| `i18n.ts` | English copy of the `network-time` feature, mounted at `features.network-time.*` through `src/i18n/features.ts`. |
| `icon-tile.tsx` | Round tone-tinted icon tile used by the MB 9 rows (LAN, PoE, Bandwidth, GNSS / NTP) |
| `lan-sheet.tsx` | LAN Connection detail sheet (04_mobile_specs §4.14 N2: "LAN Connection (`StatusChip` Connected + chevron → detail sheet)"). |
| `live-network-time.test.tsx` | Test: Network & Time in LIVE mode. The screen changes no production file (04_client_integration_spec §7.4 "features/network-time (3) |
| `network-status-card.tsx` | N2 Network Status (04_mobile_specs §4.14; MB 9 (945–1190, 650–785)) |
| `network-time-model.test.ts` | Test: Network & Time view maths. |
| `network-time-model.ts` | Pure view maths for the mobile Network & Time screen. No React and no store access: hooks select flat slices, these helpers shape them. The rules follow the web page model (core-web `features/network-time/model.ts`, ... |
| `network-time-screen.test.tsx` | Test: Network & Time screen. Renders the real `/network-time` route with a test simulator signed in as a demo operator. Import order: the module mocks, the router harness, the feature harness. |
| `network-time-screen.tsx` | Network & Time at `/network-time`. |
| `system-time-card.tsx` | N4 System Time (04_mobile_specs §4.14; MB 9 (945–1190, 910–975)) |
| `tier-row.tsx` | The time-source hierarchy row GNSS > NTP > RTC. |
| `time-sync-card.tsx` | N3 Time Synchronization (04_mobile_specs §4.14; MB 9 (945–1190, 790–900)) |
| `time-sync-fit.test.tsx` | Test: Tests "RF-T-5: Last Sync and Time Source are shown in full". |
| `use-network-time.ts` | Data hooks of the Network & Time screen. Every `useSim` selector returns primitives or store-owned references (review 74 F74-13), so the screen re-renders at most once per second (the 1 Hz health tick). |
| `use-sheet-presence.tsx` | Mount-on-demand for kit sheets (copy of the session monitor's pattern, P6). |

## Main exports

- Screens: `NetworkTimeScreen` (`network-time-screen.tsx`).
- Hooks: `useTestSwitch`, `useTimeView`, `useNetworkView`, `useNetworkNotReported`, `useDisplaySecond`, `useBandwidthWindow`, `useTimeEscalationKey`, `useNetworkTimeAlerts`, `useSheetPresence`, `useSheetBack`.
- Components: `BandwidthBars`, `GnssOrbit`, `IconTile`, `LanSheet`, `NetworkStatusCard`, `SystemTimeCard`, `TierRow`, `TimeSyncCard`, `SheetContentSignal`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectClockSecond`, `selectNetworkView`, `selectTimeView`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

6 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
