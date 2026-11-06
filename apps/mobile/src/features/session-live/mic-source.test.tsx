// Task 3 M5, blueprint row 73 (register MB-03; ux spec §3 flow 2; specs R-3 AC-2..4; D4 OD-11; D84 / D91
// "Connecting cameras…"). The mic cards and the microphone warnings of the Session Live monitor, on the REAL
// `/session/live` route over a test simulator in the recording scenario (session 0024, opened by the
// investigator AKP Budi Santoso).
//
// Audit row 185 (M3-05; D5, D134, D136, D138; register O4-O6 of masterplan/01_specs_m3.md): operation 81 is
// RETIRED. What is held: no element offers a switch for any role or state; `actions.switchAudioSource` is never
// called (spy count 0) and no AUDIO_SOURCE_SWITCHED row is written; the silence warning shows the D5 sentence
// (O5) and no button; the no-signal notice offers no switch; CONTROL - the in-app simulator itself refuses op 81
// with AUDIO_SOURCE_FIXED_BY_PAIRING. The switch-era cases (the confirmed switch, the gate and its reasons, the
// refusal sentences, the busy confirmation; I63 §4.4 `mic-source.test.tsx:86-150`) were deleted with the
// control. The cards name their pair slot (rows 209/210) and, since row 211 (D191), the gold outline marks Pair 1,
// the transcribed pair, as the web Session monitor - not the input inside AUDIO-01.
// The Live twin is `live-mic-source.test.tsx`.
//
// Import order matters: the gorhom mock, then the router harness.
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, within } from '@testing-library/react-native';
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
async function open(options: MonitorHarnessOptions = {}): Promise<MonitorHarness> {
  const h = renderMonitorApp({ window: 'phonePortrait', ...options });
  await settle();
  h.openMonitor();
  expect(screen.getByTestId('screen-session-live')).toBeTruthy();
  return h;
}

// D61 (2026-11-04): the cards are keyed by CHANNEL (`MIC-0N`), not by number.
/** The role words the cards showed before row 210 (`session.audioSource.role.*`: "Channel 1 (transcribed)" / "Channel 2 (recorded)"), and the bare words. */
const ROLE_WORDS = /^(Channel [1-4] \((transcribed|recorded)\)|Active|Standby)$/;
// RE-PINNED by row 210 (M3-17; register A3; D138 R157-1, D134): the card shows its pair slot "Mic N (Camera N)"
// (Pair 1 also "Transcribed") and NO role word. It read the chip words "Channel 1 (transcribed)" -> 'Active',
// "Channel 2 (recorded)" -> 'Standby', none -> null. RE-PINNED by row 211 (M3-18; D191, D5): the gold outline no
// longer follows the store's active input; it marks Pair 1, the transcribed pair, as the web Session monitor
// (`data-transcribed`), and the card reports no `accessibilityState.selected`. The helper reads that mark:
// 'Transcribed' (the chip, with the gold glow) or null (neither).
const markOf = (channel: 1 | 2 | 3 | 4) => {
  const card = within(screen.getByTestId(`monitor-mic-MIC-0${channel}`));
  expect(card.queryAllByText(ROLE_WORDS, { includeHiddenElements: true })).toHaveLength(0);
  expect(card.getByTestId(`mic-card-pair-AUDIO-0${channel}`)).toHaveTextContent(`Mic ${channel} (Camera ${channel})`);
  expect(screen.getByTestId(`monitor-mic-MIC-0${channel}`).props.accessibilityState?.selected).toBeUndefined();
  const chip = card.queryByTestId(`mic-card-transcribed-AUDIO-0${channel}`);
  expect(glowOf(channel)).toBe(chip === null ? 0 : 1);
  return chip === null ? null : 'Transcribed';
};
const glowOf = (channel: 1 | 2 | 3 | 4) => (StyleSheet.flatten(screen.getByTestId(`monitor-mic-glow-MIC-0${channel}`, { includeHiddenElements: true }).props.style) as { opacity?: number }).opacity;
/** Register O5 (D138): the shared `session.audioSource.silent.body` with the app's thresholds (-50 dBFS, 10 s). */
const O5 = 'Below -50 dBFS for 10 s. Recording continues. The microphone of each pair is fixed by setup: check its cable or the device.';
/** Every testID the retired switch drew (task 3 M5 and task 4 row 170). */
const SWITCH_IDS = [
  'monitor-mic-switch',
  'monitor-mic-switch-dialog',
  'monitor-mic-switch-confirm',
  'monitor-mic-switch-cancel',
  'monitor-mic-switch-reason',
  'monitor-mic-switch-refusal',
  'monitor-mic-switch-no-pair',
  'monitor-mic-silent-switch',
  'monitor-mic-no-signal-switch',
] as const;
/** Row 185 (register O4): no element offers a switch - none of the retired testIDs, no "Switch to ..." text (E1), no switch sentence. */
function expectNoSwitchOffered(): void {
  for (const id of SWITCH_IDS) expect(screen.queryByTestId(id, { includeHiddenElements: true })).toBeNull();
  expect(screen.queryAllByText(/^Switch to/, { includeHiddenElements: true })).toHaveLength(0);
  expect(screen.queryAllByText(/Switch microphone|can be switched|nothing to switch|was not switched/, { includeHiddenElements: true })).toHaveLength(0);
}
const switches = (state: SimState) => state.audit.rows.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED');
const pairOf = (state: SimState) => [state.session?.audioSource?.activeInputId ?? state.audio.activeInputId, state.audio.activeInputId];

