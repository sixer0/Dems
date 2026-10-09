// M6-AD-1 — the `TranscriberAdapter` contract (test strategy §A.6; transcript spec §B.4, §B.5;
// specs R-5 AC-5; W1-C12): one interface, two backends that return the identical document shape;
// `TtsFixtureProvider` produces the fixture; selection is configuration, never automatic.
//
// Each acceptance stands beside its negative control.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranscriberAdapter } from '../adapter';
import { resolveTranscriberConfig, type SttSelection, type TranscriberRuntime } from '../config';
import { SEALED_TWO_SPEAKER_FIXTURE, TWO_SPEAKER_SCRIPT, createTtsFixtureProvider } from '../fixtures/tts-fixture-provider';
import { OMLX_CREDENTIAL_REF } from '../key-loader';
import { createMemoryLog } from '../log';
import {
  MANDATORY_SEGMENT_KEYS,
  QA_SEGMENT_KEYS,
  TranscribeResultSchema,
  TranscriberBackendId,
  TranscriberErrorCode,
  optionalSegmentKeys,
  resultShape,
  type EngineRunRecord,
  type TranscribeResult,
} from '../types';
import { encodeWavPcm16 } from '../wav';
import { QWEN_LIKE_ANSWER, createFakeEngine, createFakeOmlx, pcmChunk, scratchDir, writeSettingsFile } from './support';

const KEY = 'unit-test-key-7f3a9c';
const ENDPOINT = 'http://127.0.0.1:8000';
const OPTIONS = { language: 'id' } as const;

function world(omlx = createFakeOmlx({ key: KEY, models: ['server-model'] })) {
  const engine = createFakeEngine();
  const log = createMemoryLog();
  const runs: EngineRunRecord[] = [];
  const runtime: TranscriberRuntime = {
    physicalCores: 10,
    cpuLocal: { ...engine.cpuLocal(), threads: 8 },
    omlxServer: { settingsPath: writeSettingsFile(KEY) },
  };
  const build = (selection: SttSelection) =>
    createTranscriberAdapter(resolveTranscriberConfig(selection, runtime), { log, fetchImpl: omlx.fetchImpl, onEngineRun: (record) => runs.push(record) });
  return {
    engine,
    omlx,
    log,
    runs,
    runtime,
    cpuLocal: () => build({ backend: 'cpu-local', model: engine.model('model-ok') }),
    omlxServer: (model = 'server-model') => build({ backend: 'omlx-server', endpoint: ENDPOINT, model, language: 'id', credentialRef: OMLX_CREDENTIAL_REF }),
    build,
  };
}

