// Task 3, integration pass D7 item 3, mobile, placement group "Sessions hub" (row 139's request,
// file_requests.md 16:42:26Z; masterplan/08_client_ux_spec.md §8e.2 situation C and "Between the
// accepted start and the first durable fragment"; decisions D84, D91 R-1 option A, D156).
//
// The hub summarises the open session in its active card and in its row. Held here on the real route
// over a test simulator (it never writes `captureDurable`; the state is put on the store as the Core
// sends it): while `captureDurable` is false the card and the row read "Connecting cameras…" with no
// REC dot, no LIVE badge and no timer; a failed start says "Nothing was recorded." in full and offers
// no recovery of a recorded part. CONTROLS: the session without the member, and a durable one.
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { act, screen, within } from '@testing-library/react-native';
import { SessionOutcome, type SessionHistoryEntry, type SimAlert } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderSessionsApp, settle, type SessionsHarness } from './testing/sessions-harness';

const noCamera: SimAlert = {
  id: 'ALR-000901',
  at: 0,
  severity: 'CRITICAL',
  kind: 'CAPTURE_FAULT',
  message: 'Capture fault',
  active: true,
  acknowledged: false,
  resolvedAt: null,
  target: null,
  params: { kind: 'CAPTURE_FAULT', reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 },
};

const setDurable = (h: SessionsHarness, captureDurable: boolean) => act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable } })));
const has = (testID: string): boolean => screen.queryAllByTestId(testID).length > 0;

describe('session start on the Sessions hub (pass D7 item 3)', () => {
  beforeEach(() => resetMissingKeys());
  afterEach(() => expect(getMissingKeys()).toEqual([]));

  it('connecting: the active card and the row read "Connecting cameras…" — no REC dot, no LIVE badge, no timer; the first durable fragment brings them back', async () => {
    const h = renderSessionsApp({ prepare: (test) => test.sim.actions.loadScenario('recording') });
    await settle();
    const id = h.sim.store.getState().session!.id;
    const card = () => within(screen.getByTestId('sessions-active'));
    const rowStatus = () => screen.getByTestId(`session-row-status-${id}`).props.accessibilityLabel as string;
    // CONTROL: the session without the member reads as recording.
    expect(card().getByText('Recording')).toBeTruthy();
    expect(has('sessions-active-rec')).toBe(true);
    expect(has('sessions-active-timer')).toBe(true);
    expect(rowStatus()).toBe('Recording');
    expect(has(`session-row-live-${id}`)).toBe(true);
    expect(has(`session-row-duration-${id}`)).toBe(true);

    setDurable(h, false);
    await settle();
    expect(within(card().getByTestId('sessions-active-status')).getByText('Connecting cameras…')).toBeTruthy();
    expect(card().queryByText('Recording')).toBeNull();
    expect(has('sessions-active-rec')).toBe(false);
    expect(has('sessions-active-timer')).toBe(false);
    expect(rowStatus()).toBe('Connecting cameras…');
    expect(has(`session-row-live-${id}`)).toBe(false);
    expect(has(`session-row-duration-${id}`)).toBe(false);
    // The way back to the monitor stays (it shows the connecting state itself).
    expect(card().getByText('Return to monitor')).toBeTruthy();

    setDurable(h, true);
    await settle();
    expect(card().getByText('Recording')).toBeTruthy();
    expect(has('sessions-active-rec')).toBe(true);
    expect(has('sessions-active-timer')).toBe(true);
    expect(rowStatus()).toBe('Recording');
    expect(has(`session-row-live-${id}`)).toBe(true);
  });

  it('a failed start: "No camera connected. Nothing was recorded." and no recovery of a recorded part; a durable fault keeps the recovery wording', async () => {
    const h = renderSessionsApp({ prepare: (test) => test.sim.actions.loadScenario('recording') });
    await settle();
    act(() => h.sim.actions.inject('POWER_FAIL'));
    await settle();
    expect(h.sim.store.getState().session?.state).toBe('FAULT');
    // CONTROL: an interrupted recording.
    expect(screen.getByTestId('sessions-active-fault')).toHaveTextContent('Power failure. A fault interrupted the recording. Open recovery to keep the recorded part as incomplete.');
    expect(within(screen.getByTestId('sessions-active-action')).getByText('Open recovery')).toBeTruthy();

    act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable: false }, alerts: [...s.alerts, noCamera] })));
    await settle();
    expect(screen.getByTestId('sessions-active-fault')).toHaveTextContent('No camera connected. Nothing was recorded.');
    expect(within(screen.getByTestId('sessions-active')).queryByText(/recorded part|Open recovery/)).toBeNull();
    expect(within(screen.getByTestId('sessions-active-action')).getByText('View details')).toBeTruthy();
  });

  it('follow-up D158 item 4: the detail of a CLOSED failed start names it — the no-camera sentence when the Core named the cause, the generic one otherwise', async () => {
    const h = renderSessionsApp();
    await settle();
    const demo = h.history().find((entry) => entry.outcome === SessionOutcome.INCOMPLETE)!;
    const endedAt = h.sim.store.getState().clock.now - 60_000;
    // The history entry the Core's recovery of a failed start leaves: never started, no evidence item, no byte.
    const closed = (id: string, at: number): SessionHistoryEntry => ({ ...demo, id, createdAt: at - 30_000, startedAt: null, endedAt: at, durationMs: 0, sizeBytes: 0, evidenceId: null, faultKind: 'CAPTURE_FAULT' });
    const [named, unnamed] = [closed('SES-20991231-0001', endedAt), closed('SES-20991231-0002', endedAt - 600_000)];
    act(() => h.sim.store.setState((s) => ({ sessionHistory: [...s.sessionHistory, named, unnamed], alerts: [...s.alerts, { ...noCamera, active: false, at: endedAt - 10_000 }] })));
    await settle();

    h.navigate(`/sessions/${named.id}`);
    await settle();
    expect(screen.getByTestId('session-detail-incomplete')).toHaveTextContent(/No camera connected\. Nothing was recorded\.$/);
    expect(screen.getByTestId('session-detail-incomplete')).not.toHaveTextContent(/SYS-008|kept as evidence/);

    h.navigate(`/sessions/${unnamed.id}`);
    await settle();
    expect(screen.getByTestId('session-detail-incomplete')).toHaveTextContent(/Recording did not start\. Nothing was recorded\.$/);
    expect(screen.getByTestId('session-detail-incomplete')).not.toHaveTextContent(/No camera connected/);

    // CONTROL: an interrupted recording keeps the ordinary incomplete text.
    h.navigate(`/sessions/${demo.id}`);
    await settle();
    expect(screen.getByTestId('session-detail-incomplete')).toHaveTextContent(/SYS-008/);
    expect(screen.getByTestId('session-detail-incomplete')).not.toHaveTextContent(/Nothing was recorded/);
  });
});
