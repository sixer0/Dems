/**
 * Finalization (04_mobile_specs §4.6; module 10; book §12.2) at `/session/finalizing`; step 80
 * (05_mobile_plan M-11 part a). Replaces step 70's stub; the export name and the
 * `SafeScreen id="session-finalizing"` root stay (T-M02, MA-04).
 *
 * After End Session the simulator runs STOPPING (1.5 s) and then the six `FinalizationStep`s at
 * 0.6–1.2 s each (about 8.7 s in all), then SEALED. This screen draws that as a full-screen centred
 * card: title "Finalizing evidence", the session ID in mono, the progress line and the C-4 Stepper
 * `pipeline` (Spinner → check per step, durations as descriptions). A second card carries the
 * session's case, subject, recording length and evidence ID (below on phones, beside on tablet
 * landscape, 04 §2.4 "Card 720 dp + side summary").
 *
 * Hand-off: the runtime's route sync (step 73) replaces this route with
 * `/session/summary/<id>` as soon as the state turns SEALED, so the SEALED stamp lands on the
 * Summary's hero (F-80-1). When that has not happened (a deep link, or the sync was not mounted),
 * this screen shows the sealed chip and opens the Summary itself 1.2 s after the seal, on the
 * simulator clock (04 §4.6).
 *
 * Non-dismissible (§3.6): while STOPPING or FINALIZING a hardware Back is consumed and a toast says
 * "Finalizing — please wait"; there is no back arrow, the stack's back gesture is off for an active
 * session (step 70), and Back never leaves the app mid-session (F-79-1). A fault (FAULT, RECOVERY)
 * turns the running step red once and shows a calm Alert with the way to the Recovery status (P7).
 *
 * Hand-over from the monitor (E-fix row FX-M2; E2E-P-4, E2E-T-4): `/session/live` draws this screen
 * in place (`handover`) in the commit that drops the monitor, so a stop shows no empty frame; that
 * copy and the Finalizing route's copy right after it skip the enter motion (`handover.ts`).
 *
 * Blueprint row 87 (MB-04; UX spec flows 3 and 4; E-13; backlog B9 = FXR-DEV-2):
 * - **Forward-only progress from the Core.** The percent, each step's status and the ETA come from
 *   `useSealingProgress` (`sealing-progress.ts`): a pure function of the finalization states the Core
 *   sent. No timer of this screen moves them; a step drawn DONE stays DONE and the percent never
 *   falls, also when a resumed attempt rewrites a step. Without an ETA from the Core the line says
 *   "Estimating the time left…" and gives no number. A resumed seal (a step at attempt 2 or later)
 *   shows "Resumed after restart" and, like a hand-over, enters without the rise.
 * - **B9: React draws the hand-over.** Every copy of this screen that is part of a hand-over (the
 *   in-place copy on `/session/live` AND the route's copy that follows it, `still`) draws the
 *   pipeline and the status line from React alone: no Stepper overlay, no entering fade, still
 *   Spinners. So no Reanimated update is sent to a view that is being mounted or replaced at the
 *   Finalizing hand-over, which is where the device logged "Unable to find SurfaceMountingManager"
 *   (FXR-DEV-2: one new view per pipeline step, then one at the Summary). The step motion (M-C-09)
 *   still plays when this screen is entered on its own (a deep link, a relaunch).
 */
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { Alert, Button, Spinner, useToast } from 'heroui-native';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { formatDuration } from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { KeyValueList, SectionCard, SubjectTypeChip, type KeyValueItem } from '@/components/kit';
import { Pane, SafeScreen, useLayoutClass, type LayoutClass } from '@/layout';
import { enterRise, useMotionSettings } from '@/motion';
import { sessionResyncHref } from '@/navigation';
import { reportRuntimeIssue } from '@/runtime';
import { FinalizationPipeline } from './finalization-pipeline';
import {
  finalizingPhase,
  forwardStatuses,
  isFinalizingBusy,
  pipelineSeconds,
  pipelineStatuses,
  sealedAfterSeconds,
  type FinalizingPhase,
} from './finalizing.model';
import { etaSeconds, useSealingProgress } from './sealing-progress';
import { FlowBoundary } from './flow-boundary';
import { SessionSummaryScreen } from '@/features/session-summary/session-summary-screen';
import { markSummaryHandoff } from '@/features/session-summary/summary-handoff';
import { isFinalizingHandover, markFinalizingHandover } from './handover';
import { InterruptedSealNotice, useInterruptedSeal } from './interrupted-seal';
import { SealedStamp } from './sealed-stamp';
import { UnsealableNotice } from './unsealable-notice';
import { useFinalizationSteps, useFinalizingSession, useSealedHandOffDue, type FinalizingSession } from './use-finalizing';

