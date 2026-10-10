// Fix wave H, closing pass Z2 - gate 70 finding G70-04, the label half (gates 75 and 81 saw it again:
// Session New's Next read ONLY "busy" to the screen reader, visible text "Next").
//
// Two causes, both stated by drivers B and D and neither observable in jest as an announcement:
//  (1) the idle state dropped the key `busy` (fixed in `runtime/pending-control.tsx` and pinned there);
//  (2) the footer buttons had NO `accessibilityLabel`: Android composes "<label>, busy" from the
//      view's own description and skips the rewrite for a view that has none, so the word "busy"
//      stood alone and stayed.
// What jest CAN observe, and does: each footer button of the flow carries its visible text as its
// accessibility label, on every step. Written RED: the three buttons had no label.
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { PRECHECK_TOTAL_MAX_MS } from '@dems/shared/sim';
import { resetMotionStateForTests } from '@/motion';
import { renderSessionNewApp, settle } from './testing/session-new-harness';

afterEach(() => resetMotionStateForTests());

const labelOf = (testID: string) => screen.getByTestId(testID).props.accessibilityLabel as string | undefined;
const stateOf = (testID: string) => screen.getByTestId(testID).props.accessibilityState as { busy?: boolean } | undefined;
const settleValidation = () => act(async () => {});

describe('G70-04: the footer buttons of Session New have a label for the state to attach to', () => {
  it('Next (step 1), Next (step 2) and Start Recording each carry their visible text as accessibilityLabel, with busy: false stated', async () => {
    const h = renderSessionNewApp();
    await settle();
    h.openFlow();
    expect(labelOf('session-new-next')).toBe('Next');

    fireEvent.press(screen.getByTestId('session-new-scan'));
    await settleValidation();
    fireEvent.press(screen.getByTestId('session-new-subject-TERSANGKA'));
    await settleValidation();
    fireEvent.changeText(screen.getByTestId('session-new-subject-name'), 'Ahmad Fauzi');
    await settleValidation();
    fireEvent.press(screen.getByTestId('session-new-next'));
    for (let i = 0; i < 3; i += 1) await settleValidation();
    h.tick(PRECHECK_TOTAL_MAX_MS);
    await settle();
    // Step 2: after the action of step 1 ended.
    expect(labelOf('session-new-next')).toBe('Next');
    expect(stateOf('session-new-next')?.busy).toBe(false);

    fireEvent.press(screen.getByTestId('session-new-next'));
    await settle();
    expect(labelOf('session-new-start')).toBe('Start Recording');
    expect(stateOf('session-new-start')?.busy).toBe(false);
  });
});
