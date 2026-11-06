// M6-LB-1 — speaker state behaviour (test strategy §A.6; transcript spec §A.4; D226 labels part;
// ruling D90: no segmentation model): "diarizer loaded -> LABELLED with 2 speakers; diarizer
// absent -> UNAVAILABLE with the flag `speaker labels unavailable` — both paths unit-tested"
// (model stubbed).
//
// Three layers, no model anywhere:
//   1. the RULE (`clusterInTwo`, `labelSegments`): what makes LABELLED, and every way to UNAVAILABLE;
//   2. the ENGINE module against a stand-in PROGRAM (a real process): the command, the strict
//      reading of its output, the files it refuses before any process exists;
//   3. the POST-PASS: never throws, embeds only segments that are long enough, hands the engine
//      exactly their audio, and leaves no audio file behind.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMemoryLog } from '../log';
import { openPcmSource } from '../pipeline/audio-source';
import { DIARIZATION_CLUSTER_THRESHOLD, DIARIZATION_MAX_SPEAKERS, DIARIZATION_MIN_EMBED_MS, DIARIZATION_MIN_SEGMENTS, SPEAKER_LABELS_UNAVAILABLE_FLAG } from '../pipeline/constants';
import {
  LICENCE_NOT_CLEARED_MARKER,
  NOT_CLEARED_MODEL_SHA256,
  SpeakerState,
  SpeakerUnavailableReason,
  buildEmbedArgs,
  clusterInTwo,
  createSpeakerEmbedder,
  labelSegments,
  licenceMarkerNear,
  parseEmbedOutput,
  resolveSpeakerEmbedderConfig,
  runDiarizationPass,
  type SpeakerEmbedderRuntime,
  type SpeakerEmbedding,
} from '../pipeline/diarization';
import { captureTapTimeline } from '../pipeline/media-time';
import { TranscriberError, TranscriberErrorCode } from '../types';
import { NO_CAPTURE_WORKER, STUB_FACTS, alternatingVoices, createEmbedHome, createStubEmbedder, looseVoices, voice } from './diarization-support';
import { TAP_RATE, tonePcm, writeTap } from './pipeline-support';
import { EXPECTED_ENGINE_NICE, HOST_LOWERS_PRIORITY, errorRecords, scratchDir } from './support';

const SIX = alternatingVoices(6);

describe('the constants are the proposals of the spec (§0.2) and of this row', () => {
  it('two speakers, threshold 0.5, at least four segments, a 1.5 s minimum for an embedding, and the exact flag text', () => {
    expect([DIARIZATION_MAX_SPEAKERS, DIARIZATION_CLUSTER_THRESHOLD, DIARIZATION_MIN_SEGMENTS, DIARIZATION_MIN_EMBED_MS]).toEqual([2, 0.5, 4, 1_500]);
    expect(SPEAKER_LABELS_UNAVAILABLE_FLAG).toBe('speaker labels unavailable');
  });
});

