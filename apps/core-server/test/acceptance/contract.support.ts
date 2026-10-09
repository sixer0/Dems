// Support of the acceptance test "contract conformance" (plan row W52; not a test file).
//
// Three things live here, all pure or bound to an app the test hands in:
//
//   1. the comparison of routes and operations, as functions of plain lists, so that the test
//      can show that it fails by feeding them a changed INPUT (an extra route, a missing
//      operation) and never by changing a file in the tree;
//   2. the ledger: EVERY answer the test file receives goes through `Ledger.record`, which
//      checks it against the contract, the header set of OR-9, API-7, decision D69 and the rule
//      "never a 500", and files it under its operation and status;
//   3. the tables the test derives from the registry: the error codes each status of each
//      operation may carry (finding F49: the validator checks a status by its SCHEMA, so the
//      codes need a table of their own), and the free-text members of every request schema.
//
// Secrets (P19). A problem line names method, URL, caller label, status and code. It never holds
// a header, a payload or a body: a URL of this file carries identifiers only.
import {
  ALLOW_HEADER_NAME,
  API_ERROR_CODES,
  API_TEXT_RULE_MESSAGE,
  CORE_API_ENVELOPE_RESPONSES,
  CORE_API_EXAMPLES,
  CORE_API_SCHEMAS,
  CoreApiEnvelopeStage,
  REQUEST_ID_HEADER_NAME,
  RETRY_AFTER_HEADER_NAME,
  listCoreApiResponseStatuses,
  validateCoreApiEnvelopeResponse,
  validateCoreApiResponse,
  type CoreApiRegistryOperation,
} from '@dems/shared/api';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import type { z } from 'zod';

// ── 1. Routes against operations ───────────────────────────────────────────────────────────────

/** `GET /api/v1/session/{id}/start`: one spelling for a route, a registry entry and a document path. */
export const routeKey = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;

/** Fastify's pattern (`/session/:id/start`) as the registry writes the path (`/session/{id}/start`). */
export const templateOf = (pattern: string): string => pattern.replace(/:(\w+)/g, '{$1}');

export interface RouteComparison {
  /** Registered and not documented, the named exceptions left out. */
  readonly undocumented: string[];
  /** Documented and not registered. */
  readonly unregistered: string[];
}

/** Both directions at once. Every argument is a list of `routeKey`s. */
export function compareRoutes(registered: readonly string[], documented: readonly string[], exceptions: readonly string[] = []): RouteComparison {
  const known = new Set(documented);
  const present = new Set(registered);
  return {
    undocumented: registered.filter((route) => !known.has(route) && !exceptions.includes(route)).sort(),
    unregistered: documented.filter((route) => !present.has(route)).sort(),
  };
}

// ── 2. The header set, by the text of the specification ────────────────────────────────────────

/**
 * Spec §14.2 OR-9, copied from the specification and NOT imported from the server: "Every answer
 * of the Core server, success or error, carries `Cache-Control: no-store`,
 * `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none';
 * frame-ancestors 'none'`, `Cross-Origin-Resource-Policy: same-origin` and `Referrer-Policy:
 * no-referrer`". Lower-case names, as Node reports them.
 */
export const OR9_HEADERS: Readonly<Record<string, string>> = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
};
/** OR-9: "a JSON body is sent as `application/json; charset=utf-8`". */
export const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
/**
 * OR-9: "`Strict-Transport-Security` is not sent: there is no TLS." API-10: "the header
 * `x-dems-simulated` is sent only by the in-app simulator; the server never sends it".
 */
export const NEVER_SENT: readonly string[] = ['strict-transport-security', 'x-dems-simulated'];
/** API-7: the two revision headers of every 2xx answer of a POST. */
export const EPOCH_HEADER = 'x-dems-epoch';
export const REVISION_HEADER = 'x-dems-revision';

// ── 3. The error codes a status may carry (finding F49, rule F-5 of contract C) ────────────────

const CODE_WORD = /\b[A-Z][A-Z_]{3,}\b/g;
const isCode = (word: string): boolean => (API_ERROR_CODES as readonly string[]).includes(word);

/**
 * The two texts of a status: `description`, and the `all`-scope text a status of one of the ten
 * existing operations may add (`coreServerDescription`, W83 / decision D184 DQ-1).
 */
