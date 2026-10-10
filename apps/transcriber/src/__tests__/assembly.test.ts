// Assembly (row 78; transcript spec §A.4 "Checkpoint", §A.5, §D.1, §D.3): the real runner of row 77
// finishes a transcript over a synthetic tap, then `assembleTranscript` runs the diarization
// post-pass (a stand-in engine), writes the document and its renderings, and records them in the
// checkpoint file — each ONCE. Part of M6-TF-1 criterion 6 (speaker state present) and of M6-LB-1
// ("asserted in TF-1"): both speaker states are shown on a whole pipeline run here.
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assembleTranscript, type AssembleTranscriptOptions } from '../pipeline/assembly';
import { ChunkStatus } from '../pipeline/checkpoint';
import { TRANSCRIPT_CHECKPOINT_FILE } from '../pipeline/constants';
import { TranscriptDocumentSchema, sha256HexOfText } from '../pipeline/document';
import { TranscriberError, TranscriberErrorCode } from '../types';
import { labelSegments } from '../pipeline/diarization';
import { MODEL_PROVENANCE, SIX_BURSTS, STUB_FACTS, alternatingVoices, createStubEmbedder, looseVoices, transcriptOf, voice, type FinishedTranscript, type StubEmbedder } from './diarization-support';
import { TAP_RATE } from './pipeline-support';
import { errorRecords } from './support';

/** The six bursts in media time of the sealed file (tap time + 21 ms origin, rounded as the runner rounds). */
const BURSTS_MS = SIX_BURSTS.map((burst) => ({ fromMs: Math.round(((burst.from + 1024) * 1000) / TAP_RATE), toMs: Math.round(((burst.to + 1024) * 1000) / TAP_RATE) }));
/** What the engine answers: the embeddings of two voices taking turns, one per segment. */
const VOICES = alternatingVoices(6);
/** The confidence the rule gives those embeddings (computed by the rule itself; its value is held in `diarization.test.ts`). */
const CONFIDENCE = labelSegments(VOICES).confidence;
const INTERVALS = [{ source: 'MIC-01', fromMs: 0, toMs: null }];

const optionsOf = (transcript: FinishedTranscript, engine: StubEmbedder | null, enabled = true): AssembleTranscriptOptions => ({
  sessionScratchDir: transcript.dir,
  identity: transcript.identity,
  source: transcript.source,
  diarization: { enabled, engine },
  model: MODEL_PROVENANCE,
  intervals: INTERVALS,
  log: transcript.log,
});

