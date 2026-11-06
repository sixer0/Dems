// Step 43: the Login page through the real router, guards and providers (01_specs §14.8;
// AC-49, AC-50 UI path, AC-66, AC-70; 03_motion_spec M-C-22, M-APP-01/02, §8).
//
// Each test builds its own simulator (in-memory storage unless the test says otherwise, D54(a)),
// a heartbeat socket the test drives, and a memory history. Motion skips animations (setup.ts), so
// the presentational verification beat is skipped too; the two tests that look at the Submitting
// and Success states in flight switch real animations on.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  AUTH_STORAGE_KEY,
  AuthStatus,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  DEMO_OPERATOR_PASSWORD,
  OPERATOR_IDS,
  SignOutReason,
  type ControllableClock,
  type Sim,
} from '@dems/shared/sim'
import { en } from '@dems/shared/i18n'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { PRESENTATION_MODE_STORAGE_KEY, resetPresentationModeForTests, setPresentationMode } from '@/lib/presentation-mode'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter, type AppRouter } from '@/router'

const WRONG_PASSWORD = 'wrong-secret-77'

/** A heartbeat socket the test drives: `beat()` delivers a valid heartbeat, `drop()` closes it. */
class TestSocket implements SocketLike {
  readyState = 0
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  close() {
    this.readyState = 3
  }
  beat(seq: number) {
    this.onmessage?.({
      data: JSON.stringify({
        type: 'heartbeat',
        v: 1,
        seq,
        serverTime: new Date().toISOString(),
        uptimeMs: seq * 1000,
        intervalMs: 1000,
        clients: 1,
        sessionState: null,
      }),
    })
  }
  drop() {
    this.onclose?.({ code: 1006 })
  }
}

interface MountOptions {
  operatorId?: string | null
  width?: number
  reduced?: boolean
  clock?: ControllableClock
  /** Use the simulator's default storages (jsdom sessionStorage), for AC-50. */
  webStorage?: boolean
}

interface Harness {
  sim: Sim
  router: AppRouter
  sockets: TestSocket[]
}

const sims: Sim[] = []

function stubMatchMedia(width: number, reduced: boolean) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    const minHeight = /min-height:\s*(\d+)px/.exec(query)
    const matches =
      query === REDUCED_MOTION_MEDIA_QUERY ? reduced : min ? width >= Number(min[1]) : minHeight ? 1080 >= Number(minHeight[1]) : false
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList
  }) as typeof window.matchMedia
}

