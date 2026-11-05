/**
 * The serial unit-of-work queue (plan row W21, decision D20; spec §2.3 stages 8 to 10, §8.2
 * ENG-1, ENG-5, ENG-6, ENG-23; SR-72; SD-04).
 *
 * ONE queue per server process, reached through the seam `app.pipeline`. The engine host runs
 * its commands and its ticks on it, and every server-native module (identity, the permission
 * guard, pairing, administration) runs its state changes on it. So a command's state change,
 * its audit rows and its events commit together, and no two units ever interleave.
 *
 * What `run(label, work)` guarantees:
 *
 *   order        units run strictly one after another, in the order of submission (ENG-6). The
 *                next unit starts only after the one before it has committed or rolled back,
 *                and not before the next turn of the event loop, so the continuation of the
 *                caller that just finished runs first;
 *   one unit     at most one transaction on one connection, opened at the unit's first statement
 *                (`unit-of-work.ts`). A unit that touches no table costs no round trip;
 *   atomic       `work` returns: COMMIT, then `run` resolves with its value. `work` throws:
 *                ROLLBACK, then `run` rejects with what was thrown. Nothing in between;
 *   a lost       when the connection of a unit goes away while the unit holds it (the server
 *   connection   stops, the backend is ended, the socket fails), nothing of the unit is stored
 *                and `run` rejects with 503 (`DATABASE_UNAVAILABLE`), whatever the work function
 *                threw: its failure is a consequence of the loss, not an answer. Readiness is
 *                set off at once and a probe is started; the next probe that succeeds sets it on;
 *   the answer   `run` resolves after the commit, so a handler that awaits it answers after the
 *                commit (ENG-4). Publications go into `unit.afterCommit(...)`: those run after
 *                the commit and before the next unit, so they leave in commit order;
 *   bounded      at most `PIPELINE_MAX_PENDING` units wait; one more is refused at once (503);
 *   watchdog     a unit that runs longer than `PIPELINE_UNIT_TIMEOUT_MS` is abandoned: its
 *                connection is closed, so the server rolls it back; `run` rejects (503) and the
 *                queue goes on. A unit that throws or times out never blocks the queue;
 *   no nesting   a unit that submits another unit would wait for itself. `run` refuses that
 *                with `PIPELINE_REENTRANT` at once, instead of a time-out five seconds later.
 *
 * Shutdown (`close()`, called from the `onClose` hook of this unit, which runs after the hooks
 * of the engine, the realtime channel and the modules, and before the pool closes): new
 * submissions are refused, the accepted units finish; after `PIPELINE_CLOSE_TIMEOUT_MS` the
 * units that still wait are refused in order and the running one is abandoned.
 *
 * The log of this file holds a unit's number and label, counts, durations and codes.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool, QueryResultRow } from 'pg';
import { describeError, type ErrorLog } from '../plugins/logger';
import { createUnitAuditWriter } from './audit-writer';
import type { Clock } from './clock';
import { CoreError, PipelineFailure, PipelineRefusal, SqlState, sqlStateOf } from './errors';
import { createUnitEventWriter } from './event-writer';
import {
  PIPELINE_CLOSE_TIMEOUT_MS,
  PIPELINE_MAX_PENDING,
  PIPELINE_UNIT_TIMEOUT_MS,
  UNIT_LABEL_MAX_LENGTH,
  UNIT_LABEL_PATTERN,
} from './limits';
import type { CommittedUnit, Pipeline, PipelineSnapshot, UnitContext } from './types';
import { UnitState } from './unit-of-work';

export interface PipelineLimits {
  readonly maxPending: number;
  readonly unitTimeoutMs: number;
  readonly closeTimeoutMs: number;
}

export const PIPELINE_LIMITS: PipelineLimits = Object.freeze({
  maxPending: PIPELINE_MAX_PENDING,
  unitTimeoutMs: PIPELINE_UNIT_TIMEOUT_MS,
  closeTimeoutMs: PIPELINE_CLOSE_TIMEOUT_MS,
});

export interface PipelineDependencies {
  /** The current pool of the runtime role. A function: a reset replaces the pool. */
  readonly pool: () => Pool;
  /** The server clock, for the `at` of the rows the writers append. */
  readonly clock: Clock;
  readonly log: FastifyBaseLogger;
  readonly errorLog: ErrorLog;
  /**
   * Called when a unit could not reach the database or could not commit, so that readiness
   * follows (ENG-5: health then reports `ready.database: false`).
   */
  readonly onDatabaseFailure?: () => void;
  /**
   * Called, before `onDatabaseFailure`, when a unit lost the connection it held: the database
   * is not known to answer from this moment on, whatever a probe said a second ago.
   */
  readonly onConnectionLost?: () => void;
  /** Tests pass smaller limits. Production uses `PIPELINE_LIMITS`. */
  readonly limits?: Partial<PipelineLimits>;
}

