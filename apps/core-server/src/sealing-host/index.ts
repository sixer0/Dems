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
 * read) is recorded the same way by this unit (`SEALING_RUN_REJECTED`).
 *
 * EVERY FAILED SEAL HAS A WAY OUT (fix pass F-M7b; R88-02 (a) + (c); `sealing/pipeline/way-out.ts`):
 * the end of every run goes to the way out, which RETRIES it in this process after a bounded
 * back-off (`SealingHostSettings.sealRetry`, default `SEAL_RETRY_DEFAULTS`: 5 s, 30 s, 120 s),
 * leaves a retriable cause that outlived them to the next start (`resume()`) and to the recovery
 * operation (`retryFailedSeal`), and ends a session that cannot be sealed as UNSEALABLE: its files
 * moved to `<mediaStoreDir>/.quarantine/<sessionId>/`, the session ended through the engine's
 * unsealable door, the Core free for the next session. A start of the Core lists what the
 * quarantine holds (`SEALING_QUARANTINE_HOLDS_SESSIONS`) and finishes a terminal outcome a
 * process end interrupted, before it resumes anything.
 *
 * NOTHING HERE READS A CAMERA FILE OR HOLDS A HANDLE: every file handle is the pipeline's and is
 * closed by it on every path (its `finally` blocks); this unit keeps one listener, removed at close.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { CaptureOperation } from '../capture/adapters';
import { captureOperationOf } from '../capture/fence';
import { readSessionCaptureFacts, readSessionVideoFormat, readSessionVideoSampleEntry, removeSessionCaptureFacts, sessionCapture } from '../capture-session';
import type { UnitContext } from '../core';
import { SEAL_BLOCKED_REASON, sealDoorsOf, sealingNoticeDoorsOf, unsealableDoorsOf } from '../engine';
import { provideCoreEvidenceExport } from '../evidence-export';
import { coreFragmentOpener, createRealEvidenceVerification, hasSealedPackageHere, sessionPackageDir } from '../evidence-verify';
import { evidenceVerification } from '../modules/evidence';
import { VIDEO_TRACK_IDS, createRecordingFragmentStore } from '../modules/recording-fragments';
import { createTranscriptChunkStore } from '../modules/transcript-chunks';
import { createTranscriptStore } from '../modules/transcripts';
import type { Principal } from '../plugins/authenticate';
import { ApiFailure } from '../plugins/error-envelope';
import { describeError } from '../plugins/logger';
import {
  SEALING_QUARANTINE_DIR,
  SEALING_STEP_ORDER,
  SEAL_RETRY_DEFAULTS,
  SealingError,
  SealingFailure,
  SealingStop,
  commitSealedTranscript,
  createSealingController,
  createSealingPipeline,
  createSealingStepJournal,
  createSealWayOut,
  createTranscriptFileReader,
  durableMediaOnDisk,
  loadSealingSigner,
  sealEngineOf,
  sealInputWithTranscriptSummary,
  sealBlockedRestoreHint,
  sealOnCaptureHandOff,
  sealingCauseCodeOf,
  sealingFailureReason,
  sweepSealedSession,
  systemStepTimer,
  type FinalizeTranscriptLimits,
  type SealOutcome,
  type SealRetrySettings,
  type SealWayOut,
  type SealingController,
  type SealingEngineHost,
  type SealingPorts,
  type SessionFragmentSealer,
} from '../sealing';
import { transcriptionControl } from '../transcription';
import { coreFragmentSealer, sessionKeyStartRefusal, type SessionKeyStartRefusal } from './session-key';
import { SEAL_NOTICE, createSealSessionReader } from './session-reader';
// Closing pass Z1 (decision D207): the installation identity - manifest fields 20 / 21 and the boot rule.
import { installationIdentityOf, runInstallationIdentityBoot } from './installation-identity';
import { createSealTranscriptStep, type SealTranscriptRuns } from './transcript-step';

