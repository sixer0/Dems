// M4-SEC-RESET-1 and M4-MT-14 on a throw-away database of this test run (blueprint row 129;
// database contract dbc-4 §N.10 and §E.2 erratum PE-128-40; D83 O-5, confirmed D87(3);
// SEC35-42; test strategy §A.4a).
//
//   M4-SEC-RESET-1  the reset-guard exemption cannot erase real evidence: an item with
//                   `development_sources` NULL blocks, `false` blocks, `true` with one production
//                   kind among its four source rows blocks, `true` with fewer than four rows
//                   blocks (a fifth row cannot exist); an all-development item passes, the reset
//                   states how many development packages it erases; as dems_app none of the
//                   three facts can be changed.
//   M4-MT-14        an adopted ONVIF_RTSP row and the LOCAL_DEVICE rows survive the permitted
//                   reset with their kind; `session_capture_sources` is emptied; the version
//                   stays at this code's pair, (6, 'dbc-7') since migration set 7; the kept set is 13 (12 until PE-0013-01).
//   D98(1) / M7-SEC-SRC-2 (blueprint row 141): the DISK side follows the row side. A package folder
//                   of the exempt item whose SIGNED manifest verifies and says development sources
//                   does not block; an unsigned, tampered or all-PRODUCTION manifest on disk
//                   blocks, as does a signed development manifest whose row is not exempt or
//                   whose digest is not the row's. The packages are real ones of the verify
//                   unit's test builder, in throw-away store roots (never `<dataDir>/media`).
//
// Every reset targets the database the helper created for THIS file, never `dems_demo` or a lane
// (TI-17); the routine is reached through its function with the seam `testRunPrefix`.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { PackageFile, packageFolderName, type SessionCaptureSourceRow } from '@dems/shared/evidence-package';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { PATIENT_MS, catalogOf, contractChecksum, dropOwn, maintenancePool, quiet } from '../../../../test/support/reset';
import { buildPackage, editManifest, removeScratch, throwAwaySigner, type BuiltPackage } from '../../../evidence-verify/__tests__/support';
import { KEPT_TABLE_NAMES } from '../kept-tables';
import { findRealSealedEvidence } from '../real-evidence';
import { resetDatabase, type ResetInternals, type ResetLogEntry } from '../routine';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed', slug: 'm4rst' });

let maintenance: Pool;
let internals: ResetInternals;
let sessionId = '';
let evidenceId = '';

beforeAll(async () => {
  maintenance = maintenancePool(db.run.dataDir);
  internals = { testRunPrefix: db.run.identity.prefix };
  const owner = db.ownerPool();
  // The devices of a development run and of a production run, as rows of their own (D-DB-13):
  // an adopted network camera, this Mac's camera and this Mac's microphone.
  await owner.query(`
    INSERT INTO public.capture_devices (id, kind, transport, address, onvif_uuid, enabled, adapter_kind) VALUES
      ('CAM-07', 'CAMERA', 'ONVIF', '192.0.2.7', 'urn:uuid:m4rst-cam-07', true, 'ONVIF_RTSP'),
      ('CAM-08', 'CAMERA', 'LOCAL', NULL, NULL, true, 'LOCAL_DEVICE'),
      ('MIC-07', 'MIC', 'LOCAL', NULL, NULL, true, 'LOCAL_DEVICE')`);
  // One seeded demo item becomes a REAL sealed item (only these columns change; every CHECK holds).
  const item = await owner.query<{ id: string; session_id: string }>(
    "UPDATE public.evidence_items SET integrity_source = 'REAL', sealed_at = ended_at WHERE id = (SELECT min(id) FROM public.evidence_items) RETURNING id, session_id",
  );
  evidenceId = item.rows[0]?.id ?? '';
  sessionId = item.rows[0]?.session_id ?? '';
  expect(sessionId).toMatch(/^SES-/);
});

afterAll(async () => {
  await db.database.closeResources();
  for (const name of [`${db.name}_next`, `${db.name}_prev`, db.name]) await dropOwn(maintenance, name, db.run.identity.prefix);
  await maintenance.end();
  removeScratch();
});

