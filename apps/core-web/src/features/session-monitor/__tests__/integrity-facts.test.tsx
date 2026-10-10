// Fix wave H, driver A, finding G75-01 (gate 75; gate 89 B-1: the Monitor said "Encryption Active
// AES-256 Passing" while the recording was plaintext on disk; rulings D197, D199). In a recording
// of the Core's own capture the EVIDENCE INTEGRITY panel states only what the Core has: the capture
// state, that the media is encrypted WHEN THE SESSION IS SEALED, the audit log's hash chain and the
// clock the Core reads. No encryption, secure-timestamp or write-verified claim.
//
// The session is put on the store as the Core sends it in real capture (`captureDurable` beside the
// stored state), as `situation-c.test.tsx` does. CONTROL: the simulator's own recording (no member)
// keeps its four demo checks.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'

vi.setConfig({ testTimeout: 30_000 })

const F = en.session.integrityFacts
const D = en.session.integrity
/** What the panel must never say of a recording of the Core's own capture. */
const CLAIMS = [D.encryption.label, D.encryption.value, D.timestamp.label, D.storageWrite.label, D.storageWrite.value, 'GNSS', 'AES']

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

function mount(prepare: (sim: Sim) => void) {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: Date.now() })
  const sim = createSim({ scenario: 'recording', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  prepare(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/session'] }) })
  render(<RouterProvider router={router} />)
  return sim
}

const setSession = (sim: Sim, patch: Record<string, unknown>) => {
  const session = sim.store.getState().session!
  sim.store.setState({ session: { ...session, ...patch } as typeof session })
}

const checks = () => screen.findByTestId('sm-integrity-checks', {}, { timeout: 15_000 })
const rows = (list: HTMLElement) => within(list).getAllByRole('listitem').map((row) => [row.getAttribute('data-check'), row.getAttribute('data-status')])

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

describe('G75-01: EVIDENCE INTEGRITY in a recording of the Core\'s own capture', () => {
  it('durable recording: capture state, "encrypted when the session is sealed", the audit chain and the Core clock - and no encryption, timestamp or write-verified claim', async () => {
    mount((sim) => setSession(sim, { captureDurable: true }))
    const list = await checks()
    expect(list).toHaveAttribute('data-capture-facts', 'true')
    expect(rows(list)).toEqual([
      ['capture', 'pass'],
      ['protection', 'idle'],
      ['hashChain', 'pass'],
      ['time', 'idle'],
    ])
    expect(list).toHaveTextContent(F.capture.DURABLE)
    expect(list).toHaveTextContent(F.protection.AT_SEAL)
    expect(list).toHaveTextContent(F.auditChain.label)
    expect(list).toHaveTextContent('Core system clock (UTC+07:00)')
    const panel = screen.getByTestId('panel-N')
    for (const claim of CLAIMS) expect(panel, claim).not.toHaveTextContent(claim)
    expect(panel).not.toHaveTextContent(F.protection.SEALED)
    expect(screen.getByTestId('sm-integrity-facts-note')).toHaveTextContent(F.note)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('connecting: nothing is recorded yet; sealed: "Encrypted at seal" is said only then', async () => {
    const sim = mount((s) => setSession(s, { captureDurable: false }))
    const list = await checks()
    expect(list).toHaveTextContent(F.capture.CONNECTING)
    expect(rows(list)[0]).toEqual(['capture', 'idle'])
    expect(list).not.toHaveTextContent(F.protection.SEALED)

    act(() => setSession(sim, { state: 'SEALED', captureDurable: true }))
    await waitFor(() => expect(screen.getByTestId('sm-integrity-checks')).toHaveTextContent(F.protection.SEALED))
    expect(rows(screen.getByTestId('sm-integrity-checks'))[1]).toEqual(['protection', 'pass'])
    expect(screen.getByTestId('sm-integrity-checks')).not.toHaveTextContent(F.protection.AT_SEAL)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('CONTROL - the simulator\'s own recording (no capture member) keeps its four demo checks', async () => {
    mount(() => undefined)
    const list = await checks()
    expect(list).not.toHaveAttribute('data-capture-facts')
    expect(rows(list).map(([id]) => id)).toEqual(['encryption', 'hashChain', 'timestamp', 'storageWrite'])
    expect(list).toHaveTextContent(D.encryption.label)
    expect(list).toHaveTextContent('GNSS (UTC+07:00)')
    expect(screen.queryByTestId('sm-integrity-facts-note')).toBeNull()
  })
})
