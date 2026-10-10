// Backend task, plan row W78: Devices & Inputs in LIVE mode — settle sites S2-8 (Run diagnostics,
// operation 65), S3-2 (the device-command dialog: Test signal, operation 49; Restart, operation 48) and
// S5-4 (the Restart hint, enforced by the Core), each with its success, its refusal (a 403: the denied
// toast that names the role, AC-C-48), an outage and the Core's 409 answers (D89), on the app's real Live
// source over the contract-checked fake transport. AC-C-63: the dialog's success toast shows only after
// the Core's 2xx. The clip reset (operation 52) goes through `settle` too.
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { rateLimited } from '@dems/shared/live/testing';
import { FaultKind } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderDevicesApp, settle as flushSimulated } from './testing/devices-harness';
import { notPermitted, renderLiveDevices, resetLiveDevicesBed, type LiveDevicesBed, type LiveDevicesBedOptions } from './testing/live-devices-bed';

jest.setTimeout(30_000);

let bed: LiveDevicesBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveDevicesBed();
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
const FAILED = 'The action could not be completed. Please try again.';
const isBusy = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.busy === true;
const toastShown = (text: string | RegExp) => screen.queryAllByText(text).length > 0;
/** No text on screen says "simulated" (rule 8, MD-8: a screen with the Core's data says nothing about a simulation). */
const saysSimulated = () => screen.queryAllByText(/simulat/i).length > 0;

async function openDetail(deviceId: string, options: LiveDevicesBedOptions = {}): Promise<LiveDevicesBed> {
  const b = await renderLiveDevices(options);
  bed = b;
  await b.open(`/devices/${deviceId}`);
  expect(b.app.getPathname()).toBe(`/devices/${deviceId}`);
  expect(screen.getByTestId('device-detail-screen')).toBeTruthy();
  return b;
}

async function press(testID: string, b: LiveDevicesBed): Promise<void> {
  fireEvent.press(screen.getByTestId(testID));
  await b.flush();
}

/** Opens the dialog of a command and confirms it; the answer is then as scripted. */
async function confirmCommand(action: 'device-action-test-signal' | 'device-action-restart', b: LiveDevicesBed): Promise<void> {
  await press(action, b);
  expect(screen.getByTestId('device-command-dialog')).toBeTruthy();
  await press('device-command-confirm', b);
}

function auditCommands(b: LiveDevicesBed, deviceId: string): unknown[] {
  return b
    .state()
    .audit.rows.filter((row) => row.type === 'DEVICE_COMMAND' && row.deviceId === deviceId)
    .map((row) => row.details.command);
}

