/**
 * The recording time every screen draws (post-review fix FXR-M, finding W93-1; first built for the monitor
 * by closing-fix row CF2-A, defect RF-PH-1, decision D236).
 *
 * SIMULATED and HEARTBEAT: the simulator's store clock (`selectElapsedSeconds`), as before.
 *
 * LIVE: under host load the phone held one value for 5-21 s while the Core recorded, then jumped forward.
 * The store's clock is published by a 100 ms stall-tolerant timer of the Live source whose yields compounded
 * on the starved thread, and it follows the Live clock, which holds while late-handled heartbeats lower its
 * offset. So the value is ALSO worked out from the session's start instant and the runtime's Core clock
 * (`coreClockOf`: the Live clock corrected for late samples) by a PLAIN timer that re-reads it several times a
 * second (`createElapsedTicker`). The larger of the two is drawn; both only grow within a session, so the time
 * never steps back WHILE THE CORE STILL REPORTS RECORDING.
 *
 * The stop (ruling D19(b), audit AU1-2; refines RC-1/D255): once the Core reports the stop — the session left
 * RECORDING (STOPPING, FINALIZING, SEALED) or its stop instant `stoppedAt` is known — the ticker half is
 * dropped and every screen draws the Core's AUTHORITATIVE recorded duration (`stoppedAt - startedAt`, the
 * store's frozen clock). That is the duration the sealed evidence records (`session-machine.ts`
 * `historyEntry`: `endedAt = stoppedAt`), so the value is corrected ONCE, at the moment the stop is learned,
 * and never steps again through FINALIZING and SEALED, and it is never above the sealed duration. (The
 * row-22 hold kept the ticker's larger second after the stop; it only moved the step back to the seal,
 * 1129 -> 1122 in AU-1's probe, and showed a duration the evidence does not have.)
 *
 * CF2-A fixed this for the monitor only; the bottom Recording bar kept the store clock alone (W93-1). The
 * monitor, the Recording bar, Home's System Status timer and the Sessions hub timer now read this one module,
 * and they share ONE ticker per Core clock and session (`sharedTicker`), so in every commit they draw the same
 * second (the E2E-P-3 rule of decision D201: two timers on one screen never disagree).
 *
 * The ticker is an external store for `useSyncExternalStore`: React renders its change synchronously at the
 * end of the tick's task (a plain state update waited a further 0.4-0.75 s in React's queue on the phone).
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { selectElapsedSeconds, useSim, useSimInstance } from '@dems/shared/sim';
import { coreClockOf, coreInstantOnDeviceClock, type CoreClock } from './core-clock';
import { reportRuntimeIssue } from './log';

/** Re-read a little after the boundary, so the new second is already there when the timer wakes (ms). */
export const SECOND_TICK_MARGIN_MS = 20;
/** The shortest wait of the timer tick (ms): a clock read just before a boundary does not spin. */
export const SECOND_TICK_MIN_MS = 50;
/** The tick re-reads the Core clock this often at most (ms); it renders only on a new second. */
export const ELAPSED_TICK_MS = 250;

