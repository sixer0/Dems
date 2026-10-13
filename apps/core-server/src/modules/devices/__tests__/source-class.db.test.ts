// THE D131 PIN (controller decision D156; decisions D83, D91 ruling R-2 option A, D131): both
// clients draw the "Development source" badge from the `sourceClass` the Core sent and from nothing
// else. What makes that rule safe is the Core's: A CORE IN SIMULATED CAPTURE SENDS NO `sourceClass`
// (and no `adapter`) FOR ITS BUILT-IN DEVICES. Held here on PostgreSQL as `dems_app`, each case a
// whole boot of the real app factory on its own clone of the seed, read where a client reads it:
// the committed `captureDevices` / `captureConfig` slices and the four device reads (ops 44 to 47).
//
//   SIMULATED          no built-in device carries the member; no read holds the key at all
//   REAL_DEVELOPMENT   a LOCAL_DEVICE device carries `DEVELOPMENT` (the CONTROL: the same reader
//                      does find the member); the FAKE built-ins carry `FAKE` / `DEVELOPMENT` too
//                      since integration pass D11 (`source-facts.ts` hands the kinds of the
//                      registry to the engine's fact door after the boot; the mapping still
//                      gives a built-in id nothing, which is what keeps the first line true)
//   REAL_PRODUCTION    an added production device carries `PRODUCTION`; nothing reads DEVELOPMENT
//
// `sourceOpen` (C3 §2.6, PE-128-38): no device carries it after a boot, in any operation - nothing
// is open, and a simulated Core never says it.
//
// No device is opened, listed or asked for: the helper program of the development boot is
// `/bin/echo` (it prints no device list), the worker is row 61's stand-in script. The fixture
// directory under `.data/` is left in place: this file deletes nothing there.
import type { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { provideTestCaptureHost, testHostPrograms } from '../../../../test/support/capture-host';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { buildApp } from '../../../app';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { CAPTURE_BOOT_STEP, CaptureBootError } from '../../../capture/boot';
import { realBootFixture } from '../../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../../capture/fence';
import type { ConfigInput } from '../../../config';
import { hashPassword } from '../../identity/password-hash';
import { BootError } from '../../../plugins/readiness';
import { SOURCE_FACTS_BOOT_STEP, audioStatusOf, deviceHealthOf, deviceInventoryOf, videoStatusOf } from '../index';

const db = useTestDatabase({ template: 'seed' });
/** Task 4 row 228b: this suite's own synthetic installation (not a reserved id): its production boots are configured with it and its key names it. */
const INSTALLATION = 'DEMS-TEST-D131';
const fixture = realBootFixture('row140d131', INSTALLATION);
fixture.provisionKey();
afterAll(() => fixture.remove());
const BUILT_INS = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH'];
// Task 4 row 85 (C46): a production boot is held to its host - the two stand-in programs here, the explicit TEST host handed in before each boot.
const REAL = { captureMode: 'real', demoControls: false, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, installationDeviceId: INSTALLATION, ...testHostPrograms(fixture.programsDir) } as const;

async function booted(slug: string, overrides: Partial<ConfigInput>, prepare?: (owner: Pool) => Promise<unknown>) {
  const target = await db.another({ template: 'seed', slug });
  // No speech runtime on a test host (a real-capture boot resolves the stored selection first).
  await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
  await prepare?.(target.ownerPool());
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'info', ...overrides }), logStream: log.stream });
  target.onCleanup(() => app.close());
  await app.ready();
  provideTestCaptureHost(app);
  await app.readiness.boot();
  const state = app.engine.state();
  const marks = state.captureDevices.devices.map((device) => `${device.id} ${device.adapter ?? '-'} ${device.sourceClass ?? '-'}`);
  /** Pass D11: after a boot nothing is open, so no device of any operation carries `sourceOpen` (not even `false`). */
  expect(state.captureDevices.devices.filter((device) => 'sourceOpen' in device)).toEqual([]);
  /** Everything a client can read of the devices: the two capture slices and the four reads of this module. */
  const wire = JSON.stringify([state.captureDevices, state.captureConfig, deviceHealthOf(state, app.clock.now(), app.engine.meters()), audioStatusOf(state, app.clock.now(), app.engine.meters()), videoStatusOf(state), deviceInventoryOf(state)]);
  /** The boot steps that passed, in order. */
  const steps = log.lines().filter((line) => line['msg'] === 'boot step passed').map((line) => String(line['step']));
  return { app, state, marks, wire, steps, owner: target.ownerPool() };
}

