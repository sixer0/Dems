// The pure parts of the sessions module (plan row W34): the binding to the contract, the
// refusals, the bodies of a stop and of a note, the cursor of the history, the answer of
// `getCurrentSession`. No app, no database.
import {
  API_ERROR_CODES,
  ApiErrorSchema,
  CORE_API_OPERATIONS,
  LIST_CURSOR_PATTERN,
  SessionNoteRequestSchema,
  SessionStopRequestSchema,
  validateCoreApiResponse,
  type CoreApiRegistryOperation,
} from '@dems/shared/api';
import { SIM_TZ_OFFSET_MINUTES, simErrorCode, type CreateSessionResult, type PrecheckItem, type ScenarioName } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createHost } from '../../../../test/support/seed';
import { ApiFailure } from '../../../plugins/error-envelope';
import {
  NO_TEXT,
  SESSION_OPERATION_IDS,
  actionOf,
  bodySchemaOf,
  createRefusal,
  currentSessionResponse,
  cursorOf,
  notOpenSession,
  operationOf,
  positionOf,
  precheckBlocked,
  precheckRunning,
  precheckWarnings,
  readTextBody,
  sessionUnitLabel,
  successStatusesOf,
  successesOf,
  type SessionCommandId,
  type SessionOperationId,
} from '../index';
import { NOW } from './memory-engine';
import { CURRENT } from './support';

const answer = (failure: ApiFailure): [number, string, string, unknown] => [failure.statusCode, failure.code, failure.message, failure.details];

describe('the binding to the contract (operations.ts)', () => {
  it('operationOf gives the registry entry itself, and throws for a name the registry does not hold', () => {
    for (const operationId of SESSION_OPERATION_IDS) {
      expect(operationOf(operationId)).toBe(CORE_API_OPERATIONS.find((operation) => operation.operationId === operationId));
    }
    expect(() => operationOf('pauseSession' as SessionOperationId)).toThrow('the contract registry has no operation pauseSession');
  });

  it('actionOf throws when the contract binds no hosted action, or more than one, to an operation', () => {
    expect(actionOf('stopSession')).toBe('stopRecording');
    // A read has no action; `updateSettings` (another module's) has two; `signIn` is not hosted.
    for (const operationId of ['getCurrentSession', 'listSessionHistory', 'updateSettings', 'signIn']) {
      expect(() => actionOf(operationId as SessionCommandId), operationId).toThrow(/the sessions module expects exactly one/);
    }
  });

  it('successesOf accepts exactly the 2xx statuses the registry documents, in any order, and nothing else', () => {
    expect(successStatusesOf('createSession')).toEqual([200, 201]);
    expect(successesOf('createSession', [200, 201])).toEqual([200, 201]);
    expect(successesOf('createSession', [201, 200])).toEqual([201, 200]);
    expect(() => successesOf('createSession', [201])).toThrow('the contract documents the successes [200, 201] for createSession; the sessions module answers [201]');
    expect(() => successesOf('createSession', [200, 201, 202])).toThrow(/answers \[200, 201, 202\]/);
    expect(() => successesOf('cancelSession', [200])).toThrow(/documents the successes \[204\]/);
    expect(() => successesOf('cancelSession', [])).toThrow();
  });

  it('a registry that changed under the module stops the registration: a success the module does not know', () => {
    const operation = operationOf('stopSession') as { responses: CoreApiRegistryOperation['responses'] };
    const original = operation.responses;
    try {
      operation.responses = { ...original, 200: { description: 'a new success', schema: 'SessionCommandResponse' } };
      expect(() => successesOf('stopSession', [202])).toThrow('the contract documents the successes [200, 202] for stopSession; the sessions module answers [202]');
    } finally {
      operation.responses = original;
    }
    expect(successesOf('stopSession', [202])).toEqual([202]);
  });

  it('bodySchemaOf accepts the schema the registry names for the body of the operation, and no other', () => {
    expect(bodySchemaOf('stopSession', SessionStopRequestSchema)).toBe(SessionStopRequestSchema);
    expect(bodySchemaOf('addSessionNote', SessionNoteRequestSchema)).toBe(SessionNoteRequestSchema);
    expect(() => bodySchemaOf('stopSession', SessionNoteRequestSchema)).toThrow(
      'the contract names SessionStopRequest for the request body of stopSession; the sessions module validates it with another one',
    );
    // A copy of the schema is not the registry's schema.
    expect(() => bodySchemaOf('stopSession', SessionStopRequestSchema.describe('a copy'))).toThrow(/validates it with another one/);
    expect(() => bodySchemaOf('cancelSession', SessionStopRequestSchema)).toThrow(/names no schema for the request body of cancelSession/);
  });

  it('the label of a unit is a name of the pipeline\'s form', () => {
    expect(SESSION_OPERATION_IDS.map(sessionUnitLabel).every((label) => /^sessions\.[a-zA-Z]+$/.test(label) && label.length <= 64)).toBe(true);
  });
});

