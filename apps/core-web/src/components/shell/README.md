# src/components/shell

Up: [src/components](../README.md)

## Purpose

The application shell (AppShell) around every signed-in page: the layout, the top bar, the sidebar, the navigation drawer and bottom tabs on narrow widths, the notifications bell, the mode indicator and switch, the SECURE pill, the Live link notices, the router's error boundary and the shell and route motion. The `_app` route mounts it; pages import `PageHeader` and a few helpers from the barrel `index.ts`.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit test of the open-alerts model |
| [`acknowledge-all.tsx`](acknowledge-all.tsx) | "Acknowledge all" button and confirmation dialog, with its count or "n of N" while the run is under way |
| [`app-layout.tsx`](app-layout.tsx) | `AppLayout`: the `_app` route component; plays the exit on sign-out before `/login` opens, shows the denied-page and console-locked notices and reloads a shell restored from the back/forward cache after a sign-out |
| [`app-shell.tsx`](app-shell.tsx) | `AppShell`: composes top bar, sidebar, drawer, bottom tabs and live notices; reports operator activity through `actions.touch()` |
| [`bottom-tabs.tsx`](bottom-tabs.tsx) | Bottom tab bar below 768 px: Home, Sessions, Evidence, Devices and More (opens the drawer) |
| [`brand-emblem.tsx`](brand-emblem.tsx) | `BrandEmblem`: the brand emblem with its draw-in motion |
| [`exit-guard.tsx`](exit-guard.tsx) | `ExitGuard`: blocks input while the shell plays its exit after a sign-out |
| [`failed-start-alert.ts`](failed-start-alert.ts) | `failedStartAlertLine`: the alert-centre line of a `CAPTURE_FAULT` alert that belongs to a failed start, or `null` |
| [`index.ts`](index.ts) | Barrel export used by the `_app` route and the page rows |
| [`integrity-checks.ts`](integrity-checks.ts) | SECURE pill model: pill state, integrity checklist, cause and subtitle, derived from the simulator's own rule set |
| [`live-notices.tsx`](live-notices.tsx) | Live-mode notices: link lost (with "Retry now"), reconnected, and role changed; renders nothing in Simulated mode |
| [`live-only-state.tsx`](live-only-state.tsx) | `LiveOnlyState`: the "Live mode only" state of a page without a simulator equivalent |
| [`mode-indicator-state.ts`](mode-indicator-state.ts) | Pure state of the mode indicator (SIMULATED, or Live by its link) with `isLinkLost` and `isLinkUp` |
| [`mode-indicator.tsx`](mode-indicator.tsx) | Mode chip of the top bar; doubles as the mode switch where the build offers the choice |
| [`mode-switch.tsx`](mode-switch.tsx) | `ModeSwitch` dialog and `useModeSwitch`: the confirmed change between Live and Simulated modes |
| [`nav-drawer.tsx`](nav-drawer.tsx) | Navigation drawer below 1024 px with the full item list |
| [`nav-items.ts`](nav-items.ts) | Primary navigation: main pages, the ADMINISTRATION group, the DEVELOPER group, and the bottom tabs |
| [`notifications-bell.tsx`](notifications-bell.tsx) | Notifications bell: open alerts, acknowledge one (operation 70), acknowledge all, failed-start lines |
| [`open-alerts.ts`](open-alerts.ts) | Which alerts are still open for the operator, the unacknowledged count and the acknowledge-all plan |
| [`page-header.tsx`](page-header.tsx) | `PageHeader`: page icon, title with its reveal motion, optional subtitle and status |
| [`root-error.tsx`](root-error.tsx) | `RootError`: the router's error boundary with a friendly message, a rate-limited retry and a reload; records the error to the web error sink |
| [`route-permissions.ts`](route-permissions.ts) | Map of routes whose guard needs a permission; read by the shell only to say why it moved the operator |
| [`route-transition.tsx`](route-transition.tsx) | `RouteTransition`: page enter motion, forward or back |
| [`route-view-transition.ts`](route-view-transition.ts) | Route exit through the browser's View Transitions API and its transition types |
| [`secure-pill.tsx`](secure-pill.tsx) | SECURE pill of the top bar with its integrity checklist popover |
| [`shared-layout-ids.ts`](shared-layout-ids.ts) | Shared-element id of the brand emblem, shared with the Login page |
| [`shell-choreography.ts`](shell-choreography.ts) | Motion variants of every shell part for the hand-off, cold and exit entrances |
| [`shell-entrance.ts`](shell-entrance.ts) | Which entrance the shell plays on mount (`handoff` after login, `cold` on first load) and the session-storage key that records it |
| [`shell-motion-context.ts`](shell-motion-context.ts) | React contexts for the shell motion and the page enter delay |
| [`shell-report.ts`](shell-report.ts) | `reportShellError`: records a failure of a shell control and shows the shell's sentence |
| [`shell.css`](shell.css) | AppShell styles; sizes as CSS variables switched by width tier and sidebar mode |
| [`sidebar.tsx`](sidebar.tsx) | Sidebar navigation and footer with the component versions (operation 64 in Live mode) |
| [`top-bar.tsx`](top-bar.tsx) | Top bar: logo, date, clock, Device ID, mode indicator, bell, user menu, SECURE pill; hamburger below 1024 px |
| [`use-acknowledge-all.ts`](use-acknowledge-all.ts) | Hook behind "Acknowledge all": runs operation 70 alert by alert and reports progress |
| [`use-shell-layout.ts`](use-shell-layout.ts) | Width tier and sidebar mode (full, rail, drawer, tabs), with the stored rail choice |
| [`use-visible-nav-items.ts`](use-visible-nav-items.ts) | Navigation items shown now: live-only items need Live mode, permission items need the permission in the Core's list for the operator |
| [`user-menu.tsx`](user-menu.tsx) | User menu with Lock console and Sign out (`actions.signOut`) |

