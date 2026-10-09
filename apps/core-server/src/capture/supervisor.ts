/**
 * The capture supervisor (blueprint row 57 / M3-W1; register NM-03; capture spec §A.3, §B.2).
 *
 * WHAT IT DOES. It owns the one capture worker process of the one open session (R-6): it starts
 * it, shakes hands, sends the commands, watches the heartbeat, restarts it with an exponential
 * back-off when it goes down, gives up with `CAPTURE_FAULT` when the restarts are exhausted, and
 * hands the worker's messages to its listeners through a bounded queue.
 *
 * ONE PROCESS PER SESSION, NEVER REUSED (S1 G-1, SP-5; D10(b)). The RTSP listen ingest exits when
 * the client sends TEARDOWN and refuses a second push; restarting only the pusher is not enough.
 * So `start` always starts a NEW worker process, `stop` always ends it, and a restart inside a
 * session is a new process too. A new process is started only after the previous one is known to
 * have exited (it is killed and its exit is awaited): no stale listener holds the RTSP port.
 *
 * WHAT IT DOES NOT DO. It names no process, no file, no timer of the runtime and no clock: the
 * launcher, the timers and `now` are injected (static rule G-R8). Production passes the process
 * launcher of `ipc.ts`, the system timers of `timers.ts` and the server clock; a test passes an
 * in-memory worker, manual timers and a manual clock, and waits for nothing in real time.
 *
 * HEARTBEAT. The worker sends `HEARTBEAT` with a counter that only grows. A heartbeat whose
 * counter did not grow is not a sign of life. No valid heartbeat for `heartbeatTimeoutMs` ends the
 * worker (SIGKILL) and counts as a crash.
 *
 * BACK-OFF. Restart number n of a row waits `backoffBaseMs * backoffFactor^n`, at most
 * `backoffMaxMs`. After `maxRestarts` restarts in a row the supervisor raises the warning
 * `CAPTURE_FAULT`: a session that never started is refused (`start` rejects, the supervisor is
 * idle again); a session that was recording stays open in phase `FAULTED` until it is stopped. A
 * worker that ran `stableAfterMs` without a crash clears the count.
 *
 * THE RESTART RULE (blueprint row 58; decision D67, option C per OD-08; spec §B.2). A worker is
 * restarted inside a session ONLY while the session holds no durable fragment. The first record
 * of a fragment (`FIRST_DURABLE_FRAGMENT`, `FRAGMENT_CHECKPOINT`) sets `durable`; from then on a worker that goes down is not replaced: the session
 * goes to `FAULTED` with one `CAPTURE_FAULT` and stays open, so that the durable prefix can be
 * sealed as interrupted. No restarted worker ever writes into an existing evidence file. The
 * record is a hint and can be missing (a worker killed between its write and its frame), so the
 * worker holds the same line from the file: it creates a camera file only at its first complete
 * fragment and refuses a `START` whose output path already holds a file (`OUTPUT_EXISTS`); that
 * refusal is not retried and marks the session durable as well. Between sessions every start is a
 * fresh worker, as before. WHAT MAKES THE RESTART SAFE is that rule of the worker, checked on the
 * disk (decision D72 on D58-1): the supervisor can hold `durable: false` for a back-off while
 * bytes are on the disk (a worker killed between its write and its frame), and the worker it then
 * starts writes nothing and opens nothing at the output paths before it refuses. A durable record
 * that is still in the pipe of a worker the supervisor itself ended is read for that one fact.
 * A refusal that another try cannot change (`FINAL_START_REFUSALS`) and a crash a new worker would
 * repeat (`FINAL_CRASH_CODES`: no camera connected) are not retried either.
 *
 * THE SUPERVISOR'S OWN FAULT ENDS when a later session reaches `RECORDING`: the `CAPTURE_FAULT`
 * it raised is then said again with state `CLEARED`, so that the next failure is a new fault.
 *
 * RECORDS (spec §B.2 R-1 to R-3). A `RECORD` is handled the moment its line arrives, beside
 * `ACK`: its sequence number must be exactly one more than the last of the session (a gap or a
 * repeat is a `PROTOCOL_VIOLATION`), and it is handed to the `record` listeners at once, in
 * order, like the supervisor's own events. Records are low-rate by contract: more than
 * `recordBurstLimit` inside `recordWindowMs`, a second first-fragment, first-video or
 * keyframe-interval record of a camera, and any record after the seal completion are violations too, so a worker cannot grow
 * the memory of a record consumer without being ended. It never enters the queue below, so nothing a
 * listener of levels does, and no flood of levels, can lose or reorder a record.
 *
 * THE WORKER'S OUTPUT IS ALWAYS READ. Nothing a listener does stops the supervisor from reading:
 * `HEARTBEAT` and `ACK` are handled the moment their line arrives, before and apart from any
 * queue. (Until fix round 1 a full queue paused the pipe; the heartbeats and acknowledgements
 * behind the pause were not read, and a healthy worker with a slow listener was killed. A pause
 * cannot be told from a dead worker, so there is none.)
 *
 * TWO KINDS OF EVENT, TWO PATHS.
 *   the supervisor's own   `workerDown`, `phase`, the warning it raises itself (`CAPTURE_FAULT`)
 *                          and `record` are few and are what the error log is written from. Each
 *                          is handed to its listeners in order, and no listener is waited for: a
 *                          listener that never returns holds nobody up. They are handed out
 *                          AFTER the step that raised them is finished (the phase is set, the
 *                          timers are armed), never in the middle of it: a listener may call
 *                          `stop` or `start` from inside one and finds the supervisor consistent
 *                          (pair-57 re-check N-1).
 *   the worker's           `telemetry`, `progress` and the worker's warnings go through ONE queue
 *                          and are delivered one at a time; a listener may return a promise and
 *                          the next of these events waits for it.
 *
 * THE QUEUE HAS A HARD BOUND: never more than `eventQueueLimit` events wait. Since the pipe is
 * never paused, the bound is kept by what the events are:
 *   - telemetry is a level, not a record: a frame that still waits is REPLACED by a newer one;
 *   - progress is a level per step: a waiting value of the SAME step is replaced by the newer;
 *   - a warning that still waits is not queued a second time (same code, same subject);
 *   - at the bound, room is made by evicting the oldest telemetry, then the oldest progress; a
 *     warning is never evicted for a level. New telemetry at the bound is dropped itself. Only a
 *     queue that is full of distinct warnings drops a new event.
 * Replaced and dropped telemetry is counted in `droppedTelemetry`, everything else in
 * `droppedEvents`, and the first loss at the bound of each episode is reported (and so written to
 * the error log) as `CAPTURE_EVENT_OVERFLOW`. A record that must never be lost therefore does NOT
 * belong in this queue, and has its own path (above). What still waits in the queue when its
 * session ends is dropped and counted: an event of a session that is over is never delivered
 * into the next one (pair-57 re-check N-2).
 *
 * COMMANDS. A command is written to the worker's input at once (the channel resolves when the
 * pipe took it; the supervisor does not wait for that before the next command). The bound is the
 * window of commands that await their `ACK`: at most `commandQueueLimit`, each at most one frame;
 * one more is refused with `CAPTURE_BACKPRESSURE`, never queued. `STOP` is outside the window: it
 * is always written, so that a worker can flush and close before the grace ends.
 */
