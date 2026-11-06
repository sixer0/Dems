/**
 * CameraFeed asset renderer (04_mobile_specs §8.3, §7.4 M-C-12; 03_motion_spec M-C-12; D50 video
 * path added by step 72, superseding D31 and S71-5).
 *
 * Two renderers behind one API:
 *
 * 1. **Video** (D50): an expo-video `VideoView` (muted, looped, no controls, TextureView so the
 *    rounded clip applies) plays `source`. In `live` mode the default source is the camera's live
 *    loop from the bundled demo media (`demo-media.ts`, session 0024). Those loops carry no clock
 *    and no REC (DR-92-7), so a transparent Skia overlay burns in the UTC+07:00 time and the camera
 *    label at 1 Hz; REC stays the screen's chip. Evidence clips (`playback`) carry their own OSD,
 *    so the overlay shows nothing by default. `paused` or no signal pauses the player. The video
 *    keeps playing under reduced motion: it is the monitored content, like the meters.
 * 2. **Procedural** (step 71; the fallback): a Skia canvas in a 16:9 virtual space with the room
 *    still (the W-05 photo by default; `image={null}` draws the placeholder room), in-canvas Ken
 *    Burns (1.00 → 1.06 over 30 s, Cam 2 mirrored and 11 s out of phase), film grain re-seeded at
 *    25 fps, a scanline sweep every 6 s and the burnt-in timestamp. All per-frame work is a
 *    UI-thread frame callback feeding Skia props; React never re-renders per frame. Reduced
 *    motion: no Ken Burns, no scanline, frozen grain; the timestamp ticks at 1 Hz from JS.
 *
 * The procedural renderer is used when there is no video (`source={null}`, `poster` mode, or
 * `playback` without a clip) and whenever the player reports an error. The error is logged
 * (`media.cameraFeed.video`) and the feed switches without a blank frame.
 */
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import {
  BlurMask,
  Canvas,
  Circle,
  FractalNoise,
  Group,
  Image as SkiaImage,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  Text as SkiaText,
  useFont,
  useImage,
  vec,
  type DataSourceParam,
  type SkSize,
} from '@shopify/react-native-skia';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Typography } from 'heroui-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { derived, motion as motionTokens, palette } from '@dems/shared/tokens';
import { reportMotionIssue } from '@/motion/log';
import { HERO_STILL } from './brand-assets';
import { mixHex, withAlpha } from './color';
import { liveLoopFor } from './demo-media';
import {
  CAMERA_SWITCH_MS,
  FEED_H,
  FEED_W,
  FIRST_PAINT_MS,
  GRAIN_FPS,
  GRAIN_OPACITY,
  NO_SIGNAL_MS,
  SCANLINE_BAND,
  cameraFraming,
  coverScale,
  formatFeedTimestamp,
  grainSeed,
  kenBurnsScale,
  scanlineY,
} from './camera-feed.math';

/** A clip for the video renderer: a bundled asset (`require`, see `demo-media.ts`) or a URI. */
export type CameraFeedVideoSource = number | { uri: string };

