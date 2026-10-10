import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toneHex } from '@dems/shared/tokens'
import { cn } from '@/lib/utils'
import { audioSourceBandPositions, audioSourceBandSegments, formatMediaMs, type AudioSourceBandInterval } from './audio-source-band.math'

export type { AudioSourceBandInterval, AudioSourceBandSegment } from './audio-source-band.math'

/**
 * One colour per input: the band says which mic was inside `AUDIO-01`, not how healthy it was.
 * Integration pass D2 (D133 (1)): the inputs are the ids the Core sent (`MIC-NN`, any number), so the
 * colour follows the position of an input among the inputs of the band (sorted by id) — the built-in
 * pair keeps its two colours, a third input takes the third.
 */
const INPUT_COLOURS: readonly string[] = [toneHex.accent, toneHex.info, toneHex.warning, toneHex.success]

/** One segment as the band draws it: where it lies on the track (percent of its width) and which colour position it has. */
export interface AudioSourceBandMark {
  readonly seq: number
  readonly inputId: string
  readonly fromMs: number
  readonly toMs: number
  /** The interval is still open (the live band only). */
  readonly open?: boolean
  readonly startPct: number
  readonly widthPct: number
  /** Colour position of the input among the inputs of the band. */
  readonly tone: number
}

export interface AudioSourceBandProps {
  /** The live band: the intervals of operation 82 (any order), placed by `audioSourceBandSegments` up to `endMs`. */
  intervals?: readonly AudioSourceBandInterval[]
  /** Media time the live band ends at (ms): the elapsed recording time. */
  endMs?: number
  /**
   * Segments the caller placed itself, in the place of `intervals` (sealed playback: the item's
   * intervals over the recorded duration, `features/evidence/sealed-playback.ts`).
   */
  segments?: readonly AudioSourceBandMark[]
  /** The name of an input ("MIC 1"). */
  inputLabel: (inputId: string) => string
  /** Accessible name of the band. Default `session.audioSource.band.label`. */
  ariaLabel?: string
  className?: string
  /** Replaces the default look of the track (the caller's own sheet). */
  trackClassName?: string
  /** The caller's own class of a segment; without it the segment is filled with the colour of its tone. */
  segmentClassName?: (mark: AudioSourceBandMark) => string
  /** The text of a segment (its `<title>` and its list entry). Default: the live band's sentences. */
  describe?: (mark: AudioSourceBandMark) => string
  /** A playhead mark at `positionMs` of `totalMs` (playback only; the only part that moves). */
  playhead?: { readonly positionMs: number; readonly totalMs: number; readonly className?: string }
  /** The segments again as a list for assistive technology. Default true; false when the caller draws a legend itself. */
  list?: boolean
  /** Prefix of the test ids (`<id>`, `<id>-segment-<seq>`, `<id>-head`). Default `audio-source-band`. */
  testId?: string
  /** Drawn above the track (a caption). */
  header?: ReactNode
  /** Drawn below the track (a legend, the line of the playhead). */
  children?: ReactNode
}

const pct = (value: number): number => Math.round(value * 1000) / 1000

/**
 * AudioSourceBand (register WB-10; ux §3 flow 2 and §6 flow 5, §6.6, §6.7; operation 82; R-3): which
 * microphone input was the source of the one session audio track, and when. One segment per
 * interval, its width the interval's share of the media time. A static overlay: nothing here
 * animates and nothing reads a clock; with `playhead` only that mark moves, and its position is the
 * caller's (the media clock of a player). An SVG, so the segments are exact at any width.
 *
 * ONE component for both places (integration pass D5, closing row 92's D-92-8): the Monitor's live
 * band (`intervals` + `endMs`, the open interval runs to `endMs`) and the evidence page's playback
 * band (`segments` over the recorded duration + `playhead`). Colour is never the only sign: every
 * segment has a text, and the same intervals are a list for assistive technology (or the caller's
 * legend).
 */
export function AudioSourceBand({ intervals, endMs, segments, inputLabel, ariaLabel, className, trackClassName, segmentClassName, describe, playhead, list = true, testId = 'audio-source-band', header, children }: AudioSourceBandProps) {
  const { t } = useTranslation()
  const marks = useMemo((): readonly AudioSourceBandMark[] => {
    if (segments !== undefined) return segments
    if (intervals === undefined) return []
    const positions = audioSourceBandPositions(intervals)
    let start = 0
    return audioSourceBandSegments(intervals, endMs ?? Number.NaN).map((segment) => {
      const mark: AudioSourceBandMark = { seq: segment.seq, inputId: segment.inputId, fromMs: segment.fromMs, toMs: segment.toMs, open: segment.open, startPct: pct(start * 100), widthPct: pct(segment.fraction * 100), tone: positions.get(segment.inputId) ?? 0 }
      start += segment.fraction
      return mark
    })
  }, [segments, intervals, endMs])
  if (marks.length === 0) return null
  const label = ariaLabel ?? t('session.audioSource.band.label')
  const textOf =
    describe ??
    ((mark: AudioSourceBandMark) =>
      mark.open
        ? t('session.audioSource.band.open', { mic: inputLabel(mark.inputId), from: formatMediaMs(mark.fromMs) })
        : t('session.audioSource.band.closed', { mic: inputLabel(mark.inputId), from: formatMediaMs(mark.fromMs), to: formatMediaMs(mark.toMs) }))
  const headPct = playhead === undefined ? null : playhead.totalMs > 0 ? Math.min(100, Math.max(0, (playhead.positionMs / playhead.totalMs) * 100)) : 0
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)} data-testid={testId} data-segments={marks.length}>
      {header}
      <svg className={trackClassName ?? 'block h-1.5 w-full overflow-hidden rounded-full bg-foreground/10'} viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label={label}>
        {marks.map((mark) => (
          <rect
            key={mark.seq}
            x={mark.startPct}
            y={0}
            width={mark.widthPct}
            height={10}
            className={segmentClassName?.(mark)}
            fill={segmentClassName === undefined ? INPUT_COLOURS[mark.tone % INPUT_COLOURS.length] : undefined}
            data-testid={`${testId}-segment-${mark.seq}`}
            data-input={mark.inputId}
            data-from={mark.fromMs}
            data-to={mark.toMs}
            data-open={mark.open ? 'true' : undefined}
          >
            <title>{textOf(mark)}</title>
          </rect>
        ))}
        {headPct === null || playhead === undefined ? null : (
          <line x1={headPct} x2={headPct} y1={0} y2={10} className={playhead.className} stroke={playhead.className === undefined ? 'currentColor' : undefined} data-testid={`${testId}-head`} data-position={Math.round(playhead.positionMs)} />
        )}
      </svg>
      {list ? (
        <ol className="sr-only" aria-label={label}>
          {marks.map((mark) => (
            <li key={mark.seq}>{textOf(mark)}</li>
          ))}
        </ol>
      ) : null}
      {children}
    </div>
  )
}
