// Task 3 R-9 / R-10, blueprint row 137: the camera search of Devices & Inputs
// (`masterplan/08_client_ux_spec.md` §8c flow 9; `masterplan/03_api_contract.md` §2.6 ops 93, 94).
//
// | Check | Where |
// |-------|-------|
// | M4-UX-UNIT: the states are drawn from an answer only; progress is forward-only under a moving Core clock; the list order equals the answer order; a device name containing markup is drawn literally | "the model", "Simulated mode" |
// | M4-DISC-W (component half): idle → search → list with "New" / "Already registered", the development group, the freshness line; Search again replaces the list | "Simulated mode" |
// | M4-DISC-RBAC-W (component half): a role without CAPTURE_CONFIG sees the control disabled with the role sentence and NO list is requested | "Simulated mode: gates" |
// | M4-CONN-LOCK-W (component half): with a session open Connect is disabled with its sentence, 0 toasts, and the search still works | "Simulated mode: gates" |
// | S9, S10, S11, S14: what a refused search is | "the model" |
// | Task 4 row 98 (WP-12): the typed address - an address outside the allowed form is refused in the form and nothing is sent; the Core's refusal has its sentence; no address is asked while a search runs; a search without the member is sent as before | "the typed address" |
// | Task 4 row 98: a registered camera that answers from another address is said, never followed; NO control re-addresses it (the confirmation waits for its operation, `implementation/097`) | "the typed address" |
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CaptureCandidate, CaptureDiscoverySearch, CaptureDiscoveryStateBody } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { OPERATOR_IDS } from '@dems/shared/sim'
import { getMissingI18nKeys } from '@/i18n'
import {
  candidateGroups,
  candidateKind,
  connectGate,
  DiscoveryReadError,
  makeModelOf,
  searchGate,
  searchPanelState,
  searchProgress,
  searchRead,
  startRefusal,
  typedAddressOf,
} from '../camera-search'
import { installDevicesBed, mountDevices, toastTexts } from './search-bed'

const S = en.common.captureSearch
const C = en.common.captureConnect
const ROLE_SENTENCE = en.common.rbac.requiresRole.replace('{{role}}', 'SUPERVISOR or TECHNICIAN')

const SEARCH: CaptureDiscoverySearch = {
  searchId: 'DSC-000001',
  scope: 'CAMERA_NETWORK',
  trigger: 'MANUAL',
  state: 'COMPLETE',
  startedAt: 1_000,
  windowMs: 3_000,
  completesAt: 4_000,
  expiresAt: 604_000,
  responderCount: 2,
  newCount: 1,
  registeredCount: 1,
  interfaceCount: 1,
  failureReason: null,
  created: true,
}
const candidate = (over: Partial<CaptureCandidate>): CaptureCandidate => ({
  candidateId: 'CND-00000000000A',
  adapter: 'ONVIF_RTSP',
  sourceClass: 'PRODUCTION',
  host: '192.0.2.10',
  endpointRef: 'urn:uuid:a',
  vendor: 'Acme',
  model: 'Cam 1',
  name: null,
  status: 'NEW',
  deviceId: null,
  testable: true,
  conflict: false,
  addressChanged: false,
  lastTest: null,
  adoptable: false,
  ...over,
})
const stateOf = (search: CaptureDiscoverySearch | null, candidates: CaptureCandidate[] = []): CaptureDiscoveryStateBody => ({ search, candidates, truncated: false })

