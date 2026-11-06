/**
 * Pure layout of the audio-source band (task 3 M5, blueprint row 72; register WB-10; ux §3, §6;
 * `masterplan/03_api_contract.md` §2.4 operation 82). The intervals are in **media pts** (ms from
 * the start of the recording), so the band is a manifest overlay and never a clock.
 */
/** The members of one interval of operation 82 that the band draws. */
export interface AudioSourceBandInterval {
  readonly seq: number
  /** The mic input as the Core sent it (`MIC-NN`, any number; integration pass D2). */
  readonly inputId: string
  /** Media-pts start (ms). */
  readonly fromMs: number
  /** Media-pts end (ms); `null` while the interval is open. */
  readonly toMs: number | null
}

export interface AudioSourceBandSegment {
  readonly seq: number
  readonly inputId: string
  readonly fromMs: number
  /** The end drawn: the interval's own end, or `endMs` for the open interval. */
  readonly toMs: number
  readonly open: boolean
  /** Share of the band's width, 0..1. The shares of a non-empty band add up to 1. */
  readonly fraction: number
}

/**
 * The segments of the band, oldest first.
 *
 * - `endMs` is the media time the band ends at (the elapsed recording time, or the media duration
 *   of a sealed file). An open interval ends there; an `endMs` before the newest start is raised to
 *   that start, so a late clock never draws a negative width.
 * - An interval whose end is before its start is drawn with no width (its row stays in the list).
 * - While nothing has elapsed (`endMs` equal to the first start) the newest interval takes the whole
 *   band: the band names the active input from the first moment.
 */
export function audioSourceBandSegments(intervals: readonly AudioSourceBandInterval[], endMs: number): AudioSourceBandSegment[] {
  if (intervals.length === 0) return []
  const ordered = [...intervals].sort((a, b) => a.fromMs - b.fromMs || a.seq - b.seq)
  const start = ordered[0]!.fromMs
  const newestStart = ordered[ordered.length - 1]!.fromMs
  const end = Math.max(Number.isFinite(endMs) ? endMs : newestStart, newestStart, ...ordered.map((entry) => entry.toMs ?? 0))
  const span = end - start
  return ordered.map((entry, index) => {
    const open = entry.toMs === null
    const to = Math.max(entry.fromMs, entry.toMs ?? end)
    const fraction = span > 0 ? (to - entry.fromMs) / span : index === ordered.length - 1 ? 1 : 0
    return { seq: entry.seq, inputId: entry.inputId, fromMs: entry.fromMs, toMs: to, open, fraction }
  })
}

/** Media ms as `m:ss` (or `h:mm:ss` from one hour), for the band's caption and its accessible text. */
export function formatMediaMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const two = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`
}

/**
 * The position of each input among the inputs of a band, sorted by id (integration pass D2): the
 * band's colour index. `MIC-01` / `MIC-02` are 0 / 1 as before; a third input (`MIC-03`) is 2.
 */
export function audioSourceBandPositions(intervals: readonly Pick<AudioSourceBandInterval, 'inputId'>[]): ReadonlyMap<string, number> {
  const ordered = [...new Set(intervals.map((interval) => interval.inputId))].sort()
  return new Map(ordered.map((inputId, index) => [inputId, index]))
}
