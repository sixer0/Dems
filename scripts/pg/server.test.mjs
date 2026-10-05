// A script refuses to run when its resolved port is 5432 or its host is not 127.0.0.1
// (decision D26, finding F27). The start routine is called here with stand-in binaries that
// leave a marker file when they are executed: the refusal must come before any of them runs.
// No server is started, no port is bound, no network is touched.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { projectPaths } from './lib.mjs';
import { SERVER_OPTIONS, assertLiveEndpoint, serverState, startServer, stopServer } from './server.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dems-pg-server-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function workspace(name, conf) {
  const root = path.join(tmp, name);
  const bin = path.join(root, 'bin');
  const marker = path.join(root, 'binary-was-run');
  fs.mkdirSync(bin, { recursive: true });
  const overrides = { bin };
  for (const [key, file] of [['postgres', 'postgres'], ['initdb', 'initdb'], ['pgCtl', 'pg_ctl']]) {
    overrides[key] = path.join(bin, file);
    fs.writeFileSync(overrides[key], `#!/bin/sh\necho run >> "${marker}"\nexit 0\n`, { mode: 0o755 });
  }
  const p = projectPaths(root, overrides);
  if (conf !== null) {
    fs.mkdirSync(p.pgdata, { recursive: true });
    fs.writeFileSync(path.join(p.pgdata, 'PG_VERSION'), '18\n');
    fs.writeFileSync(path.join(p.pgdata, 'postgresql.conf'), conf);
  }
  return { p, marker };
}

const base = "listen_addresses = '127.0.0.1'\nport = 4432\nunix_socket_directories = ''\n";

test('pg:start refuses a cluster whose port is 5432, before pg_ctl is run', async () => {
  const { p, marker } = workspace('port-5432', `${base}port = 5432\n`);
  await assert.rejects(startServer(p), /refused: port 5432 is another PostgreSQL server on this host, not the project's/);
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.existsSync(p.pidFile), false);
  assert.equal(fs.existsSync(p.serverLog), false);
});

test('pg:start refuses a cluster whose host is not 127.0.0.1, before pg_ctl is run', async () => {
  for (const [name, host] of [['host-star', '*'], ['host-localhost', 'localhost'], ['host-any', '0.0.0.0'], ['host-v6', '::1'], ['host-lan', '192.168.1.20']]) {
    const { p, marker } = workspace(name, `${base}listen_addresses = '${host}'\n`);
    await assert.rejects(startServer(p), /is not 127\.0\.0\.1/, host);
    assert.equal(fs.existsSync(marker), false, host);
  }
});

test('pg:start refuses a cluster with a Unix socket directory or without the project settings', async () => {
  const socket = workspace('socket', `${base}unix_socket_directories = '/tmp'\n`);
  await assert.rejects(startServer(socket.p), /unix_socket_directories must be ''/);
  assert.equal(fs.existsSync(socket.marker), false);
  // The file as initdb leaves it: every setting commented out, so the defaults (localhost, 5432) apply.
  const defaults = workspace('defaults', "#listen_addresses = 'localhost'\n#port = 5432\n");
  await assert.rejects(startServer(defaults.p), /refused/);
  assert.equal(fs.existsSync(defaults.marker), false);
});

test('pg:start without a cluster stops with exit code 4 and runs nothing', async () => {
  const { p, marker } = workspace('no-cluster', null);
  await assert.rejects(startServer(p), (error) => {
    assert.equal(error.exitCode, 4);
    assert.match(error.message, /no cluster at \.data\/postgres: run "npm run pg:init" first/);
    return true;
  });
  assert.equal(fs.existsSync(marker), false);
});

test('pg:stop is a no-op without a cluster or without a server, and runs nothing', async () => {
  const none = workspace('stop-none', null);
  assert.deepEqual(await stopServer(none.p), { stopped: false, reason: 'no cluster' });
  const idle = workspace('stop-idle', base);
  assert.deepEqual(await stopServer(idle.p), { stopped: false, reason: 'no server running' });
  assert.equal(fs.existsSync(none.marker) || fs.existsSync(idle.marker), false);
});

test('the server state is read from the cluster files; a dead PID or a refused port is "stopped"', async () => {
  const { p } = workspace('state', base);
  assert.deepEqual(await serverState(p), { state: 'stopped', stalePidFile: false });
  const pidFile = (pid) => fs.writeFileSync(path.join(p.pgdata, 'postmaster.pid'), `${pid}\n${p.pgdata}\n1791000000\n4432\n\n127.0.0.1\n  4432001 65536\nready   \n`);
  pidFile(2147483646);
  assert.deepEqual(await serverState(p), { state: 'stopped', stalePidFile: true });
  pidFile(process.pid);
  assert.deepEqual(await serverState(p, async () => 'closed'), { state: 'stopped', stalePidFile: true });
  const live = await serverState(p, async () => 'open');
  assert.equal(live.state, 'running');
  assert.deepEqual([live.pid, live.listenAddr, live.port, live.socketDir], [process.pid, '127.0.0.1', 4432, '']);
});

test('a running server on another port, another address or with a socket directory is refused', () => {
  assert.doesNotThrow(() => assertLiveEndpoint({ listenAddr: '127.0.0.1', port: 4432, socketDir: '' }));
  assert.throws(() => assertLiveEndpoint({ listenAddr: '127.0.0.1', port: 5432, socketDir: '' }), /5432 is another PostgreSQL server/);
  assert.throws(() => assertLiveEndpoint({ listenAddr: '*', port: 4432, socketDir: '' }), /is not 127\.0\.0\.1/);
  assert.throws(() => assertLiveEndpoint({ listenAddr: '127.0.0.1', port: 4432, socketDir: '/tmp' }), /Unix socket directory/);
});

test('the server command line pins the endpoint as well', () => {
  assert.equal(SERVER_OPTIONS, "-c listen_addresses=127.0.0.1 -c port=4432 -c unix_socket_directories=''");
});
