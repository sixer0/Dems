// The eight kept tables: the list, the statements and the comparison of row images (plan row
// W29; database contract §8.5 "Kept tables", R-5c, R-6). Database-free.
import { getTableColumns, getTableName } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from '../../schema';
import {
  CANCEL_ACTIVE_CODES_STATEMENT,
  CARRY_CHUNK_ROWS,
  KEPT_TABLES,
  KEPT_TABLE_NAMES,
  LAST_SIGN_IN_STATEMENT,
  LINEAGE_INSERT_STATEMENT,
  NEWEST_LINEAGE_STATEMENT,
  READ_PAIRING_CODES_STATEMENT,
  carryStatement,
  chunked,
  compareCarried,
  imagesAsJsonArray,
  insertCarriedStatement,
  keptCounts,
  readImagesStatement,
  updateCarriedStatement,
  type KeptImages,
  type PairingCodeImage,
} from '../kept-tables';

const table = (name: string) => {
  const found = KEPT_TABLES.find((entry) => entry.name === name);
  if (found === undefined) throw new Error(`not a kept table: ${name}`);
  return found;
};

describe('the kept list', () => {
  it('is the eight tables of the contract, in the carry-over order of R-5c', () => {
    expect(KEPT_TABLE_NAMES).toEqual([
      'registry_counters',
      'console_settings',
      'pairing_codes',
      'paired_devices',
      'device_credentials',
      'auth_sessions',
      'biometric_tokens',
      'audit_chain_history',
    ]);
    // The two tables the seed writes are updated; the six it leaves empty are inserted into.
    expect(KEPT_TABLES.map((entry) => entry.mode)).toEqual(['update', 'update', 'insert', 'insert', 'insert', 'insert', 'insert', 'insert']);
  });

  it('each key is the primary key of the typed schema, and each column list is the table\'s own', () => {
    const tables: Record<string, PgTable> = {
      registry_counters: schema.registryCounters,
      console_settings: schema.consoleSettings,
      pairing_codes: schema.pairingCodes,
      paired_devices: schema.pairedDevices,
      device_credentials: schema.deviceCredentials,
      auth_sessions: schema.authSessions,
      biometric_tokens: schema.biometricTokens,
      audit_chain_history: schema.auditChainHistory,
    };
    for (const entry of KEPT_TABLES) {
      const typed = tables[entry.name];
      if (typed === undefined) throw new Error(entry.name);
      expect(getTableName(typed)).toBe(entry.name);
      const columns = Object.values(getTableColumns(typed));
      expect(columns.filter((column) => column.primary).map((column) => column.name), entry.name).toEqual([entry.key]);
      expect(entry.columns, entry.name).toEqual(columns.map((column) => column.name));
    }
    expect(table('auth_sessions').columns).toEqual([
      'id', 'token_hash', 'operator_id', 'device_id', 'method', 'issued_at', 'last_seen_at', 'absolute_expires_at', 'ended_at', 'end_reason',
    ]);
    expect(table('audit_chain_history').columns).toEqual([
      'reset_no', 'epoch', 'head_hash', 'row_count', 'first_seq', 'last_seq', 'reset_at', 'actor_id', 'reason', 'scenario',
    ]);
  });

  it('a parent is carried before the rows that name it', () => {
    const position = (name: string): number => KEPT_TABLE_NAMES.indexOf(name);
    expect(position('pairing_codes')).toBeLessThan(position('paired_devices'));
    expect(position('paired_devices')).toBeLessThan(position('device_credentials'));
    expect(position('paired_devices')).toBeLessThan(position('auth_sessions'));
    expect(position('paired_devices')).toBeLessThan(position('biometric_tokens'));
  });
});

