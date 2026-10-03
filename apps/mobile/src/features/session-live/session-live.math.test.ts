// Session Monitor maths (step 79): layout per 04 §2.4, the S4 clock-derived timer, the S2b §5.4
// status strip, timeline rows, markers and the S21 End Session reason rule.
import { describe, expect, it } from '@jest/globals';
import {
  HOLD_HAPTIC_BEATS_MS,
  HOLD_TO_CONFIRM_MS,
  MARKER_LABEL_MAX,
  SHUTTER_MS,
  SHUTTER_PEAK,
  STOP_REASON_MAX,
  STOP_REASON_MIN,
  cameraIndexOf,
  checkStopReason,
  elapsedSecondsAt,
  holdOutcome,
  markerLabel,
  monitorArrangement,
  monitorColumnWidths,
  otherCameraId,
  showsInlineTimeline,
  statusStrip,
  timelineItems,
  unseenCount,
  usesCameraTabs,
} from './session-live.math';

describe('layout (04 §2.4 Session Monitor row)', () => {
  it('maps each layout class to its arrangement', () => {
    expect(monitorArrangement('compact')).toBe('stack');
    expect(monitorArrangement('compact-landscape')).toBe('split');
    expect(monitorArrangement('medium')).toBe('tablet-portrait');
    expect(monitorArrangement('expanded')).toBe('tablet-landscape');
  });

  it('tablets show the timeline inline and switch cameras with Tabs; phones do neither', () => {
    expect(showsInlineTimeline('stack')).toBe(false);
    expect(showsInlineTimeline('split')).toBe(false);
    expect(showsInlineTimeline('tablet-portrait')).toBe(true);
    expect(showsInlineTimeline('tablet-landscape')).toBe(true);
    expect(usesCameraTabs('stack')).toBe(false);
    expect(usesCameraTabs('tablet-landscape')).toBe(true);
  });
});

describe('column widths (split and tablet landscape)', () => {
  it('phone landscape: the 16:9 feed is height-bound and never takes more than 58% of the width', () => {
    // dems_phone landscape 923 x 411 dp, safe area without the cutout and bars (~ 875 x 387).
    const w = monitorColumnWidths('split', { width: 875, height: 387 });
    expect(w.feed).toBe(Math.floor(Math.min((875 - 28) * 0.58, ((387 - 48 - 16) * 16) / 9)));
    expect(w.feed).toBeLessThanOrEqual(Math.floor((875 - 28) * 0.58));
    expect(((w.feed * 9) / 16)).toBeLessThanOrEqual(387 - 48 - 16);
  });

  it('tablet landscape: 58% | 21% | 21%', () => {
    const w = monitorColumnWidths('tablet-landscape', { width: 1280, height: 752 });
    expect(w.feed).toBe(Math.floor(1232 * 0.58));
    expect(w.side).toBe(Math.floor(1232 * 0.21));
  });

  it('stacked arrangements use full width', () => {
    expect(monitorColumnWidths('stack', { width: 411, height: 883 })).toEqual({ feed: 0, side: 0 });
    expect(monitorColumnWidths('tablet-portrait', { width: 800, height: 1240 })).toEqual({ feed: 0, side: 0 });
  });
});

describe('timer (S4)', () => {
  it('counts whole seconds since the start on the simulator clock', () => {
    const start = Date.UTC(2026, 9, 1, 2, 41, 18);
    expect(elapsedSecondsAt(start, start + (18 * 60 + 42) * 1000)).toBe(1122);
    expect(elapsedSecondsAt(start, start + 999)).toBe(0);
    expect(elapsedSecondsAt(start, start + 1000)).toBe(1);
  });

  it('is 0 before the start or without one', () => {
    expect(elapsedSecondsAt(null, 5000)).toBe(0);
    expect(elapsedSecondsAt(undefined, 5000)).toBe(0);
    expect(elapsedSecondsAt(10_000, 5_000)).toBe(0);
    expect(elapsedSecondsAt(Number.NaN, 5_000)).toBe(0);
  });
});

describe('cameras', () => {
  it('reads the camera number from the track id', () => {
    expect(cameraIndexOf('VIDEO-01')).toBe(1);
    expect(cameraIndexOf('VIDEO-02')).toBe(2);
  });

  it('switches to the other camera of the pair', () => {
    expect(otherCameraId('VIDEO-01', ['VIDEO-01', 'VIDEO-02'])).toBe('VIDEO-02');
    expect(otherCameraId('VIDEO-02', ['VIDEO-01', 'VIDEO-02'])).toBe('VIDEO-01');
    expect(otherCameraId('VIDEO-01', ['VIDEO-01'])).toBe('VIDEO-01');
  });
});

