/**
 * The HTTP half of the fake transport (HB-11): a `fetch`-compatible function the typed client
 * takes as its transport, and the answers a test scripts for it.
 *
 * What happens to a request, in order, all of it without a network, a port or a timer:
 *
 * 1. It is written to the call log (method, URL, path, query, headers, body), valid or not.
 * 2. It is checked against the contract (`checkRequest`). A request that is not the contract's is
 *    refused: the promise rejects with `FakeTransportRequestError` and the error is recorded.
 * 3. The answer scripted for its operation is taken: a one-shot answer first (in the order they
 *    were scripted), else the repeating answer, else the answer for every operation
 *    (`answerAllFromExamples`). None: `FakeTransportUnscriptedError`, rejected and recorded.
 * 4. The answer is delivered. A static answer was checked when it was scripted; what a responder
 *    function returns is checked now, and a failure is rejected and recorded as
 *    `FakeTransportResponseError` with `stage: 'answering'`.
 *
 * An answer always resolves asynchronously (on a promise job), as a real transport does. A delay
 * (`delayMs`) is kept on the fake's clock. A request whose `signal` aborts rejects with an
 * `AbortError`, which is how the typed client's time-out ends a request that gets no answer.
 */
import { EPOCH_HEADER_NAME, REQUEST_ID_HEADER_NAME, RETRY_AFTER_HEADER_NAME, REVISION_HEADER_NAME } from '../../api/constants';
import type { CoreApiOperation } from '../../api/core-api';
import type { OperationExamples } from '../../api/examples';
import type { FakeClock } from './clock';
import { checkAnswer, checkRequest, parseUrl, type AnswerFacts, type FakeContract, type RequestBodyFacts } from './contract';
import {
  FakeResponseViolation,
  FakeTransportError,
  FakeTransportRequestError,
  FakeTransportResponseError,
  FakeTransportUnscriptedError,
  FakeTransportUsageError,
  type FakeCheckStage,
} from './errors';
import type { FakeHttpCall, FakeLogWriter, MutableHttpCall } from './log';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Replies
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface FakeAnswer {
  readonly status: number;
  /** The JSON body. Left out for a status that has none (204). */
  readonly body?: unknown;
  /**
   * Response headers by name. The fake adds `x-request-id` to every answer, `content-type` to an
   * answer with a body, and `x-dems-epoch` and `x-dems-revision` (the fake's position) to a 2xx
   * answer of a POST. A value given here wins; `null` leaves that header out.
   */
  readonly headers?: Readonly<Record<string, string | number | null>>;
  /** `x-dems-epoch` (API-7). Defaults to the fake's position on a 2xx answer of a POST. */
  readonly epoch?: number;
  /** `x-dems-revision` (API-7). Defaults to the fake's position on a 2xx answer of a POST. */
  readonly revision?: number;
  /** `retry-after`, in whole seconds (a 429 needs it). */
  readonly retryAfterSeconds?: number;
  /** `x-request-id`. Defaults to `error.requestId` of an envelope, else to a counter value. */
  readonly requestId?: string;
  /** The body as this exact text, for an answer that is not JSON. Only with `violatesContract`. */
  readonly text?: string;
  /** The answer is delivered when the fake's clock has moved on by this much. */
  readonly delayMs?: number;
  /**
   * A deliberate contract violation, to test what a client does with one (its `CONTRACT_VIOLATION`
   * path). The answer is delivered as scripted and no check is applied.
   */
  readonly violatesContract?: boolean;
}

/** The transport fails as it does when the Core server is unreachable: no status, no body. */
export interface FakeOutage {
  readonly outage: true;
  readonly delayMs?: number;
}

/** Nothing comes back. The request stays in flight until its `signal` aborts it. */
export interface FakeNoAnswer {
  readonly noAnswer: true;
}

export type FakeReply = FakeAnswer | FakeOutage | FakeNoAnswer;

/** Builds the reply when the request arrives. What it returns is checked at answer time. */
export type FakeResponder = (call: FakeHttpCall) => FakeReply | Promise<FakeReply>;

export const OUTAGE: FakeOutage = { outage: true };
export const NO_ANSWER: FakeNoAnswer = { noAnswer: true };

const isAnswer = (reply: unknown): reply is FakeAnswer =>
  typeof reply === 'object' && reply !== null && typeof (reply as { status?: unknown }).status === 'number';
