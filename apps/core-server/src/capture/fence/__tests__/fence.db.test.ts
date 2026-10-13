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
import { OPERATORS, unassignedSlotOfPrecheckItem, type OperatorRole } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { fakeLauncher, flush, type FakeLauncher } from '../../../../test/support/capture';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { FIXED_NOW, engineApp, type EngineApp } from '../../../../test/support/engine';
import { WEB_ORIGIN, cookieValue, webSignIn } from '../../../../test/support/identity';
import { buildApp } from '../../../app';
import { captureNotices } from '../../../capture-notices';
import { sessionCapture } from '../../../capture-session';
import type { ConfigInput } from '../../../config';
import { engineControl } from '../../../engine';
import { hashPassword } from '../../../modules/identity/password-hash';
import { BootError } from '../../../plugins/readiness';
import { LIVING_PROGRESS, deviceListText, scriptedDoor } from '../../adapters/local/__tests__/mic-support';
import { realBootFixture } from '../../boot/__tests__/support';
import { createCaptureSupervisor, createSystemTimers } from '../../index';
import type { CaptureTimers } from '../../types';
import { CAPTURE_FENCE_BOOT_STEP, CaptureFenceError, REGISTER_LOCAL_DEVICE, buildDevelopmentRegistry, captureFenceControl } from '../index';

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
/**
 * The clones of the running case. EVERY clone is DROPPED AFTER ITS CASE, with what the case registered
 * on it (`onCleanup`: the app, the supervisor, the registry), in the order of `drop()` - as at the end of
 * the file before, only earlier. No case shares a clone with another. Until fix I-7b every clone lived
 * to the end of the file (about fifty at once since row 33), and two such files side by side met the
 * helper's bound of 99 live clones of one run (`test/helpers/db/names.ts`, `lowestFreeCounter`).
 */