const localRows = (owner: Pool): Promise<unknown> =>
  owner.query("INSERT INTO public.capture_devices (id, kind, transport, model, enabled, adapter_kind) VALUES ('CAM-03', 'CAMERA', 'AVFOUNDATION', 'MacBook Air Camera', true, 'LOCAL_DEVICE'), ('MIC-03', 'MIC', 'AVFOUNDATION', 'MacBook Air Microphone', true, 'LOCAL_DEVICE')");
/** What an adoption would leave: production cameras and microphones, assigned to all four slots. */
async function productionRows(owner: Pool): Promise<void> {
  await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('CAM-11', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP'), ('CAM-12', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP'), ('MIC-11', 'MIC', 'USB', true, 'USB_AUDIO'), ('MIC-12', 'MIC', 'USB', true, 'USB_AUDIO')");
  await owner.query("UPDATE public.capture_config SET video_01_device_id = 'CAM-11', video_02_device_id = 'CAM-12', mic_primary_id = 'MIC-11', mic_standby_id = 'MIC-12'");
}

/**
 * S99-01 (batch N; ruling D241): a `REAL_PRODUCTION` Core does not start while an operator still has the
 * published demo password of the seed. What a provisioned installation has instead: every stored hash set
 * replaced by one of a password of the operator's own, derived by the product's hasher. The password here
 * is built at run time and kept nowhere.
 */
async function ownCredentials(owner: Pool): Promise<void> {
  const operators = (await owner.query<{ operator_id: string }>('SELECT operator_id FROM public.operator_credentials ORDER BY operator_id')).rows;
  for (const { operator_id } of operators) {
    const record = await hashPassword(['own', operator_id, String(operators.length), 'x7Kq'].join('-'));
    await owner.query('UPDATE public.operator_credentials SET algorithm = $2, memory_kib = $3, passes = $4, parallelism = $5, salt = $6, hash = $7 WHERE operator_id = $1', [operator_id, record.algorithm, record.memoryKib, record.passes, record.parallelism, record.salt, record.hash]);
  }
}

/** The marks of the built-in devices of a development Core; null until that case ran. */
let developmentBuiltIns: string[] | null = null;

