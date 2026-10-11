// Fix wave H, gate 70 finding G70-08 (privacy; ruling D196: the notice rule FAILS CLOSED while the
// device list is unknown) — Session New on the tablet and the phone, LIVE mode: the app's own Live
// source over the contract-checked fake transport (`session-new/testing/live-session-new-bed`).
//
// The notice before a pre-check / a start is decided from the device CLASSES of the selector's lines.
// While the client does not KNOW them, a press used to go straight through ("no local device found"
// read as "no local device"). Three unknown states are held here:
//
// | State | How it is held | What "unknown" the client can detect |
// |---|---|---|
// | the device list is not there yet | the Core's `captureDevices` slice holds no device while the selector names four | a selector line names a device the list does not hold |
// | in error | the Core stops answering (`setReachable(false)`) | the Live link is not ONLINE (OFFLINE / STALE) |
// | stale after a reconnect | the reconnect attempt hangs (`setReachable('hanging')`): the snapshot of the new socket has not arrived | the Live link is not ONLINE (CONNECTING; RESYNCING reads the same) |
//
// Nothing is opened: there is no Core and no device behind the fake transport (decision D163).
// NOT proven here: a device and a real Core (re-gate: the notice flows of gate 70 section 4).
import '@/features/session-new/testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { liveLinkOf } from '@dems/shared/live';
import type { TestSim } from '@/runtime/testing/test-sim';
import { renderLiveSessionNew, resetLiveSessionNewBed, type LiveSessionNewBed, type LiveSessionNewBedOptions } from '@/features/session-new/testing/live-session-new-bed';

let bed: LiveSessionNewBed | null = null;

beforeEach(async () => {
  await resetLiveSessionNewBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
});

type Mark = { sourceClass: 'DEVELOPMENT' | 'PRODUCTION'; adapter: string };
const LOCAL: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' };
const REASON = 'Checking the capture sources…';
const SENT = ['createSession', 'cancelSession', 'beginPrecheck', 'retryPrecheck', 'startSession'];
const sent = (b: LiveSessionNewBed) => b.fake.log.operationIds().filter((id) => SENT.includes(id));
const disabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;

function mark(engine: TestSim, marks: Readonly<Record<string, Mark>>): void {
  engine.sim.store.setState((s) => ({
    captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => ({ ...device, ...(marks[device.id] ?? {}) }) as typeof device) },
  }));
}

/** The Core publishes its device list (one delta on the operator socket). */
async function publishDevices(b: LiveSessionNewBed, devices: readonly unknown[]): Promise<void> {
  act(() => void b.connection().delta([{ op: 'replace', slice: 'captureDevices', value: { devices: JSON.parse(JSON.stringify(devices)) } as never }]));
  await b.flush();
}

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

/** Step 3 (ARMED) on a selector that names no local device. */
async function openReady(options: LiveSessionNewBedOptions = {}): Promise<LiveSessionNewBed> {
  const b = await openStep1(options);
  await pressAndSettle('session-new-next', b);
  await b.runCore(8_000);
  await b.elapse(500);
  await pressAndSettle('session-new-next', b);
  expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
  return b;
}

