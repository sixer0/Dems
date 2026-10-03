/**
 * C-4 Stepper (04_mobile_specs §4.0, §4.4, §4.6; 03_motion_spec M-C-09, App. A).
 *
 * Horizontal wizard (MB 3: numbered badges, gold lead-in, half-filled connector after the active
 * step) or vertical pipeline (finalization, recovery, export, update). Built from kit `Chip`
 * badges, kit `Separator` tracks and `Spinner`, with Reanimated fills: connectors grow with
 * `scaleX`/`scaleY` (420 ms `luxe`), the check draws in 300 ms, an activated or escalated badge
 * pulses its halo once (03M R8). Composite-only properties; reduced motion is instant.
 */
import { Chip, Separator, Spinner, Typography } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { motion as motionTokens, palette, toneHex } from '@dems/shared/tokens';
import { withAlpha } from '@/components/media/color';
import {
  CHECK_DRAW_MS,
  CONNECTOR_FILL_MS,
  DEFAULT_STATUS_WORDS,
  HALO_PULSE_MS,
  connectorFill,
  deriveStatuses,
  leadFilled,
  stepA11yLabel,
  stepTone,
  staggerDelay,
  type StepDef,
  type StepStatus,
  type StepStatusWords,
} from './stepper.math';

export type { StepDef, StepStatus, StepStatusWords } from './stepper.math';

