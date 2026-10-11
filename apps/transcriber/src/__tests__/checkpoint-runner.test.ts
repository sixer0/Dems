// Chunk checkpoints, the mirror of `transcript_chunks`, and the runner (row 77; transcript spec
// §A.1-§A.3, §D; dbc-3 §B.7). In process: a synthetic tap, a stand-in VAD and a stand-in adapter.
// The kill of a real process is `kill-resume.test.ts` (M6-KR-1).
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, rmSync, truncateSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMemoryLog } from '../log';
import { openPcmSource } from '../pipeline/audio-source';
import { CheckpointSchema, ChunkStatus, createCheckpointStore, emptyCheckpoint, type Checkpoint } from '../pipeline/checkpoint';
import { QaFlag, STT_CHUNK_RETRIES, TRANSCRIPT_CHECKPOINT_FILE } from '../pipeline/constants';
import { captureTapTimeline, decodedFileTimeline } from '../pipeline/media-time';
import { createMemoryChunkMirror, tableRefusal, toModelCode, type ChunkMirrorRow, type MemoryChunkMirror } from '../pipeline/mirror';
import { NO_TAP_SIGNAL, createTranscriptRunner, type TranscriptRunnerOptions, discardTranscriptAudio } from '../pipeline/runner';
import { TranscriberError, TranscriberErrorCode } from '../types';
import { encodeWavPcm16 } from '../wav';
import { SESSION, TAP_RATE, createStubAdapter, createStubVad, growTap, tonePcm, writeTap, type StubAdapter } from './pipeline-support';
import { errorRecords, scratchDir } from './support';
import { assembleTranscript } from '../pipeline/assembly';
import { CLAMP_MIN_REMAINDER_MS, DropReason, clampSegments } from '../pipeline/clamp';
import { MODEL_PROVENANCE, transcriptOf } from './diarization-support';

const SECOND = TAP_RATE;
const tap = captureTapTimeline();
/** Five bursts of speech, far enough apart in total that they cannot be joined: five chunks. */
const FIVE = [0, 1, 2, 3, 4].map((index) => ({ from: (2 + index * 31) * SECOND, to: (2 + index * 31 + 20) * SECOND }));
const TOTAL = 160 * SECOND;

interface Rig {
  readonly dir: string;
  readonly tapPath: string;
  readonly adapter: StubAdapter;
  readonly mirror: MemoryChunkMirror;
  readonly log: ReturnType<typeof createMemoryLog>;
  runner(overrides?: Partial<TranscriptRunnerOptions>): ReturnType<typeof createTranscriptRunner>;
  stored(): Checkpoint;
}

function rig(samples: Int16Array = tonePcm(TOTAL, FIVE)): Rig {
  const dir = scratchDir('runner');
  const tapPath = writeTap(dir, samples);
  const adapter = createStubAdapter();
  const mirror = createMemoryChunkMirror();
  const log = createMemoryLog();
  return {
    dir,
    tapPath,
    adapter,
    mirror,
    log,
    runner: (overrides = {}) =>
      createTranscriptRunner({
        sessionId: SESSION,
        adapter,
        timeline: tap,
        source: openPcmSource({ container: 'raw', path: tapPath, sampleRateHz: TAP_RATE }),
        vad: createStubVad(),
        sessionScratchDir: dir,
        log,
        mirror,
        now: () => new Date('2026-10-09T07:00:00.000Z'),
        tapLost: NO_TAP_SIGNAL,
        ...overrides,
      }),
    stored: () => CheckpointSchema.parse(JSON.parse(readFileSync(join(dir, TRANSCRIPT_CHECKPOINT_FILE), 'utf8'))),
  };
}

describe('chunk checkpoints: the file (§D.1)', () => {
  const identity = { sessionId: SESSION, backend: 'cpu-local' as const, model: 'stand-in-model', timeline: tap };

  it('no file yet is no checkpoint; a saved checkpoint is read back equal, and only the one file is left', () => {
    const dir = scratchDir('checkpoint');
    const store = createCheckpointStore(dir);
    expect(store.load(identity)).toBeNull();
    const checkpoint = emptyCheckpoint(identity);
    store.save(checkpoint);
    expect(store.load(identity)).toEqual(checkpoint);
    expect(readdirSync(dir)).toEqual([TRANSCRIPT_CHECKPOINT_FILE]);
    expect(store.path).toBe(join(dir, 'transcript-checkpoint.json'));
  });

  it('what a killed writer left beside the file is never read as the checkpoint, and does not stop the next write', () => {
    const dir = scratchDir('checkpoint');
    const store = createCheckpointStore(dir);
    store.save(emptyCheckpoint(identity));
    writeFileSync(`${store.path}.next`, '{"version":"dems.transcript-checkpoint/1","half":');
    expect(store.load(identity)).toEqual(emptyCheckpoint(identity));
    store.save({ ...emptyCheckpoint(identity), cursorSample: 7 });
    expect(store.load(identity)?.cursorSample).toBe(7);
    expect(readdirSync(dir)).toEqual([TRANSCRIPT_CHECKPOINT_FILE]);
  });

  it.each([
    ['not JSON', 'CHECKPOINT_NOT_JSON', (): string => '{ half a file'],
    ['another form', 'CHECKPOINT_FORM_UNKNOWN', (): string => JSON.stringify({ version: 'something/2', chunks: [] })],
    ['an unknown member', 'CHECKPOINT_FORM_UNKNOWN', (): string => JSON.stringify({ ...emptyCheckpoint(identity), extra: 1 })],
    ['another session', 'CHECKPOINT_OF_ANOTHER_SESSION', (): string => JSON.stringify({ ...emptyCheckpoint(identity), sessionId: 'SES-20261009-0001' })],
    ['another backend (the backend of a session never changes, §B.4)', 'CHECKPOINT_OF_ANOTHER_BACKEND_OR_MODEL', (): string => JSON.stringify({ ...emptyCheckpoint(identity), backend: 'omlx-server' })],
    ['another model', 'CHECKPOINT_OF_ANOTHER_BACKEND_OR_MODEL', (): string => JSON.stringify({ ...emptyCheckpoint(identity), model: 'another-model' })],
    ['another audio (a decoded file instead of the tap)', 'CHECKPOINT_OF_ANOTHER_AUDIO', (): string => JSON.stringify(emptyCheckpoint({ ...identity, timeline: decodedFileTimeline(48_000) }))],
    ['another media-time origin', 'CHECKPOINT_OF_ANOTHER_AUDIO', (): string => JSON.stringify(emptyCheckpoint({ ...identity, timeline: captureTapTimeline(2048) }))],
  ])('a file that is %s is refused (%s), never replaced by a fresh start', (_label, reason, body) => {
    const dir = scratchDir('checkpoint');
    writeFileSync(join(dir, TRANSCRIPT_CHECKPOINT_FILE), body());
    let caught: unknown;
    try {
      createCheckpointStore(dir).load(identity);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TranscriberError);
    expect((caught as TranscriberError).code).toBe(TranscriberErrorCode.CHECKPOINT_INVALID);
    expect((caught as TranscriberError).detail['reason']).toBe(reason);
  });

  it('a DONE chunk without segments, and segments on a chunk that is not DONE, cannot be written', () => {
    const store = createCheckpointStore(scratchDir('checkpoint'));
    const chunk = { chunkIndex: 0, seq: 1, failedSeqs: [], fromSample: 0, toSample: 10, startMs: 21, endMs: 22, audioSource: null, status: ChunkStatus.DONE, segments: null, computedAt: null, errorCode: null };
    expect(() => store.save({ ...emptyCheckpoint(identity), chunks: [chunk] })).toThrow();
    expect(() => store.save({ ...emptyCheckpoint(identity), chunks: [{ ...chunk, status: ChunkStatus.PENDING, segments: [] }] })).toThrow();
    expect(store.load(identity)).toBeNull();
  });
});

