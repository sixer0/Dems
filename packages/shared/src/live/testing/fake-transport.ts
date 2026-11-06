/**
 * `createFakeTransport`: the contract-checked fake transport (HB-11; backend task
 * 04_client_integration_spec §12.2, TS-10 to TS-15; research TD-12; plan row W31).
 *
 * One test double for every runner. A test passes its two parts where a client takes its
 * transport, so a REAL typed client and a REAL socket client run on top of it:
 *
 * ```ts
 * const fake = createFakeTransport();
 * const client = createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: 'browser-cookie', fetch: fake.fetch });
 * const heartbeat = createHeartbeatClient({ url: 'ws://127.0.0.1:4420/ws', socketFactory: fake.socketFactory, now: fake.clock.now });
 * ```
 *
 * | Part | What a test does with it |
 * |------|--------------------------|
 * | `fetch` | Scripts answers per operation ID: `answer` (repeating), `answerOnce` (one-shot), `hold` (released by the test), from the contract's examples, an outage, no answer |
 * | `WebSocket`, `socketFactory` | Gets the server's end of each socket (`connection()`), accepts it, sends server messages, reads the client's, closes with a code |
 * | `log` | One call log for both: every request and every socket with its frames |
 * | `clock` | The fake's time. A manual clock unless one is passed in |
 *
 * **Contract-checked in both directions.** A request the contract does not define, a scripted
 * answer or server message the Core server may not send, and a client message outside the client
 * union each raise a NAMED error (`./errors`). A deliberate violation, for a test of what a client
 * does with one, is marked `{ violatesContract: true }`.
 *
 * **Ending a test.** An error raised while the client under test is running can be swallowed by
 * that client (the typed client reports any transport rejection as its `NETWORK` failure). Such
 * errors are recorded: `assertNoViolations()` throws the first one. Call it at the end of a test
 * (or in the runner's after-each hook), or run the test body through `withFakeTransport`.
 *
 * No network, no port, no timer, no global is touched. `installFakeTransport` (`./install`) is the
 * opt-in for code that cannot take its transport by injection.
 */
import { CORE_API_EXAMPLES, type OperationExamples } from '../../api/examples';
import { CORE_API_OPERATIONS, type CoreApiOperation } from '../../api/core-api';
import type { DeltaMessage, HelloMessage, SnapshotMessage } from '../../api/realtime-messages';
import type { CoreOperationId } from '../../client/core-client';
import { createFakeClock, type FakeClock, type ManualFakeClock } from './clock';
import { createFakeContract, type ContractSchema } from './contract';
import { FakeTransportError, FakeTransportUsageError } from './errors';
import {
  OUTAGE,
  createHttpSide,
  exampleAnswerOf,
  exampleInputOf,
  type FakeAnswer,
  type FakeContext,
  type FakeFetch,
  type FakeHeldAnswer,
  type FakePosition,
  type FakeReply,
  type FakeResponder,
} from './http';
import { createCallLog, type FakeCallLog, type FakeHttpCall } from './log';
import {
  createSocketSide,
  type FakeConnectScript,
  type FakeConnection,
  type FakeOperatorStartOptions,
  type FakeSocketFactory,
  type FakeWebSocketConstructor,
} from './socket';

/** An operation ID of the registry (offered by an editor), or the ID of an operation of a table passed in. */
export type FakeOperationId = CoreOperationId | (string & Record<never, never>);

export interface FakeTransportOptions<Clock extends FakeClock = ManualFakeClock> {
  /** The operation table the fake checks against. Defaults to the registry, `CORE_API_OPERATIONS`. */
  readonly operations?: readonly CoreApiOperation[];
  /** The schemas the table's names refer to. Defaults to the registry's `CORE_API_SCHEMAS`. */
  readonly schemas?: Readonly<Record<string, ContractSchema>>;
  /** The examples `answerFromExample` reads. Defaults to the registry's `CORE_API_EXAMPLES`. */
  readonly examples?: Readonly<Record<string, OperationExamples>>;
  /** The fake's clock. Defaults to a manual clock at the instant of the contract's examples. */
  readonly clock?: Clock;
  /** Where the fake Core server stands at the start. Defaults to epoch 1, revision 0. */
  readonly epoch?: number;
  readonly revision?: number;
}

