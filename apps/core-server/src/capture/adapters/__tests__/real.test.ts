// The loader of the class-C adapters refuses every operation but REAL_PRODUCTION before it
// imports anything (blueprint row 65; check M4-FAKE-1 "real adapters = class C, not executed").
// This is the ONE test file that may import the loader (static.test.ts pins it).
//
// Task 4 row 85 (WP-13b; design addendum 6.4): the loader takes (operation, devices, dependencies)
// and the production registry builder of the fence calls it. SINCE THE LIFT (task 4 row 88,
// decision AM-1) the loader builds the two BUILT adapters - the camera always, the microphone with
// its opener where the bundle carries one (`linux`), else the `USB_AUDIO` adapter WITHOUT an opener
// (`darwin` and every other platform: AM-1 (3)(h) with the erratum of C135). Everything below runs
// on doubles: no process, no socket, no device, no host read.
import { describe, expect, it } from 'vitest';
import { createSystemTimers } from '../../timers';
import { assertRecordableSelector } from '../../../modules/capture-config';
import {
  CaptureDeviceAdmission,
  MACOS_MICROPHONE_OPENER_ADMITTED,
  assertSessionSourcesOfOperation,
  buildProductionRegistryOf,
  buildSessionCaptureSources,
  macosLossMatchOf,
  wireProductionRegistry,
  type CaptureFenceSinks,
  type FenceExecutor,
  type ProductionAdapterLoader,
  type ProductionCaptureParts,
} from '../../fence';
import type { CaptureCard } from '../audio/card-listing';
import type { MicLossWatch } from '../audio/mic-loss';
import type { MacosTiedListing } from '../audio/macos-card-listing';
import type { UsbAudioMacosOptions } from '../audio/usb-audio-macos';
import type { RegisteredAudioInput, UsbAudioProductionOptions } from '../audio/usb-audio-production';
import type { OnvifRelayCameraDependencies } from '../camera/onvif-relay';
import { CaptureAdapterError } from '../errors';
import { CaptureAdapterKind, CaptureOperation } from '../kinds';
import { loadProductionAdapters, type ProductionAdapterDependencies } from '../real';
import { createCaptureDeviceRegistry } from '../registry';
import type { CaptureDeviceRegistry } from '../types';

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
    // Finding E-02 (review 60e): the listener of a relay's end is REQUIRED; a build starts no relay, so it hears nothing here.
    relayEnded: () => {
      calls.push('relayEnded');
    },
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
  const dependencies: ProductionAdapterDependencies = { camera, audio };
  const queries: string[] = [];
  const executor: FenceExecutor = {
    async query<Row extends Record<string, unknown>>(text: string): Promise<{ rows: Row[] }> {
      queries.push(text);
      // The wider read of row 85c: every stored camera has the one profile of the selector below.
      if (/\bd\.profiles\b/.test(text)) return { rows: STORED_ROWS.map((row) => ({ id: row.id, profiles: row.kind === 'CAMERA' ? [PROFILE] : [] })) as unknown as Row[] };
      return { rows: STORED_ROWS as unknown as Row[] };
    },
  };
  return { calls, dependencies, queries, executor, camera, audio, timers };
}

const PROFILE = 'H264_1080P25';
/** The four slots of a production room, as operation 78 / 79 would have assigned them. */
const PRODUCTION_SELECTOR = {
  cameras: [{ trackId: 'VIDEO-01' as const, deviceId: 'CAM-11', profile: PROFILE }, { trackId: 'VIDEO-02' as const, deviceId: 'CAM-12', profile: PROFILE }],
  mics: [{ deviceId: 'MIC-11', role: 'PRIMARY' as const }, { deviceId: 'MIC-12', role: 'STANDBY' as const }],
};
const SESSION = 'SES-20261014-0088';
const codeOf = (work: () => unknown): string => {
  try {
    work();
    return 'ADMITTED';
  } catch (error) {
    return String((error as { code?: unknown; reason?: unknown }).code ?? (error as { reason?: unknown }).reason ?? error);
  }
};
/**
 * THE SESSION START'S ADMISSION, on a built registry: the plan builder's check of the four slots (`assertRecordableSelector`),
 * the four source rows (`buildSessionCaptureSources`) and their read-back (`assertSessionSourcesOfOperation`) - the three lines
 * a REAL_PRODUCTION start passes before the worker is asked. 'ADMITTED', or the code of the first refusal.
 */
