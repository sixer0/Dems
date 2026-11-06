// Row 236 (D263, the user's Core server address setting): the runtime's one source of the Core origin
// (`./core-address.ts`). The rules of an address (accepted and refused cases), the origins built from it, the
// stored preference, and what a change forgets: the stored device credential, the owed sign-out (row 224) and
// the simulator snapshot, BEFORE the new address is in force (R225-F3: never send a credential to another Core).
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CORE_API_EXAMPLES, type PairingRedeemed } from '@dems/shared/api';
import { SIM_STORAGE_KEY } from '@dems/shared/sim';
import { MOBILE_PREFS_KEY } from '@/motion/prefs';
import {
  DEFAULT_CORE_ADDRESS,
  checkCoreHost,
  coreOriginOf,
  formatCoreAddress,
  getCoreAddress,
  hydrateCoreAddress,
  parseStoredCoreAddress,
  resetCoreAddressForTests,
  setCoreAddress,
  validateCoreAddress,
} from './core-address';
import { OWED_SIGN_OUT_ITEM_KEY, SECURE_ITEM_KEYS } from './secure-credentials';

const secure = globalThis.__DEMS_SECURE_STORE_MOCK__;
const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const OWED = JSON.stringify({ operatorId: 'OPR-001', issuedAt: 1_793_900_000_000, reason: 'USER', at: 1_793_900_060_000, token: `ses_${'a'.repeat(43)}` });

beforeEach(async () => {
  await AsyncStorage.clear();
  secure.reset();
  resetCoreAddressForTests();
});
afterEach(() => resetCoreAddressForTests());

describe('the rules of a Core server address (D263)', () => {
  it('the default is the loopback Core over adb reverse: 127.0.0.1:4420, and it passes its own rules', () => {
    expect(formatCoreAddress(DEFAULT_CORE_ADDRESS)).toBe('127.0.0.1:4420');
    expect(validateCoreAddress(DEFAULT_CORE_ADDRESS.host, String(DEFAULT_CORE_ADDRESS.port))).toEqual({ ok: true, address: DEFAULT_CORE_ADDRESS });
  });

  it.each([
    ['10.0.0.5', '10.0.0.5'],
    ['10.255.255.255', '10.255.255.255'],
    ['172.16.0.1', '172.16.0.1'],
    ['172.31.255.254', '172.31.255.254'],
    ['192.168.1.20', '192.168.1.20'],
    ['127.0.0.1', '127.0.0.1'],
    ['127.8.9.10', '127.8.9.10'],
    ['169.254.10.20', '169.254.10.20'],
    ['localhost', 'localhost'],
    ['  Core-01.dems.lan  ', 'core-01.dems.lan'],
    ['dems-core', 'dems-core'],
    ['a', 'a'],
  ])('accepts the host %j (as %j)', (text, host) => {
    expect(checkCoreHost(text)).toEqual({ ok: true, host });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['http://192.168.1.20', 'scheme'],
    ['ws://192.168.1.20:4420/ws', 'scheme'],
    ['https://core.lan', 'scheme'],
    ['192.168.1.20/ws', 'path'],
    ['core.lan/api', 'path'],
    ['core.lan?x=1', 'path'],
    ['192.168.1.20:4420', 'withPort'],
    ['::1', 'ipv6'],
    ['fe80::1', 'ipv6'],
    ['[::1]', 'ipv6'],
    ['2001:db8::5', 'ipv6'],
    ['8.8.8.8', 'notPrivateIpv4'],
    ['1.1.1.1', 'notPrivateIpv4'],
    ['172.15.0.1', 'notPrivateIpv4'],
    ['172.32.0.1', 'notPrivateIpv4'],
    ['192.169.0.1', 'notPrivateIpv4'],
    ['169.253.0.1', 'notPrivateIpv4'],
    ['0.0.0.0', 'notPrivateIpv4'],
    ['255.255.255.255', 'notPrivateIpv4'],
    ['224.0.0.1', 'notPrivateIpv4'],
    ['10.0.0', 'badIpv4'],
    ['10.0.0.256', 'badIpv4'],
    ['010.0.0.1', 'badIpv4'],
    ['10..0.1', 'badIpv4'],
    ['core_lan', 'badHost'],
    ['-core.lan', 'badHost'],
    ['core-.lan', 'badHost'],
    ['core..lan', 'badHost'],
    ['core.lan.', 'badHost'],
    ['user@core.lan', 'badHost'],
    ['core lan', 'badHost'],
    [`${'a'.repeat(64)}.lan`, 'badHost'],
  ])('refuses the host %j: %s', (text, problem) => {
    expect(checkCoreHost(text)).toEqual({ ok: false, problem });
  });

  it('a port is 1-65535, digits only', () => {
    for (const port of ['1', '4420', '65535', ' 8080 ']) expect(validateCoreAddress('10.0.0.5', port)).toEqual({ ok: true, address: { host: '10.0.0.5', port: Number(port) } });
    expect(validateCoreAddress('10.0.0.5', '')).toEqual({ ok: false, host: null, port: 'empty' });
    expect(validateCoreAddress('10.0.0.5', '0')).toEqual({ ok: false, host: null, port: 'range' });
    expect(validateCoreAddress('10.0.0.5', '65536')).toEqual({ ok: false, host: null, port: 'range' });
    expect(validateCoreAddress('10.0.0.5', '99999')).toEqual({ ok: false, host: null, port: 'range' });
    for (const port of ['44a', '-1', '4420.0', '123456', '1e3']) expect(validateCoreAddress('10.0.0.5', port)).toEqual({ ok: false, host: null, port: 'notNumber' });
    // Both refusals at once: each field gets its own sentence.
    expect(validateCoreAddress('8.8.8.8', '0')).toEqual({ ok: false, host: 'notPrivateIpv4', port: 'range' });
  });

  it('the origins of an address: HTTP for the typed client and the media routes, WS for the Live socket', () => {
    expect(coreOriginOf(DEFAULT_CORE_ADDRESS)).toEqual({ http: 'http://127.0.0.1:4420', ws: 'ws://127.0.0.1:4420/ws' });
    expect(coreOriginOf({ host: 'core.lan', port: 8443 })).toEqual({ http: 'http://core.lan:8443', ws: 'ws://core.lan:8443/ws' });
  });
});

