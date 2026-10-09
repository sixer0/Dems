// Task 3 M5, blueprint row 73 (register MB-03, MB-13; ux spec §3 flow 2; operation 81
// `switchAudioSource`; specs R-3; D4 OD-09, OD-11; B11 / row 62): the mic switch of the Session Live
// monitor in LIVE mode — the app's REAL Live source over the contract-checked fake transport, with a
// model Core behind it (`testing/live-monitor-bed`). Every request and answer of operation 81 is
// checked against the shared registry by the fake; `bed.stop()` throws the first violation.
//
// What is held here and nowhere else: NO optimistic flip (the cards move with the Core's delta, not
// with the press and not with the answer); one confirm is one request, sent as the paired device's
// operator session; the refusals of the contract; the lost link; a MIC_SILENT warning that the
// client never turns into a request; a recording stopped elsewhere takes the toggle and an open
// confirmation away (the late stop, B11).
//
// NOT proven here: the real Core route of operation 81 and its audit row (rows 66 / 71, not built).
//
// Import order: the gorhom mock, then the router harness, then the bed (see its header).
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { promisify } from 'node:util';
import { FAKE_CREDENTIALS, refusal } from '@dems/shared/live/testing';
import { meterFrame, renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed, type LiveMonitorBedOptions } from './testing/live-monitor-bed';

let bed: LiveMonitorBed | null = null;

const nextTurn = promisify(setImmediate) as () => Promise<void>;

beforeAll(async () => {
  // Reanimated prepares its UI-side frame-callback registry on the real queue (S72-12).
  await nextTurn();
  await nextTurn();
});

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  await resetLiveMonitorBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  jest.useRealTimers();
});

const OP = 'switchAudioSource';
const isDisabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;
const isBusy = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.busy === true;
const toastShown = (text: string) => screen.queryAllByText(text).length > 0;
const chipText = (channel: 1 | 2) => {
  const card = within(screen.getByTestId(`monitor-mic-${channel}`));
  return card.queryByText('Active') !== null ? 'Active' : card.queryByText('Standby') !== null ? 'Standby' : null;
};
const chips = () => [chipText(1), chipText(2)];
const coreSwitches = (b: LiveMonitorBed) => b.engine.sim.store.getState().audit.rows.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED');

async function openMonitor(options: LiveMonitorBedOptions = {}): Promise<LiveMonitorBed> {
  const b = await renderLiveMonitor(options);
  bed = b;
  await b.openMonitor();
  expect(screen.getByTestId('screen-session-live')).toBeTruthy();
  return b;
}

async function confirmSwitch(b: LiveMonitorBed): Promise<void> {
  fireEvent.press(screen.getByTestId('monitor-mic-switch'));
  expect(screen.getByTestId('monitor-mic-switch-dialog')).toBeTruthy();
  fireEvent.press(screen.getByTestId('monitor-mic-switch-confirm'));
  await b.flush();
}

