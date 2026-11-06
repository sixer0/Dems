/**
 * The call log of the fake transport (HB-11; 04_client_integration_spec §12.2 TS-14): one log for
 * the requests of the fake `fetch` and for the sockets of the fake socket constructor, in the order
 * they happened (`seq` counts requests, sockets and frames on one scale).
 *
 * | Entry | Holds |
 * |-------|-------|
 * | A request | method, URL, path, query, operation ID, path parameters, headers, body (text and parsed), status and outcome |
 * | A socket | URL, subprotocols, upgrade headers, every frame of both directions, state, who closed it and with which code |
 *
 * **Values are kept as given**, credentials included, so a test can assert that a header is
 * present and how its value starts (AC-C-04). **Every text the log produces masks them**:
 * `toString()`, `toJSON()` and what a console prints, for the log, for one entry and for one
 * header record. There a bearer value reads `Bearer ses_***`, a cookie keeps its name only, a URL
 * shows its path and the names of its query members, and a body shows its size and the names of
 * its members, never a value: a body can hold a password, a pairing code or a token.
 *
 * A runner that prints a failed comparison through `toJSON()` (Vitest and jest do) therefore
 * prints the masked form of the received entry: the members line up with the entry's own, and the
 * values of headers and body read masked there even though the comparison used the real ones.
 */
import { maskCredentials, maskHeaderValue } from './errors';

export type FakeHttpOutcome =
  /** The request is in flight: no answer was delivered yet. */
  | 'pending'
  | 'answered'
  /** A scripted outage: the transport rejected, as it does when the server is unreachable. */
  | 'outage'
  /** The caller aborted the request (the client's time-out does). */
  | 'aborted'
  /** The request was not the contract's. */
  | 'refused'
  /** No answer was scripted. */
  | 'unscripted'
  /** The scripted answer was not the contract's (a responder function built it). */
  | 'bad-answer';

export interface FakeHttpCall {
  readonly kind: 'http';
  /** Position on the shared scale of the log. */
  readonly seq: number;
  /** The fake clock when the request arrived. */
  readonly at: number;
  /** Upper case. */
  readonly method: string;
  /** The URL as it was given. */
  readonly url: string;
  /** The path of the URL, without origin and query. */
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  /** The operation the request matched; `null` when it matched none. */
  readonly operationId: string | null;
  /** Decoded path parameters. */
  readonly params: Readonly<Record<string, string>>;
  /** By lower-case name; values as given. */
  readonly headers: Readonly<Record<string, string>>;
  /** The `credentials` member of the request (`same-origin`, `omit`), when one was given. */
  readonly credentials: string | null;
  /** The body as text; `null` when there was none. */
  readonly bodyText: string | null;
  /** The body parsed as JSON; `undefined` when there was none or it is not JSON. */
  readonly body: unknown;
  /** The status that was delivered; `null` until then, and when none was. */
  readonly status: number | null;
  readonly outcome: FakeHttpOutcome;
}

export interface FakeSocketFrame {
  readonly seq: number;
  readonly at: number;
  /** `server`: sent to the client. `client`: sent by the client under test. */
  readonly direction: 'server' | 'client';
  /** The frame as it travelled. */
  readonly data: unknown;
  /** The frame parsed as JSON; `undefined` when it is not JSON text. */
  readonly message: unknown;
  /** The `type` member of the message, when it is a string. */
  readonly type: string | null;
  /** A server frame the test marked as a deliberate contract violation. */
  readonly deliberate: boolean;
}

export type FakeSocketState = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';

export interface FakeSocketClosure {
  /** `server`: a close with a code. `client`: the client called `close`. `network`: the connection was lost or the upgrade was refused. */
  readonly by: 'server' | 'client' | 'network';
  readonly code: number | null;
  readonly reason: string;
}

export interface FakeSocketRecord {
  readonly kind: 'socket';
  readonly seq: number;
  readonly at: number;
  /** Counts the sockets of one fake from 1. */
  readonly id: number;
  /** The URL as it was given. */
  readonly url: string;
  readonly protocols: readonly string[];
  /** The upgrade headers the client passed, by lower-case name; values as given. */
  readonly headers: Readonly<Record<string, string>>;
  readonly state: FakeSocketState;
  /** Every frame of both directions, in order. */
  readonly frames: readonly FakeSocketFrame[];
  readonly closed: FakeSocketClosure | null;
}

