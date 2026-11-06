/**
 * Play sheet (04_mobile_specs §4.11 D6 Play; D50, D68; row 83): kit `BottomSheet` with the camera
 * clip (expo-video `VideoView`), a kit `Slider` scrubber over the RECORDED duration, Play/Pause, a
 * camera switch (kit `Tabs`), the MIC 1 / MIC 2 switch (kit `TagGroup`, one track at a time) and the
 * "Simulated playback" and "DEMO excerpt" chips. The clips are DEMO excerpts from the recording
 * start (the excerpt rule, `use-evidence-playback.ts`).
 *
 * The step-72 `CameraFeed` plays muted loops with no seek control, so the sheet drives its own
 * expo-video player (the CameraFeed contract allows either, 45 §3.1). Without DEMO media (a later
 * live recording) the sheet shows `CameraFeed`'s procedural playback instead and no audio.
 *
 * Live mode (backend task W74; 01_specs MS-2; gateway_check/09 §4 answer 3 rule 8): the media is
 * the bundled package the Core named, so the first chip reads "Bundled demo package" (not
 * "Simulated playback"); with no bundled media neither chip shows. The caller passes `live` (the
 * runtime's hooks do not reach portalled sheet content).
 *
 * Wave H C2 (G94-02, BLOCKER): in Live mode this sheet opens ONLY for bundled demo media of a demo
 * item (`evidence-detail.tsx` `playable`). Should it ever be opened in Live mode without media, it
 * draws NO picture: the procedural `CameraFeed` with the session's clock is the simulator's
 * stand-in and belongs to Simulated mode alone, under its "Simulated playback" chip.
 */
import { Button, Slider, Tabs, TagGroup } from 'heroui-native';
import { VideoView } from 'expo-video';
import { Pause, Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { VIDEO_TRACK_IDS, type AudioTrackId, type VideoTrackId } from '@dems/shared/domain';
import { formatDuration } from '@dems/shared/realtime';
import { derived, fontFamily, palette, radius, spacing, statusText, typography } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { CameraFeed, type DemoMediaItem } from '@/components/media';
import { triggerHaptic, useMotionPolicy } from '@/motion';
import { SheetFrame } from './sheet-frame';
import { useEvidencePlayback } from './use-evidence-playback';

export interface PlaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  evidenceId: string;
  media: DemoMediaItem | null;
  durationMs: number;
  clipMs: number;
  recordedAt: number;
  initialCamera?: VideoTrackId;
  initialMic?: AudioTrackId;
  /** The Core link source is LIVE (W74): the chips name the bundled package. */
  live?: boolean;
}

export function PlaySheet({ isOpen, onClose, evidenceId, media, live = false, ...rest }: PlaySheetProps) {
  const { t } = useTranslation();
  return (
    <SheetFrame
      isOpen={isOpen}
      onClose={onClose}
      title={t('features.evidence.play.title')}
      description={evidenceId}
      closeLabel={t('features.evidence.play.close')}
      testID="evidence-play-sheet"
      lockContentPan
      badges={
        !live ? (
          <>
            <StatusChip size="sm" tone="default" icon={null} label={t('features.evidence.play.simulated')} testID="evidence-play-simulated" />
            <StatusChip size="sm" tone="warning" icon={null} label={t('features.evidence.play.excerpt')} testID="evidence-play-excerpt" />
          </>
        ) : media ? (
          <>
            <StatusChip size="sm" tone="default" icon={null} label={t('features.evidence.play.bundled')} testID="evidence-play-bundled" />
            <StatusChip size="sm" tone="warning" icon={null} label={t('features.evidence.play.excerpt')} testID="evidence-play-excerpt" />
          </>
        ) : null
      }
    >
      {media ? (
        <PlayerBody evidenceId={evidenceId} media={media} active={isOpen} {...rest} />
      ) : (
        <NoMediaBody recordedAt={rest.recordedAt} live={live} />
      )}
    </SheetFrame>
  );
}

interface PlayerBodyProps extends Omit<PlaySheetProps, 'isOpen' | 'onClose' | 'media'> {
  media: DemoMediaItem;
  active: boolean;
}

