/**
 * Device status chip (04_mobile_specs §4.0 `StatusChip` recipe; MB 7 "Online", "Active",
 * "Connected"). Faults escalate calmly (03M P7, R8): when the status rises in severity the chip
 * pulses its scale ONCE over `escalationPulseMs` and then holds the new colour; a recovery or a
 * same-rank change just swaps the colour. Reduced motion: no pulse, the colour alone changes.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { fontFamily, toneHex, typography } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { SPEC_LITERALS, animatePulseOnce, useMotionSettings } from '@/motion';
import { STATUS_LABEL_KEY, STATUS_RANK, STATUS_TONE, type DeviceStatus } from './devices-model';

/** Peak scale of the one escalation pulse (transform only; P4 of 03M). */
const PULSE_PEAK = 1.08;

/** Plays the one escalation pulse when `rank` rises; returns the animated style. */
function useEscalationPulse(rank: number) {
  const m = useMotionSettings();
  const scale = useSharedValue(1);
  const previous = useRef(rank);
  useEffect(() => {
    if (rank > previous.current) {
      // F74-02 (D73): the pulse length is always passed explicitly (no worklet default parameter).
      scale.set(animatePulseOnce(PULSE_PEAK, 1, m, SPEC_LITERALS.escalationPulseMs));
    }
    previous.current = rank;
  }, [rank, m, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
}

export interface DeviceStatusChipProps {
  status: DeviceStatus;
  size?: 'sm' | 'md';
  testID?: string;
}

/** MB 7 Camera / Audio rows and the detail header: a kit chip with a status dot. */
export function DeviceStatusChip({ status, size = 'sm', testID }: DeviceStatusChipProps) {
  const { t } = useTranslation();
  const style = useEscalationPulse(STATUS_RANK[status]);
  return (
    <Animated.View style={style} testID={testID ? `${testID}-pulse` : undefined}>
      <StatusChip tone={STATUS_TONE[status]} label={t(STATUS_LABEL_KEY[status])} icon="Circle" iconFilled size={size} testID={testID} />
    </Animated.View>
  );
}

/** MB 7 Other Devices rows: a status dot and a coloured word, no chip. */
export function DeviceStatusDot({ status, label, testID }: { status: DeviceStatus; label?: string; testID?: string }) {
  const { t } = useTranslation();
  const style = useEscalationPulse(STATUS_RANK[status]);
  const color = toneHex[STATUS_TONE[status]];
  const text = label ?? t(STATUS_LABEL_KEY[status]);
  return (
    <Animated.View style={[styles.dotRow, style]} testID={testID} accessible accessibilityLabel={text}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.dotText, { color }]}>
        {text}
      </Text>
    </Animated.View>
  );
}

/**
 * The "Synthetic demo values" chip (fix wave L, closing pass L-Z; the ONE RULE): the mark of a block that
 * still shows values of the simulator's model on a Core in its own capture. The kit's `StatusChip` and the
 * shared sentence of Settings > About (`system.about.synthetic`) - no new component, no new word.
 */
export function SyntheticValuesChip({ block }: { block: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.syntheticRow}>
      <StatusChip tone="warning" size="sm" icon={null} label={t('system.about.synthetic')} testID={`synthetic-values-${block}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  syntheticRow: { flexDirection: 'row' },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotText: { fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight },
});
