/**
 * S3 live feed (04_mobile_specs §4.5, §7.3 M-PG-SM, §7.4 M-C-12, M-C-18, M-C-20; D50, D68).
 *
 * - The picture is `CameraFeed` in `live` mode: it plays the camera's live loop from the step-72
 *   media subset (session 0024, `RECORDING_SCENARIO.sessionSeq`) and burns in the UTC+07:00 time
 *   (top left) and "CAM n" (top right); if the player fails it falls back to the procedural
 *   renderer by itself. REC and the timer are this screen's kit Chip (DR-92-7, step 72 relay R-1).
 * - The frame glow breathes e2 ↔ e3 (GlowLayer, one ambient loop, 03M M-C-05 "video-frame glow").
 * - Overlay chips at the bottom: "CAM 1 - Interview Room 1", "1080p • 25 fps" (MB 4), and on the
 *   right the snapshot counter and the REC chip.
 * - Camera switch: tap the feed on phones; kit `Tabs variant="secondary"` on tablets.
 * - Snapshot (M-C-18): one white shutter flash 0 → 0.85 → 0 in 180 ms, a thumbnail that flies
 *   into the counter chip, whose badge pops (`bouncy`). Reduced: a gold border highlight only.
 * - Pause monitoring (M-C-20, UI-only): the player pauses and a scrim says recording continues.
 * - NO SIGNAL (S8): a lost camera shows CameraFeed's NO SIGNAL fade.
 */
import { Chip, Tabs } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { VideoTrackId } from '@dems/shared/domain';
import type { CameraStatus } from '@dems/shared/sim';
import { derived, fontFamily, motion as motionTokens, palette, radius, typography } from '@dems/shared/tokens';
import { CameraFeed } from '@/components/media';
import { withAlpha } from '@/components/media/color';
import { GlowLayer, triggerHaptic, useMotionSettings } from '@/motion';
import { RecTimer } from './rec-indicator';
import { SHUTTER_MS, SHUTTER_PEAK, cameraIndexOf, otherCameraId } from './session-live.math';

const RADIUS = radius.px.xl;

export interface LiveFeedProps {
  activeCameraId: VideoTrackId;
  cameras: readonly CameraStatus[];
  /** The screen is unfocused or backgrounded (04 §7.8): the player and loops stop. */
  paused: boolean;
  /** Settings → Pause monitoring (UI-only, D28/Q8). */
  monitoringPaused: boolean;
  /** Tablets: kit Tabs under the feed. Phones: tap the feed. */
  cameraTabs: boolean;
  onSwitchCamera: (cameraId: VideoTrackId) => void;
  /** Increments once per captured snapshot (drives M-C-18). */
  snapshotSignal: number;
  snapshotCount: number;
  style?: StyleProp<ViewStyle>;
}

