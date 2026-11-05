import { Chip } from '@heroui/react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { VideoTrackId } from '@dems/shared/domain'
import { selectCameraById, selectIsRecording, useSim } from '@dems/shared/sim'
import { useMotionPolicy } from '@/motion'
import { CameraPreview } from './camera-preview'
import { useTrackReach } from './track-reach'
import { TrackUnreachableMark } from './capture-notices'
import { useDeviceActions, useDevicePending } from './context'
import { DeviceMenu, IdentifyRing } from './device-menu'
import { useDeviceLabels } from './labels'
import { useDeviceWords } from './live'
import { deviceStatus, STATUS_SEVERITY, STATUS_TONE } from './model'
import { CAMERA_DEVICE, CAMERA_TRACK_POE_PORT } from './sim-adapter'
import { TrackSourceMarks } from './source-badge'
import { useRealCaptureCore } from './source-class'
import { measuredFiguresShown } from './source-state'
import { StatusChip, StatusDot } from './status-chip'
import { useStatedFormat } from './stream-facts'

export interface CameraTileProps {
  cameraId: VideoTrackId
  /** 1 to 4: the lens number shown on the tile (D60, 2026-11-04: four video tracks, one tile each). */
  lens: number
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
  // D60 (2026-11-04): tracks 3 and 4 have no built-in device in the demonstration model; their tile
  // then reads OFFLINE under the track's own name until the selector assigns a source.
  const deviceId = CAMERA_DEVICE[cameraId]
  // LB-1 (plan row W70): the kebab's Button drops `aria-busy`, so the head that holds it carries it.
  const busy = useDevicePending(deviceId)
  const camera = useSim((s) => selectCameraById(s, cameraId))
  const status = useSim((s) => (deviceId ? deviceStatus(s, deviceId) : 'OFFLINE'))
  const name = deviceId ? labels.name(deviceId) : t(`common.tracks.${cameraId}`)
  const tone = STATUS_TONE[status]
  // Row 54 (P12-F08): the format is what the camera slice states. A stream that states no rate (`fps` null)
  // reads its picture and codec without one; a track the slice does not carry states no format at all.
  // Row V6 (S-01): a track with no stored stream statement (`resolution` or `codec` null) reads "Not stated", never a default.
  const formatChip = !camera
    ? ''
    : camera.resolution === null
      ? t('common.devices.cameraFormatNotStated')
      : camera.fps === null
        ? t('common.devices.cameraFormatNoRate', { resolution: camera.resolution })
        : t('common.devices.cameraFormat', { resolution: camera.resolution, fps: camera.fps })
  const formatLine = !camera
    ? null
    : camera.resolution === null || camera.codec === null
      ? t('common.devices.cameraFormatNotStated')
      : camera.fps === null
        ? t('common.devices.cameraFormatCodecNoRate', { resolution: camera.resolution, codec: camera.codec })
        : t('common.devices.cameraFormatCodec', { resolution: camera.resolution, fps: camera.fps, codec: camera.codec })
  const recState = camera?.recState ?? null
  // Fix wave I (G70b-06; `source-state.ts`): on a Core in real capture the PoE port and the bitrate are
  // values of the simulator's camera slice - drawn only where the Core measures them.
  const realCapture = useRealCaptureCore()
  const recording = useSim(selectIsRecording)
  const figures = measuredFiguresShown({ realCapture, recording, bitrateMbps: camera?.bitrateMbps })
  const reach = useTrackReach(cameraId)
  const notChecked = reach === 'NOT_CHECKED' && status === 'READY'
  // Task 4 row W4 (review 060c R-04; S-01 on the state stream): on a Core in real capture the format is the STORED
  // stream statement of the track's selector line ("Not stated" where it names none), never the slice's record; and
  // where the Core reports the camera's fault, the fault is said in its place (`stream-facts.ts`). Null off such a Core.
  const stated = useStatedFormat(cameraId, 'line')

