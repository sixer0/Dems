// PostgreSQL behaviours the database contract relies on (§1.9), where no other test of this row
// already exercises them: PG-10, PG-11, PG-13, PG-15, PG-16, PG-19, PG-27; and the server-log
// check of plan row W17 (contract §5.4 NL-3, §7.6; finding F-2 of the test-helper row).
//
// THE LOG CHECK reads `.data/postgres.log`, the file `pg_ctl -l` writes (mode 0600). It reads
// only what the server appended while this file's statements ran, searches it for marker values
// that this test made up (random per run), and prints nothing else of it. Nothing in
// PostgreSQL's configuration is changed.
import { randomBytes } from 'node:crypto';
import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { T, authSession, insertDevice, insertRbac, insertRow, operatorCredential } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, connect, expectRefused, sha256, sleep } from './support';

const db = useTestDatabase({ template: 'schema' });
let app: Pool;
let owner: Pool;

beforeAll(async () => {
  app = db.appPool();
  owner = db.ownerPool();
  await insertRbac(owner);
  await insertDevice(owner);
});

describe('PG-11: jsonb', () => {
  it('stores a JSON number as an exact decimal and refuses the character U+0000 in a string', async () => {
    const { rows } = await app.query(`SELECT ('{"n": 12345678901234567890.123456789}'::jsonb ->> 'n') AS n, ('{"n": 0.1}'::jsonb ->> 'n') AS tenth`);
    expect(rows).toEqual([{ n: '12345678901234567890.123456789', tenth: '0.1' }]);
    const refusal = await expectRefused(() => app.query(`SELECT '{"text": "a\\u0000b"}'::jsonb`), '22P05');
    expect(refusal.message).toBe('unsupported Unicode escape sequence');
    // The same through a bind parameter, as the server would send a detail map.
    await expectRefused(() => app.query('SELECT $1::jsonb', [JSON.stringify({ text: 'a\u0000b' })]), '22P05');
  });
});

