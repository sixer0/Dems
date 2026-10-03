/**
 * Start New Session (04_mobile_specs §4.4, MB 3) at `/session/new?step=1|2|3`; step 78
 * (05_mobile_plan M-09). Owner: step 78 (P6). The route file renders `<SessionNewScreen step />`;
 * the root stays `SafeScreen id="session-new"` (`screen-session-new`, T-M02, MA-04).
 *
 * The flow (§1.3 rows 3–6; the simulator is the source of truth, `effectiveStep`):
 * 1. **Session Info** — the MB 3 form (react-hook-form + the shared `sessionCreateSchema`, D62).
 *    Next: `createSession(input)` → CREATE, then `beginPrecheck()` → PRECHECK.
 * 2. **Devices Check** — the book's §5.3 gate run by the simulator (8 checks, 300–700 ms each;
 *    PASS arms by itself, WARN needs "Acknowledge warnings", BLOCK disables Next).
 * 3. **Ready** — the ARMED summary, the mini GlowRing, the 3-2-1 countdown switch; "Start
 *    Recording" → `startRecording()` → `router.replace('/session/live')` (step 79's route), so
 *    Back from the monitor can never return to ARMED.
 *
 * Layouts (§2.4 "Start Session" row): phone portrait = MB 3 (horizontal stepper, one step, the gold
 * button pinned at the bottom); phone landscape = stepper on top, content in two columns; tablet
 * portrait = vertical stepper 240 dp | step content; tablet landscape = vertical stepper | step
 * content | the live device column (previews, meters and the live §5.3 check list). Panes carry
 * `pane-stepper`, `pane-content`, `pane-devices`.
 *
 * Leaving: §3.6 guard (see `flow-guard.tsx`). Keyboard: `KeyboardAwareScrollView` (§2.6, keyboard
 * controller from step 67). Motion (§7.3, 03M M-PG-NEW): stepper badges stagger, step content
 * enters in the direction of travel (x ±24, `gentle`), step 2 checks resolve in sequence, step 3's
 * ring sweep is the hero moment; loops pause off-focus.
 */
import { useIsFocused, useNavigation, useRouter } from 'expo-router';
import { StackActions } from 'expo-router/react-navigation';
import { Button, useToast } from 'heroui-native';
import { ArrowRight, Circle } from 'lucide-react-native';
import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInLeft, FadeInRight, ReduceMotion, type EntryOrExitLayoutType } from 'react-native-reanimated';
import { useSimInstance } from '@dems/shared/sim';
import { motion as motionTokens, palette, spacing } from '@dems/shared/tokens';
import { Stepper, type StepDef, type StepStatusWords } from '@/components/composed/stepper';
import { Pane, PaneLayout, SafeScreen, useLayoutClass } from '@/layout';
import {
  REDUCED_FADE_MS,
  slowSpringTiming,
  triggerHaptic,
  useMotionSettings,
  useMotionState,
  type HapticEvent,
  type MotionSettings,
} from '@/motion';
import { BackGuardDialog, useBackGuard, type SessionStep } from '@/navigation';
import { reportRuntimeIssue } from '@/runtime';
import { DevicesCheckStep } from './devices-check-step';
import { LiveDeviceColumn } from './device-previews';
import { DiscardDialog, useFlowBackPrompt } from './flow-guard';
import { CountdownOverlay, ReadyStep } from './ready-step';
import { SessionInfoStep } from './session-info-step';
import { SessionNewHeader } from './session-new-header';
import {
  COUNTDOWN_FROM,
  COUNTDOWN_STEP_MS,
  WIZARD_STEPS,
  arrangementFor,
  canLeaveGate,
  defaultInvestigatorId,
  effectiveStep,
  eligibleInvestigators,
  gatePhase,
  hasDeviceColumn,
  isWizardState,
  itemsWith,
  lastProfileValues,
  stepperOrientation,
  stepperStatuses,
  type SessionNewArrangement,
  type WizardStep,
} from './session-new-model';
import { nextCaseNumber } from './sim-adapter';
import { StepBoundary } from './step-boundary';
import {
  blankFormValues,
  formValuesFromInput,
  useFlowActions,
  useSessionForm,
  useSessionNewData,
  type CreateFailure,
} from './use-session-new';

export interface SessionNewScreenProps {
  /** Wizard step from `?step=1|2|3` (`sessionStepSchema`; invalid or absent → 1). */
  readonly step: SessionStep;
}

