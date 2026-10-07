// PostgreSQL behaviours the database contract relies on (§1.9), where no other test of this row
// already exercises them: PG-10, PG-11, PG-13, PG-15, PG-16, PG-19, PG-27; and the server-log
// check of plan row W17 (contract §5.4 NL-3, §7.6; finding F-2 of the test-helper row).
//
// THE LOG CHECK reads the logging collector's current file, `.data/postgres/log/postgresql-HH.log`
// (mode 0600), which `.data/postgres/current_logfiles` names (security ruling 14, CPS1-9: terse
// errors and a ring of 24 hourly files, set by scripts/pg/init.mjs). Across an hour boundary it
// reads the rest of the first file and the new file from its start. `.data/postgres.log`, the file
// of `pg_ctl -l`, only holds what is written before the collector starts. The check reads only what
// the server appended while this file's statements ran, searches it for marker values that this
// test made up (random per run), and prints counts only. Nothing in PostgreSQL's configuration is
// changed.
import { randomBytes } from 'node:crypto';
import { closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
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

describe('PG-16 and the server log: what a refused statement writes into the collector file (ruling 14)', () => {
  const clusterDir = (): string => join(db.run.dataDir, 'postgres');
  /** The file of `pg_ctl -l`: what the server writes before the collector starts. */
  const bootLog = (): string => join(db.run.dataDir, 'postgres.log');

  /** The collector's current file. `current_logfiles` holds one line per destination, here `stderr log/postgresql-HH.log`. */
  function currentLogFile(): string {
    const line = readFileSync(join(clusterDir(), 'current_logfiles'), 'utf8')
      .split('\n')
      .find((entry) => entry.startsWith('stderr '));
    if (line === undefined) throw new Error('current_logfiles names no stderr file: is the logging collector on?');
    return join(clusterDir(), line.slice('stderr '.length).trim());
  }

  interface LogMark {
    readonly file: string;
    readonly offset: number;
  }

  function mark(): LogMark {
    const file = currentLogFile();
    return { file, offset: statSync(file).size };
  }

  function readSegment(file: string, offset: number): string {
    const size = statSync(file).size;
    const length = Math.max(0, size - offset);
    const buffer = Buffer.alloc(length);
    const descriptor = openSync(file, 'r');
    try {
      readSync(descriptor, buffer, 0, length, offset);
    } finally {
      closeSync(descriptor);
    }
    return buffer.toString('utf8');
  }

  /** What the server appended since `start`. Across an hour boundary: the rest of the first file, then the new file from 0. */
  function readFrom(start: LogMark): string {
    const now = currentLogFile();
    return now === start.file ? readSegment(start.file, start.offset) : readSegment(start.file, start.offset) + readSegment(now, 0);
  }

  /** The lines appended since `start` that `match` accepts, once `expected` of them exist (the collector writes with a delay). */
  async function appended(start: LogMark, match: (line: string) => boolean, expected: number): Promise<string[]> {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const lines = readFrom(start).split('\n').filter(match);
      if (lines.length >= expected) return lines;
      await sleep(10);
    }
    return readFrom(start).split('\n').filter(match);
  }

  it('what is logged stays at the NL-5 defaults, errors are terse (ruling 14); the settings that decide it can be changed by a superuser only', async () => {
    const { rows } = await app.query(
      "SELECT name, setting, context FROM pg_settings WHERE name IN ('log_statement', 'log_min_duration_statement', 'log_parameter_max_length_on_error', 'log_min_error_statement', 'log_error_verbosity', 'log_parameter_max_length') ORDER BY 1",
    );
    expect(rows).toEqual([
      // Ruling 14 (CPS1-9): no DETAIL, HINT, QUERY or CONTEXT line, so no failing row and no key value.
      { name: 'log_error_verbosity', setting: 'terse', context: 'superuser' },
      { name: 'log_min_duration_statement', setting: '-1', context: 'superuser' },
      { name: 'log_min_error_statement', setting: 'error', context: 'superuser' },
      { name: 'log_parameter_max_length', setting: '-1', context: 'superuser' },
      // Any role may set this one for its own session; no program of the project does (NL-5).
      { name: 'log_parameter_max_length_on_error', setting: '0', context: 'user' },
      { name: 'log_statement', setting: 'none', context: 'superuser' },
    ]);
    for (const pool of [app, owner]) {
      await expectRefused(() => pool.query("SET log_statement = 'all'"), SQLSTATE.insufficientPrivilege);
      // No role of the project can bring the DETAIL lines back for its own session.
      await expectRefused(() => pool.query('SET log_error_verbosity = verbose'), SQLSTATE.insufficientPrivilege);
      await expectRefused(() => pool.query('SET log_error_verbosity = default'), SQLSTATE.insufficientPrivilege);
      await expectRefused(() => pool.query('SET log_min_duration_statement = 0'), SQLSTATE.insufficientPrivilege);
    }
  });

  it('a failed statement is logged with $n, never with its bind values; terse errors leave no DETAIL line, so no hash value reaches the log', async () => {
    const start = mark();
    // The collector's file is the ring of ruling 14: log/postgresql-HH.log, mode 0600.
    expect(start.file.slice(clusterDir().length + 1)).toMatch(/^log\/postgresql-\d{2}\.log$/);
    expect(statSync(start.file).mode & 0o777).toBe(0o600);
    expect(statSync(join(clusterDir(), 'current_logfiles')).mode & 0o777).toBe(0o600);
    const bootOffset = statSync(bootLog()).size;
    // Markers of this run. The "secret" is what a token would be; the database only ever gets its SHA-256.
    const secret = `ses_w17-log-check-${randomBytes(18).toString('hex')}`;
    const tokenHash = sha256(secret);
    const hex = tokenHash.toString('hex');
    // A comment that travels with this test's statements, so that its STATEMENT lines can be told
    // from those of other rows that test at the same time.
    const tag = `/* w17-log-${randomBytes(6).toString('hex')} */`;
    const insert = `${tag} INSERT INTO auth_sessions (token_hash, operator_id, method, issued_at, last_seen_at, absolute_expires_at) VALUES ($1, $2, $3, $4, $4, $5)`;

    // 1. Accepted statements leave no trace.
    await app.query(insert, [tokenHash, 'OPR-002', 'PASSWORD', T, T + 1]);
    // 2. A unique violation on a hash column (23505): the same token hash again.
    await expectRefused(() => app.query(insert, [tokenHash, 'OPR-002', 'PASSWORD', T, T + 1]), SQLSTATE.uniqueViolation, 'auth_sessions_token_hash_key');
    // 3. A CHECK violation on a table with a hash column (23514).
    const other = sha256(`${secret}:second`);
    await expectRefused(() => app.query(insert, [other, 'OPR-002', 'PASSWORD', T, T - 1]), SQLSTATE.checkViolation, 'auth_sessions_times_check');
    // 4. A foreign-key violation (23503) with an operator ID that does not exist (untagged statement).
    await expectRefused(() => insertRow(app, 'auth_sessions', authSession(`${secret}:third`, { operator_id: 'OPR-777' })), SQLSTATE.foreignKeyViolation);
    // 5. A refusal by privilege (42501) names the table only.
    await expectRefused(() => app.query(`${tag} UPDATE audit_log SET message = $1 WHERE seq = $2`, [`marker-${hex}`, 1]), SQLSTATE.insufficientPrivilege);
    // 6. The re-hash of a password (SR-06) with a value the CHECK refuses.
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

    // Wait until the collector has written all seven tagged STATEMENT lines, then take the whole window.
    const statements = await appended(start, (line) => line.includes('STATEMENT:') && line.includes(tag), 7);
    const text = readFrom(start);
    const lines = text.split('\n');
    const markers = [tokenHash, other, badHash, credentialHash, nextHash, bioHash].map((value) => value.toString('hex').slice(0, 40));
    const mine = lines.filter((line) => markers.some((marker) => line.includes(marker)));

    // The secret itself never reached the server, so it cannot be in its log.
    expect(text.includes(secret)).toBe(false);
    // The STATEMENT lines show placeholders only (finding F-4 of W90: terse keeps one per error).
    // Seven of this test's tagged statements were refused; the accepted ones left no line.
    expect(statements).toHaveLength(7);
    expect(statements.filter((line) => line.endsWith('VALUES ($1, $2, $3, $4, $4, $5)'))).toHaveLength(2);
    expect(statements.filter((line) => line.endsWith('UPDATE audit_log SET message = $1 WHERE seq = $2'))).toHaveLength(1);
    expect(statements.filter((line) => line.endsWith('UPDATE operator_credentials SET hash = $1, hashed_at = $2 WHERE operator_id = $3'))).toHaveLength(1);
    for (const line of statements) expect(/[0-9a-f]{40}/.test(line.replace(tag, ''))).toBe(false);
    // The bind value of the refused UPDATE (which carried the hash as a marker text) is not logged.
    expect(text.includes(`marker-${hex}`)).toBe(false);

    // Ruling 14, the findings of the default verbosity inverted: no session can raise the verbosity
    // (superuser only, test above), so no line of the window, from any test, is a DETAIL line.
    expect(lines.filter((line) => line.includes('DETAIL:'))).toHaveLength(0);
    expect(lines.filter((line) => line.includes('Failing row contains'))).toHaveLength(0);
    expect(lines.filter((line) => line.includes('Key ('))).toHaveLength(0);
    // No line carries a hash value of this test, and the missing operator ID is not named either.
    expect(mine).toHaveLength(0);
    expect(text.includes('OPR-777')).toBe(false);

    // Each tagged STATEMENT line directly follows its own ERROR line (same backend), and that ERROR line
    // names the constraint or the table: the message stays, nothing sits between the two.
    const pid = (line: string): string | undefined => /\[(\d+)\]/.exec(line)?.[1];
    const errors = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.includes('STATEMENT:') && line.includes(tag))
      .map(({ line, index }) => {
        const before = lines[index - 1] ?? '';
        expect(pid(before), 'ERROR and STATEMENT from one backend').toBe(pid(line));
        return before.slice(before.indexOf('ERROR:  ') + 'ERROR:  '.length);
      });
    expect([...errors].sort()).toEqual(
      [
        'duplicate key value violates unique constraint "auth_sessions_token_hash_key"',
        'new row for relation "auth_sessions" violates check constraint "auth_sessions_times_check"',
        'permission denied for table audit_log',
        'new row for relation "operator_credentials" violates check constraint "operator_credentials_lengths_check"',
        'duplicate key value violates unique constraint "device_credentials_current_hash_key"',
        'duplicate key value violates unique constraint "device_credentials_next_hash_key"',
        'duplicate key value violates unique constraint "biometric_tokens_token_hash_key"',
      ].sort(),
    );
    // The untagged foreign-key refusal: the ERROR line names the constraint, not the key value.
    expect(text).toContain('ERROR:  insert or update on table "auth_sessions" violates foreign key constraint "auth_sessions_operator_id_fkey"');

    // The file of pg_ctl -l received none of it: the collector owns the server log.
    expect(readSegment(bootLog(), bootOffset).split('\n').filter((line) => line.includes(tag))).toHaveLength(0);

    console.info(
      `[w17] server log check (${start.file.slice(clusterDir().length + 1)}): the made-up secret occurs 0 times in what the server appended; ` +
        `${statements.length} STATEMENT lines, each with placeholders only; ${errors.length} ERROR lines naming the constraint or table; ` +
        `${mine.length} line(s) carry a hash value of this test; 0 DETAIL lines (terse, ruling 14).`,
    );

    // The valid credential row was not changed by the refused UPDATE.
    const stored = await owner.query("SELECT octet_length(hash) AS bytes, hash = $1 AS unchanged FROM operator_credentials WHERE operator_id = 'OPR-002'", [
      operatorCredential('OPR-002')['hash'],
    ]);
    expect(stored.rows).toEqual([{ bytes: 32, unchanged: true }]);
  });
});
