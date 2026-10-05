/**
 * Start New Session reads over the data source (step 46; simplified by step 54, which closed W46-1
 * and W46-2 in `packages/shared/src/sim`; plan row W64 for Live mode, site A4).
 *
 * - The scanner is the `scanCaseNumber` action (`useCoreActions()`): it returns the next case
 *   number `LP/{YYYY}/{MMDD}-NNNN` and reserves it, so a second scan offers a fresh number (M78-1
 *   on mobile reads the same `selectNextCaseNumber`). In Live mode the Core server reserves it
 *   (operation 32) and the action answers with a promise of the number.
 * - Precheck items carry `reasonCode` (and `params`); `model.reasonKeyFor` looks the i18n key up
 *   from it and keeps the id/status/value mapping only for items from before step 54.
 * - The start, acknowledge and cancel actions check SESSION_START in the simulator since step 54
 *   (review 40 M5) and on the Core server; the page still gates them (R4) as defence in depth.
 */
import type { CoreActions, CoreResult } from '@dems/shared/live'
import { selectNextCaseNumber, type SimState } from '@dems/shared/sim'

/**
 * The case number the scanner reads, reserved (site A4 of 04_client_integration_spec §8.2).
 *
 * | The action | Returns |
 * |------------|---------|
 * | answers a number (Simulated mode) | that number, at once |
 * | throws (Simulated mode: no SESSION_START, which the route guard normally prevents) | the next number of the state, not reserved, at once (as before) |
 * | answers a promise (Live mode) that fulfils | a promise of the reserved number |
 * | answers a promise that rejects (a refusal, an outage) | `onRefused(error)` first, so the page can hand the error to the presenter; then a promise of the next number of the replica, not reserved |
 *
 * The result never rejects: the field always gets a number.
 */
export function scanCaseNumber(
  actions: Pick<CoreActions, 'scanCaseNumber'>,
  readState: () => SimState,
  onRefused: (error: unknown) => void,
): CoreResult<string> {
  const fallback = (): string => selectNextCaseNumber(readState())
  let answer: CoreResult<string>
  try {
    answer = actions.scanCaseNumber()
  } catch {
    return fallback()
  }
  if (typeof answer === 'string') return answer
  return Promise.resolve(answer).then(
    (caseNumber) => caseNumber,
    (error: unknown) => {
      onRefused(error)
      return fallback()
    },
  )
}
