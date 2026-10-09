import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { MicInputId } from '@dems/shared/domain'
import { toneHex } from '@dems/shared/tokens'
import { cn } from '@/lib/utils'
import { audioSourceBandSegments, formatMediaMs, type AudioSourceBandInterval } from './audio-source-band.math'

export type { AudioSourceBandInterval, AudioSourceBandSegment } from './audio-source-band.math'

/** One colour per input: the band says which mic was inside `AUDIO-01`, not how healthy it was. */
const INPUT_COLOUR: Record<MicInputId, string> = {
  'MIC-01': toneHex.accent,
  'MIC-02': toneHex.info,
}

export interface AudioSourceBandProps {
  /** The intervals of operation 82 (any order). */
  intervals: readonly AudioSourceBandInterval[]
  /** Media time the band ends at (ms): the elapsed recording time, or a sealed file's duration. */
  endMs: number
  /** The name of an input ("MIC 1"). */
  inputLabel: (inputId: MicInputId) => string
  /** Accessible name of the band. Default `session.audioSource.band.label`. */
  ariaLabel?: string
  className?: string
}

/**
 * AudioSourceBand (register WB-10; ux §3 flow 2 and §6 flow 5; operation 82): which microphone
 * input was the source of the one session audio track, and when. One segment per interval, its
 * width the interval's share of the media time; the open interval runs to `endMs`. A static
 * overlay: nothing here animates and nothing reads a clock. The same intervals are a list for
 * assistive technology (the segments are decoration).
 */
export function AudioSourceBand({ intervals, endMs, inputLabel, ariaLabel, className }: AudioSourceBandProps) {
  const { t } = useTranslation()
  const segments = useMemo(() => audioSourceBandSegments(intervals, endMs), [intervals, endMs])
  if (segments.length === 0) return null
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)} data-testid="audio-source-band" data-segments={segments.length}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
        {segments.map((segment) => (
          <span
            key={segment.seq}
            data-testid={`audio-source-band-segment-${segment.seq}`}
            data-input={segment.inputId}
            data-open={segment.open ? 'true' : undefined}
            className="h-full min-w-0"
            style={{ flexGrow: segment.fraction, flexBasis: 0, backgroundColor: INPUT_COLOUR[segment.inputId] }}
          />
        ))}
      </div>
      <ol className="sr-only" aria-label={ariaLabel ?? t('session.audioSource.band.label')}>
        {segments.map((segment) => (
          <li key={segment.seq}>
            {segment.open
              ? t('session.audioSource.band.open', { mic: inputLabel(segment.inputId), from: formatMediaMs(segment.fromMs) })
              : t('session.audioSource.band.closed', {
                  mic: inputLabel(segment.inputId),
                  from: formatMediaMs(segment.fromMs),
                  to: formatMediaMs(segment.toMs),
                })}
          </li>
        ))}
      </ol>
    </div>
  )
}
