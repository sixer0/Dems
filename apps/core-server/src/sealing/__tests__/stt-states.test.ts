// The seal-side transcript states of R-8 (blueprint row 116; ev §B.7a, §E.5; tx §B.7; D-EV-1):
// the SEAL CLAUSES of `M6-STTCFG-OFF` and `M6-STTCFG-UNREACH` on fakes, and the bounds of the step
// (`bounds.ts`). The verify clause is `M7-STTCFG-VERIFY` (row 119) and is not here.
//
// No database (that half is `stt-states.db.test.ts`), no process, no model, no oMLX. The
// transcript of every test is made by the REAL `@dems/transcriber` pipeline (`support.ts`); its
// engines are stand-ins, and "the backend" is the stand-in engine: one that refuses every chunk is
// a backend that refuses connections, one that never answers is a backend that hangs.
//
// NO TEST WAITS ON THE WALL CLOCK. The bounds are counted on `manualClock`: it moves when a test
// moves it, and a bound fires only when `seal` (below) sees that the question in flight is one the
// scenario made hang.
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXAMPLE_SOURCE_ROWS, TRANSCRIPT_DISABLED_REASON, buildUnsignedManifest, declaredPackageFiles, exampleManifestInput } from '@dems/shared/evidence-package';
import { STT_CHUNK_RETRIES, SerialQueue, TRANSCRIPT_CHECKPOINT_FILE, TranscriberError, createMemoryChunkMirror, createMemoryLog, renderTranscript, sealRecordOf, type TranscriptDocument } from '@dems/transcriber';
import { describe, expect, it } from 'vitest';
import { createMemorySnapshotStore, manifestSnapshotOf, openSessionTranscription, type CaptureFacts } from '../../transcription';
import {
  CLOSE_OUT_CHUNK_CODE,
  FINALIZE_TRANSCRIPT_LIMITS,
  FINALIZE_TRANSCRIPT_STEP,
  FinalizeTranscriptError,
  createTranscriptFileReader,
  evidenceTranscriptSummary,
  finalizeTranscript,
  limitsFault,
  readSealedTranscriptDocument,
  waitLimitOf,
  type AssembledTranscriptSource,
  type FinalizeTranscriptLimits,
  type FinalizeTranscriptPorts,
  type FinalizeTranscriptResult,
  type FinalizedTranscript,
  type SttConfigSnapshot,
} from '../index';
import { manualClock, memoryErrorLog, memoryJournal, snapshotOf, transcribedSession, type SessionOptions, type TranscribedSession } from './support';

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');
let counter = 0;
const nextSession = (): string => `SES-20261009-${String(8100 + (counter += 1)).padStart(4, '0')}`;

/** Small bounds for the tests: ten minutes for the step, one of them for closing out. */
const LIMITS: FinalizeTranscriptLimits = { stepLimitMs: 600_000, callLimitMs: 30_000, closeOutLimitMs: 60_000 };

type Done = Extract<FinalizeTranscriptResult, { status: 'DONE' }>;

interface Rig {
  readonly session: TranscribedSession;
  readonly mirror: ReturnType<typeof createMemoryChunkMirror>;
  readonly journal: ReturnType<typeof memoryJournal>;
  readonly log: ReturnType<typeof memoryErrorLog>;
  readonly clock: ReturnType<typeof manualClock>;
  readonly backend: SttConfigSnapshot['backend'];
  /** Questions of a seam that never answers and are still in flight (see `neverAnswers`). */
  hanging: number;
  ports(overrides?: Partial<FinalizeTranscriptPorts>): FinalizeTranscriptPorts;
  run(options?: { snapshot?: SttConfigSnapshot; attempt?: number; limits?: FinalizeTranscriptLimits; ports?: Partial<FinalizeTranscriptPorts> }): Promise<FinalizeTranscriptResult>;
  key: string;
}

function rig(options: Omit<SessionOptions, 'mirror'> = {}): Rig {
  const mirror = createMemoryChunkMirror();
  const session = transcribedSession(nextSession(), { ...options, mirror });
  const journal = memoryJournal();
  const log = memoryErrorLog();
  const clock = manualClock();
  const backend = options.backend ?? 'cpu-local';
  const ports = (overrides: Partial<FinalizeTranscriptPorts> = {}): FinalizeTranscriptPorts => ({ transcript: session.seam, chunkRows: mirror, files: createTranscriptFileReader(), journal, log, now: clock.now, timer: clock.timer, ...overrides });
  const self: Rig = {
    session,
    mirror,
    journal,
    log,
    clock,
    backend,
    hanging: 0,
    ports,
    key: `${session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`,
    run: (call = {}) => finalizeTranscript({ sessionId: session.sessionId, sttSnapshot: call.snapshot ?? snapshotOf({ backend }), attempt: call.attempt ?? 1, limits: call.limits ?? LIMITS }, ports(call.ports)),
  };
  return self;
}

