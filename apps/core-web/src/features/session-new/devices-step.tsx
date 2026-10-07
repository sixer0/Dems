import { useState, type ReactNode, type RefObject } from 'react'
import { Alert, Button, Card, Checkbox, Chip, Label, ListBox, Spinner } from '@heroui/react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import {
  AudioLines,
  Camera,
  Clock,
  HardDrive,
  ListChecks,
  Mic,
  OctagonX,
  RotateCcw,
  Server,
  ShieldCheck,
  TriangleAlert,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim, type PrecheckCheckId, type PrecheckItem, type SimState } from '@dems/shared/sim'
import type { VideoTrackId } from '@dems/shared/domain'
import { CameraFeed } from '@/components/media/camera-feed'
import { DbfsMeter } from '@/components/composed/dbfs-meter'
import { tween, useMotionPolicy } from '@/motion'
import { CHECK_DEVICE_KEY, CHECK_VALUE_ENUM, reasonKeyFor, type GateView } from './model'

const CHECK_ICON: Record<PrecheckCheckId, LucideIcon> = {
  CORE: Server,
  LENS_1: Video,
  LENS_2: Video,
  MIC_1: Mic,
  MIC_2: Mic,
  STORAGE: HardDrive,
  TIME: Clock,
  SECURITY: ShieldCheck,
}

const EMPTY_ITEMS: PrecheckItem[] = []
const selectItems = (s: SimState): PrecheckItem[] => s.session?.precheck.items ?? EMPTY_ITEMS

/** PASS check-draw (M-PG-NEW / M-C-09 literal, 300 ms). */
const CHECK_DRAW_MS = 300

export interface DevicesStepProps {
  gate: GateView
  acknowledged: boolean
  onAcknowledgedChange: (value: boolean) => void
  onRetry: () => void
  /**
   * Live mode (plan row W64): a blocked `CORE` check is worded as what it is there, "no paired
   * tablet is connected" (decision F69), because the console cannot clear it. The meters' hint names
   * the Core server as their source (`sessionNew.live.speakToTest`, shared with the mobile app: closing
   * copy round, D164 DN-5). False in Simulated mode, where the step looks as before.
   */
  live?: boolean
  /** Live mode (LB-1): "Re-run checks" is in flight for longer than the reveal time. Never true in Simulated mode. */
  retryPending?: boolean
  /** The "Re-run checks" button's element (`aria-busy` while the request is in flight). */
  retryRef?: RefObject<HTMLButtonElement | null>
}

/** The text of a WARN or BLOCK check (i18n, never the simulator's EN `reason`; looked up from its `reasonCode`). */
function useCheckReason() {
  const { t } = useTranslation()
  return (item: PrecheckItem): string | null => {
    const key = reasonKeyFor(item)
    if (!key) return null
    const device = item.id in CHECK_DEVICE_KEY ? t(CHECK_DEVICE_KEY[item.id as keyof typeof CHECK_DEVICE_KEY]) : ''
    return t(`sessionNew.devices.reasons.${key}`, { device })
  }
}

/**
 * Step 2, Devices Check: the design book §5.3 pre-recording gate (01_specs §14.5.11; research/04
 * §5.7). A kit `ListBox` of the 8 checks, each with a `Spinner` while it resolves and a PASS / WARN /
 * BLOCK `Chip`; an acknowledgement `Checkbox` for warnings; an `Alert danger` for a block; two
 * camera previews (CameraFeed tiles) and two live MIC meters (DbfsMeter). The simulator resolves
 * the checks in sequence (300–700 ms each, ≤ 4.9 s) and owns the policy.
 * Motion (M-PG-NEW): Spinner → check-draw (PASS), amber chip (WARN; the Checkbox slides in) or red
 * chip plus the Alert (BLOCK); preview tiles fade in from blur; meters are live.
 */
