// Task 3, integration pass D7 item 4, web (row 139's leftovers, implementation/70 §5 "Also open";
// masterplan/08_client_ux_spec.md §8e.2 "no meter presented as recording"; decisions D84, D91).
//
// Before the first durable fragment the Session Monitor (WB-01) still drew its two audio meters with
// live levels, and the Evidence Integrity panel keyed on `RECORDING`: "Storage Write Verified —
// Continuous" while nothing was written. Held in Simulated client mode on the real router (the
// simulator never writes `captureDurable`; the state is put on the store as the Core sends it):
// while `captureDurable` is false the audio panel shows the connecting state in each meter's place
// and the integrity panel claims no storage write; the first durable fragment brings both back.
// CONTROL: the session without the member, as before.
//
// Wave H closing pass Z2 (item 9): since driver A (finding G75-01) a session that CARRIES the member
// is a recording of the Core's own capture and the panel draws the capture facts instead of the four
// demo checks, so there is no storage-write row to read while connecting. What this file proves is
// unchanged - NO INTEGRITY ACTIVITY IS CLAIMED WHILE CONNECTING: the capture row is standby and says
// nothing is recorded yet, no row but the audit log's own hash chain is 'pass', and no demo claim
// ("Continuous", "Verified", "Encryption Active", "AES-256") is on the panel. The first durable
// fragment turns the capture row to 'pass'.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, type SimState } from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import { selectIntegrity } from '../model'

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

const sims: Sim[] = []

function mount(): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: Date.now() })
  const sim = createSim({ scenario: 'recording', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/session'] }) })
  render(<RouterProvider router={router} />)
  return sim
}

const setDurable = (sim: Sim, captureDurable: boolean) => act(() => sim.store.setState({ session: { ...sim.store.getState().session!, captureDurable } }))
const panel = (id: 'N' | 'O') => screen.findByTestId(`panel-${id}`, {}, { timeout: 15_000 })
const storageWrite = (integrity: HTMLElement) => integrity.querySelector('[data-check="storageWrite"]') as HTMLElement | null
const capture = (integrity: HTMLElement) => integrity.querySelector('[data-check="capture"]') as HTMLElement
const passing = (integrity: HTMLElement) => [...integrity.querySelectorAll('[data-check][data-status="pass"]')].map((row) => row.getAttribute('data-check'))
/** What the panel must not say while nothing is recorded. */
const ACTIVITY_CLAIMS = ['Continuous', 'Verified', 'Encryption Active', 'AES-256', 'GNSS']

const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  Element.prototype.scrollTo ??= function scrollTo() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
})

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})

beforeEach(() => {
  resetMissingI18nKeys()
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  vi.unstubAllGlobals()
})

describe('the Session Monitor while the cameras connect (pass D7 item 4)', () => {
  it('no audio meter and no claim of a storage write before the first durable fragment; both come back with it', async () => {
    const sim = mount()
    const [integrity, audio] = [await panel('N'), await panel('O')]
    // CONTROL: the session without the member is a recording — two meters, the write verified.
    expect(within(audio).getAllByTestId('dbfs-meter')).toHaveLength(4) // D61 (2026-11-04): four simultaneous channels
    expect(within(audio).queryByTestId('sm-audio-connecting-AUDIO-01')).toBeNull()
    expect(storageWrite(integrity)).toHaveAttribute('data-status', 'pass')
    expect(storageWrite(integrity)).toHaveTextContent('Continuous')
    expect(capture(integrity)).toBeNull()

    setDurable(sim, false)
    await waitFor(() => expect(within(audio).queryAllByTestId('dbfs-meter')).toHaveLength(0))
    for (const channel of ['AUDIO-01', 'AUDIO-02']) {
      const place = within(audio).getByTestId(`sm-audio-connecting-${channel}`)
      expect(place).toHaveTextContent('CONNECTING')
      expect(place.getAttribute('aria-label')).toMatch(/: Connecting cameras…$/)
    }
    expect(within(audio).queryByRole('meter')).toBeNull()
    expect(within(audio).queryByText(/dBFS/)).toBeNull()
    // No integrity activity is claimed while connecting: the capture row is standby, only the audit
    // log's own chain passes, the storage-write row of the demo checks is gone with its claim.
    await waitFor(() => expect(capture(integrity)).toHaveAttribute('data-status', 'idle'))
    expect(capture(integrity)).toHaveTextContent('Connecting cameras. Nothing is recorded yet')
    expect(storageWrite(integrity)).toBeNull()
    expect(passing(integrity)).toEqual(['hashChain'])
    for (const claim of ACTIVITY_CLAIMS) expect(integrity, claim).not.toHaveTextContent(claim)

    setDurable(sim, true)
    await waitFor(() => expect(within(audio).getAllByTestId('dbfs-meter')).toHaveLength(4)) // D61 (2026-11-04): four simultaneous channels
    expect(capture(integrity)).toHaveAttribute('data-status', 'pass')
    expect(passing(integrity)).toEqual(['capture', 'hashChain'])
    for (const claim of ACTIVITY_CLAIMS) expect(integrity, claim).not.toHaveTextContent(claim)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the rule (pure): the integrity model says "recording" for a durable recording only', () => {
    const sim = mount()
    const state = sim.store.getState()
    const withSession = (patch: Record<string, unknown>): SimState => ({ ...state, session: { ...state.session!, ...patch } }) as SimState
    expect(selectIntegrity(state)).toMatchObject({ recording: true, storageWrite: 'pass' })
    expect(selectIntegrity(withSession({ captureDurable: true }))).toMatchObject({ recording: true, storageWrite: 'pass' })
    expect(selectIntegrity(withSession({ captureDurable: false }))).toMatchObject({ recording: false, storageWrite: 'idle' })
    // A storage fault is still said while connecting: the panel hides no fault.
    expect(selectIntegrity({ ...withSession({ captureDurable: false }), storage: { ...state.storage, state: 'FULL' } } as SimState).storageWrite).toBe('fail')
  })
})
