// Fix wave I, driver B - finding G75b-02 (MAJOR) of re-gate 75 (`gateway_check/10b_m5_regate.md`,
// `w2_03_seal_blocked.png`): on a session whose seal was blocked the web seal dialog read "Finalizing
// evidence / 0% complete / Resumed after restart", said nothing of the block and could not be left.
//
// The contract is `delegation_progress/contract_wave_i.md` (driver A1): `sealAttentionOf` of
// `@dems/shared/sim` and its EXAMPLES, which this file imports - no payload is retyped here (D208).
//
// | Rule | Case |
// |---|---|
// | BLOCKED: the dialog says sealing is blocked, the Core's reason, its detail, what restores it, that the recording is kept, what the operator can do | "dialog: blocked" |
// | BLOCKED: no percentage, no "estimating", no "Resumed after restart" | "dialog: blocked" |
// | BLOCKED: the dialog can be closed (button and Escape); the session stays FINALIZING on the Core, and the dialog says so | "dialog: can be left" |
// | RETRYING: the Core's sentence ("retry n of N"), the recording is kept, the dialog can be left; never "Resumed after restart" from `attempt` | "dialog: retrying" |
// | The Monitor banner and the Dashboard row say "Sealing blocked", not a running "Finalizing ... step 1 of 6" | "rows" |
// | "Resumed after restart" is never derived from `attempt` beside a session of the Core's own capture | "resumed" |
// | CONTROLS: a seal that simply runs keeps its percent and cannot be closed; the simulator's resumed seal keeps its note | "controls" |
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  SEAL_BLOCKED_DETAIL_SENTENCE,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  SEAL_BLOCKED_EXAMPLE_SESSION_ID,
  SEAL_RECORDING_KEPT_SENTENCE,
  SEAL_RETRYING_EXAMPLE_FINALIZATION,
  sealAttentionOf,
  type ActiveSession,
  type Sim,
  type SimAlert,
} from '@dems/shared/sim'
import { saidAlready } from '@/lib/seal-attention'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'

vi.setConfig({ testTimeout: 30_000 })

const W = enWeb.web.sealBlocked
const F = en.session.finalization
const FIND = { timeout: 15_000 }
const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')

class SilentSocket implements SocketLike {
  readyState = 0
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  close() {
    this.readyState = 3
  }
}

function stubMatchMedia() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return {
      matches: query === REDUCED_MOTION_MEDIA_QUERY ? true : min ? 1920 >= Number(min[1]) : false,
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

const sims: Sim[] = []
const originalMatchMedia = window.matchMedia
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext

type Finalization = ActiveSession['finalization']

/** The open session becomes the contract's example session with `finalization` (and, when given, the alert). */
function coreState(sim: Sim, finalization: Finalization, alerts: readonly SimAlert[], patch: Record<string, unknown> = {}) {
  const session = sim.store.getState().session!
  sim.store.setState({
    session: { ...session, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization, captureDurable: true, ...patch } as typeof session,
    alerts: [...alerts],
  })
}
const blocked = (sim: Sim) => coreState(sim, SEAL_BLOCKED_EXAMPLE_FINALIZATION, [SEAL_BLOCKED_EXAMPLE_ALERT])
const retrying = (sim: Sim) => coreState(sim, SEAL_RETRYING_EXAMPLE_FINALIZATION, [])

function mount(route: string, prepare: (sim: Sim) => void): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: DEMO_NOW })
  const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario: 'finalizing', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  prepare(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: [route] }) })
  render(<RouterProvider router={router} />)
  return sim
}

const dialog = () => screen.findByTestId('finalization-modal', {}, FIND)

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  Element.prototype.scrollTo ??= function scrollTo() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
})

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
  window.matchMedia = originalMatchMedia
})

beforeEach(() => {
  resetMissingI18nKeys()
  stubMatchMedia()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  vi.unstubAllGlobals()
  window.sessionStorage.clear()
})

