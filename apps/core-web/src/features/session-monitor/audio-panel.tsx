import { useMemo } from 'react'
import { Mic, Volume2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
import { DbfsMeter } from '@/components/composed'
import { cn } from '@/lib/utils'
import { micTiles, micTone } from './model'
import { Panel } from './panel'

/**
 * O: AUDIO MONITOR (01_specs §14.5.2 O; research/04 §3.2 O; M-C-04). Two halves, MIC 1 -
 * Interviewer and MIC 2 - Subject (the step-92 track labels, D50), each with a mic glyph in a
 * ring and a DbfsMeter `panel` on the simulator's transient channel: zero React renders per
 * frame, peak hold, CLIP latch. The meters are functional, not ambient (§9.4). Monitoring paused
 * dims them (M-C-20); recording continues.
 */
export function AudioPanel({ paused }: { paused: boolean }) {
  const { t } = useTranslation()
  const store = useSim((s) => s.mics)
  const mics = useMemo(() => micTiles(store), [store])
  return (
    <Panel id="O" icon={Volume2} title={t('session.audio.title')} className="sm-area-audio" bodyClassName="sm-audio-body">
      {mics.map((mic) => {
        const name = mic.name
        return (
          <div key={mic.id} className="sm-audio-half" data-channel={mic.id} data-state={mic.state}>
            <p className="sm-audio-name" title={name}>
              <span className={cn('sm-dot', `sm-dot-${micTone(mic)}`)} aria-hidden="true" />
              <span data-testid={`sm-track-label-${mic.id}`}>{name}</span>
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
    </Panel>
  )
}
