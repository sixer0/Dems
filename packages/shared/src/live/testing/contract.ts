/**
 * The contract checks of the fake transport (HB-11; 04_client_integration_spec §12.2 TS-11, TS-12).
 * Pure functions over the operation registry of `../../api`: nothing here keeps state, sends
 * anything or knows a test runner.
 *
 * - **On the way in** (`checkRequest`): a request must be one the contract defines. Method and
 *   path match one operation of the table; the path parameter fits the pattern the operation
 *   states; the query parses with the operation's query schema; the body parses with its request
 *   schema; a credential travels only as `Authorization: Bearer` with a session token or a device
 *   credential, never in the URL and never together with a cookie.
 * - **On the way out** (`checkAnswer`): a scripted answer must be one the Core server may send.
 *   The verdict on status and body is the contract's own `validateCoreApiResponse` when the table
 *   is the registry (TS-12); a table written by hand is checked by the same rules against its own
 *   schemas. On top of it: the headers the contract requires (API-7, `retry-after`, the request ID).
 *
 * The table is read when a fake is made, so the checks cover every operation the registry holds
 * at that moment, however many there are.
 *
 * What a failed check reports is a reason and, per failed member, `path: issue code`. Never a
 * value of the request: a body can hold a password, a pairing code or a token.
 */
import {
  API_BODY_LIMIT_BYTES,
  EPOCH_HEADER_NAME,
  REQUEST_ID_HEADER_NAME,
  RETRY_AFTER_HEADER_NAME,
  REVISION_HEADER_NAME,
} from '../../api/constants';
import {
  CORE_API_ENVELOPE_RESPONSES,
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  CoreApiEnvelopeStage,
  validateCoreApiEnvelopeResponse,
  validateCoreApiResponse,
  type CoreApiOperation,
  type CoreApiValidation,
} from '../../api/core-api';
import { DEVICE_CREDENTIAL_PATTERN, SESSION_TOKEN_PATTERN } from '../../api/patterns';
import { FakeRequestViolation, FakeResponseViolation, FakeTransportUsageError, holdsCredential } from './errors';

// ═══════════════════════════════════════════════════════════════════════════════════════
// The contract a fake checks against
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface ContractIssue {
  readonly path: readonly PropertyKey[];
  readonly code?: string;
  readonly message: string;
}

export type ContractParse =
  | { readonly success: true; readonly data: unknown }
  | { readonly success: false; readonly error: { readonly issues: readonly ContractIssue[] } };

/** The part of a schema the fake uses. Every schema of the registry (zod) satisfies it. */
export interface ContractSchema {
  safeParse(input: unknown): ContractParse;
}

interface Route {
  readonly operation: CoreApiOperation;
  readonly names: readonly string[];
  readonly regex: RegExp;
}

export interface FakeContract {
  readonly operations: readonly CoreApiOperation[];
  readonly schemas: Readonly<Record<string, ContractSchema>>;
  /** True when the table and the schemas are the registry's own. */
  readonly isRegistry: boolean;
  readonly byId: ReadonlyMap<string, CoreApiOperation>;
  readonly routes: readonly Route[];
  /** Every literal path segment of the table: what a route in an error message may show. */
  readonly literals: ReadonlySet<string>;
}

