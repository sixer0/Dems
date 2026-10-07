/**
 * The sealed-to-Summary hand-off without an empty frame (closing-fix row CF2-A, defect RF-PH-3 = RF-T-4).
 *
 * 9 of 18 phone runs showed ONE empty frame (7-109 ms) between the "Evidence sealed" card and the Session
 * Summary; never at monitor -> Finalizing, whose incoming screen skips its enter motion
 * (`session-finalizing/handover.ts`). The Summary entered with `enterRise` on every card (from opacity 0).
 *
 * The Finalizing screen marks the session here as soon as it shows the sealed phase, before the route sync
 * (or its own 1.2 s hand-off) replaces it; the Summary reads the mark at mount and draws its cards in
 * place, without the rise. The SEALED stamp (M-C-09) still plays: it is the Summary's own moment, not an
 * entrance. A deep link, a relaunch or the Sessions hub opens a Summary with its entrance as before.
 */
let handedOff: string | null = null;

export function markSummaryHandoff(sessionId: string | null | undefined): void {
  if (sessionId) handedOff = sessionId;
}

export function isSummaryHandoff(sessionId: string | null | undefined): boolean {
  return Boolean(sessionId) && handedOff === sessionId;
}

export function resetSummaryHandoffForTests(): void {
  handedOff = null;
}
