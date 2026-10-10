// Backend task, plan row W68: the Session Monitor in LIVE mode — the meters come from the socket (I8:
// `meters` frames into the store's `audio` slice, then Reanimated shared values on the UI thread; no
// request, no React render per frame), the Core link (the runtime's one rule: the banner, read-only
// actions, NO SIGNAL meters; no flicker through a reconnect attempt), React StrictMode (D158 F69-1:
// nothing starts on mount, one press is one request), the timer on the Core's clock, and the two
// commands whose results are ignored (camera, CLIP reset). One Simulated control test pins that the
// split of the snapshot visual (LB-4) changes nothing in Simulated mode.
//
// Import order: the gorhom mock, then the router harness, then the beds (see their headers).
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { promisify } from 'node:util';
import { DbfsMeter } from '@/components/composed/dbfs-meter';
import { AUDIO_FLOOR_DBFS } from '@/runtime';
import { LiveFeed } from './live-feed';
import { elapsedSecondsAt } from './session-live.math';
import { renderMonitorApp, settle } from './testing/monitor-harness';
import { meterFrame, renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed, type LiveMonitorBedOptions } from './testing/live-monitor-bed';

let bed: LiveMonitorBed | null = null;

/** One turn of the event loop's queue: a hand-over, never a duration wait (no timer is involved). */
const nextTurn = promisify(setImmediate) as () => Promise<void>;

beforeAll(async () => {
  // Reanimated prepares its UI-side frame-callback registry through one 0 ms timer that the worklets
  // mock runs when the module loads, on the real queue (S72-12, as in live-settings-boundary.test.tsx).
  // Yield two scheduler turns so that timer has run before the first test takes the clock in
  // `beforeEach`: a registration on the runner's fake clock then always finds the registry.
  await nextTurn();
  await nextTurn();
});

beforeEach(async () => {
  // The runner owns the clock for the whole test (the pattern proven on this tree shape in
  // live-settings-boundary.test.tsx:233-238; probe-failure.test.ts:213). `nextTick`, `queueMicrotask`
  // and `setImmediate` stay real: promise jobs, `act` hand-overs and the worklets mock's `runOnJS`
  // must not wait on a clock advance. The bed's own virtual transport clock (`clock.ts:81`) is a
  // separate scheduler: `b.flush`/`b.elapse` are microtask-driven and unaffected by this install.
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  await resetLiveMonitorBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  jest.useRealTimers();
});

const OFFLINE = 'Core server unreachable';
const MONITOR_OPERATIONS = ['stopSession', 'addSessionMarker', 'takeSessionSnapshot', 'setActiveCamera', 'resetMicClip'] as const;
const isBusy = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.busy === true;
const isDisabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;
const toastShown = (text: string) => screen.queryAllByText(text).length > 0;

interface MeterProps {
  testID?: string;
  level: { value: number };
  peak: { value: number };
}
/** The level the runtime wrote into a card meter's shared value (what the UI thread draws). */
function levelOf(testID: string): number {
  const meter = screen.UNSAFE_getAllByType(DbfsMeter).find((node) => (node.props as MeterProps).testID === testID);
  if (!meter) throw new Error(`no meter ${testID}`);
  return (meter.props as MeterProps).level.value;
}
const a11yOf = (testID: string) => screen.getByTestId(testID).props.accessibilityValue as { now: number; text: string };
/** The meters' accessible value refreshes once a second on the JS clock (`useAudioAccessibilityValue`
 *  arms a 1 s JS interval, `use-audio-shared-values.ts:101-106`); with the runner's fake timers
 *  installed in `beforeEach` one clock advance fires that tick deterministically. */
async function waitA11yTick(): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(1_100);
    // The bed's own flush convention (`live-monitor-bed.tsx:167-171`): let the promise jobs settle.
    for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
  });
}

async function openMonitor(options: LiveMonitorBedOptions = {}): Promise<LiveMonitorBed> {
  const b = await renderLiveMonitor(options);
  bed = b;
  await b.openMonitor();
  expect(screen.getByTestId('screen-session-live')).toBeTruthy();
  return b;
}

function clockLabel(totalSeconds: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
}

