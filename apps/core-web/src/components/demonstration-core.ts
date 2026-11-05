import { isOwnCaptureCoreState, useSim, useSimReady } from '@dems/shared/sim'

/**
 * THE ONE RULE FOR "THIS CORE IS THE DEMONSTRATION" (fix wave J, driver J-W; finding JW-07; truth rule
 * 3f): the state is hydrated and the Core states neither `security.platformNotReported` nor a host
 * clock (`isOwnCaptureCoreState` of `@dems/shared/sim` is false) - the simulator's appliance model is what every page shows:
 * its room pictures, its recording, its TPM, its LAN address, its integrity checks.
 *
 * The other half of the rule is `NoProducerNotice` / `NoProducerGate` (audit fix row 104, DF-21; it replaced
 * wave L's "Synthetic demo values" chip): on a Core in its OWN capture a block without a producer reads
 * "Not reported". A block therefore shows the demonstration (marked), a fact of the Core, or "Not reported";
 * nothing in between.
 */
export function useDemonstrationCore(): boolean {
  const ready = useSimReady()
  // `contract_wave_j.md` J-S 7: the ONE shared reader. A Core in its own capture states the host clock and
  // `platformNotReported` at every start; a SIMULATED Core and the in-app simulator state neither.
  const ownCore = useSim(isOwnCaptureCoreState)
  return ready && !ownCore
}

