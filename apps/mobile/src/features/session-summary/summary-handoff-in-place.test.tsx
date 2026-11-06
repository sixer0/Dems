// Closing-fix row CF2-A, defect RF-PH-3 (= RF-T-4): 9 of 18 phone runs showed ONE empty frame between the
// "Evidence sealed" card and the Session Summary (never at monitor -> Finalizing, whose incoming screen
// skips its enter motion). The Summary's cards entered with `enterRise`, each from opacity 0.
// Held here: opened by the sealed hand-off (route sync or Finalizing's own 1.2 s hand-off), the Summary
// declares no `entering` animation and the SEALED stamp still plays; opened directly it keeps its entrance.
import '@/features/session-finalizing/testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, screen, within } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { SEALED_HANDOFF_MS } from '@/features/session-finalizing/finalizing.model';
import { advanceUntilSealed, renderFlowApp, settle } from '@/features/session-finalizing/testing/flow-harness';
import { haptics, resetMotionStateForTests } from '@/motion';
import { resetStampedForTests } from './stamp-once';
import { resetSummaryHandoffForTests } from './summary-handoff';

beforeEach(() => {
  resetStampedForTests();
  resetSummaryHandoffForTests();
});
afterEach(() => {
  resetMotionStateForTests();
  resetSummaryHandoffForTests();
  jest.restoreAllMocks();
});

function enteringBelow(root: ReactTestInstance): string[] {
  // The screen's enter rises (`enterRise` under full motion: FadeInDown from opacity 0 and a rise), one per
  // element; the prop repeats on the host view a composite passes it to, so composites only.
  return root
    .findAll((node) => {
      const entering = node.props?.entering as { constructor?: { name?: string } } | null | undefined;
      return typeof node.type !== 'string' && entering?.constructor?.name === 'FadeInDown';
    }, { deep: true })
    .map((node) => {
      const type = node.type as unknown as { displayName?: string; name?: string };
      return `${type.displayName ?? type.name ?? 'component'}#${String(node.props?.testID ?? '')}`;
    });
}

describe('RF-PH-3: the Summary after the sealed hand-off is drawn in place', () => {
  it('route sync at FINALIZING -> SEALED: no card declares an entering animation; the SEALED stamp plays once', async () => {
    const trigger = jest.spyOn(haptics, 'trigger');
    const h = renderFlowApp();
    await settle();
    act(() => advanceUntilSealed(h));
    expect(h.app.getPathname()).toBe(`/session/summary/${h.sessionId}`);
    expect(enteringBelow(screen.getByTestId('screen-session-summary'))).toEqual([]);
    expect(within(screen.getByTestId('summary-sealed')).getByText('SEALED')).toBeTruthy();
    expect(trigger.mock.calls.filter(([event]) => event === 'sealedStamp')).toHaveLength(1);
  });

  it("Finalizing's own hand-off 1.2 s after the seal (no route sync): drawn in place too", async () => {
    const h = renderFlowApp({ routeSync: false });
    await settle();
    act(() => advanceUntilSealed(h));
    h.run(SEALED_HANDOFF_MS + 100);
    expect(h.app.getPathname()).toBe(`/session/summary/${h.sessionId}`);
    expect(enteringBelow(screen.getByTestId('screen-session-summary'))).toEqual([]);
  });

  it('opened directly (a deep link to a sealed session): the cards rise in as before', async () => {
    // The `sealed` scenario opens straight at `/session/summary/<id>`: no Finalizing screen marked it.
    const h = renderFlowApp({ scenario: 'sealed' });
    await settle();
    expect(h.app.getPathname()).toBe(`/session/summary/${h.sessionId}`);
    expect(enteringBelow(screen.getByTestId('screen-session-summary')).length).toBeGreaterThan(0);
  });
});
