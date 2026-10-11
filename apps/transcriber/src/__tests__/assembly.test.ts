// Assembly (row 78; transcript spec §A.4 "Checkpoint", §A.5, §D.1, §D.3): the real runner of row 77
// finishes a transcript over a synthetic tap, then `assembleTranscript` runs the diarization
// post-pass (a stand-in engine), writes the document and its renderings, and records them in the
// checkpoint file — each ONCE. Part of M6-TF-1 criterion 6 (speaker state present) and of M6-LB-1
// ("asserted in TF-1"): both speaker states are shown on a whole pipeline run here.
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assembleTranscript, type AssembleTranscriptOptions, type AssembledTranscript } from '../pipeline/assembly';
import { ChunkStatus } from '../pipeline/checkpoint';
import { TRANSCRIPT_CHECKPOINT_FILE, QaFlag, VAD_MAX_CHUNK_MS, VAD_OVERLAP_MS, VAD_TAIL_GUARD_MS, VAD_WINDOW_MAX_MS } from '../pipeline/constants';
import { TranscriptDocumentSchema, sha256HexOfText } from '../pipeline/document';
import { TranscriberError, TranscriberErrorCode } from '../types';
import { labelSegments } from '../pipeline/diarization';
import { MODEL_PROVENANCE, SIX_BURSTS, STUB_FACTS, alternatingVoices, createStubEmbedder, looseVoices, transcriptOf, voice, type FinishedTranscript, type StubEmbedder } from './diarization-support';
import { TAP_RATE, growTap, tonePcm, type Burst } from './pipeline-support';
import { errorRecords } from './support';
import { createMemoryChunkMirror } from '../pipeline/mirror';

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

