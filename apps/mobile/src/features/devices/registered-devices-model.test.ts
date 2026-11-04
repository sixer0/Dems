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
  openLocalSourcesOf,
  sourceOnKeyOf,
  rosterSourceKey,
  rosterStateLabelKey,
} from './registered-devices-model';

type Device = SimState['captureDevices']['devices'][number];
const device = (id: string, kind: Device['kind'], over: Partial<Device> & { sourceOpen?: boolean } = {}): Device => ({ id, kind, model: null, firmware: null, host: null, poePort: null, online: true, streamState: kind === 'CAMERA' ? 'LIVE' : null, capabilities: [], ...over }) as Device;
const LOCAL_CAMERA = device('CAM-05', 'CAMERA', { model: 'MacBook Air Camera', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' });
const LOCAL_MIC = device('MIC-05', 'MIC', { model: 'MacBook Air Microphone', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' }); // D61 (2026-11-04): MIC-03/MIC-04 are built-ins of the four-channel plane; an adopted microphone mints as MIC-05
const ADDED = device('CAM-06', 'CAMERA', { model: 'Vendor PTZ-9000', host: '192.168.10.44', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' });
const alert = (id: string, target: string, params: SimAlert['params'], over: Partial<SimAlert> = {}): SimAlert => ({ id, at: 1, severity: 'INFO', kind: 'SYSTEM', message: 'core text', active: true, acknowledged: false, resolvedAt: null, target, params, ...over });
const RATE = alert('ALR-9', 'MIC-05', { reason: 'MIC_RATE_AT_LIMIT', deviceId: 'MIC-05', deviceKind: 'MIC' }); // D61: the adopted microphone's id

/** A development Core's state: camera 1 and the primary microphone are the Core Mac's; slot 2 keeps the built-ins. */
function developmentState(extra: readonly Device[] = [LOCAL_CAMERA, LOCAL_MIC, ADDED], alerts: readonly SimAlert[] = []): SimState {
  const state = createTestSim().sim.store.getState();
  return {
    ...state,
    alerts: [...alerts],
    captureDevices: { ...state.captureDevices, devices: [...state.captureDevices.devices, ...extra] },
    captureConfig: {
      ...state.captureConfig,
      cameras: state.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, deviceId: 'CAM-05' } : line)),
      mics: state.captureConfig.mics.map((line) => (line.channel === 'MIC-01' ? { ...line, inputId: 'MIC-05', deviceId: 'MIC-05' } : line)), // D61 (2026-11-04): the channel-1 line carries the Mac's microphone; all four lines stand
    },
  } as SimState;
}
const t = (key: string, options?: Record<string, unknown>): string => `${key}${options === undefined ? '' : JSON.stringify(options)}`;

describe('the roster (D137 (2)): the Core\'s device list minus the built-in ids (eight since D61, 2026-11-04)', () => {
  it('an unedited simulator lists none: the screens are as before', () => {
    expect(registeredDevicesOf(createTestSim().sim.store.getState())).toEqual([]);
    // D61 (2026-11-04): four cameras and four microphones are built-in; a registered microphone mints as MIC-05.
    expect(BUILT_IN_SOURCE_IDS).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']);
  });

  it('the Core\'s order; what each is used as from the selector; the PoE switch is no row', () => {
    const roster = registeredDevicesOf(developmentState());
    expect(roster.map((entry) => [entry.id, entry.kind, entry.adapter, entry.sourceClass, entry.slot])).toEqual([
      ['CAM-05', 'CAMERA', 'LOCAL_DEVICE', 'DEVELOPMENT', 'VIDEO-01'],
      ['MIC-05', 'MIC', 'LOCAL_DEVICE', 'DEVELOPMENT', 'MIC-01'], // D61 (2026-11-04): the slot names the CHANNEL, not a role
      ['CAM-06', 'CAMERA', 'ONVIF_RTSP', 'PRODUCTION', null],
    ]);
  });

  it('one flat string for a selector: equal states give the identical string, and it parses back', () => {
    const state = developmentState();
    expect(rosterLine(state)).toBe(rosterLine({ ...state }));
    expect(parseRosterLine(rosterLine(state))).toEqual(registeredDevicesOf(state));
  });

  it('the state: a named cause of the active notice wins over `online`; a resolved notice says nothing', () => {
    const denied = alert('ALR-1', 'CAM-05', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-05', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'PERMISSION_DENIED' }, { severity: 'WARNING' });
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
    // D60/D61 (2026-11-04): the built-ins occupy CAM-01..04 and MIC-01..04; the fixture's added camera is CAM-06 and its local microphone MIC-05.
    expect(rosterDeviceName(t, added!, true)).toBe('common.developmentRoster.name{"kind":"common.developmentRoster.kind.CAMERA","id":"CAM-06"}');
  });
  it('Simulated client mode: the id rule only ("MIC 5", "Camera CAM-05")', () => {
    expect(rosterDeviceName(t, mic!, false)).toBe('common.captureDeviceName.microphone{"number":5}'); // D61: an adopted microphone mints past the four built-ins
    expect(rosterDeviceName(t, camera!, false)).toContain('"id":"CAM-05"'); // D60: an adopted camera mints past the four built-ins
  });
  it('a device that is local only by its id is not local: the class and the adapter decide', () => {
    const plain = registeredDevicesOf(developmentState([device('CAM-05', 'CAMERA')]))[0]!;
    expect(rosterDeviceName(t, plain, true)).toContain('common.developmentRoster.name');
  });
});

describe('known state (a), D128: the microphone limit and the named rate warning', () => {
  it('`rateAtLimit` only for the microphone the active advisory alert targets; never for a camera, a resolved alert or another reason', () => {
    const flags = (alerts: SimAlert[]) => registeredDevicesOf(developmentState(undefined, alerts)).map((entry) => `${entry.id}:${entry.rateAtLimit}`);
    // D60/D61 (2026-11-04): the fixture's roster is CAM-05, MIC-05, CAM-06 (the built-ins CAM-01..04 / MIC-01..04 are no rows).
    expect(flags([RATE])).toEqual(['CAM-05:false', 'MIC-05:true', 'CAM-06:false']);
    expect(flags([{ ...RATE, active: false }, { ...RATE, id: 'ALR-10', target: 'CAM-05' }, alert('ALR-11', 'MIC-05', { reason: 'AV_OFFSET_NEAR_BOUND' })])).toEqual(['CAM-05:false', 'MIC-05:false', 'CAM-06:false']);
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

describe('fix F-M4 (R69-02): `sourceOnKeyOf`, the ONE "is on" rule of every surface (roster, Session New, Session Live, Home)', () => {
  const local = { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' } as const;
  it('true only for the Core\'s local device, open, in Live mode; the kind picks the wording', () => {
    expect(sourceOnKeyOf({ ...local, deviceKind: 'CAMERA', sourceOpen: true }, true)).toBe('common.sourceClass.cameraOn.mobile');
    expect(sourceOnKeyOf({ ...local, deviceKind: 'MIC', sourceOpen: true }, true)).toBe('common.sourceClass.microphoneOn.mobile');
  });
  it('CONTROL: absent, false or a non-boolean member; a test source; a production device; Simulated mode -> null', () => {
    expect([
      sourceOnKeyOf({ ...local, deviceKind: 'CAMERA' }, true),
      sourceOnKeyOf({ ...local, deviceKind: 'CAMERA', sourceOpen: false }, true),
      sourceOnKeyOf({ ...local, deviceKind: 'CAMERA', sourceOpen: 'true' }, true),
      sourceOnKeyOf({ sourceClass: 'DEVELOPMENT', adapter: 'FAKE', deviceKind: 'CAMERA', sourceOpen: true }, true),
      sourceOnKeyOf({ sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP', deviceKind: 'CAMERA', sourceOpen: true }, true),
      sourceOnKeyOf({ adapter: 'LOCAL_DEVICE', deviceKind: 'MIC', sourceOpen: true }, true),
      sourceOnKeyOf({ ...local, deviceKind: 'MIC', sourceOpen: true }, false),
    ]).toEqual([null, null, null, null, null, null, null]);
  });
});

describe('fix F-M4 follow-up (R69-02): `openLocalSourcesOf`, the open local devices a screen does not draw itself', () => {
  const devices = [
    { id: 'CAM-02', kind: 'CAMERA', sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP', sourceOpen: true },
    { id: 'CAM-05', kind: 'CAMERA', sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE', sourceOpen: true },
    { id: 'MIC-03', kind: 'MIC', sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE', sourceOpen: true },
    { id: 'MIC-04', kind: 'MIC', sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' },
  ];
  it('every open local device, in the Core\'s order, minus the ids the screen already draws', () => {
    expect(openLocalSourcesOf(devices, true, [])).toEqual([
      { deviceId: 'CAM-05', key: 'common.sourceClass.cameraOn.mobile' },
      { deviceId: 'MIC-03', key: 'common.sourceClass.microphoneOn.mobile' },
    ]);
    expect(openLocalSourcesOf(devices, true, ['CAM-05'])).toEqual([{ deviceId: 'MIC-03', key: 'common.sourceClass.microphoneOn.mobile' }]);
  });
  it('CONTROL: all drawn, nothing open, or Simulated mode -> empty', () => {
    expect(openLocalSourcesOf(devices, true, ['CAM-05', 'MIC-03'])).toEqual([]);
    expect(openLocalSourcesOf(devices.map(({ sourceOpen: _open, ...rest }) => rest), true, [])).toEqual([]);
    expect(openLocalSourcesOf(devices, false, [])).toEqual([]);
  });
});
