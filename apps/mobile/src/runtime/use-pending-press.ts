/**
 * "Busy at once, spinner late" for one control whose press sends a Core command (backend task
 * 04_client_integration_spec §8.1 LB-1; AC-C-57, AC-C-58). Built by row W67 for Start Session and
 * moved here by row M1 (decision D157 DN-7), so every mobile page row takes the ONE hook through
 * `@/runtime` instead of copying it. `features/session-new/use-pending-press.ts` re-exports it.
 *
 * | Phase | From | What the control shows | A press |
 * |-------|------|------------------------|---------|
 * | idle | — | its own look | starts the command |
 * | busy | the press | no visual change; `accessibilityState.busy` is true | is ignored: one command per control |
 * | pending | `LIVE_PENDING_REVEAL_MS` after the press, on the store's clock | the kit's `Spinner` in place of the control's icon, so nothing moves | is ignored |
 *
 * The caller passes `run` a function that starts the command and calls `release` once the command
 * settled (from the continuation that `settle` runs). In Simulated mode the command settles before
 * `run` returns (`settle`, CL-25): no state is set, nothing renders again, and the control looks and
 * behaves exactly as before.
 *
 * Time is the store's clock (mobile rule 7, never `setTimeout`): in Live mode the store is the Live
 * source, whose `clock` slice follows the Core's clock in 100 ms steps. The selector returns a
 * boolean, so the clock re-renders the control at most once per press (when the spinner is due).
 * The in-flight flag is a ref written only in the event handler, never read while rendering.
 *
 * ```tsx
 * const press = usePendingPress();
 * const onPress = () =>
 *   press.run((release) => settle(() => actions.someCommand(), { done: release, fail: … }));
 * <Button onPress={onPress} {...(press.busy ? { accessibilityState: { busy: true } } : {})}>
 *   {press.pending ? <Spinner size="sm" /> : <Icon />}
 * </Button>
 * ```
 */
import { useCallback, useRef, useState } from 'react';
import { LIVE_PENDING_REVEAL_MS } from '@dems/shared/live';
import { useSim, useSimInstance } from '@dems/shared/sim';

export interface PendingPress {
  /** From the press until the command settled: further presses are ignored. */
  readonly busy: boolean;
  /** Busy for `LIVE_PENDING_REVEAL_MS` or longer: the control shows the kit's pending state. */
  readonly pending: boolean;
  /**
   * Starts one command unless this control has one in flight. `start` gets `release`, which must run
   * once when the command settled. Returns whether the command was started.
   */
  run(start: (release: () => void) => void): boolean;
}

export function usePendingPress(): PendingPress {
  const sim = useSimInstance();
  const inFlight = useRef(false);
  /** The store's clock at the press of a command still in flight; null while idle. */
  const [pressedAt, setPressedAt] = useState<number | null>(null);
  const pending = useSim((s) => pressedAt !== null && s.clock.now - pressedAt >= LIVE_PENDING_REVEAL_MS);

  const run = useCallback(
    (start: (release: () => void) => void): boolean => {
      if (inFlight.current) return false;
      inFlight.current = true;
      let released = false;
      let shown = false;
      const release = (): void => {
        if (released) return;
        released = true;
        inFlight.current = false;
        if (shown) setPressedAt(null);
      };
      try {
        start(release);
      } catch (error) {
        release();
        throw error;
      }
      // Settled already (Simulated mode, or a command the Live source refused before sending it).
      if (!released) {
        shown = true;
        setPressedAt(sim.store.getState().clock.now);
      }
      return true;
    },
    [sim],
  );

  return { busy: pressedAt !== null, pending, run };
}
