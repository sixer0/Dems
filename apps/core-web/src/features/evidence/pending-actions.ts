/**
 * One-shot hand-offs between the list and the detail page (no URL change: the detail route's search
 * schema belongs to step 38 and carries only `tab`).
 *
 * - `requestAutoVerify(id)`: the list's row action "Verify" opens the Integrity tab and starts the
 *   verification once on arrival.
 * - `rememberHeaderOrigin(id, rect)`: the clicked row's ID block, so the detail header can grow out
 *   of it (M-PG-EVID `evidence-<id>-header`; the H-M1 stored-rect fallback, because the list route
 *   has unmounted before the detail mounts).
 */
const autoVerify = new Set<string>()

export function requestAutoVerify(evidenceId: string): void {
  autoVerify.add(evidenceId)
}

/** True once for a requested ID, then false. */
export function consumeAutoVerify(evidenceId: string): boolean {
  return autoVerify.delete(evidenceId)
}

export interface HeaderOrigin {
  evidenceId: string
  rect: { left: number; top: number; width: number; height: number }
  at: number
}

let headerOrigin: HeaderOrigin | null = null
/** An origin older than this is ignored (the flight belongs to the click that navigated). */
export const HEADER_ORIGIN_MAX_AGE_MS = 2_000

export function rememberHeaderOrigin(evidenceId: string, element: Element | null): void {
  if (!element) return
  const box = element.getBoundingClientRect()
  headerOrigin = {
    evidenceId,
    rect: { left: box.left, top: box.top, width: box.width, height: box.height },
    at: performance.now(),
  }
}

/** The stored origin for `evidenceId` if it is fresh; clears it either way. */
export function takeHeaderOrigin(evidenceId: string): HeaderOrigin | null {
  const origin = headerOrigin
  headerOrigin = null
  if (!origin || origin.evidenceId !== evidenceId) return null
  return performance.now() - origin.at <= HEADER_ORIGIN_MAX_AGE_MS ? origin : null
}
