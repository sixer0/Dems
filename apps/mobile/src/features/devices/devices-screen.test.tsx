/**
 * Devices & Inputs (04_mobile_specs §4.12, MB 7; step 84): the MB 7 list on a phone, the pushed
 * device detail (Overview / Health / Log, diagnostics sheet, test signal, Technician-only restart,
 * clip reset), calm fault escalation (03M P7) and the tablet list | detail split (§2.4).
 * Real route files, real simulator, real providers; real timers (Reanimated in Jest, S72-12).
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { FaultKind, isOwnCaptureCoreState, ownCaptureCoreFactsTransition, type SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderDevicesApp, settle, type DevicesHarness } from './testing/devices-harness';
import { settledBusyState } from '@/features/capture-selector/settled-busy-state';
import { deviceStatus } from './devices-model';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('devices screen', () => {
unmountBeforeTheHooksOfThisGroup();

beforeEach(() => resetMissingKeys());
// MA-21: every string the screens render comes from an i18n key.
afterEach(() => expect(getMissingKeys()).toEqual([]));

async function openDetail(h: DevicesHarness, deviceId: string) {
  fireEvent.press(screen.getByTestId(`device-row-${deviceId}`));
  await settle();
  expect(h.app.getPathname()).toBe(`/devices/${deviceId}`);
  expect(screen.getByTestId('screen-device-detail')).toBeTruthy();
}

function auditOf(h: DevicesHarness, type: string, deviceId: string) {
  return h.sim.store.getState().audit.rows.filter((row) => row.type === type && row.deviceId === deviceId);
}

describe('phone portrait (MB 7)', () => {
  it('renders the MB 7 sections and rows in order, with the dataset statuses', async () => {
    renderDevicesApp();
    await settle();
    const root = screen.getByTestId('screen-devices');
    expect(within(root).getByText('Devices & Inputs')).toBeTruthy();
    const sections = ['cameras', 'audio', 'other'].map((id) => screen.getByTestId(`devices-section-${id}`));
    expect(within(sections[0]!).getByText('Camera Devices')).toBeTruthy();
    expect(within(sections[1]!).getByText('Audio Inputs')).toBeTruthy();
    expect(within(sections[2]!).getByText('Other Devices')).toBeTruthy();

    // V2: all four cameras (D60, 2026-11-04) with the room and an Online chip.
    expect(within(sections[0]!).getByText('Camera 1')).toBeTruthy();
    expect(within(sections[0]!).getByText('Camera 2')).toBeTruthy();
    expect(within(sections[0]!).getByText('Camera 3')).toBeTruthy(); // D60
    expect(within(sections[0]!).getByText('Camera 4')).toBeTruthy(); // D60
    expect(within(sections[0]!).getAllByText('Interview Room 1')).toHaveLength(4);
    expect(screen.getByTestId('device-status-CAM-01').props.accessibilityLabel).toBe('Online');
    // V3: canonical mic labels (04 §9 #8) and channels (D61, 2026-11-04: four simultaneous channels; the row says the ordinal of the channel code).
    expect(within(sections[1]!).getByText('MIC 1 – Interviewer')).toBeTruthy();
    expect(within(sections[1]!).getByText('MIC 2 – Subject')).toBeTruthy();
    expect(within(sections[1]!).getByText('MIC 3')).toBeTruthy(); // D61
    expect(within(sections[1]!).getByText('MIC 4')).toBeTruthy(); // D61
    expect(within(sections[1]!).getByText('Channel 1')).toBeTruthy();
    expect(within(sections[1]!).getByText('Channel 2')).toBeTruthy();
    expect(screen.getByTestId('device-status-MIC-02').props.accessibilityLabel).toBe('Online');
    // V4: PoE in the design book's camera-port view (D60: four camera ports) (D79), lamp relay Active, tablet Connected.
    expect(within(screen.getByTestId('device-status-POE-SWITCH')).getByText('3 active · 1 spare')).toBeTruthy();
    // Fix wave J (JA2-33): at rest the indicator's ONE statement is "Lamp off" (it read "Active" beside a red beacon).
    expect(screen.getByTestId('device-status-REC-INDICATOR').props.accessibilityLabel).toBe('Lamp off');
    expect(screen.getByTestId('device-status-TABLET').props.accessibilityLabel).toBe('Connected');
    expect(screen.queryByText(/4\/4/)).toBeNull();
    // Phone rows carry no inline meters; nothing needs attention; the lamp is unlit.
    expect(screen.queryByTestId('device-row-meter-MIC-01')).toBeNull();
    expect(screen.queryByTestId('devices-attention')).toBeNull();
    expect(screen.queryByTestId('device-rec-lamp-lit')).toBeNull();
    expect(screen.queryByTestId('pane-detail')).toBeNull();
  });

  it('a camera row pushes its detail: live feed, Overview facts, Health line, Log, Back', async () => {
    const h = renderDevicesApp();
    await settle();
    await openDetail(h, 'CAM-01');
    expect(screen.getByTestId('device-detail-screen')).toBeTruthy();
    expect(screen.getByTestId('device-detail-feed')).toBeTruthy();
    expect(screen.getByTestId('device-detail-status').props.accessibilityLabel).toBe('Online');
    expect(screen.getByTestId('device-detail-id')).toHaveTextContent('CAM-01');
    expect(within(screen.getByTestId('device-fact-port')).getByText('PoE CAM 1')).toBeTruthy();
    expect(screen.getByText('1080p • 25 fps • H.264')).toBeTruthy();

    h.run(6_000);
    fireEvent.press(screen.getByTestId('device-tab-health'));
    await settle();
    expect(screen.getByText('Link quality (%)')).toBeTruthy();
    const line = screen.getByTestId('victory-line');
    expect(line.props.animate).toBeUndefined();
    expect((line.props.points as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('device-health-samples')).toHaveTextContent(/Simulated · last \d+ samples/);

    fireEvent.press(screen.getByTestId('device-tab-log'));
    await settle();
    expect(screen.getByTestId('device-log-empty')).toBeTruthy();

    fireEvent.press(screen.getByTestId('device-detail-back'));
    await settle();
    expect(h.app.getPathname()).toBe('/devices');
  });

  // Row 55 (P12-F08): the Overview's format is the camera slice's statement - no codec and no rate of the screen's own.
  it('row 55: the camera detail states HEVC for an HEVC slice, with the stated rate, and with no rate when the slice states none', async () => {
    const h = renderDevicesApp();
    await settle();
    await openDetail(h, 'CAM-01');
    expect(within(screen.getByTestId('device-fact-format')).getByText('1080p • 25 fps • H.264')).toBeTruthy();

    act(() => h.sim.store.setState((s) => ({ cameras: s.cameras.map((camera) => ({ ...camera, resolution: '2160p', fps: 30, codec: 'HEVC' as const })) })));
    await settle();
    expect(within(screen.getByTestId('device-fact-format')).getByText('2160p • 30 fps • HEVC')).toBeTruthy();

    act(() => h.sim.store.setState((s) => ({ cameras: s.cameras.map((camera) => ({ ...camera, resolution: '1080p', fps: null, codec: 'HEVC' as const })) })));
    await settle();
    expect(within(screen.getByTestId('device-fact-format')).getByText('1080p • HEVC')).toBeTruthy();
    expect(screen.queryByText(/fps|H\.264/)).toBeNull();
  });

  it('Test signal goes through a Dialog and writes the audit row; the Log shows it from codes', async () => {
    const h = renderDevicesApp();
    await settle();
    await openDetail(h, 'MIC-02');
    fireEvent.press(screen.getByTestId('device-action-test-signal'));
    await settle();
    expect(screen.getByText('Send a test signal to MIC 2?')).toBeTruthy();
    fireEvent.press(screen.getByTestId('device-command-confirm'));
    await settle();
    expect(auditOf(h, 'DEVICE_COMMAND', 'MIC-02').map((row) => row.details.command)).toEqual(['TEST_SIGNAL']);
    fireEvent.press(screen.getByTestId('device-tab-log'));
    await settle();
    const log = screen.getByTestId('device-log');
    expect(within(log).getByText('Device command sent')).toBeTruthy();
    expect(within(log).getByText('Test signal (simulated)')).toBeTruthy();
  });

  it('Restart needs the Technician role and is unavailable while recording (D79)', async () => {
    let h = renderDevicesApp({ user: 'budi.santoso' });
    await settle();
    await openDetail(h, 'CAM-02');
    expect(screen.getByTestId('device-action-restart').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('device-restart-hint')).toHaveTextContent('Requires the Technician role');
    h.app.unmount();

    h = renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    await openDetail(h, 'CAM-02');
    expect(screen.queryByTestId('device-restart-hint')).toBeNull();
    fireEvent.press(screen.getByTestId('device-action-restart'));
    await settle();
    expect(screen.getByText('Restart Camera 2?')).toBeTruthy();
    fireEvent.press(screen.getByTestId('device-command-confirm'));
    await settle();
    expect(auditOf(h, 'DEVICE_COMMAND', 'CAM-02').map((row) => row.details.command)).toEqual(['RESTART']);
    h.app.unmount();

    h = renderDevicesApp({ user: 'rina.wijaya', recording: true });
    await settle();
    await openDetail(h, 'CAM-02');
    expect(screen.getByTestId('device-action-restart').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('device-restart-hint')).toHaveTextContent('Not available while recording');
  });

  it('a microphone shows the large meter, read-only gain and phantom; the CLIP latch holds until Reset clip', async () => {
    const h = renderDevicesApp();
    await settle();
    await openDetail(h, 'MIC-01');
    expect(screen.getByTestId('device-detail-meter')).toBeTruthy();
    expect(within(screen.getByTestId('device-fact-gain')).getByText('32 dB')).toBeTruthy();
    expect(within(screen.getByTestId('device-fact-phantom')).getByText('48 V ON')).toBeTruthy();
    expect(screen.getByText('Gain and phantom power are read-only in this demo.')).toBeTruthy();

    h.sim.actions.inject(FaultKind.MIC_CLIP, { channel: 'AUDIO-01' });
    h.run(1_500);
    h.sim.actions.clearFault(FaultKind.MIC_CLIP, { channel: 'AUDIO-01' });
    h.run(200);
    await settle();
    expect(h.sim.store.getState().mics[0]!.clipLatched).toBe(true);
    expect(screen.getByTestId('device-detail-status').props.accessibilityLabel).toBe('Clipping');
    fireEvent.press(screen.getByTestId('device-clip-reset'));
    await settle();
    expect(h.sim.store.getState().mics[0]!.clipLatched).toBe(false);
    expect(screen.getByTestId('device-detail-status').props.accessibilityLabel).toBe('Online');

    // Health: the 1 s peak line closes points on the simulator clock.
    fireEvent.press(screen.getByTestId('device-tab-health'));
    await settle();
    h.run(4_000);
    await settle();
    expect(screen.getByText('Signal level (dBFS, 1 s peak)')).toBeTruthy();
    expect((screen.getByTestId('victory-line').props.points as unknown[]).length).toBeGreaterThanOrEqual(2);
  });

  it('Run diagnostics opens the sheet; the eight checks resolve on the simulator clock', async () => {
    const h = renderDevicesApp();
    await settle();
    await openDetail(h, 'POE-SWITCH');
    expect(within(screen.getByTestId('device-fact-ports')).getByText('3 active · 1 spare')).toBeTruthy();
    fireEvent.press(screen.getByTestId('device-action-diagnostics'));
    await settle();
    const sheet = screen.getByTestId('device-diagnostics-sheet');
    expect(within(sheet).getByText('Run Diagnostics')).toBeTruthy();
    expect(screen.getByTestId('device-diagnostics-CPU-running')).toBeTruthy();
    expect(within(sheet).getByText('0 of 8 checks')).toBeTruthy();
    h.run(6_000);
    await settle();
    expect(within(sheet).getByText('All checks passed')).toBeTruthy();
    for (const id of ['CPU', 'STORAGE', 'FAN', 'NETWORK', 'CAMERA', 'AUDIO', 'TIME', 'SECURITY']) {
      expect(screen.getByTestId(`device-diagnostics-${id}-PASS`)).toBeTruthy();
    }
    expect(h.sim.store.getState().audit.rows.some((row) => row.type === 'DIAGNOSTICS_RUN')).toBe(true);
    expect(screen.getByTestId('device-diagnostics-again')).toBeTruthy();
  });
});

describe('faults escalate calmly (03M P7)', () => {
  it('a lost lens turns its chip to Fault with one pulse and a steady Alert; PoE CAM 1 stays up', async () => {
    const h = renderDevicesApp();
    await settle();
    h.sim.actions.inject(FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-02' });
    await settle();
    expect(screen.getByTestId('device-status-CAM-02').props.accessibilityLabel).toBe('Fault');
    expect(screen.getByTestId('device-status-CAM-01').props.accessibilityLabel).toBe('Online');
    const alert = screen.getByTestId('devices-attention');
    expect(within(alert).getByText('1 device needs attention')).toBeTruthy();
    expect(within(alert).getByText(/Camera 2: Fault/)).toBeTruthy();
    expect(within(screen.getByTestId('device-status-POE-SWITCH')).getByText('3 active · 1 spare')).toBeTruthy();

    h.sim.actions.setTabletLink('OFFLINE');
    await settle();
    expect(screen.getByTestId('device-status-TABLET').props.accessibilityLabel).toBe('Offline');
    expect(within(screen.getByTestId('devices-attention')).getByText('2 devices need attention')).toBeTruthy();
    await openDetail(h, 'TABLET');
    expect(screen.getByTestId('device-tablet-offline')).toBeTruthy();
    // M3-12 (D50, re-pinned): nothing records, so the alert says W1 and makes no recording claim.
    expect(within(screen.getByTestId('device-tablet-offline')).getByText('Operator device offline. Nothing is recording on the Core. Reconnect the device to regain control.')).toBeTruthy();
    expect(within(screen.getByTestId('device-tablet-offline')).queryByText(/Recording continues/)).toBeNull();
  });

  it('M3-12 (D50): the tablet-offline alert says "Recording continues on the Core" while a session records', async () => {
    const h = renderDevicesApp({ recording: true });
    await settle();
    h.sim.actions.setTabletLink('OFFLINE');
    await settle();
    await openDetail(h, 'TABLET');
    const alert = screen.getByTestId('device-tablet-offline');
    expect(within(alert).getByText('Recording continues on the Core. Reconnect the device to regain control.')).toBeTruthy();
    expect(within(alert).queryByText(/Nothing is recording/)).toBeNull();
  });

  it('while recording the lamp is lit in the list and the relay detail reads SEDANG MEREKAM', async () => {
    const h = renderDevicesApp({ recording: true });
    await settle();
    expect(screen.getByTestId('device-rec-lamp-lit')).toBeTruthy();
    await openDetail(h, 'REC-INDICATOR');
    expect(within(screen.getByTestId('device-fact-lamp')).getByText('SEDANG MEREKAM')).toBeTruthy();
  });
});

// Audit row 227 (D213; after row 198, D52 / I4): on a Core in its own capture the PoE switch and the Recording Indicator
// read "Not reported", so their model status never raises the attention line. Real tracks (row 191 reader) still do.
describe('row 227 - the attention line on a Core in its own capture', () => {
  const ownCapture = (h: Pick<DevicesHarness, 'sim'>) => act(() => h.sim.store.setState((s) => ownCaptureCoreFactsTransition(s)));
  const indicatorOffline = (h: Pick<DevicesHarness, 'sim'>) =>
    act(() => h.sim.store.setState((s) => ({ otherDevices: s.otherDevices.map((device) => (device.id === 'REC-INDICATOR' ? { ...device, online: false } : device)) })));
  /** Every camera line down: the cameras fault on their tracks, and the PoE switch's model status turns FAULT. */
  const camerasDown = (h: Pick<DevicesHarness, 'sim'>) => act(() => h.sim.store.setState((s) => ({ cameras: s.cameras.map((camera) => ({ ...camera, online: false })) })));

  it('CONTROL (simulated Core): a model fault of the indicator and of the PoE switch raises attention, as before', async () => {
    const h = renderDevicesApp();
    await settle();
    expect(isOwnCaptureCoreState(h.sim.store.getState())).toBe(false);
    indicatorOffline(h);
    await settle();
    expect(within(screen.getByTestId('devices-attention')).getByText('1 device needs attention')).toBeTruthy();
    expect(within(screen.getByTestId('devices-attention')).getByText(/Recording Indicator: Fault/)).toBeTruthy();
    camerasDown(h);
    await settle();
    expect(deviceStatus(h.sim.store.getState(), 'POE-SWITCH')).toBe('FAULT');
    // 4 cameras + the PoE switch + the indicator.
    expect(within(screen.getByTestId('devices-attention')).getByText('6 devices need attention')).toBeTruthy();
  });

  it('own capture: a model fault of the indicator or of the PoE switch raises no attention', async () => {
    const h = renderDevicesApp();
    ownCapture(h);
    await settle();
    expect(isOwnCaptureCoreState(h.sim.store.getState())).toBe(true);
    expect(screen.queryByTestId('devices-attention')).toBeNull();
    indicatorOffline(h);
    await settle();
    expect(deviceStatus(h.sim.store.getState(), 'REC-INDICATOR')).toBe('FAULT');
    expect(screen.queryByTestId('devices-attention')).toBeNull();
    camerasDown(h);
    await settle();
    expect(deviceStatus(h.sim.store.getState(), 'POE-SWITCH')).toBe('FAULT');
    // Only the 4 camera tracks: neither the PoE switch nor the indicator is counted or named.
    const alert = screen.getByTestId('devices-attention');
    expect(within(alert).getByText('4 devices need attention')).toBeTruthy();
    expect(within(alert).queryByText(/PoE|Recording Indicator/)).toBeNull();
  });

  it('own capture: a camera whose source is NOT_REACHABLE still raises attention', async () => {
    const h = renderDevicesApp();
    ownCapture(h);
    await settle();
    expect(screen.queryByTestId('devices-attention')).toBeNull();
    act(() =>
      h.sim.store.setState((s) => {
        const camera1 = s.captureConfig.cameras.find((line) => line.trackId === 'VIDEO-01')!.deviceId;
        return { captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => (device.id === camera1 ? { ...device, reach: 'NOT_REACHABLE' } : device)) } as SimState['captureDevices'] };
      }),
    );
    await settle();
    const alert = screen.getByTestId('devices-attention');
    expect(within(alert).getByText('1 device needs attention')).toBeTruthy();
    expect(within(alert).getByText(/Camera 1: Fault/)).toBeTruthy();
  });
});