function statusTexts(spec: { description: string; coreServerDescription?: string }): string {
  return spec.coreServerDescription === undefined ? spec.description : `${spec.description} ${spec.coreServerDescription}`;
}

/**
 * The codes the REGISTRY names for a status of an operation: the code words of the status's
 * texts (both scopes), and the codes of its examples. For a status the operation does not document, and
 * beside the operation's own for one it does: the codes of the envelope-level pipeline answers
 * (`CORE_API_ENVELOPE_RESPONSES`), which no operation repeats.
 */
export function registryCodes(operation: CoreApiRegistryOperation, status: number): string[] {
  const codes = new Set<string>();
  const spec = operation.responses[status];
  if (spec !== undefined) {
    for (const word of statusTexts(spec).match(CODE_WORD) ?? []) if (isCode(word)) codes.add(word);
    for (const example of Object.values(CORE_API_EXAMPLES[operation.operationId]?.responses[status] ?? {})) {
      const code = (example.value as { error?: { code?: unknown } } | null)?.error?.code;
      if (typeof code === 'string') codes.add(code);
    }
  }
  for (const entry of CORE_API_ENVELOPE_RESPONSES) {
    if (entry.status === status && entry.stage === CoreApiEnvelopeStage.PIPELINE) for (const code of entry.codes) codes.add(code);
  }
  return [...codes].sort();
}

/** The codes an operation's OWN entry names for a status: the description and the examples, without the envelope's. */
export function ownCodes(operation: CoreApiRegistryOperation, status: number): string[] {
  const spec = operation.responses[status];
  if (spec === undefined) return [];
  const codes = new Set<string>((statusTexts(spec).match(CODE_WORD) ?? []).filter(isCode));
  for (const example of Object.values(CORE_API_EXAMPLES[operation.operationId]?.responses[status] ?? {})) {
    const code = (example.value as { error?: { code?: unknown } } | null)?.error?.code;
    if (typeof code === 'string') codes.add(code);
  }
  return [...codes].sort();
}

// ── 4. The ledger ──────────────────────────────────────────────────────────────────────────────

/** `web`: a cookie, or a web console `Origin`. `device`: a bearer value. `public`: neither. */
export type CallerKind = 'web' | 'device' | 'public';

export interface Sent {
  /** The registry operation the request is for; null for a request that matches no operation. */
  readonly operationId: string | null;
  readonly method: string;
  readonly url: string;
  /** Who sent it, as a label: `SUPERVISOR (web)`, `nobody`, `tablet credential`. Never a credential. */
  readonly caller: string;
  readonly callerKind: CallerKind;
  /** The case the request stands for, in words. */
  readonly note: string;
  /** A request that shows a KNOWN contract gap: its answer is listed, not judged by the validator. */
  readonly knownGap?: string;
}

export interface Answer extends Sent {
  readonly status: number;
  /** The error code of an envelope answer; null for any other body. */
  readonly code: string | null;
  readonly body: unknown;
  readonly response: LightMyRequestResponse;
}

export interface Problem {
  readonly kind: 'contract' | 'header' | 'content-type' | 'cookie' | 'api-7' | 'server-error' | 'code' | 'leak';
  readonly text: string;
}

export interface CodeMismatch {
  readonly operationId: string;
  readonly status: number;
  readonly code: string;
  readonly named: string[];
}

