// Fix wave L, driver L-M - re-check 75 findings G75d-02 and G75d-01 (mobile halves; rulings D228 (1), (2)).
//
// | Finding | What the devices showed | Held here, on the REAL `/session/finalizing` route |
// |---|---|---|
// | G75d-02 | A blocked seal told the operator to "start recovery for the session"; no screen offered it | The Core's sentence stays as written; right under it the device says that sealing stopped after `SEAL_AUTOMATIC_RETRIES` automatic retries and is not run again by itself, who resolves the cause, and WHO RETRIES WHERE: the web console's Session Monitor, "Retry sealing", an investigator or a supervisor (`SEAL_RETRY_PERMISSION`) - and that this device has no retry control. No retry control is drawn |
// | G75d-01 | At the UNSEALABLE end the Finalizing screen showed the newest unsealable notice of ANY session | The screen shows the notice of the session it FOLLOWED only, in the plain sentence, with the cause as a detail, "recording is not blocked" and who closes it |
//
// The Core's payloads are the contract's OWN examples (`contract_wave_l.md` sections 1 and 2), imported by name.
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { act, screen } from '@testing-library/react-native';
import {
  OperatorRole,
  SEAL_AUTOMATIC_RETRIES,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  SEAL_BLOCKED_EXAMPLE_SESSION_ID,
  SEAL_RETRY_HOW_SENTENCE,
  SEAL_RETRY_PERMISSION,
  SEAL_UNSEALABLE_EXAMPLE_ALERT,
  SEAL_UNSEALABLE_EXAMPLE_SESSION_ID,
  SEAL_UNSEALABLE_PLAIN_SENTENCE,
  canRetryBlockedSeal,
  sealStoppedSentence,
  type ActiveSession,
  type SimAlert,
} from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { renderFlowApp, settle, type FlowHarness } from './testing/flow-harness';

beforeEach(() => resetMissingKeys());
afterEach(() => {
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
});

function coreSays(h: FlowHarness, sessionId: string, finalization: ActiveSession['finalization'], alerts: readonly SimAlert[]): void {
  act(() =>
    h.sim.store.setState((s) => ({
      session: s.session === null ? null : { ...s.session, id: sessionId, state: 'FINALIZING', finalization },
      alerts: [...s.alerts, ...alerts],
    })),
  );
}
const texts = (): string => JSON.stringify(screen.toJSON());

describe('the contract of the retry (contract_wave_l.md section 2), read by name', () => {
  it('operation 33 is for an investigator and a supervisor; three automatic retries', () => {
    expect(SEAL_AUTOMATIC_RETRIES).toBe(3);
    expect(SEAL_RETRY_PERMISSION).toBeDefined();
    expect([OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR].map(canRetryBlockedSeal)).toEqual([true, true]);
    expect(canRetryBlockedSeal(OperatorRole.TECHNICIAN)).toBe(false);
  });
});

