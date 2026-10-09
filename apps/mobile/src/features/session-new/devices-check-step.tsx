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
import { Alert, Button, Checkbox, Label, ListGroup, Separator, Spinner, Typography } from 'heroui-native';
import { CircleX } from 'lucide-react-native';
import { Fragment, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSim, type PrecheckItem, type PrecheckSlice } from '@dems/shared/sim';
import { spacing } from '@dems/shared/tokens';
import { SectionCard, StatusChip } from '@/components/kit';
import { PrecheckCaptureNotices, precheckSentence, usePrecheckSentence } from '@/features/capture-selector/capture-notices';
import { PrecheckSourceBadge } from '@/features/capture-selector/development-source-badge';
import { REDUCED_FADE_MS, SPEC_LITERALS, animatePulseOnce, rowReveal, triggerHaptic, useMotionSettings, type MotionSettings } from '@/motion';
import { PendingSpinner, busyState } from '@/runtime';
import { CheckIcon } from './check-icon';
import { DevicePreviews } from './device-previews';
import { CHECK_ORDER, checkMicBinding, itemsWith, micRoleLine, precheckTone, resolvedCount, valueKey, type GatePhase } from './session-new-model';

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
  const settings = useMotionSettings();
  const items = precheck?.items ?? [];
  const done = resolvedCount(items);
  const blocks = itemsWith(items, 'BLOCK');
  const coreBlocked = live && blocks.some((item) => item.id === 'CORE');
  useGateHaptics(phase);

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

        {phase === 'block' || (phase === 'warn' && !armed) ? (
          <Button
            variant="outline"
            size="md"
            onPress={onRetry}
            testID="session-new-retry-checks"
            {...busyState(retryBusy)}
          >
            {retryPending ? <PendingSpinner testID="session-new-retry-spinner" /> : null}
            <Button.Label>{t('features.session-new.devices.retry')}</Button.Label>
          </Button>
        ) : null}
      </SectionCard>
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
  const tone = precheckTone(status);
  const value = item?.value ?? null;
  // Task 3 row 138 (D114): the sentence of an unreachable capture device, from `params.rule`; null for any other item.
  const unreachable = usePrecheckSentence(resolved ? item : null);
  let description: string;
  if (!resolved) description = status === 'RUNNING' ? t('sessionNew.devices.resolving') : t('common.precheckStatus.PENDING');
  else if (unreachable !== null) description = unreachable;
  else if (id === 'SECURITY' && status === 'WARN') description = t('features.session-new.devices.tamper');
  else description = t(valueKey(id, value ?? ''), { defaultValue: value ?? '' });
  // Task 3 row 68 (MB-02): a microphone row names the role its input holds in the selector, and the input.
  const binding = checkMicBinding(id, roleLine);
  const roleText = binding ? t('features.capture-selector.precheck.micRole', { role: t(`features.capture-selector.selector.role.${binding.role}`), input: binding.inputId }) : null;

  return (
    <ListGroup.Item testID={`session-new-check-${id}`} accessibilityLabel={`${t(`sessionNew.devices.checks.${id}`)}, ${description}, ${t(`common.precheckStatus.${status}`)}`}>
      <ListGroup.ItemPrefix>
        <CheckIcon id={id} tone={resolved ? tone : 'default'} />
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle>{t(`sessionNew.devices.checks.${id}`)}</ListGroup.ItemTitle>
        <ListGroup.ItemDescription testID={`session-new-check-${id}-value`}>{description}</ListGroup.ItemDescription>
        {roleText ? <ListGroup.ItemDescription testID={`session-new-check-${id}-role`}>{roleText}</ListGroup.ItemDescription> : null}
        <PrecheckSourceBadge checkId={id} />
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        {resolved ? (
          <ResultChip status={status} settings={settings} testID={`session-new-check-${id}-status`} />
        ) : status === 'RUNNING' ? (
          <Spinner size="sm" testID={`session-new-check-${id}-spinner`} />
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
  stack: { gap: spacing[3] },
  stackTight: { gap: spacing[2] },
  ackRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 48 },
});
