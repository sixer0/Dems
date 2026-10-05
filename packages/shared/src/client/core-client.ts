/**
 * HB-9: the registry-driven typed client (backend task 04_client_integration_spec §2.1, CL-1 to
 * CL-6a; decision TD-09; plan row W12).
 *
 * One generic function, `client.call(operationId, input)`. Everything it knows about an operation
 * (method, path template, path parameter, request body, response schema per status) is read from
 * the operation registry in `../api/core-api`, so it covers every operation the registry holds and
 * needs no change when the registry grows. Without an explicit table the client is typed by the
 * registry's literal table (`CoreApiOperationTable`): operation IDs are a union, and the input and
 * the success of each call have the types of that operation's schemas.
 *
 * | Rule | How it is met here |
 * |------|--------------------|
 * | CL-1 | `call` resolves with a success or a failure for every answer, for "no answer" and for a credential provider that fails or does not answer. It rejects only with `CoreClientUsageError`, a programming error |
 * | CL-2 | Built from `{ baseUrl, fetch, credentials }`. `'browser-cookie'`: same-origin cookie, never an `Authorization` header. A function: its value becomes `Authorization: Bearer <value>`; no cookie is sent |
 * | CL-3 | The body is read with `text()` and `JSON.parse`; the response stream is never touched |
 * | CL-4 | A 2xx body is parsed with the registry schema of that status, any other body with `ApiErrorSchema`. A body that fails becomes the failure `CONTRACT_VIOLATION` and is reported; its content is never returned. A success the registry gives no schema (204) has no body and no data: nothing is parsed |
 * | CL-5 | A success carries `epoch` and `revision`, the integers of `x-dems-epoch` and `x-dems-revision` |
 * | CL-6 | One budget of `timeoutMs` (default 8,000 ms) bounds the whole call: the credential provider first, then the exchange with what is left. Nothing is retried, and nothing is sent once the budget is spent |
 * | CL-6a | A credential in a path parameter or a query value is refused before any request. The debug log holds method, route template, status and request ID only |
 *
 * The request ID of an answer is the `x-request-id` header; an error envelope's `error.requestId`
 * is used when the header is absent. The query of a GET whose registry entry names a query schema
 * is parsed with that schema before the request; what the schema refuses is a programming error.
 *
 * Platform neutral: this folder imports zod types and `../api` only. It uses `setTimeout`,
 * `clearTimeout`, `AbortController` and `Date.now`, which every target runtime provides (browsers,
 * Hermes, the test runner), and the transport that is injected.
 */
import type { z } from 'zod';
import { EPOCH_HEADER_NAME, REQUEST_ID_HEADER_NAME, RETRY_AFTER_HEADER_NAME, REVISION_HEADER_NAME } from '../api/constants';
import {
  ApiErrorSchema,
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  type ApiError,
  type CoreApiOperation,
  type CoreApiOperationTable,
  type CoreApiSchemaName,
} from '../api/core-api';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════════════

/** CL-6: a request is abandoned after this many milliseconds (04_client_integration_spec §2.4). */
export const LIVE_COMMAND_TIMEOUT_MS = 8_000;

// The header names are the contract's (`../api/constants`). These four names are kept as aliases of
// them, so the client and the contract cannot name different headers.
/** API-7: the headers a 2xx answer of a POST carries; both hold a non-negative integer. */
export const EPOCH_HEADER = EPOCH_HEADER_NAME;
export const REVISION_HEADER = REVISION_HEADER_NAME;
/** The header a 429 carries (01_specs §7.2). */
export const RETRY_AFTER_HEADER = RETRY_AFTER_HEADER_NAME;
/** The response header that carries the request ID (pinned by the contract). */
export const DEFAULT_REQUEST_ID_HEADER = REQUEST_ID_HEADER_NAME;

/**
 * Prefixes of the values that must never travel in a URL (01_specs §4.1, §5.6; CL-6a): the three
 * bearer secrets of the contract.
 *
 * CONTRACT-GAP-4: the contract states the secrets as three whole patterns (`SESSION_TOKEN_PATTERN`,
 * `DEVICE_CREDENTIAL_PATTERN`, `BIOMETRIC_TOKEN_PATTERN` in `../api/patterns`) and exports no list of
 * their prefixes, so the three are written here once more. `test/client-credentials.test.ts` reads
 * the literal head of every token pattern the contract exports and holds this guard to it; a fourth
 * secret in the contract turns that test red. When the contract exports the prefixes, build this
 * expression from them.
 */
