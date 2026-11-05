// THE FIRST FULL SESSION ON DOUBLES (task 4 blueprint row 89, M6 / WP-13c; GATE CONDITION AD-08 of the security
// addendum 04; decision C152: cautions C-2 of review 088b and C-8 of review 086).
//
// THREE BLOCKS:
//
//   1. C-2 (088b): THE FENCE DOOR `provideProductionParts` and its three refusals - any operation but REAL_PRODUCTION,
//      a second hand-over, a hand-over after the boot step ran - on the REAL app of a throw-away clone. No process is
//      started but the stand-in worker of the boot fixture. Runs in the database suite.
//   2. C-8 (086): THE ENTRY FILE `src/index.ts` STARTED BY A TEST, as a process of its own (`fork`, tsx). Two of its
//      imports are replaced AT RESOLUTION by test modules (`test/support/entry-start/`): the configuration loader - so
//      that the Core runs on a throw-away clone and a temporary data directory, never on the database its port names
//      (`databaseNameFor`: 4420 is `dems_demo`) and never with the repository's connection file - and the path of the
//      error log (a temporary file, not `apps/core-server/logs/`). EVERY STATEMENT OF THE ENTRY RUNS AS WRITTEN: the
//      composition with `process.platform`, the host facts of the process through `provideHost`, the boot steps, the
//      capture boot, the listen (port 0 of the test configuration: a port the system hands out), the shutdown on SIGTERM.
//   3. AD-08: THE FULL SESSION. `REAL_PRODUCTION`, the four production kinds (`ONVIF_RTSP` x2, `USB_AUDIO` x2) on a clone,
//      one camera HEVC; recorded by the BUILT worker, sealed and verified. The real boot checks are passed by real means:
//      a signing key without the development mark (`test/support/production-key.ts` over the boot fixture), the
//      operators' own passwords (written by the owner from a run-time value), NO injected check - and they are shown to
//      BITE on the same clone first (the seed's operators: refused; a development key: refused).
//
// HOW THE PLATFORM IS `linux` WITHOUT A SEAM IN `src/` (decisions C29, C60, C135: on darwin no production microphone has
// an opener, so a REAL_PRODUCTION session cannot start there). The platform word reaches the Core in exactly two
// places, both of them arguments the entry point hands in and a test may hand in through the same doors:
//   (a) `composeProductionCapture(ports, { platform: 'linux', ... })` - the composition's input, the same function the
//       entry's `composeProductionCaptureOf` calls; its parts reach the fence through its door `provideProductionParts`;
//   (b) the host facts of the boot checks, `captureBootControl(app).provideHost({ platform: 'linux', ... })` - the door
//       the entry uses (decision C46), with the Linux host double of `capture/boot/__tests__/host-support.ts` (a runner
//       that starts nothing and answers each question of the table as a prepared Linux host would).
// The ports of (a) are the entry composition's ports, written out below, with ONE difference that the security addendum
// prescribes (AD-02 (2): "the permissive rule the full-session test needs is a value defined under
// `apps/core-server/test/`, handed in through the builder's deps"): the stored-address rule of the camera bundle, of the
// camera watch and of the credential reader is `loopbackStoredCameraAddress` of `test/support/stored-camera-address.ts`
// (the doubles live on loopback, which the product's rule refuses). And the card listing of the parts is a CARD LISTING
// DOUBLE in the forms of a Linux host (`createCardEnumerator` over fixed texts): this Mac has no `/proc/asound`.
//
// THE DOUBLES (nothing real is opened, nothing leaves loopback):
//   - two ONVIF devices (`test/support/onvif-odd-device.ts`) on ports the system hands out; each answers
//     `GetStreamUri` only to a valid WS-UsernameToken of the test camera's synthetic account;
//   - two test cameras (`apps/capture-worker/test-fixtures/rtsp_test_camera.py`) on 8572 (HEVC) and 8573 (H.264)
//     (decision C33: 8565-8574; 8570 and 8571 are named by other files);
//   - the microphone helper: a STAND-IN for the Linux FFmpeg (`linux-mic-helper`, written into the fixture's programs
//     directory): it takes the helper's Linux arguments, ignores the ALSA input and writes a generated 440 Hz tone in the
//     transport's format into the session's pipe through this host's `ffmpeg` (with its progress lines); the pre-check
//     form (`-f null -`) ends at once with status 0;
//   - REAL: the built relay, the built guard and the built worker of `apps/capture-worker/build/` (not rebuilt here),
//     the production door, the credential store, the reader and its audit, the pipeline, the sealing host, the verifier.
//
// INGEST PORTS: the session's camera listeners are the product's constants `CAPTURE_INGEST_PORT` (127.0.0.1:8554 and
// 8556) - no other port can be used without a seam. They are the kill matrix's (wave-12 brief rule 2): this file runs
// ONLY under both locks, and refuses to start a session when anything listens on 8554, 8556, 4420-4423 or 5173-5178
// (the check of decision C123). DRIVER DECISION of row 89, see its record.
//
// A RUNNER CHECK, NOT A SUITE TEST for blocks 2 and 3: they start the worker, the relay, the guard, the test cameras and
// a Core process, so they run only when asked for, under the database lock and then the heavy-host lock, with a
// core-file limit of 0 (the production door refuses otherwise):
//
//   (ulimit -c 0; DEMS_FIRST_FULL_SESSION=1 /usr/bin/lockf -k -t 1800 .locks/db-migrate.lock /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
//     npx vitest run --root apps/core-server --project db --maxWorkers=2 src/modules/capture-config/__tests__/e2e/first-full-session.db.test.ts)
//
// AUDIT ROW W3G (2026-11-06; D146, F-W3TW3-T2). Block 3 assigns ALL EIGHT slots (D61): four ONVIF doubles CAM-11..14
// (CAM-11 HEVC, the rest H.264; test cameras on 8572, 8573, 8574 and a port the system hands out) and the four inputs of
// a four-input card double MIC-11..14. With slots 3/4 unassigned the pre-check of a Core in its own capture ends in BLOCK
// (LENS_3, LENS_4, MIC_3, MIC_4 "source not assigned"; D62/R90-D2, D124 R147-3) and its acknowledge is 409 NO_WARNINGS -
// reproduced on the simulator for that exact selector (record implementation/w3g_gated_e2e.md). The source rows name the
// numbered channels; the recording has eight fragment tracks (D5: AUDIO-0N), and the manifest is /2.1.
//
// MUTANTS (each must turn this file RED; none is a configuration of the product): `DEMS_ROW89_MUTANT=reveal` - the
// camera reader handed in reads the credential once more per open (a third and a fourth reveal carry the session);
// `DEMS_ROW89_MUTANT=h264` - the HEVC test camera sends H.264. The mutant "a boot-check seam injected" is a temporary
// edit of `src/capture/index.ts` (the mount), never committed.
//
// HYGIENE (AD-08 (4)): never against `dems_demo` (asserted); every key, data directory, sealed package and credential
// store is below the OS's temporary root and REMOVED when the block ends (asserted: they do not exist after); the
// runtime credential of the clone reaches the entry process over its IPC channel only, never a file, an argument or an
// environment variable; no process of this file is left running (asserted).
import { execFileSync, fork, spawn, type ChildProcess, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { OPERATORS, type AuditRow } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { ingestReachOfThisProcess, openFailuresOf } from '../../../../../test/support/capture-open-causes';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../../test/support/config';
import { readTrail } from '../../../../../test/support/core';
import { WEB_ORIGIN, cookieValue, webSignIn } from '../../../../../test/support/identity';
import { createOddOnvifDevice, dateAnswer, freeOddDevicePort, notAuthorizedFault, servicesAnswer, streamAnswer, tokenHolds, type OddOnvifDevice } from '../../../../../test/support/onvif-odd-device';
import { makeProductionTestKey, type ProductionTestKey } from '../../../../../test/support/production-key';
import { loopbackStoredCameraAddress } from '../../../../../test/support/stored-camera-address';
import { buildApp } from '../../../../app';
import { CapturePhase, createSystemTimers } from '../../../../capture';
import { CaptureAdapterRefusal } from '../../../../capture/adapters';
import { createCardEnumerator, type CardEnumerator, type CardListingSource } from '../../../../capture/adapters/audio/card-listing';
import { captureBootControl, type CaptureBootHostFacts } from '../../../../capture/boot';
import { FIXTURE_NOW, realBootFixture, type RealBootFixture } from '../../../../capture/boot/__tests__/support';
import { fakeProductionHost } from '../../../../capture/boot/__tests__/host-support';
import { HOST_COMMAND_CHECKS, CaptureHostRefusal, type HostCommand } from '../../../../capture/boot/host-checks';
import { INTERFACE_FILE_COMMAND, PROGRAM_OWNERSHIP_CHECKS } from '../../../../capture/boot/program-checks';
import { captureFenceControl, type ProductionCaptureParts } from '../../../../capture/fence';
import { composeProductionCapture, type ProductionCapturePorts } from '../../../../capture-composition';
import { sessionCapture, type SessionCaptureEvent } from '../../../../capture-session';
import type { ConfigInput } from '../../../../config';
import { coreCredentialStore } from '../../../../credential-store';
import { sessionPackageDir } from '../../../../evidence-verify';
import { BootError } from '../../../../plugins/readiness';
import { provisionDevelopmentSigningKey } from '../../../../sealing';
import { adoptedCameraTestControl, captureConnectControl } from '../../../capture-discovery';
import { INSERT_CAPTURE_CREDENTIAL } from '../../../capture-discovery/connect';
import { captureAudioCardsControl } from '../../../capture-inputs';
import { hashPassword } from '../../../identity/password-hash';
import { wireCaptureCredentialHolders, type CaptureCredentialHolders } from '../../credential-holders';

const ASKED = process.env.DEMS_FIRST_FULL_SESSION === '1';
/** A mutant of this file's own inputs (see the header). Unset: the gate run. */
const MUTANT = process.env.DEMS_ROW89_MUTANT ?? null;
const REPOSITORY = resolve(import.meta.dirname, '../../../../../../..');
const WORKSPACE = resolve(REPOSITORY, 'apps/core-server');
const BUILD = resolve(REPOSITORY, 'apps/capture-worker/build');
const WORKER = join(BUILD, 'capture-worker');
const RELAY = join(BUILD, 'capture-relay');
const GUARD = join(BUILD, 'capture-guard');
const CAMERA_SCRIPT = resolve(REPOSITORY, 'apps/capture-worker/test-fixtures/rtsp_test_camera.py');
const ENTRY = join(WORKSPACE, 'src/index.ts');
const ENTRY_HOOKS = join(WORKSPACE, 'test/support/entry-start/register.mjs');
const HOST = '127.0.0.1';
/**
 * C33: test cameras bind 8565-8574; 8570 (`camera-adapter-open`) and 8571 (`adopted-camera-test`) are named elsewhere.
 * Audit row W3G (D146, F-W3TW3-T2): a session needs all EIGHT slots since D61 (the pre-check BLOCKS an unassigned slot,
 * D62/R90-D2), so four production cameras: CAM-13 takes 8574, the last free port of the range (8565-8569 are named by
 * `stream-test`, `minted-code` and `adopted-camera-test`), and CAM-14 a port the system hands out (`--port 0`; the
 * camera's ready line names it, and the locator is built from that line).
 */
const CAMERA_PORTS = { 'CAM-11': 8572, 'CAM-12': 8573, 'CAM-13': 8574, 'CAM-14': 0 } as const;
/** The four production cameras and the four inputs of the card (row W3G, D61: four pairs). CAM-11 is the HEVC camera. */
const PRODUCTION_CAMERAS = ['CAM-11', 'CAM-12', 'CAM-13', 'CAM-14'] as const;
type ProductionCamera = (typeof PRODUCTION_CAMERAS)[number];
const PRODUCTION_MICS = ['MIC-11', 'MIC-12', 'MIC-13', 'MIC-14'] as const;
/** Ports that must be free inside the locks before a session starts (decision C123): the ingest constants (D60: 8560 and 8562 for VIDEO-03/04), the Core lanes, the consoles. */
const MUST_BE_FREE = [8554, 8556, 8560, 8562, 4420, 4421, 4422, 4423, 5173, 5174, 5175, 5176, 5177, 5178];
/** Synthetic installation ids of this file: not reserved, so a production Core takes them (row 228b). */
const INSTALLATION = 'DEMS-ROW89-01';
const ENTRY_INSTALLATION = 'DEMS-ROW89-02';
const SCHEME = ['rt', 'sp'].join('');
const RECORD_SECONDS = 8;

/** The test camera's one synthetic account, read from its own file (its rule: tests do not repeat it). */
const cameraSource = readFileSync(CAMERA_SCRIPT, 'utf8');
const constantOf = (name: string): string => new RegExp(`^${name} = "([^"]+)"$`, 'm').exec(cameraSource)?.[1] ?? '';
const ACCOUNT = { username: constantOf('ACCOUNT_USER'), secret: constantOf('ACCOUNT_PASSWORD') } as const;

/** The operators' own password of the production clones (a production Core refuses the published demonstration one, D241). Built at run time, kept nowhere. */
const OWN_PASSWORD = ['own', 'row89', String(process.pid), 'Qe7v'].join('-');

const db = useTestDatabase({ template: 'seed', slug: 'row89' });
type Clone = Awaited<ReturnType<typeof db.another>>;

// ── Small helpers ────────────────────────────────────────────────────────────────────────────
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
async function until<Value>(what: string, limitMs: number, read: () => Promise<Value | null> | Value | null, diagnose: () => unknown = () => null): Promise<Value> {
  for (const started = Date.now(); Date.now() - started < limitMs; ) {
    const value = await read();
    if (value !== null) return value;
    await sleep(250);
  }
  throw new Error(`not reached within ${limitMs} ms: ${what} ${JSON.stringify(diagnose())}`);
}
/** The command lines of the processes that hold `text` (process id removed, the repository shown as `.`). */
function commandLinesWith(text: string): string[] {
  try {
    return execFileSync('/usr/bin/pgrep', ['-fl', text], { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.replace(/^\d+\s+/, '').replaceAll(REPOSITORY, '.').trim())
      .filter((line) => line !== '' && !line.includes('pgrep'));
  } catch {
    return [];
  }
}
/** True when something already listens on `port` of loopback: a bind of our own fails. The probe is closed at once. */
const listened = (port: number): Promise<boolean> =>
  new Promise((done) => {
    const probe = createServer();
    probe.once('error', () => done(true));
    probe.listen({ host: HOST, port, exclusive: true }, () => probe.close(() => done(false)));
  });
const codeOf = (error: unknown): unknown => (error as { code?: unknown } | null)?.code;

/** The operators of a clone get a password of their own (the product's hasher, a run-time value). */
async function ownCredentials(owner: Pool): Promise<void> {
  const record = await hashPassword(OWN_PASSWORD);
  await owner.query('UPDATE public.operator_credentials SET algorithm = $1, memory_kib = $2, passes = $3, parallelism = $4, salt = $5, hash = $6', [record.algorithm, record.memoryKib, record.passes, record.parallelism, record.salt, record.hash]);
}
const lastBootRow = async (owner: Pool): Promise<Record<string, unknown>> =>
  ((await owner.query<{ details: Record<string, unknown> }>("SELECT details FROM public.audit_log WHERE type = 'SYSTEM_BOOT' ORDER BY seq DESC LIMIT 1")).rows[0]?.details ?? {}) as Record<string, unknown>;

/** The configuration of a production Core of this file on `target`, with the fixture's directories. */
function productionConfig(target: Clone, fixture: RealBootFixture, programs: Partial<ConfigInput>): Partial<ConfigInput> {
  return {
    database: target.runtime,
    dataDir: fixture.dataDir,
    mediaStoreDir: fixture.mediaStoreDir,
    logLevel: 'info',
    captureMode: 'real',
    demoControls: false,
    captureDevSources: false,
    installationDeviceId: fixture.installationId,
    installationName: 'Row 89 test installation',
    ...programs,
  };
}

/** The two stand-in programs of the boot fixture (a relay and a guard that exit 10 at once), for the cases that start no session. */
function standInPrograms(directory: string): { readonly captureRelayPath: string; readonly captureGuardPath: string } {
  const write = (name: string): string => {
    const path = `${directory}/${name}`;
    writeFileSync(path, '#!/bin/sh\nexit 10\n', { mode: 0o700 });
    chmodSync(path, 0o700);
    return path;
  };
  return { captureRelayPath: write('row89-relay-stand-in'), captureGuardPath: write('row89-guard-stand-in') };
}

/** A parts object the door only stores (it is never built in block 1). */
const PARTS_DOUBLE = Object.freeze({ platform: 'linux' }) as unknown as ProductionCaptureParts;

// ── 1. C-2 of review 088b: the door's three refusals ───────────────────────────────────────────
describe('row 89 / C-2 of 088b: the fence door `provideProductionParts` - REAL_PRODUCTION only, once, before the boot step', () => {
  const fixture = realBootFixture('row89-door', 'DEMS-ROW89-03');
  fixture.provisionKey();
  afterAll(() => fixture.remove());

  async function appOn(slug: string, overrides: Partial<ConfigInput>): Promise<{ readonly app: FastifyInstance; readonly target: Clone; readonly log: CapturedLog }> {
    const target = await db.another({ template: 'seed', slug });
    // No speech runtime on a test host: STT is off in THIS throw-away clone (as the session rows do).
    await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ database: target.runtime, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, logLevel: 'info', ...overrides }), logStream: log.stream, errorLogFile: `${fixture.dataDir}/error.log` });
    target.onCleanup(() => app.close());
    await app.ready();
    return { app, target, log };
  }
  const refusal = (app: FastifyInstance): unknown => {
    try {
      captureFenceControl(app).provideProductionParts(PARTS_DOUBLE);
      return 'TAKEN';
    } catch (error) {
      return codeOf(error);
    }
  };

  it('any operation but REAL_PRODUCTION: refused in SIMULATED and in REAL_DEVELOPMENT, before any boot step ran', async () => {
    const simulated = await appOn('r89_door_sim', { demoControls: true });
    expect(captureFenceControl(simulated.app).operation).toBe('SIMULATED');
    expect(refusal(simulated.app)).toBe(CaptureAdapterRefusal.ADAPTER_INVALID);
    const development = await appOn('r89_door_dev', { captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: '/bin/echo', captureWorkerPath: fixture.worker('capture-worker') });
    expect(captureFenceControl(development.app).operation).toBe('REAL_DEVELOPMENT');
    expect(refusal(development.app)).toBe(CaptureAdapterRefusal.ADAPTER_INVALID);
  });

  it('REAL_PRODUCTION: the first hand-over before the boot is taken; a second one is refused', async () => {
    const { app } = await appOn('r89_door_twice', { captureMode: 'real', demoControls: false, installationDeviceId: fixture.installationId, captureWorkerPath: fixture.worker('capture-worker') });
    expect(captureFenceControl(app).operation).toBe('REAL_PRODUCTION');
    expect(refusal(app)).toBe('TAKEN');
    expect(refusal(app)).toBe(CaptureAdapterRefusal.ADAPTER_INVALID);
  });

  it('REAL_PRODUCTION: a hand-over after the fence boot step ran is refused (the step ran; the boot was refused later, by the host facts no one handed in)', async () => {
    const { app, log, target } = await appOn('r89_door_late', { captureMode: 'real', demoControls: false, installationDeviceId: fixture.installationId, captureWorkerPath: fixture.worker('capture-worker'), ...standInPrograms(fixture.programsDir) });
    expect(captureFenceControl(app).operation).toBe('REAL_PRODUCTION');
    // The seed's selector names its development sources, which a production fence refuses; with all four slots unassigned the fence step PASSES (category 1).
    await target.ownerPool().query('UPDATE public.capture_config SET video_01_device_id = NULL, video_01_profile = NULL, video_02_device_id = NULL, video_02_profile = NULL, video_03_device_id = NULL, video_03_profile = NULL, video_04_device_id = NULL, video_04_profile = NULL, mic_01_id = NULL, mic_02_id = NULL, mic_03_id = NULL, mic_04_id = NULL'); // D60 / D61 (2026-11-04): the eight slots of the widened selector; the roles are the numbered channels mic_01_id..mic_04_id (0040)
    // REVISED 2026-11-04 (S99-01, D241): check 4c refuses the PUBLISHED demo password of the seed BEFORE 4d-0 asks the
    // host facts — the case names the host facts as the refusal, so the operators get a password of their own first.
    await ownCredentials(target.ownerPool());
    const refused = await app.readiness.boot().then(() => null, (error: unknown) => error);
    expect(refused).toBeInstanceOf(BootError);
    const passed = log.lines().filter((line) => line['msg'] === 'boot step passed').map((line) => String(line['step']));
    expect(passed, JSON.stringify([(refused as BootError).stepId, codeOf((refused as BootError).cause)])).toContain('capture.fence');
    expect([(refused as BootError).stepId, codeOf((refused as BootError).cause)]).toEqual(['capture.boot', 'CAPTURE_HOST_FACTS_NOT_HANDED_IN']);
    // No parts were handed in before the step: the fence said so and built the empty registry.
    expect(log.lines().some((line) => line['code'] === 'CAPTURE_PRODUCTION_PARTS_NOT_PROVIDED')).toBe(true);
    expect(refusal(app)).toBe(CaptureAdapterRefusal.ADAPTER_INVALID);
  });
});

