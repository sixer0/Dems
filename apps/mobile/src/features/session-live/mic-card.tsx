/**
 * S4 MIC card (04_mobile_specs §4.5 S4, S8; §5.4 transient meter path; MB 4 (948–1185, 310–395)).
 *
 * `Surface variant="secondary"` + a dot `Chip` "MIC 1" + the C-2 DbfsMeter. The meter is fed by
 * `useAudioSharedValues(channel)` (step 73): every 20 Hz frame writes Reanimated shared values and
 * calls `reportMeterFrame`, so an audio frame causes zero React renders (MA-16, D57). The meter's
 * `accessibilityValue` refreshes at 1 Hz from JS (`useAudioAccessibilityValue`).
 *
 * S8: NO SIGNAL fades the segments (the frame flag, bridged change-only, or the simulator's mic
 * state); the CLIP latch locks the top
 * segment red and shows the CLIP chip (tap resets it through `resetClip`). A new latch plays the
 * Warning haptic once (§7.6 "MIC clip latch").
 *
 * Live mode (backend task, row W68): the levels are the Core server's — the Live source writes the
 * store's `audio` slice from each socket `meters` frame and `useAudioSharedValues` copies it into the
 * shared values, so the meter still draws on the UI thread with zero React renders per frame; on a
 * lost link the Live source resets the slice to silent frames and the meter shows NO SIGNAL. The
 * CLIP reset is a Core command: one per meter at a time (`usePendingPress()` from `@/runtime`, LB-1);
 * the chip itself is drawn by `components/composed/dbfs-meter.tsx`, which is not this feature's, so
 * it carries no busy mark or Spinner. Its result is ignored, as before ([CS:S2-1]); the CLIP chip
 * leaves when the Core's delta clears the latch.
 */
import { Chip, Surface } from 'heroui-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { AudioTrackId } from '@dems/shared/domain';
import type { MicStatus } from '@dems/shared/sim';
import { MicStateTone, fontFamily, palette, toneHex, typography } from '@dems/shared/tokens';
import { DbfsMeter, type MeterVariant } from '@/components/composed/dbfs-meter';
import { ROW_CARD_BORDER, SelectionGlow } from '@/components/composed/selection-glow';
import { StatusChip } from '@/components/kit';
import { MicInputSourceBadge } from '@/features/capture-selector/development-source-badge';
import { useConnectingCameras } from './rec-indicator';
import { useMicSourceRole } from './use-mic-source';
import { triggerHaptic, useMotionPolicy } from '@/motion';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useAudioAccessibilityValue, useAudioSharedValues, usePendingPress, type AudioSharedValues } from '@/runtime';

export interface MicMeterProps {
  mic: MicStatus;
  variant: MeterVariant;
  /** Screen unfocused or backgrounded: the meter's UI-thread clock stops (04 §7.8). */
  paused: boolean;
  monitoringPaused: boolean;
  /** Sends `resetClip(channel)`; calls `release` once the command settled. */
  onClipReset: (channel: AudioTrackId, release: () => void) => void;
  testID?: string;
}

/** The C-2 meter for one channel, wired to the runtime's shared values. */
export function MicMeter({ mic, variant, paused, monitoringPaused, onClipReset, testID }: MicMeterProps) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const values = useAudioSharedValues(mic.id);
  const flat = useNoSignal(values);
  const noSignalText = t('session.feed.noSignal');
  const a11y = useAudioAccessibilityValue(mic.id, { noSignalText });
  const clipPress = usePendingPress();
  const shortName = mic.channel === 2 ? t('common.devices.mic2') : t('common.devices.mic1');
  // Integration pass D7 item 4 (row 139's leftover; ux §8e.2 "no meter presented as recording", D84): before the
  // first durable fragment no live level is drawn — real capture sends no meter then, and a moving bar would read
  // as a recording. The card and the Audio sheet show the connecting state in the meter's place.
  const connecting = useConnectingCameras();
  if (connecting) {
    return (
      <View
        accessible
        accessibilityLabel={`${t('features.session-live.mic.meterLabel', { mic: shortName })}: ${t('common.session.connectingCameras')}`}
        style={styles.connecting}
        testID={testID === undefined ? `monitor-meter-connecting-${mic.channel}` : `${testID}-connecting`}
      >
        <Text maxFontSizeMultiplier={1.2} style={styles.connectingText}>
          {t('common.session.trackConnecting')}
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
      signal={flat || mic.state === 'NO_SIGNAL' ? 'no-signal' : 'ok'}
      monitoringPaused={monitoringPaused}
      onClipReset={() => {
        clipPress.run((release) => onClipReset(mic.id, release));
      }}
      labels={{
        unit: 'dBFS',
        clip: t('common.enums.micState.CLIP'),
        noSignal: noSignalText,
        clipResetHint: t('session.audio.clipReset'),
      }}
      accessibilityLabel={t('features.session-live.mic.meterLabel', { mic: shortName })}
      accessibilityValue={a11y}
      testID={testID}
    />
  );
}

