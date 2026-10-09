// THE LAST RESORT OF `FINALIZE_TRANSCRIPT` (blueprint row 119, decision D110, from row 116's open
// case D-116-3): A RECORDING IS NEVER HELD BACK BY TRANSCRIPTION. When the step keeps failing at
// its bound, the next call is DONE with `PARTIAL` and NO transcript document, reason
// `TRANSCRIPT_UNAVAILABLE_AT_SEAL`.
//
// No database (that half is `last-resort.db.test.ts`), no process, no model, no oMLX. The
// transcriber is the real `@dems/transcriber` pipeline of `support.ts` with stand-in engines; the
// close-out that fails is a stand-in seam, named in each test. NO TEST WAITS ON THE WALL CLOCK:
// the bounds are counted on `manualClock`.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXAMPLE_SOURCE_ROWS, TRANSCRIPT_DISABLED_REASON, TRANSCRIPT_UNAVAILABLE_REASON, buildUnsignedManifest, declaredPackageFiles, exampleManifestInput, manifestDeclaresTranscript } from '@dems/shared/evidence-package';
import { createMemoryChunkMirror, renderTranscript, sealRecordOf, type TranscriptDocument } from '@dems/transcriber';
import { describe, expect, it } from 'vitest';
import {
  CLOSE_OUT_CHUNK_CODE,
  FINALIZE_TRANSCRIPT_CHECKPOINT_VERSION,
  FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS,
  FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS_MAX,
  FINALIZE_TRANSCRIPT_LIMITS,
  FINALIZE_TRANSCRIPT_STEP,
  FinalizeTranscriptError,
  closeOutAttemptsOf,
  commitSealedTranscript,
  createTranscriptFileReader,
  evidenceTranscriptSummary,
  finalizeTranscript,
  limitsFault,
  waitLimitOf,
  type AssembledTranscriptSource,
  type FinalizeTranscriptInput,
  type FinalizeTranscriptLimits,
  type FinalizeTranscriptPorts,
  type FinalizeTranscriptResult,
  type SttConfigSnapshot,
} from '../index';
import { manualClock, memoryErrorLog, memoryJournal, snapshotOf, transcribedSession, type SessionOptions, type TranscribedSession } from './support';

let counter = 0;
const nextSession = (): string => `SES-20261009-${String(8300 + (counter += 1)).padStart(4, '0')}`;

/** Small bounds: ten minutes for the step, one of them for closing out. The attempt bound is the default (3). */
const LIMITS: FinalizeTranscriptLimits = { stepLimitMs: 600_000, callLimitMs: 30_000, closeOutLimitMs: 60_000 };
const SPOKEN = 'Keterangan saksi';

type Done = Extract<FinalizeTranscriptResult, { status: 'DONE' }>;
type Call = Partial<Pick<FinalizeTranscriptInput, 'sealWithoutTranscript' | 'backendUnreachable' | 'attempt' | 'limits'>> & { snapshot?: SttConfigSnapshot; ports?: Partial<FinalizeTranscriptPorts> };

interface Rig {
  readonly session: TranscribedSession;
  readonly mirror: ReturnType<typeof createMemoryChunkMirror>;
  readonly journal: ReturnType<typeof memoryJournal>;
  readonly log: ReturnType<typeof memoryErrorLog>;
  readonly clock: ReturnType<typeof manualClock>;
  hanging: number;
  readonly key: string;
  run(call?: Call): Promise<FinalizeTranscriptResult>;
}

function rig(options: Omit<SessionOptions, 'mirror'> = {}): Rig {
  const mirror = createMemoryChunkMirror();
  const session = transcribedSession(nextSession(), { ...options, mirror });
  const journal = memoryJournal();
  const log = memoryErrorLog();
  const clock = manualClock();
  const backend = options.backend ?? 'cpu-local';
  const self: Rig = {
    session,
    mirror,
    journal,
    log,
    clock,
    hanging: 0,
    key: `${session.sessionId}#${FINALIZE_TRANSCRIPT_STEP}`,
    run: (call = {}) =>
      finalizeTranscript(
        {
          sessionId: session.sessionId,
          sttSnapshot: call.snapshot ?? snapshotOf({ backend }),
          attempt: call.attempt ?? 1,
          limits: call.limits ?? LIMITS,
          ...(call.sealWithoutTranscript === undefined ? {} : { sealWithoutTranscript: call.sealWithoutTranscript }),
          ...(call.backendUnreachable === undefined ? {} : { backendUnreachable: call.backendUnreachable }),
        },
        { transcript: session.seam, chunkRows: mirror, files: createTranscriptFileReader(), journal, log, now: clock.now, timer: clock.timer, ...call.ports },
      ),
  };
  return self;
}

