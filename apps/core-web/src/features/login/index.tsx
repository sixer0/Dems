/**
 * Login page `/login` (step 43; masterplan/01_specs.md §14.8; research/04 §5.8; 03_motion_spec
 * M-PG-LOGIN, M-C-22, M-APP-01 Login side, M-APP-02 arrival). Replaces step 38's stub; keeps the
 * export `LoginPage` and the root test ID `page-login` (implementation/19_app_shell.md §2).
 *
 * Layout (≥ 1280 a 7 | 5 split; 6 | 6 at 1024-1279; a 280 px brand band above the card at
 * 768-1023; a full-bleed backdrop with the card over it below 768):
 * - brand side: the licensed room still (object-position 62% 45%, dark-warm grade; D46), GlowRing
 *   (`login` mode) around the large emblem, "SECURE BY DESIGN. TRUSTED BY LAW.", the gold
 *   rule, the vertical RECORD / PRESERVE / PROTECT and the device strip; never the officer photo
 *   of the mobile mockup (D28);
 * - auth side: the sign-in card (fields and gold Sign In with dark text from the mobile Login,
 *   D28/Q5; "Use security key (simulated)", D28/Q15; the 3 synthetic demo operators in a
 *   collapsible Disclosure, hidden in presentation mode; the §20.1 trust line) and the footer.
 *
 * The 8 states of §14.8 are exposed as `data-state` on the page root: idle, validating,
 * submitting, error, locked, offline, signed-out (signed out / console locked / expired), success.
 *
 * Hand-off (M-APP-01; the two-phase fallback proven in step 41, D65): on success the card, text
 * and ring play their exit while the emblem stays; when the card's exit completes (t = 450) the
 * page navigates to the validated `?redirect=` target (or `/dashboard`). The shell mounts in the
 * same commit and its top-bar emblem flies from this emblem's box through the shared
 * `BRAND_EMBLEM_LAYOUT_ID`. A guard timer always leaves, even if an animation is interrupted.
 *
 * Live mode (backend task 04_client_integration_spec §5.2 to §5.6; plan row W55): the same page
 * on the Core server. The layout, the components and the motion do not change; what changes is
 * where each value comes from (`use-login-controller.ts`). The page adds the mode selector of a
 * dev build (§3.2, MD-4) and takes a hand-off back when the session ended before the page was
 * left. `data-core-mode` on the root says which data source the page runs on. The tab's
 * presentation flag is kept in step with the server by the root route, not here (WS-10).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getRouteApi, useNavigate, useRouter } from '@tanstack/react-router'
import { animate, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { SOFTWARE_VERSION } from '@dems/shared/sim'
import { useModeSwitch } from '@/components/shell/mode-switch'
import { lastTopLevelRoute } from '@/components/shell/shell-entrance'
import { useMotionPolicy } from '@/motion'
import { AuthCard } from './auth-card'
import { BrandSide, LoginBackdrop } from './brand-panel'
import { buildLoginChoreography, HANDOFF, SHAKE_KEYFRAMES, SHAKE_MS, type LoginArrival } from './login-choreography'
import { ringSizeFor, ringStateFor } from './login-model'
import { revealProps } from './login-motion'
import { reportLoginIssue } from './report'
import { usePresentationMode } from './sim-adapter'
import { useLoginController, type LoginField } from './use-login-controller'
import { useLoginTier } from './use-login-tier'
import './login.css'

const loginRoute = getRouteApi('/login')

export function LoginPage() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const router = useRouter()
  const navigate = useNavigate()
  const { redirect } = loginRoute.useSearch()
  const { tier, tall } = useLoginTier()
  const presentation = usePresentationMode()
  // The one confirmed mode change of the console (D144(1), CPW1-1): the shell's hook, naming this
  // page in the page's own log.
  const modeSwitch = useModeSwitch('login.modeSwitch')

  // Where the operator came from, read once on mount (the root records the top-level route only
  // after this page has committed): `/_app` means a sign-out from the shell (M-APP-02).
  const [previousTopLevel] = useState(() => lastTopLevelRoute(router))
  const arrival: LoginArrival = previousTopLevel === '/_app' ? 'return' : 'cold'
  const choreography = useMemo(() => buildLoginChoreography(arrival, m.reduced), [arrival, m.reduced])

  const [leaving, setLeaving] = useState(false)
  const shakeRef = useRef<HTMLDivElement>(null)
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const target = redirect ?? '/dashboard'

  // Warm the shell's code while the operator types (DR-38-12, DR-41-20: the router loads route
  // chunks before it commits, so a cold chunk would hold the emblem at the commit). Code only: no
  // guard runs, nothing is navigated.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        void router.loadRouteChunk(router.routesById['/_app'])?.catch((error: unknown) => reportLoginIssue('warn', 'login.preload.shell', error))
      } catch (error) {
        reportLoginIssue('warn', 'login.preload.shell', error)
      }
    }, m.seconds(choreography.focusAtMs) * 1000)
    return () => clearTimeout(id)
  }, [router, m, choreography.focusAtMs])

  /** `leaving`, readable by a callback that was created before the state changed. */
  const leavingRef = useRef(false)
  const onAccepted = useCallback(() => {
    leavingRef.current = true
    setLeaving(true)
    // Signed in now, so the target's guard passes: load its chunks during the 450 ms exit.
    // `href` wins over `to` in the router's buildLocation; `to` only satisfies the preload typing.
    router.preloadRoute({ to: '/', href: target }).catch((error: unknown) => reportLoginIssue('warn', 'login.preload.target', error))
  }, [router, target])

  // M-C-22 Error: one card shake (P7 allows a single functional shake); reduced motion keeps only
  // the red field borders.
  const onRejected = useCallback(() => {
    const target = shakeRef.current
    if (!target || m.reduced) return
    void animate(target, { x: SHAKE_KEYFRAMES }, { duration: m.seconds(SHAKE_MS), ease: 'easeInOut' })
  }, [m])

  const onFocusField = useCallback((field: LoginField) => {
    // After the state update commits (a field disabled while pending is enabled again first).
    setTimeout(() => (field === 'username' ? usernameRef : passwordRef).current?.focus(), 0)
  }, [])

  const navigated = useRef(false)
  // Live mode: the session ended before the hand-off left this page. The card comes back.
  const onHandOffLost = useCallback(() => {
    navigated.current = false
    leavingRef.current = false
    setLeaving(false)
  }, [])

  const controller = useLoginController({ previousTopLevel, onAccepted, onRejected, onFocusField, onHandOffLost })

  const finishHandOff = useCallback(() => {
    // A late exit callback of a hand-off that was taken back must not navigate.
    if (navigated.current || !leavingRef.current) return
    navigated.current = true
    navigate({ href: target, replace: true }).catch((error: unknown) => {
      navigated.current = false
      reportLoginIssue('error', 'login.handoff.navigate', error, { hasRedirect: redirect !== undefined })
    })
  }, [navigate, target, redirect])

  // The guard: whatever happens to the exit animation, a signed-in operator leaves the Login page.
  useEffect(() => {
    if (!leaving) return undefined
    const id = setTimeout(finishHandOff, m.seconds(HANDOFF.guardMs) * 1000)
    return () => clearTimeout(id)
  }, [leaving, finishHandOff, m])

  const ringSize = ringSizeFor(tier, tall)
  // §3.5: a Core server that is starting is shown as one that cannot be used yet.
  const ringState = ringStateFor({ locked: controller.lockout.locked, coreLink: controller.coreStarting ? 'offline' : controller.coreLink })

  return (
    <main
      id="main-content"
      className="dems-login"
      data-testid="page-login"
      data-state={controller.displayState}
      data-tier={tier}
      data-arrival={arrival}
      data-motion={m.policy}
      data-leaving={leaving ? 'true' : 'false'}
      data-presentation={presentation ? 'true' : 'false'}
      data-core-link={controller.coreLink}
      data-core-mode={controller.mode}
    >
      <LoginBackdrop choreography={choreography} leaving={leaving} cropOnLeave={tier === 'wide'} />
      <BrandSide
        tier={tier}
        ringSize={ringSize}
        ringState={ringState}
        choreography={choreography}
        coreLink={controller.coreLink}
        scanning={controller.pending !== null}
        leaving={leaving}
      />
      <section className="dems-login-auth" aria-labelledby="login-title">
        <AuthCard
          controller={controller}
          choreography={choreography}
          leaving={leaving}
          onExitComplete={finishHandOff}
          presentation={presentation}
          modeSwitch={modeSwitch}
          shakeRef={shakeRef}
          usernameRef={usernameRef}
          passwordRef={passwordRef}
        />
        <motion.footer
          className="dems-login-footer"
          {...revealProps(m, { delayMs: choreography.cardMs, leaving, exitDelayMs: HANDOFF.cardDelayMs })}
        >
          <span className="dems-login-footer-version">{t('common.brand.version', { version: SOFTWARE_VERSION })}</span>
          <span className="dems-login-footer-triplet">{t('common.brand.triplet')}</span>
        </motion.footer>
      </section>
      <p className="sr-only" role="status" aria-live="polite" data-testid="login-announcement">
        {controller.accepted ? t('login.successAs', { name: controller.accepted.displayName }) : ''}
      </p>
      {modeSwitch.dialog}
    </main>
  )
}