// ── 2. C-8 of review 086: the entry file started by a test ─────────────────────────────────────
describe.skipIf(!ASKED)('row 89 / C-8 of 086: `src/index.ts` started as a process - composition, host facts of the process, boot, listen, shutdown', () => {
  it('a REAL_PRODUCTION Core started through the entry boots on this Mac\'s platform word, listens on loopback and ends at SIGTERM with status 0; with NODE_OPTIONS set the same start is refused by the process\'s own fact', async () => {
    const fixture = realBootFixture('row89-entry', ENTRY_INSTALLATION);
    const key = makeProductionTestKey(fixture, Date.now());
    const errorLog = join(fixture.dataDir, 'entry-errors.log');
    try {
      const target = await db.another({ template: 'seed', slug: 'r89_entry' });
      const owner = target.ownerPool();
      await ownCredentials(owner);
      await owner.query('UPDATE public.stt_config SET enabled = false');
      // The seed's selector names development sources, which a production fence refuses: all four slots unassigned (category 1 boots).
      await owner.query('UPDATE public.capture_config SET video_01_device_id = NULL, video_01_profile = NULL, video_02_device_id = NULL, video_02_profile = NULL, video_03_device_id = NULL, video_03_profile = NULL, video_04_device_id = NULL, video_04_profile = NULL, mic_01_id = NULL, mic_02_id = NULL, mic_03_id = NULL, mic_04_id = NULL'); // D60 / D61 (2026-11-04): all eight slots unassigned
      expect(target.runtime.database).not.toBe('dems_demo');
      expect(target.runtime.database).toMatch(/^dems_test_/);
      const config = { ...productionConfig(target, fixture, { captureWorkerPath: fixture.worker('capture-worker'), ...standInPrograms(key.programsDir) }), port: 0 as never, logLevel: 'info' as const };

      /** One start of the entry: the configuration over the IPC channel, the log lines of standard output, the exit. */
      const start = async (environment: Record<string, string>): Promise<{ readonly child: ChildProcess; readonly lines: Record<string, unknown>[]; readonly exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }> }> => {
        const lines: Record<string, unknown>[] = [];
        const child = fork(ENTRY, [], { cwd: WORKSPACE, execArgv: ['--import', 'tsx', '--import', ENTRY_HOOKS], env: { PATH: process.env.PATH ?? '/usr/bin:/bin', ROW89_ENTRY_ERROR_LOG: errorLog, ...environment }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], serialization: 'json' });
        const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((done) => child.once('exit', (code, signal) => done({ code, signal })));
        let pending = '';
        child.stdout?.on('data', (chunk: Buffer) => {
          pending += chunk.toString('utf8');
          for (let end = pending.indexOf('\n'); end !== -1; end = pending.indexOf('\n')) {
            const text = pending.slice(0, end);
            pending = pending.slice(end + 1);
            try {
              lines.push(JSON.parse(text) as Record<string, unknown>);
            } catch {
              // not a log line
            }
          }
        });
        child.stderr?.resume();
        // The configuration, with the clone's runtime credential, goes over the channel once it asks: never a file, an argument or the environment.
        child.once('message', () => child.send({ type: 'row89-entry-config', config: { ...config, database: { ...target.runtime, password: target.runtime.password.reveal() } } }));
        return { child, lines, exited };
      };

      // (1) THE PREPARED START: no NODE_OPTIONS, core-file limit 0 inherited from the run.
      const prepared = await start({});
      try {
        const listening = await until(
          'the entry listens',
          90_000,
          () => {
            if (prepared.child.exitCode !== null) throw new Error(`the entry ended with ${prepared.child.exitCode}: ${JSON.stringify(prepared.lines.slice(-8).map((line) => [line['msg'], line['code'], line['check']]))}`);
            return prepared.lines.find((line) => typeof line['msg'] === 'string' && (line['msg'] as string).startsWith('Server listening at http://127.0.0.1:')) ?? null;
          },
          () => prepared.lines.slice(-8).map((line) => [line['msg'], line['code']]),
        );
        const port = Number(/:(\d+)$/.exec(String(listening['msg']))?.[1]);
        expect(port).toBeGreaterThan(0);
        expect(MUST_BE_FREE).not.toContain(port);
        const health = await fetch(`http://${HOST}:${port}/api/v1/health`);
        expect(health.status).toBe(200);
        // The composition ran in REAL_PRODUCTION; the platform word the boot row states is THIS process's (darwin on this Mac), handed in by the entry.
        expect(prepared.lines.some((line) => line['code'] === 'CAPTURE_COMPOSITION_DONE')).toBe(true);
        const row = await lastBootRow(owner);
        expect(row).toMatchObject({ captureOperation: 'REAL_PRODUCTION', hostPlatform: process.platform });
        prepared.child.kill('SIGTERM');
        const end = await Promise.race([prepared.exited, sleep(30_000).then(() => null)]);
        expect(end).toEqual({ code: 0, signal: null });
        expect(prepared.lines.some((line) => line['msg'] === 'shutdown complete')).toBe(true);
      } finally {
        if (prepared.child.exitCode === null && prepared.child.signalCode === null) prepared.child.kill('SIGKILL');
      }

      // (2) THE SAME START WITH NODE_OPTIONS SET (empty: the runtime ignores it, the entry's own fact does not): refused at `capture.boot` by the host check.
      const refused = await start({ NODE_OPTIONS: '' });
      try {
        const end = await Promise.race([refused.exited, sleep(90_000).then(() => null)]);
        expect(end).toEqual({ code: 1, signal: null });
        const fatal = refused.lines.find((line) => line['msg'] === 'the server stopped: boot');
        expect(fatal).toMatchObject({ check: 'capture.boot' });
        expect(refused.lines.some((line) => line['code'] === 'CAPTURE_HOST_DIAGNOSTIC_SWITCH' && line['reason'] === 'NODE_OPTIONS_SET')).toBe(true);
        expect(refused.lines.some((line) => typeof line['msg'] === 'string' && (line['msg'] as string).startsWith('Server listening'))).toBe(false);
      } finally {
        if (refused.child.exitCode === null && refused.child.signalCode === null) refused.child.kill('SIGKILL');
      }
      // The two error-log lines went to the fixture's temporary file, not to the repository's log folder.
      expect(existsSync(errorLog)).toBe(true);
      await target.drop();
    } finally {
      fixture.remove();
    }
    expect(key.gone()).toBe(true);
  }, 300_000);
});

