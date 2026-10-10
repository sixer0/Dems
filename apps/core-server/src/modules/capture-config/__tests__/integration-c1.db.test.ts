// Integration pass C1 (decision D120) on PostgreSQL, AS THE RUNTIME ROLE, on throw-away clones.
//
//   1. THE MIC INPUT ID RULE (decisions D106 (4), D115 (2)): a stored selector whose PRIMARY is the
//      local microphone row `MIC-03` REHYDRATES (it stopped the boot at `engine.rehydrate` while the
//      shared contract named a mic input by exactly `MIC-01` / `MIC-02`), an edit of it is
//      published and stored, and a restarted Core holds the same selector.
//   2. OPERATIONS 78 / 79 ASK THE ADAPTER REGISTRY (decision D115 (3); check M4-LOCAL-SEL-1, API
//      half): in `REAL_DEVELOPMENT` the boot step of the capture-config module takes the registry
//      of the capture fence, and an assignment of a production camera answers
//      `422 INVALID_INPUT`, `details.reason: PRODUCTION_SOURCE_NOT_ALLOWED` (fix wave I, finding
//      G70b-01: the reason of THIS refusal; it read `DEVELOPMENT_SOURCE_NOT_ALLOWED` before, which
//      is false for a production camera on a development Core); nothing is stored.
//
// A "restart" is what it is in production: the app is closed and a NEW app is built on the same
// database and booted. The helper program of the development boots is `/bin/echo` (row 136's
// fixture): a root-owned program that passes the path rule and is never asked to capture.
import { CaptureConfigSliceSchema } from '@dems/shared/api';
import type { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { FIXED_NOW, engineApp, stateChanges, storedSlices } from '../../../../test/support/engine';
import { WEB_ORIGIN, cookieValue, webSignIn } from '../../../../test/support/identity';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { buildApp } from '../../../app';
import { realBootFixture } from '../../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../../capture/fence';
import type { ConfigInput } from '../../../config';
import { BootError } from '../../../plugins/readiness';
import { captureConfigControl } from '../index';
import { CONFIG, cameraSource } from './support';

const db = useTestDatabase({ template: 'seed' });
const HELPER = '/bin/echo';
// A whole boot in capture mode real passes the boot checks of row 61 (`capture.boot`): a worker
// program that passes the path rule and says HELLO, a private media root and a provisioned signing
// key. Row 61's fixture gives the three below `.data/`; the worker is a stand-in script and is
// never asked to capture.
const realBoot = realBootFixture('c1');
realBoot.provisionKey();
afterAll(() => realBoot.remove());
const DEVELOPMENT = { captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER, dataDir: realBoot.dataDir, captureWorkerPath: realBoot.worker('capture-worker', 'capture-worker/0.3.0') } as const;

type Clone = Awaited<ReturnType<typeof db.another>>;

/** What row 136's development boot registers, written by the owner as a fixture. */
const addLocalRows = (owner: Pool): Promise<unknown> =>
  owner.query("INSERT INTO public.capture_devices (id, kind, transport, model, enabled, adapter_kind) VALUES ('CAM-03', 'CAMERA', 'AVFOUNDATION', 'MacBook Air Camera', false, 'LOCAL_DEVICE'), ('MIC-03', 'MIC', 'AVFOUNDATION', 'MacBook Air Microphone', false, 'LOCAL_DEVICE')");
const storedSelector = async (owner: Pool): Promise<Record<string, unknown> | undefined> =>
  (await owner.query('SELECT video_01_device_id, video_02_device_id, mic_primary_id, mic_standby_id FROM public.capture_config')).rows[0] as Record<string, unknown> | undefined;
const changedRows = async (owner: Pool): Promise<number> => Number((await owner.query("SELECT count(*)::int AS n FROM public.audit_log WHERE type = 'CAPTURE_CONFIG_CHANGED'")).rows[0]?.n);

describe('the schema this pass was written against', () => {
  it("schema version 6, contract dbc-7", async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([6, 'dbc-7']);
  });
});

