// Backend task, plan row W82: Settings in LIVE mode — settle site S2-7 (`useCoreCommand`, the callback
// form of B-10: Run diagnostics, operation 65; Install update, 67; the Demo controls, 73, 74, 52, 72, 33)
// and S5-7 (the role's permission list in the Profile sheet), each with its success, its refusal (a 403:
// the denied toast, AC-C-48, by the `notPermitted` example where the operation has one), an outage and,
// where the Core has them, its 409 and DEMO_DISABLED answers; the Demo controls only with DEMO_CONTROL and
// the Core's demo flag (AC-C-52); StrictMode sends nothing at mount (D158). All on the app's real Live
// source over the contract-checked fake transport.
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/settings-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { rateLimited } from '@dems/shared/live/testing';
import { FaultKind, ROLE_PERMISSIONS, ScenarioName } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { notPermitted, renderLiveSettings, resetLiveSettingsBed, type LiveSettingsBed, type LiveSettingsBedOptions } from './testing/live-settings-bed';

let bed: LiveSettingsBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveSettingsBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  // MA-21: every string the screens render comes from an i18n key, in LIVE mode as well.
  expect(getMissingKeys()).toEqual([]);
});

const DENIED = 'Not permitted';
const OFFLINE = 'Core server unreachable';
const OFFLINE_HINT = 'Nothing was changed.';
const isBusy = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.busy === true;
const shown = (text: string | RegExp) => screen.queryAllByText(text).length > 0;
/** No text on screen says "simulated" (rule 8, MD-8: a screen with the Core's data says nothing about a simulation). */
const saysSimulated = () => screen.queryAllByText(/simulat/i).length > 0;

async function openSection(section: 'maintenance' | 'security' | 'preferences', options: LiveSettingsBedOptions = {}): Promise<LiveSettingsBed> {
  const b = await renderLiveSettings(options);
  bed = b;
  await b.open(`/settings/${section}`);
  expect(b.app.getPathname()).toBe(`/settings/${section}`);
  expect(screen.getByTestId(`settings-${section}`)).toBeTruthy();
  return b;
}

async function press(testID: string, b: LiveSettingsBed): Promise<void> {
  fireEvent.press(screen.getByTestId(testID));
  await b.flush();
}

async function openDemo(b: LiveSettingsBed): Promise<void> {
  await press('settings-demo-trigger', b);
  expect(screen.getByTestId('settings-demo-body')).toBeTruthy();
}

