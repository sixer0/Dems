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
import { derived, fontFamily, toneHex, typography, type StatusTone } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { isOwnCaptureCoreState, useSim } from '@dems/shared/sim';
import { SPEC_LITERALS, animatePulseOnce, useMotionSettings } from '@/motion';
import { useRealCaptureView } from './camera-preview';
import { STATUS_LABEL_KEY, STATUS_RANK, STATUS_TONE, type DeviceId, type DeviceStatus } from './devices-model';

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
  /**
   * Fix wave M (G70d-02): the word and tone of a capture source on a Core in its own capture
   * (`useSourceRow`). Given, it is drawn in place of the track's status word; the pulse rule is unchanged.
   */
  word?: { readonly label: string; readonly tone: StatusTone } | null;
}

/** MB 7 Camera / Audio rows and the detail header: a kit chip with a status dot. */
export function DeviceStatusChip({ status, size = 'sm', testID, word = null }: DeviceStatusChipProps) {
  const { t } = useTranslation();
  const style = useEscalationPulse(STATUS_RANK[status]);
  return (
    <Animated.View style={style} testID={testID ? `${testID}-pulse` : undefined}>
      <StatusChip tone={word?.tone ?? STATUS_TONE[status]} label={word?.label ?? t(STATUS_LABEL_KEY[status])} icon="Circle" iconFilled size={size} testID={testID} />
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

// ── No synthetic values on a Core in its own capture (audit row 198, M3-10 R3; D52; tablet half of web U-10, rows 104/107) ──
/**
 * Until row 198 a block that still held values of the simulator's model was drawn WITH those values on a Core in its
 * own capture, marked only by a "Synthetic demo values" chip (fix wave L, closing pass L-Z). Ruling D25 N3 / D52: a
 * value with no producer reads "Not reported" (register I4, shared `system.noProducer`), and the chip is not drawn
 * anywhere. The one exception is the measured microphone level (the meter and the microphone's health series), which
 * is a real reading and is drawn as before.
 *
 * Whether the view is such a Core: the one own-capture reader `isOwnCaptureCoreState` (shared `sim/core-facts.ts`,
 * as row 201 and About row 197 read it), OR the picture rule `useRealCaptureView` that gated the chip until now (Live
 * mode and a Core that states a source class). The union keeps every block that was marked before under the new rule,
 * and adds a Live own-capture Core whose device list states no class. The simulated lane states neither: unchanged.
 */
export function useNoProducerView(): boolean {
  const realCapture = useRealCaptureView();
  const ownCapture = useSim(isOwnCaptureCoreState);
  return realCapture || ownCapture;
}

/**
 * The devices whose every fact is the simulator's model (web row 107, `other-devices.tsx`: POE-SWITCH and
 * REC-INDICATOR read "Not reported" for detail and chip, with no relay lamp). The TABLET row is the tablet's own link
 * fact and stays.
 */
export const NO_PRODUCER_DEVICES: ReadonlySet<DeviceId> = new Set<DeviceId>(['POE-SWITCH', 'REC-INDICATOR']);

/** The status word of a no-producer device: I4 at the neutral tone (`DeviceStatusChip`'s `word`). */
export function useNoProducerWord(): { readonly label: string; readonly tone: StatusTone } {
  const { t } = useTranslation();
  return { label: t('system.noProducer'), tone: 'default' };
}

/** I4 in place of a block of model values (the web's `NoProducerNotice`, same test id `no-producer-<block>`). */
export function NoProducerNotice({ block }: { block: string }) {
  const { t } = useTranslation();
  return (
    <Text maxFontSizeMultiplier={1.2} style={styles.noProducer} testID={`no-producer-${block}`} accessibilityRole="text">
      {t('system.noProducer')}
    </Text>
  );
}

const styles = StyleSheet.create({
  noProducer: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: derived.foreground2 },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotText: { fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight },
});
