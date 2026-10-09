// The canonical `dems.transcript/1` document, its hash and its renderings (row 78; transcript spec
// §A.5; evidence package spec §B.7). Pure functions: no file, no engine.
//
// What must be able to fail, and does here: the hash is stable across two builds and across the
// order in which members were written; ONE changed character changes it; the canonical bytes of a
// small document are written out in this file and its SHA-256 was computed OUTSIDE this code
// (python `hashlib` over the same literal), so the rule itself is pinned, not just its repeatability.
import { describe, expect, it } from 'vitest';
import { ChunkStatus, emptyCheckpoint, type Checkpoint } from '../pipeline/checkpoint';
import { SPEAKER_LABELS_UNAVAILABLE_FLAG, TRANSCRIPT_DOC_VERSION } from '../pipeline/constants';
import type { SpeakerLabelling } from '../pipeline/diarization';
import {
  TranscriptDocumentSchema,
  buildTranscriptDocument,
  canonicalTranscriptJson,
  committedSegments,
  failedChunkCount,
  renderSrt,
  renderTranscript,
  renderVtt,
  sealRecordOf,
  sha256HexOfText,
  transcriptDocumentSha256,
  type TranscriptDocument,
} from '../pipeline/document';
import { decodedFileTimeline } from '../pipeline/media-time';
import { MODEL_PROVENANCE, STUB_FACTS } from './diarization-support';

const identity = { sessionId: 'SES-20261009-0078', backend: 'cpu-local' as const, model: 'stand-in-model', timeline: decodedFileTimeline(24_000) };

function chunk(index: number, segments: { startMs: number; endMs: number; text: string }[] | null, status: Checkpoint['chunks'][number]['status'] = ChunkStatus.DONE): Checkpoint['chunks'][number] {
  return { chunkIndex: index, seq: index + 1, failedSeqs: [], fromSample: index * 240_000, toSample: (index + 1) * 240_000, startMs: index * 10_000, endMs: (index + 1) * 10_000, audioSource: null, status, segments, computedAt: segments === null ? null : 1_791_529_000_000, errorCode: status === ChunkStatus.FAILED ? 'ENGINE_FAILED' : null };
}

const TEXTS = ['Selamat pagi.', 'Selamat pagi, terima kasih.', 'Tolong jelaskan peran Anda.', 'Saya operator "penerimaan" barang — café.'];

function finished(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    ...emptyCheckpoint(identity),
    audioComplete: true,
    cursorSample: 480_000,
    nextSeq: 3,
    chunks: [
      chunk(0, [
        { startMs: 640, endMs: 4_240, text: TEXTS[0] as string },
        { startMs: 4_960, endMs: 7_840, text: TEXTS[1] as string },
      ]),
      chunk(1, [
        { startMs: 10_500, endMs: 12_380, text: TEXTS[2] as string },
        { startMs: 13_080, endMs: 18_720, text: TEXTS[3] as string },
      ]),
    ],
    ...overrides,
  };
}

const LABELLED: SpeakerLabelling = { state: 'LABELLED', reason: null, numSpeakers: 2, confidence: 0.812, labels: ['A', 'B', 'A', 'B'], engine: STUB_FACTS };
const UNLABELLED: SpeakerLabelling = { state: 'UNAVAILABLE', reason: 'ENGINE_NOT_CONFIGURED', numSpeakers: 0, confidence: null, labels: [null, null, null, null], engine: null };
const INTERVALS = [{ source: 'MIC-01', fromMs: 0, toMs: 9_000 }, { source: 'MIC-02', fromMs: 9_000, toMs: null }];

const build = (checkpoint: Checkpoint = finished(), labelling: SpeakerLabelling = LABELLED): TranscriptDocument => buildTranscriptDocument({ checkpoint, labelling, model: MODEL_PROVENANCE, intervals: INTERVALS });

/** The same value with the members of every object in REVERSED order. */
function reversedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reversedKeys);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .reverse()
      .map(([key, member]) => [key, reversedKeys(member)]),
  );
}