/** 04 §2.4 "Finalizing, Summary, Recovery": centred card widths per layout class (dp). */
const CARD_MAX_WIDTH: Readonly<Record<LayoutClass, number | undefined>> = {
  compact: undefined,
  'compact-landscape': 560,
  medium: 640,
  expanded: 720,
};
/** Expanded: the side summary next to the 720 dp card. */
const SIDE_WIDTH = 360;
/** One "please wait" toast per this many ms, however often Back is pressed. */
const BLOCKED_TOAST_GAP_MS = 2_000;

export interface SessionFinalizingScreenProps {
  /** Drawn in place by `/session/live` while it hands over to this route (E2E-P-4): no enter motion. */
  readonly handover?: boolean;
}

export function SessionFinalizingScreen({ handover = false }: SessionFinalizingScreenProps = {}) {
  const { t } = useTranslation();
  const focused = useIsFocused();
  const { layoutClass } = useLayoutClass();
  const session = useFinalizingSession();
  // E2E-P-4: the in-place copy, and the route's copy that replaces it, appear at once (no rise from 0).
  const steps = useFinalizationSteps();
  // Row 87 (flow 4, MB-06): a resumed seal arrives from the Recovery screen; like a hand-over it is drawn at once.
  const [enter] = useState(() => !handover && !isFinalizingHandover(session.id) && !(steps ?? []).some((step) => (step.attempt ?? 1) > 1));
  useLayoutEffect(() => {
    if (handover) markFinalizingHandover(session.id);
  }, [handover, session.id]);
  const phase = finalizingPhase(session.state);
  // CF2-A (RF-PH-3): the Summary that replaces this screen draws in place (`summary-handoff.ts`).
  useLayoutEffect(() => {
    if (phase === 'sealed') markSummaryHandoff(session.id);
  }, [phase, session.id]);
  const busy = isFinalizingBusy(phase);
  const summaryHref: Href | null = session.id ? (`/session/summary/${session.id}` as Href) : null;

  useFinalizingBack({ busy, focused, exitHref: phase === 'sealed' && summaryHref ? summaryHref : '/home' });

  // 04 §4.6: the Summary opens 1.2 s after SEALED (simulator clock) unless the route sync already did.
  const handOff = useSealedHandOffDue(phase === 'sealed' && session.summaryPending ? session.sealedAt : null);
  const go = useNavigate();
  useEffect(() => {
    if (handOff && focused && summaryHref) go(summaryHref, 'handOff');
  }, [handOff, focused, summaryHref, go]);

  // CF2-A (RF-PH-3): sealed with the summary pending, this route draws the Summary IN PLACE (the D201 recipe of
  // the monitor -> Finalizing hand-over): the route change that follows (the route sync at SEALED, or the
  // 1.2 s hand-off above) swaps two identical screens. On the phones the Summary route took up to 2 s to
  // draw after the replace and then cut in with one empty frame (9 of 18 runs).
  if (!handover && phase === 'sealed' && session.summaryPending && session.id) {
    return <SessionSummaryScreen sessionId={session.id} handover />;
  }

  const sideBySide = layoutClass === 'expanded';
  const maxWidth = CARD_MAX_WIDTH[layoutClass];

  let body: ReactNode;
  if (phase === 'idle' || phase === 'open') {
    const resume = phase === 'open' ? sessionResyncHref(session.state, { sessionId: session.id }) : null;
    body = (
      <NoticeCard
        enter={enter}
        testID={`finalizing-${phase}`}
        title={t(phase === 'idle' ? 'features.session-finalizing.idle.title' : 'features.session-finalizing.notEnded.title')}
        body={t(phase === 'idle' ? 'features.session-finalizing.idle.body' : 'features.session-finalizing.notEnded.body')}
        actionLabel={resume ? t('features.session-finalizing.notEnded.open') : t('features.session-finalizing.goHome')}
        onAction={() => go((resume ?? '/home') as Href, 'notice')}
      />
    );
  } else {
    body = (
      <View style={[styles.cards, sideBySide ? styles.cardsRow : null]}>
        <View style={sideBySide ? styles.mainColumn : styles.fullWidth}>
          {phase === 'interrupted' ? <InterruptedAlert enter={enter} faultKind={session.faultKind} onOpen={() => go('/session/recovery', 'recovery')} /> : null}
          <FlowBoundary scope="session-finalizing" name="pipeline">
            <PipelineCard
              enter={enter}
              handover={handover}
              session={session}
              phase={phase}
              steps={steps}
              onOpenSummary={summaryHref ? () => go(summaryHref, 'openSummary') : null}
            />
          </FlowBoundary>
        </View>
        <View style={sideBySide ? styles.sideColumn : styles.fullWidth}>
          <FlowBoundary scope="session-finalizing" name="session">
            <SessionCard enter={enter} session={session} />
          </FlowBoundary>
        </View>
      </View>
    );
  }

  return (
    <SafeScreen id="session-finalizing">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.centre, maxWidth !== undefined ? { maxWidth: sideBySide ? maxWidth + SIDE_WIDTH + spacing[4] : maxWidth } : null]}>
          {/* Fix pass F-M7b (R88-02 (c)): the Core ended the session as UNSEALABLE - a state of the recording, not an error of this screen. */}
          {phase === 'idle' ? <UnsealableNotice /> : null}
          {body}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

