// The two backends, each against its stand-in (support.ts): the command shape and the fail-closed
// paths of `cpu-local` (transcript spec §B.3; W1-C3), the request and the refusals of `omlx-server`
// (§B.2), the configuration rules (§B.4, §B.7) and the connection probe (op 92).
import { chmodSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STT_CONFIG_DEFAULT, STT_MODEL_ID_PATTERN, isSttModelId } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { createTranscriberAdapter } from '../adapter';
import { NO_GPU_FLAG, checkCpuLocalFiles } from '../backends/cpu-local';
import { ENGINE_TIMEOUT_MS, resolveCpuModelPath, resolveTranscriberConfig, type CpuLocalConfig, type SttSelection, type TranscriberRuntime } from '../config';
import { OMLX_CREDENTIAL_REF } from '../key-loader';
import { createMemoryLog } from '../log';
import { createConnectionProbe } from '../probe';
import { TranscriberErrorCode, type EngineRunRecord, type TranscriberChunk } from '../types';
import { createOmlxHttp, connectionTarget } from '../backends/omlx-http';
import { encodeWavPcm16 } from '../wav';
import { createFakeEngine, createFakeOmlx, errorRecords, pcmChunk, scratchDir, wavFileChunk, writeSettingsFile } from './support';

const KEY = 'unit-test-key-0be4a1';
const OPTIONS = { language: 'id' } as const;
/** What the stand-in engine leaves in the work directory; the backend's own scratch files are gone. */
const STAND_IN_FILES = ['last-argv.json', 'last-env.json', 'last-nice.json'];

function cpuWorld(overrides: Partial<NonNullable<TranscriberRuntime['cpuLocal']>> = {}) {
  const engine = createFakeEngine();
  const log = createMemoryLog();
  const runs: EngineRunRecord[] = [];
  const runtime: TranscriberRuntime = { physicalCores: 10, cpuLocal: { ...engine.cpuLocal(), threads: 8, ...overrides } };
  const adapter = (model: string) => createTranscriberAdapter(resolveTranscriberConfig({ backend: 'cpu-local', model }, runtime), { log, onEngineRun: (record) => runs.push(record) });
  return { engine, log, runs, runtime, adapter };
}

describe('cpu-local: the command (§B.3; W1-C3)', () => {
  it('starts the engine with -ng, the thread bound, -l id and -oj, and the process really receives them', async () => {
    const w = cpuWorld();
    const chunk = wavFileChunk(w.engine.workDir);
    const result = await w.adapter(w.engine.model('model-ok')).transcribe(chunk, OPTIONS);
    const argv = w.engine.lastArgv()!;
    const outputBase = argv[argv.indexOf('-of') + 1]!;
    expect(NO_GPU_FLAG).toBe('-ng');
    expect(argv).toEqual(['-m', join(w.engine.modelDir, 'model-ok.bin'), '-ng', '-t', '8', '-l', 'id', '-oj', '-of', outputBase, '-f', chunk.audio.kind === 'file' ? chunk.audio.path : '']);
    expect(argv).not.toContain('-otype');
    expect(w.runs).toHaveLength(1);
    expect(w.runs[0]).toMatchObject({ backend: 'cpu-local', argv: ['/usr/bin/nice', '-n', '10', w.engine.binaryPath, ...argv], requestPath: null, status: 0 });
    expect(w.runs[0]!.rawSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(w.runs[0]!).sort()).toEqual(['argv', 'backend', 'nice', 'rawBytes', 'rawSha256', 'requestPath', 'status']);
    expect(result).toEqual({
      engine: 'cpu-local',
      model: 'model-ok',
      language: 'id',
      text: 'Selamat pagi. Terima kasih atas undangannya.',
      segments: [
        { id: 0, start: 0, end: 4.24, text: 'Selamat pagi.' },
        { id: 1, start: 4.96, end: 7.84, text: 'Terima kasih atas undangannya.' },
      ],
    });
    expect(errorRecords(w.log)).toEqual([]);
  });

  it('chunk PCM is staged as a WAV for the engine and the scratch files are removed afterwards', async () => {
    const w = cpuWorld();
    await w.adapter(w.engine.model('model-ok')).transcribe(pcmChunk(), { language: 'id', prompt: 'gudang, pemindai' });
    const argv = w.engine.lastArgv()!;
    expect(argv.slice(argv.indexOf('--prompt'), argv.indexOf('--prompt') + 2)).toEqual(['--prompt', 'gudang, pemindai']);
    expect(argv[argv.indexOf('-f') + 1]).toMatch(/stt-[0-9a-f-]{36}\.wav$/);
    expect(readdirSync(w.engine.workDir).sort()).toEqual(STAND_IN_FILES);
  });

  it('negative control of the stand-in: it refuses a command without -ng, so a passing run proves the flag was there', async () => {
    const w = cpuWorld();
    const { spawnSync } = await import('node:child_process');
    const run = spawnSync(w.engine.binaryPath, ['-m', join(w.engine.modelDir, `${w.engine.model('model-ok')}.bin`), '-l', 'id', '-oj', '-of', join(w.engine.workDir, 'x'), '-f', w.engine.binaryPath]);
    expect(run.status).toBe(9);
  });
});

