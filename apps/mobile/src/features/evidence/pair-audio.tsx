/**
 * The audio of the camera-microphone pairs of ONE item, as the item states it (audit 2026-11-05 row 207,
 * M3-16 R1/R2; the tablet's copy of the web console's `pair-audio.tsx`, row 159; S5 §6, F-5-11; decisions
 * D27, D30 K-3, D45; register E7, E8, E10).
 *
 * - **One row per sealed AUDIO-0N file**, in pair order: "AUDIO-02 · audio of Pair 2, in VIDEO-02" with the
 *   file's own stored-bytes hash (`evidence-pair-audio-AUDIO-0N`). "in VIDEO-0N" is said only when that camera
 *   file is in the item (E10, the manifest's `containsIn` rule); otherwise the row says the camera file is not
 *   in the package. The hash is the item's (the Core read it from the signed manifest) - never derived here.
 * - **The missing-microphone statement** (`audioTracksMissing`, manifest 2.1; `evidence-audio-missing-AUDIO-0N`):
 *   per stated pair the reason in words (no microphone assigned / microphone could not be opened), and that the
 *   camera file of the pair holds a SILENT track - so that silence is never read as a quiet room.
 * - A legacy item (no AUDIO-0N file, no statement) draws NOTHING: the section it sits in is unchanged.
 *
 * The words are the shared `evidence.itemFacts.sealed.*` keys (E8), the same the web console says.
 */
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { HashText, integrityStyles as styles } from './integrity-tab';
import type { ItemV2 } from './item-v2';

export interface PairAudioProps {
  item: Pick<ItemV2, 'pairAudioFiles' | 'audioTracksMissing'>;
}

export function PairAudio({ item }: PairAudioProps) {
  const { t } = useTranslation();
  if (item.pairAudioFiles.length === 0 && item.audioTracksMissing.length === 0) return null;
  return (
    <View testID="evidence-pair-audio">
      {item.pairAudioFiles.length > 0 ? (
        <View accessibilityLabel={t('evidence.itemFacts.sealed.audioTitle')}>
          <Text maxFontSizeMultiplier={1.2} style={styles.label} testID="evidence-pair-audio-title">
            {t('evidence.itemFacts.sealed.audioTitle')}
          </Text>
          {item.pairAudioFiles.map((audio) => (
            <View key={audio.trackId} testID={`evidence-pair-audio-${audio.trackId}`}>
              <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID={`evidence-pair-audio-${audio.trackId}-label`}>
                {audio.inCamera !== null
                  ? t('evidence.itemFacts.sealed.audioFile', { track: audio.trackId, pair: audio.pair, camera: audio.inCamera })
                  : t('evidence.itemFacts.sealed.audioFileNoCamera', { track: audio.trackId, pair: audio.pair, camera: audio.camera })}
              </Text>
              <HashText value={audio.file.sha256} testID={`evidence-pair-audio-${audio.trackId}-hash`} />
            </View>
          ))}
        </View>
      ) : null}
      {item.audioTracksMissing.length > 0 ? (
        <View accessibilityRole="summary" accessibilityLabel={t('evidence.itemFacts.sealed.missingTitle')} testID="evidence-audio-missing">
          <Text maxFontSizeMultiplier={1.2} style={styles.label}>
            {t('evidence.itemFacts.sealed.missingTitle')}
          </Text>
          {item.audioTracksMissing.map((missing) => {
            const channel = `MIC-0${String(missing.pair)}`;
            return (
              <Text key={missing.trackId} maxFontSizeMultiplier={1.2} style={styles.caption} testID={`evidence-audio-missing-${missing.trackId}`}>
                {missing.reason === 'NOT_ASSIGNED'
                  ? t('evidence.itemFacts.sealed.missing.NOT_ASSIGNED', { track: missing.trackId, pair: missing.pair, channel })
                  : t('evidence.itemFacts.sealed.missing.NOT_OPENED', { track: missing.trackId, pair: missing.pair, channel, device: missing.micDeviceId ?? '' })}{' '}
                {missing.silentIn !== null
                  ? t('evidence.itemFacts.sealed.missingSilent', { camera: missing.silentIn })
                  : t('evidence.itemFacts.sealed.missingNoCamera', { camera: missing.camera })}
              </Text>
            );
          })}
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-audio-missing-note">
            {t('evidence.itemFacts.sealed.missingNote')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