describe('the document (§A.5 "Document format")', () => {
  it('has exactly the five members of the spec; a segment has exactly index, start_ms, end_ms, text, speaker', () => {
    const doc = build();
    expect(Object.keys(doc).sort()).toEqual(['header', 'intervals', 'qa_flags', 'segments', 'speaker_state']);
    expect(doc.header.doc_version).toBe('dems.transcript/1');
    expect(TRANSCRIPT_DOC_VERSION).toBe('dems.transcript/1');
    expect(doc.segments.map((segment) => Object.keys(segment).sort())).toEqual(Array.from({ length: 4 }, () => ['end_ms', 'index', 'speaker', 'start_ms', 'text']));
    expect(doc.segments.map((segment) => [segment.index, segment.start_ms, segment.end_ms, segment.speaker])).toEqual([
      [0, 640, 4_240, 'A'],
      [1, 4_960, 7_840, 'B'],
      [2, 10_500, 12_380, 'A'],
      [3, 13_080, 18_720, 'B'],
    ]);
    expect(doc.segments.map((segment) => segment.text)).toEqual(TEXTS);
    expect(doc.speaker_state).toBe('LABELLED');
    expect(doc.header).toMatchObject({ session_id: 'SES-20261009-0078', language: 'id', backend: 'cpu-local', state: 'ASSEMBLED', partial_reason: null, chunks: 2, failed_chunks: 0, speaker_reason: null });
    expect(doc.header.model).toEqual({ id: 'stand-in-model', name: 'stand-in-model', version: '1', quantisation: 'none', sha256: 'c'.repeat(64) });
    expect(doc.header.diarization).toEqual({ num_speakers: 2, confidence: 0.812, engine: { engine: 'stand-in-embedder', embedding_model: 'stand-in-embedding', embedding_model_sha256: 'b'.repeat(64) } });
    expect(doc.intervals).toEqual([
      { source: 'MIC-01', from_ms: 0, to_ms: 9_000 },
      { source: 'MIC-02', from_ms: 9_000, to_ms: null },
    ]);
    expect(doc.qa_flags).toEqual([]);
  });

  it('the QA members of an engine and the instants of a run are NOT in the sealed document (identical shape on every backend, §B.5)', () => {
    const checkpoint = finished();
    const first = checkpoint.chunks[0]?.segments?.[0];
    if (first === undefined) throw new Error('unreachable');
    Object.assign(first, { avgLogprob: -0.2, noSpeechProb: 0.01, compressionRatio: 1.1 });
    const text = canonicalTranscriptJson(build(checkpoint));
    expect(text).not.toMatch(/avgLogprob|noSpeechProb|compressionRatio|computedAt|1791529000000/);
    expect(transcriptDocumentSha256(build(checkpoint))).toBe(transcriptDocumentSha256(build()));
  });

  it('unlabelled: UNAVAILABLE, its reason, the exact flag `speaker labels unavailable`, and no label on any segment', () => {
    const doc = build(finished(), UNLABELLED);
    expect(doc.speaker_state).toBe('UNAVAILABLE');
    expect(doc.header.speaker_reason).toBe('ENGINE_NOT_CONFIGURED');
    expect(doc.qa_flags).toEqual(['speaker labels unavailable']);
    expect(SPEAKER_LABELS_UNAVAILABLE_FLAG).toBe('speaker labels unavailable');
    expect(doc.segments.map((segment) => segment.speaker)).toEqual([null, null, null, null]);
    expect(doc.header.diarization).toEqual({ num_speakers: 0, confidence: null, engine: null });
  });

  it('the qa flags of the pipeline are carried, sorted, beside the speaker flag', () => {
    const doc = build(finished({ qaFlags: ['vad_fallback', 'intervals_incomplete'] }), UNLABELLED);
    expect(doc.qa_flags).toEqual(['intervals_incomplete', 'speaker labels unavailable', 'vad_fallback']);
  });
});

