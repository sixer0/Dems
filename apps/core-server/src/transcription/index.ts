/**
 * THE CORE'S TRANSCRIPTION COMPOSITION (blueprint row 115, milestone M6; requirement R-8,
 * decisions D20, D24; transcript spec §B.4, §B.7, §C, §D; C3 §2.5; CS-22).
 *
 * `apps/transcriber` is a library: it knows no database, no capture supervisor and no HTTP server.
 * This unit is where the Core puts it to work. It owns:
 *
 *   host.ts               what the HOST states about the engines (one file in the data directory);
 *   credential-reveal.ts  the ONE caller of `dems_stt_credential_reveal()`;
 *   credential-opener.ts  the ONE file that reaches the Core credential store: the opener of an
 *                         `ENCRYPTED` credential, handed to the transcriber's key-loader;
 *   probe.ts              the probe of operation 92 in production wiring;
 *   snapshot.ts           the STT configuration of a session as it was at its start, stored in
 *                         `session_stt_config` (statements.ts);
 *   session.ts            adapter + VAD + runner of one session, built from its snapshot, with
 *                         every value the pipeline asks a live session to state, and the rule for
 *                         a torn checkpoint;
 *   boot.ts               the CS-22 boot step.
 *
 * HOW IT IS MOUNTED. `app.ts` is frozen (P25) and is not edited: the STT configuration module
 * (`modules/stt-config`, registered by `app.ts` since row 113) calls `mountTranscription(app, …)`
 * in its plugin function and hands in what is its own - how the stored row is read. The opener of
 * an `ENCRYPTED` credential is the Core credential store's, reached through this unit's one file
 * `credential-opener.ts`. This unit imports no module's value except the store of
 * `transcript_chunks`.
 *
 * MOUNTED OR NOT. An app whose data directory does not exist (every in-process test app) has NO
 * transcriber: `mounted` is false, the boot step is inert, the service state is `NOT_CONFIGURED`
 * and operation 92 keeps answering `503 TRANSCRIBER_NOT_READY`. The product always has a data
 * directory (the connection file lives in it).
 *
 * WHAT THE CAPTURE SESSION CALLS (row 71c, decision D153; `src/capture-session`):
 *   in the unit of the start   `snapshotSttConfigIn(unit, sessionId)` - the snapshot row is written
 *                              in the transaction that persists RECORDING and the four source rows
 *                              (dbc-6 MR-T1). It asks no backend and starts nothing;
 *   after that unit committed  `sessionStartCommitted(sessionId)` - the scratch directory and the
 *                              one background check of the backend (never waited for, RK-1);
 *   for the plan               `tapPathFor(sessionId)` - the `pcmTapPath` of the capture plan, or
 *                              null when the snapshot disables STT (no tap: no CPU taken from capture);
 *   when the worker listens    `runs.begin(sessionId)` - `openSession`, then the runner is stepped
 *                              as the tap grows (`session-run.ts`);
 *   on every end of a capture  `runs.end(sessionId, { recorded })` - stepped to its end, or dropped.
 * `snapshotSttConfigForSession(sessionId)` is the two first calls in one, on the runtime pool: for
 * a caller that has no unit (the tests of this folder).
 *
 * WHAT THE SEAL CALLS (`src/sealing-host`): `runs.availability`, `runs.assemble`, `runs.closeOut`,
 * `runs.locate`, and `manifestSnapshot(sessionId)`.
 */
import { mkdirSync, statSync } from 'node:fs';
import { SttConnectionDetailCode } from '@dems/shared/api';
import { SerialQueue, createEngineGuard, type ChunkMirror, type DocumentInterval, type FetchLike, type SpeakerEmbeddingEngine, type TranscriberLog } from '@dems/transcriber';
import { createTranscriptChunkStore } from '../modules/transcript-chunks';
import type { SttConnectionProbe } from '../modules/stt-config';
import { TRANSCRIBER_BOOT_STEP, runTranscriberBoot, type TranscriberBootOutcome } from './boot';
import { coreSttEnvelopeOpener, type SttEnvelopeOpener } from './credential-opener';
import { revealSttCredential, type RevealedSttCredential } from './credential-reveal';
import { readTranscriberHost, sessionScratchDir, sessionTapPath, type TranscriberHost } from './host';
import { createCoreTranscriberLog } from './log';
import { createCoreSttProbe } from './probe';
import { openSessionTranscription, type CaptureFacts, type EnabledSessionTranscription, type OpenSessionOptions, type SessionTranscription } from './session';
import { createModelProvenanceProvider, type ModelProvenanceAnswer } from './model-provenance';
import { createSessionRuns, type SessionRuns } from './session-run';
import { createDatabaseSnapshotStore, manifestSnapshotOf, type ManifestSttSnapshot, type SttSessionSnapshot, type SttSnapshotStore, type StoredSttSelection } from './snapshot';
import type { Queryable } from './statements';

