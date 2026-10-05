// Static checks over scripts/ and every package manifest (AC-B-86, SR-77; database contract 7.6,
// test T-CR-2 (b), for the part this row owns): no secret in a process argument or an npm
// script, no environment file option, no sourcing of a file under the data directory, no
// exported libpq password, no connection URL with a user part. Also: the superuser's password
// file is read in two places only, child processes are started in one place only, and nothing
// names port 5432 as a place to connect to.
//
// The search words are assembled from pieces, so that this file does not match itself.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { ROOT } from './lib.mjs';

const SCRIPTS = path.join(ROOT, 'scripts');
const HERE = path.join(SCRIPTS, 'pg');

function filesUnder(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

function manifests() {
  const out = [path.join(ROOT, 'package.json')];
  for (const group of ['apps', 'packages']) {
    const dir = path.join(ROOT, group);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name, 'package.json');
      if (entry.isDirectory() && fs.existsSync(file)) out.push(file);
    }
  }
  return out;
}

const read = (file) => fs.readFileSync(file, 'utf8');
const short = (file) => path.relative(ROOT, file);

const FORBIDDEN = [
  ['the libpq password variable', new RegExp('PG' + 'PASSWORD')],
  ['a connection URL variable', new RegExp('DATABASE' + '_URL')],
  ['an environment-file option', new RegExp('--env' + '-file')],
  ['a connection URL with a user part', new RegExp('postgres(?:ql)?:' + '//[^\\s/\'"`]*@')],
  ['sourcing a file under the data directory', new RegExp('(?:^|[\\s;&|(])(?:sou' + 'rce|\\.)[ \\t]+\\S*\\.da' + 'ta/', 'm')],
  ['a password prompt or a password option of a PostgreSQL tool', new RegExp('--pw' + 'prompt|--pass' + 'word[= ]')],
];

test('scripts/ and the manifests hold no secret-carrying construct (T-CR-2 b, AC-B-86)', () => {
  const targets = [...filesUnder(SCRIPTS), ...manifests()];
  assert.ok(targets.length >= 15, `only ${targets.length} files found`);
  const hits = [];
  for (const file of targets) {
    const text = read(file);
    for (const [what, pattern] of FORBIDDEN) {
      if (pattern.test(text)) hits.push(`${short(file)}: ${what}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('no npm script carries a secret, a credential file or a connection setting as an argument', () => {
  const hits = [];
  for (const file of manifests()) {
    const scripts = JSON.parse(read(file)).scripts ?? {};
    for (const [name, command] of Object.entries(scripts)) {
      if (/passw|secret|token|pwfile|pg\.env|pg\.owner\.env|DEMS_PG_/i.test(command)) hits.push(`${short(file)}: ${name}`);
    }
  }
  assert.deepEqual(hits, []);
  const root = JSON.parse(read(path.join(ROOT, 'package.json'))).scripts;
  for (const name of ['init', 'start', 'stop', 'status', 'remove-data', 'remove']) {
    assert.equal(root[`pg:${name}`], `node scripts/pg/${name}.mjs`);
    assert.ok(fs.existsSync(path.join(HERE, `${name}.mjs`)), `${name}.mjs exists`);
  }
  assert.equal(root['test:pg-scripts'], 'node --test scripts/pg/');
});

const sources = () => filesUnder(HERE).filter((file) => file.endsWith('.mjs') && !file.endsWith('.test.mjs'));

test('the password file of the bootstrap superuser is read by init and by the trigger check only', () => {
  const readers = sources().filter((file) => /readPwfile\(/.test(read(file))).map((file) => path.basename(file));
  assert.deepEqual(readers, ['check-superuser-trigger.mjs', 'init.mjs', 'lib.mjs']);
  const connectsAsAdmin = sources().filter((file) => /user: ROLE_ADMIN/.test(read(file))).map((file) => path.basename(file));
  assert.deepEqual(connectsAsAdmin, ['check-superuser-trigger.mjs', 'init.mjs']);
  // The superuser step of the trial (T5-j) is requested by pg:init and by nothing else.
  const requesters = sources().filter((file) => /superuserStep: true/.test(read(file))).map((file) => path.basename(file));
  assert.deepEqual(requesters, ['init.mjs']);
  assert.match(read(path.join(HERE, 'trial.mjs')), /\{ superuserStep = false \} = \{\}/);
});

test('child processes are started in lib.mjs only, where arguments and environment are checked', () => {
  const spawners = sources().filter((file) => /node:child_process/.test(read(file))).map((file) => path.basename(file));
  assert.deepEqual(spawners, ['lib.mjs']);
  const lib = read(path.join(HERE, 'lib.mjs'));
  assert.match(lib, /^import \{ spawnSync \} from 'node:child_process';$/m);
  assert.equal(/shell:/.test(lib), false);
});

test('host and port never come from the environment, and 5432 is named only to be refused', () => {
  const allowed = new Set(['NODE_TEST_CONTEXT', 'DEMS_PG_LOCK_HELD']);
  for (const file of sources()) {
    const text = read(file);
    for (const [, name] of text.matchAll(/process\.env\.([A-Za-z0-9_]+)/g)) {
      assert.ok(allowed.has(name), `${short(file)} reads process.env.${name}`);
    }
    assert.equal(/process\.env\[/.test(text), false, `${short(file)} indexes process.env`);
    if (path.basename(file) !== 'lib.mjs') {
      assert.equal(/\b5432\b/.test(text.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')), false, `${short(file)} names 5432 in code`);
    }
  }
  const lib = read(path.join(HERE, 'lib.mjs')).replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
  assert.deepEqual(lib.match(/\b5432\b/g), ['5432']);
  assert.match(lib, /export const FOREIGN_PORT = 5432;/);
});

test('only the pg driver, loaded in db.mjs, opens a connection; no Unix socket path is used', () => {
  const importers = sources().filter((file) => /import\('pg'\)|from 'pg'/.test(read(file))).map((file) => path.basename(file));
  assert.deepEqual(importers, ['db.mjs']);
  const db = read(path.join(HERE, 'db.mjs'));
  assert.match(db, /const \{ host, port \} = assertEndpoint\(PG_HOST, PG_PORT\);/);
  assert.match(db, /ssl: false/);
  for (const file of sources()) {
    assert.equal(/\/tmp\/|\.s\.PGSQL/.test(read(file).replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')), false, `${short(file)} names a socket path`);
  }
});
