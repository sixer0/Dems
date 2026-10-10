// The capture fence on PostgreSQL, AS THE RUNTIME ROLE, on throw-away clones (blueprint row 136;
// checks M4-SEC-FENCE-1, M4-SEC-HELPER-1; `dbc-4` §N.2, §N.9; SEC35-41 (b)).
//
// Each case is a whole boot of the real app factory on its own clone of the seed: the boot step
// `capture.fence` among the others, the statements of `statements.ts` run by `dems_app`, the audit
// row written through the pipeline. The owner pool only prepares what a clone holds and reads back.
//
// THE HELPER PROGRAM OF THESE TESTS is `/bin/echo`: a root-owned system program that passes the
// path rule. It is never asked to capture anything; started for the device list it prints no list,
// so both local devices read "not listed" (no device is listed, opened or asked for by a test).
import { existsSync } from 'node:fs';
import type { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { buildApp } from '../../../app';
import type { ConfigInput } from '../../../config';
import { engineControl } from '../../../engine';
import { BootError } from '../../../plugins/readiness';
import { realBootFixture } from '../../boot/__tests__/support';
import { CAPTURE_FENCE_BOOT_STEP, CaptureFenceError, REGISTER_LOCAL_DEVICE, captureFenceControl } from '../index';

const db = useTestDatabase({ template: 'seed' });
const HELPER = '/bin/echo';
// A boot in capture mode real that the FENCE lets through then meets the boot checks of row 61
// (`capture.boot`, mounted by row 71b; ruling D144): a worker program that says HELLO, a private
// media root and a provisioned signing key. Row 61's fixture gives the three below `.data/`; the
// worker is a stand-in script that records nothing, opens no port and reads no device.
const realBoot = realBootFixture('fence');
realBoot.provisionKey();
afterAll(() => realBoot.remove());
const REAL = { captureMode: 'real', demoControls: false, dataDir: realBoot.dataDir, captureWorkerPath: realBoot.worker('capture-worker', 'capture-worker/0.3.0') } as const;
const DEVELOPMENT = { ...REAL, captureDevSources: true, captureHelperFfmpegPath: HELPER } as const;

type Clone = Awaited<ReturnType<typeof db.another>>;
interface Booted {
  readonly app: ReturnType<typeof buildApp>;
  readonly log: CapturedLog;
  readonly failure: BootError | null;
}

/**
 * A clone of the seed with speech-to-text switched off (the owner writes it, as a fixture): in
 * capture mode `real` the boot step of the transcriber resolves the stored selection first, and a
 * test host has no speech runtime. The fence is the subject here, not the transcriber.
 */
async function clone(slug: string): Promise<Clone> {
  const target = await db.another({ template: 'seed', slug });
  await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
  return target;
}

/** The real app on a clone, as `dems_app`, booted. A refused boot is returned, not thrown. */
async function boot(target: Clone, overrides: Partial<ConfigInput>): Promise<Booted> {
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'info', ...overrides }), logStream: log.stream });
  target.onCleanup(() => app.close());
  await app.ready();
  try {
    await app.readiness.boot();
    return { app, log, failure: null };
  } catch (error) {
    if (!(error instanceof BootError)) throw error;
    return { app, log, failure: error };
  }
}

const devicesOf = async (owner: Pool): Promise<Record<string, unknown>[]> => (await owner.query('SELECT id, kind, transport, model, firmware, address, mac, onvif_uuid, profiles, poe_port, enabled, last_seen_at::text AS last_seen_at, adapter_kind FROM public.capture_devices ORDER BY id')).rows;
const kindsOf = async (owner: Pool): Promise<string[]> => (await devicesOf(owner)).map((row) => `${String(row['id'])}:${String(row['adapter_kind'])}`);
const bootAuditsOf = async (owner: Pool): Promise<unknown[]> => (await owner.query("SELECT details FROM public.audit_log WHERE type = 'SYSTEM_BOOT' AND details ? 'captureOperation' ORDER BY seq")).rows.map((row: { details: unknown }) => row.details);