const admissionOf = (registry: CaptureDeviceRegistry): string =>
  codeOf(() => {
    const { slots } = assertRecordableSelector(PRODUCTION_SELECTOR, registry);
    const rows = buildSessionCaptureSources({ sessionId: SESSION, operation: registry.operation, slots, recordedAt: 1_760_400_000_000 });
    assertSessionSourcesOfOperation(rows, registry.operation);
  });

// ── Row N10: a macOS host's tied listing, on doubles (every value synthetic) ─────────────────────
/** The stored row of `MIC-11`, as the registration stores an input of a macOS USB interface. */
const STORED_MIC: RegisteredAudioInput = { deviceId: 'MIC-11', usbId: '1a2b:0006', usbSerial: null, usbPort: '01120000', cardId: 'usb_01120000', cardDevice: 0, inputNumber: 1, nativeChannels: 6 };
const MIC_CARD = { cardIndex: 1, deviceIndex: 0, cardId: 'usb_01120000', usb: true, usbId: '1a2b:0006', usbPort: '01120000', usbSerial: null, product: 'DEMS Hexa 6', channelCount: 6, factsSource: 'SYSTEM_PROFILE', formats: [], nativeFormat: 'S32_LE', sampleBits: [], ratesHz: [48_000], rateRangeHz: null } as unknown as CaptureCard;
/** One tied listing: the card present, absent, or connected and UNDECIDED (two units under one name). */
const tiedOf = (state: 'PRESENT' | 'ABSENT' | 'UNDECIDED'): MacosTiedListing => {
  const cards = state === 'PRESENT' ? [MIC_CARD] : [];
  const undecided = state === 'UNDECIDED' ? [{ reason: 'NAME_SHARED' as const, usbId: '1a2b:0006', usbPort: '01120000', usbSerial: null }] : [];
  return { ok: true, listing: { cards, truncated: false, skipped: undecided.length }, cards, undecided, refusedDevices: 0, passedOver: 0, captureOrderMark: 0, captureEntries: cards.length };
};
const UNREADABLE: MacosTiedListing = { ok: false, failure: 'SYSTEM_LIST_UNREADABLE', detail: 'NOT_JSON' } as unknown as MacosTiedListing;