describe('the examples are the contract (a guard of this file)', () => {
  it('the shared reader reads BLOCKED and RETRYING from the two example states', () => {
    const session = { id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING' as const }
    expect(sealAttentionOf({ session: { ...session, finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION }, alerts: [SEAL_BLOCKED_EXAMPLE_ALERT] })?.kind).toBe('BLOCKED')
    expect(sealAttentionOf({ session: { ...session, finalization: SEAL_RETRYING_EXAMPLE_FINALIZATION }, alerts: [] })?.kind).toBe('RETRYING')
  })
})

describe('G75b-02 dialog: blocked', () => {
  it('says sealing is blocked, the reason, what restores it, that the recording is kept and what the operator can do - no percentage, no "Resumed after restart"', async () => {
    mount('/session', blocked)
    const modal = await dialog()
    const notice = within(modal).getByTestId('sm-seal-attention')
    expect(notice).toHaveAttribute('data-kind', 'BLOCKED')
    expect(notice).toHaveAttribute('role', 'alert')
    expect(within(modal).getByRole('heading', { name: W.title })).toBeInTheDocument()
    // The Core's own words. Fix wave M (G75e-06 (b), final re-check 75): the dialog stated the cause FOUR times - the
    // sentence of the failed step, the detail code's sentence and the alert's message all begin with it. The alert's
    // message is the whole statement (the cause, what restores the seal, what it costs); the other two are drawn only
    // where they add to it. (This replaces the pin "all three sentences are drawn".)
    const failedStep = SEAL_BLOCKED_EXAMPLE_FINALIZATION.steps.find((step) => step.status === 'error')!
    expect(within(notice).getByTestId('sm-seal-attention-message')).toHaveTextContent(SEAL_BLOCKED_EXAMPLE_ALERT.message)
    const text = notice.textContent ?? ''
    const cause = SEAL_BLOCKED_DETAIL_SENTENCE.SESSION_KEY_STORE_UNAVAILABLE.replace(/\.$/, '')
    expect(SEAL_BLOCKED_EXAMPLE_ALERT.message).toContain(cause)
    expect(failedStep.detail).toContain(cause)
    expect(text.split(cause)).toHaveLength(2)
    expect(notice).not.toHaveTextContent(failedStep.detail!)
    // "after 3 automatic retries" is the retry control's sentence, once.
    expect(text.split('3 automatic retries')).toHaveLength(2)
    // The rule: a sentence whose leading clause the message holds is not drawn again; one that adds to it is.
    expect(saidAlready(SEAL_BLOCKED_EXAMPLE_ALERT.message, SEAL_BLOCKED_DETAIL_SENTENCE.SESSION_KEY_STORE_UNAVAILABLE)).toBe(true)
    expect(saidAlready(SEAL_BLOCKED_EXAMPLE_ALERT.message, failedStep.detail!)).toBe(true)
    expect(saidAlready(SEAL_BLOCKED_EXAMPLE_ALERT.message, SEAL_BLOCKED_DETAIL_SENTENCE.SESSION_KEY_UNSAFE)).toBe(false)
    expect(notice).toHaveTextContent(SEAL_RECORDING_KEPT_SENTENCE)
    expect(notice).toHaveTextContent(W.action)
    expect(notice).toHaveTextContent(W.closeNote)
    // Nothing invented.
    expect(within(modal).queryByTestId('sm-final-progress')).toBeNull()
    expect(modal).not.toHaveTextContent(/\d+% complete/)
    expect(within(modal).queryByTestId('sm-final-eta')).toBeNull()
    expect(within(modal).queryByTestId('sm-final-resumed')).toBeNull()
    expect(modal).not.toHaveTextContent(F.resumed)
    expect(modal).not.toHaveTextContent(F.title)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('can be left with its button; the session stays FINALIZING on the Core', async () => {
    const sim = mount('/session', blocked)
    const modal = await dialog()
    fireEvent.click(within(modal).getByTestId('sm-final-close'))
    await waitFor(() => expect(screen.queryByTestId('finalization-modal')).toBeNull(), FIND)
    expect(sim.store.getState().session).toMatchObject({ id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING' })
  })

  it('can be left with Escape', async () => {
    mount('/session', blocked)
    const modal = await dialog()
    fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('finalization-modal')).toBeNull(), FIND)
  })

  it('the alert resolved (the seal runs again): the notice goes and the progress is back', async () => {
    const sim = mount('/session', blocked)
    const modal = await dialog()
    expect(within(modal).getByTestId('sm-seal-attention')).toBeInTheDocument()
    act(() => {
      const session = sim.store.getState().session!
      const steps = session.finalization.steps.map((step, index) => (index === 0 ? { ...step, status: 'active' as const, detail: null, progress: 10 } : step))
      sim.store.setState({ session: { ...session, finalization: { ...session.finalization, steps } }, alerts: [{ ...SEAL_BLOCKED_EXAMPLE_ALERT, active: false, resolvedAt: DEMO_NOW }] })
    })
    await waitFor(() => expect(within(modal).queryByTestId('sm-seal-attention')).toBeNull(), FIND)
    expect(within(modal).getByTestId('sm-final-progress')).toBeInTheDocument()
    expect(within(modal).queryByTestId('sm-final-close')).toBeNull()
  })
})

describe('G75b-02 dialog: retrying', () => {
  it("shows the Core's retry sentence and that the recording is kept; it can be left; no \"Resumed after restart\" from `attempt`", async () => {
    mount('/session', retrying)
    const modal = await dialog()
    const notice = within(modal).getByTestId('sm-seal-attention')
    expect(notice).toHaveAttribute('data-kind', 'RETRYING')
    const failedStep = SEAL_RETRYING_EXAMPLE_FINALIZATION.steps.find((step) => step.status === 'error')!
    expect(failedStep.attempt).toBeGreaterThan(1)
    expect(notice).toHaveTextContent(W.retryTitle)
    expect(notice).toHaveTextContent(failedStep.detail!)
    expect(notice).toHaveTextContent(SEAL_RECORDING_KEPT_SENTENCE)
    expect(within(modal).queryByTestId('sm-final-resumed')).toBeNull()
    expect(modal).not.toHaveTextContent(/\d+% complete/)
    expect(within(modal).getByTestId('sm-final-close')).toBeInTheDocument()
  })
})

describe('G75b-02 rows: the Monitor banner and the Dashboard', () => {
  it('Monitor banner: "SEALING BLOCKED" with the Core\'s reason - not "FINALIZING ... step 1 of 6"', async () => {
    mount('/session', blocked)
    const banner = await screen.findByTestId('sm-status-banner', {}, FIND)
    expect(banner).toHaveTextContent(W.bannerTitle)
    expect(banner).toHaveAttribute('data-seal', 'BLOCKED')
    expect(banner).not.toHaveTextContent(en.session.banner.FINALIZING.title)
    expect(banner).not.toHaveTextContent(/step \d of \d/i)
    expect(within(banner).getByTestId('sm-banner-detail')).toHaveTextContent(SEAL_RECORDING_KEPT_SENTENCE)
  })

  it('Dashboard: the session row reads "Sealing blocked", shows no step progress and no spinner', async () => {
    mount('/dashboard', blocked)
    const row = await screen.findByTestId('session-finalizing', {}, FIND)
    expect(row).toHaveTextContent(W.rowState)
    expect(row).toHaveAttribute('data-seal', 'BLOCKED')
    expect(row).not.toHaveTextContent(en.dashboard.activeSession.finalizing.title)
    expect(row).not.toHaveTextContent(/Step \d of \d/)
    expect(within(row).queryByRole('progressbar')).toBeNull()
    expect(row).toHaveTextContent(SEAL_RECORDING_KEPT_SENTENCE)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('CONTROL - a seal that runs: the banner reads FINALIZING, the Dashboard "Finalizing evidence"', async () => {
    mount('/dashboard', () => undefined)
    const row = await screen.findByTestId('session-finalizing', {}, FIND)
    expect(row).toHaveTextContent(en.dashboard.activeSession.finalizing.title)
    expect(row).not.toHaveTextContent(W.rowState)
  })
})

describe('"Resumed after restart" is no reading of `attempt` (contract note section 4)', () => {
  const attemptTwo = (sim: Sim, patch: Record<string, unknown>) => {
    const session = sim.store.getState().session!
    const steps = session.finalization.steps.map((step, index) => ({ ...step, attempt: 2, status: index === 0 ? ('active' as const) : ('pending' as const), progress: index === 0 ? 5 : 0 }))
    sim.store.setState({ session: { ...session, state: 'FINALIZING', finalization: { ...session.finalization, steps }, ...patch } as typeof session })
  }

  it("a session of the Core's own capture at attempt 2: the note is not shown", async () => {
    mount('/session', (sim) => attemptTwo(sim, { captureDurable: true }))
    const modal = await dialog()
    expect(within(modal).getByTestId('sm-final-progress')).toBeInTheDocument()
    expect(within(modal).queryByTestId('sm-final-resumed')).toBeNull()
  })

  it("CONTROL - the simulator's own session at attempt 2 (there the attempt only grows on a recovery): the note stays", async () => {
    mount('/session', (sim) => attemptTwo(sim, {}))
    const modal = await dialog()
    expect(within(modal).getByTestId('sm-final-resumed')).toHaveTextContent(F.resumed)
  })
})

describe('CONTROL - a seal that simply runs', () => {
  it('keeps its percent, shows no notice and cannot be closed', async () => {
    mount('/session', () => undefined)
    const modal = await dialog()
    expect(within(modal).queryByTestId('sm-seal-attention')).toBeNull()
    expect(within(modal).getByTestId('sm-final-progress')).toBeInTheDocument()
    expect(within(modal).queryByTestId('sm-final-close')).toBeNull()
    fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' })
    expect(screen.getByTestId('finalization-modal')).toBeInTheDocument()
  })
})
