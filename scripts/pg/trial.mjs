// The provisioning trial, role-provisioning step RP-5 (database contract 7.1; analysis TD-02).
// Every step runs as dems_owner, the role that is NOT a superuser, except T5-j, which
// check-superuser-trigger.mjs runs once as dems_admin. T5-f, T5-g and T5-i are statements that
// must be REFUSED: they prove what the owner role cannot do. The databases dems_trial_* exist
// only during the trial.
//
// Called by pg:init. Its own commands all run as dems_owner and never open the superuser's
// password file:
//   node scripts/pg/trial.mjs owner-steps  T5 and T5-a to T5-i again, without T5-j
//   node scripts/pg/trial.mjs t6-write     T6: create dems_trial_p and write one row
//   node scripts/pg/trial.mjs t6-read      T6: read the row, then drop dems_trial_p

import {
  APP_KEYS,
  DB_MAINTENANCE,
  OWNER_KEYS,
  PG_HOST,
  PG_PORT,
  PgScriptError,
  ROLE_APP,
  ROLE_OWNER,
  main,
  readConnectionFile,
  say,
} from './lib.mjs';
import { runSuperuserTriggerCheck } from './check-superuser-trigger.mjs';
import { connect } from './db.mjs';

const TRIAL_DATABASES = Object.freeze(['dems_trial_a', 'dems_trial_b', 'dems_trial_c', 'dems_trial_p']);

/** Collects the trial table and prints each step as it happens. */
export class Recorder {
  constructor(out = say) {
    this.rows = [];
    this.out = out;
  }

  /** verdict: 'PASS' | 'FAIL' | 'RECORDED' (not gating). */
  add(id, as, action, outcome, verdict) {
    this.rows.push({ id, as, action, outcome, verdict });
    this.out(`${id.padEnd(6)} ${verdict.padEnd(8)} [${as}] ${action.replace(/\s+/g, ' ')}`);
    this.out(`${' '.repeat(16)}-> ${outcome}`);
  }

  get failures() {
    return this.rows.filter((row) => row.verdict === 'FAIL');
  }
}

class TrialStop extends Error {}

async function accepted(rec, id, as, client, sql) {
  try {
    const r = await client.query(sql);
    rec.add(id, as, sql, `OK (${r.command})`, 'PASS');
    return r;
  } catch (error) {
    rec.add(id, as, sql, `ERROR, SQLSTATE ${error.code}: ${error.message}`, 'FAIL');
    throw new TrialStop(id);
  }
}

async function refused(rec, id, as, client, sql, sqlstate) {
  try {
    await client.query(sql);
    rec.add(id, as, sql, `accepted, but SQLSTATE ${sqlstate} was expected`, 'FAIL');
    return false;
  } catch (error) {
    rec.add(id, as, sql, `refused, SQLSTATE ${error.code}: ${error.message}`, error.code === sqlstate ? 'PASS' : 'FAIL');
    return error.code === sqlstate;
  }
}

async function databaseExists(client, name) {
  return (await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])).rowCount === 1;
}

async function dropIfExists(client, name) {
  if (!(await databaseExists(client, name))) return false;
  await client.query(`ALTER DATABASE ${name} WITH IS_TEMPLATE false`);
  await client.query(`DROP DATABASE ${name} WITH (FORCE)`);
  return true;
}

function ownerSession(paths, database, appName) {
  const creds = readConnectionFile(paths.ownerEnv, OWNER_KEYS, paths.root);
  return connect({ user: creds.user, password: creds.password, database, appName });
}

/** Trial steps T5 and T5-a to T5-j. Returns the recorder; a FAIL row means the trial failed.
 *  Only pg:init passes `superuserStep`: T5-j runs once, at provisioning. */
