/**
 * C-6 RollingNumber (04_mobile_specs §4.0, §7.4 M-C-02; 03_motion_spec M-C-02, App. A).
 *
 * - `slide` (clocks, timers, counters): per-digit columns, odometer-style across wraps (240 ms
 *   `standard`); tabular figures, so nothing jitters. Post-review fix FXR-M (finding W93-3, the D214
 *   defect): React holds each column's position (the current digit's cell); the roll is a removable
 *   offset whose rest value is 0. A Reanimated update dropped after a JS stall can no longer leave a
 *   column on the digit it was mounted with ("04:24 read 04:12" on the monitor; the same component drew
 *   the bottom Recording bar, the Home and System Time clocks and nine other readouts).
 * - `count` (KPIs): the same clipped digit columns as continuous drums driven by a `counter`
 *   spring, after the 120 ms held beat on first mount (03M R4). No React render per animation frame
 *   in either mode.
 *
 * Deviation from 04 §4.0 (recorded in the step-71 log): the spec's read-only TextInput whose text
 * is written by `useAnimatedProps` did not update on the Fabric debug build (device check,
 * step 71), so `count` reuses the digit columns.
 *
 * `value` may be a number (React) or a shared value (copied into React when its text changes; only the
 * dev gallery passes one). Reduced motion: values jump to their final state (03M §8).
 *
 * `count` mode (KPI drums) is unchanged: its only user is the dev gallery (no product screen counts).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  drumPosition,
  formatRolling,
  placesOf,
  rollCells,
  rollsForward,
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

/**
 * The value React draws. A number is drawn as given. A shared value is copied into React state when its
 * FORMATTED text changes (at most the screen's refresh rate, ≤ 1 Hz for the clocks it is meant for), so
 * the digit positions below are always React's, whatever kind of value feeds them.
 */
function useDrawnValue(value: number | SharedValue<number>, format: RollingFormat): number {
  const external = typeof value === 'number' ? null : value;
  const [mirrored, setMirrored] = useState(() => (external ? external.get() : 0));
  useAnimatedReaction(
    () => (external ? external.get() : null),
    (next, previous) => {
      if (next === null) return;
      if (previous !== null && previous !== undefined && formatRolling(next, format) === formatRolling(previous, format)) return;
      scheduleOnRN(setMirrored, next);
    },
    [external, format],
  );
  return typeof value === 'number' ? value : mirrored;
}

function SlideNumber({ testID, value, format, textStyle, lineHeight, reduced, prefix, suffix }: SlideNumberProps) {
  const drawn = useDrawnValue(value, format);
  const forward = rollsForward(format);
  // The column layout (digits vs separators) follows the formatted value; columns are keyed from the
  // right, so a value growing from 9 to 10 keeps its units column and adds a tens column.
  const chars = formatRolling(drawn, format).split('');
  return (
    <>
      {prefix ? <Text style={textStyle}>{prefix}</Text> : null}
      {chars.map((ch, i) => {
        const fromEnd = chars.length - i;
        const digit = ch.charCodeAt(0) - 48;
        return digit >= 0 && digit <= 9 ? (
          <DigitColumn
            key={`d${fromEnd}`}
            testID={testID ? `${testID}-d${fromEnd}` : undefined}
            digit={digit}
            forward={forward}
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
  digit: number;
  forward: boolean;
  textStyle: TextStyle;
  lineHeight: number;
  reduced: boolean;
}

/**
 * One digit: a clipped column of 20 cells (0-9 twice). React places the CURRENT digit's cell in the
 * column's own props (`translateY: -cell × lineHeight` on the inner view), so a commit can only ever draw
 * the current value, whatever Reanimated keeps or drops (D214: Reanimated 4.5 drops a settled animated
 * value the stalled JS thread did not take back in time, and the next commit re-applies React's props).
 * The roll of M-C-02 is an extra offset on a wrapper, animated from "the previous cell" to 0; its rest
 * value is 0, which is also its first value, so a dropped or reverted offset leaves the final picture.
 * Reduced motion: no offset at all, the digit changes in place.
 */
function DigitColumn({ testID, digit, forward, textStyle, lineHeight, reduced }: DigitColumnProps) {
  // "Adjusting state when a prop changes": the rest cell and the roll it needs are worked out in render.
  const [shown, setShown] = useState({ digit, cell: digit, from: digit, roll: 0 });
  if (shown.digit !== digit) {
    const step = rollCells(shown.cell, digit, forward);
    setShown({ digit, cell: step.to, from: step.from, roll: shown.roll + 1 });
  }
  const offset = useSharedValue(0);
  useLayoutEffect(() => {
    if (shown.roll === 0 || reduced) return;
    // Start on the previous cell, end at rest: 0, the value React also holds.
    offset.set((shown.cell - shown.from) * lineHeight);
    offset.set(withTiming(0, { duration: SLIDE_MS, easing: STANDARD }));
  }, [shown.roll, shown.cell, shown.from, reduced, lineHeight, offset]);
  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  return (
    <View style={{ height: lineHeight, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
      <Animated.View style={roll}>
        <View testID={testID} style={{ transform: [{ translateY: -shown.cell * lineHeight }] }}>
          {CELLS.map((d, i) => (
            <Text key={i} style={[textStyle, { height: lineHeight }]}>
              {d}
            </Text>
          ))}
        </View>
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
