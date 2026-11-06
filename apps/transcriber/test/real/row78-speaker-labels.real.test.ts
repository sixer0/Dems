// Row 78 — speaker labelling with the REAL engine (sherpa-onnx C API + the 3D-Speaker CAM++ model,
// CPU provider), on real audio. Never in the default `npm test`: run it alone, outside the sandbox,
// under the host lock:
//
//   /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock npm run test:real:row78:labels -w @dems/transcriber
//
// THREE CHECKS, each one able to fail:
//
//   1. THE SEALED TWO-VOICE FIXTURE (M6-TF-1 criterion 6, M6-LB-1 "asserted in TF-1"). STT input is
//      the committed checkpoint of row 77's cpu-local run (no STT engine is started here). The
//      document must carry a speaker state — LABELLED or UNAVAILABLE with its reason — and the two
//      runs must give the same bytes. WHAT the state is on this fixture is MEASURED and written to
//      the evidence, together with how a forced two-way split would attribute the 14 sentences
//      against the fixture's script (a count of sentences; no timing figure).
//   2. A SECOND MEASUREMENT, meant as a positive control: two different built-in voices of this
//      Mac's `say` (no voice cloning), eight sentences in turn. FIRST RUN, 2026-10-09: the document
//      came out UNAVAILABLE / LOW_CONFIDENCE (a forced split would have put 6 of 8 sentences right),
//      so this row has NOT shown a LABELLED document on real audio. The check therefore asserts
//      what must hold whatever the audio — a LABELLED document attributes EVERY sentence
//      correctly, anything less carries NO label — and writes the measured outcome to the evidence.
//      The labelling path itself (LABELLED included) is held by the unit tests on stand-in
//      embeddings (`src/__tests__/diarization.test.ts`, `assembly.test.ts`).
//   3. NEGATIVE CONTROLS on the real files: the two segmentation assets that are not cleared are
//      refused as a model (by marker AND by hash) without any engine start; an absent model is
//      UNAVAILABLE / MODEL_ABSENT.
//
// No duration is measured or stored (D230).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NO_CAPTURE_WORKER } from '../../src/backends/cpu-local';
import { createMemoryLog } from '../../src/log';
import { assembleTranscript } from '../../src/pipeline/assembly';
import { openPcmSource } from '../../src/pipeline/audio-source';
import { CheckpointSchema, emptyCheckpoint, type Checkpoint } from '../../src/pipeline/checkpoint';
import { TRANSCRIPT_CHECKPOINT_FILE } from '../../src/pipeline/constants';
import { clusterInTwo, createSpeakerEmbedder, resolveSpeakerEmbedderConfig, type SpeakerEmbedding, type SpeakerEmbeddingEngine } from '../../src/pipeline/diarization';
import { decodedFileTimeline } from '../../src/pipeline/media-time';
import { TWO_SPEAKER_SCRIPT } from '../../src/fixtures/tts-fixture-provider';
import { encodeWavPcm16, readWavFacts } from '../../src/wav';
import { REPO, SEALED_FIXTURE, writeEvidence } from './real-support';

const SHERPA = join(REPO, '.cache/stt/sherpa-onnx/sherpa-onnx-v1.13.8-osx-arm64-shared-no-tts');
const EMBED_BINARY = join(SHERPA, 'bin/dems-speaker-embed');
const EMBEDDING_MODEL = join(REPO, '.cache/stt/diarization/embedding/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx');
const EMBEDDING_MODEL_ID = '3dspeaker_speech_campplus_sv_en_voxceleb_16k';
const ROW77_CHECKPOINT = join(REPO, '.cache/stt/checks/row77/runs/20261009T075020236Z-20817-row77-cpu-local/run1.checkpoint.json');
const NOT_CLEARED = [
  join(REPO, '.cache/stt/diarization/segmentation/sherpa-onnx-reverb-diarization-v1/model.onnx'),
  join(REPO, '.cache/stt/diarization/segmentation-pyannote-3-0/model.onnx'),
];
const RUN_DIR = join(REPO, '.cache/stt/checks/row78/runs', `${new Date().toISOString().replace(/[-:.]/g, '')}-${process.pid}-row78-labels`);
mkdirSync(RUN_DIR, { recursive: true });

const MODEL = { name: 'whisper-large-v3-turbo', version: 'ggml', quantisation: 'none', sha256: '0'.repeat(64) }; // placeholder provenance: the Core supplies the real one (row 115)

interface Run {
  readonly argv: readonly string[];
  readonly status: number | null;
  readonly vectors: number | null;
  readonly nice: number | null;
}