/** A question that never answers. It is counted while it is in flight, until the step aborts it. */
function neverAnswers<T>(r: Rig, signal: AbortSignal | undefined): Promise<T> {
  r.hanging += 1;
  signal?.addEventListener('abort', () => void (r.hanging -= 1), { once: true });
  return new Promise<T>(() => undefined);
}

const turn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

type Settled = { readonly ok: true; readonly result: FinalizeTranscriptResult } | { readonly ok: false; readonly error: unknown };

/** ONE CALL of the step. The clock moves inside it only to the bound of a question that hangs. */
async function oneCall(r: Rig, run: () => Promise<FinalizeTranscriptResult>): Promise<Settled> {
  let settled: Settled | undefined;
  void run().then(
    (result) => void (settled = { ok: true, result }),
    (error: unknown) => void (settled = { ok: false, error }),
  );
  while (settled === undefined) {
    if (r.hanging > 0 && r.clock.armed() > 0) r.clock.fireNext();
    await turn();
  }
  return settled;
}

interface Sealed {
  readonly done: Done;
  /** Time on the clock from the first call of the step to its DONE answer. */
  readonly elapsedMs: number;
  readonly calls: number;
  readonly waiting: number;
  readonly failures: string[];
}

/**
 * HOW THE PIPELINE OF ROW 82 CALLS THE STEP: again and again until DONE, no later than the
 * `remainingWaitMs` of a WAITING answer and no slower than `pollMs`; a typed failure is asked
 * again like RECOVERY would. Fails the test when the step is not DONE after `maxCalls`.
 */
async function seal(r: Rig, options: { limits?: FinalizeTranscriptLimits; pollMs?: number; snapshot?: SttConfigSnapshot; ports?: Partial<FinalizeTranscriptPorts>; maxCalls?: number } = {}): Promise<Sealed> {
  const startedAt = r.clock.now();
  const pollMs = options.pollMs ?? 10_000;
  const failures: string[] = [];
  let waiting = 0;
  for (let calls = 1; calls <= (options.maxCalls ?? 400); calls += 1) {
    const settled = await oneCall(r, () => r.run({ limits: options.limits, snapshot: options.snapshot, ports: options.ports }));
    if (!settled.ok) {
      if (!(settled.error instanceof FinalizeTranscriptError)) throw settled.error;
      failures.push(settled.error.code);
      r.clock.advance(pollMs);
      continue;
    }
    if (settled.result.status === 'DONE') return { done: settled.result, elapsedMs: r.clock.now() - startedAt, calls, waiting, failures };
    waiting += 1;
    expect(settled.result.remainingWaitMs).toBeGreaterThan(0);
    r.clock.advance(Math.min(pollMs, settled.result.remainingWaitMs));
  }
  throw new Error('THE STEP WAITED FOR EVER: it was not DONE after the calls of this test');
}

function done(result: FinalizeTranscriptResult): Done {
  if (result.status !== 'DONE') throw new Error(`the step answered ${result.status}`);
  return result;
}

const textsOf = (r: Rig): string[] => (readSealedTranscriptDocument(readFileSync(r.session.files.json))?.segments ?? []).map((segment) => segment.text);

/** AGREED BY CONTRACT WITH ROW 83: the block goes through its builder and its cross-field rules as it is. */
const manifestWith = (transcript: FinalizedTranscript): ReturnType<typeof buildUnsignedManifest> => buildUnsignedManifest({ ...exampleManifestInput(), transcript: transcript.manifest }, EXAMPLE_SOURCE_ROWS);

/** Holds the stand-in engine at the chunk that starts after `fromMs` until `release` is called. */
function gateAfter(fromMs: number): { gate: (offsetMs: number) => Promise<void>; reached: Promise<void>; release: () => void } {
  let release: () => void = () => undefined;
  let reach: () => void = () => undefined;
  const held = new Promise<void>((resolve) => void (release = resolve));
  const reached = new Promise<void>((resolve) => void (reach = resolve));
  return {
    gate: async (offsetMs) => {
      if (offsetMs < fromMs) return;
      reach();
      await held;
    },
    reached,
    release: () => release(),
  };
}

/** What the transcriber did for a session: nothing of this may exist for a disabled one. */
async function transcriberWork(r: Rig): Promise<{ engineAttempts: number; chunkRows: number; checkpointFile: boolean; transcriptFiles: boolean }> {
  return {
    engineAttempts: r.session.decoded.length,
    chunkRows: (await r.mirror.read(r.session.sessionId)).length,
    checkpointFile: existsSync(join(r.session.dir, TRANSCRIPT_CHECKPOINT_FILE)),
    transcriptFiles: existsSync(r.session.files.json) || existsSync(r.session.files.srt) || existsSync(r.session.files.vtt),
  };
}
const NO_WORK = { engineAttempts: 0, chunkRows: 0, checkpointFile: false, transcriptFiles: false };

