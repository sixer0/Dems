// Fix wave J round two (JT-10): the transcript follows the playback and a segment's time seeks - the mobile copy of the
// web console's module, with the web's own cases. A new module: its own test file, named after it.
import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { activeSegmentIndex, publishPlaybackPosition, requestPlaybackSeek, usePlaybackPosition, usePlaybackSeekRequests } from './playback-link';

const SEGMENTS = [
  { index: 0, startMs: 0, endMs: 3_000 },
  { index: 1, startMs: 6_000, endMs: 9_000 },
  { index: 2, startMs: 9_000, endMs: 14_500 },
];

describe('the link between the sealed player and the transcript (JT-10)', () => {
  it('the segment that holds the position: start inclusive, end exclusive, none in a gap, none without a playback', () => {
    expect(activeSegmentIndex(SEGMENTS, null)).toBeNull();
    expect(activeSegmentIndex(SEGMENTS, 0)).toBe(0);
    expect(activeSegmentIndex(SEGMENTS, 2_999)).toBe(0);
    expect(activeSegmentIndex(SEGMENTS, 3_000)).toBeNull();
    expect(activeSegmentIndex(SEGMENTS, 6_000)).toBe(1);
    expect(activeSegmentIndex(SEGMENTS, 9_000)).toBe(2);
    expect(activeSegmentIndex(SEGMENTS, 20_000)).toBeNull();
  });

  it('the pane reads the position the player publishes, per item, in 250 ms steps', () => {
    const pane = renderHook(() => usePlaybackPosition('EV-A'));
    const other = renderHook(() => usePlaybackPosition('EV-B'));
    expect(pane.result.current).toBeNull();
    act(() => publishPlaybackPosition('EV-A', 6_130));
    expect(pane.result.current).toBe(6_000);
    expect(other.result.current).toBeNull();
    act(() => publishPlaybackPosition('EV-A', null));
    expect(pane.result.current).toBeNull();
  });

  it('a seek request reaches the mounted player; without a player it answers false; an unmount forgets the position', () => {
    expect(requestPlaybackSeek('EV-C', 6_000)).toBe(false);
    const onSeek = jest.fn();
    const player = renderHook(() => usePlaybackSeekRequests('EV-C', onSeek));
    expect(requestPlaybackSeek('EV-C', 6_000)).toBe(true);
    expect(onSeek).toHaveBeenCalledWith(6_000);
    const pane = renderHook(() => usePlaybackPosition('EV-C'));
    act(() => publishPlaybackPosition('EV-C', 1_000));
    expect(pane.result.current).toBe(1_000);
    act(() => player.unmount());
    expect(pane.result.current).toBeNull();
    expect(requestPlaybackSeek('EV-C', 6_000)).toBe(false);
  });
});
