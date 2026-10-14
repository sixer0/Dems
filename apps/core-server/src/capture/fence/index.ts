/**
 * The capture fence (blueprint row 136, R-11; capture spec §A.1.1, §A.1.2, §A.6.4, §A.7.1; `dbc-4`
 * §N.2, §N.3, §N.9; SEC35-40, SEC35-41, SEC35-43; decisions D74, D82(e), D83, D86 C-5, D91, D108).
 *
 * WHAT IT OWNS.
 *   - `operation.ts`  THE one definition of the capture operation (`SIMULATED` | `REAL_PRODUCTION`
 *                     | `REAL_DEVELOPMENT`) and the only reader of the development flag;
 *   - `boot.ts`       the boot step `capture.fence`: the refusals of the allowed-combinations
 *                     table, the helper-program rule, the boot audit row;
 *   - `boot-key.ts`   which signing key the boot audit row states (task 4 row 209, SX-15): the two
 *                     public members read from the stored CERTIFICATE alone, and their forms. The
 *                     row is written BEFORE the boot checks judged the key: see that file's header;
 *   - `registration.ts`, `statements.ts`  this Mac's camera and microphone as NEW device rows of
 *                     kind `LOCAL_DEVICE`, in `REAL_DEVELOPMENT` only;
 *   - `generated-sources.ts`  the development test sources (kind `FAKE`) that feed the worker;
 *   - `fake-mic.ts`   what the first test microphone plays: its tone, or the speech fixture
 *                     (`DEMS_CAPTURE_DEV_FAKE_MIC`, `REAL_DEVELOPMENT` only; fix wave H, ruling D198);
 *   - `development-discovery.ts`  whether the lane launcher of the test support may hand a
 *                     development discovery source (the fake ONVIF device on loopback) to this
 *                     Core: `REAL_DEVELOPMENT` only (fix wave H, gate 70 finding B-1);
 *   - `sources.ts`    the four `session_capture_sources` rows of a session, the re-read check, and
 *                     what a client is told about a source (adapter, source class, label);
 *   - this file       the device registry of the running operation, and the mount.
 *
 * WHAT IT DOES NOT DO. It opens no camera and no microphone (the device LIST is read; listing
 * opens nothing and asks for no permission). It starts and stops no session and writes no
 * `session_capture_sources` row (row 71). It draws nothing (rows 137 / 138).
 *
 * MOUNTED BY THE CAPTURE UNIT (`../index.ts`), which hands in the log sinks: the capture folder
 * has one file that logs. `app.ts` is not touched (capture spec §I: the adapters are registered
 * inside the existing `capture` unit).
 */
import type { FastifyInstance } from 'fastify';
import type { CaptureTimers } from '../types';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../adapters/errors';
import { CaptureAdapterKind, CaptureOperation } from '../adapters/kinds';
import { createFakePoeController } from '../adapters/fake';
import { createCaptureDeviceRegistry } from '../adapters/registry';
import type { AudioInputAdapter, CameraAdapter, CaptureAdapter, CaptureDeviceEntry, CaptureDeviceRegistry } from '../adapters/types';
// Task 4 row 88 (THE LIFT): the boot builds the production registry, its two watches and the microphone's configuration writer.
// The loader is imported for its TYPES here and for its value by ONE dynamic import inside the boot step (rule A-1).
import type { ProductionAdapterDependencies, ProductionAdapters, ProductionMacosMicrophoneDependencies, ProductionMicrophoneDependencies } from '../adapters/real';
import { createCameraWatch, type CameraWatch, type CameraWatchDependencies } from '../adapters/camera/camera-watch';
import { MIC_CARD_ABSENT, MIC_CARD_CHANGED, createMicLossWatch, type MicCardMatch, type MicLossWatch, type MicLossWatchOptions } from '../adapters/audio/mic-loss';
import { identifyRegisteredCard, isRegisteredAudioInput, type RegisteredAudioInput } from '../adapters/audio/usb-audio-production';
// Row N10: the macOS adapter's pure match of the loss watch (shared AS CODE, as the Linux match above), the tied listing, the keeper.
import { identifyMacosRegisteredCard, type MacosAudioNotice, type MacosWatchedListing } from '../adapters/audio/usb-audio-macos';
import { MacosCardListingError, type MacosCardEnumerator } from '../adapters/audio/macos-card-listing';
import { createPipeKeeper } from '../adapters/local/pipe-files';
import { createAlsaConfigWriter } from '../adapters/audio/alsa-config-writer';
import type { CardEnumerator, CardListing } from '../adapters/audio/card-listing';
import {
  LOCAL_CAMERA_DEVICE_NAME,
  LOCAL_MIC_DEVICE_NAME,
  MicGeneratedTone,
  createCameraHelpers,
  createLocalCameraAdapter,
  createLocalMicAdapter,
  createMicHelper,
  inspectProgram,
  leftoverHelperPids,
  readFileHead,
  startHelperProcess,
  type FileHeadReader,
  type HelperDoor,
  type LocalSourceError,
  type ProgramInspector,
} from '../adapters/local';
import { ALIAS_SOCKET_INSTALLED_PATH, bootHostPlatformOf } from '../boot';
import { CAPTURE_FENCE_BOOT_STEP, runCaptureFenceBoot, type CaptureFenceOutcome, type CaptureFenceSinks } from './boot';
import { READ_PREVIOUS_BOOT_STATEMENT, storedBootSigningKey, storedBootSigningStore, systemBootDetailsOf, systemBootSeverityOf } from './boot-key';
import { createGeneratedCameraAdapter, createGeneratedMicAdapter } from './generated-sources';
import { captureOperationDecisionOf, type CaptureOperationDecision } from './operation';
import { READ_STORED_DEVICE_PROFILES, READ_STORED_DEVICE_PROFILES_OF, productionCameraTimeReaderOf, productionDeviceEntryOf, tellQuietly } from './production-parts';
import { readStoredDevices, type FenceExecutor, type LocalDeviceClass, type StoredCaptureDevice } from './registration';
import { tellEach, whileShortOpen } from './sources';

export {
  BOOT_AUDIT_OPERATIONS,
  CAPTURE_FENCE_BOOT_STEP,
  CaptureFenceError,
  CaptureFenceRefusal,
  DEVELOPMENT_FENCE_REFUSALS,
  HelperProgramProblem,
  captureFenceRefusalOf,
  helperProgramProblemOf,
  runCaptureFenceBoot,
  type AssignedSource,
  type CaptureFenceBootDeps,
  type CaptureFenceOutcome,
  type CaptureFenceSinks,
  type CaptureFenceUnit,
} from './boot';
// Task 4 row 209 (SX-15): which key the boot entry states, and the rule its writer holds the two members to.
export { BOOT_SIGNING_KEY_NOT_READ, SYSTEM_BOOT_SIGNING_MEMBERS, SYSTEM_BOOT_SIGNING_MEMBER_INVALID, SystemBootSigningMemberError, bootSigningKeyProblemOf, isSystemBootSigningValue, storedBootSigningKey, systemBootDetailsOf, type BootSigningKey, type StoredCertificateReader, type SystemBootDetails, type SystemBootSigningMember } from './boot-key';
export { BootSigningStoreChange, READ_PREVIOUS_BOOT_STATEMENT, SYSTEM_BOOT_SIGNING_STORE_MEMBERS, bootSigningStoreChangeOf, storedBootSigningStore, systemBootSeverityOf, type BootSigningStore, type BootSigningStoreStatement, type RetainedCertificateSetReader } from './boot-key';
// Task 4 row P1 (U21 (2)): the host a production boot states - the platform and whether the host profile will be asked on it.
export { BootHostProfile, SYSTEM_BOOT_HOST_MEMBERS, bootHostStatementOf, type BootHostStatement } from './boot-key';
export { BootAddressHelperSocket, SYSTEM_BOOT_ADDRESS_HELPER_MEMBERS, bootAddressHelperStatementOf, type BootAddressHelperStatement } from './boot-key';
export { GENERATED_SOURCE_SWITCHED_UNREACHABLE, GeneratedSourceUnreachableError, createGeneratedCameraAdapter, createGeneratedMicAdapter, type GeneratedCameraAdapter, type GeneratedCameraOptions, type GeneratedMicAdapter, type GeneratedMicOptions } from './generated-sources';
export { FakeMicRefusal, FakeMicSource, SPEECH_FIXTURE_FORMAT, SPEECH_FIXTURE_HEAD_BYTES, SpeechFixtureProblem, fakeMicDecisionOf, speechFixtureFormatProblem, type FakeMicDecision, type FakeMicInput } from './fake-mic';
export { CaptureFlagRefusal, captureOperationDecisionOf, captureOperationOf, type CaptureOperationDecision, type CaptureOperationInput } from './operation';
export { DEV_CAMERA_STUB_IN_PRODUCTION, DevelopmentDiscoveryError, DevelopmentDiscoveryIgnored, developmentDiscoveryAdmissionOf, type DevelopmentDiscoveryAdmission } from './development-discovery';
export { LOCAL_DEVICE_ROWS, readStoredDevices, registerLocalDevices, type FenceExecutor, type LocalDeviceClass, type LocalDeviceRegistration, type StoredCaptureDevice } from './registration';
export {
  CAPTURE_SOURCE_SLOTS,
  DevelopmentSourceLabel,
  MIC_SOURCE_FACT_KEYS,
  NO_SOURCE_FACTS,
  SOURCE_FACTS_MAX_BYTES,
  assertOperationRecordable,
  assertSessionSourcesOfOperation,
  audioCardStatementOf,
  buildSessionCaptureSources,
  developmentSourceLabelOf,
  deviceSourceFieldsOf,
  micSourceFactsOf,
  storedDeviceListingOf,
  type AudioCardFactsSource,
  type AudioCardStatement,
  type CaptureSourceSlot,
  type DeviceSourceFields,
  type MicSourceFactKey,
  type RecordedSlot,
  type SessionCaptureSource,
  type SessionCaptureSourcesInput,
  type SessionSourceFacts,
} from './sources';
export { CAPTURE_FENCE_WRITES, READ_ASSIGNED_SOURCES, READ_STORED_DEVICES, REGISTER_LOCAL_DEVICE } from './statements';
// The capture unit's own parts of production capture (task 4 row 85b, decision C55), for the composition above the modules.
export * from './production-parts';

