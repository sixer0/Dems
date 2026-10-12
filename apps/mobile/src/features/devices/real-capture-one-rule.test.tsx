// Fix wave L, closing pass L-Z, item 3 - the mobile leftovers of THE ONE RULE (decision 5 of
// implementation/155): on a Core in its own capture a screen states the Core's own fact, "Not reported",
// or nothing; a block that still shows values of the simulator's model carries the "Synthetic demo
// values" chip. The SIMULATED lane is unchanged and pinned by the controls of this file.
//
// | What stood there on a real-capture Core | Rule | Held |
// |---|---|---|
// | the microphone lines of the selector read "USB" for a generated tone | `statedTransportOf`: no transport word for `adapter: FAKE` | "the selector's microphone lines" |
// | camera detail: "Dual-lens IP camera DL-2", firmware, "PoE CAM 1", "1080p ... H.265", Mbps | `detailFactsOf` = GENERATED: named "Generated test source"; the format is the selector line's profile or "Not reported"; no model value | "camera detail" |
// | microphone detail: "Channel 1", "32 dB", "48 V ON", the converter, "read-only in this demo" | GENERATED: the same; the CLIP latch and the recording state stay | "microphone detail" |
// | a source of another adapter, the PoE switch, the indicator, the tablet row, the derived health series | MODEL_VALUES: drawn under the chip | "blocks that keep model values" |
// | Devices list: the room / "Channel n" under a generated source; the "Other devices" section | "Generated test source"; the chip on the section | "the list" |
// | a registered generated camera's "Model" row ("FAKE-CAM-1") | not drawn | "the list" |
//
// The REAL devices route files over a real test simulator whose `captureDevices` slice holds what a Core
// in real capture sends; Live mode is stood in for by its read member (as `camera-no-preview.test.tsx`).
// Both layouts. NOT proven here: a device and a real Core (re-check).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AUDIO_FRAME_NOT_MEASURED_EXAMPLE, DIAGNOSTIC_NOT_REPORTED_EXAMPLE } from '@dems/shared/api';
import { en } from '@dems/shared/i18n';
import { isLevelNotMeasured, type SimState } from '@dems/shared/sim';
import { micRows, statedTransportOf } from '@/features/capture-selector/capture-selector-model';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { deviceMicLevelKind } from './device-mic-meter';
import { detailFactsOf, relayWords } from './devices-model';
import { PLATFORM_CHECK_IDS, diagnosticNotReported, summaryOf } from './diagnostics-sheet';
import { registeredStateTone } from './registered-device-rows';
import { renderDevicesApp, settle, type DevicesHarness } from './testing/devices-harness';

/** What `useMobileLive()` answers: null = Simulated client mode; an object = Live. */
let mockLive: { client: { call: () => Promise<unknown> } } | null = null;
jest.mock('@/runtime', () => {
  const actual = jest.requireActual<typeof import('@/runtime')>('@/runtime');
  return { ...actual, useMobileLive: () => mockLive };
});

beforeEach(() => {
  mockLive = null;
  resetMissingKeys();
});
afterEach(() => expect(getMissingKeys()).toEqual([]));

type Device = SimState['captureDevices']['devices'][number];
type Mark = Partial<Pick<Device, 'sourceClass' | 'adapter'>>;
const FAKE: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' };
const PRODUCTION: Mark = { sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP' };
const ALL_FAKE = { 'CAM-01': FAKE, 'CAM-02': FAKE, 'MIC-01': FAKE, 'MIC-02': FAKE } as const;
const WINDOWS = ['tabletLandscape', 'phonePortrait'] as const;
const CHIP = 'Synthetic demo values';
/** Words of the simulator's model that a generated source must not be described with. */
const MODEL_WORDS = /Dual-lens|DL-2|UM-1|3\.8\.14|PoE CAM 1|1080p|H\.265|Mbps|32 dB|48 V|Channel \d|read-only in this demo|USB/;

function mark(h: Pick<DevicesHarness, 'sim'>, marks: Readonly<Record<string, Mark>>): void {
  act(() => h.sim.store.setState((s) => ({ captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => ({ ...device, ...(marks[device.id] ?? {}) })) } })));
}
/** The selector lines state the profile a Core in real capture gives its generated cameras. */
function profile(h: Pick<DevicesHarness, 'sim'>, code: string): void {
  act(() => h.sim.store.setState((s) => ({ captureConfig: { ...s.captureConfig, cameras: s.captureConfig.cameras.map((line) => ({ ...line, profile: code })) } as SimState['captureConfig'] })));
}
const live = () => {
  mockLive = { client: { call: async () => ({ ok: false, status: 503, error: { code: 'NOT_READY' } }) } };
};
/** Every string drawn inside a node, and the labels a screen reader gets (never the fibre itself). */
type Drawn = { readonly children: readonly (Drawn | string)[]; readonly props: Readonly<Record<string, unknown>> };
function drawn(node: Drawn | string): string {
  if (typeof node === 'string') return node;
  const label = typeof node.props.accessibilityLabel === 'string' ? `${node.props.accessibilityLabel} ` : '';
  return `${label}${node.children.map(drawn).join(' ')}`;
}
const text = (testID: string): string => drawn(screen.getByTestId(testID) as unknown as Drawn);
const chips = (): number => screen.queryAllByTestId(/^synthetic-values-/).length;

