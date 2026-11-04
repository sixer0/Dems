/**
 * Capture-config module (blueprint row 52 / M2-W10; register NM-09, CS-23, CS-06 read half,
 * SH-04, E-04; C3 §2.4, §3, §6; specs §E.6).
 *
 * WHAT THIS MODULE OWNS.
 *   - the STORE of the two capture slices (`store.ts`): the selector (`capture_config`, T-31) and
 *     the capture-device registry (`capture_devices`, T-32) read into slices 29 and 30 in their
 *     wire form (`slices.ts`); their own slice kind, never the paired-client registry (E-04);
 *   - the BOOT of that store (`boot.ts`, step `capture.config`): the slices exist before the
 *     listener opens; an invalid row set stops the start, an unseeded selector table loads the
 *     built-in baseline and says so loudly (NM-09 "store/slices boot");
 *   - the READING of the two capture modes (`fencing.ts`): Simulated versus real capture, what
 *     each refuses, and the two machine codes of the demo fence (`403 DEMO_DISABLED` for ops 71 to
 *     74, `409 RESET_BLOCKED_REAL_EVIDENCE` for op 75; OD-18, OD-19). The refusals themselves are
 *     enforced where they already live: stage 6 for the flag, row 54's guard for the reset.
 *
 * THE LIVE PATHS (blueprint row 66 / M4-W2; `routes.ts`). Operations 76 to 80 are registered
 * here: the two reads answer from the engine's committed state, the three edits are one unit of
 * the engine each, in which the hosted action `setCaptureConfig` runs under the caller's identity;
 * an edit while a session is open answers `409 CAPTURE_CONFIG_LOCKED` with no audit row (OD-10).
 * The two slices are replicated slices of the engine's state, so the engine publishes them; the
 * store above stays what the boot step validates the stored rows with, before the listener opens.
 *
 * THE `CapturePlan` BUILDER (`plan.ts`): a pure function from the selector and the adapter
 * registry to the payload of `START`; the session start (row 71) calls it.
 *
 * WHAT THIS MODULE DOES NOT DO. Operation 89 (the credential write) is not registered: it needs
 * the credential store's sealer (row 84) and the access condition `WEB_CONSOLE_SESSION`, which
 * the contract registry does not hold yet (rows 132 / 142). No adapter registry is built here:
 * the wiring that knows the capture operation (rows 61 / 71 / 136) provides one through
 * `captureConfigControl(app).provideDeviceRegistry`; until then no assignment is refused by
 * source class. It is REGISTERED by `app.ts` since blueprint row 57 (the OD-14 waiver of P25;
 * capture spec §I edits 1 and 5): its boot step runs at every start of the server, after the
 * steps of the units registered before it.
 *
 * THE CAMERA NETWORK CONFIGURATION (task 4 row 108; `./network`): operations 101 and 102 and the
 * reader of the network facts for the destination rule are a folder of this module, mounted here
 * (the unit list of `app.ts` is frozen; a module imports no other module). The boot step below
 * loads the stored row into that reader after the selector and the registry.
 *
 * THE COMMISSIONING SCAN (task 4 row 107; `./factory-scan`): operation 103 is a folder of this
 * module for the same reason, mounted here after `network`, whose settings and facts it reads.
 *
 * THE ALIAS STATE AND ITS REMOVAL (task 4 row 106b; `./host-alias`): operations 104 and 105, the
 * door of the alias lifecycle and its shutdown hook, mounted here after `factory-scan`.
 *
 * THE SET-IP JOB (task 4 row 111; `./camera-network`): operations 106 and 107, mounted here after
 * `factory-scan` (whose gate and last answer it asks) and BEFORE `host-alias`, so that at the close
 * of the app a running job ends and asks its alias address away before the lifecycle's own hook.
 *
 * THE INSTALLATION ACCEPTANCE (task 4 row 117; `./installation-acceptance`): operations 109 and
 * 110 are a folder of this module for the same reason. It offers no reader: nothing gates on it.
 *
 * The plugin function opens no database connection: `buildApp()` works without PostgreSQL.
 */
import type { FastifyPluginAsync } from 'fastify';
import { captureFenceControl } from '../../capture/fence';
import { CAPTURE_CONFIG_BOOT_STEP, runCaptureConfigBoot } from './boot';
import { mountCaptureCameraNetwork } from './camera-network';
import { mountCaptureFactoryScan } from './factory-scan';
import { mountCaptureHostAlias } from './host-alias';
import { mountInstallationAcceptance } from './installation-acceptance';
import { mountCaptureNetworkConfig } from './network';
import { registerCaptureConfigRoutes, type AssignmentRegistry } from './routes';
import { createCaptureConfigStore, type CaptureConfigStore, type CaptureSnapshot } from './store';

