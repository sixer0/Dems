// Settings → Capture (task 3 row 68; register MB-09; ux spec §2.6). The section screen inside the real
// AppProviders with an injected simulator, as `settings-screen.test.tsx` mounts the other sections.
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, screen } from '@testing-library/react-native';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { parseSettingsSection } from '@/navigation/params';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { SECTION_TITLE_KEYS, SETTINGS_ROWS } from '@/features/settings/settings-model';
import { SettingsSectionScreen } from '@/features/settings/settings-section-screen';

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock'),
}));

const mockRouter = { push: jest.fn(), setParams: jest.fn(), back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => true,
}));
const mockOpenTabRoot = jest.fn();
jest.mock('@/navigation/tab-root', () => ({
  useOpenTabRoot: () => mockOpenTabRoot,
}));

async function mount(username: string): Promise<TestSim> {
  const test = createTestSim();
  expect(test.sim.actions.signIn(username, DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  renderWithRuntime(<SettingsSectionScreen section="capture" />, { sim: test.sim });
  await flushAsync();
  return test;
}

describe('Settings → Capture', () => {
  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  beforeEach(() => {
    resetMissingKeys();
    mockOpenTabRoot.mockClear();
  });
  afterEach(() => {
    cleanup();
    expect(getMissingKeys()).toEqual([]);
  });

  it('is a Settings section of its own: a route value, a row in the System group and a title', () => {
    expect(parseSettingsSection('capture')).toBe('capture');
    expect(parseSettingsSection('capture-devices')).toBeNull();
    const row = SETTINGS_ROWS.find((candidate) => candidate.id === 'capture');
    expect(row).toMatchObject({ group: 'system', target: { kind: 'section', section: 'capture' } });
    expect(SECTION_TITLE_KEYS.capture).toBe('features.capture-selector.settings.title');
  });

  it('holds the device selector: the four rows, editable for a SUPERVISOR', async () => {
    await mount('andi.pratama');
    expect(screen.getByTestId('settings-section-capture')).toBeTruthy();
    expect(screen.getByTestId('settings-capture-selector')).toBeTruthy();
    for (const key of ['VIDEO-01', 'VIDEO-02', 'MIC-01', 'MIC-02']) {
      expect(screen.getByTestId(`capture-selector-row-${key}`)).toBeTruthy();
      expect(screen.getByTestId(`capture-selector-edit-${key}`).props.accessibilityState?.disabled).not.toBe(true);
    }
    expect(screen.queryByTestId('capture-selector-gate')).toBeNull();
  });

  it('an INVESTIGATOR sees the same rows read-only, with the role sentence', async () => {
    await mount('budi.santoso');
    expect(screen.getByTestId('capture-selector-gate')).toHaveTextContent('Requires the Supervisor or Technician role');
    expect(screen.getByTestId('capture-selector-edit-VIDEO-01').props.accessibilityState?.disabled).toBe(true);
  });

  it('the Devices row opens the Devices tab at its root', async () => {
    await mount('andi.pratama');
    fireEvent.press(screen.getByTestId('settings-capture-open-devices'));
    expect(mockOpenTabRoot).toHaveBeenCalledWith('/devices');
  });
  // Task 3 row 138 (ux §8c.1 "Entry points"): an entry row, not a second implementation.
  it('row 138: "Search for cameras" opens Devices, where the search panel is; the press itself starts no search', async () => {
    const test = await mount('andi.pratama');
    const row = screen.getByTestId('settings-capture-open-search');
    expect(row).toHaveTextContent(/Search for cameras/);
    fireEvent.press(row);
    expect(mockOpenTabRoot).toHaveBeenCalledWith('/devices');
    expect(test.sim.store.getState().audit.rows.filter((entry) => entry.type === 'CAPTURE_DISCOVERY_SEARCHED')).toHaveLength(0);
    // No search panel and no text field on this surface; the microphone re-read is offered with the selector.
    expect(screen.queryByTestId('camera-search')).toBeNull();
    expect(screen.getByTestId('capture-selector-mic-rescan-action')).toBeTruthy();
  });
});
