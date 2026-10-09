// Integration pass A (decision D109; rows 84 + 85): verify v2 at the Core with the PRODUCT fragment
// cipher. The suites of row 85 seal their packages with a test double of the cipher; here every
// fragment is sealed by `createFragmentSealer` of `credential-store/fragment-cipher.ts` under a
// session key of a REAL credential store (a key file in a temporary data directory), and opened
// through `coreFragmentOpener(app)` - the port the Core verification unit is handed.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cameraFilePath } from '@dems/shared/evidence-package';
import { ROLE_PERMISSIONS } from '@dems/shared/sim';
import { afterAll, describe, expect, it } from 'vitest';
import { coreCredentialStore, createFragmentSealer, type CoreCredentialStore } from '../../credential-store';
import type { Principal } from '../../plugins/authenticate';
import { coreFragmentOpener, createRealEvidenceVerification, type VerdictRecord } from '../index';
import { buildPackage, flipByte, removeScratch, type BuildOptions, type BuiltPackage } from './support';

const OPERATOR: Principal = { kind: 'OPERATOR', operatorId: 'OPR-001', sessionId: 'session', deviceId: null, role: 'INVESTIGATOR', permissions: ROLE_PERMISSIONS.INVESTIGATOR };
const SESSION = 'SES-20261009-0001';
const dataDirs: string[] = [];
afterAll(() => {
  removeScratch();
  for (const dir of dataDirs) rmSync(dir, { recursive: true, force: true });
});

interface Sealed {
  readonly app: { readonly stages: object; readonly config: { readonly dataDir: string } };
  readonly store: CoreCredentialStore;
  readonly built: BuiltPackage;
}

/** A package whose every fragment was sealed by the product sealer under the store's session key. */
async function sealedByTheStore(options: BuildOptions = {}): Promise<Sealed> {
  const dataDir = mkdtempSync(join(tmpdir(), 'dems-passA-verify-'));
  dataDirs.push(dataDir);
  const app = { stages: {}, config: { dataDir } };
  const opened = coreCredentialStore(app);
  if (opened.status !== 'READY') throw new Error(`the credential store of the test app is ${opened.status}`);
  const key = opened.store.sessionKeys.create(SESSION);
  const sealer = createFragmentSealer(key);
  const built = await buildPackage({ ...options, sealer: (position, plaintext) => sealer.seal(position, plaintext) });
  expect(sealer.sealed()).toBe(10);
  // The copy the sealer used is overwritten: from here on the key exists only as its file.
  opened.store.sessionKeys.release(key);
  return { app, store: opened.store, built };
}

function verification(sealed: Sealed, opener = coreFragmentOpener(sealed.app)) {
  const recorded: VerdictRecord[] = [];
  const unit = createRealEvidenceVerification({
    findItem: (evidenceId) => (evidenceId === sealed.built.item.evidenceId ? sealed.built.item : null),
    packageDirOf: () => sealed.built.dir,
    now: () => 1_791_600_000_000,
    opener,
    trustedCertificateSha256: () => [sealed.built.signer.certificate.sha256],
    record: async (_principal, verdict) => void recorded.push(verdict),
    chunkBytes: 512,
  });
  return { unit, recorded };
}