function mount(path: string, { operatorId = null, width = 1920, reduced = false, clock, webStorage = false }: MountOptions = {}): Harness {
  stubMatchMedia(width, reduced)
  const sockets: TestSocket[] = []
  let sim: Sim
  if (webStorage) {
    sim = createSim({ visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined, ...(clock ? { clock } : {}) })
  } else {
    const authStorage = createMemoryAuthStorage()
    if (operatorId) authStorage.save({ operatorId, issuedAt: clock?.now() ?? Date.now() })
    sim = createSim({
      storage: null,
      authStorage,
      visibility: ALWAYS_VISIBLE,
      scheduler: () => () => undefined, // no engine ticks: the tests drive state (and time) directly
      ...(clock ? { clock } : {}),
    })
  }
  sims.push(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter(
    {
      sim,
      queryClient,
      socketFactory: () => {
        const socket = new TestSocket()
        sockets.push(socket)
        return socket
      },
    },
    { history: createMemoryHistory({ initialEntries: [path] }) },
  )
  render(<RouterProvider router={router} />)
  return { sim, router, sockets }
}

const page = () => screen.getByTestId('page-login')
const usernameInput = () => within(page()).getByLabelText(/username/i) as HTMLInputElement
const passwordInput = () => within(page()).getByLabelText(/password/i) as HTMLInputElement
const signInButton = () => within(page()).getByRole('button', { name: /sign in/i })

function typeCredentials(username: string, password: string) {
  fireEvent.change(usernameInput(), { target: { value: username } })
  fireEvent.change(passwordInput(), { target: { value: password } })
}

async function expectState(state: string) {
  await waitFor(() => expect(page()).toHaveAttribute('data-state', state))
}

const originalMatchMedia = window.matchMedia
Element.prototype.scrollTo ??= function scrollTo() {}
window.scrollTo = (() => undefined) as typeof window.scrollTo

beforeEach(() => {
  resetMissingI18nKeys()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  window.matchMedia = originalMatchMedia
  window.sessionStorage.clear()
  resetPresentationModeForTests()
  MotionGlobalConfig.skipAnimations = true
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Login: layout and the Idle state (§14.8)', () => {
  it('renders the brand side and the auth card at 1920 px with no missing keys', async () => {
    mount('/login')
    expect(await screen.findByTestId('page-login')).toHaveAttribute('data-state', 'idle')
    expect(page()).toHaveAttribute('data-tier', 'wide')
    expect(page()).toHaveAttribute('data-arrival', 'cold')

    // Brand side: GlowRing (login mode) around the emblem, which carries the shared layoutId.
    const brand = screen.getByTestId('login-brand')
    expect(within(brand).getByTestId('glow-ring')).toHaveAttribute('data-mode', 'login')
    expect(within(brand).getByTestId('login-emblem')).toHaveAttribute('data-layout-id', 'brand-emblem')
    expect(within(brand).getByText('DEMS EDGE CLIENT')).toBeInTheDocument()
    expect(within(brand).getByText('SECURE BY DESIGN.')).toBeInTheDocument()
    expect(within(brand).getByText('TRUSTED BY LAW.')).toBeInTheDocument()
    for (const pillar of ['RECORD', 'PRESERVE', 'PROTECT']) expect(within(brand).getByText(pillar)).toBeInTheDocument()
    const strip = screen.getByTestId('login-device-strip')
    expect(within(strip).getByText('DEMS-IR-01')).toBeInTheDocument()
    expect(within(strip).getByText('Interview Room 1')).toBeInTheDocument()
    expect(within(strip).getByTestId('login-clock').textContent).toMatch(/^\d{2}:\d{2}:\d{2} UTC\+07:00$/)
    expect(within(strip).getByTestId('login-core-link')).toHaveAttribute('data-state', 'connecting')

    // Auth card: title, fields (one element each for the label queries), buttons, trust line.
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    expect(within(page()).getAllByLabelText(/password/i)).toHaveLength(1)
    expect(usernameInput()).toHaveAttribute('autocomplete', 'username')
    expect(passwordInput()).toHaveAttribute('autocomplete', 'current-password')
    expect(passwordInput()).toHaveAttribute('type', 'password')
    expect(passwordInput()).not.toHaveAttribute('name')
    expect(signInButton()).toBeEnabled()
    expect(screen.getByTestId('login-security-key')).toHaveTextContent('Use security key (simulated)')
    // REVISED 2026-10-30 (principal): the "Demo operators" disclosure is REMOVED from the
    // login card — a shipped unit must not advertise seeded identities or their password.
    expect(screen.queryByTestId('login-demo-operators')).not.toBeInTheDocument()
    expect(screen.getByTestId('login-trust-line')).toHaveTextContent('Console: DEMS-IR-01 • paired (simulated)')
    expect(page()).toHaveTextContent('v2.4.1')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('follows the tiers: 6 | 6 at 1200, a brand band at 900, the card over the backdrop at 600', async () => {
    mount('/login', { width: 1200 })
    expect(await screen.findByTestId('page-login')).toHaveAttribute('data-tier', 'split')
    expect(screen.queryByText('PRESERVE')).not.toBeInTheDocument()
    expect(screen.getByTestId('login-device-strip')).toBeInTheDocument()
    cleanup()
    mount('/login', { width: 900 })
    expect(await screen.findByTestId('page-login')).toHaveAttribute('data-tier', 'stacked')
    expect(screen.queryByTestId('login-device-strip')).not.toBeInTheDocument()
    cleanup()
    mount('/login', { width: 600 })
    expect(await screen.findByTestId('page-login')).toHaveAttribute('data-tier', 'compact')
    expect(signInButton()).toBeEnabled()
  })
})

describe('Login: Validating, Error and the fields (M-C-22)', () => {
  it('Validating: an empty submit shows both field errors; typing clears them', async () => {
    mount('/login')
    await screen.findByTestId('page-login')
    fireEvent.click(signInButton())
    await expectState('validating')
    expect(screen.getByText('Enter your username.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(usernameInput()).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(usernameInput(), { target: { value: 'budi.santoso' } })
    expect(screen.queryByText('Enter your username.')).not.toBeInTheDocument()
    fireEvent.change(passwordInput(), { target: { value: 'x' } })
    await expectState('idle')
  })

  it('Error: a wrong password shows the generic Alert with attempts left and clears the password', async () => {
    const { sim } = mount('/login')
    await screen.findByTestId('page-login')
    typeCredentials('budi.santoso', WRONG_PASSWORD)
    fireEvent.click(signInButton())
    await expectState('error')
    const alert = screen.getByTestId('login-alert')
    expect(alert).toHaveAttribute('data-kind', 'invalid')
    expect(alert).toHaveTextContent('Invalid username or password.')
    expect(screen.getByTestId('login-attempts')).toHaveAccessibleName('4 attempts remaining')
    expect(passwordInput().value).toBe('')
    expect(usernameInput()).toHaveAttribute('aria-invalid', 'true')
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true')
    expect(sim.store.getState().auth.status).toBe(AuthStatus.SIGNED_OUT)
    // Editing a field removes the red border (the Alert stays until the next attempt).
    fireEvent.change(passwordInput(), { target: { value: 'd' } })
    expect(passwordInput()).not.toHaveAttribute('aria-invalid', 'true')
  })

  // Fix wave J round three (note N-01): the typed password is never in the markup - the field has no `value`
  // attribute, typed, revealed or filled, while the field's own value is what was typed.
  it('N-01: the password field carries no `value` attribute, and the page\'s HTML never holds what was typed', async () => {
    mount('/login')
    await screen.findByTestId('page-login')
    const typed = ['typed', 'into', 'the', 'field'].join('-')
    typeCredentials('budi.santoso', typed)
    expect(passwordInput().value).toBe(typed)
    // The observer answers in the same task (a microtask after React wrote the attribute).
    await waitFor(() => expect(passwordInput().hasAttribute('value')).toBe(false))
    expect(document.body.innerHTML).not.toContain(typed)
    // Revealed: still the property only.
    fireEvent.click(within(page()).getByRole('button', { name: 'Show password' }))
    expect(passwordInput()).toHaveAttribute('type', 'text')
    await waitFor(() => expect(passwordInput().hasAttribute('value')).toBe(false))
    expect(document.body.innerHTML).not.toContain(typed)
    expect(passwordInput().value).toBe(typed)
    // CONTROL - the user name is an ordinary field: React mirrors it, which is what the password field no longer does.
    expect(usernameInput().getAttribute('value')).toBe('budi.santoso')
  })

  it('toggles the password visibility and fills the form from a demo operator', async () => {
    mount('/login')
    await screen.findByTestId('page-login')
    fireEvent.change(passwordInput(), { target: { value: 'abc' } })
    fireEvent.click(within(page()).getByRole('button', { name: 'Show password' }))
    expect(passwordInput()).toHaveAttribute('type', 'text')
    expect(within(page()).getByRole('button', { name: 'Hide password' })).toBeInTheDocument()

    // REVISED 2026-10-30 (principal): the form is filled directly — the demo list is gone.
    fireEvent.change(usernameInput(), { target: { value: 'rina.wijaya' } })
    fireEvent.change(passwordInput(), { target: { value: DEMO_OPERATOR_PASSWORD } })
    expect(usernameInput().value).toBe('rina.wijaya')
    expect(passwordInput().value).toBe(DEMO_OPERATOR_PASSWORD)
    expect(screen.queryByTestId('login-demo-operators')).not.toBeInTheDocument()
  })

  it('shows the caps-lock hint while Caps Lock is on', async () => {
    mount('/login')
    await screen.findByTestId('page-login')
    fireEvent.keyDown(passwordInput(), { key: 'A', modifierCapsLock: true })
    expect(await screen.findByText('Caps Lock is on')).toBeInTheDocument()
    fireEvent.keyUp(passwordInput(), { key: 'A', modifierCapsLock: false })
    await waitFor(() => expect(screen.queryByText('Caps Lock is on')).not.toBeInTheDocument())
  })
})

describe('Login: Locked out (§14.8 policy; AC-50 UI path)', () => {
  it('5 failures lock the form with a live countdown; after 60 s of simulator time a correct sign-in lands on the redirect target', async () => {
    const clock = createManualClock(Date.parse('2026-10-01T03:00:00.000Z'))
    const { sim, router } = mount('/login?redirect=%2Fstack-check', { clock })
    await screen.findByTestId('page-login')
    const failedBefore = sim.store.getState().audit.rows.filter((row) => row.type === 'AUTH_FAILED').length

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      typeCredentials('budi.santoso', `${WRONG_PASSWORD}-${attempt}`)
      fireEvent.click(signInButton())
      await expectState(attempt < 5 ? 'error' : 'locked')
    }
    act(() => sim.tick())
    const alert = screen.getByTestId('login-alert')
    expect(alert).toHaveAttribute('data-kind', 'locked')
    expect(alert).toHaveTextContent('Too many attempts')
    expect(screen.getByTestId('login-lock-countdown')).toHaveAttribute('data-seconds', '60')
    expect(signInButton()).toBeDisabled()
    expect(screen.getByTestId('login-security-key')).toBeDisabled()
    expect(usernameInput()).toBeDisabled()
    expect(screen.getByTestId('glow-ring')).toHaveAttribute('data-state', 'ATTENTION')
    const rows = sim.store.getState().audit.rows
    expect(rows.filter((row) => row.type === 'AUTH_FAILED').length - failedBefore).toBe(5)

    act(() => {
      clock.advance(30_000)
      sim.tick()
    })
    expect(screen.getByTestId('login-lock-countdown')).toHaveAttribute('data-seconds', '30')

    act(() => {
      clock.advance(30_500)
      sim.tick()
    })
    await waitFor(() => expect(page()).not.toHaveAttribute('data-state', 'locked'))
    expect(signInButton()).toBeEnabled()
    typeCredentials('budi.santoso', DEMO_OPERATOR_PASSWORD)
    fireEvent.click(signInButton())
    expect(await screen.findByTestId('page-stack-check')).toBeInTheDocument()
    expect(router.state.location.href).toBe('/stack-check')
    expect(sim.store.getState().audit.rows.at(-1)?.type).toBe('AUTH_SUCCESS')
  })
})

describe('Login: Core offline (heartbeat)', () => {
  it('disables sign-in, shows the danger Alert with a rate-limited Retry, and recovers on the next heartbeat', async () => {
    const { sockets } = mount('/login')
    await screen.findByTestId('page-login')
    act(() => sockets[0]?.drop())
    await expectState('offline')
    const alert = screen.getByTestId('login-alert')
    expect(alert).toHaveTextContent('Core service unreachable')
    expect(alert).toHaveTextContent('Core service unreachable at 127.0.0.1:4400.')
    expect(signInButton()).toBeDisabled()
    expect(screen.getByTestId('login-security-key')).toBeDisabled()
    expect(screen.getByTestId('login-core-link')).toHaveAttribute('data-state', 'offline')
    expect(screen.getByTestId('glow-ring')).toHaveAttribute('data-state', 'CRITICAL')

    const before = sockets.length
    fireEvent.click(screen.getByTestId('login-core-retry'))
    expect(sockets.length).toBe(before + 1) // reconnected now, not after the backoff
    expect(screen.getByTestId('login-core-retry')).toHaveTextContent('Retry in 3s')
    expect(screen.getByTestId('login-core-retry')).toBeDisabled()

    act(() => sockets.at(-1)?.beat(1))
    await expectState('idle')
    expect(screen.getByTestId('login-core-link')).toHaveTextContent('Online')
    expect(signInButton()).toBeEnabled()
  })
})

describe('Login: Signed out / expired (M-APP-02)', () => {
  it('after Sign out from the shell: the notice, and the emblem returns (arrival "return")', async () => {
    const { sim } = mount('/stack-check', { operatorId: OPERATOR_IDS.BUDI })
    await screen.findByTestId('page-stack-check')
    act(() => sim.actions.signOut(SignOutReason.USER))
    expect(await screen.findByTestId('page-login')).toHaveAttribute('data-arrival', 'return')
    await expectState('signed-out')
    expect(screen.getByTestId('login-alert')).toHaveTextContent('You have been signed out.')
    expect(screen.getByTestId('login-alert')).toHaveAttribute('role', 'status')
  })

  it('after Lock console: "Console locked"', async () => {
    const { sim } = mount('/stack-check', { operatorId: OPERATOR_IDS.ANDI })
    await screen.findByTestId('page-stack-check')
    act(() => sim.actions.signOut(SignOutReason.LOCK))
    await screen.findByTestId('page-login')
    await expectState('signed-out')
    expect(screen.getByTestId('login-alert')).toHaveTextContent(en.login.notices.consoleLocked)
  })

  it('after 15 min idle: the expiry notice, and sign-in returns to the same page', async () => {
    const clock = createManualClock(Date.parse('2026-10-01T03:00:00.000Z'))
    const { sim, router } = mount('/stack-check', { operatorId: OPERATOR_IDS.BUDI, clock })
    await screen.findByTestId('page-stack-check')
    act(() => {
      clock.advance(15 * 60_000 + 1_000)
      sim.tick()
    })
    expect(await screen.findByTestId('page-login')).toBeInTheDocument()
    await expectState('signed-out')
    expect(screen.getByTestId('login-alert')).toHaveTextContent('Your session expired after 15 minutes without activity.')
    expect(router.state.location.search).toEqual({ redirect: '/stack-check' })
    typeCredentials('budi.santoso', DEMO_OPERATOR_PASSWORD)
    fireEvent.click(signInButton())
    expect(await screen.findByTestId('page-stack-check')).toBeInTheDocument()
  })
})

describe('Login: Success and the hand-off (M-APP-01; AC-49)', () => {
  it('plays Submitting, then Success (check, leaving, announcement), then lands on the redirect target with the shell hand-off', async () => {
    MotionGlobalConfig.skipAnimations = false
    const { router, sim } = mount('/login?redirect=%2Fstack-check')
    await screen.findByTestId('page-login')
    typeCredentials('budi.santoso', DEMO_OPERATOR_PASSWORD)
    fireEvent.click(signInButton())
    await expectState('submitting')
    expect(screen.getByTestId('login-submit')).toHaveAttribute('data-pending', 'true')
    expect(screen.getByTestId('login-submit')).toHaveTextContent('Signing in…')
    expect(usernameInput()).toBeDisabled()

    await waitFor(() => expect(page()).toHaveAttribute('data-state', 'success'), { timeout: 2000 })
    expect(page()).toHaveAttribute('data-leaving', 'true')
    expect(screen.getByTestId('login-emblem').querySelector('[data-emblem-part="check"]')).not.toBeNull()
    expect(screen.getByTestId('login-announcement')).toHaveTextContent('Signed in as AKP Budi Santoso. Opening the console…')

    expect(await screen.findByTestId('page-stack-check', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(router.state.location.href).toBe('/stack-check')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-entrance', 'handoff')
    expect(sim.store.getState().auth.operatorId).toBe(OPERATOR_IDS.BUDI)
  })

  it('an unauthenticated /stack-check goes to /login?redirect=%2Fstack-check and comes back after sign-in (AC-49)', async () => {
    const { router } = mount('/stack-check')
    await screen.findByTestId('page-login')
    expect(router.state.location.href).toBe('/login?redirect=%2Fstack-check')
    typeCredentials('budi.santoso', DEMO_OPERATOR_PASSWORD)
    fireEvent.click(signInButton())
    expect(await screen.findByTestId('page-stack-check')).toBeInTheDocument()
    expect(router.state.location.href).toBe('/stack-check')
  })

  it('"Use security key (simulated)" prompts for 1.2 s, then signs in as the SUPERVISOR operator', async () => {
    MotionGlobalConfig.skipAnimations = false
    const { sim, router } = mount('/login?redirect=%2Fstack-check')
    await screen.findByTestId('page-login')
    fireEvent.click(screen.getByTestId('login-security-key'))
    await expectState('submitting')
    expect(screen.getByTestId('login-security-key')).toHaveTextContent('Touch your security key… (simulated)')
    expect(await screen.findByTestId('page-stack-check', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(router.state.location.href).toBe('/stack-check')
    const auth = sim.store.getState().auth
    expect(auth.operatorId).toBe(OPERATOR_IDS.ANDI)
    expect(auth.method).toBe('SECURITY_KEY')
  })
})

describe('Login: no password persisted anywhere (AC-50, design book §20.1)', () => {
  it('keeps both typed passwords out of sessionStorage, the URL, simulator events, audit rows and the console', async () => {
    window.sessionStorage.clear()
    const logged: unknown[] = []
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(args)
      })
    }
    const { sim, router } = mount('/login?redirect=%2Fstack-check', { webStorage: true })
    await screen.findByTestId('page-login')
    typeCredentials('budi.santoso', WRONG_PASSWORD)
    fireEvent.click(signInButton())
    await expectState('error')
    typeCredentials('budi.santoso', DEMO_OPERATOR_PASSWORD)
    fireEvent.click(signInButton())
    await screen.findByTestId('page-stack-check')
    act(() => sim.flush())

    const stored = Object.keys(window.sessionStorage)
      .map((key) => `${key}=${window.sessionStorage.getItem(key)}`)
      .join('\n')
    expect(stored).toContain('dems.sim.v1') // the snapshot was written, and it holds no credential
    expect(JSON.parse(window.sessionStorage.getItem(AUTH_STORAGE_KEY) ?? 'null')).toEqual({
      operatorId: OPERATOR_IDS.BUDI,
      issuedAt: expect.any(Number),
    })
    const state = sim.store.getState()
    const surfaces = [
      stored,
      router.state.location.href,
      JSON.stringify(router.state.location.state ?? null),
      window.location.href,
      JSON.stringify([state.events, state.audit.rows, state.alerts, state.auth]),
      JSON.stringify(logged, (_key, value: unknown) => (value instanceof Error ? value.message : value)),
    ]
    for (const surface of surfaces) {
      expect(surface).not.toContain(WRONG_PASSWORD)
      expect(surface).not.toContain(DEMO_OPERATOR_PASSWORD)
    }
    expect(state.audit.rows.some((row) => row.type === 'AUTH_FAILED')).toBe(true)
    expect(state.audit.rows.at(-1)?.type).toBe('AUTH_SUCCESS')
  })
})

describe('Login: presentation mode (ruling M8) and reduced motion (§8, AC-70)', () => {
  it('hides the demo operators in presentation mode, live', async () => {
    setPresentationMode(true)
    expect(window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)).toBe('1')
    mount('/login')
    await screen.findByTestId('page-login')
    expect(page()).toHaveAttribute('data-presentation', 'true')
    expect(screen.queryByTestId('login-demo-operators')).not.toBeInTheDocument()
    // REVISED 2026-10-30 (principal): leaving presentation mode no longer brings the demo
    // list back — it is removed from the product, not merely hidden.
    act(() => setPresentationMode(false))
    expect(screen.queryByTestId('login-demo-operators')).not.toBeInTheDocument()
  })

  it('reduced motion: no shared-layout flight, no running loops, no particles or beam; the hand-off still leaves', async () => {
    const { router } = mount('/login?redirect=%2Fstack-check', { reduced: true })
    await screen.findByTestId('page-login')
    expect(page()).toHaveAttribute('data-motion', 'reduced')
    expect(screen.getByTestId('login-emblem')).not.toHaveAttribute('data-layout-id')
    expect(document.querySelector('[data-ambient="running"]')).toBeNull()
    expect(screen.getByTestId('login-backdrop').querySelector('img')).toHaveAttribute('data-motion', 'reduced')
    expect(document.querySelector('.dems-login-particles')).toBeNull()
    expect(screen.getByTestId('login-emblem').querySelector('[data-emblem-draw]')).toBeNull()
    typeCredentials('budi.santoso', DEMO_OPERATOR_PASSWORD)
    fireEvent.click(signInButton())
    expect(await screen.findByTestId('page-stack-check')).toBeInTheDocument()
    expect(router.state.location.href).toBe('/stack-check')
  })
})
