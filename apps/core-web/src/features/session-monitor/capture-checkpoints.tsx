import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
import { captureDeviceName } from '@/lib/capture-notices'
import { isOwnCapture } from '@/lib/own-capture'
import { formatBytesParts } from './model'

import { captureCheckpointsOf, checkpointAge, type CaptureCheckpointFacts } from './capture-checkpoints-model'

/** The drawing of the capture checkpoint facts; the member, its reader and the rule are in `capture-checkpoints-model.ts`. */
export interface CaptureCheckpointsProps {
  facts: CaptureCheckpointFacts
  /** The console's clock (epoch ms), for the age of the newest checkpoint. */
  nowMs: number
}

/** The lines themselves, from literal props: "24 fragments saved · last 2 s ago · 34 MB", then one line per camera. */
export function CaptureCheckpoints({ facts, nowMs }: CaptureCheckpointsProps) {
  const { t } = useTranslation()
  const size = (bytes: number) => {
    const parts = formatBytesParts(bytes)
    return t(`common.units.${parts.unit}`, { value: parts.value })
  }
  const age = checkpointAge(nowMs, facts.lastAt)
  const last = age.unit === 'lastSeconds' ? t('session.captureFacts.checkpoints.lastSeconds', { seconds: age.seconds }) : t('session.captureFacts.checkpoints.lastMinutes', { minutes: age.minutes })
  return (
    <div className="sm-check" data-testid="sm-capture-checkpoints" role="status">
      <span className="sm-check-label">{t('session.captureFacts.checkpoints.label')}</span>
      <span className="sm-check-value" data-testid="sm-capture-checkpoints-total">
        {[t('session.captureFacts.checkpoints.fragments', { count: facts.fragments }), last, size(facts.bytes)].join(' · ')}
      </span>
      {facts.cameras.map((camera) => (
        <span key={camera.deviceId} className="sm-check-value" data-testid={`sm-capture-checkpoints-camera-${camera.deviceId}`}>
          {[captureDeviceName(t, camera.deviceId), t('session.captureFacts.checkpoints.fragments', { count: camera.fragments }), size(camera.bytes)].join(' · ')}
        </span>
      ))}
    </div>
  )
}

/**
 * The checkpoint facts of the open session, drawn only beside a session of the Core's own capture
 * that states them. The age re-reads the console clock once a second (a number: no render between).
 */
export function SessionCaptureCheckpoints() {
  // A flat string from the selector (an object would be a new one each read).
  const packed = useSim((s) => {
    if (!isOwnCapture(s.session)) return ''
    const facts = captureCheckpointsOf(s.session)
    return facts === null ? '' : JSON.stringify(facts)
  })
  const nowSecond = useSim((s) => Math.floor(s.clock.now / 1000))
  if (packed === '') return null
  return <CaptureCheckpoints facts={JSON.parse(packed) as CaptureCheckpointFacts} nowMs={nowSecond * 1000} />
}
