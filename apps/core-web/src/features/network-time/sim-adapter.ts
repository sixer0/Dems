/**
 * Network & Time reads over the simulator (step 50; step 54 moved W50-1..4 into
 * `packages/shared/src/sim`, so this file re-exports the simulator's views under the page's names).
 * Every view is a pure read over `SimState` that returns primitives or store-owned objects, so
 * `useSim` (shallow) stays stable between 1 Hz steps (R1).
 *
 * - W50-1 domain states: `selectDomainStates` / `domainState` (camera lenses, tablet link,
 *   software update, the latest export within 20 s).
 * - W50-2 A/V sync: `selectAvSync` (derived: a disciplined, locked source and every track
 *   delivering → HEALTHY).
 * - W50-3 event categories: `eventCategory` (SimEventCategory) and the page's network/time buckets
 *   `networkTimeSource` / `selectNetworkTimeEvents`.
 * - W50-4 histories: `time.history`, `network.bandwidth.history` and `health.series` are
 *   back-filled since boot when the store is created, so the charts are full at load.
 */
export {
  domainState,
  EXPORT_TRANSFER_WINDOW_MS,
  lastExportAt,
  networkTimeSource as eventSource,
  selectAvSync,
  selectDomainStates,
  selectNetworkTimeEvents,
  type AvSyncView,
  type NetworkDomainState as DomainState,
  type NetworkTimeSource as EventSource,
} from '@dems/shared/sim'
export type { AvSyncState } from '@dems/shared/sim'