describe('the meters come from the socket (I8; CL-11b; [CS:S4-9])', () => {
  it('meters frames move both card meters, each from its own channel; no request is sent; the accessible value follows within a second', async () => {
    const b = await openMonitor();
    // The app asked for the frames on its signed-in socket (CL-11b) and polls nothing.
    expect(b.connection().receivedOf('subscribe')).toEqual([{ type: 'subscribe', topic: 'meters' }]);
    const calls = b.fake.calls.length;
    const at = b.fake.clock.now();

    b.sendMeters({ 'AUDIO-01': meterFrame(-18, at, 1), 'AUDIO-02': meterFrame(-42, at, 1) });
    expect(levelOf('monitor-meter-1')).toBe(-18);
    expect(levelOf('monitor-meter-2')).toBe(-42);
    b.sendMeters({ 'AUDIO-01': meterFrame(-12, at + 50, 2), 'AUDIO-02': meterFrame(-30, at + 50, 2) });
    expect(levelOf('monitor-meter-1')).toBe(-12);
    expect(levelOf('monitor-meter-2')).toBe(-30);
    expect(b.fake.calls.length).toBe(calls);

    await waitA11yTick();
    expect(a11yOf('monitor-meter-1')).toMatchObject({ now: -12, text: '-12 dBFS' });
    expect(a11yOf('monitor-meter-2')).toMatchObject({ now: -30, text: '-30 dBFS' });
    expect(b.fake.calls.length).toBe(calls);
  });

  it('20 frames cost no React render (the shared-value path; MA-16 in LIVE)', async () => {
    let commits = 0;
    const b = await openMonitor({ onRender: () => (commits += 1) });
    const at = b.fake.clock.now();
    b.sendMeters({ 'AUDIO-01': meterFrame(-40, at, 1), 'AUDIO-02': meterFrame(-40, at, 1) });
    commits = 0;
    for (let seq = 2; seq <= 21; seq += 1) {
      b.sendMeters({ 'AUDIO-01': meterFrame(-40 + seq, at + seq * 50, seq), 'AUDIO-02': meterFrame(-50 + seq, at + seq * 50, seq) });
    }
    expect(levelOf('monitor-meter-1')).toBe(-19);
    // At most the 1 Hz accessible value may commit; twenty frames must not.
    expect(commits).toBeLessThanOrEqual(2);
  });
});

describe('the Core link (the runtime\'s one rule; [CS:§3.5] mobile: the banner and the read-only actions)', () => {
  it('link lost: the banner, read-only session actions, meters at NO SIGNAL; nothing is sent; the replica keeps the recording', async () => {
    const b = await openMonitor();
    const at = b.fake.clock.now();
    b.sendMeters({ 'AUDIO-01': meterFrame(-18, at, 1), 'AUDIO-02': meterFrame(-24, at, 1) });
    const sent = MONITOR_OPERATIONS.map((operation) => b.requests(operation).length);

    b.setReachable(false);
    await b.flush();
    await b.elapse(1_000, 250);
    expect(within(screen.getByTestId('monitor-banner-offline')).getByText('Core link lost — recording continues on the Core. Reconnecting…')).toBeTruthy();
    expect(isDisabled('monitor-action-snapshot')).toBe(true);
    expect(isDisabled('monitor-action-bookmark')).toBe(true);
    expect(isDisabled('monitor-end-session')).toBe(true);
    fireEvent.press(screen.getByTestId('monitor-end-session'));
    expect(screen.queryByTestId('monitor-end-dialog')).toBeNull();
    // §2.3: a meter never freezes on a stale level.
    expect(levelOf('monitor-meter-1')).toBe(AUDIO_FLOOR_DBFS);
    expect(levelOf('monitor-meter-2')).toBe(AUDIO_FLOOR_DBFS);
    await waitA11yTick();
    expect(a11yOf('monitor-meter-1').text).toBe('NO SIGNAL');
    // The replica keeps the last state received: still the recording.
    expect(b.state().session?.state).toBe('RECORDING');
    expect(MONITOR_OPERATIONS.map((operation) => b.requests(operation).length)).toEqual(sent);
  });

  // Without wall-clock time during the outage: with it, the runtime's banner can fall back to
  // "offline" after "Resynced" although the link is ONLINE (finding F-1 of report 68, owner runtime).
  // The actions follow the runtime's notice rule, not the banner, so they return either way.
  it('link back: "Resynced", the actions return, a snapshot goes through', async () => {
    const b = await openMonitor();
    b.setReachable(false);
    await b.flush();
    await b.elapse(1_000, 250);
    expect(isDisabled('monitor-action-snapshot')).toBe(true);
    b.setReachable(true);
    await b.elapse(10_000, 250);
    expect(screen.queryByTestId('monitor-banner-offline')).toBeNull();
    expect(screen.getByTestId('monitor-banner-resynced')).toBeTruthy();
    expect(isDisabled('monitor-action-snapshot')).toBe(false);
    expect(isDisabled('monitor-end-session')).toBe(false);
    fireEvent.press(screen.getByTestId('monitor-action-snapshot'));
    await b.flush();
    await b.elapse(200);
    expect(b.requests('takeSessionSnapshot')).toHaveLength(1);
  });

  it('a reconnect with no outage before it (CL-11a "Retry now") is a transient: no banner, the actions stay usable; a press then gets the Core\'s offline answer, not the read-only one', async () => {
    const b = await openMonitor();
    // The next socket gets no answer at all; the open one is closed by the app itself, not lost.
    b.setReachable('hanging', { drop: false });
    act(() => void b.mobile.live.reconnect('RETRY'));
    await b.flush();
    await b.elapse(1_000, 250);
    expect(screen.queryByTestId('monitor-banner-offline')).toBeNull();
    expect(isDisabled('monitor-action-snapshot')).toBe(false);
    expect(isDisabled('monitor-end-session')).toBe(false);
    // The Live source refuses a command while the link is not ONLINE (CL-22): one toast, nothing sent.
    fireEvent.press(screen.getByTestId('monitor-action-snapshot'));
    await b.flush();
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown('Session actions are paused while the Core link is offline.')).toBe(false);
    expect(b.requests('takeSessionSnapshot')).toHaveLength(0);
    expect(isBusy('monitor-action-snapshot')).toBe(false);
  });

  it('a reconnect attempt that hangs in CONNECTING keeps the actions read-only (no flicker through the transient)', async () => {
    const b = await openMonitor();
    b.setReachable(false);
    await b.flush();
    await b.elapse(1_000, 250);
    expect(isDisabled('monitor-action-snapshot')).toBe(true);
    b.setReachable('hanging');
    await b.elapse(3_000, 250);
    expect(screen.getByTestId('monitor-banner-offline')).toBeTruthy();
    expect(isDisabled('monitor-action-snapshot')).toBe(true);
    expect(isDisabled('monitor-end-session')).toBe(true);
  });
});

