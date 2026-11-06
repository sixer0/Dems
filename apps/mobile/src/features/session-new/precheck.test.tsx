// T-M10 (04_mobile_specs §10.1; MA-29 step 2, MA-30 step-2 part): the Start Session Devices Check,
// the book's §5.3 pre-recording gate, on the real simulator with fake time (the simulator's manual
// clock drives the seeded 300–700 ms per check; jest's fake timers hold every UI timer).
//   PASS  → every check of PRECHECK_ORDER (twelve since D53) resolves in sequence, the simulator arms itself, Next leads to Ready;
//   WARN  → a warning Alert and "Acknowledge warnings"; Next only after the tick, then ARMED;
//   BLOCK → a danger Alert naming the reason, Next disabled, "Run checks again" after the fix.
// Import order: the test setup, then the router harness (see their headers).
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { PRECHECK_SECURITY_NOT_REPORTED_EXAMPLE } from '@dems/shared/api';
import {
  OPERATORS,
  PRECHECK_CHECK_MAX_MS,
  PRECHECK_CHECK_MIN_MS,
  PRECHECK_ORDER,
  PRECHECK_TOTAL_MAX_MS,
  type PrecheckItem,
} from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import type { TestSim } from '@/runtime/testing/test-sim';
import { auditTypes, renderSessionNewApp, settle, type SessionNewHarness } from './testing/session-new-harness';
import { itemsWith, precheckNoteOf, precheckTone, valueKey } from './session-new-model';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';
import { Spinner } from 'heroui-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { renderLiveSessionNew, resetLiveSessionNewBed, type LiveSessionNewBed } from './testing/live-session-new-bed';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('precheck', () => {
unmountBeforeTheHooksOfThisGroup();

beforeEach(() => {
  jest.useFakeTimers();
  resetMissingKeys();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  resetMotionStateForTests();
});

/** A session in PRECHECK, created the way step 1's Next does (`createSession` → `beginPrecheck`). */
function startGate(test: TestSim): void {
  const operator = OPERATORS[0]!;
  const result = test.sim.actions.createSession({
    caseNumber: 'LP/2026/1001-0008',
    subjectType: 'SAKSI',
    subjectName: 'Rahmat Hidayat',
    investigatorId: operator.id,
    room: 'Interview Room 1',
    profileId: 'STANDARD_1080P25',
  });
  if (!result.ok) throw new Error(`createSession failed: ${result.reason}`);
  test.sim.actions.beginPrecheck();
}

async function openGate(setup: (test: TestSim) => void = () => {}): Promise<SessionNewHarness> {
  const h = renderSessionNewApp({
    setup: (test) => {
      setup(test);
      startGate(test);
    },
  });
  await settle();
  h.openFlow('/session/new?step=2');
  return h;
}

const checkStatus = (id: string) => screen.queryByTestId(`session-new-check-${id}-status`);
const nextButton = () => screen.getByTestId('session-new-next');