/**
 * What an adoption would leave (the owner writes it as a fixture): two production cameras, assigned
 * to the two tracks. The microphones stay `MIC-01` / `MIC-02` here. (Until pass C1 the shared contract
 * named a microphone input by exactly those two ids; the rule is `MIC-NN` now, D115(2), so a stored
 * selector may name another registered microphone - see the `MIC-03` case below.)
 */
async function assignProduction(owner: Pool): Promise<void> {
  await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('CAM-11', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP'), ('CAM-12', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP')");
  await owner.query("UPDATE public.capture_config SET video_01_device_id = 'CAM-11', video_02_device_id = 'CAM-12'");
}
const addLocalRows = (owner: Pool): Promise<unknown> =>
  owner.query("INSERT INTO public.capture_devices (id, kind, transport, model, enabled, adapter_kind) VALUES ('CAM-03', 'CAMERA', 'AVFOUNDATION', 'MacBook Air Camera', false, 'LOCAL_DEVICE'), ('MIC-03', 'MIC', 'AVFOUNDATION', 'MacBook Air Microphone', false, 'LOCAL_DEVICE')");

/** The helper rule a refused boot names, or null. */
const helperProblemOf = (booted: Booted): string | null => (booted.failure?.cause instanceof CaptureFenceError ? booted.failure.cause.helperProblem : null);

function expectRefused(booted: Booted, code: string, deviceIds: readonly string[] = []): void {
  expect(booted.failure?.stepId).toBe(CAPTURE_FENCE_BOOT_STEP);
  const cause = booted.failure?.cause;
  expect(cause).toBeInstanceOf(CaptureFenceError);
  expect((cause as CaptureFenceError).code).toBe(code);
  expect((cause as CaptureFenceError).deviceIds).toEqual(deviceIds);
  // The refusal code is in the log; the step did not pass.
  const lines = booted.log.lines();
  expect(lines.filter((line) => line['msg'] === 'the capture fence refuses this configuration: the server does not start').map((line) => line['code'])).toEqual([code]);
  expect(lines.some((line) => line['msg'] === 'boot step passed' && line['step'] === CAPTURE_FENCE_BOOT_STEP)).toBe(false);
}

describe('the schema this row was written against', () => {
  it('schema version 6, contract dbc-7', async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([6, 'dbc-7']);
  });
});

describe('SIMULATED: every stored kind is inert and the database keeps booting', () => {
  it('row 1 on the seed: boots, registers nothing, and no table moves (no boot audit row in SIMULATED until it is ruled)', async () => {
    const target = await clone('fence-sim');
    const before = await devicesOf(target.ownerPool());
    const booted = await boot(target, { demoControls: true });
    expect(booted.failure).toBeNull();
    expect(captureFenceControl(booted.app).operation).toBe('SIMULATED');
    expect(captureFenceControl(booted.app).registry()).toBeNull();
    expect(await devicesOf(target.ownerPool())).toEqual(before);
    expect(await bootAuditsOf(target.ownerPool())).toEqual([]);
  });

  it('a database that holds ASSIGNED local and production devices boots all the same (and its engine lists them)', async () => {
    const target = await clone('fence-sim-stored');
    const owner = target.ownerPool();
    await assignProduction(owner);
    await addLocalRows(owner);
    await owner.query("UPDATE public.capture_config SET video_02_device_id = 'CAM-03'");
    for (const demoControls of [true, false]) {
      const booted = await boot(target, { demoControls });
      expect(booted.failure, `demo controls ${String(demoControls)}`).toBeNull();
      expect(engineControl(booted.app).state().captureDevices.devices).toHaveLength(9);
      await booted.app.close();
    }
    expect(await bootAuditsOf(owner)).toEqual([]);
    // CONTROL: the very same database is refused the moment the capture mode is real.
    expectRefused(await boot(target, REAL), 'DEV_SOURCE_WITHOUT_FLAG', ['CAM-03', 'MIC-01', 'MIC-02']);
  });

  it('a stored selector that names MIC-03 rehydrates since the microphone id rule is MIC-NN (pass C1, D115(2)): the simulated boot goes through', async () => {
    const target = await clone('fence-sim-mic');
    const owner = target.ownerPool();
    await addLocalRows(owner);
    await owner.query("UPDATE public.capture_config SET mic_primary_id = 'MIC-03'");
    const booted = await boot(target, { demoControls: true });
    try {
      expect(booted.failure).toBeNull();
      expect(captureFenceControl(booted.app).operation).toBe('SIMULATED');
      expect(engineControl(booted.app).state().captureConfig.mics.map((mic) => [mic.inputId, mic.role]).sort()).toEqual([['MIC-02', 'STANDBY'], ['MIC-03', 'PRIMARY']]);
    } finally {
      await booted.app.close();
    }
  });

  it('CONTROL of the fixture: a stored selector whose microphone slot names a device that is no microphone (CAM-01) is still rejected by the engine before the fence is asked', async () => {
    // A malformed id such as MIC-3 cannot be stored at all: the slot is a foreign key to the device table.
    const target = await clone('fence-sim-mic-cam');
    const owner = target.ownerPool();
    await addLocalRows(owner);
    await owner.query("UPDATE public.capture_config SET mic_primary_id = 'CAM-01'");
    const booted = await boot(target, { demoControls: true });
    expect(booted.failure?.stepId).toBe('engine.rehydrate');
    expect(await bootAuditsOf(owner)).toEqual([]);
  });

  it('row 6: the flag with capture mode simulated is refused and leaves no audit row', async () => {
    const target = await clone('fence-row6');
    expectRefused(await boot(target, { demoControls: true, captureDevSources: true, captureHelperFfmpegPath: HELPER }), 'DEV_SOURCES_NEED_REAL_CAPTURE');
    expect(await bootAuditsOf(target.ownerPool())).toEqual([]);
  });
});