// The items of the row-77 review that were carried to row 79 (decisions D90, D97;
// `delegation_progress/pair_77_navigator.md` N-4 and N-7), and the D-EV-1 rule of the sealing
// spec as far as the TRANSCRIBER holds it:
//
//   N-4     a speaker who does not pause no longer stops the incremental transcript: the maximum
//           chunk length cuts while the session records, at every step, in the real runner;
//   N-7     `failed_chunks` of the document counts CHUNKS: a chunk that failed and was then decoded
//           is not a failed chunk, although its FAILED row stays in the mirror;
//   D-EV-1  a chunk that ended FAILED has NO text in the document — no placeholder, no borrowed
//           neighbour — and the document says PARTIAL with the count.
//
// No engine, no model: the runner, the chunker, the mirror stand-in and the assembly are the real ones.
describe('carried review items: N-4 (unbroken speech), N-7 (failed chunks) and D-EV-1 (no text for a failed chunk)', () => {
  const SECOND = TAP_RATE;
  const MAX = (VAD_MAX_CHUNK_MS / 1000) * SECOND;
  const assemble = (transcript: FinishedTranscript): Promise<AssembledTranscript> =>
    assembleTranscript({ sessionScratchDir: transcript.dir, identity: transcript.identity, source: transcript.source, diarization: { enabled: true, engine: null }, model: MODEL_PROVENANCE, intervals: [], log: transcript.log });
  /** Three runs of speech that cannot be joined: three chunks. */
  const THREE: Burst[] = [
    { from: 1 * SECOND, to: 9 * SECOND },
    { from: 50 * SECOND, to: 58 * SECOND },
    { from: 100 * SECOND, to: 108 * SECOND },
  ];
  const THREE_TOTAL = 110 * SECOND;

  describe('N-4: an unbroken speech run while the session records', () => {
    const MINUTE = 60 * SECOND;
    /** One run of speech from second 1 to the end of seven minutes: longer than a capped VAD window. */
    const TOTAL = 7 * MINUTE;
    const RUN: Burst[] = [{ from: SECOND, to: TOTAL }];

    it('every step while recording plans and decodes chunks, the cursor moves, and no fixed-window fallback is needed', async () => {
      expect(TOTAL).toBeGreaterThan((VAD_WINDOW_MAX_MS / 1000) * SECOND);
      const all = tonePcm(TOTAL, RUN);
      const transcript = await transcriptOf({ bursts: RUN, total: MINUTE, finish: false });
      // The stand-in engine: one segment over the chunk it is given.
      transcript.adapter.answer = (chunk) => [{ id: 0, start: 0, end: chunk.durationMs / 1000, text: `ucapan pada ${chunk.offsetMs}` }];

      const cursors: number[] = [];
      for (let minute = 1; minute <= 7; minute += 1) {
        if (minute > 1) growTap(transcript.tapPath, all.subarray((minute - 1) * MINUTE, minute * MINUTE));
        const report = await transcript.runner.step({ final: false });
        // THE FINDING: eleven steps of `planned 0, decoded 0` with the cursor at 1 s. Now every step moves.
        expect(report.planned).toBeGreaterThan(0);
        expect(report.decoded).toBe(report.planned);
        expect(report.complete).toBe(false);
        cursors.push(transcript.stored().cursorSample);
      }
      expect(cursors.every((cursor, index) => index === 0 || cursor > (cursors[index - 1] ?? 0))).toBe(true);
      // THE BOUND: what is not yet in a chunk is less than one maximum plus the guard at the end.
      const lag = 7 * MINUTE - (cursors[cursors.length - 1] ?? 0);
      expect(lag).toBeLessThanOrEqual(MAX + (VAD_TAIL_GUARD_MS / 1000) * SECOND);

      const end = await transcript.runner.step({ final: true });
      expect([end.complete, end.transcriptState]).toEqual([true, 'READY']);
      expect(end.qaFlags).not.toContain(QaFlag.VAD_FALLBACK);

      const chunks = transcript.stored().chunks;
      // NO AUDIO OF THE RUN IS OUTSIDE A CHUNK: the chunks cover it from its first sample to its
      // last without a gap, each within the maximum, each seam shared by two chunks.
      expect(chunks[0]?.fromSample).toBeLessThanOrEqual(SECOND);
      expect(chunks[chunks.length - 1]?.toSample).toBeGreaterThanOrEqual(TOTAL);
      chunks.forEach((chunk, index) => {
        expect(chunk.toSample - chunk.fromSample).toBeLessThanOrEqual(MAX + 2 * 1024);
        const before = chunks[index - 1];
        if (before !== undefined) {
          expect(chunk.fromSample).toBeLessThan(before.toSample);
          expect(before.toSample - chunk.fromSample).toBeLessThanOrEqual((VAD_OVERLAP_MS / 1000) * SECOND + 2 * 1024);
        }
      });
      // A committed chunk was never decoded twice.
      expect(new Set(transcript.adapter.decodedOffsets).size).toBe(transcript.adapter.decodedOffsets.length);
      expect(transcript.stored().openRunUntilSample).toBeUndefined();
    }, 60_000);

    it('a pause in the speech is still where a chunk ends: two ordinary runs are planned as before (control)', async () => {
      const two: Burst[] = [
        { from: 1 * SECOND, to: 9 * SECOND },
        { from: 50 * SECOND, to: 58 * SECOND },
      ];
      const transcript = await transcriptOf({ bursts: two, total: 60 * SECOND });
      expect(transcript.stored().chunks.map((chunk) => [Math.round(chunk.fromSample / SECOND), Math.round(chunk.toSample / SECOND)])).toEqual([
        [1, 9],
        [50, 58],
      ]);
    });
  });

  describe('N-7: `failed_chunks` counts chunks, not attempts', () => {
    it('a chunk that failed and was then decoded is NOT a failed chunk: the document is ASSEMBLED with 0, while its FAILED row stays in the mirror', async () => {
      const mirror = createMemoryChunkMirror();
      const transcript = await transcriptOf({ bursts: THREE, total: THREE_TOTAL, finish: false, runner: { mirror } });
      // The middle chunk fails every attempt of the first run (1 + STT_CHUNK_RETRIES).
      const original = transcript.adapter.transcribe.bind(transcript.adapter);
      let failing = true;
      transcript.adapter.transcribe = async (chunk, options) => {
        if (failing && chunk.offsetMs > 40_000 && chunk.offsetMs < 60_000) throw new Error('the stand-in engine fails this chunk');
        return original(chunk, options);
      };
      const first = await transcript.runner.step({ final: true });
      expect([first.complete, first.transcriptState, first.partialReason, first.failed]).toEqual([true, 'PARTIAL', 'CHUNKS_FAILED', 1]);

      failing = false;
      expect(transcript.runner.retryFailed()).toBe(1);
      const second = await transcript.runner.step({ final: true });
      expect([second.complete, second.transcriptState, second.decoded]).toEqual([true, 'READY', 1]);

      const assembled = await assemble(transcript);
      expect(assembled.document.header).toMatchObject({ state: 'ASSEMBLED', partial_reason: null, chunks: 3, failed_chunks: 0 });
      expect(assembled.record.failedChunks).toBe(0);
      expect(assembled.document.segments).toHaveLength(3);

      // THE MIRROR HOLDS ATTEMPTS: four rows for three chunks, one of them FAILED, with the SAME range as the DONE row after it.
      const rows = mirror.rows();
      expect(rows.map((row) => row.status)).toEqual(['DONE', 'FAILED', 'DONE', 'DONE']);
      const failedRow = rows[1];
      const rerun = rows.find((row) => row.status === 'DONE' && row.audioFromMs === failedRow?.audioFromMs && row.audioToMs === failedRow?.audioToMs);
      expect(rerun?.seq).toBeGreaterThan(failedRow?.seq ?? Infinity);
      // The naive count of the package spec (`status = 'FAILED'`) would say 1: it over-states (negative control).
      expect(rows.filter((row) => row.status === 'FAILED')).toHaveLength(1);
    });

    it('a chunk that failed, was retried and failed again is ONE failed chunk, with two FAILED rows', async () => {
      const mirror = createMemoryChunkMirror();
      const transcript = await transcriptOf({ bursts: THREE, total: THREE_TOTAL, finish: false, runner: { mirror } });
      const original = transcript.adapter.transcribe.bind(transcript.adapter);
      transcript.adapter.transcribe = async (chunk, options) => {
        if (chunk.offsetMs > 40_000 && chunk.offsetMs < 60_000) throw new Error('the stand-in engine fails this chunk');
        return original(chunk, options);
      };
      await transcript.runner.step({ final: true });
      expect(transcript.runner.retryFailed()).toBe(1);
      await transcript.runner.step({ final: true });
      const assembled = await assemble(transcript);
      expect(assembled.document.header).toMatchObject({ state: 'PARTIAL', partial_reason: 'CHUNKS_FAILED', chunks: 3, failed_chunks: 1 });
      expect(mirror.rows().filter((row) => row.status === 'FAILED')).toHaveLength(2);
    });
  });

  describe('D-EV-1: a chunk that failed has NO text in the document', () => {
    it('PARTIAL with the count; the segments are exactly those of the committed chunks; nothing stands where the failed chunk was', async () => {
      const transcript = await transcriptOf({
        bursts: THREE,
        total: THREE_TOTAL,
        finish: false,
        prepare: (adapter) => {
          const original = adapter.transcribe.bind(adapter);
          adapter.transcribe = async (chunk, options) => {
            if (chunk.offsetMs > 40_000 && chunk.offsetMs < 60_000) throw new Error('the stand-in engine fails this chunk');
            return original(chunk, options);
          };
        },
      });
      const report = await transcript.runner.step({ final: true });
      expect([report.transcriptState, report.partialReason]).toEqual(['PARTIAL', 'CHUNKS_FAILED']);
      const assembled = await assemble(transcript);
      const stored = transcript.stored();
      const failed = stored.chunks.filter((chunk) => chunk.status === 'FAILED');
      expect(failed).toHaveLength(1);
      const gap = failed[0];
      expect(gap?.segments).toBeNull();

      const { document } = assembled;
      expect(document.header).toMatchObject({ state: 'PARTIAL', partial_reason: 'CHUNKS_FAILED', chunks: 3, failed_chunks: 1 });
      // Two committed chunks, one segment each: two segments, and not three.
      expect(document.segments).toHaveLength(2);
      // NO SEGMENT LIES IN THE AUDIO OF THE FAILED CHUNK.
      for (const segment of document.segments) expect(segment.end_ms <= (gap?.startMs ?? 0) || segment.start_ms >= (gap?.endMs ?? 0)).toBe(true);
      // EVERY SEGMENT IS A COMMITTED ONE, text for text: nothing was written by the assembly itself.
      const committed = stored.chunks.flatMap((chunk) => (chunk.status === 'DONE' ? (chunk.segments ?? []) : [])).map((segment) => `${segment.startMs}|${segment.endMs}|${segment.text}`);
      expect(document.segments.map((segment) => `${segment.start_ms}|${segment.end_ms}|${segment.text}`)).toEqual(committed);
      // The files say the same: two cues, and no text that is not a committed segment's.
      const srt = readFileSync(assembled.files.srt, 'utf8');
      expect(srt.split('\n\n').filter((cue) => cue.trim() !== '')).toHaveLength(2);
      const texts = new Set(document.segments.map((segment) => segment.text));
      const json = JSON.parse(readFileSync(assembled.files.json, 'utf8')) as { segments: { text: string }[] };
      expect(json.segments.every((segment) => texts.has(segment.text))).toBe(true);
      expect(json.segments).toHaveLength(2);
    });
  });
});
