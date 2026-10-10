// Integration pass E3 item 6: the seed hook over the demo generator (`../demo-seed/seed-hook`), on a
// throw-away data directory. The camera files are built box by box (row 82's `recordSession`), so
// no helper program runs here; the same hook with the REAL helper and a database is
// `test/acceptance/demo-seed-v2.test.ts`.
//
// WHAT IS HELD: staged then placed (nothing lies in the store before `place`); never over a
// folder; every skip by its name with nothing left behind; the session key is made once and kept.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { packageFolderName } from '@dems/shared/evidence-package';
import { afterAll, describe, expect, it } from 'vitest';
import { removePackages } from '../../sealing/__tests__/package-support';
import { recordSession, removeRecordings } from '../../sealing/__tests__/pipeline-support';
import { provisionSigningKey } from '../../capture';
import { DEMO_SEED_STAGING_DIR, DEMO_SOURCE_ROWS, DemoSeedSkip, createDemoPackageSeeder, type DemoSealOptions, type DemoSeedItem } from '../demo-seed';
import { SEED_NOW, demoCore, demoItem, removeDemoCores } from './demo-seed-support';

afterAll(() => {
  removeDemoCores();
  removeRecordings();
  removePackages();
});

/** The synthesiser double: a camera file of four whole fragments in the worker's box shapes. */
function built(): DemoSealOptions['synthesise'] {
  let recording = recordSession({ fragments: 4 });
  return async (request) => {
    if (request.trackId === 'VIDEO-01') recording = recordSession({ fragments: 4 });
    copyFileSync(recording.recordingFile(request.trackId), request.outPath);
  };
}
const itemOf = (sequence: number): DemoSeedItem => {
  const { subject, ...rest } = demoItem(sequence);
  return { ...rest, subject: { name: subject.name, type: subject.type } };
};
const ITEMS = [itemOf(5), itemOf(1)];
const folders = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).sort() : []);
const seederOf = (core: ReturnType<typeof demoCore>, dataDir = core.dataDir, mediaStoreDir = core.mediaStoreDir) =>
  createDemoPackageSeeder({ dataDir, mediaStoreDir }, { synthesise: built(), now: () => SEED_NOW + 5_000, log: core.log });

describe('the seed hook: staged, then placed', () => {
  it('seal -> nothing in the store but the staging root; place -> the two package folders, the staging root gone; the tamper item is marked and its sources are the four FAKE rows', async () => {
    const core = demoCore('hook');
    const seeder = seederOf(core);
    const outcome = await seeder.seal(ITEMS, { replaceable: [] });
    if (outcome.status !== 'SEALED') throw new Error(`not sealed: ${outcome.reason}`);
    expect(outcome.packages.map((entry) => [entry.evidenceId, entry.tampered, entry.seal.developmentSources, entry.mediaMs])).toEqual([
      [ITEMS[0]?.evidenceId, true, true, 8_000],
      [ITEMS[1]?.evidenceId, false, true, 8_000],
    ]);
    expect(outcome.packages[0]?.sourceRows).toEqual(DEMO_SOURCE_ROWS.map((row) => ({ ...row })));
    expect(outcome.packages[0]?.seal.signature.algorithm).toBe('Ed25519');
    // STAGED: a reader of the store finds no package yet.
    expect(folders(core.mediaStoreDir)).toEqual([DEMO_SEED_STAGING_DIR]);
    expect(folders(join(core.mediaStoreDir, DEMO_SEED_STAGING_DIR)).filter((name) => name.startsWith('SESSION-'))).toEqual(ITEMS.map((item) => packageFolderName(item.sessionId)).sort());

    const placement = await seeder.place();
    expect(placement).toEqual({ placed: ITEMS.map((item) => packageFolderName(item.sessionId)), notPlaced: [] });
    expect(folders(core.mediaStoreDir)).toEqual(ITEMS.map((item) => packageFolderName(item.sessionId)).sort());
    // THE KEY IS KEPT: a second generation for the same sessions seals under the keys the store holds (none is made, none removed).
    const keysBefore = ITEMS.map((item) => core.store.sessionKeys.has(`KID-${item.sessionId}`));
    expect(keysBefore).toEqual([true, true]);
    const again = seederOf(core);
    const second = await again.seal(ITEMS, { replaceable: ITEMS.map((item) => packageFolderName(item.sessionId)) });
    if (second.status !== 'SEALED') throw new Error(`not sealed again: ${second.reason}`);
    expect(second.packages[0]?.seal.manifestSha256).not.toBe(outcome.packages[0]?.seal.manifestSha256);
    // NEVER OVER A FOLDER: the old folders are still there, so nothing is placed and each is named.
    expect(await again.place()).toEqual({ placed: [], notPlaced: ITEMS.map((item) => ({ directory: packageFolderName(item.sessionId), reason: 'FOLDER_IN_THE_WAY' })) });
    expect(existsSync(join(core.mediaStoreDir, DEMO_SEED_STAGING_DIR))).toBe(false);
  });

  it('discard removes what was staged; a later place puts nothing anywhere', async () => {
    const core = demoCore('discard');
    const seeder = seederOf(core);
    expect((await seeder.seal(ITEMS, { replaceable: [] })).status).toBe('SEALED');
    await seeder.discard();
    expect(folders(core.mediaStoreDir)).toEqual([]);
    expect(await seeder.place()).toEqual({ placed: [], notPlaced: [] });
  });
});

