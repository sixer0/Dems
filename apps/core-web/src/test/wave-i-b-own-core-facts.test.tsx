// Fix wave I, driver B - findings G75b-06 (web half) and G75b-08 of re-gate 75 (`gateway_check/10b_m5_regate.md`).
//
// A CORE IN ITS OWN CAPTURE states its time as the host system clock (`time.hostClock`, the shared
// constant `HOST_CLOCK_TIME`) and reports no TPM / Secure Boot state. Each chip states only that:
//
// | Surface | Was | Rule | Case |
// |---|---|---|---|
// | Dashboard strip, time cell | "GNSS / Time - RTC holdover" | "Time - Host system clock", no warning tone | "strip" |
// | Dashboard card, time column | "GNSS / Time Sync - RTC HOLDOVER" | "HOST CLOCK" | "card time" |
// | Dashboard card, platform column | "TPM 2.0 Verified" | "NOT REPORTED" | "card platform" |
// | Header pill checklist | "TPM 2.0 and Secure Boot OK", "Trusted time source OK" | "Not reported", "Host system clock" | "pill" |
// | Network & Time banner, chip, source, tiers, facts, offset | "RTC holdover", stratum 0, "Last sync 07:00:00" | host clock, "Not configured", nothing measured | "network & time" |
// | Session Monitor, Session Size | 47 MB (the simulator's formula) against 18 MB durable | the durable bytes of `captureCheckpoints`; none stated = a dash | "session size" |
// | Session Monitor timeline while connecting | "Recording Started" | not drawn until the Core says a fragment is durable | "timeline" |
//
// Every case has its CONTROL: the simulated lane keeps its demonstration figures.
import { cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, HOST_CLOCK_TIME, OPERATOR_IDS, type ScenarioName, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'

vi.setConfig({ testTimeout: 30_000 })

const W = enWeb.web.ownCore
const P = enWeb.web.securePill.checkStatus
const FIND = { timeout: 15_000 }

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
const sims: Sim[] = []
const originalMatchMedia = window.matchMedia
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext

/**
 * What a Core in its own capture sends: the time slice of the shared constant, and - since closing pass J
 * (D217 (7)) - its own statement of the platform facts (`security.platformNotReported`, the contract example).
 * The platform column / row reads THAT member; `pass-j.test.tsx` holds that it no longer follows the time slice.
 */
const ownCore = (sim: Sim) => sim.store.setState({ time: { ...HOST_CLOCK_TIME }, security: { ...sim.store.getState().security, ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE } })

function mount(route: string, scenario: ScenarioName, prepare: (sim: Sim) => void = () => undefined): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: DEMO_NOW })
  const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario, storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  prepare(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: [route] }) })
  render(<RouterProvider router={router} />)
  return sim
}

const setSession = (sim: Sim, patch: Record<string, unknown>) => {
  const session = sim.store.getState().session!
  sim.store.setState({ session: { ...session, ...patch } as typeof session })
}

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

