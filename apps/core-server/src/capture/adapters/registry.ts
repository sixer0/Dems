/**
 * The capture device registry (blueprint row 65 / M4-W1; register NM-01; capture spec §A.1 and
 * §A.1.1 rules RG-1 to RG-5; D86 C-5).
 *
 * It resolves a registered device to its adapter and holds the rules that are refusals, never
 * fall-backs: which kinds an operation registers (RG-1), what a list may show (RG-2), what may be
 * assigned (RG-3), that a candidate is no device (RG-4), and which kinds can be recorded at all
 * (D86 C-5, amended by AM-1: since task 4 row 88 the two production source kinds may state an
 * opener, and an adapter that states one is refused outside the operation of its source class).
 * It is built once, for one capture operation; it reads no flag and no configuration
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
 * The kinds an opener can exist for (D86 C-5 as amended by decision AM-1, task 4 row 88): the two
 * development kinds and, SINCE THE LIFT, the two production source kinds `ONVIF_RTSP` and
 * `USB_AUDIO` - lifted together, in one change set. An adapter of any other kind that states an
 * opener (`SNMP_POE`, or any later kind) is refused at registration, so that "no listener for a
 * source kind without an opener" cannot be talked around by one boolean. Being on this list is NOT
 * a statement that a source is fit to record (stage 2 of the lift, the user's ruling): it says
 * only which kinds MAY state an opener. Whether a host has one is the adapter's own word
 * (`hasOpener`): on `darwin` no production microphone adapter states one (AM-1 (3)(h), C135).
 */
export const OPENER_CAPABLE_KINDS: readonly CaptureAdapterKind[] = Object.freeze([CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE, CaptureAdapterKind.ONVIF_RTSP, CaptureAdapterKind.USB_AUDIO]);

// Row N10 (caution C-1 of review 088b): EXACTLY `true` here as at registration (`statesOpener`), never a truthy value.
const hasOpenerOf = (adapter: CaptureAdapter): boolean => adapter.seam !== 'POE' && adapter.hasOpener === true;
/** What an adapter STATES, whatever its seam: a switch that says it has an opener is held to the list as well (row 88). */
const statesOpener = (adapter: CaptureAdapter): boolean => (adapter as { readonly hasOpener?: unknown }).hasOpener === true;

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
      if (statesOpener(adapter) && !OPENER_CAPABLE_KINDS.includes(adapter.kind)) throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_INVALID);
      // Design addendum 1.4 #7 (AM-1 (3)(b)): an adapter that states an opener is refused unless its source class is the class
      // the operation records - an `ONVIF_RTSP` adapter WITH an opener is never registered in REAL_DEVELOPMENT, where that kind
      // is registrable for its search half only. The class checks of the plan builder and of the source rows stay behind it.
      if (statesOpener(adapter) && sourceClassOf(adapter.kind) !== sourceClassOfOperation(operation)) throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_INVALID);
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
