// Fix wave I, driver C - the pure rule of `source-state.ts` (re-gate 70 finding G70b-06; the Home
// microphone item of re-gate 75; contract note `contract_wave_i_a2.md` §4).
//
// `checkedAt` is a PLANNED additive member of a capture device (the name is fixed by the contract note,
// the shared schema does not carry it yet), so the rule is held here on plain state objects.
import { describe, expect, it, jest } from '@jest/globals';
import { createIdleState, DEFAULT_SEED, type SimState } from '@dems/shared/sim';
import { realCaptureView } from '@/features/devices/camera-preview';
import { cameraStreamWordApplies, checkedFactOf, micLineDeviceIdOf, micLineReportOf, primaryMicReportOf, realCaptureSources, sourceStateWord } from './source-state';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);

const idle = (): SimState => createIdleState({ now: 1_791_636_968_000, seed: DEFAULT_SEED });
type Mark = Record<string, unknown>;
const FAKE: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' };
const LOCAL: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' };
function marked(state: SimState, marks: Readonly<Record<string, Mark>>): SimState {
  return { ...state, captureDevices: { ...state.captureDevices, devices: state.captureDevices.devices.map((device) => ({ ...device, ...(marks[device.id] ?? {}) }) as typeof device) } };
}
const word = (state: SimState, channel: 'AUDIO-01' | 'AUDIO-02', live = true) => sourceStateWord(micLineReportOf(state, channel), live);

describe('checkedFactOf: the planned `checkedAt` member, read defensively', () => {
  it('absent = the Core does not state it; null = not read since the Core started; a number = read', () => {
    expect(checkedFactOf({ id: 'MIC-01' })).toBeNull();
    expect(checkedFactOf({ id: 'MIC-01', checkedAt: null })).toBe(false);
    expect(checkedFactOf({ id: 'MIC-01', checkedAt: 1_791_636_968_000 })).toBe(true);
    expect(checkedFactOf({ id: 'MIC-01', checkedAt: 'yesterday' })).toBeNull();
    expect(checkedFactOf(undefined)).toBeNull();
  });
});

describe('sourceStateWord: what the Core reported for the microphone on a line', () => {
  it('reachable by registration, and the Core says it has not read it: "Not checked" (never "Ready" / "Reachable")', () => {
    const state = marked(idle(), { 'MIC-01': { ...FAKE, checkedAt: null }, 'MIC-02': { ...FAKE, checkedAt: 1_791_636_968_000 } });
    expect(word(state, 'AUDIO-01')).toMatchObject({ kind: 'NOT_CHECKED', key: 'features.capture-selector.sourceState.notChecked' });
    expect(word(state, 'AUDIO-02')).toMatchObject({ kind: 'REACHABLE', key: 'common.developmentRoster.reachable', tone: 'success' });
  });

  // Fix wave L (controller ruling on G70c-02): a source at rest of which the Core states no checked fact reads "Not checked" - never "Reachable" / "Ready".
  it('`checkedAt` absent (a Core that does not state it): "Not checked" at rest, "Reachable" while a session records on the line; a negative fact is never hidden', () => {
    const state = marked(idle(), { 'MIC-01': FAKE, 'MIC-02': { ...FAKE, online: false } });
    expect(word(state, 'AUDIO-01').kind).toBe('NOT_CHECKED');
    expect(sourceStateWord(micLineReportOf(state, 'AUDIO-01'), true, true).kind).toBe('REACHABLE');
    expect(word(state, 'AUDIO-02')).toMatchObject({ kind: 'NOT_REACHABLE', key: 'common.developmentRoster.notReachable', tone: 'danger' });
  });

  it('offline wins over "not checked": a device the Core reports gone is "Not reachable"', () => {
    const state = marked(idle(), { 'MIC-01': { ...FAKE, online: false, checkedAt: null } });
    expect(word(state, 'AUDIO-01').kind).toBe('NOT_REACHABLE');
  });

  it('"On" only for the Core\'s local microphone, open, in Live mode', () => {
    const open = marked(idle(), { 'MIC-01': { ...LOCAL, sourceOpen: true, checkedAt: null } });
    expect(word(open, 'AUDIO-01')).toMatchObject({ kind: 'ON', key: 'features.capture-selector.preview.on' });
    expect(word(open, 'AUDIO-01', false).kind).not.toBe('ON');
    expect(word(marked(idle(), { 'MIC-01': { ...FAKE, sourceOpen: true } }), 'AUDIO-01').kind).toBe('REACHABLE');
  });

  it('the report follows the SELECTOR: a microphone the registry does not hold is "State not known"; the primary report is the PRIMARY line\'s', () => {
    const base = marked(idle(), { 'MIC-01': FAKE, 'MIC-02': FAKE });
    const state: SimState = { ...base, captureConfig: { ...base.captureConfig, mics: base.captureConfig.mics.map((line) => (line.role === 'PRIMARY' ? { ...line, inputId: 'MIC-09', deviceId: 'MIC-09' } : line)) } };
    expect(primaryMicReportOf(state).deviceId).toBeNull();
    const channel = state.captureConfig.mics[0]?.role === 'PRIMARY' ? 'AUDIO-01' : 'AUDIO-02';
    expect(word(state, channel)).toMatchObject({ kind: 'UNKNOWN', key: 'features.capture-selector.preview.stateUnknown' });
    expect(primaryMicReportOf(base).deviceId).toBe(base.captureConfig.mics.find((line) => line.role === 'PRIMARY')?.deviceId);
  });
});

