// Simulated §21.2 REST handlers (masterplan/01_specs.md §14.7 `api.ts`, §14.9; AC-58 sim side):
// x-dems-simulated: 1 on every response; export follows the signed-in role (INVESTIGATOR 403
// plus an audit row, SUPERVISOR 202); the health endpoint is LIVE, not simulated.
import { describe, expect, it } from 'vitest';
import {
  createManualClock,
  createSim,
  SIM_API_ROUTES,
  type ApiCurrentSessionBody,
  type ApiDeviceHealth,
  type ApiStorageStatus,
  type ScenarioName,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB
const ORIGIN = 'http://127.0.0.1:4400';

function harness(scenario: ScenarioName = 'idle') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += 50) {
      clock.advance(50);
      sim.tick();
    }
  };
  return { sim, run, state: () => sim.store.getState() };
}

const CREATE_BODY = {
  caseNumber: 'LP/2026/1001-0008',
  subjectType: 'SAKSI',
  subjectName: 'API Saksi',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
};

describe('routes', () => {
  it('lists the 9 simulated §21.2 operations', () => {
    expect(SIM_API_ROUTES).toHaveLength(9);
    expect(new Set(SIM_API_ROUTES.map((route) => route.operationId)).size).toBe(9);
  });

  it('marks every response simulated and JSON, including errors', () => {
    const h = harness();
    for (const response of [
      h.sim.request({ method: 'GET', path: '/api/v1/session/current' }),
      h.sim.request({ method: 'GET', path: '/api/v1/nope' }),
    ]) {
      expect(response.headers).toMatchObject({ 'x-dems-simulated': '1', 'content-type': 'application/json' });
    }
  });

  it('404 for unknown paths and for the LIVE health endpoint; 405 for a wrong method; 400 for bad JSON', () => {
    const h = harness();
    expect(h.sim.request({ method: 'GET', path: '/api/v1/health' }).status).toBe(404);
    const wrong = h.sim.request({ method: 'POST', path: '/api/v1/storage/status' });
    expect(wrong).toMatchObject({ status: 405, headers: { allow: 'GET' } });
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    expect(h.sim.request({ method: 'POST', path: '/api/v1/session', body: '{not json' }).status).toBe(400);
    expect(h.sim.errors()).toEqual([]);
  });

  it('accepts a full URL with a query string', () => {
    const h = harness();
    expect(h.sim.request({ method: 'GET', path: `${ORIGIN}/api/v1/storage/status/?x=1` }).status).toBe(200);
  });
});

describe('session endpoints', () => {
  it('GET /session/current: null when idle, the canonical recording in the recording scenario', () => {
    expect((harness().sim.request({ method: 'GET', path: '/api/v1/session/current' }).body as ApiCurrentSessionBody).session).toBeNull();
    const body = harness('recording').sim.request({ method: 'GET', path: '/api/v1/session/current' }).body as ApiCurrentSessionBody;
    expect(body.session).toMatchObject({
      id: 'SES-20261001-0024',
      state: 'RECORDING',
      caseNumber: 'LP/2026/1001-0007',
      subjectName: 'Ahmad Fauzi',
      subjectType: 'TERSANGKA',
      investigatorName: 'AKP Budi Santoso',
      elapsedMs: (18 * 60 + 42) * 1_000,
    });
    expect(body.session?.startedAt).toMatch(/^2026-10-01T09:41:18\.000\+07:00$/);
    expect(body.serverTime).toBe('2026-10-01T10:00:00.000+07:00');
  });

  it('POST /session → 201, the same body again → 200 (S26), another body → 409; 401 signed out; 422 invalid', () => {
    const h = harness();
    expect(h.sim.request({ method: 'POST', path: '/api/v1/session', body: CREATE_BODY }).status).toBe(401);
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    expect(h.sim.request({ method: 'POST', path: '/api/v1/session', body: { ...CREATE_BODY, subjectName: '' } }).status).toBe(422);
    const created = h.sim.request({ method: 'POST', path: '/api/v1/session', body: JSON.stringify(CREATE_BODY) });
    expect(created).toMatchObject({ status: 201, body: { sessionId: 'SES-20261001-0024', state: 'CREATE', created: true } });
    expect(h.sim.request({ method: 'POST', path: '/api/v1/session', body: CREATE_BODY })).toMatchObject({ status: 200, body: { created: false } });
    expect(h.sim.request({ method: 'POST', path: '/api/v1/session', body: { ...CREATE_BODY, subjectName: 'Other' } })).toMatchObject({
      status: 409,
      body: { error: { code: 'SESSION_ACTIVE' } },
    });
  });

  it('start runs the precheck (202), then starts the recording (200); stop needs a reason (422), then 202', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.sim.request({ method: 'POST', path: '/api/v1/session', body: CREATE_BODY });
    const id = h.state().session?.id ?? '';
    expect(h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/start` })).toMatchObject({ status: 202, body: { state: 'PRECHECK' } });
    expect(h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/start` })).toMatchObject({ status: 409, body: { error: { code: 'PRECHECK_RUNNING' } } });
    h.run(5_000);
    expect(h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/start` })).toMatchObject({ status: 200, body: { state: 'RECORDING' } });
    expect(h.sim.request({ method: 'POST', path: '/api/v1/session/SES-X/stop', body: { reason: 'Interview completed' } }).status).toBe(404);
    expect(h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/stop`, body: { reason: 'ok' } }).status).toBe(422);
    expect(h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/stop`, body: { reason: 'Interview completed' } })).toMatchObject({
      status: 202,
      body: { state: 'STOPPING' },
    });
    expect(h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/stop`, body: { reason: 'Interview completed' } }).status).toBe(409);
  });

  it('a blocked precheck answers 409 PRECHECK_BLOCKED with the reason', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    h.sim.request({ method: 'POST', path: '/api/v1/session', body: CREATE_BODY });
    const id = h.state().session?.id ?? '';
    h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/start` });
    h.run(5_000);
    const blocked = h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/start` });
    expect(blocked).toMatchObject({ status: 409, body: { error: { code: 'PRECHECK_BLOCKED' } } });
    expect(JSON.stringify(blocked.body)).toContain('Camera 1 lens fault');
  });
});