export { TRANSCRIBER_BOOT_STEP, TranscriberBootError, TranscriberBootFailure, runTranscriberBoot, type TranscriberBootDeps, type TranscriberBootOutcome } from './boot';
export { SttCredentialOpenError, SttCredentialOpenFailure, coreSttEnvelopeOpener, type SttEnvelopeOpener } from './credential-opener';
export { REVEAL_STT_CREDENTIAL, SttCredentialRevealError, revealSttCredential, type RevealedSttCredential } from './credential-reveal';
export {
  TRANSCRIBER_HOST_FILE,
  TRANSCRIBER_HOST_FOLDER,
  TRANSCRIPTION_TAP_FILE,
  TranscriberHostError,
  readTranscriberHost,
  sessionScratchDir,
  sessionTapPath,
  type TranscriberHost,
} from './host';
export { createCoreTranscriberLog } from './log';
export { GPU_BACKEND_MARKERS, SttProbeDetailCode, cpuOnlyBuildOf, createCoreSttProbe, type CoreProbeDeps, type CpuOnlyVerdict } from './probe';
export {
  CHECKPOINT_RECOVERY_LIMIT,
  SessionTranscriptionCode,
  moveCheckpointAside,
  openSessionTranscription,
  type CaptureFacts,
  type EnabledSessionTranscription,
  type OpenSessionOptions,
  type SessionCompositionDeps,
  type SessionTranscription,
} from './session';
export {
  SESSION_RUN_STEP_INTERVAL_MS,
  SessionRunCode,
  createSessionRuns,
  type SessionRunDeps,
  type SessionRunPhase,
  type SessionRunStatus,
  type SessionRuns,
  type SessionTranscriptAnswer,
  type SessionTranscriptAvailability,
  type SessionTranscriptFiles,
} from './session-run';
export { GGML_FTYPE_NAMES, GGML_HEADER_BYTES, GGML_MAGIC, ModelProvenanceCode, createModelProvenanceProvider, isProvenanceUnknown, quantisationOfGgmlHeader, type ModelProvenanceAnswer, type ModelProvenanceProvider, type ModelProvenanceSubject, type ModelProvenanceUnknown } from './model-provenance';
export { MEMORY_SNAPSHOT_SESSIONS, createDatabaseSnapshotStore, createMemorySnapshotStore, manifestSnapshotOf, type ManifestSttSnapshot, type SttSessionSnapshot, type SttSnapshotStore, type StoredSttSelection } from './snapshot';

/** The states `modules/system` reads (`TranscriberServiceState` there; the same four words). */
export const TranscriptionServiceState = { NOT_CONFIGURED: 'NOT_CONFIGURED', RUNNING: 'RUNNING', DEGRADED: 'DEGRADED', STOPPED: 'STOPPED' } as const;
export type TranscriptionServiceState = (typeof TranscriptionServiceState)[keyof typeof TranscriptionServiceState];

export interface TranscriptionServiceReport {
  readonly state: TranscriptionServiceState;
  /** When the boot step resolved the transcriber (epoch ms on the Core clock), or null. */
  readonly startedAt: number | null;
}

/** Raised when a session starts with STT enabled and the backend does not answer. Capture goes on. */
export interface SttSessionWarning {
  readonly sessionId: string;
  readonly code: 'STT_BACKEND_UNAVAILABLE_AT_SESSION_START';
  /** The `detailCode` of the check (`UNREACHABLE`, `TIMEOUT`, `MODEL_NOT_AVAILABLE`, …). */
  readonly detailCode: string;
  readonly backend: string;
  readonly at: number;
}

