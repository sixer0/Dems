/**
 * C-4 Stepper (04_mobile_specs §4.0, §4.4, §4.6; 03_motion_spec M-C-09, App. A).
 *
 * Horizontal wizard (MB 3: numbered badges, gold lead-in, half-filled connector after the active
 * step) or vertical pipeline (finalization, recovery, export, update). Built from kit `Chip`
 * badges, kit `Separator` tracks and `Spinner`, with Reanimated fills: connectors grow with
 * `scaleX`/`scaleY` (420 ms `luxe`), the check draws in 300 ms, an activated or escalated badge
 * pulses its halo once (03M R8). Composite-only properties; reduced motion is instant.
 *
 * Post-review fix FXR-M (finding W93-7; D236, the FX-M2b pattern of D208): React holds every REST value —
 * the connector fill (`scaleX`/`scaleY` 0 or 1), the glow ring (opacity 0 or 1) and the drawn check — in the
 * views' own props. Each motion is an overlay mounted for one change and removed by React after its budget
 * (`useChangeOverlay`); while it plays, the React-held view of that part is hidden. So a Reanimated update
 * that is dropped (a JS stall, or a view removed while its animation runs) can never leave a half-filled
 * connector, a missing check or a stuck ring: after the budget React draws the final state. `animate={false}`
 * (the in-place hand-over copies, which mount and are removed within ~0.5 s, CF2-A's "Unable to find
 * SurfaceMountingManager" bursts) starts no motion at all: no overlay, no entering fade, a still Spinner.
 */
