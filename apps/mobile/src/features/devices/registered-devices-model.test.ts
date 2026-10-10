// Task 3 R-11, blueprint row 140: the pure roster of the devices the Core registered beyond the
// built-in ids (ruling D137 (2); ux §8f flow 12, §8f.3; D83, D128, D131, D136 (3)). Real simulator
// state from `createTestSim`, with the `captureDevices` slice holding what a Core would send. No React.
import { describe, expect, it } from '@jest/globals';
import type { SimAlert, SimState } from '@dems/shared/sim';
import { createTestSim } from '@/runtime/testing/test-sim';
import { en } from '@dems/shared/i18n';
import {
  BUILT_IN_SOURCE_IDS,
  parseRosterLine,
  registeredDevicesOf,
  rosterDeviceName,
  rosterDeviceState,
  rosterLimitKey,
  rosterLine,
  rosterOnKey,
  rosterSourceKey,
  rosterStateLabelKey,
} from './registered-devices-model';

type Device = SimState['captureDevices']['devices'][number];
const device = (id: string, kind: Device['kind'], over: Partial<Device> & { sourceOpen?: boolean } = {}): Device => ({ id, kind, model: null, firmware: null, host: null, poePort: null, online: true, streamState: kind === 'CAMERA' ? 'LIVE' : null, capabilities: [], ...over }) as Device;
const LOCAL_CAMERA = device('CAM-03', 'CAMERA', { model: 'MacBook Air Camera', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' });
const LOCAL_MIC = device('MIC-03', 'MIC', { model: 'MacBook Air Microphone', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' });
const ADDED = device('CAM-04', 'CAMERA', { model: 'Vendor PTZ-9000', host: '192.168.10.44', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' });
const alert = (id: string, target: string, params: SimAlert['params'], over: Partial<SimAlert> = {}): SimAlert => ({ id, at: 1, severity: 'INFO', kind: 'SYSTEM', message: 'core text', active: true, acknowledged: false, resolvedAt: null, target, params, ...over });
const RATE = alert('ALR-9', 'MIC-03', { reason: 'MIC_RATE_AT_LIMIT', deviceId: 'MIC-03', deviceKind: 'MIC' });

/** A development Core's state: camera 1 and the primary microphone are the Core Mac's; slot 2 keeps the built-ins. */
function developmentState(extra: readonly Device[] = [LOCAL_CAMERA, LOCAL_MIC, ADDED], alerts: readonly SimAlert[] = []): SimState {
  const state = createTestSim().sim.store.getState();
  return {
    ...state,
    alerts: [...alerts],
    captureDevices: { ...state.captureDevices, devices: [...state.captureDevices.devices, ...extra] },
    captureConfig: {
      ...state.captureConfig,
      cameras: state.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, deviceId: 'CAM-03' } : line)),
      mics: [{ ...state.captureConfig.mics[1]! }, { ...state.captureConfig.mics[0]!, inputId: 'MIC-03', deviceId: 'MIC-03' }],
    },
  } as SimState;
}
const t = (key: string, options?: Record<string, unknown>): string => `${key}${options === undefined ? '' : JSON.stringify(options)}`;

describe('the roster (D137 (2)): the Core\'s device list minus the four built-in ids', () => {
  it('an unedited simulator lists none: the screens are as before', () => {
    expect(registeredDevicesOf(createTestSim().sim.store.getState())).toEqual([]);
    expect(BUILT_IN_SOURCE_IDS).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02']);
  });

  it('the Core\'s order; what each is used as from the selector; the PoE switch is no row', () => {
    const roster = registeredDevicesOf(developmentState());
    expect(roster.map((entry) => [entry.id, entry.kind, entry.adapter, entry.sourceClass, entry.slot])).toEqual([
      ['CAM-03', 'CAMERA', 'LOCAL_DEVICE', 'DEVELOPMENT', 'VIDEO-01'],
      ['MIC-03', 'MIC', 'LOCAL_DEVICE', 'DEVELOPMENT', 'PRIMARY'],
      ['CAM-04', 'CAMERA', 'ONVIF_RTSP', 'PRODUCTION', null],
    ]);
  });

  it('one flat string for a selector: equal states give the identical string, and it parses back', () => {
    const state = developmentState();
    expect(rosterLine(state)).toBe(rosterLine({ ...state }));
    expect(parseRosterLine(rosterLine(state))).toEqual(registeredDevicesOf(state));
  });

  it('the state: a named cause of the active notice wins over `online`; a resolved notice says nothing', () => {
    const denied = alert('ALR-1', 'CAM-03', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-03', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'PERMISSION_DENIED' }, { severity: 'WARNING' });
    const of = (alerts: SimAlert[], online = true) => rosterDeviceState(registeredDevicesOf(developmentState([{ ...LOCAL_CAMERA, online }], alerts))[0]!);
    expect([of([]), of([], false), of([denied], false), of([{ ...denied, active: false }])]).toEqual(['READY', 'ABSENT', 'PERMISSION_DENIED', 'READY']);
    expect(rosterStateLabelKey('PERMISSION_DENIED', true)).toBe('features.capture-selector.localDevice.state.PERMISSION_DENIED');
    expect([rosterStateLabelKey('READY', false), rosterStateLabelKey('ABSENT', false)]).toEqual(['common.developmentRoster.reachable', 'common.developmentRoster.notReachable']);
  });
});

describe('names (D83, OP-125-7): "Core Mac\'s ..." only for the Core\'s local device and only in Live mode', () => {
  const [camera, mic, added] = registeredDevicesOf(developmentState());
  it('Live: the local camera and microphone by the tablet wording; an added camera by its id, never by its announced model', () => {
    expect(rosterDeviceName(t, camera!, true)).toBe('features.capture-selector.source.kind.localCamera');
    expect(rosterDeviceName(t, mic!, true)).toBe('features.capture-selector.source.kind.localMicrophone');
    expect(rosterDeviceName(t, added!, true)).toBe('common.developmentRoster.name{"kind":"common.developmentRoster.kind.CAMERA","id":"CAM-04"}');
  });
  it('Simulated client mode: the id rule only ("MIC 3", "Camera CAM-03")', () => {
    expect(rosterDeviceName(t, mic!, false)).toBe('common.captureDeviceName.microphone{"number":3}');
    expect(rosterDeviceName(t, camera!, false)).toContain('"id":"CAM-03"');
  });
  it('a device that is local only by its id is not local: the class and the adapter decide', () => {
    const plain = registeredDevicesOf(developmentState([device('CAM-03', 'CAMERA')]))[0]!;
    expect(rosterDeviceName(t, plain, true)).toContain('common.developmentRoster.name');
  });
});

describe('known state (a), D128: the microphone limit and the named rate warning', () => {
  it('`rateAtLimit` only for the microphone the active advisory alert targets; never for a camera, a resolved alert or another reason', () => {
    const flags = (alerts: SimAlert[]) => registeredDevicesOf(developmentState(undefined, alerts)).map((entry) => `${entry.id}:${entry.rateAtLimit}`);
    expect(flags([RATE])).toEqual(['CAM-03:false', 'MIC-03:true', 'CAM-04:false']);
    expect(flags([{ ...RATE, active: false }, { ...RATE, id: 'ALR-10', target: 'CAM-03' }, alert('ALR-11', 'MIC-03', { reason: 'AV_OFFSET_NEAR_BOUND' })])).toEqual(['CAM-03:false', 'MIC-03:false', 'CAM-04:false']);
  });

  it('the limits are stated for a development source in Live mode only; the local microphone reads "not fit for recording yet"', () => {
    const [camera, mic, added] = registeredDevicesOf(developmentState());
    expect([rosterLimitKey(mic!, true), rosterLimitKey(camera!, true), rosterLimitKey(added!, true), rosterLimitKey(mic!, false)]).toEqual([
      'common.developmentRoster.limits.localMicrophone',
      'common.developmentRoster.limits.localCamera',
      null,
      null,
    ]);
    expect(en.common.developmentRoster.limits.localMicrophone).toMatch(/^Not fit for recording yet\./);
    expect(en.common.developmentRoster.rateAtLimit.title).toContain('MIC_RATE_AT_LIMIT');
  });
});

describe('M5-SEC-PRIV-2-T / -P (model half): "is on" only from `sourceOpen: true` of the Core\'s local device, in Live mode', () => {
  it('absent member, false, a test source, Simulated mode: nothing; true on the local device: the tablet wording', () => {
    const on = (patch: Partial<Device> & { sourceOpen?: boolean }, live = true) => rosterOnKey(registeredDevicesOf(developmentState([{ ...LOCAL_MIC, ...patch } as Device]))[0]!, live);
    expect([on({}), on({ sourceOpen: false }), on({ sourceOpen: true, adapter: 'FAKE' }), on({ sourceOpen: true }, false)]).toEqual([null, null, null, null]);
    expect(on({ sourceOpen: true })).toBe('common.sourceClass.microphoneOn.mobile');
    expect(rosterOnKey(registeredDevicesOf(developmentState([{ ...LOCAL_CAMERA, sourceOpen: true } as Device]))[0]!, true)).toBe('common.sourceClass.cameraOn.mobile');
    expect(en.common.sourceClass.microphoneOn.mobile).toBe("Core Mac's microphone is on");
  });

  it('the source words follow the adapter kind; an unknown kind reads "Registered device"', () => {
    expect(['LOCAL_DEVICE', 'FAKE', 'ONVIF_RTSP', 'USB_AUDIO', 'NEW_KIND', null].map(rosterSourceKey)).toEqual(['LOCAL_DEVICE', 'FAKE', 'ONVIF_RTSP', 'USB_AUDIO', 'OTHER', 'OTHER'].map((kind) => `common.developmentRoster.source.${kind}`));
  });
});
