/**
 * The device selector on the Devices screen (task 3 row 68; ux spec §2 flow 1; checks M4-PC-1 and
 * M4-RG-MOB; the software half of M4-SEL-T / M4-SEL-P). Real route files, real simulator, real
 * providers, as `devices-screen.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { ScenarioName } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { selectionGlowOpacity } from '@/components/composed/selection-glow';
import { renderDevicesApp, settle, type DevicesHarness } from '@/features/devices/testing/devices-harness';
import { refusalCauseOf } from './use-capture-selector';

beforeEach(() => resetMissingKeys());
// MA-21: every string the card renders comes from an i18n key.
afterEach(() => expect(getMissingKeys()).toEqual([]));

// D61 (2026-11-04): the selector holds four camera lines AND FOUR microphone channels - eight edit controls.
const EDIT_IDS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const;
const editDisabled = (id: string) => screen.getByTestId(`capture-selector-edit-${id}`).props.accessibilityState?.disabled === true;
const configAudit = (h: DevicesHarness) => h.sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED');
const glowOpacity = (testID: string) => {
  const style = [screen.getByTestId(testID, { includeHiddenElements: true }).props.style].flat(Infinity) as { opacity?: number }[];
  return style.reduce<number | undefined>((found, part) => part?.opacity ?? found, undefined);
};

describe('rows (ux §2.2 step 2)', () => {
  it('shows four camera rows and four microphone rows from the replicated slices, status as text, no preview', async () => {
    renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    const card = screen.getByTestId('capture-selector');
    expect(within(card).getByText('Capture Sources')).toBeTruthy();
    expect(within(screen.getByTestId('capture-selector-row-VIDEO-01')).getByText('Video track 1')).toBeTruthy();
    expect(screen.getByTestId('capture-selector-detail-VIDEO-01')).toHaveTextContent('CAM-01 · Dual-lens IP camera DL-2');
    expect(screen.getByTestId('capture-selector-detail-VIDEO-02')).toHaveTextContent('CAM-02 · Dual-lens IP camera DL-2');
    expect(screen.getByTestId('capture-selector-stream-VIDEO-01').props.accessibilityLabel).toBe('Live');
    // M3-07 R4 (audit row 189; register T9; D163 - was the D61 channel words): every microphone slot is named
    // "Mic N (Camera N)"; "Transcribed" is the head of Pair 1 (`selector-lines.test.tsx`, row 189 group).
    expect(screen.getByTestId('capture-selector-channel-MIC-01').props.accessibilityLabel).toBe('Mic 1 (Camera 1)');
    expect(screen.getByTestId('capture-selector-channel-MIC-02').props.accessibilityLabel).toBe('Mic 2 (Camera 2)');
    expect(screen.getByTestId('capture-selector-channel-MIC-03').props.accessibilityLabel).toBe('Mic 3 (Camera 3)');
    expect(screen.getByTestId('capture-selector-channel-MIC-04').props.accessibilityLabel).toBe('Mic 4 (Camera 4)');
    // OD-12: the card says so and holds no image.
    expect(screen.getByTestId('capture-selector-no-preview')).toBeTruthy();
    expect(within(card).queryAllByRole('image')).toHaveLength(0);
    // The existing device list is still there.
    expect(screen.getByTestId('devices-section-cameras')).toBeTruthy();
  });

  it('E-15: every row keeps a 1 dp border and an always-mounted glow that React hides while nothing is open', async () => {
    renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    for (const key of ['VIDEO-01', 'VIDEO-02', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) { // D61: four microphone rows
      expect(glowOpacity(`capture-selector-glow-${key}`)).toBe(selectionGlowOpacity(false));
      const style = [screen.getByTestId(`capture-selector-row-${key}`).props.style].flat(Infinity) as { borderWidth?: number }[];
      expect(style.some((part) => part?.borderWidth === 1)).toBe(true);
    }
  });
});

describe('the gate of G1-G3 (ux §2.4, §11; M4-PC-1)', () => {
  // RB revocation (2026-10-29, carried by checkpoint f85e9c01; D60 sweep 2026-11-04): CAPTURE_CONFIG —
  // and every Change control — is the TECHNICIAN's alone; the supervisor keeps the read-only duty.
  it('TECHNICIAN, idle: every Change control is enabled and no gate line is shown', async () => {
    for (const user of ['rina.wijaya'] as const) {
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
    const h = renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    act(() => h.sim.actions.signOut('USER'));
    await settle();
    // The auth gate may take the screen away on sign-out; where the card is still drawn it must be checking.
    const gate = screen.queryByTestId('capture-selector-gate');
    if (gate !== null) {
      expect(gate).toHaveTextContent('Checking your permissions…');
      for (const id of EDIT_IDS) expect(editDisabled(id)).toBe(true);
    }
    expect(h.sim.store.getState().captureConfig.mics.find((mic) => mic.inputId === 'MIC-01')?.channel).toBe('MIC-01'); // D61: the role became the channel
  });

  it('OD-10: while a session is open the selector is locked with the sentence, for a role that may edit', async () => {
    renderDevicesApp({ user: 'rina.wijaya', recording: true });
    await settle();
    expect(screen.getByTestId('capture-selector-locked')).toBeTruthy();
    expect(screen.getByTestId('capture-selector-gate')).toHaveTextContent('The capture configuration cannot be changed while a session is open.');
    for (const id of EDIT_IDS) expect(editDisabled(id)).toBe(true);
  });
});

describe('editing (ux §2.2 steps 4-5; R-1 AC-1, AC-2)', () => {
  it('transcribed channel 1: the sheet lists every registered microphone, Save is disabled until the choice changes, then one audit row and the line takes channel 1 alone (D61)', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    // D61: all four built-ins stand on a channel - an adopted microphone mints above them (MIC-05).
    act(() => h.sim.actions.registerCaptureMicrophone({ deviceId: null, model: 'Test source' }));
    await settle();
    fireEvent.press(screen.getByTestId('capture-selector-edit-MIC-01'));
    await settle();
    expect(screen.getByTestId('capture-source-sheet')).toBeTruthy();
    expect(screen.getByText('Microphone for channel 1')).toBeTruthy();
    // The open field's rows are the selected ones (E-15: an opacity change, nothing mounted).
    expect(glowOpacity('capture-selector-glow-MIC-01')).toBe(selectionGlowOpacity(true));
    expect(glowOpacity('capture-selector-glow-VIDEO-01')).toBe(selectionGlowOpacity(false));
    expect(screen.getByTestId('capture-source-option-MIC-01').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('capture-source-save').props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('capture-source-option-MIC-05'));
    await settle();
    expect(glowOpacity('capture-source-glow-MIC-05')).toBe(selectionGlowOpacity(true));
    expect(glowOpacity('capture-source-glow-MIC-01')).toBe(selectionGlowOpacity(false));
    // A draft changes nothing on the Core.
    expect(configAudit(h)).toHaveLength(0);

    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    expect(configAudit(h)).toHaveLength(1);
    // D61: a line assigns its channel ALONE - channel 1 reads MIC-05, the other channels keep their inputs.
    expect(screen.getByTestId('capture-selector-channel-MIC-05').props.accessibilityLabel).toBe('Mic 1 (Camera 1)'); // T9 (row 189; D163)
    expect(screen.getByTestId('capture-selector-channel-MIC-02').props.accessibilityLabel).toBe('Mic 2 (Camera 2)');
    expect(screen.queryByTestId(/^capture-selector-notice-/)).toBeNull();
  });

  // Row 138 fix. This test used to assign CAM-01 to video track 2 and expect it on the row. Since row 66
  // (D106 (3)) operations 78-80 run the hosted `setCaptureConfig`, whose selector rule refuses ONE camera on
  // BOTH tracks with ONE profile (OD-05; `capture_config` CHECK): the Core answers 422 and changes nothing.
  // The production code was right (the refusal is drawn in place); the test's scenario was not a legal edit.
  // It is now two tests: a legal assignment (a camera added later), and that refusal.
  it('camera source: assigning a camera added later (CAM-05, D60: CAM-03/CAM-04 are built-ins) to video track 2 shows on the row after the republish, one audit row', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window: 'tabletLandscape' });
    await settle();
    // What the web console's "Add as camera" leaves in the registry (operation 96 → `registerCaptureDevice`).
    act(() => h.sim.actions.registerCaptureDevice({ id: 'CAM-05', model: 'Test source', host: '127.0.0.1', adapter: 'FAKE' }));
    await settle();
    fireEvent.press(screen.getByTestId('capture-selector-edit-VIDEO-02'));
    await settle();
    expect(screen.getByText('Camera for Video track 2')).toBeTruthy();
    expect(screen.getByTestId('capture-source-option-CAM-02').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByTestId('capture-source-option-CAM-05'));
    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    // Fix wave L (contract_wave_l.md section 5): `model` of a device with `adapter: 'FAKE'` is a model value and is not drawn.
    expect(screen.getByTestId('capture-selector-detail-VIDEO-02')).toHaveTextContent('CAM-05');
    expect(configAudit(h)).toHaveLength(1);
    expect(h.sim.store.getState().captureConfig.cameras.find((line) => line.trackId === 'VIDEO-02')?.deviceId).toBe('CAM-05');
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
    // Fix wave J (JA2-24): the refusal says WHY (it read "Choice not accepted - Nothing was changed" alone).
    expect(screen.getByTestId('capture-selector-notice-body')).toHaveTextContent(/CAM-01 already feeds Video track 1\. One camera can feed both tracks only with a different profile on each\. Nothing was changed\./);
    expect(screen.getByTestId('capture-selector-detail-VIDEO-02')).toHaveTextContent('CAM-02 · Dual-lens IP camera DL-2');
    expect(configAudit(h)).toHaveLength(0);
    expect(h.sim.store.getState().captureConfig.cameras.find((line) => line.trackId === 'VIDEO-02')?.deviceId).toBe('CAM-02');
  });

  it('§2.2 step 6: a session that opens while the sheet is open — Save is refused as locked, drawn in place, NO audit row', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya' });
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
    // M3-07 (audit row 189; D175): MIC-02 on channel 1 is a SWAP - it is sent only from its confirm.
    expect(configAudit(h)).toHaveLength(0);
    fireEvent.press(screen.getByTestId('selector-mic-swap-confirm-MIC-01'));
    await settle();
    expect(screen.getByTestId('capture-selector-notice-locked')).toHaveTextContent(/The capture configuration cannot be changed while a session is open\./);
    expect(configAudit(h)).toHaveLength(0);
    expect(h.sim.store.getState().captureConfig.mics.find((mic) => mic.inputId === 'MIC-01')?.channel).toBe('MIC-01'); // D61: the role became the channel
  });
});

// ── Fix wave J (judging session; sub-driver J-P3) ─────────────────────────────────────────────────────────
describe('fix wave J - the picker and the selector rows', () => {
  it('JA2-24 `refusalCauseOf`: the camera that feeds the other track is named; else the Core\'s reason; else none', () => {
    const lines = [
      { trackId: 'VIDEO-01', deviceId: 'CAM-01' },
      { trackId: 'VIDEO-02', deviceId: 'CAM-02' },
    ];
    expect(refusalCauseOf({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-02' }, 'invalid', lines, null)).toEqual({ kind: 'cameraOnOtherTrack', deviceId: 'CAM-02', trackId: 'VIDEO-02' });
    expect(refusalCauseOf({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-04' }, 'invalid', lines, 'PROFILE_NOT_SUPPORTED')).toEqual({ kind: 'core', reason: 'PROFILE_NOT_SUPPORTED' });
    expect(refusalCauseOf({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-04' }, 'invalid', lines, null)).toBeNull();
    // Only an `invalid` answer has such a cause: a lock or a denial keeps its own sentence.
    expect(refusalCauseOf({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-02' }, 'locked', lines, null)).toBeNull();
  });

  it.each(['phonePortrait', 'tabletLandscape'] as const)('JA2-24 / JA2-16 on %s: the camera of the other track says "In use by …" BEFORE it is chosen; the radio rows expose their checked state; the sheet is modal; Android Back closes it and stays on Devices', async (window) => {
    const pressBack = captureBack();
    renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    // Nothing is open: the selector consumes no Back.
    expect(pressBack()).toBe(false);
    fireEvent.press(screen.getByTestId('capture-selector-edit-VIDEO-01'));
    await settle();
    expect(screen.getByTestId('capture-source-warning-CAM-02')).toHaveTextContent(/In use by Video track 2\. The Core accepts one camera on both tracks only with a different profile on each/);
    expect(screen.queryByTestId('capture-source-warning-CAM-01')).toBeNull();
    expect(screen.getByTestId('capture-source-option-CAM-02').props.accessibilityHint).toMatch(/In use by Video track 2/);
    expect(screen.getByTestId('capture-source-option-CAM-01').props.accessibilityState).toMatchObject({ checked: true, selected: true });
    expect(screen.getByTestId('capture-source-option-CAM-02').props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByTestId('capture-source-option-CAM-02').props.accessibilityRole).toBe('radio');
    expect(screen.getByTestId('capture-source-sheet').props.accessibilityViewIsModal).toBe(true);
    // Android Back: consumed by the sheet (the screen under it stays), and the sheet closes.
    let consumed = false;
    act(() => {
      consumed = pressBack();
    });
    await settle();
    expect(consumed).toBe(true);
    expect(screen.getByTestId('capture-selector')).toBeTruthy();
    expect(glowOpacity('capture-selector-glow-VIDEO-01')).toBe(selectionGlowOpacity(false));
    jest.restoreAllMocks();
  });

  it('JT-13 / JT-12: a selector row does what its "Change" control does (it is no dead button); for a role that may not change it the row is DISABLED with the role sentence; the track name may take two lines', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    const row = screen.getByTestId('capture-selector-row-VIDEO-02');
    expect(row.props.accessibilityState).toMatchObject({ disabled: false });
    expect(row.props.accessibilityHint).toBe('Change the camera of Video track 2');
    expect(screen.getByTestId('capture-selector-title-VIDEO-02').props.numberOfLines).toBe(2);
    fireEvent.press(row);
    await settle();
    expect(screen.getByTestId('capture-source-sheet')).toBeTruthy();
    expect(screen.getByText('Camera for Video track 2')).toBeTruthy();
    h.app.unmount();

    renderDevicesApp({ user: 'budi.santoso' });
    await settle();
    const locked = screen.getByTestId('capture-selector-row-VIDEO-02');
    expect(locked.props.accessibilityState).toMatchObject({ disabled: true });
    expect(locked.props.accessibilityHint).toBe('Requires the Supervisor or Technician role');
    fireEvent.press(locked);
    await settle();
    expect(screen.queryByTestId('capture-source-sheet')).toBeNull();
  });

  it('JA2-33 / JA2-29: one wording of the picture - "This build shows no live picture of the cameras."; no specification language', async () => {
    renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    expect(screen.getByTestId('capture-selector-no-preview')).toHaveTextContent('Status only. This build shows no live picture of the cameras.');
    expect(screen.queryByText(/this phase|Searching connects to nothing|\(SYS-|§/)).toBeNull();
  });
});

describe('task 4 row 32: one row per slot - an empty slot is drawn "Not assigned" with the offer to assign (decision C18 (3); D61 of 2026-11-04: eight slots - four camera tracks and four microphone channels)', () => {
  const SLOT_NAME = { 'VIDEO-01': 'Camera 1', 'VIDEO-02': 'Camera 2', 'VIDEO-03': 'Camera 3', 'VIDEO-04': 'Camera 4', 'MIC-01': 'Microphone 1', 'MIC-02': 'Microphone 2', 'MIC-03': 'Microphone 3', 'MIC-04': 'Microphone 4' } as const;
  /** The selector with only the lines named: the registry keeps every device, so the slots can be assigned. */
  function keepLines(h: DevicesHarness, tracks: readonly string[], channels: readonly string[]) {
    act(() =>
      h.sim.store.setState((s) => ({
        captureConfig: { ...s.captureConfig, cameras: s.captureConfig.cameras.filter((line) => tracks.includes(line.trackId)), mics: s.captureConfig.mics.filter((line) => channels.includes(line.channel)) },
      })),
    );
  }
  function expectEmptySlot(slot: keyof typeof SLOT_NAME) {
    expect(screen.getByTestId(`capture-selector-detail-${slot}`)).toHaveTextContent('Not assigned');
    const control = screen.getByTestId(`capture-selector-edit-${slot}`);
    expect(within(control).getByText('Assign')).toBeTruthy();
    expect(control.props.accessibilityLabel).toBe(`Assign a source to ${SLOT_NAME[slot]}`);
    // The row is the same target as its control (JT-13), and no badge of a device is drawn for it.
    expect(screen.getByTestId(`capture-selector-row-${slot}`).props.accessibilityHint).toBe(`Assign a source to ${SLOT_NAME[slot]}`);
    expect(screen.queryByTestId(`capture-selector-source-${slot}`)).toBeNull();
  }
  const rowCount = () => screen.getAllByTestId(/^capture-selector-row-(?!wrap-)/).length;

  it.each(['phonePortrait', 'tabletLandscape'] as const)('%s, 0 lines of each kind: eight rows, each "Not assigned" with "Assign"; not the empty state', async (window) => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    keepLines(h, [], []);
    await settle();
    expect(screen.queryByTestId('capture-selector-empty')).toBeNull();
    expect(rowCount()).toBe(8); // D61: four camera tracks and four microphone channels
    for (const slot of ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const) {
      expectEmptySlot(slot);
      expect(editDisabled(slot)).toBe(false);
    }
    expect(within(screen.getByTestId('capture-selector-row-VIDEO-02')).getByText('Video track 2')).toBeTruthy();
    expect(within(screen.getByTestId('capture-selector-row-MIC-01')).getByText('Microphone 1')).toBeTruthy(); // D61: the empty channel is named by its slot
    // No stream word is said of a track without a camera.
    expect(screen.queryByTestId('capture-selector-stream-VIDEO-01')).toBeNull();
    h.app.unmount();
  });

  it('1 line of each kind: eight rows - the held slots as before, the six empty ones with their offer', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    keepLines(h, ['VIDEO-01'], ['MIC-02']);
    await settle();
    expect(rowCount()).toBe(8);
    expect(screen.getByTestId('capture-selector-detail-VIDEO-01')).toHaveTextContent('CAM-01 · Dual-lens IP camera DL-2');
    expect(within(screen.getByTestId('capture-selector-edit-VIDEO-01')).getByText('Change')).toBeTruthy();
    for (const slot of ['VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-03', 'MIC-04'] as const) expectEmptySlot(slot);
    // A lone channel-2 line is the channel-2 row; the transcribed row is the empty one (found by CHANNEL, never by place; D61).
    expect(screen.getByTestId('capture-selector-channel-MIC-02').props.accessibilityLabel).toBe('Mic 2 (Camera 2)'); // T9 (row 189; D163)
    expect(within(screen.getByTestId('capture-selector-edit-MIC-02')).getByText('Change')).toBeTruthy();
    h.app.unmount();
  });

  it('4 lines of each kind (the seeded selector): eight rows, no "Assign", no "Not assigned" - as before (D61)', async () => {
    renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    expect(rowCount()).toBe(8); // D61: the seeded selector holds all eight slots
    for (const id of EDIT_IDS) expect(within(screen.getByTestId(`capture-selector-edit-${id}`)).getByText('Change')).toBeTruthy();
    const card = screen.getByTestId('capture-selector');
    expect(within(card).queryByText('Assign')).toBeNull();
    expect(within(card).queryByText('Not assigned')).toBeNull();
  });

  it('the offer opens the sheet of the slot with nothing chosen; a choice builds a command (Save is enabled)', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya' });
    await settle();
    keepLines(h, [], []);
    await settle();
    fireEvent.press(screen.getByTestId('capture-selector-edit-MIC-02')); // D61: the standby offer is the channel-2 slot
    await settle();
    expect(screen.getByTestId('capture-source-sheet')).toBeTruthy();
    for (const id of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) expect(screen.getByTestId(`capture-source-option-${id}`).props.accessibilityState).toMatchObject({ selected: false, disabled: false });
    expect(screen.getByTestId('capture-source-save').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('capture-source-option-MIC-02'));
    await settle();
    expect(screen.getByTestId('capture-source-save').props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(screen.getByTestId('capture-source-cancel'));
    await settle();

    fireEvent.press(screen.getByTestId('capture-selector-row-VIDEO-01'));
    await settle();
    expect(screen.getByText('Camera for Video track 1')).toBeTruthy();
    expect(screen.getByTestId('capture-source-option-CAM-01').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId('capture-source-save').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('capture-source-option-CAM-01'));
    await settle();
    expect(screen.getByTestId('capture-source-save').props.accessibilityState?.disabled).toBe(false);
    h.app.unmount();
  });

  it('the gate holds for the offer: INVESTIGATOR sees the eight rows, each "Assign" disabled with the role sentence', async () => {
    const h = renderDevicesApp({ user: 'budi.santoso' });
    await settle();
    keepLines(h, [], []);
    await settle();
    for (const slot of ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const) {
      expect(editDisabled(slot)).toBe(true);
      expect(screen.getByTestId(`capture-selector-edit-${slot}`).props.accessibilityHint).toBe('Requires the Supervisor or Technician role');
    }
    fireEvent.press(screen.getByTestId('capture-selector-edit-MIC-01')); // D61: the former PRIMARY offer is the channel-1 slot
    await settle();
    expect(screen.queryByTestId('capture-source-sheet')).toBeNull();
    h.app.unmount();
  });
});

/** Captures the hardware-Back listeners (Android's BackHandler) so a test can press Back; newest first, true = consumed. */
type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
function captureBack(): () => boolean {
  const listeners: BackListener[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    listeners.push(handler);
    return { remove: () => void listeners.splice(listeners.indexOf(handler), 1) };
  });
  return () => [...listeners].reverse().some((listener) => (listener as unknown as () => boolean | null | undefined)() === true);
}