// RE-PINNED by row 211 (M3-18; D191): was 'the MIC cards say which input is inside AUDIO-01 (ux §3.2 step 1; D105 "Active" / "Standby")'.
describe('the MIC cards mark Pair 1, the transcribed pair, with the gold outline, as the web Session monitor (D191, D5)', () => {
  it('Pair 1 (Mic 1) is outlined in gold beside its "Transcribed" chip, Pair 2 is not; no card reports a selection', async () => {
    const h = await open();
    expect(markOf(1)).toBe('Transcribed');
    expect(markOf(2)).toBeNull();
    expect(glowOf(1)).toBe(1);
    expect(glowOf(2)).toBe(0);
    // RE-PINNED by row 211 (M3-18; D191): was accessibilityState { selected: true } / { selected: false } - the web sets no selection either.
    for (const n of [1, 2, 3, 4] as const) expect(screen.getByTestId(`monitor-mic-MIC-0${n}`).props.accessibilityState?.selected).toBeUndefined();
    expect(h.sim.store.getState().audio.activeInputId).toBe('MIC-01');
    expect(getMissingKeys()).toEqual([]);
  });

  it('both glow layers stay mounted when the store\'s active input changes, and the outline stays on Pair 1 (E-15; D191: fixed by pairing)', async () => {
    const h = await open();
    const glow = (channel: 1 | 2 | 3 | 4) => screen.getByTestId(`monitor-mic-glow-MIC-0${channel}`, { includeHiddenElements: true });
    expect(glow(1)).toBeTruthy();
    expect(glow(2)).toBeTruthy();
    // MOVED by row 185 (M3-05; D136): op 81 is retired, so no switch moves the pair - the store's statement does
    // (in LIVE, a Core delta). The cards follow the store, as before.
    act(() =>
      h.sim.store.setState(
        (s) =>
          ({
            session: { ...s.session!, audioSource: { ...(s.session!.audioSource ?? {}), sessionId: s.session!.id, activeInputId: 'MIC-02', standbyInputId: 'MIC-01' } },
            audio: { ...s.audio, activeInputId: 'MIC-02' },
          }) as never,
      ),
    );
    // RE-PINNED by row 211 (M3-18; D191): was card 1 unmarked (glow 0) and card 2 'Active' (glow 1) - the mark followed the store's input.
    expect(markOf(1)).toBe('Transcribed');
    expect(markOf(2)).toBeNull();
    expect(glowOf(1)).toBe(1);
    expect(glowOf(2)).toBe(0);
    expect(glow(1)).toBeTruthy();
    expect(glow(2)).toBeTruthy();
  });
});

