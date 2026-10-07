// Backend task, plan row W73: Recovery Status in LIVE mode — settle sites S2-3 (Start recovery,
// operation 33), S4-8 (Acknowledge: one acknowledgeAlert per matching alert, operation 70) and S5-2
// (the role hint; the Core enforces SESSION_START), each with its success, its refusal (a 403 with
// the denied toast, AC-C-48) and an outage, on the app's real Live source over the contract-checked
// fake transport; plus the pending control (LB-1), the link notice (rows M0, M1), a limit (LB-10),
// React's StrictMode (decision D158) and the Simulated control.
//
// Import order: the test setup, then the router harness, then the beds (see their headers).
import './testing/recovery-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { formatClock } from '@dems/shared/realtime';
import { refusal, rateLimited } from '@dems/shared/live/testing';
import { RECOVERY_MS, ScenarioName, type SimState } from '@dems/shared/sim';
import { resetMissingKeys, getMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { ACK_SETTLE_MS } from './recovery.model';
import { resetRecoveryHapticsForTests } from './session-recovery-screen';
import { renderLiveRecovery, resetLiveRecoveryBed, type LiveRecoveryBed, type LiveRecoveryBedOptions } from './testing/live-recovery-bed';
import { renderRecoveryApp, settle as settleSimulated } from './testing/recovery-harness';

let bed: LiveRecoveryBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  resetRecoveryHapticsForTests();
  await resetLiveRecoveryBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  resetMotionStateForTests();
});

const DENIED = 'Not permitted';
const DENIED_ROLE = 'Requires the Investigator role';
const OFFLINE = 'Core server unreachable';
const OFFLINE_HINT = 'Nothing was changed.';
const LIMIT = 'The Core server is limiting requests from this tablet';
const READ_ONLY = 'Recovery is paused while the Core link is offline.';
const DERIVED = "The Core reports the recovery stage and the outcome. The check results shown here are derived on this device from the Core's data.";
const isBusy = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.busy === true;
const toastShown = (text: string) => screen.queryAllByText(text).length > 0;
const stepLabel = (index: number) => String(screen.getByTestId(`recovery-pipeline-step-${index}`).props.accessibilityLabel);

/** fault-demo (Camera 2 lost, MIC 2 clipping, GNSS → NTP) plus POWER_FAIL on the Core: FAULT from RECORDING. */
const faultOnCore: NonNullable<LiveRecoveryBedOptions['setup']> = (engine) => {
  engine.sim.actions.loadScenario(ScenarioName.FAULT_DEMO);
  engine.sim.actions.inject('POWER_FAIL');
};

/** Signs in on a Core whose session is in FAULT; the route sync opens the recovery screen from Home. */
async function openFault(options: LiveRecoveryBedOptions = {}): Promise<LiveRecoveryBed> {
  const b = await renderLiveRecovery({ setup: faultOnCore, ...options });
  bed = b;
  expect(b.state().session?.state).toBe('FAULT');
  expect(b.app.getPathname()).toBe('/session/recovery');
  expect(screen.getByTestId('recovery-fault')).toBeTruthy();
  return b;
}

async function press(testID: string, b: LiveRecoveryBed): Promise<void> {
  fireEvent.press(screen.getByTestId(testID));
  await b.flush();
}

/** Runs the Core until its recovery closed the session (the engine's 3 s on the shared clock). */
async function runRecovery(b: LiveRecoveryBed): Promise<void> {
  await b.elapse(RECOVERY_MS + 500, 100);
  expect(b.state().session).toBeNull();
}

const sessionIdOf = (s: SimState) => s.session?.id ?? null;

