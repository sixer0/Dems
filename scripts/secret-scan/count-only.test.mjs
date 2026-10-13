// The count-only secret scan (task 4 blueprint row 5; S13-16 (3)). Run: node --test scripts/secret-scan/
//
// EVERY PLANTED STRING IS SYNTHETIC AND IS PUT TOGETHER AT RUN TIME, so that this file holds none of
// the forms it plants and the scan of the tree does not count its own test.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { NAME_RULES, NEEDLES, countIn, nameRulesOf } from './count-only.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'count-only.mjs');
// The real path: the temporary folder of this Mac is reached through a link, and the scan names files relative to where it runs.
const folder = realpathSync(mkdtempSync(join(tmpdir(), 'dems-secret-scan-')));
after(() => rmSync(folder, { recursive: true, force: true }));

const SEP = ['://'].join('');
const AT = String.fromCharCode(64);
/** A camera locator with a user part: an account that says what it is, a documentation address. */
const CAMERA_FORM = ['rtsp', SEP, 'synthetic-account', ':', 'synthetic-not-a-password', AT, '192.0.2.10:554/stream1'].join('');
/** The ingest form with a 22-character element (base64url length of 128 bits) and with a 32-character one (hexadecimal). */
const INGEST_FORM_22 = ['rtsp', SEP, '127.0.0.1:8559/', 'SYNTHETIC', '_', 'x'.repeat(12)].join('');
const INGEST_FORM_32 = ['rtsp', SEP, '127.0.0.1:8560/s1/cam1/', '0'.repeat(32)].join('');
/** Today's ingest address with a session ID that is a UUID: not a secret, not counted. */
const INGEST_WITH_SESSION_ID = ['rtsp', SEP, '127.0.0.1:8559/', '00000000-0000-4000-8000-000000000000', '/cam1'].join('');

const plant = (name, text) => {
  const path = join(folder, name);
  writeFileSync(path, text);
  return path;
};
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd: folder });
const line = (output, id) => output.split('\n').find((row) => row.startsWith(`${id}: `));

test('the two needles of S13-16 (3) are in the list, beside the four the scan had', () => {
  assert.deepEqual(NEEDLES.slice(0, 6).map((needle) => needle.id), ['session-token', 'device-credential', 'biometric-token', 'database-locator', 'camera-credential', 'ingest-secret']);
});

test('a file planted with the camera-credential form counts 1 for that needle, and the value is not printed', () => {
  const answer = run(plant('camera.log', `opened\n${CAMERA_FORM}\nclosed\n`));
  assert.equal(answer.status, 1);
  assert.equal(line(answer.stdout, 'camera-credential'), 'camera-credential: 1');
  assert.equal(line(answer.stdout, 'ingest-secret'), 'ingest-secret: 0');
  assert.match(answer.stdout, /^HIT camera\.log: camera-credential=1$/m);
  assert.match(answer.stdout, /^TOTAL: 1 in 1 file\(s\)$/m);
  for (const part of ['synthetic-account', 'synthetic-not-a-password', '192.0.2.10']) assert.equal((answer.stdout + answer.stderr).includes(part), false);
});

test('a file planted with the ingest-secret form counts 1 for that needle, in both lengths, and the value is not printed', () => {
  for (const [name, form] of [['ingest22.log', INGEST_FORM_22], ['ingest32.log', INGEST_FORM_32]]) {
    const answer = run(plant(name, `{"ingestUrl":"${form}"}\n`));
    assert.equal(answer.status, 1);
    assert.equal(line(answer.stdout, 'ingest-secret'), 'ingest-secret: 1');
    assert.equal(line(answer.stdout, 'camera-credential'), 'camera-credential: 0');
    assert.equal((answer.stdout + answer.stderr).includes(form.slice(form.lastIndexOf('/') + 1)), false);
  }
});

