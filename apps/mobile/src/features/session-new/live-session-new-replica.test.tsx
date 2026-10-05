// Backend task, plan row W67: Start Session in LIVE mode — what the screen reads from the replica and
// from the Core link, on the app's real Live source over the contract-checked fake transport:
//   S4-6  the case-number scan computes the next number on the device from the replicated counters
//         and history (no request; [CS:§8.7]);
//   S5-6  the investigator list is a hint from the replicated roles; the Core judges the create;
//   §6.3 / AC-C-50  losing SESSION_START while the wizard is open leaves it for /home;
//   the Core link (row M0's one rule): a recording starts only over a connected link, and a blocked
//   CORE check reads as this device's own connection (decision F69).
// S4-6 and S5-6 send nothing, so neither has a refusal of its own: the refusal that follows from a
// stale hint is the Core's 403 on the create (S1-4), shown once more here for S5-6.
//
// Import order: the test setup, then the router harness, then the beds (see their headers).
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { DeltaMessage } from '@dems/shared/api';
import { OperatorRole, PRECHECK_TOTAL_MAX_MS, ROLE_PERMISSIONS, type SimOperator } from '@dems/shared/sim';
import { renderLiveSessionNew, resetLiveSessionNewBed, type LiveSessionNewBed, type LiveSessionNewBedOptions } from './testing/live-session-new-bed';
import { renderSessionNewApp, settle as settleSimulated } from './testing/session-new-harness';

let bed: LiveSessionNewBed | null = null;

beforeEach(async () => {
  await resetLiveSessionNewBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
});

const next = () => screen.getByTestId('session-new-next');
const isDisabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;
const toastShown = (text: string) => screen.queryAllByText(text).length > 0;

async function fillStep1(name = 'Ahmad Fauzi'): Promise<void> {
  const settleValidation = () => act(async () => {});
  fireEvent.press(screen.getByTestId('session-new-scan'));
  await settleValidation();
  fireEvent.press(screen.getByTestId('session-new-subject-TERSANGKA'));
  await settleValidation();
  fireEvent.changeText(screen.getByTestId('session-new-subject-name'), name);
  await settleValidation();
}

async function open(options: LiveSessionNewBedOptions = {}): Promise<LiveSessionNewBed> {
  const b = await renderLiveSessionNew(options);
  bed = b;
  await b.openFlow();
  return b;
}

async function openReady(options: LiveSessionNewBedOptions = {}): Promise<LiveSessionNewBed> {
  const b = await open(options);
  await fillStep1();
  fireEvent.press(next());
  await b.flush();
  await b.elapse(200);
  await b.runCore(PRECHECK_TOTAL_MAX_MS);
  fireEvent.press(next());
  await b.flush();
  expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
  fireEvent.press(screen.getByTestId('session-new-countdown'));
  return b;
}

/** Opens the investigator Select (a bottom sheet on phones; mounted on demand, F-79-2) and returns the IDs it offers. */
async function investigatorOptions(): Promise<string[]> {
  fireEvent.press(screen.getByTestId('session-new-investigator'));
  fireEvent(screen.getByTestId('sheet-content-signal'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 300 } } });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  return ['OPR-001', 'OPR-002', 'OPR-003'].filter((id) => screen.queryByTestId(`session-new-investigator-${id}`) !== null);
}

