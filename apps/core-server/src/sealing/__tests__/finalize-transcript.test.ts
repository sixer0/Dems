// The sealing step FINALIZE_TRANSCRIPT, tested directly (blueprint row 79 / M6-W4; ev §E.1, §E.5,
// §B.7, §B.7a; tx §D.3; D-EV-1; checks M6-TF-1 criteria 5 / 6 as far as they are this row's, and
// M6-KR-1 at the FINALIZE step). No database here: the journal is in memory, the chunk rows are
// the transcriber's own table stand-in (it refuses what the table's CHECKs refuse). The database
// half is `finalize-transcript.db.test.ts`.
//
// The transcript of every test is made by the REAL `@dems/transcriber` (`support.ts`); only its
// three engines are stand-ins. Nothing here starts a process or a model.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXAMPLE_SOURCE_ROWS, buildUnsignedManifest, exampleManifestInput } from '@dems/shared/evidence-package';
import { EvidenceItemSchema } from '@dems/shared/api';
import { TranscriberError, createMemoryChunkMirror, renderTranscript, sealRecordOf, type TranscriptDocument, type TranscriptSealRecord } from '@dems/transcriber';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { failedChunkCount, summariseChunkAttempts } from '../../modules/transcript-chunks';
import type { SealedTranscript } from '../../modules/transcripts';
import {
  FINALIZE_TRANSCRIPT_STEP,
  FinalizeTranscriptError,
  SealedTranscriptDocumentSchema,
  commitSealedTranscript,
  createTranscriptFileReader,
  evidenceTranscriptSummary,
  finalizeTranscript,
  readSealedTranscriptDocument,
  systemStepTimer,
  type AssembledTranscriptRecord,
  type AssembledTranscriptSource,
  type FinalizeTranscriptPorts,
  type FinalizeTranscriptResult,
  type FinalizedTranscript,
  type SttConfigSnapshot,
} from '../index';
import { MODEL, hex, memoryErrorLog, memoryJournal, noCloseOut, snapshotOf, transcribedSession, type SessionOptions, type TranscribedSession } from './support';

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');
let counter = 0;
const nextSession = (): string => `SES-20261009-${String(7900 + (counter += 1)).padStart(4, '0')}`;

interface Rig {
  readonly session: TranscribedSession;
  readonly mirror: ReturnType<typeof createMemoryChunkMirror>;
  readonly journal: ReturnType<typeof memoryJournal>;
  readonly log: ReturnType<typeof memoryErrorLog>;
  ports(overrides?: Partial<FinalizeTranscriptPorts>): FinalizeTranscriptPorts;
  run(snapshot?: SttConfigSnapshot, attempt?: number, overrides?: Partial<FinalizeTranscriptPorts>): Promise<FinalizeTranscriptResult>;
}

function rig(options: Omit<SessionOptions, 'mirror'> = {}): Rig {
  const mirror = createMemoryChunkMirror();
  const session = transcribedSession(nextSession(), { ...options, mirror });
  const journal = memoryJournal();
  const log = memoryErrorLog();
  let tick = 1_791_529_000_000;
  const ports = (overrides: Partial<FinalizeTranscriptPorts> = {}): FinalizeTranscriptPorts => ({ transcript: session.seam, chunkRows: mirror, files: createTranscriptFileReader(), journal, log, now: () => (tick += 1_000), timer: systemStepTimer, ...overrides });
  return { session, mirror, journal, log, ports, run: (snapshot = snapshotOf({ backend: options.backend ?? 'cpu-local' }), attempt = 1, overrides = {}) => finalizeTranscript({ sessionId: session.sessionId, sttSnapshot: snapshot, attempt }, ports(overrides)) };
}

function done(result: FinalizeTranscriptResult): Extract<FinalizeTranscriptResult, { status: 'DONE' }> {
  if (result.status !== 'DONE') throw new Error(`the step answered ${result.status}`);
  return result;
}

