// Task 3, integration pass D7 item 1 (blueprint row 139's request; masterplan/08_client_ux_spec.md
// §8e.2 situation C, OP-125-5; decisions D84, D91 R-1 option A, D156): a FAULT session is routed to
// `/session/recovery`, so the tablet and the phone showed the ordinary "recover the evidence" screen
// for a start that recorded NOTHING.
//
// Held here on the REAL route over a test simulator. The simulator never writes `captureDurable`, so
// the state is put on the store as the Core sends it:
// - a failed start (`FAULT` + explicit `captureDurable: false`) draws row 139's notice, the Devices
//   pointer and "Close session" — and NO recovery-of-evidence presentation (no "Session recovery"
//   title, no pipeline, no track findings, no "Start recovery", no outcome card, no evidence link);
// - "No camera connected" only when the alert carries `params.reason: NO_CAMERA_CONNECTED`;
// - CONTROLS: a FAULT with a durable recording, and a FAULT without the member, keep the recovery screen.
//
// Import order matters: the gorhom mock, then the router harness, then the recovery harness.
import './testing/recovery-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { SimAlert } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { resetRecoveryHapticsForTests } from './session-recovery-screen';
import { advanceUntilIdle, renderRecoveryApp, settle, type RecoveryHarness, type RecoveryHarnessOptions } from './testing/recovery-harness';

beforeEach(() => {
  resetMissingKeys();
  resetRecoveryHapticsForTests();
});

afterEach(() => {
  resetMotionStateForTests();
});

/** The capture side's critical alert of a start that recorded nothing, as the Core writes it. */
const captureFault = (reason: string | null): SimAlert => ({
  id: 'ALR-000901',
  at: 0,
  severity: 'CRITICAL',
  kind: 'CAPTURE_FAULT',
  message: 'Capture fault',
  active: true,
  acknowledged: false,
  resolvedAt: null,
  target: null,
  params: reason === null ? { kind: 'CAPTURE_FAULT' } : { kind: 'CAPTURE_FAULT', reason, evidenceFiles: 0 },
});

/** Puts the session payload member (and the alert) on the store as the Core sends them. */
function setCapture(h: RecoveryHarness, captureDurable: boolean, alert: SimAlert | null = null): void {
  act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable }, alerts: alert === null ? s.alerts : [...s.alerts, alert] })));
}

async function open(options: RecoveryHarnessOptions = {}): Promise<RecoveryHarness> {
  const h = renderRecoveryApp(options);
  await settle();
  expect(h.sim.store.getState().session?.state).toBe('FAULT');
  return h;
}

/** Everything the recovery-of-evidence presentation draws. */
const RECOVERY_OF_EVIDENCE = ['recovery-card', 'recovery-ring', 'recovery-title', 'recovery-fault', 'recovery-start', 'recovery-details', 'recovery-pipeline-step-0', 'recovery-track-VIDEO-01', 'recovery-outcome', 'recovery-view-evidence'];
const drawn = (ids: readonly string[]): string[] => ids.filter((id) => screen.queryByTestId(id) !== null);

