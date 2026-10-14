// The media store root of the Core in the database, and the command-line reset that reads it
// (database contract erratum PE-0013-01, migration 0013, table T-43 `core_media_store`; controller
// ruling D166 on finding D11-9), against PostgreSQL, the REAL app factory and the REAL routine.
//
// THE GAP THIS CLOSES. The reset is refused while a real sealed package exists below the Core's
// media store root. The server knows that root (its configuration). `db:reset` knew it only when
// its shell carried the server's `DEMS_MEDIA_DIR`; without it the command judged the default
// folder below the data directory - on an installation that keeps its media elsewhere, an empty
// folder, and a package without a row was missed.
//
//   A  the Core writes its root at every start (boot step `db.mediaStoreRoot`), as dems_app,
//      after the database checks and the engine; a later start with another root replaces the
//      row; a root that cannot be stored stops the start, by name
//   B  `db:reset` WITHOUT the variable reads the stored root, PRINTS it, finds the signed
//      PRODUCTION package there and blocks: exit 1, nothing changed.
//      CONTROL: the folder the command judged before (below the data directory) does not hold it
//   C  neither the variable nor the table: `RESET_STORE_ROOT_UNKNOWN`, nothing changed; the
//      variable and the table disagree: `RESET_STORE_ROOT_CONFLICT`; a relative variable is refused
//   D  THE REMOVAL OF A PERMITTED RESET BELOW A CONFIGURED ROOT (the case pass D11 named as
//      missing): an exempt development item with its SIGNED package under a root outside the
//      data directory - the folder is removed; a live-session folder and a file in the same root,
//      and the same package folder in ANOTHER root, are never removed; the stored root is KEPT
//      across the reset
//
// WHICH DATABASE IS RESET. This file's own throw-away database and its clones, never `dems_demo`
// or a lane (TI-17). The packages are real ones of the verify unit's test builder, signed with a
// throw-away key, in throw-away roots.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { packageFolderName, type SessionCaptureSourceRow } from '@dems/shared/evidence-package';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { PATIENT_MS, catalogOf, dropOwn, maintenancePool, quiet } from '../../../../test/support/reset';
import { buildPackage, removeScratch } from '../../../evidence-verify/__tests__/support';
import { sessionsApp } from '../../../modules/sessions/__tests__/support';
import { BOOT_STEP_MEDIA_STORE_ROOT, MEDIA_STORE_ROOT_NOT_RECORDED } from '../../../plugins/db';
import { BootError } from '../../../plugins/readiness';
import type { CommandIo } from '../../commands/cli';
import { evidenceStoreRoot, readEvidenceStore } from '../../commands/evidence-store';
import { READ_MEDIA_STORE_ROOT, readMediaStoreRoot } from '../../commands/media-store-root';
import { resetStoreRootOf, runReset, type ResetCommandOptions } from '../cli';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed', slug: 'storeroot' });

/** Where this installation keeps its sealed packages: NOT below the data directory. */
const mediaRoot = mkdtempSync(join(tmpdir(), 'dems-0013-media-'));
/** Another folder of the machine: a root this Core does not use. */
const otherRoot = mkdtempSync(join(tmpdir(), 'dems-0013-other-'));
const PRODUCTION_SESSION = 'SES-20261010-0013';
const PRODUCTION_FOLDER = packageFolderName(PRODUCTION_SESSION);
const VARIABLE = 'DEMS_MEDIA_DIR';

let maintenance: Pool;
let productionPackage = '';

type LooseInput = { tracks: { deviceId: string }[]; audio: { sourceIntervals: { micDeviceId: string }[] } };

/** A signed package whose classes come from the four source rows, as at a seal. */
async function signedPackage(sessionId: string, rows: readonly SessionCaptureSourceRow[], evidenceId?: string) {
  const deviceOf = (slot: string): string => rows.find((row) => row.slot === slot)?.deviceId ?? '';
  return buildPackage({
    sessionId,
    ...(evidenceId === undefined ? {} : { evidenceId }),
    folderName: packageFolderName(sessionId),
    sourceRows: rows,
    fragments: 2,
    fragmentBytes: 64,
    beforeSeal: (input) => {
      const loose = input as unknown as LooseInput;
      loose.tracks.forEach((track, index) => (track.deviceId = deviceOf(index === 0 ? 'VIDEO-01' : 'VIDEO-02')));
      loose.audio.sourceIntervals.forEach((interval, index) => (interval.micDeviceId = deviceOf(index === 0 ? 'MIC-PRIMARY' : 'MIC-STANDBY')));
    },
  });
}

