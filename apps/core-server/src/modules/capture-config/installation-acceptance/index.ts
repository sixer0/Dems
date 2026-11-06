/**
 * The installation acceptance of the Core and its revocation (task 4, blueprint row 117, package
 * WP-26b; contract of row 116, operations 109 and 110; schema set C, `installation_acceptances`;
 * decisions U10, U11 (OQ-2), C2, C61 (2), C80; security finding S13-13).
 *
 * WHAT THIS FOLDER OWNS
 *   - the live paths of operations 109 `acceptInstallation` and 110
 *     `revokeInstallationAcceptance` (`routes.ts`) and what they do (`service.ts`);
 *   - the two statements of the table (`store.ts`). No other production file names the table.
 *
 * WHAT IT DOES NOT DO
 *   - IT GATES NOTHING. A session starts whether or not an acceptance is in force, and a
 *     revocation stops nothing (design addendum section 10, item 6). The folder offers no reader:
 *     no function of it answers "is an acceptance in force", so no other unit can ask.
 *   - It keeps nothing in memory: every answer is the row a statement of its own unit wrote.
 *
 * ON EVERY CORE. A Core in simulated capture has the table and stores the record as any Core
 * does; the refusal `INSTALLATION_ACCEPTANCE_NOT_AVAILABLE` is the in-app simulator's alone.
 *
 * MOUNTED by `modules/capture-config` (the unit list of `app.ts` is frozen, static rule P25; a
 * module imports no other module), beside the commissioning folders `network` and `factory-scan`
 * whose access object it shares. `mountInstallationAcceptance` opens no database connection:
 * `buildApp()` works without PostgreSQL.
 */
import { isSessionActive } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { describeError } from '../../../plugins/logger';
import { CORE_SERVER_VERSION } from '../../../version';
import { registerInstallationAcceptanceRoutes } from './routes';
import type { InstallationAcceptanceHost, InstallationAcceptanceSeams } from './service';
import { createInstallationAcceptanceStore, type InstallationAcceptanceStore } from './store';

export { INSTALLATION_ACCEPTANCE_MODULE_OPERATIONS, installationAcceptanceOperation, type InstallationAcceptanceModuleOperation } from './routes';
export {
  INSTALLATION_ACCEPTANCE_REVOKED_MESSAGE,
  INSTALLATION_ACCEPTED_MESSAGE,
  INSTALLATION_ACCEPT_UNIT_LABEL,
  INSTALLATION_REVOKE_UNIT_LABEL,
  acceptInstallation,
  installationAcceptanceOf,
  revokeInstallationAcceptance,
  storableDiagnosticsOf,
  type InstallationAcceptanceCaller,
  type InstallationAcceptanceHost,
  type InstallationAcceptanceSeams,
  type InstallationAcceptanceUnit,
  type InstallationFacts,
} from './service';
export {
  INSERT_INSTALLATION_ACCEPTANCE,
  INSTALLATION_ACCEPTANCE_WRITES,
  IN_FORCE_CONSTRAINT,
  InstallationAcceptanceRowError,
  REVOKE_INSTALLATION_ACCEPTANCE,
  createInstallationAcceptanceStore,
  isClockBehindViolation,
  isInForceViolation,
  type AcceptanceWrite,
  type InstallationAcceptanceStore,
  type Queryable,
  type RevocationWrite,
  type StoredAcceptance,
} from './store';

/** What a test may put in the place of the folder's own parts. */
export interface InstallationAcceptanceTestParts {
  readonly store?: InstallationAcceptanceStore;
}

/** What this folder offers beside its routes: a door for its tests, and nothing that reads an acceptance. */
export interface InstallationAcceptanceControl {
  /** A TEST puts its own store in the place of the folder's (a write that fails after its statement). No production file calls it. */
  replaceForTest(parts: InstallationAcceptanceTestParts): void;
}

interface ControlState extends InstallationAcceptanceControl {
  store: InstallationAcceptanceStore;
}

// Keyed by the app's stage registry: one object per app (the `captureConfigControl(app)` idiom).
const controls = new WeakMap<object, ControlState>();

/** The controls of the installation acceptance of an app. Available once the capture-config module is registered. */
export function installationAcceptanceControl(app: { readonly stages: object }): InstallationAcceptanceControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the installation acceptance is not mounted: register the capture-config module before app.ready(), then call it after');
  return control;
}

/** Mounts operations 109 and 110 on the app. Called once, by the capture-config module's plugin. */
export function mountInstallationAcceptance(app: FastifyInstance): InstallationAcceptanceControl {
  const control: ControlState = {
    store: createInstallationAcceptanceStore(),
    replaceForTest(parts) {
      if (parts.store !== undefined) control.store = parts.store;
    },
  };
  controls.set(app.stages, control);

  const host: InstallationAcceptanceHost = {
    now: () => app.clock.now(),
    // The Core's version is its one constant (what operation 1 and a sealed manifest state), never the hosted model's.
    softwareVersion: () => CORE_SERVER_VERSION,
    // The engine's own refusal (503) when it is not running: nothing is stored on a Core that cannot store.
    sessionOpen: () => isSessionActive(app.engine.state().session),
    async unit(label, work) {
      const outcome = await app.engine.run(label, (scope) =>
        work({
          db: { query: (text, values) => scope.unit.query(text, values) },
          sessionOpen: () => isSessionActive(scope.pending().session),
          facts: () => {
            const { device, diagnostics } = scope.pending();
            return { device: { id: device.id, name: device.name, room: device.room }, diagnostics };
          },
          audit: async (entry) => {
            await scope.unit.audit.append(entry);
          },
        }),
      );
      return outcome.value;
    },
    note: (fields, message) => app.log.info(fields, message),
    failed(source, message, error) {
      // The SQLSTATE and the name of the constraint: which rule of the table refused. Never a value of the row.
      const described = describeError(error);
      const code = described.code ?? described.errorName;
      const constraint = (error as { constraint?: unknown } | null)?.constraint;
      const context: Record<string, string> = typeof constraint === 'string' ? { constraint } : {};
      app.log.error({ source, code, ...context }, message);
      app.errorLog.append({ level: 'error', source, message, code, errorName: described.errorName, stackTrace: described.stackTrace, context });
    },
  };

  // Read at each call: a test may have put a store of its own in (`replaceForTest`).
  const seams = (): InstallationAcceptanceSeams => ({ host, store: control.store });

  registerInstallationAcceptanceRoutes(app, seams);
  return control;
}