/** Tablet stepper column (§2.4: "Vertical stepper 240 dp"). */
const STEPPER_WIDTH = 240;
/** Tablet-landscape device column. */
const DEVICE_COLUMN_WIDTH = 340;
/**
 * The simulated scan "fills the next synthetic case number … with a haptic Success" (04 §4.4).
 * The step-69 haptics map has no scan event; `verifyPass` is its Row-5 success kind (MA-20: every
 * haptic still goes through the one service). Requested: a `caseScan` event (step 69 owner).
 */
const CASE_SCAN_HAPTIC: HapticEvent = 'verifyPass';
const FIELD_UPDATE = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;

export function SessionNewScreen({ step }: SessionNewScreenProps) {
  // The react-hook-form object is mutable: keep the screen out of React Compiler memoisation
  // (F-70-1; the login card's precedent).
  'use no memo';
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const sim = useSimInstance();
  const focused = useIsFocused();
  const appActive = useMotionState((s) => s.appActive);
  const paused = !focused || !appActive;
  const settings = useMotionSettings();
  const { layoutClass } = useLayoutClass();
  const arrangement = arrangementFor(layoutClass);

  const data = useSessionNewData();
  const current = effectiveStep(data.state, step);
  const phase = gatePhase(data.precheck);
  const investigators = useMemo(() => eligibleInvestigators(data.operators), [data.operators]);
  const actions = useFlowActions(data.state, data.sessionId);

  // ── Step 1 form ──────────────────────────────────────────────────────────────────────────────
  const [initialValues] = useState(() =>
    data.state === 'CREATE' && data.input
      ? formValuesFromInput(data.input)
      : blankFormValues(defaultInvestigatorId(data.operators, data.signedInId)),
  );
  const form = useSessionForm(initialValues);
  const [createError, setCreateError] = useState<CreateFailure | null>(null);

  // ── Step 2 and 3 local state ─────────────────────────────────────────────────────────────────
  const [acknowledged, setAcknowledged] = useState(false);
  const [countdownOn, setCountdownOn] = useState(true);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [launching, setLaunching] = useState(false);

  // A fresh gate run (retry) needs a fresh acknowledgement (adjusted during render, not in an effect).
  const runKey = data.precheck?.startedAt ?? null;
  const [seenRun, setSeenRun] = useState(runKey);
  if (seenRun !== runKey) {
    setSeenRun(runKey);
    setAcknowledged(false);
  }

  // ── Leaving (§3.6) ───────────────────────────────────────────────────────────────────────────
  const flowActive = isWizardState(data.state);
  const guardEnabled = !launching && (flowActive || (current === 1 && form.formState.isDirty));
  const backGuard = useBackGuard({ enabled: guardEnabled });
  const back = useFlowBackPrompt(backGuard, guardEnabled && focused);

  // A back attempt, or the state leaving ARMED (a fault), stops a running countdown.
  const stopCountdown = remaining !== null && (back.guard.isPrompting || data.state !== 'ARMED');
  if (stopCountdown) setRemaining(null);

  // Keep `?step=` equal to the step shown (resync and deep links read it, §3.7). The screen's own
  // navigation object sets the param on this route directly; `router.setParams` asserts that the
  // root navigator is ready, which it is not yet while a deep-linked first screen runs its effects.
  const navigation = useNavigation();
  const showStep = (next: WizardStep) => setStepParam(navigation, next);
  useEffect(() => {
    if (launching || step === current) return;
    setStepParam(navigation, current);
  }, [launching, step, current, navigation]);

  // 3-2-1: one digit per second, then the launch (03M M-PG-NEW).
  useEffect(() => {
    if (remaining === null) return undefined;
    const timer = setTimeout(() => {
      if (remaining <= 1) {
        setRemaining(null);
        setLaunching(true);
      } else {
        setRemaining(remaining - 1);
      }
    }, COUNTDOWN_STEP_MS);
    return () => clearTimeout(timer);
  }, [remaining]);

  // The hand-off. `launching` switched the back guard off in the commit before this effect, so the
  // replace is not held. `router.replace` would only enqueue the navigation (expo-router drains its
  // routing queue one commit later), and in between the wizard route would see RECORDING and refuse
  // itself with a "session active" toast. So the stack action is dispatched synchronously, next to
  // `startRecording()`: the state change and the navigation land in one render, and the monitor
  // route (RECORDING only) opens straight away. `replace`, so Back can never return to ARMED.
  const launch = useEffectEvent(() => {
    if (!actions.startRecording()) {
      setLaunching(false); // the simulator refused (toast + log in `useFlowActions`); stay on step 3
      return;
    }
    if (!replaceWithMonitor(navigation)) router.replace('/session/live');
  });
  useEffect(() => {
    // The only state update here is the rare refusal path (`setLaunching(false)`), one render at most.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (launching) launch();
  }, [launching]);

  // ── Handlers ─────────────────────────────────────────────────────────────────────────────────
  const onScan = () => {
    try {
      form.setValue('caseNumber', nextCaseNumber(sim.store.getState()), FIELD_UPDATE);
      triggerHaptic(CASE_SCAN_HAPTIC);
    } catch (error) {
      toast.show({ variant: 'danger', label: t('features.session-new.actionFailed') });
      reportRuntimeIssue('error', 'features.sessionNew.scan', error);
    }
  };

  const onLastProfile = () => {
    if (!data.newestHistory) return;
    const values = lastProfileValues(data.newestHistory, data.operators);
    form.setValue('caseNumber', values.caseNumber, FIELD_UPDATE);
    form.setValue('investigatorId', values.investigatorId, FIELD_UPDATE);
    form.setValue('room', values.room, FIELD_UPDATE);
    form.setValue('profileId', values.profileId, FIELD_UPDATE);
    toast.show({ variant: 'default', label: t('features.session-new.header.profileLoaded', { sessionId: data.newestHistory.id }) });
  };

  const onClearForm = () => {
    form.reset(blankFormValues(defaultInvestigatorId(data.operators, data.signedInId)));
    setCreateError(null);
  };

  const onNextInfo = form.handleSubmit((values) => {
    triggerHaptic('primaryPress');
    const outcome = actions.createAndCheck(values);
    if (!outcome.ok) {
      setCreateError(outcome.reason);
      return;
    }
    setCreateError(null);
    setAcknowledged(false);
    showStep(2);
  });

  const onNextGate = () => {
    triggerHaptic('primaryPress');
    if (data.state === 'PRECHECK' && phase === 'warn' && !actions.acknowledgeWarnings()) return;
    showStep(3);
  };

  const onRetry = () => {
    triggerHaptic('primaryPress');
    if (actions.retryChecks()) setAcknowledged(false);
  };

  const onStart = () => {
    triggerHaptic('recordStart');
    if (countdownOn) setRemaining(COUNTDOWN_FROM);
    else setLaunching(true);
  };

  const cancelAndLeave = () => {
    actions.cancelSession();
    back.guard.leave();
  };

  // ── Footer (the MB 3 gold button, pinned on phones) ──────────────────────────────────────────
  const warningsAcknowledged = itemsWith(data.precheck?.items ?? [], 'WARN').length;
  let footer: ReactNode;
  if (current === 1) {
    footer = (
      <Button testID="session-new-next" variant="primary" size="lg" isDisabled={!form.formState.isValid} onPress={() => void onNextInfo()}>
        <Button.Label>{t('common.actions.next')}</Button.Label>
        <ArrowRight size={20} color={palette.black} />
      </Button>
    );
  } else if (current === 2) {
    footer = (
      <Button testID="session-new-next" variant="primary" size="lg" isDisabled={!canLeaveGate(phase, acknowledged, data.state)} onPress={onNextGate}>
        <Button.Label>{t('common.actions.next')}</Button.Label>
        <ArrowRight size={20} color={palette.black} />
      </Button>
    );
  } else {
    footer = (
      <Button
        testID="session-new-start"
        variant="primary"
        size="lg"
        isDisabled={data.state !== 'ARMED' || remaining !== null || launching}
        onPress={onStart}
      >
        <Circle size={14} color={palette.danger} fill={palette.danger} />
        <Button.Label>{launching ? t('sessionNew.ready.starting') : t('common.actions.startRecording')}</Button.Label>
      </Button>
    );
  }

  // ── Step content ─────────────────────────────────────────────────────────────────────────────
  const direction = useTravelDirection(current);
  const deviceColumn = hasDeviceColumn(arrangement);
  let content: ReactNode;
  if (current === 1) {
    content = (
      <SessionInfoStep form={form} investigators={investigators} arrangement={arrangement} onScan={onScan} createError={createError} />
    );
  } else if (current === 2) {
    content = (
      <DevicesCheckStep
        precheck={data.precheck}
        phase={phase}
        acknowledged={acknowledged}
        onAcknowledgedChange={setAcknowledged}
        armed={data.state === 'ARMED'}
        onRetry={onRetry}
        showPreviews={!deviceColumn}
        liveFeeds={arrangement === 'phone' || arrangement === 'phone-landscape' ? 'one' : 'both'}
        paused={paused}
      />
    );
  } else {
    content = (
      <ReadyStep
        input={data.input}
        operators={data.operators}
        warnings={warningsAcknowledged}
        countdown={countdownOn}
        onCountdownChange={setCountdownOn}
        paused={paused}
        wide={arrangement !== 'phone'}
      />
    );
  }

  const stepBody = (
    <Animated.View key={current} entering={stepEnter(direction, settings)} testID={`session-new-step-${current}`}>
      <StepBoundary name={`step-${current}`}>{content}</StepBoundary>
    </Animated.View>
  );

  const stepper = (
    <FlowStepper current={current} phase={phase} state={data.state} arrangement={arrangement} onBackToChecks={() => showStep(2)} />
  );

  const header = (
    <SessionNewHeader
      onBack={back.requestBack}
      showMenu={current === 1}
      hasLastProfile={data.newestHistory !== null}
      onLastProfile={onLastProfile}
      onClearForm={onClearForm}
      large={arrangement === 'tablet-portrait' || arrangement === 'tablet-landscape'}
    />
  );

  const scroll = (
    <KeyboardAwareScrollView
      testID="session-new-scroll"
      bottomOffset={spacing[4]}
      keyboardShouldPersistTaps="handled"
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, arrangement === 'phone' ? null : styles.scrollContentWide]}
    >
      {stepBody}
    </KeyboardAwareScrollView>
  );

  const footerBar = <View style={[styles.footer, arrangement === 'phone' ? null : styles.footerWide]}>{footer}</View>;

  return (
    <SafeScreen id="session-new">
      {header}
      {arrangement === 'phone' || arrangement === 'phone-landscape' ? (
        <View style={styles.flex}>
          <View style={styles.stepperBar}>{stepper}</View>
          {scroll}
          {footerBar}
        </View>
      ) : (
        <PaneLayout stackOn={[]} testID="session-new-panes" gap={0}>
          <Pane name="stepper" width={STEPPER_WIDTH}>
            <View style={styles.stepperColumn}>{stepper}</View>
          </Pane>
          <Pane name="content" flex={1} minWidth={360}>
            {scroll}
            {footerBar}
          </Pane>
          {deviceColumn ? (
            <Pane name="devices" width={DEVICE_COLUMN_WIDTH}>
              <KeyboardAwareScrollView style={styles.flex} contentContainerStyle={styles.deviceColumn} testID="session-new-device-scroll">
                <StepBoundary name="devices">
                  <LiveDeviceColumn showChecks={current !== 2} paused={paused} />
                </StepBoundary>
              </KeyboardAwareScrollView>
            </Pane>
          ) : null}
        </PaneLayout>
      )}

      {remaining !== null ? <CountdownOverlay seconds={remaining} onCancel={() => setRemaining(null)} /> : null}
      {flowActive ? (
        <BackGuardDialog guard={back.guard} variant="flow" onConfirm={cancelAndLeave} />
      ) : (
        <DiscardDialog guard={back.guard} />
      )}
    </SafeScreen>
  );
}

