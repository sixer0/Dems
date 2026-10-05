import { useCallback, type Key, type ReactNode } from 'react'
import { Button, ButtonGroup, Chip, Dropdown, Label, ProgressBar, Spinner, Tooltip } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  BadgeCheck,
  ChevronDown,
  FolderOpen,
  History,
  LayoutTemplate,
  ListChecks,
  MonitorPlay,
  Play,
  RotateCcw,
  TriangleAlert,
  UsersRound,
  Video,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SessionState } from '@dems/shared/domain'
import { useCoreMode } from '@dems/shared/live'
import { DATE_PATTERNS, formatDate, formatUtcOffset } from '@dems/shared/realtime'
import { Permission, selectCan, selectOperatorById, useSim, type SimState } from '@dems/shared/sim'
import { motion as tokens, palette, toneChipProps } from '@dems/shared/tokens'
import { CameraFeed } from '@/components/media'
import { Ripple } from '@/components/ui/ripple'
import { ShineBorder } from '@/components/ui/shine-border'
import { TextScramble } from '@/components/ui/text-scramble'
import { useMotionPolicy } from '@/motion'
import { DashPanel } from './dash-panel'
import {
  finalizationProgress,
  precheckProgress,
  requiredRoleFor,
  sessionPanelKind,
  setupStepFor,
  type SessionPanelKind,
} from './dashboard-model'
import { DASH_BEATS } from './dashboard-motion'
import { manifestSuffixKey, selectSystemStateValue, useSealedManifestDigest } from './sim-adapter'

/** Ripple and ShineBorder share ONE of the four ambient slots (D63; §9.4 "Ripple/ShineBorder"). */
const IDLE_INVITATION_GROUP = 'idle-invitation'
/** Idle icon ↔ recording thumbnail shared element (M-PG-DASH data moment: idle → recording). */
const SESSION_MEDIA_LAYOUT_ID = 'dash-session-media'

const selectSessionCard = (s: SimState) => {
  const session = s.session
  if (!session) return null
  return {
    id: session.id,
    state: session.state,
    caseNumber: session.input.caseNumber,
    subjectType: session.input.subjectType,
    subjectName: session.input.subjectName,
    investigatorId: session.input.investigatorId,
    startedAt: session.startedAt,
    sealedAt: session.sealedAt,
    evidenceId: session.evidenceId,
  }
}
type SessionCard = NonNullable<ReturnType<typeof selectSessionCard>>

const selectPrecheckProgress = (s: SimState) => (s.session ? precheckProgress(s.session) : null)
const selectFinalizationProgress = (s: SimState) => {
  if (!s.session) return null
  const progress = finalizationProgress(s.session)
  const active = s.session.finalization.steps[progress.current - 1]
  return { ...progress, stepId: active?.id ?? null }
}
const selectCanStart = (s: SimState) => selectCan(s, Permission.SESSION_START)

function zoned(at: number | null): string {
  return at === null ? '—' : `${formatDate(at, DATE_PATTERNS.dateTime)} UTC${formatUtcOffset()}`
}

/**
 * Opacity cross-fade shared by every view (`base`). Each view fills the stage absolutely, so the
 * leaving and the entering view overlap without moving each other, and a `layoutId` pair (idle
 * icon → REC thumbnail) is mounted at the same time, which Motion needs for the flight.
 */
function View({ children, testId }: { children: ReactNode; testId: string }) {
  const m = useMotionPolicy()
  return (
    <motion.div
      data-testid={testId}
      className="absolute inset-0 flex min-h-0 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={m.transitions.crossFade}
    >
      {children}
    </motion.div>
  )
}

/**
 * The split "Start New Session" button (ButtonGroup: primary Button + Dropdown chevron) with the
 * idle ShineBorder. RBAC (S20; review rule R4): without SESSION_START it is disabled, and a
 * focusable Tooltip trigger names the required role.
 */
