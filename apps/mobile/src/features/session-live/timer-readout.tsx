/**
 * The monitor's HH:MM:SS readout, drawn by React (closing-fix row CF-M1, defect R-P-2's "timer running
 * backwards"; decision D214).
 *
 * ## What the device showed, and why
 *
 * The monitor timer and the REC chip of the feed used the C-6 `RollingNumber` in `slide` mode: every
 * digit is a column of cells whose position (`translateY`) lives ONLY in a Reanimated shared value; React
 * holds the position of the digit the column was mounted with. Reanimated 4.5.1 hands settled animated
 * props back to React from a 500 ms JS interval, and its native side first DROPS every settled update
 * older than 2 s before collecting the ones older than 1 s (`ReanimatedModuleProxy::getSettledUpdates`,
 * `AnimatedPropsRegistry::getUpdatesOlderThanTimestamp`: remove, then collect). A JS stall of 1-2 s
 * right after a digit settles therefore loses that digit's final position; the next React commit of the
 * column re-applies React's own value, the digit it was mounted with. On the phone:
 *
 * - R-P-2 (monitor mounted at 00:00:0x): the tens column showed 0 again after the stall, so 14, 17, 18
 *   read 04, 07, 08 until the next tens change (20) moved it;
 * - R-P-1 (monitor mounted at 00:03:13): the tens column showed 1 again, 04:24 read 04:12;
 * - reproduced on dems2_phone with a 3.5 s Hermes-inspector stall: 03:28, then 03:23 (the ones column
 *   back on 3, the digit of its mount), in the monitor timer and in the REC chip alike.
 *
 * The clock itself never went backwards (the feed's burnt-in time in the same frames runs on; the Live
 * clock never moves back, `@dems/shared/live` `clock.ts`).
 *
 * ## This readout
 *
 * CF-M1 drew each digit column with React (the current digit's cell in the view's own props; the roll an
 * extra offset whose rest value is 0). Post-review fix FXR-M (finding W93-3) moved that layout into the
 * kit's `RollingNumber` itself, so every readout of the app gets it (the bottom Recording bar, the Home
 * and System Time clocks, the hub timer and the counters). This readout is now `RollingNumber` with the
 * duration format; it keeps its name and props for the monitor and the feed's REC chip.
 *
 * ## The device clock (decision D247 item 5, finding CT-01)
 *
 * React's readout is fed by a JS timer and a render: when the JS thread is busy the second it shows stands
 * (8-11 s on the tablet at the start of a recording, note 176). A running recording therefore ALSO has a
 * clock on the UI thread: a frame callback reads the device clock, takes the whole seconds since the
 * recording's start on that clock (`clockOriginMs`, `useRecordingLocalOrigin`) and, as soon as React's second
 * is more than `REACT_LATE_GRACE_MS` overdue, draws the time itself - the mechanism the kit's level meter
 * already uses for its readout (a string shared value drawn by a Skia text, no React render, no animated
 * prop that Reanimated could drop). React's readout is hidden for that stretch and comes back with its next
 * render. A readout whose render is on time never shows the layer, so nothing changes for it; the React
 * readout stays the accessible one and the one the tests read. Without a start on the device clock (a
 * simulator; a stopped session, whose duration is the Core's) there is no layer.
 */
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { Orbitron_700Bold } from '@expo-google-fonts/orbitron/700Bold';
import { Canvas, Skia, Text as SkiaText, loadData, type DataSourceParam, type SkFont, type SkTypeface } from '@shopify/react-native-skia';
import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { palette, typography, type TypographyToken } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { formatRolling, rollCells } from '@/components/composed/rolling-number.math';
import { reportRuntimeIssue } from '@/runtime';

const DURATION = { kind: 'duration' } as const;

/** React's second may be this late after its boundary before the device clock draws the time (ms). */
export const REACT_LATE_GRACE_MS = 250;