const isOutage = (reply: unknown): reply is FakeOutage => typeof reply === 'object' && reply !== null && (reply as { outage?: unknown }).outage === true;
const isNoAnswer = (reply: unknown): reply is FakeNoAnswer =>
  typeof reply === 'object' && reply !== null && (reply as { noAnswer?: unknown }).noAnswer === true;

/** An answer that is held back until the test releases it. */
export interface FakeHeldAnswer {
  readonly operationId: string;
  /** The request that is waiting for this answer; `null` until it arrived. */
  readonly call: FakeHttpCall | null;
  /** True once `release` or `fail` was called. */
  readonly settled: boolean;
  /** Delivers the answer. It is checked here, as at scripting time. Without an argument: the operation's first success example. */
  release(reply?: FakeReply): void;
  /** Delivers an outage. */
  fail(): void;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The fetch-compatible function
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The request members the fake reads. Loosely typed: the fetch types of three runtimes must all fit. */
export interface FakeFetchInit {
  readonly method?: string;
  /** A plain record, a list of pairs, or an object with `forEach` (a `Headers`). */
  readonly headers?: unknown;
  readonly body?: unknown;
  readonly credentials?: string;
  /** An abort signal. */
  readonly signal?: unknown;
}

export interface FakeResponseHeaders {
  get(name: string): string | null;
  has(name: string): boolean;
  forEach(callback: (value: string, name: string) => void): void;
}

/** What the fake `fetch` resolves with: the members of a fetch response that do not need a stream. */
export interface FakeFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly redirected: false;
  readonly type: 'basic';
  readonly headers: FakeResponseHeaders;
  /** True once `text()` or `json()` was called: the body is read once, as with a fetch response. */
  readonly bodyUsed: boolean;
  text(): Promise<string>;
  json(): Promise<unknown>;
  clone(): FakeFetchResponse;
}

/** `input`: a URL as text, or an object with a text member `href` or `url`. */
export type FakeFetch = (input: unknown, init?: FakeFetchInit) => Promise<FakeFetchResponse>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// The shared context of one fake
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Where the fake Core server stands: the epoch and the revision of its state (01_specs API-7, RT-1). */
export interface FakePosition {
  epoch: number;
  revision: number;
}