describe('the two rules (pure)', () => {
  it('`detailFactsOf`: SIMULATED off a real-capture Core; GENERATED for `adapter: FAKE`; MODEL_VALUES for everything else on such a Core', () => {
    expect(detailFactsOf(false, 'FAKE')).toBe('SIMULATED');
    expect(detailFactsOf(false, null)).toBe('SIMULATED');
    expect(detailFactsOf(true, 'FAKE')).toBe('GENERATED');
    for (const adapter of ['ONVIF_RTSP', 'LOCAL_DEVICE', 'USB_AUDIO', null, undefined]) expect(detailFactsOf(true, adapter)).toBe('MODEL_VALUES');
  });

  it('`statedTransportOf`: no transport word for a generated source; every other line keeps what the selector states', () => {
    expect(statedTransportOf('USB', 'FAKE')).toBeNull();
    expect(statedTransportOf('USB', 'USB_AUDIO')).toBe('USB');
    expect(statedTransportOf('USB', 'LOCAL_DEVICE')).toBe('USB');
    // A Core in simulated capture and Simulated mode name no adapter: unchanged.
    expect(statedTransportOf('USB', null)).toBe('USB');
    expect(statedTransportOf('USB', undefined)).toBe('USB');
    expect(statedTransportOf('', null)).toBeNull();
  });

  it('`micRows`: the row of a generated microphone carries no transport and no model; the control row keeps both', () => {
    const h = renderDevicesApp();
    const base = h.sim.store.getState();
    h.app.unmount();
    const registry = (marks: Readonly<Record<string, Mark>>) => ({ ...base.captureDevices, devices: base.captureDevices.devices.map((device) => ({ ...device, ...(marks[device.id] ?? {}) })) });
    const generated = micRows(base.captureConfig, registry(ALL_FAKE));
    expect(generated.map((row) => [row.inputId, row.model, row.transport])).toEqual([
      ['MIC-01', null, null],
      ['MIC-02', null, null],
    ]);
    const simulated = micRows(base.captureConfig, registry({}));
    expect(simulated.map((row) => row.transport)).toEqual(['USB', 'USB']);
    expect(simulated.every((row) => typeof row.model === 'string' && row.model !== '')).toBe(true);
  });
});