describe('the production loader', () => {
  it('refuses SIMULATED and REAL_DEVELOPMENT with a typed error, whatever it is handed; and REAL_PRODUCTION without its dependency bundle', async () => {
    const none = { cameras: [], mics: [], switches: [] };
    const { dependencies, calls } = rig();
    for (const operation of ['SIMULATED', 'REAL_DEVELOPMENT'] as const) {
      const attempt = loadProductionAdapters(operation, none, dependencies);
      await expect(attempt).rejects.toBeInstanceOf(CaptureAdapterError);
      await expect(attempt).rejects.toMatchObject({ code: 'CAPTURE_REAL_ADAPTERS_REFUSED' });
    }
    // Row 88: `audio` must be STATED - a bundle or null - and the camera bundle must be there.
    for (const missing of [undefined, null, {}, { camera: dependencies.camera }, { audio: dependencies.audio }, { camera: dependencies.camera, audio: undefined }, { camera: null, audio: null }]) {
      await expect(loadProductionAdapters('REAL_PRODUCTION', none, missing as never)).rejects.toMatchObject({ code: 'CAPTURE_ADAPTER_INVALID' });
    }
    expect(calls).toEqual([]);
  });

  // Task 4 row N10 (SM-21: by platform, NEVER BOTH; C135 (3)). The loader reads no platform: the wiring hands it at most one
  // microphone bundle. Mutant (the "never both" check removed): RED - both bundles build the Linux adapter.
  it('row N10: the macOS bundle builds the macOS adapter (its opener stated); both bundles, or a macOS bundle that is no object, are refused before anything is imported; neither builds the adapter without an opener', async () => {
    const { dependencies, calls, timers } = rig();
    const mics = [{ id: 'MIC-11', deviceClass: 'MIC' as const, label: 'A', capabilities: ['AUDIO' as const], profiles: [] }];
    const macosAudio: Omit<UsbAudioMacosOptions, 'devices'> = {
      registered: async () => null,
      cards: { listTied: async () => UNREADABLE, list: async () => ({ cards: [], truncated: false, skipped: 0 }) },
      helperProgram: '/opt/dems/bin/ffmpeg',
      guardProgram: '/opt/dems/bin/capture-guard',
      runDir: '/nonexistent/dems-run/capture',
      timers,
      pipes: { hold: async () => ({ drain: () => {}, release: () => {} }) },
    };
    const built = await loadProductionAdapters(CaptureOperation.REAL_PRODUCTION, { cameras: [], mics, switches: [] }, { camera: dependencies.camera, audio: null, macosAudio });
    expect([built.audio.kind, built.audio.hasOpener, typeof (built.audio as { groupOf?: unknown }).groupOf, built.audio.devices.map((entry) => entry.id)]).toEqual(['USB_AUDIO', true, 'function', ['MIC-11']]);
    // The Linux adapter has no capture group; the stub has no opener.
    const linux = await loadProductionAdapters(CaptureOperation.REAL_PRODUCTION, { cameras: [], mics, switches: [] }, { ...dependencies, macosAudio: null });
    expect([linux.audio.hasOpener, typeof (linux.audio as { groupOf?: unknown }).groupOf]).toEqual([true, 'undefined']);
    const neither = await loadProductionAdapters(CaptureOperation.REAL_PRODUCTION, { cameras: [], mics, switches: [] }, { camera: dependencies.camera, audio: null });
    expect(neither.audio.hasOpener).toBe(false);
    for (const refused of [{ ...dependencies, macosAudio }, { camera: dependencies.camera, audio: null, macosAudio: 'darwin' }]) {
      await expect(loadProductionAdapters(CaptureOperation.REAL_PRODUCTION, { cameras: [], mics, switches: [] }, refused as never)).rejects.toMatchObject({ code: 'CAPTURE_ADAPTER_INVALID' });
    }
    expect(calls).toEqual([]);
  });
});

