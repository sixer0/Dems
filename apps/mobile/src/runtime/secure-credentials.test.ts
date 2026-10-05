// Backend task W15: the secure-store wrapper (04_client_integration_spec MP-1, MP-4, MB-5, MB-6,
// MB-6a; AC-C-105 for the wrapper; 01_specs SR-32). The store is the in-memory mock of
// `jest.setup.ts` (TS-16), reached through its two globals: this file does not name the package.
// Every value below is an obviously fake string of the contract's shape; none is in a test name.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PairingRedeemedSchema } from '@dems/shared/api';
import { reportRuntimeIssue } from './log';
import {
  SECURE_ITEM_KEYS,
  deleteBiometric,
  deleteDeviceCredential,
  isUnprotectedBiometricItemAllowed,
  readBiometricMarker,
  readBiometricToken,
  readDeviceCredential,
  rotateBiometricToken,
  secureStoreDevProbe,
  writeBiometricToken,
  writeDeviceCredential,
  type BiometricOwner,
  type StoredDeviceCredential,
} from './secure-credentials';

jest.mock('./log', () => ({ reportRuntimeIssue: jest.fn() }));

const store = globalThis.__DEMS_SECURE_STORE_MOCK__;
const device = globalThis.__DEMS_DEVICE_MOCK__;
const reported = jest.mocked(reportRuntimeIssue);

type DevGlobal = typeof globalThis & { __DEV__: boolean };
const devGlobal = globalThis as DevGlobal;
const originalDev = devGlobal.__DEV__;
/** The build flag of MB-6a: jest runs as a debug build; `false` is a release build. */
function asBuild(debug: boolean) {
  devGlobal.__DEV__ = debug;
}

const FAKE_DEVICE_CREDENTIAL = `dvc_${'d'.repeat(43)}`;
const FAKE_TOKEN = `bio_${'a'.repeat(43)}`;
const FAKE_ROTATED_TOKEN = `bio_${'b'.repeat(43)}`;
const SECRETS = [FAKE_DEVICE_CREDENTIAL, FAKE_TOKEN, FAKE_ROTATED_TOKEN];

const PAIRED: StoredDeviceCredential = {
  deviceId: 'DEV-0003',
  deviceCredential: FAKE_DEVICE_CREDENTIAL,
  pairedAt: 1_790_000_000_000,
  core: { deviceId: 'DEMS-IR-01', name: 'DEMS Core', certificateFingerprint: 'SHA256:TEST' },
};
const OWNER: BiometricOwner = { operatorId: 'OPR-001', displayName: 'Test Operator', deviceId: 'DEV-0003' };

/** Everything this module wrote to the runtime log, as one text. */
function logText(): string {
  return JSON.stringify(reported.mock.calls);
}

function expectNoSecretIn(text: string) {
  for (const secret of SECRETS) expect(text.includes(secret)).toBe(false);
}

beforeEach(() => {
  reported.mockClear();
});

afterEach(() => {
  asBuild(originalDev);
  // No failure of any test may have carried a value into the runtime log.
  expectNoSecretIn(logText());
});

describe('item names', () => {
  it('are the three names of the specification', () => {
    expect(SECURE_ITEM_KEYS).toEqual({
      deviceCredential: 'dems.live.device.v1',
      biometricToken: 'dems.live.bio.v1',
      biometricMarker: 'dems.live.bio.meta.v1',
    });
  });

  it('the fixture has the shape of the redeem answer', () => {
    expect(PairingRedeemedSchema.safeParse(PAIRED).success).toBe(true);
  });
});

