import { useTranslation } from 'react-i18next'
import { AudioSourceBand as Band } from '@/components/composed/audio-source-band'
import { DevelopmentSourceBadge } from '@/features/devices/source-badge'
import { VerifiedSourceBadge } from './development-source'
import { bandInputs, formatMediaTime, segmentAt, type BandSegment, type VerifiedSources } from './sealed-playback'

export interface AudioSourceBandProps {
  segments: readonly BandSegment[]
  /** The recorded span the band covers, in ms. */
  totalMs: number
  /** The playhead, in ms of media time. */
  positionMs: number
  /** The source classes of the last verify run of this page, or null (no run yet, or none stated). */
  sources: VerifiedSources | null
  /** Wave K (G94b-07): the item's own mark (`developmentSources === true` on Live data). */
  developmentItem?: boolean
}

/** `MIC 1` / `MIC 2` for the pair every console knows; the Core's own id for any other input. */
function useMicName(): (inputId: string) => string {
  const { t } = useTranslation()
  return (inputId) => (inputId === 'MIC-01' ? t('common.devices.mic1') : inputId === 'MIC-02' ? t('common.devices.mic2') : inputId)
}

/**
 * The audio-source band of the evidence page (blueprint row 92; UX spec flow 5 step 4, §6.6, §6.7;
 * R-3): which microphone fed the single audio track over the recording, from the item's
 * `audioSourceIntervals` (media pts).
 *
 * Integration pass D5 (row 92's D-92-8): the band itself is the ONE component of the console,
 * `AudioSourceBand` of `@/components/composed` — the same one the Monitor draws its live band with.
 * This file only hands it the page's own parts: the segments placed over the recorded duration, the
 * playhead of the player, the legend (with the development badge of a verified source) and the
 * line that says which microphone is audible at the playhead.
 */
export function AudioSourceBand({ segments, totalMs, positionMs, sources, developmentItem = false }: AudioSourceBandProps) {
  const { t } = useTranslation()
  const micName = useMicName()
  if (segments.length === 0) {
    return (
      <p className="evi-caption" data-testid="evidence-band-none">
        {t('evidence.playback.band.none')}
      </p>
    )
  }
  const now = segmentAt(segments, positionMs)
  return (
    <Band
      segments={segments}
      inputLabel={micName}
      ariaLabel={t('evidence.playback.band.label')}
      className="evi-band"
      trackClassName="evi-band-track"
      segmentClassName={(segment) => `evi-band-segment evi-band-tone-${segment.tone % 4}`}
      describe={(segment) => t('evidence.playback.band.segment', { mic: micName(segment.inputId), from: formatMediaTime(segment.fromMs), to: formatMediaTime(segment.toMs) })}
      playhead={{ positionMs, totalMs, className: 'evi-band-head' }}
      list={false}
      testId="evidence-band"
      header={<span className="evi-label">{t('evidence.playback.band.title')}</span>}
    >
      <ul className="evi-band-legend" aria-label={t('evidence.playback.band.label')} data-testid="evidence-band-legend">
        {bandInputs(segments).map((input) => {
          const development = sources?.state === 'DEVELOPMENT' ? sources.audioIntervals.find((entry) => entry.sourceClass !== 'PRODUCTION' && segments.some((segment) => segment.seq === entry.seq && segment.inputId === input.inputId)) : undefined
          // Wave K (G94b-07): without a verify result, the class the ITEM states for the intervals of this microphone
          // (manifest field 125); an item that states none per interval but is a development item carries the plain mark.
          const own = segments.filter((segment) => segment.inputId === input.inputId)
          const stated = own.find((segment) => segment.sourceClass === 'LOCAL_DEVICE' || segment.sourceClass === 'FAKE')?.sourceClass
          const notStated = own.every((segment) => segment.sourceClass === undefined)
          const itemMark = sources !== null || !developmentItem ? null : stated !== undefined ? stated : notStated ? 'ITEM' : null
          return (
            <li key={input.inputId} data-input={input.inputId}>
              <span className={`evi-band-swatch evi-band-tone-${input.tone % 4}`} aria-hidden="true" />
              <span className="evi-strong">{micName(input.inputId)}</span>
              <span className="evi-caption">
                {segments
                  .filter((segment) => segment.inputId === input.inputId)
                  .map((segment) => `${formatMediaTime(segment.fromMs)}–${formatMediaTime(segment.toMs)}`)
                  .join(', ')}
              </span>
              {development ? (
                <VerifiedSourceBadge sourceClass={development.sourceClass} kind="MIC" testId={`evidence-band-development-${input.inputId}`} />
              ) : itemMark !== null ? (
                <DevelopmentSourceBadge adapter={itemMark === 'ITEM' ? null : itemMark} kind="MIC" testId={`evidence-band-development-${input.inputId}`} />
              ) : null}
            </li>
          )
        })}
      </ul>
      <p className="evi-caption" role="status" data-testid="evidence-band-now" data-input={now?.inputId ?? undefined}>
        {now ? t('evidence.playback.band.now', { mic: micName(now.inputId) }) : t('evidence.playback.band.nowNone')}
      </p>
    </Band>
  )
}