describe.each(['tabletLandscape', 'phonePortrait'] as const)('G70-08 on %s: step 1 "Next" while the device classes are not known', (window) => {
  it('the device list is not there yet: Next is DISABLED with "Checking the capture sources…", a press sends nothing; when the list arrives and names a local camera, the press asks first', async () => {
    const b = await openStep1({ window });
    const devices = b.engine.sim.store.getState().captureDevices.devices;
    // Held unresolved: the selector names CAM-01, CAM-02, MIC-01, MIC-02 and the client's device list holds none of them.
    await publishDevices(b, []);
    expect(disabled('session-new-next')).toBe(true);
    expect(screen.getByTestId('session-new-sources-checking')).toHaveTextContent(REASON);
    expect(screen.getByTestId('session-new-next').props.accessibilityHint).toBe(REASON);
    await pressAndSettle('session-new-next', b);
    expect(sent(b)).toEqual([]);
    expect(b.state().session).toBeNull();
    expect(screen.queryByTestId('local-source-notice')).toBeNull();

    // The list arrives: the camera of video track 1 is the Core Mac's.
    await publishDevices(b, devices.map((device) => (device.id === 'CAM-01' ? { ...device, ...LOCAL } : device)));
    expect(disabled('session-new-next')).toBe(false);
    expect(screen.queryByTestId('session-new-sources-checking')).toBeNull();
    await pressAndSettle('session-new-next', b);
    expect(screen.getByTestId('local-source-notice')).toBeTruthy();
    expect(sent(b)).toEqual([]);
  });

  it('in error (the Core stops answering) and stale after a reconnect (the new socket has no snapshot yet): disabled with the reason, nothing sent; back ONLINE it is enabled again', async () => {
    const b = await openStep1({ window });
    expect(disabled('session-new-next')).toBe(false);
    b.setReachable(false);
    await b.flush();
    await b.elapse(1_000, 250);
    expect(disabled('session-new-next')).toBe(true);
    expect(screen.getByTestId('session-new-sources-checking')).toHaveTextContent(REASON);
    await pressAndSettle('session-new-next', b);
    expect(sent(b)).toEqual([]);

    // The reconnect attempts hang: the link is CONNECTING and what the store holds is the list of the socket before.
    b.setReachable('hanging');
    await b.elapse(3_000, 250);
    expect(liveLinkOf(b.mobile.sim)).not.toBe('ONLINE');
    expect(disabled('session-new-next')).toBe(true);
    expect(screen.getByTestId('session-new-sources-checking')).toHaveTextContent(REASON);
    await pressAndSettle('session-new-next', b);
    expect(sent(b)).toEqual([]);

    b.setReachable(true);
    await b.elapse(20_000, 500);
    expect(liveLinkOf(b.mobile.sim)).toBe('ONLINE');
    expect(disabled('session-new-next')).toBe(false);
    expect(screen.queryByTestId('session-new-sources-checking')).toBeNull();
  });

  it('CONTROL: a known list with no local device - Next is enabled, no reason line, and the press sends createSession then beginPrecheck as before', async () => {
    const b = await openStep1({ window });
    expect(disabled('session-new-next')).toBe(false);
    expect(screen.queryByTestId('session-new-sources-checking')).toBeNull();
    await pressAndSettle('session-new-next', b);
    expect(sent(b)).toEqual(['createSession', 'beginPrecheck']);
    expect(screen.queryByTestId('local-source-notice')).toBeNull();
  });
});

describe('G70-08: the other controls that open a device', () => {
  it('"Run the device check" of a session left in CREATE: disabled with the reason while the list is not there', async () => {
    const b = await openStep1({
      setup: (engine) => {
        mark(engine, { 'CAM-01': LOCAL });
        const created = engine.sim.actions.createSession({ caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Rahmat Hidayat', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as never);
        if (!created.ok) throw new Error('the engine refused the session of this test');
      },
    });
    expect(screen.getByTestId('local-source-not-started')).toBeTruthy();
    expect(disabled('local-source-run-check')).toBe(false);
    b.setReachable('hanging');
    await b.flush();
    await b.elapse(1_000, 250);
    expect(disabled('local-source-run-check')).toBe(true);
    expect(screen.getByTestId('local-source-run-check').props.accessibilityHint).toBe(REASON);
    await pressAndSettle('local-source-run-check', b);
    expect(sent(b)).toEqual([]);
    expect(screen.queryByTestId('local-source-notice')).toBeNull();
  });

  it('"Start Recording": disabled with the reason while the list is not there; nothing is sent', async () => {
    const b = await openReady();
    expect(disabled('session-new-start')).toBe(false);
    const before = sent(b);
    await publishDevices(b, []);
    expect(disabled('session-new-start')).toBe(true);
    expect(screen.getByTestId('session-new-sources-checking')).toHaveTextContent(REASON);
    await pressAndSettle('session-new-start', b);
    await b.elapse(4_000, 500);
    expect(sent(b)).toEqual(before);
    expect(b.state().session?.state).toBe('ARMED');
  });

  it('"Re-run checks" after a blocked check: disabled with the reason while the list is not there; nothing is sent', async () => {
    const b = await openStep1({ setup: (engine) => engine.sim.actions.setTabletLink('OFFLINE') });
    await pressAndSettle('session-new-next', b);
    await b.runCore(8_000);
    await b.elapse(500);
    expect(screen.getByTestId('session-new-retry-checks')).toBeTruthy();
    expect(disabled('session-new-retry-checks')).toBe(false);
    const before = sent(b);
    await publishDevices(b, []);
    expect(disabled('session-new-retry-checks')).toBe(true);
    expect(screen.getByTestId('session-new-retry-checks').props.accessibilityHint).toBe(REASON);
    await pressAndSettle('session-new-retry-checks', b);
    expect(sent(b)).toEqual(before);
  });
});
