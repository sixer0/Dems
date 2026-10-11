// Task 3 R-11, blueprint row 140: the cards of the devices the Core registered beyond the built-in
// ids (this Mac's camera `CAM-03` and microphone `MIC-03`, an added camera), built from the Core's
// device list (ruling D137 (2); `masterplan/08_client_ux_spec.md` §8f flow 12, §8f.3; D83, D91, D128).
//
// | Check | Where |
// |-------|-------|
// | The roster is the Core's list minus the four built-in ids, by kind; the PoE switch is no card | "the roster" |
// | Used as: the selector line that names the device; a named cause wins over `online`; a local device keeps its card in every state | "the roster" |
// | D83 wording: "This Mac's camera / microphone" only for the Core's local device AND in real capture; "MIC 3"; an added camera is named by its id, never by its announced model | "names" |
// | Known state (a), D128: the microphone limit is stated; `MIC_RATE_AT_LIMIT` is a named warning, drawn while the Core's alert is active, gone when it resolves | "the rate warning", "the page" |
// | M5-SEC-PRIV-2-W (component half): 'is on' only from `sourceOpen: true` of a LOCAL device in real capture; absent member = nothing drawn | "the page, real capture" |
// | D91 R-2: no badge in Simulated client mode; in real capture the badge is the one component, from `sourceClass` only | "the page" |
// | A Core that lists no device beyond the built-in ids: 0 roster nodes (the page is as before) | "the page" |
//
// "Real capture" is the console's Live mode (`useRealCapture`, `source-class.ts`). The page tests
// run on the in-app simulator; the rule is switched through that ONE function (a hoisted flag), so
// the same mounted page is read in both modes. The Live transport itself is not exercised here.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { OPERATOR_IDS, type Sim, type SimAlert } from '@dems/shared/sim'
import { i18n } from '@/i18n'
import type { CaptureDevice } from '../capture-selector'
import { BUILT_IN_SOURCE_IDS, rateAtLimitOf, registeredRoster, rosterCardName, rosterLimitKey, rosterSlotOf, rosterSourceKey } from '../registered-devices-model'
import { installDevicesBed, mountDevices } from './search-bed'

const mode = vi.hoisted(() => ({ realCapture: false }))
vi.mock('../source-class', async (original) => ({ ...(await original<typeof import('../source-class')>()), useRealCapture: () => mode.realCapture }))

const t = i18n.t.bind(i18n)
const R = en.common.developmentRoster
const S = en.common.sourceClass
const L = en.common.localDevice

