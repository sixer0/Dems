#!/usr/bin/env node
// Asset of plan row W90 (verification/03_clean_state_rebuild.md). Read-only.
//
// Connects through the repository's own access path (scripts/pg/lib.mjs readConnectionFile +
// scripts/pg/db.mjs connect: 127.0.0.1:4432 only, PG* variables scrubbed) as dems_owner, the role
// the README names for create/migrate/seed/reset/tests. The owner file is opened inside this
// process; no value of it is printed, passed as an argument or exported. Never dems_admin.
//
// Usage (from the repository root, outside the command sandbox):
//   node <this file> settings            CPS1-9 log settings of the running cluster
//   node <this file> databases           database names only
//   node <this file> checksums dems_demo per-table row count + md5 over the rows in text order
import { OWNER_KEYS, projectPaths, readConnectionFile } from '../../../../scripts/pg/lib.mjs';
import { connect } from '../../../../scripts/pg/db.mjs';

const [mode, database = 'postgres'] = process.argv.slice(2);
const paths = projectPaths();
const owner = readConnectionFile(paths.ownerEnv, OWNER_KEYS);
if (owner.user !== 'dems_owner') throw new Error('the owner file does not name dems_owner');

const client = await connect({
  user: owner.user,
  password: owner.password,
  database: mode !== 'settings' && mode !== 'databases' ? database : 'postgres',
  appName: 'dems-w90-probe',
});
try {
  const who = (await client.query('select current_user, inet_server_addr()::text as addr, inet_server_port() as port, version() as v')).rows[0];
  console.log(`connected as ${who.current_user} to ${who.addr}:${who.port} (${who.v.split(' on ')[0]})`);
  if (mode === 'settings') {
    for (const name of [
      'log_error_verbosity',
      'logging_collector',
      'log_directory',
      'log_filename',
      'log_file_mode',
      'log_rotation_age',
      'log_rotation_size',
      'log_truncate_on_rotation',
      'listen_addresses',
      'port',
      'unix_socket_directories',
      'log_statement',
      'log_min_duration_statement',
    ]) {
      try {
        const row = (await client.query(`select setting, source from pg_settings where name = $1`, [name])).rows[0];
        const shown = (await client.query(`show ${name}`)).rows[0][name];
        console.log(`SHOW ${name.padEnd(26)} = ${JSON.stringify(shown)}  (source: ${row?.source ?? 'n/a'})`);
      } catch (error) {
        // dems_owner lacks pg_read_all_settings: the value is then read from postgresql.conf
        console.log(`SHOW ${name.padEnd(26)} = not visible to dems_owner (SQLSTATE ${error.code ?? '?'})`);
      }
    }
    try {
      const f = (await client.query('select pg_current_logfile() as f')).rows[0].f;
      console.log(`pg_current_logfile()          = ${JSON.stringify(f)}`);
    } catch (error) {
      console.log(`pg_current_logfile()          = not readable by this role (${error.code ?? error.message})`);
    }
  } else if (mode === 'databases') {
    const rows = (await client.query('select datname, pg_get_userbyid(datdba) as owner from pg_database order by datname')).rows;
    for (const r of rows) console.log(`database ${r.datname} (owner ${r.owner})`);
  } else if (mode === 'prefix') {
    // md5 over the append-only rows up to a sequence number: audit_log seq <= A, events seq <= E
    const [auditMax, eventMax] = process.argv.slice(4).map(Number);
    for (const [t, max] of [['audit_log', auditMax], ['events', eventMax]]) {
      const r = (
        await client.query(
          `select count(*)::int as n, md5(string_agg(x.t, E'\\n' order by x.t)) as h from (select (q.*)::text as t from public.${client.escapeIdentifier(t)} q where q.seq <= $1) x`,
          [max],
        )
      ).rows[0];
      console.log(`${t} seq <= ${max}: ${r.n} rows  ${r.h}`);
    }
  } else if (mode === 'columns') {
    // per-column md5 of a one-row-per-key table (values not printed); plain-text columns that are
    // counters or epochs are shown, since they are no secret: numbers and timestamps only
    for (const table of process.argv.slice(4)) {
      const cols = (
        await client.query(
          `select column_name, data_type from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`,
          [table],
        )
      ).rows;
      for (const { column_name: c, data_type: type } of cols) {
        const r = (
          await client.query(
            `select md5(string_agg(coalesce(${client.escapeIdentifier(c)}::text, '<null>'), E'\\n' order by ctid)) as h, max(${client.escapeIdentifier(c)}::text) as v from public.${client.escapeIdentifier(table)}`,
          )
        ).rows[0];
        const numeric = /integer|bigint|numeric|timestamp|boolean|smallint/.test(type);
        console.log(`${table}.${c.padEnd(28)} ${type.padEnd(26)} ${r.h}${numeric ? `  value ${r.v}` : ''}`);
      }
    }
  } else if (mode === 'tail') {
    // the audit rows after the seed (seq > 82) and the events after the seed: kind and actor only
    const audit = (await client.query(`select seq, type, actor_id from audit_log where seq > 82 order by seq`)).rows;
    for (const r of audit) console.log(`audit_log seq ${r.seq} ${r.type} actor ${r.actor_id ?? '-'}`);
    const cols = (
      await client.query(`select column_name from information_schema.columns where table_schema='public' and table_name='events' order by ordinal_position`)
    ).rows.map((r) => r.column_name);
    console.log(`events columns: ${cols.join(', ')}`);
    const typeCol = cols.find((c) => c === 'type' || c === 'kind' || c === 'event_type');
    const orderCol = cols.find((c) => c === 'seq' || c === 'id' || c === 'event_id') ?? cols[0];
    if (typeCol) {
      const ev = (await client.query(`select ${client.escapeIdentifier(orderCol)} as k, ${client.escapeIdentifier(typeCol)} as t from events order by 1 desc limit 4`)).rows;
      for (const r of ev) console.log(`events ${orderCol} ${r.k} ${typeCol} ${r.t}`);
    }
    for (const t of ['core_state', 'engine_counters', 'auth_sessions']) {
      const n = (await client.query(`select count(*)::int as n from public.${client.escapeIdentifier(t)}`)).rows[0].n;
      console.log(`${t}: ${n} row(s)`);
    }
  } else if (mode === 'checksums') {
    const tables = (
      await client.query(
        `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
      )
    ).rows.map((r) => r.table_name);
    let total = 0;
    for (const t of tables) {
      const r = (
        await client.query(
          `select count(*)::int as n, coalesce(md5(string_agg(x.t, E'\\n' order by x.t)), md5('')) as h from (select (q.*)::text as t from public.${client.escapeIdentifier(t)} q) x`,
        )
      ).rows[0];
      total += r.n;
      console.log(`${t.padEnd(24)} ${String(r.n).padStart(4)}  ${r.h}`);
    }
    console.log(`tables ${tables.length}; rows ${total}`);
  } else {
    throw new Error(`unknown mode ${mode}`);
  }
} finally {
  await client.end();
}
