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
const LOCAL_CAMERA = device('CAM-05', 'CAMERA', { model: 'MacBook Air Camera', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' }); // D60/D61 (2026-11-04): CAM-03/04 and MIC-03/04 are built-ins; adopted devices mint past them
const LOCAL_MIC = device('MIC-05', 'MIC', { model: 'MacBook Air Microphone', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' }); // D61
const ADDED = device('CAM-06', 'CAMERA', { model: 'Vendor PTZ-9000', host: '192.168.10.44', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' });
const RATE: SimAlert = { id: 'ALR-9', at: 1, severity: 'INFO', kind: 'SYSTEM', message: 'core text', active: true, acknowledged: false, resolvedAt: null, target: 'MIC-05', params: { reason: 'MIC_RATE_AT_LIMIT', deviceId: 'MIC-05', deviceKind: 'MIC' } };

/** A development Core's device list and selector: camera 1 and the transcribed channel are the Core Mac's (D61). */
function development(engine: Engine): void {
  act(() =>
    engine.sim.store.setState((s) => ({
      captureDevices: { ...s.captureDevices, devices: [...s.captureDevices.devices, LOCAL_CAMERA, LOCAL_MIC, ADDED] },
      captureConfig: {
        ...s.captureConfig,
        cameras: s.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, deviceId: 'CAM-05' } : line)),
        mics: [{ ...s.captureConfig.mics[1]! }, { ...s.captureConfig.mics[0]!, inputId: 'MIC-05', deviceId: 'MIC-05' }], // D61 (2026-11-04): the channel-1 line carries the Mac's microphone (the slice states CHANNELS; the swapped order must not move the duty)
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
    expect(screen.queryByTestId('registered-device-row-CAM-05')).toBeNull();
    expect(screen.queryByTestId('registered-device-row-MIC-05')).toBeNull();
  });

  // Audit row 190 (M3-08 R1, D92; the web's row 131): the bench Core's real CAM-03/CAM-04 (VIDEO-01/02) and MIC-03/MIC-04
  // (channels 1/2) carry built-in ids. Only a built-in id on its OWN line is a fixed row's; these are registered rows, once each.
  it('row 190: a real device with a built-in id on another line is listed once; a built-in on its own line is not', async () => {
    const engine = renderDevicesApp();
    await flushAsync();
    act(() =>
      engine.sim.store.setState((s) => ({
        captureConfig: {
          ...s.captureConfig,
          cameras: s.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, deviceId: 'CAM-03' } : line.trackId === 'VIDEO-03' ? { ...line, deviceId: 'CAM-01' } : line)),
        },
      })),
    );
    await flushAsync();
    expect(screen.getAllByTestId('registered-device-row-CAM-03')).toHaveLength(1);
    expect(screen.getAllByTestId('registered-device-row-CAM-01')).toHaveLength(1);
    expect(screen.queryByTestId('registered-device-row-CAM-02')).toBeNull();
    expect(screen.queryByTestId('registered-device-row-MIC-01')).toBeNull();
  });

  it('Simulated client mode (D83): the rows are there by the id rule, with what each is used as - and NO badge, NO "is on"', async () => {
    const engine = renderDevicesApp();
    await flushAsync();
    development(engine);
    await flushAsync();
    expect(screen.getByTestId('registered-device-name-CAM-05')).toHaveTextContent('Camera CAM-05');
    expect(screen.getByTestId('registered-device-name-MIC-05')).toHaveTextContent('MIC 5');
    expect(screen.getByTestId('registered-device-used-CAM-05')).toHaveTextContent(`${R.usedAs['VIDEO-01']} · CAM-05`);
    expect(screen.getByTestId('registered-device-used-MIC-05')).toHaveTextContent(`${R.usedAs['MIC-01']} · MIC-05`);
    expect(screen.getByTestId('registered-device-used-CAM-06')).toHaveTextContent(`${R.usedAs.NONE} · CAM-06`);
    for (const id of ['CAM-05', 'MIC-05', 'CAM-06']) expect(screen.queryByTestId(`registered-device-source-${id}`)).toBeNull();
    patchDevice(engine, 'MIC-05', { sourceOpen: true });
    await flushAsync();
    expect(screen.queryByTestId('registered-device-on-MIC-05')).toBeNull();
  });

  it('Live: the Core Mac\'s camera and microphone carry the ONE badge and the D83 names; the added production camera carries none; "is on" only when the Core says `sourceOpen`', async () => {
    mockLive = { session: { demoControls: false } };
    const engine = renderDevicesApp();
    await flushAsync();
    development(engine);
    await flushAsync();
    expect(screen.getByTestId('registered-device-name-CAM-05')).toHaveTextContent(SOURCE.camera);
    expect(screen.getByTestId('registered-device-name-MIC-05')).toHaveTextContent(SOURCE.microphone);
    expect(screen.getByTestId('registered-device-source-CAM-05-chip')).toHaveTextContent(SOURCE.badge);
    expect(screen.getByTestId('registered-device-source-MIC-05-kind')).toHaveTextContent(SOURCE.microphone);
    expect(screen.getByTestId('registered-device-name-CAM-06')).toHaveTextContent('Camera CAM-06');
    expect(screen.queryByTestId('registered-device-source-CAM-06')).toBeNull();
    // Fix wave L (controller ruling on G70c-02): a source at rest of which the Core states no checked fact reads "Not checked" - never "Reachable" / "Ready".
    expect(screen.getByTestId('registered-device-state-CAM-05')).toHaveTextContent('Not checked');
    // The shared slice carries no `sourceOpen` yet: nothing is drawn. Then the Core says the microphone is open.
    expect(screen.queryByTestId('registered-device-on-MIC-05')).toBeNull();
    patchDevice(engine, 'MIC-05', { sourceOpen: true });
    await flushAsync();
    expect(screen.getByTestId('registered-device-on-MIC-05')).toHaveTextContent(en.common.sourceClass.microphoneOn.mobile);
    expect(screen.queryByTestId('registered-device-on-CAM-05')).toBeNull();
  });

  it('Live: MIC_RATE_AT_LIMIT is a NAMED warning on the microphone row while the Core\'s alert is active, and gone when it resolves', async () => {
    mockLive = { session: { demoControls: false } };
    const engine = renderDevicesApp();
    await flushAsync();
    development(engine);
    await flushAsync();
    expect(screen.queryByTestId('registered-device-rate-MIC-05')).toBeNull();
    act(() => engine.sim.store.setState((s) => ({ alerts: [...s.alerts, RATE] })));
    await flushAsync();
    expect(screen.getByTestId('registered-device-rate-MIC-05')).toHaveTextContent(R.rateAtLimit.title);
    expect(screen.queryByTestId('registered-device-rate-CAM-05')).toBeNull();
    act(() => engine.sim.store.setState((s) => ({ alerts: s.alerts.map((entry) => (entry.id === 'ALR-9' ? { ...entry, active: false, resolvedAt: 2 } : entry)) })));
    await flushAsync();
    expect(screen.queryByTestId('registered-device-rate-MIC-05')).toBeNull();
  });

  // Audit row 191 (B16, D114 via D173; the web's `rosterCardStatus` of W2c2): a registered device ON a line speaks for its
  // TRACK too - the fixed row's status over the one source reader (row 129's rule) - and its detail says the same.
  it('row 191 (B16): a registered camera on a line shows its track\'s FAULT; on no fault the registry word stands; the detail agrees', async () => {
    mockLive = { session: { demoControls: false } };
    const engine = renderDevicesApp();
    await flushAsync();
    development(engine);
    act(() =>
      engine.sim.store.setState((s) => ({
        captureConfig: { ...s.captureConfig, cameras: s.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-02' ? { ...line, deviceId: 'CAM-06' } : line)) },
      })),
    );
    patchDevice(engine, 'CAM-06', { checkedAt: 1, reach: 'REACHABLE' });
    await flushAsync();
    expect(screen.getByTestId('registered-device-used-CAM-06')).toHaveTextContent(`${R.usedAs['VIDEO-02']} · CAM-06`);
    expect(screen.getByTestId('registered-device-state-CAM-06')).toHaveTextContent(R.reachable);
    act(() => engine.sim.store.setState((s) => ({ cameras: s.cameras.map((camera) => (camera.id === 'VIDEO-02' ? { ...camera, lens: 'FAULT' as const } : camera)) })));
    await flushAsync();
    expect(screen.getByTestId('registered-device-state-CAM-06')).toHaveTextContent(en.common.status.fault);
    // CONTROL: the registered camera on VIDEO-01 is untouched by VIDEO-02's fault; a negative registry fact is never replaced.
    expect(screen.getByTestId('registered-device-state-CAM-05')).toHaveTextContent('Not checked');
    patchDevice(engine, 'CAM-06', { reach: 'NOT_REACHABLE' });
    await flushAsync();
    expect(screen.getByTestId('registered-device-state-CAM-06')).toHaveTextContent(R.notReachable);
    engine.app.unmount();
    patchDevice(engine, 'CAM-06', { reach: 'REACHABLE' });
    renderWithRuntime(<DeviceDetail deviceId="CAM-06" variant="pane" />, { sim: engine.sim });
    await flushAsync();
    expect(screen.getByTestId('registered-detail-state')).toHaveTextContent(en.common.status.fault);
  });
});

describe('"View device" of a registered device (the detail pane / screen)', () => {
  it('Live, the Core Mac\'s microphone: its name, badge, facts from the Core\'s list, the stated limit and the named warning; no address, no input', async () => {
    mockLive = { session: { demoControls: false } };
    const engine = createTestSim();
    development(engine);
    act(() => engine.sim.store.setState((s) => ({ alerts: [...s.alerts, RATE] })));
    renderWithRuntime(<DeviceDetail deviceId="MIC-05" variant="pane" />, { sim: engine.sim });
    await flushAsync();
    expect(screen.getByTestId('registered-device-detail')).toBeTruthy();
    expect(screen.queryByTestId('device-detail-missing')).toBeNull();
    expect(screen.getAllByText(SOURCE.microphone).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('registered-detail-source-chip')).toHaveTextContent(SOURCE.badge);
    expect(screen.getByTestId('registered-detail-state')).toHaveTextContent('Not checked');
    expect(screen.getByTestId('registered-detail-rate')).toHaveTextContent(R.rateAtLimit.title, { exact: false });
    expect(screen.getByTestId('registered-detail-limits')).toHaveTextContent(R.limits.localMicrophone, { exact: false });
    expect(screen.getByText(R.source.LOCAL_DEVICE)).toBeTruthy();
    expect(screen.getByText(R.usedAs['MIC-01'])).toBeTruthy();
    expect(screen.queryByText(R.field.address)).toBeNull();
    expect(screen.UNSAFE_queryAllByProps({ secureTextEntry: true })).toHaveLength(0);
  });

  it('Live, a local camera macOS has not allowed: "Permission needed" with the sentence for the Core Mac; the same name and badge', async () => {
    mockLive = { session: { demoControls: false } };
    const engine = createTestSim();
    development(engine);
    patchDevice(engine, 'CAM-05', { online: false });
    act(() =>
      engine.sim.store.setState((s) => ({
        alerts: [...s.alerts, { ...RATE, id: 'ALR-1', severity: 'WARNING', target: 'CAM-05', params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-05', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'PERMISSION_DENIED' } }],
      })),
    );
    renderWithRuntime(<DeviceDetail deviceId="CAM-05" variant="pane" />, { sim: engine.sim });
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
    const view = renderWithRuntime(<DeviceDetail deviceId="CAM-06" variant="pane" />, { sim: engine.sim });
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

  // Task 4 row W6 (request lines 566, 569; decisions C141, C143): an idle registered camera's entry states `streamState: null`
  // (nobody reads its stream). The detail says "Not read" - before this row the fact was left out, and it is never Live or Lost.
  // Seen RED on the mutation "the null fact is left out again" (`device.streamState === null ? []`).
  it('row W6: an added production camera whose stream nobody reads states "Not read"; a microphone states no stream fact', async () => {
    mockLive = { session: { demoControls: false } };
    const engine = createTestSim();
    development(engine);
    patchDevice(engine, 'CAM-06', { streamState: null });
    const view = renderWithRuntime(<DeviceDetail deviceId="CAM-06" variant="pane" />, { sim: engine.sim });
    await flushAsync();
    expect(screen.getByTestId('registered-device-detail')).toHaveTextContent('Not read', { exact: false });
    expect(screen.queryByText('LIVE')).toBeNull();
    expect(screen.queryByText('Live')).toBeNull();
    view.unmount();
    renderWithRuntime(<DeviceDetail deviceId="MIC-05" variant="pane" />, { sim: engine.sim });
    await flushAsync();
    expect(screen.getByTestId('registered-device-detail')).not.toHaveTextContent('Not read', { exact: false });
  });
});
