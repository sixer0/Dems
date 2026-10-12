import { useTrackReach } from '@/features/devices/track-reach'
import type { VideoTrackId } from '@dems/shared/domain'
import { useMemo, useRef } from 'react'
import { Card } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ArrowRight, Cctv, ChevronDown, Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { noLiveLevelsOf, useSim } from '@dems/shared/sim'
import { DbfsMeter } from '@/components/composed'
import { CameraPreview } from '@/features/devices/camera-preview'
import { useRealCaptureCore } from '@/features/devices/source-class'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, useStaggerVariants } from './choreography'
import { cameraTiles, micTiles, micTone } from './model'
import { Panel } from './panel'
import { useScrollEdges } from './scroll-edges'

const MIC_SHORT = { 'AUDIO-01': 'common.devices.mic1', 'AUDIO-02': 'common.devices.mic2' } as const

/**
 * R: CAMERA & INPUT STATUS (01_specs §14.5.2 R; research/04 §3.2 R). A 2×2 grid of kit
 * `Card variant="tertiary"` tiles: the two cameras (poster thumbnails, `live={false}` so only the
 * main feed decodes video, D70) and the two microphones with a DbfsMeter `compact` on the
 * transient channel. Tiles reveal 60 ms apart (M-PG-SM t = 460).
 */
export function InputsPanel({ paused }: { paused: boolean }) {
  const { t } = useTranslation()
  const realCapture = useRealCaptureCore()
  const m = useMotionPolicy()
  const cameraStore = useSim((s) => s.cameras)
  const micStore = useSim((s) => s.mics)
  const cameras = useMemo(() => cameraTiles(cameraStore), [cameraStore])
  const mics = useMemo(() => micTiles(micStore), [micStore])
  const container = useStaggerVariants(PANEL_BEAT_MS.R, 60, 4)
  // Wave H driver B (G75-04; ux §8e.2 "no meters"; D84): no live level before the first durable fragment, and none
  // for a session that recorded nothing. The state stands in the meter's place.
  const noLevels = useSim((s) => noLiveLevelsOf(s.session))
  // Fix wave M (G89d-05): where the two rows do not fit (1440 x 900) the card body scrolls instead of drawing the
  // microphone tiles over the camera tiles; the cue of wave L (G89c-07) says there is more below.
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const edges = useScrollEdges(bodyRef)
  const moreBelow = edges === 'bottom' || edges === 'both'

  return (
    <Panel
      id="R"
      icon={Cctv}
      title={t('session.inputs.title')}
      className="sm-area-inputs"
      bodyClassName="sm-inputs-body"
      bodyRef={bodyRef}
      action={
        <Link to="/devices" className="sm-card-link">
          {t('session.inputs.viewAll')}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      }
    >
      <motion.div className="sm-inputs-grid" variants={container} data-testid="sm-inputs">
        {cameras.map((camera) => (
          <motion.div key={camera.id} variants={m.variants.row} className="min-w-0">
            <Card variant="tertiary" className="sm-input-tile" data-device={camera.id} data-ready={camera.ready ? 'true' : 'false'}>
              <CameraPreview
                cameraId={camera.id}
                variant="thumb"
                live={false}
                noSignal={!camera.ready}
                ariaLabel={camera.name}
                className="sm-input-thumb"
              />
              <div className="sm-input-text">
                <p className="sm-input-name">
                  <span className={cn('sm-dot', camera.ready ? 'sm-dot-success' : 'sm-dot-danger')} aria-hidden="true" />
                  {camera.name}
                </p>
                <CameraState cameraId={camera.id} ready={camera.ready} online={camera.online} />
                {/* Fix wave K (C-2, ruling D222 (2)): "1080p • 25 fps" is the dataset's camera record, not the stream of the source behind the track on a Core in real capture. */}
                {/* A stream that states no rate (`fps` null) reads its picture without one (task 4 row 54 / I-3, P12-F08). */}
                {realCapture ? null : (
                  <p className="sm-input-meta">
                    {camera.fps === null ? t('common.devices.cameraFormatNoRate', { resolution: camera.resolution }) : t('common.devices.cameraFormat', { resolution: camera.resolution, fps: camera.fps })}
                  </p>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
        {mics.map((mic) => {
          const tone = micTone(mic)
          return (
            <motion.div key={mic.id} variants={m.variants.row} className="min-w-0">
              <Card variant="tertiary" className="sm-input-tile" data-device={mic.id} data-state={mic.state}>
                <span className="sm-input-mic" aria-hidden="true">
                  <Mic className="size-5" strokeWidth={1.75} />
                </span>
                <div className="sm-input-text">
                  <p className="sm-input-name">
                    <span className={cn('sm-dot', `sm-dot-${tone}`)} aria-hidden="true" />
                    {t(MIC_SHORT[mic.id])}
                  </p>
                  <p className={cn('sm-input-state', tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-muted')}>
                    {t(`common.enums.micState.${mic.clipLatched ? 'CLIP' : mic.state}`)}
                  </p>
                  {noLevels !== null ? (
                    <p className="sm-input-meta" role="status" data-testid={`sm-input-no-level-${mic.id}`}>
                      {noLevels === 'CONNECTING' ? t('common.session.trackConnecting') : t('common.session.failedStart.title')}
                    </p>
                  ) : (
                    <DbfsMeter channel={mic.id} variant="compact" label={mic.name} monitoringPaused={paused} className="sm-input-meter" />
                  )}
                </div>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>
      {moreBelow ? (
        <div className="sm-scroll-cue" data-testid="sm-inputs-more-below" aria-hidden="true">
          <ChevronDown className="size-3" strokeWidth={2} />
          {t('web.waveL.integrity.moreBelow')}
        </div>
      ) : null}
    </Panel>
  )
}

/**
 * Fix wave J (JW-23 (4); rule 3c): the state word of a camera here is the one the Dashboard and the Devices page say.
 * "READY" of a source the Core never checked reads "Not checked" (`useTrackReach`).
 */
function CameraState({ cameraId, ready, online }: { cameraId: VideoTrackId; ready: boolean; online: boolean }) {
  const { t } = useTranslation()
  const notChecked = useTrackReach(cameraId) === 'NOT_CHECKED' && ready && online
  if (notChecked) return <p className="sm-input-state" data-testid={`sm-input-state-${cameraId}`} data-reach="NOT_CHECKED">{t('web.source.notChecked')}</p>
  return (
    <p className={cn('sm-input-state', ready ? 'text-success' : 'text-danger')} data-testid={`sm-input-state-${cameraId}`}>
      {online ? t(`common.enums.lensState.${ready ? 'READY' : 'FAULT'}`) : t('session.inputs.offline')}
    </p>
  )
}