async function reset(database: string, more: Partial<ResetCommandOptions> = {}): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const io: CommandIo = { out: (line) => out.push(line), err: (line) => err.push(line) };
  const code = await runReset(['--database', database], {
    io,
    dataDir: db.run.dataDir,
    clock: () => Date.UTC(2026, 9, 10, 4, 0, 0),
    sessionDrainMs: PATIENT_MS,
    internals: { testRunPrefix: db.run.identity.prefix },
    ...more,
  });
  console.log(`[0013] db:reset --database ${database}: exit ${code}\n${[...out, ...err].map((line) => `  ${line}`).join('\n')}`);
  return { code, out, err };
}

const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const storedRoot = async (pool: Pool): Promise<unknown[]> => (await pool.query(READ_MEDIA_STORE_ROOT)).rows;
const oidOf = async (name: string): Promise<string | undefined> => (await catalogOf(maintenance, [name]))[name]?.oid;

beforeAll(async () => {
  maintenance = maintenancePool(db.run.dataDir);
  expect(relative(db.run.dataDir, mediaRoot).startsWith('..')).toBe(true);
  const built = await signedPackage(PRODUCTION_SESSION, [
    { slot: 'VIDEO-01', deviceId: 'CAM-07', adapterKind: 'ONVIF_RTSP' },
    { slot: 'VIDEO-02', deviceId: 'CAM-07', adapterKind: 'ONVIF_RTSP' },
    { slot: 'MIC-PRIMARY', deviceId: 'MIC-01', adapterKind: 'USB_AUDIO' },
    { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'USB_AUDIO' },
  ]);
  expect(built.manifest.developmentSources).toBe(false);
  productionPackage = built.dir;
});

afterAll(async () => {
  await db.database.closeResources();
  for (const name of [`${db.name}_next`, `${db.name}_prev`, db.name]) await dropOwn(maintenance, name, db.run.identity.prefix);
  await maintenance.end();
  removeScratch();
  rmSync(mediaRoot, { recursive: true, force: true });
  rmSync(otherRoot, { recursive: true, force: true });
});

describe('A: the Core records its media store root at every start', () => {
  it('schema version 14, contract dbc-15; a seeded database that no Core has started on stores no root', async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([14, 'dbc-15']);
    expect(await storedRoot(db.ownerPool())).toEqual([]);
  });

  it('a boot writes the configured root as dems_app, after the database checks and the engine; the line in the log names it', async () => {
    const server = await sessionsApp(db, db.run.dataDir, { logLevel: 'info', config: { dataDir: db.run.dataDir, mediaStoreDir: mediaRoot } });
    expect(server.app.config.mediaStoreDir).toBe(mediaRoot);
    expect(await storedRoot(db.ownerPool())).toEqual([{ media_root: mediaRoot, recorded_at: String(server.clock.now()) }]);
    const steps = server.log.lines().filter((line) => line['msg'] === 'boot step passed').map((line) => String(line['step']));
    expect(steps).toContain(BOOT_STEP_MEDIA_STORE_ROOT);
    for (const earlier of ['B-3', 'B-9', 'engine.rehydrate']) expect(steps.indexOf(earlier), earlier).toBeGreaterThanOrEqual(0);
    expect(steps.indexOf(BOOT_STEP_MEDIA_STORE_ROOT)).toBeGreaterThan(steps.indexOf('B-9'));
    expect(steps.indexOf(BOOT_STEP_MEDIA_STORE_ROOT)).toBeGreaterThan(steps.indexOf('engine.rehydrate'));
    // The server's log states the fact and not the path (no line of the server names a directory of the installation); `db:reset` prints it.
    expect(server.log.lines().find((line) => line['step'] === BOOT_STEP_MEDIA_STORE_ROOT && line['recordedAt'] !== undefined)).toMatchObject({ recordedAt: server.clock.now() });
    expect(server.log.text()).not.toContain(mediaRoot);
    // The statement ran on the server's own pool: the runtime role, not the owner.
    expect((await server.app.db.pool.query('SELECT current_user::text AS role')).rows).toEqual([{ role: 'dems_app' }]);
    await server.app.close();
    // A second start with the SAME root, later: the row is byte for byte what it was.
    const first = await storedRoot(db.ownerPool());
    const again = await sessionsApp(db, db.run.dataDir, { startAt: Date.UTC(2026, 9, 1, 9, 0, 0), config: { dataDir: db.run.dataDir, mediaStoreDir: mediaRoot } });
    expect(await storedRoot(db.ownerPool())).toEqual(first);
    await again.app.close();
  });

  it('a later start with ANOTHER root replaces the row (one row, the newest configuration); the next start writes the first root again', async () => {
    const moved = await sessionsApp(db, db.run.dataDir, { startAt: Date.UTC(2026, 9, 2, 3, 0, 0), config: { dataDir: db.run.dataDir, mediaStoreDir: `${otherRoot}//nested/../` } });
    // Stored normalised: an absolute path without `..`, a doubled or a trailing separator.
    expect(await storedRoot(db.ownerPool())).toEqual([{ media_root: otherRoot, recorded_at: String(Date.UTC(2026, 9, 2, 3, 0, 0)) }]);
    await moved.app.close();
    const back = await sessionsApp(db, db.run.dataDir, { startAt: Date.UTC(2026, 9, 3, 3, 0, 0), config: { dataDir: db.run.dataDir, mediaStoreDir: mediaRoot } });
    expect(await readMediaStoreRoot(db.ownerPool())).toEqual({ root: mediaRoot, recordedAt: Date.UTC(2026, 9, 3, 3, 0, 0) });
    expect((await db.ownerPool().query('SELECT count(*)::int AS rows FROM public.core_media_store')).rows).toEqual([{ rows: 1 }]);
    await back.app.close();
  });

  it('a root that cannot be stored STOPS the start at that step, by name: no server keeps running beside the root of an earlier configuration', async () => {
    const target = await db.another({ template: 'seed', slug: 'storeroot_refused' });
    // What a database looks like where the grant of 0014 is missing: the runtime role may not write the table.
    await target.ownerPool().query('REVOKE INSERT, UPDATE ON public.core_media_store FROM dems_app');
    const error = await sessionsApp(target, db.run.dataDir, { logLevel: 'info', config: { dataDir: db.run.dataDir, mediaStoreDir: mediaRoot } }).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(BootError);
    expect((error as BootError).stepId).toBe(BOOT_STEP_MEDIA_STORE_ROOT);
    expect((error as BootError & { cause?: { code?: string } }).cause).toMatchObject({ code: MEDIA_STORE_ROOT_NOT_RECORDED });
    expect(await storedRoot(target.ownerPool())).toEqual([]);
  });
});

