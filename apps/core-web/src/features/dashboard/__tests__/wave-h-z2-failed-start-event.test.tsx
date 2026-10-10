// Fix wave H, closing pass Z2 - finding G75-11, the Dashboard half (gate 75: after a failed start
// the Recent Events panel still read "Recording session started"; ux 8e.2: no wording that suggests
// evidence exists). The event of an ACCEPTED start is `RECORDING_STARTED`, the contract's only type,
// and stays in the slice; the row is worded by what the start came to:
//
// | The session of the event | The row reads |
// |--------------------------|---------------|
// | a failed start (FAULT / RECOVERY with `captureDurable: false`, or its history entry with no start time) | "Recording did not start" - never "started" |
// | still connecting (`RECORDING`, `captureDurable: false`) | "Recording start accepted" |
// | anything else (CONTROL) | "Recording session started", as before |
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, type SimEvent, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'
import { recordingStartOutcome } from '../dashboard-model'

vi.setConfig({ testTimeout: 30_000 })

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

const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')
const STARTED = en.common.eventType.RECORDING_STARTED
const C = en.dashboard.captureStart
const sims: Sim[] = []
const originalMatchMedia = window.matchMedia
Element.prototype.scrollTo ??= function scrollTo() {}
window.scrollTo = (() => undefined) as typeof window.scrollTo

function mount(): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: DEMO_NOW })
  const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario: 'recording', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/dashboard'] }) })
  render(<RouterProvider router={router} />)
  return sim
}

/** The accepted start's event of the open session, as the newest event of the slice. */
function withStartEvent(sim: Sim): string {
  const state = sim.store.getState()
  const sessionId = state.session!.id
  const last = state.events.at(-1)
  const event: SimEvent = { id: 'EVT-Z2-START', seq: (last?.seq ?? 0) + 1, at: state.clock.now, type: 'RECORDING_STARTED', severity: 'SUCCESS', message: `Recording started · ${sessionId}`, params: { sessionId }, sessionId, deviceId: null }
  act(() => sim.store.setState({ events: [...state.events, event] }))
  return sessionId
}
const setSession = (sim: Sim, patch: Record<string, unknown>) => act(() => sim.store.setState({ session: { ...sim.store.getState().session!, ...patch } as SimState['session'] }))
const row = async () => {
  const list = await screen.findByTestId('recent-events', {}, { timeout: 15_000 })
  return await waitFor(() => {
    const found = list.querySelector('[data-event-id="EVT-Z2-START"]') as HTMLElement | null
    expect(found).not.toBeNull()
    return found!
  })
}

beforeEach(() => {
  resetMissingI18nKeys()
  stubMatchMedia()
  window.localStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  window.matchMedia = originalMatchMedia
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('G75-11: the Dashboard event of a start that recorded nothing', () => {
  it('a failed start: the row never reads "started"; while connecting it reads the accepted start; a durable recording reads as before', async () => {
    const sim = mount()
    withStartEvent(sim)
    // CONTROL: the simulator's durable recording.
    expect(await row()).toHaveTextContent(STARTED)

    setSession(sim, { captureDurable: false })
    await waitFor(async () => expect(await row()).toHaveTextContent(C.CONNECTING))
    expect(await row()).not.toHaveTextContent(STARTED)

    setSession(sim, { state: 'FAULT', captureDurable: false, startedAt: null })
    await waitFor(async () => expect(await row()).toHaveTextContent(C.FAILED))
    expect(await row()).not.toHaveTextContent(/started/i)
    expect(within(await row()).queryByText(STARTED)).toBeNull()

    setSession(sim, { state: 'RECORDING', captureDurable: true })
    await waitFor(async () => expect(await row()).toHaveTextContent(STARTED))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the rule (pure): the open session and, once it is closed, its history entry', () => {
    const sim = mount()
    const state = sim.store.getState()
    const id = state.session!.id
    const withSession = (patch: Record<string, unknown>) => ({ session: { ...state.session!, ...patch }, sessionHistory: state.sessionHistory }) as Pick<SimState, 'session' | 'sessionHistory'>
    expect(recordingStartOutcome(state, id)).toBe('STARTED')
    expect(recordingStartOutcome(withSession({ captureDurable: true }), id)).toBe('STARTED')
    expect(recordingStartOutcome(withSession({ captureDurable: false }), id)).toBe('CONNECTING')
    expect(recordingStartOutcome(withSession({ state: 'FAULT', captureDurable: false }), id)).toBe('FAILED')
    expect(recordingStartOutcome(withSession({ state: 'RECOVERY', captureDurable: false }), id)).toBe('FAILED')
    // An interrupted recording (FAULT of a durable capture) did start.
    expect(recordingStartOutcome(withSession({ state: 'FAULT', captureDurable: true }), id)).toBe('STARTED')
    // Closed: the history entry of a failed start has no start time.
    const entry = { ...state.sessionHistory[0]!, id: 'SES-Z2-CLOSED', startedAt: null }
    expect(recordingStartOutcome({ session: null, sessionHistory: [entry] }, 'SES-Z2-CLOSED')).toBe('FAILED')
    expect(recordingStartOutcome({ session: null, sessionHistory: [{ ...entry, startedAt: 5 }] }, 'SES-Z2-CLOSED')).toBe('STARTED')
    expect(recordingStartOutcome({ session: null, sessionHistory: [] }, 'SES-UNKNOWN')).toBe('STARTED')
    expect(recordingStartOutcome(state, null)).toBe('STARTED')
  })
})