export { isTimedSeal, sealingProgressOf } from './progress';
export { sessionKeyIdOf, sessionKeyStartRefusal, type SessionKeyStartRefusal } from './session-key';
// Row 82c: the seed-time generator of the v2 demo packages (called by the seed hook, never by a session).
export * from './demo-seed';
export { NO_STT_SNAPSHOT_RECORDED, SEAL_NOTICE, STAND_INS, STT_SNAPSHOT_NOT_RECORDED_MODEL, isSttSnapshotNotRecorded } from './session-reader';
export { NO_TRANSCRIPT_LIMITS, SealTranscriptCode, createSealTranscriptStep, type SealTranscriptRuns, type SealTranscriptStepOptions } from './transcript-step';

const SOURCE = 'sealingHost';
/** The boot step of RECOVERY. Registered after the engine's, so the committed state is there. */
export const SEALING_RESUME_BOOT_STEP = 'sealing.resume';
/** The boot step that holds a production Core to its installation identity (closing pass Z1, D207). */
export const INSTALLATION_IDENTITY_BOOT_STEP = 'sealing.installation-identity';
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
  /** THE BOUNDS of the retries of a failed seal (fix pass F-M7b, R88-02 (a) + (c)). Default: `SEAL_RETRY_DEFAULTS`. */
  readonly sealRetry: SealRetrySettings;
  /**
   * DEVELOPMENT CAPTURE ONLY (fix wave K, driver S1; decision D220: a supported, reversible rig for
   * the blocked seal). A wrapper around the fragment sealer of the composition: the lane launcher of
   * the test support (`test/support/lane-seal-rig.ts`) puts a rig here that makes a seal of a
   * FAKE-source session fail with a cause the product already has, so that the product's own way
   * out runs. `replace` REFUSES it in every operation but REAL_DEVELOPMENT (`SealRigRefusedError`),
   * and no file under `src/` sets it: the product's entry point cannot switch it on.
   */
  readonly developmentSealer: (base: SessionFragmentSealer) => SessionFragmentSealer;
}

/** `replace({ developmentSealer })` outside development capture: the rig is refused, nothing is replaced. */
export const DEV_SEAL_RIG_REFUSED_CODE = 'DEV_SEAL_RIG_NOT_DEVELOPMENT';
export class SealRigRefusedError extends Error {
  readonly code = DEV_SEAL_RIG_REFUSED_CODE;
  readonly operation: string;
  constructor(operation: string) {
    super('a development seal rig is admitted in development capture (REAL_DEVELOPMENT) only');
    this.name = 'SealRigRefusedError';
    this.operation = operation;
  }
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
  /**
   * THE RETRY ON DEMAND (fix pass F-M7b, R88-02 (a); called by the recovery operation): when
   * `sessionId` is the open session, FINALIZING with a FAILED sealing step, its seal is run again
   * now - the retries of this process counted from the first again - and the answer is true. False
   * for every other session and state, and in capture mode `simulated`: the caller then does what
   * it did before. Never awaited: the seal runs in the background.
   *
   * AUDITED (fix pass F-M7c, ruling D186 (8)): one row `RECOVERY_STARTED` with `details.reason:
   * SEAL_RETRY`, the session, the cause and step being retried, and the operator who asked: read
   * HERE from the principal the caller hands on as it is (pass F-Z; null when the caller hands none
   * or the principal is no operator).
   */
  retryFailedSeal(sessionId: string, principal?: Principal): boolean;
  /**
   * The same retry as a door with the shape of a hosted command (pass F-Z): a route module hands its
   * principal on, as it is, the way it hands it to the engine (rule M3 of the modules) and reads
   * no member of it. `hosted` names the action the caller runs otherwise; it is not read.
   */
  failedSeal(sessionId: string): { command(principal: Principal, hosted?: string): boolean };
  /**
   * BEFORE THE START OF A SESSION, outside every unit (fix wave I driver A1; G75b-01; ruling D216):
   * a session whose recording could not be sealed is refused HERE, before anything is recorded -
   * `503 NOT_READY` with `details.reason` `SESSION_KEY_NOT_OF_SESSION` (a key an earlier session of
   * the same number left in the key store) or `SESSION_KEY_STORE_UNAVAILABLE`. Nothing is changed:
   * the session stays as it was and can be cancelled. Does nothing in capture mode `simulated`.
   */
  beforeStart(sessionId: string): void;
  /**
   * Whether the seal of `sessionId` was RESUMED - run again by a START of this Core - as opposed to
   * a first run, a retry the Core made by itself (fix wave I; G75b-02: `resumed` of operation 83 said
   * "after restart" for an automatic retry) or the retry on demand of operation 33 (fix wave L;
   * G75d-09 (a): it said so with no restart). Null in capture mode `simulated`: the simulator's own
   * rule answers there.
   */
  resumedSeal(sessionId: string): boolean | null;
}

