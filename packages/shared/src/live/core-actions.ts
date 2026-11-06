/**
 * Typed access to the Core's actions in both data modes (HB-15; backend task
 * 04_client_integration_spec §2.5 CL-12; research/03_analysis.md ADQ-3 rule 1).
 *
 * `CoreActions` is `SimActions` with the same names and parameters and with every return type
 * `R` widened to `R | Promise<R>`: the simulator answers at once, a Live source answers after
 * the Core server did. Nothing is wrapped: `coreActionsOf(sim)` returns `sim.actions` itself,
 * so Simulated mode keeps its synchronous timing (TS-2) and a call site reads one type in both
 * modes. A call site consumes the result through `settle` (`./settle`).
 *
 * Framework-free: type-only imports, no runtime dependency.
 */
import type { Sim } from '../sim/engine';
import type { SimActions } from '../sim/types';

/** What a Core action returns: the simulator's value, or a promise of it from a Live source. */
export type CoreResult<R> = R | Promise<R>;

/** Every member of `SimActions`, with its result possibly asynchronous. */
export type CoreActions = {
  [Name in keyof SimActions]: SimActions[Name] extends (...args: infer Args) => infer Result
    ? (...args: Args) => CoreResult<Result>
    : SimActions[Name];
};

/**
 * The actions of the source held in `SimContext` (a simulator, or a Live source cast into it),
 * typed for both modes. Returns `sim.actions` itself: no wrapper and no copy.
 */
export function coreActionsOf(sim: Sim): CoreActions {
  return sim.actions;
}
