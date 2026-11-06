// The endpoint guard of the test helper (decision D26, finding F27) and the message of a run
// that cannot reach PostgreSQL (TI-1). No socket is opened here: this file belongs to the
// database-free project.
import { describe, expect, it } from 'vitest';
import { FOREIGN_PORT, PROJECT_DATABASE_HOST, PROJECT_DATABASE_PORT } from '../constants';
import { PROJECT_ENDPOINT, assertProbeTarget, assertProjectEndpoint, probeTcp, unreachableError } from '../endpoint';
import { DbTestHelperError } from '../errors';

function refusal(action: () => unknown): DbTestHelperError {
  try {
    action();
  } catch (error) {
    if (error instanceof DbTestHelperError) return error;
    throw error;
  }
  throw new Error('not refused');
}

describe('the one endpoint of the helper', () => {
  it('is 127.0.0.1:4432', () => {
    expect(PROJECT_DATABASE_HOST).toBe('127.0.0.1');
    expect(PROJECT_DATABASE_PORT).toBe(4432);
    expect(PROJECT_ENDPOINT).toEqual({ host: '127.0.0.1', port: 4432 });
    expect(assertProjectEndpoint('127.0.0.1', 4432)).toEqual(PROJECT_ENDPOINT);
    // A connection file holds the port as text.
    expect(assertProjectEndpoint('127.0.0.1', '4432')).toEqual(PROJECT_ENDPOINT);
  });

  it("refuses PostgreSQL's default port by name: it is another server on this host", () => {
    for (const port of [FOREIGN_PORT, String(FOREIGN_PORT)]) {
      const error = refusal(() => assertProjectEndpoint('127.0.0.1', port));
      expect(error.code).toBe('ENDPOINT_REFUSED');
      expect(error.message).toContain(`port ${FOREIGN_PORT} is another PostgreSQL server`);
    }
    // Also when the host is wrong as well: the port is named first.
    expect(refusal(() => assertProjectEndpoint('localhost', FOREIGN_PORT)).message).toContain('another PostgreSQL server');
  });

  it.each(['localhost', '::1', '0.0.0.0', '127.0.0.2', '192.168.1.10', '', undefined, null, 127])(
    'refuses the host %j',
    (host) => {
      const error = refusal(() => assertProjectEndpoint(host, 4432));
      expect(error.code).toBe('ENDPOINT_REFUSED');
      expect(error.message).toContain('127.0.0.1');
    },
  );

  it.each([4431, 4433, 4420, 0, -1, 65_536, 44.32, '4432 ', '0x1150', 'abc', '', undefined, null, Number.NaN])(
    'refuses the port %j',
    (port) => {
      expect(refusal(() => assertProjectEndpoint('127.0.0.1', port)).code).toBe('ENDPOINT_REFUSED');
    },
  );
});

describe('the reachability probe (the test seam)', () => {
  it('accepts any loopback port except the foreign one', () => {
    expect(assertProbeTarget('127.0.0.1', 1)).toEqual({ host: '127.0.0.1', port: 1 });
    expect(assertProbeTarget('127.0.0.1', 4432)).toEqual(PROJECT_ENDPOINT);
    expect(refusal(() => assertProbeTarget('127.0.0.1', FOREIGN_PORT)).code).toBe('ENDPOINT_REFUSED');
    expect(refusal(() => assertProbeTarget('localhost', 1)).code).toBe('ENDPOINT_REFUSED');
    expect(refusal(() => assertProbeTarget('10.0.0.1', 4432)).code).toBe('ENDPOINT_REFUSED');
    expect(refusal(() => assertProbeTarget('127.0.0.1', 0)).code).toBe('ENDPOINT_REFUSED');
    expect(refusal(() => assertProbeTarget('127.0.0.1', 70_000)).code).toBe('ENDPOINT_REFUSED');
  });

  it('refuses a forbidden target before a socket exists', () => {
    expect(refusal(() => probeTcp({ host: '127.0.0.1', port: FOREIGN_PORT })).code).toBe('ENDPOINT_REFUSED');
    expect(refusal(() => probeTcp({ host: 'example.org', port: 4432 })).code).toBe('ENDPOINT_REFUSED');
  });
});

describe('TI-1: an unreachable server fails the run and says what to do', () => {
  it('a closed port: start the server; nothing is skipped', () => {
    const error = unreachableError(PROJECT_ENDPOINT, { state: 'closed', code: 'ECONNREFUSED' });
    expect(error.code).toBe('POSTGRES_UNREACHABLE');
    expect(error.message).toContain('127.0.0.1:4432');
    expect(error.message).toContain('ECONNREFUSED');
    expect(error.message).toContain('npm run pg:start');
    expect(error.message).toContain('npm run pg:status');
    expect(error.message).toContain('did NOT run and are NOT skipped: this run fails');
  });

  it('a command sandbox is not "server down": the message says so and does not ask for a start', () => {
    const error = unreachableError(PROJECT_ENDPOINT, { state: 'blocked', code: 'EPERM' });
    expect(error.code).toBe('POSTGRES_UNREACHABLE');
    expect(error.message).toContain('EPERM');
    expect(error.message).toContain('sandbox');
    expect(error.message).toContain('not a stopped server');
    expect(error.message).not.toContain('pg:start');
    expect(error.message).toContain('this run fails');
  });

  it('a timeout or another error is reported with its code', () => {
    expect(unreachableError(PROJECT_ENDPOINT, { state: 'timeout', code: 'ETIMEDOUT' }).message).toContain('ETIMEDOUT');
    expect(unreachableError(PROJECT_ENDPOINT, { state: 'error', code: 'EHOSTUNREACH' }).message).toContain('EHOSTUNREACH');
  });
});
