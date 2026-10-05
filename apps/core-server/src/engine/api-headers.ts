/**
 * The two headers of spec API-7, in ONE place (plan row W26, fix round B2a; decisions D78 DN-8,
 * D87; review `gateway_check/04_cp_backend_foundation.md` §7.3).
 *
 * THE RULE (API-7). Every 2xx answer of a POST carries `x-dems-epoch` and `x-dems-revision`: the
 * revision of the change that holds the command's effect, or the current revision when nothing
 * replicated changed. The engine owns both numbers, so the engine's unit sets both headers, for
 * every route of the server, with two hooks on the root instance:
 *
 *   before the handler   a POST of an operation of the contract registry that passed the
 *                        request stages, the parsing and the validation gets a record. The
 *                        handler runs inside it: a unit of the engine that the request runs (a
 *                        hosted command, `engine.run`, the mirror of the operators) notes the
 *                        position of its committed outcome there;
 *   when the answer      a POST with such a record and a 2xx status gets each of the two headers
 *   is sent              that the handler did not set itself: from the noted outcome of the
 *                        request when there is one, from `app.engine` as it is then otherwise.
 *
 * WHICH ANSWERS CARRY THE HEADERS. Every answer with a status 200 to 299 to a POST of an
 * operation of the contract registry that reached its handler. On the server that is every 2xx
 * answer of a POST: a route that is no registry operation does not pass the boot check of the
 * access rules, so the server has none. Not a GET. Not a POST that a request stage refused (401,
 * 403, 429, 503), that failed its validation (422, 400) or that its handler refused or failed
 * (4xx, 5xx): the specification asks for the 2xx answers, and a refusal changed nothing a client
 * waits for. Not a scratch route of a test, which is no operation of the registry whatever name
 * it gives itself: the header set such a test pins (the response headers of OR-9, the origin
 * rules) is not the contract's API.
 *
 * WHY A LATE READ IS RIGHT when no outcome was noted (a server-native command: a sign-in, a
 * pairing): the revision read when the answer is sent is equal to or above the one that holds
 * the command's effect, and every revision up to it has been published. A client that waits for
 * it gets what it waits for. A read that is too EARLY would be the defect, and this hook cannot
 * make one: it reads after the handler.
 *
 * A header that a handler set stays as it is: a handler of a hosted command may set the exact
 * values of its outcome, as the modules did before this hook existed.
 *
 * Nothing here is stored or logged, and nothing of a request is kept beyond the request: the
 * record holds two numbers.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { CORE_API_OPERATIONS, EPOCH_HEADER_NAME, REVISION_HEADER_NAME } from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';

/** A position of the replicated state: what the two headers say. */
export interface StatePosition {
  readonly epoch: number;
  readonly revision: number;
}

/** The record of one POST that reached its handler. */
interface RequestRecord {
  /** The position of the last unit of the engine that this request ran and that committed. */
  outcome: StatePosition | null;
}

export interface StatePositionHeaders {
  /**
   * Notes the position of a committed unit of the engine for the request that ran it. Outside a
   * request (a tick, a connection of the realtime channel) it does nothing.
   */
  note(position: StatePosition): void;
}

/** The POST operations of the contract registry, by `operationId`: the answers API-7 speaks of. */
const POST_OPERATIONS: ReadonlySet<string> = new Set(CORE_API_OPERATIONS.filter((operation) => operation.method === 'post').map((operation) => operation.operationId));

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** `position` when both of its numbers can stand in a header; null otherwise (a test double without them). */
export function statePositionOf(position: { readonly epoch?: unknown; readonly revision?: unknown }): StatePosition | null {
  const { epoch, revision } = position;
  return isCount(epoch) && isCount(revision) ? { epoch, revision } : null;
}

/**
 * Adds the two hooks to `app` (the root instance: every route of every unit). `current` reads
 * the position of the engine when an answer is sent; null when there is none to tell.
 */
export function registerStatePositionHeaders(app: FastifyInstance, current: () => StatePosition | null): StatePositionHeaders {
  /** The record of the request whose handler is running, followed through its asynchronous work. */
  const running = new AsyncLocalStorage<RequestRecord>();
  /** The same record by its request: the answer is not always sent from inside the handler's work. */
  const records = new WeakMap<FastifyRequest, RequestRecord>();

  // `preHandler`: after the stages, the body and the validation. A request that was refused
  // before never gets a record. Callback form: the rest of the request runs inside `run`.
  app.addHook('preHandler', (request, _reply, done) => {
    // API-7 is a rule of the contract's operations: a route names its operation in its config.
    // (Read defensively: the answer for a route that does not exist has no route of its own.)
    const config: { readonly operationId?: string } | undefined = request.routeOptions.config;
    if (request.method !== 'POST' || config?.operationId === undefined || !POST_OPERATIONS.has(config.operationId)) {
      done();
      return;
    }
    const record: RequestRecord = { outcome: null };
    records.set(request, record);
    running.run(record, done);
  });

  app.addHook('onSend', (request, reply, payload, done) => {
    const record = records.get(request);
    if (record !== undefined && reply.statusCode >= 200 && reply.statusCode < 300) {
      const position = record.outcome ?? current();
      if (position !== null) {
        if (!reply.hasHeader(EPOCH_HEADER_NAME)) void reply.header(EPOCH_HEADER_NAME, position.epoch);
        if (!reply.hasHeader(REVISION_HEADER_NAME)) void reply.header(REVISION_HEADER_NAME, position.revision);
      }
    }
    done(null, payload);
  });

  return {
    note(position) {
      const record = running.getStore();
      if (record !== undefined) record.outcome = position;
    },
  };
}
