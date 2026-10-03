/**
 * Router factory (masterplan/01_specs.md §14.2). The app (`main.tsx`) and the route tests
 * (`src/test/routes.test.tsx`) build the router the same way, so the tests exercise the real
 * route tree, guards and providers.
 *
 * Router context carries the services the guards need outside React:
 * - `sim`: the one in-browser simulator (auth for the `_app` guard, RBAC for `/session/new`);
 * - `queryClient`: TanStack Query;
 * - `socketFactory`: optional heartbeat socket factory (tests pass a fake; the app uses WebSocket).
 */
import { createRouter, type RouterHistory } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import type { SocketFactory } from '@dems/shared/realtime'
import type { Sim } from '@dems/shared/sim'
import { ROUTE_VIEW_TRANSITION } from './components/shell/route-view-transition'
import { routeTree } from './routeTree.gen'

export interface RouterContext {
  sim: Sim
  queryClient: QueryClient
  socketFactory?: SocketFactory
}

export interface CreateAppRouterOptions {
  /** Defaults to browser history; tests pass `createMemoryHistory`. */
  history?: RouterHistory
}

export function createAppRouter(context: RouterContext, options: CreateAppRouterOptions = {}) {
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
