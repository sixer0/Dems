import { useTrackReach } from '@/features/devices/track-reach'
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain' // D61 (2026-11-04): the four microphone channels
import { useMemo, useRef } from 'react'
import { Card } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ArrowRight, Cctv, ChevronDown, Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { noLiveLevelsOf, useSim } from '@dems/shared/sim'
import { DbfsMeter } from '@/components/composed'
import { ReachGatedCameraPreview } from '@/features/devices/reach-gated-preview'
import { useDocumentVisible } from '@/features/devices/idle-meter-lease'
import { useRealCaptureCore } from '@/features/devices/source-class'
import { trackFaultText, useCameraCaptureFault, useStatedFormat } from '@/features/devices/stream-facts'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, useStaggerVariants } from './choreography'
import { cameraTiles, micTiles, micTone } from './model'
import { Panel } from './panel'
import { useScrollEdges } from './scroll-edges'

// D61 (2026-11-04): four microphone channels, named from the shared catalog.
const MIC_SHORT = { 'AUDIO-01': 'common.devices.mic1', 'AUDIO-02': 'common.devices.mic2', 'AUDIO-03': 'common.devices.mic3', 'AUDIO-04': 'common.devices.mic4' } as const satisfies Record<AudioTrackId, string>

/**
 * R: CAMERA & INPUT STATUS (01_specs §14.5.2 R; research/04 §3.2 R). A grid of kit
 * `Card variant="tertiary"` tiles: one per camera track (D60, 2026-11-04: four; `live={false}`: no demo loop decodes
 * here, D70 - on a Core in real capture each thumb is the Core's reach-gated live picture, row W4-1 / D231) and the microphones with a DbfsMeter
 * `compact` on the transient channel. Tiles reveal 60 ms apart (M-PG-SM t = 460).
 */
/** The stored stream statement of a track on a Core in real capture, or its fault (`features/devices/stream-facts.ts`). Nothing off such a Core. */
function StatedFormat({ cameraId }: { cameraId: VideoTrackId }) {
  const stated = useStatedFormat(cameraId, 'chip')
  if (stated === null) return null
  return (
    <p className="sm-input-meta" data-testid={`sm-input-format-${cameraId}`} data-fault={stated.fault ?? undefined}>
      {stated.text}
    </p>
  )
}

export function InputsPanel({ paused }: { paused: boolean }) {
  const { t } = useTranslation()
  const realCapture = useRealCaptureCore()
  // Row W4-1 (L8, D231): the thumbs are the Core's live pictures while the tab is visible (a hidden tab closes them).
  const visible = useDocumentVisible()
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
              {/* Row W4-1 (L8, D231): reach-gated as the feed (no token while NOT_REACHABLE). The 108 x 61 px thumb has no room
                  for "Try again" (session-monitor.css hides it there): the feed of the selected camera carries it. */}
              <ReachGatedCameraPreview
                cameraId={camera.id}
                variant="thumb"
                live={false}
                livePreview={visible}
                noSignal={!camera.ready}
                ariaLabel={camera.name}
                className="sm-input-thumb"
              />
              <div className="sm-input-text">
                <p className="sm-input-name">
                  <CameraDot cameraId={camera.id} ready={camera.ready} />
                  {camera.name}
                </p>
                <CameraState cameraId={camera.id} ready={camera.ready} online={camera.online} />
                {/* Fix wave K (C-2, ruling D222 (2)): "1080p • 25 fps" is the dataset's camera record, not the stream of the source behind the track on a Core in real capture. */}
                {/* A stream that states no rate (`fps` null) reads its picture without one (task 4 row 54 / I-3, P12-F08). */}
                {/* Task 4 row W4 (review 060c R-04): on a Core in real capture the line is the track's STORED stream statement
                    ("Not stated" where the selector line names none), or the camera's fault where the Core reports one. */}
                {realCapture ? (
                  <StatedFormat cameraId={camera.id} />
                ) : (
                  <p className="sm-input-meta">
                    {/* Row V6 (S-01): no stored stream statement reads "Not stated". */}
                    {camera.resolution === null ? t('common.devices.cameraFormatNotStated') : camera.fps === null ? t('common.devices.cameraFormatNoRate', { resolution: camera.resolution }) : t('common.devices.cameraFormat', { resolution: camera.resolution, fps: camera.fps })}
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

/** The dot of a camera card: never the "ready" colour beside a camera in an active capture fault (row W5, Q-01). */
function CameraDot({ cameraId, ready }: { cameraId: VideoTrackId; ready: boolean }) {
  const fault = useCameraCaptureFault(cameraId)
  return <span className={cn('sm-dot', ready && fault === null ? 'sm-dot-success' : 'sm-dot-danger')} aria-hidden="true" />
}

/**
 * Fix wave J (JW-23 (4); rule 3c): the state word of a camera here is the one the Dashboard and the Devices page say.
 * "READY" of a source the Core never checked reads "Not checked" (`useTrackReach`).
 */
function CameraState({ cameraId, ready, online }: { cameraId: VideoTrackId; ready: boolean; online: boolean }) {
  const { t } = useTranslation()
  // Task 4 row W5 (review 060d Q-01): a camera the Core holds an ACTIVE capture fault about (it stopped delivering
  // inside the session) is not "READY". The fault is said in the state's place and goes when the Core resolves it.
  const fault = useCameraCaptureFault(cameraId)
  const reach = useTrackReach(cameraId)
  if (fault !== null) {
    return (
      <p className="sm-input-state text-danger" role="status" data-testid={`sm-input-state-${cameraId}`} data-fault={fault}>
        {trackFaultText(t, fault)}
      </p>
    )
  }
  const notChecked = reach === 'NOT_CHECKED' && ready && online
  if (notChecked) return <p className="sm-input-state" data-testid={`sm-input-state-${cameraId}`} data-reach="NOT_CHECKED">{t('web.source.notChecked')}</p>
  return (
    <p className={cn('sm-input-state', ready ? 'text-success' : 'text-danger')} data-testid={`sm-input-state-${cameraId}`}>
      {online ? t(`common.enums.lensState.${ready ? 'READY' : 'FAULT'}`) : t('session.inputs.offline')}
    </p>
  )
}
