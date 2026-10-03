/**
 * Recovery Status (04_mobile_specs §4.8; T16; book §6.4 item 5, §18.1) at `/session/recovery`; step 81
 * (05_mobile_plan M-11 part b). Replaces step 70's stub; the export name and the
 * `SafeScreen id="session-recovery"` root stay (T-M02, MA-04).
 *
 * The runtime's route sync (step 73) opens this screen when a critical fault (POWER_FAIL,
 * STORAGE_FULL, TPM_FAILURE, SECURITY_FAULT) moves the session to FAULT. "After unexpected reboot,
 * perform controlled session-recovery analysis before evidence is treated as sealed" (§6.4):
 *
 * 1. FAULT: a calm danger Alert names the fault and the time recording stopped (one escalation
 *    pulse, then a steady colour, 03M P7); the mini GlowRing is critical (its slow 2.4 s glow until
 *    the operator acts); the C-4 pipeline waits; "Start recovery" is gated by role (SESSION_START,
 *    SIM-GAP-M81-2: a refused role gets the SimPermissionError toast).
 * 2. RECOVERY (3 s on the simulator clock): the pipeline animates through the recovery marker, the
 *    integrity of VIDEO-01/02 and AUDIO-01/02, the last good segment, the time-source continuity and
 *    the incomplete-session analysis (§18.1 RECOVERY_SCAN → INCOMPLETE_SESSION_ANALYSIS); the track
 *    rows resolve one by one; the ring de-escalates to attention (colour only, R8).
 * 3. Outcome: the simulator keeps the session INCOMPLETE, never sealed (SYS-008), with an unsealed
 *    RECORDED evidence item when recording had started. A RECOVERED → sealed outcome with a recovery
 *    signature is drawn when the simulator reports one (SIM-GAP-M81-1; today it never does).
 *    "Acknowledge" marks the fault's alerts as seen, settles the ring on READY (600 ms, simulator
 *    clock) and goes Home (04 §4.8 "Acknowledge → idle").
 *
 * Layout (04 §2.4 "Finalizing, Summary, Recovery"): a centred card on phones; tablet landscape puts
 * the analysis details (tracks, segment, time source, session) in a 360 dp pane beside the 720 dp card.
 * Back: consumed with a toast while the analysis runs; otherwise it pops, or goes Home (F-79-1).
 */
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { Alert, Button, useToast } from 'heroui-native';
import { BadgeCheck, ShieldAlert, ShieldCheck, ShieldEllipsis, TriangleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { formatClock, formatDuration } from '@dems/shared/realtime';
import { useSim } from '@dems/shared/sim';
import { fontFamily, palette, spacing, statusText, typography } from '@dems/shared/tokens';
import { GlowRing } from '@/components/composed/glow-ring';
import { KeyValueList, SectionCard, StatusChip, SubjectTypeChip, type KeyValueItem } from '@/components/kit';
import { Pane, SafeScreen, useLayoutClass, type LayoutClass } from '@/layout';
import { SPEC_LITERALS, animatePulseOnce, enterRise, glowShadow, triggerHaptic, useAmbientLoop, useMotionSettings } from '@/motion';
import { sessionResyncHref } from '@/navigation';
import { reportRuntimeIssue } from '@/runtime';
import { RecoveryPipeline, TrackRows } from './recovery-analysis';
import { RecoveryBoundary } from './recovery-boundary';
import {
  isRecoveryBusy,
  outcomeKind,
  recoveryPhase,
  ringStateFor,
  sizeParts,
  shortValue,
  stageFor,
  type RecoveryOutcomeKind,
  type RecoveryPhase,
} from './recovery.model';
import { canStartRecovery } from './sim-adapter';
import {
  analysisOf,
  useAckSettled,
  useFollowedRecovery,
  useRecoveryActions,
  useRecoveryMilestone,
  useRecoveryOutcome,
  useRecoveryRole,
  useSimNow,
  type RecoveryAnalysis,
  type RecoveryInputs,
  type RecoveryOutcomeData,
} from './use-recovery';

/** 04 §2.4 "Finalizing, Summary, Recovery": centred card widths per layout class (dp). */
const CARD_MAX_WIDTH: Readonly<Record<LayoutClass, number | undefined>> = {
  compact: undefined,
  'compact-landscape': 560,
  medium: 640,
  expanded: 720,
};
/** Expanded: the details pane beside the 720 dp card. */
const SIDE_WIDTH = 360;
/** One "please wait" toast per this many ms of simulator time, however often Back is pressed. */
const BLOCKED_TOAST_GAP_MS = 2_000;
const RING_SIZE = 88;

/** Sessions whose FAULT already buzzed (one critical-fault haptic per session, not per mount). */
const buzzedSessions = new Set<string>();

/** Test-only: forget which sessions buzzed. */
export function resetRecoveryHapticsForTests(): void {
  buzzedSessions.clear();
}

export function SessionRecoveryScreen() {
  const { t } = useTranslation();
  const focused = useIsFocused();
  const { layoutClass } = useLayoutClass();
  const settings = useMotionSettings();
  const followed = useFollowedRecovery();
  const liveState = useSim((s) => s.session?.state ?? null);
  const outcomeData = useRecoveryOutcome(followed?.id ?? null);
  const outcome = outcomeKind(outcomeData.outcome);
  const phase = recoveryPhase(liveState, followed?.id ?? null, outcome !== null);
  const milestone = useRecoveryMilestone();
  const role = useRecoveryRole();
  const actions = useRecoveryActions(role);
  const go = useNavigate();
  const simNow = useSimNow();

  useRecoveryBack({ busy: isRecoveryBusy(phase), focused, go, simNow });

  // One critical-fault haptic per interrupted session (§7.6 row 7).
  const faultId = phase === 'fault' ? (followed?.id ?? null) : null;
  useEffect(() => {
    if (faultId === null || buzzedSessions.has(faultId)) return;
    buzzedSessions.add(faultId);
    triggerHaptic('criticalFault');
  }, [faultId]);

  // Acknowledge: the ring settles on READY over its 600 ms morph (simulator clock), then Home.
  const [acknowledgedAt, setAcknowledgedAt] = useState<number | null>(null);
  const settled = useAckSettled(acknowledgedAt);
  useEffect(() => {
    if (settled && focused) go('/home', 'acknowledge');
  }, [settled, focused, go]);

  const onAcknowledge = useCallback(() => {
    actions.acknowledgeAlerts(followed?.faultKind ?? null, followed?.faultAt ?? null);
    reportRuntimeIssue('info', 'features.sessionRecovery.acknowledge', 'Recovery outcome acknowledged', {
      sessionId: followed?.id ?? null,
      outcome: outcomeData.outcome,
    });
    if (settings.policy === 'reduced') {
      go('/home', 'acknowledge');
      return;
    }
    setAcknowledgedAt(simNow());
  }, [actions, followed, outcomeData.outcome, settings.policy, go, simNow]);

  const onViewEvidence = useCallback(() => {
    if (!outcomeData.evidenceId || !actions.canOpenEvidence()) return;
    go(`/evidence/${outcomeData.evidenceId}` as Href, 'viewEvidence', 'push');
  }, [actions, outcomeData.evidenceId, go]);

  const sideBySide = layoutClass === 'expanded';
  const maxWidth = CARD_MAX_WIDTH[layoutClass];

  let body: ReactNode;
  if (phase === 'idle' || phase === 'other' || followed === null) {
    const resume = phase === 'other' ? sessionResyncHref(liveState, { sessionId: followed?.id ?? null }) : null;
    body = (
      <NoticeCard
        testID={`recovery-${phase}`}
        title={t(phase === 'other' ? 'features.session-recovery.notInterrupted.title' : 'features.session-recovery.idle.title')}
        body={t(phase === 'other' ? 'features.session-recovery.notInterrupted.body' : 'features.session-recovery.idle.body')}
        actionLabel={t(resume ? 'features.session-recovery.actions.returnToSession' : 'features.session-recovery.actions.goHome')}
        onAction={() => go((resume ?? '/home') as Href, 'notice')}
      />
    );
  } else {
    const analysis = analysisOf(followed);
    body = (
      <View style={[styles.cards, sideBySide ? styles.cardsRow : null]}>
        <View style={sideBySide ? styles.mainColumn : styles.fullWidth}>
          <RecoveryBoundary name="status">
            <StatusCard
              inputs={followed}
              phase={phase}
              milestone={milestone}
              analysis={analysis}
              outcome={outcome}
              acknowledged={acknowledgedAt !== null}
              ringPaused={!focused}
              canStart={canStartRecovery(role)}
              roleLabel={role ? t(`common.roles.${role}`) : '—'}
              onStart={actions.start}
              onHome={() => go('/home', 'home')}
            />
          </RecoveryBoundary>
          {phase === 'complete' && outcome !== null ? (
            <RecoveryBoundary name="outcome">
              <OutcomeCard
                outcome={outcome}
                data={outcomeData}
                acknowledging={acknowledgedAt !== null}
                onAcknowledge={onAcknowledge}
                onViewEvidence={onViewEvidence}
              />
            </RecoveryBoundary>
          ) : null}
        </View>
        <View style={sideBySide ? styles.sideColumn : styles.fullWidth}>
          <RecoveryBoundary name="details">
            <DetailsCard inputs={followed} phase={phase} milestone={milestone} analysis={analysis} />
          </RecoveryBoundary>
        </View>
      </View>
    );
  }

  return (
    <SafeScreen id="session-recovery">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.centre, maxWidth !== undefined ? { maxWidth: sideBySide ? maxWidth + SIDE_WIDTH + spacing[4] : maxWidth } : null]}>
          {body}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

// ---------------------------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------------------------

type Navigate = (href: Href, reason: string, mode?: 'replace' | 'push') => void;

/** `router.replace` (or `push`) with the failure written to the persistent runtime log (never swallowed). */
function useNavigate(): Navigate {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useCallback(
    (href: Href, reason: string, mode: 'replace' | 'push' = 'replace') => {
      try {
        if (mode === 'push') router.push(href);
        else router.replace(href);
      } catch (error) {
        toast.show({ variant: 'danger', label: t('features.session-recovery.actions.failed') });
        reportRuntimeIssue('error', `features.sessionRecovery.navigate.${reason}`, error, { to: String(href) });
      }
    },
    [router, toast, t],
  );
}

interface RecoveryBackOptions {
  busy: boolean;
  focused: boolean;
  go: Navigate;
  simNow: () => number;
}

/**
 * While the analysis runs a hardware Back is consumed with a calm toast (no dialog; the 3 s pass by
 * themselves). Otherwise Back pops when a route sits below; with none (after the route sync's
 * replace) it goes Home instead of leaving the app (F-79-1).
 */
function useRecoveryBack({ busy, focused, go, simNow }: RecoveryBackOptions): void {
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const lastToastAt = useRef<number | null>(null);

  useEffect(() => {
    if (!focused) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) {
        const now = simNow();
        if (lastToastAt.current === null || now - lastToastAt.current >= BLOCKED_TOAST_GAP_MS) {
          lastToastAt.current = now;
          toast.show({ variant: 'default', label: t('features.session-recovery.actions.busy') });
        }
        return true;
      }
      if (router.canGoBack()) return false;
      go('/home', 'back');
      return true;
    });
    return () => subscription.remove();
  }, [focused, busy, router, toast, t, go, simNow]);
}

