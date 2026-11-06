// `FINALIZE_TRANSCRIPT` as the running Core composes it (blueprint row 71c, decision D153; evidence
// spec §E.5, §B.7a; transcript spec §B.7): what a session's seal ends with, by what its own STT
// snapshot says and by what the transcriber can hand over.
//
// The transcript of every case is made by the REAL `@dems/transcriber` with stand-in engines
// (`sealing/__tests__/support.ts`, rows 76 to 79 and 116); the step is row 79's handler, unchanged.
// THE BOUND IS THE STEP'S OWN SETTING with a short value: the test waits on the wall clock for a
// few hundred milliseconds, and asserts no figure of how long anything took (D230).
import { EXAMPLE_SOURCE_ROWS, buildUnsignedManifest, exampleManifestInput } from '@dems/shared/evidence-package';
import { verifyPackageV2 } from '@dems/shared/evidence-verify';
import { createMemoryChunkMirror, type TranscriptModelProvenance } from '@dems/transcriber';
import { afterAll, describe, expect, it } from 'vitest';
import { FinalizeTranscriptError, TRANSCRIPT_RETRIES_PER_RUN, createTranscriptFileReader, systemStepTimer, type FinalizeTranscriptLimits, type FinalizeTranscriptResult, type SttConfigSnapshot } from '../../sealing';
import { corePorts } from '../../evidence-verify';
import { removePackages, sealPackage } from '../../sealing/__tests__/package-support';
import { MODEL, memoryErrorLog, memoryJournal, snapshotOf, transcribedSession, transcriberSeam, type SessionOptions, type TranscribedSession } from '../../sealing/__tests__/support';
import { NO_STT_SNAPSHOT_RECORDED } from '../session-reader';
import { NO_TRANSCRIPT_LIMITS, SealTranscriptCode, createSealTranscriptStep, type SealTranscriptRuns } from '../transcript-step';

let counter = 0;
const nextSession = (): string => `SES-20261009-${String(7100 + (counter += 1)).padStart(4, '0')}`;
/** THE BOUND'S SETTING, short: the step waits 150 ms for a finished transcript, then closes it out. */
const SHORT: FinalizeTranscriptLimits = { stepLimitMs: 400, callLimitMs: 50, closeOutLimitMs: 250 };

interface Rig {
  readonly session: TranscribedSession;
  readonly log: ReturnType<typeof memoryErrorLog>;
  readonly reports: { level: string; code: string; cause: unknown }[];
  /** What the step asked the transcription unit, in order. */
  readonly asked: string[];
  /** Runs the step as the pipeline does: asked again while WAITING, and after a failure, a few times. */
  seal(snapshot: SttConfigSnapshot, limits?: FinalizeTranscriptLimits, maxCalls?: number): Promise<{ readonly result: FinalizeTranscriptResult; readonly calls: number; readonly waiting: number; readonly failures: string[] }>;
}

