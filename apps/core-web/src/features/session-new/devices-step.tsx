import { enumValueWords } from '@/lib/event-words'
import { DemoMark } from '@/components/demo-mark'
import { useState, type ReactNode, type RefObject } from 'react'
import { Alert, Button, Card, Checkbox, Chip, Label, ListBox, Spinner } from '@heroui/react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import {
  AudioLines,
  Camera,
  Clock,
  HardDrive,
  Info,
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
import {
  audioPairOfSelector,
  CaptureStartRule,
  meterInputOfChannel,
  selectorInForce,
  unassignedSlotOfPrecheckItem,
  useSim,
  type PrecheckCheckId,
  type PrecheckItem,
  type SimState,
} from '@dems/shared/sim'
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain'
import { CameraPreview } from '@/features/devices/camera-preview'
import { PrecheckSearchActions } from '@/features/devices/precheck-search'
import { isGeneratedSource } from '@/features/devices/own-core-words'
import { PrecheckSourceMarks } from '@/features/devices/source-badge'
import { useMicInputName } from '@/features/devices/source-class'
import { formatChipText, useTrackFacts } from '@/features/devices/stream-facts'
import { activeCaptureNotices, captureNoticeText, unassignedPrecheckText, unreachablePrecheckOf, unreachablePrecheckText } from '@/lib/capture-notices'
import { DbfsMeter } from '@/components/composed/dbfs-meter'
import { usePlatformNotReported, useSelfCaptureCore } from '@/lib/own-capture'
import { tween, useMotionPolicy } from '@/motion'
import { CHECK_DEVICE_KEY, CHECK_VALUE_ENUM, isSecurityNotReportedNote, precheckNoteKey, reasonKeyFor, type GateView } from './model'

const CHECK_ICON: Record<PrecheckCheckId, LucideIcon> = {
  CORE: Server,
  LENS_1: Video,
  LENS_2: Video,
  MIC_1: Mic,
  MIC_2: Mic,
  MIC_PRIMARY: Mic,
  MIC_STANDBY: Mic,
  STORAGE: HardDrive,
  TIME: Clock,
  SECURITY: ShieldCheck,
}

const EMPTY_ITEMS: PrecheckItem[] = []
const selectItems = (s: SimState): PrecheckItem[] => s.session?.precheck.items ?? EMPTY_ITEMS
/** The Core's alerts as the store holds them (a stable reference; the notices are derived while rendering). */
const selectAlerts = (s: SimState) => s.alerts

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
  /** G70-08 (wave H): the id of the reason line while the console does not know the capture sources; "Re-run checks" is then disabled. */
  retryBlockedBy?: string | null
}

