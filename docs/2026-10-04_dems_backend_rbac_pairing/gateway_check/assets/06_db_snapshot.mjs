#!/usr/bin/env node
/**
 * Asset of plan row W58 (gateway_check/06_backend_gate.md) — items D and E.
 *
 * A read-only snapshot of `dems_demo` taken by the smoke run: the open sessions, the audit head,
 * and the rows the session sweeper writes. It prints aggregates and identifiers only — no token,
 * hash, credential or value of a credential file.
 *
 * Usage: node docs/.../gateway_check/assets/06_db_snapshot.mjs <label>
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const ROOT = '/Users/gsp-budi/Documents/DEMS';
const label = process.argv[2] ?? 'snapshot';

const values = {};
for (const line of readFileSync(`${ROOT}/.data/pg.env`, 'utf8').split('\n')) {
  const at = line.indexOf('=');
  if (at > 0) values[line.slice(0, at).trim()] = line.slice(at + 1).trim();
}

const pool = new pg.Pool({
  host: values.DEMS_PG_HOST,
  port: Number(values.DEMS_PG_PORT),
  database: values.DEMS_PG_DATABASE,
  user: values.DEMS_PG_APP_ROLE,
  password: values.DEMS_PG_APP_PASSWORD,
  max: 1,
  application_name: 'dems-w58-snapshot',
});
const client = await pool.connect();
try {
  const one = async (sql, params = []) => (await client.query(sql, params)).rows;
  const sessions = (await one(`select count(*)::int as open from auth_sessions where ended_at is null`))[0];
  const web = (await one(`select count(*)::int as n from auth_sessions where ended_at is null and device_id is null`))[0];
  const device = (await one(`select count(*)::int as n from auth_sessions where ended_at is null and device_id is not null`))[0];
  const head = (await one(`select coalesce(max(seq),0)::int as seq, count(*)::int as rows from audit_log`))[0];
  const byType = async (type) => (await one(`select count(*)::int as n from audit_log where type = $1`, [type]))[0].n;
  const expired = await one(
    `select seq, type, actor_id, coalesce(details->>'reason','-') as reason, at
       from audit_log where type = 'AUTH_EXPIRED' order by seq desc limit 6`,
  );
  console.log(
    `[${label}] open_sessions=${sessions.open} (web=${web.n}, device=${device.n}) | ` +
      `audit rows=${head.rows} head_seq=${head.seq} | ` +
      `ACCESS_DENIED=${await byType('ACCESS_DENIED')} AUTH_EXPIRED=${await byType('AUTH_EXPIRED')} ` +
      `AUTH_SUCCESS=${await byType('AUTH_SUCCESS')}`,
  );
  for (const row of expired) {
    console.log(`[${label}]   AUTH_EXPIRED seq=${row.seq} actor=${row.actor_id ?? 'null'} reason=${row.reason}`);
  }
} finally {
  client.release();
  await pool.end();
}