describe.each(WINDOWS)('a Core in real capture on %s', (window) => {
  it('the selector\'s microphone lines: no "USB", no model for a generated source', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    mark(h, ALL_FAKE);
    await settle();
    for (const input of ['MIC-01', 'MIC-02']) {
      const row = text(`capture-selector-row-${input}`);
      expect(row).not.toMatch(/USB|UM-1|condenser/);
      // Nothing is left to say under the input's name: the detail line is not drawn empty.
      expect(screen.queryByTestId(`capture-selector-detail-${input}`)?.props.children ?? '').toBe('');
    }
  });

  it('camera detail of a generated source: "Generated test source", the selector line\'s profile, no model value and no chip', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/CAM-02' });
    mark(h, ALL_FAKE);
    profile(h, 'H264_720P30');
    await settle();
    const overview = screen.getByTestId('device-overview');
    expect(within(screen.getByTestId('device-fact-source')).getByText('Generated test source')).toBeTruthy();
    expect(within(screen.getByTestId('device-fact-format')).getByText('H264_720P30')).toBeTruthy();
    expect(screen.queryByTestId('device-fact-port')).toBeNull();
    expect(drawn(overview as unknown as Drawn)).not.toMatch(MODEL_WORDS);
    expect(within(overview).queryByText(CHIP)).toBeNull();
    expect(screen.queryByTestId('synthetic-values-camera')).toBeNull();
  });

  it('camera detail of a generated source whose line states no profile: "Not reported", never the model\'s resolution', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/CAM-01' });
    mark(h, ALL_FAKE);
    profile(h, '');
    await settle();
    expect(within(screen.getByTestId('device-fact-format')).getByText('Not reported')).toBeTruthy();
    expect(text('device-overview')).not.toMatch(MODEL_WORDS);
  });

  it('microphone detail of a generated source: no channel, gain, phantom power, converter or "read-only" note; the CLIP latch and the source stay', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/MIC-01' });
    mark(h, ALL_FAKE);
    await settle();
    expect(within(screen.getByTestId('device-fact-source')).getByText('Generated test source')).toBeTruthy();
    expect(screen.getByTestId('device-fact-clip')).toBeTruthy();
    expect(screen.queryByTestId('device-fact-gain')).toBeNull();
    expect(screen.queryByTestId('device-fact-phantom')).toBeNull();
    expect(text('device-overview')).not.toMatch(MODEL_WORDS);
    expect(screen.queryByText(/read-only in this demo/)).toBeNull();
    expect(screen.queryByTestId('synthetic-values-microphone')).toBeNull();
  });

  it('blocks that keep model values carry the chip: a camera and a microphone of another adapter', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/CAM-01' });
    mark(h, { ...ALL_FAKE, 'CAM-01': PRODUCTION, 'MIC-02': { sourceClass: 'PRODUCTION', adapter: 'USB_AUDIO' } });
    await settle();
    expect(screen.getByTestId('synthetic-values-camera')).toHaveTextContent(CHIP);
    // The model values are still there - that is what the chip marks.
    expect(within(screen.getByTestId('device-fact-port')).getByText('PoE CAM 1')).toBeTruthy();
    expect(screen.queryByTestId('device-fact-source')).toBeNull();
    h.app.unmount();

    live();
    const m = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/MIC-02' });
    mark(m, { ...ALL_FAKE, 'MIC-02': { sourceClass: 'PRODUCTION', adapter: 'USB_AUDIO' } });
    await settle();
    expect(screen.getByTestId('synthetic-values-microphone')).toHaveTextContent(CHIP);
    expect(screen.getByTestId('device-fact-gain')).toBeTruthy();
  });

  it('blocks that keep model values carry the chip: the PoE switch (overview and the derived health series), the indicator, the tablet row', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/POE-SWITCH' });
    mark(h, ALL_FAKE);
    await settle();
    expect(screen.getByTestId('synthetic-values-poe')).toHaveTextContent(CHIP);
    expect(screen.getByTestId('device-fact-ports')).toBeTruthy();
    fireEvent.press(screen.getByTestId('device-tab-health'));
    await settle();
    expect(screen.getByTestId('synthetic-values-health')).toHaveTextContent(CHIP);
    h.app.unmount();

    for (const [id, block] of [
      ['REC-INDICATOR', 'relay'],
      ['TABLET', 'tablet'],
    ] as const) {
      live();
      const other = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: `/devices/${id}` });
      mark(other, ALL_FAKE);
      await settle();
      expect(screen.getByTestId(`synthetic-values-${block}`)).toHaveTextContent(CHIP);
      other.app.unmount();
    }
  });

  it('the list: a generated source is named as that under its name; the "Other devices" section carries the chip', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    mark(h, ALL_FAKE);
    await settle();
    for (const id of ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02']) {
      const label = String(screen.getByTestId(`device-row-${id}`).props.accessibilityLabel);
      expect(label).toMatch(/Generated test source/);
      expect(label).not.toMatch(/Channel \d|Interview Room/);
    }
    expect(within(screen.getByTestId('devices-section-other')).getByTestId('synthetic-values-other')).toHaveTextContent(CHIP);
    expect(within(screen.getByTestId('devices-section-cameras')).queryByText(CHIP)).toBeNull();
  });
});

