/**
 * Step 2: Devices Check, the book's §5.3 pre-recording gate (04_mobile_specs §4.4 step 2;
 * research 01 §5.3; policy 01_specs §14.5.11, demo G8). Derived screen: MB 7 grouped rows
 * (icon, title, status chip) with MB 4 meters.
 *
 * The simulator runs the gate (`beginPrecheck()`): eight checks resolve one after another, each
 * after its seeded 300–700 ms (≤ 4.9 s in all), and the simulator applies the policy:
 * - BLOCK: Core OFFLINE, lens FAULT, storage FULL, security FAULT → a danger Alert names the
 *   reasons and Next stays disabled (haptic Error); "Run checks again" re-runs all eight;
 * - WARN: MIC NO SIGNAL or CLIP, storage LOW, time on RTC, enclosure tamper → a warning Alert and
 *   the "Acknowledge warnings" Checkbox; Next calls `acknowledgePrecheckWarnings()` (haptic Warning);
 * - PASS: the simulator arms by itself (ARMED, audit PRECHECK_PASSED).
 *
 * Motion (03M M-PG-NEW, §7.3): rows reveal 30 ms apart; each check resolves Spinner → chip, and a
 * WARN or BLOCK chip pulses once (R8). Reduced motion: no stagger, no pulse (colour only).
 */
