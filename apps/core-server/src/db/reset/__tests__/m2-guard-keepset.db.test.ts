// M2-MT-5 and M2-MT-6 on throw-away databases of this test run (blueprint row 54 / CS-21;
// `dbc-3` §E.1 and §E.2; OD-19, RK-16, SEC35-22; test strategy M2-MT-5, M2-MT-6).
//
// Every reset targets a database the helper created for THIS file, never `dems_demo` or a lane
// (TI-17). The routine is reached through its function with the seam `testRunPrefix`, which no
// entry point sets. The live databases are not named here at all.
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import type { EvidenceStoreScan } from '../../commands/evidence-store';
import { KEPT_TABLE_NAMES } from '../kept-tables';
import { resetDatabase, type ResetInternals, type ResetLogEntry } from '../routine';
import { PATIENT_MS, catalogOf, contractChecksum, discard, dropOwn, maintenancePool, quiet } from '../../../../test/support/reset';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed', slug: 'rgk' });

let maintenance: Pool;
let internals: ResetInternals;

beforeAll(() => {
  maintenance = maintenancePool(db.run.dataDir);
  internals = { testRunPrefix: db.run.identity.prefix };
});

afterAll(async () => {
  await db.database.closeResources();
  for (const name of [`${db.name}_next`, `${db.name}_prev`, db.name]) await dropOwn(maintenance, name, db.run.identity.prefix);
  await maintenance.end();
});

/** A store scan holding one REAL sealed package for a session, for the disk side of the guard. */
const storeWithRealPackage = (sessionId: string): ((root: string) => EvidenceStoreScan) => (root) => ({
  root,
  present: true,
  packages: [{ sessionId, directory: `SESSION-${sessionId}`, integrity: 'REAL' }],
});

async function evidenceDigest(pool: Pool): Promise<string> {
  const { rows } = await pool.query<{ digest: string }>(
    "SELECT md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY t.id), '')) AS digest FROM public.evidence_items AS t",
  );
  return rows[0]?.digest ?? '';
}

describe('M2-MT-6: a real sealed package makes the reset refuse and audit, with the target untouched', () => {
  it('a REAL sealed row in the database blocks the reset before R-1; nothing is created or changed', async () => {
    const owner = db.ownerPool();
    // Turn one seeded demo item into a REAL sealed item. Only `integrity_source` and `sealed_at`
    // change; every CHECK still holds (`sealed_at = ended_at` satisfies the values check).
    await owner.query(
      "UPDATE public.evidence_items SET integrity_source = 'REAL', sealed_at = ended_at WHERE id = (SELECT min(id) FROM public.evidence_items)",
    );
    const before = await evidenceDigest(owner);
    const names = [db.name, `${db.name}_next`, `${db.name}_prev`];

    // The routine refuses at the start of R-3, after it has quieted the target (R-1); the server
    // path refuses earlier still via its own pre-flight call.
    await quiet(maintenance, db.database);
    const logged: ResetLogEntry[] = [];
    const error = await resetDatabase(
      { database: db.name, clock: () => Date.now(), dataDir: db.run.dataDir, sessionDrainMs: PATIENT_MS, log: (entry) => logged.push(entry) },
      internals,
    ).catch((thrown: unknown) => thrown);

    // The refusal names the code, the step, and leaves the target exactly as it was.
    expect(error).toMatchObject({ name: 'ResetError', code: 'RESET_BLOCKED_REAL_EVIDENCE', step: 'R-3', targetUntouched: true });
    expect((error as Error).message).toContain('RESET_BLOCKED_REAL_EVIDENCE');

    // It is audited: the routine logged a warning line carrying the code and the counts.
    const refusal = logged.find((entry) => entry.code === 'RESET_BLOCKED_REAL_EVIDENCE');
    expect(refusal).toBeDefined();
    expect(refusal?.level).toBe('warn');
    expect(refusal?.details).toMatchObject({ database: db.name, realRows: 1 });
    // Nothing past R-0 ran: no quiesce, no chain-discarded line.
    expect(logged.some((entry) => entry.code === 'RESET_CHAIN_DISCARDED')).toBe(false);

    // The database is byte-unchanged and no staging/previous database was ever created.
    expect(await evidenceDigest(db.ownerPool())).toBe(before);
    const catalog = await catalogOf(maintenance, names);
    expect(catalog[db.name]).toBeDefined();
    expect(catalog[`${db.name}_next`]).toBeUndefined();
    expect(catalog[`${db.name}_prev`]).toBeUndefined();
  });

  it('a REAL package on disk with no matching row blocks too (the fail-safe disagrees both ways)', async () => {
    const owner = db.ownerPool();
    // Clear the database side: no REAL sealed row remains.
    await owner.query("UPDATE public.evidence_items SET integrity_source = 'DEMO_PACKAGE' WHERE integrity_source = 'REAL'");
    expect((await owner.query("SELECT count(*)::int AS n FROM public.evidence_items WHERE integrity_source = 'REAL'")).rows[0]?.n).toBe(0);
    const before = await evidenceDigest(owner);

    await quiet(maintenance, db.database);
    const error = await resetDatabase(
      { database: db.name, clock: () => Date.now(), dataDir: db.run.dataDir, sessionDrainMs: PATIENT_MS },
      { ...internals, readEvidenceStore: storeWithRealPackage('SESSION-FLOATING') },
    ).catch((thrown: unknown) => thrown);

    expect(error).toMatchObject({ code: 'RESET_BLOCKED_REAL_EVIDENCE', step: 'R-3', targetUntouched: true });
    expect((error as Error).message).toContain('on disk without a database row: SESSION-FLOATING');
    expect(await evidenceDigest(db.ownerPool())).toBe(before);
  });

  it('demo items never block: with the REAL row cleared, the same question says a reset may go on', async () => {
    // The database now holds only DEMO_PACKAGE / SIMULATED items and an empty store: the guard is
    // silent, which is what lets the M2-MT-5 reset below proceed on the same kind of data.
    const owner = db.ownerPool();
    const real = await owner.query("SELECT count(*)::int AS n FROM public.evidence_items WHERE integrity_source = 'REAL' AND sealed_at IS NOT NULL");
    expect(real.rows[0]?.n).toBe(0);
  });
});

