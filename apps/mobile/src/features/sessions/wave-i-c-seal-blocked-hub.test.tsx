// Fix wave I, driver C - re-gate 75 finding G75b-02, the Sessions half: the open session whose seal is
// BLOCKED is shown as "Sealing blocked" (card chip, the card's sentence), and "Start New Session" says
// WHY it is unavailable - the blocked seal, by session - instead of the plain "A session is in
// progress. Finish it before starting a new one." (nothing the operator can finish). The refused
// `/session/new` deep link says the same in its notice.
//
// The Core's payloads are the contract's own examples (`@dems/shared/sim` `seal-blocked.ts`), never
// retyped (D208). Written RED.
import './testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { screen, within } from '@testing-library/react-native';
import { SEAL_BLOCKED_EXAMPLE_ALERT, SEAL_BLOCKED_EXAMPLE_FINALIZATION, SEAL_BLOCKED_EXAMPLE_SESSION_ID, SEAL_RECORDING_KEPT_SENTENCE, ScenarioName } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import type { TestSim } from '@/runtime/testing/test-sim';
import { renderSessionsApp, settle } from './testing/sessions-harness';

afterEach(() => {
  expect(getMissingKeys()).toEqual([]);
  resetMissingKeys();
});

function finalizing(test: TestSim, blocked: boolean): void {
  test.sim.actions.loadScenario(ScenarioName.FINALIZING);
  if (!blocked) return;
  test.sim.store.setState((s) => ({
    session: { ...s.session!, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION },
    alerts: [...s.alerts, SEAL_BLOCKED_EXAMPLE_ALERT],
  }));
}
const NEW_SESSION = `A new session cannot be started: sealing of session ${SEAL_BLOCKED_EXAMPLE_SESSION_ID} is blocked, and the Core records no new session until it is sealed.`;

describe.each(['tabletLandscape', 'phonePortrait'] as const)('G75b-02 on %s: the Sessions hub and a blocked seal', (window) => {
  it('the active card shows the session as "Sealing blocked" with the kept sentence - not "Finalizing ... takes a few seconds"', async () => {
    renderSessionsApp({ window, prepare: (test) => finalizing(test, true) });
    await settle();
    const card = screen.getByTestId('sessions-active');
    expect(within(card).getByTestId('sessions-active-id')).toHaveTextContent(SEAL_BLOCKED_EXAMPLE_SESSION_ID);
    expect(within(screen.getByTestId('sessions-active-status')).getByText('Sealing blocked')).toBeTruthy();
    expect(screen.getByTestId('sessions-active-seal-blocked')).toHaveTextContent(`Sealing of this session is blocked. ${SEAL_RECORDING_KEPT_SENTENCE}`);
    expect(within(card).queryByText(/takes a few seconds/)).toBeNull();
  });

  it('"Start New Session" is disabled and says why: the blocked seal, by session', async () => {
    renderSessionsApp({ window, prepare: (test) => finalizing(test, true) });
    await settle();
    const start = screen.getByTestId('sessions-start');
    expect(start.props.accessibilityState?.disabled).toBe(true);
    expect(start.props.accessibilityHint).toBe(NEW_SESSION);
    expect(screen.getByTestId('sessions-start-busy')).toHaveTextContent(NEW_SESSION);
  });

  it('CONTROL - a seal that simply runs: the chip and the sentence of a running seal, and the plain busy hint', async () => {
    renderSessionsApp({ window, prepare: (test) => finalizing(test, false) });
    await settle();
    expect(within(screen.getByTestId('sessions-active-status')).queryByText('Sealing blocked')).toBeNull();
    expect(screen.queryByTestId('sessions-active-seal-blocked')).toBeNull();
    expect(screen.getByTestId('sessions-start-busy')).toHaveTextContent('A session is in progress. Finish it before starting a new one.');
  });
});
