// Task 3 M5, blueprint row 73 (register MB-03; ux spec §3 flow 2; operation 81 `switchAudioSource`;
// specs R-3 AC-2..4; D4 OD-09, OD-11; D84 / D91 "Connecting cameras…"). The mic cards and the manual
// switch of the Session Live monitor, on the REAL `/session/live` route over a test simulator in the
// recording scenario (session 0024, opened by the investigator AKP Budi Santoso).
//
// What is held: the cards say "Active" / "Standby" from the store's pair; the toggle is behind the
// gate (checking, the role, the session holder) and a confirmation; a confirmed switch writes exactly
// one AUDIO_SOURCE_SWITCHED row; a cancelled one writes nothing; a MIC_SILENT warning names the input
// and NEVER switches (M5-WARN-1, the client half); the monitor reads "Connecting cameras…" until the
// first durable fragment. The Live twin is `live-mic-source.test.tsx`.
//
// Import order matters: the gorhom mock, then the router harness.
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { MicInputId } from '@dems/shared/domain';
import type { SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { RuntimeTestProviders, createTestSim } from '@/runtime/testing/test-sim';
import { MicSourcePanel, type MicSourcePanelProps } from './mic-source-controls';
import { inputOfChannel, silentInputOf } from './mic-source-model';
import { renderMonitorApp, settle, type MonitorHarness, type MonitorHarnessOptions } from './testing/monitor-harness';

afterEach(() => {
  resetMotionStateForTests();
  resetMissingKeys();
});

const SUPERVISOR = 'andi.pratama';
const TECHNICIAN = 'rina.wijaya';
const CHECKING = 'Checking your permissions…';
const HOLDER = 'Only the operator who opened this session or a supervisor can switch the microphone.';
const ROLE = 'Requires the Investigator or Supervisor role';

async function open(options: MonitorHarnessOptions = {}): Promise<MonitorHarness> {
  const h = renderMonitorApp({ window: 'phonePortrait', ...options });
  await settle();
  h.openMonitor();
  expect(screen.getByTestId('screen-session-live')).toBeTruthy();
  return h;
}

const chipText = (channel: 1 | 2) => {
  const card = within(screen.getByTestId(`monitor-mic-${channel}`));
  return card.queryByText('Active') !== null ? 'Active' : card.queryByText('Standby') !== null ? 'Standby' : null;
};
const glowOf = (channel: 1 | 2) => (StyleSheet.flatten(screen.getByTestId(`monitor-mic-glow-${channel}`, { includeHiddenElements: true }).props.style) as { opacity?: number }).opacity;
const isDisabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;
const switches = (state: SimState) => state.audit.rows.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED');
const pairOf = (state: SimState) => [state.session?.audioSource?.activeInputId ?? state.audio.activeInputId, state.audio.activeInputId];

describe('the MIC cards say which input is inside AUDIO-01 (ux §3.2 step 1; D105 "Active" / "Standby")', () => {
  it('MIC 1 Active with the gold glow, MIC 2 Standby without; the words are the store\'s pair', async () => {
    const h = await open();
    expect(chipText(1)).toBe('Active');
    expect(chipText(2)).toBe('Standby');
    expect(glowOf(1)).toBe(1);
    expect(glowOf(2)).toBe(0);
    expect(screen.getByTestId('monitor-mic-1').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('monitor-mic-2').props.accessibilityState).toMatchObject({ selected: false });
    expect(h.sim.store.getState().audio.activeInputId).toBe('MIC-01');
    expect(getMissingKeys()).toEqual([]);
  });

  it('both glow layers stay mounted through a switch: only their state changes (E-15)', async () => {
    const h = await open();
    const glow = (channel: 1 | 2) => screen.getByTestId(`monitor-mic-glow-${channel}`, { includeHiddenElements: true });
    expect(glow(1)).toBeTruthy();
    expect(glow(2)).toBeTruthy();
    act(() => h.sim.actions.switchAudioSource(MicInputId.MIC_02));
    expect(chipText(1)).toBe('Standby');
    expect(chipText(2)).toBe('Active');
    expect(glowOf(1)).toBe(0);
    expect(glowOf(2)).toBe(1);
    expect(glow(1)).toBeTruthy();
    expect(glow(2)).toBeTruthy();
  });
});

describe('the confirmed switch (ux §3.2 steps 2-4; G4; OD-09)', () => {
  it('the session holder: the toggle is offered, a press only opens the confirmation, Cancel sends nothing and writes no audit row', async () => {
    const h = await open();
    expect(isDisabled('monitor-mic-switch')).toBe(false);
    expect(within(screen.getByTestId('monitor-mic-switch')).getByText('Switch to MIC 2')).toBeTruthy();
    expect(screen.queryByTestId('monitor-mic-switch-reason')).toBeNull();
    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();

    fireEvent.press(screen.getByTestId('monitor-mic-switch'));
    const dialog = within(screen.getByTestId('monitor-mic-switch-dialog'));
    expect(dialog.getByText('Switch the active microphone to MIC 2?')).toBeTruthy();
    expect(dialog.getByText('Recording continues. MIC 1 becomes the standby microphone. The switch is written to the audit log.')).toBeTruthy();
    // The press alone changed nothing.
    expect(pairOf(h.sim.store.getState())).toEqual(['MIC-01', 'MIC-01']);
    expect(switches(h.sim.store.getState())).toHaveLength(0);

    fireEvent.press(screen.getByTestId('monitor-mic-switch-cancel'));
    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();
    expect(pairOf(h.sim.store.getState())).toEqual(['MIC-01', 'MIC-01']);
    expect(switches(h.sim.store.getState())).toHaveLength(0);
    expect(chipText(1)).toBe('Active');
  });

  it('confirm: one command, the cards follow the store, exactly one AUDIO_SOURCE_SWITCHED row; a second switch goes back', async () => {
    const h = await open();
    const sessionId = h.sim.store.getState().session!.id;
    fireEvent.press(screen.getByTestId('monitor-mic-switch'));
    fireEvent.press(screen.getByTestId('monitor-mic-switch-confirm'));

    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();
    const state = h.sim.store.getState();
    expect(pairOf(state)).toEqual(['MIC-02', 'MIC-02']);
    expect(state.session?.audioSource).toMatchObject({ sessionId, activeInputId: 'MIC-02', standbyInputId: 'MIC-01' });
    expect(state.session?.state).toBe('RECORDING');
    expect(chipText(1)).toBe('Standby');
    expect(chipText(2)).toBe('Active');
    expect(screen.queryAllByText('Active microphone: MIC 2').length).toBeGreaterThan(0);
    // The toggle now offers the way back.
    expect(within(screen.getByTestId('monitor-mic-switch')).getByText('Switch to MIC 1')).toBeTruthy();

    // What the CONTRACT names of the audit row (C3 §5.2): its type, its session, its actor — one row.
    const rows = switches(state);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'AUDIO_SOURCE_SWITCHED', sessionId, actorId: state.auth.operatorId });
    const details = rows[0]!.details as Readonly<Record<string, unknown>>;
    // The inputs, under the contract's keys or the simulator's present ones (D105: the contract wins).
    expect(details.fromInput ?? details.fromInputId).toBe('MIC-01');
    expect(details.toInput ?? details.toInputId).toBe('MIC-02');
    expect(Object.keys(details)).not.toContain('trigger');
    // Fix pass F-M5 (review R74-05; D105 "the contract wins"): the simulator writes the contract's keys
    // (C3 §5.2) with the media times. It wrote `deviceId` (the MICROPHONE's device), which the contract
    // does not name. `sendingDeviceId` (the paired device that sent a command, E-30) is added by the
    // Core for a command a device sent; the in-app simulator has no sending device and writes none.
    expect(Object.keys(details).sort()).toEqual(['fromInput', 'fromMs', 'toInput', 'toMs']);

    fireEvent.press(screen.getByTestId('monitor-mic-switch'));
    fireEvent.press(screen.getByTestId('monitor-mic-switch-confirm'));
    expect(pairOf(h.sim.store.getState())).toEqual(['MIC-01', 'MIC-01']);
    expect(switches(h.sim.store.getState())).toHaveLength(2);
    expect(chipText(1)).toBe('Active');
    expect(getMissingKeys()).toEqual([]);
  });

  it('a SUPERVISOR who did not open the session may switch', async () => {
    const h = await open({ operator: SUPERVISOR });
    expect(h.sim.store.getState().session?.createdBy).not.toBe(h.sim.store.getState().auth.operatorId);
    expect(isDisabled('monitor-mic-switch')).toBe(false);
    fireEvent.press(screen.getByTestId('monitor-mic-switch'));
    fireEvent.press(screen.getByTestId('monitor-mic-switch-confirm'));
    expect(pairOf(h.sim.store.getState())).toEqual(['MIC-02', 'MIC-02']);
    expect(switches(h.sim.store.getState())).toHaveLength(1);
  });

  it('a TECHNICIAN: the toggle is drawn, disabled, with the role sentence; a press does nothing', async () => {
    const h = await open({ operator: TECHNICIAN });
    expect(screen.getByTestId('monitor-mic-switch')).toBeTruthy();
    expect(isDisabled('monitor-mic-switch')).toBe(true);
    expect(within(screen.getByTestId('monitor-mic-switch-reason')).getByText(ROLE)).toBeTruthy();
    fireEvent.press(screen.getByTestId('monitor-mic-switch'));
    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();
    expect(switches(h.sim.store.getState())).toHaveLength(0);
    // The cards still say which input is active: reading is not gated.
    expect(chipText(1)).toBe('Active');
  });

  it('an INVESTIGATOR who did not open the session: disabled with the holder sentence (OD-09)', async () => {
    const h = await open();
    act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, createdBy: 'OPR-999' } })));
    expect(isDisabled('monitor-mic-switch')).toBe(true);
    expect(within(screen.getByTestId('monitor-mic-switch-reason')).getByText(HOLDER)).toBeTruthy();
    fireEvent.press(screen.getByTestId('monitor-mic-switch'));
    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();
    expect(switches(h.sim.store.getState())).toHaveLength(0);
  });

  it('the gate closing under an open confirmation closes it: nothing can be confirmed for a holder who no longer is one', async () => {
    const h = await open();
    fireEvent.press(screen.getByTestId('monitor-mic-switch'));
    expect(screen.getByTestId('monitor-mic-switch-dialog')).toBeTruthy();
    act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, createdBy: 'OPR-999' } })));
    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();
    expect(switches(h.sim.store.getState())).toHaveLength(0);
  });
});