describe('S3-2: Test signal (operation 49) through the device-command dialog', () => {
  it('success: the success toast only after the Core\'s 204 (AC-C-63); busy at once, spinner late (LB-1); one request; the Core\'s words', async () => {
    const b = await openDetail('MIC-02', { answerDelayMs: 2_000 });
    await press('device-action-test-signal', b);
    expect(screen.getByText('Send a test signal to MIC 2?')).toBeTruthy();
    expect(screen.getByText('A short test tone or pattern is sent and the Core writes the command to its audit log.')).toBeTruthy();
    expect(saysSimulated()).toBe(false);

    await press('device-command-confirm', b);
    await b.elapse(100);
    expect(b.requests('testDeviceSignal')).toHaveLength(1);
    expect(b.requests('testDeviceSignal')[0]!.path).toBe('/api/v1/device/MIC-02/test-signal');
    // The Core's delta came first and its answer has not: the Live source holds the delta back (CL-16), so
    // nothing changed on screen — no row, no toast; the dialog waits, busy without a spinner.
    expect(auditCommands(b, 'MIC-02')).toEqual([]);
    expect(toastShown('Test signal sent to MIC 2')).toBe(false);
    expect(screen.getByTestId('device-command-dialog')).toBeTruthy();
    expect(isBusy('device-command-confirm')).toBe(true);
    expect(screen.queryByTestId('device-command-spinner')).toBeNull();
    // A second press and Cancel do nothing while the command is out.
    await press('device-command-confirm', b);
    await press('device-command-cancel', b);
    expect(b.requests('testDeviceSignal')).toHaveLength(1);
    expect(screen.getByTestId('device-command-dialog')).toBeTruthy();

    await b.elapse(500);
    expect(screen.getByTestId('device-command-spinner')).toBeTruthy();
    expect(toastShown('Test signal sent to MIC 2')).toBe(false);

    await b.elapse(1_600);
    // The answer: the held delta and the toast land in one turn.
    expect(auditCommands(b, 'MIC-02')).toEqual(['TEST_SIGNAL']);
    expect(toastShown('Test signal sent to MIC 2')).toBe(true);
    expect(toastShown(/\(simulated\)/)).toBe(false);
    expect(screen.queryByTestId('device-command-dialog')).toBeNull();

    // The Log shows the Core's row, named without "(simulated)".
    await press('device-tab-log', b);
    const log = screen.getByTestId('device-log');
    expect(within(log).getByText('Device command sent')).toBeTruthy();
    expect(within(log).getByText('Test signal')).toBeTruthy();
    expect(saysSimulated()).toBe(false);
  });

  it('answer first, delta later: the toast waits for the revision the answer named (CL-16)', async () => {
    const b = await openDetail('MIC-01');
    b.order = 'answer-first';
    await confirmCommand('device-action-test-signal', b);
    await b.elapse(300);
    expect(b.requests('testDeviceSignal')[0]!.status).toBe(204);
    expect(toastShown('Test signal sent to MIC 1')).toBe(false);
    expect(screen.getByTestId('device-command-dialog')).toBeTruthy();
    b.sendHeldDeltas();
    await b.flush();
    expect(auditCommands(b, 'MIC-01')).toEqual(['TEST_SIGNAL']);
    expect(toastShown('Test signal sent to MIC 1')).toBe(true);
    expect(screen.queryByTestId('device-command-dialog')).toBeNull();
  });

  it('refusal: a 403 NOT_PERMITTED of the Core\'s guard → the denied toast naming the role; no success toast; the dialog closes', async () => {
    const b = await openDetail('MIC-02');
    // Operation 49's 403 examples hold no `notPermitted` (every seeded role holds DIAGNOSTICS_RUN, and its
    // FIRST 403 example is `deviceRevoked`, which would retire the pairing): the guard's own answer is built.
    b.fake.answerOnce('testDeviceSignal', notPermitted('testDeviceSignal', 'DIAGNOSTICS_RUN', 'TECHNICIAN'));
    await confirmCommand('device-action-test-signal', b);
    await b.elapse(200);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown('Requires the Investigator role')).toBe(true);
    expect(toastShown('Test signal sent to MIC 2')).toBe(false);
    expect(toastShown(FAILED)).toBe(false);
    expect(screen.queryByTestId('device-command-dialog')).toBeNull();
    expect(auditCommands(b, 'MIC-02')).toEqual([]);
  });

  it('409 COMMAND_UNSUPPORTED (the contract\'s example) → "MIC 2 does not accept this command."; no success toast', async () => {
    const b = await openDetail('MIC-02');
    b.fake.answerOnce('testDeviceSignal', b.fake.example('testDeviceSignal', 409, 'commandUnsupported'));
    await confirmCommand('device-action-test-signal', b);
    await b.elapse(200);
    expect(toastShown('MIC 2 does not accept this command.')).toBe(true);
    expect(toastShown('Test signal sent to MIC 2')).toBe(false);
    expect(toastShown(DENIED)).toBe(false);
  });

  it('outage: "Core server unreachable. Nothing was changed."; no success toast; a second try sends again', async () => {
    const b = await openDetail('MIC-02');
    b.fake.failOnce('testDeviceSignal');
    await confirmCommand('device-action-test-signal', b);
    await b.elapse(200);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown(OFFLINE_HINT)).toBe(true);
    expect(toastShown('Test signal sent to MIC 2')).toBe(false);
    expect(screen.queryByTestId('device-command-dialog')).toBeNull();
    await confirmCommand('device-action-test-signal', b);
    await b.elapse(200);
    expect(b.requests('testDeviceSignal')).toHaveLength(2);
    expect(toastShown('Test signal sent to MIC 2')).toBe(true);
  });

  it('a 429 is a limit, not an outage (LB-10): the limit toast with the seconds, no offline wording', async () => {
    const b = await openDetail('CAM-01');
    b.fake.answerOnce('testDeviceSignal', rateLimited(30));
    await confirmCommand('device-action-test-signal', b);
    await b.elapse(200);
    expect(toastShown('The Core server is limiting requests from this tablet')).toBe(true);
    expect(toastShown('Try again in 30 s.')).toBe(true);
    expect(toastShown(OFFLINE)).toBe(false);
    expect(toastShown('Test signal sent to Camera 1')).toBe(false);
  });
});

