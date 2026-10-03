/**
 * C-2 DbfsMeter for one microphone channel (04_mobile_specs §4.12 V3 `compact` inline on tablet
 * rows, V5 `large` in the detail; §5.4 transient meter path). The meter is fed by
 * `useAudioSharedValues(channel)` (step 73), so a 20 Hz audio frame causes zero React renders
 * (MA-16); the accessibility value refreshes at 1 Hz. This feature keeps its own copy of the
 * session monitor's wiring (P6: another feature's files are not shared code).
 *
 * NO SIGNAL is bridged from the per-frame shared value on the UI thread and crosses to JS only when
 * it flips (review 74 F74-08, D73); the simulator's mic state is honoured too. The CLIP latch locks
 * the top segment red; tapping the CLIP chip resets it through `onClipReset` (`resetClip`).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { MicStatus } from '@dems/shared/sim';
import { DbfsMeter, type MeterVariant } from '@/components/composed/dbfs-meter';
import { useMotionPolicy } from '@/motion';
import { useAudioAccessibilityValue, useAudioSharedValues, type AudioSharedValues } from '@/runtime';

/** Under the D43 test switch the readout refreshes once an hour, i.e. it holds still for uiautomator. */
const TEST_SWITCH_READOUT_MS = 3_600_000;

export interface DeviceMicMeterProps {
  mic: MicStatus;
  variant: MeterVariant;
  /** Screen unfocused, backgrounded or the D43 test switch: the meter's UI-thread clock stops (§7.8). */
  paused: boolean;
  /** Hold the 1 Hz readout still (the D43 test switch). */
  holdReadout?: boolean;
  onClipReset?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function DeviceMicMeter({ mic, variant, paused, holdReadout = false, onClipReset, style, testID }: DeviceMicMeterProps) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const values = useAudioSharedValues(mic.id);
  const flat = useNoSignal(values);
  const noSignalText = t('common.status.noSignal');
  const a11y = useAudioAccessibilityValue(mic.id, { noSignalText, ...(holdReadout ? { intervalMs: TEST_SWITCH_READOUT_MS } : {}) });
  const name = mic.channel === 2 ? t('common.devices.mic2') : t('common.devices.mic1');
  return (
    <DbfsMeter
      level={values.level}
      peak={values.peak}
      clip={values.clip}
      variant={variant}
      motion={policy}
      paused={paused}
      signal={flat || mic.state === 'NO_SIGNAL' ? 'no-signal' : 'ok'}
      {...(onClipReset ? { onClipReset } : {})}
      labels={{
        unit: 'dBFS',
        clip: t('common.enums.micState.CLIP'),
        noSignal: noSignalText,
        clipResetHint: t('devices.audio.resetClip'),
      }}
      accessibilityLabel={t('features.devices.mic.meterLabel', { name })}
      accessibilityValue={a11y}
      style={style}
      testID={testID}
    />
  );
}

/** NO SIGNAL from the frame flag, crossing to JS only when it flips (D73 F74-08). */
function useNoSignal(values: AudioSharedValues): boolean {
  const [flat, setFlat] = useState(false);
  useAnimatedReaction(
    () => values.noSignal.get() > 0.5,
    (now, previous) => {
      if (now !== previous) scheduleOnRN(setFlat, now);
    },
    [values],
  );
  return flat;
}
