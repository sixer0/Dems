import { useMemo } from 'react'
import type { AudioTrackId } from '@dems/shared/domain' // D61 (2026-11-04): the four microphone channels
import { Chip } from '@heroui/react'
import { Mic, Volume2 } from 'lucide-react'
import { useSelfCaptureCore } from '@/lib/own-capture'
import { useTranslation } from 'react-i18next'
import { captureMicLines, meterInputOfChannel, micChannelOfTrack, noLiveLevelsOf, useSim } from '@dems/shared/sim'
import { DbfsMeter } from '@/components/composed'
import { micPairLabel } from '@/features/devices/capture-selector'
import { MicSourceMarks } from '@/features/devices/source-badge'
import { cn } from '@/lib/utils'
import { useAudioSource, useAudioSourceIntervals } from './audio-source'
import { AudioSilentWarning, AudioSourceFooter } from './audio-source-controls'
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
 * Task 3 M5 (blueprint row 72; WB-01): a `MIC_SILENT` warning names the silent input (OD-11); the
 * footer draws the audio-source band (operation 82, WB-10).
 *
 * Audit row 157 (D5, S5 §6; AC-4.6; D4, D30, D130): the microphones are fixed by the camera-microphone
 * pairing, so operation 81 is retired and the panel has NO switch control (no header toggle, no
 * confirmation, no "switch" offer on the silence warning). Each half names its pair slot "Mic N
 * (Camera N)" (row 156 `micPairLabel`, register N-40; the meter TRACK `AUDIO-0N` is fed by channel
 * `MIC-0N` of Pair N, D61) and Pair 1 says "Transcribed" - in place of the Active / Standby role chip
 * and the "Channel 1 (transcribed)" / "Channel 3" chips (row W3T removed `micTrackChannelChip`; the Dashboard tiles read `micPairLabel` too).
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
  const intervals = useAudioSourceIntervals(source)
  const ownCore = useSelfCaptureCore()
  return (
    <Panel
      id="O"
      icon={Volume2}
      title={t('session.audio.title')}
      className="sm-area-audio"
      bodyClassName="sm-audio-wrap"
    >
      <AudioSilentWarning view={source} />
      <div className="sm-audio-body" data-active-input={source.activeInputId ?? undefined}>
      {mics.map((mic) => {
        // Fix wave L (G75d-06): "Interviewer" / "Subject" are roles of the dataset's microphones; a Core in its own capture names the line only.
        // D61 (2026-11-04): any of the four channels; the names come from the shared catalog.
        const name = ownCore ? t(MIC_OWN_CORE_KEY[mic.id]) : mic.name
        // Task 4 row 168 (site W4; decision C18 (2)): the input behind this meter channel, or `null` when the
        // selector holds no line for its channel. An absent input is the half's empty state: no source marks, no level.
        const inputId = meterInputOfChannel(micLines, mic.id)
        // Row 157 (S5 §6, N-40): the pair slot of the half - fixed by number, so it is named with or without an input.
        const channel = micChannelOfTrack(mic.id)
        const pairLabel = micPairLabel(channel)
        const transcribed = pairLabel.values.n === 1
        return (
          <div
            key={mic.id}
            className="sm-audio-half"
            data-channel={mic.id}
            data-state={mic.state}
            data-pair={pairLabel.values.n}
            data-transcribed={transcribed ? 'true' : undefined}
            data-no-input={inputId === null ? 'true' : undefined}
          >
            <p className="sm-audio-name" title={name}>
              <span className={cn('sm-dot', `sm-dot-${micTone(mic)}`)} aria-hidden="true" />
              <span className="sm-audio-name-text" data-testid={`sm-track-label-${mic.id}`}>{name}</span>
              <Chip size="sm" variant="soft" color="default" className="sm-audio-role" data-testid={`sm-audio-pair-${mic.id}`} data-channel={channel}>
                <Chip.Label>{t(pairLabel.key, pairLabel.values)}</Chip.Label>
              </Chip>
              {transcribed ? (
                <Chip size="sm" variant="soft" color="accent" className="flex-none" data-testid={`sm-audio-transcribed-${mic.id}`}>
                  <Chip.Label>{t('devices.pairs.transcribed')}</Chip.Label>
                </Chip>
              ) : null}
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
      <AudioSourceFooter intervals={intervals} />
    </Panel>
  )
}