describe('status endpoints', () => {
  it('storage/status: 20% used, 3.2 TB free, estimate from 8.2 GB/h', () => {
    const body = harness().sim.request({ method: 'GET', path: '/api/v1/storage/status' }).body as ApiStorageStatus;
    expect(body).toMatchObject({ state: 'READY', usedPercent: 20, totalBytes: 4e12, usedBytes: 804e9, freeBytes: 3_196e9 });
    expect(body.volumes).toHaveLength(2);
    expect(body.retention).toEqual({ policy: 'DAYS_90', days: 90, autoArchive: true });
  });

  it('device/health, audio/status and video/status reflect the live state', () => {
    const h = harness('fault-demo');
    const health = h.sim.request({ method: 'GET', path: '/api/v1/device/health' }).body as ApiDeviceHealth;
    expect(health.systemState).toBe('CRITICAL');
    expect(health.time.source).toBe('NTP');
    expect(health.services.find((service) => service.name === 'Video Management Service')?.status).toBe('DEGRADED');
    const audio = h.sim.request({ method: 'GET', path: '/api/v1/audio/status' }).body as { channels: { trackId: string; clip: boolean }[] };
    expect(audio.channels.map((channel) => [channel.trackId, channel.clip])).toEqual([['AUDIO-01', false], ['AUDIO-02', true]]);
    const video = h.sim.request({ method: 'GET', path: '/api/v1/video/status' }).body as { tracks: { trackId: string; recState: string | null }[] };
    expect(video.tracks.map((track) => [track.trackId, track.recState])).toEqual([['VIDEO-01', 'REC'], ['VIDEO-02', 'LOST']]);
  });
});

describe('POST /evidence/{id}/export (RBAC + audit, S20)', () => {
  const path = (id: string) => `/api/v1/evidence/${id}/export`;
  const body = { reason: 'Prosecutor request', destination: 'Kejaksaan Negeri (simulated)' };

  it('401 signed out; INVESTIGATOR 403 with an EXPORT_DENIED row; SUPERVISOR 202 with EVIDENCE_EXPORTED', () => {
    const h = harness();
    const id = h.state().evidence[0]?.id ?? '';
    expect(h.sim.request({ method: 'POST', path: path(id), body }).status).toBe(401);

    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    const denied = h.sim.request({ method: 'POST', path: path(id), body });
    expect(denied).toMatchObject({ status: 403, body: { error: { code: 'FORBIDDEN' } } });
    expect(h.state().audit.rows.at(-1)).toMatchObject({
      type: 'EXPORT_DENIED',
      actorId: 'OPR-001',
      evidenceId: id,
      details: { role: 'INVESTIGATOR', eventKind: 'UNAUTHORIZED_EXPORT' },
    });

    h.sim.actions.signOut();
    h.sim.actions.signIn('andi.pratama', 'demo-2026');
    const accepted = h.sim.request({ method: 'POST', path: path(id), body });
    expect(accepted).toMatchObject({ status: 202, body: { evidenceId: id, status: 'EXPORTED' } });
    expect(h.state().evidence[0]).toMatchObject({ status: 'EXPORTED', lifecycleStage: 'AUTHORIZED_EXPORT_TRANSFER' });
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_EXPORTED', actorId: 'OPR-002', details: { destination: body.destination } });
  });

  it('404 unknown, 409 unsealed (RECORDED), 409 while a security fault is active, 422 without a reason', () => {
    const h = harness();
    h.sim.actions.signIn('andi.pratama', 'demo-2026');
    expect(h.sim.request({ method: 'POST', path: path('EV-19700101-9999'), body }).status).toBe(404);
    const recorded = h.state().evidence.find((item) => item.status === 'RECORDED')?.id ?? '';
    expect(h.sim.request({ method: 'POST', path: path(recorded), body })).toMatchObject({ status: 409, body: { error: { code: 'NOT_SEALED' } } });
    const sealed = h.state().evidence[0]?.id ?? '';
    expect(h.sim.request({ method: 'POST', path: path(sealed), body: { reason: 'no' } }).status).toBe(422);
    h.sim.actions.inject('TPM_FAILURE');
    expect(h.sim.request({ method: 'POST', path: path(sealed), body })).toMatchObject({ status: 409, body: { error: { code: 'SECURITY_FAULT' } } });
  });
});
