# `apps/mobile/src/components/composed/nav`

Up: [`src/components/composed/`](../README.md)

## Purpose

The navigation chrome (C-5): the phone bottom tab bar, the tablet navigation rail, the shared nav item, the travelling indicator and the live mini-bar shown while a session is recording. `ResponsiveTabList` picks the bar or the rail from the layout class. The layout that places them is `src/navigation/app-tabs.tsx`.

## Contents

| Entry | Role |
|---|---|
| `bottom-tab-bar.tsx` | Phone bottom tab bar (C-5; 04_mobile_specs §2.3 compact; MB 2 (350–595, 495–530)) |
| `index.ts` | Public surface of the navigation chrome (re-exports). |
| `indicator-travel.tsx` | The indicator layer that travels between items of a list. |
| `live-mini-bar-clock.test.tsx` | Test: Tests "E2E-P-3: Home\". |
| `live-mini-bar-core-clock.test.tsx` | Test: Tests "W93-1: the bottom Recording bar follows the Core clock (LIVE) and draws with React-held digits". |
| `live-mini-bar.tsx` | Live mini-bar: shown while RECORDING on any tab route (the monitor itself is a flow screen without chrome). |
| `nav-item.tsx` | One navigation item (icon and label) of the bar and the rail, with its label placement. |
| `nav-rail.tsx` | Device software version at the extended rail's foot: the simulator dataset's `SOFTWARE_VERSION`, the one source the web sidebar reads too. Round two (JW-26) |
| `responsive-tab-list.tsx` | The tab list of the headless `Tabs` navigator: the bottom bar on compact, the rail on every other class. Both are made of tab triggers of the same navigator, so rotating or resizing swaps only this list; the ... |
| `use-indicator.ts` | One trip of the indicator between two items (full motion only). |

## Main exports

- Public surface (`index.ts`): `BottomTabBar`, `LiveMiniBar`, `COLOR_FADE_MS`, `NAV_ICON_SIZE`, `NavItem`, `colorFadeBudgetMs`, `IndicatorTravelLayer`, `settledBoxStyle`, `NavRail`, `RAIL_FOOTER_VERSION`, `ResponsiveTabList`, `INDICATOR_TRAVEL_MS`, `indicatorTravelBudgetMs`, `useIndicatorTrack`.
- Hooks: `useIndicatorTrack`.
- Components: `BottomTabBar`, `IndicatorTravelLayer`, `LiveMiniBar`, `NavItem`, `NavRail`, `ResponsiveTabList`.

## Tests

2 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