/** The four source rows of the development shape of D74(2): LOCAL_DEVICE, FAKE, LOCAL_DEVICE, FAKE. */
async function writeDevelopmentSources(owner: Pool): Promise<void> {
  await owner.query('DELETE FROM public.session_capture_sources WHERE session_id = $1', [sessionId]);
  await owner.query(
    `INSERT INTO public.session_capture_sources (session_id, slot, device_id, adapter_kind, recorded_at) VALUES
       ($1, 'VIDEO-01', 'CAM-08', 'LOCAL_DEVICE', 1790823600000),
       ($1, 'VIDEO-02', 'CAM-02', 'FAKE', 1790823600000),
       ($1, 'MIC-PRIMARY', 'MIC-07', 'LOCAL_DEVICE', 1790823600000),
       ($1, 'MIC-STANDBY', 'MIC-02', 'FAKE', 1790823600000)`,
    [sessionId],
  );
}

async function evidenceDigest(pool: Pool): Promise<string> {
  const { rows } = await pool.query<{ digest: string }>(
    `SELECT md5(coalesce((SELECT string_agg(to_jsonb(t)::text, E'\\n' ORDER BY t.id) FROM public.evidence_items AS t), '') ||
                coalesce((SELECT string_agg(to_jsonb(s)::text, E'\\n' ORDER BY s.session_id, s.slot) FROM public.session_capture_sources AS s), '')) AS digest`,
  );
  return rows[0]?.digest ?? '';
}

interface Attempt {
  readonly error: unknown;
  readonly logged: ResetLogEntry[];
}

/** One reset attempt on the file's database; resolves with what was thrown (or null) and what was logged. `storeRoot`: another evidence store than the data directory's. */
async function attemptReset(storeRoot?: string): Promise<Attempt> {
  await quiet(maintenance, db.database);
  const logged: ResetLogEntry[] = [];
  const error = await resetDatabase(
    { database: db.name, clock: () => Date.now(), dataDir: db.run.dataDir, sessionDrainMs: PATIENT_MS, log: (entry) => logged.push(entry), ...(storeRoot === undefined ? {} : { evidenceStoreDir: storeRoot }) },
    internals,
  ).then(
    () => null,
    (thrown: unknown) => thrown,
  );
  return { error, logged };
}

/** Expects a refusal that left the target exactly as it was. */
async function expectBlocked(details: Record<string, number>, storeRoot?: string): Promise<string> {
  const before = await evidenceDigest(db.ownerPool());
  // D133 (2): a refused reset removes no folder of the store, exempt-looking or not.
  const foldersOf = (): string[] => (storeRoot === undefined || !existsSync(storeRoot) ? [] : readdirSync(storeRoot, { recursive: true }).map(String).sort());
  const foldersBefore = foldersOf();
  const { error, logged } = await attemptReset(storeRoot);
  expect(foldersOf()).toEqual(foldersBefore);
  expect(logged.some((entry) => entry.code === 'RESET_DEVELOPMENT_PACKAGES_REMOVED')).toBe(false);
  expect(error).toMatchObject({ name: 'ResetError', code: 'RESET_BLOCKED_REAL_EVIDENCE', step: 'R-3', targetUntouched: true });
  const refusal = logged.find((entry) => entry.code === 'RESET_BLOCKED_REAL_EVIDENCE');
  expect(refusal?.details).toMatchObject({ database: db.name, ...details });
  expect(logged.some((entry) => entry.code === 'RESET_DEVELOPMENT_PACKAGES' || entry.code === 'RESET_CHAIN_DISCARDED')).toBe(false);
  expect(await evidenceDigest(db.ownerPool())).toBe(before);
  const catalog = await catalogOf(maintenance, [db.name, `${db.name}_next`, `${db.name}_prev`]);
  expect(catalog[db.name]).toBeDefined();
  expect(catalog[`${db.name}_next`]).toBeUndefined();
  expect(catalog[`${db.name}_prev`]).toBeUndefined();
  return (error as Error).message;
}

