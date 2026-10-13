// The composition of production capture on DOUBLES (task 4 row 85b; decision C55).
//
// Every door of the app is a function of this file: it records what it was handed. No app, no
// database, no process, no socket, no device. The destination rule is the REAL one. The stored
// facts answer from a table of this file. The two built production adapters and the two watches
// are constructed from the bundles (as `adapters/__tests__/real.test.ts` does for the loader) and
// never opened: a door that would start a program fails the test.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSystemTimers } from '../capture';
import {
  CaptureAdapterError,
  CaptureAdapterKind,
  CaptureAdapterRefusal,
  CaptureOperation,
  createCaptureDeviceRegistry,
  judgeStoredCamera,
  type CaptureDeviceEntry,
  type CardEnumerator,
  type StoredCameraAddressRule,
} from '../capture/adapters';
import { createMicLossWatch } from '../capture/adapters/audio/mic-loss';
import { createUsbAudioProductionAdapter, identifyRegisteredCard, isRegisteredAudioInput } from '../capture/adapters/audio/usb-audio-production';
import { createCameraWatch } from '../capture/adapters/camera/camera-watch';
import { createOnvifRelayCameraAdapter, type OnvifRelayCameraDependencies } from '../capture/adapters/camera/onvif-relay';
import type { DestinationContext } from '../capture/destination-rule';
import { createCardEnumerator } from '../capture/adapters/audio/card-listing';
import { createCardListingReader } from '../capture/adapters/audio/card-listing-reader';
import { LINUX_CARD_LISTING_PROGRAM, linuxCardListingArguments } from '../capture/adapters/local/mic-helper-args';
import { COMMISSIONING_HELPER_TABLE, CommissioningArgumentError, LINUX_ECHO_PROGRAM, LINUX_NEIGHBOUR_PROGRAM, commissioningAddressArgument, linuxEchoArguments, linuxNeighbourArguments } from '../capture/adapters/local/mic-helper-args';
import { CommissioningInputError, CommissioningInputFailure, NEIGHBOUR_OUTPUT_MAX_CHARS, echoReadingOf, hostCommissioningInputsOf, neighbourReadingOf, type CommissioningHostInputs, type CommissioningHostParts } from '../capture/fence';
import {
  CARD_LISTING_PLATFORM,
  CardListingNotAvailableError,
  CardListingProgramError,
  CardListingProgramFailure,
  CardListingUnavailable,
  cardEnumeratorOf,
  cardListingProgramsOf,
  factoryScanProbeOf,
  factoryScanRuleOf,
  hostCardEnumeratorOf,
  productionCameraDoors,
  storedCameraAddressRuleOf,
  typedProbeRuleOf,
  watchFaultSinkOf,
  type CardListingPrograms,
  type ProductionDoor,
  type WatchFault,
  type WatchFaultEngine,
} from '../capture/fence';
import type { RelayIngestReport, RelayIngestReports } from '../capture-session';
import {
  CaptureCompositionCode,
  CaptureCompositionError,
  READ_STORED_CAMERA,
  READ_STORED_MICROPHONE,
  READ_STORED_STREAM_TOKEN,
  EARLY_LOSSES_KEPT,
  composeProductionCapture,
  createRelayReportHub,
  hostAliasInterfaceFileOf,
  storedProductionFactsOf,
  type ComposedProductionCapture,
  type ProductionCaptureInput,
  type ProductionCapturePorts,
} from '../capture-composition';

/** Hand-written host facts (the documentation networks of rows 143 and 144): a camera interface on 192.168.50.0/24, an office interface on 10.20.0.0/24. */
const HOST: DestinationContext = {
  cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.50.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 24 }],
  hostAddresses: ['192.168.50.1', '10.20.0.5'],
};
const CAMERA_ADDRESS = '192.168.50.21';
const SESSION = 'SES-20261013-0085';
const OPERATOR = 'OPR-002';

/** The statement the credential wiring reads a device with (its own constant; matched here by its table and columns). */
const isCredentialDeviceRead = (text: string): boolean => /^SELECT kind, adapter_kind, address FROM public\.capture_devices WHERE id = \$1$/.test(text);

interface Rig {
  readonly ports: ProductionCapturePorts;
  readonly units: string[];
  readonly statements: { readonly text: string; readonly values: readonly unknown[] }[];
  readonly opened: string[];
  readonly errorLog: unknown[];
  readonly reports: { readonly level: string; readonly code: string; readonly context: object }[];
  readonly connectionTests: Parameters<ProductionCapturePorts['provideConnectionTest']>[0][];
  readonly enumerators: CardEnumerator[];
  readonly relayReports: RelayIngestReports[];
}

function rig(operation: CaptureOperation, overrides: Partial<ProductionCapturePorts> = {}): Rig {
  const out = {
    units: [] as string[],
    statements: [] as { text: string; values: readonly unknown[] }[],
    opened: [] as string[],
    errorLog: [] as unknown[],
    reports: [] as { level: string; code: string; context: object }[],
    connectionTests: [] as Parameters<ProductionCapturePorts['provideConnectionTest']>[0][],
    enumerators: [] as CardEnumerator[],
    relayReports: [] as RelayIngestReports[],
  };
  const ports: ProductionCapturePorts = {
    operation,
    timers: { after: () => () => {} },
    now: () => 1_760_000_000_000,
    relayProgram: null,
    guardProgram: null,
    // Row 85c: no audio helper is configured, no engine runs and no worker is being replaced, unless a case says so.
    audioHelperProgram: null,
    faultEngine: () => null,
    workerSuperseded: () => false,
    // A unit that never commits: a read that reaches it has PASSED the gate, and still yields no credential.
    unit: async (label) => {
      out.units.push(label);
      throw Object.assign(new Error('no unit of work in this test'), { code: 'NOT_READY' });
    },
    open: (deviceId) => {
      out.opened.push(deviceId);
      throw new Error('no store in this test');
    },
    errorLog: { append: (entry: unknown) => void out.errorLog.push(entry) },
    query: async (text, values) => {
      out.statements.push({ text, values });
      if (isCredentialDeviceRead(text)) return { rows: values[0] === 'CAM-01' ? [{ kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address: CAMERA_ADDRESS }] : [] };
      if (text === READ_STORED_CAMERA) {
        if (values[0] === 'CAM-01') return { rows: [{ adapterKind: 'ONVIF_RTSP', address: `${CAMERA_ADDRESS}:80`, endpointRef: 'urn:uuid:11111111-2222-3333-4444-555555555555' }] };
        if (values[0] === 'CAM-02') return { rows: [{ adapterKind: 'LOCAL_DEVICE', address: null, endpointRef: null }] };
        if (values[0] === 'CAM-03') return { rows: [{ adapterKind: 'ONVIF_RTSP', address: 'http://192.168.50.22/onvif', endpointRef: null }] };
        return { rows: [] };
      }
      if (text === READ_STORED_STREAM_TOKEN) return { rows: values[0] === 'CAM-01' && values[1] === 'H264_1080P25' ? [{ onvifProfileToken: 'Profile_1' }] : [] };
      if (text === READ_STORED_MICROPHONE) {
        if (values[0] === 'MIC-03') return { rows: [{ deviceId: 'MIC-03', usbId: '1235:8215', cardId: 'USB', cardDevice: 0, inputNumber: 3, nativeChannels: 18, usbSerial: 'Y8ABC123', usbPort: '0000:00:14.0-2.3' }] };
        if (values[0] === 'MIC-04') return { rows: [{ deviceId: 'MIC-04', usbId: null, cardId: 'PCH', cardDevice: 0, inputNumber: 1, nativeChannels: 2, usbSerial: null, usbPort: null }] };
        if (values[0] === 'MIC-05') return { rows: [{ deviceId: 'MIC-05', usbId: null, cardId: 'PCH', cardDevice: '0', inputNumber: 1, nativeChannels: 2 }] };
        return { rows: [] };
      }
      throw new Error(`a statement this test does not know: ${text}`);
    },
    provideConnectionTest: (parts) => void out.connectionTests.push(parts),
    provideEnumerator: (enumerator) => void out.enumerators.push(enumerator),
    provideRelayReports: (reports) => void out.relayReports.push(reports),
    report: (level, code, context) => void out.reports.push({ level, code, context }),
    ...overrides,
  };
  return { ports, ...out };
}

const composed = (built: Rig, input: ProductionCaptureInput): ComposedProductionCapture => {
  const composition = composeProductionCapture(built.ports, input);
  if (!composition.composed) throw new Error('expected a composition');
  return composition;
};
const refusalOf = async (promise: Promise<unknown>): Promise<{ readonly code?: unknown; readonly reason?: unknown; readonly name?: unknown }> => {
  try {
    await promise;
  } catch (error) {
    return error as { code?: unknown; reason?: unknown; name?: unknown };
  }
  throw new Error('expected a rejection');
};
const refusal = (rule: StoredCameraAddressRule, host: string, port?: number): string => {
  const decision = rule(host, port);
  return decision.allowed ? 'ALLOWED' : decision.refusal;
};

