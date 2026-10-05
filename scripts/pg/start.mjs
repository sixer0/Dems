// npm run pg:start: starts the project-local PostgreSQL server on 127.0.0.1:4432.
// A no-op when it already runs. The PID is written to .locks/postgres.pid.

import { PG_HOST, PG_PORT, lsofListen, main, say, underLock } from './lib.mjs';
import { startServer } from './server.mjs';

await main(import.meta.url, 'pg:start', async (_args, paths) => {
  underLock(import.meta.url, paths);
  const result = await startServer(paths);
  if (result.started) {
    if (result.output) say(result.output);
    say(`pg:start: started, PID ${result.pid}, listening on ${PG_HOST}:${PG_PORT} (TCP only, no Unix socket)`);
  } else {
    say(`pg:start: already running, PID ${result.pid} on ${PG_HOST}:${PG_PORT}; nothing done`);
  }
  for (const line of lsofListen().lines) say(`  ${line}`);
  say('  PID file: .locks/postgres.pid. Stop with "npm run pg:stop".');
  return 0;
});
