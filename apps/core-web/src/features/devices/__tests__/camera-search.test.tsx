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