// ── 3. AD-08: the full session ──────────────────────────────────────────────────────────────────

/** The question tables of the boot's host checks (rows 80, 81), to answer each question as a prepared Linux host. */
const same = (a: HostCommand, b: HostCommand): boolean => a.program === b.program && a.args.join(' ') === b.args.join(' ');
const hostCodeOf = (command: HostCommand): string | undefined => HOST_COMMAND_CHECKS.find((check) => same(check.command, command))?.code;
const ran = (output: string, exitCode = 0) => ({ outcome: 'RAN', exitCode, output }) as const;

/**
 * THE HOST FACTS OF A PREPARED LINUX HOST, handed in through the entry's own door (`provideHost`). The runner starts
 * nothing: every question of the host table answers as the host profile states it, the relay's library statement with
 * its "past the statement" code 10 (the built relay is never started by the boot), and nothing of the address helper
 * is installed (the host starts with one warning, decision C94 (j); this file sets no camera address).
 */
function linuxHostFacts(relayProgram: string): { readonly facts: CaptureBootHostFacts; readonly asked: string[] } {
  const programKeyOf = (command: HostCommand): string | undefined =>
    command.program === relayProgram && command.args.length === 0 ? 'RELAY' : same(command, INTERFACE_FILE_COMMAND) ? 'INTERFACE' : PROGRAM_OWNERSHIP_CHECKS.find((check) => same(check.command, command))?.code;
  const host = fakeProductionHost({
    codeOf: hostCodeOf,
    programKeyOf,
    platform: 'linux',
    startArguments: process.execArgv,
    answers: { [CaptureHostRefusal.HOST_ALIAS_SOCKET]: ran('', 1) },
    programAnswers: { CAPTURE_HOST_ALIAS_HELPER_UNSAFE: ran('directory root root 755\n', 1), CAPTURE_HOST_ALIAS_GRANT_UNSAFE: ran('', 1) },
  });
  const { platform, coreFileLimit, startArguments, nodeOptionsSet, run } = host.deps;
  return { facts: { platform, coreFileLimit, startArguments, nodeOptionsSet, run }, asked: host.asked };
}

