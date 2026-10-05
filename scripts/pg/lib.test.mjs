// Tests of the shared library: the endpoint guard, the environment scrub, the secret guards and
// the credential loader (T-CR-4). No database, no network, no real .data/.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import {
  APP_KEYS,
  OWNER_KEYS,
  PG_HOST,
  PG_PORT,
  PgScriptError,
  ROOT,
  assertClusterEndpoint,
  assertEndpoint,
  assertNoSecret,
  childEnv,
  connectionFileKeys,
  connectionFileText,
  newPassword,
  pidAlive,
  projectPaths,
  readConnectionFile,
  readPostmasterPid,
  readSettings,
  redact,
  registerSecret,
  run,
  scrubPgEnv,
  writeSecretFile,
} from './lib.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dems-pg-lib-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** The seven variables the row names, built here so that no file of scripts/ spells them. */
const LIBPQ_NAMES = ['HOST', 'PORT', 'USER', 'DATABASE', 'PASSWORD', 'SERVICE', 'PASSFILE'].map((s) => `PG${s}`);

test('the endpoint is 127.0.0.1:4432 and nothing else', () => {
  assert.deepEqual(assertEndpoint('127.0.0.1', 4432), { host: PG_HOST, port: PG_PORT });
  assert.deepEqual(assertEndpoint('127.0.0.1', '4432'), { host: '127.0.0.1', port: 4432 });
});