describe('MIC_SILENT warns and never switches (ux §3.2 step 8, G5; OD-11; M5-WARN-1, the client half)', () => {
  it('the warning names the silent input; the active input and the audit log stay as they were, for as long as it shows', async () => {
    const h = await open();
    expect(screen.queryByTestId('monitor-mic-silent')).toBeNull();
    act(() => h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' }));
    const warning = within(screen.getByTestId('monitor-mic-silent'));
    expect(warning.getByText('MIC 1 is silent')).toBeTruthy();
    expect(warning.getByText('Below -50 dBFS for 10 s. Recording continues. The microphone is never switched automatically.')).toBeTruthy();

    // 30 s of the simulator's clock with the warning on screen: no switch, by anything.
    act(() => h.advance(30_000, 1_000));
    expect(screen.getByTestId('monitor-mic-silent')).toBeTruthy();
    expect(pairOf(h.sim.store.getState())).toEqual(['MIC-01', 'MIC-01']);
    expect(switches(h.sim.store.getState())).toHaveLength(0);
    expect(chipText(1)).toBe('Active');
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('"Switch to standby" opens the SAME confirmation and sends nothing by itself; the confirm switches', async () => {
    const h = await open();
    act(() => h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' }));
    fireEvent.press(screen.getByTestId('monitor-mic-silent-switch'));
    expect(within(screen.getByTestId('monitor-mic-switch-dialog')).getByText('Switch the active microphone to MIC 2?')).toBeTruthy();
    expect(switches(h.sim.store.getState())).toHaveLength(0);
    expect(pairOf(h.sim.store.getState())).toEqual(['MIC-01', 'MIC-01']);
    fireEvent.press(screen.getByTestId('monitor-mic-switch-confirm'));
    expect(pairOf(h.sim.store.getState())).toEqual(['MIC-02', 'MIC-02']);
    expect(switches(h.sim.store.getState())).toHaveLength(1);
  });

  it('a silent STANDBY input is named without the action; a TECHNICIAN sees the action disabled; the warning leaves when it is cleared', async () => {
    const h = await open({ operator: TECHNICIAN });
    act(() => h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' }));
    expect(isDisabled('monitor-mic-silent-switch')).toBe(true);
    fireEvent.press(screen.getByTestId('monitor-mic-silent-switch'));
    expect(screen.queryByTestId('monitor-mic-switch-dialog')).toBeNull();
    act(() => h.sim.actions.clearCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' }));
    expect(screen.queryByTestId('monitor-mic-silent')).toBeNull();

    act(() => h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-02' }));
    expect(within(screen.getByTestId('monitor-mic-silent')).getByText('MIC 2 is silent')).toBeTruthy();
    expect(screen.queryByTestId('monitor-mic-silent-switch')).toBeNull();
    expect(switches(h.sim.store.getState())).toHaveLength(0);
  });
});

describe('"Connecting cameras…" until the first durable fragment (D84, D91; ux §8 step 5, erratum PE-128-79)', () => {
  it('captureDurable false: no "Recording", no timer; the first durable fragment brings both', async () => {
    const h = await open();
    const root = () => within(screen.getByTestId('screen-session-live'));
    // The simulator has no such member: durable, as before.
    expect(root().getByText('Recording')).toBeTruthy();
    expect(screen.getByTestId('monitor-timer')).toBeTruthy();

    act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable: false } as typeof s.session })));
    expect(within(screen.getByTestId('monitor-rec-label')).getByText('Connecting cameras…')).toBeTruthy();
    expect(root().queryByText('Recording')).toBeNull();
    expect(screen.queryByTestId('monitor-timer')).toBeNull();
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');

    act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable: true } as typeof s.session })));
    expect(root().getByText('Recording')).toBeTruthy();
    expect(screen.getByTestId('monitor-timer')).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });

  it('tablet landscape draws the same two states in its timer card', async () => {
    const h = await open({ window: 'tabletLandscape' });
    expect(screen.getByTestId('monitor-timer')).toBeTruthy();
    act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable: false } as typeof s.session })));
    expect(within(screen.getByTestId('monitor-rec-label')).getByText('Connecting cameras…')).toBeTruthy();
    expect(screen.queryByTestId('monitor-timer')).toBeNull();
    // The mic switch is mounted once in this arrangement too.
    expect(screen.getAllByTestId('monitor-mic-source')).toHaveLength(1);
  });
});

