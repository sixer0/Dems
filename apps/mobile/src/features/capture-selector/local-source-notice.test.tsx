// Fix pass F-M4 (reviews R69-01, R69-02, R69-07; decision D178) — Session New on the tablet and the
// phone, LIVE mode: the app's own Live source over the contract-checked fake transport
// (`session-new/testing/live-session-new-bed`); the Core's engine is a real simulator.
//
// The fixture SAYS that CAM-01 and MIC-01 are the Core Mac's local devices (`adapter: LOCAL_DEVICE`,
// `sourceClass: DEVELOPMENT`), as a Core in real capture would send them. Nothing is opened: there is
// no Core and no device behind the fake transport (decision D163).
//
// | Finding | Proven here |
// |---|---|
// | R69-01 | a selector that names a local device: nothing is sent before Confirm; Cancel sends nothing; a session left in CREATE is not checked by itself; every Retry asks once per press; CONTROL: no local device -> the calls of before, no notice |
// | R69-02 | the pre-check row carries "Core Mac's camera is on" from `sourceOpen: true`, and not without it |
// | R69-07 | the pre-check row of the local microphone carries the short limit sentence; another microphone's row does not |
//
// NOT proven here: a device, a real Core (gate 75 flows M5-SEC-PRIV-2-T / -P).
import '@/features/session-new/testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
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

