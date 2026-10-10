// Fix wave H, driver A, finding G89-06 (= R88-12 live; gate 89 section 6; ruling D199): a reset kept
// a development session's key and the next session of the same ID was sealed under it -
// `KID-SES-20261010-0024` served three recordings in one day.
//
// RULED: a key is NEVER reused. The sealer of the running Core binds the key to its session (what
// names the session beyond its ID) and refuses, by name, a key of that ID that is not this
// session's. The same session - the next fragment, a CLOSE_TRACKS that runs again after a restart -
// keeps its key (control). No key byte leaves the store in any of it.
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CredentialStoreError, CredentialStoreFailure, coreCredentialStore, sessionKeyFolderOf, type CoreCredentialStore } from '../../credential-store';
import { usingKeyBytes } from '../../credential-store/key-material';
import { RESET_CREDENTIAL_STORE_FOLDER, removeSessionArtefactsOf, resetSessionKeyFolderOf, resetSessionKeyIdOf } from '../../db/reset/session-artefacts';
import { coreFragmentSealer, sessionKeyIdOf } from '../session-key';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

const SESSION = 'SES-20261010-0024';
const KID = sessionKeyIdOf(SESSION);
const plain = (seed: number): Uint8Array => Uint8Array.from({ length: 300 }, (_, index) => (index * 7 + seed) & 0xff);
const position = (seq: number) => ({ trackId: 'VIDEO-01' as const, seq, byteOffset: 800 + seq * 300 });

function rig() {
  const dataDir = mkdtempSync(join(tmpdir(), 'dems-wha-key-'));
  folders.push(dataDir);
  const mediaStoreDir = join(dataDir, 'media', 'sessions');
  const host = { stages: {}, config: { dataDir, mediaStoreDir } };
  const store = (): CoreCredentialStore => {
    const opened = coreCredentialStore(host);
    if (opened.status !== 'READY') throw new Error(`the store is ${opened.status}`);
    return opened.store;
  };
  const keyHex = (): string => {
    const key = store().sessionKeys.open(KID);
    try {
      return usingKeyBytes(key.key, (bytes) => Buffer.from(bytes).toString('hex'));
    } finally {
      store().sessionKeys.release(key);
    }
  };
  return { dataDir, mediaStoreDir, host, store, keyHex };
}

const codeOf = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof CredentialStoreError ? error.code : `not a store error: ${String(error)}`;
  }
};

describe('G89-06: the session key is bound to its session', () => {
  it('CONTROL - the SAME session keeps its key: the next fragment and a sealer built again after a restart open it', () => {
    const r = rig();
    const first = coreFragmentSealer(r.host, () => 'created-1000').seal(SESSION, position(1), plain(1)) as { keyId: string };
    expect(first.keyId).toBe(KID);
    expect(r.store().sessionKeys.bindingOf(KID)).toBe('created-1000');
    const key = r.keyHex();
    // A process that starts again: a new sealer, the same session.
    const again = coreFragmentSealer(r.host, () => 'created-1000').seal(SESSION, position(2), plain(2)) as { keyId: string };
    expect(again.keyId).toBe(KID);
    expect(r.keyHex()).toBe(key);
  });

  it('ANOTHER session of the same ID is refused by name: nothing is sealed, and the key of the first session is neither used nor touched', () => {
    const r = rig();
    coreFragmentSealer(r.host, () => 'created-1000').seal(SESSION, position(1), plain(1));
    const key = r.keyHex();
    // A reset by other means gave the ID out again and left the key: the next session has another creation instant.
    const next = coreFragmentSealer(r.host, () => 'created-2000');
    expect(codeOf(() => next.seal(SESSION, position(1), plain(9)))).toBe(CredentialStoreFailure.SESSION_KEY_NOT_OF_SESSION);
    expect(CredentialStoreFailure.SESSION_KEY_NOT_OF_SESSION).toBe('CREDENTIAL_SESSION_KEY_NOT_OF_SESSION');
    expect(r.keyHex()).toBe(key);
    expect(r.store().sessionKeys.bindingOf(KID)).toBe('created-1000');
  });

  it('a key an earlier build made WITHOUT a binding is not this session\'s either; neither is a session the engine does not hold', () => {
    const r = rig();
    // The sealer without `instanceOf` is the rule before this fix: the ID alone.
    coreFragmentSealer(r.host).seal(SESSION, position(1), plain(1));
    expect(r.store().sessionKeys.bindingOf(KID)).toBeNull();
    expect(codeOf(() => coreFragmentSealer(r.host, () => 'created-1000').seal(SESSION, position(2), plain(2)))).toBe(CredentialStoreFailure.SESSION_KEY_NOT_OF_SESSION);
    expect(codeOf(() => coreFragmentSealer(r.host, () => null).seal('SES-20261010-0099', position(1), plain(1)))).toBe(CredentialStoreFailure.SESSION_KEY_NOT_OF_SESSION);
    // ... and no key was made for a session the engine does not hold.
    expect(r.store().sessionKeys.has('KID-SES-20261010-0099')).toBe(false);
  });

  it('MUTATION PROOF of "no reuse" - the rule before the fix (no binding asked) seals the next session under the OLD key', () => {
    const r = rig();
    coreFragmentSealer(r.host).seal(SESSION, position(1), plain(1));
    const key = r.keyHex();
    // Without the binding the second "session" is sealed, and under the same key: exactly finding G89-06.
    expect(codeOf(() => coreFragmentSealer(r.host).seal(SESSION, position(1), plain(9)))).toBeNull();
    expect(r.keyHex()).toBe(key);
  });
});

describe('G89-06: the reset destroys the key, and the next session of the ID gets a new one', () => {
  it('after the reset\'s removal the key and its binding are gone; the next session is sealed under ANOTHER key', () => {
    const r = rig();
    coreFragmentSealer(r.host, () => 'created-1000').seal(SESSION, position(1), plain(1));
    const old = r.keyHex();
    // The reset's own path constants name the folder the store keeps the key in (held equal here).
    expect(resetSessionKeyFolderOf(r.mediaStoreDir)).toBe(sessionKeyFolderOf(r.mediaStoreDir));
    expect(resetSessionKeyIdOf(SESSION)).toBe(KID);
    const keyFolder = join(r.dataDir, RESET_CREDENTIAL_STORE_FOLDER, resetSessionKeyFolderOf(r.mediaStoreDir));
    expect(readdirSync(keyFolder).sort()).toEqual([`${KID}.blob`, `${KID}.key`]);

    const removal = removeSessionArtefactsOf({ dataDir: r.dataDir, storeRoot: r.mediaStoreDir, sessionIds: [SESSION] });
    expect(removal).toEqual({ keysDestroyed: [KID], factsRemoved: [], stagingRemoved: [], kept: [] });
    expect(readdirSync(keyFolder)).toEqual([]);
    expect(r.store().sessionKeys.has(KID)).toBe(false);

    coreFragmentSealer(r.host, () => 'created-2000').seal(SESSION, position(1), plain(9));
    expect(r.store().sessionKeys.bindingOf(KID)).toBe('created-2000');
    expect(r.keyHex()).not.toBe(old);
  });
});