describe('the model (ux §8c.2, §8c.3, §8c.6, §8c.8)', () => {
  it('the read: Checking until resolved; a role without CAPTURE_CONFIG and a 403 are forbidden; a failure wins over held data', () => {
    const data = stateOf(SEARCH)
    expect(searchRead({ resolved: false, canConfigure: true, data, error: null })).toEqual({ kind: 'CHECKING' })
    expect(searchRead({ resolved: true, canConfigure: false, data, error: null })).toEqual({ kind: 'FORBIDDEN' })
    expect(searchRead({ resolved: true, canConfigure: true, data: undefined, error: null })).toEqual({ kind: 'LOADING' })
    expect(searchRead({ resolved: true, canConfigure: true, data, error: new DiscoveryReadError(403, 'NOT_PERMITTED', null) })).toEqual({ kind: 'FORBIDDEN' })
    expect(searchRead({ resolved: true, canConfigure: true, data, error: new DiscoveryReadError(500, 'INTERNAL', null) })).toEqual({ kind: 'FAILED' })
    expect(searchRead({ resolved: true, canConfigure: true, data, error: null })).toEqual({ kind: 'READY', state: data })
  })

  it('the panel state is the answer of operation 94: idle, searching, results, empty, "could not run", and "no longer kept" only after a result was drawn', () => {
    const ready = (state: CaptureDiscoveryStateBody) => ({ kind: 'READY', state }) as const
    expect(searchPanelState(ready(stateOf(null)), false)).toBe('IDLE')
    expect(searchPanelState(ready(stateOf(null)), true)).toBe('EXPIRED')
    expect(searchPanelState(ready(stateOf({ ...SEARCH, state: 'RUNNING' })), true)).toBe('SEARCHING')
    expect(searchPanelState(ready(stateOf(SEARCH, [candidate({})])), true)).toBe('RESULTS')
    expect(searchPanelState(ready(stateOf({ ...SEARCH, responderCount: 0, newCount: 0, registeredCount: 0 })), true)).toBe('EMPTY')
    // S6: only registered cameras is a list, not the empty state. S8: FAILED is never an empty list.
    expect(searchPanelState(ready(stateOf({ ...SEARCH, newCount: 0 }, [candidate({ status: 'REGISTERED', deviceId: 'CAM-01' })])), true)).toBe('RESULTS')
    expect(searchPanelState(ready(stateOf({ ...SEARCH, state: 'FAILED', responderCount: 0, failureReason: 'SOCKET_ERROR' })), true)).toBe('FAILED')
  })

  it('G13 and G14: Checking, then allowed, or refused with its reason — the role first', () => {
    const base = { resolved: true, can: true, recording: false, recordingRefused: false, recordingAllowed: true, limitedSeconds: null }
    expect(searchGate(base)).toBeNull()
    expect(searchGate({ ...base, resolved: false })).toEqual({ kind: 'CHECKING' })
    expect(searchGate({ ...base, can: false, recording: true, recordingAllowed: false })).toEqual({ kind: 'ROLE', roles: ['SUPERVISOR', 'TECHNICIAN'] })
    // S14: before the lift, or after the Core's own 409 during this recording. After the lift a recording alone blocks nothing.
    expect(searchGate({ ...base, recording: true })).toBeNull()
    expect(searchGate({ ...base, recording: true, recordingAllowed: false })).toEqual({ kind: 'RECORDING' })
    expect(searchGate({ ...base, recording: true, recordingRefused: true })).toEqual({ kind: 'RECORDING' })
    expect(searchGate({ ...base, limitedSeconds: 7 })).toEqual({ kind: 'LIMITED', seconds: 7 })
    expect(connectGate({ resolved: false, can: true, locked: false })).toEqual({ kind: 'CHECKING' })
    expect(connectGate({ resolved: true, can: false, locked: true })).toMatchObject({ kind: 'ROLE' })
    expect(connectGate({ resolved: true, can: true, locked: true })).toEqual({ kind: 'LOCKED' })
    expect(connectGate({ resolved: true, can: true, locked: false })).toBeNull()
  })

  it('progress comes from Core instants, is clamped, and never goes back (forward-only)', () => {
    const search = { startedAt: 1_000, windowMs: 3_000 }
    expect(searchProgress(search, 1_000)).toBe(0)
    expect(searchProgress(search, 2_500)).toBe(50)
    expect(searchProgress(search, 9_000)).toBe(100)
    expect(searchProgress(search, 500)).toBe(0)
    // A Core clock that steps back cannot lower the bar.
    expect(searchProgress(search, 1_300, 50)).toBe(50)
    expect(searchProgress({ startedAt: 1_000, windowMs: 0 }, 1_000)).toBe(100)
  })

  it('the list keeps the order of the answer; development sources are their own group; a row is what the Core says it is', () => {
    const list = [
      candidate({ candidateId: 'CND-00000000000C', host: '192.0.2.30' }),
      candidate({ candidateId: 'CND-00000000000D', sourceClass: 'DEVELOPMENT', adapter: 'FAKE', host: '127.0.0.1' }),
      candidate({ candidateId: 'CND-00000000000A', host: '192.0.2.10' }),
    ]
    const groups = candidateGroups(list)
    expect(groups.network.map((entry) => entry.candidateId)).toEqual(['CND-00000000000C', 'CND-00000000000A'])
    expect(groups.development.map((entry) => entry.candidateId)).toEqual(['CND-00000000000D'])
    expect(candidateKind(candidate({}))).toBe('NEW')
    expect(candidateKind(candidate({ status: 'REGISTERED' }))).toBe('REGISTERED')
    expect(candidateKind(candidate({ testable: false }))).toBe('NOT_TESTABLE')
    expect(candidateKind(candidate({ conflict: true, testable: false }))).toBe('CONFLICT')
    expect(makeModelOf({ vendor: 'Acme', model: null })).toBe('Acme')
    expect(makeModelOf({ vendor: null, model: null })).toBeNull()
  })

  it('a refused search is named by its status and reason', () => {
    const refusal = (status: number | null, reason: string | null = null) => startRefusal({ status, code: 'X', reason })
    expect(refusal(503, 'DISCOVERY_NOT_READY')).toBe('UNAVAILABLE')
    expect(refusal(409, 'DISCOVERY_IN_PROGRESS')).toBe('BUSY')
    expect(refusal(409, 'DISCOVERY_NOT_ALLOWED_WHILE_RECORDING')).toBe('RECORDING')
    expect(refusal(429, 'DISCOVERY_RATE_LIMITED')).toBe('LIMITED')
    expect(refusal(403)).toBe('ROLE')
    expect(refusal(null)).toBe('OTHER')
  })
})