describe('D131: a Core in SIMULATED capture sends no source class for its built-in devices', () => {
  it('the seed, demo controls on and off: 0 built-in devices carry `sourceClass` or `adapter`, and no device read holds either key', async () => {
    for (const [slug, demoControls] of [['d131_sim_demo', true], ['d131_sim_plain', false]] as const) {
      const core = await booted(slug, { demoControls });
      expect(captureFenceControl(core.app).operation).toBe('SIMULATED');
      expect(core.marks).toEqual(BUILT_INS.map((id) => `${id} - -`));
      expect(core.wire).not.toMatch(/"sourceClass"|"adapter"|"sourceOpen"|DEVELOPMENT|LOCAL_DEVICE/);
      // Pass D11: a simulated Core has no boot step of the source facts at all (CONTROL of the development case below).
      expect(core.steps).not.toContain(SOURCE_FACTS_BOOT_STEP);
    }
  });

  it('SIMULATED with stored local and production rows (a database a real Core used before): the BUILT-INS still carry nothing; the stored kinds are told as stored, never invented', async () => {
    const core = await booted('d131_sim_stored', { demoControls: true }, async (owner) => {
      await localRows(owner);
      await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('CAM-11', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP')");
    });
    expect(captureFenceControl(core.app).operation).toBe('SIMULATED');
    expect(core.marks.filter((mark) => BUILT_INS.includes(mark.split(' ')[0] ?? ''))).toEqual(BUILT_INS.map((id) => `${id} - -`));
    // The selector of a simulated Core names built-in devices only: no line of it reads development.
    expect(JSON.stringify(core.state.captureConfig)).not.toMatch(/DEVELOPMENT|LOCAL_DEVICE/);
  });
});

describe('REAL_DEVELOPMENT: the development devices carry the class (the CONTROL of the pin above)', () => {
  it('CONTROL - this Mac\'s camera and microphone are listed with adapter LOCAL_DEVICE and class DEVELOPMENT: the reader of the pin does find the member', async () => {
    const core = await booted('d131_dev', { ...REAL, captureWorkerPath: fixture.worker('worker-d131-dev', 'capture-worker/0.4.0'), captureDevSources: true, captureHelperFfmpegPath: '/bin/echo' }, localRows);
    expect(captureFenceControl(core.app).operation).toBe('REAL_DEVELOPMENT');
    expect(core.marks.filter((mark) => mark.includes('-03'))).toEqual(['CAM-03 LOCAL_DEVICE DEVELOPMENT', 'MIC-03 LOCAL_DEVICE DEVELOPMENT']);
    expect(core.wire).toMatch(/"sourceClass":"DEVELOPMENT"/);
    expect(core.wire).not.toMatch(/"sourceClass":"PRODUCTION"/);
    developmentBuiltIns = core.marks.filter((mark) => /^(CAM|MIC)-0[12] /.test(mark));
    // Pass D11: the boot step that handed the kinds to the engine ran, after the fence's (which builds the registry).
    expect(core.steps).toContain(SOURCE_FACTS_BOOT_STEP);
    expect(core.steps.indexOf(SOURCE_FACTS_BOOT_STEP)).toBeGreaterThan(core.steps.indexOf('capture.fence'));
    // The switch is no source: it carries no class (the badge "Test source" is a camera's and a microphone's).
    expect(core.marks.filter((mark) => mark.startsWith('POE-'))).toEqual(['POE-SWITCH - -']);

    // The members are held by no row: a state the engine reads back INSIDE the process (a reset, a reload)
    // still carries them, because the host applies the list it last took. The stored rows did not change.
    const adapters = async (): Promise<unknown[]> => (await core.owner.query('SELECT id, adapter_kind FROM public.capture_devices ORDER BY id')).rows;
    const stored = await adapters();
    await core.app.engine.stop();
    await core.app.engine.reload();
    expect(core.app.engine.state().captureDevices.devices.map((device) => `${device.id} ${device.adapter ?? '-'} ${device.sourceClass ?? '-'}`)).toEqual(core.marks);
    expect(await adapters()).toEqual(stored);
  });

  // The four built-ins ARE the test sources of a development Core (kind FAKE, D74(2)) and are listed
  // so (ux §8f.1: the badge "Test source" is drawn only from a class the Core sent). The slice
  // mapping leaves every built-in id without the two members whatever the operation; the devices
  // module hands the engine the kind the registry holds (integration pass D11). `it.fails` until then.
  it('the four FAKE built-ins of a development Core carry adapter FAKE and class DEVELOPMENT', () => {
    // Read in the case above, on the booted development Core.
    expect(developmentBuiltIns).not.toBeNull();
    expect(developmentBuiltIns).toEqual(['CAM-01 FAKE DEVELOPMENT', 'CAM-02 FAKE DEVELOPMENT', 'MIC-01 FAKE DEVELOPMENT', 'MIC-02 FAKE DEVELOPMENT']);
  });
});

describe('REAL_PRODUCTION: a production device carries PRODUCTION or nothing; nothing reads DEVELOPMENT', () => {
  // Until fix F-M4 (finding R69-03) this case pinned the four FAKE built-ins as listed with no class.
  // They are development devices: a production Core lists none of them (decision D178). The switch stays.
  it('four assigned production devices: each listed with its adapter and class PRODUCTION; of the built-ins only the switch is listed, with no class; 0 development marks', async () => {
    const core = await booted('d131_prod', { ...REAL, captureWorkerPath: fixture.worker('worker-d131-prod', 'capture-worker/0.4.0') }, async (owner) => {
      await productionRows(owner);
      await ownCredentials(owner);
    });
    expect(captureFenceControl(core.app).operation).toBe('REAL_PRODUCTION');
    expect(core.marks.filter((mark) => /-1[12] /.test(mark))).toEqual(['CAM-11 ONVIF_RTSP PRODUCTION', 'CAM-12 ONVIF_RTSP PRODUCTION', 'MIC-11 USB_AUDIO PRODUCTION', 'MIC-12 USB_AUDIO PRODUCTION']);
    expect(core.marks.filter((mark) => BUILT_INS.includes(mark.split(' ')[0] ?? ''))).toEqual(['POE-SWITCH - -']);
    expect(core.wire).not.toMatch(/DEVELOPMENT|LOCAL_DEVICE/);
  });

  // Review row 69, finding R69-03 (decision D178): "in REAL_PRODUCTION operations 76 / 77 list 0
  // development devices" (C3 §2.6; ux §8f.3; R-11 AC-2; M4-LOCAL-SEL-1). A database that once booted
  // REAL_DEVELOPMENT holds this Mac's camera and microphone (`LOCAL_DEVICE`) and the four built-in
  // test sources (`FAKE`); unassigned, they do not refuse the production boot - and they are in no
  // list a client reads. The rows themselves stay: a development boot lists them again (the CONTROL
  // is the REAL_DEVELOPMENT case above, which reads the same rows with the same reader).
  it('R69-03: stored development devices (LOCAL_DEVICE and FAKE), unassigned, are in no list of a production Core; the rows stay stored', async () => {
    const core = await booted('r6903_prod', { ...REAL, captureWorkerPath: fixture.worker('worker-r6903-prod', 'capture-worker/0.4.0') }, async (owner) => {
      await localRows(owner);
      await productionRows(owner);
      await ownCredentials(owner);
    });
    expect(captureFenceControl(core.app).operation).toBe('REAL_PRODUCTION');
    // The device list (operation 77 answers the slice; the roster of both clients is drawn from it).
    expect(core.marks).toEqual(['CAM-11 ONVIF_RTSP PRODUCTION', 'CAM-12 ONVIF_RTSP PRODUCTION', 'MIC-11 USB_AUDIO PRODUCTION', 'MIC-12 USB_AUDIO PRODUCTION', 'POE-SWITCH - -']);
    expect(JSON.stringify(core.state.captureDevices)).not.toMatch(/CAM-0[123]|MIC-0[123]|MacBook/);
    expect(JSON.stringify(core.app.engine.slice('captureDevices'))).not.toMatch(/CAM-0[123]|MIC-0[123]|MacBook/);
    expect(core.wire).not.toMatch(/DEVELOPMENT|LOCAL_DEVICE|MacBook/);
    // Not probed, not registered by the boot: the production registry holds no adapter at all.
    expect(captureFenceControl(core.app).registry()?.list() ?? []).toEqual([]);
    // Nothing was deleted or rewritten: the seven development rows are stored as they were.
    const stored = (await core.owner.query("SELECT id, adapter_kind FROM public.capture_devices WHERE adapter_kind IN ('FAKE', 'LOCAL_DEVICE') ORDER BY id")).rows;
    expect(stored.map((row: { id: string; adapter_kind: string }) => `${row.id} ${row.adapter_kind}`)).toEqual(['CAM-01 FAKE', 'CAM-02 FAKE', 'CAM-03 LOCAL_DEVICE', 'MIC-01 FAKE', 'MIC-02 FAKE', 'MIC-03 LOCAL_DEVICE', 'POE-SWITCH FAKE']);
    // A reload inside the process reads the same list (the rule is applied at every rehydration).
    await core.app.engine.stop();
    await core.app.engine.reload();
    expect(core.app.engine.state().captureDevices.devices.map((device) => device.id)).toEqual(['CAM-11', 'CAM-12', 'MIC-11', 'MIC-12', 'POE-SWITCH']);
  });

  // Batch N (security review row 99, finding S99-01 HIGH; ruling D241), ON THE BOOTED PATH: the real app factory, the
  // real boot steps in their order, PostgreSQL as `dems_app`, the DEFAULT counter (the stored hash sets, verified by the
  // product's verifier). The two cases above are its CONTROL: the same Core on the same rows boots once every operator
  // has a credential of their own.
  it('S99-01: the same production Core on the SEED\'s operators does NOT boot - `capture.boot` refuses CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION with the count; the error log holds the code and no credential', async () => {
    const seeded = (await db.ownerPool().query<{ operators: number }>('SELECT count(*)::int AS operators FROM public.operator_credentials')).rows[0]?.operators ?? 0;
    expect(seeded).toBeGreaterThan(0);
    const failure = await booted('s9901_prod', { ...REAL, captureWorkerPath: fixture.worker('worker-s9901-prod', 'capture-worker/0.4.0') }, productionRows).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(BootError);
    expect((failure as BootError).stepId).toBe(CAPTURE_BOOT_STEP);
    const cause = (failure as BootError).cause;
    expect(cause).toBeInstanceOf(CaptureBootError);
    expect([(cause as CaptureBootError).code, (cause as CaptureBootError).reason]).toEqual(['CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION', `operators=${seeded}`]);
    const published: string = DEMO_OPERATOR_PASSWORD;
    expect((cause as CaptureBootError).message).not.toContain(published);
    // CONTROL of "REAL_PRODUCTION only": the same seed's operators under REAL_DEVELOPMENT boot (the development case above does).
  });

  it('R69-03 CONTROL - SIMULATED on the same rows lists every stored device, inert (D83 O-2)', async () => {
    const core = await booted('r6903_sim', { demoControls: false }, async (owner) => {
      await localRows(owner);
      await productionRows(owner);
      await owner.query("UPDATE public.capture_config SET video_01_device_id = 'CAM-01', video_02_device_id = 'CAM-02', mic_primary_id = 'MIC-01', mic_standby_id = 'MIC-02'");
    });
    expect(captureFenceControl(core.app).operation).toBe('SIMULATED');
    expect(core.state.captureDevices.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-11', 'CAM-12', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-11', 'MIC-12', 'POE-SWITCH']);
  });
});