describe('1. a capture configuration with MIC-03 as PRIMARY rehydrates and replicates', () => {
  it('boot, the selector in input order, an edit published and stored, and the same selector after a restart', async () => {
    const target = await db.another({ template: 'seed', slug: 'c1-mic03' });
    const owner = target.ownerPool();
    await addLocalRows(owner);
    await owner.query("UPDATE public.capture_config SET mic_primary_id = 'MIC-03'");

    const first = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + 60_000 });
    // RED BEFORE THIS PASS: BootError at step `engine.rehydrate` (ENGINE_SNAPSHOT_REJECTED).
    await first.app.readiness.boot();
    await first.engine.idle();
    const rehydrated = first.engine.slice('captureConfig');
    expect(rehydrated.mics.map((mic) => [mic.inputId, mic.deviceId, mic.role, mic.transport])).toEqual([
      ['MIC-02', 'MIC-02', 'STANDBY', 'USB'],
      ['MIC-03', 'MIC-03', 'PRIMARY', 'AVFOUNDATION'],
    ]);
    // The rules that stay: exactly one PRIMARY and one STANDBY line; a mic line's device is its input (D106 (4)).
    expect(rehydrated.mics.map((mic) => mic.role).sort()).toEqual(['PRIMARY', 'STANDBY']);
    expect(rehydrated.mics.every((mic) => mic.deviceId === mic.inputId)).toBe(true);
    expect(CaptureConfigSliceSchema.safeParse(rehydrated).success).toBe(true);
    // The module's own boot step (`capture.config`) read the same rows into the same selector.
    expect(captureConfigControl(first.app).snapshot().captureConfig.mics).toEqual(rehydrated.mics);
    await first.app.pipeline.drain();
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(first.engine.state()));

    // REPLICATES: an edit is one published replacement of slice `captureConfig`, and the stored row follows.
    const publishedBefore = stateChanges(first.publications).length;
    const technician = first.principal('TECHNICIAN');
    first.clock.advance(1_000);
    await first.engine.run('test.c1.primaryMic', (scope) => scope.command(technician, 'setCaptureConfig', { kind: 'PRIMARY_MIC', inputId: 'MIC-02' }));
    await first.app.pipeline.drain();
    const replaced = stateChanges(first.publications)
      .slice(publishedBefore)
      .flatMap((change) => change.ops.flatMap((op) => (op.op === 'replace' && op.slice === 'captureConfig' ? [op.value] : [])));
    expect(replaced).toHaveLength(1);
    expect(CaptureConfigSliceSchema.safeParse(replaced[0]).success).toBe(true);
    expect((replaced[0] as typeof rehydrated).mics.map((mic) => [mic.inputId, mic.role])).toEqual([
      ['MIC-02', 'PRIMARY'],
      ['MIC-03', 'STANDBY'],
    ]);
    expect(await storedSelector(owner)).toMatchObject({ mic_primary_id: 'MIC-02', mic_standby_id: 'MIC-03' });
    // And back to the local microphone as PRIMARY: the state a restart must bring back.
    first.clock.advance(1_000);
    await first.engine.run('test.c1.primaryMic', (scope) => scope.command(technician, 'setCaptureConfig', { kind: 'PRIMARY_MIC', inputId: 'MIC-03' }));
    await first.app.pipeline.drain();
    expect(await storedSelector(owner)).toMatchObject({ mic_primary_id: 'MIC-03', mic_standby_id: 'MIC-02' });
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(first.engine.state()));
    const held = first.engine.slice('captureConfig');
    await first.app.close();

    const second = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + 120_000 });
    await second.app.readiness.boot();
    await second.engine.idle();
    expect(second.engine.slice('captureConfig')).toEqual(held);
    expect(second.engine.slice('captureDevices').devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'MIC-01', 'MIC-02', 'MIC-03', 'POE-SWITCH']);
    await second.app.pipeline.drain();
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(second.engine.state()));
  });

  it('CONTROL: a selector that names a device which is no microphone still stops the start, by name', async () => {
    const target = await db.another({ template: 'seed', slug: 'c1-mic-control' });
    const owner = target.ownerPool();
    // The stored CHECKs and keys are the owner's to bend for a fixture: the engine must refuse what they would let through.
    const bent = await owner.query("UPDATE public.capture_config SET mic_primary_id = 'CAM-02'").then(
      () => true,
      () => false,
    );
    expect(bent).toBe(true);
    const host = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + 60_000 });
    const error = await host.app.readiness.boot().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(BootError);
    expect((error as BootError).stepId).toBe('engine.rehydrate');
  });
});

