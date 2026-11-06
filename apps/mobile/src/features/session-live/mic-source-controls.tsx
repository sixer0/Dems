/**
 * The microphone warnings under the MIC cards of the Session Live monitor (task 3 M5, blueprint row 73;
 * ux spec §3.2 step 8; OD-11; round two JA2-06).
 *
 * Audit row 185 (M3-05; D5, D134, D136, D138; register O4-O6 of `masterplan/01_specs_m3.md`):
 * operation 81 is RETIRED - the microphone of each pair is fixed by setup. The "Switch to MIC n" toggle,
 * its block reasons, its confirmation, the incomplete-pair sentence, the refusal sentences and the
 * "Switch to channel 2" / "Switch to MIC n" offers of the two warnings are REMOVED (web twin: audit row
 * 157, `apps/core-web/src/features/session-monitor/audio-source-controls.tsx`). The tablet sends op 81
 * nowhere and reads none of the retired `session.audioSource.*` switch keys (O6).
 *
 * | ux §3 | Here |
 * |---|---|
 * | §3.2 step 8 | `MIC_SILENT`: an `Alert` of status warning that names the silent input, with the D5 sentence (O5) and no button |
 * | JA2-06 | `MIC_NO_SIGNAL`, drawn when no silence warning is: danger for the transcribed input, warning for another; no button |
 *
 * `MicSourcePanel` is the presentation (plain props; the test beds draw it without a store);
 * `MicSourceControls` connects it to `useMicSource`. The names are kept, so the monitor's one mount
 * (`session-live-screen.tsx`) is unchanged.
 *
 * Fabric (CF-M1, D208): only plain views, no Reanimated view and no `exiting` animation, inside one
 * container that is never flattened, so the warning's coming and going moves no sibling of the
 * monitor.
 */
import { Alert } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { MIC_SILENCE_DBFS, MIC_SILENCE_DURATION_MS } from '@dems/shared/api';
import { spacing } from '@dems/shared/tokens';
import { triggerHaptic } from '@/motion';
import { useMicInputName } from '@/features/capture-selector/development-source-badge';
import { useMicSource } from './use-mic-source';

export interface MicSourcePanelProps {
  /** The input inside `AUDIO-01` (Pair 1, transcribed), or `null` when it is absent (task 4 row 170). */
  activeInputId: string | null;
  /** The input of an active `MIC_SILENT` warning while recording, or `null`. */
  silentInputId: string | null;
  /** JA2-06: the input of an active `MIC_NO_SIGNAL` fault; drawn when no silence warning is. */
  noSignalInputId?: string | null;
}

/** The silence warning and the no-signal notice; presentation only. Neither offers an action (row 185). */
export function MicSourcePanel({ activeInputId, silentInputId, noSignalInputId = null }: MicSourcePanelProps) {
  const { t } = useTranslation();
  // Integration pass D2: named from the id the Core sent ("MIC 1", "Microphone 3", "Core Mac's microphone").
  const micName = useMicInputName();

  return (
    <View testID="monitor-mic-source" collapsable={false} style={styles.root}>
      {silentInputId !== null ? (
        <Alert status="warning" testID="monitor-mic-silent" accessibilityLiveRegion="polite">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('session.audioSource.silent.title', { mic: micName(silentInputId) })}</Alert.Title>
            {/* Register O5 (D138): the D5 sentence - the microphone of each pair is fixed by setup. No button (row 185). */}
            <Alert.Description>
              {t('session.audioSource.silent.body', { dbfs: MIC_SILENCE_DBFS, seconds: MIC_SILENCE_DURATION_MS / 1000 })}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {/* Round two (JA2-06): a microphone the Core reports WITHOUT A SIGNAL is said here, by name - on the monitor it
          showed only in its small meter. Row 185: it offers no switch (op 81 is retired). */}
      {silentInputId === null && noSignalInputId !== null ? (
        <Alert status={noSignalInputId === activeInputId ? 'danger' : 'warning'} testID="monitor-mic-no-signal" accessibilityLiveRegion="polite">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('features.session-live.micNoSignal.title', { mic: micName(noSignalInputId) })}</Alert.Title>
            <Alert.Description>{t(noSignalInputId === activeInputId ? 'features.session-live.micNoSignal.activeBody' : 'features.session-live.micNoSignal.standbyBody')}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </View>
  );
}

/** The microphone warnings of the monitor, connected to the store. Mount it once. It sends nothing (row 185). */
export function MicSourceControls() {
  const view = useMicSource();

  // One Warning haptic when a silence warning appears (never tied to the 20 Hz data).
  const wasSilent = useRef(view.silentInputId !== null || view.noSignalInputId !== null);
  useEffect(() => {
    const silent = view.silentInputId !== null || view.noSignalInputId !== null;
    if (silent && !wasSilent.current) triggerHaptic('gateWarn');
    wasSilent.current = silent;
  }, [view.silentInputId, view.noSignalInputId]);

  return <MicSourcePanel activeInputId={view.activeInputId} silentInputId={view.silentInputId} noSignalInputId={view.noSignalInputId} />;
}

const styles = StyleSheet.create({
  root: { gap: spacing[1] },
});