export type SnapshotOutcome =
  | { readonly ok: true; readonly snapshot: SttSessionSnapshot; /** False: the session already had its snapshot; that one is returned. */ readonly taken: boolean }
  | { readonly ok: false; readonly code: 'STT_CONFIG_NOT_SEEDED' | 'STT_CONFIG_READ_FAILED' | 'SNAPSHOT_STORE_FAILED' };

export interface TranscriptionControl {
  /** False: the app has no data directory, so it has no transcriber. */
  readonly mounted: boolean;
  /** The probe of operation 92. The STT configuration module uses it when no other was provided. */
  readonly probe: SttConnectionProbe;
  /** THE SEAM OF `modules/system` (`TranscriberServiceSource`): a synchronous read. */
  serviceState(): TranscriptionServiceReport;
  /**
   * SESSION START. Takes the snapshot of the stored configuration for the session (write-once) and
   * returns AT ONCE. When the snapshot enables STT, the backend is asked once IN THE BACKGROUND;
   * a backend that does not answer raises a warning (`onSessionWarning`, the log, the persistent
   * error log) and changes nothing else: the start of the session never waits for it and never
   * fails because of it (RK-1). Never throws.
   */
  snapshotSttConfigForSession(sessionId: string): Promise<SnapshotOutcome>;
  /**
   * THE SNAPSHOT IN THE UNIT OF THE SESSION START (row 71c; dbc-6 MR-T1): the same snapshot,
   * written through `db` - the transaction that persists RECORDING and the four source rows - so
   * that it is committed with them or not at all. It asks no backend, makes no directory and
   * starts nothing: that is `sessionStartCommitted`, after the commit.
   *
   * The stored configuration is read on the runtime pool, outside `db`: a configuration that
   * cannot be read, or is not seeded, is an outcome with a code (the session then has NO snapshot
   * and is never transcribed), and the start goes on. A statement that fails ON `db` is the
   * outcome `SNAPSHOT_STORE_FAILED` - and has ended the caller's transaction, as any failed
   * statement of a unit does: such a start cannot commit. Never throws.
   */
  snapshotSttConfigIn(db: Queryable, sessionId: string): Promise<SnapshotOutcome>;
  /** AFTER the unit of the start committed: what a taken snapshot starts. Returns at once; never throws. */
  sessionStartCommitted(sessionId: string): void;
  /** The transcriber session of a recording, from capture start to the seal (`session-run.ts`). */
  readonly runs: SessionRuns;
  sessionSnapshot(sessionId: string): Promise<SttSessionSnapshot | null>;
  /** The five members the seal records (manifest field 123), or null without a snapshot. */
  manifestSnapshot(sessionId: string): Promise<ManifestSttSnapshot | null>;
  /** The `pcmTapPath` of the session's capture plan: null when its snapshot disables STT or is absent. */
  tapPathFor(sessionId: string): Promise<string | null>;
  /** Where the checkpoint and the three transcript files of a session are. */
  scratchDirFor(sessionId: string): string;
  openSession(sessionId: string, options?: OpenSessionOptions): Promise<SessionTranscription>;
  /** Returns the function that removes the listener. */
  onSessionWarning(listener: (warning: SttSessionWarning) => void): () => void;
  /** The availability check a session start began, if it still runs. For a test and for a shutdown. */
  settled(): Promise<void>;
  /** Told by operation 91 after a stored change (the new `enabled`). */
  noteConfigChange(enabled: boolean): void;
  /** The outcome of the boot step, or null before it ran. */
  bootOutcome(): TranscriberBootOutcome | null;
}

/** What the app must offer. Structural: the scaffold's `FastifyInstance` has all of it. */
export interface TranscriptionHost {
  readonly stages: object;
  readonly config: { readonly dataDir: string; readonly captureMode: 'simulated' | 'real' };
  readonly log: { info(fields: Record<string, unknown>, message: string): void; warn(fields: Record<string, unknown>, message: string): void; error(fields: Record<string, unknown>, message: string): void };
  readonly errorLog: { append(entry: { level: 'error' | 'warn'; source: string; message: string; code?: string; context?: Readonly<Record<string, string | number | boolean | null>> }): void };
  readonly clock: { now(): number };
  readonly capture: CaptureFacts;
  readonly db: { readonly pool: { query(text: string, values?: unknown[]): Promise<{ rows: never[]; rowCount: number | null }> } };
  readonly readiness: { addBootStep(step: { readonly id: string; run(): Promise<void> }): void };
}