// ---------------------------------------------------------------------------------------------

interface FlowStepperProps {
  current: WizardStep;
  phase: ReturnType<typeof gatePhase>;
  state: ReturnType<typeof useSessionNewData>['state'];
  arrangement: SessionNewArrangement;
  onBackToChecks(): void;
}

/** C-4: horizontal on phones (MB 3), vertical on tablets; step 3 may jump back to the checks. */
function FlowStepper({ current, phase, state, arrangement, onBackToChecks }: FlowStepperProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const steps: StepDef[] = WIZARD_STEPS.map((key) => ({ key, label: t(`sessionNew.steps.${key}`) }));
  const words: StepStatusWords = {
    step: t('features.session-new.stepper.step'),
    of: t('features.session-new.stepper.of'),
    pending: t('features.session-new.stepper.pending'),
    active: t('features.session-new.stepper.active'),
    running: t('features.session-new.stepper.running'),
    done: t('features.session-new.stepper.done'),
    warn: t('features.session-new.stepper.warn'),
    error: t('features.session-new.stepper.error'),
  };
  const statuses = stepperStatuses(current, phase, state);
  return (
    <View accessibilityLabel={t('sessionNew.steps.label')} testID="session-new-stepper-root">
      <Stepper
        // Remount on every status change, so each badge mounts with its final glyph. On dems_phone the
        // C-4 badges lost their glyph after a status change (the check of a done step, the number of
        // the new active step) in both motion modes, with Reanimated logging "synchronouslyUpdateUIProps
        // failed … Unable to find SurfaceMountingManager": the glyph view's first UI-thread update can
        // land before Fabric mounts it. A badge's first mount takes its final state without that update
        // (the step-1 badges always rendered), and the remount replays the badges' enter stagger (03M
        // M-PG-NEW "badges stagger"). Reported for step 71, the component's owner (S78-7).
        key={statuses.join('|')}
        testID="session-new-stepper"
        steps={steps}
        statuses={statuses}
        orientation={stepperOrientation(arrangement)}
        motion={settings.policy}
        statusWords={words}
        onStepPress={(index) => {
          if (index !== 1 || current !== 3) return;
          triggerHaptic('stepperSelect');
          onBackToChecks();
        }}
      />
    </View>
  );
}