export interface FakeCommandOptions {
  /** The delta that holds the command's effect. */
  readonly ops: DeltaMessage['ops'];
  /**
   * `delta-first`: the delta arrives on the socket before the HTTP answer.
   * `answer-first`: the HTTP answer arrives; the delta is sent when the test calls `sendDelta()`.
   */
  readonly order: 'delta-first' | 'answer-first';
  /** The answer of the command. Defaults to the operation's first success example. */
  readonly answer?: FakeAnswer;
  /** The connection that gets the delta. Defaults to the socket opened last. */
  readonly connection?: FakeConnection;
}

export interface FakeCommandScript {
  /** The revision the answer carried and the delta carries; `null` until the request arrived. */
  readonly revision: number | null;
  readonly deltaSent: boolean;
  /** Sends the delta (`answer-first`). */
  sendDelta(): void;
}

export interface FakeSignedInStartOptions extends FakeOperatorStartOptions {
  /** The body of the `getAuthSession` answer. Defaults to the contract's example. */
  readonly session?: unknown;
}

export interface FakeTransport<Clock extends FakeClock = ManualFakeClock> {
  // ── The two transports ──────────────────────────────────────────────────────────────────
  /** For `createCoreClient({ fetch })`. */
  readonly fetch: FakeFetch;
  /** A socket constructor: `new fake.WebSocket(url, protocols?, { headers })`. */
  readonly WebSocket: FakeWebSocketConstructor;
  /** For a socket client's `socketFactory`. */
  readonly socketFactory: FakeSocketFactory;

  // ── What both halves share ──────────────────────────────────────────────────────────────
  readonly clock: Clock;
  readonly log: FakeCallLog;
  /** The requests of the log, in order (`log.requests`). */
  readonly calls: readonly FakeHttpCall[];
  /** Where the fake Core server stands: what a 2xx answer of a POST and a state message carry by default. */
  readonly position: Readonly<FakePosition>;
  setPosition(position: Partial<FakePosition>): void;
  /** A new epoch (a demo reset or a scenario load): the epoch plus 1, revision 0. */
  startEpoch(): Readonly<FakePosition>;

  // ── Scripting answers ───────────────────────────────────────────────────────────────────
  /** The answer every call of the operation gets, until it is scripted anew. A static answer is checked here. */
  answer(operationId: FakeOperationId, reply: FakeReply | FakeResponder): void;
  /** The answer of the next call only. One-shot answers are used in the order they were scripted, before the repeating one. */
  answerOnce(operationId: FakeOperationId, reply: FakeReply | FakeResponder): void;
  /** The contract's own example as the repeating answer: of `status` (default: the lowest 2xx), by `name` (default: the first). */
  answerFromExample(operationId: FakeOperationId, status?: number, name?: string): void;
  answerOnceFromExample(operationId: FakeOperationId, status?: number, name?: string): void;
  /** Every operation without a scripted answer answers its first success example. */
  answerAllFromExamples(): void;
  /** The contract's example as an answer object, to change or to pass on. */
  example(operationId: FakeOperationId, status?: number, name?: string): FakeAnswer;
  /** The contract's example input of an operation: its path parameters and its request body. */
  exampleInput(operationId: FakeOperationId): { params?: Readonly<Record<string, string>>; body?: unknown };
  /** An outage on every call of the operation: the transport rejects, as with an unreachable server. */
  fail(operationId: FakeOperationId): void;
  failOnce(operationId: FakeOperationId): void;
  /** The next call of the operation waits until the test releases its answer. */
  hold(operationId: FakeOperationId): FakeHeldAnswer;

  // ── Sockets ─────────────────────────────────────────────────────────────────────────────
  /** The server's end of every socket that was opened, in order. */
  readonly connections: readonly FakeConnection[];
  /** The server's end of the socket opened last, or of the one at `index`. Throws when there is none. */
  connection(index?: number): FakeConnection;
  /**
   * Runs `script` for every socket opened from now on, on a promise job after the constructor
   * returned (the client has attached its handlers by then). Returns the function that removes it.
   */
  onConnect(script: FakeConnectScript): () => void;
  /** Runs the connect scripts of sockets that are still waiting for theirs, now. For a test that does not await. */
  runPendingConnects(): void;

