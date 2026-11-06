// M6-CP-1, the SIBLING RULE of row 77 (transcript spec §C "Priority direction"): the STT engine and
// the VAD engine run at a LOWER priority than the capture worker.
//
// The capture worker here is a STUB PROCESS (a program that only waits): the rule is about two
// process priorities, so the real media pipeline has no part in it. Both niceness values are
// OBSERVED from the operating system: `os.getPriority(pid)` for both, the engine's own report, and
// `ps` where the host allows it.
//
// TWO COMPLEMENTARY HOST BLOCKS, as in `cpu-priority.test.ts`: where the host lowers a priority
// the first one runs and proves the rule; where a sandbox forbids the system call the second one
// runs ("host forbids it") and proves that nothing is started. A gate run is made OUTSIDE the
// sandbox and must show "host forbids it" as the skipped block.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { getPriority } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { createTranscriberAdapter } from '../adapter';
import { judgeAgainstCaptureWorker } from '../backends/cpu-local';
import { resolveTranscriberConfig } from '../config';
import { STT_NICE, engineIsBelowCaptureWorker, expectedEngineNice } from '../cpu-priority';
import { createMemoryLog } from '../log';
import { createSileroVad, resolveSileroVadConfig } from '../pipeline/silero-vad';
import { TranscriberErrorCode, type TranscriberChunk } from '../types';
import { encodeWavPcm16 } from '../wav';
import { TAP_RATE, createProgramHome, tonePcm, type ProgramHome } from './pipeline-support';
import { EXPECTED_ENGINE_NICE, HOST_LOWERS_PRIORITY, OWN_NICE, errorRecords, scratchDir } from './support';

const WAITING_PROGRAM = 'setInterval(() => {}, 1000)';
const started: ChildProcess[] = [];

/** Starts a stub "capture worker": a process that only waits. `lowerBy`: started through `nice -n <lowerBy>`. */
async function stubWorker(lowerBy = 0): Promise<number> {
  const child = lowerBy === 0 ? spawn(process.execPath, ['-e', WAITING_PROGRAM], { stdio: 'ignore' }) : spawn('/usr/bin/nice', ['-n', String(lowerBy), process.execPath, '-e', WAITING_PROGRAM], { stdio: 'ignore' });
  started.push(child);
  await new Promise<void>((resolve, reject) => {
    child.once('spawn', () => resolve());
    child.once('error', reject);
  });
  // `nice` lowers itself and then becomes the program: wait until the niceness is the final one.
  for (let tries = 0; tries < 100 && getPriority(child.pid!) !== Math.min(OWN_NICE + lowerBy, 19) && lowerBy !== 0; tries += 1) await wait(10);
  return child.pid!;
}

/** The niceness `ps` reports for a process, or null where the host does not let `ps` run (a sandbox). */
function psNice(pid: number): number | null {
  try {
    return Number(execFileSync('/bin/ps', ['-o', 'ni=', '-p', String(pid)], { encoding: 'utf8' }).trim());
  } catch {
    return null;
  }
}

function chunkFile(dir: string): TranscriberChunk {
  const path = join(dir, 'chunk-1.wav');
  writeFileSync(path, encodeWavPcm16(tonePcm(TAP_RATE, [{ from: 0, to: TAP_RATE }]), TAP_RATE));
  return { audio: { kind: 'file', path }, sampleRateHz: TAP_RATE, offsetMs: 21, durationMs: 1000 };
}

function adapterBeside(home: ProgramHome, workerPid: number | null, priority: 'required' | 'best-effort' = 'required') {
  const log = createMemoryLog();
  const config = resolveTranscriberConfig(
    { backend: 'cpu-local', model: home.model('journal-model'), language: 'id' },
    { physicalCores: 8, cpuLocal: { binaryPath: home.engineBinary, modelDir: home.modelDir, workDir: home.workDir, priority } },
  );
  const engines: number[] = [];
  const adapter = createTranscriberAdapter(config, { log, captureWorkerPid: () => workerPid, onEngineStart: (engine) => engines.push(engine.pid) });
  return { adapter, log, engines };
}

