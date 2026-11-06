// Fix 157 (fix wave L) - the same class as G70c-01, another member: `session.audioSource`, the active /
// standby microphone pair. The `session` slice keeps the LAST session after its seal, with the pair that
// session ended on; readers that took it whatever the session's state named the OLD inputs after the
// selector's microphones were changed.
//
// Rule (ONE helper, `audioPairInForce` of `@dems/shared/sim`, through the app's door
// `capture-selector/selector-in-force.ts`): the session's own pair only while that session is OPEN;
// otherwise the pair the current selector gives (channel 1 = active, channel 2 = standby; D61: the roles became the numbered channels).
//
// Order of the defect: the session recorded MIC-01 / MIC-02 and was switched to MIC-02 (pair: active
// MIC-02, standby MIC-01); it is SEALED; THEN the selector's first line becomes MIC-05 (D61, 2026-11-04: MIC-03/MIC-04 are built-ins of the four-channel plane; a changed line names an adopted microphone). The control is the
// same state with the session still RECORDING.
//
// The pair is held on the hook every mobile screen reads (`useMicSource`; row 226 removed `useMicSourceRole`, D207), drawn by a
// probe with the app's own microphone name. RE-PINNED by row 210 (M3-17; register A3; D138 R157-1, D134):
// the Session Live mic cards draw NO role word any more (the Active / Standby chips, `session.audioSource.role.*`,
// are gone, and op 81's toggle went with row 185, D177); a card names its pair slot "Mic N (Camera N)" and Pair 1
// adds "Transcribed", whatever the pair the hook states. RE-PINNED by row 211 (M3-18; D191, D5): the gold outline
// no longer follows the role the hook states; it marks Pair 1, the transcribed pair, as the web Session monitor,
// and the card reports no `accessibilityState.selected`. The last describe pins that on the real `MicCard`.
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { SimState } from '@dems/shared/sim';
import { useMicInputName } from '@/features/capture-selector/development-source-badge';
import { i18n } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { RuntimeTestProviders, createTestSim } from '@/runtime/testing/test-sim';
import { MicCard } from './mic-card';
import { selectActiveInputId, selectStandbyInputId } from './mic-source-model';
import { useMonitorMics } from './use-monitor';
import { useMicSource } from './use-mic-source';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);

afterEach(() => resetMotionStateForTests());

type Session = NonNullable<SimState['session']>;
const PAIR = { activeInputId: 'MIC-02', standbyInputId: 'MIC-01', switchedAt: 5_000, intervalFromMs: 4_000 };

/** The recording scenario, switched to MIC-02; then (`sealed`) sealed; then the first microphone line changed to MIC-05 (D61: the adopted id). */
function afterMicrophoneChange(base: SimState, sealed: boolean): Partial<SimState> {
  const session = base.session as Session;
  const snapshot = { cameras: base.captureConfig.cameras, mics: base.captureConfig.mics, revision: 2, updatedAt: base.captureConfig.updatedAt };
  const held = { ...session, captureConfig: snapshot, audioSource: { ...PAIR, sessionId: session.id } } as unknown as Session;
  return {
    captureConfig: {
      ...base.captureConfig,
      mics: base.captureConfig.mics.map((line, index) => (index === 0 ? { ...line, inputId: 'MIC-05', deviceId: 'MIC-05' } : line)), // D61: MIC-05 mints above the four built-ins
      updatedAt: base.captureConfig.updatedAt + 60_000,
    } as SimState['captureConfig'],
    session: sealed ? ({ ...held, state: 'SEALED' } as unknown as Session) : held,
  };
}

function Probe() {
  const view = useMicSource();
  const micName = useMicInputName();
  return (
    <>
      <Text testID="pair-active">{`${view.activeInputId}|${view.activeInputId === null ? '' : micName(view.activeInputId)}`}</Text>
      <Text testID="pair-standby">{`${view.standbyInputId}|${view.standbyInputId === null ? '' : micName(view.standbyInputId)}`}</Text>
    </>
  );
}

/** Row 210: the four real Session Live mic cards, as the screen mounts them (`session-live-screen.tsx`). */
function Cards() {
  const mics = useMonitorMics();
  return (
    <View>
      {mics.map((mic) => (
        <MicCard key={mic.id} mic={mic} variant="card" paused monitoringPaused={false} onClipReset={() => undefined} />
      ))}
    </View>
  );
}

