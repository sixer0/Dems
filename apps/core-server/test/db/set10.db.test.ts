// Migration set 10 (`0019_credential_replaced_reason.sql` +
// `0020_credential_replaced_reason_privileges.sql`; task 4 package X-C, contract revision `dbc-10`,
// schema version 9; design `docs/2026-10-12_input_av_core_adapter_plan/masterplan/
// 05_design_x1_x2.md` section 3.6; security review SX-12 of `verification/07_security_x1_x2.md`;
// decision U19):
//
//   the value `CREDENTIAL_REPLACED` in the session-end reasons (`auth_sessions_end_reason_check`)
//   and in the biometric-revoke reasons (`biometric_tokens_revoke_check`). No table, no column,
//   no index, no grant.
//
//   M10S-1  the pre-state is a genuine (8, 'dbc-9') database that HOLDS ROWS (operators, a paired
//           device, ended sessions, a revoked token): the new reason is refused there (23514),
//           this code is refused by B-3 naming db:migrate, the code of set 9 is accepted
//   M10S-2  NEGATIVE CONTROL: with 0020 left out the two CHECKs admit the value but the version
//           stays (8, 'dbc-9'), so this code does not start on it (SX-12: one path)
//   M10S-3  set 10 applies exactly its two files, REWRITES NO STORED ROW (MG-8), adds no object and
//           changes no privilege, ends at (9, 'dbc-10'); a second run applies nothing (MG-10)
//   M10S-4  as dems_app: a session ended and a token revoked with the new reason are ACCEPTED;
//           every earlier member still is; a foreign reason is STILL REFUSED; the rules beside
//           the value list (reason and time together, TOKEN_REUSE only for BIOMETRIC) hold
//   M10S-5  B-3 across the step, in both directions
//   M10S-6  ROLLBACK: the set inside one transaction, rolled back, leaves the catalog, the rows and
//           the version as they were; the undo statements return an applied database to the
//           catalog of (8, 'dbc-9') and refuse to run while a row holds the new reason
//   M10S-7  the files: 0019 is four statements and writes no row; 0020 is the version row alone;
//           0017 and 0018 hash to what the development databases hold (MG-4)
//
// Every database here is a throw-away of this test run (TI-17). No value in this file is a
// credential: the token hashes are digests of fixture markers.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import {
  INITIAL_MIGRATION_TAGS,
  MIGRATIONS_FOLDER,
  applyMigrations,
  inspectLedger,
  readAppliedMigrations,
  readMigrationSet,
  readSchemaVersion,
} from '../../src/db/commands/migrations';
import { BootCheckError, checkSchemaVersion } from '../../src/db/schema/boot-checks';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../../src/db/schema/meta';
import { BIO_REVOKE_REASON, SESSION_END_REASON } from '../../src/db/schema/value-sets';
import { useTestDatabase, type TestDatabase } from '../helpers/db';
import { T, authSession, biometricToken, insertDevice, insertRbac, insertRow } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

const TAGS = ['0019_credential_replaced_reason', '0020_credential_replaced_reason_privileges'] as const;
/** The number of files through set 10: this file stops there, whatever set comes later. */
const THROUGH = 21;
/** The files of the sets after set 10, pending on a database of set 10. */
const LATER: readonly string[] = INITIAL_MIGRATION_TAGS.slice(THROUGH);
const SESSIONS = 'public.auth_sessions';
const TOKENS = 'public.biometric_tokens';
const NEW_REASON = 'CREDENTIAL_REPLACED';
const SET_9 = { schemaVersion: 8, contractRevision: 'dbc-9' } as const;
const SET_10 = { schemaVersion: 9, contractRevision: 'dbc-10' } as const;
/** The two sets as they stood before the step, in stored order. */
const END_REASONS_BEFORE = ['SIGNED_OUT', 'IDLE_EXPIRED', 'ABSOLUTE_EXPIRED', 'ROTATED', 'USER_DISABLED', 'DEVICE_REVOKED', 'DEVICE_UNPAIRED', 'TOKEN_REUSE'] as const;
const REVOKE_REASONS_BEFORE = ['DISABLED', 'REENROLLED', 'TOKEN_REUSE', 'DEVICE_REVOKED', 'DEVICE_UNPAIRED', 'USER_DISABLED'] as const;
const temporary: string[] = [];

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files. */
function folderOf(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set10-'));
  temporary.push(folder);
  mkdirSync(join(folder, 'meta'));
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as { entries: unknown[] };
  writeFileSync(join(folder, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, count) }));
  for (const tag of INITIAL_MIGRATION_TAGS.slice(0, count)) cpSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), join(folder, `${tag}.sql`));
  return folder;
}

