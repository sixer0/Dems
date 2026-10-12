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
import { micLinesInForce } from '@/features/capture-selector/selector-in-force';
import { Chip, Surface } from 'heroui-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { AudioTrackId } from '@dems/shared/domain';
import { isLevelNotMeasured, meterInputOfChannel, useSim, type MicStatus } from '@dems/shared/sim';
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

/**
 * `ABSENT` (task 4 row 170, site M4): the meter channel of the card has NO input - the selector in force holds
 * no complete microphone pair. Nothing is waited for and no frame is read; the card says so in words.
 */
export type MicLevelState = 'WAITING' | 'OK' | 'NO_SIGNAL' | 'NOT_MEASURED' | 'ABSENT';

/**
 * Fix wave J (JM-05; tablet, normal launch: "the two microphone cards are EMPTY for the first 12 s of a
 * recording" - reproduced at 00:00:04: no meter, no number, no word).
 *
 * The meter is a canvas fed through shared values on the UI runtime; until its first frames are painted the
 * card held nothing a person could read. The STATE of the input is a fact of the store and needs no canvas:
 * whether a level frame of this line has arrived, and what it says. It is read here on the JS side (a boolean
 * and a word per card, changing a few times in a session - never per audio frame) and drawn by React under the
 * meter, from the first render of the card.
 */
export function useMicLevelState(micId: MicStatus['id']): MicLevelState {
  return useSim((s) => {
    // The input by the lookup of row 164: `null` for a channel without one - never the frame of `MIC-01` / `MIC-02`.
    const input = meterInputOfChannel(micLinesInForce(s), micId);
    if (input === null) return 'ABSENT';
    const frame = s.audio.inputs[input];
    if (frame === undefined) return 'WAITING';
    if (isLevelNotMeasured(frame)) return 'NOT_MEASURED';
    return frame.noSignal ? 'NO_SIGNAL' : 'OK';
  });
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
  // Wave H closing pass Z2 (ruling D137): the card is a LINE. The microphone on it is the one the capture
  // configuration names for this channel (the open session's snapshot first) - not `mic.deviceId`, the
  // channel record's constant `MIC-01` / `MIC-02`, which no selector edit moves.
  // Task 4 row 170: `null` when the channel has no input (no complete pair) - the card then draws no badge of a
  // device and its state line reads "No microphone input".
  const lineInput = useSim((s) => meterInputOfChannel(micLinesInForce(s), mic.id));
  const active = sourceRole === 'ACTIVE';
  const levelState = useMicLevelState(mic.id);
  // While the cameras connect the meter's place says CONNECTING and nothing is recorded yet: no second word.
  const connecting = useConnectingCameras();

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
      {lineInput === null ? null : <MicInputSourceBadge inputId={lineInput} testID={`monitor-mic-source-${mic.channel}`} />}
      <MicMeter mic={mic} testID={`monitor-meter-${mic.channel}`} {...meter} />
      {/* JM-05: the state of the input in words, by React, whatever the canvas above has painted so far. */}
      {connecting ? null : (
      <Text
        maxFontSizeMultiplier={1.2}
        style={[styles.levelState, levelState !== 'ABSENT' && (levelState === 'NO_SIGNAL' || mic.state === 'NO_SIGNAL') ? styles.levelStateAlarm : null]}
        testID={`monitor-mic-level-state-${mic.channel}`}
      >
        {/* An absent input is said as absent: the channel record's own `NO_SIGNAL` is about no input of the selector. */}
        {t(`features.session-live.mic.levelState.${levelState === 'ABSENT' ? 'ABSENT' : mic.state === 'NO_SIGNAL' ? 'NO_SIGNAL' : levelState}`)}
      </Text>
      )}
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
  levelState: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
  levelStateAlarm: { color: toneHex.danger },
  connectingText: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    letterSpacing: 0.6,
  },
});
