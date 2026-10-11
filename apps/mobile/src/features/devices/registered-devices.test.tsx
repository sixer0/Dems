// Task 3 R-11, blueprint row 140: the rows and the details of the registered devices beyond the
// built-in ids on the tablet and the phone (ruling D137 (2); ux §8f.2 "Devices rows", §8f.3; D83,
// D128, D131). The REAL devices route files (W84's harness) and the detail body over a real test simulator whose
// `captureDevices` slice holds what a development Core would send.
//
// The Live source is stood in for by its one read member (`useMobileLive()` non-null = Live mode), as
// in `development-source-rule.test.tsx`. NOT proven here: a real Core and a real device (gate flows).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { act, screen } from '@testing-library/react-native';
import { en } from '@dems/shared/i18n';
import type { SimAlert, SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { DeviceDetail } from './device-detail';
import { renderDevicesApp } from './testing/devices-harness';

/** What `useMobileLive()` answers: null = Simulated client mode; an object = Live. */
let mockLive: { session: { demoControls: boolean } } | null = null;
jest.mock('@/runtime', () => {
  const actual = jest.requireActual<typeof import('@/runtime')>('@/runtime');
  return { ...actual, useMobileLive: () => mockLive };
});

beforeEach(() => {
  mockLive = null;
  resetMissingKeys();
});
afterEach(() => expect(getMissingKeys()).toEqual([]));

type Engine = Pick<ReturnType<typeof createTestSim>, 'sim'>;
type Device = SimState['captureDevices']['devices'][number];
const R = en.common.developmentRoster;
const SOURCE = { badge: 'Development source', camera: "Core Mac's camera", microphone: "Core Mac's microphone" };
const device = (id: string, kind: Device['kind'], over: Partial<Device> = {}): Device => ({ id, kind, model: null, firmware: null, host: null, poePort: null, online: true, streamState: kind === 'CAMERA' ? 'LIVE' : null, capabilities: [], ...over }) as Device;
const LOCAL_CAMERA = device('CAM-03', 'CAMERA', { model: 'MacBook Air Camera', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' });
const LOCAL_MIC = device('MIC-03', 'MIC', { model: 'MacBook Air Microphone', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' });
const ADDED = device('CAM-04', 'CAMERA', { model: 'Vendor PTZ-9000', host: '192.168.10.44', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' });
const RATE: SimAlert = { id: 'ALR-9', at: 1, severity: 'INFO', kind: 'SYSTEM', message: 'core text', active: true, acknowledged: false, resolvedAt: null, target: 'MIC-03', params: { reason: 'MIC_RATE_AT_LIMIT', deviceId: 'MIC-03', deviceKind: 'MIC' } };

/** A development Core's device list and selector: camera 1 and the primary microphone are the Core Mac's. */
function development(engine: Engine): void {
  act(() =>
    engine.sim.store.setState((s) => ({
      captureDevices: { ...s.captureDevices, devices: [...s.captureDevices.devices, LOCAL_CAMERA, LOCAL_MIC, ADDED] },
      captureConfig: {
        ...s.captureConfig,
        cameras: s.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, deviceId: 'CAM-03' } : line)),
        mics: [{ ...s.captureConfig.mics[1]! }, { ...s.captureConfig.mics[0]!, inputId: 'MIC-03', deviceId: 'MIC-03' }],
      },
    })),
  );
}
const patchDevice = (engine: Engine, id: string, patch: object): void => {
  act(() => engine.sim.store.setState((s) => ({ captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((entry) => (entry.id === id ? ({ ...entry, ...patch } as Device) : entry)) } })));
};

describe('Devices & Inputs lists the devices of the Core\'s list beyond the built-in ids', () => {
  it('a Core that lists none: 0 registered rows (the screen is as before)', async () => {
    renderDevicesApp();
    await flushAsync();
    expect(screen.getByTestId('devices-section-cameras')).toBeTruthy();
    expect(screen.queryByTestId('registered-device-row-CAM-03')).toBeNull();
    expect(screen.queryByTestId('registered-device-row-MIC-03')).toBeNull();
  });

  it('Simulated client mode (D83): the rows are there by the id rule, with what each is used as - and NO badge, NO "is on"', async () => {
    const engine = renderDevicesApp();
    await flushAsync();
    development(engine);
    await flushAsync();
    expect(screen.getByTestId('registered-device-name-CAM-03')).toHaveTextContent('Camera CAM-03');
    expect(screen.getByTestId('registered-device-name-MIC-03')).toHaveTextContent('MIC 3');
    expect(screen.getByTestId('registered-device-used-CAM-03')).toHaveTextContent(`${R.usedAs['VIDEO-01']} · CAM-03`);
    expect(screen.getByTestId('registered-device-used-MIC-03')).toHaveTextContent(`${R.usedAs.PRIMARY} · MIC-03`);
    expect(screen.getByTestId('registered-device-used-CAM-04')).toHaveTextContent(`${R.usedAs.NONE} · CAM-04`);
    for (const id of ['CAM-03', 'MIC-03', 'CAM-04']) expect(screen.queryByTestId(`registered-device-source-${id}`)).toBeNull();
    patchDevice(engine, 'MIC-03', { sourceOpen: true });
    await flushAsync();
    expect(screen.queryByTestId('registered-device-on-MIC-03')).toBeNull();
  });

  it('Live: the Core Mac\'s camera and microphone carry the ONE badge and the D83 names; the added production camera carries none; "is on" only when the Core says `sourceOpen`', async () => {
    mockLive = { session: { demoControls: false } };
    const engine = renderDevicesApp();
    await flushAsync();
    development(engine);
    await flushAsync();
    expect(screen.getByTestId('registered-device-name-CAM-03')).toHaveTextContent(SOURCE.camera);
    expect(screen.getByTestId('registered-device-name-MIC-03')).toHaveTextContent(SOURCE.microphone);
    expect(screen.getByTestId('registered-device-source-CAM-03-chip')).toHaveTextContent(SOURCE.badge);
    expect(screen.getByTestId('registered-device-source-MIC-03-kind')).toHaveTextContent(SOURCE.microphone);
    expect(screen.getByTestId('registered-device-name-CAM-04')).toHaveTextContent('Camera CAM-04');
    expect(screen.queryByTestId('registered-device-source-CAM-04')).toBeNull();
    // Fix wave L (controller ruling on G70c-02): a source at rest of which the Core states no checked fact reads "Not checked" - never "Reachable" / "Ready".
    expect(screen.getByTestId('registered-device-state-CAM-03')).toHaveTextContent('Not checked');
    // The shared slice carries no `sourceOpen` yet: nothing is drawn. Then the Core says the microphone is open.
    expect(screen.queryByTestId('registered-device-on-MIC-03')).toBeNull();
    patchDevice(engine, 'MIC-03', { sourceOpen: true });
    await flushAsync();
    expect(screen.getByTestId('registered-device-on-MIC-03')).toHaveTextContent(en.common.sourceClass.microphoneOn.mobile);
    expect(screen.queryByTestId('registered-device-on-CAM-03')).toBeNull();
  });

  it('Live: MIC_RATE_AT_LIMIT is a NAMED warning on the microphone row while the Core\'s alert is active, and gone when it resolves', async () => {
    mockLive = { session: { demoControls: false } };
    const engine = renderDevicesApp();
    await flushAsync();
    development(engine);
    await flushAsync();
    expect(screen.queryByTestId('registered-device-rate-MIC-03')).toBeNull();
    act(() => engine.sim.store.setState((s) => ({ alerts: [...s.alerts, RATE] })));
    await flushAsync();
    expect(screen.getByTestId('registered-device-rate-MIC-03')).toHaveTextContent(R.rateAtLimit.title);
    expect(screen.queryByTestId('registered-device-rate-CAM-03')).toBeNull();
    act(() => engine.sim.store.setState((s) => ({ alerts: s.alerts.map((entry) => (entry.id === 'ALR-9' ? { ...entry, active: false, resolvedAt: 2 } : entry)) })));
    await flushAsync();
    expect(screen.queryByTestId('registered-device-rate-MIC-03')).toBeNull();
  });
});

describe('"View device" of a registered device (the detail pane / screen)', () => {
  it('Live, the Core Mac\'s microphone: its name, badge, facts from the Core\'s list, the stated limit and the named warning; no address, no input', async () => {
    mockLive = { session: { demoControls: false } };
    const engine = createTestSim();
    development(engine);
    act(() => engine.sim.store.setState((s) => ({ alerts: [...s.alerts, RATE] })));
    renderWithRuntime(<DeviceDetail deviceId="MIC-03" variant="pane" />, { sim: engine.sim });
    await flushAsync();
    expect(screen.getByTestId('registered-device-detail')).toBeTruthy();
    expect(screen.queryByTestId('device-detail-missing')).toBeNull();
    expect(screen.getAllByText(SOURCE.microphone).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('registered-detail-source-chip')).toHaveTextContent(SOURCE.badge);
    expect(screen.getByTestId('registered-detail-state')).toHaveTextContent('Not checked');
    expect(screen.getByTestId('registered-detail-rate')).toHaveTextContent(R.rateAtLimit.title, { exact: false });
    expect(screen.getByTestId('registered-detail-limits')).toHaveTextContent(R.limits.localMicrophone, { exact: false });
    expect(screen.getByText(R.source.LOCAL_DEVICE)).toBeTruthy();
    expect(screen.getByText(R.usedAs.PRIMARY)).toBeTruthy();
    expect(screen.queryByText(R.field.address)).toBeNull();
    expect(screen.UNSAFE_queryAllByProps({ secureTextEntry: true })).toHaveLength(0);
  });

  it('Live, a local camera macOS has not allowed: "Permission needed" with the sentence for the Core Mac; the same name and badge', async () => {
    mockLive = { session: { demoControls: false } };
    const engine = createTestSim();
    development(engine);
    patchDevice(engine, 'CAM-03', { online: false });
    act(() =>
      engine.sim.store.setState((s) => ({
        alerts: [...s.alerts, { ...RATE, id: 'ALR-1', severity: 'WARNING', target: 'CAM-03', params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-03', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'PERMISSION_DENIED' } }],
      })),
    );
    renderWithRuntime(<DeviceDetail deviceId="CAM-03" variant="pane" />, { sim: engine.sim });
    await flushAsync();
    expect(screen.getByTestId('registered-detail-state')).toHaveTextContent('Permission needed');
    expect(screen.getByTestId('registered-detail-sentence')).toHaveTextContent(/macOS has not allowed camera access for the Core/);
    expect(screen.getByTestId('registered-detail-source-kind')).toHaveTextContent(SOURCE.camera);
    expect(screen.getByTestId('registered-detail-limits')).toHaveTextContent(R.limits.localCamera, { exact: false });
  });

  it('an added production camera: no badge, no limit, its address as the Core sent it; an id the Core does not list is still "not part of this room"', async () => {
    mockLive = { session: { demoControls: false } };
    const engine = createTestSim();
    development(engine);
    const view = renderWithRuntime(<DeviceDetail deviceId="CAM-04" variant="pane" />, { sim: engine.sim });
    await flushAsync();
    expect(screen.getByTestId('registered-device-detail')).toBeTruthy();
    expect(screen.queryByTestId('registered-detail-source')).toBeNull();
    expect(screen.queryByTestId('registered-detail-limits')).toBeNull();
    expect(screen.getByText('192.168.10.44')).toBeTruthy();
    view.unmount();
    renderWithRuntime(<DeviceDetail deviceId="CAM-09" variant="pane" />, { sim: engine.sim });
    await flushAsync();
    expect(screen.getByTestId('device-detail-missing')).toBeTruthy();
  });
});
