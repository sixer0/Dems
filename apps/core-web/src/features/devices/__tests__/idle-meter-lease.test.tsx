/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Decisions D51 / D53 (plan D53 part (d), row 92): the idle microphone meters. While no session is active, Devices &
// Inputs holds the Core's idle-meter lease (operation 113 `holdIdleMeters`, 30 s) - now, then every 10 s - so that
// the Core reads the PRIMARY / STANDBY microphones; the levels reach the meters through the state they already read.
// The audio cards say that the level is a check, not a recording (`devices.audio.idleLevel`), or that it cannot be
// shown (`idleUnavailable`) when the Core refuses the lease.
//
// Two layers: the lease itself on the fake clock of Vitest (`createIdleMeterLease`), and the page in Live mode on the
// contract-checked fake transport (the live test bed). No Core and no browser were run.
import { configure, screen, waitFor, within, act, cleanup } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { stubMediaForJsdom } from '@/features/session-new/__tests__/live-session-new-bed'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'
import { createIdleMeterLease, IDLE_METER_RENEW_MS, type HoldIdleMetersCall } from '../idle-meter-lease'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const A = en.devices.audio
type Device = SimState['captureDevices']['devices'][number]

/** A Core in real capture: every source states its class. */
const realCapture = (state: SimState): SimState => ({
  ...state,
  captureDevices: { devices: state.captureDevices.devices.map((device) => ({ ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }) as Device) },
})

/** Lets the promise jobs of an answered call run (the fake clock of Vitest does not run them). */
const settle = async () => {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve()
}

describe('the lease (createIdleMeterLease, fake timers)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] }))
  afterEach(() => vi.useRealTimers())

  const held: HoldIdleMetersCall = () => Promise.resolve({ ok: true })

  it('asks at once, then every 10 s; a second holder adds no call; it stops when the last holder releases', async () => {
    const call = vi.fn(held)
    const lease = createIdleMeterLease(call, undefined, () => undefined)
    expect(lease.state()).toBe('OFF')
    const first = lease.hold()
    expect(call).toHaveBeenCalledTimes(1)
    expect(lease.state()).toBe('PENDING')
    await settle()
    expect(lease.state()).toBe('HELD')
    const second = lease.hold()
    expect(call).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(IDLE_METER_RENEW_MS - 1)
    expect(call).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(call).toHaveBeenCalledTimes(2)
    first()
    first() // a release is idempotent: it does not release the other holder
    vi.advanceTimersByTime(IDLE_METER_RENEW_MS)
    expect(call).toHaveBeenCalledTimes(3)
    second()
    expect(lease.state()).toBe('OFF')
    vi.advanceTimersByTime(IDLE_METER_RENEW_MS * 5)
    expect(call).toHaveBeenCalledTimes(3)
  })

  it('a refusal: UNAVAILABLE and ONE record per run of refusals; the next renewal asks again and a held answer clears it', async () => {
    const answers: Awaited<ReturnType<HoldIdleMetersCall>>[] = [
      { ok: false, status: 409, code: 'INVALID_STATE' },
      { ok: false, status: 409, code: 'INVALID_STATE' },
      { ok: true },
    ]
    const report = vi.fn()
    const lease = createIdleMeterLease(() => Promise.resolve(answers.shift() ?? { ok: true }), undefined, report)
    const listener = vi.fn()
    lease.subscribe(listener)
    const release = lease.hold()
    await settle()
    expect(lease.state()).toBe('UNAVAILABLE')
    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0]![2]).toEqual({ status: 409, code: 'INVALID_STATE' })
    vi.advanceTimersByTime(IDLE_METER_RENEW_MS)
    await settle()
    expect(lease.state()).toBe('UNAVAILABLE')
    expect(report).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(IDLE_METER_RENEW_MS)
    await settle()
    expect(lease.state()).toBe('HELD')
    expect(listener).toHaveBeenCalled()
    release()
  })

  it('an answer that arrives after the release changes nothing; a call that throws is UNAVAILABLE', async () => {
    let resolve: (value: { ok: true }) => void = () => undefined
    const lease = createIdleMeterLease(() => new Promise((done) => (resolve = done)), undefined, () => undefined)
    const release = lease.hold()
    release()
    resolve({ ok: true })
    await settle()
    expect(lease.state()).toBe('OFF')

    const thrown = createIdleMeterLease(() => Promise.reject(new Error('no answer')), undefined, () => undefined)
    const off = thrown.hold()
    await settle()
    expect(thrown.state()).toBe('UNAVAILABLE')
    off()
  })
})

