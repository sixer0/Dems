// How a refusal of a hosted simulator action becomes an answer (plan row W26; spec §7.2, ENG-7).
import { API_ERROR_CODES } from '@dems/shared/api';
import { SimErrorCode, SimNotFoundError, SimNotImplementedError, SimPermissionError, SimTransitionError } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { PipelineFailure } from '../../core';
import { notSignedIn } from '../../plugins/authenticate';
import { ApiFailure, NOT_SIGNED_IN_TEXT } from '../../plugins/error-envelope';
import { EngineError, SIM_REFUSAL_REASON_TEXT, SIM_REFUSAL_RULES, engineNotReady, operatorRequired, simCodeOf, simRefusal } from '../errors';

/** Spec §7.2, "How a thrown simulator error becomes an answer": simulator code, status, code of the answer. */
const SPEC_TABLE: ReadonlyArray<readonly [simCode: SimErrorCode, status: number, code: string]> = [
  ['NOT_SIGNED_IN', 401, 'NOT_SIGNED_IN'],
  ['NOT_PERMITTED', 403, 'NOT_PERMITTED'],
  ['NOT_FOUND', 404, 'NOT_FOUND'],
  ['ILLEGAL_STATE', 409, 'INVALID_STATE'],
  ['NO_WARNINGS', 409, 'INVALID_STATE'],
  ['CHECKS_RUNNING', 409, 'PRECHECK_RUNNING'],
  ['SESSION_ACTIVE', 409, 'SESSION_ACTIVE'],
  ['RECORDING_ACTIVE', 409, 'RECORDING_ACTIVE'],
  ['COMMAND_UNSUPPORTED', 409, 'COMMAND_UNSUPPORTED'],
  ['UNSEALED_EVIDENCE', 409, 'NOT_SEALED'],
  ['REASON_TOO_SHORT', 422, 'INVALID_REASON'],
  ['NOTE_INVALID', 422, 'INVALID_INPUT'],
  ['POLICY_RANGE', 422, 'INVALID_INPUT'],
  ['INVALID_INPUT', 422, 'INVALID_INPUT'],
];

