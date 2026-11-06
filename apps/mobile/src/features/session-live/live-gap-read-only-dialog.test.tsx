// Plan row W87 (step 109), routed by decision D180 ruling DN-5: the Session Monitor's OWN read-only
// refusal (S2-1, `useMonitorActions.run`, `use-monitor.ts` "if (guarded && readOnly)") reached through
// the one path that gets there — the stop-reason Dialog is already open when the Core link drops
// (04_client_integration_spec §8.6 S2-1 "the read-only refusal while the link is down stays first",
// §3.5; gateway_check/09c_m2_mobile_closing §6, mutant C1).
//
// Every other press is stopped earlier by a disabled control (the tiles and the hold button follow
// `useCoreLinkReadOnly()`); the Dialog's confirm is not disabled by the link, so only the action-level
// refusal keeps a stop from being sent while the link is down. Before this file no test reached it.
//
// Decision D179 DC-6: a test that claims "one notice" counts the toast CALLS, not the toasts on screen
// (one toast on screen can hide two calls). `useToast` is wrapped below so that every `toast.show` of
// the app is recorded and then shown as before.
//
// Import order: the jest globals (the module factory below needs them when the kit first loads), the
// gorhom mock, then the router harness, then the bed (see their headers).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { fireEvent, screen } from '@testing-library/react-native';
import { runtimeLog } from '@/runtime';
import { renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed } from './testing/live-monitor-bed';

/** Every `toast.show(options)` the app made, in order (D179 DC-6). */
const mockToastCalls: { variant?: unknown; label?: unknown }[] = [];
jest.mock('heroui-native', () => {
  const actual = jest.requireActual<Record<string, unknown> & { useToast: () => { toast: { show: (options: unknown) => unknown } } }>('heroui-native');
  const { useMemo } = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    ...actual,
    useToast: () => {
      const real = actual.useToast();
      const toast = useMemo(
        () => ({
          ...real.toast,
          show: (options: unknown) => {
            mockToastCalls.push(options as { variant?: unknown; label?: unknown });
            return real.toast.show(options);
          },
        }),
        [real.toast],
      );
      return useMemo(() => ({ ...real, toast }), [real, toast]);
    },
  };
});

let bed: LiveMonitorBed | null = null;

beforeEach(async () => {
  mockToastCalls.length = 0;
  await resetLiveMonitorBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
});

const READ_ONLY = 'Session actions are paused while the Core link is offline.';
const OFFLINE = 'Core server unreachable';
const REASON = 'Interview complete';
const REFUSED_LINE = 'Refused while the Core link is offline';
const isBusy = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.busy === true;
const isDisabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;
const endRecords = () => runtimeLog.records().filter((record) => record.source === 'sessionLive.endSession');

async function openMonitor(): Promise<LiveMonitorBed> {
  const b = await renderLiveMonitor();
  bed = b;
  await b.openMonitor();
  expect(screen.getByTestId('screen-session-live')).toBeTruthy();
  return b;
}

/** The Dialog opens on a tap under the motion test switch and on the 1.5 s hold in full motion (F-4 of W67). */
function openEndDialog(): void {
  fireEvent.press(screen.getByTestId('monitor-end-session'));
  if (screen.queryByTestId('monitor-end-dialog') === null) fireEvent(screen.getByTestId('monitor-end-session'), 'onLongPress');
  expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
}

async function pressAndSettle(testID: string, b: LiveMonitorBed): Promise<void> {
  fireEvent.press(screen.getByTestId(testID));
  await b.flush();
  await b.elapse(200);
}

describe('S2-1: the monitor`s own read-only refusal while the stop-reason Dialog is open (D180 DN-5, mutant C1)', () => {
  it('the link drops with the Dialog open: confirm sends no stop — one read-only toast call, one `info` record, the Dialog keeps the reason; with the link back the same confirm stops', async () => {
    const b = await openMonitor();
    openEndDialog();
    fireEvent.changeText(screen.getByTestId('monitor-end-reason'), REASON);
    expect(isDisabled('monitor-end-confirm')).toBe(false);

    // The Core stops answering and the socket drops: the screen is read-only from the first render that sees it.
    b.setReachable(false);
    await b.flush();
    await b.elapse(500);
    expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
    // The Dialog's confirm is not one of the controls the link disables: the press reaches the action.
    expect(isDisabled('monitor-end-confirm')).toBe(false);

    const callsBefore = mockToastCalls.length;
    const recordsBefore = endRecords().length;
    await pressAndSettle('monitor-end-confirm', b);

    // No stop left the tablet: the refusal is the monitor's own, before any request.
    expect(b.requests('stopSession')).toHaveLength(0);
    // ONE call of `toast.show`, the read-only warning (not the offline toast of a failed request, LB-6).
    expect(mockToastCalls.slice(callsBefore)).toEqual([{ variant: 'warning', label: READ_ONLY }]);
    expect(mockToastCalls.slice(callsBefore).some((call) => call.label === OFFLINE)).toBe(false);
    // ONE log line, at `info`, with the length of the reason and never its text.
    const added = endRecords().slice(recordsBefore);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ level: 'info', message: REFUSED_LINE, context: { reasonLength: REASON.length } });
    expect(JSON.stringify(added)).not.toContain(REASON);
    // The Dialog stays open with what the operator typed, and its confirm is idle again; the Core still records.
    expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
    expect(screen.getByTestId('monitor-end-reason').props.value).toBe(REASON);
    expect(isBusy('monitor-end-confirm')).toBe(false);
    expect(b.engine.sim.store.getState().session?.state).toBe('RECORDING');
    expect(b.app.getPathname()).toBe('/session/live');

    // A second press while still offline: again refused, again one call and one line — nothing queued.
    await pressAndSettle('monitor-end-confirm', b);
    expect(b.requests('stopSession')).toHaveLength(0);
    expect(mockToastCalls.slice(callsBefore).filter((call) => call.label === READ_ONLY)).toHaveLength(2);
    expect(endRecords().slice(recordsBefore)).toHaveLength(2);

    // The link back: the refusal held nothing, and the same confirm now stops the recording.
    b.setReachable(true);
    await b.elapse(40_000, 500);
    await pressAndSettle('monitor-end-confirm', b);
    expect(b.requests('stopSession')).toHaveLength(1);
    expect(b.requests('stopSession')[0]?.body).toEqual({ reason: REASON });
    expect(b.app.getPathname()).toBe('/session/finalizing');
  });
});
