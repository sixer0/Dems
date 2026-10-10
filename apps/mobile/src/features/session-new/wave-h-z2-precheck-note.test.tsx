// Fix wave H, closing pass Z2 - the pre-check TIME item of a Core in its own capture (closing pass
// Z1's request line of 10:30:00Z; ruling D203 (1)). It is a NOTE: `status: WARN`, `value:
// HOST_SYSTEM_CLOCK`, `params: { rule: 'TIME_HOST_CLOCK' }`; the run's outcome stays PASS and nothing
// is to be acknowledged (`isPrecheckNote`, `@dems/shared/sim`).
//
// | Rule | Case |
// |------|------|
// | The row reads "Host system clock" with a NOTE chip - never the raw value `HOST_SYSTEM_CLOCK`, never WARN | "the row" |
// | A note is not counted with the warnings ("N warnings acknowledged" on the Ready step) | "the rules" |
// | CONTROL: an RTC fallback of the simulation (no rule) stays a WARN that counts | "the rules" |
// Import order: the test setup, then the router harness.
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, screen, within } from '@testing-library/react-native';
import { OPERATORS, PRECHECK_TOTAL_MAX_MS, type PrecheckItem } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import type { TestSim } from '@/runtime/testing/test-sim';
import { itemsWith, precheckNoteOf, precheckTone, valueKey } from './session-new-model';
import { renderSessionNewApp, settle } from './testing/session-new-harness';

beforeEach(() => {
  jest.useFakeTimers();
  resetMissingKeys();
});
afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  resetMotionStateForTests();
});

const NOTE = { id: 'TIME', status: 'WARN', value: 'HOST_SYSTEM_CLOCK', reason: 'Time source: host system clock (no GNSS)', reasonCode: null, params: { rule: 'TIME_HOST_CLOCK', source: 'RTC' } } as unknown as PrecheckItem;
const FALLBACK = { id: 'TIME', status: 'WARN', value: 'RTC', reason: 'core text', reasonCode: 'TIME_RTC', params: {} } as unknown as PrecheckItem;

function startGate(test: TestSim): void {
  const result = test.sim.actions.createSession({ caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Rahmat Hidayat', investigatorId: OPERATORS[0]!.id, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
  if (!result.ok) throw new Error(`createSession failed: ${result.reason}`);
  test.sim.actions.beginPrecheck();
}

describe('the pre-check TIME note of a Core in its own capture (mobile)', () => {
  it('the row: "Host system clock" with a NOTE chip - not the raw value, not WARN', async () => {
    const h = renderSessionNewApp({ setup: startGate });
    await settle();
    h.openFlow('/session/new?step=2');
    h.tick(PRECHECK_TOTAL_MAX_MS);
    await settle();
    // The run as a Core in its own capture answers it: the TIME item is the note, the outcome PASS.
    act(() => {
      const session = h.sim.store.getState().session!;
      h.sim.store.setState({ session: { ...session, precheck: { ...session.precheck, items: session.precheck.items.map((item) => (item.id === 'TIME' ? NOTE : item)) } } });
    });
    await settle();
    const row = within(screen.getByTestId('session-new-check-TIME'));
    expect(screen.getByTestId('session-new-check-TIME-value')).toHaveTextContent('Host system clock');
    expect(row.queryByText(/HOST_SYSTEM_CLOCK/)).toBeNull();
    expect(row.queryByText('WARN')).toBeNull();
    expect(row.getByText('NOTE')).toBeTruthy();
    expect(String(screen.getByTestId('session-new-check-TIME').props.accessibilityLabel)).toBe('Time Sync, Host system clock, NOTE');
    expect(getMissingKeys()).toEqual([]);
  });

  it('the rules (pure): a note is no warning to count; its value and tone are the host clock\'s', () => {
    expect(precheckNoteOf(NOTE)).toBe(true);
    expect(precheckNoteOf(FALLBACK)).toBe(false);
    expect(itemsWith([NOTE], 'WARN')).toEqual([]);
    expect(itemsWith([FALLBACK], 'WARN')).toEqual([FALLBACK]);
    expect(valueKey('TIME', 'HOST_SYSTEM_CLOCK')).toBe('session.captureFacts.timeSource.hostClock');
    expect(valueKey('TIME', 'RTC')).toBe('common.enums.timeSource.RTC');
    expect(precheckTone('WARN', true)).toBe('info');
    expect(precheckTone('WARN')).toBe('warning');
  });
});
