// Closing-fix row CF2-A, defect RF-PH-3 (= RF-T-4; final phone and tablet re-tests, decisions D227, D234).
//
// 7 of 18 phone starts showed ONE empty frame (7-109 ms, only the background) between "Starting..." and the
// monitor; never at monitor -> Finalizing, whose incoming screen skips its enter motion (E2E-P-4). The
// monitor entered with `enterRise` on every region, each from opacity 0, in the very commit that dropped
// "Starting..." (the start hand-off's stack replace): its first frame was all opacity 0.
// Held here: after the start hand-off's mark the monitor declares NO `entering` animation (its first frame
// is the drawn monitor); opened any other way (Home banner, deep link) it keeps its entrance.
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { resetMotionStateForTests } from '@/motion';
import { markMonitorHandoff, resetMonitorHandoffForTests } from './monitor-handoff';
import { renderMonitorApp, settle } from './testing/monitor-harness';

beforeEach(() => {
  resetMonitorHandoffForTests();
});
afterEach(() => {
  resetMotionStateForTests();
  resetMonitorHandoffForTests();
});

/** Every element below `root` that rises in (an `enterRise` entering animation), as `type#testID`. */
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

describe('RF-PH-3: the monitor after the start hand-off is drawn in place', () => {
  it('opened from Home (no hand-off): the regions rise in as before', async () => {
    const h = renderMonitorApp({ window: 'phonePortrait' });
    await settle();
    h.openMonitor();
    expect(enteringBelow(screen.getByTestId('screen-session-live')).length).toBeGreaterThan(0);
  });

  it('after the start hand-off of this session: no region declares an entering animation', async () => {
    const h = renderMonitorApp({ window: 'phonePortrait' });
    await settle();
    markMonitorHandoff(h.sim.store.getState().session?.id);
    h.openMonitor();
    expect(enteringBelow(screen.getByTestId('screen-session-live'))).toEqual([]);
  });

  it('a mark of another session changes nothing', async () => {
    const h = renderMonitorApp({ window: 'tabletLandscape' });
    await settle();
    markMonitorHandoff('SES-20990101-0001');
    h.openMonitor();
    expect(enteringBelow(screen.getByTestId('screen-session-live')).length).toBeGreaterThan(0);
  });
});