const CREDENTIAL_PREFIX = /^(?:dvc|ses|bio)_/;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Transport (injected)
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface CoreFetchInit {
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  credentials: 'same-origin' | 'omit';
  signal?: AbortSignal;
}

/** The part of a fetch `Response` the client reads. `body` (the stream) is deliberately absent. */
export interface CoreFetchResponse {
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  text(): Promise<string>;
}

/** A fetch-compatible function. The platform's own `fetch` satisfies it. */
export type CoreFetch = (input: string, init: CoreFetchInit) => Promise<CoreFetchResponse>;

/**
 * Where the credential comes from (CL-2).
 * - `'browser-cookie'`: the web console. The browser attaches its same-origin session cookie.
 * - a function: the mobile app. It returns the current bearer value, or nothing when there is none.
 */
export type CoreCredentials = 'browser-cookie' | (() => string | null | undefined | Promise<string | null | undefined>);

// ═══════════════════════════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * The class of a failure. An HTTP status maps to exactly one kind (`coreErrorKindForStatus`);
 * the last four have no contract envelope from the server.
 */
export const CoreErrorKind = {
  /** 400, and any 4xx without a kind of its own (405, 413). */
  BAD_REQUEST: 'BAD_REQUEST',
  /** 401. */
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /** 403. */
  FORBIDDEN: 'FORBIDDEN',
  /** 404. */
  NOT_FOUND: 'NOT_FOUND',
  /** 409. */
  CONFLICT: 'CONFLICT',
  /** 422. */
  INVALID: 'INVALID',
  /** 423. */
  LOCKED: 'LOCKED',
  /** 429; `retryAfterSeconds` holds the `retry-after` header. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** 503. */
  NOT_READY: 'NOT_READY',
  /** Any other 5xx. */
  SERVER: 'SERVER',
  /** No answer: the transport rejected (connection refused, reset, DNS). */
  NETWORK: 'NETWORK',
  /** No answer within `timeoutMs`. */
  TIMEOUT: 'TIMEOUT',
  /** An answer that is not the contract's: not JSON, an undocumented 2xx status, or a body its schema refuses. */
  CONTRACT_VIOLATION: 'CONTRACT_VIOLATION',
  /**
   * The credential provider gave no value: it rejected (`error.code` `CREDENTIALS_UNAVAILABLE`) or it
   * did not answer within `timeoutMs` (`CREDENTIALS_TIMEOUT`). **No request was sent**, so nothing
   * was changed: unlike `TIMEOUT`, where the command may have been applied.
   */
  CREDENTIALS: 'CREDENTIALS',
} as const;
export type CoreErrorKind = (typeof CoreErrorKind)[keyof typeof CoreErrorKind];

/**
 * The two transport reasons of CL-21, precomputed for the Live source: `CORE_OFFLINE` (no answer,
 * time-out, 503, a gateway answer without an envelope, no credential from the provider) and
 * `UNAVAILABLE` (429, 500, a contract violation). `null` for a refusal that is the operation's own
 * answer (400 to 423).
 */
export type CoreTransportReason = 'CORE_OFFLINE' | 'UNAVAILABLE';

export interface CoreCallSuccess<Status extends number = number, Data = unknown> {
  readonly ok: true;
  readonly operationId: string;
  readonly status: Status;
  /** The body, parsed by the registry schema of this status. `undefined` when the status has no body. */
  readonly data: Data;
  /** `x-dems-epoch` as a non-negative integer (API-7), or `null` when absent or malformed. */
  readonly epoch: number | null;
  /** `x-dems-revision` as a non-negative integer (API-7), or `null` when absent or malformed. */
  readonly revision: number | null;
  /** The `x-request-id` header of the answer, or `null`. */
  readonly requestId: string | null;
}

export interface CoreCallFailure {
  readonly ok: false;
  readonly operationId: string;
  readonly kind: CoreErrorKind;
  /** The HTTP status; `null` when there was no answer. */
  readonly status: number | null;
  /**
   * The server's envelope member as `ApiErrorSchema` parses it: `code`, `message` and, when the server
   * sent them, `details` and `requestId`. For `NETWORK`, `TIMEOUT`, `CONTRACT_VIOLATION` and `CREDENTIALS`
   * it is built here.
   */
  readonly error: ApiError['error'];
  /** `retry-after` in whole seconds (delta-seconds or an HTTP date), on any status that carries it; else `null`. */
  readonly retryAfterSeconds: number | null;
  readonly transport: CoreTransportReason | null;
  /** The `x-request-id` header of the answer; the envelope's `error.requestId` when the header is absent; else `null`. */
  readonly requestId: string | null;
  /** `CONTRACT_VIOLATION` only: which members failed, as `path: issue code`. Never a value. */
  readonly issues?: readonly string[];
}

