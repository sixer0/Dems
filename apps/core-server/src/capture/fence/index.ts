/**
 * The capture fence (blueprint row 136, R-11; capture spec §A.1.1, §A.1.2, §A.6.4, §A.7.1; `dbc-4`
 * §N.2, §N.3, §N.9; SEC35-40, SEC35-41, SEC35-43; decisions D74, D82(e), D83, D86 C-5, D91, D108).
 *
 * WHAT IT OWNS.
 *   - `operation.ts`  THE one definition of the capture operation (`SIMULATED` | `REAL_PRODUCTION`
 *                     | `REAL_DEVELOPMENT`) and the only reader of the development flag;
 *   - `boot.ts`       the boot step `capture.fence`: the refusals of the allowed-combinations
 *                     table, the helper-program rule, the boot audit row;
 *   - `registration.ts`, `statements.ts`  this Mac's camera and microphone as NEW device rows of
 *                     kind `LOCAL_DEVICE`, in `REAL_DEVELOPMENT` only;
 *   - `generated-sources.ts`  the development test sources (kind `FAKE`) that feed the worker;
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
import { CaptureAdapterKind, CaptureOperation } from '../adapters/kinds';
import { createFakePoeController } from '../adapters/fake';
import { createCaptureDeviceRegistry } from '../adapters/registry';
import type { AudioInputAdapter, CameraAdapter, CaptureAdapter, CaptureDeviceRegistry } from '../adapters/types';
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
  startHelperProcess,
  type HelperDoor,
  type LocalSourceError,
  type ProgramInspector,
} from '../adapters/local';
import { CAPTURE_FENCE_BOOT_STEP, runCaptureFenceBoot, type CaptureFenceOutcome, type CaptureFenceSinks } from './boot';
import { createGeneratedCameraAdapter, createGeneratedMicAdapter } from './generated-sources';
import { captureOperationDecisionOf, type CaptureOperationDecision } from './operation';
import type { LocalDeviceClass, StoredCaptureDevice } from './registration';
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
export { createGeneratedCameraAdapter, createGeneratedMicAdapter, type GeneratedCameraAdapter, type GeneratedCameraOptions, type GeneratedMicAdapter, type GeneratedMicOptions } from './generated-sources';
export { CaptureFlagRefusal, captureOperationDecisionOf, captureOperationOf, type CaptureOperationDecision, type CaptureOperationInput } from './operation';
export { LOCAL_DEVICE_ROWS, readStoredDevices, registerLocalDevices, type FenceExecutor, type LocalDeviceClass, type LocalDeviceRegistration, type StoredCaptureDevice } from './registration';
export {
  CAPTURE_SOURCE_SLOTS,
  DevelopmentSourceLabel,
  assertOperationRecordable,
  assertSessionSourcesOfOperation,
  buildSessionCaptureSources,
  developmentSourceLabelOf,
  deviceSourceFieldsOf,
  storedDeviceListingOf,
  type CaptureSourceSlot,
  type DeviceSourceFields,
  type RecordedSlot,
  type SessionCaptureSource,
  type SessionCaptureSourcesInput,
} from './sources';
export { CAPTURE_FENCE_WRITES, READ_ASSIGNED_SOURCES, READ_STORED_DEVICES, REGISTER_LOCAL_DEVICE } from './statements';

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
  /** The adapters the reachability probe asks; null when the operation registers none. */
  probeAdapters(): CaptureProbeAdapters | null;
  /** Stops every helper and removes every pipe. */
  closeAll(): Promise<void>;
}

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
  const fakes = input.devices.filter((device) => device.adapterKind === CaptureAdapterKind.FAKE);
  for (const device of fakes) {
    const label = device.model ?? device.id;
    if (device.kind === 'CAMERA') {
      const generated = createGeneratedCameraAdapter({ ...shared, id: device.id, label, now: input.now });
      adapters.push(generated);
      cameraAdapters.push(generated);
      closers.push(() => generated.closeAll());
    } else if (device.kind === 'MIC') {
      // The first fake microphone sounds 440 Hz, every other one 880 Hz: two test tones a listener can tell apart.
      const tone = device.id === fakes.find((other) => other.kind === 'MIC')?.id ? MicGeneratedTone.TONE_440 : MicGeneratedTone.TONE_880;
      const generated = createGeneratedMicAdapter({ ...shared, id: device.id, label, runDir: input.runDir, tone });
      adapters.push(generated);
      micAdapters.push(generated);
      closers.push(() => generated.closeAll());
    } else {
      adapters.push(createFakePoeController({ id: device.id, label, ports: [], capabilities: ['SNMP'] }));
    }
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
    closeAll: async () => {
      await Promise.all(closers.map((close) => close()));
    },
  };
}

/**
 * The registry of `REAL_PRODUCTION` in this phase: NO adapter. The production kinds are class C
 * (no opener); their loader is not called here, so that nothing of class C is evaluated. Every
 * assignment is refused by the registry (unknown to it), and every plan by the plan builder
 * (`SOURCE_KIND_NOT_RECORDABLE`): search, test, adoption and assignment of a production camera are
 * the discovery rows', which register that half when they land.
 */
export function buildProductionRegistry(locked?: () => boolean): BuiltCaptureRegistry {
  const registry = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION, ...(locked === undefined ? {} : { locked }) });
  return { registry, openSources: () => Object.freeze([]), probeAdapters: () => null, closeAll: async () => {} };
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
   * SEC35-43 (d): the helper processes of an earlier run, by the exact program path. Capture must
   * not start while the answer is not an empty list (null: the process table could not be read).
   * Nothing is killed: the fence reports.
   */
  leftoverHelpers(): Promise<readonly number[] | null>;
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
}

/** Mounts the fence on the app: the control, the boot step, the shutdown hook. Called once, by the capture unit. */
export function mountCaptureFence(app: FastifyInstance, mount: CaptureFenceMount): CaptureFenceControl {
  const decision = captureOperationDecisionOf(app.config);
  const inspect = mount.inspect ?? inspectProgram;
  const door = mount.door ?? startHelperProcess;
  const now = (): number => app.clock.now();
  let outcome: CaptureFenceOutcome | null = null;
  let built: BuiltCaptureRegistry | null = null;
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
      const passed = await runCaptureFenceBoot({
        config: app.config,
        inUnit: (work) =>
          app.pipeline.run('capture.fence.boot', (unit) =>
            work({
              query: (text, values) => unit.query(text, values),
              async appendBootAudit(operation) {
                // SEC35-41 (b), C3 §5.2: one row per boot of a real operation, naming it (`BOOT_AUDIT_OPERATIONS`).
                await unit.audit.append({ type: 'SYSTEM_BOOT', message: 'Core started', actorId: null, deviceId: null, details: { captureOperation: operation } });
              },
            }),
          ),
        inspect,
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
        });
      } else if (passed.operation === CaptureOperation.REAL_PRODUCTION) {
        built = buildProductionRegistry(mount.locked);
      }
      outcome = passed;
      if (passed.inserted.length > 0) await mount.reloadState();
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
