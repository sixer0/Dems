import { toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { roleReasonText } from '@/components/role-reason-text'
import { takeDeniedPage } from '@/lib/denied-page'
import { takeConsoleLocked } from '@/lib/lock-return'
import { installRestoredPageGuard } from '@/lib/restored-page'
import { useCallback, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { motion as tokens } from '@dems/shared/tokens'
import { AuthStatus, selectAuth, useSim } from '@dems/shared/sim'
import { useMotionPolicy } from '@/motion'
import { AppShell } from './app-shell'
import { ExitGuard } from './exit-guard'
import { RouteTransition } from './route-transition'

/**
 * Upper bound for the M-APP-02 exit before `/login` is opened anyway (ms, time-scaled): the exit
 * itself takes ≈ 280 ms (content, then sidebar and top bar 60 ms apart, each `fast`), and this
 * guard makes sure an interrupted animation can never leave a signed-out operator on the shell.
 */
const LEAVE_GUARD_MS = tokens.duration.slower + tokens.duration.base

/**
 * The `_app` pathless layout body (01_specs §14.2): AppShell around the routed page.
 *
 * The route's `beforeLoad` guard covers navigation. This component covers the other exits while
 * the shell is mounted: Sign out and Lock console (user menu) and the 15-minute idle expiry
 * (simulator). When the operator is no longer signed in it leaves for `/login`, carrying
 * `?redirect=` only after an expiry, so re-authentication returns to the same page.
 *
 * Motion (step 41):
 * - M-APP-02 (two-phase, H-M1 fallback): the shell first plays its exit (panels with no stagger,
 *   then sidebar and top bar; the emblem stays for the flight back to the Login ring) and only then
 *   navigates, so the Login page's emblem can take over the top-bar emblem's `layoutId`.
 * - M-APP-04: the routed page sits in `RouteTransition` (view-transition exit, R1 enter, R7).
 * - While leaving, the page stays mounted for the exit; `ExitGuard` hides it instead of failing if
 *   it cannot render without an operator.
 */
export function AppLayout() {
  const status = useSim((s) => selectAuth(s).status)
  const navigate = useNavigate()
  const { timeScale } = useMotionPolicy()
  const href = useRouterState({ select: (state) => state.location.href })
  const hrefRef = useRef(href)
  useEffect(() => {
    hrefRef.current = href
  }, [href])

  const signedIn = status === AuthStatus.SIGNED_IN
  // Fix wave J (JW-15): a shell the browser restored from its back / forward cache after a sign-out is loaded again.
  useEffect(() => installRestoredPageGuard(), [])
  // Fix wave J (JW-14 (d)): a route guard that refused the role left for the Dashboard without a word. The refusal
  // the guard noted is said once, on the page the operator landed on: the page, and the role(s) that open it.
  const { t } = useTranslation()
  useEffect(() => {
    const denied = takeDeniedPage()
    if (denied === null) return
    const page = denied.pathname === '/admin/users' ? t('shell.nav.usersRoles') : denied.pathname === '/admin/devices' ? t('shell.nav.pairedDevices') : denied.pathname === '/session/new' ? t('common.actions.startNewSession') : denied.pathname
    toast.warning(t('web.waveJ.rbac.pageTitle', { page }), { description: roleReasonText(t, denied.permission) })
  }, [href, t])
  const left = useRef(false)
  const leave = useCallback(() => {
    if (left.current) return
    left.current = true
    void navigate({
      to: '/login',
      // Fix wave J (JT-18 / JW-19): after "Lock console" too, so the next sign-in opens the page that was locked.
      search: status === AuthStatus.EXPIRED || takeConsoleLocked() ? { redirect: hrefRef.current } : {},
      replace: true,
    })
  }, [navigate, status])

  useEffect(() => {
    if (signedIn) {
      left.current = false
      return undefined
    }
    const guard = window.setTimeout(leave, LEAVE_GUARD_MS * timeScale)
    return () => window.clearTimeout(guard)
  }, [signedIn, leave, timeScale])

  return (
    <AppShell leaving={!signedIn} onExitComplete={leave}>
      <ExitGuard leaving={!signedIn}>
        <RouteTransition>
          <Outlet />
        </RouteTransition>
      </ExitGuard>
    </AppShell>
  )
}