describe('M6-AD-1: one interface, two backends, the identical document shape', () => {
  it('both backends answer the same chunk with a result of the same shape', async () => {
    const w = world();
    const chunk = pcmChunk();
    const fromCpu = await w.cpuLocal().transcribe(chunk, OPTIONS);
    const fromServer = await w.omlxServer().transcribe(chunk, OPTIONS);

    expect(TranscribeResultSchema.safeParse(fromCpu).success).toBe(true);
    expect(TranscribeResultSchema.safeParse(fromServer).success).toBe(true);
    // THE PROOF OF "IDENTICAL SHAPE" IS THE STRICT SCHEMA ABOVE (N-11): one schema, no extra member
    // allowed, every mandatory member required. What may still differ is stated, not hidden: the
    // top level never, the segments only in QA members.
    expect(resultShape(fromCpu).top).toEqual(['engine', 'language', 'model', 'segments', 'text']);
    expect(resultShape(fromServer).top).toEqual(resultShape(fromCpu).top);
    expect(resultShape(fromCpu).segmentKeys).toEqual([...MANDATORY_SEGMENT_KEYS]);
    expect(optionalSegmentKeys(resultShape(fromCpu))).toEqual([]);
    expect(optionalSegmentKeys(resultShape(fromServer))).toEqual(['avgLogprob', 'compressionRatio', 'noSpeechProb', 'seek', 'temperature', 'tokens']);
    for (const key of optionalSegmentKeys(resultShape(fromServer))) expect(QA_SEGMENT_KEYS).toContain(key);

    expect(fromCpu.engine).toBe(TranscriberBackendId.CPU_LOCAL);
    expect(fromServer.engine).toBe(TranscriberBackendId.OMLX_SERVER);
    expect(fromCpu.language).toBe('id');
    expect(fromServer.language).toBe('id');
    for (const result of [fromCpu, fromServer]) {
      expect(result.segments.length).toBeGreaterThan(0);
      for (const [index, segment] of result.segments.entries()) {
        expect(segment.id).toBe(index);
        expect(segment.end).toBeGreaterThan(segment.start);
        expect(segment.text).toBe(segment.text.trim());
        expect(segment.text).not.toBe('');
      }
    }
    // Seconds at the boundary, from the engine's milliseconds and the server's seconds alike.
    expect(fromCpu.segments.map((segment) => [segment.start, segment.end])).toEqual([[0, 4.24], [4.96, 7.84]]);
    expect(fromServer.segments.map((segment) => [segment.start, segment.end])).toEqual([[0, 4.26], [4.98, 7.84]]);
  });

  it('negative control: a result with another top-level member, or a segment without `end`, has another shape and does not parse', async () => {
    const w = world();
    const good = await w.cpuLocal().transcribe(pcmChunk(), OPTIONS);
    const extra = { ...good, duration: 1.5 } as unknown as TranscribeResult;
    expect(resultShape(extra)).not.toEqual(resultShape(good));
    expect(TranscribeResultSchema.safeParse(extra).success).toBe(false);

    const { end: _dropped, ...withoutEnd } = good.segments[0]!;
    const broken = { ...good, segments: [withoutEnd, ...good.segments.slice(1)] } as unknown as TranscribeResult;
    expect(TranscribeResultSchema.safeParse(broken).success).toBe(false);
    // A segment member that is neither mandatory nor a QA member, and a QA member of the wrong type.
    const unknownMember = { ...good, segments: good.segments.map((segment) => ({ ...segment, speaker: 'A' })) } as unknown as TranscribeResult;
    expect(TranscribeResultSchema.safeParse(unknownMember).success).toBe(false);
    const wrongType = { ...good, segments: good.segments.map((segment) => ({ ...segment, avgLogprob: 'low' })) } as unknown as TranscribeResult;
    expect(TranscribeResultSchema.safeParse(wrongType).success).toBe(false);
    for (const missing of ['engine', 'model', 'language', 'text', 'segments'] as const) {
      const { [missing]: _gone, ...rest } = good;
      expect(TranscribeResultSchema.safeParse(rest).success).toBe(false);
    }
  });

  it('the shape helper CAN differ for two results that both pass the schema: it shows the QA difference instead of hiding it (N-11)', async () => {
    const w = world();
    const fromCpu = await w.cpuLocal().transcribe(pcmChunk(), OPTIONS);
    const fromServer = await w.omlxServer().transcribe(pcmChunk(), OPTIONS);
    expect(TranscribeResultSchema.safeParse(fromCpu).success && TranscribeResultSchema.safeParse(fromServer).success).toBe(true);
    expect(resultShape(fromCpu)).not.toEqual(resultShape(fromServer));
    const qwen = world(createFakeOmlx({ key: KEY, models: ['server-model'], answer: QWEN_LIKE_ANSWER }));
    expect(resultShape(await qwen.omlxServer().transcribe(pcmChunk(), OPTIONS))).toEqual({ top: resultShape(fromCpu).top, segmentKeys: [...MANDATORY_SEGMENT_KEYS] });
  });

  it('QA members are carried where the engine reported them and omitted elsewhere, never zero-filled', async () => {
    const whisper = world();
    const fromServer = await whisper.omlxServer().transcribe(pcmChunk(), OPTIONS);
    expect(Object.keys(fromServer.segments[0]!).sort()).toEqual(['avgLogprob', 'compressionRatio', 'end', 'id', 'noSpeechProb', 'seek', 'start', 'temperature', 'text', 'tokens']);
    expect(fromServer.segments[0]!.avgLogprob).toBe(-0.09);

    const fromCpu = await whisper.cpuLocal().transcribe(pcmChunk(), OPTIONS);
    const qwen = world(createFakeOmlx({ key: KEY, models: ['server-model'], answer: QWEN_LIKE_ANSWER }));
    const fromQwen = await qwen.omlxServer().transcribe(pcmChunk(), OPTIONS);
    for (const result of [fromCpu, fromQwen]) {
      for (const segment of result.segments) {
        expect(Object.keys(segment).sort()).toEqual([...MANDATORY_SEGMENT_KEYS]);
        for (const key of QA_SEGMENT_KEYS) expect(key in segment).toBe(false);
      }
    }
    expect(resultShape(fromQwen).top).toEqual(resultShape(fromServer).top);
  });

  it('the unreliable `duration` member of the server answer is never read: any value gives the same result', async () => {
    const answers = [0.0, 2.49, 9999].map((duration) => ({ ...QWEN_LIKE_ANSWER, duration }));
    const results = await Promise.all(
      answers.map((answer) => world(createFakeOmlx({ key: KEY, models: ['server-model'], answer })).omlxServer().transcribe(pcmChunk(), OPTIONS)),
    );
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(JSON.stringify(results[0])).not.toContain('duration');
  });
});

