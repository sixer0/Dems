/**
 * The commissioning scan of the Core (task 4, blueprint row 107, package WP-19c; contract of row
 * 102, operation 103 `scanFactoryCameras`; decisions U9, U10, C19; security requirements S13-10,
 * S13-11, S13-12 (b)).
 *
 * WHAT THIS FOLDER OWNS
 *   - the live path of operation 103 (`routes.ts`) and what it does (`service.ts`);
 *   - the DOOR through which the composition of production capture hands in everything that
 *     touches the host or the network (`captureFactoryScanControl(app).provide`): the destination
 *     rule bound to the purpose of a commissioning scan, the temporary address of the camera port
 *     (rows 105 and 106) and the scan's own probe call.
 *
 * WHAT IT DOES NOT OWN, AND HOLDS NO COPY OF
 *   - the destination rule (`capture/destination-rule.ts`, inside the closed capture unit);
 *   - the helper, its caller and its lifecycle (`capture/host-alias`, `src/host-alias-socket.ts`);
 *   - any socket, process or file: `mountCaptureFactoryScan` opens none, and neither does a scan
 *     of this folder - the probe is a function handed in.
 *
 * UNTIL THE PARTS ARE HANDED IN every scan answers `409 COMMISSIONING_NOT_AVAILABLE` and nothing
 * is asked of any address; the same on every Core that is not in production capture.
 *
 * THE SETTINGS are the one row of `capture_network_config`, read at each scan through the store of
 * the sibling folder `network`; THE FACTS OF THE HOST are that folder's reader, asked at each
 * judgement. Nothing is kept between two scans but the gate: "a scan runs" and when the last began.
 *
 * MOUNTED by `modules/capture-config` (the unit list of `app.ts` is frozen, static rule P25; a
 * module imports no other module).
 */
import { FactoryCameraDeviceCount, type CameraFactoryScan } from '@dems/shared/api';
import { isSessionActive } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { createSystemTimers } from '../../../capture';
import { captureOperationOf } from '../../../capture/fence';
import { captureNetworkConfigControl, createNetworkConfigStore, networkConfigOf } from '../network';
import { registerCaptureFactoryScanRoutes } from './routes';
import { FACTORY_SCAN_AUDIT_LABEL, FACTORY_SCAN_SETTINGS_LABEL, createFactoryScanGate, type FactoryScanGate, type FactoryScanHost, type FactoryScanParts, type FactoryScanSeams } from './service';

export { CAPTURE_FACTORY_SCAN_MODULE_OPERATIONS, captureFactoryScanOperation, type CaptureFactoryScanModuleOperation } from './routes';
export {
  FACTORY_SCANNED_MESSAGE,
  FACTORY_SCAN_AUDIT_LABEL,
  FACTORY_SCAN_MAX_ENDPOINTS,
  FACTORY_SCAN_MIN_INTERVAL_MS,
  FACTORY_SCAN_OPERATION_ID,
  FACTORY_SCAN_PARALLEL_PROBES,
  FACTORY_SCAN_PROBE_TIMEOUT_MS,
  FACTORY_SCAN_SETTINGS_LABEL,
  FactoryScanAliasCause,
  FactoryScanCode,
  announcedTextOf,
  createFactoryScanGate,
  scanFactoryCameras,
  type FactoryScanAlias,
  type FactoryScanAliasOutcome,
  type FactoryScanAliasSubject,
  type FactoryScanCaller,
  type FactoryScanDestination,
  type FactoryScanGate,
  type FactoryScanHost,
  type FactoryScanParts,
  type FactoryScanProbe,
  type FactoryScanProbeAnswer,
  type FactoryScanRule,
  type FactoryScanRuleDecision,
  type FactoryScanSeams,
  type FactoryScanSettings,
} from './service';

/** What a test may put in the place of the folder's own parts. */
export interface CaptureFactoryScanTestParts {
  /** Whether this Core scans at all, whatever its capture operation is. */
  readonly available?: boolean;
  /** The parts, in the place of what the composition handed in; null takes them away. */
  readonly parts?: FactoryScanParts | null;
  /** A gate of the test's own (a spacing of 0, for example). */
  readonly gate?: FactoryScanGate;
  /**
   * A probe of the test's own IN THE PLACE OF the handed-in one, every other part kept as the
   * composition handed it in (task 4 row 111b): so a test scans with the composition's rule, alias
   * port and neighbour table while NOTHING is dialled. Without handed-in parts it does nothing.
   */
  readonly probe?: FactoryScanParts['probe'];
}

/**
 * What the last scan said of ONE address, for the set-network job (cautions R119-03 and R119-04 of
 * the security review of row 119): what it KNEW of the number of devices there (`NOT_KNOWN` is its
 * own state, never "one"), the hardware address its row showed the technician (null: none), and
 * when that scan began - a statement has an age, and the job refuses an old one.
 */
export interface LastScanStatement {
  readonly deviceCount: FactoryCameraDeviceCount;
  readonly mac: string | null;
  readonly scannedAt: number;
}