export interface CameraFeedProps {
  /** `CAM-1` or `CAM-2` (Cam 2 is the mirrored reverse angle). */
  cameraId: string;
  mode?: 'live' | 'poster' | 'playback';
  /** Motion policy from `useMotionPolicy()` (04 §7.7). */
  motion: 'full' | 'reduced';
  /** Stops the clock (screen unfocused, app backgrounded, canvas off-screen; 04 §7.8). */
  paused?: boolean;
  /**
   * Clip for the video renderer (muted, looped). Default: the camera's live loop in `live` mode,
   * none otherwise. `null` forces the procedural renderer.
   */
  source?: CameraFeedVideoSource | null;
  /**
   * Still for the procedural renderer and `poster` mode (a poster from `demo-media.ts`, for
   * example). Default: the W-05 room still; `null` draws the placeholder room.
   */
  image?: DataSourceParam | null;
  noSignal?: boolean;
  /** Burnt-in label, e.g. `CAM 1`. */
  cameraLabel?: string;
  /** `playback`: epoch ms of the recording start; `poster`: the frozen timestamp. */
  timestampBaseMs?: number;
  /** Default: on, except in `poster` mode and over a clip with its own OSD (`playback` video). */
  showTimestamp?: boolean;
  /** Burnt-in camera label (top right). Default: on, except over a clip with its own OSD. */
  showLabel?: boolean;
  /** 25 fps by default; 12.5 is the H-S18 fallback for heavy screens. */
  grainFps?: number;
  labels?: { noSignal?: string };
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const LUXE = Easing.bezier(...motionTokens.easing.luxe);

/** Token-derived room palette (no colour literals, MA-22). */
const ROOM = {
  ceiling: mixHex(derived.surface, palette.black, 0.35),
  wallTop: mixHex(derived.surfaceTertiary, palette.gray, 0.3),
  wallBottom: mixHex(derived.surfaceTertiary, palette.gray, 0.12),
  door: mixHex(derived.surface, palette.black, 0.4),
  floorTop: mixHex(derived.surfaceSecondary, palette.gray, 0.2),
  floorBottom: mixHex(derived.surfaceSecondary, palette.black, 0.45),
  tableLight: mixHex(palette.bronze, palette.black, 0.42),
  table: mixHex(palette.bronze, palette.black, 0.6),
  tableEdge: mixHex(palette.bronze, palette.black, 0.8),
  chair: mixHex(palette.black, palette.charcoal, 0.55),
  metal: mixHex(palette.charcoal, palette.gray, 0.35),
  light: palette.foreground,
  lightWarm: mixHex(palette.foreground, palette.gold, 0.25),
};

const PANEL_LINES = Array.from({ length: 7 }, (_, i) => `M${40 * (i + 1)} 22L${40 * (i + 1)} 120`).join('');
const FLOOR_LINES = [-80, 0, 80, 160, 240, 320, 400]
  .map((x) => `M${x} 180L${(160 + ((x - 160) * (122 - 60)) / (180 - 60)).toFixed(1)} 122`)
  .join('');

export function CameraFeed({
  cameraId,
  mode = 'live',
  motion,
  paused = false,
  source,
  image = HERO_STILL,
  noSignal = false,
  cameraLabel,
  timestampBaseMs,
  showTimestamp,
  showLabel,
  grainFps = GRAIN_FPS,
  labels,
  style,
  testID,
  accessibilityLabel,
}: CameraFeedProps) {
  const reduced = motion === 'reduced';
  const framing = cameraFraming(cameraId);
  const [firstCameraId] = useState(cameraId);
  const label = cameraLabel ?? `CAM ${framing.index}`;
  const clip = mode === 'poster' ? null : source === undefined ? (mode === 'live' ? liveLoopFor(framing.index) : null) : source;
  const clipKey = clipIdentity(clip);
  // The failed clip is remembered by identity, so a new source gets a fresh attempt.
  const [failedClip, setFailedClip] = useState<string | null>(null);
  const video = clip !== null && clipKey !== failedClip ? clip : null;
  const ownOsd = video !== null && mode === 'playback';
  const stampVisible = showTimestamp ?? (mode !== 'poster' && !ownOsd);
  const labelVisible = showLabel ?? !ownOsd;

  const onVideoError = (message: string) => {
    reportMotionIssue('warn', 'media.cameraFeed.video', new Error(message), { cameraId, mode, fallback: 'procedural' });
    setFailedClip(clipKey);
  };

  return (
    <View
      testID={testID}
      style={[{ aspectRatio: 16 / 9, overflow: 'hidden', borderRadius: 12, backgroundColor: palette.black }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? `${label} feed${noSignal ? ', no signal' : ''}`}
    >
      {/* Keyed by camera: switching cross-fades (320 ms); the very first paint fades in over 600 ms. */}
      <Animated.View
        key={cameraId}
        style={StyleSheet.absoluteFill}
        entering={reduced ? undefined : FadeIn.duration(cameraId === firstCameraId ? FIRST_PAINT_MS : CAMERA_SWITCH_MS).easing(LUXE)}
        exiting={reduced ? undefined : FadeOut.duration(CAMERA_SWITCH_MS)}
      >
        {video !== null ? (
          <FeedVideo
            key={clipKey}
            source={video}
            playing={!paused && !noSignal}
            onError={onVideoError}
            testID={testID ? `${testID}-video` : undefined}
          />
        ) : null}
        <FeedCanvas
          framing={framing}
          mode={mode}
          underlay={video !== null ? 'video' : 'still'}
          reduced={reduced}
          paused={paused}
          image={image}
          noSignal={noSignal}
          label={label}
          labelVisible={labelVisible}
          timestampBaseMs={timestampBaseMs}
          stampVisible={stampVisible}
          grainFps={grainFps}
        />
      </Animated.View>
      {noSignal ? (
        <Animated.View
          pointerEvents="none"
          entering={reduced ? undefined : FadeIn.duration(NO_SIGNAL_MS)}
          style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
        >
          <Typography type="body-sm" weight="semibold" color="muted">
            {labels?.noSignal ?? 'NO SIGNAL'}
          </Typography>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Stable identity of a clip (asset id or URI) for keying and failure memory. */
function clipIdentity(clip: CameraFeedVideoSource | null): string | null {
  if (clip === null) return null;
  return typeof clip === 'number' ? `asset:${clip}` : `uri:${clip.uri}`;
}

interface FeedVideoProps {
  source: CameraFeedVideoSource;
  playing: boolean;
  onError: (message: string) => void;
  testID?: string;
}

/** The expo-video layer: muted, looped, no controls; reports a player error once. */
function FeedVideo({ source, playing, onError, testID }: FeedVideoProps) {
  const player = useVideoPlayer(source, (p) => {
    p.muted = true;
    p.loop = true;
  });

  useEffect(() => {
    if (player.status === 'error') {
      onError('player error before subscription');
      return;
    }
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') onError(error?.message ?? 'player error');
    });
    return () => sub.remove();
  }, [player, onError]);

  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);

  return (
    <VideoView
      testID={testID}
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
      surfaceType="textureView"
      accessible={false}
    />
  );
}

interface FeedCanvasProps {
  framing: ReturnType<typeof cameraFraming>;
  mode: 'live' | 'poster' | 'playback';
  /** `video`: a transparent overlay over the clip (no picture, grade, grain or scanline). */
  underlay: 'still' | 'video';
  reduced: boolean;
  paused: boolean;
  image: DataSourceParam | null;
  noSignal: boolean;
  label: string;
  labelVisible: boolean;
  timestampBaseMs?: number;
  stampVisible: boolean;
  grainFps: number;
}

function FeedCanvas({
  framing,
  mode,
  underlay,
  reduced,
  paused,
  image,
  noSignal,
  label,
  labelVisible,
  timestampBaseMs,
  stampVisible,
  grainFps,
}: FeedCanvasProps) {
  const size = useSharedValue<SkSize>({ width: 0, height: 0 });
  const clock = useSharedValue(0);
  const stamp = useSharedValue(timestampBaseMs !== undefined ? formatFeedTimestamp(timestampBaseMs) : '');
  const lastSecond = useSharedValue(-1);
  const noSignalMix = useSharedValue(noSignal ? 1 : 0);
  const overVideo = underlay === 'video';
  // Over a clip, the canvas only burns in text, so it needs no per-frame loop (1 Hz from JS).
  const animated = mode !== 'poster' && !reduced && !overVideo;
  const ticking = mode !== 'poster' && !paused;
  // Playback timestamps count from the recording start; live ones read the wall clock.
  const offsetMs = mode === 'playback' && timestampBaseMs !== undefined ? timestampBaseMs : null;

  const frames = useFrameCallback((frame) => {
    'worklet';
    const now = Date.now();
    clock.set(now);
    const epoch = offsetMs === null ? now : offsetMs + frame.timeSinceFirstFrame;
    const second = Math.floor(epoch / 1000);
    if (second !== lastSecond.get()) {
      lastSecond.set(second);
      stamp.set(formatFeedTimestamp(epoch));
    }
  }, false);

  // The hook unregisters the callback on unmount; this only toggles it.
  useEffect(() => {
    frames.setActive(animated && ticking);
  }, [frames, animated, ticking]);

  // Reduced motion keeps the timestamp alive at 1 Hz without a per-frame UI loop (D43 idle-friendly).
  useEffect(() => {
    if (animated || !ticking) return;
    const startedAt = Date.now();
    const tick = () => {
      const epoch = offsetMs === null ? Date.now() : offsetMs + (Date.now() - startedAt);
      stamp.set(formatFeedTimestamp(epoch));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [animated, ticking, offsetMs, stamp]);

  useEffect(() => {
    const target = noSignal ? 1 : 0;
    noSignalMix.set(reduced ? target : withTiming(target, { duration: NO_SIGNAL_MS, easing: LUXE }));
  }, [noSignal, reduced, noSignalMix]);

  const fit = useDerivedValue(() => {
    const { width, height } = size.get();
    const s = coverScale(width, height);
    return [{ translateX: (width - FEED_W * s) / 2 }, { translateY: (height - FEED_H * s) / 2 }, { scale: s }];
  });
  const kenBurns = useDerivedValue(() => [{ scale: animated ? kenBurnsScale(clock.get(), framing.phaseMs) : 1 }]);
  const seed = useDerivedValue(() => (animated ? grainSeed(clock.get(), grainFps) : 7));
  const scan = useDerivedValue(() => [{ translateY: animated ? scanlineY(clock.get()) : -SCANLINE_BAND * 2 }]);
  const baseGrain = overVideo ? 0 : GRAIN_OPACITY;
  const noiseOpacity = useDerivedValue(() => baseGrain + 0.33 * noSignalMix.get());
  const greyOpacity = useDerivedValue(() => 0.82 * noSignalMix.get());

  const img = useImage(overVideo ? null : image);
  const font = useFont(JetBrainsMono_500Medium, 7);
  const labelWidth = font ? font.measureText(label).width : 0;
  const mirror = framing.mirror ? [{ scaleX: -1 }] : undefined;

  // onLayout instead of Skia's `onSize`, which measures every frame even when idle (step 71).
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    size.set({ width, height });
  };

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={fit}>
          <Group clip={{ x: 0, y: 0, width: FEED_W, height: FEED_H }}>
            {overVideo ? null : (
              <>
                <Group transform={kenBurns} origin={vec(framing.focalX * FEED_W, framing.focalY * FEED_H)}>
                  <Group transform={mirror} origin={vec(FEED_W / 2, FEED_H / 2)}>
                    {img ? <SkiaImage image={img} x={0} y={0} width={FEED_W} height={FEED_H} fit="cover" /> : <RoomScene />}
                  </Group>
                </Group>
                {/* Warm grade and vignette (04 §8.2 grade on the still; the clips carry their own). */}
                <Rect x={0} y={0} width={FEED_W} height={FEED_H} color={withAlpha(palette.bronze, 0.05)} />
                <Rect x={0} y={0} width={FEED_W} height={FEED_H}>
                  <RadialGradient
                    c={vec(FEED_W / 2, FEED_H / 2)}
                    r={190}
                    colors={[withAlpha(palette.black, 0), withAlpha(palette.black, 0.62)]}
                    positions={[0.5, 1]}
                  />
                </Rect>
              </>
            )}
            {/* No signal: the picture fades to grey noise (400 ms). */}
            <Rect x={0} y={0} width={FEED_W} height={FEED_H} color={derived.surfaceTertiary} opacity={greyOpacity} />
            <Rect x={0} y={0} width={FEED_W} height={FEED_H} opacity={noiseOpacity} blendMode="overlay">
              <FractalNoise freqX={1.4} freqY={1.4} octaves={2} seed={seed} />
            </Rect>
            {overVideo ? null : (
              <Group transform={scan}>
                <Rect x={0} y={0} width={FEED_W} height={SCANLINE_BAND}>
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(0, SCANLINE_BAND)}
                    colors={[withAlpha(ROOM.light, 0), withAlpha(ROOM.light, 0.08), withAlpha(ROOM.light, 0)]}
                  />
                </Rect>
              </Group>
            )}
            {stampVisible ? (
              <>
                <SkiaText x={7} y={13} text={stamp} font={font} color={withAlpha(palette.black, 0.6)} />
                <SkiaText x={6.5} y={12.5} text={stamp} font={font} color={withAlpha(ROOM.light, 0.88)} />
              </>
            ) : null}
            {labelVisible ? (
              <>
                <SkiaText x={FEED_W - 6.5 - labelWidth} y={13} text={label} font={font} color={withAlpha(palette.black, 0.6)} />
                <SkiaText x={FEED_W - 7 - labelWidth} y={12.5} text={label} font={font} color={withAlpha(ROOM.light, 0.88)} />
              </>
            ) : null}
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}

/** Procedural placeholder: an empty interview room in the demo's warm palette (no people, no insignia). */
function RoomScene() {
  return (
    <Group>
      <Rect x={0} y={0} width={FEED_W} height={122}>
        <LinearGradient start={vec(0, 0)} end={vec(0, 122)} colors={[ROOM.wallTop, ROOM.wallBottom]} />
      </Rect>
      <Rect x={0} y={0} width={FEED_W} height={22} color={ROOM.ceiling} />
      {/* Ceiling panels sit between the burnt-in timestamp (top left) and the camera label (top right). */}
      {[100, 172].map((x) => (
        <Group key={x}>
          <Rect x={x - 34} y={22} width={124} height={100}>
            <RadialGradient c={vec(x + 28, 22)} r={96} colors={[withAlpha(ROOM.lightWarm, 0.2), withAlpha(ROOM.lightWarm, 0)]} />
          </Rect>
          <RoundedRect x={x} y={8} width={56} height={5} r={1.5} color={ROOM.lightWarm}>
            <BlurMask blur={5} style="solid" />
          </RoundedRect>
          <RoundedRect x={x} y={8} width={56} height={5} r={1.5} color={ROOM.light} />
        </Group>
      ))}
      <Path path={PANEL_LINES} style="stroke" strokeWidth={0.6} color={withAlpha(palette.black, 0.16)} />
      <Rect x={250} y={46} width={34} height={76} color={ROOM.door} />
      <Rect x={277} y={84} width={3} height={1.4} color={withAlpha(ROOM.light, 0.35)} />
      <Rect x={0} y={120} width={FEED_W} height={2} color={withAlpha(palette.black, 0.35)} />
      <Rect x={0} y={122} width={FEED_W} height={58}>
        <LinearGradient start={vec(0, 122)} end={vec(0, 180)} colors={[ROOM.floorTop, ROOM.floorBottom]} />
      </Rect>
      <Path path={FLOOR_LINES} style="stroke" strokeWidth={0.5} color={withAlpha(palette.black, 0.16)} />
      <RoundedRect x={148} y={92} width={24} height={30} r={4} color={ROOM.chair} />
      <RoundedRect x={58} y={98} width={22} height={36} r={4} color={ROOM.chair} />
      <RoundedRect x={240} y={98} width={22} height={36} r={4} color={ROOM.chair} />
      <Path path="M92 118L228 118L252 142L68 142Z">
        <LinearGradient start={vec(80, 118)} end={vec(240, 146)} colors={[ROOM.tableLight, ROOM.table]} />
      </Path>
      <Path path="M68 142L252 142L252 147L68 147Z" color={ROOM.tableEdge} />
      <Rect x={84} y={147} width={3} height={18} color={ROOM.tableEdge} />
      <Rect x={233} y={147} width={3} height={18} color={ROOM.tableEdge} />
      <Line p1={vec(160, 128)} p2={vec(160, 120)} color={ROOM.metal} strokeWidth={0.8} />
      <Circle cx={160} cy={119} r={1.6} color={ROOM.metal} />
      <RoundedRect x={96} y={152} width={30} height={40} r={5} color={withAlpha(palette.black, 0.85)} />
      <RoundedRect x={194} y={152} width={30} height={40} r={5} color={withAlpha(palette.black, 0.85)} />
    </Group>
  );
}