export interface MountTranscriptionDeps {
  /** The stored row without any credential column (the STT configuration module's own read). Null: not seeded. */
  readonly readConfig: () => Promise<StoredSttSelection | null>;
  /** Tests: another store (the memory store, or a double), another transport, another time limit of the session-start check. */
  readonly snapshots?: SttSnapshotStore;
  readonly fetchImpl?: FetchLike;
  readonly availabilityTimeoutMs?: number;
  /** The opener of a stored `ENCRYPTED` credential. Default: the Core credential store of the app (`coreSttEnvelopeOpener`). */
  readonly openEncrypted?: SttEnvelopeOpener;
  /**
   * Manifest fields 84 to 87 of a session's STT model. DEFAULT: THE PRODUCTION PROVIDER
   * (`model-provenance.ts`, integration pass D8): name from the adapter, version from the host
   * file, quantisation and SHA-256 from the model file of a `cpu-local` session; a member without
   * a source is answered by a code and no transcript document is assembled for that session.
   * Tests hand in another answer.
   */
  readonly modelProvenance?: (session: EnabledSessionTranscription) => Promise<ModelProvenanceAnswer>;
  /** The speaker embedding engine of this Core. DEFAULT: null - none; speaker labels are UNAVAILABLE with the reason. */
  readonly speakerEngine?: (session: EnabledSessionTranscription) => SpeakerEmbeddingEngine | null;
  /** Tests: how often a recording session's runner is stepped. */
  readonly sessionStepIntervalMs?: number;
}

/** The audio-source intervals of a session, in media time, for its transcript document. */
export const READ_SESSION_INTERVALS_FOR_TRANSCRIPT = 'SELECT mic_device_id, from_media_ms, to_media_ms FROM public.session_audio_intervals WHERE session_id = $1 ORDER BY seq';

/** The time limit of the one background check a session start makes. A bound, never a measurement. */
export const SESSION_START_CHECK_TIMEOUT_MS = 3_000;

const SOURCE = 'transcription';
const WARNING = 'STT is enabled for the session but its backend did not answer at session start; capture is not affected';
const SNAPSHOT_FAILED = 'the STT snapshot of the session could not be taken; no transcription will run for it; capture is not affected';

// Keyed by the app's stage registry: one object per app (the `sttConfigControl(app)` idiom).
const controls = new WeakMap<object, TranscriptionControl>();

/** The transcription controls of an app. Available once the STT configuration module is registered. */
export function transcriptionControl(app: { readonly stages: object }): TranscriptionControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the transcription composition is not mounted: the STT configuration module registers it');
  return control;
}

/**
 * THE SOURCE FOR `modules/system` (its option `transcriber`, a `TranscriberServiceSource`): the
 * service state of the app's transcriber, read when it is asked. An app in which nothing is
 * mounted (a module test without the STT configuration module) answers `NOT_CONFIGURED`; it never throws.
 */
export function transcriptionServiceSource(app: { readonly stages: object }): () => TranscriptionServiceReport {
  return () => controls.get(app.stages)?.serviceState() ?? { state: TranscriptionServiceState.NOT_CONFIGURED, startedAt: null };
}