describe('the statements', () => {
  it('a row is read as one image, in primary-key order', () => {
    expect(readImagesStatement(table('auth_sessions'))).toBe('SELECT to_jsonb(k)::text AS image FROM public.auth_sessions AS k ORDER BY k."id"');
    expect(readImagesStatement(table('audit_chain_history'))).toBe('SELECT to_jsonb(k)::text AS image FROM public.audit_chain_history AS k ORDER BY k."reset_no"');
  });

  it('a pairing code is read with its image and with the image without the three columns the reset may rewrite', () => {
    expect(READ_PAIRING_CODES_STATEMENT).toBe(
      "SELECT k.id::text AS id, k.state::text AS state, to_jsonb(k)::text AS image, (to_jsonb(k) - 'state' - 'closed_at' - 'closed_by_operator_id')::text AS rest, " +
        'k.closed_at::text AS closed_at, k.closed_by_operator_id::text AS closed_by FROM public.pairing_codes AS k ORDER BY k."id"',
    );
  });

  it('an insert names every column and takes the rows as one JSON parameter', () => {
    expect(insertCarriedStatement(table('device_credentials'))).toBe(
      'INSERT INTO public.device_credentials ("device_id", "current_hash", "next_hash", "rotated_at") ' +
        'SELECT c."device_id", c."current_hash", c."next_hash", c."rotated_at" ' +
        'FROM jsonb_populate_recordset(NULL::public.device_credentials, $1::jsonb) AS c ORDER BY c."device_id"',
    );
    // The lineage is inserted in reset_no order (LN-1).
    expect(insertCarriedStatement(table('audit_chain_history'))).toMatch(/ORDER BY c\."reset_no"$/);
  });

  it('an update sets every column but the key from the carried row', () => {
    expect(updateCarriedStatement(table('registry_counters'))).toBe(
      'UPDATE public.registry_counters AS n SET "next_value" = c."next_value" ' +
        'FROM jsonb_populate_recordset(NULL::public.registry_counters, $1::jsonb) AS c WHERE n."name" = c."name"',
    );
    expect(updateCarriedStatement(table('console_settings'))).toBe(
      'UPDATE public.console_settings AS n SET "presentation_mode" = c."presentation_mode", "time_format" = c."time_format", ' +
        '"notify_warnings" = c."notify_warnings", "notify_sound" = c."notify_sound", "updated_at" = c."updated_at" ' +
        'FROM jsonb_populate_recordset(NULL::public.console_settings, $1::jsonb) AS c WHERE n."singleton" = c."singleton"',
    );
    expect(carryStatement(table('registry_counters'))).toBe(updateCarriedStatement(table('registry_counters')));
    expect(carryStatement(table('auth_sessions'))).toBe(insertCarriedStatement(table('auth_sessions')));
  });

  it('no statement holds a value: every one has exactly one parameter, the JSON array', () => {
    for (const entry of KEPT_TABLES) {
      const statement = carryStatement(entry);
      expect(statement.match(/\$\d+/g), entry.name).toEqual(['$1']);
      expect(statement).toContain('$1::jsonb');
      expect(statement).not.toMatch(/'[^']*'/);
    }
  });

  it('the two statements of R-5d and the lineage insert of R-5e', () => {
    expect(CANCEL_ACTIVE_CODES_STATEMENT).toBe(
      "UPDATE public.pairing_codes SET state = 'CANCELLED', closed_at = $1::bigint, closed_by_operator_id = $2::text WHERE state = 'ACTIVE'",
    );
    expect(LAST_SIGN_IN_STATEMENT).toBe(
      'UPDATE public.operators AS o SET last_sign_in_at = s.newest FROM (SELECT operator_id, max(issued_at) AS newest FROM public.auth_sessions GROUP BY operator_id) AS s WHERE o.id = s.operator_id',
    );
    expect(LINEAGE_INSERT_STATEMENT).toBe(
      'INSERT INTO public.audit_chain_history (reset_no, epoch, head_hash, row_count, first_seq, last_seq, reset_at, actor_id, reason, scenario) ' +
        'VALUES ($1::bigint, $2::bigint, $3::text, $4::bigint, $5::bigint, $6::bigint, $7::bigint, $8::text, $9::text, $10::text)',
    );
  });

  it('the newest lineage row is found by the number, not by its text', () => {
    // `ORDER BY reset_no` would sort the text of the select list: '9' after '10'.
    expect(NEWEST_LINEAGE_STATEMENT).toMatch(/FROM public\.audit_chain_history AS h ORDER BY h\.reset_no DESC LIMIT 1$/);
    expect(NEWEST_LINEAGE_STATEMENT).not.toMatch(/ORDER BY reset_no/);
  });
});

