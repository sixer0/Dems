/**
 * A wait on the store's clock (backend task W74; gateway_check/09_cp_mobile_runtime §4 answer 3
 * rule 7: timers on the store's clock, never `setTimeout`; 04_client_integration_spec §8.1 LB-2).
 *
 * `onDue` runs once when the store's clock is `waitMs` past `startedAt`, out of the store's notify
 * loop (a microtask: the engine's tick finishes before the next write), and never after the
 * component left or `startedAt` changed. Nothing runs while `startedAt` is null. In Live mode the
 * store is the Live source, whose `clock` slice follows the Core's clock, so a minimum display time
 * is measured on the Core's clock. The idiom is the pairing flow's commit (`use-pairing-flow.ts`).
 *
 * The caller passes a stable `onDue` (`useCallback`) and clears `startedAt` from it, so one wait
 * fires once.
 */
import { useEffect } from 'react';
import { useSimInstance, type EpochMs } from '@dems/shared/sim';

export function useClockDue(startedAt: EpochMs | null, waitMs: number, onDue: () => void): void {
  const sim = useSimInstance();
  useEffect(() => {
    if (startedAt === null) return undefined;
    let disposed = false;
    let fired = false;
    const unsubscribe = sim.store.subscribe(
      (s) => s.clock.now - startedAt >= waitMs,
      (due) => {
        if (!due || fired) return;
        fired = true;
        queueMicrotask(() => {
          if (!disposed) onDue();
        });
      },
      { fireImmediately: true },
    );
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [sim, startedAt, waitMs, onDue]);
}
