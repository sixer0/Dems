// Wave H, driver B - gates 70 / 75 finding G70-04 (ux §14.3 "the state of a control is its real
// state"): on the tablet and the phone the Session New "Next" kept announcing "busy" after its action
// had ended (after "Not now" on the local-source notice).
//
// THE CAUSE (reasoned from React Native's Android view manager; not observable in jest): the control
// said `accessibilityState: { busy: true }` while its command was out and then DROPPED the prop when
// idle (`busyState` returns `{}`). On Android a removed `accessibilityState` is ignored by the native
// view (`BaseViewManager.setViewState` returns on null), so the last state - busy - stays announced.
// What jest CAN observe, and does: an idle control of this flow states `busy: false` EXPLICITLY, and
// states it again after an action ended. Written RED: the idle controls carried no `busy` member.
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { PRECHECK_TOTAL_MAX_MS } from '@dems/shared/sim';
import { resetMotionStateForTests } from '@/motion';
import { renderSessionNewApp, settle } from './testing/session-new-harness';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('idle control state', () => {
unmountBeforeTheHooksOfThisGroup();

afterEach(() => resetMotionStateForTests());

const stateOf = (testID: string) => screen.getByTestId(testID).props.accessibilityState as { busy?: boolean; disabled?: boolean } | undefined;
const settleValidation = () => act(async () => {});

describe('G70-04: an idle control of Session New says that it is idle', () => {
  it('Next states busy: false before a press, after its action ended, and on the next step; Start Recording the same', async () => {
    const h = renderSessionNewApp();
    await settle();
    h.openFlow();
    expect(stateOf('session-new-next')).toMatchObject({ busy: false, disabled: true });

    fireEvent.press(screen.getByTestId('session-new-scan'));
    await settleValidation();
    fireEvent.press(screen.getByTestId('session-new-subject-TERSANGKA'));
    await settleValidation();
    fireEvent.changeText(screen.getByTestId('session-new-subject-name'), 'Ahmad Fauzi');
    await settleValidation();
    expect(stateOf('session-new-next')).toMatchObject({ busy: false, disabled: false });

    fireEvent.press(screen.getByTestId('session-new-next'));
    for (let i = 0; i < 3; i += 1) await settleValidation();
    // Step 2: the action of step 1 ended; the control of this step is idle and says so.
    expect(stateOf('session-new-next')?.busy).toBe(false);
    h.tick(PRECHECK_TOTAL_MAX_MS);
    await settle();
    expect(stateOf('session-new-next')).toMatchObject({ busy: false, disabled: false });
    fireEvent.press(screen.getByTestId('session-new-next'));
    await settle();
    expect(stateOf('session-new-start')?.busy).toBe(false);
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-h-z2-footer-labels.test.tsx` (test-suite consolidation, D233): every case as it was.
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
describe('footer labels', () => {
unmountBeforeTheHooksOfThisGroup();
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
});
