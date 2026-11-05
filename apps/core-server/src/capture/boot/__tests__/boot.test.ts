// The boot step `capture.boot` as mounted (blueprint row 61; check M3-BC-1): the readiness runner,
// the control, and the DEFAULT wiring - the real path inspector, the real probe of the media root,
// the real key store and the real process channel - on row 61's fixture (a temporary directory; row 228b). The worker is a
// stand-in shell script that says one HELLO (no capture worker is started here: that is
// `worker-probe.real.ts`, a check for the test runner). No database: the ONE fact the step reads from
// one - how many operators still have the published demo password, asked in REAL_PRODUCTION only
// (S99-01) - is answered "none" by `NO_DEMO_PASSWORD` in every mount below but the cases of S99-01.
import { chmodSync, readdirSync, statSync, writeFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { TEST_CAPTURE_HOST, testHostPrograms, testListingStandIns } from '../../../../test/support/capture-host';
import { unitTestConfig } from '../../../../test/support/config';
import type { ConfigInput } from '../../../config';
import { BootError, createReadiness } from '../../../plugins/readiness';
import { CaptureOperation } from '../../adapters/kinds';
import { createSystemTimers } from '../../timers';
import { hashPassword, type PasswordHashRecord } from '../../../modules/identity/password-hash';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { CAPTURE_BOOT_STEP, CAPTURE_WORKER_VERSION, CaptureBootError, CaptureBootRefusal, OPERATORS_UNREADABLE, SELECT_STORED_HASH_SETS, SIMULATED_WITHOUT_DEMO_CONTROLS, captureBootControl, mountCaptureBootChecks, storedDemoPasswordOperators, type CaptureBootControl } from '../index';
import { FIXTURE_NOW, realBootFixture, recordedSinks } from './support';
// Task 4 row 228 (check 4b-2): what its cases at the end of this file need.
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { PRODUCTION_KEY_UNIT_PREFIX, productionKeySubjectOf } from '../../../../cli/production-key-command';
import { parseInstallationDeviceId } from '../../../config';
import { captureOperationDecisionOf } from '../../fence/operation';
import { certificatePem, loadSoftwareSigner, provisionSigningKey, readSigningCertificate, type CertificateSubject } from '../../signer';
import { CaptureInstallationIdError, INSTALLATION_ID_NOT_TAKEN, InstallationBindingProblem, SIGNING_KEY_UNIT_PREFIX, organisationalUnitsOf, signingKeyInstallationProblemOf, storedSigningKeyReaders } from '../index';
import { FIXTURE_INSTALLATION_ID } from './support';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAPTURE_PROTOCOL_VERSION, CAPTURE_WORKER_SETTINGS, LIBAVFORMAT_VERSION_MISMATCH } from '@dems/capture-protocol';
import { captureWorkerArguments } from '../../worker-arguments';
import { EVIDENCE_STORE_PRIVATE_FOLDERS, evidenceStoreProblemOf, runCaptureBootChecks, type WorkerHandshake } from '../checks';
import { probeEvidenceVolume } from '../evidence-volume';
import { ALIAS_SOCKET_INSTALLED_PATH, CaptureHostFactsError, HOST_COMMAND_CHECKS, HOST_FACTS_NOT_TAKEN, HOST_NOT_SEEN, INTERFACE_FILE_COMMAND, PROGRAM_OWNERSHIP_CHECKS, SELECT_STORED_CAMERA_INTERFACE, captureHostOfProcess, coreFileLimitOf, storedCameraInterface, type CaptureBootHostFacts, type CaptureBootMount, type HostCommand } from '../index';
import { HOST_ANSWERS, PREPARED_INTERFACE, PROGRAM_ANSWERS, fakeProductionHost } from './host-support';
// Row NB (design 06 row N13): the mount's list of the two system listing programs, row N4's constants, the inspector and the rule.
import { SYSTEM_LISTING_PROGRAMS } from '../index';
import { workerProgramProblemOf } from '../checks';
import { inspectProgram, type ProgramFacts } from '../../adapters/local';
import { MACOS_SYSTEM_AUDIO_PROGRAM, MACOS_USB_TREE_PROGRAM } from '../../adapters/local/mic-helper-args';
// Audit 2026-11-05 row 88 (DF-02): the build stamp of the worker (check 5b), its reader and the fixture's stamp writer.
import { CAPTURE_WORKER_STAMP_SUFFIX, WORKER_STAMP_MAX_BYTES, WorkerBuildStampProblem, workerBuildStampOf, workerBuildStampProblemOf } from '../index';
import { fileSha256, workerStampText, writeWorkerStamp } from './support';

/**
 * Task 4 row 228b: THE INSTALLATION OF THIS SUITE - a synthetic id of its own, NOT one of the reserved ids, so that a
 * production mount of this file is not refused by check 4b-3. Every mount is handed it as its seam and every key
 * of the fixtures names it. The reserved test id (`FIXTURE_INSTALLATION_ID`) is what the test configuration carries.
 */
const SUITE_INSTALLATION_ID = 'DEMS-TEST-BOOT';
const TEST_INSTALLATION = Object.freeze({ installationId: SUITE_INSTALLATION_ID });
const fixture = realBootFixture('boot', SUITE_INSTALLATION_ID);
/** Task 4 row 85 (C46): the explicit TEST host of the mounts below, and its two stand-in programs in the fixture's own directory. */
// Bench-port seam 2026-11-04: the test host fakes `darwin` (the product's platform); on a Linux machine none of
// row N13's system programs exists on disk, so the fixture hands in two stand-ins - same rule, nothing started.
const TEST_HOST = { host: { ...TEST_CAPTURE_HOST, systemListingPrograms: testListingStandIns(fixture.dataDir) } };
const TEST_HOST_PROGRAMS = testHostPrograms(fixture.programsDir);
/** What a production start on the test host persists before the worker is asked: the host is not Linux, so the profile's questions were not asked (step 4d). */
const TEST_HOST_NOT_LINUX = { level: 'warn', source: 'capture.boot', code: 'CAPTURE_HOST_PROFILE_NOT_ASKED' };
/** The operators of these database-free apps: none has the published demo password. The S99-01 cases replace or drop it. */
const NO_DEMO_PASSWORD = { demoPasswordOperators: async (): Promise<number | null> => 0 };
afterAll(() => fixture.remove());

interface Mounted {
  readonly control: CaptureBootControl;
  readonly recorded: ReturnType<typeof recordedSinks>;
  boot(): Promise<void>;
  refusal(): Promise<CaptureBootError>;
}
function mounted(overrides: Partial<ConfigInput>, operators: { readonly demoPasswordOperators?: () => Promise<number | null> } = NO_DEMO_PASSWORD): Mounted {
  const recorded = recordedSinks();
  const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
  const app = { config: unitTestConfig({ dataDir: fixture.dataDir, ...TEST_HOST_PROGRAMS, ...overrides }), stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
  const control = mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000, ...TEST_HOST, ...TEST_INSTALLATION, ...operators });
  expect(captureBootControl(app)).toBe(control);
  const boot = (): Promise<void> => app.readiness.boot();
  return {
    control,
    recorded,
    boot,
    async refusal() {
      const failure = await boot().then(
        () => null,
        (error: unknown) => error,
      );
      if (!(failure instanceof BootError) || !(failure.cause instanceof CaptureBootError)) throw new Error('the boot was not refused by the capture boot checks');
      expect(failure.stepId).toBe(CAPTURE_BOOT_STEP);
      return failure.cause;
    },
  };
}