export function DevicesStep({ gate, acknowledged, onAcknowledgedChange, onRetry, live = false, retryPending = false, retryRef }: DevicesStepProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const items = useSim(selectItems)
  const reasonOf = useCheckReason()
  const blocked = items.filter((item) => item.status === 'BLOCK')
  const blockReasons = blocked.map((item) => reasonOf(item)).filter((text): text is string => text !== null)
  // F69: in Live mode only a connected paired tablet clears this check; "Clear the fault" would mislead.
  const linkBlocked = live && blocked.some((item) => reasonKeyFor(item) === 'coreOffline')
  const onlyLinkBlocked = linkBlocked && blocked.every((item) => reasonKeyFor(item) === 'coreOffline')

  const slide = {
    initial: m.reduced ? { opacity: 0 } : { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
    transition: tween('base', 'standard', m.timeScale),
  }
  const mediaIn: Variants = m.variants.mediaIn

  let outcomeChip: ReactNode
  if (gate.phase === 'running' || gate.phase === 'idle') {
    outcomeChip = (
      <Chip size="sm" variant="soft" color="accent" data-testid="sn-gate-outcome" data-phase={gate.phase}>
        <Spinner size="sm" color="current" aria-hidden="true" />
        <Chip.Label>{t('sessionNew.devices.outcome.running')}</Chip.Label>
      </Chip>
    )
  } else if (gate.phase === 'block') {
    outcomeChip = (
      <Chip size="sm" variant="soft" color="danger" data-testid="sn-gate-outcome" data-phase="block">
        <OctagonX className="size-3.5" aria-hidden="true" />
        <Chip.Label>{t('sessionNew.devices.outcome.block')}</Chip.Label>
      </Chip>
    )
  } else if (gate.phase === 'warn') {
    outcomeChip = (
      <Chip size="sm" variant="soft" color="warning" data-testid="sn-gate-outcome" data-phase="warn">
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        <Chip.Label>
          {gate.needsAck
            ? t('sessionNew.devices.outcome.warn', { count: gate.warnings })
            : t('sessionNew.devices.outcome.acknowledged', { count: gate.warnings })}
        </Chip.Label>
      </Chip>
    )
  } else {
    outcomeChip = (
      <Chip size="sm" variant="soft" color="success" data-testid="sn-gate-outcome" data-phase="pass">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        <Chip.Label>{t('sessionNew.devices.outcome.pass')}</Chip.Label>
      </Chip>
    )
  }

  return (
    <div className="sn-devices-grid" data-testid="sn-step-devices" data-gate={gate.phase}>
      <Card className="sn-card sn-checks-card">
        <header className="sn-card-header">
          <ShieldCheck className="sn-card-icon" aria-hidden="true" strokeWidth={1.75} />
          <h2 className="sn-card-title">{t('sessionNew.devices.title')}</h2>
          <span className="sn-card-action">{outcomeChip}</span>
        </header>
        <p className="sn-caption">{t('sessionNew.devices.intro')}</p>
        <div className="sn-progress" aria-hidden="true">
          <motion.span
            className="sn-progress-fill"
            data-phase={gate.phase}
            initial={false}
            animate={{ scaleX: gate.total > 0 ? gate.done / gate.total : 0 }}
            transition={tween('base', 'standard', m.timeScale)}
          />
        </div>
        <p className="sn-progress-text" role="status" aria-live="polite" data-testid="sn-gate-progress">
          {t('sessionNew.devices.progress', { done: gate.done, total: gate.total })}
        </p>

        <ListBox aria-label={t('sessionNew.devices.listLabel')} selectionMode="none" className="sn-checks" data-testid="sn-checks">
          {items.map((item) => (
            <ListBox.Item key={item.id} id={item.id} textValue={`${t(`sessionNew.devices.checks.${item.id}`)}: ${t(`common.precheckStatus.${item.status}`)}`}>
              <CheckRow item={item} reason={reasonOf(item)} />
            </ListBox.Item>
          ))}
        </ListBox>

        <AnimatePresence initial={false} mode="popLayout">
          {gate.phase === 'block' ? (
            <motion.div key="block" {...slide} className="sn-gate-note">
              <Alert status="danger" data-testid="sn-gate-blocked">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t('sessionNew.devices.blockedTitle')}</Alert.Title>
                  <Alert.Description>{t('sessionNew.devices.blockedBody', { reasons: blockReasons.join('; ') })}</Alert.Description>
                  {linkBlocked ? <Alert.Description data-testid="sn-gate-live-link">{t('sessionNew.live.coreLinkHint')}</Alert.Description> : null}
                  {onlyLinkBlocked ? null : <Alert.Description>{t('sessionNew.devices.resolveHint')}</Alert.Description>}
                </Alert.Content>
              </Alert>
            </motion.div>
          ) : null}
          {gate.phase === 'warn' && gate.needsAck ? (
            <motion.div key="warn" {...slide} className="sn-gate-note sn-ack" data-testid="sn-gate-warn">
              <p className="sn-ack-body">{t('sessionNew.devices.warnBody')}</p>
              <Checkbox isSelected={acknowledged} onChange={onAcknowledgedChange} data-testid="sn-ack">
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Label>{t('sessionNew.devices.acknowledge')}</Label>
                </Checkbox.Content>
              </Checkbox>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {gate.canRetry ? (
          <div className="sn-gate-actions">
            <Button ref={retryRef} variant="outline" size="sm" onPress={onRetry} isPending={retryPending} data-testid="sn-retry">
              {retryPending ? <Spinner size="sm" color="current" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
              {t('sessionNew.devices.retry')}
            </Button>
          </div>
        ) : null}
      </Card>

      <div className="sn-media-col">
        <Card className="sn-card sn-previews-card">
          <header className="sn-card-header">
            <Camera className="sn-card-icon" aria-hidden="true" strokeWidth={1.75} />
            <h2 className="sn-card-title">{t('sessionNew.devices.previews')}</h2>
          </header>
          <motion.div className="sn-previews" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: m.flags.stagger ? m.seconds(80) : 0 } } }}>
            {(['VIDEO-01', 'VIDEO-02'] as const).map((cameraId) => (
              <motion.div key={cameraId} variants={mediaIn} className="sn-preview">
                <PreviewTile cameraId={cameraId} />
              </motion.div>
            ))}
          </motion.div>
        </Card>
        <Card className="sn-card sn-meters-card">
          <header className="sn-card-header">
            <AudioLines className="sn-card-icon" aria-hidden="true" strokeWidth={1.75} />
            <h2 className="sn-card-title">{t('sessionNew.devices.meters')}</h2>
            <span className="sn-card-meta sn-speak">
              <Mic className="size-3.5" aria-hidden="true" />
              {t(live ? 'sessionNew.live.speakToTest' : 'sessionNew.devices.speakToTest')}
            </span>
          </header>
          <div className="sn-meters">
            {(['AUDIO-01', 'AUDIO-02'] as const).map((channel) => (
              <div key={channel} className="sn-meter">
                <span className="sn-meter-label">{t(`common.tracks.${channel}`)}</span>
                <DbfsMeter channel={channel} variant="panel" label={t(`common.tracks.${channel}`)} />
              </div>
            ))}
          </div>
        </Card>
        <Card className="sn-card sn-policy-card" data-testid="sn-policy">
          <header className="sn-card-header">
            <ListChecks className="sn-card-icon" aria-hidden="true" strokeWidth={1.75} />
            <h2 className="sn-card-title">{t('sessionNew.devices.policy.title')}</h2>
          </header>
          <dl className="sn-policy">
            <div data-tone="danger">
              <dt>
                <OctagonX className="size-4" aria-hidden="true" />
                {t('sessionNew.devices.policy.block')}
              </dt>
              <dd>{t('sessionNew.devices.policy.blockList')}</dd>
            </div>
            <div data-tone="warning">
              <dt>
                <TriangleAlert className="size-4" aria-hidden="true" />
                {t('sessionNew.devices.policy.warn')}
              </dt>
              <dd>{t('sessionNew.devices.policy.warnList')}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  )
}