describe('device credential', () => {
  it('is absent on a device that was never paired', async () => {
    expect(await readDeviceCredential()).toEqual({ ok: true, value: null });
    expect(store.prompts).toHaveLength(0);
  });

  it('is written without an authentication requirement and read back without a prompt', async () => {
    expect(await writeDeviceCredential(PAIRED)).toEqual({ ok: true });
    expect(store.keys()).toEqual([SECURE_ITEM_KEYS.deviceCredential]);
    expect(store.isProtected(SECURE_ITEM_KEYS.deviceCredential)).toBe(false);

    const read = await readDeviceCredential();
    expect(read.ok && read.value).toEqual(PAIRED);
    expect(store.prompts).toHaveLength(0);
    expect(reported).not.toHaveBeenCalled();
  });

  it('refuses a value of another shape and writes nothing', async () => {
    const result = await writeDeviceCredential({ ...PAIRED, deviceCredential: 'not-a-credential' });
    expect(result).toEqual({ ok: false, code: 'INVALID_VALUE', reason: null, nativeCode: null });
    expect(store.keys()).toEqual([]);
    expect(reported).toHaveBeenCalledTimes(1);
  });

  it('reports a stored text of another shape as CORRUPT_ITEM, by code only', async () => {
    store.seed(SECURE_ITEM_KEYS.deviceCredential, `{"deviceCredential":"${FAKE_DEVICE_CREDENTIAL}"}`);
    const corrupt = await readDeviceCredential();
    expect(corrupt).toEqual({ ok: false, code: 'CORRUPT_ITEM', reason: null, nativeCode: null });

    store.seed(SECURE_ITEM_KEYS.deviceCredential, `not json ${FAKE_DEVICE_CREDENTIAL}`);
    expect(await readDeviceCredential()).toEqual({ ok: false, code: 'CORRUPT_ITEM', reason: null, nativeCode: null });
    expect(reported).toHaveBeenCalledTimes(2);
    expectNoSecretIn(JSON.stringify(corrupt));
  });

  it('returns the code of a failing read, write and delete, and logs each', async () => {
    store.failNext('write');
    expect(await writeDeviceCredential(PAIRED)).toEqual({ ok: false, code: 'WRITE_FAILED', reason: 'OTHER', nativeCode: 'ERR_WRITE' });
    expect(store.keys()).toEqual([]);

    await writeDeviceCredential(PAIRED);
    store.failNext('read');
    expect(await readDeviceCredential()).toEqual({ ok: false, code: 'READ_FAILED', reason: 'OTHER', nativeCode: 'ERR_DECRYPT' });

    store.failNext('delete', 3);
    const deleted = await deleteDeviceCredential();
    expect(deleted).toEqual({ ok: false, code: 'DELETE_FAILED', reason: 'OTHER', nativeCode: 'ERR_DELETE' });
    expect(reported.mock.calls.map((call) => [call[0], call[1], (call[3] as { code: string }).code])).toEqual([
      ['error', 'runtime.secureCredentials.writeDeviceCredential', 'WRITE_FAILED'],
      ['error', 'runtime.secureCredentials.readDeviceCredential', 'READ_FAILED'],
      ['error', 'runtime.secureCredentials.deleteBiometric', 'DELETE_FAILED'],
      ['error', 'runtime.secureCredentials.deleteBiometric', 'DELETE_FAILED'],
      ['error', 'runtime.secureCredentials.deleteDeviceCredential', 'DELETE_FAILED'],
    ]);
  });

  it('is deleted together with both biometric items (MB-2)', async () => {
    await writeDeviceCredential(PAIRED);
    await writeBiometricToken(FAKE_TOKEN, OWNER, 'protected');
    expect(store.keys()).toHaveLength(3);

    expect(await deleteDeviceCredential()).toEqual({ ok: true });
    expect(store.keys()).toEqual([]);
    expect(await readDeviceCredential()).toEqual({ ok: true, value: null });
  });
});