describe('S2-3: Start recovery — recoverSession (operation 33), the screen follows the Core', () => {
  it('success (delta first): one POST for the open session; RECOVERY from the Core; the pipeline on the Core\'s clock; the Core\'s INCOMPLETE outcome', async () => {
    const b = await openFault();
    const sessionId = sessionIdOf(b.state());
    expect(screen.getByTestId('recovery-live-derived')).toHaveTextContent(DERIVED);
    await press('recovery-start', b);
    expect(b.requests('recoverSession').map((call) => [call.method, call.params['id']])).toEqual([['POST', sessionId]]);
    expect(b.state().session?.state).toBe('RECOVERY');
    expect(screen.getByTestId('recovery-analysing')).toBeTruthy();
    expect(screen.queryByTestId('recovery-start')).toBeNull();
    expect(stepLabel(0)).toBe('Step 1 of 5, Recovery marker and journal, in progress');

    await b.elapse(600, 100);
    expect(stepLabel(0)).toBe('Step 1 of 5, Recovery marker and journal, completed');
    await b.elapse(1_000, 100); // 1.6 s: the Core reports INCOMPLETE_SESSION_ANALYSIS
    expect(b.state().session?.recovery?.stage).toBe('INCOMPLETE_SESSION_ANALYSIS');
    expect(screen.getByTestId('recovery-stage')).toHaveTextContent('Incomplete session analysis · stage 2 of 2');
    expect(within(screen.getByTestId('recovery-track-VIDEO-02-result')).getByText('GAP')).toBeTruthy();

    await runRecovery(b);
    const entry = b.state().sessionHistory.find((candidate) => candidate.id === sessionId)!;
    expect(entry.outcome).toBe('INCOMPLETE');
    expect(b.app.getPathname()).toBe('/session/recovery');
    expect(screen.getByTestId('recovery-outcome-line')).toHaveTextContent('Session marked INCOMPLETE. It will never be sealed (SYS-008).');
    expect(within(screen.getByTestId('recovery-outcome-evidence')).getByText(`${entry.evidenceId} (recorded, unsealed)`)).toBeTruthy();
    expect(b.state().evidence.find((item) => item.id === entry.evidenceId)?.status).toBe('RECORDED');
    expect(toastShown(DENIED)).toBe(false);
    expect(toastShown(OFFLINE)).toBe(false);
    expect(b.requests('recoverSession')).toHaveLength(1);
    expect(getMissingKeys()).toEqual([]);
  });

  it('success (answer first): the answer alone moves nothing; the screen moves when the Core\'s delta arrives', async () => {
    const b = await openFault();
    b.order = 'answer-first';
    await press('recovery-start', b);
    await b.elapse(200);
    expect(b.requests('recoverSession')).toHaveLength(1);
    expect(b.state().session?.state).toBe('FAULT');
    expect(screen.getByTestId('recovery-fault')).toBeTruthy();
    expect(isBusy('recovery-start')).toBe(true);
    b.sendHeldDeltas();
    await b.flush();
    expect(b.state().session?.state).toBe('RECOVERY');
    expect(screen.getByTestId('recovery-analysing')).toBeTruthy();
  });

  it('pending (LB-1): busy at the press, no spinner at 300 ms, the spinner after the reveal delay, a second press sends nothing', async () => {
    const b = await openFault({ answerDelayMs: 1_000 });
    await press('recovery-start', b);
    expect(isBusy('recovery-start')).toBe(true);
    expect(screen.queryByTestId('recovery-start-spinner')).toBeNull();
    await b.elapse(300, 100);
    expect(screen.queryByTestId('recovery-start-spinner')).toBeNull();
    fireEvent.press(screen.getByTestId('recovery-start'));
    await b.elapse(200, 100);
    expect(screen.getByTestId('recovery-start-spinner')).toBeTruthy();
    expect(b.requests('recoverSession')).toHaveLength(1);
    await b.elapse(700, 100);
    expect(screen.getByTestId('recovery-analysing')).toBeTruthy();
    expect(b.requests('recoverSession')).toHaveLength(1);
  });

  it('the control is released after a success: a second session interrupted while this screen still shows the first outcome gets its own request', async () => {
    const b = await openFault();
    const first = sessionIdOf(b.state());
    await press('recovery-start', b);
    await runRecovery(b);
    expect(screen.getByTestId('recovery-outcome')).toBeTruthy();
    // Another console's session reaches FAULT on the Core; the device learns it in one delta (as after a resync).
    await b.onCore((engine) => {
      const created = engine.sim.actions.createSession({
        caseNumber: 'LP/2026/1001-0099',
        subjectName: 'Rudi Hartono',
        subjectType: 'SAKSI',
        investigatorId: engine.sim.store.getState().operators[0]!.id,
        room: 'Interview Room 1',
        profileId: 'STANDARD_1080P25',
      });
      if (!created.ok) throw new Error(created.reason);
      engine.sim.actions.beginPrecheck();
      engine.sim.actions.inject('POWER_FAIL');
    });
    const second = b.state().session!;
    expect(second.state).toBe('FAULT');
    expect(second.id).not.toBe(first);
    expect(screen.getByTestId('recovery-session-id')).toHaveTextContent(second.id);
    expect(isBusy('recovery-start')).toBe(false);
    await press('recovery-start', b);
    expect(b.requests('recoverSession').map((call) => call.params['id'])).toEqual([first, second.id]);
    expect(screen.getByTestId('recovery-analysing')).toBeTruthy();
  });

  it('refusal: 403 (example notPermitted) → the denied toast that names the role; FAULT stays; Start idle; the next press sends again', async () => {
    const b = await openFault();
    b.fake.answerOnce('recoverSession', b.fake.example('recoverSession', 403, 'notPermitted'));
    await press('recovery-start', b);
    await b.elapse(200);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown(DENIED_ROLE)).toBe(true);
    expect(toastShown('Your role cannot start recovery. Ask an Investigator or Supervisor.')).toBe(false);
    expect(b.state().session?.state).toBe('FAULT');
    expect(isBusy('recovery-start')).toBe(false);
    await press('recovery-start', b);
    expect(b.requests('recoverSession')).toHaveLength(2);
    expect(b.state().session?.state).toBe('RECOVERY');
  });

  it('outage: "Core server unreachable. Nothing was changed."; FAULT stays; Start idle; a second press sends again', async () => {
    const b = await openFault();
    b.fake.failOnce('recoverSession');
    await press('recovery-start', b);
    await b.elapse(200);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown(OFFLINE_HINT)).toBe(true);
    expect(toastShown('That did not work. Please try again.')).toBe(false);
    expect(b.state().session?.state).toBe('FAULT');
    expect(isBusy('recovery-start')).toBe(false);
    await press('recovery-start', b);
    expect(b.requests('recoverSession')).toHaveLength(2);
    expect(screen.getByTestId('recovery-analysing')).toBeTruthy();
  });

  it('a 429 is a limit, not an outage (LB-10): the limit toast with the seconds, no offline wording, no link notice', async () => {
    const b = await openFault();
    b.fake.answerOnce('recoverSession', rateLimited(30));
    await press('recovery-start', b);
    await b.elapse(200);
    expect(toastShown(LIMIT)).toBe(true);
    expect(toastShown('Try again in 30 s.')).toBe(true);
    expect(toastShown(OFFLINE)).toBe(false);
    expect(screen.queryByTestId('recovery-link-down')).toBeNull();
    expect(isBusy('recovery-start')).toBe(false);
    expect(b.state().session?.state).toBe('FAULT');
  });

  it('409 (the session left FAULT on the Core meanwhile) → the screen\'s own calm toast, no denial', async () => {
    const b = await openFault();
    b.fake.answerOnce('recoverSession', b.fake.example('recoverSession', 409));
    await press('recovery-start', b);
    await b.elapse(200);
    expect(toastShown('The session is no longer waiting for recovery.')).toBe(true);
    expect(toastShown(DENIED)).toBe(false);
    expect(isBusy('recovery-start')).toBe(false);
  });

  it('link down (rows M0, M1): the notice shows, a press is refused here and sends nothing; the notice leaves when the Core is back and Start works', async () => {
    const b = await openFault();
    expect(screen.queryByTestId('recovery-link-down')).toBeNull();
    b.setReachable(false);
    await b.elapse(3_000, 250);
    expect(screen.getByTestId('recovery-link-down')).toBeTruthy();
    expect(screen.getByText('This device is not connected to the Core server. The screen shows the last state received; recovery can start once the connection is back.')).toBeTruthy();
    expect(screen.getByTestId('recovery-fault')).toBeTruthy();
    await press('recovery-start', b);
    expect(toastShown(READ_ONLY)).toBe(true);
    expect(b.requests('recoverSession')).toHaveLength(0);
    expect(isBusy('recovery-start')).toBe(false);

    b.setReachable(true);
    await b.elapse(10_000, 250);
    expect(screen.queryByTestId('recovery-link-down')).toBeNull();
    await press('recovery-start', b);
    expect(b.requests('recoverSession')).toHaveLength(1);
    expect(screen.getByTestId('recovery-analysing')).toBeTruthy();
  });
});

