/**
 * ASSEMBLY: the diarization post-pass, the document, its hash, its files and its checkpoint
 * (transcript spec §A.4 "Checkpoint", §A.5, §D.1, §D.3; blueprint row 78 / M6-W3).
 *
 * `assembleTranscript` is called ONCE THE RUNNER REPORTS `complete` (every chunk of the whole
 * audio is DONE or FAILED). It does, in this order, each step durable before the next starts:
 *
 *   1. LABELS   the diarization post-pass runs and its label map + state are written to the
 *               checkpoint file — ONCE. A later call finds them and starts no engine.
 *   2. DOCUMENT the canonical `dems.transcript/1` text and its SRT and WebVTT renderings are
 *               written beside the checkpoint (`transcript.json`, `.srt`, `.vtt`), each replaced
 *               atomically (sibling file, fsync, rename, fsync of the directory).
 *   3. RECORD   `{assembled, docSha256, …}` is written to the checkpoint file. Only now is the
 *               transcript "assembled and hashed", which is what sealing waits for (§D.3, D223).
 *
 * WHAT IT REFUSES (`ASSEMBLY_REFUSED`, nothing written): a session without a checkpoint, and a
 * transcript with a chunk still PENDING or RUNNING or a plan that does not cover the whole audio —
 * an unfinished transcript is never assembled as if it were complete. A transcript whose work is
 * OVER but incomplete (a FAILED chunk, audio that never reached the transcriber) IS assembled,
 * with `state: PARTIAL` and its reason, and with no text made up for what is missing (D-EV-1).
 *
 * IDEMPOTENT, AND THE MACHINE TRANSCRIPT IS NEVER RECOMPUTED (§D.3). A call on an assembled
 * transcript returns the stored document after proving that the file still has the recorded hash.
 * If a file is missing or damaged (§A.5 "Assembly error -> rebuild from committed chunks") the
 * document is rebuilt from the committed chunks and the stored label map, and it is accepted ONLY
 * IF IT HAS THE RECORDED HASH; otherwise the call is refused and logged, and nothing is replaced.
 *
 * A kill between two steps loses nothing: step 1 is found again, step 2 is repeated with the same
 * bytes, step 3 is written after it. Nothing here measures or records how long anything took (D230).
 */
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TranscriberLog } from '../log';
import { TranscriberError, TranscriberErrorCode } from '../types';
import type { PcmSource } from './audio-source';
import { ChunkStatus, createCheckpointStore, type Checkpoint, type CheckpointIdentity } from './checkpoint';
import { TRANSCRIPT_DOCUMENT_FILE, TRANSCRIPT_SRT_FILE, TRANSCRIPT_VTT_FILE } from './constants';
import { runDiarizationPass, type SpeakerEmbeddingEngine, type SpeakerLabelling } from './diarization';
import { buildTranscriptDocument, committedSegments, renderTranscript, sealRecordOf, sha256HexOfText, type DocumentInterval, type RenderedTranscript, type TranscriptDocument, type TranscriptModelProvenance, type TranscriptSealRecord } from './document';

export interface AssembleTranscriptOptions {
  /** `<session scratch>`: where the checkpoint file is; the document files are written beside it. */
  readonly sessionScratchDir: string;
  /** The same identity the runner of this session was given. */
  readonly identity: CheckpointIdentity;
  /** The audio of the session, for the diarization post-pass. */
  readonly source: PcmSource;
  /** `diarization` of the session's STT configuration snapshot (R-8), and the engine of this Core (null: none). */
  readonly diarization: { readonly enabled: boolean; readonly engine: SpeakerEmbeddingEngine | null };
  /** The provenance of the STT model (ev §B.7 fields 84-87). */
  readonly model: TranscriptModelProvenance;
  /** The audio-source intervals of the session (`session_audio_intervals`), media time. */
  readonly intervals: readonly DocumentInterval[];
  /**
   * Fix wave K (G81b-04): true when the recording of the session was INTERRUPTED (it ended at a fault, not at a stop).
   * An interval without an end is then recorded as `intervals_incomplete` (transcript spec §D.2). Absent / false: a
   * recording that was stopped - the document is what it always was.
   */
  readonly intervalsTruncated?: boolean;
  readonly log: TranscriberLog;
}

export interface AssembledTranscript {
  readonly document: TranscriptDocument;
  readonly rendered: RenderedTranscript;
  /** What the Core writes to `transcripts` and `evidence_items.transcript_sha256` in one unit of work. */
  readonly record: TranscriptSealRecord;
  /** The three files, absolute. */
  readonly files: { readonly json: string; readonly srt: string; readonly vtt: string };
  /** True when this call found the transcript already assembled and computed nothing. */
  readonly alreadyAssembled: boolean;
}

const SOURCE = 'transcriber.assembly';

