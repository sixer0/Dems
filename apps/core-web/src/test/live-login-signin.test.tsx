/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W55: the sign-in of the Login page in Live mode, through the real router and the real
// Live source on the contract-checked fake transport (backend task 04_client_integration_spec
// §5.2, §5.4, §5.5 WS-1 to WS-4, §8.1 LB-10, §8.2 A1; brief list rows 16, 18, 31 of
// implementation/44_live_source.md §17.4). The page of this file is `http://127.0.0.1:5178/`.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | CLG (b), the settle site `signIn` (A1): success, the site's refusals, an outage | "success", "a wrong password", "the lockout", "a refusal the page words itself", "no answer" |
// | AC-C-38 after a Live sign-in: no session cookie in `document.cookie`, no web-storage value that starts with `ses_`, `dems.auth` not written (the fake transport's half; the lane check is the browser's) | "success" |
// | AC-C-39 `selectLockout` on the replica equals the server's lock state | "a wrong password", "the lockout" |
// | AC-C-44 wrong password, lockout with a countdown, success; the password state is empty once the request is sent | "success", "a wrong password", "the lockout" |
// | AC-C-107 a marker password leaves no trace in the web's error sink (nor in the console, the storages, the address, the replica) | "a marker password" |
// | AC-C-110, LB-10 a 429 shows the limit toast with the seconds of `retry-after`, keeps the form filled, shows neither the offline notice nor a changed mode | "a limit is not an outage" |
// | §5.4 the page hands off when a session it did not submit is found | "a session this page did not submit" |
// | §5.2 step 6 the sign-in was accepted and the Core state arrives late | "a session this page did not submit" |
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthResponse } from '@dems/shared/api'
import { LiveLinkState } from '@dems/shared/live'
import { notReady, rateLimited, refusal } from '@dems/shared/live/testing'
import { AuthStatus, selectAuth, selectIsSignedIn, selectLockout } from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { resetPresentationModeForTests } from '@/lib/presentation-mode'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { webErrorSink } from '@/runtime'
import { OWED_SIGN_OUT_STORAGE_KEY } from '@/runtime/owed-sign-out-storage'
import { createLiveTestBed, LIVE_TEST_ORIGIN, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

// A page's chunk is loaded by a dynamic import: under load that can take longer than the
// library's default second. The waits end as soon as their condition holds.
configure({ asyncUtilTimeout: 6_000 })
vi.setConfig({ testTimeout: 20_000 })

const coreHealth: HealthResponse = {
  status: 'ok',
  service: 'dems-core-server',
  version: '0.2.0',
  apiVersion: 'v1',
  serverTime: '2026-10-04T03:00:00.000Z',
  uptimeMs: 1000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 1 },
  ready: { database: true, engine: true },
}

/** No credential: a text typed into the password field of a test. Built from parts so that no search for it finds this line. */
const TYPED = ['not', 'a', 'real', 'password'].join('-')
/** AC-C-107: the marker the scans look for. It exists in this file only. */
const MARKER = ['MARKER', 'W55', 'pw', '7f3a9c'].join('-')
const USERNAME = SUPERVISOR_SESSION.operator.username
const LIMIT_SENTENCE = (seconds: number) => `The Core server is limiting requests from this console. Try again in ${seconds} s.`

const originalMatchMedia = window.matchMedia
function stubMatchMedia(width = 1920) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    const minHeight = /min-height:\s*(\d+)px/.exec(query)
    const matches = query === REDUCED_MOTION_MEDIA_QUERY ? false : min ? width >= Number(min[1]) : minHeight ? 1080 >= Number(minHeight[1]) : false
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

/** Empties the kit's toast queue: it is one per page and outlives a test. */
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

let bed: LiveTestBed | undefined

/** The Login page in Live mode, nobody signed in. */
async function loginPage(path = '/login'): Promise<{ bed: LiveTestBed; live: LivePage; router: Awaited<ReturnType<LiveTestBed['mount']>>['router'] }> {
  stubMatchMedia()
  const created = createLiveTestBed()
  bed = created
  const live = await created.load()
  const { router } = await created.mount(live, path)
  await screen.findByTestId('page-login')
  return { bed: created, live, router }
}

const page = () => screen.getByTestId('page-login')
const usernameInput = () => within(page()).getByLabelText(/username/i) as HTMLInputElement
const passwordInput = () => within(page()).getByLabelText(/password/i) as HTMLInputElement
const signInButton = () => within(page()).getByRole('button', { name: /sign in/i })
const alertKind = () => screen.queryByTestId('login-alert')?.getAttribute('data-kind') ?? null