async function refusal(run: Promise<unknown>): Promise<FinalizeTranscriptError> {
  let caught: unknown;
  try {
    await run;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(FinalizeTranscriptError);
  return caught as FinalizeTranscriptError;
}

/** The engine of a session fails the chunk that starts between 40 s and 60 s (the second of three). */
const failMiddle =
  (make: () => Error) =>
  (offsetMs: number): Error | null =>
    offsetMs > 40_000 && offsetMs < 60_000 ? make() : null;

/** AGREED BY CONTRACT WITH ROW 83: the block goes through its builder and its cross-field rules as it is. */
function manifestWith(transcript: FinalizedTranscript): ReturnType<typeof buildUnsignedManifest> {
  return buildUnsignedManifest({ ...exampleManifestInput(), transcript: transcript.manifest }, EXAMPLE_SOURCE_ROWS);
}

describe('the contract types are the ones of their owners', () => {
  it('the record of the seam is the transcriber\'s `TranscriptSealRecord`, member for member, in both directions', () => {
    expectTypeOf<TranscriptSealRecord>().toMatchTypeOf<AssembledTranscriptRecord>();
    expectTypeOf<AssembledTranscriptRecord['model']>().toEqualTypeOf<TranscriptSealRecord['model']>();
    expectTypeOf<AssembledTranscriptRecord['state']>().toEqualTypeOf<TranscriptSealRecord['state']>();
    expectTypeOf<AssembledTranscriptRecord['partialReason']>().toEqualTypeOf<TranscriptSealRecord['partialReason']>();
    expectTypeOf<AssembledTranscriptRecord['labelsStatus']>().toEqualTypeOf<TranscriptSealRecord['labelsStatus']>();
    expectTypeOf<keyof AssembledTranscriptRecord>().toEqualTypeOf<keyof TranscriptSealRecord>();
  });
});

describe('READY: every chunk committed, speakers labelled', () => {
  it('DONE with the manifest block, the transcript row, the item columns and the counters — all from the document the transcriber wrote', async () => {
    const r = rig();
    await r.session.finish();
    const result = done(await r.run());
    const { transcript } = result;
    const fileHash = sha256(r.session.files.json);

    expect(result.resumed).toBe(false);
    expect(result.files).toEqual(r.session.files);
    expect(transcript.manifest).toEqual({
      file: 'transcript/transcript.json',
      docVersion: 'dems.transcript/1',
      sha256: fileHash,
      srtSha256: sha256(r.session.files.srt),
      vttSha256: sha256(r.session.files.vtt),
      model: { name: MODEL.name, version: MODEL.version, quantisation: MODEL.quantisation, modelSha256: MODEL.sha256 },
      diarization: { numSpeakers: 2, status: 'LABELLED', confidence: 1 },
      speakerState: 'LABELLED',
      state: 'ASSEMBLED',
      failedChunks: 0,
      revisionHead: 0,
      disabledReason: null,
      backendUnreachable: false,
      configSnapshot: snapshotOf(),
    });
    expect(transcript.itemColumns).toEqual({ manifestVersion: 2, transcriptSha256: fileHash, labelsStatus: 'LABELLED' });
    expect(transcript.transcriptRow).toMatchObject({ jsonSha256: fileHash, labelsStatus: 'LABELLED', model: { params: { backend: 'cpu-local', modelId: 'ggml-large-v3-turbo', language: 'id' } }, diarization: { reason: null } });
    expect([transcript.partialReason, transcript.speakerReason, transcript.failedChunksByRows]).toEqual([null, null, 0]);
    expect(transcript.counters).toEqual({ chunks: 3, failedChunks: 0, segments: 6 });

    // The journal row: DONE, 100, the committed checkpoint.
    expect(r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)).toMatchObject({ status: 'DONE', progress: 100, attempt: 1, errorCode: null, checkpoint: { committed: true, manifest: { sha256: fileHash } } });
    expect(r.log.entries).toEqual([]);

    // The summary of the evidence slice, and the manifest of row 83 with this block in it.
    const summary = evidenceTranscriptSummary(transcript.manifest, 0);
    expect(summary).toEqual({ state: 'READY', sha256: fileHash, machineTranscriptHash: fileHash, labelsStatus: 'LABELLED', revision: 0, failedChunks: 0, backendUnreachable: false });
    expect(EvidenceItemSchema.shape.transcript.safeParse(summary).success).toBe(true);
    expect(manifestWith(transcript).transcript).toEqual(transcript.manifest);
  });

  it('M6-TF-1 criterion 6, the other half: no speaker engine -> UNAVAILABLE with its reason; the item column and the summary say so', async () => {
    const r = rig({ diarizer: null });
    await r.session.finish();
    const { transcript } = done(await r.run());
    expect(transcript.manifest).toMatchObject({ state: 'ASSEMBLED', speakerState: 'UNAVAILABLE', diarization: { numSpeakers: 0, status: 'UNAVAILABLE', confidence: null } });
    expect(transcript.speakerReason).toBe('ENGINE_NOT_CONFIGURED');
    expect(transcript.itemColumns.labelsStatus).toBe('UNAVAILABLE');
    expect(transcript.transcriptRow).toMatchObject({ labelsStatus: 'UNAVAILABLE', diarization: { status: 'UNAVAILABLE', reason: 'ENGINE_NOT_CONFIGURED' } });
    expect(evidenceTranscriptSummary(transcript.manifest, 0)).toMatchObject({ state: 'READY', labelsStatus: 'UNAVAILABLE' });
    expect(JSON.parse(readFileSync(r.session.files.json, 'utf8')).qa_flags).toContain('speaker labels unavailable');
    expect(manifestWith(transcript).transcript.speakerState).toBe('UNAVAILABLE');
  });
});