const isThisCode = (pair: { schemaVersion: number; contractRevision: string }): boolean =>
  pair.schemaVersion === DB_SCHEMA_VERSION && pair.contractRevision === DB_CONTRACT_REVISION;

/**
 * Applies the first `count` files and expects the database at `pair`. While a later set exists the
 * applier commits the files and then reports that the version is not this code's; when `pair` IS
 * this code's pair it reports nothing. Either way the files are applied and the pair is asserted.
 */
async function migrateThrough(pool: Pool, count: number, pair: { schemaVersion: number; contractRevision: string }): Promise<void> {
  const error = await applyMigrations(pool, folderOf(count)).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  if (isThisCode(pair)) expect(error).toBeUndefined();
  else expect(error).toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
  expect(await readSchemaVersion(pool)).toEqual(pair);
}

const outcome = (pending: Promise<{ rowCount: number | null }>): Promise<string> =>
  pending.then(
    (result) => `ok:${result.rowCount}`,
    (error: { code?: string }) => error.code ?? 'error',
  );

/** The statements of one migration file, as the migrator splits them. */
const chunksOf = (tag: string): string[] =>
  readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
    .split('--> statement-breakpoint')
    .filter((chunk) => chunk.trim() !== '');

/** What the two tables hold, as digests of whole row images, with the counts beside them. */
const storedBefore = async (owner: Pool): Promise<unknown> =>
  (await owner.query(
    `SELECT (SELECT count(*)::int FROM ${SESSIONS}) AS sessions,
            (SELECT count(*)::int FROM ${SESSIONS} WHERE ended_at IS NOT NULL) AS ended,
            (SELECT count(*)::int FROM ${TOKENS}) AS tokens,
            (SELECT count(*)::int FROM ${TOKENS} WHERE revoked_at IS NOT NULL) AS revoked,
            (SELECT md5(string_agg(to_jsonb(s)::text, '' ORDER BY s.id)) FROM ${SESSIONS} AS s) AS session_rows,
            (SELECT md5(string_agg(to_jsonb(b)::text, '' ORDER BY b.id)) FROM ${TOKENS} AS b) AS token_rows,
            (SELECT md5(string_agg(to_jsonb(o)::text, '' ORDER BY o.id)) FROM public.operators AS o) AS operator_rows`,
  )).rows;
const objects = "SELECT count(*)::int AS objects FROM pg_class WHERE relnamespace = 'public'::regnamespace";

/**
 * The catalog of schema `public` as one digest: every column with type, nullability and default,
 * every key and CHECK with its definition, every index, and every privilege of the runtime role.
 */
const catalogDigest = async (owner: Pool): Promise<{ lines: number; digest: string }> =>
  (await owner.query<{ lines: number; digest: string }>(
    `SELECT count(*)::int AS lines, md5(string_agg(line, E'\\n' ORDER BY line)) AS digest FROM (
       SELECT 'column ' || table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '-') AS line
         FROM information_schema.columns WHERE table_schema = 'public'
       UNION ALL
       SELECT 'constraint ' || conrelid::regclass::text || ' ' || conname || ' ' || pg_get_constraintdef(oid)
         FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype IN ('p', 'u', 'f', 'c')
       UNION ALL
       SELECT 'index ' || indexdef FROM pg_indexes WHERE schemaname = 'public'
       UNION ALL
       SELECT 'table grant ' || table_name || ' ' || privilege_type FROM information_schema.table_privileges WHERE table_schema = 'public' AND grantee = 'dems_app'
       UNION ALL
       SELECT 'column grant ' || table_name || '.' || column_name || ' ' || privilege_type FROM information_schema.column_privileges WHERE table_schema = 'public' AND grantee = 'dems_app'
     ) AS catalog`,
  )).rows[0] ?? { lines: 0, digest: '' };