describe('M6-STTCFG-OFF (seal clause): STT disabled in the session snapshot', () => {
  it('a recording with STT disabled runs no transcriber work, touches no capture, and seals DISABLED / DISABLED_BY_CONFIGURATION at once', async () => {
    const r = rig();
    // THE SESSION-START SNAPSHOT of row 115, write-once, and the composition built from it.
    const snapshots = createMemorySnapshotStore();
    const taken = await snapshots.put({ sessionId: r.session.sessionId, takenAt: r.clock.now(), enabled: false, backend: 'cpu-local', endpoint: null, model: 'ggml-large-v3-turbo', language: 'id', diarization: true, credentialKind: null, revision: 3 });
    const touched: string[] = [];
    const capture: CaptureFacts = {
      status: () => {
        touched.push('capture.status');
        return { sessionId: null, workerPid: null, phase: 'IDLE' };
      },
      on: () => {
        touched.push('capture.on');
        return () => undefined;
      },
    };
    const dataDir = join(mkdtempSync(join(tmpdir(), 'dems-row116-')), 'never-created');
    const opened = await openSessionTranscription(
      {
        dataDir,
        host: () => {
          touched.push('host');
          throw new Error('the host file is not read for a disabled session');
        },
        snapshots,
        reveal: async () => {
          touched.push('credential');
          throw new Error('no credential is read for a disabled session');
        },
        capture,
        mirror: r.mirror,
        transcriberLog: createMemoryLog(),
        queue: new SerialQueue(),
        now: r.clock.now,
      },
      r.session.sessionId,
    );
    expect(opened.state).toBe('DISABLED');
    // NO VAD, NO STT, NO DIARIZATION, NO DIRECTORY, AND NOTHING ASKED OF CAPTURE.
    expect(touched).toEqual([]);
    expect(existsSync(dataDir)).toBe(false);
    expect(await transcriberWork(r)).toEqual(NO_WORK);

    // THE SEAL. Manifest field 123 is the five members of that snapshot (never the endpoint or a credential).
    const sttSnapshot = manifestSnapshotOf(taken);
    expect(Object.keys(sttSnapshot).sort()).toEqual(['backend', 'diarization', 'enabled', 'model', 'revision']);
    const before = r.clock.now();
    const result = done(await r.run({ snapshot: sttSnapshot, limits: FINALIZE_TRANSCRIPT_LIMITS }));

    // AT ONCE: the first call, no bound armed, no time passed, the transcriber not asked anything.
    expect([r.clock.now() - before, r.clock.armed(), r.session.seam.assembleCalls, r.session.seam.locateCalls, r.session.seam.closeOutCalls]).toEqual([0, 0, 0, 0, 0]);
    expect(result.resumed).toBe(false);
    expect(result.files).toBeNull();

    // FIELD BY FIELD (ev §B.7a "Disabled package shape"): 79-91 and 93-94 null, 92, 121, 122, 123.
    expect(result.transcript.manifest).toEqual({
      file: null, // 79
      docVersion: null, // 80
      sha256: null, // 81
      srtSha256: null, // 82
      vttSha256: null, // 83
      model: { name: null, version: null, quantisation: null, modelSha256: null }, // 84-87
      diarization: { numSpeakers: null, status: null, confidence: null }, // 88-90
      speakerState: null, // 91
      state: 'DISABLED', // 92
      failedChunks: null, // 93
      revisionHead: null, // 94
      disabledReason: 'DISABLED_BY_CONFIGURATION', // 121
      backendUnreachable: false, // 122
      configSnapshot: { enabled: false, backend: 'cpu-local', model: 'ggml-large-v3-turbo', diarization: true, revision: 3 }, // 123
    });
    // The reason is THE constant of the manifest schema, not a second spelling of it.
    expect(result.transcript.manifest.disabledReason).toBe(TRANSCRIPT_DISABLED_REASON);
    // Row 83's builder and its cross-field rules take the block as it is.
    expect(manifestWith(result.transcript).transcript).toMatchObject({ state: 'DISABLED', disabledReason: 'DISABLED_BY_CONFIGURATION', sha256: null });
    // Nothing else of a transcript leaves the step.
    expect(result.transcript).toMatchObject({ transcriptRow: null, partialReason: null, speakerReason: null, failedChunksByRows: null, waitLimitReached: false, counters: { chunks: 0, failedChunks: 0, segments: 0 }, itemColumns: { manifestVersion: 2, transcriptSha256: null, labelsStatus: null } });
    expect(evidenceTranscriptSummary(result.transcript.manifest, 0)).toMatchObject({ state: 'DISABLED', sha256: null, backendUnreachable: false });

    // AS FAR AS THE STEP GOES THE SESSION CAN BE SEALED: its journal row is DONE at 100 after ONE write.
    expect(r.journal.writes).toHaveLength(1);
    expect(r.journal.rows.get(r.key)).toMatchObject({ status: 'DONE', progress: 100, errorCode: null, attempt: 1 });
    expect(r.log.entries).toEqual([]);
    expect(await transcriberWork(r)).toEqual(NO_WORK);
  });

  it('R-5 "inside the sealed package" holds only when STT is enabled: a disabled seal names no transcript file, an enabled one names three', async () => {
    const off = done(await rig().run({ snapshot: snapshotOf({ enabled: false }) }));
    expect([off.files, off.transcript.manifest.file, off.transcript.itemColumns.transcriptSha256]).toEqual([null, null, null]);
    expect(declaredPackageFiles({ transcript: off.transcript.manifest.state !== 'DISABLED' }).filter((file) => file.startsWith('transcript/'))).toEqual([]);

    const on = rig();
    await on.session.finish();
    const sealed = done(await on.run());
    expect(sealed.files).toEqual(on.session.files);
    expect(sealed.transcript.manifest).toMatchObject({ state: 'ASSEMBLED', file: 'transcript/transcript.json', sha256: sha256(on.session.files.json), disabledReason: null, backendUnreachable: false });
    expect(declaredPackageFiles({ transcript: sealed.transcript.manifest.state !== 'DISABLED' }).filter((file) => file.startsWith('transcript/')).length).toBeGreaterThanOrEqual(3);
  });

  it('NEGATIVE CONTROL: a disabled session that STILL ran VAD/STT work is detected — by the check of this file and by the step, which records DISABLED and seals none of it', async () => {
    const r = rig();
    // The fault: the transcriber ran although the snapshot says disabled.
    await r.session.finish();
    await r.session.seam.assemble(r.session.sessionId);
    const work = await transcriberWork(r);
    expect(work).not.toEqual(NO_WORK);
    expect(work).toMatchObject({ engineAttempts: 3, chunkRows: 3, checkpointFile: true, transcriptFiles: true });

    const result = done(await r.run({ snapshot: snapshotOf({ enabled: false }) }));
    // The step says so in the persistent log, with a count and no text ...
    expect(r.log.entries).toMatchObject([{ level: 'error', source: 'sealing.finalizeTranscript', context: { reason: 'DISABLED_SESSION_HAS_CHUNK_ROWS', rows: 3, correlationId: r.session.sessionId } }]);
    expect(JSON.stringify(r.log.entries)).not.toContain('Keterangan');
    // ... and the seal is what the configuration of the session says: no transcript in it.
    expect(result.transcript.manifest).toMatchObject({ state: 'DISABLED', disabledReason: 'DISABLED_BY_CONFIGURATION', sha256: null, file: null });
    expect([result.files, result.transcript.transcriptRow]).toEqual([null, null]);
  });

  it('the seal of a disabled session does not depend on that check: chunk rows that cannot be read are logged, and the step is DONE all the same', async () => {
    const r = rig();
    const result = done(
      await r.run({
        snapshot: snapshotOf({ enabled: false }),
        ports: {
          chunkRows: {
            read: async () => {
              throw new Error('the connection is gone');
            },
          },
        },
      }),
    );
    expect(result.transcript.manifest.state).toBe('DISABLED');
    expect(r.log.entries).toMatchObject([{ level: 'warn', context: { reason: 'DISABLED_SESSION_NOT_CHECKED' } }]);
  });
});