describe('S2-7: Run diagnostics (operation 65)', () => {
  it('success: the sheet opens only after the Core accepted the run; busy at once, spinner late (LB-1); one request; the Core\'s words', async () => {
    const b = await openSection('maintenance', { answerDelayMs: 2_000 });
    expect(screen.getByText('Eight health checks on the Core server, one after another.')).toBeTruthy();
    expect(saysSimulated()).toBe(false);
    await press('settings-run-diagnostics', b);
    expect(b.requests('runDiagnostics')).toHaveLength(1);
    expect(isBusy('settings-run-diagnostics')).toBe(true);
    expect(screen.queryByTestId('settings-run-diagnostics-spinner')).toBeNull();
    expect(screen.queryByTestId('settings-diagnostics-sheet')).toBeNull();
    // A second press while the first is out sends nothing.
    await press('settings-run-diagnostics', b);
    expect(b.requests('runDiagnostics')).toHaveLength(1);
    await b.elapse(300);
    expect(screen.queryByTestId('settings-run-diagnostics-spinner')).toBeNull();
    await b.elapse(300);
    expect(screen.getByTestId('settings-run-diagnostics-spinner')).toBeTruthy();
    expect(screen.queryByTestId('settings-diagnostics-sheet')).toBeNull();
    await b.elapse(1_600);
    await b.flush();
    expect(screen.getByTestId('settings-diagnostics-sheet')).toBeTruthy();
    expect(screen.getByTestId('settings-diagnostics-headline')).toHaveTextContent(/of 8 checks/);
    expect(isBusy('settings-run-diagnostics')).toBe(false);
    expect(screen.queryByTestId('settings-run-diagnostics-spinner')).toBeNull();
    expect(b.state().diagnostics?.checks).toHaveLength(8);
    expect(saysSimulated()).toBe(false);
  });

  it('refusal: a 403 NOT_PERMITTED is the denied toast; the sheet stays closed and the button is released', async () => {
    const b = await openSection('maintenance');
    b.fake.answerOnce('runDiagnostics', notPermitted('runDiagnostics', 'DIAGNOSTICS_RUN', 'SUPERVISOR'));
    await press('settings-run-diagnostics', b);
    await b.elapse(200);
    expect(shown(DENIED)).toBe(true);
    expect(screen.queryByTestId('settings-diagnostics-sheet')).toBeNull();
    expect(isBusy('settings-run-diagnostics')).toBe(false);
    expect(b.requests('runDiagnostics')).toHaveLength(1);
  });

  it('outage: "Core server unreachable" with "Nothing was changed."; the sheet stays closed; no automatic retry (LB-6)', async () => {
    const b = await openSection('maintenance');
    b.fake.failOnce('runDiagnostics');
    await press('settings-run-diagnostics', b);
    await b.elapse(200);
    expect(shown(OFFLINE)).toBe(true);
    expect(shown(OFFLINE_HINT)).toBe(true);
    expect(screen.queryByTestId('settings-diagnostics-sheet')).toBeNull();
    expect(isBusy('settings-run-diagnostics')).toBe(false);
    await b.elapse(3_000);
    expect(b.requests('runDiagnostics')).toHaveLength(1);
  });

  it('a limit (429) is worded as a limit, never as an outage (LB-10)', async () => {
    const b = await openSection('maintenance');
    b.fake.answerOnce('runDiagnostics', rateLimited(12));
    await press('settings-run-diagnostics', b);
    await b.elapse(200);
    expect(shown('The Core server is limiting requests from this tablet')).toBe(true);
    expect(shown('Try again in 12 s.')).toBe(true);
    expect(shown(OFFLINE)).toBe(false);
    expect(screen.queryByTestId('settings-diagnostics-sheet')).toBeNull();
  });
});

describe('S2-7: Install update (operation 67)', () => {
  it('success (TECHNICIAN, MAINTENANCE): the started toast only after the Core\'s 202; DEMO chip and the Core\'s words', async () => {
    const b = await openSection('maintenance', { user: 'rina.wijaya', answerDelayMs: 1_000 });
    expect(within(screen.getByTestId('settings-update-chip')).getByText('DEMO')).toBeTruthy();
    expect(screen.getByTestId('settings-update-live-note')).toHaveTextContent('The Core server runs a demonstration update: no software is installed.');
    expect(within(screen.getByTestId('settings-update-install')).getByText('Install update')).toBeTruthy();
    expect(saysSimulated()).toBe(false);
    await press('settings-update-install', b);
    expect(isBusy('settings-update-install')).toBe(true);
    expect(shown(/^Installing v/)).toBe(false);
    await b.elapse(1_200);
    expect(b.requests('startSoftwareUpdate')).toHaveLength(1);
    expect(shown(/^Installing v\d+\.\d+\.\d+$/)).toBe(true);
    expect(b.state().update.state).toBe('RUNNING');
    expect(saysSimulated()).toBe(false);
  });

  it('R2 (E-fix FX-M2, O-2): a SUPERVISOR lacks MAINTENANCE: Install update is disabled with "Requires the Technician role" and a press sends nothing', async () => {
    // Before ruling R2 (decision D201) the button was enabled and only the Core's 403 said no.
    const b = await openSection('maintenance', { user: 'andi.pratama' });
    expect(screen.getByTestId('settings-update-install').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByTestId('settings-update-install-locked')).toHaveTextContent('Requires the Technician role');
    await press('settings-update-install', b);
    await b.elapse(200);
    expect(b.requests('startSoftwareUpdate')).toHaveLength(0);
    expect(shown(DENIED)).toBe(false);
    expect(shown(/^Installing v/)).toBe(false);
    expect(b.state().update.state).toBe('IDLE');
  });

  it('refusal: the Core\'s 403 (its `notPermitted` example, a role lost on the Core before the push) is still the denied toast naming the Technician role', async () => {
    const b = await openSection('maintenance', { user: 'rina.wijaya' });
    b.fake.answerOnce('startSoftwareUpdate', notPermitted('startSoftwareUpdate', 'MAINTENANCE', 'SUPERVISOR'));
    await press('settings-update-install', b);
    await b.elapse(200);
    expect(b.requests('startSoftwareUpdate')).toHaveLength(1);
    expect(shown(DENIED)).toBe(true);
    expect(shown('Requires the Technician role')).toBe(true);
    expect(shown(/^Installing v/)).toBe(false);
    expect(b.state().update.state).toBe('IDLE');
  });

  it('a session is open: the Core\'s 409 is the warning the simulator\'s refusal shows', async () => {
    const b = await openSection('maintenance', { user: 'rina.wijaya', setup: (engine) => engine.sim.actions.loadScenario(ScenarioName.RECORDING) });
    await press('settings-update-install', b);
    await b.elapse(200);
    expect(shown('Finish the active session before installing an update.')).toBe(true);
    expect(isBusy('settings-update-install')).toBe(false);
  });

  it('outage: the offline toast; nothing changes', async () => {
    const b = await openSection('maintenance', { user: 'rina.wijaya' });
    b.fake.failOnce('startSoftwareUpdate');
    await press('settings-update-install', b);
    await b.elapse(200);
    expect(shown(OFFLINE)).toBe(true);
    expect(b.state().update.state).toBe('IDLE');
    expect(isBusy('settings-update-install')).toBe(false);
  });
});

