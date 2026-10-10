/**
 * THE COMPOSITION OF THE SEALING PIPELINE IN THE RUNNING CORE (blueprint row 82b, M7; controller
 * ruling D147 (E); evidence package spec §E.1-§E.6; capture spec §D.2; decisions D67, D133, D138,
 * D144). A CLOSED UNIT: other units import this index only.
 *
 * `src/sealing` is a library: it holds no key, opens no connection and names no clock. This unit
 * is where the Core puts it to work, IN REAL CAPTURE MODES ONLY:
 *
 *   ports      the production `SealingPorts`: the journal and the fragment rows on the runtime
 *              pool, the seal-time cipher over the session key `KID-<sessionId>` of the credential
 *              store (`session-key.ts`), the one fragment opener of the Core, the signer of
 *              `<dataDir>/signer` (loaded when a seal first needs it), the session record
 *              (`session-reader.ts`), row 79's transcript step, the engine's seal doors with the
 *              sealed transcript's row committed in the unit of the item;
 *   hand-off   `sealOnCaptureHandOff` on `sessionCapture(app)`: STOPPED starts the normal seal,
 *              INTERRUPTED the interrupted durable-prefix seal, FAILED_START nothing;
 *   RECOVERY   one boot step after the engine's: the controller's `resume()` for a session a
 *              process start found mid-seal or mid-recording. The boot does not wait for the
 *              seal: it runs in the background and the session says where it stands;
 *   verify     the verification of a REAL sealed package for operation 41
 *              (`evidenceVerification(app).provide`), its verdict recorded through the engine's
 *              `recordEvidenceVerification`.
 *
 * IN CAPTURE MODE `simulated` NOTHING OF THIS EXISTS: no port is built, no listener is added, no
 * boot step is registered, no verification is provided - the simulator's own timed seal is the
 * seal, exactly as before this row. Operation 83 is answered in both modes (`modules/sealing`)
 * from the session's `finalization` slice (`progress.ts`).
 *
 * A SEAL THAT FAILS leaves what the pipeline leaves: the FAILED row of its step in `sealing_jobs`,
 * the entry in the persistent error log, and the session in FINALIZING with that step in `error`
 * and a sentence an operator reads as its `detail`. No item is committed, so nothing is presented
 * as sealed. A run that could not even start (the journal or the session record could not be
 * read) is recorded the same way by this unit (`SEALING_RUN_REJECTED`). The next attempt is the
 * next process start (`resume()`), one attempt per start.
 *
 * NOTHING HERE READS A CAMERA FILE OR HOLDS A HANDLE: every file handle is the pipeline's and is
 * closed by it on every path (its `finally` blocks); this unit keeps one listener, removed at close.
 */
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { CaptureOperation } from '../capture/adapters';
import { captureOperationOf } from '../capture/fence';
import { readSessionCaptureFacts, readSessionVideoSampleEntry, sessionCapture } from '../capture-session';
import type { UnitContext } from '../core';
import { sealDoorsOf } from '../engine';
import { coreFragmentOpener, createRealEvidenceVerification, hasSealedPackageHere, sessionPackageDir } from '../evidence-verify';
import { evidenceVerification } from '../modules/evidence';
import { VIDEO_TRACK_IDS, createRecordingFragmentStore } from '../modules/recording-fragments';
import { createTranscriptChunkStore } from '../modules/transcript-chunks';
import { createTranscriptStore } from '../modules/transcripts';
import { describeError } from '../plugins/logger';
import {
  SEALING_STEP_ORDER,
  SealingError,
  SealingFailure,
  SealingStop,
  commitSealedTranscript,
  createSealingController,
  createSealingPipeline,
  createSealingStepJournal,
  createTranscriptFileReader,
  durableMediaOnDisk,
  loadSealingSigner,
  sealEngineOf,
  sealOnCaptureHandOff,
  sealingFailureReason,
  systemStepTimer,
  type FinalizeTranscriptLimits,
  type SealOutcome,
  type SealingController,
  type SealingEngineHost,
  type SealingPorts,
} from '../sealing';
import { transcriptionControl } from '../transcription';
import { coreFragmentSealer } from './session-key';
import { SEAL_NOTICE, createSealSessionReader } from './session-reader';
import { createSealTranscriptStep, type SealTranscriptRuns } from './transcript-step';