describe('the stored address (dems.mobile.prefs.v1 → coreAddress)', () => {
  it('missing → the default; a stored valid address is read; a stored refused one → the default, flagged', () => {
    expect(parseStoredCoreAddress(null)).toEqual({ address: DEFAULT_CORE_ADDRESS, invalid: false });
    expect(parseStoredCoreAddress(JSON.stringify({ reduceMotion: true }))).toEqual({ address: DEFAULT_CORE_ADDRESS, invalid: false });
    expect(parseStoredCoreAddress(JSON.stringify({ coreAddress: { host: '10.0.0.5', port: 4420 } }))).toEqual({ address: { host: '10.0.0.5', port: 4420 }, invalid: false });
    expect(parseStoredCoreAddress(JSON.stringify({ coreAddress: { host: '8.8.8.8', port: 4420 } }))).toEqual({ address: DEFAULT_CORE_ADDRESS, invalid: true });
    expect(parseStoredCoreAddress(JSON.stringify({ coreAddress: 'http://10.0.0.5:4420' }))).toEqual({ address: DEFAULT_CORE_ADDRESS, invalid: true });
  });

  it('hydration reads the stored address once; other fields of the key stay when the address is written (merge, D57)', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ reduceMotion: true, coreAddress: { host: '192.168.1.20', port: 4420 } }));
    await hydrateCoreAddress();
    expect(getCoreAddress()).toEqual({ host: '192.168.1.20', port: 4420 });
    await expect(setCoreAddress({ host: '10.0.0.5', port: 5000 })).resolves.toBe('changed');
    expect(JSON.parse((await AsyncStorage.getItem(MOBILE_PREFS_KEY)) ?? '{}')).toEqual({ reduceMotion: true, coreAddress: { host: '10.0.0.5', port: 5000 } });
  });
});

describe('changing the address resets the pairing (D263, R225-F3)', () => {
  function seedPairing(): void {
    secure.seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(REDEEMED));
    secure.seed(OWED_SIGN_OUT_ITEM_KEY, OWED);
  }

  it('a new address forgets the stored device credential, the owed sign-out and the simulator snapshot, then is in force', async () => {
    seedPairing();
    await AsyncStorage.setItem(SIM_STORAGE_KEY, '{"state":{}}');
    expect(secure.has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    expect(secure.has(OWED_SIGN_OUT_ITEM_KEY)).toBe(true);

    await expect(setCoreAddress({ host: '192.168.1.20', port: 4420 })).resolves.toBe('changed');
    expect(secure.has(SECURE_ITEM_KEYS.deviceCredential)).toBe(false);
    expect(secure.has(OWED_SIGN_OUT_ITEM_KEY)).toBe(false);
    expect(await AsyncStorage.getItem(SIM_STORAGE_KEY)).toBeNull();
    expect(getCoreAddress()).toEqual({ host: '192.168.1.20', port: 4420 });
  });

  it('the same address (after normalising) changes nothing and forgets nothing', async () => {
    seedPairing();
    await expect(setCoreAddress({ host: '127.0.0.1', port: 4420 })).resolves.toBe('unchanged');
    await setCoreAddress({ host: '10.0.0.5', port: 4420 });
    seedPairing();
    await expect(setCoreAddress({ host: ' 10.0.0.5 ', port: 4420 })).resolves.toBe('unchanged');
    expect(secure.has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    expect(secure.has(OWED_SIGN_OUT_ITEM_KEY)).toBe(true);
  });

  it('an address the rules refuse is not taken: nothing is forgotten', async () => {
    seedPairing();
    await expect(setCoreAddress({ host: '8.8.8.8', port: 4420 })).resolves.toBe('invalid');
    await expect(setCoreAddress({ host: '10.0.0.5', port: 0 })).resolves.toBe('invalid');
    expect(getCoreAddress()).toEqual(DEFAULT_CORE_ADDRESS);
    expect(secure.has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
  });

  it('a credential that could not be deleted keeps the old address: no credential can reach the new Core', async () => {
    seedPairing();
    secure.failNext('delete');
    await expect(setCoreAddress({ host: '192.168.1.20', port: 4420 })).resolves.toBe('resetFailed');
    expect(getCoreAddress()).toEqual(DEFAULT_CORE_ADDRESS);
    expect(JSON.parse((await AsyncStorage.getItem(MOBILE_PREFS_KEY)) ?? '{}')).not.toHaveProperty('coreAddress');
    // A second try, with a working store, goes through.
    await expect(setCoreAddress({ host: '192.168.1.20', port: 4420 })).resolves.toBe('changed');
    expect(secure.has(SECURE_ITEM_KEYS.deviceCredential)).toBe(false);
  });
});
