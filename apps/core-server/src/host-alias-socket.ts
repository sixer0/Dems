/**
 * The one local-socket client of the Core, and the platform seam of the address helper (task 4
 * row 105, WP-19b; decision C19: "a root service on a local socket"; security items S13-08,
 * S13-09).
 *
 * WHERE THIS FILE STANDS, AND WHY (the point decisions C17 and C19 left open). The capture area
 * keeps its rule "no socket module under `capture/`" (static rules G-R2 and G-R10), and the host
 * units keep theirs (G-R1). This file is in neither: it is a file of no unit, beside `config.ts`,
 * and the composition hands its transport INTO the capture area, where the one caller of the
 * helper lives (`capture/host-alias/caller.ts`). That is the shape of the host checks of row 80
 * (the runner is handed in; only the double is in the capture area's tests). It imports nothing of
 * the server: the caller's port is satisfied by structure.
 *
 * WHAT IT DOES. `exchange(line)` connects to ONE path, writes ONE line, reads at most 64 bytes
 * until the peer closes, under one time bound, and hands the bytes back as they are for the caller
 * to judge. It starts no process, resolves no name and dials no network address: the connection is
 * made with a path and nothing else.
 *
 * BEFORE IT DIALS (what a client can check; the kernel and the helper check the rest):
 *   - the path is absolute and plain (no empty, `.` or `..` part, no NUL, at most 100 bytes);
 *   - the folder of the node is a real folder of the trusted owner, not writable by group or
 *     others: nobody else can put another node at that name between the check and the connection;
 *   - the node is a socket (a link is not followed), owned by the trusted owner, mode 0660.
 * So a configuration that names another socket reaches nothing unless root itself made that
 * socket in a root-only folder. `preflight()` runs these without dialling; `exchange` runs them
 * again immediately before it connects.
 *
 * THE PLATFORM SEAM. `hostAliasSocketTransportOf` is what a composition calls. Off Linux the real
 * helper does not exist (it is a systemd unit and `ip`): the transport it returns answers
 * `NOT_AVAILABLE_ON_THIS_PLATFORM` and touches nothing. On Linux the trusted owner is root, a
 * constant of this file. `createLocalSocketTransport` is the mechanism under the seam, with the
 * owner as an argument; the seam is its ONE caller in the product.
 */
import { lstat } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { dirname } from 'node:path';

/** The words this transport answers with. The caller's port names the same set (`HostAliasTransportFailure`). */
export const LOCAL_SOCKET_FAILURES = Object.freeze([
  'NOT_AVAILABLE_ON_THIS_PLATFORM',
  'NOT_CONFIGURED',
  'SOCKET_PATH_UNSAFE',
  'SOCKET_ABSENT',
  'SOCKET_NOT_A_SOCKET',
  'SOCKET_OWNER_OR_MODE',
  'SOCKET_DIRECTORY_UNSAFE',
  'REQUEST_NOT_A_LINE',
  'CONNECT_REFUSED',
  'CONNECT_NOT_PERMITTED',
  'CONNECT_FAILED',
  'TIMED_OUT',
  'CONNECTION_LOST',
  'ANSWER_TOO_LONG',
] as const);
export type LocalSocketFailure = (typeof LOCAL_SOCKET_FAILURES)[number];

export type LocalSocketExchange = { readonly kind: 'ANSWER'; readonly text: string } | { readonly kind: 'FAILED'; readonly failure: LocalSocketFailure };

export interface LocalSocketTransport {
  /** The checks before dialling, without dialling. null: nothing found. */
  preflight(): Promise<LocalSocketFailure | null>;
  /** One line out, one answer back, or one word why not. Never throws. */
  exchange(requestLine: string): Promise<LocalSocketExchange>;
}

/**
 * The longest a call may take. The helper's unit ends an instance after 30 s (`RuntimeMaxSec=30`:
 * the conflict probe and the tool bounds lie inside it); the Core waits a little longer, so that it
 * does not give up on a call the helper is still completing.
 */
export const HOST_ALIAS_CALL_BOUND_MS = 35_000;
/** The longest answer read: the helper's longest pair is 33 bytes with its line feed. */
export const HOST_ALIAS_ANSWER_MAX_BYTES = 64;
/** The longest request sent, its line feed included (the helper's own bound). */
export const HOST_ALIAS_REQUEST_MAX_BYTES = 64;
/** A local socket path has room for about 107 bytes on Linux; the installed path has 27. */
const SOCKET_PATH_MAX_BYTES = 100;
/** The node as the socket unit creates it (`SocketMode=0660`). */
const SOCKET_MODE = 0o660;
const GROUP_OR_OTHERS_WRITE = 0o022;
/** The owner of the helper's socket and of its folder on an installation. */
const ROOT_UID = 0;
/** The one platform the helper exists on. */
const HELPER_PLATFORM = 'linux';

/** The helper's request grammar, as far as a line can show it. Anything else is not sent. */
const REQUEST_LINE = /^(?:add (?:\d{1,3}\.){3}\d{1,3}\/24 [1-9]\d{0,2}|del (?:\d{1,3}\.){3}\d{1,3}\/24)\n$/;