export async function runSqlTrial(paths, rec = new Recorder(), { superuserStep = false } = {}) {
  const asOwner = `${ROLE_OWNER}@${DB_MAINTENANCE}`;
  const owner = await ownerSession(paths, DB_MAINTENANCE, 'dems-pg-trial');
  try {
    for (const name of TRIAL_DATABASES) {
      if (await dropIfExists(owner, name)) say(`        (leftover ${name} of an earlier trial dropped)`);
    }

    // T5: the version, and proof of WHICH server answered.
    const who = (
      await owner.query(
        `SELECT version() AS version, current_user AS role, host(inet_server_addr()) AS addr, inet_server_port() AS port,
                (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser`,
      )
    ).rows[0];
    rec.add(
      'T5',
      asOwner,
      `SELECT version(), current_user, inet_server_addr(), inet_server_port() through the Node driver "pg" on Node ${process.versions.node}`,
      `${who.version} | role ${who.role}, superuser ${who.superuser} | server ${who.addr}:${who.port}`,
      who.version.startsWith('PostgreSQL 18.4') && who.addr === PG_HOST && who.port === PG_PORT && who.superuser === false
        ? 'PASS'
        : 'FAIL',
    );

    await accepted(rec, 'T5-a', asOwner, owner, `CREATE DATABASE dems_trial_a OWNER ${ROLE_OWNER} TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'`);
    await accepted(rec, 'T5-b', asOwner, owner, `CREATE DATABASE dems_trial_b TEMPLATE dems_trial_a OWNER ${ROLE_OWNER}`);

    // T5-c: two renames inside one transaction (the swap of the reset routine, DA-04).
    const swap = ['BEGIN', 'ALTER DATABASE dems_trial_b RENAME TO dems_trial_c', 'ALTER DATABASE dems_trial_c RENAME TO dems_trial_b', 'COMMIT'];
    try {
      for (const sql of swap) await owner.query(sql);
      const names = (await owner.query("SELECT datname FROM pg_database WHERE datname LIKE 'dems!_trial!_%' ESCAPE '!' ORDER BY 1")).rows.map((r) => r.datname);
      rec.add('T5-c', asOwner, `${swap.join('; ')};`, `OK; databases now: ${names.join(', ')}`, names.join(',') === 'dems_trial_a,dems_trial_b' ? 'PASS' : 'FAIL');
    } catch (error) {
      await owner.query('ROLLBACK').catch(() => {});
      rec.add('T5-c', asOwner, `${swap.join('; ')};`, `ERROR, SQLSTATE ${error.code}: ${error.message}`, 'FAIL');
      throw new TrialStop('T5-c');
    }

    await accepted(rec, 'T5-d', asOwner, owner, 'ALTER DATABASE dems_trial_a WITH IS_TEMPLATE true ALLOW_CONNECTIONS false');
    await accepted(rec, 'T5-d', asOwner, owner, 'ALTER DATABASE dems_trial_a WITH IS_TEMPLATE false ALLOW_CONNECTIONS true');
    await accepted(rec, 'T5-e', asOwner, owner, 'DROP DATABASE dems_trial_b');

    if (!(await refused(rec, 'T5-f', asOwner, owner, 'SET session_replication_role = replica', '42501'))) {
      await owner.query('RESET session_replication_role').catch(() => {});
    }
    if (!(await refused(rec, 'T5-g', asOwner, owner, 'CREATE ROLE dems_trial_role', '42501'))) {
      await owner.query('DROP ROLE IF EXISTS dems_trial_role').catch(() => {});
    }
    if (!(await refused(rec, 'T5-i', asOwner, owner, "ALTER SYSTEM SET log_statement = 'all'", '42501'))) {
      await owner.query('ALTER SYSTEM RESET log_statement').catch(() => {});
    }
    await refused(rec, 'T5-i', asOwner, owner, "ALTER DATABASE dems_trial_a SET log_statement = 'all'", '42501');

    // T5-j: once, as the bootstrap superuser; its session is closed before T5-h.
    if (superuserStep) {
      await runSuperuserTriggerCheck(paths, 'dems_trial_a', rec);
    } else {
      rec.add('T5-j', 'nobody', 'the superuser trigger check', 'not run: it runs once, at provisioning, inside pg:init', 'RECORDED');
    }

    // T5-h: recorded, not gating. One dems_app session is open on dems_trial_a.
    const appCreds = readConnectionFile(paths.appEnv, APP_KEYS, paths.root);
    const app = await connect({ user: appCreds.user, password: appCreds.password, database: 'dems_trial_a', appName: 'dems-pg-trial-app' });
    try {
      const seen = (await owner.query("SELECT datname, usename FROM pg_stat_activity WHERE datname = 'dems_trial_a'")).rows;
      rec.add(
        'T5-h',
        asOwner,
        "SELECT datname, usename FROM pg_stat_activity WHERE datname = 'dems_trial_a' (one dems_app session is open on it)",
        seen.length === 0 ? 'no row' : seen.map((r) => `(${r.datname}, ${r.usename})`).join(' '),
        seen.some((r) => r.usename === ROLE_APP) ? 'PASS' : 'RECORDED',
      );
      try {
        await owner.query('DROP DATABASE dems_trial_a WITH (FORCE)');
        const stillOpen = await app.query('SELECT 1').then(() => true, () => false);
        rec.add('T5-h', asOwner, 'DROP DATABASE dems_trial_a WITH (FORCE)', `OK: dropped; the dems_app session was ${stillOpen ? 'NOT ended' : 'ended by the server'}`, 'RECORDED');
      } catch (error) {
        rec.add('T5-h', asOwner, 'DROP DATABASE dems_trial_a WITH (FORCE)', `refused, SQLSTATE ${error.code}: ${error.message}`, 'RECORDED');
      }
    } finally {
      await app.end().catch(() => {});
    }
    if (await databaseExists(owner, 'dems_trial_a')) {
      await accepted(rec, 'T5-e', asOwner, owner, 'DROP DATABASE dems_trial_a');
    } else {
      rec.add('T5-e', asOwner, 'DROP DATABASE dems_trial_a', 'already dropped by T5-h', 'PASS');
    }

    const left = (await owner.query("SELECT datname FROM pg_database WHERE datname LIKE 'dems!_trial!_%' ESCAPE '!'")).rows;
    rec.add('T5-end', asOwner, 'trial databases left behind', left.length === 0 ? 'none' : left.map((r) => r.datname).join(', '), left.length === 0 ? 'PASS' : 'FAIL');
  } catch (error) {
    if (!(error instanceof TrialStop)) throw error;
    say(`        trial stopped at ${error.message}; the trial databases are left as evidence`);
  } finally {
    await owner.end().catch(() => {});
  }
  return rec;
}

