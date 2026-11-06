# `apps/mobile/src/layout`

Up: [`src/`](../README.md)

## Purpose

Layout helpers: the layout class (compact, medium, expanded) from the window size in dp, the navigation chrome it implies, `SafeScreen` (the screen root with safe-area edges and the `screen-<id>` test id) and `PaneLayout` for the list-and-detail panes that re-flow on rotation and split screen.

## Contents

| Entry | Role |
|---|---|
| `index.ts` | Public surface of the layout folder (re-exports). |
| `layout.test.tsx` | Test: SafeScreen, ChromeInsetsProvider and PaneLayout. |
| `pane-layout.tsx` | Pane re-flow on rotation and split-screen: `LinearTransition` on the `gentle` spring - under FULL motion only (`paneReflowFor`). |
| `safe-screen.tsx` | `SafeScreen`: the screen root with its safe-area edges and the chrome insets provider. |
| `use-layout-class.test.ts` | Test: Window size → layout class and navigation chrome. |
| `use-layout-class.ts` | Layout classes, computed from the window size in dp (before insets). |

## Main exports

- Public surface (`index.ts`): `BREAKPOINTS`, `NAV_DIMENSIONS`, `layoutClassFor`, `navChromeFor`, `useLayoutClass`, `ALL_EDGES`, `ChromeInsetsProvider`, `SafeScreen`, `useScreenEdges`, `PANE_GAP`, `PANE_REFLOW`, `paneReflowFor`, `Pane`, `PaneLayout`, `usePaneStacked`.
- Screens: `SafeScreen` (`safe-screen.tsx`).
- Hooks: `usePaneStacked`, `useScreenEdges`, `useLayoutClass`.
- Components: `PaneLayout`, `Pane`, `ChromeInsetsProvider`.

## Tests

2 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
