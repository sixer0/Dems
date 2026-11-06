// Audit row 222 (D173; M3-08 domino of row 190): a registered device whose id is a built-in id but which stands on
// ANOTHER device's line (the bench Core's CAM-03 on VIDEO-01) opens ITS OWN details, never the fixed row's built-in
// detail (fixed row CAM-03 = the VIDEO-03 line); on the tablet the highlight follows the selected registered row.
// Domino pins: a built-in on its own line (CAM-01) still opens the built-in detail; an unknown id is not found.
// Real route files (W84's harness), real test simulator. NOT proven here: a real Core (row 66, M3-08 E1).
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { flat } from '@/features/evidence/testing/row-tree';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { recordIdSchema } from '@/navigation/params';
import { registeredSelectionKey } from './registered-device-rows';
import { renderDevicesApp, settle, type DevicesHarness } from './testing/devices-harness';

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

/** The bench shape (row 190): the Core's CAM-03 on VIDEO-01, and CAM-01 moved to VIDEO-03. */
function benchLines(h: DevicesHarness): void {
  act(() =>
    h.sim.store.setState((s) => ({
      captureConfig: {
        ...s.captureConfig,
        cameras: s.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, deviceId: 'CAM-03' } : line.trackId === 'VIDEO-03' ? { ...line, deviceId: 'CAM-01' } : line)),
      },
    })),
  );
}

const host = (testID: string): ReactTestInstance => screen.getAllByTestId(testID, { includeHiddenElements: true }).filter((n) => typeof n.type === 'string')[0]!;
const glow = (testID: string): unknown => flat(host(testID)).opacity;

describe('row 222: the selection key of a registered row', () => {
  it('a built-in id is keyed registered.<id>; any other registered id is its own key; both pass the route schema', () => {
    expect(registeredSelectionKey('CAM-03')).toBe('registered.CAM-03');
    expect(registeredSelectionKey('MIC-04')).toBe('registered.MIC-04');
    expect(registeredSelectionKey('CAM-05')).toBe('CAM-05');
    expect(recordIdSchema.safeParse('registered.CAM-03').success).toBe(true);
  });
});

describe('row 222: a registered device on another line opens its own detail (phone)', () => {
  it('CAM-03 on VIDEO-01: its row opens the registered detail, not the built-in VIDEO-03 detail; fixed row CAM-03 still opens the built-in', async () => {
    const h = renderDevicesApp({ window: 'phonePortrait' });
    await settle();
    benchLines(h);
    await settle();
    fireEvent.press(screen.getByTestId('registered-device-row-CAM-03'));
    await settle();
    expect(h.app.getPathname()).toBe('/devices/registered.CAM-03');
    expect(screen.getByTestId('registered-device-detail')).toBeTruthy();
    expect(screen.getByTestId('registered-detail-facts')).toHaveTextContent(/CAM-03/);
    expect(screen.queryByTestId('device-detail-id')).toBeNull();
    expect(screen.queryByTestId('device-detail-missing')).toBeNull();

    fireEvent.press(screen.getByTestId('device-detail-back'));
    await settle();
    fireEvent.press(screen.getByTestId('device-row-CAM-03'));
    await settle();
    expect(h.app.getPathname()).toBe('/devices/CAM-03');
    expect(screen.getByTestId('device-detail-id')).toHaveTextContent('CAM-03');
    expect(screen.queryByTestId('registered-device-detail')).toBeNull();
  });

  it('domino: CAM-01 on its own line opens the built-in detail', async () => {
    const h = renderDevicesApp({ window: 'phonePortrait' });
    await settle();
    expect(screen.queryByTestId('registered-device-row-CAM-01')).toBeNull();
    fireEvent.press(screen.getByTestId('device-row-CAM-01'));
    await settle();
    expect(h.app.getPathname()).toBe('/devices/CAM-01');
    expect(screen.getByTestId('device-detail-id')).toHaveTextContent('CAM-01');
    expect(screen.queryByTestId('registered-device-detail')).toBeNull();
  });

  it('a registered.<id> key whose device is back on its own line opens the fixed row (drawnByOwnTile)', async () => {
    renderDevicesApp({ window: 'phonePortrait', initialUrl: '/devices/registered.CAM-03' });
    await settle();
    expect(screen.getByTestId('device-detail-id')).toHaveTextContent('CAM-03');
    expect(screen.queryByTestId('registered-device-detail')).toBeNull();
  });

  it.each(['/devices/GNSS-9', '/devices/registered.GNSS-9'])('domino: an unknown id (%s) shows the not-found state', async (url) => {
    renderDevicesApp({ window: 'phonePortrait', initialUrl: url });
    await settle();
    expect(screen.getByTestId('device-detail-missing')).toBeTruthy();
    expect(screen.queryByTestId('registered-device-detail')).toBeNull();
  });
});

describe('row 222: the tablet highlight follows the selected registered device', () => {
  it('landscape: CAM-03 on VIDEO-01 fills the pane with its own detail and only its row is highlighted; the fixed CAM-03 row takes it back', async () => {
    const h = renderDevicesApp({ window: 'tabletLandscape' });
    await settle();
    benchLines(h);
    await settle();
    fireEvent.press(screen.getByTestId('registered-device-row-CAM-03'));
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: 'registered.CAM-03' });
    const pane = within(screen.getByTestId('pane-detail'));
    expect(pane.getByTestId('registered-device-detail')).toBeTruthy();
    expect(pane.queryByTestId('device-detail-id')).toBeNull();
    expect(screen.getByTestId('registered-device-row-CAM-03')).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
    expect(glow('registered-device-glow-CAM-03')).toBe(1);
    expect(glow('device-row-glow-CAM-03')).toBe(0);

    fireEvent.press(screen.getByTestId('device-row-CAM-03'));
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: 'CAM-03' });
    expect(within(screen.getByTestId('pane-detail')).getByTestId('device-detail-id')).toHaveTextContent('CAM-03');
    expect(glow('device-row-glow-CAM-03')).toBe(1);
    expect(glow('registered-device-glow-CAM-03')).toBe(0);
  });

  it('a deep link to /devices/registered.CAM-03 hands over to the pane with the registered detail', async () => {
    const h = renderDevicesApp({ window: 'tabletPortrait' });
    await settle();
    benchLines(h);
    await settle();
    h.navigate('/devices/registered.CAM-03');
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: 'registered.CAM-03' });
    expect(within(screen.getByTestId('pane-detail')).getByTestId('registered-device-detail')).toBeTruthy();
    expect(glow('registered-device-glow-CAM-03')).toBe(1);
    expect(glow('device-row-glow-CAM-03')).toBe(0);
  });
});