describe('the refusals (refusals.ts): status and code by the engine\'s table, details.simCode, a fixed text', () => {
  it('each refusal of the module', () => {
    expect(answer(notOpenSession())).toEqual([404, 'NOT_FOUND', 'This session is not the open session.', { simCode: 'NOT_FOUND' }]);
    expect(answer(precheckRunning())).toEqual([409, 'PRECHECK_RUNNING', 'Pre-recording checks are still running.', { simCode: 'CHECKS_RUNNING', from: 'PRECHECK', event: 'startRecording' }]);
    expect(answer(precheckWarnings())).toEqual([409, 'PRECHECK_WARNINGS', 'Acknowledge the warnings: send {"acknowledgeWarnings": true}.', { simCode: 'ILLEGAL_STATE', from: 'PRECHECK', event: 'startRecording' }]);
    // Each is an envelope the contract accepts, with a code of the contract's list.
    for (const failure of [notOpenSession(), precheckRunning(), precheckWarnings()]) {
      expect(ApiErrorSchema.safeParse({ error: { code: failure.code, message: failure.message, details: failure.details } }).success, failure.code).toBe(true);
      expect(API_ERROR_CODES, failure.code).toContain(failure.code);
    }
  });

  it('precheckBlocked names the blocking checks in order, by their reason or else their ID, and no other check', () => {
    const item = (id: string, status: PrecheckItem['status'], reason: string | null): PrecheckItem => ({ id: id as PrecheckItem['id'], status, value: null, reason, resolvesAt: null });
    const failure = precheckBlocked([item('CORE', 'BLOCK', 'Core link offline'), item('MIC_1', 'WARN', 'Mic 1: no signal'), item('STORAGE', 'BLOCK', null), item('TIME', 'PASS', null)]);
    expect(answer(failure)).toEqual([409, 'PRECHECK_BLOCKED', 'Start blocked: Core link offline; STORAGE', { simCode: 'ILLEGAL_STATE', from: 'PRECHECK', event: 'startRecording' }]);
  });

  it('createRefusal: the four reasons of the simulator\'s result; only SESSION_ACTIVE carries the open session', () => {
    const refused = (reason: Extract<CreateSessionResult, { ok: false }>['reason'], sessionId: string | null) => answer(createRefusal({ ok: false, reason, sessionId }));
    expect(refused('SESSION_ACTIVE', 'SES-20261001-0024')).toEqual([409, 'SESSION_ACTIVE', 'A session is active.', { simCode: 'SESSION_ACTIVE', sessionId: 'SES-20261001-0024' }]);
    expect(refused('SESSION_ACTIVE', null)).toEqual([409, 'SESSION_ACTIVE', 'A session is active.', { simCode: 'SESSION_ACTIVE' }]);
    expect(refused('INVALID_INPUT', 'SES-20261001-0024')).toEqual([422, 'INVALID_INPUT', 'The request does not match the expected input.', { simCode: 'INVALID_INPUT' }]);
    expect(refused('NOT_PERMITTED', null)).toEqual([403, 'NOT_PERMITTED', 'Your role does not allow this action.', { simCode: 'NOT_PERMITTED' }]);
    expect(refused('NOT_SIGNED_IN', null)).toEqual([401, 'NOT_SIGNED_IN', 'Sign in first.', { simCode: 'NOT_SIGNED_IN' }]);
  });
});