function draw(sealed: boolean, withCards = false): SimState {
  const test = createTestSim({ scenario: 'recording' });
  test.sim.store.setState(afterMicrophoneChange(test.sim.store.getState(), sealed));
  render(
    <RuntimeTestProviders sim={test.sim}>
      <Probe />
      {withCards ? <Cards /> : null}
    </RuntimeTestProviders>,
  );
  return test.sim.store.getState();
}
const textOf = (testID: string): string => String(screen.getByTestId(testID).props.children);

describe('fix 157 - the pair a mobile screen names after a sealed session and a microphone change', () => {
  it('SEALED: the pair is the current selector\'s - the NEW microphone MIC-05 holds channel 1, MIC-02 channel 2; the sealed session\'s MIC-01 is named nowhere (D61)', () => {
    const state = draw(true);
    // The slice still HOLDS the old pair - that is the state the defect needs.
    expect(state.session?.state).toBe('SEALED');
    expect((state.session as unknown as { audioSource: typeof PAIR }).audioSource).toMatchObject({ activeInputId: 'MIC-02', standbyInputId: 'MIC-01' });
    expect(textOf('pair-active').split('|')[0]).toBe('MIC-05');
    expect(textOf('pair-active').split('|')[1]).toMatch(/5/);
    expect(textOf('pair-standby').split('|')[0]).toBe('MIC-02');
    expect(`${textOf('pair-active')} ${textOf('pair-standby')}`).not.toContain('MIC-01');
    expect([selectActiveInputId(state), selectStandbyInputId(state)]).toEqual(['MIC-05', 'MIC-02']);
  });

  // RE-PINNED by row 210 (D138 R157-1): "card 1 (MIC-01) says Standby" -> the hook states STANDBY for card 1;
  // the card itself shows no role word (pinned in the row-210 describe below).
  it('CONTROL - the same pair while that session still records: its own pair (MIC-02 active, MIC-01 standby), and the hook states MIC-01 (card 1) as the standby', () => {
    const state = draw(false);
    expect(state.session?.state).toBe('RECORDING');
    expect(textOf('pair-active').split('|')[0]).toBe('MIC-02');
    expect(textOf('pair-standby').split('|')[0]).toBe('MIC-01');
    expect([selectActiveInputId(state), selectStandbyInputId(state)]).toEqual(['MIC-02', 'MIC-01']);
  });
});