// ---------------------------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------------------------

interface StatusCardProps {
  inputs: RecoveryInputs;
  phase: RecoveryPhase;
  milestone: number;
  analysis: RecoveryAnalysis;
  outcome: RecoveryOutcomeKind | null;
  acknowledged: boolean;
  ringPaused: boolean;
  canStart: boolean;
  roleLabel: string;
  onStart: () => void;
  onHome: () => void;
}

function StatusCard({
  inputs,
  phase,
  milestone,
  analysis,
  outcome,
  acknowledged,
  ringPaused,
  canStart,
  roleLabel,
  onStart,
  onHome,
}: StatusCardProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const ringRunning = useAmbientLoop('recovery-ring', { paused: ringPaused });
  const ringState = ringStateFor(phase, outcome, acknowledged);
  const RingIcon = ringState === 'ready' ? ShieldCheck : ringState === 'critical' ? ShieldAlert : ShieldEllipsis;
  const ringIconColor = ringState === 'ready' ? statusText.success : ringState === 'critical' ? statusText.danger : statusText.warning;
  const stage = stageFor(milestone);

  return (
    <Animated.View entering={enterRise(0, settings)}>
      <Pane name="recovery">
        <SectionCard testID="recovery-card">
          <View style={styles.head}>
            <View testID="recovery-ring" accessibilityLabel={t(`features.session-recovery.title`)}>
              <GlowRing mode="mini" size={RING_SIZE} state={ringState} motion={settings.policy} paused={!ringRunning}>
                <RingIcon size={28} color={ringIconColor} />
              </GlowRing>
            </View>
            <View style={styles.headText}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title} testID="recovery-title">
                {t('features.session-recovery.title')}
              </Text>
              <Text maxFontSizeMultiplier={1.2} selectable style={styles.sessionId} testID="recovery-session-id">
                {inputs.id}
              </Text>
              <StateChip phase={phase} outcome={outcome} />
            </View>
          </View>

          {phase === 'fault' ? <FaultAlert inputs={inputs} /> : null}
          {phase === 'analysing' ? (
            <View style={styles.alert} testID="recovery-analysing">
              <Alert status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t('features.session-recovery.analysing.title')}</Alert.Title>
                  <Alert.Description>{t('features.session-recovery.analysing.body')}</Alert.Description>
                </Alert.Content>
              </Alert>
            </View>
          ) : null}

          {phase === 'analysing' ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.caption} accessibilityLiveRegion="polite" testID="recovery-stage">
              {t('features.session-recovery.stage', {
                stage: t(`common.enums.bootRecoveryState.${stage}`),
                current: stage === 'RECOVERY_SCAN' ? 1 : 2,
                total: 2,
              })}
            </Text>
          ) : null}

          <View accessibilityLabel={t('session.recovery.stagesLabel')}>
            <RecoveryPipeline phase={phase} milestone={milestone} analysis={analysis} />
          </View>

          {phase === 'fault' ? (
            <View style={styles.actions}>
              <Button testID="recovery-start" variant="primary" size="lg" onPress={onStart}>
                <Button.Label>{t('features.session-recovery.actions.start')}</Button.Label>
              </Button>
              <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="recovery-start-hint">
                {canStart
                  ? t('features.session-recovery.actions.startHint')
                  : t('features.session-recovery.actions.needsRole', { role: roleLabel })}
              </Text>
              <Button testID="recovery-home" variant="outline" size="lg" onPress={onHome}>
                <Button.Label>{t('features.session-recovery.actions.goHome')}</Button.Label>
              </Button>
            </View>
          ) : null}
        </SectionCard>
      </Pane>
    </Animated.View>
  );
}