/** What a refused start says (`SessionKeyStartRefusal`): fixed text, no path and no key ID beyond the session's own number. */
export const SESSION_KEY_START_TEXT: Readonly<Record<SessionKeyStartRefusal, string>> = Object.freeze({
  SESSION_KEY_NOT_OF_SESSION:
    "This session cannot be started: a session key of an earlier session with this session number is in the Core's key store, so its recording could not be sealed. Nothing was recorded. Cancel this session and create a new one.",
  SESSION_KEY_STORE_UNAVAILABLE: "This session cannot be started: the Core's key store cannot be used, so its recording could not be sealed. Nothing was recorded.",
});

const hosts = new WeakMap<object, SealingHost>();
const INERT: SealingHost = Object.freeze({ mounted: false, controller: () => null, lastOutcome: () => null, settled: async () => {}, replace: () => {}, retryFailedSeal: () => false, failedSeal: () => ({ command: () => false }), beforeStart: () => {}, resumedSeal: () => null });

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
  // Closing pass Z1 (D207): the ONE read of the installation identity, at the mount.
  const installationIdentity = installationIdentityOf(app.config);
  const packageDir = (sessionId: string): string => sessionPackageDir(mediaStoreDir, sessionId);
  const now = (): number => app.clock.now();
  let last: SealOutcome | null = null;
  // Fix wave I (G75b-02): the sessions whose seal a START of this Core or the recovery action ran again. An automatic retry is not in it.
  const resumedSeals = new Set<string>();
  const settings: { transcriptLimits?: FinalizeTranscriptLimits; transcriptRuns?: SealTranscriptRuns; sealRetry?: SealRetrySettings; developmentSealer?: (base: SessionFragmentSealer) => SessionFragmentSealer } = {};
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
    // Fix wave I: a line without an error carries no `err` member (a null one was printed as an empty error object).
    if (level === 'error') app.log.error(err === null || err === undefined ? { code, ...context } : { err, code, ...context }, message);
    else app.log.warn({ code, ...context }, message);
    app.errorLog.append({ level, source: SOURCE, message, ...(err === null || err === undefined ? {} : describeError(err)), code, context });
  }

  const engine = (): SealingEngineHost => sealDoorsOf(app.engine) as unknown as SealingEngineHost;

  /**
   * Fix wave K: the sealer of the composition, behind the development rig when one was put in place
   * (REAL_DEVELOPMENT only, checked again HERE so that no later edit of `replace` can let one through).
   * One warn line says that this Core seals behind a rig - a Core that does must never do so silently.
   */
  function developmentSealerOver(base: SessionFragmentSealer): SessionFragmentSealer {
    const wrap = settings.developmentSealer;
    if (wrap === undefined || operation !== CaptureOperation.REAL_DEVELOPMENT) return base;
    persist('warn', 'SEALING_DEVELOPMENT_SEAL_RIG', 'this development Core seals behind a development seal rig: a seal of a generated-source session may be made to fail on purpose', null, {});
    return wrap(base);
  }

  // The signer of `<dataDir>/signer`, loaded when a seal first reads it: a Core without a usable
  // key fails the step that needs it (`SIGNER_FAILED`), it does not fail to start.
  let signing: SealingPorts['signing'] | null = null;
  const signingNow = (): SealingPorts['signing'] => (signing ??= loadSealingSigner({ dataDir: app.config.dataDir, now: now() }));

  /**
   * Fix wave K (G89b-01): the stream of a camera file is not what the selector configured. The manifest
   * states the stream; here the difference is SAID - one warn line per session and seal run in the log and
   * the error log, and ONE WARNING notice of the engine per session (profile codes only). Never throws:
   * a notice that could not be written must not cost a seal.
   */
  const profileDiffersTold = new Set<string>();
  async function noteProfileDiffers(sessionId: string, differences: readonly { readonly trackId: string; readonly configured: string; readonly stream: string }[]): Promise<void> {
    if (!profileDiffersTold.has(sessionId)) {
      profileDiffersTold.add(sessionId);
      persist('warn', 'SEALING_STREAM_PROFILE_DIFFERS', 'the video stream of a camera file is not the configured profile: the manifest states the stream', null, { sessionId, tracks: differences.map((entry) => `${entry.trackId}:${entry.stream}:${entry.configured}`).join(',') });
    }
    try {
      await sealingNoticeDoorsOf(app.engine).noteStreamProfileDiffers?.({ sessionId, tracks: differences.map((entry) => ({ ...entry })) });
    } catch (error) {
      persist('error', 'SEALING_STREAM_PROFILE_NOT_TOLD', 'the notice that a stream is not the configured profile could not be written', error, { sessionId });
    }
  }

  /** R80-04: set by `compose`. The transcription unit removes the folder by its own containment rule and never throws. */
  let discardTranscriberScratch: (sessionId: string, why: string) => void = () => {};

  /**
   * R80-04, AT A START OF THE CORE: the transcriber scratch of every session that is SEALED already
   * goes - a Core that ended between the commit of an item and the removal leaves a raw audio tap
   * behind. A session whose seal this start still has to run or to finish is left alone: its own
   * SEALED outcome removes its scratch. Never throws.
   */
  async function sweepSealedScratch(): Promise<void> {
    try {
      const decision = await compose().controller.decide();
      const pending = decision.action === 'NONE' ? null : decision.sessionId;
      const evidence = app.engine.state().evidence;
      const removed = transcriptionControl(app).sweepSessionScratch((sessionId) => sessionId !== pending && evidence.some((item) => item.sessionId === sessionId && item.integritySource === 'REAL' && item.status === 'SEALED'));
      if (removed.length > 0) app.log.info({ code: 'SEALING_TRANSCRIBER_SCRATCH_SWEPT', source: SOURCE, sessions: removed.length }, 'the transcriber scratch of sessions that were sealed already was removed at the start');
    } catch (error) {
      persist('error', 'SEALING_TRANSCRIBER_SCRATCH_NOT_SWEPT', 'the transcriber scratch of sealed sessions could not be examined at the start', error, {});
    }
  }

  /** F-M7c (R88-05 (c)): the engine's notice of kept plaintext. Resolves false when the session's notice is active already. */
  const noteKeptPlaintext: NonNullable<SealingPorts['engine']['noteKeptPlaintext']> = async (note) => (await sealingNoticeDoorsOf(app.engine).noteSealedPlaintextKept({ sessionId: note.sessionId, files: note.files.map((file) => ({ ...file })) })).value;

  /**
   * F-M7c (R88-05 (b)), AT A START OF THE CORE: EVERY sealed session - not only the current one -
   * has what its seal left undone finished: plaintext recordings removed by proof (with the
   * repeated decrypt-and-compare, R88-15), a file that fails the proof told and quarantined, orphan
   * part files removed, the journal row of the last step closed. The session this start still
   * seals or finishes through the pipeline is left to the pipeline. Never throws.
   */
  async function sweepSealedSessions(): Promise<void> {
    try {
      const { ports, controller } = compose();
      const decision = await controller.decide();
      const pending = decision.action === 'NONE' ? null : decision.sessionId;
      const open = app.engine.state().session;
      const seen = new Set<string>();
      let touched = 0;
      for (const item of app.engine.state().evidence) {
        if (item.integritySource !== 'REAL' || seen.has(item.sessionId) || item.sessionId === pending) continue;
        // The open session is the pipeline's while it is not SEALED.
        if (open !== null && open.id === item.sessionId && open.state !== 'SEALED') continue;
        seen.add(item.sessionId);
        const done = await sweepSealedSession({ packageDir, stagingDir: ports.stagingDir, quarantineDir: ports.quarantineDir, opener: ports.opener, fragments: ports.fragments, journal: ports.journal, log: app.errorLog, now, noteKeptPlaintext }, { sessionId: item.sessionId, manifestSha256: item.manifestHash });
        if (done.touched) {
          touched += 1;
          app.log.warn({ code: 'SEALING_SEALED_SESSION_FINISHED', source: SOURCE, sessionId: item.sessionId, recordingsRemoved: done.recordingsRemoved, recordingsKept: done.recordingsKept, recordingsQuarantined: done.recordingsQuarantined, orphansRemoved: done.orphansRemoved, journalClosed: done.journalClosed }, 'what a sealed session left on the evidence store was finished at the start of the Core');
        }
      }
      if (touched > 0) app.log.info({ code: 'SEALING_SEALED_SESSIONS_SWEPT', source: SOURCE, sessions: touched }, 'sealed sessions were finished at the start of the Core');
    } catch (error) {
      persist('error', 'SEALING_SEALED_SESSIONS_NOT_SWEPT', 'the sealed sessions could not be examined at the start of the Core', error, {});
    }
  }

  /** F-M7c (D186 (1)), AT A START: a seal that was left BLOCKED says so in the log again - the cause, and what restores it. */
  function reportBlockedSeal(): void {
    for (const alert of app.engine.state().alerts) {
      if (!alert.active || alert.kind !== 'SYSTEM' || alert.params?.['reason'] !== SEAL_BLOCKED_REASON) continue;
      const cause = typeof alert.params['cause'] === 'string' ? alert.params['cause'] : 'UNKNOWN';
      // Fix wave I (G75b-01): the closed cause code the alert carries, when it has one.
      const detail = typeof alert.params['detail'] === 'string' ? alert.params['detail'] : null;
      persist('error', 'SEALING_SESSION_BLOCKED', 'the seal of a session is BLOCKED since an earlier run of the Core: it is tried again now; the Core records no new session until it is sealed', null, { sessionId: alert.target ?? null, failure: cause, cause: detail ?? cause, restore: sealBlockedRestoreHint(cause, detail === null ? {} : { cause: detail }) });
    }
  }

  /** F-M7c (D186 (8)): the audit row of a retry on demand, with the cause the journal holds for the failed step. Never throws. */
  async function noteRetryOnDemand(sessionId: string, actorId: string | null): Promise<void> {
    try {
      let failed: { step: string; cause: string | null } | null = null;
      try {
        for (const step of SEALING_STEP_ORDER) {
          const row = await compose().ports.journal.read(sessionId, step);
          if (row !== null && row.status === 'FAILED') failed = { step, cause: row.errorCode };
        }
      } catch {
        // The journal cannot be read (that may be the very cause): the row is written without a cause, never skipped.
        failed = null;
      }
      await sealingNoticeDoorsOf(app.engine).noteSealRetryOnDemand({ sessionId, actorId, cause: failed?.cause ?? null, step: failed?.step ?? null });
    } catch (error) {
      persist('error', 'SEALING_RETRY_NOT_AUDITED', 'the audit row of a seal retry on demand could not be written', error, { sessionId });
    }
  }

  /** Built at the first use: the pool exists after `ready()`. */
  let composed: { readonly controller: SealingController; readonly ports: SealingPorts; readonly wayOut: SealWayOut } | null = null;
  function compose(): { readonly controller: SealingController; readonly ports: SealingPorts; readonly wayOut: SealWayOut } {
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
    const itemEngine = sealEngineOf(engine, async (unit: UnitContext, evidenceId, transcript, sealedAt) => {
      await commitSealedTranscript(createTranscriptStore(unit), { evidenceId, transcript, createdAt: sealedAt });
    });
    // R80-01: the item is committed WITH its transcript summary - the projection of the manifest block that was signed.
    const sealEngine: SealingPorts['engine'] = {
      ...itemEngine,
      completeSeal: (input, transcript) => itemEngine.completeSeal(sealInputWithTranscriptSummary(input, transcript), transcript),
      // F-M7c (R88-05 (c)): plaintext of a sealed session that must be kept - one alert + one audit row, before it is moved.
      noteKeptPlaintext,
    };
    discardTranscriberScratch = (sessionId, why) => {
      try {
        transcription()?.discardSessionScratch(sessionId, why);
      } catch (error) {
        persist('error', 'SEALING_TRANSCRIBER_SCRATCH_NOT_REMOVED', 'the transcriber scratch of a sealed session could not be removed', error, { sessionId });
      }
    };
    const ports: SealingPorts = {
      journal,
      fragments,
      // G89-06 (fix wave H driver A): the key of a session is bound to THAT session - the instant the engine created it -
      // so a key a cleared session of the same ID left behind is refused by name, never reused (`session-key.ts`).
      sealer: developmentSealerOver(
        coreFragmentSealer(app, (sessionId) => {
          const open = app.engine.state().session;
          return open !== null && open.id === sessionId ? `created-${String(open.createdAt)}` : null;
        }),
      ),
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
        // Field 36 (fix wave K, G89b-01; ruling D222 (2)): the stream's own picture size and measured frame rate, never the selector's profile.
        videoFormat: (sessionId, trackId) => readSessionVideoFormat(packageDir(sessionId), trackId),
        onProfileDiffers: (sessionId, differences) => void track(noteProfileDiffers(sessionId, differences)),
        notice: operation === CaptureOperation.REAL_DEVELOPMENT ? SEAL_NOTICE.REAL_DEVELOPMENT : SEAL_NOTICE.REAL_PRODUCTION,
        timezone: TIMEZONE,
        // Closing pass Z1 (D207): manifest fields 20 / 21 are the configured installation identity, read once at the mount.
        identity: installationIdentity,
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
      engine: sealEngine,
      packageDir,
      stagingDir: (sessionId) => join(mediaStoreDir, '.sealing', sessionId),
      quarantineDir: (sessionId) => join(mediaStoreDir, SEALING_QUARANTINE_DIR, sessionId),
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
        if (outcome.status === 'SEALED') {
          app.log.info({ code: 'SEALING_COMPLETE', source: SOURCE, sessionId: outcome.sessionId, evidenceId: outcome.evidenceId, attempt: outcome.attempt, interrupted: outcome.interrupted }, 'a session was sealed');
          // R80-04: the package is stored - the raw PCM tap and the rest of the session's transcriber scratch go (a normal seal, an interrupted one, a run a start finished).
          discardTranscriberScratch(outcome.sessionId, 'SEALED');
          // G89-07 (fix wave H driver A): the manifest is signed and stored, its inputs are frozen in the seal's checkpoint - the capture
          // facts file is not read again and goes. A FAILED or pending seal keeps it: this branch is the SEALED one only.
          void track(
            removeSessionCaptureFacts(mediaStoreDir, outcome.sessionId).then(
              (removed) => void (removed ? app.log.info({ code: 'SEALING_CAPTURE_FACTS_REMOVED', source: SOURCE, sessionId: outcome.sessionId }, 'the capture facts file of a sealed session was removed') : undefined),
              (error: unknown) => persist('error', 'SEALING_CAPTURE_FACTS_NOT_REMOVED', 'the capture facts file of a sealed session could not be removed', error, { sessionId: outcome.sessionId }),
            ),
          );
        }
        // A FAILED run is in the error log already (the pipeline wrote it, with its step and code).
        // Fix wave I (G75b-01): with its CAUSE - a closed code (`sealingCauseCodeOf`) under `failureCause` (the key `cause` is an error's, static rule CPB1-2) - never key material, never a path.
        else if (outcome.status === 'FAILED') app.log.error({ code: outcome.code, source: SOURCE, sessionId: outcome.sessionId, step: outcome.step, attempt: outcome.attempt, retriable: outcome.retriable, failureCause: sealingCauseCodeOf(outcome.code, outcome.detail) }, 'the seal of a session failed');
        // F-M7b (R88-02 (a) + (c)): EVERY end of a run goes to the way out - a retry in this process, the wait for a start, or the terminal UNSEALABLE outcome.
        if (outcome.status !== 'NOTHING_DURABLE') void track(wayOut.after(outcome).then((next) => (next?.action === 'TERMINAL' ? app.log.error({ code: 'SEALING_SESSION_UNSEALABLE', source: SOURCE, sessionId: outcome.sessionId, failure: next.cause }, 'a session could not be sealed: it was ended as UNSEALABLE and its files are in the quarantine folder') : undefined)));
        if (outcome.status !== 'SEALED' && outcome.status !== 'FAILED') {
          persist('warn', 'SEALING_NOTHING_DURABLE', 'a seal was asked for a session that holds nothing durable: no item is made', null, { sessionId: outcome.sessionId });
          // The session is told, so that it never stays in STOPPING or FAULT without a word (row 71c, item 4 (c)).
          void track(nothingDurable(outcome.sessionId));
        }
      },
    });
    // Fix pass F-M7b (R88-02 (a) + (c)): the bounded retry and the terminal outcome of a failed seal (`sealing/pipeline/way-out.ts`).
    const wayOut = createSealWayOut({
      settings: () => settings.sealRetry ?? SEAL_RETRY_DEFAULTS,
      timer: systemStepTimer,
      journal,
      now,
      log: app.errorLog,
      // Another attempt for the session of the committed state, with the cause its state gives (the controller's rule).
      retry: () => track(controller.resume()),
      tell: async (input) => {
        await sealDoorsOf(app.engine).applySealingProgress(input);
      },
      end: async (input) => {
        await unsealableDoorsOf(app.engine).endSessionUnsealable(input);
      },
      packageDir,
      stagingDir: ports.stagingDir,
      quarantineDir: ports.quarantineDir,
      // F-M7c (D186, F-M7b's decision 6): the transcriber scratch of an UNSEALABLE session goes to its quarantine folder. The run is ended first: nothing writes into the folder while it is moved.
      scratchDir: (sessionId) => {
        const control = transcription();
        if (control === null) return null;
        try {
          control.runs.discard(sessionId);
        } catch {
          // A run that could not be ended: a stopped or absent runner writes nothing; the folder is moved all the same.
        }
        return control.scratchDirFor(sessionId);
      },
      // F-M7c (D186 (1)): a retriable cause that outlived the retries is VISIBLE - one CRITICAL alert, resolved when the seal completes.
      blocked: async (input) => {
        await sealingNoticeDoorsOf(app.engine).raiseSealBlocked(input);
      },
      unblocked: async (sessionId) => {
        await sealingNoticeDoorsOf(app.engine).resolveSealBlocked({ sessionId });
      },
    });
    composed = { controller, ports, wayOut };
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

  /** F-M7b: what the quarantine holds, said at every start (one line; the folders are evidence the Core could not seal and never deletes). */
  async function reportQuarantine(): Promise<void> {
    try {
      const sessions = (await readdir(join(mediaStoreDir, SEALING_QUARANTINE_DIR), { withFileTypes: true })).filter((entry) => entry.isDirectory() && /^SES-[0-9]{8}-[0-9]{4}$/.test(entry.name)).map((entry) => entry.name).sort();
      if (sessions.length > 0) persist('warn', 'SEALING_QUARANTINE_HOLDS_SESSIONS', 'the quarantine folder of the evidence store holds recordings the Core could not seal', null, { count: sessions.length, sessions: sessions.slice(0, 50).join(',') });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') persist('error', 'SEALING_QUARANTINE_NOT_LISTED', 'the quarantine folder of the evidence store could not be listed', error, {});
    }
  }

  /**
   * F-M7b, AT A START: a terminal UNSEALABLE outcome a process end interrupted (the journal says
   * so) is FINISHED - what is left is moved, the session is ended - and no seal is run for it.
   * Resolves true when there was one.
   */
  async function finishUnsealable(): Promise<boolean> {
    const session = app.engine.state().session;
    if (session === null || session.state === 'SEALED') return false;
    try {
      const finished = await compose().wayOut.finishPending(session.id);
      if (finished) app.log.error({ code: 'SEALING_UNSEALABLE_FINISHED', source: SOURCE, sessionId: session.id }, 'a session that cannot be sealed was ended at the start of the Core: its files are in the quarantine folder');
      return finished;
    } catch (error) {
      persist('error', 'SEALING_UNSEALABLE_NOT_FINISHED', 'the terminal outcome of a session that cannot be sealed could not be finished at the start of the Core', error, { sessionId: session.id });
      // Marked UNSEALABLE and not finished: no seal is run for it; the next start tries again.
      return true;
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
      // Fix wave K: the development seal rig is for development capture ONLY. Refused by name, nothing replaced.
      if (next.developmentSealer !== undefined && operation !== CaptureOperation.REAL_DEVELOPMENT) throw new SealRigRefusedError(operation);
      Object.assign(settings, next);
    },
    retryFailedSeal(sessionId, principal) {
      const session = app.engine.state().session;
      if (session === null || session.id !== sessionId || session.state !== 'FINALIZING' || !session.finalization.steps.some((step) => step.status === 'error')) return false;
      // A run under way IS the retry: nothing is started beside it.
      if (controller.running() !== null) return true;
      compose().wayOut.reset(sessionId);
      // Fix wave L (G75d-04, G75d-09 (a)): a retry ON DEMAND is not a resume. `resumed` of operation 83 states that a START of
      // the Core ran the seal again (a client words it "Resumed after restart"); this retry runs in the process that failed.
      app.log.info({ code: 'SEALING_RETRY_ON_DEMAND', source: SOURCE, sessionId }, 'the failed seal of a session is run again on demand');
      // F-M7c (D186 (8)): AUDITED - who asked, which session, the cause being retried. Written before the run reads its rows.
      void track(noteRetryOnDemand(sessionId, principal?.kind === 'OPERATOR' ? principal.operatorId : null)).then(() => controller.resume()).catch((error: unknown) => track(rejected(sessionId, error)));
      return true;
    },
    failedSeal: (sessionId) => ({ command: (principal) => host.retryFailedSeal(sessionId, principal) }),
    beforeStart(sessionId) {
      const refused = sessionKeyStartRefusal(app, sessionId);
      if (refused === null) return;
      persist('error', 'SESSION_START_REFUSED_SESSION_KEY', 'a session start was refused: its recording could not be sealed with the session keys the key store holds', null, { sessionId, cause: refused });
      throw new ApiFailure(503, 'NOT_READY', SESSION_KEY_START_TEXT[refused], { details: { reason: refused } });
    },
    resumedSeal: (sessionId) => resumedSeals.has(sessionId),
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
    // F-M7b: no retry of a failed seal fires into a Core that is closing.
    composed?.wayOut.close();
  });

  // INSTALLATION IDENTITY (closing pass Z1, decision D207): a production Core does not start without
  // it; a development Core says once that its manifests will state NOT_CONFIGURED. Before the
  // recovery step: a Core that is refused resumes no seal.
  app.readiness.addBootStep({
    id: INSTALLATION_IDENTITY_BOOT_STEP,
    run: async () => runInstallationIdentityBoot(installationIdentity, operation, { persist: (level, code, message, context) => persist(level, code, message, null, context) }),
  });

  // RECOVERY: after the engine's boot step (this unit registers after the engine). Not awaited:
  // a seal may take as long as its media, and the Core is ready while it runs.
  app.readiness.addBootStep({
    id: SEALING_RESUME_BOOT_STEP,
    run: async () => {
      void track(sweepSealedScratch());
      void track(reportQuarantine());
      // F-M7c: R88-05 (b) every sealed session is finished; D186 (1) a blocked seal says so again.
      void track(sweepSealedSessions());
      reportBlockedSeal();
      // F-M7b: a pending terminal outcome is finished first; only a session without one is resumed.
      void track(finishUnsealable()).then((finished) =>
        finished
          ? undefined
          : compose()
              .controller.decide()
              // Fix wave I (G75b-02): the seal this START runs again is a RESUMED one - said before it runs, so operation 83 says so while it does.
              .then((decision) => void (decision.action === 'NONE' ? undefined : resumedSeals.add(decision.sessionId)))
              .then(() => controller.resume())
              .then(
              (outcome) => {
                if (outcome !== null) app.log.info({ code: 'SEALING_RESUMED', source: SOURCE, sessionId: outcome.sessionId, status: outcome.status }, 'a seal was resumed at the start of the Core');
              },
              (error: unknown) => track(rejected(app.engine.state().session?.id ?? 'unknown', error)),
            ),
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
        // Fix wave K, driver S2 (G89b-04, G94b-03; D216 (2), D222 (3)): the paired device that asked and the operation, on the row.
        await sealDoorsOf(app.engine).recordEvidenceVerification({
          ...verdict,
          failedTracks: [...verdict.failedTracks],
          failedFragments: [...verdict.failedFragments],
          actorId: principal.kind === 'OPERATOR' ? principal.operatorId : null,
          deviceId: principal.kind === 'OPERATOR' ? principal.deviceId : null,
          operationId: 'verifyEvidence',
        });
      },
    }),
  );

  // OPERATIONS 42 / 87 for a sealed package (fix pass F-M8, R93-01): the export jobs, composed with this Core's evidence signer.
  provideCoreEvidenceExport(app, { signer: signingNow });

  return host;
}
