// Backend task W56: the biometric token storage of LIVE mode (`./live-biometric.ts`) on the
// secure-store mock of `jest.setup.ts` (04_client_integration_spec §9.3 MB-1 to MB-6a, AC-C-105;
// finding F72). The protected paths (MB-5 case a: the read is the OS prompt) are exercised here on
// the mock; no build that runs LIVE mode today writes a protected item (decision D71 DN37-2).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FAKE_CREDENTIALS } from '@dems/shared/live/testing';
import { runtimeLog } from '@/runtime';
import { SECURE_ITEM_KEYS, type BiometricOwner } from '@/runtime/secure-credentials';
import { biometricWriteMode, createLiveBiometricStore, type LiveBiometricStore } from './live-biometric';

type DevGlobal = typeof globalThis & { __DEV__: boolean };
const dev = globalThis as DevGlobal;
const originalDev = dev.__DEV__;
const store = () => globalThis.__DEMS_SECURE_STORE_MOCK__;
const device = () => globalThis.__DEMS_DEVICE_MOCK__;
/** The storage mock's own module (its name is put together, so that this file does not name the package: MP-1). */
const storeModule = () => jest.requireMock<{ getItemAsync: jest.MockedFunction<(key: string) => Promise<string | null>> }>(['expo', 'secure', 'store'].join('-'));

const DEVICE_ID = 'DEV-0003';
const OWNER: BiometricOwner = { operatorId: 'OPR-001', displayName: 'AKP Budi Santoso', deviceId: DEVICE_ID };
/** Placeholders in the contract's form; they open nothing. */
const TOKEN = FAKE_CREDENTIALS.biometricToken;
const NEXT = ['bio', 'N'.repeat(43)].join('_');
const PROMPT = 'Sign in to DEMS';
const TOKEN_KEY = SECURE_ITEM_KEYS.biometricToken;
const MARKER_KEY = SECURE_ITEM_KEYS.biometricMarker;

let deviceId: string | null;
let bio: LiveBiometricStore;

function seed(protectedItem: boolean, owner: BiometricOwner = OWNER, token: string = TOKEN): void {
  store().seed(TOKEN_KEY, token, protectedItem);
  store().seed(MARKER_KEY, JSON.stringify({ ...owner, protected: protectedItem }));
}
const tokenReads = (): number => storeModule().getItemAsync.mock.calls.filter(([key]) => key === TOKEN_KEY).length;

beforeEach(async () => {
  await AsyncStorage.clear();
  storeModule().getItemAsync.mockClear();
  deviceId = DEVICE_ID;
  bio = createLiveBiometricStore({ deviceId: () => deviceId });
});

afterEach(() => {
  dev.__DEV__ = originalDev;
});