describe('M4-SEC-RESET-1: the development-package exemption cannot erase real evidence', () => {
  it('as dems_app none of the three facts behind the exemption can be changed (42501)', async () => {
    await writeDevelopmentSources(db.ownerPool());
    const app = db.appPool();
    await expect(app.query('UPDATE public.evidence_items SET development_sources = true WHERE id = $1', [evidenceId])).rejects.toMatchObject({ code: '42501' });
    await expect(app.query("UPDATE public.session_capture_sources SET adapter_kind = 'FAKE' WHERE session_id = $1", [sessionId])).rejects.toMatchObject({ code: '42501' });
    await expect(app.query('DELETE FROM public.session_capture_sources WHERE session_id = $1', [sessionId])).rejects.toMatchObject({ code: '42501' });
    await expect(app.query("UPDATE public.capture_devices SET adapter_kind = 'FAKE' WHERE id = 'CAM-07'")).rejects.toMatchObject({ code: '42501' });
    // A fifth source row cannot exist: four slots, one row each (the "more than four" case).
    await expect(
      app.query("INSERT INTO public.session_capture_sources (session_id, slot, device_id, adapter_kind, recorded_at) VALUES ($1, 'VIDEO-01', 'CAM-01', 'FAKE', 1)", [sessionId]),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      app.query("INSERT INTO public.session_capture_sources (session_id, slot, device_id, adapter_kind, recorded_at) VALUES ($1, 'VIDEO-03', 'CAM-01', 'FAKE', 1)", [sessionId]),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('development_sources NULL blocks, although the four source rows are all development kinds', async () => {
    const flag = await db.ownerPool().query('SELECT development_sources FROM public.evidence_items WHERE id = $1', [evidenceId]);
    expect(flag.rows).toEqual([{ development_sources: null }]);
    const message = await expectBlocked({ realRows: 1, developmentUnproven: 0, developmentPackages: 0 });
    expect(message).toContain('1 REAL sealed item(s)');
  });

  it('development_sources false blocks', async () => {
    await db.ownerPool().query('UPDATE public.evidence_items SET development_sources = false WHERE id = $1', [evidenceId]);
    await expectBlocked({ realRows: 1, developmentUnproven: 0, developmentPackages: 0 });
  });

  it('development_sources true with ONE production kind among the four source rows blocks (the cross-check)', async () => {
    const owner = db.ownerPool();
    await owner.query('UPDATE public.evidence_items SET development_sources = true WHERE id = $1', [evidenceId]);
    await owner.query("UPDATE public.session_capture_sources SET device_id = 'CAM-07', adapter_kind = 'ONVIF_RTSP' WHERE session_id = $1 AND slot = 'VIDEO-01'", [sessionId]);
    const message = await expectBlocked({ realRows: 1, developmentUnproven: 1, developmentPackages: 0 });
    expect(message).toContain('1 of them flagged as development sources without four development source rows');
  });

  it('development_sources true with fewer than four source rows blocks; with none at all it blocks too', async () => {
    const owner = db.ownerPool();
    await writeDevelopmentSources(owner);
    await owner.query("DELETE FROM public.session_capture_sources WHERE session_id = $1 AND slot = 'MIC-STANDBY'", [sessionId]);
    await expectBlocked({ realRows: 1, developmentUnproven: 1, developmentPackages: 0 });
    await db.ownerPool().query('DELETE FROM public.session_capture_sources WHERE session_id = $1', [sessionId]);
    await expectBlocked({ realRows: 1, developmentUnproven: 1, developmentPackages: 0 });
  });

  it('a second, production-class REAL item still blocks while the development one is exempt', async () => {
    const owner = db.ownerPool();
    await writeDevelopmentSources(owner);
    await owner.query(
      "UPDATE public.evidence_items SET integrity_source = 'REAL', sealed_at = ended_at WHERE id = (SELECT min(id) FROM public.evidence_items WHERE id <> $1)",
      [evidenceId],
    );
    await expectBlocked({ realRows: 1, developmentUnproven: 0, developmentPackages: 1 });
    await db.ownerPool().query("UPDATE public.evidence_items SET integrity_source = 'DEMO_PACKAGE' WHERE integrity_source = 'REAL' AND id <> $1", [evidenceId]);
  });
});

// ── D98(1): the disk side (blueprint row 141) ─────────────────────────────────────────────────────

const DEVELOPMENT_SOURCE_ROWS: readonly SessionCaptureSourceRow[] = [
  { slot: 'VIDEO-01', deviceId: 'CAM-08', adapterKind: 'LOCAL_DEVICE' },
  { slot: 'VIDEO-02', deviceId: 'CAM-02', adapterKind: 'FAKE' },
  { slot: 'MIC-PRIMARY', deviceId: 'MIC-07', adapterKind: 'LOCAL_DEVICE' },
  { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'FAKE' },
];
const PRODUCTION_SOURCE_ROWS: readonly SessionCaptureSourceRow[] = [
  { slot: 'VIDEO-01', deviceId: 'CAM-07', adapterKind: 'ONVIF_RTSP' },
  { slot: 'VIDEO-02', deviceId: 'CAM-07', adapterKind: 'ONVIF_RTSP' },
  { slot: 'MIC-PRIMARY', deviceId: 'MIC-01', adapterKind: 'USB_AUDIO' },
  { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'USB_AUDIO' },
];

type LooseInput = { tracks: { deviceId: string }[]; audio: { sourceIntervals: { micDeviceId: string }[] } };

/**
 * A REAL sealed package of the file's item in a store root of its own: `<root>/SESSION-<sessionId>/`
 * with a signed v2 manifest (real bytes, hashes, Ed25519 of a throw-away key). The classes come
 * from the source rows, as at a seal.
 */
async function packageOnDisk(rows: readonly SessionCaptureSourceRow[]): Promise<{ built: BuiltPackage; storeRoot: string }> {
  const deviceOf = (slot: string): string => rows.find((row) => row.slot === slot)?.deviceId ?? '';
  const built = await buildPackage({
    sessionId,
    evidenceId,
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
  return { built, storeRoot: dirname(built.dir) };
}

/** The digest the item recorded at its seal (`manifest_hash`): the anchor of the disk side. */
async function recordSealedDigest(digest: string): Promise<void> {
  await db.ownerPool().query('UPDATE public.evidence_items SET manifest_hash = $1 WHERE id = $2', [digest, evidenceId]);
}

/** The guard's own question, as the routine asks it, without running a reset. */
const guardFacts = (storeRoot: string) => findRealSealedEvidence(db.ownerPool(), { database: db.name, storeRoot });

describe('D98(1): the disk side of the exemption follows a SIGNED development manifest, and only that', () => {
  let development: { built: BuiltPackage; storeRoot: string };

  beforeAll(async () => {
    // The row side is exempt from here on: the flag is true and the four rows are development kinds.
    await writeDevelopmentSources(db.ownerPool());
    const state = await db.ownerPool().query('SELECT development_sources FROM public.evidence_items WHERE id = $1', [evidenceId]);
    expect(state.rows).toEqual([{ development_sources: true }]);
    development = await packageOnDisk(DEVELOPMENT_SOURCE_ROWS);
    expect(development.built.manifest.developmentSources).toBe(true);
    expect(development.built.manifest.sessionId).toBe(sessionId);
  });

  it('CONTROL - the row alone is exempt: with an empty store nothing blocks', async () => {
    const facts = await guardFacts(`${development.storeRoot}-none`);
    expect(facts).toMatchObject({ blocked: false, developmentSessions: [sessionId], developmentPackagesOnDisk: [], unprovablePackages: [], diskSessions: [] });
  });

  it('a signed development manifest of the exempt item, with the digest the row recorded: the folder does not block', async () => {
    await recordSealedDigest(development.built.manifest.manifestSha256);
    const facts = await guardFacts(development.storeRoot);
    expect(facts).toMatchObject({ blocked: false, developmentSessions: [sessionId], developmentPackagesOnDisk: [packageFolderName(sessionId)], unprovablePackages: [], diskSessions: [], missingInDatabase: [] });
  });

  it('the same folder BLOCKS when the row recorded another digest (the package is not the one that was sealed for this item)', async () => {
    await recordSealedDigest('ab'.repeat(32));
    await expectBlocked({ realRows: 0, developmentPackages: 1, unreadablePackages: 1 }, development.storeRoot);
    await recordSealedDigest(development.built.manifest.manifestSha256);
    expect((await guardFacts(development.storeRoot)).blocked).toBe(false);
  });

  it('the same folder BLOCKS when its row is not exempt: flag false, flag NULL, or one production kind among the four rows', async () => {
    // A reset attempt closes the pools of the file: the owner pool is asked for anew after each.
    await db.ownerPool().query('UPDATE public.evidence_items SET development_sources = false WHERE id = $1', [evidenceId]);
    await expectBlocked({ realRows: 1, developmentPackages: 0, unreadablePackages: 1 }, development.storeRoot);
    await db.ownerPool().query('UPDATE public.evidence_items SET development_sources = NULL WHERE id = $1', [evidenceId]);
    await expectBlocked({ realRows: 1, developmentPackages: 0, unreadablePackages: 1 }, development.storeRoot);
    await db.ownerPool().query('UPDATE public.evidence_items SET development_sources = true WHERE id = $1', [evidenceId]);
    await db.ownerPool().query("UPDATE public.session_capture_sources SET device_id = 'CAM-07', adapter_kind = 'ONVIF_RTSP' WHERE session_id = $1 AND slot = 'VIDEO-01'", [sessionId]);
    await expectBlocked({ realRows: 1, developmentUnproven: 1, developmentPackages: 0, unreadablePackages: 1 }, development.storeRoot);
    await writeDevelopmentSources(db.ownerPool());
    expect((await guardFacts(development.storeRoot)).blocked).toBe(false);
  });

  it('an UNSIGNED manifest on disk blocks: edited and re-hashed (the hash holds, the signature does not)', async () => {
    const unsigned = await packageOnDisk(DEVELOPMENT_SOURCE_ROWS);
    editManifest(unsigned.built, (manifest) => (manifest.notice = `${String(manifest.notice)} `), { recomputeHash: true });
    const digest = JSON.parse(readFileSync(unsigned.built.path(PackageFile.MANIFEST), 'utf8')) as { manifestSha256: string };
    // Even with the row agreeing with the forged digest.
    await recordSealedDigest(digest.manifestSha256);
    await expectBlocked({ realRows: 0, developmentPackages: 1, unreadablePackages: 1 }, unsigned.storeRoot);
  });

  it('a manifest re-signed with ANOTHER key blocks while the row holds the digest of the real seal', async () => {
    const forged = await packageOnDisk(DEVELOPMENT_SOURCE_ROWS);
    await recordSealedDigest(forged.built.manifest.manifestSha256);
    expect((await guardFacts(forged.storeRoot)).blocked).toBe(false);
    editManifest(forged.built, (manifest) => (manifest.notice = `${String(manifest.notice)} `), { resignWith: throwAwaySigner('KEY-FORGER'), replaceCertificate: true });
    await expectBlocked({ realRows: 0, developmentPackages: 1, unreadablePackages: 1 }, forged.storeRoot);
  });

  it('a TAMPERED manifest on disk blocks: one class edited after the seal', async () => {
    const tampered = await packageOnDisk(DEVELOPMENT_SOURCE_ROWS);
    await recordSealedDigest(tampered.built.manifest.manifestSha256);
    expect((await guardFacts(tampered.storeRoot)).blocked).toBe(false);
    editManifest(tampered.built, (manifest) => (manifest.tracks[1].sourceClass = 'LOCAL_DEVICE'));
    await expectBlocked({ realRows: 0, developmentPackages: 1, unreadablePackages: 1 }, tampered.storeRoot);
  });

  it('a signed all-PRODUCTION manifest on disk blocks although the item row says development', async () => {
    const production = await packageOnDisk(PRODUCTION_SOURCE_ROWS);
    expect(production.built.manifest.developmentSources).toBe(false);
    await recordSealedDigest(production.built.manifest.manifestSha256);
    const message = await expectBlocked({ realRows: 0, developmentUnproven: 0, developmentPackages: 1, unreadablePackages: 1 }, production.storeRoot);
    expect(message).toContain('1 unreadable package director(y/ies)');
    const facts = await guardFacts(production.storeRoot);
    expect(facts).toMatchObject({ blocked: true, developmentPackagesOnDisk: [], unprovablePackages: [packageFolderName(sessionId)] });
  });

  it('a folder without a manifest, and a folder of a session no exempt row names, block', async () => {
    const stray = await packageOnDisk(DEVELOPMENT_SOURCE_ROWS);
    await recordSealedDigest(stray.built.manifest.manifestSha256);
    mkdirSync(`${stray.storeRoot}/SESSION-SES-20990101-0001`);
    const facts = await guardFacts(stray.storeRoot);
    expect(facts).toMatchObject({ blocked: true, developmentPackagesOnDisk: [packageFolderName(sessionId)], unprovablePackages: ['SESSION-SES-20990101-0001'] });
    rmSync(stray.built.path(PackageFile.MANIFEST));
    await expectBlocked({ realRows: 0, developmentPackages: 1, unreadablePackages: 2 }, stray.storeRoot);
    // Left as the next block expects it: the digest of the development package of this describe.
    await recordSealedDigest(development.built.manifest.manifestSha256);
  });
});

describe('the permitted reset: M4-SEC-RESET-1 (the count is stated) and M4-MT-14 (kept rows keep their kind)', () => {
  it('an all-development item passes; the reset states that it erases 1 development package; adopted and local devices survive', async () => {
    const owner = db.ownerPool();
    // D98(1): this reset runs WITH the item's signed development package on disk.
    const onDisk = await packageOnDisk(DEVELOPMENT_SOURCE_ROWS);
    await recordSealedDigest(onDisk.built.manifest.manifestSha256);
    const state = await owner.query(
      `SELECT (SELECT development_sources FROM public.evidence_items WHERE id = $1) AS flag,
              (SELECT count(*)::int FROM public.session_capture_sources WHERE session_id = $2) AS sources,
              (SELECT count(*)::int FROM public.evidence_items WHERE integrity_source = 'REAL' AND sealed_at IS NOT NULL) AS real_items`,
      [evidenceId, sessionId],
    );
    expect(state.rows).toEqual([{ flag: true, sources: 4, real_items: 1 }]);
    const devicesBefore = await contractChecksum(owner, 'capture_devices');
    const keptBefore = Object.fromEntries(await Promise.all(KEPT_TABLE_NAMES.map(async (table) => [table, await contractChecksum(owner, table)] as const)));

    // Schema v5 (erratum PE-129b-01): the session's STT snapshot (T-42) is a rebuilt table too.
    await owner.query(
      `INSERT INTO public.session_stt_config (session_id, enabled, backend, endpoint, model, language, diarization, credential_kind, config_revision, taken_at)
       VALUES ($1, true, 'omlx-server', 'http://127.0.0.1:8000', 'fixture-model', 'id', true, 'REFERENCE', 1, 1)`,
      [sessionId],
    );

    const { error, logged } = await attemptReset(onDisk.storeRoot);
    expect(error).toBeNull();

    // SEC35-42 (3): the count is stated before anything is built.
    const stated = logged.find((entry) => entry.code === 'RESET_DEVELOPMENT_PACKAGES');
    expect(stated?.level).toBe('warn');
    expect(stated?.message).toContain(`this reset erases 1 development-source package record(s) of ${db.name} (${sessionId})`);
    expect(stated?.details).toMatchObject({ realRows: 0, developmentUnproven: 0, developmentPackages: 1 });
    expect(logged.some((entry) => entry.code === 'RESET_BLOCKED_REAL_EVIDENCE')).toBe(false);
    // D98(1): the folder was cleared by its signed mark; D133 (2): the reset says that it removes it, and does.
    expect(stated?.message).toContain('1 package folder(s) on disk carry the signed development mark of such a record and did not block (D98(1)); the reset removes these folders once the database has been replaced (D133 (2)).');
    const removed = logged.find((entry) => entry.code === 'RESET_DEVELOPMENT_PACKAGES_REMOVED');
    expect(removed?.message).toContain(`removed 1 development-source package folder(s) from the evidence store: ${packageFolderName(sessionId)}.`);
    expect(removed?.details).toMatchObject({ storeRoot: onDisk.storeRoot, removed: 1 });
    expect(logged.some((entry) => entry.code === 'RESET_DEVELOPMENT_PACKAGE_LEFT')).toBe(false);
    expect(existsSync(onDisk.built.dir)).toBe(false);
    expect(existsSync(onDisk.storeRoot)).toBe(true);
    // No orphan is left: the guard of the NEXT reset finds no package and does not block (it blocked here before D133 (2)).
    const next = await findRealSealedEvidence(db.ownerPool(), { database: db.name, storeRoot: onDisk.storeRoot });
    expect(next).toMatchObject({ blocked: false, developmentSessions: [], developmentPackagesOnDisk: [], unprovablePackages: [], diskSessions: [] });

    const after = db.ownerPool();
    // The development package record is gone with the rebuilt tables; the source table is empty.
    const rebuilt = await after.query(
      `SELECT (SELECT count(*)::int FROM public.evidence_items WHERE integrity_source = 'REAL') AS real_items,
              (SELECT count(*)::int FROM public.evidence_items WHERE development_sources IS NOT NULL) AS flagged,
              (SELECT count(*)::int FROM public.evidence_items) AS items,
              (SELECT count(*)::int FROM public.session_capture_sources) AS sources,
              (SELECT count(*)::int FROM public.session_stt_config) AS snapshots`,
    );
    expect(rebuilt.rows).toEqual([{ real_items: 0, flagged: 0, items: 13, sources: 0, snapshots: 0 }]);

    // M4-MT-14: the kept set is the same twelve tables plus `core_media_store` (PE-0013-01) and the registry crossed image for image.
    expect(KEPT_TABLE_NAMES).toHaveLength(13);
    expect(KEPT_TABLE_NAMES).toContain('capture_devices');
    expect(KEPT_TABLE_NAMES).not.toContain('session_capture_sources');
    expect(KEPT_TABLE_NAMES).not.toContain('session_stt_config');
    expect(await contractChecksum(after, 'capture_devices')).toBe(devicesBefore);
    for (const table of ['capture_devices', 'capture_device_credentials', 'capture_config', 'stt_config']) {
      expect(await contractChecksum(after, table), table).toBe(keptBefore[table]);
    }
    const devices = await after.query('SELECT id, adapter_kind FROM public.capture_devices ORDER BY id');
    expect(devices.rows).toEqual([
      { id: 'CAM-01', adapter_kind: 'FAKE' },
      { id: 'CAM-02', adapter_kind: 'FAKE' },
      { id: 'CAM-07', adapter_kind: 'ONVIF_RTSP' },
      { id: 'CAM-08', adapter_kind: 'LOCAL_DEVICE' },
      { id: 'MIC-01', adapter_kind: 'FAKE' },
      { id: 'MIC-02', adapter_kind: 'FAKE' },
      { id: 'MIC-07', adapter_kind: 'LOCAL_DEVICE' },
      { id: 'POE-SWITCH', adapter_kind: 'FAKE' },
    ]);
    const meta = await after.query('SELECT schema_version, contract_revision FROM public.schema_meta');
    expect(meta.rows).toEqual([{ schema_version: 6, contract_revision: 'dbc-7' }]);
  });
});
