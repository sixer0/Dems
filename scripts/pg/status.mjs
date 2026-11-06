// npm run pg:status: is the project-local PostgreSQL server running, on the right endpoint, with
// the right files? Also runs the host-authentication check HA-1 to HA-4 (contract 7.6).
// It prints file names, modes, key names and PIDs. It never prints a credential.
//
// Exit code:  0  running, every check passed
//             1  a check failed (whether the server runs or not)
//             2  running as far as the PID and the files show, but this process is not allowed
//                to connect to 127.0.0.1:4432 (a command sandbox): HA-4 was not run. Run the
//                command outside the sandbox for the full answer.
//             3  not running, the file checks passed   (the convention of pg_ctl status)
//             4  no cluster: run "npm run pg:init"
//
// pg_ctl status is not used: inside a command sandbox it may not signal the server and then
// reports "no server running" for a server that runs. The state is read from postmaster.pid,
// from the PID and from a connect probe instead (server.mjs).

import fs from 'node:fs';
import path from 'node:path';

import {
  PG_HOST,
  PG_PORT,
  ROLE_APP,
  SCRUBBED_ENV_NAMES,
  assertClusterEndpoint,
  lsofListen,
  main,
  rel,
  reportKeyNames,
  reportModes,
  say,
} from './lib.mjs';
import { checkHbaFile, reportHba } from './check-hba.mjs';
import { wrongPasswordSqlState } from './db.mjs';
import { assertLiveEndpoint, serverState } from './server.mjs';

await main(import.meta.url, 'pg:status', async (_args, paths) => {
  if (SCRUBBED_ENV_NAMES.length > 0) {
    say(`ignored environment variables (names only): ${SCRUBBED_ENV_NAMES.join(', ')}`);
  }
  const state = await serverState(paths);
  if (state.state === 'no-cluster') {
    say(`pg:status: no cluster at ${rel(paths.pgdata, paths.root)}. Run "npm run pg:init".`);
    return 4;
  }
  let ok = true;
  let limited = false;
  const check = (label, fn) => {
    try {
      fn();
    } catch (error) {
      ok = false;
      say(`  FAIL ${label}: ${error.message}`);
    }
  };

  const running = state.state === 'running';
  say(`cluster    ${rel(paths.pgdata, paths.root)} (PG_VERSION ${fs.readFileSync(path.join(paths.pgdata, 'PG_VERSION'), 'utf8').trim()})`);
  check('configuration', () => {
    assertClusterEndpoint(paths.pgdata);
    say(`settings   listen_addresses = '${PG_HOST}', port = ${PG_PORT}, unix_socket_directories = '' (configuration files)`);
  });

  if (running) {
    say(`server     RUNNING, PID ${state.pid} (postmaster.pid: ${state.listenAddr}:${state.port}, status "${state.status}", connect probe: ${state.tcp})`);
    check('endpoint', () => assertLiveEndpoint(state));
    let recorded = null;
    try {
      recorded = Number(fs.readFileSync(paths.pidFile, 'utf8').trim());
    } catch {
      // no PID file
    }
    if (recorded !== state.pid) {
      ok = false;
      say(`  FAIL ${rel(paths.pidFile, paths.root)} holds ${recorded ?? 'nothing'}, the server's PID is ${state.pid}`);
    } else {
      say(`pid file   ${rel(paths.pidFile, paths.root)} = ${recorded}`);
    }
    const lsof = lsofListen();
    for (const line of lsof.lines) say(`listener   ${line}`);
    if (lsof.lines.length > 1 || lsof.lines.some((line) => !line.includes(`TCP ${PG_HOST}:${PG_PORT} (LISTEN)`))) {
      ok = false;
      say(`  FAIL the listener is not exactly one on ${PG_HOST}:${PG_PORT}`);
    }
  } else {
    say(`server     NOT RUNNING${state.stalePidFile ? ' (a stale postmaster.pid is present)' : ''}. Start it with "npm run pg:start".`);
  }

  say('host authentication (HA-1 to HA-4)');
  const hbaFile = path.join(paths.pgdata, 'pg_hba.conf');
  if (!reportHba(checkHbaFile(hbaFile), rel(hbaFile, paths.root))) ok = false;
  if (running && state.tcp !== 'open') {
    limited = true;
    say(`  HA-4 NOT RUN | this process may not connect to ${PG_HOST}:${PG_PORT} (connect probe: ${state.tcp}); run the command outside the sandbox`);
  } else if (running) {
    const sqlState = await wrongPasswordSqlState();
    const pass = sqlState === '28P01';
    if (!pass) ok = false;
    say(`  HA-4 ${pass ? 'PASS' : 'FAIL'} | a connection as ${ROLE_APP} with a wrong password: SQLSTATE ${sqlState}`);
  } else {
    say('  HA-4 not run (the server is stopped)');
  }

  say('file modes (expected 700 for directories, 600 for files)');
  if (!reportModes(paths)) ok = false;
  say('connection files (key names only)');
  if (!reportKeyNames(paths)) ok = false;

  if (!ok) {
    say('pg:status: a check FAILED');
    return 1;
  }
  if (limited) {
    say('pg:status: running by PID and files; the connection checks could not run from this process');
    return 2;
  }
  say(running ? 'pg:status: OK, running' : 'pg:status: stopped (file checks passed)');
  return running ? 0 : 3;
});