describe('the panel alone: the states a signed-in monitor cannot hold still (E-16, P-13, LB-1)', () => {
  const base: MicSourcePanelProps = {
    recording: true,
    activeInputId: MicInputId.MIC_01,
    standbyInputId: MicInputId.MIC_02,
    block: null,
    silentInputId: null,
    confirmOpen: false,
    busy: false,
    pending: false,
    refusal: null,
    onAsk: () => undefined,
    onCancel: () => undefined,
    onConfirm: () => undefined,
  };
  const draw = (props: Partial<MicSourcePanelProps>) => {
    const test = createTestSim();
    return render(
      <RuntimeTestProviders sim={test.sim}>
        <MicSourcePanel {...base} {...props} />
      </RuntimeTestProviders>,
    );
  };

  it('an unknown role: the toggle is drawn, disabled, with "Checking your permissions…" — never hidden, never enabled', () => {
    draw({ block: { kind: 'CHECKING' } });
    expect(isDisabled('monitor-mic-switch')).toBe(true);
    expect(within(screen.getByTestId('monitor-mic-switch-reason')).getByText(CHECKING)).toBeTruthy();
    expect(screen.getByTestId('monitor-mic-switch').props.accessibilityHint).toBe(CHECKING);
  });

  it('a lost Core link: disabled with the monitor\'s read-only sentence', () => {
    draw({ block: { kind: 'WAITING' } });
    expect(isDisabled('monitor-mic-switch')).toBe(true);
    expect(within(screen.getByTestId('monitor-mic-switch-reason')).getByText('Session actions are paused until the Core link is back.')).toBeTruthy();
  });

  it('no recording: the toggle is not drawn, its reason is (ux §3.5 hidden-with-reason)', () => {
    draw({ recording: false, block: { kind: 'NOT_RECORDING' } });
    expect(screen.queryByTestId('monitor-mic-switch')).toBeNull();
    expect(within(screen.getByTestId('monitor-mic-switch-reason')).getByText('The microphone can be switched while a session is recording.')).toBeTruthy();
  });

  it('the command is out: the confirm is busy, shows the spinner late, and Cancel is disabled', () => {
    draw({ confirmOpen: true, busy: true, pending: false });
    expect(screen.getByTestId('monitor-mic-switch-confirm').props.accessibilityState).toMatchObject({ busy: true });
    expect(isDisabled('monitor-mic-switch-cancel')).toBe(true);
    expect(screen.queryByTestId('monitor-mic-switch-confirm-spinner')).toBeNull();
  });

  it('each refusal that stays on the cards has its fixed sentence (ux §3.5)', () => {
    const view = draw({ refusal: 'CONFLICT' });
    expect(within(screen.getByTestId('monitor-mic-switch-refusal')).getByText('The requested microphone cannot become the active source.')).toBeTruthy();
    view.rerender(
      <RuntimeTestProviders sim={createTestSim().sim}>
        <MicSourcePanel {...base} refusal="NOT_OPEN" />
      </RuntimeTestProviders>,
    );
    expect(within(screen.getByTestId('monitor-mic-switch-refusal')).getByText('That session is not the open session.')).toBeTruthy();
  });
});