afterEach(() => {
  for (const child of started.splice(0)) child.kill('SIGKILL');
});

describe('M6-CP-1 sibling rule: the rule itself', () => {
  it('the engine is below the worker when its niceness is strictly higher; equal is NOT below', () => {
    expect(engineIsBelowCaptureWorker(0, 10)).toBe(true);
    expect(engineIsBelowCaptureWorker(5, 15)).toBe(true);
    expect(engineIsBelowCaptureWorker(-5, 0)).toBe(true);
    expect(engineIsBelowCaptureWorker(10, 10)).toBe(false);
    expect(engineIsBelowCaptureWorker(15, 10)).toBe(false);
    expect(engineIsBelowCaptureWorker(19, 19)).toBe(false); // a worker at the floor leaves no room below it
    expect(engineIsBelowCaptureWorker(0, Number.NaN)).toBe(false);
    expect(engineIsBelowCaptureWorker(0.5, 10)).toBe(false);
  });

  it('with the worker not lowered (as the capture supervisor starts it) the lowered engine is always below it', () => {
    for (let core = -20; core <= 18; core += 1) expect(engineIsBelowCaptureWorker(core, expectedEngineNice(core))).toBe(true);
    expect(engineIsBelowCaptureWorker(19, expectedEngineNice(19))).toBe(false);
  });

  it('the verdict is taken from the OBSERVED niceness of the worker process', async () => {
    const pid = await stubWorker();
    expect(getPriority(pid)).toBe(OWN_NICE);
    expect(judgeAgainstCaptureWorker(() => pid, OWN_NICE + STT_NICE)).toEqual({ ok: true, workerNice: OWN_NICE });
    expect(judgeAgainstCaptureWorker(() => pid, OWN_NICE)).toEqual({ ok: false, workerNice: OWN_NICE, engineNice: OWN_NICE });
    // The host does not lower a priority (null): beside a worker, that is a refusal.
    expect(judgeAgainstCaptureWorker(() => pid, null)).toEqual({ ok: false, workerNice: OWN_NICE, engineNice: null });
  });

  it('no worker, and a worker that has ended, leave nothing to outrank', async () => {
    expect(judgeAgainstCaptureWorker(undefined, null)).toEqual({ ok: true, workerNice: null });
    expect(judgeAgainstCaptureWorker(() => null, 10)).toEqual({ ok: true, workerNice: null });
    const pid = await stubWorker();
    const child = started[started.length - 1]!;
    const gone = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    child.kill('SIGKILL');
    await gone;
    expect(judgeAgainstCaptureWorker(() => pid, 10)).toEqual({ ok: true, workerNice: null });
  });
});