describe('task 4 row 85: the production registry builder (WP-13b)', () => {
  it('SIMULATED and REAL_DEVELOPMENT are refused BEFORE the stored registry is read and before the loader is asked; nothing of the bundle is touched', async () => {
    for (const operation of [CaptureOperation.SIMULATED, CaptureOperation.REAL_DEVELOPMENT]) {
      const { dependencies, queries, executor, calls } = rig();
      let loads = 0;
      const load: ProductionAdapterLoader<CameraBundle, ProductionAdapterDependencies['audio']> = async (...parameters) => ((loads += 1), loadProductionAdapters(...parameters));
      const attempt = buildProductionRegistryOf({ operation, executor, dependencies, load, audioCards: async () => 'cards' });
      await expect(attempt).rejects.toBeInstanceOf(CaptureAdapterError);
      await expect(attempt).rejects.toMatchObject({ code: 'CAPTURE_REAL_ADAPTERS_REFUSED' });
      expect([queries, loads, calls]).toEqual([[], 0, []]);
    }
  });

  it('REAL_PRODUCTION (a linux bundle): it reads the stored devices itself, serves the rows of the three production kinds through the loader, and supplies the list, the open sources, the probe adapters, admission, the card listing and the close - and SINCE THE LIFT the four sources are recordable', async () => {
    const { dependencies, queries, executor, calls } = rig();
    const handed: unknown[] = [];
    const load: ProductionAdapterLoader<CameraBundle, ProductionAdapterDependencies['audio']> = async (operation, devices, bundle) => {
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
      ['CAM-11', 'CAMERA', 'ONVIF_RTSP', 'PRODUCTION', 'Room camera A', true],
      ['CAM-12', 'CAMERA', 'ONVIF_RTSP', 'PRODUCTION', 'CAM-12', true],
      ['MIC-11', 'MIC', 'USB_AUDIO', 'PRODUCTION', 'Interface input 1', true],
      ['MIC-12', 'MIC', 'USB_AUDIO', 'PRODUCTION', 'Interface input 2', true],
    ]);
    // Assignable (the class is the operation's) and - SINCE THE LIFT (row 88, AM-1) - recordable: both kinds state their opener.
    expect(built.registry.assertAssignable('CAMERA', 'CAM-11').id).toBe('CAM-11');
    expect(built.registry.assertAssignable('MIC', 'MIC-12').id).toBe('MIC-12');
    for (const deviceId of ['CAM-11', 'CAM-12', 'MIC-11', 'MIC-12']) expect(built.registry.assertRecordable(deviceId).id).toBe(deviceId);
    expect(built.registry.openerKinds()).toEqual(['ONVIF_RTSP', 'USB_AUDIO']);
    // THE LINUX PROOF on doubles: a four-slot REAL_PRODUCTION session start is ADMITTED through the builder's registry.
    expect(admissionOf(built.registry)).toBe('ADMITTED');
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

  it('THE BUNDLE IS EVERYTHING THE TWO BUILT ADAPTERS NEED: the loader builds both from it, each states its opener; a DEVELOPMENT registry refuses the camera WITH its opener and SNMP_POE with an opener is refused anywhere (refusals 2 of 2); a refused build closes what was built', async () => {
    const { dependencies, executor, calls } = rig();
    const none = { cameras: [], mics: [], switches: [] };
    const adapters = await loadProductionAdapters(CaptureOperation.REAL_PRODUCTION, { ...none, cameras: [{ id: 'CAM-11', deviceClass: 'CAMERA', label: 'A', capabilities: ['VIDEO'], profiles: [PROFILE] }] }, dependencies);
    expect([adapters.camera.kind, adapters.camera.hasOpener, typeof adapters.camera.relayReports.subscribe]).toEqual(['ONVIF_RTSP', true, 'function']);
    expect([adapters.audio.kind, adapters.audio.hasOpener]).toEqual(['USB_AUDIO', true]);
    expect([adapters.poe.kind, adapters.poe.seam]).toEqual(['SNMP_POE', 'POE']);
    // REFUSAL 2: the built camera WITH its opener in a REAL_DEVELOPMENT registry (where the kind is registrable for its search half only).
    expect(codeOf(() => createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_DEVELOPMENT }).register(adapters.camera))).toBe('CAPTURE_ADAPTER_INVALID');
    // REFUSAL 1: SNMP_POE that states an opener - in the operation of its own class, too.
    const poeWithOpener = { ...adapters.poe, hasOpener: true } as unknown as typeof adapters.poe;
    expect(codeOf(() => createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION }).register(poeWithOpener))).toBe('CAPTURE_ADAPTER_INVALID');
    // Controls: the same adapters register where the rules admit them.
    expect(codeOf(() => createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION }).register(adapters.camera))).toBe('ADMITTED');
    expect(codeOf(() => createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION }).register(adapters.poe))).toBe('ADMITTED');
    // A build whose registration is refused closes what it built: the loader hands a development-kind camera in production.
    let closed = 0;
    const load: ProductionAdapterLoader<CameraBundle, ProductionAdapterDependencies['audio']> = async (operation, devices, bundle) => {
      const built = await loadProductionAdapters(operation, devices, bundle);
      const closeAll = (built.audio as { closeAll?: () => Promise<void> }).closeAll?.bind(built.audio);
      return { camera: { ...built.camera, kind: CaptureAdapterKind.FAKE }, audio: Object.assign(built.audio, { closeAll: async () => ((closed += 1), closeAll?.()) }), poe: built.poe };
    };
    const attempt = buildProductionRegistryOf({ operation: CaptureOperation.REAL_PRODUCTION, executor, dependencies, load, audioCards: async () => null });
    await expect(attempt).rejects.toMatchObject({ code: 'CAPTURE_ADAPTER_KIND_NOT_ALLOWED' });
    expect(closed).toBe(1);
    // Constructing opened nothing and read nothing.
    expect(calls).toEqual([]);
  });

  it('THE DARWIN PROOF (AM-1 (3)(h) with the erratum of C135): with no microphone opener on the host (`audio: null`) the microphones are listed and assignable, NOT recordable, and a REAL_PRODUCTION session start is REFUSED; the cameras keep their opener', async () => {
    const { dependencies, executor, calls } = rig();
    const load: ProductionAdapterLoader<CameraBundle, ProductionAdapterDependencies['audio']> = (operation, devices, bundle) => loadProductionAdapters(operation, devices, bundle);
    const built = await buildProductionRegistryOf({ operation: CaptureOperation.REAL_PRODUCTION, executor, dependencies: { camera: dependencies.camera, audio: null }, load, audioCards: async () => null });
    expect(built.registry.list().map((device) => `${device.id}:${String(device.hasOpener)}`)).toEqual(['CAM-11:true', 'CAM-12:true', 'MIC-11:false', 'MIC-12:false']);
    expect(built.registry.assertAssignable('MIC', 'MIC-11').sourceClass).toBe('PRODUCTION');
    expect(codeOf(() => built.registry.assertRecordable('MIC-11'))).toBe('SOURCE_KIND_NOT_RECORDABLE');
    expect(built.registry.openerKinds()).toEqual(['ONVIF_RTSP']);
    expect(admissionOf(built.registry)).not.toBe('ADMITTED');
    // A microphone without an opener has no door of a later device either: it is served after a restart.
    expect(built.admit({ id: 'MIC-13', kind: 'MIC', adapterKind: 'USB_AUDIO', model: null })).toBe(CaptureDeviceAdmission.NOT_SERVED);
    await built.closeAll();
    expect(calls).toEqual([]);
  });
});