describe('the mirror port: what `transcript_chunks` refuses, the stand-in refuses (dbc-3 §B.7)', () => {
  const row: ChunkMirrorRow = { sessionId: SESSION, seq: 1, audioFromMs: 0, audioToMs: 10, status: 'PENDING', segments: null, embeddingRef: null, modelId: 'GGML_LARGE_V3_TURBO', computedAt: null };

  it.each([
    ['transcript_chunks_session_check', { sessionId: 'session-1' }],
    ['transcript_chunks_seq_check', { seq: 0 }],
    ['transcript_chunks_audio_check', { audioToMs: 0 }],
    ['transcript_chunks_audio_check', { audioFromMs: -1 }],
    ['transcript_chunks_status_check', { status: 'COMMITTED' as never }],
    ['transcript_chunks_done_check', { status: 'DONE' as const }],
    ['transcript_chunks_done_check', { status: 'DONE' as const, segments: [] }],
    ['transcript_chunks_ref_check', { modelId: 'ggml-large-v3-turbo' }],
  ])('%s', async (constraint, change) => {
    expect(tableRefusal({ ...row, ...change })).toBe(constraint);
    await expect(createMemoryChunkMirror().insertMissing([{ ...row, ...change }])).rejects.toMatchObject({ code: '23514', constraint });
  });

  it('an acceptable row is accepted; an existing row is left as it is by a second insert', async () => {
    const mirror = createMemoryChunkMirror();
    expect(tableRefusal(row)).toBeNull();
    await mirror.insertMissing([row]);
    await mirror.insertMissing([{ ...row, audioToMs: 999 }]);
    expect(mirror.rows()).toEqual([row]);
  });

  it('a model identifier becomes a CODE label for the column: the free identifier itself would be refused', () => {
    expect(toModelCode('ggml-large-v3-turbo')).toBe('GGML_LARGE_V3_TURBO');
    expect(toModelCode('whisper-large-v3-turbo')).toBe('WHISPER_LARGE_V3_TURBO');
    expect(toModelCode('1.7b-model')).toBe('M_1_7B_MODEL');
    expect(toModelCode('x'.repeat(200))).toHaveLength(64);
    for (const id of ['ggml-large-v3-turbo', 'qwen3-asr-1.7b-8bit', '9', 'a.b_c-d']) expect(toModelCode(id)).toMatch(/^[A-Z][A-Z0-9_]{0,63}$/);
  });
});

describe('the runner: plan, decode, commit (§A.2, §A.3)', () => {
  it('the boundaries of every chunk are in the file AND in the mirror before the first chunk is decoded', async () => {
    const r = rig();
    const seen: string[] = [];
    r.adapter.answer = (chunk) => {
      // Asked at the moment the engine is given the FIRST chunk.
      if (seen.length === 0) {
        seen.push(JSON.stringify(r.stored().chunks.map((entry) => entry.status)));
        seen.push(r.mirror.writes.join(','));
      }
      return [{ id: 0, start: 0, end: 1, text: `ucapan pada ${chunk.offsetMs}` }];
    };
    const report = await r.runner().step({ final: true });
    expect(report).toEqual({ planned: 5, decoded: 5, failed: 0, reused: 0, remaining: 0, paused: false, complete: true, qaFlags: [QaFlag.INTERVALS_INCOMPLETE], transcriptState: 'READY', partialReason: null });
    expect(seen[0]).toBe(JSON.stringify(['RUNNING', 'PENDING', 'PENDING', 'PENDING', 'PENDING']));
    expect(seen[1]).toBe('insert 1,insert 2,insert 3,insert 4,insert 5,update 1 RUNNING');
  });

  it('chunks are decoded one at a time, in timeline order; every one is committed with its segments in media time', async () => {
    const r = rig();
    await r.runner().step({ final: true });
    const stored = r.stored();
    expect(r.adapter.queue.maxObserved).toBe(1);
    expect(r.adapter.decodedOffsets).toEqual(stored.chunks.map((chunk) => chunk.startMs));
    expect(stored.audioComplete).toBe(true);
    expect(stored.chunks.map((chunk) => chunk.status)).toEqual(['DONE', 'DONE', 'DONE', 'DONE', 'DONE']);
    // Burst 0 starts at tap sample 96,000 = (96000 + 1024) / 48000 s = 2.021333… s; snapped down to file frame 94.
    expect(stored.chunks[0]).toMatchObject({ chunkIndex: 0, seq: 1, fromSample: 95_232, startMs: 2005, audioSource: null, computedAt: Date.parse('2026-10-09T07:00:00.000Z') });
    for (const chunk of stored.chunks) {
      expect(chunk.segments).toHaveLength(1);
      expect(chunk.segments![0]!.startMs).toBe(chunk.startMs);
      expect(chunk.segments![0]!.endMs).toBeLessThanOrEqual(chunk.endMs);
      expect((chunk.fromSample + 1024) % 1024).toBe(0);
    }
  });

  it('the mirror holds exactly the rows of the checkpoint: ranges in media time, the model as a CODE, DONE with segments and instant', async () => {
    const r = rig();
    await r.runner().step({ final: true });
    const stored = r.stored();
    expect(r.mirror.rows()).toEqual(
      stored.chunks.map((chunk) => ({ sessionId: SESSION, seq: chunk.seq, audioFromMs: chunk.startMs, audioToMs: chunk.endMs, status: 'DONE', segments: chunk.segments, embeddingRef: null, modelId: 'STAND_IN_MODEL', computedAt: chunk.computedAt })),
    );
    expect(r.mirror.rows().every((row) => tableRefusal(row) === null)).toBe(true);
  });

  it(`a failing chunk is tried ${STT_CHUNK_RETRIES} times more, then FAILED; the transcript goes on and no text is made up`, async () => {
    const r = rig();
    const third = (await (async () => {
      const probe = rig();
      await probe.runner().step({ final: true });
      return probe.stored().chunks[2]!.startMs;
    })());
    r.adapter.failChunk(third, 99);
    const report = await r.runner().step({ final: true });
    expect(report).toMatchObject({ planned: 5, decoded: 4, failed: 1, remaining: 0, complete: true });
    expect(r.adapter.decodedOffsets.filter((offset) => offset === third)).toHaveLength(1 + STT_CHUNK_RETRIES);
    const stored = r.stored();
    expect(stored.chunks.map((chunk) => chunk.status)).toEqual(['DONE', 'DONE', 'FAILED', 'DONE', 'DONE']);
    expect(stored.chunks[2]).toMatchObject({ segments: null, computedAt: null, errorCode: 'ENGINE_FAILED' });
    expect(r.mirror.rows()[2]).toMatchObject({ seq: 3, status: 'FAILED', segments: null, computedAt: null });
    // Persistent error record: the team finds it in the log.
    expect(errorRecords(r.log).filter((record) => record.context['reason'] === 'CHUNK_FAILED')).toHaveLength(1);
  });

  it('a chunk that fails twice and then answers is DONE: the retries are inside one attempt', async () => {
    const r = rig();
    const probe = rig();
    await probe.runner().step({ final: true });
    const second = probe.stored().chunks[1]!.startMs;
    r.adapter.failChunk(second, STT_CHUNK_RETRIES);
    expect(await r.runner().step({ final: true })).toMatchObject({ decoded: 5, failed: 0 });
    expect(r.adapter.decodedOffsets.filter((offset) => offset === second)).toHaveLength(STT_CHUNK_RETRIES + 1);
  });

  it('running a FAILED chunk again is a NEW row with the same audio range; the FAILED row stays (dbc-3 §G "FAILED -> rerun pair")', async () => {
    const r = rig();
    const probe = rig();
    await probe.runner().step({ final: true });
    const third = probe.stored().chunks[2]!;
    r.adapter.failChunk(third.startMs, 1 + STT_CHUNK_RETRIES);
    const runner = r.runner();
    await runner.step({ final: true });
    expect(runner.retryFailed()).toBe(1);
    expect(await runner.step({ final: true })).toMatchObject({ planned: 0, decoded: 1, failed: 0, reused: 4, complete: true });
    const stored = r.stored();
    expect(stored.chunks[2]).toMatchObject({ chunkIndex: 2, seq: 6, failedSeqs: [3], status: 'DONE' });
    expect(stored.nextSeq).toBe(7);
    const rows = r.mirror.rows();
    expect(rows.map((row) => [row.seq, row.status])).toEqual([[1, 'DONE'], [2, 'DONE'], [3, 'FAILED'], [4, 'DONE'], [5, 'DONE'], [6, 'DONE']]);
    expect([rows[5]!.audioFromMs, rows[5]!.audioToMs]).toEqual([rows[2]!.audioFromMs, rows[2]!.audioToMs]);
    expect(runner.retryFailed()).toBe(0);
  });
});

