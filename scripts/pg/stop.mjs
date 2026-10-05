// npm run pg:stop: stops the project-local PostgreSQL server (pg_ctl -m fast -w stop).
// A no-op when it does not run. It never touches another server: pg_ctl signals only the PID
// recorded in .data/postgres/postmaster.pid.

import { PG_HOST, PG_PORT, main, say, underLock } from './lib.mjs';
import { stopServer } from './server.mjs';

await main(import.meta.url, 'pg:stop', async (_args, paths) => {
  underLock(import.meta.url, paths);
  const result = await stopServer(paths);
  if (result.stopped) {
    if (result.output) say(result.output);
    say(`pg:stop: stopped PID ${result.pid}; ${PG_HOST}:${PG_PORT} is free`);
  } else {
    say(`pg:stop: ${result.reason}; nothing done`);
  }
  return 0;
});