export { CAPTURE_CONFIG_BOOT_STEP, runCaptureConfigBoot, type CaptureBootSinks } from './boot';
export { CaptureMode, DemoState, captureModeOf, demoFencingOf, type DemoFencing } from './fencing';
export {
  baselineCaptureConfig,
  baselineCaptureDevices,
  captureConfigSliceOf,
  captureDevicesSliceOf,
  CaptureSliceError,
  type CaptureConfigRecord,
  type CaptureDeviceRecord,
} from './slices';
export {
  CapturePlanError,
  CapturePlanReason,
  CapturePlanRefusal,
  MIC_CHANNEL_IDS,
  assertRecordableSelector,
  buildCapturePlan,
  capturePlanConstants,
  capturePlanSubjects,
  type CapturePlanCameraSource,
  type CapturePlanInput,
  type CapturePlanMicSource,
  type CapturePlanRegistry,
  type CapturePlanSelector,
  type MicChannelId,
  type RecordableSelector,
  type RecordableSlot,
} from './plan';
export {
  CAPTURE_CONFIG_MODULE_OPERATIONS,
  CaptureAssignmentRefusal,
  DEVELOPMENT_SOURCE_NOT_ALLOWED,
  captureAssignmentRefusalOf,
  captureConfigAnswer,
  captureConfigLocked,
  captureConfigOperation,
  type AssignmentRegistry,
  type CaptureConfigModuleOperation,
} from './routes';
export { createCaptureConfigStore, READ_CAPTURE_STATE, type CaptureConfigStore, type CaptureSnapshot, type CaptureStateRow, type CaptureStoreReader } from './store';
// The camera network configuration (task 4 row 108): its control, and the reader the composition of production capture is handed.
export { captureNetworkConfigControl, captureNetworkFacts, type CaptureNetworkConfigControl, type HostInterface, type HostInterfacesReader } from './network';
// The commissioning scan (task 4 row 107): its control, with the door the composition of production capture hands the scan's parts through.
export { captureFactoryScanControl, type CaptureFactoryScanControl, type FactoryScanAlias, type FactoryScanParts, type FactoryScanProbe, type FactoryScanRule } from './factory-scan';
// The alias state and the technician's removal (task 4 row 106b, operations 104 and 105): its control, with the door the composition hands the alias lifecycle through.
export { captureHostAliasControl, type CaptureHostAliasControl, type HostAliasRemover } from './host-alias';
// The set-IP job (task 4 row 111, operations 106 and 107): its control, with the door the composition of production capture hands the job's parts through.
export { captureCameraNetworkControl, type CameraNetworkParts, type CaptureCameraNetworkControl } from './camera-network';
// The installation acceptance (task 4 row 117, operations 109 and 110): its control is a door for its tests only.
export { installationAcceptanceControl, type InstallationAcceptanceControl } from './installation-acceptance';

/** What this module offers beside its boot step: for its tests and for the rows that mount it. */
export interface CaptureConfigControl {
  /** The store this app owns. Loaded by the boot step; `snapshot()` throws before that. */
  readonly store: CaptureConfigStore;
  /** What the boot step loaded, by reference. The reads of operations 76 and 77 answer from the engine's committed state, not from here. */
  snapshot(): CaptureSnapshot;
  /**
   * Gives the module the device registry of the adapter layer (capture spec §A.1.1): from then on
   * an edit that ASSIGNS a device asks rule RG-3 (`assertAssignable`) first. Called once, by the
   * wiring that builds the registry for the running capture operation (rows 61 / 71 / 136). A
   * second call is a mistake of that wiring and throws.
   */
  provideDeviceRegistry(registry: AssignmentRegistry): void;
  /** True once a registry was provided. */
  hasDeviceRegistry(): boolean;
}

// Keyed by the app's stage registry: one object per app, the same from every scope of it
// (the `permissionGuard(app)` / `demoControl(app)` idiom).
const controls = new WeakMap<object, CaptureConfigControl>();

/** The module's controls of an app. Available after `ready()`. */
export function captureConfigControl(app: { readonly stages: object }): CaptureConfigControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the capture-config module is not loaded: register it before app.ready(), then call it after');
  return control;
}

export const captureConfigModule: FastifyPluginAsync = async (app) => {
  const store = createCaptureConfigStore();
  let deviceRegistry: AssignmentRegistry | null = null;
  controls.set(app.stages, {
    store,
    snapshot: () => store.snapshot(),
    provideDeviceRegistry(registry) {
      if (deviceRegistry !== null) throw new Error('the capture device registry was provided twice');
      deviceRegistry = registry;
    },
    hasDeviceRegistry: () => deviceRegistry !== null,
  });

  // Operations 76 to 80 (row 66). The registry is read at every edit: it is provided after `ready()`.
  registerCaptureConfigRoutes(app, { deviceRegistry: () => deviceRegistry });
  // Operations 101 and 102 and the reader of the network facts (task 4 row 108).
  const network = mountCaptureNetworkConfig(app);
  // Operation 103, the commissioning scan (task 4 row 107). It reads the settings and the facts of the mount above.
  mountCaptureFactoryScan(app);
  // Operations 106 and 107, the set-IP job (task 4 row 111). It asks the gate and the last answer of the mount above; its closing hook runs before the alias lifecycle's.
  mountCaptureCameraNetwork(app);
  // Operations 104 and 105, the alias state and its removal by the technician, and the shutdown hook of the alias lifecycle (task 4 row 106b).
  mountCaptureHostAlias(app);
  // Operations 109 and 110, the installation acceptance and its revocation (task 4 row 117). It reads nothing of the mounts above and gates nothing.
  mountInstallationAcceptance(app);

  app.readiness.addBootStep({
    id: CAPTURE_CONFIG_BOOT_STEP,
    async run() {
      // A failure is logged and persisted by the runner, with its code and the identifiers it may
      // name; a pass is the readiness plugin's line "boot step passed".
      await runCaptureConfigBoot(store, app.db.pool, {
        info: (fields, message) => app.log.info(fields, message),
        warn: (fields, message) => app.log.warn(fields, message),
        error: (fields, message) => app.log.error(fields, message),
        persist: (entry) => app.errorLog.append(entry),
      });
      // Rule RG-3 for operations 78 / 79 (row 136, decision D115 (3); integration pass C1): the
      // registry of the running capture operation, built by the step `capture.fence` before this
      // one. Null in SIMULATED (no adapter is registered): no assignment is refused by source class.
      const registry = captureFenceControl(app).registry();
      if (registry !== null && deviceRegistry === null) deviceRegistry = registry;
      // The stored network choice into the reader of the network facts (row 108). It never rejects: a failed read is
      // logged and persisted there, and every stored camera address stays refused.
      await network.load();
    },
  });
};
