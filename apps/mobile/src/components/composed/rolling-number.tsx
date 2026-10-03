/**
 * C-6 RollingNumber (04_mobile_specs §4.0, §7.4 M-C-02; 03_motion_spec M-C-02, App. A).
 *
 * - `slide` (clocks and timers): per-digit columns whose `translateY` rolls on the UI thread
 *   (240 ms `standard`), odometer-style across wraps; tabular figures, so nothing jitters.
 * - `count` (KPIs): the same clipped digit columns as continuous drums driven by a `counter`
 *   spring, after the 120 ms held beat on first mount (03M R4). No React render per animation frame
 *   in either mode.
 *
 * Deviation from 04 §4.0 (recorded in the step-71 log): the spec's read-only TextInput whose text
 * is written by `useAnimatedProps` did not update on the Fabric debug build (device check,
 * step 71), so `count` reuses the digit columns.
 *
 * `value` may be a number (React) or a shared value (UI thread, e.g. a clock-derived timer).
 * Reduced motion: values jump to their final state (03M §8).
 */
import { useEffect, useRef, useState } from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { fontFamily, motion as motionTokens, palette, typography, type TypographyToken } from '@dems/shared/tokens';
import {
  COLUMN_CELLS,
  COUNTER_SPRING,
  HELD_BEAT_MS,
  INTEGER,
  SLIDE_MS,
  baseTemplate,
  digitFromEnd,
  drumPosition,
  formatRolling,
  placesOf,
  rollPlan,
  templateOf,
  type RollingFormat,
} from './rolling-number.math';

export type { RollingFormat } from './rolling-number.math';

export interface RollingNumberProps {
  value: number | SharedValue<number>;
  mode?: 'slide' | 'count';
  format?: RollingFormat;
  /** Motion policy from `useMotionPolicy()` (04 §7.7). */
  motion: 'full' | 'reduced';
  /** Typography token (01_specs §2.7); `display` is the Orbitron 32/40 readout. */
  size?: TypographyToken;
  face?: 'display' | 'mono' | 'sans';
  /** Token colour; defaults to the foreground. */
  color?: string;
  prefix?: string;
  suffix?: string;
  /** `count` mode: delay before the first count-up (R4 held beat). */
  heldBeatMs?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Required when `value` is a shared value (the screen refreshes it at ≤ 1 Hz). */
  accessibilityLabel?: string;
}

const STANDARD = Easing.bezier(...motionTokens.easing.standard);
const CELLS = Array.from({ length: COLUMN_CELLS }, (_, i) => String(i % 10));

function textStyleFor(size: TypographyToken, face: 'display' | 'mono' | 'sans', color: string): TextStyle {
  const t = typography[size];
  const family =
    face === 'display' ? fontFamily.native.display : face === 'mono' ? fontFamily.native.monoMedium : fontFamily.native.semibold;
  return {
    fontFamily: family,
    fontSize: t.size,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing * t.size,
    color,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    // Orbitron has no tabular figures: each column is as wide as its widest digit, so narrow
    // digits are centred in it rather than left-aligned ("02:53:1 5" on device).
    textAlign: 'center',
  };
}

export function RollingNumber({
  value,
  mode = 'slide',
  format = INTEGER,
  motion,
  size = 'display',
  face,
  color = palette.foreground,
  prefix = '',
  suffix = '',
  heldBeatMs = HELD_BEAT_MS,
  style,
  testID,
  accessibilityLabel,
}: RollingNumberProps) {
  const reduced = motion === 'reduced';
  const textStyle = textStyleFor(size, face ?? (size === 'display' ? 'display' : 'mono'), color);
  const lineHeight = typography[size].lineHeight;
  const label =
    accessibilityLabel ?? (typeof value === 'number' ? `${prefix}${formatRolling(value, format)}${suffix}` : undefined);

  return (
    <View testID={testID} style={[{ flexDirection: 'row', alignItems: 'center' }, style]} accessible accessibilityLabel={label}>
      {mode === 'count' ? (
        <CountNumber
          testID={testID}
          value={value}
          format={format}
          textStyle={textStyle}
          lineHeight={lineHeight}
          reduced={reduced}
          prefix={prefix}
          suffix={suffix}
          heldBeatMs={heldBeatMs}
        />
      ) : (
        <SlideNumber
          testID={testID}
          value={value}
          format={format}
          textStyle={textStyle}
          lineHeight={lineHeight}
          reduced={reduced}
          prefix={prefix}
          suffix={suffix}
        />
      )}
    </View>
  );
}

interface SlideNumberProps {
  testID?: string;
  value: number | SharedValue<number>;
  format: RollingFormat;
  textStyle: TextStyle;
  lineHeight: number;
  reduced: boolean;
  prefix: string;
  suffix: string;
}

