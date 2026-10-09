// Blueprint row 76 Verification — the `omlx-server` backend exercised FOR REAL against the oMLX
// server of this Mac (D7), THROUGH THE ADAPTER and the single key-loader.
//
// THIS FILE NEVER STARTS, STOPS OR CONFIGURES THE SERVER (D7(d)). A person (or the row's driver,
// with the sanctioned start script, the log backed up first) starts it before and stops it after;
// when it is not listening the first test fails and says so. The key is never printed: the checks
// prove its ABSENCE from every output by scrubbing, without ever turning it into text here.
//
// Run alone, never beside a CPU STT run or a large VLM session:
//   npm run test:real:omlx-server -w @dems/transcriber
import { readFileSync } from 'node:fs';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createTranscriberAdapter } from '../../src/adapter';
import { createOmlxHttp } from '../../src/backends/omlx-http';
import { resolveTranscriberConfig, type SttSelection, type TranscriberRuntime } from '../../src/config';
import { SerialQueue } from '../../src/cpu-priority';
import { TWO_SPEAKER_SCRIPT, createOmlxTtsSynthesiser, createTtsFixtureProvider } from '../../src/fixtures/tts-fixture-provider';
import { OMLX_CREDENTIAL_REF, loadCredential, scrubCredential } from '../../src/key-loader';
import { createMemoryLog } from '../../src/log';
import { createConnectionProbe } from '../../src/probe';
import { TranscribeResultSchema, TranscriberError, TranscriberErrorCode, type EngineRunRecord, type TranscriberChunk } from '../../src/types';
import { readWavFacts } from '../../src/wav';
import { OMLX_ENDPOINT, OMLX_STT_MODEL, OMLX_TTS_MODEL, ROW_12_ANSWER, ROW_12_SEGMENTS, SEALED_FIXTURE, createRunDir, writeEvidence } from './real-support';

const EVIDENCE_DIR = createRunDir('omlx-server');
const runtime: TranscriberRuntime = { physicalCores: 1 };
const selection: SttSelection = { backend: 'omlx-server', endpoint: OMLX_ENDPOINT, model: OMLX_STT_MODEL, language: 'id', credentialRef: OMLX_CREDENTIAL_REF };
const queue = new SerialQueue();
const fileChunk = (path: string, durationMs: number): TranscriberChunk => ({ audio: { kind: 'file', path }, sampleRateHz: 16_000, offsetMs: 0, durationMs });
/** True when `text` does not contain the key. The key itself never becomes text in this file. */
const keyFree = (text: string): boolean => scrubCredential(text, loadCredential(OMLX_CREDENTIAL_REF)) === text && !/Bearer/i.test(text);

interface Row12Answer {
  text: string;
  segments: { start: number; end: number; text: string; avg_logprob: number }[];
}

