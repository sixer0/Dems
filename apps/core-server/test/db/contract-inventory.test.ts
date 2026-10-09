// Database-free checks of plan row W17 (project `unit`, so they run in every gate):
//
//   1. the checked-in inventory `contract-inventory.json` IS what the database contract says
//      today: sections 2.4 and 4 of the closed task-2 contract (30 tables, 302 columns, 98 named
//      CHECKs, 25 foreign keys) COMPOSED with the schema-v2 delta of dbc-3 (ruling D44 R1: the
//      closed document is never edited; `contract-v2-delta.ts` carries dbc-3 §A/§B/§C/§B.13).
//      Together: 40 tables, 419 columns, 166 named CHECKs, 39 foreign keys;
//   2. the typed schema declares the same tables, columns, types, nullability and defaults;
//   3. the hand-written migration files are the statements of contract §6.3 and §8.3;
//   4. CL-12: every closed value set of the contract equals the shared constant it cites, and
//      the key deny list equals the server constant;
//   5. the migration files hold nothing the migrator would mis-split.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AuthMethod, AuditCategory, AuditType, CaptureDeviceKind, EvidenceStatus, FaultKind, IntegritySource, OperatorRole, Permission, RecordingProfileId, ROLE_PERMISSIONS, RetentionPolicyId, ScenarioName, SessionOutcome, Severity, SimEventCategory, SimEventType, SubjectType, VerificationStatus } from '@dems/shared/sim';
import { EvidenceLifecycleStage, MicRole, SecurityState, SessionState, StorageState, TimeSource, TrackId } from '@dems/shared/domain';
import { getTableColumns, getTableName, is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { INITIAL_MIGRATION_TAGS, MIGRATIONS_FOLDER, readMigrationSet } from '../../src/db/commands/migrations';
import { SCHEMA_TABLE_NAMES } from '../../src/db/commands/status';
import * as schema from '../../src/db/schema';
import {
  authSessionPublicColumns,
  biometricTokenPublicColumns,
  operatorPublicColumns,
  pairedDevicePublicColumns,
  pairingCodePublicColumns,
} from '../../src/db/schema/public-columns';
import { CONTRACT_FILE, DBC3_FILE, parseContract, readInventory, serialise } from './contract-inventory';

const inventory = readInventory();
const contractText = readFileSync(CONTRACT_FILE, 'utf8');
const dbc3Text = readFileSync(DBC3_FILE, 'utf8');
const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable => is(value, PgTable));