describe('M6-STTCFG-UNREACH (seal clause): STT enabled, the backend refuses connections', () => {
  const unreachable = (): Error => new TranscriberError('UNREACHABLE', 'the transcriber backend could not be reached', { reason: 'UNREACHABLE' });

  it.each(['omlx-server', 'cpu-local'] as const)('%s: every chunk is tried 1 + STT_CHUNK_RETRIES times and given up; the seal is DONE at the first call: PARTIAL, three failed CHUNKS, backendUnreachable, not one word of text', async (backend) => {
    const r = rig({ backend, fail: unreachable });
    await r.session.finish();

    // THE BOUNDED RETRY (tx §B.7): 3 chunks x (1 + 2) attempts, then FAILED. Not one attempt more.
    expect(STT_CHUNK_RETRIES).toBe(2);
    expect(r.session.decoded).toHaveLength(3 * (1 + STT_CHUNK_RETRIES));

    const before = r.clock.now();
    const sealed = await seal(r, { limits: FINALIZE_TRANSCRIPT_LIMITS });
    // Sealing did not wait: one call, no WAITING answer, no time on the clock, no bound reached.
    expect([sealed.calls, sealed.waiting, sealed.failures, sealed.elapsedMs, r.clock.now() - before, r.session.seam.closeOutCalls]).toEqual([1, 0, [], 0, 0, 0]);

    const { transcript } = sealed.done;
    expect(transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 3, backendUnreachable: true, disabledReason: null, file: 'transcript/transcript.json', sha256: sha256(r.session.files.json), revisionHead: 0 });
    expect(transcript.manifest.configSnapshot).toEqual(snapshotOf({ backend }));
    // COUNTED BY THE CHUNK RULE: nine failed attempts are three failed chunks, in the document and in the rows.
    expect([transcript.partialReason, transcript.failedChunksByRows, transcript.waitLimitReached]).toEqual(['CHUNKS_FAILED', 3, false]);
    expect(transcript.counters).toEqual({ chunks: 3, failedChunks: 3, segments: 0 });
    // NO FABRICATED TEXT: the sealed document has no segment, and its renderings no cue.
    expect(textsOf(r)).toEqual([]);
    expect(readFileSync(r.session.files.srt, 'utf8').trim()).toBe('');
    expect(readFileSync(r.session.files.json, 'utf8')).not.toMatch(/Keterangan|tidak terdengar|\[\.\.\.\]/);
    // The package takes it: row 83's builder accepts the block (an unreachable backend seals PARTIAL).
    expect(manifestWith(transcript).transcript).toMatchObject({ state: 'PARTIAL', failedChunks: 3, backendUnreachable: true });
    expect(evidenceTranscriptSummary(transcript.manifest, 0)).toMatchObject({ state: 'PARTIAL', failedChunks: 3, backendUnreachable: true });
    expect(r.journal.rows.get(r.key)).toMatchObject({ status: 'DONE', progress: 100, errorCode: null });
  });

  it('the backend goes away DURING the session: what was committed before is sealed word for word, the rest is absent, and the flag is set', async () => {
    const r = rig({ backend: 'omlx-server', fail: (offsetMs) => (offsetMs > 40_000 ? unreachable() : null) });
    await r.session.finish();
    const { done: result, calls } = await seal(r);
    expect(calls).toBe(1);
    expect(result.transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 2, backendUnreachable: true });
    expect(result.transcript.counters).toEqual({ chunks: 3, failedChunks: 2, segments: 2 });
    expect(textsOf(r)).toEqual(['Keterangan saksi 1-0.', 'Keterangan saksi 1-1.']);
  });

  it('CONTROL: the same session with a backend that answers is ASSEMBLED with every word and no flag — the PARTIAL above is the backend, not the test', async () => {
    const r = rig({ backend: 'omlx-server' });
    await r.session.finish();
    expect(r.session.decoded).toHaveLength(3);
    const { transcript } = (await seal(r)).done;
    expect(transcript.manifest).toMatchObject({ state: 'ASSEMBLED', failedChunks: 0, backendUnreachable: false });
    expect(textsOf(r)).toHaveLength(6);
  });
});

