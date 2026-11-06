/**
 * One shared frame loop for every procedural camera canvas (03_motion_spec §9.3: "All canvases
 * share one rAF scheduler"; M-C-12 paints at 25 fps).
 *
 * Each painter declares its own rate (25 fps while animating, 1 fps for a static frame whose
 * burnt-in clock still ticks, 12.5 fps for NO SIGNAL noise). The loop runs only while at least
 * one painter is registered, so off-screen or hidden feeds (which unregister) cost nothing.
 * No React state is touched here.
 */

export type FeedPaint = (timeMs: number) => void

interface Entry {
  paint: FeedPaint
  intervalMs: number
  last: number
}

const entries = new Set<Entry>()
let handle = 0

function frame(timeMs: number) {
  handle = 0
  for (const entry of entries) {
    // A little slack so a 60 Hz display does not skip a 25 fps slot through rounding.
    if (timeMs - entry.last >= entry.intervalMs - 4) {
      entry.last = timeMs
      entry.paint(timeMs)
    }
  }
  if (entries.size > 0) handle = requestAnimationFrame(frame)
}

/**
 * Registers `paint` at `fps` (default 25) and paints once at the next frame. Returns the release
 * function. Safe to call where `requestAnimationFrame` is missing (the painter is then inert).
 */
export function scheduleFeedPainter(paint: FeedPaint, fps = 25): () => void {
  if (typeof requestAnimationFrame !== 'function') return () => undefined
  const entry: Entry = { paint, intervalMs: 1000 / Math.max(0.1, fps), last: Number.NEGATIVE_INFINITY }
  entries.add(entry)
  if (handle === 0) handle = requestAnimationFrame(frame)
  return () => {
    entries.delete(entry)
    if (entries.size === 0 && handle !== 0 && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(handle)
      handle = 0
    }
  }
}

/** Painters currently registered (tests and the debug overlay). */
export function activeFeedPainters(): number {
  return entries.size
}
