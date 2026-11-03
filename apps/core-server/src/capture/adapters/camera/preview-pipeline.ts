/**
 * THE PIPELINE OF ONE LIVE CAMERA PREVIEW (decisions D51 / D53: motion JPEG of about 8 pictures per
 * second at 640x360, shown in the web console; recording always has priority).
 *
 * `openPreview(deviceId, operatorId, onChunk, signal)` takes THE STEPS OF `openSource` of the
 * production camera adapter (`onvif-relay.ts`), IN THE SAME ORDER AND WITH THE SAME REFUSALS, but for
 * no session and no ingest address:
 *
 *   0. refusals before anything is asked: an aborted signal, no preview starter handed in
 *      (`CAPTURE_CAMERA_RELAY_NOT_CONFIGURED`);
 *   1. the stored facts of the stream the preview is made from (`stream`, handed in by the
 *      composition; none: `CAPTURE_PROFILE_UNKNOWN`; a read that fails:
 *      `CAPTURE_CAMERA_STREAM_FACTS_NOT_READ`);
 *  1b. THE DESTINATION RULE ON THAT STORED ADDRESS (AD-02 (1)), with the source address it names
 *      (`storedCameraSourceOf`): a refused address, a rule that was not handed in, an admission that
 *      names no source - `CAPTURE_CAMERA_ADDRESS_REFUSED` with the rule's own code, before the reader
 *      is called (0 reveals, 0 audit entries), before any request and before any process;
 *   2. the credential reader of the preview, ONCE: `credentials.previewOpen(deviceId, operatorId)`.
 *      The reader reveals and audits in one unit of its own (`CAPTURE_CREDENTIAL_REVEALED`, reason
 *      `PREVIEW_OPEN`). THIS FILE OPENS NO UNIT OF WORK AND MUST NOT BE CALLED INSIDE ONE;
 *   3. ONE authenticated `GetStreamUri` for the stored token (`locator.locate`), from the source
 *      address of step 1b;
 *   4. the start of the preview through the INJECTED STARTER (`start`): the capture relay in preview
 *      mode piped into the guarded encoder that writes `mpjpeg` (`startCameraPreview` of the relay
 *      start, through the production door's pipeline), with the codec stored for the stream. The
 *      starter is a parameter, so that this file names no door, no program and no process; a start
 *      the door refuses (`started` rejects) is `CAPTURE_CAMERA_RELAY_NOT_STARTED` with its code;
 *   5. the wait for the first bytes of the stream, or for its end, which is a named refusal.
 *
 * THE BOUNDS. The whole open is bounded at `PREVIEW_OPEN_BOUND_MS` (10 s). At the bound, and when
 * the signal is aborted during the open, a started preview is STOPPED AND REAPED before the open
 * rejects. A stop gives the preview `PREVIEW_STOP_BOUND_MS` (3 s) to end by its order to stop, then
 * `PREVIEW_REAP_BOUND_MS` (2 s) more; a preview that has still not ended is named
 * (`CAPTURE_CAMERA_RELAY_NOT_REAPED`), never forgotten. Nothing is retried here: a second open is a
 * second reveal with its own audit entry (the manager decides whether there is one).
 *
 * WHAT THE PIPELINE IS: its device, a stop, and its end. NO address, NO locator, NO credential: the
 * opaque credential lives inside one call of `openPreview` and goes to the starter only. The bytes
 * go to `onChunk` as they come; the manager parses them.
 *
 * It logs nothing itself (static rule G-R4): a refusal is a thrown `CameraOpenError` or
 * `CaptureAdapterError` with a code, and the end is a value.
 */
import type { CaptureTimers } from '../../types';
import type { SealedCredential } from '../credential';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { ConnectionTestOutcome } from '../types';
import type { OnvifStreamLocator } from './onvif-session';
import { CameraOpenError, CameraOpenRefusal, relayEndOf, type StoredCameraStream } from './onvif-relay';
import { judgeStoredCamera, storedCameraSourceOf, type StoredCameraAddressRule } from './stored-address';

/** The bound of one open of a preview: the stored facts, the rule, the reveal, the locator read, the start and the first bytes. */
export const PREVIEW_OPEN_BOUND_MS = 10_000;
/** How long a preview has to end after its order to stop, before it is killed. */
export const PREVIEW_STOP_BOUND_MS = 3_000;
/** How long a stopped preview is waited for after that. */
export const PREVIEW_REAP_BOUND_MS = 2_000;

