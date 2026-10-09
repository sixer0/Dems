// M2-STTCFG-DB, the seed and reset clauses (blueprint row 114 / R-8 of D20 confirmed as
// Q-STT-CFG (a) by D24; dbc-3 §B.13 + §E.1; specs R-8 AC-1; OD-19; SD-8).
//
// What is proven here:
//   1. the v2 seed writes the SINGLE `stt_config` row with the confirmed default of Q-STT-CFG
//      item 11, and no credential VALUE of any kind (the three credential columns stay null);
//   2. the kept set is twelve tables and `stt_config` crosses by mode `upsert`;
//   3. the seeded row is image-equal after a permitted `db:reset`;
//   4. an EDITED configuration is image-equal after a permitted `db:reset` too — the carried row
//      replaces the fresh seed row of key `true`, which is exactly what `upsert` means here.
//
// Every reset targets a database this test run created (TI-17), never `dems_demo` or a lane: the
// routine is reached through its function with the seam `testRunPrefix`, which no entry point
// sets. The live databases are not named here at all. No secret byte is ever selected or printed:
// the reads ask for `octet_length(...)` of the two envelope columns, never their values.
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { STT_CONFIG_SEED_DEFAULT } from '../../seed';
import { KEPT_TABLES, KEPT_TABLE_NAMES } from '../kept-tables';
import { resetDatabase, type ResetInternals } from '../routine';
import { PATIENT_MS, contractChecksum, dropOwn, dumpKept, dumpTable, maintenancePool, quiet } from '../../../../test/support/reset';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed', slug: 'stcfg' });

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

/** The stored row, with the envelope columns reduced to their byte LENGTHS: a value never leaves. */
interface SttRow {
  readonly singleton: boolean;
  readonly enabled: boolean;
  readonly backend: string;
  readonly endpoint: string | null;
  readonly model: string;
  readonly language: string;
  readonly diarization: boolean;
  readonly credential_kind: string | null;
  readonly credential_ref: string | null;
  readonly secret_bytes: number | null;
  readonly nonce_bytes: number | null;
  readonly revision: string;
  readonly updated_by: string | null;
  readonly updated_at: string;
}

async function sttRows(pool: Pool): Promise<SttRow[]> {
  const { rows } = await pool.query<SttRow>(
    'SELECT singleton, enabled, backend, endpoint, model, language, diarization, credential_kind, credential_ref, ' +
      'octet_length(secret_ciphertext) AS secret_bytes, octet_length(nonce) AS nonce_bytes, ' +
      'revision::text AS revision, updated_by, updated_at::text AS updated_at ' +
      'FROM public.stt_config ORDER BY singleton',
  );
  return rows;
}

/** The two independent images of one table: the JSON image the routine carries, and `t::text`. */
async function images(pool: Pool): Promise<{ checksum: string; dump: string[] }> {
  return { checksum: await contractChecksum(pool, 'stt_config'), dump: await dumpTable(pool, 'stt_config', '"singleton"') };
}

describe('M2-STTCFG-DB (seed clause): the seed writes the one confirmed row and never a secret', () => {
  it('exactly one row, the Q-STT-CFG item 11 defaults, every credential column null', async () => {
    const rows = await sttRows(db.ownerPool());
    expect(rows).toHaveLength(1);
    const row = rows[0] as SttRow;
    console.log(`[row114] seeded stt_config | ${JSON.stringify(row)}`);

    // The values are the ones of the constant the seed writes, so the test cannot drift from it.
    expect({
      singleton: row.singleton,
      enabled: row.enabled,
      backend: row.backend,
      endpoint: row.endpoint,
      model: row.model,
      language: row.language,
      diarization: row.diarization,
      credentialKind: row.credential_kind,
      credentialRef: row.credential_ref,
      secretCiphertext: row.secret_bytes,
      nonce: row.nonce_bytes,
      revision: Number(row.revision),
      updatedBy: row.updated_by,
    }).toEqual({
      ...STT_CONFIG_SEED_DEFAULT,
      revision: STT_CONFIG_SEED_DEFAULT.revision,
      secretCiphertext: null,
      nonce: null,
    });

    // Named once more, plainly: enabled, cpu-local (Q-D7 = a), Indonesian, labelling on, and no
    // credential of any kind — the SD-8 rule (a secret is never seeded).
    expect([row.enabled, row.backend, row.endpoint, row.model, row.language, row.diarization]).toEqual([
      true,
      'cpu-local',
      null,
      'ggml-large-v3-turbo',
      'id',
      true,
    ]);
    expect([row.credential_kind, row.credential_ref, row.secret_bytes, row.nonce_bytes]).toEqual([null, null, null, null]);
    expect(Number(row.updated_at)).toBeGreaterThan(0);
  });
});