function CheckRow({ item, reason }: { item: PrecheckItem; reason: string | null }) {
  const { t } = useTranslation()
  const Icon = CHECK_ICON[item.id]
  const enumKey = CHECK_VALUE_ENUM[item.id]
  const valueText = item.value ? (t(`common.enums.${enumKey}.${item.value}` as never, { defaultValue: item.value }) as string) : null
  const resolved = item.status === 'PASS' || item.status === 'WARN' || item.status === 'BLOCK'
  return (
    <div className="sn-check" data-check={item.id} data-status={item.status} data-testid={`sn-check-${item.id}`}>
      <span className="sn-check-icon" aria-hidden="true">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="sn-check-text">
        <span className="sn-check-label">{t(`sessionNew.devices.checks.${item.id}`)}</span>
        <span className="sn-check-detail">
          {reason ?? (resolved ? valueText : item.status === 'RUNNING' ? t('sessionNew.devices.resolving') : t('common.precheckStatus.PENDING'))}
        </span>
      </span>
      <span className="sn-check-status">
        <StatusMark status={item.status} />
      </span>
    </div>
  )
}

function StatusMark({ status }: { status: PrecheckItem['status'] }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const [mountedResolved] = useState(() => status === 'PASS' || status === 'WARN' || status === 'BLOCK')
  const pop = mountedResolved || m.reduced ? false : { scale: 0.7, opacity: 0 }
  if (status === 'PENDING') return <span className="sn-pending-dot" aria-label={t('common.precheckStatus.PENDING')} />
  if (status === 'RUNNING') return <Spinner size="sm" color="accent" aria-label={t('common.precheckStatus.RUNNING')} />
  const color = status === 'PASS' ? 'success' : status === 'WARN' ? 'warning' : 'danger'
  return (
    <motion.span key={status} initial={pop} animate={{ scale: 1, opacity: 1 }} transition={m.transitions.completion} className="inline-flex">
      <Chip size="sm" variant="soft" color={color} data-testid="sn-check-chip" className="sn-status-chip">
        {status === 'PASS' ? (
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={mountedResolved || m.reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={tween(CHECK_DRAW_MS, 'standard', m.timeScale)}
            />
          </svg>
        ) : status === 'WARN' ? (
          <TriangleAlert className="size-3.5" aria-hidden="true" />
        ) : (
          <OctagonX className="size-3.5" aria-hidden="true" />
        )}
        <Chip.Label>{t(`common.precheckStatus.${status}`)}</Chip.Label>
      </Chip>
    </motion.span>
  )
}

/** One camera preview: the step-92 live loop (tile variant), NO SIGNAL when the camera is lost. */
function PreviewTile({ cameraId }: { cameraId: VideoTrackId }) {
  const { t } = useTranslation()
  const noSignal = useSim((s) => {
    const camera = s.cameras.find((c) => c.id === cameraId)
    return !camera || !camera.online || camera.lens === 'FAULT'
  })
  const label = t(`common.tracks.${cameraId}`)
  return (
    <CameraFeed
      cameraId={cameraId}
      variant="tile"
      label={label}
      formatLabel={t('common.devices.cameraFormat', { resolution: '1080p', fps: 25 })}
      noSignal={noSignal}
      ariaLabel={label}
      className="sn-preview-feed"
    />
  )
}