describe('simRefusal: the table of spec §7.2', () => {
  it('has one line for every simulator code except NOT_IMPLEMENTED, which no action throws', () => {
    const covered = Object.keys(SIM_REFUSAL_RULES).sort();
    expect(covered).toEqual(SPEC_TABLE.map(([simCode]) => simCode).sort());
    expect(Object.values(SimErrorCode).filter((code) => !covered.includes(code))).toEqual(['NOT_IMPLEMENTED']);
  });

  it.each(SPEC_TABLE)('%s answers %i %s with details.simCode', (simCode, status, code) => {
    const thrown = new SimTransitionError('RECORDING', 'someAction', 'a detail of the simulator', simCode);
    const refusal = simRefusal(thrown);
    expect(refusal).toBeInstanceOf(ApiFailure);
    expect(refusal).toMatchObject({ statusCode: status, code });
    expect(refusal?.details).toMatchObject({ simCode });
    expect(refusal?.cause).toBe(thrown);
    expect(simCodeOf(refusal)).toBe(simCode);
  });

  it('every code of an answer is a code of the contract registry', () => {
    const contract: readonly string[] = API_ERROR_CODES;
    for (const rule of Object.values(SIM_REFUSAL_RULES)) expect(contract, rule.code).toContain(rule.code);
  });

  it('a refused transition carries `from` and `event`; a permission refusal carries `permission`; a missing item carries the code only', () => {
    expect(simRefusal(new SimTransitionError('RECORDING', 'startRecording'))?.details).toEqual({
      simCode: 'ILLEGAL_STATE',
      from: 'RECORDING',
      event: 'startRecording',
    });
    expect(simRefusal(new SimTransitionError(null, 'cancel'))?.details).toEqual({ simCode: 'ILLEGAL_STATE', from: null, event: 'cancel' });
    // Pass D11: the reason the simulator named travels with the refusal (a stop while the cameras connect); none named, no key.
    expect(simRefusal(new SimTransitionError('RECORDING', 'stopRecording', undefined, SimErrorCode.ILLEGAL_STATE, 'CAPTURE_NOT_DURABLE'))).toMatchObject({
      statusCode: 409,
      code: 'INVALID_STATE',
      details: { simCode: 'ILLEGAL_STATE', from: 'RECORDING', event: 'stopRecording', reason: 'CAPTURE_NOT_DURABLE' },
    });
    expect('reason' in (simRefusal(new SimTransitionError('RECORDING', 'stopRecording'))?.details ?? {})).toBe(false);
    expect(simRefusal(new SimPermissionError('stopRecording', 'SESSION_START'))?.details).toEqual({ simCode: 'NOT_PERMITTED', permission: 'SESSION_START' });
    expect(simRefusal(new SimPermissionError('cancel', 'SESSION_START', SimErrorCode.NOT_SIGNED_IN))).toMatchObject({
      statusCode: 401,
      code: 'NOT_SIGNED_IN',
      details: { simCode: 'NOT_SIGNED_IN' },
    });
    expect(simRefusal(new SimNotFoundError('evidence', 'EV-MARK-0001'))?.details).toEqual({ simCode: 'NOT_FOUND' });
  });

  it('never quotes the input: neither the message nor the details hold what the simulator was given', () => {
    const MARK = 'MARK-input-7f3a';
    const cases = [
      new SimNotFoundError('evidence', MARK),
      new SimTransitionError('RECORDING', 'addNote', `the text ${MARK} is too long`, SimErrorCode.NOTE_INVALID),
    ];
    for (const thrown of cases) {
      const refusal = simRefusal(thrown);
      expect(JSON.stringify({ message: refusal?.message, details: refusal?.details })).not.toContain(MARK);
    }
  });

  it('a module may give its own wording; the status, the code and the details stay', () => {
    const refusal = simRefusal(new SimTransitionError('CREATE', 'startRecording'), 'Session SES-1 is CREATE.');
    expect(refusal).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', message: 'Session SES-1 is CREATE.', details: { simCode: 'ILLEGAL_STATE' } });
  });

  it('fix wave J: a refusal that NAMES its reason is answered with the sentence of that reason - no updater, no composite - and keeps status, code and details', () => {
    const update = simRefusal(new SimTransitionError(null, 'startSoftwareUpdate', 'this Core has no software updater', SimErrorCode.COMMAND_UNSUPPORTED, 'UPDATER_NOT_AVAILABLE'));
    expect([update?.statusCode, update?.code, update?.message]).toEqual([409, 'COMMAND_UNSUPPORTED', 'Software update is not available on this Core.']);
    expect(update?.details).toMatchObject({ simCode: 'COMMAND_UNSUPPORTED', event: 'startSoftwareUpdate', reason: 'UPDATER_NOT_AVAILABLE' });
    const composite = simRefusal(new SimTransitionError(null, 'exportEvidence', 'composite video is not available in this build', SimErrorCode.COMMAND_UNSUPPORTED, 'COMPOSITE_ENCODER_NOT_SELECTED'));
    expect([composite?.statusCode, composite?.code, composite?.message]).toEqual([409, 'COMMAND_UNSUPPORTED', 'Composite video is not available in this build.']);
    expect(composite?.details).toMatchObject({ reason: 'COMPOSITE_ENCODER_NOT_SELECTED' });
    // Row 104c2 (RT-1, D81): operation 66 on a Core in its own capture.
    const restart = simRefusal(new SimTransitionError(null, 'restartServices', 'this Core restarts no services from the console', SimErrorCode.COMMAND_UNSUPPORTED, 'SERVICES_RESTART_NOT_AVAILABLE'));
    expect([restart?.statusCode, restart?.code, restart?.message]).toEqual([409, 'COMMAND_UNSUPPORTED', 'Restarting services is not available on this Core.']);
    expect(restart?.details).toMatchObject({ simCode: 'COMMAND_UNSUPPORTED', event: 'restartServices', reason: 'SERVICES_RESTART_NOT_AVAILABLE' });
    expect(Object.keys(SIM_REFUSAL_REASON_TEXT).sort()).toEqual(['COMPOSITE_ENCODER_NOT_SELECTED', 'SERVICES_RESTART_NOT_AVAILABLE', 'UPDATER_NOT_AVAILABLE']);
    // CONTROL: the same code without such a reason keeps the sentence of the table, and a module's own wording still wins.
    expect(simRefusal(new SimTransitionError(null, 'deviceCommand', 'GNSS accepts IDENTIFY only', SimErrorCode.COMMAND_UNSUPPORTED))?.message).toBe(SIM_REFUSAL_RULES.COMMAND_UNSUPPORTED.message);
    expect(simRefusal(new SimTransitionError(null, 'x', 'y', SimErrorCode.COMMAND_UNSUPPORTED, 'UPDATER_NOT_AVAILABLE'), 'own words')?.message).toBe('own words');
  });

  it('anything else is not a refusal: the caller lets it propagate and the request answers 500', () => {
    expect(simRefusal(new RangeError('Unknown scenario'))).toBeNull();
    expect(simRefusal(new TypeError('x is not a function'))).toBeNull();
    expect(simRefusal(new SimNotImplementedError('loadScenario'))).toBeNull();
    expect(simRefusal('a string')).toBeNull();
    expect(simRefusal(undefined)).toBeNull();
  });

  it('simCodeOf reads only a refusal of the simulator', () => {
    expect(simCodeOf(new ApiFailure(409, 'LAST_ADMIN', 'The last administrator cannot be disabled.'))).toBeNull();
    expect(simCodeOf(new PipelineFailure('COMMIT_FAILED'))).toBeNull();
    expect(simCodeOf(new Error('x'))).toBeNull();
  });
});