/** One USB sound card of FOUR inputs (row W3G, D61: one per microphone channel; was two), in the forms of a Linux host (`/proc/asound`, `arecord -l`, the device tree). The id keeps its earlier word. */
const CARD = { index: 1, id: 'Duo', product: 'DEMS Row89 Duo', usbId: '1a2b:0089', port: '0000:00:14.0-2', serial: 'R89SERIAL0001', channels: 4 } as const;
function cardListingDouble(): { readonly enumerator: CardEnumerator; readonly lists: () => number } {
  let lists = 0;
  const source: CardListingSource = {
    async captureDevices() {
      lists += 1;
      return `**** List of CAPTURE Hardware Devices ****\ncard ${CARD.index}: ${CARD.id} [${CARD.product}], device 0: USB Audio [USB Audio]\n  Subdevices: 1/1\n  Subdevice #0: subdevice #0\n`;
    },
    presentCards: async () => `${String(CARD.index).padStart(2)} [${CARD.id.padEnd(15)}]: USB-Audio - ${CARD.product}\n                      ${CARD.product}\n`,
    usbId: async (cardIndex) => (cardIndex === CARD.index ? `${CARD.usbId}\n` : null),
    usbSerial: async (cardIndex) => (cardIndex === CARD.index ? `${CARD.serial}\n` : null),
    stream: async (cardIndex) =>
      cardIndex === CARD.index ? `${CARD.product} at usb-${CARD.port}, high speed : USB Audio\n\nCapture:\n  Status: Stop\n  Interface 1\n    Altset 1\n    Format: S24_3LE\n    Channels: ${CARD.channels}\n    Endpoint: 0x81 (1 IN) (ASYNC)\n    Rates: 44100, 48000\n    Bits: 24\n\n` : null,
    hwParams: async (cardIndex) => (cardIndex === CARD.index ? `HW Params of device "hw:${cardIndex},0":\n--------------------\nFORMAT:  S16_LE S32_LE\nCHANNELS: ${CARD.channels}\nRATE: [44100 192000]\n--------------------\n` : null),
  };
  return { enumerator: createCardEnumerator(source), lists: () => lists };
}

/**
 * THE STAND-IN OF THE LINUX MICROPHONE HELPER. Started by the built guard through the production door with the Linux
 * table's arguments (`-f alsa ... -i dems_<card>_<device> ... <pipe>`): the pre-check form ends with `-f null -` and
 * exits 0; the push form's LAST argument is the session's pipe, into which this host's FFmpeg writes a generated tone in
 * the transport's format (mono, 48 kHz, 32-bit float), with its progress lines on standard output as the real helper's.
 */
