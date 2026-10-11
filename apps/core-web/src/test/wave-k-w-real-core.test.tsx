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
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORE_API_EXAMPLES, SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, HOST_CLOCK_TIME, OPERATOR_IDS, createManualClock, createMemoryAuthStorage, createSim, type EvidenceItem, type ScenarioName, type Sim } from '@dems/shared/sim'
import { ownCoreRow } from '@/components/shell/integrity-checks'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { countedDevicesOf, COUNTED_DEVICES, selectBanner } from '@/features/devices/model'
import { buildControls, verifyChain } from '@/features/security-audit/model'
import { keyEntries, ownCoreKeyEntries } from '@/features/security-audit/sim-adapter'
import { realSealFactsOf } from '@/features/session-monitor/real-seal-facts'
import { captureFaultReasonOf, STREAM_PROFILE_DIFFERS, streamProfileNoticeOf, timelineWithoutRepeatedFaults } from '@/features/session-monitor/sim-adapter'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { isSelfCaptureCore, reportedSigningKeyOf } from '@/lib/own-capture'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'

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
    const sim = mount('/session', 'finalizing')
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