describe('S3-2 and S5-4: Restart (operation 48) through the device-command dialog', () => {
  it('success as the TECHNICIAN: the toast after the Core\'s 204, the Core\'s audit row, the Core\'s words', async () => {
    const b = await openDetail('CAM-02', { answerDelayMs: 1_000 });
    expect(screen.queryByTestId('device-restart-hint')).toBeNull();
    await press('device-action-restart', b);
    expect(screen.getByText('Restart Camera 2?')).toBeTruthy();
    expect(screen.getByText('The Core restarts the device and writes the command to its audit log.')).toBeTruthy();
    await press('device-command-confirm', b);
    expect(b.requests('restartDevice')[0]!.path).toBe('/api/v1/device/CAM-02/restart');
    expect(toastShown('Camera 2 restarted')).toBe(false);
    await b.elapse(1_100);
    expect(toastShown('Camera 2 restarted')).toBe(true);
    expect(auditCommands(b, 'CAM-02')).toEqual(['RESTART']);
    expect(saysSimulated()).toBe(false);
  });

  it('refusal: 403 (the contract\'s example `notPermitted`) → the denied toast naming the Technician role; no success toast', async () => {
    const b = await openDetail('CAM-02');
    b.fake.answerOnce('restartDevice', b.fake.example('restartDevice', 403, 'notPermitted'));
    await confirmCommand('device-action-restart', b);
    await b.elapse(200);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown('Requires the Technician role')).toBe(true);
    expect(toastShown('Camera 2 restarted')).toBe(false);
    expect(screen.queryByTestId('device-command-dialog')).toBeNull();
  });

  it('409 RECORDING_ACTIVE (the contract\'s example: a recording started on the Core) → "Not available while recording"', async () => {
    const b = await openDetail('CAM-02');
    b.fake.answerOnce('restartDevice', b.fake.example('restartDevice', 409, 'recordingActive'));
    await confirmCommand('device-action-restart', b);
    await b.elapse(200);
    expect(toastShown('Not available while recording')).toBe(true);
    expect(toastShown('Camera 2 restarted')).toBe(false);
    expect(toastShown(FAILED)).toBe(false);
  });

  it('409 COMMAND_UNSUPPORTED (the contract\'s example) → "Camera 2 does not accept this command."', async () => {
    const b = await openDetail('CAM-02');
    b.fake.answerOnce('restartDevice', b.fake.example('restartDevice', 409, 'commandUnsupported'));
    await confirmCommand('device-action-restart', b);
    await b.elapse(200);
    expect(toastShown('Camera 2 does not accept this command.')).toBe(true);
    expect(toastShown('Camera 2 restarted')).toBe(false);
  });

  it('outage: "Core server unreachable"; no success toast', async () => {
    const b = await openDetail('POE-SWITCH');
    b.fake.failOnce('restartDevice');
    await confirmCommand('device-action-restart', b);
    await b.elapse(200);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown(/restarted/)).toBe(false);
  });

  it('S5-4: the hint reads the replicated role — the INVESTIGATOR sees Restart disabled with "Requires the Technician role"; Test signal stays open', async () => {
    const b = await openDetail('CAM-02', { user: 'budi.santoso' });
    expect(screen.getByTestId('device-action-restart').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('device-restart-hint')).toHaveTextContent('Requires the Technician role');
    await confirmCommand('device-action-test-signal', b);
    await b.elapse(200);
    expect(toastShown('Test signal sent to Camera 2')).toBe(true);
    expect(b.requests('restartDevice')).toHaveLength(0);
  });

  it('S5-4: while the Core records, the TECHNICIAN sees Restart disabled with "Not available while recording"', async () => {
    const b = await openDetail('CAM-02', { recording: true });
    expect(b.state().session?.state).toBe('RECORDING');
    expect(screen.getByTestId('device-action-restart').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('device-restart-hint')).toHaveTextContent('Not available while recording');
  });
});