describe('the host\'s own errors', () => {
  it('"not ready" is the envelope\'s 503 without a detail', () => {
    expect(engineNotReady()).toMatchObject({ statusCode: 503, code: 'NOT_READY' });
    expect(engineNotReady().details).toBeUndefined();
  });

  it('an EngineError has a code and a detail of names and counts, and is not an answer of the API', () => {
    const error = new EngineError('ENGINE_SNAPSHOT_REJECTED', 'the stored state was rejected', { slices: 'session', rejected: 1 });
    expect(error).not.toBeInstanceOf(ApiFailure);
    expect(error).toMatchObject({ name: 'EngineError', code: 'ENGINE_SNAPSHOT_REJECTED', detail: { slices: 'session', rejected: 1 } });
  });
});

describe('401 NOT_SIGNED_IN has one text across the server (review findings CPB1-18, W91-5)', () => {
  it('stage 4, the engine backstop and the hosted actions\' refusal table answer the contract\'s "Sign in first."', () => {
    expect(NOT_SIGNED_IN_TEXT).toBe('Sign in first.');
    expect(notSignedIn()).toMatchObject({ statusCode: 401, code: 'NOT_SIGNED_IN', message: NOT_SIGNED_IN_TEXT });
    expect(operatorRequired()).toMatchObject({ statusCode: 401, code: 'NOT_SIGNED_IN', message: NOT_SIGNED_IN_TEXT });
    expect(SIM_REFUSAL_RULES.NOT_SIGNED_IN.message).toBe(NOT_SIGNED_IN_TEXT);
    expect(simRefusal(new SimPermissionError('cancel', 'SESSION_START', SimErrorCode.NOT_SIGNED_IN))?.message).toBe(NOT_SIGNED_IN_TEXT);
  });
});