export type CoreCallResult<Success extends CoreCallSuccess = CoreCallSuccess> = Success | CoreCallFailure;

/** A programming error: an unknown operation, a missing path parameter or body, a credential in a URL. */
export class CoreClientUsageError extends Error {
  override readonly name = 'CoreClientUsageError';
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Types derived from the registry
// ═══════════════════════════════════════════════════════════════════════════════════════

export type CoreOperationTable = readonly CoreApiOperation[];

/**
 * The default table type: the registry's table with literal types (`CoreApiOperationTable`, the type
 * of `CORE_API_OPERATION_TABLE`). A client made without `operations` is typed per operation. A caller
 * that needs plain string IDs (a loop over the registry) passes the widened view,
 * `operations: CORE_API_OPERATIONS`.
 */
export type RegistryTable = CoreApiOperationTable;

type SuccessStatus = 200 | 201 | 202 | 203 | 204 | 205 | 206;
type SchemaOutput<Name> = Name extends CoreApiSchemaName ? z.output<(typeof CORE_API_SCHEMAS)[Name]> : undefined;
type SchemaInput<Name> = Name extends CoreApiSchemaName ? z.input<(typeof CORE_API_SCHEMAS)[Name]> : never;

/** True when the table's operation IDs are literal types (a table declared `as const`). */
type IsLiteralTable<Ops extends CoreOperationTable> = string extends Ops[number]['operationId'] ? false : true;

export type CoreOperationId<Ops extends CoreOperationTable = RegistryTable> = Ops[number]['operationId'];

type OperationOf<Ops extends CoreOperationTable, Id extends string> = Extract<Ops[number], { readonly operationId: Id }>;

export type CoreQueryValue = string | number | boolean | null | undefined;
export type CoreQuery = Readonly<Record<string, CoreQueryValue>>;

/** The input of an operation whose types are not known at compile time (a table that is not `as const`). */
export interface CoreLooseCallInput {
  /** Path parameters by name (the registry allows at most one, `id`). */
  readonly params?: Readonly<Record<string, string>>;
  /**
   * Query parameters of a GET. `null` and `undefined` members are left out. Never a secret (CL-6a).
   * Parsed with the operation's query schema when its registry entry names one.
   */
  readonly query?: CoreQuery;
  /** The JSON request body. */
  readonly body?: unknown;
}

type ParamsOf<Op> = Op extends { readonly pathParam: { readonly name: infer Name extends string } }
  ? { readonly params: { readonly [K in Name]: string } }
  : { readonly params?: undefined };

type BodyOf<Op> = Op extends { readonly requestBody: { readonly schema: infer Name; readonly required: infer Required } }
  ? Required extends true
    ? { readonly body: SchemaInput<Name> }
    : { readonly body?: SchemaInput<Name> }
  : { readonly body?: undefined };

type SuccessOfOperation<Op extends CoreApiOperation> = {
  [Status in keyof Op['responses'] & SuccessStatus]: CoreCallSuccess<
    Status,
    Op['responses'][Status] extends { readonly schema: infer Name } ? SchemaOutput<Name> : undefined
  >;
}[keyof Op['responses'] & SuccessStatus];

/**
 * An operation that names a query schema (`query: { schema }`) gets that schema's input type, and
 * the client parses the query with it. Any other GET takes a flat record, sent as given.
 */
type QueryOf<Op> = Op extends { readonly query: { readonly schema: infer Name } }
  ? { readonly query?: SchemaInput<Name> }
  : { readonly query?: CoreQuery };

/**
 * The three parts of one operation's input. Distributive on purpose: for a union of operations it
 * gives one intersection per operation. Written as `ParamsOf<U> & BodyOf<U> & QueryOf<U>` over a
 * union `U`, the compiler would build the cross product of three unions, which for a table of n
 * operations has n * n * n members and is refused above 100,000 (TS2590): that is n = 47.
 */
type InputOfOperation<Op> = Op extends unknown ? ParamsOf<Op> & BodyOf<Op> & QueryOf<Op> : never;

/** The typed input of operation `Id`. Loose when the table is not `as const`. */
export type CoreCallInput<Ops extends CoreOperationTable, Id extends string> =
  IsLiteralTable<Ops> extends true ? InputOfOperation<OperationOf<Ops, Id>> : CoreLooseCallInput;

/** The typed success of operation `Id`: one member per documented 2xx status. `unknown` data when the table is not `as const`. */
export type CoreCallSuccessOf<Ops extends CoreOperationTable, Id extends string> =
  IsLiteralTable<Ops> extends true ? SuccessOfOperation<OperationOf<Ops, Id>> : CoreCallSuccess;

type CallArguments<Input> = Record<never, never> extends Input ? [input?: Input] : [input: Input];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Options and the client
// ═══════════════════════════════════════════════════════════════════════════════════════

/** CL-6a: the only four things the client's debug log holds. `path` is the registry's template, never the URL. */
export interface CoreClientLogLine {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  /** `null` when there was no answer. */
  readonly status: number | null;
  readonly requestId: string | null;
}

/** A failure the client reports (CL-4): no answer, a time-out, a contract violation, no credential. Holds no body, header, URL or provider text. */
export interface CoreClientReport {
  readonly level: 'error' | 'warn';
  readonly source: 'CoreClient.call';
  readonly operationId: string;
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly kind: CoreErrorKind;
  readonly status: number | null;
  readonly message: string;
  readonly requestId: string | null;
  readonly issues?: readonly string[];
}

export interface CoreClientOptions<Ops extends CoreOperationTable = RegistryTable> {
  /** The origin every path is appended to, e.g. `http://127.0.0.1:4420`. `''` for same-origin relative URLs. */
  readonly baseUrl: string;
  readonly credentials: CoreCredentials;
  /** The transport. When left out, the runtime's global `fetch` is looked up at each call (CL-3). */
  readonly fetch?: CoreFetch;
  /**
   * The operation table. Defaults to the registry, with its literal types. Pass `CORE_API_OPERATIONS`
   * (the same table, widened) for a client that takes plain string IDs and loose input.
   */
  readonly operations?: Ops;
  /** The schemas the table's names refer to. Defaults to the registry's `CORE_API_SCHEMAS`. */
  readonly schemas?: Readonly<Record<CoreApiSchemaName, z.ZodType>>;
  /** CL-6. Defaults to `LIVE_COMMAND_TIMEOUT_MS`. */
  readonly timeoutMs?: number;
  /** Debug log sink (CL-6a). */
  readonly log?: (line: CoreClientLogLine) => void;
  /** Sink for failures that are not an answer of the contract (CL-4 "reported"). The apps pass their persistent log. */
  readonly report?: (report: CoreClientReport) => void;
  /** Clock for an HTTP-date `retry-after`. Defaults to `Date.now`. */
  readonly now?: () => number;
}

export interface CoreOperationInfo {
  readonly operationId: string;
  readonly method: 'GET' | 'POST';
  /** The registry's path template. */
  readonly path: string;
  readonly hasBody: boolean;
  readonly pathParam: string | null;
}

export interface CoreClient<Ops extends CoreOperationTable = RegistryTable> {
  /** Calls one operation. Resolves for every answer and for no answer; rejects only with `CoreClientUsageError`. */
  call<Id extends CoreOperationId<Ops>>(
    operationId: Id,
    ...input: CallArguments<CoreCallInput<Ops, Id>>
  ): Promise<CoreCallResult<CoreCallSuccessOf<Ops, Id>>>;
  /** Every operation ID the client can call: the registry's, in its order. */
  readonly operationIds: readonly CoreOperationId<Ops>[];
  /** Method and route template of one operation, or `null` for an unknown ID. */
  describe(operationId: string): CoreOperationInfo | null;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Pure helpers
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The failure class of an HTTP status that is not 2xx. */
export function coreErrorKindForStatus(status: number): CoreErrorKind {
  switch (status) {
    case 401:
      return CoreErrorKind.UNAUTHENTICATED;
    case 403:
      return CoreErrorKind.FORBIDDEN;
    case 404:
      return CoreErrorKind.NOT_FOUND;
    case 409:
      return CoreErrorKind.CONFLICT;
    case 422:
      return CoreErrorKind.INVALID;
    case 423:
      return CoreErrorKind.LOCKED;
    case 429:
      return CoreErrorKind.RATE_LIMITED;
    case 503:
      return CoreErrorKind.NOT_READY;
    default:
      if (status >= 500 && status <= 599) return CoreErrorKind.SERVER;
      if (status >= 400 && status <= 499) return CoreErrorKind.BAD_REQUEST;
      return CoreErrorKind.CONTRACT_VIOLATION;
  }
}

/** CL-21: the transport reason of a failure, or `null` when the answer is the operation's own refusal. */
export function coreTransportReason(kind: CoreErrorKind, status: number | null): CoreTransportReason | null {
  switch (kind) {
    case CoreErrorKind.NETWORK:
    case CoreErrorKind.TIMEOUT:
    case CoreErrorKind.NOT_READY:
    case CoreErrorKind.CREDENTIALS:
      return 'CORE_OFFLINE';
    case CoreErrorKind.RATE_LIMITED:
    case CoreErrorKind.SERVER:
      return 'UNAVAILABLE';
    case CoreErrorKind.CONTRACT_VIOLATION:
      // WT-4: a gateway in front of the server (the dev proxy) answers 502 to 504 without an envelope.
      return status !== null && status >= 502 && status <= 504 ? 'CORE_OFFLINE' : 'UNAVAILABLE';
    default:
      return null;
  }
}

/** `retry-after` as whole seconds: delta-seconds, or an HTTP date measured against `now`. `null` when absent or unreadable. */
export function parseRetryAfter(value: string | null, now: number): number | null {
  if (value === null) return null;
  const text = value.trim();
  if (/^\d{1,9}$/.test(text)) return Number(text);
  const at = Date.parse(text);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/** A header that holds a non-negative integer as decimal text (`x-dems-epoch`, `x-dems-revision`); `null` when absent or malformed. */
export function parseCounterHeader(value: string | null): number | null {
  if (value === null) return null;
  const text = value.trim();
  return /^\d{1,15}$/.test(text) ? Number(text) : null;
}

function usage(message: string): CoreClientUsageError {
  return new CoreClientUsageError(message);
}

function normaliseBaseUrl(baseUrl: string): string {
  if (baseUrl === '') return '';
  const match = /^(https?:\/\/[^/?#@\s]+)\/?$/.exec(baseUrl);
  if (!match?.[1]) {
    throw usage('baseUrl must be an http(s) origin without a path, a query or user information, or the empty string');
  }
  return match[1];
}

/** One value that goes into the URL, with the words that name it in an error. */
interface UrlValue {
  readonly where: string;
  readonly value: string;
}

function credentialInUrl(where: string): CoreClientUsageError {
  return usage(`${where} must not hold a credential: a secret never travels in a URL (CL-6a)`);
}

/** First half of the guard, while the path is built: a value with the form of a bearer secret. */
function assertNoCredentialPrefix({ where, value }: UrlValue): void {
  if (CREDENTIAL_PREFIX.test(value)) throw credentialInUrl(where);
}

/** Second half, once the provider has answered: the current bearer value itself, anywhere in a value. */
function assertBearerNotInUrl(values: readonly UrlValue[], bearer: string | null): void {
  if (bearer === null || bearer.length < 8) return;
  for (const { where, value } of values) {
    if (value.includes(bearer)) throw credentialInUrl(where);
  }
}

/**
 * The query members to send. With a query schema in the registry entry, the query is parsed with it
 * (defaults and normalisation apply) and a refusal is a programming error; without one, it is sent as given.
 */
function queryMembers(
  operation: CoreApiOperation,
  input: CoreLooseCallInput,
  schemas: Readonly<Record<string, z.ZodType>>,
): Readonly<Record<string, unknown>> {
  const given = input.query ?? {};
  if (operation.method !== 'get') {
    if (Object.values(given).some((value) => value !== null && value !== undefined)) {
      throw usage(`${operation.operationId} is a POST: it takes a body, not a query`);
    }
    return {};
  }
  if (!operation.query) return given;
  const schema = schemas[operation.query.schema];
  if (!schema) throw usage(`The schema table has no "${operation.query.schema}"`);
  const parsed = schema.safeParse(given);
  if (!parsed.success) {
    throw usage(`The query of ${operation.operationId} does not match ${operation.query.schema}: ${issuesOf(parsed.error).join('; ')}`);
  }
  const members: unknown = parsed.data;
  if (typeof members !== 'object' || members === null || Array.isArray(members)) {
    throw usage(`${operation.query.schema} is not an object schema: it cannot describe the query of ${operation.operationId}`);
  }
  return members as Readonly<Record<string, unknown>>;
}

/** The path with its query, and every value that went into it (for the second half of the credential guard). */
function buildPath(
  operation: CoreApiOperation,
  input: CoreLooseCallInput,
  schemas: Readonly<Record<string, z.ZodType>>,
): { readonly path: string; readonly urlValues: readonly UrlValue[] } {
  const urlValues: UrlValue[] = [];
  const guarded = (where: string, value: string): string => {
    const entry = { where, value };
    assertNoCredentialPrefix(entry);
    urlValues.push(entry);
    return encodeURIComponent(value);
  };
  const params = input.params ?? {};
  const expected = operation.pathParam?.name;
  for (const name of Object.keys(params)) {
    if (name !== expected) throw usage(`${operation.operationId} has no path parameter "${name}"`);
  }
  const path = operation.path.replace(/\{(\w+)\}/g, (_segment, name: string) => {
    const value = params[name];
    if (typeof value !== 'string' || value === '') {
      throw usage(`${operation.operationId} needs the path parameter "${name}"`);
    }
    return guarded(`Path parameter "${name}"`, value);
  });

  const pairs: string[] = [];
  for (const [name, value] of Object.entries(queryMembers(operation, input, schemas))) {
    if (value === null || value === undefined) continue;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw usage(`Query parameter "${name}" of ${operation.operationId} is not a string, a number or a boolean`);
    }
    pairs.push(`${encodeURIComponent(name)}=${guarded(`Query parameter "${name}"`, String(value))}`);
  }
  return { path: pairs.length > 0 ? `${path}?${pairs.join('&')}` : path, urlValues };
}

function issuesOf(error: z.ZodError): string[] {
  return error.issues.slice(0, 20).map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.code}`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The client
// ═══════════════════════════════════════════════════════════════════════════════════════

type Exchange = { readonly status: number; readonly text: string; readonly header: (name: string) => string | null };

/** Marks a body that is empty or not JSON (no JSON value is a symbol). */
const NOT_JSON = Symbol('not JSON');

export function createCoreClient<const Ops extends CoreOperationTable = RegistryTable>(
  options: CoreClientOptions<Ops>,
): CoreClient<Ops> {
  const table: CoreOperationTable = options.operations ?? CORE_API_OPERATIONS;
  const schemas: Readonly<Record<string, z.ZodType>> = options.schemas ?? CORE_API_SCHEMAS;
  const baseUrl = normaliseBaseUrl(options.baseUrl);
  const timeoutMs = options.timeoutMs ?? LIVE_COMMAND_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const { credentials } = options;
  if (!(timeoutMs > 0)) throw usage('timeoutMs must be above 0');
  if (credentials !== 'browser-cookie' && typeof credentials !== 'function') {
    throw usage("credentials must be 'browser-cookie' or a function that returns the bearer value");
  }

  const byId = new Map<string, CoreApiOperation>();
  for (const operation of table) {
    if (byId.has(operation.operationId)) throw usage(`The operation table names "${operation.operationId}" twice`);
    byId.set(operation.operationId, operation);
  }

  const transport = (): CoreFetch => {
    if (options.fetch) return options.fetch;
    const found = (globalThis as { fetch?: unknown }).fetch;
    if (typeof found !== 'function') throw usage('No fetch was injected and the runtime has no global fetch');
    // Called as a plain function of the global object, the way application code calls it.
    return (input, init) => (found as CoreFetch).call(globalThis, input, init);
  };

  const emit = (line: CoreClientLogLine): void => {
    try {
      options.log?.(line);
    } catch {
      // A log sink must never break a call.
    }
  };
  const report = (entry: CoreClientReport): void => {
    try {
      options.report?.(entry);
    } catch {
      // A report sink must never break a call.
    }
  };

  async function bearerValue(): Promise<string | null> {
    if (credentials === 'browser-cookie') return null;
    const value = await credentials();
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string' || !/^[\x21-\x7e]+$/.test(value)) {
      throw usage('The credential provider returned a value that cannot be a bearer token');
    }
    return value;
  }

  async function exchange(url: string, init: CoreFetchInit, send: CoreFetch): Promise<Exchange> {
    const response = await send(url, init);
    const text = await response.text();
    return { status: response.status, text, header: (name) => response.headers.get(name) };
  }

  async function call(operationId: string, input: CoreLooseCallInput = {}): Promise<CoreCallResult> {
    const operation = byId.get(operationId);
    if (!operation) throw usage(`Unknown operation "${operationId}"`);
    const method = operation.method === 'get' ? 'GET' : 'POST';

    // Everything that can be refused without the credential is refused first: an invalid call asks
    // the provider for nothing and sends nothing.
    const { path, urlValues } = buildPath(operation, input, schemas);
    const headers: Record<string, string> = { accept: 'application/json' };
    let body: string | undefined;
    if (input.body !== undefined) {
      if (!operation.requestBody) throw usage(`${operationId} takes no request body`);
      body = JSON.stringify(input.body);
      if (typeof body !== 'string') throw usage(`The body of ${operationId} is not JSON`);
      headers['content-type'] = 'application/json';
    } else if (operation.requestBody?.required) {
      throw usage(`${operationId} needs a request body`);
    }
    const send = transport();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;

    const failure = (
      kind: CoreErrorKind,
      status: number | null,
      error: ApiError['error'],
      retryAfterSeconds: number | null,
      requestId: string | null,
      issues?: readonly string[],
    ): CoreCallFailure => {
      emit({ method, path: operation.path, status, requestId });
      const result: CoreCallFailure = {
        ok: false,
        operationId,
        kind,
        status,
        error,
        retryAfterSeconds,
        transport: coreTransportReason(kind, status),
        requestId,
        ...(issues ? { issues } : {}),
      };
      if (
        kind === CoreErrorKind.NETWORK ||
        kind === CoreErrorKind.TIMEOUT ||
        kind === CoreErrorKind.CONTRACT_VIOLATION ||
        kind === CoreErrorKind.CREDENTIALS
      ) {
        report({
          level: kind === CoreErrorKind.CONTRACT_VIOLATION ? 'error' : 'warn',
          source: 'CoreClient.call',
          operationId,
          method,
          path: operation.path,
          kind,
          status,
          message: error.message,
          requestId,
          ...(issues ? { issues } : {}),
        });
      }
      return result;
    };

    // CL-6: ONE budget for the whole call. The timer starts before the credential provider is asked
    // and bounds the provider, the request and the body read together. The race settles the call even
    // when the provider never answers or a transport ignores the abort signal.
    const progress: { expired: boolean; sent: boolean } = { expired: false, sent: false };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<'TIMEOUT'>((resolve) => {
      timer = setTimeout(() => {
        progress.expired = true;
        resolve('TIMEOUT');
        controller?.abort();
      }, timeoutMs);
    });

    type Work =
      | { readonly step: 'usage'; readonly error: CoreClientUsageError }
      | { readonly step: 'no-credential' }
      | { readonly step: 'expired' }
      | { readonly step: 'no-answer' }
      | { readonly step: 'answered'; readonly value: Exchange };
    // Never rejects: every way the provider or the transport can fail becomes a value, so nothing is
    // left unhandled when the race has already been decided by the timer.
    const work = (async (): Promise<Work> => {
      let bearer: string | null;
      try {
        bearer = await bearerValue();
      } catch (error) {
        // A value that cannot be a bearer token is the caller's error; anything the provider itself
        // throws is "no credential". The provider's own words are not passed on: they can name a secret.
        return error instanceof CoreClientUsageError ? { step: 'usage', error } : { step: 'no-credential' };
      }
      // The provider answered after the budget was spent: the call has settled, nothing is sent.
      if (progress.expired) return { step: 'expired' };
      try {
        assertBearerNotInUrl(urlValues, bearer);
      } catch (error) {
        return { step: 'usage', error: error as CoreClientUsageError };
      }
      if (bearer !== null) headers.authorization = `Bearer ${bearer}`;
      const init: CoreFetchInit = {
        method,
        headers,
        credentials: credentials === 'browser-cookie' ? 'same-origin' : 'omit',
        ...(body !== undefined ? { body } : {}),
        ...(controller ? { signal: controller.signal } : {}),
      };
      progress.sent = true;
      try {
        return { step: 'answered', value: await exchange(baseUrl + path, init, send) };
      } catch {
        return { step: 'no-answer' };
      }
    })();
    const outcome = await Promise.race([work, timedOut]);
    clearTimeout(timer);

    const noCredentialInTime = (): CoreCallFailure =>
      failure(
        CoreErrorKind.CREDENTIALS,
        null,
        { code: 'CREDENTIALS_TIMEOUT', message: `The credential for this request was not available within ${timeoutMs} ms. Nothing was sent.` },
        null,
        null,
      );
    if (outcome === 'TIMEOUT') {
      if (!progress.sent) return noCredentialInTime();
      return failure(
        CoreErrorKind.TIMEOUT,
        null,
        { code: 'TIMEOUT', message: `No answer within ${timeoutMs} ms. The command may or may not have been applied.` },
        null,
        null,
      );
    }
    if (outcome.step === 'usage') throw outcome.error;
    if (outcome.step === 'expired') return noCredentialInTime();
    if (outcome.step === 'no-credential') {
      return failure(
        CoreErrorKind.CREDENTIALS,
        null,
        { code: 'CREDENTIALS_UNAVAILABLE', message: 'The credential for this request could not be read. Nothing was sent.' },
        null,
        null,
      );
    }
    if (outcome.step === 'no-answer') {
      // The transport's own message can name the URL; it is not passed on (CL-6a).
      return failure(CoreErrorKind.NETWORK, null, { code: 'NETWORK', message: 'The Core server did not answer.' }, null, null);
    }

    const { status, text, header } = outcome.value;
    const headerRequestId = header(DEFAULT_REQUEST_ID_HEADER);
    const retryAfterSeconds = parseRetryAfter(header(RETRY_AFTER_HEADER), now());
    const violation = (message: string, issues?: readonly string[]): CoreCallFailure =>
      failure(CoreErrorKind.CONTRACT_VIOLATION, status, { code: 'CONTRACT_VIOLATION', message }, retryAfterSeconds, headerRequestId, issues);
    /** The body as JSON (CL-3: text, then `JSON.parse`), or `NOT_JSON`. Called only where the contract has a body. */
    const jsonBody = (): unknown => {
      if (text === '') return NOT_JSON;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return NOT_JSON;
      }
    };

    if (status >= 200 && status <= 299) {
      const spec = operation.responses[status];
      if (!spec) return violation(`Status ${status} is not a documented answer of ${operationId}.`);
      let data: unknown;
      if (spec.schema) {
        const json = jsonBody();
        if (json === NOT_JSON) return violation(`The ${status} answer of ${operationId} is not JSON.`);
        const schema = schemas[spec.schema];
        if (!schema) throw usage(`The schema table has no "${spec.schema}"`);
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          return violation(`The ${status} answer of ${operationId} does not match ${spec.schema}.`, issuesOf(parsed.error));
        }
        data = parsed.data;
      } else if (text !== '') {
        // A success the registry gives no schema (204) has no body. Nothing is parsed.
        return violation(`The ${status} answer of ${operationId} has a body where the contract has none.`);
      }
      emit({ method, path: operation.path, status, requestId: headerRequestId });
      return {
        ok: true,
        operationId,
        status,
        data,
        epoch: parseCounterHeader(header(EPOCH_HEADER)),
        revision: parseCounterHeader(header(REVISION_HEADER)),
        requestId: headerRequestId,
      };
    }

    const json = jsonBody();
    if (json === NOT_JSON) return violation(`The ${status} answer of ${operationId} is not a JSON error envelope.`);
    const envelope = ApiErrorSchema.safeParse(json);
    if (!envelope.success) {
      return violation(`The ${status} answer of ${operationId} is not an error envelope.`, issuesOf(envelope.error));
    }
    const kind = coreErrorKindForStatus(status);
    if (kind === CoreErrorKind.CONTRACT_VIOLATION) return violation(`Status ${status} is not an answer of the contract.`);
    // The envelope member travels as parsed: `details` and `requestId` included when the server sent them.
    return failure(kind, status, envelope.data.error, retryAfterSeconds, headerRequestId ?? envelope.data.error.requestId ?? null);
  }

  return {
    call: call as CoreClient<Ops>['call'],
    operationIds: table.map((operation) => operation.operationId),
    describe(operationId) {
      const operation = byId.get(operationId);
      if (!operation) return null;
      return {
        operationId,
        method: operation.method === 'get' ? 'GET' : 'POST',
        path: operation.path,
        hasBody: operation.requestBody !== undefined,
        pathParam: operation.pathParam?.name ?? null,
      };
    },
  };
}