describe('tablet (list | detail, §2.4)', () => {
  it('landscape: pane-list and pane-detail; a row fills the detail pane without a push; mic rows carry meters', async () => {
    const h = renderDevicesApp({ window: 'tabletLandscape' });
    await settle();
    expect(screen.getByTestId('pane-list')).toBeTruthy();
    expect(screen.getByTestId('pane-detail')).toBeTruthy();
    expect(screen.getByTestId('device-detail-empty')).toBeTruthy();
    expect(screen.getByTestId('device-row-meter-MIC-01')).toBeTruthy();
    expect(screen.getByTestId('device-row-meter-MIC-02')).toBeTruthy();

    fireEvent.press(screen.getByTestId('device-row-MIC-02'));
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: 'MIC-02' });
    const pane = within(screen.getByTestId('pane-detail'));
    expect(pane.getByTestId('device-detail-pane')).toBeTruthy();
    expect(pane.getByTestId('device-detail-id')).toHaveTextContent('MIC-02');
    expect(screen.queryByTestId('screen-device-detail')).toBeNull();
    expect(screen.getByTestId('device-row-glow-MIC-02', { includeHiddenElements: true })).toBeTruthy();
  });

  it('a deep link to /devices/<id> hands over to the detail pane', async () => {
    const h = renderDevicesApp({ window: 'tabletPortrait' });
    await settle();
    h.navigate('/devices/POE-SWITCH');
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: 'POE-SWITCH' });
    expect(within(screen.getByTestId('pane-detail')).getByTestId('device-detail-id')).toHaveTextContent('POE-SWITCH');
  });

  it('an unknown device id shows the calm not-found state', async () => {
    renderDevicesApp({ window: 'phonePortrait', initialUrl: '/devices/GNSS-9' });
    await settle();
    expect(screen.getByTestId('device-detail-missing')).toBeTruthy();
    expect(screen.getByText('This device is not part of this room.')).toBeTruthy();
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-h-busy-settled.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave H, gate 70 finding G70-04 (tablet and phone): after microphone "Search again" ended, the
// control's accessibility label kept reading "Search again for microphones, busy".
//
// CAUSE (React Native 0.86.3, Android, `BaseViewManager.setViewState`): the view's content description
// - where "busy" is appended to the label - is recomputed ONLY when the new `accessibilityState` holds
// the key `busy` (or `expanded`, or a text `checked`). The shared `busyState()` of `@/runtime` spreads
// NOTHING while idle, so the idle state the button sends is `{ disabled }` alone: the description is
// not recomputed and keeps ", busy". A control that ended a command must therefore SAY `busy: false`.
//
// What jest can show is the prop the native side receives: red before the fix (no `busy` key after the
// search ended), green after (`busy: false`). The native effect itself is a device check (re-gate).
describe('a control whose command ended', () => {
unmountBeforeTheHooksOfThisGroup();
beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

const ACTION = 'capture-selector-mic-rescan-action';
const stateOf = (testID: string) => screen.getByTestId(testID).props.accessibilityState as Record<string, unknown> | undefined;

describe('G70-04: a control whose command ended says so', () => {
  it('the helper always names `busy`, also while idle', () => {
    expect(settledBusyState(false)).toEqual({ accessibilityState: { busy: false, disabled: false } });
    expect(settledBusyState(false, true)).toEqual({ accessibilityState: { busy: false, disabled: true } });
    expect(settledBusyState(true, true)).toEqual({ accessibilityState: { busy: true, disabled: true } });
  });

  it.each(['tabletLandscape', 'phonePortrait'] as const)('%s: microphone "Search again" - after the result is drawn the state holds `busy: false` and the label is the plain one', async (window) => {
    renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    fireEvent.press(screen.getByTestId(ACTION));
    await settle();
    await settle();
    expect(screen.getByTestId('capture-selector-mic-rescan-result')).toBeTruthy();
    expect(stateOf(ACTION)).toEqual({ busy: false, disabled: false });
    expect(screen.getByTestId(ACTION).props.accessibilityLabel).toBe('Search again for microphones');
  });

  it('the camera search control, which stays on screen as well, names `busy` while idle', async () => {
    renderDevicesApp({ user: 'rina.wijaya', window: 'tabletLandscape' });
    await settle();
    expect(stateOf('camera-search-action')).toMatchObject({ busy: false });
  });
});
});
