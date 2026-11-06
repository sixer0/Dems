// Task 3 R-11, blueprint row 140: the pure roster of the devices the Core registered beyond the
// built-in ids (ruling D137 (2); ux §8f flow 12, §8f.3; D83, D128, D131, D136 (3)). Real simulator
// state from `createTestSim`, with the `captureDevices` slice holding what a Core would send. No React.
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { SimAlert, SimState } from '@dems/shared/sim';
import { createTestSim } from '@/runtime/testing/test-sim';
import { en } from '@dems/shared/i18n';
import {
  BUILT_IN_SOURCE_IDS,
  drawnByOwnTile,
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
/**
 * One roster entry by its id. Audit row 190 (M3-08 R1, D92): the fixture moves the seed's `CAM-01` and `MIC-01` off their
 * own lines, so they are roster entries too (G70c-08) and the roster's order no longer starts with the added devices -
 * the cases below pick their device by id instead of by position.
 */
const entryOf = (state: SimState, id: string) => registeredDevicesOf(state).find((entry) => entry.id === id)!;

describe('the roster (D137 (2)): the Core\'s device list minus the built-in ids (eight since D61, 2026-11-04)', () => {
  it('an unedited simulator lists none: the screens are as before', () => {
    expect(registeredDevicesOf(createTestSim().sim.store.getState())).toEqual([]);
    // D61 (2026-11-04): four cameras and four microphones are built-in; a registered microphone mints as MIC-05.
    expect(BUILT_IN_SOURCE_IDS).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']);
  });

  it('the Core\'s order; what each is used as from the selector; the PoE switch is no row', () => {
    const roster = registeredDevicesOf(developmentState());
    expect(roster.map((entry) => [entry.id, entry.kind, entry.adapter, entry.sourceClass, entry.slot])).toEqual([
      // Audit row 190 (M3-08 R1, D92; G70c-08): the seed's CAM-01 and MIC-01 left their own lines in this fixture, so they are roster entries on no line.
      ['CAM-01', 'CAMERA', null, null, null],
      ['MIC-01', 'MIC', null, null, null],
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
    const of = (alerts: SimAlert[], online = true) => rosterDeviceState(entryOf(developmentState([{ ...LOCAL_CAMERA, online }], alerts), 'CAM-05'));
    expect([of([]), of([], false), of([denied], false), of([{ ...denied, active: false }])]).toEqual(['READY', 'ABSENT', 'PERMISSION_DENIED', 'READY']);
    expect(rosterStateLabelKey('PERMISSION_DENIED', true)).toBe('features.capture-selector.localDevice.state.PERMISSION_DENIED');
    expect([rosterStateLabelKey('READY', false), rosterStateLabelKey('ABSENT', false)]).toEqual(['common.developmentRoster.reachable', 'common.developmentRoster.notReachable']);
  });
});

describe('names (D83, OP-125-7): "Core Mac\'s ..." only for the Core\'s local device and only in Live mode', () => {
  const [camera, mic, added] = ['CAM-05', 'MIC-05', 'CAM-06'].map((id) => entryOf(developmentState(), id));
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
    const plain = entryOf(developmentState([device('CAM-05', 'CAMERA')]), 'CAM-05');
    expect(rosterDeviceName(t, plain, true)).toContain('common.developmentRoster.name');
  });
});

describe('known state (a), D128: the microphone limit and the named rate warning', () => {
  it('`rateAtLimit` only for the microphone the active advisory alert targets; never for a camera, a resolved alert or another reason', () => {
    const flags = (alerts: SimAlert[]) => registeredDevicesOf(developmentState(undefined, alerts)).map((entry) => `${entry.id}:${entry.rateAtLimit}`);
    // D60/D61 (2026-11-04): the fixture's roster is CAM-05, MIC-05, CAM-06 beyond the seed. Audit row 190 (M3-08 R1, D92): the seed's
    // CAM-01 and MIC-01, moved off their own lines by the fixture, are roster entries too; the built-ins on their own lines are no rows.
    expect(flags([RATE])).toEqual(['CAM-01:false', 'MIC-01:false', 'CAM-05:false', 'MIC-05:true', 'CAM-06:false']);
    expect(flags([{ ...RATE, active: false }, { ...RATE, id: 'ALR-10', target: 'CAM-05' }, alert('ALR-11', 'MIC-05', { reason: 'AV_OFFSET_NEAR_BOUND' })])).toEqual(['CAM-01:false', 'MIC-01:false', 'CAM-05:false', 'MIC-05:false', 'CAM-06:false']);
  });

  it('the limits are stated for a development source in Live mode only; the local microphone reads "not fit for recording yet"', () => {
    const [camera, mic, added] = ['CAM-05', 'MIC-05', 'CAM-06'].map((id) => entryOf(developmentState(), id));
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
    const on = (patch: Partial<Device> & { sourceOpen?: boolean }, live = true) => rosterOnKey(entryOf(developmentState([{ ...LOCAL_MIC, ...patch } as Device]), 'MIC-05'), live);
    expect([on({}), on({ sourceOpen: false }), on({ sourceOpen: true, adapter: 'FAKE' }), on({ sourceOpen: true }, false)]).toEqual([null, null, null, null]);
    expect(on({ sourceOpen: true })).toBe('common.sourceClass.microphoneOn.mobile');
    expect(rosterOnKey(entryOf(developmentState([{ ...LOCAL_CAMERA, sourceOpen: true } as Device]), 'CAM-05'), true)).toBe('common.sourceClass.cameraOn.mobile');
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

// Audit row 190 (M3-08 R1/R2; D92, the web's row 131 `drawnByOwnTile`; register P10). The bench Core of 2026-11-05 mints
// its registry ids from the seed's pattern: ONVIF `CAM-03`/`CAM-04` on VIDEO-01/02 and USB `MIC-03`/`MIC-04` on channels
// 1/2. The earlier rule skipped every built-in id and so hid exactly the devices feeding the tracks (U-09 on the web).
describe('row 190 (M3-08 R1, D92): a built-in id is omitted only on its OWN line', () => {
  /** The bench shape: CAM-03/CAM-04 feed VIDEO-01/02, MIC-03/MIC-04 feed channels 1/2; a minted CAM-07 is on no line. */
  function benchState(): SimState {
    const state = createTestSim().sim.store.getState();
    const camOn: Record<string, string> = { 'VIDEO-01': 'CAM-03', 'VIDEO-02': 'CAM-04' };
    const micOn: Record<string, string> = { 'MIC-01': 'MIC-03', 'MIC-02': 'MIC-04' };
    return {
      ...state,
      captureDevices: { ...state.captureDevices, devices: [...state.captureDevices.devices, device('CAM-07', 'CAMERA', { adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' })] },
      captureConfig: {
        ...state.captureConfig,
        cameras: state.captureConfig.cameras.filter((line) => line.trackId === 'VIDEO-01' || line.trackId === 'VIDEO-02').map((line) => ({ ...line, deviceId: camOn[line.trackId]! })),
        mics: state.captureConfig.mics.filter((line) => line.channel === 'MIC-01' || line.channel === 'MIC-02').map((line) => ({ ...line, deviceId: micOn[line.channel as string]! })),
      },
    } as SimState;
  }

  it('CAM-03 on VIDEO-01 is listed exactly once, with its line; MIC-03 on channel 1 likewise; a minted id is listed', () => {
    const roster = registeredDevicesOf(benchState());
    const ids = roster.map((entry) => entry.id);
    expect(ids.filter((id) => id === 'CAM-03')).toHaveLength(1);
    expect(ids.filter((id) => id === 'MIC-03')).toHaveLength(1);
    expect(entryOf(benchState(), 'CAM-03').slot).toBe('VIDEO-01');
    expect(entryOf(benchState(), 'MIC-03').slot).toBe('MIC-01');
    expect(ids).toContain('CAM-07');
    // Every camera and microphone of the Core's list appears at most once.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('CAM-01 on VIDEO-01 (its own line) is NOT listed; MIC-01 on channel MIC-01 is NOT listed (the fixed rows draw them)', () => {
    const seed = createTestSim().sim.store.getState();
    expect(seed.captureConfig.cameras.find((line) => line.trackId === 'VIDEO-01')?.deviceId).toBe('CAM-01');
    expect(registeredDevicesOf(seed).map((entry) => entry.id)).toEqual([]);
    expect(drawnByOwnTile(seed.captureConfig, { id: 'CAM-01', kind: 'CAMERA' })).toBe(true);
    expect(drawnByOwnTile(seed.captureConfig, { id: 'MIC-01', kind: 'MIC' })).toBe(true);
  });

  it('drawnByOwnTile: a built-in id on another line or on none is no tile\'s; a minted id never is; the PoE switch is no tile\'s', () => {
    const bench = benchState();
    expect(drawnByOwnTile(bench.captureConfig, { id: 'CAM-03', kind: 'CAMERA' })).toBe(false); // on VIDEO-01, not VIDEO-03
    expect(drawnByOwnTile(bench.captureConfig, { id: 'CAM-01', kind: 'CAMERA' })).toBe(false); // on no line (G70c-08)
    expect(drawnByOwnTile(bench.captureConfig, { id: 'MIC-04', kind: 'MIC' })).toBe(false); // on channel MIC-02
    expect(drawnByOwnTile(bench.captureConfig, { id: 'CAM-07', kind: 'CAMERA' })).toBe(false);
    expect(drawnByOwnTile(bench.captureConfig, { id: 'POE-SWITCH', kind: 'POE' })).toBe(false);
  });
});

describe('row 190 (M3-08 R2, register P10): `checkedAt` and `reach` are the typed members; a stated NOT_REACHABLE is never hidden', () => {
  it('reach is carried as stated (null when absent); a stated reach or a finite checkedAt is a checked fact', () => {
    const of = (patch: Partial<Device>) => entryOf(developmentState([{ ...ADDED, ...patch }]), 'CAM-06');
    expect([of({}).reach, of({ reach: 'REACHABLE' }).reach, of({ reach: 'NOT_REACHABLE' }).reach, of({ reach: null }).reach]).toEqual([null, 'REACHABLE', 'NOT_REACHABLE', null]);
    expect([of({}).checked, of({ checkedAt: 1_793_900_000_000 }).checked, of({ reach: 'REACHABLE' }).checked, of({ checkedAt: null }).checked]).toEqual([false, true, true, false]);
  });

  it('the state: NOT_REACHABLE with `online: true` reads not reachable; REACHABLE / no reach keep the registry rule', () => {
    const state = (patch: Partial<Device>) => rosterDeviceState(entryOf(developmentState([{ ...ADDED, ...patch }]), 'CAM-06'));
    expect([state({ reach: 'NOT_REACHABLE', checkedAt: 1 }), state({ reach: 'REACHABLE', checkedAt: 1 }), state({}), state({ online: false, reach: 'REACHABLE' })]).toEqual(['ABSENT', 'READY', 'READY', 'ABSENT']);
    expect(rosterStateLabelKey(state({ reach: 'NOT_REACHABLE', checkedAt: 1 }), false)).toBe('common.developmentRoster.notReachable');
  });

  it('no `as { readonly checkedAt?: unknown }` cast remains in the roster model', () => {
    const source = readFileSync(join(__dirname, 'registered-devices-model.ts'), 'utf8');
    expect(source.match(/as \{ readonly checkedAt\?: unknown \}/g) ?? []).toHaveLength(0);
    expect(source.match(/as \{ readonly reach\?/g) ?? []).toHaveLength(0);
  });
});