describe('M6-CP-1 sibling rule: the engine beside a stub capture worker, from process observation', () => {
  it.runIf(HOST_LOWERS_PRIORITY)('host lowers priorities: the STT engine and the VAD engine are observed at a higher niceness than the worker; a worker that is itself lowered further gets NO engine', async () => {
    // 1. A worker as the supervisor starts it (not lowered), an engine held while it is observed.
    const home = createProgramHome();
    home.control({ holdOn: 'chunk-1.wav' });
    const workerPid = await stubWorker();
    const { adapter, engines, log } = adapterBeside(home, workerPid);
    const running = adapter.transcribe(chunkFile(scratchDir('sibling')), { language: 'id' }).catch((error: unknown) => error);
    for (let tries = 0; tries < 500 && home.journal().length === 0; tries += 1) await wait(10);
    const entry = home.journal()[0]!;
    const observed = { worker: getPriority(workerPid), engine: getPriority(entry.pid), engineSelf: entry.nice, psWorker: psNice(workerPid), psEngine: psNice(entry.pid) };
    process.kill(entry.pid, 'SIGKILL');
    await running;
    expect(engines).toEqual([entry.pid]); // `nice` became the engine: one process
    expect(observed.worker).toBe(OWN_NICE);
    expect(observed.engine).toBe(EXPECTED_ENGINE_NICE);
    expect(observed.engineSelf).toBe(EXPECTED_ENGINE_NICE);
    expect(observed.engine).toBeGreaterThan(observed.worker);
    expect(engineIsBelowCaptureWorker(observed.worker, observed.engine)).toBe(true);
    if (observed.psWorker !== null && observed.psEngine !== null) expect(observed.psEngine).toBeGreaterThan(observed.psWorker);
    expect(errorRecords(log).filter((record) => record.context['reason'] === 'ENGINE_NOT_BELOW_CAPTURE_WORKER')).toEqual([]);

    // 2. NEGATIVE CONTROL: a worker lowered by 15 sits BELOW where the engine would run (+10).
    const second = createProgramHome();
    const lowWorkerPid = await stubWorker(15);
    expect(getPriority(lowWorkerPid)).toBe(Math.min(OWN_NICE + 15, 19));
    const refused = adapterBeside(second, lowWorkerPid);
    await expect(refused.adapter.transcribe(chunkFile(scratchDir('sibling')), { language: 'id' })).rejects.toMatchObject({
      code: TranscriberErrorCode.ENGINE_NOT_BELOW_CAPTURE_WORKER,
      detail: { workerNice: Math.min(OWN_NICE + 15, 19), engineNice: EXPECTED_ENGINE_NICE },
    });
    expect(second.journal()).toEqual([]); // no engine process ever existed
    expect(refused.engines).toEqual([]);
    expect(errorRecords(refused.log)).toHaveLength(1);

    // 3. The VAD engine obeys the same rule.
    const third = createProgramHome();
    const vadConfig = resolveSileroVadConfig({ binaryPath: third.vadBinary, modelDir: third.modelDir, model: third.model('silero-ok') });
    const window = chunkFile(scratchDir('sibling'));
    if (window.audio.kind !== 'file') throw new Error('unreachable');
    await expect(createSileroVad(vadConfig, { log: createMemoryLog(), captureWorkerPid: () => workerPid }).detect(window.audio.path)).resolves.toHaveLength(1);
    expect(third.vadLastNice()).toBe(EXPECTED_ENGINE_NICE);
    expect(third.vadLastNice()!).toBeGreaterThan(getPriority(workerPid));
    const fourth = createProgramHome();
    const lowVad = resolveSileroVadConfig({ binaryPath: fourth.vadBinary, modelDir: fourth.modelDir, model: fourth.model('silero-ok') });
    await expect(createSileroVad(lowVad, { log: createMemoryLog(), captureWorkerPid: () => lowWorkerPid }).detect(window.audio.path)).rejects.toMatchObject({ code: TranscriberErrorCode.VAD_FAILED, detail: { reason: 'ENGINE_NOT_BELOW_CAPTURE_WORKER' } });
    expect(fourth.vadLastArgv()).toBeNull();
  });

  it.runIf(!HOST_LOWERS_PRIORITY)('host forbids it (a sandbox): beside a capture worker NO engine is started, in `required` AND in `best-effort` mode; with no worker `best-effort` still runs', async () => {
    const workerPid = await stubWorker();
    for (const mode of ['required', 'best-effort'] as const) {
      const home = createProgramHome();
      const { adapter, engines } = adapterBeside(home, workerPid, mode);
      await expect(adapter.transcribe(chunkFile(scratchDir('sibling')), { language: 'id' })).rejects.toMatchObject({
        code: mode === 'required' ? TranscriberErrorCode.PRIORITY_NOT_APPLIED : TranscriberErrorCode.ENGINE_NOT_BELOW_CAPTURE_WORKER,
      });
      expect(home.journal()).toEqual([]);
      expect(engines).toEqual([]);
    }
    const alone = createProgramHome();
    const { adapter } = adapterBeside(alone, null, 'best-effort');
    await expect(adapter.transcribe(chunkFile(scratchDir('sibling')), { language: 'id' })).resolves.toMatchObject({ engine: 'cpu-local' });
    expect(alone.journal()).toHaveLength(1);
  });

  it('the two host blocks above are complementary: exactly one of them ran', () => {
    expect([HOST_LOWERS_PRIORITY, !HOST_LOWERS_PRIORITY].filter(Boolean)).toHaveLength(1);
  });
});
