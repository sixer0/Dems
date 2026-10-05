/**
 * Pairing module and device registry (plan row W32; spec §6, §7.7; hand-built element HB-10).
 *
 * What this unit adds to the server:
 *
 *   the seam `deviceResolver`   what a device credential, or the device of a session, resolves
 *                               to at stage 4 (`resolver.ts`): PAIRED, RETIRED or nothing; the
 *                               promotion of a rotated credential at its first use; the
 *                               device's last-seen time;
 *   operations 15 to 23         the pairing code (issue, status, cancel), the redeem, the
 *                               registry, revoke, a device's own registration, unpair and the
 *                               credential rotation (`routes.ts`, `codes.ts`, `redeem.ts`,
 *                               `devices.ts`);
 *   the redeem lock             3 failed redeems in 300 s lock redeeming for 60 s (`redeem-lock.ts`);
 *   the presence counter        which paired devices hold an open authenticated socket
 *                               (`presence.ts`; the realtime channel feeds it);
 *   the code sweeper            every 5 s while the server listens: the active code past its
 *                               300 s becomes EXPIRED.
 *
 * Pairing is server-native: the simulator's `pair` and `unpair` actions and its `pairing` slice
 * are not used. Every state change is one unit of work of the serial pipeline (ENG-23); a
 * redeem is ONE unit with a consuming compare-and-set before the comparison (ENG-24, ENG-25).
 *
 * SECRETS. A pairing code and a device credential come from the platform's random source, are
 * returned once in the answer the contract defines, and are stored as SHA-256 only. Neither
 * appears in an audit row, an event, a publication, a log line or an error (SR-28, SR-31).
 *
 * The plugin function opens no database connection and starts no timer: `buildApp()` followed
 * by `app.inject()` works without PostgreSQL. The sweeper starts when the server listens.
 *
 * FOR THE BIOMETRIC ROW (W41). `app.deviceResolver.resolveDevice(deviceId)` says whether a
 * device is PAIRED; inside a unit of its own, `app.deviceResolver.deviceState(unit, deviceId)`
 * reads the state on that unit's transaction (the statement is `readDeviceState` of the store). A revoke or an unpair ends the device's sessions and revokes its
 * live biometric tokens (`revoked_at`, `revoke_reason` `DEVICE_REVOKED` or `DEVICE_UNPAIRED`)
 * in its own unit, so nothing has to be called for it.
 *
 * FOR THE REALTIME ROW (W42). `pairingControl(app).presence.socketOpened(deviceId)` and
 * `.socketClosed(deviceId)` for every authenticated socket of a device; the publication
 * `{ kind: 'device.revoked', deviceId, reason }` after the commit of a revoke or an unpair is
 * the signal to close that device's sockets with 4403.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `pairingModule`, `DeviceResolver` and
 * `ResolvedDevice` keep their names and shapes. The seam is provided with
 * `app.seams.provide('deviceResolver', control)`.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { describeError } from '../../plugins/logger';
import { createSweeper, type Sweeper } from '../identity';
import { sweepCodes } from './codes';
import { PAIRING_CODE_SWEEP_INTERVAL_MS } from './limits';
import { createDevicePresence, type DevicePresence } from './presence';
import { createRedeemLock, type RedeemLock } from './redeem-lock';
import { createDeviceResolver, type DeviceResolver } from './resolver';
import { registerPairingRoutes } from './routes';

export {
  DEVICE_CREDENTIAL_BYTES,
  DEVICE_CREDENTIAL_PREFIX,
  DEVICE_SEEN_MIN_INTERVAL_MS,
  PAIRING_CODE_DIGITS,
  PAIRING_CODE_LIFETIME_MS,
  PAIRING_CODE_MAX_FAILED_REDEEMS,
  PAIRING_CODE_SWEEP_INTERVAL_MS,
  PAIRING_QR_PREFIX,
  REDEEM_LOCK_DURATION_MS,
  REDEEM_LOCK_KEY,
  REDEEM_LOCK_MAX_FAILURES,
  REDEEM_LOCK_WINDOW_MS,
} from './limits';
export { createDevicePresence, type DevicePresence } from './presence';
export {
  createRedeemLock,
  type RedeemFailure,
  type RedeemLock,
  type RedeemLockRefusal,
  type RedeemLockStatus,
  type RedeemTicket,
} from './redeem-lock';
export type { DeviceResolver, ResolvedDevice } from './resolver';
export { PAIRING_OPERATION_IDS, type PairingOperationId } from './routes';
export { readDeviceState, type Queryable } from './store';

/**
 * What this unit puts behind the seam `deviceResolver`: the resolver, and what the realtime
 * channel and a test need beside it. Reached with `pairingControl(app)`.
 */
export interface PairingControl extends DeviceResolver {
  /** The lock of redeeming. Memory state: a restart clears it. */
  readonly lock: RedeemLock;
  /** Which paired devices hold an open authenticated socket. Fed by the realtime channel. */
  readonly presence: DevicePresence;
  /** The timer of the code expiry sweep. It runs only while the server listens. */
  readonly sweeper: Sweeper;
  /** One expiry sweep now, at the server clock's time: the ID of the code it closed, or null. */
  sweepCodes(): Promise<string | null>;
}

function isPairingControl(resolver: DeviceResolver): resolver is PairingControl {
  return 'lock' in resolver && 'presence' in resolver && 'sweeper' in resolver && 'sweepCodes' in resolver;
}

/** The pairing module's controls of an app. Throws when a test put another object behind the seam. */
export function pairingControl(app: FastifyInstance): PairingControl {
  const resolver = app.deviceResolver;
  if (!isPairingControl(resolver)) {
    throw new Error('app.deviceResolver is not the resolver of modules/pairing: the seam was replaced');
  }
  return resolver;
}

const SWEEP_FAILED = 'the pairing code expiry sweep failed';

export const pairingModule: FastifyPluginAsync = async (app) => {
  const resolver = createDeviceResolver(app);
  const lock = createRedeemLock();
  const presence = createDevicePresence();

  const sweeper = createSweeper({
    intervalMs: PAIRING_CODE_SWEEP_INTERVAL_MS,
    sweep: () => sweepCodes(app),
    onError(error) {
      // The next tick tries again; a code past its time redeems nothing in any case, because
      // every statement that uses it states the time again. Logged as `{ err }` (rule M14).
      app.log.error({ err: error }, SWEEP_FAILED);
      app.errorLog.append({ level: 'error', source: 'pairing.sweeper', message: SWEEP_FAILED, ...describeError(error) });
    },
  });

  const control: PairingControl = {
    resolveCredential: resolver.resolveCredential,
    resolveDevice: resolver.resolveDevice,
    deviceState: resolver.deviceState,
    lock,
    presence,
    sweeper,
    sweepCodes: () => sweepCodes(app),
  };
  app.seams.provide('deviceResolver', control);

  registerPairingRoutes(app, { lock, presence });

  // The sweeper belongs to a server that serves: it starts with the listener and stops before
  // the pipeline closes.
  app.addHook('onListen', async () => {
    sweeper.start();
  });
  app.addHook('preClose', async () => {
    sweeper.stop();
  });
};