describe('2. operations 78 and 79 ask the adapter registry of the running capture operation', () => {
  async function booted(target: Clone, overrides: Partial<ConfigInput>) {
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'info', ...overrides }), logStream: log.stream });
    target.onCleanup(() => app.close());
    await app.ready();
    await app.readiness.boot();
    const signedIn = await webSignIn(app, 'rina.wijaya');
    expect(signedIn.statusCode).toBe(200);
    const token = cookieValue(signedIn, app.config.sessionCookieName);
    if (token === null) throw new Error('the web sign-in set no session cookie');
    const headers = { cookie: `${app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN };
    return {
      app,
      post: (url: string, payload: object) => app.inject({ method: 'POST', url, headers, payload }),
    };
  }
  /** A clone with speech-to-text off (a real-capture boot resolves the stored selection first) and one unassigned production camera. */
  async function clone(slug: string): Promise<Clone> {
    const target = await db.another({ template: 'seed', slug });
    const owner = target.ownerPool();
    await owner.query('UPDATE public.stt_config SET enabled = false');
    await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('CAM-11', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP')");
    return target;
  }

  it('REAL_DEVELOPMENT: a production camera is refused by both operations with the contract\'s reason, nothing is stored; the local camera is assigned', async () => {
    const target = await clone('c1-registry-dev');
    const owner = target.ownerPool();
    const server = await booted(target, DEVELOPMENT);
    expect(captureFenceControl(server.app).operation).toBe('REAL_DEVELOPMENT');
    expect(captureConfigControl(server.app).hasDeviceRegistry()).toBe(true);
    // The wiring leaves the one-provider rule in place: a second registry is still a mistake.
    expect(() => captureConfigControl(server.app).provideDeviceRegistry({ assertAssignable: () => { throw new Error('unused'); } })).toThrow(/twice/);
    const before = await storedSelector(owner);
    const rows = await changedRows(owner);

    const byCamera = await server.post(cameraSource('CAM-11'), { trackId: 'VIDEO-02' });
    const byConfig = await server.post(CONFIG, { cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-11' }] });
    for (const refused of [byCamera, byConfig]) {
      expect(refused.statusCode, refused.body).toBe(422);
      const error = (refused.json() as { error: { code: string; details?: Record<string, unknown> } }).error;
      expect(error.code).toBe('INVALID_INPUT');
      expect(error.details).toMatchObject({ reason: 'PRODUCTION_SOURCE_NOT_ALLOWED', deviceId: 'CAM-11' });
    }
    await server.app.pipeline.drain();
    expect(await storedSelector(owner)).toEqual(before);
    expect(await changedRows(owner)).toBe(rows);

    // CONTROL: a development source of the running operation is assigned by the same route.
    // The boot registered the local camera under the next free id (CAM-11 is taken by the fixture).
    const localCamera = captureFenceControl(server.app).outcome()?.local?.cameraId ?? '';
    expect(localCamera).toBe('CAM-12');
    const local = await server.post(cameraSource(localCamera), { trackId: 'VIDEO-02' });
    expect(local.statusCode, local.body).toBe(200);
    await server.app.pipeline.drain();
    expect(await storedSelector(owner)).toMatchObject({ video_02_device_id: localCamera });
    expect(await changedRows(owner)).toBe(rows + 1);
  });

  it('CONTROL, SIMULATED: no adapter is registered, no registry is taken, and no assignment is refused by source class (as before this pass in every operation)', async () => {
    const target = await clone('c1-registry-sim');
    const owner = target.ownerPool();
    const server = await booted(target, { demoControls: true });
    expect(captureFenceControl(server.app).registry()).toBeNull();
    expect(captureConfigControl(server.app).hasDeviceRegistry()).toBe(false);
    const assigned = await server.post(cameraSource('CAM-11'), { trackId: 'VIDEO-02' });
    expect(assigned.statusCode, assigned.body).toBe(200);
    await server.app.pipeline.drain();
    expect(await storedSelector(owner)).toMatchObject({ video_02_device_id: 'CAM-11' });
  });
});
