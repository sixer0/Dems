/**
 * Session Summary (04_mobile_specs §4.7; book §5.2 step 10, §11.3) at `/session/summary/[sessionId]`;
 * step 80 (05_mobile_plan M-11 part a). Replaces step 70's stub; the export name, the props and the
 * `SafeScreen id="session-summary"` root stay (T-M02, MA-04).
 *
 * Regions:
 * - Hero: the violet SEALED stamp (M-C-09: scale 1.2 → 1 `bouncy`, e3 glow flash, hairline ring,
 *   haptic Success; it plays once per session on the first sight of an unacknowledged summary, F-80-1),
 *   the session ID (mono, h2), case and subject chip, "Sealed hh:mm:ss".
 * - Details: `KeyValueList` with Case, Subject + `SubjectTypeChip`, Investigator, Room, Start and End
 *   (each with its time-source badge, S29; SIM-GAP-M80-1), Duration, Size, Evidence ID.
 * - Hashes: the four per-track SHA-256 values (VIDEO-01/02, AUDIO-01/02; short form), the manifest
 *   hash and the signature marked SIMULATED; a tap opens the full value in a BottomSheet.
 * - Finalization: the finished C-4 pipeline with its step durations ("Sealed 8.7 s after the
 *   recording ended"), while this is still the simulator's current session.
 * - Lifecycle: C-4 horizontal over §19.1, current stage SEALED LOCAL EVIDENCE.
 * - Actions: "View in Evidence" (primary) and "Done" (outline). Both acknowledge the summary once
 *   (SCR-02 `acknowledgeSummary`); Back does the same and returns Home (§3.6).
 *
 * Layout (04 §2.4, D17): phone portrait stacks the regions with the actions pinned at the bottom;
 * phone landscape centres a 560 dp column; tablets put the summary and the pipeline side by side
 * (`pane-finalization` | `pane-summary`). Past sessions (already acknowledged, or not the last
 * sealed one) render the same view without the stamp or an acknowledgement.
 *
 * Live mode (backend task, plan row W72; 04_client_integration_spec §8.6 S2-4, §8.1 LB-1): every
 * region reads the Core's replicated state. Done, View in Evidence and Back each send the
 * acknowledgement through `useAcknowledgeSummary` and navigate only once the Core answered (in `ok`);
 * each is a pending control (`usePendingPress` of the runtime: busy at the press, the kit's spinner
 * after the reveal delay), and one request is out at a time. While the summary still waits for the
 * acknowledgement and the Core link is down, the runtime's one link notice (`useCoreLinkNotice`) says
 * why the buttons cannot finish. Nothing is sent on mount (decision D158, F69-1). The signature keeps
 * its SIMULATED chip in both modes: the contract itself calls it a simulated signature
 * (`packages/shared/src/api/state-slices.ts`, the evidence `signature`; decision D158 DC-4).
 */
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { Alert, Button, Chip, PressableFeedback, useToast } from 'heroui-native';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import { formatDuration } from '@dems/shared/sim';
import { derived, fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { Stepper, type StepDef, type StepStatusWords } from '@/components/composed/stepper';
import { KeyValueList, SectionCard, StatusChip, SubjectTypeChip, type KeyValueItem } from '@/components/kit';
import { Pane, SafeScreen, useLayoutClass, type LayoutClass } from '@/layout';
import { enterRise, useMotionSettings, type MotionSettings } from '@/motion';
import { PendingSpinner, busyState, reportRuntimeIssue, useCoreLinkNotice, usePendingPress, type PendingPress } from '@/runtime';
import { FinalizationPipeline } from '@/features/session-finalizing/finalization-pipeline';
import { pipelineSeconds, pipelineStatuses, sealedAfterSeconds } from '@/features/session-finalizing/finalizing.model';
import { FlowBoundary } from '@/features/session-finalizing/flow-boundary';
import { SealedStamp } from '@/features/session-finalizing/sealed-stamp';
import { HashSheet, type HashSheetValue } from './hash-sheet';
import { hasStamped, markStamped } from './stamp-once';
import { isSummaryHandoff } from './summary-handoff';
import { SealedMembersCard } from './sealed-members';
import { LIFECYCLE_STAGES, lifecycleStatuses, orderedTracks, shortHash, sizeParts, summaryAvailability } from './summary.model';
import {
  useAcknowledgeSummary,
  useSummaryEvidence,
  useSummaryFinalization,
  useSummarySession,
  type SummaryEvidence,
  type SummaryFinalization,
  type SummarySession,
} from './use-summary';

export interface SessionSummaryScreenProps {
  /** Validated session id from the path (`recordIdSchema`). */
  readonly sessionId: string;
  /** Drawn in place by `/session/finalizing` at the seal (CF2-A, RF-PH-3): no enter rise. */
  readonly handover?: boolean;
}

/** 04 §2.4: one centred column per class; tablets go two-pane. */
const COLUMN_MAX_WIDTH: Readonly<Record<LayoutClass, number | undefined>> = {
  compact: undefined,
  'compact-landscape': 560,
  medium: undefined,
  expanded: 1120,
};
const LIFECYCLE_STEP_WIDTH = 92;

export function SessionSummaryScreen({ sessionId, handover = false }: SessionSummaryScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const focused = useIsFocused();
  const { layoutClass } = useLayoutClass();
  const session = useSummarySession(sessionId);
  const evidence = useSummaryEvidence(sessionId);
  const finalization = useSummaryFinalization(sessionId);
  const acknowledge = useAcknowledgeSummary(sessionId);
  const backPress = usePendingPress();
  const donePress = usePendingPress();
  const evidencePress = usePendingPress();
  const { offline: linkDown } = useCoreLinkNotice();
  const [sheet, setSheet] = useState<HashSheetValue | null>(null);

  // The stamp plays on the first sight of an unacknowledged summary, once per session (F-80-1).
  const [playStamp] = useState(() => session.pending && !hasStamped(sessionId));
  // CF2-A (RF-PH-3): opened by the sealed hand-off, the cards are drawn in place (no rise from opacity 0).
  const [enter] = useState(() => !handover && !isSummaryHandoff(sessionId));
  useEffect(() => {
    if (playStamp) markStamped(sessionId);
  }, [playStamp, sessionId]);

  const navigate = useCallback(
    (href: Href, kind: 'home' | 'evidence' | 'finalizing') => {
      try {
        if (kind === 'home') router.dismissTo(href);
        else router.replace(href);
      } catch (error) {
        toast.show({ variant: 'danger', label: t('features.session-summary.actions.navigateFailed') });
        reportRuntimeIssue('error', `features.sessionSummary.navigate.${kind}`, error, { sessionId });
      }
    },
    [router, toast, t, sessionId],
  );

  // S2-4: each control acknowledges, then navigates in `ok`; its pending state is released in `done`.
  const onDone = useCallback(() => {
    donePress.run((release) => acknowledge({ ok: () => navigate('/home', 'home'), done: release }));
  }, [donePress, acknowledge, navigate]);
  const onBack = useCallback(() => {
    backPress.run((release) => acknowledge({ ok: () => navigate('/home', 'home'), done: release }));
  }, [backPress, acknowledge, navigate]);
  const onViewEvidence = useCallback(() => {
    if (!evidence) return;
    const href = `/evidence/${evidence.id}` as Href;
    evidencePress.run((release) => acknowledge({ ok: () => navigate(href, 'evidence'), done: release }));
  }, [evidencePress, acknowledge, navigate, evidence]);

  // §3.6: Back is allowed here; it acknowledges the summary and returns Home (and never leaves the
  // app when the summary is the only route, F-79-1). While an acknowledgement is out, Back is
  // consumed and sends nothing more (`useAcknowledgeSummary` keeps one request at a time).
  useEffect(() => {
    if (!focused) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet !== null) {
        setSheet(null);
        return true;
      }
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [focused, sheet, onBack]);

  const availability = summaryAvailability(session.found, session.activeId, session.activeState, sessionId);
  const twoPane = layoutClass === 'medium' || layoutClass === 'expanded';
  const maxWidth = COLUMN_MAX_WIDTH[layoutClass];

  const header = <SummaryHeader onBack={onBack} press={backPress} large={twoPane} />;

  if (availability !== 'summary') {
    const finalizing = availability === 'finalizing';
    return (
      <SafeScreen id="session-summary">
        {header}
        <ScrollView contentContainerStyle={styles.noticeScroll}>
          <View style={[styles.centre, { maxWidth: 560 }]}>
            <SectionCard testID={finalizing ? 'summary-still-finalizing' : 'summary-not-found'}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.h3}>
                {t(finalizing ? 'features.session-summary.stillFinalizing.title' : 'features.session-summary.notFound.title')}
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.body}>
                {finalizing ? t('features.session-summary.stillFinalizing.body') : t('features.session-summary.notFound.body', { sessionId })}
              </Text>
              <Button
                testID="summary-notice-action"
                variant="primary"
                size="lg"
                onPress={() => (finalizing ? navigate('/session/finalizing', 'finalizing') : navigate('/home', 'home'))}
              >
                <Button.Label>{t(finalizing ? 'features.session-summary.stillFinalizing.open' : 'features.session-summary.goHome')}</Button.Label>
              </Button>
            </SectionCard>
          </View>
        </ScrollView>
      </SafeScreen>
    );
  }

  const openHash = (value: HashSheetValue) => setSheet(value);
  const hero = <HeroCard sessionId={sessionId} session={session} evidence={evidence} playStamp={playStamp} index={enter ? 0 : null} />;
  const details = <DetailsCard session={session} evidence={evidence} index={enter ? 1 : null} />;
  const hashes = (
    <>
      <HashesCard evidence={evidence} onOpen={openHash} index={enter ? 2 : null} />
      {/* Row 92 (MB-05): the sealed members of a schema-v2 item; nothing for a v1 item. */}
      <SealedMembersCard sessionId={sessionId} onOpen={openHash} />
    </>
  );
  const pipeline = finalization ? <FinalizationCard finalization={finalization} index={enter ? (twoPane ? 1 : 3) : null} /> : null;
  // Row 87 (B9 = FXR-DEV-2, MB-05): every copy that is part of the sealed hand-over (the in-place copy and the
  // route's copy after it, `enter` false) draws its Steppers from React alone, like the Finalizing screen.
  const lifecycle = evidence ? <LifecycleCard stage={evidence.lifecycleStage} index={enter ? (twoPane ? 2 : 4) : null} animate={enter} /> : null;
  const actions = (
    <SummaryActions
      canViewEvidence={evidence !== null}
      acknowledging={session.pending}
      onViewEvidence={onViewEvidence}
      onDone={onDone}
      donePress={donePress}
      evidencePress={evidencePress}
      linkDown={linkDown && session.pending}
      wide={twoPane}
    />
  );

  return (
    <SafeScreen id="session-summary">
      {header}
      {twoPane ? (
        <ScrollView contentContainerStyle={styles.tabletScroll}>
          <View style={[styles.twoPane, maxWidth !== undefined ? { maxWidth } : null, styles.centre]}>
            <View style={layoutClass === 'expanded' ? styles.leftPaneExpanded : styles.leftPaneMedium}>
              <Pane name="finalization">
                <View style={styles.stack}>
                  <Boundary name="hero">{hero}</Boundary>
                  {pipeline ? <Boundary name="pipeline">{pipeline}</Boundary> : null}
                  {lifecycle ? <Boundary name="lifecycle">{lifecycle}</Boundary> : null}
                </View>
              </Pane>
            </View>
            <View style={styles.rightPane}>
              <Pane name="summary">
                <View style={styles.stack}>
                  <Boundary name="details">{details}</Boundary>
                  <Boundary name="hashes">{hashes}</Boundary>
                  {actions}
                </View>
              </Pane>
            </View>
          </View>
        </ScrollView>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.phoneScroll}>
            <View style={[styles.centre, maxWidth !== undefined ? { maxWidth } : null]}>
              <Pane name="summary">
                <View style={styles.stack}>
                  <Boundary name="hero">{hero}</Boundary>
                  <Boundary name="details">{details}</Boundary>
                  <Boundary name="hashes">{hashes}</Boundary>
                  {pipeline ? <Boundary name="pipeline">{pipeline}</Boundary> : null}
                  {lifecycle ? <Boundary name="lifecycle">{lifecycle}</Boundary> : null}
                </View>
              </Pane>
            </View>
          </ScrollView>
          <View style={[styles.pinned, maxWidth !== undefined ? { maxWidth, alignSelf: 'center', width: '100%' } : null]}>{actions}</View>
        </>
      )}
      <HashSheet value={sheet} onClose={() => setSheet(null)} />
    </SafeScreen>
  );
}

