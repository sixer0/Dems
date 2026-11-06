/**
 * The device registry and the life of a paired device (plan row W32; spec §4.7, §6.3 T7 to T9,
 * §6.5, §6.6, §7.3 line 10, §7.7 operations 19 to 23; SR-31, SR-33 to SR-35; database contract
 * §4.8, §4.9, §5.3, §5.6 AT-3).
 *
 *   list           every device ever paired, newest first: a read on the pool. `online` comes
 *                  from the presence counter, everything else from the tables. Never a
 *                  credential or its hash.
 *   revoke         an operator ends a device, with a reason (T8);
 *   unpair         a device ends its own pairing (T9);
 *   registration   a device reads its own registration and the Core it is paired with;
 *   rotate         a device asks for its next credential (T7, first phase; the second phase is
 *                  the resolver's, at the first use of the new credential).
 *
 * REVOKE AND UNPAIR ARE ONE UNIT EACH (SR-34): the state change by one compare-and-set
 * statement (`... WHERE id = $1 AND state = 'PAIRED' RETURNING`, the row count decides), the end
 * of the device's sessions (`app.sessionRegistry.endForDevice`, in this unit), the revocation of
 * its live biometric tokens, the audit row with `sessionsEnded`, the event. After the commit:
 * the device is forgotten by the presence counter, and `device.revoked` is published so that
 * the realtime channel closes its sockets with 4403. From that commit on the credential and
 * every session token of the device resolve to "retired" at stage 4, and stage 6 answers 403
 * `DEVICE_REVOKED` with its own row. REVOKED and UNPAIRED are final.
 *
 * A device operation that finds its device not PAIRED any more (it was revoked between stage 4
 * and the handler) answers 403 `DEVICE_REVOKED` and changes nothing. It writes no row of its
 * own: the revocation's row is the record.
 *
 * A REVOKE OF AN UNKNOWN DEVICE answers 404, of a device that is not PAIRED 409, and only then
 * 422 for a reason under five characters (spec §7.3 line 10): a reason is never judged for a
 * device that could not be revoked anyway.
 */
import { ApiErrorCode, type DeviceCredentialRotated, type DeviceRegistration, type PairedDevice } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import { ApiFailure, notReady } from '../../plugins/error-envelope';
import { deviceRevoked as deviceRevokedAnswer } from '../../plugins/authenticate';
import { SESSION_IDLE_TIMEOUT_MS } from '../identity';
import { revokeBiometricTokens } from '../identity/biometric';
import { appendActivity, credentialRotated, deviceRevoked, deviceUnpaired } from './activity';
import { readDatabase } from './database';
import type { DevicePresence } from './presence';
import { deviceCredentialHash, newDeviceCredential } from './secrets';
import {
  readCoreIdentity,
  readDeviceState,
  readRegistration,
  readRegistry,
  readRegistryDevice,
  revokeDevice,
  setNextCredential,
  unpairDevice,
  type RegistryDevice,
} from './store';

/** 404 of a revoke: no device has the ID of the path. */
export function deviceNotFound(): ApiFailure {
  return new ApiFailure(404, ApiErrorCode.NOT_FOUND, 'No device has this ID.');
}

/** 409 of a revoke: REVOKED and UNPAIRED are final. `state` is a state name of the registry. */
export function deviceNotPairedAnyMore(deviceId: string, state: string): ApiFailure {
  return new ApiFailure(409, ApiErrorCode.INVALID_STATE, `Device ${deviceId} is ${state}.`);
}

/** 422 of a revoke whose reason is under five characters (the simulator's `REASON_TOO_SHORT`). */
export function revokeReasonTooShort(): ApiFailure {
  return new ApiFailure(422, ApiErrorCode.INVALID_REASON, 'A revoke reason of at least 5 characters is required.');
}

/** The registry's row as the contract's `PairedDevice`: what the tables hold, and whether the device is online. */
function contractDeviceOf(device: RegistryDevice, presence: DevicePresence): PairedDevice {
  return {
    id: device.id,
    name: device.name,
    platform: device.platform,
    appVersion: device.appVersion,
    state: device.state,
    pairedAt: device.pairedAt,
    pairedWithCodeId: device.pairedWithCodeId,
    codeIssuedBy: device.codeIssuedBy,
    lastSeenAt: device.lastSeenAt,
    // Only a PAIRED device can hold an authenticated socket.
    online: device.state === 'PAIRED' && presence.isOnline(device.id),
    signedInOperatorId: device.signedInOperatorId,
    credentialRotatedAt: device.credentialRotatedAt,
    revokedAt: device.revokedAt,
    revokedBy: device.revokedBy,
    revokeReason: device.revokeReason,
    unpairedAt: device.unpairedAt,
  };
}

/** Operation 19. */
export async function listPairedDevices(app: FastifyInstance, presence: DevicePresence): Promise<PairedDevice[]> {
  const now = app.clock.now();
  const devices = await readDatabase(app, 'pairing.listPairedDevices', (db) => readRegistry(db, now, now - SESSION_IDLE_TIMEOUT_MS));
  return devices.map((device) => contractDeviceOf(device, presence));
}