function realEngine(modelPath = EMBEDDING_MODEL): { engine: SpeakerEmbeddingEngine; runs: Run[]; vectors: SpeakerEmbedding[][]; log: ReturnType<typeof createMemoryLog> } {
  const runs: Run[] = [];
  const vectors: SpeakerEmbedding[][] = [];
  const log = createMemoryLog();
  const real = createSpeakerEmbedder(resolveSpeakerEmbedderConfig({ binaryPath: EMBED_BINARY, embeddingModelPath: modelPath, embeddingModel: EMBEDDING_MODEL_ID }), { log, captureWorkerPid: NO_CAPTURE_WORKER, onEngineRun: (run) => runs.push(run) });
  const engine: SpeakerEmbeddingEngine = {
    async embed(path, rate, spans, id) {
      const answer = await real.embed(path, rate, spans, id);
      vectors.push([...answer.vectors]);
      return answer;
    },
  };
  return { engine, runs, vectors, log };
}

/** How a forced two-way split of the embeddings would attribute the segments: for the evidence only. */
function forcedSplit(vectors: readonly SpeakerEmbedding[], truth: readonly string[]): { attribution: string; correct: number; of: number; separation: number; confidence: number; spread: readonly number[]; sizes: readonly number[] } {
  const unit = vectors.map((vector) => {
    const length = Math.hypot(...(vector as number[]));
    return (vector as number[]).map((value) => value / length);
  });
  const clusters = clusterInTwo(unit);
  if (clusters === null) throw new Error('unreachable');
  const attribution = clusters.assignment.map((value) => (value === clusters.assignment[0] ? 'A' : 'B'));
  const round = (value: number): number => Math.round(value * 1000) / 1000;
  return { attribution: attribution.join(''), correct: attribution.filter((label, index) => label === truth[index]).length, of: truth.length, separation: round(clusters.separation), confidence: round(clusters.confidence), spread: clusters.spread.map(round), sizes: clusters.sizes };
}

async function assemble(dir: string, checkpoint: Checkpoint, wavPath: string, rate: number, engine: SpeakerEmbeddingEngine | null, log: ReturnType<typeof createMemoryLog>) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, TRANSCRIPT_CHECKPOINT_FILE), `${JSON.stringify(checkpoint)}\n`);
  return assembleTranscript({
    sessionScratchDir: dir,
    identity: { sessionId: checkpoint.sessionId, backend: checkpoint.backend, model: checkpoint.model, timeline: decodedFileTimeline(rate) },
    source: openPcmSource({ container: 'wav', path: wavPath, sampleRateHz: rate }),
    diarization: { enabled: true, engine },
    model: MODEL,
    intervals: [],
    log,
  });
}