/** Whole seconds since `startedAtMs` at `nowMs` (both on one clock); 0 before start. Pure. */
export function elapsedSecondsAt(startedAtMs: number | null | undefined, nowMs: number): number {
  if (startedAtMs === null || startedAtMs === undefined || !Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

/**
 * How long until the recording's next whole second, plus `SECOND_TICK_MARGIN_MS`, between
 * `SECOND_TICK_MIN_MS` and 1 s (a clock still before the start waits for second 1 the same way). Pure.
 */
export function msToNextSecond(nowMs: number, startedAtMs: number): number {
  if (!Number.isFinite(nowMs) || !Number.isFinite(startedAtMs)) return 1000;
  const into = (((nowMs - startedAtMs) % 1000) + 1000) % 1000;
  return Math.min(1000, Math.max(SECOND_TICK_MIN_MS, 1000 - into + SECOND_TICK_MARGIN_MS));
}

export interface ElapsedTicker {
  subscribe(onChange: () => void): () => void;
  getSnapshot(): number;
  /**
   * Retire the ticker: no further clock read, no re-arm; the snapshot keeps the last second it drew.
   * `releaseStoppedTicker` calls it once the Core reports the stop of the ticker's session (D19(b)), so a
   * ticker can never count past the stop. Idempotent; a later `subscribe` never re-arms a frozen ticker.
   * A frozen ticker is never handed out again: `sharedTicker` replaces it (audit AU1-6).
   */
  freeze(): void;
  /** True once `freeze()` ran. */
  isFrozen(): boolean;
}

/**
 * Whole seconds since `startedAt` on the Core clock, re-read by a PLAIN timer every `ELAPSED_TICK_MS` (sooner
 * when the next second is nearer), so a tick that the busy JS thread runs late is caught up by the next one.
 * The value only grows; the timer runs only while someone subscribes.
 *
 * W93-12 (FXR-M): a tick that throws (a clock read, a listener) is logged and the ticker RE-ARMS; it used to
 * stop for the rest of the session, and the time silently fell back to the store clock, the hold-under-load
 * defect RF-PH-1.
 */
export function createElapsedTicker(clock: CoreClock, startedAt: number, sessionId: string | null): ElapsedTicker {
  let seconds = elapsedSecondsAt(startedAt, clock.now());
  let stopped = false;
  const listeners = new Set<() => void>();
  let handle: unknown = null;
  const tick = (): void => {
    handle = null;
    if (stopped) return;
    let wait = ELAPSED_TICK_MS;
    try {
      const now = clock.now();
      wait = Math.min(ELAPSED_TICK_MS, msToNextSecond(now, startedAt));
      const next = Math.max(seconds, elapsedSecondsAt(startedAt, now));
      if (next !== seconds) {
        seconds = next;
        for (const listener of [...listeners]) listener();
      }
    } catch (error) {
      // The store's clock still draws the time meanwhile; the failure is logged, never swallowed.
      reportRuntimeIssue('error', 'sessionLive.elapsedTick', error, { sessionId: sessionId ?? 'none' });
    } finally {
      if (!stopped && listeners.size > 0 && handle === null) {
        try {
          handle = clock.timers.setTimeout(tick, wait);
        } catch (error) {
          reportRuntimeIssue('error', 'sessionLive.elapsedTick.rearm', error, { sessionId: sessionId ?? 'none' });
        }
      }
    }
  };
  return {
    subscribe(onChange) {
      listeners.add(onChange);
      if (!stopped && handle === null) handle = clock.timers.setTimeout(tick, 0);
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0 && handle !== null) {
          clock.timers.clearTimeout(handle);
          handle = null;
        }
      };
    },
    getSnapshot: () => seconds,
    isFrozen: () => stopped,
    freeze() {
      if (stopped) return;
      stopped = true;
      if (handle !== null) {
        clock.timers.clearTimeout(handle);
        handle = null;
      }
    },
  };
}

/** The ticker of the current recording, per Core clock: every reader of one session shares it. */
const tickers = new WeakMap<CoreClock, { readonly key: string; readonly sessionId: string | null; readonly ticker: ElapsedTicker }>();

/**
 * The shared ticker of one recording (`sessionId|startedAt`) on one Core clock. Audit AU1-6: a cached ticker
 * that was frozen (its stop was reported) is REPLACED by a fresh one, never handed out frozen. The session
 * machine has one entry to RECORDING (`startRecordingTransition`, ARMED -> RECORDING, a new `startedAt`), so
 * a stopped recording does not re-enter RECORDING today; if it ever did, it would count again from its own
 * start on the Core clock instead of showing a frozen second.
 */
