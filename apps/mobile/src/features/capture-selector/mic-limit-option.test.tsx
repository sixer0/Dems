// Fix pass F-M4 (review R69-07, question 10; decision D178) — where the operator CHOOSES the Core
// Mac's microphone (the option of the primary-microphone sheet) the short limit sentence is shown:
// only for a microphone the Core marked as its local device, only in real capture (Live).
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';

import { screen } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import type { MicOption } from './capture-selector-model';
import { CaptureSourceSheet, type SourceSheetRequest } from './capture-source-sheet';

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

// Fix wave H (G70-02): the sheet takes the registered microphones (`MicOption`), not the two selector rows; the assertions are unchanged.
const row = (deviceId: string, role: MicOption['role'], over: Partial<MicOption> = {}): MicOption => ({ deviceId, model: null, role, online: true, sourceClass: null, adapter: null, ...over });
const INPUTS: readonly MicOption[] = [
  row('MIC-01', 'PRIMARY', { sourceClass: 'PRODUCTION', adapter: 'USB_AUDIO' }),
  row('MIC-02', 'STANDBY', { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' }),
  row('MIC-03', null, { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' }),
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
    await open({ kind: 'mic', role: 'PRIMARY', currentInputId: 'MIC-01', options: INPUTS, badgeMode: { live: true } });
    expect(screen.getByTestId('capture-source-option-MIC-03')).toBeTruthy();
    expect(screen.getByTestId('capture-source-limit-MIC-03')).toHaveTextContent(LIMIT);
    expect(screen.queryByTestId('capture-source-limit-MIC-01')).toBeNull();
    expect(screen.queryByTestId('capture-source-limit-MIC-02')).toBeNull();
  });

  it('CONTROL: Simulated client mode draws no limit sentence (nothing is opened there)', async () => {
    await open({ kind: 'mic', role: 'PRIMARY', currentInputId: 'MIC-01', options: INPUTS, badgeMode: { live: false } });
    expect(screen.getByTestId('capture-source-option-MIC-03')).toBeTruthy();
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
