// REAL CAPTURE STATES ONLY FACTS. On a Core in its own capture a screen of the web console states the
// Core's own fact, "Not reported", or nothing - never a constant of the simulator, of a bundled
// demonstration index or of an adapter default. ONE file holds the cases of that rule (suite
// consolidation, test/14; PROTECTED: every case of the four fix rounds is here, none was merged into
// another or dropped). Each block keeps the note of the round that wrote it; the SIMULATED lane has a
// control in every block.
import { describe, afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within, act, configure } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE, SESSION_CAPTURE_CHECKPOINTS_EXAMPLE, CORE_NOT_RUNNING_FAULT_EXAMPLE, START_REFUSED_SESSION_KEY_EXAMPLE, CORE_API_EXAMPLES, EVIDENCE_SEALED_PROFILE_EXAMPLE, EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { type SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, HOST_CLOCK_TIME, OPERATOR_IDS, SOFTWARE_VERSION, UPDATER_NOT_AVAILABLE, DEVICE_ID, DEVICE_IDENTITY, type ScenarioName, type Sim, CORE_NOT_RUNNING_LABEL, SEAL_BLOCKED_EXAMPLE_ALERT, SEAL_BLOCKED_EXAMPLE_FINALIZATION, SEAL_BLOCKED_EXAMPLE_SESSION_ID, START_REFUSED_REASONS, coreNotRunningFaultTransition, startRefusedReasonOf, startRefusedSentenceKey, type EvidenceItem } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys, createI18n } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'
import { LiveTransportError, CoreMode } from '@dems/shared/live'
import { INTEGRITY_CHECK_IDS, ownCoreRow, pillSubtitle, selectIntegrityChecks, selectPillCause, selectPillState } from '@/components/shell/integrity-checks'
import { buildControls, postureOf, verifyChain } from '@/features/security-audit/model'
import { CoreErrorNoticeKind, describeCoreError } from '@/lib/core-errors'
import { isOwnCaptureCore, isPlatformNotReportedCore, isSelfCaptureCore, reportedSigningKeyOf } from '@/lib/own-capture'
import { WEB_CONSOLE_VERSION } from '@/lib/product-versions'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { countedDevicesOf, COUNTED_DEVICES, selectBanner, selectSummary } from '@/features/devices/model'
import { keyEntries, ownCoreKeyEntries } from '@/features/security-audit/sim-adapter'
import { realSealFactsOf } from '@/features/session-monitor/real-seal-facts'
import { captureFaultReasonOf, STREAM_PROFILE_DIFFERS, streamProfileNoticeOf, timelineWithoutRepeatedFaults, configuredProfileLinesOf } from '@/features/session-monitor/sim-adapter'
import { selectorProfileLinesOf } from '@/features/session-new/model'
import { manifestDigestSourceOf, manifestSuffixKey } from '@/features/dashboard/sim-adapter'
import { isGeneratedSource, restingSourceChecked, sourceDeviceText } from '@/features/devices/own-core-words'
import { registeredRoster, rosterStateNotChecked } from '@/features/devices/registered-devices-model'
import { sourceLineState } from '@/features/devices/source-state'
import { readDetailFacts } from '@/features/evidence/item-facts'
import { coreVerifyOutcomes, itemsWithoutVerifyRow } from '@/features/security-audit/core-verify-rows'
import { type TFunction } from 'i18next'
import { DEMO_NOW, FIND, mount, newSim, page, realCore, useRealCorePages } from '@/test/real-core-bed'

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
// | Session Monitor, Session Size | 47 MB (the simulator's formula) against 34 MB durable | the durable bytes of `captureCheckpoints`; none stated = a dash | "session size" |
// | Session Monitor timeline while connecting | "Recording Started" | not drawn until the Core says a fragment is durable | "timeline" |
//
// Every case has its CONTROL: the simulated lane keeps its demonstration figures.
describe("the Dashboard, the header checklist, Network & Time and the Monitor of a Core in its own capture (G75b-06, G75b-08)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 1_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

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
   * The platform column / row reads THAT member; the block "platform facts by name ..." below holds that it no longer follows the time slice.
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
    // V98-09 (batch N): the CONTRACT'S example (34 MB durable), at this test's instant.
    const checkpoints = { ...SESSION_CAPTURE_CHECKPOINTS_EXAMPLE, cameras: [...SESSION_CAPTURE_CHECKPOINTS_EXAMPLE.cameras], lastAt: DEMO_NOW }

    it('own capture with checkpoints: 34 MB (the checkpoint of the contract example), not the 47 MB of `bytesWritten`', async () => {
      mount('/session', 'recording', (sim) => setSession(sim, { captureDurable: true, bytesWritten: 47_000_000, captureCheckpoints: checkpoints }))
      const size = await screen.findByTestId('sm-session-size', {}, FIND)
      expect(size).toHaveTextContent('34 MB')
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
})

// Closing pass J of fix wave I (decisions D216, D217 (5), (7)) - the web console.
//
// | Item | Rule | Member read BY NAME |
// |---|---|---|
// | 1 G75b-06 at the source | TPM, Secure Boot and a "SECURE" posture read "Not reported" where the Core says so - and ONLY there: the interim rule that inferred it from `time.hostClock` is gone | `security.platformNotReported` (`SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE`) |
// | 2 G75b-03 | the restart fault of a Core in its own capture is worded "Core was not running", never "Power failure" | `coreNotRunning` (`CORE_NOT_RUNNING_FAULT_EXAMPLE`) |
// | 3 Storage page | the session size beside a session of the Core's own capture is the checkpoint's durable bytes | `session.captureCheckpoints.bytes` |
// | 4 header pill | a blocked seal is CRITICAL by the Core's alert, with no fault flag | `sealBlockedNoticeOf` (`SEAL_BLOCKED_EXAMPLE_ALERT`) |
// | 6 | the web's development-source sentence IS the shared one | `common.captureConnect.noPasswordNeeded` |
// | 7 | a start refused for the session key says its own sentence | `details.reason` (`START_REFUSED_SESSION_KEY_EXAMPLE`) |
describe("platform facts by name, the restart fault, the session size, a blocked seal on the header pill, one sentence for both clients", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 1_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  vi.setConfig({ testTimeout: 30_000 })

  const W = enWeb.web.ownCore
  const NR = en.common.platformNotReported
  const FIND = { timeout: 15_000 }
  const t = createI18n().t

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
  const originalGetContext = HTMLCanvasElement.prototype.getContext

  function newSim(scenario: ScenarioName = 'idle'): Sim {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: DEMO_NOW })
    const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario, storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    return sim
  }

  function mount(route: string, scenario: ScenarioName, prepare: (sim: Sim) => void = () => undefined): Sim {
    const sim = newSim(scenario)
    prepare(sim)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: [route] }) })
    render(<RouterProvider router={router} />)
    return sim
  }

  /** The Core's own statement, from the contract example - and nothing else of the state moves. */
  const platformNotReported = (sim: Sim) => sim.store.setState({ security: { ...sim.store.getState().security, ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE } })
  /** The time slice of a Core in its own capture, WITHOUT the platform statement (the interim rule's only mark). */
  const hostClockOnly = (sim: Sim) => sim.store.setState({ time: { ...HOST_CLOCK_TIME } })
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
    window.matchMedia = originalMatchMedia
  })
  beforeEach(() => {
    resetMissingI18nKeys()
    stubMatchMedia()
    window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
  })
  afterEach(() => {
    cleanup()
    for (const sim of sims.splice(0)) sim.stop()
    vi.unstubAllGlobals()
    window.sessionStorage.clear()
  })

  describe('1. the platform facts follow security.platformNotReported, by name', () => {
    it('the rule: the member alone decides - the time slice no longer does', () => {
      const sim = newSim()
      hostClockOnly(sim)
      expect(isOwnCaptureCore(sim.store.getState())).toBe(true)
      expect(isPlatformNotReportedCore(sim.store.getState())).toBe(false)
      platformNotReported(sim)
      expect(isPlatformNotReportedCore(sim.store.getState())).toBe(true)
      // The pill's rows, each from its own member.
      expect(ownCoreRow('platform', 'OK', { hostClock: true, platformNotReported: false })).toBeNull()
      expect(ownCoreRow('platform', 'OK', { hostClock: false, platformNotReported: true })).toBe('NOT_REPORTED')
      expect(ownCoreRow('timeSource', 'OK', { hostClock: false, platformNotReported: true })).toBeNull()
      expect(ownCoreRow('platform', 'CRITICAL', { hostClock: true, platformNotReported: true })).toBeNull()
    })

    it('Dashboard: the platform column, the posture column and the strip\'s Security cell read "Not reported" - with the simulated time left as it is', async () => {
      mount('/dashboard', 'idle', platformNotReported)
      const platform = await screen.findByTestId('stn-tpm', {}, FIND)
      expect(platform).toHaveTextContent(W.platform.chip)
      expect(platform).toHaveTextContent(W.platform.tpm)
      expect(platform).toHaveTextContent(W.platform.secureBoot)
      expect(platform).not.toHaveTextContent(/verified|enabled/i)
      expect(platform).toHaveAttribute('data-tone', 'default')
      const posture = screen.getByTestId('stn-posture')
      expect(posture).toHaveTextContent(W.platform.chip)
      expect(posture).toHaveTextContent(NR.posture)
      expect(posture).not.toHaveTextContent(en.common.posture.SECURE)
      expect(posture).not.toHaveTextContent(en.dashboard.securityTimeNetwork.posture.allControls)
      expect(posture).toHaveAttribute('data-tone', 'default')
      const cell = screen.getByTestId('strip-security')
      expect(cell).toHaveTextContent(NR.value)
      expect(cell).not.toHaveTextContent(en.dashboard.statusStrip.value.posture.SECURE)
      expect(cell).toHaveAttribute('data-tone', 'default')
      // The time is NOT inferred from the platform member either.
      expect(screen.getByTestId('stn-time')).toHaveTextContent(en.dashboard.securityTimeNetwork.time.chip.GNSS)
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('NEGATIVE CONTROL - a host clock WITHOUT the member: the platform column is what the slice says (no inference)', async () => {
      mount('/dashboard', 'idle', hostClockOnly)
      const platform = await screen.findByTestId('stn-tpm', {}, FIND)
      expect(platform).toHaveTextContent(en.dashboard.securityTimeNetwork.tpm.verified)
      expect(platform).not.toHaveTextContent(W.platform.chip)
      expect(screen.getByTestId('stn-posture')).toHaveTextContent(en.common.posture.SECURE)
      expect(screen.getByTestId('strip-security')).toHaveTextContent(en.dashboard.statusStrip.value.posture.SECURE)
    })

    it('a posture that names a fault keeps it (the fault is a fact of the state)', async () => {
      mount('/dashboard', 'idle', (sim) => {
        platformNotReported(sim)
        sim.actions.inject('TAMPER')
      })
      const posture = await screen.findByTestId('stn-posture', {}, FIND)
      expect(posture).toHaveTextContent(en.common.posture.ATTENTION)
      expect(screen.getByTestId('strip-security')).not.toHaveTextContent(NR.value)
    })

    it('Security & Audit: the posture reads "Not reported"; the TPM, Secure Boot and key custody rows say so - never "Active"', async () => {
      mount('/security-audit', 'idle', platformNotReported)
      const state = await screen.findByTestId('posture-state', {}, FIND)
      expect(state).toHaveTextContent(NR.value)
      expect(state).not.toHaveTextContent(en.common.posture.SECURE)
      const banner = screen.getByTestId('security-banner')
      expect(banner).toHaveTextContent(NR.posture)
      expect(banner).not.toHaveTextContent(en.securityAudit.banner.SECURE)
      for (const id of ['TPM', 'SECURE_BOOT', 'KEY_CUSTODY']) {
        const row = document.querySelector(`[data-control="${id}"]`) as HTMLElement
        expect(row, id).not.toBeNull()
        expect(row).toHaveAttribute('data-status', 'UNKNOWN')
        expect(row).toHaveTextContent(NR.note)
        expect(row).not.toHaveTextContent(/attestation ok|verified/i)
      }
      // A control the member does not cover is what it was.
      expect(document.querySelector('[data-control="HASH_CHAIN"]')).toHaveAttribute('data-status', 'OK')
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('the model: only a control that would read OK is replaced; the simulated device is unchanged', () => {
      const sim = newSim()
      const base = { time: sim.store.getState().time, chain: { ok: true, breakSeq: null }, softwareVersion: '1.0', signatureAlgorithm: 'Ed25519', ready: true }
      const simulated = buildControls({ ...base, security: sim.store.getState().security })
      expect(simulated.find((control) => control.id === 'TPM')).toMatchObject({ status: 'OK' })
      expect(simulated.some((control) => control.notReported)).toBe(false)
      platformNotReported(sim)
      const stated = buildControls({ ...base, security: sim.store.getState().security })
      // Fix wave K (C-2 / G75c-04, ruling D222 (1)): the pin moved by delta - beside the three platform controls, the four whose "Active"
      // is the device model's flag (encryption status, signing service with the DEMO key name, enclosure switch, firmware signature) read "Not reported" too.
      expect(stated.filter((control) => control.notReported).map((control) => control.id)).toEqual(['TPM', 'SECURE_BOOT', 'KEY_CUSTODY', 'ENCRYPTION', 'SIGNATURE', 'TAMPER', 'SIGNED_FIRMWARE'])
      expect(stated.find((control) => control.id === 'HASH_CHAIN')).toMatchObject({ status: 'OK' })
      expect(postureOf('SECURE', true, true, true)).toBe('UNKNOWN')
      expect(postureOf('SECURE', true, true, false)).toBe('SECURE')
      expect(postureOf('ATTENTION', true, true, true)).toBe('ATTENTION')
      expect(postureOf('SECURE', false, true, true)).toBe('CRITICAL')
    })
  })

  describe('2. the restart fault of a Core in its own capture is worded from coreNotRunning', () => {
    const faulted = (sim: Sim) => sim.store.setState(coreNotRunningFaultTransition(sim.store.getState(), sim.store.getState().clock.now))

    it('header pill: "Critical fault: Core was not running", never "Power failure"', () => {
      const sim = newSim('recording')
      faulted(sim)
      const state = sim.store.getState()
      expect(state.session?.fault).toMatchObject({ kind: 'POWER_FAIL', ...CORE_NOT_RUNNING_FAULT_EXAMPLE })
      expect(selectPillState(state)).toBe('CRITICAL')
      expect(selectPillCause(state)).toBe('CORE_NOT_RUNNING')
      const line = pillSubtitle(t, 'CRITICAL', selectPillCause(state))
      expect(line).toBe(`Critical fault: ${CORE_NOT_RUNNING_LABEL}`)
      expect(line).not.toMatch(/power/i)
    })

    it('CONTROL - the simulator\'s own power failure still reads "Critical fault: Power failure"', () => {
      const sim = newSim('recording')
      sim.actions.inject('POWER_FAIL')
      const state = sim.store.getState()
      expect(selectPillCause(state)).toBe('KIND:POWER_FAIL')
      expect(pillSubtitle(t, 'CRITICAL', selectPillCause(state))).toBe(`Critical fault: ${en.common.faultKind.POWER_FAIL}`)
    })

    it('Session Monitor banner and timeline: the label of the member, no "Power fail"', async () => {
      mount('/session', 'recording', faulted)
      const banner = await screen.findByTestId('sm-status-banner', {}, FIND)
      expect(banner).toHaveTextContent(CORE_NOT_RUNNING_LABEL)
      expect(banner).not.toHaveTextContent(/power\s*fail/i)
      const timeline = await screen.findByTestId('panel-Q', {}, FIND)
      expect(within(timeline).getAllByText(CORE_NOT_RUNNING_LABEL).length).toBeGreaterThan(0)
      expect(timeline).not.toHaveTextContent(/power\s*fail/i)
      expect(getMissingI18nKeys()).toEqual([])
    })
  })

  describe('3. Storage page: the session size of a session of the Core\'s own capture', () => {
    // V98-09 (batch N): the CONTRACT'S example with a figure of the size this card rounds to GB.
    const checkpoints = { ...SESSION_CAPTURE_CHECKPOINTS_EXAMPLE, cameras: [...SESSION_CAPTURE_CHECKPOINTS_EXAMPLE.cameras], bytes: 2_500_000_000, lastAt: DEMO_NOW }

    it('with checkpoints: the durable bytes (2.50 GB), not `bytesWritten` (7.00 GB)', async () => {
      mount('/storage', 'recording', (sim) => setSession(sim, { captureDurable: true, bytesWritten: 7_000_000_000, captureCheckpoints: checkpoints }))
      const card = await screen.findByTestId('storage-kpi-sessionSize', {}, FIND)
      expect(card).toHaveTextContent('2.50')
      expect(card).not.toHaveTextContent('7.00')
    })

    it('no checkpoint stated yet: a dash, never the formula figure', async () => {
      mount('/storage', 'recording', (sim) => setSession(sim, { captureDurable: true, bytesWritten: 7_000_000_000 }))
      const card = await screen.findByTestId('storage-kpi-sessionSize', {}, FIND)
      expect(within(card).getByTestId('storage-session-size-none')).toHaveTextContent('—')
      expect(card).not.toHaveTextContent('7.00')
      expect(getMissingI18nKeys()).toEqual([])
    })

    it("CONTROL - the simulator's own recording keeps `bytesWritten`", async () => {
      mount('/storage', 'recording', (sim) => setSession(sim, { bytesWritten: 7_000_000_000 }))
      expect(await screen.findByTestId('storage-kpi-sessionSize', {}, FIND)).toHaveTextContent('7.00')
    })
  })

  describe('4. a blocked seal turns the header pill critical through the alert, with no fault flag', () => {
    const blocked = (sim: Sim) => {
      const session = sim.store.getState().session!
      sim.store.setState({
        session: { ...session, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION, captureDurable: true } as typeof session,
        alerts: [SEAL_BLOCKED_EXAMPLE_ALERT],
        faults: { active: [] },
      })
    }

    it('CRITICAL, "Sealing is blocked", the recording row critical - and no fault is active', () => {
      const sim = newSim('finalizing')
      blocked(sim)
      const state = sim.store.getState()
      expect(state.faults.active).toEqual([])
      expect(selectPillState(state)).toBe('CRITICAL')
      expect(selectPillCause(state)).toBe('SEAL_BLOCKED')
      expect(pillSubtitle(t, 'CRITICAL', selectPillCause(state))).toBe(enWeb.web.sealBlocked.title)
      const checks = selectIntegrityChecks(state)
      expect(checks[INTEGRITY_CHECK_IDS.indexOf('recording')]).toBe('CRITICAL')
      // Stable for the store's shallow comparison.
      expect(selectIntegrityChecks(state)).toBe(checks)
    })

    it('NEGATIVE CONTROL - the same session without the alert, and with the alert resolved: not critical', () => {
      const sim = newSim('finalizing')
      blocked(sim)
      sim.store.setState({ alerts: [] })
      expect(selectPillState(sim.store.getState())).not.toBe('CRITICAL')
      expect(selectPillCause(sim.store.getState())).toBe('')
      sim.store.setState({ alerts: [{ ...SEAL_BLOCKED_EXAMPLE_ALERT, active: false, resolvedAt: DEMO_NOW }] })
      expect(selectPillState(sim.store.getState())).not.toBe('CRITICAL')
    })

    it('rendered: the pill carries the critical state and the sentence', async () => {
      mount('/dashboard', 'finalizing', blocked)
      const pill = await screen.findByTestId('secure-pill', {}, FIND)
      expect(pill).toHaveAttribute('data-state', 'CRITICAL')
      expect(pill).toHaveTextContent(enWeb.web.sealBlocked.title)
      expect(pill).not.toHaveTextContent(en.shell.securePill.CRITICAL.subtitle)
    })
  })

  describe('6 and 7. one sentence for both clients', () => {
    it('the web\'s development-source hint IS the shared `captureConnect.noPasswordNeeded` (ruled wording of contract_wave_i_a2.md section 1)', () => {
      expect(enWeb.web.connect.developmentHint).toBe(en.common.captureConnect.noPasswordNeeded)
      expect(en.common.captureConnect.noPasswordNeeded).toBe('A development source can be tested without a password. If the test asks for one, turn on "Enter a user name and password".')
      expect(en.common.captureConnect.noPasswordNeeded).not.toMatch(/needs no password/)
    })

    it('a start refused for the session key: the reason travels on the error and has a sentence; without this branch the presenter would say "starting"', () => {
      for (const reason of START_REFUSED_REASONS) {
        const error = new LiveTransportError('CORE_OFFLINE', { status: START_REFUSED_SESSION_KEY_EXAMPLE.status, code: START_REFUSED_SESSION_KEY_EXAMPLE.code, detailReason: reason })
        expect(startRefusedReasonOf(error)).toBe(reason)
        expect(t(startRefusedSentenceKey(reason))).toMatch(/^This session cannot be started: .*Nothing was recorded\./)
        expect(t(startRefusedSentenceKey(reason))).not.toContain(reason)
        expect(describeCoreError(error)).toEqual({ kind: CoreErrorNoticeKind.STARTING })
      }
      expect(START_REFUSED_SESSION_KEY_EXAMPLE.details.reason).toBe('SESSION_KEY_NOT_OF_SESSION')
      // NEGATIVE CONTROL: a Core that IS starting (no reason), and another reason, are not a refused start.
      expect(startRefusedReasonOf(new LiveTransportError('CORE_OFFLINE', { status: 503, code: 'NOT_READY' }))).toBeNull()
      expect(startRefusedReasonOf(new LiveTransportError('CORE_OFFLINE', { status: 503, code: 'NOT_READY', detailReason: 'CAPTURE_HELPERS_LEFT' }))).toBeNull()
      expect(startRefusedReasonOf(new Error('x'))).toBeNull()
    })
  })
})

// Fix wave K, driver W (apps/core-web) - the sweep of C-2 / G75c-04 (ruling D222 (1)) and the session
// surfaces of G75c-06, G75c-10, G89b-05, G89b-11.
//
// A Core in its OWN capture states `security.platformNotReported` (`SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE`)
// and `time.hostClock` (`HOST_CLOCK_TIME`). On such a Core the simulator's device model is not a
// reading: a surface shows the Core's own fact or "Not reported". THE SIMULATED LANE KEEPS ITS DEMO
// TEXT - every page below has a control case that pins it.
//
// | Finding | Rule | Case |
// |---|---|---|
// | C-2 MAJOR | Security & Audit: no "DEMO device key", no `DEMO-KEY-EVSIGN-01`, no "Resident in TPM 2.0, never exported", no "RTC holdover"; the signing key is the one the Core's sealed items name | "Security & Audit" |
// | G75c-04 | Devices: no "Attestation OK · sealing enabled", no "No fix · time from RTC", no "GNSS Receiver: NO FIX" in the banner | "Devices" |
// | G75c-04 | Dashboard: no "All systems secure", no "SECURE • HEALTHY • OPERATIONAL" | "Dashboard" |
// | G75c-04 | Storage: no write speed, no "Computed from free space at 8.2 GB per hour"; Monitor: no "Est. Remaining" figure | "Storage", "Monitor" |
// | G75c-04 | Network & Time: no "RTC UNLOCKED", no "Degraded", no "Derived for the demo" | "Network & Time" |
// | G75c-04 | header checklist: encryption and tamper rows read "Not reported" | "header checklist" |
// | G75c-04 | System: no device certificate of the dataset, "Time source: Host system clock" | "System" |
// | G89b-05 | the seal dialog of a REAL item names its key and its development marks; no "No DEMO package exists" | "seal dialog" |
// | G75c-10 | "Sealed —" is not said while the seal still runs | "interrupted" |
// | G75c-06 | the timeline row of a capture fault says the alert's reason; a repeated row is one row | "timeline" |
// | G89b-11 | the checkpoints block is not a check-row grid | "checkpoints" |
describe("every page of a Core in its own capture: Security & Audit, Devices, Dashboard, Storage, Monitor, Network & Time, System, the header (C-2, G75c-04, G75c-06, G75c-10, G89b-05, G89b-11)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 1_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  vi.setConfig({ testTimeout: 45_000 })

  const R = enWeb.web.realCore
  const NR = en.common.platformNotReported
  const FIND = { timeout: 15_000 }
  const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')
  const CORE_KEY = 'CORE-KEY-EVSIGN-01'

  /** The contract's product-sealed item (operation 40, example `productSealed`): signed with the Core key, a development key, development sources. */
  const GET_EVIDENCE_200 = (CORE_API_EXAMPLES.getEvidence ?? { responses: {} }).responses[200] as Record<string, { value: { evidence: Record<string, unknown> } }>
  const SEALED = GET_EVIDENCE_200['productSealed']!.value.evidence

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
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  const originalPlay = HTMLMediaElement.prototype.play
  const originalPause = HTMLMediaElement.prototype.pause

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

  /** One item of the state becomes the contract's product-sealed item (its members; the id stays the state's). */
  function sealedByThisCore(sim: Sim, index = 0): EvidenceItem {
    const evidence = sim.store.getState().evidence
    const item = { ...evidence[index]!, integritySource: SEALED.integritySource, signature: SEALED.signature, developmentSources: SEALED.developmentSources, manifestVersion: SEALED.manifestVersion } as unknown as EvidenceItem
    sim.store.setState({ evidence: evidence.map((entry, at) => (at === index ? item : entry)) })
    return item
  }

  /** A Core in its own capture: the two statements of the state (contract examples), and one item it sealed. */
  function realCore(sim: Sim): void {
    sim.store.setState({ security: { ...sim.store.getState().security, ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE }, time: { ...HOST_CLOCK_TIME } })
    sealedByThisCore(sim)
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

  const page = (testId: string) => screen.findByTestId(testId, {}, FIND)

  describe('the rule and the key the Core reports', () => {
    it('a Core in its own capture is told by its two statements; the simulated device by neither', () => {
      const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario: 'idle', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
      sims.push(sim)
      const state = sim.store.getState()
      expect(isSelfCaptureCore(state)).toBe(false)
      expect(isSelfCaptureCore({ ...state, security: { ...state.security, ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE } })).toBe(true)
      expect(isSelfCaptureCore({ ...state, time: { ...HOST_CLOCK_TIME } })).toBe(true)
    })
    it('the signing key is the one the newest sealed item names (contract example: CORE-KEY-EVSIGN-01, a development key); a simulated stand-in names none', () => {
      expect(reportedSigningKeyOf([{ ...SEALED, id: 'EV-1', sealedAt: 10 }])).toEqual({ keyId: CORE_KEY, algorithm: 'Ed25519', developmentKey: true, evidenceId: 'EV-1' })
      const older = { ...SEALED, id: 'EV-0', sealedAt: 5, signature: { ...(SEALED.signature as object), keyId: 'CORE-KEY-OLD' } }
      expect(reportedSigningKeyOf([older, { ...SEALED, id: 'EV-1', sealedAt: 10 }])?.keyId).toBe(CORE_KEY)
      const simulated = { id: 'EV-2', sealedAt: 99, signature: { keyId: 'DEMO-KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: true } }
      expect(reportedSigningKeyOf([simulated])).toBeNull()
      expect(reportedSigningKeyOf([simulated, { ...SEALED, id: 'EV-1', sealedAt: 10 }])?.keyId).toBe(CORE_KEY)
      expect(reportedSigningKeyOf([])).toBeNull()
    })
  })

  describe('C-2: Security & Audit of a Core in its own capture', () => {
    it('controls: every device-model control reads "Not reported"; the signature row names the Core key; the audit chain stays the page\'s own check', () => {
      const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario: 'idle', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
      sims.push(sim)
      const state = sim.store.getState()
      const chain = verifyChain(state.audit)
      const base = { time: { source: state.time.source, locked: state.time.locked }, chain: { ok: chain.ok, breakSeq: chain.breakSeq }, softwareVersion: '2.4.1', signatureAlgorithm: 'Ed25519', ready: true }
      const real = buildControls({ ...base, security: { ...state.security, ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE }, time: { source: HOST_CLOCK_TIME.source, locked: HOST_CLOCK_TIME.locked }, hostClock: true, signingKey: { keyId: CORE_KEY, algorithm: 'Ed25519', developmentKey: true } })
      const by = Object.fromEntries(real.map((control) => [control.id, control]))
      for (const id of ['TPM', 'SECURE_BOOT', 'KEY_CUSTODY', 'ENCRYPTION', 'SECURE_TIMESTAMP', 'TAMPER', 'SIGNED_FIRMWARE']) {
        expect(by[id], id).toMatchObject({ status: 'UNKNOWN', notReported: true })
      }
      // Fix wave L (G89c-05), pin moved by delta: a signing key the Core's items name is a STATED control, not "Not reported".
      expect(by.SIGNATURE).toMatchObject({ status: 'OK' })
      expect(by.SIGNATURE?.notReported).toBeUndefined()
      expect(by.SIGNATURE?.fact).toEqual({ kind: 'SIGNING_KEY', key: { keyId: CORE_KEY, algorithm: 'Ed25519', developmentKey: true } })
      expect(by.SECURE_TIMESTAMP?.fact).toEqual({ kind: 'HOST_CLOCK' })
      expect(by.HASH_CHAIN).toMatchObject({ status: 'OK' })
      expect(by.HASH_CHAIN?.notReported).toBeUndefined()
      // A control that shows a fault keeps it: an open enclosure is a fact of the state.
      const tampered = buildControls({ ...base, security: { ...state.security, ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE, tamper: true }, hostClock: true })
      expect(tampered.find((control) => control.id === 'TAMPER')).toMatchObject({ status: 'ATTENTION' })
      expect(tampered.find((control) => control.id === 'TAMPER')?.notReported).toBeUndefined()
      // CONTROL: the simulated device - nine controls as before, none "not reported".
      const simulated = buildControls({ ...base, security: state.security })
      expect(simulated.filter((control) => control.notReported === true)).toEqual([])
      expect(simulated.filter((control) => control.status === 'OK').length).toBeGreaterThanOrEqual(8)
    })

    it('keys: one key, the Core\'s; the certificate, the TLS certificate and the hardware root key are "not reported"', () => {
      const entries = ownCoreKeyEntries({ keyId: CORE_KEY, algorithm: 'Ed25519', developmentKey: true, evidenceId: 'EV-1' })
      expect(entries.map((entry) => [entry.id, entry.source])).toEqual([
        ['DEVICE_CERT', 'NOT_REPORTED'],
        ['EVIDENCE_SIGNING_KEY', 'CORE'],
        ['TLS_SERVER', 'NOT_REPORTED'],
        ['HARDWARE_ROOT', 'NOT_REPORTED'],
      ])
      expect(JSON.stringify(entries)).not.toMatch(/DEMO|TPM|fingerprint":"[0-9A-F]/)
      expect(ownCoreKeyEntries(null).every((entry) => entry.source === 'NOT_REPORTED')).toBe(true)
      // CONTROL: the simulated lane's entries are the DEMO packages' and the TPM-resident root key.
      const simulated = keyEntries([], 'TPM 2.0 (fw 7.2.3.1)')
      expect(simulated.find((entry) => entry.id === 'EVIDENCE_SIGNING_KEY')).toMatchObject({ keyId: 'DEMO-KEY-EVSIGN-01', source: 'DEMO_PACKAGE' })
      expect(simulated.find((entry) => entry.id === 'HARDWARE_ROOT')).toMatchObject({ source: 'HARDWARE', algorithm: 'TPM 2.0 (fw 7.2.3.1)' })
    })

    it('the page: no DEMO key name, no TPM residence, no RTC holdover, no attestation, no closed enclosure - the Core key and "Not reported" instead', async () => {
      mount('/security-audit', 'idle', realCore)
      const root = await page('page-security-audit')
      const keys = await within(root).findByTestId('panel-keys', {}, FIND)
      expect(keys).toHaveTextContent(`Ed25519 • ${CORE_KEY}`)
      expect(within(keys).getByTestId('key-development')).toHaveTextContent(R.keys.developmentChip)
      expect(within(keys).getByTestId('sa-keys-note')).toHaveTextContent(R.keys.note)
      for (const id of ['DEVICE_CERT', 'TLS_SERVER', 'HARDWARE_ROOT']) expect(within(keys).getByTestId(`key-not-reported-${id}`)).toHaveTextContent(NR.value)
      const controls = await within(root).findByTestId('panel-controls', {}, FIND)
      expect(controls.querySelector('[data-control="SIGNATURE"]')).toHaveTextContent(`Ed25519, Core key ${CORE_KEY}`)
      expect(controls.querySelector('[data-control="SIGNATURE"]')).toHaveTextContent(R.developmentKey)
      expect(controls.querySelector('[data-control="SECURE_TIMESTAMP"]')).toHaveTextContent(R.controls.hostClock)
      expect(controls.querySelector('[data-control="HASH_CHAIN"]')).toHaveAttribute('data-status', 'OK')
      expect(within(controls).getByTestId('sa-controls-summary')).toHaveTextContent('2 of 9 active · 7 not reported') // fix wave L (G89c-05), by delta: the stated signing key counts as active
      expect(await within(root).findByTestId('tamper-enclosure', {}, FIND)).toHaveTextContent(NR.value)
      for (const never of ['DEMO-KEY', 'DEMO device key', 'DEMO certificate', 'Resident in TPM', 'never exported', 'Hardware-bound', 'TPM 2.0 (fw', 'RTC holdover', 'Attestation OK', 'signature verified', 'CN=DEMS']) {
        expect(root, never).not.toHaveTextContent(never)
      }
      expect(within(root).getByTestId('tamper-enclosure')).not.toHaveTextContent(en.securityAudit.tamper.closed)
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('CONTROL - the simulated lane keeps its demo text', async () => {
      mount('/security-audit', 'idle')
      const root = await page('page-security-audit')
      const keys = await within(root).findByTestId('panel-keys', {}, FIND)
      expect(keys).toHaveTextContent('DEMO-KEY-EVSIGN-01')
      expect(keys).toHaveTextContent(en.securityAudit.keys.tpmResident)
      expect(keys).toHaveTextContent(en.securityAudit.keys.demoNote)
      const controls = await within(root).findByTestId('panel-controls', {}, FIND)
      expect(controls.querySelector('[data-control="SIGNATURE"]')).toHaveTextContent('Ed25519, DEMO device key')
      expect(controls.querySelector('[data-control="TPM"]')).toHaveTextContent('Attestation OK')
      expect(controls.querySelector('[data-control="TAMPER"]')).toHaveTextContent('Closed')
      expect(within(controls).getByTestId('sa-controls-summary')).toHaveTextContent('9 of 9 active')
      expect(await within(root).findByTestId('tamper-enclosure', {}, FIND)).toHaveTextContent(en.securityAudit.tamper.closed)
      expect(root).not.toHaveTextContent(NR.value)
    })
  })

  describe('G75c-04: Devices', () => {
    it('the banner counts no GNSS receiver on a host clock and no TPM nobody read; a failed TPM stays counted', () => {
      const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario: 'idle', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
      sims.push(sim)
      const state = sim.store.getState()
      expect(countedDevicesOf(state)).toBe(COUNTED_DEVICES)
      const real = { ...state, security: { ...state.security, ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE }, time: { ...HOST_CLOCK_TIME } }
      expect(countedDevicesOf(real)).toEqual(COUNTED_DEVICES.filter((id) => id !== 'GNSS' && id !== 'TPM'))
      expect(selectBanner(real)).toMatchObject({ kind: 'READY', issues: 0, worst: null })
      // Before the fix the same state counted "GNSS Receiver: NO FIX" for ever.
      expect(selectBanner({ ...state, time: { ...HOST_CLOCK_TIME, hostClock: undefined } as never }).worst).toBe('GNSS')
      const failed = { ...real, security: { ...real.security, tpm: { ...real.security.tpm, ok: false } } }
      expect(countedDevicesOf(failed)).toContain('TPM')
    })

    it('the page: the TPM row and the GNSS row say what this Core has - no attestation, no "time from RTC", no "NO FIX"', async () => {
      mount('/devices', 'idle', realCore)
      const root = await page('page-devices')
      const tpm = await within(root).findByTestId('other-TPM', {}, FIND)
      expect(tpm).toHaveAttribute('data-reported', 'false')
      expect(tpm).toHaveTextContent(NR.note)
      expect(within(tpm).getByTestId('other-status-TPM')).toHaveTextContent(NR.value)
      const gnss = within(root).getByTestId('other-GNSS')
      expect(gnss).toHaveTextContent(R.devices.gnssNotConfigured)
      expect(within(gnss).getByTestId('other-status-GNSS')).toHaveTextContent(enWeb.web.ownCore.time.notConfigured)
      for (const never of ['Attestation OK', 'sealing enabled', 'time from RTC', 'NO FIX', '· RTC', 'TPM OK']) expect(root, never).not.toHaveTextContent(never)
      expect(getMissingI18nKeys()).toEqual([])
    })

    // Fix wave J round three (JW-26): no surface of a Core in its own capture shows the model's version as the
    // real thing - the shell footer names the console and the Core, the front panel's LCD draws no number.
    // (Without a Live source operation 64 is not read: the Core's row is "Not reported", never "2.4.1".)
    it('JW-26: the shell footer names "Web console" and "Core server"; the LCD and the page draw no model version', async () => {
      mount('/devices', 'idle', realCore)
      const root = await page('page-devices')
      const footer = await screen.findByTestId('shell-footer-components', {}, FIND)
      expect(within(footer).getByTestId('shell-footer-version-webConsole')).toHaveTextContent(`Web console ${WEB_CONSOLE_VERSION}`)
      expect(within(footer).getByTestId('shell-footer-version-core')).toHaveTextContent(`Core server ${NR.value}`)
      expect(screen.queryByTestId('shell-footer-version')).toBeNull()
      expect(root.textContent).not.toContain(SOFTWARE_VERSION)
      expect(document.body.textContent).not.toContain(`v${SOFTWARE_VERSION}`)
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('CONTROL (JW-26) - the simulated lane keeps the model\'s "v2.4.1" in the shell footer', async () => {
      mount('/devices', 'idle')
      await page('page-devices')
      expect(await screen.findByTestId('shell-footer-version', {}, FIND)).toHaveTextContent(`v${SOFTWARE_VERSION}`)
      expect(screen.queryByTestId('shell-footer-components')).toBeNull()
    })

    it('CONTROL - the simulated lane keeps "Attestation OK · sealing enabled" and its locked GNSS receiver', async () => {
      mount('/devices', 'idle')
      const root = await page('page-devices')
      const tpm = await within(root).findByTestId('other-TPM', {}, FIND)
      expect(tpm).toHaveTextContent(en.devices.other.tpmOk)
      expect(within(root).getByTestId('other-GNSS')).toHaveTextContent(/Locked · \d+ satellites/)
      expect(tpm).not.toHaveAttribute('data-reported')
    })
  })

  describe('G75c-04: Dashboard', () => {
    it('no "All systems secure" and no "SECURE • HEALTHY • OPERATIONAL" beside a platform that is not reported', async () => {
      mount('/dashboard', 'idle', realCore)
      expect(await screen.findByTestId('stn-summary-text', {}, FIND)).toHaveTextContent(R.dashboard.securityHeader)
      const root = await page('page-dashboard')
      expect(root).not.toHaveTextContent(en.dashboard.securityTimeNetwork.allSecure)
      expect(root).not.toHaveTextContent(en.dashboard.systemRing.flags)
      expect(root).toHaveTextContent(R.dashboard.ringFlags)
      expect(getMissingI18nKeys()).toEqual([])
    })
    it('CONTROL - the simulated lane keeps both', async () => {
      mount('/dashboard', 'idle')
      expect(await screen.findByTestId('stn-summary-text', {}, FIND)).toHaveTextContent(en.dashboard.securityTimeNetwork.allSecure)
      expect(await page('page-dashboard')).toHaveTextContent(en.dashboard.systemRing.flags)
    })
  })

  describe('G75c-04: Storage and the Monitor', () => {
    it('Storage: no write speed and no estimate from 8.2 GB per hour; the banner states the free space only', async () => {
      mount('/storage', 'recording', realCore)
      const root = await page('page-storage')
      const speed = await within(root).findByTestId('storage-kpi-writeSpeed', {}, FIND)
      expect(within(speed).getByTestId('storage-write-speed-not-reported')).toHaveTextContent(NR.value)
      expect(speed).toHaveTextContent(R.storage.writeSpeed)
      expect(speed).not.toHaveTextContent(/MB\/s|GB\/h/)
      const remaining = within(root).getByTestId('storage-kpi-estRemaining')
      expect(within(remaining).getByTestId('storage-est-remaining-not-reported')).toHaveTextContent(NR.value)
      expect(remaining).toHaveTextContent(R.storage.estRemaining)
      expect(root).not.toHaveTextContent('8.2 GB')
      expect(within(root).getByTestId('storage-banner')).not.toHaveTextContent(/of recording left/)
      expect(getMissingI18nKeys()).toEqual([])
    })
    it('CONTROL - the simulated lane keeps its write speed and "Computed from free space at 8.2 GB per hour"', async () => {
      mount('/storage', 'recording')
      const root = await page('page-storage')
      const speed = await within(root).findByTestId('storage-kpi-writeSpeed', {}, FIND)
      expect(speed).toHaveTextContent('MB/s')
      expect(speed).toHaveTextContent('8.2 GB/h')
      expect(within(root).getByTestId('storage-kpi-estRemaining')).toHaveTextContent('Computed from free space at 8.2 GB per hour')
      expect(within(root).getByTestId('storage-banner')).toHaveTextContent(/of recording left/)
    })
    it('Monitor: "Est. Remaining" reads "Not reported"; the simulated lane keeps its hours', async () => {
      mount('/session', 'recording', realCore)
      expect(await screen.findByTestId('sm-est-remaining', {}, FIND)).toHaveTextContent(NR.value)
      cleanup()
      mount('/session', 'recording')
      const simulated = await screen.findByTestId('sm-est-remaining', {}, FIND)
      expect(simulated).toHaveTextContent(/\d+h \d+m/)
      expect(simulated).not.toHaveAttribute('data-reported')
    })
  })

  describe('G75c-04: Network & Time and System', () => {
    it('Network & Time: the A/V strip measures nothing on a host clock - no "RTC UNLOCKED", no "Degraded", no "Derived for the demo"', async () => {
      mount('/network-time', 'idle', realCore)
      const strip = await screen.findByTestId('network-time-av-sync', {}, FIND)
      expect(strip).toHaveAttribute('data-state', 'NOT_MEASURED')
      expect(strip).toHaveTextContent(enWeb.web.ownCore.time.notMeasured)
      expect(strip).toHaveTextContent(R.networkTime.avSync)
      for (const never of ['RTC', 'UNLOCKED', 'Degraded', 'Derived for the demo', 'Sample-synchronous']) expect(strip, never).not.toHaveTextContent(never)
    })
    it('CONTROL - the simulated lane keeps the demo strip', async () => {
      mount('/network-time', 'idle')
      const strip = await screen.findByTestId('network-time-av-sync', {}, FIND)
      expect(strip).toHaveTextContent(en.networkTime.systemTime.avSync.derived)
      expect(strip).toHaveTextContent(en.networkTime.systemTime.avSync.skewValue)
    })
    it('System: "Time source: Host system clock"; no device certificate and no camera model of the dataset', async () => {
      mount('/system', 'idle', realCore)
      const root = await page('page-system')
      expect(await within(root).findByTestId('system-about-deviceCertificateId', {}, FIND)).toHaveTextContent(NR.value)
      expect(within(root).getByTestId('system-about-cameraModelFirmware')).toHaveTextContent(NR.value)
      expect(root).not.toHaveTextContent('Dual-lens IP camera')
    })
    // Fix wave Q (CW-08 b; truth rule 3d): a Core without an updater offered the quick action "Software Update - Signed A/B
    // system update" above a card that says nothing can be installed.
    it('System: a Core that states it has no updater offers no "Software Update" quick action; the other three stay', async () => {
      mount('/system', 'idle', (sim) => {
        realCore(sim)
        sim.store.setState({ update: { ...sim.store.getState().update, ...UPDATER_NOT_AVAILABLE } })
      })
      const root = await page('page-system')
      expect(await within(root).findByTestId('system-quick-runDiagnostics', {}, FIND)).toBeInTheDocument()
      expect(within(root).getByTestId('system-quick-reviewAudit')).toBeInTheDocument()
      expect(within(root).getByTestId('system-quick-exportEvidence')).toBeInTheDocument()
      expect(within(root).queryByTestId('system-quick-softwareUpdate')).toBeNull()
      expect(root).not.toHaveTextContent(en.common.quickActions.softwareUpdate.subtitle)
    })
    it('CONTROL - a Core with an updater (the simulated lane) keeps the "Software Update" quick action', async () => {
      mount('/system', 'idle')
      const root = await page('page-system')
      expect(await within(root).findByTestId('system-quick-softwareUpdate', {}, FIND)).toHaveTextContent(en.common.quickActions.softwareUpdate.title)
    })
    // Row 104c2 (finding RT-1, ruling D81): operation 66 is refused on a Core in its own capture - the console offers no
    // press and states no service count; the reason is the action's visible hint.
    const asTechnician = (sim: Sim) => {
      sim.actions.signOut()
      sim.actions.signIn('rina.wijaya', 'demo-2026')
    }
    it('System: a Core in its own capture offers "Restart services" disabled with its reason, also to a MAINTENANCE holder', async () => {
      const sim = mount('/system', 'idle', (s) => {
        realCore(s)
        asTechnician(s)
      })
      const root = await page('page-system')
      const marker = await within(root).findByTestId('system-restart-not-available', {}, FIND)
      expect(within(marker).getByTestId('system-restart-services')).toBeDisabled()
      expect(root).toHaveTextContent(en.system.maintenance.restartNotAvailable)
      expect(root).not.toHaveTextContent(en.system.maintenance.restartHint)
      expect(sim.store.getState().audit.rows.some((row) => row.type === 'DEVICE_COMMAND' && row.message.includes('Core services restarted'))).toBe(false)
    })
    it('CONTROL - the simulated lane keeps "Restart services" enabled for a MAINTENANCE holder, with its hint', async () => {
      mount('/system', 'idle', asTechnician)
      const root = await page('page-system')
      expect(await within(root).findByTestId('system-restart-services', {}, FIND)).toBeEnabled()
      expect(within(root).queryByTestId('system-restart-not-available')).toBeNull()
      expect(root).toHaveTextContent(en.system.maintenance.restartHint)
    })
  })

  describe('G75c-04: the header checklist', () => {
    it('encryption and tamper rows read "Not reported" where the Core says so; a row that shows a fault keeps it; the simulated device keeps "OK"', () => {
      const core = { hostClock: true, platformNotReported: true }
      expect(ownCoreRow('encryption', 'OK', core)).toBe('NOT_REPORTED')
      expect(ownCoreRow('tamper', 'OK', core)).toBe('NOT_REPORTED')
      expect(ownCoreRow('tamper', 'WARN' as never, core)).toBeNull()
      expect(ownCoreRow('hashChain', 'OK', core)).toBeNull()
      expect(ownCoreRow('storage', 'OK', core)).toBeNull()
      expect(ownCoreRow('encryption', 'OK', { hostClock: false, platformNotReported: false })).toBeNull()
      expect(ownCoreRow('tamper', 'OK', { hostClock: true, platformNotReported: false })).toBeNull()
    })
  })

  describe('G89b-05: the "Evidence sealed" dialog of a REAL item', () => {
    it('the rule: REAL and not the simulated stand-in - else the DEMO / simulated block stays', () => {
      expect(realSealFactsOf({ ...SEALED, manifestHash: 'ab'.repeat(32) })).toEqual({ manifestHash: 'ab'.repeat(32), algorithm: 'Ed25519', keyId: CORE_KEY, developmentKey: true, developmentSources: true })
      expect(realSealFactsOf({ ...SEALED, integritySource: 'DEMO_PACKAGE' })).toBeNull()
      expect(realSealFactsOf({ ...SEALED, signature: { ...(SEALED.signature as object), simulated: true } })).toBeNull()
      expect(realSealFactsOf(null)).toBeNull()
    })

    it('names the Core key, the development key and the development sources; never "No DEMO package exists for this item."', async () => {
      // Fix wave Q (CW-04): mounted as what it is - a Core in its own capture (it was mounted without the Core's two statements).
      const sim = mount('/session', 'finalizing', realCore)
      await screen.findByTestId('finalization-modal', {}, FIND)
      // The Core seals the session: the item it names is one it signed for real.
      act(() => {
        const item = sealedByThisCore(sim)
        const session = sim.store.getState().session!
        sim.store.setState({ session: { ...session, state: 'SEALED', evidenceId: item.id, sealedAt: DEMO_NOW } as typeof session })
      })
      const block = await screen.findByTestId('sm-final-package', {}, FIND)
      expect(block).toHaveAttribute('data-kind', 'real')
      expect(within(block).getByTestId('sm-final-real-key')).toHaveTextContent(`Ed25519, Core key ${CORE_KEY}`)
      expect(within(block).getByTestId('sm-final-development-key')).toHaveTextContent(en.evidence.itemFacts.signature.developmentKey)
      expect(within(block).getByTestId('sm-final-development-sources')).toHaveTextContent(enWeb.web.sealDialog.developmentSources)
      expect(block).not.toHaveTextContent(en.session.finalization.noPackage)
      expect(block).not.toHaveTextContent('DEMO')
      // Fix wave Q (CW-04), the control of the demonstration dialog (`live-session-monitor-actions.test.tsx`, "B-2 stop"):
      // a Core in its own capture draws no DEMO mark, no "this seal is simulated" and no "LIVE" chip in this dialog.
      const dialog = screen.getByTestId('finalization-modal')
      expect(within(dialog).queryByTestId('demo-mark-seal-dialog')).toBeNull()
      expect(within(dialog).queryByTestId('sm-final-demonstration')).toBeNull()
      expect(within(dialog).queryByTestId('sm-final-source-chip')).toBeNull()
      expect(dialog.textContent ?? '').not.toMatch(/\bLIVE\b/)
      expect(getMissingI18nKeys()).toEqual([])
    })
  })

  describe('G75c-10: an interrupted recording while its seal still runs', () => {
    it('the dialog does not say "Sealed —" at 0%: it says the recording was interrupted and that the Core is sealing it; "Sealed — recording was interrupted" comes with the seal', async () => {
      const sim = mount('/session', 'finalizing', (prepared) => {
        const session = prepared.store.getState().session!
        prepared.store.setState({ session: { ...session, fault: { kind: 'CAPTURE_FAULT', at: DEMO_NOW, fromState: 'RECORDING' } } as typeof session })
      })
      const modal = await screen.findByTestId('finalization-modal', {}, FIND)
      const notice = await within(modal).findByTestId('sm-interrupted-seal', {}, FIND)
      expect(notice).toHaveAttribute('data-sealed', 'false')
      expect(notice).toHaveTextContent(enWeb.web.interrupted.sealingTitle)
      expect(notice).toHaveTextContent(enWeb.web.interrupted.sealingKept)
      expect(modal).not.toHaveTextContent(en.common.interruptedSeal.title)
      expect(modal).not.toHaveTextContent('Sealed —')
      act(() => {
        const session = sim.store.getState().session!
        sim.store.setState({ session: { ...session, state: 'SEALED', sealedAt: DEMO_NOW } as typeof session })
      })
      const sealed = await within(modal).findByTestId('sm-interrupted-seal', {}, FIND)
      expect(sealed).toHaveAttribute('data-sealed', 'true')
      expect(sealed).toHaveTextContent(en.common.interruptedSeal.title)
      expect(getMissingI18nKeys()).toEqual([])
    })
  })

  describe('G75c-06: the timeline row of a capture fault', () => {
    const row = (extra: Record<string, unknown> = {}) => ({ kind: 'FAULT', at: 1_000, params: { kind: 'CAPTURE_FAULT', ...extra } })
    const alert = (reason: string, at = 1_200) => ({ kind: 'CAPTURE_FAULT', at, params: { reason } })
    it('a row without a reason takes the reason of the alert raised at the same moment; its own reason wins; an alert far away is not it', () => {
      expect(captureFaultReasonOf(row(), [alert('DEMO_CAPTURE_FAULT')])).toBe('DEMO_CAPTURE_FAULT')
      expect(captureFaultReasonOf(row({ reason: 'WORKER_KILLED' }), [alert('DEMO_CAPTURE_FAULT')])).toBe('WORKER_KILLED')
      expect(captureFaultReasonOf(row(), [alert('WORKER_KILLED', 9_000)])).toBeNull()
      expect(captureFaultReasonOf(row(), [{ kind: 'POWER_FAIL', at: 1_000, params: { reason: 'X' } }])).toBeNull()
      expect(captureFaultReasonOf(row(), [alert('WORKER_KILLED', 2_900), alert('DEMO_CAPTURE_FAULT', 1_100)])).toBe('DEMO_CAPTURE_FAULT')
    })
    it('a fault listed twice at one instant is one row; two different faults, or two instants, stay two', () => {
      const start = { kind: 'START', at: 500 }
      expect(timelineWithoutRepeatedFaults([start, row(), row()])).toEqual([start, row()])
      const two = [row(), { ...row(), at: 2_000 }]
      expect(timelineWithoutRepeatedFaults(two)).toBe(two)
      const kinds = [row(), { kind: 'FAULT', at: 1_000, params: { kind: 'POWER_FAIL' } }]
      expect(timelineWithoutRepeatedFaults(kinds)).toBe(kinds)
    })
  })

  describe('ruling D222 (2): the profile label of a session whose recorded stream is not the configured profile', () => {
    // The Core's notice as `apps/core-server/src/engine/sealing-notice-doors.ts` writes it (`contract_wave_k.md` S1 section 3).
    const notice = (sessionId: string) => ({
      id: 'ALR-000099',
      at: DEMO_NOW,
      severity: 'WARNING',
      kind: 'SYSTEM',
      message: 'The recorded video is not the configured profile: VIDEO-01 is H264_720P30 (configured H264_1080P25). The evidence manifest states the recorded stream.',
      active: false,
      acknowledged: false,
      resolvedAt: null,
      target: sessionId,
      params: { reason: STREAM_PROFILE_DIFFERS, sessionId, tracks: 'VIDEO-01:H264_720P30:H264_1080P25' },
    })
    it('the reader: the notice of THIS session, by `params.reason`', () => {
      expect(streamProfileNoticeOf([notice('SES-1')], 'SES-1')).toContain('VIDEO-01 is H264_720P30')
      expect(streamProfileNoticeOf([notice('SES-2')], 'SES-1')).toBeNull()
      expect(streamProfileNoticeOf([{ ...notice('SES-1'), params: { reason: 'SEAL_BLOCKED' } }], 'SES-1')).toBeNull()
      expect(streamProfileNoticeOf([notice('SES-1')], null)).toBeNull()
    })
    it('the Monitor says "Configured profile" and the Core\'s sentence; without the notice the label is "Profile" as before', async () => {
      mount('/session', 'recording', (sim) => {
        const state = sim.store.getState()
        sim.store.setState({ alerts: [...state.alerts, notice(state.session!.id) as never] })
      })
      const details = await screen.findByTestId('sm-details', {}, FIND)
      expect(details.querySelector('[data-row="profile"]') ?? details).toHaveTextContent(enWeb.web.profile.configuredLabel)
      expect(await screen.findByTestId('sm-details-stream-profile', {}, FIND)).toHaveTextContent('VIDEO-01 is H264_720P30 (configured H264_1080P25)')
      cleanup()
      mount('/session', 'recording')
      const plain = await screen.findByTestId('sm-details', {}, FIND)
      expect(plain).toHaveTextContent(en.session.details.profile)
      expect(plain).not.toHaveTextContent(enWeb.web.profile.configuredLabel)
      expect(screen.queryByTestId('sm-details-stream-profile')).toBeNull()
    })
  })

  describe('G89b-11: the capture checkpoints of the Monitor integrity card', () => {
    const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
    it('the block has its own one-column layout - never the icon grid of a check row, whose 18 px first column drew the label over the lines beside it', () => {
      const component = read('../features/session-monitor/capture-checkpoints.tsx')
      expect(component).toContain('className="sm-checkpoints"')
      expect(component).not.toMatch(/className="sm-check" data-testid="sm-capture-checkpoints"/)
      const css = read('../features/session-monitor/session-monitor.css')
      const rule = /\.sm-checkpoints \{([^}]*)\}/.exec(css)?.[1] ?? ''
      expect(rule).toContain('grid-template-columns: minmax(0, 1fr)')
      expect(rule).toContain('flex: none')
      expect(css).toContain('.sm-integrity-body:has(.sm-checkpoints) { overflow-y: auto; }')
    })
  })
})

// Fix wave L, driver L-W (apps/core-web) - the findings of the four re-checks
// (`gateway_check/09c`, `10d`, `12c`, `13c`; rulings D227 .. D229 and the row after).
//
// THE ONE RULE of a Core in its own capture: a screen states the Core's own fact, "Not reported", or
// nothing - never a constant of the simulator, of a bundled demonstration index or of an adapter
// default; a block that still shows model values carries the "Synthetic demo values" chip.
// THE SIMULATED LANE IS UNCHANGED: every rendered case below has a control that pins it.
// Member names are those of `delegation_progress/contract_wave_l.md`; the examples are imported.
//
// | Finding | Rule | Case |
// |---|---|---|
// | G89c-01 | a real sealed item (`sealedPackage: PRESENT`) is not "NO MEDIA PACKAGE" | "G89c-01" |
// | G89c-02 | the tamper panel reads the Core's own verify rows, not the bundled index | "G89c-02" |
// | G89c-03 | the Monitor's integrity card never falls back to the simulator's rows | "G89c-03" |
// | G75d-05 | the configured profile is the selector line's, per track | "G75d-05" |
// | G89c-04 | the item states the signed manifest's profile and the Core's stream notice | "G89c-04" |
// | G75d-06 | a generated source is named as generated | "G75d-06" |
// | G70c-02 | "Online" / "Ready" / "Reachable" only for a checked fact | "G70c-02" |
// | G70c-08 | an unassigned built-in camera has its card | "G70c-08" |
// | G75d-07 | the chip on every model block; one count for the other devices | "G75d-07" |
// | DF-21 (audit row 104) | a block without a producer reads "Not reported", never synthetic values | "G75d-07 / DF-21" |
// | G89c-05 | a stated signing key is not "Not reported" | "G89c-05" |
// | G75d-01 / -03 | the open notice on pill and bell, its acknowledgement; no alert of another session as a FAULT | "G75d-01" |
// | G75d-02 | the retry of a blocked seal for the role operation 33 allows | "G75d-02" |
// | G75d-04 | one terminal sentence at the unsealable end | "G75d-04" |
// Fix wave M (driver M-W; final re-checks 75 and 89) added its cases to the describes of the same components:
// | G75e-04 | the ring states the open notice also while a session records | in "G75d-01 / G75d-03" |
// | G75e-06 | pill and ring while a seal is retried (the single cause of the blocked dialog: `features/session-monitor/__tests__/sealing-progress.test.tsx`) | in "G75d-01 / G75d-03" |
// | G89d-02 | the items of the Core without a verify run, in one sentence | in "G89c-02" |
// | G89d-06 | the closing sentence of a sealed session's integrity card | in "G89c-03" |
// The cases "G75d-01 / G75d-03", "G75d-02" and "G75d-04" (with G75e-04 and G75e-06) are beside the Monitor's
// tests since the suite consolidation: `features/session-monitor/__tests__/unsealable-notice.test.tsx`.
describe("the Core's own fact, \"Not reported\", or nothing: hashes, verify rows, the integrity card, profiles, generated sources, checked states, the demo-values chip, the signing key (G89c-01 .. G89c-05, G75d-05 .. G75d-07, G70c-02, G70c-08)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 1_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  vi.setConfig({ testTimeout: 45_000 })

  const L = enWeb.web.waveL
  const M = enWeb.web.waveM
  /** The two words `sourceDeviceText` asks for: a stand-in translator that answers the web resource. */
  const t = ((key: string) => (key === 'web.waveL.source.generatedCamera' ? enWeb.web.waveL.source.generatedCamera : key)) as unknown as TFunction

  const GET_EVIDENCE_200 = (CORE_API_EXAMPLES.getEvidence ?? { responses: {} }).responses[200] as Record<string, { value: Record<string, unknown> & { evidence: Record<string, unknown> } }>
  const SEALED_BODY = GET_EVIDENCE_200['productSealed']!.value
  const SEALED = SEALED_BODY.evidence

  useRealCorePages()

  describe('G89c-01: the Dashboard hash of a real sealed item', () => {
    it('the contract\'s product-sealed item (`sealedPackage: PRESENT`) is a package: no suffix in either mode', () => {
      expect(SEALED['sealedPackage']).toBe('PRESENT')
      expect(SEALED['integritySource']).toBe('REAL')
      expect(manifestDigestSourceOf(SEALED)).toBe('package')
      expect(manifestSuffixKey(manifestDigestSourceOf(SEALED), CoreMode.LIVE)).toBeNull()
      expect(manifestSuffixKey(manifestDigestSourceOf(SEALED), CoreMode.SIMULATED)).toBeNull()
    })
    it('a package the Core cannot read says so; an item with no package member keeps "NO MEDIA PACKAGE" in Live mode (control)', () => {
      expect(manifestDigestSourceOf({ ...SEALED, sealedPackage: 'NOT_READABLE' })).toBe('unreadable')
      expect(manifestSuffixKey('unreadable', CoreMode.LIVE)).toBe('web.dashboard.packageNotReadable')
      expect(manifestDigestSourceOf({ integritySource: 'REAL' })).toBe('simulated')
      expect(manifestSuffixKey('simulated', CoreMode.LIVE)).toBe('dashboard.activeSession.sealed.noPackage')
      expect(manifestDigestSourceOf({ integritySource: 'DEMO_PACKAGE' })).toBe('package')
      expect(manifestSuffixKey('simulated', CoreMode.SIMULATED)).toBe('common.simulated.chip')
    })
  })

  describe('G89c-02: Security & Audit, Tamper & Integrity on a Core in its own capture', () => {
    const rows = [
      { at: 10, type: 'EVIDENCE_VERIFIED', evidenceId: 'EV-20261009-0005', details: { failedTracks: '' } },
      { at: 20, type: 'EVIDENCE_VERIFY_FAILED', evidenceId: 'EV-20261009-0005', details: { failedTracks: 'VIDEO-02', failedFragments: 'VIDEO-02:3', failedFragmentCount: 1 } },
      { at: 30, type: 'EVIDENCE_VERIFIED', evidenceId: 'EV-20261011-0032', details: {} },
      { at: 40, type: 'EVIDENCE_VERIFY_FAILED', evidenceId: 'EV-20261011-0030', details: { failedTracks: 'VIDEO-01' } },
      { at: 50, type: 'EVIDENCE_VERIFIED', evidenceId: 'EV-20261011-0030', details: {} },
      { at: 60, type: 'AUTH_SUCCESS', evidenceId: null, details: {} },
    ]
    it('the reader keeps the NEWEST verify row of each item and the place the Core named', () => {
      expect(coreVerifyOutcomes(rows)).toEqual({ pass: 2, fail: 1, failures: [{ evidenceId: 'EV-20261009-0005', places: [{ trackId: 'VIDEO-02', seq: 3 }] }] })
      expect(coreVerifyOutcomes([])).toEqual({ pass: 0, fail: 0, failures: [] })
    })
    it('the panel prints no count and no track of the bundled index; with no verify row it says "Not reported"', async () => {
      mount('/security-audit', 'idle', realCore)
      const tile = await page('tamper-packages')
      expect(tile).toHaveAttribute('data-source', 'core-verify-rows')
      expect(tile).toHaveTextContent(L.tamper.verifyLabel)
      const panel = screen.getByTestId('panel-tamper')
      expect(panel).not.toHaveTextContent('DEMO - precomputed')
      expect(panel).not.toHaveTextContent('hash mismatch')
      expect(panel).not.toHaveTextContent(en.securityAudit.tamper.packages)
      expect(getMissingI18nKeys()).toEqual([])
    })
    it('CONTROL - the simulated lane keeps its labelled demonstration', async () => {
      mount('/security-audit', 'idle')
      const tile = await page('tamper-packages')
      expect(tile).not.toHaveAttribute('data-source')
      expect(tile).toHaveTextContent(en.securityAudit.tamper.packages)
      expect(screen.getByTestId('panel-tamper')).toHaveTextContent('DEMO - precomputed')
      // Wave M (G89d-02): the sentence of the Core's own items is not drawn on the simulated lane.
      expect(screen.queryByTestId('tamper-not-verified')).toBeNull()
    })
    // Fix wave M (G89d-02): "27 PASS • 1 FAIL" counts verify RUNS; 12 of the lane's 40 items had none and nothing said so.
    it('G89d-02: the items of the Core that no verify row names are counted - from the Core\'s own item list', () => {
      const ids = ['EV-20261009-0005', 'EV-20261011-0030', 'EV-20261011-0032', 'EV-20261011-0040', 'EV-20261011-0041', 'EV-20261011-0041']
      expect(itemsWithoutVerifyRow(rows, ids)).toEqual({ total: 5, notVerified: 2 })
      expect(itemsWithoutVerifyRow([], ids)).toEqual({ total: 5, notVerified: 5 })
      expect(itemsWithoutVerifyRow(rows, [])).toEqual({ total: 0, notVerified: 0 })
    })
    it('G89d-02: the panel says in one sentence how many of the Core\'s items have no verify run', async () => {
      const sim = mount('/security-audit', 'idle', realCore)
      const total = new Set(sim.store.getState().evidence.map((item) => item.id)).size
      expect(total).toBeGreaterThan(1)
      const line = await page('tamper-not-verified')
      // The idle Core holds no verify row: every item is unverified, and the sentence says so with the Core's own count.
      expect(line).toHaveAttribute('data-total', String(total))
      expect(line).toHaveAttribute('data-not-verified', String(total))
      expect(line).toHaveTextContent(`${total} of the ${total} items of this Core have no verify run in these rows.`)
      expect(getMissingI18nKeys()).toEqual([])
    })
  })

  describe('G89c-03: the Monitor\'s integrity card of a sealed real session', () => {
    it('a Core in its own capture whose session carries no capture member shows its own rows - never "Encryption Active", "Secure Timestamp Synced", "Storage Write Verified"', async () => {
      mount('/session', 'finalizing', (sim) => {
        realCore(sim)
        const session = sim.store.getState().session!
        const { captureDurable: _dropped, ...rest } = session as typeof session & { captureDurable?: boolean }
        sim.store.setState({ session: { ...rest, state: 'SEALED', evidenceId: 'EV-20261011-0032' } as typeof session })
      })
      const checks = await page('sm-integrity-checks')
      expect(checks).toHaveAttribute('data-own-core', 'true')
      const card = screen.getByTestId('panel-N')
      for (const demo of [en.session.integrity.encryption.label, en.session.integrity.timestamp.label, en.session.integrity.storageWrite.label, 'RTC', 'AES-256']) expect(card).not.toHaveTextContent(demo)
      expect(card).toHaveTextContent(L.integrity.sealedDetail.replace('{{evidenceId}}', 'EV-20261011-0032'))
      expect(card).toHaveTextContent(en.session.integrityFacts.auditChain.label)
      expect(card).toHaveTextContent('Core system clock')
    })
    it('CONTROL - the simulated lane keeps the four demonstration checks', async () => {
      mount('/session', 'finalizing')
      const checks = await page('sm-integrity-checks')
      expect(checks).not.toHaveAttribute('data-own-core')
      expect(screen.getByTestId('panel-N')).toHaveTextContent(en.session.integrity.encryption.label)
    })
    // Fix wave M (G89d-06): the card of an already SEALED session closed with "... once the session is sealed."
    it('G89d-06: the closing sentence of a sealed session names its evidence item with a link - no "once the session is sealed"', async () => {
      mount('/session', 'finalizing', (sim) => {
        realCore(sim)
        const session = sim.store.getState().session!
        sim.store.setState({ session: { ...session, state: 'SEALED', evidenceId: 'EV-20261011-0043', captureDurable: true } as typeof session })
      })
      const note = await page('sm-integrity-facts-note')
      expect(note).toHaveAttribute('data-sealed', 'true')
      expect(note).toHaveTextContent(`${M.integrity.sealedNote} EV-20261011-0043`)
      expect(note).not.toHaveTextContent('once the session is sealed')
      expect(within(note).getByTestId('sm-integrity-facts-item')).toHaveAttribute('href', '/evidence/EV-20261011-0043')
      expect(getMissingI18nKeys()).toEqual([])
    })
    it('G89d-06, control: while the session is not sealed the sentence stays in the future', async () => {
      mount('/session', 'recording', (sim) => {
        realCore(sim)
        const session = sim.store.getState().session!
        sim.store.setState({ session: { ...session, captureDurable: true } as typeof session })
      })
      const note = await page('sm-integrity-facts-note')
      expect(note).not.toHaveAttribute('data-sealed')
      expect(note).toHaveTextContent(en.session.integrityFacts.note)
      expect(within(note).queryByTestId('sm-integrity-facts-item')).toBeNull()
    })
  })

  describe('G75d-05: the configured profile of a session', () => {
    const selector = { cameras: [{ trackId: 'VIDEO-02', profile: 'H264_720P30' }, { trackId: 'VIDEO-01', profile: 'H264_720P30' }] }
    it('is the selector line\'s, per track: the session\'s snapshot first, else the selector in force', () => {
      expect(configuredProfileLinesOf({ session: null, captureConfig: selector })).toBe('VIDEO-01: H264_720P30 · VIDEO-02: H264_720P30')
      expect(configuredProfileLinesOf({ session: { captureConfig: { cameras: [{ trackId: 'VIDEO-01', profile: 'H264_1080P25' }] } }, captureConfig: selector })).toBe('VIDEO-01: H264_1080P25')
      expect(configuredProfileLinesOf({ session: null, captureConfig: { cameras: [{ trackId: 'VIDEO-01', profile: '' }] } })).toBe('')
    })
    it('the Monitor of a Core in its own capture says "Configured profile" with the selector\'s codes, never "Standard (1080p / 25 fps)"', async () => {
      mount('/session', 'finalizing', (sim) => {
        realCore(sim)
        const state = sim.store.getState()
        const captureConfig = { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => ({ ...line, profile: 'H264_720P30' })) }
        // The selector in force and the snapshot the session took at its start say the same here.
        sim.store.setState({ captureConfig, session: { ...state.session!, captureConfig: { cameras: captureConfig.cameras, mics: captureConfig.mics, revision: 2, updatedAt: DEMO_NOW } } as typeof state.session })
      })
      const details = await page('sm-details')
      const row = details.querySelector('[data-row=profile]')!
      expect(row).toHaveTextContent(L.profile.configuredLabel)
      expect(row).toHaveTextContent('VIDEO-01: H264_720P30 · VIDEO-02: H264_720P30')
      expect(details).not.toHaveTextContent('1080p / 25 fps')
    })
    // Fix wave Q (CT-08, the web's side): the New Session form said "Recording Profile - Standard (1080p / 25 fps)" - the label
    // of the form's `profileId` - on a Core whose selector lines say H264_720P30.
    it('the New Session form: the rule is the selector lines IN FORCE - the open session\'s snapshot, else the stored selector; a sealed session\'s snapshot names nothing', () => {
      const other = { cameras: [{ trackId: 'VIDEO-01', profile: 'H264_1080P25' }] }
      expect(selectorProfileLinesOf({ session: null, captureConfig: selector })).toBe('VIDEO-01: H264_720P30 · VIDEO-02: H264_720P30')
      expect(selectorProfileLinesOf({ session: { state: 'PRECHECK', captureConfig: other }, captureConfig: selector } as never)).toBe('VIDEO-01: H264_1080P25')
      expect(selectorProfileLinesOf({ session: { state: 'SEALED', captureConfig: other }, captureConfig: selector } as never)).toBe('VIDEO-01: H264_720P30 · VIDEO-02: H264_720P30')
      expect(selectorProfileLinesOf({ session: null, captureConfig: { cameras: [{ trackId: 'VIDEO-01', profile: '' }] } })).toBe('')
    })
    it('the New Session form of a Core in its own capture states the selector\'s profile per track and offers no choice; never "1080p / 25 fps"', async () => {
      mount('/session/new', 'idle', (sim) => {
        realCore(sim)
        const state = sim.store.getState()
        sim.store.setState({ captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => ({ ...line, profile: 'H264_720P30' })) } })
      })
      const field = await page('sn-profile')
      expect(field).toHaveAttribute('data-source', 'selector')
      expect(field).toHaveTextContent(L.profile.configuredLabel)
      // One whole token per track (a line never breaks inside "VIDEO-02: H264_720P30").
      const lines = (root: HTMLElement) => Array.from(root.querySelectorAll('.sn-profile-line')).map((line) => line.textContent)
      // D60 (2026-11-04): the seeded selector carries four video lines — one profile token per track.
      expect(lines(within(field).getByTestId('sn-profile-lines'))).toEqual(['VIDEO-01: H264_720P30', 'VIDEO-02: H264_720P30', 'VIDEO-03: H264_720P30', 'VIDEO-04: H264_720P30'])
      expect(field.querySelector('button, select, [role=combobox]')).toBeNull()
      expect(lines(screen.getByTestId('sn-preview-profile'))).toEqual(['VIDEO-01: H264_720P30', 'VIDEO-02: H264_720P30', 'VIDEO-03: H264_720P30', 'VIDEO-04: H264_720P30']) // D60
      expect(screen.getByTestId('sn-step-info')).not.toHaveTextContent('1080p / 25 fps')
      expect(getMissingI18nKeys()).toEqual([])
    })
    it('CONTROL - the simulated lane keeps the form\'s "Recording Profile" choice and its label', async () => {
      mount('/session/new', 'idle')
      const field = await page('sn-profile')
      expect(field).not.toHaveAttribute('data-source')
      expect(field).toHaveTextContent(en.sessionNew.info.profile.label)
      expect(field).toHaveTextContent(en.sessionNew.info.profile.standard)
      expect(screen.queryByTestId('sn-profile-lines')).toBeNull()
    })
    it('CONTROL - the simulated lane keeps "Recording Profile" and its label', async () => {
      mount('/session', 'finalizing')
      const row = (await page('sm-details')).querySelector('[data-row=profile]')!
      expect(row).toHaveTextContent(en.session.details.profile)
      expect(row).not.toHaveTextContent(L.profile.configuredLabel)
    })
  })

  describe('G89c-04: the sealed format on the item (operation 40)', () => {
    it('reads `evidence.files[].profile` and `evidence.streamProfileNotice` by name from the contract examples', () => {
      const body = { ...SEALED_BODY, evidence: { ...SEALED, ...EVIDENCE_SEALED_PROFILE_EXAMPLE, ...EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE } }
      const facts = readDetailFacts(body)
      expect(facts.sealedProfiles).toEqual(EVIDENCE_SEALED_PROFILE_EXAMPLE.files.map((file) => ({ trackId: file.trackId, profile: file.profile })))
      expect(facts.streamProfileNotice).toEqual(EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE.streamProfileNotice.tracks)
    })
    it('control: an item that states neither reads null - nothing is drawn, nothing is assumed equal', () => {
      const plain = readDetailFacts({ ...SEALED_BODY, evidence: { ...SEALED, files: (SEALED['files'] as Record<string, unknown>[]).map(({ profile: _profile, ...file }) => file) } })
      expect(plain.sealedProfiles).toBeNull()
      expect(plain.streamProfileNotice).toBeNull()
      expect(readDetailFacts({ evidence: { files: [{ trackId: 'VIDEO-01', profile: 'not a profile <b>' }] } }).sealedProfiles).toBeNull()
    })
  })

  describe('G75d-06: a generated source is named as generated', () => {
    const fake = { id: 'CAM-01', model: 'Dual-lens IP camera DL-2', adapter: 'FAKE' }
    it('on a Core in real capture the dataset\'s product name is not drawn; any other source and the simulated lane keep the model', () => {
      expect(isGeneratedSource(fake)).toBe(true)
      expect(sourceDeviceText(t, fake, true)).toBe(`CAM-01 · ${L.source.generatedCamera}`)
      expect(sourceDeviceText(t, { id: 'MIC-01', model: 'USB condenser microphone UM-1', adapter: 'FAKE' }, true)).not.toContain('UM-1')
      expect(sourceDeviceText(t, { id: 'CAM-04', model: 'FAKE-CAM-1', adapter: 'FAKE' }, true)).not.toContain('FAKE-CAM-1')
      expect(sourceDeviceText(t, { id: 'CAM-03', model: 'MacBook Air Camera', adapter: 'LOCAL_DEVICE' }, true)).toBe('CAM-03 · MacBook Air Camera')
      expect(sourceDeviceText(t, fake, false)).toBe('CAM-01 · Dual-lens IP camera DL-2')
      expect(sourceDeviceText(t, { id: 'CAM-09', model: null }, true)).toBe('CAM-09')
    })
  })

  describe('G70c-02: a state is said only of a checked fact', () => {
    it('a source line at rest on a Core in real capture: `online: true` is "the row is enabled" - NOT_CHECKED, never REACHABLE', () => {
      expect(sourceLineState({ realCapture: true, recording: false, online: true, streamState: 'LIVE' })).toEqual({ reach: 'NOT_CHECKED', stream: null })
      expect(sourceLineState({ realCapture: true, recording: false, online: true, streamState: 'LIVE', checkedAt: 1_791_000_000_000 })).toEqual({ reach: 'REACHABLE', stream: null })
      expect(sourceLineState({ realCapture: true, recording: true, online: true, streamState: 'LIVE' })).toEqual({ reach: 'REACHABLE', stream: 'LIVE' })
      expect(sourceLineState({ realCapture: true, recording: false, online: false, streamState: 'LOST' })).toEqual({ reach: 'NOT_REACHABLE', stream: 'LOST' })
      expect(sourceLineState({ realCapture: true, recording: false, online: true, streamState: 'LOST' })).toEqual({ reach: 'NOT_CHECKED', stream: 'LOST' })
      expect(sourceLineState({ realCapture: true, recording: false, online: true, checkedAt: null })).toEqual({ reach: 'NOT_CHECKED', stream: null })
    })
    it('CONTROL - the simulated lane keeps Online / Offline and its stream', () => {
      expect(sourceLineState({ realCapture: false, recording: false, online: true, streamState: 'LIVE' })).toEqual({ reach: 'ONLINE', stream: 'LIVE' })
      expect(sourceLineState({ realCapture: false, recording: false, online: false })).toEqual({ reach: 'OFFLINE', stream: null })
    })
    it('a registered source reads "Ready" only when the Core opened or checked it', () => {
      const card = (device: Record<string, unknown>) => ({ state: 'READY' as const, device: { id: 'CAM-04', kind: 'CAMERA', online: true, ...device } as never })
      expect(rosterStateNotChecked(card({ adapter: 'FAKE' }), true)).toBe(true)
      expect(rosterStateNotChecked(card({ adapter: 'LOCAL_DEVICE', sourceOpen: true }), true)).toBe(false)
      expect(rosterStateNotChecked(card({ adapter: 'ONVIF_RTSP', checkedAt: 1_791_000_000_000 }), true)).toBe(false)
      expect(rosterStateNotChecked(card({ adapter: 'FAKE' }), false)).toBe(false)
      expect(rosterStateNotChecked({ ...card({ adapter: 'FAKE' }), state: 'NOT_REACHABLE' }, true)).toBe(false)
      expect(restingSourceChecked(null)).toBe(false)
    })
  })

  describe('G70c-08: a registered camera that is on no track has its card', () => {
    const device = (id: string) => ({ id, kind: 'CAMERA', adapter: 'FAKE', sourceClass: 'DEVELOPMENT', online: true, model: null, host: null, streamState: null }) as never
    const devices = [device('CAM-01'), device('CAM-02'), device('CAM-05')]
    it('while CAM-05 feeds Camera 2, the unassigned built-in CAM-02 is in the roster; assigned built-ins are tiles, not cards', () => {
      const config = { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }, { trackId: 'VIDEO-02', deviceId: 'CAM-05' }], mics: [] } as never
      expect(registeredRoster({ devices, config, alerts: [] }, 'CAMERA').map((card) => [card.id, card.slot])).toEqual([['CAM-02', null], ['CAM-05', 'VIDEO-02']])
    })
    it('control: with the built-in pair on its tracks the roster holds only the other cameras', () => {
      const config = { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }], mics: [] } as never
      expect(registeredRoster({ devices, config, alerts: [] }, 'CAMERA').map((card) => card.id)).toEqual(['CAM-05'])
    })
  })

  // Audit fix row 104 (DF-21, ruling D25 N3; register S7 `system.noProducer`): on a Core in its own capture (the
  // REAL_PRODUCTION console) a block without a producer draws "Not reported" in place of the model's values - no
  // block carries the "Synthetic demo values" chip of wave L any more (the mixed blocks Other devices and Network
  // status gate their model rows in their own files, row 107). The simulated lane is pinned unchanged.
  describe('G75d-07 / DF-21: no synthetic slice on a Core in its own capture - "Not reported" - and the one count', () => {
    const NOT_REPORTED = en.system.noProducer
    /** Every block of the document that still shows model values under the chip. */
    const chippedBlocks = (): string[] => Array.from(document.querySelectorAll('[data-synthetic-block]')).map((element) => element.getAttribute('data-synthetic-block') ?? '')
    it('"OTHER DEVICES" counts what the banner counts: no GNSS receiver and no TPM reading on a Core in its own capture', () => {
      const sim = newSim('idle')
      const simulated = selectSummary(sim.store.getState())
      expect(simulated.otherTotal).toBe(5)
      realCore(sim)
      const own = selectSummary(sim.store.getState())
      expect([own.otherOk, own.otherTotal]).toEqual([3, 3])
    })
    it('System (U-14): no synthetic block - services, health, update and the banner read "Not reported"; the maintenance actions stay', async () => {
      mount('/system', 'idle', realCore)
      const root = await page('page-system')
      for (const block of ['services', 'health', 'update', 'system-banner']) expect(await page(`no-producer-${block}`)).toHaveTextContent(NOT_REPORTED)
      expect(chippedBlocks()).toEqual([])
      expect(within(root).queryByTestId('system-services-summary')).toBeNull()
      expect(within(root).getByTestId('system-banner')).not.toHaveTextContent(en.system.banner.ok)
      expect(within(root).getByTestId('system-banner')).not.toHaveTextContent(SOFTWARE_VERSION)
      expect(within(root).getByTestId('system-run-diagnostics')).toBeInTheDocument()
      expect(within(root).getByTestId('system-export-logs')).toBeInTheDocument()
      expect(getMissingI18nKeys()).toEqual([])
    })
    // Audit fix row 105 (DF-21 / U-14, D25 N3, D29 Q5; S7, S8, S9): System > About of a Core in its own capture.
    it('System > About (U-14): no "Synthetic demo values" chip; the dataset\'s reserved device id and every model row read "Not reported"', async () => {
      const sim = mount('/system', 'idle', realCore)
      const about = await page('system-panel-about')
      expect(within(about).queryByTestId('system-about-synthetic')).toBeNull()
      expect(about).not.toHaveTextContent(en.system.about.synthetic)
      expect(within(about).getByTestId('system-about-deviceId')).toHaveTextContent(NOT_REPORTED)
      for (const key of ['room', 'model', 'hardware', 'slot', 'ip', 'serialNumber', 'hardwareUuid', 'chassisRevision', 'bspVersion', 'provisioningRecordId', 'buildId', 'checksum', 'sbom', 'sbomFormat']) {
        expect(within(about).getByTestId(`system-about-${key}`), key).toHaveTextContent(NOT_REPORTED)
      }
      const state = sim.store.getState()
      for (const model of [DEVICE_ID, DEVICE_IDENTITY.serialNumber, DEVICE_IDENTITY.hardwareUuid, state.device.room, state.device.productName, state.network.ip]) expect(about, model).not.toHaveTextContent(model)
      expect(getMissingI18nKeys()).toEqual([])
    })
    it('System > About (S9): the device id is the Core\'s own record when it is not the dataset\'s reserved id', async () => {
      mount('/system', 'idle', (sim) => {
        realCore(sim)
        sim.store.setState({ device: { ...sim.store.getState().device, id: 'DEMS-BENCH-01' } })
      })
      expect(await page('system-about-deviceId')).toHaveTextContent('DEMS-BENCH-01')
    })
    it('CONTROL - System > About on the simulated lane keeps the chip, the dataset\'s device id and the model rows', async () => {
      mount('/system', 'idle')
      const about = await page('system-panel-about')
      expect(within(about).getByTestId('system-about-synthetic')).toHaveTextContent(en.system.about.synthetic)
      expect(within(about).getByTestId('system-about-deviceId')).toHaveTextContent(DEVICE_ID)
      expect(about).toHaveTextContent(DEVICE_IDENTITY.serialNumber)
      expect(about).not.toHaveTextContent(NOT_REPORTED)
    })
    it('CONTROL - the simulated lane keeps the services, the health and the banner count; no chip, no notice', async () => {
      mount('/system', 'idle')
      const root = await page('page-system')
      expect(await page('system-services-summary')).toBeInTheDocument()
      expect(within(root).getByTestId('system-banner')).toHaveTextContent(en.system.banner.ok)
      expect(root.querySelector('[data-no-producer-block]')).toBeNull()
      expect(chippedBlocks()).toEqual([])
    })
    it('Devices (U-10): the port map, the front panel and the two model cards read "Not reported"; no chip anywhere; no gain, no phantom power, no dataset role', async () => {
      mount('/devices', 'idle', realCore)
      await page('page-devices')
      for (const block of ['ports', 'front', 'summary-other', 'summary-ports']) expect(await page(`no-producer-${block}`)).toHaveTextContent(NOT_REPORTED)
      expect(chippedBlocks()).toEqual([])
      expect(screen.getByTestId('summary-ports')).not.toHaveAttribute('data-value')
      expect(screen.getByTestId('summary-other')).toHaveAttribute('data-reported', 'false')
      expect(screen.queryByTestId('port-GNSS_SMA')).toBeNull()
      const root = screen.getByTestId('page-devices')
      await page('audio-input-AUDIO-01')
      expect(root.querySelector('[data-fact=gain]')).toBeNull()
      expect(root.querySelector('[data-fact=phantom]')).toBeNull()
      expect(root.querySelector('[data-fact=clip]')).not.toBeNull()
      for (const model of ['Interviewer', 'Subject (Ch 2)', 'Balanced XLR', 'Dual-lens DL-2', '48 V phantom']) expect(root).not.toHaveTextContent(model)
      expect(getMissingI18nKeys()).toEqual([])
    })
    it('CONTROL - the simulated lane draws no chip and no notice on Devices and keeps the port map, gain, phantom power and the dataset roles', async () => {
      mount('/devices', 'idle')
      const root = await page('page-devices')
      await page('audio-input-AUDIO-01')
      expect(root.querySelector('[data-synthetic-block]')).toBeNull()
      expect(root.querySelector('[data-no-producer-block]')).toBeNull()
      expect(screen.getByTestId('port-GNSS_SMA')).toBeInTheDocument()
      expect(root.querySelector('[data-fact=gain]')).not.toBeNull()
      expect(root.querySelector('[data-fact=phantom]')).not.toBeNull()
      expect(root).toHaveTextContent('Interviewer')
    })
    it('Network & Time and Storage: domains, volumes and the usage series read "Not reported" on a Core in its own capture; no chip anywhere; none on the simulated lane', async () => {
      mount('/network-time', 'idle', realCore)
      expect(await page('no-producer-domains')).toHaveTextContent(NOT_REPORTED)
      expect(await page('no-producer-network-lan')).toHaveTextContent(NOT_REPORTED)
      expect(chippedBlocks()).toEqual([])
      cleanup()
      mount('/storage', 'idle', realCore)
      // Audit row CS2 (O-2): the volumes block shows the evidence volume the Core measured (below); the usage series stays "Not reported".
      expect(await page('storage-volume-measured')).toBeInTheDocument()
      expect(await page('no-producer-usage')).toHaveTextContent(NOT_REPORTED)
      expect(chippedBlocks()).toEqual([])
      cleanup()
      mount('/storage', 'idle')
      await page('page-storage')
      expect(document.querySelector('[data-synthetic-block]')).toBeNull()
      expect(document.querySelector('[data-no-producer-block]')).toBeNull()
    })
  })

  // Audit row CS2 (rulings D74, D81, D88, D89): the C-SYN leftovers the W1 re-judges found on the REAL_PRODUCTION console.
  describe('row CS2: the top bar id, the settings wording, the readiness count, the measured volume and the device commands', () => {
    const NOT_REPORTED = en.system.noProducer
    const withRecord = (id: string) => (sim: Sim) => {
      realCore(sim)
      sim.store.setState({ device: { ...sim.store.getState().device, id } })
    }

    it('U-14c: the top bar of a Core in its own capture prints no reserved id - "Not reported" - and no model room', async () => {
      const sim = mount('/storage', 'idle', realCore)
      const header = await page('top-bar')
      const id = await within(header).findByTestId('top-bar-device-id', {}, FIND)
      expect(id).toHaveTextContent(NOT_REPORTED)
      expect(id).toHaveAttribute('data-reported', 'false')
      expect(header).not.toHaveTextContent(DEVICE_ID)
      expect(header).not.toHaveTextContent(sim.store.getState().device.name)
      expect(getMissingI18nKeys()).toEqual([])
    })
    it('U-14c (S9): a Core whose record is its installation id shows that id in the top bar, System > About and the settings', async () => {
      mount('/system', 'idle', withRecord('DEMS-BENCH-01'))
      expect(await within(await page('top-bar')).findByTestId('top-bar-device-id', {}, FIND)).toHaveTextContent('DEMS-BENCH-01')
      expect(await page('system-about-deviceId')).toHaveTextContent('DEMS-BENCH-01')
      expect(await page('system-settings-about-body')).toHaveTextContent('DEMS-BENCH-01')
    })
    it('U-14c: the settings "About DEMS" line of a Core in its own capture names no reserved id', async () => {
      mount('/system', 'idle', realCore)
      const body = await page('system-settings-about-body')
      expect(body).not.toHaveTextContent(DEVICE_ID)
      expect(body).toHaveTextContent(NOT_REPORTED)
    })
    it('CONTROL - the simulated lane keeps the dataset id and the room in the top bar', async () => {
      const sim = mount('/storage', 'idle')
      const id = await within(await page('top-bar')).findByTestId('top-bar-device-id', {}, FIND)
      expect(id).toHaveTextContent(DEVICE_ID)
      expect(id).toHaveAttribute('data-reported', 'true')
      expect(screen.getByTestId('top-bar')).toHaveTextContent(sim.store.getState().device.name)
    })

    it('U-14b: /system settings of a Core in its own capture say no demo word - no presentation switch, the preferences are the Core\'s', async () => {
      mount('/system', 'idle', realCore)
      const root = await page('page-system')
      await within(root).findByTestId('system-settings-local-note', {}, FIND)
      expect(within(root).queryByTestId('system-presentation-mode')).toBeNull()
      expect(root).not.toHaveTextContent(en.system.settings.presentationModeHint)
      expect(root).not.toHaveTextContent(en.system.settings.localNote)
      expect(within(root).getByTestId('system-settings-local-note')).toHaveTextContent(en.system.settings.localNoteCore)
    })
    it('CONTROL - the simulated lane keeps the presentation switch and "Saved on this console only (demo)."', async () => {
      mount('/system', 'idle')
      const root = await page('page-system')
      expect(await within(root).findByTestId('system-presentation-mode', {}, FIND)).toBeInTheDocument()
      expect(within(root).getByTestId('system-settings-local-note')).toHaveTextContent(en.system.settings.localNote)
    })

    it('F-5-02c: /session/new counts over the twelve listed checks and states the unrated ones beside the count', async () => {
      mount('/session/new', 'idle', realCore)
      const card = await page('sn-readiness')
      const count = within(card).getByTestId('sn-readiness-count').textContent ?? ''
      expect(within(card).getAllByRole('listitem')).toHaveLength(12)
      expect(count).toMatch(/^\d+ of 12 ready/)
      const notReported = within(card).queryAllByTestId('sn-readiness-not-reported').length
      const notes = within(card).queryAllByTestId('sn-readiness-host-clock').length
      expect(notReported).toBeGreaterThan(0)
      expect(count).toContain(`${notReported} not reported`)
      if (notes > 0) expect(count).toContain(`${notes} for information`)
      else expect(count).not.toContain('for information')
    })
    // Audit row 150 (D113, O-138-1 (c)): reach is memory-only; with no reading since boot an assigned, online source is
    // "Not checked" on step 1 - never PASS - and counted beside the count. A reading (REACHABLE) makes it ready again.
    it('row 150: /session/new step 1 says "Not checked" for every source with no reach reading since boot, and counts it', async () => {
      const reachOf = (reach: 'REACHABLE' | null) => (sim: Sim) => sim.store.setState({ captureDevices: { ...sim.store.getState().captureDevices, devices: sim.store.getState().captureDevices.devices.map((device) => ({ ...device, reach, checkedAt: reach === null ? null : DEMO_NOW })) } })
      mount('/session/new', 'idle', (sim) => { realCore(sim); reachOf(null)(sim) })
      const card = await page('sn-readiness')
      const notChecked = within(card).queryAllByTestId('sn-readiness-not-checked')
      expect(notChecked.length).toBeGreaterThan(0)
      for (const row of notChecked) expect(row).toHaveTextContent(enWeb.web.source.notChecked)
      expect(within(card).getByTestId('sn-readiness-count').textContent ?? '').toContain(`${notChecked.length} not checked`)
      cleanup()
      mount('/session/new', 'idle', (sim) => { realCore(sim); reachOf('REACHABLE')(sim) })
      const checked = await page('sn-readiness')
      expect(within(checked).queryAllByTestId('sn-readiness-not-checked')).toHaveLength(0)
      expect(within(checked).getByTestId('sn-readiness-count').textContent ?? '').not.toContain('not checked')
    })
    it('CONTROL - the simulated lane reads "N of 12 ready" and nothing beside it', async () => {
      mount('/session/new', 'idle')
      const card = await page('sn-readiness')
      expect(within(card).getByTestId('sn-readiness-count').textContent).toMatch(/^\d+ of 12 ready$/)
    })

    it('O-2: Storage > Volumes of a Core in its own capture shows the measured evidence volume, and no SMART, temperature or system volume', async () => {
      const sim = mount('/storage', 'idle', realCore)
      const evidence = sim.store.getState().storage.volumes.find((volume) => volume.kind === 'EVIDENCE')!
      const card = await page('storage-volume-measured')
      expect(card).toHaveAttribute('data-total-bytes', String(evidence.totalBytes))
      expect(card).toHaveAttribute('data-used-bytes', String(evidence.usedBytes))
      expect(card).toHaveTextContent(enWeb.web.realCore.storage.volumeTitle)
      const panel = screen.getByTestId('storage-panel-volumes')
      expect(within(panel).queryByTestId('no-producer-volumes')).toBeNull()
      expect(within(panel).getByTestId('storage-volumes-measured-note')).toHaveTextContent(enWeb.web.realCore.storage.volumeNote)
      for (const model of [en.storage.volumes.kind.SYSTEM, en.storage.volumes.kind.EVIDENCE, en.storage.volumes.temperature, en.storage.volumes.smart.PASSED, en.storage.volumes.derivedNote]) expect(panel).not.toHaveTextContent(model)
      expect(within(panel).queryByTestId('storage-volume-NVME-SYS')).toBeNull()
    })
    it('CONTROL - the simulated lane keeps both volume cards with their health', async () => {
      mount('/storage', 'idle')
      expect(await page('storage-volume-NVME-SYS')).toBeInTheDocument()
      expect(await page('storage-volume-HDD-EVIDENCE')).toBeInTheDocument()
      expect(screen.queryByTestId('storage-volume-measured')).toBeNull()
    })

    it('O-124-1: the Devices menu of a Core in its own capture disables test signal, identify and restart with the reason - nothing is sent', async () => {
      const sim = mount('/devices', 'idle', realCore, OPERATOR_IDS.RINA)
      fireEvent.click(await page('device-menu-CAM-02'))
      for (const name of [/Test signal/, /Identify/, /Restart/]) {
        const item = await screen.findByRole('menuitem', { name }, FIND)
        expect(item).toHaveAttribute('aria-disabled', 'true')
        expect(item).toHaveTextContent(en.common.deviceMenuHint.notAvailable)
      }
      expect(sim.store.getState().audit.rows.some((row) => row.type === 'DEVICE_COMMAND')).toBe(false)
    })
    it('CONTROL - the simulated lane keeps the three commands offered to a TECHNICIAN', async () => {
      mount('/devices', 'idle', () => undefined, OPERATOR_IDS.RINA)
      fireEvent.click(await page('device-menu-CAM-02'))
      for (const name of [/Test signal/, /Identify/, /Restart/]) expect(await screen.findByRole('menuitem', { name }, FIND)).not.toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('G89c-05: a signing key the Core\'s items name is a stated control', () => {
    const state = (sim: Sim) => sim.store.getState()
    it('with a key: the control is active and not counted "not reported"; without one it stays "Not reported"', () => {
      const sim = newSim('idle')
      realCore(sim)
      const input = { security: state(sim).security, time: { source: HOST_CLOCK_TIME.source, locked: HOST_CLOCK_TIME.locked }, chain: { ok: true, breakSeq: null }, softwareVersion: '2.4.1', signatureAlgorithm: 'Ed25519', ready: true, hostClock: true }
      const withKey = buildControls({ ...input, signingKey: { keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519', developmentKey: true } } as never).find((control) => control.id === 'SIGNATURE')!
      expect(withKey.notReported).toBeUndefined()
      expect(withKey.status).toBe('OK')
      expect(withKey.fact).toMatchObject({ kind: 'SIGNING_KEY', key: { keyId: 'CORE-KEY-EVSIGN-01' } })
      const without = buildControls({ ...input, signingKey: null } as never).find((control) => control.id === 'SIGNATURE')!
      expect(without.notReported).toBe(true)
    })
  })
})