describe('the runner: resume (§D.2)', () => {
  it('a second runner on the same scratch directory decodes NOTHING that is committed', async () => {
    const r = rig();
    await r.runner().step({ final: true });
    const before = readFileSync(join(r.dir, TRANSCRIPT_CHECKPOINT_FILE));
    const decodedBefore = r.adapter.decodedOffsets.length;
    const events: string[] = [];
    const report = await r.runner({ onChunk: (event) => events.push(`${event.chunkIndex}:${event.phase}`) }).step({ final: true });
    expect(report).toMatchObject({ planned: 0, decoded: 0, failed: 0, reused: 5, complete: true });
    expect(r.adapter.decodedOffsets).toHaveLength(decodedBefore);
    expect(events).toEqual(['0:reused', '1:reused', '2:reused', '3:reused', '4:reused']);
    expect(readFileSync(join(r.dir, TRANSCRIPT_CHECKPOINT_FILE)).equals(before)).toBe(true);
  });

  it('NEGATIVE CONTROL — the checkpoint of ONE chunk deleted: exactly that chunk is decoded again, and no other', async () => {
    for (const deleted of [0, 3]) {
      const r = rig();
      await r.runner().step({ final: true });
      const stored = r.stored();
      const committed = stored.chunks.map((chunk) => JSON.stringify(chunk));
      const target = stored.chunks[deleted]!;
      // Delete what was committed for that chunk: its segments and its instant; it is back to "planned".
      stored.chunks[deleted] = { ...target, status: ChunkStatus.PENDING, segments: null, computedAt: null };
      writeFileSync(join(r.dir, TRANSCRIPT_CHECKPOINT_FILE), JSON.stringify(stored));
      const decodedBefore = r.adapter.decodedOffsets.length;
      const report = await r.runner().step({ final: true });
      expect(report).toMatchObject({ planned: 0, decoded: 1, reused: 4, complete: true });
      expect(r.adapter.decodedOffsets.slice(decodedBefore)).toEqual([target.startMs]);
      // The four others are byte for byte what they were; the fifth has the same segments again.
      const after = r.stored().chunks.map((chunk) => JSON.stringify(chunk));
      expect(after.filter((_, index) => index !== deleted)).toEqual(committed.filter((_, index) => index !== deleted));
      expect(r.stored().chunks[deleted]!.segments).toEqual(target.segments);
    }
  });

  it('a chunk a kill left RUNNING is decoded again; the ones before it are not; the plan is not made twice', async () => {
    const r = rig();
    const first = r.runner({ shouldPause: () => r.adapter.decodedOffsets.length >= 2 });
    expect(await first.step({ final: true })).toMatchObject({ planned: 5, decoded: 2, remaining: 3, paused: true, complete: false });
    // What a kill during chunk 2 leaves in the file: RUNNING, no segments.
    const stored = r.stored();
    stored.chunks[2] = { ...stored.chunks[2]!, status: ChunkStatus.RUNNING };
    writeFileSync(join(r.dir, TRANSCRIPT_CHECKPOINT_FILE), JSON.stringify(stored));
    const vad = createStubVad();
    const report = await r.runner({ vad }).step({ final: true });
    expect(report).toMatchObject({ planned: 0, decoded: 3, reused: 2, complete: true });
    expect(vad.calls).toEqual([]);
    const offsets = r.stored().chunks.map((chunk) => chunk.startMs);
    expect(r.adapter.decodedOffsets).toEqual(offsets); // each chunk exactly once over both runners
  });

  it('a runner with another backend or model on the same scratch directory is refused: nothing is decoded', async () => {
    const r = rig();
    await r.runner().step({ final: true });
    expect(() => r.runner({ adapter: createStubAdapter('omlx-server') })).toThrow(TranscriberError);
    expect(() => r.runner({ adapter: createStubAdapter('cpu-local', 'another-model') })).toThrow(TranscriberError);
  });
});