/** +1 when the step moved forward, −1 when it moved back (R7 direction of travel). */
function useTravelDirection(current: WizardStep): 1 | -1 {
  const [travel, setTravel] = useState<{ step: WizardStep; direction: 1 | -1 }>({ step: current, direction: 1 });
  if (travel.step !== current) {
    const next = { step: current, direction: current > travel.step ? 1 : -1 } as const;
    setTravel(next);
    return next.direction;
  }
  return travel.direction;
}

/** Step content enters from the side it travels from (x ±24, `gentle`); reduced: a 160 ms fade. */
function stepEnter(direction: 1 | -1, m: MotionSettings): EntryOrExitLayoutType {
  if (m.policy === 'reduced') return FadeIn.duration(REDUCED_FADE_MS).reduceMotion(ReduceMotion.Never);
  const offset = motionTokens.distance.rise * 2;
  const base = direction === 1 ? FadeInRight : FadeInLeft;
  const builder = m.slow
    ? base.duration(slowSpringTiming().duration ?? 0)
    : base.springify().stiffness(motionTokens.spring.gentle.stiffness).damping(motionTokens.spring.gentle.damping).mass(motionTokens.spring.gentle.mass);
  return builder.withInitialValues({ opacity: 0, transform: [{ translateX: direction * offset }] }).reduceMotion(ReduceMotion.System);
}

