/**
 * The set-IP job of the Core (task 4 blueprint row 111, package WP-22b; contract of row 102,
 * operations 106 `setCameraNetwork` and 107 `getCameraNetworkJob`; decisions C1, C7, C78, C82,
 * U10; security requirements S13-04, S13-10, S13-11, S13-12).
 *
 * WHAT THIS FOLDER OWNS
 *   - the live paths of the two operations (`routes.ts`) and what they do (`service.ts`);
 *   - the jobs of this Core, IN MEMORY ONLY: a job is data of the operator session that started it
 *     and is gone with the process;
 *   - the DOOR through which the composition of production capture hands in everything that
 *     touches the host or the network (`captureCameraNetworkControl(app).provide`): the rules and
 *     calls of the capture unit, the alias address of the camera port, the lock-out guard of the
 *     connection tests and - when they exist - the host's own observations;
 *   - the hook that ends a running job when the app closes.
 *
 * WHAT IT DOES NOT OWN, AND HOLDS NO COPY OF
 *   - the destination rule, the set-network file and the ONVIF session (inside the capture unit);
 *   - the helper, its caller and its lifecycle (`capture/host-alias`);
 *   - the lock-out guard (`modules/capture-discovery/connect`: handed in, a module imports no module);
 *   - any socket, process or file: `mountCaptureCameraNetwork` opens none.
 *
 * UNTIL THE PARTS ARE HANDED IN - AND UNTIL THE HOST'S OBSERVATIONS ARE AMONG THEM - every job is
 * refused `409 COMMISSIONING_NOT_AVAILABLE` and nothing is asked of any address; the same on every
 * Core that is not in production capture.
 *
 * ONE TURN FOR THE COMMISSIONING FUNCTIONS: a job takes the gate of the sibling folder
 * `factory-scan` for as long as it runs, so a scan and the technician's removal of the alias
 * address (operation 105 asks that gate) are refused meanwhile, and a job is refused during a scan.
 *
 * MOUNTED by `modules/capture-config` (the unit list of `app.ts` is frozen, static rule P25; a
 * module imports no other module).
 */
import { randomInt } from 'node:crypto';
import { isSessionActive } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { createSystemTimers } from '../../../capture';
import { captureOperationOf } from '../../../capture/fence';
import { captureFactoryScanControl } from '../factory-scan';
import { captureNetworkConfigControl, createNetworkConfigStore, networkConfigOf } from '../network';
import { registerCaptureCameraNetworkRoutes } from './routes';
import {
  CAMERA_NETWORK_AUDIT_LABEL,
  CAMERA_NETWORK_REGISTERED_LABEL,
  CAMERA_NETWORK_SETTINGS_LABEL,
  createCameraNetworkJobs,
  type CameraNetworkHost,
  type CameraNetworkJobs,
  type CameraNetworkParts,
  type CameraNetworkScan,
  type CameraNetworkSeams,
} from './service';
import { readRegisteredCameraAddresses } from './store';

export { CAPTURE_CAMERA_NETWORK_MODULE_OPERATIONS, captureCameraNetworkOperation, type CaptureCameraNetworkModuleOperation } from './routes';
export {
  CAMERA_NETWORK_ASK_TIMEOUT_MS,
  CAMERA_NETWORK_AUDIT_LABEL,
  CAMERA_NETWORK_JOBS_KEPT,
  CAMERA_NETWORK_NEXT_FREE_MAX_ASKED,
  CAMERA_NETWORK_SET_DEADLINE_MS,
  CAMERA_NETWORK_SET_OPERATION_ID,
  CameraNetworkCode,
  createCameraNetworkJobs,
  holdTypedAccount,
  readCameraNetworkJob,
  startCameraNetworkJob,
  type CameraNetworkAlias,
  type CameraNetworkCamera,
  type CameraNetworkGuard,
  type CameraNetworkHost,
  type CameraNetworkInputs,
  type CameraNetworkJobs,
  type CameraNetworkParts,
  type CameraNetworkScan,
  type CameraNetworkSeams,
  type CameraNetworkSettings,
  type TypedAccount,
} from './service';
export { READ_REGISTERED_CAMERA_ADDRESSES } from './store';

/** What a test may put in the place of the folder's own parts. */
export interface CaptureCameraNetworkTestParts {
  /** Whether this Core changes a camera address at all, whatever its capture operation is. */
  readonly available?: boolean;
  /** The parts, in the place of what the composition handed in; null takes them away. */
  readonly parts?: CameraNetworkParts | null;
  /** What the last scan said, in the place of the sibling folder's memory and gate; null puts the folder's own back. */
  readonly scan?: CameraNetworkScan | null;
  /** A host of the test's own (a clock that jumps, for example). */
  readonly host?: Partial<CameraNetworkHost>;
}

