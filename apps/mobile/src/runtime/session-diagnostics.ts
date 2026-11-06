/**
 * Session-window diagnostics for the release-build measurement W98 (post-review fix FXR-M, finding W93-28;
 * code review W93 §6, RF2-2 of D237).
 *
 * RF2-2: on the tablet a web stop ~11 s into a recording left 'Recording' up 3.2 s and 6.7 s; the replica
 * learnt the stop and the seal late (+7.7 s / +12.4 s) with no socket close. The code cannot tell the two
 * remaining causes apart: (a) the JS thread blocked for seconds right after the stop, or (b) deltas dropped
 * (a gap, or a pending resync) and the replacing resync waited on its spacing or the send budget. W98 needs:
 *
 * - the socket's counters (`deltas`, `deltasDropped`, `deltasStale`, `resyncs`, the pending `resync`) at
 *   every session-state transition the route sync sees (LIVE only);
 * - a 250 ms JS-lag sampler (the drift of a plain interval) over the session window, summarised per
 *   transition (samples, worst lag, how many over 500 ms and over 1 s, and when the worst one was).
 *
 * One record per transition, `runtime.diag.sessionWindow`, level `info`, written with `reportDiagnostic`:
 * kept in `dems.mobile.log.v1` but NOT printed to the console (no Metro or LogBox noise), and never more than
 * one record per transition, so the 200-record ring is not flooded. No fix is made here: the measurement
 * decides (a) or (b).
 *
 * Blueprint row 62 (B11, RK-5; prepares M5-SW-T): the late-stop WAIT POINT. The transition record above says
 * that the stop was learnt late, not where the time went. A stop passes four points on this device, and each
 * now carries a timestamp that can be cited next to the Core log and a screen recording:
 *
 *   1. `coreStoppedAt`  the Core's own stop instant (the session's `stoppedAt`, Core clock);
 *   2. `storeAt`        the replica's store first holds "not RECORDING" for that session (a store listener,
 *                       so it is the instant the JS thread applied the delta or the snapshot);
 *   3. `commitAt`       React committed that state (this component's effect);
 *   4. `handoverAt`     the `/session/live` route committed the in-place Finalizing hand-over
 *                       (`useLateStopHandoverMark`, its own record `runtime.diag.lateStop.handover`).
 *
 * `runtime.diag.lateStop` holds 1-3, the two waits between them (`coreToStoreMs`, `storeToCommitMs`), the
 * socket counters at arming and at the store instant (dropped deltas and resyncs in between = cause (b)), and
 * the same JS-lag window as the transition record (cause (a)). `waitPoint` names the longer wait when the
 * whole is `LATE_STOP_MS` or more. Device instants are ISO strings of the device clock; `...Core` instants are
 * the Core clock as this client estimates it (`core-clock.ts`), so they compare with the Core log directly.
 * No behaviour changes: one passive store listener while RECORDING, records through `reportDiagnostic`
 * (quiet, blanked by the log's shared redaction rules).
 */
import { useEffect, useRef } from 'react';
import { liveOf } from '@dems/shared/live';
import { useActiveSession } from './contract';
import { coreClockOf } from './core-clock';
import { useRuntimeInternals } from './internals';
import { reportDiagnostic } from './log';
import type { MobileLiveSim } from './sim-adapters';

/** The sampler's period (ms). */
export const JS_LAG_SAMPLE_MS = 250;

/** States of the session window: from arming to the end of finalizing. */
const WINDOW_STATES: ReadonlySet<string> = new Set(['ARMED', 'RECORDING', 'STOPPING', 'FINALIZING']);

export interface JsLagWindow {
  readonly samples: number;
  readonly lagMaxMs: number;
  readonly lagOver500: number;
  readonly lagOver1000: number;
  /** Milliseconds from the window's start to the worst lag, or null without samples. */
  readonly lagMaxAtMs: number | null;
}

export interface JsLagSampler {
  start(): void;
  stop(): void;
  /** The summary since the last `take()` (or `start()`), then a new window starts. */
  take(): JsLagWindow;
  readonly running: boolean;
}

type IntervalTimers = {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
};

const GLOBAL_INTERVALS: IntervalTimers = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