/** The text of a WARN or BLOCK check (i18n, never the simulator's EN `reason`; looked up from its `reasonCode`). */
function useCheckReason() {
  const { t } = useTranslation()
  // Flow 11, situation B: the Core's one alert per unreachable device carries the count of the one search the pre-check ran.
  const notices = activeCaptureNotices(useSim(selectAlerts))
  return (item: PrecheckItem): string | null => {
    // Task 4 row 167 (decisions C18 (1), C25): a selector slot with no source. The item names no
    // device; it is worded by its slot, before every other rule of the row.
    const unassigned = unassignedSlotOfPrecheckItem(item)
    if (unassigned !== null) return unassignedPrecheckText(t, unassigned)
    // Task 3 R-10 (blueprint row 137; D114; ux §8g.3): a source that did not answer is worded by the
    // start rule of `params.rule`, with the device named by label and id — never as a lens fault or "no signal".
    const unreachable = unreachablePrecheckOf(item)
    if (unreachable !== null) {
      const rule = unreachablePrecheckText(t, unreachable)
      const notice = notices.find((entry) => entry.kind === 'UNREACHABLE' && entry.deviceId === unreachable.deviceId)
      return notice === undefined ? rule : `${rule} ${captureNoticeText(t, notice).body}`
    }
    // Wave H closing pass Z2: a NOTE is worded by its rule (the host system clock), never as a fallback.
    const note = precheckNoteKey(item)
    if (note !== null) return t(note)
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
export function DevicesStep({ gate, acknowledged, onAcknowledgedChange, onRetry, live = false, retryPending = false, retryRef, retryBlockedBy = null }: DevicesStepProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const items = useSim(selectItems)
  const policyOwnCore = useSelfCaptureCore()
  const reasonOf = useCheckReason()
  const blocked = items.filter((item) => item.status === 'BLOCK')
  // Flow 11 / 13: which kinds of source did not answer, for the "Search again" of each (G13, G17).
  const unreachable = items.map((item) => unreachablePrecheckOf(item)).filter((source) => source !== null)
  const cameraUnreachable = unreachable.some((source) => source.deviceKind === 'CAMERA')
  const micUnreachable = unreachable.some((source) => source.deviceKind === 'MIC')
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
          <DemoMark block="precheck-checks" />
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
            <ListBox.Item key={item.id} id={item.id} textValue={`${t(`sessionNew.devices.checks.${item.id}`)}: ${isSecurityNotReportedNote(item) ? t('common.platformNotReported.value') : precheckNoteKey(item) !== null ? t('sessionNew.precheckNote.chip') : t(`common.precheckStatus.${item.status}`)}`}>
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

        {/* R-10 AC-4: "Search again" beside the pre-check's own Retry. It searches; it never switches a microphone (D83). */}
        <PrecheckSearchActions camera={cameraUnreachable} microphone={micUnreachable} />

        {gate.canRetry ? (
          <div className="sn-gate-actions">
            <Button ref={retryRef} variant="outline" size="sm" onPress={onRetry} isPending={retryPending} isDisabled={retryBlockedBy !== null} aria-describedby={retryBlockedBy ?? undefined} data-testid="sn-retry">
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
            <DemoMark block="precheck-previews" />
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
            <DemoMark block="precheck-meters" />
            <span className="sn-card-meta sn-speak">
              <Mic className="size-3.5" aria-hidden="true" />
              {t(live ? 'sessionNew.live.speakToTest' : 'sessionNew.devices.speakToTest')}
            </span>
          </header>
          <div className="sn-meters">
            {(['AUDIO-01', 'AUDIO-02'] as const).map((channel) => (
              <MicMeter key={channel} channel={channel} />
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
              {/* Fix wave J (JW-17): "lens fault blocks" beside an unreachable camera that only warns - the list of a Core in its own capture is its own rule. */}
              <dd>{policyOwnCore ? t('web.waveJ.sessionNew.policyBlockOwn') : t('sessionNew.devices.policy.blockList')}</dd>
            </div>
            <div data-tone="warning">
              <dt>
                <TriangleAlert className="size-4" aria-hidden="true" />
                {t('sessionNew.devices.policy.warn')}
              </dt>
              <dd>{policyOwnCore ? t('web.waveJ.sessionNew.policyWarnOwn') : t('sessionNew.devices.policy.warnList')}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  )
}

/**
 * One microphone meter of the device check, with the name of its line.
 *
 * Fix wave M (G75e-02): "MIC 1 - Interviewer" / "MIC 2 - Subject" are the roles of the simulator's
 * room. On a Core in its own capture (`useSelfCaptureCore`, the rule of the Monitor's audio panel) the
 * line is named from the SELECTOR IN FORCE: the input ("MIC 1"), the source on it ("MIC-01"), its role
 * (primary / standby - the selector's line, else the pair the selector gives), and "Generated test
 * source" for a generated one. The simulated lane keeps its labels.
 *
 * Task 4 row 167 (site W3; decision C18 (2)): the input of a meter channel is `meterInputOfChannel`
 * - the selector's line, never a default. A channel with no input (no complete microphone pair)
 * names none: on a Core in its own capture the meter reads "Not assigned".
 */
function MicMeter({ channel }: { channel: AudioTrackId }) {
  const { t } = useTranslation()
  const ownCore = useSelfCaptureCore()
  const micName = useMicInputName()
  // One flat string (input | device | role | generated): the selector's result compares by value.
  const line = useSim((s) => {
    const mics = selectorInForce(s).mics
    const inputId = meterInputOfChannel(mics, channel)
    if (inputId === null) return '|||'
    const stated = mics.find((mic) => mic.inputId === inputId)
    const pair = audioPairOfSelector(mics)
    const role = stated?.role === 'PRIMARY' || stated?.role === 'STANDBY' ? stated.role : pair.activeInputId === inputId ? 'PRIMARY' : pair.standbyInputId === inputId ? 'STANDBY' : ''
    const deviceId = stated?.deviceId ?? ''
    const generated = isGeneratedSource(s.captureDevices.devices.find((device) => device.id === deviceId))
    return [inputId, deviceId, role, generated ? 'G' : ''].join('|')
  })
  const [inputId = '', deviceId = '', role = '', generated = ''] = line.split('|')
  const label = !ownCore
    ? t(`common.tracks.${channel}`)
    : inputId === ''
      ? t('common.captureSlot.notAssigned')
      : [micName(inputId), deviceId === '' || deviceId === inputId ? inputId : deviceId, role === 'PRIMARY' || role === 'STANDBY' ? t(`web.waveM.micLine.${role}`) : null, generated === 'G' ? t('web.waveL.source.generatedMic') : null]
          .filter((part): part is string => part !== null && part !== '')
          .join(' · ')
  return (
    <div className="sn-meter" data-testid={`sn-meter-${channel}`} data-input={ownCore && inputId !== '' ? inputId : undefined} data-role={ownCore && role !== '' ? role : undefined}>
      <span className="sn-meter-label">{label}</span>
      <DbfsMeter channel={channel} variant="panel" label={label} />
    </div>
  )
}

function CheckRow({ item, reason }: { item: PrecheckItem; reason: string | null }) {
  const { t } = useTranslation()
  const Icon = CHECK_ICON[item.id]
  const enumKey = CHECK_VALUE_ENUM[item.id]
  // Wave H closing pass Z2: a NOTE states a fact of the installation; its mark is not a warning's, and
  // its `value` (`HOST_SYSTEM_CLOCK`) is no member of the value enumeration - the row reads its sentence.
  const note = precheckNoteKey(item) !== null
  // Fix wave J (JW-04): "Security - READY - PASS" beside "Security: Not reported" on the Dashboard. A Core that states
  // `security.platformNotReported` checked no TPM, Secure Boot or enclosure state: the row says so. A row that names a
  // fault (WARN / BLOCK) keeps its words - the fault is a fact of the state.
  // The Core says it itself since wave J (a NOTE with the rule `SECURITY_PLATFORM_NOT_REPORTED`); a PASS of an older Core
  // that states `platformNotReported` reads the same.
  const platformNotReported = usePlatformNotReported()
  const notReported = isSecurityNotReportedNote(item) || (platformNotReported && item.id === 'SECURITY' && item.status === 'PASS')
  // Task 4 row 167: the row of an unassigned selector slot carries its rule and its slot, and no device.
  // Its `value` (`NOT_ASSIGNED`) is no member of a value enumeration - the row reads its sentence.
  const unassigned = unassignedSlotOfPrecheckItem(item)
  const valueText = notReported ? t('web.waveJ.precheck.securityNotReported') : item.value && !note && unassigned === null ? enumValueWords(t, enumKey, item.value) : null
  const resolved = item.status === 'PASS' || item.status === 'WARN' || item.status === 'BLOCK'
  return (
    <div
      className="sn-check"
      data-check={item.id}
      data-status={item.status}
      data-note={note ? 'true' : undefined}
      data-not-reported={notReported ? 'true' : undefined}
      data-rule={unassigned !== null ? CaptureStartRule.SOURCE_NOT_ASSIGNED : unreachablePrecheckOf(item)?.rule}
      data-slot={unassigned ?? undefined}
      data-testid={`sn-check-${item.id}`}
    >
      <span className="sn-check-icon" aria-hidden="true">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="sn-check-text">
        <span className="sn-check-label">{t(`sessionNew.devices.checks.${item.id}`)}</span>
        {/* Flow 12 (R-11): the one development-source badge, from the Core's `sourceClass` of this row's device. */}
        <PrecheckSourceMarks checkId={item.id} />
        <span className="sn-check-detail">
          {reason ?? (resolved ? valueText : item.status === 'RUNNING' ? t('sessionNew.devices.resolving') : t('common.precheckStatus.PENDING'))}
        </span>
      </span>
      <span className="sn-check-status">
        {notReported ? (
          <Chip size="sm" variant="soft" color="default" data-testid="sn-check-chip" data-not-reported="true" className="sn-status-chip">
            <Info className="size-3.5" aria-hidden="true" />
            <Chip.Label>{t('common.platformNotReported.value')}</Chip.Label>
          </Chip>
        ) : note ? (
          <Chip size="sm" variant="soft" color="default" data-testid="sn-check-chip" data-note="true" className="sn-status-chip">
            <Info className="size-3.5" aria-hidden="true" />
            <Chip.Label>{t('sessionNew.precheckNote.chip')}</Chip.Label>
          </Chip>
        ) : (
          <StatusMark status={item.status} />
        )}
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
  // Task 4 row W4 (review finding F3-07): the chip is what the camera slice states, as every other reader - it was the
  // literal `1080p / 25`, so a track with another picture, no rate or no statement read `1080p • 25 fps` here. On a Core
  // in real capture the "No preview" tile states the stored stream statement itself (`camera-preview.tsx`).
  const facts = useTrackFacts(cameraId)
  return (
    <CameraPreview
      cameraId={cameraId}
      variant="tile"
      label={label}
      formatLabel={facts.known ? formatChipText(t, facts) : null}
      noSignal={noSignal}
      ariaLabel={label}
      // Decisions D51 / D53: the camera previews of the device check show the Core's live picture of a production camera.
      livePreview
      className="sn-preview-feed"
    />
  )
}
