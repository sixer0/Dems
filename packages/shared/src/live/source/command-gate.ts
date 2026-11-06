/**
 * Own-command atomicity: the gate between the socket's state messages and the store (HB-14;
 * backend task 04_client_integration_spec §2.5 CL-16, CL-17, CL-18; 01_specs RT-5).
 *
 * In the simulator the code after an action always sees the action's effect, and nothing renders
 * between the state change and that code. In Live mode the effect arrives on the socket (a delta
 * of revision N) and the answer arrives over HTTP (revision N in a header), in either order. The
 * gate makes both orders look like the simulator:
 *
 * | State | Event | What the gate does |
 * |-------|-------|--------------------|
 * | No command in flight, nothing held back | A state message | Applied at once |
 * | A command in flight (`begin`) | A state message | **Held**, in order |
 * | A command in flight | Its answer names revision N and the store has not reached N (`wait`) | The command keeps waiting; a timer of the settle time-out starts |
 * | A command waits for N | The held messages now reach N (delta first: at the answer; answer first: at the delta) | The held messages up to N are applied in ONE store update, then the command is settled, **in the same synchronous turn**. Messages beyond N stay held while another command is in flight; else they are part of the same update |
 * | A command waits for N | The settle time-out passes (CL-17) | One `resync` is asked for, everything held is applied, the command is settled (the server did accept it) |
 * | A command in flight | It ends with nothing to wait for: a refusal, no answer, no replicated state (`end`) | What may be applied is applied, then the command is settled |
 * | Held back by the caller (`hold`: the session of the socket is not known yet) | A state message | Held until `release` |
 * | Any | `reset` (the session ended) | Everything held is dropped, the position is forgotten, every waiting command is settled as `dropped` |
 * | Any | `halt` (the source was stopped) | Everything held is dropped, every hold is lifted, every waiting command is settled as `dropped` and its timer is cleared. The position stays: the store keeps what it holds |
 * | More than `maxHeld` messages are held | The next state message | Everything held is dropped (`overflow` is told how many) and the gate is **behind**: deltas are dropped until a snapshot comes. As soon as no command is in flight and nothing holds, ONE `resync` is asked for. A command that waited for a dropped message leaves by its own time-out |
 *
 * A wait has one of two targets: a **position** (an epoch and a revision: reached when the store
 * is at a later epoch, or at that epoch and revision or beyond; so an answer of a new epoch settles
 * with the snapshot of that epoch, CL-18), or the **first snapshot of a later connection** (a
 * sign-in: the socket is reopened and its snapshot is the effect, §5.2).
 *
 * "One store update" is the caller's `apply`: it gets the messages to fold and commits them, with
 * whatever the settling command adds (`extra`), in one call. The gate never touches the store.
 *
 * Meter frames do not come here: they are never held (CL-16).
 *
 * Framework-free. The timer functions are injected.
 */
import type { LiveSocketTimers } from '../../realtime/live-socket-client';
import type { SimState } from '../../sim/types';
import { hasReached, type ReplicaPosition, type StateMessage } from './replica';

export type GateTarget =
  | ({ readonly kind: 'position' } & ReplicaPosition)
  | { readonly kind: 'snapshot'; /** Reached by the first snapshot of a connection with a higher number. */ readonly afterConnection: number };

/** How a waiting command ended: its target was reached, its time-out passed, or the session ended (or the source was stopped) under it. */
export type GateOutcome = 'reached' | 'timeout' | 'dropped';

export interface GateWaitOptions {
  readonly timeoutMs: number;
  /** Members to commit in the same store update as the messages that reach the target. Asked right before that update. */
  extra?(): Partial<SimState> | undefined;
  /** Settles the command. For `reached` it runs in the turn of the store update, right after it. */
  settle(outcome: GateOutcome): void;
}

/** The two one-shot timer functions of the socket client's injected timers. A handle is opaque. */
export type GateTimers = Pick<LiveSocketTimers, 'setTimeout' | 'clearTimeout'>;

