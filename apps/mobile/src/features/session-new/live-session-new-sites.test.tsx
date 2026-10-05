// Backend task, plan row W67: Start Session in LIVE mode — settle sites S1-4 (create, then pre-check)
// and S2-2 (acknowledge, retry, cancel; the start is in `live-session-new-handoff.test.tsx`), each with
// its success, its refusal (a 403 named by its example `notPermitted`: the denied toast, AC-C-48) and
// an outage, on the app's real Live source over the contract-checked fake transport.
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { rateLimited } from '@dems/shared/live/testing';
import { OPERATORS, PRECHECK_TOTAL_MAX_MS } from '@dems/shared/sim';
import { renderLiveSessionNew, resetLiveSessionNewBed, type LiveSessionNewBed, type LiveSessionNewBedOptions } from './testing/live-session-new-bed';

let bed: LiveSessionNewBed | null = null;

beforeEach(async () => {
  await resetLiveSessionNewBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
});

const DENIED = 'Not permitted';
const DENIED_ROLE = 'Requires the Investigator role';
const OFFLINE = 'Core server unreachable';
const OFFLINE_HINT = 'Nothing was changed.';
const isBusy = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.busy === true;
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

async function pressAndSettle(testID: string, b: LiveSessionNewBed): Promise<void> {
  fireEvent.press(screen.getByTestId(testID));
  await b.flush();
  await b.elapse(200);
}

async function openStep1(options: LiveSessionNewBedOptions = {}): Promise<LiveSessionNewBed> {
  const b = await renderLiveSessionNew(options);
  bed = b;
  await b.openFlow();
  await fillStep1();
  return b;
}

/** Step 1 done over the Core; the Core's gate then runs to its outcome. */
async function openGate(options: LiveSessionNewBedOptions = {}): Promise<LiveSessionNewBed> {
  const b = await openStep1(options);
  await pressAndSettle('session-new-next', b);
  expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
  await b.runCore(PRECHECK_TOTAL_MAX_MS);
  return b;
}

const operator = OPERATORS[0]!;
const CREATE_INPUT = {
  caseNumber: 'LP/2026/1001-0008',
  subjectType: 'SAKSI',
  subjectName: 'Rahmat Hidayat',
  investigatorId: operator.id,
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
} as const;