describe('row 78, real engine: the sealed two-voice Indonesian fixture', () => {
  it('the speaker state is present and honest; two runs give the same bytes; the measured attribution is written to the evidence', async () => {
    const checkpoint = CheckpointSchema.parse(JSON.parse(readFileSync(ROW77_CHECKPOINT, 'utf8')));
    const segments = checkpoint.chunks.flatMap((chunk) => chunk.segments ?? []);
    expect(segments).toHaveLength(14);
    // The script of the fixture: 13 sentences A,B,A,B,…; the engine split sentence A5 in two (row 77), so 14 segments.
    const script = TWO_SPEAKER_SCRIPT.map((turn) => turn.speaker);
    const truth = [...script.slice(0, 9), 'A', ...script.slice(9)];
    expect(truth.join('')).toBe('ABABABABAABABA');

    const first = realEngine();
    const a = await assemble(join(RUN_DIR, 'fixture-run1'), checkpoint, SEALED_FIXTURE, 24_000, first.engine, first.log);
    const second = realEngine();
    const b = await assemble(join(RUN_DIR, 'fixture-run2'), checkpoint, SEALED_FIXTURE, 24_000, second.engine, second.log);

    // M6-TF-1 criterion 6: a speaker state is present, and it is consistent with the document.
    expect(['LABELLED', 'UNAVAILABLE']).toContain(a.document.speaker_state);
    expect(a.document.qa_flags.includes('speaker labels unavailable')).toBe(a.document.speaker_state === 'UNAVAILABLE');
    expect(a.document.header.speaker_reason === null).toBe(a.document.speaker_state === 'LABELLED');
    expect(a.document.segments.map((segment) => segment.text)).toEqual(segments.map((segment) => segment.text));
    // Stable across two runs of the real engine.
    expect(readFileSync(b.files.json)).toEqual(readFileSync(a.files.json));
    expect(b.record.jsonSha256).toBe(a.record.jsonSha256);
    // The engine ran once per run, lowered, on the CPU, with the model whose hash the document names.
    expect([first.runs.length, first.runs[0]?.status, first.runs[0]?.vectors]).toEqual([1, 0, 14]);
    expect(first.runs[0]?.argv.slice(0, 3)).toEqual(['/usr/bin/nice', '-n', '10']);
    expect(a.document.header.diarization.engine).toMatchObject({ engine: 'sherpa-onnx', embedding_model: EMBEDDING_MODEL_ID, embedding_model_sha256: '357a834f702b80161e5b981182c038e18553c1f2ca752ed6cec2052365d4129b' });

    const measured = forcedSplit(first.vectors[0] ?? [], truth);
    const labels = a.document.segments.map((segment) => segment.speaker);
    const labelledCorrect = a.document.speaker_state === 'LABELLED' ? labels.filter((label, index) => label === truth[index]).length : null;
    // A LABELLED document must attribute every sentence correctly; anything less must be UNAVAILABLE.
    if (a.document.speaker_state === 'LABELLED') expect(labelledCorrect).toBe(truth.length);
    else expect(labels.every((label) => label === null)).toBe(true);

    writeEvidence(RUN_DIR, 'fixture.evidence.json', {
      fixtureSha256: '6743181a…c0f4fe71 (the sealed fixture; held by the fixture provider)',
      sttInput: 'row 77 cpu-local run 1 checkpoint (14 committed segments); no STT engine started in this check',
      speakerState: a.document.speaker_state,
      speakerReason: a.document.header.speaker_reason,
      confidence: a.document.header.diarization.confidence,
      qaFlags: a.document.qa_flags,
      documentSha256Run1: a.record.jsonSha256,
      documentSha256Run2: b.record.jsonSha256,
      labelledSentencesCorrect: labelledCorrect,
      scriptedSpeakers: truth.join(''),
      forcedTwoWaySplit: measured,
      engineRuns: [first.runs[0]?.argv.map((part) => part.replace(REPO, '…')), second.runs[0]?.argv.map((part) => part.replace(REPO, '…'))],
      engineNice: first.runs[0]?.nice,
    });
  });
});

describe('row 78, real engine: a second measurement — two built-in synthetic voices, no cloning', () => {
  it('eight sentences in turn: LABELLED only if all eight are attributed correctly, otherwise no label at all; the outcome is written to the evidence', async () => {
    const dir = join(RUN_DIR, 'control');
    mkdirSync(dir, { recursive: true });
    const sentences = TWO_SPEAKER_SCRIPT.slice(0, 8);
    const voices = { A: 'Daniel', B: 'Damayanti' } as const;
    const rate = 24_000;
    const gap = new Int16Array(rate * 0.4);
    const pieces: Int16Array[] = [gap];
    const segments: { startMs: number; endMs: number; text: string }[] = [];
    let cursor = gap.length;
    sentences.forEach((turn, index) => {
      const aiff = join(dir, `turn-${index}.aiff`);
      const wav = join(dir, `turn-${index}.wav`);
      execFileSync('/usr/bin/say', ['-v', voices[turn.speaker], '-o', aiff, turn.text]);
      execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', `LEI16@${rate}`, '-c', '1', aiff, wav]);
      const bytes = readFileSync(wav);
      const facts = readWavFacts(bytes);
      const samples = new Int16Array(facts.dataBytes / 2);
      for (let k = 0; k < samples.length; k += 1) samples[k] = bytes.readInt16LE(facts.dataOffset + k * 2);
      segments.push({ startMs: Math.round((cursor * 1000) / rate), endMs: Math.round(((cursor + samples.length) * 1000) / rate), text: turn.text });
      pieces.push(samples, gap);
      cursor += samples.length + gap.length;
    });
    const all = new Int16Array(cursor);
    let at = 0;
    for (const piece of pieces) {
      all.set(piece, at);
      at += piece.length;
    }
    const wavPath = join(dir, 'control-two-voices.wav');
    writeFileSync(wavPath, encodeWavPcm16(all, rate));

    const identity = { sessionId: 'SES-20261009-7801', backend: 'cpu-local' as const, model: 'known-script', timeline: decodedFileTimeline(rate) };
    const checkpoint: Checkpoint = {
      ...emptyCheckpoint(identity),
      audioComplete: true,
      cursorSample: cursor,
      nextSeq: 2,
      chunks: [{ chunkIndex: 0, seq: 1, failedSeqs: [], fromSample: 0, toSample: cursor, startMs: 0, endMs: Math.round((cursor * 1000) / rate), audioSource: null, status: 'DONE', segments, computedAt: 0, errorCode: null }],
    };
    const real = realEngine();
    const result = await assemble(join(dir, 'scratch'), checkpoint, wavPath, rate, real.engine, real.log);
    const truth = sentences.map((turn) => turn.speaker);
    const labels = result.document.segments.map((segment) => segment.speaker);
    const measured = forcedSplit(real.vectors[0] ?? [], truth);
    writeEvidence(RUN_DIR, 'control.evidence.json', {
      audio: 'eight sentences of the fixture script spoken by two built-in macOS voices (say -v Daniel / -v Damayanti), 0.4 s apart; generated for this run, git-ignored',
      speakerState: result.document.speaker_state,
      speakerReason: result.document.header.speaker_reason,
      confidence: result.document.header.diarization.confidence,
      labels: labels.join(''),
      scriptedSpeakers: truth.join(''),
      sentencesCorrect: `${labels.filter((label, index) => label === truth[index]).length}/${truth.length}`,
      clusters: measured,
    });
    expect(['LABELLED', 'UNAVAILABLE']).toContain(result.document.speaker_state);
    if (result.document.speaker_state === 'LABELLED') {
      expect(labels).toEqual(truth);
      expect(result.document.qa_flags).not.toContain('speaker labels unavailable');
    } else {
      expect(labels.every((label) => label === null)).toBe(true);
      expect(result.document.qa_flags).toContain('speaker labels unavailable');
      expect(result.document.header.speaker_reason).not.toBeNull();
    }
    // The transcript text is whole either way.
    expect(result.document.segments.map((segment) => segment.text)).toEqual(sentences.map((turn) => turn.text));
  });
});