describe('S2-8: Run diagnostics (operation 65)', () => {
  it('success: the sheet opens only once the Core accepted the run (202); busy at once, spinner late; the Core\'s checks resolve', async () => {
    const b = await openDetail('POE-SWITCH', { answerDelayMs: 1_500 });
    await press('device-action-diagnostics', b);
    expect(b.requests('runDiagnostics')).toHaveLength(1);
    expect(screen.queryByTestId('device-diagnostics-sheet')).toBeNull();
    expect(isBusy('device-action-diagnostics')).toBe(true);
    expect(screen.queryByTestId('device-action-diagnostics-spinner')).toBeNull();
    await press('device-action-diagnostics', b);
    expect(b.requests('runDiagnostics')).toHaveLength(1);

    await b.elapse(500);
    expect(screen.getByTestId('device-action-diagnostics-spinner')).toBeTruthy();
    expect(screen.queryByTestId('device-diagnostics-sheet')).toBeNull();

    await b.elapse(1_100);
    const sheet = screen.getByTestId('device-diagnostics-sheet');
    expect(within(sheet).getByText('Run Diagnostics')).toBeTruthy();
    expect(screen.getByTestId('device-diagnostics-CPU-running')).toBeTruthy();
    expect(screen.queryByTestId('device-action-diagnostics-spinner')).toBeNull();
    expect(isBusy('device-action-diagnostics')).toBe(false);

    await b.runCore(6_000);
    expect(within(sheet).getByText('All checks passed')).toBeTruthy();
    expect(screen.getByTestId('device-diagnostics-SECURITY-PASS')).toBeTruthy();
    expect(saysSimulated()).toBe(false);
    expect(screen.getByLabelText('Eight health checks on the Core server, one after another.')).toBeTruthy();
    expect(screen.queryByLabelText(/simulated/)).toBeNull();
  });

  it('Run again: one more run on the Core; marked busy until the Core accepted it', async () => {
    const b = await openDetail('POE-SWITCH');
    await press('device-action-diagnostics', b);
    await b.elapse(200);
    await b.runCore(6_000);
    b.answerDelayMs = 1_000;
    await press('device-diagnostics-again', b);
    expect(b.requests('runDiagnostics')).toHaveLength(2);
    expect(isBusy('device-diagnostics-again')).toBe(true);
    await b.elapse(500);
    expect(screen.getByTestId('device-diagnostics-again-spinner')).toBeTruthy();
    await b.elapse(600);
    expect(screen.getByTestId('device-diagnostics-CPU-running')).toBeTruthy();
    expect(screen.queryByTestId('device-diagnostics-again')).toBeNull();
  });

  it('refusal: a 403 NOT_PERMITTED of the Core\'s guard → the denied toast; the sheet stays closed; the button is idle', async () => {
    const b = await openDetail('CAM-01');
    // Operation 65's 403 examples hold no `notPermitted` (every seeded role holds DIAGNOSTICS_RUN).
    b.fake.answerOnce('runDiagnostics', notPermitted('runDiagnostics', 'DIAGNOSTICS_RUN', 'TECHNICIAN'));
    await press('device-action-diagnostics', b);
    await b.elapse(200);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown('Requires the Investigator role')).toBe(true);
    expect(screen.queryByTestId('device-diagnostics-sheet')).toBeNull();
    expect(isBusy('device-action-diagnostics')).toBe(false);
  });

  it('outage: "Core server unreachable. Nothing was changed."; the sheet stays closed; a second press sends again and opens it', async () => {
    const b = await openDetail('CAM-01');
    b.fake.failOnce('runDiagnostics');
    await press('device-action-diagnostics', b);
    await b.elapse(200);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown(OFFLINE_HINT)).toBe(true);
    expect(screen.queryByTestId('device-diagnostics-sheet')).toBeNull();
    expect(isBusy('device-action-diagnostics')).toBe(false);
    await press('device-action-diagnostics', b);
    await b.elapse(200);
    expect(b.requests('runDiagnostics')).toHaveLength(2);
    expect(screen.getByTestId('device-diagnostics-sheet')).toBeTruthy();
  });
});

describe('the clip reset (operation 52): result ignored as before, a rejection presented', () => {
  const clipped: LiveDevicesBedOptions = {
    setup: (engine) => {
      engine.sim.actions.inject(FaultKind.MIC_CLIP, { channel: 'AUDIO-01' });
      engine.advance(1_500);
      engine.sim.actions.clearFault(FaultKind.MIC_CLIP, { channel: 'AUDIO-01' });
      engine.advance(200);
    },
  };

  it('success: the Core clears the latch and the replica shows it', async () => {
    const b = await openDetail('MIC-01', clipped);
    expect(b.state().mics[0]!.clipLatched).toBe(true);
    await press('device-clip-reset', b);
    await b.elapse(200);
    expect(b.requests('resetMicClip')).toHaveLength(1);
    expect(b.requests('resetMicClip')[0]!.body).toEqual({ channel: 'AUDIO-01' });
    expect(b.state().mics[0]!.clipLatched).toBe(false);
    expect(screen.getByTestId('device-detail-status').props.accessibilityLabel).toBe('Online');
  });

  it('outage: "Core server unreachable" instead of an unhandled rejection; the latch stays', async () => {
    const b = await openDetail('MIC-01', clipped);
    b.fake.failOnce('resetMicClip');
    await press('device-clip-reset', b);
    await b.elapse(200);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(b.state().mics[0]!.clipLatched).toBe(true);
  });
});

