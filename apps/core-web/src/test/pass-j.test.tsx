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
import { cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORE_NOT_RUNNING_FAULT_EXAMPLE, SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE, START_REFUSED_SESSION_KEY_EXAMPLE } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { LiveTransportError } from '@dems/shared/live'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  CORE_NOT_RUNNING_LABEL,
  HOST_CLOCK_TIME,
  OPERATOR_IDS,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  SEAL_BLOCKED_EXAMPLE_SESSION_ID,
  START_REFUSED_REASONS,
  coreNotRunningFaultTransition,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  startRefusedReasonOf,
  startRefusedSentenceKey,
  type ScenarioName,
  type Sim,
} from '@dems/shared/sim'
import { INTEGRITY_CHECK_IDS, ownCoreRow, pillSubtitle, selectIntegrityChecks, selectPillCause, selectPillState } from '@/components/shell/integrity-checks'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { buildControls, postureOf } from '@/features/security-audit/model'
import { createI18n, getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { CoreErrorNoticeKind, describeCoreError } from '@/lib/core-errors'
import { isOwnCaptureCore, isPlatformNotReportedCore } from '@/lib/own-capture'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'

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
  const checkpoints = { fragments: 15, bytes: 2_500_000_000, lastAt: DEMO_NOW, cameras: [] }

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