// ── What the starter of the camera layer is (by shape: the controller binds the relay start) ──────

/** What one start of a preview is handed. Nothing of it is kept after the call. */
export interface PreviewStartRequest {
  readonly deviceId: string;
  /** The stream locator as `locate` answered it: host and path, never a user part. */
  readonly locator: string;
  /** The credential of the reader, opaque. */
  readonly sealed: SealedCredential;
  /** The address of this host the connection to the camera leaves from (the judgement's source). */
  readonly source: string;
  /** The codec stored for the stream (`H264`, `HEVC`), or null when none is stored: the starter refuses what it cannot decode. */
  readonly codec: string | null;
}

/** How a preview process ended: its exit code (null: a signal) and a code word (`STOPPED`, `START_REFUSED`, `RELAY_ENDED`, `ENCODER_ENDED`). */
export interface PreviewProcessExit {
  readonly code: number | null;
  readonly reason: string;
}

/**
 * A running preview as the starter hands it back, by shape: `CameraPreview` of the relay start
 * (`startCameraPreview` of `relay-start.ts`) fits it.
 */
export interface CameraPreviewProcess {
  /** Resolves when the relay took its start message and the encoder started; rejects with the door's code. */
  readonly started?: Promise<void>;
  /** Told every chunk of the `mpjpeg` stream as it arrives (not aligned to parts). */
  onChunk(listener: (bytes: Buffer) => void): (() => void) | void;
  /** The order to stop; resolves when the process has ended (the starter kills what is left after its own bound). */
  stop(): Promise<void>;
  /** Settles once, when the process has ended. Never rejects. */
  readonly exited: Promise<PreviewProcessExit>;
}

/** Starts one preview. Throws (a code) for a start it refuses before anything runs. */
export type CameraPreviewStarter = (start: PreviewStartRequest) => CameraPreviewProcess;

/** The stored stream a preview is made from, with the codec stored for it. */
export type PreviewStream = StoredCameraStream & { readonly codec?: string | null };

/** The reader of the preview, by shape (the holder `CAMERA_PREVIEW` of the closed reader list). */
export interface PreviewCredentialReader {
  previewOpen(deviceId: string, operatorId: string): Promise<SealedCredential>;
}

export interface PreviewPipelineDependencies {
  readonly timers: CaptureTimers;
  /** The reader taken for the holder `CAMERA_PREVIEW`. Called once per open, outside any unit of work. */
  readonly credentials: PreviewCredentialReader;
  /** The locator read of the ONVIF session (`createOnvifStreamLocator`). */
  readonly locator: OnvifStreamLocator;
  /** The stored facts of the stream a preview of this camera is made from, or null when it has none. */
  readonly stream: (deviceId: string) => Promise<PreviewStream | null>;
  /** THE DESTINATION RULE ON A STORED CAMERA ADDRESS, the same binding as the camera adapter's. Without it every open is refused. */
  readonly storedAddress?: StoredCameraAddressRule;
  /** The starter of the camera layer. Null: no preview can be started (`CAPTURE_CAMERA_RELAY_NOT_CONFIGURED`). */
  readonly start: CameraPreviewStarter | null;
}

/** How a pipeline that was open ended. `stopped`: by its own `stop()`; otherwise by itself (the camera, the encoder). */
export interface PreviewPipelineEnd {
  readonly stopped: boolean;
  readonly code: CameraOpenRefusal;
  readonly reason: string;
}

/** An open preview: its device, its stop and its end. Nothing else. */
export interface PreviewPipeline {
  readonly deviceId: string;
  /** Stops the preview within the bounds. Rejects `CAPTURE_CAMERA_RELAY_NOT_REAPED` for one that had not ended. Twice is safe. */
  stop(): Promise<void>;
  /** Settles once, when the preview has ended. Never rejects. */
  readonly ended: Promise<PreviewPipelineEnd>;
}

export type PreviewOpener = (deviceId: string, operatorId: string, onChunk: (bytes: Buffer) => void, signal: AbortSignal) => Promise<PreviewPipeline>;

/** A code word of another unit, as a reason: upper-case words, never a value. */
const REASON_WORD = /^[A-Z][A-Z0-9_]{0,63}$/;
const reasonOf = (value: unknown): string | null => (typeof value === 'string' && REASON_WORD.test(value) ? value : null);