/**
 * A revoke whose reason is too short: nothing is changed, and the answer follows the order of
 * spec §7.3 line 10. A read on the pool decides between 404, 409 and 422.
 */
export async function refuseShortRevokeReason(app: FastifyInstance, deviceId: string): Promise<never> {
  const state = await readDatabase(app, 'pairing.revokeDevice.state', (db) => readDeviceState(db, deviceId));
  if (state === null) throw deviceNotFound();
  if (state !== 'PAIRED') throw deviceNotPairedAnyMore(deviceId, state);
  throw revokeReasonTooShort();
}

/** After the commit of a revoke or an unpair: the sockets of the device are closed, the portal reads its list again. */
function publishRetired(app: FastifyInstance, presence: DevicePresence, deviceId: string, reason: 'REVOKED' | 'UNPAIRED'): void {
  presence.forget(deviceId);
  app.publish({ kind: 'device.revoked', deviceId, reason });
  app.publish({ kind: 'admin.changed', resource: 'DEVICES' });
}

/** Operation 20. `operatorId` is the caller of the session; `reason` is what that operator typed, 5 to 500 characters. */
export function revokePairedDevice(
  app: FastifyInstance,
  presence: DevicePresence,
  operatorId: string,
  deviceId: string,
  reason: string,
): Promise<PairedDevice> {
  return app.pipeline.run('pairing.revokeDevice', async (unit) => {
    const now = app.clock.now();
    if (!(await revokeDevice(unit, deviceId, now, operatorId, reason))) {
      // The statement changed nothing: there is no such device, or it is not PAIRED any more.
      const state = await readDeviceState(unit, deviceId);
      throw state === null ? deviceNotFound() : deviceNotPairedAnyMore(deviceId, state);
    }
    const sessions = await app.sessionRegistry.endForDevice(unit, deviceId, 'DEVICE_REVOKED');
    await revokeBiometricTokens(unit, { scope: 'DEVICE', deviceId, reason: 'DEVICE_REVOKED' }, now);
    await appendActivity(unit, deviceRevoked({ operatorId, deviceId, reason, sessionsEnded: sessions.length }));
    const device = await readRegistryDevice(unit, now, now - SESSION_IDLE_TIMEOUT_MS, deviceId);
    if (device === null) throw new Error('the revoked device is not in the registry');
    unit.afterCommit(() => publishRetired(app, presence, deviceId, 'REVOKED'));
    // Its sockets are closed with the publication above: it is not online any more.
    return { ...contractDeviceOf(device, presence), online: false };
  });
}

/** Operation 22. `operatorId` is the operator signed in on the device, if the call came with a session. */
export function unpairPairedDevice(app: FastifyInstance, presence: DevicePresence, deviceId: string, operatorId: string | null): Promise<void> {
  return app.pipeline.run('pairing.unpairDevice', async (unit) => {
    const now = app.clock.now();
    if (!(await unpairDevice(unit, deviceId, now))) throw deviceRevokedAnswer();
    const sessions = await app.sessionRegistry.endForDevice(unit, deviceId, 'DEVICE_UNPAIRED');
    await revokeBiometricTokens(unit, { scope: 'DEVICE', deviceId, reason: 'DEVICE_UNPAIRED' }, now);
    await appendActivity(unit, deviceUnpaired({ operatorId, deviceId, sessionsEnded: sessions.length }));
    unit.afterCommit(() => publishRetired(app, presence, deviceId, 'UNPAIRED'));
  });
}

/** Operation 21: two reads on the pool. */
export async function deviceRegistration(app: FastifyInstance, deviceId: string): Promise<DeviceRegistration> {
  const { registration, core } = await readDatabase(app, 'pairing.getDeviceRegistration', async (db) => ({
    registration: await readRegistration(db, deviceId),
    core: await readCoreIdentity(db),
  }));
  if (registration === null || registration.state !== 'PAIRED') throw deviceRevokedAnswer();
  if (core === null) throw notReady();
  return {
    deviceId: registration.deviceId,
    name: registration.name,
    state: registration.state,
    pairedAt: registration.pairedAt,
    credentialRotatedAt: registration.credentialRotatedAt,
    core,
  };
}

/**
 * Operation 23, the first phase of T7: a new credential, returned once; its hash is stored as
 * "next" and the current credential stays valid until the new one is first used. A second call
 * before that replaces the pending one.
 */
export function rotateDeviceCredential(app: FastifyInstance, deviceId: string): Promise<DeviceCredentialRotated> {
  return app.pipeline.run('pairing.rotateCredential', async (unit) => {
    const now = app.clock.now();
    const credential = newDeviceCredential();
    if (!(await setNextCredential(unit, deviceId, deviceCredentialHash(credential), now))) throw deviceRevokedAnswer();
    await appendActivity(unit, credentialRotated({ deviceId }));
    unit.afterCommit(() => app.publish({ kind: 'admin.changed', resource: 'DEVICES' }));
    return { deviceCredential: credential, rotatedAt: now };
  });
}