function SlideNumber({ testID, value, format, textStyle, lineHeight, reduced, prefix, suffix }: SlideNumberProps) {
  const external = typeof value === 'number' ? null : value;
  const numeric = typeof value === 'number' ? value : null;
  const internal = useSharedValue(numeric ?? 0);
  const source = external ?? internal;
  useEffect(() => {
    if (numeric !== null) internal.set(numeric);
  }, [numeric, internal]);

  // The column layout (digits vs separators) follows the formatted value; it changes rarely
  // (9 → 10, a sign), so a React update is fine there, never per animation frame.
  const [template, setTemplate] = useState(() =>
    numeric !== null ? templateOf(formatRolling(numeric, format)) : baseTemplate(format),
  );
  const currentTemplate = useSharedValue(template);
  useAnimatedReaction(
    () => templateOf(formatRolling(source.get(), format)),
    (next) => {
      if (next !== currentTemplate.get()) {
        currentTemplate.set(next);
        scheduleOnRN(setTemplate, next);
      }
    },
    [format],
  );

  const chars = template.split('');
  return (
    <>
      {prefix ? <Text style={textStyle}>{prefix}</Text> : null}
      {chars.map((ch, i) => {
        const fromEnd = chars.length - i;
        return ch === 'd' ? (
          <DigitColumn
            key={`d${fromEnd}`}
            testID={testID ? `${testID}-d${fromEnd}` : undefined}
            source={source}
            format={format}
            positionFromEnd={fromEnd}
            initialDigit={numeric !== null ? digitFromEnd(numeric, format, fromEnd) : -1}
            textStyle={textStyle}
            lineHeight={lineHeight}
            reduced={reduced}
          />
        ) : (
          <Text key={`s${fromEnd}`} style={textStyle}>
            {ch}
          </Text>
        );
      })}
      {suffix ? <Text style={textStyle}>{suffix}</Text> : null}
    </>
  );
}

interface DigitColumnProps {
  testID?: string;
  source: SharedValue<number>;
  format: RollingFormat;
  positionFromEnd: number;
  initialDigit: number;
  textStyle: TextStyle;
  lineHeight: number;
  reduced: boolean;
}

/** One digit: a clipped column of 20 cells rolled by `translateY` on the UI thread. */
function DigitColumn({ testID, source, format, positionFromEnd, initialDigit, textStyle, lineHeight, reduced }: DigitColumnProps) {
  const cell = useSharedValue(initialDigit >= 0 ? initialDigit : 0);
  useAnimatedReaction(
    () => digitFromEnd(source.get(), format, positionFromEnd),
    (digit, previous) => {
      if (digit < 0) return;
      if (previous === null || previous < 0 || reduced) {
        cell.set(digit);
        return;
      }
      const plan = rollPlan(previous, digit);
      if (plan.from !== null) cell.set(plan.from);
      const settle = plan.settle;
      cell.set(
        withTiming(plan.to, { duration: SLIDE_MS, easing: STANDARD }, (finished) => {
          if (finished && settle !== null) cell.set(settle);
        }),
      );
    },
    [format, positionFromEnd, reduced],
  );
  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: -cell.get() * lineHeight }] }));

  return (
    <View style={{ height: lineHeight, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
      <Animated.View testID={testID} style={roll}>
        {CELLS.map((d, i) => (
          <Text key={i} style={[textStyle, { height: lineHeight }]}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

interface CountNumberProps {
  testID?: string;
  value: number | SharedValue<number>;
  format: RollingFormat;
  textStyle: TextStyle;
  lineHeight: number;
  reduced: boolean;
  prefix: string;
  suffix: string;
  heldBeatMs: number;
}

function CountNumber({ testID, value, format, textStyle, lineHeight, reduced, prefix, suffix, heldBeatMs }: CountNumberProps) {
  const external = typeof value === 'number' ? null : value;
  const numeric = typeof value === 'number' ? value : null;
  const counted = useSharedValue(reduced && numeric !== null ? numeric : 0);
  const mounted = useRef(false);
  useEffect(() => {
    if (numeric === null) return;
    const first = !mounted.current;
    mounted.current = true;
    if (reduced) {
      counted.set(numeric);
      return;
    }
    const spring = withSpring(numeric, COUNTER_SPRING);
    counted.set(first ? withDelay(heldBeatMs, spring) : spring);
  }, [numeric, reduced, heldBeatMs, counted]);

  const source = external ?? counted;
  // Columns follow the target's shape (20 → "dd"), so the width never jumps while counting.
  const template = numeric !== null ? templateOf(formatRolling(numeric, format)) : baseTemplate(format);
  const places = placesOf(template);
  const leadIndex = places.findIndex((p) => p !== null);
  return (
    <>
      {prefix ? <Text style={textStyle}>{prefix}</Text> : null}
      {template.split('').map((ch, i) => {
        const place = places[i];
        const fromEnd = template.length - i;
        return place === null || place === undefined ? (
          <Text key={`s${fromEnd}`} style={textStyle}>
            {ch}
          </Text>
        ) : (
          <DrumColumn
            key={`d${fromEnd}`}
            testID={testID ? `${testID}-d${fromEnd}` : undefined}
            source={source}
            place={place}
            leading={i === leadIndex}
            textStyle={textStyle}
            lineHeight={lineHeight}
          />
        );
      })}
      {suffix ? <Text style={textStyle}>{suffix}</Text> : null}
    </>
  );
}

interface DrumColumnProps {
  testID?: string;
  source: SharedValue<number>;
  place: number;
  leading: boolean;
  textStyle: TextStyle;
  lineHeight: number;
}

/** A continuous drum: the column turns with the counter; a leading zero stays hidden. */
function DrumColumn({ testID, source, place, leading, textStyle, lineHeight }: DrumColumnProps) {
  const drum = useAnimatedStyle(() => {
    const v = Math.abs(source.get());
    const hidden = leading && place > 0 && v < Math.pow(10, place) - 0.5;
    return { opacity: hidden ? 0 : 1, transform: [{ translateY: -drumPosition(v, place) * lineHeight }] };
  });
  return (
    <View style={{ height: lineHeight, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
      <Animated.View testID={testID} style={drum}>
        {CELLS.map((d, i) => (
          <Text key={i} style={[textStyle, { height: lineHeight }]}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}
