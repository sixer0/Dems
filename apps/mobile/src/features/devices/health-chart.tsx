/**
 * Health sparkline of one device (04_mobile_specs §4.12 V5 "Health: `victory-native`
 * `CartesianChart` + `Line` (1 Hz, no animation)"). Victory Native draws with Skia and sizes itself
 * through `onLayout` (no Skia `onSize`, D58). The line updates once per simulator second from the
 * series the caller passes (`useHealthSeries` / `useMicLevelSeries`); `Line` gets no `animate`
 * config, so a new point redraws without a tween (the data is the motion, 03M R9).
 *
 * LIVE mode (backend task W78; 04_client_integration_spec §3.2): the line is drawn from the Core's
 * replicated data, so the sample caption drops "Simulated". The Core serves no per-device health
 * history (RESIDUAL-W78-2, W83 ledger #57): the line of a camera, the tablet and the PoE switch is
 * derived from the Core's network data, the lamp's from its session state, a microphone's from 1 s
 * peaks of its meter frames, so the LIVE caption says the line is derived (row M1 follow-up, D160) in
 * the web console's words: the shared `devices.live.samples` (closing copy round, decision D186).
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import type { HealthMetric, HealthSeries } from './sim-adapter';

/** `devices.drawer.health.*` label of each metric (shared with the web drawer, step 48). */
const METRIC_LABEL_KEY: Readonly<Record<HealthMetric, string>> = {
  linkQuality: 'devices.drawer.health.linkQuality',
  signal: 'devices.drawer.health.signal',
  poeDraw: 'devices.drawer.health.poeDraw',
  relay: 'devices.drawer.health.relay',
};

/** The "Now" readout in the metric's unit. */
export function formatHealthValue(metric: HealthMetric, value: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  switch (metric) {
    case 'linkQuality':
      return t('features.devices.detail.percent', { value: value.toFixed(1) });
    case 'signal':
      return t('features.devices.detail.dbfs', { value: value.toFixed(1) });
    case 'poeDraw':
      return t('features.devices.detail.watts', { value: value.toFixed(1) });
    case 'relay':
      return value >= 1 ? t('devices.other.recordingLamp') : t('features.devices.detail.lampOff');
  }
}

interface ChartRow extends Record<string, unknown> {
  t: number;
  v: number;
}

export interface HealthChartProps {
  series: HealthSeries;
  testID?: string;
  /** The Core link source is LIVE: the caption says nothing about a simulation. */
  live?: boolean;
}

export function HealthChart({ series, testID, live = false }: HealthChartProps) {
  const { t } = useTranslation();
  const data = useMemo<ChartRow[]>(() => series.points.map((point) => ({ t: point.t, v: point.v })), [series.points]);
  const last = series.points[series.points.length - 1];
  const metricLabel = t(METRIC_LABEL_KEY[series.metric]);
  const enough = data.length >= 2;
  return (
    <View style={styles.root} testID={testID} accessibilityLabel={t('devices.drawer.health.chartLabel', { metric: metricLabel })}>
      <View style={styles.head}>
        <Text maxFontSizeMultiplier={1.2} style={styles.metric}>
          {metricLabel}
        </Text>
        {last ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.now} testID={testID ? `${testID}-now` : undefined}>
            {`${t('devices.drawer.health.now')} ${formatHealthValue(series.metric, last.v, t)}`}
          </Text>
        ) : null}
      </View>
      <View style={styles.chart} testID={testID ? `${testID}-canvas` : undefined}>
        {enough ? (
          <CartesianChart<ChartRow, 't', 'v'>
            data={data}
            xKey="t"
            yKeys={['v']}
            domain={{ y: [series.domain[0], series.domain[1]] }}
            padding={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            {({ points }) => <Line points={points.v} color={palette.gold} strokeWidth={2} curveType="linear" />}
          </CartesianChart>
        ) : (
          <View style={styles.empty}>
            <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
              {t('features.devices.health.unavailable')}
            </Text>
          </View>
        )}
      </View>
      <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID={testID ? `${testID}-samples` : undefined}>
        {enough ? t(live ? 'devices.live.samples' : 'devices.drawer.health.samples', { count: data.length }) : t('devices.drawer.health.collecting')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[1] },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[2] },
  metric: { flex: 1, fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  now: { fontFamily: fontFamily.native.mono, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.gold },
  chart: { height: 140, borderRadius: radius.px.lg, backgroundColor: derived.surfaceSecondary, overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[2] },
  caption: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
});