/** The privileges of the runtime role alone, as one digest: the set must not move it. */
const grantDigest = async (owner: Pool): Promise<unknown> =>
  (await owner.query(
    `SELECT count(*)::int AS lines, md5(string_agg(line, E'\\n' ORDER BY line)) AS digest FROM (
       SELECT 'table grant ' || table_name || ' ' || privilege_type AS line FROM information_schema.table_privileges WHERE table_schema = 'public' AND grantee = 'dems_app'
       UNION ALL
       SELECT 'column grant ' || table_name || '.' || column_name || ' ' || privilege_type FROM information_schema.column_privileges WHERE table_schema = 'public' AND grantee = 'dems_app'
     ) AS grants`,
  )).rows;

/** The value lists the two CHECKs hold, read back from the catalog. */
const checkedValues = async (pool: Pool): Promise<Record<string, string[]>> => {
  const { rows } = await pool.query<{ name: string; definition: string }>(
    "SELECT conname::text AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname IN ('auth_sessions_end_reason_check', 'biometric_tokens_revoke_check') ORDER BY 1",
  );
  return Object.fromEntries(rows.map((row) => [row.name, [...row.definition.matchAll(/'([A-Z_]+)'::text/g)].map((match) => match[1] ?? '')]));
};

/**
 * THE UNDO OF AN APPLIED SET 10 ("applied, and must be undone"). The files of an applied set are
 * never edited and no down file exists in this repository, so an undo is delivered as a NEW
 * forward set that carries these statements and steps the version onward. They are kept here,
 * where a test runs them, so that the rollback is measured and not only described.
 * PRECONDITION: no session and no token holds the new reason - the first statement refuses
 * otherwise (and without it the two ADD CONSTRAINT statements would answer 23514). A row that
 * holds the reason is history: it is not rewritten into another reason to make an undo pass.
 * WHAT IT LOSES: nothing stored. The code that writes the reason (the command that replaces an
 * operator password) must go in the same release, or it answers 23514.
 */
const UNDO_SET_10: readonly string[] = [
  `DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.auth_sessions WHERE end_reason = '${NEW_REASON}') OR EXISTS (SELECT 1 FROM public.biometric_tokens WHERE revoke_reason = '${NEW_REASON}') THEN RAISE EXCEPTION 'a session or a token holds the reason ${NEW_REASON}: the history is not rewritten' USING ERRCODE = 'object_not_in_prerequisite_state'; END IF; END $$`,
  'ALTER TABLE public.auth_sessions DROP CONSTRAINT auth_sessions_end_reason_check',
  'ALTER TABLE public.biometric_tokens DROP CONSTRAINT biometric_tokens_revoke_check',
  `ALTER TABLE public.auth_sessions ADD CONSTRAINT auth_sessions_end_reason_check CHECK ("auth_sessions"."end_reason" IS NULL OR "auth_sessions"."end_reason" IN (${END_REASONS_BEFORE.map((value) => `'${value}'`).join(', ')}))`,
  `ALTER TABLE public.biometric_tokens ADD CONSTRAINT biometric_tokens_revoke_check CHECK (("biometric_tokens"."revoked_at" IS NULL) = ("biometric_tokens"."revoke_reason" IS NULL) AND ("biometric_tokens"."revoke_reason" IS NULL OR "biometric_tokens"."revoke_reason" IN (${REVOKE_REASONS_BEFORE.map((value) => `'${value}'`).join(', ')})))`,
];
/** SQLSTATE 55000, `object_not_in_prerequisite_state`: what the guard of the undo raises. */
const NOT_IN_PREREQUISITE_STATE = '55000';

/**
 * A (8, dbc-9) database with the rows of M10S-1: the four operators, one paired device, three
 * sessions of OPR-002 (one open, one signed out, one ended by token reuse on the device) and two
 * biometric tokens (one open, one revoked).
 */