describe('the bodies of a stop and of a note (text-body.ts): what is the schema stage\'s and what is the hosted action\'s (decision D94)', () => {
  const stop = (body: unknown) => readTextBody(SessionStopRequestSchema, 'reason', body);
  const note = (body: unknown) => readTextBody(SessionNoteRequestSchema, 'text', body);
  /** Two UTF-16 code units, one character. */
  const ASTRAL = '\u{1F600}';

  it('a stop from five characters on is VALID, with the reason trimmed and unknown members dropped', () => {
    expect(stop({ reason: 'Done.' })).toEqual({ kind: 'VALID', value: { reason: 'Done.' } });
    expect(stop({ reason: '  Interview completed  ', by: 'OPR-009', at: 1 })).toEqual({ kind: 'VALID', value: { reason: 'Interview completed' } });
    expect(stop({ reason: ASTRAL.repeat(5) })).toEqual({ kind: 'VALID', value: { reason: ASTRAL.repeat(5) } });
  });

  it.each([
    ['four characters', { reason: 'Done' }],
    ['blanks around two characters', { reason: '  ab  ' }],
    ['the empty text', { reason: '' }],
    ['blanks only', { reason: '        ' }],
    ['no reason', {}],
    ['no reason beside other members', { why: 'Interview completed' }],
    // The contract counts three characters, the simulator six code units: the case the empty text is for.
    ['three two-unit characters', { reason: ASTRAL.repeat(3) }],
  ])('a stop, %s: TEXT_MISSING, the lower bound alone, which the hosted action refuses in its own order', (_name, body) => {
    expect(stop(body)).toEqual({ kind: 'TEXT_MISSING' });
  });

  it.each([
    ['a reason that is null', { reason: null }],
    ['a reason that is a number', { reason: 12_345 }],
    ['a reason that is a list', { reason: ['Interview completed'] }],
    ['a reason that is an object', { reason: { text: 'Interview completed' } }],
    ['a reason that is true', { reason: true }],
    ['U+0000 in a long reason', { reason: 'Interview\u0000completed' }],
    ['an unpaired surrogate', { reason: 'Inter\ud800view' }],
    // Short AND against the text rule: the text rule is the only issue, and it is the schema stage's.
    ['a short reason with U+0000', { reason: 'a\u0000' }],
    ['a body that is a text', 'Interview completed'],
    ['a body that is a list', [{ reason: 'Interview completed' }]],
    ['a body that is null', null],
    ['no body', undefined],
  ])('a stop, %s: INVALID, the shape of the body, answered before the engine', (_name, body) => {
    expect(stop(body)).toEqual({ kind: 'INVALID' });
  });

  it('a note: VALID from one character to 2,000; TEXT_MISSING when it is absent or empty; INVALID when it is too long or no text', () => {
    expect(note({ text: '  Subject asked for a break  ' })).toEqual({ kind: 'VALID', value: { text: 'Subject asked for a break' } });
    expect(note({ text: 'n'.repeat(2_000) }).kind).toBe('VALID');
    expect(note({ text: ASTRAL })).toEqual({ kind: 'VALID', value: { text: ASTRAL } });
    for (const body of [{ text: '' }, { text: '   ' }, {}, { note: 'in another member' }]) expect(note(body), JSON.stringify(body)).toEqual({ kind: 'TEXT_MISSING' });
    // The maximum is the schema stage's: 2,001 characters, and 1,001 two-unit characters (2,002 code units).
    for (const body of [{ text: 'n'.repeat(2_001) }, { text: ASTRAL.repeat(1_001) }, { text: 7 }, { text: null }, { text: 'a\u0000b' }, { text: '\u0000' }, 'text', null]) {
      expect(note(body), JSON.stringify(body).slice(0, 40)).toEqual({ kind: 'INVALID' });
    }
  });

  it('only the lower bound of the NAMED member counts, alone and at the top of the body', () => {
    const two = z.object({ reason: z.string().min(5), other: z.string().min(1) });
    expect(readTextBody(two, 'reason', { reason: 'x', other: 'present' })).toEqual({ kind: 'TEXT_MISSING' });
    // Another member is too short as well, or instead: not the one cause.
    expect(readTextBody(two, 'reason', { reason: 'x', other: '' })).toEqual({ kind: 'INVALID' });
    expect(readTextBody(two, 'reason', { reason: 'long enough', other: '' })).toEqual({ kind: 'INVALID' });
    expect(readTextBody(two, 'reason', { reason: 'long enough' })).toEqual({ kind: 'INVALID' });
    // A member of the same name deeper in the body is another member.
    const nested = z.object({ inner: z.object({ reason: z.string().min(5) }) });
    expect(readTextBody(nested, 'reason', { inner: { reason: 'x' } })).toEqual({ kind: 'INVALID' });
    // Too long is not the lower bound.
    expect(readTextBody(z.object({ reason: z.string().min(5).max(8) }), 'reason', { reason: 'far too long' })).toEqual({ kind: 'INVALID' });
  });

  it('NO_TEXT is the empty text, and both hosted actions refuse it; the refused text itself they could accept', async () => {
    expect(NO_TEXT).toBe('');
    const refusedWith = (work: () => void): string | null => {
      try {
        work();
        return 'accepted';
      } catch (error) {
        return simErrorCode(error);
      }
    };
    const recording = async () => {
      const host = await createHost({ scenario: 'recording', startAt: NOW });
      return { host, operator: host.operator('INVESTIGATOR') };
    };
    const first = await recording();
    expect(refusedWith(() => first.host.runAs(first.operator, () => first.host.sim.actions.addNote(NO_TEXT)))).toBe('NOTE_INVALID');
    expect(refusedWith(() => first.host.runAs(first.operator, () => first.host.sim.actions.stopRecording(NO_TEXT)))).toBe('REASON_TOO_SHORT');
    expect(first.host.state().session?.state).toBe('RECORDING');
    // Why the refused text never reaches the engine: the simulator counts code units, and takes
    // three two-unit characters for a reason of six.
    expect(stop({ reason: ASTRAL.repeat(3) })).toEqual({ kind: 'TEXT_MISSING' });
    const second = await recording();
    expect(refusedWith(() => second.host.runAs(second.operator, () => second.host.sim.actions.stopRecording(ASTRAL.repeat(3))))).toBe('accepted');
    expect(second.host.state().session?.state).toBe('STOPPING');
  });
});