describe('row 185 (M3-05 R1; register O4; D134, D136): op 81 is retired - no element offers a switch, for any role or state', () => {
  it.each([
    ['the session holder (INVESTIGATOR)', undefined],
    ['a SUPERVISOR who did not open the session', SUPERVISOR],
    ['a TECHNICIAN', TECHNICIAN],
  ] satisfies [string, string | undefined][])('%s: recording, connecting, another holder, a silent input, an input without a signal - nothing offers a switch; switchAudioSource is never called', async (_name, operator) => {
    const h = await open(operator === undefined ? {} : { operator });
    const spy = jest.spyOn(h.sim.actions, 'switchAudioSource');
    expectNoSwitchOffered();
    // "Connecting cameras…" (D84): the same.
    act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable: false } as typeof s.session })));
    expectNoSwitchOffered();
    act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable: true } as typeof s.session })));
    // Another operator opened the session (OD-09 gated the toggle; nothing is gated now, nothing is offered).
    act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, createdBy: 'OPR-999' } })));
    expectNoSwitchOffered();
    // A silent input for 30 s of the simulator's clock: a warning only.
    act(() => h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' }));
    expect(screen.getByTestId('monitor-mic-silent')).toBeTruthy();
    expectNoSwitchOffered();
    act(() => h.advance(30_000, 1_000));
    act(() => h.sim.actions.clearCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' }));
    // An input without a signal: a notice only.
    act(() => {
      h.sim.actions.inject('MIC_NO_SIGNAL');
    });
    expect(screen.getByTestId('monitor-mic-no-signal')).toBeTruthy();
    expectNoSwitchOffered();

    expect(spy).toHaveBeenCalledTimes(0);
    expect(switches(h.sim.store.getState())).toHaveLength(0);
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
    expect(getMissingKeys()).toEqual([]);
    spy.mockRestore();
  });

  it('CONTROL - the in-app simulator itself refuses op 81 with AUDIO_SOURCE_FIXED_BY_PAIRING (shared behaviour, read-only): nothing moves, no row', async () => {
    const h = await open();
    let thrown: unknown = null;
    try {
      h.sim.actions.switchAudioSource(MicInputId.MIC_02);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ code: 'AUDIO_SOURCE_FIXED_BY_PAIRING' });
    expect(pairOf(h.sim.store.getState())).toEqual(['MIC-01', 'MIC-01']);
    expect(switches(h.sim.store.getState())).toHaveLength(0);
    expect(markOf(1)).toBe('Transcribed'); // RE-PINNED by row 211 (D191): was 'Active' - the outline marks Pair 1
  });
});

