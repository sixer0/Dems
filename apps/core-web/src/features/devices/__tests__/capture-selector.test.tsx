// Task 3 M4, blueprint row 67: the capture device selector of Devices & Inputs
// (`masterplan/08_client_ux_spec.md` §2 flow 1, §11; `masterplan/03_api_contract.md` ops 76-80;
// `masterplan/10_test_strategy.md` M4-PC-1, and the client half of M4-SEL-W / M4-LOCK-1).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | M4-PC-1 unit inventory: G1-G3 go `Checking → allowed` or `Checking → refused with its reason`; G9 is offered only for a LOST stream, then Checking, role, recording | "the gates" |
// | ux §2.5: the read states (waiting for the link, loading, 403, 503 NOT_READY, another failure, ready) | "the read" |
// | ux §2.7 / WB-11: a republished slice refreshes an entry a gated read filled, and never creates one | "applyCaptureSlice" |
// | ux §2.2 step 6: the refusals a field words itself | "selectorRefusal" |
// | R-1 AC-1 in the simulator (OD-17): one edit writes exactly ONE `CAPTURE_CONFIG_CHANGED` row with the permission and the changed fields | "Simulated mode: an edit" |
// | PE-127-07: an added `CAM-NN` is selectable | "Simulated mode: an edit" |
// | OD-10: a role without `CAPTURE_CONFIG` sees the control disabled with the role sentence, never hidden | "Simulated mode: refusals" |
// | OD-10 / M4-LOCK-1 client half: with a session open the banner and the locked sentence show, the controls are disabled, and no audit row is written | "Simulated mode: refusals" |
// | ux §2.5: an empty registry shows the empty state; its slot holds the one search control of row 137 | "Simulated mode: refusals" |
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type ScenarioName, type Sim } from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { applyCaptureSlice, CoreReadError } from '@/lib/core-queries'
import { createAppRouter } from '@/router'
import { CORE_QUERY_KEYS } from '@/runtime'
import { poeCycleGate, rolesHolding, selectorEditGate, selectorRead, selectorRefusal, type CaptureConfig, type CaptureDevices, type SelectorFailure } from '../capture-selector'

