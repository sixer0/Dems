/**
 * THE TRANSCRIPTION OF ONE SESSION, BUILT FROM ITS SNAPSHOT (blueprint row 115; transcript spec
 * §B.4, §B.7, §C, §D; pair-77 "What row 115 must pass", N-10, N-17; decisions D90, D91).
 *
 * `openSessionTranscription` answers one of four things and never throws for a reason of the
 * configuration:
 *
 *   NO_SNAPSHOT   the session has no snapshot (never taken, or refused by the store).
 *                 No transcriber object is built. The configuration as it is NOW is never used.
 *   DISABLED      the snapshot says `enabled: false`. NOTHING is built: no adapter, no VAD, no
 *                 runner, no engine guard, no directory. "No VAD/STT work during recording".
 *   UNAVAILABLE   the snapshot enables STT but the transcriber cannot be built on this host (host
 *                 file, engine or model absent, credential reference unreadable, a checkpoint that
 *                 cannot be recovered). A code says why. CAPTURE IS NOT AFFECTED: nothing here is
 *                 on the path of a session start.
 *   ENABLED       adapter, VAD (or null) and runner, composed with EVERY value the pipeline asks a
 *                 live session to state:
 *                   captureWorkerPid  the live worker of the capture supervisor, asked at every
 *                                     engine start, handed to the adapter AND the VAD (§C sibling rule);
 *                   priority          `required` (the host module states it; D91);
 *                   tapLost           STICKY: one telemetry frame `tapActive: false` while the
 *                                     session records latches it for good (N-1), ON THE DISK at
 *                                     once (`TAP_LOST_MARKER_FILE`, R80-06);
 *                   the tap           `<session scratch>/tap.pcm` (`sessionTapPath`);
 *                   shouldPause       the composition's own hold, plus the caller's;
 *                   mirror            the `transcript_chunks` store on the runtime pool;
 *                   engineGuard       one per session; its `record` is the `onEngineStart` of
 *                                     adapter and VAD (N-2). The factory is a dependency; the
 *                                     mount hands in `createEngineGuard` of `@dems/transcriber`,
 *                                     so an engine a killed Core left running is reaped when the
 *                                     runner of the session is built again.
 *
 * THE BACKEND IS THE SNAPSHOT'S. `resolveTranscriberConfig` is given the snapshot's backend,
 * endpoint, model and language. The credential REFERENCE is not part of a snapshot (E-31): it is
 * read once, when the adapter is built, and the adapter keeps the key it loaded for its lifetime.
 * A stored `ENCRYPTED` credential is revealed as its sealed envelope and opened by the opener the
 * composition hands in (`openEncrypted`), inside the transcriber's key-loader, once.
 *
 * A TORN OR FOREIGN CHECKPOINT (N-17). `createTranscriptRunner` throws `CHECKPOINT_INVALID` for a
 * checkpoint file that is not JSON, not of the form, or of another session, backend, model or
 * audio - and would throw again for every new runner. The rule of this composition:
 *
 *   1. the file is MOVED ASIDE (`transcript-checkpoint.json.invalid-<n>`), never deleted and
 *      never repaired;
 *   2. the fact is logged and persisted with the reason code;
 *   3. the runner is built again. It starts without a checkpoint, finds the session's rows in
 *      `transcript_chunks` (the mirror) and takes row numbers ABOVE them (the pipeline's own rule
 *      for a lost file, N-6): the committed rows stay exactly as they are, and the session's
 *      audio is planned and decoded again into new rows. NO TEXT IS TAKEN FROM A ROW INTO THE NEW
 *      CHECKPOINT: a row holds rounded milliseconds, not the exact sample range a chunk is cut
 *      from, so a checkpoint rebuilt from rows would be made up;
 *   4. at most `CHECKPOINT_RECOVERY_LIMIT` files are moved aside per session. One more invalid
 *      file ends the session's transcription as UNAVAILABLE (the seal then records what the rows
 *      hold: PARTIAL, D-EV-1) - a checkpoint that keeps tearing is a fault of the store, not
 *      something to loop on.
 */
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import {
  captureTapTimeline,
  createSileroVad,
  createTranscriberAdapter,
  createTranscriptRunner,
  openPcmSource,
  resolveSileroVadConfig,
  resolveTranscriberConfig,
  SerialQueue,
  TRANSCRIPT_CHECKPOINT_FILE,
  TranscriberError,
  TranscriberErrorCode,
  type CheckpointIdentity,
  type ChunkMirror,
  type EncryptedCredentialSource,
  type FetchLike,
  type PcmSource,
  type StepReport,
  type TranscriberAdapter,
  type TranscriberConfig,
  type TranscriberLog,
  type AudioSourceInterval,
  type TranscriptRunner,
  type TranscriptRunnerOptions,
  type VoiceActivityDetector,
} from '@dems/transcriber';
import type { SttEnvelopeOpener } from './credential-opener';
import type { RevealedSttCredential } from './credential-reveal';
import { sessionScratchDir, sessionTapPath, type TranscriberHost } from './host';
import type { SttSessionSnapshot, SttSnapshotStore } from './snapshot';

