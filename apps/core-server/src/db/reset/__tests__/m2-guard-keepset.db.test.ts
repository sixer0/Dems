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
    // The seed now writes the NINE built-in devices and the selector row itself (CS-21; RECON-B2a
    // R5; D60/D61, 2026-11-04: four cameras, four numbered mic channels, the switch): the guard
    // mutates built-ins the selector names, adds one DISCOVERED camera the seed
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

    // The three capture tables were carried (rows read > 0): the NINE built-ins the seed wrote
    // (D60/D61, 2026-11-04: CAM-01..04, MIC-01..04, the switch) plus the discovered camera, the
    // one credential, the one selector row.
    expect(report.kept).toMatchObject({ capture_devices: 10, capture_device_credentials: 1, capture_config: 1 }); // D60/D61 (2026-11-04): 5 built-ins + 1 discovered -> 9 built-ins + 1 discovered

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

describe('I-9c (review 120 F-6): the five tables of task 4 cross a permitted reset with the device they describe', () => {
  // Their own database: the planted rows are the only content of the five tables.
  let target: ReturnType<typeof db.another> extends Promise<infer D> ? D : never;
  const FIVE = ['capture_device_streams', 'capture_audio_inputs', 'capture_network_config', 'host_network_aliases', 'installation_acceptances'] as const;

  beforeAll(async () => {
    target = await db.another({ template: 'seed', slug: 'rgk9c' });
  });
  afterAll(async () => {
    if (target !== undefined) await discard(maintenance, target, db.run.identity.prefix);
  });

  it('an adopted camera keeps BOTH of its stream rows (two-column key), a registered input, the network settings, an open and a closed alias and an acceptance; each table byte-equal', async () => {
    const owner = target.ownerPool();
    const t = 1_760_000_000_000;
    // An adopted camera with TWO stored profiles (one row per (device, profile)) and a registered USB input.
    await owner.query(
      "INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind, address) VALUES ('CAM-21', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP', '192.168.50.21'), ('MIC-21', 'MIC', 'USB', true, 'USB_AUDIO', NULL)",
    );
    await owner.query(
      'INSERT INTO public.capture_device_streams (device_id, profile, onvif_profile_token, video_source_token, lens, stream_role, codec, width, height, read_at) VALUES ' +
        "('CAM-21', 'H264_FHD', 'profile_1', 'vs_1', 1, 'MAIN', 'H264', 1920, 1080, $1), ('CAM-21', 'HEVC_UHD', 'profile_2', 'vs_1', 1, 'SUB', 'HEVC', 3840, 2160, $1)",
      [t],
    );
    await owner.query(
      "INSERT INTO public.capture_audio_inputs (device_id, usb_id, card_id, card_device, input_number, native_channels, updated_by, updated_at, usb_serial, usb_port) VALUES ('MIC-21', '1235:8215', 'USB', 0, 3, 18, 'OPR-003', $1, 'Y8ABC123', '0000:00:14.0-2.3')",
      [t],
    );
    await owner.query(
      "INSERT INTO public.capture_network_config (interface_name, camera_subnet, factory_addresses, alias_host, alias_minutes, camera_ip_start, revision, updated_by, updated_at, onvif_ports) VALUES ('eth1', '192.168.50.0/24', '[\"192.168.1.64\"]', 250, 45, 120, 4, 'OPR-003', $1, '[80, 8000]')",
      [t],
    );
    // One alias still in place (its address is up on the host) and one closed: the reset must not forget the open one.
    await owner.query(
      'INSERT INTO public.host_network_aliases (interface_name, address, reason, added_at, added_by, expires_at, removed_at, remove_reason, removed_by, remove_error) VALUES ' +
        "('eth1', '192.168.1.253/24', 'FACTORY_SCAN', $1, 'OPR-003', $2, $3, 'JOB_DONE', 'OPR-003', NULL), ('eth1', '192.168.1.252/24', 'SET_CAMERA_ADDRESS', $4, 'OPR-003', $5, NULL, NULL, NULL, NULL)",
      [t, t + 1_800_000, t + 600_000, t + 900_000, t + 2_700_000],
    );
    await owner.query(
      'INSERT INTO public.installation_acceptances (accepted_at, accepted_by, software_version, core_device_id, site_name, room, site_address, steps, diagnostics) VALUES ' +
        "($1, 'OPR-003', '0.6.0', 'DEMS-RST-09', 'Ruang Uji', 'R-9', NULL, $2::jsonb, $3::jsonb)",
      [t, JSON.stringify([{ id: '9A/H-01', passed: true, detail: null }]), JSON.stringify({ id: 'DIAG-000009', startedAt: t - 60_000, completedAt: t - 30_000, checks: [] })],
    );

    const before = Object.fromEntries(await Promise.all(KEPT_TABLE_NAMES.map(async (table) => [table, await contractChecksum(owner, table)] as const)));

    await quiet(maintenance, target);
    const report = await resetDatabase({ database: target.name, clock: () => t + 3_600_000, dataDir: db.run.dataDir, sessionDrainMs: PATIENT_MS }, internals);

    // Read from the old database: two stream rows, one input, one settings row, two aliases, one acceptance.
    expect(report.kept).toMatchObject({ capture_device_streams: 2, capture_audio_inputs: 1, capture_network_config: 1, host_network_aliases: 2, installation_acceptances: 1 });
    console.log(`[i9c] kept rows of the five tables: ${FIVE.map((table) => `${table} ${String(report.kept[table])}`).join(', ')}`);

    const after = target.ownerPool();
    for (const table of FIVE) expect(await contractChecksum(after, table), table).toBe(before[table]);
    // And the device rows they describe crossed too (they always did): the stream rows still name a kept camera.
    expect(await contractChecksum(after, 'capture_devices')).toBe(before['capture_devices']);
    const streams = await after.query("SELECT profile, codec FROM public.capture_device_streams WHERE device_id = 'CAM-21' ORDER BY profile");
    expect(streams.rows).toEqual([
      { profile: 'H264_FHD', codec: 'H264' },
      { profile: 'HEVC_UHD', codec: 'HEVC' },
    ]);
    const open = await after.query('SELECT address FROM public.host_network_aliases WHERE removed_at IS NULL');
    expect(open.rows).toEqual([{ address: '192.168.1.252/24' }]);
  });
});