describe('SEALING NEVER WAITS FOR EVER: the step is DONE within its bound whatever the transcriber does', () => {
  /** The chunk that starts at 50 s is the second of three. */
  const SECOND = 40_000;

  it('the backend HANGS on a chunk (it accepted the request and never answers): DONE within the bound, PARTIAL, the committed chunk sealed, the two others given up without text', async () => {
    const held = gateAfter(SECOND);
    const r = rig({ backend: 'omlx-server', engineGate: held.gate });
    void r.session.runner.step({ final: true });
    await held.reached;
    expect(r.session.decoded).toHaveLength(2);

    const sealed = await seal(r);
    expect(sealed.elapsedMs).toBeLessThanOrEqual(LIMITS.stepLimitMs);
    expect(sealed.elapsedMs).toBeGreaterThanOrEqual(waitLimitOf(LIMITS));
    expect(sealed.waiting).toBeGreaterThan(0);
    expect(sealed.failures).toEqual([]);

    const { transcript } = sealed.done;
    expect(transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 2, backendUnreachable: true, sha256: sha256(r.session.files.json) });
    expect([transcript.waitLimitReached, transcript.partialReason, transcript.failedChunksByRows]).toEqual([true, 'CHUNKS_FAILED', 2]);
    expect(transcript.counters).toEqual({ chunks: 3, failedChunks: 2, segments: 2 });
    expect(textsOf(r)).toEqual(['Keterangan saksi 1-0.', 'Keterangan saksi 1-1.']);

    // THE CLOSE-OUT asked no backend: the engine of the session was asked for nothing more, and
    // the two chunks went through the transcriber's own rule (1 + STT_CHUNK_RETRIES refusals each).
    expect([r.session.seam.closeOutCalls, r.session.seam.closeOutCodes]).toEqual([1, [CLOSE_OUT_CHUNK_CODE]]);
    expect(r.session.decoded).toHaveLength(2);
    expect(r.session.refused).toHaveLength(2 * (1 + STT_CHUNK_RETRIES));
    expect(manifestWith(transcript).transcript.state).toBe('PARTIAL');
    expect(r.journal.rows.get(r.key)).toMatchObject({ status: 'DONE', progress: 100, errorCode: null, checkpoint: { committed: true, waitLimitReached: true } });
    expect(r.log.entries.map((entry) => entry.context?.['reason'])).toContain('WAIT_LIMIT_REACHED');
  });

  it('the transcriber NEVER FINISHES (held back for ever, "not ready" at every call) — with the DEFAULT bounds of `bounds.ts`: DONE within them', async () => {
    const r = rig({ shouldPause: () => true });
    await r.session.runner.step({ final: true });
    expect(limitsFault(FINALIZE_TRANSCRIPT_LIMITS)).toBeNull();

    const sealed = await seal(r, { limits: FINALIZE_TRANSCRIPT_LIMITS, pollMs: FINALIZE_TRANSCRIPT_LIMITS.callLimitMs });
    expect(sealed.elapsedMs).toBeLessThanOrEqual(FINALIZE_TRANSCRIPT_LIMITS.stepLimitMs);
    expect(sealed.elapsedMs).toBe(waitLimitOf(FINALIZE_TRANSCRIPT_LIMITS));
    expect(sealed.done.transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 3, backendUnreachable: false });
    expect(sealed.done.transcript.waitLimitReached).toBe(true);
    expect(textsOf(r)).toEqual([]);
    // Not one chunk was decoded for the seal, by anybody.
    expect(r.session.decoded).toEqual([]);
  });

  it('the transcriber seam NEVER ANSWERS a question: every call returns at the bound of one question, and the step is DONE within its own', async () => {
    const r = rig({ backend: 'omlx-server' });
    await r.session.finish();
    const silent: AssembledTranscriptSource = { ...r.session.seam, assemble: (_sessionId, options) => neverAnswers(r, options?.signal), closeOut: (sessionId, options) => r.session.seam.closeOut(sessionId, options) };

    // ONE CALL: it comes back when its bound fires — WAITING, with the question aborted.
    const first = await oneCall(r, () => r.run({ ports: { transcript: silent } }));
    expect(first).toMatchObject({ ok: true, result: { status: 'WAITING', remainingWaitMs: waitLimitOf(LIMITS) - LIMITS.callLimitMs } });
    expect([r.clock.now() - 1_791_529_000_000, r.hanging, r.clock.armed()]).toEqual([LIMITS.callLimitMs, 0, 0]);
    expect(r.log.entries).toMatchObject([{ level: 'warn', context: { reason: 'ASSEMBLE_NO_ANSWER' } }]);

    const sealed = await seal(r, { ports: { transcript: silent } });
    expect(sealed.elapsedMs + LIMITS.callLimitMs).toBeLessThanOrEqual(LIMITS.stepLimitMs);
    // The transcript WAS finished behind the silent seam: the close-out hands over all of it.
    expect(sealed.done.transcript.manifest).toMatchObject({ state: 'ASSEMBLED', failedChunks: 0, backendUnreachable: false });
    expect(sealed.done.transcript.waitLimitReached).toBe(true);
    expect(textsOf(r)).toHaveLength(6);
  });

  it('the transcriber of the session could NOT BE BUILT (no checkpoint: every question fails): the failures do not refill the budget, and the step is DONE within the bound', async () => {
    const r = rig();
    const sealed = await seal(r);
    expect(sealed.failures.length).toBeGreaterThan(0);
    expect(new Set(sealed.failures)).toEqual(new Set(['TRANSCRIBER_FAILED']));
    expect(sealed.elapsedMs).toBeLessThanOrEqual(LIMITS.stepLimitMs);
    expect(sealed.done.transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 3 });
    expect(textsOf(r)).toEqual([]);
  });

  it('the backend ANSWERS AFTER THE BOUND: the answer changes nothing — the same sealed hash, no late word in the sealed document, and the resumed step reads the same transcript back', async () => {
    const held = gateAfter(SECOND);
    const r = rig({ backend: 'omlx-server', engineGate: held.gate });
    const lateRun = r.session.runner.step({ final: true }).then(
      () => 'finished',
      () => 'failed',
    );
    await held.reached;

    const sealed = await seal(r);
    const sealedHash = sha256(r.session.files.json);
    expect(sealed.done.transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 2, sha256: sealedHash });

    // NOW the backend answers, and the runner of the session goes on to its end.
    held.release();
    await lateRun;
    expect(r.session.decoded.length).toBeGreaterThan(2);

    expect(sha256(r.session.files.json)).toBe(sealedHash);
    expect(textsOf(r)).toEqual(['Keterangan saksi 1-0.', 'Keterangan saksi 1-1.']);
    const again = done(await r.run({ attempt: 2 }));
    expect(again.resumed).toBe(true);
    expect(again.transcript).toEqual(sealed.done.transcript);
    expect(r.session.seam.closeOutCalls).toBe(1);
  });

  it('`backendUnreachable` at the bound follows the rule of the failure codes: a server backend that gave no answer could not be reached; a local engine that ran out of time is not "unreachable"', async () => {
    const results: Record<string, boolean> = {};
    for (const backend of ['omlx-server', 'cpu-local'] as const) {
      const held = gateAfter(SECOND);
      const r = rig({ backend, engineGate: held.gate });
      void r.session.runner.step({ final: true });
      await held.reached;
      const { transcript } = (await seal(r)).done;
      expect(transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 2 });
      results[backend] = transcript.manifest.backendUnreachable;
    }
    expect(results).toEqual({ 'omlx-server': true, 'cpu-local': false });
  });

  it('a Core that was DOWN does not find its transcript given up: the time between two calls counts up to the bound of one question, never more', async () => {
    const r = rig({ shouldPause: () => true });
    await r.session.runner.step({ final: true });
    const first = await r.run();
    expect(first).toMatchObject({ status: 'WAITING', remainingWaitMs: waitLimitOf(LIMITS) });
    r.clock.advance(10 * 3_600_000);
    const second = await r.run({ attempt: 2 });
    expect(second).toMatchObject({ status: 'WAITING', remainingWaitMs: waitLimitOf(LIMITS) - LIMITS.callLimitMs });
    expect(r.session.seam.closeOutCalls).toBe(0);
    // A clock that was set back spends nothing and refills nothing.
    r.clock.advance(-5 * 3_600_000);
    expect(await r.run({ attempt: 2 })).toMatchObject({ status: 'WAITING', remainingWaitMs: waitLimitOf(LIMITS) - LIMITS.callLimitMs });
  });

  it('WHAT IS NOT PROVEN DONE: a close-out that itself never answers ends the CALL at its bound with a typed failure, the budget is kept, and the next call that can close out is DONE', async () => {
    const r = rig({ shouldPause: () => true });
    await r.session.runner.step({ final: true });
    const stuck: AssembledTranscriptSource = { ...r.session.seam, closeOut: (_sessionId, options) => neverAnswers(r, options.signal) };
    const startedAt = r.clock.now();

    let failure: unknown;
    for (let calls = 0; calls < 400 && failure === undefined; calls += 1) {
      const settled = await oneCall(r, () => r.run({ ports: { transcript: stuck } }));
      if (!settled.ok) failure = settled.error;
      else if (settled.result.status === 'WAITING') r.clock.advance(Math.min(10_000, settled.result.remainingWaitMs));
      else throw new Error('a close-out that never answers cannot be DONE');
    }
    expect(failure).toBeInstanceOf(FinalizeTranscriptError);
    expect([(failure as FinalizeTranscriptError).code, (failure as FinalizeTranscriptError).detail]).toEqual(['TRANSCRIPT_CLOSE_OUT_FAILED', { reason: 'CLOSE_OUT_NO_ANSWER' }]);
    // The call came back within the bound of the whole step. It did not hang.
    expect(r.clock.now() - startedAt).toBe(LIMITS.stepLimitMs);
    expect(r.journal.rows.get(r.key)).toMatchObject({ status: 'FAILED', errorCode: 'TRANSCRIPT_CLOSE_OUT_FAILED', checkpoint: { committed: false } });
    expect(r.log.entries.some((entry) => entry.level === 'error' && entry.code === 'TRANSCRIPT_CLOSE_OUT_FAILED')).toBe(true);

    // The next call does not wait again: it closes out, and with a seam that answers it is DONE.
    const next = await oneCall(r, () => r.run({ attempt: 2 }));
    expect(next).toMatchObject({ ok: true, result: { status: 'DONE', transcript: { manifest: { state: 'PARTIAL', failedChunks: 3 }, waitLimitReached: true } } });
    expect(r.session.seam.assembleCalls).toBeGreaterThan(0);
  });

  it('a close-out that answers "not ready", or fails, is a typed failure of the step with its reason — never taken for a transcript, never waited on', async () => {
    for (const [reason, closeOut] of [
      ['CLOSE_OUT_NOT_READY', async () => ({ kind: 'NOT_READY' as const })],
      [
        'CLOSE_OUT_THREW',
        async () => {
          throw new Error('the scratch directory is gone');
        },
      ],
    ] as const) {
      const r = rig({ shouldPause: () => true });
      await r.session.runner.step({ final: true });
      const refusing: AssembledTranscriptSource = { ...r.session.seam, closeOut };
      let failure: unknown;
      for (let calls = 0; calls < 400 && failure === undefined; calls += 1) {
        const settled = await oneCall(r, () => r.run({ ports: { transcript: refusing } }));
        if (!settled.ok) failure = settled.error;
        else if (settled.result.status === 'WAITING') r.clock.advance(Math.min(10_000, settled.result.remainingWaitMs));
        else throw new Error('a close-out that handed nothing over cannot be DONE');
      }
      expect(failure).toBeInstanceOf(FinalizeTranscriptError);
      expect([(failure as FinalizeTranscriptError).code, (failure as FinalizeTranscriptError).detail]).toEqual(['TRANSCRIPT_CLOSE_OUT_FAILED', { reason }]);
      expect(r.journal.rows.get(r.key)).toMatchObject({ status: 'FAILED', errorCode: 'TRANSCRIPT_CLOSE_OUT_FAILED', checkpoint: { committed: false } });
    }
  });

  it('NO FABRICATED TEXT AT THE BOUND: a close-out that hands over a placeholder for a chunk it gave up is refused — nothing is sealed', async () => {
    const r = rig({ fail: (offsetMs) => (offsetMs > SECOND && offsetMs < 60_000 ? new Error('the engine ended with an error') : null), shouldPause: () => false });
    await r.session.finish();
    await r.session.seam.assemble(r.session.sessionId);
    const honest = JSON.parse(readFileSync(r.session.files.json, 'utf8')) as TranscriptDocument;
    const gap = r.session.checkpoint().chunks.find((chunk) => chunk.status === 'FAILED');
    const placeholder = { index: 2, start_ms: (gap?.startMs ?? 0) + 100, end_ms: (gap?.endMs ?? 0) - 100, text: '[tidak terdengar]', speaker: null };
    const fabricated: TranscriptDocument = { ...honest, segments: [...honest.segments.slice(0, 2), placeholder, ...honest.segments.slice(2)].map((segment, index) => ({ ...segment, index })) };
    const dir = mkdtempSync(join(tmpdir(), 'dems-row116-forged-'));
    const rendered = renderTranscript(fabricated);
    const files = { json: join(dir, 'transcript.json'), srt: join(dir, 'transcript.srt'), vtt: join(dir, 'transcript.vtt') };
    writeFileSync(files.json, rendered.json);
    writeFileSync(files.srt, rendered.srt);
    writeFileSync(files.vtt, rendered.vtt);
    const forging: AssembledTranscriptSource = { locate: () => files, assemble: async () => ({ kind: 'NOT_READY' }), closeOut: async () => ({ kind: 'ASSEMBLED', record: sealRecordOf(fabricated, rendered), files, failedChunkCodes: [CLOSE_OUT_CHUNK_CODE] }) };

    let refused: unknown;
    for (let calls = 0; calls < 400 && refused === undefined; calls += 1) {
      const settled = await oneCall(r, () => r.run({ ports: { transcript: forging } }));
      if (!settled.ok) refused = settled.error;
      else if (settled.result.status === 'WAITING') r.clock.advance(Math.min(10_000, settled.result.remainingWaitMs));
      else throw new Error('FABRICATED TEXT WAS SEALED');
    }
    expect((refused as FinalizeTranscriptError).code).toBe('TRANSCRIPT_TEXT_NOT_COMMITTED');
    expect(r.journal.rows.get(r.key)).toMatchObject({ status: 'FAILED', errorCode: 'TRANSCRIPT_TEXT_NOT_COMMITTED', checkpoint: { committed: false } });
    expect(JSON.stringify(r.log.entries)).not.toContain('tidak terdengar');
  });

  it('the bounds are refused when they leave no time to wait or are not positive whole numbers; the defaults are usable', async () => {
    expect(limitsFault(FINALIZE_TRANSCRIPT_LIMITS)).toBeNull();
    expect(waitLimitOf(FINALIZE_TRANSCRIPT_LIMITS)).toBe(FINALIZE_TRANSCRIPT_LIMITS.stepLimitMs - FINALIZE_TRANSCRIPT_LIMITS.closeOutLimitMs);
    expect(limitsFault({ stepLimitMs: 60_000, callLimitMs: 1_000, closeOutLimitMs: 60_000 })).toBe('NO_TIME_LEFT_TO_WAIT');
    expect(limitsFault({ stepLimitMs: Number.POSITIVE_INFINITY, callLimitMs: 1_000, closeOutLimitMs: 1_000 })).toBe('NOT_A_POSITIVE_INTEGER');
    expect(limitsFault({ stepLimitMs: 60_000, callLimitMs: 0, closeOutLimitMs: 1_000 })).toBe('NOT_A_POSITIVE_INTEGER');
    const r = rig();
    const settled = await oneCall(r, () => r.run({ limits: { stepLimitMs: Number.POSITIVE_INFINITY, callLimitMs: 1_000, closeOutLimitMs: 1_000 } }));
    expect(settled).toMatchObject({ ok: false, error: { code: 'INPUT_INVALID', detail: { reason: 'LIMITS_NOT_A_POSITIVE_INTEGER' } } });
    expect(r.journal.writes).toEqual([]);
  });
});