/** What this folder offers beside its route. */
export interface CaptureFactoryScanControl {
  /**
   * THE DOOR OF THE COMPOSITION: the rule, the temporary address and the probe. Once per app; a
   * second call throws. No production file but the composition of production capture calls it.
   */
  provide(parts: FactoryScanParts): void;
  /** True once the parts were handed in. */
  provided(): boolean;
  /** True when a scan is accepted on this Core (production capture). */
  available(): boolean;
  /** True while a scan runs: the set-network job (row 111) asks before it starts. */
  busy(): boolean;
  /**
   * THE ONE TURN of the commissioning functions of a Core (task 4 row 111; S13-11 point 4: one job
   * and one scan at a time): the set-network job takes the scan's own gate for as long as it runs,
   * so a scan and the technician's removal of the alias are refused meanwhile. The release
   * function, or null while a scan or a job runs. It starts no spacing.
   */
  claim(): (() => void) | null;
  /** What the last scan that ended with an answer said of an address (design rule DR-6), or null: no such scan, or the address was not among its devices. In memory only. */
  lastScanOf(address: string): LastScanStatement | null;
  /** A TEST puts its own parts in the place of the folder's. No production file calls it. */
  replaceForTest(parts: CaptureFactoryScanTestParts): void;
}

interface ControlState extends CaptureFactoryScanControl {
  parts: FactoryScanParts | null;
  accepts: boolean;
  gate: FactoryScanGate;
  /** The answer of the last scan that ended with one (row 111). Null until then; never stored. */
  last: CameraFactoryScan | null;
}

// Keyed by the app's stage registry: one object per app (the `captureConfigControl(app)` idiom).
const controls = new WeakMap<object, ControlState>();

/** The controls of the commissioning scan of an app. Available once the capture-config module is registered. */
export function captureFactoryScanControl(app: { readonly stages: object }): CaptureFactoryScanControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the commissioning scan is not mounted: register the capture-config module before app.ready(), then call it after');
  return control;
}

const PRODUCTION = 'REAL_PRODUCTION';

/** Mounts operation 103 and the door of the composition on the app. Called once, by the capture-config module's plugin, after the mount of `network`. */
export function mountCaptureFactoryScan(app: FastifyInstance): CaptureFactoryScanControl {
  const control: ControlState = {
    parts: null,
    // The ONE decision of the capture operation (the fence's function): this folder reads no flag.
    accepts: captureOperationOf(app.config) === PRODUCTION,
    gate: createFactoryScanGate(),
    last: null,
    provide(parts) {
      if (control.parts !== null) throw new Error('the parts of the commissioning scan were provided twice');
      control.parts = parts;
    },
    provided: () => control.parts !== null,
    available: () => control.accepts,
    busy: () => control.gate.busy(),
    claim: () => control.gate.claim(),
    lastScanOf(address) {
      const device = control.last?.devices.find((listed) => listed.address === address);
      if (device === undefined || control.last === null) return null;
      // A count above one is MORE_THAN_ONE whatever the member says: the two are read together, on the safe side.
      const deviceCount = device.endpointCount !== null && device.endpointCount > 1 ? FactoryCameraDeviceCount.MORE_THAN_ONE : device.deviceCount;
      return { deviceCount, mac: device.mac, scannedAt: control.last.scannedAt };
    },
    replaceForTest(parts) {
      if (parts.available !== undefined) control.accepts = parts.available;
      if (parts.parts !== undefined) control.parts = parts.parts;
      if (parts.gate !== undefined) control.gate = parts.gate;
      if (parts.probe !== undefined && control.parts !== null) control.parts = { ...control.parts, probe: parts.probe };
    },
  };
  controls.set(app.stages, control);

  const timers = createSystemTimers();
  const store = createNetworkConfigStore();
  const host: FactoryScanHost = {
    now: () => app.clock.now(),
    // The engine's own refusal (503) when it is not running: nothing is scanned on a Core that cannot write its entry.
    sessionOpen: () => isSessionActive(app.engine.state().session),
    async settings() {
      const settings = networkConfigOf(await app.db.read(FACTORY_SCAN_SETTINGS_LABEL, (pool) => store.read({ query: (text, values) => pool.query(text, values) })));
      return { configured: settings.configured, factoryAddresses: settings.factoryAddresses, aliasHost: settings.aliasHost, aliasMinutes: settings.aliasMinutes };
    },
    // The reader of row 108, asked at each judgement: the stored choice joined with the interfaces the host states NOW.
    facts: () => captureNetworkConfigControl(app).facts(),
    async audit(entry) {
      await app.engine.run(FACTORY_SCAN_AUDIT_LABEL, async (scope) => {
        await scope.unit.audit.append(entry);
      });
    },
    after: (delayMs, callback) => timers.after(delayMs, callback),
    note: (fields, message) => app.log.info(fields, message),
    failed(source, message, code, context) {
      // A fixed message, a code and counts. Nothing that was thrown and nothing a device said is handed in here.
      app.log.error({ source, code }, message);
      app.errorLog.append({ level: 'error', source, message, code, context: { ...context } });
    },
  };

  // Read at each call: the composition hands the parts in after `ready()`, and a test may have put its own in.
  const seams = (): FactoryScanSeams => ({ host, gate: control.gate, available: () => control.accepts, parts: () => control.parts, remember: (scan) => void (control.last = scan) });
  registerCaptureFactoryScanRoutes(app, seams);
  return control;
}