/**
 * The reader of what a helper program path IS (fix F-M4; review row 69, question 5): the door's
 * own inspector under the fence's name, so that the seed commands ask `helperProgramProblemOf` with
 * the very reader the boot uses, without reaching into the adapter layer.
 */
export const inspectHelperProgram: ProgramInspector = inspectProgram;
export type HelperProgramInspector = ProgramInspector;

/** `<dataDir>/run/capture`: where the pipes of the sessions live (spec §A.7.1 ML-2). */
const RUN_SUBPATH = 'run/capture';

export interface DevelopmentRegistryInput {
  /** The registry as stored: every row of a development kind gets its adapter. */
  readonly devices: readonly StoredCaptureDevice[];
  readonly local: { readonly cameraId: string; readonly micId: string };
  /** The helper program the boot fence vouched for. */
  readonly program: string;
  readonly runDir: string;
  readonly now: () => number;
  readonly timers: CaptureTimers;
  readonly locked?: () => boolean;
  readonly door?: HelperDoor;
  readonly inspect?: ProgramInspector;
  readonly onSourceLost?: (deviceId: string, error: LocalSourceError) => void;
  /**
   * Told after every change of what `openSources()` answers: a local source was opened, closed or
   * lost, or a short pre-check open began or ended (row 140; SEC35-44 (4)). Identifiers are not
   * passed: the listener reads `openSources()`.
   */
  readonly onOpenSourcesChanged?: () => void;
  /**
   * The speech fixture the boot fence vouched for (`CaptureFenceOutcome.fakeMic.fixturePath`; fix
   * wave H), or null / absent for the tones. When set, the FIRST test microphone plays it.
   */
  readonly speechFixturePath?: string | null;
  /**
   * The development source switch (fix wave M, ruling D232; `generated-sources.ts`
   * `GeneratedSourceOptions.unreachable`). Handed to the GENERATED adapters only: the two local
   * devices never see it.
   */
  readonly sourceUnreachable?: (deviceId: string) => boolean;
}

/**
 * What the reachability probe of the pre-check and of operation 97 needs of the running operation
 * (row 140; capture spec §A.6.4 HL-10 / HL-12; contract C3 §2.6 "Microphones"). The shape is the
 * input of `probeOfAdapters` (`src/capture-notices`), written here structurally: the fence imports
 * nothing of that unit (it imports the adapter layer: a cycle otherwise).
 */
export interface CaptureProbeAdapters {
  /** Every camera adapter of the operation that serves a registered device. */
  readonly cameras: readonly CameraAdapter[];
  /** Every microphone adapter. A microphone is asked through `enumerate()`: the device LIST, which opens nothing (ML-8). */
  readonly microphones: readonly AudioInputAdapter[];
  /**
   * The read that asks one camera. A test source: its profiles (nothing is opened). THE LOCAL
   * CAMERA: ONE SHORT OPEN (`precheck`, HL-12) - it rejects with the named local error, whose
   * `code` is the cause. This is where this Mac's camera is opened at a pre-check; it is "on" for
   * that moment (`openSources()`).
   */
  readCamera(adapter: CameraAdapter, deviceId: string, signal: AbortSignal): Promise<unknown>;
}

export interface BuiltCaptureRegistry {
  readonly registry: CaptureDeviceRegistry;
  /** The local devices whose source is open now (`sourceOpen`, SEC35-44 (4)): a running helper, a prepared microphone, a short pre-check open. */
  openSources(): readonly string[];
  /**
   * The adapters the reachability probe asks; null when the operation registers none. THE LIST OF
   * THE MOMENT OF THE CALL: `admit` adds to it, so a caller asks at each use and keeps no answer
   * (fix wave M, follow-up M-S2: the notices unit kept its first one).
   */
  probeAdapters(): CaptureProbeAdapters | null;
  /**
   * Fix wave I (finding G70b-01): gives a device that was REGISTERED AFTER THE BOOT (operation 96)
   * the adapter a boot would give its stored row, so that it is assignable at once and not only
   * after a restart. The answer says what was done; nothing is thrown for a device no adapter of
   * this operation serves.
   */
  admit(device: StoredCaptureDevice): CaptureDeviceAdmission;
  /** Stops every helper and removes every pipe. */
  closeAll(): Promise<void>;
}

/**
 * What `admit` did (fix wave I):
 *   ADMITTED         the device has its adapter now and the registry serves it;
 *   ALREADY_SERVED   the registry served it before the call (a repeat is not an error);
 *   NOT_SERVED       no adapter of the running operation stands behind this kind of device: a
 *                    production kind in `REAL_DEVELOPMENT`, a production device whose adapter has
 *                    no door of a later device (a kind without an opener on this host), a second
 *                    local device, or any device while the Core runs `SIMULATED` (no registry at all).
 *   ADMITTING        (task 4 row 85c; the production registry only) the stored row of the device
 *                    is being read and handed to its adapter: the registry serves it when that has
 *                    settled (`BuiltProductionRegistry.admitted`), and says so through
 *                    `onAdmission`. The answer of the call itself claims nothing more.
 */
export const CaptureDeviceAdmission = { ADMITTED: 'ADMITTED', ALREADY_SERVED: 'ALREADY_SERVED', NOT_SERVED: 'NOT_SERVED', ADMITTING: 'ADMITTING' } as const;
export type CaptureDeviceAdmission = (typeof CaptureDeviceAdmission)[keyof typeof CaptureDeviceAdmission];

/**
 * The registry of `REAL_DEVELOPMENT` (rule RG-1; spec §A.1.1 "Development slots"): the local
 * camera and the local microphone behind their own ids, and a generated test source behind every
 * stored `FAKE` camera and microphone (slot 2 is `CAM-02` / `MIC-02`, D74(2)); the stored `FAKE`
 * switch gets the in-memory controller. A stored PRODUCTION device gets no adapter here: it is not
 * assignable in this operation (rule RG-3), and the search half of `ONVIF_RTSP` is the discovery
 * rows' to register.
 */
