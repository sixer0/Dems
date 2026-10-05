// How a refusal of a hosted simulator action becomes an answer (plan row W26; spec §7.2, ENG-7).
import { API_ERROR_CODES } from '@dems/shared/api';
import { SimErrorCode, SimNotFoundError, SimNotImplementedError, SimPermissionError, SimTransitionError } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { PipelineFailure } from '../../core';
import { ApiFailure } from '../../plugins/error-envelope';
import { EngineError, SIM_REFUSAL_RULES, engineNotReady, simCodeOf, simRefusal } from '../errors';

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
