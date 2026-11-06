// CameraFeed video path (step 72, D50): expo-video plays the bundled clip, a transparent overlay
// burns in the time and label, and the step-71 procedural renderer takes over when there is no clip
// or when the player fails. expo-video is mocked in jest.setup.ts (D58).
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { setMotionLogSink, type MotionLogRecord } from '@/motion/log';
import { CameraFeed } from './camera-feed';
import { DEMO_MEDIA_EVIDENCE, liveLoopFor } from './demo-media';
import { resetSkiaCalls, skiaCalls } from './testing/skia-mock';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('./testing/skia-mock')>('./testing/skia-mock').createSkiaMock(),
);

interface MockPlayer {
  source: unknown;
  muted: boolean;
  loop: boolean;
  playing: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  emit: (event: string, payload: { status?: string; error?: { message: string } }) => void;
}

const wrap = (node: ReactNode) => <HeroUINativeProvider>{node}</HeroUINativeProvider>;
const skia = () => jest.requireMock('@shopify/react-native-skia');
const playerOf = (testID: string) => screen.getByTestId(testID).props.player as MockPlayer;
/** The procedural renderer draws the vignette; the overlay over a clip never does. */
const proceduralPainted = () => skiaCalls(skia(), 'RadialGradient').length > 0;
const texts = () => skiaCalls(skia(), 'Text');

describe('CameraFeed video renderer', () => {
  let logs: MotionLogRecord[];

  // Reanimated prepares its UI-side frame-callback registry through the worklets mock's
  // requestAnimationFrame when the module loads, on real timers. Let it run before the first test
  // switches to fake timers, or the first registration finds no registry.
  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  beforeEach(() => {
    jest.useFakeTimers();
    resetSkiaCalls(skia());
    logs = [];
    setMotionLogSink((record) => logs.push(record));
  });
  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    setMotionLogSink(null);
  });

  it('plays the camera live loop by default: muted, looped, with the time and label overlaid', () => {
    render(wrap(<CameraFeed cameraId="CAM-1" motion="full" testID="feed" />));
    const player = playerOf('feed-video');
    expect(player.source).toBe(liveLoopFor(1));
    expect(player.muted).toBe(true);
    expect(player.loop).toBe(true);
    expect(player.play).toHaveBeenCalled();
    expect(screen.getByTestId('feed-video').props).toMatchObject({
      contentFit: 'cover',
      nativeControls: false,
      surfaceType: 'textureView',
    });
    // Overlay only: no still, no grade, no scanline; the live loop has no clock, so the time is burnt in.
    expect(proceduralPainted()).toBe(false);
    expect(skiaCalls(skia(), 'Image')).toHaveLength(0);
    const stamp = texts().find((p) => typeof p.text === 'object')?.text as SharedValue<string>;
    expect(stamp.value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(texts().some((p) => p.text === 'CAM 1')).toBe(true);
  });

  it('keeps the video under reduced motion and pauses it when paused or without signal', () => {
    const { rerender } = render(wrap(<CameraFeed cameraId="CAM-2" motion="reduced" testID="feed" />));
    const player = playerOf('feed-video');
    expect(player.playing).toBe(true);
    rerender(wrap(<CameraFeed cameraId="CAM-2" motion="reduced" paused testID="feed" />));
    expect(player.playing).toBe(false);
    rerender(wrap(<CameraFeed cameraId="CAM-2" motion="reduced" testID="feed" />));
    expect(player.playing).toBe(true);
    rerender(wrap(<CameraFeed cameraId="CAM-2" motion="reduced" noSignal testID="feed" />));
    expect(player.playing).toBe(false);
    expect(screen.getByText('NO SIGNAL')).toBeTruthy();
  });

  it('falls back to the procedural renderer when the player fails, and logs it once', () => {
    render(wrap(<CameraFeed cameraId="CAM-1" motion="full" testID="feed" />));
    expect(proceduralPainted()).toBe(false);
    const player = playerOf('feed-video');
    act(() => {
      player.emit('statusChange', { status: 'error', error: { message: 'decoder unavailable' } });
    });
    expect(screen.queryByTestId('feed-video')).toBeNull();
    expect(proceduralPainted()).toBe(true);
    expect(screen.getByLabelText('CAM 1 feed')).toBeTruthy();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: 'warn',
      source: 'media.cameraFeed.video',
      message: 'decoder unavailable',
      context: { cameraId: 'CAM-1', mode: 'live', fallback: 'procedural' },
    });
  });

  it('uses the procedural renderer when told to (source null) and in poster mode', () => {
    render(
      wrap(
        <>
          <CameraFeed cameraId="CAM-1" motion="full" source={null} testID="still" />
          <CameraFeed
            cameraId="CAM-2"
            mode="poster"
            motion="full"
            source={DEMO_MEDIA_EVIDENCE['0001'].video['VIDEO-02']}
            image={DEMO_MEDIA_EVIDENCE['0001'].poster['VIDEO-02']}
            testID="poster"
          />
        </>,
      ),
    );
    expect(screen.queryByTestId('still-video')).toBeNull();
    expect(screen.queryByTestId('poster-video')).toBeNull();
    expect(proceduralPainted()).toBe(true);
  });

  it('plays an evidence clip in playback mode without overlaying its burnt-in OSD', () => {
    const clip = DEMO_MEDIA_EVIDENCE['0007'].video['VIDEO-01'];
    render(wrap(<CameraFeed cameraId="CAM-1" mode="playback" motion="full" source={clip} testID="play" />));
    expect(playerOf('play-video').source).toBe(clip);
    expect(texts()).toHaveLength(0);
  });
});