describe('the cursor of the history (history.ts)', () => {
  it('a cursor is `<endedAt>-<session ID>`, fits the contract\'s pattern, and reads back to its position', () => {
    const entry = { endedAt: 1_790_819_100_000, id: 'SES-20261001-0022' };
    expect(cursorOf(entry)).toBe('1790819100000-SES-20261001-0022');
    expect(cursorOf(entry)).toMatch(LIST_CURSOR_PATTERN);
    expect(positionOf(cursorOf(entry))).toEqual(entry);
    expect(positionOf('0-SES-00000000-0000')).toEqual({ endedAt: 0, id: 'SES-00000000-0000' });
    expect(positionOf(`${Number.MAX_SAFE_INTEGER}-SES-20261001-0022`)).toEqual({ endedAt: Number.MAX_SAFE_INTEGER, id: 'SES-20261001-0022' });
  });

  it.each([
    '',
    'abc',
    '1790819100000',
    '1790819100000-',
    '-SES-20261001-0022',
    'SES-20261001-0022',
    '1790819100000-SES-20261001-002',
    '1790819100000-SES-20261001-00222',
    '1790819100000-ses-20261001-0022',
    '1790819100000-EV-20261001-0022',
    '1790819100000-SES-20261001-0022-1',
    '17908191000.5-SES-20261001-0022',
    '1e12-SES-20261001-0022',
    '0x10-SES-20261001-0022',
    ' 1790819100000-SES-20261001-0022',
    // 16 digits, above the largest safe integer: the instant would not be the one that was sent.
    '9007199254740992-SES-20261001-0022',
    '9999999999999999-SES-20261001-0022',
    '99999999999999999-SES-20261001-0022',
  ])('%j is no position', (cursor) => {
    expect(positionOf(cursor)).toBeNull();
  });
});