import {
  CAPTURE_INTERNAL_ACTION,
  CAPTURE_IPC_DEFAULTS,
  CAPTURE_PROTOCOL_VERSION,
  CaptureMicRole,
  CapturePlanSchema,
  CaptureRecordKind,
  CaptureStopReason,
  CaptureWarningCode,
  CaptureWarningState,
  DURABLE_RECORD_KINDS,
  FINAL_CRASH_CODES,
  FINAL_START_REFUSALS,
  ONCE_PER_CAMERA_RECORD_KINDS,
  SupervisorMessageType,
  WorkerMessageType,
  backoffDelayMs,
  type AckMessage,
  type CaptureIpcLimits,
  type CapturePlan,
  type RecordMessage,
  type SupervisorMessage,
  type WorkerMessage,
} from '@dems/capture-protocol';
import {
  CapturePhase,
  CaptureRefusal,
  CaptureSupervisorError,
  WorkerDownCode,
  WorkerLaunchError,
  type CaptureEvent,
  type CaptureEventName,
  type CaptureReport,
  type CaptureStatus,
  type CaptureSupervisor,
  type CaptureSupervisorOptions,
  type WorkerChannel,
  type WorkerDown,
} from './types';

/** Longest session ID the supervisor takes: a correlation ID built from it must fit the protocol's 128 characters. */
export const MAX_SESSION_ID_CHARS = 80;
const SESSION_ID = /^[A-Za-z0-9._:-]+$/;

type CommandResult = { readonly ack: AckMessage } | { readonly refusal: CaptureSupervisorError };

interface PendingCommand {
  settle(result: CommandResult): void;
  cancelTimer(): void;
}

interface Worker {
  readonly attempt: number;
  /** The session it was started for. */
  readonly of: Session;
  /** What it already reported: `kind:deviceId` of the once-only records. */
  readonly reported: Set<string>;
  sealed: boolean;
  /** Arrival times of its newest records, for the rate ceiling. */
  readonly recordTimes: number[];
  channel: WorkerChannel | null;
  hello: boolean;
  started: boolean;
  exited: boolean;
  lastCounter: number;
  lastHeartbeatAt: number;
  cancelHello(): void;
  cancelWatchdog(): void;
  cancelStable(): void;
  readonly pending: Map<string, PendingCommand>;
}

interface Session {
  readonly id: string;
  readonly correlationId: string;
  plan: CapturePlan;
  attempt: number;
  restarts: number;
  commandSeq: number;
  /** True once the session may hold a fragment on the disk: no worker is started for it again. */
  durable: boolean;
  /** The sequence number of the last record of the session's worker; 0 before the first. */
  recordSeq: number;
  /** What a warning of this session may be about: the device IDs and the mic roles of its plan. */
  readonly subjects: ReadonlySet<string>;
  /** The cameras of its plan: what a fragment record may be about. */
  readonly cameras: ReadonlySet<string>;
  startWaiter: { resolve(): void; reject(error: CaptureSupervisorError): void } | null;
  stopping: CaptureStopReason | null;
  readonly stopWaiters: Array<() => void>;
}

