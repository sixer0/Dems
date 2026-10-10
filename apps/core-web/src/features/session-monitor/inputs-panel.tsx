import { useMemo } from 'react'
import { Card } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ArrowRight, Cctv, Mic } from 'lucide-react'
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

  return (
    <Panel
      id="R"
      icon={Cctv}
      title={t('session.inputs.title')}
      className="sm-area-inputs"
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
                <p className={cn('sm-input-state', camera.ready ? 'text-success' : 'text-danger')}>
                  {camera.online ? t(`common.enums.lensState.${camera.ready ? 'READY' : 'FAULT'}`) : t('session.inputs.offline')}
                </p>
                {/* Fix wave K (C-2, ruling D222 (2)): "1080p • 25 fps" is the dataset's camera record, not the stream of the source behind the track on a Core in real capture. */}
                {realCapture ? null : <p className="sm-input-meta">{t('common.devices.cameraFormat', { resolution: camera.resolution, fps: camera.fps })}</p>}
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
    </Panel>
  )
}
