// Backend task, plan row W67: Start Session in LIVE mode — settle sites S1-4 (create, then pre-check)
// and S2-2 (acknowledge, retry, cancel; the start is in `live-session-new-handoff.test.tsx`), each with
// its success, its refusal (a 403 named by its example `notPermitted`: the denied toast, AC-C-48) and
// an outage, on the app's real Live source over the contract-checked fake transport.
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { rateLimited, OUTAGE } from '@dems/shared/live/testing';
import { OPERATORS, PRECHECK_TOTAL_MAX_MS } from '@dems/shared/sim';
import { renderLiveSessionNew, resetLiveSessionNewBed, type LiveSessionNewBed, type LiveSessionNewBedOptions } from './testing/live-session-new-bed';
import { en } from '@dems/shared/i18n';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { sessionNewEn } from './i18n';
import { renderSessionNewApp, settle } from './testing/session-new-harness';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('live session new sites', () => {
unmountBeforeTheHooksOfThisGroup();

let bed: LiveSessionNewBed | null = null;

beforeEach(async () => {
  await resetLiveSessionNewBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
});

const DENIED = 'Not permitted';
const DENIED_ROLE = 'Requires the Investigator or Supervisor role';
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
    expect(toastShown('The Core server is limiting requests from this device')).toBe(true);
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
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `live-session-new-followups.test.tsx` (test-suite consolidation, D233): every case as it was.
// Row M1, the follow-ups of W67 in Start Session (decisions D157 DN-9 and F-2), on the app's real Live
// source over the contract-checked fake transport (see `testing/live-session-new-bed.tsx`) and, for
// Simulated mode, on the test simulator (`testing/session-new-harness.tsx`).
//
//  1. The cancel confirm ("Cancel this session?" → "Cancel session") is a pending control (LB-1,
//     AC-C-57, AC-C-58) through the new `busy` prop of navigation's `BackGuardDialog`: an answer 1 s
//     late sends one cancel for two presses, shows no spinner at 300 ms and the kit's Spinner inside
//     the leave button at 500 ms, and leaves once the Core cancelled; an answer after 50 ms never
//     shows the spinner.
//  2. Truthful copy (§3.2, MD-8): in Live mode the step 2 hint and the case-number button's label say
//     what is true and nothing about a simulation; Simulated mode keeps its words.
//
// Import order: the test setup, then the router harness, then the beds (see their headers).
describe('ways out of a session in setup, the cancel confirm and truthful copy', () => {
unmountBeforeTheHooksOfThisGroup();
let bed: LiveSessionNewBed | null = null;

beforeEach(async () => {
  await resetLiveSessionNewBed();
  resetMissingKeys();
});

afterEach(() => {
  jest.restoreAllMocks();
  resetMotionStateForTests();
  bed?.stop();
  bed = null;
});

const SIMULATION = /simulat/i;
const LIVE_HINT = 'Microphone levels from the Core server';
const LIVE_SCAN = 'Fill in the next case number';
const SIMULATED_HINT = 'Speak to test (simulated)';
const SIMULATED_SCAN = 'Scan case number (simulated)';
const leave = () => screen.getByTestId('back-guard-leave');

async function fillStep1(name = 'Ahmad Fauzi'): Promise<void> {
  const settleValidation = () => act(async () => {});
  fireEvent.press(screen.getByTestId('session-new-scan'));
  await settleValidation();
  fireEvent.press(screen.getByTestId('session-new-subject-TERSANGKA'));
  await settleValidation();
  fireEvent.changeText(screen.getByTestId('session-new-subject-name'), name);
  await settleValidation();
}

/** Step 1 done over the Core (answers at once); the Core's gate runs to its outcome; Back opens the cancel confirm. */
async function liveCancelConfirm(): Promise<LiveSessionNewBed> {
  const b = await renderLiveSessionNew();
  bed = b;
  await b.openFlow();
  await fillStep1();
  fireEvent.press(screen.getByTestId('session-new-next'));
  await b.flush();
  await b.elapse(200);
  expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
  await b.runCore(PRECHECK_TOTAL_MAX_MS);
  act(() => router.back());
  expect(screen.getByText('Cancel this session?')).toBeTruthy();
  return b;
}

/** Every test ID under the dialog outside the leave button. */
function idsOutsideLeave(): string[] {
  const inside = new Set(within(leave()).queryAllByTestId(/.*/));
  return within(screen.getByTestId('back-guard-dialog'))
    .queryAllByTestId(/.*/)
    .filter((node) => !inside.has(node) && node !== leave())
    .map((node) => String(node.props.testID))
    .sort();
}

// Fix wave M (re-check 70 finding G70d-03): the ways out of a session that exists, and a session that is gone.
describe('a session in setup has its ways out, and a session cancelled elsewhere clears the form (G70d-03)', () => {
  it('the confirm offers "Go to Home, keep the session open": nothing is sent, the session stays ARMED, Home is shown', async () => {
    const b = await liveCancelConfirm();
    expect(screen.getByTestId('back-guard-choices')).toBeTruthy();
    fireEvent.press(screen.getByTestId('back-guard-home'));
    await b.flush();
    expect(b.requests('cancelSession')).toHaveLength(0);
    expect(b.state().session?.state).toBe('ARMED');
    expect(b.app.getPathname()).toBe('/home');
  });

  it('the header offers "Cancel session" only while a session exists; it opens the same confirm, and the confirm cancels', async () => {
    const b = await renderLiveSessionNew();
    bed = b;
    await b.openFlow();
    expect(screen.queryByTestId('session-new-cancel')).toBeNull(); // CONTROL: no session yet
    await fillStep1();
    fireEvent.press(screen.getByTestId('session-new-next'));
    await b.flush();
    await b.elapse(200);
    await b.runCore(PRECHECK_TOTAL_MAX_MS);
    expect(screen.queryByTestId('back-guard-dialog')).toBeNull();
    fireEvent.press(screen.getByTestId('session-new-cancel'));
    await b.flush();
    expect(screen.getByText('Cancel this session?')).toBeTruthy();
    fireEvent.press(leave());
    await b.flush();
    await b.elapse(200);
    expect(b.requests('cancelSession')).toHaveLength(1);
    expect(b.state().session).toBeNull();
    expect(b.app.getPathname()).toBe('/home');
  });

  it('the session is cancelled on another client: the form is cleared, the screen names the session, Next is disabled, an open confirm closes', async () => {
    const b = await liveCancelConfirm(); // the confirm of the armed session is open
    const sessionId = b.state().session?.id ?? '';
    expect(sessionId).not.toBe('');
    await b.coreDoes((engine) => engine.sim.actions.cancel());
    await b.elapse(200);
    expect(b.state().session).toBeNull();
    expect(b.app.getPathname()).toBe('/session/new');
    expect(screen.getByTestId('session-new-step-1')).toBeTruthy();
    expect(within(screen.getByTestId('session-new-cancelled-elsewhere')).getByText(new RegExp(sessionId))).toBeTruthy();
    expect(screen.getByTestId('session-new-subject-name').props.value).toBe('');
    expect(screen.getByTestId('session-new-case-number').props.value).toBe('');
    expect(screen.getByTestId('session-new-subject-TERSANGKA').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId('session-new-next').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByText('Cancel this session?')).toBeNull();
    expect(screen.queryByText(en.sessionNew.cancelDialog.title)).toBeNull();
    expect(screen.queryByTestId('session-new-cancel')).toBeNull();
    expect(b.requests('cancelSession')).toHaveLength(0);
    // The cleared form is not "typed details": Back leaves without a question.
    act(() => router.back());
    await b.flush();
    expect(b.app.getPathname()).toBe('/home');
  });

  it('CONTROL: the screen\'s own cancel is not "cancelled on another client"', async () => {
    const b = await liveCancelConfirm();
    b.answerDelayMs = 300;
    fireEvent.press(leave());
    await b.flush();
    await b.elapse(100);
    expect(screen.queryByTestId('session-new-cancelled-elsewhere')).toBeNull();
    await b.elapse(400);
    expect(screen.queryByTestId('session-new-cancelled-elsewhere')).toBeNull();
    expect(b.app.getPathname()).toBe('/home');
  });
});

describe('the cancel confirm is a pending control (LB-1, AC-C-57, AC-C-58; DN-9)', () => {
  it('an answer 1 s late: two presses send one cancel; no spinner at 300 ms; the Spinner inside the leave button at 500 ms; it leaves once the Core cancelled', async () => {
    const b = await liveCancelConfirm();
    b.answerDelayMs = 1_000;
    const outside = idsOutsideLeave();

    fireEvent.press(leave());
    fireEvent.press(leave());
    await b.flush();
    expect(b.requests('cancelSession')).toHaveLength(1);
    // LB-1 (the follow-up's DN-4): marked busy at the PRESS, its look unchanged.
    expect(leave().props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.queryByTestId('back-guard-leave-spinner')).toBeNull();

    await b.elapse(300);
    expect(screen.queryByTestId('back-guard-leave-spinner')).toBeNull();
    expect(leave().props.accessibilityState).toMatchObject({ busy: true });
    // A third press while it is out sends nothing either.
    fireEvent.press(leave());
    await b.flush();
    expect(b.requests('cancelSession')).toHaveLength(1);

    await b.elapse(200); // 500 ms after the press
    expect(within(leave()).getByTestId('back-guard-leave-spinner')).toBeTruthy();
    expect(leave().props.accessibilityState).toMatchObject({ busy: true });
    expect(idsOutsideLeave()).toEqual(outside);
    fireEvent.press(leave());
    await b.flush();
    expect(b.requests('cancelSession')).toHaveLength(1);
    expect(b.app.getPathname()).toBe('/session/new');

    await b.elapse(800);
    expect(b.requests('cancelSession')).toHaveLength(1);
    expect(b.state().session).toBeNull();
    expect(b.app.getPathname()).toBe('/home');
  });

  it('an answer after 50 ms: no spinner is ever rendered; it leaves', async () => {
    const b = await liveCancelConfirm();
    b.answerDelayMs = 50;
    fireEvent.press(leave());
    await b.flush();
    for (let elapsed = 0; elapsed < 100; elapsed += 10) {
      expect(screen.queryByTestId('back-guard-leave-spinner')).toBeNull();
      await b.elapse(10, 10);
    }
    await b.elapse(200);
    expect(screen.queryByTestId('back-guard-leave-spinner')).toBeNull();
    expect(b.requests('cancelSession')).toHaveLength(1);
    expect(b.app.getPathname()).toBe('/home');
  });

  it('a refused cancel (outage): the spinner goes with the answer, the dialog stays, and the next press sends again', async () => {
    const b = await liveCancelConfirm();
    // The Core is unreachable and the transport says so only after 1 s.
    b.fake.answerOnce('cancelSession', { ...OUTAGE, delayMs: 1_000 });
    fireEvent.press(leave());
    await b.flush();
    await b.elapse(500);
    expect(within(leave()).getByTestId('back-guard-leave-spinner')).toBeTruthy();
    await b.elapse(1_000);
    expect(screen.queryByTestId('back-guard-leave-spinner')).toBeNull();
    expect(screen.getByText('Cancel this session?')).toBeTruthy();
    expect(b.app.getPathname()).toBe('/session/new');
    fireEvent.press(leave());
    await b.flush();
    await b.elapse(200);
    expect(b.requests('cancelSession')).toHaveLength(2);
    expect(b.app.getPathname()).toBe('/home');
  });
});

describe('the cancel confirm holds while the cancel is out (S3-1, B-6, LB-6; the follow-up\'s F5)', () => {
  // B-6: "Cancel: the dialog's confirm is busy; leaving happens in `ok`". S3-1: "The dialog keeps its busy
  // state until the settle … and closes in `done`". LB-6: on an outage "a dialog … stays open". So while
  // the cancel request is out, "Keep session" cannot close the dialog: the Core's answer decides.
  const stay = () => screen.getByTestId('back-guard-stay');
  const stayDisabled = () => stay().props.accessibilityState?.disabled === true;

  // RC-8 (row 19): the W93-17 explicit 20 s budget is removed — T1 set testTimeout: 20000 globally
  // (jest.config.js:10), so the per-test budget equalled the default and changed nothing (D239, D255).
  for (const order of ['delta-first', 'answer-first'] as const) {
    it(`a confirmed cancel (${order}): "Keep session" is disabled and does not close the dialog while the cancel is out; the wizard leaves on the Core's answer`, async () => {
      const b = await liveCancelConfirm();
      b.order = order;
      b.answerDelayMs = 1_000;
      expect(stayDisabled()).toBe(false);
      fireEvent.press(leave());
      await b.flush();
      fireEvent.press(stay());
      await b.flush();
      // The defect: "Keep session" closed the dialog while the cancel was out (the wizard then left anyway).
      expect(screen.queryByText('Cancel this session?')).not.toBeNull();
      expect(stayDisabled()).toBe(true);
      expect(b.app.getPathname()).toBe('/session/new');
      await b.elapse(500);
      fireEvent.press(stay());
      await b.flush();
      expect(screen.getByText('Cancel this session?')).toBeTruthy();
      await b.elapse(700);
      if (order === 'answer-first') {
        b.sendHeldDeltas();
        await b.flush();
      }
      await b.elapse(200);
      expect(b.requests('cancelSession')).toHaveLength(1);
      expect(b.state().session).toBeNull();
      expect(b.app.getPathname()).toBe('/home');
    });
  }

  it('a refused cancel (403, 1 s late): "Keep session" is disabled while it is out, enabled again after the refusal, and then keeps the session', async () => {
    const b = await liveCancelConfirm();
    b.fake.answerOnce('cancelSession', { ...b.fake.example('cancelSession', 403, 'notPermitted'), delayMs: 1_000 });
    fireEvent.press(leave());
    await b.flush();
    fireEvent.press(stay());
    await b.flush();
    expect(screen.queryByText('Cancel this session?')).not.toBeNull();
    expect(stayDisabled()).toBe(true);
    await b.elapse(1_200);
    expect(screen.queryAllByText('Not permitted').length).toBeGreaterThan(0);
    expect(screen.getByText('Cancel this session?')).toBeTruthy();
    expect(stayDisabled()).toBe(false);
    fireEvent.press(stay());
    await b.flush();
    expect(screen.queryByText('Cancel this session?')).toBeNull();
    expect(b.app.getPathname()).toBe('/session/new');
    expect(b.state().session?.state).toBe('ARMED');
  });
});

describe('truthful copy (§3.2, MD-8; F-2)', () => {
  /** Every text and accessibility label rendered under the screen. */
  function wordsOnScreen(): string[] {
    const root = screen.getByTestId('screen-session-new');
    const out: string[] = [];
    const walk = (node: typeof root): void => {
      const { accessibilityLabel, children } = node.props as { accessibilityLabel?: unknown; children?: unknown };
      if (typeof accessibilityLabel === 'string') out.push(accessibilityLabel);
      if (typeof children === 'string') out.push(children);
      if (Array.isArray(children)) for (const child of children) if (typeof child === 'string') out.push(child);
      for (const child of node.children) if (typeof child !== 'string') walk(child);
    };
    walk(root);
    return out;
  }

  it('the two Live texts say nothing about a simulation, and are not the Simulated ones', () => {
    // Closing copy round (D164 DN-5): the two Live texts are the shared `sessionNew.live.*` the web reads too.
    expect(en.sessionNew.live.speakToTest).toBe(LIVE_HINT);
    expect(en.sessionNew.live.scanCaseNumber).toBe(LIVE_SCAN);
    for (const text of [...Object.values(sessionNewEn.live), ...Object.values(en.sessionNew.live)]) expect([text, SIMULATION.test(text)]).toEqual([text, false]);
  });

  it('LIVE: the case-number button\'s label and the step 2 hint say what is true; no text of steps 1 and 2 claims a simulation', async () => {
    const b = await renderLiveSessionNew();
    bed = b;
    await b.openFlow();
    expect(screen.getByTestId('session-new-scan').props.accessibilityLabel).toBe(LIVE_SCAN);
    expect(wordsOnScreen().filter((text) => SIMULATION.test(text))).toEqual([]);
    await fillStep1();
    fireEvent.press(screen.getByTestId('session-new-next'));
    await b.flush();
    await b.elapse(200);
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    expect(screen.getByText(LIVE_HINT)).toBeTruthy();
    expect(screen.queryByText(SIMULATED_HINT)).toBeNull();
    expect(wordsOnScreen().filter((text) => SIMULATION.test(text))).toEqual([]);
    expect(getMissingKeys()).toEqual([]);
  });

  it('SIMULATED: the words of before ("Scan case number (simulated)", "Speak to test (simulated)")', async () => {
    const h = renderSessionNewApp();
    await settle();
    h.openFlow();
    expect(screen.getByTestId('session-new-scan').props.accessibilityLabel).toBe(SIMULATED_SCAN);
    // The control of the LIVE scan above: the same walk finds the Simulated words.
    expect(wordsOnScreen()).toContain(SIMULATED_SCAN);
    await fillStep1();
    fireEvent.press(screen.getByTestId('session-new-next'));
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    expect(screen.getByText(SIMULATED_HINT)).toBeTruthy();
    expect(wordsOnScreen()).toContain(SIMULATED_HINT);
    expect(screen.queryByText(LIVE_HINT)).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });
});
});