import { Chip, Separator, Spinner, Typography } from 'heroui-native';
import { LoaderCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
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
  /**
   * False for a copy drawn in place for a moment (a hand-over): no motion is started (W93-7). Default true.
   */
  animate?: boolean;
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
  animate = true,
  style,
  testID,
}: StepperProps) {
  const reduced = motion === 'reduced';
  // No motion at all: reduced motion, or a copy drawn in place for a moment (W93-7).
  const still = reduced || !animate;
  const partId = (part: string, i: number): string | undefined => (testID ? `${testID}-${part}-${i}` : undefined);
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
              entering={still ? undefined : FadeIn.duration(motionTokens.duration.base).delay(staggerDelay(i))}
              style={{ flexDirection: 'row', gap: 14 }}
            >
              <View style={{ alignItems: 'center', width: BADGE }}>
                <StepBadge index={i} status={status} still={still} testID={partId('badge', i)} />
                {i < last ? (
                  <ConnectorHalf
                    testID={partId('fill', i)}
                    orientation="vertical"
                    filled={status === 'done'}
                    still={still}
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
            entering={still ? undefined : FadeIn.duration(motionTokens.duration.base).delay(staggerDelay(i))}
            style={{ flex: 1, alignItems: 'center', gap: 8 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
              {/* The connector between two badges is two halves: the right half of step i fills as
                  soon as it starts; the left half of step i + 1 follows once step i is done. */}
              <ConnectorHalf
                testID={partId('fill-left', i)}
                orientation="horizontal"
                filled={leftFilled}
                still={still}
                duration={CONNECTOR_FILL_MS / 2}
                delay={CONNECTOR_FILL_MS / 2}
                easing={EASE_OUT}
                style={{ flex: 1, height: 2 }}
              />
              <StepBadge index={i} status={status} still={still} testID={partId('badge', i)} />
              <ConnectorHalf
                testID={partId('fill-right', i)}
                orientation="horizontal"
                filled={rightFilled}
                still={still}
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

/** Extra time an overlay stays mounted after its motion's own duration, before React removes it (ms). */
export const STEPPER_OVERLAY_SLACK_MS = 80;

/**
 * The motion of one change of `value` while it plays (the FX-M2b pattern): `{ id, from }` from the change
 * until `budgetMs` later, then `null`; always `null` while `enabled` is false. The caller draws the FINAL
 * state with React whenever this is `null`, and an overlay keyed by `id` while it is not.
 */
function useChangeOverlay<T>(value: T, enabled: boolean, budgetMs: number): { readonly id: number; readonly from: T } | null {
  const [state, setState] = useState<{ value: T; seq: number; run: { id: number; from: T } | null }>({ value, seq: 0, run: null });
  let current = state;
  if (state.value !== value) {
    // "Adjusting state when a prop changes": the run starts in the render that sees the change.
    const seq = state.seq + 1;
    current = { value, seq, run: enabled ? { id: seq, from: state.value } : null };
    setState(current);
  }
  const runId = current.run?.id ?? null;
  useEffect(() => {
    if (runId === null) return undefined;
    const handle = setTimeout(() => setState((s) => (s.run?.id === runId ? { ...s, run: null } : s)), budgetMs);
    return () => clearTimeout(handle);
  }, [runId, budgetMs]);
  return current.run;
}

interface ConnectorHalfProps {
  orientation: 'horizontal' | 'vertical';
  filled: boolean;
  still: boolean;
  duration: number;
  delay?: number;
  easing: ReturnType<typeof Easing.bezier>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const scaleFor = (horizontal: boolean, value: number) => (horizontal ? { scaleX: value } : { scaleY: value });

/** A kit Separator track with a gold fill that grows from its start edge; React holds the rest fill (W93-7). */
function ConnectorHalf({ orientation, filled, still, duration, delay = 0, easing, style, testID }: ConnectorHalfProps) {
  const run = useChangeOverlay(filled, !still, delay + duration + STEPPER_OVERLAY_SLACK_MS);
  const horizontal = orientation === 'horizontal';
  const fillLook = { backgroundColor: palette.gold, borderRadius: 1, transformOrigin: horizontal ? 'left' : 'top' } as const;
  return (
    <View style={[{ justifyContent: 'center' }, style]} importantForAccessibility="no-hide-descendants">
      <Separator orientation={orientation} thickness={2} style={StyleSheet.absoluteFill} />
      {/* The rest value, drawn by React; hidden while the overlay below plays the change. */}
      <View testID={testID} style={[StyleSheet.absoluteFill, fillLook, { transform: [scaleFor(horizontal, run || !filled ? 0 : 1)] }]} />
      {run ? (
        <FillMotion
          key={run.id}
          testID={testID ? `${testID}-motion` : undefined}
          horizontal={horizontal}
          from={run.from ? 1 : 0}
          to={filled ? 1 : 0}
          duration={duration}
          delay={filled ? delay : 0}
          easing={easing}
          look={fillLook}
        />
      ) : null}
    </View>
  );
}

interface FillMotionProps {
  testID?: string;
  horizontal: boolean;
  from: number;
  to: number;
  duration: number;
  delay: number;
  easing: ReturnType<typeof Easing.bezier>;
  look: ViewStyle;
}

/** The removable overlay of one connector change: a fill from `from` to `to`. */
function FillMotion({ testID, horizontal, from, to, duration, delay, easing, look }: FillMotionProps) {
  const fill = useSharedValue(from);
  useEffect(() => {
    const timing = withTiming(to, { duration, easing });
    fill.set(delay > 0 ? withDelay(delay, timing) : timing);
  }, [to, duration, delay, easing, fill]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [scaleFor(horizontal, fill.get())] }));
  return <Animated.View testID={testID} style={[StyleSheet.absoluteFill, look, fillStyle]} />;
}

interface StepBadgeProps {
  index: number;
  status: StepStatus;
  still: boolean;
  testID?: string;
}

const isLit = (status: StepStatus): boolean => status === 'active' || status === 'running';
const pulses = (status: StepStatus): boolean => isLit(status) || status === 'warn' || status === 'error';

/**
 * Numbered kit Chip; done draws a check, running shows a Spinner; a glow ring marks the current step.
 * React holds the ring's opacity and the drawn check (W93-7); the ring fade, the check draw and the halo
 * pulse are overlays for one change each.
 */
function StepBadge({ index, status, still, testID }: StepBadgeProps) {
  const tone = stepTone(status);
  const lit = isLit(status);
  const done = status === 'done';
  const ringRun = useChangeOverlay(lit, !still, motionTokens.duration.base + STEPPER_OVERLAY_SLACK_MS);
  const checkRun = useChangeOverlay(done, !still, CHECK_DRAW_MS + STEPPER_OVERLAY_SLACK_MS);
  const haloRun = useChangeOverlay(status, !still, HALO_PULSE_MS + STEPPER_OVERLAY_SLACK_MS);
  const drawCheck = checkRun !== null && done;
  const part = (name: string): string | undefined => (testID ? `${testID}-${name}` : undefined);

  const toneColor = toneHex[tone];
  const chip =
    status === 'active'
      ? { variant: 'primary' as const, color: 'accent' as const }
      : status === 'pending'
        ? { variant: 'tertiary' as const, color: 'default' as const }
        : { variant: 'soft' as const, color: tone };
  const ringLook: ViewStyle = {
    width: BADGE + 10,
    height: BADGE + 10,
    borderRadius: (BADGE + 10) / 2,
    borderWidth: 1,
    borderColor: withAlpha(palette.gold, 0.45),
    backgroundColor: withAlpha(palette.gold, 0.1),
  };

  return (
    <View style={{ width: BADGE, height: BADGE, alignItems: 'center', justifyContent: 'center' }}>
      <View testID={part('ring')} pointerEvents="none" style={[styles.circle, ringLook, { opacity: ringRun || !lit ? 0 : 1 }]} />
      {ringRun ? <FadeMotion key={ringRun.id} testID={part('ring-motion')} from={ringRun.from ? 1 : 0} to={lit ? 1 : 0} look={ringLook} /> : null}
      {haloRun && pulses(status) ? (
        <HaloMotion key={haloRun.id} testID={part('halo-motion')} look={{ width: BADGE, height: BADGE, borderRadius: BADGE / 2, backgroundColor: withAlpha(toneColor, 0.45) }} />
      ) : null}
      <Chip
        variant={chip.variant}
        color={chip.color}
        className={status === 'pending' ? 'border border-border' : undefined}
        style={{ width: BADGE, height: BADGE, borderRadius: BADGE / 2, paddingHorizontal: 0, paddingVertical: 0 }}
        importantForAccessibility="no-hide-descendants"
        accessible={false}
      >
        {status === 'running' ? (
          // Wave H driver B (gate 89, G89-02 = B9): a still copy owns NO Reanimated indicator. The kit Spinner keeps a
          // shared value even with `animation="disable-all"` and cancels it when it unmounts - one write to a view
          // tag that is being removed per finished step (the "Unable to find SurfaceMountingManager" bursts of the
          // hand-over). The same glyph, drawn by React alone.
          still ? (
            <LoaderCircle testID={part('running')} size={18} color={palette.gold} />
          ) : (
            <Spinner size="sm" color={palette.gold} />
          )
        ) : done ? (
          <Svg width={18} height={18} viewBox="0 0 24 24">
            {drawCheck ? (
              <CheckDrawMotion key={checkRun.id} />
            ) : (
              <Path testID={part('check')} d={CHECK_PATH} stroke={palette.gold} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            )}
          </Svg>
        ) : (
          <Chip.Label>{String(index + 1)}</Chip.Label>
        )}
      </Chip>
    </View>
  );
}

const CHECK_PATH = 'M5 12.5l4.2 4.2L19 7';

/** The ring's removable fade overlay. */
function FadeMotion({ testID, from, to, look }: { testID?: string; from: number; to: number; look: ViewStyle }) {
  const opacity = useSharedValue(from);
  useEffect(() => {
    opacity.set(withTiming(to, { duration: motionTokens.duration.base, easing: LUXE }));
  }, [to, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View testID={testID} pointerEvents="none" style={[styles.circle, look, style]} />;
}

/** One halo pulse (03M R8): rest opacity 0, removed after `HALO_PULSE_MS`. */
function HaloMotion({ testID, look }: { testID?: string; look: ViewStyle }) {
  const halo = useSharedValue(0);
  useEffect(() => {
    halo.set(withTiming(1, { duration: HALO_PULSE_MS, easing: LUXE }));
  }, [halo]);
  const style = useAnimatedStyle(() => {
    const h = halo.get();
    return { opacity: h > 0 && h < 1 ? 0.5 * (1 - h) : 0, transform: [{ scale: 1 + 0.35 * h }] };
  });
  return <Animated.View testID={testID} pointerEvents="none" style={[styles.circle, look, style]} />;
}

/** The check drawing itself in (300 ms); replaced by the React-drawn check once its budget is over. */
function CheckDrawMotion() {
  const check = useSharedValue(0);
  useEffect(() => {
    check.set(withTiming(1, { duration: CHECK_DRAW_MS, easing: LUXE }));
  }, [check]);
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - check.get()) }));
  return (
    <AnimatedPath
      d={CHECK_PATH}
      stroke={palette.gold}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      strokeDasharray={[CHECK_LENGTH, CHECK_LENGTH]}
      animatedProps={checkProps}
    />
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute' },
});
