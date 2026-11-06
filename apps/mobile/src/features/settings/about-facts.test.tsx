// Fix wave K, driver M2 - item 5 (the real-capture facts sweep; gate 75c section 4.7: "Tablet
// Settings > About TPM field: not found in two views of the screen - NOT PROVEN").
//
// The About section's identity card on a Core that states `security.platformNotReported`: the TPM
// field reads "Not reported" - never the dataset's model and firmware. SIMULATED is unchanged and
// pinned here. The field is the LAST BUT ONE row of the identity card (below the fold of the tablet):
// the re-check scrolls the About tab to `settings-about-tpm`.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { DEMO_OPERATOR_PASSWORD, DEVICE_ID, PLATFORM_NOT_REPORTED, SOFTWARE_VERSION } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { AboutSection } from './about-section';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}));

const textOf = (testID: string): string => {
  const parts: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(screen.getAllByTestId(testID)[0]!);
  return parts.join(' ');
};
const setWindow = (width: number, height: number) =>
  act(() => {
    Dimensions.set({ window: { width, height, scale: 2, fontScale: 1 }, screen: { width, height, scale: 2, fontScale: 1 } });
  });

beforeEach(async () => {
  await AsyncStorage.clear();
  resetMotionStateForTests();
  resetMissingKeys();
});
afterEach(() => {
  cleanup();
  setWindow(411, 923);
  expect(getMissingKeys()).toEqual([]);
});