// Task 4 row 171 (site M5; decision C18 (2)): the microphone of a meter channel is found by the lookup of row 164.
describe('task 4 row 171: a meter channel WITHOUT an input names no device (never the device behind MIC-01 / MIC-02)', () => {
  const base = marked(idle(), { 'MIC-01': { ...FAKE, checkedAt: 1_791_636_968_000 }, 'MIC-02': { ...FAKE, checkedAt: 1_791_636_968_000 } });
  const withRoles = (roles: readonly string[]): SimState => ({ ...base, captureConfig: { ...base.captureConfig, mics: base.captureConfig.mics.filter((line) => roles.includes(line.role)) } });

  it.each([
    ['no microphone line', []],
    ['a lone PRIMARY line', ['PRIMARY']],
    ['a lone STANDBY line', ['STANDBY']],
  ])('%s: both channels report the unknown source - no device id, "State not known"', (_name, roles) => {
    const state = withRoles(roles);
    for (const channel of ['AUDIO-01', 'AUDIO-02'] as const) {
      expect(micLineDeviceIdOf(state, channel)).toBeNull();
      expect(micLineReportOf(state, channel)).toMatchObject({ deviceId: null, kind: 'MIC', online: false, sourceOpen: false, checked: null });
      expect(word(state, channel)).toMatchObject({ kind: 'UNKNOWN', key: 'features.capture-selector.preview.stateUnknown' });
    }
    // The registry still HOLDS both microphones, reachable: the channel does not read them.
    expect(state.captureDevices.devices.filter((device) => device.id === 'MIC-01' || device.id === 'MIC-02')).toHaveLength(2);
  });

  it('a lone line keeps its ROLE: the primary report still names the PRIMARY line\'s microphone', () => {
    expect(primaryMicReportOf(withRoles(['PRIMARY'])).deviceId).toBe('MIC-01');
    expect(primaryMicReportOf(withRoles(['STANDBY'])).deviceId).toBeNull();
  });

  it('CONTROL - the seeded, complete pair: each channel names the microphone of its line, as before', () => {
    expect(micLineDeviceIdOf(base, 'AUDIO-01')).toBe('MIC-01');
    expect(micLineDeviceIdOf(base, 'AUDIO-02')).toBe('MIC-02');
    expect(word(base, 'AUDIO-01').kind).toBe('REACHABLE');
    expect(word(base, 'AUDIO-02').kind).toBe('REACHABLE');
  });
});

describe('cameraStreamWordApplies (contract note A2 §4, RULED): "Live" only while a session records', () => {
  it('real capture: not outside a recording; simulated capture: as before', () => {
    expect(cameraStreamWordApplies({ realCapture: true, recording: false })).toBe(false);
    expect(cameraStreamWordApplies({ realCapture: true, recording: true })).toBe(true);
    expect(cameraStreamWordApplies({ realCapture: false, recording: false })).toBe(true);
  });
});

describe('realCaptureSources is the rule of `realCaptureView` (one rule, two modules)', () => {
  it('agrees on every vector', () => {
    const lists = [[], [{}], [{ sourceClass: null }], [{ sourceClass: 'DEVELOPMENT' }], [{}, { sourceClass: 'PRODUCTION' }]];
    for (const devices of lists) for (const live of [true, false]) expect([devices, live, realCaptureSources(devices, live)]).toEqual([devices, live, realCaptureView(devices, live)]);
    expect(realCaptureSources([{ sourceClass: 'DEVELOPMENT' }], true)).toBe(true);
    expect(realCaptureSources([{}], true)).toBe(false);
  });
});
