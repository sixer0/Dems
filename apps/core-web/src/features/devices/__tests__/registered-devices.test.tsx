// Task 3 R-11, blueprint row 140: the cards of the devices the Core registered beyond the built-in
// ids (this Mac's camera `CAM-05` and microphone `MIC-05`, an added camera — D60 (2026-11-04) made CAM-03/CAM-04 built-ins and D61 (2026-11-04) made MIC-03/MIC-04 built-ins of the four-channel plane, so the fixtures live above them), built from the Core's
// device list (ruling D137 (2); `masterplan/08_client_ux_spec.md` §8f flow 12, §8f.3; D83, D91, D128).
//
// | Check | Where |
// |-------|-------|
// | The roster is the Core's list minus the six built-in ids, by kind; the PoE switch is no card | "the roster" |
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
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { OPERATOR_IDS, type Sim, type SimAlert } from '@dems/shared/sim'
import { i18n } from '@/i18n'
import type { CaptureDevice } from '../capture-selector'
import { selectSummary, trackStatus } from '../model'
import { BUILT_IN_SOURCE_IDS, drawnByOwnTile, rateAtLimitOf, registeredRoster, rosterCardName, rosterCardStatus, rosterLimitKey, rosterSlotOf, rosterSourceKey, rosterStateNotChecked } from '../registered-devices-model'
import { trackReachOf } from '../track-reach'
import { installDevicesBed, mountDevices } from './search-bed'

const mode = vi.hoisted(() => ({ realCapture: false }))
vi.mock('../source-class', async (original) => ({ ...(await original<typeof import('../source-class')>()), useRealCapture: () => mode.realCapture }))

const t = i18n.t.bind(i18n)
const R = en.common.developmentRoster
const S = en.common.sourceClass
const L = en.common.localDevice

