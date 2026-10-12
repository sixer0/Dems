import { useState, type Ref } from 'react'
import { Button, buttonVariants, Modal, Spinner, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Maximize2, Minimize2, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SessionState, type VideoTrackId } from '@dems/shared/domain'
import { formatDuration } from '@dems/shared/realtime'
import { useCoreActions } from '@dems/shared/live'
import { selectSystemState, useSim } from '@dems/shared/sim'
import { GlowRing } from '@/components/composed'
import { RecIndicator, useSimSecond, type CameraFeedHandle } from '@/components/media'
import { CameraPreview } from '@/features/devices/camera-preview'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { useMotionPolicy } from '@/motion'
import { TrackSourceMarks } from '@/features/devices/source-badge'
import { useInterruptedSeal } from './use-interrupted-seal'
import { logSessionMonitorError } from './log'
import { captureFailedStartText, type CaptureFailedStart } from '@/lib/capture-notices'
import { selectCoreSealsInterrupted, selectFeed, type SessionPhase } from './model'
import { Panel } from './panel'

const CAMERA_IDS: readonly VideoTrackId[] = ['VIDEO-01', 'VIDEO-02']
/** M-C-18: one white shutter flash, 0 → 0.85 → 0 in 180 ms (P8: a single flash). */
const SHUTTER_MS = 180

export interface LiveFeedPanelProps {
  phase: SessionPhase
  evidenceId: string | null
  canStart: boolean
  /** Monitoring paused (UI-only, D28/Q8; M-C-20). */
  paused: boolean
  /** Increments on every snapshot (M-C-18 shutter). */
  shutterKey: number
  feedRef: Ref<CameraFeedHandle>
  /** The feed stage element (snapshot flights start here, M-C-18). */
  stageRef: Ref<HTMLDivElement>
  onRecover: () => void
  /** LB-1 (Live mode only): the recovery request is out. */
  recoverBusy?: boolean
  /** LB-1: out for longer than the reveal time. */
  recoverPending?: boolean
}

/**
 * L: LIVE SESSION FEED (01_specs §14.5.2 L; research/04 §3.2 L; M-C-05, M-C-12, M-C-18).
 * - The step-92 live loop of the active camera through CameraFeed (D50), with the kit Chip
 *   overlays: "Camera 1 - Interview Room 1", REC + SlidingNumber timer, "1080p • 25 fps • H.264",
 *   and the fullscreen button.
 * - Camera switch: kit ToggleButtonGroup (Camera 1 | Camera 2), not in the mockup (04 §3.2 L
 *   proposal); the feed cross-fades 320 ms (M-C-12).
 * - Fullscreen: kit Modal with its own enter transition (M-C-15, D6). DR-44-5: the R5
 *   `layoutId="feed-<cameraId>"` flight did not play into the kit Modal's portal in the browser
 *   check, so it is not used; the page feed stops decoding while the fullscreen copy plays.
 * - Without a recording the feed shows its poster, dimmed, under an invitation with a GlowRing
 *   `mini` (M-PG-SM "NO SESSION state").
 * - B-4 (plan row W65; [CS] §8.3, LB-4): the camera choice is optimistic. The toggle shows the
 *   pressed camera at once from a local pending value, which yields to the store when the action
 *   settles and reverts on a failure (a view selection writes no record, 01_specs §7.10 op. 51).
 *   The feed itself follows the store. A simulator answers at once, so nothing pends there.
 */
