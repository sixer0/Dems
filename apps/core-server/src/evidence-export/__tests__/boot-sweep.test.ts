// Fix pass F-M8 (review findings R93-04 and R93-10; ruling D178).
//
//   R93-04  a process that dies during an export leaves DECRYPTED evidence in
//           `export/EXP-<id>.zip.partial`. Nothing removed it: export IDs never repeat. The boot
//           sweep removes every `.partial` under every package folder - and nothing else, and
//           nothing behind a link - and the interrupted export is recorded FAILED once.
//   R93-10  a failure between the two "latest" names left `export/export-manifest.json` of an
//           export whose files were then removed, beside the signature of an older export.
//
// The packages are the builder's of verify v2: real bytes, real AES-256-GCM, a throw-away key.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageFolderName } from '@dems/shared/evidence-package';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPackage, removeScratch, scratch, type BuiltPackage } from '../../evidence-verify/__tests__/support';
import { ExportFailure, exportPackage } from '../package-export';
import { portsOf, requestFacts, treeHashes } from './support';

afterEach(removeScratch);

const codeOf = async (run: Promise<unknown>): Promise<string> =>
  run.then(
    () => 'NO_FAILURE',
    (error: unknown) => (error instanceof ExportFailure ? error.code : `NOT_AN_EXPORT_FAILURE:${String(error)}`),
  );

/** A media store root with the built package as `SESSION-<sessionId>` in it. */
function storeWith(built: BuiltPackage): { root: string; dir: string } {
  const root = scratch('store');
  const dir = join(root, packageFolderName(built.item.sessionId));
  renameSync(built.dir, dir);
  return { root, dir };
}

/**
 * What a process leaves that dies while the archive is written: the bytes of the partial archive,
 * taken at the `ARCHIVE_WRITTEN` probe (decrypted camera files are in it by then), written back
 * after the run's own clean-up - which a dead process never reaches.
 */
async function killedExport(dir: string, built: BuiltPackage): Promise<Buffer> {
  let partial: Buffer = Buffer.alloc(0);
  const probe = (step: string): void => {
    if (step !== 'ARCHIVE_WRITTEN') return;
    partial = readFileSync(join(dir, 'export', 'EXP-000032.zip.partial'));
    throw new Error('the process died');
  };
  expect(await codeOf(exportPackage(dir, built.item, requestFacts(), portsOf(built, { probe })))).toBe('EXPORT_FAILED');
  mkdirSync(join(dir, 'export'), { recursive: true, mode: 0o700 });
  writeFileSync(join(dir, 'export', 'EXP-000032.zip.partial'), partial, { mode: 0o600 });
  return partial;
}