describe('the runner: the mirror follows the file, and never stops a transcript (§D.1)', () => {
  it('a database that cannot be reached: every chunk is still committed to the file, and the failure is in the log', async () => {
    const r = rig();
    r.mirror.failNext(10_000);
    const report = await r.runner().step({ final: true });
    expect(report).toMatchObject({ decoded: 5, failed: 0, complete: true });
    expect(r.stored().chunks.every((chunk) => chunk.status === 'DONE')).toBe(true);
    expect(r.mirror.rows()).toEqual([]);
    expect(errorRecords(r.log).filter((record) => record.context['reason'] === 'MIRROR_WRITE_FAILED').length).toBeGreaterThan(0);
  });

  it('when the database is back, the next step brings the rows in line WITHOUT decoding anything', async () => {
    const r = rig();
    r.mirror.failNext(10_000);
    await r.runner().step({ final: true });
    r.mirror.failNext(0);
    const decodedBefore = r.adapter.decodedOffsets.length;
    await r.runner().step({ final: true });
    expect(r.adapter.decodedOffsets).toHaveLength(decodedBefore);
    expect(r.mirror.rows().map((row) => [row.seq, row.status, row.segments?.length])).toEqual([[1, 'DONE', 1], [2, 'DONE', 1], [3, 'DONE', 1], [4, 'DONE', 1], [5, 'DONE', 1]]);
  });

  it('a mirror that lost its updates half-way (rows left RUNNING) is corrected at the resume', async () => {
    const r = rig();
    const runner = r.runner();
    await runner.step({ final: true });
    await r.mirror.update(SESSION, 2, { status: 'RUNNING', segments: null, modelId: 'STAND_IN_MODEL', computedAt: null });
    await r.runner().step({ final: true });
    expect(r.mirror.rows()[1]).toMatchObject({ seq: 2, status: 'DONE' });
    expect(r.mirror.rows()[1]!.segments).toHaveLength(1);
  });

  it('with no mirror at all the runner works on the file alone', async () => {
    const r = rig();
    expect(await r.runner({ mirror: undefined }).step({ final: true })).toMatchObject({ decoded: 5, complete: true });
    expect(r.mirror.rows()).toEqual([]);
  });
});

