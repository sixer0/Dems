// The registry's rules (blueprint row 65; capture spec §A.1 failure modes, §A.1.1 RG-1 to RG-5;
// D86 C-5). The selector half of check M4-SEL-W that lives in this layer is here: which device an
// assignment may name (any registered device of the right class and of the operation's source
// class, an adopted `CAM-NN` included; a candidate ID never). The audit row and the republished
// slice of M4-SEL-W belong to the selector operations (row 66) and to the browser run of the gate.
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_ADAPTER_KINDS,
  CaptureAdapterError,
  CaptureAdapterKind,
  CaptureOperation,
  CaptureSourceClass,
  OPENER_CAPABLE_KINDS,
  createCaptureDeviceRegistry,
  createFakeAudioInputAdapter,
  createFakeCameraAdapter,
  createFakePoeController,
  createFakeRegistry,
  registrableKindsOf,
  sourceClassOf,
  sourceClassOfOperation,
  type AudioInputAdapter,
  type CameraAdapter,
  type CaptureAdapter,
} from '../index';

const RUN_DIR = '/nonexistent/dems-run/capture';
const codeOf = (work: () => unknown): string => {
  try {
    work();
    return 'no refusal';
  } catch (error) {
    return error instanceof CaptureAdapterError ? error.code : `not an adapter error: ${String(error)}`;
  }
};
/** A production camera adapter for the rules: the fake's behaviour under the production kind, without an opener. */
const productionCamera = (id: string, over: Partial<CameraAdapter> = {}): CameraAdapter => ({ ...createFakeCameraAdapter({ id }), kind: CaptureAdapterKind.ONVIF_RTSP, hasOpener: false, ...over });
const productionMic = (id: string): AudioInputAdapter => ({ ...createFakeAudioInputAdapter({ id, runDir: RUN_DIR }), kind: CaptureAdapterKind.USB_AUDIO, hasOpener: false });

describe('adapter kind and source class', () => {
  it('five kinds; the class of each comes from the one function', () => {
    expect(CAPTURE_ADAPTER_KINDS).toEqual(['ONVIF_RTSP', 'USB_AUDIO', 'SNMP_POE', 'FAKE', 'LOCAL_DEVICE']);
    expect(CAPTURE_ADAPTER_KINDS.map(sourceClassOf)).toEqual(['PRODUCTION', 'PRODUCTION', 'PRODUCTION', 'DEVELOPMENT', 'DEVELOPMENT']);
    expect([CaptureOperation.SIMULATED, CaptureOperation.REAL_PRODUCTION, CaptureOperation.REAL_DEVELOPMENT].map(sourceClassOfOperation)).toEqual([null, 'PRODUCTION', 'DEVELOPMENT']);
  });

  it('RG-1: what each operation registers', () => {
    expect(registrableKindsOf('SIMULATED')).toEqual([]);
    expect(registrableKindsOf('REAL_PRODUCTION')).toEqual(['ONVIF_RTSP', 'USB_AUDIO', 'SNMP_POE']);
    expect(registrableKindsOf('REAL_DEVELOPMENT')).toEqual(['FAKE', 'LOCAL_DEVICE', 'ONVIF_RTSP']);
  });
});

