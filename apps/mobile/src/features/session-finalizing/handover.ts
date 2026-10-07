/**
 * The monitor-to-Finalizing hand-over (E-fix row FX-M2; defects E2E-P-4 and E2E-T-4, decision D201).
 *
 * When a recording stops (here or on another console), `/session/live` used to render only a
 * `<Redirect>` to `/session/finalizing`: the monitor was gone in that commit and nothing was drawn
 * until the Finalizing route had mounted and its cards had risen in, which the phone showed as about
 * 1.2 s of empty screen (the tablet about 2 s, under a loaded host). Now the live route draws the
 * Finalizing screen in place in the SAME commit that drops the monitor, without its enter motion,
 * and the route follows.
 *
 * The in-place screen marks the session here; the Finalizing route's own screen, which replaces it a
 * moment later (by that redirect, or by the runtime's route sync), reads the mark and skips its enter
 * motion as well, so the swap of two identical screens shows no dip either. A mark only ever matches
 * the one session that was handed over; a deep link or a relaunch into `/session/finalizing` enters
 * as before. One slot, no timer: a session goes through Finalizing once.
 */
let handedOver: string | null = null;

export function markFinalizingHandover(sessionId: string | null): void {
  if (sessionId !== null) handedOver = sessionId;
}

export function isFinalizingHandover(sessionId: string | null): boolean {
  return sessionId !== null && handedOver === sessionId;
}

export function resetFinalizingHandoverForTests(): void {
  handedOver = null;
}
