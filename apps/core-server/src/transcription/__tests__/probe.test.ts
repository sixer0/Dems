// The probe of operation 92 in production wiring (blueprint row 115; C3 §2.5 "Test connection";
// D68(d); pair-113 N-14; SEC35-14). No database and no app: the probe itself, with
//
//   - `omlx-server` against a LOOPBACK FAKE that speaks the model-list API, through the real
//     transport of the transcriber (`fetch`) and its single key-loader reading a settings file that
//     holds a CANARY key. The real oMLX server is never started here (D7(d));
//   - `cpu-local` against stand-in engine files, and against the REAL files of this host when they
//     are there (`.cache/stt/…`, git-ignored) - a presence and build check, no engine is started.
//
// Every "refused" case has its control beside it: the same call answers `OK` when the one thing
// that is wrong is put right.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createMemoryLog, SerialQueue } from '@dems/transcriber';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { GPU_BACKEND_MARKERS, cpuOnlyBuildOf, createCoreSttProbe, readTranscriberHost, type RevealedSttCredential } from '../index';
import { CPU_MODEL, KEY_CANARY, REFERENCE, SERVER_MODEL, closedPort, fullHost, makeDataDir, startFakeOmlx, type FakeOmlx } from './support';

const dir = makeDataDir('probe');
dir.writeHost(fullHost(dir));
const fakes: FakeOmlx[] = [];
const fake = async (options?: Parameters<typeof startFakeOmlx>[0]): Promise<FakeOmlx> => {
  const started = await startFakeOmlx(options);
  fakes.push(started);
  return started;
};

afterEach(async () => {
  await Promise.all(fakes.splice(0).map((entry) => entry.close()));
});
afterAll(() => rmSync(dir.dataDir, { recursive: true, force: true }));

interface Rig {
  readonly probe: ReturnType<typeof createCoreSttProbe>;
  readonly log: ReturnType<typeof createMemoryLog>;
  reveals: number;
}

function rig(revealed: RevealedSttCredential = { kind: 'REFERENCE', ref: REFERENCE }, dataDir = dir.dataDir): Rig {
  const log = createMemoryLog();
  const state: Rig = {
    log,
    reveals: 0,
    probe: createCoreSttProbe({
      host: () => readTranscriberHost(dataDir, () => 8),
      reveal: async () => {
        state.reveals += 1;
        return revealed;
      },
      transcriberLog: log,
      queue: new SerialQueue(),
    }),
  };
  return state;
}

const options = (): { signal: AbortSignal; timeoutMs: number } => ({ signal: new AbortController().signal, timeoutMs: 3_000 });
const server = (endpoint: string, model = SERVER_MODEL, credentialKind: 'REFERENCE' | 'ENCRYPTED' | null = 'REFERENCE') => ({ enabled: true, backend: 'omlx-server' as const, endpoint, model, credentialKind });
const local = (model = CPU_MODEL) => ({ enabled: true, backend: 'cpu-local' as const, endpoint: null, model, credentialKind: null });