/** The drift of a plain `JS_LAG_SAMPLE_MS` interval: how late each tick ran (a busy JS thread runs it late). */
export function createJsLagSampler(now: () => number = Date.now, timers: IntervalTimers = GLOBAL_INTERVALS): JsLagSampler {
  let handle: unknown = null;
  let windowStart = 0;
  let last = 0;
  let samples = 0;
  let lagMaxMs = 0;
  let lagMaxAt: number | null = null;
  let over500 = 0;
  let over1000 = 0;
  const reset = (at: number): void => {
    windowStart = at;
    samples = 0;
    lagMaxMs = 0;
    lagMaxAt = null;
    over500 = 0;
    over1000 = 0;
  };
  return {
    start() {
      if (handle !== null) return;
      const at = now();
      reset(at);
      last = at;
      handle = timers.setInterval(() => {
        const t = now();
        const lag = Math.max(0, t - last - JS_LAG_SAMPLE_MS);
        last = t;
        samples += 1;
        if (lag > 500) over500 += 1;
        if (lag > 1000) over1000 += 1;
        if (lagMaxAt === null || lag > lagMaxMs) {
          lagMaxMs = lag;
          lagMaxAt = t - windowStart;
        }
      }, JS_LAG_SAMPLE_MS);
    },
    stop() {
      if (handle === null) return;
      timers.clearInterval(handle);
      handle = null;
    },
    take() {
      const window: JsLagWindow = { samples, lagMaxMs, lagOver500: over500, lagOver1000: over1000, lagMaxAtMs: samples > 0 ? lagMaxAt : null };
      reset(now());
      return window;
    },
    get running() {
      return handle !== null;
    },
  };
}

/** The socket counters W98 reads, from a Live source's status; `{}` without a Live source. Pure. */
export function socketDiagnosticsOf(live: Pick<MobileLiveSim, 'socketStatus'> | null): Record<string, string | number | boolean | null> {
  if (live === null) return { live: false };
  try {
    const status = live.socketStatus();
    const c = status.counters;
    return {
      live: true,
      link: status.link,
      synced: status.synced,
      resyncPending: status.resync === null ? null : String(status.resync),
      revision: status.revision,
      deltas: c.deltas,
      deltasDropped: c.deltasDropped,
      deltasStale: c.deltasStale,
      resyncs: c.resyncs,
      reconnects: c.reconnects,
    };
  } catch {
    return { live: true, statusUnavailable: true };
  }
}

/** From this total (Core stop to React commit, ms) a stop counts as learnt late and `waitPoint` is named. */
export const LATE_STOP_MS = 1_000;

/** Where the longer wait of a late stop was. `UNKNOWN`: late by the device's own two instants is not decidable. */
export type LateStopWaitPoint = 'NONE' | 'BEFORE_STORE' | 'STORE_TO_COMMIT' | 'UNKNOWN';

/** What the store listener keeps at the instant the replica first holds "not RECORDING". */
export interface LateStopStoreMark {
  /** Device clock, epoch ms. */
  readonly atMs: number;
  /** The Core clock as this client estimates it at that instant, or null (a simulator). */
  readonly atCoreMs: number | null;
  /** The session state the store then held; null = the session was gone. */
  readonly state: string | null;
  /** The session's `stoppedAt` in that store state (Core clock), or null when not there yet. */
  readonly coreStoppedAtMs: number | null;
  readonly socket: Record<string, string | number | boolean | null>;
}

export interface LateStopInput {
  readonly sessionId: string | null;
  /** The state React committed. */
  readonly to: string | null;
  /** Null when the listener saw nothing before the commit (a runtime without a store listener). */
  readonly store: LateStopStoreMark | null;
  readonly commitAtMs: number;
  readonly commitAtCoreMs: number | null;
  /** `stoppedAt` read at the commit, used when the store mark had none yet. */
  readonly coreStoppedAtCommitMs: number | null;
  /** The socket counters when the listener was armed (RECORDING committed). */
  readonly armedSocket: Record<string, string | number | boolean | null>;
  readonly lag: JsLagWindow;
}

const iso = (ms: number | null): string | null => (ms === null || !Number.isFinite(ms) ? null : new Date(ms).toISOString());
const since = (to: unknown, from: unknown): number | null => (typeof to === 'number' && typeof from === 'number' ? to - from : null);

