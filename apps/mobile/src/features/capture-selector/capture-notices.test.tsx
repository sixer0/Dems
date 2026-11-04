/**
 * The no-device notifications and the microphone re-read on the Devices screen (task 3 row 138; ux
 * spec §8e flow 11 situations A and B, §8g flow 13, §8f.3; the software half of M4-DISC-EMPTY-T / -P,
 * M4-NODEV-B-T / -P, M4-NODEV-NOCFG-T, M4-MIC-RESCAN-T / -P; M4-DEVSRC-LOCAL). Real route files, real
 * simulator, real providers.
 *
 * The notices are raised and cleared through the INTERNAL pair the Core itself uses
 * (`raiseCaptureWarning` / `clearCaptureWarning`, row 133): the screen only reads the `alerts` slice.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { Sim } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderDevicesApp, settle, type DevicesHarness } from '@/features/devices/testing/devices-harness';

beforeEach(() => resetMissingKeys());
afterEach(() => {
  expect(getMissingKeys()).toEqual([]);
  jest.useRealTimers();
});

type SimRequest = Parameters<Sim['request']>[0];
type SimResponse = ReturnType<Sim['request']>;
const DISCOVERY = '/api/v1/capture/discovery';
const RESCAN = '/api/v1/capture/inputs/rescan';

function watch(h: DevicesHarness) {
  const real = h.sim.request.bind(h.sim);
  const seen: string[] = [];
  const box: { answers: ((request: SimRequest) => SimResponse | undefined) | null } = { answers: null };
  (h.sim as { request: Sim['request'] }).request = (request) => {
    seen.push(`${request.method} ${request.path}`);
    return box.answers?.(request) ?? real(request);
  };
  return {
    seen,
    count: (line: string) => seen.filter((entry) => entry === line).length,
    answer(next: typeof box.answers) {
      box.answers = next;
    },
  };
}
const respond = (status: number, body: unknown, headers: Record<string, string> = {}): SimResponse => ({ status, headers, body }) as SimResponse;

const EMPTY = { code: 'CAPTURE_DISCOVERY_EMPTY', subject: null, searchId: 'DSC-000009', trigger: 'MANUAL' } as const;
const unreachable = (subject: string, over: Record<string, unknown> = {}) =>
  ({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject, phase: 'PRECHECK', sessionId: 'SES-20261001-0001', ...over }) as Parameters<Sim['actions']['raiseCaptureWarning']>[0];
const activeNotices = (h: DevicesHarness) => h.sim.store.getState().alerts.filter((alert) => alert.active && alert.kind === 'SYSTEM');
const disabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;

describe('situation A — a search found nothing (§8e.2, §8e.4; R-10 AC-1, AC-5)', () => {
  it('one banner for one alert however many empty searches ran; "Search again" is the panel\'s own control; a later search with a responder leaves 0 banners', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    expect(screen.queryByTestId('capture-notices')).toBeNull();
    // Five empty searches: the Core keeps ONE active alert (row 133); the screen draws what the slice holds.
    for (let i = 0; i < 5; i += 1) act(() => h.sim.actions.raiseCaptureWarning(EMPTY));
    await settle();
    expect(activeNotices(h)).toHaveLength(1);
    const [alert] = activeNotices(h);
    const banner = screen.getByTestId(`capture-notice-${alert!.id}`);
    expect(within(banner).getByText('No camera found')).toBeTruthy();
    expect(screen.getByTestId(`capture-notice-body-${alert!.id}`)).toHaveTextContent('The last search found no camera on the network.');
    expect(screen.getAllByTestId(/^capture-notice-ALR-/)).toHaveLength(1);

    // G13 on the notice: one search of the screen (the simulator answers two cameras).
    fireEvent.press(screen.getByTestId(`capture-notice-search-${alert!.id}`));
    await settle();
    expect(screen.getByTestId('camera-search-summary')).toHaveTextContent('2 found · 1 new · 1 already registered');

    // The Core resolves the alert after a search with a responder; the banner is gone at that state update.
    act(() => h.sim.actions.clearCaptureWarning(EMPTY));
    await settle();
    expect(activeNotices(h)).toHaveLength(0);
    expect(screen.queryByTestId('capture-notices')).toBeNull();
    expect(screen.queryAllByTestId(/^capture-notice-ALR-/)).toHaveLength(0);
  });

  it('no client control hides a banner: it has no dismiss action and survives time passing', async () => {
    jest.useFakeTimers();
    const h = renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    act(() => h.sim.actions.raiseCaptureWarning(EMPTY));
    await settle();
    const [alert] = activeNotices(h);
    expect(within(screen.getByTestId(`capture-notice-${alert!.id}`)).queryByText(/Dismiss|Close|Hide/)).toBeNull();
    h.run(10 * 60_000);
    act(() => jest.advanceTimersByTime(10 * 60_000));
    await settle();
    expect(screen.getByTestId(`capture-notice-${alert!.id}`)).toBeTruthy();
  });
});

describe('situation B — a configured device is unreachable at pre-check (§8e.2; R-10 AC-2, AC-6)', () => {
  it('names the device by label and id with the count of the one search; a named cause is added; one banner per device', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    act(() => h.sim.actions.raiseCaptureWarning(unreachable('CAM-02', { searchResponderCount: 1 })));
    act(() => h.sim.actions.raiseCaptureWarning(unreachable('MIC-01', { cause: 'PERMISSION_DENIED' })));
    await settle();
    const camera = activeNotices(h).find((alert) => alert.target === 'CAM-02')!;
    const mic = activeNotices(h).find((alert) => alert.target === 'MIC-01')!;
    expect(within(screen.getByTestId(`capture-notice-${camera.id}`)).getByText('Camera 2 (CAM-02) is not reachable')).toBeTruthy();
    expect(screen.getByTestId(`capture-notice-body-${camera.id}`)).toHaveTextContent('It did not answer the pre-check. A search found 1 camera.');
    expect(within(screen.getByTestId(`capture-notice-${mic.id}`)).getByText('MIC 1 (MIC-01) is not reachable')).toBeTruthy();
    expect(screen.getByTestId(`capture-notice-body-${mic.id}`)).toHaveTextContent('It did not answer the pre-check. macOS has not allowed access for the Core.');
    // A camera notice offers the camera search; a microphone notice the re-read of the local inputs.
    expect(screen.getByTestId(`capture-notice-search-${camera.id}`)).toBeTruthy();
    expect(screen.getByTestId(`capture-notice-rescan-${mic.id}-action`).props.accessibilityLabel).toBe('Search again for microphones');
    expect(screen.queryByTestId(`capture-notice-search-${mic.id}`)).toBeNull();
    // Names, never values: no address is drawn in a notification (the registry does hold one).
    const hosts = h.sim.store.getState().captureDevices.devices.flatMap((device) => (device.host ? [device.host] : []));
    expect(hosts.length).toBeGreaterThan(0);
    const banners = within(screen.getByTestId('capture-notices'));
    for (const host of hosts) expect(banners.queryByText(host, { exact: false })).toBeNull();
    // Negative control: the same query does find a text the banners draw.
    expect(banners.queryByText('CAM-02', { exact: false })).not.toBeNull();
  });

  it('a later reachable pre-check clears it: 0 stale banners; a later occurrence is a NEW alert, drawn again', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    act(() => h.sim.actions.raiseCaptureWarning(unreachable('CAM-02', { searchResponderCount: 0 })));
    await settle();
    const first = activeNotices(h)[0]!;
    expect(screen.getByTestId(`capture-notice-body-${first.id}`)).toHaveTextContent('It did not answer the pre-check. A search found 0 cameras.');
    act(() => h.sim.actions.clearCaptureWarning(unreachable('CAM-02')));
    await settle();
    expect(screen.queryByTestId('capture-notices')).toBeNull();
    act(() => h.sim.actions.raiseCaptureWarning(unreachable('CAM-02', { searchResponderCount: 2 })));
    await settle();
    const second = activeNotices(h)[0]!;
    expect(second.id).not.toBe(first.id);
    expect(screen.getByTestId(`capture-notice-${second.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`capture-notice-${first.id}`)).toBeNull();
  });
});

describe('the operator without CAPTURE_CONFIG (§8e.3; M4-NODEV-NOCFG-T)', () => {
  it('sees the notifications; both "Search again" controls are drawn DISABLED with the role sentence; no list is requested', async () => {
    const h = renderDevicesApp({ user: 'budi.santoso', initialUrl: '/' });
    const requests = watch(h);
    act(() => h.sim.actions.raiseCaptureWarning(EMPTY));
    act(() => h.sim.actions.raiseCaptureWarning(unreachable('MIC-02')));
    h.navigate('/devices');
    await settle();
    const empty = activeNotices(h).find((alert) => alert.target === 'CAPTURE_DISCOVERY')!;
    const mic = activeNotices(h).find((alert) => alert.target === 'MIC-02')!;
    expect(screen.getByTestId(`capture-notice-${empty.id}`)).toBeTruthy();
    expect(disabled(`capture-notice-search-${empty.id}`)).toBe(true);
    expect(screen.getByTestId(`capture-notice-search-${empty.id}-gate`)).toHaveTextContent('Requires the Supervisor or Technician role');
    expect(disabled(`capture-notice-rescan-${mic.id}-action`)).toBe(true);
    expect(screen.getByTestId(`capture-notice-rescan-${mic.id}-gate`)).toHaveTextContent('Requires the Supervisor or Technician role');
    fireEvent.press(screen.getByTestId(`capture-notice-search-${empty.id}`));
    fireEvent.press(screen.getByTestId(`capture-notice-rescan-${mic.id}-action`));
    await settle();
    expect(requests.seen.filter((line) => line.endsWith(DISCOVERY) || line.endsWith(RESCAN))).toEqual([]);
    expect(screen.queryByTestId('camera-search-list')).toBeNull();
  });
});

describe('microphones: "Search again" re-reads the local inputs (§8g; M4-MIC-RESCAN)', () => {
  it('one press = ONE request of operation 97 and no camera search; a line per registered microphone, "Checked at", one audit row', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', initialUrl: '/' });
    const requests = watch(h);
    h.navigate('/devices');
    await settle();
    const control = screen.getByTestId('capture-selector-mic-rescan');
    expect(within(control).getByText('Reads again the microphones connected to the Core. The network is not searched for microphones.')).toBeTruthy();
    expect(screen.getByTestId('capture-selector-mic-rescan-action').props.accessibilityLabel).toBe('Search again for microphones');
    expect(requests.count(`POST ${RESCAN}`)).toBe(0);
    fireEvent.press(screen.getByTestId('capture-selector-mic-rescan-action'));
    await settle();
    expect(requests.count(`POST ${RESCAN}`)).toBe(1);
    expect(requests.count(`POST ${DISCOVERY}`)).toBe(0);
    expect(screen.getByTestId('capture-selector-mic-rescan-state-MIC-01').props.accessibilityLabel).toBe('Ready');
    expect(screen.getByTestId('capture-selector-mic-rescan-state-MIC-02').props.accessibilityLabel).toBe('Ready');
    expect(screen.getByTestId('capture-selector-mic-rescan-checked-at')).toHaveTextContent(/^Checked at \d\d:\d\d:\d\d$/);
    expect(screen.queryByTestId('capture-selector-mic-rescan-unregistered')).toBeNull();
    const rows = h.sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_DISCOVERY_SEARCHED');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.details).toMatchObject({ scope: 'MIC_LOCAL', operationId: 'rescanCaptureInputs' });
  });

  it('M4-DEVSRC-LOCAL: each named state keeps the microphone\'s own line with its sentence; nothing is offered in its place; other inputs are only counted', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', initialUrl: '/' });
    const requests = watch(h);
    h.navigate('/devices');
    await settle();
    const entry = (deviceId: string, present: boolean, errorCode: string | null) => ({ deviceId, inputId: deviceId, present, adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT', errorCode });
    const cases: [string, string, RegExp][] = [
      ['PERMISSION_DENIED', 'Permission needed', /On the Mac that runs the Core, open System Settings > Privacy & Security > Microphone, allow it, then search again\./],
      ['DEVICE_BUSY', 'In use', /Another application is using this microphone\. Close that application, then search again\./],
      ['DEVICE_NOT_FOUND', 'Not found', /Core Mac's microphone was not found\./],
      ['OPEN_FAILED', 'Could not be opened', /Core Mac's microphone could not be opened\./],
    ];
    for (const [errorCode, chip, sentence] of cases) {
      requests.answer((request) =>
        request.path === RESCAN ? respond(200, { scannedAt: h.sim.store.getState().clock.now, inputs: [entry('MIC-01', false, errorCode), entry('MIC-02', true, null)], unregisteredCount: 2 }) : undefined,
      );
      fireEvent.press(screen.getByTestId('capture-selector-mic-rescan-action'));
      await settle();
      expect(screen.getByTestId('capture-selector-mic-rescan-state-MIC-01').props.accessibilityLabel).toBe(chip);
      expect(screen.getByTestId('capture-selector-mic-rescan-sentence-MIC-01')).toHaveTextContent(sentence);
      expect(screen.getByTestId('capture-selector-mic-rescan-state-MIC-02').props.accessibilityLabel).toBe('Ready');
      expect(screen.queryByTestId('capture-selector-mic-rescan-sentence-MIC-02')).toBeNull();
    }
    expect(screen.getByTestId('capture-selector-mic-rescan-unregistered')).toHaveTextContent('2 other microphones are connected to the Core but not registered.');
    // The selector still shows the same two microphone rows under their own names; no test source appeared.
    expect(screen.getByTestId('capture-selector-row-MIC-01')).toBeTruthy();
    expect(screen.getByTestId('capture-selector-row-MIC-02')).toBeTruthy();
    expect(screen.queryByText(/Test source|use a test source/i)).toBeNull();
    // R-11 AC-9: nothing opens a system setting — the control's only action is the re-read.
    expect(requests.seen.filter((line) => !line.endsWith(RESCAN) && !line.endsWith(DISCOVERY))).toEqual([]);
  });

  it('too soon (429): the fixed seconds, disabled until then, re-enabled by itself, nothing re-read by itself; not ready (503): the sentence + Retry', async () => {
    jest.useFakeTimers();
    const h = renderDevicesApp({ user: 'rina.wijaya', initialUrl: '/' });
    const requests = watch(h);
    h.navigate('/devices');
    await settle();
    requests.answer((request) => (request.path === RESCAN ? respond(429, { error: { code: 'RATE_LIMITED', message: 'x', details: { reason: 'INPUT_RESCAN_RATE_LIMITED' } } }, { 'retry-after': '5' }) : undefined));
    fireEvent.press(screen.getByTestId('capture-selector-mic-rescan-action'));
    await settle();
    expect(screen.getByTestId('capture-selector-mic-rescan-limited')).toHaveTextContent('The Core server is limiting requests from this console. Try again in 5 s.');
    expect(disabled('capture-selector-mic-rescan-action')).toBe(true);
    act(() => jest.advanceTimersByTime(5_100));
    await settle();
    expect(disabled('capture-selector-mic-rescan-action')).toBe(false);
    expect(requests.count(`POST ${RESCAN}`)).toBe(1);

    requests.answer((request) => (request.path === RESCAN ? respond(503, { error: { code: 'NOT_READY', message: 'x', details: { reason: 'CAPTURE_NOT_READY' } } }) : undefined));
    fireEvent.press(screen.getByTestId('capture-selector-mic-rescan-action'));
    await settle();
    expect(screen.getByTestId('capture-selector-mic-rescan-not-ready')).toHaveTextContent(/Capture is not ready yet/);
    fireEvent.press(screen.getByTestId('capture-selector-mic-rescan-retry'));
    await settle();
    expect(requests.count(`POST ${RESCAN}`)).toBe(3);
  });
});
