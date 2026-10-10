// Integration pass D1b (decision D133 (1)) on PostgreSQL, AS THE RUNTIME ROLE, on throw-away clones.
//
// OPERATION 78 ASSIGNS THE MICROPHONE INPUTS BY PAIR REPLACEMENT. The mic lines carry `role` and
// are the new pair (`deviceId == inputId`, exactly one PRIMARY and one STANDBY, any `MIC-NN` the
// adapter registry of the running capture operation accepts).
//
//   1. REAL_DEVELOPMENT: the local microphone the boot registered (`MIC-03` on the seed) is put
//      behind the capture THROUGH THE API - no fixture writes the selector. The slot carries the
//      transport of its registry row, the stored row follows, stored state equals committed state,
//      and a restarted Core holds the same selector.
//   2. ELSEWHERE the same body answers the contract's `422 INVALID_INPUT` and nothing is stored:
//      a registry that does not hold `MIC-03` (SIMULATED on the seed), and a microphone the
//      registry of the running operation refuses (a production microphone in REAL_DEVELOPMENT,
//      `details.reason: DEVELOPMENT_SOURCE_NOT_ALLOWED` - the registry check of pass C1 stays).
//   3. The form without `role` is still accepted and still cannot name a new input.
//
// The helper program of the development boots is `/bin/echo` (row 136's fixture): a root-owned
// program that passes the path rule and is never asked to capture.
import { CaptureConfigSliceSchema } from '@dems/shared/api';
import type { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { storedSlices } from '../../../../test/support/engine';
import { WEB_ORIGIN, cookieValue, webSignIn } from '../../../../test/support/identity';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { buildApp } from '../../../app';
import { realBootFixture } from '../../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../../capture/fence';
import type { ConfigInput } from '../../../config';
import { CONFIG } from './support';

const db = useTestDatabase({ template: 'seed' });
const HELPER = '/bin/echo';
// A whole boot in capture mode real passes the boot checks of row 61 (`capture.boot`): a worker
// program that passes the path rule and says HELLO, a private media root and a provisioned signing
// key. Row 61's fixture gives the three below `.data/`; the worker is a stand-in script and is
// never asked to capture.
const realBoot = realBootFixture('d1b');
realBoot.provisionKey();
afterAll(() => realBoot.remove());
const DEVELOPMENT = { captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER, dataDir: realBoot.dataDir, captureWorkerPath: realBoot.worker('capture-worker', 'capture-worker/0.3.0') } as const;

type Clone = Awaited<ReturnType<typeof db.another>>;
interface ErrorBody {
  error: { code: string; details?: Record<string, unknown> };
}
interface SelectorBody {
  mics: { inputId: string; deviceId: string; role: string; transport: string }[];
}

const storedSelector = async (owner: Pool): Promise<Record<string, unknown> | undefined> =>
  (await owner.query('SELECT mic_primary_id, mic_standby_id FROM public.capture_config')).rows[0] as Record<string, unknown> | undefined;
const changedRows = async (owner: Pool): Promise<Record<string, unknown>[]> =>
  (await owner.query("SELECT details FROM public.audit_log WHERE type = 'CAPTURE_CONFIG_CHANGED' ORDER BY seq")).rows.map((row: { details: Record<string, unknown> }) => row.details);

const pair = (primary: string, standby: string) => ({
  mics: [
    { inputId: primary, deviceId: primary, role: 'PRIMARY' },
    { inputId: standby, deviceId: standby, role: 'STANDBY' },
  ],
});

/** The devices the seed builds in: their stored rows surface no adapter (`captureDeviceFromRow`, db/mapping/rows.ts). */
const BUILT_IN_SOURCES = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'];

/**
 * The committed state WITHOUT the members the Core DERIVES AT BOOT (pass E3 item 2).
 *
 * The round trip "stored slices = committed state" holds for what the tables hold. Three members of
 * a device are not table facts, by the database contract (dbc-4 N.2, decision D-DB-11: "the source
 * class is not stored: it is derived from the adapter kind by one function") and by C3 2.6:
 *
 *   `adapter` / `sourceClass` on a BUILT-IN device  the registry of the RUNNING capture operation says
 *       them (boot step `devices.sourceFacts`, pass D11 item 1): `FAKE` / `DEVELOPMENT` in
 *       REAL_DEVELOPMENT, nothing in REAL_PRODUCTION and SIMULATED. The stored row of a built-in
 *       surfaces none, so the same tables read back without them under another operation;
 *   `sourceOpen`  what the fence holds open now; a process start begins with none.
 *
 * A device that is NOT built in (`MIC-03`, an adopted camera) keeps `adapter` / `sourceClass` in the
 * comparison: its row stores the adapter kind. The exclusion is exact - a built-in that carried
 * anything but `FAKE` / `DEVELOPMENT` here fails the case, and so does one that carried nothing.
 */
function withoutBootDerivedSourceFacts(state: Parameters<typeof withoutNegativeZeros>[0]): ReturnType<typeof withoutNegativeZeros> {
  const durable = withoutNegativeZeros(state);
  const builtIns = durable.captureDevices.devices.filter((device) => BUILT_IN_SOURCES.includes(device.id));
  expect(builtIns.map((device) => [device.id, device.adapter, device.sourceClass])).toEqual(BUILT_IN_SOURCES.map((id) => [id, 'FAKE', 'DEVELOPMENT']));
  return {
    ...durable,
    captureDevices: {
      devices: durable.captureDevices.devices.map((device) => {
        const { sourceOpen: _open, ...kept } = device;
        if (!BUILT_IN_SOURCES.includes(device.id)) return kept;
        const { adapter: _adapter, sourceClass: _class, ...stored } = kept;
        return stored;
      }),
    },
  };
}

/** A clone with speech-to-text off: a real-capture boot resolves the stored selection first. */
async function clone(slug: string): Promise<Clone> {
  const target = await db.another({ template: 'seed', slug });
  await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
  return target;
}

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
  return { app, post: (url: string, payload: object) => app.inject({ method: 'POST', url, headers, payload }) };
}

