// The CS-22 boot step of the transcriber, the host file and the service state (blueprint row 115;
// transcript spec §B.4, §B.7; D70, D71; pair-76 N-12). No database: the stored row is a value the
// test hands in, the engine files are stand-ins in a temporary data directory (never started).
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryLog } from '@dems/transcriber';
import { afterAll, describe, expect, it } from 'vitest';
import {
  TRANSCRIBER_BOOT_STEP,
  TranscriberBootError,
  TranscriberHostError,
  mountTranscription,
  readTranscriberHost,
  runTranscriberBoot,
  sessionScratchDir,
  sessionTapPath,
  transcriptionControl,
  transcriptionServiceSource,
  type StoredSttSelection,
  type TranscriberBootDeps,
} from '../index';
import { CPU_MODEL, answerer, cpuRow, fakeHost, fullHost, makeDataDir, serverRow, type DataDir } from './support';

const dirs: string[] = [];
const dataDir = (slug: string): DataDir => {
  const dir = makeDataDir(slug);
  dirs.push(dir.dataDir);
  return dir;
};
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const refusal = async (pending: Promise<unknown>): Promise<[string, string] | 'passed'> =>
  pending.then(
    () => 'passed' as const,
    (error: unknown) => {
      if (!(error instanceof TranscriberBootError)) throw error;
      return [error.code, error.reason] as [string, string];
    },
  );

function deps(dir: DataDir, stored: StoredSttSelection | null, more: Partial<TranscriberBootDeps> = {}): TranscriberBootDeps {
  return { captureMode: 'real', mounted: true, host: () => readTranscriberHost(dir.dataDir, () => 8), readConfig: async () => stored, transcriberLog: createMemoryLog(), ...more };
}

describe('the host file `<dataDir>/transcriber/host.json`', () => {
  it('no file: the host states nothing; a full file: both backends, priority `required`, no nice path of its own', () => {
    const dir = dataDir('host');
    expect(readTranscriberHost(dir.dataDir, () => 8)).toMatchObject({ source: 'NONE', runtime: { physicalCores: 8 }, vad: null });
    dir.writeHost({ ...(fullHost(dir) as object), vad: { binaryPath: dir.binaryPath, modelDir: dir.modelDir, model: 'ggml-silero-v6.2.0' } });
    const host = readTranscriberHost(dir.dataDir, () => 8);
    expect(host.runtime.cpuLocal).toEqual({ binaryPath: dir.binaryPath, modelDir: dir.modelDir, workDir: join(dir.dataDir, 'transcriber', 'work'), priority: 'required' });
    expect(host.runtime.omlxServer).toEqual({ settingsPath: dir.settingsPath });
    expect(host.vad).toEqual({ binaryPath: dir.binaryPath, modelDir: dir.modelDir, model: 'ggml-silero-v6.2.0', priority: 'required' });
    // A data directory that does not exist is "no file" too (an in-process test app).
    expect(readTranscriberHost(join(dir.dataDir, 'absent'), () => 2).source).toBe('NONE');
  });

  it('a file that is there and is not of the form is a FAULT with a reason, never "no file"; the reason names a member, not a value', () => {
    const dir = dataDir('host-bad');
    const cases: [string, string][] = [
      ['{ not json', 'NOT_JSON'],
      ['{ "version": 2 }', 'FORM:version'],
      [`{ "version": 1, "cpuLocal": { "binaryPath": "bin/whisper-cli", "modelDir": "${dir.modelDir}" } }`, 'FORM:cpuLocal.binaryPath'],
      [`{ "version": 1, "cpuLocal": { "binaryPath": "${dir.binaryPath}", "modelDir": "${dir.modelDir}", "nicePath": "/tmp/nice" } }`, 'FORM:cpuLocal'],
      [`{ "version": 1, "cpuLocal": { "binaryPath": "${dir.binaryPath}", "modelDir": "${dir.modelDir}", "priority": "best-effort" } }`, 'FORM:cpuLocal'],
      [`{ "version": 1, "apiKey": "x" }`, 'FORM:'],
      [`{ "version": 1, "pad": "${'x'.repeat(20_000)}" }`, 'TOO_LARGE'],
    ];
    for (const [text, reason] of cases) {
      dir.writeHostText(text);
      let caught: unknown;
      try {
        readTranscriberHost(dir.dataDir, () => 8);
      } catch (error) {
        caught = error;
      }
      expect(caught, reason).toBeInstanceOf(TranscriberHostError);
      expect((caught as TranscriberHostError).reason, text.slice(0, 40)).toBe(reason);
      expect((caught as TranscriberHostError).message).not.toContain(dir.dataDir);
    }
  });

  it('the scratch directory and the tap of a session are below the data directory; a session ID of another form is refused', () => {
    // Pin moved by fix pass F-M7c (ruling D180): the first argument is the MEDIA STORE ROOT of the Core, and the folder is its hidden `.transcriber`.
    expect(sessionScratchDir('/data/media/sessions', 'SES-20310101-0001')).toBe('/data/media/sessions/.transcriber/sessions/SES-20310101-0001');
    expect(sessionTapPath('/data/media/sessions', 'SES-20310101-0001')).toBe('/data/media/sessions/.transcriber/sessions/SES-20310101-0001/tap.pcm');
    for (const id of ['../../etc', 'SES-20310101-0001/..', '', 'SES-2031-1']) expect(() => sessionScratchDir('/data', id), id).toThrow(TranscriberHostError);
  });
});