describe('D-EV-1: the hard-failure path seals PARTIAL, and no text is made up', () => {
  it('a chunk that failed all its attempts: DONE (not FAILED), state PARTIAL, failedChunks 1, and the document holds NO text of that chunk', async () => {
    const r = rig({ fail: failMiddle(() => new Error('the engine ended with an error')) });
    await r.session.finish();
    const result = done(await r.run());
    const { transcript } = result;
    expect(transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 1, backendUnreachable: false, disabledReason: null });
    expect([transcript.partialReason, transcript.failedChunksByRows]).toEqual(['CHUNKS_FAILED', 1]);
    expect(transcript.counters).toEqual({ chunks: 3, failedChunks: 1, segments: 4 });
    expect(r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)).toMatchObject({ status: 'DONE', progress: 100, errorCode: null });

    // THE ASSERTION OF THE ROW: the failed chunk has no text in the sealed document.
    const failed = r.session.checkpoint().chunks.filter((chunk) => chunk.status === 'FAILED');
    expect(failed).toHaveLength(1);
    const gap = failed[0];
    const document = readSealedTranscriptDocument(readFileSync(r.session.files.json));
    expect(document?.segments).toHaveLength(4);
    for (const segment of document?.segments ?? []) expect(segment.end_ms <= (gap?.startMs ?? 0) || segment.start_ms >= (gap?.endMs ?? 0)).toBe(true);
    expect(document?.segments.map((segment) => segment.text)).toEqual(['Keterangan saksi 1-0.', 'Keterangan saksi 1-1.', 'Keterangan saksi 100-0.', 'Keterangan saksi 100-1.']);

    expect(evidenceTranscriptSummary(transcript.manifest, 0)).toMatchObject({ state: 'PARTIAL', failedChunks: 1, backendUnreachable: false });
    expect(manifestWith(transcript).transcript).toMatchObject({ state: 'PARTIAL', failedChunks: 1 });
  });

  it('the backend could not be reached for any chunk: PARTIAL, three failed chunks, backendUnreachable, a document with no segment at all', async () => {
    const r = rig({ backend: 'omlx-server', fail: () => new TranscriberError('UNREACHABLE', 'the transcriber server could not be reached', { reason: 'UNREACHABLE' }) });
    await r.session.finish();
    const { transcript } = done(await r.run());
    expect(transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 3, backendUnreachable: true, sha256: sha256(r.session.files.json) });
    expect(transcript.counters).toEqual({ chunks: 3, failedChunks: 3, segments: 0 });
    expect(readSealedTranscriptDocument(readFileSync(r.session.files.json))?.segments).toEqual([]);
    expect(evidenceTranscriptSummary(transcript.manifest, 0)).toMatchObject({ state: 'PARTIAL', failedChunks: 3, backendUnreachable: true });
    expect(manifestWith(transcript).transcript.backendUnreachable).toBe(true);
  });

  it('`backendUnreachable` is about reaching the backend: an engine failure is not one, and the time bound of the local engine is not one', async () => {
    const local = rig({ fail: failMiddle(() => new TranscriberError('TIMEOUT', 'the cpu-local engine was stopped at its time bound', { reason: 'ENGINE_TIMEOUT' })) });
    await local.session.finish();
    expect(done(await local.run()).transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 1, backendUnreachable: false });
    const server = rig({ backend: 'omlx-server', fail: failMiddle(() => new TranscriberError('TIMEOUT', 'the transcriber server did not answer in time', { reason: 'REQUEST_TIMEOUT' })) });
    await server.session.finish();
    expect(done(await server.run()).transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 1, backendUnreachable: true });
  });

  it('the audio never reached the transcriber: PARTIAL with the reason TRANSCRIPT_AUDIO_UNAVAILABLE, no failed chunk', async () => {
    const r = rig({ tapLost: true });
    await r.session.finish();
    const { transcript } = done(await r.run());
    expect(transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 0, backendUnreachable: false });
    expect(transcript.partialReason).toBe('TRANSCRIPT_AUDIO_UNAVAILABLE');
    expect(transcript.itemColumns.transcriptSha256).toBe(sha256(r.session.files.json));
    expect(evidenceTranscriptSummary(transcript.manifest, 0)).toMatchObject({ state: 'PARTIAL', failedChunks: 0 });
    expect(manifestWith(transcript).transcript.state).toBe('PARTIAL');
  });
});