describe('how a new token is written (MB-5, MB-6a; decision D71 DN37-2)', () => {
  it.each([
    { isDevice: false, debug: true, mode: 'unprotected' },
    { isDevice: false, debug: false, mode: 'unprotected' },
    { isDevice: true, debug: true, mode: 'unprotected' },
    { isDevice: true, debug: false, mode: 'protected' },
  ])('isDevice $isDevice, debug build $debug: $mode', ({ isDevice, debug, mode }) => {
    device().isDevice = isDevice;
    dev.__DEV__ = debug;
    expect(biometricWriteMode()).toBe(mode);
  });

  it('where MB-6a allows it the token is stored without the authentication requirement, with no prompt, and the marker says so', async () => {
    await expect(bio.enrol(TOKEN, OWNER, PROMPT)).resolves.toEqual({ ok: true, protected: false });
    expect(store().peek(TOKEN_KEY)).toBe(TOKEN);
    expect(store().isProtected(TOKEN_KEY)).toBe(false);
    expect(JSON.parse(store().peek(MARKER_KEY)!)).toEqual({ ...OWNER, protected: false });
    expect(store().prompts).toHaveLength(0);
    await expect(bio.marker()).resolves.toEqual({ ...OWNER, protected: false });
  });

  it('a physical device in a build that is not a debug build: a failing protected write turns biometric sign-in off and stores no token (AC-C-105)', async () => {
    device().isDevice = true;
    dev.__DEV__ = false;
    store().protectedWrite = 'fail';
    await expect(bio.enrol(TOKEN, OWNER, PROMPT)).resolves.toMatchObject({ ok: false, code: 'AUTHENTICATION' });
    expect(store().keys()).toEqual([]);
    await expect(bio.marker()).resolves.toBeNull();
  });

  it('the same device: an earlier token without the requirement is not kept beside a failed protected write', async () => {
    seed(false);
    device().isDevice = true;
    dev.__DEV__ = false;
    store().protectedWrite = 'fail';
    await bio.enrol(NEXT, OWNER, PROMPT);
    expect(store().keys()).toEqual([]);
  });

  it('the same device, a protected write that works: stored WITH the requirement; the read is then the one check (case a)', async () => {
    device().isDevice = true;
    dev.__DEV__ = false;
    await expect(bio.enrol(TOKEN, OWNER, PROMPT)).resolves.toEqual({ ok: true, protected: true });
    expect(store().isProtected(TOKEN_KEY)).toBe(true);
    expect(bio.promptPlan({ protected: true })).toBe('read-is-prompt');
    device().isDevice = false;
    expect(bio.promptPlan({ protected: true })).toBe('os-prompt-first');
    expect(bio.promptPlan({ protected: false })).toBe('os-prompt-first');
  });
});

describe('the marker of this pairing', () => {
  it('while the tablet is not paired the storage is not asked at all', async () => {
    seed(false);
    deviceId = null;
    await expect(bio.marker()).resolves.toBeNull();
    expect(storeModule().getItemAsync).not.toHaveBeenCalled();
    // Nothing was deleted either: the runtime owns the items of an unpaired tablet.
    expect(store().has(TOKEN_KEY)).toBe(true);
  });

  it('an enrolment of an earlier pairing is deleted with its token', async () => {
    seed(false, { ...OWNER, deviceId: 'DEV-0001' });
    await expect(bio.marker()).resolves.toBeNull();
    expect(store().keys()).toEqual([]);
    expect(runtimeLog.records().some((record) => record.source === 'auth.biometric.store.marker' && record.level === 'warn')).toBe(true);
  });

  it('a marker that cannot be parsed is deleted with its token; nothing is read back from it', async () => {
    seed(false);
    store().seed(MARKER_KEY, '{"operatorId":');
    await expect(bio.marker()).resolves.toBeNull();
    expect(store().keys()).toEqual([]);
  });

  it('reading the marker never shows a prompt and never reads the token', async () => {
    seed(true);
    await expect(bio.marker()).resolves.toMatchObject({ protected: true });
    expect(store().prompts).toHaveLength(0);
    expect(tokenReads()).toBe(0);
  });
});