describe('REAL_PRODUCTION: a development source is never part of it', () => {
  it('row 7 on the seed: the four assigned built-ins are FAKE, so the boot is refused, by name, with no audit row', async () => {
    const target = await clone('fence-row7');
    const booted = await boot(target, REAL);
    expectRefused(booted, 'DEV_SOURCE_WITHOUT_FLAG', ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02']);
    expect(await bootAuditsOf(target.ownerPool())).toEqual([]);
    expect(await kindsOf(target.ownerPool())).toEqual(['CAM-01:FAKE', 'CAM-02:FAKE', 'MIC-01:FAKE', 'MIC-02:FAKE', 'POE-SWITCH:FAKE']);
  });

  it('a stored LOCAL_DEVICE row: assigned -> the refusal names it; registered but unassigned -> it is not named (the fence reads the selector, not the registry)', async () => {
    const target = await clone('fence-local-prod');
    const owner = target.ownerPool();
    await assignProduction(owner);
    await addLocalRows(owner);
    // Unassigned: the local rows are ignored. What stops this boot is the two FAKE microphones that are assigned.
    expectRefused(await boot(target, REAL), 'DEV_SOURCE_WITHOUT_FLAG', ['MIC-01', 'MIC-02']);
    await owner.query("UPDATE public.capture_config SET video_02_device_id = 'CAM-03'");
    expectRefused(await boot(target, REAL), 'DEV_SOURCE_WITHOUT_FLAG', ['CAM-03', 'MIC-01', 'MIC-02']);
    // One key more does not open it: the flag is refused for the production source that stays assigned.
    expectRefused(await boot(target, DEVELOPMENT), 'DEV_FLAG_WITH_PRODUCTION_SOURCE', ['CAM-11']);
    expect(await bootAuditsOf(owner)).toEqual([]);
    expect(await kindsOf(owner)).toEqual(['CAM-01:FAKE', 'CAM-02:FAKE', 'CAM-03:LOCAL_DEVICE', 'CAM-11:ONVIF_RTSP', 'CAM-12:ONVIF_RTSP', 'MIC-01:FAKE', 'MIC-02:FAKE', 'MIC-03:LOCAL_DEVICE', 'POE-SWITCH:FAKE']);
  });

  it('row 4: real with demo controls is refused', async () => {
    const target = await clone('fence-row4');
    expectRefused(await boot(target, { ...DEVELOPMENT, demoControls: true }), 'REAL_CAPTURE_WITH_DEMO_CONTROLS');
  });
});

describe('REAL_DEVELOPMENT: the local devices are registered as rows of their own, once', () => {
  it('row 3: two boots - the first inserts CAM-03 and MIC-03 as LOCAL_DEVICE, the second writes nothing; no built-in is touched', async () => {
    const target = await clone('fence-dev');
    const owner = target.ownerPool();
    const seeded = await devicesOf(owner);
    expect(seeded.map((row) => row['adapter_kind'])).toEqual(['FAKE', 'FAKE', 'FAKE', 'FAKE', 'FAKE']);

    const first = await boot(target, DEVELOPMENT);
    expect(first.failure).toBeNull();
    const fence = captureFenceControl(first.app);
    expect(fence.operation).toBe('REAL_DEVELOPMENT');
    expect(fence.outcome()).toMatchObject({ local: { cameraId: 'CAM-03', micId: 'MIC-03' }, inserted: ['CAM-03', 'MIC-03'], helperProgram: HELPER });
    const after = await devicesOf(owner);
    expect(after.filter((row) => row['adapter_kind'] === 'LOCAL_DEVICE')).toEqual([
      { id: 'CAM-03', kind: 'CAMERA', transport: 'AVFOUNDATION', model: 'MacBook Air Camera', firmware: null, address: null, mac: null, onvif_uuid: null, profiles: [], poe_port: null, enabled: false, last_seen_at: null, adapter_kind: 'LOCAL_DEVICE' },
      { id: 'MIC-03', kind: 'MIC', transport: 'AVFOUNDATION', model: 'MacBook Air Microphone', firmware: null, address: null, mac: null, onvif_uuid: null, profiles: [], poe_port: null, enabled: false, last_seen_at: null, adapter_kind: 'LOCAL_DEVICE' },
    ]);
    // The five built-ins: every column as the seed wrote it.
    expect(after.filter((row) => row['adapter_kind'] === 'FAKE')).toEqual(seeded);
    // The engine read the registry again: the first development boot already lists the two devices.
    expect(engineControl(first.app).state().captureDevices.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'MIC-01', 'MIC-02', 'MIC-03', 'POE-SWITCH']);
    // The registry of the running operation: local devices and test sources, each with an opener.
    expect(fence.registry()?.list().map((entry) => `${entry.id}:${entry.adapterKind}`)).toEqual(['CAM-01:FAKE', 'CAM-02:FAKE', 'CAM-03:LOCAL_DEVICE', 'MIC-01:FAKE', 'MIC-02:FAKE', 'MIC-03:LOCAL_DEVICE', 'POE-SWITCH:FAKE']);
    expect(fence.openSources()).toEqual([]);
    expect(await fence.leftoverHelpers()).toEqual([]);
    expect(await bootAuditsOf(owner)).toEqual([{ captureOperation: 'REAL_DEVELOPMENT' }]);
    await first.app.close();

    const second = await boot(target, DEVELOPMENT);
    expect(second.failure).toBeNull();
    expect(captureFenceControl(second.app).outcome()).toMatchObject({ local: { cameraId: 'CAM-03', micId: 'MIC-03' }, inserted: [] });
    expect(await devicesOf(owner)).toEqual(after);
    expect(await bootAuditsOf(owner)).toEqual([{ captureOperation: 'REAL_DEVELOPMENT' }, { captureOperation: 'REAL_DEVELOPMENT' }]);
    // Once registered they are development sources: taking the flag away without unassigning is fine (they are not assigned) ...
    await second.app.close();
    // ... but the seeded FAKE built-ins are still assigned, so a production boot of this database stays refused.
    expectRefused(await boot(target, REAL), 'DEV_SOURCE_WITHOUT_FLAG', ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02']);
  });

  it('the statement by itself, as dems_app: idempotent, the next free id, and adapter_kind can be written at INSERT only', async () => {
    const target = await clone('fence-stmt');
    const app = target.appPool();
    const camera = ['CAMERA', 'CAM-', 'AVFOUNDATION', 'MacBook Air Camera', true];
    expect((await app.query(REGISTER_LOCAL_DEVICE, camera)).rows).toEqual([{ id: 'CAM-03' }]);
    expect((await app.query(REGISTER_LOCAL_DEVICE, camera)).rows).toEqual([]);
    expect((await app.query(REGISTER_LOCAL_DEVICE, ['MIC', 'MIC-', 'AVFOUNDATION', 'MacBook Air Microphone', false])).rows).toEqual([{ id: 'MIC-03' }]);
    expect(await kindsOf(target.ownerPool())).toEqual(['CAM-01:FAKE', 'CAM-02:FAKE', 'CAM-03:LOCAL_DEVICE', 'MIC-01:FAKE', 'MIC-02:FAKE', 'MIC-03:LOCAL_DEVICE', 'POE-SWITCH:FAKE']);
    // The runtime role may not change a kind: not of a built-in into a local device, not of a local device into anything.
    await expect(app.query("UPDATE public.capture_devices SET adapter_kind = 'LOCAL_DEVICE' WHERE id = 'CAM-01'")).rejects.toMatchObject({ code: '42501' });
    await expect(app.query("UPDATE public.capture_devices SET adapter_kind = 'ONVIF_RTSP' WHERE id = 'CAM-03'")).rejects.toMatchObject({ code: '42501' });
    // CONTROL: a column the role does hold is updated by the same kind of statement.
    expect((await app.query("UPDATE public.capture_devices SET enabled = false WHERE id = 'CAM-03'")).rowCount).toBe(1);
    // The class of a kind is held by the database too: a switch cannot be a local device.
    await expect(app.query(REGISTER_LOCAL_DEVICE, ['POE', 'POE-', 'AVFOUNDATION', 'x', false])).rejects.toMatchObject({ code: '23514' });
  });

  it('row 8: the flag with an assigned production source is refused and registers nothing', async () => {
    const target = await clone('fence-row8');
    const owner = target.ownerPool();
    await assignProduction(owner);
    const before = await devicesOf(owner);
    expectRefused(await boot(target, DEVELOPMENT), 'DEV_FLAG_WITH_PRODUCTION_SOURCE', ['CAM-11', 'CAM-12']);
    expect(await devicesOf(owner)).toEqual(before);
    expect(await bootAuditsOf(owner)).toEqual([]);
  });

  it('row 9: no helper program, or one the path rule refuses, is refused and registers nothing', async () => {
    const target = await clone('fence-row9');
    const owner = target.ownerPool();
    const unset = await boot(target, { ...DEVELOPMENT, captureHelperFfmpegPath: null });
    expectRefused(unset, 'DEV_HELPER_PROGRAM_UNUSABLE');
    expect(helperProblemOf(unset)).toBe('NOT_SET');
    const missing = await boot(target, { ...DEVELOPMENT, captureHelperFfmpegPath: '/nonexistent/dems/ffmpeg' });
    expectRefused(missing, 'DEV_HELPER_PROGRAM_UNUSABLE');
    expect(helperProblemOf(missing)).toBe('NOT_FOUND');
    expect(missing.log.text()).not.toContain('/nonexistent/dems/ffmpeg');
    expect(await kindsOf(owner)).toEqual(['CAM-01:FAKE', 'CAM-02:FAKE', 'MIC-01:FAKE', 'MIC-02:FAKE', 'POE-SWITCH:FAKE']);
    expect(await bootAuditsOf(owner)).toEqual([]);
  });

  const HOMEBREW = '/opt/homebrew/bin/ffmpeg';
  it.runIf(existsSync(HOMEBREW))('row 9 on this host: the package manager\'s FFmpeg is refused (DIRECTORY_WRITABLE): no development exception', async () => {
    const target = await clone('fence-row9-brew');
    const booted = await boot(target, { ...DEVELOPMENT, captureHelperFfmpegPath: HOMEBREW });
    expectRefused(booted, 'DEV_HELPER_PROGRAM_UNUSABLE');
    expect(helperProblemOf(booted)).toBe('DIRECTORY_WRITABLE');
    expect(await kindsOf(target.ownerPool())).toEqual(['CAM-01:FAKE', 'CAM-02:FAKE', 'MIC-01:FAKE', 'MIC-02:FAKE', 'POE-SWITCH:FAKE']);
  });
});