const device = (id: string, kind: CaptureDevice['kind'], over: Partial<CaptureDevice> = {}): CaptureDevice => ({ id, kind, model: null, firmware: null, host: null, poePort: null, online: true, streamState: kind === 'CAMERA' ? 'LIVE' : null, capabilities: [], ...over })
const LOCAL_CAMERA = device('CAM-05', 'CAMERA', { model: 'MacBook Air Camera', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' })
// D61 (2026-11-04): the built-in microphones reach MIC-04 — this Mac's microphone is minted as MIC-05.
const LOCAL_MIC = device('MIC-05', 'MIC', { model: 'MacBook Air Microphone', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' })
const ADDED_CAMERA = device('CAM-06', 'CAMERA', { model: '<b>Vendor</b> PTZ-9000 with a very long announced model text', host: '192.168.10.44', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' })
const BUILT_INS = [device('CAM-01', 'CAMERA'), device('CAM-02', 'CAMERA'), device('CAM-03', 'CAMERA'), device('CAM-04', 'CAMERA'), device('MIC-01', 'MIC'), device('MIC-02', 'MIC'), device('MIC-03', 'MIC'), device('MIC-04', 'MIC'), device('POE-SWITCH', 'POE', { streamState: null })] // D60: four cameras; D61 (2026-11-04): four microphones
const DEVELOPMENT_CONFIG = {
  cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-05' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }],
  // D61 (2026-11-04): the lines are keyed by channel; the local microphone stands on channel 1.
  mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-02' }, { inputId: 'MIC-05', deviceId: 'MIC-05', channel: 'MIC-01' }, { inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-03' }, { inputId: 'MIC-04', deviceId: 'MIC-04', channel: 'MIC-04' }],
} as unknown as Parameters<typeof rosterSlotOf>[0]
const alert = (id: string, target: string, params: SimAlert['params'], over: Partial<SimAlert> = {}): SimAlert => ({ id, at: 1, severity: 'INFO', kind: 'SYSTEM', message: 'core text', active: true, acknowledged: false, resolvedAt: null, target, params, ...over })
const RATE = alert('ALR-9', 'MIC-05', { reason: 'MIC_RATE_AT_LIMIT', deviceId: 'MIC-05', deviceKind: 'MIC' })

describe('the roster (D137 (2)): built from the Core\'s device list, never from a closed id set', () => {
  const input = { devices: [...BUILT_INS, LOCAL_CAMERA, LOCAL_MIC, ADDED_CAMERA], config: DEVELOPMENT_CONFIG, alerts: [] as SimAlert[] }

  it('the cards are the cameras / microphones of the list minus the six built-in ids; the PoE switch is no card', () => {
    expect(BUILT_IN_SOURCE_IDS).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) // D60: four built-in cameras; D61 (2026-11-04): four built-in microphones
    // Fix wave L (G70c-08), pins moved by delta: a built-in source that is on NO line of the selector is a registered source
    // without a tile, so it has its card; a built-in source on a line stays a tile and has none.
    const beyond = (kind: 'CAMERA' | 'MIC', devices = input.devices) => registeredRoster({ ...input, devices }, kind).filter((card) => !BUILT_IN_SOURCE_IDS.includes(card.id))
    const unassignedBuiltIns = (kind: 'CAMERA' | 'MIC', devices = input.devices) => registeredRoster({ ...input, devices }, kind).filter((card) => BUILT_IN_SOURCE_IDS.includes(card.id))
    expect(beyond('CAMERA').map((card) => [card.id, card.local, card.slot, card.state])).toEqual([['CAM-05', true, 'VIDEO-01', 'READY'], ['CAM-06', false, null, 'READY']])
    expect(beyond('MIC').map((card) => [card.id, card.local, card.slot, card.state])).toEqual([['MIC-05', true, 'MIC-01', 'READY']]) // D61: the slot is the channel
    expect(beyond('CAMERA', BUILT_INS)).toEqual([])
    expect(beyond('MIC', BUILT_INS)).toEqual([])
    for (const kind of ['CAMERA', 'MIC'] as const) {
      const lines = kind === 'CAMERA' ? input.config.cameras.map((line) => line.deviceId) : input.config.mics.map((line) => line.deviceId)
      expect(unassignedBuiltIns(kind).every((card) => card.slot === null && !lines.includes(card.id)), kind).toBe(true)
      expect(unassignedBuiltIns(kind).map((card) => card.id), kind).toEqual(BUILT_INS.filter((device) => device.kind === kind && !lines.includes(device.id)).map((device) => device.id))
    }
  })

  it('a device the Core calls local only by its id is NOT local: the class and the adapter decide, not the id', () => {
    const plain = device('CAM-05', 'CAMERA')
    expect(registeredRoster({ ...input, devices: [plain] }, 'CAMERA')[0]).toMatchObject({ id: 'CAM-05', local: false })
  })

  it('the state: `online` false reads not reachable; the NAMED cause of the active notice wins; the card stays the same card', () => {
    const offline = { ...LOCAL_CAMERA, online: false }
    expect(registeredRoster({ ...input, devices: [offline] }, 'CAMERA')[0]).toMatchObject({ id: 'CAM-05', local: true, state: 'NOT_REACHABLE' })
    const denied = alert('ALR-1', 'CAM-05', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-05', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'PERMISSION_DENIED' }, { severity: 'WARNING' })
    expect(registeredRoster({ ...input, devices: [offline], alerts: [denied] }, 'CAMERA')[0]).toMatchObject({ id: 'CAM-05', local: true, state: 'PERMISSION_DENIED' })
    // A resolved notice says nothing any more.
    expect(registeredRoster({ ...input, devices: [LOCAL_CAMERA], alerts: [{ ...denied, active: false }] }, 'CAMERA')[0]?.state).toBe('READY')
    const busy = alert('ALR-2', 'MIC-05', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'MIC-05', deviceKind: 'MIC', phase: 'PRECHECK', cause: 'DEVICE_BUSY' })
    expect(registeredRoster({ ...input, alerts: [busy] }, 'MIC').find((card) => card.id === 'MIC-05')?.state).toBe('DEVICE_BUSY')
  })

  it('"is on" only from `sourceOpen: true` of a LOCAL device; an absent member, false, or a test source is not on', () => {
    const on = (patch: object) => registeredRoster({ ...input, devices: [{ ...LOCAL_MIC, ...patch } as CaptureDevice] }, 'MIC')[0]?.sourceOn
    expect([on({}), on({ sourceOpen: false }), on({ sourceOpen: true }), on({ sourceOpen: true, adapter: 'FAKE' })]).toEqual([false, false, true, false])
  })
})

// Audit row 131 (DF-16, U-09): a real Core mints its registry ids from the built-in pattern, so a real device can carry a
// built-in id. The bench Core of 2026-11-05 (capture_devices + capture_config read back): ONVIF CAM-03/04 feed VIDEO-01/02,
// CAM-05/06 feed VIDEO-03/04; USB MIC-03..06 feed channels 1-4; the development rows CAM-01/02, MIC-01/02 are not listed in
// REAL_PRODUCTION, and the Core states no `adapter` / `sourceClass` for an id of the built-in set (rows.ts). "Registered
// cameras" read only CAM-05/06 and "Registered microphones" only MIC-05/06.
describe('registry ids equal to built-in ids (audit row 131, DF-16): every registered device is listed exactly once', () => {
  const real = (id: string, kind: CaptureDevice['kind'], adapter: string) => device(id, kind, BUILT_IN_SOURCE_IDS.includes(id) ? {} : { adapter, sourceClass: 'PRODUCTION' })
  const BENCH_DEVICES = [real('CAM-03', 'CAMERA', 'ONVIF_RTSP'), real('CAM-04', 'CAMERA', 'ONVIF_RTSP'), real('CAM-05', 'CAMERA', 'ONVIF_RTSP'), real('CAM-06', 'CAMERA', 'ONVIF_RTSP'), real('MIC-03', 'MIC', 'USB_AUDIO'), real('MIC-04', 'MIC', 'USB_AUDIO'), real('MIC-05', 'MIC', 'USB_AUDIO'), real('MIC-06', 'MIC', 'USB_AUDIO')]
  const BENCH_CONFIG = {
    cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-03' }, { trackId: 'VIDEO-02', deviceId: 'CAM-04' }, { trackId: 'VIDEO-03', deviceId: 'CAM-05' }, { trackId: 'VIDEO-04', deviceId: 'CAM-06' }],
    mics: [{ channel: 'MIC-01', inputId: 'MIC-03', deviceId: 'MIC-03' }, { channel: 'MIC-02', inputId: 'MIC-04', deviceId: 'MIC-04' }, { channel: 'MIC-03', inputId: 'MIC-05', deviceId: 'MIC-05' }, { channel: 'MIC-04', inputId: 'MIC-06', deviceId: 'MIC-06' }],
  } as unknown as Parameters<typeof rosterSlotOf>[0]
  const roster = (kind: 'CAMERA' | 'MIC', devices: readonly CaptureDevice[], config = BENCH_CONFIG) => registeredRoster({ devices, config, alerts: [] }, kind).map((card) => [card.id, card.slot])

  it('U-09: the bench Core lists CAM-03..06 and MIC-03..06, each once, with the line it feeds', () => {
    expect(roster('CAMERA', BENCH_DEVICES)).toEqual([['CAM-03', 'VIDEO-01'], ['CAM-04', 'VIDEO-02'], ['CAM-05', 'VIDEO-03'], ['CAM-06', 'VIDEO-04']])
    expect(roster('MIC', BENCH_DEVICES)).toEqual([['MIC-03', 'MIC-01'], ['MIC-04', 'MIC-02'], ['MIC-05', 'MIC-03'], ['MIC-06', 'MIC-04']])
  })

  it('with the development rows listed too (REAL_DEVELOPMENT): CAM-01/02 and MIC-01/02 on no line are cards as well - no id twice, none lost', () => {
    const devices = [device('CAM-01', 'CAMERA'), device('CAM-02', 'CAMERA'), device('MIC-01', 'MIC'), device('MIC-02', 'MIC'), ...BENCH_DEVICES]
    for (const kind of ['CAMERA', 'MIC'] as const) {
      const ids = registeredRoster({ devices, config: BENCH_CONFIG, alerts: [] }, kind).map((card) => card.id)
      expect(ids, kind).toEqual(devices.filter((entry) => entry.kind === kind).map((entry) => entry.id))
      expect(new Set(ids).size, kind).toBe(ids.length)
    }
  })

  it('drawnByOwnTile: only a built-in id on the line its id names is the tile\'s (the demonstration seed); any other line, no line, or a minted id is not', () => {
    const SEED_CONFIG = {
      cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }, { trackId: 'VIDEO-03', deviceId: 'CAM-03' }, { trackId: 'VIDEO-04', deviceId: 'CAM-04' }],
      mics: [{ channel: 'MIC-01', inputId: 'MIC-01', deviceId: 'MIC-01' }, { channel: 'MIC-02', inputId: 'MIC-02', deviceId: 'MIC-02' }, { channel: 'MIC-03', inputId: 'MIC-03', deviceId: 'MIC-03' }, { channel: 'MIC-04', inputId: 'MIC-04', deviceId: 'MIC-04' }],
    } as unknown as Parameters<typeof rosterSlotOf>[0]
    expect(BUILT_INS.filter((entry) => entry.kind !== 'POE').every((entry) => drawnByOwnTile(SEED_CONFIG, entry))).toBe(true)
    expect(roster('CAMERA', BUILT_INS, SEED_CONFIG)).toEqual([])
    expect(roster('MIC', BUILT_INS, SEED_CONFIG)).toEqual([])
    expect([drawnByOwnTile(BENCH_CONFIG, device('CAM-03', 'CAMERA')), drawnByOwnTile(BENCH_CONFIG, device('MIC-04', 'MIC')), drawnByOwnTile(BENCH_CONFIG, device('CAM-05', 'CAMERA')), drawnByOwnTile(BENCH_CONFIG, device('CAM-01', 'CAMERA'))]).toEqual([false, false, false, false])
  })
})

describe('the rate warning (known state (a), D128): named, from the Core\'s alert, for that microphone only', () => {
  it('active alert with reason MIC_RATE_AT_LIMIT and this target -> true; another target, another reason, a resolved alert, a fault kind -> false', () => {
    expect(rateAtLimitOf([RATE], 'MIC-05')).toBe(true)
    expect(rateAtLimitOf([RATE], 'MIC-02')).toBe(false)
    expect(rateAtLimitOf([{ ...RATE, active: false }], 'MIC-05')).toBe(false)
    expect(rateAtLimitOf([alert('ALR-8', 'MIC-05', { reason: 'AV_OFFSET_NEAR_BOUND' })], 'MIC-05')).toBe(false)
    expect(rateAtLimitOf([{ ...RATE, kind: 'CAPTURE_FAULT' }], 'MIC-05')).toBe(false)
    const cards = registeredRoster({ devices: [LOCAL_MIC, LOCAL_CAMERA], config: DEVELOPMENT_CONFIG, alerts: [RATE, { ...RATE, id: 'ALR-10', target: 'CAM-05' }] }, 'MIC')
    expect(cards.map((card) => card.rateAtLimit)).toEqual([true])
    // A camera never carries it, whatever an alert says.
    expect(registeredRoster({ devices: [LOCAL_CAMERA], config: DEVELOPMENT_CONFIG, alerts: [{ ...RATE, target: 'CAM-05' }] }, 'CAMERA')[0]?.rateAtLimit).toBe(false)
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
    expect(rosterCardName(t, card(LOCAL_CAMERA), false)).toBe('Camera CAM-05')
    expect(rosterCardName(t, card(LOCAL_MIC), false)).toBe('MIC 5') // D61: the added microphone is MIC-05
  })

  it('an added camera is named by its id; its announced model is never the name', () => {
    expect(rosterCardName(t, card(ADDED_CAMERA), true)).toBe('Camera CAM-06')
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
        cameras: state.captureConfig.cameras.map((camera) => (camera.trackId === 'VIDEO-01' ? { ...camera, deviceId: 'CAM-05' } : camera)),
        // D61 (2026-11-04): channel 1 goes to this Mac's microphone (MIC-05); channels 2..4 keep their built-in lines.
        mics: state.captureConfig.mics.map((line) => (line.channel === 'MIC-01' ? { ...line, inputId: 'MIC-05', deviceId: 'MIC-05' } : line)),
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
    expect(cameras.getByTestId('registered-device-name-CAM-05').textContent).toBe('Camera CAM-05')
    expect(cameras.getByTestId('registered-device-used-CAM-05').textContent).toBe(R.usedAs['VIDEO-01'])
    expect(cameras.getByTestId('registered-device-used-CAM-06').textContent).toBe(R.usedAs.NONE)
    const microphones = within(screen.getByTestId('registered-devices-MIC'))
    expect(microphones.getByTestId('registered-device-name-MIC-05').textContent).toBe('MIC 5') // D61: the added microphone is MIC-05
    expect(microphones.getByTestId('registered-device-used-MIC-05').textContent).toBe(R.usedAs['MIC-01'])
    expect(document.querySelectorAll('[data-testid^="source-badge-roster-"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-testid^="source-on-roster-"]')).toHaveLength(0)
    fireEvent.click(microphones.getByTestId('registered-device-view-MIC-05'))
    const drawer = within(await screen.findByTestId('registered-device-drawer'))
    expect(drawer.queryByTestId('registered-drawer-limits')).toBeNull()
    expect(drawer.queryByTestId('source-badge-registered-drawer')).toBeNull()
  })

  it('real capture: the local devices carry the ONE badge and the D83 names; the added production camera carries none; "is on" appears only when the Core says `sourceOpen`', async () => {
    mode.realCapture = true
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI, development)
    const cameras = within(await screen.findByTestId('registered-devices-CAMERA'))
    expect(cameras.getByTestId('registered-device-name-CAM-05').textContent).toBe(S.kind.localCamera)
    expect(cameras.getByTestId('source-badge-roster-CAM-05').textContent).toContain(S.badge)
    expect(cameras.getByTestId('source-badge-roster-CAM-05').textContent).toContain(S.kind.localCamera)
    expect(cameras.getByTestId('registered-device-state-CAM-05').textContent).toBe(L.state.READY)
    expect(cameras.getByTestId('registered-device-name-CAM-06').textContent).toBe('Camera CAM-06')
    expect(cameras.queryByTestId('source-badge-roster-CAM-06')).toBeNull()
    // The announced model of the added camera is nowhere on its card (untrusted text is not a name).
    expect(cameras.getByTestId('registered-device-CAM-06').textContent).not.toContain('Vendor')
    const microphones = within(screen.getByTestId('registered-devices-MIC'))
    expect(microphones.getByTestId('registered-device-name-MIC-05').textContent).toBe(S.kind.localMicrophone)
    expect(microphones.getByTestId('source-badge-roster-MIC-05').textContent).toContain(S.kind.localMicrophone)
    // The shared slice carries no `sourceOpen` yet: nothing is drawn.
    expect(document.querySelectorAll('[data-testid^="source-on-roster-"]')).toHaveLength(0)
    // The Core says the microphone is open (the member the request to pass D4 adds): the fixed line appears, for that device only.
    sim.store.setState({ captureDevices: { devices: sim.store.getState().captureDevices.devices.map((entry) => (entry.id === 'MIC-05' ? ({ ...entry, sourceOpen: true } as CaptureDevice) : entry)) } })
    await waitFor(() => expect(screen.getByTestId('source-on-roster-MIC-05').textContent).toBe(S.microphoneOn.web))
    expect(screen.queryByTestId('source-on-roster-CAM-05')).toBeNull()
    expect(screen.getByTestId('source-on-roster-MIC-05').getAttribute('role')).toBe('status')
  })

  it('real capture: a local camera macOS has not allowed keeps its name and badge, reads "Permission needed" with the sentence, and offers no other source', async () => {
    mode.realCapture = true
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI, development)
    const denied = alert('ALR-1', 'CAM-05', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-05', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'PERMISSION_DENIED' }, { severity: 'WARNING' })
    sim.store.setState({
      alerts: [...sim.store.getState().alerts, denied],
      captureDevices: { devices: sim.store.getState().captureDevices.devices.map((entry) => (entry.id === 'CAM-05' ? { ...entry, online: false } : entry)) },
    })
    await waitFor(() => expect(screen.getByTestId('registered-device-state-CAM-05').textContent).toBe(L.state.PERMISSION_DENIED))
    const card = within(screen.getByTestId('registered-device-CAM-05'))
    expect(card.getByTestId('registered-device-name-CAM-05').textContent).toBe(S.kind.localCamera)
    expect(card.getByTestId('source-badge-roster-CAM-05')).toBeTruthy()
    expect(card.getByTestId('registered-device-sentence-CAM-05').textContent).toBe(L.permissionCamera)
    // One action on the card: "View device". Nothing opens a system setting, nothing swaps the source.
    expect(card.getAllByRole('button').map((button) => button.textContent)).toEqual([en.common.captureSearch.viewDevice])
    expect(screen.getByTestId('registered-device-CAM-05').textContent).not.toMatch(/test source/i)
  })

  it('real capture: MIC_RATE_AT_LIMIT is a NAMED warning on the microphone card while the Core\'s alert is active, and gone when it resolves; "View device" states the limit', async () => {
    mode.realCapture = true
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI, development)
    await screen.findByTestId('registered-device-MIC-05')
    expect(screen.queryByTestId('registered-device-rate-MIC-05')).toBeNull()
    sim.store.setState({ alerts: [...sim.store.getState().alerts, RATE] })
    await waitFor(() => expect(screen.getByTestId('registered-device-rate-MIC-05').textContent).toContain(R.rateAtLimit.title))
    expect(screen.getByTestId('registered-device-rate-MIC-05').textContent).toContain('MIC_RATE_AT_LIMIT')
    expect(screen.queryByTestId('registered-device-rate-CAM-05')).toBeNull()

    fireEvent.click(screen.getByTestId('registered-device-view-MIC-05'))
    const drawer = within(await screen.findByTestId('registered-device-drawer'))
    expect(drawer.getByTestId('source-badge-registered-drawer').textContent).toContain(S.badge)
    expect(drawer.getByTestId('registered-drawer-limits').textContent).toContain(R.limits.localMicrophone)
    const facts = drawer.getByTestId('registered-drawer-facts').textContent ?? ''
    expect(facts).toContain('MIC-05')
    expect(facts).toContain(R.source.LOCAL_DEVICE)
    expect(facts).toContain(R.usedAs['MIC-01']) // D61: the roster names the channel
    // A local device has no address row; nothing in the drawer is an input.
    expect(facts).not.toContain(R.field.address)
    expect(document.querySelectorAll('[data-testid="registered-device-drawer"] input')).toHaveLength(0)

    sim.store.setState({ alerts: sim.store.getState().alerts.map((entry) => (entry.id === 'ALR-9' ? { ...entry, active: false, resolvedAt: 2 } : entry)) })
    await waitFor(() => expect(screen.queryByTestId('registered-device-rate-MIC-05')).toBeNull())
  })
})

