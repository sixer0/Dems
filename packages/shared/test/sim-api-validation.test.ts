// Step 54 (review 40 §5.d M6, §5.e M5, §5.f m6; D62; SIM-GAP-W53-1..4, D101): the simulated create
// validates with the documented schema; session commands need SESSION_START; `sim.request` never
// throws; any method is accepted by the request type and answered 404 / 405.
import { describe, expect, it } from 'vitest';
import { API_TEXT_RULE_MESSAGE, validateCoreApiResponse } from '../src/api';
import {
  createManualClock,
  createSim,
  SimPermissionError,
  type ScenarioName,
  type SimApiResponse,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

function harness(operator: 'budi.santoso' | 'andi.pratama' | 'rina.wijaya' | null, scenario: ScenarioName = 'idle') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  if (operator) sim.actions.signIn(operator, 'demo-2026');
  const call = (method: string, path: string, body?: unknown) => sim.request({ method, path, ...(body !== undefined ? { body } : {}) });
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += 100) {
      clock.advance(100);
      sim.tick();
    }
  };
  return { sim, call, run, state: () => sim.store.getState() };
}

const CREATE_BODY = {
  caseNumber: 'LP/2026/1001-0008',
  subjectType: 'SAKSI',
  subjectName: 'API Saksi',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
};

const code = (response: SimApiResponse) => (response.body as { error?: { code: string; message: string } }).error;

describe('POST /api/v1/session (D62, review 40 §5.d)', () => {
  it('signed in, caseNumber "ABC" → 422 INVALID_INPUT naming the field and the i18n key', () => {
    const h = harness('budi.santoso');
    const response = h.call('POST', '/api/v1/session', { ...CREATE_BODY, caseNumber: 'ABC' });
    expect(response.status).toBe(422);
    expect(code(response)).toEqual({ code: 'INVALID_INPUT', message: 'caseNumber: sessionNew.info.caseNumber.invalid' });
    expect(validateCoreApiResponse('createSession', 422, response.body)).toEqual({ ok: true });
    expect(h.state().session).toBeNull();
  });

  it('the API demands every documented field (no room → 422), while actions.createSession keeps the room default', () => {
    const { room: _room, ...withoutRoom } = CREATE_BODY;
    const api = harness('budi.santoso');
    expect(api.call('POST', '/api/v1/session', withoutRoom).status).toBe(422);
    const action = harness('budi.santoso');
    expect(action.sim.actions.createSession(withoutRoom as never)).toMatchObject({ ok: true, created: true });
    expect(action.state().session?.input.room).toBe('Interview Room 1');
  });

  it('signed out with a valid body while a session is active → 401 (never 200 or 409)', () => {
    const h = harness('budi.santoso');
    expect(h.call('POST', '/api/v1/session', CREATE_BODY).status).toBe(201);
    h.sim.actions.signOut();
    const response = h.call('POST', '/api/v1/session', { ...CREATE_BODY, subjectName: 'Other' });
    expect(response.status).toBe(401);
    expect(code(response)?.code).toBe('NOT_SIGNED_IN');
  });

  it('TECHNICIAN → 403; valid → 201, then the same body → 200; every response matches the contract', () => {
    const technician = harness('rina.wijaya');
    const denied = technician.call('POST', '/api/v1/session', CREATE_BODY);
    expect(denied.status).toBe(403);
    expect(validateCoreApiResponse('createSession', 403, denied.body)).toEqual({ ok: true });
    const h = harness('budi.santoso');
    const created = h.call('POST', '/api/v1/session', CREATE_BODY);
    expect(created.status).toBe(201);
    expect(validateCoreApiResponse('createSession', 201, created.body)).toEqual({ ok: true });
    const replay = h.call('POST', '/api/v1/session', CREATE_BODY);
    expect(replay.status).toBe(200);
    expect(validateCoreApiResponse('createSession', 200, replay.body)).toEqual({ ok: true });
  });

  it('actions.createSession validates with the same schema (UI and API agree)', () => {
    const h = harness('budi.santoso');
    expect(h.sim.actions.createSession({ ...CREATE_BODY, caseNumber: 'ABC' } as never)).toEqual({
      ok: false,
      reason: 'INVALID_INPUT',
      sessionId: null,
    });
    // Auth runs before validation and before the idempotency branch.
    const signedOut = harness(null);
    expect(signedOut.sim.actions.createSession({ ...CREATE_BODY, caseNumber: 'ABC' } as never)).toMatchObject({ reason: 'NOT_SIGNED_IN' });
  });
});