/** The `runtime.diag.lateStop` context: the instants, the waits between them and the named wait point. Pure. */
export function lateStopRecordOf(input: LateStopInput): Record<string, string | number | boolean | null> {
  const { store, commitAtMs, commitAtCoreMs, lag } = input;
  const coreStoppedAtMs = store?.coreStoppedAtMs ?? input.coreStoppedAtCommitMs;
  // The Core clock at the store instant; without a store mark the commit is the first instant known here.
  const firstKnownCoreMs = store === null ? commitAtCoreMs : store.atCoreMs;
  const coreToStoreMs = store === null ? null : since(store.atCoreMs, coreStoppedAtMs);
  const storeToCommitMs = store === null ? null : commitAtMs - store.atMs;
  const coreToCommitMs = since(commitAtCoreMs, coreStoppedAtMs);
  let waitPoint: LateStopWaitPoint = 'UNKNOWN';
  if (coreToCommitMs !== null && coreToStoreMs !== null && storeToCommitMs !== null) {
    if (coreToCommitMs < LATE_STOP_MS) waitPoint = 'NONE';
    else waitPoint = coreToStoreMs >= storeToCommitMs ? 'BEFORE_STORE' : 'STORE_TO_COMMIT';
  } else if (storeToCommitMs !== null && storeToCommitMs >= LATE_STOP_MS) {
    // No Core instant (a simulator, or `stoppedAt` not replicated): the device's own wait is still decidable.
    waitPoint = 'STORE_TO_COMMIT';
  }
  return {
    sessionId: input.sessionId ?? 'none',
    to: input.to ?? 'none',
    storeState: store === null ? null : (store.state ?? 'none'),
    coreStoppedAt: iso(coreStoppedAtMs),
    storeAt: iso(store?.atMs ?? null),
    storeAtCore: iso(store?.atCoreMs ?? null),
    commitAt: iso(commitAtMs),
    commitAtCore: iso(commitAtCoreMs),
    coreToStoreMs,
    storeToCommitMs,
    coreToCommitMs,
    // Kept apart from `coreToStoreMs`: with no store mark this is "Core stop to the first instant known here".
    coreToFirstKnownMs: since(firstKnownCoreMs, coreStoppedAtMs),
    waitPoint,
    lateStopMs: LATE_STOP_MS,
    droppedSinceArm: since(store?.socket['deltasDropped'], input.armedSocket['deltasDropped']),
    staleSinceArm: since(store?.socket['deltasStale'], input.armedSocket['deltasStale']),
    resyncsSinceArm: since(store?.socket['resyncs'], input.armedSocket['resyncs']),
    reconnectsSinceArm: since(store?.socket['reconnects'], input.armedSocket['reconnects']),
    resyncPendingAtStore: (store?.socket['resyncPending'] as string | null | undefined) ?? null,
    revisionAtStore: (store?.socket['revision'] as number | null | undefined) ?? null,
    clockSampleAgeMs: (store?.socket['clockSampleAgeMs'] as number | null | undefined) ?? null,
    live: store?.socket['live'] ?? input.armedSocket['live'] ?? false,
    ...lag,
  };
}

/** The socket counters plus the age of the newest server-time sample (how fresh the Core-clock estimate is). */
function socketAt(live: MobileLiveSim | null, atMs: number): Record<string, string | number | boolean | null> {
  const base = socketDiagnosticsOf(live);
  if (live === null) return base;
  try {
    const sample = live.socketStatus().serverTime;
    return { ...base, clockSampleAgeMs: sample === null ? null : atMs - sample.receivedAt };
  } catch {
    return base;
  }
}

/**
 * Point 4 of the late stop (row 62): `/session/live` calls this with `true` in the render that draws the
 * in-place Finalizing hand-over. One quiet record per hand-over with the device and Core instants of that
 * commit; it changes nothing the route renders.
 */