describe('images', () => {
  it('are joined into one JSON array without being parsed', () => {
    expect(imagesAsJsonArray([])).toBe('[]');
    // A number beyond 2^53 and a byte string stay exactly as PostgreSQL wrote them.
    const images = ['{"id": 9007199254740993, "h": "\\\\x00ff"}', '{"id": 2, "h": null}'];
    expect(imagesAsJsonArray(images)).toBe(`[${images[0]},${images[1]}]`);
    expect(imagesAsJsonArray(images)).toContain('9007199254740993');
  });

  it('are sent in chunks of 500 rows', () => {
    expect(CARRY_CHUNK_ROWS).toBe(500);
    const rows = Array.from({ length: 1201 }, (_, index) => String(index));
    expect(chunked(rows).map((chunk) => chunk.length)).toEqual([500, 500, 201]);
    expect(chunked(rows).flat()).toEqual(rows);
    expect(chunked([])).toEqual([]);
  });
});

describe('R-6: carried over unchanged', () => {
  const code = (id: string, state: string, more: Partial<PairingCodeImage> = {}): PairingCodeImage => ({
    id,
    state,
    image: `{"id": "${id}", "state": "${state}"}`,
    rest: `{"id": "${id}"}`,
    closedAt: state === 'ACTIVE' ? null : '100',
    closedBy: null,
    ...more,
  });
  const read = (images: Record<string, string[]>, pairingCodes: PairingCodeImage[] = []): KeptImages => ({
    images: { ...Object.fromEntries(KEPT_TABLE_NAMES.map((name) => [name, []])), ...images, pairing_codes: pairingCodes.map((entry) => entry.image) },
    pairingCodes,
  });
  const expectation = { now: '5000', actorId: 'OPR-002', lineageAppended: true };

  const carried = read(
    {
      registry_counters: ['{"name": "device"}', '{"name": "pairingCode"}'],
      console_settings: ['{"singleton": true}'],
      auth_sessions: ['{"id": "a"}', '{"id": "b"}'],
      audit_chain_history: ['{"reset_no": 1}'],
    },
    [code('PCD-000001', 'REDEEMED'), code('PCD-000002', 'ACTIVE')],
  );
  const built = read(
    {
      registry_counters: ['{"name": "device"}', '{"name": "pairingCode"}'],
      console_settings: ['{"singleton": true}'],
      auth_sessions: ['{"id": "a"}', '{"id": "b"}'],
      audit_chain_history: ['{"reset_no": 1}', '{"reset_no": 2}'],
    },
    [code('PCD-000001', 'REDEEMED'), code('PCD-000002', 'CANCELLED', { closedAt: '5000', closedBy: 'OPR-002' })],
  );

  it('equal images, the ACTIVE code closed by this reset, and one more lineage row: no problem', () => {
    expect(compareCarried(carried, built, expectation)).toEqual([]);
    expect(keptCounts(carried)).toMatchObject({ registry_counters: 2, console_settings: 1, pairing_codes: 2, auth_sessions: 2, audit_chain_history: 1, paired_devices: 0 });
  });

  it('a changed, a missing and an extra row are each named by table and position, never by value', () => {
    const changed = read({ ...built.images, auth_sessions: ['{"id": "a"}', '{"id": "B"}'] }, [...built.pairingCodes]);
    expect(compareCarried(carried, changed, expectation)).toEqual(['auth_sessions: row 2 differs from the row that was read.']);
    const missing = read({ ...built.images, auth_sessions: ['{"id": "a"}'] }, [...built.pairingCodes]);
    expect(compareCarried(carried, missing, expectation)).toEqual(['auth_sessions: 2 row(s) were read, 2 are expected and 1 are in the new database.']);
    const extra = read({ ...built.images, paired_devices: ['{"id": "DEV-0009"}'] }, [...built.pairingCodes]);
    expect(compareCarried(carried, extra, expectation)).toEqual(['paired_devices: 0 row(s) were read, 0 are expected and 1 are in the new database.']);
  });

  it('the lineage must grow by exactly one when a chain was discarded, and not at all otherwise', () => {
    const notAppended = read({ ...built.images, audit_chain_history: ['{"reset_no": 1}'] }, [...built.pairingCodes]);
    expect(compareCarried(carried, notAppended, expectation)).toEqual(['audit_chain_history: 1 row(s) were read, 2 are expected and 1 are in the new database.']);
    expect(compareCarried(carried, notAppended, { ...expectation, lineageAppended: false })).toEqual([]);
    expect(compareCarried(carried, built, { ...expectation, lineageAppended: false })).toEqual([
      'audit_chain_history: 1 row(s) were read, 1 are expected and 2 are in the new database.',
    ]);
    const rewritten = read({ ...built.images, audit_chain_history: ['{"reset_no": 1, "x": 1}', '{"reset_no": 2}'] }, [...built.pairingCodes]);
    expect(compareCarried(carried, rewritten, expectation)).toEqual(['audit_chain_history: row 1 differs from the row that was read.']);
  });

  it.each([
    ['still ACTIVE', { state: 'ACTIVE', closedAt: null, closedBy: null }],
    ['closed at another instant', { closedAt: '4999' }],
    ['closed by another operator', { closedBy: 'OPR-001' }],
    ['closed by nobody although an operator reset', { closedBy: null }],
    ['another column changed too', { rest: '{"id": "PCD-000002", "failed_attempts": 0}' }],
    ['closed with another state', { state: 'EXPIRED' }],
  ])('the code that was ACTIVE: %s is a problem', (_label, change) => {
    const wrong = read(built.images as Record<string, string[]>, [
      code('PCD-000001', 'REDEEMED'),
      code('PCD-000002', 'CANCELLED', { closedAt: '5000', closedBy: 'OPR-002', ...change }),
    ]);
    expect(compareCarried(carried, wrong, expectation)).toEqual(['pairing_codes: the code that was ACTIVE (row 2) is not closed as CANCELLED by this reset.']);
  });

  it('a code that was not ACTIVE must be equal as a whole', () => {
    const wrong = read(built.images as Record<string, string[]>, [
      code('PCD-000001', 'REDEEMED', { image: '{"id": "PCD-000001", "state": "CANCELLED"}' }),
      code('PCD-000002', 'CANCELLED', { closedAt: '5000', closedBy: 'OPR-002' }),
    ]);
    expect(compareCarried(carried, wrong, expectation)).toEqual(['pairing_codes: row 1 differs from the row that was read.']);
  });

  it('from the command line the closing operator is null', () => {
    const byNobody = read(built.images as Record<string, string[]>, [
      code('PCD-000001', 'REDEEMED'),
      code('PCD-000002', 'CANCELLED', { closedAt: '5000', closedBy: null }),
    ]);
    expect(compareCarried(carried, byNobody, { ...expectation, actorId: null })).toEqual([]);
  });

  it('a database that was never seeded has no counter and no settings row: the seed\'s rows stay', () => {
    const neverSeeded = read({});
    const fresh = read({ registry_counters: ['{"name": "device"}', '{"name": "pairingCode"}'], console_settings: ['{"singleton": true}'] });
    expect(compareCarried(neverSeeded, fresh, { now: '5000', actorId: null, lineageAppended: false })).toEqual([]);
    // But when rows of such a table WERE read, they must be the rows in the new database.
    const other = read({ ...built.images, registry_counters: ['{"name": "device", "next_value": 9}', '{"name": "pairingCode"}'] }, [...built.pairingCodes]);
    expect(compareCarried(carried, other, expectation)).toEqual(['registry_counters: row 1 differs from the row that was read.']);
  });
});