/**
 * What the end of a preview means. The starter names who ended first: a stop (`STOPPED`), a refused
 * start (`START_REFUSED`), the encoder (`ENCODER_ENDED`: its code is the guard's, never read as the
 * relay's), or the relay (`RELAY_ENDED`, and any other word: its exit codes as the camera adapter reads
 * them - 23 a refused credential, 31 / 32 a lost stream, 20 an absent camera). A word the starter names
 * is kept where it is a code word; `AUTH_REFUSED` named by itself is a refused credential.
 */
export function previewEndOf(exit: PreviewProcessExit): { readonly code: CameraOpenRefusal; readonly reason: string } {
  const named = reasonOf(exit?.reason);
  const code = typeof exit?.code === 'number' ? exit.code : null;
  if (named === 'AUTH_REFUSED') return { code: CameraOpenRefusal.AUTHENTICATION_REFUSED, reason: named };
  if (named === 'STOPPED') return { code: CameraOpenRefusal.RELAY_STOPPED, reason: named };
  if (named === 'START_REFUSED') return { code: CameraOpenRefusal.RELAY_NOT_STARTED, reason: named };
  if (named === 'ENCODER_ENDED') return { code: CameraOpenRefusal.RELAY_FAILED, reason: named };
  const end = relayEndOf({ exitCode: code, signal: null, spawnFailed: false });
  return { code: end.refusal, reason: named === null || named === 'RELAY_ENDED' ? end.reason : named };
}

type Stop = 'ABORTED' | 'BOUND';