const turn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
type Settled = { readonly ok: true; readonly result: FinalizeTranscriptResult } | { readonly ok: false; readonly error: unknown };

/** ONE CALL of the step. The clock moves inside it only to the bound of a question that hangs. */
async function oneCall(r: Rig, call: Call = {}): Promise<Settled> {
  let settled: Settled | undefined;
  void r.run(call).then(
    (result) => void (settled = { ok: true, result }),
    (error: unknown) => void (settled = { ok: false, error }),
  );
  while (settled === undefined) {
    if (r.hanging > 0 && r.clock.armed() > 0) r.clock.fireNext();
    await turn();
  }
  return settled;
}

/** Calls the step as the pipeline does while it answers WAITING; returns the first answer that is not WAITING. */
async function untilTheBound(r: Rig, call: Call = {}): Promise<Settled> {
  for (let calls = 0; calls < 400; calls += 1) {
    const settled = await oneCall(r, call);
    if (!settled.ok || settled.result.status !== 'WAITING') return settled;
    r.clock.advance(Math.min(10_000, settled.result.remainingWaitMs));
  }
  throw new Error('THE STEP WAITED FOR EVER');
}

const failureOf = (settled: Settled): [string, unknown] => {
  if (settled.ok) throw new Error(`the step answered ${settled.result.status}, not a failure`);
  if (!(settled.error instanceof FinalizeTranscriptError)) throw settled.error;
  return [settled.error.code, settled.error.detail['reason'] ?? null];
};
const doneOf = (settled: Settled): Done => {
  if (!settled.ok) throw settled.error;
  if (settled.result.status !== 'DONE') throw new Error(`the step answered ${settled.result.status}`);
  return settled.result;
};

/** A transcript that is never finished: the runner is held back, so `assemble` answers NOT_READY for ever. */
async function unfinished(options: Omit<SessionOptions, 'mirror'> = {}): Promise<Rig> {
  const r = rig({ ...options, shouldPause: () => true });
  await r.session.runner.step({ final: true });
  return r;
}

/** A transcriber whose engine committed chunk 1 and hangs on chunk 2: rows exist, the plan is known. */
async function hungAfterOneChunk(backend: SttConfigSnapshot['backend'] = 'cpu-local'): Promise<Rig> {
  let reach: () => void = () => undefined;
  const reached = new Promise<void>((resolve) => void (reach = resolve));
  const r = rig({
    backend,
    engineGate: (offsetMs) => {
      if (offsetMs < 40_000) return Promise.resolve();
      reach();
      return new Promise<void>(() => undefined);
    },
  });
  void r.session.runner.step({ final: true });
  await reached;
  return r;
}

const stuckSeam = (r: Rig): AssembledTranscriptSource => ({
  ...r.session.seam,
  // The engine of the session hangs, so the question for a finished transcript is "not ready".
  assemble: async () => ({ kind: 'NOT_READY' }),
  closeOut: (_sessionId, options) => {
    r.hanging += 1;
    options.signal.addEventListener('abort', () => void (r.hanging -= 1), { once: true });
    return new Promise(() => undefined);
  },
});
const refusingSeam = (r: Rig, answer: 'NOT_READY' | 'THROWS'): AssembledTranscriptSource & { asked: number } => {
  const seam = {
    ...r.session.seam,
    asked: 0,
    assemble: async () => ({ kind: 'NOT_READY' as const }),
    closeOut: async () => {
      seam.asked += 1;
      if (answer === 'THROWS') throw new Error('the scratch directory is gone');
      return { kind: 'NOT_READY' as const };
    },
  };
  return seam;
};

const NO_DOCUMENT = {
  file: null,
  docVersion: null,
  sha256: null,
  srtSha256: null,
  vttSha256: null,
  model: { name: null, version: null, quantisation: null, modelSha256: null },
  diarization: { numSpeakers: null, status: null, confidence: null },
  speakerState: null,
  revisionHead: null,
};