// Integration pass D5 (ruling D137): the input behind a meter channel is the microphone line at its
// position in the capture configuration, not the fixed table of the built-in pair.
describe('a replaced pair, MIC-03 / MIC-01 (ruling D137)', () => {
  it('card 2 is the second line: its meter reads MIC-01 and it says Active while MIC-01 records; card 1 (MIC-03) says Standby', async () => {
    const h = renderMonitorApp({ window: 'phonePortrait' });
    await settle();
    act(() => {
      const state = h.sim.store.getState();
      const pair = ['MIC-03', 'MIC-01'];
      const lines = state.captureConfig.mics.slice(0, 2).map((line, index) => ({ ...line, inputId: pair[index]! }));
      const frame = state.audio.inputs['MIC-01']!;
      h.sim.store.setState({
        captureConfig: { ...state.captureConfig, mics: lines },
        session:
          state.session === null
            ? null
            : {
                ...state.session,
                captureConfig: state.session.captureConfig ? { ...state.session.captureConfig, mics: lines } : state.session.captureConfig,
                audioSource: { ...state.session.audioSource, activeInputId: 'MIC-01', standbyInputId: 'MIC-03' },
              },
        audio: {
          ...state.audio,
          activeInputId: 'MIC-01',
          inputs: {
            ...state.audio.inputs,
            'MIC-03': { ...frame, dbfs: -20, peak: -18, noSignal: false, clip: false },
            'MIC-01': { ...frame, dbfs: -30, peak: -28, noSignal: false, clip: false },
            // NEGATIVE CONTROL: the fixed table would read this frame for card 2, and call card 1 Active.
            'MIC-02': { ...frame, dbfs: -120, peak: -120, noSignal: true, clip: false },
          },
        },
      } as never);
    });
    h.openMonitor();
    expect(screen.getByTestId('screen-session-live')).toBeTruthy();
    expect(chipText(1)).toBe('Standby');
    expect(chipText(2)).toBe('Active');
    expect(glowOf(1)).toBe(0);
    expect(glowOf(2)).toBe(1);
    expect(screen.getByTestId('monitor-meter-1').props.accessibilityValue).toMatchObject({ now: -20 });
    expect(screen.getByTestId('monitor-meter-2').props.accessibilityValue).toMatchObject({ now: -30 });
    expect(silentInputOf([{ kind: 'MIC_SILENT', target: 'AUDIO-02' }] as never, 'MIC-03', [{ inputId: 'MIC-03' }, { inputId: 'MIC-01' }])).toBe('MIC-01');
    expect(inputOfChannel('AUDIO-02')).toBe('MIC-02');
  });
});