/** The parts a composition hands the fence (`ProductionCaptureParts`), on doubles, and what the wiring did with them. */
function wiringRig(platform: string, audio: Partial<Pick<ProductionCaptureParts['dependencies']['audio'], 'helperProgram' | 'guardProgram'>> = {}, tied?: () => Promise<MacosTiedListing>) {
  const base = rig();
  const seen = { attached: [] as string[], listings: 0, heartbeatsAsked: 0, reportsAttached: 0, subscribed: 0, logged: [] as string[], persisted: [] as string[], raised: [] as string[], micWatch: null as MicLossWatch | null };
  // A timer double that never fires: no heartbeat and no pass after the first runs in this test.
  const timers = { after: () => () => {} };
  // Row N10: with `tied`, the listing of a macOS host (`listTied`), as row N7's enumerator is on `darwin`.
  const cards = {
    list: async (): Promise<never> => {
      seen.listings += 1;
      throw Object.assign(new Error('no listing in this test'), { code: 'NOT_LISTED' });
    },
    ...(tied === undefined
      ? {}
      : {
          listTied: async (): Promise<MacosTiedListing> => {
            seen.listings += 1;
            return tied();
          },
        }),
  } as unknown as ProductionCaptureParts['cards'];
  const faults = {
    raise: async (fault: { subject: string; reason: string }) => void seen.raised.push(`${fault.reason}:${fault.subject}`),
    clear: async () => {},
    owns: () => false,
  } as unknown as ProductionCaptureParts['watches']['camera']['faults'];
  const parts: ProductionCaptureParts = {
    platform,
    dependencies: { camera: base.camera, audio: { registered: async () => null, cards, timers: base.timers, helperProgram: '/opt/dems/bin/ffmpeg', guardProgram: '/opt/dems/bin/capture-guard', ...audio } },
    watches: {
      camera: {
        timers,
        now: () => 1_760_400_000_000,
        candidate: async () => {
          seen.heartbeatsAsked += 1;
          return null;
        },
        faults,
      },
      microphone: { registered: async (deviceId: string) => (deviceId === STORED_MIC.deviceId ? STORED_MIC : null), cards, timers, faults: faults as unknown as ProductionCaptureParts['watches']['microphone']['faults'] },
    },
    cards,
    relayReports: {
      attach: () => {
        seen.reportsAttached += 1;
        return () => {};
      },
      subscribe: () => {
        seen.subscribed += 1;
        return () => {};
      },
    },
    attachCameraWatch: () => void seen.attached.push('CAMERA'),
    attachMicLossWatch: (watch: MicLossWatch) => {
      seen.attached.push('MIC');
      seen.micWatch = watch;
    },
  };
  const sinks: CaptureFenceSinks = {
    info: (fields) => void seen.logged.push(String(fields['code'])),
    warn: (fields) => void seen.logged.push(String(fields['code'])),
    error: (fields) => void seen.logged.push(String(fields['code'])),
    persist: (entry) => void seen.persisted.push(entry.code),
  };
  const environment = { store: base.executor, runDir: '/nonexistent/dems-run/capture', locked: () => false, sinks };
  return { ...base, parts, environment, seen };
}

