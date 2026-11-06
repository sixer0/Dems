// Blueprint row 77 Verification on the REAL `omlx-server` backend (this Mac's oMLX server, a
// development tool on the Apple GPU: D7; it gives no evidence for the CPU clause):
//
//   M6-TF-1 (criteria 1-4 of §E.1) through the PIPELINE: real Silero VAD chunking, one request
//            per chunk, clamp, checkpoints, on the sealed two-voice fixture;
//   THE PHANTOM-TAIL CLAMP CHECK: "on the sealed fixture through `omlx-server` 0 assembled
//            segments end after the audio end". The WHOLE fixture as ONE chunk is what makes the
//            server answer with a segment far past the audio (row 12 §4.1; row 76 D-76-5), so that
//            call is made too, and the clamp is shown to remove exactly that.
//
// THIS FILE NEVER STARTS, STOPS OR CONFIGURES THE SERVER (D7(d)): the row's driver starts it with
// the sanctioned script (log backed up first) and stops it afterwards. Calls are serialised by one
// queue. The key is never printed: its absence from every output is proven by scrubbing.
//
// Run alone, never beside a CPU STT run:  npm run test:real:row77:omlx-server -w @dems/transcriber
import { inspect } from 'node:util';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranscriberAdapter } from '../../src/adapter';
import { resolveTranscriberConfig, type SttSelection, type TranscriberRuntime } from '../../src/config';
import { SerialQueue } from '../../src/cpu-priority';
import { createTtsFixtureProvider } from '../../src/fixtures/tts-fixture-provider';
import { OMLX_CREDENTIAL_REF, loadCredential, scrubCredential } from '../../src/key-loader';
import { createMemoryLog } from '../../src/log';
import { openPcmSource } from '../../src/pipeline/audio-source';
import { DropReason, clampSegments } from '../../src/pipeline/clamp';
import { QaFlag, VAD_MAX_CHUNK_MS } from '../../src/pipeline/constants';
import { chunkSecondsToMediaMs, decodedFileTimeline } from '../../src/pipeline/media-time';
import { createMemoryChunkMirror } from '../../src/pipeline/mirror';
import { createTranscriptRunner } from '../../src/pipeline/runner';
import { createSileroVad, resolveSileroVadConfig } from '../../src/pipeline/silero-vad';
import type { EngineRunRecord } from '../../src/types';
import { FIXTURE_END_MS, FIXTURE_RATE, FIXTURE_SAMPLES, MODEL_DIR, OMLX_ENDPOINT, OMLX_STT_MODEL, ROW77_RUNS_DIR, SCRIPTED_SENTENCES, SEALED_FIXTURE, VAD_BINARY, VAD_MODEL_ID, createRunDir, writeEvidence } from './real-support';

const EVIDENCE_DIR = createRunDir('row77-omlx-server', ROW77_RUNS_DIR);
const runtime: TranscriberRuntime = { physicalCores: 1 };
const selection: SttSelection = { backend: 'omlx-server', endpoint: OMLX_ENDPOINT, model: OMLX_STT_MODEL, language: 'id', credentialRef: OMLX_CREDENTIAL_REF };
const queue = new SerialQueue();
const timeline = decodedFileTimeline(FIXTURE_RATE);
/** True when `text` does not contain the key. The key itself never becomes text in this file. */
const keyFree = (text: string): boolean => scrubCredential(text, loadCredential(OMLX_CREDENTIAL_REF)) === text && !/Bearer/i.test(text);