function sharedTicker(clock: CoreClock, startedAt: number, sessionId: string | null): ElapsedTicker {
  const key = `${sessionId ?? '-'}|${startedAt}`;
  const cached = tickers.get(clock);
  if (cached && cached.key === key && !cached.ticker.isFrozen()) return cached.ticker;
  const ticker = createElapsedTicker(clock, startedAt, sessionId);
  tickers.set(clock, { key, sessionId, ticker });
  return ticker;
}

/**
 * D19(b): the Core reported the stop of `sessionId`; retire its ticker (freeze, drop it from the cache) so
 * nothing draws or arms it again. A no-op when the clock's ticker belongs to another session (a newer one
 * replaced it, or this session never recorded on this clock). Runs in an effect, never during render.
 */
function releaseStoppedTicker(clock: CoreClock, sessionId: string | null): void {
  if (sessionId === null) return;
  const cached = tickers.get(clock);
  if (cached === undefined || cached.sessionId !== sessionId) return;
  cached.ticker.freeze();
  tickers.delete(clock);
}

const subscribeNothing = (): (() => void) => () => undefined;
const zeroSeconds = (): number => 0;

/**
 * The LIVE half alone: seconds of the RECORDING session on the Core clock, or 0 (no Core clock, i.e.
 * SIMULATED/HEARTBEAT; or the Core reported the stop). D19(b): the ticker applies only while the Core still
 * reports RECORDING and no stop instant is known; from the stop on it is 0, so a screen that draws the
 * larger of this and its store-derived time draws exactly the Core's recorded duration. A screen that has
 * its own store-derived time draws the larger of the two.
 */
export function useRecordingTickerSeconds(): number {
  const startedAt = useSim((s) =>
    s.session?.state === 'RECORDING' && s.session.stoppedAt === null ? (s.session.startedAt ?? null) : null,
  );
  const sessionId = useSim((s) => s.session?.id ?? null);
  const coreClock = coreClockOf(useSimInstance());
  const ticker = useMemo(
    () => (coreClock === null || startedAt === null ? null : sharedTicker(coreClock, startedAt, sessionId)),
    [coreClock, startedAt, sessionId],
  );
  useEffect(() => {
    if (coreClock !== null && startedAt === null) releaseStoppedTicker(coreClock, sessionId);
  }, [coreClock, startedAt, sessionId]);
  return useSyncExternalStore(ticker?.subscribe ?? subscribeNothing, ticker?.getSnapshot ?? zeroSeconds);
}

/** Whole seconds of the current recording: the store's clock, or the Core clock's ticker when it is ahead (LIVE). */
export function useRecordingElapsedSeconds(): number {
  const fromStore = useSim(selectElapsedSeconds);
  const ticked = useRecordingTickerSeconds();
  return Math.max(fromStore, ticked);
}

/**
 * Decision D247 item 5: where the running recording STARTED on this device's own clock (epoch ms of
 * `Date.now()`), or `null` (no recording that still runs; or SIMULATED / HEARTBEAT, whose recording time is
 * the simulator's clock - it may run at another speed and has no instant on the device clock).
 *
 * The monitor's timer hands it to a UI-thread frame callback (`timer-readout.tsx`), which draws
 * `floor((Date.now() - origin) / 1000)` whenever React's own second is late: neither a late message nor a
 * late render can then hold the time. It is re-read with every second React draws (`drawnSeconds`), so a
 * better estimate of the Core's offset reaches the UI thread within a second; like the ticker it ends with
 * the Core's report of the stop (D19(b)).
 */
export function useRecordingLocalOrigin(drawnSeconds: number): number | null {
  const startedAt = useSim((s) =>
    s.session?.state === 'RECORDING' && s.session.stoppedAt === null ? (s.session.startedAt ?? null) : null,
  );
  const coreClock = coreClockOf(useSimInstance());
  return useMemo(() => {
    if (coreClock === null || startedAt === null) return null;
    const origin = coreInstantOnDeviceClock(coreClock, startedAt);
    return Number.isFinite(origin) ? origin : null;
    // `drawnSeconds` is the refresh: one reading of the Core clock per drawn second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreClock, startedAt, drawnSeconds]);
}