export const CHECKPOINT_RECOVERY_LIMIT = 3;

/**
 * THE DURABLE HALF OF THE TAP LATCH (code review row 80, R80-06). An empty file in the session's
 * scratch folder, made THE MOMENT the capture worker reports that the tap is not written. The
 * in-memory latch reaches the checkpoint file only at the entry of the runner's next step; a Core
 * that died in between used to reopen the session with "tap never lost", plan the short tap to its
 * end and seal ASSEMBLED for audio that was never transcribed. A session whose folder holds this
 * file is opened with the latch SET, for good. It holds nothing; it goes with the scratch folder.
 */
export const TAP_LOST_MARKER_FILE = 'tap-lost';

export const SessionTranscriptionCode = {
  HOST_CONFIG_INVALID: 'HOST_CONFIG_INVALID',
  CREDENTIAL_UNAVAILABLE: 'CREDENTIAL_UNAVAILABLE',
  CHECKPOINT_RECOVERY_EXHAUSTED: 'CHECKPOINT_RECOVERY_EXHAUSTED',
  CHECKPOINT_MOVED_ASIDE: 'CHECKPOINT_MOVED_ASIDE',
} as const;

/** What the capture supervisor is asked: the live worker, the phase, and its telemetry. */
export interface CaptureFacts {
  status(): { readonly sessionId: string | null; readonly workerPid: number | null; readonly phase: string };
  on(event: 'telemetry', listener: (event: { readonly sessionId: string; readonly frame: { readonly tapActive: boolean } }) => void): () => void;
}

/** The engine guard of the pipeline (`EngineGuard` of `@dems/transcriber`, by its form). */
export type SessionEngineGuard = NonNullable<TranscriptRunnerOptions['engineGuard']>;

interface SessionCompositionBase {
  /** `createEngineGuard` of `@dems/transcriber` (the mount hands it in). Absent: no guard. */
  readonly engineGuard?: (sessionScratchDir: string) => SessionEngineGuard;
  /** The opener of a stored `ENCRYPTED` credential (`coreSttEnvelopeOpener`). Absent: a session with that kind is UNAVAILABLE. */
  readonly openEncrypted?: SttEnvelopeOpener;
  /** The media store root of this Core: the session's scratch is `<mediaStoreDir>/.transcriber/sessions/<id>` (ruling D180). */
  readonly mediaStoreDir: string;
  readonly host: () => TranscriberHost;
  readonly snapshots: SttSnapshotStore;
  readonly reveal: () => Promise<RevealedSttCredential>;
  readonly capture: CaptureFacts;
  readonly mirror: ChunkMirror;
  readonly queue: SerialQueue;
  readonly now: () => number;
  readonly fetchImpl?: FetchLike;
  /**
   * THE AUDIO-SOURCE INTERVALS OF THE SESSION (`session_audio_intervals`, media time; transcript
   * spec §A.1; code review row 80, R80-02). NOT OPTIONAL: a runner that is given none names no
   * source for any chunk and flags every transcript `intervals_incomplete` - a false statement in
   * the sealed document. Read before every step of the runner (a switch adds rows while the
   * session records).
   */
  readonly intervals: (sessionId: string) => Promise<readonly AudioSourceInterval[]>;
}

/**
 * The transcriber's own log (`log.ts`), NOT the server's logger: its entries are blanked and
 * reduced to codes by the adapter. `transcriberLog` is the name; `log` is accepted as the same
 * thing (the name this interface had on its first day, which a row built beside this one uses).
 */
export type SessionCompositionDeps = SessionCompositionBase &
  ({ readonly transcriberLog: TranscriberLog; readonly log?: undefined } | { readonly log: TranscriberLog; readonly transcriberLog?: undefined });

export interface OpenSessionOptions {
  /** The caller's hold (CPU pressure, a seal in progress): true keeps the runner back between chunks (§C). */
  readonly shouldPause?: () => boolean;
}

