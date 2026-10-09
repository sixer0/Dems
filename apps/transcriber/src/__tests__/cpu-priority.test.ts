// M6-CP-1 — the CPU priority rule (test strategy §A.6; transcript spec §C; specs C-N2; D7(d)):
// the bounded thread product is at most the physical cores, and calls are serialised. A
// configuration assertion, not a measurement: nothing here times anything (D230).
import { setTimeout as wait } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { createTranscriberAdapter } from '../adapter';
import { ENGINE_ENVIRONMENT, buildWhisperCliArgs, hostLowersPriority } from '../backends/cpu-local';
import { resolveTranscriberConfig, type CpuLocalConfig, type TranscriberRuntime } from '../config';
import { CAPTURE_RESERVED_CORES, STT_NICE, SerialQueue, defaultSttThreadPlan, planSttThreads, threadPlanHolds } from '../cpu-priority';
import { countCpuinfoCores, detectPhysicalCores, halfOfLogical } from '../host/physical-cores';
import { OMLX_CREDENTIAL_REF } from '../key-loader';
import { createMemoryLog } from '../log';
import { TranscriberErrorCode, type EngineRunRecord } from '../types';
import { HOST_LOWERS_PRIORITY, createFakeEngine, createFakeOmlx, pcmChunk, writeSettingsFile } from './support';