export interface StepperProps {
  steps: readonly StepDef[];
  /** Index of the active step (wizard); ignored when `statuses` is given. */
  current?: number;
  /** Explicit statuses (pipeline results, warnings); same length as `steps`. */
  statuses?: readonly StepStatus[];
  orientation?: 'horizontal' | 'vertical';
  /** Motion policy from `useMotionPolicy()` (04 §7.7). */
  motion: 'full' | 'reduced';
  statusWords?: StepStatusWords;
  /** Optional: lets the operator jump back to a completed step. */
  onStepPress?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const LUXE = Easing.bezier(...motionTokens.easing.luxe);
const EASE_IN = Easing.bezier(0.5, 0, 1, 1);
const EASE_OUT = Easing.bezier(0, 0, 0.36, 1);
const BADGE = 32;
const CHECK_LENGTH = 22;
const AnimatedPath = Animated.createAnimatedComponent(Path);

export function Stepper({
  steps,
  current = 0,
  statuses: explicit,
  orientation = 'horizontal',
  motion,
  statusWords = DEFAULT_STATUS_WORDS,
  onStepPress,
  style,
  testID,
}: StepperProps) {
  const reduced = motion === 'reduced';
  const statuses = explicit ?? deriveStatuses(steps.length, current);
  const last = steps.length - 1;

  if (orientation === 'vertical') {
    return (
      <View testID={testID} style={style}>
        {steps.map((step, i) => {
          const status = statuses[i] ?? 'pending';
          return (
            <Animated.View
              key={step.key}
              entering={reduced ? undefined : FadeIn.duration(motionTokens.duration.base).delay(staggerDelay(i))}
              style={{ flexDirection: 'row', gap: 14 }}
            >
              <View style={{ alignItems: 'center', width: BADGE }}>
                <StepBadge index={i} status={status} reduced={reduced} />
                {i < last ? (
                  <ConnectorHalf
                    orientation="vertical"
                    filled={status === 'done'}
                    reduced={reduced}
                    duration={CONNECTOR_FILL_MS}
                    easing={LUXE}
                    style={{ width: 2, flex: 1, minHeight: 18, marginVertical: 4 }}
                  />
                ) : null}
              </View>
              <StepText
                testID={testID ? `${testID}-step-${i}` : undefined}
                label={step.label}
                description={step.description}
                status={status}
                a11y={stepA11yLabel(i, steps.length, step.label, status, statusWords)}
                style={{ flex: 1, paddingTop: 5, paddingBottom: i < last ? 18 : 0 }}
                onPress={onStepPress && status === 'done' ? () => onStepPress(i) : undefined}
              />
            </Animated.View>
          );
        })}
      </View>
    );
  }

  return (
    <View testID={testID} style={[{ flexDirection: 'row' }, style]}>
      {steps.map((step, i) => {
        const status = statuses[i] ?? 'pending';
        const leftFilled = i === 0 ? leadFilled(statuses[0]) : connectorFill(statuses[i - 1] ?? 'pending') >= 1;
        const rightFilled = i === last ? status === 'done' : connectorFill(status) > 0;
        return (
          <Animated.View
            key={step.key}
            entering={reduced ? undefined : FadeIn.duration(motionTokens.duration.base).delay(staggerDelay(i))}
            style={{ flex: 1, alignItems: 'center', gap: 8 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
              {/* The connector between two badges is two halves: the right half of step i fills as
                  soon as it starts; the left half of step i + 1 follows once step i is done. */}
              <ConnectorHalf
                orientation="horizontal"
                filled={leftFilled}
                reduced={reduced}
                duration={CONNECTOR_FILL_MS / 2}
                delay={CONNECTOR_FILL_MS / 2}
                easing={EASE_OUT}
                style={{ flex: 1, height: 2 }}
              />
              <StepBadge index={i} status={status} reduced={reduced} />
              <ConnectorHalf
                orientation="horizontal"
                filled={rightFilled}
                reduced={reduced}
                duration={CONNECTOR_FILL_MS / 2}
                easing={EASE_IN}
                style={{ flex: 1, height: 2 }}
              />
            </View>
            <StepText
              testID={testID ? `${testID}-step-${i}` : undefined}
              label={step.label}
              status={status}
              a11y={stepA11yLabel(i, steps.length, step.label, status, statusWords)}
              align="center"
              onPress={onStepPress && status === 'done' ? () => onStepPress(i) : undefined}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

interface StepTextProps {
  testID?: string;
  label: string;
  description?: string;
  status: StepStatus;
  a11y: string;
  align?: 'start' | 'center';
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

function StepText({ testID, label, description, status, a11y, align = 'start', style, onPress }: StepTextProps) {
  const current = status === 'active' || status === 'running';
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={a11y}
      accessibilityState={{ selected: current, disabled: !onPress }}
      style={style}
    >
      <Typography type="body-xs" align={align} weight={current ? 'semibold' : 'medium'} color={current ? 'default' : 'muted'}>
        {label}
      </Typography>
      {description ? (
        <Typography type="body-xs" color="muted">
          {description}
        </Typography>
      ) : null}
    </Pressable>
  );
}

interface ConnectorHalfProps {
  orientation: 'horizontal' | 'vertical';
  filled: boolean;
  reduced: boolean;
  duration: number;
  delay?: number;
  easing: ReturnType<typeof Easing.bezier>;
  style?: StyleProp<ViewStyle>;
}

/** A kit Separator track with a gold fill that grows from its start edge. */
function ConnectorHalf({ orientation, filled, reduced, duration, delay = 0, easing, style }: ConnectorHalfProps) {
  const fill = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    const target = filled ? 1 : 0;
    if (reduced) {
      fill.set(target);
      return;
    }
    const timing = withTiming(target, { duration, easing });
    fill.set(filled ? withDelay(delay, timing) : timing);
  }, [filled, reduced, duration, delay, easing, fill]);

  const horizontal = orientation === 'horizontal';
  const fillStyle = useAnimatedStyle(() =>
    horizontal ? { transform: [{ scaleX: fill.get() }] } : { transform: [{ scaleY: fill.get() }] },
  );
  return (
    <View style={[{ justifyContent: 'center' }, style]} importantForAccessibility="no-hide-descendants">
      <Separator orientation={orientation} thickness={2} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: palette.gold, borderRadius: 1, transformOrigin: horizontal ? 'left' : 'top' },
          fillStyle,
        ]}
      />
    </View>
  );
}

interface StepBadgeProps {
  index: number;
  status: StepStatus;
  reduced: boolean;
}

/** Numbered kit Chip; done draws a check, running shows a Spinner; a glow ring marks the current step. */
function StepBadge({ index, status, reduced }: StepBadgeProps) {
  const tone = stepTone(status);
  const lit = status === 'active' || status === 'running';
  const ring = useSharedValue(lit ? 1 : 0);
  const halo = useSharedValue(0);
  const check = useSharedValue(status === 'done' ? 1 : 0);
  const previous = useRef(status);

  useEffect(() => {
    const from = previous.current;
    previous.current = status;
    if (from === status) return;
    const nowLit = status === 'active' || status === 'running';
    if (reduced) {
      ring.set(nowLit ? 1 : 0);
      check.set(status === 'done' ? 1 : 0);
      return;
    }
    ring.set(withTiming(nowLit ? 1 : 0, { duration: motionTokens.duration.base, easing: LUXE }));
    if (status === 'done') {
      check.set(0);
      check.set(withTiming(1, { duration: CHECK_DRAW_MS, easing: LUXE }));
    } else {
      check.set(0);
    }
    if (nowLit || status === 'warn' || status === 'error') {
      halo.set(0);
      halo.set(withTiming(1, { duration: HALO_PULSE_MS, easing: LUXE }));
    }
  }, [status, reduced, ring, halo, check]);

  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.get() }));
  const haloStyle = useAnimatedStyle(() => {
    const h = halo.get();
    return { opacity: h > 0 && h < 1 ? 0.5 * (1 - h) : 0, transform: [{ scale: 1 + 0.35 * h }] };
  });
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - check.get()) }));

  const toneColor = toneHex[tone];
  const chip =
    status === 'active'
      ? { variant: 'primary' as const, color: 'accent' as const }
      : status === 'pending'
        ? { variant: 'tertiary' as const, color: 'default' as const }
        : { variant: 'soft' as const, color: tone };

  return (
    <View style={{ width: BADGE, height: BADGE, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.circle,
          { width: BADGE + 10, height: BADGE + 10, borderRadius: (BADGE + 10) / 2 },
          { borderWidth: 1, borderColor: withAlpha(palette.gold, 0.45), backgroundColor: withAlpha(palette.gold, 0.1) },
          ringStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.circle, { width: BADGE, height: BADGE, borderRadius: BADGE / 2, backgroundColor: withAlpha(toneColor, 0.45) }, haloStyle]}
      />
      <Chip
        variant={chip.variant}
        color={chip.color}
        className={status === 'pending' ? 'border border-border' : undefined}
        style={{ width: BADGE, height: BADGE, borderRadius: BADGE / 2, paddingHorizontal: 0, paddingVertical: 0 }}
        importantForAccessibility="no-hide-descendants"
        accessible={false}
      >
        {status === 'running' ? (
          <Spinner size="sm" color={palette.gold} />
        ) : status === 'done' ? (
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <AnimatedPath
              d="M5 12.5l4.2 4.2L19 7"
              stroke={palette.gold}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[CHECK_LENGTH, CHECK_LENGTH]}
              animatedProps={checkProps}
            />
          </Svg>
        ) : (
          <Chip.Label>{String(index + 1)}</Chip.Label>
        )}
      </Chip>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute' },
});
