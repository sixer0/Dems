// Fix wave H, closing pass Z2 (driver A's request line of 10:20:55Z, item 3; decisions D203, D207;
// closing pass Z1's line of 10:30:00Z for the member names). Session Live beside a Core in its own
// capture:
//
// | Rule | Case |
// |------|------|
// | The TIME chip words the time source AS THE CORE STATES IT: a slice that says the host clock (`hostClock: true`, `isHostClockTime`) reads "Host system clock" - no "GNSS", no "LOCKED", no warning tone for a clock that is not a fallback | "TIME chip" |
// | The capture checkpoint facts (`session.captureCheckpoints`) are drawn when the Core states them; absent = nothing, never 0; never beside a session of the simulator's own capture | "checkpoints" |
//
// CONTROLS: the simulator's own time slice keeps "TIME GNSS LOCKED"; the simulated recording draws no checkpoint line.
//
// Import order matters: the gorhom mock, then the router harness.
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { CaptureCheckpoints } from './capture-checkpoints';
import { captureCheckpointsOf, checkpointAge, ownCaptureOf } from './own-capture';
import { statusStrip } from './session-live.math';
import { renderMonitorApp, settle, type MonitorHarness } from './testing/monitor-harness';

afterEach(() => {
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
  resetMissingKeys();
});

const HOST_CLOCK = { hostClock: true, source: 'RTC', locked: false, stratum: 0, offsetMs: 0, lastSyncAt: 0, gnss: { locked: false, satellites: 0 }, ntp: { server: '', reachable: false, stratum: 0 }, rtc: { driftPpm: 0 }, history: [] };
/** The chip's words: its label prop and every text below it. */
const textOf = (testID: string): string => screen.getAllByTestId(testID).map((node) => `${String(node.props.label ?? '')} ${String(node.props.accessibilityLabel ?? '')} ${allText(node)}`).join(' ');
function allText(node: { children?: unknown[]; props?: Record<string, unknown> }): string {
  return (node.children ?? []).map((child) => (typeof child === 'string' ? child : allText(child as { children?: unknown[] }))).join(' ');
}
const setSession = (h: MonitorHarness, patch: Record<string, unknown>) =>
  act(() => {
    const session = h.sim.store.getState().session!;
    h.sim.store.setState({ session: { ...session, ...patch } as typeof session });
  });

describe('TIME chip: the time source as the Core states it', () => {
  it('a Core whose time is the host system clock: "TIME Host system clock" - no GNSS, no LOCKED', async () => {
    const h = renderMonitorApp({ window: 'tabletLandscape' });
    await settle();
    h.openMonitor();
    // CONTROL: the simulator's own slice.
    expect(textOf('monitor-strip-time')).toContain('TIME GNSS LOCKED');

    act(() => h.sim.store.setState({ time: HOST_CLOCK as never }));
    await settle();
    const text = textOf('monitor-strip-time');
    expect(text).toContain('TIME Host system clock');
    expect(text).not.toContain('GNSS');
    expect(text).not.toContain('LOCKED');
    expect(text).not.toContain('RTC');
  });

  it('the rule (pure): the host clock is no fallback - an info chip that is not "locked"; an RTC fallback of the simulation stays a warning', () => {
    const base = { cameras: [], storage: 'READY' as const };
    expect(statusStrip({ ...base, timeSource: 'RTC', timeLocked: false, hostClock: true }).at(-1)).toEqual({ kind: 'time', id: 'time', value: 'RTC', locked: false, host: true, tone: 'info' });
    // Stated locked by mistake: the host clock is never drawn as locked.
    expect(statusStrip({ ...base, timeSource: 'RTC', timeLocked: true, hostClock: true }).at(-1)).toMatchObject({ locked: false, host: true });
    expect(statusStrip({ ...base, timeSource: 'RTC', timeLocked: false }).at(-1)).toEqual({ kind: 'time', id: 'time', value: 'RTC', locked: false, host: false, tone: 'warning' });
    expect(statusStrip({ ...base, timeSource: 'GNSS', timeLocked: true }).at(-1)).toEqual({ kind: 'time', id: 'time', value: 'GNSS', locked: true, host: false, tone: 'success' });
  });
});