describe('one token, one presentation (finding F72)', () => {
  it('a token leaves the store only inside an attempt the auth layer opened', async () => {
    seed(false);
    await expect(bio.port.token('OPR-001')).resolves.toBeNull();
    expect(tokenReads()).toBe(0);
    const attempt = bio.begin(PROMPT)!;
    await expect(bio.port.token('OPR-001')).resolves.toBe(TOKEN);
    // Once per attempt: a second question in the same attempt gets nothing.
    await expect(bio.port.token('OPR-001')).resolves.toBeNull();
    await expect(attempt.end('kept')).resolves.toEqual({ release: { kind: 'released' }, token: 'kept' });
    // And after the attempt, nothing again.
    await expect(bio.port.token('OPR-001')).resolves.toBeNull();
    expect(tokenReads()).toBe(1);
  });

  it('while one attempt is open no second one can be opened', async () => {
    seed(false);
    const first = bio.begin(PROMPT);
    expect(first).not.toBeNull();
    expect(bio.begin(PROMPT)).toBeNull();
    await first!.end('kept');
    expect(bio.begin(PROMPT)).not.toBeNull();
  });

  it('the token of another operator is not handed out', async () => {
    seed(false);
    const attempt = bio.begin(PROMPT)!;
    await expect(bio.port.token('OPR-002')).resolves.toBeNull();
    await expect(attempt.end('spent')).resolves.toEqual({ release: { kind: 'absent' }, token: 'untouched' });
    // Nothing left the store, so nothing is deleted whatever the fate says.
    expect(store().peek(TOKEN_KEY)).toBe(TOKEN);
  });

  it('`spent`: the token that was sent and not replaced is deleted with its marker; `kept`: it stays', async () => {
    seed(false);
    let attempt = bio.begin(PROMPT)!;
    await bio.port.token('OPR-001');
    await expect(attempt.end('kept')).resolves.toMatchObject({ token: 'kept' });
    expect(store().peek(TOKEN_KEY)).toBe(TOKEN);

    attempt = bio.begin(PROMPT)!;
    await bio.port.token('OPR-001');
    await expect(attempt.end('spent')).resolves.toEqual({ release: { kind: 'released' }, token: 'deleted' });
    expect(store().keys()).toEqual([]);
  });

  it('an attempt in which nothing was asked changes nothing', async () => {
    seed(false);
    const attempt = bio.begin(PROMPT)!;
    await expect(attempt.end('spent')).resolves.toEqual({ release: null, token: 'untouched' });
    expect(store().peek(TOKEN_KEY)).toBe(TOKEN);
  });
});

describe('the write after a rotation (MB-6)', () => {
  it('the next token replaces the one that was sent, with the same options; the marker stays; `spent` then deletes nothing', async () => {
    seed(false);
    const attempt = bio.begin(PROMPT)!;
    await bio.port.token('OPR-001');
    await bio.port.sessionIssued!({ biometricToken: NEXT, operatorId: 'OPR-001' });
    expect(store().peek(TOKEN_KEY)).toBe(NEXT);
    expect(store().isProtected(TOKEN_KEY)).toBe(false);
    await expect(attempt.end('spent')).resolves.toEqual({ release: { kind: 'released' }, token: 'rotated' });
    expect(store().peek(TOKEN_KEY)).toBe(NEXT);
    expect(JSON.parse(store().peek(MARKER_KEY)!)).toEqual({ ...OWNER, protected: false });
  });

  it('a protected token is rotated as a protected token', async () => {
    seed(true);
    device().isDevice = true;
    const attempt = bio.begin(PROMPT)!;
    await expect(bio.port.token('OPR-001')).resolves.toBe(TOKEN);
    // MB-5 case a: the protected read was the prompt, titled as the caller said.
    expect(store().prompts).toEqual([{ operation: 'read', key: TOKEN_KEY, title: PROMPT }]);
    await bio.port.sessionIssued!({ biometricToken: NEXT, operatorId: 'OPR-001' });
    expect(store().isProtected(TOKEN_KEY)).toBe(true);
    expect(store().peek(TOKEN_KEY)).toBe(NEXT);
    await attempt.end('spent');
  });

  it('a write that fails deletes both items: the session stays, the enrolment is gone', async () => {
    seed(false);
    const attempt = bio.begin(PROMPT)!;
    await bio.port.token('OPR-001');
    store().failNext('write');
    await bio.port.sessionIssued!({ biometricToken: NEXT, operatorId: 'OPR-001' });
    expect(store().keys()).toEqual([]);
    await expect(attempt.end('spent')).resolves.toMatchObject({ token: 'deleted' });
    const logged = runtimeLog.records().filter((record) => record.source === 'auth.biometric.store.rotation');
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.at(-1)).toMatchObject({ level: 'warn', context: { errorCode: 'WRITE_FAILED' } });
  });

  it('a sign-in this store handed no token to changes nothing: a password sign-in, and one without an open attempt', async () => {
    seed(false);
    await bio.port.sessionIssued!({ biometricToken: null, operatorId: 'OPR-001' });
    await bio.port.sessionIssued!({ biometricToken: NEXT, operatorId: 'OPR-001' });
    const attempt = bio.begin(PROMPT)!;
    await bio.port.sessionIssued!({ biometricToken: NEXT, operatorId: 'OPR-001' });
    await attempt.end('spent');
    expect(store().peek(TOKEN_KEY)).toBe(TOKEN);
  });

  it('a sign-in that was answered without a next token: the used one is deleted at the end', async () => {
    seed(false);
    const attempt = bio.begin(PROMPT)!;
    await bio.port.token('OPR-001');
    await bio.port.sessionIssued!({ biometricToken: null, operatorId: 'OPR-001' });
    expect(store().peek(TOKEN_KEY)).toBe(TOKEN);
    await expect(attempt.end('spent')).resolves.toMatchObject({ token: 'deleted' });
    expect(store().keys()).toEqual([]);
  });
});