describe('React StrictMode (a development build mounts effects twice; D158 F69-1)', () => {
  it('opening the monitor sends no command; one press is one request, for the snapshot and for the marker', async () => {
    const b = await openMonitor({ strict: true });
    await b.elapse(1_000, 250);
    expect(MONITOR_OPERATIONS.map((operation) => b.requests(operation).length)).toEqual([0, 0, 0, 0, 0]);

    fireEvent.press(screen.getByTestId('monitor-action-snapshot'));
    await b.flush();
    await b.elapse(200);
    expect(b.requests('takeSessionSnapshot')).toHaveLength(1);

    fireEvent.press(screen.getByTestId('monitor-action-bookmark'));
    await b.flush();
    fireEvent.press(screen.getByTestId('monitor-marker-submit'));
    await b.flush();
    await b.elapse(200);
    expect(b.requests('addSessionMarker')).toHaveLength(1);
    expect(b.requests('addSessionMarker')[0]?.body).toBeUndefined();
  });
});

describe('the replica and the Core\'s clock', () => {
  it('the timer counts from the Core\'s start on the Live clock', async () => {
    const b = await openMonitor();
    const state = b.state();
    const seconds = elapsedSecondsAt(state.session!.startedAt, state.clock.now);
    expect(seconds).toBeGreaterThan(18 * 60);
    expect(screen.getAllByLabelText(clockLabel(seconds)).length).toBeGreaterThan(0);
    await b.elapse(3_000, 100);
    expect(screen.getAllByLabelText(clockLabel(seconds + 3)).length).toBeGreaterThan(0);
    expect(screen.getByTestId('monitor-session-id')).toBeTruthy();
    expect(screen.getByText(state.session!.id)).toBeTruthy();
  });
});