  // ── Common sequences (TS-13) ────────────────────────────────────────────────────────────
  /** An anonymous start: `getAuthSession` answers 401, `getSignInStatus` its example, each socket gets `hello` ANONYMOUS. */
  scriptAnonymousStart(reason?: HelloMessage['reason']): void;
  /** A signed-in start: `getAuthSession` answers 200, each socket gets `hello` OPERATOR and the snapshot of `state`. */
  scriptSignedInStart(state: SnapshotMessage['state'], options?: FakeSignedInStartOptions): void;
  /** A command answered with a revision, preceded or followed by the delta of that revision. */
  scriptCommand(operationId: FakeOperationId, options: FakeCommandOptions): FakeCommandScript;

  // ── The verdict ─────────────────────────────────────────────────────────────────────────
  /** Every error that was raised where the client under test could swallow it, in order. */
  readonly violations: readonly FakeTransportError[];
  /** Throws the first recorded violation. */
  assertNoViolations(): void;
  /** `assertNoViolations`, and no one-shot answer is left that nobody asked for. */
  assertDone(): void;
  /** Resolves when every request in flight got its answer or is parked: held back, delayed on the clock, or left without one. */
  idle(): Promise<void>;
  /**
   * Resolves when at least `count` requests (default 1) have arrived since the fake was made or
   * reset, and each of them got its answer or is parked. The fixed point a test waits for before
   * it advances the clock, releases a held answer or sends a delta: a client reaches its transport
   * a few promise jobs after it was called, not at once.
   */
  arrived(count?: number): Promise<void>;
  /** Forgets the scripted answers, the connect scripts, the recorded violations and the log. Open sockets stay. */
  reset(): void;
}

export function createFakeTransport<Clock extends FakeClock = ManualFakeClock>(options: FakeTransportOptions<Clock> = {}): FakeTransport<Clock> {
  const clock = (options.clock ?? createFakeClock()) as Clock;
  const contract = createFakeContract(options.operations, options.schemas);
  const examples = options.examples ?? CORE_API_EXAMPLES;
  const log = createCallLog();
  const position: FakePosition = { epoch: options.epoch ?? 1, revision: options.revision ?? 0 };
  const violations: FakeTransportError[] = [];

  const context: FakeContext = {
    contract,
    clock,
    log,
    examples,
    position,
    violation(error) {
      violations.push(error);
      return error;
    },
  };
  const http = createHttpSide(context);
  const sockets = createSocketSide(context);

  const example = (operationId: string, status?: number, name?: string): FakeAnswer => exampleAnswerOf(http.operation(operationId), examples, status, name);

  function assertNoViolations(): void {
    const first = violations[0];
    if (first) throw first;
  }

  return {
    fetch: http.fetch,
    WebSocket: sockets.WebSocket,
    socketFactory: sockets.socketFactory,

    clock,
    log,
    calls: log.requests,
    position,
    setPosition(next) {
      for (const value of [next.epoch, next.revision]) {
        if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
          throw new FakeTransportUsageError('an epoch and a revision are non-negative integers');
        }
      }
      if (next.epoch !== undefined) position.epoch = next.epoch;
      if (next.revision !== undefined) position.revision = next.revision;
    },
    startEpoch() {
      position.epoch += 1;
      position.revision = 0;
      return position;
    },

    answer: http.answer,
    answerOnce: http.answerOnce,
    answerFromExample: (operationId, status, name) => http.answer(operationId, example(operationId, status, name)),
    answerOnceFromExample: (operationId, status, name) => http.answerOnce(operationId, example(operationId, status, name)),
    answerAllFromExamples: http.answerAllFromExamples,
    example,
    exampleInput: (operationId) => exampleInputOf(http.operation(operationId), examples),
    fail: (operationId) => http.answer(operationId, OUTAGE),
    failOnce: (operationId) => http.answerOnce(operationId, OUTAGE),
    hold: http.hold,

    connections: sockets.connections,
    connection: sockets.connection,
    onConnect: sockets.onConnect,
    runPendingConnects: sockets.runPendingConnects,

    scriptAnonymousStart(reason) {
      if (contract.byId.has('getAuthSession')) http.answer('getAuthSession', example('getAuthSession', 401));
      if (contract.byId.has('getSignInStatus')) http.answer('getSignInStatus', example('getSignInStatus'));
      sockets.onConnect((connection) => connection.startAnonymous(reason));
    },
    scriptSignedInStart(state, start = {}) {
      if (contract.byId.has('getAuthSession')) {
        http.answer('getAuthSession', start.session === undefined ? example('getAuthSession') : { status: 200, body: start.session });
      }
      sockets.onConnect((connection) => connection.startOperator(state, start));
    },
    scriptCommand(operationId, command) {
      const answer = command.answer ?? example(operationId);
      let revision: number | null = null;
      let deltaSent = false;
      const sendDelta = (): void => {
        if (revision === null) throw new FakeTransportUsageError(`the delta of ${operationId} cannot be sent before its request arrived`);
        if (deltaSent) throw new FakeTransportUsageError(`the delta of ${operationId} was already sent`);
        (command.connection ?? sockets.connection()).delta(command.ops, { revision });
        deltaSent = true;
      };
      http.answerOnce(operationId, () => {
        // API-7, RT-5: the answer carries the revision of the delta that holds the command's effect.
        revision = position.revision + 1;
        if (command.order === 'delta-first') sendDelta();
        return { ...answer, revision, epoch: answer.epoch ?? position.epoch };
      });
      return {
        get revision() {
          return revision;
        },
        get deltaSent() {
          return deltaSent;
        },
        sendDelta,
      };
    },

    violations,
    assertNoViolations,
    assertDone() {
      assertNoViolations();
      const unused = http.unusedAnswers();
      if (unused.length > 0) {
        throw new FakeTransportUsageError(`one-shot answers were scripted and never asked for: ${unused.join(', ')}`, 'UNUSED_ANSWERS');
      }
    },
    idle: http.idle,
    arrived: (count = 1) => http.arrived(count),
    reset() {
      http.resetAnswers();
      http.resetArrivals();
      sockets.resetConnectScripts();
      violations.length = 0;
      log.clear();
    },
  };
}