## Main exports

| Export | Used by |
|---|---|
| `AppLayout` | [src/routes](../../routes/) (`_app.tsx`) |
| `RootError` | src/routes (`__root.tsx`) |
| `PageHeader` | almost every feature page: alerts, api-reference, commissioning, devices, evidence, network-time, paired-devices, security-audit, sessions, stack-check, storage, system, users-roles |
| `LiveOnlyState` | [paired-devices](../../features/paired-devices/), [users-roles](../../features/users-roles/) |
| `useModeSwitch`, `BRAND_EMBLEM_LAYOUT_ID`, shell entrance helpers | [login](../../features/login/) |
| `AcknowledgeAllAlerts`, `reportShellError` | [alerts](../../features/alerts/) |
| `useShellMotion`, `useRouteEnterDelay` | [evidence](../../features/evidence/) and the shell parts |
| `NAV_ITEMS`, `ROUTE_PERMISSIONS`, `routePermission`, `modeIndicatorState` | barrel exports for routes and tests |

## Core operations, state and shared modules

- Operation 70 (`actions.acknowledgeAlert`): notifications bell and "Acknowledge all".
- Operation 64 (component versions): read through `src/lib/product-versions` by the sidebar footer and the top bar.
- `actions.touch()` (operator activity) in `app-shell.tsx`; `actions.signOut` in `user-menu.tsx`.
- State slices read with `useSim`: `alerts` (bell, acknowledge all), `device` (top bar), and the system severity through `selectSystemSeverity` (SECURE pill).
- Shared package modules: `@dems/shared/live` (Live link, session, permissions, actions), `@dems/shared/sim`, `@dems/shared/realtime`, `@dems/shared/tokens`, `@dems/shared/brand`.
- Console modules: [src/runtime](../../runtime/) (web live host, error sink), [src/motion](../../motion/), `src/lib/core-errors`, `src/lib/capture-notices`, `src/lib/event-words`, `src/lib/pending-control`, `src/lib/own-capture`, `src/lib/system-statement`, `src/lib/lock-return`, `src/lib/denied-page`, `src/lib/restored-page`, `src/lib/product-versions`, [ui](../ui/README.md) (`AnimatedBackground`, `BorderBeam`, `SlidingNumber`, `TextEffect`), [`role-reason-text.ts`](../role-reason-text.ts), [`demonstration-core.ts`](../demonstration-core.ts), [`component-version-text.ts`](../component-version-text.ts), and [assets/brand](../../assets/brand/) (`topo.svg`).

## Tests

- [`__tests__/`](__tests__/): `open-alerts.test.ts`.
- In [src/test](../../test/): `integrity-checks.test.ts` and `real-core-facts.test.tsx` (integrity checks), `live-shell-indicator.test.tsx` (mode indicator state), `live-shell-admin.test.tsx` (navigation items, route permissions, visible items), `routes.test.tsx`, `shell-motion.test.tsx` (exit guard, view transition, choreography), `dev-console-logging.test.tsx` (root error).
- `features/dashboard/__tests__/session-start-d7.test.tsx` covers `failed-start-alert.ts`. Most page-level tests import `SHELL_INTRO_STORAGE_KEY` from `shell-entrance.ts`.

## Related decisions

- D88 (UI cycle-2 check, U-14c): the shell top bar printed a Device ID on every page while About said "Not reported".
- D96 (row CS2): U-14c fixed with one reader `reportedCoreDeviceIdOf` for the top bar, About, settings and export files; the top bar room name hidden on an own-capture Core.
