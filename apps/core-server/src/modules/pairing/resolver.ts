/**
 * The device resolver: what the seam `app.deviceResolver` answers to stage 4 (plan row W32; spec
 * §4.1, §5.2 ID-13, §6.3 T7, §6.5, §6.6; SR-31, SR-33 to SR-35; database contract §5.2).
 *
 *   asked for                      stored                                  answer
 *   a `dvc_` value                 no credential row has its hash          null (stage 4: ANONYMOUS, 401)
 *                                  the current credential, device PAIRED   PAIRED
 *                                  the next credential, device PAIRED      promoted now, then PAIRED
 *                                  either one, device REVOKED or UNPAIRED  RETIRED (stage 6: 403 `DEVICE_REVOKED`)
 *                                  a credential that was rotated out       null: its hash is not stored any more
 *   a device ID (of a session)     no such device                          null
 *                                  PAIRED                                  PAIRED
 *                                  REVOKED or UNPAIRED                     RETIRED
 *
 * A value is looked up only when it has the exact form of its kind, so a made-up value costs no
 * query. A credential is found by the SHA-256 of what was presented; it is never compared in
 * this process, and neither it nor its hash is logged, returned or kept.
 *
 * TWO-PHASE ROTATION (T7, SR-33). `rotateDeviceCredential` stores the hash of the new credential
 * as "next" and leaves the current one valid. The FIRST request that presents the new one
 * promotes it, here, in a unit of its own, with one compare-and-set statement; from that commit
 * on the old credential is unknown. An answer of the rotation that never arrived therefore
 * costs nothing: the device goes on with the credential it has.
 *
 * LAST SEEN (spec §6.5). A request that resolves to a PAIRED device records it, at most once a
 * minute per device, in a unit of its own. That write is bookkeeping: if it fails, the failure
 * is logged and persisted and the request goes on.
 *
 * Reads run on the pool; the two writes are units of the serial pipeline (ENG-23).
 */
import { DEVICE_ID_PATTERN, type PairedDeviceState } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import { describeError } from '../../plugins/logger';
import { readDatabase } from './database';
import { DEVICE_SEEN_MIN_INTERVAL_MS } from './limits';
import { deviceCredentialHash, isDeviceCredential } from './secrets';
import { findDevice, findDeviceByCredential, markDeviceSeen, promoteCredential, readDeviceState, type FoundDevice, type Queryable } from './store';

/**
 * What a device credential, or the device of a session, resolves to (spec §4.1).
 *   PAIRED   the device is a principal.
 *   RETIRED  the device is REVOKED or UNPAIRED: not a principal; stage 4 keeps the device ID
 *            only so that stage 6 can answer 403 `DEVICE_REVOKED` with its audit row (RB-6).
 */
export interface ResolvedDevice {
  readonly status: 'PAIRED' | 'RETIRED';
  readonly deviceId: string;
}

export interface DeviceResolver {
  /**
   * Resolves the value of an `Authorization: Bearer dvc_…` header. The value is the credential
   * as the caller sent it; only its SHA-256 is stored. Null when it is unknown.
   */
  resolveCredential(credential: string): Promise<ResolvedDevice | null>;
  /**
   * The status of one device by its registry ID, for a session token that is bound to a device
   * (ID-13). Null when no such device exists.
   */
  resolveDevice(deviceId: string): Promise<ResolvedDevice | null>;
  /**
   * The stored state of one device, read with the caller's own statements: `db` is the unit of
   * work of ANOTHER module (the biometric sign-in), so the read sees what that unit sees and
   * holds until it commits. Null when no device has this ID. It records nothing and resolves
   * nothing: one `SELECT` on the caller's transaction.
   *
   * On the seam, so that the identity module does not import this module (review finding
   * CPB1-10; fix round B2b).
   */
  deviceState(db: Queryable, deviceId: string): Promise<PairedDeviceState | null>;
}

const SEEN_FAILED = 'the last-seen time of a device could not be written; the request goes on';

export function createDeviceResolver(app: FastifyInstance): DeviceResolver {
  const retired = (deviceId: string): ResolvedDevice => ({ status: 'RETIRED', deviceId });
  const pairedDevice = (deviceId: string): ResolvedDevice => ({ status: 'PAIRED', deviceId });

  /** Records that a PAIRED device was seen, when its last entry is a minute old or older. */
  async function seen(device: FoundDevice): Promise<void> {
    if (app.clock.now() - device.lastSeenAt < DEVICE_SEEN_MIN_INTERVAL_MS) return;
    try {
      await app.pipeline.run('pairing.deviceSeen', (unit) => {
        const now = app.clock.now();
        return markDeviceSeen(unit, device.deviceId, now, now - DEVICE_SEEN_MIN_INTERVAL_MS);
      });
    } catch (error) {
      // Logged as `{ err }` (rule M14), with the device's registry ID, which is safe to log (NL-7).
      app.log.error({ err: error, deviceId: device.deviceId }, SEEN_FAILED);
      app.errorLog.append({ level: 'error', source: 'pairing.deviceSeen', message: SEEN_FAILED, ...describeError(error), context: { deviceId: device.deviceId } });
    }
  }

  return {
    async resolveCredential(credential) {
      if (!isDeviceCredential(credential)) return null;
      const hash = deviceCredentialHash(credential);
      const lookup = (): Promise<FoundDevice | null> => readDatabase(app, 'pairing.resolveCredential', (db) => findDeviceByCredential(db, hash));

      let device = await lookup();
      if (device === null) return null;
      if (device.state !== 'PAIRED') return retired(device.deviceId);
      if (device.pending) {
        // The first use of the next credential: promote it, then answer from what is stored
        // now. No row promoted means another request did it first; the second read tells.
        const { deviceId } = device;
        await app.pipeline.run('pairing.promoteCredential', (unit) => promoteCredential(unit, hash, deviceId));
        device = await lookup();
        if (device === null) return null;
        if (device.state !== 'PAIRED') return retired(device.deviceId);
        // Still pending after a promotion: that cannot be. A credential that is not the
        // current one of its device resolves to nothing.
        if (device.pending) return null;
      }
      await seen(device);
      return pairedDevice(device.deviceId);
    },

    async resolveDevice(deviceId) {
      if (!DEVICE_ID_PATTERN.test(deviceId)) return null;
      const device = await readDatabase(app, 'pairing.resolveDevice', (db) => findDevice(db, deviceId));
      if (device === null) return null;
      if (device.state !== 'PAIRED') return retired(device.deviceId);
      await seen(device);
      return pairedDevice(device.deviceId);
    },

    deviceState: (db, deviceId) => readDeviceState(db, deviceId),
  };
}
