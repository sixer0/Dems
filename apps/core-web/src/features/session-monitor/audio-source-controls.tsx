import { Alert, Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { MIC_SILENCE_DBFS, MIC_SILENCE_DURATION_MS } from '@dems/shared/api'
import { useRetryCooldown } from '@dems/shared/realtime'
import { recordingEndOf, useSim } from '@dems/shared/sim'
import { AudioSourceBand } from '@/components/composed'
import { useMicInputName } from '@/features/devices/source-class'
import type { AudioSourceIntervalsView, AudioSourceView } from './audio-source'

// Audit row 157 (D5, S5 §6; AC-4.6; D4, D30, D130): operation 81 is retired - the microphones are fixed
// by the camera-microphone pairing. The header toggle, its confirmation, the "Switch to channel 2" offer of
// the silence warning, the toggle's block reasons and the switch refusals are REMOVED; the Active /
// Standby role chip gave way to the pair label of each half (`audio-panel.tsx`, row 156 `micPairLabel`).

/** The band's end moves in steps of this many ms of media time: the panel renders at most at 0.2 Hz (§9.3). */
const BAND_STEP_MS = 5_000

/**
 * The `MIC_SILENT` warning (ux §3.2 step 8; OD-11): it names the silent input. It offers nothing and
 * changes nothing - the microphone of each pair is fixed by setup (row 157).
 */
export function AudioSilentWarning({ view }: { view: AudioSourceView }) {
  const { t } = useTranslation()
  const micName = useMicInputName()
  if (view.silentInputId === null) return null
  return (
    <Alert status="warning" className="sm-audio-warning" data-testid="sm-audio-silent" data-input={view.silentInputId}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('session.audioSource.silent.title', { mic: micName(view.silentInputId) })}</Alert.Title>
        <Alert.Description>
          {t('session.audioSource.silent.body', { dbfs: MIC_SILENCE_DBFS, seconds: MIC_SILENCE_DURATION_MS / 1000 })}
        </Alert.Description>
      </Alert.Content>
    </Alert>
  )
}

function BandRetry({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(onRetry)
  return (
    <span className="sm-audio-band-failed" data-testid="sm-audio-band-failed">
      <span>{t('session.audioSource.band.unavailable')}</span>
      <Button size="sm" variant="ghost" onPress={retry} isDisabled={!canRetry} data-testid="sm-audio-band-retry">
        {exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry')}
      </Button>
    </span>
  )
}

/** Under the meters: the audio-source band of the open session (WB-10, operation 82), or its failed read with a Retry. */
export function AudioSourceFooter({ intervals }: { intervals: AudioSourceIntervalsView }) {
  const { t } = useTranslation()
  const micName = useMicInputName()
  // Media time of "now", in coarse steps; 0 without a started session.
  const elapsedMs = useSim((s) => {
    const startedAt = s.session?.startedAt ?? null
    if (startedAt === null) return 0
    const end = recordingEndOf(s.session) ?? s.clock.now
    return Math.max(0, Math.floor((end - startedAt) / BAND_STEP_MS) * BAND_STEP_MS)
  })
  const { read } = intervals
  return (
    <div className="sm-audio-footer" data-testid="sm-audio-footer">
      {read.kind === 'READY' && read.items.length > 0 ? (
        <div className="sm-audio-band">
          <span className="sm-audio-band-caption">{t('session.audioSource.band.caption')}</span>
          <AudioSourceBand intervals={read.items} endMs={elapsedMs} inputLabel={micName} className="flex-1" />
        </div>
      ) : null}
      {read.kind === 'FAILED' ? <BandRetry onRetry={intervals.retry} /> : null}
    </div>
  )
}
