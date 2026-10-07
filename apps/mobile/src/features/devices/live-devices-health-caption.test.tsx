// Row M1 follow-up (decision D160 ruling 4; RESIDUAL-W78-2 (W83 ledger #57)): the Core serves no per-device health
// history, so in LIVE mode the health line of every device is computed on this device from the Core's
// data (cameras, tablet and PoE switch from its network data, the lamp from its session state, the
// microphones from 1 s peaks of its meter frames). The caption under the line says so (§3.2: say what
// is true); Simulated mode keeps "Simulated · last N samples".
//
//  1. The chart itself, for every metric, in both modes.
//  2. The real LIVE screen (W78's bed: the app's Live source over the contract-checked fake transport)
//     for every kind of device, with nothing on it claiming a simulation; the Simulated screen as before.
//
// Import order: the test setup, then the router harness, then the beds (see their headers).
import './testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { en } from '@dems/shared/i18n';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { HealthChart } from './health-chart';
import { HEALTH_METRIC, type HealthMetric, type HealthSeries } from './sim-adapter';
import { renderDevicesApp, settle } from './testing/devices-harness';
import { renderLiveDevices, resetLiveDevicesBed, type LiveDevicesBed } from './testing/live-devices-bed';

jest.setTimeout(30_000);

let bed: LiveDevicesBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveDevicesBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  expect(getMissingKeys()).toEqual([]);
});

const LIVE_CAPTION = /^Derived from the Core's data · last (\d+) samples$/;
const SIMULATED_CAPTION = /^Simulated · last (\d+) samples$/;
const caption = (): string => {
  const node = screen.getByTestId('device-health-samples');
  const children = node.props.children as unknown;
  return Array.isArray(children) ? children.join('') : String(children);
};

const METRICS: readonly HealthMetric[] = ['linkQuality', 'signal', 'poeDraw', 'relay'];
const seriesOf = (metric: HealthMetric, count: number): HealthSeries => ({
  metric,
  domain: metric === 'signal' ? [-90, 0] : metric === 'relay' ? [0, 1] : [0, 100],
  points: Array.from({ length: count }, (_, index) => ({ t: 1_000 * index, v: metric === 'signal' ? -20 : 1 })),
});

describe('the LIVE texts', () => {
  // Closing copy round (decision D186): one shared sentence for both clients, `devices.live.samples`.
  it('say the line is derived from the Core\'s data, and nothing about a simulation', () => {
    expect(en.devices.live.samples_other).toBe("Derived from the Core's data · last {{count}} samples");
    expect(en.devices.live.samples_one).toBe("Derived from the Core's data · {{count}} sample");
    for (const text of [en.devices.live.samples_one, en.devices.live.samples_other]) expect(/simulat|demo\b|mock/i.test(text)).toBe(false);
  });
});

describe('the chart caption, for every metric (D160)', () => {
  it('LIVE: "Derived from the Core\'s data · last N samples"', () => {
    for (const metric of METRICS) {
      const view = render(<HealthChart series={seriesOf(metric, 7)} testID="device-health" live />);
      expect([metric, caption()]).toEqual([metric, "Derived from the Core's data · last 7 samples"]);
      view.unmount();
    }
    const one = render(<HealthChart series={seriesOf('linkQuality', 1)} testID="device-health" live />);
    // One point draws no line yet: the shared "Collecting samples…" stays in both modes.
    expect(caption()).toBe('Collecting samples…');
    one.unmount();
  });

  it('SIMULATED: "Simulated · last N samples", as before', () => {
    for (const metric of METRICS) {
      const view = render(<HealthChart series={seriesOf(metric, 7)} testID="device-health" />);
      expect([metric, caption()]).toEqual([metric, 'Simulated · last 7 samples']);
      view.unmount();
    }
  });
});

describe('the LIVE screen of every kind of device (W78\'s bed)', () => {
  const DEVICES = ['CAM-01', 'TABLET', 'POE-SWITCH', 'REC-INDICATOR', 'MIC-01'] as const;

  it('every Health tab says the line is derived (the microphone, without meter frames in the bed, is still collecting); nothing claims a simulation', async () => {
    expect([...new Set(DEVICES.map((id) => HEALTH_METRIC[id]))].sort()).toEqual([...METRICS].sort());
    const b = await renderLiveDevices();
    bed = b;
    await b.runCore(6_000);
    for (const deviceId of DEVICES) {
      await b.open(`/devices/${deviceId}`);
      fireEvent.press(screen.getByTestId('device-tab-health'));
      await b.flush();
      const text = caption();
      if (deviceId === 'MIC-01') expect([deviceId, LIVE_CAPTION.test(text) || text === 'Collecting samples…']).toEqual([deviceId, true]);
      else expect([deviceId, LIVE_CAPTION.test(text)]).toEqual([deviceId, true]);
      expect([deviceId, screen.queryAllByText(/simulat/i).length]).toEqual([deviceId, 0]);
      fireEvent.press(screen.getByTestId('device-detail-back'));
      await b.flush();
    }
  });
});

describe('the SIMULATED screen', () => {
  it('the Health tab of a camera keeps "Simulated · last N samples"', async () => {
    const h = renderDevicesApp();
    await settle();
    fireEvent.press(screen.getByTestId('device-row-CAM-01'));
    await settle();
    h.run(6_000);
    fireEvent.press(screen.getByTestId('device-tab-health'));
    await settle();
    expect(SIMULATED_CAPTION.test(caption())).toBe(true);
  });
});
