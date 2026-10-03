/**
 * The time-source hierarchy row GNSS → NTP → RTC (04_mobile_specs §4.14 N3: three `Chip`s, the
 * active one carries a moving indicator, `time-tier`; design book §2.2; FMEA §23.1).
 *
 * - Three equal segments in priority order; each holds a kit `Chip` with the tier's state tone.
 * - One gold-edged indicator sits under the active tier. On GNSS loss it slides to NTP, on a further
 *   fall to the RTC, and back on recovery, on the `indicator` spring (03M §2.3; R5 `time-tier` is the
 *   shared-layout id on web, a translate within the row here, Appendix A). The first placement never
 *   animates; reduced motion jumps.
 * - Each step DOWN plays exactly one escalation pulse on the indicator (R8, P7 calm escalation:
 *   warning tone, no loop, no shake). `totalMs` is passed explicitly (F74-02).
 */
import { Chip } from 'heroui-native';
import { ChevronRight } from 'lucide-react-native';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { fontFamily, palette, radius, spacing, toneChipProps, toneTextHex } from '@dems/shared/tokens';
import { withAlpha } from '@/components/media';
import { SPEC_LITERALS, animatePulseOnce, animateSpring, useMotionSettings } from '@/motion';
import { TIERS, TIER_TONE, tierIndex, tierState, type TimeTier } from './network-time-model';

export interface TierRowProps {
  source: TimeTier;
  gnssLocked: boolean;
  ntpReachable: boolean;
  /** Increases on every step down the hierarchy (one pulse each). */
  escalationKey: number;
}

const CHEVRON_W = 14;

export function TierRow({ source, gnssLocked, ntpReachable, escalationKey }: TierRowProps) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const [width, setWidth] = useState(0);
  const index = tierIndex(source);
  const segment = width > 0 ? (width - CHEVRON_W * (TIERS.length - 1)) / TIERS.length : 0;

  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (segment <= 0) return;
    const target = index * (segment + CHEVRON_W);
    if (!placed.current) {
      placed.current = true;
      x.set(target);
      return;
    }
    x.set(animateSpring(target, 'indicator', m));
  }, [index, segment, m, x]);

  const pulse = useSharedValue(0);
  const lastKey = useRef(escalationKey);
  useEffect(() => {
    if (lastKey.current === escalationKey) return;
    lastKey.current = escalationKey;
    pulse.set(animatePulseOnce(1, 0, m, SPEC_LITERALS.escalationPulseMs));
  }, [escalationKey, m, pulse]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: x.get() }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };

  const states = TIERS.map((tier) => tierState({ source, gnssLocked, ntpReachable }, tier));
  return (
    <View
      testID="network-time-tiers"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={t('features.network-time.time.hierarchyLabel', { tier: source })}
      onLayout={onLayout}
      style={styles.row}
    >
      {segment > 0 ? (
        <Animated.View testID="network-time-tier-indicator" pointerEvents="none" style={[styles.indicator, indicatorStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.pulse, pulseStyle]} />
        </Animated.View>
      ) : null}
      {TIERS.map((tier, i) => {
        const state = states[i] ?? 'STANDBY';
        const tone = TIER_TONE[state];
        const props = toneChipProps(tone);
        return (
          <Fragment key={tier}>
            {i > 0 ? (
              <View style={styles.chevron}>
                <ChevronRight size={12} color={palette.gray} />
              </View>
            ) : null}
            <View
              testID={`network-time-tier-${tier}`}
              accessibilityLabel={t('features.network-time.time.tierLabel', {
                tier,
                name: t(`networkTime.hierarchy.tiers.${tier}`),
                state: t(`networkTime.hierarchy.tierState.${state}`),
              })}
              accessibilityState={{ selected: state === 'ACTIVE' }}
              style={styles.segment}
            >
              <Text style={[styles.tierName, { color: state === 'ACTIVE' ? palette.foreground : palette.gray }]}>{tier}</Text>
              <Chip size="sm" variant="soft" color={props.color} className={props.className}>
                <Chip.Label style={tone === 'default' ? { color: toneTextHex.default } : undefined}>
                  {t(`networkTime.hierarchy.tierState.${state}`)}
                </Chip.Label>
              </Chip>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 56 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing[1] },
  chevron: { width: CHEVRON_W, alignItems: 'center', justifyContent: 'center' },
  tierName: { fontFamily: fontFamily.native.monoMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.px.lg,
    borderWidth: 1,
    borderColor: withAlpha(palette.gold, 0.55),
    backgroundColor: withAlpha(palette.gold, 0.08),
  },
  pulse: { borderRadius: radius.px.lg, backgroundColor: withAlpha(palette.warning, 0.28) },
});