function StartSessionButton({ canStart, invite }: { canStart: boolean; invite: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const start = useCallback(() => void navigate({ to: '/session/new', search: { step: 1 } }), [navigate])
  // Both options open the wizard: its step 1 owns profiles and templates (step 46).
  const onOption = useCallback((_key: Key) => start(), [start])
  const role = requiredRoleFor(Permission.SESSION_START)

  const group = (
    <div className="dems-cta-wrap">
      <ButtonGroup variant="primary" size="md" isDisabled={!canStart}>
        <Button onPress={start} data-testid="start-new-session">
          <Play aria-hidden="true" size={16} fill="currentColor" />
          {t('common.actions.startNewSession')}
        </Button>
        <Dropdown>
          {/* Inside the Dropdown the button is not a direct group child: variant and state are explicit. */}
          <Button isIconOnly variant="primary" isDisabled={!canStart} aria-label={t('dashboard.activeSession.startOptions.label')}>
            <ButtonGroup.Separator />
            <ChevronDown aria-hidden="true" size={16} />
          </Button>
          <Dropdown.Popover placement="bottom end" className="min-w-[220px]">
            <Dropdown.Menu aria-label={t('dashboard.activeSession.startOptions.label')} onAction={onOption}>
              <Dropdown.Item id="lastProfile" textValue={t('dashboard.activeSession.startOptions.lastProfile')}>
                <History aria-hidden="true" size={16} />
                <Label>{t('dashboard.activeSession.startOptions.lastProfile')}</Label>
              </Dropdown.Item>
              <Dropdown.Item id="fromTemplate" textValue={t('dashboard.activeSession.startOptions.fromTemplate')}>
                <LayoutTemplate aria-hidden="true" size={16} />
                <Label>{t('dashboard.activeSession.startOptions.fromTemplate')}</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </ButtonGroup>
      <ShineBorder
        active={invite && canStart}
        duration={8}
        borderWidth={1}
        shineColor={[palette.gold, palette.bronze]}
        loopGroup={IDLE_INVITATION_GROUP}
      />
    </div>
  )

  if (canStart) return group
  return (
    <Tooltip delay={200}>
      <Tooltip.Trigger
        data-testid="start-new-session-locked"
        aria-label={`${t('common.actions.startNewSession')}: ${t('common.rbac.requiresRole', { role: role ? t(`common.roles.${role}`) : '' })}`}
        className="rounded-lg"
      >
        {group}
      </Tooltip.Trigger>
      <Tooltip.Content placement="top">{t('common.rbac.requiresRole', { role: role ? t(`common.roles.${role}`) : '' })}</Tooltip.Content>
    </Tooltip>
  )
}

function IdleView({ canStart, invite }: { canStart: boolean; invite: boolean }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const navigate = useNavigate()
  return (
    <View testId="session-idle">
      <div className="relative flex h-full min-h-0 flex-col items-center justify-center gap-1.5 text-center">
        <div className="relative flex items-center justify-center">
          {/* M-C-23: five bronze ripples behind the idle icon (one slot with the CTA shine). */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 size-[360px] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
            <Ripple mainCircleSize={84} numCircles={5} mainCircleOpacity={0.18} active={invite} loopGroup={IDLE_INVITATION_GROUP} />
          </div>
          <motion.span
            layoutId={m.flags.sharedLayout ? SESSION_MEDIA_LAYOUT_ID : undefined}
            transition={m.transitions.layout}
            className="dems-session-icon"
            aria-hidden="true"
          >
            <Video size={26} strokeWidth={1.6} />
          </motion.span>
        </div>
        <h3 className="relative mt-1 text-h3 text-foreground">{t('dashboard.activeSession.idle.title')}</h3>
        <p className="relative max-w-[30ch] text-caption text-foreground-2">{t('dashboard.activeSession.idle.body')}</p>
        <div className="relative mt-2 flex flex-wrap items-center justify-center gap-3">
          <StartSessionButton canStart={canStart} invite={invite} />
          <Button variant="outline" onPress={() => void navigate({ to: '/evidence', search: { status: 'RECORDED' } })}>
            <FolderOpen aria-hidden="true" size={16} />
            {t('common.actions.openEvidenceQueue')}
          </Button>
        </div>
      </div>
    </View>
  )
}

function SetupView({ card }: { card: SessionCard }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const progress = useSim(selectPrecheckProgress)
  const step = setupStepFor(card.state)
  return (
    <View testId="session-setup">
      <div className="flex h-full min-h-0 flex-col justify-center gap-3">
        <div className="flex items-center gap-2.5">
          <ListChecks aria-hidden="true" size={22} className="text-accent" />
          <h3 className="text-h3 text-foreground">{t('dashboard.activeSession.setup.title')}</h3>
          <Chip size="sm" color="accent" variant="soft" className="ml-auto">
            <Chip.Label>{t(`common.enums.sessionState.${card.state}`)}</Chip.Label>
          </Chip>
        </div>
        <p className="font-mono text-caption text-accent">{card.id}</p>
        {progress ? (
          <ProgressBar value={progress.done} maxValue={Math.max(1, progress.total)} color="accent" size="sm" aria-label={t('dashboard.activeSession.setup.progress', progress)}>
            <Label className="text-caption text-foreground-2">{t('dashboard.activeSession.setup.progress', progress)}</Label>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        ) : null}
        <div>
          <Button variant="primary" size="sm" onPress={() => void navigate({ to: '/session/new', search: { step } })}>
            <Play aria-hidden="true" size={14} fill="currentColor" />
            {t('dashboard.activeSession.setup.continue')}
          </Button>
        </div>
      </div>
    </View>
  )
}

function RecordingView({ card }: { card: SessionCard }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const navigate = useNavigate()
  const selectInvestigator = useCallback(
    (s: SimState) => selectOperatorById(s, card.investigatorId)?.displayName ?? card.investigatorId,
    [card.investigatorId],
  )
  const investigator = useSim(selectInvestigator)
  const rows: Array<{ key: string; label: string; value: string; wide?: boolean; mono?: boolean }> = [
    { key: 'session', label: t('dashboard.activeSession.recording.sessionId'), value: card.id, wide: true, mono: true },
    { key: 'case', label: t('dashboard.activeSession.recording.caseNumber'), value: card.caseNumber },
    { key: 'investigator', label: t('dashboard.activeSession.recording.investigator'), value: investigator },
    { key: 'subject', label: t('dashboard.activeSession.recording.subject'), value: `${t(`common.subjectType.${card.subjectType}`)} · ${card.subjectName}` },
    { key: 'start', label: t('dashboard.activeSession.recording.startTime'), value: zoned(card.startedAt), wide: true },
  ]
  return (
    <View testId="session-recording">
      <div className="flex h-full min-h-0 items-center gap-3.5">
        <motion.div
          layoutId={m.flags.sharedLayout ? SESSION_MEDIA_LAYOUT_ID : undefined}
          transition={m.transitions.layout}
          className="w-[44%] max-w-[280px] shrink-0"
        >
          <CameraFeed
            cameraId="VIDEO-01"
            variant="thumb"
            live={false}
            recordingSince={card.startedAt}
            ariaLabel={t('dashboard.activeSession.recording.thumbnailLabel')}
          />
        </motion.div>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <dl className="dems-kv" data-testid="session-details">
            {rows.map((row, index) => (
              <motion.div
                key={row.key}
                className={row.wide ? 'col-span-2 min-w-0' : 'min-w-0'}
                initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: tokens.distance.riseSm }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...m.transitions.row, delay: m.reduced ? 0 : m.seconds(120 + index * tokens.choreography.stagger) }}
              >
                <dt>{row.label}</dt>
                <dd className={row.mono ? 'font-mono text-accent' : undefined} data-testid={`session-${row.key}`}>
                  {row.value}
                </dd>
              </motion.div>
            ))}
          </dl>
          <div>
            <Button variant="primary" size="sm" onPress={() => void navigate({ to: '/session' })}>
              <MonitorPlay aria-hidden="true" size={15} />
              {t('dashboard.activeSession.recording.openMonitor')}
            </Button>
          </div>
        </div>
      </div>
    </View>
  )
}

