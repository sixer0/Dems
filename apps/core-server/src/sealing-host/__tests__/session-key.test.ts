// Fix wave H, driver A, finding G89-06 (= R88-12 live; gate 89 section 6; ruling D199): a reset kept
// a development session's key and the next session of the same ID was sealed under it -
// `KID-SES-20261010-0024` served three recordings in one day.
//
// RULED: a key is NEVER reused. The sealer of the running Core binds the key to its session (what
// names the session beyond its ID) and refuses, by name, a key of that ID that is not this
// session's. The same session - the next fragment, a CLOSE_TRACKS that runs again after a restart -
// keeps its key (control). No key byte leaves the store in any of it.
import { mkdtempSync, readdirSync, rmSync, chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, afterAll, vi } from 'vitest';
import { CredentialStoreError, CredentialStoreFailure, coreCredentialStore, sessionKeyFolderOf, type CoreCredentialStore } from '../../credential-store';
import { usingKeyBytes } from '../../credential-store/key-material';
import { RESET_CREDENTIAL_STORE_FOLDER, removeSessionArtefactsOf, resetSessionKeyFolderOf, resetSessionKeyIdOf } from '../../db/reset/session-artefacts';
import { coreFragmentSealer, sessionKeyIdOf, sessionKeyStartRefusal } from '../session-key';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { buildApp } from '../../app';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { ApiFailure } from '../../plugins/error-envelope';
import { SealerCause, sealerCauseOf, sealingFailureReason, sealingFailureRetriable } from '../../sealing';
import { SESSION_KEY_START_TEXT, sealingHost } from '../index';

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
    expect(removal).toEqual({ keysDestroyed: [KID], keysOfUnknownSessions: [], factsRemoved: [], stagingRemoved: [], kept: [] });
    expect(readdirSync(keyFolder)).toEqual([]);
    expect(r.store().sessionKeys.has(KID)).toBe(false);

    coreFragmentSealer(r.host, () => 'created-2000').seal(SESSION, position(1), plain(9));
    expect(r.store().sessionKeys.bindingOf(KID)).toBe('created-2000');
    expect(r.keyHex()).not.toBe(old);
  });
});