import { Alert, Button, Checkbox, Label, ListGroup, Separator, Typography } from 'heroui-native';
import { CircleX, LoaderCircle } from 'lucide-react-native';
import { Fragment, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { capturePairOfMicChannel, PRIMARY_MIC_CHANNEL, useSim, type PrecheckItem, type PrecheckSlice } from '@dems/shared/sim';
import { palette, spacing } from '@dems/shared/tokens';
import { SectionCard, StatusChip } from '@/components/kit';
import { PrecheckCaptureNotices, precheckSentence, usePrecheckSentence } from '@/features/capture-selector/capture-notices';
import { PrecheckSourceBadge } from '@/features/capture-selector/development-source-badge';
import { LocalSourcesChecking, useLocalSourcesChecking, useLocalSourcesCheckingHint } from '@/features/capture-selector/local-source-notice';
import { REDUCED_FADE_MS, SPEC_LITERALS, animatePulseOnce, rowReveal, triggerHaptic, useMotionSettings, type MotionSettings } from '@/motion';
import { busyState } from '@/runtime';
import { CheckIcon } from './check-icon';
import { DevicePreviews } from './device-previews';
import { CHECK_ORDER, checkMicBinding, itemsWith, micRoleLine, precheckNoteOf, precheckTone, resolvedCount, valueKey, type GatePhase } from './session-new-model';
import { useSimulatedCoreLink } from '@/features/evidence/evidence-chips';

export interface DevicesCheckStepProps {
  precheck: PrecheckSlice | null;
  phase: GatePhase;
  acknowledged: boolean;
  onAcknowledgedChange(value: boolean): void;
  /** Simulator already ARMED (a WARN acknowledged earlier, or PASS). */
  armed: boolean;
  onRetry(): void;
  /**
   * Live mode (plan row W67, LB-1): "Run checks again" was pressed and its command is out (further
   * presses are ignored by the screen); `retryPending` once that lasted `LIVE_PENDING_REVEAL_MS`:
   * the kit's Spinner shows inside the button. Never true in Simulated mode.
   */
  retryBusy?: boolean;
  retryPending?: boolean;
  /**
   * Live mode: a blocked `CORE` check is this device's own connection to the Core server (decision
   * F69), so the block Alert says so. False in Simulated mode, where the step looks as before.
   */
  live?: boolean;
  /** Previews above the list (phones, tablet portrait); on tablet landscape they sit in the device column. */
  showPreviews: boolean;
  /** Phones play one feed at a time (04 §7.8 compact budget). */
  liveFeeds: 'one' | 'both';
  paused: boolean;
}

export function DevicesCheckStep({
  precheck,
  phase,
  acknowledged,
  onAcknowledgedChange,
  armed,
  onRetry,
  retryBusy = false,
  retryPending = false,
  live = false,
  showPreviews,
  liveFeeds,
  paused,
}: DevicesCheckStepProps) {
  const { t } = useTranslation();
  const simulatedCore = useSimulatedCoreLink();
  const settings = useMotionSettings();
  const items = precheck?.items ?? [];
  const done = resolvedCount(items);
  const blocks = itemsWith(items, 'BLOCK');
  const coreBlocked = live && blocks.some((item) => item.id === 'CORE');
  useGateHaptics(phase);
  // Fix wave H (G70-08): "Run checks again" is disabled, with the reason, while the device classes of the selector are not known.
  const sourcesChecking = useLocalSourcesChecking();
  const sourcesCheckingHint = useLocalSourcesCheckingHint(sourcesChecking);

  const reasons = blocks
    .map(
      (item) =>
        // Task 3 row 138 (D114; ux §8g.3): an unreachable capture device is worded from `params.rule`, never as a lens or signal state.
        precheckSentence(t, item) ??
        t('features.session-new.devices.reasonItem', {
          check: t(`sessionNew.devices.checks.${item.id}`),
          value: t(valueKey(item.id, item.value ?? ''), { defaultValue: item.value ?? '' }),
        }),
    )
    .join(', ');

  return (
    <View style={styles.stack}>
      {showPreviews ? (
        <SectionCard testID="session-new-previews-card">
          <DevicePreviews layout="row" live={liveFeeds} paused={paused} />
        </SectionCard>
      ) : null}

      <SectionCard
        title={t('sessionNew.devices.title')}
        description={t('sessionNew.devices.intro')}
        action={
          <Typography type="body-xs" color="muted" testID="session-new-gate-progress">
            {t('features.session-new.devices.progress', { done, total: CHECK_ORDER.length })}
          </Typography>
        }
        testID="session-new-gate"
      >
        {/* Fix wave Q (CP-10, truth rule 3f): the checks of a SIMULATED Core are a demonstration, said in the app's words. */}
        {simulatedCore ? (
          <View style={styles.demonstration}>
            <StatusChip testID="session-new-gate-demonstration" tone="info" label={t('features.dashboard.status.simulatedCore')} icon={null} size="sm" />
          </View>
        ) : null}
        {phase === 'block' ? (
          <Animated.View entering={FadeIn.duration(REDUCED_FADE_MS).reduceMotion(ReduceMotion.System)}>
            <Alert status="danger" testID="session-new-gate-block">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('sessionNew.devices.blockedTitle')}</Alert.Title>
                <Alert.Description>{t('sessionNew.devices.blockedBody', { reasons })}</Alert.Description>
                {coreBlocked ? (
                  <Alert.Description testID="session-new-gate-live-core">{t('features.session-new.live.coreCheckHint')}</Alert.Description>
                ) : null}
              </Alert.Content>
            </Alert>
          </Animated.View>
        ) : null}
        {phase === 'warn' ? (
          <Animated.View entering={FadeIn.duration(REDUCED_FADE_MS).reduceMotion(ReduceMotion.System)} style={styles.stackTight}>
            <Alert status="warning" testID="session-new-gate-warn">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('features.session-new.devices.warnTitle')}</Alert.Title>
                <Alert.Description>{t('sessionNew.devices.warnBody')}</Alert.Description>
              </Alert.Content>
            </Alert>
            {armed ? null : (
              <View style={styles.ackRow}>
                <Checkbox
                  testID="session-new-acknowledge"
                  isSelected={acknowledged}
                  onSelectedChange={(value) => {
                    triggerHaptic('switchToggle');
                    onAcknowledgedChange(value);
                  }}
                  accessibilityLabel={t('sessionNew.devices.acknowledge')}
                />
                <Label onPress={() => onAcknowledgedChange(!acknowledged)}>{t('sessionNew.devices.acknowledge')}</Label>
              </View>
            )}
          </Animated.View>
        ) : null}
        {phase === 'pass' ? (
          <StatusChip tone="success" label={t('features.session-new.devices.passed')} icon="CircleCheck" testID="session-new-gate-pass" />
        ) : null}
        {/* Task 3 row 138 (ux §8e.2 situation B, §8g.3): the unreachable devices by name, the count of the one
            search this pre-check ran, and "Search again" (G13 cameras, G17 microphones). No control switches
            the microphone here (D83). Nothing is drawn when every configured source answered. */}
        {phase === 'block' || phase === 'warn' ? <PrecheckCaptureNotices items={items} testID="session-new-capture-notices" /> : null}
        {/* Round two (JA2-23 / JT-22): the remedy stands beside "Recording is blocked", above the eight rows - it was
            below them, under the fold on the phone. */}
        {phase === 'block' || (phase === 'warn' && !armed) ? (
          <Button
            variant="outline"
            size="md"
            onPress={onRetry}
            testID="session-new-retry-checks"
            // Fix wave H (G70-08): a re-run opens the devices again; not while their classes are unknown.
            isDisabled={sourcesChecking}
            accessibilityLabel={t('features.session-new.devices.retry')}
            {...sourcesCheckingHint}
            {...busyState(retryBusy, sourcesChecking)}
          >
            {/* Fix wave I (G75b-05): the pending sign is the still glyph - see `RunningSign` below. */}
            {retryPending ? <RunningSign testID="session-new-retry-spinner" /> : null}
            <Button.Label>{t('features.session-new.devices.retry')}</Button.Label>
          </Button>
        ) : null}
        {phase === 'block' || (phase === 'warn' && !armed) ? <LocalSourcesChecking checking={sourcesChecking} testID="session-new-retry-sources-checking" /> : null}

        <ListGroup variant="transparent" testID="session-new-checks">
          {CHECK_ORDER.map((id, index) => {
            const item = items.find((candidate) => candidate.id === id) ?? null;
            return (
              <Fragment key={id}>
                {index > 0 ? <Separator /> : null}
                <Animated.View entering={rowReveal(index, settings)}>
                  <CheckRow item={item} id={id} settings={settings} />
                </Animated.View>
              </Fragment>
            );
          })}
        </ListGroup>

      </SectionCard>
    </View>
  );
}