const device = (id: string, kind: CaptureDevice['kind'], over: Partial<CaptureDevice> = {}): CaptureDevice => ({ id, kind, model: null, firmware: null, host: null, poePort: null, online: true, streamState: kind === 'CAMERA' ? 'LIVE' : null, capabilities: [], ...over })
const LOCAL_CAMERA = device('CAM-03', 'CAMERA', { model: 'MacBook Air Camera', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' })
const LOCAL_MIC = device('MIC-03', 'MIC', { model: 'MacBook Air Microphone', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' })
const ADDED_CAMERA = device('CAM-04', 'CAMERA', { model: '<b>Vendor</b> PTZ-9000 with a very long announced model text', host: '192.168.10.44', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' })
const BUILT_INS = [device('CAM-01', 'CAMERA'), device('CAM-02', 'CAMERA'), device('MIC-01', 'MIC'), device('MIC-02', 'MIC'), device('POE-SWITCH', 'POE', { streamState: null })]
const DEVELOPMENT_CONFIG = {
  cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-03' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }],
  mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY' }, { inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' }],
} as unknown as Parameters<typeof rosterSlotOf>[0]
const alert = (id: string, target: string, params: SimAlert['params'], over: Partial<SimAlert> = {}): SimAlert => ({ id, at: 1, severity: 'INFO', kind: 'SYSTEM', message: 'core text', active: true, acknowledged: false, resolvedAt: null, target, params, ...over })
const RATE = alert('ALR-9', 'MIC-03', { reason: 'MIC_RATE_AT_LIMIT', deviceId: 'MIC-03', deviceKind: 'MIC' })

describe('the roster (D137 (2)): built from the Core\'s device list, never from a closed id set', () => {
  const input = { devices: [...BUILT_INS, LOCAL_CAMERA, LOCAL_MIC, ADDED_CAMERA], config: DEVELOPMENT_CONFIG, alerts: [] as SimAlert[] }

  it('the cards are the cameras / microphones of the list minus the four built-in ids; the PoE switch is no card', () => {
    expect(BUILT_IN_SOURCE_IDS).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'])
    // Fix wave L (G70c-08), pins moved by delta: a built-in source that is on NO line of the selector is a registered source
    // without a tile, so it has its card; a built-in source on a line stays a tile and has none.
    const beyond = (kind: 'CAMERA' | 'MIC', devices = input.devices) => registeredRoster({ ...input, devices }, kind).filter((card) => !BUILT_IN_SOURCE_IDS.includes(card.id))
    const unassignedBuiltIns = (kind: 'CAMERA' | 'MIC', devices = input.devices) => registeredRoster({ ...input, devices }, kind).filter((card) => BUILT_IN_SOURCE_IDS.includes(card.id))
    expect(beyond('CAMERA').map((card) => [card.id, card.local, card.slot, card.state])).toEqual([['CAM-03', true, 'VIDEO-01', 'READY'], ['CAM-04', false, null, 'READY']])
    expect(beyond('MIC').map((card) => [card.id, card.local, card.slot, card.state])).toEqual([['MIC-03', true, 'PRIMARY', 'READY']])
    expect(beyond('CAMERA', BUILT_INS)).toEqual([])
    expect(beyond('MIC', BUILT_INS)).toEqual([])
    for (const kind of ['CAMERA', 'MIC'] as const) {
      const lines = kind === 'CAMERA' ? input.config.cameras.map((line) => line.deviceId) : input.config.mics.map((line) => line.deviceId)
      expect(unassignedBuiltIns(kind).every((card) => card.slot === null && !lines.includes(card.id)), kind).toBe(true)
      expect(unassignedBuiltIns(kind).map((card) => card.id), kind).toEqual(BUILT_INS.filter((device) => device.kind === kind && !lines.includes(device.id)).map((device) => device.id))
    }
  })

  it('a device the Core calls local only by its id is NOT local: the class and the adapter decide, not the id', () => {
    const plain = device('CAM-03', 'CAMERA')
    expect(registeredRoster({ ...input, devices: [plain] }, 'CAMERA')[0]).toMatchObject({ id: 'CAM-03', local: false })
  })

  it('the state: `online` false reads not reachable; the NAMED cause of the active notice wins; the card stays the same card', () => {
    const offline = { ...LOCAL_CAMERA, online: false }
    expect(registeredRoster({ ...input, devices: [offline] }, 'CAMERA')[0]).toMatchObject({ id: 'CAM-03', local: true, state: 'NOT_REACHABLE' })
    const denied = alert('ALR-1', 'CAM-03', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-03', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'PERMISSION_DENIED' }, { severity: 'WARNING' })
    expect(registeredRoster({ ...input, devices: [offline], alerts: [denied] }, 'CAMERA')[0]).toMatchObject({ id: 'CAM-03', local: true, state: 'PERMISSION_DENIED' })
    // A resolved notice says nothing any more.
    expect(registeredRoster({ ...input, devices: [LOCAL_CAMERA], alerts: [{ ...denied, active: false }] }, 'CAMERA')[0]?.state).toBe('READY')
    const busy = alert('ALR-2', 'MIC-03', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'MIC-03', deviceKind: 'MIC', phase: 'PRECHECK', cause: 'DEVICE_BUSY' })
    expect(registeredRoster({ ...input, alerts: [busy] }, 'MIC').find((card) => card.id === 'MIC-03')?.state).toBe('DEVICE_BUSY')
  })

  it('"is on" only from `sourceOpen: true` of a LOCAL device; an absent member, false, or a test source is not on', () => {
    const on = (patch: object) => registeredRoster({ ...input, devices: [{ ...LOCAL_MIC, ...patch } as CaptureDevice] }, 'MIC')[0]?.sourceOn
    expect([on({}), on({ sourceOpen: false }), on({ sourceOpen: true }), on({ sourceOpen: true, adapter: 'FAKE' })]).toEqual([false, false, true, false])
  })
})

describe('the rate warning (known state (a), D128): named, from the Core\'s alert, for that microphone only', () => {
  it('active alert with reason MIC_RATE_AT_LIMIT and this target -> true; another target, another reason, a resolved alert, a fault kind -> false', () => {
    expect(rateAtLimitOf([RATE], 'MIC-03')).toBe(true)
    expect(rateAtLimitOf([RATE], 'MIC-02')).toBe(false)
    expect(rateAtLimitOf([{ ...RATE, active: false }], 'MIC-03')).toBe(false)
    expect(rateAtLimitOf([alert('ALR-8', 'MIC-03', { reason: 'AV_OFFSET_NEAR_BOUND' })], 'MIC-03')).toBe(false)
    expect(rateAtLimitOf([{ ...RATE, kind: 'CAPTURE_FAULT' }], 'MIC-03')).toBe(false)
    const cards = registeredRoster({ devices: [LOCAL_MIC, LOCAL_CAMERA], config: DEVELOPMENT_CONFIG, alerts: [RATE, { ...RATE, id: 'ALR-10', target: 'CAM-03' }] }, 'MIC')
    expect(cards.map((card) => card.rateAtLimit)).toEqual([true])
    // A camera never carries it, whatever an alert says.
    expect(registeredRoster({ devices: [LOCAL_CAMERA], config: DEVELOPMENT_CONFIG, alerts: [{ ...RATE, target: 'CAM-03' }] }, 'CAMERA')[0]?.rateAtLimit).toBe(false)
  })

  it('the wording names the code and claims nothing about fitness; the limit of the local microphone says it is not fit for recording yet', () => {
    expect(R.rateAtLimit.title).toContain('MIC_RATE_AT_LIMIT')
    expect(R.limits.localMicrophone).toMatch(/^Not fit for recording yet\./)
    expect(R.limits.localMicrophone).toContain('8/9')
    expect(R.limits.localMicrophone).toContain('MIC_RATE_AT_LIMIT')
    expect(R.limits.localCamera).toMatch(/Variable frame rate/)
  })
})

describe('names and words (D83; pass D2\'s id rule)', () => {
  const card = (source: CaptureDevice) => registeredRoster({ devices: [source], config: DEVELOPMENT_CONFIG, alerts: [] }, source.kind === 'MIC' ? 'MIC' : 'CAMERA')[0]!

  it('the Core\'s local device reads "This Mac\'s camera / microphone" in real capture only', () => {
    expect(rosterCardName(t, card(LOCAL_CAMERA), true)).toBe(S.kind.localCamera)
    expect(rosterCardName(t, card(LOCAL_MIC), true)).toBe(S.kind.localMicrophone)
    expect(rosterCardName(t, card(LOCAL_CAMERA), false)).toBe('Camera CAM-03')
    expect(rosterCardName(t, card(LOCAL_MIC), false)).toBe('MIC 3')
  })

  it('an added camera is named by its id; its announced model is never the name', () => {
    expect(rosterCardName(t, card(ADDED_CAMERA), true)).toBe('Camera CAM-04')
  })

  it('the limit: local microphone, local camera, test source - in real capture; none for a production device, none in Simulated mode', () => {
    expect(rosterLimitKey(card(LOCAL_MIC), true)).toBe('common.developmentRoster.limits.localMicrophone')
    expect(rosterLimitKey(card(LOCAL_CAMERA), true)).toBe('common.developmentRoster.limits.localCamera')
    expect(rosterLimitKey(card(device('CAM-05', 'CAMERA', { adapter: 'FAKE', sourceClass: 'DEVELOPMENT' })), true)).toBe('common.developmentRoster.limits.test')
    expect(rosterLimitKey(card(ADDED_CAMERA), true)).toBeNull()
    expect(rosterLimitKey(card(LOCAL_MIC), false)).toBeNull()
  })

  it('the source words follow the adapter kind the Core sent; an unknown kind reads "Registered device"', () => {
    expect(['LOCAL_DEVICE', 'FAKE', 'ONVIF_RTSP', 'USB_AUDIO', 'SOMETHING_NEW', undefined].map((kind) => t(rosterSourceKey(kind)))).toEqual([R.source.LOCAL_DEVICE, R.source.FAKE, R.source.ONVIF_RTSP, R.source.USB_AUDIO, R.source.OTHER, R.source.OTHER])
  })
})

describe('the page: Devices & Inputs draws the roster from the Core\'s list', () => {
  installDevicesBed()

  /** The state a development Core replicates: its two local devices and one added camera beside the built-ins; camera 1 and the primary microphone are this Mac's. */
  const development = (sim: Sim): void => {
    const state = sim.store.getState()
    sim.store.setState({
      captureDevices: { devices: [...state.captureDevices.devices, LOCAL_CAMERA, LOCAL_MIC, ADDED_CAMERA] },
      captureConfig: {
        ...state.captureConfig,
        cameras: state.captureConfig.cameras.map((camera) => (camera.trackId === 'VIDEO-01' ? { ...camera, deviceId: 'CAM-03' } : camera)),
        mics: [{ ...state.captureConfig.mics[1]! }, { ...state.captureConfig.mics[0]!, inputId: 'MIC-03', deviceId: 'MIC-03' }],
      },
    })
  }

  it('a Core that lists no device beyond the built-in ids: 0 roster nodes', async () => {
    mode.realCapture = false
    await mountDevices('idle', OPERATOR_IDS.ANDI)
    expect(screen.queryByTestId('registered-devices-CAMERA')).toBeNull()
    expect(screen.queryByTestId('registered-devices-MIC')).toBeNull()
    expect(document.querySelectorAll('[data-testid^="registered-device-"]')).toHaveLength(0)
  })

  it('Simulated client mode (D83, D91 R-2): the cards are there with id-rule names and "used as", and NO badge, NO "is on", NO limit', async () => {
    mode.realCapture = false
    await mountDevices('idle', OPERATOR_IDS.ANDI, development)
    const cameras = within(await screen.findByTestId('registered-devices-CAMERA'))
    expect(cameras.getByTestId('registered-device-name-CAM-03').textContent).toBe('Camera CAM-03')
    expect(cameras.getByTestId('registered-device-used-CAM-03').textContent).toBe(R.usedAs['VIDEO-01'])
    expect(cameras.getByTestId('registered-device-used-CAM-04').textContent).toBe(R.usedAs.NONE)
    const microphones = within(screen.getByTestId('registered-devices-MIC'))
    expect(microphones.getByTestId('registered-device-name-MIC-03').textContent).toBe('MIC 3')
    expect(microphones.getByTestId('registered-device-used-MIC-03').textContent).toBe(R.usedAs.PRIMARY)
    expect(document.querySelectorAll('[data-testid^="source-badge-roster-"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-testid^="source-on-roster-"]')).toHaveLength(0)
    fireEvent.click(microphones.getByTestId('registered-device-view-MIC-03'))
    const drawer = within(await screen.findByTestId('registered-device-drawer'))
    expect(drawer.queryByTestId('registered-drawer-limits')).toBeNull()
    expect(drawer.queryByTestId('source-badge-registered-drawer')).toBeNull()
  })

  it('real capture: the local devices carry the ONE badge and the D83 names; the added production camera carries none; "is on" appears only when the Core says `sourceOpen`', async () => {
    mode.realCapture = true
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI, development)
    const cameras = within(await screen.findByTestId('registered-devices-CAMERA'))
    expect(cameras.getByTestId('registered-device-name-CAM-03').textContent).toBe(S.kind.localCamera)
    expect(cameras.getByTestId('source-badge-roster-CAM-03').textContent).toContain(S.badge)
    expect(cameras.getByTestId('source-badge-roster-CAM-03').textContent).toContain(S.kind.localCamera)
    expect(cameras.getByTestId('registered-device-state-CAM-03').textContent).toBe(L.state.READY)
    expect(cameras.getByTestId('registered-device-name-CAM-04').textContent).toBe('Camera CAM-04')
    expect(cameras.queryByTestId('source-badge-roster-CAM-04')).toBeNull()
    // The announced model of the added camera is nowhere on its card (untrusted text is not a name).
    expect(cameras.getByTestId('registered-device-CAM-04').textContent).not.toContain('Vendor')
    const microphones = within(screen.getByTestId('registered-devices-MIC'))
    expect(microphones.getByTestId('registered-device-name-MIC-03').textContent).toBe(S.kind.localMicrophone)
    expect(microphones.getByTestId('source-badge-roster-MIC-03').textContent).toContain(S.kind.localMicrophone)
    // The shared slice carries no `sourceOpen` yet: nothing is drawn.
    expect(document.querySelectorAll('[data-testid^="source-on-roster-"]')).toHaveLength(0)
    // The Core says the microphone is open (the member the request to pass D4 adds): the fixed line appears, for that device only.
    sim.store.setState({ captureDevices: { devices: sim.store.getState().captureDevices.devices.map((entry) => (entry.id === 'MIC-03' ? ({ ...entry, sourceOpen: true } as CaptureDevice) : entry)) } })
    await waitFor(() => expect(screen.getByTestId('source-on-roster-MIC-03').textContent).toBe(S.microphoneOn.web))
    expect(screen.queryByTestId('source-on-roster-CAM-03')).toBeNull()
    expect(screen.getByTestId('source-on-roster-MIC-03').getAttribute('role')).toBe('status')
  })

  it('real capture: a local camera macOS has not allowed keeps its name and badge, reads "Permission needed" with the sentence, and offers no other source', async () => {
    mode.realCapture = true
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI, development)
    const denied = alert('ALR-1', 'CAM-03', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-03', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'PERMISSION_DENIED' }, { severity: 'WARNING' })
    sim.store.setState({
      alerts: [...sim.store.getState().alerts, denied],
      captureDevices: { devices: sim.store.getState().captureDevices.devices.map((entry) => (entry.id === 'CAM-03' ? { ...entry, online: false } : entry)) },
    })
    await waitFor(() => expect(screen.getByTestId('registered-device-state-CAM-03').textContent).toBe(L.state.PERMISSION_DENIED))
    const card = within(screen.getByTestId('registered-device-CAM-03'))
    expect(card.getByTestId('registered-device-name-CAM-03').textContent).toBe(S.kind.localCamera)
    expect(card.getByTestId('source-badge-roster-CAM-03')).toBeTruthy()
    expect(card.getByTestId('registered-device-sentence-CAM-03').textContent).toBe(L.permissionCamera)
    // One action on the card: "View device". Nothing opens a system setting, nothing swaps the source.
    expect(card.getAllByRole('button').map((button) => button.textContent)).toEqual([en.common.captureSearch.viewDevice])
    expect(screen.getByTestId('registered-device-CAM-03').textContent).not.toMatch(/test source/i)
  })

  it('real capture: MIC_RATE_AT_LIMIT is a NAMED warning on the microphone card while the Core\'s alert is active, and gone when it resolves; "View device" states the limit', async () => {
    mode.realCapture = true
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI, development)
    await screen.findByTestId('registered-device-MIC-03')
    expect(screen.queryByTestId('registered-device-rate-MIC-03')).toBeNull()
    sim.store.setState({ alerts: [...sim.store.getState().alerts, RATE] })
    await waitFor(() => expect(screen.getByTestId('registered-device-rate-MIC-03').textContent).toContain(R.rateAtLimit.title))
    expect(screen.getByTestId('registered-device-rate-MIC-03').textContent).toContain('MIC_RATE_AT_LIMIT')
    expect(screen.queryByTestId('registered-device-rate-CAM-03')).toBeNull()

    fireEvent.click(screen.getByTestId('registered-device-view-MIC-03'))
    const drawer = within(await screen.findByTestId('registered-device-drawer'))
    expect(drawer.getByTestId('source-badge-registered-drawer').textContent).toContain(S.badge)
    expect(drawer.getByTestId('registered-drawer-limits').textContent).toContain(R.limits.localMicrophone)
    const facts = drawer.getByTestId('registered-drawer-facts').textContent ?? ''
    expect(facts).toContain('MIC-03')
    expect(facts).toContain(R.source.LOCAL_DEVICE)
    expect(facts).toContain(R.usedAs.PRIMARY)
    // A local device has no address row; nothing in the drawer is an input.
    expect(facts).not.toContain(R.field.address)
    expect(document.querySelectorAll('[data-testid="registered-device-drawer"] input')).toHaveLength(0)

    sim.store.setState({ alerts: sim.store.getState().alerts.map((entry) => (entry.id === 'ALR-9' ? { ...entry, active: false, resolvedAt: 2 } : entry)) })
    await waitFor(() => expect(screen.queryByTestId('registered-device-rate-MIC-03')).toBeNull())
  })
})