interface DownCause {
  readonly code: WorkerDownCode;
  readonly detail?: string | null;
  readonly exitCode?: number | null;
  readonly signal?: string | null;
  /** False when another try cannot change the outcome. */
  readonly retryable?: boolean;
}

/** A listener as the registry holds it. */
type AnyListener = (event: CaptureEvent) => void | Promise<void>;
/** The events that come from the worker's messages. */
type WorkerEvent = Extract<CaptureEvent, { name: 'telemetry' | 'progress' }> | (Extract<CaptureEvent, { name: 'warning' }> & { source: 'worker' });
/** The events the supervisor raises itself. */
type OwnEvent = Extract<CaptureEvent, { name: 'workerDown' | 'phase' | 'record' }> | (Extract<CaptureEvent, { name: 'warning' }> & { source: 'supervisor' });

/** What a worker says when a file is already at one of its output paths: it writes nothing there (option C). */
export const OUTPUT_EXISTS = 'OUTPUT_EXISTS';

const nothing = (): void => {};

export function createCaptureSupervisor(options: CaptureSupervisorOptions): CaptureSupervisor {
  const limits: CaptureIpcLimits = { ...CAPTURE_IPC_DEFAULTS, ...options.limits };
  const { now, launcher } = options;
  const reportTo = options.report ?? nothing;
  /** A report never throws back into the supervisor: the thing it reports already went wrong. */
  const report = (entry: CaptureReport): void => {
    try {
      reportTo(entry);
    } catch {
      // Nowhere left to say it.
    }
  };

  // ── Steps ───────────────────────────────────────────────────────────────────────────────────
  // Everything that enters the supervisor from outside (a call of the seam, a message, an exit, a
  // timer) runs as one STEP. The supervisor's own events are collected while a step runs and are
  // handed to their listeners when the outermost step is finished: a listener never sees half a
  // transition, and what it calls from inside an event is a step of its own on a consistent state.

  let depth = 0;
  const outbox: OwnEvent[] = [];
  let handingOut = false;

  function handOut(): void {
    if (handingOut) return;
    handingOut = true;
    try {
      for (let event = outbox.shift(); event !== undefined; event = outbox.shift()) deliverOwn(event);
    } finally {
      handingOut = false;
    }
  }

  function step<Result>(run: () => Result): Result {
    depth += 1;
    try {
      return run();
    } finally {
      depth -= 1;
      if (depth === 0) handOut();
    }
  }

  /** The injected timers, with every callback run as a step. */
  const timers = {
    after: (delayMs: number, callback: () => void): (() => void) => options.timers.after(delayMs, () => step(callback)),
  };

  let phase: CapturePhase = CapturePhase.CLOSED;
  let session: Session | null = null;
  let worker: Worker | null = null;
  /** A worker that was killed and whose exit has not been seen yet. No new worker starts before it. */
  let reaping: Worker | null = null;
  const reapWaiters: Array<() => void> = [];
  let cancelBackoff = nothing;
  let cancelStopGrace = nothing;
  let lastCrash: WorkerDown | null = null;
  let sessionSeq = 0;
  /** The session whose `CAPTURE_FAULT` of the supervisor has not been cleared yet. */
  let ownFault: { sessionId: string; correlationId: string } | null = null;

  const listeners = new Map<CaptureEventName, Set<AnyListener>>();
  const queue: CaptureEvent[] = [];
  let pumping = false;
  let droppedTelemetry = 0;
  let droppedEvents = 0;
  /** True from the first loss at the bound until the queue is at most half full again. */
  let overflowing = false;

  // ── Events ──────────────────────────────────────────────────────────────────────────────────

  async function pump(): Promise<void> {
    if (pumping) return;
    pumping = true;
    try {
      for (let event = queue.shift(); event !== undefined; event = queue.shift()) {
        if (overflowing && queue.length <= Math.floor(limits.eventQueueLimit / 2)) overflowing = false;
        for (const listener of listeners.get(event.name) ?? []) {
          try {
            const result = listener(event);
            // Only a listener that is behind makes the others wait.
            if (result instanceof Promise) await result;
          } catch (err) {
            report({ source: 'capture.supervisor.listener', code: 'CAPTURE_LISTENER_FAILED', sessionId: event.sessionId, correlationId: event.correlationId, err });
          }
        }
      }
    } finally {
      pumping = false;
    }
  }

  /** What makes two waiting events of the worker the same piece of information. */
  function sameAs(event: WorkerEvent): (queued: CaptureEvent) => boolean {
    if (event.name === 'telemetry') return (queued) => queued.name === 'telemetry';
    if (event.name === 'progress') return (queued) => queued.name === 'progress' && queued.frame.step === event.frame.step;
    return (queued) => queued.name === 'warning' && queued.code === event.code && queued.subject === event.subject && queued.state === event.state;
  }

  /** Makes room at the bound for a progress value or a warning. False when only warnings wait. */
  function evictALevel(): boolean {
    const telemetry = queue.findIndex((queued) => queued.name === 'telemetry');
    if (telemetry !== -1) {
      queue.splice(telemetry, 1);
      droppedTelemetry += 1;
      return true;
    }
    const progress = queue.findIndex((queued) => queued.name === 'progress');
    if (progress === -1) return false;
    queue.splice(progress, 1);
    droppedEvents += 1;
    return true;
  }

  /** An event that came from the worker: through the bounded queue, one at a time. */
  function emitFromWorker(event: WorkerEvent): void {
    const waiting = queue.findIndex(sameAs(event));
    if (waiting !== -1) {
      if (event.name === 'telemetry') droppedTelemetry += 1;
      else droppedEvents += 1;
      // The same warning is said once; a level is replaced by its newer value.
      if (event.name === 'warning') return;
      queue.splice(waiting, 1);
    } else if (queue.length >= limits.eventQueueLimit) {
      const first = !overflowing;
      overflowing = true;
      let room = false;
      if (event.name === 'telemetry') droppedTelemetry += 1;
      else if (evictALevel()) room = true;
      else droppedEvents += 1;
      if (first) {
        report({
          source: 'capture.supervisor.events',
          code: 'CAPTURE_EVENT_OVERFLOW',
          sessionId: event.sessionId,
          correlationId: event.correlationId,
          err: new CaptureSupervisorError(CaptureRefusal.BACKPRESSURE, 'the listeners of the capture events are behind: the queue is at its limit and events are dropped'),
        });
      }
      if (!room) return;
    }
    queue.push(event);
    // `pump` catches what a listener throws and `report` does not throw; the catch is the last line of defence.
    pump().catch(nothing);
  }

  /** An event of the supervisor itself: to every listener, waiting for none, once the step that raised it is finished. */
  function emit(event: OwnEvent): void {
    outbox.push(event);
    if (depth === 0) handOut();
  }

  function deliverOwn(event: OwnEvent): void {
    for (const listener of listeners.get(event.name) ?? []) {
      const failed = (err: unknown): void => report({ source: 'capture.supervisor.listener', code: 'CAPTURE_LISTENER_FAILED', sessionId: event.sessionId, correlationId: event.correlationId, err });
      try {
        const result = listener(event);
        if (result instanceof Promise) result.catch(failed);
      } catch (err) {
        failed(err);
      }
    }
  }

  function setPhase(next: CapturePhase, of: Session | null = session): void {
    if (phase === next) return;
    const previous = phase;
    phase = next;
    if (of !== null) emit({ name: 'phase', sessionId: of.id, correlationId: of.correlationId, phase: next, previous });
  }

  // ── Commands ────────────────────────────────────────────────────────────────────────────────

  function sendCommand(
    current: Session,
    to: Worker,
    build: (envelope: { v: typeof CAPTURE_PROTOCOL_VERSION; sessionId: string; correlationId: string }) => SupervisorMessage,
    done: (result: CommandResult) => void,
    /** `STOP` only: written even when the window of unacknowledged commands is full. */
    outsideWindow = false,
  ): void {
    const channel = to.channel;
    if (channel === null || to.exited) {
      done({ refusal: new CaptureSupervisorError(CaptureRefusal.WORKER_DOWN, 'the capture worker is not running') });
      return;
    }
    if (!outsideWindow && to.pending.size >= limits.commandQueueLimit) {
      done({ refusal: new CaptureSupervisorError(CaptureRefusal.BACKPRESSURE, 'too many capture commands await their acknowledgement') });
      return;
    }
    current.commandSeq += 1;
    const correlationId = `${current.correlationId}:${current.commandSeq}`;
    const settle = (result: CommandResult): void => {
      const pending = to.pending.get(correlationId);
      if (pending === undefined) return;
      to.pending.delete(correlationId);
      pending.cancelTimer();
      done(result);
    };
    to.pending.set(correlationId, {
      settle,
      cancelTimer: timers.after(limits.ackTimeoutMs, () => {
        settle({ refusal: new CaptureSupervisorError(CaptureRefusal.COMMAND_TIMEOUT, 'the capture worker did not acknowledge a command in time') });
      }),
    });
    channel.send(build({ v: CAPTURE_PROTOCOL_VERSION, sessionId: current.id, correlationId })).catch(() => {
      step(() => settle({ refusal: new CaptureSupervisorError(CaptureRefusal.WORKER_DOWN, 'the capture worker took no command: its input is closed') }));
    });
  }

  // ── A worker goes down ──────────────────────────────────────────────────────────────────────

  function whenReaped(next: () => void): void {
    if (reaping === null) next();
    else reapWaiters.push(next);
  }

  function reaped(dead: Worker): void {
    if (reaping !== dead) return;
    reaping = null;
    for (const next of reapWaiters.splice(0)) next();
  }

  /** Takes the worker out of service. A process that is not known to have exited is killed and awaited. */
  function retire(dead: Worker): void {
    worker = null;
    dead.cancelHello();
    dead.cancelWatchdog();
    dead.cancelStable();
    for (const pending of dead.pending.values()) {
      pending.settle({ refusal: new CaptureSupervisorError(CaptureRefusal.WORKER_DOWN, 'the capture worker went down before it acknowledged the command') });
    }
    if (!dead.exited && dead.channel !== null) {
      reaping = dead;
      dead.channel.kill('SIGKILL');
    }
  }

  /** The worker events of a session that is over are dropped, and counted: none reaches the next session. */
  function dropQueued(ended: Session): void {
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      const queued = queue[index];
      if (queued === undefined || queued.correlationId !== ended.correlationId) continue;
      queue.splice(index, 1);
      if (queued.name === 'telemetry') droppedTelemetry += 1;
      else droppedEvents += 1;
    }
    if (queue.length <= Math.floor(limits.eventQueueLimit / 2)) overflowing = false;
  }

  function finishStop(): void {
    whenReaped(() => {
      const ended = session;
      if (ended === null) return;
      cancelStopGrace();
      cancelStopGrace = nothing;
      session = null;
      dropQueued(ended);
      setPhase(CapturePhase.IDLE, ended);
      for (const resolve of ended.stopWaiters.splice(0)) resolve();
    });
  }

  function down(dead: Worker, cause: DownCause): void {
    if (worker !== dead) return;
    retire(dead);
    afterDown(dead.attempt, cause);
  }

  function afterDown(attempt: number, cause: DownCause): void {
    const current = session;
    if (current === null) return;
    if (current.stopping !== null) {
      // The exit a `stop` was waiting for: not a crash.
      finishStop();
      return;
    }
    const crash: WorkerDown = {
      at: now(),
      code: cause.code,
      detail: cause.detail ?? null,
      exitCode: cause.exitCode ?? null,
      signal: cause.signal ?? null,
      attempt,
    };
    lastCrash = crash;
    const base = { sessionId: current.id, correlationId: current.correlationId };
    // Option C (D67): a session that may hold a fragment on the disk gets no further worker.
    if (cause.retryable === false || current.durable || current.restarts >= limits.maxRestarts) {
      emit({ name: 'workerDown', ...base, down: crash, restartInMs: null });
      emit({ name: 'warning', ...base, action: CAPTURE_INTERNAL_ACTION.WARNING, code: CaptureWarningCode.CAPTURE_FAULT, state: CaptureWarningState.ACTIVE, subject: null, source: 'supervisor' });
      ownFault = ownFault ?? base;
      const waiter = current.startWaiter;
      if (waiter === null) {
        // A recording that lost its worker for good: the session stays open until it is stopped,
        // so that the durable prefix can be sealed as interrupted (OD-08).
        setPhase(CapturePhase.FAULTED);
        return;
      }
      current.startWaiter = null;
      session = null;
      dropQueued(current);
      setPhase(CapturePhase.IDLE, current);
      waiter.reject(new CaptureSupervisorError(CaptureRefusal.FAULT, 'the capture worker could not be started', cause.code));
      return;
    }
    const delay = backoffDelayMs(current.restarts, limits);
    current.restarts += 1;
    emit({ name: 'workerDown', ...base, down: crash, restartInMs: delay });
    setPhase(current.startWaiter === null ? CapturePhase.RESTARTING : CapturePhase.STARTING);
    cancelBackoff = timers.after(delay, () => {
      cancelBackoff = nothing;
      launch();
    });
  }

  // ── A worker starts ─────────────────────────────────────────────────────────────────────────

  function armWatchdog(of: Worker): void {
    of.cancelWatchdog();
    of.cancelWatchdog = timers.after(limits.heartbeatTimeoutMs, () => down(of, { code: WorkerDownCode.HEARTBEAT_TIMEOUT }));
  }

  /**
   * A line of a worker that is no longer the session's worker (it was ended; its last lines are
   * still read before its exit). Nothing of it is handed on. ONE fact is taken: a record of a
   * fragment means bytes are on the disk, so the restart that is waiting is called off.
   *
   * TWO GUARDS hold that fact to the session it belongs to (pair-58 re-check R-5; each is pinned
   * by a test of `records.test.ts`): `from.of !== current` - the dying worker of ANOTHER session
   * cannot mark this one durable; `!from.started` - a worker whose `START` was never acknowledged
   * has written nothing, whatever it says.
   */
  function onLateMessage(from: Worker, message: WorkerMessage): void {
    const current = session;
    if (current === null || from.of !== current || !from.started || current.durable || current.stopping !== null) return;
    if (message.type !== WorkerMessageType.RECORD || !DURABLE_RECORD_KINDS.includes(message.record.kind)) return;
    current.durable = true;
    if (worker !== null || phase !== CapturePhase.RESTARTING) return;
    cancelBackoff();
    cancelBackoff = nothing;
    const base = { sessionId: current.id, correlationId: current.correlationId };
    emit({ name: 'warning', ...base, action: CAPTURE_INTERNAL_ACTION.WARNING, code: CaptureWarningCode.CAPTURE_FAULT, state: CaptureWarningState.ACTIVE, subject: null, source: 'supervisor' });
    ownFault = ownFault ?? base;
    setPhase(CapturePhase.FAULTED);
  }

  function onMessage(from: Worker, message: WorkerMessage): void {
    const current = session;
    if (worker !== from) {
      onLateMessage(from, message);
      return;
    }
    if (current === null) return;
    if ('sessionId' in message && message.sessionId !== null && message.sessionId !== current.id) {
      down(from, { code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'SESSION_MISMATCH' });
      return;
    }
    if (message.type === WorkerMessageType.HELLO) {
      if (from.hello) {
        down(from, { code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'HELLO_TWICE' });
        return;
      }
      if (message.protocolVersion !== CAPTURE_PROTOCOL_VERSION) {
        down(from, { code: WorkerDownCode.PROTOCOL_MISMATCH, detail: `V${message.protocolVersion}`, retryable: false });
        return;
      }
      from.hello = true;
      from.cancelHello();
      from.lastHeartbeatAt = now();
      armWatchdog(from);
      if (current.stopping !== null) return;
      sendCommand(
        current,
        from,
        (envelope) => ({ ...envelope, type: SupervisorMessageType.START, attempt: from.attempt, plan: current.plan }),
        (result) => {
          if (worker !== from || session !== current || current.stopping !== null) return;
          if ('refusal' in result) {
            // A worker that is already down is handled where it went down.
            if (result.refusal.code === CaptureRefusal.COMMAND_TIMEOUT) down(from, { code: WorkerDownCode.START_TIMEOUT });
            return;
          }
          if (!result.ack.ok) {
            // A file is already where this worker would write: evidence may be on the disk, whatever
            // the frames said. Another worker would find the same file (the file is the truth).
            if (result.ack.code === OUTPUT_EXISTS) current.durable = true;
            // The same plan on the same disk gets the same answer: not asked again (finding A-7).
            const final = result.ack.code !== undefined && FINAL_START_REFUSALS.includes(result.ack.code);
            down(from, { code: WorkerDownCode.START_REFUSED, detail: result.ack.code ?? null, ...(final ? { retryable: false } : {}) });
            return;
          }
          from.started = true;
          from.cancelStable = timers.after(limits.stableAfterMs, () => {
            if (worker === from) current.restarts = 0;
          });
          setPhase(CapturePhase.RECORDING);
          if (ownFault !== null && ownFault.correlationId !== current.correlationId) {
            // A session records again: the fault the supervisor raised for an earlier one is over.
            emit({ name: 'warning', ...ownFault, action: CAPTURE_INTERNAL_ACTION.WARNING, code: CaptureWarningCode.CAPTURE_FAULT, state: CaptureWarningState.CLEARED, subject: null, source: 'supervisor' });
            ownFault = null;
          }
          const waiter = current.startWaiter;
          current.startWaiter = null;
          waiter?.resolve();
        },
      );
      return;
    }
    if (!from.hello) {
      down(from, { code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'HELLO_EXPECTED' });
      return;
    }
    const base = { sessionId: current.id, correlationId: current.correlationId };
    switch (message.type) {
      case WorkerMessageType.ACK:
        // An acknowledgement nobody waits for (its command timed out) is dropped.
        from.pending.get(message.correlationId)?.settle({ ack: message });
        return;
      case WorkerMessageType.HEARTBEAT:
        if (message.counter > from.lastCounter) {
          from.lastCounter = message.counter;
          from.lastHeartbeatAt = now();
          if (current.stopping === null) armWatchdog(from);
        }
        return;
      case WorkerMessageType.TELEMETRY:
        if (from.started) emitFromWorker({ name: 'telemetry', ...base, action: CAPTURE_INTERNAL_ACTION.TELEMETRY, frame: message });
        return;
      case WorkerMessageType.PROGRESS:
        if (from.started) emitFromWorker({ name: 'progress', ...base, action: CAPTURE_INTERNAL_ACTION.PROGRESS, frame: message });
        return;
      case WorkerMessageType.WARNING:
        if (message.subject !== null && !current.subjects.has(message.subject)) {
          // Not a device or a role of this session: a subject is never free text (pair-57 re-check N-3).
          down(from, { code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'WARNING_SUBJECT_UNKNOWN' });
          return;
        }
        emitFromWorker({ name: 'warning', ...base, action: CAPTURE_INTERNAL_ACTION.WARNING, code: message.code, state: message.state, subject: message.subject, source: 'worker' });
        return;
      case WorkerMessageType.CRASH:
        down(from, { code: WorkerDownCode.EXITED, detail: message.code, exitCode: message.exitCode, signal: message.signal, ...(FINAL_CRASH_CODES.includes(message.code) ? { retryable: false } : {}) });
        return;
      case WorkerMessageType.RECORD:
        onRecord(from, current, message);
        return;
    }
  }

  /** A record: checked and handed on at once, never through the queue of levels (spec §B.2 R-1, R-2). */
  function onRecord(from: Worker, current: Session, message: RecordMessage): void {
    const refuse = (detail: string): void => down(from, { code: WorkerDownCode.PROTOCOL_VIOLATION, detail });
    if (!from.started) return refuse('RECORD_BEFORE_START');
    const { record } = message;
    if (record.kind !== CaptureRecordKind.SEAL_COMPLETE && !current.cameras.has(record.deviceId)) return refuse('RECORD_SUBJECT_UNKNOWN');
    // A worker that reports a fragment has written: the session is durable BEFORE the sequence is
    // judged, so that a worker ended for a gap is not replaced either.
    if (DURABLE_RECORD_KINDS.includes(record.kind)) current.durable = true;
    if (message.seq !== current.recordSeq + 1) return refuse('RECORD_SEQUENCE_GAP');
    // Content (finding A-10): once-only records are said once per camera, and nothing follows the seal.
    if (from.sealed) return refuse('RECORD_AFTER_SEAL');
    if (record.kind !== CaptureRecordKind.SEAL_COMPLETE && ONCE_PER_CAMERA_RECORD_KINDS.includes(record.kind)) {
      // First video sample, first durable fragment, observed keyframe interval (row 59): once per camera.
      const once = `${record.kind}:${record.deviceId}`;
      if (from.reported.has(once)) return refuse('RECORD_REPEATED');
      from.reported.add(once);
    }
    // The ceiling (finding A-5): records are low-rate by contract; a flood ends the worker.
    const at = now();
    while (from.recordTimes.length > 0 && at - (from.recordTimes[0] ?? at) >= limits.recordWindowMs) from.recordTimes.shift();
    if (from.recordTimes.length >= limits.recordBurstLimit) return refuse('RECORD_RATE_EXCEEDED');
    from.recordTimes.push(at);
    if (record.kind === CaptureRecordKind.SEAL_COMPLETE) from.sealed = true;
    current.recordSeq = message.seq;
    emit({ name: 'record', sessionId: current.id, correlationId: current.correlationId, attempt: from.attempt, seq: message.seq, record });
  }

  function launch(): void {
    whenReaped(() => {
      const current = session;
      if (current === null || current.stopping !== null || worker !== null) return;
      current.attempt += 1;
      // A worker counts its own records from 1. A session gets a second worker only while it holds
      // no durable fragment, so every record of a fragment of one session is in ONE sequence.
      current.recordSeq = 0;
      const next: Worker = {
        attempt: current.attempt,
        of: current,
        reported: new Set(),
        sealed: false,
        recordTimes: [],
        channel: null,
        hello: false,
        started: false,
        exited: false,
        lastCounter: -1,
        lastHeartbeatAt: now(),
        cancelHello: nothing,
        cancelWatchdog: nothing,
        cancelStable: nothing,
        pending: new Map(),
      };
      try {
        next.channel = launcher(
          { sessionId: current.id, correlationId: current.correlationId, attempt: next.attempt },
          {
            message: (message) => step(() => onMessage(next, message)),
            violation: (violation) => step(() => down(next, { code: WorkerDownCode.PROTOCOL_VIOLATION, detail: violation })),
            exit: (exit) =>
              step(() => {
                next.exited = true;
                if (reaping === next) {
                  reaped(next);
                  return;
                }
                down(next, { code: exit.spawnFailed ? WorkerDownCode.SPAWN_FAILED : WorkerDownCode.EXITED, exitCode: exit.exitCode, signal: exit.signal });
              }),
          },
        );
      } catch (err) {
        const known = err instanceof WorkerLaunchError;
        if (!known) report({ source: 'capture.supervisor.launch', code: WorkerDownCode.SPAWN_FAILED, sessionId: current.id, correlationId: current.correlationId, err });
        afterDown(next.attempt, { code: known ? err.code : WorkerDownCode.SPAWN_FAILED, retryable: known ? err.retryable : true });
        return;
      }
      worker = next;
      next.cancelHello = timers.after(limits.helloTimeoutMs, () => down(next, { code: WorkerDownCode.HELLO_TIMEOUT }));
    });
  }

  // ── The seam ────────────────────────────────────────────────────────────────────────────────

  function openSession(sessionId: string): Session {
    const current = session;
    if (current === null || current.id !== sessionId) {
      throw new CaptureSupervisorError(CaptureRefusal.SESSION_UNKNOWN, 'no capture session with this ID is open');
    }
    return current;
  }

  const supervisor: CaptureSupervisor = {
    async boot() {
      if (phase === CapturePhase.CLOSED) phase = CapturePhase.IDLE;
    },

    async shutdown() {
      const open = session;
      if (open !== null) await supervisor.stop(open.id, CaptureStopReason.SHUTDOWN);
      phase = CapturePhase.CLOSED;
    },

    start(sessionId, plan) {
      return step(() => startSession(sessionId, plan));
    },

    stop(sessionId, reason) {
      return step(() => stopSession(sessionId, reason));
    },

    switchAudioSource(sessionId, to) {
      return step(() => switchSource(sessionId, to));
    },

    status(): CaptureStatus {
      const live = worker;
      return {
        phase,
        sessionId: session?.id ?? null,
        correlationId: session?.correlationId ?? null,
        workerPid: live?.channel?.pid ?? null,
        attempt: session?.attempt ?? 0,
        restarts: session?.restarts ?? 0,
        heartbeatAgeMs: live !== null && live.hello ? now() - live.lastHeartbeatAt : null,
        lastCrash,
        queuedEvents: queue.length,
        droppedTelemetry,
        droppedEvents,
        durable: session?.durable ?? false,
        lastRecordSeq: session?.recordSeq ?? 0,
      };
    },

    on(event, listener) {
      const set = listeners.get(event) ?? new Set<AnyListener>();
      listeners.set(event, set);
      // Stored by the event's name, so it is only ever called with events of that name.
      const entry = listener as unknown as AnyListener;
      set.add(entry);
      return () => {
        set.delete(entry);
      };
    },
  };
  return supervisor;

  function startSession(sessionId: string, plan: CapturePlan): Promise<void> {
    if (phase === CapturePhase.CLOSED) {
      return Promise.reject(new CaptureSupervisorError(CaptureRefusal.CLOSED, 'the capture supervisor is not running'));
    }
    if (session !== null) {
      return Promise.reject(new CaptureSupervisorError(CaptureRefusal.SESSION_OPEN, 'a capture session is already open: one session at a time'));
    }
    if (typeof sessionId !== 'string' || sessionId.length > MAX_SESSION_ID_CHARS || !SESSION_ID.test(sessionId)) {
      return Promise.reject(new CaptureSupervisorError(CaptureRefusal.PLAN_INVALID, 'the session ID is not usable as a capture session ID'));
    }
    const parsed = CapturePlanSchema.safeParse(plan);
    if (!parsed.success) {
      // The plan itself is never put into the message: it holds paths and addresses.
      return Promise.reject(new CaptureSupervisorError(CaptureRefusal.PLAN_INVALID, 'the capture plan is not valid', parsed.error.issues[0]?.path.join('.') ?? null));
    }
    sessionSeq += 1;
    return new Promise<void>((resolve, reject) => {
      session = {
        id: sessionId,
        correlationId: `cap:${sessionId}:${sessionSeq}`,
        plan: parsed.data,
        attempt: 0,
        restarts: 0,
        commandSeq: 0,
        durable: false,
        recordSeq: 0,
        subjects: new Set([...parsed.data.cameras.map((camera) => camera.deviceId), ...parsed.data.mics.flatMap((mic) => [mic.deviceId, mic.role])]),
        cameras: new Set(parsed.data.cameras.map((camera) => camera.deviceId)),
        startWaiter: { resolve, reject },
        stopping: null,
        stopWaiters: [],
      };
      setPhase(CapturePhase.STARTING);
      launch();
    });
  }

  function stopSession(sessionId: string, reason: CaptureStopReason): Promise<void> {
    if (session === null) return Promise.resolve();
    let current: Session;
    try {
      current = openSession(sessionId);
    } catch (error) {
      return Promise.reject(error);
    }
    const done = new Promise<void>((resolve) => current.stopWaiters.push(resolve));
    if (current.stopping !== null) return done;
    current.stopping = reason;
    cancelBackoff();
    cancelBackoff = nothing;
    const waiter = current.startWaiter;
    current.startWaiter = null;
    setPhase(CapturePhase.STOPPING);
    waiter?.reject(new CaptureSupervisorError(CaptureRefusal.START_ABORTED, 'the capture session was stopped before its worker started'));

    const live = worker;
    if (live === null || live.channel === null) {
      finishStop();
      return done;
    }
    const channel = live.channel;
    live.cancelHello();
    live.cancelWatchdog();
    cancelStopGrace = timers.after(limits.stopGraceMs, () => {
      // Past the grace: the worker is ended; the exit that follows finishes the stop.
      if (worker === live) channel.kill('SIGKILL');
    });
    if (live.hello) {
      // The worker flushes, closes its files and exits by itself.
      sendCommand(current, live, (envelope) => ({ ...envelope, type: SupervisorMessageType.STOP, reason }), nothing, true);
    } else {
      // Never shook hands: it has nothing to flush.
      channel.closeInput();
      channel.kill('SIGTERM');
    }
    return done;
  }

  function switchSource(sessionId: string, to: CaptureMicRole): Promise<void> {
    let current: Session;
    try {
      current = openSession(sessionId);
    } catch (error) {
      return Promise.reject(error);
    }
    if (to !== CaptureMicRole.PRIMARY && to !== CaptureMicRole.STANDBY) {
      return Promise.reject(new CaptureSupervisorError(CaptureRefusal.PLAN_INVALID, 'the audio source is not a mic role'));
    }
    if (!current.plan.mics.some((mic) => mic.role === to)) {
      return Promise.reject(new CaptureSupervisorError(CaptureRefusal.PLAN_INVALID, 'no mic of this session holds that role'));
    }
    const live = worker;
    if (phase === CapturePhase.RESTARTING || phase === CapturePhase.FAULTED) {
      return Promise.reject(new CaptureSupervisorError(CaptureRefusal.WORKER_DOWN, 'the capture worker is not running'));
    }
    if (phase !== CapturePhase.RECORDING || live === null || !live.started) {
      return Promise.reject(new CaptureSupervisorError(CaptureRefusal.NOT_RECORDING, 'the capture session is not recording'));
    }
    return new Promise<void>((resolve, reject) => {
      sendCommand(
        current,
        live,
        (envelope) => ({ ...envelope, type: SupervisorMessageType.SWITCH_AUDIO_SOURCE, to }),
        (result) => {
          if ('refusal' in result) {
            reject(result.refusal);
          } else if (!result.ack.ok) {
            reject(new CaptureSupervisorError(CaptureRefusal.COMMAND_REFUSED, 'the capture worker refused the switch', result.ack.code ?? null));
          } else {
            // A worker that restarts later starts with the source the operator chose.
            current.plan = { ...current.plan, activeMic: to };
            resolve();
          }
        },
      );
    });
  }
}