function FinalizingView({ card }: { card: SessionCard }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const progress = useSim(selectFinalizationProgress)
  const stopping = card.state === SessionState.STOPPING
  return (
    <View testId="session-finalizing">
      <div className="flex h-full min-h-0 flex-col justify-center gap-3">
        <div className="flex items-center gap-2.5">
          <Spinner size="sm" color="accent" />
          <h3 className="text-h3 text-foreground">
            {stopping ? t('dashboard.activeSession.finalizing.stopping') : t('dashboard.activeSession.finalizing.title')}
          </h3>
        </div>
        <p className="font-mono text-caption text-accent">{card.id}</p>
        {progress && !stopping ? (
          <ProgressBar value={progress.current} maxValue={progress.total} color="accent" size="sm" aria-label={t('dashboard.activeSession.finalizing.progress', progress)}>
            <Label className="text-caption text-foreground-2">
              {t('dashboard.activeSession.finalizing.progress', progress)}
              {progress.stepId ? ` · ${t(`common.enums.finalizationStep.${progress.stepId}`)}` : ''}
            </Label>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        ) : null}
        <div>
          <Button variant="outline" size="sm" onPress={() => void navigate({ to: '/session' })}>
            <MonitorPlay aria-hidden="true" size={15} />
            {t('dashboard.activeSession.recording.openMonitor')}
          </Button>
        </div>
      </div>
    </View>
  )
}