describe('registration (RG-1, duplicates, D86 C-5)', () => {
  it('SIMULATED registers no adapter; REAL_PRODUCTION no development kind; REAL_DEVELOPMENT no production microphone or switch', () => {
    const fake = (): CaptureAdapter => createFakeCameraAdapter({ id: 'CAM-01' });
    expect(codeOf(() => createCaptureDeviceRegistry({ operation: 'SIMULATED' }).register(fake()))).toBe('CAPTURE_ADAPTER_KIND_NOT_ALLOWED');
    expect(codeOf(() => createCaptureDeviceRegistry({ operation: 'SIMULATED' }).register(productionCamera('CAM-03')))).toBe('CAPTURE_ADAPTER_KIND_NOT_ALLOWED');
    expect(codeOf(() => createCaptureDeviceRegistry({ operation: 'REAL_PRODUCTION' }).register(fake()))).toBe('CAPTURE_ADAPTER_KIND_NOT_ALLOWED');
    expect(codeOf(() => createCaptureDeviceRegistry({ operation: 'REAL_DEVELOPMENT' }).register(productionMic('MIC-03')))).toBe('CAPTURE_ADAPTER_KIND_NOT_ALLOWED');
    expect(codeOf(() => createFakeRegistry({ runDir: RUN_DIR, operation: 'SIMULATED' }))).toBe('CAPTURE_ADAPTER_KIND_NOT_ALLOWED');
    // Control: the same adapters are taken where the rule allows them.
    expect(codeOf(() => createCaptureDeviceRegistry({ operation: 'REAL_DEVELOPMENT' }).register(fake()))).toBe('no refusal');
    expect(codeOf(() => createCaptureDeviceRegistry({ operation: 'REAL_PRODUCTION' }).register(productionMic('MIC-03')))).toBe('no refusal');
    expect(codeOf(() => createCaptureDeviceRegistry({ operation: 'REAL_DEVELOPMENT' }).register(productionCamera('CAM-03')))).toBe('no refusal');
  });

  it('a duplicate device ID is refused and leaves the registry as it was', () => {
    const registry = createCaptureDeviceRegistry({ operation: 'REAL_DEVELOPMENT' });
    const first = createFakeCameraAdapter({ id: 'CAM-01' });
    registry.register(first);
    expect(codeOf(() => registry.register(createFakeCameraAdapter({ id: 'CAM-01' })))).toBe('CAPTURE_DEVICE_DUPLICATE');
    expect(codeOf(() => registry.register(first))).toBe('CAPTURE_DEVICE_DUPLICATE');
    expect(registry.list().map((device) => device.id)).toEqual(['CAM-01']);
    expect(registry.resolve('CAMERA', 'CAM-01')).toBe(first);
    expect(registry.cameraAdapters()).toEqual([first]);
  });

  it('a kind that cannot stand behind the seam, and a device of another class than the seam, are refused', () => {
    const registry = createCaptureDeviceRegistry({ operation: 'REAL_PRODUCTION' });
    expect(codeOf(() => registry.register({ ...createFakeCameraAdapter({ id: 'CAM-03' }), kind: CaptureAdapterKind.SNMP_POE, hasOpener: false }))).toBe('CAPTURE_ADAPTER_INVALID');
    expect(codeOf(() => registry.register({ ...createFakePoeController({ id: 'POE-SWITCH', ports: [] }), kind: CaptureAdapterKind.USB_AUDIO }))).toBe('CAPTURE_ADAPTER_INVALID');
    const wrongClass = productionCamera('CAM-03');
    expect(codeOf(() => registry.register({ ...wrongClass, devices: [{ ...wrongClass.devices[0]!, id: 'MIC-09', deviceClass: 'MIC' }] }))).toBe('CAPTURE_DEVICE_CLASS_MISMATCH');
    expect(registry.list()).toEqual([]);
  });

  // Task 4 row 88 (THE LIFT, decision AM-1; specification 6.3 pins "Test: the list", "every listed kind is DEVELOPMENT",
  // "production cannot state an opener"): the list holds the four kinds; the listed production kinds are exactly the two
  // source kinds; a production adapter WITH an opener registers in REAL_PRODUCTION and one without stays unrecordable.
  it('D86 C-5 as amended by AM-1: the two production source kinds may state an opener, SNMP_POE may not, and an opener of another class than the operation\'s is refused', () => {
    expect(OPENER_CAPABLE_KINDS).toEqual(['FAKE', 'LOCAL_DEVICE', 'ONVIF_RTSP', 'USB_AUDIO']);
    expect(OPENER_CAPABLE_KINDS.filter((kind) => sourceClassOf(kind) === CaptureSourceClass.PRODUCTION)).toEqual(['ONVIF_RTSP', 'USB_AUDIO']);
    expect(OPENER_CAPABLE_KINDS).not.toContain('SNMP_POE');
    const production = createCaptureDeviceRegistry({ operation: 'REAL_PRODUCTION' });
    production.register(productionCamera('CAM-03', { hasOpener: true }));
    production.register(productionMic('MIC-03'));
    expect(production.openerKinds()).toEqual(['ONVIF_RTSP']);
    expect(production.list().map((device) => [device.id, device.hasOpener])).toEqual([['CAM-03', true], ['MIC-03', false]]);
    expect(production.assertRecordable('CAM-03').id).toBe('CAM-03');
    // One that states no opener stays unrecordable: the adapter's word decides, not its kind.
    expect(codeOf(() => production.assertRecordable('MIC-03'))).toBe('SOURCE_KIND_NOT_RECORDABLE');
    // REFUSAL 1: a switch of kind SNMP_POE that states an opener, in the operation of its own class.
    expect(codeOf(() => production.register({ ...createFakePoeController({ id: 'POE-09', ports: [] }), kind: CaptureAdapterKind.SNMP_POE, hasOpener: true } as unknown as CaptureAdapter))).toBe('CAPTURE_ADAPTER_INVALID');
    expect(codeOf(() => production.register({ ...createFakeCameraAdapter({ id: 'CAM-09' }), kind: CaptureAdapterKind.SNMP_POE, hasOpener: true }))).toBe('CAPTURE_ADAPTER_INVALID');
    // REFUSAL 2: an ONVIF_RTSP adapter WITH an opener in REAL_DEVELOPMENT (registrable there for its search half only); the same without one is taken.
    const development = createCaptureDeviceRegistry({ operation: 'REAL_DEVELOPMENT' });
    expect(codeOf(() => development.register(productionCamera('CAM-04', { hasOpener: true })))).toBe('CAPTURE_ADAPTER_INVALID');
    expect(codeOf(() => development.register(productionCamera('CAM-04')))).toBe('no refusal');
    // A refused adapter leaves nothing behind.
    expect(development.list().map((device) => device.id)).toEqual(['CAM-04']);
    expect(production.list().map((device) => device.id)).toEqual(['CAM-03', 'MIC-03']);
    // Control: the development fakes have an opener and are recordable; the switch is never a source.
    const { registry } = createFakeRegistry({ runDir: RUN_DIR });
    expect(registry.openerKinds()).toEqual(['FAKE']);
    expect(registry.assertRecordable('CAM-01').id).toBe('CAM-01');
    expect(registry.assertRecordable('MIC-02').id).toBe('MIC-02');
    expect(codeOf(() => registry.assertRecordable('POE-SWITCH'))).toBe('SOURCE_KIND_NOT_RECORDABLE');
    // A fake adapter that states no opener is not recordable either: the adapter's word decides, not its kind.
    const mute = createCaptureDeviceRegistry({ operation: 'REAL_DEVELOPMENT' });
    mute.register({ ...createFakeCameraAdapter({ id: 'CAM-01' }), hasOpener: false });
    expect(mute.openerKinds()).toEqual([]);
    expect(codeOf(() => mute.assertRecordable('CAM-01'))).toBe('SOURCE_KIND_NOT_RECORDABLE');
  });

  // Task 4 row N10 (caution C-1 of verification/088b): the opener flag is read as EXACTLY `true` at registration AND at the
  // recordability check. An adapter whose flag is truthy but not `true` skips both registration rules (it states no opener), so
  // it must not be recordable either - here an ONVIF_RTSP adapter in REAL_DEVELOPMENT, where a real opener is refused.
  // Seen RED with `hasOpenerOf` reading the flag as truthy (the form before row N10): the descriptor states `1`, not false.
  it('C-1: a truthy opener flag that is not `true` states no opener anywhere - registered as without one, never recordable, no opener kind', () => {
    for (const flag of [1, 'yes', {}, ['x']]) {
      const development = createCaptureDeviceRegistry({ operation: 'REAL_DEVELOPMENT' });
      expect(codeOf(() => development.register(productionCamera('CAM-05', { hasOpener: flag as unknown as boolean }))), String(flag)).toBe('no refusal');
      expect(development.describe('CAM-05').hasOpener).toBe(false);
      expect(development.openerKinds()).toEqual([]);
      expect(codeOf(() => development.assertRecordable('CAM-05'))).toBe('SOURCE_KIND_NOT_RECORDABLE');
    }
    // Control: `true` itself is the opener the class rule refuses in this operation.
    expect(codeOf(() => createCaptureDeviceRegistry({ operation: 'REAL_DEVELOPMENT' }).register(productionCamera('CAM-05', { hasOpener: true })))).toBe('CAPTURE_ADAPTER_INVALID');
  });
});