describe('M6-CP-1: the bounded thread product is at most the physical cores', () => {
  it('holds for every accepted plan of every host size from 1 to 64 cores, and every refused plan breaks it', () => {
    let accepted = 0;
    let refused = 0;
    for (let physicalCores = 1; physicalCores <= 64; physicalCores += 1) {
      for (let threads = 1; threads <= 66; threads += 1) {
        for (const processors of [1, 2, 3, 4]) {
          const exceeds = threads * processors > physicalCores;
          if (exceeds) {
            expect(() => planSttThreads({ threads, processors, physicalCores })).toThrowError(
              expect.objectContaining({ code: TranscriberErrorCode.CONFIG_INVALID, detail: { reason: 'THREAD_PRODUCT_EXCEEDS_CORES', threads, processors, physicalCores } }),
            );
            refused += 1;
          } else {
            const plan = planSttThreads({ threads, processors, physicalCores });
            expect(plan.threads * plan.processors).toBeLessThanOrEqual(physicalCores);
            expect(threadPlanHolds(plan)).toBe(true);
            accepted += 1;
          }
        }
      }
    }
    // Both sides of the bound were really visited: the assertion can fail.
    expect(accepted).toBeGreaterThan(1_000);
    expect(refused).toBeGreaterThan(1_000);
  });

  it('the exact edge: product equal to the cores is accepted, one more thread is refused', () => {
    expect(planSttThreads({ threads: 10, processors: 1, physicalCores: 10 })).toEqual({ threads: 10, processors: 1, physicalCores: 10 });
    expect(planSttThreads({ threads: 5, processors: 2, physicalCores: 10 })).toEqual({ threads: 5, processors: 2, physicalCores: 10 });
    expect(() => planSttThreads({ threads: 11, processors: 1, physicalCores: 10 })).toThrowError(expect.objectContaining({ code: 'CONFIG_INVALID' }));
    expect(() => planSttThreads({ threads: 6, processors: 2, physicalCores: 10 })).toThrowError(expect.objectContaining({ code: 'CONFIG_INVALID' }));
  });

  it('the default plan leaves cores to capture and never asks for more than the host has', () => {
    expect(CAPTURE_RESERVED_CORES).toBe(2);
    expect(defaultSttThreadPlan(10)).toEqual({ threads: 8, processors: 1, physicalCores: 10 });
    expect(defaultSttThreadPlan(4)).toEqual({ threads: 2, processors: 1, physicalCores: 4 });
    expect(defaultSttThreadPlan(2)).toEqual({ threads: 1, processors: 1, physicalCores: 2 });
    expect(defaultSttThreadPlan(1)).toEqual({ threads: 1, processors: 1, physicalCores: 1 });
    for (let cores = 1; cores <= 128; cores += 1) {
      const plan = defaultSttThreadPlan(cores);
      expect(threadPlanHolds(plan)).toBe(true);
      if (cores > CAPTURE_RESERVED_CORES) expect(cores - plan.threads * plan.processors).toBeGreaterThanOrEqual(CAPTURE_RESERVED_CORES);
    }
    expect(planSttThreads({ processors: 2, physicalCores: 10 })).toEqual({ threads: 4, processors: 2, physicalCores: 10 });
  });

  it('a bound that is not a positive integer is refused, not rounded', () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => planSttThreads({ threads: bad, physicalCores: 8 })).toThrowError(expect.objectContaining({ code: 'CONFIG_INVALID' }));
      expect(() => planSttThreads({ threads: 1, processors: bad, physicalCores: 8 })).toThrowError(expect.objectContaining({ code: 'CONFIG_INVALID' }));
      expect(() => defaultSttThreadPlan(bad)).toThrowError(expect.objectContaining({ code: 'CONFIG_INVALID' }));
    }
  });

  it('the configuration refuses an over-bound plan before any engine exists, and the command carries the accepted bound', () => {
    const engine = createFakeEngine();
    const runtime = (threads: number, processors?: number): TranscriberRuntime => ({
      physicalCores: 10,
      cpuLocal: { ...engine.cpuLocal(), threads, processors },
    });
    expect(() => resolveTranscriberConfig({ backend: 'cpu-local', model: 'm' }, runtime(11))).toThrowError(expect.objectContaining({ detail: expect.objectContaining({ reason: 'THREAD_PRODUCT_EXCEEDS_CORES' }) }));
    expect(engine.lastArgv()).toBeNull();

    const one = resolveTranscriberConfig({ backend: 'cpu-local', model: 'm' }, runtime(8)) as CpuLocalConfig;
    expect(buildWhisperCliArgs(one, '/a.wav', '/out')).toEqual(['-m', `${engine.modelDir}/m.bin`, '-ng', '-t', '8', '-l', 'id', '-oj', '-of', '/out', '-f', '/a.wav']);
    const two = resolveTranscriberConfig({ backend: 'cpu-local', model: 'm' }, runtime(4, 2)) as CpuLocalConfig;
    expect(buildWhisperCliArgs(two, '/a.wav', '/out')).toEqual(['-m', `${engine.modelDir}/m.bin`, '-ng', '-t', '4', '-p', '2', '-l', 'id', '-oj', '-of', '/out', '-f', '/a.wav']);
  });

  it('a plan that was tampered with after it was accepted is refused by the engine module, and nothing is started', async () => {
    const engine = createFakeEngine();
    const log = createMemoryLog();
    const config = resolveTranscriberConfig(
      { backend: 'cpu-local', model: engine.model('model-ok') },
      { physicalCores: 4, cpuLocal: engine.cpuLocal() },
    ) as CpuLocalConfig;
    const tampered: CpuLocalConfig = { ...config, threadPlan: { threads: 32, processors: 1, physicalCores: 4 } };
    await expect(createTranscriberAdapter(tampered, { log }).transcribe(pcmChunk(), { language: 'id' })).rejects.toMatchObject({ detail: { reason: 'THREAD_PRODUCT_EXCEEDS_CORES' } });
    expect(engine.lastArgv()).toBeNull();
  });

  describe('the engine runs below the priority of capture, from its first instruction (N-5)', () => {
    const run = async (priority: 'required' | 'best-effort') => {
      const engine = createFakeEngine();
      const log = createMemoryLog();
      const runs: EngineRunRecord[] = [];
      const starts: number[] = [];
      const config = resolveTranscriberConfig({ backend: 'cpu-local', model: engine.model('model-ok') }, { physicalCores: 10, cpuLocal: engine.cpuLocal({ priority }) });
      const adapter = createTranscriberAdapter(config, { log, onEngineRun: (record) => runs.push(record), onEngineStart: (started) => starts.push(started.pid) });
      const outcome = await adapter.transcribe(pcmChunk(), { language: 'id' }).then(
        (result) => ({ ok: true as const, result }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      const refusals = log.records().filter((record) => record.context['reason'] === 'PRIORITY_NOT_APPLIED');
      return { engine, runs, starts, outcome, refusals };
    };

    it('the niceness is a positive constant and the default mode is `required`', () => {
      expect(STT_NICE).toBe(10);
      const engine = createFakeEngine();
      const config = resolveTranscriberConfig({ backend: 'cpu-local', model: 'm' }, { physicalCores: 10, cpuLocal: { binaryPath: engine.binaryPath, modelDir: engine.modelDir, workDir: engine.workDir } }) as CpuLocalConfig;
      expect(config.priority).toBe('required');
      expect(config.nicePath).toBe('/usr/bin/nice');
      expect(() => resolveTranscriberConfig({ backend: 'cpu-local', model: 'm' }, { physicalCores: 10, cpuLocal: engine.cpuLocal({ priority: 'never' as 'required' }) })).toThrowError(
        expect.objectContaining({ detail: { reason: 'PRIORITY_MODE_UNKNOWN' } }),
      );
      expect(() => resolveTranscriberConfig({ backend: 'cpu-local', model: 'm' }, { physicalCores: 10, cpuLocal: engine.cpuLocal({ nicePath: 'nice' }) })).toThrowError(
        expect.objectContaining({ detail: { reason: 'NICE_PATH_NOT_ABSOLUTE' } }),
      );
    });

    // ONE of the two blocks below runs, chosen by what the operating system itself answers
    // (`HOST_LOWERS_PRIORITY`, an observation made without the product code). Each block is strict:
    // on a host that lowers priorities, a niceness other than 10 FAILS; on a host that does not,
    // an engine that was started in `required` mode FAILS.
    it.runIf(HOST_LOWERS_PRIORITY)('host lowers priorities: the engine process itself observes niceness 10, in both modes, with no refusal logged', async () => {
      for (const mode of ['required', 'best-effort'] as const) {
        const { engine, runs, starts, outcome, refusals } = await run(mode);
        expect(outcome.ok).toBe(true);
        expect(engine.lastNice()).toBe(STT_NICE);
        expect(runs[0]!.nice).toBe(STT_NICE);
        expect(runs[0]!.argv.slice(0, 4)).toEqual(['/usr/bin/nice', '-n', '10', engine.binaryPath]);
        expect(starts).toHaveLength(1);
        expect(refusals).toEqual([]);
      }
    });

    it.runIf(!HOST_LOWERS_PRIORITY)('host forbids it (a sandbox): `required` starts NO engine; `best-effort` runs and says so in the log', async () => {
      const required = await run('required');
      expect(required.outcome).toMatchObject({ ok: false, error: { code: TranscriberErrorCode.PRIORITY_NOT_APPLIED } });
      expect(required.engine.lastArgv()).toBeNull();
      expect(required.starts).toEqual([]);
      expect(required.runs).toEqual([]);
      expect(required.refusals.map((record) => record.level)).toEqual(['error']);

      const bestEffort = await run('best-effort');
      expect(bestEffort.outcome.ok).toBe(true);
      expect(bestEffort.engine.lastNice()).toBe(0);
      expect(bestEffort.runs[0]!.nice).toBeNull();
      expect(bestEffort.refusals.map((record) => record.level)).toEqual(['warn']);
    });

    it('the two host blocks above are complementary: exactly one of them ran', () => {
      expect([HOST_LOWERS_PRIORITY, !HOST_LOWERS_PRIORITY].filter(Boolean)).toHaveLength(1);
      expect(hostLowersPriority('/usr/bin/nice')).toBe(HOST_LOWERS_PRIORITY);
      expect(hostLowersPriority('/nonexistent/dems/nice')).toBe(false);
    });

    it('a missing nice program is ENGINE_NOT_FOUND: the engine is never started un-lowered instead', async () => {
      const engine = createFakeEngine();
      const config = resolveTranscriberConfig({ backend: 'cpu-local', model: engine.model('model-ok') }, { physicalCores: 10, cpuLocal: engine.cpuLocal({ nicePath: '/nonexistent/dems/nice' }) });
      await expect(createTranscriberAdapter(config, { log: createMemoryLog() }).transcribe(pcmChunk(), { language: 'id' })).rejects.toMatchObject({
        code: TranscriberErrorCode.ENGINE_NOT_FOUND,
        detail: { reason: 'NICE_NOT_FOUND' },
      });
      expect(engine.lastArgv()).toBeNull();
    });
  });

  it('the engine gets its own three-variable environment and nothing of the parent (N-6)', async () => {
    process.env['DEMS_ROW76_CANARY_TOKEN'] = 'canary-value-must-not-reach-the-engine';
    try {
      const engine = createFakeEngine();
      const config = resolveTranscriberConfig({ backend: 'cpu-local', model: engine.model('model-ok') }, { physicalCores: 10, cpuLocal: engine.cpuLocal() });
      await createTranscriberAdapter(config, { log: createMemoryLog() }).transcribe(pcmChunk(), { language: 'id' });
      const seen = engine.lastEnv()!;
      expect(ENGINE_ENVIRONMENT).toEqual({ PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' });
      expect(Object.isFrozen(ENGINE_ENVIRONMENT)).toBe(true);
      // `__CF_USER_TEXT_ENCODING` is added by macOS itself to every process; it is not inherited.
      expect(Object.keys(seen).filter((key) => key !== '__CF_USER_TEXT_ENCODING').sort()).toEqual(['LANG', 'LC_ALL', 'PATH']);
      expect(seen).toMatchObject(ENGINE_ENVIRONMENT);
      expect(JSON.stringify(seen)).not.toContain('canary');
      // Negative control: the parent does hold the canary and many more variables than three.
      expect(process.env['DEMS_ROW76_CANARY_TOKEN']).toBe('canary-value-must-not-reach-the-engine');
      expect(Object.keys(process.env).length).toBeGreaterThan(3);
    } finally {
      delete process.env['DEMS_ROW76_CANARY_TOKEN'];
    }
  });
});

describe('M6-CP-1: the physical core count', () => {
  it('counts distinct cores of a /proc/cpuinfo with two threads per core', () => {
    const block = (processor: number, core: number): string => `processor\t: ${processor}\nphysical id\t: 0\ncore id\t\t: ${core}\ncpu cores\t: 4\n`;
    const cpuinfo = [block(0, 0), block(1, 1), block(2, 2), block(3, 3), block(4, 0), block(5, 1), block(6, 2), block(7, 3)].join('\n');
    expect(countCpuinfoCores(cpuinfo)).toBe(4);
    expect(countCpuinfoCores('processor\t: 0\nBogoMIPS\t: 48.00\n')).toBe(0);
  });

  it('without an answer from the host, half of the logical count is assumed, never the logical count', () => {
    expect([1, 2, 3, 8, 16].map(halfOfLogical)).toEqual([1, 1, 1, 4, 8]);
  });

  it('this host answers with a positive integer and names where it came from', () => {
    const cores = detectPhysicalCores();
    expect(Number.isInteger(cores.count)).toBe(true);
    expect(cores.count).toBeGreaterThanOrEqual(1);
    expect(['proc-cpuinfo', 'sysctl', 'half-of-logical']).toContain(cores.source);
  });
});

describe('M6-CP-1: calls are serialised', () => {
  it('the queue lets one task in at a time, keeps the order, and survives a failed task', async () => {
    const queue = new SerialQueue();
    const order: string[] = [];
    const task = (name: string, fails = false) => async (): Promise<string> => {
      order.push(`start ${name}`);
      await wait(3);
      order.push(`end ${name}`);
      if (fails) throw new Error(name);
      return name;
    };
    const settled = await Promise.allSettled([queue.run(task('a')), queue.run(task('b', true)), queue.run(task('c'))]);
    expect(settled.map((entry) => entry.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
    expect(queue.maxObserved).toBe(1);
    expect(queue.pending).toBe(0);
  });

  it('negative control: the same tasks WITHOUT the queue overlap, so the observation can tell the difference', async () => {
    let inside = 0;
    let highest = 0;
    const task = async (): Promise<void> => {
      inside += 1;
      highest = Math.max(highest, inside);
      await wait(3);
      inside -= 1;
    };
    await Promise.all([task(), task(), task()]);
    expect(highest).toBe(3);
  });

  it('eight transcriptions fired at once reach the oMLX server one at a time', async () => {
    const omlx = createFakeOmlx({ key: 'unit-test-key-5d1e', models: ['server-model'] });
    const config = resolveTranscriberConfig(
      { backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000', model: 'server-model', credentialRef: OMLX_CREDENTIAL_REF },
      { physicalCores: 10, omlxServer: { settingsPath: writeSettingsFile('unit-test-key-5d1e') } },
    );
    const adapter = createTranscriberAdapter(config, { log: createMemoryLog(), fetchImpl: omlx.fetchImpl });
    const results = await Promise.all(Array.from({ length: 8 }, () => adapter.transcribe(pcmChunk(), { language: 'id' })));
    expect(results).toHaveLength(8);
    expect(omlx.calls).toHaveLength(8);
    expect(omlx.maxInFlight()).toBe(1);
    expect(adapter.queue.maxObserved).toBe(1);
  });

  it('negative control: the same eight requests sent past the adapter overlap at the server', async () => {
    const omlx = createFakeOmlx({ key: null, models: ['server-model'] });
    await Promise.all(Array.from({ length: 8 }, () => omlx.fetchImpl('http://127.0.0.1:8000/v1/models', { method: 'GET' })));
    expect(omlx.maxInFlight()).toBe(8);
  });

  it('two adapters that share one queue (a transcription and a fixture synthesis on the same server) never overlap', async () => {
    const omlx = createFakeOmlx({ key: null, models: ['server-model'] });
    const queue = new SerialQueue();
    const config = resolveTranscriberConfig({ backend: 'omlx-server', endpoint: 'http://localhost:8000', model: 'server-model' }, { physicalCores: 10 });
    const first = createTranscriberAdapter(config, { log: createMemoryLog(), fetchImpl: omlx.fetchImpl, queue });
    const second = createTranscriberAdapter(config, { log: createMemoryLog(), fetchImpl: omlx.fetchImpl, queue });
    await Promise.all([first, second, first, second].map((adapter) => adapter.transcribe(pcmChunk(), { language: 'id' })));
    expect(omlx.maxInFlight()).toBe(1);
  });

  it('one engine process at a time: four cpu-local chunks fired at once run in turn', async () => {
    const engine = createFakeEngine();
    const config = resolveTranscriberConfig(
      { backend: 'cpu-local', model: engine.model('model-ok') },
      { physicalCores: 10, cpuLocal: engine.cpuLocal() },
    );
    const adapter = createTranscriberAdapter(config, { log: createMemoryLog() });
    const results = await Promise.all(Array.from({ length: 4 }, () => adapter.transcribe(pcmChunk(), { language: 'id' })));
    expect(results.every((result) => result.segments.length === 2)).toBe(true);
    expect(adapter.queue.maxObserved).toBe(1);
  });
});
