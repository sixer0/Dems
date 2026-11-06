// Audit row 182 (M3-04 R5; register C10-C12; D113): the step-1 live readiness list reads the shared live reader
// `evaluateLiveReadiness`. On a Core in its own capture (`capture: 'external'`) with no reach reading since the Core
// started, every assigned source that the gate would pass reads "Not checked" (`precheck-not-checked-<ID>`), and the
// count line says "N not checked". CONTROL: the simulated lane on the same reach draws none, and the gate is unchanged.
// The expected ids come from the shared reader, so the case follows the seed and `PRECHECK_ORDER` (twelve, D53).
// The mount in the device column (device-previews.tsx `LiveDeviceColumn`, D193) is held by session-new-screen.test.tsx
// (tablet landscape, the same row ids). NOT proven here: the emulator (E3, row 66).
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, screen } from '@testing-library/react-native';
import { PRECHECK_ORDER, evaluateLiveReadiness, evaluatePrecheck, isSourceNotCheckedEvaluation, type PrecheckCheckId, type SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { LiveReadinessChecks, notCheckedCountOf } from './live-readiness';
import { LIVE_NOT_CHECKED } from './use-session-new';

beforeEach(() => resetMissingKeys());
afterEach(() => {
  expect(getMissingKeys()).toEqual([]);
  resetMotionStateForTests();
});

/** Any epoch ms: the reading's time does not matter here, only that one exists. */
const READ_AT = Date.UTC(2026, 9, 1, 3, 0, 0);
const SOURCES = ['LENS_1', 'LENS_2', 'LENS_3', 'LENS_4', 'MIC_PRIMARY', 'MIC_STANDBY', 'MIC_3', 'MIC_4'] as const;

/** Every capture device with the given reach reading (null: none since the Core started), as the shared row 150 case. */
function setReach(test: TestSim, reach: 'REACHABLE' | null): void {
  act(() =>
    test.sim.store.setState((s: SimState) => ({
      captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => ({ ...device, reach, checkedAt: reach === null ? null : READ_AT })) },
    })),
  );
}

async function renderLane(capture: 'simulated' | 'external', reach: 'REACHABLE' | null, linkDown = false): Promise<TestSim> {
  const test = createTestSim({ capture });
  setReach(test, reach);
  renderWithRuntime(<LiveReadinessChecks linkDown={linkDown} />, { sim: test.sim });
  await flushAsync();
  return test;
}

const notCheckedIds = (state: SimState): PrecheckCheckId[] => PRECHECK_ORDER.filter((id) => isSourceNotCheckedEvaluation(evaluateLiveReadiness(state, id)));
const drawnNotChecked = (): string[] => screen.queryAllByTestId(/^precheck-not-checked-(?!count$)/).map((node) => String(node.props.testID).replace('precheck-not-checked-', ''));

describe('row 182: the step-1 live view says "Not checked" for a source never checked since the Core started (C10-C12)', () => {
  it('own capture, no reach reading: one precheck-not-checked row per assigned, unchecked source, plus "N not checked"; the gate stays PASS', async () => {
    const test = await renderLane('external', null);
    const expected = notCheckedIds(test.sim.store.getState());
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.every((id) => (SOURCES as readonly string[]).includes(id))).toBe(true);
    expect(drawnNotChecked()).toEqual(expected);
    for (const id of expected) {
      // The gate's own answer is unchanged (live view only, R150-1).
      expect(evaluatePrecheck(test.sim.store.getState(), id).status).toBe('PASS');
    }
    expect(screen.getAllByText('Not checked')).toHaveLength(expected.length);
    expect(screen.getByTestId('precheck-not-checked-count')).toBeTruthy();
    expect(screen.getByText(`${expected.length} not checked`)).toBeTruthy();
    // Every check keeps its row; the rows that are not "Not checked" keep their value chip.
    // The SECURITY row of a Core with no platform posture reads "Not reported" (no raw NOT_REPORTED, no missing key).
    expect(screen.getByText('Not reported')).toBeTruthy();
    expect(screen.queryByText('NOT_REPORTED')).toBeNull();
    for (const id of PRECHECK_ORDER) {
      expect(screen.getByTestId(`session-new-live-${id}`)).toBeTruthy();
      expect(screen.queryByTestId(`session-new-live-${id}-value`) === null).toBe(expected.includes(id));
    }
  });

  it('a reach reading clears it: REACHABLE on every source draws no Not checked row and no count', async () => {
    await renderLane('external', 'REACHABLE');
    expect(drawnNotChecked()).toEqual([]);
    expect(screen.queryByTestId('precheck-not-checked-count')).toBeNull();
  });

  it('link down: no row and no count says Not checked (the card says the state is not known)', async () => {
    await renderLane('external', null, true);
    expect(drawnNotChecked()).toEqual([]);
    expect(screen.queryByTestId('precheck-not-checked-count')).toBeNull();
    expect(notCheckedCountOf([LIVE_NOT_CHECKED, LIVE_NOT_CHECKED], true)).toBe(0);
    expect(notCheckedCountOf([LIVE_NOT_CHECKED, 'PASS|READY', LIVE_NOT_CHECKED], false)).toBe(2);
  });

  it('CONTROL: the simulated lane on the same reach draws no Not checked row and no count; every check keeps its value chip', async () => {
    const test = await renderLane('simulated', null);
    expect(notCheckedIds(test.sim.store.getState())).toEqual([]);
    expect(drawnNotChecked()).toEqual([]);
    expect(screen.queryByTestId('precheck-not-checked-count')).toBeNull();
    expect(screen.queryByText('Not checked')).toBeNull();
    for (const id of PRECHECK_ORDER) expect(screen.getByTestId(`session-new-live-${id}-value`)).toBeTruthy();
  });
});