describe('N-7: failed chunks are chunks, not attempts', () => {
  it('a chunk that failed and was decoded on a retry: ASSEMBLED with 0, although one FAILED row is in the table', async () => {
    let failing = true;
    const r = rig({ fail: (offsetMs) => (failing && offsetMs > 40_000 && offsetMs < 60_000 ? new Error('the engine ended with an error') : null) });
    // First run: the middle chunk fails. Retry: it is decoded.
    await r.session.runner.step({ final: true });
    failing = false;
    expect(r.session.runner.retryFailed()).toBe(1);
    await r.session.finish();

    const rows = r.mirror.rows();
    expect(rows.map((row) => row.status)).toEqual(['DONE', 'FAILED', 'DONE', 'DONE']);
    // The rule of this row against the plain count of the spec text (negative control: 1, which is wrong).
    expect(rows.filter((row) => row.status === 'FAILED')).toHaveLength(1);
    expect(failedChunkCount(rows)).toBe(0);
    expect(summariseChunkAttempts(rows)).toMatchObject({ total: 3, done: 3, failed: 0, unfinished: 0, failedRows: 1 });

    const { transcript } = done(await r.run());
    expect(transcript.manifest).toMatchObject({ state: 'ASSEMBLED', failedChunks: 0 });
    expect([transcript.failedChunksByRows, transcript.counters.failedChunks, transcript.counters.segments]).toEqual([0, 0, 6]);
    expect(r.log.entries).toEqual([]);
  });

  it('the rule itself: newest attempt per range; a later FAILED after a DONE cannot happen, a FAILED after a FAILED is one chunk', () => {
    const row = (seq: number, from: number, status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'): { seq: number; audioFromMs: number; audioToMs: number; status: typeof status; segments: unknown[] | null } => ({ seq, audioFromMs: from, audioToMs: from + 8_000, status, segments: status === 'DONE' ? [] : null });
    expect(summariseChunkAttempts([])).toMatchObject({ total: 0, done: 0, failed: 0, unfinished: 0, failedRows: 0 });
    expect(summariseChunkAttempts([row(1, 0, 'DONE'), row(2, 50_000, 'FAILED'), row(3, 100_000, 'DONE'), row(4, 50_000, 'FAILED')])).toMatchObject({ total: 3, done: 2, failed: 1, failedRows: 2 });
    expect(summariseChunkAttempts([row(4, 50_000, 'DONE'), row(2, 50_000, 'FAILED')])).toMatchObject({ total: 1, done: 1, failed: 0, failedRows: 1 });
    expect(summariseChunkAttempts([row(1, 0, 'DONE'), row(2, 50_000, 'RUNNING'), row(3, 100_000, 'PENDING')])).toMatchObject({ total: 3, done: 1, failed: 0, unfinished: 2 });
    // The same start with another end is another chunk (two pieces of one split run never coincide).
    expect(summariseChunkAttempts([row(1, 0, 'FAILED'), { ...row(2, 0, 'DONE'), audioToMs: 9_000 }])).toMatchObject({ total: 2, failed: 1 });
    expect(summariseChunkAttempts([row(3, 100_000, 'DONE'), row(1, 0, 'DONE')]).chunks.map((chunk) => chunk.audioFromMs)).toEqual([0, 100_000]);
  });

  it('rows that count another number than the document: the document stands, and the difference is in the persistent log', async () => {
    const r = rig();
    await r.session.finish();
    // A row of an earlier plan that ended FAILED and was never run again (a lost checkpoint leaves such rows).
    await r.mirror.insertMissing([{ sessionId: r.session.sessionId, seq: 99, audioFromMs: 200_000, audioToMs: 208_000, status: 'FAILED', segments: null, embeddingRef: null, modelId: null, computedAt: null }]);
    const { transcript } = done(await r.run());
    expect([transcript.manifest.state, transcript.manifest.failedChunks, transcript.failedChunksByRows]).toEqual(['ASSEMBLED', 0, 1]);
    expect(r.log.entries).toMatchObject([{ level: 'warn', source: 'sealing.finalizeTranscript', context: { reason: 'FAILED_CHUNK_COUNT_DIFFERS', byDocument: 0, byRows: 1, correlationId: r.session.sessionId } }]);
  });
});

describe('R-8: STT disabled by the session\'s snapshot', () => {
  it('DONE at once with DISABLED: the transcriber is not asked anything, nothing is waited for, the manifest block is the declared absence', async () => {
    const r = rig();
    // The transcript is NOT finished and never will be: a disabled session does no transcriber work.
    const snapshot = snapshotOf({ enabled: false });
    const result = done(await r.run(snapshot));
    expect([r.session.seam.assembleCalls, r.session.seam.locateCalls]).toEqual([0, 0]);
    expect(result.files).toBeNull();
    expect(result.transcript.manifest).toEqual({
      file: null,
      docVersion: null,
      sha256: null,
      srtSha256: null,
      vttSha256: null,
      model: { name: null, version: null, quantisation: null, modelSha256: null },
      diarization: { numSpeakers: null, status: null, confidence: null },
      speakerState: null,
      state: 'DISABLED',
      failedChunks: null,
      revisionHead: null,
      disabledReason: 'DISABLED_BY_CONFIGURATION',
      backendUnreachable: false,
      configSnapshot: snapshot,
    });
    expect(result.transcript.transcriptRow).toBeNull();
    expect(result.transcript.itemColumns).toEqual({ manifestVersion: 2, transcriptSha256: null, labelsStatus: null });
    const summary = evidenceTranscriptSummary(result.transcript.manifest, 0);
    expect(summary).toEqual({ state: 'DISABLED', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0, backendUnreachable: false });
    expect(EvidenceItemSchema.shape.transcript.safeParse(summary).success).toBe(true);
    expect(manifestWith(result.transcript).transcript.state).toBe('DISABLED');
    // Again: the same answer, still without the transcriber.
    expect(done(await r.run(snapshot, 2)).transcript).toEqual(result.transcript);
    expect(r.session.seam.assembleCalls).toBe(0);
  });
});

describe('D223: sealing waits for the transcript', () => {
  it('WAITING while a chunk is still to decode, with the chunk counters and a progress below 100; DONE once the transcript is finished', async () => {
    let allowed = 1;
    const r = rig({ shouldPause: () => (allowed -= 1) < 0 });
    const key = `${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`;
    // One chunk decoded, two held back.
    expect(await r.session.runner.step({ final: true })).toMatchObject({ decoded: 1, remaining: 2, paused: true, complete: false });

    const waiting = await r.run();
    expect(waiting).toEqual({ status: 'WAITING', progress: 33, counters: { chunksTotal: 3, chunksDone: 1, chunksFailed: 0 }, remainingWaitMs: expect.any(Number) });
    expect(r.journal.rows.get(key)).toMatchObject({ status: 'RUNNING', progress: 33, errorCode: null, checkpoint: { committed: false, chunksTotal: 3, chunksDone: 1, chunksFailed: 0 } });
    // Asked again without progress: still waiting, nothing committed, no transcript file exists.
    expect((await r.run()).status).toBe('WAITING');
    expect(() => readFileSync(r.session.files.json)).toThrow();

    allowed = 10;
    await r.session.finish();
    const finished = done(await r.run());
    expect([finished.resumed, finished.transcript.manifest.state]).toEqual([false, 'ASSEMBLED']);
    expect(r.journal.rows.get(key)).toMatchObject({ status: 'DONE', progress: 100 });
    expect(r.log.entries).toEqual([]);
  });

  it('a session the transcriber knows nothing of (no checkpoint) is a failure of the seam, not a wait: TRANSCRIBER_FAILED, logged, step FAILED', async () => {
    const r = rig();
    const error = await refusal(r.run());
    expect(error.code).toBe('TRANSCRIBER_FAILED');
    expect(r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)).toMatchObject({ status: 'FAILED', errorCode: 'TRANSCRIBER_FAILED', checkpoint: { committed: false } });
    expect(r.log.entries).toMatchObject([{ level: 'error', code: 'TRANSCRIBER_FAILED', errorName: 'TranscriberError' }]);
  });
});