installDevicesBed()

describe('Simulated mode: a search and its list', { timeout: 30_000 }, () => {
  it('idle → Search for cameras → the list: New with Connect, Already registered with View device, the development group, the freshness line; nothing starts by itself', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI)
    const request = vi.spyOn(sim, 'request')
    const panel = await screen.findByTestId('camera-search')
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'IDLE'))
    expect(within(panel).getByTestId('camera-search-idle')).toHaveTextContent(S.intro)
    // R-9 AC-1: opening the page searched nothing.
    expect(sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_DISCOVERY_SEARCHED')).toHaveLength(0)
    const button = screen.getByTestId('search-cameras-button-panel')
    expect(button).toHaveTextContent(S.action)
    fireEvent.click(button)
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'RESULTS'))
    expect(request.mock.calls.filter(([call]) => call.method === 'POST' && call.path === '/api/v1/capture/discovery')).toHaveLength(1)
    expect(sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_DISCOVERY_SEARCHED')).toHaveLength(1)
    expect(screen.getByTestId('camera-search-summary')).toHaveTextContent('2 found · 1 new · 1 already registered')
    const fresh = screen.getByTestId('camera-search-row-CND-000000000001')
    expect(fresh).toHaveAttribute('data-kind', 'NEW')
    expect(within(fresh).getByTestId('camera-search-connect-CND-000000000001')).toBeEnabled()
    // The simulator's new candidate is a development source: its own group.
    expect(within(screen.getByTestId('camera-search-development')).getByText(S.developmentGroup)).toBeInTheDocument()
    expect(screen.getByTestId('camera-search-development')).toContainElement(fresh)
    const registered = screen.getByTestId('camera-search-row-CND-000000000002')
    expect(registered).toHaveTextContent(S.status.REGISTERED)
    expect(registered).toHaveTextContent('CAM-01 · Camera 1')
    expect(within(registered).queryByText(C.action)).not.toBeInTheDocument()
    expect(within(registered).getByTestId('camera-search-view-CND-000000000002')).toHaveTextContent(S.viewDevice)
    expect(screen.getByTestId('camera-search-freshness')).toHaveTextContent(/Searched at \d\d:\d\d:\d\d\. Kept until \d\d:\d\d:\d\d\./)
    expect(screen.getByTestId('camera-search-freshness')).toHaveTextContent(S.ownerNote)
    expect(screen.getByTestId('camera-search-trust')).toHaveTextContent(S.trustNote)
    // D83 / D91: no development-source badge in Simulated client mode.
    expect(document.querySelector('[data-testid^="camera-search-badge-"]')).toBeNull()
    expect(document.querySelector('[data-testid^="source-badge-"]')).toBeNull()
    // Ids are keys only: never drawn as text.
    expect(panel.textContent ?? '').not.toMatch(/CND-|DSC-/)
    // Search again: the same control, one more search, a list again.
    expect(button).toHaveTextContent(S.again)
    fireEvent.click(button)
    await waitFor(() => expect(sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_DISCOVERY_SEARCHED')).toHaveLength(2))
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'RESULTS'))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a device text that contains markup is drawn literally, as text', async () => {
    const hostile = '<img src=x onerror="window.__pwned=1"><b>Cam</b>'
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI)
    const real = sim.request.bind(sim)
    vi.spyOn(sim, 'request').mockImplementation((call) => {
      const response = real(call)
      if (call.method !== 'GET' || call.path !== '/api/v1/capture/discovery') return response
      const body = response.body as CaptureDiscoveryStateBody
      return { ...response, body: { ...body, candidates: body.candidates.map((entry) => ({ ...entry, name: hostile, vendor: hostile })) } }
    })
    fireEvent.click(await screen.findByTestId('search-cameras-button-panel'))
    const row = await screen.findByTestId('camera-search-row-CND-000000000001')
    expect(row).toHaveTextContent(hostile)
    expect(row.querySelector('img, b')).toBeNull()
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
  })
})