describe('the runner: failure behaviour of intake and VAD (§A.1, §A.2)', () => {
  it('a VAD that fails: fixed windows, the flag `vad_fallback`, and still a transcript', async () => {
    const r = rig(tonePcm(65 * SECOND, [{ from: SECOND, to: 60 * SECOND }]));
    const report = await r.runner({ vad: createStubVad({ failing: true }) }).step({ final: true });
    expect(report).toMatchObject({ planned: 3, decoded: 3, complete: true });
    expect(report.qaFlags).toContain(QaFlag.VAD_FALLBACK);
    expect(r.stored().chunks.map((chunk) => chunk.endMs - chunk.startMs).every((length) => length <= 30_043)).toBe(true);
  });

  it('no VAD configured at all (the model is not installed): the same fallback, flagged', async () => {
    const r = rig(tonePcm(40 * SECOND, [{ from: SECOND, to: 39 * SECOND }]));
    const report = await r.runner({ vad: null }).step({ final: true });
    expect(report.qaFlags).toContain(QaFlag.VAD_FALLBACK);
    expect(report).toMatchObject({ planned: 2, decoded: 2, complete: true });
  });

  it('no speech in complete audio: an empty transcript, flagged `no_speech`; the engine is never started', async () => {
    const r = rig(tonePcm(20 * SECOND, []));
    const report = await r.runner().step({ final: true });
    expect(report).toMatchObject({ planned: 0, decoded: 0, complete: true, qaFlags: [QaFlag.NO_SPEECH] });
    expect(r.adapter.decodedOffsets).toEqual([]);
    expect(r.mirror.rows()).toEqual([]);
  });

  it('audio that is missing, empty, or not what it says is TRANSCRIPT_AUDIO_UNAVAILABLE: no chunk, no text', async () => {
    const dir = scratchDir('intake');
    const cases: (() => unknown)[] = [
      () => openPcmSource({ container: 'raw', path: join(dir, 'absent.pcm'), sampleRateHz: TAP_RATE }).availableSamples(),
      () => openPcmSource({ container: 'wav', path: join(dir, 'absent.wav'), sampleRateHz: 24_000 }),
      () => {
        writeFileSync(join(dir, 'text.wav'), 'this is not audio');
        return openPcmSource({ container: 'wav', path: join(dir, 'text.wav'), sampleRateHz: 24_000 });
      },
      () => {
        writeFileSync(join(dir, 'rate.wav'), encodeWavPcm16(new Int16Array(100), 24_000));
        return openPcmSource({ container: 'wav', path: join(dir, 'rate.wav'), sampleRateHz: 48_000 });
      },
      () => {
        mkdirSync(join(dir, 'a-directory'));
        return openPcmSource({ container: 'raw', path: join(dir, 'a-directory'), sampleRateHz: TAP_RATE }).availableSamples();
      },
      () => openPcmSource({ container: 'raw', path: writeTap(dir, new Int16Array(10), 'short.pcm'), sampleRateHz: TAP_RATE }).read({ from: 0, to: 11 }),
    ];
    for (const run of cases) {
      let caught: unknown;
      try {
        run();
      } catch (error) {
        caught = error;
      }
      expect((caught as TranscriberError | undefined)?.code).toBe(TranscriberErrorCode.TRANSCRIPT_AUDIO_UNAVAILABLE);
    }
  });

  describe('no tap for this session is a RECORDED outcome, never an empty transcript that looks complete (pair-58 R-8; D58-15; D-EV-1)', () => {
    const expectPartialWithoutAudio = (r: Rig, report: Awaited<ReturnType<ReturnType<Rig['runner']>['step']>>, chunks: number): void => {
      expect(report).toMatchObject({ complete: true, remaining: 0, transcriptState: 'PARTIAL', partialReason: 'TRANSCRIPT_AUDIO_UNAVAILABLE' });
      expect(report.qaFlags).not.toContain(QaFlag.NO_SPEECH);
      const stored = r.stored();
      expect(stored.audioUnavailable).toBe(true);
      expect(stored.chunks).toHaveLength(chunks);
      const logged = errorRecords(r.log).filter((record) => record.context['code'] === 'TRANSCRIPT_AUDIO_UNAVAILABLE');
      expect(logged).toHaveLength(1);
    };

    it('the tap file was never written (a restarted worker records without a tap): PARTIAL / TRANSCRIPT_AUDIO_UNAVAILABLE in the checkpoint and the log; no engine, no text', async () => {
      const r = rig();
      const absent = openPcmSource({ container: 'raw', path: join(r.dir, 'no-such-tap.pcm'), sampleRateHz: TAP_RATE });
      const runner = r.runner({ source: absent });
      // While the session records, a tap that is not there yet is not an outcome: the runner waits.
      expect(await runner.step({ final: false })).toMatchObject({ planned: 0, complete: false, transcriptState: 'PENDING', partialReason: null });
      expect(r.log.records()).toEqual([]);
      expectPartialWithoutAudio(r, await runner.step({ final: true }), 0);
      expect(r.adapter.decodedOffsets).toEqual([]);
      expect(r.mirror.rows()).toEqual([]);
      // A resume reads the same outcome back and does not log it a second time or turn it into READY.
      expectPartialWithoutAudio(r, await r.runner({ source: absent }).step({ final: true }), 0);
    });

    it('a tap file that holds no sample is the same outcome', async () => {
      const r = rig(new Int16Array(0));
      expectPartialWithoutAudio(r, await r.runner().step({ final: true }), 0);
      expect(r.adapter.decodedOffsets).toEqual([]);
    });

    it('a tap that was lost DURING the session (`tapActive: false`): what was captured is transcribed, and the transcript is PARTIAL, not READY', async () => {
      const all = tonePcm(TOTAL, FIVE);
      const r = rig(all.subarray(0, 70 * SECOND)); // the tap ended after 70 s of a 160 s session
      let tapLost = false;
      const runner = r.runner({ tapLost: () => tapLost });
      expect(await runner.step({ final: false })).toMatchObject({ transcriptState: 'PENDING' });
      tapLost = true;
      const report = await runner.step({ final: true });
      expect(report).toMatchObject({ failed: 0, complete: true, transcriptState: 'PARTIAL', partialReason: 'TRANSCRIPT_AUDIO_UNAVAILABLE' });
      const stored = r.stored();
      expect(stored.audioUnavailable).toBe(true);
      expect(stored.chunks.length).toBeGreaterThan(0);
      expect(stored.chunks.every((chunk) => chunk.status === 'DONE' && chunk.endMs <= 70_022)).toBe(true);
    });

    it('NEGATIVE CONTROL: the same audio with the tap active to the end is READY with no reason; silence with a live tap is READY and flagged `no_speech`, not PARTIAL', async () => {
      const r = rig(tonePcm(TOTAL, FIVE).subarray(0, 70 * SECOND));
      expect(await r.runner({ tapLost: () => false }).step({ final: true })).toMatchObject({ complete: true, transcriptState: 'READY', partialReason: null });
      expect(r.stored().audioUnavailable).toBe(false);
      const silent = rig(tonePcm(20 * SECOND, []));
      expect(await silent.runner({ tapLost: () => false }).step({ final: true })).toMatchObject({ transcriptState: 'READY', partialReason: null, qaFlags: [QaFlag.NO_SPEECH] });
    });

    it('a FAILED chunk makes the transcript PARTIAL with its own reason; missing audio takes precedence when both hold', async () => {
      const probe = rig();
      await probe.runner().step({ final: true });
      const second = probe.stored().chunks[1]!.startMs;
      const r = rig();
      r.adapter.failChunk(second, 99);
      expect(await r.runner().step({ final: true })).toMatchObject({ failed: 1, transcriptState: 'PARTIAL', partialReason: 'CHUNKS_FAILED' });
      const both = rig();
      both.adapter.failChunk(second, 99);
      expect(await both.runner({ tapLost: () => true }).step({ final: true })).toMatchObject({ failed: 1, transcriptState: 'PARTIAL', partialReason: 'TRANSCRIPT_AUDIO_UNAVAILABLE' });
    });
  });

  describe('the runner: a WAV source', () => {

  it('a WAV source is read from its data, at its own rate, in file time (no origin)', async () => {
    const dir = scratchDir('wav');
    const samples = tonePcm(24_000 * 12, [{ from: 24_000 * 2, to: 24_000 * 5 }]);
    writeFileSync(join(dir, 'audio.wav'), encodeWavPcm16(samples, 24_000));
    const source = openPcmSource({ container: 'wav', path: join(dir, 'audio.wav'), sampleRateHz: 24_000 });
    expect(source.availableSamples()).toBe(24_000 * 12);
    expect([...source.read({ from: 24_000 * 2 - 1, to: 24_000 * 2 + 2 })]).toEqual([0, samples[48_000], samples[48_001]]);
    const adapter = createStubAdapter();
    const runner = createTranscriptRunner({ sessionId: SESSION, adapter, timeline: decodedFileTimeline(24_000), source, vad: createStubVad(), sessionScratchDir: dir, log: createMemoryLog() });
    await runner.step({ final: true });
    expect(runner.checkpoint().chunks.map((chunk) => [chunk.startMs, chunk.endMs])).toEqual([[2000, 5000]]);
    expect(runner.checkpoint().audio).toEqual({ kind: 'DECODED_FILE', sampleRateHz: 24_000, originSamples: 0, gridSamples: 1 });
  });

  it('the audio-source interval of a chunk is carried when exactly one covers its start; otherwise the transcript is flagged `intervals_incomplete`', async () => {
    const whole = rig();
    const full = await whole.runner({ intervals: () => [{ source: 'PRIMARY', fromMs: 0, toMs: 70_000 }, { source: 'STANDBY', fromMs: 70_000, toMs: null }] }).step({ final: true });
    expect(full.qaFlags).toEqual([]);
    expect(whole.stored().chunks.map((chunk) => chunk.audioSource)).toEqual(['PRIMARY', 'PRIMARY', 'PRIMARY', 'STANDBY', 'STANDBY']);

    const gap = rig();
    const gapped = await gap.runner({ intervals: () => [{ source: 'PRIMARY', fromMs: 0, toMs: 30_000 }, { source: 'STANDBY', fromMs: 20_000, toMs: 60_000 }] }).step({ final: true });
    expect(gapped.qaFlags).toEqual([QaFlag.INTERVALS_INCOMPLETE]);
    expect(gap.stored().chunks.map((chunk) => chunk.audioSource)).toEqual(['PRIMARY', 'STANDBY', null, null, null]);
  });
  });
});

