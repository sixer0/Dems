/**
 * Test support (not a test file): a loopback port on which nothing listens, for the tests that
 * show what `test:db` does when PostgreSQL does not answer, without stopping the real server.
 *
 * It is found by probing only: no port is bound. Port 1 first, as the scaffold's unit tests use
 * it. This file imports nothing of Vitest, so a global setup may use it.
 */
import { probeTcp } from '../endpoint';
import { DbTestHelperError } from '../errors';

export async function findClosedLoopbackPort(): Promise<number> {
  for (const port of [1, 2, 3, 4, 6, 8, 10, 12]) {
    const result = await probeTcp({ host: '127.0.0.1', port });
    if (result.state === 'closed') return port;
  }
  throw new DbTestHelperError('POSTGRES_UNREACHABLE', 'No closed loopback port was found among the candidates (test support).');
}