describe('PARTIAL is carried into the document and never presented as complete (row 77 tap signal; D-EV-1)', () => {
  it('audio that did not reach the transcriber: state PARTIAL, reason TRANSCRIPT_AUDIO_UNAVAILABLE; what was transcribed is kept', () => {
    const doc = build(finished({ audioUnavailable: true }), UNLABELLED);
    expect([doc.header.state, doc.header.partial_reason, doc.segments.length]).toEqual(['PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE', 4]);
  });

  it('no audio at all: PARTIAL with zero segments — not an empty transcript that looks complete', () => {
    const doc = buildTranscriptDocument({ checkpoint: { ...emptyCheckpoint(identity), audioComplete: true, audioUnavailable: true }, labelling: { ...UNLABELLED, reason: 'TOO_FEW_SEGMENTS', labels: [] }, model: MODEL_PROVENANCE, intervals: [] });
    expect([doc.header.state, doc.header.partial_reason, doc.segments, doc.header.chunks]).toEqual(['PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE', [], 0]);
  });

  it('a FAILED chunk: state PARTIAL, reason CHUNKS_FAILED, failed_chunks counted, and NO text for the failed stretch', () => {
    const checkpoint = finished();
    checkpoint.chunks[1] = chunk(1, null, ChunkStatus.FAILED);
    expect(failedChunkCount(checkpoint)).toBe(1);
    expect(committedSegments(checkpoint)).toHaveLength(2);
    const doc = build(checkpoint, { ...UNLABELLED, labels: [null, null] });
    expect([doc.header.state, doc.header.partial_reason, doc.header.failed_chunks, doc.header.chunks]).toEqual(['PARTIAL', 'CHUNKS_FAILED', 1, 2]);
    expect(doc.segments.map((segment) => segment.text)).toEqual(TEXTS.slice(0, 2));
  });

  it('both at once: the audio reason is named and the failed chunks are still counted', () => {
    const checkpoint = finished({ audioUnavailable: true });
    checkpoint.chunks[1] = chunk(1, null, ChunkStatus.FAILED);
    const doc = build(checkpoint, { ...UNLABELLED, labels: [null, null] });
    expect([doc.header.state, doc.header.partial_reason, doc.header.failed_chunks]).toEqual(['PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE', 1]);
  });

  it('NEGATIVE CONTROL: the complete transcript of the same session is ASSEMBLED with no reason', () => {
    expect([build().header.state, build().header.partial_reason, build().header.failed_chunks]).toEqual(['ASSEMBLED', null, 0]);
  });
});

