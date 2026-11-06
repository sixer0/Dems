// Fix pass F-M4, second follow-up (decision D181, ruling 7) — Start Recording on a selector that
// names the Core Mac's camera or microphone: the recording keeps the device ON, so the tablet and
// the phone ask first, and a pre-check consent given earlier in the same flow never counts for it.
// LIVE mode on the app's own Live source over the contract-checked fake transport; the fixture SAYS
// the devices are local and opens nothing (decision D163). NOT proven here: a device, a real Core.
import '@/features/session-new/testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { OPERATORS, PRECHECK_TOTAL_MAX_MS } from '@dems/shared/sim';
import type { TestSim } from '@/runtime/testing/test-sim';
import { renderLiveSessionNew, resetLiveSessionNewBed, type LiveSessionNewBed, type LiveSessionNewBedOptions } from '@/features/session-new/testing/live-session-new-bed';

let bed: LiveSessionNewBed | null = null;

beforeEach(async () => {
  await resetLiveSessionNewBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  jest.useRealTimers();
});

type Mark = { sourceClass: 'DEVELOPMENT' | 'PRODUCTION'; adapter: string; sourceOpen?: boolean };

/** Marks the engine's devices; every other device carries no `sourceClass` at all. */
function mark(engine: TestSim, marks: Readonly<Record<string, Mark>>): void {
  engine.sim.store.setState((s) => ({
    captureDevices: {
      ...s.captureDevices,
      devices: s.captureDevices.devices.map((device) => {
        const { sourceClass: _sourceClass, adapter: _adapter, sourceOpen: _sourceOpen, ...bare } = device as typeof device & { sourceClass?: string; adapter?: string; sourceOpen?: boolean };
        const found = marks[device.id];
        return (found === undefined ? bare : { ...bare, ...found }) as typeof device;
      }),
    },
  }));
}

const LOCAL: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' };
/** The seeded selector: VIDEO-01 <- CAM-01, PRIMARY <- MIC-01. */
const BOTH = { 'CAM-01': LOCAL, 'MIC-01': LOCAL };
const NOTICE = 'local-source-notice';
const SENT = ['createSession', 'cancelSession', 'beginPrecheck', 'retryPrecheck'];
const sent = (b: LiveSessionNewBed) => b.fake.log.operationIds().filter((id) => SENT.includes(id));
const isBusy = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.busy === true;