export function buildDevelopmentRegistry(input: DevelopmentRegistryInput): BuiltCaptureRegistry {
  const registry = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_DEVELOPMENT, ...(input.locked === undefined ? {} : { locked: input.locked }) });
  const shared = {
    program: input.program,
    timers: input.timers,
    ...(input.door === undefined ? {} : { door: input.door }),
    ...(input.inspect === undefined ? {} : { inspect: input.inspect }),
    ...(input.onSourceLost === undefined ? {} : { onSourceLost: input.onSourceLost }),
  };
  const labelOf = (id: string): string => input.devices.find((device) => device.id === id)?.model ?? id;
  // A local source that ended by itself is no longer open: the listeners of `openSources()` are told, then the layer above.
  const localLost = (deviceId: string, error: LocalSourceError): void => {
    input.onOpenSourcesChanged?.();
    input.onSourceLost?.(deviceId, error);
  };
  const camera = createLocalCameraAdapter({ ...shared, id: input.local.cameraId, label: labelOf(input.local.cameraId), now: input.now, onSourceLost: localLost });
  const mic = createLocalMicAdapter({ ...shared, id: input.local.micId, label: labelOf(input.local.micId), runDir: input.runDir, onSourceLost: localLost });
  const closers: Array<() => Promise<void>> = [() => camera.closeAll(), () => mic.closeAll()];
  // Row 140: what is registered for the two local devices tells the fence when a source was opened
  // or closed (the "is on" indicator must follow at once). The adapters themselves are unchanged;
  // a loss is told through `localLost` above, after the adapter dropped the device from its set.
  const changed = (): void => input.onOpenSourcesChanged?.();
  /** The local camera while its short pre-check open runs: it is on for that moment too (PE-128-78). */
  const shortOpens = new Set<string>();
  const watchedCamera: CameraAdapter = {
    ...camera,
    async openSource(deviceId, target, signal) {
      const handle = await camera.openSource(deviceId, target, signal);
      changed();
      return Object.freeze({
        deviceId: handle.deviceId,
        async close(): Promise<void> {
          await handle.close();
          changed();
        },
      });
    },
  };
  const watchedMic: AudioInputAdapter = {
    ...mic,
    async open(inputId, target) {
      const stream = await mic.open(inputId, target);
      changed();
      // Every member of the stream is kept (`start`, `onLost`, ...): only the close also tells.
      return Object.freeze({
        ...stream,
        async close(): Promise<void> {
          await stream.close();
          changed();
        },
      });
    },
  };
  const adapters: CaptureAdapter[] = [watchedCamera, watchedMic];
  const cameraAdapters: CameraAdapter[] = [watchedCamera];
  const micAdapters: AudioInputAdapter[] = [watchedMic];
  /** The first fake microphone of the stored registry: the one that sounds 440 Hz, or plays the speech fixture. */
  const firstFakeMicId = input.devices.find((device) => device.adapterKind === CaptureAdapterKind.FAKE && device.kind === 'MIC')?.id ?? null;
  /**
   * The adapter of ONE stored `FAKE` device: the same for a row the boot read and for a camera
   * operation 96 registered later (`admit`; fix wave I, finding G70b-01).
   */
  /** Not in `shared`: that object is also what the LOCAL adapters are built from. */
  const switched = input.sourceUnreachable === undefined ? {} : { unreachable: input.sourceUnreachable };
  const fakeAdapterOf = (device: StoredCaptureDevice): CaptureAdapter => {
    const label = device.model ?? device.id;
    if (device.kind === 'CAMERA') {
      const generated = createGeneratedCameraAdapter({ ...shared, ...switched, id: device.id, label, now: input.now });
      cameraAdapters.push(generated);
      closers.push(() => generated.closeAll());
      return generated;
    }
    if (device.kind === 'MIC') {
      // The first fake microphone sounds 440 Hz, every other one 880 Hz: two test tones a listener can tell apart.
      const first = device.id === firstFakeMicId;
      const tone = first ? MicGeneratedTone.TONE_440 : MicGeneratedTone.TONE_880;
      // Fix wave H: with the speech setting the first one plays the speech fixture in the place of its tone; every other one keeps its tone.
      const speechFixture = first && typeof input.speechFixturePath === 'string' ? { speechFixture: input.speechFixturePath } : {};
      const generated = createGeneratedMicAdapter({ ...shared, ...switched, id: device.id, label, runDir: input.runDir, tone, ...speechFixture });
      micAdapters.push(generated);
      closers.push(() => generated.closeAll());
      return generated;
    }
    return createFakePoeController({ id: device.id, label, ports: [], capabilities: ['SNMP'] });
  };
  for (const device of input.devices) {
    if (device.adapterKind === CaptureAdapterKind.FAKE) adapters.push(fakeAdapterOf(device));
  }
  for (const adapter of adapters) registry.register(adapter);
  return {
    registry,
    openSources: () => Object.freeze([...new Set([...camera.openSources(), ...shortOpens, ...mic.openSources()])]),
    probeAdapters: () =>
      Object.freeze({
        cameras: Object.freeze([...cameraAdapters]),
        microphones: Object.freeze([...micAdapters]),
        async readCamera(adapter: CameraAdapter, deviceId: string, signal: AbortSignal): Promise<unknown> {
          // A test source is always there and nothing of it is opened: its profiles answer.
          if (adapter !== watchedCamera) return adapter.profiles(deviceId);
          const error = await whileShortOpen(shortOpens, deviceId, changed, () => camera.precheck(signal));
          // The named error is the answer of an unreachable camera: its `code` is the cause the probe reads.
          if (error !== null) throw error;
          return null;
        },
      }),
    admit(device) {
      if (registry.list().some((served) => served.id === device.id)) return CaptureDeviceAdmission.ALREADY_SERVED;
      // Only what a boot would give an adapter: a stored `FAKE` row. A production kind has no opener
      // in this phase, and the two local devices are registered by the boot alone.
      if (device.adapterKind !== CaptureAdapterKind.FAKE) return CaptureDeviceAdmission.NOT_SERVED;
      registry.register(fakeAdapterOf(device));
      return CaptureDeviceAdmission.ADMITTED;
    },
    closeAll: async () => {
      await Promise.all(closers.map((close) => close()));
    },
  };
}

/**
 * The EMPTY registry of `REAL_PRODUCTION`: NO adapter. Since the lift (task 4 row 88) the boot step
 * builds it only where NO composition handed the fence its production parts (`provideProductionParts`
 * was not called: a test app that composes nothing; the entry point always composes). The loader is
 * not called here, so nothing of the production adapters is evaluated. Every assignment is refused
 * by the registry (unknown to it), and every plan by the plan builder (`SOURCE_KIND_NOT_RECORDABLE`):
 * fail-closed.
 */
export function buildProductionRegistry(locked?: () => boolean): BuiltCaptureRegistry {
  const registry = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION, ...(locked === undefined ? {} : { locked }) });
  return { registry, openSources: () => Object.freeze([]), probeAdapters: () => null, admit: () => CaptureDeviceAdmission.NOT_SERVED, closeAll: async () => {} };
}

/** The device classes and adapter kinds a production registry serves: the three production kinds, one per seam. */
const PRODUCTION_KIND_OF_CLASS = Object.freeze({ CAMERA: CaptureAdapterKind.ONVIF_RTSP, MIC: CaptureAdapterKind.USB_AUDIO, POE: CaptureAdapterKind.SNMP_POE } as const);

/** The three device lists the loader takes, and what it answers: the shapes of `../adapters/real.ts`, written here because rule A-1 lets no production file import the loader. */
export interface ProductionRegistryDevices {
  readonly cameras: readonly CaptureDeviceEntry[];
  readonly mics: readonly CaptureDeviceEntry[];
  readonly switches: readonly CaptureDeviceEntry[];
}
export interface ProductionRegistryAdapters {
  readonly camera: CameraAdapter;
  readonly audio: AudioInputAdapter;
  readonly poe: CaptureAdapter;
}
/** `loadProductionAdapters` of `../adapters/real.ts`, by shape. */
export type ProductionAdapterLoader<Camera, Audio> = (operation: CaptureOperation, devices: ProductionRegistryDevices, dependencies: { readonly camera: Camera; readonly audio: Audio }) => Promise<ProductionRegistryAdapters>;

export interface ProductionRegistryInput<Camera, Audio, Cards = unknown> {
  /** The capture operation of the Core. Anything but `REAL_PRODUCTION` is refused BEFORE anything is read, imported or built. */
  readonly operation: CaptureOperation;
  /** The read of the stored registry. The builder reads the devices ITSELF: the boot outcome of production carries no device list. */
  readonly executor: FenceExecutor;
  /** What the two production adapters are built from (`ProductionAdapterDependencies` of the loader), handed on unchanged. */
  readonly dependencies: { readonly camera: Camera; readonly audio: Audio };
  /**
   * THE LOADER (`loadProductionAdapters`). Handed in by the one production file rule A-1 admits as its
   * importer; until the lift (row 88) that is no file at all, so the builder has no caller in the product.
   */
  readonly load: ProductionAdapterLoader<Camera, Audio>;
  /** The card listing of the host (the enumerator's `list`), for operations 98 and 99: read at every call. */
  readonly audioCards: () => Promise<Cards>;
  /** The read that asks one production camera at a pre-check (the camera watch's check). Default: its stored profiles through the adapter. */
  readonly checkCamera?: (deviceId: string, signal: AbortSignal) => Promise<unknown>;
  /** True while a session is open (OD-10). */
  readonly locked?: () => boolean;
  /**
   * A read of the store that works AFTER the boot (task 4 row 85c): `executor` is the boot's unit and is
   * over by then. The admission of a device registered after the boot reads its stored row with it.
   * ABSENT: no device is admitted after the boot (`NOT_SERVED`, as before this row).
   */
  readonly reader?: FenceExecutor;
  /** Told how the admission of a later device ended. Identifiers and code words only. Must not throw (a throw is dropped). */
  readonly onAdmission?: (deviceId: string, outcome: CaptureDeviceAdmission | typeof ADMISSION_FAILED, code: string | null) => void;
}

/** The outcome of a later admission that could not be finished (the stored row could not be read, the adapter or the registry refused the device). */
export const ADMISSION_FAILED = 'FAILED';

/**
 * THE DOOR OF A LATER DEVICE IN A BUILT ADAPTER (task 4 row 85c), by shape. Both built production
 * adapters take a FIXED device list when they are built, so a device registered afterwards has no
 * adapter. An adapter that can take one says so with this member: it serves `entry` from then on
 * exactly as a device of its first list. Both built adapters have it (row 85d); the stubs never
 * will; without it the admission answers `NOT_SERVED`.
 */
export interface LateDeviceAdapter {
  admitDevice(entry: CaptureDeviceEntry): void;
}