/** The card's enter rise, or none (`null`: opened by the sealed hand-off, CF2-A RF-PH-3). */
function riseAt(index: number | null, settings: MotionSettings) {
  return index === null ? undefined : enterRise(index, settings);
}

function Boundary({ name, children }: { name: string; children: ReactNode }) {
  return (
    <FlowBoundary scope="session-summary" name={name}>
      {children}
    </FlowBoundary>
  );
}

// ---------------------------------------------------------------------------------------------
// Header and actions
// ---------------------------------------------------------------------------------------------

function SummaryHeader({ onBack, press, large }: { onBack: () => void; press: PendingPress; large: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.header, large ? styles.headerLarge : null]} testID="summary-header">
      <Button
        testID="summary-back"
        isIconOnly
        size="lg"
        variant="ghost"
        onPress={onBack}
        accessibilityLabel={t('features.session-summary.back')}
        {...busyState(press.busy)}
      >
        {press.pending ? <PendingSpinner color={palette.gold} testID="summary-back-spinner" /> : <ArrowLeft size={24} color={palette.gold} />}
      </Button>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} numberOfLines={1} style={large ? styles.titleLarge : styles.title}>
        {t('features.session-summary.title')}
      </Text>
    </View>
  );
}

interface SummaryActionsProps {
  canViewEvidence: boolean;
  /** The buttons acknowledge the summary (screen-reader hint). */
  acknowledging: boolean;
  onViewEvidence: () => void;
  onDone: () => void;
  donePress: PendingPress;
  evidencePress: PendingPress;
  /** LIVE only: the summary waits for the acknowledgement and the Core link is down (`useCoreLinkNotice`). */
  linkDown: boolean;
  wide: boolean;
}

