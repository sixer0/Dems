/**
 * Router factory (masterplan/01_specs.md §14.2). The app (`main.tsx`) and the route tests
 * (`src/test/routes.test.tsx`) build the router the same way, so the tests exercise the real
 * route tree, guards and providers.
 *
 * Router context carries the services the guards need outside React:
 * - `sim`: the one data source of the page (auth for the `_app` guard, RBAC for `/session/new`).
 *   In Simulated mode it is the in-browser simulator; in Live mode it is the Live source, which
 *   stands in the same `Sim` type (backend task 04_client_integration_spec §2.3, ADQ-2);
 * - `queryClient`: TanStack Query;
 * - `socketFactory`: optional heartbeat socket factory (tests pass a fake; the app uses WebSocket).
 *   Simulated mode only: in Live mode the heartbeat is a view of the Live source's one socket;
 * - `coreMode`: optional; what the app knows about its data mode and how to change it (MD-4). A
 *   router built without it (every test that existed before the backend task) offers no selector.
 *
 * The mode is derived from the data source, never passed (TS-3): a simulator means Simulated, a
 * Live source means Live. The factory therefore sets the two things that follow from it and that
 * live outside React: which row of `lib/core-endpoint.ts` answers, and the defaults of the Core
 * queries.
 */
import { createRouter, type RouterHistory } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { coreModeOf, CoreMode } from '@dems/shared/live'
import type { SocketFactory } from '@dems/shared/realtime'
import type { Sim } from '@dems/shared/sim'
import { ROUTE_VIEW_TRANSITION } from './components/shell/route-view-transition'
import { setCoreEndpointMode } from './lib/core-endpoint'
import { routeTree } from './routeTree.gen'
import type { CoreModeControl } from './runtime/core-mode'
import { applyCoreQueryDefaults } from './runtime/query-bridge'

export interface RouterContext {
  sim: Sim
  queryClient: QueryClient
  socketFactory?: SocketFactory
  /** The data mode of this page load and its switch (MD-4). Absent: no selector is rendered. */
  coreMode?: CoreModeControl
}

export interface CreateAppRouterOptions {
  /** Defaults to browser history; tests pass `createMemoryHistory`. */
  history?: RouterHistory
}

export function createAppRouter(context: RouterContext, options: CreateAppRouterOptions = {}) {
  const mode = coreModeOf(context.sim)
  setCoreEndpointMode(mode)
  if (mode === CoreMode.LIVE) applyCoreQueryDefaults(context.queryClient)
  return createRouter({
    routeTree,
    context,
    ...(options.history ? { history: options.history } : {}),
    // Only the shell's content area scrolls (§14.3); reset it on navigation (M-APP-04).
    scrollToTopSelectors: ['#main-content'],
    // Page chunks are split per route (autoCodeSplitting, §4.2); warm them on hover or focus.
    defaultPreload: 'intent',
    // M-APP-04 (step 41): in-shell path changes commit inside a typed view transition, so the
    // browser fades a snapshot of the old content area while the new page enters (shell.css).
    // Search-only changes and the Login ↔ shell hand-off commit without one.
    defaultViewTransition: ROUTE_VIEW_TRANSITION,
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