describe('omlx-server: one authenticated model-list request on loopback, through the single key-loader', () => {
  it('reachable and model available, 2 runs: ONE GET /v1/models per test, with the key of the settings file, to the configured port', async () => {
    const omlx = await fake();
    const { probe, log } = rig();
    for (let run = 1; run <= 2; run += 1) {
      expect(await probe(server(omlx.endpoint), options())).toEqual({ reachable: true, modelAvailable: true, detailCode: 'OK' });
      expect(omlx.requests).toHaveLength(run);
    }
    expect(omlx.requests[0]).toEqual({ method: 'GET', url: '/v1/models', host: `127.0.0.1:${omlx.port}`, authorization: `Bearer ${KEY_CANARY}` });
    // The key reached the server and nothing else: no log line holds it.
    expect(log.lines.join('\n')).not.toContain(KEY_CANARY);
    console.info(`[row115] op-92 probe omlx-server (loopback fake) | runs=2 requests=${omlx.requests.length} result=OK path=${omlx.requests[0]?.url}`);
  });

  it('an endpoint written `localhost` is connected as 127.0.0.1: the request line names the address, never the name', async () => {
    const omlx = await fake();
    const { probe } = rig();
    expect(await probe(server(`http://localhost:${omlx.port}`), options())).toMatchObject({ reachable: true, modelAvailable: true });
    expect(omlx.requests.map((request) => request.host)).toEqual([`127.0.0.1:${omlx.port}`]);
  });

  it('a redirect is NOT followed: the port it points at receives nothing, and so never the key', async () => {
    const elsewhere = await fake();
    const omlx = await fake({ redirectTo: `${elsewhere.endpoint}/v1/models` });
    const { probe } = rig();
    expect(await probe(server(omlx.endpoint), options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'UNREACHABLE' });
    expect(omlx.requests).toHaveLength(1);
    expect(elsewhere.requests).toEqual([]);
    // Control: the same second server IS reachable when it is the configured endpoint.
    expect(await probe(server(elsewhere.endpoint), options())).toMatchObject({ reachable: true });
    expect(elsewhere.requests).toHaveLength(1);
  });

  it('nothing listens on the endpoint (the unreachable case), 2 runs: a result, not an exception', async () => {
    const port = await closedPort();
    const { probe, log } = rig();
    for (let run = 1; run <= 2; run += 1) {
      expect(await probe(server(`http://127.0.0.1:${port}`), options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'UNREACHABLE' });
    }
    expect(log.lines.join('\n')).not.toContain(KEY_CANARY);
    console.info('[row115] op-92 probe omlx-server (nothing listens) | runs=2 result=UNREACHABLE reachable=false');
  });

  it('the server refuses the key: CREDENTIAL_REJECTED; the model is not served: MODEL_NOT_AVAILABLE', async () => {
    const strict = await fake({ key: 'another-key' });
    const { probe } = rig();
    expect(await probe(server(strict.endpoint), options())).toEqual({ reachable: true, modelAvailable: false, detailCode: 'CREDENTIAL_REJECTED' });
    const other = await fake({ models: ['qwen3-asr-1.7b-8bit'] });
    expect(await probe(server(other.endpoint), options())).toEqual({ reachable: true, modelAvailable: false, detailCode: 'MODEL_NOT_AVAILABLE' });
  });

  it('no credential stored: the request carries no Authorization header and the reveal function is not asked', async () => {
    const open = await fake({ key: null });
    const state = rig();
    expect(await state.probe(server(open.endpoint, SERVER_MODEL, null), options())).toMatchObject({ reachable: true, modelAvailable: true });
    expect(open.requests[0]?.authorization).toBeUndefined();
    expect(state.reveals).toBe(0);
  });

  it('a stored ENCRYPTED credential (the seam): CREDENTIAL_UNAVAILABLE, no connection, the envelope is never asked for', async () => {
    const omlx = await fake();
    const state = rig({ kind: 'ENCRYPTED', sealed: { keyRef: 'STT_API_KEY_K_X', ciphertext: new Uint8Array(80), nonce: new Uint8Array(12) } });
    expect(await state.probe(server(omlx.endpoint, SERVER_MODEL, 'ENCRYPTED'), options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'CREDENTIAL_UNAVAILABLE' });
    expect(omlx.requests).toEqual([]);
    expect(state.reveals).toBe(0);
    // The row changed between the read of the module and the reveal: also no connection.
    expect(await state.probe(server(omlx.endpoint), options())).toMatchObject({ reachable: false, detailCode: 'CREDENTIAL_UNAVAILABLE' });
    expect(omlx.requests).toEqual([]);
  });

  it('disabled: DISABLED without a request; an endpoint the transcriber refuses: CONFIG_INVALID without a request', async () => {
    const omlx = await fake();
    const state = rig();
    expect(await state.probe({ ...server(omlx.endpoint), enabled: false }, options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'DISABLED' });
    expect(await state.probe(server(`${omlx.endpoint}/v1?x=1`), options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'CONFIG_INVALID' });
    expect(omlx.requests).toEqual([]);
  });

  it('the signal of the time limit ends the request: TIMEOUT', async () => {
    const { createServer } = await import('node:http');
    // A server that accepts and never answers.
    const silent = createServer(() => undefined);
    await new Promise<void>((done) => silent.listen(0, '127.0.0.1', done));
    const port = (silent.address() as { port: number }).port;
    const abort = new AbortController();
    const pending = rig().probe(server(`http://127.0.0.1:${port}`), { signal: abort.signal, timeoutMs: 3_000 });
    abort.abort();
    expect(await pending).toEqual({ reachable: false, modelAvailable: false, detailCode: 'TIMEOUT' });
    silent.closeAllConnections();
    await new Promise<void>((done) => silent.close(() => done()));
  });
});

