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
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Spinner } from 'heroui-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { OPERATORS, PRECHECK_ORDER, PRECHECK_TOTAL_MAX_MS } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import type { TestSim } from '@/runtime/testing/test-sim';
import { renderLiveSessionNew, resetLiveSessionNewBed, type LiveSessionNewBed } from './testing/live-session-new-bed';
import { renderSessionNewApp, settle, type SessionNewHarness } from './testing/session-new-harness';

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