describe('CAPTURE IS NOT ON THIS PATH: the step cannot touch a fragment', () => {
  const root = join(__dirname, '..');
  const production = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? (entry.name === '__tests__' ? [] : production(join(dir, entry.name))) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : []));

  it('no production file of `src/sealing` imports the capture unit, the capture worker or a process; the step has no capture port', () => {
    const files = production(root);
    expect(files.map((file) => file.slice(root.length + 1)).sort()).toEqual(['finalize-transcript/bounds.ts', 'finalize-transcript/commit.ts', 'finalize-transcript/contract.ts', 'finalize-transcript/document.ts', 'finalize-transcript/files.ts', 'finalize-transcript/handler.ts', 'index.ts', 'step-journal.ts']);
    const imports = files.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)].map((match) => `${file.slice(root.length + 1)} <- ${match[1] ?? ''}`));
    expect(imports.length).toBeGreaterThan(10);
    expect(imports.filter((line) => /capture|child_process|node:net|node:dgram|worker/.test(line.split(' <- ')[1] ?? ''))).toEqual([]);
    // POSITIVE CONTROL of the pattern: it does see an import of the capture unit.
    expect(/capture|child_process/.test("../../capture")).toBe(true);
    const r = rig();
    expect(Object.keys(r.ports()).sort()).toEqual(['chunkRows', 'files', 'journal', 'log', 'now', 'timer', 'transcript']);
  });
});