describe('the seed hook: every skip by its name, with nothing left behind', () => {
  const skipOf = async (run: Promise<Awaited<ReturnType<ReturnType<typeof seederOf>['seal']>>>): Promise<string> => {
    const outcome = await run;
    return outcome.status === 'SKIPPED' ? outcome.reason : 'SEALED';
  };

  it('a folder in the way that the caller does not replace; a store root other than the one the caller judged; a store outside the data directory', async () => {
    const core = demoCore('skips');
    const inTheWay = join(core.mediaStoreDir, packageFolderName(ITEMS[1]?.sessionId ?? ''));
    mkdirSync(inTheWay, { recursive: true });
    const blocked = await seederOf(core).seal(ITEMS, { replaceable: [] });
    expect(blocked).toMatchObject({ status: 'SKIPPED', reason: DemoSeedSkip.PACKAGE_FOLDER_IN_THE_WAY });
    expect(blocked.status === 'SKIPPED' ? blocked.message : '').toContain(packageFolderName(ITEMS[1]?.sessionId ?? ''));
    expect(folders(core.mediaStoreDir)).toEqual([packageFolderName(ITEMS[1]?.sessionId ?? '')]);
    rmSync(inTheWay, { recursive: true });
    expect(await skipOf(seederOf(core).seal(ITEMS, { replaceable: [], storeRoot: join(core.dataDir, 'another-store') }))).toBe(DemoSeedSkip.STORE_ROOT_MISMATCH);
    expect(await skipOf(seederOf(core, core.dataDir, join(core.dataDir, '..', 'outside-store')).seal(ITEMS, { replaceable: [] }))).toBe(DemoSeedSkip.STORE_OUTSIDE_DATA_DIR);
    expect(folders(core.mediaStoreDir)).toEqual([]);
    // CONTROL: the same Core and items, nothing in the way, the judged root its own: sealed.
    expect(await skipOf(seederOf(core).seal(ITEMS, { replaceable: [], storeRoot: core.mediaStoreDir }))).toBe('SEALED');
  });

  it('no signing key; a key that is not the development key; a helper that writes no file', async () => {
    const core = demoCore('keys');
    const noKey = join(core.dataDir, 'core-without-key');
    mkdirSync(noKey, { recursive: true, mode: 0o700 });
    expect(await skipOf(seederOf(core, noKey, join(noKey, 'media', 'sessions')).seal(ITEMS, { replaceable: [] }))).toBe(DemoSeedSkip.SIGNING_KEY_NOT_USABLE);
    const productKey = join(core.dataDir, 'core-with-a-product-key');
    mkdirSync(productKey, { recursive: true, mode: 0o700 });
    provisionSigningKey({ dir: join(productKey, 'signer'), now: SEED_NOW });
    expect(await skipOf(seederOf(core, productKey, join(productKey, 'media', 'sessions')).seal(ITEMS, { replaceable: [] }))).toBe(DemoSeedSkip.NOT_A_DEVELOPMENT_KEY);
    const silent = createDemoPackageSeeder({ dataDir: core.dataDir, mediaStoreDir: core.mediaStoreDir }, { synthesise: async () => {}, now: () => SEED_NOW + 5_000, log: core.log });
    expect(await skipOf(silent.seal(ITEMS, { replaceable: [] }))).toBe(DemoSeedSkip.GENERATION_FAILED);
    expect(folders(core.mediaStoreDir)).toEqual([]);
  });
});