function rig(availability: Awaited<ReturnType<SealTranscriptRuns['availability']>>, options: Omit<SessionOptions, 'mirror'> = {}, model?: TranscriptModelProvenance): Rig {
  const mirror = createMemoryChunkMirror();
  const made = transcribedSession(nextSession(), { ...options, mirror });
  // `model`: what the Core's provider states for THIS session (pass D9); the shared rig states one fixed provenance for every backend.
  const session: TranscribedSession = model === undefined ? made : { ...made, seam: transcriberSeam({ ...made.assembly, model }) };
  const journal = memoryJournal();
  const log = memoryErrorLog();
  const reports: Rig['reports'] = [];
  const asked: string[] = [];
  // The transcription unit's runs, on the reference seam of the transcriber (rows 79 / 116).
  const runs: SealTranscriptRuns = {
    availability: async () => (asked.push('availability'), availability),
    assemble: (sessionId) => (asked.push('assemble'), session.seam.assemble(sessionId)),
    closeOut: (sessionId, chunkCode) => (asked.push(`closeOut ${chunkCode}`), session.seam.closeOut(sessionId, { chunkCode, signal: new AbortController().signal })),
    locate: (sessionId) => session.seam.locate(sessionId),
  };
  let limitsNow: FinalizeTranscriptLimits = SHORT;
  const step = createSealTranscriptStep({
    runs: () => runs,
    ports: { chunkRows: mirror, files: createTranscriptFileReader(), journal, log, now: () => Date.now(), timer: systemStepTimer },
    limits: () => limitsNow,
    report: (level, code, _message, _sessionId, more) => void reports.push({ level, code, cause: more['cause'] ?? null }),
  });
  return {
    session,
    log,
    reports,
    asked,
    async seal(snapshot, limits = SHORT, maxCalls = 400) {
      limitsNow = limits;
      const failures: string[] = [];
      let waiting = 0;
      for (let calls = 1; calls <= maxCalls; calls += 1) {
        let result: FinalizeTranscriptResult;
        try {
          result = await step.finalize({ sessionId: session.sessionId, sttSnapshot: snapshot, attempt: 1 });
        } catch (error) {
          if (!(error instanceof FinalizeTranscriptError)) throw error;
          failures.push(error.code);
          if (failures.length > TRANSCRIPT_RETRIES_PER_RUN) throw error;
          continue;
        }
        if (result.status === 'DONE' || calls === maxCalls) return { result, calls, waiting, failures };
        waiting += 1;
        await new Promise<void>((resolve) => setTimeout(resolve, Math.max(1, Math.min(20, result.remainingWaitMs))));
      }
      throw new Error('unreachable');
    },
  };
}

const AVAILABLE = { kind: 'AVAILABLE' } as const;
function done(result: FinalizeTranscriptResult): Extract<FinalizeTranscriptResult, { status: 'DONE' }> {
  if (result.status !== 'DONE') throw new Error(`the step answered ${result.status}`);
  return result;
}
/** Row 83's builder and its cross-field rules take the block as it is: one of the four shapes of the spec. */
const accepted = (result: Extract<FinalizeTranscriptResult, { status: 'DONE' }>): unknown => buildUnsignedManifest({ ...exampleManifestInput(), transcript: result.transcript.manifest }, EXAMPLE_SOURCE_ROWS).transcript.state;

describe('STT enabled and a transcriber session exists', () => {
  it('the transcript is finished: the session seals ASSEMBLED with its document; the transcriber is asked to assemble, never to close out', async () => {
    const r = rig(AVAILABLE);
    await r.session.finish();
    const sealed = await r.seal(snapshotOf());
    const result = done(sealed.result);
    expect(result.transcript.manifest).toMatchObject({ state: 'ASSEMBLED', failedChunks: 0, disabledReason: null, backendUnreachable: false, configSnapshot: snapshotOf() });
    expect(result.files).toEqual(r.session.files);
    expect(result.transcript.transcriptRow).not.toBeNull();
    expect(result.transcript.waitLimitReached).toBe(false);
    expect([sealed.calls, sealed.waiting, sealed.failures]).toEqual([1, 0, []]);
    expect(r.asked).toEqual(['availability', 'assemble']);
    expect(accepted(result)).toBe('ASSEMBLED');
  });

  it('the transcriber never answers: the step waits to THE BOUND OF THE SPEC (its setting, short here), closes the transcript out and the session seals PARTIAL - no text made up, never a wait without end', async () => {
    // The engine of the session hangs on its first chunk and never comes back.
    const r = rig(AVAILABLE, { engineGate: () => new Promise<void>(() => {}) });
    void r.session.runner.step({ final: true });
    const sealed = await r.seal(snapshotOf());
    const result = done(sealed.result);
    expect(result.transcript.manifest).toMatchObject({ state: 'PARTIAL', disabledReason: null });
    expect(result.transcript.manifest.failedChunks).toBe(3);
    expect(result.transcript.counters).toEqual({ chunks: 3, failedChunks: 3, segments: 0 });
    expect(result.transcript.waitLimitReached).toBe(true);
    // It WAITED first (asked more than once), and only then closed out, once, with the step's own code.
    expect(sealed.waiting).toBeGreaterThanOrEqual(1);
    expect(r.asked.filter((entry) => entry.startsWith('closeOut'))).toEqual(['closeOut TIMEOUT']);
    expect(r.asked.indexOf('closeOut TIMEOUT')).toBeGreaterThan(r.asked.indexOf('assemble'));
    // The engine was asked for the one chunk it hangs on; the close-out refused the rest without asking it.
    expect(r.session.decoded.length).toBe(1);
    expect(accepted(result)).toBe('PARTIAL');
  });

  it('CONTROL of the bound: the same silent transcriber under a bound that is not reached is still WAITING - the PARTIAL above comes from the bound, not from the composition', async () => {
    const r = rig(AVAILABLE, { engineGate: () => new Promise<void>(() => {}) });
    void r.session.runner.step({ final: true });
    const waiting = await r.seal(snapshotOf(), { stepLimitMs: 3_600_000, callLimitMs: 50, closeOutLimitMs: 60_000 }, 6);
    expect(waiting.result.status).toBe('WAITING');
    expect([waiting.calls, waiting.failures]).toEqual([6, []]);
    expect(r.asked.some((entry) => entry.startsWith('closeOut'))).toBe(false);
  });
});