describe('B: db:reset without the variable reads the stored root and blocks on a signed production package there', () => {
  it('exit 1, RESET_BLOCKED_REAL_EVIDENCE; the root it judged is printed first and is the stored one; the database and the package are untouched', async () => {
    cpSync(productionPackage, join(mediaRoot, PRODUCTION_FOLDER), { recursive: true });
    try {
      // CONTROL (the gap): the folder the command judged before this change - below the data directory - does not hold the package.
      const before = evidenceStoreRoot(db.run.dataDir);
      expect(before).not.toBe(mediaRoot);
      expect(readEvidenceStore(before).packages.map((entry) => entry.directory)).not.toContain(PRODUCTION_FOLDER);
      // The tables hold no REAL sealed row: the disk side alone can see this package.
      expect((await db.ownerPool().query("SELECT count(*)::int AS n FROM public.evidence_items WHERE integrity_source = 'REAL' AND sealed_at IS NOT NULL")).rows).toEqual([{ n: 0 }]);
      const oid = await oidOf(db.name);
      await quiet(maintenance, db.database);

      const { code, out, err } = await reset(db.name, { environment: {} });
      expect(code).toBe(1);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatch(new RegExp(`^db:reset: media store root the real-evidence guard judges: ${literal(mediaRoot)} \\(recorded by the Core of ${literal(db.name)} at its start of 2026-10-03T03:00:00\\.000Z \\(\\d+\\); ${VARIABLE} is not set for this command\\)$`));
      expect(err.at(-1)).toBe('db:reset: NOT RESET (RESET_BLOCKED_REAL_EVIDENCE at R-3); the database is unchanged.');
      expect(err.join('\n')).toContain(mediaRoot);
      expect(await oidOf(db.name)).toBe(oid);
      expect((await catalogOf(maintenance, [`${db.name}_next`]))[`${db.name}_next`]).toBeUndefined();
      expect(readEvidenceStore(mediaRoot).packages.map((entry) => entry.directory)).toEqual([PRODUCTION_FOLDER]);
    } finally {
      rmSync(join(mediaRoot, PRODUCTION_FOLDER), { recursive: true, force: true });
    }
  });
});

