// Task 3 R-10 / R-11, blueprint row 137: the no-device notifications, "Search again" for microphones,
// the local-device row states and the pre-check row of an unreachable source
// (`masterplan/08_client_ux_spec.md` §8e flow 11, §8f.3, §8g flow 13; C3 §2.6 op 97, §5.4; D83, D114).
//
// | Check | Where |
// |-------|-------|
// | Notices are read from the Core's alerts by `params.reason`; a member that does not fit is dropped; the text names the device by label and id and carries no address | "the notices" |
// | M4-DISC-EMPTY-W / M4-NODEV-B-W (component half): one strip item per alert with "Search again"; when the Core resolves the alert the item is gone (0 stale banners); a role without CAPTURE_CONFIG sees it with the control disabled | "the strip" |
// | D114: an unreachable pre-check item is worded from `params.rule`, never as a lens fault or "no signal"; the active-microphone sentence names the cancel → Devices → start again path | "the pre-check" |
// | M4-MIC-ACTIVE-W (component half): the active microphone unreachable blocks, with its sentence, and no control at pre-check switches a microphone | "the pre-check" |
// | M4-MIC-RESCAN-W (component half): one request, a per-microphone result, "Checked at"; no candidate list | "Search again for microphones" |
// | M4-DEVSRC-LOCAL: ready, permission needed, in use, not found, could not be opened — each with its chip and sentence; the row keeps its name | "local-device states" |
// | R-11: the badge only from a `sourceClass` the Core sent; absent = no badge | "the badge rule" |
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { OPERATOR_IDS, type SimAlert } from '@dems/shared/sim'
import { reasonKeyFor } from '@/features/session-new/model'
import { i18n } from '@/i18n'
import { activeCaptureNotices, captureNoticeLine, captureNoticeOf, captureNoticeText, unreachablePrecheckOf, unreachablePrecheckText } from '@/lib/capture-notices'
import { LOCAL_STATE_VIEW, localDeviceState, localStateSentenceKey, rescanGate, rescanRefusal } from '../capture-inputs'
import { isDevelopmentSource, isLocalSourceOn, sourceKindKey } from '../source-class'
import { installDevicesBed, mountDevices, toastTexts } from './search-bed'

const t = i18n.t.bind(i18n)
const N = en.common.captureNotice
const ROLE_SENTENCE = en.common.rbac.requiresRole.replace('{{role}}', 'TECHNICIAN') // REVOKED 2026-10-29 (0034): CAPTURE_CONFIG is TECHNICIAN-only
const alert = (id: string, params: SimAlert['params'], over: Partial<SimAlert> = {}): SimAlert => ({
  id,
  at: 1,
  severity: 'WARNING',
  kind: 'SYSTEM',
  message: 'core text',
  active: true,
  acknowledged: false,
  resolvedAt: null,
  target: null,
  params,
  ...over,
})
const EMPTY = alert('ALR-1', { reason: 'CAPTURE_DISCOVERY_EMPTY', searchId: 'DSC-000001', trigger: 'MANUAL' })
const CAM2 = alert('ALR-2', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE', searchResponderCount: 0 })
const MIC1 = alert('ALR-3', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'MIC-01', deviceKind: 'MIC', phase: 'PRECHECK', cause: 'PERMISSION_DENIED' })