describe('S4-6: the case-number scan reads the replica and sends nothing', () => {
  it('success: the next number from the replicated counters and history, on the Live clock; no request', async () => {
    const b = await open();
    const before = b.fake.log.requests.length;
    fireEvent.press(screen.getByTestId('session-new-scan'));
    await act(async () => {});
    expect(screen.getByTestId('session-new-case-number').props.value).toBe('LP/2026/1001-0008');
    expect(b.fake.log.requests.length).toBe(before);
    expect(b.requests('scanCaseNumber')).toHaveLength(0);
  });

  it('the Core moved its counter (another client took numbers): the scan follows the replica', async () => {
    const b = await open();
    const meta = JSON.parse(JSON.stringify(b.engine.sim.store.getState().meta)) as { counters: { caseNumber: number } };
    meta.counters.caseNumber = 12;
    act(() => void b.connection().delta([{ op: 'replace', slice: 'meta', value: meta } as DeltaMessage['ops'][number]]));
    await b.flush();
    fireEvent.press(screen.getByTestId('session-new-scan'));
    await act(async () => {});
    expect(screen.getByTestId('session-new-case-number').props.value).toBe('LP/2026/1001-0012');
  });

  it('outage: with the Core link down the scan still fills the number (computed on the device), and nothing is sent', async () => {
    const b = await open();
    b.setReachable(false);
    await b.elapse(1_000);
    const before = b.fake.log.requests.length;
    fireEvent.press(screen.getByTestId('session-new-scan'));
    await act(async () => {});
    expect(screen.getByTestId('session-new-case-number').props.value).toBe('LP/2026/1001-0008');
    expect(b.fake.log.requests.length).toBe(before);
  });
});

describe('S5-6: the investigator list is a hint from the replicated roles', () => {
  it('success: the list follows the replica — an operator the Core made TECHNICIAN leaves it', async () => {
    const b = await open();
    expect(await investigatorOptions()).toEqual(['OPR-001', 'OPR-002']);
    const operators = (JSON.parse(JSON.stringify(b.engine.sim.store.getState().operators)) as SimOperator[]).map((operator) =>
      operator.id === 'OPR-002' ? { ...operator, role: OperatorRole.TECHNICIAN } : operator,
    );
    act(() => void b.connection().delta([{ op: 'replace', slice: 'operators', value: operators } as DeltaMessage['ops'][number]]));
    await b.flush();
    expect(screen.queryByTestId('session-new-investigator-OPR-002')).toBeNull();
    expect(screen.getByTestId('session-new-investigator-OPR-001')).toBeTruthy();
  });

  it('outage: with the Core link down the list keeps the last replica, and nothing is sent for it', async () => {
    const b = await open();
    b.setReachable(false);
    await b.elapse(1_000);
    const before = b.fake.log.requests.length;
    expect(await investigatorOptions()).toEqual(['OPR-001', 'OPR-002']);
    expect(b.fake.log.requests.length).toBe(before);
  });

  it('the hint is not the judge: the replica offers the operator, the Core refuses the create (example notPermitted) → the denied toast', async () => {
    const b = await open();
    await fillStep1();
    b.fake.answerOnce('createSession', b.fake.example('createSession', 403, 'notPermitted'));
    fireEvent.press(next());
    await b.flush();
    await b.elapse(200);
    expect(toastShown('Not permitted')).toBe(true);
    expect(b.state().session).toBeNull();
  });
});

describe('§6.3, AC-C-50: losing SESSION_START while the wizard is open', () => {
  it('leaves for /home with the role-change toast; the setup session stays on the Core and nothing is cancelled', async () => {
    const b = await open();
    await fillStep1();
    fireEvent.press(next());
    await b.flush();
    await b.elapse(200);
    expect(b.state().session?.state).toBe('PRECHECK');
    act(() => void b.connection().sessionUpdated({ id: 'OPR-001', role: OperatorRole.TECHNICIAN }, [...ROLE_PERMISSIONS.TECHNICIAN]));
    await b.flush();
    await b.elapse(200);
    expect(b.app.getPathname()).toBe('/home');
    expect(toastShown('Your role is now Technician. The available actions have changed.')).toBe(true);
    expect(b.requests('cancelSession')).toHaveLength(0);
    expect(b.state().session?.state).toBe('PRECHECK');
  });

  it('a role change that keeps SESSION_START (INVESTIGATOR → SUPERVISOR) does not leave', async () => {
    const b = await open();
    act(() => void b.connection().sessionUpdated({ id: 'OPR-001', role: OperatorRole.SUPERVISOR }, [...ROLE_PERMISSIONS.SUPERVISOR]));
    await b.flush();
    await b.elapse(200);
    expect(b.app.getPathname()).toBe('/session/new');
    expect(screen.getByTestId('session-new-step-1')).toBeTruthy();
  });
});

