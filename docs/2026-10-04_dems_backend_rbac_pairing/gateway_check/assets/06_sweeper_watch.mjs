#!/usr/bin/env node
/**
 * Asset of plan row W58 (gateway_check/06_backend_gate.md) — item E.
 *
 * The session sweeper of a listening Core server has no log line of its own: it says what it did
 * through the database (one `AUTH_EXPIRED` row per session it ends) and says nothing when there is
 * nothing to end. This watch observes the sweep directly, from outside, by sampling
 * `pg_stat_activity` as fast as one connection can: it counts the moments when the server's own
 * connection (application_name `dems-core-server`, the runtime role) is running the sweep's read
 * statement `SELECT 1 AS found FROM public.auth_sessions …`.
 *
 * It prints counts and instants only: no credential, no parameter value.
 *
 * Usage: node docs/.../gateway_check/assets/06_sweeper_watch.mjs <seconds>
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const ROOT = '/Users/gsp-budi/Documents/DEMS';
const seconds = Number(process.argv[2] ?? '25');

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
  application_name: 'dems-w58-sweeper-watch',
});
const client = await pool.connect();

const WATCH =
  `select count(*)::int as sweep_reads, count(*) filter (where state <> 'idle')::int as busy ` +
  `from pg_stat_activity where application_name = 'dems-core-server'`;

const started = Date.now();
let samples = 0;
let sightings = 0;
const moments = [];
let serverConnections = 0;

while (Date.now() - started < seconds * 1000) {
  const { rows } = await client.query(WATCH);
  samples += 1;
  serverConnections = Math.max(serverConnections, Number(rows[0].sweep_reads));
  if (Number(rows[0].busy) > 0) {
    // One more query only when something is running: name the statement, never its parameters.
    const detail = await client.query(
      `select left(query, 60) as head from pg_stat_activity
         where application_name = 'dems-core-server' and state <> 'idle'`,
    );
    const head = detail.rows[0]?.head ?? '';
    if (head.includes('FROM public.auth_sessions')) {
      sightings += 1;
      moments.push(new Date().toISOString().slice(11, 23));
    }
  }
}

console.log(
  `[sweeper-watch] seconds=${seconds} samples=${samples} ` +
    `server_connections_seen=${serverConnections} ` +
    `sweep_reads_observed=${sightings}`,
);
console.log(`[sweeper-watch] instants of the sweep read: ${moments.slice(0, 12).join(', ') || 'none caught'}`);
client.release();
await pool.end();