describe('S1-4: Next on step 1 — createSession, then beginPrecheck (nested settle)', () => {
  it('success: one create, then one pre-check start, in that order; step 2 opens on the Core\'s PRECHECK', async () => {
    const b = await openStep1();
    await pressAndSettle('session-new-next', b);
    expect(b.fake.log.operationIds().filter((id) => id === 'createSession' || id === 'beginPrecheck')).toEqual(['createSession', 'beginPrecheck']);
    expect(b.state().session?.state).toBe('PRECHECK');
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    expect(screen.queryByTestId('session-new-create-error')).toBeNull();
  });

  it('a CREATE session with other details: 409, then cancel and create again, then the pre-check — in order (D-2 of the web)', async () => {
    const b = await renderLiveSessionNew({
      setup: (engine) => {
        const result = engine.sim.actions.createSession(CREATE_INPUT);
        if (!result.ok) throw new Error(result.reason);
      },
    });
    bed = b;
    await b.openFlow();
    // The form is prefilled from the Core's CREATE session (S4-1 of the web: the replica holds it).
    expect(screen.getByTestId('session-new-subject-name').props.value).toBe('Rahmat Hidayat');
    fireEvent.changeText(screen.getByTestId('session-new-subject-name'), 'Dewi Lestari');
    await act(async () => {});
    await pressAndSettle('session-new-next', b);
    expect(b.fake.log.operationIds().filter((id) => ['createSession', 'cancelSession', 'beginPrecheck'].includes(id))).toEqual([
      'createSession',
      'cancelSession',
      'createSession',
      'beginPrecheck',
    ]);
    expect(b.state().session?.state).toBe('PRECHECK');
    expect(b.state().session?.input.subjectName).toBe('Dewi Lestari');
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
  });

  it('refusal: createSession 403 (example notPermitted) → the denied toast and the inline error by reason; no pre-check; Next idle', async () => {
    const b = await openStep1();
    b.fake.answerOnce('createSession', b.fake.example('createSession', 403, 'notPermitted'));
    await pressAndSettle('session-new-next', b);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown(DENIED_ROLE)).toBe(true);
    expect(screen.getByTestId('session-new-create-error')).toBeTruthy();
    expect(screen.getByText('Your role cannot start sessions. Ask an investigator or a supervisor.')).toBeTruthy();
    expect(b.requests('beginPrecheck')).toHaveLength(0);
    expect(b.state().session).toBeNull();
    expect(screen.getByTestId('session-new-step-1')).toBeTruthy();
    expect(isBusy('session-new-next')).toBe(false);
  });

  it('refusal of the second leg: beginPrecheck 403 (example notPermitted) → the denied toast, no inline error; the setup session stays on the Core', async () => {
    const b = await openStep1();
    b.fake.answerOnce('beginPrecheck', b.fake.example('beginPrecheck', 403, 'notPermitted'));
    await pressAndSettle('session-new-next', b);
    expect(toastShown(DENIED)).toBe(true);
    expect(screen.queryByTestId('session-new-create-error')).toBeNull();
    expect(b.state().session?.state).toBe('CREATE');
    expect(screen.getByTestId('session-new-step-1')).toBeTruthy();
    expect(isBusy('session-new-next')).toBe(false);
  });

  it('outage: "Core server unreachable. Nothing was changed."; no inline error; Next idle; a second press sends again', async () => {
    const b = await openStep1();
    b.fake.failOnce('createSession');
    await pressAndSettle('session-new-next', b);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown(OFFLINE_HINT)).toBe(true);
    expect(screen.queryByTestId('session-new-create-error')).toBeNull();
    expect(b.state().session).toBeNull();
    expect(isBusy('session-new-next')).toBe(false);
    await pressAndSettle('session-new-next', b);
    expect(b.requests('createSession')).toHaveLength(2);
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
  });

  it('a 429 is a limit, not an outage (LB-10): the limit toast with the seconds, no offline wording, no link notice', async () => {
    const b = await openStep1();
    b.fake.answerOnce('createSession', rateLimited(30));
    await pressAndSettle('session-new-next', b);
    expect(toastShown('The Core server is limiting requests from this tablet')).toBe(true);
    expect(toastShown('Try again in 30 s.')).toBe(true);
    expect(toastShown(OFFLINE)).toBe(false);
    expect(screen.queryByTestId('session-new-link-down')).toBeNull();
    expect(screen.queryByTestId('session-new-create-error')).toBeNull();
    expect(isBusy('session-new-next')).toBe(false);
  });

  it('422: the Core is the judge of the input (F59) → the inline INVALID_INPUT error', async () => {
    const b = await openStep1();
    b.fake.answerOnce('createSession', b.fake.example('createSession', 422, 'invalidInput'));
    await pressAndSettle('session-new-next', b);
    expect(screen.getByText('Check the session details and try again.')).toBeTruthy();
    expect(b.requests('beginPrecheck')).toHaveLength(0);
  });
});

describe('S2-2: acknowledge the warnings (Next on step 2)', () => {
  const warn: LiveSessionNewBedOptions = { setup: (engine) => engine.sim.actions.inject('MIC_NO_SIGNAL', { channel: 'AUDIO-02' }) };

  async function openWarn(): Promise<LiveSessionNewBed> {
    const b = await openGate(warn);
    expect(b.state().session?.precheck.outcome).toBe('WARN');
    expect(screen.getByTestId('session-new-gate-warn')).toBeTruthy();
    fireEvent.press(screen.getByTestId('session-new-acknowledge'));
    return b;
  }

  it('success: one acknowledge, then step 3 on the Core\'s ARMED', async () => {
    const b = await openWarn();
    await pressAndSettle('session-new-next', b);
    expect(b.requests('acknowledgePrecheckWarnings')).toHaveLength(1);
    expect(b.state().session?.state).toBe('ARMED');
    expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
  });

  it('refusal (example notPermitted): the denied toast; step 2 stays; Next idle', async () => {
    const b = await openWarn();
    b.fake.answerOnce('acknowledgePrecheckWarnings', b.fake.example('acknowledgePrecheckWarnings', 403, 'notPermitted'));
    await pressAndSettle('session-new-next', b);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown('That action could not be completed. Please try again.')).toBe(false);
    expect(b.state().session?.state).toBe('PRECHECK');
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    expect(isBusy('session-new-next')).toBe(false);
  });

  it('outage: "Core server unreachable"; step 2 stays', async () => {
    const b = await openWarn();
    b.fake.failOnce('acknowledgePrecheckWarnings');
    await pressAndSettle('session-new-next', b);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
  });
});

