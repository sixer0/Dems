/**
 * The SEALED stamp plays once per session per app process (04_mobile_specs §7.3 "Finalizing" hero
 * moment, §7.6 one haptic per event). Without this, re-opening an unacknowledged summary (a relaunch
 * resync, Back from Evidence before acknowledging) would replay the stamp and its Success haptic.
 * A relaunch starts a new process, so a still-unacknowledged summary stamps again once there, which
 * is the intended "first sight" moment of that run.
 */
const stamped = new Set<string>();

export function hasStamped(sessionId: string): boolean {
  return stamped.has(sessionId);
}

export function markStamped(sessionId: string): void {
  stamped.add(sessionId);
}

/** Test-only reset (module state outlives a test). */
export function resetStampedForTests(): void {
  stamped.clear();
}