describe('listing and resolving (RG-2, OD-10)', () => {
  it('RG-2: a development source is never listed outside REAL_DEVELOPMENT; the development operation lists the search half of the production camera kind too', () => {
    const development = createFakeRegistry({ runDir: RUN_DIR }).registry;
    development.register(productionCamera('CAM-03'));
    expect(development.list().map((device) => `${device.id} ${device.sourceClass}`)).toEqual(['CAM-01 DEVELOPMENT', 'CAM-02 DEVELOPMENT', 'CAM-03 PRODUCTION', 'MIC-01 DEVELOPMENT', 'MIC-02 DEVELOPMENT', 'POE-SWITCH DEVELOPMENT']);
    const production = createCaptureDeviceRegistry({ operation: 'REAL_PRODUCTION' });
    production.register(productionCamera('CAM-03'));
    expect(production.list().filter((device) => device.sourceClass === 'DEVELOPMENT')).toEqual([]);
    expect(createCaptureDeviceRegistry({ operation: 'SIMULATED' }).list()).toEqual([]);
  });

  it('resolve: the adapter of the device; an unknown ID, another class, and an open session are refused', () => {
    let open = false;
    const { registry, cameras, mics, poe } = createFakeRegistry({ runDir: RUN_DIR, locked: () => open });
    expect(registry.resolve('CAMERA', 'CAM-02')).toBe(cameras[1]);
    expect(registry.resolve('MIC', 'MIC-01')).toBe(mics[0]);
    expect(registry.resolve('POE', 'POE-SWITCH')).toBe(poe);
    expect(codeOf(() => registry.resolve('CAMERA', 'CAM-09'))).toBe('CAPTURE_DEVICE_UNKNOWN');
    expect(codeOf(() => registry.resolve('MIC', 'CAM-01'))).toBe('CAPTURE_DEVICE_CLASS_MISMATCH');
    open = true;
    expect(codeOf(() => registry.resolve('CAMERA', 'CAM-02'))).toBe('CAPTURE_REGISTRY_LOCKED');
    expect(codeOf(() => registry.assertAssignable('CAMERA', 'CAM-02'))).toBe('CAPTURE_REGISTRY_LOCKED');
    // Reading stays possible while a session is open.
    expect(registry.list()).toHaveLength(5);
    expect(registry.describe('CAM-02').id).toBe('CAM-02');
    open = false;
    expect(registry.resolve('CAMERA', 'CAM-02')).toBe(cameras[1]);
  });
});

