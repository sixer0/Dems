/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
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
// | G89c-05 | a stated signing key is not "Not reported" | "G89c-05" |
// | G75d-01 / -03 | the open notice on pill and bell, its acknowledgement; no alert of another session as a FAULT | "G75d-01" |
// | G75d-02 | the retry of a blocked seal for the role operation 33 allows | "G75d-02" |
// | G75d-04 | one terminal sentence at the unsealable end | "G75d-04" |
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORE_API_EXAMPLES, EVIDENCE_SEALED_PROFILE_EXAMPLE, EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE, SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { CoreMode } from '@dems/shared/live'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  HOST_CLOCK_TIME,
  OPERATOR_IDS,
  SEAL_AUTOMATIC_RETRIES,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  SEAL_BLOCKED_EXAMPLE_SESSION_ID,
  SEAL_UNSEALABLE_EXAMPLE_ALERT,
  SEAL_UNSEALABLE_EXAMPLE_SESSION_ID,
  SEAL_UNSEALABLE_PLAIN_SENTENCE,
  alertBlocksRecording,
  canResolveUnsealable,
  canRetryBlockedSeal,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  openUnsealableNoticesOf,
  type ScenarioName,
  type Sim,
  type SimAlert,
  type SimState,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { manifestDigestSourceOf, manifestSuffixKey } from '@/features/dashboard/sim-adapter'
import { selectSummary } from '@/features/devices/model'
import { isGeneratedSource, restingSourceChecked, sourceDeviceText } from '@/features/devices/own-core-words'
import { registeredRoster, rosterStateNotChecked } from '@/features/devices/registered-devices-model'
import { sourceLineState } from '@/features/devices/source-state'
import { readDetailFacts } from '@/features/evidence/item-facts'
import { buildControls } from '@/features/security-audit/model'
import { coreVerifyOutcomes } from '@/features/security-audit/core-verify-rows'
import { worstAlertOfSession } from '@/features/session-monitor/model'
import { configuredProfileLinesOf } from '@/features/session-monitor/sim-adapter'
import { selectUnsealableCause } from '@/features/session-monitor/unsealable-cause'
import type { TFunction } from 'i18next'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'

vi.setConfig({ testTimeout: 45_000 })

const L = enWeb.web.waveL
const FIND = { timeout: 15_000 }
const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')
/** The two words `sourceDeviceText` asks for: a stand-in translator that answers the web resource. */
const t = ((key: string) => (key === 'web.waveL.source.generatedCamera' ? enWeb.web.waveL.source.generatedCamera : key)) as unknown as TFunction

const GET_EVIDENCE_200 = (CORE_API_EXAMPLES.getEvidence ?? { responses: {} }).responses[200] as Record<string, { value: Record<string, unknown> & { evidence: Record<string, unknown> } }>
const SEALED_BODY = GET_EVIDENCE_200['productSealed']!.value
const SEALED = SEALED_BODY.evidence

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

function newSim(scenario: ScenarioName, operatorId: string | null = OPERATOR_IDS.BUDI): Sim {
  const authStorage = createMemoryAuthStorage()
  if (operatorId !== null) authStorage.save({ operatorId, issuedAt: DEMO_NOW })
  const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario, storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  return sim
}

function mount(route: string, scenario: ScenarioName, prepare: (sim: Sim) => void = () => undefined, operatorId: string = OPERATOR_IDS.BUDI): Sim {
  const sim = newSim(scenario, operatorId)
  prepare(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: [route] }) })
  render(<RouterProvider router={router} />)
  return sim
}

/** A Core in its own capture: the two statements of the state (contract examples). */
function realCore(sim: Sim): void {
  sim.store.setState({ security: { ...sim.store.getState().security, ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE }, time: { ...HOST_CLOCK_TIME } })
}

const unsealableOf = (sessionId: string, patch: Partial<SimAlert> = {}): SimAlert => ({ ...SEAL_UNSEALABLE_EXAMPLE_ALERT, target: sessionId, params: { ...SEAL_UNSEALABLE_EXAMPLE_ALERT.params, sessionId }, ...patch })

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

