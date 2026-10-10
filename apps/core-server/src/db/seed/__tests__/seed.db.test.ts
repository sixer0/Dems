// The seeded database (plan row W20; database contract §9.4, §9.6 ST-1 to ST-4 and ST-6; spec
// AC-B-02, AC-B-17, AC-B-28, AC-B-65, SR-62, SR-63).
//
// The file's database is a clone of `tpl_seed`: the template the global setup built by running
// the seed (`template-hook.seed.ts`) at the fixed instant on a migrated clone, as `dems_owner`.
// Reads for assertions use the owner pool (TI-17); the boot checks run as the runtime role,
// exactly as the server will run them.
import {
  DEFAULT_SEED,
  DEMO_OPERATOR_PASSWORD,
  DEMO_PAIRING_CODE,
  DEVICE_CERT_FINGERPRINT,
  EVIDENCE_HISTORY,
  GENESIS_HASH,
  OPERATORS,
  OperatorRole,
  Permission,
  ROLE_PERMISSIONS,
  TODAY_HISTORY,
  auditBody,
  chainHash,
  createIdleState,
  verifyAuditChain,
} from '@dems/shared/sim';
import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { PASSWORD_HASH_PARAMETERS, hashPassword, needsRehash, verifyPassword } from '../../../modules/identity/password-hash';
import { auditRowFromRow, eventFromRow, fromRows, matrixFromRows, pickDurable, toRows, verifyStoredAuditRows } from '../../mapping';
import { operatorCredentials } from '../../schema';
import { BLOCKING_BOOT_CHECKS, checkStoredChain } from '../../schema/boot-checks';
import { SeedError, assertSeedTarget, prepareSeed, seedDatabase, writeSeed } from '../seed';
import { countAllTables, readRbacRows, readStoredRows } from '../../store';
import { SEED_TEMPLATE_NOW } from './template-hook.seed';
import {
  EXPECTED_SEED_COUNTS,
  FIXED_NOW,
  dumpDatabase,
  occurrences,
  standaloneOccurrences,
  tableChecksums,
} from '../../../../test/support/seed';

const db = useTestDatabase({ template: 'seed' });

const reference = createIdleState({ now: FIXED_NOW, seed: DEFAULT_SEED });