describe('M4-SEL-W, registry half: what an assignment may name (RG-3, RG-4)', () => {
  it('any registered device of the right class and of the operation\'s class is assignable, an adopted camera included', () => {
    const { registry } = createFakeRegistry({ runDir: RUN_DIR });
    // An adopted development camera: a third row, as operation 96 mints it.
    registry.register(createFakeCameraAdapter({ id: 'CAM-03' }));
    expect(['CAM-01', 'CAM-02', 'CAM-03'].map((id) => registry.assertAssignable('CAMERA', id).sourceClass)).toEqual(['DEVELOPMENT', 'DEVELOPMENT', 'DEVELOPMENT']);
    expect(['MIC-01', 'MIC-02'].map((id) => registry.assertAssignable('MIC', id).id)).toEqual(['MIC-01', 'MIC-02']);
    // Each line of the selector can carry the class: it is a member of what the registry answers.
    expect(registry.assertAssignable('CAMERA', 'CAM-03')).toMatchObject({ id: 'CAM-03', adapterKind: 'FAKE', sourceClass: 'DEVELOPMENT' });
  });

  it('refused: a candidate ID, an unknown ID, a device of another class, and a source class that is not the operation\'s (no mixed configuration)', () => {
    const { registry } = createFakeRegistry({ runDir: RUN_DIR });
    registry.register(productionCamera('CAM-04'));
    // RG-4: a candidate of a search is never a device, whatever a search returned.
    expect(codeOf(() => registry.assertAssignable('CAMERA', 'CND-0123456789AB'))).toBe('CAPTURE_DEVICE_UNKNOWN');
    expect(codeOf(() => registry.assertAssignable('CAMERA', 'CAM-09'))).toBe('CAPTURE_DEVICE_UNKNOWN');
    expect(codeOf(() => registry.assertAssignable('CAMERA', 'MIC-01'))).toBe('CAPTURE_DEVICE_CLASS_MISMATCH');
    expect(codeOf(() => registry.assertAssignable('MIC', 'CAM-01'))).toBe('CAPTURE_DEVICE_CLASS_MISMATCH');
    // RG-3: a production camera is never recorded beside a fake microphone.
    expect(codeOf(() => registry.assertAssignable('CAMERA', 'CAM-04'))).toBe('DEVELOPMENT_SOURCE_NOT_ALLOWED');
    const production = createCaptureDeviceRegistry({ operation: 'REAL_PRODUCTION' });
    production.register(productionCamera('CAM-04'));
    expect(production.assertAssignable('CAMERA', 'CAM-04').sourceClass).toBe('PRODUCTION');
  });

  it('a refusal carries a code and at most a registered device ID: never the text it was asked with', () => {
    const { registry } = createFakeRegistry({ runDir: RUN_DIR });
    const asked = 'CND-CANARY-7f3a91';
    try {
      registry.assertAssignable('CAMERA', asked);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CaptureAdapterError);
      expect(JSON.stringify({ ...(error as CaptureAdapterError), message: (error as Error).message, stack: (error as Error).stack })).not.toContain(asked);
      expect((error as CaptureAdapterError).deviceId).toBeNull();
    }
  });
});