/**
 * The meter takes NO SIGNAL as a plain prop, while the runtime publishes it per audio frame as a
 * shared value (review 74 F74-08, D73). This bridges it on the UI thread and crosses to JS only when
 * it flips, so a 20 Hz stream never re-renders the card. The simulator's mic state (`NO_SIGNAL`)
 * is honoured too, so a fault shows even before the next frame.
 */
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

export interface MicCardProps extends Omit<MicMeterProps, 'testID'> {
  style?: StyleProp<ViewStyle>;
}

/**
 * MB 4 MIC card: dot chip, meter bars and the dBFS readout.
 *
 * Task 3 M5 (row 73; ux §3.2 step 1, register MB-03): while a session records, the card says whether
 * its input is the one inside `AUDIO-01` ("Active") or the hot standby ("Standby"). The words are the
 * session's pair as the store holds it (D105: not "Primary", which stays the configured role on
 * Devices and can differ after a switch); nothing on the card flips them. The active card is
 * outlined in gold with the always-mounted `SelectionGlow` (E-15: the border is there in both
 * states and the glow is the card's LAST child, so a switch changes two colours and mounts nothing).
 */
export function MicCard({ mic, style, ...meter }: MicCardProps) {
  const { t } = useTranslation();
  const tone = MicStateTone[mic.state];
  const label = mic.channel === 2 ? t('common.devices.mic2') : t('common.devices.mic1');
  const sourceRole = useMicSourceRole(mic.id);
  const active = sourceRole === 'ACTIVE';

  // §7.6: one Warning haptic when the CLIP latch sets (never tied to the 20 Hz data).
  const wasLatched = useRef(mic.clipLatched);
  useEffect(() => {
    if (mic.clipLatched && !wasLatched.current) triggerHaptic('micClip');
    wasLatched.current = mic.clipLatched;
  }, [mic.clipLatched]);

  return (
    <Surface
      variant="secondary"
      style={[styles.card, active ? styles.cardActive : null, style]}
      testID={`monitor-mic-${mic.channel}`}
      accessibilityState={{ selected: active }}
    >
      <View style={styles.header}>
        <Chip size="sm" variant="soft" color={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'success'}>
          <View style={[styles.dot, { backgroundColor: toneHex[tone] }]} />
          <Chip.Label>{label}</Chip.Label>
        </Chip>
        {sourceRole !== null ? (
          <StatusChip
            size="sm"
            tone={active ? 'success' : 'default'}
            label={t(`session.audioSource.role.${sourceRole}`)}
            icon={null}
            testID={`monitor-mic-role-${mic.channel}`}
          />
        ) : null}
      </View>
      {/* Pass D2 (ux §8f.2; row 138's request): the one badge; no node unless the Core sent the development class. */}
      <MicInputSourceBadge inputId={mic.deviceId} testID={`monitor-mic-source-${mic.channel}`} />
      <MicMeter mic={mic} testID={`monitor-meter-${mic.channel}`} {...meter} />
      {/* E-15 (W93-4): always mounted, last; React sets its opacity. */}
      <SelectionGlow selected={active} radius={CARD_RADIUS} testID={`monitor-mic-glow-${mic.channel}`} />
    </Surface>
  );
}

const CARD_RADIUS = 12;

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: CARD_RADIUS, padding: 12, gap: 10, ...ROW_CARD_BORDER },
  cardActive: { borderColor: palette.gold },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  /** The meter's place while the cameras connect (the `card` meter's height; no canvas, no level). */
  connecting: { minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  connectingText: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    letterSpacing: 0.6,
  },
});