describe('Settings > About on a Core that states `security.platformNotReported`', () => {
  const LAYOUTS: { layout: string; width: number; height: number }[] = [
    { layout: 'phone', width: 411, height: 923 },
    { layout: 'tablet', width: 1280, height: 800 },
  ];
  it.each(LAYOUTS)('$layout: the TPM field reads "Not reported"; the simulated device keeps its model and firmware (pinned)', async ({ width, height }) => {
    setWindow(width, height);
    const test = createTestSim();
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const simulated = test.sim.store.getState().device.identity.tpmModelFirmware;
    renderWithRuntime(<AboutSection />, { sim: test.sim });
    await flushAsync();
    // SIMULATED, pinned: the dataset's own value.
    expect(simulated.length).toBeGreaterThan(0);
    expect(textOf('settings-about-identity')).toContain(simulated);
    expect(textOf('settings-about-identity')).not.toContain('Not reported');

    act(() => test.sim.store.setState((s) => ({ security: { ...s.security, ...PLATFORM_NOT_REPORTED } })));
    expect(textOf('settings-about-identity')).toContain('Not reported');
    expect(textOf('settings-about-identity')).not.toContain(simulated);
    expect(textOf('settings-about-identity')).not.toMatch(/TPM 2\.0 \(|fw \d/);
  });
});

// Fix wave J round two (JW-26 mobile half; contract J2-S 2, client rule 3): on a Core in its OWN capture the
// demonstration model's "Software release" / "Device app" versions are versions of nothing real.
describe('Settings > About: the model\'s versions are not shown as versions of a Core in its own capture', () => {
  it('the simulated device keeps "Software release v2.4.1" (pinned); a Core that states its own capture draws neither model version', async () => {
    const test = createTestSim();
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    renderWithRuntime(<AboutSection />, { sim: test.sim });
    await flushAsync();
    expect(textOf('settings-about-product-card')).toContain(`v${SOFTWARE_VERSION}`);
    expect(screen.getByTestId('settings-about-version')).toBeTruthy();

    act(() => test.sim.store.setState((s) => ({ security: { ...s.security, ...PLATFORM_NOT_REPORTED } })));
    expect(screen.queryByTestId('settings-about-version')).toBeNull();
    expect(textOf('settings-about-product-card')).not.toContain(SOFTWARE_VERSION);
    expect(textOf('settings-about-product-card')).not.toMatch(/Software release|Device app/);
  });
});

// Audit M3-10 R1/R2 (row 197; register I4-I7 of masterplan/01_specs_m3.md; D52, D72, D159; web parity row 105 / CS2).
// On a Core in its own capture the About section draws the Core id by the shared S9 reader `reportedCoreDeviceIdOf`
// (the dataset's reserved id DEMS-IR-01 - production `core_device.id` today, D72/D159 - reads "Not reported"), the
// model-only fields read `system.noProducer`, and neither the DEMO chip nor "Synthetic demo values" is drawn.
// The simulated lane (CONTROL) keeps the chip, the description and the dataset's values.
describe('Settings > About on a Core in its own capture: the Core id by I6, model fields by I7, no synthetic chip (M3-10)', () => {
  const MODEL_FIELDS = ['settings-about-product', 'settings-about-room', 'settings-about-serial', 'settings-about-bsp', 'settings-about-provisioning'] as const;
  const signedIn = () => {
    const test = createTestSim();
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    return test;
  };

  it('CONTROL (simulated lane): the DEMO chips, "Synthetic demo values" and the dataset values stay; the id is DEMS-IR-01', async () => {
    const test = signedIn();
    const { device } = test.sim.store.getState();
    renderWithRuntime(<AboutSection />, { sim: test.sim });
    await flushAsync();
    expect(device.id).toBe(DEVICE_ID);
    expect(screen.getByTestId('settings-about-device').props.accessibilityLabel).toBe(`Device ID, ${DEVICE_ID}`);
    expect(screen.getAllByTestId('settings-about-demo')).toHaveLength(2);
    expect(screen.getByText('Synthetic demo values')).toBeTruthy();
    expect(textOf('settings-about-serial')).toContain(device.identity.serialNumber);
    expect(textOf('settings-about-provisioning')).toContain(device.identity.provisioningRecordId);
    for (const testID of MODEL_FIELDS) expect({ testID, text: textOf(testID) }).toEqual({ testID, text: expect.not.stringContaining('Not reported') });
  });

  it('own capture with the reserved id DEMS-IR-01: the id, product, room, serial, BSP and provisioning id read "Not reported"; no chip, no synthetic description', async () => {
    const test = signedIn();
    const { device } = test.sim.store.getState();
    renderWithRuntime(<AboutSection />, { sim: test.sim });
    await flushAsync();
    act(() => test.sim.store.setState((s) => ({ security: { ...s.security, ...PLATFORM_NOT_REPORTED } })));
    expect(test.sim.store.getState().device.id).toBe(DEVICE_ID);
    expect(screen.getByTestId('settings-about-device').props.accessibilityLabel).toBe('Device ID, Not reported');
    expect(textOf('settings-about-identity')).not.toContain(DEVICE_ID);
    for (const testID of MODEL_FIELDS) expect({ testID, text: textOf(testID) }).toEqual({ testID, text: expect.stringContaining('Not reported') });
    for (const value of [device.room, device.identity.serialNumber, device.identity.bspVersion, device.identity.provisioningRecordId]) {
      expect(textOf('settings-about')).not.toContain(value);
    }
    expect(screen.queryByTestId('settings-about-demo')).toBeNull();
    expect(screen.queryByText('Synthetic demo values')).toBeNull();
  });

  it('own capture (host clock) with an installation record DEMS-BENCH-01: that id is shown as it is; still no chip', async () => {
    const test = signedIn();
    renderWithRuntime(<AboutSection />, { sim: test.sim });
    await flushAsync();
    act(() => test.sim.store.setState((s) => ({ device: { ...s.device, id: 'DEMS-BENCH-01' }, time: { ...s.time, hostClock: true } })));
    expect(screen.getByTestId('settings-about-device').props.accessibilityLabel).toBe('Device ID, DEMS-BENCH-01');
    expect(textOf('settings-about-serial')).toContain('Not reported');
    expect(screen.queryByTestId('settings-about-demo')).toBeNull();
    expect(screen.queryByText('Synthetic demo values')).toBeNull();
  });
});