function plainAbsolutePath(path: string): boolean {
  if (!path.startsWith('/') || path.includes('\0') || Buffer.byteLength(path) > SOCKET_PATH_MAX_BYTES) return false;
  const parts = path.split('/').slice(1);
  return parts.length >= 2 && parts.every((part) => part !== '' && part !== '.' && part !== '..');
}

const errorCodeOf = (error: unknown): string => (typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : '');

export interface LocalSocketOptions {
  /** The absolute path of the helper's socket. */
  readonly socketPath: string;
  /** The user id that must own the node and its folder. */
  readonly trustedOwnerUid: number;
  /** Default: `HOST_ALIAS_CALL_BOUND_MS`. */
  readonly boundMs?: number;
}

/** The mechanism under the seam. The product reaches it through `hostAliasSocketTransportOf` only. */
export function createLocalSocketTransport(options: LocalSocketOptions): LocalSocketTransport {
  const { socketPath, trustedOwnerUid } = options;
  const boundMs = options.boundMs ?? HOST_ALIAS_CALL_BOUND_MS;

  async function preflight(): Promise<LocalSocketFailure | null> {
    if (!plainAbsolutePath(socketPath)) return 'SOCKET_PATH_UNSAFE';
    try {
      const folder = await lstat(dirname(socketPath));
      if (!folder.isDirectory() || folder.uid !== trustedOwnerUid || (folder.mode & GROUP_OR_OTHERS_WRITE) !== 0) return 'SOCKET_DIRECTORY_UNSAFE';
    } catch (error) {
      return errorCodeOf(error) === 'ENOENT' ? 'SOCKET_ABSENT' : 'SOCKET_DIRECTORY_UNSAFE';
    }
    try {
      const node = await lstat(socketPath);
      if (!node.isSocket()) return 'SOCKET_NOT_A_SOCKET';
      if (node.uid !== trustedOwnerUid || (node.mode & 0o7777) !== SOCKET_MODE) return 'SOCKET_OWNER_OR_MODE';
    } catch (error) {
      return errorCodeOf(error) === 'ENOENT' ? 'SOCKET_ABSENT' : 'SOCKET_NOT_A_SOCKET';
    }
    return null;
  }

  async function exchange(requestLine: string): Promise<LocalSocketExchange> {
    if (typeof requestLine !== 'string' || Buffer.byteLength(requestLine) > HOST_ALIAS_REQUEST_MAX_BYTES || !REQUEST_LINE.test(requestLine)) {
      return { kind: 'FAILED', failure: 'REQUEST_NOT_A_LINE' };
    }
    const found = await preflight();
    if (found !== null) return { kind: 'FAILED', failure: found };

    return new Promise<LocalSocketExchange>((resolve) => {
      let settled = false;
      let connected = false;
      const chunks: Buffer[] = [];
      let received = 0;
      const socket = createConnection({ path: socketPath });
      const settle = (answer: LocalSocketExchange): void => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        socket.destroy();
        resolve(answer);
      };
      const failed = (failure: LocalSocketFailure): void => settle({ kind: 'FAILED', failure });
      const deadline = setTimeout(() => failed('TIMED_OUT'), boundMs);

      socket.once('connect', () => {
        connected = true;
        socket.write(requestLine, 'latin1');
      });
      socket.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > HOST_ALIAS_ANSWER_MAX_BYTES) {
          failed('ANSWER_TOO_LONG');
          return;
        }
        chunks.push(chunk);
      });
      // The helper answers and closes: the answer is complete when the peer has ended, not before.
      socket.once('end', () => {
        if (received === 0) failed('CONNECTION_LOST');
        else settle({ kind: 'ANSWER', text: Buffer.concat(chunks).toString('latin1') });
      });
      socket.once('error', (error: unknown) => {
        if (connected) {
          failed('CONNECTION_LOST');
          return;
        }
        const code = errorCodeOf(error);
        if (code === 'ENOENT') failed('SOCKET_ABSENT');
        else if (code === 'ECONNREFUSED') failed('CONNECT_REFUSED');
        else if (code === 'EACCES' || code === 'EPERM') failed('CONNECT_NOT_PERMITTED');
        else failed('CONNECT_FAILED');
      });
      socket.once('close', () => failed('CONNECTION_LOST'));
    });
  }

  return Object.freeze({ preflight, exchange });
}

function unavailable(failure: LocalSocketFailure): LocalSocketTransport {
  return Object.freeze({
    preflight: async () => failure,
    exchange: async (): Promise<LocalSocketExchange> => ({ kind: 'FAILED', failure }),
  });
}

export interface HostAliasPlatform {
  /** The platform of the running process, as the runtime names it. */
  readonly platform: string;
  /** The configured socket path (`DEMS_CAPTURE_ALIAS_SOCKET`), or null. */
  readonly socketPath: string | null;
}

/**
 * THE SEAM. Off Linux: "not available on this platform", whatever is configured. On Linux without a
 * path: "not configured". On Linux with a path: the local socket, trusted owner root.
 */
export function hostAliasSocketTransportOf(facts: HostAliasPlatform): LocalSocketTransport {
  if (facts.platform !== HELPER_PLATFORM) return unavailable('NOT_AVAILABLE_ON_THIS_PLATFORM');
  if (facts.socketPath === null) return unavailable('NOT_CONFIGURED');
  return createLocalSocketTransport({ socketPath: facts.socketPath, trustedOwnerUid: ROOT_UID });
}
