/**
 * The audio-source band (blueprint row 92; UX spec flow 5 step 4, §6.6, §6.7; R-3): which
 * microphone fed the single audio track over the recording, drawn from the item's
 * `audioSourceIntervals` (media pts). A STATIC overlay: only the playhead mark moves, and that
 * follows the media clock of the player. Plain views (no Reanimated state to lose, E-13).
 *
 * Colour is never the only sign: the legend names each microphone with its spans, and the line
 * under the band says which one is audible at the playhead. A microphone whose interval a verify
 * result states as a development source carries the badge in the legend.
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { derived, fontFamily, palette, spacing, statusText, typography } from '@dems/shared/tokens';
import { VerifiedSourceBadge } from './development-source';
import { bandInputs, formatMediaTime, segmentAt, type BandSegment, type VerifiedSources } from './sealed-playback';

export interface AudioSourceBandProps {
  segments: readonly BandSegment[];
  /** The recorded span the band covers, in ms. */
  totalMs: number;
  /** The playhead, in ms of media time. */
  positionMs: number;
  /** The source classes of the last verify run on this screen, or null. */
  sources: VerifiedSources | null;
}

const TONES = [palette.gold, statusText.sealed, statusText.info, palette.gray] as const;
const toneOf = (tone: number): string => TONES[tone % TONES.length] ?? palette.gold;

export function AudioSourceBand({ segments, totalMs, positionMs, sources }: AudioSourceBandProps) {
  const { t } = useTranslation();
  const micName = (inputId: string): string => (inputId === 'MIC-01' ? t('common.devices.mic1') : inputId === 'MIC-02' ? t('common.devices.mic2') : inputId);
  if (segments.length === 0) {
    return (
      <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-band-none">
        {t('evidence.playback.band.none')}
      </Text>
    );
  }
  const now = segmentAt(segments, positionMs);
  const headPct = totalMs > 0 ? Math.min(100, Math.max(0, (positionMs / totalMs) * 100)) : 0;
  return (
    <View style={styles.root} testID="evidence-band">
      <Text maxFontSizeMultiplier={1.2} style={styles.label}>
        {t('evidence.playback.band.title')}
      </Text>
      <View style={styles.track} accessible accessibilityRole="image" accessibilityLabel={t('evidence.playback.band.label')}>
        {segments.map((segment) => (
          <View
            key={segment.seq}
            testID={`evidence-band-segment-${segment.seq}`}
            accessibilityLabel={t('evidence.playback.band.segment', { mic: micName(segment.inputId), from: formatMediaTime(segment.fromMs), to: formatMediaTime(segment.toMs) })}
            style={[styles.segment, { left: `${segment.startPct}%`, width: `${segment.widthPct}%`, backgroundColor: toneOf(segment.tone) }]}
          />
        ))}
        <View testID="evidence-band-head" style={[styles.head, { left: `${headPct}%` }]} />
      </View>
      <View style={styles.legend} testID="evidence-band-legend">
        {bandInputs(segments).map((input) => {
          const development = sources?.state === 'DEVELOPMENT' ? sources.audioIntervals.find((entry) => entry.sourceClass !== 'PRODUCTION' && segments.some((segment) => segment.seq === entry.seq && segment.inputId === input.inputId)) : undefined;
          return (
            <View key={input.inputId} style={styles.legendRow} testID={`evidence-band-legend-${input.inputId}`}>
              <View style={[styles.swatch, { backgroundColor: toneOf(input.tone) }]} />
              <Text maxFontSizeMultiplier={1.2} style={styles.strong}>
                {micName(input.inputId)}
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
                {segments
                  .filter((segment) => segment.inputId === input.inputId)
                  .map((segment) => `${formatMediaTime(segment.fromMs)}–${formatMediaTime(segment.toMs)}`)
                  .join(', ')}
              </Text>
              {development ? <VerifiedSourceBadge sourceClass={development.sourceClass} testID={`evidence-band-development-${input.inputId}`} /> : null}
            </View>
          );
        })}
      </View>
      <Text maxFontSizeMultiplier={1.2} style={styles.caption} accessibilityLiveRegion="polite" testID="evidence-band-now">
        {now ? t('evidence.playback.band.now', { mic: micName(now.inputId) }) : t('evidence.playback.band.nowNone')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[0] + 2 },
  track: { height: 14, borderRadius: 4, borderWidth: 1, borderColor: derived.border, backgroundColor: derived.surfaceSecondary, overflow: 'hidden' },
  segment: { position: 'absolute', top: 0, bottom: 0 },
  head: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: palette.foreground },
  legend: { gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1] },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  label: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.size * typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: palette.gray,
  },
  strong: { fontFamily: fontFamily.native.semibold, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.foreground },
  caption: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
});