// ---------------------------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------------------------

/** `router.replace` with the failure written to the persistent runtime log (never swallowed). */
function useNavigate(): (href: Href, reason: string) => void {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useCallback(
    (href: Href, reason: string) => {
      try {
        router.replace(href);
      } catch (error) {
        toast.show({ variant: 'danger', label: t('features.session-finalizing.actionFailed') });
        reportRuntimeIssue('error', `features.sessionFinalizing.navigate.${reason}`, error, { to: String(href) });
      }
    },
    [router, toast, t],
  );
}

interface FinalizingBackOptions {
  busy: boolean;
  focused: boolean;
  /** Where Back goes once the pipeline is over and no route sits below (Summary or Home). */
  exitHref: Href;
}

/**
 * 04 §3.6 "Blocked: a toast explains 'Finalizing — please wait'; no dialog". A screen-level
 * BackHandler (newer listeners run first, so it precedes the navigator's) consumes Back while busy.
 * No `usePreventRemove` here on purpose: it would also hold the route sync's own `replace` to the
 * Summary at the FINALIZING → SEALED edge (the guard flag updates one commit late). Once the
 * pipeline is over, Back pops if a route sits below; with none (after a resync replace) it goes to
 * `exitHref` instead of leaving the app (F-79-1).
 */
function useFinalizingBack({ busy, focused, exitHref }: FinalizingBackOptions): void {
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const go = useNavigate();
  const lastToastAt = useRef(0);

  useEffect(() => {
    if (!focused) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) {
        const now = Date.now();
        if (now - lastToastAt.current >= BLOCKED_TOAST_GAP_MS) {
          lastToastAt.current = now;
          toast.show({ variant: 'default', label: t('mobile.backGuard.finalizing') });
        }
        return true;
      }
      if (router.canGoBack()) return false;
      go(exitHref, 'back');
      return true;
    });
    return () => subscription.remove();
  }, [focused, busy, exitHref, router, toast, t, go]);
}

// ---------------------------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------------------------