describe('tx §D.3 / M6-KR-1 at the FINALIZE step: idempotent, and a stop at any point changes no hash', () => {
  it('called twice: the second call computes nothing — the transcriber is not asked to assemble — and answers the same, byte for byte', async () => {
    const r = rig({ fail: failMiddle(() => new Error('the engine ended with an error')) });
    await r.session.finish();
    const first = done(await r.run());
    expect(r.session.seam.assembleCalls).toBe(1);
    const checkpointBefore = JSON.stringify(r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)?.checkpoint);
    const decodedBefore = r.session.decoded.length;

    const second = done(await r.run());
    expect(second.resumed).toBe(true);
    expect(second.transcript).toEqual(first.transcript);
    expect(second.files).toEqual(first.files);
    expect(r.session.seam.assembleCalls).toBe(1);
    expect(r.session.decoded.length).toBe(decodedBefore); // no chunk was decoded again
    expect(JSON.stringify(r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)?.checkpoint)).toBe(checkpointBefore);
  });

  it('stopped AFTER the transcriber assembled and BEFORE the journal said DONE: the resumed step reaches the same transcript hash, and no STT ran again', async () => {
    const r = rig();
    await r.session.finish();
    r.journal.failNextWrite = (write) => write.status === 'DONE';
    const stopped = await refusal(r.run());
    expect(stopped.code).toBe('STORE_FAILED');
    const hashAtStop = sha256(r.session.files.json);
    expect(r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)).toMatchObject({ status: 'RUNNING', checkpoint: { committed: false } });
    const decodedBefore = r.session.decoded.length;

    // A restarted Core: a new seam on the same scratch directory, attempt 2.
    const seam = r.session.freshSeam();
    const resumed = done(await r.run(snapshotOf(), 2, { transcript: seam }));
    expect(resumed.resumed).toBe(false); // nothing had been committed here; the transcriber's own record was
    expect(resumed.transcript.manifest.sha256).toBe(hashAtStop);
    expect(sha256(r.session.files.json)).toBe(hashAtStop);
    expect(r.session.decoded.length).toBe(decodedBefore);
    expect(r.session.checkpoint().document).toMatchObject({ assembled: true, docSha256: hashAtStop });
    expect(r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)).toMatchObject({ status: 'DONE', attempt: 2 });
  });

  it('stopped BEFORE the transcriber was asked (the journal says RUNNING): the resumed step assembles once and commits', async () => {
    const r = rig();
    await r.session.finish();
    await r.journal.write({ sessionId: r.session.sessionId, step: FINALIZE_TRANSCRIPT_STEP, status: 'RUNNING', progress: 0, etaMs: null, attempt: 1, checkpoint: null, errorCode: null, at: 1 });
    const resumed = done(await r.run(snapshotOf(), 2));
    expect([resumed.resumed, r.session.seam.assembleCalls]).toEqual([false, 1]);
    // `started_at` of the row is the first write's.
    expect(r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)).toMatchObject({ status: 'DONE', startedAt: 1 });
  });

  it('a resumed attempt of a committed step writes the journal again with ITS attempt number and the SAME checkpoint', async () => {
    const r = rig();
    await r.session.finish();
    const first = done(await r.run());
    const resumed = done(await r.run(snapshotOf(), 2));
    expect(resumed.transcript).toEqual(first.transcript);
    const writes = r.journal.writes.filter((write) => write.status === 'DONE');
    expect(writes.map((write) => write.attempt)).toEqual([1, 2]);
    expect(JSON.stringify(writes[1]?.checkpoint)).toBe(JSON.stringify(writes[0]?.checkpoint));
  });
});

