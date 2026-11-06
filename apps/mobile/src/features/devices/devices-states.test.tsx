// E-fix row FX-M2, defect E2E-T-2 (decision D200/D201): the tablet's Devices pane stayed blank for more
// than 4 minutes once (after Evidence detail -> More menu -> rail Devices, host load 23). Whatever the
// cause outside this screen, the screen itself must always show loading, data or an error with a Retry.
// Held here through the REAL devices route files (W84's harness):
// - loading: until the runtime has hydrated, the header and the skeleton (never an empty pane);
// - data: the three sections from the store, at once (no request, no query, no suspense, no focus effect);
// - error: a render failure in the list or in the detail pane is the panel card with a rate-limited
//   Retry (3 s cooldown with a countdown), written to the persistent runtime log; Retry brings the data back.
//
// Import order: the devices setup, then the router harness, then the harness.
import './testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { RuntimeContractProvider, createRuntimeContract, runtimeLog } from '@/runtime';
import { createTestSim, renderWithRuntime } from '@/runtime/testing/test-sim';
import { DevicesScreen } from './devices-screen';
import { renderDevicesApp, settle } from './testing/devices-harness';

/** Rows throw while this is set (a render failure inside the list). */
const mockFailure = { rows: false, detail: false };

jest.mock('./device-row', () => {
  const actual = jest.requireActual<typeof import('./device-row')>('./device-row');
  return {
    ...actual,
    DeviceRow: (props: ComponentProps<typeof actual.DeviceRow>) => {
      if (mockFailure.rows) throw new Error('E2E-T-2 test: a row failed to render');
      return <actual.DeviceRow {...props} />;
    },
  };
});

jest.mock('./device-detail', () => {
  const actual = jest.requireActual<typeof import('./device-detail')>('./device-detail');
  return {
    ...actual,
    DeviceDetail: (props: ComponentProps<typeof actual.DeviceDetail>) => {
      if (mockFailure.detail) throw new Error('E2E-T-2 test: the detail failed to render');
      return <actual.DeviceDetail {...props} />;
    },
  };
});

const panelLogs = (name: string): number => runtimeLog.records().filter((record) => record.source === `devices.panel.${name}`).length;

beforeEach(() => {
  resetMissingKeys();
  mockFailure.rows = false;
  mockFailure.detail = false;
  // React reports a caught render error on the console; the boundary's own record is what is checked.
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  expect(getMissingKeys()).toEqual([]);
});

describe('E2E-T-2: Devices always shows loading, data or an error with a Retry', () => {
  it('loading: before the runtime has hydrated, the header and the skeleton (the pane is never empty)', async () => {
    // The screen itself under a runtime that is not ready yet (the hydration gate, 04 §5.2).
    const test = createTestSim();
    const notReady = createRuntimeContract();
    renderWithRuntime(
      <RuntimeContractProvider value={{ ...notReady, status: { ...notReady.status, ready: false } }}>
        <DevicesScreen selectedId={null} />
      </RuntimeContractProvider>,
      { sim: test.sim },
    );
    await settle();
    expect(screen.getByTestId('screen-devices')).toBeTruthy();
    // The kit's SkeletonGroup hands its testID to its parts as well.
    expect(screen.getAllByTestId('devices-loading').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('devices-scroll')).toBeNull();
  });

  it('data: the three sections at once from the store; no request is involved', async () => {
    renderDevicesApp();
    await settle();
    expect(screen.getByTestId('screen-devices')).toBeTruthy();
    for (const section of ['cameras', 'audio', 'other']) expect(screen.getByTestId(`devices-section-${section}`)).toBeTruthy();
    expect(screen.queryByTestId('devices-panel-error-list')).toBeNull();
  });

  it('error in the list: the panel card with Retry, logged; a Retry that fails again is rate-limited (3 s countdown); one that works brings the data back', async () => {
    const before = panelLogs('list');
    mockFailure.rows = true;
    renderDevicesApp();
    await settle();
    expect(screen.getByTestId('screen-devices')).toBeTruthy();
    const card = screen.getByTestId('devices-panel-error-list');
    expect(within(card).getByText('This panel could not be displayed')).toBeTruthy();
    expect(within(card).getByText('Retry')).toBeTruthy();
    expect(panelLogs('list') - before).toBeGreaterThanOrEqual(1);

    // Retry while the failure persists: the card again, Retry disabled with its countdown.
    fireEvent.press(screen.getByTestId('devices-panel-retry-list'));
    await settle();
    expect(screen.getByTestId('devices-panel-error-list')).toBeTruthy();
    expect(screen.getByTestId('devices-panel-retry-list').props.accessibilityState?.disabled).toBe(true);
    expect(within(screen.getByTestId('devices-panel-error-list')).getByText('Retry in 3s')).toBeTruthy();

    // The cooldown runs out (real timers, 3 s), the failure is gone: Retry shows the data.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3_100));
    });
    mockFailure.rows = false;
    expect(screen.getByTestId('devices-panel-retry-list').props.accessibilityState?.disabled).not.toBe(true);
    fireEvent.press(screen.getByTestId('devices-panel-retry-list'));
    await settle();
    expect(screen.queryByTestId('devices-panel-error-list')).toBeNull();
    expect(screen.getByTestId('devices-section-cameras')).toBeTruthy();
  }, 15_000);

  it('error in the tablet detail pane: the list stays; the pane shows the card with Retry', async () => {
    mockFailure.detail = true;
    renderDevicesApp({ window: 'tabletLandscape', initialUrl: '/devices?selected=CAM-01' });
    await settle();
    expect(screen.getByTestId('devices-section-cameras')).toBeTruthy();
    expect(screen.getByTestId('devices-panel-error-detail')).toBeTruthy();
    mockFailure.detail = false;
    fireEvent.press(screen.getByTestId('devices-panel-retry-detail'));
    await settle();
    expect(screen.queryByTestId('devices-panel-error-detail')).toBeNull();
    expect(screen.getByTestId('device-detail-id')).toHaveTextContent('CAM-01');
  });
});