describe('the composition in each capture operation', () => {
  it.each([CaptureOperation.SIMULATED, CaptureOperation.REAL_DEVELOPMENT])('%s: nothing is built - no door is opened, no reader of a credential exists, nothing is read or reported', (operation) => {
    const built = rig(operation);
    const composition = composeProductionCapture(built.ports, { platform: CARD_LISTING_PLATFORM, network: () => HOST });
    expect(composition).toEqual({ composed: false, operation });
    expect(Object.isFrozen(composition)).toBe(true);
    expect([built.connectionTests.length, built.enumerators.length, built.relayReports.length, built.units.length, built.statements.length, built.opened.length, built.reports.length, built.errorLog.length]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('REAL_PRODUCTION: each door is opened exactly once, and ONE binding of the destination rule reaches its four takers', () => {
    const built = rig(CaptureOperation.REAL_PRODUCTION);
    const composition = composed(built, { platform: CARD_LISTING_PLATFORM, network: () => HOST });
    expect([built.connectionTests.length, built.enumerators.length, built.relayReports.length]).toEqual([1, 1, 1]);
    // The four takers hold the SAME function: the wiring (proved below through its reader), the connection test, the camera bundle, the camera watch.
    const rule = composition.storedAddress;
    expect(built.connectionTests[0]?.storedAddress).toBe(rule);
    expect(composition.dependencies.camera.storedAddress).toBe(rule);
    expect(composition.watches.camera.storedAddress).toBe(rule);
    // The session is given the hub, the module the enumerator the bundles carry.
    expect(built.relayReports[0]).toBe(composition.relayReports);
    expect(built.enumerators[0]).toBe(composition.cards);
    expect(composition.dependencies.audio.cards).toBe(composition.cards);
    expect(composition.watches.microphone.cards).toBe(composition.cards);
    // The two readers are different objects, each at its holder; nothing was read or revealed to compose.
    expect(built.connectionTests[0]?.reader).not.toBe(composition.dependencies.camera.credentials);
    expect(Object.keys(built.connectionTests[0]?.reader ?? {})).toEqual(['connectionTest']);
    expect(Object.keys(composition.dependencies.camera.credentials).sort()).toEqual(['relayRestart', 'sessionOpen']);
    expect([built.units.length, built.statements.length, built.opened.length]).toEqual([0, 0, 0]);
    expect(composition.networkFactsInjected).toBe(true);
    for (const part of [composition, composition.dependencies, composition.dependencies.camera, composition.dependencies.audio, composition.watches, composition.watches.camera, composition.watches.microphone, composition.stored]) expect(Object.isFrozen(part)).toBe(true);
  });

  it('REAL_PRODUCTION: a door that refuses ends the composition - nothing is returned', () => {
    const built = rig(CaptureOperation.REAL_PRODUCTION, {
      provideEnumerator: () => {
        throw new Error('the enumerator of the sound cards was provided twice');
      },
    });
    expect(() => composeProductionCapture(built.ports, { platform: CARD_LISTING_PLATFORM })).toThrow('provided twice');
  });
});

describe('fail-closed: the destination rule on a stored camera address', () => {
  const ADDRESSES = [CAMERA_ADDRESS, '192.168.50.1', '10.20.0.9', '127.0.0.1', '0.0.0.0', '169.254.10.20', '224.0.0.251', '8.8.8.8', 'camera.local', ''];

  it('NO network reader (the product today: row 108 is not built): every address is refused, the camera subnet included', () => {
    const rule = storedCameraAddressRuleOf(undefined);
    expect(ADDRESSES.map((address) => refusal(rule, address))).not.toContain('ALLOWED');
    // The class of an address keeps its own code; an address that WOULD be a camera is `NOT_CONFIGURED`.
    expect(refusal(rule, CAMERA_ADDRESS)).toBe('NOT_CONFIGURED');
    expect(refusal(rule, CAMERA_ADDRESS, 80)).toBe('NOT_CONFIGURED');
    expect(refusal(rule, '127.0.0.1')).toBe('LOOPBACK');
    // The judgement of the adapter, of the watch and of the connection test on this binding: refused, with the rule's code.
    expect(judgeStoredCamera({ host: CAMERA_ADDRESS, serviceAddress: `http://${CAMERA_ADDRESS}/onvif/device_service` }, rule)).toMatchObject({ allowed: false });
  });

  it('a reader that answers nothing, a reader that throws and facts with no camera subnet: every address is refused; the throw is reported once per judgement, without its text', () => {
    let unreadable = 0;
    const cases: StoredCameraAddressRule[] = [
      storedCameraAddressRuleOf(() => null),
      storedCameraAddressRuleOf(() => {
        throw new Error('interface eth9 at 192.168.50.1 could not be read');
      }, () => void (unreadable += 1)),
      storedCameraAddressRuleOf(() => ({ ...HOST, cameraSubnet: null })),
      storedCameraAddressRuleOf(() => ({ ...HOST, cameraAddresses: [] })),
    ];
    for (const rule of cases) expect(ADDRESSES.map((address) => refusal(rule, address))).not.toContain('ALLOWED');
    expect(unreadable).toBe(ADDRESSES.length);
  });

  it('with the host facts injected the SAME binding admits a camera of the camera subnet and nothing else; the facts are read at every judgement', () => {
    let facts: DestinationContext | null = HOST;
    let reads = 0;
    const rule = storedCameraAddressRuleOf(() => {
      reads += 1;
      return facts;
    });
    expect(ADDRESSES.map((address) => refusal(rule, address))).toEqual(['ALLOWED', 'HOST_ADDRESS', 'OTHER_INTERFACE_SUBNET', 'LOOPBACK', 'UNSPECIFIED', 'LINK_LOCAL', 'MULTICAST', 'PUBLIC_ADDRESS', 'HOST_NAME', 'EMPTY'].map((code, index) => (index < 8 ? code : expect.any(String))));
    expect(refusal(rule, CAMERA_ADDRESS, 80)).toBe('ALLOWED');
    expect(refusal(rule, CAMERA_ADDRESS, 8557)).toBe('PORT_NOT_LISTED');
    // The configuration is taken away between two judgements: the second is refused. Nothing is remembered.
    facts = null;
    expect(refusal(rule, CAMERA_ADDRESS)).toBe('NOT_CONFIGURED');
    expect(reads).toBe(ADDRESSES.length + 3);
  });

  // Integration pass I-9a (records 095, 096): the binding for ONE typed address of operation 93 - the purpose of a typed
  // probe on the SAME injected reader, fail-closed the same way.
  it('the binding for a typed address: no reader, a reader that answers nothing or throws -> NOT_CONFIGURED (the thrower is told of, once per judgement); with the facts it admits the camera subnet only, never a port and never an alias', () => {
    let told = 0;
    const thrower = typedProbeRuleOf(
      () => {
        throw new Error('i9a: the host table cannot be read');
      },
      () => (told += 1),
    );
    expect([typedProbeRuleOf(undefined)(CAMERA_ADDRESS), typedProbeRuleOf(() => null)(CAMERA_ADDRESS), thrower(CAMERA_ADDRESS), thrower(CAMERA_ADDRESS)]).toEqual(Array.from({ length: 4 }, () => ({ allowed: false, refusal: 'NOT_CONFIGURED' })));
    expect(told).toBe(2);
    // A loopback address is refused for its class before the facts are looked at, as for a stored address.
    expect(typedProbeRuleOf(undefined)('127.0.0.1')).toEqual({ allowed: false, refusal: 'LOOPBACK' });
    let reads = 0;
    const rule = typedProbeRuleOf(() => {
      reads += 1;
      return HOST;
    });
    expect(rule(CAMERA_ADDRESS)).toEqual({ allowed: true, destination: { address: CAMERA_ADDRESS, port: 80, sourceAddress: HOST.cameraAddresses[0]?.address, viaAlias: false } });
    // The typed probe is held to the camera subnet (record 095, decision 1): an address of a factory network is NOT reached through an alias.
    const aliased: DestinationContext = { ...HOST, cameraAddresses: [...HOST.cameraAddresses, { address: '192.168.1.253', alias: true }] };
    expect(typedProbeRuleOf(() => aliased)('192.168.1.64')).toEqual({ allowed: false, refusal: 'OUTSIDE_CAMERA_SUBNET' });
    expect(rule('192.168.60.21')).toEqual({ allowed: false, refusal: 'OUTSIDE_CAMERA_SUBNET' });
    expect(reads).toBe(2);
  });

  // Task 4 row 106b (request line `row 107`, (a) and (c); decision C78): the two parts of the commissioning scan the capture
  // unit offers the composition. The rule takes the facts the SCAN states; the probe dials NOTHING for a target that has
  // no source or is of another form (what it dials for an admitted one is the ONVIF clock read, proven on the stub in the
  // scan's own tests and on hardware at `9A/H-13`).
  it('the binding for the commissioning scan: the rule\'s own answer on the facts handed in - the camera subnet from the camera port, a factory /24 only from an alias that IS on the port; the probe asks nothing without a source', async () => {
    const rule = factoryScanRuleOf();
    expect(rule(CAMERA_ADDRESS, HOST)).toEqual({ allowed: true, destination: { address: CAMERA_ADDRESS, port: 80, sourceAddress: HOST.cameraAddresses[0]?.address, viaAlias: false } });
    // A factory address with no alias on the port is refused; with ONE in its /24 it is reached from that alias.
    expect(rule('192.168.1.64', HOST)).toMatchObject({ allowed: false });
    const aliased: DestinationContext = { ...HOST, cameraAddresses: [...HOST.cameraAddresses, { address: '192.168.1.253', alias: true }], hostAddresses: [...HOST.hostAddresses, '192.168.1.253'] };
    expect(rule('192.168.1.64', aliased)).toEqual({ allowed: true, destination: { address: '192.168.1.64', port: 80, sourceAddress: '192.168.1.253', viaAlias: true } });
    // The classes no purpose reaches, and the office network.
    expect([rule('127.0.0.1', aliased), rule('8.8.8.8', aliased), rule('10.20.0.77', aliased)].map((decision) => decision.allowed)).toEqual([false, false, false]);

    // THE PROBE: nothing is timed and nothing is dialled for a target the rule did not complete.
    const timers: number[] = [];
    const probe = factoryScanProbeOf({
      after(delayMs) {
        timers.push(delayMs);
        return () => undefined;
      },
    });
    const signal = new AbortController().signal;
    await expect(probe({ address: '192.168.1.64', port: 80 }, signal)).resolves.toEqual({ answered: false, onvifReachable: false });
    await expect(probe({ address: '192.168.1.64', port: 80, sourceAddress: 7 }, signal)).resolves.toEqual({ answered: false, onvifReachable: false });
    await expect(probe({ address: 'not an address / path', port: 80, sourceAddress: '192.168.1.253' }, signal)).resolves.toEqual({ answered: false, onvifReachable: false });
    expect(timers).toEqual([]);
  });

  it('through the composition: with NO network facts both credential readers refuse a registered production camera BEFORE any unit of work - 0 units, 0 openings, one error-log entry each', async () => {
    const built = rig(CaptureOperation.REAL_PRODUCTION);
    const composition = composed(built, { platform: CARD_LISTING_PLATFORM });
    expect(composition.networkFactsInjected).toBe(false);
    const adapter = await refusalOf(composition.dependencies.camera.credentials.sessionOpen('CAM-01', SESSION));
    const test = await refusalOf(built.connectionTests[0]?.reader.connectionTest('CAM-01', OPERATOR) ?? Promise.resolve());
    expect([adapter.code, test.code]).toEqual(['CAPTURE_CREDENTIAL_ADDRESS_REFUSED', 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED']);
    expect([built.units.length, built.opened.length, built.errorLog.length]).toEqual([0, 0, 2]);
    expect(built.errorLog).toEqual([expect.objectContaining({ context: expect.objectContaining({ refusal: 'NOT_CONFIGURED' }) }), expect.objectContaining({ context: expect.objectContaining({ refusal: 'NOT_CONFIGURED' }) })]);
    // The address is in no entry.
    expect(JSON.stringify(built.errorLog)).not.toContain(CAMERA_ADDRESS);
  });

  it('through the composition: with the host facts the SAME camera passes the gate of both readers (the unit of work is reached); a device that is not a camera of a production kind never does', async () => {
    const built = rig(CaptureOperation.REAL_PRODUCTION);
    const composition = composed(built, { platform: CARD_LISTING_PLATFORM, network: () => HOST });
    const adapter = await refusalOf(composition.dependencies.camera.credentials.sessionOpen('CAM-01', SESSION));
    const test = await refusalOf(built.connectionTests[0]?.reader.connectionTest('CAM-01', OPERATOR) ?? Promise.resolve());
    // The double's unit never commits: the gate was passed, and still no credential exists.
    expect(built.units).toHaveLength(2);
    expect([adapter.code, test.code]).not.toContain('CAPTURE_CREDENTIAL_ADDRESS_REFUSED');
    expect(built.opened).toEqual([]);
    const unknown = await refusalOf(composition.dependencies.camera.credentials.sessionOpen('CAM-09', SESSION));
    expect(unknown.code).toBe('CAPTURE_CREDENTIAL_DEVICE_REFUSED');
    expect(built.units).toHaveLength(2);
  });
});

describe('fail-closed: the card enumerator of operations 98 and 99', () => {
  it.each([
    ['darwin', undefined, CardListingUnavailable.NOT_AVAILABLE_ON_THIS_PLATFORM],
    ['win32', { captureDevices: async () => 'card 0: USB [Scarlett], device 0: USB Audio [USB Audio]' }, CardListingUnavailable.NOT_AVAILABLE_ON_THIS_PLATFORM],
    // Row 85c took the third line of this table out: on the platform with a reader the composition has the product's runner
    // behind the enumerator, so `LISTING_PROGRAM_NOT_HANDED_IN` is no answer of a composed Core any more (block "row 85c (b)").
  ] as const)('platform %s: the listing states a NAMED reason and no card - never a made-up one', async (platform, cardPrograms, reason) => {
    const built = rig(CaptureOperation.REAL_PRODUCTION);
    const composition = composed(built, { platform, ...(cardPrograms === undefined ? {} : { cardPrograms }) });
    expect(composition.cardListingUnavailable).toBe(reason);
    for (let call = 0; call < 2; call += 1) {
      const error = await refusalOf(built.enumerators[0]?.list() ?? Promise.resolve());
      expect(error).toBeInstanceOf(CardListingNotAvailableError);
      expect([error.code, error.reason]).toEqual(['AUDIO_CARD_LISTING_NOT_AVAILABLE', reason]);
    }
    // Said once at the composition, as a warning with the reason.
    expect(built.reports).toEqual([{ level: 'warn', code: CaptureCompositionCode.CARD_LISTING_NOT_AVAILABLE, context: { reason } }]);
  });

  it('the platform with a reader AND the program text handed in: the product\'s enumerator - it asks the program at every listing and lists what the host states', async () => {
    let asked = 0;
    const { enumerator, unavailable } = cardEnumeratorOf(CARD_LISTING_PLATFORM, {
      captureDevices: async () => {
        asked += 1;
        return '';
      },
    });
    expect(unavailable).toBeNull();
    // This Mac has no sound directory of a Linux kernel: the program's empty text is an empty listing, read twice.
    expect((await enumerator.list()).cards).toEqual([]);
    expect((await enumerator.list()).cards).toEqual([]);
    expect(asked).toBe(2);
  });
});

describe('the relay report hub (decision C34)', () => {
  const REPORT: RelayIngestReport = { sessionId: SESSION, deviceId: 'CAM-01', attempt: 1 };
  const source = (): RelayIngestReports & { emit(report: RelayIngestReport): void; listeners(): number } => {
    const listeners = new Set<(report: RelayIngestReport) => void>();
    return {
      subscribe(listener) {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
      emit: (report) => listeners.forEach((listener) => listener(report)),
      listeners: () => listeners.size,
    };
  };

  it('with no source attached it reports nothing: no camera of a session can be paired', () => {
    const hub = createRelayReportHub(() => {});
    const seen: RelayIngestReport[] = [];
    hub.subscribe((report) => void seen.push(report));
    expect(hub.attached()).toBe(false);
    expect(seen).toEqual([]);
  });

  it('the attached source reaches every listener, also one that subscribed before it; a listener that throws is reported and the others are told; a second source is refused', () => {
    const failures: unknown[] = [];
    const hub = createRelayReportHub((error) => void failures.push(error));
    const session: RelayIngestReport[] = [];
    const watch: RelayIngestReport[] = [];
    const endSession = hub.subscribe((report) => void session.push(report));
    hub.subscribe(() => {
      throw new Error('a listener failed');
    });
    const adapter = source();
    const detach = hub.attach(adapter);
    hub.subscribe((report) => void watch.push(report));
    expect(hub.attached()).toBe(true);
    adapter.emit(REPORT);
    expect([session, watch]).toEqual([[REPORT], [REPORT]]);
    expect(failures).toHaveLength(1);
    expect(() => hub.attach(source())).toThrow(CaptureCompositionError);
    endSession();
    adapter.emit({ ...REPORT, attempt: 2 });
    expect([session.length, watch.length]).toEqual([1, 2]);
    detach();
    expect(adapter.listeners()).toBe(0);
  });

  it('the composition hands the session a hub with nothing attached, and reports a failed listener by code only', () => {
    const built = rig(CaptureOperation.REAL_PRODUCTION);
    const composition = composed(built, { platform: 'darwin' });
    expect(composition.relayReports.attached()).toBe(false);
    built.relayReports[0]?.subscribe(() => {
      throw new Error('192.168.50.21 is not for a log');
    });
    const adapter = source();
    composition.relayReports.attach(adapter);
    adapter.emit(REPORT);
    expect(built.reports.filter((entry) => entry.code === CaptureCompositionCode.RELAY_REPORT_LISTENER_FAILED)).toEqual([{ level: 'error', code: CaptureCompositionCode.RELAY_REPORT_LISTENER_FAILED, context: {} }]);
  });
});

describe('the stored facts', () => {
  it('the three statements are constants with bind parameters; the microphone statement selects the serial and the port path (row 200)', () => {
    for (const statement of [READ_STORED_CAMERA, READ_STORED_STREAM_TOKEN, READ_STORED_MICROPHONE]) {
      expect(statement).toMatch(/^SELECT /);
      expect(statement).toMatch(/ FROM public\.capture_(?:devices|device_streams|audio_inputs) WHERE /);
      expect(statement).not.toMatch(/credential|secret|password/i);
    }
    expect(READ_STORED_MICROPHONE).toContain('usb_serial AS "usbSerial"');
    expect(READ_STORED_MICROPHONE).toContain('usb_port AS "usbPort"');
    expect(READ_STORED_CAMERA).toContain(`kind = 'CAMERA'`);
  });

  it('a camera: the candidate at its stored address; null for another adapter kind, an address not of the stored form, no row. A stream: only with the stored token of that profile - no profile is assumed', async () => {
    const built = rig(CaptureOperation.REAL_PRODUCTION);
    const stored = storedProductionFactsOf(built.ports.query);
    expect(await stored.candidate('CAM-01')).toEqual({
      adapterKind: CaptureAdapterKind.ONVIF_RTSP,
      host: CAMERA_ADDRESS,
      serviceAddress: `http://${CAMERA_ADDRESS}:80/onvif/device_service`,
      endpointRef: 'urn:uuid:11111111-2222-3333-4444-555555555555',
      vendor: null,
      model: null,
      name: null,
      testable: true,
      conflict: false,
    });
    expect([await stored.candidate('CAM-02'), await stored.candidate('CAM-03'), await stored.candidate('CAM-09')]).toEqual([null, null, null]);
    expect(await stored.stream('CAM-01', 'H264_1080P25')).toMatchObject({ onvifProfileToken: 'Profile_1', candidate: { host: CAMERA_ADDRESS } });
    expect([await stored.stream('CAM-01', 'H264_720P25'), await stored.stream('CAM-02', 'H264_1080P25'), await stored.stream('CAM-09', 'H264_1080P25')]).toEqual([null, null, null]);
    // A camera that is no production camera is never asked for a token.
    expect(built.statements.filter((statement) => statement.text === READ_STORED_STREAM_TOKEN).map((statement) => statement.values)).toEqual([['CAM-01', 'H264_1080P25'], ['CAM-01', 'H264_720P25']]);
  });

  it('a microphone: the stored row WITH its serial and port path; null and absent are null; a column of the wrong type or no row is no row', async () => {
    const stored = storedProductionFactsOf(rig(CaptureOperation.REAL_PRODUCTION).ports.query);
    const usb = await stored.microphone('MIC-03');
    expect(usb).toEqual({ deviceId: 'MIC-03', usbId: '1235:8215', cardId: 'USB', cardDevice: 0, inputNumber: 3, nativeChannels: 18, usbSerial: 'Y8ABC123', usbPort: '0000:00:14.0-2.3' });
    // The adapter's own shape rule takes the row as it is.
    expect(isRegisteredAudioInput(usb)).toBe(true);
    expect(await stored.microphone('MIC-04')).toMatchObject({ usbId: null, usbSerial: null, usbPort: null });
    expect([await stored.microphone('MIC-05'), await stored.microphone('MIC-09')]).toEqual([null, null]);
  });
});

describe('the bundles build the built production parts (constructed, never opened), and the registry still refuses them before the lift', () => {
  const CAMERAS: readonly CaptureDeviceEntry[] = [{ id: 'CAM-01', deviceClass: 'CAMERA', label: 'camera', capabilities: [], profiles: [] }];
  const MICS: readonly CaptureDeviceEntry[] = [{ id: 'MIC-03', deviceClass: 'MIC', label: 'microphone', capabilities: [], profiles: [] }];
  const NEVER = (): never => {
    throw new Error('nothing is started, read or raised in this test');
  };

  it('the camera bundle IS the dependencies of the production camera adapter: the adapter is built from it, states its opener, and a production registry refuses it (CAPTURE_ADAPTER_INVALID)', () => {
    const built = rig(CaptureOperation.REAL_PRODUCTION);
    const composition = composed(built, { platform: 'darwin' });
    const dependencies: OnvifRelayCameraDependencies = composition.dependencies.camera;
    expect(Object.keys(dependencies).sort()).toEqual(['clock', 'credentials', 'door', 'locator', 'relayEnded', 'relayProgram', 'storedAddress', 'stream', 'tell', 'timers']);
    const camera = createOnvifRelayCameraAdapter(CAMERAS, dependencies);
    expect([camera.kind, camera.hasOpener]).toEqual([CaptureAdapterKind.ONVIF_RTSP, true]);
    // UNTIL THE LIFT (row 88): the kind has no opener in the registry's list, so the built adapter cannot be registered.
    const registry = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION });
    let refused: unknown = null;
    try {
      registry.register(camera);
    } catch (error) {
      refused = error;
    }
    expect(refused).toBeInstanceOf(CaptureAdapterError);
    expect((refused as CaptureAdapterError).code).toBe(CaptureAdapterRefusal.ADAPTER_INVALID);
    expect(registry.list()).toEqual([]);
    // A note of the adapter is logged by its code and identifiers.
    dependencies.tell?.({ code: 'CAPTURE_RELAY_NOT_REAPED', sessionId: SESSION, deviceId: 'CAM-01', attempt: 2 });
    expect(built.reports.at(-1)).toEqual({ level: 'warn', code: CaptureCompositionCode.CAMERA_RELAY_NOTE, context: { note: 'CAPTURE_RELAY_NOT_REAPED', sessionId: SESSION, deviceId: 'CAM-01', attempt: 2 } });
  });

  it('the camera watch: built from its bundle with a time reader; before it is attached a loss is KEPT for it (row B2) and a clock read is refused by name; attached once, both reach it', async () => {
    const built = rig(CaptureOperation.REAL_PRODUCTION);
    const composition = composed(built, { platform: 'darwin' });
    const watch = createCameraWatch({ ...composition.watches.camera, reader: { read: NEVER } });
    const { clock, relayEnded } = composition.dependencies.camera;
    expect((await refusalOf(clock('CAM-01'))).code).toBe(CaptureCompositionCode.CAMERA_WATCH_NOT_ATTACHED);
    expect(() => relayEnded({ sessionId: SESSION, deviceId: 'CAM-01', attempt: 1 })).not.toThrow();
    const seen: unknown[] = [];
    composition.attachCameraWatch({ relayEnded: (end) => void seen.push(end), clockOffsetMs: async (deviceId) => (deviceId === 'CAM-01' ? 37 : 0) });
    expect(await clock('CAM-01')).toBe(37);
    relayEnded({ deviceId: 'CAM-01' });
    // Row B2 (S-02): the loss that arrived BEFORE the attach was kept and handed over first; nothing is dropped unsaid.
    expect(seen).toEqual([{ sessionId: SESSION, deviceId: 'CAM-01', attempt: 1 }, { deviceId: 'CAM-01' }]);
    expect(() => composition.attachCameraWatch(watch as never)).toThrow(CaptureCompositionError);
    // The real watch on this bundle and NO network facts: its clock read of a stored camera is refused before any time read (the reader would fail the test).
    const real = composed(rig(CaptureOperation.REAL_PRODUCTION), { platform: 'darwin' });
    const refusedWatch = createCameraWatch({ ...real.watches.camera, reader: { read: NEVER } });
    expect((await refusalOf(refusedWatch.clockOffsetMs('CAM-01'))).code).toBe('CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED');
    refusedWatch.close();
    watch.close();
  });

  it('the microphone bundle and the loss watch: built with the TWO members the lift adds (row 85c: the helper program is the configuration\'s key now); the loss callback reaches the watch once it is attached', () => {
    const built = rig(CaptureOperation.REAL_PRODUCTION, { guardProgram: '/opt/dems/bin/capture-guard', audioHelperProgram: '/opt/dems/bin/ffmpeg' });
    const composition = composed(built, { platform: 'darwin' });
    const { audio } = composition.dependencies;
    expect(Object.keys(audio).sort()).toEqual(['cards', 'guardProgram', 'helperProgram', 'onSourceLost', 'registered', 'timers']);
    expect([audio.helperProgram, audio.guardProgram]).toEqual(['/opt/dems/bin/ffmpeg', '/opt/dems/bin/capture-guard']);
    // Without the two keys both members are null: the lift refuses to build the adapter from a null (the adapter takes a path).
    const unset = composed(rig(CaptureOperation.REAL_PRODUCTION), { platform: 'darwin' }).dependencies.audio;
    expect([unset.helperProgram, unset.guardProgram]).toEqual([null, null]);
    const adapter = createUsbAudioProductionAdapter({
      devices: MICS,
      ...audio,
      helperProgram: audio.helperProgram ?? NEVER(),
      guardProgram: audio.guardProgram ?? NEVER(),
      // The two members this file does not reach (row 88 adds them where it builds the adapter).
      configWriter: { write: NEVER } as never,
      runDir: '/nonexistent/run/capture',
      door: NEVER,
    });
    expect([adapter.kind, adapter.hasOpener]).toEqual([CaptureAdapterKind.USB_AUDIO, true]);
    // Row 85c: the fault sink and `superseded` are in the bundle; the lift adds the device list, the two match functions and `held`.
    expect(Object.keys(composition.watches.microphone).sort()).toEqual(['cards', 'faults', 'registered', 'superseded', 'timers']);
    const watch = createMicLossWatch({
      ...composition.watches.microphone,
      devices: () => MICS.map((device) => device.id),
      identify: identifyRegisteredCard,
      isRow: isRegisteredAudioInput,
      held: () => adapter.openSources(),
    });
    expect(() => audio.onSourceLost('MIC-03', new Error('ended'))).not.toThrow();
    const lost: string[] = [];
    composition.attachMicLossWatch({ sourceLost: (deviceId) => void lost.push(deviceId) });
    audio.onSourceLost('MIC-03', new Error('ended'));
    // Row B2 (S-02): the loss before the attach was kept and handed over, then the one after it.
    expect(lost).toEqual(['MIC-03', 'MIC-03']);
    expect(() => composition.attachMicLossWatch({ sourceLost: () => {} })).toThrow(CaptureCompositionError);
    expect(typeof watch.start).toBe('function');
  });
});

// ── Task 4 row 85c (decision C60 (2), (3)): the remainder of the composition ───────────────────

describe('row 85c (b): the runner of the card listing program - the fixed row of the helper table through the production door', () => {
  const LISTING = '**** List of CAPTURE Hardware Devices ****\ncard 1: Duo [DEMS Test Duo], device 0: USB Audio [USB Audio]\n  Subdevices: 1/1\n  Subdevice #0: subdevice #0\n';
  /** The REAL production door; only the core-file limit of this test process is answered as 0 (the door refuses to start anything otherwise). */
  const door: ProductionDoor = (options) => productionCameraDoors(createSystemTimers()).door({ ...options, coreFileLimit: () => 0 });
  const timers = createSystemTimers();
  const folders: string[] = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
  });
  /** A stand-in of the listing program: a shell script in a temporary directory. It writes what it was started with beside itself, then does `body`. */
  const standIn = (body: string): string => {
    const folder = mkdtempSync(join(tmpdir(), 'dems-row085c-'));
    folders.push(folder);
    const program = join(folder, 'listing');
    writeFileSync(program, `#!/bin/sh\nprintf '%s\\n' "$#" "$@" > "$0.args"\n/usr/bin/env > "$0.env"\n${body}\n`, { mode: 0o700 });
    chmodSync(program, 0o700);
    return program;
  };
  const failureOf = async (programs: CardListingPrograms): Promise<unknown> => {
    const error = await refusalOf(programs.captureDevices());
    expect(error).toBeInstanceOf(CardListingProgramError);
    expect(error.code).toBe('AUDIO_CARD_LISTING_PROGRAM_FAILED');
    return error.reason;
  };

  it('the row is FIXED: one program by an absolute literal, one argument, no parameter - and the stand-in is started with exactly that argument and none of the server\'s environment', async () => {
    expect(LINUX_CARD_LISTING_PROGRAM).toBe('/usr/bin/arecord');
    expect(linuxCardListingArguments()).toEqual(['-l']);
    expect(linuxCardListingArguments.length).toBe(0);
    expect(Object.isFrozen(linuxCardListingArguments())).toBe(true);
    const program = standIn(`cat <<'EOF'\n${LISTING}EOF`);
    process.env['DEMS_ROW085C_MARK'] = 'must-not-travel';
    try {
      expect(await cardListingProgramsOf({ door, timers, program }).captureDevices()).toBe(LISTING);
    } finally {
      delete process.env['DEMS_ROW085C_MARK'];
    }
    expect(readFileSync(`${program}.args`, 'utf8')).toBe('1\n-l\n');
    const environment = readFileSync(`${program}.env`, 'utf8');
    expect(environment).not.toContain('DEMS_ROW085C_MARK');
    expect(environment).not.toMatch(/^(?:HOME|USER|PATH=.*node|NODE_|DEMS_)/m);
    // The runner offers the ONE text of the fixed row: no hardware parameter dump (its arguments would be two integers of a listing).
    expect(Object.keys(cardListingProgramsOf({ door, timers, program }))).toEqual(['captureDevices']);
  });

  it('its text is handed to the card listing reader: the enumerator lists the card of the fixture, with the facts of the sound directory - and asks the program again at every listing', async () => {
    const program = standIn(`cat <<'EOF'\n${LISTING}EOF`);
    const root = mkdtempSync(join(tmpdir(), 'dems-row085c-asound-'));
    folders.push(root);
    mkdirSync(join(root, 'card1'));
    writeFileSync(join(root, 'cards'), ' 1 [Duo            ]: USB-Audio - DEMS Test Duo\n                      DEMS Test Duo\n');
    writeFileSync(join(root, 'card1', 'usbid'), '1a2b:0001\n');
    writeFileSync(join(root, 'card1', 'stream0'), 'DEMS Test Duo at usb-0000:00:14.0-2, high speed : USB Audio\n\nCapture:\n  Status: Stop\n  Interface 1\n    Altset 1\n    Format: S24_3LE\n    Channels: 2\n    Endpoint: 0x81 (1 IN) (ASYNC)\n    Rates: 44100, 48000\n    Bits: 24\n\n');
    const enumerator = createCardEnumerator(createCardListingReader(cardListingProgramsOf({ door, timers, program }), root, join(root, 'no-devices')));
    const listing = await enumerator.list();
    expect(listing.cards).toHaveLength(1);
    expect(listing.cards[0]).toMatchObject({ cardIndex: 1, cardId: 'Duo', deviceIndex: 0, usbId: '1a2b:0001', channelCount: 2, product: 'DEMS Test Duo' });
    expect([listing.truncated, listing.skipped]).toEqual([false, 0]);
    // A second listing is a second run: the fixture changed in between is what is listed.
    writeFileSync(program, `#!/bin/sh\ncat <<'EOF'\n**** List of CAPTURE Hardware Devices ****\nEOF\n`, { mode: 0o700 });
    expect((await enumerator.list()).cards).toEqual([]);
  });

  it('fail-closed: a program that is not there, a relative path, another exit code, a program that does not end, and more text than the door keeps - each is the NAMED refusal and no text is answered', async () => {
    expect(await failureOf(cardListingProgramsOf({ door, timers, program: '/nonexistent/dems/arecord' }))).toBe(CardListingProgramFailure.NOT_STARTED);
    expect(await failureOf(cardListingProgramsOf({ door, timers, program: 'arecord' }))).toBe(CardListingProgramFailure.NOT_STARTED);
    // The door's own refusal (a Core whose core-file limit is not 0) is a start that did not happen.
    expect(await failureOf(cardListingProgramsOf({ door: (options) => productionCameraDoors(timers).door({ ...options, coreFileLimit: () => 1024 }), timers, program: standIn('exit 0') }))).toBe(CardListingProgramFailure.NOT_STARTED);
    // The text a failing program printed is not a listing.
    expect(await failureOf(cardListingProgramsOf({ door, timers, program: standIn(`printf 'card 1: Duo [DEMS Test Duo], device 0: USB Audio [USB Audio]\\n'\nexit 3`) }))).toBe(CardListingProgramFailure.ENDED_NONZERO);
    const stuck = standIn('exec /bin/sleep 30');
    const before = Date.now();
    expect(await failureOf(cardListingProgramsOf({ door, timers, program: stuck, boundMs: 300 }))).toBe(CardListingProgramFailure.TIMED_OUT);
    expect(Date.now() - before).toBeLessThan(10_000);
    expect(await failureOf(cardListingProgramsOf({ door, timers, program: standIn('/usr/bin/yes "card 1: Duo [DEMS Test Duo], device 0: USB Audio [USB Audio]" | /usr/bin/head -c 70000') }))).toBe(CardListingProgramFailure.OUTPUT_TOO_LONG);
    // No refusal carries a path, an argument or a line of output.
    const error = await refusalOf(cardListingProgramsOf({ door, timers, program: '/nonexistent/dems/arecord' }).captureDevices());
    expect(JSON.stringify({ ...(error as object), message: (error as Error).message })).not.toMatch(/nonexistent|arecord|-l\b/);
  });

  it('through the enumerator a failed run is the listing\'s failure, passed on unchanged: nothing is listed from a half answer', async () => {
    const { enumerator, unavailable } = cardEnumeratorOf(CARD_LISTING_PLATFORM, cardListingProgramsOf({ door, timers, program: standIn('exit 1') }));
    expect(unavailable).toBeNull();
    const error = await refusalOf(enumerator.list());
    expect([error.code, error.reason]).toEqual(['AUDIO_CARD_LISTING_PROGRAM_FAILED', 'ENDED_NONZERO']);
  });

  it('the composition: on the platform with a reader the enumerator has the product\'s runner behind it - `LISTING_PROGRAM_NOT_HANDED_IN` is no answer any more and nothing is reported; on macOS the named answer stays and NO program is ever started', async () => {
    const linux = rig(CaptureOperation.REAL_PRODUCTION);
    const composition = composed(linux, { platform: CARD_LISTING_PLATFORM });
    expect(composition.cardListingUnavailable).toBeNull();
    expect(linux.reports).toEqual([]);
    expect(linux.enumerators[0]).toBe(composition.cards);
    // The same decision in the fence's own function, with a door that fails the test if it is ever asked.
    const never: ProductionDoor = () => {
      throw new Error('no program is started on a platform without the sound directory');
    };
    for (const platform of ['darwin', 'win32', 'freebsd', '']) {
      const { enumerator, unavailable } = hostCardEnumeratorOf({ platform, door: never, timers });
      expect(unavailable).toBe(CardListingUnavailable.NOT_AVAILABLE_ON_THIS_PLATFORM);
      const error = await refusalOf(enumerator.list());
      expect([error.code, error.reason]).toEqual(['AUDIO_CARD_LISTING_NOT_AVAILABLE', 'NOT_AVAILABLE_ON_THIS_PLATFORM']);
    }
    // On the platform with a reader the door IS asked, with the table's row and nothing else.
    const asked: { command: string; args: readonly string[]; env: unknown; message: unknown }[] = [];
    const recording: ProductionDoor = (options) => {
      asked.push({ command: options.command, args: options.args, env: options.env, message: options.message });
      return { pid: null, started: Promise.resolve(), ended: Promise.resolve({ exitCode: 0, signal: null, spawnFailed: false, diagnostics: '', output: '' }), alive: () => false, endInput: () => {}, kill: () => {} };
    };
    const host = hostCardEnumeratorOf({ platform: CARD_LISTING_PLATFORM, door: recording, timers });
    expect(host.unavailable).toBeNull();
    expect((await host.enumerator.list()).cards).toEqual([]);
    expect(asked).toEqual([{ command: '/usr/bin/arecord', args: ['-l'], env: {}, message: null }]);
    // The two-argument function still names the missing program text for a caller that hands none in (no composed Core does).
    expect(cardEnumeratorOf(CARD_LISTING_PLATFORM, undefined).unavailable).toBe(CardListingUnavailable.LISTING_PROGRAM_NOT_HANDED_IN);
  });
});

describe('row 85c (d): the fault sink of the two watches (decision C60 (2)) - a watch clears ONLY the fault it raised itself', () => {
  const CAMERA_FAULT: WatchFault = { code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' };
  const MIC_FAULT: WatchFault = { code: 'CAPTURE_FAULT', subject: 'MIC-03', reason: 'MIC_DISCONNECTED' };
  const keyOf = (fault: WatchFault): string => `${fault.reason}@${fault.subject}`;
  /** The engine as the sink sees it: a list of active faults (whoever raised them) and the two actions, recorded. */
  const engineDouble = () => {
    const active = new Set<string>();
    const calls: string[] = [];
    const handed: unknown[] = [];
    const state = { running: true, slowRaise: null as Promise<void> | null };
    const engine: WatchFaultEngine = {
      active: (fault) => active.has(keyOf(fault)),
      raise: async (fault) => {
        handed.push(fault);
        if (state.slowRaise !== null) await state.slowRaise;
        calls.push(`raise ${keyOf(fault)}`);
        active.add(keyOf(fault));
      },
      clear: async (fault) => {
        handed.push(fault);
        calls.push(`clear ${keyOf(fault)}`);
        active.delete(keyOf(fault));
      },
    };
    const notes: string[] = [];
    const sink = watchFaultSinkOf(
      () => (state.running ? engine : null),
      (code, fault) => void notes.push(`${code} ${fault.subject}`),
    );
    return { active, calls, handed, state, notes, sink };
  };

  it('its own fault: raised once, owned, cleared once - by that cause on that device, with the three members and nothing else', async () => {
    const e = engineDouble();
    await e.sink.raise({ ...CAMERA_FAULT, sessionId: 'SES-1', evidenceFiles: 0 } as WatchFault);
    await e.sink.raise(CAMERA_FAULT);
    expect(e.calls).toEqual(['raise CAMERA_STREAM_ENDED@CAM-01']);
    expect(e.sink.owned()).toEqual(['CAMERA_STREAM_ENDED:CAM-01']);
    await e.sink.clear(CAMERA_FAULT);
    await e.sink.clear(CAMERA_FAULT);
    expect(e.calls).toEqual(['raise CAMERA_STREAM_ENDED@CAM-01', 'clear CAMERA_STREAM_ENDED@CAM-01']);
    expect(e.sink.owned()).toEqual([]);
    expect(e.handed).toEqual([CAMERA_FAULT, CAMERA_FAULT]);
    for (const fault of e.handed) expect(Object.keys(fault as object).sort()).toEqual(['code', 'reason', 'subject']);
    // The second clear found nothing of its own.
    expect(e.notes).toEqual(['CAPTURE_WATCH_FAULT_CLEAR_NOT_OWNED CAM-01']);
  });

  it('ANOTHER PART\'S FAULT: the key is active before the watch speaks (the capture worker said it) - nothing is written, the sink does not own it, and its clear leaves the fault active', async () => {
    const e = engineDouble();
    e.active.add(keyOf(MIC_FAULT));
    await e.sink.raise(MIC_FAULT);
    expect([e.calls, e.sink.owned()]).toEqual([[], []]);
    await e.sink.clear(MIC_FAULT);
    expect(e.calls).toEqual([]);
    expect(e.active.has(keyOf(MIC_FAULT))).toBe(true);
    expect(e.notes).toEqual(['CAPTURE_WATCH_FAULT_HELD_BY_ANOTHER MIC-03', 'CAPTURE_WATCH_FAULT_CLEAR_NOT_OWNED MIC-03']);
    // The other cause on the same device, and the same cause on another device, are not touched by anything the sink does.
    e.active.add('CAMERA_CLOCK_OUT_OF_BOUND@CAM-01');
    await e.sink.raise(CAMERA_FAULT);
    await e.sink.clear(CAMERA_FAULT);
    expect([...e.active].sort()).toEqual(['CAMERA_CLOCK_OUT_OF_BOUND@CAM-01', 'MIC_DISCONNECTED@MIC-03']);
  });

  it('a fault of its own that another part ended (a new session records, the boot): the clear writes nothing and the ownership is over; a later episode is a new raise', async () => {
    const e = engineDouble();
    await e.sink.raise(CAMERA_FAULT);
    e.active.clear();
    await e.sink.clear(CAMERA_FAULT);
    expect(e.calls).toEqual(['raise CAMERA_STREAM_ENDED@CAM-01']);
    expect(e.sink.owned()).toEqual([]);
    expect(e.notes).toEqual(['CAPTURE_WATCH_FAULT_ENDED_BY_ANOTHER CAM-01']);
    await e.sink.raise(CAMERA_FAULT);
    expect(e.calls).toHaveLength(2);
  });

  it('fail-closed: no engine - a raise and a clear are the named refusal, nothing is written and what is owned stays; a fault that is not a watch\'s is refused before the engine is asked', async () => {
    const e = engineDouble();
    e.state.running = false;
    expect((await refusalOf(e.sink.raise(CAMERA_FAULT))).code).toBe('CAPTURE_WATCH_FAULT_ENGINE_NOT_AVAILABLE');
    expect([e.calls, e.sink.owned()]).toEqual([[], []]);
    e.state.running = true;
    await e.sink.raise(CAMERA_FAULT);
    e.state.running = false;
    expect((await refusalOf(e.sink.clear(CAMERA_FAULT))).code).toBe('CAPTURE_WATCH_FAULT_ENGINE_NOT_AVAILABLE');
    expect(e.sink.owned()).toEqual(['CAMERA_STREAM_ENDED:CAM-01']);
    e.state.running = true;
    await e.sink.clear(CAMERA_FAULT);
    expect(e.calls).toEqual(['raise CAMERA_STREAM_ENDED@CAM-01', 'clear CAMERA_STREAM_ENDED@CAM-01']);
    // Not of a watch: another cause, no cause (a clear without one would end EVERY cause on the device), the capture as a whole,
    // another kind, a device of the other class, a path in the place of an id.
    const before = e.calls.length;
    const strangers = [
      { code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_ANNOUNCE_NOT_MATCHED' },
      { code: 'CAPTURE_FAULT', subject: 'CAM-01' },
      { code: 'CAPTURE_FAULT', subject: null, reason: 'CAMERA_STREAM_ENDED' },
      { code: 'MIC_SILENT', subject: 'MIC-03', reason: 'MIC_DISCONNECTED' },
      { code: 'CAPTURE_FAULT', subject: 'MIC-03', reason: 'CAMERA_STREAM_ENDED' },
      { code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'MIC_DISCONNECTED' },
      { code: 'CAPTURE_FAULT', subject: '../CAM-01', reason: 'CAMERA_STREAM_ENDED' },
      { code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'constructor' },
    ] as unknown as WatchFault[];
    for (const stranger of strangers) {
      expect((await refusalOf(e.sink.raise(stranger))).code).toBe('CAPTURE_WATCH_FAULT_NOT_OF_A_WATCH');
      expect((await refusalOf(e.sink.clear(stranger))).code).toBe('CAPTURE_WATCH_FAULT_NOT_OF_A_WATCH');
    }
    expect(e.calls).toHaveLength(before);
  });

  it('per fault the steps run one after the other: a clear asked while the raise is on its way is the clear of that raise, not a clear of nothing', async () => {
    const e = engineDouble();
    let release: () => void = () => {};
    e.state.slowRaise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const raising = e.sink.raise(CAMERA_FAULT);
    const clearing = e.sink.clear(CAMERA_FAULT);
    release();
    await Promise.all([raising, clearing]);
    expect(e.calls).toEqual(['raise CAMERA_STREAM_ENDED@CAM-01', 'clear CAMERA_STREAM_ENDED@CAM-01']);
    expect([e.sink.owned(), [...e.active]]).toEqual([[], []]);
  });

  it('THE REAL WATCHES ON THE SINK OF THE COMPOSITION: one sink for both; a camera the worker faulted first is never cleared by the watch, a camera the watch faulted is; a superseded microphone word raises nothing', async () => {
    const e = engineDouble();
    const state = { replacing: false };
    const built = rig(CaptureOperation.REAL_PRODUCTION, { faultEngine: () => (e.state.running ? { active: (fault) => e.active.has(keyOf(fault)), raise: async (fault) => void (e.calls.push(`raise ${keyOf(fault)}`), e.active.add(keyOf(fault))), clear: async (fault) => void (e.calls.push(`clear ${keyOf(fault)}`), e.active.delete(keyOf(fault))) } : null), workerSuperseded: () => state.replacing });
    const composition = composed(built, { platform: 'darwin' });
    expect(composition.watches.camera.faults).toBe(composition.faults);
    expect(composition.watches.microphone.faults).toBe(composition.faults);
    const settle = async (): Promise<void> => {
      for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
    };
    const camera = createCameraWatch({ ...composition.watches.camera, reader: { read: () => Promise.reject(new Error('no read in this test')) } });
    // (1) The worker said CAM-01 first; the watch sees the same loss, then the push back: the fault stays the worker's.
    e.active.add('CAMERA_STREAM_ENDED@CAM-01');
    camera.relayEnded({ deviceId: 'CAM-01', code: 'CAPTURE_CAMERA_STREAM_LOST' });
    await settle();
    camera.pushEstablished({ deviceId: 'CAM-01' });
    await settle();
    expect(e.calls).toEqual([]);
    expect(e.active.has('CAMERA_STREAM_ENDED@CAM-01')).toBe(true);
    // (2) The watch is first for CAM-02: one raise, and one clear when the push is back.
    camera.relayEnded({ deviceId: 'CAM-02', code: 'CAPTURE_CAMERA_STREAM_LOST' });
    await settle();
    expect(composition.faults.owned()).toEqual(['CAMERA_STREAM_ENDED:CAM-02']);
    camera.pushEstablished({ deviceId: 'CAM-02' });
    await settle();
    expect(e.calls).toEqual(['raise CAMERA_STREAM_ENDED@CAM-02', 'clear CAMERA_STREAM_ENDED@CAM-02']);
    // (3) No engine at the loss, then the worker raises it, then the push returns: the watch raised nothing and clears nothing.
    e.state.running = false;
    camera.relayEnded({ deviceId: 'CAM-02', code: 'CAPTURE_CAMERA_STREAM_LOST' });
    await settle();
    e.state.running = true;
    e.active.add('CAMERA_STREAM_ENDED@CAM-02');
    camera.pushEstablished({ deviceId: 'CAM-02' });
    await settle();
    expect(e.calls).toHaveLength(2);
    expect(e.active.has('CAMERA_STREAM_ENDED@CAM-02')).toBe(true);
    camera.close();
    // What the sink did not write is reported by code and device id, as a warning.
    expect(built.reports.filter((entry) => entry.code === CaptureCompositionCode.WATCH_FAULT_NOTE)).toEqual([
      { level: 'warn', code: CaptureCompositionCode.WATCH_FAULT_NOTE, context: { note: 'CAPTURE_WATCH_FAULT_HELD_BY_ANOTHER', deviceId: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' } },
      { level: 'warn', code: CaptureCompositionCode.WATCH_FAULT_NOTE, context: { note: 'CAPTURE_WATCH_FAULT_CLEAR_NOT_OWNED', deviceId: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' } },
    ]);

    // The microphone loss watch on the same sink, with `superseded` of the composition.
    const held = new Set<string>(['MIC-03']);
    const mic = createMicLossWatch({ ...composition.watches.microphone, devices: () => ['MIC-03'], identify: identifyRegisteredCard, isRow: isRegisteredAudioInput, held: () => [...held] });
    state.replacing = true;
    mic.sourceLost('MIC-03', new Error('ended'));
    await mic.settled();
    expect(e.calls).toHaveLength(2);
    state.replacing = false;
    mic.sourceLost('MIC-03', new Error('ended'));
    await mic.settled();
    expect(e.calls.at(-1)).toBe('raise MIC_DISCONNECTED@MIC-03');
    expect(composition.faults.owned()).toEqual(['MIC_DISCONNECTED:MIC-03']);
  });

  // Row B2 (review follow-up S-02 of `verification/060b`; decision C95). Before the lift no production kind records, so the
  // proof is at the composition's level: the adapter's two callbacks are called as an adapter would call them, and the
  // watches are the REAL ones on the composition's sink over the engine double above (or a recording double of the shape).
  describe('row B2 (S-02): a loss that arrives BEFORE its watch is attached is kept and handed over - none is lost, none is invented', () => {
    const settle = async (): Promise<void> => {
      for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
    };
    const engineOf = (e: ReturnType<typeof engineDouble>): WatchFaultEngine => ({ active: (fault) => e.active.has(keyOf(fault)), raise: async (fault) => void (e.calls.push(`raise ${keyOf(fault)}`), e.active.add(keyOf(fault))), clear: async (fault) => void (e.calls.push(`clear ${keyOf(fault)}`), e.active.delete(keyOf(fault))) });
    const earlyReports = (built: Rig): unknown[] =>
      built.reports.filter((entry) => ([CaptureCompositionCode.CAMERA_WATCH_NOT_ATTACHED, CaptureCompositionCode.MIC_LOSS_WATCH_NOT_ATTACHED, CaptureCompositionCode.EARLY_LOSS_NOT_DELIVERED] as string[]).includes(entry.code));

    it('NOT SILENT: each early loss is reported at once, as an error, by code and device id - a lift that never attaches its watch is seen at the first relay end', () => {
      const built = rig(CaptureOperation.REAL_PRODUCTION);
      const { camera, audio } = composed(built, { platform: 'darwin' }).dependencies;
      camera.relayEnded({ sessionId: SESSION, deviceId: 'CAM-01', attempt: 1, code: 'CAPTURE_CAMERA_STREAM_LOST' });
      audio.onSourceLost('MIC-03', new Error('a path /dev/snd/secret'));
      // An `end` that carries no id of the id form is logged with none: nothing of an adapter's text is repeated.
      camera.relayEnded({ deviceId: 'rtsp://user:pw@192.168.50.21/' });
      camera.relayEnded(null);
      expect(earlyReports(built)).toEqual([
        { level: 'error', code: CaptureCompositionCode.CAMERA_WATCH_NOT_ATTACHED, context: { deviceId: 'CAM-01', kept: 1 } },
        { level: 'error', code: CaptureCompositionCode.MIC_LOSS_WATCH_NOT_ATTACHED, context: { deviceId: 'MIC-03', kept: 1 } },
        { level: 'error', code: CaptureCompositionCode.CAMERA_WATCH_NOT_ATTACHED, context: { deviceId: null, kept: 2 } },
        { level: 'error', code: CaptureCompositionCode.CAMERA_WATCH_NOT_ATTACHED, context: { deviceId: null, kept: 3 } },
      ]);
      expect(JSON.stringify(built.reports)).not.toMatch(/secret|rtsp|192\.168/);
    });

    it('THE REAL CAMERA WATCH: a relay end before the attach raises ITS fault at the attach - once, in the order of arrival, and the hand-over happens once; with NO early loss the attach raises nothing', async () => {
      const e = engineDouble();
      const built = rig(CaptureOperation.REAL_PRODUCTION, { faultEngine: () => engineOf(e) });
      const composition = composed(built, { platform: 'darwin' });
      const { relayEnded } = composition.dependencies.camera;
      relayEnded({ sessionId: SESSION, deviceId: 'CAM-02', attempt: 1, code: 'CAPTURE_CAMERA_STREAM_LOST' });
      relayEnded({ sessionId: SESSION, deviceId: 'CAM-01', attempt: 1, code: 'CAPTURE_CAMERA_STREAM_LOST' });
      await settle();
      expect(e.calls).toEqual([]);
      const watch = createCameraWatch({ ...composition.watches.camera, reader: { read: () => Promise.reject(new Error('no read in this test')) } });
      composition.attachCameraWatch(watch);
      await settle();
      expect(e.calls).toEqual(['raise CAMERA_STREAM_ENDED@CAM-02', 'raise CAMERA_STREAM_ENDED@CAM-01']);
      expect(composition.faults.owned()).toEqual(['CAMERA_STREAM_ENDED:CAM-01', 'CAMERA_STREAM_ENDED:CAM-02']);
      // After the attach a loss goes straight to the watch and is not reported as early; the kept ones are not handed over again.
      const reportsBefore = earlyReports(built).length;
      watch.pushEstablished({ deviceId: 'CAM-02' });
      await settle();
      relayEnded({ sessionId: SESSION, deviceId: 'CAM-02', attempt: 2, code: 'CAPTURE_CAMERA_STREAM_LOST' });
      await settle();
      expect(e.calls).toEqual(['raise CAMERA_STREAM_ENDED@CAM-02', 'raise CAMERA_STREAM_ENDED@CAM-01', 'clear CAMERA_STREAM_ENDED@CAM-02', 'raise CAMERA_STREAM_ENDED@CAM-02']);
      expect(earlyReports(built)).toHaveLength(reportsBefore);
      watch.close();

      // CONTROL: nothing arrived early - the attach hands over nothing, so no fault is invented.
      const quiet = engineDouble();
      const other = composed(rig(CaptureOperation.REAL_PRODUCTION, { faultEngine: () => engineOf(quiet) }), { platform: 'darwin' });
      const idle = createCameraWatch({ ...other.watches.camera, reader: { read: () => Promise.reject(new Error('no read in this test')) } });
      other.attachCameraWatch(idle);
      await settle();
      expect([quiet.calls, other.faults.owned()]).toEqual([[], []]);
      idle.close();
    });

    it('THE REAL MICROPHONE WATCH: an early loss raises at the attach; an early loss of a SUPERSEDED attempt is still dropped - judged by the answer of the moment the adapter spoke, not of the hand-over (rows 191, 85c)', async () => {
      const e = engineDouble();
      const state = { replacing: false };
      const asked: boolean[] = [];
      const built = rig(CaptureOperation.REAL_PRODUCTION, { faultEngine: () => engineOf(e), workerSuperseded: () => (asked.push(state.replacing), state.replacing) });
      const composition = composed(built, { platform: 'darwin' });
      const { onSourceLost } = composition.dependencies.audio;
      // MIC-04: its helper ended while the worker was being replaced (superseded). MIC-03: a loss of the attempt in force.
      state.replacing = true;
      onSourceLost('MIC-04', new Error('ended'));
      state.replacing = false;
      onSourceLost('MIC-03', new Error('ended'));
      expect(asked).toEqual([true, false]);
      // At the hand-over the worker IS being replaced: the answer of that later moment must not decide either word.
      state.replacing = true;
      const mic = createMicLossWatch({ ...composition.watches.microphone, devices: () => ['MIC-03', 'MIC-04'], identify: identifyRegisteredCard, isRow: isRegisteredAudioInput, held: () => ['MIC-03', 'MIC-04'] });
      composition.attachMicLossWatch(mic);
      await mic.settled();
      await settle();
      expect(asked).toEqual([true, false]);
      expect(e.calls).toEqual(['raise MIC_DISCONNECTED@MIC-03']);
      expect(composition.faults.owned()).toEqual(['MIC_DISCONNECTED:MIC-03']);
      // After the attach the port is asked in the turn the adapter speaks, as before: a word of the attempt being replaced raises nothing.
      onSourceLost('MIC-04', new Error('ended'));
      await mic.settled();
      expect(asked).toEqual([true, false, true]);
      expect(e.calls).toEqual(['raise MIC_DISCONNECTED@MIC-03']);
    });

    it('a port that could not answer "superseded" when the adapter spoke: the early word COUNTS at the hand-over, as it does after the attach (a loss is told rather than hidden)', async () => {
      const e = engineDouble();
      const state = { broken: true };
      const built = rig(CaptureOperation.REAL_PRODUCTION, {
        faultEngine: () => engineOf(e),
        workerSuperseded: () => {
          if (state.broken) throw new Error('no session');
          return true;
        },
      });
      const composition = composed(built, { platform: 'darwin' });
      composition.dependencies.audio.onSourceLost('MIC-03', new Error('ended'));
      state.broken = false;
      const mic = createMicLossWatch({ ...composition.watches.microphone, devices: () => ['MIC-03'], identify: identifyRegisteredCard, isRow: isRegisteredAudioInput, held: () => ['MIC-03'] });
      composition.attachMicLossWatch(mic);
      await mic.settled();
      await settle();
      expect(e.calls).toEqual(['raise MIC_DISCONNECTED@MIC-03']);
    });

    it('BOUNDED, and still not silent: beyond what is kept a loss is reported as NOT DELIVERED; a watch that throws at the hand-over is reported and the next kept loss still reaches it', () => {
      const built = rig(CaptureOperation.REAL_PRODUCTION);
      const composition = composed(built, { platform: 'darwin' });
      const { relayEnded } = composition.dependencies.camera;
      for (let index = 0; index < EARLY_LOSSES_KEPT + 2; index += 1) relayEnded({ deviceId: 'CAM-01', index });
      const reports = earlyReports(built) as { readonly code: string; readonly context: object }[];
      expect(reports).toHaveLength(EARLY_LOSSES_KEPT + 2);
      expect(reports.slice(-2)).toEqual([
        { level: 'error', code: CaptureCompositionCode.EARLY_LOSS_NOT_DELIVERED, context: { reason: 'MORE_THAN_KEPT', watch: CaptureCompositionCode.CAMERA_WATCH_NOT_ATTACHED, deviceId: 'CAM-01' } },
        { level: 'error', code: CaptureCompositionCode.EARLY_LOSS_NOT_DELIVERED, context: { reason: 'MORE_THAN_KEPT', watch: CaptureCompositionCode.CAMERA_WATCH_NOT_ATTACHED, deviceId: 'CAM-01' } },
      ]);
      const seen: number[] = [];
      composition.attachCameraWatch({
        relayEnded: (end) => {
          const { index } = end as { readonly index: number };
          if (index === 0) throw new Error('a watch that throws');
          seen.push(index);
        },
        clockOffsetMs: async () => 0,
      });
      expect(seen).toEqual(Array.from({ length: EARLY_LOSSES_KEPT - 1 }, (_, index) => index + 1));
      expect(earlyReports(built).at(-1)).toEqual({ level: 'error', code: CaptureCompositionCode.EARLY_LOSS_NOT_DELIVERED, context: { reason: 'WATCH_THREW', watch: CaptureCompositionCode.CAMERA_WATCH_NOT_ATTACHED, deviceId: null } });
      expect(JSON.stringify(built.reports)).not.toContain('a watch that throws');
    });
  });
});

// ── Task 4 row 106c (decision C82, named amendment SR-11): the third fact source of the alias lifecycle ──
//
// The runner is a DOUBLE of this file: it records the question it was handed and answers from a script. Nothing is started,
// no file is read, no `ip` or other network command exists here.

describe('row 106c (SR-11): the interface file of the address helper - the entry\'s runner with the FIXED row, on linux only', () => {
  type Answer = { readonly outcome: string; readonly exitCode?: number; readonly output?: string };
  const runner = (answer: Answer | (() => never)) => {
    const asked: unknown[] = [];
    const run = async (command: unknown): Promise<never> => {
      asked.push(command);
      return (typeof answer === 'function' ? answer() : answer) as never;
    };
    return { asked, run };
  };
  const ran = (output: string, exitCode = 0): Answer => ({ outcome: 'RAN', exitCode, output });

  it('the question is the fixed row and nothing else: one program by an absolute literal, one path, no argument from data; the answer is the ONE name', async () => {
    const host = runner(ran('enp3s0\n'));
    const source = hostAliasInterfaceFileOf({ platform: 'linux', hostRunner: host.run });
    await expect(source()).resolves.toBe('enp3s0');
    await expect(source()).resolves.toBe('enp3s0');
    // Asked at every use (an `add`), never at composition; the same frozen row each time.
    expect(host.asked).toEqual([
      { program: '/usr/bin/cat', args: ['/etc/dems/netalias-interface'] },
      { program: '/usr/bin/cat', args: ['/etc/dems/netalias-interface'] },
    ]);
    expect(host.asked[0]).toBe(host.asked[1]);
    expect(Object.isFrozen(host.asked[0])).toBe(true);
    expect(Object.isFrozen((host.asked[0] as { args: unknown }).args)).toBe(true);
  });

  it('composing asks nothing: the runner is called when the source is asked, not before', () => {
    const host = runner(ran('eth1\n'));
    hostAliasInterfaceFileOf({ platform: 'linux', hostRunner: host.run });
    expect(host.asked).toEqual([]);
  });

  it.each(['darwin', 'win32', 'freebsd', 'Linux', ''])('on the platform "%s" nothing is run and the file is unreadable', async (platform) => {
    const host = runner(ran('eth1\n'));
    await expect(hostAliasInterfaceFileOf({ platform, hostRunner: host.run })()).resolves.toBeNull();
    expect(host.asked).toEqual([]);
  });

  it('no runner handed in: unreadable, on linux too (the fail-closed state before row 106c, kept)', async () => {
    await expect(hostAliasInterfaceFileOf({ platform: 'linux' })()).resolves.toBeNull();
    await expect(hostAliasInterfaceFileOf({ platform: 'darwin' })()).resolves.toBeNull();
  });

  it.each<[string, Answer | (() => never)]>([
    ['the program could not be started', { outcome: 'NOT_STARTED' }],
    ['the program did not end', { outcome: 'TIMED_OUT' }],
    ['the file may not be read', ran('', 1)],
    ['an empty file', ran('')],
    ['two names', ran('eth1\neth2\n')],
    ['characters outside the form of an interface name', ran('eth1 && ip addr\n')],
    ['a name with a slash', ran('net/eth1\n')],
    ['more text than an interface file holds', ran(`${'eth1\n'.repeat(80)}`)],
    ['a runner that throws', () => { throw new Error('the runner failed'); }],
  ])('unreadable - %s: the source answers null, never a guess and never a throw', async (_name, answer) => {
    const host = runner(answer);
    await expect(hostAliasInterfaceFileOf({ platform: 'linux', hostRunner: host.run })()).resolves.toBeNull();
    expect(host.asked).toHaveLength(1);
  });

  it('a test\'s own source stands IN THE PLACE of the product\'s: the runner is then never asked', async () => {
    const host = runner(ran('eth1\n'));
    const source = hostAliasInterfaceFileOf({ platform: 'linux', hostRunner: host.run, aliasInterfaceFile: () => 'eth7' });
    expect(await source()).toBe('eth7');
    expect(host.asked).toEqual([]);
  });

  it('the composition of the other members does not touch the runner: composing production capture with one asks no question', () => {
    const host = runner(ran('eth1\n'));
    const built = rig(CaptureOperation.REAL_PRODUCTION);
    composed(built, { platform: 'linux', hostRunner: host.run, cardPrograms: { captureDevices: async () => '' } });
    expect(host.asked).toEqual([]);
  });
});

// ── Task 4 row 111b (decisions C78, C87): the host's own observations of the commissioning functions ──
//
// EVERY PROGRAM HERE IS A STAND-IN: a shell script in a temporary directory, started by the REAL production door (only
// the core-file limit of this test process is answered as 0). No `ip`, no `ping`, no `arping` runs; nothing is sent.

describe('row 111b: the neighbour row and the echo row - two fixed rows with ONE address made from four integers, through the production door, read by a strict form', () => {
  const HW = 'aa:bb:cc:00:11:22';
  const MAC = 'AA:BB:CC:00:11:22';
  const CANARY = 'cnry111bdevicetext';
  const PORT = 'eth1';
  const FACTORY = '192.168.1.64';
  const WITH_ALIAS: DestinationContext = { ...HOST, cameraAddresses: [...HOST.cameraAddresses, { address: '192.168.1.253', alias: true }], hostAddresses: [...HOST.hostAddresses, '192.168.1.253'] };
  const timers = createSystemTimers();
  const door: ProductionDoor = (options) => productionCameraDoors(timers).door({ ...options, coreFileLimit: () => 0 });
  const never: ProductionDoor = () => {
    throw new Error('no program is started here');
  };
  const folders: string[] = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
  });
  /** A stand-in program: it appends what it was started with beside itself, writes its environment there, then does `body`. */
  const standIn = (body: string): string => {
    const folder = mkdtempSync(join(tmpdir(), 'dems-row111b-'));
    folders.push(folder);
    const program = join(folder, 'program');
    writeFileSync(program, `#!/bin/sh\nprintf '%s\\n' "$#" "$@" >> "$0.args"\n/usr/bin/env > "$0.env"\n${body}\n`, { mode: 0o700 });
    chmodSync(program, 0o700);
    return program;
  };
  const prints = (text: string): string => standIn(`cat <<'EOF'\n${text}EOF`);
  const startedWith = (program: string): string | null => (existsSync(`${program}.args`) ? readFileSync(`${program}.args`, 'utf8') : null);
  const live = (): AbortSignal => new AbortController().signal;
  const inputsOf = (overrides: Partial<CommissioningHostParts> = {}): CommissioningHostInputs => {
    const made = hostCommissioningInputsOf({ platform: 'linux', timers, network: () => HOST, cameraInterface: () => PORT, door, ...overrides });
    if (made === null) throw new Error('expected the observations of a linux host');
    return made;
  };
  const whyOf = async (promise: Promise<unknown>): Promise<unknown> => {
    const error = await refusalOf(promise);
    expect(error).toBeInstanceOf(CommissioningInputError);
    expect(error.code).toBe('COMMISSIONING_INPUT_FAILED');
    return error.reason;
  };
  const line = (rest: string, address = CAMERA_ADDRESS): string => `${address} dev ${rest}\n`;

  it('THE ROWS, verbatim: `/usr/sbin/ip -4 neigh show to <address>` and `/usr/bin/ping -n -q -c 1 -W 1 <address>`; the address is rebuilt from four integers of a private range with a host part 1 to 254, and anything else makes nothing', () => {
    expect([LINUX_NEIGHBOUR_PROGRAM, ...linuxNeighbourArguments(CAMERA_ADDRESS)].join(' ')).toBe('/usr/sbin/ip -4 neigh show to 192.168.50.21');
    expect([LINUX_ECHO_PROGRAM, ...linuxEchoArguments(CAMERA_ADDRESS)].join(' ')).toBe('/usr/bin/ping -n -q -c 1 -W 1 192.168.50.21');
    expect([Object.isFrozen(linuxNeighbourArguments(CAMERA_ADDRESS)), Object.isFrozen(linuxEchoArguments(CAMERA_ADDRESS)), linuxNeighbourArguments.length, linuxEchoArguments.length]).toEqual([true, true, 1, 1]);
    expect([COMMISSIONING_HELPER_TABLE.neighbour, COMMISSIONING_HELPER_TABLE.echo]).toEqual([
      { program: '/usr/sbin/ip', literals: ['-4', 'neigh', 'show', 'to'] },
      { program: '/usr/bin/ping', literals: ['-n', '-q', '-c', '1', '-W', '1'] },
    ]);
    for (const address of ['10.0.0.1', '10.255.255.254', '172.16.0.1', '172.31.255.254', '192.168.0.1', FACTORY, '192.168.255.254']) {
      expect(commissioningAddressArgument(address), address).toBe(address);
      expect(COMMISSIONING_HELPER_TABLE.addressArgument.test(address), address).toBe(true);
    }
    const refused: readonly unknown[] = [
      '', ' 192.168.1.64', '192.168.1.64 ', '192.168.01.64', '192.168.1.064', '192.168.1', '192.168.1.64.5', '192.168.1.0', '192.168.1.255', '192.168.1.256', '8.8.8.8', '127.0.0.1', '169.254.1.1',
      '172.15.0.1', '172.32.0.1', '192.169.1.1', '224.0.0.1', '0.0.0.0', '255.255.255.255', '192.168.1.64/24', '192.168.1.64:80', '-I', '-c', '-f', 'eth0', 'camera.local', '0xC0.0xA8.1.64', '3232235840',
      '::ffff:192.168.1.64', '192.168.1.64\n-f', '192.168.1.64 -f', '192.168.1.64;id', '$(id)', '１９２.168.1.64', 'x'.repeat(40), 5, null, undefined, ['192.168.1.64'], { toString: () => '192.168.1.64' },
    ];
    for (const value of refused) {
      for (const make of [commissioningAddressArgument, linuxNeighbourArguments, linuxEchoArguments]) {
        let thrown: unknown = null;
        try {
          make(value as string);
        } catch (error) {
          thrown = error;
        }
        expect(thrown, String(value)).toBeInstanceOf(CommissioningArgumentError);
        expect((thrown as Error).message, String(value)).toBe('an address of a commissioning row is not of its shape');
      }
    }
  });

  it('THE READER of the neighbour row: one strict line form - LEARNT only in a state of a learnt address with a unicast hardware address on the camera interface; ABSENT for nothing, FAILED, INCOMPLETE and another interface; everything else UNKNOWN', () => {
    const read = (text: unknown, address = CAMERA_ADDRESS, port = PORT): unknown => neighbourReadingOf(text, address, port);
    const learnt = { kind: 'LEARNT', mac: MAC };
    for (const state of ['REACHABLE', 'STALE', 'DELAY', 'PROBE']) expect(read(line(`eth1 lladdr ${HW} ${state}`)), state).toEqual(learnt);
    expect(read(line(`eth1 lladdr ${HW} router REACHABLE`))).toEqual(learnt);
    expect(read(`${CAMERA_ADDRESS}  dev eth1   lladdr ${HW}\tSTALE \n\n`)).toEqual(learnt);
    // An entry of another interface is compared and left aside; the camera port's own decides.
    expect(read(`${line(`eth0 lladdr 02:00:00:00:00:09 REACHABLE`)}${line(`eth1 lladdr ${HW} REACHABLE`)}`)).toEqual(learnt);
    // SILENT is a statement of the host ("asked on the camera interface, no answer"); ABSENT is no statement at all.
    for (const silent of [line('eth1 FAILED'), `${CAMERA_ADDRESS} dev eth1  INCOMPLETE\n`, line(`eth1 lladdr ${HW} FAILED`), `${line('eth0 FAILED')}${line('eth1 INCOMPLETE')}`]) expect(read(silent), silent).toEqual({ kind: 'SILENT' });
    for (const absent of ['', '\n', line('eth0 lladdr 02:00:00:00:00:09 REACHABLE'), line('wlan0 FAILED')]) expect(read(absent), absent).toEqual({ kind: 'ABSENT' });
    const unknown: readonly unknown[] = [
      null, 7, undefined, ['x'],
      // another address, a second address, a name in the place of the address
      line(`eth1 lladdr ${HW} REACHABLE`, '192.168.50.22'), `${line(`eth1 lladdr ${HW} REACHABLE`)}${line(`eth1 lladdr ${HW} REACHABLE`, '192.168.50.22')}`, line(`eth1 lladdr ${HW} REACHABLE`, 'camera'),
      // states the reader does not know: set by hand, no state, lower case, a word after the state
      line(`eth1 lladdr ${HW} PERMANENT`), line(`eth1 lladdr ${HW} NOARP`), line(`eth1 lladdr ${HW} NONE`), line(`eth1 lladdr ${HW}`), line(`eth1 lladdr ${HW} reachable`), line(`eth1 lladdr ${HW} REACHABLE ${CANARY}`),
      line(`eth1 lladdr ${HW} extern_learn REACHABLE`), line(`eth1 lladdr ${HW} proxy REACHABLE`), line(`eth1 ${CANARY} REACHABLE`),
      // a hardware address that is none: short, upper case, with dashes, eight pairs, all zero, a group address, the broadcast
      line('eth1 lladdr aa:bb:cc:00:11 REACHABLE'), line('eth1 lladdr AA:BB:CC:00:11:22 REACHABLE'), line('eth1 lladdr aa-bb-cc-00-11-22 REACHABLE'), line('eth1 lladdr aa:bb:cc:00:11:22:33:44 REACHABLE'),
      line('eth1 lladdr 00:00:00:00:00:00 REACHABLE'), line('eth1 lladdr 01:00:5e:00:00:01 REACHABLE'), line('eth1 lladdr ff:ff:ff:ff:ff:ff REACHABLE'),
      // a learnt state without an address; two entries of the camera port; an interface name that is none; another form altogether
      line('eth1 REACHABLE'), `${line(`eth1 lladdr ${HW} REACHABLE`)}${line(`eth1 lladdr ${HW} STALE`)}`, line(`eth1;id lladdr ${HW} REACHABLE`), line(`${'e'.repeat(16)} lladdr ${HW} REACHABLE`),
      `? (${CAMERA_ADDRESS}) at ${HW} [ether] on eth1\n`, `{"dst":"${CAMERA_ADDRESS}","dev":"eth1","lladdr":"${HW}","state":["REACHABLE"]}\n`, `${CANARY}\n`, `Error: ${CANARY}\n${line(`eth1 lladdr ${HW} REACHABLE`)}`,
      // too long, too many lines
      `${line(`eth1 lladdr ${HW} REACHABLE`)}${' '.repeat(NEIGHBOUR_OUTPUT_MAX_CHARS)}`, line('eth0 FAILED').repeat(9),
    ];
    for (const text of unknown) expect(read(text), String(text).slice(0, 60)).toEqual({ kind: 'UNKNOWN' });
    // The stored interface itself must be a name: with another text nothing is read.
    for (const port of ['', 'eth1 ', '-I', 'eth1;id', 'e'.repeat(16)]) expect(read(line(`eth1 lladdr ${HW} REACHABLE`), CAMERA_ADDRESS, port), port).toEqual({ kind: 'UNKNOWN' });
  });

  it('PRESENT: the stand-in is started with exactly the five arguments of the row and none of the server\'s environment; its one line becomes six upper-case pairs - for the job and for the scan', async () => {
    const program = prints(line(`eth1 lladdr ${HW} REACHABLE`));
    const inputs = inputsOf({ neighbourProgram: program });
    process.env['DEMS_ROW111B_MARK'] = 'must-not-travel';
    try {
      expect(await inputs.job.neighbour(CAMERA_ADDRESS, live())).toBe(MAC);
    } finally {
      delete process.env['DEMS_ROW111B_MARK'];
    }
    expect(startedWith(program)).toBe('5\n-4\nneigh\nshow\nto\n192.168.50.21\n');
    const environment = readFileSync(`${program}.env`, 'utf8');
    expect(environment).not.toContain('DEMS_ROW111B_MARK');
    expect(environment).not.toMatch(/^(?:HOME|USER|PATH=.*node|NODE_|DEMS_)/m);
    expect(await inputs.scan.mac(CAMERA_ADDRESS, live())).toBe(MAC);
    expect(startedWith(program)).toBe('5\n-4\nneigh\nshow\nto\n192.168.50.21\n'.repeat(2));
    // A factory address is asked only while an alias address of its /24 is on the camera port (the rule's answer on the facts of NOW).
    const factory = prints(line(`eth1 lladdr ${HW} STALE`, FACTORY));
    expect(await inputsOf({ neighbourProgram: factory, network: () => WITH_ALIAS }).job.neighbour(FACTORY, live())).toBe(MAC);
    expect(startedWith(factory)).toBe('5\n-4\nneigh\nshow\nto\n192.168.1.64\n');
  });

  it('ABSENT: no entry, an entry that says "no answer", an entry of another interface - null, never a guess', async () => {
    for (const text of ['', line('eth1 FAILED'), line('eth1 INCOMPLETE'), line(`eth0 lladdr ${HW} REACHABLE`)]) {
      const inputs = inputsOf({ neighbourProgram: prints(text) });
      expect(await inputs.job.neighbour(CAMERA_ADDRESS, live()), text).toBeNull();
      expect(await inputs.scan.mac(CAMERA_ADDRESS, live()), text).toBeNull();
    }
  });

  it('UNKNOWN is thrown, by a reason of the closed set: malformed, a device\'s words, oversized, another exit code, a program that is not there, the door\'s own refusal, a HUNG program (killed at its bound), a stopped question', async () => {
    const neighbour = (program: string, overrides: Partial<CommissioningHostParts> = {}, signal: AbortSignal = live()): Promise<unknown> => whyOf(inputsOf({ neighbourProgram: program, ...overrides }).job.neighbour(CAMERA_ADDRESS, signal));
    expect(await neighbour(prints(`${CANARY}\n`))).toBe(CommissioningInputFailure.OUTPUT_MALFORMED);
    expect(await neighbour(prints(line(`eth1 lladdr ${HW} REACHABLE ${CANARY}`)))).toBe(CommissioningInputFailure.OUTPUT_MALFORMED);
    expect(await neighbour(prints(line(`eth1 lladdr ${HW} PERMANENT`)))).toBe(CommissioningInputFailure.OUTPUT_MALFORMED);
    expect(await neighbour(prints(line(`eth1 lladdr ${HW} REACHABLE`, '192.168.50.22')))).toBe(CommissioningInputFailure.OUTPUT_MALFORMED);
    // Oversized: more than the reader takes, and as much as the door keeps.
    expect(await neighbour(prints(line('eth0 FAILED').repeat(60)))).toBe(CommissioningInputFailure.OUTPUT_TOO_LONG);
    expect(await neighbour(standIn(`/usr/bin/yes "${CAMERA_ADDRESS} dev eth1 lladdr ${HW} REACHABLE" | /usr/bin/head -c 70000`))).toBe(CommissioningInputFailure.OUTPUT_TOO_LONG);
    // A line printed by a program that then fails is no answer.
    expect(await neighbour(standIn(`printf '%s dev eth1 lladdr %s REACHABLE\\n' ${CAMERA_ADDRESS} ${HW}\nexit 2`))).toBe(CommissioningInputFailure.ENDED_UNEXPECTEDLY);
    expect(await neighbour(standIn('kill -TERM $$'))).toBe(CommissioningInputFailure.ENDED_UNEXPECTEDLY);
    expect(await neighbour('/nonexistent/dems/ip')).toBe(CommissioningInputFailure.NOT_STARTED);
    expect(await neighbour('ip')).toBe(CommissioningInputFailure.NOT_STARTED);
    expect(await neighbour(prints(line(`eth1 lladdr ${HW} REACHABLE`)), { door: (options) => productionCameraDoors(timers).door({ ...options, coreFileLimit: () => 1024 }) })).toBe(CommissioningInputFailure.NOT_STARTED);
    // HUNG: killed at the bound; the caller is not held.
    const before = Date.now();
    expect(await neighbour(standIn('exec /bin/sleep 30'), { neighbourBoundMs: 300 })).toBe(CommissioningInputFailure.TIMED_OUT);
    expect(Date.now() - before).toBeLessThan(5_000);
    // STOPPED: the caller's signal fires while the program runs - and before it starts, when nothing is started at all.
    const stopping = new AbortController();
    const cancel = timers.after(200, () => stopping.abort());
    const again = Date.now();
    expect(await neighbour(standIn('exec /bin/sleep 30'), {}, stopping.signal)).toBe(CommissioningInputFailure.STOPPED);
    cancel();
    expect(Date.now() - again).toBeLessThan(5_000);
    expect(await neighbour('/nonexistent/dems/ip', { door: never }, AbortSignal.abort())).toBe(CommissioningInputFailure.STOPPED);
    // No refusal carries an address, a path, an argument or a line of output.
    const error = await refusalOf(inputsOf({ neighbourProgram: prints(`${CANARY} ${CAMERA_ADDRESS}\n`) }).job.neighbour(CAMERA_ADDRESS, live()));
    expect(JSON.stringify({ ...(error as object), message: (error as Error).message, stack: String((error as Error).stack).split('\n')[0] })).not.toMatch(/cnry|192\.168|dems-row111b|neigh|lladdr/);
  });

  /** What the echo program states: the statistics line of the address it was given (`$7`) and its summary. */
  const statistics = (received: 0 | 1, address = '$7'): string => `printf '%s\\n' "PING ${address} (${address}) 56(84) bytes of data." "" "--- ${address} ping statistics ---" "1 packets transmitted, ${String(received)} received, ${received === 1 ? '0' : '100'}% packet loss, time 0ms"`;
  const echoYes = (): string => standIn(`${statistics(1)}\nexit 0`);
  const echoNo = (): string => standIn(`${statistics(0)}\nexit 1`);

  it('THE READER of the echo row: the statistics line of exactly this address and ONE summary of the one form - one request sent, one or none back, the loss agreeing; anything else is not known', () => {
    const text = (summary: string, address = CAMERA_ADDRESS): string => `PING ${address} (${address}) 56(84) bytes of data.\n\n--- ${address} ping statistics ---\n${summary}\n`;
    expect(echoReadingOf(text('1 packets transmitted, 1 received, 0% packet loss, time 0ms'), CAMERA_ADDRESS)).toBe(true);
    expect(echoReadingOf(`${text('1 packets transmitted, 1 received, 0% packet loss, time 0ms')}rtt min/avg/max/mdev = 0.4/0.4/0.4/0.0 ms\n`, CAMERA_ADDRESS)).toBe(true);
    expect(echoReadingOf(text('1 packets transmitted, 0 received, 100% packet loss, time 0ms'), CAMERA_ADDRESS)).toBe(false);
    expect(echoReadingOf(text('1 packets transmitted, 0 received, +1 errors, 100% packet loss, time 0ms'), CAMERA_ADDRESS)).toBe(false);
    const unknown: readonly unknown[] = [
      null, 7, '', '\n', `${CANARY}\n`,
      // no statistics line; the statistics of another address; two of them
      '1 packets transmitted, 1 received, 0% packet loss, time 0ms\n', text('1 packets transmitted, 1 received, 0% packet loss, time 0ms', '192.168.50.22'),
      `${text('1 packets transmitted, 0 received, 100% packet loss, time 0ms')}--- 192.168.50.22 ping statistics ---\n`,
      // no summary; two; another count; counts that contradict; words after it; a duplicate answer
      text(''), text('1 packets transmitted, 0 received, 100% packet loss, time 0ms\n1 packets transmitted, 1 received, 0% packet loss, time 0ms'), text('2 packets transmitted, 2 received, 0% packet loss, time 1ms'),
      text('0 packets transmitted, 0 received'), text('1 packets transmitted, 1 received, 100% packet loss, time 0ms'), text('1 packets transmitted, 0 received, 0% packet loss, time 0ms'),
      text(`1 packets transmitted, 1 received, 0% packet loss, time 0ms ${CANARY}`), text('1 packets transmitted, 1 received, +1 duplicates, 0% packet loss, time 0ms'), text('1 packets transmitted, 2 received, 0% packet loss, time 0ms'),
      // too long, too many lines
      `${text('1 packets transmitted, 0 received, 100% packet loss, time 0ms')}${'x'.repeat(1_100)}`, `${text('1 packets transmitted, 0 received, 100% packet loss, time 0ms')}${'From 192.168.50.1 icmp_seq=1 Destination Host Unreachable\n'.repeat(8)}`,
    ];
    for (const value of unknown) expect(echoReadingOf(value, CAMERA_ADDRESS), String(value).slice(0, 70)).toBeNull();
  });

  it('DOES IT ANSWER: a STATED echo is "yes" and the table is not asked; a stated "none back" asks the table - LEARNT is "yes", SILENT (asked on the camera interface, no answer) is the ONLY "no"; an exit code without its statement, a statement against its exit code, no entry at all and every other end is thrown - never "free"', async () => {
    const learntProgram = (): string => prints(line(`eth1 lladdr ${HW} REACHABLE`));
    const answers = (overrides: Partial<CommissioningHostParts>): Promise<boolean> => inputsOf(overrides).job.answers(CAMERA_ADDRESS, live());
    // An echo came back, and the program says so.
    const yes = echoYes();
    const untouched = learntProgram();
    expect(await answers({ echoProgram: yes, neighbourProgram: untouched })).toBe(true);
    expect(startedWith(yes)).toBe('7\n-n\n-q\n-c\n1\n-W\n1\n192.168.50.21\n');
    expect(readFileSync(`${yes}.env`, 'utf8')).not.toMatch(/^(?:HOME|USER|PATH=.*node|NODE_|DEMS_)/m);
    expect(startedWith(untouched)).toBeNull();
    // No echo, but the host learnt a hardware address: something is there.
    const silentButThere = learntProgram();
    expect(await answers({ echoProgram: echoNo(), neighbourProgram: silentButThere })).toBe(true);
    expect(startedWith(silentButThere)).toBe('5\n-4\nneigh\nshow\nto\n192.168.50.21\n');
    // FREE: no echo AND the host's own entry that it asked there and nobody answered.
    for (const text of [line('eth1 FAILED'), line('eth1 INCOMPLETE')]) expect(await answers({ echoProgram: echoNo(), neighbourProgram: prints(text) }), text).toBe(false);

    // ── NOT KNOWN, each thrown; the caller refuses the address.
    // AN EXIT CODE OF 0 IS NO PROOF (the container finding): 0 with nothing stated, 0 with words that are no statement, 0 while it states "none back".
    const never111 = learntProgram();
    expect(await whyOf(answers({ echoProgram: standIn('exit 0'), neighbourProgram: never111 }))).toBe(CommissioningInputFailure.OUTPUT_MALFORMED);
    expect(await whyOf(answers({ echoProgram: standIn(`printf '%s\\n' '${CANARY}'\nexit 0`), neighbourProgram: never111 }))).toBe(CommissioningInputFailure.OUTPUT_MALFORMED);
    expect(await whyOf(answers({ echoProgram: standIn(`${statistics(0)}\nexit 0`), neighbourProgram: never111 }))).toBe(CommissioningInputFailure.OUTPUT_MALFORMED);
    // The same for "none back": 1 with nothing stated, 1 while it states an echo, the statistics of another address.
    expect(await whyOf(answers({ echoProgram: standIn('exit 1'), neighbourProgram: prints(line('eth1 FAILED')) }))).toBe(CommissioningInputFailure.OUTPUT_MALFORMED);
    expect(await whyOf(answers({ echoProgram: standIn(`${statistics(1)}\nexit 1`), neighbourProgram: prints(line('eth1 FAILED')) }))).toBe(CommissioningInputFailure.OUTPUT_MALFORMED);
    expect(await whyOf(answers({ echoProgram: standIn(`${statistics(0, '192.168.50.22')}\nexit 1`), neighbourProgram: prints(line('eth1 FAILED')) }))).toBe(CommissioningInputFailure.OUTPUT_MALFORMED);
    expect(startedWith(never111)).toBeNull();
    // NO ENTRY AT ALL after "none back": the host never asked on the camera interface (a port that cannot ask, another route). Not "free".
    for (const text of ['', line('eth0 FAILED'), line(`eth0 lladdr ${HW} REACHABLE`)]) expect(await whyOf(answers({ echoProgram: echoNo(), neighbourProgram: prints(text) })), text).toBe(CommissioningInputFailure.NOT_OBSERVED);
    // The echo program failed, is not there, hung; or the table could not be read after it.
    expect(await whyOf(answers({ echoProgram: standIn(`${statistics(0)}\nexit 2`), neighbourProgram: never111 }))).toBe(CommissioningInputFailure.ENDED_UNEXPECTEDLY);
    expect(await whyOf(answers({ echoProgram: '/nonexistent/dems/ping', neighbourProgram: never111 }))).toBe(CommissioningInputFailure.NOT_STARTED);
    const before = Date.now();
    expect(await whyOf(answers({ echoProgram: standIn('exec /bin/sleep 30'), echoBoundMs: 300, neighbourProgram: never111 }))).toBe(CommissioningInputFailure.TIMED_OUT);
    expect(Date.now() - before).toBeLessThan(5_000);
    expect(startedWith(never111)).toBeNull();
    expect(await whyOf(answers({ echoProgram: echoNo(), neighbourProgram: prints(`${CANARY}\n`) }))).toBe(CommissioningInputFailure.OUTPUT_MALFORMED);
    expect(await whyOf(answers({ echoProgram: echoNo(), neighbourProgram: standIn('exit 1') }))).toBe(CommissioningInputFailure.ENDED_UNEXPECTEDLY);
  });

  it('BEFORE ANY PROGRAM: an address the destination rule refuses on the facts of the host, facts that cannot be read, and a camera interface that is not known start NOTHING', async () => {
    const all = (inputs: CommissioningHostInputs, address: string): Promise<unknown>[] => [inputs.job.neighbour(address, live()), inputs.job.answers(address, live()), inputs.scan.mac(address, live())];
    // The rule: public, loopback, the office network, the Core's own address, the edges of the subnet, a name, a factory address with no alias address on the port.
    for (const address of ['8.8.8.8', '127.0.0.1', '10.20.0.9', '192.168.50.1', '192.168.50.0', '192.168.50.255', 'camera.local', FACTORY, '192.168.50.21/24', '-I']) {
      for (const asked of all(inputsOf({ door: never }), address)) expect(await whyOf(asked), address).toBe(CommissioningInputFailure.ADDRESS_REFUSED);
    }
    // The alias address itself is the host's: refused although its /24 is reachable.
    for (const asked of all(inputsOf({ door: never, network: () => WITH_ALIAS }), '192.168.1.253')) expect(await whyOf(asked)).toBe(CommissioningInputFailure.ADDRESS_REFUSED);
    // Facts that are not there, are null, or throw: the facts of a host of which nothing is known.
    const unreadable: readonly (CommissioningHostParts['network'])[] = [undefined, () => null, () => { throw new Error(CANARY); }];
    for (const network of unreadable) for (const asked of all(inputsOf({ door: never, network }), CAMERA_ADDRESS)) expect(await whyOf(asked)).toBe(CommissioningInputFailure.ADDRESS_REFUSED);
    // The camera interface: not chosen, not a name, a reader that throws.
    const ports: readonly (() => string | null)[] = [() => null, () => '', () => 'eth1;id', () => '-I', () => 'e'.repeat(16), () => { throw new Error(CANARY); }];
    for (const cameraInterface of ports) for (const asked of all(inputsOf({ door: never, cameraInterface }), CAMERA_ADDRESS)) expect(await whyOf(asked)).toBe(CommissioningInputFailure.INTERFACE_UNKNOWN);
  });

  it('THE PLATFORM SEAM: off linux nothing is made and no program is ever started; on linux the door is asked with the table\'s programs and rows, an empty environment and no start message', async () => {
    for (const platform of ['darwin', 'win32', 'freebsd', '']) expect(hostCommissioningInputsOf({ platform, timers, network: () => HOST, cameraInterface: () => PORT, door: never }), platform).toBeNull();
    const asked: { command: string; args: readonly string[]; env: unknown; message: unknown }[] = [];
    const answers: { exitCode: number; output: string }[] = [];
    const recording: ProductionDoor = (options) => {
      asked.push({ command: options.command, args: options.args, env: options.env, message: options.message });
      const next = answers.shift() ?? { exitCode: 0, output: '' };
      return { pid: null, started: Promise.resolve(), ended: Promise.resolve({ ...next, signal: null, spawnFailed: false, diagnostics: '' }), alive: () => false, endInput: () => {}, kill: () => {} };
    };
    // The product's defaults: no program and no bound is handed in.
    const inputs = hostCommissioningInputsOf({ platform: 'linux', timers, network: () => HOST, cameraInterface: () => PORT, door: recording });
    answers.push({ exitCode: 0, output: line(`eth1 lladdr ${HW} REACHABLE`) }, { exitCode: 1, output: `--- ${CAMERA_ADDRESS} ping statistics ---\n1 packets transmitted, 0 received, 100% packet loss, time 0ms\n` }, { exitCode: 0, output: line('eth1 FAILED') });
    expect(await inputs?.job.neighbour(CAMERA_ADDRESS, live())).toBe(MAC);
    expect(await inputs?.job.answers(CAMERA_ADDRESS, live())).toBe(false);
    const neighbourRow = { command: '/usr/sbin/ip', args: ['-4', 'neigh', 'show', 'to', '192.168.50.21'], env: {}, message: null };
    expect(asked).toEqual([neighbourRow, { command: '/usr/bin/ping', args: ['-n', '-q', '-c', '1', '-W', '1', '192.168.50.21'], env: {}, message: null }, neighbourRow]);
  });
});
