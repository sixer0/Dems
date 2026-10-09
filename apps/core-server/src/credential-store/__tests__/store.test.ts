// The Core credential store (blueprint row 84; SEC35-03, SEC35-08, SEC35-09; D68(c), D80(7), D83
// F-122-2): the key files, the credential envelope, the rotation hook, the session keys and the
// named secrets, on a throw-away directory of the system's temporary folder. No database.
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { ENVELOPE_FRAME_BLOCK, ENVELOPE_TAG_BYTES, openSecret, sealSecret } from '../envelope';
import { CredentialStoreError } from '../errors';
import { KEY_MARK, disposeKey, keyMaterialOf, usingKeyBytes } from '../key-material';
import { createFileKeyStore } from '../key-store';
import { CORE_EVIDENCE_SIGNING_KEY_ID, type KeyWrapSecrets } from '../../capture/signer/types';
import { CredentialPurpose, coreCredentialStore, createCredentialStore, isSealedSecret, type SealedSecret } from '../index';

const folders: string[] = [];
const dataDir = (): string => {
  const folder = mkdtempSync(join(tmpdir(), 'dems-row84-'));
  folders.push(folder);
  return folder;
};
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

const codeOf = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof CredentialStoreError ? error.code : `not a store error: ${String(error)}`;
  }
};
const modeOf = (path: string): number => lstatSync(path).mode & 0o777;
const keyFiles = (root: string): string[] => (existsSync(join(root, 'keys')) ? readdirSync(join(root, 'keys')).sort() : []);
/** Built from parts, so that no other file of the repository holds it. */
const CANARY = ['row84', 'CANARY', 'Xk2Lw9Pq7Tz4'].join('-');

