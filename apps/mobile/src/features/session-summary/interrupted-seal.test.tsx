// Wave H, driver B (gates 75 / 89: G75-03, B-3; ruling D197): a recording that a fault ended and the
// Core sealed is NAMED on the tablet and the phone - "Sealed — recording was interrupted" and the
// sentence of its cause - on the Session Summary and in the Sessions hub, never the plain sealed
// state. The fact is the Core's own: the custody entry RECORDING_INTERRUPTED of the session's item.
// Written RED: the Summary stamped "SEALED" and the hub row read "Sealed".
import '@/features/session-finalizing/testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, screen, within } from '@testing-library/react-native';
import { en } from '@dems/shared/i18n';
import type { Sim } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { renderFlowApp, settle } from '@/features/session-finalizing/testing/flow-harness';
import { resetStampedForTests } from './stamp-once';

const WORDS = en.common.interruptedSeal;
const CAUSE = en.common.captureFault.noReason.capture;

beforeEach(() => {
  resetMissingKeys();
  resetStampedForTests();
});
afterEach(() => resetMotionStateForTests());

/** The item of `sessionId` as the Core's seal of an interrupted recording leaves it (`completeSealTransition`). */
function markInterrupted(sim: Sim, sessionId: string): void {
  const state = sim.store.getState();
  sim.store.setState({
    evidence: state.evidence.map((item) =>
      item.sessionId === sessionId
        ? { ...item, custody: [item.custody[0]!, { at: item.endedAt, action: 'RECORDING_INTERRUPTED', actorId: null, detail: 'CAPTURE_FAULT' }, ...item.custody.slice(2)] }
        : item,
    ),
  });
}

describe('an interrupted seal on the Session Summary', () => {
  it('the hero names it - the stamp, the title and the cause sentence - and never reads the plain sealed state', async () => {
    const h = renderFlowApp({ scenario: 'sealed' });
    await settle();
    // CONTROL: the same session, stopped by its operator, is the plain sealed state.
    expect(within(screen.getByTestId('summary-sealed')).getByText('SEALED')).toBeTruthy();
    expect(screen.queryByTestId('summary-interrupted')).toBeNull();

    act(() => markInterrupted(h.sim, h.sessionId!));
    await settle();
    const notice = screen.getByTestId('summary-interrupted');
    expect(within(notice).getByText(WORDS.title)).toBeTruthy();
    expect(within(notice).getByText(`${CAUSE} ${WORDS.kept}`)).toBeTruthy();
    expect(within(screen.getByTestId('summary-sealed')).queryByText('SEALED')).toBeNull();
    expect(within(screen.getByTestId('summary-sealed')).getByText(WORDS.short)).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });
});
