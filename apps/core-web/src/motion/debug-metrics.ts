/**
 * Counters behind the `?debug=1` overlay (03_motion_spec §9.5; AC-61).
 *
 * `reportMeterFrame(channel)` is called by the dBFS meter (step 39) once per transient audio frame
 * it applies. It is a plain counter increment with no React state, so it cannot add renders
 * (§9.3, MS-08), and it returns at once while the overlay is off.
 */

let collecting = false
const meterFrames = new Map<string, number>()

/** Turned on by `MotionPolicyProvider` while `?debug=1` is active. */
export function setDebugMetricsEnabled(enabled: boolean): void {
  collecting = enabled
  if (!enabled) meterFrames.clear()
}

export function isDebugMetricsEnabled(): boolean {
  return collecting
}

/** One meter frame applied on `channel` (for example `AUDIO-01`). */
export function reportMeterFrame(channel: string): void {
  if (!collecting) return
  meterFrames.set(channel, (meterFrames.get(channel) ?? 0) + 1)
}

/** Frame counts per channel since the previous drain; the counters restart at zero. */
export function drainMeterFrames(): Record<string, number> {
  const counts = Object.fromEntries(meterFrames)
  for (const channel of meterFrames.keys()) meterFrames.set(channel, 0)
  return counts
}
