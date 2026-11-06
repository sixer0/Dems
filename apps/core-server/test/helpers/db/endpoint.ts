/**
 * The endpoint guard and the reachability probe (TI-1; decision D26, finding F27).
 *
 * One endpoint exists for the helper: `127.0.0.1:4432`. `assertProjectEndpoint` accepts nothing
 * else, and it is called wherever a host or a port was read from a file and again immediately
 * before a connection is opened. PostgreSQL's default port is refused by name: on this host it
 * is another server.
 *
 * `test:db` FAILS when the server cannot be reached; it never skips (TI-1, GR-2). The probe is
 * a plain TCP connect that sends nothing, so it is also the helper's test seam: a test points
 * it at a closed loopback port and sees the failure without stopping the real server.
 */
import net from 'node:net';
import {
  FOREIGN_PORT,
  PROBE_TIMEOUT_MS,
  PROJECT_DATABASE_HOST,
  PROJECT_DATABASE_PORT,
} from './constants';
import { DbTestHelperError } from './errors';

export interface Endpoint {
  readonly host: string;
  readonly port: number;
}

export const PROJECT_ENDPOINT: Endpoint = Object.freeze({
  host: PROJECT_DATABASE_HOST,
  port: PROJECT_DATABASE_PORT,
});

function toPort(port: unknown): number {
  if (typeof port === 'number') return port;
  if (typeof port === 'string' && /^[0-9]{1,5}$/.test(port)) return Number(port);
  return Number.NaN;
}

function refuseForeign(host: unknown, port: number): void {
  if (port === FOREIGN_PORT) {
    throw new DbTestHelperError(
      'ENDPOINT_REFUSED',
      `refused: port ${FOREIGN_PORT} is another PostgreSQL server on this host, not the project's. ` +
        `The project uses ${PROJECT_DATABASE_HOST}:${PROJECT_DATABASE_PORT} only.`,
    );
  }
  if (host !== PROJECT_DATABASE_HOST) {
    throw new DbTestHelperError(
      'ENDPOINT_REFUSED',
      `refused: the database host must be ${PROJECT_DATABASE_HOST} (loopback IPv4); nothing else is ever connected to.`,
    );
  }
}

/** Accepts exactly `127.0.0.1:4432`. The port may be a number or its decimal text. */
export function assertProjectEndpoint(host: unknown, port: unknown): Endpoint {
  const portNumber = toPort(port);
  refuseForeign(host, portNumber);
  if (portNumber !== PROJECT_DATABASE_PORT) {
    throw new DbTestHelperError(
      'ENDPOINT_REFUSED',
      `refused: the database port must be ${PROJECT_DATABASE_PORT}. The project uses ${PROJECT_DATABASE_HOST}:${PROJECT_DATABASE_PORT} only.`,
    );
  }
  return PROJECT_ENDPOINT;
}

/**
 * The target of a reachability probe: `127.0.0.1` and any port except the foreign one. Only the
 * probe takes this; a connection that carries credentials takes `assertProjectEndpoint`.
 */
export function assertProbeTarget(host: unknown, port: unknown): Endpoint {
  const portNumber = toPort(port);
  refuseForeign(host, portNumber);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65_535) {
    throw new DbTestHelperError('ENDPOINT_REFUSED', 'refused: the probe port must be an integer from 1 to 65535.');
  }
  return Object.freeze({ host: PROJECT_DATABASE_HOST, port: portNumber });
}

export type ProbeResult =
  | { readonly state: 'open' }
  | { readonly state: 'closed' | 'blocked' | 'timeout' | 'error'; readonly code: string };

/** One TCP connect; nothing is sent. `blocked` is a command sandbox, which is not "server down". */
export function probeTcp(target: Endpoint, timeoutMs: number = PROBE_TIMEOUT_MS): Promise<ProbeResult> {
  const { host, port } = assertProbeTarget(target.host, target.port);
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result: ProbeResult): void => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => done({ state: 'timeout', code: 'ETIMEDOUT' }));
    socket.once('connect', () => done({ state: 'open' }));
    socket.once('error', (error: NodeJS.ErrnoException) => {
      const code = error.code ?? 'UNKNOWN';
      if (code === 'ECONNREFUSED') done({ state: 'closed', code });
      else if (code === 'EPERM' || code === 'EACCES') done({ state: 'blocked', code });
      else done({ state: 'error', code });
    });
  });
}

/** The error of a run that cannot reach PostgreSQL. It says what to do, and that nothing was skipped. */
export function unreachableError(target: Endpoint, result: Exclude<ProbeResult, { state: 'open' }>): DbTestHelperError {
  const where = `${target.host}:${target.port}`;
  const verdict = 'The database tests did NOT run and are NOT skipped: this run fails.';
  if (result.state === 'blocked') {
    return new DbTestHelperError(
      'POSTGRES_UNREACHABLE',
      `test:db cannot connect to PostgreSQL on ${where}: the operating system refused the connection (${result.code}). ` +
        'That is a command sandbox, not a stopped server: run the command again outside the sandbox ' +
        `(check the server with "npm run pg:status"). ${verdict}`,
    );
  }
  return new DbTestHelperError(
    'POSTGRES_UNREACHABLE',
    `test:db needs the project's PostgreSQL on ${where}, and nothing answers there (${result.code}). ` +
      `Start it with "npm run pg:start" (state: "npm run pg:status"; first use: "npm run pg:init"). ${verdict}`,
  );
}

/** Resolves when the target accepts a TCP connection; otherwise throws `POSTGRES_UNREACHABLE`. */
export async function assertServerReachable(target: Endpoint = PROJECT_ENDPOINT): Promise<void> {
  const checked = assertProbeTarget(target.host, target.port);
  const result = await probeTcp(checked);
  if (result.state !== 'open') throw unreachableError(checked, result);
}
