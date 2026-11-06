// Operations 112 and 113 and the live camera preview route without a database (decisions D51, D53).
//
// The real app factory, the REAL access rules (ANY-OF of the three permissions, on the operation and on
// the registry-external preview route), the real audit writer's rules for the rows; the preview
// manager and the idle meters are doubles handed in through `cameraPreview(app).replaceForTest`.
// Each `it` holds its negative control.
import { CAMERA_PREVIEW_SESSION_TTL_MS, validateCoreApiResponse } from '@dems/shared/api';
import { createManualClock, type Permission } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureLog, createFakePool, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { buildApp } from '../../../app';
import { PREVIEW_BOUNDARY, PREVIEW_SESSION_CHECK_MS, cameraPreview, type CameraPreviewManagerShape, type PreviewDevice, type PreviewSinkShape } from '../../../camera-preview';
import type { AuditEntry } from '../../../core';
import { auditInputOf } from '../../../core/audit-writer';
import type { Principal } from '../../../plugins/authenticate';
import { ANONYMOUS, FIXED_NOW, committedOf, engineDouble, operatorOf, scenarioState } from '../../devices/__tests__/support';

const WEB_ORIGIN = 'http://127.0.0.1:5173';
const sessionsPath = (deviceId: string): string => `/api/v1/capture/devices/${deviceId}/preview-sessions`;
const LEASE_PATH = '/api/v1/capture/idle-meters/lease';
const JPEG = (n: number): Buffer => Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from(`frame-${String(n)}`), Buffer.from([0xff, 0xd9])]);

interface Rig {
  readonly app: FastifyInstance;
  readonly log: CapturedLog;
  readonly clock: ReturnType<typeof createManualClock>;
  readonly appended: Array<AuditEntry & { readonly unit: string }>;
  readonly devices: Map<string, PreviewDevice>;
  readonly signIn: { open: boolean; asked: number };
  readonly viewers: { deviceId: string; operatorId: string; sink: PreviewSinkShape; left: number; drained: number }[];
  manager: { refusal: string | null; onJoin: ((viewer: Rig['viewers'][number]) => void) | null; present: boolean };
  meters: { present: boolean; held: string[] };
  actAs(principal: Principal): void;
  open(deviceId?: string): Promise<LightMyRequestResponse>;
  stream(url: string): Promise<LightMyRequestResponse>;
  lease(): Promise<LightMyRequestResponse>;
}

const apps: FastifyInstance[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const app of apps.splice(0)) await app.close();
});