export function LiveFeedPanel({
  phase,
  evidenceId,
  canStart,
  paused,
  shutterKey,
  feedRef,
  stageRef,
  onRecover,
  recoverBusy = false,
  recoverPending = false,
}: LiveFeedPanelProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const cameraPress = usePendingControl()
  const feed = useSim(selectFeed)
  const [pendingCamera, setPendingCamera] = useState<VideoTrackId | null>(null)
  const selectedCamera = pendingCamera ?? feed.activeCameraId
  const [fullscreen, setFullscreen] = useState(false)
  // Row 139 (D84; ux §8e.2): before the first durable fragment nothing is presented as live.
  const live = (phase === 'RECORDING' && !feed.connecting) || phase === 'FINALIZING'
  const label = t('session.feed.cameraLabel', { camera: feed.cameraName, room: feed.room })
  const formatLabel = t('common.devices.cameraFormatCodec', {
    resolution: feed.resolution,
    fps: feed.fps,
    codec: feed.codec,
  })

  const switchCamera = (keys: Set<string | number> | 'all') => {
    if (keys === 'all') return
    const next = [...keys][0]
    if (next !== 'VIDEO-01' && next !== 'VIDEO-02') return
    // LB-1: a second choice while the first is out is ignored (the toggle keeps the pending one).
    cameraPress.settle(() => actions.setActiveCamera(next), {
      onWait: () => setPendingCamera(next),
      fail: (error) => {
        logSessionMonitorError('LiveFeedPanel.switchCamera', error, { cameraId: next })
        // The page's own branch is the log line above, as before; the presenter words an outage,
        // a limit or a refusal of the Core.
        presentCoreError(error)
      },
      done: () => setPendingCamera(null),
    })
  }

  const fullscreenButton = (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      aria-label={t('session.feed.fullscreen')}
      className="sm-feed-icon-button"
      onPress={() => setFullscreen(true)}
      data-testid="sm-feed-fullscreen"
    >
      <Maximize2 className="size-4" aria-hidden="true" />
    </Button>
  )

  return (
    <Panel
      id="L"
      icon={Video}
      title={t('session.feed.title')}
      className="sm-area-feed"
      bodyClassName="sm-feed-body"
      actionBusy={cameraPress.busy}
      action={
        <ToggleButtonGroup
          aria-label={t('session.feed.cameraSwitch')}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([selectedCamera])}
          onSelectionChange={switchCamera}
          size="sm"
          className="sm-camera-switch"
          data-pending-camera={pendingCamera ?? undefined}
        >
          {CAMERA_IDS.map((id) => (
            <ToggleButton key={id} id={id} data-testid={`sm-camera-${id}`}>
              {t(`common.tracks.${id}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      }
    >
      {/* Pass D2 (ux §8f.2, WB-01; row 137's "not wired" list): the one badge of the camera on screen; nothing unless the Core sent the development class. */}
      <TrackSourceMarks trackId={feed.activeCameraId} place={`monitor-${feed.activeCameraId}`} />
      <div className="sm-feed-stage" ref={stageRef}>
        <div className="sm-feed-frame" data-idle={live ? undefined : 'true'}>
          <CameraPreview
            ref={feedRef}
            cameraId={feed.activeCameraId}
            variant="feed"
            label={label}
            recordingSince={feed.recording ? feed.startedAt : null}
            formatLabel={formatLabel}
            noSignal={feed.noSignal}
            dimmed={paused && live}
            live={live && !fullscreen}
            actions={live ? fullscreenButton : undefined}
            className="sm-feed aspect-auto h-full"
          />
        </div>

        <AnimatePresence>
          {shutterKey > 0 ? (
            <motion.div
              key={shutterKey}
              className="sm-shutter"
              data-testid="sm-shutter"
              aria-hidden="true"
              initial={m.flags.flashes ? { opacity: 0 } : { opacity: 1 }}
              animate={m.flags.flashes ? { opacity: [0, 0.85, 0] } : { opacity: 0 }}
              transition={{ duration: m.seconds(m.flags.flashes ? SHUTTER_MS : 600), ease: 'linear' }}
              data-flash={m.flags.flashes ? 'shutter' : 'border'}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {!live ? (
            <motion.div
              key={phase}
              className="sm-invitation-layer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={m.transitions.crossFade}
            >
              <Invitation
                phase={phase}
                connecting={feed.connecting}
                failedStart={feed.failedStart}
                evidenceId={evidenceId}
                canStart={canStart}
                onRecover={onRecover}
                recoverBusy={recoverBusy}
                recoverPending={recoverPending}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <Modal.Backdrop isOpen={fullscreen} onOpenChange={setFullscreen} variant="blur">
        <Modal.Container size="full" placement="center" className="sm-fullscreen-container">
          <Modal.Dialog aria-label={label} className="sm-fullscreen-dialog">
            <div className="sm-fullscreen-frame">
              <CameraPreview
                cameraId={feed.activeCameraId}
                variant="feed"
                label={label}
                recordingSince={null}
                formatLabel={formatLabel}
                noSignal={feed.noSignal}
                dimmed={paused}
                live
                className="sm-feed sm-feed-full aspect-auto h-full"
                actions={
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={t('session.feed.exitFullscreen')}
                    className="sm-feed-icon-button"
                    onPress={() => setFullscreen(false)}
                  >
                    <Minimize2 className="size-4" aria-hidden="true" />
                  </Button>
                }
              />
              {feed.recording && feed.startedAt !== null ? <FullscreenRec since={feed.startedAt} /> : null}
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Panel>
  )
}

/**
 * The REC chip of the fullscreen feed: the same RecIndicator with the elapsed time as plain
 * tabular text. SlidingNumber measures its digit height once with getBoundingClientRect, and
 * inside the kit Modal's scale-in (and the R5 flight) that height is taken mid-transform, so its
 * ten digit layers stack visibly; plain text keeps the chip legible (DR-44-4).
 */
function FullscreenRec({ since }: { since: number }) {
  const { t } = useTranslation()
  const nowSecond = useSimSecond()
  return (
    <RecIndicator
      since={null}
      size="md"
      label={`${t('session.feed.rec')} ${formatDuration(nowSecond * 1000 - since)}`}
      className="absolute right-2 top-2 font-mono"
    />
  )
}

interface InvitationProps {
  phase: SessionPhase
  /** Row 139: RECORDING before the first durable fragment. */
  connecting: boolean
  /** Row 139: the open session recorded nothing. */
  failedStart: CaptureFailedStart | null
  evidenceId: string | null
  canStart: boolean
  onRecover: () => void
  recoverBusy: boolean
  recoverPending: boolean
}

/** The feed panel's idle, setup, sealed and fault content (M-PG-SM NO SESSION state). */
function Invitation({ phase, connecting, failedStart, evidenceId, canStart, onRecover, recoverBusy, recoverPending }: InvitationProps) {
  const { t } = useTranslation()
  const systemState = useSim((s) => selectSystemState(s).state)
  // Wave H driver B (G75-03, ruling D197): the sealed card of an interrupted recording names it.
  const openSessionId = useSim((s) => s.session?.id ?? null)
  const interrupted = useInterruptedSeal(phase === 'SEALED' ? openSessionId : null)
  // D158: the failed start keeps its words while the Core closes it (the store passes through RECOVERY).
  const failed = (phase === 'FAULT' || phase === 'RECOVERY') && failedStart !== null ? captureFailedStartText(t, failedStart) : null
  // Fix wave M (G75e-05): the Core is sealing the interrupted recording by itself - nothing is offered to start.
  const coreSealing = useSim(selectCoreSealsInterrupted) && phase === 'FAULT'
  // Row 139 (ux §8e.2): "Connecting cameras…" and the failed start come first; neither words a recording or evidence.
  const armed = useSim((s) => s.session?.state === SessionState.ARMED)
  const situationC = connecting
    ? { title: t('common.session.connectingCameras'), body: t('session.audioSource.connecting.detail') }
    : failed !== null
      ? { title: failed.title, body: `${failed.body} ${t('common.session.failedStart.next')}` }
      : null
  const copy =
    situationC ??
    (phase === 'SETUP'
      ? // Fix wave J (JW-17): "Finish the pre-recording checks" was said of a session that is ARMED with every check done.
        { title: t('session.idle.setupTitle'), body: armed ? t('web.waveJ.sessionNew.armedBody') : t('session.idle.setupBody') }
      : phase === 'SEALED'
        ? interrupted !== null
          ? { title: interrupted.title, body: `${evidenceId ?? '—'} · ${interrupted.cause} ${interrupted.kept}` }
          : { title: t('session.idle.sealedTitle'), body: t('session.idle.sealedBody', { evidenceId: evidenceId ?? '—' }) }
        : coreSealing
          ? { title: t('web.waveM.coreSealing.title'), body: t('web.waveM.coreSealing.detailNoReason') }
        : phase === 'FAULT' || phase === 'RECOVERY'
          ? { title: t('session.idle.faultTitle'), body: t('session.idle.faultBody') }
          : { title: t('session.idle.title'), body: t('session.idle.body') })

  return (
    <div
      className="sm-invitation"
      data-testid="sm-invitation"
      data-phase={phase}
      data-connecting={connecting ? 'true' : undefined}
      data-core-sealing={coreSealing ? 'true' : undefined}
      data-failed-start={failed !== null ? failedStart ?? undefined : undefined}
    >
      <GlowRing state={systemState} size={112} mode="mini" className="sm-invitation-ring" />
      <div className="sm-invitation-copy">
        <p className="sm-invitation-title">{copy.title}</p>
        <p className="sm-invitation-body">{copy.body}</p>
      </div>
      <div className="sm-invitation-actions" aria-busy={recoverBusy || undefined}>
        {connecting || coreSealing ? null : !canStart && (phase === 'SETUP' || phase === 'FAULT') ? null : phase === 'SETUP' ? (
          <Link to="/session/new" className={buttonVariants({ variant: 'primary', size: 'md' })}>
            {t('session.banner.cta.continueSetup')}
          </Link>
        ) : phase === 'FAULT' ? (
          <Button variant="danger-soft" onPress={onRecover} isPending={recoverPending} data-busy={recoverBusy || undefined}>
            {recoverPending ? <Spinner size="sm" color="current" /> : null}
            {failed !== null ? t('common.session.failedStart.close') : t('session.banner.cta.recover')}
          </Button>
        ) : phase === 'RECOVERY' ? null : canStart ? (
          <Link to="/session/new" className={buttonVariants({ variant: 'primary', size: 'md' })} data-testid="sm-start-new-session">
            {t('common.actions.startNewSession')}
          </Link>
        ) : null}
        {connecting ? null : failed !== null ? (
          // Row 139: the pointer to "Search again" (Devices). No evidence link: this session has none.
          <Link to="/devices" className={buttonVariants({ variant: 'outline', size: 'md' })} data-testid="sm-failed-start-devices">
            {t('common.session.failedStart.openDevices')}
          </Link>
        ) : phase === 'SEALED' && evidenceId ? (
          <Link
            to="/evidence/$evidenceId"
            params={{ evidenceId }}
            className={buttonVariants({ variant: 'outline', size: 'md' })}
          >
            {t('session.banner.cta.viewEvidence')}
          </Link>
        ) : (
          <Link
            to="/evidence"
            search={{ status: 'RECORDED' }}
            className={buttonVariants({ variant: 'outline', size: 'md' })}
          >
            {t('common.actions.openEvidenceQueue')}
          </Link>
        )}
      </div>
    </div>
  )
}
