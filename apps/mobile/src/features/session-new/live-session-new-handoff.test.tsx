// Backend task, plan row W67: Start Session in LIVE mode — the start-recording hand-off (S2-2, CA-02,
// AC-C-62) and the pending state of a control (LB-1, AC-C-57, AC-C-58), on the app's real Live source
// over the contract-checked fake transport (see `testing/live-session-new-bed.tsx`).
//
// AC-C-62: in both arrival orders of the answer and the delta, the monitor opens and no "session busy"
// toast shows: the store reaches RECORDING and the stack replace is dispatched in one synchronous turn
// (CL-16), so the wizard route never renders RECORDING (CA-02).
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { PRECHECK_TOTAL_MAX_MS } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderLiveSessionNew, resetLiveSessionNewBed, type LiveSessionNewBed, type LiveSessionNewBedOptions } from './testing/live-session-new-bed';

let bed: LiveSessionNewBed | null = null;

beforeEach(async () => {
  await resetLiveSessionNewBed();
  resetMissingKeys();
});

afterEach(() => {
  jest.restoreAllMocks();
  bed?.stop();
  bed = null;
});

const BUSY_TOAST = 'A session is already active';
const next = () => screen.getByTestId('session-new-next');
const start = () => screen.getByTestId('session-new-start');
const isBusy = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.busy === true;
const isDisabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;

/** Fills step 1 the way an operator does: scan, TERSANGKA, a name (each edit settles, as a person's would). */
async function fillStep1(name = 'Ahmad Fauzi'): Promise<void> {
  const settleValidation = () => act(async () => {});
  fireEvent.press(screen.getByTestId('session-new-scan'));
  await settleValidation();
  fireEvent.press(screen.getByTestId('session-new-subject-TERSANGKA'));
  await settleValidation();
  fireEvent.changeText(screen.getByTestId('session-new-subject-name'), name);
  await settleValidation();
}

/** Opens the flow over the Live source and walks to Ready: create and pre-check on the Core, the Core's gate passes. */
async function liveToReady(options: LiveSessionNewBedOptions = {}): Promise<LiveSessionNewBed> {
  const b = await renderLiveSessionNew(options);
  bed = b;
  await b.openFlow();
  await fillStep1();
  fireEvent.press(next());
  await b.flush();
  await b.elapse(200);
  expect(b.state().session?.state).toBe('PRECHECK');
  await b.runCore(PRECHECK_TOTAL_MAX_MS);
  expect(b.state().session?.state).toBe('ARMED');
  fireEvent.press(next());
  await b.flush();
  expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
  // Countdown off: Start sends the command at once.
  fireEvent.press(screen.getByTestId('session-new-countdown'));
  return b;
}

/** The host elements of the rendered tree as `type#testID`, leaving out the subtree of the control `exclude`. */
function elementsOutside(exclude: string): string[] {
  const out: string[] = [];
  const walk = (node: ReactTestRendererJSON | string | null): void => {
    if (node === null || typeof node === 'string') return;
    const testID = typeof node.props.testID === 'string' ? node.props.testID : '';
    if (testID === exclude) return;
    out.push(`${node.type}#${testID}`);
    for (const child of node.children ?? []) walk(child);
  };
  const root = screen.toJSON();
  for (const node of Array.isArray(root) ? root : [root]) walk(node as ReactTestRendererJSON | null);
  return out;
}