describe('the LIVE copy (rule 8, MD-8)', () => {
  it('the health caption and the Overview of a camera say nothing about a simulation', async () => {
    const b = await openDetail('CAM-01');
    await b.runCore(6_000);
    await press('device-tab-health', b);
    expect(screen.getByText('Link quality (%)')).toBeTruthy();
    // Row M1 follow-up (D160): the LIVE caption says the line is derived on this device (RESIDUAL-W78-2, W83 ledger #57).
    expect(screen.getByTestId('device-health-samples')).toHaveTextContent(/^(?:Derived from the Core's data · last \d+ samples|Collecting samples…)$/);
    expect(saysSimulated()).toBe(false);
  });
});

describe('React StrictMode (decision D158, finding F69-1): no Core command starts on mount', () => {
  /** Every operation a Devices screen can send: the commands, not the reads of the sign-in. */
  const COMMANDS = ['restartDevice', 'testDeviceSignal', 'identifyDevice', 'runDiagnostics', 'resetMicClip', 'setActiveCamera'] as const;
  const commandsSent = (b: LiveDevicesBed) => COMMANDS.flatMap((operationId) => b.requests(operationId).map(() => operationId));

  it('the list and three details mount (effects twice) and send nothing; one press then sends exactly ONE request', async () => {
    const b = await renderLiveDevices({ strict: true });
    bed = b;
    expect(screen.getByTestId('screen-devices')).toBeTruthy();
    for (const deviceId of ['MIC-01', 'CAM-01', 'REC-INDICATOR']) {
      await b.open(`/devices/${deviceId}`);
      expect(screen.getByTestId('device-detail-screen')).toBeTruthy();
      await press('device-tab-health', b);
      await press('device-tab-log', b);
      await b.elapse(1_000, 250);
    }
    expect(commandsSent(b)).toEqual([]);

    await press('device-action-diagnostics', b);
    await b.elapse(200);
    expect(commandsSent(b)).toEqual(['runDiagnostics']);
    expect(screen.getByTestId('device-diagnostics-sheet')).toBeTruthy();
    await press('device-diagnostics-close', b);
    await confirmCommand('device-action-test-signal', b);
    await b.elapse(200);
    expect(commandsSent(b)).toEqual(['testDeviceSignal', 'runDiagnostics']);
    expect(b.requests('testDeviceSignal')[0]!.path).toBe('/api/v1/device/REC-INDICATOR/test-signal');
  });
});

describe('SIMULATED mode keeps its words (the same call sites, the simulator settles at once)', () => {
  it('the dialog body, the success toast, the Log and the diagnostics subtitle still say "simulated"', async () => {
    const h = renderDevicesApp({ initialUrl: '/devices/MIC-02' });
    await flushSimulated();
    fireEvent.press(screen.getByTestId('device-action-test-signal'));
    await flushSimulated();
    expect(screen.getByText('Simulated. A short test tone or pattern is sent and the command is written to the audit log.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('device-command-confirm'));
    await flushSimulated();
    expect(toastShown('Test signal sent to MIC 2 (simulated)')).toBe(true);
    expect(screen.queryByTestId('device-command-dialog')).toBeNull();
    // Nothing is ever marked busy: the command settled before the press returned.
    // DELIBERATE PIN CHANGE (wave H closing pass Z2, G70-04): an idle control now STATES `busy: false` (`busyState`); it is never marked busy.
    expect(screen.getByTestId('device-action-diagnostics').props.accessibilityState?.busy).toBe(false);
    fireEvent.press(screen.getByTestId('device-tab-log'));
    await flushSimulated();
    expect(within(screen.getByTestId('device-log')).getByText('Test signal (simulated)')).toBeTruthy();
    fireEvent.press(screen.getByTestId('device-action-diagnostics'));
    await flushSimulated();
    expect(screen.getByTestId('device-diagnostics-sheet')).toBeTruthy();
    expect(screen.getByLabelText('Eight health checks, one after another (simulated).')).toBeTruthy();
    expect(h.sim.store.getState().audit.rows.some((row) => row.type === 'DIAGNOSTICS_RUN')).toBe(true);
    h.app.unmount();
  });
});