// Fix wave J round two (JA2-06): the ACTIVE microphone without a signal was easy to miss on the monitor - only its
// small meter said so. The fault is stated above the switch, by name, with the same confirmed switch.
describe('JA2-06: a microphone the Core reports without a signal is said on the monitor', () => {
  it('the active input: a danger notice names it, offers "Switch to MIC 2" through the SAME confirmation, and sends nothing by itself', async () => {
    const h = await open();
    expect(screen.queryByTestId('monitor-mic-no-signal')).toBeNull();
    act(() => {
      h.sim.actions.inject('MIC_NO_SIGNAL');
    });
    const notice = within(screen.getByTestId('monitor-mic-no-signal'));
    expect(notice.getByText('MIC 1: no signal')).toBeTruthy();
    expect(notice.getByText(/The active microphone delivers no audio\./)).toBeTruthy();
    expect(switches(h.sim.store.getState())).toHaveLength(0);
    fireEvent.press(screen.getByTestId('monitor-mic-no-signal-switch'));
    expect(within(screen.getByTestId('monitor-mic-switch-dialog')).getByText('Switch the active microphone to MIC 2?')).toBeTruthy();
    expect(switches(h.sim.store.getState())).toHaveLength(0);
    fireEvent.press(screen.getByTestId('monitor-mic-switch-confirm'));
    expect(switches(h.sim.store.getState())).toHaveLength(1);
    expect(getMissingKeys()).toEqual([]);
  });

  it('CONTROL - no such fault, no notice; the presentation alone: a standby input without a signal offers no switch', () => {
    const props: MicSourcePanelProps = {
      recording: true,
      activeInputId: MicInputId.MIC_01,
      standbyInputId: MicInputId.MIC_02,
      block: null,
      silentInputId: null,
      noSignalInputId: MicInputId.MIC_02,
      confirmOpen: false,
      busy: false,
      pending: false,
      refusal: null,
      onAsk: () => undefined,
      onCancel: () => undefined,
      onConfirm: () => undefined,
    };
    const test = createTestSim();
    const view = render(
      <RuntimeTestProviders sim={test.sim}>
        <MicSourcePanel {...props} />
      </RuntimeTestProviders>,
    );
    expect(within(screen.getByTestId('monitor-mic-no-signal')).getByText('MIC 2: no signal')).toBeTruthy();
    expect(screen.queryByTestId('monitor-mic-no-signal-switch')).toBeNull();
    view.rerender(
      <RuntimeTestProviders sim={test.sim}>
        <MicSourcePanel {...props} noSignalInputId={null} />
      </RuntimeTestProviders>,
    );
    expect(screen.queryByTestId('monitor-mic-no-signal')).toBeNull();
  });
});