describe('a failed start on /session/recovery (pass D7 item 1)', () => {
  for (const window of ['phonePortrait', 'tabletLandscape'] as const) {
    it(`${window}: no camera connected — the notice, the Devices pointer and "Close session"; no recovery of evidence`, async () => {
      const h = await open({ window });
      // CONTROL: the same session without the member is an interrupted recording: the recovery screen.
      expect(drawn(['recovery-card', 'recovery-start', 'recovery-details', 'recovery-pipeline-step-0'])).toHaveLength(4);
      expect(screen.queryByTestId('recovery-failed-start')).toBeNull();

      setCapture(h, false, captureFault('NO_CAMERA_CONNECTED'));
      const card = within(screen.getByTestId('recovery-failed-start'));
      expect(card.getByTestId('session-failed-start-NO_CAMERA_CONNECTED')).toBeTruthy();
      expect(card.getByText('No camera connected')).toBeTruthy();
      expect(card.getByText('Nothing was recorded. Check the cameras on Devices, then close this session and start a new one.')).toBeTruthy();
      expect(card.getByTestId('recovery-session-id')).toHaveTextContent(h.sessionId!);
      expect(within(card.getByTestId('recovery-close-session')).getByText('Close session')).toBeTruthy();
      expect(drawn(RECOVERY_OF_EVIDENCE)).toEqual([]);
      expect(screen.queryByText('Session recovery')).toBeNull();
      expect(screen.queryByText('Start recovery')).toBeNull();
      expect(screen.queryByText(/unsealed|recovery analysis|incomplete/i)).toBeNull();
      expect(getMissingKeys()).toEqual([]);
    });
  }

  it('the generic sentence when the alert names no cause; the first durable fact brings the recovery screen back', async () => {
    const h = await open();
    setCapture(h, false, captureFault(null));
    const card = within(screen.getByTestId('recovery-failed-start'));
    expect(card.getByTestId('session-failed-start-OTHER')).toBeTruthy();
    expect(card.getByText('Recording did not start')).toBeTruthy();
    expect(card.queryByText('No camera connected')).toBeNull();
    expect(card.getByText(/^Nothing was recorded\./)).toBeTruthy();
  });

  it('CONTROL: a FAULT with a durable recording keeps the recovery screen, with the same alert active', async () => {
    const h = await open();
    setCapture(h, true, captureFault('NO_CAMERA_CONNECTED'));
    expect(screen.queryByTestId('recovery-failed-start')).toBeNull();
    expect(screen.queryByTestId('session-failed-start')).toBeNull();
    expect(drawn(['recovery-card', 'recovery-title', 'recovery-fault', 'recovery-start', 'recovery-details', 'recovery-pipeline-step-0'])).toHaveLength(6);
    expect(screen.getByText('Start recovery')).toBeTruthy();
    expect(screen.queryByText('Close session')).toBeNull();
  });

  it('the Devices pointer opens Devices', async () => {
    const h = await open();
    setCapture(h, false, captureFault('NO_CAMERA_CONNECTED'));
    fireEvent.press(screen.getByTestId('session-failed-start-devices'));
    await settle();
    expect(h.app.getPathname()).toBe('/devices');
  });

  it('"Close session" is the Core\'s recovery of it: the words stay while it closes, then Home — no outcome card, no evidence link', async () => {
    const h = await open();
    setCapture(h, false, captureFault('NO_CAMERA_CONNECTED'));
    fireEvent.press(screen.getByTestId('recovery-close-session'));
    await settle();
    expect(h.sim.store.getState().session?.state).toBe('RECOVERY');
    // Closing: the same words, no control, and still nothing of the recovery analysis.
    const closing = within(screen.getByTestId('recovery-failed-start-closing'));
    expect(closing.getByText('No camera connected')).toBeTruthy();
    expect(closing.getByText('Nothing was recorded.')).toBeTruthy();
    expect(screen.queryByTestId('recovery-close-session')).toBeNull();
    expect(drawn(RECOVERY_OF_EVIDENCE)).toEqual([]);
    expect(screen.queryByTestId('recovery-analysing')).toBeNull();

    act(() => advanceUntilIdle(h));
    await settle();
    expect(h.sim.store.getState().session).toBeNull();
    expect(h.app.getPathname()).toBe('/home');
    expect(drawn(RECOVERY_OF_EVIDENCE)).toEqual([]);
  });

  it('CONTROL: without SESSION_START the close is refused by the role, with the reason under it', async () => {
    const h = await open({ operator: 2 });
    setCapture(h, false, captureFault('NO_CAMERA_CONNECTED'));
    expect(screen.getByTestId('recovery-close-session-hint')).toHaveTextContent(/^Needs an Investigator or Supervisor\./);
    fireEvent.press(screen.getByTestId('recovery-close-session'));
    await settle();
    expect(h.sim.store.getState().session?.state).toBe('FAULT');
    expect(screen.getByTestId('recovery-failed-start')).toBeTruthy();
  });
});
