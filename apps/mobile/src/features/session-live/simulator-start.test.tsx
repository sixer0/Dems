// Integration pass D10, item 1 (pass D6 item 12; decision D156): Session Live reaches "connecting
// cameras", "recording" and "nothing was recorded" THROUGH THE SIMULATOR'S OWN ACTIONS in Simulated
// client mode. Row 139's and pass D7's tests put each state on the store by hand; here nothing is
// put on the store: the operator's start, the simulator's clock and the existing demo control (the
// fault CAMERA_LOSS on each camera) produce them.
//
// Import order matters: the gorhom mock, then the router harness.
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { act, render, screen, within } from '@testing-library/react-native';
import { CAPTURE_CONNECT_MS, DEMO_OPERATOR_PASSWORD, OPERATORS, type SessionCreateInput } from '@dems/shared/sim';
import { failedStartOf } from '@/features/capture-selector/capture-notices-model';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { RuntimeTestProviders, createTestSim, type TestSim } from '@/runtime/testing/test-sim';
import { FailedStartNotice } from './capture-start-notice';
import { renderMonitorApp, settle } from './testing/monitor-harness';

afterEach(() => {
  resetMotionStateForTests();
  resetMissingKeys();
});

const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: OPERATORS[0]!.id, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };

/** The operator's own steps up to an armed session: nothing is written to the store by hand. */
function arm(test: TestSim): void {
  const created = test.sim.actions.createSession(INPUT);
  if (!created.ok) throw new Error('the session was not created');
  test.sim.actions.beginPrecheck();
  test.advance(5_000);
  expect(test.sim.store.getState().session?.state).toBe('ARMED');
}

const isDisabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;

describe('Session Live on the simulator itself: a recording start', () => {
  it('connecting -> recording: the start reads CONNECTING with no timer and End Session disabled; the simulated delay later it records', async () => {
    const h = renderMonitorApp({ window: 'phonePortrait', recording: false });
    await settle();
    act(() => {
      arm(h);
      h.sim.actions.startRecording();
    });
    expect(h.sim.store.getState().session).toMatchObject({ state: 'RECORDING', captureDurable: false });
    h.openMonitor();
    const root = () => within(screen.getByTestId('screen-session-live'));
    const feedChip = () => within(screen.getByTestId('monitor-feed-rec'));
    expect(feedChip().queryByText('REC')).toBeNull();
    expect(feedChip().getByText('CONNECTING')).toBeTruthy();
    expect(screen.queryByTestId('monitor-timer')).toBeNull();
    expect(root().queryByText('VIDEO 1 REC')).toBeNull();
    expect(root().getByText('VIDEO 1 CONNECTING')).toBeTruthy();
    expect(isDisabled('monitor-end-session')).toBe(true);
    expect(screen.getByTestId('monitor-end-session-blocked')).toBeTruthy();

    // CONTROL: just short of the delay nothing has changed.
    act(() => h.advance(CAPTURE_CONNECT_MS - 100));
    expect(feedChip().getByText('CONNECTING')).toBeTruthy();

    act(() => h.advance(100));
    expect(feedChip().getByText('REC')).toBeTruthy();
    expect(root().getByText('VIDEO 1 REC')).toBeTruthy();
    expect(screen.getByTestId('monitor-timer')).toBeTruthy();
    expect(isDisabled('monitor-end-session')).toBe(false);
    expect(screen.queryByTestId('monitor-end-session-blocked')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('connecting -> failed start: with the demo fault CAMERA_LOSS on both cameras the start ends as "No camera connected" / "Nothing was recorded."', () => {
    const test = createTestSim();
    const signIn = test.sim.actions.signIn(OPERATORS[0]!.username, DEMO_OPERATOR_PASSWORD);
    expect(signIn.ok).toBe(true);
    arm(test);
    test.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    test.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    const evidenceBefore = test.sim.store.getState().evidence.length;
    test.sim.actions.startRecording();
    // Connecting first: the failed start is not decided at the start.
    expect(failedStartOf(test.sim.store.getState().session, test.sim.store.getState().alerts)).toBeNull();
    render(
      <RuntimeTestProviders sim={test.sim}>
        <FailedStartNotice onOpenDevices={() => undefined} />
      </RuntimeTestProviders>,
    );
    expect(screen.queryByTestId('session-failed-start')).toBeNull();

    act(() => test.advance(CAPTURE_CONNECT_MS));
    const state = test.sim.store.getState();
    expect(state.session).toMatchObject({ state: 'FAULT', startedAt: null, bytesWritten: 0, captureDurable: false });
    expect(failedStartOf(state.session, state.alerts)).toBe('NO_CAMERA_CONNECTED');
    const notice = within(screen.getByTestId('session-failed-start-NO_CAMERA_CONNECTED'));
    expect(notice.getByText('No camera connected')).toBeTruthy();
    expect(notice.getByText('Nothing was recorded. Check the cameras on Devices, then close this session and start a new one.')).toBeTruthy();
    expect(state.evidence).toHaveLength(evidenceBefore);
    expect(getMissingKeys()).toEqual([]);
  });
});