  return (
    <motion.article
      className="dev-cam"
      data-testid={`camera-tile-${cameraId}`}
      data-status={status}
      variants={m.variants.row}
    >
      <header className="dev-tile-head" aria-busy={busy || undefined}>
        <StatusDot tone={notChecked ? 'default' : tone} />
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
          {/* Fix wave J (JW-23 (4)): "READY" of a source the Core never checked (a camera on a dead port) reads "Not checked". */}
          {notChecked ? (
            <StatusChip tone="default" label={t('web.source.notChecked')} severity={STATUS_SEVERITY[status]} testId={`camera-status-${cameraId}`} />
          ) : (
            <StatusChip tone={tone} label={t(`devices.status.${status}`)} severity={STATUS_SEVERITY[status]} testId={`camera-status-${cameraId}`} />
          )}
          {/* Task 3 R-10 / R-11 (blueprint row 137): "Not reachable" from the Core's alert; the development-source badge from the Core's `sourceClass`. */}
          <TrackUnreachableMark trackId={cameraId} />
          <TrackSourceMarks trackId={cameraId} place={cameraId} />
        </div>
        {/* D60 (2026-11-04): an unassigned track has no built-in device, so no menu. */}
        {deviceId ? <DeviceMenu deviceId={deviceId} name={name} /> : null}
      </header>

      <button
        type="button"
        className="dev-cam-media"
        // D60: the drawer of a track with no built-in device has nothing to show.
        disabled={!deviceId}
        onClick={() => {
          if (deviceId) open(deviceId)
        }}
        aria-label={t('devices.cameras.openDetails', { name })}
      >
        {/* Wave H (G70-03): on a Core in real capture this is the neutral "No preview" tile, never the demo loop. */}
        <CameraPreview
          cameraId={cameraId}
          variant="tile"
          label={null}
          formatLabel={realCapture ? '' : formatChip}
          recordingSince={null}
          noSignal={status === 'FAULT' || status === 'OFFLINE'}
          // Decisions D51 / D53: on a Core in real capture a production camera shows its live preview here.
          livePreview
          // D62 (2026-11-05): the Devices tile opens that preview BY ITSELF when the line reads online
          // (debounced ~1 s, max 4 concurrent, closed on offline / hidden tab); the click still opens the drawer.
          autoPreview
          // Live mode: the picture is the bundled demo loop, not a live preview (plan row W0, item 7).
          ariaLabel={t(words.feedAria, { name })}
        />
        {deviceId ? <IdentifyRing deviceId={deviceId} /> : null}
      </button>

      <dl className="dev-cam-meta">
        {/* Fix wave K (C-2, ruling D222 (2)): the format of the simulator's camera record is no fact of the source behind the track on a Core in real capture. */}
        {stated !== null ? (
          <div data-testid={`camera-format-${cameraId}`} data-source="stored" data-fault={stated.fault ?? undefined}>
            <dt>{t('devices.cameras.format')}</dt>
            <dd>{stated.text}</dd>
          </div>
        ) : realCapture || formatLine === null ? null : (
          <div data-testid={`camera-format-${cameraId}`}>
            <dt>{t('devices.cameras.format')}</dt>
            <dd>{formatLine}</dd>
          </div>
        )}
        {/* D60 (2026-11-04): no port of a device the track does not hold. */}
        {figures.poePort && deviceId ? (
          <div data-testid={`camera-poe-${cameraId}`}>
            <dt>{t('devices.cameras.poePort')}</dt>
            {/* D60 (2026-11-04): each built-in camera states its own port — VIDEO-03/04 read POE_CAM_3/4. */}
            <dd>{labels.port(CAMERA_TRACK_POE_PORT[cameraId])}</dd>
          </div>
        ) : null}
        {/* Task 4 row W4 (review 060c R-01, R-06): never on a Core in real capture (`measuredFiguresShown`), and no literal for a track the slice does not carry. */}
        {figures.bitrate && camera && camera.bitrateMbps !== null ? (
          <div data-testid={`camera-bitrate-${cameraId}`}>
            <dt>{t('devices.cameras.bitrate')}</dt>
            <dd>{t('common.units.mbps', { value: camera.bitrateMbps })}</dd>
          </div>
        ) : null}
      </dl>
    </motion.article>
  )
}