export interface CommandGateOptions {
  /** Folds `messages` into the store, with `extra`, in ONE update. Called with at least one message or an `extra`. */
  apply(messages: readonly StateMessage[], extra: Partial<SimState> | undefined): void;
  /** CL-17: asks the socket for a new snapshot. */
  requestResync(): void;
  timers: GateTimers;
  /** Receives what a `settle` or an `extra` callback threw; the gate goes on. */
  report(error: unknown): void;
  /** The most state messages that are held back. Left out: no bound. */
  readonly maxHeld?: number;
  /** Told once for every time the bound was passed, with the number of messages that were dropped. */
  overflow?(dropped: number): void;
}

export interface CommandGate {
  /** A command of this client starts: state messages are held from now on. */
  begin(): void;
  /** The command ended with nothing to wait for. `settle` runs in this turn, after what may be applied was applied. */
  end(settle: () => void): void;
  /** The command was answered and waits for `target`. */
  wait(target: GateTarget, options: GateWaitOptions): void;
  /** One state message of the socket, in the order the socket handed it on. */
  receive(message: StateMessage): void;
  /** Holds every state message back until `release` (the session of the socket is being asked for). Counted. */
  hold(): void;
  release(): void;
  /** The session ended: drops what is held, forgets the position, settles every waiting command as `dropped`. */
  reset(): void;
  /** The source was stopped: drops what is held, lifts every hold, settles every waiting command as `dropped`. No timer is left. The position stays. */
  halt(): void;
  /** Where the store stands; null while it holds no replicated state. */
  readonly position: ReplicaPosition | null;
  /** Commands of this client between `begin` and their settlement. */
  readonly inFlight: number;
  /** State messages held back. */
  readonly held: number;
}

interface Waiter {
  readonly target: GateTarget;
  readonly options: GateWaitOptions;
  timer: { readonly handle: unknown } | null;
}