function SealedView({ card, canStart }: { card: SessionCard; canStart: boolean }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const navigate = useNavigate()
  // Review rule R3: the DEMO package digest when the item joins a package (step 54 alignment).
  const manifest = useSealedManifestDigest(card.evidenceId)
  // W63: a Live screen never says "simulated" (04_client_integration_spec §3.2).
  const manifestSuffix = manifestSuffixKey(manifest.source, useCoreMode())
  const sealedChip = toneChipProps('sealed')
  const digest = manifest.digest ? `${manifest.digest.slice(0, 16)}…${manifest.digest.slice(-8)}` : '…'
  return (
    <View testId="session-sealed">
      <div className="flex h-full min-h-0 flex-col justify-center gap-2.5">
        <div className="flex items-center gap-2.5">
          <motion.span variants={m.variants.stamp} initial="hidden" animate="visible" className="inline-flex">
            <Chip size="sm" color={sealedChip.color} className={sealedChip.className}>
              <BadgeCheck aria-hidden="true" size={13} />
              <Chip.Label>{t('common.evidenceStatus.SEALED')}</Chip.Label>
            </Chip>
          </motion.span>
          <h3 className="text-h3 text-foreground">{t('dashboard.activeSession.sealed.title')}</h3>
        </div>
        <dl className="dems-kv">
          <div className="min-w-0">
            <dt>{t('dashboard.activeSession.sealed.evidenceId')}</dt>
            <dd className="font-mono text-accent">{card.evidenceId ?? '—'}</dd>
          </div>
          <div className="min-w-0">
            <dt>{t('dashboard.activeSession.sealed.sealedAt')}</dt>
            <dd>{zoned(card.sealedAt)}</dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt>
              {t('dashboard.activeSession.sealed.manifestHash')}
              {manifestSuffix === null ? '' : ` · ${t(manifestSuffix)}`}
            </dt>
            <dd className="font-mono" data-testid="sealed-manifest" data-source={manifest.source}>
              {manifest.digest ? (
                <TextScramble as="span" characterSet="0123456789abcdef" duration={0.8}>
                  {digest}
                </TextScramble>
              ) : (
                digest
              )}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {card.evidenceId ? (
            <Button
              variant="primary"
              size="sm"
              onPress={() => void navigate({ to: '/evidence/$evidenceId', params: { evidenceId: card.evidenceId ?? '' } })}
            >
              <BadgeCheck aria-hidden="true" size={15} />
              {t('dashboard.activeSession.sealed.viewEvidence')}
            </Button>
          ) : null}
          <StartSessionButton canStart={canStart} invite={false} />
        </div>
      </div>
    </View>
  )
}

