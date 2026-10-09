/**
 * The HTTP client of the oMLX server: THE ONLY MODULE THAT CALLS `fetch` AND THE ONLY ONE THAT
 * BUILDS THE `Authorization` HEADER (SEC35-14; static rule).
 *
 * Rules held here, whatever a caller passes:
 *
 *   - the base address is checked to be loopback http AGAIN (the configuration already did), so no
 *     path through this module can send the key to another host (OD-13);
 *   - the connection always goes to the ADDRESS `127.0.0.1`. An endpoint written with the name
 *     `localhost` is never handed to a resolver (the name can answer `::1` first, or whatever a
 *     hosts file says): the name is replaced by the address in the request address itself (N-8).
 *     The `Host` header is therefore the address too: the runtime's `fetch` derives that header
 *     from the request address and DROPS one a caller sets (measured in fix round 1), so this
 *     client sets none and claims none. A loopback server does not route on it;
 *   - a redirect is an error, never followed: a redirect is how a loopback answer could move the
 *     header elsewhere;
 *   - a failure is reduced to a code. The message of a transport error is not passed on (it can
 *     quote the request), and no header is ever placed in an error, a log line or a return value;
 *   - this module opens connections only. It never listens, and it never starts, stops or restarts
 *     the server (D7(d)).
 */
import { assertLoopbackEndpoint } from '../config';
import { bearerHeaderValue, type Credential } from '../key-loader';
import { TranscriberError, TranscriberErrorCode } from '../types';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface OmlxHttpOptions {
  /** `http://127.0.0.1[:port]` or `http://localhost[:port]`, no trailing slash. From configuration. */
  readonly endpoint: string;
  readonly credential: Credential | null;
  readonly timeoutMs: number;
  /** The transport. Default: the global `fetch`. Tests pass an in-process answerer. */
  readonly fetchImpl?: FetchLike;
}

export interface OmlxResponse {
  readonly status: number;
  readonly body: Uint8Array;
}

export const OMLX_PATHS = {
  MODELS: '/v1/models',
  TRANSCRIPTIONS: '/v1/audio/transcriptions',
  SPEECH: '/v1/audio/speech',
} as const;

export interface OmlxHttp {
  get(path: string, signal?: AbortSignal): Promise<OmlxResponse>;
  postForm(path: string, form: FormData): Promise<OmlxResponse>;
  postJson(path: string, body: unknown): Promise<OmlxResponse>;
}

/** The one address a connection goes to. */
export const LOOPBACK_ADDRESS = '127.0.0.1';
const LOOPBACK_NAME = 'localhost';

/**
 * Where a checked endpoint is connected to: the same scheme, port and path, with the name
 * `localhost` replaced by the loopback ADDRESS. No trailing slash.
 */
export function connectionTarget(endpoint: string): string {
  const trimmed = endpoint.replace(/\/+$/, '');
  const parts = /^([a-z]+:\/\/)([^/:]+)(:[0-9]+)?(\/.*)?$/.exec(trimmed);
  if (parts === null || parts[2] !== LOOPBACK_NAME) return trimmed;
  return `${parts[1]}${LOOPBACK_ADDRESS}${parts[3] ?? ''}${parts[4] ?? ''}`;
}

export function createOmlxHttp(options: OmlxHttpOptions): OmlxHttp {
  assertLoopbackEndpoint(options.endpoint);
  const base = connectionTarget(options.endpoint);
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));

  async function send(method: 'GET' | 'POST', path: string, body: BodyInit | null, contentType: string | null, outer?: AbortSignal): Promise<OmlxResponse> {
    const headers = new Headers();
    if (options.credential !== null) headers.set('Authorization', bearerHeaderValue(options.credential));
    if (contentType !== null) headers.set('Content-Type', contentType);
    const timeout = AbortSignal.timeout(options.timeoutMs);
    const signal = outer === undefined ? timeout : AbortSignal.any([timeout, outer]);
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, { method, headers, body, signal, redirect: 'error' });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new TranscriberError(TranscriberErrorCode.TIMEOUT, 'the transcriber server did not answer in time', { reason: 'REQUEST_TIMEOUT', path });
      }
      // Only the transport code is kept (ECONNREFUSED, ...): never the message, never the request.
      const cause = error instanceof Error ? (error.cause as { code?: unknown } | undefined) : undefined;
      const transport = typeof cause?.code === 'string' ? cause.code : 'TRANSPORT_ERROR';
      throw new TranscriberError(TranscriberErrorCode.UNREACHABLE, 'the transcriber server could not be reached', { reason: 'UNREACHABLE', transport, path });
    }
    return { status: response.status, body: new Uint8Array(await response.arrayBuffer()) };
  }

  return {
    get: (path, signal) => send('GET', path, null, null, signal),
    // The multipart boundary is set by the runtime: no Content-Type is forced for a form.
    postForm: (path, form) => send('POST', path, form, null),
    postJson: (path, body) => send('POST', path, JSON.stringify(body), 'application/json'),
  };
}
