/**
 * Identity module (plan row W24; spec §5, §7.5; hand-built element HB-5 together with
 * `plugins/authenticate`). The sub-folder `password-hash/` is plan row W09's, `biometric/` is
 * plan row W41's.
 *
 * What this unit adds to the server:
 *
 *   the seam `sessionRegistry`   the auth sessions (`sessions.ts`): what the `authenticate`
 *                                stage, the administration module, the pairing module, the
 *                                biometric operations and the realtime channel need from them;
 *   operations 2 to 6            `signIn`, `getSignInStatus`, `getAuthSession`, `signOut`,
 *                                `touchSession` (`routes.ts`, `sign-in.ts`);
 *   the console lockout          5 attempts in 300 s lock a console for 60 s (`lockout.ts`);
 *   the expiry sweeper           every 5 s while the server listens (`sweeper.ts`).
 *
 * Identity is server-native: the simulator's sign-in actions, its idle expiry and its lockout
 * slice are not used. Every state change is a unit of work of the serial pipeline; only the
 * Argon2id derivation of a sign-in runs outside it (ENG-23 to ENG-26).
 *
 * The plugin function opens no database connection and starts no timer: `buildApp()` followed
 * by `app.inject()` works without PostgreSQL. The sweeper starts when the server listens.
 *
 * FOR THE BIOMETRIC ROW (W41, `biometric/`): `identityControl(app)` gives the same lockout the
 * password sign-in counts on (operations 8 and 9 take their attempt from the device's key);
 * `issueSession`, the activity builders and `requireConsoleIdentity` are exported below.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `identityModule` and `SessionRegistry`
 * keep their names. The seam is provided with `app.seams.provide('sessionRegistry', registry)`.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { describeError } from '../../plugins/logger';
import { registerBiometricRoutes } from './biometric';
import { SESSION_SWEEP_INTERVAL_MS } from './limits';
import { createConsoleLockout, type ConsoleLockout } from './lockout';
import { hashPassword, needsRehash, verifyAgainstDummy, verifyPassword, type PasswordHasher } from './password-hash';
import { registerIdentityRoutes } from './routes';
import { createSessionRegistry, type SessionRegistry } from './sessions';
import { createSweeper, type Sweeper } from './sweeper';

export {
  appendActivities,
  appendActivity,
  attemptFailed,
  attemptLocked,
  sessionExpired,
  signedIn,
  signedOut,
  type Activity,
  type ExpiryReason,
} from './activity';
export {
  consoleIdentityOf,
  deviceNotPaired,
  deviceRevoked,
  pairedDeviceOf,
  refuseRetiredDevice,
  requireConsoleIdentity,
  statusConsoleKeyOf,
  type ConsoleIdentity,
} from './console';
export { SESSION_COOKIE_ATTRIBUTES, clearSessionCookie, setSessionCookie } from './cookie';
export {
  LOCKOUT_DURATION_MS,
  LOCKOUT_MAX_ATTEMPTS,
  LOCKOUT_WINDOW_MS,
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_SWEEP_INTERVAL_MS,
  SESSION_TOUCH_MIN_INTERVAL_MS,
  WEB_CONSOLE_KEY,
} from './limits';
export {
  createConsoleLockout,
  type AttemptTicket,
  type ConsoleLockStatus,
  type ConsoleLockout,
  type FailureOutcome,
  type LockRefusal,
} from './lockout';
export { IDENTITY_CORE_OPERATIONS, type IdentityCoreOperation } from './routes';
export type { AuthSession, EndedSession, OperatorProfile, SessionTransport } from './session-store';
export {
  issueSession,
  type DeviceEndReason,
  type IssuedSession,
  type OpenSession,
  type OperatorEndReason,
  type SessionRegistry,
  type SessionResolution,
  type TouchOutcome,
} from './sessions';
export { authSessionInfo, consoleLocked, invalidCredentials, normalizeUsername } from './sign-in';
export { createSweeper, type Sweeper } from './sweeper';
export { SESSION_TOKEN_BYTES, SESSION_TOKEN_PREFIX, isSessionToken, newSessionToken, sessionTokenHash } from './tokens';

/**
 * What this unit puts behind the seam `sessionRegistry`: the registry, and what the biometric
 * row and a test need beside it. Reached with `identityControl(app)`.
 */
export interface IdentityControl extends SessionRegistry {
  /** The sign-in lockout of every console of this server. Memory state: a restart clears it. */
  readonly lockout: ConsoleLockout;
  /**
   * The password hasher of the sign-in: the built-in Argon2id of `password-hash/`. A test puts
   * one in place that counts its derivations (`createPasswordHasher({ derive })`).
   */
  hasher: PasswordHasher;
  /** The timer of the expiry sweep. It runs only while the server listens. */
  readonly sweeper: Sweeper;
}

function isIdentityControl(registry: SessionRegistry): registry is IdentityControl {
  return 'lockout' in registry && 'hasher' in registry && 'sweeper' in registry;
}

/** The identity module's controls of an app. Throws when a test put another object behind the seam. */
export function identityControl(app: FastifyInstance): IdentityControl {
  const registry = app.sessionRegistry;
  if (!isIdentityControl(registry)) {
    throw new Error('app.sessionRegistry is not the registry of modules/identity: the seam was replaced');
  }
  return registry;
}

const SWEEP_FAILED = 'the session expiry sweep failed';

export const identityModule: FastifyPluginAsync = async (app) => {
  const registry = createSessionRegistry(app);
  const lockout = createConsoleLockout();
  let hasher: PasswordHasher = { hashPassword, verifyPassword, verifyAgainstDummy, needsRehash };

  const sweeper = createSweeper({
    intervalMs: SESSION_SWEEP_INTERVAL_MS,
    sweep: () => registry.sweep(),
    onError(error) {
      // By its code only. The next tick tries again; a session past its limit is refused at its
      // next request in any case.
      const description = describeError(error);
      app.log.error({ code: description.code ?? description.errorName }, SWEEP_FAILED);
      app.errorLog.append({ level: 'error', source: 'identity.sweeper', message: SWEEP_FAILED, ...description });
    },
  });

  const control: IdentityControl = {
    resolve: registry.resolve,
    touch: registry.touch,
    endForOperator: registry.endForOperator,
    endForDevice: registry.endForDevice,
    endBiometricSessions: registry.endBiometricSessions,
    sweep: registry.sweep,
    lockout,
    sweeper,
    get hasher() {
      return hasher;
    },
    set hasher(next: PasswordHasher) {
      hasher = next;
    },
  };
  app.seams.provide('sessionRegistry', control);

  registerIdentityRoutes(app, { lockout, hasher: () => hasher });
  registerBiometricRoutes(app, { lockout });

  // The sweeper belongs to a server that serves: it starts with the listener and stops before
  // the pipeline closes.
  app.addHook('onListen', async () => {
    sweeper.start();
  });
  app.addHook('preClose', async () => {
    sweeper.stop();
  });
};
