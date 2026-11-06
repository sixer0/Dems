/**
 * Media tab (04_mobile_specs §4.11 D5a; MB 6 905–955): a horizontal strip of the camera posters the
 * demo item bundles (`cameraTracksOf`: any of the four video tracks with a poster; the bundled demo
 * clips exist for cameras 1-2 only, D172) with a play overlay and the duration label, then the demo's
 * microphone tracks (`MICS`: AUDIO-01 and AUDIO-02, the only audio the bundled demo carries - not the
 * four channels a Core records, D61). Each opens the Play sheet on that camera or microphone. Posters
 * are `expo-image` (no canvas per poster, §7.8). The strip has no snapshots: the simulator keeps none
 * per evidence item (SIM-GAP-M83-2).
 *
 * Kept for the debug / jest `core=SIMULATED` path (D163 RT-1; audit row 211, M3-18): a release build is
 * LIVE only. This tab draws BUNDLED DEMO media only (the posters and microphone tracks of a demo
 * package): Simulated mode, and in Live mode a demo item whose package the Core named. There the
 * caller passes `demoLabel` and the tab says what the pictures are (wave H C2, G94-02): bundled with
 * this application, not a recording of this Core. A recording this Core sealed never comes here
 * (`evidence-detail.tsx`: the sealed player, or the "no playable media" state).
 */
import { Image } from 'expo-image';
import { PressableFeedback } from 'heroui-native';
import { AudioLines, Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { VIDEO_TRACK_IDS, type AudioTrackId, type VideoTrackId } from '@dems/shared/domain';
import { formatDuration } from '@dems/shared/realtime';
import { derived, fontFamily, palette, radius, spacing, statusText, typography } from '@dems/shared/tokens';
import { demoVideoAssetOf, withAlpha, type DemoMediaItem } from '@/components/media';

// D60 (2026-11-04): four video tracks — the strip renders the tracks the demo corpus actually carries for this item.
const cameraTracksOf = (item: DemoMediaItem): readonly VideoTrackId[] => VIDEO_TRACK_IDS.filter((track) => item.poster[track] !== undefined);
const MICS: readonly AudioTrackId[] = ['AUDIO-01', 'AUDIO-02'];

export interface MediaTabProps {
  media: DemoMediaItem | null;
  durationMs: number;
  clipMs: number;
  onOpenCamera: (camera: VideoTrackId) => void;
  onOpenMic: (mic: AudioTrackId) => void;
  /** Live mode: the label of bundled demo media is drawn above the posters. */
  demoLabel?: boolean;
}

export function MediaTab({ media, durationMs, clipMs, onOpenCamera, onOpenMic, demoLabel = false }: MediaTabProps) {
  const { t } = useTranslation();
  const duration = formatDuration(durationMs);
  if (!media) {
    return (
      <Text maxFontSizeMultiplier={1.2} style={styles.note} testID="evidence-media-none">
        {t('features.evidence.media.noMedia')}
      </Text>
    );
  }
  return (
    <View style={styles.root} testID="evidence-media">
      {demoLabel ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.demoLabel} accessibilityRole="text" testID="evidence-media-demo-label">
          {t('evidence.itemFacts.media.demoLabel')}
        </Text>
      ) : null}
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {cameraTracksOf(media).map((camera) => (
          <PressableFeedback
            key={camera}
            testID={`evidence-media-${camera}`}
            accessibilityRole="button"
            accessibilityLabel={t('features.evidence.media.playTrack', { track: t(`common.tracks.${camera}`) })}
            onPress={() => onOpenCamera(camera)}
            style={styles.poster}
          >
            <Image source={demoVideoAssetOf(media, 'poster', camera)} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} transition={0} />
            <View style={styles.playRing}>
              <Play size={18} color={palette.foreground} fill={palette.foreground} />
            </View>
            <View style={styles.posterFoot}>
              <Text maxFontSizeMultiplier={1.2} style={styles.posterLabel} numberOfLines={1}>
                {t(`common.tracks.${camera}`)}
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.posterDuration}>
                {duration}
              </Text>
            </View>
          </PressableFeedback>
        ))}
      </ScrollView>
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.label}>
        {t('features.evidence.media.audioTitle')}
      </Text>
      <View style={styles.mics}>
        {MICS.map((mic) => (
          <PressableFeedback
            key={mic}
            testID={`evidence-media-${mic}`}
            accessibilityRole="button"
            accessibilityLabel={t('features.evidence.media.playTrack', { track: t(`common.tracks.${mic}`) })}
            onPress={() => onOpenMic(mic)}
            style={styles.mic}
          >
            <AudioLines size={18} color={palette.gold} />
            <View style={styles.micText}>
              <Text maxFontSizeMultiplier={1.2} style={styles.micLabel} numberOfLines={1}>
                {t(`common.tracks.${mic}`)}
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.posterDuration}>
                {duration}
              </Text>
            </View>
          </PressableFeedback>
        ))}
      </View>
      <Text maxFontSizeMultiplier={1.2} style={styles.note}>
        {t('features.evidence.media.audioHint')} {t('features.evidence.media.excerptNote', { clip: Math.round(clipMs / 1000), duration })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  strip: { gap: spacing[1] + 2 },
  poster: {
    width: 176,
    aspectRatio: 16 / 10,
    borderRadius: radius.px.lg,
    overflow: 'hidden',
    backgroundColor: derived.surfaceSecondary,
    borderWidth: 1,
    borderColor: derived.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: withAlpha(palette.foreground, 0.85),
    backgroundColor: withAlpha(palette.black, 0.35),
  },
  posterFoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[1],
    paddingVertical: 4,
    backgroundColor: withAlpha(palette.black, 0.55),
  },
  posterLabel: { fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.foreground, flexShrink: 1 },
  posterDuration: { fontFamily: fontFamily.native.mono, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.foreground, fontVariant: ['tabular-nums'] },
  label: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.size * typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: palette.gray,
  },
  mics: { flexDirection: 'row', gap: spacing[1] + 2 },
  mic: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius: radius.px.lg,
    backgroundColor: derived.surfaceSecondary,
    borderWidth: 1,
    borderColor: derived.border,
  },
  micText: { flex: 1, minWidth: 0 },
  micLabel: { fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: derived.foreground2 },
  note: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  demoLabel: { fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: statusText.warning },
});