export interface EnabledSessionTranscription {
  readonly state: 'ENABLED';
  readonly snapshot: SttSessionSnapshot;
  readonly config: TranscriberConfig;
  readonly adapter: TranscriberAdapter;
  readonly vad: VoiceActivityDetector | null;
  readonly runner: TranscriptRunner;
  readonly scratchDir: string;
  readonly tapPath: string;
  /** How many invalid checkpoint files were moved aside to build this runner: 0 or 1. */
  readonly checkpointsMovedAside: number;
  /** True once the tap was reported lost. Never false again. */
  tapLost(): boolean;
  /** Holds the runner back between chunks, or lets it go on. */
  hold(paused: boolean): void;
  step(options: { readonly final: boolean }): Promise<StepReport>;
  /**
   * WHAT THE ASSEMBLY OF THIS SESSION'S TRANSCRIPT IS GIVEN (row 71c): the identity and the audio
   * the runner was built with. `assembleTranscript` of `@dems/transcriber` refuses any other.
   */
  readonly assembly: { readonly identity: CheckpointIdentity; readonly source: PcmSource };
  /**
   * THE CLOSE-OUT OF THE SEAL (row 116's rule, the reference of `sealing/__tests__/support.ts`, on
   * the transcriber's public pipeline only): ONE MORE runner on the same scratch directory whose
   * engine refuses every chunk at once with `chunkCode`, on a queue of its own (the engine of the
   * session may be hanging in the other one). The runner's own rule then gives up every chunk that
   * is not committed - FAILED, without text, the row mirrored - and ends the plan. It decodes
   * nothing and asks no backend; an engine the session's own runner left running is stopped by
   * the session's engine guard, as after a kill (N-2). Resolves true when the plan is complete.
   */
  closeOut(chunkCode: string): Promise<boolean>;
  /**
   * STOPS THE SESSION'S OWN RUNNER FOR GOOD (code review row 80, R80-03): from here on it writes no
   * checkpoint and no chunk row and starts no attempt, whatever an engine call that is still under
   * way answers. Called by the close-out of the seal (before the closing runner is built), for an
   * abandoned session and at a shutdown. Also ends the telemetry subscription. Not reversible.
   */
  stop(): void;
  /** True once `stop()` was called. */
  stopped(): boolean;
  /** Ends the telemetry subscription. The checkpoint and the files stay. */
  close(): void;
}

export type SessionTranscription =
  | { readonly state: 'NO_SNAPSHOT'; readonly snapshot: null }
  | { readonly state: 'DISABLED'; readonly snapshot: SttSessionSnapshot }
  | { readonly state: 'UNAVAILABLE'; readonly snapshot: SttSessionSnapshot; readonly code: string }
  | EnabledSessionTranscription;

const SOURCE = 'transcription.session';
const RECORDING = 'RECORDING';

/** Moves an invalid checkpoint file aside under the first free name. Null: the limit of the session is reached. */
export function moveCheckpointAside(scratchDir: string): string | null {
  const file = join(scratchDir, TRANSCRIPT_CHECKPOINT_FILE);
  for (let index = 1; index <= CHECKPOINT_RECOVERY_LIMIT; index += 1) {
    const aside = `${file}.invalid-${index}`;
    if (existsSync(aside)) continue;
    renameSync(file, aside);
    return aside;
  }
  return null;
}