describe('S2-7: the Demo controls (operations 73, 74, 52, 72, 33)', () => {
  it('inject and clear MIC 2 clip: the toast after the 204; the clear sends the latch reset as the NEXT command; the Core\'s words', async () => {
    const b = await openSection('maintenance', { answerDelayMs: 600 });
    await openDemo(b);
    expect(screen.getByTestId('settings-demo-note')).toHaveTextContent('Demo only. Faults are injected on the Core server, and every connected console sees them.');
    expect(saysSimulated()).toBe(false);

    await press('settings-demo-fault-MIC_CLIP', b);
    expect(b.requests('injectFault').map((call) => call.body)).toEqual([{ kind: FaultKind.MIC_CLIP, target: { channel: 'AUDIO-02' } }]);
    expect(isBusy('settings-demo-fault-MIC_CLIP')).toBe(true);
    expect(screen.getByTestId('settings-demo-fault-MIC_CLIP').props.accessibilityState).toMatchObject({ selected: false, busy: true });
    expect(shown('MIC 2 clip injected')).toBe(false);
    await b.elapse(800);
    expect(shown('MIC 2 clip injected')).toBe(true);
    expect(b.state().faults.active.some((fault) => fault.kind === FaultKind.MIC_CLIP && fault.target === 'AUDIO-02')).toBe(true);
    expect(screen.getByTestId('settings-demo-fault-MIC_CLIP').props.accessibilityState).toMatchObject({ selected: true });
    expect(isBusy('settings-demo-fault-MIC_CLIP')).toBe(false);

    await press('settings-demo-fault-MIC_CLIP', b);
    expect(b.requests('clearFault')).toHaveLength(1);
    expect(b.requests('resetMicClip')).toHaveLength(0);
    await b.elapse(700);
    // The clear was answered: the latch reset follows, and the button stays busy until it settled.
    expect(b.requests('resetMicClip').map((call) => call.body)).toEqual([{ channel: 'AUDIO-02' }]);
    expect(isBusy('settings-demo-fault-MIC_CLIP')).toBe(true);
    expect(shown('MIC 2 clip cleared')).toBe(false);
    await b.elapse(700);
    expect(shown('MIC 2 clip cleared')).toBe(true);
    expect(isBusy('settings-demo-fault-MIC_CLIP')).toBe(false);
    expect(b.state().faults.active.some((fault) => fault.kind === FaultKind.MIC_CLIP)).toBe(false);
    expect(b.state().mics.find((mic) => mic.id === 'AUDIO-02')?.clipLatched).toBe(false);
  });

  it('load a scenario (answer first): the chip and the toast only once the snapshot of the new epoch is in (CL-18); Reset loads idle', async () => {
    const b = await openSection('maintenance');
    await openDemo(b);
    b.order = 'answer-first';
    fireEvent.press(screen.getByTestId('settings-demo-scenario-recording'));
    await b.flush();
    await press('settings-demo-load', b);
    await b.elapse(300);
    expect(b.requests('loadScenario').map((call) => call.body)).toEqual([{ name: 'recording' }]);
    expect(shown('Recording scenario loaded')).toBe(false);
    expect(isBusy('settings-demo-load')).toBe(true);
    b.sendHeldDeltas();
    await b.elapse(300);
    expect(shown('Recording scenario loaded')).toBe(true);
    expect(isBusy('settings-demo-load')).toBe(false);
    expect(b.state().session?.state).toBe('RECORDING');
    expect(b.state().meta.scenario).toBe('recording');

    b.order = 'delta-first';
    await press('settings-demo-reset', b);
    await b.elapse(300);
    expect(b.requests('loadScenario').map((call) => call.body)).toEqual([{ name: 'recording' }, { name: 'idle' }]);
    expect(shown('Demo reset: idle scenario, faults cleared')).toBe(true);
    expect(b.state().meta.scenario).toBe('idle');
  });

  it('recover a session in FAULT (operation 33): the toast after the 202', async () => {
    const b = await openSection('maintenance', {
      setup: (engine) => {
        engine.sim.actions.loadScenario(ScenarioName.RECORDING);
        engine.sim.actions.inject(FaultKind.POWER_FAIL);
      },
    });
    expect(b.state().session?.state).toBe('FAULT');
    await openDemo(b);
    await press('settings-demo-recover-button', b);
    await b.elapse(300);
    expect(b.requests('recoverSession')).toHaveLength(1);
    expect(shown('Recovery started')).toBe(true);
    expect(b.state().session?.state).not.toBe('FAULT');
  });

  it('DEMO_DISABLED: the flag was turned off after the sign-in — the 403 says so truthfully, and the button is released', async () => {
    const b = await openSection('maintenance');
    await openDemo(b);
    b.fake.answerOnce('injectFault', b.fake.example('injectFault', 403, 'demoDisabled'));
    await press('settings-demo-fault-STORAGE_FULL', b);
    await b.elapse(200);
    expect(shown('Demo controls are turned off on the Core server')).toBe(true);
    expect(shown('Storage full injected')).toBe(false);
    expect(isBusy('settings-demo-fault-STORAGE_FULL')).toBe(false);
    expect(b.state().faults.active).toEqual([]);
  });

  it('refusal: the Core\'s 403 NOT_PERMITTED (its `notPermitted` example) is the denied toast', async () => {
    const b = await openSection('maintenance');
    await openDemo(b);
    b.fake.answerOnce('loadScenario', b.fake.example('loadScenario', 403, 'notPermitted'));
    await press('settings-demo-reset', b);
    await b.elapse(200);
    expect(shown(DENIED)).toBe(true);
    expect(shown('Demo reset: idle scenario, faults cleared')).toBe(false);
  });

  it('outage: the offline toast; nothing is injected', async () => {
    const b = await openSection('maintenance');
    await openDemo(b);
    b.fake.failOnce('injectFault');
    await press('settings-demo-fault-CAMERA_LOSS', b);
    await b.elapse(200);
    expect(shown(OFFLINE)).toBe(true);
    expect(shown('Camera loss injected')).toBe(false);
    expect(b.state().faults.active).toEqual([]);
  });
});