describe('S2-2: run the checks again', () => {
  const block: LiveSessionNewBedOptions = { setup: (engine) => engine.sim.actions.inject('STORAGE_FULL') };

  async function openBlock(): Promise<LiveSessionNewBed> {
    const b = await openGate(block);
    expect(b.state().session?.precheck.outcome).toBe('BLOCK');
    expect(screen.getByTestId('session-new-gate-block')).toBeTruthy();
    return b;
  }

  it('success: one retry; the Core runs all eight checks again', async () => {
    const b = await openBlock();
    act(() => b.engine.sim.actions.clearFault('STORAGE_FULL'));
    await pressAndSettle('session-new-retry-checks', b);
    expect(b.requests('retryPrecheck')).toHaveLength(1);
    expect(b.state().session?.precheck.outcome).toBeNull();
    await b.runCore(PRECHECK_TOTAL_MAX_MS);
    expect(b.state().session?.state).toBe('ARMED');
  });

  it('refusal (example notPermitted): the denied toast; the block stays', async () => {
    const b = await openBlock();
    b.fake.answerOnce('retryPrecheck', b.fake.example('retryPrecheck', 403, 'notPermitted'));
    await pressAndSettle('session-new-retry-checks', b);
    expect(toastShown(DENIED)).toBe(true);
    expect(screen.getByTestId('session-new-gate-block')).toBeTruthy();
    expect(isBusy('session-new-retry-checks')).toBe(false);
  });

  it('outage: "Core server unreachable"; the block stays', async () => {
    const b = await openBlock();
    b.fake.failOnce('retryPrecheck');
    await pressAndSettle('session-new-retry-checks', b);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(screen.getByTestId('session-new-gate-block')).toBeTruthy();
  });
});

describe('S2-2: cancel the session (Back → "Cancel this session?")', () => {
  async function openCancelDialog(): Promise<LiveSessionNewBed> {
    const b = await openGate();
    act(() => router.back());
    expect(screen.getByText('Cancel this session?')).toBeTruthy();
    return b;
  }

  it('success: one cancel; the wizard leaves once the Core cancelled', async () => {
    const b = await openCancelDialog();
    await pressAndSettle('back-guard-leave', b);
    expect(b.requests('cancelSession')).toHaveLength(1);
    expect(b.state().session).toBeNull();
    expect(b.app.getPathname()).toBe('/home');
  });

  it('refusal (example notPermitted): the denied toast; the dialog stays open and the wizard stays', async () => {
    const b = await openCancelDialog();
    b.fake.answerOnce('cancelSession', b.fake.example('cancelSession', 403, 'notPermitted'));
    await pressAndSettle('back-guard-leave', b);
    expect(toastShown(DENIED)).toBe(true);
    expect(b.app.getPathname()).toBe('/session/new');
    expect(screen.getByText('Cancel this session?')).toBeTruthy();
    expect(b.state().session?.state).toBe('ARMED');
  });

  it('outage: "Core server unreachable"; the dialog stays open and the wizard stays', async () => {
    const b = await openCancelDialog();
    b.fake.failOnce('cancelSession');
    await pressAndSettle('back-guard-leave', b);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(b.app.getPathname()).toBe('/session/new');
    expect(screen.getByText('Cancel this session?')).toBeTruthy();
  });
});
