// The loader of the class-C adapters refuses every operation but REAL_PRODUCTION before it
// imports anything (blueprint row 65; check M4-FAKE-1 "real adapters = class C, not executed").
// This is the ONE test file that may import the loader (static.test.ts pins it).
//
// Task 4 row 85 (WP-13b; design addendum 6.4): the loader takes (operation, devices, dependencies)
// and the production registry builder of the fence calls it. Until the lift (row 88) the loader
// still loads the three class-C STUBS - files that build nothing and state no opener - so the one
// block below that calls it for REAL_PRODUCTION evaluates no built adapter through it. The two BUILT
// adapters are constructed here directly, from the same dependency bundle, to prove that the bundle
// is everything they need, and handed to a real registry to prove that it still refuses them.
import { describe, expect, it } from 'vitest';
import { createSystemTimers } from '../../timers';
import { CaptureDeviceAdmission, buildProductionRegistryOf, type FenceExecutor, type ProductionAdapterLoader } from '../../fence';
import { createUsbAudioProductionAdapter, type UsbAudioProductionOptions } from '../audio/usb-audio-production';
import { createOnvifRelayCameraAdapter, type OnvifRelayCameraDependencies } from '../camera/onvif-relay';
import { CaptureAdapterError } from '../errors';
import { CaptureOperation } from '../kinds';
import { loadProductionAdapters, type ProductionAdapterDependencies } from '../real';

/** The two shapes the bundle has after the lift: the built adapters' own option types. */
type CameraBundle = OnvifRelayCameraDependencies;
type AudioBundle = Omit<UsbAudioProductionOptions, 'devices'>;