async function refusal(run: Promise<unknown>): Promise<TranscriberError> {
  let caught: unknown;
  try {
    await run;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(TranscriberError);
  return caught as TranscriberError;
}

describe('the stand-in transcript itself', () => {
  it('six bursts give six committed segments at their media times (so the label checks below rest on known positions)', async () => {
    const transcript = await transcriptOf();
    const segments = transcript.stored().chunks.flatMap((chunk) => chunk.segments ?? []);
    expect(segments.map((segment) => [segment.startMs, segment.endMs])).toEqual(BURSTS_MS.map((burst) => [burst.fromMs, burst.toMs]));
    expect(BURSTS_MS[0]).toEqual({ fromMs: 1_021, toMs: 5_021 });
  });
});

describe('M6-TF-1 criterion 6 / M6-LB-1 on a whole pipeline run: the speaker state is present, LABELLED or UNAVAILABLE', () => {
  it('diarizer loaded: the document is LABELLED, two speakers, every segment A or B in turn; three files and the record are written', async () => {
    const transcript = await transcriptOf();
    const engine = createStubEmbedder(VOICES);
    const result = await assembleTranscript(optionsOf(transcript, engine));

    expect(result.alreadyAssembled).toBe(false);
    expect(result.document.speaker_state).toBe('LABELLED');
    expect(result.document.segments.map((segment) => segment.speaker)).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
    expect(result.document.header).toMatchObject({ state: 'ASSEMBLED', partial_reason: null, speaker_reason: null, failed_chunks: 0, diarization: { num_speakers: 2, confidence: CONFIDENCE } });
    expect(result.document.header.diarization.engine).toMatchObject({ engine: STUB_FACTS.engine });
    expect(result.document.qa_flags).not.toContain('speaker labels unavailable');
    expect(result.document.intervals).toEqual([{ source: 'MIC-01', from_ms: 0, to_ms: null }]);

    // The files hold exactly the rendered texts, and their hashes are the recorded ones.
    expect(readFileSync(result.files.json, 'utf8')).toBe(result.rendered.json);
    expect(sha256HexOfText(readFileSync(result.files.json, 'utf8'))).toBe(result.record.jsonSha256);
    expect(sha256HexOfText(readFileSync(result.files.srt, 'utf8'))).toBe(result.record.srtSha256);
    expect(sha256HexOfText(readFileSync(result.files.vtt, 'utf8'))).toBe(result.record.vttSha256);
    expect(TranscriptDocumentSchema.parse(JSON.parse(readFileSync(result.files.json, 'utf8')))).toEqual(result.document);
    expect(readdirSync(transcript.dir).sort()).toEqual(['tap.pcm', 'transcript-checkpoint.json', 'transcript.json', 'transcript.srt', 'transcript.vtt', 'work']);
    expect(readdirSync(join(transcript.dir, 'work'))).toEqual([]);

    // §D.1: the label map + state, and {assembled, doc_hash, speaker_state}, are in the checkpoint file.
    const stored = transcript.stored();
    expect(stored.diarization).toEqual({ state: 'LABELLED', reason: null, numSpeakers: 2, confidence: CONFIDENCE, segments: 6, labels: ['A', 'B', 'A', 'B', 'A', 'B'], engine: STUB_FACTS });
    expect(stored.document).toEqual({ assembled: true, docSha256: result.record.jsonSha256, srtSha256: result.record.srtSha256, vttSha256: result.record.vttSha256, speakerState: 'LABELLED', state: 'ASSEMBLED' });
    expect(result.record).toMatchObject({ labelsStatus: 'LABELLED', state: 'ASSEMBLED', failedChunks: 0, diarization: { numSpeakers: 2, status: 'LABELLED', confidence: CONFIDENCE, reason: null } });
    expect(errorRecords(transcript.log)).toEqual([]);
  });

  it('diarizer absent: the document is UNAVAILABLE with the flag `speaker labels unavailable` and its reason; the TEXT is the same as in the labelled run', async () => {
    const labelled = await assembleTranscript(optionsOf(await transcriptOf(), createStubEmbedder(VOICES)));
    const transcript = await transcriptOf();
    const result = await assembleTranscript(optionsOf(transcript, null));
    expect(result.document.speaker_state).toBe('UNAVAILABLE');
    expect(result.document.qa_flags).toContain('speaker labels unavailable');
    expect(result.document.header.speaker_reason).toBe('ENGINE_NOT_CONFIGURED');
    expect(result.document.segments.map((segment) => segment.speaker)).toEqual([null, null, null, null, null, null]);
    expect(result.document.segments.map((segment) => [segment.start_ms, segment.end_ms, segment.text])).toEqual(labelled.document.segments.map((segment) => [segment.start_ms, segment.end_ms, segment.text]));
    expect(result.document.header.state).toBe('ASSEMBLED'); // an unlabelled transcript is a COMPLETE transcript
    expect(transcript.stored().document).toMatchObject({ assembled: true, speakerState: 'UNAVAILABLE' });
    expect(result.record.jsonSha256).not.toBe(labelled.record.jsonSha256);
  });

  it('a diarizer that fails (model not loadable): UNAVAILABLE with ENGINE_FAILED — the transcript is assembled all the same', async () => {
    const transcript = await transcriptOf();
    const engine = createStubEmbedder(VOICES);
    engine.failure = new TranscriberError(TranscriberErrorCode.DIARIZATION_FAILED, 'the speaker-embedding engine gave no usable answer', { reason: 'ENGINE_FAILED' });
    const result = await assembleTranscript(optionsOf(transcript, engine));
    expect([result.document.speaker_state, result.document.header.speaker_reason, result.document.segments.length, result.document.header.state]).toEqual(['UNAVAILABLE', 'ENGINE_FAILED', 6, 'ASSEMBLED']);
  });

  it('a diarizer whose answer is not confident enough: UNAVAILABLE with LOW_CONFIDENCE, the confidence recorded, no label kept', async () => {
    const transcript = await transcriptOf();
    const result = await assembleTranscript(optionsOf(transcript, createStubEmbedder(looseVoices())));
    expect([result.document.speaker_state, result.document.header.speaker_reason, result.document.header.diarization.num_speakers]).toEqual(['UNAVAILABLE', 'LOW_CONFIDENCE', 2]);
    expect(result.document.header.diarization.confidence).toBeLessThan(0.5);
    expect(result.document.segments.every((segment) => segment.speaker === null)).toBe(true);
  });

  it('diarization switched off in the session configuration: UNAVAILABLE / DISABLED_BY_CONFIGURATION, no engine started', async () => {
    const transcript = await transcriptOf();
    const engine = createStubEmbedder(VOICES);
    const result = await assembleTranscript(optionsOf(transcript, engine, false));
    expect([result.document.speaker_state, result.document.header.speaker_reason, engine.calls.length]).toEqual(['UNAVAILABLE', 'DISABLED_BY_CONFIGURATION', 0]);
  });
});

describe('the hash is stable across two RUNS of the whole pipeline (two sessions scratch directories, same audio)', () => {
  it('two independent runs give byte-identical documents and the same three hashes', async () => {
    const a = await assembleTranscript(optionsOf(await transcriptOf(), createStubEmbedder(VOICES)));
    // The second run commits at another instant and its engine answers at another scale (the direction of a vector is what counts).
    const b = await assembleTranscript(optionsOf(await transcriptOf({ runner: { now: () => new Date('2027-01-01T00:00:00.000Z') } }), createStubEmbedder(VOICES.map((vector) => vector.map((value) => value * 2)))));
    expect(a.files.json).not.toBe(b.files.json);
    expect(readFileSync(b.files.json)).toEqual(readFileSync(a.files.json));
    expect([b.record.jsonSha256, b.record.srtSha256, b.record.vttSha256]).toEqual([a.record.jsonSha256, a.record.srtSha256, a.record.vttSha256]);
  });

  it('NEGATIVE CONTROL: a run whose engine heard one segment differently has another hash', async () => {
    const a = await assembleTranscript(optionsOf(await transcriptOf(), createStubEmbedder(VOICES)));
    const other = await transcriptOf({
      prepare: (adapter) => {
        const answer = adapter.answer;
        adapter.answer = (chunk) => answer(chunk).map((segment, index) => (index === 0 ? { ...segment, text: `${segment.text}.` } : segment));
      },
    });
    const b = await assembleTranscript(optionsOf(other, createStubEmbedder(VOICES)));
    expect(b.record.jsonSha256).not.toBe(a.record.jsonSha256);
  });
});

describe('written once (§A.4 "Checkpoint", §D.1, §D.3 "Idempotence")', () => {
  it('a second call computes nothing: no engine start, the same document, files untouched, `alreadyAssembled`', async () => {
    const transcript = await transcriptOf();
    const engine = createStubEmbedder(VOICES);
    const first = await assembleTranscript(optionsOf(transcript, engine));
    const checkpointBytes = readFileSync(join(transcript.dir, TRANSCRIPT_CHECKPOINT_FILE));
    // Even an engine that would now answer differently is not asked.
    engine.vectors = VOICES.map((_, index) => voice(0, index));
    const second = await assembleTranscript(optionsOf(transcript, engine));
    expect(engine.calls).toHaveLength(1);
    expect(second.alreadyAssembled).toBe(true);
    expect(second.rendered).toEqual(first.rendered);
    expect(readFileSync(join(transcript.dir, TRANSCRIPT_CHECKPOINT_FILE))).toEqual(checkpointBytes);
  });

  it('a kill between the label map and the document: the next call finds the labels, starts no engine, and writes the same document', async () => {
    const reference = await assembleTranscript(optionsOf(await transcriptOf(), createStubEmbedder(VOICES)));
    const transcript = await transcriptOf();
    const engine = createStubEmbedder(VOICES);
    await assembleTranscript(optionsOf(transcript, engine));
    // The state a kill after step 1 leaves: labels in the checkpoint, no document record, no files.
    const stored = transcript.stored();
    delete stored.document;
    writeFileSync(join(transcript.dir, TRANSCRIPT_CHECKPOINT_FILE), `${JSON.stringify(stored)}\n`);
    for (const name of ['transcript.json', 'transcript.srt', 'transcript.vtt']) rmSync(join(transcript.dir, name));
    engine.failure = new Error('the engine must not be started again');
    const again = await assembleTranscript(optionsOf(transcript, engine));
    expect(engine.calls).toHaveLength(1);
    expect(again.alreadyAssembled).toBe(false);
    expect(again.record.jsonSha256).toBe(reference.record.jsonSha256);
    expect(transcript.stored().document?.docSha256).toBe(reference.record.jsonSha256);
  });

  it.each(['transcript.json', 'transcript.srt', 'transcript.vtt'])('§A.5 "rebuild from committed chunks": a missing or changed %s is written again with the RECORDED hash', async (name) => {
    const transcript = await transcriptOf();
    const first = await assembleTranscript(optionsOf(transcript, createStubEmbedder(VOICES)));
    const original = readFileSync(join(transcript.dir, name));
    writeFileSync(join(transcript.dir, name), `${original.toString('utf8')} `); // one byte more
    const repaired = await assembleTranscript(optionsOf(transcript, null));
    expect(repaired.alreadyAssembled).toBe(true);
    expect(readFileSync(join(transcript.dir, name))).toEqual(original);
    rmSync(join(transcript.dir, name));
    await assembleTranscript(optionsOf(transcript, null));
    expect(readFileSync(join(transcript.dir, name))).toEqual(original);
    expect(transcript.stored().document?.docSha256).toBe(first.record.jsonSha256);
  });

  it('the machine transcript is never REPLACED: committed text that changed after the assembly is refused (DOCUMENT_HASH_MISMATCH), files and record untouched', async () => {
    const transcript = await transcriptOf();
    const first = await assembleTranscript(optionsOf(transcript, createStubEmbedder(VOICES)));
    const stored = transcript.stored();
    const segment = stored.chunks[0]?.segments?.[0];
    if (segment === undefined) throw new Error('unreachable');
    segment.text = `${segment.text}!`; // one character
    writeFileSync(join(transcript.dir, TRANSCRIPT_CHECKPOINT_FILE), `${JSON.stringify(stored)}\n`);
    const error = await refusal(assembleTranscript(optionsOf(transcript, null)));
    expect([error.code, error.detail['reason'], error.detail['recorded']]).toEqual([TranscriberErrorCode.ASSEMBLY_REFUSED, 'DOCUMENT_HASH_MISMATCH', first.record.jsonSha256]);
    expect(readFileSync(first.files.json, 'utf8')).toBe(first.rendered.json);
    expect(transcript.stored().document?.docSha256).toBe(first.record.jsonSha256);
    expect(errorRecords(transcript.log).at(-1)?.context['reason']).toBe('DOCUMENT_HASH_MISMATCH');
  });

  it('…and so is a call that brings other header facts than the first one (another model provenance)', async () => {
    const transcript = await transcriptOf();
    await assembleTranscript(optionsOf(transcript, null));
    const error = await refusal(assembleTranscript({ ...optionsOf(transcript, null), model: { ...MODEL_PROVENANCE, version: '2' } }));
    expect(error.detail['reason']).toBe('DOCUMENT_HASH_MISMATCH');
  });

  it('a label map that belongs to another number of segments is refused, never applied in part', async () => {
    const transcript = await transcriptOf();
    await assembleTranscript(optionsOf(transcript, createStubEmbedder(VOICES)));
    const stored = transcript.stored();
    delete stored.document;
    stored.chunks[0]?.segments?.pop();
    writeFileSync(join(transcript.dir, TRANSCRIPT_CHECKPOINT_FILE), `${JSON.stringify(stored)}\n`);
    expect((await refusal(assembleTranscript(optionsOf(transcript, null)))).detail['reason']).toBe('LABEL_MAP_OF_OTHER_SEGMENTS');
  });

  it('the runner that is still in memory keeps the label map and the record when it writes again, and retries no chunk after the assembly', async () => {
    const transcript = await transcriptOf();
    const result = await assembleTranscript(optionsOf(transcript, createStubEmbedder(VOICES)));
    const report = await transcript.runner.step({ final: true }); // writes the checkpoint again
    expect(report.complete).toBe(true);
    expect(transcript.runner.retryFailed()).toBe(0);
    expect(transcript.stored().document?.docSha256).toBe(result.record.jsonSha256);
    expect(transcript.stored().diarization?.labels).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
    expect(transcript.runner.checkpoint().document?.assembled).toBe(true);
  });
});

describe('an unfinished transcript is never assembled; a finished-but-incomplete one is PARTIAL (§A.5; D-EV-1; row 77 tap signal)', () => {
  // Pin moved by fix wave K (driver S1; re-gate 75 finding G75c-08): the refusal is still thrown, and it is logged at
  // INFO, not at error - the Core classes it NOT_READY and asks again once a second while a healthy seal waits.
  it('chunks still to decode: ASSEMBLY_REFUSED / TRANSCRIPT_NOT_COMPLETE, nothing written, logged as a WAIT (info), never as an error', async () => {
    const transcript = await transcriptOf({ finish: false });
    await transcript.runner.step({ final: false }); // plans, and the stand-in decodes what is planned…
    const stored = transcript.stored();
    expect(stored.audioComplete).toBe(false); // …but the plan does not cover the whole audio yet
    const error = await refusal(assembleTranscript(optionsOf(transcript, null)));
    expect([error.code, error.detail['reason']]).toEqual([TranscriberErrorCode.ASSEMBLY_REFUSED, 'TRANSCRIPT_NOT_COMPLETE']);
    expect(existsSync(join(transcript.dir, 'transcript.json'))).toBe(false);
    expect(transcript.stored().diarization).toBeUndefined();
    const said = transcript.log.records().filter((record) => record.context['reason'] === 'TRANSCRIPT_NOT_COMPLETE');
    expect(said.map((record) => [record.level, record.message])).toEqual([['info', 'the transcript is not complete yet: assembly waits']]);
    expect(said[0]?.stackTrace ?? null).toBeNull();
    expect(errorRecords(transcript.log).filter((record) => record.context['reason'] === 'TRANSCRIPT_NOT_COMPLETE')).toEqual([]);
    // CONTROL - a refusal that is NOT a wait is still an error line: no checkpoint at all.
    rmSync(join(transcript.dir, TRANSCRIPT_CHECKPOINT_FILE));
    const other = await refusal(assembleTranscript(optionsOf(transcript, null)));
    expect(other.detail['reason']).toBe('NO_CHECKPOINT');
    expect(errorRecords(transcript.log).at(-1)).toMatchObject({ message: expect.stringContaining('transcript assembly refused') as string, context: { reason: 'NO_CHECKPOINT' } });
  });

  it('a chunk left RUNNING by a kill: refused the same way', async () => {
    const transcript = await transcriptOf();
    const stored = transcript.stored();
    const chunk = stored.chunks[0];
    if (chunk === undefined) throw new Error('unreachable');
    Object.assign(chunk, { status: ChunkStatus.RUNNING, segments: null, computedAt: null });
    writeFileSync(join(transcript.dir, TRANSCRIPT_CHECKPOINT_FILE), `${JSON.stringify(stored)}\n`);
    expect((await refusal(assembleTranscript(optionsOf(transcript, null)))).detail).toMatchObject({ reason: 'TRANSCRIPT_NOT_COMPLETE', unfinished: 1 });
  });

  it('no checkpoint at all: ASSEMBLY_REFUSED / NO_CHECKPOINT', async () => {
    const transcript = await transcriptOf();
    rmSync(join(transcript.dir, TRANSCRIPT_CHECKPOINT_FILE));
    expect((await refusal(assembleTranscript(optionsOf(transcript, null)))).detail['reason']).toBe('NO_CHECKPOINT');
  });

  it('the tap was lost (row 77 `tapLost`): the document says PARTIAL / TRANSCRIPT_AUDIO_UNAVAILABLE and keeps what was captured', async () => {
    const transcript = await transcriptOf({ runner: { tapLost: () => true } });
    expect(transcript.stored().audioUnavailable).toBe(true);
    const result = await assembleTranscript(optionsOf(transcript, createStubEmbedder(VOICES)));
    expect([result.document.header.state, result.document.header.partial_reason, result.document.segments.length]).toEqual(['PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE', 6]);
    expect([result.record.state, result.record.partialReason]).toEqual(['PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE']);
    expect(transcript.stored().document?.state).toBe('PARTIAL');
  });

  it('no tap file at all: PARTIAL with zero segments and UNAVAILABLE labels — never an empty transcript that reads as complete', async () => {
    const transcript = await transcriptOf({ finish: false });
    rmSync(transcript.tapPath);
    await transcript.runner.step({ final: true });
    const result = await assembleTranscript(optionsOf(transcript, createStubEmbedder(VOICES)));
    expect([result.document.header.state, result.document.header.partial_reason, result.document.segments, result.document.speaker_state, result.document.header.speaker_reason]).toEqual(['PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE', [], 'UNAVAILABLE', 'TOO_FEW_SEGMENTS']);
    expect(result.document.qa_flags).not.toContain('no_speech');
  });

  it('a chunk that ended FAILED: PARTIAL / CHUNKS_FAILED, failed_chunks 1, and no text for it', async () => {
    // Two bursts 40 s apart cannot be joined: two chunks. The engine fails on the second, for good.
    const bursts = [
      { from: 1 * TAP_RATE, to: 9 * TAP_RATE },
      { from: 50 * TAP_RATE, to: 58 * TAP_RATE },
    ];
    const transcript = await transcriptOf({
      bursts,
      total: 60 * TAP_RATE,
      finish: false,
      prepare: (adapter) => {
        const answer = adapter.answer;
        adapter.answer = (chunk) => {
          if (chunk.offsetMs > 40_000) throw new TranscriberError(TranscriberErrorCode.ENGINE_FAILED, 'the stand-in engine ended with an error', { reason: 'STAND_IN_FAILURE' });
          return answer(chunk);
        };
      },
    });
    const report = await transcript.runner.step({ final: true });
    expect(transcript.stored().chunks.map((chunk) => chunk.status)).toEqual(['DONE', 'FAILED']);
    expect([report.complete, report.transcriptState, report.partialReason]).toEqual([true, 'PARTIAL', 'CHUNKS_FAILED']);
    const result = await assembleTranscript(optionsOf(transcript, null));
    expect([result.document.header.state, result.document.header.partial_reason, result.document.header.failed_chunks, result.document.header.chunks, result.document.segments.length]).toEqual(['PARTIAL', 'CHUNKS_FAILED', 1, 2, 1]);
    expect(result.record.failedChunks).toBe(1);
  });

  it('written once: after the assembly a FAILED chunk is NOT retried (the PARTIAL machine transcript stands); before it, the same call re-queues it', async () => {
    const failing = (adapter: { answer: (chunk: never) => unknown }): void => {
      const answer = adapter.answer;
      adapter.answer = ((chunk: { offsetMs: number }) => {
        if (chunk.offsetMs > 40_000) throw new TranscriberError(TranscriberErrorCode.ENGINE_FAILED, 'the stand-in engine ended with an error', { reason: 'STAND_IN_FAILURE' });
        return answer(chunk as never);
      }) as never;
    };
    const bursts = [
      { from: 1 * TAP_RATE, to: 9 * TAP_RATE },
      { from: 50 * TAP_RATE, to: 58 * TAP_RATE },
    ];
    // Control: not assembled -> the FAILED chunk gets a new attempt.
    const open = await transcriptOf({ bursts, total: 60 * TAP_RATE, prepare: failing as never });
    expect(open.runner.retryFailed()).toBe(1);
    expect(open.stored().chunks.map((chunk) => chunk.status)).toEqual(['DONE', 'PENDING']);
    // Assembled -> it stays FAILED, nothing is re-queued, and the refusal is in the log.
    const sealed = await transcriptOf({ bursts, total: 60 * TAP_RATE, prepare: failing as never });
    const result = await assembleTranscript(optionsOf(sealed, null));
    expect(sealed.runner.retryFailed()).toBe(0);
    expect(sealed.stored().chunks.map((chunk) => chunk.status)).toEqual(['DONE', 'FAILED']);
    expect(sealed.stored().document?.docSha256).toBe(result.record.jsonSha256);
    expect(sealed.log.records().filter((record) => record.context['reason'] === 'TRANSCRIPT_ALREADY_FINALISED')).toHaveLength(1);
  });

  it('NEGATIVE CONTROL: the same session with a live tap and no failure is ASSEMBLED', async () => {
    const result = await assembleTranscript(optionsOf(await transcriptOf({ runner: { tapLost: () => false } }), null));
    expect([result.document.header.state, result.document.header.partial_reason]).toEqual(['ASSEMBLED', null]);
  });

  it('silence with a live tap: ASSEMBLED, zero segments, flags `no_speech` and `speaker labels unavailable`', async () => {
    const result = await assembleTranscript(optionsOf(await transcriptOf({ bursts: [], total: 10 * TAP_RATE }), null));
    expect([result.document.header.state, result.document.header.partial_reason, result.document.segments.length]).toEqual(['ASSEMBLED', null, 0]);
    expect(result.document.qa_flags).toEqual(expect.arrayContaining(['no_speech', 'speaker labels unavailable']));
  });
});