export interface BuiltProductionRegistry<Cards = unknown> extends BuiltCaptureRegistry {
  /** The stored devices of the three production kinds this registry serves, in the order of the stored registry, then those admitted later. */
  devices(): readonly StoredCaptureDevice[];
  /** The card listing of the host, read now. */
  audioCards(): Promise<Cards>;
  /** The cameras of the build whose stored profile list was not of its form: each has an EMPTY profile list (no profile is assumed). */
  malformedProfiles(): readonly string[];
  /** How the admission of a later device ends: the running one's outcome, else what the registry says now. Never rejects. */
  admitted(deviceId: string): Promise<CaptureDeviceAdmission>;
}

/** A member a built adapter may have beside its seam (the production microphone adapter has both; the class-C stubs have neither). */
const optionalCall = <Result>(adapter: object, name: 'openSources' | 'closeAll'): (() => Result) | null => {
  const member = (adapter as Record<string, unknown>)[name];
  return typeof member === 'function' ? () => (member as () => Result).call(adapter) : null;
};

/**
 * THE PRODUCTION REGISTRY BUILDER (task 4 row 85, WP-13b; design addendum 6.1 facts 3 to 5, 6.4).
 *
 * In this order: (1) any operation but `REAL_PRODUCTION` is refused, before a read, an import or a
 * build; (2) the stored registry is read and the rows of the three production kinds become the
 * device entries; (3) the loader builds the three adapters from them and from the dependency bundle;
 * (4) each is registered in a registry of the operation - under the registry's own rules: since the
 * lift (AM-1) the two production source kinds may state an opener there, `SNMP_POE` may not, and an
 * adapter with an opener of another class than the operation's is refused (`CAPTURE_ADAPTER_INVALID`);
 * a refused registration ends the build and closes what was built.
 *
 * CALLED BY THE BOOT STEP since the lift (task 4 row 88), with the parts the composition handed in.
 * It takes no seam: every member of its input is a product dependency, and the one value a test may
 * hand in that a product must not - a permissive destination rule - exists under `test/` only and
 * travels inside `dependencies.camera` (AD-02 (2)).
 *
 * SINCE TASK 4 ROW 85c: a device entry carries its capability and - for a camera - its stored
 * profile list (the wider read `READ_STORED_DEVICE_PROFILES`; a list not of its form is an empty
 * list and is named by `malformedProfiles`). `admit` serves a device registered after the boot
 * where a read of the store is handed in (`reader`) and the adapter of its class has the door of a
 * later device (`LateDeviceAdapter`): the adapter takes the entry through that door FIRST, then
 * the registry takes a view of it (C70). Both built adapters have the door (row 85d); the stubs of
 * a kind without an opener do not, so such a device needs a restart.
 */
export async function buildProductionRegistryOf<Camera, Audio, Cards = unknown>(input: ProductionRegistryInput<Camera, Audio, Cards>): Promise<BuiltProductionRegistry<Cards>> {
  if (input.operation !== CaptureOperation.REAL_PRODUCTION) throw new CaptureAdapterError(CaptureAdapterRefusal.REAL_ADAPTERS_REFUSED);
  const stored = (await readStoredDevices(input.executor)).filter((device) => device.adapterKind === PRODUCTION_KIND_OF_CLASS[device.kind]);
  // THE WIDER READ (task 4 row 85c): the stored profile list of each device, beside the boot's own pinned read of the registry.
  const storedProfiles = new Map<unknown, unknown>((await input.executor.query<Record<string, unknown>>(READ_STORED_DEVICE_PROFILES)).rows.map((row) => [row['id'], row['profiles']] as const));
  const malformed: string[] = [];
  const entryOf = (device: StoredCaptureDevice, profiles: unknown): CaptureDeviceEntry => {
    const made = productionDeviceEntryOf(device, profiles);
    if (made.malformed) malformed.push(device.id);
    return made.entry;
  };
  const entriesOf = (kind: StoredCaptureDevice['kind']): readonly CaptureDeviceEntry[] => Object.freeze(stored.filter((device) => device.kind === kind).map((device) => entryOf(device, storedProfiles.get(device.id))));
  const adapters = await input.load(input.operation, Object.freeze({ cameras: entriesOf('CAMERA'), mics: entriesOf('MIC'), switches: entriesOf('POE') }), input.dependencies);
  const built: readonly CaptureAdapter[] = [adapters.camera, adapters.audio, adapters.poe];
  const closeAll = async (): Promise<void> => {
    await Promise.all(built.map((adapter) => optionalCall<Promise<void>>(adapter, 'closeAll')?.()));
  };
  const registry = createCaptureDeviceRegistry({ operation: input.operation, ...(input.locked === undefined ? {} : { locked: input.locked }) });
  // Nothing of a refused build stays: the refusal of the registry goes to the caller as it is, no half registry is handed
  // out, and what was built is closed first. (No error is handled here: this file answers no failure with another source.)
  let registered = false;
  try {
    for (const adapter of built) registry.register(adapter);
    registered = true;
  } finally {
    if (!registered) await closeAll();
  }
  const checkCamera = input.checkCamera;

  // ── A device registered AFTER this build (task 4 row 85c) ──
  const adapterOfClass: Readonly<Record<StoredCaptureDevice['kind'], CaptureAdapter>> = { CAMERA: adapters.camera, MIC: adapters.audio, POE: adapters.poe };
  const lateDoorOf = (adapter: CaptureAdapter): ((entry: CaptureDeviceEntry) => void) | null => {
    const member = (adapter as unknown as Record<string, unknown>)['admitDevice'];
    return typeof member === 'function' ? (entry) => void (member as LateDeviceAdapter['admitDevice']).call(adapter, entry) : null;
  };
  const served = (deviceId: string): boolean => registry.list().some((device) => device.id === deviceId);
  const admittedLater: StoredCaptureDevice[] = [];
  const admitting = new Map<string, Promise<CaptureDeviceAdmission>>();
  // An observer never changes what was admitted: what it throws is dropped (`tellQuietly`; this file has no error path of
  // its own - static rule G-R14 - because it builds the development sources).
  const tellAdmission = (deviceId: string, outcome: CaptureDeviceAdmission | typeof ADMISSION_FAILED, code: string | null): void => tellQuietly(() => input.onAdmission?.(deviceId, outcome, code));
  /**
   * THE STORED ROW DECIDES, read now: class, kind, label and profile list are the store's, never the caller's word. The
   * adapter of that class takes the device through its own door, then the registry takes a view of that adapter with the
   * ONE new entry - under the registry's own rules, unchanged (a duplicate, a wrong class, an opener for a kind without
   * one are refused as at the build).
   */
  const admitLater = async (deviceId: string, reader: FenceExecutor): Promise<CaptureDeviceAdmission> => {
    const row = (await reader.query<Record<string, unknown>>(READ_STORED_DEVICE_PROFILES_OF, [deviceId])).rows[0];
    const kind = row?.['kind'];
    if (row === undefined || row['id'] !== deviceId || (kind !== 'CAMERA' && kind !== 'MIC' && kind !== 'POE') || row['adapterKind'] !== PRODUCTION_KIND_OF_CLASS[kind]) return CaptureDeviceAdmission.NOT_SERVED;
    if (served(deviceId)) return CaptureDeviceAdmission.ALREADY_SERVED;
    const adapter = adapterOfClass[kind];
    const take = lateDoorOf(adapter);
    if (take === null) return CaptureDeviceAdmission.NOT_SERVED;
    const device: StoredCaptureDevice = { id: deviceId, kind, adapterKind: PRODUCTION_KIND_OF_CLASS[kind], model: typeof row['model'] === 'string' ? row['model'] : null };
    const entry = entryOf(device, row['profiles']);
    take(entry);
    registry.register(Object.freeze({ ...adapter, devices: Object.freeze([entry]) }) as CaptureAdapter);
    admittedLater.push(device);
    return CaptureDeviceAdmission.ADMITTED;
  };
  const codeOf = (error: unknown): string | null => {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : null;
  };

  return {
    registry,
    devices: () => Object.freeze([...stored, ...admittedLater]),
    malformedProfiles: () => Object.freeze([...new Set(malformed)].sort()),
    admitted: (deviceId) => admitting.get(deviceId) ?? Promise.resolve(served(deviceId) ? CaptureDeviceAdmission.ALREADY_SERVED : CaptureDeviceAdmission.NOT_SERVED),
    audioCards: () => input.audioCards(),
    openSources: () => Object.freeze([...new Set(built.flatMap((adapter) => optionalCall<readonly string[]>(adapter, 'openSources')?.() ?? []))]),
    probeAdapters: () =>
      Object.freeze({
        cameras: Object.freeze([adapters.camera]),
        microphones: Object.freeze([adapters.audio]),
        readCamera: (adapter: CameraAdapter, deviceId: string, signal: AbortSignal): Promise<unknown> => (checkCamera === undefined ? adapter.profiles(deviceId) : checkCamera(deviceId, signal)),
      }),
    // A device registered after this build (row 85c). The adapters took their devices when they were built: it is served only
    // where a read of the store was handed in AND the adapter of its class has the door of a later device. Otherwise the
    // answer is the one of before this row. The call answers at once; the admission itself reads the store and is told.
    admit(device) {
      if (served(device.id)) return CaptureDeviceAdmission.ALREADY_SERVED;
      if (device.adapterKind !== PRODUCTION_KIND_OF_CLASS[device.kind]) return CaptureDeviceAdmission.NOT_SERVED;
      const reader = input.reader;
      if (reader === undefined || lateDoorOf(adapterOfClass[device.kind]) === null) return CaptureDeviceAdmission.NOT_SERVED;
      if (!admitting.has(device.id)) {
        const deviceId = device.id;
        const work = admitLater(deviceId, reader).then(
          (outcome) => {
            tellAdmission(deviceId, outcome, null);
            return outcome;
          },
          (error: unknown) => {
            tellAdmission(deviceId, ADMISSION_FAILED, codeOf(error));
            return served(deviceId) ? CaptureDeviceAdmission.ALREADY_SERVED : CaptureDeviceAdmission.NOT_SERVED;
          },
        );
        admitting.set(deviceId, work);
        void work.then(() => {
          if (admitting.get(deviceId) === work) admitting.delete(deviceId);
        });
      }
      return CaptureDeviceAdmission.ADMITTING;
    },
    closeAll,
  };
}