describe('M6-AD-1: selection is configuration, never automatic mid-session', () => {
  it('the backend is the configured one and is fixed for the lifetime of the adapter', async () => {
    const w = world();
    const cpu = w.cpuLocal();
    const server = w.omlxServer();
    expect(cpu.backend).toBe('cpu-local');
    expect(server.backend).toBe('omlx-server');
    expect(Object.isFrozen(cpu)).toBe(true);
    expect(Object.keys(cpu).sort()).toEqual(['backend', 'model', 'queue', 'transcribe']);
    expect(() => {
      (cpu as { backend: string }).backend = 'omlx-server';
    }).toThrow(TypeError);
    await cpu.transcribe(pcmChunk(), OPTIONS);
    expect(w.omlx.calls).toHaveLength(0);
    expect(w.runs.map((run) => run.backend)).toEqual(['cpu-local']);
  });

  it('a failing omlx-server is a failure: cpu-local is never tried in its place, though it is installed and working', async () => {
    const w = world(createFakeOmlx({ key: KEY, models: ['server-model'], refuse: true }));
    w.engine.model('model-ok');
    await expect(w.omlxServer().transcribe(pcmChunk(), OPTIONS)).rejects.toMatchObject({ code: TranscriberErrorCode.UNREACHABLE, detail: { transport: 'ECONNREFUSED' } });
    expect(w.engine.lastArgv()).toBeNull();
    expect(w.runs).toEqual([]);
    expect(w.log.records().map((record) => [record.level, record.context['code']])).toEqual([['error', 'UNREACHABLE']]);
  });

  it('a failing cpu-local is a failure: the server is never called in its place', async () => {
    const w = world();
    const adapter = w.build({ backend: 'cpu-local', model: w.engine.model('model-exit3') });
    await expect(adapter.transcribe(pcmChunk(), OPTIONS)).rejects.toMatchObject({ code: TranscriberErrorCode.ENGINE_FAILED });
    expect(w.omlx.calls).toHaveLength(0);
  });

  it('a backend that is not one of the two, and another language, are refused when the configuration is resolved', () => {
    const w = world();
    expect(() => w.build({ backend: 'auto', model: 'm' })).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.CONFIG_INVALID, detail: { reason: 'BACKEND_UNKNOWN' } }));
    expect(() => w.build({ backend: 'cpu-local', model: 'm', language: 'en' })).toThrowError(expect.objectContaining({ detail: { reason: 'LANGUAGE_NOT_SUPPORTED' } }));
    expect(() => w.build({ backend: 'faster-whisper', model: 'm' })).toThrowError(expect.objectContaining({ detail: { reason: 'BACKEND_UNKNOWN' } }));
  });
});

describe('M6-AD-1: TtsFixtureProvider produces the fixture', () => {
  it('the seal is the row-12 fixture: 13 scripted sentences, two voices, Indonesian', () => {
    expect(SEALED_TWO_SPEAKER_FIXTURE).toEqual({
      id: 'fixture-two-speaker-id',
      sha256: '6743181a7d976ca24c03ad8e427d6d7093fbb0b9f72257e6e2f91dcfc0f4fe71',
      bytes: 3_154_638,
      scriptedSentences: 13,
      language: 'id',
    });
    expect(TWO_SPEAKER_SCRIPT.map((turn) => turn.id)).toEqual(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'B5', 'A6', 'B6', 'A7']);
    expect(new Set(TWO_SPEAKER_SCRIPT.map((turn) => turn.speaker))).toEqual(new Set(['A', 'B']));
    for (const turn of TWO_SPEAKER_SCRIPT) expect(turn.text).not.toMatch(/[0-9]/);
  });

  it('negative control: a file that is not the sealed bytes is refused, never handed to a check', async () => {
    const path = join(scratchDir('fixture'), 'fixture.wav');
    const other = encodeWavPcm16(new Int16Array(2_400), 24_000);
    writeFileSync(path, other);
    await expect(createTtsFixtureProvider({ fixturePath: path }).provide()).rejects.toMatchObject({
      code: TranscriberErrorCode.FIXTURE_CORRUPT,
      detail: { reason: 'FIXTURE_HASH_MISMATCH', actualBytes: other.length, actualSha256: createHash('sha256').update(other).digest('hex') },
    });
    await expect(createTtsFixtureProvider({ fixturePath: join(scratchDir('fixture'), 'absent.wav') }).provide()).rejects.toMatchObject({ code: TranscriberErrorCode.FIXTURE_NOT_FOUND });
  });
});
