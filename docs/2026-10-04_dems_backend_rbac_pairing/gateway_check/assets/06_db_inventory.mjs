#!/usr/bin/env node
/**
 * Asset of plan row W58 (gateway_check/06_backend_gate.md).
 *
 * Read-only inventory of the project's PostgreSQL cluster: the database names, their owner,
 * and how many databases start with a given run prefix. It prints names and counts only —
 * never a credential. The connection values are read from `.data/pg.env` (the runtime role
 * `dems_app`) and are never printed, logged or passed as an argument (P19).
 *
 * Usage: node gateway_check/assets/06_db_inventory.mjs [runPrefix]
 *   from /Users/gsp-budi/Documents/DEMS  (runPrefix e.g. dems_test_step_80_)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = '/Users/gsp-budi/Documents/DEMS';
const KEYS = ['DEMS_PG_HOST', 'DEMS_PG_PORT', 'DEMS_PG_DATABASE', 'DEMS_PG_APP_ROLE', 'DEMS_PG_APP_PASSWORD'];

const file = readFileSync(resolve(ROOT, '.data/pg.env'), 'utf8');
const values = {};
for (const line of file.split('\n')) {
  const at = line.indexOf('=');
  if (at < 0) continue;
  const key = line.slice(0, at).trim();
  if (KEYS.includes(key)) values[key] = line.slice(at + 1).trim();
}
if (values.DEMS_PG_PORT === '5432') throw new Error('refuses the foreign port');
if (values.DEMS_PG_HOST !== '127.0.0.1') throw new Error('refuses a non-loopback host');

const runPrefix = process.argv[2] ?? '';
const pool = new pg.Pool({
  host: values.DEMS_PG_HOST,
  port: Number(values.DEMS_PG_PORT),
  database: 'postgres',
  user: values.DEMS_PG_APP_ROLE,
  password: values.DEMS_PG_APP_PASSWORD,
  max: 1,
  application_name: 'dems-w58-inventory',
});

const client = await pool.connect();
try {
  const { rows } = await client.query(
    'select d.datname as name, r.rolname as owner from pg_database d join pg_roles r on r.oid = d.datdba order by d.datname',
  );
  const names = rows.map((row) => row.name);
  console.log(`role connected: ${values.DEMS_PG_APP_ROLE}  (values not printed)`);
  console.log(`databases in the cluster: ${names.length}`);
  for (const row of rows) {
    if (/^dems_test_/.test(row.name)) continue;
    console.log(`  ${row.name}  owner=${row.owner}`);
  }
  const testDbs = names.filter((n) => n.startsWith('dems_test_'));
  console.log(`databases with the prefix "dems_test_": ${testDbs.length}`);
  for (const name of testDbs) console.log(`  ${name}`);
  if (runPrefix !== '') {
    const mine = names.filter((n) => n.startsWith(runPrefix));
    console.log(`LEFTOVER databases of this run (prefix "${runPrefix}"): ${mine.length}`);
    for (const name of mine) console.log(`  ${name}`);
  }
} finally {
  client.release();
  await pool.end();
}
