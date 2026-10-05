// Client connections of scripts/pg/. Every connection goes to 127.0.0.1:4432 over TCP: host
// and port are constants and are passed explicitly, so no default and no environment variable
// can point a script at the other PostgreSQL server of this host (decision D26, finding F27).

import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';

import { PG_HOST, PG_PORT, ROLE_APP, DB_MAINTENANCE, assertEndpoint } from './lib.mjs';

/** Opens one session. `pg` is loaded here, so that the removal scripts work without it. */
export async function connect({ user, password, database, appName = 'dems-pg-scripts' }) {
  const { host, port } = assertEndpoint(PG_HOST, PG_PORT);
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    host,
    port,
    user,
    password,
    database,
    ssl: false,
    application_name: appName,
    connectionTimeoutMillis: 5000,
  });
  // A session that the server ends (DROP DATABASE ... WITH (FORCE), a stop) must not crash the script.
  client.on('error', () => {});
  await client.connect();
  return client;
}

/** The SCRAM-SHA-256 verifier PostgreSQL stores for a password (RFC 5802, RFC 7677; the form
 *  of pg_authid.rolpassword). CREATE ROLE ... PASSWORD '<verifier>' stores it as it is, so the
 *  clear password never travels in a statement and cannot reach the server log. */
export function scramVerifier(password, salt = randomBytes(16), iterations = 4096) {
  const salted = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const clientKey = createHmac('sha256', salted).update('Client Key').digest();
  const storedKey = createHash('sha256').update(clientKey).digest();
  const serverKey = createHmac('sha256', salted).update('Server Key').digest();
  return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`;
}

/** HA-4 and trial step T3-b: a connection as dems_app with a wrong password. Returns the
 *  SQLSTATE of the refusal (expected 28P01), or 'ACCEPTED' if the server let it in. */
export async function wrongPasswordSqlState() {
  try {
    const client = await connect({
      user: ROLE_APP,
      password: `wrong-${randomBytes(12).toString('base64url')}`,
      database: DB_MAINTENANCE,
      appName: 'dems-pg-ha4',
    });
    await client.end();
    return 'ACCEPTED';
  } catch (error) {
    return error.code ?? `NO_SQLSTATE (${error.message})`;
  }
}
