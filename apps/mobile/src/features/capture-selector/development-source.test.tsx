// Task 3 row 138 — the one "Development source" badge (ux spec §8f.1, §8f.2; D83, D91; the software
// half of M4-DEVSRC-LABEL-T / -P). The decision (`developmentSourceOf`) is proven in
// `capture-notices-model.test.ts`; here: the badge as drawn, and Simulated client mode on the real
// Devices screen. NOT proven here: the badge on a Live bed (a Core in real capture) — gate flow F.
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { act, screen } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderDevicesApp, settle } from '@/features/devices/testing/devices-harness';
import { renderWithRuntime, createTestSim } from '@/runtime/testing/test-sim';
import { SourceBadge, precheckDeviceOf } from './development-source-badge';

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

describe('the badge as drawn', () => {
  it('an icon chip with the text "Development source" and the kind beside it; the text is the accessible name', async () => {
    const kinds = [
      ['test', 'Test source'],
      ['localCamera', "Core Mac's camera"],
      ['localMicrophone', "Core Mac's microphone"],
    ] as const;
    for (const [kind, kindText] of kinds) {
      const view = renderWithRuntime(<SourceBadge kind={kind} testID="badge" />, { sim: createTestSim().sim });
      await settle();
      expect(screen.getByTestId('badge-chip').props.accessibilityLabel).toBe('Development source');
      expect(screen.getByTestId('badge-kind')).toHaveTextContent(kindText);
      expect(screen.getByTestId('badge').props.accessibilityLabel).toBe(`Development source, ${kindText}`);
      view.unmount();
    }
  });
});

describe('Simulated client mode never badges a device (D83)', () => {
  it('a registered camera that carries `sourceClass: DEVELOPMENT` draws no badge on the Devices rows, the selector or its sheet', async () => {
    const h = renderDevicesApp({ user: 'andi.pratama' });
    await settle();
    // D60 (2026-11-04): CAM-03/04 are built-ins now — the registered test source mints as CAM-05.
    act(() => h.sim.actions.registerCaptureDevice({ id: 'CAM-05', model: 'Test source', host: '127.0.0.1', adapter: 'FAKE' }));
    await settle();
    expect(h.sim.store.getState().captureDevices.devices.find((device) => device.id === 'CAM-05')?.sourceClass).toBe('DEVELOPMENT');
    expect(screen.queryByText('Development source')).toBeNull();
    expect(screen.queryByTestId(/source-(?:CAM|MIC|VIDEO)/)).toBeNull();
  });
});

describe('which device a pre-check row is about', () => {
  const selector = {
    cameras: [
      { trackId: 'VIDEO-01', deviceId: 'CAM-03' },
      { trackId: 'VIDEO-02', deviceId: 'CAM-02' },
    ],
    mics: [
      // D61 (2026-11-04): the lines state their CHANNEL; the arrangement stays the crossed one — the
      // role-keyed checks read channels 1 and 2, the input-keyed ones the ids.
      { inputId: 'MIC-01', channel: 'MIC-02', deviceId: 'MIC-01' },
      { inputId: 'MIC-02', channel: 'MIC-01', deviceId: 'MIC-02' },
    ],
  };
  it('lens rows by track, microphone rows by channel or by input; other checks are about no capture device', () => {
    expect(precheckDeviceOf('LENS_1', selector)).toBe('CAM-03');
    expect(precheckDeviceOf('LENS_2', selector)).toBe('CAM-02');
    expect(precheckDeviceOf('MIC_PRIMARY', selector)).toBe('MIC-02');
    expect(precheckDeviceOf('MIC_STANDBY', selector)).toBe('MIC-01');
    expect(precheckDeviceOf('MIC_1', selector)).toBe('MIC-01');
    expect(precheckDeviceOf('STORAGE', selector)).toBeNull();
  });
});