async function rig(): Promise<Rig> {
  const log = captureLog();
  const fake = createFakePool();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => fake.pool, logStream: log.stream });
  apps.push(app);
  let current: Principal = ANONYMOUS;
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  app.seams.replace('engine', engineDouble(committedOf(scenarioState('idle'))).host);
  const clock = createManualClock(FIXED_NOW);
  app.seams.replace('clock', { now: () => clock.now() });
  const appended: Rig['appended'] = [];
  app.seams.replace('pipeline', {
    run: async (label: string, work: (unit: unknown) => unknown) =>
      work({
        label,
        audit: {
          append: async (entry: AuditEntry) => {
            // The real rules of the audit writer: the exact detail keys of the type, no secret-shaped value.
            auditInputOf(entry);
            appended.push({ ...entry, unit: label });
            return entry;
          },
        },
      }),
  } as unknown as FastifyInstance['pipeline']);

  const devices = new Map<string, PreviewDevice>([
    ['CAM-03', { kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', retired: false }],
    ['CAM-01', { kind: 'CAMERA', adapterKind: 'FAKE', retired: false }],
    ['CAM-04', { kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', retired: true }],
    ['MIC-03', { kind: 'MIC', adapterKind: 'USB_AUDIO', retired: false }],
  ]);
  const signIn = { open: true, asked: 0 };
  let issued = 0;
  const viewers: Rig['viewers'] = [];
  const state: Pick<Rig, 'manager' | 'meters'> = { manager: { refusal: null, onJoin: null, present: true }, meters: { present: true, held: [] } };
  const manager: CameraPreviewManagerShape = {
    wouldRefuse: () => state.manager.refusal,
    join(deviceId, operatorId, sink) {
      if (state.manager.refusal !== null) return { joined: false, reason: state.manager.refusal };
      const viewer = { deviceId, operatorId, sink, left: 0, drained: 0 };
      viewers.push(viewer);
      state.manager.onJoin?.(viewer);
      return {
        joined: true,
        viewer: {
          leave: () => void (viewer.left += 1),
          drained: () => void (viewer.drained += 1),
        },
      };
    },
  };
  cameraPreview(app).replaceForTest({
    device: async (_request, deviceId) => devices.get(deviceId) ?? null,
    sessionOpen: async () => {
      signIn.asked += 1;
      return signIn.open;
    },
    manager: () => (state.manager.present ? manager : null),
    idleMeters: () => (state.meters.present ? { hold: (operatorId: string) => (state.meters.held.push(operatorId), { expiresAt: clock.now() + 30_000 }) } : null),
    tokenBytes: () => {
      issued += 1;
      return new Uint8Array(32).map((_, index) => (index * 7 + issued) % 256);
    },
  });
  const result: Rig = {
    app,
    log,
    clock,
    appended,
    devices,
    signIn,
    viewers,
    ...state,
    actAs: (principal) => void (current = principal),
    open: (deviceId = 'CAM-03') => app.inject({ method: 'POST', url: sessionsPath(deviceId), headers: { origin: WEB_ORIGIN } }),
    stream: (url) => app.inject({ method: 'GET', url: new URL(url).pathname, headers: { origin: WEB_ORIGIN } }),
    lease: () => app.inject({ method: 'POST', url: LEASE_PATH, headers: { origin: WEB_ORIGIN } }),
  };
  return result;
}

const errorOf = (response: LightMyRequestResponse): { code: string; details?: Record<string, unknown> } => (response.json() as { error: { code: string; details?: Record<string, unknown> } }).error;
const INVESTIGATOR = operatorOf('INVESTIGATOR');
const TECHNICIAN = operatorOf('TECHNICIAN');
const otherSession = (principal: Principal): Principal => (principal.kind === 'OPERATOR' ? { ...principal, sessionId: 'another-sign-in' } : principal);
const withPermissions = (role: 'INVESTIGATOR' | 'SUPERVISOR' | 'TECHNICIAN', permissions: readonly Permission[]): Principal => operatorOf(role, permissions);

describe('operation 112: a live camera preview session', () => {
  it('201 in the shape of the contract, a loopback URL with a `cps_` token, ONE audit row committed for it - and no token in a row or a log line', async () => {
    const preview = await rig();
    preview.actAs(INVESTIGATOR);
    const response = await preview.open();
    expect(response.statusCode).toBe(201);
    const body = response.json() as { url: string; expiresAt: number };
    expect(validateCoreApiResponse('createCameraPreviewSession', 201, body)).toEqual({ ok: true });
    expect(body.expiresAt).toBe(preview.clock.now() + CAMERA_PREVIEW_SESSION_TTL_MS);
    expect(body.url).toMatch(/^http:\/\/127\.0\.0\.1:4420\/preview\/cps_[A-Za-z0-9_-]{43}$/);
    expect(preview.appended).toEqual([
      {
        unit: 'cameraPreview.sessionIssued',
        type: 'CAMERA_PREVIEW_OPENED',
        message: 'Live camera preview opened for CAM-03',
        actorId: 'OPR-001',
        deviceId: 'CAM-03',
        details: { deviceId: 'CAM-03', expiresAt: body.expiresAt, operationId: 'createCameraPreviewSession', permission: 'SESSION_START' },
      },
    ]);
    const token = body.url.split('/').at(-1) ?? '';
    for (const text of [preview.log.text(), JSON.stringify(preview.appended)]) {
      expect(text).not.toContain(token);
      expect(text).not.toContain(token.slice(-16));
      expect(text).not.toContain('cps_');
      expect(text).not.toContain('/preview/');
    }
    // Control: the log was captured (the line of the session is there, by its code).
    expect(preview.log.lines().some((line) => line['code'] === 'CAMERA_PREVIEW_OPENED' && line['deviceId'] === 'CAM-03')).toBe(true);
  });

  it('ANY-OF: a role with only DEVICE_MANAGE or only CAPTURE_CONFIG is let through; none of the three is 403 with its row; nobody is 401', async () => {
    const preview = await rig();
    preview.actAs(withPermissions('TECHNICIAN', ['DEVICE_MANAGE']));
    expect((await preview.open()).statusCode).toBe(201);
    preview.actAs(withPermissions('SUPERVISOR', ['CAPTURE_CONFIG']));
    expect((await preview.open()).statusCode).toBe(201);
    preview.actAs(withPermissions('INVESTIGATOR', ['EVIDENCE_VIEW']));
    const before = preview.appended.length;
    const denied = await preview.open();
    expect([denied.statusCode, errorOf(denied).code]).toEqual([403, 'NOT_PERMITTED']);
    expect(errorOf(denied).details).toMatchObject({ operationId: 'createCameraPreviewSession', permission: 'SESSION_START_OR_CAPTURE_CONFIG_OR_DEVICE_MANAGE' });
    expect(preview.appended.slice(before).map((row) => row.type)).toEqual(['ACCESS_DENIED']);
    preview.actAs(ANONYMOUS);
    expect((await preview.open()).statusCode).toBe(401);
  });

  it('404 unknown device, 422 an ID of another form, 409 PREVIEW_NOT_AVAILABLE (no preview on this Core, not a production camera, a microphone, a retired camera, a refused credential) - none writes a row', async () => {
    const preview = await rig();
    preview.actAs(TECHNICIAN);
    const unknown = await preview.open('CAM-09');
    expect([unknown.statusCode, errorOf(unknown).code]).toEqual([404, 'NOT_FOUND']);
    expect((await preview.open('camera-1')).statusCode).toBe(422);
    for (const id of ['CAM-01', 'CAM-04', 'MIC-03']) {
      const refused = await preview.open(id);
      expect([refused.statusCode, errorOf(refused).code, errorOf(refused).details?.['reason']], id).toEqual([409, 'INVALID_STATE', 'PREVIEW_NOT_AVAILABLE']);
    }
    preview.manager.refusal = 'AUTH_REFUSED';
    const auth = await preview.open();
    expect([auth.statusCode, errorOf(auth).details]).toEqual([409, { reason: 'PREVIEW_NOT_AVAILABLE', cause: 'AUTH_REFUSED' }]);
    preview.manager.refusal = null;
    preview.manager.present = false;
    expect((await preview.open()).statusCode).toBe(409);
    expect(preview.appended).toEqual([]);
    // Control: the same caller on the production camera with a manager gets a session.
    preview.manager.present = true;
    expect((await preview.open()).statusCode).toBe(201);
  });

  it('429 RATE_LIMITED PREVIEW_LIMIT when a bound of the previews is reached; no token, no row', async () => {
    const preview = await rig();
    preview.actAs(INVESTIGATOR);
    preview.manager.refusal = 'PREVIEW_LIMIT';
    const limited = await preview.open();
    expect([limited.statusCode, errorOf(limited).code, errorOf(limited).details]).toEqual([429, 'RATE_LIMITED', { reason: 'PREVIEW_LIMIT' }]);
    expect(limited.headers['retry-after']).toBe('5');
    expect(preview.appended).toEqual([]);
  });
});

describe('the preview route: GET /preview/:token', () => {
  async function opened(preview: Rig): Promise<string> {
    const response = await preview.open();
    if (response.statusCode !== 201) throw new Error(`operation 112 answered ${response.statusCode} ${response.body}`);
    return (response.json() as { url: string }).url;
  }

  it('streams multipart/x-mixed-replace with `Cache-Control: no-store`: one JPEG per part; the viewer leaves when the stream ends', async () => {
    const preview = await rig();
    preview.actAs(INVESTIGATOR);
    const url = await opened(preview);
    preview.manager.onJoin = (viewer) => {
      viewer.sink.frame(JPEG(1));
      viewer.sink.frame(JPEG(2));
      viewer.sink.end('PREVIEW_UNAVAILABLE');
    };
    const response = await preview.stream(url);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe(`multipart/x-mixed-replace; boundary=${PREVIEW_BOUNDARY}`);
    expect(response.headers['cache-control']).toBe('no-store');
    const parts = response.rawPayload.toString('latin1').split(`--${PREVIEW_BOUNDARY}\r\n`).filter((part) => part !== '');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe(`Content-Type: image/jpeg\r\nContent-Length: ${String(JPEG(1).length)}\r\n\r\n${JPEG(1).toString('latin1')}\r\n`);
    expect(preview.viewers).toHaveLength(1);
    expect(preview.viewers[0]).toMatchObject({ deviceId: 'CAM-03', operatorId: 'OPR-001', left: 1 });
    // The token and the path are never logged.
    const token = url.split('/').at(-1) ?? '';
    expect(preview.log.text()).not.toContain(token);
    expect(preview.log.text()).not.toContain('cps_');
  });

  it('the token is bound: another operator, another sign-in session, a made-up token - 403 PREVIEW_SESSION_INVALID with one row each; after 60 s 403 PREVIEW_SESSION_EXPIRED with no row', async () => {
    const preview = await rig();
    preview.actAs(INVESTIGATOR);
    const url = await opened(preview);
    const before = preview.appended.length;
    for (const [principal, path] of [
      [TECHNICIAN, url],
      [otherSession(INVESTIGATOR), url],
      [INVESTIGATOR, `http://127.0.0.1:4420/preview/cps_${'A'.repeat(43)}`],
      [INVESTIGATOR, 'http://127.0.0.1:4420/preview/not-a-token'],
    ] as const) {
      preview.actAs(principal);
      const refused = await preview.stream(path);
      expect([refused.statusCode, errorOf(refused).code, errorOf(refused).details?.['reason']]).toEqual([403, 'NOT_PERMITTED', 'PREVIEW_SESSION_INVALID']);
    }
    expect(preview.appended.slice(before).map((row) => row.type)).toEqual(['ACCESS_DENIED', 'ACCESS_DENIED', 'ACCESS_DENIED', 'ACCESS_DENIED']);
    expect(preview.viewers).toEqual([]);
    preview.actAs(INVESTIGATOR);
    preview.clock.advance(CAMERA_PREVIEW_SESSION_TTL_MS);
    const expired = await preview.stream(url);
    expect([expired.statusCode, errorOf(expired).details?.['reason']]).toEqual([403, 'PREVIEW_SESSION_EXPIRED']);
    expect(preview.appended.slice(before)).toHaveLength(4);
  });

  it('the route has the rule of operation 112: a caller with none of the three is refused before the token is looked at; nobody is 401', async () => {
    const preview = await rig();
    preview.actAs(INVESTIGATOR);
    const url = await opened(preview);
    preview.actAs(withPermissions('INVESTIGATOR', ['EVIDENCE_VIEW']));
    const denied = await preview.stream(url);
    expect([denied.statusCode, errorOf(denied).details?.['operationId']]).toEqual([403, 'cameraPreviewStream']);
    preview.actAs(ANONYMOUS);
    expect((await preview.stream(url)).statusCode).toBe(401);
    expect(preview.viewers).toEqual([]);
  });

  it('a bound reached since the token was issued is 429; a preview gone from this Core is 409', async () => {
    const preview = await rig();
    preview.actAs(INVESTIGATOR);
    const url = await opened(preview);
    preview.manager.refusal = 'PREVIEW_LIMIT';
    expect((await preview.stream(url)).statusCode).toBe(429);
    preview.manager.refusal = null;
    preview.manager.present = false;
    expect((await preview.stream(url)).statusCode).toBe(409);
  });

  it('R93-08, the preview way: a stream in flight is CUT when its sign-in session ends (asked every 10 s); a read that fails cuts too', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const preview = await rig();
    preview.actAs(INVESTIGATOR);
    const url = await opened(preview);
    preview.manager.onJoin = (viewer) => void viewer.sink.frame(JPEG(1));
    const streaming = preview.stream(url);
    await vi.waitFor(() => expect(preview.viewers).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(PREVIEW_SESSION_CHECK_MS);
    expect(preview.signIn.asked).toBe(1);
    expect(preview.viewers[0]?.left).toBe(0);
    preview.signIn.open = false;
    await vi.advanceTimersByTimeAsync(PREVIEW_SESSION_CHECK_MS);
    const response = await streaming;
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload.toString('latin1')).toContain('frame-1');
    expect(preview.viewers[0]?.left).toBe(1);
    expect(preview.log.lines().some((line) => line['code'] === 'PREVIEW_SESSION_ENDED')).toBe(true);
  });
});

describe('operation 113: the lease of the idle meters', () => {
  it('200 { expiresAt } for the operator; 409 IDLE_METERS_NOT_AVAILABLE on a Core without them; ANY-OF of the three; no row', async () => {
    const preview = await rig();
    preview.actAs(INVESTIGATOR);
    const held = await preview.lease();
    expect(held.statusCode).toBe(200);
    expect(validateCoreApiResponse('holdIdleMeters', 200, held.json())).toEqual({ ok: true });
    expect(held.json()).toEqual({ expiresAt: preview.clock.now() + 30_000 });
    expect(preview.meters.held).toEqual(['OPR-001']);
    preview.meters.present = false;
    const missing = await preview.lease();
    expect([missing.statusCode, errorOf(missing).details?.['reason']]).toEqual([409, 'IDLE_METERS_NOT_AVAILABLE']);
    expect(preview.appended).toEqual([]);
    preview.actAs(withPermissions('SUPERVISOR', ['EVIDENCE_VIEW']));
    expect((await preview.lease()).statusCode).toBe(403);
    expect(preview.appended.map((row) => row.type)).toEqual(['ACCESS_DENIED']);
  });
});