describe('cpu-local: fail closed', () => {
  it('a wrong model path is MODEL_NOT_FOUND and no process is started', async () => {
    const w = cpuWorld();
    await expect(w.adapter('model-that-is-not-there').transcribe(pcmChunk(), { language: 'id', correlationId: 'corr-m' })).rejects.toMatchObject({
      code: TranscriberErrorCode.MODEL_NOT_FOUND,
      detail: { reason: 'MODEL_NOT_FOUND', model: 'model-that-is-not-there' },
    });
    expect(w.engine.lastArgv()).toBeNull();
    expect(w.runs).toEqual([]);
    expect(w.log.records()).toHaveLength(1);
    expect(w.log.records()[0]).toMatchObject({ level: 'error', source: 'transcriber.cpuLocal.transcribe', correlationId: 'corr-m', context: { code: 'MODEL_NOT_FOUND', model: 'model-that-is-not-there' } });
    expect(w.log.records()[0]!.stackTrace).toContain('TranscriberError');
  });

  it('a model directory in place of a model file is MODEL_NOT_FOUND', () => {
    const w = cpuWorld();
    const config = resolveTranscriberConfig({ backend: 'cpu-local', model: 'm' }, w.runtime) as CpuLocalConfig;
    expect(() => checkCpuLocalFiles({ ...config, modelPath: w.engine.modelDir })).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.MODEL_NOT_FOUND }));
  });

  it('an absent or non-executable engine is ENGINE_NOT_FOUND', async () => {
    const absent = cpuWorld({ binaryPath: '/nonexistent/dems/whisper-cli' });
    await expect(absent.adapter(absent.engine.model('model-ok')).transcribe(pcmChunk(), OPTIONS)).rejects.toMatchObject({ code: TranscriberErrorCode.ENGINE_NOT_FOUND });
    const w = cpuWorld();
    chmodSync(w.engine.binaryPath, 0o644);
    await expect(w.adapter(w.engine.model('model-ok')).transcribe(pcmChunk(), OPTIONS)).rejects.toMatchObject({ code: TranscriberErrorCode.ENGINE_NOT_FOUND });
    expect(w.engine.lastArgv()).toBeNull();
  });

  it('a missing audio file is AUDIO_NOT_FOUND and no process is started', async () => {
    const w = cpuWorld();
    const chunk = wavFileChunk(w.engine.workDir);
    if (chunk.audio.kind === 'file') rmSync(chunk.audio.path);
    await expect(w.adapter(w.engine.model('model-ok')).transcribe(chunk, OPTIONS)).rejects.toMatchObject({ code: TranscriberErrorCode.AUDIO_NOT_FOUND });
    expect(w.engine.lastArgv()).toBeNull();
  });

  it('a non-zero exit is ENGINE_FAILED with the exit code; a header in the engine output is blanked in the log', async () => {
    const w = cpuWorld();
    await expect(w.adapter(w.engine.model('model-exit3')).transcribe(pcmChunk(), OPTIONS)).rejects.toMatchObject({
      code: TranscriberErrorCode.ENGINE_FAILED,
      detail: { reason: 'ENGINE_EXIT_NON_ZERO', exitCode: 3, stderrTail: expect.stringMatching(/engine fault Authorization: \*\*\*$/) },
    });
    expect(w.runs).toEqual([]);
    expect(errorRecords(w.log)).toHaveLength(1);
    expect(String(errorRecords(w.log)[0]!.context['stderrTail'])).toContain('engine fault');
    expect(w.log.lines.join('\n')).not.toContain('leaked-in-stderr-0001');
  });

  it.each([
    ['model-nofile', TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'OUTPUT_FILE_MISSING'],
    ['model-nojson', TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'OUTPUT_NOT_JSON'],
    ['model-badform', TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'OUTPUT_FORM_UNKNOWN'],
    ['model-lang-en', TranscriberErrorCode.LANGUAGE_MISMATCH, 'LANGUAGE_MISMATCH'],
  ])('engine output %s is refused as %s (%s): no text is made up', async (model, code, reason) => {
    const w = cpuWorld();
    await expect(w.adapter(w.engine.model(model)).transcribe(pcmChunk(), OPTIONS)).rejects.toMatchObject({ code, detail: { reason } });
    expect(errorRecords(w.log).map((record) => record.context['reason'])).toEqual([reason]);
    expect(readdirSync(w.engine.workDir).sort()).toEqual(STAND_IN_FILES);
  });

  it('a hung engine is stopped at its bound and reported as TIMEOUT', async () => {
    const w = cpuWorld({ timeoutMs: 400 });
    await expect(w.adapter(w.engine.model('model-hang')).transcribe(pcmChunk(), OPTIONS)).rejects.toMatchObject({ code: TranscriberErrorCode.TIMEOUT, detail: { reason: 'ENGINE_TIMEOUT' } });
  });
});