describe('C: the command refuses, by name and with nothing changed, when it cannot know the root', () => {
  it('neither the variable nor the table: RESET_STORE_ROOT_UNKNOWN (exit 1); the same database with the variable set is not refused for that', async () => {
    const target = await db.another({ template: 'seed', slug: 'storeroot_unknown' });
    expect(await storedRoot(target.ownerPool())).toEqual([]);
    const oid = await oidOf(target.name);
    await quiet(maintenance, target);
    const { code, out, err } = await reset(target.name, { environment: {} });
    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual([
      `db:reset: refused: this command cannot tell where the Core of ${target.name} keeps its media: ${VARIABLE} is not set in its environment, and the database records no root (no Core has started on it since migration 0013). Set ${VARIABLE} to the server's media store root, or start the Core once. Nothing was changed.`,
      'db:reset: NOT RESET (RESET_STORE_ROOT_UNKNOWN at R-3); the database is unchanged.',
    ]);
    expect(await oidOf(target.name)).toBe(oid);
    expect((await catalogOf(maintenance, [`${target.name}_next`]))[`${target.name}_next`]).toBeUndefined();

    // CONTROL: the variable alone is enough - the command says which root it judges, and resets.
    const given = await reset(target.name, { environment: { [VARIABLE]: otherRoot } });
    expect(given.err).toEqual([]);
    expect(given.code).toBe(0);
    expect(given.out[0]).toBe(`db:reset: media store root the real-evidence guard judges: ${otherRoot} (${VARIABLE} of this command; the database records none)`);
    expect(await oidOf(target.name)).not.toBe(oid);
    await dropOwn(maintenance, target.name, db.run.identity.prefix);
  });

  it('the variable names one root and the Core recorded another: RESET_STORE_ROOT_CONFLICT (exit 1), both named; a relative variable is refused before anything is opened', async () => {
    const oid = await oidOf(db.name);
    await quiet(maintenance, db.database);
    const conflict = await reset(db.name, { environment: { [VARIABLE]: otherRoot } });
    expect(conflict.code).toBe(1);
    expect(conflict.out).toEqual([]);
    expect(conflict.err[0]).toContain(`${VARIABLE} of this command names the media store root ${otherRoot}, and the Core of ${db.name} recorded ${mediaRoot}`);
    expect(conflict.err.at(-1)).toBe('db:reset: NOT RESET (RESET_STORE_ROOT_CONFLICT at R-3); the database is unchanged.');

    const relativeRoot = await reset(db.name, { environment: { [VARIABLE]: 'media/sessions' } });
    expect(relativeRoot.code).toBe(1);
    expect(relativeRoot.out).toEqual([]);
    expect(relativeRoot.err).toEqual(['db:reset: failed (ConfigError).']);
    expect(await oidOf(db.name)).toBe(oid);
  });

  it('the rule itself (pure): the variable equal to the stored root is taken and said; the three refusals carry their codes', () => {
    const said: string[] = [];
    const stored = { root: '/srv/dems/media', recordedAt: Date.UTC(2026, 9, 3, 3, 0, 0) };
    expect(resetStoreRootOf('dems_demo', '/srv/dems//media/', stored, (line) => said.push(line))).toBe('/srv/dems/media');
    expect(resetStoreRootOf('dems_demo', undefined, stored, (line) => said.push(line))).toBe('/srv/dems/media');
    expect(resetStoreRootOf('dems_demo', '/srv/dems/media', null, (line) => said.push(line))).toBe('/srv/dems/media');
    expect(said).toHaveLength(3);
    for (const line of said) expect(line).toContain('media store root the real-evidence guard judges: /srv/dems/media');
    expect(() => resetStoreRootOf('dems_demo', undefined, null, () => undefined)).toThrow(expect.objectContaining({ code: 'RESET_STORE_ROOT_UNKNOWN', step: 'R-3', targetUntouched: true }));
    expect(() => resetStoreRootOf('dems_demo', '/srv/elsewhere', stored, () => undefined)).toThrow(expect.objectContaining({ code: 'RESET_STORE_ROOT_CONFLICT', step: 'R-3', targetUntouched: true }));
  });
});