describe('NEGATIVE CONTROLS: what is not the committed transcript is refused', () => {
  it('a COMMITTED transcript whose file was changed afterwards (one character): TRANSCRIPT_HASH_MISMATCH, step FAILED, the committed checkpoint kept, logged; restored -> DONE with the same hash', async () => {
    const r = rig();
    await r.session.finish();
    const committed = done(await r.run());
    const key = `${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`;
    const checkpoint = JSON.stringify(r.journal.rows.get(key)?.checkpoint);
    const original = readFileSync(r.session.files.json);
    writeFileSync(r.session.files.json, original.toString('utf8').replace('Keterangan saksi 1-0.', 'Keterangan saksi 1-9.'));

    const error = await refusal(r.run(snapshotOf(), 2));
    expect([error.code, error.detail]).toEqual(['TRANSCRIPT_HASH_MISMATCH', { file: 'json', against: 'COMMITTED' }]);
    expect(r.journal.rows.get(key)).toMatchObject({ status: 'FAILED', errorCode: 'TRANSCRIPT_HASH_MISMATCH', attempt: 2 });
    expect(JSON.stringify(r.journal.rows.get(key)?.checkpoint)).toBe(checkpoint);
    expect(r.session.seam.assembleCalls).toBe(1); // nothing was assembled in its place
    expect(r.log.entries).toMatchObject([{ level: 'error', source: 'sealing.finalizeTranscript', code: 'TRANSCRIPT_HASH_MISMATCH', context: { correlationId: r.session.sessionId, file: 'json', against: 'COMMITTED' } }]);

    // Also a changed rendering is refused, by its own hash.
    writeFileSync(r.session.files.json, original);
    const srt = readFileSync(r.session.files.srt);
    writeFileSync(r.session.files.srt, `${srt.toString('utf8')}\n`);
    expect((await refusal(r.run(snapshotOf(), 3))).detail).toEqual({ file: 'srt', against: 'COMMITTED' });

    writeFileSync(r.session.files.srt, srt);
    const again = done(await r.run(snapshotOf(), 4));
    expect(again.resumed).toBe(true);
    expect(again.transcript).toEqual(committed.transcript);
    expect(r.journal.rows.get(key)).toMatchObject({ status: 'DONE', errorCode: null, attempt: 4 });
  });

  it('a transcript file that is gone after the commit: refused, not rebuilt behind the seal\'s back', async () => {
    const r = rig();
    await r.session.finish();
    done(await r.run());
    const missing = { ...r.session.seam, locate: () => ({ ...r.session.files, vtt: join(r.session.dir, 'absent.vtt') }) };
    const error = await refusal(r.run(snapshotOf(), 2, { transcript: missing as AssembledTranscriptSource }));
    expect([error.code, error.detail]).toEqual(['TRANSCRIPT_FILE_UNREADABLE', { file: 'vtt' }]);
  });

  it('BEFORE the commit: a file that does not have the hash the transcriber recorded is refused, and nothing is committed', async () => {
    const r = rig();
    await r.session.finish();
    const tampering: AssembledTranscriptSource = {
      closeOut: noCloseOut,
      locate: () => r.session.files,
      assemble: async () => {
        const answer = await r.session.seam.assemble(r.session.sessionId);
        writeFileSync(r.session.files.json, readFileSync(r.session.files.json, 'utf8').replace('saksi', 'SAKSI'));
        return answer;
      },
    };
    const error = await refusal(r.run(snapshotOf(), 1, { transcript: tampering }));
    expect([error.code, error.detail]).toEqual(['TRANSCRIPT_HASH_MISMATCH', { file: 'json', against: 'RECORD' }]);
    expect(r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)).toMatchObject({ status: 'FAILED', checkpoint: { committed: false }, errorCode: 'TRANSCRIPT_HASH_MISMATCH' });
  });

  /** A seam that hands over `document` with a record and files that are consistent with it (hashes and all). */
  function forged(document: TranscriptDocument, failedChunkCodes: readonly string[]): AssembledTranscriptSource {
    const dir = mkdtempSync(join(tmpdir(), 'dems-row79-forged-'));
    const rendered = renderTranscript(document);
    const files = { json: join(dir, 'transcript.json'), srt: join(dir, 'transcript.srt'), vtt: join(dir, 'transcript.vtt') };
    writeFileSync(files.json, rendered.json);
    writeFileSync(files.srt, rendered.srt);
    writeFileSync(files.vtt, rendered.vtt);
    return { closeOut: noCloseOut, locate: () => files, assemble: async () => ({ kind: 'ASSEMBLED', record: sealRecordOf(document, rendered), files, failedChunkCodes }) };
  }

  it('FABRICATED TEXT: a placeholder where the failed chunk was — a valid document with consistent hashes — is refused: no committed chunk row holds it', async () => {
    const r = rig({ fail: failMiddle(() => new Error('the engine ended with an error')) });
    await r.session.finish();
    await r.session.seam.assemble(r.session.sessionId);
    const honest = JSON.parse(readFileSync(r.session.files.json, 'utf8')) as TranscriptDocument;
    const gap = r.session.checkpoint().chunks.find((chunk) => chunk.status === 'FAILED');
    const placeholder = { index: 2, start_ms: (gap?.startMs ?? 0) + 100, end_ms: (gap?.endMs ?? 0) - 100, text: '[tidak terdengar]', speaker: null };
    const segments = [...honest.segments.slice(0, 2), placeholder, ...honest.segments.slice(2)].map((segment, index) => ({ ...segment, index }));
    const fabricated: TranscriptDocument = { ...honest, segments };

    const error = await refusal(r.run(snapshotOf(), 1, { transcript: forged(fabricated, ['UNEXPECTED']) }));
    expect([error.code, error.detail]).toEqual(['TRANSCRIPT_TEXT_NOT_COMMITTED', { segments: 1, firstSegment: 2, doneRows: 2 }]);
    expect(r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)).toMatchObject({ status: 'FAILED', checkpoint: { committed: false }, errorCode: 'TRANSCRIPT_TEXT_NOT_COMMITTED' });
    // The log names the code and the count, never the text.
    expect(JSON.stringify(r.log.entries)).not.toContain('tidak terdengar');

    // CONTROL: the honest document through the very same forged seam is accepted.
    const accepted = done(await r.run(snapshotOf(), 2, { transcript: forged(honest, ['UNEXPECTED']) }));
    expect(accepted.transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 1, sha256: sha256(r.session.files.json) });
  });

  it('a committed segment whose text was changed, a segment moved in time, a neighbour repeated into the gap, and "…" are each refused the same way', async () => {
    const r = rig({ fail: failMiddle(() => new Error('the engine ended with an error')) });
    await r.session.finish();
    await r.session.seam.assemble(r.session.sessionId);
    const honest = JSON.parse(readFileSync(r.session.files.json, 'utf8')) as TranscriptDocument;
    const first = honest.segments[0];
    const second = honest.segments[1];
    if (first === undefined || second === undefined) throw new Error('the honest document has four segments');
    const renumber = (segments: TranscriptDocument['segments']): TranscriptDocument['segments'] => segments.map((segment, index) => ({ ...segment, index }));
    const cases: readonly (readonly [string, TranscriptDocument['segments']])[] = [
      ['text changed', renumber([{ ...first, text: 'Keterangan saksi diubah.' }, ...honest.segments.slice(1)])],
      ['moved in time', renumber([{ ...first, start_ms: first.start_ms + 1 }, ...honest.segments.slice(1)])],
      ['neighbour repeated into the gap', renumber([first, second, { ...second, start_ms: 51_000, end_ms: 55_000 }, ...honest.segments.slice(2)])],
      ['an ellipsis', renumber([first, second, { index: 0, start_ms: 51_000, end_ms: 55_000, text: '…', speaker: null }, ...honest.segments.slice(2)])],
    ];
    for (const [label, segments] of cases) {
      const error = await refusal(r.run(snapshotOf(), 1, { transcript: forged({ ...honest, segments }, ['UNEXPECTED']) }));
      expect([label, error.code, error.detail['segments']]).toEqual([label, 'TRANSCRIPT_TEXT_NOT_COMMITTED', 1]);
    }
  });

  it('a record that contradicts its document, failure codes that are not one per failed chunk, another session, another backend: each refused with its code', async () => {
    const r = rig({ fail: failMiddle(() => new Error('the engine ended with an error')) });
    await r.session.finish();
    const answer = await r.session.seam.assemble(r.session.sessionId);
    if (answer.kind !== 'ASSEMBLED') throw new Error('not assembled');
    const withRecord = (change: Partial<AssembledTranscriptRecord>, codes: readonly string[] = answer.failedChunkCodes): AssembledTranscriptSource => ({ closeOut: noCloseOut, locate: () => answer.files, assemble: async () => ({ ...answer, record: { ...answer.record, ...change }, failedChunkCodes: codes }) });

    const cases: readonly (readonly [AssembledTranscriptSource, SttConfigSnapshot, string, Record<string, unknown>])[] = [
      [withRecord({ failedChunks: 0 }), snapshotOf(), 'TRANSCRIPT_RECORD_MISMATCH', { member: 'failedChunks' }],
      [withRecord({ state: 'ASSEMBLED' }), snapshotOf(), 'TRANSCRIPT_RECORD_MISMATCH', { member: 'state' }],
      [withRecord({ labelsStatus: 'UNAVAILABLE' }), snapshotOf(), 'TRANSCRIPT_RECORD_MISMATCH', { member: 'labelsStatus' }],
      [withRecord({ model: { ...answer.record.model, modelSha256: hex('0ther') } }), snapshotOf(), 'TRANSCRIPT_RECORD_MISMATCH', { member: 'model.modelSha256' }],
      [withRecord({}, []), snapshotOf(), 'TRANSCRIPT_RECORD_MISMATCH', { member: 'failedChunkCodes', codes: 0, failedChunks: 1 }],
      [withRecord({}), snapshotOf({ backend: 'omlx-server' }), 'TRANSCRIPT_OF_ANOTHER_SESSION', { reason: 'BACKEND' }],
    ];
    for (const [transcript, snapshot, code, detail] of cases) {
      const error = await refusal(r.run(snapshot, 1, { transcript }));
      expect([error.code, error.detail]).toEqual([code, detail]);
    }

    // The document of ANOTHER session, handed over for this one.
    const other = rig();
    await other.session.finish();
    const foreign = await refusal(r.run(snapshotOf(), 1, { transcript: other.session.seam, chunkRows: other.mirror }));
    expect([foreign.code, foreign.detail]).toEqual(['TRANSCRIPT_OF_ANOTHER_SESSION', { reason: 'SESSION' }]);

    // Nothing of all this was committed; the honest hand-over still is.
    expect(r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)).toMatchObject({ status: 'FAILED', checkpoint: { committed: false } });
    expect(done(await r.run()).transcript.manifest.state).toBe('PARTIAL');
  });

  it('a file that is not a transcript document (with the hash its record states): TRANSCRIPT_DOCUMENT_INVALID', async () => {
    const r = rig();
    await r.session.finish();
    const answer = await r.session.seam.assemble(r.session.sessionId);
    if (answer.kind !== 'ASSEMBLED') throw new Error('not assembled');
    const honest = JSON.parse(readFileSync(answer.files.json, 'utf8')) as Record<string, unknown>;
    for (const body of [JSON.stringify({ ...honest, extra: true }), JSON.stringify({ ...honest, speaker_state: 'UNAVAILABLE' }), 'not json', JSON.stringify({ ...honest, header: { ...(honest['header'] as object), doc_version: 'dems.transcript/2' } })]) {
      const dir = mkdtempSync(join(tmpdir(), 'dems-row79-invalid-'));
      const json = join(dir, 'transcript.json');
      writeFileSync(json, body);
      const files = { ...answer.files, json };
      const seam: AssembledTranscriptSource = { closeOut: noCloseOut, locate: () => files, assemble: async () => ({ ...answer, files, record: { ...answer.record, jsonSha256: createHash('sha256').update(body).digest('hex') } }) };
      expect((await refusal(r.run(snapshotOf(), 1, { transcript: seam }))).code).toBe('TRANSCRIPT_DOCUMENT_INVALID');
    }
  });

  it('a DONE journal row that is not a checkpoint of this step is never computed over; a changed snapshot and a malformed call are refused', async () => {
    const r = rig();
    await r.session.finish();
    await r.journal.write({ sessionId: r.session.sessionId, step: FINALIZE_TRANSCRIPT_STEP, status: 'DONE', progress: 100, etaMs: null, attempt: 1, checkpoint: { chunks: 1 }, errorCode: null, at: 1 });
    const unknown = await refusal(r.run());
    expect([unknown.code, unknown.detail]).toEqual(['JOURNAL_INVALID', { reason: 'CHECKPOINT_FORM_UNKNOWN', status: 'DONE' }]);
    expect(r.session.seam.assembleCalls).toBe(0);

    const s = rig();
    await s.session.finish();
    done(await s.run());
    const changed = await refusal(s.run(snapshotOf({ revision: 4 }), 2));
    expect([changed.code, changed.detail]).toEqual(['INPUT_INVALID', { reason: 'SNAPSHOT_CHANGED' }]);

    for (const input of [
      { sessionId: 'SES-1', sttSnapshot: snapshotOf(), attempt: 1 },
      { sessionId: s.session.sessionId, sttSnapshot: snapshotOf(), attempt: 0 },
      { sessionId: s.session.sessionId, sttSnapshot: { ...snapshotOf(), endpoint: 'http://127.0.0.1:8000' } as never, attempt: 1 },
    ]) {
      expect((await refusal(finalizeTranscript(input, s.ports()))).code).toBe('INPUT_INVALID');
    }
  });

  it('a store that cannot be read: STORE_FAILED, logged with the cause, nothing consumed', async () => {
    const r = rig();
    await r.session.finish();
    const error = await refusal(r.run(snapshotOf(), 1, { chunkRows: { read: async () => Promise.reject(Object.assign(new Error('connection refused'), { code: '08006' })) } }));
    expect([error.code, error.detail]).toEqual(['STORE_FAILED', { what: 'chunkRows.read' }]);
    expect(r.log.entries).toMatchObject([{ level: 'error', code: 'STORE_FAILED', context: { what: 'chunkRows.read', correlationId: r.session.sessionId } }]);
    expect(r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)?.status).toBe('RUNNING');
  });
});