describe('M6-LB-1 the rule: two voices -> LABELLED with 2 speakers', () => {
  it('two voices taking turns: every segment carries A or B, A is whoever speaks first', () => {
    const result = labelSegments(SIX, STUB_FACTS);
    expect(result).toMatchObject({ state: 'LABELLED', reason: null, numSpeakers: 2, labels: ['A', 'B', 'A', 'B', 'A', 'B'], engine: STUB_FACTS });
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('stable naming: the SAME conversation with the other voice speaking first still starts with A', () => {
    const swapped = SIX.map((_, index) => voice(((index + 1) % 2) as 0 | 1, index));
    expect(labelSegments(swapped).labels).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
    // …and an uneven conversation keeps its order of turns.
    const uneven = [voice(1, 0), voice(1, 1), voice(0, 2), voice(1, 3), voice(0, 4), voice(0, 5)];
    expect(labelSegments(uneven).labels).toEqual(['A', 'A', 'B', 'A', 'B', 'B']);
  });

  it('deterministic: the same embeddings give the same labels and the same confidence, call after call; the length of a vector does not matter', () => {
    const first = labelSegments(SIX);
    for (let run = 0; run < 5; run += 1) expect(labelSegments(SIX)).toEqual(first);
    expect(labelSegments(SIX.map((vector) => vector.map((value) => value * 37.5)))).toEqual(first);
  });

  it('a segment without an embedding (too short, or too little audio) gets NO label in a LABELLED document — never its neighbour\'s', () => {
    const withGaps: SpeakerEmbedding[] = [SIX[0] as number[], null, SIX[2] as number[], SIX[3] as number[], null, SIX[5] as number[], SIX[1] as number[]];
    const result = labelSegments(withGaps);
    expect([result.state, result.labels]).toEqual(['LABELLED', ['A', null, 'A', 'B', null, 'B', 'B']]);
  });
});

describe('M6-LB-1 the rule: every doubt is UNAVAILABLE, with its reason and with NO label at all', () => {
  const cases: readonly (readonly [string, SpeakerUnavailableReason, number, readonly SpeakerEmbedding[]])[] = [
    ['fewer than four embedded segments', 'TOO_FEW_SEGMENTS', 0, SIX.slice(0, 3)],
    ['six segments of which only three have an embedding', 'TOO_FEW_SEGMENTS', 0, [SIX[0] as number[], null, SIX[2] as number[], null, null, SIX[5] as number[]]],
    ['one voice only (every take of voice 0)', 'NOT_TWO_SPEAKERS', 1, Array.from({ length: 6 }, (_, index) => voice(0, index))],
    ['two voices that this model hears as nearly the same', 'NOT_TWO_SPEAKERS', 1, SIX.map((vector, index) => vector.map((value, d) => value + (d === 3 ? 0 : 40) + (index % 2) * 0.5))],
    ['a second voice that is one single segment', 'SINGLETON_CLUSTER', 2, [voice(0, 0), voice(0, 1), voice(1, 2), voice(0, 3), voice(0, 4), voice(0, 5)]],
    ['three voices (one "speaker" of the split is two voices folded together)', 'NOT_TWO_SPEAKERS', 2, [voice(0, 0), voice(1, 1), voice(2, 2), voice(0, 3), voice(1, 4), voice(2, 5)]],
    ['a voice that is not the same from turn to turn (the shape of the sealed fixture: wide scatter inside each cluster)', 'NOT_TWO_SPEAKERS', 2, alternatingVoices(8, 0.6)],
    ['two groups that are tight enough and far enough apart, but not clearly enough (silhouette 0.43)', 'LOW_CONFIDENCE', 2, looseVoices()],
  ];

  it.each(cases)('%s -> %s (numSpeakers %i)', (_label, reason, numSpeakers, embeddings) => {
    const result = labelSegments(embeddings, STUB_FACTS);
    expect([result.state, result.reason, result.numSpeakers]).toEqual([SpeakerState.UNAVAILABLE, reason, numSpeakers]);
    expect(result.labels).toEqual(embeddings.map(() => null));
  });

  it('the two thresholds are boundaries that can be crossed, in both directions', () => {
    // Separation: two tight groups at a chosen angle. cos 0.45 -> distance 0.55 (two speakers); cos 0.55 -> 0.45 (not).
    const at = (cosine: number): number[][] => Array.from({ length: 6 }, (_, index) => (index % 2 === 0 ? [1, 0] : [cosine, Math.sqrt(1 - cosine * cosine)]));
    expect([labelSegments(at(0.45)).state, labelSegments(at(0.55)).reason]).toEqual(['LABELLED', 'NOT_TWO_SPEAKERS']);
    // Confidence: the same two voices with more and more scatter inside each.
    const states = [0.05, 0.2, 0.6].map((wobble) => labelSegments(alternatingVoices(8, wobble)));
    expect(states.map((entry) => entry.state)).toEqual(['LABELLED', 'LABELLED', 'UNAVAILABLE']);
    expect(states.map((entry) => entry.confidence as number)).toEqual(states.map((entry) => entry.confidence as number).sort((a, b) => b - a));
    expect((states[2]?.confidence ?? 1) < DIARIZATION_CLUSTER_THRESHOLD && (states[1]?.confidence ?? 0) >= DIARIZATION_CLUSTER_THRESHOLD).toBe(true);
  });

  it('clusterInTwo: separation, sizes and silhouette of a known layout; null for what cannot be split', () => {
    const clusters = clusterInTwo([[1, 0], [0, 1], [1, 0], [0, 1]]);
    expect(clusters).toEqual({ assignment: [0, 1, 0, 1], separation: 1, confidence: 1, sizes: [2, 2], spread: [0, 0] });
    expect(clusterInTwo([[1, 0]])).toBeNull();
    expect(clusterInTwo([[1, 0], [1, 0, 0]])).toBeNull();
  });
});

describe('the engine output is read strictly (an answer that is not fully understood is not used in part)', () => {
  const good = 'dems-speaker-embed 1\ndim 3\n0 ok 1 -2.5 3e-2\n1 short\n2 ok 0 0 1\nend 3\n';

  it('reads vectors and `short` lines in span order', () => {
    expect(parseEmbedOutput(good, 3)).toEqual([[1, -2.5, 0.03], null, [0, 0, 1]]);
  });

  it.each([
    ['another head line', good.replace('dems-speaker-embed 1', 'dems-speaker-embed 2')],
    ['no `end` line', good.replace('end 3\n', '')],
    ['an `end` that states another count', good.replace('end 3', 'end 2')],
    ['a vector with one number too few', good.replace('0 ok 1 -2.5 3e-2', '0 ok 1 -2.5')],
    ['a number that is not one', good.replace('3e-2', 'nan')],
    ['spans out of order', good.replace('2 ok', '1 ok')],
    ['a line in between that is something else', good.replace('1 short\n', '1 short\nwarning\n')],
    ['no dimension', good.replace('dim 3', 'dim 0')],
  ])('%s is refused as a whole', (_label, printed) => {
    expect(parseEmbedOutput(printed, 3)).toBeNull();
  });

  it('an answer for another number of spans than was asked is refused', () => {
    expect(parseEmbedOutput(good, 2)).toBeNull();
  });
});

describe('the engine module, against a stand-in program (a real process)', () => {
  function setup(modelName = 'embedding.onnx'): { home: ReturnType<typeof createEmbedHome>; runtime: SpeakerEmbedderRuntime; pcm: string; log: ReturnType<typeof createMemoryLog> } {
    const home = createEmbedHome();
    home.setVectors(SIX);
    const runtime: SpeakerEmbedderRuntime = { binaryPath: home.binary, embeddingModelPath: home.modelFile(modelName), embeddingModel: 'stand-in-embedding', priority: home.priority };
    const pcm = join(home.root, 'segments.pcm');
    writeFileSync(pcm, Buffer.alloc(48_000 * 2 * 6));
    return { home, runtime, pcm, log: createMemoryLog() };
  }
  const SPANS = [0, 1, 2, 3, 4, 5].map((index) => ({ from: index * 48_000, to: (index + 1) * 48_000 }));

  it('the command names the model, the rate, the audio file and the spans file — and nothing that could select another provider', () => {
    const { runtime } = setup();
    const args = buildEmbedArgs(resolveSpeakerEmbedderConfig(runtime), '/work/a.pcm', 48_000, '/work/a.pcm.spans');
    expect(args).toEqual(['--model', runtime.embeddingModelPath, '--rate', '48000', '--pcm', '/work/a.pcm', '--spans', '/work/a.pcm.spans']);
  });

  it('a run: the process got that command and the spans, ran lowered, and its vectors come back with the hash of the model file; the spans file is gone', async () => {
    const { home, runtime, pcm, log } = setup();
    const runs: { argv: readonly string[]; status: number | null; vectors: number | null; nice: number | null }[] = [];
    const engine = createSpeakerEmbedder(resolveSpeakerEmbedderConfig(runtime), { log, captureWorkerPid: NO_CAPTURE_WORKER, onEngineRun: (run) => runs.push(run) });
    const answer = await engine.embed(pcm, 48_000, SPANS, 'SES-1');
    expect(answer.vectors).toEqual(SIX);
    expect(answer.facts).toMatchObject({ engine: 'sherpa-onnx', embeddingModel: 'stand-in-embedding' });
    expect(answer.facts.embeddingModelSha256).toMatch(/^[0-9a-f]{64}$/);
    const journal = home.journal();
    expect(journal).toHaveLength(1);
    expect(journal[0]?.args).toEqual(buildEmbedArgs(resolveSpeakerEmbedderConfig(runtime), pcm, 48_000, `${pcm}.spans`));
    expect(journal[0]?.spans).toEqual(SPANS.map((span) => `${span.from} ${span.to}`));
    expect(runs[0]?.argv.slice(0, 4)).toEqual(['/usr/bin/nice', '-n', '10', home.binary]);
    expect([runs[0]?.status, runs[0]?.vectors]).toEqual([0, 6]);
    if (HOST_LOWERS_PRIORITY) expect([journal[0]?.nice, runs[0]?.nice]).toEqual([EXPECTED_ENGINE_NICE, EXPECTED_ENGINE_NICE]);
    expect(existsSync(`${pcm}.spans`)).toBe(false);
    expect(errorRecords(log)).toEqual([]);
  });

  const refusals: readonly (readonly [string, SpeakerUnavailableReason, (context: ReturnType<typeof setup>) => SpeakerEmbedderRuntime, boolean])[] = [
    ['the model file is absent', 'MODEL_ABSENT', ({ runtime }) => ({ ...runtime, embeddingModelPath: `${runtime.embeddingModelPath}.missing` }), false],
    ['the engine executable is absent', 'ENGINE_NOT_FOUND', ({ runtime }) => ({ ...runtime, binaryPath: `${runtime.binaryPath}.missing` }), false],
    ['the nice program is absent', 'ENGINE_NOT_FOUND', ({ runtime }) => ({ ...runtime, nicePath: '/nonexistent/nice' }), false],
    [
      'the licence marker lies beside the model',
      'MODEL_LICENCE_NOT_CLEARED',
      ({ home, runtime }) => {
        const path = home.modelFile('model.onnx', 'x', 'marked');
        writeFileSync(join(home.root, 'marked', LICENCE_NOT_CLEARED_MARKER), 'not cleared');
        return { ...runtime, embeddingModelPath: path };
      },
      false,
    ],
    [
      'the licence marker lies one directory above the model (the layout of the uncleared assets on this host)',
      'MODEL_LICENCE_NOT_CLEARED',
      ({ home, runtime }) => {
        const path = home.modelFile('model.onnx', 'x', 'segmentation/asset-v1');
        writeFileSync(join(home.root, 'segmentation', LICENCE_NOT_CLEARED_MARKER), 'not cleared');
        return { ...runtime, embeddingModelPath: path };
      },
      false,
    ],
    ['the engine ends with an error (a model that does not load)', 'ENGINE_FAILED', ({ home, runtime }) => ({ ...runtime, embeddingModelPath: home.modelFile('exit3.onnx') }), true],
    ['the engine prints a line that is not its output form', 'ENGINE_OUTPUT_UNREADABLE', ({ home, runtime }) => ({ ...runtime, embeddingModelPath: home.modelFile('garbage.onnx') }), true],
    ['the engine prints no `end` line (it was cut off)', 'ENGINE_OUTPUT_UNREADABLE', ({ home, runtime }) => ({ ...runtime, embeddingModelPath: home.modelFile('noend.onnx') }), true],
    ['the engine states another dimension than its vectors have', 'ENGINE_OUTPUT_UNREADABLE', ({ home, runtime }) => ({ ...runtime, embeddingModelPath: home.modelFile('baddim.onnx') }), true],
    ['the engine hangs past its bound', 'ENGINE_FAILED', ({ home, runtime }) => ({ ...runtime, embeddingModelPath: home.modelFile('hold.onnx'), timeoutMs: 400 }), true],
  ];

  it.each(refusals)('%s -> DIARIZATION_FAILED / %s, logged; a process existed: %s', async (_label, reason, change, processExisted) => {
    const context = setup();
    const engine = createSpeakerEmbedder(resolveSpeakerEmbedderConfig(change(context)), { log: context.log, captureWorkerPid: NO_CAPTURE_WORKER });
    let caught: unknown;
    try {
      await engine.embed(context.pcm, 48_000, SPANS, 'SES-1');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TranscriberError);
    expect((caught as TranscriberError).code).toBe(TranscriberErrorCode.DIARIZATION_FAILED);
    expect((caught as TranscriberError).detail['reason']).toBe(reason);
    expect(context.home.journal().length).toBe(processExisted ? 1 : 0);
    const errors = errorRecords(context.log);
    expect(errors).toHaveLength(1);
    expect([errors[0]?.context['reason'], errors[0]?.correlationId]).toEqual([reason, 'SES-1']);
    expect(existsSync(`${context.pcm}.spans`)).toBe(false);
  });

  it('control of the licence guard: the same model file WITHOUT a marker runs; the deny list holds four hashes', async () => {
    const context = setup();
    const path = context.home.modelFile('model.onnx', 'x', 'segmentation/asset-v1');
    expect(licenceMarkerNear(path)).toBe(false);
    const engine = createSpeakerEmbedder(resolveSpeakerEmbedderConfig({ ...context.runtime, embeddingModelPath: path }), { log: context.log, captureWorkerPid: NO_CAPTURE_WORKER });
    expect((await engine.embed(context.pcm, 48_000, SPANS)).vectors).toHaveLength(6);
    expect(NOT_CLEARED_MODEL_SHA256).toHaveLength(4);
    expect(NOT_CLEARED_MODEL_SHA256.every((value) => /^[0-9a-f]{64}$/.test(value))).toBe(true);
  });

  it('the sibling rule (§C): judged from what the operating system reports for the stated worker', async () => {
    if (!HOST_LOWERS_PRIORITY) return; // the complementary block of M6-CP-1 covers a host that forbids it
    const context = setup();
    // This very process stands in for a capture worker: an engine at +10 is below it (allowed).
    const allowed = createSpeakerEmbedder(resolveSpeakerEmbedderConfig(context.runtime), { log: context.log, captureWorkerPid: () => process.pid });
    expect((await allowed.embed(context.pcm, 48_000, SPANS)).vectors).toHaveLength(6);
  });

  it.each([
    ['a relative engine path', { binaryPath: 'bin/engine' }, 'DIARIZATION_BINARY_PATH_NOT_ABSOLUTE'],
    ['a relative model path', { embeddingModelPath: 'e.onnx' }, 'EMBEDDING_MODEL_PATH_NOT_ABSOLUTE'],
    ['a model identifier with a path in it', { embeddingModel: '../x' }, 'DIARIZATION_MODEL_ID_INVALID'],
    ['an unknown priority mode', { priority: 'never' as never }, 'PRIORITY_MODE_UNKNOWN'],
  ])('configuration: %s is CONFIG_INVALID', (_label, change, reason) => {
    const { runtime } = setup();
    let caught: unknown;
    try {
      resolveSpeakerEmbedderConfig({ ...runtime, ...change });
    } catch (error) {
      caught = error;
    }
    expect([(caught as TranscriberError).code, (caught as TranscriberError).detail['reason']]).toEqual([TranscriberErrorCode.CONFIG_INVALID, reason]);
  });
});

describe('M6-LB-1 the post-pass: diarizer loaded -> LABELLED; diarizer absent -> UNAVAILABLE; it never throws', () => {
  const tap = captureTapTimeline();
  /** Six segments of 4 s, 1 s apart, in media time; a seventh of 1 s (too short for an embedding). */
  const SEGMENTS = [...[0, 1, 2, 3, 4, 5].map((index) => ({ startMs: 1_021 + index * 5_000, endMs: 5_021 + index * 5_000 })), { startMs: 30_500, endMs: 31_500 }];
  const base = (engine: ReturnType<typeof createStubEmbedder> | null, enabled = true) => {
    const dir = scratchDir('pass');
    const path = writeTap(dir, tonePcm(32 * TAP_RATE, [{ from: TAP_RATE, to: 31 * TAP_RATE }]));
    const log = createMemoryLog();
    return { dir, log, options: { enabled, engine, source: openPcmSource({ container: 'raw', path, sampleRateHz: TAP_RATE }), timeline: tap, segments: SEGMENTS, workDir: join(dir, 'work'), log, correlationId: 'SES-1' } };
  };

  it('diarizer loaded: LABELLED, 2 speakers; the engine got exactly the audio of the six long segments at the rate of the tap; the short one has no label; no audio file is left', async () => {
    const engine = createStubEmbedder(SIX);
    const { dir, log, options } = base(engine);
    const result = await runDiarizationPass(options);
    expect(result).toMatchObject({ state: 'LABELLED', reason: null, numSpeakers: 2, labels: ['A', 'B', 'A', 'B', 'A', 'B', null], engine: STUB_FACTS });
    const fourSeconds = 4 * TAP_RATE;
    expect(engine.calls).toEqual([{ sampleRateHz: TAP_RATE, spans: [0, 1, 2, 3, 4, 5].map((index) => ({ from: index * fourSeconds, to: (index + 1) * fourSeconds })), pcmBytes: 6 * fourSeconds * 2 }]);
    expect(readdirSync(join(dir, 'work'))).toEqual([]);
    expect(errorRecords(log)).toEqual([]);
  });

  it('the samples handed over are those of the segment in the SEALED file: media time minus the origin of the tap', async () => {
    // A tap that is silent except for one burst that fills exactly segment 2 (media 11021..15021 ms = tap samples 528000..720000).
    const dir = scratchDir('pass');
    const path = writeTap(dir, tonePcm(32 * TAP_RATE, [{ from: 11 * TAP_RATE, to: 15 * TAP_RATE }]));
    let handed: Buffer | null = null;
    const engine = createStubEmbedder(SIX);
    const embed = engine.embed.bind(engine);
    engine.embed = async (pcmPath, rate, spans, id) => {
      handed = (await import('node:fs')).readFileSync(pcmPath);
      return embed(pcmPath, rate, spans, id);
    };
    await runDiarizationPass({ enabled: true, engine, source: openPcmSource({ container: 'raw', path, sampleRateHz: TAP_RATE }), timeline: tap, segments: SEGMENTS, workDir: join(dir, 'work'), log: createMemoryLog() });
    const samples = new Int16Array((handed as unknown as Buffer).buffer, (handed as unknown as Buffer).byteOffset, (handed as unknown as Buffer).length / 2);
    const fourSeconds = 4 * TAP_RATE;
    const loud = (from: number, to: number): number => samples.subarray(from, to).filter((value) => value !== 0).length;
    // Span 2 is the tone and its neighbours are silence. Segment times are WHOLE milliseconds and the
    // origin is 21.333 ms, so the span starts 16 samples (a third of a millisecond) before the burst:
    // exactly that, no more. An error of one frame (1024 samples) or of the whole origin would show.
    expect([loud(2 * fourSeconds, 3 * fourSeconds), loud(0, 2 * fourSeconds), loud(3 * fourSeconds, 6 * fourSeconds)]).toEqual([fourSeconds - 16, 0, 0]);
  });

  it('diarizer absent (no engine configured): UNAVAILABLE / ENGINE_NOT_CONFIGURED, no label, nothing thrown', async () => {
    expect(await runDiarizationPass(base(null).options)).toEqual({ state: 'UNAVAILABLE', reason: 'ENGINE_NOT_CONFIGURED', numSpeakers: 0, confidence: null, labels: SEGMENTS.map(() => null), engine: null });
  });

  it('switched off in the session configuration: UNAVAILABLE / DISABLED_BY_CONFIGURATION, and NO engine is started', async () => {
    const engine = createStubEmbedder(SIX);
    expect(await runDiarizationPass(base(engine, false).options)).toMatchObject({ state: 'UNAVAILABLE', reason: 'DISABLED_BY_CONFIGURATION' });
    expect(engine.calls).toEqual([]);
  });

  it('fewer than four segments that are long enough: UNAVAILABLE / TOO_FEW_SEGMENTS, and NO engine is started', async () => {
    const engine = createStubEmbedder(SIX);
    const { options } = base(engine);
    const short = SEGMENTS.map((segment, index) => (index < 3 ? segment : { startMs: segment.startMs, endMs: segment.startMs + DIARIZATION_MIN_EMBED_MS - 1 }));
    expect(await runDiarizationPass({ ...options, segments: short })).toMatchObject({ state: 'UNAVAILABLE', reason: 'TOO_FEW_SEGMENTS', labels: short.map(() => null) });
    expect(engine.calls).toEqual([]);
  });

  it('the minimum is a boundary: a segment of exactly 1500 ms is embedded, one of 1499 ms is not', async () => {
    const engine = createStubEmbedder(SIX);
    const { options } = base(engine);
    const segments = [...SEGMENTS.slice(0, 4), { startMs: 21_021, endMs: 22_521 }, { startMs: 26_021, endMs: 27_520 }];
    const result = await runDiarizationPass({ ...options, segments });
    expect(engine.calls[0]?.spans).toHaveLength(5);
    expect(result.labels).toEqual(['A', 'B', 'A', 'B', 'A', null]);
  });

  it.each(['MODEL_ABSENT', 'MODEL_LICENCE_NOT_CLEARED', 'ENGINE_NOT_FOUND', 'ENGINE_FAILED', 'ENGINE_OUTPUT_UNREADABLE', 'PRIORITY_NOT_APPLIED', 'ENGINE_NOT_BELOW_CAPTURE_WORKER'] as const)(
    'an engine that fails with %s: UNAVAILABLE with that reason, nothing thrown, no audio file left',
    async (reason) => {
      const engine = createStubEmbedder(SIX);
      engine.failure = new TranscriberError(TranscriberErrorCode.DIARIZATION_FAILED, 'the speaker-embedding engine gave no usable answer', { reason });
      const { dir, options } = base(engine);
      const result = await runDiarizationPass(options);
      expect(result).toMatchObject({ state: 'UNAVAILABLE', reason, numSpeakers: 0, engine: null });
      expect(result.labels.every((label) => label === null)).toBe(true);
      expect(readdirSync(join(dir, 'work'))).toEqual([]);
    },
  );

  it('an engine that crashes with anything else: UNAVAILABLE / ENGINE_FAILED, the crash is in the persistent log, no audio file left', async () => {
    const engine = createStubEmbedder(SIX);
    engine.failure = new Error('segfault');
    const { dir, log, options } = base(engine);
    expect(await runDiarizationPass(options)).toMatchObject({ state: 'UNAVAILABLE', reason: 'ENGINE_FAILED' });
    const errors = errorRecords(log);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ source: 'transcriber.diarization.pass', correlationId: 'SES-1' });
    expect(errors[0]?.stackTrace).toContain('segfault');
    expect(readdirSync(join(dir, 'work'))).toEqual([]);
  });

  it('an engine that answers for fewer spans than it was asked: UNAVAILABLE / ENGINE_OUTPUT_UNREADABLE (never labels by position)', async () => {
    const engine = createStubEmbedder(SIX.slice(0, 5));
    expect(await runDiarizationPass(base(engine).options)).toMatchObject({ state: 'UNAVAILABLE', reason: 'ENGINE_OUTPUT_UNREADABLE' });
  });

  it('audio that cannot be read: UNAVAILABLE / AUDIO_UNAVAILABLE, logged, and NO engine is started', async () => {
    const engine = createStubEmbedder(SIX);
    const { dir, log, options } = base(engine);
    const missing = openPcmSource({ container: 'raw', path: join(dir, 'no-such-tap.pcm'), sampleRateHz: TAP_RATE });
    expect(await runDiarizationPass({ ...options, source: missing })).toMatchObject({ state: 'UNAVAILABLE', reason: 'AUDIO_UNAVAILABLE' });
    expect(engine.calls).toEqual([]);
    expect(errorRecords(log)).toHaveLength(1);
  });

  it('the outcome is one info record of the persistent log, with the state and the reason and no duration', async () => {
    const { log, options } = base(null);
    await runDiarizationPass(options);
    const record = log.records().find((entry) => entry.source === 'transcriber.diarization.pass');
    expect(record).toMatchObject({ level: 'info', context: { state: 'UNAVAILABLE', reason: 'ENGINE_NOT_CONFIGURED', numSpeakers: 0, confidence: null, segments: 7, labelled: 0 } });
    expect(Object.keys(record?.context ?? {}).sort()).toEqual(['confidence', 'labelled', 'numSpeakers', 'reason', 'segments', 'state']);
  });
});
