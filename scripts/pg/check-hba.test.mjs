// Test T-HA-1 (database contract 7.6): the host-authentication check HA-1 to HA-3 on three
// fixture files: the one initdb wrote, one with an added trust line, one with an added line for
// 0.0.0.0/0. More cases cover the other methods, line types and address forms.

import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkHbaFile, checkHbaText } from './check-hba.mjs';

const fixture = (name) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const rulesOf = (result) => [...new Set(result.failures.map((f) => f.rule))].sort();

test('T-HA-1: the file initdb wrote with -A scram-sha-256 passes HA-1, HA-2 and HA-3', () => {
  const result = checkHbaFile(fixture('pg_hba.initdb.conf'));
  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
  assert.equal(result.lines.length, 6);
  assert.ok(result.lines.every((line) => line.text.endsWith('scram-sha-256')));
});

test('T-HA-1: an added trust line fails HA-1', () => {
  const result = checkHbaFile(fixture('pg_hba.trust.conf'));
  assert.equal(result.ok, false);
  assert.deepEqual(rulesOf(result), ['HA-1']);
  assert.match(result.failures[0].reason, /method "trust" is not scram-sha-256/);
});

test('T-HA-1: an added line for 0.0.0.0/0 fails HA-2', () => {
  const result = checkHbaFile(fixture('pg_hba.any-address.conf'));
  assert.equal(result.ok, false);
  assert.deepEqual(rulesOf(result), ['HA-2']);
  assert.match(result.failures[0].reason, /address "0\.0\.0\.0\/0" is not 127\.0\.0\.1\/32 or ::1\/128/);
});

test('HA-1: peer, ident, password and md5 are refused, also on a local line', () => {
  for (const method of ['peer', 'ident', 'password', 'md5', 'trust', 'reject', 'cert']) {
    assert.deepEqual(rulesOf(checkHbaText(`local all all ${method}\n`)), ['HA-1'], method);
    assert.deepEqual(rulesOf(checkHbaText(`host all all 127.0.0.1/32 ${method}\n`)), ['HA-1'], method);
  }
});

test('HA-2: only 127.0.0.1/32 and ::1/128; no other network, keyword, host name or mask form', () => {
  for (const address of ['all', 'samehost', 'samenet', 'localhost', '127.0.0.0/8', '10.0.0.0/8', '::/0', '0.0.0.0/0', '127.0.0.1']) {
    assert.ok(rulesOf(checkHbaText(`host all all ${address} scram-sha-256\n`)).includes('HA-2'), address);
  }
  assert.ok(rulesOf(checkHbaText('host all all 127.0.0.1 255.255.255.255 scram-sha-256\n')).includes('HA-2'));
  assert.equal(checkHbaText('host all all ::1/128 scram-sha-256\n').ok, true);
});

test('HA-3: local and host only; other line types and include directives are refused', () => {
  for (const type of ['hostssl', 'hostnossl', 'hostgssenc', 'hostnogssenc', 'include', 'include_if_exists', 'include_dir']) {
    assert.deepEqual(rulesOf(checkHbaText(`${type} all all 127.0.0.1/32 scram-sha-256\n`)), ['HA-3'], type);
  }
});

test('comments and blank lines are skipped; an empty rule set fails; an option after the method is allowed', () => {
  assert.equal(checkHbaText('# only a comment\n\n   \n').ok, false);
  assert.equal(checkHbaText('  # indented comment\nhost all all 127.0.0.1/32 scram-sha-256   # trailing comment\n').ok, true);
  assert.equal(checkHbaText('host all all 127.0.0.1/32 scram-sha-256 trust\n').ok, false);
});