describe('Devices & Inputs in Live mode', () => {
  let bed: LiveTestBed | undefined
  const sims: Sim[] = []
  let restoreMedia: () => void = () => undefined
  let visibility: DocumentVisibilityState = 'visible'

  beforeAll(() => {
    restoreMedia = stubMediaForJsdom()
    Element.prototype.scrollTo ??= function scrollTo() {}
    window.scrollTo = (() => undefined) as typeof window.scrollTo
    Element.prototype.getAnimations ??= function getAnimations() {
      return []
    }
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
    return () => {
      restoreMedia()
      Reflect.deleteProperty(document, 'visibilityState')
    }
  })
  beforeEach(() => {
    visibility = 'visible'
    resetCoreErrorPresenter()
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  })
  afterEach(() => {
    cleanup()
    for (const sim of sims.splice(0)) sim.stop()
    bed?.dispose()
    bed = undefined
    vi.restoreAllMocks()
  })

  async function devicesPage(served: (idle: SimState) => SimState, script?: (bed: LiveTestBed) => void) {
    const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
    bed = created
    created.core.served = served(created.core.served)
    script?.(created)
    const page = await created.load()
    const entry = await created.mount(page, '/devices')
    const root = await screen.findByTestId('page-devices', {}, { timeout: 15_000 })
    return { root, entry }
  }
  const leases = () => bed!.fake.log.requestsOf('holdIdleMeters')

  it('no session, a Core in real capture: ONE lease call for the page (two cards), and the idle caption under each meter', async () => {
    const { root } = await devicesPage(realCapture)
    await waitFor(() => expect(within(root).getByTestId('audio-idle-AUDIO-01')).toHaveTextContent(A.idleLevel))
    expect(within(root).getByTestId('audio-idle-AUDIO-02')).toHaveTextContent(A.idleLevel)
    expect(within(root).getByTestId('audio-idle-AUDIO-01')).toHaveAttribute('data-lease', 'HELD')
    expect(leases()).toHaveLength(1)
    expect(leases()[0]!.method).toBe('POST')
  })

  it('a hidden page lets the lease go (no caption); visible again, it is asked for at once', async () => {
    const { root } = await devicesPage(realCapture)
    await waitFor(() => expect(within(root).getByTestId('audio-idle-AUDIO-01')).toBeInTheDocument())
    expect(leases()).toHaveLength(1)
    act(() => {
      visibility = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(within(root).queryByTestId('audio-idle-AUDIO-01')).toBeNull())
    expect(leases()).toHaveLength(1)
    act(() => {
      visibility = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(leases()).toHaveLength(2))
    await waitFor(() => expect(within(root).getByTestId('audio-idle-AUDIO-01')).toHaveTextContent(A.idleLevel))
  })

  it('a refused lease (409 IDLE_METERS_NOT_AVAILABLE): the cards say the level cannot be shown', async () => {
    const { root } = await devicesPage(realCapture, (created) => {
      created.fake.answer('holdIdleMeters', () => created.fake.example('holdIdleMeters', 409, 'notAvailable'))
    })
    await waitFor(() => expect(within(root).getByTestId('audio-idle-AUDIO-01')).toHaveTextContent(A.idleUnavailable))
    expect(within(root).getByTestId('audio-idle-AUDIO-01')).toHaveAttribute('data-lease', 'UNAVAILABLE')
  })

  it('unmount: no lease is asked for any more (the interval is cleared)', async () => {
    const { root, entry } = await devicesPage(realCapture)
    await waitFor(() => expect(within(root).getByTestId('audio-idle-AUDIO-01')).toBeInTheDocument())
    const clear = vi.spyOn(globalThis, 'clearInterval')
    entry.unmount()
    expect(clear).toHaveBeenCalled()
  })

  it('a session is active: no lease, no caption (the session\'s own levels are shown)', async () => {
    const recording = createSim({ scenario: 'recording', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(recording)
    const { root } = await devicesPage(() => realCapture(recording.store.getState()))
    await within(root).findByTestId('audio-input-AUDIO-01')
    await bed!.flush()
    expect(leases()).toHaveLength(0)
    expect(within(root).queryByTestId('audio-idle-AUDIO-01')).toBeNull()
  })

  it('CONTROL - a Core in simulated capture (no class stated): no lease, no caption', async () => {
    const { root } = await devicesPage((idle) => idle)
    await within(root).findByTestId('audio-input-AUDIO-01')
    await bed!.flush()
    expect(leases()).toHaveLength(0)
    expect(within(root).queryByTestId('audio-idle-AUDIO-01')).toBeNull()
  })
})