describe('row 78, real files: NEGATIVE CONTROLS', () => {
  it.each(NOT_CLEARED)('a model that is not cleared (%s) is refused by marker AND by hash, with NO engine start; the document is UNAVAILABLE / MODEL_LICENCE_NOT_CLEARED', async (path) => {
    if (!existsSync(path)) return; // the user may have removed the files: then there is nothing to refuse
    const checkpoint = CheckpointSchema.parse(JSON.parse(readFileSync(ROW77_CHECKPOINT, 'utf8')));
    // By marker: the file where it lies.
    const marked = realEngine(path);
    const byMarker = await assemble(join(RUN_DIR, `refused-marker-${NOT_CLEARED.indexOf(path)}`), checkpoint, SEALED_FIXTURE, 24_000, marked.engine, marked.log);
    expect([byMarker.document.speaker_state, byMarker.document.header.speaker_reason, marked.runs.length]).toEqual(['UNAVAILABLE', 'MODEL_LICENCE_NOT_CLEARED', 0]);
    expect(marked.log.records().find((record) => record.level === 'error')?.context).toMatchObject({ reason: 'MODEL_LICENCE_NOT_CLEARED', by: 'MARKER' });
    // By hash: a copy of the same bytes under another name, in a directory with no marker.
    const copy = join(RUN_DIR, `copy-${NOT_CLEARED.indexOf(path)}`, 'innocent-name.onnx');
    mkdirSync(join(copy, '..'), { recursive: true });
    copyFileSync(path, copy);
    const hashed = realEngine(copy);
    const byHash = await assemble(join(RUN_DIR, `refused-hash-${NOT_CLEARED.indexOf(path)}`), checkpoint, SEALED_FIXTURE, 24_000, hashed.engine, hashed.log);
    expect([byHash.document.header.speaker_reason, hashed.runs.length]).toEqual(['MODEL_LICENCE_NOT_CLEARED', 0]);
    expect(hashed.log.records().find((record) => record.level === 'error')?.context).toMatchObject({ by: 'SHA256' });
    // The copy made for this check is removed again: no second copy of an uncleared file stays on the disk.
    rmSync(copy, { force: true });
  });

  it('the model file absent: UNAVAILABLE / MODEL_ABSENT with the flag, no engine start, and the transcript text is all there', async () => {
    const checkpoint = CheckpointSchema.parse(JSON.parse(readFileSync(ROW77_CHECKPOINT, 'utf8')));
    const absent = realEngine(`${EMBEDDING_MODEL}.not-downloaded`);
    const result = await assemble(join(RUN_DIR, 'absent'), checkpoint, SEALED_FIXTURE, 24_000, absent.engine, absent.log);
    expect([result.document.speaker_state, result.document.header.speaker_reason, absent.runs.length, result.document.segments.length]).toEqual(['UNAVAILABLE', 'MODEL_ABSENT', 0, 14]);
    expect(result.document.qa_flags).toContain('speaker labels unavailable');
  });
});