// Task 4 row 170 (site M4; decision C18 (2)): the hook every screen reads (`useMicSource`; `useMicSourceRole` removed by row 226)
// states "absent" for a role without a line. The double: the recording scenario with the selector's lines cut
// down through the store and no pair stated by the session.
describe('task 4 row 170 (D61) - the hook states "absent" (null) for a CHANNEL without a line', () => {
  function drawWithChannels(channels: readonly string[]): SimState {
    const test = createTestSim({ scenario: 'recording' });
    const base = test.sim.store.getState();
    const mics = base.captureConfig.mics.filter((line) => channels.includes(line.channel)); // D61: the lines are keyed by CHANNEL
    const session = base.session as Session;
    test.sim.store.setState({
      captureConfig: { ...base.captureConfig, mics } as SimState['captureConfig'],
      session: { ...session, audioSource: null, captureConfig: session.captureConfig ? { ...session.captureConfig, mics } : session.captureConfig } as unknown as Session,
    });
    render(
      <RuntimeTestProviders sim={test.sim}>
        <Probe />
      </RuntimeTestProviders>,
    );
    return test.sim.store.getState();
  }

  // D61 (2026-11-04): a line assigns its OWN channel (the complete-pair rule of D137 is superseded) -
  // the lone channel-1 line HAS its input, and the card of that input says ACTIVE, not "no role".
  it('a lone channel-1 line: the active input is that line, the standby is ABSENT (never MIC-02), and MIC-01 (card 1) is the active input', () => {
    const state = drawWithChannels(['MIC-01']);
    expect(state.session?.state).toBe('RECORDING');
    expect(textOf('pair-active').split('|')[0]).toBe('MIC-01');
    expect(textOf('pair-standby')).toBe('null|');
    expect([selectActiveInputId(state), selectStandbyInputId(state)]).toEqual(['MIC-01', null]);
  });

  it('CONTROL - all four lines, no pair stated by the session: the pair is read from the selector by channel, as before (D61)', () => {
    const state = drawWithChannels(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']);
    expect(textOf('pair-active').split('|')[0]).toBe('MIC-01');
    expect(textOf('pair-standby').split('|')[0]).toBe('MIC-02');
    expect([selectActiveInputId(state), selectStandbyInputId(state)]).toEqual(['MIC-01', 'MIC-02']);
  });
});

// Audit row 210 (M3-17; register A3 of masterplan/01_specs_m3.md; D134, D138 R157-1; reference: the web's row
// W3T dashboard tiles and row 157 Session Monitor halves): the four Session Live mic cards name their pair slot
// and no role. Whatever pair the hook states (the session's own while it records, the selector's after a seal),
// each card reads "Mic N (Camera N)" and exactly one card - Pair 1 - says "Transcribed".
describe('row 210 (M3-17, A3; D138) - the Session Live mic cards show the pair slot, never a role word', () => {
  const ROLE_KEYS = ['ACTIVE', 'STANDBY'] as const;
  /** The words the role keys resolve to in the app's catalogue (`session.audioSource.role.*`). */
  const roleWords = (): string[] => ROLE_KEYS.map((role) => i18n.t(`session.audioSource.role.${role}`));

  it.each([
    ['RECORDING (the session\'s own pair, card 1 STANDBY on the hook)', false],
    ['SEALED (the selector\'s pair after a microphone change)', true],
  ] satisfies [string, boolean][])('%s: 4 cards with A3, exactly one "Transcribed" (Pair 1), no role word', (_name, sealed) => {
    draw(sealed, true);
    for (const n of [1, 2, 3, 4] as const) {
      expect(screen.getByTestId(`mic-card-pair-AUDIO-0${n}`)).toHaveTextContent(`Mic ${n} (Camera ${n})`);
    }
    expect(screen.getAllByTestId(/^mic-card-pair-AUDIO-0[1-4]$/)).toHaveLength(4);
    const transcribed = screen.getAllByText('Transcribed');
    expect(transcribed).toHaveLength(1);
    expect(screen.getByTestId('mic-card-transcribed-AUDIO-01')).toHaveTextContent('Transcribed');
    for (const n of [2, 3, 4] as const) expect(screen.queryByTestId(`mic-card-transcribed-AUDIO-0${n}`)).toBeNull();
    // The role words resolve (the keys still exist in shared until R157-2) - and none of them is drawn.
    for (const words of roleWords()) {
      expect(words).not.toMatch(/^session\.audioSource/);
      expect(screen.queryAllByText(words, { includeHiddenElements: true })).toHaveLength(0);
    }
    expect(screen.queryAllByText(/^(Active|Standby)$/, { includeHiddenElements: true })).toHaveLength(0);
    for (const n of [1, 2, 3, 4] as const) expect(screen.queryByTestId(`monitor-mic-role-MIC-0${n}`)).toBeNull();
  });

  // RE-PINNED by row 211 (M3-18; D191): was "the card marks the hook's active input WITHOUT words: card 2 (MIC-02,
  // active while recording) is selected, card 1 is not" (accessibilityState selected true on card 2, false on card 1).
  it('the gold outline marks Pair 1 whatever the hook states: card 1 is outlined while the hook calls it STANDBY, card 2 is not; no card reports a selection', () => {
    draw(false, true);
    // Row 226 (D207): the hook's word is gone; card 1's input MIC-01 is the standby of the pair the hook states.
    expect(textOf('pair-standby').split('|')[0]).toBe('MIC-01');
    const glowOf = (n: 1 | 2 | 3 | 4) => (StyleSheet.flatten(screen.getByTestId(`monitor-mic-glow-MIC-0${n}`, { includeHiddenElements: true }).props.style) as { opacity?: number }).opacity;
    expect(glowOf(1)).toBe(1);
    for (const n of [2, 3, 4] as const) expect(glowOf(n)).toBe(0);
    for (const n of [1, 2, 3, 4] as const) expect(screen.getByTestId(`monitor-mic-MIC-0${n}`).props.accessibilityState?.selected).toBeUndefined();
  });

  it('the role-key read count of the card source is 0 (grep in the test; S62 M3-17 acceptance)', () => {
    const source = readFileSync(join(__dirname, 'mic-card.tsx'), 'utf8');
    expect(source.match(/session\.audioSource\.role/g) ?? []).toHaveLength(0);
    // CONTROL: the A3 keys are the ones it reads.
    expect(source).toContain("t('devices.pairs.micOfCamera', { n: pair })");
    expect(source).toContain("t('devices.pairs.transcribed')");
  });
});
