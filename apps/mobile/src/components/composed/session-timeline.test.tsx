// C-3 SessionTimeline: ordering, UTC+07:00 labels, insertion detection and the rendered rows.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { ReactNode } from 'react';
import { SessionTimeline } from './session-timeline';
import { isInsertion, newestId, orderTimeline, timelineTime, type TimelineItem } from './session-timeline.math';

const EVENTS: TimelineItem[] = [
  { id: 'e2', at: '2026-10-01T07:14:30.000Z', title: 'Marker', detail: 'Subject arrives', tone: 'info' },
  { id: 'e1', at: '2026-10-01T07:14:12.000Z', title: 'Recording started', tone: 'danger' },
  { id: 'e3', at: '2026-10-01T07:20:05.000Z', title: 'Snapshot', tone: 'accent' },
];

describe('SessionTimeline maths', () => {
  it('orders by time, stable on ties, in either direction', () => {
    expect(orderTimeline(EVENTS).map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(orderTimeline(EVENTS, 'newest-first').map((e) => e.id)).toEqual(['e3', 'e2', 'e1']);
    const tie = [
      { id: 'a', at: 5, title: 'A' },
      { id: 'b', at: 5, title: 'B' },
    ];
    expect(orderTimeline(tie).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('labels times at UTC+07:00 from ISO or epoch input', () => {
    expect(timelineTime('2026-10-01T07:14:12.000Z')).toBe('14:14:12');
    expect(timelineTime(Date.parse('2026-10-01T07:14:12.000Z'))).toBe('14:14:12');
  });

  it('finds the newest item and the insertions since first render', () => {
    expect(newestId(EVENTS)).toBe('e3');
    expect(newestId([])).toBeNull();
    const initial = new Set(['e1', 'e2']);
    expect(isInsertion(initial, 'e3')).toBe(true);
    expect(isInsertion(initial, 'e1')).toBe(false);
  });
});

describe('SessionTimeline component', () => {
  const wrap = (node: ReactNode) => <HeroUINativeProvider>{node}</HeroUINativeProvider>;

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    // Unmount and flush queued UI-runtime work under this test's fake clock (frame callbacks
    // register and unregister through it), then return to real timers.
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders each event with its time, title and detail', () => {
    render(wrap(<SessionTimeline items={EVENTS} motion="reduced" testID="tl" />));
    expect(screen.getByLabelText('14:14:12, Recording started')).toBeTruthy();
    expect(screen.getByLabelText('14:14:30, Marker, Subject arrives')).toBeTruthy();
    expect(screen.getByLabelText('14:20:05, Snapshot')).toBeTruthy();
  });

  it('inserts a new event at the end in full motion', () => {
    const { rerender } = render(wrap(<SessionTimeline items={EVENTS} motion="full" testID="tl" />));
    const bookmark: TimelineItem = { id: 'e4', at: '2026-10-01T07:21:00.000Z', title: 'Bookmark', tone: 'info' };
    rerender(wrap(<SessionTimeline items={[...EVENTS, bookmark]} motion="full" testID="tl" />));
    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(screen.getByTestId('tl-row-e4')).toBeTruthy();
    expect(screen.getByLabelText('14:21:00, Bookmark')).toBeTruthy();
  });

  it('shows the empty label when there is nothing yet', () => {
    render(wrap(<SessionTimeline items={[]} motion="full" emptyLabel="No events" />));
    expect(screen.getByText('No events')).toBeTruthy();
  });
});