describe('the confirmed switch in LIVE mode (operation 81; ux §3.2 steps 2-4)', () => {
  it('opening the monitor and opening the confirmation send nothing; the session holder is offered the toggle', async () => {
    const b = await openMonitor();
    expect(chips()).toEqual(['Active', 'Standby']);
    expect(isDisabled('monitor-mic-switch')).toBe(false);
    expect(screen.queryByTestId('monitor-mic-switch-reason')).toBeNull();
    fireEvent.press(screen.getByTestId('monitor-mic-switch'));
    expect(screen.getByTestId('monitor-mic-switch-dialog')).toBeTruthy();
    fireEvent.press(screen.getByTestId('monitor-mic-switch-cancel'));
    await b.flush();
    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();
    expect(b.requests(OP)).toHaveLength(0);
    expect(coreSwitches(b)).toHaveLength(0);
  });

  it('NO optimistic flip: one request, then the cards stay until the Core\'s delta arrives — not at the press, not at the answer', async () => {
    const b = await openMonitor();
    b.order = 'answer-first';
    const sessionId = b.state().session!.id;
    await confirmSwitch(b);

    // One request, to the open session, naming the standby input; sent as the device's operator session.
    const calls = b.requests(OP);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params).toMatchObject({ id: sessionId });
    expect(calls[0]!.body).toEqual({ inputId: 'MIC-02' });
    const headers = (calls[0]!.headers ?? {}) as Readonly<Record<string, unknown>>;
    const authorization = headers.Authorization ?? headers.authorization;
    expect(authorization === `Bearer ${FAKE_CREDENTIALS.sessionToken}`).toBe(true);
    // E-30: that session is the paired device's (the bed's sign-in answer binds it to the device), and
    // the request carries no device member of its own: the Core names the sending device from the
    // session. The audit row itself is the Core's (row 71) and is asserted at the M5 gate.
    expect(Object.keys(calls[0]!.body as object)).toEqual(['inputId']);

    // The Core has switched and answered; its delta is held back. The replica and the cards are unchanged.
    expect(b.engine.sim.store.getState().audio.activeInputId).toBe('MIC-02');
    expect(b.state().session?.audioSource?.activeInputId ?? 'MIC-01').toBe('MIC-01');
    expect(chips()).toEqual(['Active', 'Standby']);
    // The answer decides: the confirmation stays, busy; Cancel cannot close it.
    expect(screen.getByTestId('monitor-mic-switch-dialog')).toBeTruthy();
    expect(isBusy('monitor-mic-switch-confirm')).toBe(true);
    expect(isDisabled('monitor-mic-switch-cancel')).toBe(true);
    fireEvent.press(screen.getByTestId('monitor-mic-switch-confirm'));
    await b.flush();
    expect(b.requests(OP)).toHaveLength(1);
    expect(toastShown('Active microphone: MIC 2')).toBe(false);

    // The delta: now the cards move, the confirmation closes and the toast names the store's input.
    b.sendHeldDeltas();
    await b.flush();
    expect(b.state().session?.audioSource).toMatchObject({ activeInputId: 'MIC-02', standbyInputId: 'MIC-01' });
    expect(chips()).toEqual(['Standby', 'Active']);
    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();
    expect(toastShown('Active microphone: MIC 2')).toBe(true);
    expect(within(screen.getByTestId('monitor-mic-switch')).getByText('Switch to MIC 1')).toBeTruthy();
    // The model Core wrote exactly one row for the one confirm.
    expect(coreSwitches(b)).toHaveLength(1);
    expect(b.state().session?.state).toBe('RECORDING');
  });

  it('the meters\' own member follows the Core after a switch; the cards keep reading the session\'s pair', async () => {
    const b = await openMonitor();
    await confirmSwitch(b);
    expect(chips()).toEqual(['Standby', 'Active']);
    const at = b.fake.clock.now();
    b.sendMeters({ 'AUDIO-01': meterFrame(-40, at, 1), 'AUDIO-02': meterFrame(-16, at, 1) });
    await b.flush();
    expect(b.state().audio.activeInputId).toBe('MIC-02');
    expect(chips()).toEqual(['Standby', 'Active']);
    expect(b.requests(OP)).toHaveLength(1);
  });
});

describe('the refusals of operation 81 (ux §3.2 steps 5-7, §3.5)', () => {
  it('409 AUDIO_SOURCE_CONFLICT: the fixed sentence stays under the toggle, the cards are unchanged, the next press clears it', async () => {
    const b = await openMonitor();
    b.fake.answer(OP, () => b.fake.example(OP, 409, 'conflict'));
    await confirmSwitch(b);
    expect(b.requests(OP)).toHaveLength(1);
    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();
    expect(within(screen.getByTestId('monitor-mic-switch-refusal')).getByText('The requested microphone cannot become the active source.')).toBeTruthy();
    expect(chips()).toEqual(['Active', 'Standby']);
    expect(toastShown('Active microphone: MIC 2')).toBe(false);
    // The control is back to idle: it can be pressed again, and the old sentence leaves with the press.
    fireEvent.press(screen.getByTestId('monitor-mic-switch'));
    expect(screen.queryByTestId('monitor-mic-switch-refusal')).toBeNull();
    expect(screen.getByTestId('monitor-mic-switch-dialog')).toBeTruthy();
  });

  it('409 INVALID_STATE: "The session is not recording"; nothing is flipped', async () => {
    const b = await openMonitor();
    b.fake.answer(OP, () => refusal(409, 'INVALID_STATE', 'The session is not in a state that allows this.'));
    await confirmSwitch(b);
    expect(within(screen.getByTestId('monitor-mic-switch-refusal')).getByText('The session is not recording. The microphone was not switched.')).toBeTruthy();
    expect(chips()).toEqual(['Active', 'Standby']);
  });

  it('403 NOT_PERMITTED: the presenter\'s denial, no sentence of the cards, no flip, the control idle again', async () => {
    const b = await openMonitor();
    b.fake.answer(OP, () => b.fake.example(OP, 403, 'notPermitted'));
    await confirmSwitch(b);
    expect(b.requests(OP)).toHaveLength(1);
    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();
    expect(screen.queryByTestId('monitor-mic-switch-refusal')).toBeNull();
    expect(toastShown('The microphone was not switched.')).toBe(false);
    expect(toastShown('Active microphone: MIC 2')).toBe(false);
    expect(chips()).toEqual(['Active', 'Standby']);
    expect(isDisabled('monitor-mic-switch')).toBe(false);
  });
});