describe('the inventory is the contract (sections 2.4 and 4)', () => {
  it('parsing the contract today gives exactly the checked-in inventory', () => {
    // A contract revision that changes a table must come with a regenerated inventory:
    //   node apps/core-server/test/db/contract-inventory.ts --write
    expect(serialise(parseContract(contractText))).toBe(serialise(inventory));
  });

  it("holds the composed counts: the closed §4 base plus the dbc-3 delta = 40 tables, 419 columns, 166 CHECKs, 39 foreign keys", () => {
    // The base is the CLOSED task-2 contract (§15.6 states its own totals — re-pinned in
    // contract-inventory.ts's composition header); the delta is dbc-3 §A/§B/§B.13/§C transcribed
    // in contract-v2-delta.ts. The per-kind totals below are the composition's measured output;
    // `catalog.db.test.ts` re-checks them against the LIVE catalog built by 0000..0007, so the
    // composition is verified by two separately authored transcriptions, as it was in v1.
    expect(inventory.counts).toEqual({
      tables: 40,
      columns: 419,
      primaryKeys: 40,
      foreignKeys: 39,
      uniques: 15,
      uniqueIndexes: 3,
      indexes: 23,
      checks: 166,
    });
    expect(inventory.tables.map((table) => table.id).sort()).toEqual(
      Array.from({ length: 40 }, (_, index) => `T-${String(index + 1).padStart(2, '0')}`),
    );
    // The counts the closed contract states in its own text (§15.6), and the ones dbc-3 claims:
    // 30 -> 39 tables (§0.1, the 9-new/5-changed reconciliation) plus the R-8 singleton T-40
    // (§B.13, confirmed by decision D24) = the 40 pinned above.
    expect(contractText).toContain('30 tables; boot checks B-1 to B-9; PostgreSQL behaviours PG-01 to PG-28; 98 named CHECKs; 25 foreign keys; 302 columns');
    expect(dbc3Text).toContain('| Table count | 30 -> 39 |');
    // The stable prefix only: the status wording after it is documentation (it moved from "proposed"
    // to "CONFIRMED - D24" with erratum PE-R8-02 and may move again). Controller ruling, row 113 fix round 1.
    expect(dbc3Text).toContain('### B.13 `stt_config` (T-40)');
  });

  it('every name is lower-case snake_case, at most 63 bytes, with the suffix of its kind (N-1 to N-4, CL-06)', () => {
    const suffix = { 'PRIMARY KEY': '_pkey', 'FOREIGN KEY': '_fkey', UNIQUE: '_key', 'UNIQUE INDEX': '_key', INDEX: '_idx', CHECK: '_check' } as const;
    for (const table of inventory.tables) {
      const names = [table.name, ...table.columns.map((column) => column.name), ...table.constraints.map((constraint) => constraint.name)];
      for (const name of names) {
        expect(name, name).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(Buffer.byteLength(name), name).toBeLessThanOrEqual(63);
      }
      for (const constraint of table.constraints) {
        expect(constraint.name.startsWith(`${table.name}_`), constraint.name).toBe(true);
        expect(constraint.name.endsWith(suffix[constraint.kind]), constraint.name).toBe(true);
      }
    }
    const all = inventory.tables.flatMap((table) => table.constraints.map((constraint) => constraint.name));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('the typed schema declares what the contract lists', () => {
  it('the 40 tables with the same names', () => {
    expect(tables).toHaveLength(inventory.counts.tables);
    expect([...SCHEMA_TABLE_NAMES]).toEqual(inventory.tables.map((table) => table.name).sort());
  });

  it('each table: the same columns in the same order, with type, nullability and default', () => {
    const sqlType: Record<string, string> = {
      PgText: 'text',
      PgBigInt53: 'bigint',
      PgBoolean: 'boolean',
      PgInteger: 'integer',
      PgSmallInt: 'smallint',
      PgUUID: 'uuid',
      PgJsonb: 'jsonb',
      PgDoublePrecision: 'double precision',
      PgCustomColumn: 'bytea',
    };
    const differences: string[] = [];
    for (const expected of inventory.tables) {
      const table = tables.find((candidate) => getTableName(candidate) === expected.name);
      if (table === undefined) {
        differences.push(`missing table ${expected.name}`);
        continue;
      }
      const columns = Object.values(getTableColumns(table));
      const declared = columns.map((column) => ({
        name: column.name,
        type: column.columnType === 'PgCustomColumn' ? column.getSQLType() : (sqlType[column.columnType] ?? column.columnType),
        notNull: column.notNull,
        hasDefault: column.hasDefault,
      }));
      const wanted = expected.columns.map((column) => ({
        name: column.name,
        type: column.type,
        notNull: column.notNull,
        hasDefault: column.default !== null,
      }));
      if (JSON.stringify(declared) !== JSON.stringify(wanted)) {
        differences.push(`${expected.name}: declared ${JSON.stringify(declared)} expected ${JSON.stringify(wanted)}`);
      }
    }
    expect(differences).toEqual([]);
  });

  it('each table: the same constraint and index names, by kind', () => {
    const differences: string[] = [];
    for (const expected of inventory.tables) {
      const table = tables.find((candidate) => getTableName(candidate) === expected.name);
      if (table === undefined) continue;
      const config = getTableConfig(table);
      const declared = [
        ...config.checks.map((check) => `CHECK ${check.name}`),
        ...config.foreignKeys.map((key) => `FOREIGN KEY ${key.getName()}`),
        ...config.uniqueConstraints.map((unique) => `UNIQUE ${unique.name ?? '?'}`),
        ...config.indexes.map((index) => `${index.config.unique ? 'UNIQUE INDEX' : 'INDEX'} ${index.config.name ?? '?'}`),
      ].sort();
      // A single-column primary key takes PostgreSQL's default name, which is the contract's.
      const wanted = expected.constraints
        .filter((constraint) => constraint.kind !== 'PRIMARY KEY')
        .map((constraint) => `${constraint.kind} ${constraint.name}`)
        .sort();
      if (JSON.stringify(declared) !== JSON.stringify(wanted)) {
        differences.push(`${expected.name}: declared ${declared.join(', ')} | expected ${wanted.join(', ')}`);
      }
      for (const key of config.foreignKeys) {
        if (key.onDelete !== 'restrict' || key.onUpdate !== 'no action') differences.push(`${key.getName()}: not RESTRICT / NO ACTION (K-2)`);
      }
      for (const primary of config.primaryKeys) {
        const wantedKey = expected.constraints.find((constraint) => constraint.kind === 'PRIMARY KEY');
        if (primary.getName() !== wantedKey?.name) differences.push(`${expected.name}: primary key named ${primary.getName()}`);
      }
    }
    expect(differences).toEqual([]);
  });

  it('time and byte counts are bigint read as a JavaScript number; no timestamp, no serial, no enum (TY-1, TY-3, CL-07)', () => {
    const allowed = new Set(['PgText', 'PgBigInt53', 'PgBoolean', 'PgInteger', 'PgSmallInt', 'PgUUID', 'PgJsonb', 'PgDoublePrecision', 'PgCustomColumn']);
    for (const table of tables) {
      for (const column of Object.values(getTableColumns(table))) {
        expect(allowed.has(column.columnType), `${getTableName(table)}.${column.name}: ${column.columnType}`).toBe(true);
        if (column.name.endsWith('_at')) expect(column.columnType, `${getTableName(table)}.${column.name}`).toBe('PgBigInt53');
        // MR-8: no automatic update hook anywhere.
        expect(column.onUpdateFn, `${getTableName(table)}.${column.name}`).toBeUndefined();
      }
    }
  });

  it('one bytea type, used by exactly the hash, salt and write-only secret columns the contract declares (TY-5, D38; dbc-3 §B.3, §B.13)', () => {
    const custom = tables.flatMap((table) =>
      Object.values(getTableColumns(table))
        .filter((column) => column.columnType === 'PgCustomColumn')
        .map((column) => `${getTableName(table)}.${column.name}:${column.getSQLType()}`),
    );
    // Derived from the contract first, then pinned: the seven v1 hash/salt columns plus the two
    // write-only secret pairs of `capture_device_credentials` (T-33) and `stt_config` (T-40).
    const declaredByContract = inventory.tables
      .flatMap((table) => table.columns.filter((column) => column.type === 'bytea').map((column) => `${table.name}.${column.name}:bytea`))
      .sort();
    expect(custom.sort()).toEqual(declaredByContract);
    expect(declaredByContract).toEqual([
      'auth_sessions.token_hash:bytea',
      'biometric_tokens.token_hash:bytea',
      'capture_device_credentials.nonce:bytea',
      'capture_device_credentials.secret_ciphertext:bytea',
      'device_credentials.current_hash:bytea',
      'device_credentials.next_hash:bytea',
      'operator_credentials.hash:bytea',
      'operator_credentials.salt:bytea',
      'pairing_codes.code_hash:bytea',
      'stt_config.nonce:bytea',
      'stt_config.secret_ciphertext:bytea',
    ]);
  });

  it('NL-6: the public column sets leave the hash columns out and nothing else', () => {
    const names = (columns: Record<string, { name: string }>): string[] => Object.values(columns).map((column) => column.name);
    const all = (table: PgTable): string[] => Object.values(getTableColumns(table)).map((column) => column.name);
    expect(names(operatorPublicColumns)).toEqual(all(schema.operators));
    expect(names(pairedDevicePublicColumns)).toEqual(all(schema.pairedDevices));
    expect(names(authSessionPublicColumns)).toEqual(all(schema.authSessions).filter((name) => name !== 'token_hash'));
    expect(names(pairingCodePublicColumns)).toEqual(all(schema.pairingCodes).filter((name) => name !== 'code_hash'));
    expect(names(biometricTokenPublicColumns)).toEqual(all(schema.biometricTokens).filter((name) => name !== 'token_hash'));
  });
});

describe('the hand-written migration files are the statements of the contract', () => {
  /** Statements only: comment lines (the breakpoint marker is one) and white space are dropped. */
  const statements = (sql: string): string =>
    sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  const sqlBlocks = [...contractText.matchAll(/```sql\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
  const block = (firstLine: string): string => {
    const found = sqlBlocks.filter((candidate) => candidate.startsWith(firstLine));
    expect(found, firstLine).toHaveLength(1);
    return found[0] ?? '';
  };
  const file = (tag: string): string => readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8');

  it('0000_prelude is the function of §8.3', () => {
    expect(statements(file('0000_prelude'))).toBe(statements(block('-- 0000_prelude')));
  });

  it('0002_audit_guards is the six statement groups of §6.3', () => {
    expect(statements(file('0002_audit_guards'))).toBe(statements(block('-- 1. The chain head')));
  });

  it('0003_privileges is the statements of §8.3: INSERT on 16 tables, audit_chain_history not among them', () => {
    const text = statements(file('0003_privileges'));
    expect(text).toBe(statements(block('-- 0003_privileges')));
    const insert = /GRANT INSERT ON ([a-z_, ]+) TO dems_app;/.exec(text)?.[1]?.split(',').map((name) => name.trim()) ?? [];
    expect(insert).toHaveLength(16);
    expect(insert).not.toContain('audit_chain_history');
    expect(text).toContain("VALUES (true, 1, 'dbc-2')");
  });

  it('the set is eight files; the five hand-written ones never hold the marker inside a comment or a string (D38; dbc-3 §A.1)', () => {
    expect(readMigrationSet().map((entry) => entry.tag)).toEqual([...INITIAL_MIGRATION_TAGS]);
    const marker = ['-->', 'statement-breakpoint'].join(' ');
    // Hand-written: the v1 trio plus the two privilege migrations row 46/row 112 wrote by hand
    // (0004 and 0006 are drizzle-generated and legitimately carry the marker as lines).
    for (const tag of ['0000_prelude', '0002_audit_guards', '0003_privileges', '0005_capture_privileges', '0007_stt_config_privileges']) {
      for (const line of file(tag).split('\n')) {
        if (line.includes(marker)) expect(line, `${tag}: the marker must be a line of its own`).toBe(marker);
      }
      // Plain ASCII: the migrator hashes the decoded text, so the file must not depend on an encoding.
      // eslint-disable-next-line no-control-regex
      expect(/^[\x09\x0a\x20-\x7e]*$/.test(file(tag)), tag).toBe(true);
    }
  });
});

describe('CL-12: the closed value sets equal the shared vocabulary', () => {
  const shared: Record<string, readonly string[]> = {
    ROLE: Object.values(OperatorRole),
    SEVERITY: Object.values(Severity),
    AUDIT_CATEGORY: Object.values(AuditCategory),
    EVENT_CATEGORY: Object.values(SimEventCategory),
    SESSION_STATE: Object.values(SessionState),
    SESSION_OUTCOME: Object.values(SessionOutcome),
    SUBJECT_TYPE: Object.values(SubjectType),
    PROFILE: Object.values(RecordingProfileId),
    TIME_SOURCE: Object.values(TimeSource),
    TRACK_ID: Object.values(TrackId),
    VIDEO_TRACK_ID: [TrackId.VIDEO_01, TrackId.VIDEO_02],
    FAULT_KIND: Object.values(FaultKind),
    EVIDENCE_STATUS: Object.values(EvidenceStatus),
    LIFECYCLE_STAGE: Object.values(EvidenceLifecycleStage),
    VERIFICATION: Object.values(VerificationStatus),
    INTEGRITY_SOURCE: Object.values(IntegritySource),
    RETENTION: Object.values(RetentionPolicyId),
    SCENARIO: Object.values(ScenarioName),
    STORAGE_STATE: Object.values(StorageState),
    SECURITY_STATE: Object.values(SecurityState),
    // The shared set also has SECURITY_KEY; no Live session can have it (spec §7.17 X-1).
    AUTH_METHOD: Object.values(AuthMethod).filter((method) => method !== 'SECURITY_KEY'),
    // dbc-3 §B.2 sets that joined the shared vocabulary with rows 45/47 (CL-12 stays equality in
    // both directions: the contract's lists and the shared constants must agree, element-wise).
    CAPTURE_DEVICE_KIND: Object.values(CaptureDeviceKind),
    MIC_ROLE: Object.values(MicRole),
  };

  it.each(Object.keys(shared))('%s: contract list = shared constant', (name) => {
    expect(inventory.valueSets[name], name).toEqual(shared[name]);
  });

  it('every value set of the contract is a constant of the typed schema, with the same values in the same order', () => {
    const declared = schema as unknown as Record<string, unknown>;
    // 28 sets in §2.4 of the closed contract + 14 added or swapped by dbc-3 §C.6/§E.3/§B (R1).
    expect(Object.keys(inventory.valueSets)).toHaveLength(42);
    for (const [name, values] of Object.entries(inventory.valueSets)) {
      expect(declared[name], name).toEqual(values);
    }
  });

  it('the nineteen server-native sets have no shared constant yet; they are the lists of the contract', () => {
    const serverNative = [
      'SESSION_END_REASON', 'DEVICE_STATE', 'CODE_STATE', 'BIO_REVOKE_REASON', 'EXPORT_SCOPE',
      'SNAPSHOT_CAUSE', 'CHAIN_DISCARD_REASON',
      // Added with schema v2 (dbc-3 §B/§C.6/§E.3 and §B.13); CAPTURE_DEVICE_KIND and MIC_ROLE are
      // NOT here: they joined the shared vocabulary with rows 45/47 and sit in `shared` above.
      'TRACK_KIND', 'LABELS_STATUS', 'SEALING_JOB_STATUS', 'TRANSCRIPT_CHUNK_STATUS',
      'SIGNATURE_ALGORITHM', 'TRANSCRIPT_SIGNATURE_ALGORITHM', 'STT_BACKEND', 'STT_CREDENTIAL_KIND',
      'AUDIO_INTERVAL_REASON', 'TIME_FORMAT', 'ENGINE_COUNTER', 'REGISTRY_COUNTER',
    ];
    expect(Object.keys(inventory.valueSets).filter((name) => !(name in shared)).sort()).toEqual([...serverNative].sort());
    expect(inventory.valueSets['SESSION_END_REASON']).toHaveLength(8);
    expect(inventory.valueSets['SESSION_END_REASON']).toContain('TOKEN_REUSE');
  });

  it('the 28 denied key names: the CHECK text of the contract = the server constant', () => {
    const denied = [...(inventory.formats['NO_SECRET_KEYS'] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]);
    // 17 in the closed contract; dbc-3 §C.6 grew it and row 112 added credentialRef,
    // credentialValue and apiKey for stt_config (AUDIT_DETAIL_FORBIDDEN_KEYS = 28).
    expect(denied).toHaveLength(28);
    expect(denied).toEqual([...schema.AUDIT_DETAIL_FORBIDDEN_KEYS]);
  });

  it('open sets pass the format check, so additive vocabulary needs no migration (MG-11)', () => {
    const code = new RegExp(/'([^']+)'/.exec(inventory.formats['CODE'] ?? '')?.[1] ?? 'x^');
    for (const value of [...Object.values(AuditType), ...Object.values(SimEventType), ...Object.values(Permission)]) {
      expect(code.test(value), value).toBe(true);
    }
    // R3 (D44): the permission count is recomputed from the landed role table, never hardcoded —
    // every declared permission must be granted to at least one role, and none may be missing.
    expect(new Set(Object.values(ROLE_PERMISSIONS).flat()).size).toBe(Object.values(Permission).length);
  });
});