/** The table and the schemas a fake checks against. Both default to the registry. */
export function createFakeContract(
  operations?: readonly CoreApiOperation[],
  schemas?: Readonly<Record<string, ContractSchema>>,
): FakeContract {
  const table = operations ?? CORE_API_OPERATIONS;
  const named: Readonly<Record<string, ContractSchema>> = schemas ?? CORE_API_SCHEMAS;
  const byId = new Map<string, CoreApiOperation>();
  const literals = new Set<string>();
  const routes: Route[] = [];
  for (const operation of table) {
    if (byId.has(operation.operationId)) throw new FakeTransportUsageError(`the operation table names "${operation.operationId}" twice`);
    byId.set(operation.operationId, operation);
    const names: string[] = [];
    const source = operation.path
      .split('/')
      .map((segment) => {
        const param = /^\{(\w+)\}$/.exec(segment);
        if (!param?.[1]) {
          literals.add(segment);
          return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        names.push(param[1]);
        return '([^/]+)';
      })
      .join('/');
    routes.push({ operation, names, regex: new RegExp(`^${source}$`) });
  }
  return {
    operations: table,
    schemas: named,
    isRegistry: table === CORE_API_OPERATIONS && named === CORE_API_SCHEMAS,
    byId,
    routes,
    literals,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// URLs (read without the platform's URL class, which not every target runtime has in full)
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface ParsedUrl {
  /** Lower case, without `://`; `null` for a relative URL. */
  readonly scheme: string | null;
  /** Host and port; `null` for a relative URL. */
  readonly authority: string | null;
  readonly pathname: string;
  /** Decoded query members; the last value of a repeated name. */
  readonly query: Readonly<Record<string, string>>;
  readonly repeatedQueryNames: readonly string[];
  readonly hasQuery: boolean;
  readonly hasFragment: boolean;
  /** The URL has a user part (`user:secret@host`). */
  readonly hasUserInfo: boolean;
}

const URL_PARTS = /^(?:([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(#[\s\S]*)?$/;

/** Reads an absolute or a relative URL. `null` when it cannot be read or a query part is not valid percent-encoding. */
export function parseUrl(text: string): ParsedUrl | null {
  const parts = URL_PARTS.exec(text);
  if (!parts) return null;
  const [, scheme, authority, pathname = '', rawQuery, fragment] = parts;
  const query: Record<string, string> = {};
  const repeated: string[] = [];
  if (rawQuery !== undefined && rawQuery !== '') {
    for (const pair of rawQuery.split('&')) {
      if (pair === '') continue;
      const at = pair.indexOf('=');
      let name: string;
      let value: string;
      try {
        name = decodeURIComponent(at < 0 ? pair : pair.slice(0, at));
        value = decodeURIComponent(at < 0 ? '' : pair.slice(at + 1));
      } catch {
        return null;
      }
      if (Object.prototype.hasOwnProperty.call(query, name)) repeated.push(name);
      query[name] = value;
    }
  }
  return {
    scheme: scheme === undefined ? null : scheme.toLowerCase(),
    authority: authority ?? null,
    pathname,
    query,
    repeatedQueryNames: repeated,
    hasQuery: Object.keys(query).length > 0,
    hasFragment: fragment !== undefined,
    hasUserInfo: authority !== undefined && authority.includes('@'),
  };
}

/** The path with every segment that is not a literal of the table replaced, so that no value shows. */
export function maskedRoute(contract: FakeContract, pathname: string): string {
  const segments = pathname.split('/').slice(0, 12);
  return segments.map((segment) => (segment === '' || contract.literals.has(segment) ? segment : '{?}')).join('/') || '/';
}

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Where a URL holds a credential-shaped value: the user part, a path segment, a query name or value. */
export function credentialPlacesInUrl(url: ParsedUrl): string[] {
  const places: string[] = [];
  if (url.hasUserInfo) places.push('user part');
  url.pathname.split('/').forEach((segment, index) => {
    if (holdsCredential(decoded(segment))) places.push(`path segment ${index}`);
  });
  for (const [name, value] of Object.entries(url.query)) {
    if (holdsCredential(name)) places.push('query name');
    else if (holdsCredential(value)) places.push(`query.${name}`);
  }
  return places;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════════════════════════

/** `path: issue code` per issue, at most 20. A path names members; it is never a value. */
export function issuePaths(issues: readonly ContractIssue[]): string[] {
  return issues.slice(0, 20).map((issue) => `${issue.path.map((part) => String(part)).join('.') || '(root)'}: ${issue.code ?? 'invalid'}`);
}

/** Bytes of the text in UTF-8, counted without an encoder class. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && index + 1 < text.length) {
      // A surrogate pair is one code point of four bytes.
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * The credential a set of headers carries, checked for its form. A bearer value is a session
 * token or a device credential (01_specs §4.1); a biometric token never travels in a header
 * (§5.6); a request carries one credential, so no cookie beside a bearer value (ID-12).
 */
export function credentialFormIssues(headers: Readonly<Record<string, string>>, credentialsMode: string | null): string[] {
  const authorization = headers.authorization;
  if (authorization === undefined) return [];
  const issues: string[] = [];
  const bearer = /^Bearer ([\x21-\x7e]+)$/.exec(authorization);
  if (!bearer?.[1]) issues.push('authorization: expected "Bearer <value>"');
  else if (!SESSION_TOKEN_PATTERN.test(bearer[1]) && !DEVICE_CREDENTIAL_PATTERN.test(bearer[1])) {
    issues.push('authorization: the bearer value has the form of neither a session token nor a device credential');
  }
  if (headers.cookie !== undefined) issues.push('cookie: one credential per request, no cookie beside a bearer value');
  if (credentialsMode !== null && credentialsMode !== 'omit') issues.push('credentials: a bearer request sends no cookie, expected "omit"');
  return issues;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// On the way in
// ═══════════════════════════════════════════════════════════════════════════════════════

export type RequestBodyFacts =
  | { readonly kind: 'none' }
  | { readonly kind: 'text'; readonly text: string }
  /** Something that is not text (a form, a stream, an object). */
  | { readonly kind: 'other' };

export interface RequestFacts {
  /** Upper case. */
  readonly method: string;
  readonly url: ParsedUrl | null;
  /** By lower-case name. */
  readonly headers: Readonly<Record<string, string>>;
  /** Names of headers whose value was not text. */
  readonly headerProblems: readonly string[];
  /** The `credentials` member of the request, when one was given. */
  readonly credentialsMode: string | null;
  readonly body: RequestBodyFacts;
}

export type RequestCheck =
  | {
      readonly ok: true;
      readonly operation: CoreApiOperation;
      readonly params: Readonly<Record<string, string>>;
    }
  | {
      readonly ok: false;
      readonly operation: CoreApiOperation | null;
      readonly params: Readonly<Record<string, string>>;
      readonly reason: FakeRequestViolation;
      readonly issues: readonly string[];
      /** The route template, or the masked path when no operation matched. */
      readonly route: string;
    };

interface Matched {
  readonly operation: CoreApiOperation;
  readonly params: Readonly<Record<string, string>>;
}

/** The operation a method and a path name, or why there is none. */
export function matchOperation(
  contract: FakeContract,
  method: string,
  pathname: string,
): Matched | typeof FakeRequestViolation.UNKNOWN_ROUTE | typeof FakeRequestViolation.METHOD_NOT_ALLOWED | typeof FakeRequestViolation.INVALID_URL {
  const verb = method.toLowerCase();
  let otherMethod = false;
  for (const route of contract.routes) {
    const found = route.regex.exec(pathname);
    if (!found) continue;
    if (route.operation.method !== verb) {
      otherMethod = true;
      continue;
    }
    const params: Record<string, string> = {};
    for (let index = 0; index < route.names.length; index += 1) {
      try {
        params[route.names[index] ?? `p${index}`] = decodeURIComponent(found[index + 1] ?? '');
      } catch {
        return FakeRequestViolation.INVALID_URL;
      }
    }
    return { operation: route.operation, params };
  }
  return otherMethod ? FakeRequestViolation.METHOD_NOT_ALLOWED : FakeRequestViolation.UNKNOWN_ROUTE;
}

/** A number or a boolean written as text, the way a query carries it; `undefined` for any other text. */
function scalarOf(text: string): number | boolean | undefined {
  if (text === 'true') return true;
  if (text === 'false') return false;
  return /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text) ? Number(text) : undefined;
}

/**
 * Parses the query as it travelled. A query carries text only, so a member the schema refuses as
 * text is tried once more as the number or the boolean it spells.
 */
function queryIssues(schema: ContractSchema, wire: Readonly<Record<string, string>>): string[] {
  const asText = schema.safeParse(wire);
  if (asText.success) return [];
  const decodedQuery: Record<string, unknown> = { ...wire };
  let changed = false;
  for (const issue of asText.error.issues) {
    const name = issue.path[0];
    if (typeof name !== 'string') continue;
    const text = wire[name];
    const value = text === undefined ? undefined : scalarOf(text);
    if (value === undefined) continue;
    decodedQuery[name] = value;
    changed = true;
  }
  if (!changed) return issuePaths(asText.error.issues);
  const asValues = schema.safeParse(decodedQuery);
  return asValues.success ? [] : issuePaths(asValues.error.issues);
}

function schemaOf(contract: FakeContract, name: string): ContractSchema {
  const schema = contract.schemas[name];
  if (!schema) throw new FakeTransportUsageError(`the schema table has no "${name}"`);
  return schema;
}

/** Checks one request against the contract (TS-11). */
export function checkRequest(contract: FakeContract, facts: RequestFacts): RequestCheck {
  const refuse = (
    reason: FakeRequestViolation,
    issues: readonly string[],
    matched: Matched | null,
    route: string,
  ): RequestCheck => ({ ok: false, operation: matched?.operation ?? null, params: matched?.params ?? {}, reason, issues, route });

  const { url } = facts;
  if (!url) return refuse(FakeRequestViolation.INVALID_URL, ['url: cannot be read'], null, '(unreadable)');
  const shown = maskedRoute(contract, url.pathname);
  if (url.scheme !== null && url.scheme !== 'http' && url.scheme !== 'https') {
    return refuse(FakeRequestViolation.INVALID_URL, ['url: the scheme is neither http nor https'], null, shown);
  }
  if (url.hasFragment) return refuse(FakeRequestViolation.INVALID_URL, ['url: has a fragment'], null, shown);

  const places = credentialPlacesInUrl(url);
  if (facts.method !== 'GET' && facts.method !== 'POST') {
    return refuse(FakeRequestViolation.METHOD_NOT_ALLOWED, ['method: the contract has GET and POST only'], null, shown);
  }
  const matched = matchOperation(contract, facts.method, url.pathname);
  if (typeof matched === 'string') {
    // A credential in a URL is reported even when the route is unknown: it is the graver finding.
    if (places.length > 0) return refuse(FakeRequestViolation.CREDENTIAL_IN_URL, places, null, shown);
    return refuse(matched, [], null, shown);
  }
  const { operation, params } = matched;
  const route = operation.path;
  if (places.length > 0) return refuse(FakeRequestViolation.CREDENTIAL_IN_URL, places, matched, route);

  const param = operation.pathParam;
  if (param) {
    const value = params[param.name];
    if (value === undefined || !param.pattern.test(value)) {
      return refuse(FakeRequestViolation.INVALID_PATH_PARAM, [`${param.name}: does not match the pattern of the operation`], matched, route);
    }
  }

  if (url.hasQuery) {
    if (operation.method !== 'get' || !operation.query) {
      return refuse(FakeRequestViolation.UNEXPECTED_QUERY, Object.keys(url.query).map((name) => `query.${name}: not in the contract`), matched, route);
    }
    if (url.repeatedQueryNames.length > 0) {
      return refuse(FakeRequestViolation.INVALID_QUERY, url.repeatedQueryNames.map((name) => `${name}: repeated`), matched, route);
    }
  }
  if (operation.method === 'get' && operation.query) {
    const issues = queryIssues(schemaOf(contract, operation.query.schema), url.query);
    if (issues.length > 0) return refuse(FakeRequestViolation.INVALID_QUERY, issues, matched, route);
  }

  if (facts.headerProblems.length > 0) {
    return refuse(FakeRequestViolation.INVALID_HEADERS, facts.headerProblems.map((name) => `${name}: not text`), matched, route);
  }
  const credentialIssues = credentialFormIssues(facts.headers, facts.credentialsMode);
  if (credentialIssues.length > 0) return refuse(FakeRequestViolation.INVALID_CREDENTIAL_FORM, credentialIssues, matched, route);

  const hasBody = facts.body.kind === 'other' || (facts.body.kind === 'text' && facts.body.text !== '');
  const expected = operation.requestBody;
  if (hasBody && (operation.method === 'get' || !expected)) {
    return refuse(FakeRequestViolation.UNEXPECTED_BODY, ['body: the operation takes none'], matched, route);
  }
  if (!hasBody) {
    if (expected?.required) return refuse(FakeRequestViolation.MISSING_BODY, [`body: ${expected.schema} is required`], matched, route);
    return { ok: true, operation, params };
  }
  if (facts.body.kind !== 'text' || !expected) return refuse(FakeRequestViolation.BODY_NOT_JSON, ['body: not text'], matched, route);
  if (!/^application\/json\s*(?:;.*)?$/i.test(facts.headers['content-type'] ?? '')) {
    return refuse(FakeRequestViolation.INVALID_HEADERS, ['content-type: a body travels as application/json'], matched, route);
  }
  if (utf8Length(facts.body.text) > API_BODY_LIMIT_BYTES) {
    return refuse(FakeRequestViolation.BODY_TOO_LARGE, [`body: more than ${API_BODY_LIMIT_BYTES} bytes`], matched, route);
  }
  let json: unknown;
  try {
    json = JSON.parse(facts.body.text) as unknown;
  } catch {
    return refuse(FakeRequestViolation.BODY_NOT_JSON, ['body: not JSON'], matched, route);
  }
  const parsed = schemaOf(contract, expected.schema).safeParse(json);
  if (!parsed.success) return refuse(FakeRequestViolation.INVALID_BODY, issuePaths(parsed.error.issues), matched, route);
  return { ok: true, operation, params };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// On the way out
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface AnswerFacts {
  readonly status: number;
  /** The body as it will travel: the JSON text read back. `undefined` when the answer has no body. */
  readonly body: unknown;
  readonly hasBody: boolean;
  /** The body was given as raw text instead of a JSON value. */
  readonly rawText: boolean;
  /** By lower-case name, as the answer will carry them. */
  readonly headers: Readonly<Record<string, string>>;
}

export type AnswerCheck = { readonly ok: true } | { readonly ok: false; readonly reason: FakeResponseViolation; readonly issues: readonly string[] };

/** The rules of `validateCoreApiResponse`, for a table that is not the registry. */
function validateAgainstTable(contract: FakeContract, operation: CoreApiOperation, status: number, body: unknown): CoreApiValidation {
  const spec = operation.responses[status];
  if (!spec) {
    const entry = CORE_API_ENVELOPE_RESPONSES.find(
      (candidate) => candidate.status === status && candidate.stage === CoreApiEnvelopeStage.PIPELINE,
    );
    if (!entry) return { ok: false, reason: 'UNDOCUMENTED_STATUS', issues: [String(status)] };
    return validateCoreApiEnvelopeResponse(status, body);
  }
  if (!spec.schema) {
    return body === undefined || body === null ? { ok: true } : { ok: false, reason: 'UNEXPECTED_BODY', issues: [] };
  }
  const parsed = schemaOf(contract, spec.schema).safeParse(body);
  if (parsed.success) return { ok: true };
  return {
    ok: false,
    reason: 'INVALID_BODY',
    issues: parsed.error.issues.map((issue) => `${issue.path.map((part) => String(part)).join('.') || '(root)'}: ${issue.message}`),
  };
}

const COUNTER = /^\d{1,15}$/;

/** The headers the contract requires on an answer; what is wrong with them, as `name: finding`. */
function answerHeaderIssues(operation: CoreApiOperation, facts: AnswerFacts): string[] {
  const issues: string[] = [];
  const { headers, status } = facts;
  const requestId = headers[REQUEST_ID_HEADER_NAME];
  if (requestId === undefined || requestId === '') issues.push(`${REQUEST_ID_HEADER_NAME}: missing`);
  else {
    const envelope = facts.body as { readonly error?: { readonly requestId?: unknown } } | null | undefined;
    const repeated = typeof envelope === 'object' && envelope !== null ? envelope.error?.requestId : undefined;
    if (typeof repeated === 'string' && repeated !== requestId) issues.push(`${REQUEST_ID_HEADER_NAME}: differs from error.requestId`);
  }
  if (operation.method === 'post' && status >= 200 && status <= 299) {
    // API-7: every 2xx answer of a POST carries the epoch and the revision, as non-negative integers.
    for (const name of [EPOCH_HEADER_NAME, REVISION_HEADER_NAME]) {
      const value = headers[name];
      if (value === undefined) issues.push(`${name}: missing`);
      else if (!COUNTER.test(value)) issues.push(`${name}: not a non-negative integer`);
    }
  }
  for (const entry of CORE_API_ENVELOPE_RESPONSES) {
    const required: string | undefined = 'header' in entry ? entry.header : undefined;
    if (entry.status !== status || required === undefined || operation.responses[status]) continue;
    const value = headers[required];
    if (value === undefined) issues.push(`${required}: missing`);
    else if (required === RETRY_AFTER_HEADER_NAME && !/^\d{1,9}$/.test(value)) issues.push(`${required}: not whole seconds`);
  }
  return issues;
}

/** Checks one scripted answer against the contract (TS-12). */
export function checkAnswer(contract: FakeContract, operation: CoreApiOperation, facts: AnswerFacts): AnswerCheck {
  if (facts.rawText) return { ok: false, reason: FakeResponseViolation.BODY_NOT_JSON, issues: ['body: given as raw text'] };
  const { status } = facts;
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    return { ok: false, reason: FakeResponseViolation.UNDOCUMENTED_STATUS, issues: ['status: not an HTTP status'] };
  }
  const spec = operation.responses[status];
  if (spec && !spec.schema && facts.hasBody) {
    return { ok: false, reason: FakeResponseViolation.UNEXPECTED_BODY, issues: [`body: a ${status} of ${operation.operationId} has none`] };
  }
  const body = facts.hasBody ? facts.body : undefined;
  const verdict = contract.isRegistry
    ? validateCoreApiResponse(operation.operationId, status, body)
    : validateAgainstTable(contract, operation, status, body);
  if (!verdict.ok) {
    const reason =
      verdict.reason === 'UNKNOWN_OPERATION'
        ? FakeResponseViolation.UNKNOWN_OPERATION
        : verdict.reason === 'UNDOCUMENTED_STATUS'
          ? FakeResponseViolation.UNDOCUMENTED_STATUS
          : verdict.reason === 'UNEXPECTED_BODY'
            ? FakeResponseViolation.UNEXPECTED_BODY
            : FakeResponseViolation.INVALID_BODY;
    const issues =
      reason === FakeResponseViolation.UNDOCUMENTED_STATUS
        ? [`status ${status}: named neither by ${operation.operationId} nor by the pipeline answers of the envelope`]
        : verdict.issues;
    return { ok: false, reason, issues };
  }
  const headerIssues = answerHeaderIssues(operation, facts);
  if (headerIssues.length > 0) return { ok: false, reason: FakeResponseViolation.INVALID_HEADERS, issues: headerIssues };
  return { ok: true };
}