// ── THE LIFT (task 4 row 88; decision AM-1; request lines 295, 304, 339 of rows 85b, 85c, 85d; decision C70) ──

/** The one platform whose host has a production microphone opener (AM-1 (3)(h) with the erratum of C135): `linux`. */
export const PRODUCTION_MICROPHONE_OPENER_PLATFORM = 'linux';

/**
 * THE PLATFORM OF THE macOS MICROPHONE ADAPTER (task 4 row N10; design 06 row N10; SM-21): `linux` builds
 * the Linux adapter, `darwin` the macOS one, any other none - never both. The platform word is the
 * entry point's (`process.platform`, handed through the composition); no key, flag or seam chooses it.
 */
export const MACOS_MICROPHONE_OPENER_PLATFORM = 'darwin';

/**
 * THE macOS MICROPHONE OPENER IS NOT ADMITTED (decision C135 (3); row N10). On `darwin` the boot step
 * builds the macOS adapter only once the M2b gate row has admitted its opener BY A DECISION ROW AND A
 * ONE-LINE COMMIT OF THIS CONSTANT - never by an environment variable, a flag or a key of the
 * configuration. While it is false a `darwin` host is exactly as before row N10: the microphone
 * adapter WITHOUT an opener, no loss watch, a REAL_PRODUCTION start refused
 * (`SOURCE_KIND_NOT_RECORDABLE`). Pinned with its value by `capture/__tests__/static.test.ts` (row N10).
 */
export const MACOS_MICROPHONE_OPENER_ADMITTED = false;

/**
 * FOR TESTS ONLY (row N14 will use it): the explicit admission of the macOS opener in ONE wiring call,
 * beside the constant above. NO PRODUCTION CALL SITE PASSES IT: the one production call of
 * `wireProductionRegistry` hands two arguments (static case "row N10" of `capture/__tests__/static.test.ts`).
 */
export interface ProductionWiringAdmission {
  readonly admitMacosMicrophoneOpener: true;
}

/** Passes IN A ROW that could not confirm a HELD macOS microphone before its named fault is said (review SM-06). */
export const MACOS_MIC_UNCONFIRMED_PASSES = 2;

/** What the composition hands for the production microphone: the adapter's options but the two the capture unit owns, with the two program paths as the configuration states them (may be null). */
export type ProductionAudioParts = Omit<ProductionMicrophoneDependencies, 'helperProgram' | 'guardProgram' | 'configWriter' | 'runDir'> & { readonly helperProgram: string | null; readonly guardProgram: string | null };

/**
 * WHAT THE COMPOSING FILE HANDS THE FENCE FOR PRODUCTION CAPTURE (row 88). The fence may not import
 * the composition (it stands above the modules), so the composition opens this door of the fence
 * control, ONCE, before the boot steps run; the boot step of `REAL_PRODUCTION` builds the registry,
 * the two watches and the microphone's configuration writer from it.
 */
export interface ProductionCaptureParts {
  /** The platform of the process, as the entry point stated it: `linux` builds the Linux microphone opener, `darwin` the macOS one once admitted (row N10), any other none. */
  readonly platform: string;
  readonly dependencies: { readonly camera: ProductionAdapterDependencies['camera']; readonly audio: ProductionAudioParts };
  readonly watches: {
    /** Everything the camera watch takes but its time reader, which the fence builds. */
    readonly camera: Omit<CameraWatchDependencies, 'reader'>;
    /** Everything the microphone loss watch takes but the four members the fence names. */
    readonly microphone: Omit<MicLossWatchOptions<RegisteredAudioInput>, 'devices' | 'identify' | 'isRow' | 'held'>;
  };
  /** The card listing of the host (operations 98 and 99), read at every call. */
  readonly cards: CardEnumerator;
  /** The report source of the session: the camera adapter's own source is attached to it; the camera watch listens to it. */
  readonly relayReports: {
    attach(source: ProductionAdapters['camera']['relayReports']): () => void;
    subscribe(listener: (report: Parameters<CameraWatch['pushEstablished']>[0]) => void): () => void;
  };
  /** Once each. The camera watch is attached BEFORE the registry is built: no start can come before it (finding E-03). */
  attachCameraWatch(watch: CameraWatch): void;
  attachMicLossWatch(watch: MicLossWatch): void;
}

/** Codes the wiring of the production registry logs. Identifiers and counts only. */
export const ProductionWiringCode = {
  /** REAL_PRODUCTION booted without the parts of a composition: the empty registry, nothing recordable. */
  PARTS_NOT_PROVIDED: 'CAPTURE_PRODUCTION_PARTS_NOT_PROVIDED',
  /** `linux`, but the audio helper or the guard is not configured: the microphone adapter WITHOUT an opener is built. */
  MIC_PROGRAM_NOT_CONFIGURED: 'CAPTURE_PRODUCTION_MIC_PROGRAM_NOT_CONFIGURED',
  /** Not `linux`: no production microphone opener on this host (AM-1 (3)(h), C135): the microphone adapter WITHOUT an opener is built. */
  MIC_OPENER_NOT_ON_THIS_PLATFORM: 'CAPTURE_PRODUCTION_MIC_OPENER_NOT_ON_THIS_PLATFORM',
  /** Cameras whose stored profile list was not of its form (each has an empty list). */
  PROFILES_MALFORMED: 'CAPTURE_PRODUCTION_PROFILES_MALFORMED',
  /** A device registered after the boot could not be admitted. */
  ADMISSION_FAILED: 'CAPTURE_PRODUCTION_ADMISSION_FAILED',
  /** A device registered after the boot was admitted (a camera's heartbeat starts). */
  ADMITTED: 'CAPTURE_PRODUCTION_DEVICE_ADMITTED',
  /** The production registry was built: how many devices per class, whether a microphone opener exists. */
  BUILT: 'CAPTURE_PRODUCTION_REGISTRY_BUILT',
  /** Row N10: `darwin`, opener admitted, but the card listing handed in is no tied macOS listing: no microphone opener is built. */
  MIC_LISTING_NOT_TIED: 'CAPTURE_PRODUCTION_MIC_LISTING_NOT_TIED',
  /** Row N10: a notice of the macOS microphone adapter (`MacosAudioNoticeCode`), with the microphone's registry id. */
  MACOS_AUDIO_NOTICE: 'CAPTURE_PRODUCTION_MACOS_AUDIO_NOTICE',
  /** Row N10 (SM-06): a HELD macOS microphone could not be confirmed by the listing for two passes in a row. Its capture goes on. */
  MIC_NOT_CONFIRMED: 'CAPTURE_PRODUCTION_MIC_NOT_CONFIRMED',
  /** Row N10 (SM-06): the end of that interval - the listing confirmed the microphone again, or its handle was closed. */
  MIC_CONFIRMATION_ENDED: 'CAPTURE_PRODUCTION_MIC_CONFIRMATION_ENDED',
} as const;

/** What the wiring needs of the app: a read of the store that works after the boot, the run directory, the lock, the log sinks. A test hands doubles. */
export interface ProductionWiringEnvironment {
  readonly store: FenceExecutor;
  /** `<dataDir>/run/capture`. */
  readonly runDir: string;
  readonly locked: () => boolean;
  readonly sinks: CaptureFenceSinks;
}

/** What the wiring says and persists: a level, a code, identifiers and counts. */
type WiringSay = (level: 'warn' | 'error', code: string, context: Record<string, string | number>, message: string) => void;

/** The card listing handed in, IF it is the tied listing of a macOS host (row N7's `macosCardEnumeratorOf`); else null. */
function tiedCardsOf(cards: CardEnumerator): MacosCardEnumerator | null {
  return typeof (cards as Partial<MacosCardEnumerator>).listTied === 'function' ? (cards as MacosCardEnumerator) : null;
}