describe('M2-STTCFG-DB (kept clause): the kept set is twelve with stt_config by upsert', () => {
  it('twelve names, stt_config among them, carried by upsert on its singleton key', () => {
    console.log(`[row114] kept set (${String(KEPT_TABLE_NAMES.length)}) | ${KEPT_TABLE_NAMES.join(', ')}`);
    expect(KEPT_TABLE_NAMES).toHaveLength(12);
    expect(KEPT_TABLE_NAMES).toContain('stt_config');
    const entry = KEPT_TABLES.find((table) => table.name === 'stt_config');
    expect(entry?.mode).toBe('upsert');
    expect(entry?.key).toBe('singleton');
  });
});

describe('M2-STTCFG-DB (reset clause): the row is image-equal after a permitted db:reset', () => {
  it('the seeded row crosses the reset unchanged, in both images', async () => {
    const before = await images(db.ownerPool());
    const rowBefore = (await sttRows(db.ownerPool()))[0] as SttRow;

    await quiet(maintenance, db.database);
    const report = await resetDatabase(
      { database: db.name, clock: () => Date.now(), dataDir: db.run.dataDir, sessionDrainMs: PATIENT_MS },
      internals,
    );
    console.log(`[row114] reset 1 | kept stt_config=${String(report.kept['stt_config'])} epoch ${String(report.previousEpoch)} -> ${report.epoch}`);

    // It was READ as one carried row, not rebuilt empty by the seed.
    expect(report.kept['stt_config']).toBe(1);

    const after = await images(db.ownerPool());
    console.log(`[row114] reset 1 image-equal | checksum ${before.checksum === after.checksum} dump ${JSON.stringify(before.dump) === JSON.stringify(after.dump)}`);
    expect(after.checksum).toBe(before.checksum);
    expect(after.dump).toEqual(before.dump);

    // Still the one row, still the confirmed default, still no credential.
    const rowAfter = (await sttRows(db.ownerPool()))[0] as SttRow;
    expect(rowAfter).toEqual(rowBefore);
    expect(Object.keys(await images(db.ownerPool())).length).toBe(2);
  });

  it('an edited configuration crosses too: the carried row replaces the fresh seed row', async () => {
    const owner = db.ownerPool();
    // An edit shaped exactly like operation 91 (row 113) writes it: the server backend with its
    // loopback endpoint, labelling off, and a credential held ONLY as a reference (SEC35-14). No
    // ciphertext and no nonce exist anywhere: the reference is a pointer, not a secret value.
    await owner.query(
      "UPDATE public.stt_config SET enabled = false, backend = 'omlx-server', endpoint = 'http://127.0.0.1:8000/v1', " +
        "model = 'whisper-large-v3-turbo', diarization = false, credential_kind = 'REFERENCE', " +
        "credential_ref = 'omlx-settings:auth.api_key', revision = 7, updated_by = 'OPR-002', updated_at = $1 WHERE singleton",
      ['1791086400000'],
    );

    const before = await images(owner);
    const rowBefore = (await sttRows(owner))[0] as SttRow;
    console.log(`[row114] edited row before the reset | ${JSON.stringify(rowBefore)}`);
    expect([rowBefore.enabled, rowBefore.backend, rowBefore.endpoint, rowBefore.diarization, rowBefore.credential_kind, rowBefore.revision]).toEqual([
      false,
      'omlx-server',
      'http://127.0.0.1:8000/v1',
      false,
      'REFERENCE',
      '7',
    ]);
    // The reference crossed the boundary as a pointer: the envelope columns are still absent.
    expect([rowBefore.secret_bytes, rowBefore.nonce_bytes]).toEqual([null, null]);

    await quiet(maintenance, db.database);
    const report = await resetDatabase(
      { database: db.name, clock: () => Date.now(), dataDir: db.run.dataDir, sessionDrainMs: PATIENT_MS },
      internals,
    );
    console.log(`[row114] reset 2 | kept stt_config=${String(report.kept['stt_config'])}`);
    expect(report.kept['stt_config']).toBe(1);

    const after = await images(db.ownerPool());
    console.log(`[row114] reset 2 image-equal | checksum ${before.checksum === after.checksum} dump ${JSON.stringify(before.dump) === JSON.stringify(after.dump)}`);
    expect(after.checksum).toBe(before.checksum);
    expect(after.dump).toEqual(before.dump);

    // The seed's default did NOT win: the edited values are what survived, one row only.
    const rows = await sttRows(db.ownerPool());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(rowBefore);

    // Independent of the routine's own comparison: the whole-kept-set dumps are equal as well.
    const keptDumps = await dumpKept(db.ownerPool());
    expect(keptDumps['stt_config']).toEqual(before.dump);
  });
});