describe('G75d-07: the "Synthetic demo values" chip and the one count', () => {
  it('"OTHER DEVICES" counts what the banner counts: no GNSS receiver and no TPM reading on a Core in its own capture', () => {
    const sim = newSim('idle')
    const simulated = selectSummary(sim.store.getState())
    expect(simulated.otherTotal).toBe(5)
    realCore(sim)
    const own = selectSummary(sim.store.getState())
    expect([own.otherOk, own.otherTotal]).toEqual([3, 3])
  })
  it('Devices: the chip on the other devices, the front panel, the port map and the two model cards; no gain, no phantom power, no dataset role', async () => {
    mount('/devices', 'idle', realCore)
    await page('page-devices')
    for (const block of ['other', 'front', 'ports', 'summary-other', 'summary-ports']) expect(await page(`synthetic-values-${block}`)).toHaveTextContent(L.syntheticChip)
    const root = screen.getByTestId('page-devices')
    await page('audio-input-AUDIO-01')
    expect(root.querySelector('[data-fact=gain]')).toBeNull()
    expect(root.querySelector('[data-fact=phantom]')).toBeNull()
    expect(root.querySelector('[data-fact=clip]')).not.toBeNull()
    for (const model of ['Interviewer', 'Subject (Ch 2)', 'Balanced XLR', 'Dual-lens DL-2', '48 V phantom']) expect(root).not.toHaveTextContent(model)
    expect(screen.getByTestId('port-GNSS_SMA')).not.toHaveTextContent(en.devices.ports.linkUp)
    expect(getMissingI18nKeys()).toEqual([])
  })
  it('CONTROL - the simulated lane draws no chip on Devices and keeps gain, phantom power and the dataset roles', async () => {
    mount('/devices', 'idle')
    const root = await page('page-devices')
    await page('audio-input-AUDIO-01')
    expect(root.querySelector('[data-synthetic-block]')).toBeNull()
    expect(root.querySelector('[data-fact=gain]')).not.toBeNull()
    expect(root.querySelector('[data-fact=phantom]')).not.toBeNull()
    expect(root).toHaveTextContent('Interviewer')
  })
  it('Network & Time and Storage: the chip on the model blocks of a Core in its own capture, none on the simulated lane', async () => {
    mount('/network-time', 'idle', realCore)
    expect(await page('synthetic-values-network')).toBeInTheDocument()
    expect(await page('synthetic-values-domains')).toBeInTheDocument()
    cleanup()
    mount('/storage', 'idle', realCore)
    expect(await page('synthetic-values-volumes')).toBeInTheDocument()
    cleanup()
    mount('/storage', 'idle')
    await page('page-storage')
    expect(document.querySelector('[data-synthetic-block]')).toBeNull()
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

describe('G75d-01 / G75d-03: the open notice of a recording that could not be sealed', () => {
  it('the contract\'s readers: the unsealable alert is an open notice that does not block recording; a blocked seal does', () => {
    expect(openUnsealableNoticesOf({ alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] })).toHaveLength(1)
    expect(openUnsealableNoticesOf({ alerts: [{ ...SEAL_UNSEALABLE_EXAMPLE_ALERT, active: false }] })).toHaveLength(0)
    expect(alertBlocksRecording(SEAL_UNSEALABLE_EXAMPLE_ALERT)).toBe(false)
    expect(alertBlocksRecording(SEAL_BLOCKED_EXAMPLE_ALERT)).toBe(true)
    expect(canResolveUnsealable('SUPERVISOR')).toBe(true)
    expect(canResolveUnsealable('INVESTIGATOR')).toBe(false)
  })
  it('the Monitor never draws the alert of ANOTHER session as the fault of the session that records', () => {
    const base = newSim('recording').store.getState()
    const open = base.session!.id
    const with_ = (alerts: SimAlert[]): SimState => ({ ...base, alerts })
    // The notice of session X beside the recording of session Y: no condition of Y.
    expect(worstAlertOfSession(with_([SEAL_UNSEALABLE_EXAMPLE_ALERT]), open)).toBeNull()
    // Even the unsealable notice of the open session's own id is the open notice, never a fault state.
    expect(worstAlertOfSession(with_([unsealableOf(open)]), open)).toBeNull()
    // An alert that names another session is not this session's; one that names this session, or none, is read as before.
    const critical = { ...SEAL_BLOCKED_EXAMPLE_ALERT, params: { ...SEAL_BLOCKED_EXAMPLE_ALERT.params, sessionId: 'SES-20261011-0001' } } as SimAlert
    expect(worstAlertOfSession(with_([critical]), open)).toBeNull()
    expect(worstAlertOfSession(with_([{ ...critical, params: { ...critical.params, sessionId: open } }]), open)?.id).toBe(critical.id)
    const { sessionId: _none, ...unnamed } = critical.params as Record<string, unknown>
    expect(worstAlertOfSession(with_([{ ...critical, params: unnamed } as SimAlert]), open)?.id).toBe(critical.id)
  })
  it('the header pill reads "OPEN NOTICE" instead of "SECURE / All systems operational"; the bell names the session and the cause as a detail and tells a non-supervisor who closes it', async () => {
    mount('/security-audit', 'idle', (sim) => sim.store.setState({ alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] }))
    const pill = await page('secure-pill')
    await waitFor(() => expect(pill).toHaveAttribute('data-open-notice', 'true'), FIND)
    expect(pill).toHaveTextContent(L.notice.pillLabel)
    expect(pill).not.toHaveTextContent(en.shell.securePill.SECURE.subtitle)
    fireEvent.click(screen.getByTestId('notifications-bell'))
    const row = await page(`alert-unsealable-${SEAL_UNSEALABLE_EXAMPLE_ALERT.id}`)
    expect(within(row).getByTestId(`alert-unsealable-sentence-${SEAL_UNSEALABLE_EXAMPLE_ALERT.id}`)).toHaveTextContent(SEAL_UNSEALABLE_PLAIN_SENTENCE)
    // No code in brackets in the sentence (G75d-04); the code is its own detail.
    expect(row).not.toHaveTextContent('(SESSION_KEY_NOT_OF_SESSION)')
    expect(row).toHaveTextContent(SEAL_UNSEALABLE_EXAMPLE_SESSION_ID)
    expect(row).toHaveTextContent('Cause code: SESSION_KEY_NOT_OF_SESSION')
    // BUDI is the investigator: no control, the sentence says who can.
    expect(within(row).queryByTestId(`alert-unsealable-acknowledge-${SEAL_UNSEALABLE_EXAMPLE_ALERT.id}`)).toBeNull()
    expect(within(row).getByTestId(`alert-unsealable-who-${SEAL_UNSEALABLE_EXAMPLE_ALERT.id}`)).toHaveTextContent(L.notice.closeBySupervisor)
    expect(getMissingI18nKeys()).toEqual([])
  })
  it('a supervisor acknowledges it from the bell: the alert is resolved and the pill is back', async () => {
    const sim = mount('/security-audit', 'idle', (prepared) => prepared.store.setState({ alerts: [{ ...SEAL_UNSEALABLE_EXAMPLE_ALERT, acknowledged: true }] }), OPERATOR_IDS.ANDI)
    const pill = await page('secure-pill')
    await waitFor(() => expect(pill).toHaveAttribute('data-open-notice', 'true'), FIND)
    fireEvent.click(screen.getByTestId('notifications-bell'))
    const button = await page(`alert-unsealable-acknowledge-${SEAL_UNSEALABLE_EXAMPLE_ALERT.id}`)
    await act(async () => {
      fireEvent.click(button)
    })
    await waitFor(() => expect(openUnsealableNoticesOf(sim.store.getState())).toHaveLength(0), FIND)
    expect(sim.store.getState().alerts.find((alert) => alert.id === SEAL_UNSEALABLE_EXAMPLE_ALERT.id)).toMatchObject({ active: false, acknowledged: true })
    await waitFor(() => expect(pill).not.toHaveAttribute('data-open-notice'), FIND)
  })
  it('CONTROL - no notice: the pill is the system\'s own state', async () => {
    mount('/security-audit', 'idle')
    const pill = await page('secure-pill')
    await waitFor(() => expect(pill).toHaveAttribute('data-state', 'SECURE'), FIND)
    expect(pill).not.toHaveAttribute('data-open-notice')
  })
  it('Dashboard ring: an open notice is said on it; a blocked seal makes it critical - never "READY ... ready for recording"', async () => {
    mount('/dashboard', 'idle', (sim) => sim.store.setState({ alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] }))
    const line = await page('ring-status-line')
    await waitFor(() => expect(line).toHaveTextContent(L.notice.ringSub), FIND)
    expect(line.closest('[data-open-notice]')).not.toBeNull()
    cleanup()
    mount('/dashboard', 'finalizing', blocked)
    const blockedLine = await page('ring-status-line')
    await waitFor(() => expect(blockedLine).toHaveTextContent(L.notice.blockedRingSub), FIND)
    expect(blockedLine.closest('[data-seal-blocked]')).not.toBeNull()
    expect(blockedLine.closest('.dems-dash-ring-cell')).not.toHaveTextContent(en.dashboard.systemRing.caption.READY)
  })
})

function blocked(sim: Sim): void {
  const session = sim.store.getState().session!
  sim.store.setState({
    session: { ...session, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION, captureDurable: true } as typeof session,
    alerts: [SEAL_BLOCKED_EXAMPLE_ALERT],
  })
}

describe('G75d-02: the retry of a blocked seal', () => {
  it('the contract: an investigator and a supervisor may send operation 33, a technician may not; three automatic retries', () => {
    expect(canRetryBlockedSeal('INVESTIGATOR')).toBe(true)
    expect(canRetryBlockedSeal('SUPERVISOR')).toBe(true)
    expect(canRetryBlockedSeal('TECHNICIAN')).toBe(false)
    expect(SEAL_AUTOMATIC_RETRIES).toBe(3)
  })
  it('the Monitor banner and the seal dialog offer "Retry sealing" to a role that may retry, with the two true sentences', async () => {
    const sim = mount('/session', 'finalizing', blocked)
    const recover = vi.spyOn(sim.actions, 'recover')
    const banner = await page('sm-status-banner')
    await waitFor(() => expect(banner).toHaveAttribute('data-seal', 'BLOCKED'), FIND)
    const stopped = L.sealRetry.stopped.replace('{{count}}', String(SEAL_AUTOMATIC_RETRIES))
    expect(banner).toHaveTextContent(stopped)
    expect(banner).toHaveTextContent(L.sealRetry.whoCan)
    expect(within(banner).getByTestId('sm-seal-retry-banner')).toBeEnabled()
    const dialog = await page('sm-seal-attention')
    expect(dialog).toHaveTextContent(stopped)
    expect(dialog).toHaveTextContent(L.sealRetry.whoCan)
    await act(async () => {
      fireEvent.click(within(dialog).getByTestId('sm-seal-retry-dialog'))
    })
    expect(recover).toHaveBeenCalledTimes(1)
    expect(getMissingI18nKeys()).toEqual([])
  })
  it('a role that may not retry gets no control and reads who can', async () => {
    mount('/session', 'finalizing', blocked, OPERATOR_IDS.RINA)
    const banner = await page('sm-status-banner')
    await waitFor(() => expect(banner).toHaveAttribute('data-seal', 'BLOCKED'), FIND)
    for (const control of screen.getAllByTestId('sm-seal-retry')) {
      expect(control).toHaveAttribute('data-may-retry', 'false')
      expect(control).toHaveTextContent(L.sealRetry.whoCan)
    }
    expect(screen.queryByTestId('sm-seal-retry-banner')).toBeNull()
    expect(screen.queryByTestId('sm-seal-retry-dialog')).toBeNull()
  })
  it('CONTROL - a seal that runs offers no retry', async () => {
    mount('/session', 'finalizing')
    await page('sm-status-banner')
    expect(screen.queryByTestId('sm-seal-retry')).toBeNull()
  })
})

describe('G75d-04: the unsealable end', () => {
  it('the cause of ONE session, read from its own alert - open or already acknowledged; another session has none', () => {
    const state = { ...newSim('idle').store.getState(), alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] }
    expect(selectUnsealableCause(SEAL_UNSEALABLE_EXAMPLE_SESSION_ID)(state)).toBe('SESSION_KEY_NOT_OF_SESSION')
    expect(selectUnsealableCause('SES-20261011-0043')(state)).toBeNull()
    expect(selectUnsealableCause(null)(state)).toBeNull()
    expect(selectUnsealableCause(SEAL_UNSEALABLE_EXAMPLE_SESSION_ID)({ ...state, alerts: [{ ...SEAL_UNSEALABLE_EXAMPLE_ALERT, active: false, acknowledged: true }] })).toBe('SESSION_KEY_NOT_OF_SESSION')
  })
  it('the dialog of a session that ended unsealable: one terminal sentence, the cause as a detail - no "Finalizing", no percentage, no steps, no "Resumed after restart"', async () => {
    const sim = mount('/session', 'finalizing', (prepared) => {
      const session = prepared.store.getState().session!
      // Two failed attempts on the Core: the web's own attempt counter is above 1 (what drew "Resumed after restart").
      prepared.store.setState({ session: { ...session, id: SEAL_UNSEALABLE_EXAMPLE_SESSION_ID, finalization: { ...session.finalization, steps: session.finalization.steps.map((step, index) => (index === 0 ? { ...step, attempt: 3 } : step)) } } as typeof session })
    })
    await page('sm-final-progress')
    // The Core ends the session: it is gone from the state, and its alert is there.
    await act(async () => {
      sim.store.setState({ session: null, alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] })
    })
    const notice = await page('sm-unsealable')
    expect(within(notice).getByTestId('sm-unsealable-sentence')).toHaveTextContent(SEAL_UNSEALABLE_PLAIN_SENTENCE)
    expect(notice).not.toHaveTextContent('(SESSION_KEY_NOT_OF_SESSION)')
    expect(within(notice).getByTestId('sm-unsealable-cause')).toHaveTextContent('Cause code: SESSION_KEY_NOT_OF_SESSION')
    const dialog = notice.closest('[role=dialog]')!
    expect(dialog).toHaveTextContent(L.unsealableEnd.title)
    expect(dialog).not.toHaveTextContent(en.session.finalization.title)
    expect(within(dialog as HTMLElement).queryByTestId('sm-final-progress')).toBeNull()
    expect(within(dialog as HTMLElement).queryByTestId('sm-final-resumed')).toBeNull()
    expect(dialog).not.toHaveTextContent(en.session.finalization.resumed)
    expect(dialog).not.toHaveTextContent('% complete')
    expect(dialog.querySelector('.sm-final-stepper')).toBeNull()
  })
})