function typeCredentials(username: string, password: string) {
  fireEvent.change(usernameInput(), { target: { value: username } })
  fireEvent.change(passwordInput(), { target: { value: password } })
}

async function expectState(state: string) {
  await waitFor(() => expect(page()).toHaveAttribute('data-state', state))
}

/** The answer of the Core's own model to a sign-in: the session behind the cookie is replaced. */
function signedInAnswer(created: LiveTestBed) {
  created.core.signIn(created.core.signInAs)
  return { status: 200, body: { session: created.core.info() } }
}

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(coreHealth), { status: 200 })),
  )
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  window.matchMedia = originalMatchMedia
  resetPresentationModeForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the page of this file', () => {
  it('is the Login page on the Live source, at the address Live mode needs', async () => {
    const { live } = await loginPage()
    expect(window.location.origin).toBe(LIVE_TEST_ORIGIN)
    expect(page()).toHaveAttribute('data-core-mode', 'LIVE')
    expect(page()).toHaveAttribute('data-state', 'idle')
    expect(live.live.link).toBe(LiveLinkState.ONLINE)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('success (WS-1; §5.2; AC-C-38, AC-C-44)', () => {
  it('the request goes out at once with what was typed; the password state is empty while it is out; the form cannot be sent twice; the page hands off after the snapshot', async () => {
    const { bed, live, router } = await loginPage('/login?redirect=%2Fstack-check')
    const held = bed.fake.hold('signIn')

    typeCredentials(`  ${USERNAME} `, TYPED)
    fireEvent.click(signInButton())
    await bed.fake.arrived()
    await bed.flush()

    // Sent at once (no simulated beat before the request), the username trimmed, the password as typed.
    expect(held.call?.method).toBe('POST')
    expect(held.call?.url).toBe(`${LIVE_TEST_ORIGIN}/api/v1/auth/sign-in`)
    expect(held.call?.body).toEqual({ username: USERNAME, password: TYPED })
    expect(held.call?.headers.authorization).toBeUndefined()

    // Submitting: the password state is empty once the request is handed over (AC-C-44), the fields are disabled.
    expect(page()).toHaveAttribute('data-state', 'submitting')
    expect(passwordInput().value).toBe('')
    expect(usernameInput()).toBeDisabled()
    expect(passwordInput()).toBeDisabled()
    expect(screen.getByTestId('login-submit')).toHaveAttribute('data-pending', 'true')

    // Brief list row 31: the pending state has no time-out of its own, and nothing is sent a second time.
    await bed.elapse(6_000, 1_000)
    fireEvent.click(screen.getByTestId('login-submit'))
    fireEvent.submit(usernameInput().closest('form') as HTMLFormElement)
    await bed.flush()
    expect(page()).toHaveAttribute('data-state', 'submitting')
    expect(bed.fake.log.requestsOf('signIn')).toHaveLength(1)
    expect(selectIsSignedIn(live.live.store.getState())).toBe(false)

    held.release(signedInAnswer(bed))
    await bed.flush()
    expect(await screen.findByTestId('page-stack-check')).toBeInTheDocument()
    expect(router.state.location.href).toBe('/stack-check')
    expect(selectAuth(live.live.store.getState())).toMatchObject({ status: AuthStatus.SIGNED_IN, operatorId: SUPERVISOR_SESSION.operator.id })
    // A new socket carried the session, and its snapshot was applied before the page left.
    expect(live.sockets.map((socket) => socket.principal)).toEqual(['ANONYMOUS', 'OPERATOR'])

    // AC-C-38, SR-16: nothing about the session is where script or a later page load could read it.
    expect(document.cookie).not.toMatch(/dems_session/)
    expect(window.sessionStorage.getItem('dems.auth')).toBeNull()
    expect(window.sessionStorage.getItem('dems.sim.v1')).toBeNull()
    expect(window.localStorage.getItem(OWED_SIGN_OUT_STORAGE_KEY)).toBeNull()
    for (const storage of [window.sessionStorage, window.localStorage]) {
      for (const [key, value] of Object.entries({ ...storage })) {
        expect(`${key}=${String(value)}`).not.toMatch(/\b(ses|dvc|bio)_/)
        expect(String(value)).not.toContain(TYPED)
      }
    }
    // The body of the answer held no token, and the page never asked for one.
    expect(JSON.stringify(bed.fake.log.requestsOf('signIn'))).not.toMatch(/\b(ses|dvc|bio)_/)
    // No Live result was read as a value (brief list row 18).
    expect(live.sink.records().filter((record) => record.source.endsWith('.misuse'))).toEqual([])
  })

  it('without a redirect the page hands off to the Dashboard', async () => {
    const { bed, router } = await loginPage()
    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    await bed.flush()
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
  })
})

describe('a wrong password (WS-2; 401 INVALID_CREDENTIALS)', () => {
  it('shows the server\'s refusal with the attempts it names, clears the password, and the lockout view follows (AC-C-39)', async () => {
    const { bed, live } = await loginPage()
    bed.fake.answerOnce('signIn', refusal(401, 'INVALID_CREDENTIALS', 'The username or the password is not correct.', { attemptsRemaining: 3 }))

    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    await expectState('error')
    const alert = screen.getByTestId('login-alert')
    expect(alert).toHaveAttribute('data-kind', 'invalid')
    expect(alert).toHaveTextContent('Invalid username or password.')
    expect(screen.getByTestId('login-attempts')).toHaveAccessibleName('3 attempts remaining')
    expect(passwordInput().value).toBe('')
    expect(usernameInput().value).toBe(USERNAME)
    expect(usernameInput()).toHaveAttribute('aria-invalid', 'true')
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true')
    expect(signInButton()).toBeEnabled()
    // AC-C-39: the same selector, on the replica.
    expect(selectLockout(live.live.store.getState())).toMatchObject({ locked: false, lockedUntil: null, attemptsRemaining: 3 })
    expect(selectIsSignedIn(live.live.store.getState())).toBe(false)
    // A refusal the result union carries is an answer, not an error: nothing was reported, no socket was replaced.
    expect(live.sink.records()).toEqual([])
    expect(webErrorSink.records()).toEqual([])
    expect(live.sockets).toHaveLength(1)

    // The next attempt: the count is the server's again.
    bed.fake.answerOnce('signIn', refusal(401, 'INVALID_CREDENTIALS', 'The username or the password is not correct.', { attemptsRemaining: 2 }))
    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    await waitFor(() => expect(screen.getByTestId('login-attempts')).toHaveAccessibleName('2 attempts remaining'))
    expect(selectLockout(live.live.store.getState())).toMatchObject({ locked: false, attemptsRemaining: 2 })
  })
})

describe('the lockout (WS-3; 423 LOCKED)', () => {
  it('locks the form with a countdown on the Live clock to `lockedUntil`; at its end the form works again', async () => {
    const { bed, live, router } = await loginPage()
    const lockedUntil = bed.fake.clock.now() + 60_000
    bed.fake.answerOnce('signIn', refusal(423, 'LOCKED', 'Too many failed attempts. Try again shortly.', { lockedUntil, retryInMs: 60_000 }))

    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    await expectState('locked')
    const alert = screen.getByTestId('login-alert')
    expect(alert).toHaveAttribute('data-kind', 'locked')
    expect(alert).toHaveTextContent('Too many attempts')
    expect(screen.getByTestId('login-lock-countdown')).toHaveAttribute('data-seconds', '60')
    expect(passwordInput().value).toBe('')
    expect(signInButton()).toBeDisabled()
    expect(usernameInput()).toBeDisabled()
    expect(screen.getByTestId('glow-ring')).toHaveAttribute('data-state', 'ATTENTION')
    // AC-C-39.
    expect(selectLockout(live.live.store.getState())).toMatchObject({ locked: true, lockedUntil, attemptsRemaining: 0 })

    await bed.elapse(30_000, 1_000)
    expect(screen.getByTestId('login-lock-countdown')).toHaveAttribute('data-seconds', '30')
    expect(selectLockout(live.live.store.getState())).toMatchObject({ locked: true, retryInMs: 30_000 })
    // A press during the lock sends nothing.
    fireEvent.click(screen.getByTestId('login-submit'))
    expect(bed.fake.log.requestsOf('signIn')).toHaveLength(1)

    await bed.elapse(30_500, 500)
    await waitFor(() => expect(page()).not.toHaveAttribute('data-state', 'locked'))
    expect(selectLockout(live.live.store.getState())).toMatchObject({ locked: false, attemptsRemaining: 5 })
    expect(signInButton()).toBeEnabled()

    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    await bed.flush()
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  it('after a reload the lock is known again from the Core server\'s answer, before anything is typed', async () => {
    stubMatchMedia()
    bed = createLiveTestBed()
    const now = bed.fake.clock.now()
    bed.fake.answer('getSignInStatus', { status: 200, body: { locked: true, lockedUntil: now + 18_000, retryInMs: 18_000, attemptsRemaining: 0, serverTime: now } })
    const live = await bed.load()
    await bed.mount(live, '/login')
    await screen.findByTestId('page-login')

    await expectState('locked')
    expect(screen.getByTestId('login-lock-countdown')).toHaveAttribute('data-seconds', '18')
    expect(signInButton()).toBeDisabled()
    expect(selectLockout(live.live.store.getState())).toMatchObject({ locked: true, lockedUntil: now + 18_000, attemptsRemaining: 0 })
    expect(bed.fake.log.requestsOf('signIn')).toHaveLength(0)
  })
})

describe('a limit is not an outage (LB-10; AC-C-110)', () => {
  it('a 429 shows the limit toast with the seconds of `retry-after`, puts the form back as it was typed, and shows neither the offline Alert nor a changed mode', async () => {
    const { bed, live } = await loginPage()
    const danger = vi.spyOn(toast, 'danger')
    const held = bed.fake.hold('signIn')

    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    await bed.fake.arrived()
    await bed.flush()
    // While the request is out the password state is empty, as for every attempt.
    expect(passwordInput().value).toBe('')

    held.release(rateLimited(37))
    await bed.flush()
    expect(await screen.findByText(LIMIT_SENTENCE(37))).toBeInTheDocument()

    // The form keeps what was typed and is ready again: the Core server did not look at the attempt.
    await expectState('idle')
    expect(usernameInput().value).toBe(USERNAME)
    expect(passwordInput().value).toBe(TYPED)
    expect(usernameInput()).toBeEnabled()
    expect(signInButton()).toBeEnabled()

    // Not an outage: no Alert, no "unreachable" sentence, the link, the strip and the mode as they were.
    await bed.elapse(3_000, 500)
    expect(alertKind()).toBeNull()
    expect(screen.queryByTestId('login-core-retry')).not.toBeInTheDocument()
    expect(screen.queryByText(/unreachable/i)).not.toBeInTheDocument()
    expect(danger).not.toHaveBeenCalled()
    expect(live.live.link).toBe(LiveLinkState.ONLINE)
    expect(page()).toHaveAttribute('data-core-link', 'online')
    expect(page()).toHaveAttribute('data-core-mode', 'LIVE')
    expect(screen.getByTestId('login-core-link')).toHaveAttribute('data-state', 'online')
    expect(screen.getByTestId('login-core-mode')).toHaveTextContent('Live')
    expect(screen.getByTestId('login-trust-line')).toHaveAttribute('data-reachable', 'true')
    expect(screen.getByTestId('glow-ring')).toHaveAttribute('data-state', 'READY')

    // The same form can be sent again as it stands.
    fireEvent.click(signInButton())
    await bed.flush()
    expect(bed.fake.log.requestsOf('signIn').at(-1)?.body).toEqual({ username: USERNAME, password: TYPED })
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
  })

  it('an earlier notice of the card stays: a limit says nothing about the attempt before it', async () => {
    const { bed } = await loginPage()
    bed.fake.answerOnce('signIn', refusal(401, 'INVALID_CREDENTIALS', 'The username or the password is not correct.', { attemptsRemaining: 4 }))
    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    await expectState('error')

    bed.fake.answerOnce('signIn', rateLimited(5))
    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    expect(await screen.findByText(LIMIT_SENTENCE(5))).toBeInTheDocument()
    expect(alertKind()).toBe('invalid')
    expect(passwordInput().value).toBe(TYPED)
  })
})

describe('no answer (A1: the offline Alert, not "unexpected")', () => {
  it('a request that got no answer shows the offline Alert with Retry; the password is cleared and nothing says "unexpected"', async () => {
    const { bed, live } = await loginPage()
    bed.fake.failOnce('signIn')

    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    await expectState('offline')
    expect(alertKind()).toBe('core-offline')
    expect(screen.getByTestId('login-alert')).toHaveTextContent('Core service unreachable')
    expect(screen.getByTestId('login-core-retry')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument()
    expect(passwordInput().value).toBe('')
    expect(usernameInput().value).toBe(USERNAME)
    expect(selectIsSignedIn(live.live.store.getState())).toBe(false)
  })

  it('503 NOT_READY shows the same Alert in its "starting" wording (§3.5)', async () => {
    const { bed } = await loginPage()
    bed.fake.answerOnce('signIn', notReady())

    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    await expectState('offline')
    expect(alertKind()).toBe('core-starting')
    expect(screen.getByTestId('login-alert')).toHaveTextContent('The Core server is starting')
    expect(screen.getByTestId('login-alert')).toHaveTextContent('Sign-in is available when its database and its engine are ready.')
    expect(screen.getByTestId('login-core-retry')).toBeInTheDocument()
  })
})

describe('a refusal the page words itself (A1; decision F59)', () => {
  it('422: the Core server refused the input; the page shows that refusal and has no second rule set of its own', async () => {
    const { bed } = await loginPage()
    bed.fake.answerOnceFromExample('signIn', 422, 'invalidInput')

    // The form's own bounds are "required" only, and it sends what was typed: 64 characters, the
    // longest username of the contract (the fake transport refuses a request outside the contract,
    // so the refusal itself is scripted). The Core server is the judge.
    const long = 'u'.repeat(64)
    typeCredentials(long, TYPED)
    fireEvent.click(signInButton())
    await expectState('error')
    expect(bed.fake.log.requestsOf('signIn')).toHaveLength(1)
    expect(bed.fake.log.requestsOf('signIn')[0]?.body).toEqual({ username: long, password: TYPED })
    expect(alertKind()).toBe('input-rejected')
    expect(screen.getByTestId('login-alert')).toHaveTextContent('The Core server did not accept this username or password as entered.')
    expect(passwordInput().value).toBe('')
    expect(usernameInput()).toHaveAttribute('aria-invalid', 'true')
  })

  it('403 DEVICE_NOT_PAIRED: the "unexpected" Alert, and one record of the page that names the cause and holds no input', async () => {
    const { bed } = await loginPage()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    bed.fake.answerOnceFromExample('signIn', 403, 'deviceNotPaired')

    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    await expectState('error')
    expect(alertKind()).toBe('unexpected')
    expect(screen.getByTestId('login-alert')).toHaveTextContent('Something went wrong. Please try again.')
    const records = webErrorSink.records().filter((record) => record.source === 'login.signIn')
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', context: { method: 'password', errorName: 'CoreRefusalError', code: 'DEVICE_NOT_PAIRED', status: 403 } })
    expect(String(records[0]?.context?.correlationId)).toMatch(/^login-/)
    expect(JSON.stringify(webErrorSink.records())).not.toContain(TYPED)
    expect(JSON.stringify(webErrorSink.records())).not.toContain(USERNAME)
  })

  it('403 ORIGIN_NOT_ALLOWED: the "unexpected" Alert, the toast that names the address to open, and the record that names the cause (WT-2a)', async () => {
    const { bed } = await loginPage()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    bed.fake.answerOnceFromExample('signIn', 403, 'originNotAllowed')

    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    await expectState('error')
    expect(alertKind()).toBe('unexpected')
    expect(await screen.findByText(`The Core server does not accept requests from this address. Open the console at ${LIVE_TEST_ORIGIN}.`)).toBeInTheDocument()
    const sources = webErrorSink.records().map((record) => record.source)
    expect(sources).toEqual(['core-errors.originNotAllowed'])
    expect(webErrorSink.records()[0]?.message).toContain('ORIGIN_NOT_ALLOWED')
  })

  it('a 500 is worded by the shared presenter ("could not complete the request"), not as an outage', async () => {
    const { bed } = await loginPage()
    bed.fake.answerOnce('signIn', refusal(500, 'INTERNAL_ERROR', 'The Core server could not complete the request.'))

    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    expect(await screen.findByText('The Core server could not complete the request. Try again.')).toBeInTheDocument()
    await expectState('idle')
    expect(alertKind()).toBeNull()
    expect(passwordInput().value).toBe('')
  })
})

describe('a session this page did not submit (§5.4; §5.2 step 6)', () => {
  it('the sign-in was accepted and the Core state did not arrive: one toast says so, and the page hands off when the state arrives, without credentials', async () => {
    const { bed, live } = await loginPage()
    // The answer arrives, and then nothing: the Core server is gone before the new socket could open.
    bed.fake.answerOnce('signIn', () => {
      const answer = signedInAnswer(bed)
      bed.core.reachable = false
      return answer
    })

    typeCredentials(USERNAME, TYPED)
    fireEvent.click(signInButton())
    await bed.flush()
    // `LIVE_BOOT_TIMEOUT_MS`: the action rejects; the cookie exists.
    await bed.elapse(4_500, 500)
    expect(await screen.findByText('The sign-in was accepted, but the Core state has not arrived. The console continues when the Core server is reachable.')).toBeInTheDocument()
    expect(selectIsSignedIn(live.live.store.getState())).toBe(false)
    expect(passwordInput().value).toBe('')
    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument()

    bed.core.back()
    await bed.elapse(12_000, 500)
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
    expect(selectAuth(live.live.store.getState())).toMatchObject({ status: AuthStatus.SIGNED_IN, operatorId: SUPERVISOR_SESSION.operator.id })
    // One sign-in request in all: the session was found again, nothing was typed a second time.
    expect(bed.fake.log.requestsOf('signIn')).toHaveLength(1)
  })

  it('a sign-in elsewhere in this browser is found when the socket of this page reconnects: the page hands off to its redirect target', async () => {
    const { bed, live, router } = await loginPage('/login?redirect=%2Fstack-check')
    expect(live.sockets.map((socket) => socket.principal)).toEqual(['ANONYMOUS'])

    // Another tab signed in: the cookie of the browser names a session now. This page learns of it at its next socket.
    bed.core.signIn(SUPERVISOR_SESSION)
    expect(page()).toHaveAttribute('data-state', 'idle')
    live.live.reconnect('RETRY')
    await bed.elapse(1_000, 250)

    expect(await screen.findByTestId('page-stack-check')).toBeInTheDocument()
    expect(router.state.location.href).toBe('/stack-check')
    expect(selectIsSignedIn(live.live.store.getState())).toBe(true)
    expect(bed.fake.log.requestsOf('signIn')).toHaveLength(0)
  })
})

describe('a marker password leaves no trace (AC-C-107; SD-23)', () => {
  it('through a refusal, a limit, an outage, an unexpected refusal and a success: not in the error sinks, the console, the storages, the address or the replica', async () => {
    const { bed, live, router } = await loginPage('/login?redirect=%2Fstack-check')
    const printed: unknown[][] = []
    for (const method of ['error', 'warn', 'info', 'log', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        printed.push(args)
      })
    }
    const attempt = async (state: string) => {
      typeCredentials(USERNAME, MARKER)
      fireEvent.click(signInButton())
      await expectState(state)
    }

    bed.fake.answerOnce('signIn', refusal(401, 'INVALID_CREDENTIALS', 'The username or the password is not correct.', { attemptsRemaining: 4 }))
    await attempt('error')
    bed.fake.answerOnce('signIn', rateLimited(9))
    typeCredentials(USERNAME, MARKER)
    fireEvent.click(signInButton())
    expect(await screen.findByText(LIMIT_SENTENCE(9))).toBeInTheDocument()
    bed.fake.failOnce('signIn')
    await attempt('offline')
    bed.fake.answerOnceFromExample('signIn', 403, 'deviceNotPaired')
    await attempt('error')
    bed.fake.answerOnceFromExample('signIn', 422, 'invalidInput')
    await attempt('error')

    typeCredentials(USERNAME, MARKER)
    fireEvent.click(signInButton())
    await bed.flush()
    expect(await screen.findByTestId('page-stack-check')).toBeInTheDocument()

    // The marker did travel: in the body of each request, and nowhere else.
    const requests = bed.fake.log.requestsOf('signIn')
    expect(requests).toHaveLength(6)
    for (const request of requests) expect(request.body).toEqual({ username: USERNAME, password: MARKER })
    expect(bed.fake.log.urls().join('\n')).not.toContain(MARKER)

    const scanned = {
      pageLog: webErrorSink.records(),
      sourceLog: live.sink.records(),
      sourceReports: live.live.errors(),
      console: printed,
      sessionStorage: { ...window.sessionStorage },
      localStorage: { ...window.localStorage },
      address: [window.location.href, router.state.location.href, ...bed.location.assigned],
      replica: live.live.store.getState(),
      document: document.body.innerHTML,
    }
    // The reports were made (the scan is not of empty lists): the outage, the two rejections.
    expect(scanned.sourceLog.length).toBeGreaterThan(0)
    expect(scanned.pageLog.length).toBeGreaterThan(0)
    for (const [where, value] of Object.entries(scanned)) {
      const text = JSON.stringify(value, (_key, entry: unknown) => (entry instanceof Error ? { name: entry.name, message: entry.message, stack: entry.stack } : entry))
      expect(text, where).not.toContain(MARKER)
      if (where !== 'document' && where !== 'replica') expect(text, where).not.toMatch(/\b(ses|dvc|bio)_[A-Za-z0-9]/)
    }
  })
})