function IncidentView({ kind, card }: { kind: 'fault' | 'recovery'; card: SessionCard }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const Icon = kind === 'fault' ? TriangleAlert : RotateCcw
  return (
    <View testId={`session-${kind}`}>
      <div className="flex h-full min-h-0 flex-col justify-center gap-2.5">
        <div className="flex items-center gap-2.5">
          <Icon aria-hidden="true" size={22} className={kind === 'fault' ? 'text-danger-soft-foreground' : 'text-warning-soft-foreground'} />
          <h3 className="text-h3 text-foreground">{t(`dashboard.activeSession.${kind}.title`)}</h3>
          <Chip size="sm" color={kind === 'fault' ? 'danger' : 'warning'} variant="soft" className="ml-auto">
            <Chip.Label>{t(`common.enums.sessionState.${card.state}`)}</Chip.Label>
          </Chip>
        </div>
        <p className="font-mono text-caption text-accent">{card.id}</p>
        <p className="text-caption text-foreground-2">{t(`dashboard.activeSession.${kind}.body`)}</p>
        <div>
          <Button variant={kind === 'fault' ? 'danger-soft' : 'outline'} size="sm" onPress={() => void navigate({ to: '/session' })}>
            <MonitorPlay aria-hidden="true" size={15} />
            {t('dashboard.activeSession.recording.openMonitor')}
          </Button>
        </div>
      </div>
    </View>
  )
}

/**
 * Panel D, Active Session (01_specs §14.5.1 D; research/04 §3.1 D; AssetSample #14): one view per
 * session variant, driven by the session state (idle, setup, recording, finalizing, sealed,
 * fault, recovery). Idle carries the Ripple and the ShineBorder in one ambient slot (only while the
 * system is READY); idle →
 * recording flies the icon into the REC thumbnail (`layoutId`) and staggers the key-values in
 * (M-PG-DASH data moment). The recording view shows the same Session ID, case and investigator as
 * the Session Monitor (AC-74), every time at UTC+07:00.
 */
export function ActiveSessionPanel() {
  const { t } = useTranslation()
  const card = useSim(selectSessionCard)
  const canStart = useSim(selectCanStart)
  const systemState = useSim(selectSystemStateValue)
  const kind: SessionPanelKind = sessionPanelKind(card?.state ?? null)
  // R8 attention budget: the idle invitation (Ripple + ShineBorder, one slot) runs only while the
  // system is READY. A degraded system frees the slot for the shell's SECURE BorderBeam (M-SH-05).
  const invite = systemState === 'READY'

  return (
    <DashPanel id="d" beatMs={DASH_BEATS.row2} title={t('dashboard.activeSession.title')} icon={UsersRound} bodyClassName="relative">
      <div className="dems-session-stage" data-session-kind={kind}>
        <AnimatePresence initial={false}>
          {kind === 'idle' || !card ? (
            <IdleView key="idle" canStart={canStart} invite={invite} />
          ) : kind === 'setup' ? (
            <SetupView key="setup" card={card} />
          ) : kind === 'recording' ? (
            <RecordingView key="recording" card={card} />
          ) : kind === 'finalizing' ? (
            <FinalizingView key="finalizing" card={card} />
          ) : kind === 'sealed' ? (
            <SealedView key="sealed" card={card} canStart={canStart} />
          ) : (
            <IncidentView key={kind} kind={kind} card={card} />
          )}
        </AnimatePresence>
      </div>
    </DashPanel>
  )
}