describe('T-M10 Devices Check: the §5.3 gate (MA-29 step 2, MA-30)', () => {
  // Re-pinned by row 184 (M3-04 R6, I63 §4.3), citing D53: the gate runs PRECHECK_ORDER.length checks
  // (12 since D53, was 8). The timing bound is shared's PRECHECK_TOTAL_MAX_MS (4_900, unchanged) and
  // the per-check bounds are shared's PRECHECK_CHECK_MIN_MS / PRECHECK_CHECK_MAX_MS (300 / 700).
  it('PASS: every check of PRECHECK_ORDER resolves one after another within PRECHECK_TOTAL_MAX_MS (4.9 s), then the simulator arms and Next leads to Ready', async () => {
    const total = PRECHECK_ORDER.length; // D53: 12
    // D53: twelve checks at the per-check floor must still fit the unchanged shared bound.
    expect(total * PRECHECK_CHECK_MIN_MS).toBeLessThanOrEqual(PRECHECK_TOTAL_MAX_MS);
    const h = await openGate();
    expect(screen.getByTestId('screen-session-new')).toBeTruthy();
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    // All PRECHECK_ORDER rows (D53: twelve), in the book's order, with the first one running.
    for (const id of PRECHECK_ORDER) expect(screen.getByTestId(`session-new-check-${id}`)).toBeTruthy();
    expect(screen.getByTestId('session-new-check-CORE-spinner')).toBeTruthy();
    expect(checkStatus('CORE')).toBeNull();
    expect(nextButton().props.accessibilityState?.disabled).toBe(true);

    // The seeded schedule: each check PRECHECK_CHECK_MIN_MS–PRECHECK_CHECK_MAX_MS, the whole gate ≤ PRECHECK_TOTAL_MAX_MS.
    const items = h.state().session!.precheck.items;
    expect(items).toHaveLength(total); // D53
    const startedAt = h.state().session!.precheck.startedAt!;
    let previous = startedAt;
    for (const item of items) {
      const duration = item.resolvesAt! - previous;
      expect(duration).toBeGreaterThanOrEqual(PRECHECK_CHECK_MIN_MS);
      expect(duration).toBeLessThanOrEqual(PRECHECK_CHECK_MAX_MS);
      previous = item.resolvesAt!;
    }
    expect(previous - startedAt).toBeLessThanOrEqual(PRECHECK_TOTAL_MAX_MS);

    // Resolve in sequence: after the first check's time only CORE has a chip.
    h.tick(items[0]!.resolvesAt! - startedAt);
    expect(checkStatus('CORE')).toBeTruthy();
    expect(screen.getByText(`1 of ${total} checked`)).toBeTruthy(); // D53: was '1 of 8 checked'
    expect(checkStatus('SECURITY')).toBeNull();

    h.tick(PRECHECK_TOTAL_MAX_MS);
    for (const id of PRECHECK_ORDER) expect(screen.getByTestId(`session-new-check-${id}-status`)).toBeTruthy();
    expect(screen.getByText(`${total} of ${total} checked`)).toBeTruthy(); // D53: was '8 of 8 checked'
    expect(screen.getAllByText('PASS').length).toBeGreaterThanOrEqual(total); // D53: was 8
    expect(screen.getByTestId('session-new-gate-pass')).toBeTruthy();
    expect(h.state().session!.state).toBe('ARMED');
    expect(auditTypes(h.state())).toContain('PRECHECK_PASSED');

    expect(nextButton().props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(nextButton());
    expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
    expect(h.app.getSearchParams().step).toBe('3');
  });

  it('WARN: MIC 2 without signal needs "Acknowledge warnings" before Next, which then arms the session', async () => {
    const h = await openGate((test) => test.sim.actions.inject('MIC_NO_SIGNAL', { channel: 'AUDIO-02' }));
    h.tick(PRECHECK_TOTAL_MAX_MS);
    expect(h.state().session!.precheck.outcome).toBe('WARN');
    expect(h.state().session!.state).toBe('PRECHECK');
    expect(screen.getByTestId('session-new-check-MIC_STANDBY-status')).toBeTruthy();
    expect(screen.getByTestId('session-new-check-MIC_STANDBY-value').props.children).toBe('NO SIGNAL');
    expect(screen.getByTestId('session-new-gate-warn')).toBeTruthy();
    expect(screen.queryByTestId('session-new-gate-block')).toBeNull();
    expect(nextButton().props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('session-new-acknowledge'));
    expect(nextButton().props.accessibilityState?.disabled).toBe(false);

    fireEvent.press(nextButton());
    expect(h.state().session!.state).toBe('ARMED');
    const passed = h.state().audit.rows.filter((row) => row.type === 'PRECHECK_PASSED').at(-1)!;
    expect(passed.details).toMatchObject({ warnings: 1, acknowledged: true });
    expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
    expect(screen.getByText('Ready, 1 warning acknowledged')).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });

  it('BLOCK: Storage FULL blocks with the reason, keeps Next disabled, and a re-run after the fix passes', async () => {
    const h = await openGate((test) => test.sim.actions.inject('STORAGE_FULL'));
    h.tick(PRECHECK_TOTAL_MAX_MS);
    expect(h.state().session!.precheck.outcome).toBe('BLOCK');
    expect(h.state().session!.state).toBe('PRECHECK');
    expect(auditTypes(h.state())).toContain('PRECHECK_BLOCKED');
    expect(screen.getByTestId('session-new-gate-block')).toBeTruthy();
    expect(screen.getByText('Resolve these checks before continuing: Storage (FULL).')).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
    expect(screen.getByTestId('session-new-check-STORAGE-value').props.children).toBe('FULL');
    expect(nextButton().props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(nextButton());
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();

    // The operator frees space, then runs the checks again: a fresh run passes and arms.
    act(() => h.sim.actions.clearFault('STORAGE_FULL'));
    fireEvent.press(screen.getByTestId('session-new-retry-checks'));
    expect(screen.getByTestId('session-new-check-CORE-spinner')).toBeTruthy();
    h.tick(PRECHECK_TOTAL_MAX_MS);
    expect(h.state().session!.state).toBe('ARMED');
    expect(nextButton().props.accessibilityState?.disabled).toBe(false);
  });

  it('BLOCK: the Core link offline (MA-10: the heartbeat mode drops the tablet link) blocks on Core Machine', async () => {
    const h = await openGate((test) => test.sim.actions.setTabletLink('OFFLINE'));
    h.tick(PRECHECK_TOTAL_MAX_MS);
    expect(h.state().session!.precheck.items.find((item) => item.id === 'CORE')!.status).toBe('BLOCK');
    expect(screen.getByTestId('session-new-check-CORE-value').props.children).toBe('OFFLINE');
    expect(screen.getByText('Resolve these checks before continuing: Core Machine (OFFLINE).')).toBeTruthy();
    expect(nextButton().props.accessibilityState?.disabled).toBe(true);
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-h-z2-precheck-note.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave H, closing pass Z2 - the pre-check TIME item of a Core in its own capture (closing pass
// Z1's request line of 10:30:00Z; ruling D203 (1)). It is a NOTE: `status: WARN`, `value:
// HOST_SYSTEM_CLOCK`, `params: { rule: 'TIME_HOST_CLOCK' }`; the run's outcome stays PASS and nothing
// is to be acknowledged (`isPrecheckNote`, `@dems/shared/sim`).
//
// | Rule | Case |
// |------|------|
// | The row reads "Host system clock" with a NOTE chip - never the raw value `HOST_SYSTEM_CLOCK`, never WARN | "the row" |
// | A note is not counted with the warnings ("N warnings acknowledged" on the Ready step) | "the rules" |
// | CONTROL: an RTC fallback of the simulation (no rule) stays a WARN that counts | "the rules" |
// Import order: the test setup, then the router harness.
describe('the TIME note of the pre-check', () => {
unmountBeforeTheHooksOfThisGroup();
beforeEach(() => {
  jest.useFakeTimers();
  resetMissingKeys();
});
afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  resetMotionStateForTests();
});

const NOTE = { id: 'TIME', status: 'WARN', value: 'HOST_SYSTEM_CLOCK', reason: 'Time source: host system clock (no GNSS)', reasonCode: null, params: { rule: 'TIME_HOST_CLOCK', source: 'RTC' } } as unknown as PrecheckItem;
const FALLBACK = { id: 'TIME', status: 'WARN', value: 'RTC', reason: 'core text', reasonCode: 'TIME_RTC', params: {} } as unknown as PrecheckItem;

function startGate(test: TestSim): void {
  const result = test.sim.actions.createSession({ caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Rahmat Hidayat', investigatorId: OPERATORS[0]!.id, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
  if (!result.ok) throw new Error(`createSession failed: ${result.reason}`);
  test.sim.actions.beginPrecheck();
}

describe('the pre-check TIME note of a Core in its own capture (mobile)', () => {
  it('the row: "Host system clock" with a NOTE chip - not the raw value, not WARN', async () => {
    const h = renderSessionNewApp({ setup: startGate });
    await settle();
    h.openFlow('/session/new?step=2');
    h.tick(PRECHECK_TOTAL_MAX_MS);
    await settle();
    // The run as a Core in its own capture answers it: the TIME item is the note, the outcome PASS.
    act(() => {
      const session = h.sim.store.getState().session!;
      h.sim.store.setState({ session: { ...session, precheck: { ...session.precheck, items: session.precheck.items.map((item) => (item.id === 'TIME' ? NOTE : item)) } } });
    });
    await settle();
    const row = within(screen.getByTestId('session-new-check-TIME'));
    expect(screen.getByTestId('session-new-check-TIME-value')).toHaveTextContent('Host system clock');
    expect(row.queryByText(/HOST_SYSTEM_CLOCK/)).toBeNull();
    expect(row.queryByText('WARN')).toBeNull();
    expect(row.getByText('NOTE')).toBeTruthy();
    expect(String(screen.getByTestId('session-new-check-TIME').props.accessibilityLabel)).toBe('Time Sync, Host system clock, NOTE');
    expect(getMissingKeys()).toEqual([]);
  });

  // Fix wave J round two (JT-03 remainder; contract J-S 5): SEEN ON THE TABLET with the new server code - the SECURITY
  // note of a Core that reads no platform was worded "Enclosure tamper detected". The contract's example, unmodified.
  it('the SECURITY note (the contract\'s example): "Not reported" with its explanation - never "Enclosure tamper detected"; a real tamper WARN keeps its sentence', async () => {
    const h = renderSessionNewApp({ setup: startGate });
    await settle();
    h.openFlow('/session/new?step=2');
    h.tick(PRECHECK_TOTAL_MAX_MS);
    await settle();
    const withSecurity = (security: PrecheckItem) =>
      act(() => {
        const session = h.sim.store.getState().session!;
        h.sim.store.setState({ session: { ...session, precheck: { ...session.precheck, items: session.precheck.items.map((item) => (item.id === 'SECURITY' ? security : item)) } } });
      });
    withSecurity(PRECHECK_SECURITY_NOT_REPORTED_EXAMPLE as unknown as PrecheckItem);
    await settle();
    expect(precheckNoteOf(PRECHECK_SECURITY_NOT_REPORTED_EXAMPLE as unknown as PrecheckItem)).toBe(true);
    expect(screen.getByTestId('session-new-check-SECURITY-value')).toHaveTextContent('Not reported');
    expect(screen.getByTestId('session-new-check-SECURITY-note')).toHaveTextContent('A note, not a warning: this Core reads no TPM and no Secure Boot state.');
    expect(String(screen.getByTestId('session-new-check-SECURITY').props.accessibilityLabel)).toBe('Security, Not reported, NOTE');
    expect(within(screen.getByTestId('session-new-check-SECURITY')).queryByText(/tamper/i)).toBeNull();
    // CONTROL: a WARN that is no note is the simulator's enclosure tamper, worded as before.
    withSecurity({ id: 'SECURITY', status: 'WARN', value: 'TAMPER', reason: 'core text', reasonCode: 'SECURITY_TAMPER', params: {} } as unknown as PrecheckItem);
    await settle();
    expect(screen.getByTestId('session-new-check-SECURITY-value')).toHaveTextContent('Enclosure tamper detected');
    expect(screen.queryByTestId('session-new-check-SECURITY-note')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('the rules (pure): a note is no warning to count; its value and tone are the host clock\'s', () => {
    expect(precheckNoteOf(NOTE)).toBe(true);
    expect(precheckNoteOf(FALLBACK)).toBe(false);
    expect(itemsWith([NOTE], 'WARN')).toEqual([]);
    expect(itemsWith([FALLBACK], 'WARN')).toEqual([FALLBACK]);
    expect(valueKey('TIME', 'HOST_SYSTEM_CLOCK')).toBe('session.captureFacts.timeSource.hostClock');
    expect(valueKey('TIME', 'RTC')).toBe('common.enums.timeSource.RTC');
    expect(precheckTone('WARN', true)).toBe('info');
    expect(precheckTone('WARN')).toBe('warning');
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-i-c-no-removed-spinner.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave I, driver C - re-gate 75 finding G75b-05 (B9 in the wide reading): 269 Reanimated warnings
// "Unable to find SurfaceMountingManager for tag" on the tablet in Session New and at the Session Live
// mount. The hand-over itself (wave H, G89-02) read 0.
//
// WHAT THE SAVED LOGCAT SAYS (`.cache/gates/75b/logcat_T_session1_full.txt`): every line is Reanimated's
// `synchronouslyUpdateUIProps failed for tag N`, retried at each event dispatch of the draw pass (the
// stack enters at `SvgView.onDraw`), in three groups:
//
//   19:51:45.487-.787  4 tags x 49 (2140, 2266, 2386, 2412)  the commit in which the session turned
//                      PRECHECK: the wizard's Stepper is REMOUNTED there (`key={statuses.join('|')}`),
//                      with its entering fades and the kit Spinner of the running badge;
//   19:51:45.788 ... 49.621  8 tags x 8, about 0.5 s apart, ONE NEW TAG PER RESOLVED CHECK
//                      (3020, 3408, 3452 ... 3672: +44 per check) = the kit Spinner of a pre-check row,
//                      removed when its check resolves;
//   19:52:22.307       1 tag x 8 (4762), allocated late = the kit Spinner inside "Start Recording"
//                      (shown once the start is out for 500 ms; a real-capture start waits for the
//                      cameras), removed when the command settles at the hand-over to Session Live.
//
// It is the finding wave H fixed for the Finalizing hand-over (one tag per REMOVED running kit Spinner,
// plus a Stepper copy that starts motion and is replaced), on the screens before the recording. The
// same cure: these places own NO kit Spinner - the running sign is the still glyph React draws - and a
// REMOUNTED Stepper starts no motion (its first mount keeps the enter stagger).
//
// What jest can hold, and does: no kit Spinner is ever mounted in the pre-check rows, in the wizard's
// Stepper after a status change, or in the footer controls; the running signs are still there (same
// testIDs). Written RED: 1 Spinner per running check, 1 in the remounted Stepper, 1 in a pending
// control. The device result (logcat = 0) is NOT provable here - re-drive list of note 134.
describe('no kit Spinner is removed while it runs', () => {
unmountBeforeTheHooksOfThisGroup();
let bed: LiveSessionNewBed | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  resetMissingKeys();
});

afterEach(async () => {
  if (bed !== null) {
    bed.stop();
    bed = null;
    await resetLiveSessionNewBed();
  }
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
});

/** Kit Spinners under a node (the whole screen when none is given). */
const spinnersIn = (node?: ReactTestInstance): number => (node ?? screen.UNSAFE_root).findAllByType(Spinner as never).length;

function startGate(test: TestSim): void {
  const operator = OPERATORS[0]!;
  const result = test.sim.actions.createSession({ caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Rahmat Hidayat', investigatorId: operator.id, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
  if (!result.ok) throw new Error(`createSession failed: ${result.reason}`);
  test.sim.actions.beginPrecheck();
}

async function openGate(window: 'phonePortrait' | 'tabletLandscape'): Promise<SessionNewHarness> {
  const h = renderSessionNewApp({ window, setup: startGate });
  await settle();
  h.openFlow('/session/new?step=2');
  return h;
}

describe.each(['tabletLandscape', 'phonePortrait'] as const)('G75b-05 on %s: the pre-check owns no kit Spinner that is removed while it runs', (window) => {
  it('a RUNNING check shows its still running sign; from the first check to ARMED no kit Spinner is mounted in the rows', async () => {
    const h = await openGate(window);
    const rows = () => screen.getByTestId('session-new-checks');
    // The first check runs: its sign is there (the testID the gate tests read), and it is not a kit Spinner.
    expect(screen.getByTestId('session-new-check-CORE-spinner')).toBeTruthy();
    let seen = spinnersIn(rows());
    let running = 0;
    for (let elapsed = 0; elapsed < PRECHECK_TOTAL_MAX_MS + 600 && h.state().session?.state !== 'ARMED'; elapsed += 100) {
      h.tick(100);
      seen += spinnersIn(rows());
      running += PRECHECK_ORDER.filter((id) => screen.queryByTestId(`session-new-check-${id}-spinner`) !== null).length;
    }
    expect(h.state().session?.state).toBe('ARMED');
    expect(seen).toBe(0);
    // Not vacuous: running signs were drawn on the way, and every check ended with its chip.
    expect(running).toBeGreaterThan(0);
    for (const id of PRECHECK_ORDER) expect(screen.getByTestId(`session-new-check-${id}-status`)).toBeTruthy();
  });

  it('the wizard Stepper remounted by a status change starts no motion: the running badge is the still glyph, no kit Spinner', async () => {
    const h = await openGate(window);
    const stepper = () => screen.getByTestId('session-new-stepper-root');
    // Step 2 runs: the Stepper was mounted for these statuses (a remount when the session turned PRECHECK on a device).
    expect(within(stepper()).getByTestId('session-new-stepper-badge-1-running', { includeHiddenElements: true })).toBeTruthy();
    let seen = spinnersIn(stepper());
    for (let elapsed = 0; elapsed < PRECHECK_TOTAL_MAX_MS + 600 && h.state().session?.state !== 'ARMED'; elapsed += 100) {
      h.tick(100);
      seen += spinnersIn(stepper());
    }
    expect(seen).toBe(0);
    // The statuses changed (running -> active): the remounted copy holds no motion overlay either.
    expect(within(stepper()).queryByTestId('session-new-stepper-badge-1-running', { includeHiddenElements: true })).toBeNull();
    expect(within(stepper()).queryAllByTestId(/-motion$/, { includeHiddenElements: true })).toHaveLength(0);
  });
});

describe('G75b-05: a pending footer control owns no kit Spinner (it is removed when the command settles)', () => {
  const next = () => screen.getByTestId('session-new-next');
  async function fillStep1(): Promise<void> {
    const settleValidation = () => act(async () => {});
    fireEvent.press(screen.getByTestId('session-new-scan'));
    await settleValidation();
    fireEvent.press(screen.getByTestId('session-new-subject-TERSANGKA'));
    await settleValidation();
    fireEvent.changeText(screen.getByTestId('session-new-subject-name'), 'Ahmad Fauzi');
    await settleValidation();
  }

  it('Next with an answer 1 s late: the pending sign appears at 500 ms inside the control, is not a kit Spinner, and no kit Spinner exists on the screen until step 2 is drawn', async () => {
    const b = await renderLiveSessionNew({ answerDelayMs: 1_000 });
    bed = b;
    await b.openFlow();
    await fillStep1();
    fireEvent.press(next());
    await b.flush();
    await b.elapse(500);
    expect(within(next()).getByTestId('session-new-next-spinner')).toBeTruthy();
    let seen = spinnersIn();
    for (let elapsed = 0; elapsed < 1_800; elapsed += 100) {
      await b.elapse(100);
      seen += spinnersIn();
    }
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    expect(screen.queryByTestId('session-new-next-spinner')).toBeNull();
    expect(seen).toBe(0);
  });
});
});