export function useLateStopHandoverMark(handover: boolean): void {
  const { sessionId } = useActiveSession();
  const sim = useRuntimeInternals()?.sim ?? null;
  useEffect(() => {
    if (!handover) return;
    const at = Date.now();
    reportDiagnostic('runtime.diag.lateStop.handover', 'Monitor handed over to Finalizing in place (row 62 wait point 4)', {
      sessionId: sessionId ?? 'none',
      handoverAt: iso(at),
      handoverAtCore: iso(coreClockOf(sim)?.now() ?? null),
    });
    // One record per hand-over: the session id is read at that commit, a later change is not a new hand-over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handover]);
}

/**
 * Mounted with the route sync in `(app)/_layout.tsx`: runs the sampler while a session is in its window and
 * writes one quiet record per session-state transition. Renders nothing.
 */
export function SessionDiagnostics(): null {
  const { state, sessionId } = useActiveSession();
  const sim = useRuntimeInternals()?.sim ?? null;
  const sampler = useRef<JsLagSampler | null>(null);
  const previous = useRef<string | null>(state);
  // Row 62: the session the store listener is armed for, and what it saw at the stop.
  const armed = useRef<{ sessionId: string | null; socket: Record<string, string | number | boolean | null> } | null>(null);
  const storeMark = useRef<LateStopStoreMark | null>(null);

  useEffect(() => {
    sampler.current ??= createJsLagSampler();
    const s = sampler.current;
    const from = previous.current;
    previous.current = state;
    if (from !== state && (WINDOW_STATES.has(String(from)) || WINDOW_STATES.has(String(state)))) {
      const live = sim === null ? null : liveOf<MobileLiveSim>(sim);
      const lag = s.take();
      reportDiagnostic('runtime.diag.sessionWindow', 'Session state transition (W98 measurement)', {
        from: from ?? 'none',
        to: state ?? 'none',
        sessionId: sessionId ?? 'none',
        ...lag,
        ...socketDiagnosticsOf(live),
      });
      // Row 62: RECORDING left = a stop reached React. One record with the wait points of that stop.
      if (from === 'RECORDING' && armed.current !== null) {
        const commitAtMs = Date.now();
        let coreStoppedAtCommitMs: number | null = null;
        try {
          const current = sim?.store.getState().session ?? null;
          if (current !== null && current.id === armed.current.sessionId) coreStoppedAtCommitMs = current.stoppedAt;
        } catch {
          // A store that cannot be read leaves the Core instant unknown; the record still goes out.
        }
        reportDiagnostic(
          'runtime.diag.lateStop',
          'Recording stop reached this device (row 62 wait points)',
          lateStopRecordOf({
            sessionId: armed.current.sessionId,
            to: state,
            store: storeMark.current,
            commitAtMs,
            commitAtCoreMs: coreClockOf(sim)?.now() ?? null,
            coreStoppedAtCommitMs,
            armedSocket: armed.current.socket,
            lag,
          }),
        );
        armed.current = null;
        storeMark.current = null;
      }
    }
    if (WINDOW_STATES.has(String(state))) s.start();
    else s.stop();
  }, [state, sessionId, sim]);

  // Row 62: while RECORDING, a passive store listener keeps the first instant the replica holds "not
  // RECORDING" for this session. Declared after the effect above on purpose: on the commit that leaves
  // RECORDING the effect above reads the mark first, and this one does not arm again.
  useEffect(() => {
    if (sim === null || state !== 'RECORDING') return undefined;
    const live = liveOf<MobileLiveSim>(sim);
    const forSession = sessionId;
    armed.current = { sessionId: forSession, socket: socketAt(live, Date.now()) };
    storeMark.current = null;
    // The selector form: the listener runs only when this session's state changes, not per store write.
    return sim.store.subscribe(
      (s) => (s.session !== null && s.session.id === forSession ? s.session.state : null),
      (held) => {
        if (storeMark.current !== null || held === 'RECORDING') return;
        const atMs = Date.now();
        const current = sim.store.getState().session ?? null;
        storeMark.current = {
          atMs,
          atCoreMs: coreClockOf(sim)?.now() ?? null,
          state: held,
          coreStoppedAtMs: held !== null && current !== null ? current.stoppedAt : null,
          socket: socketAt(live, atMs),
        };
      },
    );
  }, [state, sessionId, sim]);

  useEffect(
    () => () => {
      sampler.current?.stop();
    },
    [],
  );
  return null;
}