function SummaryActions({ canViewEvidence, acknowledging, onViewEvidence, onDone, donePress, evidencePress, linkDown, wide }: SummaryActionsProps) {
  const { t } = useTranslation();
  const hint = acknowledging ? t('features.session-summary.actions.acknowledgeHint') : undefined;
  const buttons = (
    <View style={[styles.actions, wide ? styles.actionsWide : null]} testID="summary-actions">
      <Button testID="summary-done" variant="outline" size="lg" onPress={onDone} accessibilityHint={hint} style={styles.doneButton} {...busyState(donePress.busy)}>
        {donePress.pending ? <PendingSpinner testID="summary-done-spinner" /> : null}
        <Button.Label numberOfLines={1}>{t('common.actions.done')}</Button.Label>
      </Button>
      {canViewEvidence ? (
        <Button
          testID="summary-view-evidence"
          variant="primary"
          size="lg"
          onPress={onViewEvidence}
          accessibilityHint={hint}
          style={styles.evidenceButton}
          {...busyState(evidencePress.busy)}
        >
          {evidencePress.pending ? <PendingSpinner color={palette.black} testID="summary-view-evidence-spinner" /> : null}
          <Button.Label numberOfLines={1}>{t('session.finalization.viewEvidence')}</Button.Label>
        </Button>
      ) : null}
    </View>
  );
  if (!linkDown) return buttons;
  return (
    <View style={styles.actionsColumn}>
      <Alert status="warning" testID="summary-link-down">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('features.session-summary.live.linkDownTitle')}</Alert.Title>
          <Alert.Description>{t('features.session-summary.live.linkDownBody')}</Alert.Description>
        </Alert.Content>
      </Alert>
      {buttons}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------------------------

interface HeroCardProps {
  sessionId: string;
  session: SummarySession;
  evidence: SummaryEvidence | null;
  playStamp: boolean;
  index: number | null;
}

function HeroCard({ sessionId, session, evidence, playStamp, index }: HeroCardProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const sealed = session.outcome === 'SEALED';
  return (
    <Animated.View entering={riseAt(index, settings)}>
      <SectionCard testID="summary-hero">
        {sealed ? (
          <SealedStamp
            play={playStamp}
            label={t('session.finalization.sealed')}
            accessibilityLabel={t('features.session-summary.stampLabel')}
            testID="summary-sealed"
          />
        ) : (
          <StatusChip tone="warning" icon="TriangleAlert" label={t('features.session-summary.incomplete.chip')} size="lg" testID="summary-incomplete" />
        )}
        <Text selectable maxFontSizeMultiplier={1.2} style={styles.sessionId} testID="summary-session-id">
          {sessionId}
        </Text>
        <View style={styles.heroLine}>
          <Text maxFontSizeMultiplier={1.2} style={styles.mono}>
            {session.caseNumber ?? '—'}
          </Text>
          {session.subjectType ? <SubjectTypeChip type={session.subjectType} size="sm" testID="summary-subject-chip" /> : null}
        </View>
        {sealed && evidence?.sealedAt != null ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="summary-sealed-at">
            {t('features.session-summary.sealedAt', { time: formatDate(evidence.sealedAt, DATE_PATTERNS.dateTime) })}
          </Text>
        ) : null}
        {!sealed ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.body}>
            {t('features.session-summary.incomplete.body')}
          </Text>
        ) : null}
      </SectionCard>
    </Animated.View>
  );
}

