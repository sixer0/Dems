/**
 * Session Live: the "is on" line of every local device the Core holds open that no tile of the
 * monitor draws (fix pass F-M4 follow-up; review R69-02; ux spec §8f.3: a fixed, non-dismissable
 * state on every client whenever a local device is open).
 *
 * The monitor draws the line itself for the camera ON SCREEN (`TrackSourceBadge` on the feed) and for
 * the microphone of each mic card (`MicInputSourceBadge`). A local camera that feeds the track which
 * is NOT on screen, or a local microphone without a card, had no line. This component draws exactly
 * those — never a second line for a device the monitor already shows.
 *
 * | Fact | From |
 * |---|---|
 * | which devices are open | `sourceOpen: true` on the Core's local device, in Live mode (`openLocalSourcesOf` → `sourceOnKeyOf`, the one rule) |
 * | which the monitor draws | the device of the selector line of `activeCameraId`, and the device behind each mic card (`mics[].deviceId` is the input id; D106 (4)) — the same lookups as the two badges |
 *
 * One flat string is read from the store, so a 20 Hz meter frame renders nothing (F74-13). Nothing is
 * drawn — no wrapper — when there is no such device. No control: the line cannot be dismissed.
 */
import { selectorInForce } from '@/features/capture-selector/selector-in-force';
import { Radio } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSim } from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { openLocalSourcesOf } from '@/features/devices/registered-devices-model';
import { useSourceBadgeMode } from './development-source-badge';

export function OpenLocalSourcesOffScreen({ testID = 'monitor-open-local-sources' }: { testID?: string }) {
  const { t } = useTranslation();
  const { live } = useSourceBadgeMode();
  const line = useSim((s) => {
    const selector = selectorInForce(s);
    const onScreen = selector.cameras.find((camera) => camera.trackId === s.activeCameraId)?.deviceId;
    const cards = s.mics.map((mic) => selector.mics.find((entry) => entry.inputId === mic.deviceId)?.deviceId ?? mic.deviceId);
    return openLocalSourcesOf(s.captureDevices.devices, live, onScreen === undefined ? cards : [onScreen, ...cards])
      .map((source) => `${source.deviceId}|${source.key}`)
      .join(',');
  });
  if (line === '') return null;
  return (
    <View style={styles.stack} testID={testID}>
      {line.split(',').map((entry) => {
        const [deviceId = '', key = ''] = entry.split('|');
        return (
          <View key={deviceId} style={styles.line} accessibilityRole="text" accessibilityLiveRegion="polite" testID={`${testID}-${deviceId}`}>
            <Radio size={14} color={palette.warning} />
            <Text maxFontSizeMultiplier={1.2} style={styles.text}>
              {t(key)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing[0], paddingHorizontal: spacing[3], paddingVertical: spacing[0] },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[0] },
  text: { flexShrink: 1, fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.warning },
});