function StateChip({ phase, outcome }: { phase: RecoveryPhase; outcome: RecoveryOutcomeKind | null }) {
  const { t } = useTranslation();
  if (phase === 'fault') {
    return <StatusChip testID="recovery-state-chip" size="sm" tone="danger" icon={TriangleAlert} label={t('common.enums.sessionState.FAULT')} />;
  }
  if (phase === 'analysing') {
    return <StatusChip testID="recovery-state-chip" size="sm" tone="warning" icon={null} label={t('common.enums.sessionState.RECOVERY')} />;
  }
  if (outcome === 'recovered') {
    return <StatusChip testID="recovery-state-chip" size="sm" tone="sealed" icon={BadgeCheck} label={t('features.session-recovery.outcome.recoveredChip')} />;
  }
  return <StatusChip testID="recovery-state-chip" size="sm" tone="warning" icon={TriangleAlert} label={t('features.session-recovery.outcome.incompleteChip')} />;
}

/**
 * The danger Alert naming the fault. Calm escalation (03M P7, R8): ONE red glow pulse when it
 * appears (600 ms, `totalMs` passed explicitly per D73 F74-02), then a steady colour; reduced motion
 * shows the steady colour only.
 */
function FaultAlert({ inputs }: { inputs: RecoveryInputs }) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.set(animatePulseOnce(1, 0, settings, SPEC_LITERALS.escalationPulseMs));
  }, [glow, settings, inputs.id]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  const fault = inputs.faultKind ? t(`common.faultKind.${inputs.faultKind}`) : t('features.session-recovery.fault.unknownFault');
  const body =
    inputs.startedAt === null
      ? t('features.session-recovery.fault.noRecording')
      : t('features.session-recovery.fault.body', { time: formatClock(inputs.faultAt) });
  return (
    <Animated.View entering={enterRise(1, settings)} style={styles.alert} testID="recovery-fault">
      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, styles.alertGlow, glowStyle]}
      />
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('features.session-recovery.fault.title', { fault })}</Alert.Title>
          <Alert.Description>{body}</Alert.Description>
        </Alert.Content>
      </Alert>
    </Animated.View>
  );
}