export function LiveFeed({
  activeCameraId,
  cameras,
  paused,
  monitoringPaused,
  cameraTabs,
  onSwitchCamera,
  snapshotSignal,
  snapshotCount,
  style,
}: LiveFeedProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const reduced = settings.policy === 'reduced';
  const camera = cameras.find((c) => c.id === activeCameraId) ?? cameras[0];
  const index = cameraIndexOf(activeCameraId);
  const short = t('features.session-live.feed.cameraShort', { index });
  const room = camera?.room ?? '';
  const noSignal = camera ? !camera.online : false;
  const cameraIds = cameras.map((c) => c.id);

  // --- M-C-18 snapshot: shutter, thumbnail flight, counter pop (never on mount) ---------------
  const shutter = useSharedValue(0);
  const highlight = useSharedValue(0);
  const flight = useSharedValue(1);
  const pop = useSharedValue(1);
  const size = useSharedValue({ width: 0, height: 0 });
  const lastSignal = useRef(snapshotSignal);
  useEffect(() => {
    if (lastSignal.current === snapshotSignal) return;
    lastSignal.current = snapshotSignal;
    if (reduced) {
      highlight.set(withSequence(withTiming(1, { duration: 0 }), withTiming(0, { duration: motionTokens.duration.slower })));
      return;
    }
    shutter.set(
      withSequence(
        withTiming(SHUTTER_PEAK, { duration: SHUTTER_MS / 2, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: SHUTTER_MS / 2, easing: Easing.in(Easing.quad) }),
      ),
    );
    flight.set(0);
    flight.set(withSpring(1, motionTokens.spring.gentle));
    pop.set(withSequence(withTiming(1.25, { duration: 0 }), withSpring(1, motionTokens.spring.bouncy)));
  }, [snapshotSignal, reduced, shutter, highlight, flight, pop]);

  const shutterStyle = useAnimatedStyle(() => ({ opacity: shutter.get() }));
  const highlightStyle = useAnimatedStyle(() => ({ opacity: highlight.get() }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
  // The thumbnail starts as the whole frame and lands on the counter chip (bottom right).
  const flightStyle = useAnimatedStyle(() => {
    const p = flight.get();
    const { width, height } = size.get();
    const endW = 44;
    const endH = 25;
    return {
      opacity: p >= 1 || width === 0 ? 0 : interpolate(p, [0, 0.8, 1], [0.95, 0.9, 0]),
      width: interpolate(p, [0, 1], [width, endW]),
      height: interpolate(p, [0, 1], [height, endH]),
      left: interpolate(p, [0, 1], [0, Math.max(width - endW - 110, 0)]),
      top: interpolate(p, [0, 1], [0, Math.max(height - endH - 10, 0)]),
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    size.set({ width, height });
  };

  const feed = (
    <CameraFeed
      cameraId={activeCameraId}
      mode="live"
      motion={settings.policy}
      paused={paused || monitoringPaused}
      noSignal={noSignal}
      cameraLabel={short}
      labels={{ noSignal: t('session.feed.noSignal') }}
      testID="monitor-camera-feed"
      accessibilityLabel={t('features.session-live.feed.a11y', { camera: short, room })}
      style={styles.feed}
    />
  );

  return (
    <View style={style}>
      <View testID="monitor-feed" style={styles.frame} onLayout={onLayout}>
        <GlowLayer level={2} breathe paused={paused || monitoringPaused} radius={RADIUS} testID="monitor-feed-glow" />
        <View style={styles.clip}>
          {cameraTabs ? (
            feed
          ) : (
            <Pressable
              testID="monitor-feed-switch"
              accessibilityRole="button"
              accessibilityLabel={t('features.session-live.feed.switchTo', {
                camera: t('features.session-live.feed.cameraShort', { index: cameraIndexOf(otherCameraId(activeCameraId, cameraIds)) }),
              })}
              accessibilityHint={t('features.session-live.feed.switchHint')}
              onPress={() => {
                const next = otherCameraId(activeCameraId, cameraIds) as VideoTrackId;
                if (next !== activeCameraId) {
                  triggerHaptic('segmentSelect');
                  onSwitchCamera(next);
                }
              }}
            >
              {feed}
            </Pressable>
          )}
          {monitoringPaused ? (
            <View testID="monitor-feed-paused" pointerEvents="none" style={styles.pausedScrim}>
              <Text maxFontSizeMultiplier={1.2} style={styles.pausedText}>
                {t('session.feed.monitoringPaused')}
              </Text>
            </View>
          ) : null}
          <Animated.View pointerEvents="none" style={[styles.shutter, shutterStyle]} />
          <Animated.View pointerEvents="none" style={[styles.flight, flightStyle]} />
          <View pointerEvents="box-none" style={styles.overlay}>
            <View style={styles.overlayLeft}>
              <Chip size="sm" variant="secondary" style={styles.darkChip} testID="monitor-feed-camera-chip">
                <Chip.Label numberOfLines={1} style={styles.chipText}>
                  {t('session.feed.cameraLabel', { camera: short, room })}
                </Chip.Label>
              </Chip>
              {camera ? (
                <Chip size="sm" variant="secondary" style={styles.darkChip}>
                  <Chip.Label style={styles.chipMono}>
                    {t('common.devices.cameraFormat', { resolution: camera.resolution, fps: camera.fps })}
                  </Chip.Label>
                </Chip>
              ) : null}
            </View>
            <View style={styles.overlayRight}>
              {snapshotCount > 0 ? (
                <Animated.View style={popStyle}>
                  <Chip size="sm" variant="secondary" style={styles.darkChip} testID="monitor-snapshot-count">
                    <Chip.Label style={styles.chipMono}>
                      {t('features.session-live.feed.snapshots', { count: snapshotCount })}
                    </Chip.Label>
                  </Chip>
                </Animated.View>
              ) : null}
              <Chip size="sm" variant="secondary" style={[styles.darkChip, styles.recChip]} testID="monitor-feed-rec">
                <View style={styles.recDot} />
                <Chip.Label style={styles.recLabel}>{t('session.feed.rec')}</Chip.Label>
                <RecTimer size="data" />
              </Chip>
            </View>
          </View>
          <Animated.View pointerEvents="none" style={[styles.highlight, highlightStyle]} />
        </View>
      </View>
      {cameraTabs && cameras.length > 1 ? (
        <Tabs
          value={activeCameraId}
          onValueChange={(value) => {
            if (value !== activeCameraId) {
              triggerHaptic('segmentSelect');
              onSwitchCamera(value as VideoTrackId);
            }
          }}
          variant="secondary"
          style={styles.tabs}
        >
          <Tabs.List accessibilityLabel={t('features.session-live.feed.cameraTabs')}>
            <Tabs.Indicator />
            {cameras.map((c) => (
              <Tabs.Trigger key={c.id} value={c.id} testID={`monitor-camera-tab-${cameraIndexOf(c.id)}`}>
                <Tabs.Label>{t('features.session-live.feed.cameraShort', { index: cameraIndexOf(c.id) })}</Tabs.Label>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: RADIUS },
  clip: { borderRadius: RADIUS, overflow: 'hidden', borderWidth: 1, borderColor: derived.border, backgroundColor: palette.black },
  feed: { borderRadius: 0 },
  // Raised above the clip's own burnt-in OSD line ("CAM-01 | VIDEO-01 | LIVE | DEMO", step 92).
  overlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: '12%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  overlayLeft: { flexShrink: 1, maxWidth: '62%', gap: 4, alignItems: 'flex-start' },
  overlayRight: { gap: 4, alignItems: 'flex-end' },
  darkChip: { backgroundColor: withAlpha(palette.black, 0.62), borderColor: withAlpha(palette.foreground, 0.12) },
  chipText: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.foreground,
  },
  chipMono: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: derived.foreground2,
  },
  recChip: { gap: 6 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.danger },
  recLabel: {
    fontFamily: fontFamily.native.bold,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.foreground,
  },
  pausedScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(palette.black, 0.6),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  pausedText: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
    textAlign: 'center',
  },
  shutter: { ...StyleSheet.absoluteFill, backgroundColor: palette.foreground },
  flight: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: palette.foreground,
    borderRadius: 4,
    backgroundColor: withAlpha(palette.foreground, 0.18),
  },
  highlight: { ...StyleSheet.absoluteFill, borderRadius: RADIUS, borderWidth: 2, borderColor: palette.gold },
  tabs: { marginTop: 8 },
});