function writeMicHelperStandIn(directory: string, ffmpeg: string): string {
  const path = `${directory}/linux-mic-helper`;
  writeFileSync(
    path,
    [
      '#!/bin/sh',
      '# Row 89: the stand-in of the Linux FFmpeg of a production microphone (no ALSA on this Mac). It reads no device.',
      'for last in "$@"; do :; done',
      'if [ "$last" = "-" ]; then exit 0; fi',
      `exec '${ffmpeg}' -hide_banner -nostdin -nostats -loglevel warning -progress pipe:1 -re -f lavfi -i sine=frequency=440:sample_rate=48000 -vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y "$last"`,
      '',
    ].join('\n'),
    { mode: 0o700 },
  );
  chmodSync(path, 0o700);
  return path;
}

/** The production rows of the clone, as an adoption, a stream test and a microphone registration leave them. Written by the owner. */
async function productionRows(owner: Pool, onvifPorts: Readonly<Record<ProductionCamera, number>>): Promise<void> {
  const at = Date.now();
  await owner.query(
    "INSERT INTO public.capture_devices (id, kind, transport, model, enabled, adapter_kind, address, profiles) VALUES ('CAM-11', 'CAMERA', 'RTSP', 'Row89 camera HEVC', true, 'ONVIF_RTSP', $1, '[\"HEVC_1080P25\"]'), ('CAM-12', 'CAMERA', 'RTSP', 'Row89 camera H264', true, 'ONVIF_RTSP', $2, '[\"H264_1080P25\"]'), ('CAM-13', 'CAMERA', 'RTSP', 'Row89 camera H264 3', true, 'ONVIF_RTSP', $3, '[\"H264_1080P25\"]'), ('CAM-14', 'CAMERA', 'RTSP', 'Row89 camera H264 4', true, 'ONVIF_RTSP', $4, '[\"H264_1080P25\"]'), ('MIC-11', 'MIC', 'USB', 'Row89 input 1', true, 'USB_AUDIO', NULL, '[]'), ('MIC-12', 'MIC', 'USB', 'Row89 input 2', true, 'USB_AUDIO', NULL, '[]'), ('MIC-13', 'MIC', 'USB', 'Row89 input 3', true, 'USB_AUDIO', NULL, '[]'), ('MIC-14', 'MIC', 'USB', 'Row89 input 4', true, 'USB_AUDIO', NULL, '[]')",
    [`${HOST}:${onvifPorts['CAM-11']}`, `${HOST}:${onvifPorts['CAM-12']}`, `${HOST}:${onvifPorts['CAM-13']}`, `${HOST}:${onvifPorts['CAM-14']}`],
  );
  await owner.query(
    "INSERT INTO public.capture_device_streams (device_id, profile, onvif_profile_token, stream_role, codec, width, height, read_at) VALUES ('CAM-11', 'HEVC_1080P25', 'main.stream:0-a', 'MAIN', 'HEVC', 1920, 1080, $1), ('CAM-12', 'H264_1080P25', 'main.stream:0-a', 'MAIN', 'H264', 1920, 1080, $1), ('CAM-13', 'H264_1080P25', 'main.stream:0-a', 'MAIN', 'H264', 1920, 1080, $1), ('CAM-14', 'H264_1080P25', 'main.stream:0-a', 'MAIN', 'H264', 1920, 1080, $1)",
    [at],
  );
  await owner.query(
    'INSERT INTO public.capture_audio_inputs (device_id, usb_id, card_id, card_device, input_number, native_channels, updated_at, usb_serial, usb_port) VALUES ($1, $3, $4, 0, 1, $5, $2, $6, $7), ($8, $3, $4, 0, 2, $5, $2, $6, $7), ($9, $3, $4, 0, 3, $5, $2, $6, $7), ($10, $3, $4, 0, 4, $5, $2, $6, $7)',
    ['MIC-11', at, CARD.usbId, CARD.id, CARD.channels, CARD.serial, CARD.port, 'MIC-12', 'MIC-13', 'MIC-14'],
  );
  // D60 / D61 (2026-11-04): the selector names EIGHT slots. Row W3G (D146, F-W3TW3-T2): ALL EIGHT are assigned to
  // production sources - the four cameras on VIDEO-01..04 and the card's four inputs on MIC-01..04 - because a Core in
  // its own capture BLOCKS the pre-check on an unassigned slot (LENS_3/LENS_4/MIC_3/MIC_4 NOT_ASSIGNED; D62/R90-D2,
  // D124 R147-3), so the 2+2 selector of before ended the pre-check in BLOCK and its acknowledge in 409 NO_WARNINGS.
  // Never the seed's development built-ins (one class per session).
  await owner.query("UPDATE public.capture_config SET video_01_device_id = 'CAM-11', video_01_profile = 'HEVC_1080P25', video_02_device_id = 'CAM-12', video_02_profile = 'H264_1080P25', video_03_device_id = 'CAM-13', video_03_profile = 'H264_1080P25', video_04_device_id = 'CAM-14', video_04_profile = 'H264_1080P25', mic_01_id = 'MIC-11', mic_02_id = 'MIC-12', mic_03_id = 'MIC-13', mic_04_id = 'MIC-14'");
  await owner.query('UPDATE public.stt_config SET enabled = false');
}

interface ComposedCore {
  readonly app: FastifyInstance;
  readonly log: CapturedLog;
  /** The parts the door was handed (after this file's one difference). */
  readonly parts: ProductionCaptureParts[];
  close(): Promise<void>;
}

/**
 * A production Core on `target`, composed as the ENTRY composes it - `composeProductionCapture` over the ports of
 * `composeProductionCaptureOf`, written out here member by member - with platform `linux`, and booted after the
 * Linux host facts were handed in through `provideHost`. THE ONE DIFFERENCE (AD-02 (2)): the camera's stored-address
 * rule and its credential reader take the test-only loopback rule, and the card listing is the double above.
 * Returns the refusal of a boot instead of throwing it.
 */
