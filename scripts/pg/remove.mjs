// npm run pg:remove: the full removal of everything this project put on the host for
// PostgreSQL: rollback block RB-02 followed by RB-01 of 02_plan 14.3.
//
//   RB-02  stop the server and delete .data/            (= npm run pg:remove-data)
//   RB-01  /usr/bin/lockf -k -t 3600 .locks/npm.lock npm uninstall embedded-postgres pg
//          npm install-scripts prune                    (drops the allowScripts entry)
//
// The uninstall edits package.json and package-lock.json. It cannot be undone except by
// "npm install" of the pinned versions and "npm run pg:init" (a new, empty cluster).

import fs from 'node:fs';

import { PgScriptError, main, rel, run, say, underLock } from './lib.mjs';
import { removeData } from './remove-data.mjs';

/** The commands of RB-01, in order, as [command, arguments]. */
export function uninstallPlan(paths) {
  return [
    ['/usr/bin/lockf', ['-k', '-t', '3600', paths.npmLock, 'npm', 'uninstall', 'embedded-postgres', 'pg']],
    ['npm', ['install-scripts', 'prune']],
  ];
}

await main(import.meta.url, 'pg:remove', async (_args, paths) => {
  underLock(import.meta.url, paths);
  const result = await removeData(paths);
  say(result.removed ? `pg:remove: ${rel(paths.data, paths.root)}/ deleted` : `pg:remove: ${result.reason}`);
  fs.mkdirSync(paths.locks, { recursive: true });
  for (const [command, args] of uninstallPlan(paths)) {
    say(`pg:remove: $ ${[rel(command, paths.root), ...args.map((a) => rel(a, paths.root))].join(' ')}`);
    const r = run(command, args, { cwd: paths.root, inherit: true });
    if (r.status !== 0) throw new PgScriptError(`"${command} ${args.join(' ')}" failed (exit ${r.status}).`);
  }
  say('pg:remove: done. The PostgreSQL binaries, the driver at the root and the data directory are gone.');
  return 0;
});
