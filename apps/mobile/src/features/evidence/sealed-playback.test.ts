// Blueprint row 92 (M8-W3; UX spec flow 5, R-3, R-4): the pure rules of sealed playback. The web
// console holds the same cases for its own copy.
import { describe, expect, it } from '@jest/globals';
import type { ItemAudioInterval } from './item-v2';
import {
  PLAYER_SYNC_TOLERANCE_S,
  bandDurationMs,
  bandInputs,
  bandSegments,
  clampSeek,
  fileIsDevelopment,
  formatMediaTime,
  intervalIsDevelopment,
  needsResync,
  permissionGate,
  segmentAt,
  type VerifiedSources,
} from './sealed-playback';

const INTERVALS: ItemAudioInterval[] = [
  { seq: 1, inputId: 'MIC-01', fromMs: 0, toMs: 30_000, reason: 'START' },
  { seq: 2, inputId: 'MIC-02', fromMs: 30_000, toMs: 90_000, reason: 'MANUAL' },
  { seq: 3, inputId: 'MIC-01', fromMs: 90_000, toMs: null, reason: 'MANUAL' },
];
const DEVELOPMENT: VerifiedSources = {
  state: 'DEVELOPMENT',
  tracks: [
    { trackId: 'VIDEO-01', sourceClass: 'LOCAL_DEVICE' },
    { trackId: 'VIDEO-02', sourceClass: 'PRODUCTION' },
  ],
  audioIntervals: [
    { seq: 1, micDeviceId: 'MIC-01', sourceClass: 'PRODUCTION' },
    { seq: 2, micDeviceId: 'MIC-02', sourceClass: 'FAKE' },
  ],
};

describe('the audio-source band', () => {
  it('each interval as a share of the recorded duration; the open one runs to the end; tones by first appearance', () => {
    const segments = bandSegments(INTERVALS, 120_000);
    expect(segments.map((segment) => [segment.seq, segment.inputId, segment.fromMs, segment.toMs, segment.startPct, segment.widthPct, segment.tone])).toEqual([
      [1, 'MIC-01', 0, 30_000, 0, 25, 0],
      [2, 'MIC-02', 30_000, 90_000, 25, 50, 1],
      [3, 'MIC-01', 90_000, 120_000, 75, 25, 0],
    ]);
    expect(bandInputs(segments)).toEqual([
      { inputId: 'MIC-01', tone: 0 },
      { inputId: 'MIC-02', tone: 1 },
    ]);
  });

  it('is ordered by media time; a segment without width is dropped; nothing leaves the recording', () => {
    const shuffled = [INTERVALS[2]!, INTERVALS[0]!, { seq: 9, inputId: 'MIC-02', fromMs: 30_000, toMs: 30_000, reason: null }, INTERVALS[1]!];
    expect(bandSegments(shuffled, 120_000).map((segment) => segment.seq)).toEqual([1, 2, 3]);
    expect(bandDurationMs([{ seq: 1, inputId: 'MIC-01', fromMs: 0, toMs: 150_000, reason: 'START' }], 120_000)).toBe(150_000);
    expect(bandSegments([], 120_000)).toEqual([]);
  });

  it('the interval that holds the playhead: an end is exclusive, except the very end of the recording', () => {
    const segments = bandSegments(INTERVALS, 120_000);
    expect([segmentAt(segments, 0)?.seq, segmentAt(segments, 29_999)?.seq, segmentAt(segments, 30_000)?.seq, segmentAt(segments, 120_000)?.seq]).toEqual([1, 1, 2, 3]);
    expect(segmentAt(segments, 120_001)).toBeNull();
  });
});

describe('the players and the gate', () => {
  it('the following player is re-aligned only beyond the tolerance; a seek stays inside the recording', () => {
    expect(needsResync(10, 10 + PLAYER_SYNC_TOLERANCE_S)).toBe(false);
    expect(needsResync(10, 10 + PLAYER_SYNC_TOLERANCE_S + 0.01)).toBe(true);
    expect(needsResync(Number.NaN, 3)).toBe(false);
    expect([clampSeek(-3, 120), clampSeek(500, 120), clampSeek(60, 120), clampSeek(Number.NaN, 120)]).toEqual([0, 120, 60, 0]);
    expect([formatMediaTime(0), formatMediaTime(65_400), formatMediaTime(3_725_000)]).toEqual(['0:00', '1:05', '1:02:05']);
  });

  it('a development mark comes from a verify result only', () => {
    expect([fileIsDevelopment(DEVELOPMENT, 'VIDEO-01'), fileIsDevelopment(DEVELOPMENT, 'VIDEO-02')]).toEqual([true, false]);
    expect([intervalIsDevelopment(DEVELOPMENT, 1), intervalIsDevelopment(DEVELOPMENT, 2), intervalIsDevelopment(DEVELOPMENT, 3)]).toEqual([false, true, false]);
    expect(fileIsDevelopment(null, 'VIDEO-01')).toBe(false);
    expect(fileIsDevelopment({ ...DEVELOPMENT, state: 'NOT_TRUSTWORTHY' }, 'VIDEO-01')).toBe(false);
  });

  it('G6 / G7: Checking until the role is known, then allowed or refused', () => {
    expect(permissionGate({ operatorKnown: false, permitted: true })).toBe('CHECKING');
    expect(permissionGate({ operatorKnown: true, permitted: true })).toBe('ALLOWED');
    expect(permissionGate({ operatorKnown: true, permitted: false })).toBe('REFUSED');
  });
});