describe('CS-22: the boot step', () => {
  it('Simulated capture and an app without a data directory: INERT - the stored row and the host file are not even read', async () => {
    const dir = dataDir('boot-sim');
    dir.writeHostText('{ not json');
    let reads = 0;
    const readConfig = async (): Promise<StoredSttSelection | null> => {
      reads += 1;
      return null;
    };
    expect(await runTranscriberBoot(deps(dir, null, { captureMode: 'simulated', readConfig }))).toEqual({ outcome: 'INERT' });
    expect(await runTranscriberBoot(deps(dir, null, { mounted: false, readConfig }))).toEqual({ outcome: 'INERT' });
    expect(reads).toBe(0);
  });

  it('real capture, everything there: RESOLVED for cpu-local and for omlx-server; STT disabled: DISABLED without a look at the engine', async () => {
    const dir = dataDir('boot-ok');
    dir.writeHost(fullHost(dir));
    expect(await runTranscriberBoot(deps(dir, cpuRow()))).toEqual({ outcome: 'RESOLVED', backend: 'cpu-local', vad: 'NOT_STATED' });
    // No connection is made at boot: nothing listens on this port, and the step passes.
    expect(await runTranscriberBoot(deps(dir, serverRow('http://127.0.0.1:18999')))).toEqual({ outcome: 'RESOLVED', backend: 'omlx-server', vad: 'NOT_STATED' });
    expect(await runTranscriberBoot(deps(dir, cpuRow({ enabled: false, model: 'ggml-absent' })))).toEqual({ outcome: 'DISABLED' });
  });

  it('the boot REFUSES an unresolvable transcriber configuration, each with its code and reason', async () => {
    const dir = dataDir('boot-refuse');
    dir.writeHost(fullHost(dir));
    // Control first: the same data directory boots with the seeded default.
    expect(await refusal(runTranscriberBoot(deps(dir, cpuRow())))).toBe('passed');

    expect(await refusal(runTranscriberBoot(deps(dir, null)))).toEqual(['STT_CONFIG_NOT_SEEDED', 'NO_ROW']);
    expect(await refusal(runTranscriberBoot(deps(dir, cpuRow({ model: 'ggml-absent' }))))).toEqual(['TRANSCRIBER_ENGINE_FILES_MISSING', 'MODEL_NOT_FOUND']);
    // An endpoint the database CHECK lets through and the transcriber refuses (a row written before row 115, or by hand).
    for (const endpoint of ['http://127.0.0.1:8000/v1?x=1', 'http://127.0.0.1:8000/v1#f', 'http://127.0.0.1:8000/a b', 'http://127.0.0.1:8000/a\\b']) {
      expect(await refusal(runTranscriberBoot(deps(dir, serverRow(endpoint)))), endpoint).toEqual(['TRANSCRIBER_CONFIG_UNRESOLVABLE', endpoint.includes('?') || endpoint.includes('#') ? 'ENDPOINT_HAS_QUERY_OR_FRAGMENT' : 'ENDPOINT_MALFORMED']);
    }
    expect(await refusal(runTranscriberBoot(deps(dir, serverRow('http://192.168.1.20:8000'))))).toEqual(['TRANSCRIBER_CONFIG_UNRESOLVABLE', 'ENDPOINT_NOT_LOOPBACK']);
    expect(await refusal(runTranscriberBoot(deps(dir, cpuRow({ model: '../etc/passwd' }))))).toEqual(['TRANSCRIBER_CONFIG_UNRESOLVABLE', 'MODEL_ID_INVALID']);
    expect(await refusal(runTranscriberBoot(deps(dir, cpuRow(), { cpuOnly: () => ({ cpuOnly: false, reason: 'GPU_BACKEND_NAMED', marker: 'Metal.framework' }) })))).toEqual(['TRANSCRIBER_ENGINE_NOT_CPU_ONLY', 'GPU_BACKEND_NAMED']);

    // The engine executable is gone.
    const noEngine = dataDir('boot-noengine');
    noEngine.writeHost({ version: 1, cpuLocal: { binaryPath: join(noEngine.dataDir, 'engine', 'absent'), modelDir: noEngine.modelDir } });
    expect(await refusal(runTranscriberBoot(deps(noEngine, cpuRow())))).toEqual(['TRANSCRIBER_ENGINE_FILES_MISSING', 'ENGINE_NOT_FOUND']);
    // The host states no engine at all, and the stored row selects cpu-local.
    const bare = dataDir('boot-bare');
    expect(await refusal(runTranscriberBoot(deps(bare, cpuRow())))).toEqual(['TRANSCRIBER_CONFIG_UNRESOLVABLE', 'CPU_LOCAL_RUNTIME_MISSING']);
    // A wrong host value fails the boot, not the first session.
    bare.writeHostText('{ "version": 1, "cpuLocal": { "binaryPath": "whisper-cli", "modelDir": "/x" } }');
    expect(await refusal(runTranscriberBoot(deps(bare, cpuRow())))).toEqual(['TRANSCRIBER_HOST_FILE_INVALID', 'FORM:cpuLocal.binaryPath']);
  });

  it('a stated VAD engine whose model is absent does not stop the boot: a warning, and fixed windows later', async () => {
    const dir = dataDir('boot-vad');
    dir.writeHost({ ...(fullHost(dir) as object), vad: { binaryPath: dir.binaryPath, modelDir: dir.modelDir, model: 'ggml-silero-v6.2.0' } });
    const log = createMemoryLog();
    expect(await runTranscriberBoot(deps(dir, cpuRow(), { transcriberLog: log }))).toEqual({ outcome: 'RESOLVED', backend: 'cpu-local', vad: 'ABSENT' });
    expect(log.records().map((record) => [record.level, record.context['reason']])).toEqual([['warn', 'MODEL_NOT_FOUND']]);
    writeFileSync(join(dir.modelDir, 'ggml-silero-v6.2.0.bin'), 'stand-in');
    expect(await runTranscriberBoot(deps(dir, cpuRow()))).toMatchObject({ vad: 'READY' });
  });
});