export type FakeLogEntry = FakeHttpCall | FakeSocketRecord;

/** The same entries with their members writable: what the fake itself holds. */
export type MutableHttpCall = { -readonly [Key in keyof FakeHttpCall]: FakeHttpCall[Key] };
export type MutableSocketRecord = Omit<{ -readonly [Key in keyof FakeSocketRecord]: FakeSocketRecord[Key] }, 'frames'> & {
  frames: FakeSocketFrame[];
};

export interface FakeCallLog {
  /** Requests and sockets in the order they were made. */
  readonly entries: readonly FakeLogEntry[];
  readonly requests: readonly FakeHttpCall[];
  readonly sockets: readonly FakeSocketRecord[];
  /** The requests of one operation, in order. */
  requestsOf(operationId: string): readonly FakeHttpCall[];
  /** The operation ID of every request that matched one, in order. */
  operationIds(): readonly string[];
  /** Every URL a request or a socket named, as given: for "no credential in a URL". */
  urls(): readonly string[];
  /** Empties the log. Scripted answers and open sockets are not touched. */
  clear(): void;
  /** The masked text of the whole log. */
  toString(): string;
  /** The masked form, for `JSON.stringify`. */
  toJSON(): unknown;
}

/** What the fake needs on top of the public log. */
export interface FakeLogWriter extends FakeCallLog {
  nextSeq(): number;
  addRequest(call: MutableHttpCall): void;
  addSocket(record: MutableSocketRecord): void;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Masked text
// ═══════════════════════════════════════════════════════════════════════════════════════

function maskedHeaders(headers: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of Object.keys(headers).sort()) out[maskCredentials(name)] = maskHeaderValue(name, headers[name] ?? '');
  return out;
}

