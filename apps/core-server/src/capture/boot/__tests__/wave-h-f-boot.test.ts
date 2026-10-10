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
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { CAPTURE_PROTOCOL_VERSION, CAPTURE_WORKER_SETTINGS, LIBAVFORMAT_VERSION_MISMATCH } from '@dems/capture-protocol';
import { afterAll, describe, expect, it } from 'vitest';
import { unitTestConfig } from '../../../../test/support/config';
import type { ConfigInput } from '../../../config';
import { BootError, createReadiness } from '../../../plugins/readiness';
import { createSystemTimers } from '../../timers';
import { captureWorkerArguments } from '../../worker-arguments';
import { EVIDENCE_STORE_PRIVATE_FOLDERS, evidenceStoreProblemOf, runCaptureBootChecks, type WorkerHandshake } from '../checks';
import { probeEvidenceVolume } from '../evidence-volume';
import { CAPTURE_BOOT_STEP, CAPTURE_WORKER_VERSION, CaptureBootError, CaptureBootRefusal, mountCaptureBootChecks } from '../index';
import { FIXTURE_NOW, realBootFixture, recordedSinks } from './support';

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
  const control = mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000 });
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
