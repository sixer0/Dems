/**
 * The capture checkpoint facts on Session Live (wave H closing pass Z2; ruling D203 (3)): "24
 * fragments saved · last 2 s ago · 34.0 MB", then one line per camera. Drawn under the status strip,
 * only beside a session of the Core's own capture that states them (`own-capture.ts`).
 *
 * `CaptureCheckpoints` takes literal props (the props interface the checkpoint pass can wire to
 * another source); `SessionCaptureCheckpoints` reads the open session.
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSim } from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { deviceLabel } from '@/features/capture-selector/capture-notices-model';
import { sizeParts } from '@/features/session-summary/summary.model';
import { captureCheckpointsOf, checkpointAge, ownCaptureOf, type CaptureCheckpointFacts } from './own-capture';

export interface CaptureCheckpointsProps {
  facts: CaptureCheckpointFacts;
  /** The client's clock (epoch ms), for the age of the newest checkpoint. */
  nowMs: number;
}

export function CaptureCheckpoints({ facts, nowMs }: CaptureCheckpointsProps) {
  const { t } = useTranslation();
  const size = (bytes: number): string => {
    const parts = sizeParts(bytes);
    return t(`common.units.${parts.unit}`, { value: parts.value });
  };
  const age = checkpointAge(nowMs, facts.lastAt);
  const last = age.unit === 'lastSeconds' ? t('session.captureFacts.checkpoints.lastSeconds', { seconds: age.seconds }) : t('session.captureFacts.checkpoints.lastMinutes', { minutes: age.minutes });
  const total = [t('session.captureFacts.checkpoints.fragments', { count: facts.fragments }), last, size(facts.bytes)].join(' · ');
  return (
    <View testID="monitor-capture-checkpoints" accessible accessibilityRole="text" accessibilityLabel={`${t('session.captureFacts.checkpoints.label')}: ${total}`} style={styles.wrap}>
      <Text maxFontSizeMultiplier={1.2} style={styles.label}>
        {t('session.captureFacts.checkpoints.label')}
      </Text>
      <Text maxFontSizeMultiplier={1.2} style={styles.value} testID="monitor-capture-checkpoints-total">
        {total}
      </Text>
      {facts.cameras.map((camera) => (
        <Text key={camera.deviceId} maxFontSizeMultiplier={1.2} style={styles.camera} testID={`monitor-capture-checkpoints-camera-${camera.deviceId}`}>
          {[deviceLabel(t, camera.deviceId), t('session.captureFacts.checkpoints.fragments', { count: camera.fragments }), size(camera.bytes)].join(' · ')}
        </Text>
      ))}
    </View>
  );
}

/** The checkpoint facts of the open session. The age re-reads the client's clock once a second (a number: no render between). */
export function SessionCaptureCheckpoints() {
  // A flat string from the selector (an object would be a new one each read).
  const packed = useSim((s) => {
    if (!ownCaptureOf(s.session)) return '';
    const facts = captureCheckpointsOf(s.session);
    return facts === null ? '' : JSON.stringify(facts);
  });
  const nowSecond = useSim((s) => Math.floor(s.clock.now / 1000));
  if (packed === '') return null;
  return <CaptureCheckpoints facts={JSON.parse(packed) as CaptureCheckpointFacts} nowMs={nowSecond * 1000} />;
}

const styles = StyleSheet.create({
  wrap: { gap: 2, paddingTop: spacing[1] },
  label: { fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  value: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.foreground },
  camera: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
});
