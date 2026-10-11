// The one-slot hand-off mark (review finding W93-18): the rule the three hand-offs of a session share.
import { describe, expect, it } from '@jest/globals';
import { isFinalizingHandover, markFinalizingHandover, resetFinalizingHandoverForTests } from '@/features/session-finalizing/handover';
import { isMonitorHandoff, markMonitorHandoff, resetMonitorHandoffForTests } from '@/features/session-live/monitor-handoff';
import { isSummaryHandoff, markSummaryHandoff, resetSummaryHandoffForTests } from '@/features/session-summary/summary-handoff';
import { createHandoffMark } from './handoff-mark';

describe('createHandoffMark', () => {
  it('matches only the session marked last; no id is never marked and never matches; the reset empties the slot', () => {
    const mark = createHandoffMark();
    expect(mark.is('S-1')).toBe(false);
    mark.mark('S-1');
    expect(mark.is('S-1')).toBe(true);
    expect(mark.is('S-2')).toBe(false);
    for (const none of [null, undefined, '']) {
      mark.mark(none);
      expect(mark.is(none)).toBe(false);
    }
    // Marking nothing kept the slot; marking another session replaces it.
    expect(mark.is('S-1')).toBe(true);
    mark.mark('S-2');
    expect(mark.is('S-1')).toBe(false);
    expect(mark.is('S-2')).toBe(true);
    mark.resetForTests();
    expect(mark.is('S-2')).toBe(false);
  });

  it('the three hand-offs each hold their own slot', () => {
    markMonitorHandoff('S-1');
    expect([isMonitorHandoff('S-1'), isFinalizingHandover('S-1'), isSummaryHandoff('S-1')]).toEqual([true, false, false]);
    markFinalizingHandover('S-2');
    markSummaryHandoff('S-3');
    expect([isMonitorHandoff('S-1'), isFinalizingHandover('S-2'), isSummaryHandoff('S-3')]).toEqual([true, true, true]);
    resetMonitorHandoffForTests();
    expect([isMonitorHandoff('S-1'), isFinalizingHandover('S-2'), isSummaryHandoff('S-3')]).toEqual([false, true, true]);
    resetFinalizingHandoverForTests();
    resetSummaryHandoffForTests();
    expect([isFinalizingHandover('S-2'), isSummaryHandoff('S-3')]).toEqual([false, false]);
  });
});
