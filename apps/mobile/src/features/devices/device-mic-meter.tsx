/**
 * C-2 DbfsMeter for one microphone channel (04_mobile_specs §4.12 V3 `compact` inline on tablet
 * rows, V5 `large` in the detail; §5.4 transient meter path). The meter is fed by
 * `useAudioSharedValues(channel)` (step 73), so a 20 Hz audio frame causes zero React renders
 * (MA-16); the accessibility value refreshes at 1 Hz. This feature keeps its own copy of the
 * session monitor's wiring (P6: another feature's files are not shared code).
 *
 * Fix wave J (JW-08, JA2-34): "No signal" is said only when the Core states that state of the
 * microphone (`deviceMicLevelKind`); a flat or absent frame at rest is "— dBFS", "Not measured". The
 * number follows the input in every motion mode. The CLIP latch locks the top segment red; tapping
 * the CLIP chip resets it through `onClipReset` (`resetClip`).
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { isLevelNotMeasured, meterInputOfChannel, useSim, type MicStatus } from '@dems/shared/sim';
import { fontFamily, palette, typography } from '@dems/shared/tokens';
import { DbfsMeter, type MeterVariant } from '@/components/composed/dbfs-meter';
import { micLinesInForce } from '@/features/capture-selector/selector-in-force';
import { MIC_CHANNEL_NAME_KEY, MIC_NO_LEVEL_TEXT } from '@/features/dashboard/home-model'; // D61: the channel-name map
import { useMotionPolicy } from '@/motion';
import { useAudioAccessibilityValue, useAudioSharedValues } from '@/runtime';

/**
 * WHAT A MICROPHONE'S LEVEL READS (fix wave J, JW-08 mobile half; the Home rule `micReadoutKind` with the
 * contract's member in front, contract_wave_j.md J-S 6):
 *
 * | The Core's facts of the input | Kind | Drawn |
 * |---|---|---|
 * | the microphone's state is `NO_SIGNAL` (the Core STATES the fault) | `NO_SIGNAL` | "No signal" |
 * | the frame says `notMeasured: true`, or it is flat / absent and the Core states no fault | `NOT_MEASURED` | "— dBFS", "Not measured": no bars, no number, never the fault word |
 * | a frame with a level | `LEVEL` | the bars and the number |
 *
 * At rest a Core in its own capture measures nothing: its frames are flat. That is no fault, so it is
 * never "No signal" beside "Ready". Pure.
 */
export type DeviceMicLevelKind = 'LEVEL' | 'NO_SIGNAL' | 'NOT_MEASURED';

export function deviceMicLevelKind(input: { readonly state: string; readonly frameFlat: boolean; readonly notMeasured: boolean }): DeviceMicLevelKind {
  if (input.state === 'NO_SIGNAL') return 'NO_SIGNAL';
  return input.notMeasured || input.frameFlat ? 'NOT_MEASURED' : 'LEVEL';
}

export interface DeviceMicMeterProps {
  mic: MicStatus;
  variant: MeterVariant;
  /** Screen unfocused or backgrounded (and, for a meter without a number, the D43 test switch): the meter's UI-thread clock stops (§7.8). Only the ANIMATION is held: the readout below stays true (JA2-34). */
  paused: boolean;
  onClipReset?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function DeviceMicMeter({ mic, variant, paused, onClipReset, style, testID }: DeviceMicMeterProps) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const values = useAudioSharedValues(mic.id);
  // Ruling D137, kept by C21 (7): the input is the microphone line at the channel's position of a COMPLETE pair.
  // Change-only selectors: a flag flip re-renders the meter, a 20 Hz frame never does (F74-13).
  // Task 4 row 171 (site M6): `null` when the channel has no input (the lookup of row 164) - no frame is read,
  // never the frame of `MIC-01` / `MIC-02`, and the meter draws its empty state ("— dBFS", "Not measured").
  const input = useSim((s) => meterInputOfChannel(micLinesInForce(s), mic.id));
  const frameFlat = useSim((s) => (input === null ? true : (s.audio.inputs[input]?.noSignal ?? true)));
  // The Core's own statement (J-S 6, `notMeasured`): an older Core and the simulator never send it.
  const notMeasured = useSim((s) => input === null || isLevelNotMeasured(s.audio.inputs[input]));
  // A channel without an input has no level and no fault of an input: the empty state, whatever the channel record says.
  const kind = input === null ? 'NOT_MEASURED' : deviceMicLevelKind({ state: mic.state, frameFlat, notMeasured });
  // JA2-34: the number is the runtime's 1 Hz readout in EVERY motion mode; the test switch holds animation only.
  const ticking = useAudioAccessibilityValue(mic.id);
  const text = kind === 'LEVEL' ? `${ticking.now} dBFS` : kind === 'NO_SIGNAL' ? t('common.status.noSignal') : MIC_NO_LEVEL_TEXT;
  const a11y = { min: ticking.min, max: ticking.max, now: ticking.now, text };
  // D61 (2026-11-04): the slice states the CHANNEL code; every channel has its word in the shared catalog.
  const name = t(MIC_CHANNEL_NAME_KEY[mic.channel]);
  const label = t('features.devices.mic.meterLabel', { name });
  // The large meter draws its own number; with nothing measured it would read the floor as if it were a
  // level. The plate says what is true. The CLIP latch keeps the meter (its chip is the reset control).
  if (kind === 'NOT_MEASURED' && variant !== 'compact' && !mic.clipLatched) {
    return (
      <View style={[styles.plate, style]} testID={testID} accessible accessibilityRole="text" accessibilityLabel={label} accessibilityValue={a11y}>
        <Text maxFontSizeMultiplier={1.2} style={styles.plateValue} testID={testID ? `${testID}-readout` : undefined}>
          {MIC_NO_LEVEL_TEXT}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.plateNote} testID={testID ? `${testID}-not-measured` : undefined}>
          {`${t('features.devices.level.notMeasured')} · ${t('features.devices.level.notMeasuredNote')}`}
        </Text>
      </View>
    );
  }
  return (
    <DbfsMeter
      level={values.level}
      peak={values.peak}
      clip={values.clip}
      variant={variant}
      motion={policy}
      paused={paused}
      signal={kind === 'NO_SIGNAL' ? 'no-signal' : 'ok'}
      {...(onClipReset ? { onClipReset } : {})}
      labels={{
        unit: 'dBFS',
        clip: t('common.enums.micState.CLIP'),
        noSignal: t('common.status.noSignal'),
        clipResetHint: t('devices.audio.resetClip'),
      }}
      accessibilityLabel={label}
      accessibilityValue={a11y}
      style={style}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  plate: { alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 64 },
  plateValue: { fontFamily: fontFamily.native.mono, fontSize: typography.h2.size, lineHeight: typography.h2.lineHeight, color: palette.foreground },
  plateNote: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray, textAlign: 'center' },
});
