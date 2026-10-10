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
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { readEvidenceStore, type EvidenceStoreScan } from '../../commands/evidence-store';
import { PackageRemovalRefusal, removePackageFolder, type PackageFolderRemover } from '../package-removal';
import { evaluateRealEvidence, removeClearedDevelopmentPackages, type DevelopmentItem, type RealEvidenceFacts, type SealedSourceMarkReader } from '../real-evidence';

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
    writeFileSync(join(v1, 'manifest.json'), JSON.stringify({ integrity: 'DEMO_PACKAGE' }));
    folder(store, 'SES-20261009-0002'); // the live media directory of a session: every package file, the wrong folder
    const scan = readEvidenceStore(store);
    expect(scan.packages).toEqual([
      // v1: `manifest.json` says what it is.
      { sessionId: 'SES-20260930-0004', directory: 'SESSION-SES-20260930-0004', integrity: 'DEMO' },
      // v2: the scan cannot clear it (fail-safe: it blocks); rule (5) asks its signed `session-manifest.json`.
      { sessionId: 'SES-20261009-0001', directory: 'SESSION-SES-20261009-0001', integrity: 'UNKNOWN' },
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