describe('cpu-local: engine and model present, CPU-only build; no engine is started', () => {
  it('stand-in files: OK; the reveal function is never asked and no request is made', async () => {
    const state = rig();
    expect(await state.probe(local(), options())).toEqual({ reachable: true, modelAvailable: true, detailCode: 'OK' });
    expect(state.reveals).toBe(0);
  });

  it('the model file is absent: reachable, MODEL_NOT_AVAILABLE; the engine is absent: UNREACHABLE', async () => {
    expect(await rig().probe(local('ggml-tiny'), options())).toEqual({ reachable: true, modelAvailable: false, detailCode: 'MODEL_NOT_AVAILABLE' });
    const other = makeDataDir('probe-noengine');
    other.writeHost({ version: 1, cpuLocal: { binaryPath: join(other.dataDir, 'engine', 'absent'), modelDir: other.modelDir } });
    expect(await rig(undefined, other.dataDir).probe(local(), options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'UNREACHABLE' });
    rmSync(other.dataDir, { recursive: true, force: true });
  });

  it('the host states no engine: CONFIG_INVALID; the host file cannot be read as its form: HOST_CONFIG_INVALID', async () => {
    const bare = makeDataDir('probe-nohost');
    expect(await rig(undefined, bare.dataDir).probe(local(), options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'CONFIG_INVALID' });
    bare.writeHostText('{ "version": 1, "cpuLocal": { "binaryPath": "relative/whisper-cli", "modelDir": "/x" } }');
    expect(await rig(undefined, bare.dataDir).probe(local(), options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'HOST_CONFIG_INVALID' });
    rmSync(bare.dataDir, { recursive: true, force: true });
  });

  it('an executable that names a GPU backend is refused: ENGINE_NOT_CPU_ONLY (every marker; also across a read boundary)', async () => {
    const gpu = makeDataDir('probe-gpu');
    gpu.writeHost(fullHost(gpu));
    const clean = readFileSync(gpu.binaryPath);
    expect(cpuOnlyBuildOf(gpu.binaryPath)).toEqual({ cpuOnly: true });
    for (const marker of GPU_BACKEND_MARKERS) {
      writeFileSync(gpu.binaryPath, Buffer.concat([clean, Buffer.alloc(64, 1), Buffer.from(marker, 'latin1'), Buffer.alloc(marker.length, 2)]));
      expect(cpuOnlyBuildOf(gpu.binaryPath), marker).toEqual({ cpuOnly: false, reason: 'GPU_BACKEND_NAMED', marker });
    }
    // The marker starts 5 bytes before the end of the first megabyte: it lies across two reads.
    const marker = 'Metal.framework';
    writeFileSync(gpu.binaryPath, Buffer.concat([Buffer.alloc((1 << 20) - 5, 3), Buffer.from(marker, 'latin1'), Buffer.alloc(4_096, 4)]));
    expect(cpuOnlyBuildOf(gpu.binaryPath)).toEqual({ cpuOnly: false, reason: 'GPU_BACKEND_NAMED', marker });
    expect(await rig(undefined, gpu.dataDir).probe(local(), options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'ENGINE_NOT_CPU_ONLY' });
    // Control: the same file without the marker, of the same length, passes.
    writeFileSync(gpu.binaryPath, Buffer.concat([Buffer.alloc((1 << 20) - 5, 3), Buffer.alloc(marker.length, 5), Buffer.alloc(4_096, 4)]));
    expect(await rig(undefined, gpu.dataDir).probe(local(), options())).toEqual({ reachable: true, modelAvailable: true, detailCode: 'OK' });
    rmSync(gpu.dataDir, { recursive: true, force: true });
  });

  // The REAL engine files of this host (row 107 / 110 build, git-ignored). Present on the
  // development Mac; a host without them prints that it did not run this case.
  const repo = resolve(import.meta.dirname, '../../../../..');
  const realBinary = join(repo, '.cache/stt/whisper.cpp/build/bin/whisper-cli');
  const realModels = join(repo, '.cache/stt/models');
  const realThere = existsSync(realBinary) && existsSync(join(realModels, `${CPU_MODEL}.bin`));
  it.runIf(realThere)('the REAL cpu-local files of this host, 2 runs: present, CPU-only build, and no engine process is started', async () => {
    const real = makeDataDir('probe-real');
    real.writeHost({ version: 1, cpuLocal: { binaryPath: realBinary, modelDir: realModels } });
    const { probe } = rig(undefined, real.dataDir);
    for (let run = 1; run <= 2; run += 1) expect(await probe(local(), options())).toEqual({ reachable: true, modelAvailable: true, detailCode: 'OK' });
    expect(cpuOnlyBuildOf(realBinary)).toEqual({ cpuOnly: true });
    expect(await probe(local('ggml-absent-model'), options())).toEqual({ reachable: true, modelAvailable: false, detailCode: 'MODEL_NOT_AVAILABLE' });
    console.info(`[row115] op-92 probe cpu-local (real files of this host) | runs=2 result=OK cpuOnly=true markersSearched=${GPU_BACKEND_MARKERS.length} engineStarted=no`);
    rmSync(real.dataDir, { recursive: true, force: true });
  });
  if (!realThere) console.info('[row115] op-92 probe cpu-local (real files): NOT RUN - the engine build is not on this host');
});
