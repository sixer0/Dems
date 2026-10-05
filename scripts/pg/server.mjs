// Server state, start and stop for the project-local PostgreSQL cluster (plan row W07).
// The process is started by pg_ctl and by nothing else: no Docker, no launchd job, no login
// item. It does not survive a reboot, by design (02_plan 14.1).

import fs from 'node:fs';

import {
  PG_HOST,
  PG_PORT,
  PgScriptError,
  assertBinaries,
  assertClusterEndpoint,
  assertEndpoint,
  hasCluster,
  logEvent,
  lsofListen,
  pidAlive,
  probeTcp,
  readPostmasterPid,
  rel,
  run,
  tail,
} from './lib.mjs';

/** Given to the server on its command line as well as in postgresql.conf, so that neither a
 *  later edit of the file nor an ALTER SYSTEM can open another interface, another port or a
 *  Unix socket. pg_ctl hands the string to /bin/sh, which turns '' into an empty value. */
export const SERVER_OPTIONS = `-c listen_addresses=${PG_HOST} -c port=${PG_PORT} -c unix_socket_directories=''`;

/** 'no-cluster' | 'stopped' | 'running'. A PID file whose process is gone, or whose port
 *  refuses a connection, counts as stopped. */
export async function serverState(paths, probe = probeTcp) {
  if (!hasCluster(paths)) return { state: 'no-cluster' };
  const pm = readPostmasterPid(paths.pgdata);
  if (!pm || !pidAlive(pm.pid)) return { state: 'stopped', stalePidFile: pm !== null };
  const tcp = await probe();
  if (tcp === 'closed') return { state: 'stopped', stalePidFile: true };
  return { state: 'running', tcp, ...pm };
}

/** A running server must be the one the project configured. */
export function assertLiveEndpoint(live) {
  assertEndpoint(live.listenAddr, live.port);
  if (live.socketDir !== '') {
    throw new PgScriptError(`refused: the running server has a Unix socket directory (${live.socketDir}).`);
  }
}

export async function startServer(paths) {
  assertBinaries(paths);
  if (!hasCluster(paths)) {
    throw new PgScriptError(`no cluster at ${rel(paths.pgdata, paths.root)}: run "npm run pg:init" first.`, 4);
  }
  assertClusterEndpoint(paths.pgdata);

  const before = await serverState(paths);
  if (before.state === 'running') {
    assertLiveEndpoint(before);
    fs.mkdirSync(paths.locks, { recursive: true });
    fs.writeFileSync(paths.pidFile, `${before.pid}\n`);
    return { started: false, pid: before.pid };
  }

  // The port must be free. lsof sees this user's processes; the connect probe sees anyone's.
  const lsof = lsofListen();
  const tcp = await probeTcp();
  if (lsof.lines.length > 0 || tcp === 'open') {
    throw new PgScriptError(
      `refused: ${PG_HOST}:${PG_PORT} is already in use by a process that is not this cluster. Not started.`,
    );
  }

  // The server log is created here with mode 0600 (CR-3) before pg_ctl appends to it.
  fs.closeSync(fs.openSync(paths.serverLog, 'a', 0o600));
  fs.chmodSync(paths.serverLog, 0o600);

  const r = run(paths.pgCtl, [
    '-D', paths.pgdata,
    '-l', paths.serverLog,
    '-w', '-t', '30',
    '-o', SERVER_OPTIONS,
    'start',
  ]);
  if (r.status !== 0) {
    throw new PgScriptError(
      `pg_ctl start failed (exit ${r.status}).\n${r.stdout}${r.stderr}` +
        `--- last lines of ${rel(paths.serverLog, paths.root)} ---\n${tail(paths.serverLog, 15)}`,
    );
  }

  const after = await serverState(paths);
  if (after.state !== 'running') {
    throw new PgScriptError(`pg_ctl reported a start, but no server is running (${after.state}).`);
  }
  assertLiveEndpoint(after);
  fs.mkdirSync(paths.locks, { recursive: true });
  fs.writeFileSync(paths.pidFile, `${after.pid}\n`);
  logEvent(paths, 'info', 'pg:start', 'server started', { pid: after.pid, host: PG_HOST, port: PG_PORT });
  return { started: true, pid: after.pid, output: r.stdout.trim() };
}

/** `pg_ctl -m fast -w stop` on the project's data directory only (rollback block RB-03). */
export async function stopServer(paths) {
  const before = await serverState(paths);
  if (before.state !== 'running') {
    fs.rmSync(paths.pidFile, { force: true });
    return { stopped: false, reason: before.state === 'no-cluster' ? 'no cluster' : 'no server running' };
  }
  assertBinaries(paths);
  const r = run(paths.pgCtl, ['-D', paths.pgdata, '-m', 'fast', '-w', '-t', '60', 'stop']);
  if (r.status !== 0) {
    throw new PgScriptError(`pg_ctl stop failed (exit ${r.status}).\n${r.stdout}${r.stderr}`);
  }
  fs.rmSync(paths.pidFile, { force: true });
  const after = await serverState(paths);
  if (after.state === 'running') {
    throw new PgScriptError(`pg_ctl reported a stop, but PID ${after.pid} still runs.`);
  }
  logEvent(paths, 'info', 'pg:stop', 'server stopped', { pid: before.pid });
  return { stopped: true, pid: before.pid, output: r.stdout.trim() };
}