describe('the Core link: a recording starts only over a connected link (row M0\'s one rule; F69)', () => {
  it('link down on Ready: the notice shows and Start is disabled; it stays through the reconnect attempts; link back: hidden, Start enabled', async () => {
    const b = await openReady();
    expect(screen.queryByTestId('session-new-link-down')).toBeNull();
    expect(isDisabled('session-new-start')).toBe(false);

    b.setReachable(false);
    await b.flush();
    expect(screen.getByTestId('session-new-link-down')).toBeTruthy();
    expect(within(screen.getByTestId('session-new-link-down')).getByText('Core server unreachable')).toBeTruthy();
    expect(isDisabled('session-new-start')).toBe(true);
    // Reconnect attempts (CONNECTING, OFFLINE, …) keep it: no flicker.
    for (let second = 0; second < 4; second += 1) {
      await b.elapse(1_000, 250);
      expect(screen.getByTestId('session-new-link-down')).toBeTruthy();
    }
    expect(b.requests('startSession')).toHaveLength(0);

    b.setReachable(true);
    await b.elapse(10_000, 250);
    expect(screen.queryByTestId('session-new-link-down')).toBeNull();
    expect(isDisabled('session-new-start')).toBe(false);
  });

  it('a reconnect attempt that hangs in CONNECTING keeps the notice (the one rule\'s hysteresis, no flicker)', async () => {
    const b = await openReady();
    b.setReachable(false);
    await b.flush();
    expect(screen.getByTestId('session-new-link-down')).toBeTruthy();
    // The next attempts get no answer at all: the link stays CONNECTING, and the notice stays.
    b.setReachable('hanging');
    await b.elapse(3_000, 250);
    expect(screen.getByTestId('session-new-link-down')).toBeTruthy();
    expect(isDisabled('session-new-start')).toBe(true);
  });

  it('a running 3-2-1 stops when the link goes down', async () => {
    const b = await openReady();
    fireEvent.press(screen.getByTestId('session-new-countdown')); // countdown back on
    fireEvent.press(screen.getByTestId('session-new-start'));
    expect(screen.getByTestId('session-new-countdown-overlay')).toBeTruthy();
    b.setReachable(false);
    await b.flush();
    expect(screen.queryByTestId('session-new-countdown-overlay')).toBeNull();
    expect(b.state().session?.state).toBe('ARMED');
  });

  it('a blocked CORE check reads as this device\'s own connection in Live mode', async () => {
    const b = await open({ setup: (engine) => engine.sim.actions.setTabletLink('OFFLINE') });
    await fillStep1();
    fireEvent.press(next());
    await b.flush();
    await b.elapse(200);
    await b.runCore(PRECHECK_TOTAL_MAX_MS);
    expect(screen.getByTestId('session-new-gate-block')).toBeTruthy();
    expect(screen.getByTestId('session-new-gate-live-core')).toBeTruthy();
    expect(screen.getByText("In Live mode this check is this device's own connection to the Core server. Run the checks again once it is connected.")).toBeTruthy();
  });

  it('Simulated mode: no link notice and no Live CORE hint, even with the tablet link OFFLINE (the step looks as before)', async () => {
    const h = renderSessionNewApp({
      setup: (test) => {
        test.sim.actions.setTabletLink('OFFLINE');
        const result = test.sim.actions.createSession({
          caseNumber: 'LP/2026/1001-0008',
          subjectType: 'SAKSI',
          subjectName: 'Rahmat Hidayat',
          investigatorId: 'OPR-001',
          room: 'Interview Room 1',
          profileId: 'STANDARD_1080P25',
        });
        if (!result.ok) throw new Error(result.reason);
        test.sim.actions.beginPrecheck();
      },
    });
    await settleSimulated();
    h.openFlow('/session/new?step=2');
    h.tick(PRECHECK_TOTAL_MAX_MS);
    expect(screen.getByTestId('session-new-gate-block')).toBeTruthy();
    expect(screen.queryByTestId('session-new-gate-live-core')).toBeNull();
    expect(screen.queryByTestId('session-new-link-down')).toBeNull();
    h.app.unmount();
  });
});