describe('configuration (§B.4, §B.7): what rows 113 and 115 hand over', () => {
  const engine = createFakeEngine();
  const runtime: TranscriberRuntime = { physicalCores: 10, cpuLocal: engine.cpuLocal() };

  it('resolves a cpu-local selection to a frozen value with the model inside the model directory', () => {
    const config = resolveTranscriberConfig({ backend: 'cpu-local', endpoint: null, model: 'model-a.q5', language: 'id', credentialRef: null }, runtime);
    const mode = engine.cpuLocal().priority;
    expect(config).toEqual({
      backend: 'cpu-local',
      model: 'model-a.q5',
      language: 'id',
      binaryPath: engine.binaryPath,
      modelDir: engine.modelDir,
      modelPath: join(engine.modelDir, 'model-a.q5.bin'),
      workDir: engine.workDir,
      nicePath: '/usr/bin/nice',
      priority: mode,
      threadPlan: { threads: 8, processors: 1, physicalCores: 10 },
      timeoutMs: ENGINE_TIMEOUT_MS,
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('resolves an omlx-server selection: endpoint, model, language and a credential REFERENCE, never a key', () => {
    const config = resolveTranscriberConfig({ backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000/', model: 'server-model', language: 'id', credentialRef: OMLX_CREDENTIAL_REF }, runtime);
    expect(config).toEqual({ backend: 'omlx-server', model: 'server-model', language: 'id', endpoint: 'http://127.0.0.1:8000', credentialRef: 'omlx-settings:auth.api_key', settingsPath: null, timeoutMs: ENGINE_TIMEOUT_MS });
  });

  it.each([
    ['a model that leaves the model directory', { backend: 'cpu-local', model: '../../etc/passwd' }, 'MODEL_ID_INVALID'],
    ['a model with a separator', { backend: 'cpu-local', model: 'sub/model' }, 'MODEL_ID_INVALID'],
    ['an absolute model path', { backend: 'cpu-local', model: '/tmp/model' }, 'MODEL_ID_INVALID'],
    ['a model with two dots inside', { backend: 'cpu-local', model: 'a..b' }, 'MODEL_ID_INVALID'],
    ['an empty model', { backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000', model: '' }, 'MODEL_ID_INVALID'],
    ['omlx-server without an endpoint', { backend: 'omlx-server', model: 'server-model' }, 'ENDPOINT_REQUIRED'],
    ['another language', { backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000', model: 'server-model', language: 'auto' }, 'LANGUAGE_NOT_SUPPORTED'],
  ] as const)('refuses %s', (_label, selection, reason) => {
    expect(() => resolveTranscriberConfig(selection as SttSelection, runtime)).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.CONFIG_INVALID, detail: expect.objectContaining({ reason }) }));
  });

  it.each(['http://10.0.0.5:8000', 'https://localhost:8000', 'http://127.0.0.1.example.org', 'http://example.org/?u=http://127.0.0.1', 'ftp://127.0.0.1', 'http://127.0.0.2:8000'])(
    'refuses the non-loopback endpoint %s with ENDPOINT_NOT_LOOPBACK, without echoing it',
    (endpoint) => {
      let caught: unknown;
      try {
        resolveTranscriberConfig({ backend: 'omlx-server', endpoint, model: 'server-model' }, runtime);
      } catch (error) {
        caught = error;
      }
      expect(caught).toMatchObject({ code: TranscriberErrorCode.ENDPOINT_NOT_LOOPBACK, detail: { reason: 'ENDPOINT_NOT_LOOPBACK' } });
      expect((caught as Error).message).not.toContain(endpoint);
    },
  );

  it('a cpu-local selection without the host configuration, or with relative host paths, is refused', () => {
    expect(() => resolveTranscriberConfig({ backend: 'cpu-local', model: 'm' }, { physicalCores: 10 })).toThrowError(expect.objectContaining({ detail: { reason: 'CPU_LOCAL_RUNTIME_MISSING' } }));
    expect(() => resolveTranscriberConfig({ backend: 'cpu-local', model: 'm' }, { physicalCores: 10, cpuLocal: { ...runtime.cpuLocal!, binaryPath: 'whisper-cli' } })).toThrowError(expect.objectContaining({ detail: { reason: 'BINARY_PATH_NOT_ABSOLUTE' } }));
    expect(() => resolveCpuModelPath('models', 'm')).toThrowError(expect.objectContaining({ detail: { reason: 'MODEL_DIR_NOT_ABSOLUTE' } }));
  });
});

describe('omlx-server: the answers it refuses (§B.2)', () => {
  const build = (omlx: ReturnType<typeof createFakeOmlx>, model = 'server-model') => {
    const log = createMemoryLog();
    const config = resolveTranscriberConfig(
      { backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000', model, credentialRef: OMLX_CREDENTIAL_REF },
      { physicalCores: 10, omlxServer: { settingsPath: writeSettingsFile(KEY) } },
    );
    return { log, adapter: createTranscriberAdapter(config, { log, fetchImpl: omlx.fetchImpl }) };
  };

  it('sends the prompt as a form member when one is given', async () => {
    const omlx = createFakeOmlx({ key: KEY, models: ['server-model'] });
    await build(omlx).adapter.transcribe(pcmChunk(), { language: 'id', prompt: 'gudang' });
    expect(omlx.calls[0]!.fields).toEqual({ model: 'server-model', language: 'id', prompt: 'gudang' });
  });

  it.each([
    ['a model the server does not serve', { key: KEY, models: ['another-model'] }, TranscriberErrorCode.MODEL_NOT_AVAILABLE, 'MODEL_NOT_AVAILABLE'],
    ['a server error', { key: KEY, models: ['server-model'], status: 500 }, TranscriberErrorCode.ENGINE_FAILED, 'HTTP_ERROR'],
    ['an answer that is not JSON', { key: KEY, models: ['server-model'], rawBody: '<html>' }, TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'OUTPUT_NOT_JSON'],
    ['an answer of an unknown form', { key: KEY, models: ['server-model'], answer: { text: 'x', segments: [{ start: 'zero', end: 1, text: 'x' }] } }, TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'OUTPUT_FORM_UNKNOWN'],
    ['text without a single segment', { key: KEY, models: ['server-model'], answer: { text: 'Selamat pagi.', language: 'id', segments: [] } }, TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'SEGMENTS_MISSING'],
    ['another language', { key: KEY, models: ['server-model'], answer: { text: 'Good morning.', language: 'en', segments: [{ start: 0, end: 1, text: 'Good morning.' }] } }, TranscriberErrorCode.LANGUAGE_MISMATCH, 'LANGUAGE_MISMATCH'],
  ] as const)('%s is refused: no text is made up', async (_label, options, code, reason) => {
    const { adapter, log } = build(createFakeOmlx(options));
    await expect(adapter.transcribe(pcmChunk(), OPTIONS)).rejects.toMatchObject({ code, detail: { reason } });
    expect(log.records().map((record) => [record.level, record.context['reason']])).toEqual([['error', reason]]);
    expect(log.lines.join('\n')).not.toContain(KEY);
  });

  it('silence is an empty result, not an error', async () => {
    const { adapter } = build(createFakeOmlx({ key: KEY, models: ['server-model'], answer: { text: '', language: 'id', segments: [] } }));
    expect(await adapter.transcribe(pcmChunk(), OPTIONS)).toEqual({ engine: 'omlx-server', model: 'server-model', language: 'id', text: '', segments: [] });
  });

  it('a credential reference this transcriber does not read stops the adapter from being built, and the failure is logged', () => {
    const log = createMemoryLog();
    const config = resolveTranscriberConfig({ backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000', model: 'server-model', credentialRef: 'vault:stt/key' }, { physicalCores: 10 });
    expect(() => createTranscriberAdapter(config, { log })).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.CREDENTIAL_REF_UNSUPPORTED }));
    expect(log.records()).toHaveLength(1);
    expect(log.records()[0]).toMatchObject({ level: 'error', source: 'transcriber.adapter.create', context: { backend: 'omlx-server' } });
  });
});

describe('the connection probe (op 92; §B.7 "Test connection")', () => {
  const engine = createFakeEngine();
  const runtime: TranscriberRuntime = {
    physicalCores: 10,
    cpuLocal: engine.cpuLocal(),
    omlxServer: { settingsPath: writeSettingsFile(KEY) },
  };
  const options = () => ({ signal: new AbortController().signal, timeoutMs: 3_000 });
  const server = { enabled: true, backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000', model: 'server-model' };
  const probeWith = (omlx: ReturnType<typeof createFakeOmlx>, credentialRef: string | null = OMLX_CREDENTIAL_REF) => {
    const log = createMemoryLog();
    return { log, probe: createConnectionProbe({ runtime, log, credentialRef: () => credentialRef, fetchImpl: omlx.fetchImpl }) };
  };

  it('asks the model list once, with the key as a header, and sends no audio', async () => {
    const omlx = createFakeOmlx({ key: KEY, models: ['server-model', 'other'] });
    expect(await probeWith(omlx).probe(server, options())).toEqual({ reachable: true, modelAvailable: true, detailCode: 'OK' });
    expect(omlx.calls).toHaveLength(1);
    expect(omlx.calls[0]).toMatchObject({ method: 'GET', path: '/v1/models', authorization: `Bearer ${KEY}`, fileBytes: 0 });
  });

  it('reports each outcome as a result with its code', async () => {
    expect(await probeWith(createFakeOmlx({ key: KEY, models: ['other'] })).probe(server, options())).toEqual({ reachable: true, modelAvailable: false, detailCode: 'MODEL_NOT_AVAILABLE' });
    expect(await probeWith(createFakeOmlx({ key: 'another-key-331', models: ['server-model'] })).probe(server, options())).toEqual({ reachable: true, modelAvailable: false, detailCode: 'CREDENTIAL_REJECTED' });
    expect(await probeWith(createFakeOmlx({ key: KEY, models: ['server-model'] }), null).probe(server, options())).toEqual({ reachable: true, modelAvailable: false, detailCode: 'CREDENTIAL_REJECTED' });
    const refused = probeWith(createFakeOmlx({ key: KEY, models: [], refuse: true }));
    expect(await refused.probe(server, options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'UNREACHABLE' });
    expect(refused.log.records().map((record) => record.level)).toEqual(['warn']);
    expect(refused.log.lines.join('\n')).not.toContain(KEY);
  });

  it('a disabled configuration is not probed at all', async () => {
    const omlx = createFakeOmlx({ key: KEY, models: ['server-model'] });
    expect(await probeWith(omlx).probe({ ...server, enabled: false }, options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'DISABLED' });
    expect(omlx.calls).toHaveLength(0);
  });

  it('a non-loopback endpoint is refused by the probe too, and nothing is sent', async () => {
    const omlx = createFakeOmlx({ key: KEY, models: ['server-model'] });
    await expect(probeWith(omlx).probe({ ...server, endpoint: 'http://192.168.0.9:8000' }, options())).rejects.toMatchObject({ code: TranscriberErrorCode.ENDPOINT_NOT_LOOPBACK });
    expect(omlx.calls).toHaveLength(0);
  });

  it('cpu-local: the engine and the model file are looked for; nothing is started', async () => {
    const omlx = createFakeOmlx({ key: KEY, models: [] });
    const { probe } = probeWith(omlx);
    writeFileSync(join(engine.modelDir, 'present.bin'), '');
    expect(await probe({ enabled: true, backend: 'cpu-local', endpoint: null, model: 'present' }, options())).toEqual({ reachable: true, modelAvailable: true, detailCode: 'OK' });
    expect(await probe({ enabled: true, backend: 'cpu-local', endpoint: null, model: 'absent' }, options())).toEqual({ reachable: true, modelAvailable: false, detailCode: 'MODEL_NOT_AVAILABLE' });
    expect(engine.lastArgv()).toBeNull();
    expect(omlx.calls).toHaveLength(0);
  });
});

describe('fix round 1 — N-2: `stt_config.model` is a model IDENTIFIER (controller ruling on D-76-1)', () => {
  const engine = createFakeEngine();
  const runtime: TranscriberRuntime = { physicalCores: 10, cpuLocal: engine.cpuLocal() };
  const resolve = (model: string, backend = 'cpu-local') => resolveTranscriberConfig({ backend, model, endpoint: backend === 'cpu-local' ? null : 'http://127.0.0.1:8000' }, runtime);

  it('the SEEDED default row resolves to `<modelDir>/ggml-large-v3-turbo.bin` and runs when that file is there', async () => {
    expect(STT_CONFIG_DEFAULT).toMatchObject({ backend: 'cpu-local', model: 'ggml-large-v3-turbo', endpoint: null });
    const config = resolveTranscriberConfig({ backend: STT_CONFIG_DEFAULT.backend, endpoint: STT_CONFIG_DEFAULT.endpoint, model: STT_CONFIG_DEFAULT.model }, runtime) as CpuLocalConfig;
    expect(config.model).toBe('ggml-large-v3-turbo');
    expect(config.modelPath).toBe(join(engine.modelDir, 'ggml-large-v3-turbo.bin'));
    // Before the file exists: MODEL_NOT_FOUND. With `<id>.bin` in place: a transcript.
    const adapter = createTranscriberAdapter(config, { log: createMemoryLog() });
    await expect(adapter.transcribe(pcmChunk(), OPTIONS)).rejects.toMatchObject({ code: TranscriberErrorCode.MODEL_NOT_FOUND });
    engine.model(STT_CONFIG_DEFAULT.model);
    expect((await adapter.transcribe(pcmChunk(), OPTIONS)).model).toBe('ggml-large-v3-turbo');
    expect(engine.lastArgv()!.slice(0, 2)).toEqual(['-m', join(engine.modelDir, 'ggml-large-v3-turbo.bin')]);
  });

  it('a file of the bare id (no extension) is NOT the model: only `<id>.bin` is', async () => {
    const other = createFakeEngine();
    writeFileSync(join(other.modelDir, 'bare-id'), '');
    const config = resolveTranscriberConfig({ backend: 'cpu-local', model: 'bare-id' }, { physicalCores: 10, cpuLocal: other.cpuLocal() });
    await expect(createTranscriberAdapter(config, { log: createMemoryLog() }).transcribe(pcmChunk(), OPTIONS)).rejects.toMatchObject({ code: TranscriberErrorCode.MODEL_NOT_FOUND });
  });

  const refused = ['ggml-large-v3-turbo.bin', 'model.BIN', 'x.Bin', '../outside', 'sub/model', 'sub\\model', '/abs/model', 'a..b', '..', '-ng', '--help', '.hidden', 'nul\u0000inside', 'new\nline', 'with space', '', 'x'.repeat(129)];
  it.each(refused)('refuses %j as a model for BOTH backends (MODEL_ID_INVALID)', (model) => {
    for (const backend of ['cpu-local', 'omlx-server']) {
      expect(() => resolve(model, backend)).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.CONFIG_INVALID, detail: { reason: 'MODEL_ID_INVALID' } }));
    }
    expect(() => resolveCpuModelPath(engine.modelDir, model)).toThrowError(expect.objectContaining({ detail: { reason: 'MODEL_ID_INVALID' } }));
  });

  it('accepts exactly what the ONE shared pattern accepts: the transcriber and operation 91 cannot disagree', () => {
    // The pattern itself is row 113's and may tighten; what is pinned here is that both sides use the SAME one.
    expect(STT_MODEL_ID_PATTERN.test(STT_CONFIG_DEFAULT.model)).toBe(true);
    const candidates = [...refused, 'ggml-large-v3-turbo', 'whisper-large-v3-turbo', 'mlx-community--whisper-large-v3-turbo-asr-fp16', 'model-a.q5_0', 'A', 'x'.repeat(128), 'a.binary', 'bin'];
    for (const model of candidates) {
      let accepted = true;
      try {
        resolve(model);
      } catch {
        accepted = false;
      }
      expect(accepted, `the transcriber and the shared pattern disagree on ${JSON.stringify(model)}`).toBe(isSttModelId(model));
    }
    expect(candidates.filter(isSttModelId).length).toBeGreaterThanOrEqual(6);
    expect(refused.filter(isSttModelId)).toEqual([]);
  });

  it('for `omlx-server` the id is sent to the server as it is, with no extension added', async () => {
    const id = 'mlx-community--whisper-large-v3-turbo-asr-fp16';
    const omlx = createFakeOmlx({ key: null, models: [id] });
    const adapter = createTranscriberAdapter(resolve(id, 'omlx-server'), { log: createMemoryLog(), fetchImpl: omlx.fetchImpl });
    await adapter.transcribe(pcmChunk(), OPTIONS);
    expect(omlx.calls[0]!.fields['model']).toBe(id);
  });
});

describe('fix round 1 — N-7: the model file stays inside the model directory', () => {
  it('a link in the model directory that leads outside it is refused, and no engine is started', async () => {
    const w = cpuWorld();
    const outside = join(scratchDir('outside'), 'real-model.bin');
    writeFileSync(outside, '');
    symlinkSync(outside, join(w.engine.modelDir, 'linked-out.bin'));
    await expect(w.adapter('linked-out').transcribe(pcmChunk(), OPTIONS)).rejects.toMatchObject({ code: TranscriberErrorCode.MODEL_OUTSIDE_MODEL_DIR, detail: { reason: 'MODEL_OUTSIDE_MODEL_DIR', model: 'linked-out' } });
    expect(w.engine.lastArgv()).toBeNull();
    expect(errorRecords(w.log).map((record) => record.context['code'])).toEqual(['MODEL_OUTSIDE_MODEL_DIR']);
  });

  it('a link to a directory beside the model directory whose name only STARTS like it is refused too', async () => {
    const w = cpuWorld();
    const sibling = `${w.engine.modelDir}-evil`;
    mkdirSync(sibling);
    writeFileSync(join(sibling, 'm.bin'), '');
    symlinkSync(join(sibling, 'm.bin'), join(w.engine.modelDir, 'prefix-trick.bin'));
    await expect(w.adapter('prefix-trick').transcribe(pcmChunk(), OPTIONS)).rejects.toMatchObject({ code: TranscriberErrorCode.MODEL_OUTSIDE_MODEL_DIR });
  });

  it('negative control: a link that stays inside the model directory is a model like any other', async () => {
    const w = cpuWorld();
    w.engine.model('model-ok');
    symlinkSync(join(w.engine.modelDir, 'model-ok.bin'), join(w.engine.modelDir, 'alias-ok.bin'));
    expect((await w.adapter('alias-ok').transcribe(pcmChunk(), OPTIONS)).segments).toHaveLength(2);
  });

  it('the connection probe reports such a model as not available', async () => {
    const engine = createFakeEngine();
    const outside = join(scratchDir('outside'), 'real-model.bin');
    writeFileSync(outside, '');
    symlinkSync(outside, join(engine.modelDir, 'linked-out.bin'));
    const probe = createConnectionProbe({ runtime: { physicalCores: 10, cpuLocal: engine.cpuLocal() }, log: createMemoryLog(), credentialRef: () => null });
    expect(await probe({ enabled: true, backend: 'cpu-local', endpoint: null, model: 'linked-out' }, { signal: new AbortController().signal, timeoutMs: 1_000 })).toEqual({ reachable: true, modelAvailable: false, detailCode: 'MODEL_NOT_AVAILABLE' });
  });
});

describe('fix round 1 — N-8: `localhost` is connected as the address 127.0.0.1, never resolved as a name', () => {
  it.each([
    ['http://localhost:8000', 'http://127.0.0.1:8000/v1/models'],
    ['http://localhost', 'http://127.0.0.1/v1/models'],
    ['http://localhost:8000/base/', 'http://127.0.0.1:8000/base/v1/models'],
  ])('%s is requested at %s', async (endpoint, url) => {
    const urls: string[] = [];
    const omlx = createFakeOmlx({ key: KEY, models: ['server-model'] });
    const http = createOmlxHttp({ endpoint, credential: null, timeoutMs: 1_000, fetchImpl: (input, init) => (urls.push(input), omlx.fetchImpl(input, init)) });
    await http.get('/v1/models');
    expect(urls).toEqual([url]);
    expect(urls[0]).not.toContain('localhost');
    // The client sets no Host header: the runtime derives it from the address and drops a set one.
    expect(omlx.calls[0]!.hostHeader).toBeNull();
    expect(connectionTarget(endpoint)).toBe(url.replace('/v1/models', ''));
  });

  it('an endpoint written with the address is requested as written', async () => {
    const urls: string[] = [];
    const omlx = createFakeOmlx({ key: KEY, models: ['server-model'] });
    const http = createOmlxHttp({ endpoint: 'http://127.0.0.1:8000', credential: null, timeoutMs: 1_000, fetchImpl: (input, init) => (urls.push(input), omlx.fetchImpl(input, init)) });
    await http.get('/v1/models');
    expect(urls).toEqual(['http://127.0.0.1:8000/v1/models']);
    expect(omlx.calls[0]!.hostHeader).toBeNull();
  });

  it('through the adapter and through the probe alike: a `localhost` configuration never reaches the transport as a name', async () => {
    const urls: string[] = [];
    const omlx = createFakeOmlx({ key: KEY, models: ['server-model'] });
    const fetchImpl = (input: string, init: RequestInit): Promise<Response> => (urls.push(input), omlx.fetchImpl(input, init));
    const runtime: TranscriberRuntime = { physicalCores: 10, omlxServer: { settingsPath: writeSettingsFile(KEY) } };
    const selection = { backend: 'omlx-server', endpoint: 'http://localhost:8000', model: 'server-model', credentialRef: OMLX_CREDENTIAL_REF };
    await createTranscriberAdapter(resolveTranscriberConfig(selection, runtime), { log: createMemoryLog(), fetchImpl }).transcribe(pcmChunk(), OPTIONS);
    await createConnectionProbe({ runtime, log: createMemoryLog(), credentialRef: () => OMLX_CREDENTIAL_REF, fetchImpl })({ enabled: true, ...selection }, { signal: new AbortController().signal, timeoutMs: 1_000 });
    expect(urls).toEqual(['http://127.0.0.1:8000/v1/audio/transcriptions', 'http://127.0.0.1:8000/v1/models']);
    expect(omlx.calls.map((call) => call.host)).toEqual(['127.0.0.1:8000', '127.0.0.1:8000']);
    expect(omlx.calls.map((call) => call.hostHeader)).toEqual([null, null]);
  });
});

describe('fix round 1 — N-9: an endpoint with a query, a fragment or a stray character is refused', () => {
  const runtime: TranscriberRuntime = { physicalCores: 10 };
  it.each([
    ['http://127.0.0.1:8000/#@evil.example', 'ENDPOINT_HAS_QUERY_OR_FRAGMENT'],
    ['http://127.0.0.1:8000/?x=@evil.example', 'ENDPOINT_HAS_QUERY_OR_FRAGMENT'],
    ['http://localhost:8000/v1?model=x', 'ENDPOINT_HAS_QUERY_OR_FRAGMENT'],
    ['http://localhost:8000/v1#top', 'ENDPOINT_HAS_QUERY_OR_FRAGMENT'],
    ['http://127.0.0.1:8000/\\@evil.example', 'ENDPOINT_MALFORMED'],
    ['http://127.0.0.1:8000/a\tb', 'ENDPOINT_MALFORMED'],
    ['http://127.0.0.1:8000/a b', 'ENDPOINT_MALFORMED'],
    ['http://127.0.0.1:8000/a\u0000b', 'ENDPOINT_MALFORMED'],
    ['http://127.0.0.1:8000#@evil.example', 'ENDPOINT_NOT_LOOPBACK'],
  ])('%j is refused (%s) by the configuration AND by the HTTP client, and nothing is sent', (endpoint, reason) => {
    expect(() => resolveTranscriberConfig({ backend: 'omlx-server', endpoint, model: 'server-model' }, runtime)).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.ENDPOINT_NOT_LOOPBACK, detail: { reason } }));
    const omlx = createFakeOmlx({ key: null, models: [] });
    expect(() => createOmlxHttp({ endpoint, credential: null, timeoutMs: 1_000, fetchImpl: omlx.fetchImpl })).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.ENDPOINT_NOT_LOOPBACK, detail: { reason } }));
    expect(omlx.calls).toHaveLength(0);
  });

  it('negative control: a plain path is still accepted, and the request path is appended to it, not lost', async () => {
    const omlx = createFakeOmlx({ key: null, models: [] });
    const http = createOmlxHttp({ endpoint: 'http://127.0.0.1:8000/base', credential: null, timeoutMs: 1_000, fetchImpl: omlx.fetchImpl });
    await http.get('/v1/models');
    expect(omlx.calls[0]!.path).toBe('/base/v1/models');
  });
});