/** What this folder offers beside its routes. */
export interface CaptureCameraNetworkControl {
  /**
   * THE DOOR OF THE COMPOSITION. Once per app; a second call throws. No production file but the
   * composition of production capture calls it.
   */
  provide(parts: CameraNetworkParts): void;
  /** True once the parts were handed in. */
  provided(): boolean;
  /** True when a job is accepted on this Core (production capture). */
  available(): boolean;
  /** Resolves when no job runs: a test waits for the end of a job with it. */
  idle(): Promise<void>;
  /** A TEST puts its own parts in the place of the folder's. No production file calls it. */
  replaceForTest(parts: CaptureCameraNetworkTestParts): void;
}

interface ControlState extends CaptureCameraNetworkControl {
  parts: CameraNetworkParts | null;
  accepts: boolean;
  scan: CameraNetworkScan;
  host: CameraNetworkHost;
  readonly jobs: CameraNetworkJobs;
}

// Keyed by the app's stage registry: one object per app (the `captureConfigControl(app)` idiom).
const controls = new WeakMap<object, ControlState>();

/** The controls of the set-IP job of an app. Available once the capture-config module is registered. */
export function captureCameraNetworkControl(app: { readonly stages: object }): CaptureCameraNetworkControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the set-IP job is not mounted: register the capture-config module before app.ready(), then call it after');
  return control;
}

const PRODUCTION = 'REAL_PRODUCTION';

/** Mounts operations 106 and 107, the door of the composition and the closing hook on the app. Called once, by the capture-config module's plugin, after the mounts of `network` and `factory-scan`. */
export function mountCaptureCameraNetwork(app: FastifyInstance): CaptureCameraNetworkControl {
  const timers = createSystemTimers();
  const store = createNetworkConfigStore();
  const host: CameraNetworkHost = {
    now: () => app.clock.now(),
    // The engine's own refusal (503) when it is not running: no camera is changed on a Core that cannot write its entry.
    sessionOpen: () => isSessionActive(app.engine.state().session),
    async settings() {
      const settings = networkConfigOf(await app.db.read(CAMERA_NETWORK_SETTINGS_LABEL, (pool) => store.read({ query: (text, values) => pool.query(text, values) })));
      return { configured: settings.configured, aliasHost: settings.aliasHost, aliasMinutes: settings.aliasMinutes, cameraIpStart: settings.cameraIpStart };
    },
    // The reader of row 108, asked at each judgement: the stored choice joined with the interfaces the host states NOW.
    facts: () => captureNetworkConfigControl(app).facts(),
    registeredAddresses: () => app.db.read(CAMERA_NETWORK_REGISTERED_LABEL, (pool) => readRegisteredCameraAddresses({ query: (text, values) => pool.query(text, values) })),
    async audit(entry) {
      await app.engine.run(CAMERA_NETWORK_AUDIT_LABEL, async (scope) => {
        await scope.unit.audit.append(entry);
      });
    },
    after: (delayMs, callback) => timers.after(delayMs, callback),
    note: (fields, message) => app.log.info(fields, message),
    failed(source, message, code, context) {
      // A fixed message, a code and counts. Nothing that was thrown, nothing a device said and nothing typed is handed in here.
      app.log.error({ source, code }, message);
      app.errorLog.append({ level: 'error', source, message, code, context: { ...context } });
    },
  };

  // The sibling folder's gate and memory, asked at each job.
  const ownScan: CameraNetworkScan = { claim: () => captureFactoryScanControl(app).claim(), lastScanOf: (address) => captureFactoryScanControl(app).lastScanOf(address) };
  const control: ControlState = {
    parts: null,
    // The ONE decision of the capture operation (the fence's function): this folder reads no flag.
    accepts: captureOperationOf(app.config) === PRODUCTION,
    scan: ownScan,
    host,
    // The six digits of a job id begin at a number nobody can foresee; an id means nothing outside the session that got it.
    jobs: createCameraNetworkJobs(randomInt(1_000_000)),
    provide(parts) {
      if (control.parts !== null) throw new Error('the parts of the set-IP job were provided twice');
      control.parts = parts;
    },
    provided: () => control.parts !== null,
    available: () => control.accepts,
    idle: () => control.jobs.idle(),
    replaceForTest(parts) {
      if (parts.available !== undefined) control.accepts = parts.available;
      if (parts.parts !== undefined) control.parts = parts.parts;
      if (parts.scan !== undefined) control.scan = parts.scan ?? ownScan;
      if (parts.host !== undefined) control.host = { ...control.host, ...parts.host };
    },
  };
  controls.set(app.stages, control);

  // Read at each call: the composition hands the parts in after `ready()`, and a test may have put its own in.
  const seams = (): CameraNetworkSeams => ({ host: control.host, scan: control.scan, jobs: control.jobs, available: () => control.accepts, parts: () => control.parts });
  registerCaptureCameraNetworkRoutes(app, seams);

  // THE CLOSE OF THE APP: a running job is ended (`CORE_RESTARTED`), lets go of what was typed and asks its alias
  // address away. A job never rejects; what it could not take away stays an open row for the next boot's sweep.
  app.addHook('preClose', async () => {
    control.jobs.stop();
    await control.jobs.idle();
  });
  return control;
}