function TimeValue({ at, source, testID }: { at: number | null; source: string | null; testID: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.timeValue} testID={testID}>
      <Text maxFontSizeMultiplier={1.2} style={styles.mono}>
        {at === null ? '—' : formatDate(at, DATE_PATTERNS.dateTime)}
      </Text>
      {source ? (
        <Chip size="sm" variant="soft" color="success" accessibilityLabel={t('features.session-summary.fields.timeSource', { source })}>
          <Chip.Label>{t(`common.enums.timeSource.${source}`)}</Chip.Label>
        </Chip>
      ) : null}
    </View>
  );
}

function DetailsCard({ session, evidence, index }: { session: SummarySession; evidence: SummaryEvidence | null; index: number | null }) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const size = sizeParts(session.sizeBytes);
  const items: KeyValueItem[] = [
    { id: 'case', label: t('session.details.caseNumber'), value: session.caseNumber ?? '—', mono: true, testID: 'summary-case' },
    {
      id: 'subject',
      label: t('session.details.subject'),
      value: (
        <View style={styles.subject}>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.valueText}>
            {session.subjectName ?? '—'}
          </Text>
          {session.subjectType ? <SubjectTypeChip type={session.subjectType} size="sm" /> : null}
        </View>
      ),
      testID: 'summary-subject',
    },
    { id: 'investigator', label: t('session.details.investigator'), value: session.investigatorName ?? '—', testID: 'summary-investigator' },
    { id: 'room', label: t('session.details.room'), value: session.room ?? '—', testID: 'summary-room' },
    { id: 'start', label: t('session.details.startTime'), value: <TimeValue at={session.startedAt} source={session.startSource} testID="summary-start" /> },
    { id: 'end', label: t('features.session-summary.fields.endTime'), value: <TimeValue at={session.endedAt} source={session.endSource} testID="summary-end" /> },
    { id: 'duration', label: t('session.details.duration'), value: formatDuration(session.durationMs), mono: true, testID: 'summary-duration' },
    { id: 'size', label: t('features.session-summary.fields.size'), value: t(`common.units.${size.unit}`, { value: size.value }), testID: 'summary-size' },
    { id: 'evidence', label: t('session.details.evidenceId'), value: evidence?.id ?? '—', mono: true, testID: 'summary-evidence-id' },
  ];
  return (
    <Animated.View entering={riseAt(index, settings)}>
      <SectionCard title={t('features.session-summary.sections.details')} testID="summary-details">
        <KeyValueList items={items} />
      </SectionCard>
    </Animated.View>
  );
}

