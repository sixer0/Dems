// Fix wave H, closing pass Z2 (item 5, the mobile half; decision D206: "a start still fires if device
// knowledge is lost during the 3-2-1 countdown after Confirm" was found on the web). On the tablet
// and the phone the sender's gate already REFUSES at the moment of sending (`useLocalSourceGate().ask`:
// "a consent does not carry a send through a list that became unknown" - hook test
// `capture-selector/wave-h-sources-known-gate.test.tsx`). What this file adds is the SCREEN:
//
// | Rule | Case |
// |------|------|
// | Knowledge of the capture sources lost DURING the countdown: nothing is sent, the session stays ARMED | "lost" |
// | The countdown ENDS there (it does not run to a launch that is refused): the control is back, disabled with "Checking the capture sources…", not "Starting…" | "lost" |
// | With the knowledge back the operator presses again and the start is sent once | "lost" |
// | CONTROL: nothing lost - the countdown ends in one start | "control" |
//
// LIVE mode over the contract-checked fake transport; nothing is opened (D163).
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderLiveSessionNew, resetLiveSessionNewBed, type LiveSessionNewBed } from './testing/live-session-new-bed';

let bed: LiveSessionNewBed | null = null;
beforeEach(async () => {
  await resetLiveSessionNewBed();
});
afterEach(() => {
  bed?.stop();
  bed = null;
});

const REASON = 'Checking the capture sources…';
const starts = (b: LiveSessionNewBed) => b.fake.log.operationIds().filter((id) => id === 'startSession').length;
const disabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;
/** The countdown's digits are real one-second timers of the screen: real time passes, then the bed settles. */
async function wait(b: LiveSessionNewBed, ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
  await b.flush();
  await b.elapse(200);
}

/** Real time passes in steps until `done()` holds (the digits arrive late under the test renderer); false when it never did. */
async function until(b: LiveSessionNewBed, done: () => boolean, limitMs = 12_000): Promise<boolean> {
  for (let waited = 0; waited < limitMs && !done(); waited += 500) await wait(b, 500);
  return done();
}
const overlayGone = () => screen.queryByTestId('session-new-countdown-overlay') === null;

async function publishDevices(b: LiveSessionNewBed, devices: readonly unknown[]): Promise<void> {
  act(() => void b.connection().delta([{ op: 'replace', slice: 'captureDevices', value: { devices: JSON.parse(JSON.stringify(devices)) } as never }]));
  await b.flush();
}
async function pressAndSettle(testID: string, b: LiveSessionNewBed): Promise<void> {
  fireEvent.press(screen.getByTestId(testID));
  await b.flush();
  await b.elapse(200);
}
/** Step 3 (ARMED) on a selector that names no local device; the 3-2-1 countdown is on (the default). */
async function openReady(): Promise<LiveSessionNewBed> {
  const b = await renderLiveSessionNew();
  bed = b;
  await b.openFlow();
  const settleValidation = () => act(async () => {});
  fireEvent.press(screen.getByTestId('session-new-scan'));
  await settleValidation();
  fireEvent.press(screen.getByTestId('session-new-subject-TERSANGKA'));
  await settleValidation();
  fireEvent.changeText(screen.getByTestId('session-new-subject-name'), 'Ahmad Fauzi');
  await settleValidation();
  await pressAndSettle('session-new-next', b);
  await b.runCore(8_000);
  await b.elapse(500);
  await pressAndSettle('session-new-next', b);
  expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
  return b;
}

jest.setTimeout(40_000);

describe('Session New (mobile): knowledge of the capture sources lost during the 3-2-1 countdown', () => {
  it('lost: nothing is sent, the countdown ends, the control is back with the reason; a new press after the list is back starts once', async () => {
    const b = await openReady();
    const devices = b.state().captureDevices.devices;
    expect(disabled('session-new-start')).toBe(false);
    fireEvent.press(screen.getByTestId('session-new-start'));
    await b.flush();
    expect(overlayGone()).toBe(false);
    expect(screen.getByTestId('session-new-countdown-digit').props.children).toBe(3);
    // While the first digit stands: the Core's device list is gone (a line of the selector names a device the list does not hold).
    await publishDevices(b, []);
    // The countdown ENDS with the knowledge - at once, not after its three digits.
    expect(overlayGone()).toBe(true);
    await wait(b, 4_000);
    expect(starts(b)).toBe(0);
    expect(b.state().session?.state).toBe('ARMED');
    expect(screen.queryByText('Starting…')).toBeNull();
    expect(disabled('session-new-start')).toBe(true);
    expect(screen.getByTestId('session-new-sources-checking')).toHaveTextContent(REASON);

    // The list is back: nothing fires by itself; the operator presses again.
    await publishDevices(b, devices);
    await wait(b, 4_000);
    expect(starts(b)).toBe(0);
    expect(disabled('session-new-start')).toBe(false);
    fireEvent.press(screen.getByTestId('session-new-start'));
    await b.flush();
    expect(await until(b, () => starts(b) === 1)).toBe(true);
    expect(starts(b)).toBe(1);
  });

  it('CONTROL - nothing lost: the countdown ends in exactly one start', async () => {
    const b = await openReady();
    fireEvent.press(screen.getByTestId('session-new-start'));
    await b.flush();
    expect(starts(b)).toBe(0);
    expect(overlayGone()).toBe(false);
    expect(await until(b, () => starts(b) === 1)).toBe(true);
    await wait(b, 1_000);
    expect(starts(b)).toBe(1);
  });
});