describe('ST-1: row counts after a first seed at the fixed instant (contract §9.4)', () => {
  it('the template was seeded at 2026-10-01 10:00 WIB', () => {
    expect(SEED_TEMPLATE_NOW).toBe(FIXED_NOW);
    expect(new Date(FIXED_NOW).toISOString()).toBe('2026-10-01T03:00:00.000Z');
  });

  it('all 43 tables hold what the seed of the landed contract states: 24 with rows, 19 empty', async () => {
    const counts = await countAllTables(drizzle(db.ownerPool()));
    console.log(`[w20] ST-1 row counts of ${db.name}:\n${Object.entries(counts).map(([table, rows]) => `  ${table.padEnd(24)} ${rows}`).join('\n')}`);
    expect(counts).toEqual(EXPECTED_SEED_COUNTS);
    expect(Object.keys(counts)).toHaveLength(43);
    expect(Object.values(counts).filter((rows) => rows > 0)).toHaveLength(24);
    expect(Object.values(counts).filter((rows) => rows === 0)).toHaveLength(19);
  });

  it('AC-B-02: 3 operators, 3 roles, 14 permissions, 22 grants, 1 Core device, 13 items with 52 tracks, 13 history entries', async () => {
    const counts = await countAllTables(drizzle(db.ownerPool()));
    // R3 (D44): the vocabulary counts are recomputed FROM SOURCE, never hardcoded: the shared
    // permission enum and the shared role table (rows 47/49 grew them 12->14 and 18->22).
    expect([counts['operators'], counts['roles']]).toEqual([3, 3]);
    expect(counts['permissions']).toBe(Object.values(Permission).length);
    expect(counts['role_permissions']).toBe(Object.values(ROLE_PERMISSIONS).reduce((sum, grants) => sum + grants.length, 0));
    expect([counts['core_device'], counts['evidence_items'], counts['evidence_tracks'], counts['session_history']]).toEqual([1, 13, 52, 13]);
  });

  it('the audit and event counts equal those of the shared createIdleState for the same now: 82 and 59, confirmed by running', async () => {
    const counts = await countAllTables(drizzle(db.ownerPool()));
    expect(counts['audit_log']).toBe(reference.audit.total);
    expect(counts['events']).toBe(reference.events.length);
    expect([reference.audit.total, reference.audit.rows.length, reference.audit.dropped, reference.events.length]).toEqual([82, 82, 0, 59]);
    expect(reference.meta.counters).toEqual({ event: 60, session: 24, caseNumber: 8, evidence: 14, item: 1 });
    expect(reference.evidence.reduce((sum, item) => sum + item.custody.length, 0)).toBe(28);
  });

  it('audit_chain_history is empty, and there is no session, no paired device, no pairing code, no biometric token', async () => {
    const pool = db.ownerPool();
    for (const table of ['audit_chain_history', 'auth_sessions', 'paired_devices', 'device_credentials', 'pairing_codes', 'biometric_tokens', 'active_session', 'alerts', 'health_snapshots']) {
      const { rows } = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM public.${table}`);
      expect(`${table} ${rows[0]?.n}`).toBe(`${table} 0`);
    }
  });

  it('M4-MT-15 (seed): the 5 built-ins are all FAKE and named so by the seed, 0 source rows, NULL flags on the v1 items', async () => {
    const pool = db.ownerPool();
    const devices = await pool.query('SELECT id, adapter_kind FROM capture_devices ORDER BY id');
    expect(devices.rows).toEqual([
      { id: 'CAM-01', adapter_kind: 'FAKE' },
      { id: 'CAM-02', adapter_kind: 'FAKE' },
      { id: 'MIC-01', adapter_kind: 'FAKE' },
      { id: 'MIC-02', adapter_kind: 'FAKE' },
      { id: 'POE-SWITCH', adapter_kind: 'FAKE' },
    ]);
    const facts = await pool.query(
      `SELECT (SELECT count(*)::int FROM session_capture_sources) AS sources,
              (SELECT count(*)::int FROM evidence_items) AS items,
              (SELECT count(*)::int FROM evidence_items WHERE development_sources IS NULL AND manifest_version = 1) AS v1_null,
              (SELECT count(*)::int FROM capture_devices WHERE onvif_uuid IS NOT NULL) AS endpoint_refs`,
    );
    expect(facts.rows).toEqual([{ sources: 0, items: 13, v1_null: 13, endpoint_refs: 0 }]);
  });

  it('the two mechanism rows and the seed bookkeeping are as the contract says', async () => {
    const pool = db.ownerPool();
    const meta = await pool.query('SELECT schema_version, contract_revision FROM schema_meta');
    expect(meta.rows).toEqual([{ schema_version: 6, contract_revision: 'dbc-7' }]);
    const state = await pool.query('SELECT seed, sim_schema_version, scenario, epoch, created_at, seeded_at, last_reset_at, last_sealed_session_id, last_sealed_acknowledged, updated_at FROM core_state');
    expect(state.rows).toEqual([
      {
        seed: String(DEFAULT_SEED),
        sim_schema_version: 2,
        scenario: 'idle',
        epoch: '0',
        created_at: String(FIXED_NOW),
        seeded_at: String(FIXED_NOW),
        last_reset_at: null,
        last_sealed_session_id: null,
        last_sealed_acknowledged: true,
        updated_at: String(FIXED_NOW),
      },
    ]);
    const registry = await pool.query('SELECT name, next_value FROM registry_counters ORDER BY name');
    expect(registry.rows).toEqual([
      { name: 'device', next_value: '1' },
      { name: 'pairingCode', next_value: '1' },
    ]);
    const engine = await pool.query('SELECT name, next_value FROM engine_counters ORDER BY name');
    expect(engine.rows).toEqual([
      { name: 'caseNumber', next_value: '8' },
      { name: 'event', next_value: '60' },
      { name: 'evidence', next_value: '14' },
      { name: 'item', next_value: '1' },
      { name: 'session', next_value: '24' },
    ]);
    const device = await pool.query('SELECT id, certificate_fingerprint, software_version FROM core_device');
    expect(device.rows).toEqual([{ id: 'DEMS-IR-01', certificate_fingerprint: DEVICE_CERT_FINGERPRINT, software_version: '2.4.1' }]);
    const exported = await pool.query('SELECT id, scope, evidence_id, operator_id, reason, destination FROM exports');
    expect(exported.rows).toEqual([
      {
        id: 'EXP-000031',
        scope: 'EVIDENCE',
        evidence_id: reference.evidence.find((item) => item.status === 'EXPORTED')?.id,
        operator_id: 'OPR-002',
        reason: 'Prosecutor request',
        destination: 'Case file transfer (simulated)',
      },
    ]);
  });
});

describe('ST-2: the stored audit chain verifies with the shared code', () => {
  it('every audit row read back hashes to its stored hash, and verifyAuditChain is ok over all 82 rows', async () => {
    const stored = await readStoredRows(drizzle(db.ownerPool()), { rings: 'all' });
    const rows = stored.auditLog.map(auditRowFromRow);
    expect(rows).toHaveLength(82);
    let previous = GENESIS_HASH;
    for (const row of rows) {
      expect(row.prevHash).toBe(previous);
      expect(chainHash(row.prevHash, auditBody(row))).toBe(row.hash);
      previous = row.hash;
    }
    const head = stored.auditChainHead[0];
    expect(head).toEqual({ singleton: true, seq: 82, hash: previous });
    expect(verifyAuditChain({ rows, head: head?.hash ?? '', total: 82, dropped: 0 })).toEqual({ ok: true, checked: 82, head: previous });
    // Nothing was hashed again by the seed: the stored head is the dataset's own head.
    expect(previous).toBe(reference.audit.head);
  });

  it('boot check B-8, as the runtime role, with the shared digest check passed in: ok over all rows', async () => {
    const report = await checkStoredChain(db.appPool(), { verifyDigests: verifyStoredAuditRows });
    expect(report).toEqual({ ok: true, rowsChecked: 82, firstSeq: 1, lastSeq: 82, linkBreaks: 0, digests: 'ok', lineage: 'none', problems: [] });
  });

  it('the digest check is not vacuous: a forged row is reported', async () => {
    const stored = await readStoredRows(drizzle(db.ownerPool()), { rings: 'all' });
    const forged = stored.auditLog.map((row) => (row.seq === 30 ? { ...row, actorId: 'OPR-003' } : row));
    expect(verifyStoredAuditRows(forged, { dropped: 0, head: reference.audit.head })).toEqual({ ok: false, code: 'HASH_MISMATCH', seq: 30, reason: 'HASH_MISMATCH at sequence 30' });
  });
});

describe('ST-3: what is stored equals what the shared builders made, member by member', () => {
  it('the 82 audit rows', async () => {
    const stored = await readStoredRows(drizzle(db.ownerPool()), { rings: 'all' });
    expect(stored.auditLog.map(auditRowFromRow)).toStrictEqual(reference.audit.rows);
  });

  it('the 59 events', async () => {
    const stored = await readStoredRows(drizzle(db.ownerPool()), { rings: 'all' });
    expect(stored.events.map(eventFromRow)).toStrictEqual(reference.events);
  });

  it('every durable slice: fromRows of the rows read from PostgreSQL equals the durable slices of createIdleState', async () => {
    const stored = await readStoredRows(drizzle(db.ownerPool()));
    expect(fromRows(stored)).toStrictEqual(pickDurable(reference));
  });

  it('the stored rows are the rows toRows gives, column by column (nothing depends on a column default)', async () => {
    const stored = await readStoredRows(drizzle(db.ownerPool()), { rings: 'all' });
    const expected = toRows(reference, { at: FIXED_NOW, seededAt: FIXED_NOW, lastResetAt: null });
    for (const table of Object.keys(stored) as (keyof typeof stored)[]) {
      expect(stored[table], table).toEqual(expected[table]);
    }
  });
});

describe('ST-4, AC-B-17: the seeded matrix equals the shared ROLE_PERMISSIONS', () => {
  it('3 roles and 14 permissions in declaration order, 22 grants (5, 12, 5), role by role equal', async () => {
    const stored = await readRbacRows(drizzle(db.ownerPool()));
    expect(stored.roles.map((role) => role.id)).toEqual(Object.values(OperatorRole));
    expect(stored.permissions.map((permission) => permission.id)).toEqual(Object.values(Permission));
    expect(stored.rolePermissions).toHaveLength(Object.values(ROLE_PERMISSIONS).reduce((sum, grants) => sum + grants.length, 0));
    for (const role of Object.values(OperatorRole)) {
      const granted = stored.rolePermissions.filter((grant) => grant.roleId === role).map((grant) => grant.permissionId);
      expect([...granted].sort(), role).toEqual([...ROLE_PERMISSIONS[role]].sort());
    }
    const matrix = matrixFromRows(stored);
    // R3: the per-role counts come from the shared role table itself (5 / 12 / 5 with the v2
    // grants of rows 47/49); the role-by-role equality below is the real check.
    expect(Object.fromEntries(Object.entries(matrix).map(([role, permissions]) => [role, permissions.length]))).toEqual(
      Object.fromEntries(Object.entries(ROLE_PERMISSIONS).map(([role, grants]) => [role, grants.length])),
    );
    // The runtime role reads the same matrix and cannot change it (the matrix is read-only, RB-9).
    const asRuntime = await readRbacRows(drizzle(db.appPool()));
    expect(matrixFromRows(asRuntime)).toEqual(matrix);
    await expect(db.appPool().query("INSERT INTO role_permissions (role_id, permission_id) VALUES ('TECHNICIAN', 'USER_ADMIN')")).rejects.toMatchObject({ code: '42501' });
  });
});

describe('the three operators and their stored credentials (SD-4, SR-63)', () => {
  it('the operators are the shared OPERATORS: enabled, never signed in, created at the seed instant', async () => {
    const { rows } = await db.ownerPool().query('SELECT id, username, rank, name, display_name, initials, role_id, enabled, last_sign_in_at, role_changed_at, created_at, updated_at FROM operators ORDER BY id');
    expect(rows).toEqual(
      OPERATORS.map((operator) => ({
        id: operator.id,
        username: operator.username,
        rank: operator.rank,
        name: operator.name,
        display_name: operator.displayName,
        initials: operator.initials,
        role_id: operator.role,
        enabled: true,
        last_sign_in_at: null,
        role_changed_at: null,
        created_at: String(FIXED_NOW),
        updated_at: String(FIXED_NOW),
      })),
    );
  });

  it('each has one Argon2id record at the current parameters, a 16-byte salt of its own and a 32-byte hash', async () => {
    const { rows } = await db.ownerPool().query<{
      operator_id: string;
      algorithm: string;
      memory_kib: number;
      passes: number;
      parallelism: number;
      salt_bytes: number;
      hash_bytes: number;
      hashed_at: string;
    }>(
      'SELECT operator_id, algorithm, memory_kib, passes, parallelism, octet_length(salt) AS salt_bytes, octet_length(hash) AS hash_bytes, hashed_at FROM operator_credentials ORDER BY operator_id',
    );
    expect(rows).toEqual(
      OPERATORS.map((operator) => ({
        operator_id: operator.id,
        algorithm: 'argon2id',
        memory_kib: PASSWORD_HASH_PARAMETERS.memoryKib,
        passes: PASSWORD_HASH_PARAMETERS.passes,
        parallelism: PASSWORD_HASH_PARAMETERS.parallelism,
        salt_bytes: 16,
        hash_bytes: 32,
        hashed_at: String(FIXED_NOW),
      })),
    );
    expect([PASSWORD_HASH_PARAMETERS.memoryKib, PASSWORD_HASH_PARAMETERS.passes, PASSWORD_HASH_PARAMETERS.parallelism]).toEqual([19_456, 2, 1]);
    const distinct = await db.ownerPool().query<{ salts: string; hashes: string }>('SELECT count(DISTINCT salt) AS salts, count(DISTINCT hash) AS hashes FROM operator_credentials');
    expect(distinct.rows).toEqual([{ salts: '3', hashes: '3' }]);
  });

  it('the stored record verifies the published demo password and nothing else, for each operator', async () => {
    const credentials = await drizzle(db.ownerPool()).select().from(operatorCredentials);
    expect(credentials).toHaveLength(3);
    for (const record of credentials) {
      // The constant is passed to the verifier and to nothing else; no value is printed.
      expect(await verifyPassword(DEMO_OPERATOR_PASSWORD, record)).toBe(true);
      expect(await verifyPassword(`${DEMO_OPERATOR_PASSWORD}x`, record)).toBe(false);
      expect(needsRehash(record)).toBe(false);
    }
  });
});

describe('ST-6, AC-B-28, AC-B-65: a dump of every table', () => {
  it('holds neither the demo password nor the pairing code constant; counts only are reported', async () => {
    const dump = await dumpDatabase(db.ownerPool());
    const password: string = DEMO_OPERATOR_PASSWORD;
    const code: string = DEMO_PAIRING_CODE;
    const found = {
      password: occurrences(dump, password),
      passwordLowerCase: occurrences(dump.toLowerCase(), password.toLowerCase()),
      passwordAsHex: occurrences(dump, Buffer.from(password, 'utf8').toString('hex')),
      passwordAsBase64: occurrences(dump, Buffer.from(password, 'utf8').toString('base64')),
      pairingCodeStandalone: standaloneOccurrences(dump, code),
    };
    console.log(
      `[w20] ST-6 dump of ${db.name}: ${dump.length} characters, ${dump.split('\n').length} lines; occurrences ${JSON.stringify(found)}; the pairing code as a substring of longer digit runs: ${occurrences(dump, code)}`,
    );
    expect(found).toEqual({ password: 0, passwordLowerCase: 0, passwordAsHex: 0, passwordAsBase64: 0, pairingCodeStandalone: 0 });
    // The search is not vacuous: the dump is the whole database, hash columns included.
    expect(dump.length).toBeGreaterThan(100_000);
    expect(occurrences(dump, '-- operator_credentials: 3 row(s)')).toBe(1);
    expect(occurrences(dump, '"algorithm": "argon2id"')).toBe(3);
    expect(occurrences(dump, '"salt": "\\\\x')).toBe(3);
    expect(occurrences(dump, 'OPR-001')).toBeGreaterThan(10);
    // And the helper finds a value that IS there.
    expect(occurrences(dump, OPERATORS[0]?.username ?? '')).toBeGreaterThan(0);
    expect(standaloneOccurrences('code 123456 here', '123456')).toBe(1);
    expect(standaloneOccurrences('hash ab123456cd', '123456')).toBe(0);
  });

  it('holds no person name beyond the operators and subjects of the shared dataset, and no e-mail address', async () => {
    const pool = db.ownerPool();
    const datasetOperators = new Set(OPERATORS.flatMap((operator) => [operator.name, operator.displayName]));
    const datasetSubjects = new Set([...EVIDENCE_HISTORY, ...TODAY_HISTORY].map((seed) => seed.subjectName));
    expect(datasetSubjects.size).toBe(13);

    const operators = await pool.query<{ name: string; display_name: string }>('SELECT name, display_name FROM operators');
    for (const row of operators.rows) {
      expect(datasetOperators).toContain(row.name);
      expect(datasetOperators).toContain(row.display_name);
    }
    const subjects = await pool.query<{ subject_name: string }>(
      'SELECT subject_name FROM session_history UNION SELECT subject_name FROM evidence_items UNION SELECT subject_name FROM active_session',
    );
    expect(subjects.rows).toHaveLength(13);
    for (const row of subjects.rows) expect(datasetSubjects).toContain(row.subject_name);

    // Free text: an audit message or an event message names a person only as a dataset operator.
    const messages = await pool.query<{ message: string }>('SELECT message FROM audit_log UNION ALL SELECT message FROM events');
    const named = messages.rows.flatMap((row) => [...row.message.matchAll(/signed in \(([^)]+)\)|^(.+) signed in$/g)].map((match) => match[1] ?? match[2] ?? ''));
    expect(named.length).toBeGreaterThan(20);
    for (const name of named) expect(datasetOperators).toContain(name);

    const dump = await dumpDatabase(pool);
    expect([...dump.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/g)]).toEqual([]);
    // SD-8: the database holds nothing but the shared dataset. ST-3 shows it slice by slice.
  });
});

describe('the seeded database passes the boot checks', () => {
  it.each(BLOCKING_BOOT_CHECKS.map((check) => [check.id, check.title, check] as const))('%s: %s', async (_id, _title, check) => {
    await expect(check.run(db.appPool())).resolves.toBeUndefined();
  });

  it('B-6 is what a database that was migrated and not seeded fails', async () => {
    const empty = await db.another({ template: 'schema', slug: 'w20_not_seeded' });
    const seeded = BLOCKING_BOOT_CHECKS.find((check) => check.id === 'B-6');
    await expect(seeded?.run(empty.appPool())).rejects.toMatchObject({ checkId: 'B-6' });
  });
});

describe('idempotence: a second seed is refused and writes nothing (SD-3)', () => {
  it('refuses a seeded database with ALREADY_SEEDED, and every table keeps its checksum', async () => {
    const pool = db.ownerPool();
    const before = await tableChecksums(pool);
    const credentialsBefore = await pool.query('SELECT operator_id, salt, hash FROM operator_credentials ORDER BY operator_id');
    let derivations = 0;
    const attempt = seedDatabase(pool, { now: FIXED_NOW + 1_000, target: 'test' }, {
      hashPassword: async () => {
        derivations += 1;
        throw new Error('the hasher must not be reached');
      },
    });
    await expect(attempt).rejects.toBeInstanceOf(SeedError);
    await expect(attempt).rejects.toMatchObject({ code: 'ALREADY_SEEDED' });
    await expect(attempt).rejects.toThrow(/already seeded \(seeded_at 2026-10-01T03:00:00\.000Z\)\. Nothing was written\. Seeding again is a reset\./);
    // Refused before any password derivation and before any statement that writes.
    expect(derivations).toBe(0);
    expect(await tableChecksums(pool)).toEqual(before);
    const credentialsAfter = await pool.query('SELECT operator_id, salt, hash FROM operator_credentials ORDER BY operator_id');
    expect(credentialsAfter.rows).toEqual(credentialsBefore.rows);
    expect(await countAllTables(drizzle(pool))).toEqual(EXPECTED_SEED_COUNTS);
  });

  it('refuses under the chain lock too: a seed that got past the first look still writes nothing', async () => {
    // The binding check is inside the transaction. It is exercised directly: writeSeed on a
    // seeded database, as a second seed that raced past the first look would run it.
    const prepared = await prepareSeed({ now: FIXED_NOW });
    const pool = db.ownerPool();
    const before = await tableChecksums(pool);
    await expect(drizzle(pool).transaction((transaction) => writeSeed(transaction, prepared))).rejects.toMatchObject({
      code: 'ALREADY_SEEDED',
      message: expect.stringContaining('the audit chain holds 82 row(s)'),
    });
    expect(await tableChecksums(pool)).toEqual(before);
  });

  it('the seed runs as the owner role only: the runtime role is refused before anything is read', async () => {
    await expect(seedDatabase(db.appPool(), { now: FIXED_NOW, target: 'test' })).rejects.toMatchObject({ code: 'OWNER_ROLE_REFUSED' });
  });

  it('TI-13: a seed called for a project database refuses a test database, and the other way round', async () => {
    await expect(seedDatabase(db.ownerPool(), { now: FIXED_NOW, target: 'project' })).rejects.toMatchObject({ code: 'TARGET_REFUSED' });
    expect(() => assertSeedTarget('dems_demo', 'test')).toThrow(/writes only a test database/);
    expect(() => assertSeedTarget('dems_lane_2', 'test')).toThrow(SeedError);
    expect(() => assertSeedTarget(db.name, 'test')).not.toThrow();
    for (const name of ['dems_demo', 'dems_lane_1', 'dems_lane_2', 'dems_lane_3', 'dems_demo_next', 'dems_lane_3_next']) {
      expect(() => assertSeedTarget(name, 'project')).not.toThrow();
    }
    for (const name of ['postgres', 'template1', 'dems_demo_prev', 'dems_demo2', 'dems_test_x', 'dems_lane_4']) {
      expect(() => assertSeedTarget(name, 'project'), name).toThrow(SeedError);
    }
  });
});

describe('two seeds of one database at the same time', () => {
  it('queue at the chain lock: exactly one writes, the other is refused with nothing written', async () => {
    const target = await db.another({ template: 'schema', slug: 'w20_two_seeds' });
    const pool = target.ownerPool();
    // Both get past the first look: each is held at its first password derivation until the
    // other has reached its own, so neither has opened its transaction when both go on.
    let waiting = 0;
    let release: () => void = () => undefined;
    const bothReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gated = async (password: string) => {
      const record = await hashPassword(password);
      waiting += 1;
      if (waiting >= 2) release();
      await bothReady;
      return record;
    };
    const outcomes = await Promise.allSettled([
      seedDatabase(pool, { now: FIXED_NOW, target: 'test' }, { hashPassword: gated }),
      seedDatabase(pool, { now: FIXED_NOW + 5_000, target: 'test' }, { hashPassword: gated }),
    ]);
    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.status === 'rejected' ? rejected[0].reason : null).toMatchObject({
      name: 'SeedError',
      code: 'ALREADY_SEEDED',
      message: expect.stringContaining('the audit chain holds 82 row(s)'),
    });
    // One whole dataset, not one and a part of another.
    expect(await countAllTables(drizzle(pool))).toEqual(EXPECTED_SEED_COUNTS);
    const winner = fulfilled[0]?.status === 'fulfilled' ? fulfilled[0].value : null;
    const seededAt = await pool.query<{ seeded_at: string }>('SELECT seeded_at FROM core_state');
    expect(Number(seededAt.rows[0]?.seeded_at)).toBe(winner?.now);
    const chain = await checkStoredChain(target.appPool(), { verifyDigests: verifyStoredAuditRows });
    expect(chain).toMatchObject({ ok: true, rowsChecked: 82, digests: 'ok' });
  });
});