describe('nothing is waited for when no transcript can come', () => {
  it('STT disabled in the snapshot: DISABLED at once; the transcription unit is asked nothing', async () => {
    const r = rig(AVAILABLE);
    const sealed = await r.seal(snapshotOf({ enabled: false }));
    const result = done(sealed.result);
    expect(result.transcript.manifest).toMatchObject({ state: 'DISABLED', disabledReason: 'DISABLED_BY_CONFIGURATION', configSnapshot: { enabled: false } });
    expect([sealed.calls, result.files, r.asked, r.reports]).toEqual([1, null, [], []]);
    expect(accepted(result)).toBe('DISABLED');
  });

  it('STT enabled and the transcriber can hand over nothing (here: the provenance of its model is not known): sealed PARTIAL without a document, by name, WITHOUT waiting the bound of a session that transcribes', async () => {
    const r = rig({ kind: 'UNAVAILABLE', code: 'MODEL_PROVENANCE_UNKNOWN' });
    // The bound of a transcribing session is an hour here: it must not be what this seal waits.
    const sealed = await r.seal(snapshotOf(), { stepLimitMs: 3_600_000, callLimitMs: 30_000, closeOutLimitMs: 60_000 }, 8);
    const result = done(sealed.result);
    expect(result.transcript.manifest).toMatchObject({ state: 'PARTIAL', disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', file: null, sha256: null, configSnapshot: snapshotOf() });
    expect([result.files, result.transcript.transcriptRow]).toEqual([null, null]);
    // Row 119's last resort, reached at the step's own attempt bound (one failed close-out is the bound here).
    expect(result.transcript.unavailable).toMatchObject({ by: 'ATTEMPT_BOUND', failures: 1, lastFailure: 'TRANSCRIPT_CLOSE_OUT_FAILED' });
    // Asked what can be had, once; never asked for a transcript.
    expect(r.asked).toEqual(['availability']);
    expect(r.reports).toEqual([{ level: 'error', code: SealTranscriptCode.TRANSCRIPT_UNAVAILABLE, cause: 'MODEL_PROVENANCE_UNKNOWN' }]);
    expect(sealed.calls).toBeLessThanOrEqual(4);
    expect(accepted(result)).toBe('PARTIAL');
  });

  it('NO SNAPSHOT (a session recorded before row 71c): never DISABLED - sealed as unavailable at the seal, field 123 says that nothing was recorded, and the error log says why', async () => {
    const r = rig(AVAILABLE);
    const sealed = await r.seal(NO_STT_SNAPSHOT_RECORDED, { stepLimitMs: 3_600_000, callLimitMs: 30_000, closeOutLimitMs: 60_000 }, 8);
    const result = done(sealed.result);
    expect(result.transcript.manifest).toMatchObject({ state: 'PARTIAL', disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', file: null, backendUnreachable: false, configSnapshot: { enabled: true, model: 'not-recorded' } });
    expect(result.files).toBeNull();
    // The transcription unit is not even asked: a session without a snapshot ran no transcriber.
    expect(r.asked).toEqual([]);
    expect(r.reports).toEqual([{ level: 'error', code: SealTranscriptCode.SNAPSHOT_MISSING, cause: null }]);
    expect(accepted(result)).toBe('PARTIAL');
  });

  it('R80-07: a session whose REAL snapshot names a model `not-recorded` (a valid identifier) HAS a snapshot - it is asked for and sealed with its document, never mistaken for "no snapshot"', async () => {
    const r = rig(AVAILABLE);
    await r.session.finish();
    // Member for member the fixed stand-in, and NOT it: a row of `session_stt_config` the session really wrote.
    const real = { ...NO_STT_SNAPSHOT_RECORDED, revision: 4 };
    const sealed = await r.seal(real);
    const result = done(sealed.result);
    expect(result.transcript.manifest).toMatchObject({ state: 'ASSEMBLED', disabledReason: null, configSnapshot: { model: 'not-recorded', revision: 4 } });
    expect(result.transcript.transcriptRow).not.toBeNull();
    expect(r.asked).toEqual(['availability', 'assemble']);
    expect(r.reports).toEqual([]);
  });

  it('R80-07: when the stand-in reaches the step as a COPY (not the reader\'s own object) the transcription unit is asked, and its answer NO_SNAPSHOT is reported under the same code', async () => {
    const r = rig({ kind: 'NO_SNAPSHOT' });
    const sealed = await r.seal({ ...NO_STT_SNAPSHOT_RECORDED }, { stepLimitMs: 3_600_000, callLimitMs: 30_000, closeOutLimitMs: 60_000 }, 8);
    const result = done(sealed.result);
    expect(result.transcript.manifest).toMatchObject({ state: 'PARTIAL', disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', file: null });
    expect(r.asked).toEqual(['availability']);
    expect(r.reports).toEqual([{ level: 'error', code: SealTranscriptCode.SNAPSHOT_MISSING, cause: null }]);
  });

  it('the bounds of a step that has nothing to wait for are the smallest the step admits', () => {
    expect(NO_TRANSCRIPT_LIMITS).toEqual({ stepLimitMs: 2, callLimitMs: 1, closeOutLimitMs: 1, closeOutAttempts: 1 });
  });
});

// Integration pass D9, item 1 (decision D160): the provenance of the STT model is recorded as far
// as the Core can know it. The pipeline is the real one of `@dems/transcriber`; the engine is the
// double of the shared rig. The package of the last case has real bytes, real hashes and a real
// signature (row 83's `sealPackage`), and TODAY's verifier reads it from disk unchanged.
afterAll(removePackages);
const SERVER_PROVENANCE: TranscriptModelProvenance = { name: 'ggml-large-v3-turbo', version: null, quantisation: null, sha256: null };

describe('the model provenance of a sealed transcript follows the backend of the session snapshot (D160)', () => {
  it('a SERVER backend, STT enabled: the session seals ASSEMBLED with its document; field 84 is the name, fields 85-87 are null, in the manifest block, the row of `transcripts` and the manifest builder', async () => {
    const r = rig(AVAILABLE, { backend: 'omlx-server' }, SERVER_PROVENANCE);
    await r.session.finish();
    const snapshot = snapshotOf({ backend: 'omlx-server' });
    const result = done((await r.seal(snapshot)).result);
    expect(result.transcript.manifest).toMatchObject({ state: 'ASSEMBLED', file: 'transcript/transcript.json', failedChunks: 0, disabledReason: null, configSnapshot: snapshot });
    expect(result.transcript.manifest.model).toEqual({ name: 'ggml-large-v3-turbo', version: null, quantisation: null, modelSha256: null });
    expect(result.transcript.transcriptRow?.model).toEqual({ name: 'ggml-large-v3-turbo', version: null, quantisation: null, modelSha256: null, params: { backend: 'omlx-server', modelId: 'ggml-large-v3-turbo', language: 'id' } });
    expect(accepted(result)).toBe('ASSEMBLED');
  });

  it('cpu-local, STT enabled: unchanged - ASSEMBLED with all four members', async () => {
    const r = rig(AVAILABLE);
    await r.session.finish();
    const result = done((await r.seal(snapshotOf())).result);
    expect(result.transcript.manifest.model).toEqual({ name: MODEL.name, version: MODEL.version, quantisation: MODEL.quantisation, modelSha256: MODEL.sha256 });
    expect(accepted(result)).toBe('ASSEMBLED');
  });

  it('CONTROL: a server session whose transcriber is handed an invented version, quantisation and hash never seals them - no document with those values leaves the step', async () => {
    const r = rig(AVAILABLE, { backend: 'omlx-server' }, { ...SERVER_PROVENANCE, version: MODEL.version, quantisation: MODEL.quantisation, sha256: MODEL.sha256 });
    await r.session.finish();
    const outcome = await r.seal(snapshotOf({ backend: 'omlx-server' })).then(
      (sealed) => done(sealed.result).transcript.manifest,
      (error: unknown) => (error instanceof FinalizeTranscriptError ? error.code : Promise.reject(error)),
    );
    if (typeof outcome !== 'string') expect([outcome.file, outcome.model]).toEqual([null, { name: null, version: null, quantisation: null, modelSha256: null }]);
    expect(typeof outcome === 'string' ? outcome : outcome.disabledReason).toMatchInlineSnapshot(`"TRANSCRIBER_FAILED"`);
  });

  it('CONTROL: cpu-local with the three nulls of a server is not sealed either', async () => {
    const r = rig(AVAILABLE, {}, SERVER_PROVENANCE);
    await r.session.finish();
    const outcome = await r.seal(snapshotOf()).then(
      (sealed) => done(sealed.result).transcript.manifest,
      (error: unknown) => (error instanceof FinalizeTranscriptError ? error.code : Promise.reject(error)),
    );
    if (typeof outcome !== 'string') expect(outcome.file).toBeNull();
    expect(typeof outcome === 'string' ? outcome : outcome.disabledReason).toMatchInlineSnapshot(`"TRANSCRIBER_FAILED"`);
  });

  it("TODAY'S VERIFIER on the sealed server-backend package (not edited by this pass; the report line is requested of pass D10)", async () => {
    const r = rig(AVAILABLE, { backend: 'omlx-server' }, SERVER_PROVENANCE);
    await r.session.finish();
    const result = done((await r.seal(snapshotOf({ backend: 'omlx-server' }))).result);
    const sealed = await sealPackage({ transcript: result.transcript.manifest, files: result.files });
    expect(sealed.manifest.transcript.model).toEqual({ name: 'ggml-large-v3-turbo', version: null, quantisation: null, modelSha256: null });
    const verdict = await verifyPackageV2(corePorts(sealed.dir, sealed.opener, 256), { plaintext: 'REQUIRED', expected: sealed.anchors });
    expect({ ok: verdict.ok, overall: verdict.overall, failing: verdict.checks.filter((check) => check.status !== 'PASS').map((check) => [check.id, check.status, check.findings.map((finding) => finding.code)]), transcript: verdict.transcript, state: verdict.transcriptState.code }).toMatchInlineSnapshot(`
      {
        "failing": [],
        "ok": true,
        "overall": "PASS",
        "state": "READY",
        "transcript": {
          "revisions": 0,
          "state": "VERIFIED",
        },
      }
    `);
  });
});