describe('the key files', () => {
  it('a key is one private file in private directories, made once, synced, and read back as the same key', () => {
    const root = join(dataDir(), 'credential-store');
    const keys = createFileKeyStore({ root });
    expect(keys.inspect()).toBe('ABSENT');
    expect(existsSync(root)).toBe(false);
    const made = keys.create('KEY_A');
    expect(keys.inspect()).toBe('READY');
    expect([modeOf(root), modeOf(join(root, 'keys')), modeOf(join(root, 'keys', 'KEY_A.key'))]).toEqual([0o700, 0o700, 0o600]);
    expect(readFileSync(join(root, 'keys', 'KEY_A.key')).byteLength).toBe(40);
    const read = keys.open('KEY_A');
    expect(usingKeyBytes(read, (bytes) => bytes.toString('hex'))).toBe(usingKeyBytes(made, (bytes) => bytes.toString('hex')));
    expect(codeOf(() => keys.create('KEY_A'))).toBe('CREDENTIAL_KEY_EXISTS');
    expect(keys.list()).toEqual(['KEY_A']);
    expect([keys.has('KEY_A'), keys.has('KEY_B')]).toEqual([true, false]);
  });

  it('two keys are never the same, and a random source of the wrong size is refused', () => {
    const root = join(dataDir(), 'credential-store');
    const keys = createFileKeyStore({ root });
    const hex = ['A', 'B', 'C'].map((ref) => usingKeyBytes(keys.create(ref), (bytes) => bytes.toString('hex')));
    expect(new Set(hex).size).toBe(3);
    expect(codeOf(() => createFileKeyStore({ root, randomKey: () => new Uint8Array(16) }).create('SHORT'))).toBe('CREDENTIAL_KEY_WRITE_FAILED');
    expect(keys.has('SHORT')).toBe(false);
  });

  it('a reference that is not a file name is refused before any file is touched', () => {
    const base = dataDir();
    const keys = createFileKeyStore({ root: join(base, 'credential-store') });
    for (const ref of ['', '../pg', 'a/b', '.hidden', 'a.b', '-x', 'x'.repeat(81), 'a b']) {
      expect(codeOf(() => keys.create(ref)), ref).toBe('CREDENTIAL_KEY_REF_INVALID');
      expect(codeOf(() => keys.open(ref)), ref).toBe('CREDENTIAL_KEY_REF_INVALID');
      expect(codeOf(() => keys.destroy(ref)), ref).toBe('CREDENTIAL_KEY_REF_INVALID');
    }
    expect(readdirSync(base)).toEqual([]);
  });

  it('fails closed on a key file that is not private, not a key file, a link, or gone', () => {
    const root = join(dataDir(), 'credential-store');
    const keys = createFileKeyStore({ root });
    keys.create('GOOD');
    const file = (ref: string): string => join(root, 'keys', `${ref}.key`);
    expect(codeOf(() => keys.open('MISSING'))).toBe('CREDENTIAL_KEY_NOT_FOUND');
    chmodSync(file('GOOD'), 0o640);
    expect(codeOf(() => keys.open('GOOD'))).toBe('CREDENTIAL_KEY_UNSAFE');
    chmodSync(file('GOOD'), 0o600);
    expect(codeOf(() => keys.open('GOOD'))).toBeNull();
    writeFileSync(file('SHORT'), Buffer.alloc(32), { mode: 0o600 });
    expect(codeOf(() => keys.open('SHORT'))).toBe('CREDENTIAL_KEY_UNSAFE');
    writeFileSync(file('NOMARK'), Buffer.alloc(40), { mode: 0o600 });
    expect(codeOf(() => keys.open('NOMARK'))).toBe('CREDENTIAL_KEY_UNSAFE');
    symlinkSync(file('GOOD'), file('LINK'));
    expect(codeOf(() => keys.open('LINK'))).toBe('CREDENTIAL_KEY_UNSAFE');
  });

  it('refuses a store directory that others may read, and never makes the data directory', () => {
    const base = dataDir();
    const root = join(base, 'credential-store');
    mkdirSync(root, { mode: 0o755 });
    chmodSync(root, 0o755);
    const keys = createFileKeyStore({ root });
    expect(codeOf(() => keys.inspect())).toBe('CREDENTIAL_STORE_UNSAFE');
    expect(codeOf(() => keys.create('KEY_A'))).toBe('CREDENTIAL_STORE_UNSAFE');
    const nowhere = createFileKeyStore({ root: join(base, 'no-such-data-dir', 'credential-store') });
    expect(codeOf(() => nowhere.create('KEY_A'))).toBe('CREDENTIAL_STORE_UNAVAILABLE');
    expect(existsSync(join(base, 'no-such-data-dir'))).toBe(false);
  });

  it('destroy removes the key: what it sealed cannot be opened again (no second copy)', () => {
    const root = join(dataDir(), 'credential-store');
    const keys = createFileKeyStore({ root });
    keys.create('GONE');
    expect([keys.destroy('GONE'), keys.destroy('GONE')]).toEqual([true, false]);
    expect(codeOf(() => keys.open('GONE'))).toBe('CREDENTIAL_KEY_NOT_FOUND');
    expect(keyFiles(root)).toEqual([]);
  });

  it('key material prints as a mark in every form, and is unusable once disposed', () => {
    const bytes = Buffer.alloc(32, 0xab);
    const key = keyMaterialOf(bytes);
    const hex = bytes.toString('hex');
    const printed = [String(key), JSON.stringify({ key }), inspect(key), inspect({ nested: [key] }, { depth: 5 }), `${key}`, JSON.stringify(Object.entries(key))];
    for (const text of printed) expect(text).not.toContain(hex);
    expect(printed.slice(0, 3)).toEqual([KEY_MARK, `{"key":"${KEY_MARK}"}`, KEY_MARK]);
    expect(Object.keys(key)).toEqual([]);
    disposeKey(key);
    expect(codeOf(() => usingKeyBytes(key, () => 1))).toBe('CREDENTIAL_KEY_NOT_FOUND');
    expect(codeOf(() => keyMaterialOf(Buffer.alloc(31)))).toBe('CREDENTIAL_KEY_UNSAFE');
  });
});