describe('status strip (S2b, research 01 §5.4)', () => {
  const nominal = {
    cameras: [
      { index: 1 as const, online: true, recState: 'REC' as const },
      { index: 2 as const, online: true, recState: 'REC' as const },
    ],
    storage: 'READY' as const,
    timeSource: 'GNSS' as const,
    timeLocked: true,
  };

  it('lists VIDEO 1, VIDEO 2, STORAGE, TIME in book order, all green when nominal', () => {
    const chips = statusStrip(nominal);
    expect(chips.map((c) => c.id)).toEqual(['video-1', 'video-2', 'storage', 'time']);
    expect(chips.map((c) => c.tone)).toEqual(['success', 'success', 'success', 'success']);
    expect(chips[3]).toMatchObject({ kind: 'time', value: 'GNSS', locked: true });
  });

  it('a lost camera reads LOST (danger); an offline one without a track state reads OFFLINE', () => {
    const lost = statusStrip({ ...nominal, cameras: [{ index: 1, online: false, recState: 'LOST' }, nominal.cameras[1]!] });
    expect(lost[0]).toMatchObject({ value: 'LOST', tone: 'danger' });
    const offline = statusStrip({ ...nominal, cameras: [{ index: 1, online: false, recState: null }, nominal.cameras[1]!] });
    expect(offline[0]).toMatchObject({ value: 'OFFLINE', tone: 'danger' });
    const degraded = statusStrip({ ...nominal, cameras: [{ index: 1, online: true, recState: 'DEGRADED' }, nominal.cameras[1]!] });
    expect(degraded[0]).toMatchObject({ value: 'DEGRADED', tone: 'warning' });
  });

  it('storage LOW and FULL escalate; an unlocked clock keeps its source and turns amber', () => {
    expect(statusStrip({ ...nominal, storage: 'LOW' })[2]).toMatchObject({ value: 'LOW', tone: 'warning' });
    expect(statusStrip({ ...nominal, storage: 'FULL' })[2]).toMatchObject({ value: 'FULL', tone: 'danger' });
    expect(statusStrip({ ...nominal, timeSource: 'NTP', timeLocked: false })[3]).toMatchObject({
      value: 'NTP',
      locked: false,
      tone: 'warning',
    });
    expect(statusStrip({ ...nominal, timeSource: 'NTP', timeLocked: true })[3]).toMatchObject({ tone: 'info' });
  });
});

describe('timeline rows (S1, C-3)', () => {
  it('keeps the kind for the title and joins label and detail into the row detail', () => {
    const rows = timelineItems([
      { id: 'T1', at: 1, kind: 'START', label: 'Recording started', detail: null },
      { id: 'T2', at: 2, kind: 'SNAPSHOT', label: 'Snapshot 2', detail: 'Camera 1' },
      { id: 'T3', at: 3, kind: 'MARKER', label: 'Key statement', detail: '  ' },
      { id: 'T4', at: 4, kind: 'FAULT', label: '', detail: null },
    ]);
    expect(rows[0]).toEqual({ id: 'T1', at: 1, kind: 'START', detail: 'Recording started', tone: 'success' });
    expect(rows[1]).toMatchObject({ detail: 'Snapshot 2 · Camera 1', tone: 'info' });
    expect(rows[2]).toMatchObject({ detail: 'Key statement', tone: 'accent' });
    expect(rows[3]).toEqual({ id: 'T4', at: 4, kind: 'FAULT', tone: 'danger' });
  });

  it('keeps only the newest events', () => {
    const events = Array.from({ length: 60 }, (_, i) => ({ id: `T${i}`, at: i, kind: 'CHECK' as const, label: 'System check', detail: null }));
    const rows = timelineItems(events, 50);
    expect(rows).toHaveLength(50);
    expect(rows[0]?.id).toBe('T10');
    expect(rows.at(-1)?.id).toBe('T59');
  });

  it('counts unseen events for the History badge', () => {
    expect(unseenCount(12, 10)).toBe(2);
    expect(unseenCount(10, 12)).toBe(0);
    expect(unseenCount(3, -1)).toBe(3);
  });
});

describe('markers (S5, M-C-17)', () => {
  it('trims, caps at 80 characters, and leaves an empty label to the simulator numbering', () => {
    expect(markerLabel('  Key admission  ')).toBe('Key admission');
    expect(markerLabel('   ')).toBeUndefined();
    expect(markerLabel('x'.repeat(100))).toHaveLength(MARKER_LABEL_MAX);
  });
});

describe('End Session (S6, S21, M-C-19)', () => {
  it('needs at least 5 characters after trimming (the simulator rule)', () => {
    expect(STOP_REASON_MIN).toBe(5);
    expect(checkStopReason('  abcd  ')).toEqual({ value: 'abcd', valid: false, length: 4 });
    expect(checkStopReason(' abcde ')).toEqual({ value: 'abcde', valid: true, length: 5 });
    expect(checkStopReason('y'.repeat(STOP_REASON_MAX + 20)).length).toBe(STOP_REASON_MAX);
  });

  it('holds 1,500 ms with light haptics at 0 % and 50 %', () => {
    expect(HOLD_TO_CONFIRM_MS).toBe(1500);
    expect(HOLD_HAPTIC_BEATS_MS).toEqual([0, 750]);
    expect(holdOutcome(1499)).toBe('released-early');
    expect(holdOutcome(1500)).toBe('complete');
  });

  it('flashes the shutter once: 0 → 0.85 → 0 in 180 ms (M-C-18, P8)', () => {
    expect(SHUTTER_MS).toBe(180);
    expect(SHUTTER_PEAK).toBe(0.85);
  });
});