type Work = (unit: UnitContext) => unknown;

interface Waiting {
  readonly label: string;
  readonly work: Work;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: unknown) => void;
}

type Outcome =
  | { readonly kind: 'done'; readonly value: unknown; readonly committed: boolean }
  | { readonly kind: 'failed'; readonly error: unknown }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'closed' };

export function createPipeline(dependencies: PipelineDependencies): Pipeline {
  const { log, errorLog } = dependencies;
  const limits: PipelineLimits = { ...PIPELINE_LIMITS, ...dependencies.limits };
  const unitDependencies = { pool: dependencies.pool, statementTimeoutMs: limits.unitTimeoutMs };
  const writerDependencies = { clock: dependencies.clock, log, errorLog };

  /** The unit whose work function is on the call stack or in one of its continuations. */
  const inUnit = new AsyncLocalStorage<UnitState>();
  const waiting: Waiting[] = [];
  const idleWaiters: Array<() => void> = [];
  const commitListeners = new Set<(unit: CommittedUnit) => void>();

  let accepting = true;
  let running: UnitState | null = null;
  /** Ends the running unit from outside (shutdown). */
  let stopRunning: (() => void) | null = null;
  /** True between the end of a unit and the next turn of the event loop. */
  let yielding = false;
  let closing: Promise<void> | null = null;
  let sequence = 0;
  let completed = 0;
  let failed = 0;
  let timedOut = 0;
  let refused = 0;
  /** A full queue is announced once, until it has room again. */
  let fullAnnounced = false;
  /** An outage of the database is announced once, until a unit commits again. */
  let outageAnnounced = false;

  function persist(level: 'error' | 'warn', message: string, error: unknown, context: Record<string, string | number | boolean | null>): void {
    errorLog.append({ level, source: 'core.pipeline', message, ...describeError(error), context });
  }

  function contextFor(state: UnitState): UnitContext {
    const context: UnitContext = {
      id: state.id,
      label: state.label,
      get db() {
        state.assertOpen();
        return state.database;
      },
      query: <Row extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]) =>
        state.execute<Row>(text, values),
      audit: createUnitAuditWriter(state, writerDependencies),
      events: createUnitEventWriter(state, writerDependencies),
      afterCommit(task) {
        state.assertOpen();
        if (typeof task !== 'function') throw new TypeError('afterCommit takes a function');
        state.afterCommitTasks.push(task);
      },
    };
    return state.issue(Object.freeze(context));
  }

  async function runUnit(state: UnitState, context: UnitContext, work: Work): Promise<Outcome> {
    let value: unknown;
    try {
      value = await inUnit.run(state, () => work(context));
    } catch (error) {
      await state.rollback();
      throw error;
    }
    const committed = await state.commit();
    return { kind: 'done', value, committed };
  }

  /**
   * After a unit ended well: the commit listeners first (the engine's ring), then the unit's own
   * tasks. A unit has a head exactly when it opened a transaction, and it is here only after
   * that transaction committed; a unit without one committed nothing and has no listener call.
   */
  function afterCommit(state: UnitState): void {
    const where = { unit: state.id, label: state.label };
    const head = state.lastHead;
    if (head !== null) {
      const unit: CommittedUnit = Object.freeze({
        id: state.id,
        label: state.label,
        auditRows: Object.freeze([...state.auditRows]),
        events: Object.freeze([...state.events]),
        head,
        // Row 94 (DF-27): a unit that re-sealed the chain says so, with the chain as stored after it.
        ...(state.resealed === null ? {} : { resealed: Object.freeze({ head: state.resealed.head, rows: Object.freeze([...state.resealed.rows]) }) }),
      });
      for (const listener of commitListeners) {
        try {
          listener(unit);
        } catch (error) {
          log.error({ ...where, code: describeError(error).code ?? describeError(error).errorName }, 'a commit listener failed');
          persist('error', 'a commit listener failed', error, where);
        }
      }
    }
    for (const task of state.afterCommitTasks) {
      try {
        task();
      } catch (error) {
        log.error({ ...where, code: describeError(error).code ?? describeError(error).errorName }, 'a task after the commit failed');
        persist('error', 'a task after the commit failed', error, where);
      }
    }
  }

  function notifyIdle(): void {
    if (running !== null || waiting.length > 0) return;
    for (const resolve of idleWaiters.splice(0)) resolve();
  }

  async function execute(item: Waiting): Promise<void> {
    const state = new UnitState((sequence += 1), item.label, unitDependencies);
    const where = { unit: state.id, label: state.label };
    running = state;
    const started = performance.now();
    let timer: NodeJS.Timeout | undefined;

    const outcome = await new Promise<Outcome>((settle) => {
      timer = setTimeout(() => settle({ kind: 'timeout' }), limits.unitTimeoutMs);
      stopRunning = () => settle({ kind: 'closed' });
      let context: UnitContext;
      try {
        context = contextFor(state);
      } catch (error) {
        settle({ kind: 'failed', error });
        return;
      }
      runUnit(state, context, item.work).then(settle, (error: unknown) => settle({ kind: 'failed', error }));
    });
    clearTimeout(timer);
    stopRunning = null;
    const ms = Math.round(performance.now() - started);

    if (outcome.kind === 'done') {
      completed += 1;
      if (outcome.committed) outageAnnounced = false;
      log.debug({ ...where, ms, committed: outcome.committed, audit: state.auditRows.length, events: state.events.length }, 'unit completed');
      afterCommit(state);
      item.resolve(outcome.value);
    } else if (outcome.kind === 'failed') {
      failed += 1;
      // A unit whose connection went away under it: the database does not answer. What the work
      // function threw (the driver's error, the query builder's wrapper around it, or a refusal it
      // decided on after a statement had failed) is not what the caller is told.
      const lost = state.lostConnection;
      const error =
        lost !== null && !(outcome.error instanceof PipelineFailure)
          ? new PipelineFailure(PipelineRefusal.DATABASE_UNAVAILABLE, lost.error)
          : outcome.error;
      if (lost !== null) dependencies.onConnectionLost?.();
      const description = describeError(error);
      const reason = error instanceof PipelineFailure ? error.reason : undefined;
      if (reason === PipelineRefusal.DATABASE_UNAVAILABLE || reason === PipelineRefusal.COMMIT_FAILED) {
        const cause = error instanceof Error ? error.cause : undefined;
        const line = { ...where, ms, code: reason, cause: describeError(cause).code ?? describeError(cause).errorName };
        // While the database is away every unit fails the same way: one error line and one
        // persistent entry for the outage, the rest at debug level. A failed COMMIT is always told.
        if (reason === PipelineRefusal.COMMIT_FAILED || !outageAnnounced) {
          log.error(line, 'unit not committed');
          persist('error', 'a unit of work could not be committed', cause ?? error, { ...where, ms, reason });
        } else {
          log.debug(line, 'unit not committed');
        }
        if (reason === PipelineRefusal.DATABASE_UNAVAILABLE) outageAnnounced = true;
        dependencies.onDatabaseFailure?.();
        item.reject(error);
      } else if (reason === undefined && sqlStateOf(error) === SqlState.QUERY_CANCELED) {
        // The server's side of the watchdog: a statement ran past the unit's statement limit and
        // was cancelled. The unit was rolled back; for the caller it is the same refusal.
        failed -= 1;
        timedOut += 1;
        const code = PipelineRefusal.UNIT_TIMEOUT;
        log.error({ ...where, ms, code, phase: 'statement', timeoutMs: limits.unitTimeoutMs }, 'unit abandoned: it ran too long');
        persist('error', 'a statement of a unit of work ran too long and was cancelled', error, { ...where, ms, timeoutMs: limits.unitTimeoutMs });
        item.reject(new PipelineFailure(code, error));
      } else {
        // A refusal or a failure of the work function: its caller reports it. Here, the code only.
        log.debug({ ...where, ms, code: reason ?? sqlStateOf(error) ?? description.errorName }, 'unit rolled back');
        item.reject(error);
      }
    } else {
      // Abandoned: the connection is closed and the server rolls back. What the work function
      // still does can no longer write through this unit.
      const phase = state.phase;
      state.abandon();
      if (outcome.kind === 'timeout') {
        timedOut += 1;
        const code = PipelineRefusal.UNIT_TIMEOUT;
        log.error({ ...where, ms, code, phase, timeoutMs: limits.unitTimeoutMs }, 'unit abandoned: it ran too long');
        errorLog.append({
          level: 'error',
          source: 'core.pipeline',
          message: 'a unit of work ran too long and was abandoned',
          code,
          context: { ...where, ms, phase, timeoutMs: limits.unitTimeoutMs },
        });
        item.reject(new PipelineFailure(code));
      } else {
        failed += 1;
        log.warn({ ...where, ms, code: PipelineRefusal.CLOSED, phase }, 'unit abandoned: the pipeline closed');
        item.reject(new PipelineFailure(PipelineRefusal.CLOSED));
      }
    }

    running = null;
    if (waiting.length < limits.maxPending) fullAnnounced = false;
    notifyIdle();
    // The next unit starts in a later turn of the event loop: the caller that just got its
    // result continues first, and a long queue cannot starve the timers and the sockets.
    yielding = true;
    setImmediate(() => {
      yielding = false;
      startNext();
    });
  }

  function startNext(): void {
    if (running !== null || yielding) return;
    const next = waiting.shift();
    if (next === undefined) return;
    execute(next).catch((error: unknown) => {
      // Not reachable by design: `execute` settles every unit itself. If it ever throws, the
      // unit is refused and the queue goes on; a queue that stops would stop the server.
      log.error({ label: next.label, code: describeError(error).code ?? describeError(error).errorName }, 'pipeline defect');
      persist('error', 'the pipeline failed while it ran a unit', error, { label: next.label });
      next.reject(new PipelineFailure(PipelineRefusal.COMMIT_FAILED, error));
      running?.abandon();
      running = null;
      stopRunning = null;
      notifyIdle();
      setImmediate(startNext);
    });
  }

  function refuse(reason: PipelineRefusal): Promise<never> {
    refused += 1;
    return Promise.reject(new PipelineFailure(reason));
  }

  async function finish(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const drained = await Promise.race([
      pipeline.drain().then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), limits.closeTimeoutMs);
      }),
    ]);
    clearTimeout(timer);
    let abandoned = 0;
    if (!drained) {
      const left = waiting.splice(0);
      abandoned = left.length + (running === null ? 0 : 1);
      for (const item of left) {
        refused += 1;
        item.reject(new PipelineFailure(PipelineRefusal.CLOSED));
      }
      const label = running?.label ?? null;
      stopRunning?.();
      // The abandoned unit gives its connection up in its own turn; wait for that.
      await pipeline.drain();
      log.error({ code: 'PIPELINE_CLOSE_TIMEOUT', abandoned, running: label, timeoutMs: limits.closeTimeoutMs }, 'pipeline closed before it was drained');
      errorLog.append({
        level: 'error',
        source: 'core.pipeline',
        message: 'the pipeline closed before it was drained',
        code: 'PIPELINE_CLOSE_TIMEOUT',
        context: { abandoned, running: label, timeoutMs: limits.closeTimeoutMs },
      });
    }
    log.info({ drained, abandoned, completed, failed, timedOut, refused }, 'pipeline closed');
  }

  const pipeline: Pipeline = {
    run<T>(label: string, work: (unit: UnitContext) => Promise<T> | T): Promise<T> {
      if (typeof label !== 'string' || label.length > UNIT_LABEL_MAX_LENGTH || !UNIT_LABEL_PATTERN.test(label)) {
        return Promise.reject(
          new CoreError('UNIT_LABEL_INVALID', 'the label of a unit of work is a name such as identity.signIn, chosen in the code'),
        );
      }
      if (typeof work !== 'function') {
        return Promise.reject(new TypeError('pipeline.run takes a label and a function'));
      }
      const outer = inUnit.getStore();
      if (outer !== undefined && !outer.ended) {
        return Promise.reject(
          new CoreError(
            'PIPELINE_REENTRANT',
            'a unit of work cannot submit another unit: it would wait for itself. Do the work in this unit, or submit after it ended',
          ),
        );
      }
      if (!accepting) return refuse(PipelineRefusal.CLOSED);
      // While nothing runs, the first unit in line is about to run: it is not one that waits.
      if (waiting.length >= limits.maxPending + (running === null ? 1 : 0)) {
        if (!fullAnnounced) {
          fullAnnounced = true;
          log.warn({ code: PipelineRefusal.QUEUE_FULL, pending: waiting.length, running: running?.label ?? null }, 'pipeline queue full');
          errorLog.append({
            level: 'warn',
            source: 'core.pipeline',
            message: 'the pipeline queue is full; units are refused',
            code: PipelineRefusal.QUEUE_FULL,
            context: { pending: waiting.length, running: running?.label ?? null },
          });
        }
        return refuse(PipelineRefusal.QUEUE_FULL);
      }
      return new Promise<T>((resolve, reject) => {
        waiting.push({ label, work, resolve: resolve as (value: unknown) => void, reject });
        // Never inside the caller's own turn: units that are submitted together start in order.
        queueMicrotask(startNext);
      });
    },

    drain(): Promise<void> {
      if (running === null && waiting.length === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        idleWaiters.push(resolve);
      });
    },

    onCommit(listener) {
      commitListeners.add(listener);
      return () => {
        commitListeners.delete(listener);
      };
    },

    snapshot(): PipelineSnapshot {
      return {
        accepting,
        running: running === null ? null : { id: running.id, label: running.label },
        // Between two units nothing runs for one turn of the event loop; the first in line is
        // then the unit that is about to run, as in the admission rule of `run`.
        pending: running === null ? Math.max(0, waiting.length - 1) : waiting.length,
        completed,
        failed,
        timedOut,
        refused,
      };
    },

    close(): Promise<void> {
      accepting = false;
      closing ??= finish();
      return closing;
    },
  };

  return pipeline;
}