/**
 * Row N10: what the macOS microphone adapter is built from on `darwin` - the composition's parts, the
 * tied listing, the two configured programs, the run directory, THE PRODUCT'S PIPE KEEPER
 * (`local/pipe-files.ts`, request line 552) on the capture timers, and its notices said by code. The
 * Linux-only members of the parts (its limits, its notice observer) are not handed on.
 */
function macosMicrophoneOf(audioParts: ProductionAudioParts, cards: MacosCardEnumerator, helperProgram: string, guardProgram: string, runDir: string, say: WiringSay): ProductionMacosMicrophoneDependencies {
  const onNotice = (notice: MacosAudioNotice): void => say('warn', ProductionWiringCode.MACOS_AUDIO_NOTICE, { notice: notice.code, deviceId: notice.deviceId }, 'a notice of the macOS microphone adapter');
  return {
    registered: audioParts.registered,
    cards,
    helperProgram,
    guardProgram,
    runDir,
    timers: audioParts.timers,
    pipes: createPipeKeeper(audioParts.timers),
    onNotice,
    ...(audioParts.onSourceLost === undefined ? {} : { onSourceLost: audioParts.onSourceLost }),
    ...(audioParts.level === undefined ? {} : { level: audioParts.level }),
    ...(audioParts.door === undefined ? {} : { door: audioParts.door }),
    ...(audioParts.inspect === undefined ? {} : { inspect: audioParts.inspect }),
    ...(audioParts.files === undefined ? {} : { files: audioParts.files }),
  };
}

/**
 * Row N10 (review SM-06): THE LOSS WATCH'S MATCH ON `darwin`, and its fault. The watch reads the TIED
 * listing (one reading of the three lists per pass) and matches each stored microphone with the
 * macOS adapter's own match, so a connected device that could not be tied is AMBIGUOUS, never
 * "disconnected". The watch raises nothing for an unreadable listing or an undecided device (it
 * cannot say the card is gone). For a microphone whose handle is HELD, such a pass is a pass that
 * could NOT CONFIRM it: after `MACOS_MIC_UNCONFIRMED_PASSES` of them with no confirming pass between,
 * the named fault `CAPTURE_PRODUCTION_MIC_NOT_CONFIRMED` is said on that microphone (log and
 * persistent error log); its capture goes on and its helper is not stopped (the audio may be fine).
 * The interval ends - `CAPTURE_PRODUCTION_MIC_CONFIRMATION_ENDED` - when a listing confirms the
 * microphone (present, absent or replaced: the watch's own rule then speaks) or its handle is closed.
 * A pass whose stored row could not be read judges nothing and breaks no count. Exported for its test
 * (`adapters/__tests__/real.test.ts`); its one production caller is the wiring below.
 */
export function macosLossMatchOf(tied: MacosCardEnumerator, held: () => readonly string[], say: WiringSay): Pick<MicLossWatchOptions<RegisteredAudioInput>, 'cards' | 'identify'> {
  const misses = new Map<string, number>();
  const unconfirmed = new Set<string>();
  const miss = (deviceId: string, detail: string): void => {
    const count = (misses.get(deviceId) ?? 0) + 1;
    misses.set(deviceId, count);
    if (count < MACOS_MIC_UNCONFIRMED_PASSES || unconfirmed.has(deviceId)) return;
    unconfirmed.add(deviceId);
    say('warn', ProductionWiringCode.MIC_NOT_CONFIRMED, { deviceId, passes: count, detail }, 'a held production microphone was not confirmed by the card listing for two passes in a row: its capture goes on');
  };
  const confirm = (deviceId: string, end: 'CONFIRMED' | 'NOT_HELD'): void => {
    misses.delete(deviceId);
    if (unconfirmed.delete(deviceId)) say('warn', ProductionWiringCode.MIC_CONFIRMATION_ENDED, { deviceId, end }, 'the interval in which a production microphone could not be confirmed has ended');
  };
  const cards: CardEnumerator = {
    // No error is HANDLED here (static rule G-R14: the fence has no error path): a failed reading is counted and goes on to the
    // watch as it was, which reports it and concludes nothing.
    list(): Promise<CardListing> {
      const holding = new Set(held());
      for (const deviceId of new Set([...misses.keys(), ...unconfirmed])) if (!holding.has(deviceId)) confirm(deviceId, 'NOT_HELD');
      return tied.listTied().then(
        (reading) => {
          if (!reading.ok) {
            for (const deviceId of holding) miss(deviceId, reading.failure);
            throw new MacosCardListingError(reading.failure, reading.detail);
          }
          const watched: MacosWatchedListing = Object.freeze({ ...reading.listing, undecided: reading.undecided });
          return watched;
        },
        (error: unknown) => {
          for (const deviceId of holding) miss(deviceId, 'LISTING_NOT_READ');
          throw error;
        },
      );
    },
  };
  const identify = (listing: CardListing, stored: RegisteredAudioInput): MicCardMatch => {
    const undecided = (listing as Partial<MacosWatchedListing>).undecided;
    const found = identifyMacosRegisteredCard({ ...listing, undecided: Array.isArray(undecided) ? undecided : [] }, stored);
    if (found.ok || found.refusal === MIC_CARD_ABSENT || found.refusal === MIC_CARD_CHANGED) confirm(stored.deviceId, 'CONFIRMED');
    else if (held().includes(stored.deviceId)) miss(stored.deviceId, typeof found.detail === 'string' ? found.detail : found.refusal);
    return found;
  };
  return { cards, identify };
}

/**
 * THE LIFT'S WIRING OF THE PRODUCTION REGISTRY, in this order:
 *   1. the microphone's dependencies: on `linux` with both programs configured, the composition's
 *      bundle with the configuration writer and the run directory added; on `darwin` (row N10)
 *      ONLY WITH THE macOS OPENER ADMITTED (`MACOS_MICROPHONE_OPENER_ADMITTED`, false until the M2b
 *      gate row; a test's explicit `admission`), both programs configured and the tied listing: the
 *      macOS bundle with the run directory and the product's pipe keeper; else neither - the loader
 *      then builds the `USB_AUDIO` adapter WITHOUT an opener (AM-1 (3)(h), C135: on `darwin`
 *      unadmitted no production microphone is ever recorded, so no REAL_PRODUCTION session starts);
 *   2. the camera watch, built and ATTACHED before anything else (E-03);
 *   3. the builder, with the stored registry read through `store` at the boot and after it
 *      (`reader`: a later device), the loader by a dynamic import, the card listing, the watch's
 *      check, the lock and the admission sink (C70);
 *   4. the camera adapter's report source attached to the hub, the watch listening to the hub, a
 *      heartbeat for every stored production camera; the microphone loss watch where a microphone
 *      opener exists, reading the stored microphones LIVE (a later one too);
 *   5. the malformed profile lists said once; the closing of all of it at shutdown.
 */