/** The still running sign: the loader glyph at the kit Spinner's `sm` size, drawn by React alone (no Reanimated node). */
function RunningSign({ testID }: { testID: string }) {
  return (
    <View testID={testID}>
      <LoaderCircle size={16} color={palette.gold} />
    </View>
  );
}

interface CheckRowProps {
  item: PrecheckItem | null;
  id: (typeof CHECK_ORDER)[number];
  settings: MotionSettings;
}

function CheckRow({ item, id, settings }: CheckRowProps) {
  const { t } = useTranslation();
  const roleLine = useSim(micRoleLine);
  const status = item?.status ?? 'PENDING';
  const resolved = status === 'PASS' || status === 'WARN' || status === 'BLOCK';
  // Wave H closing pass Z2: a NOTE (the host-clock TIME item) is informative - its own chip word and tone.
  const note = precheckNoteOf(item);
  const tone = precheckTone(status, note);
  const value = item?.value ?? null;
  // Task 3 row 138 (D114): the sentence of an unreachable capture device, from `params.rule`; null for any other item.
  const unreachable = usePrecheckSentence(resolved ? item : null);
  let description: string;
  if (!resolved) description = status === 'RUNNING' ? t('sessionNew.devices.resolving') : t('common.precheckStatus.PENDING');
  else if (unreachable !== null) description = unreachable;
  // Round two (JT-03 remainder; contract_wave_j.md J-S 5 - SEEN ON THE TABLET after the lanes ran the new server code:
  // "Security, Enclosure tamper detected, NOTE"). The Core's NOTE on the SECURITY row means "platform security: not
  // reported" - no tamper was detected. It reads "Not reported"; a real tamper WARN (no note) keeps its sentence.
  else if (id === 'SECURITY' && note) description = t('common.platformNotReported.value');
  else if (id === 'SECURITY' && status === 'WARN') description = t('features.session-new.devices.tamper');
  else description = t(valueKey(id, value ?? ''), { defaultValue: value ?? '' });
  // Task 3 row 68 (MB-02): a microphone row names the role its input holds in the selector, and the input.
  const binding = checkMicBinding(id, roleLine);
  // Round two (JT-13): the NOTE chip of the host-clock row is explained in the row - it was a word nobody explained.
  const noteText = !note ? null : id === 'TIME' ? t('features.session-new.devices.noteTime') : id === 'SECURITY' ? t('features.session-new.devices.noteSecurity') : null;
  // Audit row 235 (M3 cycle 2; D255, register T9/A3, D134, D138): the row names the PAIR of the checked line's channel,
  // "Mic N (Camera N)", as Home (row 209), Session Live (row 210) and the selector (row 189) do - not the channel role
  // words ("Channel 1 (transcribed)"). "Transcribed" is said once, on Pair 1. The input that holds the channel follows.
  const roleText = binding
    ? [t('devices.pairs.micOfCamera', { n: capturePairOfMicChannel(binding.channel).pair }), binding.channel === PRIMARY_MIC_CHANNEL ? t('devices.pairs.transcribed') : null, binding.inputId]
        .filter((part): part is string => part !== null)
        .join(' · ')
    : null;

  return (
    <ListGroup.Item testID={`session-new-check-${id}`} accessibilityRole="text" accessibilityLabel={`${t(`sessionNew.devices.checks.${id}`)}, ${description}, ${note ? t('sessionNew.precheckNote.chip') : t(`common.precheckStatus.${status}`)}`}>
      <ListGroup.ItemPrefix>
        <CheckIcon id={id} tone={resolved ? tone : 'default'} />
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle>{t(`sessionNew.devices.checks.${id}`)}</ListGroup.ItemTitle>
        <ListGroup.ItemDescription testID={`session-new-check-${id}-value`}>{description}</ListGroup.ItemDescription>
        {roleText ? <ListGroup.ItemDescription testID={`session-new-check-${id}-role`}>{roleText}</ListGroup.ItemDescription> : null}
        {noteText ? <ListGroup.ItemDescription testID={`session-new-check-${id}-note`}>{noteText}</ListGroup.ItemDescription> : null}
        <PrecheckSourceBadge checkId={id} />
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        {resolved ? (
          note ? (
            <StatusChip size="sm" tone="info" label={t('sessionNew.precheckNote.chip')} icon="Info" testID={`session-new-check-${id}-status`} />
          ) : (
            <ResultChip status={status} settings={settings} testID={`session-new-check-${id}-status`} />
          )
        ) : status === 'RUNNING' ? (
          // Fix wave I (re-gate 75, G75b-05): the running sign of a check is REMOVED when the check resolves - once per
          // check, eight times a pre-check. The kit Spinner owns a Reanimated rotation, and its removal while it
          // turns is what the tablet logged ("Unable to find SurfaceMountingManager for tag": one new tag per
          // resolved check, wave H's finding G89-02 on the screen before the recording). The still glyph is drawn
          // by React alone; the row's text ("Checking…") and the counter above say that the check runs.
          <RunningSign testID={`session-new-check-${id}-spinner`} />
        ) : (
          <Typography type="body-xs" color="muted">
            {t('common.precheckStatus.PENDING')}
          </Typography>
        )}
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}

/** The PASS / WARN / BLOCK chip; WARN and BLOCK pulse once when they appear (03M R8, M-C-10). */
function ResultChip({ status, settings, testID }: { status: 'PASS' | 'WARN' | 'BLOCK'; settings: MotionSettings; testID: string }) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const escalated = status !== 'PASS';
  useEffect(() => {
    if (!escalated) return;
    // F74-02: pass the total explicitly (a default parameter is unsafe on the UI thread).
    scale.set(animatePulseOnce(1.12, 1, settings, SPEC_LITERALS.escalationPulseMs));
  }, [escalated, settings, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View style={style} entering={FadeIn.duration(REDUCED_FADE_MS).reduceMotion(ReduceMotion.System)}>
      <StatusChip
        size="sm"
        tone={precheckTone(status)}
        label={t(`common.precheckStatus.${status}`)}
        icon={status === 'PASS' ? 'CircleCheck' : status === 'WARN' ? 'TriangleAlert' : CircleX}
        testID={testID}
      />
    </Animated.View>
  );
}

/** One haptic when the gate resolves (§7.6): WARN → Warning, BLOCK → Error. */
function useGateHaptics(phase: GatePhase): void {
  const previous = useRef<GatePhase>(phase);
  useEffect(() => {
    const before = previous.current;
    previous.current = phase;
    if (before === phase) return;
    if (phase === 'warn') triggerHaptic('gateWarn');
    else if (phase === 'block') triggerHaptic('gateBlock');
  }, [phase]);
}

const styles = StyleSheet.create({
  demonstration: { flexDirection: 'row', marginBottom: 8 },
  stack: { gap: spacing[3] },
  stackTight: { gap: spacing[2] },
  ackRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 48 },
});
