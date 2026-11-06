/**
 * Measurement hooks for the `?debug=1` overlay (04_mobile_specs §7.8; 03_motion_spec §9.5).
 *
 * - `fpsFromWindow`: frames over a window → frames per second (a worklet; the overlay calls it on
 *   the UI thread inside `useFrameCallback` and on the JS thread for `requestAnimationFrame`).
 * - Meter frame counter: the runtime's transient audio path (step 73, `useAudioSharedValues`)
 *   calls `reportMeterFrame(channel)` once per 20 Hz frame. Counting is off (one boolean check)
 *   unless the overlay is mounted, so it costs nothing in normal use.
 */

/** Frames per second over a window, rounded; 0 for an empty or invalid window. */
export function fpsFromWindow(frames: number, elapsedMs: number): number {
  'worklet';
  if (!(elapsedMs > 0) || !(frames >= 0)) return 0;
  return Math.round((frames * 1000) / elapsedMs);
}

let meterCounting = false;
const meterCounts = new Map<string, number>();

/** Called by the audio path once per meter frame (JS thread). No-op unless the overlay is on. */
export function reportMeterFrame(channel: string): void {
  if (!meterCounting) return;
  meterCounts.set(channel, (meterCounts.get(channel) ?? 0) + 1);
}

export function setMeterFrameCounting(enabled: boolean): void {
  meterCounting = enabled;
  meterCounts.clear();
}

export function isMeterFrameCounting(): boolean {
  return meterCounting;
}

/** Per-channel frames per second since the last drain; resets the counters. */
export function drainMeterFrames(elapsedMs: number): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const [channel, frames] of meterCounts) {
    rates[channel] = fpsFromWindow(frames, elapsedMs);
  }
  meterCounts.clear();
  return rates;
}
