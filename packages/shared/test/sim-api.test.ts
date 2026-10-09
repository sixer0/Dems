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
  it('lists the 30 simulated operations (9 book §21.2, the 13 of schema v2 (OD-17), the 3 STT configuration ops 90-92 (C3 §2.5) and the 5 camera-search ops 93-97 (C3 §2.6))', () => {
    expect(SIM_API_ROUTES).toHaveLength(30);
    expect(new Set(SIM_API_ROUTES.map((route) => route.operationId)).size).toBe(30);
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
    // Schema v2 (SH-15/SH-17): the read is keyed by the microphone INPUT, plus the active one.
    const audio = h.sim.request({ method: 'GET', path: '/api/v1/audio/status' }).body as {
      channels: { inputId: string; role: string; clip: boolean }[];
      activeInputId: string;
    };
    expect(audio.channels.map((channel) => [channel.inputId, channel.role, channel.clip])).toEqual([
      ['MIC-01', 'PRIMARY', false],
      ['MIC-02', 'STANDBY', true],
    ]);
    expect(audio.activeInputId).toBe('MIC-01');
    const healthAudio = (h.sim.request({ method: 'GET', path: '/api/v1/device/health' }).body as ApiDeviceHealth).audio;
    expect(healthAudio.map((input) => [input.inputId, input.role])).toEqual([
      ['MIC-01', 'PRIMARY'],
      ['MIC-02', 'STANDBY'],
    ]);
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
    // Schema v2 (C3 §3 op 42): the answer is the queue receipt; the item's lifecycle is separate.
    expect(accepted).toMatchObject({ status: 202, body: { evidenceId: id, status: 'QUEUED' } });
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

// ── Schema v2 capture paths (task 3 M2-W9b, blueprint row 51a; OD-17; C3 §2 ops 76-87, 89) ──────

interface CaptureConfigBody {
  cameras: { trackId: string; deviceId: string; streamState: string }[];
  mics: { inputId: string; deviceId: string; role: string }[];
  locked: boolean;
  updatedAt: number;
}

const CAPTURE_CONFIG_PATH = '/api/v1/capture/config';
const CAPTURE_DEVICES_PATH = '/api/v1/capture/devices';

describe('GET /capture/config and /capture/devices (ops 76/77)', () => {
  it('answers a signed-in operator with the two slices and nothing that reads like a credential', () => {
    const h = harness();
    expect(h.sim.request({ method: 'GET', path: CAPTURE_CONFIG_PATH }).status).toBe(401);
    expect(h.sim.request({ method: 'GET', path: CAPTURE_DEVICES_PATH }).status).toBe(401);
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    const config = h.sim.request({ method: 'GET', path: CAPTURE_CONFIG_PATH }).body as CaptureConfigBody;
    expect(config.cameras.map((camera) => [camera.trackId, camera.deviceId, camera.streamState])).toEqual([
      ['VIDEO-01', 'CAM-01', 'LIVE'],
      ['VIDEO-02', 'CAM-02', 'LIVE'],
    ]);
    expect(config.mics.map((mic) => [mic.inputId, mic.role])).toEqual([
      ['MIC-01', 'PRIMARY'],
      ['MIC-02', 'STANDBY'],
    ]);
    expect(config.locked).toBe(false);
    const devices = h.sim.request({ method: 'GET', path: CAPTURE_DEVICES_PATH }).body as { devices: { id: string; kind: string }[] };
    expect(devices.devices.map((device) => [device.id, device.kind])).toEqual([
      ['CAM-01', 'CAMERA'],
      ['CAM-02', 'CAMERA'],
      ['MIC-01', 'MIC'],
      ['MIC-02', 'MIC'],
      ['POE-SWITCH', 'POE'],
    ]);
    // RK-12: no member of any capture answer is a credential.
    expect(JSON.stringify(devices)).not.toMatch(/secret|password|username/i);
  });
});

describe('POST /capture/* (ops 78/79/80/89): RBAC, the idle lock, the audit rows', () => {
  it('refuses INVESTIGATOR, validates the body, edits while idle and audits every change', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    expect(
      h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: { mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02' }] } }),
    ).toMatchObject({ status: 403, body: { error: { code: 'NOT_PERMITTED' } } });

    h.sim.actions.signOut();
    h.sim.actions.signIn('rina.wijaya', 'demo-2026');
    expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: '[1]' }).status).toBe(400);
    expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: { cameras: [{ trackId: 'VIDEO-09', deviceId: 'CAM-01' }] } }).status).toBe(422);

    // Decision D106 (3): the facade runs the transition of the hosted action `setCaptureConfig`. So it
    // refuses what the Core server refuses (an unknown device, one camera on both tracks with one
    // profile, one microphone behind both inputs), and a refused edit writes no row.
    const rowsBefore = h.state().audit.rows.length;
    expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-77' }] } }).status).toBe(422);
    expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'MIC-01' }] } }).status).toBe(422);
    expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] } }).status).toBe(422);
    expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-02' }] } }).status).toBe(422);
    expect(h.state().audit.rows).toHaveLength(rowsBefore);
    expect(h.state().captureConfig.cameras.map((camera) => camera.deviceId)).toEqual(['CAM-01', 'CAM-02']);

    // The two cameras swap their tracks: one row per line that changed, with exactly the keys of C3 §5.2.
    const updated = h.sim.request({
      method: 'POST',
      path: CAPTURE_CONFIG_PATH,
      body: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] },
    });
    expect((updated.body as CaptureConfigBody).cameras.map((camera) => camera.deviceId)).toEqual(['CAM-02', 'CAM-01']);
    expect(h.state().audit.rows).toHaveLength(rowsBefore + 2);
    expect(h.state().audit.rows.slice(-2).map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['CAPTURE_CONFIG_CHANGED', 'OPR-003', { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-01', deviceId: 'CAM-02', from: 'CAM-01', to: 'CAM-02', permission: 'CAPTURE_CONFIG' }],
      ['CAPTURE_CONFIG_CHANGED', 'OPR-003', { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-02', deviceId: 'CAM-01', from: 'CAM-02', to: 'CAM-01', permission: 'CAPTURE_CONFIG' }],
    ]);
    // An edit that changes nothing answers 200 and writes no row (the hosted action's rule).
    expect(h.sim.request({ method: 'POST', path: '/api/v1/capture/cameras/CAM-01/source', body: { trackId: 'VIDEO-02' } }).status).toBe(200);
    expect(h.state().audit.rows).toHaveLength(rowsBefore + 2);
    expect(h.sim.request({ method: 'POST', path: '/api/v1/capture/cameras/GHOST/source', body: { trackId: 'VIDEO-02' } }).status).toBe(404);

    const primary = h.sim.request({ method: 'POST', path: '/api/v1/capture/mics/MIC-02/primary' });
    expect((primary.body as CaptureConfigBody).mics.map((mic) => [mic.inputId, mic.role])).toEqual([
      ['MIC-01', 'STANDBY'],
      ['MIC-02', 'PRIMARY'],
    ]);
    expect(h.state().audit.rows.at(-1)).toMatchObject({
      type: 'CAPTURE_CONFIG_CHANGED',
      details: { operationId: 'setPrimaryMic', scope: 'MIC', field: 'ROLE', inputId: 'MIC-02', deviceId: 'MIC-02', from: 'STANDBY', to: 'PRIMARY', permission: 'CAPTURE_CONFIG' },
    });
    expect(Object.keys(h.state().audit.rows.at(-1)?.details ?? {}).sort()).toEqual(['deviceId', 'field', 'from', 'inputId', 'operationId', 'permission', 'scope', 'to']);
    // The health read follows the selector (op 44 v2).
    const health = h.sim.request({ method: 'GET', path: '/api/v1/device/health' }).body as ApiDeviceHealth;
    expect([health.activeInputId, health.audio[0]?.role, health.audio[1]?.role]).toEqual(['MIC-01', 'STANDBY', 'PRIMARY']);
  });

  it('stores a credential write-only: the answer is the selector and the row names the device (RK-12)', () => {
    const h = harness();
    h.sim.actions.signIn('rina.wijaya', 'demo-2026');
    expect(h.sim.request({ method: 'POST', path: '/api/v1/capture/devices/CAM-01/credential', body: { username: 'admin' } }).status).toBe(422);
    const accepted = h.sim.request({
      method: 'POST',
      path: '/api/v1/capture/devices/CAM-01/credential',
      body: { username: 'operator-onvif', secret: 'never-echoed-value' },
    });
    expect(accepted.status).toBe(200);
    expect(JSON.stringify(accepted.body)).not.toMatch(/operator-onvif|never-echoed-value/);
    expect(h.state().audit.rows.at(-1)).toMatchObject({
      type: 'CAPTURE_CREDENTIAL_SET',
      actorId: 'OPR-003',
      deviceId: 'CAM-01',
      details: { operationId: 'setCaptureDeviceCredential', deviceId: 'CAM-01' },
    });
    expect(JSON.stringify(h.state().audit.rows)).not.toMatch(/never-echoed-value/);
  });
});

