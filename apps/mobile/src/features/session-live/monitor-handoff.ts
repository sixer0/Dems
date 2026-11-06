/**
 * The Ready-to-monitor hand-off without an empty frame (closing-fix row CF2-A, defect RF-PH-3 = RF-T-4).
 *
 * On the phones and the tablet, 7 of 18 starts showed ONE empty frame (7-109 ms: only the background,
 * the status bar and the gesture pill) between "Starting..." and the monitor; never at monitor ->
 * Finalizing. The difference: the Finalizing hand-over draws its screen WITHOUT its enter motion
 * (`session-finalizing/handover.ts`, E2E-P-4), while the monitor entered with `enterRise` on every
 * region (header, feed, meters, tiles, End Session), each starting at opacity 0. The stack replace of
 * the start hand-off drops "Starting..." in the commit that mounts the monitor, so the monitor's first
 * frame was all opacity 0: the empty frame.
 *
 * The start hand-off (`session-new-screen.tsx`, `handOffToMonitor`) marks the session here right before
 * the replace; the monitor reads the mark at mount and draws its regions in place, without the rise.
 * A mark only ever matches the one session that was handed off: a Home banner, a deep link or a
 * relaunch into `/session/live` enters as before. One slot, no timer: a session starts once.
 *
 * The slot itself is the shared rule `createHandoffMark` (`@/lib/handoff-mark`, review finding W93-18).
 */
import { createHandoffMark } from '@/lib/handoff-mark';

const handoff = createHandoffMark();

export function markMonitorHandoff(sessionId: string | null | undefined): void {
  handoff.mark(sessionId);
}

export function isMonitorHandoff(sessionId: string | null | undefined): boolean {
  return handoff.is(sessionId);
}

export function resetMonitorHandoffForTests(): void {
  handoff.resetForTests();
}
