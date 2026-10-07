// Closing-fix row CF2-A, defect RF-PH-3 (= RF-T-4): the start hand-off (Ready -> monitor) marks the session,
// so the monitor its stack replace mounts draws its regions in place: its first frame is the monitor, not
// an all-opacity-0 frame (the empty frame of 7 of 18 phone starts). On the app's real Live source, in both
// arrival orders of the answer and the delta (S2-2, CA-02).
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { PRECHECK_TOTAL_MAX_MS } from '@dems/shared/sim';
import { isMonitorHandoff, resetMonitorHandoffForTests } from '@/features/session-live/monitor-handoff';
import { renderLiveSessionNew, resetLiveSessionNewBed, type LiveSessionNewBed } from './testing/live-session-new-bed';

let bed: LiveSessionNewBed | null = null;

beforeEach(async () => {
  await resetLiveSessionNewBed();
  resetMonitorHandoffForTests();
});

afterEach(() => {
  jest.restoreAllMocks();
  bed?.stop();
  bed = null;
  resetMonitorHandoffForTests();
});

const next = () => screen.getByTestId('session-new-next');

async function liveToReady(): Promise<LiveSessionNewBed> {
  const b = await renderLiveSessionNew();
  bed = b;
  await b.openFlow();
  const settleValidation = () => act(async () => {});
  fireEvent.press(screen.getByTestId('session-new-scan'));
  await settleValidation();
  fireEvent.press(screen.getByTestId('session-new-subject-TERSANGKA'));
  await settleValidation();
  fireEvent.changeText(screen.getByTestId('session-new-subject-name'), 'Ahmad Fauzi');
  await settleValidation();
  fireEvent.press(next());
  await b.flush();
  await b.elapse(200);
  await b.runCore(PRECHECK_TOTAL_MAX_MS);
  expect(b.state().session?.state).toBe('ARMED');
  fireEvent.press(next());
  await b.flush();
  fireEvent.press(screen.getByTestId('session-new-countdown'));
  return b;
}

/** The monitor regions that rise in (`enterRise` under full motion: FadeInDown), composites only. */
function risesBelow(root: ReactTestInstance): number {
  return root.findAll((node) => {
    const entering = node.props?.entering as { constructor?: { name?: string } } | null | undefined;
    return typeof node.type !== 'string' && entering?.constructor?.name === 'FadeInDown';
  }, { deep: true }).length;
}

describe('RF-PH-3: the start hand-off draws the monitor in place', () => {
  it.each(['delta-first', 'answer-first'] as const)('%s: the session is marked before the replace and the monitor has no rise', async (order) => {
    const b = await liveToReady();
    b.order = order;
    fireEvent.press(screen.getByTestId('session-new-start'));
    await b.flush();
    await b.elapse(200);
    if (order === 'answer-first') {
      b.sendHeldDeltas();
      await b.flush();
    }
    expect(b.app.getPathname()).toBe('/session/live');
    expect(isMonitorHandoff(b.state().session?.id)).toBe(true);
    expect(risesBelow(screen.getByTestId('screen-session-live'))).toBe(0);
  });
});