export { isTimedSeal, sealingProgressOf } from './progress';
export { sessionKeyIdOf } from './session-key';
// Row 82c: the seed-time generator of the v2 demo packages (called by the seed hook, never by a session).
export * from './demo-seed';
export { NO_STT_SNAPSHOT_RECORDED, SEAL_NOTICE, STAND_INS, STT_SNAPSHOT_NOT_RECORDED_MODEL, isSttSnapshotNotRecorded } from './session-reader';
export { NO_TRANSCRIPT_LIMITS, SealTranscriptCode, createSealTranscriptStep, type SealTranscriptRuns, type SealTranscriptStepOptions } from './transcript-step';

const SOURCE = 'sealingHost';
/** The boot step of RECOVERY. Registered after the engine's, so the committed state is there. */
export const SEALING_RESUME_BOOT_STEP = 'sealing.resume';
/** The offset the manifest states its instants in (the Core's one timezone, `clock.tz` of the state). */
const TIMEZONE = '+07:00';

/**
 * WHAT AN OPERATOR READS when a seal was asked for a session that holds nothing durable (row 71c;
 * the capture side's `CAPTURE_NOT_DURABLE`, D84): the sentence of the first step in the session
 * record, and so operation 83 and the Finalizing screen. No item is made of such a session.
 */
export const SEAL_NOTHING_DURABLE_REASON = 'Nothing durable was recorded for this session (CAPTURE_NOT_DURABLE): no evidence item is made.';

/** What a test, or a later row, may put in place of the composition's defaults. Before the first seal. */
export interface SealingHostSettings {
  /** THE BOUND of the transcript step for a session whose transcript can be had (row 116). Default: `FINALIZE_TRANSCRIPT_LIMITS`. */
  readonly transcriptLimits: FinalizeTranscriptLimits;
  /** The transcriber sessions the transcript step asks. Default: `transcriptionControl(app).runs`. */
  readonly transcriptRuns: SealTranscriptRuns;
}

export interface SealingHost {
  /** True in a real capture mode: the pipeline is composed and listens. False: nothing is. */
  readonly mounted: boolean;
  /** The controller of the composed pipeline. Null in capture mode `simulated`. */
  controller(): SealingController | null;
  /** The end of the last run this unit started or joined, or null. */
  lastOutcome(): SealOutcome | null;
  /** Resolves when no run this unit started is under way. For a test and for a shutdown. */
  settled(): Promise<void>;
  /** Replaces settings of the composition. While no run is under way; does nothing in capture mode `simulated`. */
  replace(next: Partial<SealingHostSettings>): void;
}

const hosts = new WeakMap<object, SealingHost>();
const INERT: SealingHost = Object.freeze({ mounted: false, controller: () => null, lastOutcome: () => null, settled: async () => {}, replace: () => {} });

/** The sealing host of an app: what `mountSealingHost` built, or the inert one. */
export function sealingHost(app: { readonly stages: object }): SealingHost {
  return hosts.get(app.stages) ?? INERT;
}

