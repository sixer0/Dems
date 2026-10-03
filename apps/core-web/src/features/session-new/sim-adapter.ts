/**
 * Start New Session reads over the simulator (step 46; simplified by step 54, which closed W46-1
 * and W46-2 in `packages/shared/src/sim`).
 *
 * - The simulated scanner is the simulator's `actions.scanCaseNumber()`: it returns the next case
 *   number `LP/{YYYY}/{MMDD}-NNNN` on the simulator clock and reserves it, so a second scan offers a
 *   fresh number (M78-1 on mobile reads the same `selectNextCaseNumber`).
 * - Precheck items carry `reasonCode` (and `params`); `model.reasonKeyFor` looks the i18n key up
 *   from it and keeps the id/status/value mapping only for items from before step 54.
 * - The start, acknowledge and cancel actions check SESSION_START in the simulator since step 54
 *   (review 40 M5); the page still gates them (R4) as defence in depth.
 */
import { selectNextCaseNumber, type Sim } from '@dems/shared/sim'

/**
 * The case number the simulated scanner reads, reserved. A refusal (no SESSION_START: the route
 * guard normally prevents it) falls back to showing the next number without reserving it.
 */
export function scanCaseNumber(sim: Pick<Sim, 'actions' | 'store'>): string {
  try {
    return sim.actions.scanCaseNumber()
  } catch {
    return selectNextCaseNumber(sim.store.getState())
  }
}