interface OutcomeCardProps {
  outcome: RecoveryOutcomeKind;
  data: RecoveryOutcomeData;
  acknowledging: boolean;
  onAcknowledge: () => void;
  onViewEvidence: () => void;
}

function OutcomeCard({ outcome, data, acknowledging, onAcknowledge, onViewEvidence }: OutcomeCardProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const size = sizeParts(data.sizeBytes);
  const recovered = outcome === 'recovered';
  const items: KeyValueItem[] = [
    {
      id: 'evidence',
      label: t('features.session-recovery.outcome.evidence'),
      value: data.evidenceId
        ? recovered
          ? data.evidenceId
          : t('features.session-recovery.outcome.evidenceUnsealed', { id: data.evidenceId })
        : t('features.session-recovery.outcome.noEvidence'),
      mono: data.evidenceId !== null,
      testID: 'recovery-outcome-evidence',
    },
    {
      id: 'duration',
      label: t('features.session-recovery.outcome.duration'),
      value: formatDuration(data.durationMs),
      mono: true,
      testID: 'recovery-outcome-duration',
    },
    {
      id: 'size',
      label: t('features.session-recovery.outcome.size'),
      value: t(`common.units.${size.unit}`, { value: size.value }),
      testID: 'recovery-outcome-size',
    },
  ];
  if (recovered) {
    items.push({
      id: 'signature',
      label: t('features.session-recovery.outcome.signature'),
      value: `${shortValue(data.signature)} · ${t('common.simulated.chip')}`,
      mono: true,
      testID: 'recovery-outcome-signature',
    });
  }

  return (
    <Animated.View entering={enterRise(1, settings)}>
      <Pane name="recovery-outcome">
        <SectionCard
          testID="recovery-outcome"
          title={t('features.session-recovery.outcome.title')}
          action={
            recovered ? (
              <StatusChip tone="sealed" icon={BadgeCheck} label={t('features.session-recovery.outcome.recoveredChip')} />
            ) : (
              <StatusChip tone="warning" icon={TriangleAlert} label={t('features.session-recovery.outcome.incompleteChip')} />
            )
          }
        >
          <Text maxFontSizeMultiplier={1.2} style={styles.body} accessibilityLiveRegion="polite" testID="recovery-outcome-line">
            {recovered ? t('features.session-recovery.outcome.recoveredBody') : t('session.recovery.incomplete')}
          </Text>
          <KeyValueList items={items} />
          <View style={styles.actions}>
            <Button testID="recovery-acknowledge" variant="primary" size="lg" isDisabled={acknowledging} onPress={onAcknowledge}>
              <Button.Label>{t('features.session-recovery.outcome.acknowledge')}</Button.Label>
            </Button>
            {data.evidenceId ? (
              <Button testID="recovery-view-evidence" variant="outline" size="lg" onPress={onViewEvidence}>
                <Button.Label>{t('features.session-recovery.outcome.viewEvidence')}</Button.Label>
              </Button>
            ) : null}
          </View>
        </SectionCard>
      </Pane>
    </Animated.View>
  );
}