/** Called ONCE, by `modules/sealing`. Does nothing in capture mode `simulated`. */
export function mountSealingHost(app: FastifyInstance): SealingHost {
  if (hosts.has(app.stages)) throw new Error('the sealing host was mounted twice');
  // The ONE reader of the capture mode (static rule G-R16): a refused combination answers SIMULATED.
  const operation = captureOperationOf(app.config);
  if (operation === CaptureOperation.SIMULATED) {
    hosts.set(app.stages, INERT);
    return INERT;
  }

  const mediaStoreDir = app.config.mediaStoreDir;
  const packageDir = (sessionId: string): string => sessionPackageDir(mediaStoreDir, sessionId);
  const now = (): number => app.clock.now();
  let last: SealOutcome | null = null;
  const settings: { transcriptLimits?: FinalizeTranscriptLimits; transcriptRuns?: SealTranscriptRuns } = {};
  const pending = new Set<Promise<unknown>>();
  const track = <Value>(run: Promise<Value>): Promise<Value> => {
    pending.add(run);
    void run.then(
      () => pending.delete(run),
      () => pending.delete(run),
    );
    return run;
  };

  function persist(level: 'error' | 'warn', code: string, message: string, err: unknown, context: Record<string, string | number | boolean | null>): void {
    if (level === 'error') app.log.error({ err, code, ...context }, message);
    else app.log.warn({ code, ...context }, message);
    app.errorLog.append({ level, source: SOURCE, message, ...(err === null || err === undefined ? {} : describeError(err)), code, context });
  }

  const engine = (): SealingEngineHost => sealDoorsOf(app.engine) as unknown as SealingEngineHost;

  // The signer of `<dataDir>/signer`, loaded when a seal first reads it: a Core without a usable
  // key fails the step that needs it (`SIGNER_FAILED`), it does not fail to start.
  let signing: SealingPorts['signing'] | null = null;
  const signingNow = (): SealingPorts['signing'] => (signing ??= loadSealingSigner({ dataDir: app.config.dataDir, now: now() }));

  /** Built at the first use: the pool exists after `ready()`. */
  let composed: { readonly controller: SealingController; readonly ports: SealingPorts } | null = null;
  function compose(): { readonly controller: SealingController; readonly ports: SealingPorts } {
    if (composed !== null) return composed;
    const pool = app.db.pool;
    const journal = createSealingStepJournal(pool);
    const fragments = createRecordingFragmentStore(pool);
    const transcription = (): ReturnType<typeof transcriptionControl> | null => {
      try {
        return transcriptionControl(app);
      } catch {
        return null;
      }
    };
    const ports: SealingPorts = {
      journal,
      fragments,
      sealer: coreFragmentSealer(app),
      opener: coreFragmentOpener(app),
      session: createSealSessionReader({
        state: () => app.engine.state(),
        db: () => pool,
        begin: async (sessionId) => {
          await sealDoorsOf(app.engine).applySealingProgress({ sessionId, steps: [] });
        },
        // The session's own row of `session_stt_config` (written in the unit of its start, row 71c); null: it has none.
        sttSnapshot: async (sessionId) => (await transcription()?.manifestSnapshot(sessionId)) ?? null,
        // What the capture side kept of the session while it recorded: camera clock offsets, first video samples.
        captureFacts: (sessionId) => readSessionCaptureFacts(mediaStoreDir, sessionId),
        // Field 43 (pass D9): the codec is what the camera file's own init segment says, never the plan's profile.
        videoSampleEntry: (sessionId, trackId) => readSessionVideoSampleEntry(packageDir(sessionId), trackId),
        notice: operation === CaptureOperation.REAL_DEVELOPMENT ? SEAL_NOTICE.REAL_DEVELOPMENT : SEAL_NOTICE.REAL_PRODUCTION,
        timezone: TIMEZONE,
        onNoSttSnapshot: (sessionId) => app.log.warn({ code: 'SEALING_NO_STT_SNAPSHOT', source: SOURCE, sessionId }, 'the session has no STT snapshot: the manifest says that none was recorded'),
        onForeignCaptureFacts: (sessionId) => persist('warn', 'SEALING_CAPTURE_FACTS_FOREIGN', 'the capture facts kept under this session ID are of another session: they are not used', null, { sessionId }),
      }),
      // Row 79's step, with the transcriber seam of THIS session (`transcript-step.ts`): never a wait for a transcript that cannot come.
      transcript: createSealTranscriptStep({
        runs: () => settings.transcriptRuns ?? transcription()?.runs ?? null,
        ports: { chunkRows: createTranscriptChunkStore(pool), files: createTranscriptFileReader(), journal, log: app.errorLog, now, timer: systemStepTimer },
        ...(settings.transcriptLimits === undefined ? {} : { limits: () => settings.transcriptLimits as FinalizeTranscriptLimits }),
        report: (level, code, message, sessionId, more) => persist(level, code, message, null, { sessionId, ...more }),
      }),
      get signing() {
        return signingNow();
      },
      engine: sealEngineOf(engine, async (unit: UnitContext, evidenceId, transcript, sealedAt) => {
        await commitSealedTranscript(createTranscriptStore(unit), { evidenceId, transcript, createdAt: sealedAt });
      }),
      packageDir,
      stagingDir: (sessionId) => join(mediaStoreDir, '.sealing', sessionId),
      log: app.errorLog,
      now,
      timer: systemStepTimer,
    };
    const controller = createSealingController({
      pipeline: createSealingPipeline(ports),
      engine,
      hasDurableMedia: async (sessionId) => {
        for (const trackId of VIDEO_TRACK_IDS) if ((await fragments.read(sessionId, trackId)).length > 0) return true;
        return durableMediaOnDisk(packageDir(sessionId));
      },
      hasSealingRows: async (sessionId) => {
        for (const step of SEALING_STEP_ORDER) if ((await journal.read(sessionId, step)) !== null) return true;
        return false;
      },
      // Row 82c (F-86-2): a seal that began and whose six rows do not all say DONE - what a SEALED session must never keep.
      hasOpenSealingRows: async (sessionId) => {
        const rows = await Promise.all(SEALING_STEP_ORDER.map((step) => journal.read(sessionId, step)));
        return rows.some((row) => row !== null) && rows.some((row) => row === null || row.status !== 'DONE');
      },
      onOutcome: (outcome) => {
        last = outcome;
        if (outcome.status === 'SEALED') app.log.info({ code: 'SEALING_COMPLETE', source: SOURCE, sessionId: outcome.sessionId, evidenceId: outcome.evidenceId, attempt: outcome.attempt, interrupted: outcome.interrupted }, 'a session was sealed');
        // A FAILED run is in the error log already (the pipeline wrote it, with its step and code).
        else if (outcome.status === 'FAILED') app.log.error({ code: outcome.code, source: SOURCE, sessionId: outcome.sessionId, step: outcome.step, attempt: outcome.attempt, retriable: outcome.retriable }, 'the seal of a session failed');
        else {
          persist('warn', 'SEALING_NOTHING_DURABLE', 'a seal was asked for a session that holds nothing durable: no item is made', null, { sessionId: outcome.sessionId });
          // The session is told, so that it never stays in STOPPING or FAULT without a word (row 71c, item 4 (c)).
          void track(nothingDurable(outcome.sessionId));
        }
      },
    });
    composed = { controller, ports };
    return composed;
  }

  /**
   * A run that REJECTED (it could not read its rows or the session record, or a defect): the
   * failure goes to the error log, and the session is told, so that it never stays in STOPPING or
   * FAULT without a word. `SealingStop` is a test's kill: a killed process writes nothing.
   */
  async function rejected(sessionId: string, error: unknown): Promise<void> {
    if (error instanceof SealingStop) return;
    const code = error instanceof SealingError ? error.code : SealingFailure.STEP_FAILED;
    persist('error', 'SEALING_RUN_REJECTED', 'a sealing run could not start or ended without an outcome', error, { sessionId, failure: code });
    try {
      const first = SEALING_STEP_ORDER[0];
      await sealDoorsOf(app.engine).applySealingProgress({
        sessionId,
        steps: SEALING_STEP_ORDER.map((id) => ({ id, status: id === first ? ('FAILED' as const) : ('PENDING' as const), progress: 0, etaMs: null, attempt: 1, detail: id === first ? sealingFailureReason(code) : null })),
      });
    } catch (second) {
      persist('error', 'SEALING_REJECTION_NOT_TOLD', 'the session could not be told that its seal did not start', second, { sessionId });
    }
  }

  /** A seal that found nothing durable: the session record says so in a sentence an operator reads. */
  async function nothingDurable(sessionId: string): Promise<void> {
    try {
      const first = SEALING_STEP_ORDER[0];
      await sealDoorsOf(app.engine).applySealingProgress({
        sessionId,
        steps: SEALING_STEP_ORDER.map((id) => ({ id, status: id === first ? ('FAILED' as const) : ('PENDING' as const), progress: 0, etaMs: null, attempt: 1, detail: id === first ? SEAL_NOTHING_DURABLE_REASON : null })),
      });
    } catch (error) {
      persist('error', 'SEALING_NOTHING_DURABLE_NOT_TOLD', 'the session could not be told that nothing durable was recorded for it', error, { sessionId });
    }
  }

  /** The controller's `seal`, with the rejection handled: what the hand-off and RECOVERY call. */
  const controller: SealingController = {
    seal: (sessionId, cause) => track(compose().controller.seal(sessionId, cause)),
    decide: () => compose().controller.decide(),
    resume: () => track(compose().controller.resume()),
    running: () => composed?.controller.running() ?? null,
  };

  const host: SealingHost = {
    mounted: true,
    controller: () => controller,
    lastOutcome: () => last,
    async settled() {
      while (pending.size > 0) await Promise.allSettled(pending);
    },
    replace(next) {
      if (pending.size > 0 || composed !== null) throw new Error('the settings of the sealing host are replaced before its first seal only');
      Object.assign(settings, next);
    },
  };
  hosts.set(app.stages, host);

  // THE HAND-OFF (ruling D144): the listener returns at once; the seal runs in the background.
  let off: (() => void) | null = null;
  app.addHook('onReady', async () => {
    off = sealOnCaptureHandOff({
      capture: sessionCapture(app),
      controller: { seal: (sessionId, cause) => controller.seal(sessionId, cause) },
      onError: (sessionId, error) => void track(rejected(sessionId, error)),
      // The manifest has no member for what the worker skipped before the first keyframe (spec question of row 82): it is kept in the log of the seal.
      onFirstVideo: (sessionId, firstVideo) => app.log.info({ code: 'SEALING_FIRST_VIDEO', source: SOURCE, sessionId, firstVideo }, 'the start of the camera files as the capture worker reported it'),
    });
  });
  app.addHook('onClose', async () => {
    off?.();
    off = null;
  });

  // RECOVERY: after the engine's boot step (this unit registers after the engine). Not awaited:
  // a seal may take as long as its media, and the Core is ready while it runs.
  app.readiness.addBootStep({
    id: SEALING_RESUME_BOOT_STEP,
    run: async () => {
      void controller.resume().then(
        (outcome) => {
          if (outcome !== null) app.log.info({ code: 'SEALING_RESUMED', source: SOURCE, sessionId: outcome.sessionId, status: outcome.status }, 'a seal was resumed at the start of the Core');
        },
        (error: unknown) => track(rejected(app.engine.state().session?.id ?? 'unknown', error)),
      );
    },
  });

  // OPERATION 41 for a REAL sealed package: the verification of row 85, composed here.
  evidenceVerification(app).provide(
    createRealEvidenceVerification({
      findItem: async (evidenceId) => {
        const item = app.engine.state().evidence.find((entry) => entry.id === evidenceId);
        // A REAL seal, or a demo item the seed SEALED into this store (pass E3; decision D-82c-7): never a frozen v1 demo item, whatever version the mapping reads for it.
        if (item === undefined || !hasSealedPackageHere(item as Parameters<typeof hasSealedPackageHere>[0])) return null;
        const transcriptSha256 = item.transcriptSha256 ?? null;
        const revisionCount = transcriptSha256 === null ? 0 : (await createTranscriptStore(app.db.pool).revisionHead(evidenceId)).revisionNo;
        return { evidenceId, sessionId: item.sessionId, manifestSha256: item.manifestHash, transcriptSha256, revisionCount };
      },
      packageDirOf: packageDir,
      now,
      opener: coreFragmentOpener(app),
      trustedCertificateSha256: () => {
        try {
          return [signingNow().certificate.sha256];
        } catch {
          // No usable signing key: no certificate is trusted, and V-02 fails closed.
          return [];
        }
      },
      record: async (principal, verdict) => {
        await sealDoorsOf(app.engine).recordEvidenceVerification({ ...verdict, failedTracks: [...verdict.failedTracks], actorId: principal.kind === 'OPERATOR' ? principal.operatorId : null });
      },
    }),
  );

  return host;
}