describe('R93-04: the boot sweep of interrupted exports', () => {
  it('CONTROL of the finding: the partial of a killed export holds decrypted camera bytes, and a later export of the item does not remove it', async () => {
    const built = await buildPackage();
    const { dir } = storeWith(built);
    const partial = await killedExport(dir, built);
    // Plaintext of the first fragment of VIDEO-01 is in the partial: stored entries, not compressed.
    const record = built.fragment('VIDEO-01', 1);
    const stored = readFileSync(join(dir, 'fragments', 'VIDEO-01.mp4')).subarray(record.byteOffset, record.byteOffset + record.byteLength);
    const plain = Buffer.from(await built.opener.open({ trackId: 'VIDEO-01', seq: record.seq, byteOffset: record.byteOffset, byteLength: record.byteLength, gcmIv: record.gcmIv, gcmTag: record.gcmTag, keyId: record.keyId }, stored));
    expect(plain.equals(stored)).toBe(false);
    expect(partial.includes(plain.subarray(0, 64))).toBe(true);
    expect(partial.includes(stored.subarray(0, 64))).toBe(false);
    await exportPackage(dir, built.item, requestFacts({ exportId: 'EXP-000033' }), portsOf(built));
    expect(readdirSync(join(dir, 'export')).sort()).toContain('EXP-000032.zip.partial');
  });

  it('removes every `.partial` of every package folder, keeps every finished export and every other file, and names what it removed', async () => {
    const { sweepExportPartials } = await import('../boot-sweep');
    const built = await buildPackage();
    const { root, dir } = storeWith(built);
    await exportPackage(dir, built.item, requestFacts({ exportId: 'EXP-000031' }), portsOf(built));
    await killedExport(dir, built);
    writeFileSync(join(dir, 'export', 'EXP-000034.composite.partial'), 'decrypted frames', { mode: 0o600 });
    writeFileSync(join(dir, 'export', 'notes.txt'), 'kept');
    const kept = treeHashes(dir, (path) => path.endsWith('.partial'));

    const swept = await sweepExportPartials(root);
    expect(swept.removed).toEqual([
      { sessionId: built.item.sessionId, file: 'EXP-000032.zip.partial', exportId: 'EXP-000032', composite: false },
      { sessionId: built.item.sessionId, file: 'EXP-000034.composite.partial', exportId: 'EXP-000034', composite: true },
    ]);
    expect(swept.skipped).toEqual([]);
    expect(readdirSync(join(dir, 'export')).filter((name) => name.endsWith('.partial'))).toEqual([]);
    // Nothing else was touched: the finished export, the stray file, the sealed package.
    expect(treeHashes(dir)).toEqual(kept);
    // Again: nothing is left to remove.
    expect((await sweepExportPartials(root)).removed).toEqual([]);
  });

  it('CONTAINMENT: never follows a link - a linked package folder, a linked export folder and a linked `.partial` are left alone, with everything behind them', async () => {
    const { sweepExportPartials } = await import('../boot-sweep');
    const built = await buildPackage();
    const { root, dir } = storeWith(built);
    const outside = scratch('outside');
    mkdirSync(join(outside, 'export'));
    writeFileSync(join(outside, 'export', 'EXP-000040.zip.partial'), 'not ours');
    writeFileSync(join(outside, 'victim.partial'), 'not ours either');
    // A package folder that is a link; an export folder that is a link; a `.partial` that is a link.
    symlinkSync(outside, join(root, 'SESSION-SES-20990101-0001'));
    const second = join(root, 'SESSION-SES-20990101-0002');
    mkdirSync(second);
    symlinkSync(join(outside, 'export'), join(second, 'export'));
    mkdirSync(join(dir, 'export'), { mode: 0o700 });
    symlinkSync(join(outside, 'victim.partial'), join(dir, 'export', 'EXP-000041.zip.partial'));
    // Outside a package folder, and outside `export/`: not looked at.
    writeFileSync(join(root, 'loose.partial'), 'kept');
    writeFileSync(join(dir, 'stray.partial'), 'kept');
    mkdirSync(join(root, 'other'));
    mkdirSync(join(root, 'other', 'export'));
    writeFileSync(join(root, 'other', 'export', 'EXP-000042.zip.partial'), 'kept');

    const swept = await sweepExportPartials(root);
    expect(swept.removed).toEqual([]);
    expect(swept.skipped.map((entry) => entry.reason).sort()).toEqual(['EXPORT_FOLDER_NOT_A_DIRECTORY', 'PACKAGE_FOLDER_NOT_A_DIRECTORY', 'PARTIAL_NOT_A_REGULAR_FILE']);
    for (const file of [join(outside, 'export', 'EXP-000040.zip.partial'), join(outside, 'victim.partial'), join(root, 'loose.partial'), join(dir, 'stray.partial'), join(root, 'other', 'export', 'EXP-000042.zip.partial')]) {
      expect(existsSync(file)).toBe(true);
    }
    // A root that does not exist holds nothing.
    expect(await sweepExportPartials(join(root, 'absent'))).toEqual({ removed: [], skipped: [] });
  });

  it('on the app: each interrupted export is recorded FAILED EXPORT_INTERRUPTED once, with the item of its package folder; the next start records nothing', async () => {
    const { sweepInterruptedExports } = await import('../host');
    const built = await buildPackage();
    const { root, dir } = storeWith(built);
    await killedExport(dir, built);
    writeFileSync(join(dir, 'export', 'EXP-000032.manifest.json.partial'), '{}', { mode: 0o600 });
    const appended: Record<string, unknown>[] = [];
    const errors: Record<string, unknown>[] = [];
    const app = {
      config: { mediaStoreDir: root },
      clock: { now: () => 1 },
      engine: { state: () => ({ audit: { rows: [] }, evidence: [{ id: built.item.evidenceId, sessionId: built.item.sessionId }] }) },
      pipeline: { run: async (_label: string, work: (unit: { audit: { append(entry: Record<string, unknown>): Promise<unknown> } }) => Promise<unknown>) => work({ audit: { append: async (entry) => void appended.push(entry) } }) },
      errorLog: { append: (entry: Record<string, unknown>) => void errors.push(entry) },
    } as unknown as Parameters<typeof sweepInterruptedExports>[0];

    expect(await sweepInterruptedExports(app)).toEqual({ removed: 2, recorded: 1 });
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({ type: 'EVIDENCE_EXPORT_FAILED', evidenceId: built.item.evidenceId, details: { jobId: 'EXPJ-000032', kind: 'PACKAGE', reason: 'EXPORT_INTERRUPTED' } });
    expect(errors).toEqual([]);
    expect(await sweepInterruptedExports(app)).toEqual({ removed: 0, recorded: 0 });
    expect(appended).toHaveLength(1);
  });
});

describe('R93-10: the two "latest" names stay a pair', () => {
  it('a failure at the SECOND name puts the first back: no export-manifest.json of an export whose files were removed', async () => {
    const built = await buildPackage();
    // The second "latest" name cannot be given: a folder that is not empty stands in its place.
    mkdirSync(built.path('export'), { mode: 0o700 });
    mkdirSync(built.path('export/export-manifest.sig'));
    writeFileSync(built.path('export/export-manifest.sig/blocker'), 'x');
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts(), portsOf(built)))).toBe('EXPORT_WRITE_FAILED');
    expect(readdirSync(built.path('export')).sort()).toEqual(['export-manifest.sig']);
  });

  it('with an earlier export in place the pair of THAT export stays, byte for byte', async () => {
    const built = await buildPackage();
    await exportPackage(built.dir, built.item, requestFacts({ exportId: 'EXP-000031' }), portsOf(built));
    const earlier = readFileSync(built.path('export/export-manifest.json'));
    const signature = readFileSync(built.path('export/export-manifest.sig'));
    rmSync(built.path('export/export-manifest.sig'));
    mkdirSync(built.path('export/export-manifest.sig'));
    writeFileSync(built.path('export/export-manifest.sig/blocker'), 'x');
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts({ exportId: 'EXP-000032' }), portsOf(built)))).toBe('EXPORT_WRITE_FAILED');
    expect(readFileSync(built.path('export/export-manifest.json')).equals(earlier)).toBe(true);
    expect(existsSync(built.path('export/EXP-000032.zip'))).toBe(false);
    expect(signature.byteLength).toBeGreaterThan(0);
  });
});