describe('biometric token, protected (MB-5 cases a and b)', () => {
  it('is written with the authentication requirement, with a marker that says so', async () => {
    expect(await writeBiometricToken(FAKE_TOKEN, OWNER, 'protected', 'Enable biometric sign-in')).toEqual({ ok: true, protected: true });
    expect(store.isProtected(SECURE_ITEM_KEYS.biometricToken)).toBe(true);
    expect(store.isProtected(SECURE_ITEM_KEYS.biometricMarker)).toBe(false);
    expect(store.prompts).toEqual([{ operation: 'write', key: SECURE_ITEM_KEYS.biometricToken, title: 'Enable biometric sign-in' }]);

    // The marker is read without a prompt and holds no token.
    const marker = await readBiometricMarker();
    expect(marker).toEqual({ ok: true, value: { ...OWNER, protected: true } });
    expectNoSecretIn(store.peek(SECURE_ITEM_KEYS.biometricMarker) ?? '');
    expect(store.prompts).toHaveLength(1);
  });

  it('is read through the OS prompt, with the options it was written with', async () => {
    await writeBiometricToken(FAKE_TOKEN, OWNER, 'protected');
    store.prompts.length = 0;

    expect(await readBiometricToken('Sign in')).toEqual({ ok: true, value: FAKE_TOKEN });
    expect(store.prompts).toEqual([{ operation: 'read', key: SECURE_ITEM_KEYS.biometricToken, title: 'Sign in' }]);
  });

  it('gives nothing, and shows no prompt, when biometric sign-in is not set up', async () => {
    expect(await readBiometricMarker()).toEqual({ ok: true, value: null });
    expect(await readBiometricToken()).toEqual({ ok: true, value: null });
    expect(store.prompts).toHaveLength(0);
  });

  it('a cancelled read prompt is reported by class and deletes nothing (MB-4)', async () => {
    await writeBiometricToken(FAKE_TOKEN, OWNER, 'protected');
    store.protectedRead = 'fail';
    store.failure = 'user-canceled';

    expect(await readBiometricToken()).toEqual({ ok: false, code: 'AUTHENTICATION', reason: 'USER_CANCELED', nativeCode: 'ERR_AUTHENTICATION' });
    expect(store.keys()).toEqual([SECURE_ITEM_KEYS.biometricToken, SECURE_ITEM_KEYS.biometricMarker].sort());
    expect(reported.mock.calls.at(-1)?.[0]).toBe('info');
  });

  it('a failing protected write stores nothing: no token, no marker', async () => {
    store.protectedWrite = 'fail';
    const result = await writeBiometricToken(FAKE_TOKEN, OWNER, 'protected');
    expect(result).toEqual({ ok: false, code: 'AUTHENTICATION', reason: 'NO_BIOMETRICS_ENROLLED', nativeCode: 'ERR_AUTHENTICATION' });
    expect(store.keys()).toEqual([]);
    expectNoSecretIn(JSON.stringify(result));
  });

  it('refuses a token or an owner of another shape and stores nothing', async () => {
    expect(await writeBiometricToken('bio_short', OWNER, 'protected')).toMatchObject({ ok: false, code: 'INVALID_VALUE' });
    expect(await writeBiometricToken(FAKE_TOKEN, { ...OWNER, deviceId: 'tablet' }, 'protected')).toMatchObject({ ok: false, code: 'INVALID_VALUE' });
    expect(store.keys()).toEqual([]);
    expect(store.prompts).toHaveLength(0);
  });

  it('a stored token of another shape is CORRUPT_ITEM', async () => {
    await writeBiometricToken(FAKE_TOKEN, OWNER, 'protected');
    store.seed(SECURE_ITEM_KEYS.biometricToken, 'something else', true);
    expect(await readBiometricToken()).toMatchObject({ ok: false, code: 'CORRUPT_ITEM' });
  });
});

