import { createContext, useContext } from 'react'

/** M-C-17 marker chip and M-C-18 snapshot thumbnail flights (03_motion_spec §5.4; R5 "marker-chip", "snapshot-thumb"). */
export type FlightKind = 'marker' | 'snapshot'

export interface FlightRequest {
  kind: FlightKind
  /** Where the flight starts (the action button or the feed). */
  from: DOMRect
  /** Where it lands (the timeline's newest row, or the Open Evidence Queue button). */
  to: DOMRect
  /** Marker label (marker flights). */
  label?: string
  /** JPEG data URL (snapshot flights). */
  image?: string | null
  /** Called when the element lands (for example to pop the queue badge). */
  onLand?: () => void
}

export type Launch = (request: FlightRequest) => void

export const FlightContext = createContext<Launch>(() => undefined)

/** Launches a flight; a no-op outside `FlightLayer` and under reduced motion (§8: no flights). */
export function useFlight(): Launch {
  return useContext(FlightContext)
}

