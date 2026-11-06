/**
 * THE SEALED FORMAT OF AN ITEM on the evidence detail (fix wave L, G89c-04; ruling D229 (3);
 * contract `delegation_progress/contract_wave_l.md` section 4).
 *
 * | The Core states (operation 40) | The detail shows |
 * |---|---|
 * | `evidence.files[].profile` (the SIGNED manifest's `tracks[].profile`, field 36) | "Sealed format (signed manifest)": per camera file the value AS STATED - `H264_720P30` is a code of the manifest's closed vocabulary and is repeated, never re-worded into a resolution or a frame rate this app would have to derive |
 * | `evidence.streamProfileNotice` | a notice line per track: what the recorded stream declared against what the selector had configured |
 * | neither | NOTHING. No "1080p / 25 fps", no `profileId` (the session's input; D224 (5)), no constant |
 *
 * Read by name through `item-facts.ts` (`readDetailFacts`); the replicated item's own `files` are the
 * fall-back for the format while operation 40 has not answered (`readSealedProfiles`).
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, palette, statusText, typography } from '@dems/shared/tokens';
import type { SealedProfileFact, StreamProfileNoticeFact } from './item-facts';

export interface SealedFormatProps {
  profiles: readonly SealedProfileFact[] | null;
  notice: readonly StreamProfileNoticeFact[] | null;
  testID?: string;
}

export function SealedFormat({ profiles, notice, testID = 'evidence-sealed-format' }: SealedFormatProps) {
  const { t } = useTranslation();
  if (profiles === null && notice === null) return null;
  return (
    <View style={styles.block} testID={testID}>
      {profiles === null ? null : (
        <View accessible accessibilityRole="text" testID={`${testID}-profiles`}>
          <Text maxFontSizeMultiplier={1.2} style={styles.label}>
            {t('features.evidence.sealedFormat.title')}
          </Text>
          {profiles.map((fact) => (
            <Text key={fact.trackId} maxFontSizeMultiplier={1.2} style={styles.value} testID={`${testID}-${fact.trackId}`}>
              {t('features.evidence.sealedFormat.track', { track: t(`common.tracks.${fact.trackId}`), profile: fact.profile })}
            </Text>
          ))}
        </View>
      )}
      {notice === null ? null : (
        <View accessible accessibilityRole="text" testID={`${testID}-notice`}>
          <Text maxFontSizeMultiplier={1.2} style={styles.noticeTitle}>
            {t('features.evidence.sealedFormat.noticeTitle')}
          </Text>
          {notice.map((fact) => (
            <Text key={fact.trackId} maxFontSizeMultiplier={1.2} style={styles.notice} testID={`${testID}-notice-${fact.trackId}`}>
              {t('features.evidence.sealedFormat.noticeTrack', { track: t(`common.tracks.${fact.trackId}`), stream: fact.stream, configured: fact.configured })}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  label: { fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  value: { fontFamily: fontFamily.native.mono, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.foreground },
  noticeTitle: { fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: statusText.warning },
  notice: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: statusText.warning },
});