describe('Simulated mode: gates', { timeout: 30_000 }, () => {
  it('M4-DISC-RBAC-W: without CAPTURE_CONFIG the control is disabled with the role sentence, never hidden, and no list is requested', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.BUDI)
    const request = vi.spyOn(sim, 'request')
    const panel = await screen.findByTestId('camera-search')
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'FORBIDDEN'))
    expect(screen.getByTestId('search-cameras-button-panel')).toBeDisabled()
    expect(screen.getByTestId('search-cameras-reason-panel')).toHaveTextContent(ROLE_SENTENCE)
    expect(screen.getByTestId('search-cameras-button-header')).toBeDisabled()
    fireEvent.click(screen.getByTestId('search-cameras-button-panel'))
    expect(request.mock.calls.filter(([call]) => call.path.startsWith('/api/v1/capture/discovery'))).toHaveLength(0)
    expect(panel.querySelector('table')).toBeNull()
    // G17 follows the same permission.
    expect(screen.getByTestId('search-mics-button-panel')).toBeDisabled()
    expect(screen.getByTestId('search-mics-reason-panel')).toHaveTextContent(ROLE_SENTENCE)
  })

  it('M4-CONN-LOCK-W: with a session open Connect is disabled with its sentence, there is no toast, and the search still works', async () => {
    await mountDevices('recording', OPERATOR_IDS.ANDI)
    const button = await screen.findByTestId('search-cameras-button-panel')
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    const connect = await screen.findByTestId('camera-search-connect-CND-000000000001')
    expect(connect).toBeDisabled()
    expect(screen.getByTestId('camera-search-connect-reason-CND-000000000001')).toHaveTextContent(C.locked)
    fireEvent.click(connect)
    expect(screen.queryByTestId('camera-connect-body')).not.toBeInTheDocument()
    expect(toastTexts()).toEqual([])
  })
})