describe('the credential envelope, version 1', () => {
  const context = { purpose: 'STT_API_KEY', subject: 'stt_config', keyRef: 'STT_API_KEY_K_00' };
  const key = (): ReturnType<typeof keyMaterialOf> => keyMaterialOf(Buffer.from(Array.from({ length: 32 }, (_unused, index) => index)));

  it('round trip: what opens is what was sealed, for one character, for 1024 and for text outside ASCII', () => {
    for (const secret of ['x', CANARY, 'p'.repeat(1024), 'kata sandi é中🔑', ' leading and trailing ', '\u0000']) {
      const sealed = sealSecret(key(), context, secret);
      expect(isSealedSecret(sealed)).toBe(true);
      expect(openSecret(key(), context, sealed)).toBe(secret);
    }
  });

  it('F-122-2: a one-character secret is stored as 80 bytes; every ciphertext is a padded frame and its tag', () => {
    const lengths = [1, 16, 17, 61, 62, 100, 1024].map((length) => sealSecret(key(), context, 's'.repeat(length)).ciphertext.byteLength);
    expect(lengths).toEqual([80, 80, 80, 80, 144, 144, 1104]);
    for (const length of lengths) {
      expect(length).toBeGreaterThanOrEqual(33);
      expect((length - ENVELOPE_TAG_BYTES) % ENVELOPE_FRAME_BLOCK).toBe(0);
    }
    // Negative control: the bare AES-256-GCM of one character is 17 bytes, which the 33-byte CHECK refuses.
    expect(1 + ENVELOPE_TAG_BYTES).toBeLessThan(33);
  });

  it('the stored bytes hold the secret in no encoding, and two envelopes of one secret share nothing', () => {
    const first = sealSecret(key(), context, CANARY);
    const second = sealSecret(key(), context, CANARY);
    for (const sealed of [first, second]) {
      const stored = Buffer.concat([Buffer.from(sealed.ciphertext), Buffer.from(sealed.nonce)]);
      expect(stored.includes(Buffer.from(CANARY))).toBe(false);
      expect(stored.toString('latin1')).not.toContain(Buffer.from(CANARY).toString('base64'));
      expect(JSON.stringify(sealed)).not.toContain(CANARY);
    }
    expect(Buffer.from(first.nonce).equals(Buffer.from(second.nonce))).toBe(false);
    expect(Buffer.from(first.ciphertext).equals(Buffer.from(second.ciphertext))).toBe(false);
  });

  it('tamper fails closed: any altered byte of the ciphertext, the tag or the nonce, with one code', () => {
    const sealed = sealSecret(key(), context, CANARY);
    for (const index of [0, 1, 40, sealed.ciphertext.byteLength - 17, sealed.ciphertext.byteLength - 16, sealed.ciphertext.byteLength - 1]) {
      const ciphertext = new Uint8Array(sealed.ciphertext);
      ciphertext[index] = (ciphertext[index] ?? 0) ^ 0x01;
      expect(codeOf(() => openSecret(key(), context, { ...sealed, ciphertext })), `byte ${index}`).toBe('CREDENTIAL_OPEN_FAILED');
    }
    const nonce = new Uint8Array(sealed.nonce);
    nonce[0] = (nonce[0] ?? 0) ^ 0x80;
    expect(codeOf(() => openSecret(key(), context, { ...sealed, nonce }))).toBe('CREDENTIAL_OPEN_FAILED');
    // Positive control: untouched, it opens.
    expect(openSecret(key(), context, sealed)).toBe(CANARY);
  });

  it('a wrong key, another purpose, another subject and another key reference do not open', () => {
    const sealed = sealSecret(key(), context, CANARY);
    const other = keyMaterialOf(Buffer.alloc(32, 7));
    expect(codeOf(() => openSecret(other, context, sealed))).toBe('CREDENTIAL_OPEN_FAILED');
    expect(codeOf(() => openSecret(key(), { ...context, purpose: 'CAPTURE_DEVICE' }, sealed))).toBe('CREDENTIAL_OPEN_FAILED');
    expect(codeOf(() => openSecret(key(), { ...context, subject: 'CAM-02' }, sealed))).toBe('CREDENTIAL_OPEN_FAILED');
    expect(codeOf(() => openSecret(key(), { ...context, keyRef: 'STT_API_KEY_K_01' }, { ...sealed, keyRef: 'STT_API_KEY_K_01' }))).toBe('CREDENTIAL_OPEN_FAILED');
    expect(codeOf(() => openSecret(key(), context, { ...sealed, keyRef: 'STT_API_KEY_K_01' }))).toBe('CREDENTIAL_ENVELOPE_INVALID');
  });

  it('refuses what cannot be sealed or is no envelope, and no failure text holds the secret', () => {
    expect(codeOf(() => sealSecret(key(), context, ''))).toBe('CREDENTIAL_PLAINTEXT_INVALID');
    expect(codeOf(() => sealSecret(key(), context, 'x'.repeat(4097)))).toBe('CREDENTIAL_PLAINTEXT_INVALID');
    expect(codeOf(() => sealSecret(key(), context, 'lone \ud800 surrogate'))).toBe('CREDENTIAL_PLAINTEXT_INVALID');
    expect(codeOf(() => sealSecret(key(), { ...context, subject: `a\u0000b` }, 'x'))).toBe('CREDENTIAL_ENVELOPE_INVALID');
    const sealed = sealSecret(key(), context, CANARY);
    expect(codeOf(() => openSecret(key(), context, { ...sealed, ciphertext: sealed.ciphertext.subarray(0, 40) }))).toBe('CREDENTIAL_ENVELOPE_INVALID');
    expect(codeOf(() => openSecret(key(), context, { ...sealed, nonce: new Uint8Array(11) }))).toBe('CREDENTIAL_ENVELOPE_INVALID');
    try {
      openSecret(keyMaterialOf(Buffer.alloc(32, 9)), context, sealed);
      expect.unreachable();
    } catch (error) {
      const text = `${String(error)} ${JSON.stringify(error)} ${inspect(error, { depth: 6 })} ${(error as Error).stack ?? ''}`;
      expect(text).not.toContain(CANARY);
      expect((error as { cause?: unknown }).cause).toBeUndefined();
    }
  });
});

