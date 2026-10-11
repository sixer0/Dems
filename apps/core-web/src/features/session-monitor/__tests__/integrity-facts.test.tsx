// Fix wave H, driver A, finding G75-01 (gate 75; gate 89 B-1: the Monitor said "Encryption Active
// AES-256 Passing" while the recording was plaintext on disk; rulings D197, D199). In a recording
// of the Core's own capture the EVIDENCE INTEGRITY panel states only what the Core has: the capture
// state, that the media is encrypted WHEN THE SESSION IS SEALED, the audit log's hash chain and the
// clock the Core reads. No encryption, secure-timestamp or write-verified claim.
//
// The session is put on the store as the Core sends it in real capture (`captureDurable` beside the
// stored state), as `situation-c.test.tsx` does. CONTROL: the simulator's own recording (no member)
// keeps its four demo checks.
import { act, cleanup, render, screen, waitFor, within, configure } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, CAPTURE_FAULT_NO_REASON_SENTENCES, CAPTURE_FAULT_SENTENCES, type TimelineEvent } from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import { captureCheckpointsOf } from '../capture-checkpoints-model'

describe("EVIDENCE INTEGRITY on the Monitor of a Core in its own capture (G75-01)", () => {
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
})

// Fix wave H, closing pass Z2 (driver A's request lines of 10:20:55Z; decisions D203, D207; closing
// pass Z1's line of 10:30:00Z for the member names). The Session Monitor beside a recording of the
// Core's OWN capture (the session carries `captureDurable`):
//
// | Rule | Case |
// |------|------|
// | The banner states the capture state. No "integrity checks passing", no "SECURE" | "banner" |
// | The storage panel draws no write speed and no write-rate curve (the figure is a formula of the simulator) | "storage" |
// | The timeline draws no AUTOSAVE / HEALTH row of the generator and invents no byte figure | "timeline" |
// | The capture checkpoint facts (`session.captureCheckpoints`) are drawn when the Core states them; absent = nothing drawn, never 0 | "checkpoints" |
// | A fault row of the timeline is worded, for EVERY session: never the code `CAPTURE_FAULT` | "fault row" |
//
// Each case has its CONTROL: the simulator's own recording (no capture member) keeps its values.
describe("the Monitor of a Core in its own capture states only facts: banner, storage, timeline, checkpoints", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 1_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  vi.setConfig({ testTimeout: 30_000 })

  const F = en.session.integrityFacts
  const B = en.session.banner

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

  function mount(prepare: (sim: Sim) => void = () => undefined) {
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
  const addTimeline = (sim: Sim, items: Partial<TimelineEvent>[]) => {
    const session = sim.store.getState().session!
    const at = sim.store.getState().clock.now
    const extra = items.map((item, i) => ({ id: `z2-${i}`, at: at + i, label: '', detail: null, channel: null, ...item }) as TimelineEvent)
    sim.store.setState({ session: { ...session, timeline: [...session.timeline, ...extra] } })
  }
  const panel = (id: string) => screen.findByTestId(`panel-${id}`, {}, { timeout: 15_000 })

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

  describe('banner: the capture state, no integrity claim', () => {
    it('a durable recording of the Core\'s own capture: "integrity checks passing" and "SECURE" are not said', async () => {
      mount((sim) => setSession(sim, { captureDurable: true }))
      const banner = await screen.findByTestId('sm-status-banner', {}, { timeout: 15_000 })
      expect(banner).toHaveAttribute('data-kind', 'ACTIVE')
      expect(banner).not.toHaveTextContent(/integrity checks/i)
      expect(banner).not.toHaveTextContent(/secure/i)
      expect(banner).toHaveTextContent(en.session.captureFacts.banner.title)
      expect(within(banner).getByTestId('sm-banner-detail')).toHaveTextContent(F.capture.DURABLE)
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('CONTROL - the simulator\'s own recording keeps its banner', async () => {
      mount()
      const banner = await screen.findByTestId('sm-status-banner', {}, { timeout: 15_000 })
      expect(banner).toHaveTextContent(B.ACTIVE.title)
      expect(within(banner).getByTestId('sm-banner-detail')).toHaveTextContent(B.ACTIVE.detail)
    })
  })

  describe('storage: no write speed the Core did not measure', () => {
    it('own capture: no "Write Speed" row, no MB/s figure, no write-rate curve; the volume figures stay', async () => {
      mount((sim) => setSession(sim, { captureDurable: true }))
      const storage = await panel('S')
      expect(storage).not.toHaveTextContent(en.common.storage.writeSpeed)
      expect(storage).not.toHaveTextContent('MB/s')
      expect(storage).not.toHaveTextContent(en.session.storage.writeRate)
      expect(within(storage).queryByTestId('sm-write-sparkline')).toBeNull()
      expect(within(storage).getByTestId('sm-storage-free')).toBeInTheDocument()
      expect(within(storage).getByTestId('sm-storage-ring')).toBeInTheDocument()
    })

    it('CONTROL - the simulator\'s own recording keeps the write speed and the curve', async () => {
      mount()
      const storage = await panel('S')
      expect(storage).toHaveTextContent(en.common.storage.writeSpeed)
      expect(storage).toHaveTextContent('MB/s')
      expect(within(storage).getByTestId('sm-write-sparkline')).toBeInTheDocument()
    })
  })

  describe('timeline: no generator row, no invented byte figure, no fault code', () => {
    const ROWS: Partial<TimelineEvent>[] = [
      { kind: 'AUTOSAVE', label: 'Evidence auto-save segment 4', params: { segment: 4 } },
      { kind: 'HEALTH', label: 'Device health normal', params: {} },
      { kind: 'FAULT', label: 'Critical fault: CAPTURE_FAULT', params: { kind: 'CAPTURE_FAULT', evt: 'EVT-CAPTURE', critical: true } },
    ]

    it('own capture: AUTOSAVE and HEALTH are not drawn; the fault row reads the capture sentence, not the code', async () => {
      mount((sim) => {
        setSession(sim, { captureDurable: true })
        addTimeline(sim, ROWS)
      })
      const timeline = await panel('Q')
      await waitFor(() => expect(timeline).toHaveTextContent(CAPTURE_FAULT_NO_REASON_SENTENCES.capture))
      expect(timeline).not.toHaveTextContent('CAPTURE_FAULT')
      expect(timeline).not.toHaveTextContent('Critical fault:')
      expect(timeline).not.toHaveTextContent(en.session.timeline.kind.AUTOSAVE)
      expect(timeline).not.toHaveTextContent(en.session.timeline.kind.HEALTH)
      expect(timeline.querySelectorAll('[data-kind="AUTOSAVE"]')).toHaveLength(0)
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('a fault row with a reason reads that reason\'s sentence; another fault kind reads its name', async () => {
      mount((sim) =>
        addTimeline(sim, [
          { kind: 'FAULT', label: 'Critical fault: CAPTURE_FAULT', params: { kind: 'CAPTURE_FAULT', reason: 'WORKER_CRASHED', critical: true } },
          { kind: 'FAULT', label: 'Critical fault: POWER_FAIL', params: { kind: 'POWER_FAIL', critical: true } },
        ]),
      )
      const timeline = await panel('Q')
      const sentence = (CAPTURE_FAULT_SENTENCES as Record<string, string>)['WORKER_CRASHED']
      await waitFor(() => expect(timeline).toHaveTextContent(en.common.faultKind.POWER_FAIL))
      if (sentence !== undefined && !sentence.includes('{{')) expect(timeline).toHaveTextContent(sentence)
      expect(timeline).not.toHaveTextContent('CAPTURE_FAULT')
      expect(timeline).not.toHaveTextContent('POWER_FAIL')
      expect(timeline).not.toHaveTextContent('Critical fault:')
    })

    it('CONTROL - the simulator\'s own recording keeps its AUTOSAVE row with the segment figure', async () => {
      mount((sim) => addTimeline(sim, ROWS.slice(0, 1)))
      const timeline = await panel('Q')
      await waitFor(() => expect(timeline.querySelectorAll('[data-kind="AUTOSAVE"]').length).toBeGreaterThan(0))
      expect(timeline).toHaveTextContent(en.session.timeline.kind.AUTOSAVE)
    })
  })

  describe('checkpoints: what the Core states of its durable fragments', () => {
    const CHECKPOINTS = {
      fragments: 24,
      bytes: 34_000_000,
      cameras: [
        { deviceId: 'CAM-01', fragments: 12, bytes: 20_000_000 },
        { deviceId: 'CAM-02', fragments: 12, bytes: 14_000_000 },
      ],
    }

    it('drawn on the integrity panel from the session member; one line per camera; "last N s ago" by the console clock', async () => {
      const sim = mount((s) => setSession(s, { captureDurable: true }))
      const integrity = await panel('N')
      // ABSENT: nothing is drawn - never a zero.
      expect(within(integrity).queryByTestId('sm-capture-checkpoints')).toBeNull()
      act(() => setSession(sim, { captureCheckpoints: { ...CHECKPOINTS, lastAt: Math.floor(sim.store.getState().clock.now / 1000) * 1000 - 2_000 } }))
      const facts = await within(integrity).findByTestId('sm-capture-checkpoints')
      expect(facts).toHaveTextContent('24 fragments saved')
      expect(facts).toHaveTextContent('last 2 s ago')
      expect(facts).toHaveTextContent('34 MB')
      const cameras = within(facts).getAllByTestId(/^sm-capture-checkpoints-camera-/)
      expect(cameras).toHaveLength(2)
      expect(cameras[0]).toHaveTextContent('12 fragments saved')
      expect(cameras[0]).toHaveTextContent('20 MB')
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('CONTROL - a session without the capture member draws none, whatever else it carries', async () => {
      mount((s) => setSession(s, { captureCheckpoints: { ...CHECKPOINTS, lastAt: s.store.getState().clock.now } }))
      const integrity = await panel('N')
      expect(within(integrity).queryByTestId('sm-capture-checkpoints')).toBeNull()
    })

    it('the reader (pure): a member that is not the stated shape reads as absent', () => {
      expect(captureCheckpointsOf(null)).toBeNull()
      expect(captureCheckpointsOf({})).toBeNull()
      expect(captureCheckpointsOf({ captureCheckpoints: { fragments: 0, bytes: 0, lastAt: 1, cameras: [] } })).toBeNull()
      expect(captureCheckpointsOf({ captureCheckpoints: { fragments: '3', bytes: 1, lastAt: 1, cameras: [] } })).toBeNull()
      expect(captureCheckpointsOf({ captureCheckpoints: { fragments: 3, bytes: 10, lastAt: 5, cameras: [{ deviceId: 'CAM-01', fragments: 3, bytes: 10 }, { deviceId: 7 }] } })).toEqual({
        fragments: 3,
        bytes: 10,
        lastAt: 5,
        cameras: [{ deviceId: 'CAM-01', fragments: 3, bytes: 10 }],
      })
    })
  })
})