// Fix wave M (re-check 70 finding G70d-02): ONE wording rule for a capture source - the Devices LIST rows and the
// detail chip / "Status" row read "Online" at rest beside "Not checked" for the same source, and the microphone
// lines kept the simulator's room roles ("MIC 1 – Interviewer", "MIC 2 – Subject").
describe.each(WINDOWS)('G70d-02 - the Devices rows and the detail of a selected source on a Core in real capture, %s', (window) => {
  const SOURCES = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'] as const;
  const record = (h: Pick<DevicesHarness, 'sim'>) =>
    act(() => h.sim.store.setState((s) => ({ session: { ...(s.session ?? ({} as NonNullable<SimState['session']>)), id: 'SES-TEST-0001', state: 'RECORDING', captureConfig: s.captureConfig } as unknown as SimState['session'] })));

  it('at rest every row says "Not checked" (chip and label), never "Online"; the microphone lines are named by their role in force', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    mark(h, ALL_FAKE);
    await settle();
    for (const id of SOURCES) {
      expect(text(`device-status-${id}`)).toMatch(/Not checked/);
      expect(text(`device-status-${id}`)).not.toMatch(/Online/);
      const label = String(screen.getByTestId(`device-row-${id}`).props.accessibilityLabel);
      expect(label).toMatch(/Not checked/);
      expect(label).not.toMatch(/Online|Interviewer|Subject/);
    }
    expect(String(screen.getByTestId('device-row-MIC-01').props.accessibilityLabel)).toMatch(/MIC 1 · Primary/);
    expect(String(screen.getByTestId('device-row-MIC-02').props.accessibilityLabel)).toMatch(/MIC 2 · Standby/);
    // The selector in force names the line: with MIC-02 made primary the names follow.
    act(() => h.sim.store.setState((s) => ({ captureConfig: { ...s.captureConfig, mics: s.captureConfig.mics.map((line) => ({ ...line, role: line.role === 'PRIMARY' ? 'STANDBY' : 'PRIMARY' })) } as SimState['captureConfig'] })));
    await settle();
    expect(String(screen.getByTestId('device-row-MIC-01').props.accessibilityLabel)).toMatch(/MIC 1 · Standby/);
    expect(String(screen.getByTestId('device-row-MIC-02').props.accessibilityLabel)).toMatch(/MIC 2 · Primary/);
  });

  it('a checked fact of the Core: "Reachable"; a camera on a line while a session records: "Live"', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    mark(h, ALL_FAKE);
    act(() => h.sim.store.setState((s) => ({ captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => (device.id === 'CAM-01' ? { ...device, checkedAt: 1 } : device)) } as SimState['captureDevices'] })));
    await settle();
    expect(text('device-status-CAM-01')).toMatch(/Reachable/);
    expect(text('device-status-CAM-02')).toMatch(/Not checked/);
    record(h);
    await settle();
    expect(text('device-status-CAM-01')).toMatch(/Live/);
    expect(text('device-status-CAM-02')).toMatch(/Live/);
    expect(text('device-status-MIC-01')).not.toMatch(/Online|Not checked/);
  });

  it.each(['CAM-01', 'MIC-02'] as const)('the detail of %s: the chip and the "Status" row say "Not checked"; the name carries no room role', async (id) => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: `/devices/${id}` });
    mark(h, ALL_FAKE);
    await settle();
    expect(text('device-detail-status')).toMatch(/Not checked/);
    expect(text('device-detail-status')).not.toMatch(/Online/);
    expect(text('device-fact-status')).toMatch(/Not checked/);
    expect(text('device-fact-status')).not.toMatch(/Online/);
    expect(screen.queryByText(/Interviewer|– Subject/)).toBeNull();
    if (id === 'MIC-02') expect(screen.getAllByText('MIC 2 · Standby').length).toBeGreaterThan(0);
  });
});

describe.each(WINDOWS)('CONTROL - the simulated lane on %s is what it was', (window) => {
  it('Simulated client mode: the model values, no chip, the transport word on the selector line - also when the state names an adapter', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/CAM-01' });
    await settle();
    expect(within(screen.getByTestId('device-fact-port')).getByText('PoE CAM 1')).toBeTruthy();
    expect(text('device-overview')).toMatch(/Dual-lens|DL-2/);
    expect(screen.queryByTestId('device-fact-source')).toBeNull();
    expect(chips()).toBe(0);
    h.app.unmount();

    const m = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/MIC-01' });
    // Even a state that names the generated adapter: Simulated mode is not a Core in its own capture.
    mark(m, ALL_FAKE);
    await settle();
    expect(within(screen.getByTestId('device-fact-gain')).getByText('32 dB')).toBeTruthy();
    expect(within(screen.getByTestId('device-fact-phantom')).getByText('48 V ON')).toBeTruthy();
    expect(screen.getByText(/read-only in this demo/)).toBeTruthy();
    expect(chips()).toBe(0);
    m.app.unmount();

    const list = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    expect(String(screen.getByTestId('device-row-MIC-01').props.accessibilityLabel)).toMatch(/Channel 1/);
    // Fix wave M (G70d-02) CONTROL: the simulated lane keeps "Online" and the room's names.
    expect(String(screen.getByTestId('device-row-MIC-01').props.accessibilityLabel)).toMatch(/MIC 1 – Interviewer/);
    expect(String(screen.getByTestId('device-row-MIC-01').props.accessibilityLabel)).toMatch(/Online/);
    expect(text('device-status-CAM-01')).toMatch(/Online/);
    expect(text('capture-selector-row-MIC-01')).toMatch(/USB/);
    expect(chips()).toBe(0);
    list.app.unmount();
  });

  it('Live, a Core in SIMULATED capture (no device states a class): the model values, no chip', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/POE-SWITCH' });
    await settle();
    expect(screen.getByTestId('device-fact-ports')).toBeTruthy();
    expect(chips()).toBe(0);
    h.app.unmount();

    live();
    renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/CAM-02' });
    await settle();
    expect(within(screen.getByTestId('device-fact-port')).getByText('PoE CAM 1')).toBeTruthy();
    expect(screen.queryByTestId('device-fact-source')).toBeNull();
    expect(chips()).toBe(0);
  });
});

