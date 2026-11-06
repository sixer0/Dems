import { useCallback, useEffect } from 'react'
import {
  RouterProvider as AriaRouterProvider,
  Card,
  Surface,
  ToastProvider,
} from '@heroui/react'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { LayoutGroup } from 'motion/react'
import { I18nextProvider, useTranslation } from 'react-i18next'
import { HEALTH_QUERY_KEY } from '@dems/shared/api'
import { liveOf } from '@dems/shared/live'
import type { LiveSim } from '@dems/shared/live/source'
import { HeartbeatContext, HeartbeatProvider } from '@dems/shared/realtime'
import { SimProvider } from '@dems/shared/sim'
import { RootError } from '@/components/shell/root-error'
import { noteTopLevelRoute } from '@/components/shell/shell-entrance'
import { i18n } from '@/i18n'
import { coreWsUrl } from '@/lib/core-endpoint'
import { MotionPolicyProvider } from '@/motion'
import type { RouterContext } from '@/router'
import { followServerPresentationMode } from '@/runtime/presentation-follow'
import { attachQueryBridge } from '@/runtime/query-bridge'
import '@/components/shell/shell.css'

/**
 * Root route (masterplan/01_specs.md §14.2): the app-wide providers. Order, outermost first:
 * Query → Heartbeat (one WS client) → Sim (started after mount, stopped on unmount) → i18n →
 * React Aria router bridge (kit links and menu items navigate client-side) → MotionPolicyProvider →
 * the full-viewport surface with the toast region. `/login` and the `_app` shell render inside.
 *
 * Motion (step 41; 03_motion_spec §4, §8, §9.5; D59):
 * - `MotionPolicyProvider` (step 36) replaces the bare `MotionConfig reducedMotion="user"`: it
 *   resolves the policy (OS setting, the in-app switch, `?motion=`), provides the motion kit,
 *   marks `<html data-motion>`, and mounts the `?debug=1` overlay.
 * - One root `LayoutGroup` scopes the R5 shared-element IDs (`brand-emblem` for the Login ↔ shell
 *   flight, and the page IDs such as `feed-<cameraId>`).
 * - H-M1 (keep the exiting route mounted in a keyed `AnimatePresence`) does not hold for TanStack
 *   Router 1.170: an exiting copy's `<Outlet />` re-renders with the new route. So the top level
 *   is not wrapped in a keyed `AnimatePresence`; M-APP-01/02 use the two-phase fallback (each side
 *   plays its own exit before navigating) and the emblem still flies through the shared layoutId.
 *   Evidence: implementation/21_shell_motion.md §3 and `src/test/shell-motion.test.tsx`.
 *
 * Live mode (backend task 04_client_integration_spec §5.1 step 6, CL-7, PG-6; plan row W50). The
 * mode is read from the data source in the router context (`liveOf`): a simulator renders the
 * tree above, unchanged. A Live source changes three things:
 * - Heartbeat: no second socket client is built. `HeartbeatContext` is provided from the Live
 *   source's own heartbeat view, so `useHeartbeat()` and every Core-link reader work as before on
 *   the one socket of the page (CL-7).
 * - The query bridge is attached for the lifetime of the root: `admin.changed` refetches the
 *   administration lists, and the end of a session or the loss of an administration permission
 *   REMOVES every `['core', …]` entry (`runtime/query-bridge.ts`).
 * - Life cycle: the provider only PROVIDES a Live source (`autoStart` is false for it). The entry
 *   created and started it before the router existed, and it lives as long as the page; the mode
 *   switch stops it before the page is loaded again. A component effect must not own that life
 *   cycle: under StrictMode the provider's start-stop-start at mount would close and reopen the
 *   socket once at every page load and run the session bootstrap a second time. The simulator is
 *   started and stopped by the provider as before.
 */
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: NotFound,
})

function RootLayout() {
  const { sim, queryClient, socketFactory } = Route.useRouteContext()
  const router = useRouter()
  // Null for a simulator. The type is the Live source's; the import is type-only (MD-6).
  const live = liveOf<LiveSim>(sim)
  useEffect(() => (live ? attachQueryBridge(live, queryClient) : undefined), [live, queryClient])
  useEffect(() => (live ? followServerPresentationMode(live) : undefined), [live]) // WS-10 (W55, decision D128): on every route, for the lifetime of the root
  // Refresh health after a WS reconnect (01_specs §5.5/§5.6 resync).
  const resync = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY })
  }, [queryClient])
  const navigate = useCallback((href: string) => {
    void router.navigate({ href })
  }, [router])
  // The shell reads which top-level route it replaced (M-APP-01 hand-off vs M-APP-03 cold entry).
  const topLevelRouteId = useRouterState({ select: (state) => state.matches[1]?.routeId })
  useEffect(() => {
    noteTopLevelRoute(router, topLevelRouteId)
  }, [router, topLevelRouteId])

  const source = (
    <SimProvider sim={sim} autoStart={live === null}>
      <I18nextProvider i18n={i18n}>
        <AriaRouterProvider navigate={navigate} useHref={identityHref}>
          <MotionPolicyProvider>
            <Surface variant="transparent" className="min-h-dvh bg-background text-foreground">
              <LayoutGroup id="dems">
                <Outlet />
              </LayoutGroup>
              <ToastProvider />
            </Surface>
          </MotionPolicyProvider>
        </AriaRouterProvider>
      </I18nextProvider>
    </SimProvider>
  )

  return (
    <QueryClientProvider client={queryClient}>
      {live ? (
        <HeartbeatContext.Provider value={live.heartbeat}>{source}</HeartbeatContext.Provider>
      ) : (
        <HeartbeatProvider url={coreWsUrl()} onResync={resync} {...(socketFactory ? { socketFactory } : {})}>
          {source}
        </HeartbeatProvider>
      )}
    </QueryClientProvider>
  )
}

/** App paths are absolute and the app has no basepath, so an href is already a URL. */
function identityHref(href: string): string {
  return href
}

function NotFound() {
  const { t } = useTranslation()
  return (
    <Surface
      variant="transparent"
      className="flex min-h-dvh items-center justify-center bg-background p-6"
      data-testid="page-not-found"
    >
      <Card className="w-full max-w-md rounded-xl">
        <Card.Header>
          <Card.Title>{t('common.errors.notFoundTitle')}</Card.Title>
          <Card.Description>{t('common.errors.notFoundBody')}</Card.Description>
        </Card.Header>
        <Card.Footer>
          <Link to="/dashboard" className="text-link underline-offset-4 hover:underline">
            {t('shell.nav.dashboard')}
          </Link>
        </Card.Footer>
      </Card>
    </Surface>
  )
}