async function composedCore(
  target: Clone,
  fixture: RealBootFixture,
  programs: Partial<ConfigInput>,
  options: { readonly cards: CardEnumerator; readonly readerOf?: (holders: CaptureCredentialHolders) => CaptureCredentialHolders['cameraAdapter'] },
): Promise<ComposedCore & { readonly refused: readonly [string, unknown, unknown] | null; readonly hostAsked: readonly string[] }> {
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig(productionConfig(target, fixture, programs)), logStream: log.stream, errorLogFile: `${fixture.dataDir}/error.log` });
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    if (app.seams.has('capture')) await app.capture.shutdown();
    await app.close();
  };
  target.onCleanup(close);
  await app.ready();
  expect(captureFenceControl(app).operation).toBe('REAL_PRODUCTION');

  const parts: ProductionCaptureParts[] = [];
  const report: ProductionCapturePorts['report'] = (level, code, context) => {
    app.log[level]({ code, ...context }, 'the composition of production capture reports');
    app.errorLog.append({ level, source: 'captureComposition', message: 'the composition of production capture reports', code, context: { ...context } });
  };
  const ports: ProductionCapturePorts = {
    operation: captureFenceControl(app).operation,
    timers: createSystemTimers(),
    now: () => app.clock.now(),
    relayProgram: app.config.captureRelayPath,
    guardProgram: app.config.captureGuardPath,
    audioHelperProgram: app.config.captureAudioHelperPath,
    faultEngine: () => {
      if (!app.seams.has('engine') || !app.engine.running) return null;
      const engine = app.engine;
      return {
        active: (fault) => engine.state().faults.active.some((held) => held.kind === fault.code && held.target === fault.subject && (held.reason ?? null) === fault.reason),
        raise: (fault) => engine.raiseCaptureWarning(fault),
        clear: (fault) => engine.clearCaptureWarning(fault),
      };
    },
    workerSuperseded: () => app.seams.has('capture') && app.capture.status().phase === CapturePhase.RESTARTING,
    unit: (label, work) => app.pipeline.run(label, work),
    open: (deviceId, sealed) => {
      const opened = coreCredentialStore(app);
      if (opened.status !== 'READY') throw new Error(`the credential store is ${opened.status}`);
      return opened.store.capture.open(deviceId, sealed);
    },
    errorLog: app.errorLog,
    query: (text, values) => app.db.read('row89.read', (pool) => pool.query(text, values)),
    provideConnectionTest: (handed) => {
      adoptedCameraTestControl(app).provide(handed);
      captureConnectControl(app).provideCandidateRule(handed.storedAddress);
    },
    provideEnumerator: () => captureAudioCardsControl(app).provideEnumerator(options.cards),
    provideRelayReports: (relayReports) => sessionCapture(app).replace({ relayReports }),
    provideProductionParts: (given) => {
      // THE ONE DIFFERENCE (AD-02 (2)): the loopback rule and a reader wired with it; the card listing double.
      const holders = wireCaptureCredentialHolders({ unit: ports.unit, open: ports.open, errorLog: ports.errorLog, query: ports.query, storedAddress: loopbackStoredCameraAddress });
      const credentials = options.readerOf?.(holders) ?? holders.cameraAdapter;
      const handed: ProductionCaptureParts = {
        ...given,
        dependencies: { camera: { ...given.dependencies.camera, storedAddress: loopbackStoredCameraAddress, credentials }, audio: { ...given.dependencies.audio, cards: options.cards } },
        watches: { camera: { ...given.watches.camera, storedAddress: loopbackStoredCameraAddress }, microphone: { ...given.watches.microphone, cards: options.cards } },
        cards: options.cards,
      };
      parts.push(handed);
      captureFenceControl(app).provideProductionParts(handed);
    },
    onCaptureEnd: (listener) =>
      sessionCapture(app).on((event) => {
        if (event.type === 'STOPPED' || event.type === 'INTERRUPTED' || event.type === 'FAILED_START') listener();
      }),
    report,
  };
  // The entry's order: composition (platform `linux`), then the host facts, then the boot steps, then the capture boot.
  const composition = composeProductionCapture(ports, { platform: 'linux', cardPrograms: { captureDevices: async () => '' } });
  expect(composition.composed).toBe(true);
  const host = linuxHostFacts(app.config.captureRelayPath ?? RELAY);
  captureBootControl(app).provideHost(host.facts);
  try {
    await app.readiness.boot();
  } catch (error) {
    if (!(error instanceof BootError)) throw error;
    return { app, log, parts, close, refused: [error.stepId, codeOf(error.cause), (error.cause as { reason?: unknown } | null)?.reason ?? null], hostAsked: host.asked };
  }
  await app.capture.boot();
  return { app, log, parts, close, refused: null, hostAsked: host.asked };
}

