// Session Summary maths and the SIM-GAP-M80-1 adapter (step 80; 04_mobile_specs §4.7).
import { describe, expect, it } from '@jest/globals';
import type { EvidenceTrack, TimeHistoryPoint } from '@dems/shared/sim';
import { timeSourceAt } from './sim-adapter';
import { LIFECYCLE_STAGES, lifecycleStatuses, orderedTracks, shortHash, sizeParts, summaryAvailability } from './summary.model';

const track = (trackId: string): EvidenceTrack => ({ trackId, label: trackId, sizeBytes: 1, sha256: trackId }) as EvidenceTrack;

describe('summary model', () => {
  it('orders all eight tracks VIDEO-01..04, then AUDIO-01..04', () => {
    const ids = ['AUDIO-04', 'VIDEO-03', 'AUDIO-02', 'VIDEO-04', 'AUDIO-01', 'VIDEO-02', 'AUDIO-03', 'VIDEO-01'];
    const ordered = orderedTracks(ids.map(track));
    expect(ordered.map((t) => t.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04']);
  });

  it('orders a partial set and keeps unknown IDs after the known ones', () => {
    expect(orderedTracks([track('AUDIO-04'), track('VIDEO-03'), track('VIDEO-01')]).map((t) => t.trackId)).toEqual(['VIDEO-01', 'VIDEO-03', 'AUDIO-04']);
    expect(orderedTracks([track('X-9'), track('AUDIO-01'), track('VIDEO-04')]).map((t) => t.trackId)).toEqual(['VIDEO-04', 'AUDIO-01', 'X-9']);
  });

  it('shortens a hash keeping both ends', () => {
    const hash = 'a'.repeat(8) + 'b'.repeat(48) + 'c'.repeat(8);
    expect(shortHash(hash)).toBe('aaaaaaaa…cccccccc');
    expect(shortHash('abc')).toBe('abc');
    expect(shortHash(null)).toBe('—');
  });

  it('formats sizes in decimal units', () => {
    expect(sizeParts(2_400_000_000)).toEqual({ unit: 'gb', value: '2.4' });
    expect(sizeParts(45_600_000)).toEqual({ unit: 'mb', value: '45.6' });
    expect(sizeParts(1.2e12)).toEqual({ unit: 'tb', value: '1.2' });
    expect(sizeParts(Number.NaN)).toEqual({ unit: 'mb', value: '0.0' });
  });

  it('puts the lifecycle at SEALED LOCAL EVIDENCE (the 8th of 12 stages)', () => {
    expect(LIFECYCLE_STAGES).toHaveLength(12);
    const statuses = lifecycleStatuses('SEALED_LOCAL_EVIDENCE');
    expect(statuses.indexOf('active')).toBe(7);
    expect(statuses.slice(0, 7).every((s) => s === 'done')).toBe(true);
    expect(statuses.slice(8).every((s) => s === 'pending')).toBe(true);
    expect(lifecycleStatuses(null).every((s) => s === 'pending')).toBe(true);
  });

  it('knows a found summary, a session still finalizing, and an unknown ID', () => {
    expect(summaryAvailability(true, null, null, 'SES-1')).toBe('summary');
    expect(summaryAvailability(false, 'SES-1', 'FINALIZING', 'SES-1')).toBe('finalizing');
    expect(summaryAvailability(false, 'SES-1', 'SEALED', 'SES-1')).toBe('missing');
    expect(summaryAvailability(false, 'SES-2', 'FINALIZING', 'SES-1')).toBe('missing');
  });
});

describe('timeSourceAt (SIM-GAP-M80-1)', () => {
  const history: TimeHistoryPoint[] = [
    { at: 10_000, offsetMs: 1, source: 'GNSS' },
    { at: 20_000, offsetMs: 2, source: 'NTP' },
    { at: 30_000, offsetMs: 3, source: 'RTC' },
  ];
  it('takes the newest sample at or before the instant', () => {
    expect(timeSourceAt(history, 15_000)).toBe('GNSS');
    expect(timeSourceAt(history, 20_000)).toBe('NTP');
    expect(timeSourceAt(history, 99_000)).toBe('RTC');
  });
  it('gives null rather than a guess before the ring, for an empty ring, or no instant', () => {
    expect(timeSourceAt(history, 5_000)).toBeNull();
    expect(timeSourceAt([], 5_000)).toBeNull();
    expect(timeSourceAt(history, null)).toBeNull();
  });
});