describe('the notices (ux §8e.1; C3 §5.4)', () => {
  it('are told apart by params.reason; anything else is no notice; a member that does not fit is dropped', () => {
    expect(captureNoticeOf(EMPTY)).toEqual({ kind: 'DISCOVERY_EMPTY', alertId: 'ALR-1' })
    expect(captureNoticeOf(CAM2)).toMatchObject({ kind: 'UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE', searchResponderCount: 0 })
    expect(captureNoticeOf(alert('ALR-4', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: '10.0.0.5/admin', deviceKind: 'CAMERA' }))).toBeNull()
    expect(captureNoticeOf(alert('ALR-5', { reason: 'CAPTURE_DISCOVERY_EMPTY' }, { kind: 'CAPTURE_FAULT' as SimAlert['kind'] }))).toBeNull()
    expect(captureNoticeOf(alert('ALR-6', { reason: 'SOMETHING_ELSE' }))).toBeNull()
    expect(captureNoticeOf(alert('ALR-7', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-01', deviceKind: 'CAMERA', cause: '<b>x</b>', searchResponderCount: 'many' }))).toMatchObject({ cause: 'UNREACHABLE', searchResponderCount: null })
    expect(activeCaptureNotices([EMPTY, { ...CAM2, active: false }, MIC1]).map((notice) => notice.alertId)).toEqual(['ALR-1', 'ALR-3'])
  })

  it('the text names the device by label and id, says the count of the one search, and never uses the alert\'s own text', () => {
    expect(captureNoticeText(t, captureNoticeOf(EMPTY)!)).toEqual({ title: N.discoveryEmpty.title, body: N.discoveryEmpty.body })
    const camera = captureNoticeText(t, captureNoticeOf(CAM2)!)
    expect(camera.title).toBe('Camera 2 (CAM-02) is not reachable')
    expect(camera.body).toBe('It did not answer the pre-check. A search found 0 cameras.')
    const mic = captureNoticeText(t, captureNoticeOf(MIC1)!)
    expect(mic.title).toBe('MIC 1 (MIC-01) is not reachable')
    expect(mic.body).toContain(en.common.localDevice.permissionMicrophone)
    // An added camera has no label: it is named by its id alone.
    expect(captureNoticeText(t, captureNoticeOf(alert('ALR-8', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-03', deviceKind: 'CAMERA', phase: 'PRECHECK' }))!).title).toBe('CAM-03 is not reachable')
    expect(captureNoticeLine(t, captureNoticeOf(CAM2)!)).not.toContain('core text')
  })
})

describe('the pre-check (ux §8g.3; D83, D114)', () => {
  const item = (rule: string, status: 'WARN' | 'BLOCK', deviceId: string, deviceKind: string, other?: string) => ({
    id: 'MIC_PRIMARY' as const,
    status,
    value: 'UNREACHABLE',
    reasonCode: null,
    params: { deviceId, deviceKind, rule, ...(other === undefined ? {} : { other }) },
  })
  it('an unreachable source is read from params.rule and has NO reason of the old table (no lens fault, no "no signal")', () => {
    const active = item('activeMicrophone', 'BLOCK', 'MIC-01', 'MIC', 'MIC-02')
    expect(reasonKeyFor(active)).toBeNull()
    expect(reasonKeyFor({ id: 'LENS_2', status: 'WARN', value: 'UNREACHABLE', reasonCode: null })).toBeNull()
    // Negative control: a lens fault is still a lens fault.
    expect(reasonKeyFor({ id: 'LENS_2', status: 'BLOCK', value: 'FAULT' })).toBe('lensFault')
    expect(unreachablePrecheckOf(active)).toEqual({ rule: 'activeMicrophone', deviceId: 'MIC-01', deviceKind: 'MIC', otherDeviceId: 'MIC-02' })
    expect(unreachablePrecheckOf({ ...active, status: 'PASS' })).toBeNull()
    expect(unreachablePrecheckOf({ ...active, params: { ...active.params, rule: 'madeUp' } })).toBeNull()
  })

  it('each rule has its sentence; the active microphone names the cancel → Devices → start again path', () => {
    const text = (rule: string, deviceId: string, kind: string, other?: string) => unreachablePrecheckText(t, unreachablePrecheckOf(item(rule, 'BLOCK', deviceId, kind, other))!)
    expect(text('noCamera', 'CAM-01', 'CAMERA')).toBe(N.start.noCamera)
    expect(text('oneCamera', 'CAM-02', 'CAMERA')).toBe('Camera 2 (CAM-02) is not reachable. The session will record one camera only.')
    expect(text('noMicrophone', 'MIC-01', 'MIC')).toBe(N.start.noMicrophone)
    expect(text('noStandby', 'MIC-02', 'MIC')).toBe('MIC 2 (MIC-02) is not reachable. The session will record with no standby microphone.')
    expect(text('activeMicrophone', 'MIC-01', 'MIC', 'MIC-02')).toBe(
      'MIC 1 (MIC-01) is the active microphone and is not reachable. Cancel this session, make MIC 2 (MIC-02) the primary microphone on Devices, then start again.',
    )
  })
})

describe('local-device states (M4-DEVSRC-LOCAL; ux §8f.3) and the badge rule (R-11)', () => {
  it('each named cause is its own state, chip and sentence; a cause wins over "present"', () => {
    expect(localDeviceState({ present: true, errorCode: null })).toBe('READY')
    expect(localDeviceState({ present: false, errorCode: null })).toBe('NOT_REACHABLE')
    expect(localDeviceState({ present: false, errorCode: 'PERMISSION_DENIED' })).toBe('PERMISSION_DENIED')
    expect(localDeviceState({ present: true, errorCode: 'DEVICE_BUSY' })).toBe('DEVICE_BUSY')
    expect(localDeviceState({ present: false, errorCode: 'DEVICE_NOT_FOUND' })).toBe('DEVICE_NOT_FOUND')
    expect(localDeviceState({ present: false, errorCode: 'OPEN_FAILED' })).toBe('OPEN_FAILED')
    expect(localDeviceState({ present: false, errorCode: 'HELPER_EXITED' })).toBe('OPEN_FAILED')
    expect(t(LOCAL_STATE_VIEW.PERMISSION_DENIED.chip)).toBe('Permission needed')
    expect(t(LOCAL_STATE_VIEW.DEVICE_BUSY.chip)).toBe('In use')
    expect(t(LOCAL_STATE_VIEW.DEVICE_NOT_FOUND.chip)).toBe('Not found')
    expect(t(LOCAL_STATE_VIEW.OPEN_FAILED.chip)).toBe('Could not be opened')
    expect(localStateSentenceKey('READY', 'MIC')).toBeNull()
    expect(t(localStateSentenceKey('PERMISSION_DENIED', 'CAMERA')!)).toContain('Privacy & Security > Camera')
    expect(t(localStateSentenceKey('PERMISSION_DENIED', 'MIC')!)).toContain('Privacy & Security > Microphone')
    expect(t(localStateSentenceKey('DEVICE_BUSY', 'MIC')!)).toBe(en.common.localDevice.busyMicrophone)
    expect(t(localStateSentenceKey('DEVICE_NOT_FOUND', 'CAMERA')!)).toBe(en.common.localDevice.notFoundCamera)
  })

  it('the badge is decided by the Core\'s sourceClass alone: absent = no badge; no rule of the console\'s own', () => {
    expect(isDevelopmentSource({ sourceClass: 'DEVELOPMENT' })).toBe(true)
    expect(isDevelopmentSource({ sourceClass: 'PRODUCTION' })).toBe(false)
    expect(isDevelopmentSource({})).toBe(false)
    expect(isDevelopmentSource(undefined)).toBe(false)
    expect(sourceKindKey('LOCAL_DEVICE', 'CAMERA')).toBe('common.sourceClass.kind.localCamera')
    expect(sourceKindKey('LOCAL_DEVICE', 'MIC')).toBe('common.sourceClass.kind.localMicrophone')
    expect(sourceKindKey('FAKE', 'CAMERA')).toBe('common.sourceClass.kind.test')
    expect(sourceKindKey(undefined, 'CAMERA')).toBeNull()
    const device = { id: 'CAM-04', kind: 'CAMERA', adapter: 'LOCAL_DEVICE' } as never
    expect(isLocalSourceOn({ ...(device as object), sourceOpen: true } as never)).toBe(true)
    expect(isLocalSourceOn(device)).toBe(false)
    expect(isLocalSourceOn({ ...(device as object), adapter: 'FAKE', sourceOpen: true } as never)).toBe(false)
  })

  it('G17: Checking, the role, and the Core\'s own seconds after a rate limit; what a refused re-read is', () => {
    expect(rescanGate({ resolved: false, can: true, limitedSeconds: null })).toEqual({ kind: 'CHECKING' })
    expect(rescanGate({ resolved: true, can: false, limitedSeconds: null })).toMatchObject({ kind: 'ROLE' })
    expect(rescanGate({ resolved: true, can: true, limitedSeconds: 5 })).toEqual({ kind: 'LIMITED', seconds: 5 })
    expect(rescanGate({ resolved: true, can: true, limitedSeconds: null })).toBeNull()
    expect(rescanRefusal({ status: 429, reason: 'INPUT_RESCAN_RATE_LIMITED' })).toBe('LIMITED')
    expect(rescanRefusal({ status: 503, reason: 'CAPTURE_NOT_READY' })).toBe('NOT_READY')
    expect(rescanRefusal({ status: 403, reason: null })).toBe('ROLE')
  })
})

installDevicesBed()

describe('the strip on Devices & Inputs (ux §8e.2 A and B; R-10 AC-5)', { timeout: 30_000 }, () => {
  it('one item per alert the Core raised, each with "Search again"; gone when the Core resolved it', async () => {
    // REVOKED 2026-10-29 (0034): the test presses "Search again" and asks for the search's audit
    // row — the control surface needs CAPTURE_CONFIG, which only TECHNICIAN holds now.
    const { sim } = await mountDevices('idle', OPERATOR_IDS.RINA)
    expect(screen.queryByTestId('capture-notices')).not.toBeInTheDocument()
    sim.store.setState({ alerts: [...sim.store.getState().alerts, EMPTY, CAM2, MIC1] })
    const strip = await screen.findByTestId('capture-notices')
    expect(strip).toHaveAttribute('role', 'status')
    expect(within(strip).getAllByRole('button')).toHaveLength(3)
    expect(screen.getByTestId('capture-notice-ALR-1')).toHaveTextContent(N.discoveryEmpty.title)
    expect(screen.getByTestId('capture-notice-ALR-2')).toHaveTextContent('Camera 2 (CAM-02) is not reachable')
    // The camera notices search for cameras; the microphone notice re-reads the local inputs.
    expect(within(screen.getByTestId('capture-notice-ALR-2')).getByRole('button')).toHaveTextContent(en.common.captureSearch.again)
    expect(within(screen.getByTestId('capture-notice-ALR-3')).getByRole('button')).toHaveAccessibleName(en.common.captureInputs.againLabel)
    // The device rows: "Not reachable" for the camera, the named state for the microphone.
    expect(screen.getByTestId('unreachable-VIDEO-02')).toHaveAttribute('data-state', 'NOT_REACHABLE')
    expect(screen.getByTestId('unreachable-MIC-01')).toHaveTextContent('Permission needed')
    expect(strip.textContent ?? '').not.toMatch(/\d+\.\d+\.\d+\.\d+/)
    // Search again from the empty-search notice is one search.
    fireEvent.click(within(screen.getByTestId('capture-notice-ALR-1')).getByRole('button'))
    await waitFor(() => expect(sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_DISCOVERY_SEARCHED')).toHaveLength(1))
    // The Core resolves two of them: 0 stale items, and nothing here hid one by itself.
    expect(screen.getByTestId('capture-notice-ALR-1')).toBeInTheDocument()
    sim.store.setState({ alerts: sim.store.getState().alerts.map((entry) => (entry.id === 'ALR-1' || entry.id === 'ALR-2' ? { ...entry, active: false, resolvedAt: 2 } : entry)) })
    await waitFor(() => expect(screen.queryByTestId('capture-notice-ALR-1')).not.toBeInTheDocument())
    expect(screen.queryByTestId('capture-notice-ALR-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('unreachable-VIDEO-02')).not.toBeInTheDocument()
    expect(screen.getByTestId('capture-notice-ALR-3')).toBeInTheDocument()
    expect(toastTexts()).toEqual([])
  })

  it('a role without CAPTURE_CONFIG sees the same notices, with "Search again" disabled and its reason', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.BUDI)
    sim.store.setState({ alerts: [...sim.store.getState().alerts, EMPTY] })
    const notice = await screen.findByTestId('capture-notice-ALR-1')
    expect(within(notice).getByRole('button')).toBeDisabled()
    expect(notice).toHaveTextContent(ROLE_SENTENCE)
  })
})

describe('Search again for microphones (ux §8g; op 97)', { timeout: 30_000 }, () => {
  it('one request, each registered microphone as found, "Checked at"; no list of anything to connect', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.RINA, (created) => {
      const state = created.store.getState()
      created.store.setState({ captureDevices: { devices: state.captureDevices.devices.map((device) => (device.id === 'MIC-02' ? { ...device, online: false } : device)) } })
    })
    const request = vi.spyOn(sim, 'request')
    const block = await screen.findByTestId('mic-rescan')
    expect(within(block).getByTestId('mic-rescan-description')).toHaveTextContent(en.common.captureInputs.description)
    expect(screen.queryByTestId('mic-rescan-result')).not.toBeInTheDocument()
    const button = screen.getByTestId('search-mics-button-panel')
    expect(button).toHaveTextContent(en.common.captureSearch.again)
    expect(button).toHaveAccessibleName(en.common.captureInputs.againLabel)
    fireEvent.click(button)
    await screen.findByTestId('mic-rescan-result')
    expect(request.mock.calls.filter(([call]) => call.path === '/api/v1/capture/inputs/rescan')).toHaveLength(1)
    expect(request.mock.calls.filter(([call]) => call.path.startsWith('/api/v1/capture/discovery') && call.method === 'POST')).toHaveLength(0)
    expect(screen.getByTestId('mic-scan-MIC-01')).toHaveAttribute('data-state', 'READY')
    expect(screen.getByTestId('mic-scan-MIC-01')).toHaveTextContent('MIC 1 (MIC-01)')
    expect(screen.getByTestId('mic-scan-MIC-02')).toHaveAttribute('data-state', 'NOT_REACHABLE')
    expect(screen.getByTestId('mic-rescan-checked-at')).toHaveTextContent(/Checked at \d\d:\d\d:\d\d/)
    expect(within(block).queryByText(en.common.captureConnect.action)).not.toBeInTheDocument()
    expect(block.querySelector('input')).toBeNull()
  })
})

describe('the alert centre (ux §8e.2 (3))', () => {
  it('words a notice from params.reason, with the device by label and id', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <p data-testid="line">{captureNoticeLine(t, captureNoticeOf(CAM2)!)}</p>
      </I18nextProvider>,
    )
    expect(screen.getByTestId('line')).toHaveTextContent('Camera 2 (CAM-02) is not reachable. It did not answer the pre-check. A search found 0 cameras.')
  })
})