/**
 * Runs a test body with a fake transport and ends it with `assertNoViolations()`, so a contract
 * violation that the client under test swallowed still fails the test. When the body itself fails
 * and a violation was recorded, the violation is thrown (it is the likelier cause) and the body's
 * own failure is its `cause`.
 */
export async function withFakeTransport<Result>(
  run: (fake: FakeTransport) => Result | Promise<Result>,
  options: FakeTransportOptions = {},
): Promise<Result> {
  const fake = createFakeTransport(options);
  let result: Result;
  try {
    result = await run(fake);
  } catch (error) {
    const first = fake.violations[0];
    if (!first || first === error) throw error;
    if (first.cause === undefined) first.cause = error;
    throw first;
  }
  fake.assertNoViolations();
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Answers of the contract that need no fake
// ═══════════════════════════════════════════════════════════════════════════════════════

function registryOperation(operationId: string): CoreApiOperation {
  const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (!operation) throw new FakeTransportUsageError(`the registry has no operation "${operationId}"`, 'NO_EXAMPLE');
  return operation;
}

/** The registry's example of an operation as an answer: of `status` (default: the lowest 2xx), by `name` (default: the first). */
export function exampleAnswer(operationId: FakeOperationId, status?: number, name?: string): FakeAnswer {
  return exampleAnswerOf(registryOperation(operationId), CORE_API_EXAMPLES, status, name);
}

/** The registry's example input of an operation: its path parameters and its request body. */
export function exampleInput(operationId: FakeOperationId): { params?: Readonly<Record<string, string>>; body?: unknown } {
  return exampleInputOf(registryOperation(operationId), CORE_API_EXAMPLES);
}

/** A refusal: the error envelope with `code`, as the Core server answers `status`. */
export function refusal(
  status: number,
  code: string,
  message = 'Refused.',
  details?: Readonly<Record<string, string | number | boolean | null>>,
): FakeAnswer {
  return { status, body: { error: { code, message, ...(details ? { details } : {}) } } };
}

/** 429 `RATE_LIMITED` with its `retry-after` header: the denial budget or the throttle is used up. */
export function rateLimited(retryAfterSeconds = 30): FakeAnswer {
  return { ...refusal(429, 'RATE_LIMITED', 'Too many requests. Try again later.'), retryAfterSeconds };
}

/** 503 `NOT_READY`: the database or the engine is not ready, or a demo reset is running. */
export function notReady(): FakeAnswer {
  return refusal(503, 'NOT_READY', 'The Core server is not ready.');
}