/** The facts of the server at the moment an answer was received. */
export interface ServerFacts {
  readonly epoch: number;
  readonly revision: number;
  readonly cookieName: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The members of `body` that its schema does not have: the paths that are in the body and not in
 * what the schema made of it. zod drops an unknown member of an object that is not strict, so the
 * validator accepts such a body for 26 of the contract's response schemas (finding of this row);
 * this comparison refuses it for every schema alike.
 */
export function undocumentedMembers(body: unknown, parsed: unknown, path = ''): string[] {
  if (Array.isArray(body) && Array.isArray(parsed)) return body.flatMap((element: unknown, index) => undocumentedMembers(element, parsed[index], `${path}[${index}]`));
  if (isRecord(body) && isRecord(parsed)) {
    return Object.keys(body).flatMap((key) => {
      const place = path === '' ? key : `${path}.${key}`;
      return key in parsed ? undocumentedMembers(body[key], parsed[key], place) : [place];
    });
  }
  return [];
}

const STACK_TRACE = /\n\s+at .+:\d+:\d+|node:internal|node_modules|\.ts:\d+:\d+/;

export const describeSent = (sent: Sent): string => `${sent.method} ${sent.url} as ${sent.caller} (${sent.note})`;
export const describeAnswer = (answer: Answer): string => `${describeSent(answer)} -> ${answer.status}${answer.code === null ? '' : ` ${answer.code}`}`;

function setCookiesOf(response: LightMyRequestResponse): string[] {
  const header = response.headers['set-cookie'];
  if (header === undefined) return [];
  return Array.isArray(header) ? header : [String(header)];
}

export class Ledger {
  readonly answers: Answer[] = [];
  readonly problems: Problem[] = [];
  /** An error code that the registry does not name for its operation and status. */
  readonly codeMismatches: CodeMismatch[] = [];
  /** What the validator said about the answers of the known-gap requests, by gap. */
  readonly gapVerdicts: Array<{ gap: string; answer: Answer; verdict: string }> = [];
  /** How many answers passed each check: a check that judged nothing proves nothing. */
  readonly judged = { contract: 0, members: 0, headers: 0, jsonBodies: 0, requestIds: 0, api7: 0, api7AtEngineRevision: 0, cookieSet: 0, cookieCleared: 0, cookieNone: 0 };
  readonly #operations: ReadonlyMap<string, CoreApiRegistryOperation>;

  constructor(operations: readonly CoreApiRegistryOperation[]) {
    this.#operations = new Map(operations.map((operation) => [operation.operationId, operation]));
  }

  #problem(kind: Problem['kind'], answer: Answer, text: string): void {
    this.problems.push({ kind, text: `${describeAnswer(answer)}: ${text}` });
  }

  record(sent: Sent, response: LightMyRequestResponse, facts: ServerFacts): Answer {
    let body: unknown;
    let parsed = true;
    if (response.body !== '') {
      try {
        body = response.json();
      } catch {
        parsed = false;
      }
    }
    const code = (body as { error?: { code?: unknown } } | null | undefined)?.error?.code;
    const answer: Answer = { ...sent, status: response.statusCode, code: typeof code === 'string' ? code : null, body, response };
    this.answers.push(answer);

    // Never a 500 (rule 4 of the row; SR-50): a finding with its request.
    if (answer.status >= 500 && answer.status !== 503) this.#problem('server-error', answer, 'the server answered a 5xx');
    // AC-B-14, SR-50: no stack trace, no internal text.
    if (STACK_TRACE.test(response.body)) this.#problem('leak', answer, 'the body holds something of the form of a stack trace');

    // OR-9 / SR-76 / AC-B-14: the five headers with their values, on every answer.
    for (const [name, value] of Object.entries(OR9_HEADERS)) {
      if (response.headers[name] !== value) this.#problem('header', answer, `${name} is ${JSON.stringify(response.headers[name])}, expected ${JSON.stringify(value)}`);
    }
    for (const name of NEVER_SENT) if (response.headers[name] !== undefined) this.#problem('header', answer, `${name} is sent`);
    this.judged.headers += 1;
    if (response.body !== '') {
      if (!parsed) this.#problem('content-type', answer, 'the body is not JSON');
      if (response.headers['content-type'] !== JSON_CONTENT_TYPE) this.#problem('content-type', answer, `content-type is ${JSON.stringify(response.headers['content-type'])}`);
      this.judged.jsonBodies += 1;
    }

    // §7.2: 405 comes with `allow`, 429 with `retry-after` (whole seconds).
    if (answer.status === 405 && String(response.headers[ALLOW_HEADER_NAME] ?? '') === '') this.#problem('header', answer, 'a 405 without `allow`');
    if (answer.status === 429 && !/^[1-9]\d*$/.test(String(response.headers[RETRY_AFTER_HEADER_NAME] ?? ''))) this.#problem('header', answer, 'a 429 without `retry-after` in whole seconds');
    // The envelope: `error.requestId` is "the same value as the `x-request-id` header".
    const requestId = (body as { error?: { requestId?: unknown } } | null | undefined)?.error?.requestId;
    if (answer.status >= 400) {
      if (requestId !== response.headers[REQUEST_ID_HEADER_NAME] || typeof requestId !== 'string') this.#problem('contract', answer, 'error.requestId is not the value of the x-request-id header');
      this.judged.requestIds += 1;
    }