// Task 4, blueprint row 98 (WP-12; contract `implementation/094_typed_address_contract.md`): the optional `address` of operation 93.
describe('the typed address (task 4 row 98; operation 93 `address`)', { timeout: 30_000 }, () => {
  const T = S.typedAddress
  const DISCOVERY = '/api/v1/capture/discovery'
  type Call = { method: string; path: string; body?: unknown }
  const starts = (spy: { mock: { calls: unknown[][] } }) => (spy.mock.calls as [Call][]).filter(([call]) => call.method === 'POST' && call.path === DISCOVERY)
  const field = () => screen.getByTestId('camera-search-address-input') as HTMLInputElement
  const section = () => screen.getByTestId('camera-search-address')
  const ask = (text: string) => {
    fireEvent.change(field(), { target: { value: text } })
    fireEvent.click(screen.getByTestId('camera-search-address-button'))
  }
  const idle = async () => {
    const panel = await screen.findByTestId('camera-search')
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'IDLE'))
    await waitFor(() => expect(screen.getByTestId('camera-search-address-button')).toBeEnabled())
    return panel
  }

  it('the form rule is the contract\'s: ONE dotted IPv4 literal; a name, a port, a link, an IPv6 text or a number out of range is no address', () => {
    expect(typedAddressOf('192.168.10.20')).toBe('192.168.10.20')
    expect(typedAddressOf('0.0.0.0')).toBe('0.0.0.0')
    expect(typedAddressOf('255.255.255.255')).toBe('255.255.255.255')
    // Blanks around a pasted address are not part of it.
    expect(typedAddressOf('  10.0.0.5 ')).toBe('10.0.0.5')
    for (const text of ['', ' ', '256.1.1.1', '1.2.3', '1.2.3.4.5', '01.2.3.4', '1.2.3.4.', '192.168.1.1:554', '192.168.1.1/24', 'camera.local', 'http://192.168.1.1', 'rtsp://192.168.1.1/stream', '::1', '::ffff:192.168.1.1', '192.168.1.1 192.168.1.2', '1.2.3.4\n5.6.7.8', '192.168.1.٣', '0x7f.0.0.1', '3232238100']) {
      expect(typedAddressOf(text), JSON.stringify(text)).toBeNull()
    }
    // 422 with the reason of the address is its own refusal; any other 422 is not worded as one.
    expect(startRefusal({ status: 422, code: 'INVALID_INPUT', reason: 'DISCOVERY_ADDRESS_NOT_ALLOWED' })).toBe('ADDRESS_NOT_ALLOWED')
    expect(startRefusal({ status: 422, code: 'INVALID_INPUT', reason: null })).toBe('OTHER')
  })

  it('an address outside the allowed form is refused in the form and nothing is sent; an address of the form is sent as the one member and its answer is a candidate like any other', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI)
    const spy = vi.spyOn(sim, 'request')
    const panel = await idle()
    expect(screen.getByTestId('camera-search-address-intro')).toHaveTextContent(T.intro)
    expect(within(section()).getByText(T.hint)).toBeInTheDocument()
    expect(field()).toHaveAccessibleName(T.label)
    expect(screen.getByTestId('camera-search-address-button')).toHaveTextContent(T.action)

    for (const text of ['camera.local', '192.168.1.1:554', '192.168.1.300', 'http://192.168.1.1', '']) {
      ask(text)
      await waitFor(() => expect(section()).toHaveAttribute('data-problem', 'FORM'))
      expect(within(section()).getByText(T.form)).toBeInTheDocument()
      expect(field()).toHaveAttribute('aria-invalid', 'true')
      // Typing again takes the refusal away; the next press decides anew.
      fireEvent.change(field(), { target: { value: `${text}x` } })
      expect(section()).not.toHaveAttribute('data-problem')
    }
    expect(starts(spy)).toHaveLength(0)
    expect(panel).toHaveAttribute('data-state', 'IDLE')
    expect(sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_DISCOVERY_SEARCHED')).toHaveLength(0)

    ask(' 192.168.10.20 ')
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'RESULTS'))
    expect(starts(spy)).toHaveLength(1)
    expect(starts(spy)[0]?.[0].body).toEqual({ address: '192.168.10.20' })
    expect(section()).not.toHaveAttribute('data-problem')
    // What answered at the typed address is a row of the same list, with the same Connect.
    const typed = await screen.findByTestId('camera-search-row-CND-000000000003')
    expect(screen.getByTestId('camera-search-host-CND-000000000003')).toHaveTextContent('192.168.10.20')
    expect(typed).toHaveAttribute('data-kind', 'NEW')
    expect(within(typed).getByTestId('camera-search-connect-CND-000000000003')).toBeEnabled()
    expect(screen.getByTestId('camera-search-summary')).toHaveTextContent('3 found · 2 new · 1 already registered')

    // "Search for cameras" / "Search again" is sent exactly as before: no body, no address.
    fireEvent.click(screen.getByTestId('search-cameras-button-panel'))
    await waitFor(() => expect(starts(spy)).toHaveLength(2))
    expect(starts(spy)[1]?.[0].body).toBeUndefined()
    await waitFor(() => expect(screen.getByTestId('camera-search-summary')).toHaveTextContent('2 found · 1 new · 1 already registered'))
    expect(screen.queryByTestId('camera-search-row-CND-000000000003')).not.toBeInTheDocument()
    expect(toastTexts()).toEqual([])
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('422 DISCOVERY_ADDRESS_NOT_ALLOWED: the Core\'s refusal has its sentence beside the field; the list and its notices stay as they are', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI)
    const spy = vi.spyOn(sim, 'request')
    const panel = await idle()
    // Of the form, and outside the simulator's stand-in of the Core's rule.
    ask('8.8.8.8')
    await waitFor(() => expect(section()).toHaveAttribute('data-problem', 'NOT_ALLOWED'))
    expect(within(section()).getByText(T.notAllowed)).toBeInTheDocument()
    expect(starts(spy)).toHaveLength(1)
    expect(panel).toHaveAttribute('data-state', 'IDLE')
    expect(screen.queryByTestId('camera-search-request-failed')).not.toBeInTheDocument()
    expect(screen.queryByTestId('camera-search-results')).not.toBeInTheDocument()
    expect(sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_DISCOVERY_SEARCHED')).toHaveLength(0)
    expect(toastTexts()).toEqual([])
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('no address is asked while a search runs: disabled with its reason; and a 200 that says "not a new search" is said, never drawn as a search of the address', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI)
    const real = sim.request.bind(sim)
    let running = false
    const runningSearch: CaptureDiscoverySearch = { ...SEARCH, state: 'RUNNING', startedAt: Date.now(), windowMs: 3_000, responderCount: 0, newCount: 0, registeredCount: 0, created: false }
    const spy = vi.spyOn(sim, 'request').mockImplementation((call) => {
      if (call.path !== DISCOVERY) return real(call)
      // The caller's own search is still RUNNING: the Core answers 200 with `created: false` and asks no address.
      if (call.method === 'POST') {
        running = true
        return { ...real({ method: 'GET', path: DISCOVERY }), status: 200, body: runningSearch }
      }
      return running ? { ...real(call), body: stateOf(runningSearch) } : real(call)
    })
    const panel = await idle()
    ask('192.168.10.20')
    expect(await screen.findByTestId('camera-search-address-not-probed')).toHaveTextContent(T.notProbed)
    expect(starts(spy)).toHaveLength(1)
    // The search runs: the control is disabled with its reason, and a press sends nothing.
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'SEARCHING'))
    expect(screen.getByTestId('camera-search-address-button')).toBeDisabled()
    expect(screen.getByTestId('camera-search-address-reason')).toHaveTextContent(T.searching)
    fireEvent.click(screen.getByTestId('camera-search-address-button'))
    fireEvent.submit(screen.getByTestId('camera-search-address-form'))
    expect(starts(spy)).toHaveLength(1)
  })

  it('without CAPTURE_CONFIG the form is drawn disabled with the role sentence, and nothing is sent', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.BUDI)
    const spy = vi.spyOn(sim, 'request')
    const panel = await screen.findByTestId('camera-search')
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'FORBIDDEN'))
    expect(field()).toBeDisabled()
    expect(screen.getByTestId('camera-search-address-button')).toBeDisabled()
    expect(screen.getByTestId('camera-search-address-reason')).toHaveTextContent(ROLE_SENTENCE)
    fireEvent.submit(screen.getByTestId('camera-search-address-form'))
    expect(spy.mock.calls.filter(([call]) => call.path.startsWith(DISCOVERY))).toHaveLength(0)
  })

  it('a registered camera that answers from another address is SAID, never followed: the row has no control that re-addresses it, and nothing but the search is sent', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI)
    const real = sim.request.bind(sim)
    const spy = vi.spyOn(sim, 'request').mockImplementation((call) => {
      const response = real(call)
      if (call.method !== 'GET' || call.path !== DISCOVERY) return response
      const body = response.body as CaptureDiscoveryStateBody
      return { ...response, body: { ...body, candidates: body.candidates.map((entry) => (entry.status === 'REGISTERED' ? { ...entry, addressChanged: true, host: '192.168.10.77' } : entry)) } }
    })
    fireEvent.click(await screen.findByTestId('search-cameras-button-panel'))
    const row = await screen.findByTestId('camera-search-row-CND-000000000002')
    expect(row).toHaveTextContent(S.addressChanged)
    expect(row).toHaveTextContent('CAM-01 · Camera 1')
    // The one action of a registered row is "View device". No confirmation dialog exists: the contract has no operation for a re-address yet.
    const actions = within(row).getAllByRole('button')
    expect(actions).toHaveLength(1)
    expect(actions[0]).toHaveTextContent(S.viewDevice)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // The registry still holds the address it held: the search changed nothing.
    const before = sim.store.getState().captureDevices.devices.find((device) => device.id === 'CAM-01')
    fireEvent.click(actions[0]!)
    expect(sim.store.getState().captureDevices.devices.find((device) => device.id === 'CAM-01')).toEqual(before)
    const sent = (spy.mock.calls as [Call][]).filter(([call]) => call.method === 'POST' && call.path.startsWith('/api/v1/capture/'))
    expect(sent.map(([call]) => call.path)).toEqual([DISCOVERY])
  })
})