function PlayerBody({ evidenceId, media, durationMs, clipMs, active, initialCamera, initialMic }: PlayerBodyProps) {
  const { t } = useTranslation();
  const playback = useEvidencePlayback({ media, durationMs, clipMs, initialCamera, initialMic, active, evidenceId });
  // While the thumb is dragged the label follows it; the players seek on release.
  const [dragMs, setDragMs] = useState<number | null>(null);
  const shownMs = dragMs ?? playback.positionMs;

  // Opening the sheet from a track starts playback once (the operator asked to play).
  const { play } = playback;
  useEffect(() => {
    play();
  }, [play]);

  return (
    <View style={styles.body} testID="evidence-player">
      <Tabs
        value={playback.camera}
        onValueChange={(value) => {
          triggerHaptic('segmentSelect');
          playback.setCamera(value as VideoTrackId);
        }}
        variant="secondary"
      >
        <Tabs.List accessibilityLabel={t('features.evidence.play.camera')}>
          <Tabs.Indicator />
          {/* D60 (2026-11-04): four video tracks — the tabs name the tracks the bundled package actually carries. */}
          {VIDEO_TRACK_IDS.filter((track) => media.video[track] !== undefined).map((camera, index) => (
            <Tabs.Trigger key={camera} value={camera} testID={`evidence-play-camera-${index + 1}`}>
              <Tabs.Label>{t('features.evidence.play.cameraShort', { index: index + 1 })}</Tabs.Label>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>

      <View style={styles.video}>
        <VideoView
          testID="evidence-play-video"
          player={playback.videoPlayer}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
          surfaceType="textureView"
          accessible={false}
        />
      </View>

      <Slider
        value={shownMs}
        minValue={0}
        maxValue={Math.max(1, durationMs)}
        step={1000}
        onChange={(value) => setDragMs(Array.isArray(value) ? (value[0] ?? 0) : value)}
        onChangeEnd={(value) => {
          setDragMs(null);
          playback.seek(Array.isArray(value) ? (value[0] ?? 0) : value);
        }}
        accessibilityLabel={t('features.evidence.play.scrubber')}
        testID="evidence-play-scrubber"
      >
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>

      <View style={styles.transport}>
        <Button
          size="md"
          variant="tertiary"
          onPress={() => {
            triggerHaptic('primaryPress');
            playback.toggle();
          }}
          testID="evidence-play-toggle"
          accessibilityLabel={playback.playing ? t('features.evidence.play.pause') : t('features.evidence.play.play')}
        >
          {playback.playing ? <Pause size={18} color={palette.gold} /> : <Play size={18} color={palette.gold} />}
          <Button.Label>{playback.playing ? t('features.evidence.play.pause') : t('features.evidence.play.play')}</Button.Label>
        </Button>
        <Text maxFontSizeMultiplier={1.2} style={styles.time} testID="evidence-play-position">
          {t('features.evidence.play.position', { position: formatDuration(shownMs), total: formatDuration(durationMs) })}
        </Text>
      </View>

      <View style={styles.micBlock}>
        <Text maxFontSizeMultiplier={1.2} style={styles.label}>
          {t('features.evidence.play.audio')}
        </Text>
        <TagGroup
          selectionMode="single"
          selectedKeys={[playback.mic]}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next !== 'AUDIO-01' && next !== 'AUDIO-02') return;
            triggerHaptic('segmentSelect');
            playback.setMic(next);
          }}
          testID="evidence-play-mics"
        >
          <TagGroup.List style={styles.tags}>
            <TagGroup.Item id="AUDIO-01" testID="evidence-play-mic-1">
              {t('features.evidence.play.mic1')}
            </TagGroup.Item>
            <TagGroup.Item id="AUDIO-02" testID="evidence-play-mic-2">
              {t('features.evidence.play.mic2')}
            </TagGroup.Item>
          </TagGroup.List>
        </TagGroup>
        <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
          {t(`common.tracks.${playback.mic}`)} · {t('features.evidence.play.micHint')}
        </Text>
      </View>

      {playback.error ? (
        <Text maxFontSizeMultiplier={1.2} style={[styles.caption, styles.error]} testID="evidence-play-error">
          {t('features.evidence.play.error')}
        </Text>
      ) : null}
    </View>
  );
}

function NoMediaBody({ recordedAt, live }: { recordedAt: number; live: boolean }) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  if (live) {
    // Live: no stand-in picture for an item of the Core (G94-02). The state sentence only.
    return (
      <View style={styles.body} testID="evidence-player-no-media">
        <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
          {t('evidence.itemFacts.media.noneTitle')}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.body} testID="evidence-player-none">
      <CameraFeed cameraId="CAM-1" mode="playback" motion={policy} source={null} timestampBaseMs={recordedAt} />
      <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
        {t('features.evidence.play.noMedia')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[2], paddingBottom: spacing[3] },
  video: { aspectRatio: 16 / 9, borderRadius: radius.px.xl, overflow: 'hidden', backgroundColor: palette.black, borderWidth: 1, borderColor: derived.border },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  time: { fontFamily: fontFamily.native.mono, fontSize: 13, lineHeight: 18, color: palette.foreground, fontVariant: ['tabular-nums'] },
  micBlock: { gap: spacing[1] },
  tags: { flexDirection: 'row', gap: spacing[1] },
  label: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.size * typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: palette.gray,
  },
  caption: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  error: { color: statusText.danger },
});