export interface FakeContext {
  readonly contract: FakeContract;
  readonly clock: FakeClock;
  readonly log: FakeLogWriter;
  readonly examples: Readonly<Record<string, OperationExamples>>;
  readonly position: FakePosition;
  /** Records an error the client under test may swallow, and returns it. */
  violation<Raised extends FakeTransportError>(error: Raised): Raised;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples of the contract
// ═══════════════════════════════════════════════════════════════════════════════════════

function firstSuccessStatus(operation: CoreApiOperation): number | null {
  const statuses = Object.keys(operation.responses)
    .map(Number)
    .filter((status) => status >= 200 && status <= 299)
    .sort((a, b) => a - b);
  return statuses[0] ?? null;
}

/**
 * The answer of an operation as the contract's own examples give it. `status`: the status wanted
 * (default: the operation's lowest 2xx). `name`: the example wanted (default: the first of that
 * status). A status without a body schema (204) needs no example and gives an answer without a body.
 */
export function exampleAnswerOf(
  operation: CoreApiOperation,
  examples: Readonly<Record<string, OperationExamples>>,
  status?: number,
  name?: string,
): FakeAnswer {
  const wanted = status ?? firstSuccessStatus(operation);
  if (wanted === null) throw new FakeTransportUsageError(`${operation.operationId} names no 2xx status`, 'NO_EXAMPLE');
  const spec = operation.responses[wanted];
  if (spec && !spec.schema) return { status: wanted };
  const named = examples[operation.operationId]?.responses[wanted];
  const example = named ? (name === undefined ? Object.values(named)[0] : named[name]) : undefined;
  if (!example) {
    throw new FakeTransportUsageError(
      `the contract has no example${name === undefined ? '' : ` "${name}"`} for the ${wanted} answer of ${operation.operationId}`,
      'NO_EXAMPLE',
    );
  }
  return { status: wanted, body: example.value };
}

/** The path parameters and the request body of an operation as the contract's own examples give them. */
export function exampleInputOf(
  operation: CoreApiOperation,
  examples: Readonly<Record<string, OperationExamples>>,
): { params?: Readonly<Record<string, string>>; body?: unknown } {
  const entry = examples[operation.operationId];
  const request = entry?.request ? Object.values(entry.request)[0] : undefined;
  return {
    ...(entry?.pathParams ? { params: entry.pathParams } : {}),
    ...(request !== undefined ? { body: request.value } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The HTTP half
// ═══════════════════════════════════════════════════════════════════════════════════════

interface Held {
  readonly operation: CoreApiOperation;
  call: MutableHttpCall | null;
  deliver: ((reply: FakeReply) => void) | null;
  released: FakeReply | null;
  settled: boolean;
}

type Script =
  | { readonly kind: 'reply'; readonly reply: FakeReply }
  | { readonly kind: 'responder'; readonly run: FakeResponder }
  | { readonly kind: 'held'; readonly held: Held };

interface Slot {
  readonly queue: Script[];
  repeating: Script | null;
}

interface Prepared {
  readonly status: number;
  readonly text: string;
  readonly headers: Record<string, string>;
  readonly facts: AnswerFacts;
  readonly serialisable: boolean;
}

export interface FakeHttpSide {
  readonly fetch: FakeFetch;
  operation(operationId: string): CoreApiOperation;
  answer(operationId: string, reply: FakeReply | FakeResponder): void;
  answerOnce(operationId: string, reply: FakeReply | FakeResponder): void;
  hold(operationId: string): FakeHeldAnswer;
  answerAllFromExamples(): void;
  /** Operation IDs that still have a one-shot answer nobody asked for, once per answer. */
  unusedAnswers(): string[];
  /** Forgets every scripted answer. */
  resetAnswers(): void;
  /** Resolves when every request in flight got its answer or is parked: held back, delayed on the clock, or left without one. */
  idle(): Promise<void>;
  /** Resolves when at least `count` requests have arrived since the fake was made or reset, and none of them is still on its way. */
  arrived(count: number): Promise<void>;
  /** Starts the count of `arrived` anew. */
  resetArrivals(): void;
}

function abortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener?(type: 'abort', listener: () => void): void;
}

function abortSignalOf(value: unknown): AbortSignalLike | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { aborted?: unknown; addEventListener?: unknown };
  return typeof candidate.aborted === 'boolean' && typeof candidate.addEventListener === 'function' ? (value as AbortSignalLike) : null;
}

/** Header names in lower case with their values, from any of the three forms a caller may pass. */
export function normaliseHeaders(input: unknown): { headers: Record<string, string>; problems: string[] } {
  const headers: Record<string, string> = {};
  const problems: string[] = [];
  const put = (name: unknown, value: unknown): void => {
    const key = String(name).toLowerCase();
    if (typeof value === 'string') headers[key] = value;
    else problems.push(key);
  };
  if (input === undefined || input === null) return { headers, problems };
  if (typeof input !== 'object') return { headers, problems: ['headers'] };
  if (Array.isArray(input)) {
    for (const pair of input as unknown[]) {
      if (Array.isArray(pair) && pair.length === 2) put(pair[0], pair[1]);
      else problems.push('headers');
    }
  } else if (typeof (input as { forEach?: unknown }).forEach === 'function') {
    (input as { forEach(callback: (value: unknown, name: unknown) => void): void }).forEach((value, name) => put(name, value));
  } else {
    for (const [name, value] of Object.entries(input)) put(name, value);
  }
  return { headers, problems };
}

function urlOf(input: unknown): string {
  if (typeof input === 'string') return input;
  if (typeof input === 'object' && input !== null) {
    const named = input as { href?: unknown; url?: unknown };
    if (typeof named.href === 'string') return named.href;
    if (typeof named.url === 'string') return named.url;
  }
  return String(input);
}

function responseHeaders(headers: Readonly<Record<string, string>>): FakeResponseHeaders {
  return {
    get: (name) => headers[name.toLowerCase()] ?? null,
    has: (name) => headers[name.toLowerCase()] !== undefined,
    forEach(callback) {
      for (const [name, value] of Object.entries(headers)) callback(value, name);
    },
  };
}

function responseOf(url: string, prepared: Prepared): FakeFetchResponse {
  const make = (): FakeFetchResponse => {
    // As with a fetch response, the body is read once; a second read is the caller's error.
    let used = false;
    const read = (): Promise<string> => {
      if (used) return Promise.reject(new TypeError('Body has already been read'));
      used = true;
      return Promise.resolve(prepared.text);
    };
    return {
      ok: prepared.status >= 200 && prepared.status <= 299,
      status: prepared.status,
      statusText: '',
      url,
      redirected: false,
      type: 'basic',
      headers: responseHeaders(prepared.headers),
      get bodyUsed() {
        return used;
      },
      text: read,
      json: () => read().then((text) => JSON.parse(text) as unknown),
      clone() {
        if (used) throw new TypeError('Body has already been read');
        return make();
      },
    };
  };
  return make();
}

export function createHttpSide(context: FakeContext): FakeHttpSide {
  const { contract, clock, log, position } = context;
  const slots = new Map<string, Slot>();
  const onTheirWay = new Set<Promise<unknown>>();
  const waiters: { readonly count: number; readonly resolve: () => void }[] = [];
  let arrivals = 0;
  let everyOperationFromExamples = false;

  /** Lets go of every `arrived` wait whose count is reached, once nothing is on its way. */
  function checkWaiters(): void {
    if (onTheirWay.size > 0) return;
    for (const waiter of waiters.slice()) {
      if (arrivals < waiter.count) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
  }

  function slotOf(operationId: string): Slot {
    let slot = slots.get(operationId);
    if (!slot) {
      slot = { queue: [], repeating: null };
      slots.set(operationId, slot);
    }
    return slot;
  }

  function operation(operationId: string): CoreApiOperation {
    const found = contract.byId.get(operationId);
    if (!found) {
      throw new FakeTransportResponseError({
        reason: FakeResponseViolation.UNKNOWN_OPERATION,
        operationId,
        status: null,
        stage: 'scripting',
        issues: ['the operation table has no such operation ID'],
      });
    }
    return found;
  }

  /** The answer as it will travel: its text, its headers, and the facts the contract check reads. */
  function prepare(target: CoreApiOperation, answer: FakeAnswer, requestSeq: number): Prepared {
    const rawText = answer.text !== undefined;
    const hasBody = rawText || answer.body !== undefined;
    let text = answer.text ?? '';
    let wire: unknown;
    let serialisable = true;
    if (!rawText && answer.body !== undefined) {
      try {
        const json: unknown = JSON.stringify(answer.body);
        if (typeof json === 'string') {
          text = json;
          wire = JSON.parse(json) as unknown;
        } else serialisable = false;
      } catch {
        serialisable = false;
      }
    }
    const headers: Record<string, string> = {};
    if (hasBody) headers['content-type'] = 'application/json; charset=utf-8';
    const envelope = wire as { readonly error?: { readonly requestId?: unknown } } | null | undefined;
    const repeated = typeof envelope === 'object' && envelope !== null ? envelope.error?.requestId : undefined;
    headers[REQUEST_ID_HEADER_NAME] = answer.requestId ?? (typeof repeated === 'string' && repeated !== '' ? repeated : `fake-request-${requestSeq}`);
    const success = answer.status >= 200 && answer.status <= 299;
    if (target.method === 'post' && success) {
      headers[EPOCH_HEADER_NAME] = String(answer.epoch ?? position.epoch);
      headers[REVISION_HEADER_NAME] = String(answer.revision ?? position.revision);
    } else {
      if (answer.epoch !== undefined) headers[EPOCH_HEADER_NAME] = String(answer.epoch);
      if (answer.revision !== undefined) headers[REVISION_HEADER_NAME] = String(answer.revision);
    }
    if (answer.retryAfterSeconds !== undefined) headers[RETRY_AFTER_HEADER_NAME] = String(answer.retryAfterSeconds);
    for (const [name, value] of Object.entries(answer.headers ?? {})) {
      const key = name.toLowerCase();
      if (value === null) delete headers[key];
      else headers[key] = String(value);
    }
    return { status: answer.status, text, headers, serialisable, facts: { status: answer.status, body: wire, hasBody, rawText, headers } };
  }

  /** The error of a reply that is not the contract's, or `null`. */
  function replyError(target: CoreApiOperation, reply: unknown, stage: FakeCheckStage, requestSeq: number): FakeTransportResponseError | null {
    const refuse = (reason: FakeResponseViolation, status: number | null, issues: readonly string[]) =>
      new FakeTransportResponseError({ reason, operationId: target.operationId, status, stage, issues });
    if (isOutage(reply) || isNoAnswer(reply)) return null;
    if (!isAnswer(reply)) return refuse(FakeResponseViolation.NOT_A_REPLY, null, ['expected an answer with a status, an outage, or "no answer"']);
    if (!Number.isFinite(reply.status)) return refuse(FakeResponseViolation.UNDOCUMENTED_STATUS, null, ['status: not a number']);
    if (reply.violatesContract) return null;
    const prepared = prepare(target, reply, requestSeq);
    if (!prepared.serialisable) return refuse(FakeResponseViolation.INVALID_BODY, reply.status, ['(root): not a JSON value']);
    const verdict = checkAnswer(contract, target, prepared.facts);
    return verdict.ok ? null : refuse(verdict.reason, reply.status, verdict.issues);
  }

  function scriptOf(target: CoreApiOperation, reply: FakeReply | FakeResponder): Script {
    if (typeof reply === 'function') return { kind: 'responder', run: reply };
    const error = replyError(target, reply, 'scripting', 0);
    if (error) throw error;
    return { kind: 'reply', reply };
  }

  function takeScript(target: CoreApiOperation): Script | null {
    const slot = slots.get(target.operationId);
    const queued = slot?.queue.shift();
    if (queued) return queued;
    if (slot?.repeating) return slot.repeating;
    if (everyOperationFromExamples) return { kind: 'responder', run: () => exampleAnswerOf(target, context.examples) };
    return null;
  }

  function record(input: unknown, init: FakeFetchInit): { call: MutableHttpCall; body: RequestBodyFacts; problems: string[] } {
    const url = urlOf(input);
    const parsed = parseUrl(url);
    const { headers, problems } = normaliseHeaders(init.headers);
    const given = init.body;
    const body: RequestBodyFacts =
      given === undefined || given === null ? { kind: 'none' } : typeof given === 'string' ? { kind: 'text', text: given } : { kind: 'other' };
    let json: unknown;
    if (body.kind === 'text' && body.text !== '') {
      try {
        json = JSON.parse(body.text) as unknown;
      } catch {
        json = undefined;
      }
    }
    const call: MutableHttpCall = {
      kind: 'http',
      seq: log.nextSeq(),
      at: clock.now(),
      method: typeof init.method === 'string' ? init.method.toUpperCase() : 'GET',
      url,
      path: parsed?.pathname ?? '',
      query: parsed?.query ?? {},
      operationId: null,
      params: {},
      headers,
      credentials: typeof init.credentials === 'string' ? init.credentials : null,
      bodyText: body.kind === 'text' ? body.text : null,
      body: json,
      status: null,
      outcome: 'pending',
    };
    log.addRequest(call);
    return { call, body, problems };
  }

  const fetch: FakeFetch = (input, init = {}) => {
    const { call, body, problems } = record(input, init);
    const checked = checkRequest(contract, {
      method: call.method,
      url: parseUrl(call.url),
      headers: call.headers,
      headerProblems: problems,
      credentialsMode: call.credentials,
      body,
    });
    call.operationId = checked.operation?.operationId ?? null;
    call.params = checked.params;
    arrivals += 1;
    if (!checked.ok) {
      call.outcome = 'refused';
      checkWaiters();
      return Promise.reject(
        context.violation(
          new FakeTransportRequestError({
            reason: checked.reason,
            operationId: call.operationId,
            issues: checked.issues,
            method: call.method,
            route: checked.route,
          }),
        ),
      );
    }
    const target = checked.operation;
    const script = takeScript(target);
    if (!script) {
      call.outcome = 'unscripted';
      checkWaiters();
      return Promise.reject(context.violation(new FakeTransportUnscriptedError(target.operationId, call.method, target.path)));
    }
    const signal = abortSignalOf(init.signal);
    if (signal?.aborted) {
      call.outcome = 'aborted';
      checkWaiters();
      return Promise.reject(abortError());
    }

    // `idle()` waits for this request until its answer was delivered, or until it is parked: held
    // back, delayed on the clock, or left without an answer. A parked request needs the test to act.
    let settleTracking: () => void = () => undefined;
    const tracked = new Promise<void>((resolve) => {
      settleTracking = resolve;
    });
    onTheirWay.add(tracked);
    void tracked.then(() => {
      onTheirWay.delete(tracked);
      checkWaiters();
    });

    return new Promise<FakeFetchResponse>((resolve, reject) => {
      let done = false;
      let cancelDelay: (() => void) | null = null;
      const finish = (settle: () => void): void => {
        if (done) return;
        done = true;
        cancelDelay?.();
        signal?.removeEventListener?.('abort', onAbort);
        settle();
        settleTracking();
      };
      const onAbort = (): void =>
        finish(() => {
          call.outcome = 'aborted';
          reject(abortError());
        });
      signal?.addEventListener('abort', onAbort);

      const after = (delayMs: number | undefined, run: () => void): void => {
        if (delayMs !== undefined && delayMs > 0) {
          cancelDelay = clock.schedule(delayMs, run);
          settleTracking();
        } else run();
      };

      const deliver = (reply: unknown, stage: FakeCheckStage | null): void => {
        if (done) return;
        if (stage !== null) {
          const error = replyError(target, reply, stage, call.seq);
          if (error) {
            finish(() => {
              call.outcome = 'bad-answer';
              reject(context.violation(error));
            });
            return;
          }
        }
        if (isOutage(reply)) {
          after(reply.delayMs, () =>
            finish(() => {
              call.outcome = 'outage';
              reject(new TypeError('Network request failed'));
            }),
          );
          return;
        }
        if (!isAnswer(reply)) {
          // "No answer": the request stays in flight until its signal aborts it.
          settleTracking();
          return;
        }
        const prepared = prepare(target, reply, call.seq);
        after(reply.delayMs, () =>
          finish(() => {
            call.status = prepared.status;
            call.outcome = 'answered';
            resolve(responseOf(call.url, prepared));
          }),
        );
      };

      if (script.kind === 'reply') {
        // Checked when it was scripted; delivered on a promise job, never inside the call itself.
        void Promise.resolve().then(() => deliver(script.reply, null));
      } else if (script.kind === 'responder') {
        void Promise.resolve()
          .then(() => script.run(call))
          .then(
            (reply) => deliver(reply, 'answering'),
            (error: unknown) =>
              finish(() => {
                call.outcome = 'bad-answer';
                reject(error instanceof FakeTransportError ? context.violation(error) : error);
              }),
          );
      } else {
        const { held } = script;
        held.call = call;
        held.deliver = (reply) => deliver(reply, null);
        const released = held.released;
        if (released) void Promise.resolve().then(() => deliver(released, null));
        else settleTracking();
      }
    });
  };

  return {
    fetch,
    operation,
    answer(operationId, reply) {
      const target = operation(operationId);
      slotOf(operationId).repeating = scriptOf(target, reply);
    },
    answerOnce(operationId, reply) {
      const target = operation(operationId);
      slotOf(operationId).queue.push(scriptOf(target, reply));
    },
    hold(operationId) {
      const target = operation(operationId);
      const held: Held = { operation: target, call: null, deliver: null, released: null, settled: false };
      slotOf(operationId).queue.push({ kind: 'held', held });
      const settle = (reply: FakeReply): void => {
        if (held.settled) throw new FakeTransportUsageError(`the held answer of ${operationId} was already released`);
        const error = replyError(target, reply, 'scripting', held.call?.seq ?? 0);
        if (error) throw error;
        held.settled = true;
        held.released = reply;
        held.deliver?.(reply);
      };
      return {
        operationId,
        get call() {
          return held.call;
        },
        get settled() {
          return held.settled;
        },
        release: (reply) => settle(reply ?? exampleAnswerOf(target, context.examples)),
        fail: () => settle(OUTAGE),
      };
    },
    answerAllFromExamples() {
      everyOperationFromExamples = true;
    },
    unusedAnswers() {
      const unused: string[] = [];
      for (const [operationId, slot] of slots) {
        for (const script of slot.queue) {
          if (script.kind !== 'held' || script.held.call === null) unused.push(operationId);
        }
      }
      return unused;
    },
    resetAnswers() {
      slots.clear();
      everyOperationFromExamples = false;
    },
    async idle() {
      while (onTheirWay.size > 0) await Promise.all(onTheirWay);
    },
    arrived(count) {
      return new Promise<void>((resolve) => {
        waiters.push({ count, resolve });
        checkWaiters();
      });
    },
    resetArrivals() {
      arrivals = 0;
    },
  };
}