describe('PG-13: core functions and identifier length', () => {
  it('gen_random_uuid() and sha256(bytea) need no extension; an identifier is cut at 63 bytes', async () => {
    const { rows } = await app.query(
      `SELECT gen_random_uuid()::text ~ '^[0-9a-f-]{36}$' AS uuid_ok,
              encode(sha256('abc'::bytea), 'hex') AS digest,
              octet_length(repeat('a', 70)::name::text) AS name_bytes,
              (SELECT count(*)::int FROM pg_extension WHERE extname <> 'plpgsql') AS extensions`,
    );
    expect(rows).toEqual([
      { uuid_ok: true, digest: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', name_bytes: 63, extensions: 0 },
    ]);
    expect(sha256('abc').toString('hex')).toBe(rows[0]?.digest);
  });
});

describe('PG-15, PG-10: a new database, before any migration', () => {
  it('every role may connect; only the owner of the database may create an object in schema public', async () => {
    const empty = await db.another({ template: EMPTY_DATABASE, slug: 'pg_empty' });
    expect((await empty.appPool().query('SELECT current_user::text AS role, current_database() = $1 AS here', [empty.name])).rows).toEqual([
      { role: 'dems_app', here: true },
    ]);
    await expectRefused(() => empty.appPool().query('CREATE TABLE public.w17_denied (id integer)'), SQLSTATE.insufficientPrivilege);
    await empty.ownerPool().query('CREATE TABLE public.w17_allowed (id integer)');
    // Before 0003_privileges nothing was revoked: PUBLIC still has USAGE on public and EXECUTE on new functions.
    const { rows } = await empty.ownerPool().query(
      `SELECT has_schema_privilege('dems_app', 'public', 'USAGE') AS usage, has_schema_privilege('dems_app', 'public', 'CREATE') AS can_create,
              pg_get_userbyid(datdba)::text AS owner
         FROM pg_database WHERE datname = current_database()`,
    );
    expect(rows).toEqual([{ usage: true, can_create: false, owner: 'dems_owner' }]);
  });
});

describe('PG-19: a utility statement takes no bind parameter', () => {
  it('CREATE DATABASE $1 is a syntax error (42601): a database name is statement text, placed only after it matched the closed list', async () => {
    await expectRefused(() => owner.query('CREATE DATABASE $1', [`${db.run.identity.prefix}x_param`]), '42601');
    const { rows } = await owner.query('SELECT count(*)::int AS rows FROM pg_database WHERE datname = $1', [`${db.run.identity.prefix}x_param`]);
    expect(rows).toEqual([{ rows: 0 }]);
  });
});

describe('PG-27: what dems_owner sees of a session of another role', () => {
  it('database, pid and role are visible; the query text and the client address are hidden', async () => {
    const session = await connect(db.runtime, 'dems-w17-visible');
    try {
      const pid = (await session.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid;
      const { rows } = await owner.query(
        'SELECT datname::text AS datname, usename::text AS usename, application_name, query, client_addr, state, backend_type FROM pg_stat_activity WHERE pid = $1',
        [pid],
      );
      expect(rows).toEqual([
        {
          datname: db.name,
          usename: 'dems_app',
          application_name: 'dems-w17-visible',
          query: '<insufficient privilege>',
          client_addr: null,
          // Finding F-1 of the test-helper row: these two are hidden as well, so a filter on them hides the session.
          state: null,
          backend_type: null,
        },
      ]);
    } finally {
      await session.end();
    }
  });
});

describe('PG-16 and the server log: what a refused statement writes into .data/postgres.log', () => {
  const logFile = (): string => join(db.run.dataDir, 'postgres.log');

  function readFrom(offset: number): string {
    const size = statSync(logFile()).size;
    const length = Math.max(0, size - offset);
    const buffer = Buffer.alloc(length);
    const descriptor = openSync(logFile(), 'r');
    try {
      readSync(descriptor, buffer, 0, length, offset);
    } finally {
      closeSync(descriptor);
    }
    return buffer.toString('utf8');
  }

  /** The lines the server appended since `offset` that contain `needle`, once `expected` of them exist. */
  async function appended(offset: number, needle: string, expected: number): Promise<string[]> {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const lines = readFrom(offset)
        .split('\n')
        .filter((line) => line.includes(needle));
      if (lines.length >= expected) return lines;
      await sleep(10);
    }
    return readFrom(offset)
      .split('\n')
      .filter((line) => line.includes(needle));
  }

  it('the settings of NL-5 are the defaults; the four that decide what is logged can be changed by a superuser only', async () => {
    const { rows } = await app.query(
      "SELECT name, setting, context FROM pg_settings WHERE name IN ('log_statement', 'log_min_duration_statement', 'log_parameter_max_length_on_error', 'log_min_error_statement', 'log_error_verbosity', 'log_parameter_max_length') ORDER BY 1",
    );
    expect(rows).toEqual([
      { name: 'log_error_verbosity', setting: 'default', context: 'superuser' },
      { name: 'log_min_duration_statement', setting: '-1', context: 'superuser' },
      { name: 'log_min_error_statement', setting: 'error', context: 'superuser' },
      { name: 'log_parameter_max_length', setting: '-1', context: 'superuser' },
      // Any role may set this one for its own session; no program of the project does (NL-5).
      { name: 'log_parameter_max_length_on_error', setting: '0', context: 'user' },
      { name: 'log_statement', setting: 'none', context: 'superuser' },
    ]);
    for (const pool of [app, owner]) {
      await expectRefused(() => pool.query("SET log_statement = 'all'"), SQLSTATE.insufficientPrivilege);
      await expectRefused(() => pool.query('SET log_error_verbosity = terse'), SQLSTATE.insufficientPrivilege);
      await expectRefused(() => pool.query('SET log_min_duration_statement = 0'), SQLSTATE.insufficientPrivilege);
    }
  });

  it('a failed statement is logged with $n, never with its bind values; a DETAIL line can carry a column value, which is a hash and never the secret', async () => {
    expect(statSync(logFile()).mode & 0o777).toBe(0o600);
    // Markers of this run. The "secret" is what a token would be; the database only ever gets its SHA-256.
    const secret = `ses_w17-log-check-${randomBytes(18).toString('hex')}`;
    const tokenHash = sha256(secret);
    const hex = tokenHash.toString('hex');
    // A comment that travels with this test's statements, so that its STATEMENT lines can be told
    // from those of other rows that test at the same time.
    const tag = `/* w17-log-${randomBytes(6).toString('hex')} */`;
    const insert = `${tag} INSERT INTO auth_sessions (token_hash, operator_id, method, issued_at, last_seen_at, absolute_expires_at) VALUES ($1, $2, $3, $4, $4, $5)`;
    const offset = statSync(logFile()).size;

    // 1. Accepted statements leave no trace.
    await app.query(insert, [tokenHash, 'OPR-002', 'PASSWORD', T, T + 1]);
    // 2. A unique violation on a hash column (23505): the same token hash again.
    await expectRefused(
      () =>
        app.query(
          insert,
          [tokenHash, 'OPR-002', 'PASSWORD', T, T + 1],
        ),
      SQLSTATE.uniqueViolation,
      'auth_sessions_token_hash_key',
    );
    // 3. A CHECK violation on a table with a hash column (23514): the whole failing row is described.
    const other = sha256(`${secret}:second`);
    await expectRefused(
      () =>
        app.query(
          insert,
          [other, 'OPR-002', 'PASSWORD', T, T - 1],
        ),
      SQLSTATE.checkViolation,
      'auth_sessions_times_check',
    );
    // 4. A foreign-key violation (23503) names the key value, here an operator ID.
    await expectRefused(() => insertRow(app, 'auth_sessions', authSession(`${secret}:third`, { operator_id: 'OPR-777' })), SQLSTATE.foreignKeyViolation);
    // 5. A refusal by privilege (42501) names the table only.
    await expectRefused(() => app.query(`${tag} UPDATE audit_log SET message = $1 WHERE seq = $2`, [`marker-${hex}`, 1]), SQLSTATE.insufficientPrivilege);
    // 6. The re-hash of a password (SR-06) with a value the CHECK refuses: the row holds the salt and the hash.
    const badHash = Buffer.from(sha256(`${secret}:password-hash`).subarray(0, 31));
    await expectRefused(
      () => app.query(`${tag} UPDATE operator_credentials SET hash = $1, hashed_at = $2 WHERE operator_id = $3`, [badHash, T + 9, 'OPR-002']),
      SQLSTATE.checkViolation,
      'operator_credentials_lengths_check',
    );

    // 7. The three other UNIQUE constraints on a column that holds the hash of a secret.
    const credentialHash = sha256(`${secret}:device-credential`);
    const nextHash = sha256(`${secret}:device-credential-next`);
    const bioHash = sha256(`${secret}:biometric-token`);
    await app.query(`${tag} UPDATE device_credentials SET current_hash = $1, next_hash = $2, rotated_at = $3 WHERE device_id = $4`, [credentialHash, nextHash, T, 'DEV-0001']);
    await expectRefused(
      () => app.query(`${tag} INSERT INTO device_credentials (device_id, current_hash) VALUES ($1, $2)`, ['DEV-7777', credentialHash]),
      SQLSTATE.uniqueViolation,
      'device_credentials_current_hash_key',
    );
    await expectRefused(
      () => app.query(`${tag} INSERT INTO device_credentials (device_id, current_hash, next_hash) VALUES ($1, $2, $3)`, ['DEV-7777', sha256(`${secret}:x`), nextHash]),
      SQLSTATE.uniqueViolation,
      'device_credentials_next_hash_key',
    );
    const token = `${tag} INSERT INTO biometric_tokens (token_hash, family_id, device_id, operator_id, issued_at, expires_at, used_at) VALUES ($1, gen_random_uuid(), $2, $3, $4, $5, $6)`;
    await app.query(token, [bioHash, 'DEV-0001', 'OPR-002', T, T + 1_000, null]);
    await expectRefused(() => app.query(token, [bioHash, 'DEV-0001', 'OPR-002', T, T + 1_000, T + 1]), SQLSTATE.uniqueViolation, 'biometric_tokens_token_hash_key');

    const keyLines = await appended(offset, hex, 1);
    const text = readFrom(offset);
    const markers = [tokenHash, other, badHash, credentialHash, nextHash, bioHash].map((value) => value.toString('hex').slice(0, 40));
    const mine = text.split('\n').filter((line) => markers.some((marker) => line.includes(marker)));

    // The secret itself never reached the server, so it cannot be in its log.
    expect(text.includes(secret)).toBe(false);
    // The STATEMENT lines show placeholders only.
    const statements = text.split('\n').filter((line) => line.includes('STATEMENT:') && line.includes(tag));
    // Seven of this test's tagged statements were refused; the accepted ones left no line.
    expect(statements).toHaveLength(7);
    expect(statements.filter((line) => line.endsWith('VALUES ($1, $2, $3, $4, $4, $5)'))).toHaveLength(2);
    expect(statements.filter((line) => line.endsWith('UPDATE audit_log SET message = $1 WHERE seq = $2'))).toHaveLength(1);
    expect(statements.filter((line) => line.endsWith('UPDATE operator_credentials SET hash = $1, hashed_at = $2 WHERE operator_id = $3'))).toHaveLength(1);
    for (const line of statements) expect(/[0-9a-f]{40}/.test(line.replace(tag, ''))).toBe(false);
    // The bind value of the refused UPDATE (which carried the hash as a marker text) is not logged.
    expect(text.includes(`marker-${hex}`)).toBe(false);

    // Finding: the DETAIL line of the unique violation carries the KEY VALUE, the stored hash.
    expect(keyLines).toHaveLength(1);
    expect(keyLines[0]).toContain(`DETAIL:  Key (token_hash)=(\\x${hex}) already exists.`);
    // Finding: the DETAIL line of a CHECK violation describes the WHOLE failing row, hash columns
    // included; a value longer than 64 bytes is cut, so 31 of the 32 bytes of a hash are shown.
    const failing = text.split('\n').filter((line) => line.includes('Failing row contains') && line.includes(other.toString('hex').slice(0, 40)));
    expect(failing).toHaveLength(1);
    expect(failing[0]).toContain(`\\x${other.toString('hex').slice(0, 62)}...`);
    expect(failing[0]?.includes(other.toString('hex'))).toBe(false);
    // The same for the password table: the failing row shows the salt and the refused hash value.
    const credential = text.split('\n').filter((line) => line.includes('Failing row contains') && line.includes(badHash.toString('hex').slice(0, 40)));
    expect(credential).toHaveLength(1);
    expect(credential[0]).toContain('(OPR-002, argon2id, 19456, 2, 1, \\x07070707070707070707070707070707, \\x');
    // The three other hash columns behave the same: the DETAIL line carries the stored hash.
    for (const [column, value] of [['current_hash', credentialHash], ['next_hash', nextHash], ['token_hash', bioHash]] as const) {
      const lines = await appended(offset, value.toString('hex'), 1);
      expect(lines, column).toHaveLength(1);
      expect(lines[0], column).toContain(`DETAIL:  Key (${column})=(\\x${value.toString('hex')}) already exists.`);
    }
    // The foreign-key DETAIL names the missing key, an operator ID (not a secret).
    expect(text).toContain('DETAIL:  Key (operator_id)=(OPR-777) is not present in table "operators".');
    // The privilege refusal names the table and nothing else.
    expect(text).toContain('ERROR:  permission denied for table audit_log');

    console.info(
      `[w17] server log check: the made-up secret occurs 0 times in what the server appended; 7 STATEMENT lines, each with placeholders only; ` +
        `${mine.length} DETAIL line(s) carry a stored hash value:\n` +
        mine.map((line) => `  ${line.replace(/^.*?(DETAIL: {2})/, '$1').slice(0, 170)}`).join('\n'),
    );

    // The valid credential row was not changed by the refused UPDATE.
    const stored = await owner.query("SELECT octet_length(hash) AS bytes, hash = $1 AS unchanged FROM operator_credentials WHERE operator_id = 'OPR-002'", [
      operatorCredential('OPR-002')['hash'],
    ]);
    expect(stored.rows).toEqual([{ bytes: 32, unchanged: true }]);
  });
});