describe('the answer of getCurrentSession (current.ts)', () => {
  it('null without a session; the server time is the instant given, in UTC+07:00', () => {
    expect(currentSessionResponse({ session: null, operators: [] }, NOW)).toEqual({ session: null, serverTime: '2026-10-01T10:00:00.000+07:00' });
    expect(currentSessionResponse({ session: null, operators: [] }, NOW + 1)).toEqual({ session: null, serverTime: '2026-10-01T10:00:00.001+07:00' });
    expect(SIM_TZ_OFFSET_MINUTES).toBe(420);
  });

  it.each(['recording', 'finalizing', 'fault-demo'] as const satisfies readonly ScenarioName[])(
    'scenario %s: built from the session and the operators ALONE, it is the simulator\'s own REST answer and validates against the contract',
    async (scenario) => {
      const host = await createHost({ scenario, startAt: NOW });
      host.drive(1_000);
      const state = host.state();
      expect(state.session).not.toBeNull();
      // Only the two members the function is typed to read: nothing else of a state reaches it.
      const response = currentSessionResponse({ session: state.session, operators: state.operators }, host.now());
      expect(response).toEqual(host.sim.request({ method: 'GET', path: CURRENT }).body);
      expect(validateCoreApiResponse('getCurrentSession', 200, response)).toEqual({ ok: true });
    },
  );

  it('PASS D11 - `captureDurable` is carried exactly as the session of the state says it: explicit false while the cameras connect, explicit true where the Core\'s real capture states it, absent otherwise; each answer validates against the contract', async () => {
    const host = await createHost({ scenario: 'recording', startAt: NOW });
    const state = host.state();
    if (state.session === null) throw new Error('the scenario holds no session');
    const answer = (session: typeof state.session) => currentSessionResponse({ session, operators: state.operators }, host.now());
    const { captureDurable: _held, ...plain } = state.session;
    // Absent in the state (the simulator's own capture, durable): absent in the answer - never invented.
    expect('captureDurable' in (answer(plain).session ?? {})).toBe(false);
    for (const said of [false, true]) {
      const response = answer({ ...plain, captureDurable: said });
      expect(response.session?.captureDurable).toBe(said);
      expect(validateCoreApiResponse('getCurrentSession', 200, response)).toEqual({ ok: true });
    }
    // CONTROL: nothing else of the answer moves with the member.
    const { captureDurable: _said, ...rest } = answer({ ...plain, captureDurable: false }).session ?? {};
    expect(rest).toEqual(answer(plain).session);
  });

  it('the recording time is counted to the instant given, not to the engine\'s published clock; an investigator who is not among the operators has an empty name', async () => {
    const host = await createHost({ scenario: 'recording', startAt: NOW });
    const state = host.state();
    const started = state.session?.startedAt ?? 0;
    const at = (now: number) => currentSessionResponse({ session: state.session, operators: [] }, now).session;
    expect(at(started + 1)?.elapsedMs).toBe(1);
    expect(at(started + 123_456)?.elapsedMs).toBe(123_456);
    // An instant before the start (a clock that was set back) is no negative time.
    expect(at(started - 5_000)?.elapsedMs).toBe(0);
    expect(at(started + 1)?.investigatorName).toBe('');
  });

  it('a session the contract\'s schema refuses is a defect of the shared code: thrown, never sent', async () => {
    const host = await createHost({ scenario: 'recording', startAt: NOW });
    const state = host.state();
    const broken = { ...(state.session as NonNullable<typeof state.session>), id: 'not-a-session-id' };
    expect(() => currentSessionResponse({ session: broken, operators: state.operators }, NOW)).toThrow();
  });
});