/** The Core's devices change (another delta on the operator socket). */
async function markOnCore(b: LiveSessionNewBed, marks: Readonly<Record<string, Mark>>): Promise<void> {
  mark(b.engine, marks);
  const value = JSON.parse(JSON.stringify(b.engine.sim.store.getState().captureDevices)) as never;
  act(() => void b.connection().delta([{ op: 'replace', slice: 'captureDevices', value }]));
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

const CREATE_INPUT = {
  caseNumber: 'LP/2026/1001-0008',
  subjectType: 'SAKSI',
  subjectName: 'Rahmat Hidayat',
  investigatorId: OPERATORS[0]!.id,
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
} as const;

describe('R69-01: step 1 -> 2 on a selector that names the Core Mac\'s camera and microphone', () => {
  it('nothing is sent before Confirm; the notice names both devices; Confirm sends exactly createSession, then beginPrecheck', async () => {
    const b = await openStep1({ setup: (engine) => mark(engine, BOTH) });
    await pressAndSettle('session-new-next', b);
    expect(sent(b)).toEqual([]);
    const notice = screen.getByTestId(NOTICE);
    expect(within(notice).getByText('Turn on a local device')).toBeTruthy();
    expect(within(notice).getByText("This will turn on the Core Mac's camera (CAM-01) and microphone (MIC-01).")).toBeTruthy();
    expect(within(notice).getByText('The device check opens the device. Nothing is sent to the Core until you confirm.')).toBeTruthy();
    expect(b.state().session).toBeNull();

    await pressAndSettle('local-source-notice-confirm', b);
    expect(sent(b)).toEqual(['createSession', 'beginPrecheck']);
    expect(b.state().session?.state).toBe('PRECHECK');
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    expect(screen.queryByTestId(NOTICE)).toBeNull();
  });

  it('Cancel ("Not now"): nothing is sent, the form stays, Next is idle again and asks again on the next press', async () => {
    const b = await openStep1({ setup: (engine) => mark(engine, BOTH) });
    await pressAndSettle('session-new-next', b);
    await pressAndSettle('local-source-notice-cancel', b);
    expect(sent(b)).toEqual([]);
    expect(screen.queryByTestId(NOTICE)).toBeNull();
    expect(screen.getByTestId('session-new-step-1')).toBeTruthy();
    expect(screen.queryByTestId('session-new-create-error')).toBeNull();
    expect(isBusy('session-new-next')).toBe(false);
    expect(b.state().session).toBeNull();

    await pressAndSettle('session-new-next', b);
    expect(screen.getByTestId(NOTICE)).toBeTruthy();
    expect(sent(b)).toEqual([]);
  });

  it('one kind only: the camera alone is named', async () => {
    const b = await openStep1({ setup: (engine) => mark(engine, { 'CAM-01': LOCAL }) });
    await pressAndSettle('session-new-next', b);
    expect(within(screen.getByTestId(NOTICE)).getByText("This will turn on the Core Mac's camera (CAM-01).")).toBeTruthy();
    expect(sent(b)).toEqual([]);
  });

  it('CONTROL: a selector without a local device sends createSession, then beginPrecheck at once, with no notice', async () => {
    const b = await openStep1({ setup: (engine) => mark(engine, { 'CAM-01': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' }, 'MIC-01': { sourceClass: 'PRODUCTION', adapter: 'USB_AUDIO' } }) });
    await pressAndSettle('session-new-next', b);
    expect(screen.queryByTestId(NOTICE)).toBeNull();
    expect(sent(b)).toEqual(['createSession', 'beginPrecheck']);
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    expect(screen.queryByTestId('local-source-not-started')).toBeNull();
  });
});

describe('R69-01: a session left in CREATE (a relaunch, a resume) is not checked by itself', () => {
  const left = (marks: Readonly<Record<string, Mark>>): LiveSessionNewBedOptions => ({
    setup: (engine) => {
      mark(engine, marks);
      const result = engine.sim.actions.createSession(CREATE_INPUT);
      if (!result.ok) throw new Error(result.reason);
    },
  });

  it('the remount sends no pre-check; it says so and offers "Run the device check", which opens the notice; Confirm then sends', async () => {
    const b = await renderLiveSessionNew(left(BOTH));
    bed = b;
    await b.openFlow();
    await b.elapse(1_000);
    expect(b.state().session?.state).toBe('CREATE');
    expect(sent(b)).toEqual([]);
    const notStarted = screen.getByTestId('local-source-not-started');
    expect(within(notStarted).getByText('The device check was not started again by itself, because it turns on a local device.')).toBeTruthy();
    expect(screen.queryByTestId(NOTICE)).toBeNull();

    // The bed's Core answers an unchanged create with no delta, so the details are edited first, as in
    // `live-session-new-sites.test.tsx` ("a CREATE session with other details"): the calls after
    // Confirm are exactly that test's calls.
    fireEvent.changeText(screen.getByTestId('session-new-subject-name'), 'Dewi Lestari');
    await act(async () => {});
    await pressAndSettle('local-source-run-check', b);
    expect(screen.getByTestId(NOTICE)).toBeTruthy();
    expect(sent(b)).toEqual([]);

    await pressAndSettle('local-source-notice-confirm', b);
    expect(sent(b)).toEqual(['createSession', 'cancelSession', 'createSession', 'beginPrecheck']);
    expect(b.state().session?.state).toBe('PRECHECK');
    expect(screen.queryByTestId('local-source-not-started')).toBeNull();
  });

  it('CONTROL: the same CREATE session on a selector without a local device shows no such line', async () => {
    const b = await renderLiveSessionNew(left({}));
    bed = b;
    await b.openFlow();
    await b.elapse(1_000);
    expect(b.state().session?.state).toBe('CREATE');
    expect(sent(b)).toEqual([]);
    expect(screen.queryByTestId('local-source-not-started')).toBeNull();
  });
});

describe('R69-01: "Run checks again" asks once per press', () => {
  const blocked = (marks: Readonly<Record<string, Mark>>): LiveSessionNewBedOptions => ({
    setup: (engine) => {
      mark(engine, marks);
      engine.sim.actions.inject('STORAGE_FULL');
    },
  });

  async function openBlockedGate(marks: Readonly<Record<string, Mark>>): Promise<LiveSessionNewBed> {
    const b = await openStep1(blocked(marks));
    await pressAndSettle('session-new-next', b);
    if (screen.queryByTestId(NOTICE) !== null) await pressAndSettle('local-source-notice-confirm', b);
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    await b.runCore(PRECHECK_TOTAL_MAX_MS);
    expect(screen.getByTestId('session-new-gate-block')).toBeTruthy();
    return b;
  }

  it('a press opens the notice and sends nothing; Cancel sends nothing; the next press asks again; Confirm sends ONE retry; a further press asks again', async () => {
    const b = await openBlockedGate(BOTH);
    await pressAndSettle('session-new-retry-checks', b);
    expect(screen.getByTestId(NOTICE)).toBeTruthy();
    expect(b.requests('retryPrecheck')).toHaveLength(0);

    await pressAndSettle('local-source-notice-cancel', b);
    expect(screen.queryByTestId(NOTICE)).toBeNull();
    expect(b.requests('retryPrecheck')).toHaveLength(0);
    expect(isBusy('session-new-retry-checks')).toBe(false);

    await pressAndSettle('session-new-retry-checks', b);
    expect(screen.getByTestId(NOTICE)).toBeTruthy();
    await pressAndSettle('local-source-notice-confirm', b);
    expect(b.requests('retryPrecheck')).toHaveLength(1);
    expect(screen.queryByTestId(NOTICE)).toBeNull();

    await b.runCore(PRECHECK_TOTAL_MAX_MS);
    await pressAndSettle('session-new-retry-checks', b);
    expect(screen.getByTestId(NOTICE)).toBeTruthy();
    expect(b.requests('retryPrecheck')).toHaveLength(1);
  });

  it('CONTROL: without a local device the retry is sent at once, with no notice', async () => {
    const b = await openBlockedGate({});
    await pressAndSettle('session-new-retry-checks', b);
    expect(screen.queryByTestId(NOTICE)).toBeNull();
    expect(b.requests('retryPrecheck')).toHaveLength(1);
  });
});

describe('the pre-check rows of a local device (R69-02 "is on", R69-07 the microphone limit)', () => {
  async function openGate(marks: Readonly<Record<string, Mark>>): Promise<LiveSessionNewBed> {
    const b = await openStep1({ setup: (engine) => mark(engine, marks) });
    await pressAndSettle('session-new-next', b);
    await pressAndSettle('local-source-notice-confirm', b);
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    return b;
  }
  const ON_CAMERA = 'session-new-check-LENS_1-source-on';
  const ON_MIC = 'session-new-check-MIC_PRIMARY-source-on';

  it('R69-02: "Core Mac\'s camera is on" / "... microphone is on" only while the Core sends `sourceOpen: true`', async () => {
    const b = await openGate(BOTH);
    // CONTROL: the badge is there, the member is absent -> no "is on" line.
    expect(screen.getByTestId('session-new-check-LENS_1-source')).toBeTruthy();
    expect(screen.queryByTestId(ON_CAMERA)).toBeNull();
    expect(screen.queryByTestId(ON_MIC)).toBeNull();

    await markOnCore(b, { 'CAM-01': { ...LOCAL, sourceOpen: true }, 'MIC-01': LOCAL });
    expect(screen.getByTestId(ON_CAMERA)).toHaveTextContent("Core Mac's camera is on");
    expect(screen.queryByTestId(ON_MIC)).toBeNull();

    await markOnCore(b, { 'CAM-01': { ...LOCAL, sourceOpen: false }, 'MIC-01': { ...LOCAL, sourceOpen: true } });
    expect(screen.queryByTestId(ON_CAMERA)).toBeNull();
    expect(screen.getByTestId(ON_MIC)).toHaveTextContent("Core Mac's microphone is on");

    // CONTROL: a test source that is open is not "on" (only the Core Mac's own device is).
    await markOnCore(b, { 'CAM-01': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE', sourceOpen: true }, 'MIC-01': LOCAL });
    expect(screen.queryByTestId(ON_CAMERA)).toBeNull();
    expect(screen.queryByTestId(ON_MIC)).toBeNull();
  });

  it('R69-07: the row of the local microphone says "Not fit for recording yet. ..."; the camera row and another microphone\'s row do not', async () => {
    await openGate(BOTH);
    expect(screen.getByTestId('session-new-check-MIC_PRIMARY-source-limit')).toHaveTextContent('Not fit for recording yet. Use it for development checks only.');
    expect(screen.queryByTestId('session-new-check-MIC_STANDBY-source-limit')).toBeNull();
    expect(screen.queryByTestId('session-new-check-LENS_1-source-limit')).toBeNull();
  });
});