/** Scheme, host and path of a URL, masked; of the query only the names. */
function maskedUrl(url: string): string {
  const at = url.search(/[?#]/);
  const base = maskCredentials((at < 0 ? url : url.slice(0, at)).replace(/\/\/[^/@]*@/, '//***@'));
  if (at < 0 || url[at] !== '?') return base;
  const names = url
    .slice(at + 1)
    .split('#')[0]
    ?.split('&')
    .filter((pair) => pair !== '')
    .map((pair) => maskCredentials(pair.split('=')[0] ?? ''));
  return names && names.length > 0 ? `${base}?${names.join('&')}` : base;
}

/** Size and member names of a body. Never a value. */
function bodyShape(bodyText: string | null, body: unknown): string {
  if (bodyText === null || bodyText === '') return 'none';
  const size = `${bodyText.length} characters`;
  if (body === undefined) return `${size}, not JSON`;
  if (typeof body !== 'object' || body === null) return `${size}, a JSON ${body === null ? 'null' : typeof body}`;
  if (Array.isArray(body)) return `${size}, a JSON array of ${body.length}`;
  return `${size}, members: ${Object.keys(body).map((name) => maskCredentials(name)).join(', ') || '(none)'}`;
}

function maskedValues(values: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) out[maskCredentials(name)] = maskCredentials(value);
  return out;
}

/**
 * A request with the members of its log entry, each one masked: header values and the URL as
 * above, of the query the names only, of the body its size and the names of its members.
 */
function maskedRequest(call: FakeHttpCall) {
  return {
    kind: call.kind,
    seq: call.seq,
    at: call.at,
    method: call.method,
    url: maskedUrl(call.url),
    path: maskCredentials(call.path),
    query: Object.fromEntries(Object.keys(call.query).map((name) => [maskCredentials(name), '***'])),
    operationId: call.operationId,
    params: maskedValues(call.params),
    headers: maskedHeaders(call.headers),
    credentials: call.credentials,
    bodyText: call.bodyText === null ? null : `(${call.bodyText.length} characters)`,
    body: bodyShape(call.bodyText, call.body),
    status: call.status,
    outcome: call.outcome,
  };
}

/** A socket with the members of its log entry, masked; of a frame its number, direction and type. */
function maskedSocket(record: FakeSocketRecord) {
  return {
    kind: record.kind,
    seq: record.seq,
    at: record.at,
    id: record.id,
    url: maskedUrl(record.url),
    protocols: record.protocols.map((protocol) => maskCredentials(protocol)),
    headers: maskedHeaders(record.headers),
    state: record.state,
    frames: record.frames.map((frame) => ({
      seq: frame.seq,
      direction: frame.direction,
      type: frame.type === null ? null : maskCredentials(frame.type),
      ...(frame.deliberate ? { deliberate: true } : {}),
    })),
    closed: record.closed ? { by: record.closed.by, code: record.closed.code } : null,
  };
}

function requestLines(call: FakeHttpCall): string[] {
  const view = maskedRequest(call);
  const result = call.status !== null ? String(call.status) : call.outcome;
  const lines = [`#${view.seq} ${view.method} ${view.url} ${view.operationId ?? '(no operation)'} -> ${result}`];
  for (const [name, value] of Object.entries(view.headers)) lines.push(`    ${name}: ${value}`);
  if (view.credentials !== null) lines.push(`    credentials: ${view.credentials}`);
  lines.push(`    body: ${view.body}`);
  return lines;
}

function socketLines(record: FakeSocketRecord): string[] {
  const view = maskedSocket(record);
  const closed = view.closed ? ` by ${view.closed.by}${view.closed.code === null ? '' : ` ${view.closed.code}`}` : '';
  const lines = [`#${view.seq} WS ${view.url} (socket ${view.id}) ${view.state}${closed}`];
  if (view.protocols.length > 0) lines.push(`    protocols: ${view.protocols.join(', ')}`);
  for (const [name, value] of Object.entries(view.headers)) lines.push(`    ${name}: ${value}`);
  for (const frame of view.frames) {
    lines.push(`    #${frame.seq} ${frame.direction === 'server' ? '<-' : '->'} ${frame.type ?? '(no type)'}${frame.deliberate ? ' (deliberate violation)' : ''}`);
  }
  return lines;
}

/** One entry of the log as masked text. */
export function describeLogEntry(entry: FakeLogEntry): string {
  return (entry.kind === 'http' ? requestLines(entry) : socketLines(entry)).join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The log
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The name under which a console looks up how to print an object. Looked up, never imported. */
const INSPECT = Symbol.for('nodejs.util.inspect.custom');

/**
 * Gives an object a masked `toString()`, `toJSON()` and console form. The three are not enumerable,
 * so the members a test compares stay exactly what was recorded.
 */
function maskInspection(target: object, text: () => string, json: () => unknown): void {
  Object.defineProperties(target, {
    toString: { value: text, enumerable: false },
    toJSON: { value: json, enumerable: false },
    [INSPECT]: { value: text, enumerable: false },
  });
}

function maskHeaderInspection(headers: Readonly<Record<string, string>>): void {
  const json = () => maskedHeaders(headers);
  maskInspection(
    headers,
    () =>
      Object.entries(json())
        .map(([name, value]) => `${name}: ${value}`)
        .join('\n'),
    json,
  );
}

export function createCallLog(): FakeLogWriter {
  const entries: FakeLogEntry[] = [];
  const requests: FakeHttpCall[] = [];
  const sockets: FakeSocketRecord[] = [];
  let seq = 0;

  const text = (): string => (entries.length === 0 ? '(no call)' : entries.map((entry) => describeLogEntry(entry)).join('\n'));
  const json = (): unknown => entries.map((entry) => (entry.kind === 'http' ? maskedRequest(entry) : maskedSocket(entry)));

  const log: FakeLogWriter = {
    entries,
    requests,
    sockets,
    requestsOf: (operationId) => requests.filter((call) => call.operationId === operationId),
    operationIds: () => requests.flatMap((call) => (call.operationId === null ? [] : [call.operationId])),
    urls: () => entries.map((entry) => entry.url),
    clear() {
      entries.length = 0;
      requests.length = 0;
      sockets.length = 0;
    },
    toString: text,
    toJSON: json,
    nextSeq() {
      seq += 1;
      return seq;
    },
    addRequest(call) {
      maskHeaderInspection(call.headers);
      maskInspection(
        call,
        () => describeLogEntry(call),
        () => maskedRequest(call),
      );
      entries.push(call);
      requests.push(call);
    },
    addSocket(record) {
      maskHeaderInspection(record.headers);
      maskInspection(
        record,
        () => describeLogEntry(record),
        () => maskedSocket(record),
      );
      entries.push(record);
      sockets.push(record);
    },
  };
  Object.defineProperty(log, INSPECT, { value: text, enumerable: false });
  return log;
}