test('what is not a secret is not counted: a credential-free locator, a port, a session ID in the ingest path, a short path', () => {
  const clean = [
    ['rtsp', SEP, '192.0.2.10:554/stream1'].join(''),
    ['http', SEP, '192.0.2.10:8080/onvif/device_service'].join(''),
    INGEST_WITH_SESSION_ID,
    ['rtsp', SEP, '127.0.0.1:8559/cam1'].join(''),
    ['rtsp', SEP, '127.0.0.1:8559/S-TEST-0001/video_1'].join(''),
  ].join('\n');
  assert.deepEqual(Object.values(countIn(clean)), [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const answer = run(plant('clean.log', clean));
  assert.equal(answer.status, 0);
  assert.match(answer.stdout, /^TOTAL: 0 in 0 file\(s\)$/m);
});

test('a folder is walked, the ending filter holds, and a call without a target is refused', () => {
  plant('other.txt', CAMERA_FORM);
  const logs = run('--ext=.log', '.');
  assert.equal(line(logs.stdout, 'camera-credential'), 'camera-credential: 1');
  assert.equal(line(logs.stdout, 'ingest-secret'), 'ingest-secret: 2');
  const all = run('.');
  assert.equal(line(all.stdout, 'camera-credential'), 'camera-credential: 2');
  assert.equal(run().status, 2);
  assert.equal(run('--unknown', '.').status, 2);
});

// ── Task 4 row 207 (SX-18): three form needles and two rules on a file's name ──────────────────────
//
// THE PLANTED VALUES ARE MADE IN THIS RUN: the bodies are random bytes of this run, and each form is
// joined from pieces, so that no key line, no password line and no encoded hash is a literal of this
// file. Nothing planted is a usable key, password or hash. Its own folder is removed at the end.
const xFolder = realpathSync(mkdtempSync(join(tmpdir(), 'dems-secret-scan-x-')));
after(() => rmSync(xFolder, { recursive: true, force: true }));
const plantX = (name, text) => {
  const path = join(xFolder, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return path;
};
const runX = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd: xFolder });
const DASHES = '-'.repeat(5);
const KEY_WORDS = ['PRIVATE', 'KEY'].join(' ');
const body = (bytes) => randomBytes(bytes).toString('base64').replace(/=+$/, '');
/** The opening line of a PEM private key of a kind (`''` = the plain one). */
const keyLine = (kind) => [DASHES, 'BEGIN ', kind === '' ? '' : `${kind} `, KEY_WORDS, DASHES].join('');
const PASSWORD_KEY = (role) => ['DEMS', 'PG', role, 'PASSWORD'].join('_');
const passwordLine = (role, value) => [PASSWORD_KEY(role), '=', value].join('');
const ENCODED_HEAD = ['$', 'argon2'].join('');
const encodedHash = (variant, withVersion) => [`${ENCODED_HEAD}${variant}`, ...(withVersion ? ['v=19'] : []), 'm=19456,t=2,p=1', body(16), body(32)].join('$');
const NEW_IDS = ['private-key-pem', 'database-password-line', 'argon2-encoded'];
const OLD_IDS = ['session-token', 'device-credential', 'biometric-token', 'database-locator', 'camera-credential', 'ingest-secret'];
const newCounts = (text) => {
  const counts = countIn(text);
  return NEW_IDS.map((id) => counts[id]);
};

test('SX-18: the three needles and the two name rules are in the lists, after the six the scan had', () => {
  assert.deepEqual(NEEDLES.map((needle) => needle.id), [...OLD_IDS, ...NEW_IDS]);
  assert.deepEqual(NAME_RULES.map((rule) => rule.id), ['key-file-name', 'connection-file-name']);
});

test('private-key-pem: a planted key line counts 1, of every kind; a public key, a certificate and the words alone count 0; nothing planted is printed', () => {
  for (const kind of ['', 'ENCRYPTED', 'RSA', 'EC', 'OPENSSH']) {
    const planted = `${keyLine(kind)}\n${body(48)}\n`;
    assert.deepEqual(newCounts(planted), [1, 0, 0], kind);
  }
  assert.deepEqual(newCounts([DASHES, 'BEGIN PGP ', KEY_WORDS, ' BLOCK', DASHES].join('')), [1, 0, 0]);
  const material = body(48);
  const answer = runX(plantX('key.log', `provisioned\n${keyLine('ENCRYPTED')}\n${material}\n`));
  assert.equal(answer.status, 1);
  assert.equal(line(answer.stdout, 'private-key-pem'), 'private-key-pem: 1');
  assert.match(answer.stdout, /^HIT key\.log: private-key-pem=1$/m);
  assert.match(answer.stdout, /^TOTAL: 1 in 1 file\(s\)$/m);
  for (const part of [material, KEY_WORDS, DASHES]) assert.equal((answer.stdout + answer.stderr).includes(part), false);
  // Negatives: the same line for what is public, the closing line, and the two words in a sentence.
  const clean = [
    [DASHES, 'BEGIN PUBLIC KEY', DASHES].join(''),
    [DASHES, 'BEGIN CERTIFICATE', DASHES].join(''),
    [DASHES, 'END ', KEY_WORDS, DASHES].join(''),
    `the marker ${KEY_WORDS} never matches a key file in DER form`,
    ['BEGIN ', KEY_WORDS].join(''),
  ].join('\n');
  assert.deepEqual(newCounts(clean), [0, 0, 0]);
  assert.equal(runX(plantX('public.log', clean)).status, 0);
});

test('database-password-line: a planted line counts 1 for each of the two keys; the key without a value, the other keys and the key as a word count 0', () => {
  for (const role of ['APP', 'OWNER']) {
    const value = body(24);
    const planted = `DEMS_PG_PORT=1\n${passwordLine(role, value)}\n`;
    assert.deepEqual(newCounts(planted), [0, 1, 0], role);
    assert.deepEqual(newCounts(`${PASSWORD_KEY(role)} = ${value}`), [0, 1, 0], `${role}, spaced`);
    const answer = runX(plantX(`connection-${role}.log`, planted));
    assert.equal(answer.status, 1);
    assert.equal(line(answer.stdout, 'database-password-line'), 'database-password-line: 1');
    assert.match(answer.stdout, new RegExp(`^HIT connection-${role}\\.log: database-password-line=1$`, 'm'));
    for (const part of [value, PASSWORD_KEY(role)]) assert.equal((answer.stdout + answer.stderr).includes(part), false);
  }
  const clean = [
    `${PASSWORD_KEY('APP')}=`,
    `${PASSWORD_KEY('OWNER')}=   `,
    `password: '${PASSWORD_KEY('OWNER')}',`,
    `the key ${PASSWORD_KEY('APP')} of the connection file`,
    ['DEMS', 'PG', 'APP', 'ROLE'].join('_') + '=dems_app',
    ['DEMS', 'PG', 'OTHER', 'PASSWORD'].join('_') + `=${body(12)}`,
  ].join('\n');
  assert.deepEqual(newCounts(clean), [0, 0, 0]);
  assert.equal(runX(plantX('keys.log', clean)).status, 0);
});

test('argon2-encoded: a planted encoded hash counts 1, with and without the version, for the three variants; the name of the algorithm and its parameters alone count 0', () => {
  for (const variant of ['id', 'i', 'd']) {
    for (const withVersion of [true, false]) {
      assert.deepEqual(newCounts(`hash=${encodedHash(variant, withVersion)};`), [0, 0, 1], `${variant} ${withVersion}`);
    }
  }
  const planted = encodedHash('id', true);
  const answer = runX(plantX('hash.log', `{"stored":"${planted}"}\n`));
  assert.equal(answer.status, 1);
  assert.equal(line(answer.stdout, 'argon2-encoded'), 'argon2-encoded: 1');
  assert.match(answer.stdout, /^HIT hash\.log: argon2-encoded=1$/m);
  for (const part of planted.split('$').filter((piece) => piece.length >= 8)) assert.equal((answer.stdout + answer.stderr).includes(part), false);
  const clean = [
    'algorithm argon2id, memory 19456 KiB, 2 passes, parallelism 1',
    `${ENCODED_HEAD}id`,
    `${ENCODED_HEAD}id$m=19456,t=2,p=1`,
    `${ENCODED_HEAD}id$v=19$m=19456,t=2,p=1$$`,
    `${ENCODED_HEAD}x$m=19456,t=2,p=1$${body(16)}$${body(32)}`,
    '$2b$12$' + 'x'.repeat(10),
  ].join('\n');
  assert.deepEqual(newCounts(clean), [0, 0, 0]);
  assert.equal(runX(plantX('parameters.log', clean)).status, 0);
});

test('the earlier needles do not count the new forms, and the new needles do not count the earlier forms', () => {
  const newForms = [keyLine(''), passwordLine('APP', body(24)), encodedHash('id', true)].join('\n');
  const counts = countIn(newForms);
  assert.deepEqual(OLD_IDS.map((id) => counts[id]), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(newCounts([CAMERA_FORM, INGEST_FORM_22, INGEST_FORM_32, INGEST_WITH_SESSION_ID].join('\n')), [0, 0, 0]);
});

test('the name rules: each has a name that meets it and a name that does not', () => {
  // Positive 1.
  assert.deepEqual(nameRulesOf('signer/CORE-KEY-EVSIGN-01.p8'), ['key-file-name']);
  assert.deepEqual(nameRulesOf('signer/CORE-KEY-EVSIGN-01.wrap'), ['key-file-name']);
  assert.deepEqual(nameRulesOf('x.p8'), ['key-file-name']);
  assert.deepEqual(nameRulesOf('pg.env'), ['connection-file-name']);
  assert.deepEqual(nameRulesOf('pg.owner.env'), ['connection-file-name']);
  assert.deepEqual(nameRulesOf('deep/er/pg.owner.env'), ['connection-file-name']);
  // Negative 0.
  for (const name of ['signer/CORE-KEY-EVSIGN-01.crt', 'notes.p8.txt', 'p8', 'wrap', 'docs/wrap.md', 'gift.wrapper', 'a.p80', 'pg.env.example', 'my-pg.env', 'pg.owner.env.md', 'pg.envx', 'docs/pg.env/readme.md', 'src/config.ts']) {
    assert.deepEqual(nameRulesOf(name), [], name);
  }
});

test('--tracked and --staged report a file by its NAME, whatever it holds; a named path does not', () => {
  // A repository of its own, in this run's folder: the files hold random bytes, nothing of a key or a password.
  const repository = join(xFolder, 'repository');
  const git = (...args) => spawnSync('/usr/bin/git', ['-C', repository, ...args], { encoding: 'utf8' });
  mkdirSync(repository);
  assert.equal(git('init', '-q').status, 0);
  const names = ['store/K-01.p8', 'store/K-01.wrap', 'store/K-01.crt', 'pg.env', 'data/pg.owner.env', 'pg.env.example', 'notes.p8.txt', 'docs/wrap.md', 'plain.txt'];
  for (const name of names) plantX(join('repository', name), randomBytes(24).toString('hex'));
  assert.equal(git('add', '--', ...names).status, 0);
  const inRepository = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd: repository });
  for (const mode of ['--tracked', '--staged']) {
    const answer = inRepository(mode);
    assert.equal(answer.status, 1, mode);
    assert.equal(line(answer.stdout, 'key-file-name'), 'key-file-name: 2', mode);
    assert.equal(line(answer.stdout, 'connection-file-name'), 'connection-file-name: 2', mode);
    assert.deepEqual(
      answer.stdout.split('\n').filter((row) => row.startsWith('NAME ')).sort(),
      ['NAME data/pg.owner.env: connection-file-name', 'NAME pg.env: connection-file-name', 'NAME store/K-01.p8: key-file-name', 'NAME store/K-01.wrap: key-file-name'],
      mode,
    );
    assert.match(answer.stdout, /^BY NAME: 4 file\(s\)$/m);
    // The content needles found nothing in them: the hit is the name alone.
    assert.match(answer.stdout, /^TOTAL: 0 in 0 file\(s\)$/m);
    assert.equal(answer.stdout.split('\n').some((row) => row.startsWith('HIT ')), false);
  }
  // Negative: with the four named files taken out of the index, both modes are clean.
  assert.equal(git('rm', '-q', '--cached', '--', 'store/K-01.p8', 'store/K-01.wrap', 'pg.env', 'data/pg.owner.env').status, 0);
  for (const mode of ['--tracked', '--staged']) {
    const answer = inRepository(mode);
    assert.equal(answer.status, 0, mode);
    assert.equal(line(answer.stdout, 'key-file-name'), 'key-file-name: 0', mode);
    assert.equal(line(answer.stdout, 'connection-file-name'), 'connection-file-name: 0', mode);
    assert.match(answer.stdout, /^BY NAME: 0 file\(s\)$/m);
  }
  // The name rules belong to the two git modes: a path that is named is scanned for its content only.
  const byPath = inRepository('store', 'pg.env');
  assert.equal(byPath.status, 0);
  assert.equal(byPath.stdout.includes('NAME '), false);
  assert.equal(line(byPath.stdout, 'key-file-name'), undefined);
});

test('this test file and the scan hold none of the forms they look for', () => {
  const own = readFileSync(fileURLToPath(import.meta.url), 'latin1');
  const script = readFileSync(SCRIPT, 'latin1');
  assert.deepEqual(newCounts(own), [0, 0, 0]);
  assert.deepEqual(newCounts(script), [0, 0, 0]);
});