interface DetailsCardProps {
  inputs: RecoveryInputs;
  phase: RecoveryPhase;
  milestone: number;
  analysis: RecoveryAnalysis;
}

/** Milestones after which the segment and time-source rows show their finding. */
const SEGMENT_KNOWN_AT = 6;
const TIME_KNOWN_AT = 7;

function DetailsCard({ inputs, phase, milestone, analysis }: DetailsCardProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const passed = phase === 'complete' ? Number.POSITIVE_INFINITY : phase === 'analysing' ? milestone : -1;
  const pending = t('features.session-recovery.details.pending');
  const { segment, time } = analysis;
  const segmentValue =
    passed < SEGMENT_KNOWN_AT
      ? pending
      : segment.endsAt === null
        ? t('features.session-recovery.stepDetail.segmentNone')
        : t(
            segment.basis === 'autosave'
              ? 'features.session-recovery.details.lastSegmentBasisAutosave'
              : 'features.session-recovery.details.lastSegmentBasisStart',
            { time: formatClock(segment.endsAt) },
          );
  const timeValue =
    passed < TIME_KNOWN_AT
      ? pending
      : time.to === null
        ? t('features.session-recovery.details.timeLocked', { source: time.from })
        : t('features.session-recovery.details.timeFallback', { to: time.to, time: formatClock(time.at) });

  const items: KeyValueItem[] = [
    { id: 'case', label: t('features.session-recovery.details.caseNumber'), value: inputs.caseNumber, mono: true, testID: 'recovery-case' },
    {
      id: 'subject',
      label: t('features.session-recovery.details.subject'),
      value: (
        <View style={styles.subject}>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.value}>
            {inputs.subjectName}
          </Text>
          <SubjectTypeChip type={inputs.subjectType} size="sm" />
        </View>
      ),
      testID: 'recovery-subject',
    },
    { id: 'room', label: t('features.session-recovery.details.room'), value: inputs.room, testID: 'recovery-room' },
    {
      id: 'interruptedAt',
      label: t('features.session-recovery.details.interruptedAt'),
      value: formatClock(inputs.faultAt),
      mono: true,
      testID: 'recovery-interrupted-at',
    },
    {
      id: 'fromState',
      label: t('features.session-recovery.details.fromState'),
      value: inputs.fromState ? t(`common.enums.sessionState.${inputs.fromState}`) : '—',
      testID: 'recovery-from-state',
    },
    { id: 'segment', label: t('features.session-recovery.details.lastSegment'), value: segmentValue, mono: passed >= SEGMENT_KNOWN_AT, testID: 'recovery-segment' },
    { id: 'time', label: t('features.session-recovery.details.timeSource'), value: timeValue, testID: 'recovery-time-source' },
  ];

  return (
    <Animated.View entering={enterRise(2, settings)}>
      <Pane name="recovery-details">
        <SectionCard testID="recovery-details" title={t('features.session-recovery.details.title')}>
          <Text maxFontSizeMultiplier={1.2} style={styles.sectionLabel}>
            {t('features.session-recovery.details.tracksTitle')}
          </Text>
          <TrackRows phase={phase} milestone={milestone} tracks={analysis.tracks} />
          <KeyValueList items={items} />
        </SectionCard>
      </Pane>
    </Animated.View>
  );
}

