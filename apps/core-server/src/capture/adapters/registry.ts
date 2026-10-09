/**
 * The capture device registry (blueprint row 65 / M4-W1; register NM-01; capture spec §A.1 and
 * §A.1.1 rules RG-1 to RG-5; D86 C-5).
 *
 * It resolves a registered device to its adapter and holds the rules that are refusals, never
 * fall-backs: which kinds an operation registers (RG-1), what a list may show (RG-2), what may be
 * assigned (RG-3), that a candidate is no device (RG-4), and which kinds can be recorded at all
 * (D86 C-5). It is built once, for one capture operation; it reads no flag and no configuration
 * (static rule G-R15: the operation is row 61's one function's result, passed in).
 *
 * It keeps no state but the adapters it was given. The lock of the configuration while a session
 * is open (OD-10) is asked of the caller's `locked` function at every call, so the registry cannot
 * disagree with the session machine.
 */
import { CaptureAdapterError, CaptureAdapterRefusal } from './errors';
import { CaptureAdapterKind, CaptureSourceClass, registrableKindsOf, sourceClassOf, sourceClassOfOperation, type CaptureDeviceClass, type CaptureOperation } from './kinds';
import type { CameraAdapter, CaptureAdapter, CaptureAdapterOf, CaptureDeviceDescriptor, CaptureDeviceEntry, CaptureDeviceRegistry } from './types';

/** The device class each seam serves. */
const CLASS_OF_SEAM = Object.freeze({ CAMERA: 'CAMERA', AUDIO: 'MIC', POE: 'POE' } as const satisfies Record<CaptureAdapter['seam'], CaptureDeviceClass>);

/** The adapter kinds that can stand behind each seam (C3 §2.6 "How the kinds map"). */
const KINDS_OF_SEAM: Readonly<Record<CaptureAdapter['seam'], readonly CaptureAdapterKind[]>> = Object.freeze({
  CAMERA: [CaptureAdapterKind.ONVIF_RTSP, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE],
  AUDIO: [CaptureAdapterKind.USB_AUDIO, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE],
  POE: [CaptureAdapterKind.SNMP_POE, CaptureAdapterKind.FAKE],
});

/**
 * The kinds an opener can exist for IN THIS PHASE (D86 C-5; D82): the development kinds. A
 * production camera's recording path and a production microphone's transport are class C (C-2,
 * C-4); an adapter of those kinds that claims an opener is refused at registration, so that "no
 * listener for a source kind without an opener" cannot be talked around by one boolean.
 * Adding a kind here is the decision that lands the class-C path.
 */
export const OPENER_CAPABLE_KINDS: readonly CaptureAdapterKind[] = Object.freeze([CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE]);

const hasOpenerOf = (adapter: CaptureAdapter): boolean => adapter.seam !== 'POE' && adapter.hasOpener;

export interface CaptureDeviceRegistryOptions {
  readonly operation: CaptureOperation;
  /** True while a session is open: the configuration is locked (OD-10). Asked at every call. */
  readonly locked?: () => boolean;
}

export function createCaptureDeviceRegistry(options: CaptureDeviceRegistryOptions): CaptureDeviceRegistry {
  const { operation } = options;
  const locked = options.locked ?? ((): boolean => false);
  const allowed = registrableKindsOf(operation);
  const adapters: CaptureAdapter[] = [];
  const byDevice = new Map<string, { readonly adapter: CaptureAdapter; readonly entry: CaptureDeviceEntry }>();

  const describeEntry = (adapter: CaptureAdapter, entry: CaptureDeviceEntry): CaptureDeviceDescriptor =>
    Object.freeze({
      id: entry.id,
      deviceClass: entry.deviceClass,
      label: entry.label,
      capabilities: Object.freeze([...entry.capabilities]),
      profiles: Object.freeze([...entry.profiles]),
      adapterKind: adapter.kind,
      sourceClass: sourceClassOf(adapter.kind),
      hasOpener: hasOpenerOf(adapter),
    });

  const held = (deviceId: string): { readonly adapter: CaptureAdapter; readonly entry: CaptureDeviceEntry } => {
    const found = byDevice.get(deviceId);
    if (found === undefined) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN, null);
    return found;
  };

  const describe = (deviceId: string): CaptureDeviceDescriptor => {
    const { adapter, entry } = held(deviceId);
    return describeEntry(adapter, entry);
  };

  return {
    operation,

    register(adapter) {
      if (!allowed.includes(adapter.kind)) throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_KIND_NOT_ALLOWED);
      if (!KINDS_OF_SEAM[adapter.seam].includes(adapter.kind)) throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_INVALID);
      if (hasOpenerOf(adapter) && !OPENER_CAPABLE_KINDS.includes(adapter.kind)) throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_INVALID);
      const ids = new Set<string>();
      for (const entry of adapter.devices) {
        if (entry.deviceClass !== CLASS_OF_SEAM[adapter.seam]) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_CLASS_MISMATCH, entry.id);
        if (byDevice.has(entry.id) || ids.has(entry.id)) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_DUPLICATE, entry.id);
        ids.add(entry.id);
      }
      if (adapters.includes(adapter)) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_DUPLICATE);
      // Nothing is registered before every check passed: a refused adapter leaves no half of itself.
      adapters.push(adapter);
      for (const entry of adapter.devices) byDevice.set(entry.id, { adapter, entry });
    },

    list() {
      const development = operation === 'REAL_DEVELOPMENT';
      return [...byDevice.values()]
        .map(({ adapter, entry }) => describeEntry(adapter, entry))
        // RG-2, held here as well as by RG-1: a development source is never listed outside its operation.
        .filter((descriptor) => development || descriptor.sourceClass !== CaptureSourceClass.DEVELOPMENT)
        .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
    },

    describe,

    resolve<Class extends CaptureDeviceClass>(deviceClass: Class, deviceId: string): CaptureAdapterOf<Class> {
      if (locked()) throw new CaptureAdapterError(CaptureAdapterRefusal.REGISTRY_LOCKED);
      const { adapter, entry } = held(deviceId);
      if (entry.deviceClass !== deviceClass) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_CLASS_MISMATCH, entry.id);
      // The entry's class is the seam's class (checked at registration), so the adapter is the seam's.
      return adapter as CaptureAdapterOf<Class>;
    },

    cameraAdapters() {
      return adapters.filter((adapter): adapter is CameraAdapter => adapter.seam === 'CAMERA');
    },

    openerKinds() {
      return [...new Set(adapters.filter(hasOpenerOf).map((adapter) => adapter.kind))].sort();
    },

    assertRecordable(deviceId) {
      const descriptor = describe(deviceId);
      if (!descriptor.hasOpener) throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE, descriptor.id);
      return descriptor;
    },

    assertAssignable(deviceClass, deviceId) {
      if (locked()) throw new CaptureAdapterError(CaptureAdapterRefusal.REGISTRY_LOCKED);
      const descriptor = describe(deviceId);
      if (descriptor.deviceClass !== deviceClass) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_CLASS_MISMATCH, descriptor.id);
      if (descriptor.sourceClass !== sourceClassOfOperation(operation)) throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, descriptor.id);
      return descriptor;
    },
  };
}
