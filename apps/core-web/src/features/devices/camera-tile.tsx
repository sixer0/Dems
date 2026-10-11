import { Chip } from '@heroui/react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { VideoTrackId } from '@dems/shared/domain'
import { selectCameraById, selectIsRecording, useSim } from '@dems/shared/sim'
import { useMotionPolicy } from '@/motion'
import { CameraPreview } from './camera-preview'
import { TrackUnreachableMark } from './capture-notices'
import { useDeviceActions, useDevicePending } from './context'
import { DeviceMenu, IdentifyRing } from './device-menu'
import { useDeviceLabels } from './labels'
import { useDeviceWords } from './live'
import { deviceStatus, STATUS_SEVERITY, STATUS_TONE } from './model'
import { CAMERA_DEVICE, CAMERA_POE_PORT } from './sim-adapter'
import { TrackSourceMarks } from './source-badge'
import { useRealCaptureCore } from './source-class'
import { measuredFiguresShown } from './source-state'
import { StatusChip, StatusDot } from './status-chip'

export interface CameraTileProps {
  cameraId: VideoTrackId
  /** 1 or 2: the lens number of the dual-lens camera. */
  lens: 1 | 2
}

/**
 * A camera lens tile (01_specs §14.5.4 "Camera Devices"; research/04 §4.1 #10): kit `Card`
 * header with the status dot, name, lens and track, status `Chip`, the recording-track chip while
 * recording, and the kebab `Dropdown`; the live step-92 loop through **CameraFeed** (`tile`:
 * media-in first paint, hover lift, NO SIGNAL on a lens fault); and
 * the format, PoE port and bitrate. Clicking the image opens the device drawer.
 *
 * No REC timer overlay on the tiles: the recording state is the track chip in the tile header
 * (REC / DEGRADED / LOST), the room lamp and the RECORD LED. Two extra SlidingNumber timers cost a
 * measured React render burst every second while recording (27_page_devices.md §4), and the
 * elapsed time belongs to Session Monitor.
 */
export function CameraTile({ cameraId, lens }: CameraTileProps) {
  const { t } = useTranslation()
  const words = useDeviceWords()
  const m = useMotionPolicy()
  const labels = useDeviceLabels()
  const { open } = useDeviceActions()
  const deviceId = CAMERA_DEVICE[cameraId]
  // LB-1 (plan row W70): the kebab's Button drops `aria-busy`, so the head that holds it carries it.
  const busy = useDevicePending(deviceId)
  const camera = useSim((s) => selectCameraById(s, cameraId))
  const status = useSim((s) => deviceStatus(s, deviceId))
  const name = labels.name(deviceId)
  const tone = STATUS_TONE[status]
  const resolution = camera?.resolution ?? '1080p'
  const fps = camera?.fps ?? 25
  const recState = camera?.recState ?? null
  // Fix wave I (G70b-06; `source-state.ts`): on a Core in real capture the PoE port and the bitrate are
  // values of the simulator's camera slice - drawn only where the Core measures them.
  const realCapture = useRealCaptureCore()
  const recording = useSim(selectIsRecording)
  const figures = measuredFiguresShown({ realCapture, recording })

  return (
    <motion.article
      className="dev-cam"
      data-testid={`camera-tile-${cameraId}`}
      data-status={status}
      variants={m.variants.row}
    >
      <header className="dev-tile-head" aria-busy={busy || undefined}>
        <StatusDot tone={tone} />
        <div className="dev-tile-titles">
          <span className="dev-tile-name">{name}</span>
          <span className="dev-tile-sub">
            {/* Fix wave L (G75d-06): "Lens 1" is the dataset's dual-lens camera; a Core in real capture names the track only. */}
            {realCapture ? cameraId : `${t('devices.cameras.lens', { number: lens })} · ${cameraId}`}
          </span>
        </div>
        <div className="dev-tile-chips">
          {recState ? (
            <Chip
              size="sm"
              variant="soft"
              color={recState === 'REC' ? 'danger' : 'warning'}
              className="dev-rec-chip font-mono"
              data-testid={`camera-rec-${cameraId}`}
            >
              <Chip.Label>{t(`common.enums.trackRecState.${recState}`)}</Chip.Label>
            </Chip>
          ) : null}
          <StatusChip tone={tone} label={t(`devices.status.${status}`)} severity={STATUS_SEVERITY[status]} testId={`camera-status-${cameraId}`} />
          {/* Task 3 R-10 / R-11 (blueprint row 137): "Not reachable" from the Core's alert; the development-source badge from the Core's `sourceClass`. */}
          <TrackUnreachableMark trackId={cameraId} />
          <TrackSourceMarks trackId={cameraId} place={cameraId} />
        </div>
        <DeviceMenu deviceId={deviceId} name={name} />
      </header>

      <button
        type="button"
        className="dev-cam-media"
        onClick={() => open(deviceId)}
        aria-label={t('devices.cameras.openDetails', { name })}
      >
        {/* Wave H (G70-03): on a Core in real capture this is the neutral "No preview" tile, never the demo loop. */}
        <CameraPreview
          cameraId={cameraId}
          variant="tile"
          label={null}
          formatLabel={realCapture ? '' : t('common.devices.cameraFormat', { resolution, fps })}
          recordingSince={null}
          noSignal={status === 'FAULT'}
          // Live mode: the picture is the bundled demo loop, not a live preview (plan row W0, item 7).
          ariaLabel={t(words.feedAria, { name })}
        />
        <IdentifyRing deviceId={deviceId} />
      </button>

      <dl className="dev-cam-meta">
        {/* Fix wave K (C-2, ruling D222 (2)): the format of the simulator's camera record is no fact of the source behind the track on a Core in real capture. */}
        {realCapture ? null : (
          <div data-testid={`camera-format-${cameraId}`}>
            <dt>{t('devices.cameras.format')}</dt>
            <dd>{t('common.devices.cameraFormatCodec', { resolution, fps, codec: camera?.codec ?? 'H.264' })}</dd>
          </div>
        )}
        {figures.poePort ? (
          <div data-testid={`camera-poe-${cameraId}`}>
            <dt>{t('devices.cameras.poePort')}</dt>
            <dd>{labels.port(CAMERA_POE_PORT)}</dd>
          </div>
        ) : null}
        {figures.bitrate ? (
          <div data-testid={`camera-bitrate-${cameraId}`}>
            <dt>{t('devices.cameras.bitrate')}</dt>
            <dd>{t('common.units.mbps', { value: camera?.bitrateMbps ?? 9 })}</dd>
          </div>
        ) : null}
      </dl>
    </motion.article>
  )
}