describe.each(['tabletLandscape', 'phonePortrait'] as const)('G75d-02 on %s: a BLOCKED seal says who retries, and where', (window) => {
  it('what the Core does by itself, who resolves the cause, who retries on the web console - and no retry control on the device', async () => {
    const h = renderFlowApp({ window, routeSync: false });
    await settle();
    coreSays(h, SEAL_BLOCKED_EXAMPLE_SESSION_ID, SEAL_BLOCKED_EXAMPLE_FINALIZATION, [SEAL_BLOCKED_EXAMPLE_ALERT]);
    await settle();
    expect(screen.getByTestId('finalizing-seal-blocked')).toBeTruthy();
    // Closing pass L-Z (decision 3 of note 155): the same MEANING, now in the Core's OWN sentence (the alert of the contract
    // example, drawn as the Core wrote it) - the device no longer maps "start recovery" to the web control.
    const core = screen.getByTestId('finalizing-seal-blocked');
    expect(core).toHaveTextContent(SEAL_RETRY_HOW_SENTENCE, { exact: false });
    expect(core).toHaveTextContent(/an investigator or a supervisor presses "Retry sealing" on the Session Monitor of the web console/);
    expect(texts()).not.toMatch(/start recovery|recovery named above|recovery action/i);
    // What the Core does by itself: the sentence of the Core's failed step, from the ONE shared function.
    expect(screen.getByTestId('finalizing-seal-stopped')).toHaveTextContent(sealStoppedSentence(SEAL_AUTOMATIC_RETRIES));
    expect(screen.getByTestId('finalizing-seal-stopped')).toHaveTextContent(`Sealing stopped after ${SEAL_AUTOMATIC_RETRIES} automatic retries: the Core now waits and does not run it again by itself.`);
    expect(SEAL_BLOCKED_EXAMPLE_FINALIZATION!.steps[0]?.detail).toContain(sealStoppedSentence(SEAL_AUTOMATIC_RETRIES));
    expect(screen.getByTestId('finalizing-seal-who')).toHaveTextContent(/technician or the administrator of the Core/);
    expect(screen.getByTestId('finalizing-seal-retry-where')).toHaveTextContent('This device has no retry control: the retry is pressed on the web console.');
    // The device offers exactly one control here: the way out.
    expect(screen.getByTestId('finalizing-seal-home')).toBeTruthy();
    expect(screen.queryByText('Retry sealing')).toBeNull();
    expect(screen.queryByText('Start recovery')).toBeNull();
    expect(screen.queryByTestId('recovery-start')).toBeNull();
  });

  it('CONTROL - a seal that simply runs says none of it', async () => {
    renderFlowApp({ window, routeSync: false });
    await settle();
    expect(screen.queryByTestId('finalizing-seal-stopped')).toBeNull();
    expect(screen.queryByTestId('finalizing-seal-retry-where')).toBeNull();
    expect(texts()).not.toMatch(/Retry sealing|automatic retries/);
  });
});

describe('G75d-01: the UNSEALABLE end on the Finalizing screen is the notice of the session it followed', () => {
  it('the followed session ended UNSEALABLE: its own notice - plain sentence, cause as a detail, not blocking, who closes it', async () => {
    const h = renderFlowApp({ window: 'phonePortrait', routeSync: false });
    await settle();
    // The screen follows this session while it is being sealed ...
    act(() => h.sim.store.setState((s) => ({ session: s.session === null ? null : { ...s.session, id: SEAL_UNSEALABLE_EXAMPLE_SESSION_ID } })));
    await settle();
    // ... then the Core ends it as unsealable: the session leaves the store, the alert is raised.
    act(() => h.sim.store.setState((s) => ({ session: null, alerts: [...s.alerts, SEAL_UNSEALABLE_EXAMPLE_ALERT] })));
    await settle();
    const notice = screen.getByTestId('session-unsealable');
    expect(notice).toHaveTextContent(new RegExp(`Session ${SEAL_UNSEALABLE_EXAMPLE_SESSION_ID}`));
    expect(notice).toHaveTextContent(new RegExp(SEAL_UNSEALABLE_PLAIN_SENTENCE.replace(/\./g, '\\.')));
    expect(screen.getByTestId('session-unsealable-cause')).toHaveTextContent('Cause code: SESSION_KEY_NOT_OF_SESSION');
    expect(screen.getByTestId('session-unsealable-not-blocking')).toHaveTextContent(/Recording is not blocked/);
    expect(screen.getByTestId('session-unsealable-close')).toBeTruthy();
    expect(texts()).not.toMatch(/\(SESSION_KEY_NOT_OF_SESSION\)/);
  });

  it('CONTROL - the screen followed ANOTHER session: the open notice of that old session is not drawn here (Home states it)', async () => {
    const h = renderFlowApp({ window: 'phonePortrait', routeSync: false });
    await settle();
    act(() => h.sim.store.setState((s) => ({ session: s.session === null ? null : { ...s.session, id: 'SES-20261011-0099' } })));
    await settle();
    act(() => h.sim.store.setState((s) => ({ session: null, alerts: [...s.alerts, SEAL_UNSEALABLE_EXAMPLE_ALERT] })));
    await settle();
    expect(screen.queryByTestId('session-unsealable')).toBeNull();
  });
});
