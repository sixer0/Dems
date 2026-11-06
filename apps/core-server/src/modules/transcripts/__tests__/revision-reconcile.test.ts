// Closing pass F-X, finding R80-08 (code review row 80): THE TABLE IS THE JOURNAL. The boot step
// `transcripts.heads` holds the two revision list files of a sealed package against the stored
// revisions before it publishes the heads. No database: the step is handed rows and a state. The
// packages are REAL ones of the verify row's builder (signed manifest, signed revision records with
// their bodies), and the product verifier judges each one after the healing (V-11).
import { PackageFile, canonicalJsonBytes } from '@dems/shared/evidence-package';
import { TranscriptRevisionsFileSchema, verifyPackageV2, type PackageVerifyResult, type TranscriptRevisionsFile } from '@dems/shared/evidence-verify';
import type { FastifyInstance } from 'fastify';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { corePorts } from '../../../evidence-verify';
import { buildPackage, removeScratch, type BuiltPackage } from '../../../evidence-verify/__tests__/support';
import { reconcileRevisionLists } from '../heads';
import { RevisionFilesCode } from '../routes';
import { READ_REVISION_CHAINS } from '../statements';
import { staleFromOf } from '../routes.js';

const roots: string[] = [];
afterAll(() => {
  removeScratch();
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

interface Entry {
  readonly level: string;
  readonly code: string;
  readonly context: Record<string, unknown>;
}

interface Rig {
  readonly app: FastifyInstance;
  readonly built: BuiltPackage;
  readonly packageDir: string;
  readonly real: string;
  readonly staged: string;
  /** The list the builder signed: `records` revisions with their bodies. */
  readonly list: TranscriptRevisionsFile;
  /** The bytes of the list cut to its first `count` records, in the canonical form the builder wrote. */
  bytesOf(count: number): Buffer;
  /** The table: the first `count` revisions are stored rows. */
  store(count: number): void;
  readonly persisted: Entry[];
  readonly lines: Record<string, unknown>[];
  verify(revisionCount?: number): Promise<PackageVerifyResult>;
  folder(): string[];
}

/** A sealed package with `records` signed revisions in a media store of its own, and a Core that holds its item. */
async function rig(records: number, options: { readFails?: boolean } = {}): Promise<Rig> {
  const store = mkdtempSync(join(tmpdir(), 'dems-r8008-'));
  roots.push(store);
  const built = await buildPackage({ revisions: records });
  const packageDir = join(store, `SESSION-${built.item.sessionId}`);
  cpSync(built.dir, packageDir, { recursive: true });
  const real = join(packageDir, ...PackageFile.TRANSCRIPT_REVISIONS.split('/'));
  const original = readFileSync(real);
  const list = TranscriptRevisionsFileSchema.parse(JSON.parse(original.toString('utf8')));
  expect(list.revisions).toHaveLength(records);
  // The builder wrote the canonical form (the form the Core writes too): a shorter list is the same form of fewer records.
  expect(Buffer.from(canonicalJsonBytes(list)).equals(original)).toBe(true);
  const bytesOf = (count: number): Buffer => Buffer.from(canonicalJsonBytes({ ...list, revisions: list.revisions.slice(0, count) }));
  let rows: Record<string, unknown>[] = [];
  const persisted: Entry[] = [];
  const lines: Record<string, unknown>[] = [];
  const level = (name: string) => (fields: Record<string, unknown>, msg: string) => void lines.push({ level: name, msg, ...fields });
  const item = { id: built.item.evidenceId, sessionId: built.item.sessionId, integritySource: 'REAL', manifestVersion: 2, signature: { algorithm: 'Ed25519', simulated: false }, manifestHash: built.item.manifestSha256, transcriptSha256: built.item.transcriptSha256 };
  const app = {
    log: { error: level('error'), warn: level('warn'), info: level('info') },
    errorLog: { append: (entry: Entry) => void persisted.push(entry) },
    db: {
      read: async (_source: string, work: (pool: { query(text: string): Promise<{ rows: Record<string, unknown>[] }> }) => Promise<unknown>) =>
        work({
          query: async (text) => {
            if (options.readFails === true) throw new Error('the database is away');
            expect(text).toBe(READ_REVISION_CHAINS);
            return { rows };
          },
        }),
    },
    engine: { slice: () => [item] },
    config: { mediaStoreDir: store },
  } as unknown as FastifyInstance;
  return {
    app,
    built,
    packageDir,
    real,
    staged: `${real}.next`,
    list,
    bytesOf,
    store: (count) => {
      // pg hands an integer column over as a number; the rows are in the statement's order.
      rows = list.revisions.slice(0, count).map((record) => ({ evidence_id: built.item.evidenceId, revision_no: record.revisionNo, sha256: record.sha256, signature_value: record.signature.value }));
    },
    persisted,
    lines,
    verify: (revisionCount) =>
      verifyPackageV2(corePorts(packageDir, built.opener, 256), {
        plaintext: 'REQUIRED',
        expected: { evidenceId: built.item.evidenceId, sessionId: built.item.sessionId, manifestSha256: built.item.manifestSha256, transcriptSha256: built.item.transcriptSha256, ...(revisionCount === undefined ? {} : { revisionCount }), trustedCertificateSha256: [built.signer.certificate.sha256] },
      }),
    folder: () => readdirSync(join(packageDir, 'transcript')).sort(),
  };
}

const failing = (result: PackageVerifyResult): string[] => result.checks.filter((check) => check.status === 'FAIL').map((check) => `${check.id} ${check.findings.map((finding) => finding.code).join(',')}`);
const noticed = (result: PackageVerifyResult): string[] => result.notices.map((notice) => notice.code);
const v11 = (result: PackageVerifyResult): string | undefined => result.checks.find((check) => check.id === 'V-11')?.status;
const SEALED_FOLDER = ['transcript-revisions.json', 'transcript.json', 'transcript.srt', 'transcript.vtt'];
const codes = (entries: readonly Entry[]): string[] => entries.map((entry) => `${entry.level} ${entry.code}`);

describe('R80-08 at boot: the revision list files of a sealed package are held against the stored revisions', () => {
  it('(d) CONTROL - a consistent package is left byte-identical and is silent: not written (same inode, same modification time), no line, no entry', async () => {
    const { app, real, store, persisted, lines, verify, folder, bytesOf } = await rig(2);
    store(2);
    const before = statSync(real, { bigint: true });
    expect(await reconcileRevisionLists(app)).toBe(0);
    const after = statSync(real, { bigint: true });
    expect(readFileSync(real).equals(bytesOf(2))).toBe(true);
    expect([after.ino, after.mtimeNs]).toEqual([before.ino, before.mtimeNs]);
    expect(folder()).toEqual(SEALED_FOLDER);
    expect(lines).toEqual([]);
    expect(persisted).toEqual([]);
    expect(v11(await verify(2))).toBe('PASS');
  });

  it('(b) CRASH POINT 2 - the commit succeeded, the rename never happened: the staged list is the stored chain -> it is renamed over the list; V-11 passes with the table count; one warn entry', async () => {
    const { app, real, staged, store, persisted, verify, folder, bytesOf, built } = await rig(2);
    store(2);
    // What the crash left: the list of ONE record, the staged list of two (the bytes the unit staged and synced).
    writeFileSync(staged, bytesOf(2));
    writeFileSync(real, bytesOf(1));
    // CONTROL: before the healing the package does not hold what the table holds (V-11), and the verifier NAMES the staged
    // file - as the notice REVISION_APPEND_PENDING, not as a V-14 failure (fix pass F-M7c, ruling D187; pass F-Z).
    const crashed = await verify(2);
    expect(failing(crashed)).toEqual(['V-11 REVISION_COUNT_MISMATCH']);
    expect(noticed(crashed)).toContain('REVISION_APPEND_PENDING');
    expect(await reconcileRevisionLists(app)).toBe(1);
    expect(readFileSync(real).equals(bytesOf(2))).toBe(true);
    expect(folder()).toEqual(SEALED_FOLDER);
    const verified = await verify(2);
    expect(failing(verified)).toEqual([]);
    expect(noticed(verified)).not.toContain('REVISION_APPEND_PENDING');
    expect(v11(verified)).toBe('PASS');
    expect(verified.transcript).toEqual({ state: 'VERIFIED', revisions: 2 });
    expect(codes(persisted)).toEqual([`warn ${RevisionFilesCode.STAGED_PROMOTED}`]);
    expect(persisted[0]?.context).toMatchObject({ evidenceId: built.item.evidenceId, step: 'transcripts.heads' });
  });

  it('(c) an ORPHAN of the old order - the list holds a signed record the table lacks: it is REMOVED, with ONE error entry; V-11 passes; before, an offline verification accepted it', async () => {
    const { app, real, store, persisted, verify, folder, bytesOf, built } = await rig(2);
    store(1);
    // THE FINDING: without the table's count, the verifier accepts the revision the Core never recorded.
    const offline = await verify();
    expect([v11(offline), offline.transcript]).toEqual(['PASS', { state: 'VERIFIED', revisions: 2 }]);
    expect(failing(await verify(1))).toEqual(['V-11 REVISION_COUNT_MISMATCH']);
    expect(await reconcileRevisionLists(app)).toBe(1);
    expect(readFileSync(real).equals(bytesOf(1))).toBe(true);
    expect(folder()).toEqual(SEALED_FOLDER);
    const verified = await verify(1);
    expect(failing(verified)).toEqual([]);
    expect(v11(verified)).toBe('PASS');
    expect((await verify()).transcript).toEqual({ state: 'VERIFIED', revisions: 1 });
    expect(codes(persisted)).toEqual([`error ${RevisionFilesCode.ORPHAN_REMOVED}`]);
    expect(persisted[0]?.context).toMatchObject({ evidenceId: built.item.evidenceId, records: 1 });
    // Never a hash, an author or a text of the removed record in the entry.
    expect(JSON.stringify(persisted)).not.toMatch(/[0-9a-f]{64}/);
  });

  it('(a) CRASH POINT 1 seen at boot - a staged list of an append that never committed (the chain plus one record): removed; the list is byte-identical; a warn entry, no error', async () => {
    const { app, real, staged, store, persisted, verify, folder, bytesOf } = await rig(2);
    store(1);
    writeFileSync(real, bytesOf(1));
    writeFileSync(staged, bytesOf(2));
    const before = statSync(real, { bigint: true });
    expect(await reconcileRevisionLists(app)).toBe(1);
    expect(existsSync(staged)).toBe(false);
    expect(readFileSync(real).equals(bytesOf(1))).toBe(true);
    expect(statSync(real, { bigint: true }).ino).toBe(before.ino);
    expect(folder()).toEqual(SEALED_FOLDER);
    expect(v11(await verify(1))).toBe('PASS');
    expect(codes(persisted)).toEqual([`warn ${RevisionFilesCode.STAGED_DISCARDED}`]);
    expect(persisted[0]?.context).toMatchObject({ staged: 'DISCARDED_UNCOMMITTED' });
  });

  it('(e) THE RESIDUAL - a stored row with no record in the list and no staged list: ONE error entry, the list is untouched, nothing is made up', async () => {
    const { app, real, store, persisted, verify, folder, bytesOf, built } = await rig(2);
    store(2);
    writeFileSync(real, bytesOf(1));
    const before = statSync(real, { bigint: true });
    expect(await reconcileRevisionLists(app)).toBe(0);
    expect(readFileSync(real).equals(bytesOf(1))).toBe(true);
    expect(statSync(real, { bigint: true }).mtimeNs).toBe(before.mtimeNs);
    expect(folder()).toEqual(SEALED_FOLDER);
    expect(codes(persisted)).toEqual([`error ${RevisionFilesCode.RECORD_MISSING}`]);
    expect(persisted[0]?.context).toMatchObject({ items: 1, evidenceIds: built.item.evidenceId });
    // The verifier keeps saying so: the table's count is not in the package.
    expect(failing(await verify(2))).toEqual(['V-11 REVISION_COUNT_MISMATCH']);
  });

  it('a staged list is promoted ONLY when every record is its row: an altered body (same number, hash and signature) is not the chain -> removed with an error entry, the list untouched, the row reported missing', async () => {
    const { app, real, staged, store, persisted, bytesOf, list } = await rig(2);
    store(2);
    writeFileSync(real, bytesOf(1));
    const second = list.revisions[1];
    const altered = { ...list, revisions: [list.revisions[0], { ...second, body: { ...second?.body, reason: 'Another reason, written by somebody else.' } }] };
    writeFileSync(staged, JSON.stringify(altered));
    expect(await reconcileRevisionLists(app)).toBe(1);
    expect(existsSync(staged)).toBe(false);
    expect(readFileSync(real).equals(bytesOf(1))).toBe(true);
    expect(codes(persisted)).toEqual([`error ${RevisionFilesCode.STAGED_DISCARDED}`, `error ${RevisionFilesCode.RECORD_MISSING}`]);
    expect(persisted[0]?.context).toMatchObject({ staged: 'DISCARDED_UNACCEPTABLE' });
  });

  it('a staged file that is no list at all is removed with an error entry; a staged list beside a list that is already whole is removed quietly (warn)', async () => {
    const garbage = await rig(1);
    garbage.store(1);
    writeFileSync(garbage.staged, '{"schema":');
    expect(await reconcileRevisionLists(garbage.app)).toBe(1);
    expect(garbage.folder()).toEqual(SEALED_FOLDER);
    expect(readFileSync(garbage.real).equals(garbage.bytesOf(1))).toBe(true);
    expect(codes(garbage.persisted)).toEqual([`error ${RevisionFilesCode.STAGED_DISCARDED}`]);

    const superseded = await rig(1);
    superseded.store(1);
    writeFileSync(superseded.staged, superseded.bytesOf(1));
    const before = statSync(superseded.real, { bigint: true });
    expect(await reconcileRevisionLists(superseded.app)).toBe(1);
    expect(superseded.folder()).toEqual(SEALED_FOLDER);
    expect(statSync(superseded.real, { bigint: true }).ino).toBe(before.ino);
    expect(codes(superseded.persisted)).toEqual([`warn ${RevisionFilesCode.STAGED_DISCARDED}`]);
  });

  it('WITHOUT THE TABLE THERE IS NO JUDGE: the stored revisions cannot be read -> no file is touched (a staged list stays), one error entry, the step does not reject', async () => {
    const { app, real, staged, persisted, bytesOf, folder } = await rig(2, { readFails: true });
    writeFileSync(real, bytesOf(1));
    writeFileSync(staged, bytesOf(2));
    expect(await reconcileRevisionLists(app)).toBe(0);
    expect(readFileSync(real).equals(bytesOf(1))).toBe(true);
    expect(readFileSync(staged).equals(bytesOf(2))).toBe(true);
    expect(folder()).toEqual([...SEALED_FOLDER, 'transcript-revisions.json.next'].sort());
    expect(codes(persisted)).toEqual([`error ${RevisionFilesCode.NOT_SETTLED}`]);
  });
});

describe('staleFromOf: a change that does not start from the current text (wave K, driver S2)', () => {
  /**
   * Fix wave K, driver S2 - G81b-01 (ruling D221 (2)): the rule of "current text" of operation 85.
   * The route test (`transcript-routes.db.test.ts`, describe "FIX WAVE K, G81b-01") proves that a
   * refusal signs and writes nothing; this file pins the rule itself, incl. the stored data the
   * re-gate planted (a revision whose own `from` is false is NOT re-judged: only its `to` counts).
   */

  const SEALED = ['Selamat pagi.', 'Terima kasih, Pak.', 'Berapa lama?'];
  const record = (changes: unknown): { body: unknown } => ({ body: { changes } });

  describe('staleFromOf: the first change that does not start from the current text of its segment', () => {
    it('no stored revision: the current text is the sealed text', () => {
      expect(staleFromOf(SEALED, [], [{ segmentIndex: 1, from: 'Terima kasih, Pak.', to: 'x' }])).toBeNull();
      expect(staleFromOf(SEALED, [], [{ segmentIndex: 1, from: 'terima kasih, pak.', to: 'x' }])).toBe(1);
      expect(staleFromOf(SEALED, [], [{ segmentIndex: 1, from: '', to: 'x' }])).toBe(1);
    });

    it('the newest stored revision that changed the segment gives its text; other segments keep the sealed text', () => {
      const stored = [record([{ segmentIndex: 1, from: 'Terima kasih, Pak.', to: 'one' }]), record([{ segmentIndex: 0, from: 'Selamat pagi.', to: 'zero' }]), record([{ segmentIndex: 1, from: 'one', to: 'two' }])];
      expect(staleFromOf(SEALED, stored, [{ segmentIndex: 1, from: 'two', to: 'three' }, { segmentIndex: 0, from: 'zero', to: 'z' }, { segmentIndex: 2, from: 'Berapa lama?', to: 'q' }])).toBeNull();
      expect(staleFromOf(SEALED, stored, [{ segmentIndex: 1, from: 'one', to: 'three' }])).toBe(1);
      expect(staleFromOf(SEALED, stored, [{ segmentIndex: 1, from: 'Terima kasih, Pak.', to: 'three' }])).toBe(1);
      expect(staleFromOf(SEALED, stored, [{ segmentIndex: 2, from: 'Berapa lama?', to: 'q' }, { segmentIndex: 0, from: 'Selamat pagi.', to: 'z' }])).toBe(0);
    });

    it('STORED DATA IS NOT RE-JUDGED (the planted revision 4 of the re-gate): a stored `from` that was false does not refuse the next revision; its `to` is the current text', () => {
      const planted = [record([{ segmentIndex: 2, from: 'not the sealed text', to: 'Berapa lama?!' }])];
      expect(staleFromOf(SEALED, planted, [{ segmentIndex: 2, from: 'Berapa lama?!', to: 'Berapa lama?' }])).toBeNull();
      expect(staleFromOf(SEALED, planted, [{ segmentIndex: 2, from: 'not the sealed text', to: 'x' }])).toBe(2);
    });

    it('a stored record without a body states no change; two changes of one request apply in order; a segment outside the transcript is never current', () => {
      expect(staleFromOf(SEALED, [{}, { body: null }, { body: { changes: 'x' } }], [{ segmentIndex: 0, from: 'Selamat pagi.', to: 'a' }])).toBeNull();
      expect(staleFromOf(SEALED, [], [{ segmentIndex: 0, from: 'Selamat pagi.', to: 'a' }, { segmentIndex: 0, from: 'a', to: 'b' }])).toBeNull();
      expect(staleFromOf(SEALED, [], [{ segmentIndex: 0, from: 'Selamat pagi.', to: 'a' }, { segmentIndex: 0, from: 'Selamat pagi.', to: 'b' }])).toBe(0);
      expect(staleFromOf(SEALED, [], [{ segmentIndex: 9, from: '', to: 'b' }])).toBe(9);
    });
  });
});
