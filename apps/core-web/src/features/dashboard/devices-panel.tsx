import { useCallback, useMemo, type Key, type ReactNode } from 'react'
import { Button, Description, Dropdown, Label, toast } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Activity, Cpu, EllipsisVertical, Info, Mic, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain'
import { DeviceCommand, Permission, selectCan, useSim, useSimActions, type SimState } from '@dems/shared/sim'
import { motion as tokens, type StatusTone } from '@dems/shared/tokens'
import { DbfsMeter } from '@/components/composed'
import { CameraFeed } from '@/components/media'
import { useMotionPolicy } from '@/motion'
import { DashPanel, PanelLink } from './dash-panel'
import { requiredRoleFor, TONE_TEXT_CLASS } from './dashboard-model'
import { DASH_BEATS, useBeatDelay } from './dashboard-motion'
import { StatusDot } from './status-bits'

const CAMERAS: readonly VideoTrackId[] = ['VIDEO-01', 'VIDEO-02']
const MICS: readonly AudioTrackId[] = ['AUDIO-01', 'AUDIO-02']
const CAMERA_NAME_KEY = { 'VIDEO-01': 'common.devices.camera1', 'VIDEO-02': 'common.devices.camera2' } as const
const MIC_NAME_KEY = { 'AUDIO-01': 'common.devices.mic1', 'AUDIO-02': 'common.devices.mic2' } as const

const selectCamera = (id: VideoTrackId) => (s: SimState) => {
  const camera = s.cameras.find((entry) => entry.id === id)
  if (!camera) return null
  return {
    deviceId: camera.deviceId,
    online: camera.online,
    lens: camera.lens,
    resolution: camera.resolution,
    fps: camera.fps,
    recording: camera.recState === 'REC',
  }
}
const selectMic = (id: AudioTrackId) => (s: SimState) => {
  const mic = s.mics.find((entry) => entry.id === id)
  if (!mic) return null
  return { deviceId: mic.deviceId, state: mic.state, clipLatched: mic.clipLatched }
}
const selectCanManage = (s: SimState) => selectCan(s, Permission.DEVICE_MANAGE)

/**
 * The tile kebab (01_specs §14.5.1 E): Details opens Devices & Inputs; Test signal and Restart are
 * simulated device commands. They are device management, so they follow DEVICE_MANAGE (S20): a
 * role without it sees them disabled with the required role. Every outcome is a toast; a failure
 * is also logged (dev console, structured; no client-log endpoint, D41(g)).
 */
function DeviceMenu({ deviceId, name }: { deviceId: string; name: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const actions = useSimActions()
  const canManage = useSim(selectCanManage)
  const role = requiredRoleFor(Permission.DEVICE_MANAGE)
  const needsRole = t('common.rbac.requiresRole', { role: role ? t(`common.roles.${role}`) : '' })

  const onAction = useCallback(
    (key: Key) => {
      if (key === 'details') {
        void navigate({ to: '/devices' })
        return
      }
      const command = key === 'test' ? DeviceCommand.TEST_SIGNAL : DeviceCommand.RESTART
      try {
        actions.deviceCommand(deviceId, command)
        toast.success(
          command === DeviceCommand.TEST_SIGNAL
            ? t('dashboard.devices.testSignalSent', { name })
            : t('dashboard.devices.restartSent', { name }),
        )
      } catch (error) {
        toast.danger(t('dashboard.devices.commandFailed'))
        if (import.meta.env.DEV) {
          console.error('[core-web] device command failed', {
            level: 'error',
            source: 'features/dashboard.DeviceMenu',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            context: { deviceId, command },
          })
        }
      }
    },
    [actions, deviceId, name, navigate, t],
  )

  return (
    <Dropdown>
      <Button isIconOnly variant="ghost" size="sm" className="-mr-1 -mt-1 size-7 min-w-7" aria-label={t('dashboard.devices.tileMenu', { name })}>
        <EllipsisVertical aria-hidden="true" size={16} />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-[220px]">
        <Dropdown.Menu
          aria-label={t('common.deviceMenu.label')}
          disabledKeys={canManage ? [] : ['test', 'restart']}
          onAction={onAction}
        >
          <Dropdown.Item id="details" textValue={t('common.deviceMenu.details')}>
            <Info aria-hidden="true" size={16} />
            <Label>{t('common.deviceMenu.details')}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="test" textValue={t('common.deviceMenu.testSignal')}>
            <Activity aria-hidden="true" size={16} />
            <div className="flex flex-col">
              <Label>{t('common.deviceMenu.testSignal')}</Label>
              {canManage ? null : <Description>{needsRole}</Description>}
            </div>
          </Dropdown.Item>
          <Dropdown.Item id="restart" textValue={t('common.deviceMenu.restart')}>
            <RotateCw aria-hidden="true" size={16} />
            <div className="flex flex-col">
              <Label>{t('common.deviceMenu.restart')}</Label>
              {canManage ? null : <Description>{needsRole}</Description>}
            </div>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

function TileHead({ tone, name, state, deviceId }: { tone: StatusTone; name: string; state: string; deviceId: string }) {
  return (
    <div className="dems-tile-head">
      <StatusDot tone={tone} className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="dems-tile-name">{name}</div>
        <div className={`dems-tile-state ${TONE_TEXT_CLASS[tone]}`} data-testid={`tile-state-${deviceId}`}>
          {state}
        </div>
      </div>
      <DeviceMenu deviceId={deviceId} name={name} />
    </div>
  )
}

/** Tile enter: R1 panel motion on the row-2 beat, tiles 60 ms apart; reduced: opacity only. */
function Tile({ index, beatMs, testId, children }: { index: number; beatMs: number; testId: string; children: ReactNode }) {
  const m = useMotionPolicy()
  return (
    <motion.div
      data-testid={testId}
      className="dems-tile dems-dash-inset"
      initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: tokens.distance.rise, scale: tokens.scale.enterFrom }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...m.transitions.enter, delay: m.reduced ? 0 : m.seconds(beatMs + index * DASH_BEATS.stagger) }}
    >
      {children}
    </motion.div>
  )
}