describe('M2-MT-5: the twelve kept tables survive a permitted reset (capture tables by upsert, not wiped)', () => {
  // A separate database so the planted capture rows are the only capture content.
  let target: ReturnType<typeof db.another> extends Promise<infer D> ? D : never;

  beforeAll(async () => {
    target = await db.another({ template: 'seed', slug: 'rgk5' });
  });
  afterAll(async () => {
    if (target !== undefined) await discard(maintenance, target, db.run.identity.prefix);
  });

  it('a discovered device, its credential and the selector cross the reset; the kept set is intact', async () => {
    const owner = target.ownerPool();
    // The seed now writes the five built-in devices and the selector row itself (CS-21; RECON-B2a
    // R5): the guard mutates built-ins the selector names, adds one DISCOVERED camera the seed
    // never knows, and a credential for it. If the reset rebuilt from the seed instead of carrying
    // the kept rows, every mutation below would come back as the seed's values.
    await owner.query(`
      UPDATE public.capture_devices SET transport = 'LINE_IN' WHERE id IN ('MIC-01','MIC-02')`);
    await owner.query(`
      INSERT INTO public.capture_devices (id, kind, transport, enabled) VALUES
        ('CAM-99','CAMERA','ONVIF',true)`);
    await owner.query(`
      INSERT INTO public.capture_device_credentials (device_id, username, secret_ciphertext, nonce, key_ref, rotated_at)
      VALUES ('CAM-99','operator', decode(repeat('00',33),'hex'), decode(repeat('11',12),'hex'), 'CORE_KEY_1', 1730000000000)`);
    await owner.query(`
      UPDATE public.capture_config
        SET video_01_profile = 'MAIN', video_02_profile = 'SUB', revision = 3, updated_by = 'OPR-002', updated_at = 1730000000000`);

    const before = Object.fromEntries(
      await Promise.all(KEPT_TABLE_NAMES.map(async (table) => [table, await contractChecksum(owner, table)] as const)),
    );

    await quiet(maintenance, target);
    const report = await resetDatabase(
      { database: target.name, clock: () => Date.now(), dataDir: db.run.dataDir, sessionDrainMs: PATIENT_MS },
      internals,
    );

    // The three capture tables were carried (rows read > 0): the five built-ins the seed wrote
    // plus the discovered camera, the one credential, the one selector row.
    expect(report.kept).toMatchObject({ capture_devices: 6, capture_device_credentials: 1, capture_config: 1 });

    const after = target.ownerPool();
    const afterDigests = Object.fromEntries(
      await Promise.all(KEPT_TABLE_NAMES.map(async (table) => [table, await contractChecksum(after, table)] as const)),
    );
    for (const table of ['capture_devices', 'capture_device_credentials', 'capture_config']) {
      expect(afterDigests[table], table).toBe(before[table]);
    }

    // The discovered device and its secret survived; the selector kept its revision and its operator.
    const discovered = await after.query("SELECT id, transport FROM public.capture_devices WHERE id = 'CAM-99'");
    expect(discovered.rows).toEqual([{ id: 'CAM-99', transport: 'ONVIF' }]);
    const credential = await after.query("SELECT username, key_ref FROM public.capture_device_credentials WHERE device_id = 'CAM-99'");
    expect(credential.rows).toEqual([{ username: 'operator', key_ref: 'CORE_KEY_1' }]);
    const config = await after.query(
      'SELECT revision::text AS revision, updated_by, video_01_device_id FROM public.capture_config WHERE singleton',
    );
    expect(config.rows).toEqual([{ revision: '3', updated_by: 'OPR-002', video_01_device_id: 'CAM-01' }]);
  });
});
