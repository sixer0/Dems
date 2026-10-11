// Fix wave I, driver C - re-gate 75 finding G75b-02: "New Session explains why it is unavailable
// instead of failing with a toast". The one way to reach `/session/new` while a session is busy is a
// deep link; its refusal notice said "A session is already active / Finish or recover the current
// session before starting a new one." - nothing an operator can do for a session whose seal is
// BLOCKED. The notice now names that state and the session (the Core's alert, read with the
// contract's `sealBlockedNoticeOf`; examples imported from `@dems/shared/sim`, never retyped: D208).
// Written after the change (not run red); the CONTROL holds the plain words of a session that simply finalizes.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';

import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { DEMO_OPERATOR_PASSWORD, SEAL_BLOCKED_EXAMPLE_ALERT, SEAL_BLOCKED_EXAMPLE_FINALIZATION, SEAL_BLOCKED_EXAMPLE_SESSION_ID, SEAL_RECORDING_KEPT_SENTENCE, ScenarioName } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { RuntimeTestProviders, createTestSim, flushAsync, type TestSim } from '@/runtime/testing/test-sim';
import { useSessionNewRedirect } from './session-guards';

const mockShow = jest.fn();
jest.mock('heroui-native', () => {
  const actual = jest.requireActual<typeof import('heroui-native')>('heroui-native');
  return { ...actual, useToast: () => ({ toast: { show: mockShow, hide: jest.fn() } }) };
});

beforeEach(() => {
  mockShow.mockClear();
  resetMissingKeys();
});
afterEach(() => expect(getMissingKeys()).toEqual([]));

function finalizing(blocked: boolean): TestSim {
  const test = createTestSim();
  expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  test.sim.actions.loadScenario(ScenarioName.FINALIZING);
  if (blocked) {
    test.sim.store.setState((s) => ({
      session: { ...s.session!, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION },
      alerts: [...s.alerts, SEAL_BLOCKED_EXAMPLE_ALERT],
    }));
  }
  return test;
}
async function visit(test: TestSim) {
  const wrapper = ({ children }: { children: ReactNode }) => <RuntimeTestProviders sim={test.sim}>{children}</RuntimeTestProviders>;
  const hook = renderHook(() => useSessionNewRedirect(), { wrapper });
  await flushAsync();
  return hook;
}

describe('G75b-02: `/session/new` while the open session\'s seal is blocked', () => {
  it('is refused to the Finalizing screen, and the notice says why: the blocked seal, by session, and that the recording is kept', async () => {
    const { result } = await visit(finalizing(true));
    expect(result.current).toBe('/session/finalizing');
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith({
      variant: 'warning',
      label: 'A new session is not available',
      description: `Sealing of session ${SEAL_BLOCKED_EXAMPLE_SESSION_ID} is blocked, and the Core records no new session until it is sealed. ${SEAL_RECORDING_KEPT_SENTENCE}`,
    });
  });

  it('CONTROL - a session that is simply finalizing keeps the plain words', async () => {
    const { result } = await visit(finalizing(false));
    expect(result.current).toBe('/session/finalizing');
    expect(mockShow).toHaveBeenCalledWith({ variant: 'warning', label: 'A session is already active', description: 'Finish or recover the current session before starting a new one.' });
  });
});
