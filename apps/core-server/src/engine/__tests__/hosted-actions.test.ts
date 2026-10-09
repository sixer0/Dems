// Which simulator actions the host runs (plan row W26; spec §7.17, §8.1), and the system timer.
import { SIM_ACTION_OPERATIONS } from '@dems/shared/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOSTED_ACTIONS, hostedActionsOfOperation, isHostedAction } from '../hosted-actions';
import { createSystemTimer } from '../timer';

/** Spec §8.1 "Not called": the ten members that are never called on the engine, and the four internal ones. */
const NOT_HOSTED = [
  'signIn',
  'signInWithBiometric',
  'recordBiometricFailure',
  'signInWithSecurityKey',
  'signOut',
  'touch',
  'loadScenario',
  'resetDemo',
  'pair',
  'unpair',
  'setTabletLink',
  'applyCaptureTelemetry',
  'raiseCaptureWarning',
  'clearCaptureWarning',
];

describe('the hosted actions', () => {
  it('are the 33 members that contract C marks as hosted, in the order of SimActions', () => {
    expect(HOSTED_ACTIONS).toHaveLength(33);
    // 47 until task 3 row 132 added the INTERNAL `registerCaptureDevice` (C3 §2.6: the adoption).
    expect(Object.keys(SIM_ACTION_OPERATIONS)).toHaveLength(48);
    const expected = Object.entries(SIM_ACTION_OPERATIONS)
      .filter(([, binding]) => binding.execution === 'hosted')
      .map(([name]) => name);
    expect([...HOSTED_ACTIONS]).toEqual(expected);
    expect(HOSTED_ACTIONS).toEqual(
      expect.arrayContaining(['createSession', 'startRecording', 'stopRecording', 'recover', 'exportEvidence', 'inject', 'clearFault', 'updateSettings']),
    );
    // Blueprint row 66 (register SH-18): the hosted pair of the capture selector and the mic switch, the last two.
    expect(HOSTED_ACTIONS.slice(-2)).toEqual(['setCaptureConfig', 'switchAudioSource']);
  });

  it.each(NOT_HOSTED)('%s is not hosted: no client reaches it through the engine', (name) => {
    expect(isHostedAction(name)).toBe(false);
    expect((HOSTED_ACTIONS as readonly string[]).includes(name)).toBe(false);
  });

  it('a name that is no action, or a member of Object, is not hosted', () => {
    for (const name of ['', 'toString', 'constructor', '__proto__', 'hasOwnProperty', 'StartRecording']) {
      expect(isHostedAction(name), name).toBe(false);
    }
  });

  it('an operation names its hosted actions: one, three operations for one action, two actions for one operation', () => {
    expect(hostedActionsOfOperation('stopSession')).toEqual(['stopRecording']);
    expect(hostedActionsOfOperation('updateSettings')).toEqual(['setPresentationMode', 'updateSettings']);
    for (const operation of ['restartDevice', 'testDeviceSignal', 'identifyDevice']) {
      expect(hostedActionsOfOperation(operation)).toEqual(['deviceCommand']);
    }
    // A server-native operation and a read have none.
    expect(hostedActionsOfOperation('signIn')).toEqual([]);
    expect(hostedActionsOfOperation('loadScenario')).toEqual([]);
    expect(hostedActionsOfOperation('getServiceHealth')).toEqual([]);
    // Row 66: three operations for `setCaptureConfig`, one for `switchAudioSource`; the reads of the selector have none.
    for (const operation of ['updateCaptureConfig', 'setCaptureCameraSource', 'setPrimaryMic']) expect(hostedActionsOfOperation(operation)).toEqual(['setCaptureConfig']);
    expect(hostedActionsOfOperation('switchAudioSource')).toEqual(['switchAudioSource']);
    expect(hostedActionsOfOperation('getCaptureConfig')).toEqual([]);
  });

  it('together the hosted actions reach 36 operations', () => {
    const operations = new Set(HOSTED_ACTIONS.flatMap((name) => SIM_ACTION_OPERATIONS[name].operations as readonly string[]));
    expect(operations.size).toBe(36);
  });
});

describe('the system timer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls back at the interval until it is cancelled; cancelling twice is harmless', () => {
    vi.useFakeTimers();
    const timer = createSystemTimer();
    let calls = 0;
    const cancel = timer.every(50, () => {
      calls += 1;
    });
    vi.advanceTimersByTime(175);
    expect(calls).toBe(3);
    cancel();
    cancel();
    vi.advanceTimersByTime(500);
    expect(calls).toBe(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('its interval does not keep the process alive', () => {
    const timer = createSystemTimer();
    const before = process.getActiveResourcesInfo().filter((name) => name === 'Timeout').length;
    const cancel = timer.every(60_000, () => undefined);
    // An unreferenced timer is not among the resources that keep the event loop running.
    expect(process.getActiveResourcesInfo().filter((name) => name === 'Timeout').length).toBe(before);
    cancel();
  });
});