describe('D110: after the bounded attempts at the bound, the NEXT call is DONE without a transcript document', () => {
  it('a close-out that never answers: three typed failures counted in the journal, then DONE — PARTIAL, every document field null, TRANSCRIPT_UNAVAILABLE_AT_SEAL; the transcriber is asked nothing more', async () => {
    const r = await hungAfterOneChunk();
    const seam = stuckSeam(r);
    const ports = { transcript: seam };
    const startedAt = r.clock.now();
    expect(closeOutAttemptsOf(LIMITS)).toBe(FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS);
    expect(FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS).toBe(3);

    // FAILURE 1 comes at the bound of the step, after the whole wait.
    expect(failureOf(await untilTheBound(r, { ports }))).toEqual(['TRANSCRIPT_CLOSE_OUT_FAILED', 'CLOSE_OUT_NO_ANSWER']);
    expect(r.clock.now() - startedAt).toBe(LIMITS.stepLimitMs);
    expect(r.journal.rows.get(r.key)).toMatchObject({ status: 'FAILED', errorCode: 'TRANSCRIPT_CLOSE_OUT_FAILED', checkpoint: { committed: false, boundFailures: 1, lastBoundFailure: 'TRANSCRIPT_CLOSE_OUT_FAILED' } });

    // FAILURES 2 and 3: the retries of the pipeline (row 82). Each is one close-out more, no wait before it.
    for (const failures of [2, 3]) {
      expect(failureOf(await oneCall(r, { ports, attempt: failures }))).toEqual(['TRANSCRIPT_CLOSE_OUT_FAILED', 'CLOSE_OUT_NO_ANSWER']);
      expect(r.journal.rows.get(r.key)).toMatchObject({ status: 'FAILED', attempt: failures, checkpoint: { committed: false, boundFailures: failures } });
    }
    const writesBefore = r.journal.writes.length;
    const hangingBefore = r.hanging;

    // THE NEXT CALL: DONE. No question to the transcriber, no bound armed, no time on the clock.
    const at = r.clock.now();
    const done = doneOf(await oneCall(r, { ports, attempt: 4 }));
    expect([r.clock.now() - at, r.clock.armed(), r.hanging - hangingBefore]).toEqual([0, 0, 0]);
    expect(done.files).toBeNull();
    expect(done.resumed).toBe(false);

    const { transcript } = done;
    expect(transcript.manifest).toEqual({
      ...NO_DOCUMENT,
      state: 'PARTIAL',
      // Three chunks are planned in the session's rows (one of them DONE in the database): none has text in the package.
      failedChunks: 3,
      disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL',
      backendUnreachable: false,
      configSnapshot: snapshotOf(),
    });
    expect(TRANSCRIPT_UNAVAILABLE_REASON).toBe('TRANSCRIPT_UNAVAILABLE_AT_SEAL');
    // NEVER CONFUSED WITH DISABLED: STT was on, and the block says so.
    expect([transcript.manifest.state, transcript.manifest.disabledReason, transcript.manifest.configSnapshot.enabled]).not.toContain('DISABLED');
    expect(transcript.manifest.disabledReason).not.toBe(TRANSCRIPT_DISABLED_REASON);
    expect(transcript.manifest.configSnapshot.enabled).toBe(true);

    expect(transcript.transcriptRow).toBeNull();
    expect(transcript.itemColumns).toEqual({ manifestVersion: 2, transcriptSha256: null, labelsStatus: null });
    expect([transcript.partialReason, transcript.speakerReason, transcript.waitLimitReached]).toEqual([null, null, true]);
    expect(transcript.counters).toEqual({ chunks: 3, failedChunks: 3, segments: 0 });
    expect(transcript.unavailable).toEqual({ by: 'ATTEMPT_BOUND', failures: 3, lastFailure: 'TRANSCRIPT_CLOSE_OUT_FAILED' });

    // THE JOURNAL RECORDS THE TRANSITION: FAILED -> RUNNING (the count carried) -> DONE (how it was reached).
    const transition = r.journal.writes.slice(writesBefore - 1).map((write) => [write.status, write.errorCode, (write.checkpoint as { boundFailures?: number } | null)?.boundFailures ?? null]);
    expect(transition).toEqual([
      ['FAILED', 'TRANSCRIPT_CLOSE_OUT_FAILED', 3],
      ['RUNNING', null, 3],
      ['DONE', null, null],
    ]);
    expect(r.journal.rows.get(r.key)).toMatchObject({
      status: 'DONE',
      progress: 100,
      attempt: 4,
      errorCode: null,
      checkpoint: { version: FINALIZE_TRANSCRIPT_CHECKPOINT_VERSION, committed: true, waitLimitReached: true, manifest: { state: 'PARTIAL', disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', sha256: null }, unavailable: { by: 'ATTEMPT_BOUND', failures: 3, lastFailure: 'TRANSCRIPT_CLOSE_OUT_FAILED' } },
    });
    // ... and the persistent log: an ERROR the team finds, with the session as its correlation id.
    expect(r.log.entries.at(-1)).toMatchObject({ level: 'error', source: 'sealing.finalizeTranscript', code: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', context: { correlationId: r.session.sessionId, reason: 'ATTEMPT_BOUND', boundFailures: 3, lastBoundFailure: 'TRANSCRIPT_CLOSE_OUT_FAILED', plannedChunks: 3 } });
  });

  it('NO FABRICATED TEXT ANYWHERE: the committed chunk of the session is in no answer, no journal row, no log entry and no file of the step', async () => {
    const r = await hungAfterOneChunk();
    const ports = { transcript: refusingSeam(r, 'NOT_READY') };
    expect(failureOf(await untilTheBound(r, { ports }))[0]).toBe('TRANSCRIPT_CLOSE_OUT_FAILED');
    await oneCall(r, { ports });
    await oneCall(r, { ports });
    const done = doneOf(await oneCall(r, { ports }));
    // POSITIVE CONTROL: there IS committed text in this session — in its chunk rows, where it stays.
    expect(JSON.stringify(await r.mirror.read(r.session.sessionId))).toContain(SPOKEN);
    for (const told of [done, [...r.journal.rows.values()], r.journal.writes, r.log.entries]) expect(JSON.stringify(told)).not.toContain(SPOKEN);
    // No transcript file was written by anybody: the step writes none, and the transcriber assembled none.
    expect([existsSync(r.session.files.json), existsSync(r.session.files.srt), existsSync(r.session.files.vtt)]).toEqual([false, false, false]);
    // The package declares no transcript file (row 83's layout), and row 83's builder takes the block as it is.
    expect(manifestDeclaresTranscript(done.transcript.manifest)).toBe(false);
    expect(declaredPackageFiles({ transcript: manifestDeclaresTranscript(done.transcript.manifest) }).filter((file) => file.startsWith('transcript/'))).toEqual([]);
    const unsigned = buildUnsignedManifest({ ...exampleManifestInput(), transcript: done.transcript.manifest }, EXAMPLE_SOURCE_ROWS);
    expect(unsigned.transcript).toEqual(done.transcript.manifest);
    // The summary of the slice: PARTIAL without a hash; the item gets no transcript row.
    expect(evidenceTranscriptSummary(done.transcript.manifest, 0)).toEqual({ state: 'PARTIAL', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0, failedChunks: 3, backendUnreachable: false });
    const writes: unknown[] = [];
    expect(await commitSealedTranscript({ read: async () => null, writeSealedTranscript: async (row) => void writes.push(row) }, { evidenceId: 'EV-20261009-8301', transcript: done.transcript, createdAt: 1 })).toEqual({ outcome: 'NO_TRANSCRIPT' });
    expect(writes).toEqual([]);
  });

  it('the plan is not known (no chunk row, or the rows cannot be read): failedChunks is null, never a guess — and the seal is DONE all the same', async () => {
    // No row: the transcriber of this session never ran (it could not be started), so nothing is planned.
    const none = rig();
    const ports = { transcript: refusingSeam(none, 'THROWS') };
    expect(failureOf(await untilTheBound(none, { ports }))).toEqual(['TRANSCRIPT_CLOSE_OUT_FAILED', 'CLOSE_OUT_THREW']);
    await oneCall(none, { ports });
    await oneCall(none, { ports });
    expect(await none.mirror.read(none.session.sessionId)).toEqual([]);
    const first = doneOf(await oneCall(none, { ports }));
    expect([first.transcript.manifest.failedChunks, first.transcript.failedChunksByRows, first.transcript.counters]).toEqual([null, null, { chunks: 0, failedChunks: 0, segments: 0 }]);
    expect(evidenceTranscriptSummary(first.transcript.manifest, 0)).toEqual({ state: 'PARTIAL', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0, backendUnreachable: false });

    // The rows cannot be read at the last call: a warning in the log, null in the manifest, DONE.
    const unread = await hungAfterOneChunk();
    const stuck = { transcript: refusingSeam(unread, 'NOT_READY') };
    await untilTheBound(unread, { ports: stuck });
    await oneCall(unread, { ports: stuck });
    await oneCall(unread, { ports: stuck });
    const second = doneOf(
      await oneCall(unread, {
        ports: {
          ...stuck,
          chunkRows: {
            read: async () => {
              throw new Error('the pool is closed');
            },
          },
        },
      }),
    );
    expect(second.transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: null, disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL' });
    expect(unread.log.entries.some((entry) => entry.level === 'warn' && entry.context?.['reason'] === 'PLANNED_CHUNKS_NOT_READ')).toBe(true);
  });

  it('backendUnreachable is what the caller knows: true only when it says so', async () => {
    for (const known of [true, false, undefined]) {
      const r = await hungAfterOneChunk('omlx-server');
      const ports = { transcript: refusingSeam(r, 'NOT_READY') };
      await untilTheBound(r, { ports });
      await oneCall(r, { ports });
      await oneCall(r, { ports });
      const done = doneOf(await oneCall(r, { ports, ...(known === undefined ? {} : { backendUnreachable: known }) }));
      expect(done.transcript.manifest).toMatchObject({ state: 'PARTIAL', backendUnreachable: known === true, disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', configSnapshot: { backend: 'omlx-server', enabled: true } });
      // Row 83's rule "PARTIAL when the backend was unreachable" holds for the block.
      expect(buildUnsignedManifest({ ...exampleManifestInput(), transcript: done.transcript.manifest }, EXAMPLE_SOURCE_ROWS).transcript.backendUnreachable).toBe(known === true);
    }
  });

  it('the attempt bound is a limit of the call: 1 makes the second call DONE; a bound that is no count from 1 to the maximum is refused', async () => {
    const r = await hungAfterOneChunk();
    const limits: FinalizeTranscriptLimits = { ...LIMITS, closeOutAttempts: 1 };
    const ports = { transcript: refusingSeam(r, 'NOT_READY') };
    expect(failureOf(await untilTheBound(r, { ports, limits }))[0]).toBe('TRANSCRIPT_CLOSE_OUT_FAILED');
    expect(doneOf(await oneCall(r, { ports, limits })).transcript.unavailable).toEqual({ by: 'ATTEMPT_BOUND', failures: 1, lastFailure: 'TRANSCRIPT_CLOSE_OUT_FAILED' });

    expect(limitsFault(FINALIZE_TRANSCRIPT_LIMITS)).toBeNull();
    expect(limitsFault({ ...LIMITS, closeOutAttempts: FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS_MAX })).toBeNull();
    for (const attempts of [0, -1, 1.5, Number.NaN, FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS_MAX + 1, Number.POSITIVE_INFINITY]) {
      expect(limitsFault({ ...LIMITS, closeOutAttempts: attempts }), String(attempts)).toBe('CLOSE_OUT_ATTEMPTS_OUT_OF_RANGE');
    }
    const refused = await oneCall(await unfinished(), { limits: { ...LIMITS, closeOutAttempts: 0 } });
    expect(failureOf(refused)).toEqual(['INPUT_INVALID', 'LIMITS_CLOSE_OUT_ATTEMPTS_OUT_OF_RANGE']);
  });
});

describe('D110: the caller gives the transcript up (`sealWithoutTranscript`)', () => {
  it('after ONE failure at the bound the flag makes the next call DONE; the journal says it was the caller', async () => {
    const r = await hungAfterOneChunk();
    const seam = refusingSeam(r, 'NOT_READY');
    const ports = { transcript: seam };
    expect(failureOf(await untilTheBound(r, { ports }))).toEqual(['TRANSCRIPT_CLOSE_OUT_FAILED', 'CLOSE_OUT_NOT_READY']);
    expect(seam.asked).toBe(1);
    const done = doneOf(await oneCall(r, { ports, sealWithoutTranscript: true, attempt: 2 }));
    expect(seam.asked).toBe(1);
    expect(done.transcript.manifest).toMatchObject({ ...NO_DOCUMENT, state: 'PARTIAL', disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', failedChunks: 3 });
    expect(done.transcript.unavailable).toEqual({ by: 'CALLER', failures: 1, lastFailure: 'TRANSCRIPT_CLOSE_OUT_FAILED' });
    expect(r.journal.rows.get(r.key)).toMatchObject({ status: 'DONE', checkpoint: { unavailable: { by: 'CALLER', failures: 1 } } });
  });

  it('NEGATIVE CONTROL: the flag cannot skip a transcript that can be had — before the bound the step waits, and at the bound without a failure it closes out and seals the document', async () => {
    const r = await hungAfterOneChunk();
    // Before the bound: WAITING, exactly as without the flag. Nothing is given up.
    const early = await oneCall(r, { sealWithoutTranscript: true });
    expect(early).toMatchObject({ ok: true, result: { status: 'WAITING', remainingWaitMs: waitLimitOf(LIMITS) } });
    expect(r.session.seam.closeOutCalls).toBe(0);
    // At the bound, no failure counted: the close-out is asked, answers, and its document is sealed.
    const done = doneOf(await untilTheBound(r, { sealWithoutTranscript: true }));
    expect(r.session.seam.closeOutCalls).toBe(1);
    expect(done.files).not.toBeNull();
    expect(done.transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 2, disabledReason: null, file: 'transcript/transcript.json' });
    expect(done.transcript.manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(done.transcript.unavailable).toBeUndefined();
    expect((JSON.parse(readFileSync(r.session.files.json, 'utf8')) as TranscriptDocument).segments.map((segment) => segment.text)).toEqual([`${SPOKEN} 1-0.`, `${SPOKEN} 1-1.`]);
  });

  it('a disabled session is DISABLED whatever the flag says: the two states never meet', async () => {
    const r = rig();
    const done = doneOf(await oneCall(r, { snapshot: snapshotOf({ enabled: false }), sealWithoutTranscript: true, backendUnreachable: true }));
    expect(done.transcript.manifest).toMatchObject({ state: 'DISABLED', disabledReason: 'DISABLED_BY_CONFIGURATION', backendUnreachable: false, failedChunks: null });
    expect(done.transcript.unavailable).toBeUndefined();
  });
});

describe('D110: what counts, and what the last resort does not take away', () => {
  it('a close-out that works again before the bound of attempts seals its document: two failures, then PARTIAL WITH a transcript', async () => {
    const r = await hungAfterOneChunk();
    const broken = { transcript: refusingSeam(r, 'THROWS') };
    expect(failureOf(await untilTheBound(r, { ports: broken }))[0]).toBe('TRANSCRIPT_CLOSE_OUT_FAILED');
    expect(failureOf(await oneCall(r, { ports: broken }))[0]).toBe('TRANSCRIPT_CLOSE_OUT_FAILED');
    expect(r.journal.rows.get(r.key)).toMatchObject({ checkpoint: { boundFailures: 2 } });
    // The real seam of the session closes out.
    const done = doneOf(await oneCall(r));
    expect(done.transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 2, disabledReason: null });
    expect(done.transcript.manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(done.transcript.unavailable).toBeUndefined();
    expect(done.transcript.transcriptRow).not.toBeNull();
  });

  it('a closed-out transcript the Core REFUSES counts too: fabricated text is refused three times, never sealed, and the fourth call seals without a transcript', async () => {
    const r = rig({ fail: (offsetMs) => (offsetMs > 1_000 && offsetMs < 60_000 ? new Error('the engine ended with an error') : null), shouldPause: () => false });
    await r.session.finish();
    await r.session.seam.assemble(r.session.sessionId);
    const honest = JSON.parse(readFileSync(r.session.files.json, 'utf8')) as TranscriptDocument;
    const gap = r.session.checkpoint().chunks.find((chunk) => chunk.status === 'FAILED');
    const placeholder = { index: 2, start_ms: (gap?.startMs ?? 0) + 100, end_ms: (gap?.endMs ?? 0) - 100, text: '[tidak terdengar]', speaker: null };
    const fabricated: TranscriptDocument = { ...honest, segments: [...honest.segments.slice(0, 2), placeholder, ...honest.segments.slice(2)].map((segment, index) => ({ ...segment, index })) };
    const dir = mkdtempSync(join(tmpdir(), 'dems-row119-forged-'));
    const rendered = renderTranscript(fabricated);
    const files = { json: join(dir, 'transcript.json'), srt: join(dir, 'transcript.srt'), vtt: join(dir, 'transcript.vtt') };
    writeFileSync(files.json, rendered.json);
    writeFileSync(files.srt, rendered.srt);
    writeFileSync(files.vtt, rendered.vtt);
    // Consistent with itself in every hash and member: only the rule "no text without a committed chunk" refuses it.
    const forging: AssembledTranscriptSource = { locate: () => files, assemble: async () => ({ kind: 'NOT_READY' }), closeOut: async () => ({ kind: 'ASSEMBLED', record: sealRecordOf(fabricated, rendered), files, failedChunkCodes: [CLOSE_OUT_CHUNK_CODE] }) };
    const ports = { transcript: forging };

    expect(failureOf(await untilTheBound(r, { ports }))[0]).toBe('TRANSCRIPT_TEXT_NOT_COMMITTED');
    expect(failureOf(await oneCall(r, { ports }))[0]).toBe('TRANSCRIPT_TEXT_NOT_COMMITTED');
    expect(failureOf(await oneCall(r, { ports }))[0]).toBe('TRANSCRIPT_TEXT_NOT_COMMITTED');
    expect(r.journal.rows.get(r.key)).toMatchObject({ status: 'FAILED', errorCode: 'TRANSCRIPT_TEXT_NOT_COMMITTED', checkpoint: { committed: false, boundFailures: 3, lastBoundFailure: 'TRANSCRIPT_TEXT_NOT_COMMITTED' } });
    const done = doneOf(await oneCall(r, { ports }));
    expect(done.transcript.manifest).toMatchObject({ ...NO_DOCUMENT, state: 'PARTIAL', disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL' });
    expect(done.transcript.unavailable).toEqual({ by: 'ATTEMPT_BOUND', failures: 3, lastFailure: 'TRANSCRIPT_TEXT_NOT_COMMITTED' });
    expect(JSON.stringify([done, [...r.journal.rows.values()]])).not.toContain('tidak terdengar');
  });

  it('NEGATIVE CONTROL: a failure of the Core\'s OWN store at the bound is not a failure of the transcript — it is never counted, and no transcript is given up for it', async () => {
    const r = await hungAfterOneChunk();
    let reads = 0;
    const brokenRows = {
      read: async (sessionId: string) => {
        reads += 1;
        // The waiting calls read the rows for their progress; the read after the close-out fails.
        if (r.session.seam.closeOutCalls > 0) throw new Error('the pool is closed');
        return r.mirror.read(sessionId);
      },
    };
    const first = await untilTheBound(r, { ports: { chunkRows: brokenRows } });
    expect(failureOf(first)[0]).toBe('STORE_FAILED');
    for (let call = 0; call < 5; call += 1) expect(failureOf(await oneCall(r, { ports: { chunkRows: brokenRows } }))[0]).toBe('STORE_FAILED');
    expect(reads).toBeGreaterThan(5);
    expect(r.journal.rows.get(r.key)).not.toHaveProperty('checkpoint.boundFailures');
    // The store is back: the transcript that was there all along is sealed, with its document.
    const done = doneOf(await oneCall(r));
    expect(done.transcript.manifest).toMatchObject({ state: 'PARTIAL', disabledReason: null, failedChunks: 2 });
    expect(done.transcript.unavailable).toBeUndefined();
  });

  it('a failure BEFORE the bound is never counted: only a step that has waited its whole limit can reach the last resort', async () => {
    const r = await hungAfterOneChunk();
    const failing = { transcript: { ...r.session.seam, assemble: async () => Promise.reject(new Error('the transcriber is not built')) } };
    for (let call = 0; call < 6; call += 1) {
      expect(failureOf(await oneCall(r, { ports: failing }))[0]).toBe('TRANSCRIBER_FAILED');
      r.clock.advance(1_000);
    }
    expect(r.journal.rows.get(r.key)).toMatchObject({ status: 'FAILED', checkpoint: { committed: false } });
    expect(r.journal.rows.get(r.key)).not.toHaveProperty('checkpoint.boundFailures');
    // With the flag, too: there is no failure at the bound, so nothing is given up.
    expect(await oneCall(r, { sealWithoutTranscript: true })).toMatchObject({ ok: true, result: { status: 'WAITING' } });
  });
});

describe('D110: the committed last-resort state is consumed like every committed transcript step', () => {
  async function sealedWithout(): Promise<{ r: Rig; done: Done; ports: { transcript: AssembledTranscriptSource } }> {
    const r = await hungAfterOneChunk();
    const ports = { transcript: refusingSeam(r, 'NOT_READY') };
    await untilTheBound(r, { ports });
    await oneCall(r, { ports });
    await oneCall(r, { ports });
    return { r, done: doneOf(await oneCall(r, { ports })), ports };
  }

  it('a resumed seal reads the same answer back and asks the transcriber NOTHING — not even where its files are', async () => {
    const { r, done } = await sealedWithout();
    const writes = r.journal.writes.length;
    const asked = { assemble: 0, locate: 0, closeOut: 0 };
    const counting: AssembledTranscriptSource = {
      assemble: async () => {
        asked.assemble += 1;
        return { kind: 'NOT_READY' };
      },
      locate: () => {
        asked.locate += 1;
        return r.session.files;
      },
      closeOut: async () => {
        asked.closeOut += 1;
        return { kind: 'NOT_READY' };
      },
    };
    const again = doneOf(await oneCall(r, { ports: { transcript: counting }, attempt: 4 }));
    expect(again).toEqual({ ...done, resumed: true });
    expect(asked).toEqual({ assemble: 0, locate: 0, closeOut: 0 });
    // The same attempt and a DONE row: nothing is written. A later attempt writes the SAME checkpoint.
    const later = doneOf(await oneCall(r, { ports: { transcript: counting }, attempt: 5 }));
    expect(later.transcript).toEqual(done.transcript);
    expect(r.journal.writes.slice(writes).map((write) => [write.status, write.attempt])).toEqual([
      ['DONE', 4],
      ['DONE', 5],
    ]);
    expect(r.journal.rows.get(r.key)?.checkpoint).toEqual(r.journal.writes[writes - 1]?.checkpoint);
  });

  it('a transcript that turns up AFTER the seal changes nothing: the committed state stands, and nothing is assembled into it', async () => {
    const { r, done } = await sealedWithout();
    // The real seam of the session can close out now — too late.
    const again = doneOf(await oneCall(r, { attempt: 5 }));
    expect(again.transcript).toEqual(done.transcript);
    expect([again.files, r.session.seam.assembleCalls, r.session.seam.closeOutCalls, r.session.seam.locateCalls]).toEqual([null, 0, 0, 0]);
  });

  it('another snapshot than the committed one is refused; a committed row that names no document and no valid reason is refused as JOURNAL_INVALID, never recomputed over', async () => {
    const { r } = await sealedWithout();
    expect(failureOf(await oneCall(r, { snapshot: snapshotOf({ revision: 9 }) }))).toEqual(['INPUT_INVALID', 'SNAPSHOT_CHANGED']);

    const row = r.journal.rows.get(r.key);
    if (row === undefined || row.checkpoint === null) throw new Error('no journal row');
    const checkpoint = structuredClone(row.checkpoint) as { manifest: Record<string, unknown> };
    for (const [change, reason] of [
      [{ disabledReason: null }, 'CHECKPOINT_ABSENCE_UNEXPLAINED'],
      [{ disabledReason: 'DISABLED_BY_CONFIGURATION' }, 'CHECKPOINT_ABSENCE_UNEXPLAINED'],
      [{ state: 'ASSEMBLED' }, 'CHECKPOINT_ABSENCE_UNEXPLAINED'],
      [{ state: 'DISABLED' }, 'CHECKPOINT_ABSENCE_UNEXPLAINED'],
      [{ file: 'transcript/transcript.json' }, 'CHECKPOINT_REASON_WITH_DOCUMENT'],
    ] as const) {
      r.journal.rows.set(r.key, { ...row, status: 'DONE', checkpoint: { ...checkpoint, manifest: { ...checkpoint.manifest, ...change } } });
      expect(failureOf(await oneCall(r)), JSON.stringify(change)).toEqual(['JOURNAL_INVALID', reason]);
    }
  });
});
