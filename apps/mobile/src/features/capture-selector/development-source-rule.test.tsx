// Integration pass D2, item 1 (decision D131; it settles D129 (2)) — the "Development source" badge
// of the tablet and the phone is drawn from the Core's `sourceClass` ONLY. The session's demo flag
// (`demoControls`) is not part of the rule: a device without `sourceClass` never shows the badge
// whatever the flag says, and a device with it shows the badge whatever the flag says.
//
// The Live source is stood in for by its one read member (`useMobileLive()` non-null = Live mode,
// with a session that carries the demo flag under test); the store is a real test simulator whose
// `captureDevices` slice holds what a Core would send. NOT proven here: a real Core (gate flow F6).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';

import { act, screen } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { DevelopmentSourceBadge, MicInputSourceBadge, TrackSourceBadge, useMicInputName } from './development-source-badge';
import { Text } from 'react-native';

/** What `useMobileLive()` answers: null = Simulated client mode; an object = Live, with the session's demo flag. */
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

type Engine = ReturnType<typeof createTestSim>;

/** The devices as a Core would send them: every built-in WITHOUT `sourceClass`, then the marks the test asks for. */
function withDevices(engine: Engine, marks: Readonly<Record<string, { sourceClass: 'DEVELOPMENT' | 'PRODUCTION'; adapter: string }>>): void {
  act(() =>
    engine.sim.store.setState((s) => ({
      captureDevices: {
        ...s.captureDevices,
        devices: s.captureDevices.devices.map((device) => {
          const { sourceClass: _sourceClass, adapter: _adapter, ...bare } = device as typeof device & { sourceClass?: string; adapter?: string };
          const mark = marks[device.id];
          return (mark === undefined ? bare : { ...bare, ...mark }) as typeof device;
        }),
      },
    })),
  );
}

function Badges() {
  return (
    <>
      <DevelopmentSourceBadge deviceId="CAM-01" testID="by-device-CAM-01" />
      <DevelopmentSourceBadge deviceId="CAM-02" testID="by-device-CAM-02" />
      <TrackSourceBadge trackId="VIDEO-01" testID="by-track-VIDEO-01" />
      <TrackSourceBadge trackId="VIDEO-02" testID="by-track-VIDEO-02" />
      <MicInputSourceBadge inputId="MIC-01" testID="by-input-MIC-01" />
      <MicInputSourceBadge inputId="MIC-02" testID="by-input-MIC-02" />
    </>
  );
}

const shown = () => ['by-device-CAM-01', 'by-device-CAM-02', 'by-track-VIDEO-01', 'by-track-VIDEO-02', 'by-input-MIC-01', 'by-input-MIC-02'].filter((id) => screen.queryByTestId(id) !== null);

describe('the badge follows `sourceClass` and nothing else (D131)', () => {
  for (const demoControls of [true, false]) {
    it(`Live, demo flag ${demoControls ? 'ON' : 'off'}: no device carries \`sourceClass\` -> no badge anywhere`, async () => {
      mockLive = { session: { demoControls } };
      const engine = createTestSim();
      const view = renderWithRuntime(<Badges />, { sim: engine.sim });
      await flushAsync();
      withDevices(engine, {});
      await flushAsync();
      expect(shown()).toEqual([]);
      expect(screen.queryByText('Development source')).toBeNull();
      view.unmount();
    });

    it(`Live, demo flag ${demoControls ? 'ON' : 'off'}: the devices the Core marked DEVELOPMENT are badged, the others are not`, async () => {
      mockLive = { session: { demoControls } };
      const engine = createTestSim();
      const view = renderWithRuntime(<Badges />, { sim: engine.sim });
      await flushAsync();
      withDevices(engine, {
        'CAM-01': { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' },
        'MIC-02': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' },
        'CAM-02': { sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP' },
      });
      await flushAsync();
      // CAM-01 feeds VIDEO-01 in the seeded selector: the device badge and the track badge agree.
      expect(shown()).toEqual(['by-device-CAM-01', 'by-track-VIDEO-01', 'by-input-MIC-02']);
      expect(screen.getByTestId('by-track-VIDEO-01-kind')).toHaveTextContent("Core Mac's camera");
      expect(screen.getByTestId('by-input-MIC-02-kind')).toHaveTextContent('Test source');
      view.unmount();
    });
  }

  it('Simulated client mode (no Core): the same marks draw nothing (D83)', async () => {
    mockLive = null;
    const engine = createTestSim();
    const view = renderWithRuntime(<Badges />, { sim: engine.sim });
    await flushAsync();
    withDevices(engine, { 'CAM-01': { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' }, 'MIC-02': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' } });
    await flushAsync();
    expect(shown()).toEqual([]);
    view.unmount();
  });
});

describe('a microphone is named from the id the Core sent (item 5)', () => {
  function Names() {
    const name = useMicInputName();
    return <Text testID="names">{['MIC-01', 'MIC-02', 'MIC-03'].map(name).join(' | ')}</Text>;
  }

  it('Live: a third microphone reads "MIC 3"; when the Core says it is its local microphone, "Core Mac\'s microphone"', async () => {
    mockLive = { session: { demoControls: false } };
    const engine = createTestSim();
    const view = renderWithRuntime(<Names />, { sim: engine.sim });
    await flushAsync();
    expect(screen.getByTestId('names')).toHaveTextContent('MIC 1 | MIC 2 | MIC 3');
    act(() =>
      engine.sim.store.setState((s) => ({
        captureDevices: {
          ...s.captureDevices,
          devices: [...s.captureDevices.devices, { ...s.captureDevices.devices.find((device) => device.kind === 'MIC')!, id: 'MIC-03', sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' } as (typeof s.captureDevices.devices)[number]],
        },
      })),
    );
    await flushAsync();
    expect(screen.getByTestId('names')).toHaveTextContent("MIC 1 | MIC 2 | Core Mac's microphone");
    view.unmount();
  });
});
