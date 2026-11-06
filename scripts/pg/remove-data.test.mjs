// Tests of the removal guards. They run against temporary directories only: the functions take
// their paths as a parameter, and the commands themselves refuse to run under the test runner.
// The real .data/ of the workspace is never passed to a function that deletes.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectPaths } from './lib.mjs';
import { uninstallPlan } from './remove.mjs';
import { assertRemovableDataDir, removeData } from './remove-data.mjs';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dems-pg-remove-')));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function workspace(name, manifestName = 'dems-demo') {
  const dir = path.join(tmp, name);
  fs.mkdirSync(path.join(dir, '.data', 'postgres'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.data', 'postgres', 'PG_VERSION'), '18\n');
  fs.writeFileSync(path.join(dir, '.data', 'pg.env'), 'x\n');
  if (manifestName !== null) fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: manifestName }));
  return projectPaths(dir);
}
const stopped = { stop: async () => ({ stopped: false }), state: async () => ({ state: 'stopped' }) };

test('the stopped cluster of a DEMS workspace root is removed, and nothing else', async () => {
  const p = workspace('ok');
  fs.writeFileSync(path.join(p.root, 'keep.txt'), 'kept');
  assert.deepEqual(await removeData(p, stopped), { removed: true, stopped: false });
  assert.equal(fs.existsSync(p.data), false);
  assert.equal(fs.readFileSync(path.join(p.root, 'keep.txt'), 'utf8'), 'kept');
  assert.deepEqual(await removeData(p, stopped), { removed: false, reason: 'no .data directory' });
});

test('the server is stopped first; a server that still runs stops the removal', async () => {
  const p = workspace('running');
  let stopCalls = 0;
  const running = { stop: async () => { stopCalls += 1; return { stopped: false }; }, state: async () => ({ state: 'running', pid: 4242 }) };
  await assert.rejects(removeData(p, running), /refused: a server still runs on the data directory \(PID 4242\)\. Nothing was deleted\./);
  assert.equal(stopCalls, 1);
  assert.equal(fs.existsSync(path.join(p.pgdata, 'PG_VERSION')), true);
});

test('any directory other than <root>/.data is refused', async () => {
  const p = workspace('other');
  const elsewhere = path.join(p.root, 'elsewhere');
  fs.mkdirSync(elsewhere);
  for (const data of [elsewhere, p.root, path.join(p.root, '.data', 'postgres'), path.join(p.root, '..', 'ok', '.data'), '/', os.homedir(), '.data']) {
    await assert.rejects(removeData({ ...p, data }, stopped), /refused: .*Nothing was deleted\./s, data);
  }
  await assert.rejects(removeData({ ...p, pgdata: elsewhere }, stopped), /the cluster directory is not \.data\/postgres of the same root/);
  assert.equal(fs.existsSync(elsewhere), true);
  assert.equal(fs.existsSync(path.join(p.pgdata, 'PG_VERSION')), true);
});

test('a root that is not the dems-demo workspace is refused', async () => {
  await assert.rejects(removeData(workspace('wrong-name', 'something-else'), stopped), /is not the dems-demo workspace root/);
  await assert.rejects(removeData(workspace('no-manifest', null), stopped), /has no readable package\.json/);
  assert.throws(() => assertRemovableDataDir(projectPaths('/')), /refused/);
});

test('a .data that is a symbolic link is refused, and its target is untouched', async () => {
  const p = workspace('link-target');
  const linked = path.join(tmp, 'linked');
  fs.mkdirSync(linked);
  fs.writeFileSync(path.join(linked, 'package.json'), JSON.stringify({ name: 'dems-demo' }));
  fs.symlinkSync(p.data, path.join(linked, '.data'));
  await assert.rejects(removeData(projectPaths(linked), stopped), /is not a real directory/);
  assert.equal(fs.existsSync(path.join(p.pgdata, 'PG_VERSION')), true);
});

test('pg:remove is RB-02 then RB-01: the uninstall under the npm lock, then the prune', () => {
  const p = projectPaths('/work/root');
  assert.deepEqual(uninstallPlan(p), [
    ['/usr/bin/lockf', ['-k', '-t', '3600', '/work/root/.locks/npm.lock', 'npm', 'uninstall', 'embedded-postgres', 'pg']],
    ['npm', ['install-scripts', 'prune']],
  ]);
});

test('no lifecycle command acts when the test runner executes it', () => {
  // Every command enters through main(), which refuses first. The guard is exercised here on
  // the two commands that change nothing even without it (a read-only status, a usage message);
  // a command that deletes, stops or installs is never started by a test.
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const script of ['status.mjs', 'check-superuser-trigger.mjs']) {
    const r = spawnSync(process.execPath, [path.join(here, script)], {
      encoding: 'utf8',
      env: { ...process.env, NODE_TEST_CONTEXT: 'child-v8' },
    });
    assert.equal(r.status, 1, script);
    assert.match(r.stderr, /does not run under the test runner/, script);
    assert.equal(r.stdout, '', script);
  }
  for (const script of ['init.mjs', 'start.mjs', 'stop.mjs', 'status.mjs', 'remove-data.mjs', 'remove.mjs', 'check-hba.mjs', 'check-superuser-trigger.mjs', 'trial.mjs']) {
    const source = fs.readFileSync(path.join(here, script), 'utf8');
    assert.match(source, /^await main\(import\.meta\.url, 'pg:[a-z-]+', async /m, `${script} enters through main()`);
    assert.equal(source.split('\n').filter((line) => /^await /.test(line)).length, 1, `${script} has one top-level action`);
  }
});
