import { useMemo } from 'react'
import { Mic, Volume2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MIC_INPUT_OF_CHANNEL, useSim } from '@dems/shared/sim'
import { DbfsMeter } from '@/components/composed'
import { cn } from '@/lib/utils'
import { useAudioSource, useAudioSourceIntervals, useAudioSourceSwitch } from './audio-source'
import { AudioSilentWarning, AudioSourceConfirm, AudioSourceFooter, AudioSourceRoleChip, AudioSourceToggle } from './audio-source-controls'
import { micTiles, micTone } from './model'
import { Panel } from './panel'

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
  const source = useAudioSource()
  const control = useAudioSourceSwitch(source)
  const intervals = useAudioSourceIntervals(source)
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
      <div className="sm-audio-body" data-active-input={source.activeInputId}>
      {mics.map((mic) => {
        const name = mic.name
        return (
          <div
            key={mic.id}
            className="sm-audio-half"
            data-channel={mic.id}
            data-state={mic.state}
            data-source={source.activeInputId === MIC_INPUT_OF_CHANNEL[mic.id] ? 'ACTIVE' : 'STANDBY'}
          >
            <p className="sm-audio-name" title={name}>
              <span className={cn('sm-dot', `sm-dot-${micTone(mic)}`)} aria-hidden="true" />
              <span className="sm-audio-name-text" data-testid={`sm-track-label-${mic.id}`}>{name}</span>
              <AudioSourceRoleChip inputId={MIC_INPUT_OF_CHANNEL[mic.id]} view={source} />
            </p>
            <div className="sm-audio-meter">
              <span className="sm-mic-ring" aria-hidden="true" title={t('session.audio.micIcon', { mic: name })}>
                <Mic className="size-5" strokeWidth={1.75} />
              </span>
              <DbfsMeter channel={mic.id} variant="panel" label={name} monitoringPaused={paused} />
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
