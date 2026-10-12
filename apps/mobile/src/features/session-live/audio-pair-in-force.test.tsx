// Fix 157 (fix wave L) - the same class as G70c-01, another member: `session.audioSource`, the active /
// standby microphone pair. The `session` slice keeps the LAST session after its seal, with the pair that
// session ended on; readers that took it whatever the session's state named the OLD inputs after the
// selector's microphones were changed.
//
// Rule (ONE helper, `audioPairInForce` of `@dems/shared/sim`, through the app's door
// `capture-selector/selector-in-force.ts`): the session's own pair only while that session is OPEN;
// otherwise the pair the current selector gives (PRIMARY = active, STANDBY = standby).
//
// Order of the defect: the session recorded MIC-01 / MIC-02 and was switched to MIC-02 (pair: active
// MIC-02, standby MIC-01); it is SEALED; THEN the selector's first line becomes MIC-04. The control is the
// same state with the session still RECORDING.
//
// The mobile screens DRAW the pair only while a session records (the toggle, the Active / Standby chips),
// so the sealed half is held on the hook every one of them reads (`useMicSource`), drawn by a probe with
// the app's own microphone name. The Home tiles read the same helper and draw a role only while recording.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { SimState } from '@dems/shared/sim';
import { useMicInputName } from '@/features/capture-selector/development-source-badge';
import { resetMotionStateForTests } from '@/motion';
import { RuntimeTestProviders, createTestSim } from '@/runtime/testing/test-sim';
import { selectActiveInputId, selectStandbyInputId } from './mic-source-model';
import { useMicSource, useMicSourceRole } from './use-mic-source';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);

afterEach(() => resetMotionStateForTests());

type Session = NonNullable<SimState['session']>;
const PAIR = { activeInputId: 'MIC-02', standbyInputId: 'MIC-01', switchedAt: 5_000, intervalFromMs: 4_000 };

/** The recording scenario, switched to MIC-02; then (`sealed`) sealed; then the first microphone line changed to MIC-04. */
function afterMicrophoneChange(base: SimState, sealed: boolean): Partial<SimState> {
  const session = base.session as Session;
  const snapshot = { cameras: base.captureConfig.cameras, mics: base.captureConfig.mics, revision: 2, updatedAt: base.captureConfig.updatedAt };
  const held = { ...session, captureConfig: snapshot, audioSource: { ...PAIR, sessionId: session.id } } as unknown as Session;
  return {
    captureConfig: {
      ...base.captureConfig,
      mics: base.captureConfig.mics.map((line, index) => (index === 0 ? { ...line, inputId: 'MIC-04', deviceId: 'MIC-04' } : line)),
      updatedAt: base.captureConfig.updatedAt + 60_000,
    } as SimState['captureConfig'],
    session: sealed ? ({ ...held, state: 'SEALED' } as unknown as Session) : held,
  };
}

function Probe() {
  const view = useMicSource();
  const micName = useMicInputName();
  const role1 = useMicSourceRole('AUDIO-01');
  return (
    <>
      <Text testID="pair-active">{`${view.activeInputId}|${view.activeInputId === null ? '' : micName(view.activeInputId)}`}</Text>
      <Text testID="pair-standby">{`${view.standbyInputId}|${view.standbyInputId === null ? '' : micName(view.standbyInputId)}`}</Text>
      <Text testID="card-1-role">{role1 ?? 'none'}</Text>
    </>
  );
}

function draw(sealed: boolean): SimState {
  const test = createTestSim({ scenario: 'recording' });
  test.sim.store.setState(afterMicrophoneChange(test.sim.store.getState(), sealed));
  render(
    <RuntimeTestProviders sim={test.sim}>
      <Probe />
    </RuntimeTestProviders>,
  );
  return test.sim.store.getState();
}
const textOf = (testID: string): string => String(screen.getByTestId(testID).props.children);

describe('fix 157 - the pair a mobile screen names after a sealed session and a microphone change', () => {
  it('SEALED: the pair is the current selector\'s - the NEW microphone MIC-04 is the active one, MIC-02 the standby; the sealed session\'s MIC-01 is named nowhere', () => {
    const state = draw(true);
    // The slice still HOLDS the old pair - that is the state the defect needs.
    expect(state.session?.state).toBe('SEALED');
    expect((state.session as unknown as { audioSource: typeof PAIR }).audioSource).toMatchObject({ activeInputId: 'MIC-02', standbyInputId: 'MIC-01' });
    expect(textOf('pair-active').split('|')[0]).toBe('MIC-04');
    expect(textOf('pair-active').split('|')[1]).toMatch(/4/);
    expect(textOf('pair-standby').split('|')[0]).toBe('MIC-02');
    expect(`${textOf('pair-active')} ${textOf('pair-standby')}`).not.toContain('MIC-01');
    // No word on a card: nothing records.
    expect(textOf('card-1-role')).toBe('none');
    expect([selectActiveInputId(state), selectStandbyInputId(state)]).toEqual(['MIC-04', 'MIC-02']);
  });

  it('CONTROL - the same pair while that session still records: its own pair (MIC-02 active, MIC-01 standby), and card 1 (MIC-01) says Standby', () => {
    const state = draw(false);
    expect(state.session?.state).toBe('RECORDING');
    expect(textOf('pair-active').split('|')[0]).toBe('MIC-02');
    expect(textOf('pair-standby').split('|')[0]).toBe('MIC-01');
    expect(textOf('card-1-role')).toBe('STANDBY');
    expect([selectActiveInputId(state), selectStandbyInputId(state)]).toEqual(['MIC-02', 'MIC-01']);
  });
});

// Task 4 row 170 (site M4; decision C18 (2)): the hook every screen reads (`useMicSource`, `useMicSourceRole`)
// states "absent" for a role without a line. The double: the recording scenario with the selector's lines cut
// down through the store and no pair stated by the session.
describe('task 4 row 170 - the hook states "absent" (null) for a role without a line', () => {
  function drawWithRoles(roles: readonly string[]): SimState {
    const test = createTestSim({ scenario: 'recording' });
    const base = test.sim.store.getState();
    const mics = base.captureConfig.mics.filter((line) => roles.includes(line.role));
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

  it('a lone PRIMARY line: the active input is that line, the standby is ABSENT (never MIC-02), and card 1 says no role (no meter channel has an input)', () => {
    const state = drawWithRoles(['PRIMARY']);
    expect(state.session?.state).toBe('RECORDING');
    expect(textOf('pair-active').split('|')[0]).toBe('MIC-01');
    expect(textOf('pair-standby')).toBe('null|');
    expect(textOf('card-1-role')).toBe('none');
    expect([selectActiveInputId(state), selectStandbyInputId(state)]).toEqual(['MIC-01', null]);
  });

  it('CONTROL - both lines, no pair stated by the session: the pair is read from the selector by role, as before', () => {
    const state = drawWithRoles(['PRIMARY', 'STANDBY']);
    expect(textOf('pair-active').split('|')[0]).toBe('MIC-01');
    expect(textOf('pair-standby').split('|')[0]).toBe('MIC-02');
    expect(textOf('card-1-role')).toBe('ACTIVE');
    expect([selectActiveInputId(state), selectStandbyInputId(state)]).toEqual(['MIC-01', 'MIC-02']);
  });
});