test('port 5432 is refused and named as the other server of the host', () => {
  for (const port of [5432, '5432']) {
    assert.throws(() => assertEndpoint('127.0.0.1', port), (error) => {
      assert.ok(error instanceof PgScriptError);
      assert.match(error.message, /5432 is another PostgreSQL server on this host, not the project's/);
      return true;
    });
  }
});

test('any host other than 127.0.0.1 is refused', () => {
  for (const host of ['localhost', '0.0.0.0', '::1', '*', '', '127.0.0.2', '192.168.1.10', undefined, null]) {
    assert.throws(() => assertEndpoint(host, 4432), /is not 127\.0\.0\.1/, `host ${host}`);
  }
});

test('any port other than 4432 is refused', () => {
  for (const port of [4431, 0, '', undefined, '4432 ', 'x', 44320]) {
    assert.throws(() => assertEndpoint('127.0.0.1', port), /is not 4432/, `port ${port}`);
  }
});

test('the environment scrub removes every libpq variable and keeps the rest', () => {
  const env = { PATH: '/usr/bin', HOME: '/h', NOT_PGHOST: 'kept', PGDATA: '/elsewhere', PGOPTIONS: '-c x=y' };
  for (const name of LIBPQ_NAMES) env[name] = 'stray';
  const removed = scrubPgEnv(env);
  assert.deepEqual(removed, [...LIBPQ_NAMES, 'PGDATA', 'PGOPTIONS'].sort());
  assert.deepEqual(env, { PATH: '/usr/bin', HOME: '/h', NOT_PGHOST: 'kept' });
});

test('a child process never inherits a libpq variable, even one set after the module loaded', () => {
  for (const name of LIBPQ_NAMES) process.env[name] = name.endsWith('PORT') ? '5432' : 'stray';
  try {
    const env = childEnv();
    for (const name of LIBPQ_NAMES) assert.equal(name in env, false, name);
    const r = run(process.execPath, ['-e', 'process.stdout.write(Object.keys(process.env).filter((k) => /^PG/.test(k)).join(","))']);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  } finally {
    for (const name of LIBPQ_NAMES) delete process.env[name];
  }
});

test('the paths are the project data directory and the binaries under node_modules', () => {
  const p = projectPaths();
  assert.equal(p.pgdata, path.join(ROOT, '.data', 'postgres'));
  assert.equal(p.pidFile, path.join(ROOT, '.locks', 'postgres.pid'));
  assert.equal(p.lockFile, path.join(ROOT, '.locks', 'postgres.lock'));
  for (const file of [p.postgres, p.initdb, p.pgCtl]) {
    assert.ok(path.isAbsolute(file));
    assert.ok(file.startsWith(path.join(ROOT, 'node_modules', '@embedded-postgres') + path.sep), file);
  }
});

test('a password is at least 24 random bytes as base64url, and is never printed', () => {
  const a = newPassword();
  const b = newPassword();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(Buffer.from(a, 'base64url').length >= 24);
  assert.equal(redact(`before ${a} after`), 'before [redacted] after');
});

test('a secret is refused as a process argument and in a child environment (CR-4)', () => {
  const secret = registerSecret('S3cret-value-for-the-test');
  assert.throws(() => run('/usr/bin/true', ['--flag', `x=${secret}`]), /a secret would be placed in a process argument/);
  assert.throws(() => run('/usr/bin/true', [], { env: { PATH: '/usr/bin', X: secret } }), /a secret would be placed in a child environment/);
  assert.throws(() => assertNoSecret([`pre${secret}post`], 'a test'), PgScriptError);
  assert.equal(run('/usr/bin/true', ['--pwfile=/some/path']).status, 0);
});

test('a secret file is created exclusively with mode 600 and never overwritten (CR-5)', () => {
  const file = path.join(tmp, 'exclusive');
  writeSecretFile(file, 'first\n');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.throws(() => writeSecretFile(file, 'second\n'), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(file, 'utf8'), 'first\n');
});

function connectionFile(name, keys, values, mode = 0o600) {
  const file = path.join(tmp, name);
  fs.writeFileSync(file, connectionFileText(keys, values), { mode });
  fs.chmodSync(file, mode);
  return file;
}

test('a connection file holds the five pinned keys and nothing else (CR-1)', () => {
  const owner = connectionFile('owner.env', OWNER_KEYS, ['127.0.0.1', 4432, 'postgres', 'dems_owner', 'owner-password-value']);
  assert.deepEqual(connectionFileKeys(owner), ['DEMS_PG_HOST', 'DEMS_PG_PORT', 'DEMS_PG_DATABASE', 'DEMS_PG_OWNER_ROLE', 'DEMS_PG_OWNER_PASSWORD']);
  assert.deepEqual(readConnectionFile(owner, OWNER_KEYS, tmp), {
    host: '127.0.0.1', port: 4432, database: 'postgres', user: 'dems_owner', password: 'owner-password-value',
  });
  const app = connectionFile('app.env', APP_KEYS, ['127.0.0.1', 4432, 'dems_demo', 'dems_app', 'app-password-value']);
  assert.deepEqual(connectionFileKeys(app), ['DEMS_PG_HOST', 'DEMS_PG_PORT', 'DEMS_PG_DATABASE', 'DEMS_PG_APP_ROLE', 'DEMS_PG_APP_PASSWORD']);
  assert.equal(readConnectionFile(app, APP_KEYS, tmp).user, 'dems_app');
});

test('T-CR-4: a credential file with mode 644 stops the loader; the message names the file, not the content', () => {
  const file = connectionFile('loose.env', APP_KEYS, ['127.0.0.1', 4432, 'dems_demo', 'dems_app', 'value-that-must-not-leak'], 0o644);
  assert.throws(() => readConnectionFile(file, APP_KEYS, tmp), (error) => {
    assert.match(error.message, /^loose\.env has mode 644; expected 600/);
    assert.doesNotMatch(error.message, /value-that-must-not-leak/);
    return true;
  });
});

test('a connection file that names port 5432 or another host is refused', () => {
  const foreign = connectionFile('foreign.env', APP_KEYS, ['127.0.0.1', 5432, 'dems_demo', 'dems_app', 'pw-pw-pw-pw']);
  assert.throws(() => readConnectionFile(foreign, APP_KEYS, tmp), /5432 is another PostgreSQL server/);
  const named = connectionFile('named.env', APP_KEYS, ['localhost', 4432, 'dems_demo', 'dems_app', 'pw-pw-pw-pw']);
  assert.throws(() => readConnectionFile(named, APP_KEYS, tmp), /is not 127\.0\.0\.1/);
});

test('an extra key, a missing key, a duplicate or a malformed line is refused without printing a value', () => {
  const write = (name, text) => {
    const file = path.join(tmp, name);
    fs.writeFileSync(file, text, { mode: 0o600 });
    return file;
  };
  const good = connectionFileText(APP_KEYS, ['127.0.0.1', 4432, 'dems_demo', 'dems_app', 'hidden-value-1']);
  assert.throws(() => readConnectionFile(write('extra.env', `${good}EXTRA_KEY=hidden-value-2\n`), APP_KEYS, tmp), /extra\.env: unexpected key EXTRA_KEY$/);
  assert.throws(() => readConnectionFile(write('missing.env', good.split('\n').slice(0, 4).join('\n')), APP_KEYS, tmp), /missing\.env: key DEMS_PG_APP_PASSWORD is missing or empty$/);
  assert.throws(() => readConnectionFile(write('twice.env', `${good}DEMS_PG_PORT=4432\n`), APP_KEYS, tmp), /twice\.env: key DEMS_PG_PORT appears twice$/);
  assert.throws(() => readConnectionFile(write('bad.env', `${good}export hidden-value-3\n`), APP_KEYS, tmp), /bad\.env: line 6 is not KEY=value$/);
});

function fakeCluster(name, conf, autoConf) {
  const pgdata = path.join(tmp, name);
  fs.mkdirSync(pgdata, { recursive: true });
  fs.writeFileSync(path.join(pgdata, 'PG_VERSION'), '18\n');
  fs.writeFileSync(path.join(pgdata, 'postgresql.conf'), conf);
  if (autoConf !== undefined) fs.writeFileSync(path.join(pgdata, 'postgresql.auto.conf'), autoConf);
  return pgdata;
}

const GOOD_CONF = "max_connections = 100\t\t# (change requires restart)\n#port = 5432\nlisten_addresses = '127.0.0.1'\nport = 4432\nunix_socket_directories = ''\n";

test('the settings reader follows the server: the last assignment wins, the auto file overrides', () => {
  const settings = readSettings(fakeCluster('conf-good', `port = 5432\n${GOOD_CONF}datestyle = 'iso, mdy'\n`));
  assert.equal(settings.get('port'), '4432');
  assert.equal(settings.get('max_connections'), '100');
  assert.equal(settings.get('unix_socket_directories'), '');
  assert.equal(settings.get('datestyle'), 'iso, mdy');
  assert.equal(assertClusterEndpoint(fakeCluster('conf-good-2', GOOD_CONF, '# Do not edit this file manually!\n')).get('listen_addresses'), '127.0.0.1');
});

test('a cluster configured for port 5432, another address or a Unix socket is refused', () => {
  assert.throws(() => assertClusterEndpoint(fakeCluster('conf-5432', `${GOOD_CONF}port = 5432\n`)), /5432 is another PostgreSQL server/);
  assert.throws(() => assertClusterEndpoint(fakeCluster('conf-auto', GOOD_CONF, "port = '5432'\n")), /5432 is another PostgreSQL server/);
  assert.throws(() => assertClusterEndpoint(fakeCluster('conf-star', `${GOOD_CONF}listen_addresses = '*'\n`)), /is not 127\.0\.0\.1/);
  assert.throws(() => assertClusterEndpoint(fakeCluster('conf-localhost', "port = 4432\nunix_socket_directories = ''\n")), /is not 127\.0\.0\.1/);
  assert.throws(() => assertClusterEndpoint(fakeCluster('conf-socket', `${GOOD_CONF}unix_socket_directories = '/tmp'\n`)), /unix_socket_directories must be ''/);
  assert.throws(() => assertClusterEndpoint(fakeCluster('conf-nosocketline', "listen_addresses = '127.0.0.1'\nport = 4432\n")), /unix_socket_directories must be ''/);
  assert.throws(() => assertClusterEndpoint(fakeCluster('conf-include', `${GOOD_CONF}include = 'other.conf'\n`)), /directive include is not allowed/);
});

test('postmaster.pid is read by line; a missing file means no server', () => {
  const pgdata = fakeCluster('pidfile', GOOD_CONF);
  assert.equal(readPostmasterPid(pgdata), null);
  fs.writeFileSync(path.join(pgdata, 'postmaster.pid'), `${process.pid}\n${pgdata}\n1791000000\n4432\n\n127.0.0.1\n  4432001     65536\nready   \n`);
  assert.deepEqual(readPostmasterPid(pgdata), { pid: process.pid, dataDir: pgdata, port: 4432, socketDir: '', listenAddr: '127.0.0.1', status: 'ready' });
  assert.equal(pidAlive(process.pid), true);
  assert.equal(pidAlive(0), false);
  assert.equal(pidAlive(Number.NaN), false);
});