describe('verify v2 at the Core with the product fragment cipher (rows 84 + 85)', () => {
  it('a package sealed by `credential-store/fragment-cipher.ts` verifies: 14 of 14, the plaintext of both files checked', async () => {
    const sealed = await sealedByTheStore();
    expect(sealed.built.manifest.files.flatMap((file) => file.fragments.map((fragment) => fragment.keyId))).toEqual(Array.from({ length: 10 }, () => `KID-${SESSION}`));
    const { unit, recorded } = verification(sealed);
    const run = await unit.run(OPERATOR, sealed.built.item.evidenceId);
    if (run === null) throw new Error('no run');
    expect(run.report.checks.map((check) => `${check.id} ${check.status}`)).toEqual(Array.from({ length: 15 }, (_, index) => `V-${String(index + 1).padStart(2, '0')} PASS`));
    expect(run.report.plaintextChecked).toBe(true);
    expect(run.body.files).toEqual([
      { fileId: 'fragments/VIDEO-01.mp4', trackId: 'VIDEO-01', storedOk: true, plainOk: true, chainOk: true, fragmentCount: 5, ok: true },
      { fileId: 'fragments/VIDEO-02.mp4', trackId: 'VIDEO-02', storedOk: true, plainOk: true, chainOk: true, fragmentCount: 5, ok: true },
    ]);
    expect(recorded).toEqual([{ evidenceId: sealed.built.item.evidenceId, ok: true, at: 1_791_600_000_000, manifestOk: true, signatureOk: true, failedTracks: [], detail: null }]);

    // Control: the DOUBLE's opener (another key) does not open what the product sealer sealed - the pass above is the product cipher's.
    const withDouble = await verification(sealed, sealed.built.opener).unit.run(OPERATOR, sealed.built.item.evidenceId);
    expect(withDouble?.body.ok).toBe(false);
    expect(withDouble?.body.files?.map((file) => file.plainOk)).toEqual([false, false]);
  });

  it('one flipped byte in one fragment: exactly that fragment fails, the other file still opens and verifies', async () => {
    const sealed = await sealedByTheStore();
    flipByte(sealed.built.path(cameraFilePath('VIDEO-02')), sealed.built.fragment('VIDEO-02', 3).byteOffset + 9);
    const { unit, recorded } = verification(sealed);
    const run = await unit.run(OPERATOR, sealed.built.item.evidenceId);
    if (run === null) throw new Error('no run');
    expect(run.body.ok).toBe(false);
    expect(run.report.fragments.map((fragment) => `${fragment.trackId} ${fragment.seq} ${fragment.reason}`)).toEqual(['VIDEO-02 3 TAMPERED']);
    expect(run.body.files?.map((file) => [file.trackId, file.storedOk, file.plainOk, file.ok])).toEqual([
      ['VIDEO-01', true, true, true],
      ['VIDEO-02', false, false, false],
    ]);
    expect(recorded[0]).toMatchObject({ ok: false, failedTracks: ['VIDEO-02'], detail: 'Mismatch: VIDEO-02 fragment 3' });
  });

  it('the product opener itself refuses: the tampered range does not authenticate, its neighbours do; a relocated ciphertext does not open at its own position', async () => {
    const sealed = await sealedByTheStore();
    const opener = coreFragmentOpener(sealed.app);
    const { readFileSync } = await import('node:fs');
    const file = sealed.built.path(cameraFilePath('VIDEO-01'));
    const range = (seq: number): Uint8Array => {
      const record = sealed.built.fragment('VIDEO-01', seq);
      return new Uint8Array(readFileSync(file).subarray(record.byteOffset, record.byteOffset + record.byteLength));
    };
    const record = (seq: number) => ({ trackId: 'VIDEO-01', ...sealed.built.fragment('VIDEO-01', seq) });
    expect(await opener.hasKey(`KID-${SESSION}`)).toBe(true);
    for (const seq of [1, 2, 3, 4, 5]) expect((await opener.open(record(seq), range(seq))).byteLength).toBe(700);
    const tampered = range(2);
    tampered[350] = (tampered[350] ?? 0) ^ 0x01;
    await expect(async () => opener.open(record(2), tampered)).rejects.toMatchObject({ name: 'FragmentAuthenticationError' });
    // The bytes of fragment 4 at the position of fragment 5: the AAD of SEC35-10 is the position's.
    await expect(async () => opener.open(record(5), range(4))).rejects.toMatchObject({ name: 'FragmentAuthenticationError' });

    // SEC35-10 through the whole verification: a fragment sealed for another position fails exactly V-02.
    const relocated = await sealedByTheStore({ sealAs: (trackId, seq, byteOffset) => (trackId === 'VIDEO-01' && seq === 2 ? { trackId, seq: 3, byteOffset } : null) });
    const run = await verification(relocated).unit.run(OPERATOR, relocated.built.item.evidenceId);
    expect(run?.report.checks.filter((check) => check.status === 'FAIL').map((check) => check.id)).toEqual(['V-02']);
    expect(run?.report.checks.find((check) => check.id === 'V-02')?.findings).toEqual([{ code: 'GCM_RECORD_MISMATCH', failureClass: 'CORRUPT', trackId: 'VIDEO-01', seq: 2 }]);
  });

  it('key loss (SEC35-09): the session key destroyed - the stored bytes still verify, the plaintext check fails closed; an app without a store has no key', async () => {
    const sealed = await sealedByTheStore();
    expect(sealed.store.sessionKeys.destroy(`KID-${SESSION}`)).toBe(true);
    const opener = coreFragmentOpener(sealed.app);
    expect(await opener.hasKey(`KID-${SESSION}`)).toBe(false);
    const run = await verification(sealed, opener).unit.run(OPERATOR, sealed.built.item.evidenceId);
    expect(run?.body.ok).toBe(false);
    expect(run?.report.checks.filter((check) => check.status === 'FAIL').map((check) => check.id)).toEqual(['V-05']);
    expect(run?.report.checks.find((check) => check.id === 'V-05')?.findings.map((finding) => finding.code)).toEqual(['SESSION_KEY_UNAVAILABLE', 'SESSION_KEY_UNAVAILABLE']);
    expect(run?.body.files?.map((file) => [file.storedOk, file.chainOk, file.plainOk])).toEqual([[true, true, false], [true, true, false]]);

    const absent = coreFragmentOpener({ stages: {}, config: { dataDir: '/nonexistent/dems-passA' } });
    expect(await absent.hasKey(`KID-${SESSION}`)).toBe(false);
    expect(await absent.hasKey('not a key id')).toBe(false);
  });
});
