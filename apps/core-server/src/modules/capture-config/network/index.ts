/**
 * The camera network configuration of the Core (task 4, blueprint row 108, package WP-19d;
 * contract of row 102, operations 101 and 102; schema set B, `capture_network_config`; decisions
 * U10, U11, C55, C60 (4)).
 *
 * WHAT THIS FOLDER OWNS
 *   - the live paths of operations 101 `getCaptureNetworkConfig` and 102
 *     `updateCaptureNetworkConfig` (`routes.ts`) and what they do (`service.ts`);
 *   - the statements of the one row (`store.ts`);
 *   - THE READER OF THE NETWORK FACTS (`captureNetworkFacts(app)`, `facts.ts`): what the
 *     destination rule is handed at every judgement of a stored camera address.
 *
 * THE READER'S CONTRACT (`CaptureNetworkFactsReader` of the capture unit: `() =>
 * DestinationContext | null`). SYNCHRONOUS and asked at EVERY judgement. It joins two things:
 *   - the stored choice, HELD IN MEMORY: loaded once by the boot step of the capture-config module
 *     (`load`, before the listener opens and before the capture boot), and REPLACED by the unit
 *     that commits a change - after its commit, never for a unit that rolled back. A committed
 *     change is therefore what the next judgement reads; no other code path of the Core writes the
 *     row. Before the load, and after a load that failed (logged and persisted), it is unknown;
 *   - the interfaces of the host, READ AT EACH CALL through the reader handed in (the product's:
 *     the operating system's table). An address the host gains or loses is seen at the next call.
 * It answers null - and the rule then refuses every address - while no row is stored, while the
 * interface or the subnet is not chosen, and while the host has no such interface. It throws only
 * what the host reader throws: the binding of the rule turns that into a refusal and one line.
 *
 * NOTHING HERE CHOOSES AN INTERFACE. The technician states it; this folder compares the name with
 * the names the host states.
 *
 * WHERE A CHANGE IS ACCEPTED. On a Core in production capture only (the fence's one decision of
 * the capture operation); every other Core answers `409 COMMISSIONING_NOT_AVAILABLE` and stores
 * nothing. The read answers on every Core.
 *
 * MOUNTED by `modules/capture-config` (the unit list of `app.ts` is frozen, static rule P25; a
 * module imports no other module). `mountCaptureNetworkConfig` opens no database connection, no
 * socket and no process: `buildApp()` works without PostgreSQL.
 */
import { isSessionActive } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { captureOperationOf, type CaptureNetworkFactsReader } from '../../../capture/fence';
import { describeError } from '../../../plugins/logger';
import { networkFactsOf, readHostInterfaces, type HostInterfacesReader, type StoredNetworkChoice } from './facts';
import { registerCaptureNetworkConfigRoutes } from './routes';
import type { NetworkConfigHost, NetworkConfigSeams } from './service';
import { createNetworkConfigStore, type NetworkConfigStore } from './store';

export { cameraSubnetAccepted, factoryAddressAccepted, hostHoldsInterface, networkFactsOf, readHostInterfaces, type HostInterface, type HostInterfaceAddress, type HostInterfacesReader, type StoredNetworkChoice } from './facts';
export { CAPTURE_NETWORK_CONFIG_MODULE_OPERATIONS, captureNetworkConfigOperation, type CaptureNetworkConfigModuleOperation } from './routes';
export {
  NETWORK_CONFIG_CHANGED_MESSAGE,
  NETWORK_CONFIG_READ_LABEL,
  NETWORK_CONFIG_UNIT_LABEL,
  UNWRITTEN_REVISION,
  changeNetworkConfig,
  networkConfigOf,
  readNetworkConfig,
  type NetworkConfigCaller,
  type NetworkConfigHost,
  type NetworkConfigSeams,
  type NetworkConfigUnit,
} from './service';
export {
  CAPTURE_NETWORK_CONFIG_WRITES,
  INSERT_NETWORK_CONFIG,
  NetworkConfigRowError,
  READ_NETWORK_CONFIG,
  UPDATE_NETWORK_CONFIG,
  createNetworkConfigStore,
  type NetworkConfigStore,
  type NetworkConfigValues,
  type NetworkConfigWrite,
  type Queryable,
  type StoredNetworkConfig,
} from './store';

/** What a test may put in the place of the folder's own parts. */
export interface CaptureNetworkConfigTestParts {
  /** Whether this Core accepts a change, whatever its capture operation is. */
  readonly available?: boolean;
  /** The interfaces of the host, in the place of the operating system's table. */
  readonly interfaces?: HostInterfacesReader;
  readonly store?: NetworkConfigStore;
}

/** What this folder offers beside its routes. */
export interface CaptureNetworkConfigControl {
  /** THE READER OF THE NETWORK FACTS. One function per app; see the file header for its contract. */
  readonly facts: CaptureNetworkFactsReader;
  /**
   * Reads the stored row into the reader's memory. Called by the boot step of the capture-config
   * module. It never rejects: a read that fails is logged and persisted, and the facts stay
   * unknown (every stored camera address is refused) until a change commits or the Core restarts.
   */
  load(): Promise<void>;
  /** True once a load succeeded or a change committed. */
  loaded(): boolean;
  /** True when a change is accepted on this Core. */
  available(): boolean;
  /**
   * TWO SOURCES OF THE ALIAS LIFECYCLE (task 4 row 106b; request line `row 106`, (a) and (b)), for the composition of
   * production capture. `storedInterface`: the camera interface the reader holds in memory (the stored row as loaded or
   * as last committed), or null. `factoryList`: the stored factory addresses and the alias host, read from the ONE row
   * when asked; null for no row. Neither states a default: a Core without a row has made no alias from one.
   */
  storedInterface(): string | null;
  factoryList(): Promise<{ readonly factoryAddresses: readonly string[]; readonly aliasHost: number } | null>;
  /**
   * A TEST puts its own parts in the place of the folder's (a table of interfaces, a store whose
   * write fails, a Core that accepts a change although it is simulated). No production file calls it.
   */
  replaceForTest(parts: CaptureNetworkConfigTestParts): void;
}