export async function openSessionTranscription(deps: SessionCompositionDeps, sessionId: string, options: OpenSessionOptions = {}): Promise<SessionTranscription> {
  // Named apart from the server's logger: the entry form (`error`, `context.reason`) is the transcriber's.
  const transcriberLog: TranscriberLog = deps.transcriberLog ?? deps.log;
  const snapshot = await deps.snapshots.get(sessionId);
  if (snapshot === null) {
    transcriberLog.error({ source: `${SOURCE}.open`, message: 'the session has no STT snapshot; no transcription runs for it', context: { reason: 'NO_SNAPSHOT' }, correlationId: sessionId });
    return { state: 'NO_SNAPSHOT', snapshot: null };
  }
  if (!snapshot.enabled) return { state: 'DISABLED', snapshot };

  const unavailable = (code: string, message: string, error?: unknown): SessionTranscription => {
    transcriberLog.error({ source: `${SOURCE}.open`, message, error, context: { reason: code, backend: snapshot.backend }, correlationId: sessionId });
    return { state: 'UNAVAILABLE', snapshot, code };
  };

  let host: TranscriberHost;
  try {
    host = deps.host();
  } catch {
    return unavailable(SessionTranscriptionCode.HOST_CONFIG_INVALID, 'the transcriber host file cannot be used; the session is not transcribed');
  }

  let credentialRef: string | null = null;
  let encryptedCredential: EncryptedCredentialSource | undefined;
  if (snapshot.backend === 'omlx-server' && snapshot.credentialKind !== null) {
    const openEncrypted = deps.openEncrypted;
    // The same rule as the probe: without an opener an ENCRYPTED credential is not revealed at all.
    if (snapshot.credentialKind !== 'REFERENCE' && (snapshot.credentialKind !== 'ENCRYPTED' || openEncrypted === undefined)) {
      return unavailable(SessionTranscriptionCode.CREDENTIAL_UNAVAILABLE, 'the stored credential kind cannot be handed to the transcriber; the session is not transcribed');
    }
    let revealed: RevealedSttCredential;
    try {
      revealed = await deps.reveal();
    } catch (error) {
      return unavailable(SessionTranscriptionCode.CREDENTIAL_UNAVAILABLE, 'the stored credential could not be read; the session is not transcribed', error);
    }
    if (revealed.kind !== snapshot.credentialKind) return unavailable(SessionTranscriptionCode.CREDENTIAL_UNAVAILABLE, 'the stored credential is no longer of the kind of the snapshot; the session is not transcribed');
    if (revealed.kind === 'REFERENCE') credentialRef = revealed.ref;
    else if (revealed.kind === 'ENCRYPTED' && openEncrypted !== undefined) {
      const { sealed } = revealed;
      // Called once by the transcriber's key-loader when the adapter is built; never called here.
      encryptedCredential = { open: () => openEncrypted(sealed) };
    }
  }

  const scratchDir = sessionScratchDir(deps.mediaStoreDir, sessionId);
  const tapPath = sessionTapPath(deps.mediaStoreDir, sessionId);
  const captureWorkerPid = (): number | null => deps.capture.status().workerPid;

  // STICKY (N-1). Latched by a frame of THIS session while it records: a tap that ends because
  // the session stops is not a lost tap. DURABLE (R80-06): the latch of an earlier process is read
  // back from its marker, and a new latch is written to the disk before anything else happens.
  const lostMarker = join(scratchDir, TAP_LOST_MARKER_FILE);
  let lost = existsSync(lostMarker);
  const unsubscribe = deps.capture.on('telemetry', (event) => {
    if (lost || event.sessionId !== sessionId || event.frame.tapActive) return;
    const status = deps.capture.status();
    if (status.sessionId !== sessionId || status.phase !== RECORDING) return;
    lost = true;
    try {
      mkdirSync(scratchDir, { recursive: true, mode: 0o700 });
      const handle = openSync(lostMarker, 'a', 0o600);
      try {
        fsyncSync(handle);
      } finally {
        closeSync(handle);
      }
    } catch (error) {
      // The latch of this process holds; only a Core that dies before the next step would lose it. Said, never silent.
      transcriberLog.error({ source: `${SOURCE}.tap`, message: 'the lost tap of the session could not be recorded on the disk; it is held in memory only until the next step of the runner', error, context: { reason: 'TAP_LOST_MARKER_NOT_WRITTEN' }, correlationId: sessionId });
    }
    transcriberLog.error({ source: `${SOURCE}.tap`, message: 'the capture worker reports that the PCM tap of the session is not written; the transcript will be PARTIAL', context: { reason: 'TAP_LOST' }, correlationId: sessionId });
  });

  let held = false;
  /** R80-03: set once, by `stop()` and by `closeOut`. The session's own runner reads it before every write and after every engine call. */
  let stopped = false;
  const shouldPause = (): boolean => held || stopped || options.shouldPause?.() === true;

  try {
    const config = resolveTranscriberConfig({ backend: snapshot.backend, endpoint: snapshot.endpoint, model: snapshot.model, language: snapshot.language, credentialRef }, host.runtime);
    const engineGuard = deps.engineGuard?.(scratchDir);
    const onEngineStart = engineGuard?.record;
    const adapter = createTranscriberAdapter(config, { log: transcriberLog, queue: deps.queue, captureWorkerPid, onEngineStart, fetchImpl: deps.fetchImpl, ...(encryptedCredential === undefined ? {} : { encryptedCredential }) });
    const vad = host.vad === null ? null : createSileroVad(resolveSileroVadConfig(host.vad), { log: transcriberLog, captureWorkerPid, onEngineStart });
    const timeline = captureTapTimeline();
    const source = openPcmSource({ container: 'raw', path: tapPath, sampleRateHz: timeline.sampleRateHz });
    // The runner's option is synchronous: it reads this copy, refreshed before every step (R80-02).
    let intervals: readonly AudioSourceInterval[] = [];
    const refreshIntervals = async (): Promise<void> => {
      try {
        intervals = await deps.intervals(sessionId);
      } catch (error) {
        // The last copy stays: a chunk the copy does not cover is flagged `intervals_incomplete`, which is then true.
        transcriberLog.error({ source: `${SOURCE}.intervals`, message: 'the audio-source intervals of the session could not be read; the last copy is used', error, context: { reason: 'INTERVALS_NOT_READ', known: intervals.length }, correlationId: sessionId });
      }
    };
    const build = (): TranscriptRunner =>
      createTranscriptRunner({
        sessionId,
        adapter,
        timeline,
        source,
        vad,
        sessionScratchDir: scratchDir,
        log: transcriberLog,
        mirror: deps.mirror,
        now: () => new Date(deps.now()),
        tapLost: () => lost,
        engineGuard,
        shouldPause,
        shouldStop: () => stopped,
        intervals: () => intervals,
      });

    let runner: TranscriptRunner;
    let movedAside = 0;
    try {
      runner = build();
    } catch (error) {
      if (!(error instanceof TranscriberError) || error.code !== TranscriberErrorCode.CHECKPOINT_INVALID) throw error;
      const reason = typeof error.detail['reason'] === 'string' ? error.detail['reason'] : 'UNKNOWN';
      const aside = moveCheckpointAside(scratchDir);
      if (aside === null) {
        unsubscribe();
        return unavailable(SessionTranscriptionCode.CHECKPOINT_RECOVERY_EXHAUSTED, 'the transcript checkpoint is invalid again and the recovery limit of the session is reached; the session is not transcribed further', error);
      }
      movedAside = 1;
      transcriberLog.error({
        source: `${SOURCE}.checkpoint`,
        message: 'the transcript checkpoint could not be used; it was moved aside and the transcription of the session starts again in new rows',
        error,
        context: { code: SessionTranscriptionCode.CHECKPOINT_MOVED_ASIDE, reason, aside: aside.slice(scratchDir.length + 1), limit: CHECKPOINT_RECOVERY_LIMIT },
        correlationId: sessionId,
      });
      // A second refusal is not recovered here: it is thrown to the handler below.
      runner = build();
    }

    return {
      state: 'ENABLED',
      snapshot,
      config,
      adapter,
      vad,
      runner,
      scratchDir,
      tapPath,
      checkpointsMovedAside: movedAside,
      tapLost: () => lost,
      hold(paused) {
        held = paused;
      },
      async step(step) {
        await refreshIntervals();
        return runner.step(step);
      },
      assembly: { identity: { sessionId, backend: adapter.backend, model: adapter.model, timeline }, source },
      async closeOut(chunkCode) {
        // THE SESSION'S OWN RUNNER IS STOPPED FIRST (R80-03): one scratch directory has one writer.
        stopped = true;
        const refusing: TranscriberAdapter = {
          backend: adapter.backend,
          model: adapter.model,
          queue: new SerialQueue(),
          // It starts no engine, so no engine of it can outrank the capture worker: the sibling rule is stated as kept.
          captureWorkerStated: true,
          transcribe: async () => {
            throw new TranscriberError(chunkCode as TranscriberErrorCode, 'the seal stopped waiting for this chunk', { reason: 'SEAL_WAIT_LIMIT' });
          },
        };
        await refreshIntervals();
        const closing = createTranscriptRunner({ sessionId, adapter: refusing, timeline, source, vad, sessionScratchDir: scratchDir, log: transcriberLog, mirror: deps.mirror, now: () => new Date(deps.now()), tapLost: () => lost, engineGuard, intervals: () => intervals });
        return (await closing.step({ final: true })).complete;
      },
      stop() {
        stopped = true;
        unsubscribe();
      },
      stopped: () => stopped,
      close: unsubscribe,
    };
  } catch (error) {
    unsubscribe();
    const code = error instanceof TranscriberError ? error.code : 'TRANSCRIBER_BUILD_FAILED';
    return unavailable(code, 'the transcriber of the session could not be built; the session is not transcribed', error);
  }
}
