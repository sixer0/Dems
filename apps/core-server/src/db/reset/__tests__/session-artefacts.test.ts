// Fix wave H, driver A, findings G89-06 and G89-07 (gate 89; ruling D199): a reset destroys the
// session key of every session it clears and removes its capture facts file and its sealing
// staging - by the containment rule of `package-removal.ts`, never "every file that is there", and
// never a key whose package is still in the store.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { packageFolderName } from '@dems/shared/evidence-package';
import { SESSION_CAPTURE_FACTS_FOLDER, sessionCaptureFactsPath } from '../../../capture-session/facts';
import { sessionKeyFolderOf } from '../../../credential-store';
import { CREDENTIAL_STORE_FOLDER } from '../../../credential-store/key-store';
import { sessionKeyIdOf } from '../../../sealing-host/session-key';
import {
  READ_CLEARED_ARTEFACT_SESSIONS,
  RESET_CAPTURE_FACTS_FOLDER,
  RESET_CREDENTIAL_STORE_FOLDER,
  RESET_SEALING_STAGING_FOLDER,
  removeSessionArtefactsOf,
  resetPackageFolderOf,
  resetSessionKeyFolderOf,
  resetSessionKeyIdOf,
} from '../session-artefacts';

const base = mkdtempSync(join(tmpdir(), 'dems-wha-reset-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));

const A = 'SES-20261010-0024';
const B = 'SES-20261010-0025';
const KEY_BYTES = Buffer.concat([Buffer.from('DEMSKEY1', 'ascii'), Buffer.alloc(32, 0xab)]);

let count = 0;
/** A data directory and a media store root with the artefacts of the given sessions, as the Core leaves them. */
function installation(sessions: readonly string[]) {
  count += 1;
  const dataDir = join(base, `data-${String(count)}`);
  const storeRoot = join(dataDir, 'media', 'lane', 'sessions');
  const keyFolder = join(dataDir, RESET_CREDENTIAL_STORE_FOLDER, resetSessionKeyFolderOf(storeRoot));
  mkdirSync(keyFolder, { recursive: true, mode: 0o700 });
  chmodSync(join(dataDir, RESET_CREDENTIAL_STORE_FOLDER), 0o700);
  mkdirSync(join(storeRoot, RESET_CAPTURE_FACTS_FOLDER), { recursive: true });
  mkdirSync(join(storeRoot, RESET_SEALING_STAGING_FOLDER), { recursive: true });
  for (const sessionId of sessions) {
    writeFileSync(join(keyFolder, `KID-${sessionId}.key`), KEY_BYTES, { mode: 0o600 });
    writeFileSync(join(keyFolder, `KID-${sessionId}.blob`), 'DEMSBLB1created-1', { mode: 0o600 });
    writeFileSync(join(storeRoot, RESET_CAPTURE_FACTS_FOLDER, `${sessionId}.json`), '{"version":1}');
    mkdirSync(join(storeRoot, RESET_SEALING_STAGING_FOLDER, sessionId));
    writeFileSync(join(storeRoot, RESET_SEALING_STAGING_FOLDER, sessionId, 'fragments.json.part'), 'x');
  }
  return { dataDir, storeRoot, keyFolder };
}

describe('the reset\'s own names are the units\' names (the reset imports no unit of the server)', () => {
  it('the key folder, the key ID, the facts folder and the package folder are held equal', () => {
    for (const root of ['/store', '/Users/x/.data/media/dems_lane_2/sessions', 'relative/store']) expect(resetSessionKeyFolderOf(root)).toBe(sessionKeyFolderOf(root));
    expect(RESET_CREDENTIAL_STORE_FOLDER).toBe(CREDENTIAL_STORE_FOLDER);
    expect(resetSessionKeyIdOf(A)).toBe(sessionKeyIdOf(A));
    expect(RESET_CAPTURE_FACTS_FOLDER).toBe(SESSION_CAPTURE_FACTS_FOLDER);
    expect(join('/store', RESET_CAPTURE_FACTS_FOLDER, `${A}.json`)).toBe(sessionCaptureFactsPath('/store', A));
    expect(resetPackageFolderOf(A)).toBe(packageFolderName(A));
    // Every session that can have an artefact: it started a capture, has a sealing job or an item.
    expect(READ_CLEARED_ARTEFACT_SESSIONS).toBe('SELECT session_id::text AS session_id FROM public.session_capture_sources UNION SELECT session_id::text FROM public.sealing_jobs UNION SELECT session_id::text FROM public.evidence_items ORDER BY session_id');
  });
});

describe('G89-06 / G89-07: what a reset removes of the sessions it cleared', () => {
  it('the key (and its binding), the capture facts file and the sealing staging of each cleared session; nothing of a session it was not asked for (control)', () => {
    const i = installation([A, B]);
    const removal = removeSessionArtefactsOf({ dataDir: i.dataDir, storeRoot: i.storeRoot, sessionIds: [A, A, 'SES-20261010-0099'] });
    expect(removal).toEqual({ keysDestroyed: [`KID-${A}`], factsRemoved: [A], stagingRemoved: [A], kept: [] });
    // CONTROL: session B was not cleared - everything of it is there, byte for byte.
    expect(readdirSync(i.keyFolder).sort()).toEqual([`KID-${B}.blob`, `KID-${B}.key`]);
    expect(readFileSync(join(i.keyFolder, `KID-${B}.key`)).equals(KEY_BYTES)).toBe(true);
    expect(readdirSync(join(i.storeRoot, RESET_CAPTURE_FACTS_FOLDER))).toEqual([`${B}.json`]);
    expect(readdirSync(join(i.storeRoot, RESET_SEALING_STAGING_FOLDER))).toEqual([B]);
    // The answer names key IDs and counts: no key byte.
    expect(JSON.stringify(removal)).not.toContain(KEY_BYTES.subarray(8).toString('hex'));
  });

  it('a session whose key belongs to the NEW database (a demo package this reset sealed anew) is not touched', () => {
    const i = installation([A, B]);
    expect(removeSessionArtefactsOf({ dataDir: i.dataDir, storeRoot: i.storeRoot, sessionIds: [A, B], keep: [B] }).keysDestroyed).toEqual([`KID-${A}`]);
    expect(existsSync(join(i.keyFolder, `KID-${B}.key`))).toBe(true);
  });

  it('a key whose package folder is still in the store stays, and that is said: it is destroyed only when what it sealed is gone', () => {
    const i = installation([A]);
    mkdirSync(join(i.storeRoot, resetPackageFolderOf(A)));
    expect(removeSessionArtefactsOf({ dataDir: i.dataDir, storeRoot: i.storeRoot, sessionIds: [A] })).toEqual({ keysDestroyed: [], factsRemoved: [], stagingRemoved: [], kept: [{ sessionId: A, kind: 'SESSION_KEY', reason: 'PACKAGE_STILL_THERE' }] });
    expect(readFileSync(join(i.keyFolder, `KID-${A}.key`)).equals(KEY_BYTES)).toBe(true);
  });

  it('containment: a name that is no session ID removes nothing; a link in the place of a key is removed as a name and what it points at is not written to; a linked folder is refused', () => {
    const i = installation([A]);
    const outside = join(i.dataDir, 'outside.key');
    writeFileSync(outside, KEY_BYTES);
    rmSync(join(i.keyFolder, `KID-${A}.key`));
    symlinkSync(outside, join(i.keyFolder, `KID-${A}.key`));
    const removal = removeSessionArtefactsOf({ dataDir: i.dataDir, storeRoot: i.storeRoot, sessionIds: ['..', '../outside', A] });
    expect(removal.kept).toEqual([{ sessionId: '..', kind: 'SESSION_KEY', reason: 'SESSION_ID_INVALID' }, { sessionId: '../outside', kind: 'SESSION_KEY', reason: 'SESSION_ID_INVALID' }]);
    expect(removal.keysDestroyed).toEqual([`KID-${A}`]);
    expect(existsSync(join(i.keyFolder, `KID-${A}.key`))).toBe(false);
    expect(readFileSync(outside).equals(KEY_BYTES)).toBe(true);

    // The key folder itself a link: nothing below it is touched.
    const j = installation([B]);
    const real = `${j.keyFolder}-real`;
    mkdirSync(real);
    writeFileSync(join(real, `KID-${B}.key`), KEY_BYTES);
    rmSync(j.keyFolder, { recursive: true });
    symlinkSync(real, j.keyFolder);
    const refused = removeSessionArtefactsOf({ dataDir: j.dataDir, storeRoot: j.storeRoot, sessionIds: [B] });
    expect(refused.keysDestroyed).toEqual([]);
    expect(refused.kept.filter((left) => left.kind === 'SESSION_KEY')).toEqual([{ sessionId: B, kind: 'SESSION_KEY', reason: 'FOLDER_NOT_A_DIRECTORY' }, { sessionId: B, kind: 'SESSION_KEY', reason: 'FOLDER_NOT_A_DIRECTORY' }]);
    expect(readFileSync(join(real, `KID-${B}.key`)).equals(KEY_BYTES)).toBe(true);
  });

  it('an installation without a credential store or hidden folders: nothing to remove, nothing kept', () => {
    const dataDir = join(base, 'never-made');
    expect(removeSessionArtefactsOf({ dataDir, storeRoot: join(dataDir, 'store'), sessionIds: [A] })).toEqual({ keysDestroyed: [], factsRemoved: [], stagingRemoved: [], kept: [] });
  });

  it('two media store roots on one data directory: the reset of one database destroys only ITS key of a session ID both have (D180)', () => {
    const i = installation([A]);
    const otherRoot = join(i.dataDir, 'media', 'other-lane', 'sessions');
    const otherKeys = join(i.dataDir, RESET_CREDENTIAL_STORE_FOLDER, resetSessionKeyFolderOf(otherRoot));
    mkdirSync(otherKeys, { mode: 0o700 });
    writeFileSync(join(otherKeys, `KID-${A}.key`), KEY_BYTES, { mode: 0o600 });
    expect(removeSessionArtefactsOf({ dataDir: i.dataDir, storeRoot: i.storeRoot, sessionIds: [A] }).keysDestroyed).toEqual([`KID-${A}`]);
    expect(readFileSync(join(otherKeys, `KID-${A}.key`)).equals(KEY_BYTES)).toBe(true);
  });
});
