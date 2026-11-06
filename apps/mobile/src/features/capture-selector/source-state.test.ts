// Fix wave I, driver C - the pure rule of `source-state.ts` (re-gate 70 finding G70b-06; the Home
// microphone item of re-gate 75; contract note `contract_wave_i_a2.md` §4).
//
// `checkedAt` and `reach` are typed members of a capture device (P10). Audit row 192 (M3-08 R3, D173): the
// up/down of a source is the shared reader's (`slotSourceOf` / `isSlotSourceUp`, P12/P13).
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it, jest } from '@jest/globals';
import { createIdleState, DEFAULT_SEED, isSlotSourceUp, selectorInForce, slotSourceOf, SlotSourceState, type SimState } from '@dems/shared/sim';
import { realCaptureView } from '@/features/devices/camera-preview';
import { cameraLineReportOf, cameraStreamWordApplies, checkedFactOf, deviceReportOf, micLineDeviceIdOf, micLineReportOf, primaryMicReportOf, realCaptureSources, sourceStateWord } from './source-state';

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

describe('checkedFactOf: the typed `checkedAt` member (P10), still defensive about wire junk', () => {
  it('absent = the Core does not state it; null = not read since the Core started; a number = read', () => {
    expect(checkedFactOf({ id: 'MIC-01' })).toBeNull();
    expect(checkedFactOf({ id: 'MIC-01', checkedAt: null })).toBe(false);
    expect(checkedFactOf({ id: 'MIC-01', checkedAt: 1_791_636_968_000 })).toBe(true);
    // Row 192: the member is typed now; junk can still arrive over the wire (an untyped JSON body).
    expect(checkedFactOf(JSON.parse('{"id":"MIC-01","checkedAt":"yesterday"}'))).toBeNull();
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

  it('the report follows the SELECTOR: a microphone the registry does not hold is "State not known"; the transcribed report is the channel-1 line\'s', () => {
    const base = marked(idle(), { 'MIC-01': FAKE, 'MIC-02': FAKE });
    // D61 (2026-11-04): the line is keyed by CHANNEL; the transcribed channel 1 moves to a microphone the registry does not hold.
    const state: SimState = { ...base, captureConfig: { ...base.captureConfig, mics: base.captureConfig.mics.map((line) => (line.channel === 'MIC-01' ? { ...line, inputId: 'MIC-09', deviceId: 'MIC-09' } : line)) } };
    expect(primaryMicReportOf(state).deviceId).toBeNull();
    const channel = state.captureConfig.mics[0]?.channel === 'MIC-01' ? 'AUDIO-01' : 'AUDIO-02';
    expect(word(state, channel)).toMatchObject({ kind: 'UNKNOWN', key: 'features.capture-selector.preview.stateUnknown' });
    expect(primaryMicReportOf(base).deviceId).toBe(base.captureConfig.mics.find((line) => line.channel === 'MIC-01')?.deviceId);
  });
});

// Task 4 row 171 (site M5; decision C18 (2); D61 of 2026-11-04): the microphone of a meter channel is found by the lookup of row 164 - a channel WITHOUT its line.
describe('task 4 row 171: a meter channel WITHOUT its line names no device (never the device behind MIC-01 / MIC-02)', () => {
  const base = marked(idle(), { 'MIC-01': { ...FAKE, checkedAt: 1_791_636_968_000 }, 'MIC-02': { ...FAKE, checkedAt: 1_791_636_968_000 } });
  // D61 (2026-11-04): the filter names the CHANNELS the selector still holds.
  const withChannels = (channels: readonly string[]): SimState => ({ ...base, captureConfig: { ...base.captureConfig, mics: base.captureConfig.mics.filter((line) => channels.includes(line.channel)) } });

  it.each([
    ['no microphone line', []],
    ['a lone channel-3 line (D61: the other channels have no input of their own)', ['MIC-03']],
  ])('%s: channels 1 and 2 report the unknown source - no device id, "State not known"', (_name, channels) => {
    const state = withChannels(channels);
    for (const channel of ['AUDIO-01', 'AUDIO-02'] as const) {
      expect(micLineDeviceIdOf(state, channel)).toBeNull();
      expect(micLineReportOf(state, channel)).toMatchObject({ deviceId: null, kind: 'MIC', online: false, sourceOpen: false, checked: null });
      expect(word(state, channel)).toMatchObject({ kind: 'UNKNOWN', key: 'features.capture-selector.preview.stateUnknown' });
    }
    // The registry still HOLDS both microphones, reachable: the channel does not read them.
    expect(state.captureDevices.devices.filter((device) => device.id === 'MIC-01' || device.id === 'MIC-02')).toHaveLength(2);
  });

  it('a lone line keeps its CHANNEL: the transcribed report still names the channel-1 line\'s microphone', () => {
    // D61 (2026-11-04): the roles became the numbered channels; PRIMARY is the channel-1 line.
    expect(primaryMicReportOf(withChannels(['MIC-01'])).deviceId).toBe('MIC-01');
    expect(primaryMicReportOf(withChannels(['MIC-02'])).deviceId).toBeNull();
  });

  it('CONTROL - the seeded, complete four-channel plane: each channel names the microphone of its line, as before', () => {
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

// Audit row 192 (M3-08 R3, D173): the selector's source words read the ONE shared reader. Up/down is
// `isSlotSourceUp(slotSourceOf(...))`; the words on top are this module's (cause, "Not checked", "On").
describe('row 192: source-state reads the shared slotSourceOf / isSlotSourceUp', () => {
  const NOW = 1_791_636_968_000;
  const cameraOf = (state: SimState, trackId: 'VIDEO-01' | 'VIDEO-02') => selectorInForce(state).cameras.find((line) => line.trackId === trackId)?.deviceId ?? '';

  it('a stated NOT_REACHABLE is "Not reachable" though the registry says online (P10; before: "Reachable")', () => {
    const base = idle();
    const cam = cameraOf(base, 'VIDEO-01');
    const state = marked(base, { [cam]: { ...FAKE, online: true, checkedAt: NOW, reach: 'NOT_REACHABLE' }, 'MIC-01': { ...FAKE, online: true, checkedAt: NOW, reach: 'NOT_REACHABLE' } });
    expect(sourceStateWord(cameraLineReportOf(state, 'VIDEO-01'), true)).toMatchObject({ kind: 'NOT_REACHABLE', key: 'common.developmentRoster.notReachable', tone: 'danger' });
    expect(word(state, 'AUDIO-01').kind).toBe('NOT_REACHABLE');
    // The sheet option (a device read alone) says the same.
    expect(sourceStateWord(deviceReportOf(state, cam, 'CAMERA'), true).kind).toBe('NOT_REACHABLE');
  });

  it('a stated REACHABLE is a checked fact: "Reachable" with no `checkedAt` number (as web row 129 R7 and roster row 190)', () => {
    const base = idle();
    const state = marked(base, { [cameraOf(base, 'VIDEO-01')]: { ...FAKE, online: true, checkedAt: null, reach: 'REACHABLE' } });
    expect(sourceStateWord(cameraLineReportOf(state, 'VIDEO-01'), true)).toMatchObject({ kind: 'REACHABLE', tone: 'success' });
  });

  it('the report carries the reader\'s slot state, on camera and microphone lines', () => {
    const base = idle();
    const cam = cameraOf(base, 'VIDEO-02');
    const state = marked(base, { [cam]: { ...FAKE, reach: 'NOT_REACHABLE' }, 'MIC-02': { ...FAKE, online: false } });
    const selector = selectorInForce(state);
    expect(cameraLineReportOf(state, 'VIDEO-02').source).toBe(slotSourceOf(selector, state.captureDevices.devices, 'VIDEO-02').state);
    expect(cameraLineReportOf(state, 'VIDEO-02').source).toBe(SlotSourceState.NOT_REACHABLE);
    expect(micLineReportOf(state, 'AUDIO-02').source).toBe(SlotSourceState.OFFLINE);
    expect(micLineReportOf(state, 'AUDIO-01').source).toBe(slotSourceOf(selector, state.captureDevices.devices, 'MIC-01').state);
  });

  it.each([
    ['online, no reach', { online: true }],
    ['online, REACHABLE', { online: true, reach: 'REACHABLE' }],
    ['online, NOT_REACHABLE', { online: true, reach: 'NOT_REACHABLE' }],
    ['offline, REACHABLE', { online: false, reach: 'REACHABLE' }],
    ['offline, no reach', { online: false }],
  ])('%s: the word is down exactly when isSlotSourceUp says so', (_name, facts) => {
    const base = idle();
    const state = marked(base, { [cameraOf(base, 'VIDEO-01')]: { ...FAKE, checkedAt: NOW, ...facts } });
    const up = isSlotSourceUp(slotSourceOf(selectorInForce(state), state.captureDevices.devices, 'VIDEO-01'));
    expect(sourceStateWord(cameraLineReportOf(state, 'VIDEO-01'), true).kind === 'NOT_REACHABLE').toBe(!up);
  });

  it('a camera line naming a device of another kind is down (the reader reads it OFFLINE)', () => {
    const base = idle();
    const state: SimState = { ...base, captureConfig: { ...base.captureConfig, cameras: base.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, deviceId: 'MIC-01' } : line)) } };
    expect(cameraLineReportOf(state, 'VIDEO-01').source).toBe(SlotSourceState.OFFLINE);
    expect(sourceStateWord(cameraLineReportOf(state, 'VIDEO-01'), true)).toMatchObject({ kind: 'NOT_REACHABLE', tone: 'danger' });
  });

  it('no local source rule and no checkedAt cast remain in source-state.ts', () => {
    const source = fs.readFileSync(path.join(__dirname, 'source-state.ts'), 'utf8');
    expect(source).not.toMatch(/as \{ readonly checkedAt\?: unknown \}/);
    expect(source).not.toMatch(/rosterDeviceState\(\{ online: report\.online, cause: report\.cause \}\)/);
    expect(source).not.toMatch(/cameras\.find\(\(line\) => line\.trackId === trackId\)/);
    expect(source).toMatch(/isSlotSourceUp\(/);
    expect(source).toMatch(/slotSourceOf\(/);
  });
});