describe.skipIf(!ASKED)('row 89 / AD-08: the first full session on doubles - REAL_PRODUCTION on linux facts, eight production sources (D61), one HEVC, sealed and verified, no seam', () => {
  /** What the gate condition counts; filled by the cases in order. */
  const facts: Record<string, unknown> = {};
  const cleanups: (() => Promise<void> | void)[] = [];
  afterAll(async () => {
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch {
        // every cleanup runs
      }
    }
  });

  let key: ProductionTestKey;
  let fixture: RealBootFixture;
  let target: Clone;
  let owner: Pool;
  let core: (ComposedCore & { readonly refused: readonly [string, unknown, unknown] | null }) | null = null;
  const onvif: Partial<Record<ProductionCamera, OddOnvifDevice>> = {};
  const cameras: ChildProcessWithoutNullStreams[] = [];
  const cameraLogs: string[] = [];
  const locator: Partial<Record<ProductionCamera, string>> = {};
  const cards = cardListingDouble();

  it('the real boot checks BITE on the same clone (the seed\'s operators refused; a development key refused), then pass by real means with the made production key and the operators\' own passwords, on linux facts', async () => {
    // Inside the two locks: nothing of a Core, a console or a capture session listens (decision C123).
    const busy: number[] = [];
    for (const port of MUST_BE_FREE) if (await listened(port)) busy.push(port);
    expect(busy, 'ports that must be free before a session starts').toEqual([]);
    for (const program of [WORKER, RELAY, GUARD]) expect(existsSync(program), program).toBe(true);
    const ffmpeg = execFileSync('/usr/bin/which', ['ffmpeg'], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '' } }).trim();
    expect(ffmpeg.startsWith('/')).toBe(true);

    fixture = realBootFixture('row89-session', INSTALLATION);
    cleanups.push(() => fixture.remove());
    key = makeProductionTestKey(fixture, Date.now());
    expect(key.facts).toMatchObject({ problem: null, development: false });
    expect(key.facts.units).toContain(`Evidence signing ${INSTALLATION}`);
    const helper = writeMicHelperStandIn(key.programsDir, realpathSync(ffmpeg));
    const programs: Partial<ConfigInput> = { captureWorkerPath: WORKER, captureRelayPath: RELAY, captureGuardPath: GUARD, captureAudioHelperPath: helper };

    // The doubles of the four cameras (row W3G: was two): ONVIF devices on ports the system hands out, test cameras on 8572 / 8573 / 8574 and one the system hands out.
    for (const deviceId of PRODUCTION_CAMERAS) {
      const port = await freeOddDevicePort();
      const device = createOddOnvifDevice(port, (request) => {
        if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
        if (request.operation === 'GetServices') return servicesAnswer(`http://${HOST}:${port}`);
        if (!tokenHolds(request, ACCOUNT)) return notAuthorizedFault(400);
        return streamAnswer(locator[deviceId] ?? '');
      });
      await device.start();
      onvif[deviceId] = device;
      cleanups.push(() => device.stop());
    }
    for (const deviceId of PRODUCTION_CAMERAS) {
      const codec = deviceId === 'CAM-11' && MUTANT !== 'h264' ? 'hevc' : 'h264';
      const eventLog = join(fixture.dataDir, `${deviceId}.camera.jsonl`);
      cameraLogs.push(eventLog);
      const child = spawn('python3', ['-B', CAMERA_SCRIPT, '--port', String(CAMERA_PORTS[deviceId]), '--codec', codec, '--frames', '0', '--event-log', eventLog, '--exit-on-stdin-eof', '--max-seconds', '600'], { stdio: ['pipe', 'pipe', 'pipe'] });
      cameras.push(child);
      cleanups.push(async () => {
        child.stdin.end();
        await Promise.race([new Promise((done) => child.once('close', done)), sleep(10_000)]);
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      });
      child.stderr.resume();
      let pending = '';
      const ready = await new Promise<Record<string, unknown>>((done, fail) => {
        const timer = setTimeout(() => fail(new Error(`the test camera of ${deviceId} said no ready line`)), 120_000);
        child.stdout.on('data', (chunk: Buffer) => {
          pending += chunk.toString('utf8');
          for (const line of pending.split('\n')) {
            try {
              const parsed = JSON.parse(line) as Record<string, unknown>;
              if (parsed['event'] === 'ready') {
                clearTimeout(timer);
                done(parsed);
              }
            } catch {
              // not yet a whole line
            }
          }
        });
      });
      // Row W3G: the port the camera BOUND, from its ready line (CAM-14 asks for port 0); the fixed ones are checked to be the asked ones.
      const boundPort = Number(ready['port']);
      if (CAMERA_PORTS[deviceId] !== 0) expect(boundPort).toBe(CAMERA_PORTS[deviceId]);
      expect(MUST_BE_FREE).not.toContain(boundPort);
      locator[deviceId] = `${SCHEME}://${HOST}:${boundPort}${String(ready['path'])}`;
    }

    target = await db.another({ template: 'seed', slug: 'r89_session' });
    owner = target.ownerPool();
    expect(target.runtime.database).not.toBe('dems_demo');
    expect(target.runtime.database).toMatch(/^dems_test_/);
    await productionRows(owner, { 'CAM-11': onvif['CAM-11']?.port ?? 0, 'CAM-12': onvif['CAM-12']?.port ?? 0, 'CAM-13': onvif['CAM-13']?.port ?? 0, 'CAM-14': onvif['CAM-14']?.port ?? 0 });

    // (i) THE SEED'S OPERATORS (the published demonstration password): REFUSED by check 4c, from the stored hashes - no seam answers it.
    const seeded = await composedCore(target, fixture, programs, { cards: cards.enumerator });
    expect(seeded.refused?.slice(0, 2)).toEqual(['capture.boot', 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION']);
    await seeded.close();

    // (ii) A DEVELOPMENT KEY (the sealing host's development key in another temporary fixture): REFUSED by check 4b, from the certificate.
    await ownCredentials(owner);
    const developmentFixture = realBootFixture('row89-devkey', INSTALLATION);
    cleanups.push(() => developmentFixture.remove());
    provisionDevelopmentSigningKey({ dataDir: developmentFixture.dataDir, now: FIXTURE_NOW });
    const developed = await composedCore(target, developmentFixture, programs, { cards: cards.enumerator });
    expect(developed.refused?.slice(0, 2)).toEqual(['capture.boot', 'CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION']);
    await developed.close();
    developmentFixture.remove();

    // (iii) THE MADE PRODUCTION KEY AND THE OPERATORS' OWN PASSWORDS: the boot passes, on linux facts, with the built worker's HELLO.
    const readerOf = MUTANT === 'reveal' ? (holders: CaptureCredentialHolders): CaptureCredentialHolders['cameraAdapter'] => ({ sessionOpen: async (deviceId, sessionId) => (await holders.cameraAdapter.relayRestart(deviceId, sessionId), holders.cameraAdapter.sessionOpen(deviceId, sessionId)), relayRestart: (deviceId, sessionId) => holders.cameraAdapter.relayRestart(deviceId, sessionId) }) : undefined;
    const booted = await composedCore(target, fixture, programs, { cards: cards.enumerator, ...(readerOf === undefined ? {} : { readerOf }) });
    expect(booted.refused).toBeNull();
    core = booted;
    cleanups.push(() => booted.close());
    const app = booted.app;
    // The linux host was asked its questions (the address helper absent: one warning), and the boot row says linux.
    expect(booted.hostAsked.length).toBeGreaterThan(5);
    expect(await lastBootRow(owner)).toMatchObject({ captureOperation: 'REAL_PRODUCTION', hostPlatform: 'linux', hostProfile: 'WILL_BE_ASKED' });
    // The registry of the lift: both production kinds with an opener; the four selected sources are of them.
    const registry = captureFenceControl(app).registry();
    expect(registry?.openerKinds()).toEqual(expect.arrayContaining(['ONVIF_RTSP', 'USB_AUDIO']));
    expect([...PRODUCTION_CAMERAS, ...PRODUCTION_MICS].map((id) => `${id} ${registry?.describe(id).adapterKind} ${registry?.describe(id).sourceClass}`)).toEqual([
      ...PRODUCTION_CAMERAS.map((id) => `${id} ONVIF_RTSP PRODUCTION`),
      ...PRODUCTION_MICS.map((id) => `${id} USB_AUDIO PRODUCTION`),
    ]);
    expect(booted.parts).toHaveLength(1);
    expect(booted.parts[0]?.platform).toBe('linux');
    // The credentials of the two cameras: the test camera's synthetic account, sealed into THIS Core's store (the fixture's temporary directory).
    const opened = coreCredentialStore(app);
    if (opened.status !== 'READY') throw new Error(`the credential store is ${opened.status}`);
    for (const deviceId of PRODUCTION_CAMERAS) {
      const sealed = await opened.store.capture.seal(deviceId, ACCOUNT.secret);
      await app.db.pool.query(INSERT_CAPTURE_CREDENTIAL, [deviceId, ACCOUNT.username, Buffer.from(sealed.ciphertext), Buffer.from(sealed.nonce), sealed.keyRef, Date.now()]);
    }
    facts['bootChecks'] = { seededOperators: 'REFUSED', developmentKey: 'REFUSED', productionKey: 'PASSED', seamInjected: false, hostPlatform: 'linux' };
  }, 420_000);

  it('ONE session through the product: started, durable, stopped, SEALED and VERIFIED; eight PRODUCTION source rows (D61); /2.1 with four pair audio files (D5); ONE HEVC track; 4 reveals carry the session; 1 authenticated GetStreamUri per camera', async () => {
    if (core === null) throw new Error('the Core of the previous case did not boot');
    const app = core.app;
    const log = core.log;
    const codes = (): string[] => log.lines().map((line) => String(line['code'] ?? '')).filter((code) => code !== '');
    // Row C1D (D149): a failure of the opens also prints the RECORDED cause of every source that did not open (this run's error log)
    // and whether this process - so every relay and helper it starts - may reach the camera ingest ports on the loopback at all
    // (read before the session; nothing is asserted on it).
    const ingestReach = await ingestReachOfThisProcess();
    const events: SessionCaptureEvent[] = [];
    sessionCapture(app).on((event) => void events.push(event));
    const sealedBefore = Number((await owner.query<{ n: string }>("SELECT count(*)::text AS n FROM public.evidence_items WHERE status = 'SEALED'")).rows[0]?.n);
    for (const device of Object.values(onvif)) device?.reset();

    const investigator = OPERATORS.find((operator) => operator.role === 'INVESTIGATOR');
    if (investigator === undefined) throw new Error('no seeded investigator');
    const signedIn = await webSignIn(app, investigator.username, OWN_PASSWORD);
    const token = cookieValue(signedIn, app.config.sessionCookieName);
    if (signedIn.statusCode !== 200 || token === null) throw new Error(`the sign-in answered ${signedIn.statusCode}`);
    const cookie = `${app.config.sessionCookieName}=${token}`;
    const post = (url: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> => app.inject({ method: 'POST', url, headers: { cookie, origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload }) });
    const sessionOf = () => app.engine.state().session;

    await app.engine.setTabletLink('CONNECTED');
    const created = await post('/api/v1/session', { caseNumber: 'LP/2026/1014-0089', subjectType: 'SAKSI', subjectName: 'Row 89 Subject', investigatorId: investigator.id, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
    expect([200, 201], created.body).toContain(created.statusCode);
    const sessionId = sessionOf()?.id ?? '';
    expect((await post(`/api/v1/session/${sessionId}/start`)).statusCode).toBe(202);
    await until('the pre-check ends', 60_000, () => (sessionOf()?.state === 'ARMED' || (sessionOf()?.state === 'PRECHECK' && sessionOf()?.precheck.completedAt !== null) ? true : null), () => [sessionOf()?.precheck, codes().slice(-10)]);
    if (sessionOf()?.state === 'PRECHECK') {
      const acknowledged = await post(`/api/v1/session/${sessionId}/precheck/acknowledge`);
      expect(acknowledged.statusCode, acknowledged.body).toBe(200);
    }

    const started = await post(`/api/v1/session/${sessionId}/start`);
    expect(started.statusCode, started.body).toBe(200);
    expect(sessionOf()).toMatchObject({ state: 'RECORDING' });
    // D61 (row W3G): eight rows, the channels by number (the role slots MIC-PRIMARY / MIC-STANDBY became MIC-01 / MIC-02 in 0040).
    expect((await owner.query<{ slot: string; device_id: string; adapter_kind: string }>('SELECT slot, device_id, adapter_kind FROM public.session_capture_sources WHERE session_id = $1 ORDER BY slot', [sessionId])).rows.map((row) => [row.slot, row.device_id, row.adapter_kind])).toEqual([
      ['MIC-01', 'MIC-11', 'USB_AUDIO'],
      ['MIC-02', 'MIC-12', 'USB_AUDIO'],
      ['MIC-03', 'MIC-13', 'USB_AUDIO'],
      ['MIC-04', 'MIC-14', 'USB_AUDIO'],
      ['VIDEO-01', 'CAM-11', 'ONVIF_RTSP'],
      ['VIDEO-02', 'CAM-12', 'ONVIF_RTSP'],
      ['VIDEO-03', 'CAM-13', 'ONVIF_RTSP'],
      ['VIDEO-04', 'CAM-14', 'ONVIF_RTSP'],
    ]);
    await until('the first durable fragment', 60_000, () => (sessionOf()?.captureDurable === true ? true : sessionOf()?.state !== 'RECORDING' ? Promise.reject(new Error(`the session left RECORDING: ${sessionOf()?.state} ${JSON.stringify(codes().slice(-15))}`)) : null), () => codes().slice(-15));
    await until('the capture said every source opened', 30_000, () => (events.some((event) => event.type === 'STARTED' || event.type === 'FAILED_START') ? true : null), () => codes().slice(-15));
    expect(events.find((event) => event.type === 'STARTED'), JSON.stringify({ events, opens: openFailuresOf(app.errorLog.file), ingestReach })).toMatchObject({ camerasNotOpened: [] });
    await sleep(RECORD_SECONDS * 1_000);
    const whileRecording = {
      relays: commandLinesWith(RELAY).length,
      guards: commandLinesWith(GUARD).length,
      micHelpers: commandLinesWith(key.programsDir).length,
      faults: app.engine.state().faults.active.map((fault) => `${fault.kind}@${String(fault.target)}`),
    };
    const fragments = (await owner.query<{ track_id: string; n: string }>('SELECT track_id, count(*)::text AS n FROM public.recording_fragments WHERE session_id = $1 GROUP BY track_id ORDER BY track_id', [sessionId])).rows.map((row) => `${row.track_id}:${row.n}`);
    // D61 + D5 (row W3G): the four camera files and the four pair audio files (AUDIO-0N rows, row 148).
    expect(fragments.map((entry) => entry.split(':')[0]), JSON.stringify(whileRecording)).toEqual(['AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04', 'VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04']);

    const stopped = await post(`/api/v1/session/${sessionId}/stop`, { reason: 'Interview complete' });
    expect(stopped.statusCode, stopped.body).toBe(202);
    await until('the capture of the session ended', 60_000, () => (events.some((event) => event.type === 'STOPPED') ? true : null), () => ({ events: events.map((event) => event.type), codes: codes().slice(-15) }));
    await sessionCapture(app).idle();
    expect(sessionCapture(app).liveSessionId()).toBeNull();
    expect(captureFenceControl(app).openSources()).toEqual([]);
    await until('the session is SEALED', 180_000, () => (sessionOf()?.state === 'SEALED' ? true : null), () => ({ state: sessionOf()?.state, steps: sessionOf()?.finalization.steps.map((step) => [step.id, step.status]), codes: codes().slice(-15) }));
    const evidenceId = sessionOf()?.evidenceId ?? '';
    const item = app.engine.state().evidence.find((entry) => entry.id === evidenceId);
    expect(item).toMatchObject({ sessionId, status: 'SEALED', integritySource: 'REAL' });
    const verified = await post(`/api/v1/evidence/${evidenceId}/verify`);
    expect(verified.statusCode, verified.body).toBe(200);
    const body = verified.json() as { ok: boolean; overall: string; sources: { code: string; development: boolean | null; tracks: { deviceId: string; sourceClass: string }[]; audioIntervals: { micDeviceId: string; sourceClass: string }[] } };
    expect(body).toMatchObject({ ok: true, overall: 'PASS' });
    expect(body.sources.development).not.toBe(true);
    expect(body.sources.tracks.map((track) => `${track.deviceId} ${track.sourceClass}`)).toEqual(PRODUCTION_CAMERAS.map((id) => `${id} PRODUCTION`));
    expect(body.sources.audioIntervals.length).toBeGreaterThanOrEqual(1);
    expect(body.sources.audioIntervals.every((interval) => interval.sourceClass === 'PRODUCTION')).toBe(true);
    // The codec of each camera file, as the SIGNED manifest states it (field 43: read from the file's own init segment).
    const manifest = JSON.parse(readFileSync(join(sessionPackageDir(app.config.mediaStoreDir, sessionId), 'session-manifest.json'), 'utf8')) as { schema: string; tracks: { deviceId: string; codec: string | null; sourceClass: string }[]; audioTracks?: { trackId: string; micDeviceId: string; sourceClass: string }[]; audioTracksMissing?: unknown[] };
    const codecs = manifest.tracks.map((track) => `${track.deviceId} ${String(track.codec)}`);
    // D5 (row W3G): a production session of four pairs seals /2.1 with the four pair audio files, all PRODUCTION, nothing stated missing.
    expect(manifest.schema).toBe('dems.evidence-manifest/2.1');
    expect((manifest.audioTracks ?? []).map((track) => `${track.trackId} ${track.micDeviceId} ${track.sourceClass}`)).toEqual(PRODUCTION_MICS.map((id, index) => `AUDIO-0${index + 1} ${id} PRODUCTION`));
    expect(manifest.audioTracksMissing).toBeUndefined();

    // THE GATE COUNTS (AD-08): sessions sealed and verified, HEVC tracks, reveals carrying the session, authenticated GetStreamUri per camera.
    const sealedAfter = Number((await owner.query<{ n: string }>("SELECT count(*)::text AS n FROM public.evidence_items WHERE status = 'SEALED'")).rows[0]?.n);
    const reveals = (await readTrail(owner)).filter((row: AuditRow) => row.type === 'CAPTURE_CREDENTIAL_REVEALED');
    const revealsOfSession = reveals.filter((row) => row.sessionId === sessionId);
    const streamUris = Object.fromEntries(PRODUCTION_CAMERAS.map((deviceId) => [deviceId, (onvif[deviceId]?.requests() ?? []).filter((request) => request.operation === 'GetStreamUri' && (request.token || request.authorization !== '')).length]));
    Object.assign(facts, {
      sessionId,
      sealedAndVerified: (sealedAfter - sealedBefore === 1 && body.ok && body.overall === 'PASS' ? 1 : 0),
      codecs,
      hevcTracks: manifest.tracks.filter((track) => track.codec === 'HEVC').length,
      revealsOfSession: revealsOfSession.length,
      revealReasons: revealsOfSession.map((row) => `${String(row.deviceId)} ${String((row.details as { reason?: unknown } | null)?.reason)}`).sort(),
      revealsTotal: reveals.length,
      authenticatedGetStreamUri: streamUris,
      fragments,
      whileRecording,
      verify: { overall: body.overall, sourcesCode: body.sources.code, development: body.sources.development },
    });
    console.info(`[row89] ${JSON.stringify(facts)}`);
    expect(sealedAfter - sealedBefore).toBe(1);
    // Row W3G (D61): four cameras - still ONE HEVC (CAM-11), one reveal and one authenticated GetStreamUri per camera.
    expect(codecs.sort()).toEqual(['CAM-11 HEVC', 'CAM-12 H264', 'CAM-13 H264', 'CAM-14 H264']);
    expect(manifest.tracks.filter((track) => track.codec === 'HEVC')).toHaveLength(1);
    expect(revealsOfSession.map((row) => `${String(row.deviceId)} ${String((row.details as { reason?: unknown } | null)?.reason)}`).sort()).toEqual(PRODUCTION_CAMERAS.map((id) => `${id} SESSION_OPEN`));
    expect(revealsOfSession).toHaveLength(PRODUCTION_CAMERAS.length);
    expect(streamUris).toEqual({ 'CAM-11': 1, 'CAM-12': 1, 'CAM-13': 1, 'CAM-14': 1 });
  }, 600_000);

  it('NOTHING IS LEFT BEHIND: no relay, guard, helper, worker or camera of this file runs; the key and the data directory do not exist; the clone is not the demo database', async () => {
    const booted = core;
    if (booted !== null) await booted.close();
    for (const camera of cameras) {
      camera.stdin.end();
      await Promise.race([new Promise((done) => camera.once('close', done)), sleep(10_000)]);
      if (camera.exitCode === null && camera.signalCode === null) camera.kill('SIGKILL');
    }
    for (const device of Object.values(onvif)) await device?.stop();
    // The cameras wrote their counters: each was asked for its stream (proof the relay pulled from it), read before the directory goes.
    const pulled = cameraLogs.map((path) => (existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter((line) => line.includes('"PLAY"') || line.includes('PLAY')).length : 0));
    facts['cameraPlays'] = pulled;
    await target.drop();
    fixture.remove();
    const left = [RELAY, GUARD, WORKER, CAMERA_SCRIPT, key.programsDir].flatMap((text) => commandLinesWith(text));
    facts['leftRunning'] = left.length;
    facts['keyAndDataDirectoryGone'] = key.gone();
    console.info(`[row89 end] ${JSON.stringify({ cameraPlays: pulled, leftRunning: left.length, gone: key.gone() })}`);
    expect(left).toEqual([]);
    expect(key.gone()).toBe(true);
    expect(existsSync(fixture.dataDir)).toBe(false);
  }, 120_000);
});