interface HashRowProps {
  label: string;
  /** Screen-reader name of the row ("VIDEO-01 · Camera 1"). */
  name: string;
  value: string;
  trailing?: ReactNode;
  onPress: () => void;
  testID: string;
}

function HashRow({ label, name, value, trailing, onPress, testID }: HashRowProps) {
  const { t } = useTranslation();
  return (
    <PressableFeedback
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${shortHash(value)}`}
      accessibilityHint={t('features.session-summary.hashes.open', { label: name })}
      style={styles.hashRow}
    >
      <View style={styles.hashLabel}>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.hashLabelText}>
          {label}
        </Text>
        {trailing}
      </View>
      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.hashValue}>
        {shortHash(value)}
      </Text>
      <ChevronRight size={16} color={palette.gray} />
    </PressableFeedback>
  );
}

function HashesCard({ evidence, onOpen, index }: { evidence: SummaryEvidence | null; onOpen: (value: HashSheetValue) => void; index: number | null }) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  if (!evidence) {
    return (
      <Animated.View entering={riseAt(index, settings)}>
        <SectionCard title={t('features.session-summary.sections.hashes')} testID="summary-hashes">
          <Text maxFontSizeMultiplier={1.2} style={styles.body}>
            {t('features.session-summary.hashes.noEvidence')}
          </Text>
        </SectionCard>
      </Animated.View>
    );
  }
  const tracks = orderedTracks(evidence.tracks);
  const manifestLabel = t('evidence.detail.integrity.manifestHash');
  const signatureLabel = t('features.session-summary.hashes.signature');
  const simulated = t('common.simulated.chip');
  return (
    <Animated.View entering={riseAt(index, settings)}>
      <SectionCard
        title={t('features.session-summary.sections.hashes')}
        description={t('features.session-summary.hashes.hint')}
        testID="summary-hashes"
      >
        <View>
          {tracks.map((track, i) => {
            const name = t('features.session-summary.hashes.track', { track: track.trackId, name: t(`common.tracks.${track.trackId}`) });
            return (
              <View key={track.trackId}>
                {i > 0 ? <View style={styles.separator} /> : null}
                <HashRow
                  testID={`summary-hash-${track.trackId}`}
                  label={track.trackId}
                  name={name}
                  value={track.sha256}
                  onPress={() => onOpen({ label: name, value: track.sha256 })}
                />
              </View>
            );
          })}
          <View style={styles.separator} />
          <HashRow
            testID="summary-hash-manifest"
            label={manifestLabel}
            name={manifestLabel}
            value={evidence.manifestHash}
            onPress={() => onOpen({ label: manifestLabel, value: evidence.manifestHash })}
          />
          <View style={styles.separator} />
          <HashRow
            testID="summary-hash-signature"
            label={signatureLabel}
            name={`${signatureLabel}, ${simulated}`}
            value={evidence.signatureValue}
            trailing={<StatusChip tone="warning" icon={null} size="sm" label={simulated} testID="summary-signature-simulated" />}
            onPress={() =>
              onOpen({ label: signatureLabel, value: evidence.signatureValue, note: t('features.session-summary.hashes.signatureNote') })
            }
          />
        </View>
      </SectionCard>
    </Animated.View>
  );
}

function FinalizationCard({ finalization, index }: { finalization: SummaryFinalization; index: number | null }) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const statuses = pipelineStatuses(finalization.steps, finalization.sealedAt !== null ? 'sealed' : 'finalizing');
  const sealedIn = sealedAfterSeconds(finalization.stoppedAt, finalization.sealedAt);
  return (
    <Animated.View entering={riseAt(index, settings)}>
      <SectionCard
        title={t('features.session-summary.sections.finalization')}
        {...(sealedIn ? { description: t('session.finalization.sealedIn', { seconds: sealedIn }) } : {})}
        testID="summary-finalization"
      >
        <FinalizationPipeline statuses={statuses} seconds={pipelineSeconds(finalization.steps)} animate={index !== null} testID="summary-pipeline" />
      </SectionCard>
    </Animated.View>
  );
}

/** `animate` false for the copy drawn in place on a hand-over: its Stepper starts no motion (W93-7). */
function LifecycleCard({ stage, index, animate }: { stage: string; index: number | null; animate: boolean }) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const steps: StepDef[] = LIFECYCLE_STAGES.map((key) => ({ key, label: t(`common.enums.evidenceLifecycleStage.${key}`) }));
  const statuses = lifecycleStatuses(stage);
  const words: StepStatusWords = {
    step: t('features.session-summary.stepper.step'),
    of: t('features.session-summary.stepper.of'),
    pending: t('features.session-summary.stepper.pending'),
    active: t('features.session-summary.stepper.active'),
    running: t('features.session-summary.stepper.running'),
    done: t('features.session-summary.stepper.done'),
    warn: t('features.session-summary.stepper.warn'),
    error: t('features.session-summary.stepper.error'),
  };
  // Scroll so the current stage (SEALED LOCAL EVIDENCE, the 8th) is in view on a phone.
  const current = Math.max(0, statuses.indexOf('active'));
  return (
    <Animated.View entering={riseAt(index, settings)}>
      <SectionCard title={t('features.session-summary.sections.lifecycle')} testID="summary-lifecycle">
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: Math.max(0, (current - 1) * LIFECYCLE_STEP_WIDTH), y: 0 }}
        >
          <Stepper
            key={settings.policy === 'reduced' ? statuses.join('|') : 'lifecycle'}
            testID="summary-lifecycle-stepper"
            steps={steps}
            statuses={statuses}
            orientation="horizontal"
            motion={settings.policy}
            animate={animate}
            statusWords={words}
            style={{ width: LIFECYCLE_STEP_WIDTH * steps.length }}
          />
        </ScrollView>
      </SectionCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[1],
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: derived.separator,
  },
  headerLarge: { minHeight: 64 },
  title: {
    flex: 1,
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h3.size,
    lineHeight: typography.h3.lineHeight,
    color: palette.foreground,
  },
  titleLarge: {
    flex: 1,
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  centre: { width: '100%', alignSelf: 'center' },
  noticeScroll: { flexGrow: 1, justifyContent: 'center', padding: spacing[3] },
  phoneScroll: { padding: spacing[3], paddingBottom: spacing[4] },
  tabletScroll: { padding: spacing[4] },
  stack: { gap: spacing[3] },
  twoPane: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[4] },
  leftPaneMedium: { width: 300 },
  leftPaneExpanded: { flex: 2, minWidth: 0 },
  rightPane: { flex: 3, minWidth: 0 },
  pinned: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    borderTopWidth: 1,
    borderTopColor: derived.separator,
    backgroundColor: palette.black,
  },
  actions: { flexDirection: 'row', gap: spacing[2] },
  actionsWide: { justifyContent: 'flex-end' },
  actionsColumn: { gap: spacing[2] },
  // 2 : 3, so "View in Evidence" stays on one line on a 411 dp phone (it wrapped at 1 : 1 on dems_phone).
  doneButton: { flex: 2 },
  evidenceButton: { flex: 3 },
  sessionId: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexWrap: 'wrap' },
  mono: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.foreground,
  },
  h3: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h3.size,
    lineHeight: typography.h3.lineHeight,
    color: palette.foreground,
  },
  body: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: derived.foreground2,
  },
  caption: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
  valueText: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  subject: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing[1], flexShrink: 1 },
  timeValue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing[1], flexWrap: 'wrap' },
  separator: { height: 1, backgroundColor: derived.separator },
  hashRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 48, paddingVertical: spacing[1] },
  hashLabel: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  hashLabelText: {
    flexShrink: 1,
    fontFamily: fontFamily.native.medium,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: derived.foreground2,
  },
  hashValue: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.foreground,
  },
});