describe('MIC_SILENT warns and never switches (ux §3.2 step 8; OD-11; M5-WARN-1, the client half; row 185: O5, no button)', () => {
  it('the warning names the silent input with the D5 sentence and no button; the active input and the audit log stay as they were, for as long as it shows', async () => {
    const h = await open();
    expect(screen.queryByTestId('monitor-mic-silent')).toBeNull();
    act(() => h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' }));
    const warning = within(screen.getByTestId('monitor-mic-silent'));
    expect(warning.getByText('MIC 1 is silent')).toBeTruthy();
    // RE-PINNED by row 185 (M3-05 R4; D138; I63 §4.4 `mic-source.test.tsx:198`): register O5. It was
    // "Below -50 dBFS for 10 s. Recording continues. The microphone is never switched automatically."
    expect(warning.getByText(O5)).toBeTruthy();
    expect(warning.queryAllByRole('button')).toHaveLength(0);
    expect(warning.queryByText('Switch to channel 2')).toBeNull();

    // 30 s of the simulator's clock with the warning on screen: no switch, by anything.
    act(() => h.advance(30_000, 1_000));
    expect(screen.getByTestId('monitor-mic-silent')).toBeTruthy();
    expect(pairOf(h.sim.store.getState())).toEqual(['MIC-01', 'MIC-01']);
    expect(switches(h.sim.store.getState())).toHaveLength(0);
    expect(markOf(1)).toBe('Transcribed'); // RE-PINNED by row 211 (D191): was 'Active' - the outline marks Pair 1
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('a silent input of either channel, for a TECHNICIAN too: named with O5, no button; the warning leaves when it is cleared', async () => {
    const h = await open({ operator: TECHNICIAN });
    for (const [input, name] of [
      ['MIC-01', 'MIC 1'],
      ['MIC-02', 'MIC 2'],
    ] as const) {
      act(() => h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: input }));
      const warning = within(screen.getByTestId('monitor-mic-silent'));
      expect(warning.getByText(`${name} is silent`)).toBeTruthy();
      expect(warning.getByText(O5)).toBeTruthy();
      expect(warning.queryAllByRole('button')).toHaveLength(0);
      expectNoSwitchOffered();
      act(() => h.sim.actions.clearCaptureWarning({ code: 'MIC_SILENT', subject: input }));
      expect(screen.queryByTestId('monitor-mic-silent')).toBeNull();
    }
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
    // The microphone warnings are mounted once in this arrangement too (row 185: they hold no switch).
    expect(screen.getAllByTestId('monitor-mic-source')).toHaveLength(1);
  });
});

describe('the panel alone (row 185): the warnings name their input and offer nothing, whatever the pair', () => {
  const draw = (props: MicSourcePanelProps) => {
    const test = createTestSim();
    return render(
      <RuntimeTestProviders sim={test.sim}>
        <MicSourcePanel {...props} />
      </RuntimeTestProviders>,
    );
  };

  it('nothing silent: the container only - no warning, no switch control, no pair sentence', () => {
    draw({ activeInputId: MicInputId.MIC_01, silentInputId: null });
    expect(screen.getByTestId('monitor-mic-source')).toBeTruthy();
    expect(screen.queryByTestId('monitor-mic-silent')).toBeNull();
    expect(screen.queryByTestId('monitor-mic-no-signal')).toBeNull();
    expectNoSwitchOffered();
  });

  it.each([
    ['the transcribed input', MicInputId.MIC_01, MicInputId.MIC_01],
    ['another input', MicInputId.MIC_01, MicInputId.MIC_02],
    ['with no transcribed input (task 4 row 170: an absent pair member)', null, MicInputId.MIC_01],
  ] satisfies [string, string | null, string][])('silent, %s: named, the O5 sentence, no button', (_name, activeInputId, silentInputId) => {
    draw({ activeInputId, silentInputId });
    expect(within(screen.getByTestId('monitor-mic-silent')).getByText(O5)).toBeTruthy();
    expect(within(screen.getByTestId('monitor-mic-silent')).queryAllByRole('button')).toHaveLength(0);
    expectNoSwitchOffered();
    expect(getMissingKeys()).toEqual([]);
  });
});

// Integration pass D5 (ruling D137): the input behind a meter channel is the microphone line at its
// position in the capture configuration, not the fixed table of the built-in pair.
describe('a replaced pair, MIC-03 / MIC-01 (ruling D137)', () => {
  // RE-PINNED by row 211 (D191): was "... and it says Active while MIC-01 records; card 1 (MIC-03) says Standby".
  it('card 2 is the second line: its meter reads MIC-01 while MIC-01 records; the gold outline stays on card 1 (MIC-03), Pair 1', async () => {
    const h = renderMonitorApp({ window: 'phonePortrait' });
    await settle();
    act(() => {
      const state = h.sim.store.getState();
      // D61 (2026-11-04): FOUR lines - the pair swaps and channels 3/4 move off the table's ids.
      const pair = ['MIC-03', 'MIC-01', 'MIC-04', 'MIC-02'];
      const lines = state.captureConfig.mics.map((line, index) => ({ ...line, inputId: pair[index] ?? line.inputId }));
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
    // RE-PINNED by row 211 (M3-18; D191): was card 1 unmarked (glow 0) and card 2 'Active' (glow 1).
    expect(markOf(1)).toBe('Transcribed');
    expect(markOf(2)).toBeNull();
    expect(glowOf(1)).toBe(1);
    expect(glowOf(2)).toBe(0);
    expect(screen.getByTestId('monitor-meter-MIC-01').props.accessibilityValue).toMatchObject({ now: -20 });
    expect(screen.getByTestId('monitor-meter-MIC-02').props.accessibilityValue).toMatchObject({ now: -30 });
    expect(silentInputOf([{ kind: 'MIC_SILENT', target: 'AUDIO-02' }] as never, 'MIC-03', [{ inputId: 'MIC-03', channel: 'MIC-01' }, { inputId: 'MIC-01', channel: 'MIC-02' }])).toBe('MIC-01'); // D61: the line states its channel
    // MOVED by task 4 row 170 (was `inputOfChannel('AUDIO-02')` = `'MIC-02'`, "without lines, the built-in pair"):
    // without lines a channel has no input.
    expect(inputOfChannel('AUDIO-02', [])).toBeNull();
  });
});

// Task 4 row 170 (site M4; decision C18 (2)): the card and the hook find an input by the lookup of row 164.
describe('task 4 row 170: a microphone line is ABSENT - the cards and the switch say so, and name no built-in input', () => {
  /** D61 (2026-11-04): the recording monitor with only the named CHANNEL lines left in the selector the session records under, and no pair stated by the session. */
  async function openWithLines(channels: readonly string[], window: MonitorHarnessOptions['window'] = 'phonePortrait') {
    const h = renderMonitorApp({ window });
    await settle();
    act(() => {
      const state = h.sim.store.getState();
      const lines = state.captureConfig.mics.filter((line) => channels.includes(line.channel));
      h.sim.store.setState({
        captureConfig: { ...state.captureConfig, mics: lines },
        // D61 (2026-11-04): the pair is stated by nobody - the meters' member goes with it (E41: an
        // open session that states no pair reads the meters; with no input active, nothing is a role).
        audio: { ...state.audio, activeInputId: null },
        session:
          state.session === null
            ? null
            : { ...state.session, captureConfig: state.session.captureConfig ? { ...state.session.captureConfig, mics: lines } : state.session.captureConfig, audioSource: null },
      } as never);
    });
    h.openMonitor();
    expect(screen.getByTestId('screen-session-live')).toBeTruthy();
    return h;
  }

  it.each(['phonePortrait', 'tabletLandscape'] as const)('%s, a lone channel-2 line: the other channels read "No microphone input", the held one says no role and draws no badge; no switch control and no pair sentence (D61; row 185)', async (window) => {
    const h = await openWithLines(['MIC-02'], window);
    // The meters slice still holds frames under the built-in inputs: the cards do not read them.
    expect(Object.keys(h.sim.store.getState().audio.inputs)).toEqual(expect.arrayContaining(['MIC-01', 'MIC-02']));
    // D61: the held channel HAS its input (a line names it) - but with no active input it says no role.
    expect(screen.getByTestId('monitor-mic-level-state-MIC-02')).not.toHaveTextContent('No microphone input');
    expect(markOf(2)).toBeNull();
    for (const channel of [1, 3, 4] as const) {
      expect(screen.getByTestId(`monitor-mic-level-state-MIC-0${channel}`)).toHaveTextContent('No microphone input');
      // RE-PINNED by row 211 (M3-18; D191): was null / glow 0 on all three - Pair 1 keeps its outline with or without an input (the slot is fixed, D5).
      expect(markOf(channel)).toBe(channel === 1 ? 'Transcribed' : null);
      expect(screen.queryByTestId(`monitor-mic-role-MIC-0${channel}`)).toBeNull();
      expect(screen.queryByTestId(`monitor-mic-source-MIC-0${channel}`)).toBeNull();
      expect(glowOf(channel)).toBe(channel === 1 ? 1 : 0);
    }
    // MOVED by row 185 (M3-05; D136): the incomplete-pair sentence went with the toggle - there is no switch to explain.
    expectNoSwitchOffered();
    expect(switches(h.sim.store.getState())).toHaveLength(0);
    expect(getMissingKeys()).toEqual([]);
  });

  it('no microphone line at all: the same four cards, and nothing is sent (D61)', async () => {
    const h = await openWithLines([]);
    for (const channel of [1, 2, 3, 4] as const) expect(screen.getByTestId(`monitor-mic-level-state-MIC-0${channel}`)).toHaveTextContent('No microphone input');
    expectNoSwitchOffered(); // MOVED by row 185 (D136): no pair sentence either
    expect(switches(h.sim.store.getState())).toHaveLength(0);
  });

  it('CONTROL - the seeded four-channel selector: the cards read their inputs (D61); row 185: a complete pair offers no toggle either', async () => {
    await open();
    for (const channel of [1, 2, 3, 4] as const) expect(screen.getByTestId(`monitor-mic-level-state-MIC-0${channel}`)).not.toHaveTextContent('No microphone input');
    expectNoSwitchOffered(); // MOVED by row 185 (D136): was "the toggle is offered"
  });
});

// Fix wave J round two (JA2-06): the ACTIVE microphone without a signal was easy to miss on the monitor - only its
// small meter said so. The fault is stated on the monitor, by name. Row 185 (M3-05; D136, D138): it offers no switch.
describe('JA2-06: a microphone the Core reports without a signal is said on the monitor (row 185: no switch)', () => {
  it('the active input: a notice names it, says the pair is fixed by setup, offers no switch and sends nothing', async () => {
    const h = await open();
    const spy = jest.spyOn(h.sim.actions, 'switchAudioSource');
    expect(screen.queryByTestId('monitor-mic-no-signal')).toBeNull();
    act(() => {
      h.sim.actions.inject('MIC_NO_SIGNAL');
    });
    const notice = within(screen.getByTestId('monitor-mic-no-signal'));
    expect(notice.getByText('MIC 1: no signal')).toBeTruthy();
    // MOVED by row 185 (D138): the body no longer ends "... until the signal returns or you switch."
    expect(notice.getByText('The transcribed microphone delivers no audio. The recording continues without sound from it until the signal returns. The microphone of each pair is fixed by setup: check its cable or the device.')).toBeTruthy();
    expect(notice.queryAllByRole('button')).toHaveLength(0);
    expectNoSwitchOffered();
    expect(spy).toHaveBeenCalledTimes(0);
    expect(switches(h.sim.store.getState())).toHaveLength(0);
    expect(getMissingKeys()).toEqual([]);
    spy.mockRestore();
  });

  it('CONTROL - no such fault, no notice; the presentation alone: another input without a signal is named, and offers no switch either', () => {
    const props: MicSourcePanelProps = { activeInputId: MicInputId.MIC_01, silentInputId: null, noSignalInputId: MicInputId.MIC_02 };
    const test = createTestSim();
    const view = render(
      <RuntimeTestProviders sim={test.sim}>
        <MicSourcePanel {...props} />
      </RuntimeTestProviders>,
    );
    const notice = within(screen.getByTestId('monitor-mic-no-signal'));
    expect(notice.getByText('MIC 2: no signal')).toBeTruthy();
    expect(notice.getByText('This microphone channel records beside the transcribed one, which is not affected.')).toBeTruthy();
    expectNoSwitchOffered();
    view.rerender(
      <RuntimeTestProviders sim={test.sim}>
        <MicSourcePanel {...props} noSignalInputId={null} />
      </RuntimeTestProviders>,
    );
    expect(screen.queryByTestId('monitor-mic-no-signal')).toBeNull();
  });
});