describe('S5-2: the role hint stays on the device; the Core enforces SESSION_START', () => {
  it('a Technician: the hint names the rule; a press sends nothing and shows the denied toast (the hint, read from the replica)', async () => {
    const b = await openFault({ user: 'rina.wijaya' });
    expect(screen.getByTestId('recovery-start-hint')).toHaveTextContent('Needs an Investigator or Supervisor. You are signed in as Technician.');
    await press('recovery-start', b);
    expect(b.requests('recoverSession')).toHaveLength(0);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown(DENIED_ROLE)).toBe(true);
    expect(b.state().session?.state).toBe('FAULT');
    expect(isBusy('recovery-start')).toBe(false);
  });

  it('an Investigator passes the hint: the request goes to the Core, which is the judge (its 403 is shown, see S2-3)', async () => {
    const b = await openFault();
    expect(screen.getByTestId('recovery-start-hint')).toHaveTextContent('Recovery closes the session as incomplete. It never seals it.');
    b.fake.answerOnce('recoverSession', b.fake.example('recoverSession', 403, 'notPermitted'));
    await press('recovery-start', b);
    await b.elapse(200);
    expect(b.requests('recoverSession')).toHaveLength(1);
    expect(toastShown(DENIED)).toBe(true);
  });
});

describe('S4-8: Acknowledge — one acknowledgeAlert per matching alert, fired without waiting', () => {
  async function openOutcome(options: LiveRecoveryBedOptions = {}): Promise<LiveRecoveryBed> {
    const b = await openFault(options);
    await press('recovery-start', b);
    await runRecovery(b);
    expect(screen.getByTestId('recovery-outcome')).toBeTruthy();
    return b;
  }
  const powerFailAlerts = (b: LiveRecoveryBed) => b.state().alerts.filter((alert) => alert.kind === 'POWER_FAIL');

  it('success: one POST for the fault\'s alert; the Core\'s delta marks it; Home after the ring settles', async () => {
    const b = await openOutcome();
    const [alert] = powerFailAlerts(b);
    expect(alert?.acknowledged).toBe(false);
    await press('recovery-acknowledge', b);
    expect(b.requests('acknowledgeAlert').map((call) => [call.method, call.params['id']])).toEqual([['POST', alert!.id]]);
    expect(powerFailAlerts(b).every((candidate) => candidate.acknowledged)).toBe(true);
    await b.elapse(ACK_SETTLE_MS + 200, 100);
    expect(b.app.getPathname()).toBe('/home');
  });

  it('two matching alerts: both requests are out before either answer arrives (nothing waits), and Home follows on its own clock', async () => {
    const b = await openOutcome({ answerDelayMs: 2_000 });
    // The Core holds a second alert of the same fault (test-only: the engine's alert list is extended).
    const first = powerFailAlerts(b)[0]!;
    await b.onCore((engine) => {
      const alerts = engine.sim.store.getState().alerts;
      const twin = { ...alerts.find((candidate) => candidate.id === first.id)!, id: `ALR-${String(999_001).padStart(6, '0')}` };
      engine.sim.store.setState({ alerts: [...alerts, twin] });
    });
    expect(powerFailAlerts(b)).toHaveLength(2);
    await press('recovery-acknowledge', b);
    await b.elapse(100, 100);
    expect(b.requests('acknowledgeAlert').map((call) => call.params['id']).sort()).toEqual([first.id, 'ALR-999001'].sort());
    expect(powerFailAlerts(b).some((candidate) => candidate.acknowledged)).toBe(false); // no answer yet
    await b.elapse(ACK_SETTLE_MS + 200, 100);
    expect(b.app.getPathname()).toBe('/home'); // before the 2 s answers
    await b.elapse(2_000, 100);
    expect(powerFailAlerts(b).every((candidate) => candidate.acknowledged)).toBe(true);
  });

  it('refusal: a 403 NOT_PERMITTED (RESIDUAL-W66-2, W83 ledger #42: operation 70 has no notPermitted example) → the denied toast; the alert stays unacknowledged; Home still opens', async () => {
    const b = await openOutcome();
    b.fake.answerOnce('acknowledgeAlert', refusal(403, 'NOT_PERMITTED', 'Not permitted.'));
    await press('recovery-acknowledge', b);
    await b.elapse(ACK_SETTLE_MS + 200, 100);
    expect(toastShown(DENIED)).toBe(true);
    expect(powerFailAlerts(b).every((candidate) => !candidate.acknowledged)).toBe(true);
    expect(b.app.getPathname()).toBe('/home');
  });

  it('refusal by the contract\'s own 403 example (originNotAllowed) → "The Core refused this action"', async () => {
    const b = await openOutcome();
    b.fake.answerOnce('acknowledgeAlert', b.fake.example('acknowledgeAlert', 403, 'originNotAllowed'));
    await press('recovery-acknowledge', b);
    await b.elapse(200, 100);
    expect(toastShown('The Core refused this action')).toBe(true);
    expect(powerFailAlerts(b).every((candidate) => !candidate.acknowledged)).toBe(true);
  });

  it('outage: "Core server unreachable" once; the alert stays unacknowledged; Home still opens', async () => {
    const b = await openOutcome();
    b.fake.failOnce('acknowledgeAlert');
    await press('recovery-acknowledge', b);
    await b.elapse(ACK_SETTLE_MS + 200, 100);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(powerFailAlerts(b).every((candidate) => !candidate.acknowledged)).toBe(true);
    expect(b.app.getPathname()).toBe('/home');
  });
});