describe('task 4 row 88: THE LIFT - the boot step wiring of the production registry (`wireProductionRegistry`), on doubles', () => {
  it('linux: both kinds open; the camera watch is attached BEFORE the registry and the loss watch after it; the adapter\'s reports go to the hub; a heartbeat per stored camera; a four-slot session start is ADMITTED', async () => {
    const { parts, environment, seen, calls } = wiringRig('linux');
    const built = await wireProductionRegistry(parts, environment);
    expect(built.registry.openerKinds()).toEqual(['ONVIF_RTSP', 'USB_AUDIO']);
    expect(admissionOf(built.registry)).toBe('ADMITTED');
    expect(seen.attached).toEqual(['CAMERA', 'MIC']);
    expect([seen.reportsAttached, seen.subscribed]).toEqual([1, 1]);
    // Two stored production cameras: each heartbeat's first read asks the stored candidate (the double answers none: no read is made).
    await new Promise((resolve) => setImmediate(resolve));
    expect(seen.heartbeatsAsked).toBe(2);
    // The loss watch made its first pass: one listing.
    expect(seen.listings).toBeGreaterThanOrEqual(1);
    expect(seen.logged).toContain('CAPTURE_PRODUCTION_REGISTRY_BUILT');
    await built.closeAll();
    expect(calls).toEqual([]);
  });

  it('darwin: NO microphone opener - the microphones are not recordable, a REAL_PRODUCTION session start is REFUSED, no loss watch is built; the cameras still open', async () => {
    const { parts, environment, seen } = wiringRig('darwin');
    const built = await wireProductionRegistry(parts, environment);
    expect(built.registry.openerKinds()).toEqual(['ONVIF_RTSP']);
    expect(codeOf(() => built.registry.assertRecordable('MIC-11'))).toBe('SOURCE_KIND_NOT_RECORDABLE');
    expect(admissionOf(built.registry)).toBe('SOURCE_KIND_NOT_RECORDABLE');
    expect(seen.attached).toEqual(['CAMERA']);
    expect(seen.logged).toContain('CAPTURE_PRODUCTION_MIC_OPENER_NOT_ON_THIS_PLATFORM');
    await built.closeAll();
  });

  // Task 4 row N10 (decision C135 (3)): THE DARWIN PROOF UNCHANGED. The macOS adapter is built only with its opener ADMITTED, and the
  // constant says it is not: a darwin host with the tied listing and both programs configured is EXACTLY as at d9df31ac - the
  // adapter without an opener, nothing listed by a watch, nothing persisted, a REAL_PRODUCTION start refused.
  // Mutant (the constant set to true): RED here (openerKinds gains USB_AUDIO) and in the capture static case "row N10".
  it('row N10: darwin, the macOS opener NOT ADMITTED (the constant is false) - with the tied listing and both programs configured, exactly as before row N10', async () => {
    expect(MACOS_MICROPHONE_OPENER_ADMITTED).toBe(false);
    const { parts, environment, seen, calls } = wiringRig('darwin', {}, async () => tiedOf('PRESENT'));
    const built = await wireProductionRegistry(parts, environment);
    expect(built.registry.openerKinds()).toEqual(['ONVIF_RTSP']);
    expect(built.registry.list().map((device) => `${device.id}:${String(device.hasOpener)}`)).toEqual(['CAM-11:true', 'CAM-12:true', 'MIC-11:false', 'MIC-12:false']);
    expect(codeOf(() => built.registry.assertRecordable('MIC-11'))).toBe('SOURCE_KIND_NOT_RECORDABLE');
    expect(admissionOf(built.registry)).toBe('SOURCE_KIND_NOT_RECORDABLE');
    expect(seen.attached).toEqual(['CAMERA']);
    expect(seen.logged.filter((code) => /MIC|MACOS/.test(code))).toEqual(['CAPTURE_PRODUCTION_MIC_OPENER_NOT_ON_THIS_PLATFORM']);
    expect([seen.listings, seen.persisted]).toEqual([0, []]);
    await built.closeAll();
    expect(calls).toEqual([]);
  });

  it('linux without the audio helper (or the guard) configured: no microphone opener is built, said by code in the log and the persistent error log; the session start is refused', async () => {
    for (const missing of [{ helperProgram: null }, { guardProgram: null }]) {
      const { parts, environment, seen } = wiringRig('linux', missing);
      const built = await wireProductionRegistry(parts, environment);
      expect(built.registry.openerKinds(), JSON.stringify(missing)).toEqual(['ONVIF_RTSP']);
      expect(admissionOf(built.registry)).toBe('SOURCE_KIND_NOT_RECORDABLE');
      expect(seen.persisted).toEqual(['CAPTURE_PRODUCTION_MIC_PROGRAM_NOT_CONFIGURED']);
      await built.closeAll();
    }
  });
});