    // API-7: both revision headers on every 2xx answer of a POST.
    if (sent.method === 'POST' && answer.status >= 200 && answer.status < 300) {
      const epoch = response.headers[EPOCH_HEADER];
      const revision = response.headers[REVISION_HEADER];
      if (typeof epoch !== 'string' || !/^\d+$/.test(epoch)) this.#problem('api-7', answer, `${EPOCH_HEADER} is ${JSON.stringify(epoch)}`);
      else if (Number(epoch) !== facts.epoch) this.#problem('api-7', answer, `${EPOCH_HEADER} is ${epoch}, the engine's epoch is ${facts.epoch}`);
      if (typeof revision !== 'string' || !/^\d+$/.test(revision)) this.#problem('api-7', answer, `${REVISION_HEADER} is ${JSON.stringify(revision)}`);
      else if (Number(revision) > facts.revision) this.#problem('api-7', answer, `${REVISION_HEADER} is ${revision}, beyond the engine's revision ${facts.revision}`);
      else if (Number(revision) === facts.revision) this.judged.api7AtEngineRevision += 1;
      this.judged.api7 += 1;
    }

    // Decision D69 and rule 6 of the row: a web sign-in is the only answer that sets the cookie,
    // a web sign-out the only one that clears it; nothing else carries `Set-Cookie`, and never an
    // answer to a device's bearer or public request.
    const cookies = setCookiesOf(response);
    const own = cookies.filter((cookie) => cookie.startsWith(`${facts.cookieName}=`));
    const webSignIn = sent.operationId === 'signIn' && sent.callerKind === 'web' && answer.status === 200;
    const webSignOut = sent.operationId === 'signOut' && sent.callerKind === 'web' && answer.status === 204;
    if (webSignIn) {
      const value = own[0]?.split(';')[0]?.slice(facts.cookieName.length + 1) ?? '';
      if (cookies.length !== 1 || value === '') this.#problem('cookie', answer, `a web sign-in sets exactly the session cookie; ${cookies.length} Set-Cookie header(s)`);
      else this.judged.cookieSet += 1;
    } else if (webSignOut) {
      const cleared = own.length === 1 && /^[^=]+=;/.test(own[0] ?? '') && /max-age=0|expires=thu, 01 jan 1970/i.test(own[0] ?? '');
      if (cookies.length !== 1 || !cleared) this.#problem('cookie', answer, `a web sign-out clears exactly the session cookie; ${cookies.length} Set-Cookie header(s)`);
      else this.judged.cookieCleared += 1;
    } else if (cookies.length > 0) {
      this.#problem('cookie', answer, `${cookies.length} Set-Cookie header(s) on an answer that is neither a web sign-in nor a web sign-out`);
    } else {
      this.judged.cookieNone += 1;
    }

    // The contract: the status is documented for the operation and the body parses with its schema.
    const verdict = sent.operationId === null ? validateCoreApiEnvelopeResponse(answer.status, body) : validateCoreApiResponse(sent.operationId, answer.status, body);
    if (sent.knownGap !== undefined) {
      this.gapVerdicts.push({ gap: sent.knownGap, answer, verdict: JSON.stringify(verdict) });
    } else {
      if (!verdict.ok) this.#problem('contract', answer, `${verdict.reason} ${verdict.issues.join('; ')}`);
      this.judged.contract += 1;
      // And no member the schema of that status does not have, whether the schema is strict or not.
      const schemaName = sent.operationId === null ? 'ApiError' : (this.#operations.get(sent.operationId)?.responses[answer.status]?.schema ?? (answer.status >= 400 ? 'ApiError' : undefined));
      if (verdict.ok && schemaName !== undefined && body !== undefined) {
        const parsedBody = CORE_API_SCHEMAS[schemaName].safeParse(body);
        const extra = parsedBody.success ? undocumentedMembers(body, parsedBody.data) : [];
        if (extra.length > 0) this.#problem('contract', answer, `members the schema ${schemaName} does not have: ${extra.join(', ')}`);
        this.judged.members += 1;
      }
    }

    // The code, against what the registry names for this operation and status.
    if (answer.status >= 400 && sent.operationId !== null && sent.knownGap === undefined) {
      const operation = this.#operations.get(sent.operationId);
      if (answer.code === null) this.#problem('code', answer, 'an error answer without a code');
      else if (operation !== undefined) {
        const named = registryCodes(operation, answer.status);
        const seen = this.codeMismatches.some((entry) => entry.operationId === sent.operationId && entry.status === answer.status && entry.code === answer.code);
        if (!named.includes(answer.code) && !seen) this.codeMismatches.push({ operationId: sent.operationId, status: answer.status, code: answer.code, named });
      }
    }
    return answer;
  }