describe('AC-C-52: the Demo controls show in LIVE mode only with DEMO_CONTROL and the Core\'s demo flag', () => {
  it('SUPERVISOR with the flag on: the panel', async () => {
    await openSection('maintenance', { user: 'andi.pratama', demoControls: true });
    expect(screen.getByTestId('settings-demo')).toBeTruthy();
    expect(screen.queryByTestId('settings-demo-not-permitted')).toBeNull();
    expect(screen.queryByTestId('settings-demo-flag-off')).toBeNull();
  });

  it('INVESTIGATOR (no DEMO_CONTROL): no panel, one true line; no demo request can be sent', async () => {
    const b = await openSection('maintenance', { user: 'budi.santoso' });
    expect(screen.queryByTestId('settings-demo')).toBeNull();
    expect(screen.getByTestId('settings-demo-not-permitted')).toHaveTextContent('Your role does not include the demo controls.');
    for (const operationId of ['injectFault', 'clearFault', 'loadScenario', 'resetDemo']) expect(b.requests(operationId)).toHaveLength(0);
  });

  it('SUPERVISOR, the Core server without its demo flag: no panel, the flag line', async () => {
    await openSection('maintenance', { user: 'andi.pratama', demoControls: false });
    expect(screen.queryByTestId('settings-demo')).toBeNull();
    expect(screen.getByTestId('settings-demo-flag-off')).toHaveTextContent('Demo controls are turned off on the Core server. They appear when it runs with its demo flag on.');
  });

  it('a role change the Core pushes takes the panel away (`session.updated`, §6.3)', async () => {
    const b = await openSection('maintenance', { user: 'andi.pratama' });
    expect(screen.getByTestId('settings-demo')).toBeTruthy();
    await b.changeRole('INVESTIGATOR');
    expect(screen.queryByTestId('settings-demo')).toBeNull();
    expect(screen.getByTestId('settings-demo-not-permitted')).toBeTruthy();
  });
});

