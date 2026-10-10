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