describe('D: a permitted reset removes the cleared development package below the CONFIGURED root, and nothing else', () => {
  it('the exempt item\'s signed package under the stored root is removed; a live-session folder and a file beside it, and the same folder in another root, stay; the stored root crosses the reset', async () => {
    const owner = db.ownerPool();
    // One seeded demo item becomes a REAL sealed item of development sources (the four built-in test sources).
    const item = (await owner.query<{ id: string; session_id: string }>(
      "UPDATE public.evidence_items SET integrity_source = 'REAL', sealed_at = ended_at, development_sources = true WHERE id = (SELECT min(id) FROM public.evidence_items) RETURNING id, session_id",
    )).rows[0];
    const sessionId = item?.session_id ?? '';
    const rows: SessionCaptureSourceRow[] = [
      { slot: 'VIDEO-01', deviceId: 'CAM-01', adapterKind: 'FAKE' },
      { slot: 'VIDEO-02', deviceId: 'CAM-02', adapterKind: 'FAKE' },
      { slot: 'MIC-PRIMARY', deviceId: 'MIC-01', adapterKind: 'FAKE' },
      { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'FAKE' },
    ];
    for (const row of rows) await owner.query('INSERT INTO public.session_capture_sources (session_id, slot, device_id, adapter_kind, recorded_at) VALUES ($1, $2, $3, $4, 1790823600000)', [sessionId, row.slot, row.deviceId, row.adapterKind]);
    const built = await signedPackage(sessionId, rows, item?.id);
    expect(built.manifest.developmentSources).toBe(true);
    await owner.query('UPDATE public.evidence_items SET manifest_hash = $1 WHERE id = $2', [built.manifest.manifestSha256, item?.id]);

    const folder = packageFolderName(sessionId);
    // In the configured root: the package, a LIVE session folder (named after the session alone: not a package) and a file.
    cpSync(built.dir, join(mediaRoot, folder), { recursive: true });
    mkdirSync(join(mediaRoot, 'SES-20990101-0001'));
    writeFileSync(join(mediaRoot, 'SES-20990101-0001', 'recording.part'), 'a recording in progress');
    writeFileSync(join(mediaRoot, 'operator-notes.txt'), 'not a package');
    // In ANOTHER root: the very same package folder. No reset of this Core may touch it.
    cpSync(built.dir, join(otherRoot, folder), { recursive: true });
    const elsewhere = readdirSync(join(otherRoot, folder), { recursive: true }).map(String).sort();
    expect(elsewhere.length).toBeGreaterThan(3);

    const stored = await storedRoot(owner);
    expect(stored).toHaveLength(1);
    const oid = await oidOf(db.name);
    await quiet(maintenance, db.database);

    const { code, out, err } = await reset(db.name, { environment: {} });
    expect(err.filter((line) => !/development-source package/.test(line))).toEqual([]);
    expect(code).toBe(0);
    expect(out[0]).toContain(`media store root the real-evidence guard judges: ${mediaRoot} (recorded by the Core of ${db.name}`);
    expect(await oidOf(db.name)).not.toBe(oid);
    const all = [...out, ...err].join('\n');
    expect(all).toContain(`this reset erases 1 development-source package record(s) of ${db.name} (${sessionId})`);
    expect(all).toContain(`removed 1 development-source package folder(s) from the evidence store: ${folder}.`);

    // REMOVED: the cleared folder below the configured root. KEPT: everything else in that root...
    expect(existsSync(join(mediaRoot, folder))).toBe(false);
    expect(readdirSync(mediaRoot).sort()).toEqual(['SES-20990101-0001', 'operator-notes.txt']);
    expect(readdirSync(join(mediaRoot, 'SES-20990101-0001'))).toEqual(['recording.part']);
    // ...and the same folder in the other root, file for file.
    expect(readdirSync(join(otherRoot, folder), { recursive: true }).map(String).sort()).toEqual(elsewhere);

    // The stored root is a KEPT row: the new database holds it, image for image, and the report counts it.
    expect(await storedRoot(db.ownerPool())).toEqual(stored);
    expect(out.find((line) => line.includes('kept tables carried over unchanged'))).toContain('core_media_store 1');
    // The rebuilt tables hold the seed again: no REAL item, no source row.
    expect((await db.ownerPool().query("SELECT (SELECT count(*)::int FROM public.evidence_items WHERE integrity_source = 'REAL') AS real_items, (SELECT count(*)::int FROM public.session_capture_sources) AS sources")).rows).toEqual([{ real_items: 0, sources: 0 }]);
  });

  it('CONTROL - a folder that is NOT cleared is never removed: the same reset with a production package beside it is refused and removes nothing', async () => {
    cpSync(productionPackage, join(mediaRoot, PRODUCTION_FOLDER), { recursive: true });
    try {
      const listing = readdirSync(mediaRoot, { recursive: true }).map(String).sort();
      const oid = await oidOf(db.name);
      await quiet(maintenance, db.database);
      const { code, err } = await reset(db.name, { environment: {} });
      expect(code).toBe(1);
      expect(err.at(-1)).toBe('db:reset: NOT RESET (RESET_BLOCKED_REAL_EVIDENCE at R-3); the database is unchanged.');
      expect(readdirSync(mediaRoot, { recursive: true }).map(String).sort()).toEqual(listing);
      expect(await oidOf(db.name)).toBe(oid);
    } finally {
      rmSync(join(mediaRoot, PRODUCTION_FOLDER), { recursive: true, force: true });
    }
  });
});
