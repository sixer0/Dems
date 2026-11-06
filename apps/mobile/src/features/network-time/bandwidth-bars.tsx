/**
 * The N2 bandwidth sparkline (04_mobile_specs §4.14 N2; MB 9 "Bandwidth" bars): 12 bars, streaming
 * at 1 Hz with animation OFF (data, not decoration; 03M M-PG-NET "isAnimationActive=false").
 *
 * Drift DR-86-1: the spec names `victory-native` `CartesianChart` + `Bar`. victory-native pulls in
 * `d3-scale`, an ESM-only package outside the mobile Jest transform allowlist (jest.config.js is not
 * this step's file, P6), so every app-wide suite that loads the `/network-time` route (T-M02 routes,
 * chrome, guard) failed to parse it. Twelve bars need no chart engine: plain RN Views in a fixed
 * box, heights on a 0…max scale with 15% headroom, no axes and no animation.
 */
import { StyleSheet, View } from 'react-native';
import { derived, palette, radius } from '@dems/shared/tokens';
import { bandwidthScaleMax } from './network-time-model';

/** Up to 96 dp wide (MB 9), down to 56 dp in a narrow pane; 40 dp tall. */
export const BANDWIDTH_CHART_SIZE = { width: 96, minWidth: 56, height: 40 } as const;
const PAD = 3;
const GAP = 2;
const INNER_H = BANDWIDTH_CHART_SIZE.height - PAD * 2;

export interface BandwidthBarsProps {
  /** Exactly 12 values, oldest first (0 = no sample yet). */
  bars: readonly number[];
  accessibilityLabel: string;
  testID?: string;
}

/** Bar height in dp for a value on the 0…`max` scale (never negative, never above the box). */
export function barHeight(value: number, max: number): number {
  if (!(value > 0) || !(max > 0)) return 0;
  return Math.max(1, Math.min(INNER_H, Math.round((value / max) * INNER_H * 10) / 10));
}

export function BandwidthBars({ bars, accessibilityLabel, testID }: BandwidthBarsProps) {
  const max = bandwidthScaleMax(bars);
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.box}>
      {bars.map((value, i) => (
        <View key={i} style={styles.slot}>
          <View testID={testID ? `${testID}-${i}` : undefined} style={[styles.bar, { height: barHeight(value, max) }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    maxWidth: BANDWIDTH_CHART_SIZE.width,
    minWidth: BANDWIDTH_CHART_SIZE.minWidth,
    height: BANDWIDTH_CHART_SIZE.height,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: GAP,
    padding: PAD,
    borderRadius: radius.px.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: derived.separator,
    overflow: 'hidden',
  },
  slot: { flex: 1, height: INNER_H, justifyContent: 'flex-end' },
  bar: { backgroundColor: palette.info, borderTopLeftRadius: 1.5, borderTopRightRadius: 1.5 },
});