describe('the runner: while a session records (the tap grows; §A.2, §C)', () => {
  it('chunks are planned and committed as audio arrives; a chunk once committed is never planned or decoded again; the end closes the rest', async () => {
    const all = tonePcm(TOTAL, FIVE);
    const r = rig(all.subarray(0, 40 * SECOND));
    const runner = r.runner();
    // 40 s: burst 0 (2..22 s) is there, burst 1 starts at 33 s and reaches the end: nothing is closed yet.
    expect(await runner.step({ final: false })).toMatchObject({ planned: 0, decoded: 0, complete: false });
    growTap(r.tapPath, all.subarray(40 * SECOND, 100 * SECOND));
    // 100 s: bursts 0, 1 are whole, burst 2 (64..84 s) is whole and is the LAST one: it stays open.
    const second = await runner.step({ final: false });
    expect(second).toMatchObject({ planned: 2, decoded: 2, complete: false });
    const committed = JSON.stringify(r.stored().chunks);
    growTap(r.tapPath, all.subarray(100 * SECOND));
    const last = await runner.step({ final: true });
    expect(last).toMatchObject({ planned: 3, decoded: 3, reused: 2, complete: true });
    const stored = r.stored();
    expect(JSON.stringify(stored.chunks.slice(0, 2))).toBe(committed);
    // The same five chunks as the one-pass run over the finished tap.
    const whole = rig();
    await whole.runner().step({ final: true });
    expect(stored.chunks.map((chunk) => [chunk.fromSample, chunk.toSample])).toEqual(whole.stored().chunks.map((chunk) => [chunk.fromSample, chunk.toSample]));
    expect(r.adapter.decodedOffsets).toEqual(stored.chunks.map((chunk) => chunk.startMs));
  });

  it('a pass waits for enough new audio instead of asking the VAD about every few samples', async () => {
    const r = rig(tonePcm(10 * SECOND, [{ from: SECOND, to: 3 * SECOND }]));
    const vad = createStubVad();
    const runner = r.runner({ vad });
    expect(await runner.step({ final: false })).toMatchObject({ planned: 0, complete: false });
    expect(vad.calls).toEqual([]);
    expect(await runner.step({ final: true })).toMatchObject({ planned: 1, decoded: 1, complete: true });
    expect(vad.calls).toEqual([0]);
  });

  it('held back under pressure: `shouldPause` stops the runner BETWEEN chunks, and the next step goes on where it stopped', async () => {
    const r = rig();
    let pressure = false;
    r.adapter.answer = (chunk) => {
      pressure = true; // pressure appears while the first chunk is decoded
      return [{ id: 0, start: 0, end: 1, text: `ucapan pada ${chunk.offsetMs}` }];
    };
    const runner = r.runner({ shouldPause: () => pressure });
    expect(await runner.step({ final: true })).toMatchObject({ planned: 5, decoded: 1, remaining: 4, paused: true, complete: false });
    expect(await runner.step({ final: true })).toMatchObject({ decoded: 0, remaining: 4, paused: true });
    pressure = false;
    r.adapter.answer = (chunk) => [{ id: 0, start: 0, end: 1, text: `ucapan pada ${chunk.offsetMs}` }];
    expect(await runner.step({ final: true })).toMatchObject({ planned: 0, decoded: 4, reused: 1, remaining: 0, paused: false, complete: true });
  });
});

describe('the runner: the clamp is applied before a chunk is committed (§A.3)', () => {
  it('an engine answer with a phantom tail: 0 committed segments end after the chunk, in the file and in the mirror', async () => {
    const r = rig(tonePcm(30 * SECOND, [{ from: 2 * SECOND, to: 12 * SECOND }]));
    r.adapter.answer = () => [
      { id: 0, start: 0.1, end: 6, text: 'Wawancara kita tutup dengan rekaman ini.' },
      { id: 1, start: 6.2, end: 9.8, text: 'Terima kasih atas kerjasamanya.' },
      { id: 2, start: 9.8, end: 39.78, text: 'Terima kasih atas kerjasamanya.' },
      { id: 3, start: 41, end: 44, text: 'Terima kasih.' },
    ];
    await r.runner().step({ final: true });
    const chunk = r.stored().chunks[0]!;
    expect(chunk.segments!.map((segment) => segment.text)).toEqual(['Wawancara kita tutup dengan rekaman ini.', 'Terima kasih atas kerjasamanya.']);
    expect(chunk.segments!.filter((segment) => segment.endMs > chunk.endMs)).toEqual([]);
    expect((r.mirror.rows()[0]!.segments ?? []).filter((segment) => segment.endMs > chunk.endMs)).toEqual([]);
    expect(r.log.records().filter((record) => record.level === 'warn' && record.source === 'transcriber.runner.clamp')).toHaveLength(1);
  });
});

