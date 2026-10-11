// Integration pass D1b (decision D133 (2)): a permitted reset removes the package folders it
// cleared - and nothing else. Two halves, each on its own:
//
//   A. WHERE a removal may happen (`package-removal.ts`), on a real directory tree in a scratch
//      folder: one `SESSION-*` path segment, a real directory, resolved inside the store root.
//   B. WHICH folders are handed to it (`removeClearedDevelopmentPackages`), with the store scan,
//      the signed-mark reader and the remover as stand-ins: only what the guard cleared in this
//      run, judged again at the moment of removal.
//
// The store scan itself is read with the REAL reader in half A's layout cases: a folder named
// after the session alone is not a package (`ev` §A.1; D133 (2)).
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, afterEach } from 'vitest';
import { readEvidenceStore, type EvidenceStoreScan } from '../../commands/evidence-store';
import { PackageRemovalRefusal, removePackageFolder, type PackageFolderRemover, removeQuarantineFolder } from '../package-removal';
import { evaluateRealEvidence, removeClearedDevelopmentPackages, type DevelopmentItem, type RealEvidenceFacts, type SealedSourceMarkReader, DISCARD_UNSEALED_FAKE_OPTION, REAL_SEALED_EVIDENCE_STATEMENT, UNSEALED_FAKE_SOURCE, assertNoRealSealedEvidence, classifyRealSealedRows, findRealSealedEvidence, realEvidenceDetails, realEvidenceMessage, removeUnsealedFakeRecordings, unsealedFakeMessage, type RealSealedEvidenceRow } from '../real-evidence';
import { spawnSync } from 'node:child_process';
import { ResetUsageError, parseResetArguments } from '../cli';