interface NoticeCardProps {
  testID: string;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}

function NoticeCard({ testID, title, body, actionLabel, onAction }: NoticeCardProps) {
  const settings = useMotionSettings();
  return (
    <Animated.View entering={enterRise(0, settings)}>
      <SectionCard testID={testID}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.body}>
          {body}
        </Text>
        <Button testID={`${testID}-action`} variant="primary" size="lg" onPress={onAction}>
          <Button.Label>{actionLabel}</Button.Label>
        </Button>
      </SectionCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing[3] },
  centre: { width: '100%', alignSelf: 'center' },
  cards: { gap: spacing[3] },
  cardsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[4] },
  mainColumn: { flex: 1, minWidth: 0, gap: spacing[3] },
  sideColumn: { width: SIDE_WIDTH },
  fullWidth: { alignSelf: 'stretch', gap: spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headText: { flex: 1, minWidth: 0, gap: spacing[0], alignItems: 'flex-start' },
  title: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  sessionId: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.gray,
  },
  body: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  caption: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
  sectionLabel: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  actions: { gap: spacing[1] },
  alert: { alignSelf: 'stretch' },
  alertGlow: { borderRadius: 12, boxShadow: glowShadow(3, 'danger') },
  subject: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexShrink: 1 },
  value: {
    flexShrink: 1,
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
});