interface PipelineCardProps {
  /** False on a hand-over from the monitor: the card is there at once (E2E-P-4). */
  enter: boolean;
  session: FinalizingSession;
  phase: FinalizingPhase;
  steps: ReturnType<typeof useFinalizationSteps>;
  onOpenSummary: (() => void) | null;
  /** The copy drawn in place on a hand-over: its Stepper starts no motion (W93-7). */
  handover?: boolean;
}

function PipelineCard({ enter, session, phase, steps, onOpenSummary, handover = false }: PipelineCardProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const sealed = phase === 'sealed';
  // Row 87 (E-13): forward-only, from the Core's states alone (no timer here).
  const progress = useSealingProgress(session.id, steps, sealed);
  const statuses = forwardStatuses(pipelineStatuses(steps, phase), progress.steps);
  const seconds = pipelineSeconds(steps);
  const percent = progress.percent;
  const percents = progress.steps.map((step, index) => (typeof steps?.[index]?.progress === 'number' ? step.percent : null));
  // Row 87 (B9): a copy that is part of a hand-over starts no Reanimated motion at all.
  const still = handover || !enter;
  const sealedIn = sealedAfterSeconds(session.stoppedAt, session.sealedAt);
  // Wave H driver B (G75-03, ruling D197): the seal of an interrupted recording says so from its first step on.
  const interrupted = useInterruptedSeal(session.id);

  return (
    <Animated.View entering={enter ? enterRise(0, settings) : undefined}>
      <Pane name="finalization">
        <SectionCard testID="finalizing-card">
          <View style={styles.cardHead}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title} testID="finalizing-title">
              {sealed && interrupted !== null ? interrupted.title : t(sealed ? 'session.finalization.sealedTitle' : 'session.finalization.title')}
            </Text>
            {session.id ? (
              <Text maxFontSizeMultiplier={1.2} selectable style={styles.sessionId} testID="finalizing-session-id">
                {session.id}
              </Text>
            ) : null}
          </View>

          <InterruptedSealNotice sessionId={session.id} testID="finalizing-interrupted" />
          <View style={styles.statusLine} accessibilityLiveRegion="polite" testID="finalizing-status">
            {phase === 'stopping' ? (
              <>
                {/* Wave H driver B (G89-02 = B9): a hand-over copy owns no Reanimated indicator - the kit Spinner cancels a
                    shared value when it unmounts (at STOPPING -> FINALIZING), a write to a view tag that is being removed. */}
                {still ? <LoaderCircle testID="finalizing-stopping-still" size={18} color={palette.gold} /> : <Spinner size="sm" color={palette.gold} />}
                <Text maxFontSizeMultiplier={1.2} style={styles.statusText}>
                  {t('session.finalization.stopping')}
                </Text>
              </>
            ) : phase === 'finalizing' ? (
              <Text maxFontSizeMultiplier={1.2} style={styles.statusText} testID="finalizing-progress">
                {t('session.finalization.progress', { percent })}
              </Text>
            ) : sealed ? (
              <View style={styles.sealedBlock}>
                {/* The animated stamp belongs to the Summary (F-80-1); here the chip is static. */}
                <SealedStamp
                  play={false}
                  label={interrupted?.short ?? t('session.finalization.sealed')}
                  accessibilityLabel={t('features.session-finalizing.stampLabel')}
                  testID="finalizing-sealed"
                />
                {session.evidenceId ? (
                  <Text maxFontSizeMultiplier={1.2} style={styles.statusText}>
                    {t('session.finalization.sealedBody', { evidenceId: session.evidenceId })}
                  </Text>
                ) : null}
                {sealedIn ? (
                  <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
                    {t('session.finalization.sealedIn', { seconds: sealedIn })}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {phase === 'finalizing' && progress.reportsProgress ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID={`finalizing-eta-${progress.etaMs === null ? 'none' : 'core'}`}>
              {progress.etaMs === null ? t('session.finalization.estimating') : t('session.sealingEta.step', { seconds: etaSeconds(progress.etaMs) })}
            </Text>
          ) : null}
          {progress.resumed && !sealed ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="finalizing-resumed">
              {t('session.finalization.resumed')}
            </Text>
          ) : null}

          <View accessibilityLabel={t('features.session-finalizing.pipelineLabel')}>
            <FinalizationPipeline statuses={statuses} seconds={seconds} percents={percents} animate={!still} />
          </View>

          {isFinalizingBusy(phase) ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="finalizing-keep-open">
              {t('features.session-finalizing.keepOpen')}
            </Text>
          ) : null}
          {sealed ? (
            <View style={styles.sealedFooter}>
              {session.summaryPending ? (
                <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
                  {t('features.session-finalizing.openingSummary')}
                </Text>
              ) : null}
              {onOpenSummary ? (
                <Button testID="finalizing-open-summary" variant="primary" size="lg" onPress={onOpenSummary}>
                  <Button.Label>{t('features.session-finalizing.openSummary')}</Button.Label>
                </Button>
              ) : null}
            </View>
          ) : null}
        </SectionCard>
      </Pane>
    </Animated.View>
  );
}