// The store root lies three levels below the scratch base, so that nothing a faulty rule could
// reach by `..` lies outside the scratch folder of this file.
const base = mkdtempSync(join(tmpdir(), 'dems-d1b-removal-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));
let caseNo = 0;
let dataDir = '';
let store = '';
let outside = '';

function folder(parent: string, name: string): string {
  const dir = join(parent, name);
  mkdirSync(join(dir, 'fragments'), { recursive: true });
  writeFileSync(join(dir, 'session-manifest.json'), '{}');
  writeFileSync(join(dir, 'fragments', 'VIDEO-01.mp4'), 'media');
  return dir;
}

beforeEach(() => {
  caseNo += 1;
  dataDir = join(base, `case-${String(caseNo)}`, 'data');
  store = join(dataDir, 'media', 'sessions');
  outside = join(dataDir, 'elsewhere');
  mkdirSync(store, { recursive: true });
  mkdirSync(outside, { recursive: true });
});

describe('A. where a removal may happen: below the configured store root, one package directory', () => {
  it('a package directory of the store root is removed with everything in it; its neighbours stay', () => {
    const target = folder(store, 'SESSION-SES-20261009-0001');
    const neighbour = folder(store, 'SESSION-SES-20261009-0002');
    const live = folder(store, 'SES-20261009-0001');
    expect(removePackageFolder(store, 'SESSION-SES-20261009-0001')).toEqual({ removed: true });
    expect(existsSync(target)).toBe(false);
    expect([existsSync(neighbour), existsSync(live), existsSync(store)]).toEqual([true, true, true]);
  });

  it('a name that is not one SESSION-* path segment is refused and removes nothing: a bare session folder, a parent, a nested path, an absolute path', () => {
    const live = folder(store, 'SES-20261009-0001');
    const kept = folder(store, 'SESSION-SES-20261009-0001');
    const foreign = folder(outside, 'SESSION-SES-20261009-0009');
    const names = [
      'SES-20261009-0001',
      '',
      '.',
      '..',
      '../elsewhere',
      '../../elsewhere/SESSION-SES-20261009-0009',
      'SESSION-SES-20261009-0001/fragments',
      'SESSION-SES-20261009-0001/../SES-20261009-0001',
      'SESSION-..',
      'SESSION-',
      'SESSION-a b',
      'session-SES-20261009-0001',
      foreign,
      `SESSION-${'a'.repeat(65)}`,
    ];
    for (const name of names) expect(removePackageFolder(store, name), JSON.stringify(name)).toEqual({ removed: false, refusal: PackageRemovalRefusal.NAME_NOT_A_PACKAGE });
    expect([existsSync(live), existsSync(kept), existsSync(foreign), existsSync(join(foreign, 'fragments', 'VIDEO-01.mp4')), existsSync(outside), existsSync(store)]).toEqual([true, true, true, true, true, true]);
  });

  it('a folder OUTSIDE the root is never removed: a symbolic link in the store that points at it is refused, and the link is not followed', () => {
    const foreign = folder(outside, 'SESSION-SES-20261009-0009');
    symlinkSync(foreign, join(store, 'SESSION-SES-20261009-0009'), 'dir');
    expect(removePackageFolder(store, 'SESSION-SES-20261009-0009')).toEqual({ removed: false, refusal: PackageRemovalRefusal.NOT_A_DIRECTORY });
    expect(existsSync(join(foreign, 'fragments', 'VIDEO-01.mp4'))).toBe(true);
    expect(existsSync(join(store, 'SESSION-SES-20261009-0009'))).toBe(true);
    // The same name asked of ANOTHER root than the one that holds the folder: nothing there, nothing removed.
    expect(removePackageFolder(store, 'SESSION-SES-20261009-0010')).toEqual({ removed: false, refusal: PackageRemovalRefusal.ENTRY_UNRESOLVED });
    expect(removePackageFolder(join(dataDir, 'media'), 'SESSION-SES-20261009-0009')).toEqual({ removed: false, refusal: PackageRemovalRefusal.ENTRY_UNRESOLVED });
    expect(existsSync(foreign)).toBe(true);
  });

  it('a file under a package name, a missing entry and a missing root are refused by code', () => {
    writeFileSync(join(store, 'SESSION-SES-20261009-0003'), 'not a folder');
    expect(removePackageFolder(store, 'SESSION-SES-20261009-0003')).toEqual({ removed: false, refusal: PackageRemovalRefusal.NOT_A_DIRECTORY });
    expect(existsSync(join(store, 'SESSION-SES-20261009-0003'))).toBe(true);
    expect(removePackageFolder(store, 'SESSION-SES-20261009-0004')).toEqual({ removed: false, refusal: PackageRemovalRefusal.ENTRY_UNRESOLVED });
    expect(removePackageFolder(join(dataDir, 'no-such-store'), 'SESSION-SES-20261009-0004')).toEqual({ removed: false, refusal: PackageRemovalRefusal.ROOT_UNRESOLVED });
  });

  it('CONTROL: a store root reached through a link is the same store (the root is resolved first)', () => {
    const target = folder(store, 'SESSION-SES-20261009-0005');
    const alias = join(dataDir, 'store-alias');
    symlinkSync(store, alias, 'dir');
    expect(removePackageFolder(alias, 'SESSION-SES-20261009-0005')).toEqual({ removed: true });
    expect(existsSync(target)).toBe(false);
  });

  it('the layout the store scan reads: SESSION-<sessionId>/ is a package, a bare <sessionId>/ folder is not (D133 (2))', () => {
    folder(store, 'SESSION-SES-20261009-0001'); // v2: session-manifest.json only
    const v1 = folder(store, 'SESSION-SES-20260930-0004');
    // A v1 package holds `manifest.json` and NO `session-manifest.json` (the helper writes one: fix pass F-M7, R88-11 - a folder with both is a v2 folder and reads UNKNOWN).
    rmSync(join(v1, 'session-manifest.json'));
    writeFileSync(join(v1, 'manifest.json'), JSON.stringify({ integrity: 'DEMO_PACKAGE' }));
    folder(store, 'SES-20261009-0002'); // the live media directory of a session: every package file, the wrong folder
    const scan = readEvidenceStore(store);
    expect(scan.packages).toEqual([
      // v1: `manifest.json` says what it is.
      { sessionId: 'SES-20260930-0004', directory: 'SESSION-SES-20260930-0004', integrity: 'DEMO', manifest: 'V1' },
      // v2: the scan cannot clear it (fail-safe: it blocks); rule (5) asks its signed `session-manifest.json`.
      { sessionId: 'SES-20261009-0001', directory: 'SESSION-SES-20261009-0001', integrity: 'UNKNOWN', manifest: 'V2' },
    ]);
    expect(scan.packages.some((entry) => entry.directory === 'SES-20261009-0002' || entry.sessionId === 'SES-20261009-0002')).toBe(false);
  });
});

describe('B. which folders are removed: only those the guard itself cleared, judged again at the removal', () => {
  const ITEM: DevelopmentItem = { sessionId: 'SES-DEV', evidenceId: 'EV-DEV', manifestSha256: 'a'.repeat(64) };
  const entry = (sessionId: string, integrity: 'REAL' | 'DEMO' | 'UNKNOWN') => ({ sessionId, directory: `SESSION-${sessionId}`, integrity });
  const scanOf = (...packages: EvidenceStoreScan['packages'][number][]): EvidenceStoreScan => ({ root: '/store', present: true, packages });
  const signedDevelopment: SealedSourceMarkReader = async () => ({ signed: true, development: true });

  function recorder() {
    const asked: [string, string][] = [];
    const remove: PackageFolderRemover = (root, directory) => {
      asked.push([root, directory]);
      return { removed: true };
    };
    return { asked, remove };
  }
  /** The facts of a permitted run: one exempt item whose folder the guard cleared. */
  const permitted = (scan: EvidenceStoreScan, overrides: Partial<RealEvidenceFacts> = {}): RealEvidenceFacts => ({
    ...evaluateRealEvidence('dems_demo', '/store', [], scan, { development: [ITEM.sessionId], clearedOnDisk: ['SESSION-SES-DEV'], developmentItems: [ITEM] }),
    ...overrides,
  });

  it('the cleared folder is removed below the store root the guard read; a demo package and a folder that was not cleared are never handed over', async () => {
    const scan = scanOf(entry('SES-DEMO', 'DEMO'), entry('SES-DEV', 'UNKNOWN'));
    const facts = permitted(scan);
    expect(facts.blocked).toBe(false);
    const { asked, remove } = recorder();
    const removal = await removeClearedDevelopmentPackages(facts, { readStore: () => scan, readSourceMark: signedDevelopment, remove });
    expect(removal).toEqual({ removed: ['SESSION-SES-DEV'], kept: [] });
    expect(asked).toEqual([['/store', 'SESSION-SES-DEV']]);
  });

  it('a NON-EXEMPT folder is never removed: a blocked run removes nothing, although a cleared folder is among its packages', async () => {
    // Another REAL package no exempt row names lies beside the cleared one: the guard blocks.
    const scan = scanOf(entry('SES-DEV', 'UNKNOWN'), entry('SES-REAL', 'REAL'));
    const facts = permitted(scan);
    expect(facts).toMatchObject({ blocked: true, developmentPackagesOnDisk: ['SESSION-SES-DEV'], diskSessions: ['SES-REAL'] });
    const { asked, remove } = recorder();
    expect(await removeClearedDevelopmentPackages(facts, { readStore: () => scan, readSourceMark: signedDevelopment, remove })).toEqual({ removed: [], kept: [] });
    expect(asked).toEqual([]);
  });

  it('only the names of the cleared list are candidates: every other folder of the scan stays, whatever its mark says', async () => {
    // A second folder appears after R-3 and would read as a signed development package of the same
    // item's session under another name: it was not cleared by the guard, so it is not removed.
    const scan = scanOf(entry('SES-DEV', 'UNKNOWN'), entry('SES-LATE', 'UNKNOWN'), entry('SES-V1', 'REAL'));
    const { asked, remove } = recorder();
    const removal = await removeClearedDevelopmentPackages(permitted(scanOf(entry('SES-DEV', 'UNKNOWN'))), { readStore: () => scan, readSourceMark: signedDevelopment, remove });
    expect(removal.removed).toEqual(['SESSION-SES-DEV']);
    expect(asked.map(([, directory]) => directory)).toEqual(['SESSION-SES-DEV']);
  });

  it('judged again at the removal: a folder that no longer verifies as the signed development package is left, and reported', async () => {
    const scan = scanOf(entry('SES-DEV', 'UNKNOWN'));
    const cases: [string, SealedSourceMarkReader][] = [
      ['unsigned now', async () => ({ signed: false, development: false })],
      ['signed, production classes now', async () => ({ signed: true, development: false })],
      ['the reader fails', async () => Promise.reject(new Error('unreadable'))],
    ];
    for (const [name, readSourceMark] of cases) {
      const { asked, remove } = recorder();
      const removal = await removeClearedDevelopmentPackages(permitted(scan), { readStore: () => scan, readSourceMark, remove });
      expect(removal, name).toEqual({ removed: [], kept: [{ directory: 'SESSION-SES-DEV', reason: 'NOT_CLEARED_AT_REMOVAL' }] });
      expect(asked, name).toEqual([]);
    }
    // The anchors of the second judgement are those read at R-3, for the folder of the store root.
    const seen: unknown[] = [];
    await removeClearedDevelopmentPackages(permitted(scan), {
      readStore: () => scan,
      readSourceMark: async (dir, anchors) => {
        seen.push([dir, anchors]);
        return { signed: true, development: true };
      },
      remove: recorder().remove,
    });
    expect(seen).toEqual([[join('/store', 'SESSION-SES-DEV'), { sessionId: 'SES-DEV', evidenceId: 'EV-DEV', manifestSha256: 'a'.repeat(64) }]]);
    // Gone from the store, or the store unreadable, at the removal: nothing is removed.
    for (const readStore of [() => scanOf(), (): EvidenceStoreScan => { throw new Error('unreadable'); }]) {
      const { asked, remove } = recorder();
      expect((await removeClearedDevelopmentPackages(permitted(scan), { readStore, readSourceMark: signedDevelopment, remove })).removed).toEqual([]);
      expect(asked).toEqual([]);
    }
  });

  it('a cleared list that names a folder outside the store (facts that were tampered with) removes nothing: not in the scan, and refused by the remover itself', async () => {
    const scan = scanOf(entry('SES-DEV', 'UNKNOWN'));
    const forged = permitted(scan, { developmentPackagesOnDisk: ['../elsewhere/SESSION-SES-DEV', 'SES-DEV'] });
    const { asked, remove } = recorder();
    const removal = await removeClearedDevelopmentPackages(forged, { readStore: () => scan, readSourceMark: signedDevelopment, remove });
    expect(removal.removed).toEqual([]);
    expect(removal.kept.map((left) => left.reason)).toEqual(['NOT_CLEARED_AT_REMOVAL', 'NOT_CLEARED_AT_REMOVAL']);
    expect(asked).toEqual([]);
  });

  it('END TO END on a disk: the cleared package folder is removed, the non-exempt folder and the folder outside the root are not', async () => {
    const cleared = folder(store, 'SESSION-SES-DEV');
    const live = folder(store, 'SES-DEV');
    const foreign = folder(outside, 'SESSION-SES-DEV');
    const scan = readEvidenceStore(store);
    const facts: RealEvidenceFacts = { ...evaluateRealEvidence('dems_demo', store, [], scan, { development: ['SES-DEV'], clearedOnDisk: ['SESSION-SES-DEV'], developmentItems: [ITEM] }) };
    expect(facts.blocked).toBe(false);
    const removal = await removeClearedDevelopmentPackages(facts, { readSourceMark: signedDevelopment });
    expect(removal).toEqual({ removed: ['SESSION-SES-DEV'], kept: [] });
    expect([existsSync(cleared), existsSync(live), existsSync(foreign), existsSync(join(foreign, 'session-manifest.json'))]).toEqual([false, true, true, true]);
    // The next run of the guard on that store finds no package at all: nothing left to block.
    expect(readEvidenceStore(store).packages).toEqual([]);

    // A remover's refusal is reported and the folder stays.
    const again = folder(store, 'SESSION-SES-DEV');
    const refusing = await removeClearedDevelopmentPackages(facts, { readSourceMark: signedDevelopment, remove: () => ({ removed: false, refusal: PackageRemovalRefusal.REMOVE_FAILED }) });
    expect(refusing).toEqual({ removed: [], kept: [{ directory: 'SESSION-SES-DEV', reason: 'REMOVE_FAILED' }] });
    expect(existsSync(again)).toBe(true);
  });
});

describe('rules (12) to (15): the unsealed recordings of generated sources (wave I, driver A1)', () => {
  // Fix wave I, driver A1 - re-gate 75 finding G75b-01 (ruling D216), the reset side: after one failed
  // seal `lane.sh reset 2` answered RESET_BLOCKED_REAL_EVIDENCE for ever ("1 unreadable package
  // directory [SESSION-SES-20261010-0025]"): the lane could not be restored with the project's tools.
  //
  // Rules (12) to (15) of the guard: an UNSEALED recording folder of a session that recorded from
  // four generated (FAKE) sources is cleared - on the caller's explicit word only, never for a
  // recording of this computer's devices or of a production device, never for a folder that holds a
  // manifest. Evidence integrity: every clearing has its negative control.

  const REPOSITORY = join(import.meta.dirname, '../../../../../..');
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  const S = 'SES-20261010-0025';
  const fakeRow = (sessionId: string, sourceRows = 4, fakeRows = 4): RealSealedEvidenceRow => ({ session_id: sessionId, evidence_id: null, manifest_hash: null, integrity_source: UNSEALED_FAKE_SOURCE, development_flag: false, source_rows: sourceRows, development_rows: fakeRows });
  const clientOf = (rows: readonly RealSealedEvidenceRow[]) => ({ query: async () => ({ rows: [...rows] }) }) as never;

  /** A store on disk as lane 2 was left: the recording folder of the session whose seal failed, no manifest in it. */
  function storeOf(): string {
    const root = mkdtempSync(join(tmpdir(), 'dems-wia1-store-'));
    roots.push(root);
    mkdirSync(join(root, `SESSION-${S}`, 'fragments'), { recursive: true });
    writeFileSync(join(root, `SESSION-${S}`, 'VIDEO-01.mp4'), 'generated test picture');
    writeFileSync(join(root, `SESSION-${S}`, 'fragments', 'VIDEO-01.mp4.seal.part'), 'part');
    return root;
  }

  describe('rules (12) + (13): the database side', () => {
    it('the statement asks for sessions of exactly four source rows, all FAKE, without a sealed item - on the snapshot of the other rules; it stays one SELECT', () => {
      expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain(`'${UNSEALED_FAKE_SOURCE}'`);
      expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain("HAVING count(*) = 4 AND count(*) FILTER (WHERE f.adapter_kind = 'FAKE') = 4");
      expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain('NOT EXISTS (SELECT 1 FROM public.evidence_items AS j WHERE j.session_id = f.session_id AND j.sealed_at IS NOT NULL)');
      expect(REAL_SEALED_EVIDENCE_STATEMENT.match(/UNION ALL/g)).toHaveLength(2);
      expect(REAL_SEALED_EVIDENCE_STATEMENT).toMatch(/^SELECT\b/);
      expect(REAL_SEALED_EVIDENCE_STATEMENT).not.toMatch(/\b(UPDATE|DELETE|INSERT|TRUNCATE|DROP)\b/);
      // The generated kind only: this computer's camera and microphone are never part of rule (12).
      expect(REAL_SEALED_EVIDENCE_STATEMENT).not.toContain("f.adapter_kind IN ('FAKE', 'LOCAL_DEVICE')");
    });

    it('such a row never blocks and is proven AGAIN on its counts: three rows, or one row of another kind, is no proof (negative controls)', () => {
      expect(classifyRealSealedRows([fakeRow(S)])).toMatchObject({ blocking: [], unsealedFake: [S] });
      expect(classifyRealSealedRows([fakeRow(S, 3, 3)])).toMatchObject({ blocking: [], unsealedFake: [] });
      expect(classifyRealSealedRows([fakeRow(S, 4, 3)])).toMatchObject({ blocking: [], unsealedFake: [] });
      expect(classifyRealSealedRows([fakeRow(S, 5, 5)])).toMatchObject({ blocking: [], unsealedFake: [] });
    });
  });

  describe('rules (14) + (15): the disk side, on the store as lane 2 was left', () => {
    it('REPRODUCTION (and the default for ever): without the explicit word the folder BLOCKS - and the refusal now names the way out', async () => {
      const root = storeOf();
      const facts = await findRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root });
      expect(facts.blocked).toBe(true);
      expect(facts.unprovablePackages).toEqual([`SESSION-${S}`]);
      expect(facts.unsealedFakeOffered).toBe(1);
      const message = realEvidenceMessage(facts);
      expect(message).toContain(`1 unreadable package director(y/ies) [SESSION-${S}]`);
      expect(message).toContain(`1 of the folders named above are unsealed recordings of generated (FAKE) sources only`);
      expect(message).toContain(DISCARD_UNSEALED_FAKE_OPTION);
      expect(message).toMatch(/Nothing was changed\.$/);
      expect(realEvidenceDetails(facts)).toMatchObject({ unreadablePackages: 1, unsealedFakeOffered: 1 });
      await expect(assertNoRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root })).rejects.toMatchObject({ code: 'RESET_BLOCKED_REAL_EVIDENCE' });
      expect(existsSync(join(root, `SESSION-${S}`, 'VIDEO-01.mp4'))).toBe(true);
    });

    it('THE FIX: with the explicit word the folder is cleared, stated by count and name, and removed after the swap - fragments and part files with it', async () => {
      const root = storeOf();
      const facts = await findRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root, discardUnsealedFake: true });
      expect(facts).toMatchObject({ blocked: false, unprovablePackages: [], unsealedFakeFolders: [`SESSION-${S}`], unsealedFakeQuarantined: [], unsealedFakeOffered: 0 });
      expect(unsealedFakeMessage(facts)).toBe(
        `this reset erases 1 unsealed recording folder(s) of dems_lane_2 that were recorded from generated (FAKE) sources only and were never sealed [SESSION-${S}]: asked for by name (${DISCARD_UNSEALED_FAKE_OPTION}); the folders are removed once the database has been replaced.`,
      );
      expect(removeUnsealedFakeRecordings(facts)).toEqual({ removed: [`SESSION-${S}`], kept: [] });
      expect(existsSync(join(root, `SESSION-${S}`))).toBe(false);
    });

    it('NEVER, even with the word (negative controls): a session the database does not prove; a folder that holds a manifest; a session a blocking row names; a folder of another name', async () => {
      const withWord = async (rows: readonly RealSealedEvidenceRow[], root: string) => findRealSealedEvidence(clientOf(rows), { database: 'dems_lane_2', storeRoot: root, discardUnsealedFake: true });
      // No row at all (a production recording that never reached the database, a folder of another database).
      expect(await withWord([], storeOf())).toMatchObject({ blocked: true, unsealedFakeFolders: [] });
      // One of the four sources is this computer's camera: LOCAL_DEVICE is a recording of a person.
      expect(await withWord([fakeRow(S, 4, 3)], storeOf())).toMatchObject({ blocked: true, unsealedFakeFolders: [] });
      // A v2 manifest in the folder: it is a package, judged by its SIGNED manifest (rule (5)), never by this rule.
      const v2 = storeOf();
      writeFileSync(join(v2, `SESSION-${S}`, 'session-manifest.json'), '{}');
      expect(await withWord([fakeRow(S)], v2)).toMatchObject({ blocked: true, unsealedFakeFolders: [], unprovablePackages: [`SESSION-${S}`] });
      // A v1 manifest that says REAL.
      const v1 = storeOf();
      writeFileSync(join(v1, `SESSION-${S}`, 'manifest.json'), JSON.stringify({ integrity: 'REAL' }));
      expect(await withWord([fakeRow(S)], v1)).toMatchObject({ blocked: true, unsealedFakeFolders: [] });
      // The same session is ALSO named by a blocking row (a REAL sealed item without the development proof).
      const real: RealSealedEvidenceRow = { session_id: S, evidence_id: 'EV-20261010-0014', manifest_hash: 'a'.repeat(64), integrity_source: 'REAL', development_flag: false, source_rows: 4, development_rows: 4 };
      expect(await withWord([real, fakeRow(S)], storeOf())).toMatchObject({ blocked: true, unsealedFakeFolders: [] });
      // A folder whose name is not exactly SESSION-<that session>.
      const other = storeOf();
      mkdirSync(join(other, 'SESSION-SES-20261010-0099'));
      expect(await withWord([fakeRow(S)], other)).toMatchObject({ blocked: true, unsealedFakeFolders: [`SESSION-${S}`], unprovablePackages: ['SESSION-SES-20261010-0099'] });
    });

    it('the terminal UNSEALABLE path leaves `.quarantine/<id>`: the same rule - it blocks without the word, is cleared and removed with it; the quarantine of another session stays and blocks', async () => {
      const root = storeOf();
      rmSync(join(root, `SESSION-${S}`), { recursive: true });
      mkdirSync(join(root, '.quarantine', S, 'sealing'), { recursive: true });
      writeFileSync(join(root, '.quarantine', S, 'VIDEO-01.mp4'), 'generated test picture');
      mkdirSync(join(root, '.quarantine', 'SES-20261010-0007'), { recursive: true });
      const without = await findRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root });
      expect(without).toMatchObject({ blocked: true, quarantinedSessions: ['SES-20261010-0007', S], unsealedFakeOffered: 1 });
      const facts = await findRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root, discardUnsealedFake: true });
      // Still blocked: the quarantine of the session the database does not prove.
      expect(facts).toMatchObject({ blocked: true, quarantinedSessions: ['SES-20261010-0007'], unsealedFakeQuarantined: [S] });
      // A blocked run removes nothing.
      expect(removeUnsealedFakeRecordings(facts)).toEqual({ removed: [], kept: [] });
      rmSync(join(root, '.quarantine', 'SES-20261010-0007'), { recursive: true });
      const clear = await findRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root, discardUnsealedFake: true });
      expect(clear.blocked).toBe(false);
      expect(removeUnsealedFakeRecordings(clear)).toEqual({ removed: [`.quarantine/${S}`], kept: [] });
      expect(existsSync(join(root, '.quarantine', S))).toBe(false);
      expect(existsSync(join(root, '.quarantine'))).toBe(true);
    });

    it('judged AGAIN at the removal: a folder that got a manifest in between is left and said; the containment rule refuses a link and a name that is no session', async () => {
      const root = storeOf();
      const facts = await findRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root, discardUnsealedFake: true });
      writeFileSync(join(root, `SESSION-${S}`, 'session-manifest.json'), '{}');
      expect(removeUnsealedFakeRecordings(facts)).toEqual({ removed: [], kept: [{ directory: `SESSION-${S}`, reason: 'NOT_CLEARED_AT_REMOVAL' }] });
      expect(existsSync(join(root, `SESSION-${S}`, 'VIDEO-01.mp4'))).toBe(true);

      const outside = mkdtempSync(join(tmpdir(), 'dems-wia1-outside-'));
      roots.push(outside);
      writeFileSync(join(outside, 'keep.txt'), 'x');
      mkdirSync(join(root, '.quarantine'));
      symlinkSync(outside, join(root, '.quarantine', 'SES-20261010-0031'));
      expect(removeQuarantineFolder(root, '.quarantine', 'SES-20261010-0031')).toEqual({ removed: false, refusal: 'NOT_A_DIRECTORY' });
      expect(removeQuarantineFolder(root, '.quarantine', '../x')).toEqual({ removed: false, refusal: 'NAME_NOT_A_PACKAGE' });
      expect(removeQuarantineFolder(root, '.quarantine', 'SES-20261010-0032')).toEqual({ removed: false, refusal: 'ENTRY_UNRESOLVED' });
      expect(existsSync(join(outside, 'keep.txt'))).toBe(true);
    });

    it('the scan says which manifest file a folder holds, by name only', () => {
      const root = storeOf();
      expect(readEvidenceStore(root).packages).toEqual([{ sessionId: S, directory: `SESSION-${S}`, integrity: 'UNKNOWN', manifest: 'NONE' }]);
      // A scan a test built by hand (no `manifest` member) clears nothing: absent is not NONE.
      const scan: EvidenceStoreScan = { root, present: true, packages: [{ sessionId: S, directory: `SESSION-${S}`, integrity: 'UNKNOWN' }], unreadable: null, quarantined: [] };
      expect(evaluateRealEvidence('dems_lane_2', root, [], scan, { unsealedFake: [S], discardUnsealedFake: true })).toMatchObject({ blocked: true, unsealedFakeFolders: [] });
    });
  });

  describe('the word itself: the command line and the lane tool', () => {
    it('db:reset takes the option once, without a value; without it the option is absent (the default: such a folder blocks)', () => {
      expect(parseResetArguments(['--database', 'dems_lane_2'])).toEqual({ database: 'dems_lane_2', scenario: undefined });
      expect(parseResetArguments(['--database', 'dems_lane_2', DISCARD_UNSEALED_FAKE_OPTION])).toEqual({ database: 'dems_lane_2', scenario: undefined, discardUnsealedFakeRecordings: true });
      expect(parseResetArguments([DISCARD_UNSEALED_FAKE_OPTION, '--database=dems_lane_2'])).toMatchObject({ discardUnsealedFakeRecordings: true });
      expect(() => parseResetArguments(['--database', 'dems_lane_2', DISCARD_UNSEALED_FAKE_OPTION, DISCARD_UNSEALED_FAKE_OPTION])).toThrow(ResetUsageError);
      expect(() => parseResetArguments(['--database', 'dems_lane_2', '--discard-everything'])).toThrow(ResetUsageError);
      expect(DISCARD_UNSEALED_FAKE_OPTION).toBe('--discard-unsealed-fake-recordings');
    });

    it('lane.sh: the option is passed to db:reset for the development capture lane only; a SIMULATED lane is refused (exit 64) before anything is opened; any other third word is a usage error', () => {
      const script = join(REPOSITORY, 'scripts/lane/lane.sh');
      const text = readFileSync(script, 'utf8');
      expect(text).toContain('npm run -s db:reset -w @dems/core-server -- --database "$DATABASE" $DISCARD )');
      expect(text).toContain('[ "$3" = "--discard-unsealed-fake-recordings" ]');
      expect(text).toContain('if [ -n "$DISCARD" ] && [ "$MODE" != "REAL_DEVELOPMENT" ]; then');
      const simulated = spawnSync('/bin/sh', [script, 'reset', '1', DISCARD_UNSEALED_FAKE_OPTION], { encoding: 'utf8' });
      expect(simulated.status).toBe(64);
      expect(simulated.stderr).toContain('is for the development capture lane only; lane 1 runs SIMULATED. Nothing was reset.');
      const wrong = spawnSync('/bin/sh', [script, 'reset', '2', '--discard-everything'], { encoding: 'utf8' });
      expect(wrong.status).toBe(64);
      expect(wrong.stderr).toMatch(/^usage: /);
    });
  });
});
