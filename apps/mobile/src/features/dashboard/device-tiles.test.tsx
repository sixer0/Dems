// Audit row 230 (M3 cycle 2, F2; items F-8-09, M3-09 domino; D60): the tablet Home camera tiles 3 and 4 were bound to
// camera 1 - `device-tiles.tsx` derived the camera as `VIDEO-02 ? 2 : 1`, a two-camera leftover - so the tablet asked
// the Core for a second preview of camera 1, which was refused ("No preview" on tiles 3 and 4).
//
// Held here: each of the four camera tiles mounts its preview on its OWN track (VIDEO-0N -> camera N), so the four
// tiles ask for four distinct preview targets - four tracks, and the four distinct devices the selector assigns them.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { cleanup } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { DEMO_MEDIA_LIVE, demoVideoAssetOf } from '@/components/media/demo-media';
import { noPreviewFactsOf, previewTrackOf, type CameraPreview as CameraPreviewType } from '@/features/devices/camera-preview';
import { resetMotionStateForTests } from '@/motion';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { DeviceTiles } from './device-tiles';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}));

type PreviewProps = ComponentProps<typeof CameraPreviewType>;
const mockMounts: PreviewProps[] = [];
// The real preview, with its props recorded: what each tile asks the preview (and so the reach gate and op 112) for.
jest.mock('@/features/devices/camera-preview', () => {
  const actual = jest.requireActual<typeof import('@/features/devices/camera-preview')>('@/features/devices/camera-preview');
  return {
    ...actual,
    CameraPreview: (props: PreviewProps) => {
      mockMounts.push(props);
      return actual.CameraPreview(props);
    },
  };
});

const TRACKS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'] as const;

/** The last props each camera tile's preview was mounted with, by the tile's testID. */
function lastMountByTile(): Map<string, PreviewProps> {
  const byTile = new Map<string, PreviewProps>();
  for (const props of mockMounts) if (props.testID !== undefined) byTile.set(props.testID, props);
  return byTile;
}

describe('tablet Home camera tiles bind to their own camera (row 230, F2)', () => {
  beforeAll(() => {
    jest.useRealTimers();
  });
  afterEach(() => {
    cleanup();
    mockMounts.length = 0;
  });

  it.each([false, true])('tiles 1-4 bind to cameras 1-4 and ask for 4 distinct preview targets (test switch %s)', async (testSwitch) => {
    resetMotionStateForTests(testSwitch ? { linkMotion: 'off' } : {});
    const test = createTestSim();
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    renderWithRuntime(<DeviceTiles />, { sim: test.sim });
    await flushAsync();

    const byTile = lastMountByTile();
    const mounts = TRACKS.map((track) => byTile.get(`home-device-${track}-feed`));
    expect(mounts.every((props) => props !== undefined)).toBe(true);

    // Tile N: camera N, on track VIDEO-0N, with the live preview on.
    expect(mounts.map((props) => props?.cameraId)).toEqual(['CAM-1', 'CAM-2', 'CAM-3', 'CAM-4']);
    expect(mounts.map((props) => props?.cameraLabel)).toEqual(['CAM 1', 'CAM 2', 'CAM 3', 'CAM 4']);
    expect(mounts.map((props) => props?.trackId)).toEqual([...TRACKS]);
    expect(mounts.every((props) => props?.livePreview === true)).toBe(true);

    // The preview target of each tile (the track the reach gate and op 112 resolve), however the preview reads it.
    const targets = mounts.map((props) => props?.trackId ?? previewTrackOf(props?.cameraId ?? ''));
    expect(new Set(targets).size).toBe(4);

    // And the devices the selector assigns to those tracks: four, none shared (the second-stream refusal of F2).
    const state = test.sim.store.getState();
    const devices = targets.map((track) => noPreviewFactsOf(state, track).deviceId);
    const assigned = devices.filter((id): id is string => id !== null);
    expect(assigned).toHaveLength(4);
    expect(new Set(assigned).size).toBe(4);

    // D172 known limit: cameras 1-2 show their own poster under the test switch, cameras 3-4 camera 1's.
    if (testSwitch) {
      expect(mounts.map((props) => props?.image)).toEqual(TRACKS.map((track) => demoVideoAssetOf(DEMO_MEDIA_LIVE, 'poster', track)));
      expect(mounts[1]?.image).toBe(DEMO_MEDIA_LIVE.poster['VIDEO-02']);
      expect(mounts[2]?.image).toBe(DEMO_MEDIA_LIVE.poster['VIDEO-01']);
    } else {
      expect(mounts.every((props) => props?.mode === 'live' && props.image === undefined)).toBe(true);
    }
  });
});