function directoryIsThere(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function mountTranscription(app: TranscriptionHost, deps: MountTranscriptionDeps): TranscriptionControl {
  if (controls.has(app.stages)) throw new Error('the transcription composition was mounted twice');
  const { dataDir, captureMode } = app.config;
  // Decided once, like the Core credential store: a data directory that appears later is not adopted.
  const mounted = directoryIsThere(dataDir);
  const transcriberLog: TranscriberLog = createCoreTranscriberLog({ log: app.log, errorLog: app.errorLog, now: () => app.clock.now() });
  /** ONE queue for every oMLX call of this process: tests of the connection and transcriptions (D7(d)). */
  const queue = new SerialQueue();
  // The snapshot lives in the database (`session_stt_config`): it survives a restart of the Core inside an open session.
  const snapshots = deps.snapshots ?? createDatabaseSnapshotStore({ query: (text, values) => app.db.pool.query(text, values === undefined ? [] : [...values]) });
  const listeners = new Set<(warning: SttSessionWarning) => void>();
  const timeoutMs = deps.availabilityTimeoutMs ?? SESSION_START_CHECK_TIMEOUT_MS;

  let hostState: { readonly host: TranscriberHost } | null = null;
  // Read at first use and kept: a host file that cannot be used throws every time, so it is never mistaken for "no file".
  const host = (): TranscriberHost => {
    if (hostState === null) hostState = { host: readTranscriberHost(dataDir) };
    return hostState.host;
  };
  const reveal = (): Promise<RevealedSttCredential> => revealSttCredential({ query: (text) => app.db.pool.query(text) });
  // The ONE credential store of the app, asked when a credential is opened (never at mount).
  const openEncrypted: SttEnvelopeOpener = deps.openEncrypted ?? coreSttEnvelopeOpener(app);
  const libraryProbe = createCoreSttProbe({ host, reveal, openEncrypted, transcriberLog, queue, fetchImpl: deps.fetchImpl });
  const probe: SttConnectionProbe = async (target, options) => {
    const result = await libraryProbe(target, options);
    if (target.enabled) availability = result.reachable && result.modelAvailable;
    return result;
  };
  const mirror: ChunkMirror = createTranscriptChunkStore({ query: (text, values) => app.db.pool.query(text, values === undefined ? [] : [...values]) });

  let boot: TranscriberBootOutcome | null = null;
  let startedAt: number | null = null;
  /** The stored `enabled`, as last seen (boot, a snapshot, operation 91). Null: not seen yet. */
  let enabled: boolean | null = null;
  /** The last answer of the backend. Null: not asked since the configuration was last seen. */
  let availability: boolean | null = null;
  let pending: Promise<void> = Promise.resolve();

  const checkAtSessionStart = (snapshot: SttSessionSnapshot): void => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    pending = probe({ enabled: true, backend: snapshot.backend, endpoint: snapshot.endpoint, model: snapshot.model, credentialKind: snapshot.credentialKind }, { signal: abort.signal, timeoutMs })
      .catch(() => ({ reachable: false, modelAvailable: false, detailCode: SttConnectionDetailCode.UNREACHABLE }))
      .then((result) => {
        if (result.reachable && result.modelAvailable) return;
        const warning: SttSessionWarning = { sessionId: snapshot.sessionId, code: 'STT_BACKEND_UNAVAILABLE_AT_SESSION_START', detailCode: String(result.detailCode), backend: snapshot.backend, at: app.clock.now() };
        app.log.warn({ code: warning.code, source: `${SOURCE}.sessionStart`, sessionId: warning.sessionId, backend: warning.backend, detailCode: warning.detailCode }, WARNING);
        app.errorLog.append({ level: 'warn', source: `${SOURCE}.sessionStart`, message: WARNING, code: warning.code, context: { correlationId: warning.sessionId, backend: warning.backend, detailCode: warning.detailCode } });
        for (const listener of listeners) {
          try {
            listener(warning);
          } catch {
            // A listener's fault is its own: the warning is already in both logs.
          }
        }
      })
      .finally(() => clearTimeout(timer));
  };

  /** The snapshot of a session, through `store`: the pool, or the unit of the session start. Never throws. */
  const take = async (store: SttSnapshotStore, sessionId: string): Promise<SnapshotOutcome> => {
    const fail = (code: Extract<SnapshotOutcome, { ok: false }>['code'], error?: unknown): SnapshotOutcome => {
      const errorName = error instanceof Error ? error.name : undefined;
      const sqlstate = typeof (error as { code?: unknown } | undefined)?.code === 'string' ? (error as { code: string }).code : undefined;
      app.log.error({ code, source: `${SOURCE}.snapshot`, sessionId, ...(errorName === undefined ? {} : { errorName }) }, SNAPSHOT_FAILED);
      app.errorLog.append({ level: 'error', source: `${SOURCE}.snapshot`, message: SNAPSHOT_FAILED, code, context: { correlationId: sessionId, ...(errorName === undefined ? {} : { errorName }), ...(sqlstate === undefined ? {} : { sqlstate }) } });
      return { ok: false, code };
    };
    try {
      const known = await store.get(sessionId);
      if (known !== null) return { ok: true, snapshot: known, taken: false };
    } catch (error) {
      return fail('SNAPSHOT_STORE_FAILED', error);
    }
    // The stored row is read on the runtime pool: a read that fails never touches the caller's transaction.
    let stored: StoredSttSelection | null;
    try {
      stored = await deps.readConfig();
    } catch (error) {
      return fail('STT_CONFIG_READ_FAILED', error);
    }
    if (stored === null) return fail('STT_CONFIG_NOT_SEEDED');
    let snapshot: SttSessionSnapshot;
    try {
      snapshot = await store.put({
        sessionId,
        takenAt: app.clock.now(),
        enabled: stored.enabled,
        backend: stored.backend,
        endpoint: stored.endpoint,
        model: stored.model,
        language: stored.language,
        diarization: stored.diarization,
        credentialKind: stored.credentialKind,
        revision: stored.revision,
      });
    } catch (error) {
      return fail('SNAPSHOT_STORE_FAILED', error);
    }
    enabled = stored.enabled;
    app.log.info({ code: 'STT_SNAPSHOT_TAKEN', source: `${SOURCE}.snapshot`, sessionId, enabled: snapshot.enabled, backend: snapshot.backend, revision: snapshot.revision }, 'STT configuration snapshot taken for the session');
    return { ok: true, snapshot, taken: true };
  };

  /** What a taken snapshot starts, once it is committed: the scratch directory and the one background check. */
  const checked = new Set<string>();
  const started = (snapshot: SttSessionSnapshot): void => {
    if (!snapshot.enabled || !mounted || checked.has(snapshot.sessionId)) return;
    checked.add(snapshot.sessionId);
    try {
      // The directory of the tap and of the checkpoint: private, below the git-ignored data directory.
      mkdirSync(sessionScratchDir(dataDir, snapshot.sessionId), { recursive: true, mode: 0o700 });
    } catch {
      // The tap then cannot be written: the capture worker records without it and says so (tapActive false).
    }
    checkAtSessionStart(snapshot);
  };

  const openSession = (sessionId: string, options?: OpenSessionOptions): Promise<SessionTranscription> =>
    openSessionTranscription({ dataDir, host, snapshots, reveal, openEncrypted, engineGuard: createEngineGuard, capture: app.capture, mirror, transcriberLog, queue, now: () => app.clock.now(), fetchImpl: deps.fetchImpl }, sessionId, options);

  // ONE provider per app: the hash of a model file is taken once per file and process.
  const provenance = createModelProvenanceProvider({ statedVersions: () => host().modelVersions });
  const productionProvenance = (session: EnabledSessionTranscription): Promise<ModelProvenanceAnswer> =>
    provenance.of({ backend: session.config.backend, model: session.adapter.model, modelPath: session.config.backend === 'cpu-local' ? session.config.modelPath : null });

  const runs: SessionRuns = createSessionRuns({
    // An app without a data directory has no transcriber: nothing is opened for any session.
    open: async (sessionId) => {
      if (mounted) return openSession(sessionId);
      const snapshot = await snapshots.get(sessionId);
      return snapshot === null ? { state: 'NO_SNAPSHOT', snapshot: null } : !snapshot.enabled ? { state: 'DISABLED', snapshot } : { state: 'UNAVAILABLE', snapshot, code: 'TRANSCRIBER_NOT_MOUNTED' };
    },
    scratchDirFor: (sessionId) => sessionScratchDir(dataDir, sessionId),
    modelProvenance: deps.modelProvenance ?? productionProvenance,
    speakerEngine: deps.speakerEngine ?? (() => null),
    async intervals(sessionId): Promise<readonly DocumentInterval[]> {
      const { rows } = (await app.db.pool.query(READ_SESSION_INTERVALS_FOR_TRANSCRIPT, [sessionId])) as unknown as { rows: { mic_device_id: string; from_media_ms: string | number; to_media_ms: string | number | null }[] };
      return rows.map((row) => ({ source: row.mic_device_id, fromMs: Number(row.from_media_ms), toMs: row.to_media_ms === null ? null : Number(row.to_media_ms) }));
    },
    transcriberLog,
    report(level, code, message, sessionId, more = {}, error) {
      const errorName = error instanceof Error ? error.name : undefined;
      const fields = { code, source: `${SOURCE}.sessionRun`, sessionId, ...more, ...(errorName === undefined ? {} : { errorName }) };
      if (level === 'info') app.log.info(fields, message);
      else if (level === 'warn') app.log.warn(fields, message);
      else app.log.error(fields, message);
      if (level !== 'info') app.errorLog.append({ level, source: `${SOURCE}.sessionRun`, message, code, context: { correlationId: sessionId, ...more, ...(errorName === undefined ? {} : { errorName }) } });
    },
    timer: {
      after(ms, fire) {
        const handle = setTimeout(fire, ms);
        // A step that waits never keeps the process alive.
        handle.unref();
        return () => clearTimeout(handle);
      },
    },
    ...(deps.sessionStepIntervalMs === undefined ? {} : { stepIntervalMs: deps.sessionStepIntervalMs }),
  });

  const control: TranscriptionControl = {
    mounted,
    probe,
    serviceState() {
      if (!mounted || captureMode !== 'real' || boot === null || boot.outcome === 'INERT') return { state: TranscriptionServiceState.NOT_CONFIGURED, startedAt: null };
      if (enabled === false) return { state: TranscriptionServiceState.STOPPED, startedAt };
      return { state: availability === false ? TranscriptionServiceState.DEGRADED : TranscriptionServiceState.RUNNING, startedAt };
    },
    async snapshotSttConfigForSession(sessionId) {
      const outcome = await take(snapshots, sessionId);
      if (outcome.ok && outcome.taken) started(outcome.snapshot);
      return outcome;
    },
    snapshotSttConfigIn: (db, sessionId) => take(createDatabaseSnapshotStore(db), sessionId),
    sessionStartCommitted(sessionId) {
      void snapshots.get(sessionId).then(
        (snapshot) => {
          if (snapshot !== null) started(snapshot);
        },
        (error: unknown) => {
          const errorName = error instanceof Error ? error.name : 'Error';
          app.log.error({ code: 'SNAPSHOT_STORE_FAILED', source: `${SOURCE}.snapshot`, sessionId, errorName }, 'the STT snapshot of a started session could not be read');
          app.errorLog.append({ level: 'error', source: `${SOURCE}.snapshot`, message: 'the STT snapshot of a started session could not be read', code: 'SNAPSHOT_STORE_FAILED', context: { correlationId: sessionId, errorName } });
        },
      );
    },
    runs,
    sessionSnapshot: (sessionId) => snapshots.get(sessionId),
    async manifestSnapshot(sessionId) {
      const snapshot = await snapshots.get(sessionId);
      return snapshot === null ? null : manifestSnapshotOf(snapshot);
    },
    async tapPathFor(sessionId) {
      const snapshot = await snapshots.get(sessionId);
      return snapshot === null || !snapshot.enabled || !mounted ? null : sessionTapPath(dataDir, sessionId);
    },
    scratchDirFor: (sessionId) => sessionScratchDir(dataDir, sessionId),
    openSession,
    onSessionWarning(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    settled: () => pending,
    noteConfigChange(next) {
      enabled = next;
      // What the backend last answered described the configuration before this change.
      availability = null;
    },
    bootOutcome: () => boot,
  };
  controls.set(app.stages, control);

  app.readiness.addBootStep({
    id: TRANSCRIBER_BOOT_STEP,
    async run() {
      // A refusal is thrown: the readiness runner logs and persists it with this step's ID, and
      // the entry point exits without a listener.
      boot = await runTranscriberBoot({ captureMode, mounted, host, readConfig: deps.readConfig, transcriberLog });
      if (boot.outcome === 'INERT') return;
      startedAt = app.clock.now();
      enabled = boot.outcome !== 'DISABLED';
      app.log.info({ code: 'TRANSCRIBER_RESOLVED', source: `${SOURCE}.boot`, outcome: boot.outcome, ...(boot.outcome === 'RESOLVED' ? { backend: boot.backend, vad: boot.vad } : {}) }, 'transcriber configuration resolved at boot');
    },
  });
  return control;
}
