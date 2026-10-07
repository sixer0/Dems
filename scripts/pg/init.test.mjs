// Tests of the provisioning steps that need no server: the ignore rule (CR-7), the data
// directory and the three credential files (RP-1, T-CR-1), the refusal to overwrite, the
// arguments of initdb (CR-4) and the settings block (NL-5; security ruling 14). Everything runs in
// a temporary root.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { APP_KEYS, OWNER_KEYS, assertClusterEndpoint, connectionFileKeys, projectPaths, readConnectionFile, readPwfile, readSettings, redact, run } from './lib.mjs';
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

test('the settings block names the loopback address, port 4432 and no Unix socket; of the logging settings only those of ruling 14 (NL-5)', () => {
  const lines = CONF_BLOCK.split('\n').filter((line) => line !== '' && !line.startsWith('#'));
  assert.deepEqual(lines, [
    "listen_addresses = '127.0.0.1'",
    'port = 4432',
    "unix_socket_directories = ''",
    'log_error_verbosity = terse',
    'logging_collector = on',
    "log_directory = 'log'",
    "log_filename = 'postgresql-%H.log'",
    'log_file_mode = 0600',
    'log_rotation_age = 1h',
    'log_rotation_size = 0',
    'log_truncate_on_rotation = on',
  ]);
  // WHAT is logged stays at the defaults (NL-5): no statement, duration or bind-parameter setting.
  assert.doesNotMatch(lines.join('\n'), /log_statement|log_min_duration|log_min_error_statement|log_parameter|log_min_messages|log_destination/);
});

test('ruling 14 (CPS1-9): errors are terse; the server log is a ring of 24 hourly files, each truncated when its hour comes round again', () => {
  const p = root('conf');
  fs.mkdirSync(p.pgdata, { recursive: true });
  fs.writeFileSync(path.join(p.pgdata, 'postgresql.conf'), CONF_BLOCK);
  // The project's own reader, the one pg:start's endpoint check uses, reads every line of the block.
  const settings = readSettings(p.pgdata);
  assert.doesNotThrow(() => assertClusterEndpoint(p.pgdata));
  // No DETAIL, HINT, QUERY or CONTEXT line: no failing row, no key value.
  assert.equal(settings.get('log_error_verbosity'), 'terse');
  // The bound: the collector writes into .data/postgres/log/ (inside the cluster directory, mode
  // 0700), under one strftime escape, the hour, so 24 names at most; a time-driven rotation every
  // hour truncates the file it opens.
  assert.equal(settings.get('logging_collector'), 'on');
  assert.equal(settings.get('log_directory'), 'log');
  assert.equal(settings.get('log_filename'), 'postgresql-%H.log');
  assert.deepEqual(settings.get('log_filename').match(/%./g), ['%H']);
  assert.equal(settings.get('log_rotation_age'), '1h');
  assert.equal(settings.get('log_truncate_on_rotation'), 'on');
  // Size-driven rotation is off: at its default (10MB) it would reopen the same hour file and
  // append, since truncation happens on time-driven rotation only.
  assert.equal(settings.get('log_rotation_size'), '0');
  assert.equal(settings.get('log_file_mode'), '0600');
});

test('PostgreSQL 18.4 reads the block as written: postgres -C on a folder that holds only this postgresql.conf (no server, no port)', () => {
  const dir = fs.mkdtempSync(path.join(tmp, 'conf-check-'));
  fs.writeFileSync(path.join(dir, 'postgresql.conf'), CONF_BLOCK, { mode: 0o600 });
  // -C prints the value the server would run with, in base units (minutes, kB, a decimal mode), and exits.
  const expected = {
    log_error_verbosity: 'terse',
    logging_collector: 'on',
    log_directory: 'log',
    log_filename: 'postgresql-%H.log',
    log_file_mode: String(0o600),
    log_rotation_age: '60',
    log_rotation_size: '0',
    log_truncate_on_rotation: 'on',
    // NL-5: these stay at the defaults.
    log_statement: 'none',
    log_min_duration_statement: '-1',
    log_parameter_max_length_on_error: '0',
  };
  for (const [name, value] of Object.entries(expected)) {
    const r = run(projectPaths().postgres, ['-D', dir, '-C', name]);
    assert.equal(r.status, 0, name);
    assert.equal(r.stdout.trim(), value, name);
  }
  assert.deepEqual(fs.readdirSync(dir), ['postgresql.conf']);
});

test('the owner role may create databases and is not a superuser; the runtime role has no flag', () => {
  assert.equal(OWNER_ATTRIBUTES, 'LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
  assert.equal(APP_ATTRIBUTES, 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
});