describe('the store: one key per credential, the rotation hook, session keys, named secrets', () => {
  const build = (): { root: string; store: ReturnType<typeof createCredentialStore> } => {
    const root = join(dataDir(), 'credential-store');
    return { root, store: createCredentialStore({ root }) };
  };

  it('STT: seal then open; the reference is a CODE of the table; the key file holds no part of the secret', async () => {
    const { root, store } = build();
    const sealed = await store.stt.seal(CANARY);
    expect(sealed.keyRef).toMatch(/^STT_API_KEY_K_[0-9A-F]{20}$/);
    expect(sealed.keyRef).toMatch(/^[A-Z][A-Z0-9_]{0,63}$/);
    expect([sealed.nonce.byteLength, sealed.ciphertext.byteLength]).toEqual([12, 80]);
    expect(store.stt.open(sealed)).toBe(CANARY);
    expect(keyFiles(root)).toEqual([`${sealed.keyRef}.key`]);
    expect(readFileSync(join(root, 'keys', `${sealed.keyRef}.key`)).includes(Buffer.from(CANARY))).toBe(false);
  });

  it('capture: a one-character camera password is sealed to 80 bytes and opens only for its own device', async () => {
    const { store } = build();
    const sealed = await store.capture.seal('CAM-01', 'x');
    expect(sealed.keyRef).toMatch(/^CAPTURE_DEVICE_K_[0-9A-F]{20}$/);
    expect(sealed.ciphertext.byteLength).toBeGreaterThanOrEqual(33);
    expect(store.capture.open('CAM-01', sealed)).toBe('x');
    expect(codeOf(() => store.capture.open('CAM-02', sealed))).toBe('CREDENTIAL_OPEN_FAILED');
    // An envelope of one purpose is not opened by the other, and a session key is no credential key.
    expect(codeOf(() => store.stt.open(sealed))).toBe('CREDENTIAL_ENVELOPE_INVALID');
    expect(codeOf(() => store.capture.open('CAM-01', { ...sealed, keyRef: 'KID-SES-1' }))).toBe('CREDENTIAL_ENVELOPE_INVALID');
    expect(codeOf(() => void store.capture.open('../x', sealed))).toBe('CREDENTIAL_ENVELOPE_INVALID');
  });

  it('wrong key fails closed: the key file of another credential in its place opens nothing', async () => {
    const { root, store } = build();
    const first = await store.stt.seal(CANARY);
    const second = await store.stt.seal('another secret');
    const file = (sealed: SealedSecret): string => join(root, 'keys', `${sealed.keyRef}.key`);
    writeFileSync(file(first), readFileSync(file(second)), { mode: 0o600 });
    expect(codeOf(() => store.stt.open(first))).toBe('CREDENTIAL_OPEN_FAILED');
    expect(store.stt.open(second)).toBe('another secret');
  });

  it('key loss: with the key gone the credential cannot be opened, and nothing brings it back', async () => {
    const { root, store } = build();
    const sealed = await store.stt.seal(CANARY);
    rmSync(join(root, 'keys', `${sealed.keyRef}.key`));
    expect(codeOf(() => store.stt.open(sealed))).toBe('CREDENTIAL_KEY_NOT_FOUND');
    expect(readdirSync(root)).toEqual(['keys']);
  });

  it('rotation: every write has a new key; retainOnly destroys the keys of replaced envelopes, of its purpose only', async () => {
    const { store } = build();
    const old = await store.stt.seal('first');
    const current = await store.stt.seal('second');
    const camera = await store.capture.seal('CAM-01', 'camera');
    store.sessionKeys.create('SES-0001');
    expect(old.keyRef).not.toBe(current.keyRef);
    expect(store.credentialKeys.list(CredentialPurpose.STT_API_KEY).sort()).toEqual([old.keyRef, current.keyRef].sort());
    expect(store.credentialKeys.retainOnly(CredentialPurpose.STT_API_KEY, [current.keyRef])).toEqual([old.keyRef]);
    expect(codeOf(() => store.stt.open(old))).toBe('CREDENTIAL_KEY_NOT_FOUND');
    expect(store.stt.open(current)).toBe('second');
    expect(store.capture.open('CAM-01', camera)).toBe('camera');
    expect(store.sessionKeys.has('KID-SES-0001')).toBe(true);
  });

  it('a secret that cannot be sealed leaves no key behind', async () => {
    const { root, store } = build();
    await expect(store.stt.seal('')).rejects.toMatchObject({ code: 'CREDENTIAL_PLAINTEXT_INVALID' });
    expect(keyFiles(root)).toEqual([]);
  });

  it('session keys: one per session, never replaced; destroyed means unreadable', () => {
    const { store } = build();
    const made = store.sessionKeys.create('SES-0001');
    expect(made.keyId).toBe('KID-SES-0001');
    expect(codeOf(() => store.sessionKeys.create('SES-0001'))).toBe('CREDENTIAL_KEY_EXISTS');
    const other = store.sessionKeys.create('SES-0002');
    const hex = (key: typeof made): string => usingKeyBytes(key.key, (bytes) => bytes.toString('hex'));
    expect(hex(made)).not.toBe(hex(other));
    expect(hex(store.sessionKeys.open('KID-SES-0001'))).toBe(hex(made));
    store.sessionKeys.release(made);
    expect(codeOf(() => hex(made))).toBe('CREDENTIAL_KEY_NOT_FOUND');
    expect(store.sessionKeys.destroy('KID-SES-0001')).toBe(true);
    expect(codeOf(() => store.sessionKeys.open('KID-SES-0001'))).toBe('CREDENTIAL_KEY_NOT_FOUND');
    for (const id of ['SES-0001', 'KID-', 'KID-../x', 'STT_API_KEY_K_00']) expect(codeOf(() => store.sessionKeys.open(id)), id).toBe('CREDENTIAL_KEY_REF_INVALID');
  });

  it('named secrets: stored once in a private file, handed to one call, and apart from the keys', () => {
    const { root, store } = build();
    const blob = Buffer.from(`-----${CANARY}-----`);
    store.namedSecrets.put('SIGNER_ED25519', blob);
    expect(store.namedSecrets.has('SIGNER_ED25519')).toBe(true);
    expect(modeOf(join(root, 'keys', 'SECRET_SIGNER_ED25519.blob'))).toBe(0o600);
    let seen: Buffer | null = null;
    expect(store.namedSecrets.use('SIGNER_ED25519', (bytes) => ((seen = bytes), bytes.toString('utf8')))).toBe(blob.toString('utf8'));
    // The copy handed out is overwritten once the call has returned.
    expect((seen as Buffer | null)?.every((byte) => byte === 0)).toBe(true);
    expect(codeOf(() => store.namedSecrets.put('SIGNER_ED25519', blob))).toBe('CREDENTIAL_KEY_EXISTS');
    expect(codeOf(() => store.namedSecrets.use('MISSING', () => 1))).toBe('CREDENTIAL_KEY_NOT_FOUND');
    expect(codeOf(() => store.namedSecrets.put('lower', blob))).toBe('CREDENTIAL_KEY_REF_INVALID');
    expect(codeOf(() => store.namedSecrets.put('TOO_BIG', Buffer.alloc(4097)))).toBe('CREDENTIAL_PLAINTEXT_INVALID');
    expect(store.credentialKeys.list(CredentialPurpose.STT_API_KEY)).toEqual([]);
  });
});

