/**
 * Devices & Inputs (04_mobile_specs §4.12, MB 7; step 84): the MB 7 list on a phone, the pushed
 * device detail (Overview / Health / Log, diagnostics sheet, test signal, Technician-only restart,
 * clip reset), calm fault escalation (03M P7) and the tablet list | detail split (§2.4).
 * Real route files, real simulator, real providers; real timers (Reanimated in Jest, S72-12).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { fireEvent, screen, within } from '@testing-library/react-native';
import { FaultKind } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderDevicesApp, settle, type DevicesHarness } from './testing/devices-harness';

jest.setTimeout(20_000);

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

    // V2: both cameras (canonical 2, 04 §9 #7) with the room and an Online chip.
    expect(within(sections[0]!).getByText('Camera 1')).toBeTruthy();
    expect(within(sections[0]!).getByText('Camera 2')).toBeTruthy();
    expect(within(sections[0]!).getAllByText('Interview Room 1')).toHaveLength(2);
    expect(screen.getByTestId('device-status-CAM-01').props.accessibilityLabel).toBe('Online');
    // V3: canonical mic labels (04 §9 #8) and channels.
    expect(within(sections[1]!).getByText('MIC 1 – Interviewer')).toBeTruthy();
    expect(within(sections[1]!).getByText('MIC 2 – Subject')).toBeTruthy();
    expect(within(sections[1]!).getByText('Channel 1')).toBeTruthy();
    expect(within(sections[1]!).getByText('Channel 2')).toBeTruthy();
    expect(screen.getByTestId('device-status-MIC-02').props.accessibilityLabel).toBe('Online');
    // V4: PoE in the design book's 2-port view (D79), lamp relay Active, tablet Connected.
    expect(within(screen.getByTestId('device-status-POE-SWITCH')).getByText('1 active · 1 spare')).toBeTruthy();
    expect(screen.getByTestId('device-status-REC-INDICATOR').props.accessibilityLabel).toBe('Active');
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
    expect(within(screen.getByTestId('device-fact-ports')).getByText('1 active · 1 spare')).toBeTruthy();
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
    expect(within(screen.getByTestId('device-status-POE-SWITCH')).getByText('1 active · 1 spare')).toBeTruthy();

    h.sim.actions.setTabletLink('OFFLINE');
    await settle();
    expect(screen.getByTestId('device-status-TABLET').props.accessibilityLabel).toBe('Offline');
    expect(within(screen.getByTestId('devices-attention')).getByText('2 devices need attention')).toBeTruthy();
    await openDetail(h, 'TABLET');
    expect(screen.getByTestId('device-tablet-offline')).toBeTruthy();
    expect(screen.getByText('Recording continues on the Core. Reconnect the tablet to regain control.')).toBeTruthy();
  });

  it('while recording the lamp is lit in the list and the relay detail reads SEDANG MEREKAM', async () => {
    const h = renderDevicesApp({ recording: true });
    await settle();
    expect(screen.getByTestId('device-rec-lamp-lit')).toBeTruthy();
    await openDetail(h, 'REC-INDICATOR');
    expect(within(screen.getByTestId('device-fact-lamp')).getByText('SEDANG MEREKAM')).toBeTruthy();
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