describe('checkpoints: what the Core states of its durable fragments', () => {
  const CHECKPOINTS = {
    fragments: 24,
    bytes: 34_000_000,
    cameras: [
      { deviceId: 'CAM-01', fragments: 12, bytes: 20_000_000 },
      { deviceId: 'CAM-02', fragments: 12, bytes: 14_000_000 },
    ],
  };

  it('Session Live: drawn from the session member in real capture; absent = nothing drawn; never beside the simulator\'s own recording', async () => {
    const h = renderMonitorApp({ window: 'tabletLandscape' });
    await settle();
    h.openMonitor();
    const lastAt = Math.floor(h.sim.store.getState().clock.now / 1000) * 1000 - 2_000;
    // CONTROL: a session without the capture member draws none, whatever else it carries.
    setSession(h, { captureCheckpoints: { ...CHECKPOINTS, lastAt } });
    await settle();
    expect(screen.queryByTestId('monitor-capture-checkpoints')).toBeNull();

    setSession(h, { captureDurable: true, captureCheckpoints: undefined });
    await settle();
    // ABSENT: nothing - never a zero.
    expect(screen.queryByTestId('monitor-capture-checkpoints')).toBeNull();

    setSession(h, { captureDurable: true, captureCheckpoints: { ...CHECKPOINTS, lastAt } });
    await settle();
    const line = screen.getAllByTestId('monitor-capture-checkpoints-total')[0]!;
    expect(allText(line)).toBe('24 fragments saved · last 2 s ago · 34.0 MB');
    expect(screen.getAllByTestId('monitor-capture-checkpoints-camera-CAM-01').length).toBeGreaterThan(0);
    expect(allText(screen.getAllByTestId('monitor-capture-checkpoints-camera-CAM-01')[0]!)).toBe('Camera 1 (CAM-01) · 12 fragments saved · 20.0 MB');
  });

  it('the component from literal props (no store): totals, one line per camera, minutes from two minutes on', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <CaptureCheckpoints facts={{ fragments: 1, bytes: 1_500_000_000, lastAt: 0, cameras: [{ deviceId: 'CAM-03', fragments: 1, bytes: 1_500_000_000 }] }} nowMs={180_000} />
      </I18nextProvider>,
    );
    expect(allText(screen.getByTestId('monitor-capture-checkpoints-total'))).toBe('1 fragment saved · last 3 min ago · 1.5 GB');
    expect(screen.getByTestId('monitor-capture-checkpoints-camera-CAM-03')).toBeTruthy();
  });

  it('the readers (pure)', () => {
    expect(ownCaptureOf(null)).toBe(false);
    expect(ownCaptureOf({ state: 'RECORDING' })).toBe(false);
    expect(ownCaptureOf({ state: 'RECORDING', captureDurable: false })).toBe(true);
    expect(ownCaptureOf({ state: 'SEALED', captureDurable: true })).toBe(true);
    expect(captureCheckpointsOf(null)).toBeNull();
    expect(captureCheckpointsOf({})).toBeNull();
    expect(captureCheckpointsOf({ captureCheckpoints: { fragments: 0, bytes: 0, lastAt: 1, cameras: [] } })).toBeNull();
    expect(captureCheckpointsOf({ captureCheckpoints: { fragments: '3', bytes: 1, lastAt: 1, cameras: [] } })).toBeNull();
    expect(captureCheckpointsOf({ captureCheckpoints: { fragments: 3, bytes: 10, lastAt: 5, cameras: [{ deviceId: 'CAM-01', fragments: 3, bytes: 10 }, { deviceId: 7 }] } })).toEqual({ fragments: 3, bytes: 10, lastAt: 5, cameras: [{ deviceId: 'CAM-01', fragments: 3, bytes: 10 }] });
    expect(checkpointAge(10_000, 8_000)).toEqual({ unit: 'lastSeconds', seconds: 2 });
    expect(checkpointAge(8_000, 10_000)).toEqual({ unit: 'lastSeconds', seconds: 0 });
    expect(checkpointAge(200_000, 0)).toEqual({ unit: 'lastMinutes', minutes: 3 });
  });
});
