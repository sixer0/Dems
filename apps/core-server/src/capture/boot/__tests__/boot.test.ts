// The boot step `capture.boot` as mounted (blueprint row 61; check M3-BC-1): the readiness runner,
// the control, and the DEFAULT wiring - the real path inspector, the real probe of the media root,
// the real key store and the real process channel - on a fixture below `.data/`. The worker is a
// stand-in shell script that says one HELLO (no capture worker is started here: that is
// `worker-probe.real.ts`, a check for the test runner). No database: the ONE fact the step reads from
// one - how many operators still have the published demo password, asked in REAL_PRODUCTION only
// (S99-01) - is answered "none" by `NO_DEMO_PASSWORD` in every mount below but the cases of S99-01.
import { chmodSync, readdirSync, statSync, writeFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { unitTestConfig } from '../../../../test/support/config';
import type { ConfigInput } from '../../../config';
import { BootError, createReadiness } from '../../../plugins/readiness';
import { CaptureOperation } from '../../adapters/kinds';
import { createSystemTimers } from '../../timers';
import { hashPassword, type PasswordHashRecord } from '../../../modules/identity/password-hash';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { CAPTURE_BOOT_STEP, CAPTURE_WORKER_VERSION, CaptureBootError, CaptureBootRefusal, OPERATORS_UNREADABLE, SELECT_STORED_HASH_SETS, SIMULATED_WITHOUT_DEMO_CONTROLS, captureBootControl, mountCaptureBootChecks, storedDemoPasswordOperators, type CaptureBootControl } from '../index';
import { FIXTURE_NOW, realBootFixture, recordedSinks } from './support';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAPTURE_PROTOCOL_VERSION, CAPTURE_WORKER_SETTINGS, LIBAVFORMAT_VERSION_MISMATCH } from '@dems/capture-protocol';
import { captureWorkerArguments } from '../../worker-arguments';
import { EVIDENCE_STORE_PRIVATE_FOLDERS, evidenceStoreProblemOf, runCaptureBootChecks, type WorkerHandshake } from '../checks';
import { probeEvidenceVolume } from '../evidence-volume';

const fixture = realBootFixture('boot');
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
  const app = { config: unitTestConfig({ dataDir: fixture.dataDir, ...overrides }), stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
  const control = mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000, ...operators });
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
    expect((await mounted({ captureMode: 'real', captureWorkerPath: `${fixture.dataDir}/no-such-worker` }).refusal()).reason).toBe('NOT_FOUND');
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
      expect(app.recorded.persisted).toEqual([]);
    }
    const proof = mounted({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-proof', 'capture-worker/0.3.0-PROOF') });
    expect((await proof.refusal()).code).toBe(CaptureBootRefusal.WORKER_PROOF_BUILD);
    expect(proof.recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: CaptureBootRefusal.WORKER_PROOF_BUILD }]);
    // A program that is no worker at all, and a worker of another protocol version.
    const silent = `${fixture.dataDir}/worker-silent`;
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
    const app = { config: unitTestConfig({ dataDir: fixture.dataDir, ...overrides }), stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
    const control = mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000, applyStorageVolume: door, ...NO_DEMO_PASSWORD });
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
    expect(real.recorded.persisted).toEqual([]);

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
    expect(failing.recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: 'CAPTURE_BOOT_STORAGE_VOLUME_NOT_APPLIED' }]);
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
  // store, the real process channel. The workers are stand-in shell scripts below `.data/`: they say
  // one line and record nothing.

  const fixture = realBootFixture('wave-h-f');
  fixture.provisionKey();
  const scratch = mkdtempSync(join(tmpdir(), 'dems-wave-h-f-volume-'));
  afterAll(() => {
    fixture.remove();
    rmSync(scratch, { recursive: true, force: true });
  });

  function mounted(overrides: Partial<ConfigInput>) {
    const recorded = recordedSinks();
    const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
    const app = { config: unitTestConfig({ dataDir: fixture.dataDir, captureMode: 'real', ...overrides }), stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
    const control = mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000, ...NO_DEMO_PASSWORD });
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
    const path = `${fixture.dataDir}/${name}`;
    writeFileSync(path, `#!/bin/sh\n${body}\n`, { mode: 0o700 });
    chmodSync(path, 0o700);
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
      expect(app.recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: 'CAPTURE_WORKER_VERSION_MISMATCH' }]);
      expect(app.recorded.lines.find((line) => line.level === 'error')?.fields).toMatchObject({ code: 'CAPTURE_WORKER_VERSION_MISMATCH', reason: `expected ${CAPTURE_WORKER_VERSION}, found capture-worker/0.4.0` });
    });

    it('CONTROL: the built version boots; a NEWER release word is refused the same way', async () => {
      const built = mounted({ captureWorkerPath: fixture.workerSaying('worker-built', CAPTURE_WORKER_VERSION) });
      await built.boot();
      expect(built.control.outcome()).toMatchObject({ workerVersion: CAPTURE_WORKER_VERSION });
      expect((await mounted({ captureWorkerPath: fixture.workerSaying('worker-newer', 'capture-worker/0.6.0') }).refusal()).code).toBe(CaptureBootRefusal.WORKER_VERSION_MISMATCH);
    });

    it('the order of the version rule: protocol, proof mark, release form, then THE version - a proof build of the built version stays a proof build', async () => {
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