  /** The codes each status of an operation was answered with (an empty string for a success). */
  produced(operationId: string): Map<number, Set<string>> {
    const statuses = new Map<number, Set<string>>();
    for (const answer of this.answers) {
      if (answer.operationId !== operationId || answer.knownGap !== undefined) continue;
      const codes = statuses.get(answer.status) ?? new Set<string>();
      codes.add(answer.code ?? '');
      statuses.set(answer.status, codes);
    }
    return statuses;
  }

  /** Every status the file received, whatever the operation, with how often. */
  statusCounts(): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const answer of this.answers) counts[answer.status] = (counts[answer.status] ?? 0) + 1;
    return counts;
  }
}

// ── 5. The coverage table: operation × documented status ───────────────────────────────────────

export interface CoverageCell {
  readonly operationId: string;
  readonly status: number;
  /** The codes it was answered with, or null when it was not produced. */
  readonly codes: string[] | null;
  /** Why it is not produced here, when it is not. */
  readonly reason: string | null;
}

export function coverageOf(operations: readonly CoreApiRegistryOperation[], ledger: Ledger, notProducible: Readonly<Record<string, string>>): CoverageCell[] {
  const cells: CoverageCell[] = [];
  for (const operation of operations) {
    const produced = ledger.produced(operation.operationId);
    for (const status of listCoreApiResponseStatuses(operation, 'all')) {
      const codes = produced.get(status);
      cells.push({
        operationId: operation.operationId,
        status,
        codes: codes === undefined ? null : [...codes].filter((code) => code !== '').sort(),
        reason: notProducible[`${operation.operationId} ${status}`] ?? null,
      });
    }
  }
  return cells;
}

// ── 6. The free-text members of the request schemas (API-13) ───────────────────────────────────

interface Def {
  type: string;
  shape?: Record<string, z.ZodType>;
  innerType?: z.ZodType;
  in?: z.ZodType;
  /** `array` in zod v4 keeps the member schema as `element` (`items` in v3 output). */
  element?: z.ZodType;
  items?: z.ZodType | readonly z.ZodType[];
}

const defOf = (schema: z.ZodType): Def => (schema as unknown as { _zod: { def: Def } })._zod.def;

/** Every string schema inside an object schema, with the member names that lead to it. */
function stringLeaves(schema: z.ZodType, path: string[], out: Array<{ path: string[]; schema: z.ZodType }>): Array<{ path: string[]; schema: z.ZodType }> {
  const def = defOf(schema);
  switch (def.type) {
    case 'string':
      out.push({ path, schema });
      break;
    case 'object':
      for (const [key, member] of Object.entries(def.shape ?? {})) stringLeaves(member, [...path, key], out);
      break;
    case 'optional':
    case 'nullable':
    case 'default':
    case 'readonly':
    case 'nonoptional':
      if (def.innerType !== undefined) stringLeaves(def.innerType, path, out);
      break;
    case 'pipe':
      if (def.in !== undefined) stringLeaves(def.in, path, out);
      break;
    case 'array': {
      // A list member is walked at its first position: the path segment is the index, so
      // `withMember` below replaces the member inside the example body's element 0. The request
      // schemas of the registry gained their first lists with schema v2 (`cameras[]`, `mics[]` of
      // op 78 and op 81), and the text rule must be claimed for their members too.
      const element = def.element ?? (Array.isArray(def.items) ? def.items[0] : def.items);
      if (element !== undefined) stringLeaves(element, [...path, '0'], out);
      break;
    }
    case 'enum':
    case 'literal':
    case 'boolean':
    case 'number':
    case 'int':
    case 'null':
      break;
    default:
      // A list, a union or a record in a request schema: this walker must learn it before the
      // text rule can be claimed for "every" member.
      throw new Error(`a request schema holds a "${def.type}" at ${path.join('.')}: the walker of the contract test does not handle it`);
  }
  return out;
}