function SessionCard({ enter, session }: { enter: boolean; session: FinalizingSession }) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const length =
    session.startedAt !== null && session.stoppedAt !== null ? formatDuration(session.stoppedAt - session.startedAt) : null;
  const items: KeyValueItem[] = [
    { id: 'case', label: t('session.details.caseNumber'), value: session.caseNumber ?? '—', mono: true, testID: 'finalizing-case' },
    {
      id: 'subject',
      label: t('session.details.subject'),
      value: (
        <View style={styles.subject}>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.value}>
            {session.subjectName ?? '—'}
          </Text>
          {session.subjectType ? <SubjectTypeChip type={session.subjectType} size="sm" /> : null}
        </View>
      ),
      testID: 'finalizing-subject',
    },
    { id: 'length', label: t('features.session-finalizing.recordingLength'), value: length ?? '—', mono: true, testID: 'finalizing-length' },
    {
      id: 'evidence',
      label: t('session.details.evidenceId'),
      value: session.evidenceId ?? t('features.session-finalizing.evidencePending'),
      mono: session.evidenceId !== null,
      testID: 'finalizing-evidence',
    },
  ];
  return (
    <Animated.View entering={enter ? enterRise(1, settings) : undefined}>
      <Pane name="session">
        <SectionCard title={t('features.session-finalizing.sessionCard')} testID="finalizing-session-card">
          <KeyValueList items={items} />
        </SectionCard>
      </Pane>
    </Animated.View>
  );
}

function InterruptedAlert({ enter, faultKind, onOpen }: { enter: boolean; faultKind: FinalizingSession['faultKind']; onOpen: () => void }) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const fault = faultKind ? t(`common.faultKind.${faultKind}`) : t('features.session-finalizing.interrupted.unknownFault');
  return (
    <Animated.View entering={enter ? enterRise(0, settings) : undefined} style={styles.alert} testID="finalizing-interrupted">
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('features.session-finalizing.interrupted.title')}</Alert.Title>
          <Alert.Description>{t('features.session-finalizing.interrupted.body', { fault })}</Alert.Description>
          <View style={styles.alertAction}>
            <Button testID="finalizing-open-recovery" variant="outline" size="sm" onPress={onOpen}>
              <Button.Label>{t('features.session-finalizing.interrupted.open')}</Button.Label>
            </Button>
          </View>
        </Alert.Content>
      </Alert>
    </Animated.View>
  );
}

interface NoticeCardProps {
  enter: boolean;
  testID: string;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}

function NoticeCard({ enter, testID, title, body, actionLabel, onAction }: NoticeCardProps) {
  const settings = useMotionSettings();
  return (
    <Animated.View entering={enter ? enterRise(0, settings) : undefined}>
      <SectionCard testID={testID}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.statusText}>
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
  cardHead: { gap: spacing[0] },
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
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], minHeight: 24 },
  statusText: {
    flexShrink: 1,
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
  sealedBlock: { gap: spacing[1], flex: 1 },
  sealedFooter: { gap: spacing[1] },
  subject: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexShrink: 1 },
  value: {
    flexShrink: 1,
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  alert: { alignSelf: 'stretch' },
  alertAction: { flexDirection: 'row', marginTop: spacing[1] },
});