describe('Recovery under React StrictMode (decision D158, finding F69-1)', () => {
  it('mounted twice by StrictMode, the screen starts no Core command at mount; one press sends ONE recoverSession', async () => {
    const b = await openFault({ strict: true });
    await b.elapse(3_000, 250);
    const commands = b.fake.log.requests.filter((call) => call.method !== 'GET').map((call) => call.operationId ?? '(no operation)');
    expect(commands.filter((operationId) => !['signIn', 'touchSession'].includes(operationId))).toEqual([]);
    await press('recovery-start', b);
    await b.elapse(200);
    expect(b.requests('recoverSession')).toHaveLength(1);
    expect(screen.getByTestId('recovery-analysing')).toBeTruthy();
  });
});

describe('Simulated mode is unchanged (the control of CLG (a))', () => {
  it('Start is never busy, no link notice and no derived line; FAULT → RECOVERY before the press returns', async () => {
    const h = renderRecoveryApp();
    await settleSimulated();
    expect(screen.queryByTestId('recovery-live-derived')).toBeNull();
    expect(screen.queryByTestId('recovery-link-down')).toBeNull();
    expect(screen.getByTestId('recovery-start').props.accessibilityState?.busy).not.toBe(true);
    act(() => {
      fireEvent.press(screen.getByTestId('recovery-start'));
    });
    expect(h.sim.store.getState().session?.state).toBe('RECOVERY');
    expect(screen.queryByTestId('recovery-start-spinner')).toBeNull();
    expect(screen.getByText(`Recovery analysis running`)).toBeTruthy();
    expect(formatClock(h.sim.store.getState().session?.fault?.at ?? null)).toMatch(/\d/);
    h.app.unmount();
  });
});