async function fillStep1(): Promise<void> {
  const settleValidation = () => act(async () => {});
  fireEvent.press(screen.getByTestId('session-new-scan'));
  await settleValidation();
  fireEvent.press(screen.getByTestId('session-new-subject-TERSANGKA'));
  await settleValidation();
  fireEvent.changeText(screen.getByTestId('session-new-subject-name'), 'Ahmad Fauzi');
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

const START = 'local-source-start-notice';
const starts = (b: LiveSessionNewBed) => b.requests('startSession').length;

/** Step 1 -> the Core's gate passes -> Ready, with the countdown off (Start sends at once). Confirms the pre-check notice when it shows. */
async function toReady(marks: Readonly<Record<string, Mark>>): Promise<{ b: LiveSessionNewBed; precheckAsked: boolean }> {
  const b = await openStep1({ setup: (engine) => mark(engine, marks) });
  await pressAndSettle('session-new-next', b);
  const precheckAsked = screen.queryByTestId(NOTICE) !== null;
  if (precheckAsked) await pressAndSettle('local-source-notice-confirm', b);
  expect(b.state().session?.state).toBe('PRECHECK');
  await b.runCore(PRECHECK_TOTAL_MAX_MS);
  expect(b.state().session?.state).toBe('ARMED');
  fireEvent.press(screen.getByTestId('session-new-next'));
  await b.flush();
  expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
  fireEvent.press(screen.getByTestId('session-new-countdown'));
  return { b, precheckAsked };
}

describe('D181 (7): Start Recording on a selector that names the Core Mac\'s camera and microphone', () => {
  it('the pre-check notice was confirmed earlier in this flow; the start notice STILL shows; nothing is sent before Confirm; Confirm sends exactly ONE start', async () => {
    const { b, precheckAsked } = await toReady(BOTH);
    expect(precheckAsked).toBe(true);
    await pressAndSettle('session-new-start', b);
    expect(starts(b)).toBe(0);
    expect(b.state().session?.state).toBe('ARMED');
    const notice = screen.getByTestId(START);
    expect(within(notice).getByText('Turn on a local device for the recording')).toBeTruthy();
    expect(within(notice).getByText("This will turn on the Core Mac's camera (CAM-01) and microphone (MIC-01) and keep them on until the recording ends.")).toBeTruthy();
    expect(within(notice).getByText('Nothing is sent to the Core until you confirm.')).toBeTruthy();
    expect(within(notice).getByText('Turn on and start recording')).toBeTruthy();
    expect(screen.queryByTestId(NOTICE)).toBeNull();

    await pressAndSettle('local-source-notice-confirm', b);
    expect(starts(b)).toBe(1);
    expect(b.state().session?.state).toBe('RECORDING');
    expect(b.app.getPathname()).toBe('/session/live');
  });

  it('Cancel ("Not now"): nothing is sent, the session stays ARMED on Ready, Start is idle again and asks again on the next press', async () => {
    const { b } = await toReady(BOTH);
    await pressAndSettle('session-new-start', b);
    await pressAndSettle('local-source-notice-cancel', b);
    expect(starts(b)).toBe(0);
    expect(screen.queryByTestId(START)).toBeNull();
    expect(b.state().session?.state).toBe('ARMED');
    expect(b.app.getPathname()).toBe('/session/new');
    expect(isBusy('session-new-start')).toBe(false);
    expect(within(screen.getByTestId('session-new-start')).queryByText('Starting…')).toBeNull();

    await pressAndSettle('session-new-start', b);
    expect(screen.getByTestId(START)).toBeTruthy();
    expect(starts(b)).toBe(0);
  });

  it('CONTROL: a selector without a local device starts at once, with no notice', async () => {
    const { b, precheckAsked } = await toReady({ 'CAM-01': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' } });
    expect(precheckAsked).toBe(false);
    await pressAndSettle('session-new-start', b);
    expect(screen.queryByTestId(START)).toBeNull();
    expect(starts(b)).toBe(1);
    expect(b.state().session?.state).toBe('RECORDING');
  });
});

describe('D181 (7): a session waiting to start (ARMED) is not started by itself', () => {
  it('a remount of Session New on an ARMED session with a local selector sends no start and shows no notice until Start is pressed', async () => {
    const b = await renderLiveSessionNew({
      setup: (engine) => {
        mark(engine, BOTH);
        const result = engine.sim.actions.createSession({ caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Rahmat Hidayat', investigatorId: OPERATORS[0]!.id, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
        if (!result.ok) throw new Error(result.reason);
        engine.sim.actions.beginPrecheck();
        engine.advance(PRECHECK_TOTAL_MAX_MS);
      },
    });
    bed = b;
    expect(b.state().session?.state).toBe('ARMED');
    await b.openFlow();
    await b.elapse(5_000, 500);
    expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
    expect(starts(b)).toBe(0);
    expect(sent(b)).toEqual([]);
    expect(screen.queryByTestId(START)).toBeNull();
    expect(b.state().session?.state).toBe('ARMED');

    fireEvent.press(screen.getByTestId('session-new-countdown'));
    await pressAndSettle('session-new-start', b);
    expect(screen.getByTestId(START)).toBeTruthy();
    expect(starts(b)).toBe(0);
  });
});

describe('D184: the start notice comes BEFORE the 3-2-1 countdown (consent, then countdown, then the start)', () => {
  const OVERLAY = 'session-new-countdown-overlay';

  /** Ready with the countdown ON (the default); the screen's own timers are faked from here on. */
  async function toReadyWithCountdown(marks: Readonly<Record<string, Mark>>): Promise<LiveSessionNewBed> {
    const { b } = await toReady(marks);
    fireEvent.press(screen.getByTestId('session-new-countdown')); // `toReady` switched it off: on again
    await b.flush();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    return b;
  }
  async function tick(b: LiveSessionNewBed, ms: number): Promise<void> {
    for (let done = 0; done < ms; done += 500) {
      act(() => {
        jest.advanceTimersByTime(500);
      });
      await b.flush();
      await b.elapse(100);
    }
  }
  async function press(testID: string, b: LiveSessionNewBed): Promise<void> {
    fireEvent.press(screen.getByTestId(testID));
    await b.flush();
  }

  it('(1)+(3) Start shows the notice and NO countdown; Confirm -> the countdown runs -> exactly ONE start, and no second notice at its end', async () => {
    const b = await toReadyWithCountdown(BOTH);
    await press('session-new-start', b);
    expect(screen.getByTestId(START)).toBeTruthy();
    expect(screen.queryByTestId(OVERLAY)).toBeNull();
    await tick(b, 4_000);
    // Still no countdown and nothing sent: the question waits for an answer.
    expect(screen.queryByTestId(OVERLAY)).toBeNull();
    expect(starts(b)).toBe(0);

    await press('local-source-notice-confirm', b);
    expect(screen.queryByTestId(START)).toBeNull();
    expect(screen.getByTestId(OVERLAY)).toBeTruthy();
    expect(starts(b)).toBe(0);

    await tick(b, 4_000);
    expect(screen.queryByTestId(START)).toBeNull();
    expect(starts(b)).toBe(1);
    expect(b.state().session?.state).toBe('RECORDING');
    expect(b.app.getPathname()).toBe('/session/live');
  });

  it('(2) "Not now" leaves no countdown and sends nothing', async () => {
    const b = await toReadyWithCountdown(BOTH);
    await press('session-new-start', b);
    await press('local-source-notice-cancel', b);
    expect(screen.queryByTestId(START)).toBeNull();
    await tick(b, 4_000);
    expect(screen.queryByTestId(OVERLAY)).toBeNull();
    expect(starts(b)).toBe(0);
    expect(b.state().session?.state).toBe('ARMED');
  });

  it('(4) the countdown cancelled after Confirm discards the consent: the next press asks again, before any countdown', async () => {
    const b = await toReadyWithCountdown(BOTH);
    await press('session-new-start', b);
    await press('local-source-notice-confirm', b);
    expect(screen.getByTestId(OVERLAY)).toBeTruthy();
    await tick(b, 1_000);
    await press('session-new-countdown-cancel', b);
    expect(screen.queryByTestId(OVERLAY)).toBeNull();
    await tick(b, 4_000);
    expect(starts(b)).toBe(0);

    await press('session-new-start', b);
    expect(screen.getByTestId(START)).toBeTruthy();
    expect(screen.queryByTestId(OVERLAY)).toBeNull();
    expect(starts(b)).toBe(0);
  });

  it('CONTROL: without a local device the countdown begins at once, with no notice, and ends in ONE start', async () => {
    const b = await toReadyWithCountdown({});
    await press('session-new-start', b);
    expect(screen.queryByTestId(START)).toBeNull();
    expect(screen.getByTestId(OVERLAY)).toBeTruthy();
    await tick(b, 4_000);
    expect(starts(b)).toBe(1);
    expect(b.state().session?.state).toBe('RECORDING');
  });
});