describe('camera and CLIP reset (results ignored, as before; a refusal is still worded)', () => {
  it('camera: one request for a tap; the feed follows the Core\'s choice; an outage leaves the camera and says so', async () => {
    const b = await openMonitor();
    expect(b.state().activeCameraId).toBe('VIDEO-01');
    fireEvent.press(screen.getByTestId('monitor-feed-switch'));
    await b.flush();
    await b.elapse(200);
    expect(b.requests('setActiveCamera')).toHaveLength(1);
    expect(b.requests('setActiveCamera')[0]?.body).toEqual({ cameraId: 'VIDEO-02' });
    expect(b.state().activeCameraId).toBe('VIDEO-02');
    expect(screen.getByText('CAM 2 - Interview Room 1')).toBeTruthy();
    expect(isBusy('monitor-feed-switch')).toBe(false);

    b.fake.failOnce('setActiveCamera');
    fireEvent.press(screen.getByTestId('monitor-feed-switch'));
    await b.flush();
    await b.elapse(200);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(b.state().activeCameraId).toBe('VIDEO-02');
  });

  it('camera: two quick taps while the Core has not answered send one request; the tap target is busy until the answer', async () => {
    const b = await openMonitor({ answerDelayMs: 1_000 });
    fireEvent.press(screen.getByTestId('monitor-feed-switch'));
    await b.flush();
    fireEvent.press(screen.getByTestId('monitor-feed-switch'));
    await b.flush();
    expect(b.requests('setActiveCamera')).toHaveLength(1);
    expect(isBusy('monitor-feed-switch')).toBe(true);
    await b.elapse(1_200, 100);
    expect(isBusy('monitor-feed-switch')).toBe(false);
    expect(b.state().activeCameraId).toBe('VIDEO-02');
    expect(b.requests('setActiveCamera')).toHaveLength(1);
  });

  it('camera: the 403 the contract documents for it (originNotAllowed; it has no notPermitted, every role may call it) → the refusal toast', async () => {
    const b = await openMonitor();
    b.fake.answerOnce('setActiveCamera', b.fake.example('setActiveCamera', 403, 'originNotAllowed'));
    fireEvent.press(screen.getByTestId('monitor-feed-switch'));
    await b.flush();
    await b.elapse(200);
    expect(toastShown('The Core refused this action')).toBe(true);
    expect(b.state().activeCameraId).toBe('VIDEO-01');
  });

  it('CLIP reset: the latch from the Core shows; a tap sends one reset and the delta clears it; an outage keeps it and says so', async () => {
    const b = await openMonitor();
    await b.changeOnCore((engine) => engine.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' }));
    expect(b.state().mics.find((mic) => mic.id === 'AUDIO-02')?.clipLatched).toBe(true);

    b.fake.failOnce('resetMicClip');
    fireEvent.press(within(screen.getByTestId('monitor-mic-2')).getByHintText('Reset clip'));
    await b.flush();
    await b.elapse(200);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(b.state().mics.find((mic) => mic.id === 'AUDIO-02')?.clipLatched).toBe(true);

    fireEvent.press(within(screen.getByTestId('monitor-mic-2')).getByHintText('Reset clip'));
    await b.flush();
    await b.elapse(200);
    expect(b.requests('resetMicClip')).toHaveLength(2);
    expect(b.requests('resetMicClip')[1]?.body).toEqual({ channel: 'AUDIO-02' });
    expect(b.state().mics.find((mic) => mic.id === 'AUDIO-02')?.clipLatched).toBe(false);
  });
});

describe('CLIP reset, one at a time', () => {
  it('two quick taps on one meter\'s CLIP chip while the Core has not answered send one reset', async () => {
    const b = await openMonitor({ answerDelayMs: 1_000 });
    await b.changeOnCore((engine) => engine.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-01' }));
    const chip = () => within(screen.getByTestId('monitor-mic-1')).getByHintText('Reset clip');
    fireEvent.press(chip());
    await b.flush();
    fireEvent.press(chip());
    await b.flush();
    expect(b.requests('resetMicClip')).toHaveLength(1);
    await b.elapse(1_200, 100);
    expect(b.state().mics.find((mic) => mic.id === 'AUDIO-01')?.clipLatched).toBe(false);
    fireEvent.press(chip());
    await b.flush();
    expect(b.requests('resetMicClip')).toHaveLength(2);
  });
});

describe('Simulated mode is unchanged', () => {
  it('a snapshot plays the flash, the flight and the pop together, at the press; nothing is ever busy; the stop closes at once', async () => {
    const h = renderMonitorApp({ window: 'phonePortrait' });
    await settle();
    h.openMonitor();
    const feed = () => {
      const { shutterSignal, snapshotSignal } = screen.UNSAFE_getByType(LiveFeed).props as { shutterSignal: number; snapshotSignal: number };
      return { shutterSignal, snapshotSignal };
    };
    const before = feed();
    fireEvent.press(screen.getByTestId('monitor-action-snapshot'));
    expect(feed()).toEqual({ shutterSignal: before.shutterSignal + 1, snapshotSignal: before.snapshotSignal + 1 });
    // DELIBERATE PIN CHANGE (wave H closing pass Z2, G70-04): an idle control now STATES `busy: false` (`busyState`); it is never marked busy.
    expect(screen.getByTestId('monitor-action-snapshot').props.accessibilityState?.busy).toBe(false);
    expect(toastShown('Snapshot captured')).toBe(true);

    // The bed's reset switches motion off (the device test switch): the Dialog opens on a tap.
    fireEvent.press(screen.getByTestId('monitor-end-session'));
    if (screen.queryByTestId('monitor-end-dialog') === null) fireEvent(screen.getByTestId('monitor-end-session'), 'onLongPress');
    fireEvent.changeText(screen.getByTestId('monitor-end-reason'), 'Interview complete');
    fireEvent.press(screen.getByTestId('monitor-end-confirm'));
    expect(h.sim.store.getState().session?.state).toBe('STOPPING');
    expect(screen.queryByText('Ending…')).toBeNull();
    expect(h.app.getPathname()).toBe('/session/finalizing');
  });
});