describe('the boot step, with nothing replaced', () => {
  it('SIMULATED (the default of every test app): passes with no worker, no media root and no key; nothing is created', async () => {
    const app = mounted({ dataDir: `${fixture.dataDir}/never-created` });
    expect(app.control.outcome()).toBeNull();
    await app.boot();
    expect(app.control.outcome()).toEqual({ operation: CaptureOperation.SIMULATED, label: SIMULATED_WITHOUT_DEMO_CONTROLS, workerVersion: null, evidenceVolume: null });
    expect(() => statSync(`${fixture.dataDir}/never-created`)).toThrow();
  });

  it('real, nothing configured: refused for the missing key', async () => {
    const failure = await mounted({ captureMode: 'real' }).refusal();
    expect(failure.code).toBe(CaptureBootRefusal.WORKER_NOT_CONFIGURED);
  });

  it('real with demo controls on: refused, whatever else is configured', async () => {
    const failure = await mounted({ captureMode: 'real', demoControls: true, captureWorkerPath: fixture.worker('worker-demo') }).refusal();
    expect([failure.code, failure.reason]).toEqual([CaptureBootRefusal.OPERATION_REFUSED, 'REAL_CAPTURE_WITH_DEMO_CONTROLS']);
  });

  it('real, a worker path that is not there, and one that others can write: refused by the path rule, on real files', async () => {
    expect((await mounted({ captureMode: 'real', captureWorkerPath: `${fixture.programsDir}/no-such-worker` }).refusal()).reason).toBe('NOT_FOUND');
    const loose = fixture.worker('worker-loose');
    chmodSync(loose, 0o777);
    expect((await mounted({ captureMode: 'real', captureWorkerPath: loose }).refusal()).reason).toBe('FILE_WRITABLE');
    const plain = fixture.worker('worker-plain');
    chmodSync(plain, 0o600);
    expect((await mounted({ captureMode: 'real', captureWorkerPath: plain }).refusal()).reason).toBe('NOT_EXECUTABLE');
  });

  it('real, a usable worker, no signing key yet: refused KEY_ABSENT, and the media root was probed and left empty', async () => {
    const failure = await mounted({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-nokey') }).refusal();
    expect([failure.code, failure.reason]).toEqual([CaptureBootRefusal.SIGNING_KEY_UNUSABLE, 'KEY_ABSENT']);
    expect(readdirSync(fixture.mediaStoreDir)).toEqual([]);
  });

  it('real, everything there: passes in both source classes; then a PROOF build of the same worker is refused at HELLO', async () => {
    fixture.provisionKey();
    for (const [captureDevSources, operation] of [[false, CaptureOperation.REAL_PRODUCTION], [true, CaptureOperation.REAL_DEVELOPMENT]] as const) {
      const app = mounted({ captureMode: 'real', captureDevSources, captureWorkerPath: fixture.worker('worker-good') });
      await app.boot();
      const outcome = app.control.outcome();
      expect(outcome).toMatchObject({ operation, label: null, workerVersion: CAPTURE_WORKER_VERSION });
      expect(outcome?.evidenceVolume?.totalBytes).toBeGreaterThan(1_000_000_000);
      expect(app.recorded.persisted).toEqual(operation === CaptureOperation.REAL_PRODUCTION ? [TEST_HOST_NOT_LINUX] : []);
    }
    const proof = mounted({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-proof', 'capture-worker/0.3.0-PROOF') });
    expect((await proof.refusal()).code).toBe(CaptureBootRefusal.WORKER_PROOF_BUILD);
    expect(proof.recorded.persisted).toEqual([TEST_HOST_NOT_LINUX, { level: 'error', source: 'capture.boot', code: CaptureBootRefusal.WORKER_PROOF_BUILD }]);
    // A program that is no worker at all, and a worker of another protocol version.
    const silent = `${fixture.programsDir}/worker-silent`;
    writeFileSync(silent, '#!/bin/sh\nexit 3\n', { mode: 0o700 });
    expect((await mounted({ captureMode: 'real', captureWorkerPath: silent }).refusal()).code).toBe(CaptureBootRefusal.WORKER_NO_HANDSHAKE);
    expect((await mounted({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-old', 'capture-worker/0.2.0', 2) }).refusal()).code).toBe(CaptureBootRefusal.WORKER_PROTOCOL_MISMATCH);
  });
});

// Batch N (security review row 99, finding S99-01 HIGH; ruling D241): the mounted step and its DEFAULT
// counter. The stored hash sets are real ones, derived here by the product's own hasher.
describe('S99-01: REAL_PRODUCTION does not start while an operator still has the published demo password', () => {
  const keyThere = (): void => {
    try {
      fixture.provisionKey();
    } catch {
      // KEY_EXISTS: it is there.
    }
  };
  const columns = (record: PasswordHashRecord) => ({ algorithm: record.algorithm, memory_kib: record.memoryKib, passes: record.passes, parallelism: record.parallelism, salt: record.salt, hash: record.hash });
  /** A database stand-in with ONE door, the read on the pool; it records the source and the statement it was asked. */
  const database = (rows: readonly object[] | Error) => {
    const asked: string[] = [];
    const db = {
      read: async (source: string, work: (pool: { query(text: string): Promise<{ rows: readonly object[] }> }) => Promise<unknown>) =>
        work({
          query: async (text) => {
            asked.push(`${source}: ${text}`);
            if (rows instanceof Error) throw rows;
            return { rows };
          },
        }),
    };
    return { asked, app: { db } as unknown as Parameters<typeof storedDemoPasswordOperators>[0] };
  };

  it('the default counter verifies each STORED hash set with the product verifier: 2 of 3 operators have the demo password; it returns the count only', async () => {
    const demo: string = DEMO_OPERATOR_PASSWORD;
    const stored = [await hashPassword(demo), await hashPassword(`${demo}-of-their-own`), await hashPassword(demo)];
    // Salted: the two demo sets differ as bytes, so a textual comparison of hashes would count nothing.
    expect(stored[0]?.hash.equals(stored[2]?.hash ?? Buffer.alloc(0))).toBe(false);
    const seeded = database(stored.map(columns));
    expect(await storedDemoPasswordOperators(seeded.app)).toBe(2);
    expect(seeded.asked).toEqual([`capture.boot.operators: ${SELECT_STORED_HASH_SETS}`]);
    expect(SELECT_STORED_HASH_SETS).toMatch(/^SELECT algorithm, memory_kib, passes, parallelism, salt, hash FROM public\.operator_credentials$/);
    // CONTROL: nobody has it; and no operator at all.
    expect(await storedDemoPasswordOperators(database([columns(stored[1] as PasswordHashRecord)]).app)).toBe(0);
    expect(await storedDemoPasswordOperators(database([]).app)).toBe(0);
  });

  it('FAIL CLOSED: a read that fails, a set that cannot be verified, or no database at all is null (never 0)', async () => {
    expect(await storedDemoPasswordOperators(database(new Error('connection refused')).app)).toBeNull();
    expect(await storedDemoPasswordOperators(database([{ algorithm: 'argon2id', memory_kib: 19_456, passes: 2, parallelism: 1, salt: Buffer.alloc(16), hash: Buffer.alloc(32) }]).app, async () => Promise.reject(new Error('derive failed')))).toBeNull();
    expect(await storedDemoPasswordOperators({} as never)).toBeNull();
  });

  it('the mounted step: REAL_PRODUCTION is refused by name with the count, and the stand-in worker was never started; REAL_DEVELOPMENT with the same operators boots', async () => {
    keyThere();
    const marker = `${fixture.dataDir}/worker-s99-started`;
    const worker = fixture.worker('worker-s99');
    writeFileSync(worker, `#!/bin/sh\n: > '${marker}'\n${readFileSync(worker, 'utf8').split('\n').slice(1).join('\n')}`, { mode: 0o700 });
    const twelve = { demoPasswordOperators: async (): Promise<number | null> => 12 };
    const production = mounted({ captureMode: 'real', captureWorkerPath: worker }, twelve);
    const failure = await production.refusal();
    expect([failure.code, failure.reason]).toEqual([CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, 'operators=12']);
    expect(production.recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION' }]);
    expect(production.recorded.lines.at(-1)?.fields).toEqual({ code: 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION', operation: CaptureOperation.REAL_PRODUCTION, reason: 'operators=12', operators: 12 });
    expect(production.control.outcome()).toBeNull();
    expect(() => statSync(marker)).toThrow();
    // CONTROL: the same operators under REAL_DEVELOPMENT - the step never asks, and this time the worker WAS started (the marker can appear).
    const development = mounted({ captureMode: 'real', captureDevSources: true, captureWorkerPath: worker }, twelve);
    await development.boot();
    expect(development.control.outcome()?.operation).toBe(CaptureOperation.REAL_DEVELOPMENT);
    expect(statSync(marker).isFile()).toBe(true);
  });

  it('the mounted step with NOTHING replaced and no database: REAL_PRODUCTION is refused OPERATORS_UNREADABLE (it does not pass on an app whose operators it cannot read)', async () => {
    keyThere();
    const failure = await mounted({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-s99-nodb') }, {}).refusal();
    expect([failure.code, failure.reason]).toEqual([CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, OPERATORS_UNREADABLE]);
  });
});

// Integration pass D10, item 3 (pass D6 item 7; register CS-09, second half): the figures the probe
// measured are handed to the engine's `applyStorageVolume` door by ONE statement of the boot step.
describe('CS-09: the measured evidence volume is handed over after the checks passed', () => {
  /** The signing key of the fixture: provisioned by the case above when the whole file runs, here when this block runs alone. */
  const keyThere = (): void => {
    try {
      fixture.provisionKey();
    } catch {
      // KEY_EXISTS: it is there.
    }
  };

  function mountedWithDoor(overrides: Partial<ConfigInput>, door: (volume: { readonly totalBytes: number; readonly freeBytes: number }) => Promise<unknown>) {
    const recorded = recordedSinks();
    const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
    const app = { config: unitTestConfig({ dataDir: fixture.dataDir, ...TEST_HOST_PROGRAMS, ...overrides }), stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
    const control = mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000, applyStorageVolume: door, ...TEST_HOST, ...TEST_INSTALLATION, ...NO_DEMO_PASSWORD });
    return { control, recorded, boot: (): Promise<void> => app.readiness.boot() };
  }

  it('a real boot hands over exactly what the probe measured, once; a simulated boot hands over nothing', async () => {
    keyThere();
    const handed: Array<{ totalBytes: number; freeBytes: number }> = [];
    const door = async (volume: { readonly totalBytes: number; readonly freeBytes: number }): Promise<void> => void handed.push({ ...volume });
    const real = mountedWithDoor({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-volume') }, door);
    await real.boot();
    const measured = real.control.outcome()?.evidenceVolume;
    expect(measured?.totalBytes).toBeGreaterThan(1_000_000_000);
    expect(handed).toEqual([{ totalBytes: measured?.totalBytes, freeBytes: measured?.freeBytes }]);
    expect(real.recorded.persisted).toEqual([TEST_HOST_NOT_LINUX]);

    // CONTROL: in SIMULATED nothing is measured, so the door is never called and the simulator's figures stay.
    const simulated = mountedWithDoor({}, door);
    await simulated.boot();
    expect(simulated.control.outcome()?.evidenceVolume).toBeNull();
    expect(handed).toHaveLength(1);
  });

  it('a hand-over that fails does not refuse the start: the checks passed; it is logged and persisted with a code', async () => {
    keyThere();
    const failing = mountedWithDoor({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-volume-2') }, async () => {
      throw new Error('the engine is not running');
    });
    await failing.boot();
    expect(failing.control.outcome()?.operation).toBe(CaptureOperation.REAL_PRODUCTION);
    expect(failing.recorded.persisted).toEqual([TEST_HOST_NOT_LINUX, { level: 'error', source: 'capture.boot', code: 'CAPTURE_BOOT_STORAGE_VOLUME_NOT_APPLIED' }]);
    expect(failing.recorded.lines.filter((line) => line.level === 'error')).toHaveLength(1);
  });
});

describe('gate 64 C7 and the owner-only folders: the boot probe of the worker (wave H, driver F)', () => {
  // Wave H, driver F - the boot side (gate 64 conditions C7 and row-96 note; rulings D194, D200).
  //
  //   item 1  a worker binary of another version passes NO boot: refused by name, saying expected and
  //           found; the boot probe starts the worker with the SAME arguments a session start passes,
  //           so a worker that does not accept one of them is refused at boot, not at the first session;
  //   item 5  the staging folder of the seal (`.sealing`) is held to the owner-only rule like
  //           `.quarantine` and `.transcriber`; the media-library and proof-build refusals still hold.
  //
  // The step is mounted with NOTHING replaced: the real path inspector, the real probe, the real key
  // store, the real process channel. The workers are stand-in shell scripts of the fixture's programs directory: they say
  // one line and record nothing.

  const fixture = realBootFixture('wave-h-f', SUITE_INSTALLATION_ID);
  fixture.provisionKey();
  const scratch = mkdtempSync(join(tmpdir(), 'dems-wave-h-f-volume-'));
  afterAll(() => {
    fixture.remove();
    rmSync(scratch, { recursive: true, force: true });
  });

  // Row 88: `seams` - members of the mount a case replaces (the stamp cases hand in an inspector; see there).
  function mounted(overrides: Partial<ConfigInput>, seams: Partial<CaptureBootMount> = {}) {
    const recorded = recordedSinks();
    const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
    const app = { config: unitTestConfig({ dataDir: fixture.dataDir, captureMode: 'real', ...TEST_HOST_PROGRAMS, ...overrides }), stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
    const control = mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000, ...TEST_HOST, ...TEST_INSTALLATION, ...NO_DEMO_PASSWORD, ...seams });
    return {
      control,
      recorded,
      boot: (): Promise<void> => app.readiness.boot(),
      async refusal(): Promise<CaptureBootError> {
        const failure = await app.readiness.boot().then(
          () => null,
          (error: unknown) => error,
        );
        if (!(failure instanceof BootError) || !(failure.cause instanceof CaptureBootError)) throw new Error('the boot was not refused by the capture boot checks');
        expect(failure.stepId).toBe(CAPTURE_BOOT_STEP);
        return failure.cause;
      },
    };
  }

  /** A stand-in worker as a shell script with a body of the test's own. */
  function script(name: string, body: string): string {
    const path = `${fixture.programsDir}/${name}`;
    writeFileSync(path, `#!/bin/sh\n${body}\n`, { mode: 0o700 });
    chmodSync(path, 0o700);
    // Row 88 (DF-02, check 5b): with the build stamp a build of this tree writes beside its program.
    writeWorkerStamp(path);
    return path;
  }
  const helloLine = (workerVersion: string): string => JSON.stringify({ v: CAPTURE_PROTOCOL_VERSION, type: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion });

  describe('item 1 (gate 64 C7): the boot takes ONE worker version, the one this Core was built to drive', () => {
    it('a scripted worker that answers capture-worker/0.4.0 is refused at boot by name, with expected and found; nothing passes', async () => {
      const app = mounted({ captureWorkerPath: fixture.workerSaying('worker-0-4-0', 'capture-worker/0.4.0') });
      const failure = await app.refusal();
      expect(failure.code).toBe('CAPTURE_WORKER_VERSION_MISMATCH');
      expect(failure.reason).toBe(`expected ${CAPTURE_WORKER_VERSION}, found capture-worker/0.4.0`);
      expect(failure.message).toContain('another version than the one this server was built to drive');
      expect(app.control.outcome()).toBeNull();
      // Logged and persisted like every refusal of the step: an operator finds it tomorrow.
      expect(app.recorded.persisted).toEqual([TEST_HOST_NOT_LINUX, { level: 'error', source: 'capture.boot', code: 'CAPTURE_WORKER_VERSION_MISMATCH' }]);
      expect(app.recorded.lines.find((line) => line.level === 'error')?.fields).toMatchObject({ code: 'CAPTURE_WORKER_VERSION_MISMATCH', reason: `expected ${CAPTURE_WORKER_VERSION}, found capture-worker/0.4.0` });
    });

    it('CONTROL: the built version boots; a NEWER release word is refused the same way', async () => {
      const built = mounted({ captureWorkerPath: fixture.workerSaying('worker-built', CAPTURE_WORKER_VERSION) });
      await built.boot();
      expect(built.control.outcome()).toMatchObject({ workerVersion: CAPTURE_WORKER_VERSION });
      expect((await mounted({ captureWorkerPath: fixture.workerSaying('worker-newer', 'capture-worker/9.0.0') }).refusal()).code).toBe(CaptureBootRefusal.WORKER_VERSION_MISMATCH);
    });

    it('BR-06: a worker that states exactly capture-worker/0.5.0 (the version before the rise to 0.6.0) is refused at boot by name, with expected and found; nothing passes', async () => {
      const app = mounted({ captureWorkerPath: fixture.workerSaying('worker-0-5-0', 'capture-worker/0.5.0') });
      const failure = await app.refusal();
      // A word of the release form that is not the built one: the rule refuses it as another version, not as an unknown word.
      expect(failure.code).toBe('CAPTURE_WORKER_VERSION_MISMATCH');
      expect(failure.reason).toBe(`expected ${CAPTURE_WORKER_VERSION}, found capture-worker/0.5.0`);
      expect(CAPTURE_WORKER_VERSION).not.toBe('capture-worker/0.5.0');
      expect(app.control.outcome()).toBeNull();
    });

    it('the order of the version rule: protocol, proof mark, release form, then THE version -a proof build of the built version stays a proof build', async () => {
      const answer = (hello: WorkerHandshake) => {
        const sinks = recordedSinks().sinks;
        return runCaptureBootChecks({
          decision: mounted({ captureWorkerPath: '/x' }).control.decision,
          workerProgram: '/x',
          inspect: () => ({ absolute: true, exists: true, regularFile: true, symbolicLink: false, file: { ownerUid: 501, mode: 0o755 }, directoriesAsWritten: [{ ownerUid: 0, mode: 0o755 }], directoriesResolved: [{ ownerUid: 0, mode: 0o755 }], serverUid: 501 }),
          probeEvidenceVolume: () => probeEvidenceVolume(join(scratch, 'order')),
          signingKeyProblem: () => null,
          signingKeyIsDevelopment: () => false,
          demoPasswordOperators: async () => 0,
          handshake: async () => hello,
          sinks,
        }).then(
          (outcome) => outcome.workerVersion,
          (error: unknown) => (error instanceof CaptureBootError ? error.code : String(error)),
        );
      };
      const hello = (workerVersion: string, protocolVersion = CAPTURE_PROTOCOL_VERSION): WorkerHandshake => ({ outcome: 'HELLO', protocolVersion, workerVersion });
      expect(await answer(hello(CAPTURE_WORKER_VERSION))).toBe(CAPTURE_WORKER_VERSION);
      expect(await answer(hello(`${CAPTURE_WORKER_VERSION}-PROOF`))).toBe(CaptureBootRefusal.WORKER_PROOF_BUILD);
      expect(await answer(hello('capture-worker/0.4.0-PROOF'))).toBe(CaptureBootRefusal.WORKER_PROOF_BUILD);
      expect(await answer(hello('capture-worker/0.4.0', CAPTURE_PROTOCOL_VERSION - 1))).toBe(CaptureBootRefusal.WORKER_PROTOCOL_MISMATCH);
      expect(await answer(hello('stub-worker'))).toBe(CaptureBootRefusal.WORKER_VERSION_UNKNOWN);
      expect(await answer(hello('capture-worker/0.4.0'))).toBe(CaptureBootRefusal.WORKER_VERSION_MISMATCH);
      // Item 5: the worker's own statement that its media library is not the verified one is still named.
      expect(await answer({ outcome: 'NONE', failure: 'MEDIA_LIBRARY_MISMATCH' })).toBe(CaptureBootRefusal.WORKER_MEDIA_LIBRARY_MISMATCH);
    });
  });

  // ── Audit 2026-11-05 row 88 (C-P0-1b, DF-02; D15(b), D38 DR-5/DR-6; register W5-W14) ─────────────────────────────
  // The mounted step reads `<DEMS_CAPTURE_WORKER>.stamp` (check 5b) with its DEFAULT reader on real files. The inspector
  // is the real one with ONE change: the directories on the way are reported as the server's own, owner-only. Reason:
  // on the audit host the directories above the fixture (the toolchain path) are group-writable, which fails the path
  // rule for EVERY stand-in of this file before any stamp is read (pre-existing, environmental: the cases of the
  // version rule above fail there with DIRECTORY_WRITABLE at HEAD too). The file facts - present, regular file, owner,
  // mode - stay the real ones, so a missing stamp IS missing and a stamp file is judged by the path rule as it is.
  describe('row 88: the build stamp beside the worker (check 5b), as mounted, on real files', () => {
    const ownDirectories = (path: string): ProgramFacts => {
      const facts = inspectProgram(path);
      const own = { ownerUid: facts.serverUid, mode: 0o700 };
      return facts.exists ? { ...facts, directoriesAsWritten: facts.directoriesAsWritten.map(() => own), directoriesResolved: facts.directoriesResolved.map(() => own) } : facts;
    };
    const SEAMS = { inspect: ownDirectories };
    const stale = async (program: string): Promise<CaptureBootError> => mounted({ captureWorkerPath: program }, SEAMS).refusal();

    it('the OLDER worker capture-worker/0.6.0 is refused at boot by its version, with expected and found - before its stamp is read (W14)', async () => {
      const older = fixture.workerSaying('worker-row88-0-6-0', 'capture-worker/0.6.0');
      // Its stamp names 0.6.0 as the stamp of that build would: the version rule refuses first, by name.
      writeWorkerStamp(older, workerStampText({ workerVersion: 'capture-worker/0.6.0', binarySha256: fileSha256(older) }));
      const app = mounted({ captureWorkerPath: older }, SEAMS);
      const failure = await app.refusal();
      expect([failure.code, failure.reason]).toEqual(['CAPTURE_WORKER_VERSION_MISMATCH', 'expected capture-worker/0.7.0, found capture-worker/0.6.0']);
      expect(app.control.outcome()).toBeNull();
    });

    it('CONTROL: THE version with the stamp its build wrote boots REAL_PRODUCTION; the same program without a stamp boots REAL_DEVELOPMENT (DR-6: production only)', async () => {
      const built = fixture.worker('worker-row88-built');
      expect(workerBuildStampProblemOf(built, SEAMS)).toBeNull();
      const production = mounted({ captureWorkerPath: built }, SEAMS);
      await production.boot();
      expect(production.control.outcome()).toMatchObject({ operation: CaptureOperation.REAL_PRODUCTION, workerVersion: CAPTURE_WORKER_VERSION });
      const unstamped = fixture.worker('worker-row88-dev');
      rmSync(`${unstamped}${CAPTURE_WORKER_STAMP_SUFFIX}`);
      const development = mounted({ captureWorkerPath: unstamped, captureDevSources: true }, SEAMS);
      await development.boot();
      expect(development.control.outcome()).toMatchObject({ operation: CaptureOperation.REAL_DEVELOPMENT, workerVersion: CAPTURE_WORKER_VERSION });
    });

    it('a STALE stamp is refused at boot by CAPTURE_WORKER_BUILD_STAMP_STALE, one word per case; logged and persisted; no path, byte of the stamp or hash is said', async () => {
      const cases: Array<readonly [string, WorkerBuildStampProblem, (program: string) => void]> = [
        ['no stamp', WorkerBuildStampProblem.MISSING, (program) => rmSync(`${program}.stamp`)],
        ['the program replaced after its stamp (same version word, other bytes)', WorkerBuildStampProblem.BINARY_MISMATCH, (program) => writeFileSync(program, `${readFileSync(program, 'utf8')}# another build\n`)],
        ['a stamp of the older version beside THE version', WorkerBuildStampProblem.VERSION_MISMATCH, (program) => writeWorkerStamp(program, workerStampText({ workerVersion: 'capture-worker/0.6.0', binarySha256: fileSha256(program) }))],
        ['a stamp of another protocol', WorkerBuildStampProblem.PROTOCOL_MISMATCH, (program) => writeWorkerStamp(program, workerStampText({ protocolVersion: CAPTURE_PROTOCOL_VERSION + 1, binarySha256: fileSha256(program) }))],
        ['a stamp with CR LF line ends', WorkerBuildStampProblem.UNREADABLE, (program) => writeWorkerStamp(program, workerStampText({ binarySha256: fileSha256(program) }).replaceAll('\n', '\r\n'))],
        ['a stamp the group may write', WorkerBuildStampProblem.UNREADABLE, (program) => chmodSync(`${program}.stamp`, 0o620)],
      ];
      for (const [title, word, spoil] of cases) {
        const program = fixture.worker(`worker-row88-${word.toLowerCase()}-${cases.findIndex(([named]) => named === title)}`);
        spoil(program);
        const app = mounted({ captureWorkerPath: program }, SEAMS);
        const failure = await app.refusal();
        expect([failure.code, failure.reason], title).toEqual(['CAPTURE_WORKER_BUILD_STAMP_STALE', word]);
        expect(app.control.outcome(), title).toBeNull();
        expect(app.recorded.persisted.at(-1), title).toEqual({ level: 'error', source: 'capture.boot', code: 'CAPTURE_WORKER_BUILD_STAMP_STALE' });
        expect(app.recorded.lines.find((line) => line.level === 'error')?.fields, title).toEqual({ code: 'CAPTURE_WORKER_BUILD_STAMP_STALE', operation: CaptureOperation.REAL_PRODUCTION, reason: word });
        expect(failure.message, title).toContain('does not match its build stamp (<program>.stamp)');
        expect(failure.message, title).not.toContain(fixture.programsDir);
        expect(failure.message, title).not.toMatch(/[0-9a-f]{64}/);
      }
      // The same programs boot REAL_DEVELOPMENT: the check is the production boot's (D38 DR-6).
      const development = fixture.worker('worker-row88-dev-missing');
      rmSync(`${development}.stamp`);
      await mounted({ captureWorkerPath: development, captureDevSources: true }, SEAMS).boot();
      expect(await stale(development).then((failure) => failure.reason)).toBe(WorkerBuildStampProblem.MISSING);
    });

    it('the reader (W8): exactly four key=value lines in order, ASCII, LF ends, 64 lowercase hex; anything else is UNREADABLE; the bound is one byte past the stamp', () => {
      const good = workerStampText({ binarySha256: 'a'.repeat(64) });
      const bytes = (text: string) => new TextEncoder().encode(text);
      expect(workerBuildStampOf(bytes(good))).toEqual({ workerVersion: CAPTURE_WORKER_VERSION, protocolVersion: CAPTURE_PROTOCOL_VERSION, sourceSha256: '0'.repeat(64), binarySha256: 'a'.repeat(64) });
      for (const [title, text] of [
        ['no final LF', good.slice(0, -1)],
        ['CR LF', good.replaceAll('\n', '\r\n')],
        ['a fifth line', `${good}extra=1\n`],
        ['the keys out of order', good.split('\n').slice(0, 4).reverse().join('\n') + '\n'],
        ['an upper-case hash', good.replace('a'.repeat(64), 'A'.repeat(64))],
        ['a short hash', good.replace('a'.repeat(64), 'a'.repeat(63))],
        ['protocol 05', good.replace(`protocolVersion=${CAPTURE_PROTOCOL_VERSION}`, `protocolVersion=0${CAPTURE_PROTOCOL_VERSION}`)],
        ['a key with a space', good.replace('workerVersion=', 'workerVersion =')],
        ['a non-ASCII byte', good.replace('capture-worker', 'capture\u00e9worker')],
        ['empty', ''],
        ['too long', `${good}${'#'.repeat(WORKER_STAMP_MAX_BYTES)}`],
      ] as const) {
        expect(workerBuildStampOf(bytes(text)), title).toBeNull();
      }
    });

    it('the reader on real files: MISSING, then the path rule, then the words, then the program; a program that cannot be read whole is a BINARY_MISMATCH (fail closed)', () => {
      const program = fixture.worker('worker-row88-reader');
      expect(workerBuildStampProblemOf(program, SEAMS)).toBeNull();
      expect(workerBuildStampProblemOf(program, { ...SEAMS, readWhole: () => null })).toBe(WorkerBuildStampProblem.BINARY_MISMATCH);
      expect(workerBuildStampProblemOf(program, { ...SEAMS, readHead: () => null })).toBe(WorkerBuildStampProblem.UNREADABLE);
      expect(workerBuildStampProblemOf(`${program}-absent`, SEAMS)).toBe(WorkerBuildStampProblem.MISSING);
      // A stamp that is a directory is no stamp file: the path rule refuses it.
      const folder = fixture.worker('worker-row88-folder');
      rmSync(`${folder}.stamp`);
      mkdirSync(`${folder}.stamp`, { mode: 0o700 });
      expect(workerBuildStampProblemOf(folder, SEAMS)).toBe(WorkerBuildStampProblem.UNREADABLE);
    });
  });

  describe('item 1 (gate 64 C7): the boot probe starts the worker with the arguments of a session start', () => {
    it('the probe passes every named setting of a session start (--max-fragment-bytes among them); only the log file differs', async () => {
      const seen = `${fixture.dataDir}/probe-arguments.txt`;
      const worker = script('worker-writes-arguments', `printf '%s\\n' "$@" > '${seen}'\nprintf '%s\\n' '${helloLine(CAPTURE_WORKER_VERSION)}'\nexec /bin/cat > /dev/null`);
      await mounted({ captureWorkerPath: worker }).boot();
      const probe = readFileSync(seen, 'utf8').trimEnd().split('\n');
      const session = captureWorkerArguments(`${fixture.dataDir}/capture-worker.jsonl`);
      expect(probe).toContain('--max-fragment-bytes');
      for (const rule of Object.values(CAPTURE_WORKER_SETTINGS)) expect(probe, rule.argument).toContain(rule.argument);
      // The same words in the same order, except the value of --log: the probe never writes into the session log.
      expect(probe.length).toBe(session.length);
      expect(probe.map((word, index) => (session[index - 1] === '--log' ? '<log>' : word))).toEqual(session.map((word, index) => (session[index - 1] === '--log' ? '<log>' : word)));
      expect(probe[probe.indexOf('--log') + 1]).toBe(`${fixture.dataDir}/capture-worker-boot.jsonl`);
    });

    it('a worker that does not accept an argument of a session start (the 0.4.0 argument reader: usage, exit 64) is refused AT BOOT', async () => {
      // What `capture-worker/0.4.0` does with `--max-fragment-bytes`: its argument reader ends with the usage text before any HELLO.
      const old = script(
        'worker-unknown-argument',
        `for word in "$@"; do case "$word" in --max-fragment-bytes) echo 'usage: capture-worker --log <file> --heartbeat-ms <n>' >&2; exit 64;; esac; done\nprintf '%s\\n' '${helloLine('capture-worker/0.4.0')}'\nexec /bin/cat > /dev/null`,
      );
      const failure = await mounted({ captureWorkerPath: old }).refusal();
      expect(failure.code).toBe(CaptureBootRefusal.WORKER_NO_HANDSHAKE);
      expect(failure.reason).toBe('EXITED');
    });

    it('a worker on another media library is refused by name through the real channel as well (item 5)', async () => {
      const crash = JSON.stringify({ v: CAPTURE_PROTOCOL_VERSION, sessionId: null, type: 'CRASH', code: LIBAVFORMAT_VERSION_MISMATCH, signal: null, exitCode: 70 });
      const failure = await mounted({ captureWorkerPath: script('worker-lavf', `printf '%s\\n' '${crash}'\nexit 70`) }).refusal();
      expect(failure.code).toBe(CaptureBootRefusal.WORKER_MEDIA_LIBRARY_MISMATCH);
    });
  });

  describe('item 5: the owner-only folders of the evidence store', () => {
    it('the list: the staging folder of the seal is in it, beside the quarantine and the transcriber scratch', () => {
      expect(Object.keys(EVIDENCE_STORE_PRIVATE_FOLDERS).sort()).toEqual(['.quarantine', '.sealing', '.transcriber', '.transcriber/sessions']);
    });

    it('.sealing with a bit for group or others is refused by name; after chmod 700 the store is accepted (control); the probe changed nothing', () => {
      const root = join(scratch, 'open');
      mkdirSync(join(root, '.sealing'), { recursive: true, mode: 0o700 });
      chmodSync(root, 0o700);
      chmodSync(join(root, '.sealing'), 0o750);
      expect(evidenceStoreProblemOf(probeEvidenceVolume(root))).toBe('SEALING_STAGING_READABLE_BY_OTHERS');
      chmodSync(join(root, '.sealing'), 0o700);
      expect(evidenceStoreProblemOf(probeEvidenceVolume(root))).toBeNull();
    });

    it('.sealing that is a LINK to another folder is refused (never followed)', () => {
      const root = join(scratch, 'linked');
      const elsewhere = join(scratch, 'elsewhere');
      mkdirSync(root, { mode: 0o700 });
      mkdirSync(elsewhere, { mode: 0o700 });
      symlinkSync(elsewhere, join(root, '.sealing'));
      expect(evidenceStoreProblemOf(probeEvidenceVolume(root))).toBe('SEALING_STAGING_READABLE_BY_OTHERS');
    });

    it('a store whose .sealing is open stops the boot of a real Core: CAPTURE_EVIDENCE_STORE_UNUSABLE with that reason', async () => {
      const mediaStoreDir = `${fixture.dataDir}/media-open/sessions`;
      mkdirSync(`${mediaStoreDir}/.sealing`, { recursive: true, mode: 0o700 });
      chmodSync(mediaStoreDir, 0o700);
      chmodSync(`${mediaStoreDir}/.sealing`, 0o755);
      const failure = await mounted({ mediaStoreDir, captureWorkerPath: fixture.worker('worker-store') }).refusal();
      expect(failure.code).toBe(CaptureBootRefusal.EVIDENCE_STORE_UNUSABLE);
      expect(failure.reason).toBe('SEALING_STAGING_READABLE_BY_OTHERS');
      expect(failure.message).toContain('.sealing');
    });
  });
});

// Task 4 row 81 (WP-20): THE WIRING row 80 left. The mount hands the host facts it is given to steps 4d
// and 4e, with the two program paths of the configuration and the stored camera interface. Everything
// but the host is real here, as in the cases above: the path inspector, the media root, the key store,
// the stand-in worker. The host is the double of `host-support.ts`: its runner starts nothing.
describe('row 81: the mount hands the host facts to the boot checks - a REAL_PRODUCTION start runs the host checks and the checks of the delivered programs', () => {
  const keyThere = (): void => {
    try {
      fixture.provisionKey();
    } catch {
      // KEY_EXISTS: it is there.
    }
  };
  const same = (a: HostCommand, b: HostCommand): boolean => a.program === b.program && a.args.join(' ') === b.args.join(' ');
  const hostCodeOf = (command: HostCommand): string | undefined => HOST_COMMAND_CHECKS.find((check) => same(check.command, command))?.code;

  interface OnHost {
    readonly app: Mounted;
    /** Every question the runner was asked. */
    readonly asked: string[];
    readonly relay: string;
    readonly reads: () => number;
  }
  /** A mounted app on a prepared Linux production host: relay and guard are stand-in files of the fixture (they pass the REAL path rule). */
  function onHost(overrides: Partial<ConfigInput>, options: { readonly platform?: string; readonly hostAnswers?: Parameters<typeof fakeProductionHost>[0]['answers']; readonly programAnswers?: Parameters<typeof fakeProductionHost>[0]['programAnswers']; readonly stored?: string | null; readonly coreFileLimit?: () => number | null; readonly relay?: string | null } = {}): OnHost {
    keyThere();
    const relay = options.relay === undefined ? fixture.worker('relay-stand-in') : options.relay;
    const guard = fixture.worker('guard-stand-in');
    const programKeyOf = (command: HostCommand): string | undefined => (command.program === relay && command.args.length === 0 ? 'RELAY' : same(command, INTERFACE_FILE_COMMAND) ? 'INTERFACE' : PROGRAM_OWNERSHIP_CHECKS.find((check) => same(check.command, command))?.code);
    const host = fakeProductionHost({
      codeOf: hostCodeOf,
      programKeyOf,
      ...(options.platform === undefined ? {} : { platform: options.platform }),
      ...(options.hostAnswers === undefined ? {} : { answers: options.hostAnswers }),
      ...(options.programAnswers === undefined ? {} : { programAnswers: options.programAnswers }),
      ...(options.coreFileLimit === undefined ? {} : { coreFileLimit: options.coreFileLimit }),
    });
    // What the entry point hands in: the facts of the process and the runner. NO program path: the mount adds the configuration's.
    // Bench-port seam 2026-11-04: this bed's test host fakes `darwin`, which has no /usr/sbin/ioreg on a Linux
    // machine - the two microphone-listing stand-ins of the shared seam stand in for row N13's pair (same rule, nothing started).
    const facts: CaptureBootHostFacts = { platform: host.deps.platform, coreFileLimit: host.deps.coreFileLimit, startArguments: host.deps.startArguments, nodeOptionsSet: host.deps.nodeOptionsSet, run: host.deps.run, systemListingPrograms: testListingStandIns(fixture.dataDir) };
    let reads = 0;
    const recorded = recordedSinks();
    const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
    const app = { config: unitTestConfig({ dataDir: fixture.dataDir, captureMode: 'real', captureRelayPath: relay, captureGuardPath: guard, ...overrides }), stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
    const mount: CaptureBootMount = {
      sinks: recorded.sinks,
      timers: createSystemTimers(),
      helloTimeoutMs: 3_000,
      ...NO_DEMO_PASSWORD,
      ...TEST_INSTALLATION,
      host: facts,
      storedCameraInterface: async () => ((reads += 1), options.stored === undefined ? PREPARED_INTERFACE : options.stored),
    };
    const control = mountCaptureBootChecks(app, mount);
    const boot = (): Promise<void> => app.readiness.boot();
    const mountedApp: Mounted = {
      control,
      recorded,
      boot,
      async refusal() {
        const failure = await boot().then(
          () => null,
          (error: unknown) => error,
        );
        if (!(failure instanceof BootError) || !(failure.cause instanceof CaptureBootError)) throw new Error('the boot was not refused by the capture boot checks');
        return failure.cause;
      },
    };
    return { app: mountedApp, asked: host.asked, relay: relay ?? '', reads: () => reads };
  }

  it('REAL_PRODUCTION on a prepared host boots: every question of both tables was asked, the relay was asked by the path of the configuration, and the three lines are said', async () => {
    const prepared = onHost({ captureWorkerPath: fixture.worker('worker-host-1') });
    await prepared.app.boot();
    expect(prepared.app.control.outcome()).toMatchObject({ operation: CaptureOperation.REAL_PRODUCTION, workerVersion: CAPTURE_WORKER_VERSION });
    expect(prepared.asked).toHaveLength(HOST_COMMAND_CHECKS.length + 4);
    expect(prepared.asked[HOST_COMMAND_CHECKS.length]).toBe(prepared.relay);
    expect(prepared.reads()).toBe(1);
    expect(prepared.app.recorded.lines.map((line) => line.fields['code'])).toEqual(['CAPTURE_HOST_CHECKS_PASSED', 'CAPTURE_PROGRAM_CHECKS_PASSED', 'CAPTURE_BOOT_CHECKS_PASSED']);
  });

  it('a prerequisite of the host that is missing stops the REAL_PRODUCTION start by its own code (BR-12: the loopback rule), and so does a relay that is not configured', async () => {
    const answer = HOST_ANSWERS['CAPTURE_HOST_LOOPBACK_RULE_MISSING']?.absent[0]?.answer;
    if (answer === undefined) throw new Error('no answer');
    const unprepared = onHost({ captureWorkerPath: fixture.worker('worker-host-2') }, { hostAnswers: { CAPTURE_HOST_LOOPBACK_RULE_MISSING: answer } });
    const failure = await unprepared.app.refusal();
    expect([failure.code, failure.reason]).toEqual(['CAPTURE_HOST_LOOPBACK_RULE_MISSING', 'RULE_UNIT_NOT_ACTIVE']);
    expect(unprepared.app.control.outcome()).toBeNull();
    // The configuration's own path is what the mount hands on: no relay configured is refused by name, before any question.
    const noRelay = onHost({ captureWorkerPath: fixture.worker('worker-host-3') }, { relay: null });
    expect([(await noRelay.app.refusal()).code, noRelay.asked]).toEqual(['CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE', []]);
    const limited = onHost({ captureWorkerPath: fixture.worker('worker-host-4') }, { coreFileLimit: () => 8_192 });
    expect([(await limited.app.refusal()).code, (await onHost({ captureWorkerPath: fixture.worker('worker-host-5') }, { coreFileLimit: () => 8_192 }).app.refusal()).reason]).toEqual(['CAPTURE_HOST_CORE_FILE_LIMIT', 'LIMIT_ABOVE_ZERO']);
  });

  it('a delivered program that fails stops the start by its own code: a relay on another media library, and the interface file against the stored row (the named mismatch)', async () => {
    const library = PROGRAM_ANSWERS['RELAY']?.absent[0]?.answer;
    const other = PROGRAM_ANSWERS['INTERFACE']?.absent[1]?.answer;
    if (library === undefined || other === undefined) throw new Error('no answer');
    const relay = await onHost({ captureWorkerPath: fixture.worker('worker-host-6') }, { programAnswers: { RELAY: library } }).app.refusal();
    expect([relay.code, relay.reason]).toEqual(['CAPTURE_HOST_RELAY_LIBRARY_UNVERIFIED', 'RELAY_LIBRARY_VERSION_MISMATCH']);
    const file = onHost({ captureWorkerPath: fixture.worker('worker-host-7') }, { programAnswers: { INTERFACE: other } });
    const mismatch = await file.app.refusal();
    expect([mismatch.code, mismatch.reason]).toEqual(['CAPTURE_HOST_INTERFACE_FILE_MISMATCH', 'INTERFACE_FILE_DIFFERS_FROM_ROW']);
    expect(file.app.recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: 'CAPTURE_HOST_INTERFACE_FILE_MISMATCH' }]);
    // The row names another interface than the file: the same refusal from the stored side.
    const row = await onHost({ captureWorkerPath: fixture.worker('worker-host-8') }, { stored: 'enp9s0' }).app.refusal();
    expect([row.code, row.reason]).toEqual(['CAPTURE_HOST_INTERFACE_FILE_MISMATCH', 'INTERFACE_FILE_DIFFERS_FROM_ROW']);
  });

  it('REAL_DEVELOPMENT and SIMULATED run none of it on the SAME unprepared host: no question, no read of the stored row, the outcome and the lines of before', async () => {
    const wrong = { coreFileLimit: () => Infinity, hostAnswers: Object.fromEntries(HOST_COMMAND_CHECKS.map((check) => [check.code, { outcome: 'NOT_STARTED' } as const])), programAnswers: Object.fromEntries(Object.keys(PROGRAM_ANSWERS).map((key) => [key, { outcome: 'NOT_STARTED' } as const])), relay: null } as const;
    const development = onHost({ captureDevSources: true, captureWorkerPath: fixture.worker('worker-host-9') }, wrong);
    await development.app.boot();
    expect(development.app.control.outcome()).toMatchObject({ operation: CaptureOperation.REAL_DEVELOPMENT, workerVersion: CAPTURE_WORKER_VERSION });
    expect([development.asked, development.reads()]).toEqual([[], 0]);
    expect(development.app.recorded.lines.map((line) => line.fields['code'])).toEqual(['CAPTURE_BOOT_CHECKS_PASSED']);
    const simulated = onHost({ captureMode: 'simulated' }, wrong);
    await simulated.app.boot();
    expect(simulated.app.control.outcome()).toEqual({ operation: CaptureOperation.SIMULATED, label: SIMULATED_WITHOUT_DEMO_CONTROLS, workerVersion: null, evidenceVolume: null });
    expect([simulated.asked, simulated.reads()]).toEqual([[], 0]);
    expect(simulated.app.recorded.lines.filter((line) => /HOST|PROGRAM/.test(String(line.fields['code'])))).toEqual([]);
  });

  // Task 4 row 85 (decision C46; review finding F-07). Until row 85 this case read "a mount that is handed NO host
  // facts runs neither step in REAL_PRODUCTION" and expected the start to PASS: the fail-open the review named. Turned.
  /** A mount with NOTHING handed in but the sinks and the operators: no seam `host`, as the capture unit mounts it. */
  const bare = (overrides: Partial<ConfigInput>) => {
    const recorded = recordedSinks();
    const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
    const app = { config: unitTestConfig({ dataDir: fixture.dataDir, ...overrides }), stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
    const control = mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000, ...TEST_INSTALLATION, ...NO_DEMO_PASSWORD });
    const refusal = (): Promise<unknown> =>
      app.readiness.boot().then(
        () => null,
        (error: unknown) => (error instanceof BootError ? error.cause : error),
      );
    return { control, recorded, refusal, boot: (): Promise<void> => app.readiness.boot() };
  };

  it('C46: a mount that is handed NO host facts is a host that cannot be seen - a REAL_PRODUCTION start is REFUSED by step 4d, after checks 1 to 4c, and the worker is not started; the two other operations never ask', async () => {
    keyThere();
    const plain = bare({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-host-10'), ...TEST_HOST_PROGRAMS });
    // RE-STATED by row HC (decision C55 DD-2): until then this start was refused `CAPTURE_HOST_CORE_FILE_LIMIT` / `LIMIT_UNREADABLE` -
    // the code of a limit nobody had read. A Core that was handed NO facts now says exactly that, by a code of its own, at the same place.
    expect(await plain.refusal()).toMatchObject({ code: 'CAPTURE_HOST_FACTS_NOT_HANDED_IN', reason: 'NO_HOST_FACTS' });
    expect(plain.control.outcome()).toBeNull();
    expect(plain.recorded.lines.map((line) => [line.level, line.fields['code']])).toEqual([['error', 'CAPTURE_HOST_FACTS_NOT_HANDED_IN']]);
    expect(plain.recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: 'CAPTURE_HOST_FACTS_NOT_HANDED_IN' }]);
    // Facts that WERE handed in and whose limit cannot be read keep the code of the limit (C46): the new code is for "none" alone.
    const unreadable = bare({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-host-hc-1'), ...TEST_HOST_PROGRAMS });
    unreadable.control.provideHost({ ...TEST_CAPTURE_HOST, coreFileLimit: () => null });
    expect(await unreadable.refusal()).toMatchObject({ code: 'CAPTURE_HOST_CORE_FILE_LIMIT', reason: 'LIMIT_UNREADABLE' });
    // The order of before: a check of 1 to 4c that fails is still the one named (here: no worker program).
    expect(await bare({ captureMode: 'real' }).refusal()).toMatchObject({ code: CaptureBootRefusal.WORKER_NOT_CONFIGURED });
    // REAL_DEVELOPMENT and SIMULATED: nothing is asked of the host, with no facts at all.
    const development = bare({ captureMode: 'real', captureDevSources: true, captureWorkerPath: fixture.worker('worker-host-12') });
    await development.boot();
    expect(development.control.outcome()?.operation).toBe(CaptureOperation.REAL_DEVELOPMENT);
    const simulated = bare({});
    await simulated.boot();
    expect(simulated.control.outcome()?.operation).toBe(CaptureOperation.SIMULATED);
    expect([...development.recorded.lines, ...simulated.recorded.lines].filter((line) => /HOST|PROGRAM/.test(String(line.fields['code'])))).toEqual([]);
  });

  it('C46: the facts go through ONE door, once, before the boot steps - `provideHost`; with the test host a production start runs BOTH steps and passes; a second hand-over and one after the step are refused', async () => {
    keyThere();
    const provided = bare({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-host-13'), ...TEST_HOST_PROGRAMS });
    provided.control.provideHost({ ...TEST_CAPTURE_HOST, systemListingPrograms: testListingStandIns(fixture.dataDir) }); // bench-port seam 2026-11-04: the faked darwin host needs the listing pair as stand-ins
    expect(() => provided.control.provideHost(TEST_CAPTURE_HOST)).toThrow(CaptureHostFactsError);
    await provided.boot();
    expect(provided.control.outcome()?.operation).toBe(CaptureOperation.REAL_PRODUCTION);
    // Step 4d (off Linux: the process's own facts and the two programs, the profile's questions not asked), then step 4e, then the worker.
    expect(provided.recorded.lines.map((line) => line.fields['code'])).toEqual(['CAPTURE_HOST_PROFILE_NOT_ASKED', 'CAPTURE_PROGRAM_CHECKS_PASSED', 'CAPTURE_BOOT_CHECKS_PASSED']);
    expect(() => provided.control.provideHost(TEST_CAPTURE_HOST)).toThrow(/handed in once/);
    // A mount that was given the seam takes no second host; a hand-over after the step asked is refused even when none was given.
    const seamed = mounted({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-host-14') });
    expect(() => seamed.control.provideHost(TEST_CAPTURE_HOST)).toThrow(expect.objectContaining({ code: HOST_FACTS_NOT_TAKEN, reason: 'ALREADY_PROVIDED' }));
    const late = bare({});
    await late.boot();
    expect(() => late.control.provideHost(TEST_CAPTURE_HOST)).toThrow(expect.objectContaining({ code: HOST_FACTS_NOT_TAKEN, reason: 'ALREADY_ASKED' }));
    // The host that cannot be seen has nothing in place, and its runner starts nothing.
    expect([HOST_NOT_SEEN.coreFileLimit(), HOST_NOT_SEEN.nodeOptionsSet, await HOST_NOT_SEEN.run({ program: '/usr/bin/id', args: ['-nG'] })]).toEqual([null, true, { outcome: 'NOT_STARTED' }]);
  });

  // Task 4 row HC (decision C53 (4c), R119-10): the mount hands the CONFIGURED socket path of the address helper to check 4d-3.
  it('row HC, C53 (4c): the mounted step refuses a configured DEMS_CAPTURE_ALIAS_SOCKET that is not the installed path, by its own code; unset and the installed path start; REAL_DEVELOPMENT never asks', async () => {
    keyThere();
    const started = (captureAliasSocketPath: string | null, name: string, development = false) => {
      const app = bare({ captureMode: 'real', captureWorkerPath: fixture.worker(name), ...TEST_HOST_PROGRAMS, captureAliasSocketPath, ...(development ? { captureDevSources: true } : {}) });
      app.control.provideHost({ ...TEST_CAPTURE_HOST, systemListingPrograms: testListingStandIns(fixture.dataDir) }); // bench-port seam 2026-11-04
      return app;
    };
    const other = started(`${fixture.dataDir}/netalias.socket`, 'worker-host-hc-2');
    expect(await other.refusal()).toMatchObject({ code: 'CAPTURE_HOST_ALIAS_SOCKET_PATH', reason: 'CONFIGURED_PATH_NOT_THE_INSTALLED_ONE' });
    expect(other.control.outcome()).toBeNull();
    // The test host is not Linux: step 4d's warning has its row first, then the refusal of check 4d-3.
    expect(other.recorded.persisted.map((entry) => [entry.level, entry.code])).toEqual([['warn', 'CAPTURE_HOST_PROFILE_NOT_ASKED'], ['error', 'CAPTURE_HOST_ALIAS_SOCKET_PATH']]);
    expect(JSON.stringify(other.recorded.lines)).not.toContain(fixture.dataDir);
    for (const [path, name] of [[null, 'worker-host-hc-3'], [ALIAS_SOCKET_INSTALLED_PATH, 'worker-host-hc-4']] as const) {
      const same = started(path, name);
      await same.boot();
      expect(same.control.outcome()?.operation, String(path)).toBe(CaptureOperation.REAL_PRODUCTION);
    }
    expect(ALIAS_SOCKET_INSTALLED_PATH).toBe('/run/dems-core-netalias/socket');
    const development = started(`${fixture.dataDir}/netalias.socket`, 'worker-host-hc-5', true);
    await development.boot();
    expect(development.control.outcome()?.operation).toBe(CaptureOperation.REAL_DEVELOPMENT);
  });

  it('C46: THE ENTRY POINT\'S OWN FACTS (`captureHostOfProcess`) on a production Core WITHOUT a relay program - the start is refused CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE / NOT_SET; without a guard, the guard\'s code; the limit is read from the runtime\'s statement, fail closed', async () => {
    keyThere();
    const started: string[] = [];
    // The four facts the entry point states of its process (a clean one), and timers that are never needed: no question is asked before the refusal.
    const own = { platform: 'linux', startArguments: [], nodeOptionsSet: false, userLimits: () => ({ core_file_size_blocks: { soft: 0, hard: 'unlimited' } }) };
    const facts = captureHostOfProcess(own, { after: () => () => {}, every: () => () => {} } as unknown as Parameters<typeof captureHostOfProcess>[1]);
    const watched: CaptureBootHostFacts = { ...facts, run: async (command) => (started.push(command.program), { outcome: 'NOT_STARTED' }) };
    const noRelay = bare({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-host-15') });
    noRelay.control.provideHost(watched);
    expect(await noRelay.refusal()).toMatchObject({ code: 'CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE', reason: 'NOT_SET' });
    expect(noRelay.recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: 'CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE' }]);
    const noGuard = bare({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-host-16'), captureRelayPath: TEST_HOST_PROGRAMS.captureRelayPath });
    noGuard.control.provideHost(watched);
    expect(await noGuard.refusal()).toMatchObject({ code: 'CAPTURE_HOST_GUARD_PROGRAM_UNUSABLE', reason: 'NOT_SET' });
    // Nothing was asked of the host and no worker was started: the refusal comes first.
    expect(started).toEqual([]);
    expect([noRelay.control.outcome(), noGuard.control.outcome()]).toEqual([null, null]);
    // The limit: one value of the runtime's own statement; anything else is "not readable", which the check refuses.
    expect([coreFileLimitOf({ core_file_size_blocks: { soft: 0 } }), coreFileLimitOf({ core_file_size_blocks: { soft: 'unlimited' } }), coreFileLimitOf({ core_file_size_blocks: { soft: 4096 } })]).toEqual([0, Number.POSITIVE_INFINITY, 4096]);
    for (const unreadable of [undefined, null, 'x', {}, { core_file_size_blocks: null }, { core_file_size_blocks: { soft: '0' } }, { core_file_size_blocks: { soft: -1 } }, { core_file_size_blocks: { soft: Number.NaN } }]) expect(coreFileLimitOf(unreadable), JSON.stringify(unreadable)).toBeNull();
    expect(facts.coreFileLimit()).toBe(0);
    expect(captureHostOfProcess({ ...own, userLimits: () => { throw new Error('no report'); } }, {} as never).coreFileLimit()).toBeNull();
    const limited = bare({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-host-17'), ...TEST_HOST_PROGRAMS });
    limited.control.provideHost({ ...watched, coreFileLimit: () => coreFileLimitOf({ core_file_size_blocks: { soft: 'unlimited' } }) });
    expect(await limited.refusal()).toMatchObject({ code: 'CAPTURE_HOST_CORE_FILE_LIMIT', reason: 'LIMIT_ABOVE_ZERO' });
  });

  it('the default reader of the stored camera interface: ONE statement on the pool, the name of the one row; no row and no name are null; a read that fails REJECTS (the check then refuses)', async () => {
    const database = (rows: readonly object[] | Error) => {
      const asked: string[] = [];
      const db = {
        read: async (source: string, work: (pool: { query(text: string): Promise<{ rows: readonly object[] }> }) => Promise<unknown>) =>
          work({
            query: async (text) => {
              asked.push(`${source}: ${text}`);
              if (rows instanceof Error) throw rows;
              return { rows };
            },
          }),
      };
      return { asked, app: { db } as unknown as Parameters<typeof storedCameraInterface>[0] };
    };
    const stored = database([{ interface_name: 'enp3s0' }]);
    expect(await storedCameraInterface(stored.app)).toBe('enp3s0');
    expect(stored.asked).toEqual([`capture.boot.camera-interface: ${SELECT_STORED_CAMERA_INTERFACE}`]);
    expect(SELECT_STORED_CAMERA_INTERFACE).toBe('SELECT interface_name FROM public.capture_network_config');
    expect(await storedCameraInterface(database([]).app)).toBeNull();
    expect(await storedCameraInterface(database([{ interface_name: null }]).app)).toBeNull();
    await expect(storedCameraInterface(database(new Error('connection refused')).app)).rejects.toThrow();
    await expect(storedCameraInterface(database([{ interface_name: 'a' }, { interface_name: 'b' }]).app)).rejects.toThrow();
    await expect(storedCameraInterface({} as never)).rejects.toThrow();
  });

  it('with NOTHING replaced and no database, the stored interface cannot be read: a REAL_PRODUCTION start on a prepared Linux host is refused INTERFACE_ROW_UNREADABLE (fail closed)', async () => {
    keyThere();
    const relay = fixture.worker('relay-stand-in-nodb');
    const programKeyOf = (command: HostCommand): string | undefined => (command.program === relay && command.args.length === 0 ? 'RELAY' : same(command, INTERFACE_FILE_COMMAND) ? 'INTERFACE' : PROGRAM_OWNERSHIP_CHECKS.find((check) => same(check.command, command))?.code);
    const host = fakeProductionHost({ codeOf: hostCodeOf, programKeyOf });
    const recorded = recordedSinks();
    const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
    const app = { config: unitTestConfig({ dataDir: fixture.dataDir, captureMode: 'real', captureWorkerPath: fixture.worker('worker-host-11'), captureRelayPath: relay, captureGuardPath: fixture.worker('guard-stand-in-nodb') }), stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
    mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000, ...TEST_INSTALLATION, ...NO_DEMO_PASSWORD, host: { platform: 'linux', coreFileLimit: () => 0, startArguments: [], nodeOptionsSet: false, run: host.deps.run } });
    const failure = await app.readiness.boot().then(
      () => null,
      (error: unknown) => (error instanceof BootError ? error.cause : error),
    );
    expect(failure).toMatchObject({ code: 'CAPTURE_HOST_INTERFACE_FILE_MISMATCH', reason: 'INTERFACE_ROW_UNREADABLE' });
  });
});

// ── Task 4 row 228 (X1-5; SX-10; UD-4; caution C-4 of the as-built security review): check 4b-2 ─────────────────
// EVERY KEY BELOW IS MADE BY THE TEST: a store in a temporary directory of its own that the case removes (never
// the fixture of row 61, never below the repository's data directory), or a key pair that exists in memory only.
// Nothing prints or stores key material. The worker and the two host programs are the stand-ins of the fixture.
describe('row 228, check 4b-2: the active certificate of a production Core names its installation', () => {
  const MISMATCH = CaptureBootRefusal.SIGNING_KEY_INSTALLATION_MISMATCH;
  const scratch: string[] = [];
  afterAll(() => {
    for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
    expect(scratch).toEqual([]);
  });
  /** A data directory of this case alone, with a key store whose certificate has `subject` (absent: the store's default subject). */
  const storeWith = (subject?: Partial<CertificateSubject>): string => {
    const dataDir = mkdtempSync(join(tmpdir(), 'dems-row228-'));
    scratch.push(dataDir);
    provisionSigningKey({ dir: join(dataDir, 'signer'), now: FIXTURE_NOW, ...(subject === undefined ? {} : { subject }) });
    return dataDir;
  };
  const unitOf = (installationId: string): string => `${SIGNING_KEY_UNIT_PREFIX} ${installationId}`;
  /** The step as the capture unit mounts it - the real inspector, probe, key store and process channel - over a store of the case. */
  const core = (dataDir: string, seams: Partial<CaptureBootMount> = TEST_INSTALLATION, overrides: Partial<ConfigInput> = {}) => {
    const recorded = recordedSinks();
    const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
    const config = unitTestConfig({ dataDir, mediaStoreDir: fixture.mediaStoreDir, captureMode: 'real', captureWorkerPath: fixture.worker('worker-row228'), ...TEST_HOST_PROGRAMS, ...overrides });
    const app = { config, stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
    const control = mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000, ...TEST_HOST, ...NO_DEMO_PASSWORD, ...seams });
    const boot = (): Promise<void> => app.readiness.boot();
    const refusal = (): Promise<[string, string | null]> =>
      boot().then(
        () => ['NOT REFUSED', null],
        (error: unknown) => {
          const cause = error instanceof BootError ? error.cause : error;
          if (!(cause instanceof CaptureBootError)) throw error;
          return [cause.code, cause.reason];
        },
      );
    return { control, recorded, boot, refusal };
  };

  it('the fixture and the test configuration name ONE installation, and the check reads the prefix the key command writes', () => {
    // Row 228b: the test configuration carries the RESERVED test id (the fixture's default); this suite's mounts carry their own.
    expect(unitTestConfig({}).installationDeviceId).toBe(FIXTURE_INSTALLATION_ID);
    expect(SUITE_INSTALLATION_ID).not.toBe(FIXTURE_INSTALLATION_ID);
    expect(SIGNING_KEY_UNIT_PREFIX).toBe(PRODUCTION_KEY_UNIT_PREFIX);
    expect(productionKeySubjectOf('Example Unit', SUITE_INSTALLATION_ID)).toBe(`CN=CORE-KEY-EVSIGN-01,OU=${unitOf(SUITE_INSTALLATION_ID)},O=Example Unit`);
  });

  it('a certificate whose WHOLE unit is `Evidence signing <configured id>` boots REAL_PRODUCTION; the same store under another configured id is refused', async () => {
    const dataDir = storeWith({ organization: 'Example Unit', organizationalUnit: unitOf(SUITE_INSTALLATION_ID) });
    const matching = core(dataDir);
    await matching.boot();
    expect(matching.control.outcome()).toMatchObject({ operation: CaptureOperation.REAL_PRODUCTION, workerVersion: CAPTURE_WORKER_VERSION });
    // The installation was RENAMED: the old key no longer starts it (the way out is a rotation to a key with the new name).
    expect(await core(dataDir, { installationId: 'DEMS-JKT-07' }).refusal()).toEqual([MISMATCH, 'OTHER_INSTALLATION']);
  });

  it('C-4: a key of ANOTHER installation and a key with the store\'s DEFAULT subject (a test-made key) are refused by the named code; nothing of the certificate or the id is logged', async () => {
    const other = core(storeWith({ organizationalUnit: unitOf('DEMS-JKT-07') }));
    expect(await other.refusal()).toEqual([MISMATCH, 'OTHER_INSTALLATION']);
    expect(other.recorded.lines).toEqual([{ level: 'error', fields: { code: MISMATCH, operation: 'REAL_PRODUCTION', reason: 'OTHER_INSTALLATION' }, message: 'the capture boot checks refuse this start: the server does not start' }]);
    expect(other.recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: MISMATCH }]);
    expect(JSON.stringify(other.recorded)).not.toMatch(/DEMS-JKT-07|DEMS-TEST-01|DEMS-TEST-BOOT/);
    // The default subject of the store: the unit is `Evidence signing` and names no installation. Before row 228 such a key passed checks 4 and 4b.
    const defaulted = storeWith();
    expect(organisationalUnitsOf(loadSoftwareSigner({ dir: join(defaulted, 'signer'), now: FIXTURE_NOW }).certificate.pemText)).toEqual([SIGNING_KEY_UNIT_PREFIX]);
    expect(await core(defaulted).refusal()).toEqual([MISMATCH, 'OTHER_INSTALLATION']);
  });

  it('an id that only CONTAINS the configured one, or is contained in it, is refused: the comparison is of the whole unit', async () => {
    for (const unit of [unitOf(`${SUITE_INSTALLATION_ID}1`), unitOf(`X${SUITE_INSTALLATION_ID}`), unitOf(SUITE_INSTALLATION_ID.slice(0, -1)), `${unitOf(SUITE_INSTALLATION_ID)} `, ` ${unitOf(SUITE_INSTALLATION_ID)}`, `${SIGNING_KEY_UNIT_PREFIX}  ${SUITE_INSTALLATION_ID}`, unitOf(SUITE_INSTALLATION_ID).toLowerCase(), SUITE_INSTALLATION_ID]) {
      expect(await core(storeWith({ organizationalUnit: unit })).refusal(), unit).toEqual([MISMATCH, 'OTHER_INSTALLATION']);
    }
    // And the other way round: the configured id is a part of the certificate's.
    expect(await core(storeWith({ organizationalUnit: unitOf(SUITE_INSTALLATION_ID) }), { installationId: SUITE_INSTALLATION_ID.slice(0, -1) }).refusal()).toEqual([MISMATCH, 'OTHER_INSTALLATION']);
  });

  it('CRAFTED: the matching text inside ANOTHER attribute (organisation, common name) does not match - the subject TEXT holds it, the parsed unit does not', async () => {
    const wanted = unitOf(SUITE_INSTALLATION_ID);
    const smuggled = storeWith({ organization: `Example,OU=${wanted}`, organizationalUnit: unitOf('DEMS-JKT-07') });
    const loaded = loadSoftwareSigner({ dir: join(smuggled, 'signer'), now: FIXTURE_NOW }).certificate;
    expect(loaded.subject).toContain(`OU=${wanted}`);
    expect(organisationalUnitsOf(loaded.pemText)).toEqual([unitOf('DEMS-JKT-07')]);
    expect(await core(smuggled).refusal()).toEqual([MISMATCH, 'OTHER_INSTALLATION']);
    // A unit that CONTINUES after the id with distinguished-name syntax: one attribute, and not the whole text.
    expect(await core(storeWith({ organizationalUnit: `${wanted},O=Example Unit` })).refusal()).toEqual([MISMATCH, 'OTHER_INSTALLATION']);
    expect(await core(storeWith({ organizationalUnit: `${wanted}+OU=${wanted}` })).refusal()).toEqual([MISMATCH, 'OTHER_INSTALLATION']);
    // A unit that is not plain visible ASCII is not read at all (the command of row 206 types ASCII only).
    expect(await core(storeWith({ organizationalUnit: `${wanted}\n` })).refusal()).toEqual([MISMATCH, 'SUBJECT_UNREADABLE']);
    expect(await core(storeWith({ organizationalUnit: `Evidence signing DEMS-TEST-0١` })).refusal()).toEqual([MISMATCH, 'SUBJECT_UNREADABLE']);
  });

  it('CRAFTED: a configured id with distinguished-name syntax is never compared - even a certificate that repeats it byte for byte is refused', async () => {
    for (const crafted of ['DEMS-TEST-01,O=X', 'A=B', 'DEMS TEST', 'dems-test-01', 'DEMS-TEST-01\n', 'DEMS+01', `D${'A'.repeat(32)}`, '1DEMS']) {
      expect(() => parseInstallationDeviceId(crafted), crafted).toThrow();
      expect(signingKeyInstallationProblemOf([unitOf(crafted)], crafted), crafted).toBe(InstallationBindingProblem.INSTALLATION_ID_FORM);
    }
    // The form is the configuration's: what it takes, the rule compares.
    for (const taken of ['D', 'DEMS-JKT-07', `D${'A'.repeat(31)}`]) {
      expect(parseInstallationDeviceId(taken)).toBe(taken);
      expect(signingKeyInstallationProblemOf([unitOf(taken)], taken), taken).toBeNull();
    }
    expect(await core(storeWith({ organizationalUnit: unitOf('DEMS-TEST-01,O=X') }), { installationId: 'DEMS-TEST-01,O=X' }).refusal()).toEqual([MISMATCH, 'INSTALLATION_ID_FORM']);
  });

  /** A minimal DER writer of this test, for certificates the store's own writer cannot make (no unit, two units, a unit in a set of two). */
  const tlv = (tag: number, ...parts: readonly Uint8Array[]): Buffer => {
    const body = Buffer.concat(parts);
    const size = body.length < 0x80 ? [body.length] : body.length < 0x100 ? [0x81, body.length] : [0x82, body.length >> 8, body.length & 0xff];
    return Buffer.concat([Buffer.from([tag, ...size]), body]);
  };
  const TYPE = { organisation: [0x55, 0x04, 0x0a], unit: [0x55, 0x04, 0x0b], commonName: [0x55, 0x04, 0x03] } as const;
  const attribute = (type: readonly number[], text: string, tag = 0x0c): Buffer => tlv(0x30, tlv(0x06, Buffer.from(type)), tlv(tag, Buffer.from(text, 'utf8')));
  const one = (type: readonly number[], text: string, tag?: number): Buffer => tlv(0x31, attribute(type, text, tag));
  /** A self-signed Ed25519 certificate whose subject is `names`, signed by a key pair that never leaves this function; read back by the store's public reader. */
  const certificateOf = (names: readonly Buffer[]) => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const algorithm = tlv(0x30, tlv(0x06, Buffer.from([0x2b, 0x65, 0x70])));
    const name = tlv(0x30, ...names);
    const instant = (text: string): Buffer => tlv(0x17, Buffer.from(text, 'ascii'));
    const signed = tlv(0x30, tlv(0xa0, tlv(0x02, Buffer.from([0x02]))), tlv(0x02, Buffer.from([0x41, ...randomBytes(8)])), algorithm, name, tlv(0x30, instant('251001000000Z'), instant('351001000000Z')), name, publicKey.export({ format: 'der', type: 'spki' }));
    return readSigningCertificate(certificatePem(tlv(0x30, signed, algorithm, tlv(0x03, Buffer.from([0]), sign(null, signed, privateKey)))), 'TEST-KEY-ROW228');
  };
  /** The REAL decision over the readers of the mounted step, with a loader that hands back `certificate` and counts. */
  const decided = async (certificate: ReturnType<typeof certificateOf>, installationId: string | null = SUITE_INSTALLATION_ID): Promise<{ readonly answer: [string, string | null]; readonly loads: number }> => {
    let loads = 0;
    const readers = storedSigningKeyReaders(() => ((loads += 1), { certificate }) as ReturnType<typeof loadSoftwareSigner>);
    const answer = await runCaptureBootChecks({
      decision: captureOperationDecisionOf({ captureMode: 'real', demoControls: false, captureDevSources: false, host: '127.0.0.1' }),
      workerProgram: '/opt/dems/capture-worker',
      inspect: () => ({ absolute: true, exists: true, regularFile: true, symbolicLink: false, file: { ownerUid: 501, mode: 0o755 }, directoriesAsWritten: [{ ownerUid: 0, mode: 0o755 }], directoriesResolved: [{ ownerUid: 0, mode: 0o755 }], serverUid: 501 }),
      probeEvidenceVolume: () => ({ absolute: true, present: true, directory: true, ownerUid: 501, mode: 0o700, serverUid: 501, exclusiveCreate: true, exclusiveRefusesSecond: true, synced: true, hardLink: true, linkRefusesExisting: true, cleaned: true, totalBytes: 1, freeBytes: 1 }),
      signingKeyProblem: () => readers.problem('/nowhere/signer', FIXTURE_NOW),
      signingKeyIsDevelopment: () => readers.isDevelopment('/nowhere/signer', FIXTURE_NOW),
      signingKeyInstallationProblem: () => signingKeyInstallationProblemOf(readers.organisationalUnits('/nowhere/signer', FIXTURE_NOW), installationId),
      demoPasswordOperators: async () => 0,
      handshake: async () => ({ outcome: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: CAPTURE_WORKER_VERSION }),
      sinks: recordedSinks().sinks,
    }).then(
      (): [string, string | null] => ['PASSED', null],
      (error: unknown): [string, string | null] => {
        if (!(error instanceof CaptureBootError)) throw error;
        return [error.code, error.reason];
      },
    );
    return { answer, loads };
  };

  it('C-4: a key whose certificate has NO organisational unit is refused by the named code; checks 4, 4b and 4b-2 judged ONE loaded certificate', async () => {
    const wanted = unitOf(SUITE_INSTALLATION_ID);
    const none = certificateOf([one(TYPE.organisation, 'Example Unit'), one(TYPE.commonName, 'TEST-KEY-ROW228')]);
    expect(organisationalUnitsOf(none.pemText)).toEqual([]);
    expect(await decided(none)).toEqual({ answer: [MISMATCH, 'NO_ORGANISATIONAL_UNIT'], loads: 1 });
    // CONTROL of the hand-made certificate: with the right unit the same construction passes every check, on one load.
    const right = certificateOf([one(TYPE.organisation, 'Example Unit'), one(TYPE.unit, wanted), one(TYPE.commonName, 'TEST-KEY-ROW228')]);
    expect(organisationalUnitsOf(right.pemText)).toEqual([wanted]);
    expect(await decided(right)).toEqual({ answer: ['PASSED', null], loads: 1 });
    expect(await decided(certificateOf([one(TYPE.unit, wanted, 0x13)]))).toEqual({ answer: ['PASSED', null], loads: 1 });
    // No id handed in, and an id that is not configured: nothing a certificate could equal.
    expect((await decided(right, null)).answer).toEqual([MISMATCH, 'INSTALLATION_ID_NOT_KNOWN']);
    expect(signingKeyInstallationProblemOf([wanted], undefined)).toBe('INSTALLATION_ID_NOT_KNOWN');
    expect(signingKeyInstallationProblemOf([wanted], '')).toBe('INSTALLATION_ID_NOT_KNOWN');
  });

  it('CRAFTED: two units of which one matches, a unit beside another attribute in one set, a unit of another string type, and bytes that are no certificate are refused', async () => {
    const wanted = unitOf(SUITE_INSTALLATION_ID);
    const twice = certificateOf([one(TYPE.unit, unitOf('DEMS-JKT-07')), one(TYPE.unit, wanted), one(TYPE.commonName, 'K')]);
    expect(organisationalUnitsOf(twice.pemText)).toEqual([unitOf('DEMS-JKT-07'), wanted]);
    expect((await decided(twice)).answer).toEqual([MISMATCH, 'SEVERAL_ORGANISATIONAL_UNITS']);
    expect((await decided(certificateOf([one(TYPE.unit, wanted), one(TYPE.unit, wanted)]))).answer).toEqual([MISMATCH, 'SEVERAL_ORGANISATIONAL_UNITS']);
    // One set with two attributes: the unit is still ONE parsed value and is compared as a whole; two units in one set are two.
    const together = certificateOf([tlv(0x31, attribute(TYPE.commonName, 'K'), attribute(TYPE.unit, unitOf('DEMS-JKT-07')))]);
    expect((await decided(together)).answer).toEqual([MISMATCH, 'OTHER_INSTALLATION']);
    expect((await decided(certificateOf([tlv(0x31, attribute(TYPE.unit, unitOf('DEMS-JKT-07')), attribute(TYPE.unit, wanted))]))).answer).toEqual([MISMATCH, 'SEVERAL_ORGANISATIONAL_UNITS']);
    // A unit written as an IA5 string (not one of the two types the reader takes) is not read as text at all.
    expect((await decided(certificateOf([one(TYPE.unit, wanted, 0x16)]))).answer).toEqual([MISMATCH, 'SUBJECT_UNREADABLE']);
    for (const text of ['', 'not a certificate', '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n', certificatePem(Buffer.from([0x30, 0x84, 0xff, 0xff, 0xff, 0xff])), certificatePem(Buffer.from([0x30, 0x80, 0x00, 0x00]))]) {
      expect(organisationalUnitsOf(text), text).toBeNull();
      expect(signingKeyInstallationProblemOf(organisationalUnitsOf(text), SUITE_INSTALLATION_ID)).toBe('SUBJECT_UNREADABLE');
    }
    // A store that does not load answers no units: fail closed (check 4 has refused such a start before).
    const unloadable = storedSigningKeyReaders(() => {
      throw new Error('a text of the operating system');
    });
    expect(unloadable.organisationalUnits('/nowhere/signer', FIXTURE_NOW)).toBeNull();
  });

  it('REAL_DEVELOPMENT and SIMULATED never ask: a key of another installation, and no id at all, start as before', async () => {
    const other = storeWith({ organizationalUnit: unitOf('DEMS-JKT-07') });
    const development = core(other, {}, { captureDevSources: true });
    await development.boot();
    expect(development.control.outcome()).toMatchObject({ operation: CaptureOperation.REAL_DEVELOPMENT });
    const simulated = core(other, {}, { captureMode: 'simulated', captureWorkerPath: null });
    await simulated.boot();
    expect(simulated.control.outcome()).toMatchObject({ operation: CaptureOperation.SIMULATED });
  });

  it('THE DOOR: the id is handed in once, before the boot steps; without it - or with none configured - a production start is refused INSTALLATION_ID_NOT_KNOWN', async () => {
    const dataDir = storeWith({ organizationalUnit: unitOf(SUITE_INSTALLATION_ID) });
    // As the capture unit mounts it: no seam. Nobody handed the id in.
    expect(await core(dataDir, {}).refusal()).toEqual([MISMATCH, 'INSTALLATION_ID_NOT_KNOWN']);
    // The unit that holds the identity says "none is configured".
    const unconfigured = core(dataDir, {});
    unconfigured.control.provideInstallationId(null);
    expect(await unconfigured.refusal()).toEqual([MISMATCH, 'INSTALLATION_ID_NOT_KNOWN']);
    // Handed in through the door: the start passes; a second hand-over and one after the step ran are refused.
    const provided = core(dataDir, {});
    provided.control.provideInstallationId(SUITE_INSTALLATION_ID);
    expect(() => provided.control.provideInstallationId('DEMS-JKT-07')).toThrow(CaptureInstallationIdError);
    await provided.boot();
    expect(provided.control.outcome()).toMatchObject({ operation: CaptureOperation.REAL_PRODUCTION });
    const late = ((): unknown => {
      try {
        provided.control.provideInstallationId(SUITE_INSTALLATION_ID);
        return null;
      } catch (error) {
        return error;
      }
    })();
    expect(late).toMatchObject({ code: INSTALLATION_ID_NOT_TAKEN, reason: 'ALREADY_ASKED' });
    // A mount that was given the seam does not take a second id either, and an id handed in as null is not replaced.
    expect(() => core(dataDir).control.provideInstallationId('DEMS-JKT-07')).toThrow(expect.objectContaining({ code: INSTALLATION_ID_NOT_TAKEN, reason: 'ALREADY_PROVIDED' }));
    expect(() => unconfigured.control.provideInstallationId(SUITE_INSTALLATION_ID)).toThrow(CaptureInstallationIdError);
  });

  it('a mount whose key is a SEAM and that hands in no units reads the real store for them - and is refused when there is none (no seam passes by default)', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'dems-row228-'));
    scratch.push(empty);
    expect(await core(empty, { ...TEST_INSTALLATION, signingKeyProblem: () => null, signingKeyIsDevelopment: () => false }).refusal()).toEqual([MISMATCH, 'SUBJECT_UNREADABLE']);
    const seamed = core(empty, { ...TEST_INSTALLATION, signingKeyProblem: () => null, signingKeyIsDevelopment: () => false, signingKeyUnits: () => [unitOf(SUITE_INSTALLATION_ID)] });
    await seamed.boot();
    expect(seamed.control.outcome()).toMatchObject({ operation: CaptureOperation.REAL_PRODUCTION });
  });
});

// ── Task 4 row NB (design 06 revision 3 row N13; decision C135 (1)): THE MOUNT hands step 4e the two system programs of the macOS
// microphone listing. Only their PATH FACTS are read (a stand-in inspector for the failing case; the real inspector for this Mac's
// own programs, metadata only). Nothing is started for them, no listing is run, no device is opened.
describe('row NB: the mount hands step 4e the two system programs of the microphone listing, by row N4\'s constants; on darwin a program that fails the path rule refuses the start before the worker', () => {
  it('the list is the two literals of row N4\'s table, in its order, frozen; a production boot on the darwin test host whose second program fails the rule is refused by its own code, the first having been inspected', async () => {
    expect(SYSTEM_LISTING_PROGRAMS).toEqual([MACOS_USB_TREE_PROGRAM, MACOS_SYSTEM_AUDIO_PROGRAM]);
    expect(Object.isFrozen(SYSTEM_LISTING_PROGRAMS)).toBe(true);
    try {
      fixture.provisionKey();
    } catch {
      // KEY_EXISTS: it is there.
    }
    const inspected: string[] = [];
    const recorded = recordedSinks();
    const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
    const app = { config: unitTestConfig({ dataDir: fixture.dataDir, captureMode: 'real', captureWorkerPath: fixture.worker('worker-nb-1'), ...TEST_HOST_PROGRAMS }), stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
    // The real inspector for every other path. The two listing programs are answered by the REAL facts of a stand-in file of the
    // fixture (so the case holds on any machine), the second one with its mode made writable by others.
    const standIn = inspectProgram(fixture.worker('listing-stand-in'));
    const inspect = (path: string): ProgramFacts => (inspected.push(path), path === MACOS_SYSTEM_AUDIO_PROGRAM ? { ...standIn, file: { ownerUid: 0, mode: 0o777 } } : path === MACOS_USB_TREE_PROGRAM ? standIn : inspectProgram(path));
    // Bench-port seam 2026-11-04: THIS case judges row N4's REAL pair - the stand-ins of the suite's test host are
    // overridden back to the literals; the `inspect` above answers their facts, so nothing is read from the machine.
    mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000, ...TEST_INSTALLATION, ...NO_DEMO_PASSWORD, ...TEST_HOST, host: { ...TEST_CAPTURE_HOST, systemListingPrograms: SYSTEM_LISTING_PROGRAMS }, inspect });
    const failure = await app.readiness.boot().then(
      () => null,
      (error: unknown) => (error instanceof BootError ? error.cause : error),
    );
    expect(failure).toMatchObject({ code: 'CAPTURE_HOST_LISTING_PROGRAM_UNUSABLE', reason: 'FILE_WRITABLE' });
    expect(inspected.filter((path) => (SYSTEM_LISTING_PROGRAMS as readonly string[]).includes(path))).toEqual([...SYSTEM_LISTING_PROGRAMS]);
    expect(recorded.persisted).toEqual([TEST_HOST_NOT_LINUX, { level: 'error', source: 'capture.boot', code: 'CAPTURE_HOST_LISTING_PROGRAM_UNUSABLE' }]);
  });

  it.runIf(process.platform === 'darwin')('on this Mac the two programs of the operating system pass the worker\'s path rule by their REAL facts (design 06 M11: root, mode 755, root\'s directories)', () => {
    for (const program of SYSTEM_LISTING_PROGRAMS) expect(workerProgramProblemOf(program, inspectProgram), program).toBeNull();
  });
});
