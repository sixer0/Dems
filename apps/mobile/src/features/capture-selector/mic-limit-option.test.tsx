// Fix pass F-M4 (review R69-07, question 10; decision D178) — where the operator CHOOSES the Core
// Mac's microphone (the option of the primary-microphone sheet) the short limit sentence is shown:
// only for a microphone the Core marked as its local device, only in real capture (Live).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';

import { screen, fireEvent } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { statedModelOf, type CameraOption, type MicOption } from './capture-selector-model';
import { CaptureSourceSheet, type SourceSheetRequest, cameraOptionWord } from './capture-source-sheet';
import type { ReactTestInstance } from 'react-test-renderer';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('mic limit option', () => {
unmountBeforeTheHooksOfThisGroup();

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

// Fix wave H (G70-02): the sheet takes the registered microphones (`MicOption`), not the selector rows; D61 (2026-11-04): the option names the CHANNEL it holds.
const row = (deviceId: string, channel: MicOption['channel'], over: Partial<MicOption> = {}): MicOption => ({ deviceId, model: null, channel, online: true, sourceClass: null, adapter: null, ...over });
const INPUTS: readonly MicOption[] = [
  row('MIC-01', 'MIC-01', { sourceClass: 'PRODUCTION', adapter: 'USB_AUDIO' }),
  row('MIC-02', 'MIC-02', { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' }),
  row('MIC-05', null, { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' }), // D61: an adopted microphone mints past the four built-ins
];
const LIMIT = 'Not fit for recording yet. Use it for development checks only.';

async function open(request: SourceSheetRequest) {
  const view = renderWithRuntime(<CaptureSourceSheet request={request} fullHeight={false} busy={false} pending={false} onSave={() => undefined} onClose={() => undefined} />, { sim: createTestSim().sim });
  await flushAsync();
  await flushAsync();
  return view;
}

describe('the primary-microphone sheet: the limit of the Core Mac\'s microphone', () => {
  it('Live: the option of the local microphone carries the sentence; a test source and a production microphone do not', async () => {
    await open({ kind: 'mic', channel: 'MIC-01', currentInputId: 'MIC-01', options: INPUTS, badgeMode: { live: true } }); // D61 (2026-11-04): the sheet opens for a CHANNEL
    expect(screen.getByTestId('capture-source-option-MIC-05')).toBeTruthy();
    expect(screen.getByTestId('capture-source-limit-MIC-05')).toHaveTextContent(LIMIT);
    expect(screen.queryByTestId('capture-source-limit-MIC-01')).toBeNull();
    expect(screen.queryByTestId('capture-source-limit-MIC-02')).toBeNull();
  });

  it('CONTROL: Simulated client mode draws no limit sentence (nothing is opened there)', async () => {
    await open({ kind: 'mic', channel: 'MIC-01', currentInputId: 'MIC-01', options: INPUTS, badgeMode: { live: false } }); // D61 (2026-11-04)
    expect(screen.getByTestId('capture-source-option-MIC-05')).toBeTruthy();
    expect(screen.queryByText(LIMIT)).toBeNull();
  });

  it('CONTROL: a local CAMERA option carries no microphone sentence', async () => {
    await open({
      kind: 'camera',
      trackId: 'VIDEO-01',
      currentDeviceId: 'CAM-01',
      options: [{ deviceId: 'CAM-03', model: null, online: true, streamState: 'LIVE', assignedTo: null, sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' }] as never,
      badgeMode: { live: true },
    });
    expect(screen.getByTestId('capture-source-option-CAM-03')).toBeTruthy();
    expect(screen.queryByText(LIMIT)).toBeNull();
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-l-m-source-sheet.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave L, driver L-M - re-check 70 findings G70c-02 (mobile half) and G70c-03.
//
// | Finding | What the device showed | Rule held here |
// |---------|------------------------|----------------|
// | G70c-02 | The tablet's camera sheet said "Live" on EVERY option - a camera never opened, a camera on a dead address - with nothing recording | On a Core in real capture an option says what the Core REPORTED for the device; "Live" / "Lost" only for a camera ON a track while a session RECORDS. The simulated Core keeps its words |
// | G70c-03 | On the phone a tap on the "Development source" chip inside an option row did not select the row (the kit chip is a pressable of its own) | The whole row is the target: the badge and the status chip take no touch inside an option |
// | (one rule; contract_wave_l.md section 5) | Lines and options named generated sources by the seed dataset's model ("Dual-lens IP camera DL-2") | `model` of a device with `adapter: 'FAKE'` is not drawn |
describe('the camera options of the source sheet', () => {
unmountBeforeTheHooksOfThisGroup();
const REACHABLE = { key: 'common.developmentRoster.reachable', tone: 'success' } as const;
const NOT_REACHABLE = { key: 'common.developmentRoster.notReachable', tone: 'danger' } as const;
const NOT_CHECKED = { key: 'features.capture-selector.sourceState.notChecked', tone: 'default' } as const;

const option = (deviceId: string, assignedTo: CameraOption['assignedTo'], more: Partial<CameraOption> = {}): CameraOption => ({
  deviceId,
  model: null,
  online: true,
  streamState: 'LIVE',
  assignedTo,
  sourceClass: 'DEVELOPMENT',
  adapter: 'FAKE',
  ...more,
});
const OPTIONS = [option('CAM-01', 'VIDEO-01'), option('CAM-02', 'VIDEO-02'), option('CAM-04', null), option('CAM-05', null)];

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

async function sheet(request: SourceSheetRequest, onSave = jest.fn()) {
  renderWithRuntime(<CaptureSourceSheet request={request} fullHeight busy={false} pending={false} onSave={onSave} onClose={jest.fn()} />, { sim: createTestSim().sim });
  await flushAsync();
  await flushAsync();
  return onSave;
}
const realRequest = (more: Partial<Extract<SourceSheetRequest, { kind: 'camera' }>> = {}): SourceSheetRequest => ({
  kind: 'camera',
  trackId: 'VIDEO-02',
  currentDeviceId: 'CAM-02',
  options: OPTIONS,
  badgeMode: { live: true },
  reported: { 'CAM-01': REACHABLE, 'CAM-02': REACHABLE, 'CAM-04': NOT_REACHABLE, 'CAM-05': NOT_CHECKED },
  ...more,
});
const labelOf = (testID: string): string => String(screen.getByTestId(testID).props.accessibilityLabel);

describe('G70c-02 - cameraOptionWord: the status word of an option', () => {
  it('a simulated Core keeps the stream words', () => {
    expect(cameraOptionWord({ reported: null, realCapture: false, recording: false, onTrack: false })).toBe('STREAM');
  });
  it('real capture, nothing records: the reported state - for a camera on a track and for one on none', () => {
    expect(cameraOptionWord({ reported: REACHABLE, realCapture: true, recording: false, onTrack: true })).toBe(REACHABLE);
    expect(cameraOptionWord({ reported: NOT_CHECKED, realCapture: true, recording: false, onTrack: false })).toBe(NOT_CHECKED);
  });
  it('real capture, a session records: "Live" only for a camera ON a track; a camera on no track keeps its report', () => {
    expect(cameraOptionWord({ reported: REACHABLE, realCapture: true, recording: true, onTrack: true })).toBe('STREAM');
    expect(cameraOptionWord({ reported: REACHABLE, realCapture: true, recording: true, onTrack: false })).toBe(REACHABLE);
  });
  it('real capture and the Core reported nothing for the device: no word (never a constant)', () => {
    expect(cameraOptionWord({ reported: null, realCapture: true, recording: false, onTrack: false })).toBeNull();
  });
});

describe('G70c-02 - the camera sheet of a Core in real capture', () => {
  it('no option says "Live" while nothing records: each says what the Core reported', async () => {
    await sheet(realRequest());
    expect(labelOf('capture-source-state-CAM-01')).toBe('Reachable');
    expect(labelOf('capture-source-state-CAM-02')).toBe('Reachable');
    expect(labelOf('capture-source-state-CAM-04')).toBe('Not reachable');
    expect(labelOf('capture-source-state-CAM-05')).toBe('Not checked');
    expect(screen.queryByText('Live')).toBeNull();
  });

  it('while a session records, the cameras ON a track read "Live"; the others keep their report', async () => {
    await sheet(realRequest({ recording: true }));
    expect(labelOf('capture-source-state-CAM-01')).toBe('Live');
    expect(labelOf('capture-source-state-CAM-02')).toBe('Live');
    expect(labelOf('capture-source-state-CAM-04')).toBe('Not reachable');
    expect(labelOf('capture-source-state-CAM-05')).toBe('Not checked');
  });

  it('CONTROL - the simulated Core (no `reported`): the stream words, as before', async () => {
    const { reported: _reported, ...simulated } = realRequest() as Extract<SourceSheetRequest, { kind: 'camera' }>;
    await sheet({ ...simulated, badgeMode: { live: false } });
    expect(labelOf('capture-source-state-CAM-04')).toBe('Live');
  });
});

describe('G70c-03 - the whole option row is the target', () => {
  /** True when a touch that lands on `node` is not taken by it or anything up to (not including) the row. */
  const passesTouchToRow = (node: ReactTestInstance, rowTestID: string): boolean => {
    let current: ReactTestInstance | null = node;
    while (current !== null && current.props.testID !== rowTestID) {
      if (current.props.pointerEvents === 'none') return true;
      current = current.parent;
    }
    return false;
  };

  it('the "Development source" chip and the status chip inside an option take no touch', async () => {
    await sheet(realRequest());
    for (const id of ['CAM-01', 'CAM-04']) {
      expect(passesTouchToRow(screen.getByTestId(`capture-source-badge-${id}-chip`), `capture-source-option-${id}`)).toBe(true);
      expect(passesTouchToRow(screen.getByTestId(`capture-source-state-${id}`), `capture-source-option-${id}`)).toBe(true);
    }
  });

  it('a press on the row selects it and Save sends that camera', async () => {
    const onSave = await sheet(realRequest());
    expect(screen.getByTestId('capture-source-save').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('capture-source-option-CAM-05'));
    expect(screen.getByTestId('capture-source-option-CAM-05').props.accessibilityState?.selected).toBe(true);
    fireEvent.press(screen.getByTestId('capture-source-save'));
    expect(onSave).toHaveBeenCalledWith({ kind: 'camera', trackId: 'VIDEO-02', deviceId: 'CAM-05' });
  });
});

describe('the one rule - a generated source is not named by a dataset model', () => {
  it('`adapter: FAKE`: no model; any other device keeps the model the registry names', () => {
    expect(statedModelOf({ model: 'Dual-lens IP camera DL-2', adapter: 'FAKE' })).toBeNull();
    expect(statedModelOf({ model: 'FAKE-CAM-1', adapter: 'FAKE' })).toBeNull();
    expect(statedModelOf({ model: 'MacBook Air Camera', adapter: 'LOCAL_DEVICE' })).toBe('MacBook Air Camera');
    expect(statedModelOf({ model: 'Dual-lens IP camera DL-2' })).toBe('Dual-lens IP camera DL-2');
    expect(statedModelOf({ model: 'AXIS P1375', adapter: 'ONVIF_RTSP' })).toBe('AXIS P1375');
  });
});

// Task 4 row W6 (request line 569 (3); decisions C141, C143): the sheet stated LIVE for an option whose stream nobody reads
// (`option.streamState ?? 'LIVE'`). A registered camera at rest (`streamState: null`) reads "Not read" where the stream words
// are drawn; a stated LIVE / LOST is drawn as before. Seen RED on the mutation "the fallback to LIVE put back".
describe('row W6: a registered camera option at rest is "Not read", never "Live"', () => {
  it('the stream words (no report): null reads "Not read"; LIVE and LOST as the Core states them', async () => {
    const options = [option('CAM-01', 'VIDEO-01'), option('CAM-07', null, { streamState: null, adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' }), option('CAM-08', null, { streamState: 'LOST' })];
    await sheet({ kind: 'camera', trackId: 'VIDEO-02', currentDeviceId: null, options, badgeMode: { live: false } });
    expect(labelOf('capture-source-state-CAM-07')).toBe('Not read');
    expect(labelOf('capture-source-state-CAM-01')).toBe('Live');
    expect(labelOf('capture-source-state-CAM-08')).toBe('Lost');
  });
});
});