describe('POST+GET /session/{id}/audio-source and GET /session/{id}/sealing (ops 81/82/83)', () => {
  function recording() {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.sim.request({ method: 'POST', path: '/api/v1/session', body: CREATE_BODY });
    const id = h.state().session?.id ?? '';
    h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/start` });
    h.run(5_000);
    h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/start` });
    h.run(2_000);
    return { h, id };
  }

  it('switches the active input, records the interval, and locks the capture selector (OD-09/OD-10)', () => {
    const { h, id } = recording();
    expect(h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/audio-source`, body: '[1]' }).status).toBe(400);
    expect(h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/audio-source`, body: { inputId: 'MIC-09' } }).status).toBe(422);
    expect(h.sim.request({ method: 'POST', path: '/api/v1/session/SES-20261001-9999/audio-source', body: { inputId: 'MIC-02' } }).status).toBe(404);

    const switched = h.sim.request({
      method: 'POST',
      path: `/api/v1/session/${id}/audio-source`,
      body: { inputId: 'MIC-02', reason: 'Subject answers' },
    });
    expect(switched).toMatchObject({ status: 200, body: { sessionId: id, activeInputId: 'MIC-02', standbyInputId: 'MIC-01' } });
    expect(h.state().audio.activeInputId).toBe('MIC-02');
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'AUDIO_SOURCE_SWITCHED', actorId: 'OPR-001', sessionId: id });

    const intervals = h.sim.request({ method: 'GET', path: `/api/v1/session/${id}/audio-source` }).body as {
      items: { seq: number; inputId: string; reason: string; toMs: number | null }[];
      nextCursor: string | null;
    };
    expect(intervals.nextCursor).toBeNull();
    expect(intervals.items.map((item) => [item.seq, item.inputId, item.reason])).toEqual([
      [1, 'MIC-02', 'MANUAL'],
      [0, 'MIC-01', 'START'],
    ]);
    expect(intervals.items[0]?.toMs).toBeNull();
    expect(intervals.items[1]?.toMs).not.toBeNull();

    // RBAC before the lock: an INVESTIGATOR cannot edit the selector even while it is unlocked.
    expect(
      h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] } }),
    ).toMatchObject({ status: 403, body: { error: { code: 'NOT_PERMITTED' } } });
    expect((h.sim.request({ method: 'GET', path: CAPTURE_CONFIG_PATH }).body as CaptureConfigBody).locked).toBe(true);
  });

  it('refuses a capture edit with 409 CAPTURE_CONFIG_LOCKED and writes no audit row (SEC35-19)', () => {
    const h = harness();
    // A SUPERVISOR holds both SESSION_START and CAPTURE_CONFIG, so only the lock can refuse here.
    h.sim.actions.signIn('andi.pratama', 'demo-2026');
    h.sim.request({ method: 'POST', path: '/api/v1/session', body: CREATE_BODY });
    const id = h.state().session?.id ?? '';
    h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/start` });
    h.run(5_000);
    h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/start` });
    const before = h.state().audit.rows.length;
    for (const request of [
      { method: 'POST' as const, path: CAPTURE_CONFIG_PATH, body: { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] } },
      { method: 'POST' as const, path: '/api/v1/capture/cameras/CAM-01/source', body: { trackId: 'VIDEO-02' } },
      { method: 'POST' as const, path: '/api/v1/capture/mics/MIC-02/primary' },
      { method: 'POST' as const, path: '/api/v1/capture/devices/CAM-01/credential', body: { username: 'u', secret: 's' } },
    ]) {
      expect(h.sim.request(request)).toMatchObject({ status: 409, body: { error: { code: 'CAPTURE_CONFIG_LOCKED' } } });
    }
    expect(h.state().audit.rows.length).toBe(before);
  });

  it('reports the v2 sealing steps once sealing starts, and 409 before it does', () => {
    const { h, id } = recording();
    expect(h.sim.request({ method: 'GET', path: `/api/v1/session/${id}/sealing` })).toMatchObject({
      status: 409,
      body: { error: { code: 'INVALID_STATE' } },
    });
    h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/stop`, body: { reason: 'Interview completed' } });
    h.run(6_000);
    const progress = h.sim.request({ method: 'GET', path: `/api/v1/session/${id}/sealing` }).body as {
      state: string;
      steps: { id: string; status: string }[];
      progressPct: number;
      etaMs: number | null;
      resumed: boolean;
    };
    expect(progress.steps.map((step) => step.id)).toEqual([
      'CLOSE_TRACKS',
      'FINALIZE_HASHES',
      'FINALIZE_TRANSCRIPT',
      'BUILD_MANIFEST',
      'SIGN_MANIFEST',
      'STORE_SEALED_PACKAGE',
    ]);
    expect(progress.progressPct).toBeGreaterThan(0);
    expect(progress.progressPct).toBeLessThanOrEqual(100);
    expect(progress.resumed).toBe(false);
    h.run(20_000);
    const sealed = h.sim.request({ method: 'GET', path: `/api/v1/session/${id}/sealing` }).body as { progressPct: number; etaMs: number | null };
    expect(sealed).toMatchObject({ progressPct: 100, etaMs: 0 });
  });
});

describe('transcript and export-job endpoints (ops 84/85/86/87)', () => {
  it('409 for an item without a transcript, the stub for one that has, then a signed revision', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    const legacy = h.state().evidence.find((item) => !item.transcriptSha256)?.id ?? '';
    expect(h.sim.request({ method: 'GET', path: `/api/v1/evidence/${legacy}/transcript` })).toMatchObject({
      status: 409,
      body: { error: { code: 'TRANSCRIPT_NOT_READY' } },
    });
    expect(h.sim.request({ method: 'GET', path: '/api/v1/evidence/EV-19700101-9999/transcript' }).status).toBe(404);

    // Seal a session live: the v2 seal binds a transcript hash (SH-07), which op 84 then serves.
    h.sim.request({ method: 'POST', path: '/api/v1/session', body: CREATE_BODY });
    const id = h.state().session?.id ?? '';
    h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/start` });
    h.run(5_000);
    h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/start` });
    h.run(2_000);
    h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/stop`, body: { reason: 'Interview completed' } });
    h.run(20_000);
    const sealedItem = h.state().evidence.find((item) => item.sessionId === id && item.transcriptSha256);
    expect(sealedItem?.transcriptSha256).toMatch(/^[0-9a-f]{64}$/);
    const evidencePath = `/api/v1/evidence/${sealedItem?.id ?? ''}`;

    const document = h.sim.request({ method: 'GET', path: `${evidencePath}/transcript` }).body as {
      documentVersion: string;
      language: string;
      segments: unknown[];
      machineTranscriptHash: string;
      revision: number;
    };
    expect(document).toMatchObject({
      documentVersion: 'dems.transcript/1',
      language: 'id',
      machineTranscriptHash: sealedItem?.transcriptSha256,
      revision: 0,
    });
    // D-EV-1: the simulator never invents segment text.
    expect(document.segments).toEqual([]);

    expect(
      h.sim.request({
        method: 'POST',
        path: `${evidencePath}/transcript/revisions`,
        body: { baseRevision: 7, changes: [{ segmentIndex: 0, from: 'a', to: 'b' }] },
      }),
    ).toMatchObject({ status: 409, body: { error: { code: 'TRANSCRIPT_REVISION_CONFLICT' } } });

    const created = h.sim.request({
      method: 'POST',
      path: `${evidencePath}/transcript/revisions`,
      body: { baseRevision: 0, changes: [{ segmentIndex: 0, from: 'selamat pagi', to: 'Selamat pagi.' }], note: 'Punctuation' },
    });
    expect(created).toMatchObject({
      status: 201,
      body: { revisionId: 'TRV-000001', number: 1, authorId: 'OPR-001', baseRevision: 0, machineTranscriptHash: sealedItem?.transcriptSha256 },
    });
    expect((created.body as { signature: { algorithm: string; simulated: boolean } }).signature).toMatchObject({
      algorithm: 'SIMULATED-SHA256',
      simulated: true,
    });
    const listed = h.sim.request({ method: 'GET', path: `${evidencePath}/transcript/revisions` }).body as { items: { number: number }[] };
    expect(listed.items.map((item) => item.number)).toEqual([1]);
    // The sealed hash is byte-unchanged by the revision (OD-15).
    expect(h.state().evidence.find((item) => item.id === sealedItem?.id)?.transcriptSha256).toBe(sealedItem?.transcriptSha256);
    expect(h.state().audit.rows.at(-1)).toMatchObject({
      type: 'TRANSCRIPT_REVISED',
      actorId: 'OPR-001',
      details: { revisionId: 'TRV-000001', number: 1, baseRevision: 0, changeCount: 1 },
    });
  });

  it('polls the export job op 42 queued to COMPLETE (op 87)', () => {
    const h = harness();
    h.sim.actions.signIn('andi.pratama', 'demo-2026');
    const sealed = h.state().evidence.find((item) => item.status === 'SEALED')?.id ?? '';
    const accepted = h.sim.request({
      method: 'POST',
      path: `/api/v1/evidence/${sealed}/export`,
      body: { reason: 'Case file handover for prosecutor review', destination: 'Case file transfer (simulated)' },
    });
    expect(accepted).toMatchObject({ status: 202, body: { status: 'QUEUED' } });
    const exportId = (accepted.body as { exportId: string }).exportId;
    const jobId = `EXPJ-${exportId.slice('EXP-'.length)}`;
    expect(h.sim.request({ method: 'GET', path: `/api/v1/evidence/exports/${jobId}` }).body).toMatchObject({
      jobId,
      evidenceId: sealed,
      kind: 'PACKAGE',
      status: 'COMPLETE',
      progressPct: 100,
      derived: false,
    });
    expect(h.sim.request({ method: 'GET', path: '/api/v1/evidence/exports/EXPJ-000001' }).status).toBe(404);
    expect(h.sim.request({ method: 'GET', path: '/api/v1/evidence/exports/not-a-job' }).status).toBe(422);
    h.sim.actions.signOut();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    expect(h.sim.request({ method: 'GET', path: `/api/v1/evidence/exports/${jobId}` }).status).toBe(403);
  });
});