export function createPreviewOpener(dependencies: PreviewPipelineDependencies): PreviewOpener {
  const { timers, credentials, locator, stream } = dependencies;

  /** Resolves true when the process ended inside the bound. */
  const endedWithin = (process: CameraPreviewProcess, boundMs: number): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      const cancel = timers.after(boundMs, () => resolve(false));
      void process.exited.then(() => {
        cancel();
        resolve(true);
      });
    });

  /** The one stop of a process: the order, the stop bound, the reap bound. True when it ended. */
  const stopAndReap = async (process: CameraPreviewProcess): Promise<boolean> => {
    // The order to stop is given once; a starter whose stop throws is waited for all the same.
    const ordered = Promise.resolve()
      .then(() => process.stop())
      .catch(() => undefined);
    if (await endedWithin(process, PREVIEW_STOP_BOUND_MS)) return true;
    await ordered;
    return endedWithin(process, PREVIEW_REAP_BOUND_MS);
  };

  return async function openPreview(deviceId: string, operatorId: string, onChunk: (bytes: Buffer) => void, signal: AbortSignal): Promise<PreviewPipeline> {
    // 0. Before anything is asked.
    if (signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, deviceId);
    const start = dependencies.start;
    if (typeof start !== 'function') throw new CameraOpenError(CameraOpenRefusal.RELAY_NOT_CONFIGURED, deviceId);

    // The bound and the signal, as ONE stop of this open. The inner signal is the ONVIF read's.
    const inner = new AbortController();
    let stopNow: (why: Stop) => void = () => {};
    const stopped = new Promise<Stop>((resolve) => {
      stopNow = resolve;
    });
    const stopOpen = (why: Stop): void => {
      inner.abort();
      stopNow(why);
    };
    const onAbort = (): void => stopOpen('ABORTED');
    signal.addEventListener('abort', onAbort, { once: true });
    const cancelBound = timers.after(PREVIEW_OPEN_BOUND_MS, () => stopOpen('BOUND'));
    const stopError = (why: Stop): Error => (why === 'ABORTED' ? new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, deviceId) : new CameraOpenError(CameraOpenRefusal.OPEN_TIMEOUT, deviceId));
    const until = <Value>(step: Promise<Value>): Promise<Value> =>
      Promise.race([
        step,
        stopped.then((why): never => {
          throw stopError(why);
        }),
      ]);

    let process: CameraPreviewProcess | null = null;
    try {
      // 1. The stored facts of the stream.
      let stored: PreviewStream | null;
      try {
        stored = await until(stream(deviceId));
      } catch (error) {
        if (error instanceof CaptureAdapterError || error instanceof CameraOpenError) throw error;
        throw new CameraOpenError(CameraOpenRefusal.STREAM_FACTS_NOT_READ, deviceId);
      }
      if (stored === null) throw new CaptureAdapterError(CaptureAdapterRefusal.PROFILE_UNKNOWN, deviceId);

      // 1b. AD-02 (1): the STORED address under the destination rule. Before the reveal, before any request, before any process.
      const judged = judgeStoredCamera(stored.candidate, dependencies.storedAddress);
      if (!judged.allowed) throw new CameraOpenError(CameraOpenRefusal.ADDRESS_REFUSED, deviceId, judged.refusal);
      const from = storedCameraSourceOf(judged);
      if ('refusal' in from) throw new CameraOpenError(CameraOpenRefusal.ADDRESS_REFUSED, deviceId, from.refusal);

      // 2. The credential: one read, one audit entry (the reader's). Outside any unit of work.
      let sealed: SealedCredential;
      try {
        sealed = await until(credentials.previewOpen(deviceId, operatorId));
      } catch (error) {
        if (error instanceof CaptureAdapterError || error instanceof CameraOpenError) throw error;
        throw new CameraOpenError(CameraOpenRefusal.CREDENTIAL_NOT_READ, deviceId, reasonOf((error as { code?: unknown } | null)?.code));
      }

      // 3. ONE authenticated read of the stream address, now, from the judged source.
      const located = await until(locator.locate(stored.candidate, sealed, stored.onvifProfileToken, inner.signal, from.sourceAddress));
      if (located.outcome !== ConnectionTestOutcome.REACHABLE || located.locator === null) {
        const refusal =
          located.outcome === ConnectionTestOutcome.AUTHENTICATION_FAILED
            ? CameraOpenRefusal.AUTHENTICATION_REFUSED
            : located.outcome === ConnectionTestOutcome.UNREACHABLE
              ? CameraOpenRefusal.UNREACHABLE
              : CameraOpenRefusal.LOCATOR_REFUSED;
        throw new CameraOpenError(refusal, deviceId, located.reason);
      }

      // 4. The start, through the starter of the camera layer. The credential goes there and nowhere else.
      let firstBytes: () => void = () => {};
      const flowing = new Promise<'FLOWING'>((resolve) => {
        firstBytes = () => resolve('FLOWING');
      });
      try {
        process = start({ deviceId, locator: located.locator, sealed, source: from.sourceAddress, codec: typeof stored.codec === 'string' ? stored.codec : null });
      } catch (error) {
        throw new CameraOpenError(CameraOpenRefusal.RELAY_NOT_STARTED, deviceId, reasonOf((error as { code?: unknown } | null)?.code));
      }
      process.onChunk((bytes) => {
        firstBytes();
        try {
          onChunk(bytes);
        } catch {
          // The listener never stops the stream.
        }
      });
      // A start the door refused is a refusal of the start, by the door's code (the starter ends what it started).
      const started = process.started;
      if (started !== undefined) {
        try {
          await until(started);
        } catch (error) {
          if (error instanceof CaptureAdapterError || error instanceof CameraOpenError) throw error;
          throw new CameraOpenError(CameraOpenRefusal.RELAY_NOT_STARTED, deviceId, reasonOf((error as { code?: unknown } | null)?.code));
        }
      }

      // 5. The first bytes, or the end.
      const first = await until(Promise.race([flowing, process.exited]));
      if (first !== 'FLOWING') {
        const end = previewEndOf(first);
        throw new CameraOpenError(end.code, deviceId, end.reason);
      }
    } catch (error) {
      cancelBound();
      signal.removeEventListener('abort', onAbort);
      // Whatever stopped the open: a started preview is stopped and waited for before the open rejects.
      if (process !== null && !(await stopAndReap(process))) throw new CameraOpenError(CameraOpenRefusal.RELAY_NOT_REAPED, deviceId);
      throw error;
    }
    cancelBound();
    signal.removeEventListener('abort', onAbort);

    const running: CameraPreviewProcess = process;
    let stopping: Promise<void> | null = null;
    let stoppedByUs = false;
    const ended = running.exited.then((exit): PreviewPipelineEnd => {
      const end = previewEndOf(exit);
      return Object.freeze({ stopped: stoppedByUs, code: end.code, reason: end.reason });
    });
    return Object.freeze({
      deviceId,
      ended,
      stop(): Promise<void> {
        stoppedByUs = true;
        stopping ??= stopAndReap(running).then((done) => {
          if (!done) throw new CameraOpenError(CameraOpenRefusal.RELAY_NOT_REAPED, deviceId);
        });
        return stopping;
      },
    });
  };
}
