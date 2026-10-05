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
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { OUTAGE } from '@dems/shared/live/testing';
import { PRECHECK_TOTAL_MAX_MS } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { sessionNewEn } from './i18n';
import { renderLiveSessionNew, resetLiveSessionNewBed, type LiveSessionNewBed } from './testing/live-session-new-bed';
import { renderSessionNewApp, settle } from './testing/session-new-harness';

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
    expect(sessionNewEn.live.speakToTest).toBe(LIVE_HINT);
    expect(sessionNewEn.live.scanCaseNumber).toBe(LIVE_SCAN);
    for (const text of Object.values(sessionNewEn.live)) expect([text, SIMULATION.test(text)]).toEqual([text, false]);
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