// Task 4 row N10 (design 06 row N10; SM-06, SM-21; decision C135 (3)): THE REGISTRY BY PLATFORM with the TEST's explicit admission
// (`ProductionWiringAdmission`, which no production call site passes - static case "row N10"). Doubles only: no door is called, no
// pipe is made, no device is listed (the tied listing is a function of this file).
describe('task 4 row N10: the microphone by platform - linux the Linux adapter, darwin (admitted) the macOS one, any other none', () => {
  const ADMITTED = { admitMacosMicrophoneOpener: true } as const;
  const isMacos = (adapter: unknown): boolean => typeof (adapter as { groupOf?: unknown }).groupOf === 'function';

  it('darwin, ADMITTED by the test: the macOS adapter states its opener, a four-slot start is ADMITTED, the loss watch is attached after the camera watch; nothing was started', async () => {
    const { parts, environment, seen, calls } = wiringRig('darwin', {}, async () => tiedOf('PRESENT'));
    const built = await wireProductionRegistry(parts, environment, ADMITTED);
    expect(built.registry.openerKinds()).toEqual(['ONVIF_RTSP', 'USB_AUDIO']);
    expect(isMacos(built.registry.resolve('MIC', 'MIC-11'))).toBe(true);
    expect(admissionOf(built.registry)).toBe('ADMITTED');
    expect(seen.attached).toEqual(['CAMERA', 'MIC']);
    expect(seen.logged).not.toContain('CAPTURE_PRODUCTION_MIC_OPENER_NOT_ON_THIS_PLATFORM');
    expect(seen.logged).toContain('CAPTURE_PRODUCTION_REGISTRY_BUILT');
    await built.closeAll();
    expect(calls).toEqual([]);
  });

  // Mutant (the darwin watch given the Linux match `identifyRegisteredCard`): RED - the undecided device raises MIC_DISCONNECTED.
  it('darwin, ADMITTED: the loss watch reads the TIED listing with the macOS match - an undecided device raises nothing, an absent one raises the microphone\'s fault', async () => {
    let state: Parameters<typeof tiedOf>[0] = 'UNDECIDED';
    const { parts, environment, seen } = wiringRig('darwin', {}, async () => tiedOf(state));
    const built = await wireProductionRegistry(parts, environment, ADMITTED);
    const watch = seen.micWatch;
    expect(watch).not.toBeNull();
    await watch?.settled();
    await watch?.check();
    expect(seen.raised).toEqual([]);
    state = 'ABSENT';
    await watch?.check();
    expect(seen.raised).toEqual(['MIC_DISCONNECTED:MIC-11']);
    await built.closeAll();
  });

  it('darwin, ADMITTED, but a program not configured or the listing not tied: no microphone opener, said by code; the start is refused', async () => {
    const helperless = wiringRig('darwin', { helperProgram: null }, async () => tiedOf('PRESENT'));
    const first = await wireProductionRegistry(helperless.parts, helperless.environment, ADMITTED);
    expect([first.registry.openerKinds(), helperless.seen.persisted, helperless.seen.attached]).toEqual([['ONVIF_RTSP'], ['CAPTURE_PRODUCTION_MIC_PROGRAM_NOT_CONFIGURED'], ['CAMERA']]);
    await first.closeAll();
    const untied = wiringRig('darwin');
    const second = await wireProductionRegistry(untied.parts, untied.environment, ADMITTED);
    expect([second.registry.openerKinds(), untied.seen.persisted, admissionOf(second.registry)]).toEqual([['ONVIF_RTSP'], ['CAPTURE_PRODUCTION_MIC_LISTING_NOT_TIED'], 'SOURCE_KIND_NOT_RECORDABLE']);
    await second.closeAll();
  });

  it('the admission is of darwin alone: linux with it builds the Linux adapter as without it; another platform with it builds none', async () => {
    const linux = wiringRig('linux', {}, async () => tiedOf('PRESENT'));
    const onLinux = await wireProductionRegistry(linux.parts, linux.environment, ADMITTED);
    expect([onLinux.registry.openerKinds(), isMacos(onLinux.registry.resolve('MIC', 'MIC-11')), admissionOf(onLinux.registry)]).toEqual([['ONVIF_RTSP', 'USB_AUDIO'], false, 'ADMITTED']);
    await onLinux.closeAll();
    const other = wiringRig('win32', {}, async () => tiedOf('PRESENT'));
    const elsewhere = await wireProductionRegistry(other.parts, other.environment, ADMITTED);
    expect([elsewhere.registry.openerKinds(), other.seen.attached, other.seen.logged.includes('CAPTURE_PRODUCTION_MIC_OPENER_NOT_ON_THIS_PLATFORM')]).toEqual([['ONVIF_RTSP'], ['CAMERA'], true]);
    await elsewhere.closeAll();
  });

  // SM-06: "a listing that is unreadable, disagrees or leaves the device undecided for two passes in a row raises a named fault on
  // that microphone; it does not stop the helper". Mutant (`MACOS_MIC_UNCONFIRMED_PASSES` read as 1): RED - said after ONE pass.
  it('SM-06: a HELD microphone not confirmed for two passes in a row is said ONCE by its named code; a confirming pass or the closed handle ends the interval; a microphone not held is never said', async () => {
    let answer: MacosTiedListing = UNREADABLE;
    let holding: string[] = ['MIC-11'];
    const said: string[] = [];
    const match = macosLossMatchOf({ listTied: async () => answer, list: async () => ({ cards: [], truncated: false, skipped: 0 }) }, () => holding, (_level, code, context) => void said.push(`${code}:${String(context['deviceId'])}:${String(context['detail'] ?? context['end'])}`));
    const pass = async (): Promise<string> => {
      try {
        const listing = await match.cards.list();
        const found = match.identify(listing, STORED_MIC);
        return found.ok ? 'PRESENT' : found.refusal;
      } catch {
        return 'LISTING_FAILED';
      }
    };
    // Pass 1 unreadable, pass 2 undecided: the second pass in a row says the fault, once.
    expect(await pass()).toBe('LISTING_FAILED');
    expect(said).toEqual([]);
    answer = tiedOf('UNDECIDED');
    expect(await pass()).toBe('AUDIO_CARD_AMBIGUOUS');
    expect(said).toEqual(['CAPTURE_PRODUCTION_MIC_NOT_CONFIRMED:MIC-11:NAME_SHARED']);
    expect(await pass()).toBe('AUDIO_CARD_AMBIGUOUS');
    expect(said).toHaveLength(1);
    // A confirming pass ends the interval.
    answer = tiedOf('PRESENT');
    expect(await pass()).toBe('PRESENT');
    expect(said).toEqual(['CAPTURE_PRODUCTION_MIC_NOT_CONFIRMED:MIC-11:NAME_SHARED', 'CAPTURE_PRODUCTION_MIC_CONFIRMATION_ENDED:MIC-11:CONFIRMED']);
    // Again two undecided passes, then the handle is closed: the interval ends at the next pass, NOT_HELD.
    answer = tiedOf('UNDECIDED');
    await pass();
    await pass();
    expect(said).toHaveLength(3);
    holding = [];
    await pass();
    expect(said.at(-1)).toBe('CAPTURE_PRODUCTION_MIC_CONFIRMATION_ENDED:MIC-11:NOT_HELD');
    // Not held: undecided as often as it likes, nothing is said.
    await pass();
    await pass();
    expect(said).toHaveLength(4);
    // An absent card is a CONFIRMING pass here: the watch's own rule raises "disconnected" for it.
    holding = ['MIC-11'];
    answer = UNREADABLE;
    await pass();
    answer = tiedOf('ABSENT');
    expect(await pass()).toBe('AUDIO_CARD_ABSENT');
    expect(said).toHaveLength(4);
  });
});
