// Wave H, driver B (gates 75 / 89: G75-03, B-3; ruling D197): the Sessions hub names a sealed recording
// that was interrupted - on its row and on its detail - instead of the plain "Sealed". The history
// entry itself cannot carry a fault kind for a SEALED outcome (database CHECK), so the fact is read
// through the session's item (`interruptedSealOfSession`). Written RED: both read "Sealed".
import './testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { screen, within } from '@testing-library/react-native';
import { en } from '@dems/shared/i18n';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderSessionsApp, settle } from './testing/sessions-harness';
import { SEAL_BLOCKED_EXAMPLE_ALERT, SEAL_BLOCKED_EXAMPLE_FINALIZATION, SEAL_BLOCKED_EXAMPLE_SESSION_ID, SEAL_RECORDING_KEPT_SENTENCE, ScenarioName } from '@dems/shared/sim';
import type { TestSim } from '@/runtime/testing/test-sim';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('interrupted seal hub', () => {
unmountBeforeTheHooksOfThisGroup();

afterEach(() => resetMissingKeys());

const WORDS = en.common.interruptedSeal;

describe('an interrupted seal in the Sessions hub', () => {
  it('the row of that session says so; the other sealed rows read "Sealed" (control)', async () => {
    let interruptedId = '';
    let plainId = '';
    renderSessionsApp({
      prepare(test) {
        const state = test.sim.store.getState();
        const sealed = state.sessionHistory.filter((entry) => entry.outcome === 'SEALED' && entry.evidenceId !== null);
        interruptedId = sealed[0]!.id;
        plainId = sealed[1]!.id;
        test.sim.store.setState({
          evidence: state.evidence.map((item) =>
            item.sessionId === interruptedId ? { ...item, custody: [item.custody[0]!, { at: item.endedAt, action: 'RECORDING_INTERRUPTED', actorId: null, detail: 'CAPTURE_FAULT' }, ...item.custody.slice(2)] } : item,
          ),
        });
      },
    });
    await settle();
    const chip = screen.getByTestId(`session-row-status-${interruptedId}`);
    expect(within(chip).getByText(WORDS.chip)).toBeTruthy();
    expect(within(chip).queryByText('Sealed')).toBeNull();
    expect(chip.props.accessibilityLabel).toBe(WORDS.title);
    expect(within(screen.getByTestId(`session-row-status-${plainId}`)).getByText('Sealed')).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-i-c-seal-blocked-hub.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave I, driver C - re-gate 75 finding G75b-02, the Sessions half: the open session whose seal is
// BLOCKED is shown as "Sealing blocked" (card chip, the card's sentence), and "Start New Session" says
// WHY it is unavailable - the blocked seal, by session - instead of the plain "A session is in
// progress. Finish it before starting a new one." (nothing the operator can finish). The refused
// `/session/new` deep link says the same in its notice.
//
// The Core's payloads are the contract's own examples (`@dems/shared/sim` `seal-blocked.ts`), never
// retyped (D208). Written RED.
describe('the hub and a blocked seal', () => {
unmountBeforeTheHooksOfThisGroup();
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
});