export interface TextMember {
  readonly operationId: string;
  readonly where: 'body' | 'query';
  readonly schemaName: string;
  readonly path: string[];
  /**
   * True for free text: the member carries the text rule itself (`apiText()`), told by the rule's
   * own message. False for a string that a pattern binds (an ID, a code, a cursor).
   */
  readonly freeText: boolean;
}

/** Every string member of every request body and query schema of the registry. */
export function textMembers(operations: readonly CoreApiRegistryOperation[]): TextMember[] {
  const members: TextMember[] = [];
  for (const operation of operations) {
    for (const [where, schemaName] of [['body', operation.requestBody?.schema], ['query', operation.query?.schema]] as const) {
      if (schemaName === undefined) continue;
      for (const leaf of stringLeaves(CORE_API_SCHEMAS[schemaName], [], [])) {
        const refused = leaf.schema.safeParse('\u0000');
        const freeText = !refused.success && refused.error.issues.some((issue) => issue.message === API_TEXT_RULE_MESSAGE);
        members.push({ operationId: operation.operationId, where, schemaName, path: leaf.path, freeText });
      }
    }
  }
  return members;
}

/** A copy of `base` with the member at `path` set to `value`; a numeric segment indexes a list. */
export function withMember(base: Readonly<Record<string, unknown>>, path: readonly string[], value: unknown): Record<string, unknown> {
  const [head, ...rest] = path;
  if (head === undefined) return { ...base };
  if (rest.length === 0) return { ...base, [head]: value };
  const inner = base[head];
  if (Array.isArray(inner) && /^\d+$/.test(rest[0] ?? '')) {
    const index = Number(rest[0]);
    const copy = [...inner];
    const element = copy[index];
    copy[index] = rest.length === 1
      ? value
      : typeof element === 'object' && element !== null
        ? withMember(element as Record<string, unknown>, rest.slice(1), value)
        : element;
    return { ...base, [head]: copy };
  }
  return { ...base, [head]: withMember(typeof inner === 'object' && inner !== null ? (inner as Record<string, unknown>) : {}, rest, value) };
}

// ── 7. What PostgreSQL holds: every table of schema `public`, row by row ───────────────────────

export interface TableState {
  /** Per table: the digest of every row's place, writer and content. */
  readonly digests: Readonly<Record<string, string>>;
  readonly rows: Readonly<Record<string, number>>;
}

/**
 * One statement over EVERY table the catalog lists in schema `public`. A row's image is its
 * place (`ctid`), the transaction that wrote it (`xmin`) and its content, so a rewrite of a row
 * with the same values shows as well as a change. Read as `dems_owner`, SELECT only.
 */
export async function readTables(owner: Pool): Promise<TableState> {
  const { rows: catalog } = await owner.query<{ name: string }>("SELECT tablename::text AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  const parts = catalog.map(({ name }) => {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('a table of schema public has a name this test does not put into a statement');
    return `SELECT '${name}' AS name, count(*)::text AS n, md5(coalesce(string_agg(t.ctid::text || '/' || t.xmin::text || '/' || to_jsonb(t)::text, E'\\n' ORDER BY t.ctid), '')) AS digest FROM public.${name} AS t`;
  });
  const { rows } = await owner.query<{ name: string; n: string; digest: string }>(parts.join(' UNION ALL '));
  const digests: Record<string, string> = {};
  const counts: Record<string, number> = {};
  for (const row of rows) {
    digests[row.name] = row.digest;
    counts[row.name] = Number(row.n);
  }
  return { digests, rows: counts };
}

/** The tables whose digest differs between two readings, in name order. */
export function movedTables(before: TableState, after: TableState): string[] {
  return Object.keys(after.digests)
    .filter((table) => after.digests[table] !== before.digests[table])
    .sort();
}
