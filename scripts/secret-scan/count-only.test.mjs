// The count-only secret scan (task 4 blueprint row 5; S13-16 (3)). Run: node --test scripts/secret-scan/
//
// EVERY PLANTED STRING IS SYNTHETIC AND IS PUT TOGETHER AT RUN TIME, so that this file holds none of
// the forms it plants and the scan of the tree does not count its own test.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { NEEDLES, countIn } from './count-only.mjs';

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
  assert.deepEqual(NEEDLES.map((needle) => needle.id), ['session-token', 'device-credential', 'biometric-token', 'database-locator', 'camera-credential', 'ingest-secret']);
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
  assert.deepEqual(Object.values(countIn(clean)), [0, 0, 0, 0, 0, 0]);
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