describe('what the step keeps and logs', () => {
  it('the journal checkpoint and the log hold no transcript text, no path and no instant', async () => {
    const r = rig({ fail: failMiddle(() => new Error('the engine ended with an error')) });
    await r.session.finish();
    done(await r.run());
    const kept = JSON.stringify([...r.journal.rows.values()].map((row) => row.checkpoint)) + JSON.stringify(r.log.entries);
    for (const segment of readSealedTranscriptDocument(readFileSync(r.session.files.json))?.segments ?? []) expect(kept).not.toContain(segment.text);
    expect(kept).not.toContain(r.session.dir);
    expect(kept).not.toMatch(/Keterangan|audio\.wav|transcript-checkpoint/);
    const checkpoint = r.journal.rows.get(`${r.session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)?.checkpoint ?? {};
    expect(Object.keys(checkpoint).sort()).toEqual(['committed', 'counters', 'failedChunksByRows', 'manifest', 'modelParams', 'partialReason', 'speakerReason', 'version']);
  });

  it('the Core\'s reading of the document accepts what the transcriber writes and is strict about the rest', async () => {
    const r = rig();
    await r.session.finish();
    await r.session.seam.assemble(r.session.sessionId);
    const honest = JSON.parse(readFileSync(r.session.files.json, 'utf8')) as Record<string, unknown>;
    expect(SealedTranscriptDocumentSchema.safeParse(honest).success).toBe(true);
    const header = honest['header'] as Record<string, unknown>;
    for (const broken of [
      { ...honest, header: { ...header, state: 'READY' } },
      { ...honest, header: { ...header, failed_chunks: 1 } },
      { ...honest, header: { ...header, partial_reason: 'CHUNKS_FAILED' } },
      { ...honest, header: { ...header, failed_chunks: 4, state: 'PARTIAL', partial_reason: 'CHUNKS_FAILED' } },
      { ...honest, qa_flags: ['speaker labels unavailable'] },
      { ...honest, segments: [{ index: 0, start_ms: 0, end_ms: 10, text: '', speaker: null }] },
    ]) {
      expect(SealedTranscriptDocumentSchema.safeParse(broken).success).toBe(false);
    }
  });
});

describe('committing the transcript row with its item (the store is a stand-in here; the table is in the db test)', () => {
  function store(): { rows: Map<string, SealedTranscript>; read: (id: string) => Promise<SealedTranscript | null>; writeSealedTranscript: (row: SealedTranscript) => Promise<void> } {
    const rows = new Map<string, SealedTranscript>();
    return { rows, read: async (id) => rows.get(id) ?? null, writeSealedTranscript: async (row) => void rows.set(row.evidenceId, row) };
  }

  it('WRITTEN once, ALREADY_COMMITTED after that, another transcript for the item refused; a disabled transcript writes nothing', async () => {
    const r = rig();
    await r.session.finish();
    const { transcript } = done(await r.run());
    const s = store();
    const input = { evidenceId: 'EV-20261009-7901', transcript, createdAt: 1_791_529_000_000 };
    expect(await commitSealedTranscript(s, input)).toEqual({ outcome: 'WRITTEN', jsonSha256: transcript.manifest.sha256 });
    expect(await commitSealedTranscript(s, input)).toEqual({ outcome: 'ALREADY_COMMITTED', jsonSha256: transcript.manifest.sha256 });
    expect(s.rows.size).toBe(1);
    expect(s.rows.get('EV-20261009-7901')).toEqual({ evidenceId: 'EV-20261009-7901', createdAt: 1_791_529_000_000, ...transcript.transcriptRow });

    const other = rig({ diarizer: null });
    await other.session.finish();
    const second = done(await other.run()).transcript;
    const differs = await refusal(commitSealedTranscript(s, { ...input, transcript: second }));
    expect(differs.code).toBe('SEALED_TRANSCRIPT_DIFFERS');
    expect(s.rows.get('EV-20261009-7901')?.jsonSha256).toBe(transcript.manifest.sha256);

    const disabled = done(await rig().run(snapshotOf({ enabled: false }))).transcript;
    expect(await commitSealedTranscript(s, { evidenceId: 'EV-20261009-7902', transcript: disabled, createdAt: 1 })).toEqual({ outcome: 'NO_TRANSCRIPT' });
    expect(s.rows.size).toBe(1);
  });

  it('the summary carries the head of the revision chain, and the machine transcript hash never moves with it', async () => {
    const r = rig();
    await r.session.finish();
    const { transcript } = done(await r.run());
    const head = evidenceTranscriptSummary(transcript.manifest, 3);
    expect([head.revision, head.sha256, head.machineTranscriptHash]).toEqual([3, transcript.manifest.sha256, transcript.manifest.sha256]);
  });
});