describe('omlx-server, real server: the sealed fixture through the adapter', () => {
  it('the server is up and serves the model (the connection probe of op 92: one model-list request, no audio)', async () => {
    const log = createMemoryLog();
    const probe = createConnectionProbe({ runtime, log, credentialRef: () => OMLX_CREDENTIAL_REF, queue });
    const answer = await probe({ enabled: true, backend: 'omlx-server', endpoint: OMLX_ENDPOINT, model: OMLX_STT_MODEL }, { signal: new AbortController().signal, timeoutMs: 10_000 });
    expect(answer, 'the oMLX server is not listening: a person starts it with the sanctioned script; this test never does').toEqual({ reachable: true, modelAvailable: true, detailCode: 'OK' });
    expect(keyFree(log.lines.join('\n'))).toBe(true);
    writeEvidence(EVIDENCE_DIR, 'omlx-server.probe.json', { check: 'row 76 omlx-server probe', answer });
  });

  it('transcribes the sealed fixture: language id, the row-12 segments, key in no output', async () => {
    const fixture = await createTtsFixtureProvider({ fixturePath: SEALED_FIXTURE }).provide();
    const log = createMemoryLog();
    const runs: EngineRunRecord[] = [];
    const config = resolveTranscriberConfig(selection, runtime);
    const adapter = createTranscriberAdapter(config, { log, queue, onEngineRun: (record) => runs.push(record) });
    const result = await adapter.transcribe(fileChunk(fixture.path, fixture.durationMs), { language: 'id', correlationId: 'row76-omlx-server' });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ backend: 'omlx-server', argv: [], requestPath: '/v1/audio/transcriptions', status: 200 });
    expect(TranscribeResultSchema.safeParse(result).success).toBe(true);
    expect(result.engine).toBe('omlx-server');
    expect(result.language).toBe('id');
    expect(result.segments.length).toBeGreaterThanOrEqual(fixture.turns.length);
    for (const segment of result.segments) {
      expect(segment.end).toBeGreaterThan(segment.start);
      expect(segment.text).not.toBe('');
    }

    // The row-12 answer of this server to these bytes (17 segments), normalised the same way.
    const row12 = JSON.parse(readFileSync(ROW_12_ANSWER, 'utf8')) as Row12Answer;
    expect(row12.segments).toHaveLength(ROW_12_SEGMENTS);
    expect(result.segments.map((segment) => [segment.start, segment.end, segment.text])).toEqual(row12.segments.map((segment) => [segment.start, segment.end, segment.text.trim()]));
    expect(result.text).toBe(row12.text.trim());
    expect(result.segments.map((segment) => segment.avgLogprob)).toEqual(row12.segments.map((segment) => segment.avg_logprob));

    const everything = JSON.stringify({ result, runs, config, log: log.lines, adapter: inspect(adapter, { depth: 8 }) });
    expect(keyFree(everything)).toBe(true);
    expect(adapter.queue.maxObserved).toBe(1);
    expect(log.records().filter((record) => record.level === 'error')).toEqual([]);

    writeEvidence(EVIDENCE_DIR, 'omlx-server.result.json', result);
    writeEvidence(EVIDENCE_DIR, 'omlx-server.evidence.json', {
      check: 'row 76 omlx-server real run on the sealed fixture',
      fixtureSha256: fixture.sha256,
      requestPath: runs[0]!.requestPath,
      httpStatus: runs[0]!.status,
      rawSha256: runs[0]!.rawSha256,
      rawBytes: runs[0]!.rawBytes,
      segments: result.segments.length,
      matchesRow12Segments: true,
      language: result.language,
      keyFreeOutputs: keyFree(everything),
      maxCallsInFlight: adapter.queue.maxObserved,
    });
  });

  it('negative control: without the credential the same request is refused as CREDENTIAL_REJECTED', async () => {
    const log = createMemoryLog();
    const adapter = createTranscriberAdapter(resolveTranscriberConfig({ ...selection, credentialRef: null }, runtime), { log, queue });
    await expect(adapter.transcribe(fileChunk(SEALED_FIXTURE, 65_720), { language: 'id' })).rejects.toMatchObject({ code: TranscriberErrorCode.CREDENTIAL_REJECTED });
    expect(log.records().map((record) => [record.level, record.context['code']])).toEqual([['error', 'CREDENTIAL_REJECTED']]);
  });

  it('negative control: a model the server does not serve fails closed, with no text', async () => {
    const log = createMemoryLog();
    const adapter = createTranscriberAdapter(resolveTranscriberConfig({ ...selection, model: 'dems-row76-model-that-is-not-served' }, runtime), { log, queue });
    let caught: unknown;
    try {
      await adapter.transcribe(fileChunk(SEALED_FIXTURE, 65_720), { language: 'id' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TranscriberError);
    const code = (caught as TranscriberError).code;
    expect([TranscriberErrorCode.MODEL_NOT_AVAILABLE, TranscriberErrorCode.ENGINE_FAILED]).toContain(code);
    expect(keyFree(log.lines.join('\n'))).toBe(true);
    writeEvidence(EVIDENCE_DIR, 'omlx-server.negative-control.json', { check: 'row 76 omlx-server with an unknown model', code, detail: (caught as TranscriberError).detail });
  });

  it('an endpoint written with the name `localhost` reaches the same server at the address 127.0.0.1 (N-8)', async () => {
    const urls: string[] = [];
    const log = createMemoryLog();
    const probe = createConnectionProbe({ runtime, log, credentialRef: () => OMLX_CREDENTIAL_REF, queue, fetchImpl: (input, init) => (urls.push(input), fetch(input, init)) });
    const answer = await probe({ enabled: true, backend: 'omlx-server', endpoint: 'http://localhost:8000', model: OMLX_STT_MODEL }, { signal: new AbortController().signal, timeoutMs: 10_000 });
    expect(urls).toEqual(['http://127.0.0.1:8000/v1/models']);
    expect(answer).toEqual({ reachable: true, modelAvailable: true, detailCode: 'OK' });
    writeEvidence(EVIDENCE_DIR, 'omlx-server.localhost.json', { check: 'row 76 fix round 1, N-8: localhost connected as the address', configured: 'http://localhost:8000', requested: urls, answer });
  });

  it('negative control: a non-loopback endpoint is refused by the adapter configuration, before any request', () => {
    expect(() => resolveTranscriberConfig({ ...selection, endpoint: 'http://192.168.1.10:8000' }, runtime)).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.ENDPOINT_NOT_LOOPBACK }));
  });

  it('the fixture synthesiser: one scripted turn from the installed speech model is mono 16-bit audio', async () => {
    const log = createMemoryLog();
    const credential = loadCredential(OMLX_CREDENTIAL_REF);
    log.protect(credential);
    const http = createOmlxHttp({ endpoint: OMLX_ENDPOINT, credential, timeoutMs: 600_000 });
    const synthesiser = createOmlxTtsSynthesiser({ http, model: OMLX_TTS_MODEL, log, queue });
    const turn = TWO_SPEAKER_SCRIPT[1]!;
    const wav = await synthesiser.synthesise(turn, null);
    const facts = readWavFacts(wav);
    expect(facts).toMatchObject({ channels: 1, bitsPerSample: 16 });
    expect(facts.durationMs).toBeGreaterThan(500);
    writeEvidence(EVIDENCE_DIR, 'tts-turn-B1.wav', wav);
    expect(keyFree(log.lines.join('\n'))).toBe(true);
    writeEvidence(EVIDENCE_DIR, 'omlx-server.tts.json', { check: 'row 76 one synthesised fixture turn', turn: turn.id, sampleRateHz: facts.sampleRateHz, channels: facts.channels, bitsPerSample: facts.bitsPerSample, bytes: wav.length });
  });
});