describe('the key-wrap secrets of the signer (row 83: `KeyWrapSecrets`, SEC35-07)', () => {
  it('satisfies the signer\'s interface: round trip, null when absent, a second put for one key id is refused and changes nothing', () => {
    const root = join(dataDir(), 'credential-store');
    // The assignment is the check: the adapter has the shape the signer asks for.
    const secrets: KeyWrapSecrets = createCredentialStore({ root }).keyWrapSecrets;
    const secret = Buffer.from(Array.from({ length: 32 }, (_unused, index) => 200 - index));
    expect(secrets.get(CORE_EVIDENCE_SIGNING_KEY_ID)).toBeNull();
    secrets.put(CORE_EVIDENCE_SIGNING_KEY_ID, secret);
    const read = secrets.get(CORE_EVIDENCE_SIGNING_KEY_ID);
    expect(read).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(read ?? []).equals(secret)).toBe(true);
    expect(codeOf(() => secrets.put(CORE_EVIDENCE_SIGNING_KEY_ID, Buffer.alloc(32, 1)))).toBe('CREDENTIAL_KEY_EXISTS');
    expect(Buffer.from(secrets.get(CORE_EVIDENCE_SIGNING_KEY_ID) ?? []).equals(secret)).toBe(true);
    // One private file in the store, not beside the signer key; another key id has its own.
    expect(modeOf(join(root, 'keys', `WRAP-${CORE_EVIDENCE_SIGNING_KEY_ID}.blob`))).toBe(0o600);
    expect(secrets.get('CORE-KEY-EVSIGN-02')).toBeNull();
    // A copy is handed out: overwriting it does not change what is stored.
    read?.fill(0);
    expect(Buffer.from(secrets.get(CORE_EVIDENCE_SIGNING_KEY_ID) ?? []).equals(secret)).toBe(true);
  });

  it('the secret is in no failure of the adapter, in any form; a key id that is no file name is refused', () => {
    const root = join(dataDir(), 'credential-store');
    const secrets: KeyWrapSecrets = createCredentialStore({ root }).keyWrapSecrets;
    const secret = Buffer.from(CANARY.padEnd(32, '#'));
    secrets.put('CORE-KEY-A', secret);
    const failures: unknown[] = [];
    const attempt = (run: () => unknown): void => {
      try {
        run();
      } catch (error) {
        failures.push(error);
      }
    };
    attempt(() => secrets.put('CORE-KEY-A', secret));
    attempt(() => secrets.put('../escape', secret));
    attempt(() => secrets.put('CORE-KEY-B', new Uint8Array(0)));
    attempt(() => secrets.get('a/b'));
    chmodSync(join(root, 'keys', 'WRAP-CORE-KEY-A.blob'), 0o644);
    attempt(() => secrets.get('CORE-KEY-A'));
    expect(failures.map((error) => (error as CredentialStoreError).code)).toEqual(['CREDENTIAL_KEY_EXISTS', 'CREDENTIAL_KEY_REF_INVALID', 'CREDENTIAL_PLAINTEXT_INVALID', 'CREDENTIAL_KEY_REF_INVALID', 'CREDENTIAL_KEY_UNSAFE']);
    for (const error of failures) {
      const text = `${String(error)} ${JSON.stringify(error)} ${inspect(error, { depth: 6 })} ${(error as Error).stack ?? ''}`;
      for (const form of [CANARY, secret.toString('hex'), secret.toString('base64')]) expect(text).not.toContain(form);
      expect((error as { cause?: unknown }).cause).toBeUndefined();
    }
    // Negative control: the search does find the secret where it IS, in the stored file.
    expect(readFileSync(join(root, 'keys', 'WRAP-CORE-KEY-A.blob')).includes(Buffer.from(CANARY))).toBe(true);
  });
});

describe('the store of an app', () => {
  it('ABSENT without a data directory; READY with one, the same object at every call, and no folder until a key is made', async () => {
    expect(coreCredentialStore({ stages: {}, config: { dataDir: '/nonexistent/dems-unit-test-data' } })).toEqual({ status: 'ABSENT' });
    const base = dataDir();
    const app = { stages: {}, config: { dataDir: base } };
    const first = coreCredentialStore(app);
    expect(first.status).toBe('READY');
    expect(coreCredentialStore(app)).toBe(first);
    expect(readdirSync(base)).toEqual([]);
    if (first.status !== 'READY') throw new Error('unreachable');
    await first.store.stt.seal('x');
    expect(readdirSync(base)).toEqual(['credential-store']);
  });

  it('UNAVAILABLE, with a code, when the store directory is not private', () => {
    const base = dataDir();
    mkdirSync(join(base, 'credential-store'));
    chmodSync(join(base, 'credential-store'), 0o750);
    expect(coreCredentialStore({ stages: {}, config: { dataDir: base } })).toEqual({ status: 'UNAVAILABLE', code: 'CREDENTIAL_STORE_UNSAFE', detail: null });
  });
});
