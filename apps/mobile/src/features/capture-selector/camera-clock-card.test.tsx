// The camera clock rows on Network & Time (task 3 row 68; register MB-10). Rendered with the real
// providers and an injected simulator. The offset value is a SEAM today (`useCameraOffsets` returns no
// record), so the rows must say "Not reported yet" and never a number.
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, screen } from '@testing-library/react-native';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { CameraClockCard } from './camera-clock-card';

describe('CameraClockCard', () => {
  beforeEach(() => resetMissingKeys());
  afterEach(() => {
    cleanup();
    expect(getMissingKeys()).toEqual([]);
  });

  it('one row per configured camera; an unreported offset reads "Not reported yet", never a number', async () => {
    const test = createTestSim();
    expect(test.sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    renderWithRuntime(<CameraClockCard />, { sim: test.sim });
    await flushAsync();
    for (const id of ['CAM-01', 'CAM-02']) {
      const value = screen.getByTestId(`network-time-camera-clock-${id}-value`);
      expect(value).toHaveTextContent('Not reported yet');
      expect(value).not.toHaveTextContent(/\d\s*ms/);
    }
  });

  // Row 138 fix (same cause as `capture-selector.test.tsx`): since row 66 the Core refuses one camera on
  // both tracks with one profile (422), so the scenario is now a legal edit — a camera added later.
  it('follows the selector: after a camera added later (CAM-03) feeds video track 2, the rows are CAM-01 and CAM-03', async () => {
    const test = createTestSim();
    expect(test.sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    renderWithRuntime(<CameraClockCard />, { sim: test.sim });
    await flushAsync();
    act(() => {
      test.sim.actions.registerCaptureDevice({ id: 'CAM-03', model: 'Test source', host: '127.0.0.1', adapter: 'FAKE' });
      expect(test.sim.request({ method: 'POST', path: '/api/v1/capture/cameras/CAM-03/source', body: { trackId: 'VIDEO-02' } }).status).toBe(200);
    });
    await flushAsync();
    expect(screen.getByTestId('network-time-camera-clock-CAM-01')).toBeTruthy();
    expect(screen.getByTestId('network-time-camera-clock-CAM-03')).toBeTruthy();
    expect(screen.queryByTestId('network-time-camera-clock-CAM-02')).toBeNull();
  });
});