/** The roles as pg_roles shows them: flags only. pg_roles never shows a password. */
export async function readRoles(paths) {
  const owner = await ownerSession(paths, DB_MAINTENANCE, 'dems-pg-roles');
  try {
    return (
      await owner.query(
        `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin
           FROM pg_roles WHERE rolname LIKE 'dems!_%' ESCAPE '!' ORDER BY rolname`,
      )
    ).rows;
  } finally {
    await owner.end().catch(() => {});
  }
}

const T6_TABLE = 'public.trial_persist';

async function t6Write(paths) {
  const admin = await ownerSession(paths, DB_MAINTENANCE, 'dems-pg-trial-t6');
  try {
    await dropIfExists(admin, 'dems_trial_p');
    await admin.query(`CREATE DATABASE dems_trial_p OWNER ${ROLE_OWNER} TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'`);
  } finally {
    await admin.end().catch(() => {});
  }
  const db = await ownerSession(paths, 'dems_trial_p', 'dems-pg-trial-t6');
  try {
    await db.query(`CREATE TABLE ${T6_TABLE} (id integer PRIMARY KEY, note text NOT NULL, written_at timestamptz NOT NULL DEFAULT now())`);
    const row = (await db.query(`INSERT INTO ${T6_TABLE} (id, note) VALUES (1, 'written before the stop') RETURNING id, note, written_at, pg_postmaster_start_time() AS server_started`)).rows[0];
    say(`T6 write [${ROLE_OWNER}@dems_trial_p]: row (${row.id}, '${row.note}') written at ${row.written_at.toISOString()}`);
    say(`   server process started at ${row.server_started.toISOString()}`);
  } finally {
    await db.end().catch(() => {});
  }
  return 0;
}

async function t6Read(paths) {
  let found = false;
  const db = await ownerSession(paths, 'dems_trial_p', 'dems-pg-trial-t6');
  try {
    const rows = (await db.query(`SELECT id, note, written_at, pg_postmaster_start_time() AS server_started FROM ${T6_TABLE}`)).rows;
    found = rows.length === 1 && rows[0].id === 1 && rows[0].written_at < rows[0].server_started;
    for (const row of rows) {
      say(`T6 read  [${ROLE_OWNER}@dems_trial_p]: row (${row.id}, '${row.note}') written at ${row.written_at.toISOString()}`);
      say(`   server process started at ${row.server_started.toISOString()} (${row.written_at < row.server_started ? 'after' : 'NOT after'} the row was written)`);
    }
  } finally {
    await db.end().catch(() => {});
  }
  const admin = await ownerSession(paths, DB_MAINTENANCE, 'dems-pg-trial-t6');
  try {
    await admin.query('DROP DATABASE dems_trial_p');
    say('   dems_trial_p dropped');
  } finally {
    await admin.end().catch(() => {});
  }
  say(`T6 ${found ? 'PASS: the row survived stop and start' : 'FAIL'}`);
  return found ? 0 : 1;
}

await main(import.meta.url, 'pg:trial', async (args, paths) => {
  say(`trial client -> ${PG_HOST}:${PG_PORT} as ${ROLE_OWNER}`);
  if (args[0] === 'owner-steps') return (await runSqlTrial(paths)).failures.length === 0 ? 0 : 1;
  if (args[0] === 't6-write') return t6Write(paths);
  if (args[0] === 't6-read') return t6Read(paths);
  throw new PgScriptError('usage: node scripts/pg/trial.mjs owner-steps | t6-write | t6-read   (the full trial, with T5-j, runs inside "npm run pg:init")', 2);
});