// The row-77 review fixes that landed with row 78 (navigator findings N-1, N-5, N-6, N-9, N-10 and
// the temporary-audio rule D-77-1; `delegation_progress/pair_77_navigator.md`). N-2 (the orphan
// engine) is in `kill-resume.test.ts`, D-77-6 / N-14 in `media-time.test.ts`. Each finding is
// shown as the scenario the navigator ran, with the outcome it must have now and a control.
describe('navigator findings on the runner: N-1, N-5, N-6, N-9, N-10 and the temporary audio (D-77-1)', () => {
  /** Two runs of speech that cannot be joined: two chunks. */
  const TWO = [
    { from: 1 * SECOND, to: 9 * SECOND },
    { from: 50 * SECOND, to: 58 * SECOND },
  ];

  describe('N-1: the tap signal is STICKY — one `true` at any step makes the session PARTIAL for good', () => {
    it('lost while recording, "back" at the end (the navigator\'s scenario): PARTIAL / TRANSCRIPT_AUDIO_UNAVAILABLE, latched in the file at the step that saw it', async () => {
      let lost = false;
      const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false, runner: { tapLost: () => lost } });
      lost = true;
      const mid = await transcript.runner.step({ final: false });
      expect(mid.transcriptState).toBe('PENDING');
      expect(transcript.stored().audioUnavailable).toBe(true); // on the disk already, not only in memory
      lost = false; // a worker that is gone after the stop has no telemetry to say `true` with
      const end = await transcript.runner.step({ final: true });
      expect([end.complete, end.transcriptState, end.partialReason]).toEqual([true, 'PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE']);
      expect(errorRecords(transcript.log).filter((record) => record.context['code'] === 'TRANSCRIPT_AUDIO_UNAVAILABLE')).toHaveLength(1);
    });

    it('…and a NEW runner on the same directory (a restart) still knows it, with a signal that now says false', async () => {
      let lost = true;
      const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false, runner: { tapLost: () => lost } });
      await transcript.runner.step({ final: false });
      lost = false;
      const resumed = createTranscriptRunner({ sessionId: SESSION, adapter: transcript.adapter, timeline: transcript.identity.timeline, source: transcript.source, vad: createStubVad(), sessionScratchDir: transcript.dir, log: transcript.log, tapLost: NO_TAP_SIGNAL });
      expect((await resumed.step({ final: true })).transcriptState).toBe('PARTIAL');
    });

    it('NEGATIVE CONTROL: a signal that never says true ends READY', async () => {
      const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false, runner: { tapLost: () => false } });
      await transcript.runner.step({ final: false });
      expect((await transcript.runner.step({ final: true })).transcriptState).toBe('READY');
    });
  });

  describe('N-9: audio that goes missing after it was planned is missing AUDIO, never READY and never "the engine failed"', () => {
    it('(a) a tap truncated below the cursor between two steps: PARTIAL / TRANSCRIPT_AUDIO_UNAVAILABLE', async () => {
      const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false });
      await transcript.runner.step({ final: false });
      expect(transcript.stored().cursorSample).toBeGreaterThan(20 * SECOND);
      truncateSync(transcript.tapPath, 10 * SECOND * 2);
      const end = await transcript.runner.step({ final: true });
      expect([end.transcriptState, end.partialReason, transcript.stored().audioUnavailable]).toEqual(['PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE', true]);
    });

    it('(b) the tap removed after the plan: the chunks fail on their audio, and the reason is TRANSCRIPT_AUDIO_UNAVAILABLE, not CHUNKS_FAILED', async () => {
      let hold = true;
      const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false, runner: { shouldPause: () => hold } });
      const planned = await transcript.runner.step({ final: true });
      expect([planned.planned, planned.decoded, planned.paused]).toEqual([2, 0, true]);
      rmSync(transcript.tapPath);
      hold = false;
      const end = await transcript.runner.step({ final: true });
      expect(transcript.stored().chunks.map((chunk) => [chunk.status, chunk.errorCode])).toEqual([
        ['FAILED', 'TRANSCRIPT_AUDIO_UNAVAILABLE'],
        ['FAILED', 'TRANSCRIPT_AUDIO_UNAVAILABLE'],
      ]);
      expect([end.transcriptState, end.partialReason, transcript.stored().audioUnavailable]).toEqual(['PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE', true]);
      // …and the document carries that reason (row 78), with no text.
      const assembled = await assembleTranscript({ sessionScratchDir: transcript.dir, identity: transcript.identity, source: transcript.source, diarization: { enabled: true, engine: null }, model: MODEL_PROVENANCE, intervals: [], log: transcript.log });
      expect([assembled.document.header.state, assembled.document.header.partial_reason, assembled.document.header.failed_chunks, assembled.document.segments]).toEqual(['PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE', 2, []]);
    });

    it('NEGATIVE CONTROL: an ENGINE failure on a chunk whose audio is there stays CHUNKS_FAILED', async () => {
      const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false, prepare: (adapter) => void (adapter.answer = () => { throw new TranscriberError(TranscriberErrorCode.ENGINE_FAILED, 'stand-in', { reason: 'STAND_IN_FAILURE' }); }) });
      const end = await transcript.runner.step({ final: true });
      expect([end.transcriptState, end.partialReason, transcript.stored().audioUnavailable]).toEqual(['PARTIAL', 'CHUNKS_FAILED', false]);
    });

    it('control: a tap that GROWS between two steps is the ordinary case', async () => {
      const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false });
      await transcript.runner.step({ final: false });
      growTap(transcript.tapPath, new Int16Array(5 * SECOND));
      expect((await transcript.runner.step({ final: true })).transcriptState).toBe('READY');
    });
  });

  describe('N-10: a live session states its signals — nothing is off by omission', () => {
    const build = (overrides: Record<string, unknown>) => {
      const dir = scratchDir('n10');
      const path = writeTap(dir, tonePcm(10 * SECOND, []));
      return () => createTranscriptRunner({ sessionId: SESSION, adapter: createStubAdapter(), timeline: captureTapTimeline(), source: openPcmSource({ container: 'raw', path, sampleRateHz: TAP_RATE }), vad: createStubVad(), sessionScratchDir: dir, log: transcriptLog, tapLost: NO_TAP_SIGNAL, ...overrides } as never);
    };
    const transcriptLog = { error: () => undefined, warn: () => undefined, info: () => undefined, protect: () => undefined };
    const reason = (make: () => unknown): unknown => {
      try {
        make();
        return null;
      } catch (error) {
        return [(error as TranscriberError).code, (error as TranscriberError).detail['reason']];
      }
    };

    it('a tap timeline without a tap signal is CONFIG_INVALID / TAP_SIGNAL_NOT_STATED', () => {
      expect(reason(build({ tapLost: undefined }))).toEqual(['CONFIG_INVALID', 'TAP_SIGNAL_NOT_STATED']);
    });

    it('a tap timeline with an adapter that was composed without its capture worker is CONFIG_INVALID / CAPTURE_WORKER_NOT_STATED', () => {
      expect(reason(build({ adapter: { ...createStubAdapter(), captureWorkerStated: false } }))).toEqual(['CONFIG_INVALID', 'CAPTURE_WORKER_NOT_STATED']);
      expect(reason(build({ adapter: { ...createStubAdapter(), captureWorkerStated: undefined } }))).toEqual(['CONFIG_INVALID', 'CAPTURE_WORKER_NOT_STATED']);
    });

    it('…and so is a VAD engine that was composed without it', () => {
      expect(reason(build({ vad: { detect: async () => [], captureWorkerStated: false } }))).toEqual(['CONFIG_INVALID', 'CAPTURE_WORKER_NOT_STATED']);
    });

    it('control: with the explicit "none" values the same composition is accepted; a finished FILE (the fixture checks) needs neither', () => {
      expect(reason(build({}))).toBeNull();
      const dir = scratchDir('n10');
      const path = writeTap(dir, tonePcm(SECOND, []));
      expect(() => createTranscriptRunner({ sessionId: SESSION, adapter: { ...createStubAdapter(), captureWorkerStated: false }, timeline: decodedFileTimeline(TAP_RATE), source: openPcmSource({ container: 'raw', path, sampleRateHz: TAP_RATE }), vad: null, sessionScratchDir: dir, log: transcriptLog })).not.toThrow();
    });
  });

  describe('N-5: a short answer really said twice at the end of a chunk is kept; the phantom tail is still dropped', () => {
    const file = decodedFileTimeline(24_000);
    const tenSeconds = { from: 0, to: 24_000 * 10 };

    it('the navigator\'s case: "Ya." 5.0-7.5, then "ya" 7.9-10.03 — both kept, the second clamped to the audio end', () => {
      const result = clampSegments([{ id: 0, start: 5, end: 7.5, text: 'Ya.' }, { id: 1, start: 7.9, end: 10.03, text: 'ya' }], file, tenSeconds);
      expect(result.dropped).toEqual([]);
      expect(result.segments.map((segment) => [segment.startMs, segment.endMs, segment.text])).toEqual([[5000, 7500, 'Ya.'], [7900, 10_000, 'ya']]);
    });

    it('however far the engine overshoots: 2.1 s of real repeated speech inside the audio are never dropped for their text', () => {
      const result = clampSegments([{ id: 0, start: 5, end: 7.5, text: 'Ya.' }, { id: 1, start: 7.9, end: 40, text: 'ya' }], file, tenSeconds);
      expect([result.dropped, result.segments.at(-1)?.endMs]).toEqual([[], 10_000]);
    });

    it('the stated minimum is a boundary: a repeated remainder of 499 ms is dropped, one of 500 ms is kept', () => {
      expect(CLAMP_MIN_REMAINDER_MS).toBe(500);
      const at = (start: number) => clampSegments([{ id: 0, start: 5, end: 7.5, text: 'Ya.' }, { id: 1, start, end: 40, text: 'ya' }], file, tenSeconds).dropped;
      expect(at(9.501)).toEqual([{ reason: DropReason.CLAMPED_TAIL_REPEATS_PREVIOUS, index: 1 }]);
      expect(at(9.5)).toEqual([]);
    });

    it('the phantom tail of the stored engine answer (starts 181 ms before the audio end, ends 29.8 s after it, repeats the previous text) is dropped as before', () => {
      const whole = { from: 0, to: 1_577_280 };
      const result = clampSegments([{ id: 15, start: 63.74, end: 65.54, text: 'Terima kasih atas kerjasamanya.' }, { id: 16, start: 65.54, end: 95.52000000000001, text: 'Terima kasih atas kerjasamanya.' }], file, whole);
      expect(result.dropped).toEqual([{ reason: DropReason.CLAMPED_TAIL_REPEATS_PREVIOUS, index: 1 }]);
      expect(result.segments.map((segment) => segment.endMs)).toEqual([65_540]);
    });
  });

  describe('N-6: a lost checkpoint FILE is rebuilt in NEW rows — an old row never gets new segments under its old range', () => {
    it('the table keeps the rows of the lost file untouched; the rebuilt transcript takes row numbers above them; the rebuild is logged', async () => {
      const mirror = createMemoryChunkMirror();
      const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, runner: { mirror } });
      const before = (await mirror.read(SESSION)).map((row) => ({ ...row }));
      expect(before.map((row) => row.seq)).toEqual([1, 2]);
      rmSync(join(transcript.dir, TRANSCRIPT_CHECKPOINT_FILE));
      // The second run plans OTHER ranges (no VAD: fixed windows), as in the navigator's scenario.
      const rebuilt = createTranscriptRunner({ sessionId: SESSION, adapter: transcript.adapter, timeline: transcript.identity.timeline, source: transcript.source, vad: null, sessionScratchDir: transcript.dir, log: transcript.log, mirror, tapLost: NO_TAP_SIGNAL });
      expect((await rebuilt.step({ final: true })).complete).toBe(true);
      const after = await mirror.read(SESSION);
      expect(after.filter((row) => row.seq <= 2)).toEqual(before); // byte for byte what the lost file had written
      expect(after.filter((row) => row.seq > 2).map((row) => row.seq)).toEqual(rebuilt.checkpoint().chunks.map((chunk) => chunk.seq));
      expect(rebuilt.checkpoint().chunks.every((chunk) => chunk.seq > 2)).toBe(true);
      // Every row's segments lie inside that row's own range.
      for (const row of after) for (const segment of row.segments ?? []) expect(segment.startMs >= row.audioFromMs && segment.endMs <= row.audioToMs).toBe(true);
      expect(transcript.log.records().filter((record) => record.context['reason'] === 'CHECKPOINT_REBUILT')).toMatchObject([{ level: 'warn', context: { staleRows: 2, nextSeq: 3 } }]);
    });

    it('control: a resume WITH its checkpoint file takes no new row and logs no rebuild', async () => {
      const mirror = createMemoryChunkMirror();
      const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, runner: { mirror } });
      const resumed = createTranscriptRunner({ sessionId: SESSION, adapter: transcript.adapter, timeline: transcript.identity.timeline, source: transcript.source, vad: createStubVad(), sessionScratchDir: transcript.dir, log: transcript.log, mirror, tapLost: NO_TAP_SIGNAL });
      await resumed.step({ final: true });
      expect((await mirror.read(SESSION)).map((row) => row.seq)).toEqual([1, 2]);
      expect(transcript.log.records().filter((record) => record.context['reason'] === 'CHECKPOINT_REBUILT')).toEqual([]);
    });
  });

  describe('temporary audio (D-77-1): unencrypted session audio does not stay behind', () => {
    it('at the end of a run the work directory is gone', async () => {
      const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND });
      expect(existsSync(join(transcript.dir, 'work'))).toBe(false);
    });

    it('what a killed pipeline left (a chunk file, a VAD window, a labelling file, an engine record) is removed before a resume does anything, and said in the log', async () => {
      const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false });
      mkdirSync(join(transcript.dir, 'work'), { recursive: true });
      for (const name of ['chunk-2.wav', 'vad-window.wav', 'diarization-segments.pcm', 'engine.json']) writeFileSync(join(transcript.dir, 'work', name), 'session audio');
      const decodedBefore = transcript.adapter.decodedOffsets.length;
      createTranscriptRunner({ sessionId: SESSION, adapter: transcript.adapter, timeline: transcript.identity.timeline, source: transcript.source, vad: createStubVad(), sessionScratchDir: transcript.dir, log: transcript.log, tapLost: NO_TAP_SIGNAL });
      expect(readdirSync(join(transcript.dir, 'work'))).toEqual([]);
      expect(transcript.adapter.decodedOffsets.length).toBe(decodedBefore);
      expect(transcript.log.records().filter((record) => record.context['reason'] === 'STALE_WORK_CLEARED')).toMatchObject([{ level: 'warn', context: { files: 4, engineStopped: false } }]);
    });

    it('on abandon or after the assembly: `discardTranscriptAudio` removes the work directory and the raw tap copy, and NOT the checkpoint or the transcript', async () => {
      const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND });
      await assembleTranscript({ sessionScratchDir: transcript.dir, identity: transcript.identity, source: transcript.source, diarization: { enabled: true, engine: null }, model: MODEL_PROVENANCE, intervals: [], log: transcript.log });
      mkdirSync(join(transcript.dir, 'work'), { recursive: true });
      writeFileSync(join(transcript.dir, 'work', 'chunk-9.wav'), 'session audio');
      discardTranscriptAudio(transcript.dir, transcript.tapPath);
      expect(readdirSync(transcript.dir).sort()).toEqual(['transcript-checkpoint.json', 'transcript.json', 'transcript.srt', 'transcript.vtt']);
      // Twice is harmless.
      expect(() => discardTranscriptAudio(transcript.dir, transcript.tapPath)).not.toThrow();
    });
  });
});