export async function wireProductionRegistry(parts: ProductionCaptureParts, environment: ProductionWiringEnvironment, admission?: ProductionWiringAdmission): Promise<BuiltProductionRegistry> {
  const { sinks } = environment;
  const say = (level: 'warn' | 'error', code: string, context: Record<string, string | number>, message: string): void => {
    sinks[level]({ code, ...context }, message);
    sinks.persist({ level, source: 'capture.fence', message, code, context });
  };

  // 1. The microphone, BY PLATFORM (row N10; SM-21): `linux` the Linux adapter; `darwin` the macOS one, and only with its opener
  // ADMITTED (C135 (3): the constant, or a test's explicit admission); any other platform none - never both. Not admitted on
  // `darwin`: exactly as before row N10.
  const audioParts = parts.dependencies.audio;
  let audio: ProductionMicrophoneDependencies | null = null;
  let macosAudio: ProductionMacosMicrophoneDependencies | null = null;
  let macosCards: MacosCardEnumerator | null = null;
  const macosAdmitted = parts.platform === MACOS_MICROPHONE_OPENER_PLATFORM && (MACOS_MICROPHONE_OPENER_ADMITTED || admission?.admitMacosMicrophoneOpener === true);
  if (parts.platform !== PRODUCTION_MICROPHONE_OPENER_PLATFORM && !macosAdmitted) {
    sinks.info({ code: ProductionWiringCode.MIC_OPENER_NOT_ON_THIS_PLATFORM }, 'no production microphone opener on this platform: a production microphone is listed and never recorded');
  } else if (audioParts.helperProgram === null || audioParts.guardProgram === null) {
    say('warn', ProductionWiringCode.MIC_PROGRAM_NOT_CONFIGURED, { helper: audioParts.helperProgram === null ? 'NOT_CONFIGURED' : 'CONFIGURED', guard: audioParts.guardProgram === null ? 'NOT_CONFIGURED' : 'CONFIGURED' }, 'the production microphone programs are not configured: no microphone opener is built');
  } else if (parts.platform === PRODUCTION_MICROPHONE_OPENER_PLATFORM) {
    audio = { ...audioParts, helperProgram: audioParts.helperProgram, guardProgram: audioParts.guardProgram, configWriter: createAlsaConfigWriter(environment.runDir), runDir: environment.runDir };
  } else {
    macosCards = tiedCardsOf(audioParts.cards);
    if (macosCards === null) say('warn', ProductionWiringCode.MIC_LISTING_NOT_TIED, {}, 'the card listing of this host is not the tied macOS listing: no microphone opener is built');
    else macosAudio = macosMicrophoneOf(audioParts, macosCards, audioParts.helperProgram, audioParts.guardProgram, environment.runDir, say);
  }

  // 2. The camera watch, attached before the registry exists.
  const cameraWatch = createCameraWatch({ ...parts.watches.camera, reader: productionCameraTimeReaderOf(parts.watches.camera.timers) });
  parts.attachCameraWatch(cameraWatch);

  // 3. The builder. Every member is a product dependency (static rule of row 85).
  const loaded: { adapters: ProductionAdapters | null; registry: BuiltProductionRegistry | null } = { adapters: null, registry: null };
  const operation = CaptureOperation.REAL_PRODUCTION;
  const executor = environment.store;
  const reader = environment.store;
  const dependencies: ProductionAdapterDependencies = macosAudio === null ? { camera: parts.dependencies.camera, audio } : { camera: parts.dependencies.camera, audio, macosAudio };
  const load = async (asked: CaptureOperation, devices: ProductionRegistryDevices, given: ProductionAdapterDependencies): Promise<ProductionAdapters> => {
    loaded.adapters = await (await import('../adapters/real')).loadProductionAdapters(asked, devices, given);
    return loaded.adapters;
  };
  const audioCards = (): ReturnType<CardEnumerator['list']> => parts.cards.list();
  const checkCamera = (deviceId: string, signal: AbortSignal): Promise<unknown> => cameraWatch.check(deviceId, signal);
  const { locked } = environment;
  const onAdmission = (deviceId: string, outcome: CaptureDeviceAdmission | typeof ADMISSION_FAILED, code: string | null): void => {
    if (outcome === ADMISSION_FAILED) {
      say('error', ProductionWiringCode.ADMISSION_FAILED, { deviceId, reason: code ?? 'NONE' }, 'a device registered after the boot could not be admitted: it is served after a restart');
      return;
    }
    if (outcome !== CaptureDeviceAdmission.ADMITTED) return;
    sinks.info({ code: ProductionWiringCode.ADMITTED, deviceId }, 'a device registered after the boot is served');
    // Row 85d (d): an admitted CAMERA gets its heartbeat now. A microphone is read by the loss watch at its next pass.
    if (loaded.registry?.devices().some((device) => device.id === deviceId && device.kind === 'CAMERA') === true) cameraWatch.watch(deviceId);
  };
  // A refused build stops the watch it started and goes to the caller as it is (no error is handled here: static rule G-R14).
  try {
    loaded.registry = await buildProductionRegistryOf({ operation, executor, reader, dependencies, load, audioCards, checkCamera, locked, onAdmission });
  } finally {
    if (loaded.registry === null) cameraWatch.close();
  }
  const built: BuiltProductionRegistry = loaded.registry;
  const camera = loaded.adapters?.camera;
  if (camera === undefined) throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_INVALID);

  // 4. The reports, the heartbeats, the microphone loss watch.
  const offAdapterReports = parts.relayReports.attach(camera.relayReports);
  const offWatchReports = parts.relayReports.subscribe((report) => cameraWatch.pushEstablished(report));
  const stored = built.devices();
  for (const device of stored) if (device.kind === 'CAMERA') cameraWatch.watch(device.id);
  let micWatch: MicLossWatch | null = null;
  if (audio !== null) {
    const watched = createMicLossWatch<RegisteredAudioInput>({
      ...parts.watches.microphone,
      devices: () => built.devices().filter((device) => device.kind === 'MIC').map((device) => device.id),
      identify: identifyRegisteredCard,
      isRow: isRegisteredAudioInput,
      held: () => built.openSources(),
    });
    micWatch = watched;
    parts.attachMicLossWatch(watched);
    watched.start();
  } else if (macosAudio !== null && macosCards !== null) {
    // Row N10: the loss watch of `darwin` - the macOS match over the TIED listing, and the fault of review SM-06.
    const watched = createMicLossWatch<RegisteredAudioInput>({
      ...parts.watches.microphone,
      devices: () => built.devices().filter((device) => device.kind === 'MIC').map((device) => device.id),
      ...macosLossMatchOf(macosCards, () => built.openSources(), say),
      isRow: isRegisteredAudioInput,
      held: () => built.openSources(),
    });
    micWatch = watched;
    parts.attachMicLossWatch(watched);
    watched.start();
  }

  // 5. Said once; closed at shutdown.
  const malformed = built.malformedProfiles();
  if (malformed.length > 0) say('warn', ProductionWiringCode.PROFILES_MALFORMED, { count: malformed.length, devices: malformed.join(',') }, 'stored profile lists that are not of their form: those cameras have no profile');
  sinks.info({ code: ProductionWiringCode.BUILT, cameras: stored.filter((device) => device.kind === 'CAMERA').length, microphones: stored.filter((device) => device.kind === 'MIC').length, microphoneOpener: audio !== null || macosAudio !== null }, 'the production registry is built');
  return {
    ...built,
    async closeAll(): Promise<void> {
      micWatch?.stop();
      cameraWatch.close();
      offWatchReports();
      offAdapterReports();
      await built.closeAll();
    },
  };
}

/** What the fence offers after the boot: for the session wiring (row 71), the boot checks (row 61), the selector and the clients' device shapes. */
export interface CaptureFenceControl {
  /** The decision of the one function for this app's configuration. Available at once. */
  readonly decision: CaptureOperationDecision;
  /** The capture operation of this app. Available at once; a refused configuration answers `SIMULATED`. */
  readonly operation: CaptureOperation;
  /** What the boot step decided; null until it passed. */
  outcome(): CaptureFenceOutcome | null;
  /** The device registry of the running operation; null in `SIMULATED` (no adapter is registered) and until the boot step passed. */
  registry(): CaptureDeviceRegistry | null;
  /** The local devices whose source is open now. */
  openSources(): readonly string[];
  /**
   * Row 140 (SEC35-44 (4)): `listener` is called after every change of `openSources()`. It may be
   * added before the boot step passed. A listener that throws is reported (log and error log) and
   * the others are still told. Returns the function that removes it.
   */
  onOpenSourcesChanged(listener: () => void): () => void;
  /**
   * Row 140: the adapters the reachability probe of the pre-check and of operation 97 asks
   * (`probeOfAdapters`), or null - in `SIMULATED`, in `REAL_PRODUCTION` of this phase, and until
   * the boot step passed.
   */
  probeAdapters(): CaptureProbeAdapters | null;
  /**
   * Fix wave I (finding G70b-01): a device was registered AFTER the boot (operation 96 committed
   * it). The registry of the running operation gets the adapter a boot would give that stored row,
   * so that operations 78 / 79 can assign it at once. `NOT_SERVED` in `SIMULATED`, before the boot
   * step passed, and for a kind no adapter of the operation stands behind. Opens nothing.
   */
  admitDevice(device: StoredCaptureDevice): CaptureDeviceAdmission;
  /**
   * THE DEVELOPMENT SOURCE SWITCH (fix wave M; re-check 70 finding G70d-01, ruling D232): a
   * development tool is handed the function that says which GENERATED test source answers as
   * "not there" (`generated-sources.ts`). REFUSED - `DevelopmentSourceSwitchRefusedError` - in
   * every capture operation but `REAL_DEVELOPMENT`: a production Core has no generated source and
   * never takes a switch, and a simulated Core records from nothing. It may be installed before
   * or after the boot step; the adapters ask it at every read and every open. No product code
   * calls this: the caller is the lane launcher's source rig (test support), and without a call
   * every generated source is always there. A second call replaces the first.
   */
  installDevelopmentSourceSwitch(unreachable: (deviceId: string) => boolean): void;
  /**
   * THE DOOR OF THE COMPOSITION (task 4 row 88, the lift): the parts the production registry, its
   * watches and its microphone writer are built from. Opened ONCE, by the composing file
   * (`src/capture-composition.ts`), before the boot step ran. REFUSED - `CAPTURE_ADAPTER_INVALID` -
   * in every operation but `REAL_PRODUCTION`, a second time, and after the boot step ran. Without a
   * call the boot step of `REAL_PRODUCTION` builds the empty registry (nothing recordable).
   */
  provideProductionParts(parts: ProductionCaptureParts): void;
  /**
   * SEC35-43 (d): the helper processes of an earlier run, by the exact program path. Capture must
   * not start while the answer is not an empty list (null: the process table could not be read).
   * Nothing is killed: the fence reports.
   */
  leftoverHelpers(): Promise<readonly number[] | null>;
}

/** `code` of the refusal of a development source switch outside development capture. */
export const DEV_SOURCE_SWITCH_REFUSED = 'DEV_SOURCE_SWITCH_NEEDS_DEV_SOURCES';

export class DevelopmentSourceSwitchRefusedError extends Error {
  readonly code = DEV_SOURCE_SWITCH_REFUSED;
  /** The operation that refused. */
  readonly operation: CaptureOperation;
  constructor(operation: CaptureOperation) {
    super('a development source switch is accepted in development capture only');
    this.name = 'DevelopmentSourceSwitchRefusedError';
    this.operation = operation;
  }
}