describe('G75b-01: a session key left by an earlier session (wave I, driver A1)', () => {
  // Fix wave I, driver A1 - re-gate 75 finding G75b-01 (ruling D216): `SES-20261010-0025` of lane 2
  // could not be sealed, five times, at CLOSE_TRACKS.
  //
  // ROOT CAUSE, reproduced here on the layout the lane's key folder had (file names and dates read
  // from the folder; no key byte): `KID-SES-20261010-0025.key` WITHOUT a binding file, made at 13:29
  // by the build before wave H for an earlier session of that number. The reset of 19:04 destroyed
  // the keys of the sessions ITS database named - and that database no longer knew the session of
  // 13:29 (an earlier reset had erased it). The session numbers started again; the session recorded
  // at 19:52 got the number, and the sealer refused the key by name
  // (`session-key.ts`: owns the key, binding is not this session's).
  //
  // FIXED, each with its control:
  //   (a) a reset destroys EVERY session key of the key folder of the store it resets;
  //   (b) a session whose ID has a key in the store is refused at its START, before anything is
  //       recorded, by name;
  //   (c) the cause is a closed code, read from the code of what the sealer threw.

  const folders: string[] = [];
  const apps: FastifyInstance[] = [];
  const fixture = realBootFixture('wave-i-a1');
  afterEach(async () => {
    for (const app of apps.splice(0)) await app.close();
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
  });
  afterAll(() => fixture.remove());

  const SESSION = 'SES-20261010-0025';
  const EARLIER = 'SES-20261010-0024';
  const KID = sessionKeyIdOf(SESSION);

  function rig() {
    const dataDir = mkdtempSync(join(tmpdir(), 'dems-wia1-key-'));
    folders.push(dataDir);
    const mediaStoreDir = join(dataDir, 'media', 'sessions');
    mkdirSync(mediaStoreDir, { recursive: true });
    // A new `stages` object is a Core that started again: the store is opened anew.
    const host = () => ({ stages: {}, config: { dataDir, mediaStoreDir } });
    const keyFolder = join(dataDir, RESET_CREDENTIAL_STORE_FOLDER, resetSessionKeyFolderOf(mediaStoreDir));
    /** The key of an EARLIER session of that ID as the older build left it: a key file, no binding file. */
    const leaveKeyOfOlderBuild = (sessionId: string): void => void coreFragmentSealer(host()).seal(sessionId, position(1), plain(1));
    return { dataDir, mediaStoreDir, host, keyFolder, leaveKeyOfOlderBuild };
  }

  const thrownBy = (run: () => unknown): unknown => {
    try {
      run();
    } catch (error) {
      return error;
    }
    return null;
  };

  describe('G75b-01, the root cause: a key an earlier session of the same number left, met by the next session of that number', () => {
    it('REPRODUCTION: the lane\'s layout (KID-<id>.key, no binding) refuses the seal of the session of 19:52 by name - and the cause is a closed code', () => {
      const r = rig();
      r.leaveKeyOfOlderBuild(SESSION);
      r.leaveKeyOfOlderBuild(EARLIER);
      // What the directory listing of lane 2 showed: key files, no `.blob` beside them.
      expect(readdirSync(r.keyFolder).sort()).toEqual([`KID-${EARLIER}.key`, `${KID}.key`]);
      const error = thrownBy(() => coreFragmentSealer(r.host(), () => 'created-1791636741000').seal(SESSION, position(1), plain(9)));
      expect((error as { code?: string }).code).toBe(CredentialStoreFailure.SESSION_KEY_NOT_OF_SESSION);
      // (c) THE CAUSE: read from the code, never from a message or a path.
      expect(sealerCauseOf(error)).toBe(SealerCause.SESSION_KEY_NOT_OF_SESSION);
      expect(sealingFailureRetriable('SEALER_FAILED', { cause: SealerCause.SESSION_KEY_NOT_OF_SESSION })).toBe(false);
      expect(sealingFailureReason('SEALER_FAILED', { cause: SealerCause.SESSION_KEY_NOT_OF_SESSION })).toBe("A session key of an earlier session with this session number is in the Core's key store. A session key is never reused: this session cannot be sealed.");
    });

    it('the cause of every failure code of the credential store a sealer can throw; an unknown code and a thrown value without one have none (control)', () => {
      const of = (code: string) => sealerCauseOf(Object.assign(new Error('x'), { code }));
      expect(of(CredentialStoreFailure.SESSION_KEY_NOT_OF_SESSION)).toBe('SESSION_KEY_NOT_OF_SESSION');
      expect(of(CredentialStoreFailure.STORE_UNAVAILABLE)).toBe('SESSION_KEY_STORE_UNAVAILABLE');
      expect(of(CredentialStoreFailure.STORE_UNSAFE)).toBe('SESSION_KEY_STORE_UNAVAILABLE');
      expect(of(CredentialStoreFailure.KEY_UNSAFE)).toBe('SESSION_KEY_UNSAFE');
      expect(of(CredentialStoreFailure.KEY_WRITE_FAILED)).toBe('SESSION_KEY_WRITE_FAILED');
      expect(of(CredentialStoreFailure.KEY_EXISTS)).toBe('SESSION_KEY_WRITE_FAILED');
      expect(of(CredentialStoreFailure.KEY_NOT_FOUND)).toBe('SESSION_KEY_NOT_FOUND');
      expect(of(CredentialStoreFailure.NONCE_REUSED)).toBe('SESSION_CIPHER_REFUSED');
      expect(of(CredentialStoreFailure.FRAGMENT_INPUT_INVALID)).toBe('SESSION_CIPHER_REFUSED');
      expect(of('/Users/someone/.data/credential-store/keys/KID-X.key')).toBeNull();
      expect(of('toString')).toBeNull();
      expect(sealerCauseOf(new Error('no code'))).toBeNull();
      expect(sealerCauseOf(null)).toBeNull();
      // Only the one cause no retry gets past is not retriable; a store that is unreachable may come back.
      expect(sealingFailureRetriable('SEALER_FAILED', { cause: 'SESSION_KEY_STORE_UNAVAILABLE' })).toBe(true);
      expect(sealingFailureRetriable('SEALER_FAILED', {})).toBe(true);
      // The cause is the SEALER's: the same word on another failure code changes nothing.
      expect(sealingFailureRetriable('STORAGE_FAILED', { cause: 'SESSION_KEY_NOT_OF_SESSION' })).toBe(true);
      expect(sealingFailureRetriable('MANIFEST_INVALID', {})).toBe(false);
    });
  });

  describe('(a) a reset destroys EVERY session key of the store it resets', () => {
    it('BEFORE THE FIX (control, the rule of wave H alone): a key of a session the database no longer names survives the reset - exactly the 19:04 reset of lane 2', () => {
      const r = rig();
      r.leaveKeyOfOlderBuild(SESSION);
      // The database being reset names no session of that ID any more.
      const removal = removeSessionArtefactsOf({ dataDir: r.dataDir, storeRoot: r.mediaStoreDir, sessionIds: [] });
      expect(removal.keysDestroyed).toEqual([]);
      expect(readdirSync(r.keyFolder)).toEqual([`${KID}.key`]);
    });

    it('THE FIX: every `KID-SES-…` key and binding of the folder goes, named apart as keys of unknown sessions; the next session of the number is sealed under a NEW key bound to it', () => {
      const r = rig();
      r.leaveKeyOfOlderBuild(SESSION);
      r.leaveKeyOfOlderBuild(EARLIER);
      // A key WITH its binding of a session the database names, and one the database does not.
      coreFragmentSealer(r.host(), () => 'created-1').seal('SES-20261010-0030', position(1), plain(3));
      coreFragmentSealer(r.host(), () => 'created-2').seal('SES-20261010-0031', position(1), plain(4));
      const removal = removeSessionArtefactsOf({ dataDir: r.dataDir, storeRoot: r.mediaStoreDir, sessionIds: ['SES-20261010-0030'], everyKey: true });
      expect([...removal.keysDestroyed].sort()).toEqual([`KID-${EARLIER}`, KID, 'KID-SES-20261010-0030', 'KID-SES-20261010-0031']);
      expect([...removal.keysOfUnknownSessions].sort()).toEqual([`KID-${EARLIER}`, KID, 'KID-SES-20261010-0031']);
      expect(removal.kept).toEqual([]);
      expect(readdirSync(r.keyFolder)).toEqual([]);
      // After the reset: the session of that number seals, under a key of its own.
      const sealed = coreFragmentSealer(r.host(), () => 'created-1791636741000').seal(SESSION, position(1), plain(9)) as { keyId: string };
      expect(sealed.keyId).toBe(KID);
      expect(readdirSync(r.keyFolder).sort()).toEqual([`${KID}.blob`, `${KID}.key`]);
    });

    it('the two exceptions hold for an unknown key too: the demo packages the reset sealed anew keep their key, and a key whose package folder is still there stays and is said', () => {
      const r = rig();
      r.leaveKeyOfOlderBuild(SESSION);
      r.leaveKeyOfOlderBuild(EARLIER);
      r.leaveKeyOfOlderBuild('SES-20261008-0011');
      mkdirSync(join(r.mediaStoreDir, `SESSION-${EARLIER}`));
      const removal = removeSessionArtefactsOf({ dataDir: r.dataDir, storeRoot: r.mediaStoreDir, sessionIds: [], keep: ['SES-20261008-0011'], everyKey: true });
      expect(removal.keysDestroyed).toEqual([KID]);
      expect(removal.kept).toEqual([{ sessionId: EARLIER, kind: 'SESSION_KEY', reason: 'PACKAGE_STILL_THERE' }]);
      expect(readdirSync(r.keyFolder).sort()).toEqual(['KID-SES-20261008-0011.key', `KID-${EARLIER}.key`]);
    });

    it('nothing else in the key folder is touched: a file that is no session key, a folder, a name of another form (control)', () => {
      const r = rig();
      r.leaveKeyOfOlderBuild(SESSION);
      writeFileSync(join(r.keyFolder, 'README'), 'x', { mode: 0o600 });
      writeFileSync(join(r.keyFolder, 'KID-SES-2026-1.key'), 'x', { mode: 0o600 });
      writeFileSync(join(r.keyFolder, `${KID}.key.bak`), 'x', { mode: 0o600 });
      mkdirSync(join(r.keyFolder, 'KID-SES-20261010-0099.key'));
      const removal = removeSessionArtefactsOf({ dataDir: r.dataDir, storeRoot: r.mediaStoreDir, sessionIds: [], everyKey: true });
      expect(removal.keysDestroyed).toEqual([KID]);
      // The folder under a key's name is not a file: it is left and said.
      expect(removal.kept).toEqual([{ sessionId: 'SES-20261010-0099', kind: 'SESSION_KEY', reason: 'NOT_A_FILE' }]);
      expect(readdirSync(r.keyFolder).sort()).toEqual(['KID-SES-2026-1.key', `${KID}.key.bak`, 'KID-SES-20261010-0099.key', 'README']);
    });
  });

  describe('(b) the defect surfaces at the START, never at the seal', () => {
    it('a session whose ID has a key in the store is refused by name - whatever the key is bound to; a clean store, and the store after the reset, refuse nothing', () => {
      const r = rig();
      expect(sessionKeyStartRefusal(r.host(), SESSION)).toBeNull();
      r.leaveKeyOfOlderBuild(SESSION);
      expect(sessionKeyStartRefusal(r.host(), SESSION)).toBe('SESSION_KEY_NOT_OF_SESSION');
      // CONTROL: the session of another number starts.
      expect(sessionKeyStartRefusal(r.host(), 'SES-20261010-0026')).toBeNull();
      // A key WITH a binding is refused as well: a session that has not started has sealed nothing, so it has no key of its own.
      coreFragmentSealer(r.host(), () => 'created-7').seal('SES-20261010-0027', position(1), plain(2));
      expect(sessionKeyStartRefusal(r.host(), 'SES-20261010-0027')).toBe('SESSION_KEY_NOT_OF_SESSION');
      // The check changes nothing: the keys are as they were.
      expect(readdirSync(r.keyFolder).sort()).toEqual([`${KID}.key`, 'KID-SES-20261010-0027.blob', 'KID-SES-20261010-0027.key']);
      removeSessionArtefactsOf({ dataDir: r.dataDir, storeRoot: r.mediaStoreDir, sessionIds: [], everyKey: true });
      expect(sessionKeyStartRefusal(r.host(), SESSION)).toBeNull();
    });

    it('a key store that is not a private folder refuses the start by name; an app without a data directory is not asked (a test\'s app)', () => {
      const r = rig();
      const store = join(r.dataDir, RESET_CREDENTIAL_STORE_FOLDER);
      mkdirSync(store, { mode: 0o755 });
      chmodSync(store, 0o755);
      const host = r.host();
      expect(coreCredentialStore(host).status).toBe('UNAVAILABLE');
      expect(sessionKeyStartRefusal(host, SESSION)).toBe('SESSION_KEY_STORE_UNAVAILABLE');
      expect(sessionKeyStartRefusal({ stages: {}, config: { dataDir: join(r.dataDir, 'never-made') } }, SESSION)).toBeNull();
    });

    it('the sealing host of a Core in real capture: `beforeStart` throws 503 NOT_READY with `details.reason`, logs the cause as a code, and passes a session without a key (control); the inert host of Simulated mode refuses nothing', async () => {
      const failure = Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' });
      const pool = { connect: async () => Promise.reject(failure), query: async () => Promise.reject(failure), on: () => pool, end: async () => {} };
      const log = captureLog();
      const app = buildApp({
        config: unitTestConfig({ logLevel: 'error', dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: '/bin/echo', captureWorkerPath: fixture.worker('worker-wave-i-a1', 'capture-worker/0.4.0') }),
        createPool: () => pool as unknown as Pool,
        logStream: log.stream,
      });
      apps.push(app);
      await app.ready();
      const host = sealingHost(app);
      const appended = vi.spyOn(app.errorLog, 'append');
      expect(() => host.beforeStart('SES-20261010-0041')).not.toThrow();
      expect(appended).not.toHaveBeenCalled();
      // An earlier session of the number left its key in THIS Core's key folder.
      coreFragmentSealer(app).seal('SES-20261010-0042', position(1), plain(1));
      const refused = thrownBy(() => host.beforeStart('SES-20261010-0042'));
      expect(refused).toBeInstanceOf(ApiFailure);
      expect(refused).toMatchObject({ statusCode: 503, code: 'NOT_READY', message: SESSION_KEY_START_TEXT.SESSION_KEY_NOT_OF_SESSION, details: { reason: 'SESSION_KEY_NOT_OF_SESSION' } });
      const line = log.lines().find((entry) => entry.code === 'SESSION_START_REFUSED_SESSION_KEY');
      expect(line).toMatchObject({ sessionId: 'SES-20261010-0042', cause: 'SESSION_KEY_NOT_OF_SESSION' });
      // PERSISTED (the error log), not only printed: the same code, the cause, no stack of a thrown value.
      expect(appended).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', code: 'SESSION_START_REFUSED_SESSION_KEY', context: { sessionId: 'SES-20261010-0042', cause: 'SESSION_KEY_NOT_OF_SESSION' } }));
      // A line without an error carries no `err` member (it was printed as an empty error object before).
      expect(line).not.toHaveProperty('err');
      // No path and no key material in what was said.
      expect(JSON.stringify(line)).not.toContain(fixture.dataDir);
      expect(SESSION_KEY_START_TEXT.SESSION_KEY_NOT_OF_SESSION).not.toMatch(/[/\\]|KID-/);
      expect(() => sealingHost({ stages: {} }).beforeStart('SES-20261010-0042')).not.toThrow();
      // The resumed fact: nothing was resumed here; the inert host has no fact (the simulator's rule answers).
      expect(host.resumedSeal('SES-20261010-0042')).toBe(false);
      expect(sealingHost({ stages: {} }).resumedSeal('SES-20261010-0042')).toBeNull();
    });
  });
});