describe('a document that contradicts itself is refused, never written', () => {
  const doc = build();
  const unlabelled = build(finished(), UNLABELLED);
  const cases: readonly (readonly [string, unknown])[] = [
    ['UNAVAILABLE that still carries one label', { ...unlabelled, segments: unlabelled.segments.map((segment, index) => (index === 2 ? { ...segment, speaker: 'A' } : segment)) }],
    ['UNAVAILABLE without the flag', { ...unlabelled, qa_flags: [] }],
    ['LABELLED that carries the unlabelled flag', { ...doc, qa_flags: ['speaker labels unavailable'] }],
    ['UNAVAILABLE without a reason', { ...unlabelled, header: { ...unlabelled.header, speaker_reason: null } }],
    ['LABELLED with a reason', { ...doc, header: { ...doc.header, speaker_reason: 'LOW_CONFIDENCE' } }],
    ['PARTIAL without a reason', { ...doc, header: { ...doc.header, state: 'PARTIAL' } }],
    ['ASSEMBLED with a failed chunk', { ...doc, header: { ...doc.header, failed_chunks: 1 } }],
    ['ASSEMBLED with a partial reason', { ...doc, header: { ...doc.header, partial_reason: 'CHUNKS_FAILED' } }],
    ['a third speaker label', { ...doc, segments: doc.segments.map((segment, index) => (index === 0 ? { ...segment, speaker: 'C' } : segment)) }],
    ['segments numbered out of order', { ...doc, segments: [...doc.segments].reverse() }],
    ['a segment that ends before it starts', { ...doc, segments: doc.segments.map((segment, index) => (index === 0 ? { ...segment, end_ms: 100 } : segment)) }],
    ['a time that is not whole milliseconds', { ...doc, segments: doc.segments.map((segment, index) => (index === 0 ? { ...segment, start_ms: 640.5 } : segment)) }],
    ['another document version', { ...doc, header: { ...doc.header, doc_version: 'dems.transcript/2' } }],
    ['another language', { ...doc, header: { ...doc.header, language: 'en' } }],
    ['an extra member', { ...doc, created_at: 1 }],
    ['an extra member of a segment', { ...doc, segments: doc.segments.map((segment) => ({ ...segment, avgLogprob: -0.2 })) }],
    ['unsorted qa flags', { ...unlabelled, qa_flags: ['vad_fallback', 'speaker labels unavailable'] }],
  ];

  it.each(cases)('%s', (_label, value) => {
    expect(TranscriptDocumentSchema.safeParse(value).success).toBe(false);
    expect(() => canonicalTranscriptJson(value as TranscriptDocument)).toThrow();
  });

  it('control: the two documents the cases were made from are valid', () => {
    expect(TranscriptDocumentSchema.safeParse(doc).success).toBe(true);
    expect(TranscriptDocumentSchema.safeParse(unlabelled).success).toBe(true);
  });

  it('a label map of another length than the segments is never applied in part', () => {
    expect(() => build(finished(), { ...LABELLED, labels: ['A', 'B', 'A'] })).toThrow(RangeError);
  });
});