/** Whole seconds since `originMs` at `nowMs`, both on the device clock; 0 before the start. Pure; a worklet. */
export function clockSecondsAt(originMs: number, nowMs: number): number {
  'worklet';
  if (!Number.isFinite(originMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.floor((nowMs - originMs) / 1000));
}

/**
 * What the device clock draws over React's readout at `nowMs`: `HH:MM:SS`, or `''` (nothing: React's own
 * second, `reactSeconds`, is the current one or is overdue by no more than the grace). Pure; a worklet.
 */
export function clockLayerText(originMs: number, nowMs: number, reactSeconds: number): string {
  'worklet';
  const seconds = clockSecondsAt(originMs, nowMs);
  if (seconds <= reactSeconds) return '';
  if (nowMs - originMs < (reactSeconds + 1) * 1000 + REACT_LATE_GRACE_MS) return '';
  return formatRolling(seconds, DURATION);
}

/**
 * The two faces of the readout, loaded ONCE per run of the app and kept. Skia's own `useFont` loads the file
 * again for every mount, asynchronously (in a debug build over the bundler's HTTP): on the tablet the readout
 * mounts at the start of a recording, the busiest moment of the JS thread, and the face arrived many seconds
 * late (first device run of this layer: React's readout hidden, nothing drawn in its place). The load starts
 * when this module is evaluated; a readout draws from the device clock only once its face is there.
 */
const typefaces = new Map<DataSourceParam, SkTypeface>();
const typefaceLoads = new Set<DataSourceParam>();
const typefaceListeners = new Set<() => void>();
let typefaceVersion = 0;

function warmTypeface(source: DataSourceParam): void {
  if (typefaces.has(source) || typefaceLoads.has(source)) return;
  try {
    const make = Skia.Typeface?.MakeFreeTypeFaceFromData;
    if (typeof make !== 'function' || typeof loadData !== 'function') return; // no Skia runtime (a test double)
    const load: unknown = loadData(source, make.bind(Skia.Typeface));
    if (!(load instanceof Promise)) return;
    typefaceLoads.add(source);
    (load as Promise<SkTypeface | null>)
      .then((typeface) => {
        if (typeface === null) throw new Error('The readout face could not be read');
        typefaces.set(source, typeface);
        typefaceVersion += 1;
        for (const listener of [...typefaceListeners]) listener();
      })
      .catch((error: unknown) => {
        // React's readout stays the only one; the next mount tries again.
        typefaceLoads.delete(source);
        reportRuntimeIssue('warn', 'sessionLive.clockFace', error, {});
      });
  } catch (error) {
    reportRuntimeIssue('warn', 'sessionLive.clockFace', error, {});
  }
}

/** Starts loading both faces of the readout (idempotent). */
export function warmClockFaces(): void {
  warmTypeface(Orbitron_700Bold as DataSourceParam);
  warmTypeface(JetBrainsMono_500Medium as DataSourceParam);
}
warmClockFaces();

const subscribeTypefaces = (onChange: () => void): (() => void) => {
  typefaceListeners.add(onChange);
  return () => {
    typefaceListeners.delete(onChange);
  };
};
const typefaceSnapshot = (): number => typefaceVersion;

/** The face at `size`, or null until it is loaded. */
function useClockFont(source: DataSourceParam, size: number): SkFont | null {
  useSyncExternalStore(subscribeTypefaces, typefaceSnapshot);
  useEffect(() => warmTypeface(source), [source]);
  const typeface = typefaces.get(source) ?? null;
  return useMemo(() => (typeface === null ? null : Skia.Font(typeface, size)), [typeface, size]);
}

const CLOCK_CHARS = '0123456789:';
const COLUMNS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

interface ClockLayout {
  /** Left edge of each of the eight columns of `HH:MM:SS`. */
  readonly left: readonly number[];
  /** Width of a digit column and of a separator column. */
  readonly digitWidth: number;
  readonly colonWidth: number;
  /** Advance of each of `0123456789:`. */
  readonly advance: readonly number[];
  readonly baseline: number;
  readonly width: number;
}

/**
 * The same columns `RollingNumber` lays out: a digit column as wide as the widest digit, each glyph centred
 * in it; the separators at their own width; the line centred in `lineHeight`.
 */
export function clockLayout(font: SkFont, lineHeight: number, letterSpacing: number): ClockLayout {
  const advance = font.getGlyphWidths(font.getGlyphIDs(CLOCK_CHARS));
  const digitWidth = Math.max(...advance.slice(0, 10)) + letterSpacing;
  const colonWidth = (advance[10] ?? 0) + letterSpacing;
  const left: number[] = [];
  let x = 0;
  for (const column of COLUMNS) {
    left.push(x);
    x += column === 2 || column === 5 ? colonWidth : digitWidth;
  }
  const metrics = font.getMetrics();
  const baseline = (lineHeight - (metrics.descent - metrics.ascent)) / 2 - metrics.ascent;
  return { left, digitWidth, colonWidth, advance, baseline, width: x };
}

interface ClockGlyphProps {
  column: number;
  text: SharedValue<string>;
  layout: ClockLayout;
  font: SkFont;
  color: string;
}

/** One character of the device clock's `HH:MM:SS`, centred in its column. */
function ClockGlyph({ column, text, layout, font, color }: ClockGlyphProps) {
  const { left, digitWidth, colonWidth, advance, baseline } = layout;
  const x0 = left[column] ?? 0;
  const glyph = useDerivedValue(() => text.get().charAt(column));
  const x = useDerivedValue(() => {
    const code = text.get().charCodeAt(column) - 48;
    const isDigit = code >= 0 && code <= 9;
    const width = isDigit ? digitWidth : colonWidth;
    return x0 + (width - (advance[isDigit ? code : 10] ?? 0)) / 2;
  });
  return <SkiaText x={x} y={baseline} text={glyph} font={font} color={color} />;
}

/** Inside the canvas: tells the frame callback that the canvas' tree is committed (and when it is gone). */
function ClockArm({ armed }: { armed: SharedValue<number> }) {
  useEffect(() => {
    armed.set(1);
    return () => armed.set(0);
  }, [armed]);
  return null;
}

interface ClockLayerProps {
  originMs: number;
  /** The second React's readout draws now. */
  seconds: number;
  size: TypographyToken;
  color: string;
  testID?: string;
  children: React.ReactNode;
}

/**
 * React's readout (`children`) with the device clock over it. The frame callback runs on the UI thread for
 * as long as the layer is mounted (a running recording); it writes a shared value only when the text changes.
 */
function ClockLayer({ originMs, seconds, size, color, testID, children }: ClockLayerProps) {
  const token = typography[size];
  const font = useClockFont((size === 'display' ? Orbitron_700Bold : JetBrainsMono_500Medium) as DataSourceParam, token.size);
  const layout = useMemo(
    () => (font ? clockLayout(font, token.lineHeight, token.letterSpacing * token.size) : null),
    [font, token.lineHeight, token.letterSpacing, token.size],
  );
  const origin = useSharedValue(originMs);
  const drawn = useSharedValue(seconds);
  const text = useSharedValue('');
  // 1 once the canvas below HOLDS its glyphs (`ClockArm`, an effect inside the canvas' own tree): React's
  // readout is never hidden for a layer that is not there. Second device run of this layer: the face was
  // loaded, yet for the first 25 s of a recording nothing was drawn in place of the hidden readout - the
  // canvas' tree is committed by the JS thread too, and that thread was the busy one.
  const armed = useSharedValue(0);
  useLayoutEffect(() => {
    origin.set(originMs);
    drawn.set(seconds);
  }, [originMs, seconds, origin, drawn]);
  useFrameCallback(() => {
    'worklet';
    const next = armed.get() === 1 ? clockLayerText(origin.get(), Date.now(), drawn.get()) : '';
    if (next !== text.get()) text.set(next);
  });
  // Rest value 1: a style Reanimated drops (D214) leaves React's readout visible, which is then the only one
  // that can be current (a drop is collected by the JS thread, i.e. when React renders again).
  const reactReadout = useAnimatedStyle(() => ({ opacity: text.get() === '' ? 1 : 0 }));
  return (
    <View testID={testID ? `${testID}-clocked` : undefined}>
      <Animated.View style={reactReadout}>{children}</Animated.View>
      {font && layout ? (
        <Canvas pointerEvents="none" style={StyleSheet.absoluteFill} testID={testID ? `${testID}-device-clock` : undefined}>
          <ClockArm armed={armed} />
          {COLUMNS.map((column) => (
            <ClockGlyph key={column} column={column} text={text} layout={layout} font={font} color={color} />
          ))}
        </Canvas>
      ) : null}
    </View>
  );
}

/** The cell a column shows for `digit` after showing cell `fromCell`: the same digit in 0..19, always forward (odometer). */
export function nextCell(fromCell: number, digit: number): number {
  return rollCells(fromCell, digit, true).to;
}

export interface TimerReadoutProps {
  /** Whole seconds since the recording started. */
  seconds: number;
  /** Motion policy from `useMotionPolicy()`: `full` rolls the digits that change, `reduced` changes them in place. */
  motion: 'full' | 'reduced';
  size?: TypographyToken;
  color?: string;
  testID?: string;
  /**
   * The start of the running recording on this device's clock (`useRecordingLocalOrigin`), or `null` / absent:
   * with it, the device clock draws the time whenever React's `seconds` is late (D247 item 5).
   */
  clockOriginMs?: number | null;
}

export function TimerReadout({ seconds, motion, size = 'display', color = palette.foreground, testID, clockOriginMs = null }: TimerReadoutProps) {
  const whole = Math.max(0, Math.floor(seconds));
  const readout = <ReactReadout seconds={whole} motion={motion} size={size} color={color} testID={testID} />;
  if (clockOriginMs === null) return readout;
  return (
    <ClockLayer originMs={clockOriginMs} seconds={whole} size={size} color={color} testID={testID}>
      {readout}
    </ClockLayer>
  );
}

function ReactReadout({ seconds, motion, size, color, testID }: Required<Pick<TimerReadoutProps, 'seconds' | 'motion' | 'size' | 'color'>> & { testID?: string }) {
  return (
    <RollingNumber
      value={seconds}
      mode="slide"
      format={DURATION}
      motion={motion}
      size={size}
      face={size === 'display' ? 'display' : 'mono'}
      color={color}
      {...(testID ? { testID } : {})}
    />
  );
}