describe('the start-recording hand-off in Live mode (S2-2, CA-02, AC-C-62)', () => {
  it('the delta before the answer: the monitor opens with the session RECORDING and no "session busy" toast', async () => {
    const b = await liveToReady();
    b.order = 'delta-first';
    fireEvent.press(start());
    await b.flush();
    await b.elapse(200);
    expect(b.requests('startSession')).toHaveLength(1);
    expect(b.app.getPathname()).toBe('/session/live');
    expect(screen.getByTestId('screen-session-live')).toBeTruthy();
    expect(b.state().session?.state).toBe('RECORDING');
    expect(screen.queryByText(BUSY_TOAST)).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('the answer before the delta: the wizard waits on Ready, then the monitor opens in the turn of the delta, with no "session busy" toast', async () => {
    const b = await liveToReady();
    b.order = 'answer-first';
    fireEvent.press(start());
    await b.flush();
    await b.elapse(200);
    // The answer is in; its delta is not: the store is still ARMED and the continuation waits (CL-16).
    expect(b.requests('startSession')).toHaveLength(1);
    expect(b.state().session?.state).toBe('ARMED');
    expect(b.app.getPathname()).toBe('/session/new');
    expect(within(start()).getByText('Starting…')).toBeTruthy();
    expect(isBusy('session-new-start')).toBe(true);
    expect(screen.queryByText(BUSY_TOAST)).toBeNull();

    b.sendHeldDeltas();
    await b.flush();
    expect(b.state().session?.state).toBe('RECORDING');
    expect(b.app.getPathname()).toBe('/session/live');
    expect(screen.getByTestId('screen-session-live')).toBeTruthy();
    expect(screen.queryByText(BUSY_TOAST)).toBeNull();
  });

  it('a 403 on start (example notPermitted): the denied toast names the role, Start returns to idle, the wizard stays on Ready (AC-C-48)', async () => {
    const b = await liveToReady();
    b.fake.answerOnce('startSession', b.fake.example('startSession', 403, 'notPermitted'));
    fireEvent.press(start());
    await b.flush();
    await b.elapse(200);
    expect(screen.getAllByText('Not permitted').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Requires the Investigator role').length).toBeGreaterThan(0);
    expect(screen.queryByText('Recording could not start. Please try again.')).toBeNull();
    expect(b.app.getPathname()).toBe('/session/new');
    expect(b.state().session?.state).toBe('ARMED');
    expect(within(start()).getByText('Start Recording')).toBeTruthy();
    expect(isDisabled('session-new-start')).toBe(false);
    expect(isBusy('session-new-start')).toBe(false);
  });

  it('an outage on start: "Core server unreachable. Nothing was changed.", Start returns to idle, the wizard stays on Ready', async () => {
    const b = await liveToReady();
    b.fake.failOnce('startSession');
    fireEvent.press(start());
    await b.flush();
    await b.elapse(200);
    expect(screen.getAllByText('Core server unreachable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nothing was changed.').length).toBeGreaterThan(0);
    expect(b.app.getPathname()).toBe('/session/new');
    expect(b.state().session?.state).toBe('ARMED');
    expect(within(start()).getByText('Start Recording')).toBeTruthy();
    expect(isBusy('session-new-start')).toBe(false);
  });

  it('while the start is out, hardware Back is held: the answer decides, and the monitor opens', async () => {
    const b = await liveToReady();
    b.order = 'answer-first';
    const listeners: Parameters<typeof BackHandler.addEventListener>[1][] = [];
    const add = BackHandler.addEventListener.bind(BackHandler);
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, handler) => {
      listeners.push(handler);
      const subscription = add(event, handler);
      return {
        remove: () => {
          listeners.splice(listeners.indexOf(handler), 1);
          subscription.remove();
        },
      };
    });
    fireEvent.press(start());
    await b.flush();
    await b.elapse(200);
    expect(b.state().session?.state).toBe('ARMED');
    // The newest listener answers first (BackHandler calls them newest first).
    let consumed = false;
    act(() => {
      for (const listener of [...listeners].reverse()) {
        if (listener({} as Parameters<typeof listener>[0])) {
          consumed = true;
          break;
        }
      }
    });
    expect(consumed).toBe(true);
    expect(b.app.getPathname()).toBe('/session/new');
    // The header arrow is held too.
    fireEvent.press(screen.getByTestId('session-new-back'));
    expect(b.app.getPathname()).toBe('/session/new');

    b.sendHeldDeltas();
    await b.flush();
    expect(b.app.getPathname()).toBe('/session/live');
  });
});

describe('the pending state of Next on step 1 (LB-1, AC-C-57, AC-C-58)', () => {
  it('an answer 1 s late: two quick presses send one request; no spinner at 300 ms; the in-button spinner at 500 ms; nothing added outside the control', async () => {
    const b = await renderLiveSessionNew({ answerDelayMs: 1_000 });
    bed = b;
    await b.openFlow();
    await fillStep1();
    const before = elementsOutside('session-new-next');

    fireEvent.press(next());
    fireEvent.press(next());
    await b.flush();
    expect(b.requests('createSession')).toHaveLength(1);
    expect(isBusy('session-new-next')).toBe(true);

    await b.elapse(300);
    expect(screen.queryByTestId('session-new-next-spinner')).toBeNull();
    expect(elementsOutside('session-new-next')).toEqual(before);
    // A third press while it is out sends nothing either.
    fireEvent.press(next());
    await b.flush();
    expect(b.requests('createSession')).toHaveLength(1);

    await b.elapse(200); // 500 ms after the press
    expect(within(next()).getByTestId('session-new-next-spinner')).toBeTruthy();
    expect(elementsOutside('session-new-next')).toEqual(before);
    expect(b.app.getPathname()).toBe('/session/new');
    expect(screen.getByTestId('session-new-step-1')).toBeTruthy();

    // The create answers at 1 s, the pre-check start 1 s after that; then step 2, and the spinner is gone.
    await b.elapse(1_700);
    expect(b.requests('beginPrecheck')).toHaveLength(1);
    expect(b.requests('createSession')).toHaveLength(1);
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    expect(screen.queryByTestId('session-new-next-spinner')).toBeNull();
    expect(isBusy('session-new-next')).toBe(false);
  });

  it('an answer after 50 ms: no spinner is ever rendered', async () => {
    const b = await renderLiveSessionNew({ answerDelayMs: 50 });
    bed = b;
    await b.openFlow();
    await fillStep1();
    fireEvent.press(next());
    await b.flush();
    for (let elapsed = 0; elapsed < 300; elapsed += 10) {
      expect(screen.queryByTestId('session-new-next-spinner')).toBeNull();
      await b.elapse(10, 10);
    }
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    expect(screen.queryByTestId('session-new-next-spinner')).toBeNull();
  });
});
