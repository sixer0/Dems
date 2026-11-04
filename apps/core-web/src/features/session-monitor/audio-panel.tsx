import { useMemo } from 'react'
import type { AudioTrackId } from '@dems/shared/domain' // D61 (2026-11-04): the four microphone channels
import { Mic, Volume2 } from 'lucide-react'
import { useSelfCaptureCore } from '@/lib/own-capture'
import { useTranslation } from 'react-i18next'
import { captureMicLines, meterInputOfChannel, noLiveLevelsOf, useSim } from '@dems/shared/sim'
import { DbfsMeter } from '@/components/composed'
import { MicSourceMarks } from '@/features/devices/source-badge'
import { cn } from '@/lib/utils'
import { useAudioSource, useAudioSourceIntervals, useAudioSourceSwitch } from './audio-source'
import { AudioSilentWarning, AudioSourceConfirm, AudioSourceFooter, AudioSourceRoleChip, AudioSourceToggle } from './audio-source-controls'
import { micTiles, micTone, selectConnectingCameras } from './model'
import { Panel } from './panel'

// D61 (2026-11-04): on a Core in its own capture a meter half is named by the shared catalog, by its channel.
const MIC_OWN_CORE_KEY = { 'AUDIO-01': 'common.devices.mic1', 'AUDIO-02': 'common.devices.mic2', 'AUDIO-03': 'common.devices.mic3', 'AUDIO-04': 'common.devices.mic4' } as const satisfies Record<AudioTrackId, string>

/**
 * O: AUDIO MONITOR (01_specs §14.5.2 O; research/04 §3.2 O; M-C-04). Two halves, MIC 1 -
 * Interviewer and MIC 2 - Subject (the step-92 track labels, D50), each with a mic glyph in a
 * ring and a DbfsMeter `panel` on the simulator's transient channel: zero React renders per
 * frame, peak hold, CLIP latch. The meters are functional, not ambient (§9.4). Monitoring paused
 * dims them (M-C-20); recording continues.
 *
 * Task 3 M5 (blueprint row 72; ux §3 flow 2; WB-01): each half says whether its input is the active
 * source of the one session audio track or the hot standby, as the Core holds the pair; the header
 * carries the confirmed manual switch (operation 81; the session holder or a SUPERVISOR, OD-09);
 * a `MIC_SILENT` warning offers the switch and never makes it (OD-11); the footer draws the
 * audio-source band (operation 82, WB-10) and the reason of a blocked toggle.
 */
export function AudioPanel({ paused }: { paused: boolean }) {
  const { t } = useTranslation()
  const store = useSim((s) => s.mics)
  const mics = useMemo(() => micTiles(store), [store])
  // Ruling D137 (integration pass D5; kept for a COMPLETE pair by C21 (7)): the input behind a meter channel
  // is the microphone line at its place in the capture configuration (input order), whatever its id —
  // `MIC-03` / `MIC-01` included. Without a complete pair no channel has an input (`meterInputOfChannel`).
  const micLines = useSim(captureMicLines)
  // Integration pass D7 item 4 (row 139's leftover; ux §8e.2 "no meter presented as recording", D84): before the
  // first durable fragment no live level is drawn — the connecting state stands in the meter's place.
  const connecting = useSim(selectConnectingCameras)
  // Wave H driver B (G75-04): a failed start recorded nothing - its cards draw no level either.
  const failedStart = useSim((s) => noLiveLevelsOf(s.session) === 'FAILED_START')
  const source = useAudioSource()
  const control = useAudioSourceSwitch(source)
  const intervals = useAudioSourceIntervals(source)
  const ownCore = useSelfCaptureCore()
  return (
    <Panel
      id="O"
      icon={Volume2}
      title={t('session.audio.title')}
      className="sm-area-audio"
      bodyClassName="sm-audio-wrap"
      action={<AudioSourceToggle view={source} control={control} />}
      actionBusy={control.busy}
    >
      <AudioSilentWarning view={source} control={control} />
      <div className="sm-audio-body" data-active-input={source.activeInputId ?? undefined}>
      {mics.map((mic) => {
        // Fix wave L (G75d-06): "Interviewer" / "Subject" are roles of the dataset's microphones; a Core in its own capture names the line only.
        // D61 (2026-11-04): any of the four channels; the names come from the shared catalog.
        const name = ownCore ? t(MIC_OWN_CORE_KEY[mic.id]) : mic.name
        // Task 4 row 168 (site W4; decision C18 (2)): the input behind this meter channel, or `null` when the
        // selector holds no complete microphone pair. An absent input is the half's empty state: it is neither
        // the active source nor the standby, and it carries no role chip and no source marks.
        const inputId = meterInputOfChannel(micLines, mic.id)
        return (
          <div
            key={mic.id}
            className="sm-audio-half"
            data-channel={mic.id}
            data-state={mic.state}
            /* D61 (2026-11-04): all four channels record; ACTIVE/STANDBY belong to the transcription pair alone. */
            data-source={inputId === null ? undefined : source.activeInputId === inputId ? 'ACTIVE' : source.standbyInputId === inputId ? 'STANDBY' : undefined}
            data-no-input={inputId === null ? 'true' : undefined}
          >
            <p className="sm-audio-name" title={name}>
              <span className={cn('sm-dot', `sm-dot-${micTone(mic)}`)} aria-hidden="true" />
              <span className="sm-audio-name-text" data-testid={`sm-track-label-${mic.id}`}>{name}</span>
              {inputId === null ? null : <AudioSourceRoleChip inputId={inputId} view={source} />}
              {/* Pass D2 (ux §8f.2, WB-01): the one badge of the microphone behind this meter; nothing unless the Core sent the development class. */}
              {inputId === null ? null : <MicSourceMarks inputId={inputId} place={`monitor-${mic.id}`} />}
            </p>
            <div className="sm-audio-meter">
              <span className="sm-mic-ring" aria-hidden="true" title={t('session.audio.micIcon', { mic: name })}>
                <Mic className="size-5" strokeWidth={1.75} />
              </span>
              {connecting ? (
                <p
                  role="status"
                  className="flex-1 font-mono text-caption uppercase tracking-[0.08em] text-foreground-2"
                  aria-label={`${name}: ${t('common.session.connectingCameras')}`}
                  data-testid={`sm-audio-connecting-${mic.id}`}
                >
                  {t('common.session.trackConnecting')}
                </p>
              ) : failedStart ? (
                <p role="status" className="flex-1 font-mono text-caption uppercase tracking-[0.08em] text-foreground-2" aria-label={`${name}: ${t('common.session.failedStart.title')}`} data-testid={`sm-audio-no-level-${mic.id}`}>
                  {t('common.session.failedStart.title')}
                </p>
              ) : (
                <DbfsMeter channel={mic.id} variant="panel" label={name} monitoringPaused={paused} />
              )}
            </div>
          </div>
        )
      })}
      </div>
      <AudioSourceFooter view={source} control={control} intervals={intervals} />
      <AudioSourceConfirm view={source} control={control} />
    </Panel>
  )
}
