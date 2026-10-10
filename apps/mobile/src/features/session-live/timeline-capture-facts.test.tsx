// Fix wave H, driver A, finding G75-01 (gate 81 G81-04: the tablet's Session Live timeline showed
// "Evidence Auto-Save - Autosave segment 1" and "System Check - Integrity check passed" beside a
// REAL recording; rulings D197, D199). Beside a recording of the Core's own capture the timeline
// draws no row the simulator's generator invents. A check the seal side wrote stays.
//
// The session is put on the store as the Core sends it in real capture (`captureDurable` beside
// the stored state), with a timeline that STILL holds such rows: the surface is the second guard.
// CONTROL: the simulator's own recording (no member) draws them.
//
// Import order matters: the gorhom mock, then the router harness.
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { act, screen, within } from '@testing-library/react-native';
import { en } from '@dems/shared/i18n';
import { resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { timelineOfCaptureFacts } from './session-live.math';
import { renderMonitorApp, settle } from './testing/monitor-harness';

afterEach(() => {
  resetMotionStateForTests();
  resetMissingKeys();
});

const KIND = en.session.timeline.kind;
/** The titles of the rows only the generator writes. */
const INVENTED_TITLES = [KIND.AUTOSAVE, KIND.HEALTH, KIND.CHECK];

describe('G75-01: the Session Live timeline beside a recording of the Core\'s own capture', () => {
  it('draws no "Evidence Auto-Save", "System Check" or "Device Health Normal" row; the rows of the operator stay', async () => {
    const h = renderMonitorApp({ window: 'tabletLandscape' });
    await settle();
    h.openMonitor();
    const root = () => within(screen.getByTestId('screen-session-live'));
    // CONTROL: the simulator's own recording (the scenario's replayed stream) draws them.
    const stored = h.sim.store.getState().session!.timeline.map((item) => item.kind);
    expect(stored).toContain('AUTOSAVE');
    expect(stored).toContain('CHECK');
    expect(root().queryAllByText(KIND.AUTOSAVE).length).toBeGreaterThan(0);
    expect(root().queryAllByText(KIND.CHECK).length).toBeGreaterThan(0);

    // The same session as a Core in real capture sends it: the member is there.
    act(() => {
      const session = h.sim.store.getState().session!;
      h.sim.store.setState({ session: { ...session, captureDurable: true } });
    });
    await settle();
    for (const title of INVENTED_TITLES) expect(root().queryAllByText(title)).toHaveLength(0);
    expect(root().queryByText(/Autosave|Integrity check passed|Health check OK/)).toBeNull();
    expect(root().queryAllByText(KIND.START).length).toBeGreaterThan(0);
  });
});

describe('timelineOfCaptureFacts', () => {
  const rows = [
    { id: 'T1', kind: 'START', params: {} },
    { id: 'T2', kind: 'AUTOSAVE', params: { segment: 1, bytesWritten: 1 } },
    { id: 'T3', kind: 'CHECK', params: { source: 'GNSS' } },
    { id: 'T4', kind: 'HEALTH', params: {} },
    { id: 'T5', kind: 'CHECK', params: { source: 'TAIL_VALIDATION', trackId: 'VIDEO-01' } },
    { id: 'T6', kind: 'MARKER', params: null },
  ];

  it('own capture: the generator\'s rows are left out, a check of the seal side stays', () => {
    expect(timelineOfCaptureFacts(rows, true).map((row) => row.id)).toEqual(['T1', 'T5', 'T6']);
  });

  it('CONTROL - the simulator\'s own capture keeps every row, as the same array', () => {
    expect(timelineOfCaptureFacts(rows, false)).toBe(rows);
  });

  it('own capture with nothing to leave out returns the same array (no render for nothing)', () => {
    const clean = rows.filter((row) => ['T1', 'T5', 'T6'].includes(row.id));
    expect(timelineOfCaptureFacts(clean, true)).toBe(clean);
  });
});