// Audit 2026-11-06 row W2c2 (129b, U-09b; D111): on the bench /devices said "Ready" on the REGISTERED CAMERAS cards while
// the same cameras' tiles said "Not checked" and the summary "CAMERAS 0/4 - 4 issues" (camera LAN down). The card read the
// registry row; the tiles and the summary read row 129's `trackStatus`. A card on a line now says what that track's tile says.
describe('row W2c2 (129b, U-09b): a registered card on a line says what the tile of its track says', () => {
  installDevicesBed()
  const BENCH_LINES: Record<string, string> = { 'VIDEO-01': 'CAM-03', 'VIDEO-02': 'CAM-04', 'VIDEO-03': 'CAM-05', 'VIDEO-04': 'CAM-06' }
  /** The bench Core: ONVIF CAM-03..06 on VIDEO-01..04, registry `online: true`, held open (`sourceOpen`), no `checkedAt`; MIC-05 on channel 1. */
  const bench = (sim: Sim): void => {
    const state = sim.store.getState()
    const cameras = Object.values(BENCH_LINES).map((id) => device(id, 'CAMERA', { adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', sourceOpen: true } as Partial<CaptureDevice>))
    sim.store.setState({
      captureDevices: { devices: [...state.captureDevices.devices.filter((entry) => !cameras.some((camera) => camera.id === entry.id)), ...cameras, device('MIC-05', 'MIC', { adapter: 'USB_AUDIO', sourceClass: 'PRODUCTION' })] },
      captureConfig: {
        ...state.captureConfig,
        cameras: state.captureConfig.cameras.map((line) => ({ ...line, deviceId: BENCH_LINES[line.trackId] ?? line.deviceId })),
        mics: state.captureConfig.mics.map((line) => (line.channel === 'MIC-01' ? { ...line, inputId: 'MIC-05', deviceId: 'MIC-05' } : line)),
      },
    })
  }

  it('model: the card status is the track status - FAULT where the tile reads FAULT, "Not checked" exactly where the tile does', async () => {
    mode.realCapture = false
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI, bench)
    // The Core's operation 44 for a source it cannot reach: `online: true`, lens FAULT (row 128); tracks 1-2 down, 3-4 at rest.
    const base = sim.store.getState()
    const state = {
      ...base,
      cameras: base.cameras.map((camera) => (camera.id === 'VIDEO-01' || camera.id === 'VIDEO-02' ? { ...camera, lens: 'FAULT' as const } : { ...camera, online: true, lens: 'READY' as const })),
      mics: base.mics.map((mic) => (mic.id === 'AUDIO-01' ? { ...mic, state: 'NO_SIGNAL' as const, clipLatched: false } : mic)),
    }
    const cards = registeredRoster({ devices: state.captureDevices.devices, config: state.captureConfig, alerts: state.alerts }, 'CAMERA').filter((card) => card.slot !== null)
    expect(cards.map((card) => [card.id, card.slot])).toEqual([['CAM-03', 'VIDEO-01'], ['CAM-04', 'VIDEO-02'], ['CAM-05', 'VIDEO-03'], ['CAM-06', 'VIDEO-04']])
    for (const card of cards) {
      const track = card.slot as 'VIDEO-01'
      const tile = trackStatus(state, track)
      const chip = rosterCardStatus(state, card, true)
      expect(chip.status ?? 'READY', card.id).toBe(tile)
      // The tile's "Not checked" rule (camera-tile.tsx: reach NOT_CHECKED and READY) - the card's is the same.
      expect(chip.notChecked, card.id).toBe(tile === 'READY' && trackReachOf(state, track, true) === 'NOT_CHECKED')
      // The registry rule alone said "Ready" for every one of them (held open): the defect U-09b.
      expect(rosterStateNotChecked(card, true), card.id).toBe(false)
    }
    expect(cards.map((card) => rosterCardStatus(state, card, true))).toEqual([
      { status: 'FAULT', notChecked: false },
      { status: 'FAULT', notChecked: false },
      { status: null, notChecked: true },
      { status: null, notChecked: true },
    ])
    expect(selectSummary(state)).toMatchObject({ camsOk: 2, camsTotal: 4 })
    // Registered microphones too: the card on channel 1 says the channel's NO_SIGNAL, as the audio card does.
    const mic = registeredRoster({ devices: state.captureDevices.devices, config: state.captureConfig, alerts: state.alerts }, 'MIC').find((card) => card.id === 'MIC-05')!
    expect(rosterCardStatus(state, mic, true).status).toBe(trackStatus(state, 'AUDIO-01'))
    expect(trackStatus(state, 'AUDIO-01')).toBe('NO_SIGNAL')
    // A card on no line, and a card with a negative state of its own, keep the registry rule.
    const offline = { ...cards[0]!, state: 'NOT_REACHABLE' as const }
    expect(rosterCardStatus(state, offline, true)).toEqual({ status: null, notChecked: false })
    expect(rosterCardStatus(state, { ...cards[2]!, slot: null }, true)).toEqual({ status: null, notChecked: rosterStateNotChecked(cards[2]!, true) })
  })

  it('page: a camera the Core states NOT_REACHABLE reads FAULT on its registered card and in its drawer, the same word as its tile', async () => {
    mode.realCapture = false
    const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI, bench)
    act(() =>
      sim.store.setState((state) => ({
        captureDevices: { ...state.captureDevices, devices: state.captureDevices.devices.map((entry) => (entry.id === 'CAM-05' ? { ...entry, reach: 'NOT_REACHABLE', checkedAt: state.clock.now } : entry)) },
      })),
    )
    await waitFor(() => expect(screen.getByTestId('camera-tile-VIDEO-03')).toHaveAttribute('data-status', 'FAULT'))
    const card = screen.getByTestId('registered-device-state-CAM-05')
    expect(card.textContent).toBe(screen.getByTestId('camera-status-VIDEO-03').textContent)
    expect(screen.getByTestId('registered-device-CAM-05')).toHaveAttribute('data-status', 'FAULT')
    // The camera next to it is READY on both.
    expect(screen.getByTestId('camera-tile-VIDEO-04')).toHaveAttribute('data-status', 'READY')
    expect(screen.getByTestId('registered-device-state-CAM-06').textContent).toBe(L.state.READY)
    fireEvent.click(screen.getByTestId('registered-device-view-CAM-05'))
    const drawer = within(await screen.findByTestId('registered-device-drawer'))
    expect(drawer.getByTestId('registered-drawer-state')).toHaveAttribute('data-status', 'FAULT')
    expect(drawer.getByTestId('registered-drawer-state').textContent).toBe(card.textContent)
  })
})