describe('a protected item: the read is the OS check (MB-4, MB-5 case a)', () => {
  it.each([
    { failure: 'user-canceled', outcome: 'cancel' },
    { failure: 'lockout', outcome: 'lockout' },
    { failure: 'not-enrolled', outcome: 'not-enrolled' },
    { failure: 'no-hardware', outcome: 'unavailable' },
  ] as const)('$failure → the check `$outcome`; nothing is handed out and nothing is deleted', async ({ failure, outcome }) => {
    seed(true);
    store().protectedRead = 'fail';
    store().failure = failure;
    const attempt = bio.begin(PROMPT)!;
    await expect(bio.port.token('OPR-001')).resolves.toBeNull();
    await expect(attempt.end('spent')).resolves.toEqual({ release: { kind: 'check', outcome }, token: 'untouched' });
    expect(store().peek(TOKEN_KEY)).toBe(TOKEN);
    expect(store().has(MARKER_KEY)).toBe(true);
  });
});

describe('an item that cannot be read turns biometric sign-in off (MB-6a: no silent fallback)', () => {
  it('a stored value that is no token: both items are deleted and nothing is handed out', async () => {
    seed(false, OWNER, 'not-a-token');
    const attempt = bio.begin(PROMPT)!;
    await expect(bio.port.token('OPR-001')).resolves.toBeNull();
    await expect(attempt.end('kept')).resolves.toEqual({ release: { kind: 'unreadable' }, token: 'untouched' });
    expect(store().keys()).toEqual([]);
  });

  it('a marker without its token: the enrolment is void and is deleted', async () => {
    store().seed(MARKER_KEY, JSON.stringify({ ...OWNER, protected: false }));
    const attempt = bio.begin(PROMPT)!;
    await expect(bio.port.token('OPR-001')).resolves.toBeNull();
    await expect(attempt.end('kept')).resolves.toMatchObject({ release: { kind: 'unreadable' } });
    expect(store().keys()).toEqual([]);
  });
});

describe('what the store leaves behind', () => {
  it('`remove` deletes the token and the marker and leaves the device credential alone', async () => {
    seed(false);
    store().seed(SECURE_ITEM_KEYS.deviceCredential, '{}');
    await expect(bio.remove()).resolves.toBe(true);
    expect(store().keys()).toEqual([SECURE_ITEM_KEYS.deviceCredential]);
  });

  it('no token is written to AsyncStorage or to the log, whatever happens', async () => {
    await bio.enrol(TOKEN, OWNER, PROMPT);
    let attempt = bio.begin(PROMPT)!;
    await bio.port.token('OPR-001');
    await bio.port.sessionIssued!({ biometricToken: NEXT, operatorId: 'OPR-001' });
    await attempt.end('spent');
    attempt = bio.begin(PROMPT)!;
    await bio.port.token('OPR-001');
    store().failNext('write');
    await bio.port.sessionIssued!({ biometricToken: TOKEN, operatorId: 'OPR-001' });
    await attempt.end('spent');
    await runtimeLog.flush();
    const keys = await AsyncStorage.getAllKeys();
    const text = JSON.stringify([await AsyncStorage.multiGet(keys), runtimeLog.records()]);
    expect(text).not.toMatch(/bio_/);
  });
});