describe('canonicalisation and hash (§A.5 "Document hash": sorted keys, UTF-8)', () => {
  // A small document, written out. Its canonical text is the literal below, written by hand from
  // the rule (members sorted by key, no whitespace, JSON string escapes, UTF-8).
  const small: TranscriptDocument = TranscriptDocumentSchema.parse({
    qa_flags: ['speaker labels unavailable'],
    intervals: [{ to_ms: null, from_ms: 0, source: 'MIC-01' }],
    speaker_state: 'UNAVAILABLE',
    segments: [{ text: 'Saya "hadir" — café.', speaker: null, end_ms: 2500, start_ms: 640, index: 0 }],
    header: {
      speaker_reason: 'ENGINE_NOT_CONFIGURED',
      state: 'ASSEMBLED',
      session_id: 'SES-20261009-0078',
      partial_reason: null,
      model: { version: '1', sha256: 'c'.repeat(64), quantisation: 'none', name: 'stand-in-model', id: 'stand-in-model' },
      language: 'id',
      failed_chunks: 0,
      doc_version: 'dems.transcript/1',
      diarization: { num_speakers: 0, engine: null, confidence: null },
      chunks: 1,
      backend: 'cpu-local',
      audio: { sample_rate_hz: 24000, kind: 'DECODED_FILE' },
    },
  });
  const SMALL_CANONICAL =
    '{"header":{"audio":{"kind":"DECODED_FILE","sample_rate_hz":24000},"backend":"cpu-local","chunks":1,"diarization":{"confidence":null,"engine":null,"num_speakers":0},"doc_version":"dems.transcript/1","failed_chunks":0,"language":"id","model":{"id":"stand-in-model","name":"stand-in-model","quantisation":"none","sha256":"' +
    'c'.repeat(64) +
    '","version":"1"},"partial_reason":null,"session_id":"SES-20261009-0078","speaker_reason":"ENGINE_NOT_CONFIGURED","state":"ASSEMBLED"},"intervals":[{"from_ms":0,"source":"MIC-01","to_ms":null}],"qa_flags":["speaker labels unavailable"],"segments":[{"end_ms":2500,"index":0,"speaker":null,"start_ms":640,"text":"Saya \\"hadir\\" — café."}],"speaker_state":"UNAVAILABLE"}';
  /** `python3 -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())"` over the UTF-8 bytes of the literal above. */
  const SMALL_SHA256 = 'a93aeaa4dbf00cef4fd1ac6c2f5ed861f5a2e9d09a3cd450880abe5c7942201b';

  it('the canonical text of a written-out document is exactly the text the rule gives, and its SHA-256 is the one computed outside this code', () => {
    expect(canonicalTranscriptJson(small)).toBe(SMALL_CANONICAL);
    expect(transcriptDocumentSha256(small)).toBe(SMALL_SHA256);
    expect(sha256HexOfText(SMALL_CANONICAL)).toBe(SMALL_SHA256);
  });

  it('the text is UTF-8: a non-ASCII letter is its two bytes, not an escape; no byte-order mark, no final line break', () => {
    const bytes = Buffer.from(canonicalTranscriptJson(small), 'utf8');
    expect(bytes.includes(Buffer.from([0xc3, 0xa9]))).toBe(true); // é
    expect(bytes.includes(Buffer.from([0xe2, 0x80, 0x94]))).toBe(true); // —
    expect(canonicalTranscriptJson(small)).not.toMatch(/\\u00e9|\s$|^﻿/);
    expect(bytes[0]).toBe(0x7b);
    expect(bytes[bytes.length - 1]).toBe(0x7d);
  });

  it('stable across two builds from the same committed chunks and labels', () => {
    const a = renderTranscript(build());
    const b = renderTranscript(build());
    expect(a.json).toBe(b.json);
    expect([a.sha256, a.srtSha256, a.vttSha256]).toEqual([b.sha256, b.srtSha256, b.vttSha256]);
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('stable across KEY ORDER: every object written with its members reversed gives the same bytes and the same hash', () => {
    const doc = build();
    const reversed = reversedKeys(doc) as TranscriptDocument;
    expect(Object.keys(reversed)).toEqual(Object.keys(doc).reverse());
    expect(JSON.stringify(reversed)).not.toBe(JSON.stringify(doc)); // the plain serialisation DOES differ…
    expect(canonicalTranscriptJson(reversed)).toBe(canonicalTranscriptJson(doc)); // …the canonical one does not
    expect(transcriptDocumentSha256(reversed)).toBe(transcriptDocumentSha256(doc));
  });

  it('the order of SEGMENTS is content, not presentation: it is kept, and the index of a segment is part of the hash', () => {
    expect(canonicalTranscriptJson(build()).indexOf(TEXTS[0] as string)).toBeLessThan(canonicalTranscriptJson(build()).indexOf(TEXTS[1] as string));
  });

  const base = transcriptDocumentSha256(build());
  const oneCharacter: readonly (readonly [string, (doc: TranscriptDocument) => void])[] = [
    ['one letter of one text (a -> e)', (doc) => void ((doc.segments[1] as { text: string }).text = 'Selamat pagi, terima kesih.')],
    ['one letter changed in case', (doc) => void ((doc.segments[0] as { text: string }).text = 'selamat pagi.')],
    ['one trailing blank added to a text', (doc) => void ((doc.segments[0] as { text: string }).text = 'Selamat pagi. ')],
    ['one digit of one time', (doc) => void ((doc.segments[0] as { start_ms: number }).start_ms = 641)],
    ['one speaker label (A -> B)', (doc) => void ((doc.segments[0] as { speaker: string }).speaker = 'B')],
    ['one character of the session id', (doc) => void ((doc.header as { session_id: string }).session_id = 'SES-20261009-0079')],
    ['one character of the model hash', (doc) => void ((doc.header.model as { sha256: string }).sha256 = `d${'c'.repeat(63)}`)],
    ['one digit of the confidence', (doc) => void ((doc.header.diarization as { confidence: number }).confidence = 0.813)],
    ['one interval boundary', (doc) => void ((doc.intervals[0] as { to_ms: number }).to_ms = 9_001)],
  ];

  it.each(oneCharacter)('ONE changed character changes the hash: %s', (_label, change) => {
    const doc = structuredClone(build());
    change(doc);
    const changed = transcriptDocumentSha256(doc);
    expect(changed).toMatch(/^[0-9a-f]{64}$/);
    expect(changed).not.toBe(base);
  });

  it('control of that check: an unchanged copy has the same hash', () => {
    expect(transcriptDocumentSha256(structuredClone(build()))).toBe(base);
  });

  it('LABELLED and UNAVAILABLE documents of the same text have different hashes (the state is sealed with the text)', () => {
    expect(transcriptDocumentSha256(build(finished(), UNLABELLED))).not.toBe(base);
  });
});

describe('renderings (dbc-3 §B.8 `srt_sha256`, `vtt_sha256`): pure functions of the document', () => {
  it('SubRip: numbered cues, comma before the milliseconds, the label in brackets', () => {
    expect(renderSrt(build())).toBe(
      '1\n00:00:00,640 --> 00:00:04,240\n[A] Selamat pagi.\n\n' +
        '2\n00:00:04,960 --> 00:00:07,840\n[B] Selamat pagi, terima kasih.\n\n' +
        '3\n00:00:10,500 --> 00:00:12,380\n[A] Tolong jelaskan peran Anda.\n\n' +
        '4\n00:00:13,080 --> 00:00:18,720\n[B] Saya operator "penerimaan" barang — café.\n\n',
    );
  });

  it('WebVTT: the header, a full stop before the milliseconds, a voice span, markup characters escaped', () => {
    const checkpoint = finished();
    const first = checkpoint.chunks[0]?.segments?.[0];
    if (first === undefined) throw new Error('unreachable');
    first.text = 'a < b & c --> d\nbaris dua';
    const doc = build(checkpoint);
    expect(renderVtt(doc).split('\n\n').slice(0, 2)).toEqual(['WEBVTT', '1\n00:00:00.640 --> 00:00:04.240\n<v A>a &lt; b &amp; c -&gt; d baris dua']);
    expect(renderSrt(doc).split('\n\n')[0]).toBe('1\n00:00:00,640 --> 00:00:04,240\n[A] a < b & c -> d baris dua');
  });

  it('unlabelled: no bracket and no voice span; an hour is carried into the hours field', () => {
    const checkpoint = finished();
    const last = checkpoint.chunks[1]?.segments?.[1];
    if (last === undefined) throw new Error('unreachable');
    last.startMs = 3_723_004;
    last.endMs = 3_725_050;
    const doc = build(checkpoint, UNLABELLED);
    expect(renderSrt(doc)).toContain('4\n01:02:03,004 --> 01:02:05,050\nSaya operator');
    expect(renderVtt(doc)).not.toMatch(/<v /);
    expect(renderSrt(doc)).not.toMatch(/\[[AB]\]/);
  });

  it('the seal record carries the three hashes, the model provenance, the diarization outcome and the PARTIAL state, in the manifest names', () => {
    const checkpoint = finished({ audioUnavailable: true });
    const doc = build(checkpoint, { ...UNLABELLED, reason: 'LOW_CONFIDENCE', numSpeakers: 2, confidence: 0.31 });
    const rendered = renderTranscript(doc);
    expect(sealRecordOf(doc, rendered)).toEqual({
      docVersion: 'dems.transcript/1',
      jsonSha256: rendered.sha256,
      srtSha256: rendered.srtSha256,
      vttSha256: rendered.vttSha256,
      model: { name: 'stand-in-model', version: '1', quantisation: 'none', modelSha256: 'c'.repeat(64), params: { backend: 'cpu-local', modelId: 'stand-in-model', language: 'id' } },
      diarization: { numSpeakers: 2, status: 'UNAVAILABLE', confidence: 0.31, reason: 'LOW_CONFIDENCE' },
      labelsStatus: 'UNAVAILABLE',
      state: 'PARTIAL',
      partialReason: 'TRANSCRIPT_AUDIO_UNAVAILABLE',
      failedChunks: 0,
    });
    expect(new Set([rendered.sha256, rendered.srtSha256, rendered.vttSha256]).size).toBe(3);
  });
});