describe('the write after a rotation (MB-6)', () => {
  it('replaces the token with the same options as the old one and keeps the marker', async () => {
    await writeBiometricToken(FAKE_TOKEN, OWNER, 'protected');
    store.prompts.length = 0;

    expect(await rotateBiometricToken(FAKE_ROTATED_TOKEN, 'Sign in')).toEqual({ ok: true, protected: true });
    expect(store.peek(SECURE_ITEM_KEYS.biometricToken)).toBe(FAKE_ROTATED_TOKEN);
    expect(store.isProtected(SECURE_ITEM_KEYS.biometricToken)).toBe(true);
    expect(await readBiometricMarker()).toEqual({ ok: true, value: { ...OWNER, protected: true } });
    // The protected write of the rotated token is a second OS prompt on such a device (DEPARTURE-6).
    expect(store.prompts).toEqual([{ operation: 'write', key: SECURE_ITEM_KEYS.biometricToken, title: 'Sign in' }]);
  });

  it('keeps an unprotected token unprotected, without a prompt', async () => {
    await writeBiometricToken(FAKE_TOKEN, OWNER, 'unprotected');
    expect(await rotateBiometricToken(FAKE_ROTATED_TOKEN)).toEqual({ ok: true, protected: false });
    expect(store.isProtected(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(store.prompts).toHaveLength(0);
  });

  it('deletes both items when the write fails', async () => {
    await writeBiometricToken(FAKE_TOKEN, OWNER, 'protected');
    store.protectedWrite = 'fail';
    store.failure = 'lockout';

    expect(await rotateBiometricToken(FAKE_ROTATED_TOKEN)).toEqual({ ok: false, code: 'AUTHENTICATION', reason: 'LOCKOUT', nativeCode: 'ERR_AUTHENTICATION' });
    expect(store.keys()).toEqual([]);
  });

  it('without an enrolment there is nothing to rotate, and nothing is stored', async () => {
    expect(await rotateBiometricToken(FAKE_ROTATED_TOKEN)).toMatchObject({ ok: false, code: 'BIOMETRIC_NOT_STORED' });
    expect(store.keys()).toEqual([]);
  });
});

describe('the unprotected biometric item (MB-5 case c, MB-6a, AC-C-105)', () => {
  it.each([
    { isDevice: false, debug: true, allowed: true },
    { isDevice: false, debug: false, allowed: true },
    { isDevice: true, debug: true, allowed: true },
    { isDevice: true, debug: false, allowed: false },
  ])('isDevice $isDevice, debug build $debug: allowed $allowed', ({ isDevice, debug, allowed }) => {
    device.isDevice = isDevice;
    asBuild(debug);
    expect(isUnprotectedBiometricItemAllowed()).toBe(allowed);
  });

  it('an emulator in a release build: a failing protected write falls back, and the marker says so', async () => {
    device.isDevice = false;
    asBuild(false);
    store.protectedWrite = 'fail';

    expect(await writeBiometricToken(FAKE_TOKEN, OWNER, 'protected-with-fallback')).toEqual({ ok: true, protected: false });
    expect(store.isProtected(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(await readBiometricMarker()).toEqual({ ok: true, value: { ...OWNER, protected: false } });
    // Never silent: the failed protected write and the fallback are both in the runtime log.
    expect(reported.mock.calls.map((call) => [call[0], call[1]])).toEqual([
      ['warn', 'runtime.secureCredentials.writeBiometricToken'],
      ['warn', 'runtime.secureCredentials.biometricFallback'],
    ]);
    // The unprotected token is read without an OS prompt: the app's own prompt is the gate.
    expect(await readBiometricToken()).toEqual({ ok: true, value: FAKE_TOKEN });
    expect(store.prompts).toHaveLength(0);
  });

  it('a physical device in a debug build: the fallback is allowed', async () => {
    device.isDevice = true;
    asBuild(true);
    store.protectedWrite = 'fail';
    expect(await writeBiometricToken(FAKE_TOKEN, OWNER, 'protected-with-fallback')).toEqual({ ok: true, protected: false });
  });

  it('a physical device in a release build: a failing protected write turns biometric sign-in off and stores no token', async () => {
    device.isDevice = true;
    asBuild(false);
    store.protectedWrite = 'fail';

    const result = await writeBiometricToken(FAKE_TOKEN, OWNER, 'protected-with-fallback');
    expect(result).toEqual({ ok: false, code: 'AUTHENTICATION', reason: 'NO_BIOMETRICS_ENROLLED', nativeCode: 'ERR_AUTHENTICATION' });
    expect(store.keys()).toEqual([]);
    expect(reported.mock.calls.map((call) => (call[3] as { code: string }).code)).toEqual(['AUTHENTICATION', 'UNPROTECTED_NOT_ALLOWED']);
  });

  it('a physical device in a release build: an unprotected write is refused, and an older enrolment goes with it', async () => {
    device.isDevice = false;
    await writeBiometricToken(FAKE_TOKEN, OWNER, 'unprotected');
    expect(store.keys()).toHaveLength(2);

    device.isDevice = true;
    asBuild(false);
    expect(await writeBiometricToken(FAKE_ROTATED_TOKEN, OWNER, 'unprotected')).toEqual({
      ok: false,
      code: 'UNPROTECTED_NOT_ALLOWED',
      reason: null,
      nativeCode: null,
    });
    expect(store.keys()).toEqual([]);
  });

  it('a physical device in a release build: an unprotected token is not rotated; both items are deleted', async () => {
    device.isDevice = false;
    await writeBiometricToken(FAKE_TOKEN, OWNER, 'unprotected');

    device.isDevice = true;
    asBuild(false);
    expect(await rotateBiometricToken(FAKE_ROTATED_TOKEN)).toMatchObject({ ok: false, code: 'UNPROTECTED_NOT_ALLOWED' });
    expect(store.keys()).toEqual([]);
  });

  it('a cancelled prompt at the protected write is not a reason to fall back', async () => {
    device.isDevice = false;
    store.protectedWrite = 'fail';
    store.failure = 'user-canceled';

    expect(await writeBiometricToken(FAKE_TOKEN, OWNER, 'protected-with-fallback')).toMatchObject({ ok: false, code: 'AUTHENTICATION', reason: 'USER_CANCELED' });
    expect(store.keys()).toEqual([]);
  });

  it('a failing unprotected write leaves no token behind, not even the older one', async () => {
    device.isDevice = false;
    await writeBiometricToken(FAKE_TOKEN, OWNER, 'unprotected');
    expect(store.keys()).toHaveLength(2);

    store.failNext('write');
    expect(await writeBiometricToken(FAKE_ROTATED_TOKEN, OWNER, 'unprotected')).toMatchObject({ ok: false, code: 'WRITE_FAILED', nativeCode: 'ERR_WRITE' });
    expect(store.keys()).toEqual([]);
  });

  it('deleteBiometric removes the token and the marker', async () => {
    device.isDevice = false;
    await writeBiometricToken(FAKE_TOKEN, OWNER, 'unprotected');
    expect(await deleteBiometric()).toEqual({ ok: true });
    expect(store.keys()).toEqual([]);
    expect(await readBiometricToken()).toEqual({ ok: true, value: null });
  });
});

describe('the debug-build probe export', () => {
  it('writes, reads and deletes only the probe item', async () => {
    const probe = secureStoreDevProbe;
    expect(probe?.itemKey).toBe('dems.live.probe.v1');
    if (!probe) return;

    expect(await probe.write('PROBE_VALUE', false)).toEqual({ ok: true });
    expect(store.keys()).toEqual(['dems.live.probe.v1']);
    expect(await probe.read(false)).toEqual({ ok: true, value: 'PROBE_VALUE' });
    expect(await probe.remove()).toEqual({ ok: true });
    expect(await probe.read(false)).toEqual({ ok: true, value: null });

    store.protectedWrite = 'fail';
    expect(await probe.write('PROBE_VALUE', true)).toEqual({
      ok: false,
      code: 'AUTHENTICATION',
      reason: 'NO_BIOMETRICS_ENROLLED',
      nativeCode: 'ERR_AUTHENTICATION',
    });
    expect(store.keys()).toEqual([]);
    store.canUseBiometricAuthentication = false;
    expect(probe.canUseBiometricAuthentication()).toBe(false);
    // The probe prints its own lines; it writes nothing to the runtime log.
    expect(reported).not.toHaveBeenCalled();
  });

  it('is null in a build that is not a debug build', () => {
    asBuild(false);
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- the module must be evaluated again under the other build flag
      const release = require('./secure-credentials') as typeof import('./secure-credentials');
      expect(release.secureStoreDevProbe).toBeNull();
    });
  });
});