function writeAtomically(path: string, text: string): void {
  const staging = `${path}.next`;
  mkdirSync(dirname(path), { recursive: true });
  rmSync(staging, { force: true });
  const descriptor = openSync(staging, 'wx', 0o600);
  try {
    writeSync(descriptor, Buffer.from(text, 'utf8'));
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(staging, path);
  const directory = openSync(dirname(path), 'r');
  try {
    fsyncSync(directory);
  } finally {
    closeSync(directory);
  }
}

function hashOfFile(path: string): string | null {
  try {
    return sha256HexOfText(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** `details.reason` of the refusal that is a WAIT, not a failure: work is still under way (the Core classes it `NOT_READY`). */
export const ASSEMBLY_NOT_COMPLETE_REASON = 'TRANSCRIPT_NOT_COMPLETE';

export async function assembleTranscript(options: AssembleTranscriptOptions): Promise<AssembledTranscript> {
  const { log, identity } = options;
  const correlationId = identity.sessionId;
  const store = createCheckpointStore(options.sessionScratchDir);
  const files = { json: join(options.sessionScratchDir, TRANSCRIPT_DOCUMENT_FILE), srt: join(options.sessionScratchDir, TRANSCRIPT_SRT_FILE), vtt: join(options.sessionScratchDir, TRANSCRIPT_VTT_FILE) };
  const refuse = (reason: string, detail: Record<string, string | number | boolean | null> = {}): TranscriberError => {
    const error = new TranscriberError(TranscriberErrorCode.ASSEMBLY_REFUSED, 'the transcript cannot be assembled', { reason, ...detail });
    // Fix wave K (G75c-08): `TRANSCRIPT_NOT_COMPLETE` is the NORMAL answer while chunks are still being decoded - the
    // caller reads it as "not ready yet" and asks again (the seal's transcript step, once a second). It is told at
    // `info`, without the error object: a healthy seal must not print error lines. Every other refusal is an error.
    if (reason === ASSEMBLY_NOT_COMPLETE_REASON) log.info({ source: SOURCE, message: 'the transcript is not complete yet: assembly waits', context: { reason, ...detail }, correlationId });
    else log.error({ source: SOURCE, message: 'transcript assembly refused', error, context: { reason, ...detail }, correlationId });
    return error;
  };

  let checkpoint: Checkpoint | null;
  try {
    checkpoint = store.load(identity);
  } catch (error) {
    log.error({ source: SOURCE, message: 'the transcript checkpoint could not be read for assembly', error, context: { reason: 'CHECKPOINT_INVALID' }, correlationId });
    throw error;
  }
  if (checkpoint === null) throw refuse('NO_CHECKPOINT');
  const unfinished = checkpoint.chunks.filter((chunk) => chunk.status === ChunkStatus.PENDING || chunk.status === ChunkStatus.RUNNING).length;
  if (!checkpoint.audioComplete || unfinished > 0) throw refuse(ASSEMBLY_NOT_COMPLETE_REASON, { audioComplete: checkpoint.audioComplete, unfinished });

  const segments = committedSegments(checkpoint);

  // 1. LABELS — once.
  let labelling: SpeakerLabelling;
  if (checkpoint.diarization !== undefined) {
    if (checkpoint.diarization.segments !== segments.length) throw refuse('LABEL_MAP_OF_OTHER_SEGMENTS', { stored: checkpoint.diarization.segments, segments: segments.length });
    const { segments: _count, ...stored } = checkpoint.diarization;
    labelling = stored;
  } else {
    labelling = await runDiarizationPass({
      enabled: options.diarization.enabled,
      engine: options.diarization.engine,
      source: options.source,
      timeline: identity.timeline,
      segments,
      workDir: join(options.sessionScratchDir, 'work'),
      log,
      correlationId,
    });
    checkpoint.diarization = { state: labelling.state, reason: labelling.reason, numSpeakers: labelling.numSpeakers, confidence: labelling.confidence, segments: segments.length, labels: [...labelling.labels], engine: labelling.engine };
    store.save(checkpoint);
  }

  const document = buildTranscriptDocument({ checkpoint, labelling, model: options.model, intervals: options.intervals, ...(options.intervalsTruncated === true ? { intervalsTruncated: true } : {}) });
  const rendered = renderTranscript(document);
  const result = (alreadyAssembled: boolean): AssembledTranscript => ({ document, rendered, record: sealRecordOf(document, rendered), files, alreadyAssembled });

  // An assembled transcript is never computed again: what was just built must BE the recorded one.
  const recorded = checkpoint.document;
  if (recorded !== undefined) {
    if (rendered.sha256 !== recorded.docSha256 || rendered.srtSha256 !== recorded.srtSha256 || rendered.vttSha256 !== recorded.vttSha256) {
      throw refuse('DOCUMENT_HASH_MISMATCH', { recorded: recorded.docSha256, rebuilt: rendered.sha256 });
    }
    const intact = hashOfFile(files.json) === recorded.docSha256 && hashOfFile(files.srt) === recorded.srtSha256 && hashOfFile(files.vtt) === recorded.vttSha256;
    if (intact) return result(true);
    log.warn({ source: SOURCE, message: 'an assembled transcript file was missing or changed; it is written again from the committed chunks, with the recorded hash', context: { reason: 'DOCUMENT_FILE_REBUILT' }, correlationId });
  }

  // 2. DOCUMENT — the three files.
  writeAtomically(files.json, rendered.json);
  writeAtomically(files.srt, rendered.srt);
  writeAtomically(files.vtt, rendered.vtt);

  // 3. RECORD — once.
  if (recorded === undefined) {
    checkpoint.document = { assembled: true, docSha256: rendered.sha256, srtSha256: rendered.srtSha256, vttSha256: rendered.vttSha256, speakerState: document.speaker_state, state: document.header.state };
    store.save(checkpoint);
    log.info({
      source: SOURCE,
      message: 'transcript assembled and hashed',
      context: { state: document.header.state, partialReason: document.header.partial_reason, speakerState: document.speaker_state, speakerReason: document.header.speaker_reason, segments: document.segments.length, failedChunks: document.header.failed_chunks, docSha256: rendered.sha256 },
      correlationId,
    });
  }
  return result(recorded !== undefined);
}