async function seedSetNine(owner: Pool): Promise<void> {
  await migrateThrough(owner, 19, SET_9);
  await insertRbac(owner);
  await insertDevice(owner);
  await insertRow(owner, 'auth_sessions', authSession('open'));
  await insertRow(owner, 'auth_sessions', authSession('signed-out', { ended_at: T + 60_000, end_reason: 'SIGNED_OUT' }));
  await insertRow(owner, 'auth_sessions', authSession('reuse', { method: 'BIOMETRIC', device_id: 'DEV-0001', ended_at: T + 90_000, end_reason: 'TOKEN_REUSE' }));
  await insertRow(owner, 'biometric_tokens', biometricToken('open'));
  await insertRow(owner, 'biometric_tokens', biometricToken('revoked', { revoked_at: T + 90_000, revoke_reason: 'TOKEN_REUSE' }));
}

/** A clone for one case, dropped when the case ends (the run keeps few clones alive at a time). */
async function withClone(slug: string, work: (other: TestDatabase) => Promise<void>): Promise<void> {
  const other = await db.another({ template: EMPTY_DATABASE, slug });
  try {
    await work(other);
  } finally {
    await other.drop();
  }
}

const owner = (): Pool => db.ownerPool();

describe('M10S-1: the pre-state, a (8, dbc-9) database that holds rows', () => {
  it('nineteen files applied, set 10 pending; this code is refused by B-3 and the code of set 9 passes', async () => {
    await seedSetNine(owner());
    const ledger = await inspectLedger(owner());
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([...TAGS, ...LATER]);
    expect((await inspectLedger(owner(), folderOf(THROUGH))).pending).toEqual([...TAGS]);
    const error = await checkSchemaVersion(db.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    // The pair this code expects is read from its constants: it moves with every later set.
    expect((error as BootCheckError).message).toBe(
      `B-3: the database is at schema version 8 (dbc-9); this server expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>`,
    );
    await expect(checkSchemaVersion(db.appPool(), SET_9)).resolves.toBeUndefined();
  });

  it('rows of the kind a used database holds: three sessions (two ended), two tokens (one revoked); the two CHECKs hold the eight and the six values', async () => {
    expect(await storedBefore(owner())).toMatchObject([{ sessions: 3, ended: 2, tokens: 2, revoked: 1 }]);
    expect(await checkedValues(owner())).toEqual({
      auth_sessions_end_reason_check: [...END_REASONS_BEFORE],
      biometric_tokens_revoke_check: [...REVOKE_REASONS_BEFORE],
    });
  });

  it('THE STATE THAT IS MISSING: the reason is refused in both tables (23514) - a password replaced from the host has no true word to end a session with', async () => {
    const app = db.appPool();
    await expectRefused(() => app.query(`UPDATE ${SESSIONS} SET ended_at = $1, end_reason = '${NEW_REASON}' WHERE ended_at IS NULL`, [T + 1]), SQLSTATE.checkViolation, 'auth_sessions_end_reason_check');
    await expectRefused(() => app.query(`UPDATE ${TOKENS} SET revoked_at = $1, revoke_reason = '${NEW_REASON}' WHERE revoked_at IS NULL`, [T + 1]), SQLSTATE.checkViolation, 'biometric_tokens_revoke_check');
    expect(await storedBefore(owner())).toMatchObject([{ sessions: 3, ended: 2, tokens: 2, revoked: 1 }]);
  });
});

describe('M10S-2: NEGATIVE CONTROL - without 0020 the value is admitted but the version is not stepped', () => {
  it('0019 alone: both CHECKs hold the new value, the version stays (8, dbc-9), this code does not start on it and the code of set 9 still does', async () => {
    await withClone('set10_no0020', async (other) => {
      await seedSetNine(other.ownerPool());
      await migrateThrough(other.ownerPool(), 20, SET_9);
      const values = await checkedValues(other.ownerPool());
      expect(values['auth_sessions_end_reason_check']).toContain(NEW_REASON);
      expect(values['biometric_tokens_revoke_check']).toContain(NEW_REASON);
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      await expect(checkSchemaVersion(other.appPool(), SET_9)).resolves.toBeUndefined();
    });
  });
});

describe('M10S-3: set 10 applies its two files and rewrites no stored row', () => {
  it('db:migrate applies exactly 0019 and 0020 and steps the version to (9, dbc-10); the ledger holds twenty-one files; no object and no privilege is new; every stored row is what it was', async () => {
    const rowsBefore = await storedBefore(owner());
    const objectsBefore = (await owner().query<{ objects: number }>(objects)).rows[0]?.objects ?? 0;
    const grantsBefore = await grantDigest(owner());
    const folder = folderOf(THROUGH);
    expect(await readSchemaVersion(owner())).toEqual(SET_9);
    expect((await inspectLedger(owner(), folder)).pending).toEqual([...TAGS]);
    await migrateThrough(owner(), THROUGH, SET_10);
    const ledger = await inspectLedger(owner(), folder);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([]);
    expect(await readAppliedMigrations(owner())).toHaveLength(THROUGH);
    // No table, no index, no sequence: the count of objects is what it was.
    expect((await owner().query<{ objects: number }>(objects)).rows[0]?.objects).toBe(objectsBefore);
    // A constraint carries no privilege: the runtime role holds exactly what it held.
    expect(await grantDigest(owner())).toEqual(grantsBefore);
    // MG-8: nothing was rewritten and nothing was backfilled.
    expect(await storedBefore(owner())).toEqual(rowsBefore);
    // The two CHECKs came back under their names, validated against the stored rows, with the value LAST.
    expect(
      (await owner().query("SELECT conname::text AS name, convalidated FROM pg_constraint WHERE conname IN ('auth_sessions_end_reason_check', 'biometric_tokens_revoke_check') ORDER BY 1")).rows,
    ).toEqual([
      { name: 'auth_sessions_end_reason_check', convalidated: true },
      { name: 'biometric_tokens_revoke_check', convalidated: true },
    ]);
    expect(await checkedValues(owner())).toEqual({
      auth_sessions_end_reason_check: [...END_REASONS_BEFORE, NEW_REASON],
      biometric_tokens_revoke_check: [...REVOKE_REASONS_BEFORE, NEW_REASON],
    });
    // The catalog holds what the typed schema declares, value for value, in order.
    expect([...END_REASONS_BEFORE, NEW_REASON]).toEqual([...SESSION_END_REASON]);
    expect([...REVOKE_REASONS_BEFORE, NEW_REASON]).toEqual([...BIO_REVOKE_REASON]);
    // The CHECK count of the two tables did not move: nothing was added beside the two.
    expect(
      (await owner().query("SELECT conrelid::regclass::text AS t, count(*)::int AS checks FROM pg_constraint WHERE contype = 'c' AND conrelid IN ('public.auth_sessions'::regclass, 'public.biometric_tokens'::regclass) GROUP BY 1 ORDER BY 1")).rows,
    ).toEqual([
      { t: 'auth_sessions', checks: 7 },
      { t: 'biometric_tokens', checks: 3 },
    ]);
  });

  it('a second run applies nothing and changes nothing (MG-10)', async () => {
    const before = await readAppliedMigrations(owner());
    const objectsBefore = await owner().query(objects);
    const catalogBefore = await catalogDigest(owner());
    await applyMigrations(owner(), folderOf(THROUGH)).catch(() => undefined);
    expect(await readSchemaVersion(owner())).toEqual(SET_10);
    expect(await readAppliedMigrations(owner())).toEqual(before);
    expect((await owner().query(objects)).rows).toEqual(objectsBefore.rows);
    expect(await catalogDigest(owner())).toEqual(catalogBefore);
  });
});

describe('M10S-4: the new reason is accepted and a foreign reason is still refused', () => {
  it('as dems_app: the open session of an operator is ended with CREDENTIAL_REPLACED, and the open biometric token is revoked with it - the two statements the password command needs (SX-03: the runtime role)', async () => {
    const app = db.appPool();
    expect(await outcome(app.query(`UPDATE ${SESSIONS} SET ended_at = $1, end_reason = '${NEW_REASON}' WHERE operator_id = 'OPR-002' AND ended_at IS NULL`, [T + 120_000]))).toBe('ok:1');
    expect(await outcome(app.query(`UPDATE ${TOKENS} SET revoked_at = $1, revoke_reason = '${NEW_REASON}' WHERE operator_id = 'OPR-002' AND revoked_at IS NULL`, [T + 120_000]))).toBe('ok:1');
    expect((await owner().query(`SELECT end_reason, count(*)::int AS rows FROM ${SESSIONS} GROUP BY 1 ORDER BY 1`)).rows).toEqual([
      { end_reason: NEW_REASON, rows: 1 },
      { end_reason: 'SIGNED_OUT', rows: 1 },
      { end_reason: 'TOKEN_REUSE', rows: 1 },
    ]);
    expect((await owner().query(`SELECT revoke_reason, count(*)::int AS rows FROM ${TOKENS} GROUP BY 1 ORDER BY 1`)).rows).toEqual([
      { revoke_reason: NEW_REASON, rows: 1 },
      { revoke_reason: 'TOKEN_REUSE', rows: 1 },
    ]);
  });

  it('a session and a token may also be INSERTED already ended with it (a fixture, a restore): accepted', async () => {
    await insertRow(db.appPool(), 'auth_sessions', authSession('replaced-insert', { ended_at: T + 1, end_reason: NEW_REASON }));
    await insertRow(db.appPool(), 'biometric_tokens', biometricToken('replaced-insert', { revoked_at: T + 1, revoke_reason: NEW_REASON }));
  });

  it.each([...END_REASONS_BEFORE])('every earlier session-end reason is still accepted: %s', async (reason) => {
    const row = reason === 'TOKEN_REUSE'
      ? authSession(`still-${reason}`, { method: 'BIOMETRIC', device_id: 'DEV-0001', ended_at: T + 1, end_reason: reason })
      : authSession(`still-${reason}`, { ended_at: T + 1, end_reason: reason });
    await insertRow(db.appPool(), 'auth_sessions', row);
  });

  it.each([...REVOKE_REASONS_BEFORE])('every earlier biometric-revoke reason is still accepted: %s', async (reason) => {
    await insertRow(db.appPool(), 'biometric_tokens', biometricToken(`still-${reason}`, { revoked_at: T + 1, revoke_reason: reason }));
  });

  it.each([
    ['a word outside the set', 'KICKED'],
    ['the reason in lower case', 'credential_replaced'],
    ['the reason with a trailing blank', 'CREDENTIAL_REPLACED '],
    ['a near name', 'CREDENTIALS_REPLACED'],
    ['another near name', 'PASSWORD_REPLACED'],
    ['the audit type of the same event (a type is not a reason)', 'OPERATOR_PASSWORD_SET'],
    ['the empty text', ''],
  ])('A FOREIGN REASON IS STILL REFUSED (23514) in both tables: %s', async (_what, reason) => {
    await expectRefused(() => insertRow(db.appPool(), 'auth_sessions', authSession(`foreign-${reason}`, { ended_at: T + 1, end_reason: reason })), SQLSTATE.checkViolation, 'auth_sessions_end_reason_check');
    await expectRefused(() => insertRow(db.appPool(), 'biometric_tokens', biometricToken(`foreign-${reason}`, { revoked_at: T + 1, revoke_reason: reason })), SQLSTATE.checkViolation, 'biometric_tokens_revoke_check');
  });

  it('the rules beside the value list hold: the reason without the time, the time without the reason, and TOKEN_REUSE on a password session are refused', async () => {
    const app = db.appPool();
    await expectRefused(() => insertRow(app, 'auth_sessions', authSession('no-time', { end_reason: NEW_REASON })), SQLSTATE.checkViolation, 'auth_sessions_end_check');
    await expectRefused(() => insertRow(app, 'auth_sessions', authSession('no-reason', { ended_at: T + 1 })), SQLSTATE.checkViolation, 'auth_sessions_end_check');
    await expectRefused(() => insertRow(app, 'auth_sessions', authSession('reuse-password', { ended_at: T + 1, end_reason: 'TOKEN_REUSE' })), SQLSTATE.checkViolation, 'auth_sessions_token_reuse_check');
    await expectRefused(() => insertRow(app, 'biometric_tokens', biometricToken('no-time', { revoke_reason: NEW_REASON })), SQLSTATE.checkViolation, 'biometric_tokens_revoke_check');
    await expectRefused(() => insertRow(app, 'biometric_tokens', biometricToken('no-reason', { revoked_at: T + 1 })), SQLSTATE.checkViolation, 'biometric_tokens_revoke_check');
  });

  it('the runtime role still removes no session and no token, and rewrites no column but the three it held (42501)', async () => {
    const app = db.appPool();
    await expectRefused(() => app.query(`DELETE FROM ${SESSIONS}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`DELETE FROM ${TOKENS}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`UPDATE ${SESSIONS} SET operator_id = 'OPR-001'`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`UPDATE ${TOKENS} SET operator_id = 'OPR-001'`), SQLSTATE.insufficientPrivilege);
    const updatable = async (table: string): Promise<string[]> =>
      (await owner().query<{ name: string }>(`SELECT attname::text AS name FROM pg_attribute WHERE attrelid = '${table}'::regclass AND attnum > 0 AND NOT attisdropped AND has_column_privilege('dems_app', attrelid, attnum, 'UPDATE') ORDER BY 1`)).rows.map((row) => row.name);
    expect(await updatable(SESSIONS)).toEqual(['end_reason', 'ended_at', 'last_seen_at']);
    expect(await updatable(TOKENS)).toEqual(['revoke_reason', 'revoked_at', 'used_at']);
  });
});

describe('M10S-5: B-3 across the step, in both directions', () => {
  it('the code of set 9 (8, dbc-9) on the migrated database is refused; the code of set 10 passes', async () => {
    const error = await checkSchemaVersion(db.appPool(), SET_9).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 9 (dbc-10); this server expects 8 (dbc-9)');
    await expect(checkSchemaVersion(db.appPool(), SET_10)).resolves.toBeUndefined();
    // This code passes exactly while set 10 is the last set; with a later set it names db:migrate.
    const here = await checkSchemaVersion(db.appPool()).then(
      () => 'passes',
      () => 'refused',
    );
    expect(here).toBe(isThisCode(SET_10) ? 'passes' : 'refused');
  });
});

describe('M10S-6: rollback', () => {
  it('FAILS WHILE APPLYING: the two files inside one transaction, rolled back before the commit, leave the catalog, the rows, the version and the ledger as they were', async () => {
    await withClone('set10_rollback_tx', async (other) => {
      const pool = other.ownerPool();
      await seedSetNine(pool);
      const catalogBefore = await catalogDigest(pool);
      const rowsBefore = await storedBefore(pool);
      const ledgerBefore = await readAppliedMigrations(pool);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const tag of TAGS) for (const chunk of chunksOf(tag)) await client.query(chunk);
        // Inside the transaction the set is in force: the value is admitted and the version is stepped.
        await client.query(`UPDATE ${SESSIONS} SET ended_at = $1, end_reason = '${NEW_REASON}' WHERE ended_at IS NULL`, [T + 1]);
        expect((await client.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows).toEqual([{ schema_version: 9, contract_revision: 'dbc-10' }]);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await storedBefore(pool)).toEqual(rowsBefore);
      expect(await readSchemaVersion(pool)).toEqual(SET_9);
      expect(await readAppliedMigrations(pool)).toEqual(ledgerBefore);
      expect((await inspectLedger(pool)).pending).toEqual([...TAGS, ...LATER]);
      await expect(checkSchemaVersion(other.appPool(), SET_9)).resolves.toBeUndefined();
    });
  });

  it('APPLIED, AND MUST BE UNDONE: the undo statements return the catalog to the one of (8, dbc-9), every row is what it was, and the code of set 9 starts again', async () => {
    await withClone('set10_rollback_undo', async (other) => {
      const pool = other.ownerPool();
      await seedSetNine(pool);
      const catalogBefore = await catalogDigest(pool);
      const rowsBefore = await storedBefore(pool);
      await migrateThrough(pool, THROUGH, SET_10);
      expect((await catalogDigest(pool)).digest).not.toBe(catalogBefore.digest);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const statement of UNDO_SET_10) await client.query(statement);
        // In a delivered forward set the version steps ONWARD; here it is set to the pair of set 9
        // so that the comparison below is with the database as it was.
        await client.query("UPDATE public.schema_meta SET schema_version = 8, contract_revision = 'dbc-9' WHERE singleton");
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await storedBefore(pool)).toEqual(rowsBefore);
      await expect(checkSchemaVersion(other.appPool(), SET_9)).resolves.toBeUndefined();
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      await expectRefused(() => other.appPool().query(`UPDATE ${SESSIONS} SET ended_at = $1, end_reason = '${NEW_REASON}' WHERE ended_at IS NULL`, [T + 1]), SQLSTATE.checkViolation, 'auth_sessions_end_reason_check');
    });
  });

  it('THE PRECONDITION OF THE UNDO: while a session holds the new reason the undo is refused (55000) and changes nothing - the history is not rewritten', async () => {
    await withClone('set10_rollback_held', async (other) => {
      const pool = other.ownerPool();
      await seedSetNine(pool);
      await migrateThrough(pool, THROUGH, SET_10);
      await other.appPool().query(`UPDATE ${SESSIONS} SET ended_at = $1, end_reason = '${NEW_REASON}' WHERE ended_at IS NULL`, [T + 1]);
      const catalogApplied = await catalogDigest(pool);
      const client = await pool.connect();
      let refusal: string | undefined;
      try {
        await client.query('BEGIN');
        for (const statement of UNDO_SET_10) await client.query(statement);
        await client.query('COMMIT');
      } catch (error) {
        refusal = (error as { code?: string }).code;
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      expect(refusal).toBe(NOT_IN_PREREQUISITE_STATE);
      expect(await catalogDigest(pool)).toEqual(catalogApplied);
      expect(await readSchemaVersion(pool)).toEqual(SET_10);
      expect((await pool.query(`SELECT count(*)::int AS held FROM ${SESSIONS} WHERE end_reason = '${NEW_REASON}'`)).rows).toEqual([{ held: 1 }]);
    });
  });
});