// ── Fix wave J (judging session; sub-driver J-P3) ─────────────────────────────────────────────────────────
// JT-03 / JW-04 mobile half: no synthetic Core fact as real on the Devices screens of a Core in its own capture
// (the diagnostics rows over hardware it does not read, the derived "Link quality" of a generated source), and
// ONE security statement ("Not reported", the words of Home's chip). JW-08 mobile half: a microphone at rest is
// "— dBFS", "Not measured" - never "No signal". Each with its CONTROL on the simulated lane.
describe('fix wave J - the pure rules', () => {
  it('JT-03 `diagnosticNotReported`: the Core\'s own row (J-S 5 example) and, on a Core that states `platformNotReported`, a PASS over hardware it does not read', () => {
    expect(diagnosticNotReported(DIAGNOSTIC_NOT_REPORTED_EXAMPLE, false)).toBe(true);
    for (const id of PLATFORM_CHECK_IDS) expect(diagnosticNotReported({ id, status: 'PASS' }, true)).toBe(true);
    // A negative fact is never hidden; a check the Core does read keeps its verdict.
    expect(diagnosticNotReported({ id: 'STORAGE', status: 'FAIL' }, true)).toBe(false);
    expect(diagnosticNotReported({ id: 'CPU', status: 'PASS' }, true)).toBe(false);
    // CONTROL: the simulated Core states nothing - every row is its verdict.
    for (const id of [...PLATFORM_CHECK_IDS, 'CPU']) expect(diagnosticNotReported({ id, status: 'PASS' }, false)).toBe(false);
  });

  it('JT-03 `summaryOf`: a "Not reported" row is no pass and no warning - "Every reported check passed · 4 checks are not reported by this Core"', () => {
    const t = (key: string, options?: Record<string, unknown>) => `${key}${options?.count === undefined ? '' : `#${String(options.count)}`}${options?.summary === undefined ? '' : `[${String(options.summary)}|${String(options.notReported)}]`}`;
    const check = (id: string, status: 'PASS' | 'WARN' | 'FAIL', rule?: string) => ({ id, label: id, status, detail: null, ...(rule === undefined ? {} : { params: { rule } }) });
    const run = (checks: ReturnType<typeof check>[]) => ({ checks, completedAt: 1 }) as unknown as Parameters<typeof summaryOf>[0];
    const own = run([check('CPU', 'PASS'), check('STORAGE', 'WARN', 'NOT_REPORTED'), check('FAN', 'WARN', 'NOT_REPORTED'), check('NETWORK', 'PASS'), check('SECURITY', 'PASS')]);
    expect(summaryOf(own, 'k', t, true)).toBe('features.devices.diagnostics.summaryJoin[features.devices.diagnostics.reportedPassed|features.devices.diagnostics.notReported#4]');
    // The rows the Core marked itself are never counted as warnings, also before the client knows the platform member.
    expect(summaryOf(own, 'k', t, false)).toBe('features.devices.diagnostics.summaryJoin[features.devices.diagnostics.reportedPassed|features.devices.diagnostics.notReported#2]');
    expect(summaryOf(run([check('CPU', 'FAIL'), check('SECURITY', 'PASS')]), 'k', t, true)).toMatch(/system\.diagnostics\.failed#1/);
    // CONTROL: the simulated lane.
    expect(summaryOf(run([check('CPU', 'PASS'), check('SECURITY', 'PASS')]), 'k', t, false)).toBe('system.diagnostics.passed');
    expect(summaryOf(run([check('CPU', 'PASS'), check('FAN', 'WARN')]), 'k', t, false)).toBe('system.diagnostics.warned#1');
  });

  it('JW-08 `deviceMicLevelKind`: "No signal" only when the Core STATES it; a flat / absent / not-measured frame is NOT_MEASURED', () => {
    expect(deviceMicLevelKind({ state: 'OK', frameFlat: true, notMeasured: false })).toBe('NOT_MEASURED');
    expect(deviceMicLevelKind({ state: 'OK', frameFlat: false, notMeasured: isLevelNotMeasured(AUDIO_FRAME_NOT_MEASURED_EXAMPLE) })).toBe('NOT_MEASURED');
    expect(deviceMicLevelKind({ state: 'OK', frameFlat: false, notMeasured: false })).toBe('LEVEL');
    expect(deviceMicLevelKind({ state: 'NO_SIGNAL', frameFlat: true, notMeasured: false })).toBe('NO_SIGNAL');
  });

  it('JA2-33 `relayWords`: lit only while a session records; "Lamp off" at rest; a fault keeps its word', () => {
    expect(relayWords('ACTIVE', false)).toEqual({ key: 'features.devices.other.lampOff', lit: false, fault: false });
    expect(relayWords('ACTIVE', true)).toEqual({ key: 'devices.other.recordingLamp', lit: true, fault: false });
    expect(relayWords('FAULT', true)).toMatchObject({ lit: false, fault: true });
  });

  it('JT-14 `registeredStateTone`: ONE colour for "Not checked" (neutral), whether the camera is on a line or not', () => {
    expect(registeredStateTone('READY', false)).toBe('default');
    expect(registeredStateTone('READY', true)).toBe('success');
  });
});

describe.each(WINDOWS)('fix wave J - a Core in real capture on %s', (window) => {
  const ownCapture = (h: Pick<DevicesHarness, 'sim'>) => act(() => h.sim.store.setState((s) => ({ security: { ...s.security, platformNotReported: true } })));
  const frame = (h: Pick<DevicesHarness, 'sim'>, input: string, patch: Record<string, unknown>) =>
    act(() => h.sim.store.setState((s) => ({ audio: { ...s.audio, inputs: { ...s.audio.inputs, [input]: { seq: 1, at: 1, dbfs: -90, peak: -90, clip: false, noSignal: true, ...patch } } } as SimState['audio'] })));

  it('JT-03 diagnostics: SMART, fan, network / PoE and security read "Not reported" (the words of Home\'s security chip) - no PASS; the checks the Core reads keep theirs', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/CAM-01' });
    mark(h, ALL_FAKE);
    ownCapture(h);
    await settle();
    fireEvent.press(screen.getByTestId('device-action-diagnostics'));
    await settle();
    h.run(6_000);
    await settle();
    for (const id of PLATFORM_CHECK_IDS) {
      expect(screen.getByTestId(`device-diagnostics-${id}-NOT_REPORTED`)).toHaveTextContent(en.common.platformNotReported.value);
      expect(screen.queryByTestId(`device-diagnostics-${id}-PASS`)).toBeNull();
      expect(String(screen.getByTestId(`device-diagnostics-${id}`).props.accessibilityLabel)).toMatch(/, Not reported$/);
    }
    expect(screen.getByTestId('device-diagnostics-CPU-PASS')).toBeTruthy();
    expect(text('device-diagnostics-summary')).toMatch(/Every reported check passed · 4 checks are not reported by this Core/);
    expect(text('device-diagnostics-sheet')).not.toMatch(/All checks passed/);
    // JA2-16: the sheet says it is modal.
    expect(screen.getByTestId('device-diagnostics-sheet').props.accessibilityViewIsModal).toBe(true);
  });

  it('JT-03 Health of a generated camera: no "Link quality" figure, no derived chart - "Not reported"', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/CAM-01' });
    mark(h, ALL_FAKE);
    await settle();
    fireEvent.press(screen.getByTestId('device-tab-health'));
    await settle();
    expect(text('device-health-not-reported')).toMatch(/Not reported/);
    expect(screen.queryByTestId('device-health')).toBeNull();
    expect(screen.queryByText(/Link quality|Derived from the Core/)).toBeNull();
  });

  it('JW-08 microphone detail at rest: "— dBFS" and "Not measured", never "No signal"; the Core\'s own NO_SIGNAL state is still said', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/MIC-01' });
    mark(h, ALL_FAKE);
    frame(h, 'MIC-01', AUDIO_FRAME_NOT_MEASURED_EXAMPLE);
    await settle();
    expect(screen.getByTestId('device-detail-meter-readout')).toHaveTextContent('— dBFS');
    expect(text('device-detail-meter-not-measured')).toMatch(/Not measured/);
    expect((screen.getByTestId('device-detail-meter').props.accessibilityValue as { text: string }).text).toBe('— dBFS');
    expect(text('device-detail-meter-plate')).not.toMatch(/no signal/i);
    // A flat frame without the member (a Core that booted before J-S 6): the same.
    frame(h, 'MIC-01', { noSignal: true });
    await settle();
    expect(text('device-detail-meter-plate')).not.toMatch(/no signal/i);
    // The Core states the fault for the microphone: the fault word.
    act(() => h.sim.store.setState((s) => ({ mics: s.mics.map((mic) => (mic.deviceId === 'MIC-01' ? { ...mic, state: 'NO_SIGNAL' } : mic)) } as Pick<SimState, 'mics'>)));
    await settle();
    expect((screen.getByTestId('device-detail-meter').props.accessibilityValue as { text: string }).text).toMatch(/no signal/i);
  });

  it.each(['off', 'default'] as const)('JA2-34 motion=%s: the large meter\'s clock is not stopped by the test switch and its readout is the input\'s level', async (linkMotion) => {
    resetMotionStateForTests({ linkMotion });
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/MIC-02' });
    mark(h, ALL_FAKE);
    frame(h, 'MIC-02', { dbfs: -18, peak: -18, noSignal: false });
    await settle();
    const meter = screen.getByTestId('device-detail-meter');
    expect((meter.props.accessibilityValue as { text: string }).text).toMatch(/^-\d+ dBFS$/);
    expect(JSON.stringify(meter.props.accessibilityValue)).not.toMatch(/-90|-60 dBFS/);
    resetMotionStateForTests();
  });

  it('JA2-33 / JA2-13 the list: the indicator says "Lamp off" (no "Active"), this device is "Device Control", the PoE row\'s label has no empty middle; JT-14 chips take no touch', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    mark(h, ALL_FAKE);
    await settle();
    const relay = String(screen.getByTestId('device-row-REC-INDICATOR').props.accessibilityLabel);
    expect(relay).toBe('Recording Indicator, Lamp off');
    expect(screen.queryByTestId('device-rec-lamp-lit')).toBeNull();
    expect(String(screen.getByTestId('device-row-TABLET').props.accessibilityLabel)).toMatch(/^Device Control, /);
    expect(String(screen.getByTestId('device-row-POE-SWITCH').props.accessibilityLabel)).not.toMatch(/, ,/);
    expect(text('devices-list')).not.toMatch(/[Tt]ablet/);
    expect(screen.getByTestId('device-row-source-wrap-CAM-01').props.pointerEvents).toBe('none');
    // The whole row is the target.
    fireEvent.press(screen.getByTestId('device-row-CAM-02'));
    await settle();
    expect(screen.getByTestId(window === 'phonePortrait' ? 'device-detail-screen' : 'device-detail-pane')).toBeTruthy();
  });
});

