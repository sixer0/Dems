// T-M10 (04_mobile_specs §10.1; MA-29 step 2, MA-30 step-2 part): the Start Session Devices Check,
// the book's §5.3 pre-recording gate, on the real simulator with fake time (the simulator's manual
// clock drives the seeded 300–700 ms per check; jest's fake timers hold every UI timer).
//   PASS  → eight checks resolve in sequence, the simulator arms itself, Next leads to Ready;
//   WARN  → a warning Alert and "Acknowledge warnings"; Next only after the tick, then ARMED;
//   BLOCK → a danger Alert naming the reason, Next disabled, "Run checks again" after the fix.
// Import order: the test setup, then the router harness (see their headers).
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { OPERATORS, PRECHECK_ORDER, PRECHECK_TOTAL_MAX_MS } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import type { TestSim } from '@/runtime/testing/test-sim';
import { auditTypes, renderSessionNewApp, settle, type SessionNewHarness } from './testing/session-new-harness';

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
  it('PASS: eight checks resolve one after another within 4.9 s, then the simulator arms and Next leads to Ready', async () => {
    const h = await openGate();
    expect(screen.getByTestId('screen-session-new')).toBeTruthy();
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    // All eight rows, in the book's order, with the first one running.
    for (const id of PRECHECK_ORDER) expect(screen.getByTestId(`session-new-check-${id}`)).toBeTruthy();
    expect(screen.getByTestId('session-new-check-CORE-spinner')).toBeTruthy();
    expect(checkStatus('CORE')).toBeNull();
    expect(nextButton().props.accessibilityState?.disabled).toBe(true);

    // The seeded schedule: each check 300–700 ms, the whole gate ≤ 4.9 s.
    const items = h.state().session!.precheck.items;
    const startedAt = h.state().session!.precheck.startedAt!;
    let previous = startedAt;
    for (const item of items) {
      const duration = item.resolvesAt! - previous;
      expect(duration).toBeGreaterThanOrEqual(300);
      expect(duration).toBeLessThanOrEqual(700);
      previous = item.resolvesAt!;
    }
    expect(previous - startedAt).toBeLessThanOrEqual(PRECHECK_TOTAL_MAX_MS);

    // Resolve in sequence: after the first check's time only CORE has a chip.
    h.tick(items[0]!.resolvesAt! - startedAt);
    expect(checkStatus('CORE')).toBeTruthy();
    expect(screen.getByText('1 of 8 checked')).toBeTruthy();
    expect(checkStatus('SECURITY')).toBeNull();

    h.tick(PRECHECK_TOTAL_MAX_MS);
    for (const id of PRECHECK_ORDER) expect(screen.getByTestId(`session-new-check-${id}-status`)).toBeTruthy();
    expect(screen.getByText('8 of 8 checked')).toBeTruthy();
    expect(screen.getAllByText('PASS').length).toBeGreaterThanOrEqual(8);
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
    expect(screen.getByTestId('session-new-check-MIC_2-status')).toBeTruthy();
    expect(screen.getByTestId('session-new-check-MIC_2-value').props.children).toBe('NO SIGNAL');
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