// Backend task 2026-10-04, plan row W19 (01_specs API-13): the create schema is shared with the Core
// server, so the simulated create refuses the same ill-formed text.
describe('POST /api/v1/session refuses U+0000 and an unpaired surrogate in a text field (API-13)', () => {
  it.each([
    ['U+0000', 'API\u0000Saksi'],
    ['an unpaired surrogate', 'API Saksi \ud83d'],
  ])('%s in subjectName → 422 INVALID_INPUT naming the field, and nothing is created', (_name, subjectName) => {
    const h = harness('budi.santoso');
    const response = h.call('POST', '/api/v1/session', { ...CREATE_BODY, subjectName });
    expect(response.status).toBe(422);
    expect(code(response)).toEqual({ code: 'INVALID_INPUT', message: `subjectName: ${API_TEXT_RULE_MESSAGE}` });
    expect(validateCoreApiResponse('createSession', 422, response.body)).toEqual({ ok: true });
    expect(h.state().session).toBeNull();
    expect(h.sim.actions.createSession({ ...CREATE_BODY, subjectName } as never)).toEqual({ ok: false, reason: 'INVALID_INPUT', sessionId: null });
  });

  it('well-formed text outside the Basic Multilingual Plane is still accepted', () => {
    const h = harness('budi.santoso');
    const response = h.call('POST', '/api/v1/session', { ...CREATE_BODY, subjectName: 'API Saksi \ud83d\ude00' });
    expect(response.status).toBe(201);
    expect(h.state().session?.input.subjectName).toBe('API Saksi \ud83d\ude00');
  });
});

describe('start and stop need SESSION_START; the audit actor is the signed-in operator (review 40 §5.e, M5)', () => {
  it('signed out: start and stop answer 401 and change nothing; the actions throw NOT_SIGNED_IN', () => {
    const h = harness(null, 'recording');
    const id = h.state().session?.id ?? '';
    const stop = h.call('POST', `/api/v1/session/${id}/stop`, { reason: 'Interview completed' });
    expect(stop.status).toBe(401);
    expect(validateCoreApiResponse('stopSession', 401, stop.body)).toEqual({ ok: true });
    expect(h.call('POST', `/api/v1/session/${id}/start`).status).toBe(401);
    expect(h.state().session?.state).toBe('RECORDING');
    expect(() => h.sim.actions.stopRecording('Interview completed')).toThrow(SimPermissionError);
    try {
      h.sim.actions.stopRecording('Interview completed');
    } catch (error) {
      expect((error as SimPermissionError).code).toBe('NOT_SIGNED_IN');
    }
  });

  it('TECHNICIAN: 403 NOT_PERMITTED on start and stop; the actions throw NOT_PERMITTED', () => {
    const h = harness('rina.wijaya', 'recording');
    const id = h.state().session?.id ?? '';
    const response = h.call('POST', `/api/v1/session/${id}/stop`, { reason: 'Interview completed' });
    expect(response.status).toBe(403);
    expect(code(response)?.code).toBe('NOT_PERMITTED');
    expect(validateCoreApiResponse('stopSession', 403, response.body)).toEqual({ ok: true });
    expect(h.call('POST', `/api/v1/session/${id}/start`).status).toBe(403);
    expect(() => h.sim.actions.cancel()).toThrow(SimPermissionError);
    expect(() => h.sim.actions.stopRecording('Interview completed')).toThrow(/needs permission SESSION_START/);
  });

  it('a SUPERVISOR who stops a session the investigator started is the RECORDING_STOPPED actor', () => {
    const h = harness('andi.pratama', 'recording');
    expect(h.state().session?.createdBy).toBe('OPR-001');
    h.sim.actions.stopRecording('Supervisor ended the interview');
    const row = h.state().audit.rows.findLast((entry) => entry.type === 'RECORDING_STOPPED');
    expect(row?.actorId).toBe('OPR-002');
  });

  it('the engine arms a clean PASS by itself: the creator, labelled details.by = system', () => {
    const h = harness('budi.santoso');
    h.sim.actions.createSession(CREATE_BODY as never);
    h.sim.actions.beginPrecheck();
    h.run(6_000);
    const row = h.state().audit.rows.findLast((entry) => entry.type === 'PRECHECK_PASSED');
    expect(row).toMatchObject({ actorId: 'OPR-001', details: { by: 'system', warnings: 0 } });
  });
});

describe('sim.request never throws (review 40 m6; SIM-GAP-W53-1, W53-2)', () => {
  it('malformed percent-encoding → 400 INVALID_PATH', () => {
    const h = harness('budi.santoso');
    const response = h.call('POST', '/api/v1/session/%E0%A4%A/start');
    expect(response.status).toBe(400);
    expect(code(response)?.code).toBe('INVALID_PATH');
    expect(response.headers['x-dems-simulated']).toBe('1');
  });

  it('a method the simulator does not model → 405 with Allow on a known path, 404 elsewhere', () => {
    const h = harness('budi.santoso');
    const put = h.call('PUT', '/api/v1/session/current', '{}');
    expect(put.status).toBe(405);
    expect(put.headers.allow).toBe('GET');
    expect(h.call('DELETE', '/api/v1/nowhere').status).toBe(404);
  });

  it('garbage requests answer instead of throwing', () => {
    const h = harness('budi.santoso');
    expect(h.sim.request({ method: 'GET', path: undefined as unknown as string }).status).toBe(400);
    expect(h.sim.request({ method: undefined as unknown as string, path: '/api/v1/session/current' }).status).toBe(405);
    expect(h.sim.errors()).toEqual([]);
  });
});
