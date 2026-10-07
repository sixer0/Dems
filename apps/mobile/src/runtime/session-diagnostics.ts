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
 */
import { useEffect, useRef } from 'react';
import { liveOf } from '@dems/shared/live';
import { useActiveSession } from './contract';
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

/**
 * Mounted with the route sync in `(app)/_layout.tsx`: runs the sampler while a session is in its window and
 * writes one quiet record per session-state transition. Renders nothing.
 */
export function SessionDiagnostics(): null {
  const { state, sessionId } = useActiveSession();
  const sim = useRuntimeInternals()?.sim ?? null;
  const sampler = useRef<JsLagSampler | null>(null);
  const previous = useRef<string | null>(state);

  useEffect(() => {
    sampler.current ??= createJsLagSampler();
    const s = sampler.current;
    const from = previous.current;
    previous.current = state;
    if (from !== state && (WINDOW_STATES.has(String(from)) || WINDOW_STATES.has(String(state)))) {
      const live = sim === null ? null : liveOf<MobileLiveSim>(sim);
      reportDiagnostic('runtime.diag.sessionWindow', 'Session state transition (W98 measurement)', {
        from: from ?? 'none',
        to: state ?? 'none',
        sessionId: sessionId ?? 'none',
        ...s.take(),
        ...socketDiagnosticsOf(live),
      });
    }
    if (WINDOW_STATES.has(String(state))) s.start();
    else s.stop();
  }, [state, sessionId, sim]);

  useEffect(
    () => () => {
      sampler.current?.stop();
    },
    [],
  );
  return null;
}