describe.each(WINDOWS)('fix wave J CONTROL - the simulated lane on %s is what it was', (window) => {
  it('diagnostics: eight PASS rows and "All checks passed"; Health: the derived line; the microphone: its meter with a level', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/CAM-01' });
    await settle();
    fireEvent.press(screen.getByTestId('device-action-diagnostics'));
    await settle();
    h.run(6_000);
    await settle();
    for (const id of [...PLATFORM_CHECK_IDS, 'CPU', 'CAMERA', 'AUDIO', 'TIME']) expect(screen.getByTestId(`device-diagnostics-${id}-PASS`)).toBeTruthy();
    expect(text('device-diagnostics-summary')).toMatch(/All checks passed/);
    expect(screen.queryByText('Not reported')).toBeNull();
    h.app.unmount();

    const c = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/CAM-01' });
    await settle();
    fireEvent.press(screen.getByTestId('device-tab-health'));
    await settle();
    expect(screen.getByTestId('device-health')).toBeTruthy();
    expect(screen.queryByTestId('device-health-not-reported')).toBeNull();
    c.app.unmount();

    const m = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/MIC-01' });
    act(() => m.sim.store.setState((s) => ({ audio: { ...s.audio, inputs: { ...s.audio.inputs, 'MIC-01': { seq: 1, at: 1, dbfs: -18, peak: -18, clip: false, noSignal: false } } } as SimState['audio'] })));
    await settle();
    expect(screen.queryByTestId('device-detail-meter-readout')).toBeNull();
    expect((screen.getByTestId('device-detail-meter').props.accessibilityValue as { text: string }).text).toMatch(/^-\d+ dBFS$/);
  });

  // Task 4 row 171 (site M6; decision C18 (2)): the input of the meter's channel is found by the lookup of row 164.
  it('task 4 row 171: a microphone whose channel has NO input (the selector holds a lone line) - the meter reads no frame: "— dBFS" and "Not measured", never the level of MIC-01', async () => {
    const m = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/MIC-01' });
    act(() =>
      m.sim.store.setState((s) => ({
        audio: { ...s.audio, inputs: { ...s.audio.inputs, 'MIC-01': { seq: 1, at: 1, dbfs: -18, peak: -18, clip: false, noSignal: false } } } as SimState['audio'],
        captureConfig: { ...s.captureConfig, mics: s.captureConfig.mics.filter((line) => line.role === 'PRIMARY') } as SimState['captureConfig'],
      })),
    );
    await settle();
    // The frame of MIC-01 with a level is still in the slice; the lone PRIMARY line gives no meter channel an input.
    expect(m.sim.store.getState().audio.inputs['MIC-01']?.dbfs).toBe(-18);
    expect(screen.getByTestId('device-detail-meter-readout')).toHaveTextContent('— dBFS');
    expect(text('device-detail-meter-not-measured')).toMatch(/Not measured/);
    expect((screen.getByTestId('device-detail-meter').props.accessibilityValue as { text: string }).text).toBe('— dBFS');
    expect(text('device-detail-meter-plate')).not.toMatch(/-18|no signal/i);
  });

  it('JA2-26: a latched clip with NO session says "No session is recording." and names "Reset clip" with a way to it; while a session records it says "Recording continues on the Core."', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    act(() => h.sim.store.setState((s) => ({ mics: s.mics.map((mic) => (mic.deviceId === 'MIC-02' ? { ...mic, clipLatched: true } : mic)) } as Pick<SimState, 'mics'>)));
    await settle();
    const alert = text('devices-attention');
    expect(alert).toMatch(/No session is recording\./);
    expect(alert).not.toMatch(/Recording continues/);
    expect(text('devices-attention-clip-remedy')).toMatch(/open MIC 2 and press "Reset clip"/);
    fireEvent.press(screen.getByTestId('devices-attention-open-clip'));
    await settle();
    expect(screen.getByTestId('device-clip-reset')).toBeTruthy();
    expect(text('device-clip-remedy')).toMatch(/"Reset clip" clears the mark/);
    h.app.unmount();

    const r = renderDevicesApp({ user: 'rina.wijaya', window, recording: true });
    act(() => r.sim.store.setState((s) => ({ mics: s.mics.map((mic) => (mic.deviceId === 'MIC-02' ? { ...mic, clipLatched: true } : mic)) } as Pick<SimState, 'mics'>)));
    await settle();
    expect(text('devices-attention')).toMatch(/Recording continues on the Core\./);
    expect(text('devices-attention')).not.toMatch(/No session is recording/);
  });

  it('RBAC (one rule): Restart is disabled with "Requires the Technician role" for an investigator; Diagnostics and Test signal (DIAGNOSTICS_RUN) are enabled for every role of today', async () => {
    renderDevicesApp({ user: 'budi.santoso', window, initialUrl: '/devices/CAM-01' });
    await settle();
    const disabled = (id: string) => (screen.getByTestId(id).props.accessibilityState as { disabled?: boolean } | undefined)?.disabled === true;
    expect(disabled('device-action-restart')).toBe(true);
    expect(text('device-restart-hint')).toMatch(/Requires the Technician role/);
    expect(disabled('device-action-diagnostics')).toBe(false);
    expect(disabled('device-action-test-signal')).toBe(false);
    expect(screen.queryByTestId('device-diagnostics-hint')).toBeNull();
  });
});