describe('row 77 on omlx-server, real server: M6-TF-1 through the pipeline, and the phantom-tail clamp', () => {
  it('M6-TF-1 — VAD chunks, one serialised request per chunk: a transcript with timestamps, Indonesian, >= 1 segment per scripted sentence, 0 segments past the audio end', async () => {
    const fixture = await createTtsFixtureProvider({ fixturePath: SEALED_FIXTURE }).provide();
    const log = createMemoryLog();
    const runs: EngineRunRecord[] = [];
    const vadRuns: { argv: readonly string[]; status: number | null; spans: number | null }[] = [];
    const adapter = createTranscriberAdapter(resolveTranscriberConfig(selection, runtime), { log, queue, onEngineRun: (record) => runs.push(record) });
    const mirror = createMemoryChunkMirror();
    const runner = createTranscriptRunner({
      sessionId: 'SES-20261009-0077',
      adapter,
      timeline,
      source: openPcmSource({ container: 'wav', path: fixture.path, sampleRateHz: FIXTURE_RATE }),
      vad: createSileroVad(resolveSileroVadConfig({ binaryPath: VAD_BINARY, modelDir: MODEL_DIR, model: VAD_MODEL_ID }), { log, onEngineRun: (run) => vadRuns.push(run) }),
      sessionScratchDir: join(EVIDENCE_DIR, 'session'),
      log,
      mirror,
    });
    const report = await runner.step({ final: true });
    const checkpoint = runner.checkpoint();
    const segments = checkpoint.chunks.flatMap((chunk) => chunk.segments ?? []);

    expect(report, 'the oMLX server is not listening: the driver starts it with the sanctioned script; this test never does').toMatchObject({ failed: 0, remaining: 0, complete: true });
    expect(report.qaFlags).not.toContain(QaFlag.VAD_FALLBACK);
    expect(checkpoint.backend).toBe('omlx-server');
    expect(checkpoint.language).toBe('id');
    expect(checkpoint.chunks.length).toBeGreaterThanOrEqual(2);
    expect(checkpoint.chunks.every((chunk) => chunk.status === 'DONE' && chunk.endMs - chunk.startMs <= VAD_MAX_CHUNK_MS + 1)).toBe(true);
    expect(runs).toHaveLength(checkpoint.chunks.length);
    expect(runs.every((run) => run.backend === 'omlx-server' && run.requestPath === '/v1/audio/transcriptions' && run.status === 200)).toBe(true);
    expect(adapter.queue.maxObserved).toBe(1);
    expect(segments.length).toBeGreaterThanOrEqual(SCRIPTED_SENTENCES);
    for (const segment of segments) {
      expect(segment.endMs).toBeGreaterThan(segment.startMs);
      expect(segment.text.trim()).not.toBe('');
    }
    // THE ROW-77 CHECK: 0 assembled segments end after the audio end — in the file and in the mirror.
    expect(segments.filter((segment) => segment.endMs > FIXTURE_END_MS)).toEqual([]);
    expect(mirror.rows().flatMap((row) => row.segments ?? []).filter((segment) => segment.endMs > FIXTURE_END_MS)).toEqual([]);
    for (const chunk of checkpoint.chunks) expect((chunk.segments ?? []).filter((segment) => segment.endMs > chunk.endMs)).toEqual([]);
    expect(vadRuns).toHaveLength(1);
    expect(log.records().filter((record) => record.level === 'error')).toEqual([]);

    const everything = JSON.stringify({ checkpoint, runs, log: log.lines, mirror: mirror.rows(), adapter: inspect(adapter, { depth: 8 }) });
    expect(keyFree(everything)).toBe(true);

    writeEvidence(EVIDENCE_DIR, 'pipeline.checkpoint.json', checkpoint);
    writeEvidence(EVIDENCE_DIR, 'pipeline.evidence.json', {
      check: 'row 77 M6-TF-1 on omlx-server through the pipeline, sealed fixture',
      audioChunked: 'DECODED_FILE: the sealed fixture WAV, already in file time (origin 0)',
      report,
      chunks: checkpoint.chunks.map((chunk) => ({ chunkIndex: chunk.chunkIndex, seq: chunk.seq, startMs: chunk.startMs, endMs: chunk.endMs, status: chunk.status, segments: chunk.segments?.length })),
      requests: runs.map((run) => ({ requestPath: run.requestPath, httpStatus: run.status, rawSha256: run.rawSha256, rawBytes: run.rawBytes })),
      segments: segments.length,
      scriptedSentences: SCRIPTED_SENTENCES,
      segmentsEndingAfterAudioEnd: segments.filter((segment) => segment.endMs > FIXTURE_END_MS).length,
      language: checkpoint.language,
      qaFlags: checkpoint.qaFlags,
      vadCommand: vadRuns[0]?.argv,
      vadSpeechRuns: vadRuns[0]?.spans,
      clampLogLines: log.records().filter((record) => record.source === 'transcriber.runner.clamp').map((record) => record.context),
      maxCallsInFlight: adapter.queue.maxObserved,
      keyFreeOutputs: keyFree(everything),
    });
  });

  it('THE CLAMP CHECK — the whole fixture as ONE chunk: the server answers with a segment past the audio end; after the clamp 0 segments end after it, and the tail that repeats the previous text is gone', async () => {
    const fixture = await createTtsFixtureProvider({ fixturePath: SEALED_FIXTURE }).provide();
    const log = createMemoryLog();
    const runs: EngineRunRecord[] = [];
    const adapter = createTranscriberAdapter(resolveTranscriberConfig(selection, runtime), { log, queue, onEngineRun: (record) => runs.push(record) });
    const result = await adapter.transcribe({ audio: { kind: 'file', path: fixture.path }, sampleRateHz: FIXTURE_RATE, offsetMs: 0, durationMs: fixture.durationMs }, { language: 'id', correlationId: 'row77-clamp' });
    const whole = { from: 0, to: FIXTURE_SAMPLES };

    // NEGATIVE CONTROL, on the live answer: converted WITHOUT the clamp, a segment ends after the audio.
    const unclamped = result.segments.map((segment) => ({ startMs: chunkSecondsToMediaMs(timeline, 0, segment.start), endMs: chunkSecondsToMediaMs(timeline, 0, segment.end), text: segment.text }));
    const pastEnd = unclamped.filter((segment) => segment.endMs > FIXTURE_END_MS);
    expect(pastEnd.length, 'the server did not answer with a phantom tail this time: the clamp had nothing to remove, so this run proves nothing about it').toBeGreaterThan(0);

    const clamped = clampSegments(result.segments, timeline, whole);
    expect(clamped.segments.filter((segment) => segment.endMs > FIXTURE_END_MS)).toEqual([]);
    expect(clamped.dropped.length + clamped.clamped).toBeGreaterThanOrEqual(pastEnd.length);
    // The tail of rows 12 and 76: it repeats the segment before it, and is dropped for that.
    const last = unclamped[unclamped.length - 1]!;
    const beforeLast = unclamped[unclamped.length - 2]!;
    if (last.text === beforeLast.text) {
      expect(clamped.dropped).toContainEqual({ reason: DropReason.CLAMPED_TAIL_REPEATS_PREVIOUS, index: unclamped.length - 1 });
      expect(clamped.segments[clamped.segments.length - 1]!.text).toBe(beforeLast.text);
      expect(clamped.segments).toHaveLength(unclamped.length - 1);
    }
    expect(clamped.segments.length).toBeGreaterThanOrEqual(SCRIPTED_SENTENCES);
    expect(keyFree(JSON.stringify({ result, runs, log: log.lines }))).toBe(true);

    writeEvidence(EVIDENCE_DIR, 'clamp.evidence.json', {
      check: 'row 77 phantom-tail clamp on the live omlx-server answer, whole sealed fixture as one chunk',
      requestPath: runs[0]?.requestPath,
      httpStatus: runs[0]?.status,
      rawSha256: runs[0]?.rawSha256,
      rawBytes: runs[0]?.rawBytes,
      audioEndMs: FIXTURE_END_MS,
      segmentsFromTheServer: unclamped.length,
      withoutClamp_segmentsEndingAfterAudioEnd: pastEnd.map((segment) => ({ startMs: segment.startMs, endMs: segment.endMs })),
      withClamp_segmentsEndingAfterAudioEnd: clamped.segments.filter((segment) => segment.endMs > FIXTURE_END_MS).length,
      dropped: clamped.dropped,
      clampedAndKept: clamped.clamped,
      segmentsAfterClamp: clamped.segments.length,
      lastSegmentAfterClamp: { startMs: clamped.segments[clamped.segments.length - 1]!.startMs, endMs: clamped.segments[clamped.segments.length - 1]!.endMs },
    });
  });
});