function CameraTile({ cameraId, index, beatMs }: { cameraId: VideoTrackId; index: number; beatMs: number }) {
  const { t } = useTranslation()
  const camera = useSim(useMemo(() => selectCamera(cameraId), [cameraId]))
  if (!camera) return null
  const fault = !camera.online || camera.lens === 'FAULT'
  // REC is a state here (red dot, "REC"); the elapsed timer lives on the ring and in panel D.
  const tone: StatusTone = fault || camera.recording ? 'danger' : 'success'
  const state = fault
    ? t('common.status.noSignal')
    : camera.recording
      ? t('common.enums.trackRecState.REC')
      : t('common.enums.lensState.READY')
  const name = t(CAMERA_NAME_KEY[cameraId])
  return (
    <Tile index={index} beatMs={beatMs} testId={`device-tile-${cameraId}`}>
      <TileHead tone={tone} name={name} state={state} deviceId={camera.deviceId} />
      {/* The format chip sits top-left: bottom-left would cover the DEMO OSD line of the loop (N-39-3, P13). */}
      <CameraFeed
        cameraId={cameraId}
        variant="tile"
        label={t('common.devices.cameraFormat', { resolution: camera.resolution, fps: camera.fps })}
        noSignal={fault}
        ariaLabel={`${name} · ${state}`}
        className="aspect-auto min-h-0 flex-1"
      />
    </Tile>
  )
}

function MicTile({ channel, index, beatMs }: { channel: AudioTrackId; index: number; beatMs: number }) {
  const { t } = useTranslation()
  const mic = useSim(useMemo(() => selectMic(channel), [channel]))
  if (!mic) return null
  const clip = mic.state === 'CLIP' || mic.clipLatched
  const tone: StatusTone = clip ? 'danger' : mic.state === 'NO_SIGNAL' ? 'warning' : 'success'
  const state = t(`common.enums.micState.${clip ? 'CLIP' : mic.state}`)
  const name = t(MIC_NAME_KEY[channel])
  return (
    <Tile index={index} beatMs={beatMs} testId={`device-tile-${channel}`}>
      <TileHead tone={tone} name={name} state={state} deviceId={mic.deviceId} />
      <div className="dems-mic-body">
        <span className="dems-mic-ring" aria-hidden="true">
          <Mic strokeWidth={1.6} />
        </span>
        <DbfsMeter channel={channel} variant="tile" label={t(`common.tracks.${channel}`)} />
      </div>
    </Tile>
  )
}

/**
 * Panel E, Devices & Inputs (01_specs §14.5.1 E; research/04 §3.1 E): Camera 1 and Camera 2 play
 * the step-92 live-feed loops through CameraFeed (D50; muted, looped, procedural fallback), and
 * MIC 1 and MIC 2 show the tile DbfsMeter (20 Hz, zero React renders per frame). Tiles enter 60 ms
 * apart on the row-2 beat; meters are live from the first frame (M-PG-DASH t = 450).
 */
export function DevicesPanel() {
  const { t } = useTranslation()
  const beatMs = useBeatDelay(DASH_BEATS.row2 + DASH_BEATS.stagger)
  return (
    <DashPanel
      id="e"
      beatMs={DASH_BEATS.row2 + DASH_BEATS.stagger}
      title={t('dashboard.devices.title')}
      icon={Cpu}
      action={<PanelLink to="/devices">{t('dashboard.devices.viewAll')}</PanelLink>}
    >
      <div className="dems-dash-tiles">
        {CAMERAS.map((id, index) => (
          <CameraTile key={id} cameraId={id} index={index} beatMs={beatMs} />
        ))}
        {MICS.map((id, index) => (
          <MicTile key={id} channel={id} index={CAMERAS.length + index} beatMs={beatMs} />
        ))}
      </div>
    </DashPanel>
  )
}