/** The stored registry of a commissioned production room beside what a seeded database still holds. */
const STORED_ROWS = [
  { id: 'CAM-01', kind: 'CAMERA', adapterKind: 'FAKE', model: 'Test camera' },
  { id: 'CAM-11', kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', model: 'Room camera A' },
  { id: 'CAM-12', kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', model: null },
  { id: 'MIC-01', kind: 'MIC', adapterKind: 'LOCAL_DEVICE', model: 'This Mac' },
  { id: 'MIC-11', kind: 'MIC', adapterKind: 'USB_AUDIO', model: 'Interface input 1' },
  { id: 'MIC-12', kind: 'MIC', adapterKind: 'USB_AUDIO', model: 'Interface input 2' },
  { id: 'POE-SWITCH', kind: 'POE', adapterKind: 'FAKE', model: 'Switch' },
];

/** Doubles of everything the two adapters are built from. None starts a process, opens a socket or reads a host. */
function rig() {
  const calls: string[] = [];
  const never = (name: string) => async (): Promise<never> => {
    calls.push(name);
    throw new Error(`${name} is not expected in a build`);
  };
  const timers = createSystemTimers();
  const camera: CameraBundle = {
    door: (() => {
      calls.push('door');
      throw new Error('the door is not expected in a build');
    }) as CameraBundle['door'],
    relayProgram: '/opt/dems/bin/capture-relay',
    timers,
    credentials: { sessionOpen: never('credentials.sessionOpen') },
    locator: { locate: never('locator.locate') } as unknown as CameraBundle['locator'],
    stream: never('stream'),
  };
  const audio: AudioBundle = {
    registered: never('registered'),
    cards: { list: never('cards.list') } as unknown as AudioBundle['cards'],
    configWriter: { write: never('configWriter.write') } as unknown as AudioBundle['configWriter'],
    helperProgram: '/opt/dems/bin/ffmpeg',
    guardProgram: '/opt/dems/bin/capture-guard',
    runDir: '/var/lib/dems/run/capture',
    timers,
  };
  const dependencies: ProductionAdapterDependencies<CameraBundle, AudioBundle> = { camera, audio };
  const queries: string[] = [];
  const executor: FenceExecutor = {
    async query<Row extends Record<string, unknown>>(text: string): Promise<{ rows: Row[] }> {
      queries.push(text);
      return { rows: STORED_ROWS as unknown as Row[] };
    },
  };
  return { calls, dependencies, queries, executor };
}

describe('the class-C loader', () => {
  it('refuses SIMULATED and REAL_DEVELOPMENT with a typed error, whatever it is handed; and REAL_PRODUCTION without its dependency bundle', async () => {
    const none = { cameras: [], mics: [], switches: [] };
    const { dependencies, calls } = rig();
    for (const operation of ['SIMULATED', 'REAL_DEVELOPMENT'] as const) {
      const attempt = loadProductionAdapters(operation, none, dependencies);
      await expect(attempt).rejects.toBeInstanceOf(CaptureAdapterError);
      await expect(attempt).rejects.toMatchObject({ code: 'CAPTURE_REAL_ADAPTERS_REFUSED' });
    }
    for (const missing of [undefined, null, {}, { camera: dependencies.camera }, { audio: dependencies.audio }]) {
      await expect(loadProductionAdapters('REAL_PRODUCTION', none, missing as never)).rejects.toMatchObject({ code: 'CAPTURE_ADAPTER_INVALID' });
    }
    expect(calls).toEqual([]);
  });
});

describe('task 4 row 85: the production registry builder (WP-13b)', () => {
  it('SIMULATED and REAL_DEVELOPMENT are refused BEFORE the stored registry is read and before the loader is asked; nothing of the bundle is touched', async () => {
    for (const operation of [CaptureOperation.SIMULATED, CaptureOperation.REAL_DEVELOPMENT]) {
      const { dependencies, queries, executor, calls } = rig();
      let loads = 0;
      const load: ProductionAdapterLoader<CameraBundle, AudioBundle> = async (...parameters) => ((loads += 1), loadProductionAdapters(...parameters));
      const attempt = buildProductionRegistryOf({ operation, executor, dependencies, load, audioCards: async () => 'cards' });
      await expect(attempt).rejects.toBeInstanceOf(CaptureAdapterError);
      await expect(attempt).rejects.toMatchObject({ code: 'CAPTURE_REAL_ADAPTERS_REFUSED' });
      expect([queries, loads, calls]).toEqual([[], 0, []]);
    }
  });

  it('REAL_PRODUCTION: it reads the stored devices itself, serves the rows of the three production kinds through the loader, and supplies the list, the open sources, the probe adapters, admission, the card listing and the close - and NOTHING is recordable before the lift', async () => {
    const { dependencies, queries, executor, calls } = rig();
    const handed: unknown[] = [];
    const load: ProductionAdapterLoader<CameraBundle, AudioBundle> = async (operation, devices, bundle) => {
      handed.push(bundle);
      return loadProductionAdapters(operation, devices, bundle);
    };
    let listings = 0;
    const checked: string[] = [];
    const built = await buildProductionRegistryOf({
      operation: CaptureOperation.REAL_PRODUCTION,
      executor,
      dependencies,
      load,
      audioCards: async () => `listing ${(listings += 1)}`,
      checkCamera: async (deviceId) => void checked.push(deviceId),
      locked: () => false,
    });
    // ONE read of the stored registry, and the bundle went to the loader as it was handed in.
    // Task 4 row 85c moved this pin by delta (1 -> 2): the builder also makes the wider read of the stored profile lists, once.
    expect(queries).toHaveLength(2);
    expect(queries.filter((text) => /\bd\.profiles\b/.test(text))).toHaveLength(1);
    expect(handed).toEqual([dependencies]);
    expect(handed[0]).toBe(dependencies);
    // The expected devices: the four production rows; no development row, and the FAKE switch of the seed is none of them.
    expect(built.devices().map((device) => `${device.id}:${device.adapterKind}`)).toEqual(['CAM-11:ONVIF_RTSP', 'CAM-12:ONVIF_RTSP', 'MIC-11:USB_AUDIO', 'MIC-12:USB_AUDIO']);
    expect(built.registry.operation).toBe('REAL_PRODUCTION');
    expect(built.registry.list().map((device) => [device.id, device.deviceClass, device.adapterKind, device.sourceClass, device.label, device.hasOpener])).toEqual([
      ['CAM-11', 'CAMERA', 'ONVIF_RTSP', 'PRODUCTION', 'Room camera A', false],
      ['CAM-12', 'CAMERA', 'ONVIF_RTSP', 'PRODUCTION', 'CAM-12', false],
      ['MIC-11', 'MIC', 'USB_AUDIO', 'PRODUCTION', 'Interface input 1', false],
      ['MIC-12', 'MIC', 'USB_AUDIO', 'PRODUCTION', 'Interface input 2', false],
    ]);
    // Assignable (the class is the operation's) and NOT recordable: class C stands until row 88.
    expect(built.registry.assertAssignable('CAMERA', 'CAM-11').id).toBe('CAM-11');
    expect(built.registry.assertAssignable('MIC', 'MIC-12').id).toBe('MIC-12');
    for (const deviceId of ['CAM-11', 'CAM-12', 'MIC-11', 'MIC-12']) expect(() => built.registry.assertRecordable(deviceId), deviceId).toThrow(expect.objectContaining({ code: 'SOURCE_KIND_NOT_RECORDABLE' }));
    expect(built.registry.openerKinds()).toEqual([]);
    expect(() => built.registry.assertAssignable('CAMERA', 'CAM-01')).toThrow(expect.objectContaining({ code: 'CAPTURE_DEVICE_UNKNOWN' }));
    // What a built registry supplies (addendum 6.1 fact 4), plus the card listing.
    expect(built.openSources()).toEqual([]);
    const probe = built.probeAdapters();
    expect([probe?.cameras.length, probe?.microphones.length]).toEqual([1, 1]);
    await probe?.readCamera(built.registry.cameraAdapters()[0] as never, 'CAM-11', new AbortController().signal);
    expect(checked).toEqual(['CAM-11']);
    expect([await built.audioCards(), await built.audioCards()]).toEqual(['listing 1', 'listing 2']);
    expect(built.admit({ id: 'CAM-11', kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', model: null })).toBe(CaptureDeviceAdmission.ALREADY_SERVED);
    expect(built.admit({ id: 'CAM-13', kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', model: null })).toBe(CaptureDeviceAdmission.NOT_SERVED);
    expect(built.admit({ id: 'CAM-01', kind: 'CAMERA', adapterKind: 'FAKE', model: null })).toBe(CaptureDeviceAdmission.NOT_SERVED);
    await built.closeAll();
    // The build itself touched no door, no reader, no host.
    expect(calls).toEqual([]);
  });

  it('THE BUNDLE IS EVERYTHING THE TWO BUILT ADAPTERS NEED: both are constructed from it (doubles), each states its opener - and a real registry still REFUSES them (T-3), through the builder too, which closes what was built', async () => {
    const { dependencies, executor, calls } = rig();
    const none = { cameras: [], mics: [], switches: [] };
    const stubs = await loadProductionAdapters(CaptureOperation.REAL_PRODUCTION, none, dependencies);
    let closed = 0;
    const load: ProductionAdapterLoader<CameraBundle, AudioBundle> = async (_operation, devices, bundle) => {
      // What the loader does after the lift, with the bundle the builder handed on.
      const camera = createOnvifRelayCameraAdapter(devices.cameras, bundle.camera);
      const audio = createUsbAudioProductionAdapter({ devices: devices.mics, ...bundle.audio });
      expect([camera.kind, camera.hasOpener, camera.devices.map((device) => device.id)]).toEqual(['ONVIF_RTSP', true, ['CAM-11', 'CAM-12']]);
      expect([audio.kind, audio.hasOpener, audio.devices.map((device) => device.id)]).toEqual(['USB_AUDIO', true, ['MIC-11', 'MIC-12']]);
      expect(typeof camera.relayReports.subscribe).toBe('function');
      const closeAll = audio.closeAll.bind(audio);
      return { camera, audio: Object.assign(audio, { closeAll: async () => ((closed += 1), closeAll()) }), poe: stubs.poe };
    };
    const attempt = buildProductionRegistryOf({ operation: CaptureOperation.REAL_PRODUCTION, executor, dependencies, load, audioCards: async () => null });
    await expect(attempt).rejects.toMatchObject({ code: 'CAPTURE_ADAPTER_INVALID' });
    expect(closed).toBe(1);
    // Constructing opened nothing and read nothing.
    expect(calls).toEqual([]);
  });
});