const S = en.devices.selector
const CONFIG: CaptureConfig = {
  cameras: [
    { trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_1080P25', online: true, streamState: 'LIVE' },
    { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_1080P25', online: true, streamState: 'LIVE' },
  ],
  // D61 (2026-11-04): the microphone lines are keyed by channel (the role member is superseded).
  mics: [
    { channel: 'MIC-01', inputId: 'MIC-01', deviceId: 'MIC-01', transport: 'USB', online: true },
    { channel: 'MIC-02', inputId: 'MIC-02', deviceId: 'MIC-02', transport: 'USB', online: true },
  ],
  locked: false,
  updatedAt: 1,
}
const DEVICES: CaptureDevices = { devices: [] }
const failed = (status: number | null, code: string) =>
  new CoreReadError('getCaptureConfig', status === null ? null : ({ ok: false, status, error: { code, message: '' } } as never))

describe('the gates (M4-PC-1; ux §2.4, §11: G1-G3 and G9)', () => {
  it('G1-G3: Checking until resolved, then allowed, or refused with its reason — never an instant enable', () => {
    // Negative control of the inventory: while unresolved, a held permission and an idle Core do NOT enable.
    expect(selectorEditGate({ resolved: false, can: true, locked: false })).toEqual({ kind: 'CHECKING' })
    expect(selectorEditGate({ resolved: true, can: true, locked: false })).toBeNull()
    // CAPTURE_CONFIG revoked from SUPERVISOR 2026-10-29 (0034): rolesHolding names TECHNICIAN only.
    expect(selectorEditGate({ resolved: true, can: false, locked: false })).toEqual({ kind: 'ROLE', roles: ['TECHNICIAN'] })
    expect(selectorEditGate({ resolved: true, can: true, locked: true })).toEqual({ kind: 'LOCKED' })
    // The role is the lasting reason: it is said before the lock.
    expect(selectorEditGate({ resolved: true, can: false, locked: true })).toMatchObject({ kind: 'ROLE' })
    expect(rolesHolding('CAPTURE_CONFIG')).toEqual(['TECHNICIAN'])
  })

  it('G9: the PoE cycle is offered only for a LOST stream; then Checking, the role, a recording, a command out', () => {
    const base = { lost: true, resolved: true, canManage: true, recording: false, busy: false }
    expect(poeCycleGate({ ...base, lost: false })).toEqual({ offered: false })
    expect(poeCycleGate(base)).toEqual({ offered: true, block: null })
    expect(poeCycleGate({ ...base, resolved: false })).toEqual({ offered: true, block: { kind: 'CHECKING' } })
    expect(poeCycleGate({ ...base, canManage: false })).toMatchObject({ offered: true, block: { kind: 'ROLE', permission: 'DEVICE_MANAGE' } })
    expect(poeCycleGate({ ...base, recording: true })).toEqual({ offered: true, block: { kind: 'RECORDING' } })
    expect(poeCycleGate({ ...base, busy: true })).toEqual({ offered: true, block: { kind: 'BUSY' } })
  })
})

describe('the read (ux §2.5)', () => {
  const ok = { config: { data: CONFIG, error: null }, devices: { data: DEVICES, error: null } }
  it('waits for the link, loads, and is ready only when both reads answered', () => {
    expect(selectorRead({ open: false, ...ok })).toEqual({ kind: 'WAITING' })
    expect(selectorRead({ open: true, config: { data: undefined, error: null }, devices: ok.devices })).toEqual({ kind: 'LOADING' })
    expect(selectorRead({ open: true, config: ok.config, devices: { data: undefined, error: null } })).toEqual({ kind: 'LOADING' })
    expect(selectorRead({ open: true, ...ok })).toEqual({ kind: 'READY', config: CONFIG, devices: DEVICES })
  })

  it('a 403 is forbidden, a 503 NOT_READY is "not ready", anything else failed; a failure wins over data held from before', () => {
    expect(selectorRead({ open: true, config: { data: CONFIG, error: failed(403, 'NOT_PERMITTED') }, devices: ok.devices })).toEqual({ kind: 'FORBIDDEN' })
    expect(selectorRead({ open: true, config: ok.config, devices: { data: DEVICES, error: failed(503, 'NOT_READY') } })).toEqual({ kind: 'NOT_READY' })
    expect(selectorRead({ open: true, config: { data: undefined, error: failed(404, 'NOT_FOUND') }, devices: ok.devices })).toEqual({ kind: 'FAILED' })
    expect(selectorRead({ open: true, config: { data: undefined, error: failed(null, '') }, devices: ok.devices })).toEqual({ kind: 'FAILED' })
  })
})

describe('applyCaptureSlice (WB-11; ux §2.7)', () => {
  it('refreshes an entry a gated read filled, and creates none for a reader that never read or was refused', () => {
    const queryClient = new QueryClient()
    const next = { ...CONFIG, locked: true, updatedAt: 2 }
    // Never read: a republish opens nothing.
    applyCaptureSlice(queryClient, CORE_QUERY_KEYS.captureConfig, next)
    expect(queryClient.getQueryData(CORE_QUERY_KEYS.captureConfig)).toBeUndefined()
    // Read before: the republished slice is the entry.
    queryClient.setQueryData(CORE_QUERY_KEYS.captureConfig, CONFIG)
    applyCaptureSlice(queryClient, CORE_QUERY_KEYS.captureConfig, next)
    expect(queryClient.getQueryData(CORE_QUERY_KEYS.captureConfig)).toEqual(next)
    // The other key is untouched.
    expect(queryClient.getQueryData(CORE_QUERY_KEYS.captureDevices)).toBeUndefined()
  })
})

describe('selectorRefusal (ux §2.2 step 6, §2.5)', () => {
  const refusal = (status: number | null, code: string, reason: string | null = null): SelectorFailure => ({
    ok: false,
    operationId: 'setCaptureCameraSource',
    status,
    code,
    reason,
    failure: null,
  })
  it('names the refusals a field words itself and leaves the rest to the presenter', () => {
    expect(selectorRefusal(refusal(409, 'CAPTURE_CONFIG_LOCKED'))).toBe('LOCKED')
    expect(selectorRefusal(refusal(422, 'INVALID_INPUT'))).toBe('INVALID')
    expect(selectorRefusal(refusal(422, 'INVALID_INPUT', 'DEVELOPMENT_SOURCE_NOT_ALLOWED'))).toBe('DEVELOPMENT_ONLY')
    expect(selectorRefusal(refusal(404, 'NOT_FOUND'))).toBe('UNKNOWN_DEVICE')
    expect(selectorRefusal(refusal(409, 'CAMERA_NOT_LOST'))).toBe('NOT_LOST')
    expect(selectorRefusal(refusal(409, 'RECORDING_ACTIVE'))).toBe('RECORDING')
    for (const [status, code] of [[403, 'NOT_PERMITTED'], [503, 'NOT_READY'], [null, 'CORE_OFFLINE'], [409, 'INVALID_STATE']] as const) {
      expect(selectorRefusal(refusal(status, code))).toBe('OTHER')
    }
  })
})

// ── The page in Simulated mode ───────────────────────────────────────────────────────────
// The edit mounts are the TECHNICIAN (RINA): CAPTURE_CONFIG revoked from SUPERVISOR 2026-10-29
// (0034), so only a technician now reaches the control surface; the refusal test keeps a non-holder.

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

async function mountDevices(scenario: ScenarioName, operatorId: string, prepare?: (sim: Sim) => void) {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: Date.now() })
  const sim = createSim({ scenario, storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  prepare?.(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/devices'] }) })
  render(<RouterProvider router={router} />)
  await screen.findByTestId('page-devices', undefined, { timeout: 8_000 })
  const panel = await screen.findByTestId('panel-selector')
  return { sim, panel }
}

const captureAudit = (sim: Sim) => sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED')

const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  Element.prototype.scrollTo ??= function scrollTo() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
  Element.prototype.getAnimations ??= function getAnimations() {
    return []
  }
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

describe('Simulated mode: an edit (R-1 AC-1 in the simulator; PE-127-07)', { timeout: 30_000 }, () => {
  it('the selector shows two camera lines and two microphone lines as text, with 0 missing keys and no search control', async () => {
    const { panel } = await mountDevices('idle', OPERATOR_IDS.RINA)
    expect(panel).toHaveAttribute('id', 'capture-selector')
    const ready = within(panel).getByTestId('selector-ready')
    expect(ready).toHaveAttribute('data-locked', 'false')
    expect(within(panel).getByTestId('selector-camera-VIDEO-01')).toHaveAttribute('data-device', 'CAM-01')
    expect(within(panel).getByTestId('selector-camera-VIDEO-02')).toHaveAttribute('data-device', 'CAM-02')
    expect(within(panel).getByTestId('selector-role-MIC-01')).toHaveTextContent(S.role.PRIMARY)
    expect(within(panel).getByTestId('selector-role-MIC-02')).toHaveTextContent(S.role.STANDBY)
    // OD-12: state as text, no picture of a camera inside the selector.
    expect(within(panel).getByTestId('selector-camera-VIDEO-01')).toHaveTextContent(S.stream.LIVE)
    expect(panel.querySelector('video, canvas, img')).toBeNull()
    expect(within(panel).getByTestId('selector-no-preview')).toHaveTextContent(S.noPreview)
    // Row 137 builds the search entry; nothing of it is here.
    expect(panel.textContent ?? '').not.toMatch(/search/i)
    // Allowed and idle: no reason sentence, Save waits for a different choice.
    expect(within(panel).queryByTestId('selector-reason-VIDEO-01')).not.toBeInTheDocument()
    expect(within(panel).getByTestId('selector-save-VIDEO-01')).toBeDisabled()
    expect(within(panel).getByTestId('selector-primary-MIC-02')).toBeEnabled()
    expect(getMissingI18nKeys()).toEqual([])
  })

  // D60 (2026-11-04): CAM-03/CAM-04 are built-ins of the four tracks; the added camera is CAM-05.
  it('assigning an added CAM-05 to VIDEO-01 writes exactly one CAPTURE_CONFIG_CHANGED row with the permission and the changed fields', async () => {
    const { sim, panel } = await mountDevices('idle', OPERATOR_IDS.RINA, (created) => {
      const state = created.store.getState()
      created.store.setState({
        captureDevices: { devices: [...state.captureDevices.devices, { ...state.captureDevices.devices[0]!, id: 'CAM-05', model: 'Added camera', host: '127.0.0.1:8559' }] }, // D60: an added camera is minted above the four built-ins
      })
    })
    expect(captureAudit(sim)).toHaveLength(0)
    fireEvent.click(within(within(panel).getByTestId('selector-source-VIDEO-01')).getByRole('button'))
    fireEvent.click(await screen.findByRole('option', { name: /CAM-05/ })) // D60: the added camera
    const save = within(panel).getByTestId('selector-save-VIDEO-01')
    await waitFor(() => expect(save).toBeEnabled())
    // Not optimistic: the line still names the Core's device until the answer.
    expect(within(panel).getByTestId('selector-camera-VIDEO-01')).toHaveAttribute('data-device', 'CAM-01')
    fireEvent.click(save)
    await waitFor(() => expect(within(panel).getByTestId('selector-camera-VIDEO-01')).toHaveAttribute('data-device', 'CAM-05')) // D60
    const rows = captureAudit(sim)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.details).toMatchObject({ operationId: 'setCaptureCameraSource', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-01', deviceId: 'CAM-05', from: 'CAM-01', to: 'CAM-05' }) // D60
    expect(sim.store.getState().captureConfig.cameras[0]).toMatchObject({ trackId: 'VIDEO-01', deviceId: 'CAM-05' }) // D60
    await waitFor(() => expect(save).toBeDisabled())
  })

  it('"Make primary" on the standby input swaps the roles in one republish and writes one row', async () => {
    const { sim, panel } = await mountDevices('idle', OPERATOR_IDS.RINA)
    fireEvent.click(within(panel).getByTestId('selector-primary-MIC-02'))
    await waitFor(() => expect(within(panel).getByTestId('selector-role-MIC-02')).toHaveTextContent(S.role.PRIMARY))
    expect(within(panel).getByTestId('selector-role-MIC-01')).toHaveTextContent(S.role.STANDBY)
    expect(within(panel).queryByTestId('selector-primary-MIC-02')).not.toBeInTheDocument()
    expect(within(panel).getByTestId('selector-primary-MIC-01')).toBeEnabled()
    const rows = captureAudit(sim)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.details).toMatchObject({ operationId: 'setPrimaryMic', scope: 'MIC', field: 'CHANNEL', inputId: 'MIC-02', from: 'MIC-02', to: 'MIC-01' }) // D61 (2026-11-04): the swap moves channels
  })
})

describe('Simulated mode: refusals (OD-10; ux §2.4, §2.5)', { timeout: 30_000 }, () => {
  it('a role without CAPTURE_CONFIG reads the selector; every edit control is disabled with the role sentence, none is hidden', async () => {
    const { sim, panel } = await mountDevices('idle', OPERATOR_IDS.BUDI)
    const sentence = en.common.rbac.requiresRole.replace('{{role}}', 'TECHNICIAN') // 0034: revoked from SUPERVISOR 2026-10-29; TECHNICIAN holds it alone
    expect(within(panel).getByTestId('selector-camera-VIDEO-01')).toHaveAttribute('data-device', 'CAM-01')
    for (const id of ['VIDEO-01', 'VIDEO-02', 'MIC-02']) {
      expect(within(panel).getByTestId(`selector-reason-${id}`)).toHaveTextContent(sentence)
      expect(within(panel).getByTestId(`selector-reason-${id}`)).toHaveAttribute('data-block', 'ROLE')
    }
    expect(within(within(panel).getByTestId('selector-source-VIDEO-01')).getByRole('button')).toBeDisabled()
    expect(within(panel).getByTestId('selector-save-VIDEO-01')).toBeDisabled()
    expect(within(panel).getByTestId('selector-primary-MIC-02')).toBeDisabled()
    fireEvent.click(within(panel).getByTestId('selector-primary-MIC-02'))
    expect(captureAudit(sim)).toHaveLength(0)
    expect(sim.store.getState().captureConfig.mics[0]).toMatchObject({ inputId: 'MIC-01', channel: 'MIC-01' }) // D61: a line states its channel
  })

  it('with a session open the locked banner and sentence show, the controls are disabled, and nothing is written', async () => {
    // Mounted as the TECHNICIAN: the lock is said only by a holder of CAPTURE_CONFIG, revoked from SUPERVISOR 2026-10-29 (0034).
    const { sim, panel } = await mountDevices('recording', OPERATOR_IDS.RINA)
    expect(within(panel).getByTestId('selector-ready')).toHaveAttribute('data-locked', 'true')
    expect(within(panel).getByTestId('selector-locked')).toHaveTextContent(S.locked)
    expect(within(panel).getByTestId('selector-reason-VIDEO-01')).toHaveAttribute('data-block', 'LOCKED')
    expect(within(panel).getByTestId('selector-reason-MIC-02')).toHaveTextContent(S.locked)
    expect(within(panel).getByTestId('selector-save-VIDEO-01')).toBeDisabled()
    expect(within(panel).getByTestId('selector-primary-MIC-02')).toBeDisabled()
    fireEvent.click(within(panel).getByTestId('selector-primary-MIC-02'))
    expect(captureAudit(sim)).toHaveLength(0)
  })

  it('G9: a LOST camera line offers the PoE cycle; a role without DEVICE_MANAGE sees it disabled with its reason; a LIVE line has none', async () => {
    const { panel } = await mountDevices('idle', OPERATOR_IDS.ANDI, (created) => {
      const config = created.store.getState().captureConfig
      created.store.setState({
        captureConfig: { ...config, cameras: config.cameras.map((line) => (line.trackId === 'VIDEO-02' ? { ...line, online: false, streamState: 'LOST' } : line)) },
      })
    })
    expect(within(panel).queryByTestId('selector-poe-VIDEO-01')).not.toBeInTheDocument()
    expect(within(panel).getByTestId('selector-camera-VIDEO-02')).toHaveTextContent(S.stream.LOST)
    // The seeded SUPERVISOR does not hold DEVICE_MANAGE (the TECHNICIAN does).
    expect(within(panel).getByTestId('selector-poe-VIDEO-02')).toBeDisabled()
    expect(within(panel).getByTestId('selector-poe-reason-VIDEO-02')).toHaveTextContent(en.common.rbac.requiresRole.replace('{{role}}', en.common.roles.TECHNICIAN))
  })

  // Blueprint row 137 fills the slot row 67 left: the page's ONE camera search (G13). The selector still has no control of its own.
  it('an empty registry shows the empty state, and the marked slot holds the one "Search for cameras" of row 137', async () => {
    // Mounted as the TECHNICIAN: the search entry is gated by CAPTURE_CONFIG, revoked from SUPERVISOR 2026-10-29 (0034).
    const { panel } = await mountDevices('idle', OPERATOR_IDS.RINA, (created) => {
      created.store.setState({ captureDevices: { devices: [] }, captureConfig: { cameras: [], mics: [], locked: false, updatedAt: 0 } })
    })
    const empty = within(panel).getByTestId('selector-empty')
    expect(empty).toHaveTextContent(S.empty)
    const slot = within(empty).getByTestId('selector-search-slot')
    expect(slot).toHaveAttribute('data-slot', 'camera-search-entry')
    expect(within(empty).getAllByRole('button')).toHaveLength(1)
    expect(within(slot).getByRole('button', { name: en.common.captureSearch.action })).toBeEnabled()
  })
})