describe('S5-7: the role\'s permissions in the Profile sheet', () => {
  it('SUPERVISOR: the shared table\'s ten grants (W16\'s three included), labelled, under the Core\'s words; a pushed role change re-lists them', async () => {
    const b = await renderLiveSettings({ user: 'andi.pratama' });
    bed = b;
    await press('settings-account-row', b);
    const sheet = screen.getByTestId('settings-profile-permissions');
    expect(within(sheet).getByText('Permissions')).toBeTruthy();
    expect(within(sheet).getByText('The Core server checks every action against your role.')).toBeTruthy();
    for (const permission of ROLE_PERMISSIONS.SUPERVISOR) expect(screen.getByTestId(`settings-profile-permission-${permission}`)).toBeTruthy();
    for (const label of ['Manage pairing and paired devices', 'Manage users and roles', 'Use the demo controls']) expect(within(sheet).getByText(label)).toBeTruthy();
    expect(saysSimulated()).toBe(false);

    await b.changeRole('INVESTIGATOR');
    expect(screen.getByTestId('settings-profile-role')).toHaveTextContent('Role: Investigator');
    expect(screen.queryByTestId('settings-profile-permission-DEMO_CONTROL')).toBeNull();
    for (const permission of ROLE_PERMISSIONS.INVESTIGATOR) expect(screen.getByTestId(`settings-profile-permission-${permission}`)).toBeTruthy();
  });

  it('the link down: the list is a display hint and stays; no toast, no request', async () => {
    const b = await renderLiveSettings({ user: 'andi.pratama' });
    bed = b;
    const before = b.fake.calls.length;
    act(() => void b.connection().drop());
    await b.elapse(500);
    await press('settings-account-row', b);
    expect(screen.getByTestId('settings-profile-permission-DEMO_CONTROL')).toBeTruthy();
    expect(shown(OFFLINE)).toBe(false);
    expect(b.fake.calls.slice(before).map((call) => call.operationId).filter((id) => id !== 'getAuthSession' && id !== 'getDeviceRegistration')).toEqual([]);
  });
});

describe('StrictMode (D158, F69-1): nothing of Settings starts on mount; one press is one request', () => {
  it.each(['maintenance', 'security', 'preferences'] as const)('%s under StrictMode sends no command at mount', async (section) => {
    const b = await renderLiveSettings({ strict: true });
    bed = b;
    const before = b.fake.calls.length;
    await b.open(`/settings/${section}`);
    await b.elapse(1_000, 250);
    const settingsCommands = ['runDiagnostics', 'startSoftwareUpdate', 'injectFault', 'clearFault', 'resetMicClip', 'loadScenario', 'recoverSession', 'setBiometricEnrollment', 'signOut'];
    expect(b.fake.calls.slice(before).filter((call) => call.operationId !== null && settingsCommands.includes(call.operationId))).toEqual([]);
  });

  it('Run diagnostics under StrictMode: one press, one request', async () => {
    const b = await renderLiveSettings({ strict: true });
    bed = b;
    await b.open('/settings/maintenance');
    await press('settings-run-diagnostics', b);
    await b.elapse(300);
    expect(b.requests('runDiagnostics')).toHaveLength(1);
    expect(screen.getByTestId('settings-diagnostics-sheet')).toBeTruthy();
  });
});