interface ControlState extends CaptureNetworkConfigControl {
  stored: StoredNetworkChoice | null;
  known: boolean;
  accepts: boolean;
  interfaces: HostInterfacesReader;
  store: NetworkConfigStore;
}

// Keyed by the app's stage registry: one object per app (the `captureConfigControl(app)` idiom).
const controls = new WeakMap<object, ControlState>();

/** The controls of the camera network configuration of an app. Available once the capture-config module is registered. */
export function captureNetworkConfigControl(app: { readonly stages: object }): CaptureNetworkConfigControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the camera network configuration is not mounted: register the capture-config module before app.ready(), then call it after');
  return control;
}

/**
 * THE READER OF THE NETWORK FACTS of an app, for the composition of production capture: the
 * `network` member of `composeProductionCaptureOf`. The same function at every call.
 */
export function captureNetworkFacts(app: { readonly stages: object }): CaptureNetworkFactsReader {
  return captureNetworkConfigControl(app).facts;
}

const SOURCE = 'captureNetworkConfig';
/** The label of the read of `factoryList` (row 106b). */
export const NETWORK_FACTORY_LIST_LABEL = 'captureNetworkConfig.factoryList';
const PRODUCTION = 'REAL_PRODUCTION';
const LOAD_FAILED = 'the stored camera network configuration could not be read at boot: the network facts stay unknown and every stored camera address is refused';

/** Mounts operations 101 and 102 and the reader on the app. Called once, by the capture-config module's plugin. */
export function mountCaptureNetworkConfig(app: FastifyInstance): CaptureNetworkConfigControl {
  const codeOf = (error: unknown): string => describeError(error).code ?? describeError(error).errorName;
  const failed = (source: string, message: string, error: unknown): void => {
    const described = describeError(error);
    const code = codeOf(error);
    app.log.error({ source, code }, message);
    app.errorLog.append({ level: 'error', source, message, code, errorName: described.errorName, stackTrace: described.stackTrace, context: {} });
  };

  const control: ControlState = {
    stored: null,
    known: false,
    // The ONE decision of the capture operation (the fence's function): this folder reads no flag.
    accepts: captureOperationOf(app.config) === PRODUCTION,
    interfaces: readHostInterfaces,
    store: createNetworkConfigStore(),
    facts: () => networkFactsOf(control.stored, control.interfaces()),
    async load() {
      try {
        const row = await control.store.read({ query: (text, values) => app.db.pool.query(text, values) });
        control.stored = row === null ? null : { interfaceName: row.interfaceName, cameraSubnet: row.cameraSubnet };
        control.known = true;
        // Two facts, no value: whether a row is stored and whether both choices are made.
        app.log.info({ code: 'CAPTURE_NETWORK_CONFIG_LOADED', source: `${SOURCE}.load`, stored: row !== null, configured: row !== null && row.interfaceName !== null && row.cameraSubnet !== null }, 'camera network configuration loaded');
      } catch (error) {
        failed(`${SOURCE}.load`, LOAD_FAILED, error);
      }
    },
    loaded: () => control.known,
    available: () => control.accepts,
    storedInterface: () => control.stored?.interfaceName ?? null,
    async factoryList() {
      const row = await app.db.read(NETWORK_FACTORY_LIST_LABEL, (pool) => control.store.read({ query: (text, values) => pool.query(text, values) }));
      return row === null ? null : { factoryAddresses: row.factoryAddresses, aliasHost: row.aliasHost };
    },
    replaceForTest(parts) {
      if (parts.available !== undefined) control.accepts = parts.available;
      if (parts.interfaces !== undefined) control.interfaces = parts.interfaces;
      if (parts.store !== undefined) control.store = parts.store;
    },
  };
  controls.set(app.stages, control);

  const host: NetworkConfigHost = {
    now: () => app.clock.now(),
    // The engine's own refusal (503) when it is not running: nothing is changed on a Core that cannot store.
    sessionOpen: () => isSessionActive(app.engine.state().session),
    read: (label, work) => app.db.read(label, (pool) => work({ query: (text, values) => pool.query(text, values) })),
    async unit(label, work) {
      const outcome = await app.engine.run(label, (scope) =>
        work({
          db: { query: (text, values) => scope.unit.query(text, values) },
          sessionOpen: () => isSessionActive(scope.pending().session),
          audit: async (entry) => {
            await scope.unit.audit.append(entry);
          },
          afterCommit: (task) => scope.unit.afterCommit(task),
        }),
      );
      return outcome.value;
    },
    note: (fields, message) => app.log.info(fields, message),
    failed,
  };

  // Read at each call: a test may have put parts of its own in (`replaceForTest`).
  const seams = (): NetworkConfigSeams => ({
    host,
    store: control.store,
    available: () => control.accepts,
    interfaces: () => control.interfaces(),
    committed(stored) {
      // THE REPLACEMENT: from here on the reader answers from the row this unit committed.
      control.stored = { interfaceName: stored.interfaceName, cameraSubnet: stored.cameraSubnet };
      control.known = true;
    },
  });

  registerCaptureNetworkConfigRoutes(app, seams);
  return control;
}