describe('the mount: one boot step, and the service state `modules/system` reads', () => {
  it('an app without a data directory has no transcriber: not mounted, NOT_CONFIGURED, an inert boot step', async () => {
    const host = fakeHost('/nonexistent/dems-row115');
    const control = mountTranscription(host.app, { readConfig: async () => cpuRow() });
    expect(control.mounted).toBe(false);
    expect(host.bootSteps.map((step) => step.id)).toEqual([TRANSCRIBER_BOOT_STEP]);
    await host.bootSteps[0]?.run();
    expect(control.bootOutcome()).toEqual({ outcome: 'INERT' });
    expect(control.serviceState()).toEqual({ state: 'NOT_CONFIGURED', startedAt: null });
    expect(() => mountTranscription(host.app, { readConfig: async () => null })).toThrow('mounted twice');
    expect(() => transcriptionControl({ stages: {} })).toThrow('not mounted');
    // The source `modules/system` is handed: the same state, and NOT_CONFIGURED (never a throw) where nothing is mounted.
    expect(transcriptionServiceSource(host.app)()).toEqual(control.serviceState());
    expect(transcriptionServiceSource({ stages: {} })()).toEqual({ state: 'NOT_CONFIGURED', startedAt: null });
  });

  it('Simulated capture with a data directory: mounted (operation 92 has its probe) and still NOT_CONFIGURED - no transcriber runs in Simulated mode', async () => {
    const dir = dataDir('mount-sim');
    const host = fakeHost(dir.dataDir, 'simulated');
    const control = mountTranscription(host.app, { readConfig: async () => cpuRow() });
    await host.bootSteps[0]?.run();
    expect([control.mounted, control.bootOutcome()?.outcome, control.serviceState().state]).toEqual([true, 'INERT', 'NOT_CONFIGURED']);
  });

  it('real capture: NOT_CONFIGURED before the boot, RUNNING after it, STOPPED when disabled, DEGRADED after a test that failed, RUNNING after one that passed', async () => {
    const dir = dataDir('mount-real');
    dir.writeHost(fullHost(dir));
    const host = fakeHost(dir.dataDir, 'real');
    let stored: StoredSttSelection = cpuRow();
    const transport = answerer(['another-model']);
    const control = mountTranscription(host.app, { readConfig: async () => stored, fetchImpl: transport.fetchImpl });
    expect(control.serviceState()).toEqual({ state: 'NOT_CONFIGURED', startedAt: null });
    await host.bootSteps[0]?.run();
    expect(control.serviceState()).toEqual({ state: 'RUNNING', startedAt: host.now });
    expect(transcriptionServiceSource(host.app)()).toEqual({ state: 'RUNNING', startedAt: host.now });
    expect(host.lines.filter((line) => line.fields['code'] === 'TRANSCRIBER_RESOLVED')).toHaveLength(1);

    control.noteConfigChange(false);
    expect(control.serviceState().state).toBe('STOPPED');
    control.noteConfigChange(true);
    expect(control.serviceState().state).toBe('RUNNING');

    const options = { signal: new AbortController().signal, timeoutMs: 1_000 };
    stored = serverRow('http://127.0.0.1:18903');
    expect(await control.probe({ enabled: true, backend: 'omlx-server', endpoint: 'http://127.0.0.1:18903', model: 'whisper-large-v3-turbo', credentialKind: null }, options)).toMatchObject({ reachable: true, modelAvailable: false });
    expect(control.serviceState().state).toBe('DEGRADED');
    expect(await control.probe({ enabled: true, backend: 'cpu-local', endpoint: null, model: CPU_MODEL, credentialKind: null }, options)).toMatchObject({ reachable: true, modelAvailable: true });
    expect(control.serviceState().state).toBe('RUNNING');
  });

  it('real capture, an unusable configuration: the boot step THROWS (the entry point then exits without a listener) and the state stays NOT_CONFIGURED', async () => {
    const dir = dataDir('mount-refuse');
    const host = fakeHost(dir.dataDir, 'real');
    const control = mountTranscription(host.app, { readConfig: async () => cpuRow() });
    await expect(host.bootSteps[0]?.run()).rejects.toMatchObject({ name: 'TranscriberBootError', code: 'TRANSCRIBER_CONFIG_UNRESOLVABLE', reason: 'CPU_LOCAL_RUNTIME_MISSING' });
    expect(control.serviceState().state).toBe('NOT_CONFIGURED');
  });
});