describe('M10S-7: the files', () => {
  const statementsOf = (tag: string): string[] =>
    readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').map((line) => line.trim()).join(' ').trim())
      .filter((part) => part !== '');

  it('0019 is generated: two DROP CONSTRAINT and two ADD CONSTRAINT under the same two names - and no statement that writes a row (MG-2, MG-8)', () => {
    const generated = statementsOf(TAGS[0]);
    expect(generated).toEqual([
      'ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_end_reason_check";',
      'ALTER TABLE "biometric_tokens" DROP CONSTRAINT "biometric_tokens_revoke_check";',
      `ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_end_reason_check" CHECK ("auth_sessions"."end_reason" IS NULL OR "auth_sessions"."end_reason" IN (${SESSION_END_REASON.map((value) => `'${value}'`).join(', ')}));`,
      `ALTER TABLE "biometric_tokens" ADD CONSTRAINT "biometric_tokens_revoke_check" CHECK (("biometric_tokens"."revoked_at" IS NULL) = ("biometric_tokens"."revoke_reason" IS NULL) AND ("biometric_tokens"."revoke_reason" IS NULL OR "biometric_tokens"."revoke_reason" IN (${BIO_REVOKE_REASON.map((value) => `'${value}'`).join(', ')})));`,
    ]);
    const text = generated.join(' ');
    expect(text).not.toMatch(/\b(?:UPDATE|DELETE|INSERT|TRUNCATE|GRANT|REVOKE)\b/);
    expect(text).not.toMatch(/NOT VALID|CREATE TABLE|ADD COLUMN|DROP TABLE|DROP COLUMN|DROP NOT NULL/i);
    // No hand statement inside the generated file: every line is the generator's.
    expect(readFileSync(join(MIGRATIONS_FOLDER, `${TAGS[0]}.sql`), 'utf8')).not.toMatch(/^--(?!> statement-breakpoint)/m);
  });

  it('0020 is hand-written: the version row and nothing else - no grant, no revoke, no role', () => {
    const written = statementsOf(TAGS[1]);
    expect(written).toEqual(["UPDATE public.schema_meta SET schema_version = 9, contract_revision = 'dbc-10' WHERE singleton;"]);
    expect(written.join(' ')).not.toMatch(/GRANT|REVOKE|ALL\s+TABLES|dems_owner|dems_admin|SECURITY\s+DEFINER|TRIGGER/i);
  });

  it('0017 and 0018 hash to what the ledgers of the development databases store: they were not edited (MG-4)', () => {
    const hashes = Object.fromEntries(readMigrationSet().map((file) => [file.tag, file.sha256]));
    expect(hashes['0017_network_commissioning']).toBe('047658d947b2be5333f3df58d4f484a0a91a81edeb71b256d7c8090ddfb7418a');
    expect(hashes['0018_network_commissioning_privileges']).toBe('de871f4b1263c6343feddde776cda3144ef3d795960849084cbf159dd631a25f');
  });
});