// JA2-N10 (headline 5): "Camera search is not available on this Core yet." with "Retry" on a SIMULATED Core led
// nowhere. The stand-in Core of this file answers every call 503 (`live()`), as lane 1 answers the search.
describe('fix wave J - camera search answered "unavailable"', () => {
  it('a SIMULATED Core (Live, no device states a class): the sentence for what it is, NO Retry, the search control disabled with that sentence', async () => {
    live();
    renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    fireEvent.press(screen.getByTestId('camera-search-action'));
    await settle();
    expect(text('camera-search-simulated-core')).toMatch(/This Core is simulated: it has no camera search\. Camera search is a function of a Core in real capture\./);
    expect(screen.queryByTestId('camera-search-retry')).toBeNull();
    expect(screen.queryByTestId('camera-search-unavailable')).toBeNull();
    expect(text('camera-search')).not.toMatch(/\byet\b|connects to nothing/);
    const action = screen.getByTestId('camera-search-action');
    expect((action.props.accessibilityState as { disabled?: boolean }).disabled).toBe(true);
    expect(String(action.props.accessibilityHint)).toMatch(/This Core is simulated/);
  });

  it('CONTROL - a Core in real capture that answers 503: "not available right now" WITH Retry (it may come back)', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya' });
    mark(h, ALL_FAKE);
    await settle();
    fireEvent.press(screen.getByTestId('camera-search-action'));
    await settle();
    expect(text('camera-search-unavailable')).toMatch(/Camera search is not available on this Core right now\./);
    expect(screen.getByTestId('camera-search-retry')).toBeTruthy();
    expect(screen.queryByTestId('camera-search-simulated-core')).toBeNull();
  });
});
