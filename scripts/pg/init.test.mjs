// Tests of the provisioning steps that need no server: the ignore rule (CR-7), the data
// directory and the three credential files (RP-1, T-CR-1), the refusal to overwrite, the
// arguments of initdb (CR-4) and the settings block (NL-5). Everything runs in a temporary root.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { APP_KEYS, OWNER_KEYS, connectionFileKeys, projectPaths, readConnectionFile, readPwfile, redact } from './lib.mjs';
import {
  APP_ATTRIBUTES,
  CONF_BLOCK,
  OWNER_ATTRIBUTES,
  assertFreshTarget,
  assertIgnored,
  initdbArgs,
  prepareDataDir,
  writeCredentialFiles,
} from './init.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dems-pg-init-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function root(name) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  return projectPaths(dir);
}
const mode = (file) => (fs.statSync(file).mode & 0o777).toString(8);

test('CR-7: git ignores the cluster, the three credential files and the logs of the real workspace', () => {
  const result = assertIgnored(projectPaths());
  assert.equal(result.skipped, false);
  const matched = result.lines.map((line) => line.split('\t')[1]);
  assert.deepEqual(matched, ['.data/postgres', '.data/pg.pwfile', '.data/pg.owner.env', '.data/pg.env', '.data/postgres.log', '.data/pg-scripts.log']);
  assert.ok(result.lines.slice(0, 4).every((line) => line.startsWith('.gitignore:') && line.includes(':/.data/\t')));
});

test('CR-7: outside a git work tree the check is skipped, not failed', () => {
  assert.deepEqual(assertIgnored(root('no-git')), { skipped: true, lines: [] });
});

test('RP-1 and T-CR-1: .data/ has mode 700 and the three files mode 600, with the pinned keys', () => {
  const p = root('fresh');
  assertFreshTarget(p);
  prepareDataDir(p);
  assert.deepEqual(writeCredentialFiles(p), ['.data/pg.pwfile', '.data/pg.owner.env', '.data/pg.env']);
  assert.equal(mode(p.data), '700');
  assert.deepEqual([p.pwfile, p.ownerEnv, p.appEnv].map(mode), ['600', '600', '600']);
  assert.deepEqual(connectionFileKeys(p.ownerEnv), [...OWNER_KEYS]);
  assert.deepEqual(connectionFileKeys(p.appEnv), [...APP_KEYS]);

  const owner = readConnectionFile(p.ownerEnv, OWNER_KEYS, p.root);
  const app = readConnectionFile(p.appEnv, APP_KEYS, p.root);
  assert.deepEqual({ ...owner, password: undefined }, { host: '127.0.0.1', port: 4432, database: 'postgres', user: 'dems_owner', password: undefined });
  assert.deepEqual({ ...app, password: undefined }, { host: '127.0.0.1', port: 4432, database: 'dems_demo', user: 'dems_app', password: undefined });

  // Three different passwords, each at least 24 random bytes; the superuser file is one line.
  const admin = readPwfile(p.pwfile, p.root);
  assert.equal(fs.readFileSync(p.pwfile, 'utf8'), `${admin}\n`);
  const all = [admin, owner.password, app.password];
  assert.equal(new Set(all).size, 3);
  for (const password of all) {
    assert.ok(Buffer.from(password, 'base64url').length >= 24);
    assert.equal(redact(password), '[redacted]');
  }
});

test('a second run changes no credential file (CR-5)', () => {
  const p = root('twice');
  prepareDataDir(p);
  writeCredentialFiles(p);
  const before = [p.pwfile, p.ownerEnv, p.appEnv].map((file) => fs.readFileSync(file, 'utf8'));
  assert.deepEqual(writeCredentialFiles(p), []);
  assert.deepEqual([p.pwfile, p.ownerEnv, p.appEnv].map((file) => fs.readFileSync(file, 'utf8')), before);
  assert.throws(() => prepareDataDir(p), { code: 'EEXIST' });
});

test('pg:init refuses an existing cluster or an existing credential file and changes nothing', () => {
  const withCluster = root('has-cluster');
  fs.mkdirSync(withCluster.pgdata, { recursive: true });
  fs.writeFileSync(path.join(withCluster.pgdata, 'PG_VERSION'), '18\n');
  assert.throws(() => assertFreshTarget(withCluster), /refused: already provisioned, or partly provisioned \(\.data\/postgres\)\. Nothing was changed\./);

  const withFile = root('has-file');
  prepareDataDir(withFile);
  fs.writeFileSync(withFile.appEnv, 'kept\n', { mode: 0o600 });
  assert.throws(() => assertFreshTarget(withFile), /partly provisioned \(\.data\/pg\.env\)/);
  assert.equal(fs.readFileSync(withFile.appEnv, 'utf8'), 'kept\n');
});

test('initdb gets the superuser password as a file path, never as a value (CR-4, RP-2)', () => {
  const p = root('args');
  assert.deepEqual(initdbArgs(p), [
    '-D', path.join(p.root, '.data', 'postgres'),
    '-U', 'dems_admin',
    '-A', 'scram-sha-256',
    `--pwfile=${path.join(p.root, '.data', 'pg.pwfile')}`,
    '-E', 'UTF8',
    '--locale=C',
  ]);
});

test('the settings block names the loopback address, port 4432 and no Unix socket, and no logging setting (NL-5)', () => {
  const lines = CONF_BLOCK.split('\n').filter((line) => line !== '' && !line.startsWith('#'));
  assert.deepEqual(lines, ["listen_addresses = '127.0.0.1'", 'port = 4432', "unix_socket_directories = ''"]);
  assert.doesNotMatch(CONF_BLOCK, /log_|logging_collector/);
});

test('the owner role may create databases and is not a superuser; the runtime role has no flag', () => {
  assert.equal(OWNER_ATTRIBUTES, 'LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
  assert.equal(APP_ATTRIBUTES, 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
});
