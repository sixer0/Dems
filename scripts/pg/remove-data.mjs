// npm run pg:remove-data: stops the project-local PostgreSQL server and deletes .data/ (the
// cluster with every database, the three credential files, the logs). Rollback block RB-02 of
// 02_plan 14.3. It cannot be undone.
//
// Guards (each refuses before anything is deleted):
//   - the directory is exactly <root>/.data, where <root> holds the manifest named "dems-demo";
//   - it is a real directory, not a symbolic link, and resolves to that same path;
//   - the server is stopped: the script stops it first (pg_ctl -m fast -w stop) and deletes
//     nothing if a server still runs on the data directory afterwards.

import fs from 'node:fs';
import path from 'node:path';

import { PgScriptError, ROOT_PACKAGE_NAME, logEvent, main, rel, say, underLock } from './lib.mjs';
import { serverState, stopServer } from './server.mjs';

/** Throws unless paths.data is exactly the .data directory of a DEMS workspace root. */
export function assertRemovableDataDir(paths) {
  const refuse = (reason) => {
    throw new PgScriptError(`refused: ${reason}. Nothing was deleted.`);
  };
  if (!path.isAbsolute(paths.root) || !path.isAbsolute(paths.data)) refuse('the paths are not absolute');
  if (path.normalize(paths.data) !== path.join(paths.root, '.data')) {
    refuse(`"${paths.data}" is not the .data directory of "${paths.root}"`);
  }
  if (path.normalize(paths.pgdata) !== path.join(paths.root, '.data', 'postgres')) {
    refuse('the cluster directory is not .data/postgres of the same root');
  }
  if (paths.root.split(path.sep).filter(Boolean).length < 2) refuse(`"${paths.root}" is too close to the file-system root`);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(paths.root, 'package.json'), 'utf8'));
  } catch {
    refuse(`"${paths.root}" has no readable package.json`);
  }
  if (manifest.name !== ROOT_PACKAGE_NAME) refuse(`"${paths.root}" is not the ${ROOT_PACKAGE_NAME} workspace root`);
  const stat = fs.lstatSync(paths.data, { throwIfNoEntry: false });
  if (!stat) return false;
  if (stat.isSymbolicLink() || !stat.isDirectory()) refuse(`"${paths.data}" is not a real directory`);
  if (fs.realpathSync(paths.data) !== path.join(fs.realpathSync(paths.root), '.data')) {
    refuse(`"${paths.data}" resolves outside the workspace root`);
  }
  return true;
}

/** Stops the server, then deletes paths.data. `stop` and `state` are parameters so that the
 *  guards can be tested against a temporary directory. */
export async function removeData(paths, { stop = stopServer, state = serverState } = {}) {
  if (!assertRemovableDataDir(paths)) return { removed: false, reason: 'no .data directory' };
  const stopped = await stop(paths);
  const now = await state(paths);
  if (now.state === 'running') {
    throw new PgScriptError(`refused: a server still runs on the data directory (PID ${now.pid}). Nothing was deleted.`);
  }
  logEvent(paths, 'info', 'pg:remove-data', 'removing the data directory', { data: paths.data });
  fs.rmSync(paths.data, { recursive: true, force: true });
  fs.rmSync(paths.pidFile, { force: true });
  return { removed: true, stopped: stopped.stopped === true };
}

await main(import.meta.url, 'pg:remove-data', async (_args, paths) => {
  underLock(import.meta.url, paths);
  const result = await removeData(paths);
  if (result.removed) {
    say(`pg:remove-data: ${result.stopped ? 'server stopped; ' : ''}${rel(paths.data, paths.root)}/ deleted (cluster, credential files, logs)`);
    say('  The PostgreSQL binaries are still installed. A new cluster: npm run pg:init');
  } else {
    say(`pg:remove-data: ${result.reason}; nothing done`);
  }
  return 0;
});