/**
 * `StackActions.replace` to the monitor route of the session stack (its name is `live` in the app's
 * `(app)/session` stack; `session/live` in a flat test stack). False when the stack has no such route.
 */
interface StackNavigation {
  getState(): { routeNames?: readonly string[] } | undefined;
  dispatch(action: ReturnType<typeof StackActions.replace>): void;
}

/** The part of the screen's navigation object `setStepParam` uses (React Navigation `setParams`). */
interface ParamSetter {
  setParams(params: Record<string, string>): void;
}

/** `?step=<n>` on this route (no history entry). A failure is logged; the screen still shows the step. */
function setStepParam(navigation: object, step: WizardStep): void {
  try {
    // The route's params are untyped at this level (`RootParamList`); `step` is the route's one param.
    (navigation as ParamSetter).setParams({ step: String(step) });
  } catch (error) {
    reportRuntimeIssue('warn', 'features.sessionNew.stepParam', error, { step });
  }
}

function replaceWithMonitor(navigation: StackNavigation): boolean {
  const routeNames: readonly string[] = navigation.getState()?.routeNames ?? [];
  const monitor = routeNames.find((name) => name === 'live' || name.endsWith('/live'));
  if (monitor === undefined) return false;
  navigation.dispatch(StackActions.replace(monitor));
  return true;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stepperBar: { paddingHorizontal: spacing[3], paddingTop: spacing[1], paddingBottom: spacing[2] },
  stepperColumn: { paddingHorizontal: spacing[3], paddingTop: spacing[3] },
  scrollContent: { paddingHorizontal: spacing[3], paddingBottom: spacing[3], gap: spacing[3] },
  scrollContentWide: { paddingHorizontal: spacing[4], paddingTop: spacing[1] },
  footer: { paddingHorizontal: spacing[3], paddingTop: spacing[1], paddingBottom: spacing[2] },
  footerWide: { paddingHorizontal: spacing[4] },
  deviceColumn: { paddingRight: spacing[4], paddingBottom: spacing[4] },
});
