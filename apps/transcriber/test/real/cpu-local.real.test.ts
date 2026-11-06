// Blueprint row 76 Verification — the `cpu-local` backend exercised FOR REAL: `whisper-cli -ng` of
// the GPU-off build (row 107) with the row-108 model on the sealed two-voice Indonesian fixture,
// THROUGH THE ADAPTER. It must reproduce the row-109/110 result byte for byte (14 segments, the
// same SHA-256 of the raw engine output). Negative controls: a wrong model path, a corrupted
// fixture. No duration is measured or written anywhere (D230).
//
// Run alone:  npm run test:real:cpu-local -w @dems/transcriber
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTranscriberAdapter } from '../../src/adapter';
import { resolveTranscriberConfig, type TranscriberRuntime } from '../../src/config';
import { SEALED_TWO_SPEAKER_FIXTURE, createTtsFixtureProvider } from '../../src/fixtures/tts-fixture-provider';
import { detectPhysicalCores } from '../../src/host/physical-cores';
import { createMemoryLog } from '../../src/log';
import { TranscribeResultSchema, TranscriberErrorCode, type EngineRunRecord, type TranscriberChunk } from '../../src/types';
import { readWavFacts } from '../../src/wav';
import { getPriority } from 'node:os';
import { engineIsLowered, expectedEngineNice } from '../../src/cpu-priority';
import { CPU_MODEL_ID, MODEL_DIR, ROW_109_RAW_BYTES, ROW_109_RAW_SHA256, ROW_109_SEGMENTS, SEALED_FIXTURE, WHISPER_CLI, createRunDir, writeEvidence } from './real-support';

/** The niceness of THIS process: 0 in the foreground, 5 as a zsh background job. */
const PARENT_NICE = getPriority();
const THREADS = 8; // the rows 109/110 command: `-t 8` on the 10-core host
const cores = detectPhysicalCores();
const EVIDENCE_DIR = createRunDir('cpu-local');
const WORK_DIR = join(EVIDENCE_DIR, 'work');
// The default priority mode, `required`: on a host that cannot lower the engine, nothing below runs.
const runtime: TranscriberRuntime = { physicalCores: cores.count, cpuLocal: { binaryPath: WHISPER_CLI, modelDir: MODEL_DIR, workDir: WORK_DIR, threads: THREADS } };

interface PsSample {
  readonly nice: number;
  readonly command: string;
}

/**
 * Watches one process from OUTSIDE with `ps`, until `stop()`: the niceness the operating system
 * reports for it and the program it is running. Nothing here comes from the adapter.
 */
function watchProcess(pid: number): { samples: PsSample[]; stop: () => void } {
  const samples: PsSample[] = [];
  const sample = (): void => {
    try {
      const line = execFileSync('/bin/ps', ['-o', 'ni=,comm=', '-p', String(pid)], { encoding: 'utf8' }).trim();
      const parts = /^(-?\d+)\s+(.*)$/.exec(line);
      if (parts !== null) samples.push({ nice: Number(parts[1]), command: parts[2] ?? '' });
    } catch {
      // The process has ended: no sample.
    }
  };
  sample();
  const timer = setInterval(sample, 100);
  return { samples, stop: () => clearInterval(timer) };
}
const fileChunk = (path: string, durationMs: number): TranscriberChunk => ({ audio: { kind: 'file', path }, sampleRateHz: 16_000, offsetMs: 0, durationMs });