describe('fix round 1 — N-13: chunk audio the engines are not given fails closed, before any engine or request', () => {
  const tone = new Int16Array(1_600).fill(300);
  const bad: readonly (readonly [string, unknown, string])[] = [
    ['PCM at 8000 Hz', { audio: { kind: 'pcm16', samples: tone }, sampleRateHz: 8_000 }, 'PCM_SAMPLE_RATE_NOT_16000'],
    ['PCM at 44100 Hz', { audio: { kind: 'pcm16', samples: tone }, sampleRateHz: 44_100 }, 'PCM_SAMPLE_RATE_NOT_16000'],
    ['PCM at 48000 Hz (the capture rate, not resampled)', { audio: { kind: 'pcm16', samples: tone }, sampleRateHz: 48_000 }, 'PCM_SAMPLE_RATE_NOT_16000'],
    ['float samples', { audio: { kind: 'pcm16', samples: new Float32Array(1_600) }, sampleRateHz: 16_000 }, 'PCM_NOT_SIGNED_16_BIT'],
    ['8-bit samples', { audio: { kind: 'pcm16', samples: new Int8Array(1_600) }, sampleRateHz: 16_000 }, 'PCM_NOT_SIGNED_16_BIT'],
    ['no samples', { audio: { kind: 'pcm16', samples: new Int16Array(0) }, sampleRateHz: 16_000 }, 'PCM_EMPTY'],
  ];

  /** A WAV header of the given form over one second of silence. */
  const wavFile = (label: string, change: (header: Buffer) => void): TranscriberChunk => {
    const bytes = encodeWavPcm16(new Int16Array(16_000), 16_000);
    change(bytes);
    const path = join(scratchDir('audio'), `${label}.wav`);
    writeFileSync(path, bytes);
    return { audio: { kind: 'file', path }, sampleRateHz: 16_000, offsetMs: 0, durationMs: 1_000 };
  };
  const badFiles: readonly (readonly [string, TranscriberChunk, string])[] = [
    ['a stereo file', wavFile('stereo', (h) => h.writeUInt16LE(2, 22)), 'WAV_NOT_MONO'],
    ['an 8-bit file', wavFile('eight', (h) => h.writeUInt16LE(8, 34)), 'WAV_NOT_16_BIT'],
    ['a float file', wavFile('float', (h) => h.writeUInt16LE(3, 20)), 'WAV_NOT_INTEGER_PCM'],
    ['a file that is not a WAV', wavFile('text', (h) => h.write('ID3 ', 0, 'ascii')), 'NOT_A_WAV_FILE'],
  ];

  it.each([...bad.map(([label, chunk, reason]) => [label, { offsetMs: 0, durationMs: 100, ...(chunk as object) } as TranscriberChunk, reason] as const), ...badFiles])(
    '%s is AUDIO_FORMAT_UNSUPPORTED on both backends',
    async (_label, chunk, reason) => {
      const w = cpuWorld();
      await expect(w.adapter(w.engine.model('model-ok')).transcribe(chunk, OPTIONS)).rejects.toMatchObject({ code: TranscriberErrorCode.AUDIO_FORMAT_UNSUPPORTED, detail: { reason } });
      expect(w.engine.lastArgv()).toBeNull();
      expect(errorRecords(w.log).map((record) => record.context['reason'])).toEqual([reason]);

      const omlx = createFakeOmlx({ key: null, models: ['server-model'] });
      const log = createMemoryLog();
      const server = createTranscriberAdapter(resolveTranscriberConfig({ backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000', model: 'server-model' }, { physicalCores: 10 }), { log, fetchImpl: omlx.fetchImpl });
      await expect(server.transcribe(chunk, OPTIONS)).rejects.toMatchObject({ code: TranscriberErrorCode.AUDIO_FORMAT_UNSUPPORTED, detail: { reason } });
      expect(omlx.calls).toHaveLength(0);
    },
  );

  it('negative control: 16 kHz PCM, and a mono 16-bit WAV of another rate (the sealed fixture is 24 kHz), are accepted by both', async () => {
    const w = cpuWorld();
    const adapter = w.adapter(w.engine.model('model-ok'));
    const file24k = wavFile('rate24k', (h) => (h.writeUInt32LE(24_000, 24), h.writeUInt32LE(48_000, 28)));
    expect((await adapter.transcribe(pcmChunk(), OPTIONS)).segments).toHaveLength(2);
    expect((await adapter.transcribe(file24k, OPTIONS)).segments).toHaveLength(2);
    const omlx = createFakeOmlx({ key: null, models: ['server-model'] });
    const server = createTranscriberAdapter(resolveTranscriberConfig({ backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000', model: 'server-model' }, { physicalCores: 10 }), { log: createMemoryLog(), fetchImpl: omlx.fetchImpl });
    expect((await server.transcribe(file24k, OPTIONS)).segments).toHaveLength(2);
    expect(omlx.calls).toHaveLength(1);
  });
});