const controls = new WeakMap<object, CaptureFenceControl>();

/** The fence of an app. Available after the capture unit was registered. */
export function captureFenceControl(app: { readonly stages: object }): CaptureFenceControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the capture fence is not mounted: the capture unit registers it');
  return control;
}

export interface CaptureFenceMount {
  readonly sinks: CaptureFenceSinks;
  readonly timers: CaptureTimers;
  /** Called after the boot inserted a device row: the engine reads the registry again, so that the first development boot lists it. */
  reloadState(): Promise<void>;
  /** True while a session is open (OD-10). */
  readonly locked?: () => boolean;
  /** Test seams. Defaults: the real file-system inspector and the real process door. */
  readonly inspect?: ProgramInspector;
  readonly door?: HelperDoor;
  /** Closing pass Z1: the reader of the speech fixture's first bytes. Default: the real one (`readFileHead`). */
  readonly readHead?: FileHeadReader;
}

/** Mounts the fence on the app: the control, the boot step, the shutdown hook. Called once, by the capture unit. */
export function mountCaptureFence(app: FastifyInstance, mount: CaptureFenceMount): CaptureFenceControl {
  const decision = captureOperationDecisionOf(app.config);
  const inspect = mount.inspect ?? inspectProgram;
  const door = mount.door ?? startHelperProcess;
  const now = (): number => app.clock.now();
  let outcome: CaptureFenceOutcome | null = null;
  let built: BuiltCaptureRegistry | null = null;
  /** The development source switch (fix wave M): null until a development tool installed one. */
  let sourceSwitch: ((deviceId: string) => boolean) | null = null;
  /** Row 88: what the composition handed in for production capture; null until then (and in every other operation). */
  let productionParts: ProductionCaptureParts | null = null;
  let bootStepRan = false;
  const openListeners = new Set<() => void>();
  /** Tells every listener; one that throws is reported and never stops an open or a close of a source. */
  const openSourcesChanged = (): void =>
    tellEach(openListeners, (err) => {
      const context = { code: 'DEV_OPEN_SOURCES_LISTENER_FAILED' };
      mount.sinks.error({ ...context, err }, 'a listener of the open local sources failed');
      mount.sinks.persist({ level: 'error', source: 'capture.fence', message: 'a listener of the open local sources failed', code: context.code, context });
    });

  const control: CaptureFenceControl = {
    decision,
    operation: decision.operation,
    outcome: () => outcome,
    registry: () => built?.registry ?? null,
    openSources: () => built?.openSources() ?? Object.freeze([]),
    onOpenSourcesChanged(listener) {
      openListeners.add(listener);
      return () => {
        openListeners.delete(listener);
      };
    },
    probeAdapters: () => built?.probeAdapters() ?? null,
    admitDevice: (device) => built?.admit(device) ?? CaptureDeviceAdmission.NOT_SERVED,
    installDevelopmentSourceSwitch(unreachable) {
      if (decision.operation !== CaptureOperation.REAL_DEVELOPMENT) throw new DevelopmentSourceSwitchRefusedError(decision.operation);
      sourceSwitch = unreachable;
    },
    provideProductionParts(parts) {
      if (decision.operation !== CaptureOperation.REAL_PRODUCTION || productionParts !== null || bootStepRan) throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_INVALID);
      productionParts = parts;
    },
    async leftoverHelpers() {
      const program = outcome?.helperProgram ?? null;
      return program === null ? Object.freeze([]) : leftoverHelperPids(door, mount.timers, program);
    },
  };
  controls.set(app.stages, control);

  /** The device list of this host says whether a local device is there. It opens nothing. */
  const listed = async (deviceClass: LocalDeviceClass, program: string): Promise<boolean> => {
    const error =
      deviceClass === 'CAMERA'
        ? await createCameraHelpers({ program, now, timers: mount.timers, door, inspect }).presence('LOCAL')
        : await createMicHelper({ program, runDir: `${app.config.dataDir}/${RUN_SUBPATH}`, timers: mount.timers, door, inspect }).presence('LOCAL', LOCAL_MIC_DEVICE_NAME);
    return error === null;
  };

  app.readiness.addBootStep({
    id: CAPTURE_FENCE_BOOT_STEP,
    async run() {
      bootStepRan = true;
      const passed = await runCaptureFenceBoot({
        config: app.config,
        inUnit: (work) =>
          app.pipeline.run('capture.fence.boot', (unit) =>
            work({
              query: (text, values) => unit.query(text, values),
              async appendBootAudit(operation) {
                // SEC35-41 (b), C3 §5.2: one row per boot of a real operation, naming it (`BOOT_AUDIT_OPERATIONS`).
                // Task 4 row 209 (SX-15): the row also states WHICH KEY lay in the store, from the PUBLIC certificate alone -
                // both members null when it could not be read. Written BEFORE the boot checks judged the key (`boot-key.ts`).
                // Task 4 row V5 (C84 R-1): the row also states the signer store - how many certificates are retained, which keys
                // carry the compromise mark - and names what changed against the previous boot row of this database (a rotation,
                // a mark, a mark that disappeared): the two key commands write no audit row, so the next boot says it.
                // Task 4 row P1 (U21 (2)): a PRODUCTION row also states its host - the platform word the entry point handed to the boot
                // checks and what it means for them (`WILL_BE_ASKED` on Linux, `WILL_NOT_BE_ASKED` on macOS). The checks have not run yet.
                const previous = await unit.query<{ details: unknown }>(READ_PREVIOUS_BOOT_STATEMENT);
                // Task 4 row HC (C94 (j)): a PRODUCTION row on Linux also states whether something lies at the installed socket path of the address
                // helper - ONE look at one fixed path through the inspector the fence already holds, made only when the member is stated.
                const addressHelperSocketPresent = (): boolean => inspect(ALIAS_SOCKET_INSTALLED_PATH).exists;
                const details = systemBootDetailsOf(operation, storedBootSigningKey(app.config.dataDir), { store: storedBootSigningStore(app.config.dataDir), previous: previous.rows[0]?.details, hostPlatform: bootHostPlatformOf(app), addressHelperSocketPresent });
                await unit.audit.append({ type: 'SYSTEM_BOOT', message: 'Core started', severity: systemBootSeverityOf(details), actorId: null, deviceId: null, details });
              },
            }),
          ),
        inspect,
        now,
        readHead: mount.readHead ?? readFileHead,
        labels: { CAMERA: LOCAL_CAMERA_DEVICE_NAME, MIC: LOCAL_MIC_DEVICE_NAME },
        listed,
        sinks: mount.sinks,
      });
      if (passed.operation === CaptureOperation.REAL_DEVELOPMENT && passed.local !== null && passed.helperProgram !== null) {
        built = buildDevelopmentRegistry({
          devices: passed.devices,
          local: passed.local,
          program: passed.helperProgram,
          runDir: `${app.config.dataDir}/${RUN_SUBPATH}`,
          now,
          timers: mount.timers,
          door,
          inspect,
          ...(mount.locked === undefined ? {} : { locked: mount.locked }),
          onOpenSourcesChanged: openSourcesChanged,
          speechFixturePath: passed.fakeMic.fixturePath,
          // Read at every call: a switch installed after this boot step is asked as well. None installed: every source is there.
          sourceUnreachable: (deviceId) => sourceSwitch?.(deviceId) === true,
        });
      } else if (passed.operation === CaptureOperation.REAL_PRODUCTION) {
        // Row 88 (THE LIFT): the builder, with the parts the composition handed in. Without them: the empty registry, said once.
        const parts = productionParts;
        if (parts === null) mount.sinks.warn({ code: ProductionWiringCode.PARTS_NOT_PROVIDED }, 'no composition handed the production parts in: the production registry is empty');
        built =
          parts === null
            ? buildProductionRegistry(mount.locked)
            : await wireProductionRegistry(parts, {
                store: { query: (text, values) => app.db.read('capture.fence.production', async (pool) => pool.query(text, values === undefined ? undefined : [...values])) },
                runDir: `${app.config.dataDir}/${RUN_SUBPATH}`,
                locked: mount.locked ?? ((): boolean => false),
                sinks: mount.sinks,
              });
      }
      outcome = passed;
      if (passed.inserted.length > 0 || passed.generatedProfilesCorrected === true) await mount.reloadState();
      if (passed.helperProgram !== null) {
        const leftover = await leftoverHelperPids(door, mount.timers, passed.helperProgram);
        if (leftover === null || leftover.length > 0) {
          const context = { code: 'DEV_HELPER_LEFTOVER', count: leftover === null ? -1 : leftover.length };
          mount.sinks.warn(context, 'helper processes of an earlier run are left: capture must not start until none is');
          mount.sinks.persist({ level: 'warn', source: 'capture.fence', message: 'helper processes of an earlier run are left', code: context.code, context });
        }
      }
    },
  });

  app.addHook('onClose', async () => {
    await built?.closeAll();
  });
  return control;
}