const caseClones: Clone[] = [];
afterEach(async () => {
  const problems: unknown[] = [];
  for (const target of caseClones.splice(0).reverse()) {
    try {
      await target.drop();
    } catch (error) {
      problems.push(error);
    }
  }
  if (problems.length > 0) throw problems[0];
});
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
  caseClones.push(target);
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
  it('schema version 8, contract dbc-9', async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([8, 'dbc-9']);
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

// Fix wave K, reconcile pass (re-gate 89 finding G89b-01, second half; ruling of 2026-10-11): the
// selector line of a GENERATED test source states the profile its adapter makes. The seed writes
// the simulator's `H264_1080P25` and the two capture tables are kept across a reset, so the Core
// that registers the generated adapters corrects the line at its start (`fake-profile.ts`).
describe('REAL_DEVELOPMENT: the selector line of a generated test source states its adapter\'s profile (G89b-01)', () => {
  const selectorOf = async (owner: Pool): Promise<Record<string, unknown>> =>
    (await owner.query('SELECT video_01_device_id AS v1, video_01_profile AS p1, video_02_device_id AS v2, video_02_profile AS p2, revision::int AS revision FROM public.capture_config')).rows[0] as Record<string, unknown>;

  it('a kept database that says 1080p25: the development start corrects both FAKE lines once, the engine states it, a second start writes nothing', async () => {
    const target = await clone('fence-profile');
    const owner = target.ownerPool();
    expect(await selectorOf(owner)).toEqual({ v1: 'CAM-01', p1: 'H264_1080P25', v2: 'CAM-02', p2: 'H264_1080P25', revision: 1 });

    const first = await boot(target, DEVELOPMENT);
    expect(first.failure).toBeNull();
    expect(captureFenceControl(first.app).outcome()).toMatchObject({ generatedProfilesCorrected: true });
    expect(await selectorOf(owner)).toEqual({ v1: 'CAM-01', p1: 'H264_720P30', v2: 'CAM-02', p2: 'H264_720P30', revision: 2 });
    // The selector the clients read, and the profile the registry's adapter declares: one text.
    expect(engineControl(first.app).state().captureConfig.cameras.map((camera) => `${camera.deviceId}:${camera.profile}`)).toEqual(['CAM-01:H264_720P30', 'CAM-02:H264_720P30']);
    expect(captureFenceControl(first.app).registry()?.describe('CAM-01').profiles).toEqual(['H264_720P30']);
    expect(first.log.lines().filter((line) => line['code'] === 'DEV_GENERATED_SOURCE_PROFILE_STATED')).toHaveLength(1);
    await first.app.close();

    const second = await boot(target, DEVELOPMENT);
    expect(second.failure).toBeNull();
    expect(captureFenceControl(second.app).outcome()).not.toHaveProperty('generatedProfilesCorrected');
    expect(await selectorOf(owner)).toMatchObject({ p1: 'H264_720P30', p2: 'H264_720P30', revision: 2 });
    expect(second.log.lines().filter((line) => line['code'] === 'DEV_GENERATED_SOURCE_PROFILE_STATED')).toEqual([]);
  });

  it('CONTROL: only a FAKE line is touched (the local camera on VIDEO-01 keeps its line), and a simulated Core corrects nothing', async () => {
    const simulated = await clone('fence-profile-sim');
    const booted = await boot(simulated, {});
    expect(booted.failure).toBeNull();
    expect(await selectorOf(simulated.ownerPool())).toMatchObject({ p1: 'H264_1080P25', p2: 'H264_1080P25', revision: 1 });
    await booted.app.close();

    const target = await clone('fence-profile-local');
    const owner = target.ownerPool();
    // What an earlier development start and an operator's choice would leave: this Mac's camera row, assigned to VIDEO-01 with a profile of its own.
    await owner.query("INSERT INTO public.capture_devices (id, kind, transport, model, enabled, adapter_kind) VALUES ('CAM-03', 'CAMERA', 'AVFOUNDATION', 'MacBook Air Camera', false, 'LOCAL_DEVICE')");
    await owner.query("UPDATE public.capture_config SET video_01_device_id = 'CAM-03', video_01_profile = 'H264_1080P30'");
    const development = await boot(target, DEVELOPMENT);
    expect(development.failure).toBeNull();
    expect(await selectorOf(owner)).toEqual({ v1: 'CAM-03', p1: 'H264_1080P30', v2: 'CAM-02', p2: 'H264_720P30', revision: 2 });
  });
});

// ── Task 4 row 33 (WP-13a): THE 21-STATE TABLE of design addendum 1.5 / 1.7 ON POSTGRESQL ──────────
// Security addendum 3.1 (the enumeration re-derived; S-5), requirements AD-04 (3), AD-10 (4);
// decisions C14, C18, C21 (6), C25, C34. TESTS ONLY: no file of the fence is edited by this row.
//
// Each state is a WHOLE Core on its own clone of the seed: the real app factory as `dems_app`, the
// boot with every step (the fence, the boot checks, the module's load, the engine rehydration), and
// - where the Core starts - ONE session taken as far as the product lets an operator take it,
// through the product's own operations over the request pipeline: sign-in, create, start (the
// pre-check), start again with the warnings acknowledged. What the operator is answered, what the
// trail and the table `session_capture_sources` hold and how often a worker was started are read
// afterwards. THE EXPECTED COLUMNS ARE WRITTEN OUT BY HAND, state by state.
//
// WHAT IS REAL: everything above, the stored selector (NULL for an unassigned slot), the stored
// device rows with their adapter kinds, the registry the fence builds for the operation.
// WHAT STANDS IN:
//   - the worker: after the boot the capture seam is a supervisor on the `FakeWorkerProcess`
//     launcher, so "the worker was started N times" is counted and nothing is recorded;
//   - in REAL_DEVELOPMENT the helper program is never started for a session: the registry is the
//     product's builder over what the boot read, with the scripted door in the place of the
//     process door (as `development-session.db.test.ts`); no camera or microphone is listed, opened
//     or asked for;
//   - the PRODUCTION device rows (`CAM-11`, `CAM-12` of kind ONVIF_RTSP; `MIC-11`, `MIC-12` of kind
//     USB_AUDIO, without an address) are written by the owner, as the fixture of this file always
//     did: adoption needs a camera that answers and microphone registration a Linux sound card;
//   - the operators' own passwords of a REAL_PRODUCTION clone (a production Core refuses the
//     published demonstration password, D241) are written by the owner from a run-time value.
// A selector that names a production device is written by the owner into the clone BEFORE the
// boot; a development Core would refuse to assign one and a production Core has no adapter yet.
describe('task 4 row 33: the 21-state table on PostgreSQL - seven selector categories by the three capture operations; "the remedy is executable"; "no recording without sources" (addendum 1.5, 1.7)', () => {
  type Slot = 'VIDEO-01' | 'VIDEO-02' | 'PRIMARY' | 'STANDBY';
  type Lines = Readonly<Record<Slot, string | null>>;
  type Category = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '2 (S-5)' | '3 (S-5)';
  type Operation = 'SIMULATED' | 'REAL_DEVELOPMENT' | 'REAL_PRODUCTION';
  const SLOT_ORDER: readonly Slot[] = ['VIDEO-01', 'VIDEO-02', 'PRIMARY', 'STANDBY'];
  const U = null;
  const PROFILE = 'H264_1080P25';
  /** D: CAM-01, CAM-02, MIC-01, MIC-02 (the seed's FAKE rows). P: CAM-11, CAM-12 (ONVIF_RTSP), MIC-11, MIC-12 (USB_AUDIO). */
  const CATEGORY: Readonly<Record<Category, { readonly title: string; readonly lines: Lines }>> = {
    '1': { title: 'all four U', lines: { 'VIDEO-01': U, 'VIDEO-02': U, PRIMARY: U, STANDBY: U } },
    '2': { title: 'some U, the rest D', lines: { 'VIDEO-01': U, 'VIDEO-02': 'CAM-02', PRIMARY: 'MIC-01', STANDBY: U } },
    '3': { title: 'some U, the rest P', lines: { 'VIDEO-01': 'CAM-11', 'VIDEO-02': U, PRIMARY: U, STANDBY: 'MIC-12' } },
    '4': { title: 'some U, D and P', lines: { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-12', PRIMARY: 'MIC-11', STANDBY: U } },
    '5': { title: 'four assigned, all D (the seed)', lines: { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-02', PRIMARY: 'MIC-01', STANDBY: 'MIC-02' } },
    '6': { title: 'four assigned, all P', lines: { 'VIDEO-01': 'CAM-11', 'VIDEO-02': 'CAM-12', PRIMARY: 'MIC-11', STANDBY: 'MIC-12' } },
    '7': { title: 'four assigned, D and P', lines: { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-12', PRIMARY: 'MIC-11', STANDBY: 'MIC-02' } },
    // State S-5 of the security addendum (AD-10 (4)): only the STANDBY microphone is unassigned.
    '2 (S-5)': { title: 'three D, a lone unassigned STANDBY', lines: { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-02', PRIMARY: 'MIC-01', STANDBY: U } },
    '3 (S-5)': { title: 'three P, a lone unassigned STANDBY', lines: { 'VIDEO-01': 'CAM-11', 'VIDEO-02': 'CAM-12', PRIMARY: 'MIC-11', STANDBY: U } },
  };
  const unassignedOf = (lines: Lines): Slot[] => SLOT_ORDER.filter((slot) => lines[slot] === null);
  const linesOf = (selector: { readonly cameras: readonly { readonly trackId: string; readonly deviceId: string }[]; readonly mics: readonly { readonly role: string; readonly deviceId: string }[] }): string[] =>
    [...selector.cameras.map((camera) => `${camera.trackId} ${camera.deviceId}`), ...selector.mics.map((mic) => `${mic.role} ${mic.deviceId}`)].sort();
  const heldOf = (lines: Lines): string[] => SLOT_ORDER.flatMap((slot) => (lines[slot] === null ? [] : [`${slot} ${String(lines[slot])}`])).sort();

  const CONFIG_OF: Readonly<Record<Operation, Partial<ConfigInput>>> = { SIMULATED: { demoControls: true }, REAL_DEVELOPMENT: DEVELOPMENT, REAL_PRODUCTION: REAL };
  const SESSION_URL = '/api/v1/session';
  const SELECTOR_URL = '/api/v1/capture/config';
  const on = (sessionId: string, operation: string): string => `${SESSION_URL}/${sessionId}/${operation}`;

  /** The production device rows of a clone, as an adoption and a microphone registration would leave them. No address: nothing is dialled. */
  const addProductionRows = (owner: Pool): Promise<unknown> =>
    owner.query(
      "INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('CAM-11', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP'), ('CAM-12', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP'), ('MIC-11', 'MIC', 'USB', true, 'USB_AUDIO'), ('MIC-12', 'MIC', 'USB', true, 'USB_AUDIO')",
    );
  /** The stored selector of a category: NULL in the columns of an unassigned slot (device and profile of a video slot together). */
  const storeSelector = (owner: Pool, lines: Lines): Promise<unknown> =>
    owner.query('UPDATE public.capture_config SET video_01_device_id = $1, video_01_profile = $2, video_02_device_id = $3, video_02_profile = $4, mic_primary_id = $5, mic_standby_id = $6', [
      lines['VIDEO-01'],
      lines['VIDEO-01'] === null ? null : PROFILE,
      lines['VIDEO-02'],
      lines['VIDEO-02'] === null ? null : PROFILE,
      lines.PRIMARY,
      lines.STANDBY,
    ]);
  const storedSlots = async (owner: Pool): Promise<(string | null)[]> => {
    const row = (await owner.query('SELECT video_01_device_id AS a, video_02_device_id AS b, mic_primary_id AS c, mic_standby_id AS d FROM public.capture_config')).rows[0] as Record<string, string | null>;
    return [row['a'] ?? null, row['b'] ?? null, row['c'] ?? null, row['d'] ?? null];
  };
  const sourceRowsOf = async (owner: Pool, sessionId: string | null = null): Promise<string[]> =>
    (await owner.query('SELECT session_id, slot, device_id, adapter_kind FROM public.session_capture_sources ORDER BY session_id, slot')).rows
      .filter((row: { session_id: string }) => sessionId === null || row.session_id === sessionId)
      .map((row: { slot: string; device_id: string; adapter_kind: string }) => `${row.slot} ${row.device_id} ${row.adapter_kind}`);

  /**
   * A password of the operators' own for a `REAL_PRODUCTION` clone (D241). Built at run time and
   * kept nowhere; the stored hash sets are replaced by one the product's hasher derived from it.
   */
  const OWN_PASSWORD = ['own', 'row33', String(process.pid), 'p4Wz'].join('-');
  let ownRecord: ReturnType<typeof hashPassword> | null = null;
  async function ownCredentials(owner: Pool): Promise<void> {
    ownRecord ??= hashPassword(OWN_PASSWORD);
    const record = await ownRecord;
    await owner.query('UPDATE public.operator_credentials SET algorithm = $1, memory_kib = $2, passes = $3, parallelism = $4, salt = $5, hash = $6', [record.algorithm, record.memoryKib, record.passes, record.parallelism, record.salt, record.hash]);
  }
  const passwordOf = (operation: Operation): string | undefined => (operation === 'REAL_PRODUCTION' ? OWN_PASSWORD : undefined);

  /** The settle time of a helper fires at the next turn; a bound keeps its real length (and never holds the process). */
  const soon: CaptureTimers = {
    after(delayMs, callback) {
      if (delayMs > 1_500) {
        const timer = setTimeout(callback, delayMs);
        timer.unref();
        return () => clearTimeout(timer);
      }
      const handle = setImmediate(callback);
      return () => clearImmediate(handle);
    },
  };
  const DEVICE_LIST = deviceListText(['MacBook Air Microphone'], ['MacBook Air Camera', 'Capture screen 0']);

  interface Core {
    readonly host: EngineApp;
    readonly owner: Pool;
    readonly failure: BootError | null;
    /** The boot steps that passed, in order. */
    readonly steps: readonly string[];
    /** The launcher behind the capture seam of a real operation; null in SIMULATED (it has no worker) and for a refused boot. */
    readonly fake: FakeLauncher | null;
  }

  /**
   * The real app on a clone in an operation, booted on a manual clock and timer. A refused boot is returned, not thrown.
   * `startAt`: where the manual clock of this process start stands - a RESTART on a clone whose earlier Core moved its clock
   * names a later instant (a server clock never runs behind the stored state).
   */
  async function coreOn(target: Clone, operation: Operation, startAt: number = FIXED_NOW + 60_000): Promise<Core> {
    const owner = target.ownerPool();
    const host = await engineApp(target, db.run.dataDir, { startAt, logLevel: 'info', config: CONFIG_OF[operation] });
    let failure: BootError | null = null;
    try {
      await host.app.readiness.boot();
    } catch (error) {
      if (!(error instanceof BootError)) throw error;
      failure = error;
    }
    const steps = host.log.lines().filter((line) => line['msg'] === 'boot step passed').map((line) => String(line['step']));
    if (failure !== null) return { host, owner, failure, steps, fake: null };
    await host.engine.idle();
    expect(captureFenceControl(host.app).operation).toBe(operation);
    if (operation === 'SIMULATED') return { host, owner, failure, steps, fake: null };

    // THE WORKER STANDS IN: every start of a worker from here on is a call of this launcher.
    const fake = fakeLauncher({ ackSwitch: false });
    const supervisor = createCaptureSupervisor({ now: () => host.app.clock.now(), timers: createSystemTimers(), launcher: fake.launcher });
    await supervisor.boot();
    host.app.seams.replace('capture', supervisor);
    target.onCleanup(() => supervisor.shutdown());
    if (operation === 'REAL_DEVELOPMENT') {
      // The product's registry builder over what the boot read, with the scripted door: the helper program is played, never started.
      const outcome = captureFenceControl(host.app).outcome();
      if (outcome === null || outcome.local === null) throw new Error('the development fence did not pass');
      const built = buildDevelopmentRegistry({ devices: outcome.devices, local: outcome.local, program: HELPER, runDir: `${realBoot.dataDir}/run/capture`, now: () => host.app.clock.now(), timers: soon, door: scriptedDoor(DEVICE_LIST, () => ({ lives: true, reports: LIVING_PROGRESS })).door });
      target.onCleanup(() => built.closeAll());
      sessionCapture(host.app).replace({ registry: () => built.registry, leftoverHelpers: async () => [], tapPathFor: async () => null });
    }
    return { host, owner, failure, steps, fake };
  }

  interface Caller {
    readonly operatorId: string;
    readonly headers: Record<string, string>;
  }
  /** The seeded operator of a role, signed in on the web console. */
  async function signIn(host: EngineApp, role: OperatorRole, password: string | undefined): Promise<Caller> {
    const operator = OPERATORS.find((candidate) => candidate.role === role);
    if (operator === undefined) throw new Error(`no seeded operator with role ${role}`);
    const response = await webSignIn(host.app, operator.username, password);
    expect(response.statusCode, `the sign-in of the ${role}`).toBe(200);
    const token = cookieValue(response, host.app.config.sessionCookieName);
    if (token === null) throw new Error('the web sign-in set no session cookie');
    return { operatorId: operator.id, headers: { cookie: `${host.app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN } };
  }
  const post = (host: EngineApp, caller: Caller, url: string, payload?: object): Promise<LightMyRequestResponse> => host.app.inject({ method: 'POST', url, headers: caller.headers, ...(payload === undefined ? {} : { payload }) });

  /** `[status, the state of an accepted command or the code of a refusal, details.reason, details.cause]`. */
  type Answer = readonly [number, string | null, string | null, string | null];
  function answerOf(response: LightMyRequestResponse): Answer {
    const body = (response.body === '' ? {} : response.json()) as { state?: string; error?: { code?: string; details?: Record<string, unknown> } };
    const detail = (member: string): string | null => (typeof body.error?.details?.[member] === 'string' ? (body.error.details[member] as string) : null);
    return [response.statusCode, body.error?.code ?? body.state ?? null, detail('reason'), detail('cause')];
  }
  /** Everything the capture session, the notices and the engine have queued is done and written. */
  async function settled(host: EngineApp): Promise<void> {
    for (let round = 0; round < 6; round += 1) {
      await flush();
      await new Promise((resolve) => setImmediate(resolve));
      await sessionCapture(host.app).idle();
    }
    await captureNotices(host.app).idle();
    await host.engine.idle();
    await host.app.pipeline.drain();
  }

  interface Attempt {
    readonly sessionId: string;
    /** The start from CREATE: the pre-check run. */
    readonly first: Answer;
    /** The slots whose pre-check item says "source not assigned", and the status of those items. */
    readonly notAssigned: readonly string[];
    readonly blocked: readonly string[];
    readonly outcome: string | null;
    /** The start after the pre-check ended, with the warnings acknowledged. */
    readonly second: Answer;
    readonly state: string | undefined;
    readonly sourceRows: readonly string[];
    readonly workers: number | null;
    readonly started: number;
  }

  /** ONE session, as far as the product lets an operator take it. */
  async function attemptStart(core: Core, operation: Operation, caseNumber: string): Promise<Attempt> {
    const { host, owner } = core;
    const investigator = await signIn(host, 'INVESTIGATOR', passwordOf(operation));
    // The pre-check item CORE needs the tablet link (the engine's own door, as the session tests use it).
    await host.engine.setTabletLink('CONNECTED');
    const created = await post(host, investigator, SESSION_URL, { caseNumber, subjectType: 'SAKSI', subjectName: 'Test Subject', investigatorId: investigator.operatorId, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
    expect(created.statusCode, created.body).toBe(201);
    const sessionId = host.engine.slice('session')?.id;
    if (sessionId === undefined) throw new Error('no session is open after the create');
    const first = answerOf(await post(host, investigator, on(sessionId, 'start')));
    await host.drive(6_000);
    await settled(host);
    const precheck = host.engine.slice('session')?.precheck ?? null;
    const items = precheck?.items ?? [];
    const second = answerOf(await post(host, investigator, on(sessionId, 'start'), { acknowledgeWarnings: true }));
    await settled(host);
    return {
      sessionId,
      first,
      notAssigned: items.flatMap((item) => {
        const slot = unassignedSlotOfPrecheckItem(item);
        return slot === null ? [] : [`${slot} ${item.status}`];
      }),
      blocked: items.filter((item) => item.status === 'BLOCK').map((item) => item.id),
      outcome: precheck?.outcome ?? null,
      second,
      state: host.engine.slice('session')?.state,
      sourceRows: await sourceRowsOf(owner, sessionId),
      workers: core.fake === null ? null : core.fake.calls(),
      started: Number((await owner.query("SELECT count(*)::int AS n FROM public.audit_log WHERE type = 'RECORDING_STARTED' AND session_id = $1", [sessionId])).rows[0]?.n ?? -1),
    };
  }

  const BOOTS = 'BOOTS';
  const NO_FLAG = 'DEV_SOURCE_WITHOUT_FLAG';
  const WITH_FLAG = 'DEV_FLAG_WITH_PRODUCTION_SOURCE';
  /** What a start is answered. `null`: the Core did not start, there is nobody to ask. */
  const ACCEPTED = [200, 'RECORDING'] as const;
  const BLOCKED = [409, 'PRECHECK_BLOCKED'] as const;
  const NOT_RECORDABLE = [409, 'INVALID_STATE', 'SOURCE_KIND_NOT_RECORDABLE', 'NO_ADAPTER'] as const;

  interface State {
    readonly category: Category;
    readonly operation: Operation;
    /** `BOOTS`, or the refusal code of the fence with the registry ids it names. */
    readonly boot: string;
    readonly named: readonly string[];
    readonly start: readonly (number | string)[] | null;
    /** The `session_capture_sources` rows of the session, and how often a worker was started (null in SIMULATED: it has none). */
    readonly sourceRows: readonly string[];
    readonly workers: number | null;
  }
  const state = (category: Category, operation: Operation, boot: string, named: readonly string[] = [], start: State['start'] = null, sourceRows: readonly string[] = [], workers: number | null = null): State => ({ category, operation, boot, named, start, sourceRows, workers });
  const FOUR_FAKE = ['MIC-PRIMARY MIC-01 FAKE', 'MIC-STANDBY MIC-02 FAKE', 'VIDEO-01 CAM-01 FAKE', 'VIDEO-02 CAM-02 FAKE'];

  /** THE TABLE: 7 categories x 3 operations = 21 states, in the order of addendum 1.5. */
  const TABLE: readonly State[] = [
    state('1', 'REAL_PRODUCTION', BOOTS, [], BLOCKED, [], 0),
    state('1', 'REAL_DEVELOPMENT', BOOTS, [], BLOCKED, [], 0),
    state('1', 'SIMULATED', BOOTS, [], ACCEPTED),
    state('2', 'REAL_PRODUCTION', NO_FLAG, ['CAM-02', 'MIC-01']),
    state('2', 'REAL_DEVELOPMENT', BOOTS, [], BLOCKED, [], 0),
    state('2', 'SIMULATED', BOOTS, [], ACCEPTED),
    state('3', 'REAL_PRODUCTION', BOOTS, [], BLOCKED, [], 0),
    state('3', 'REAL_DEVELOPMENT', WITH_FLAG, ['CAM-11', 'MIC-12']),
    state('3', 'SIMULATED', BOOTS, [], ACCEPTED),
    state('4', 'REAL_PRODUCTION', NO_FLAG, ['CAM-01']),
    state('4', 'REAL_DEVELOPMENT', WITH_FLAG, ['CAM-12', 'MIC-11']),
    state('4', 'SIMULATED', BOOTS, [], ACCEPTED),
    state('5', 'REAL_PRODUCTION', NO_FLAG, ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02']),
    state('5', 'REAL_DEVELOPMENT', BOOTS, [], ACCEPTED, FOUR_FAKE, 1),
    state('5', 'SIMULATED', BOOTS, [], ACCEPTED),
    state('6', 'REAL_PRODUCTION', BOOTS, [], NOT_RECORDABLE, [], 0),
    state('6', 'REAL_DEVELOPMENT', WITH_FLAG, ['CAM-11', 'CAM-12', 'MIC-11', 'MIC-12']),
    state('6', 'SIMULATED', BOOTS, [], ACCEPTED),
    state('7', 'REAL_PRODUCTION', NO_FLAG, ['CAM-01', 'MIC-02']),
    state('7', 'REAL_DEVELOPMENT', WITH_FLAG, ['CAM-12', 'MIC-11']),
    state('7', 'SIMULATED', BOOTS, [], ACCEPTED),
  ];
  /** State S-5 where its Core starts: beside the 21, not counted with them. */
  const S5: readonly State[] = [state('2 (S-5)', 'REAL_DEVELOPMENT', BOOTS, [], BLOCKED, [], 0), state('3 (S-5)', 'REAL_PRODUCTION', BOOTS, [], BLOCKED, [], 0)];

  const SHORT: Readonly<Record<Operation, string>> = { SIMULATED: 'sim', REAL_DEVELOPMENT: 'dev', REAL_PRODUCTION: 'prod' };
  /** What every state was seen to do, for the record of the row (printed once, after the block). */
  const seen: string[] = [];
  afterAll(() => {
    if (seen.length > 0) console.info(`[row33] the states as observed on PostgreSQL:\n${seen.join('\n')}`);
  });

  /** A clone that holds the selector of a category, prepared by the owner as the header says. */
  async function cloneOf(category: Category, operation: Operation): Promise<Clone> {
    const target = await clone(`r33-${category.replace(/[^0-9a-z]+/gi, '').toLowerCase()}-${SHORT[operation]}`);
    const owner = target.ownerPool();
    await addProductionRows(owner);
    await storeSelector(owner, CATEGORY[category].lines);
    if (operation === 'REAL_PRODUCTION') await ownCredentials(owner);
    return target;
  }

  async function run(of: State): Promise<void> {
    const { lines } = CATEGORY[of.category];
    const label = `${of.category} x ${of.operation}`;
    const target = await cloneOf(of.category, of.operation);
    const owner = target.ownerPool();
    const core = await coreOn(target, of.operation);
    try {
      if (core.failure !== null || of.boot !== BOOTS) {
        const cause = core.failure?.cause;
        seen.push(`${label} | boot refused at ${String(core.failure?.stepId)} ${cause instanceof CaptureFenceError ? `${cause.code} [${cause.deviceIds.join(', ')}]` : String(cause)}`);
        // The fence, by its step and its code, naming the assigned sources of the wrong class - and nothing else.
        expect(core.failure?.stepId, label).toBe(CAPTURE_FENCE_BOOT_STEP);
        expect(cause, label).toBeInstanceOf(CaptureFenceError);
        expect([(cause as CaptureFenceError).code, (cause as CaptureFenceError).deviceIds], label).toEqual([of.boot, of.named]);
        expect(core.steps, label).not.toContain(CAPTURE_FENCE_BOOT_STEP);
        // A refused boot writes nothing: no boot row, no source row, and the stored selector is as the clone held it.
        expect(await bootAuditsOf(owner), label).toEqual([]);
        expect(await sourceRowsOf(owner), label).toEqual([]);
        expect(await storedSlots(owner), label).toEqual(SLOT_ORDER.map((slot) => lines[slot]));
        return;
      }
      // THE BOOT PASSES: the fence by name, the module's load by name (AD-04 (3)), the engine rehydration; ONE boot row in a real operation.
      expect(core.steps, label).toEqual(expect.arrayContaining(of.operation === 'SIMULATED' ? ['capture.config', 'engine.rehydrate'] : [CAPTURE_FENCE_BOOT_STEP, 'capture.boot', 'capture.config', 'engine.rehydrate']));
      expect(await bootAuditsOf(owner), label).toEqual(of.operation === 'SIMULATED' ? [] : [{ captureOperation: of.operation }]);
      // The selector the Core holds is the stored one: a line per assigned slot and none for an empty one.
      expect(linesOf(core.host.engine.slice('captureConfig')), label).toEqual(heldOf(lines));

      const attempt = await attemptStart(core, of.operation, `LP/2026/1013-${String(3300 + seen.length).padStart(4, '0')}`);
      seen.push(
        `${label} | boots | start from CREATE ${attempt.first.slice(0, 2).join(' ')} | pre-check ${String(attempt.outcome)}, BLOCK [${attempt.blocked.join(', ')}], not assigned [${attempt.notAssigned.join(', ')}] | start ${attempt.second.filter((part) => part !== null).join(' ')} | session ${String(attempt.state)} | source rows ${attempt.sourceRows.length} | workers ${String(attempt.workers)}`,
      );
      // From CREATE a start is the pre-check run, in every operation.
      expect(attempt.first.slice(0, 2), label).toEqual([202, 'PRECHECK']);
      // "Source not assigned": one BLOCK item per unassigned slot in real capture (C18 (1), C25: the STANDBY too); none in SIMULATED (C21 (6)).
      expect(attempt.notAssigned, label).toEqual(of.operation === 'SIMULATED' ? [] : unassignedOf(lines).map((slot) => `${slot} BLOCK`));
      if (of.start === null) throw new Error(`${label}: the table states no start for a Core that boots`);
      expect(attempt.second.slice(0, of.start.length), label).toEqual([...of.start]);
      const accepted = of.start[0] === 200;
      expect(attempt.state, label).toBe(accepted ? 'RECORDING' : of.start[1] === 'PRECHECK_BLOCKED' ? 'PRECHECK' : 'ARMED');
      // A refused start is no start: no `RECORDING_STARTED` row, no source row, no worker.
      expect(attempt.started, label).toBe(accepted ? 1 : 0);
      expect(attempt.sourceRows, label).toEqual([...of.sourceRows]);
      expect(attempt.workers, label).toBe(of.workers);
      // In SIMULATED the Core holds no registry and no adapter: whatever the selector names, nothing real can be opened.
      if (of.operation === 'SIMULATED') expect(captureFenceControl(core.host.app).registry(), label).toBeNull();
    } finally {
      await core.host.app.close();
    }
  }

  it('the table is the whole enumeration: 7 categories x 3 operations = 21 states, each once; 13 Cores start and 8 are refused', () => {
    expect(TABLE).toHaveLength(21);
    expect(new Set(TABLE.map((of) => `${of.category} ${of.operation}`)).size).toBe(21);
    for (const category of ['1', '2', '3', '4', '5', '6', '7'] as const) expect(TABLE.filter((of) => of.category === category).map((of) => of.operation)).toEqual(['REAL_PRODUCTION', 'REAL_DEVELOPMENT', 'SIMULATED']);
    expect([TABLE.filter((of) => of.boot === BOOTS).length, TABLE.filter((of) => of.boot === NO_FLAG).length, TABLE.filter((of) => of.boot === WITH_FLAG).length]).toEqual([13, 4, 4]);
    // No recording without sources: the only real state the table lets a session start in is the complete development selector in REAL_DEVELOPMENT.
    expect(TABLE.filter((of) => of.operation !== 'SIMULATED' && of.start?.[0] === 200).map((of) => `${of.category} ${of.operation}`)).toEqual(['5 REAL_DEVELOPMENT']);
  });

  it.each(TABLE.map((of) => [`${of.category}. ${CATEGORY[of.category].title}`, of.operation, of.boot === BOOTS ? `boots; a start answers ${(of.start ?? []).join(' ')}` : `boot refused ${of.boot}`, of] as const))('%s x %s: %s', async (_category, _operation, _outcome, of) => {
    await run(of);
  });

  it.each(S5.map((of) => [CATEGORY[of.category].title, of.operation, of] as const))('state S-5 (AD-10 (4), C25) - %s x %s: the Core boots and the start is refused on the one unassigned STANDBY', async (_title, _operation, of) => {
    await run(of);
  });

  it('THE REMEDY IS EXECUTABLE (addendum 1.7; AD-04 (3)): seeded clone -> development boot -> operation 78 unassigns the four slots -> production boot passes the fence and the step `capture.config`, ONE boot row -> the assignment of a production device stops at the registry -> a session start answers 409', async () => {
    const target = await clone('r33-remedy');
    const owner = target.ownerPool();
    // The devices a commissioning would leave (see the header): stored, assigned to nothing.
    await addProductionRows(owner);

    // 0. THE STATE THE REMEDY IS FOR: the seeded selector assigns four development sources, so a production Core does not start.
    const refusedFirst = await coreOn(target, 'REAL_PRODUCTION');
    expect(refusedFirst.failure?.stepId).toBe(CAPTURE_FENCE_BOOT_STEP);
    const refusal = refusedFirst.failure?.cause;
    if (!(refusal instanceof CaptureFenceError)) throw new Error('the production boot of the seeded clone was not refused by the fence');
    expect(refusal.code).toBe(NO_FLAG);
    // The refusal's own text names the remedy this test then carries out.
    expect(refusal.message).toContain('start once with DEMS_CAPTURE_DEV_SOURCES=1, unassign them on the Devices page, then start without the flag');
    await refusedFirst.host.app.close();
    expect(await bootAuditsOf(owner)).toEqual([]);

    // 1. "Start once with the flag": the development boot passes.
    const development = await coreOn(target, 'REAL_DEVELOPMENT');
    expect(development.failure).toBeNull();
    expect(await bootAuditsOf(owner)).toEqual([{ captureOperation: 'REAL_DEVELOPMENT' }]);
    // 2. "Unassign them": operation 78, by the TECHNICIAN on the web console - the product's own operation, one audit row per slot.
    const technician = await signIn(development.host, 'TECHNICIAN', undefined);
    const cleared = await post(development.host, technician, SELECTOR_URL, { unassign: [...SLOT_ORDER] });
    expect(cleared.statusCode, cleared.body).toBe(200);
    await settled(development.host);
    expect(await storedSlots(owner)).toEqual([null, null, null, null]);
    expect((await owner.query("SELECT count(*)::int AS n FROM public.audit_log WHERE type = 'CAPTURE_CONFIG_CHANGED' AND details->>'operationId' = 'updateCaptureConfig' AND NOT (details ? 'to')")).rows[0]?.n).toBe(4);
    await development.host.app.close();

    // (Not an operation of the product in this test: every operator gets a credential of their own - step (b) of the addendum's
    // sequence, requirement X-2. The owner writes it; a production Core refuses the published demonstration password.)
    await ownCredentials(owner);

    // 3. "Then start without the flag": the production boot passes the FENCE and the step `capture.config`, each by name, with ONE boot row of its own.
    const production = await coreOn(target, 'REAL_PRODUCTION');
    try {
      expect(production.failure).toBeNull();
      expect(production.steps).toEqual(expect.arrayContaining([CAPTURE_FENCE_BOOT_STEP, 'capture.boot', 'capture.config', 'engine.rehydrate']));
      expect(await bootAuditsOf(owner)).toEqual([{ captureOperation: 'REAL_DEVELOPMENT' }, { captureOperation: 'REAL_PRODUCTION' }]);
      expect(linesOf(production.host.engine.slice('captureConfig'))).toEqual([]);

      // 4. "Assign production devices": operation 78 on the production Core. WHERE IT STOPS TODAY: the registry of REAL_PRODUCTION
      // serves no device (`buildProductionRegistry`: the production adapters are class-C stubs, none is registered), so a production
      // device is unknown to it and the assignment is refused 422 with nothing stored. The day the registry serves `CAM-11` the same
      // call is the last step of the remedy; the expectation follows the registry's own list, not a date.
      const served = (captureFenceControl(production.host.app).registry()?.list() ?? []).map((entry) => entry.id);
      const own = await signIn(production.host, 'TECHNICIAN', OWN_PASSWORD);
      const camera = await post(production.host, own, SELECTOR_URL, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-11', profile: PROFILE }] });
      const microphone = await post(production.host, own, SELECTOR_URL, { mics: [{ inputId: 'MIC-11', deviceId: 'MIC-11', role: 'PRIMARY' }] });
      // A development source stays refused for a production Core, whatever the registry serves.
      const fake = await post(production.host, own, SELECTOR_URL, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: PROFILE }] });
      await settled(production.host);
      seen.push(`the remedy | production registry serves [${served.join(', ')}] | assign CAM-11 ${answerOf(camera).filter((part) => part !== null).join(' ')} | assign MIC-11 ${answerOf(microphone).filter((part) => part !== null).join(' ')} | assign CAM-01 ${answerOf(fake).filter((part) => part !== null).join(' ')}`);
      expect(answerOf(fake).slice(0, 2)).toEqual([422, 'INVALID_INPUT']);
      if (!served.includes('CAM-11')) {
        expect(answerOf(camera).slice(0, 2)).toEqual([422, 'INVALID_INPUT']);
        expect(await storedSlots(owner)).toEqual(served.includes('MIC-11') ? [null, null, 'MIC-11', null] : [null, null, null, null]);
      } else expect(camera.statusCode, camera.body).toBe(200);
      if (!served.includes('MIC-11')) expect(answerOf(microphone).slice(0, 2)).toEqual([422, 'INVALID_INPUT']);
      else expect(microphone.statusCode, microphone.body).toBe(200);

      // 5. A session start answers 409 (the selector is not complete), with no source row and no worker.
      const attempt = await attemptStart(production, 'REAL_PRODUCTION', 'LP/2026/1013-3390');
      seen.push(`the remedy | start ${attempt.second.filter((part) => part !== null).join(' ')} | not assigned [${attempt.notAssigned.join(', ')}] | source rows ${attempt.sourceRows.length} | workers ${String(attempt.workers)}`);
      expect(attempt.second[0]).toBe(409);
      if (served.length === 0) {
        expect(attempt.second.slice(0, 2)).toEqual([...BLOCKED]);
        expect(attempt.notAssigned).toEqual(SLOT_ORDER.map((slot) => `${slot} BLOCK`));
      }
      expect([attempt.started, attempt.sourceRows, attempt.workers]).toEqual([0, [], 0]);
      expect(await sourceRowsOf(owner)).toEqual([]);
    } finally {
      await production.host.app.close();
    }
  });

  it('NO PATH RECORDS WITH A SLOT MISSING (the question of row 158): a session ARMED on the complete selector, the STANDBY slot emptied behind the Core, a restart - the open session is FAULT and its start is refused 409 in REAL_DEVELOPMENT and, with all four emptied, in REAL_PRODUCTION; no row, no worker', async () => {
    // Through the product a slot cannot leave an open session: the session holds the lock from its creation (row 158, cases 2, 5, 6),
    // and a session OPENED on a selector that already lacks a slot stops at the pre-check (the table above). What is left is a change
    // of the stored row behind the Core, which reaches the engine at a restart. That is the state this case builds.
    //
    // OBSERVED, and held below: a process start takes the open session to FAULT, so the armed session never meets the emptied
    // selector as an ARMED one. The start rule of the shared session machine (`CAPTURE_SOURCE_NOT_ASSIGNED`, row 163) is therefore
    // NOT REACHED at a booted Core by any path this file could build - product or restart; it stays a line behind the pre-check
    // and the lock, held where it is defined (`packages/shared/test/sim-capture-start.test.ts`), and behind it stand the plan
    // builder and the builder of the rows (`fence.test.ts`, block "task 4 row 33").
    const target = await clone('r33-armed');
    const owner = target.ownerPool();
    const first = await coreOn(target, 'REAL_DEVELOPMENT');
    expect(first.failure).toBeNull();
    const investigator = await signIn(first.host, 'INVESTIGATOR', undefined);
    await first.host.engine.setTabletLink('CONNECTED');
    const created = await post(first.host, investigator, SESSION_URL, { caseNumber: 'LP/2026/1013-3391', subjectType: 'SAKSI', subjectName: 'Test Subject', investigatorId: investigator.operatorId, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
    expect(created.statusCode, created.body).toBe(201);
    const sessionId = first.host.engine.slice('session')?.id ?? '';
    expect(answerOf(await post(first.host, investigator, on(sessionId, 'start'))).slice(0, 2)).toEqual([202, 'PRECHECK']);
    await first.host.drive(6_000);
    await settled(first.host);
    if (first.host.engine.slice('session')?.state === 'PRECHECK') expect((await post(first.host, investigator, on(sessionId, 'precheck/acknowledge'))).statusCode).toBeLessThan(300);
    await settled(first.host);
    expect(first.host.engine.slice('session')?.state).toBe('ARMED');
    // The lock holds for the product: the operator cannot clear the slot now.
    const technician = await signIn(first.host, 'TECHNICIAN', undefined);
    expect(answerOf(await post(first.host, technician, SELECTOR_URL, { unassign: ['STANDBY'] })).slice(0, 2)).toEqual([409, 'CAPTURE_CONFIG_LOCKED']);
    await settled(first.host);
    await first.host.app.close();

    // BEHIND THE CORE: the owner empties the STANDBY slot of the stored row.
    await owner.query('UPDATE public.capture_config SET mic_standby_id = NULL');
    const second = await coreOn(target, 'REAL_DEVELOPMENT', FIXED_NOW + 300_000);
    try {
      expect(second.failure).toBeNull();
      expect(linesOf(second.host.engine.slice('captureConfig'))).toEqual(['PRIMARY MIC-01', 'VIDEO-01 CAM-01', 'VIDEO-02 CAM-02']);
      const state = second.host.engine.slice('session')?.state;
      const again = await signIn(second.host, 'INVESTIGATOR', undefined);
      await second.host.engine.setTabletLink('CONNECTED');
      const answer = answerOf(await post(second.host, again, on(sessionId, 'start'), { acknowledgeWarnings: true }));
      await settled(second.host);
      seen.push(`armed, STANDBY emptied behind the Core, REAL_DEVELOPMENT restart | session ${String(state)} | start ${answer.filter((part) => part !== null).join(' ')} | source rows ${(await sourceRowsOf(owner)).length} | workers ${String(second.fake?.calls())}`);
      expect(state).toBe('FAULT');
      expect(answer.slice(0, 2)).toEqual([409, 'INVALID_STATE']);
      expect(second.host.engine.slice('session')?.state).toBe('FAULT');
      expect([await sourceRowsOf(owner), second.fake?.calls()]).toEqual([[], 0]);
      expect(Number((await owner.query("SELECT count(*)::int AS n FROM public.audit_log WHERE type = 'RECORDING_STARTED' AND session_id = $1", [sessionId])).rows[0]?.n)).toBe(0);
    } finally {
      await second.host.app.close();
    }

    // The same session under a PRODUCTION boot of the emptied selector (the remedy carried out while a session is armed).
    await owner.query('UPDATE public.capture_config SET video_01_device_id = NULL, video_01_profile = NULL, video_02_device_id = NULL, video_02_profile = NULL, mic_primary_id = NULL, mic_standby_id = NULL');
    await ownCredentials(owner);
    const third = await coreOn(target, 'REAL_PRODUCTION', FIXED_NOW + 600_000);
    try {
      expect(third.failure).toBeNull();
      const state = third.host.engine.slice('session')?.state;
      const again = await signIn(third.host, 'INVESTIGATOR', OWN_PASSWORD);
      await third.host.engine.setTabletLink('CONNECTED');
      const answer = answerOf(await post(third.host, again, on(sessionId, 'start'), { acknowledgeWarnings: true }));
      await settled(third.host);
      seen.push(`armed, all four emptied behind the Core, REAL_PRODUCTION restart | session ${String(state)} | start ${answer.filter((part) => part !== null).join(' ')} | source rows ${(await sourceRowsOf(owner)).length} | workers ${String(third.fake?.calls())}`);
      // The fence passed (it reads the stored row: nothing is assigned) and the engine rehydrated the open session beside six NULLs.
      expect(third.steps).toEqual(expect.arrayContaining([CAPTURE_FENCE_BOOT_STEP, 'capture.config', 'engine.rehydrate']));
      expect(state).toBe('FAULT');
      expect(answer.slice(0, 2)).toEqual([409, 'INVALID_STATE']);
      expect([await sourceRowsOf(owner), third.fake?.calls()]).toEqual([[], 0]);
      expect(Number((await owner.query("SELECT count(*)::int AS n FROM public.audit_log WHERE type = 'RECORDING_STARTED' AND session_id = $1", [sessionId])).rows[0]?.n)).toBe(0);
    } finally {
      await third.host.app.close();
    }
  });
});