describe('the schema this pass was written against', () => {
  it('schema version 6, contract dbc-7', async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([6, 'dbc-7']);
  });
});

describe('operation 78: pair replacement of the microphone inputs', () => {
  it('REAL_DEVELOPMENT: MIC-03 is selected through the API, stored, equal to the committed state, and held across a restart', async () => {
    const target = await clone('d1b-pair-dev');
    const owner = target.ownerPool();
    const server = await booted(target, DEVELOPMENT);
    expect(captureFenceControl(server.app).operation).toBe('REAL_DEVELOPMENT');
    // The boot registered this Mac's microphone as a NEW device with its own id (D106 (4)).
    expect(captureFenceControl(server.app).outcome()?.local?.micId).toBe('MIC-03');
    expect(await storedSelector(owner)).toEqual({ mic_primary_id: 'MIC-01', mic_standby_id: 'MIC-02' });
    const rowsBefore = (await changedRows(owner)).length;

    const answer = await server.post(CONFIG, pair('MIC-03', 'MIC-02'));
    expect(answer.statusCode, answer.body).toBe(200);
    expect(CaptureConfigSliceSchema.safeParse(answer.json()).success).toBe(true);
    // In input order; the new slot says the transport of its registry row, which the line did not name.
    expect((answer.json() as SelectorBody).mics.map((mic) => [mic.inputId, mic.deviceId, mic.role, mic.transport])).toEqual([
      ['MIC-02', 'MIC-02', 'STANDBY', 'USB'],
      ['MIC-03', 'MIC-03', 'PRIMARY', 'AVFOUNDATION'],
    ]);
    await server.app.pipeline.drain();
    expect(await storedSelector(owner)).toEqual({ mic_primary_id: 'MIC-03', mic_standby_id: 'MIC-02' });
    expect((await changedRows(owner)).slice(rowsBefore)).toEqual([
      { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', inputId: 'MIC-03', deviceId: 'MIC-03', from: 'MIC-01', to: 'MIC-03', permission: 'CAPTURE_CONFIG' },
    ]);
    expect(await storedSlices(owner)).toStrictEqual(withoutBootDerivedSourceFacts(server.app.engine.state()));
    // CONTROL of the exclusion: without it the comparison is NOT equal - the members are there.
    expect(await storedSlices(owner)).not.toStrictEqual(withoutNegativeZeros(server.app.engine.state()));

    // REFUSED on the same server, nothing written: a pair that is not a pair, a microphone that is not registered.
    for (const body of [
      { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', role: 'PRIMARY' }] },
      { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', role: 'PRIMARY' }, { inputId: 'MIC-02', deviceId: 'MIC-02' }] },
      { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', role: 'PRIMARY' }, { inputId: 'MIC-02', deviceId: 'MIC-02', role: 'PRIMARY' }] },
      { mics: [{ inputId: 'MIC-03', deviceId: 'MIC-01', role: 'PRIMARY' }, { inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY' }] },
      pair('MIC-07', 'MIC-02'),
      // The earlier form edits an input the selector holds: MIC-01 is not one any more.
      { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] },
    ]) {
      const refused = await server.post(CONFIG, body);
      expect([refused.statusCode, (refused.json() as ErrorBody).error.code], JSON.stringify(body)).toEqual([422, 'INVALID_INPUT']);
    }
    // The earlier form is still accepted for an input the selector holds (a line that changes nothing: 200, no row).
    expect((await server.post(CONFIG, { mics: [{ inputId: 'MIC-03', deviceId: 'MIC-03' }] })).statusCode).toBe(200);
    await server.app.pipeline.drain();
    expect(await storedSelector(owner)).toEqual({ mic_primary_id: 'MIC-03', mic_standby_id: 'MIC-02' });
    expect(await changedRows(owner)).toHaveLength(rowsBefore + 1);

    const held = server.app.engine.slice('captureConfig');
    await server.app.close();
    const restarted = await booted(target, DEVELOPMENT);
    expect(restarted.app.engine.slice('captureConfig')).toEqual(held);
    await restarted.app.pipeline.drain();
    expect(await storedSlices(owner)).toStrictEqual(withoutBootDerivedSourceFacts(restarted.app.engine.state()));
  });

  it('ELSEWHERE, SIMULATED on the seed: the registry holds no MIC-03 - 422 INVALID_INPUT, nothing stored; CONTROL: the built-in pair trades roles by the same body', async () => {
    const target = await clone('d1b-pair-sim');
    const owner = target.ownerPool();
    const server = await booted(target, { demoControls: true });
    expect(captureFenceControl(server.app).registry()).toBeNull();
    const rowsBefore = (await changedRows(owner)).length;
    const refused = await server.post(CONFIG, pair('MIC-03', 'MIC-02'));
    expect([refused.statusCode, (refused.json() as ErrorBody).error.code], refused.body).toEqual([422, 'INVALID_INPUT']);
    await server.app.pipeline.drain();
    expect(await storedSelector(owner)).toEqual({ mic_primary_id: 'MIC-01', mic_standby_id: 'MIC-02' });
    expect(await changedRows(owner)).toHaveLength(rowsBefore);

    const traded = await server.post(CONFIG, pair('MIC-02', 'MIC-01'));
    expect(traded.statusCode, traded.body).toBe(200);
    await server.app.pipeline.drain();
    expect(await storedSelector(owner)).toEqual({ mic_primary_id: 'MIC-02', mic_standby_id: 'MIC-01' });
    expect((await changedRows(owner)).slice(rowsBefore)).toEqual([
      { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'ROLE', inputId: 'MIC-02', deviceId: 'MIC-02', from: 'STANDBY', to: 'PRIMARY', permission: 'CAPTURE_CONFIG' },
    ]);
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(server.app.engine.state()));
  });

  it('ELSEWHERE, REAL_DEVELOPMENT: a production microphone is refused by the adapter registry with the contract\'s reason, nothing stored', async () => {
    const target = await clone('d1b-pair-prod-mic');
    const owner = target.ownerPool();
    await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('MIC-11', 'MIC', 'USB', true, 'USB_AUDIO')");
    const server = await booted(target, DEVELOPMENT);
    expect(captureFenceControl(server.app).operation).toBe('REAL_DEVELOPMENT');
    const rowsBefore = (await changedRows(owner)).length;
    const refused = await server.post(CONFIG, pair('MIC-11', 'MIC-02'));
    expect(refused.statusCode, refused.body).toBe(422);
    const error = (refused.json() as ErrorBody).error;
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.details).toMatchObject({ reason: 'DEVELOPMENT_SOURCE_NOT_ALLOWED', deviceId: 'MIC-11' });
    await server.app.pipeline.drain();
    expect(await storedSelector(owner)).toEqual({ mic_primary_id: 'MIC-01', mic_standby_id: 'MIC-02' });
    expect(await changedRows(owner)).toHaveLength(rowsBefore);
  });
});