export function createCommandGate(options: CommandGateOptions): CommandGate {
  const { timers } = options;
  let position: ReplicaPosition | null = null;
  /** The connection of the last snapshot applied; 0 while there was none. */
  let snapshotConnection = 0;
  let held: StateMessage[] = [];
  let waiters: Waiter[] = [];
  let inFlight = 0;
  let holds = 0;
  let pumping = false;
  /** State messages were dropped: the store is behind, and only a snapshot repairs it. */
  let behind = false;
  /** The snapshot that repairs it was asked for. */
  let resyncAsked = false;

  const guarded = (run: () => void): void => {
    try {
      run();
    } catch (error) {
      try {
        options.report(error);
      } catch {
        // A failing sink must never stop the gate.
      }
    }
  };

  /** How many held messages must be applied before `target` is reached: 0 when it already is, null when they do not reach it. */
  function reachedAfter(target: GateTarget): number | null {
    if (target.kind === 'position') {
      if (hasReached(position, target)) return 0;
      for (let index = 0; index < held.length; index += 1) {
        const { message } = held[index] as StateMessage;
        if (hasReached(message, target)) return index + 1;
      }
      return null;
    }
    if (snapshotConnection > target.afterConnection) return 0;
    for (let index = 0; index < held.length; index += 1) {
      const entry = held[index] as StateMessage;
      if (entry.message.type === 'snapshot' && entry.connection > target.afterConnection) return index + 1;
    }
    return null;
  }

  /** Applies the first `count` held messages, with `extra`, in one store update. */
  function applyHeld(count: number, extra: Partial<SimState> | undefined): void {
    const batch = held.slice(0, count);
    held = held.slice(count);
    for (const entry of batch) {
      position = { epoch: entry.message.epoch, revision: entry.message.revision };
      if (entry.message.type === 'snapshot') snapshotConnection = entry.connection;
    }
    if (batch.length === 0 && extra === undefined) return;
    guarded(() => options.apply(batch, extra));
  }

  function clearTimer(waiter: Waiter): void {
    if (waiter.timer === null) return;
    timers.clearTimeout(waiter.timer.handle);
    waiter.timer = null;
  }

  function extraOf(waiter: Waiter): Partial<SimState> | undefined {
    let extra: Partial<SimState> | undefined;
    guarded(() => {
      extra = waiter.options.extra?.();
    });
    return extra;
  }

  /** Settles every command whose target the held messages reach, nearest first; then applies what nobody waits behind. */
  function pump(): void {
    if (pumping) return;
    pumping = true;
    try {
      for (;;) {
        let nearest: { waiter: Waiter; count: number } | null = null;
        for (const waiter of waiters) {
          const count = reachedAfter(waiter.target);
          if (count !== null && (nearest === null || count < nearest.count)) nearest = { waiter, count };
        }
        if (nearest !== null) {
          const { waiter } = nearest;
          waiters = waiters.filter((other) => other !== waiter);
          clearTimer(waiter);
          // The last command in flight: nobody waits behind what is held beyond its target.
          const count = inFlight <= 1 && holds === 0 ? held.length : nearest.count;
          applyHeld(count, extraOf(waiter));
          inFlight = Math.max(0, inFlight - 1);
          // The continuation: in the turn of the store update, right after it (CL-16).
          guarded(() => waiter.options.settle('reached'));
          continue;
        }
        if (inFlight === 0 && holds === 0 && held.length > 0) {
          applyHeld(held.length, undefined);
          continue;
        }
        if (behind && !resyncAsked && inFlight === 0 && holds === 0) {
          // Nobody waits behind the gate any more: the one snapshot that repairs the store.
          resyncAsked = true;
          guarded(() => options.requestResync());
        }
        return;
      }
    } finally {
      pumping = false;
    }
  }

  function timedOut(waiter: Waiter): void {
    if (!waiters.includes(waiter)) return;
    waiters = waiters.filter((other) => other !== waiter);
    waiter.timer = null;
    if (waiter.target.kind === 'position') {
      // CL-17: the delta of the answered revision did not come. Ask for a snapshot, apply what is
      // held, and settle: the server did accept the command.
      guarded(() => options.requestResync());
      if (behind) resyncAsked = true;
      applyHeld(held.length, extraOf(waiter));
    }
    inFlight = Math.max(0, inFlight - 1);
    guarded(() => waiter.options.settle('timeout'));
    pump();
  }

  return {
    begin() {
      inFlight += 1;
    },
    end(settle) {
      inFlight = Math.max(0, inFlight - 1);
      pump();
      guarded(settle);
    },
    wait(target, waitOptions) {
      const waiter: Waiter = { target, options: waitOptions, timer: null };
      waiter.timer = { handle: timers.setTimeout(() => timedOut(waiter), waitOptions.timeoutMs) };
      waiters.push(waiter);
      pump();
    },
    receive(message) {
      if (behind) {
        // A delta cannot be built on a state that lost messages.
        if (message.message.type !== 'snapshot') return;
        behind = false;
        resyncAsked = false;
      }
      held.push(message);
      pump();
      if (options.maxHeld !== undefined && held.length > options.maxHeld) {
        const dropped = held.length;
        held = [];
        behind = true;
        guarded(() => options.overflow?.(dropped));
        pump();
      }
    },
    hold() {
      holds += 1;
    },
    release() {
      holds = Math.max(0, holds - 1);
      pump();
    },
    halt() {
      held = [];
      holds = 0;
      behind = false;
      resyncAsked = false;
      const dropped = waiters;
      waiters = [];
      inFlight = 0;
      for (const waiter of dropped) {
        clearTimer(waiter);
        guarded(() => waiter.options.settle('dropped'));
      }
    },
    reset() {
      held = [];
      position = null;
      behind = false;
      resyncAsked = false;
      const dropped = waiters;
      waiters = [];
      for (const waiter of dropped) {
        clearTimer(waiter);
        inFlight = Math.max(0, inFlight - 1);
        guarded(() => waiter.options.settle('dropped'));
      }
    },
    get position() {
      return position;
    },
    get inFlight() {
      return inFlight;
    },
    get held() {
      return held.length;
    },
  };
}
