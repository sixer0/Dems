/**
 * The device selector on the Devices screen (task 3 row 68; ux spec §2 flow 1; checks M4-PC-1 and
 * M4-RG-MOB; the software half of M4-SEL-T / M4-SEL-P). Real route files, real simulator, real
 * providers, as `devices-screen.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { ScenarioName } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { selectionGlowOpacity } from '@/components/composed/selection-glow';
import { renderDevicesApp, settle, type DevicesHarness } from '@/features/devices/testing/devices-harness';

beforeEach(() => resetMissingKeys());
// MA-21: every string the card renders comes from an i18n key.
afterEach(() => expect(getMissingKeys()).toEqual([]));

const EDIT_IDS = ['VIDEO-01', 'VIDEO-02', 'MIC-01', 'MIC-02'] as const;
const editDisabled = (id: string) => screen.getByTestId(`capture-selector-edit-${id}`).props.accessibilityState?.disabled === true;
const configAudit = (h: DevicesHarness) => h.sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED');
const glowOpacity = (testID: string) => {
  const style = [screen.getByTestId(testID, { includeHiddenElements: true }).props.style].flat(Infinity) as { opacity?: number }[];
  return style.reduce<number | undefined>((found, part) => part?.opacity ?? found, undefined);
};

describe('rows (ux §2.2 step 2)', () => {
  it('shows two camera rows and two microphone rows from the replicated slices, status as text, no preview', async () => {
    renderDevicesApp({ user: 'andi.pratama' });
    await settle();
    const card = screen.getByTestId('capture-selector');
    expect(within(card).getByText('Capture Sources')).toBeTruthy();
    expect(within(screen.getByTestId('capture-selector-row-VIDEO-01')).getByText('Video track 1')).toBeTruthy();
    expect(screen.getByTestId('capture-selector-detail-VIDEO-01')).toHaveTextContent('CAM-01 · Dual-lens IP camera DL-2');
    expect(screen.getByTestId('capture-selector-detail-VIDEO-02')).toHaveTextContent('CAM-02 · Dual-lens IP camera DL-2');
    expect(screen.getByTestId('capture-selector-stream-VIDEO-01').props.accessibilityLabel).toBe('Live');
    expect(screen.getByTestId('capture-selector-role-MIC-01').props.accessibilityLabel).toBe('Primary');
    expect(screen.getByTestId('capture-selector-role-MIC-02').props.accessibilityLabel).toBe('Standby');
    // OD-12: the card says so and holds no image.
    expect(screen.getByTestId('capture-selector-no-preview')).toBeTruthy();
    expect(within(card).queryAllByRole('image')).toHaveLength(0);
    // The existing device list is still there.
    expect(screen.getByTestId('devices-section-cameras')).toBeTruthy();
  });

  it('E-15: every row keeps a 1 dp border and an always-mounted glow that React hides while nothing is open', async () => {
    renderDevicesApp({ user: 'andi.pratama' });
    await settle();
    for (const key of ['VIDEO-01', 'VIDEO-02', 'MIC-01', 'MIC-02']) {
      expect(glowOpacity(`capture-selector-glow-${key}`)).toBe(selectionGlowOpacity(false));
      const style = [screen.getByTestId(`capture-selector-row-${key}`).props.style].flat(Infinity) as { borderWidth?: number }[];
      expect(style.some((part) => part?.borderWidth === 1)).toBe(true);
    }
  });
});

describe('the gate of G1-G3 (ux §2.4, §11; M4-PC-1)', () => {
  it('SUPERVISOR and TECHNICIAN, idle: every Change control is enabled and no gate line is shown', async () => {
    for (const user of ['andi.pratama', 'rina.wijaya'] as const) {
      const h = renderDevicesApp({ user });
      await settle();
      for (const id of EDIT_IDS) expect(editDisabled(id)).toBe(false);
      expect(screen.queryByTestId('capture-selector-gate')).toBeNull();
      h.app.unmount();
    }
  });

  it('INVESTIGATOR: the controls stay in place, disabled, with the two-role sentence; a press opens nothing', async () => {
    renderDevicesApp({ user: 'budi.santoso' });
    await settle();
    for (const id of EDIT_IDS) {
      const control = screen.getByTestId(`capture-selector-edit-${id}`);
      expect(editDisabled(id)).toBe(true);
      expect(control.props.accessibilityHint).toBe('Requires the Supervisor or Technician role');
    }
    expect(screen.getByTestId('capture-selector-gate')).toHaveTextContent('Requires the Supervisor or Technician role');
    fireEvent.press(screen.getByTestId('capture-selector-edit-MIC-01'));
    await settle();
    expect(screen.queryByTestId('capture-source-sheet')).toBeNull();
  });

  it('an unknown role reads "Checking your permissions…": disabled, never the role sentence, never enabled', async () => {
    const h = renderDevicesApp({ user: 'andi.pratama' });
    await settle();
    act(() => h.sim.actions.signOut('USER'));
    await settle();
    // The auth gate may take the screen away on sign-out; where the card is still drawn it must be checking.
    const gate = screen.queryByTestId('capture-selector-gate');
    if (gate !== null) {
      expect(gate).toHaveTextContent('Checking your permissions…');
      for (const id of EDIT_IDS) expect(editDisabled(id)).toBe(true);
    }
    expect(h.sim.store.getState().captureConfig.mics.find((mic) => mic.inputId === 'MIC-01')?.role).toBe('PRIMARY');
  });

  it('OD-10: while a session is open the selector is locked with the sentence, for a role that may edit', async () => {
    renderDevicesApp({ user: 'andi.pratama', recording: true });
    await settle();
    expect(screen.getByTestId('capture-selector-locked')).toBeTruthy();
    expect(screen.getByTestId('capture-selector-gate')).toHaveTextContent('The capture configuration cannot be changed while a session is open.');
    for (const id of EDIT_IDS) expect(editDisabled(id)).toBe(true);
  });
});

describe('editing (ux §2.2 steps 4-5; R-1 AC-1, AC-2)', () => {
  it('primary microphone: the sheet lists both inputs, Save is disabled until the choice changes, then one audit row and the roles swap', async () => {
    const h = renderDevicesApp({ user: 'andi.pratama' });
    await settle();
    fireEvent.press(screen.getByTestId('capture-selector-edit-MIC-01'));
    await settle();
    expect(screen.getByTestId('capture-source-sheet')).toBeTruthy();
    expect(screen.getByText('Primary microphone')).toBeTruthy();
    // The open field's rows are the selected ones (E-15: an opacity change, nothing mounted).
    expect(glowOpacity('capture-selector-glow-MIC-01')).toBe(selectionGlowOpacity(true));
    expect(glowOpacity('capture-selector-glow-VIDEO-01')).toBe(selectionGlowOpacity(false));
    expect(screen.getByTestId('capture-source-option-MIC-01').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('capture-source-save').props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('capture-source-option-MIC-02'));
    await settle();
    expect(glowOpacity('capture-source-glow-MIC-02')).toBe(selectionGlowOpacity(true));
    expect(glowOpacity('capture-source-glow-MIC-01')).toBe(selectionGlowOpacity(false));
    // A draft changes nothing on the Core.
    expect(configAudit(h)).toHaveLength(0);

    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    expect(configAudit(h)).toHaveLength(1);
    expect(screen.getByTestId('capture-selector-role-MIC-02').props.accessibilityLabel).toBe('Primary');
    expect(screen.getByTestId('capture-selector-role-MIC-01').props.accessibilityLabel).toBe('Standby');
    expect(screen.queryByTestId(/^capture-selector-notice-/)).toBeNull();
  });

  // Row 138 fix. This test used to assign CAM-01 to video track 2 and expect it on the row. Since row 66
  // (D106 (3)) operations 78-80 run the hosted `setCaptureConfig`, whose selector rule refuses ONE camera on
  // BOTH tracks with ONE profile (OD-05; `capture_config` CHECK): the Core answers 422 and changes nothing.
  // The production code was right (the refusal is drawn in place); the test's scenario was not a legal edit.
  // It is now two tests: a legal assignment (a camera added later), and that refusal.
  it('camera source: assigning a camera added later (CAM-03) to video track 2 shows on the row after the republish, one audit row', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window: 'tabletLandscape' });
    await settle();
    // What the web console's "Add as camera" leaves in the registry (operation 96 → `registerCaptureDevice`).
    act(() => h.sim.actions.registerCaptureDevice({ id: 'CAM-03', model: 'Test source', host: '127.0.0.1', adapter: 'FAKE' }));
    await settle();
    fireEvent.press(screen.getByTestId('capture-selector-edit-VIDEO-02'));
    await settle();
    expect(screen.getByText('Camera for Video track 2')).toBeTruthy();
    expect(screen.getByTestId('capture-source-option-CAM-02').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByTestId('capture-source-option-CAM-03'));
    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    // Fix wave L (contract_wave_l.md section 5): `model` of a device with `adapter: 'FAKE'` is a model value and is not drawn.
    expect(screen.getByTestId('capture-selector-detail-VIDEO-02')).toHaveTextContent('CAM-03');
    expect(configAudit(h)).toHaveLength(1);
    expect(h.sim.store.getState().captureConfig.cameras.find((line) => line.trackId === 'VIDEO-02')?.deviceId).toBe('CAM-03');
    expect(screen.queryByTestId(/^capture-selector-notice-/)).toBeNull();
  });

  it('camera source: one camera on both tracks with one profile is refused by the Core (422) — drawn in place, NO audit row, nothing changed', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window: 'tabletLandscape' });
    await settle();
    fireEvent.press(screen.getByTestId('capture-selector-edit-VIDEO-02'));
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-option-CAM-01'));
    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    expect(screen.getByTestId('capture-selector-notice-invalid')).toHaveTextContent(/The Core did not accept this choice\. Nothing was changed\./);
    expect(screen.getByTestId('capture-selector-detail-VIDEO-02')).toHaveTextContent('CAM-02 · Dual-lens IP camera DL-2');
    expect(configAudit(h)).toHaveLength(0);
    expect(h.sim.store.getState().captureConfig.cameras.find((line) => line.trackId === 'VIDEO-02')?.deviceId).toBe('CAM-02');
  });

  it('§2.2 step 6: a session that opens while the sheet is open — Save is refused as locked, drawn in place, NO audit row', async () => {
    const h = renderDevicesApp({ user: 'andi.pratama' });
    await settle();
    fireEvent.press(screen.getByTestId('capture-selector-edit-MIC-01'));
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-option-MIC-02'));
    await settle();
    // The Core's state moves under the open sheet: a session opens (another console started it).
    act(() => h.sim.actions.loadScenario(ScenarioName.RECORDING));
    await settle();
    expect(h.sim.store.getState().session).not.toBeNull();
    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    expect(screen.getByTestId('capture-selector-notice-locked')).toHaveTextContent(/The capture configuration cannot be changed while a session is open\./);
    expect(configAudit(h)).toHaveLength(0);
    expect(h.sim.store.getState().captureConfig.mics.find((mic) => mic.inputId === 'MIC-01')?.role).toBe('PRIMARY');
  });
});
