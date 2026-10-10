// Fix pass F-M7c (item 3 (ii); ruling D180): THE SESSION KEYS ARE KEYED BY THE MEDIA STORE ROOT OF
// THEIR CORE. They are files below the data directory, which every lane of an installation shares;
// under one flat folder two databases with the SAME session ID opened ONE key `KID-<sessionId>`
// (the second Core's seal reused the first one's key), and destroying it for one database made the
// other's sealed media unreadable. The key ID in the manifest stays `KID-<sessionId>`: only WHERE
// the Core keeps the key changes. No migration: the keys are files.
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { usingKeyBytes } from '../key-material';
import { CredentialStoreError, coreCredentialStore, sessionKeyScopeOf, type CoreCredentialStore } from '../index';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
const SESSION = 'SES-20261010-0001';
const KID = `KID-${SESSION}`;
function core(dataDir: string, mediaStoreDir?: string): CoreCredentialStore {
  const opened = coreCredentialStore({ stages: {}, config: { dataDir, ...(mediaStoreDir === undefined ? {} : { mediaStoreDir }) } });
  if (opened.status !== 'READY') throw new Error(`the store is ${opened.status}`);
  return opened.store;
}
const bytesOf = (store: CoreCredentialStore): string => {
  const key = store.sessionKeys.open(KID);
  try {
    return usingKeyBytes(key.key, (bytes) => Buffer.from(bytes).toString('hex'));
  } finally {
    store.sessionKeys.release(key);
  }
};
const codeOf = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof CredentialStoreError ? error.code : `not a store error: ${String(error)}`;
  }
};

describe('D180: two Cores on one data directory with two media store roots and the SAME session ID', () => {
  it('each has its OWN key under the same key ID; neither sees, opens or destroys the other\'s', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'dems-fm7c-keys-'));
    folders.push(dataDir);
    const a = core(dataDir, join(dataDir, 'media', 'dems_lane_1', 'sessions'));
    const b = core(dataDir, join(dataDir, 'media', 'dems_lane_2', 'sessions'));
    a.sessionKeys.release(a.sessionKeys.create(SESSION));
    // B does not see A's key: it has none, and makes its own (before the fix: `has` was true and the seal REUSED A's key).
    expect(b.sessionKeys.has(KID)).toBe(false);
    expect(b.sessionKeys.owns(KID)).toBe(false);
    b.sessionKeys.release(b.sessionKeys.create(SESSION));
    expect(bytesOf(a)).not.toBe(bytesOf(b));
    // A destroys its key (a reset, a reseed): B's is untouched.
    const before = bytesOf(b);
    expect(a.sessionKeys.destroy(KID)).toBe(true);
    expect(a.sessionKeys.has(KID)).toBe(false);
    expect(bytesOf(b)).toBe(before);
    // Where: one private folder per media store root, beside - never inside - the media.
    const scopes = readdirSync(join(dataDir, 'credential-store')).filter((name) => name.startsWith('session-keys-')).sort();
    expect(scopes).toEqual([`session-keys-${sessionKeyScopeOf(join(dataDir, 'media', 'dems_lane_1', 'sessions'))}`, `session-keys-${sessionKeyScopeOf(join(dataDir, 'media', 'dems_lane_2', 'sessions'))}`].sort());
    for (const scope of scopes) expect(statSync(join(dataDir, 'credential-store', scope)).mode & 0o777).toBe(0o700);
    expect(existsSync(join(dataDir, 'credential-store', 'keys', `${KID}.key`))).toBe(false);
  });

  it('CONTROL: the SAME media store root (a restart of that Core) opens the same key; the scope is the resolved root, whatever way it is written', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'dems-fm7c-keys-'));
    folders.push(dataDir);
    const root = join(dataDir, 'media', 'sessions');
    const first = core(dataDir, root);
    first.sessionKeys.release(first.sessionKeys.create(SESSION));
    const again = core(dataDir, `${join(dataDir, 'media')}/./sessions/`);
    expect(again.sessionKeys.owns(KID)).toBe(true);
    expect(bytesOf(again)).toBe(bytesOf(first));
    expect(codeOf(() => again.sessionKeys.create(SESSION))).toBe('CREDENTIAL_KEY_EXISTS');
    expect(sessionKeyScopeOf(root)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('a key an EARLIER build left in the shared folder is still OPENED for reading (sealed packages stay readable) - and is never taken for this Core\'s own: not reused by a new seal, never destroyed', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'dems-fm7c-keys-'));
    folders.push(dataDir);
    // The earlier build: a host without a media store root keeps the flat folder.
    const legacy = core(dataDir);
    legacy.sessionKeys.release(legacy.sessionKeys.create(SESSION));
    const shared = bytesOf(legacy);
    const a = core(dataDir, join(dataDir, 'media', 'dems_lane_1', 'sessions'));
    expect(a.sessionKeys.has(KID)).toBe(true);
    expect(bytesOf(a)).toBe(shared);
    expect(a.sessionKeys.owns(KID)).toBe(false);
    // Destroy touches this Core's own folder only.
    expect(a.sessionKeys.destroy(KID)).toBe(false);
    expect(bytesOf(legacy)).toBe(shared);
    // A new seal of that session ID makes this Core's OWN key, which then wins over the shared one.
    a.sessionKeys.release(a.sessionKeys.create(SESSION));
    expect(a.sessionKeys.owns(KID)).toBe(true);
    expect(bytesOf(a)).not.toBe(shared);
  });
});
