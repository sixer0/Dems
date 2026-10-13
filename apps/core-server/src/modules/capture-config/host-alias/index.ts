/**
 * The alias state and the technician's removal (task 4 row 106b; contract of row 102, operations
 * 104 `getHostAlias` and 105 `removeHostAlias`; decisions C19, C74, U10; security item S13-10).
 *
 * WHAT THIS FOLDER OWNS
 *   - the live paths of operations 104 and 105 (`routes.ts`) and what they do (`service.ts`);
 *   - the DOOR through which the composition of production capture hands in the ONE alias
 *     lifecycle of the app (`captureHostAliasControl(app).provide`);
 *   - THE SHUTDOWN HOOK of that lifecycle: a `preClose` hook of the app, registered here at mount
 *     (a hook cannot be added once the app is ready, and the composition runs after `ready()`).
 *     With a lifecycle handed in, the close of the app asks it to take the alias away; without
 *     one the hook does nothing.
 *
 * WHAT IT DOES NOT OWN, AND HOLDS NO COPY OF
 *   - the lifecycle, its journal, its store and the helper's caller (`capture/host-alias`, inside
 *     the closed capture unit; reached through the fence's index) and the helper's socket
 *     (`src/host-alias-socket.ts`): this folder opens no socket, starts no process, reads no file.
 *
 * OPERATION 104 answers on every Core: it is a plain read of the journal's one open row, with the
 * Core's own read on the pool. UNTIL A LIFECYCLE IS HANDED IN, and on every Core that is not in
 * production capture, operation 105 answers `409 COMMISSIONING_NOT_AVAILABLE`.
 *
 * MOUNTED by `modules/capture-config` after `factory-scan` (the unit list of `app.ts` is frozen,
 * static rule P25; a module imports no other module): "a scan runs" is asked of that folder.
 */
import { isSessionActive } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { captureOperationOf, readHostAliasState } from '../../../capture/fence';
import { captureFactoryScanControl } from '../factory-scan';
import { registerCaptureHostAliasRoutes } from './routes';
import type { HostAliasRemover, HostAliasRouteSeams } from './service';

export { CAPTURE_HOST_ALIAS_MODULE_OPERATIONS, captureHostAliasOperation, type CaptureHostAliasModuleOperation } from './routes';
export {
  ALIAS_REFUSED_SESSION,
  ALIAS_REMOVAL_CAUSE_UNNAMED,
  HOST_ALIAS_REMOVE_OPERATION_ID,
  readHostAlias,
  removeHostAlias,
  type HostAliasRemoval,
  type HostAliasRemover,
  type HostAliasRouteCaller,
  type HostAliasRouteSeams,
} from './service';

/** What a test may put in the place of the folder's own parts. */
export interface CaptureHostAliasTestParts {
  /** Whether this Core removes at all, whatever its capture operation is. */
  readonly available?: boolean;
  /** A lifecycle, in the place of what the composition handed in; null takes it away. */
  readonly remover?: HostAliasRemover | null;
}

/** What this folder offers beside its routes. */
export interface CaptureHostAliasControl {
  /**
   * THE DOOR OF THE COMPOSITION: the one alias lifecycle of the app. Once per app; a second call
   * throws. No production file but the composition of production capture calls it.
   */
  provide(lifecycle: HostAliasRemover): void;
  /** True once a lifecycle was handed in. */
  provided(): boolean;
  /** True when a removal is accepted on this Core (production capture). */
  available(): boolean;
  /** A TEST puts its own parts in the place of the folder's. No production file calls it. */
  replaceForTest(parts: CaptureHostAliasTestParts): void;
}

interface ControlState extends CaptureHostAliasControl {
  remover: HostAliasRemover | null;
  accepts: boolean;
}

// Keyed by the app's stage registry: one object per app (the `captureConfigControl(app)` idiom).
const controls = new WeakMap<object, ControlState>();

/** The controls of the alias routes of an app. Available once the capture-config module is registered. */
export function captureHostAliasControl(app: { readonly stages: object }): CaptureHostAliasControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the alias routes are not mounted: register the capture-config module before app.ready(), then call it after');
  return control;
}

const PRODUCTION = 'REAL_PRODUCTION';
export const HOST_ALIAS_STATE_LABEL = 'captureHostAlias.state';

/** Mounts operations 104 and 105, the door of the composition and the shutdown hook on the app. Called once, by the capture-config module's plugin, after the mount of `factory-scan`. */
export function mountCaptureHostAlias(app: FastifyInstance): CaptureHostAliasControl {
  const control: ControlState = {
    remover: null,
    // The ONE decision of the capture operation (the fence's function): this folder reads no flag.
    accepts: captureOperationOf(app.config) === PRODUCTION,
    provide(lifecycle) {
      if (control.remover !== null) throw new Error('the alias lifecycle was provided twice');
      control.remover = lifecycle;
    },
    provided: () => control.remover !== null,
    available: () => control.accepts,
    replaceForTest(parts) {
      if (parts.available !== undefined) control.accepts = parts.available;
      if (parts.remover !== undefined) control.remover = parts.remover;
    },
  };
  controls.set(app.stages, control);

  // Read at each call: the composition hands the lifecycle in after `ready()`, and a test may have put its own in.
  const seams = (): HostAliasRouteSeams => ({
    // The engine's own refusal (503) when it is not running.
    sessionOpen: () => isSessionActive(app.engine.state().session),
    // The plain read: the statement and the row's reading are the capture unit's; the connection is the Core's read on the pool.
    state: () => readHostAliasState({ read: (_label, work) => app.db.read(HOST_ALIAS_STATE_LABEL, (pool) => work({ query: (text, values) => pool.query(text, values) })) }),
    available: () => control.accepts,
    remover: () => control.remover,
    jobRunning: () => captureFactoryScanControl(app).busy(),
  });
  registerCaptureHostAliasRoutes(app, seams);

  // THE SHUTDOWN: the lifecycle never rejects; what it could not take away stays an open row for the next boot's sweep.
  app.addHook('preClose', async () => {
    await control.remover?.shutdown();
  });
  return control;
}
