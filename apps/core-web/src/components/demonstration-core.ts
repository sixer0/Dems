import { isOwnCaptureCoreState, useSim, useSimReady } from '@dems/shared/sim'

/**
 * THE ONE RULE FOR "THIS CORE IS THE DEMONSTRATION" (fix wave J, driver J-W; finding JW-07; truth rule
 * 3f): the state is hydrated and the Core states neither `security.platformNotReported` nor a host
 * clock (`isOwnCaptureCoreState` of `@dems/shared/sim` is false) - the simulator's appliance model is what every page shows:
 * its room pictures, its recording, its TPM, its LAN address, its integrity checks.
 *
 * The other half of the rule is `SyntheticValuesChip` (wave L): on a Core in its OWN capture the
 * blocks that still show model values carry "Synthetic demo values". A block is therefore marked on
 * BOTH lanes or it shows a fact of the Core; nothing in between.
 */
export function useDemonstrationCore(): boolean {
  const ready = useSimReady()
  // `contract_wave_j.md` J-S 7: the ONE shared reader. A Core in its own capture states the host clock and
  // `platformNotReported` at every start; a SIMULATED Core and the in-app simulator state neither.
  const ownCore = useSim(isOwnCaptureCoreState)
  return ready && !ownCore
}

