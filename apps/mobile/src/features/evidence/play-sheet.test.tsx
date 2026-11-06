/**
 * Play sheet (04_mobile_specs §4.11 D6; D50, D68; step 83): three expo-video players over the
 * bundled subset (the camera clip in a view, MIC 1 and MIC 2 as audio-only players with no view),
 * one MIC audible at a time, the scrubber over the recorded duration with the excerpt rule
 * (p mod clip length), the camera switch, and pause on close. The on-device proof that expo-video
 * plays the audio-only m4a files is in implementation/55_mobile_evidence.md (D68).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as ExpoVideo from 'expo-video';
import { getDemoEvidencePackage } from '@dems/shared/demo-data';
import { DEMO_MEDIA_EVIDENCE } from '@/components/media/demo-media';
import { resetMotionStateForTests } from '@/motion';
import { renderEvidenceApp, settle } from './testing/evidence-harness';

interface MockPlayer {
  source: unknown;
  muted: boolean;
  loop: boolean;
  playing: boolean;
  currentTime: number;
  play: jest.Mock;
  pause: jest.Mock;
  replaceAsync: jest.Mock;
}

/**
 * The players in creation order: the playback hook creates the camera clip, then MIC 1, then MIC 2.
 * (Jest resolves every `.m4a` require to the same stub value, 1, so the two MIC sources cannot be
 * told apart by value; the hook's call order and the arguments it passed can.)
 */
function createdPlayers(spy: jest.SpiedFunction<typeof ExpoVideo.useVideoPlayer>): MockPlayer[] {
  const seen = new Set<unknown>();
  const out: MockPlayer[] = [];
  for (const result of spy.mock.results) {
    const player = result.value as MockPlayer;
    if (!seen.has(player)) {
      seen.add(player);
      out.push(player);
    }
  }
  return out;
}

async function openPlayer(suffix: string) {
  const h = renderEvidenceApp({ window: 'phonePortrait' });
  await settle();
  const id = h.idOf(suffix);
  h.navigate(`/evidence/${id}`);
  await settle();
  fireEvent.press(screen.getByTestId('evidence-action-play'));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  return { h, id };
}

describe('Play sheet', () => {
  let spy: jest.SpiedFunction<typeof ExpoVideo.useVideoPlayer>;
  beforeEach(() => {
    spy = jest.spyOn(ExpoVideo, 'useVideoPlayer');
  });
  afterEach(() => spy.mockRestore());

  it('plays the camera clip and both MIC tracks as separate players; only MIC 1 is audible at first', async () => {
    await openPlayer('0003');
    expect(screen.getByTestId('evidence-player')).toBeTruthy();
    expect(screen.getByTestId('evidence-play-simulated')).toBeTruthy();
    expect(screen.getByTestId('evidence-play-excerpt')).toBeTruthy();
    const media = DEMO_MEDIA_EVIDENCE['0003'];
    expect(spy.mock.calls.slice(0, 3).map((call) => call[0])).toEqual([media.video['VIDEO-01'], media.audio['AUDIO-01'], media.audio['AUDIO-02']]);
    const [video, mic1, mic2] = createdPlayers(spy) as [MockPlayer, MockPlayer, MockPlayer];
    expect(screen.getByTestId('evidence-play-video').props.player).toBe(video);
    expect(video.muted).toBe(true);
    expect(mic1.muted).toBe(false);
    expect(mic2.muted).toBe(true);
    expect([video, mic1, mic2].every((p) => p.loop)).toBe(true);
    // Opening from Play starts playback on all three.
    expect(video.play).toHaveBeenCalled();
    expect(mic1.play).toHaveBeenCalled();
    expect(mic2.play).toHaveBeenCalled();
  });

  it('switches to MIC 2: MIC 1 muted, MIC 2 audible (never mixed)', async () => {
    await openPlayer('0005');
    const [, mic1, mic2] = createdPlayers(spy) as [MockPlayer, MockPlayer, MockPlayer];
    fireEvent.press(screen.getByTestId('evidence-play-mic-2'));
    await settle();
    expect(mic1.muted).toBe(true);
    expect(mic2.muted).toBe(false);
    fireEvent.press(screen.getByTestId('evidence-play-mic-1'));
    await settle();
    expect(mic1.muted).toBe(false);
    expect(mic2.muted).toBe(true);
  });

  it('a scrubber seek maps the recording position to p mod the clip length on every player', async () => {
    const { id } = await openPlayer('0003');
    const clipMs = getDemoEvidencePackage(id)!.excerptDurationMs;
    const players = createdPlayers(spy).slice(0, 3);
    expect(players).toHaveLength(3);
    const target = 3 * clipMs + 6_000;
    fireEvent(screen.getByTestId('evidence-play-scrubber'), 'changeEnd', target);
    await settle();
    for (const player of players) expect(player.currentTime).toBeCloseTo(6, 3);
    expect(screen.getByTestId('evidence-play-position')).toHaveTextContent(/^00:\d\d:\d\d \/ /);
  });

  it('switches the camera clip and pauses every player when the sheet closes', async () => {
    await openPlayer('0001');
    const media = DEMO_MEDIA_EVIDENCE['0001'];
    const [video, mic1, mic2] = createdPlayers(spy) as [MockPlayer, MockPlayer, MockPlayer];
    fireEvent.press(screen.getByTestId('evidence-play-camera-2'));
    await settle();
    expect(video.replaceAsync).toHaveBeenCalledWith(media.video['VIDEO-02']);
    fireEvent.press(screen.getByTestId('evidence-play-sheet-close'));
    await waitFor(() => expect(video.pause).toHaveBeenCalled());
    expect(mic1.pause).toHaveBeenCalled();
    expect(mic2.pause).toHaveBeenCalled();
  });

  // Fix wave J round two (JM-08 ruling) REPLACES "the player opens in a kit Dialog": a scrolling surface is a sheet in
  // BOTH motion modes - one form, one way out.
  it('JM-08 reduced motion: the player is the same sheet as in full motion (no Dialog form) and still plays', async () => {
    resetMotionStateForTests({ reduceMotionOverride: true });
    try {
      await openPlayer('0002');
      expect(screen.queryByTestId('evidence-play-sheet-dialog')).toBeNull();
      expect(screen.getByTestId('evidence-play-sheet')).toBeTruthy();
      expect(screen.getByTestId('evidence-player')).toBeTruthy();
      const [video, mic1, mic2] = createdPlayers(spy) as [MockPlayer, MockPlayer, MockPlayer];
      expect([video, mic1, mic2].every((p) => p.play.mock.calls.length > 0)).toBe(true);
      // Closing pauses every player at once (the full-motion case above asserts the same; when the body leaves is the frame's exit time).
      fireEvent.press(screen.getByTestId('evidence-play-sheet-close'));
      await waitFor(() => expect(video.pause).toHaveBeenCalled());
    } finally {
      resetMotionStateForTests();
    }
  });
});