describe('G75b-06 Dashboard: a Core in its own capture', () => {
  it('strip: the time cell reads the host system clock - no GNSS label, no "holdover", no warning tone', async () => {
    mount('/dashboard', 'idle', ownCore)
    const cell = await screen.findByTestId('strip-time', {}, FIND)
    expect(cell).toHaveTextContent(W.time.value)
    expect(cell).toHaveTextContent(W.time.label)
    expect(cell).not.toHaveTextContent(/GNSS|holdover|RTC/i)
    expect(cell).toHaveAttribute('data-tone', 'default')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('card: the time column reads HOST CLOCK, the platform column NOT REPORTED - never "TPM 2.0 Verified"', async () => {
    mount('/dashboard', 'idle', ownCore)
    const time = await screen.findByTestId('stn-time', {}, FIND)
    expect(time).toHaveTextContent(W.time.chip)
    expect(time).not.toHaveTextContent(/GNSS|HOLDOVER/i)
    expect(time).toHaveAttribute('data-tone', 'default')
    const platform = screen.getByTestId('stn-tpm')
    expect(platform).toHaveTextContent(W.platform.chip)
    expect(platform).toHaveTextContent(W.platform.tpm)
    expect(platform).toHaveTextContent(W.platform.secureBoot)
    expect(platform).not.toHaveTextContent(/verified|active|enabled/i)
    expect(platform).toHaveAttribute('data-tone', 'default')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('CONTROL - the simulated lane keeps "Synchronized", "GNSS LOCKED" and "TPM 2.0 Verified"', async () => {
    mount('/dashboard', 'idle')
    const cell = await screen.findByTestId('strip-time', {}, FIND)
    expect(cell).toHaveTextContent(en.dashboard.statusStrip.value.timeGnss)
    expect(cell).toHaveTextContent(en.dashboard.statusStrip.time)
    expect(screen.getByTestId('stn-time')).toHaveTextContent(en.dashboard.securityTimeNetwork.time.chip.GNSS)
    expect(screen.getByTestId('stn-tpm')).toHaveTextContent(en.dashboard.securityTimeNetwork.tpm.verified)
  })

  it('CONTROL - a GNSS loss of the simulation (RTC, no host clock) still reads "RTC holdover"', async () => {
    mount('/dashboard', 'idle', (sim) => sim.store.setState({ time: { ...sim.store.getState().time, source: 'RTC', locked: false } }))
    expect(await screen.findByTestId('strip-time', {}, FIND)).toHaveTextContent(en.dashboard.statusStrip.value.timeRtc)
  })
})

describe('G75b-06 header pill checklist', () => {
  const rowOf = (list: HTMLElement, label: string) => within(list).getByText(label).closest('li')!

  it('a Core in its own capture: the platform row is "Not reported", the time row "Host system clock"', async () => {
    mount('/dashboard', 'idle', ownCore)
    const pill = await screen.findByTestId('secure-pill', {}, FIND)
    pill.click()
    const list = await screen.findByTestId('integrity-checklist', {}, FIND)
    expect(rowOf(list, en.shell.securePill.checks.platform)).toHaveTextContent(P.NOT_REPORTED)
    expect(rowOf(list, en.shell.securePill.checks.platform)).toHaveAttribute('data-status', 'UNKNOWN')
    expect(rowOf(list, en.shell.securePill.checks.timeSource)).toHaveTextContent(P.HOST_CLOCK)
    expect(rowOf(list, en.shell.securePill.checks.timeSource)).not.toHaveTextContent(en.shell.securePill.checkStatus.OK)
  })

  it('CONTROL - the simulated lane: both rows read OK', async () => {
    mount('/dashboard', 'idle')
    const pill = await screen.findByTestId('secure-pill', {}, FIND)
    pill.click()
    const list = await screen.findByTestId('integrity-checklist', {}, FIND)
    expect(rowOf(list, en.shell.securePill.checks.platform)).toHaveTextContent(en.shell.securePill.checkStatus.OK)
    expect(rowOf(list, en.shell.securePill.checks.timeSource)).toHaveTextContent(en.shell.securePill.checkStatus.OK)
  })
})

describe('G75b-06 Network & Time: a Core in its own capture', () => {
  it('banner, chip, source, tiers, facts and offset state the host clock and nothing measured', async () => {
    mount('/network-time', 'idle', ownCore)
    const banner = await screen.findByTestId('network-time-banner', {}, FIND)
    expect(banner).toHaveTextContent(W.time.value)
    expect(banner).not.toHaveTextContent(/holdover|stratum \d|RTC/i)
    expect(banner).toHaveAttribute('data-time', 'HOST_CLOCK')
    expect(screen.getByTestId('network-time-sync-chip')).toHaveTextContent(W.time.value)
    expect(screen.getByTestId('network-time-source')).toHaveTextContent(W.time.value)
    expect(screen.getByTestId('network-time-source')).not.toHaveTextContent(/holdover/i)
    const notice = screen.getByTestId('network-time-host-clock')
    expect(notice).toHaveTextContent(W.time.hierarchyNotice)
    expect(screen.queryByTestId('network-time-tiers')).toBeNull()
    expect(screen.queryByTestId('network-time-facts')).toBeNull()
    expect(screen.queryByTestId('network-time-orbit')).toBeNull()
    expect(screen.getByTestId('network-time-offset-empty')).toHaveTextContent(W.time.offsetEmpty)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('CONTROL - the simulated lane keeps "Synchronized", its tiers and its facts', async () => {
    mount('/network-time', 'idle')
    const banner = await screen.findByTestId('network-time-banner', {}, FIND)
    expect(banner).toHaveTextContent(en.networkTime.bannerState.time.LOCKED)
    expect(screen.getByTestId('network-time-tiers')).toBeInTheDocument()
    expect(screen.getByTestId('network-time-facts')).toBeInTheDocument()
    expect(screen.queryByTestId('network-time-host-clock')).toBeNull()
  })
})

describe('G75b-06 Session Monitor: the session size is the durable bytes', () => {
  const checkpoints = { fragments: 15, bytes: 18_000_000, lastAt: DEMO_NOW, cameras: [] }

  it('own capture with checkpoints: 18 MB (the checkpoint), not the 47 MB of `bytesWritten`', async () => {
    mount('/session', 'recording', (sim) => setSession(sim, { captureDurable: true, bytesWritten: 47_000_000, captureCheckpoints: checkpoints }))
    const size = await screen.findByTestId('sm-session-size', {}, FIND)
    expect(size).toHaveTextContent('18 MB')
    expect(size).not.toHaveTextContent('47')
  })

  it('own capture, no checkpoint stated yet: a dash, never the formula figure', async () => {
    mount('/session', 'recording', (sim) => setSession(sim, { captureDurable: true, bytesWritten: 47_000_000 }))
    const size = await screen.findByTestId('sm-session-size', {}, FIND)
    expect(size).toHaveTextContent('—')
    expect(size).not.toHaveTextContent('47')
  })

  it("CONTROL - the simulator's own recording keeps `bytesWritten`", async () => {
    mount('/session', 'recording', (sim) => setSession(sim, { bytesWritten: 47_000_000 }))
    expect(await screen.findByTestId('sm-session-size', {}, FIND)).toHaveTextContent('47 MB')
  })
})

describe('G75b-08 Session Monitor timeline: "Recording Started" only once the Core says recording', () => {
  const started = en.session.timeline.kind.START

  it('while the cameras connect (`captureDurable: false`) the START row is not drawn', async () => {
    mount('/session', 'recording', (sim) => setSession(sim, { captureDurable: false }))
    const panel = await screen.findByTestId('panel-Q', {}, FIND)
    expect(within(panel).queryByText(started)).toBeNull()
  })

  it('from the first durable fragment (`captureDurable: true`) it is drawn', async () => {
    mount('/session', 'recording', (sim) => setSession(sim, { captureDurable: true }))
    const panel = await screen.findByTestId('panel-Q', {}, FIND)
    expect(within(panel).getAllByText(started).length).toBeGreaterThan(0)
  })

  it("CONTROL - the simulator's own recording draws it", async () => {
    mount('/session', 'recording')
    const panel = await screen.findByTestId('panel-Q', {}, FIND)
    expect(within(panel).getAllByText(started).length).toBeGreaterThan(0)
  })
})