describe('cpu-local, real engine: the sealed fixture reproduces the row-109 result', () => {
  beforeAll(() => {
    mkdirSync(WORK_DIR, { recursive: true });
  });

  it('the host reports its physical cores and the row-109 thread count is inside the bound', () => {
    expect(cores.source).toBe('sysctl');
    expect(THREADS).toBeLessThanOrEqual(cores.count);
  });

  it('the model is the SEEDED default identifier, and its file is `<id>.bin` in the model directory (N-2)', () => {
    expect(CPU_MODEL_ID).toBe('ggml-large-v3-turbo');
    const config = resolveTranscriberConfig({ backend: 'cpu-local', model: CPU_MODEL_ID, language: 'id' }, runtime);
    expect(config).toMatchObject({ model: 'ggml-large-v3-turbo', modelPath: join(MODEL_DIR, 'ggml-large-v3-turbo.bin'), priority: 'required', nicePath: '/usr/bin/nice' });
  });

  it('whisper-cli -ng through the adapter: same command, same bytes, 14 segments, language id', async () => {
    const fixture = await createTtsFixtureProvider({ fixturePath: SEALED_FIXTURE }).provide();
    expect(fixture).toMatchObject({ sealed: true, sha256: SEALED_TWO_SPEAKER_FIXTURE.sha256, bytes: 3_154_638, sampleRateHz: 24_000 });

    const log = createMemoryLog();
    const runs: EngineRunRecord[] = [];
    const watches: ReturnType<typeof watchProcess>[] = [];
    const adapter = createTranscriberAdapter(resolveTranscriberConfig({ backend: 'cpu-local', model: CPU_MODEL_ID, language: 'id' }, runtime), {
      log,
      onEngineRun: (record) => runs.push(record),
      onEngineStart: (engine) => watches.push(watchProcess(engine.pid)),
    });
    const result = await adapter.transcribe(fileChunk(fixture.path, fixture.durationMs), { language: 'id', correlationId: 'row76-cpu-local' });
    for (const watch of watches) watch.stop();

    expect(runs).toHaveLength(1);
    const run = runs[0]!;
    const outputBase = run.argv[run.argv.indexOf('-of') + 1]!;
    expect(run.argv).toEqual(['/usr/bin/nice', '-n', '10', WHISPER_CLI, '-m', join(MODEL_DIR, 'ggml-large-v3-turbo.bin'), '-ng', '-t', '8', '-l', 'id', '-oj', '-of', outputBase, '-f', SEALED_FIXTURE]);

    // N-5 / R-1: the niceness, from an observation that does not come from the adapter. `nice -n 10`
    // is relative, so the engine must show the niceness of THIS process plus 10 (foreground: 10; as
    // a shell background job, where this process is at 5: 15). Never another value.
    expect(watches).toHaveLength(1);
    const engineSamples = watches[0]!.samples.filter((sample) => sample.command.endsWith('whisper-cli'));
    expect(engineSamples.length).toBeGreaterThan(0);
    expect(engineSamples.filter((sample) => sample.nice !== expectedEngineNice(PARENT_NICE))).toEqual([]);
    expect(run.nice).toBe(expectedEngineNice(PARENT_NICE));
    expect(engineIsLowered(PARENT_NICE, run.nice ?? Number.NaN)).toBe(true);
    expect(run.status).toBe(0);
    expect(run.rawBytes).toBe(ROW_109_RAW_BYTES);
    expect(run.rawSha256).toBe(ROW_109_RAW_SHA256);

    expect(TranscribeResultSchema.safeParse(result).success).toBe(true);
    expect(result.engine).toBe('cpu-local');
    expect(result.language).toBe('id');
    expect(result.segments).toHaveLength(ROW_109_SEGMENTS);
    expect(result.segments.length).toBeGreaterThanOrEqual(fixture.turns.length);
    for (const segment of result.segments) {
      expect(segment.end).toBeGreaterThan(segment.start);
      expect(segment.end * 1000).toBeLessThanOrEqual(fixture.durationMs + 1_000);
      expect(segment.text).not.toBe('');
    }
    expect(result.segments[0]).toEqual({ id: 0, start: 0, end: 4.24, text: 'Selamat pagi. Terima kasih sudah hadir pada wawancara hari ini.' });
    expect(log.records().filter((record) => record.level === 'error')).toEqual([]);

    writeEvidence(EVIDENCE_DIR, 'cpu-local.result.json', result);
    writeEvidence(EVIDENCE_DIR, 'cpu-local.evidence.json', {
      check: 'row 76 cpu-local real run on the sealed fixture',
      fixtureSha256: fixture.sha256,
      physicalCores: cores,
      argv: run.argv,
      exitCode: run.status,
      rawSha256: run.rawSha256,
      rawBytes: run.rawBytes,
      matchesRow109: run.rawSha256 === ROW_109_RAW_SHA256,
      segments: result.segments.length,
      language: result.language,
      modelId: CPU_MODEL_ID,
      nice: run.nice,
      // Booleans only: a count of samples taken at a fixed interval would be a duration in disguise (D230).
      engineObservedFromOutsideWithPs: engineSamples.length > 0,
      parentNice: PARENT_NICE,
      expectedEngineNice: expectedEngineNice(PARENT_NICE),
      everyPsSampleOfTheEngineAtTheExpectedNice: engineSamples.every((sample) => sample.nice === expectedEngineNice(PARENT_NICE)),
      logLevels: log.records().map((record) => `${record.level}:${record.message}`),
    });
  });

  it('negative control: a wrong model path fails closed as MODEL_NOT_FOUND and the engine is never started', async () => {
    const log = createMemoryLog();
    const runs: EngineRunRecord[] = [];
    const adapter = createTranscriberAdapter(resolveTranscriberConfig({ backend: 'cpu-local', model: 'ggml-model-that-is-not-there' }, runtime), { log, onEngineRun: (record) => runs.push(record) });
    await expect(adapter.transcribe(fileChunk(SEALED_FIXTURE, 65_720), { language: 'id' })).rejects.toMatchObject({ code: TranscriberErrorCode.MODEL_NOT_FOUND });
    expect(runs).toEqual([]);
    expect(log.records().map((record) => [record.level, record.context['code']])).toEqual([['error', 'MODEL_NOT_FOUND']]);
  });

  it('negative control: a corrupted fixture is refused by the provider, and the engine gives a DIFFERENT result on it', async () => {
    // The sealed fixture cut to its first 12 seconds, with a consistent header: still a valid WAV.
    const sealed = readFileSync(SEALED_FIXTURE);
    const facts = readWavFacts(sealed);
    const keep = 12 * facts.sampleRateHz * 2;
    const cut = Buffer.from(sealed.subarray(0, facts.dataOffset + keep));
    cut.writeUInt32LE(cut.length - 8, 4);
    cut.writeUInt32LE(keep, facts.dataOffset - 4);
    const cutPath = writeEvidence(EVIDENCE_DIR, 'negative-control-cut-fixture.wav', cut);
    expect(readWavFacts(cut).durationMs).toBe(12_000);

    await expect(createTtsFixtureProvider({ fixturePath: cutPath }).provide()).rejects.toMatchObject({ code: TranscriberErrorCode.FIXTURE_CORRUPT, detail: { reason: 'FIXTURE_HASH_MISMATCH' } });

    const runs: EngineRunRecord[] = [];
    const adapter = createTranscriberAdapter(resolveTranscriberConfig({ backend: 'cpu-local', model: CPU_MODEL_ID }, runtime), { log: createMemoryLog(), onEngineRun: (record) => runs.push(record) });
    const result = await adapter.transcribe(fileChunk(cutPath, 12_000), { language: 'id' });
    expect(runs[0]!.argv).toContain('-ng');
    expect(runs[0]!.rawSha256).not.toBe(ROW_109_RAW_SHA256);
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.segments.length).toBeLessThan(ROW_109_SEGMENTS);
    writeEvidence(EVIDENCE_DIR, 'cpu-local.negative-control.json', {
      check: 'row 76 cpu-local on a fixture cut to 12 s: the result must differ from row 109',
      rawSha256: runs[0]!.rawSha256,
      row109RawSha256: ROW_109_RAW_SHA256,
      differs: runs[0]!.rawSha256 !== ROW_109_RAW_SHA256,
      segments: result.segments.length,
    });
  });
});