describe('the Core link (S7; E-16 / P-13)', () => {
  it('link lost: the toggle is disabled with the read-only sentence and a press sends nothing', async () => {
    const b = await openMonitor();
    b.setReachable(false);
    await b.flush();
    await b.elapse(1_000, 250);
    expect(isDisabled('monitor-mic-switch')).toBe(true);
    expect(within(screen.getByTestId('monitor-mic-switch-reason')).getByText('Session actions are paused until the Core link is back.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('monitor-mic-switch'));
    await b.flush();
    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();
    expect(b.requests(OP)).toHaveLength(0);
    // The cards keep the last pair the Core sent.
    expect(chips()).toEqual(['Active', 'Standby']);
  });
});

describe('MIC_SILENT in LIVE mode: a warning, never a request (OD-11; M5-WARN-1, the client half)', () => {
  it('the Core\'s warning shows, meters keep arriving for 15 s, and the client sends no switch; clearing it removes the warning', async () => {
    const b = await openMonitor();
    await b.raiseMicSilent('MIC-01');
    expect(within(screen.getByTestId('monitor-mic-silent')).getByText('MIC 1 is silent')).toBeTruthy();
    for (let second = 1; second <= 15; second += 1) {
      const at = b.fake.clock.now();
      b.sendMeters({ 'AUDIO-01': meterFrame(-72, at, second), 'AUDIO-02': meterFrame(-20, at, second) });
      await b.elapse(1_000, 500);
    }
    expect(b.requests(OP)).toHaveLength(0);
    expect(coreSwitches(b)).toHaveLength(0);
    expect(b.engine.sim.store.getState().audio.activeInputId).toBe('MIC-01');
    expect(chips()).toEqual(['Active', 'Standby']);
    expect(screen.getByTestId('monitor-mic-silent')).toBeTruthy();

    // The offered action opens the confirmation; still nothing is sent.
    fireEvent.press(screen.getByTestId('monitor-mic-silent-switch'));
    expect(screen.getByTestId('monitor-mic-switch-dialog')).toBeTruthy();
    expect(b.requests(OP)).toHaveLength(0);
    fireEvent.press(screen.getByTestId('monitor-mic-switch-cancel'));

    await b.clearMicSilent('MIC-01');
    expect(screen.queryByTestId('monitor-mic-silent')).toBeNull();
    expect(b.requests(OP)).toHaveLength(0);
  });
});

describe('a recording stopped elsewhere (the late stop, B11 / row 62)', () => {
  it('the commit that shows the stop takes an open confirmation and the toggle away; no switch is sent for a stopped recording', async () => {
    const b = await openMonitor();
    fireEvent.press(screen.getByTestId('monitor-mic-switch'));
    expect(screen.getByTestId('monitor-mic-switch-dialog')).toBeTruthy();

    await b.changeOnCore((core) => core.sim.actions.stopRecording('Stopped from the web console'));
    expect(b.state().session?.state).not.toBe('RECORDING');
    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();
    expect(screen.queryByTestId('monitor-mic-switch')).toBeNull();
    expect(screen.queryByTestId('monitor-mic-switch-confirm')).toBeNull();
    expect(b.requests(OP)).toHaveLength(0);
    expect(coreSwitches(b)).toHaveLength(0);
  });
});
