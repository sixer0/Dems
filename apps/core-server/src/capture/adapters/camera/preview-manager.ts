/**
 * THE LIVE CAMERA PREVIEWS OF ONE CORE: their lifecycle, their bounds and their viewers (decisions
 * D51 / D53). RECORDING ALWAYS HAS PRIORITY.
 *
 * ONE PIPELINE PER CAMERA, shared by its viewers. The bounds (`CAMERA_PREVIEW_LIMITS` of the shared
 * contract): one pipeline per camera and four in all (widened 2026-11-05, the principal: the preview
 * is a MUST, so every video track of D60 gets its pipeline); four viewers per camera and sixteen in
 * all. A
 * viewer over a bound is refused with `PREVIEW_LIMIT` (the route answers 429) and changes nothing.
 * A pipeline that has no viewer left LINGERS `PREVIEW_LINGER_MS` (5 s): a viewer that comes back in
 * that time (a reload of the page) gets the running stream. A lingering pipeline is the first to
 * go when a third camera asks for a place.
 *
 * THE FRAMES. The pipeline writes the `mpjpeg` stream of the encoder (`--<boundary>`, a
 * `Content-type` and a `Content-length` header, the JPEG, a line end). `createMpjpegParser` cuts it
 * into pictures BY THEIR LENGTH, across any split of the chunks; a part without a usable length,
 * a part over `PREVIEW_FRAME_MAX_BYTES` and bytes between parts are dropped until the next boundary
 * line. Only the LATEST picture is kept. A viewer takes a picture when it can: a viewer whose
 * socket is full says so (`frame` answers false) and is skipped until it is drained, when it is
 * handed the newest picture at once. A slow viewer never holds a fast one back.
 *
 * RECORDING HAS PRIORITY. `yieldForRecording(deviceId)` is called before the pre-check reads a
 * camera and before a session opens it: the camera's preview is stopped and REAPED (the stop
 * bounds of the pipeline) before it resolves, and the camera stays PAUSED_FOR_RECORDING. Its
 * viewers stay; nothing starts for that camera while it is paused. `resumeAfterRecording(deviceId)`
 * (after the recording's push stands) and `resumeAll()` (at the end of a capture) end the pause and
 * start the pipeline again when viewers remain. A pause that nobody ends ends by itself after
 * `PREVIEW_PAUSE_MAX_MS`.
 *
 * LOSS. A pipeline that ends by itself is started again after `PREVIEW_RESTART_DELAY_MS`, at most
 * `PREVIEW_RESTART_MAX` (3) times in `PREVIEW_RESTART_WINDOW_MS` (5 min); after that the camera is
 * UNAVAILABLE and its viewers are ended. A camera that refuses the credential
 * (`CAPTURE_CAMERA_AUTHENTICATION_REFUSED`) is UNAVAILABLE AT ONCE: no second try, so that the
 * camera's own lock-out is never fed by the preview.
 *
 * STATE PER CAMERA for the client: CONNECTING, LIVE, PAUSED_FOR_RECORDING, UNAVAILABLE.
 *
 * IT LOGS NOTHING ITSELF (static rule G-R4). What the composition may log comes through `report`:
 * a code, the device and a code word.
 */
import type { CaptureTimers } from '../../types';
import { CameraOpenRefusal } from './onvif-relay';
import type { PreviewOpener, PreviewPipeline } from './preview-pipeline';

/** How long a pipeline without viewers keeps running. */
export const PREVIEW_LINGER_MS = 5_000;
/** At most this many restarts after a loss … */
export const PREVIEW_RESTART_MAX = 3;
/** … in this window. */
export const PREVIEW_RESTART_WINDOW_MS = 5 * 60_000;
/** The wait before a restart. */
export const PREVIEW_RESTART_DELAY_MS = 2_000;
/** A pause for a recording that nobody ends ends after this. */
export const PREVIEW_PAUSE_MAX_MS = 60_000;
/** The largest picture taken from the stream. A part that says more is dropped. */
export const PREVIEW_FRAME_MAX_BYTES = 2 * 1024 * 1024;
/** The longest header block of one part. */
export const PREVIEW_PART_HEADER_MAX_BYTES = 1_024;

/** The bounds of the shared contract (`CAMERA_PREVIEW_LIMITS`), as numbers this file holds itself. */
export interface PreviewLimits {
  readonly pipelinesPerCamera: 1;
  readonly pipelines: number;
  readonly viewersPerCamera: number;
  readonly viewers: number;
}
export const PREVIEW_LIMITS: PreviewLimits = Object.freeze({ pipelinesPerCamera: 1, pipelines: 4, viewersPerCamera: 4, viewers: 16 });

export const PreviewState = {
  CONNECTING: 'CONNECTING',
  LIVE: 'LIVE',
  PAUSED_FOR_RECORDING: 'PAUSED_FOR_RECORDING',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type PreviewState = (typeof PreviewState)[keyof typeof PreviewState];

/** Why a viewer was refused or ended. Code words only. */
export const PreviewEndReason = {
  /** A bound of `PREVIEW_LIMITS` is reached. */
  LIMIT: 'PREVIEW_LIMIT',
  /** The camera refused the credential: no second try. */
  AUTH_REFUSED: 'AUTH_REFUSED',
  /** The camera did not come back within the restart bound. */
  UNAVAILABLE: 'PREVIEW_UNAVAILABLE',
  /** The manager was closed (the Core stops). */
  CLOSED: 'PREVIEW_CLOSED',
} as const;
export type PreviewEndReason = (typeof PreviewEndReason)[keyof typeof PreviewEndReason];

/** What a viewer is to the manager. Neither function may throw (a throw is taken as "cannot take it"). */
export interface PreviewSink {
  /** One picture. False while the viewer cannot take another: it is skipped until `drained()`. */
  frame(jpeg: Buffer): boolean;
  /** The state of the camera changed. */
  state?(state: PreviewState): void;
  /** The viewer's stream ends (`PreviewEndReason`). Called once; the viewer is gone after it. */
  end(reason: PreviewEndReason): void;
}

/** A viewer's place. `leave` is safe to call twice; `drained` hands the newest picture when there is one the viewer has not had. */
export interface PreviewViewer {
  readonly deviceId: string;
  leave(): void;
  drained(): void;
}

/** A refusal of a place: a bound is reached, or the camera refused the credential within the restart window (no second try). */
export type PreviewRefusal = typeof PreviewEndReason.LIMIT | typeof PreviewEndReason.AUTH_REFUSED;
export type PreviewJoin = { readonly joined: true; readonly viewer: PreviewViewer; readonly state: PreviewState } | { readonly joined: false; readonly reason: PreviewRefusal };

export interface PreviewManagerDependencies {
  readonly timers: CaptureTimers;
  /** The server clock, in milliseconds (the restart window). */
  readonly now: () => number;
  /** Opens one pipeline (`createPreviewOpener`). */
  readonly open: PreviewOpener;
  /** What the composition may log: a code, the device, a code word. Must not throw. */
  readonly report?: (entry: { readonly code: string; readonly deviceId: string; readonly reason: string | null }) => void;
  readonly limits?: PreviewLimits;
}

export interface PreviewManager {
  /** Takes a place for a viewer, or refuses it (`PREVIEW_LIMIT`). The operator is the one whose viewer starts a pipeline: its reveal is audited for them. */
  join(deviceId: string, operatorId: string, sink: PreviewSink): PreviewJoin;
  /** Why a viewer of this camera would be refused now, or null (operation 112 asks before it issues a token). */
  wouldRefuse(deviceId: string): PreviewRefusal | null;
  /** Stops the camera's preview and waits until it is reaped; the camera stays paused until `resumeAfterRecording`. Never rejects. */
  yieldForRecording(deviceId: string): Promise<void>;
  /** Ends the pause of a camera; starts its pipeline again when viewers remain. */
  resumeAfterRecording(deviceId: string): void;
  /** Ends every pause (the end of a capture). */
  resumeAll(): void;
  /** The state of every camera that has viewers, a pipeline or a pause. */
  states(): Readonly<Record<string, PreviewState>>;
  /** Counts for a check. */
  counts(): { readonly pipelines: number; readonly viewers: number };
  /** Ends every viewer and stops every pipeline (the Core stops). Never rejects. */
  close(): Promise<void>;
}

// ── The frame parser ───────────────────────────────────────────────────────────────────────────

const CRLF_CRLF = Buffer.from('\r\n\r\n');
const DASH_DASH = Buffer.from('--');
const CONTENT_LENGTH = /^content-length:\s*(\d{1,9})\s*$/i;

/** Cuts an `mpjpeg` stream into JPEG pictures by their `Content-length`. Keeps at most one part in memory. */
export interface MpjpegParser {
  push(chunk: Buffer): void;
  /** Bytes dropped while out of step (for a check). */
  dropped(): number;
}

export function createMpjpegParser(onFrame: (jpeg: Buffer) => void, maxFrameBytes = PREVIEW_FRAME_MAX_BYTES): MpjpegParser {
  let pending: Buffer = Buffer.alloc(0);
  /** The length of the body being read, or null while a header block is awaited. */
  let bodyLength: number | null = null;
  let droppedBytes = 0;

  const drop = (count: number): void => {
    droppedBytes += count;
    pending = pending.subarray(count);
  };

  /** Drops up to the next boundary line; false when none is in the buffer yet (the tail that may start one is kept). */
  const resync = (): boolean => {
    const at = pending.indexOf(DASH_DASH, 1);
    if (at < 0) {
      const keep = Math.min(pending.length, 1);
      drop(pending.length - keep);
      return false;
    }
    drop(at);
    return true;
  };

  const step = (): boolean => {
    if (bodyLength === null) {
      // Bytes before the boundary (the line end after the previous body, or noise) are skipped.
      while (pending.length > 0 && (pending[0] === 0x0d || pending[0] === 0x0a)) pending = pending.subarray(1);
      if (pending.length < 2) return false;
      if (pending[0] !== 0x2d || pending[1] !== 0x2d) return resync();
      const end = pending.indexOf(CRLF_CRLF);
      if (end < 0) {
        if (pending.length > PREVIEW_PART_HEADER_MAX_BYTES) return resync();
        return false;
      }
      if (end > PREVIEW_PART_HEADER_MAX_BYTES) return resync();
      const lines = pending.subarray(0, end).toString('latin1').split('\r\n');
      let length: number | null = null;
      for (const line of lines.slice(1)) {
        const match = CONTENT_LENGTH.exec(line);
        if (match?.[1] !== undefined) length = Number(match[1]);
      }
      if (length === null || length < 4 || length > maxFrameBytes) return resync();
      pending = pending.subarray(end + CRLF_CRLF.length);
      bodyLength = length;
      return true;
    }
    if (pending.length < bodyLength) return false;
    const body = Buffer.from(pending.subarray(0, bodyLength));
    pending = pending.subarray(bodyLength);
    bodyLength = null;
    // A picture is a JPEG: it starts with the start-of-image marker. Anything else is not handed on.
    if (body[0] === 0xff && body[1] === 0xd8) onFrame(body);
    else droppedBytes += body.length;
    return true;
  };

  return {
    push(chunk) {
      if (chunk.length === 0) return;
      pending = pending.length === 0 ? Buffer.from(chunk) : Buffer.concat([pending, chunk]);
      while (step()) {
        // each step consumes a header block or a body
      }
    },
    dropped: () => droppedBytes,
  };
}

// ── The manager ────────────────────────────────────────────────────────────────────────────────

interface Viewer {
  readonly id: number;
  readonly operatorId: string;
  readonly sink: PreviewSink;
  /** The number of the last picture it was handed; -1: none yet. */
  sent: number;
  /** True while its socket is full. */
  blocked: boolean;
  gone: boolean;
}

interface Camera {
  readonly deviceId: string;
  readonly viewers: Map<number, Viewer>;
  state: PreviewState;
  pipeline: PreviewPipeline | null;
  /** The open in flight and the controller that aborts it. */
  opening: { readonly controller: AbortController; readonly done: Promise<void> } | null;
  /** The stop in flight. */
  stopping: Promise<void> | null;
  latest: Buffer | null;
  latestSeq: number;
  cancelLinger: (() => void) | null;
  cancelRestart: (() => void) | null;
  /** Bumped at every start and stop: an answer of an older start finds it changed and is dropped. */
  generation: number;
}

export function createPreviewManager(dependencies: PreviewManagerDependencies): PreviewManager {
  const { timers, now, open } = dependencies;
  const limits = dependencies.limits ?? PREVIEW_LIMITS;
  const cameras = new Map<string, Camera>();
  /** Paused cameras and the timer that ends the pause by itself. */
  const paused = new Map<string, () => void>();
  /** The instants of the restarts per device, in the window. */
  const restarts = new Map<string, number[]>();
  /** When a camera last refused the credential. */
  const authRefused = new Map<string, number>();
  let nextViewer = 1;
  let closed = false;

  const report = (code: string, deviceId: string, reason: string | null = null): void => {
    try {
      dependencies.report?.({ code, deviceId, reason });
    } catch {
      // A sink never stops the manager.
    }
  };

  const viewerCount = (): number => [...cameras.values()].reduce((sum, camera) => sum + camera.viewers.size, 0);
  /** A camera holds a pipeline place while it opens, runs, lingers, stops or waits to start again. */
  const holdsPlace = (camera: Camera): boolean => camera.pipeline !== null || camera.opening !== null || camera.stopping !== null || camera.cancelRestart !== null;
  const pipelineCount = (): number => [...cameras.values()].filter(holdsPlace).length;

  const setState = (camera: Camera, state: PreviewState): void => {
    if (camera.state === state) return;
    camera.state = state;
    for (const viewer of camera.viewers.values()) {
      try {
        viewer.sink.state?.(state);
      } catch {
        // A viewer that throws is not the manager's concern.
      }
    }
  };

  const offer = (camera: Camera, viewer: Viewer): void => {
    if (viewer.gone || viewer.blocked || camera.latest === null || viewer.sent === camera.latestSeq) return;
    let taken: boolean;
    try {
      taken = viewer.sink.frame(camera.latest);
    } catch {
      taken = false;
    }
    viewer.sent = camera.latestSeq;
    if (!taken) viewer.blocked = true;
  };

  const endViewers = (camera: Camera, reason: PreviewEndReason): void => {
    for (const viewer of [...camera.viewers.values()]) {
      camera.viewers.delete(viewer.id);
      viewer.gone = true;
      try {
        viewer.sink.end(reason);
      } catch {
        // Nothing to do.
      }
    }
  };

  /** Forgets a camera that has nothing left: no viewer, no pipeline, no open, no stop, no pause. */
  const forgetIfIdle = (camera: Camera): void => {
    if (camera.viewers.size === 0 && !holdsPlace(camera) && !paused.has(camera.deviceId) && cameras.get(camera.deviceId) === camera) {
      camera.cancelLinger?.();
      camera.cancelRestart?.();
      cameras.delete(camera.deviceId);
    }
  };

  /** Stops what the camera runs or opens. Resolves when it is reaped (or named not reaped). Never rejects. */
  const stopCamera = (camera: Camera): Promise<void> => {
    camera.generation += 1;
    camera.cancelLinger?.();
    camera.cancelLinger = null;
    camera.cancelRestart?.();
    camera.cancelRestart = null;
    const opening = camera.opening;
    const pipeline = camera.pipeline;
    camera.pipeline = null;
    camera.latest = null;
    if (opening === null && pipeline === null) return camera.stopping ?? Promise.resolve();
    const before = camera.stopping ?? Promise.resolve();
    const stopping = (async () => {
      await before;
      if (opening !== null) {
        opening.controller.abort();
        await opening.done;
      }
      if (pipeline !== null) {
        try {
          await pipeline.stop();
        } catch (error) {
          report('PREVIEW_NOT_REAPED', camera.deviceId, (error as { code?: string } | null)?.code ?? null);
        }
      }
    })();
    camera.stopping = stopping;
    void stopping.then(() => {
      if (camera.stopping === stopping) camera.stopping = null;
      forgetIfIdle(camera);
    });
    return stopping;
  };

  /** True when a restart is still allowed for the camera; counts it. Kept per device beyond its viewers: a new viewer does not reset the bound. */
  const takeRestart = (camera: Camera): boolean => {
    const at = now();
    const kept = (restarts.get(camera.deviceId) ?? []).filter((instant) => at - instant < PREVIEW_RESTART_WINDOW_MS);
    if (kept.length >= PREVIEW_RESTART_MAX) {
      restarts.set(camera.deviceId, kept);
      return false;
    }
    kept.push(at);
    restarts.set(camera.deviceId, kept);
    return true;
  };

  /** True while the camera's refusal of the credential is recent: no viewer starts it again (the camera's own lock-out is never fed). */
  const authRefusedRecently = (deviceId: string): boolean => {
    const at = authRefused.get(deviceId);
    if (at === undefined) return false;
    if (now() - at < PREVIEW_RESTART_WINDOW_MS) return true;
    authRefused.delete(deviceId);
    return false;
  };

  /** The camera is not to be had now: its viewers are ended. */
  const unavailable = (camera: Camera, reason: PreviewEndReason, code: string | null): void => {
    if (reason === PreviewEndReason.AUTH_REFUSED) authRefused.set(camera.deviceId, now());
    setState(camera, PreviewState.UNAVAILABLE);
    report(reason === PreviewEndReason.AUTH_REFUSED ? 'PREVIEW_AUTH_REFUSED' : 'PREVIEW_UNAVAILABLE', camera.deviceId, code);
    endViewers(camera, reason);
    forgetIfIdle(camera);
  };

  /** After a loss or a failed open: one more try within the bound, or the end. */
  const afterLoss = (camera: Camera, code: string, reason: string | null): void => {
    if (code === CameraOpenRefusal.AUTHENTICATION_REFUSED || code === CameraOpenRefusal.AUTH_SCHEME_REFUSED) return unavailable(camera, PreviewEndReason.AUTH_REFUSED, code);
    if (camera.viewers.size === 0 || closed || paused.has(camera.deviceId)) return forgetIfIdle(camera);
    if (!takeRestart(camera)) return unavailable(camera, PreviewEndReason.UNAVAILABLE, code);
    report('PREVIEW_RESTARTING', camera.deviceId, reason ?? code);
    setState(camera, PreviewState.CONNECTING);
    const generation = camera.generation;
    camera.cancelRestart = timers.after(PREVIEW_RESTART_DELAY_MS, () => {
      camera.cancelRestart = null;
      if (camera.generation === generation) start(camera);
    });
  };

  function start(camera: Camera): void {
    if (closed || paused.has(camera.deviceId) || camera.viewers.size === 0 || holdsPlace(camera)) return;
    const first = camera.viewers.values().next().value;
    if (first === undefined) return;
    camera.generation += 1;
    const generation = camera.generation;
    setState(camera, PreviewState.CONNECTING);
    const parser = createMpjpegParser((jpeg) => {
      if (camera.generation !== generation) return;
      camera.latest = jpeg;
      camera.latestSeq += 1;
      setState(camera, PreviewState.LIVE);
      for (const viewer of camera.viewers.values()) offer(camera, viewer);
    });
    const controller = new AbortController();
    const done = open(camera.deviceId, first.operatorId, (bytes) => parser.push(bytes), controller.signal).then(
      (pipeline) => {
        camera.opening = null;
        if (camera.generation !== generation) {
          // Stopped while it opened: the stop that bumped the generation waits for this answer, so the pipeline is stopped here.
          return pipeline.stop().catch((error: unknown) => report('PREVIEW_NOT_REAPED', camera.deviceId, (error as { code?: string } | null)?.code ?? null));
        }
        camera.pipeline = pipeline;
        void pipeline.ended.then((end) => {
          if (camera.pipeline !== pipeline) return;
          camera.pipeline = null;
          camera.latest = null;
          if (end.stopped) return forgetIfIdle(camera);
          report('PREVIEW_ENDED', camera.deviceId, end.reason);
          afterLoss(camera, end.code, end.reason);
        });
        return undefined;
      },
      (error: unknown) => {
        camera.opening = null;
        if (camera.generation !== generation) return;
        const code = (error as { code?: unknown } | null)?.code;
        const reason = (error as { reason?: unknown } | null)?.reason;
        report('PREVIEW_OPEN_REFUSED', camera.deviceId, typeof code === 'string' ? code : null);
        afterLoss(camera, typeof code === 'string' ? code : 'PREVIEW_OPEN_FAILED', typeof reason === 'string' ? reason : null);
      },
    );
    camera.opening = { controller, done: done.then(() => undefined) };
  }

  const cameraOf = (deviceId: string): Camera => {
    const known = cameras.get(deviceId);
    if (known !== undefined) return known;
    const camera: Camera = {
      deviceId,
      viewers: new Map(),
      state: paused.has(deviceId) ? PreviewState.PAUSED_FOR_RECORDING : PreviewState.CONNECTING,
      pipeline: null,
      opening: null,
      stopping: null,
      latest: null,
      latestSeq: 0,
      cancelLinger: null,
      cancelRestart: null,
      generation: 0,
    };
    cameras.set(deviceId, camera);
    return camera;
  };

  /** A lingering pipeline of another camera, the first to give its place. */
  const lingering = (except: string): Camera | undefined => [...cameras.values()].find((camera) => camera.deviceId !== except && camera.viewers.size === 0 && camera.pipeline !== null);

  const refusal = (deviceId: string): PreviewRefusal | null => {
    if (closed) return PreviewEndReason.LIMIT;
    if (authRefusedRecently(deviceId)) return PreviewEndReason.AUTH_REFUSED;
    const camera = cameras.get(deviceId);
    if (viewerCount() >= limits.viewers) return PreviewEndReason.LIMIT;
    if ((camera?.viewers.size ?? 0) >= limits.viewersPerCamera) return PreviewEndReason.LIMIT;
    const needsPlace = camera === undefined || !holdsPlace(camera);
    return needsPlace && pipelineCount() >= limits.pipelines && lingering(deviceId) === undefined ? PreviewEndReason.LIMIT : null;
  };

  const endPause = (deviceId: string): void => {
    const cancel = paused.get(deviceId);
    if (cancel === undefined) return;
    cancel();
    paused.delete(deviceId);
    const camera = cameras.get(deviceId);
    if (camera === undefined) return;
    if (camera.viewers.size === 0) return forgetIfIdle(camera);
    setState(camera, PreviewState.CONNECTING);
    // After the stop of the yield has ended, never beside it.
    void (camera.stopping ?? Promise.resolve()).then(() => start(camera));
  };

  return {
    join(deviceId, operatorId, sink) {
      const refused = refusal(deviceId);
      if (refused !== null) return { joined: false, reason: refused };
      const camera = cameraOf(deviceId);
      const viewer: Viewer = { id: nextViewer++, operatorId, sink, sent: -1, blocked: false, gone: false };
      camera.viewers.set(viewer.id, viewer);
      camera.cancelLinger?.();
      camera.cancelLinger = null;
      if (!holdsPlace(camera) && !paused.has(deviceId)) {
        const other = pipelineCount() >= limits.pipelines ? lingering(deviceId) : undefined;
        if (other !== undefined) {
          // The lingering pipeline gives its place; this one starts when it is reaped.
          void stopCamera(other).then(() => start(camera));
          setState(camera, PreviewState.CONNECTING);
        } else start(camera);
      } else offer(camera, viewer);
      const place: PreviewViewer = {
        deviceId,
        leave() {
          if (viewer.gone) return;
          viewer.gone = true;
          camera.viewers.delete(viewer.id);
          if (camera.viewers.size > 0) return;
          if (camera.pipeline === null && camera.opening === null) {
            void stopCamera(camera);
            return forgetIfIdle(camera);
          }
          camera.cancelLinger = timers.after(PREVIEW_LINGER_MS, () => {
            camera.cancelLinger = null;
            if (camera.viewers.size === 0) void stopCamera(camera);
          });
        },
        drained() {
          if (viewer.gone) return;
          viewer.blocked = false;
          offer(camera, viewer);
        },
      };
      return { joined: true, viewer: place, state: camera.state };
    },

    wouldRefuse: (deviceId) => refusal(deviceId),

    async yieldForRecording(deviceId) {
      const cancel = paused.get(deviceId);
      cancel?.();
      paused.set(
        deviceId,
        timers.after(PREVIEW_PAUSE_MAX_MS, () => {
          if (paused.has(deviceId)) {
            report('PREVIEW_PAUSE_ENDED_BY_ITSELF', deviceId);
            endPause(deviceId);
          }
        }),
      );
      const camera = cameras.get(deviceId);
      if (camera === undefined) return;
      setState(camera, PreviewState.PAUSED_FOR_RECORDING);
      await stopCamera(camera);
    },

    resumeAfterRecording: (deviceId) => endPause(deviceId),

    resumeAll() {
      for (const deviceId of [...paused.keys()]) endPause(deviceId);
    },

    states() {
      const out: Record<string, PreviewState> = {};
      for (const camera of cameras.values()) out[camera.deviceId] = camera.state;
      for (const deviceId of paused.keys()) out[deviceId] = PreviewState.PAUSED_FOR_RECORDING;
      return Object.freeze(out);
    },

    counts: () => ({ pipelines: pipelineCount(), viewers: viewerCount() }),

    async close() {
      closed = true;
      for (const cancel of paused.values()) cancel();
      paused.clear();
      const stops: Promise<void>[] = [];
      for (const camera of [...cameras.values()]) {
        endViewers(camera, PreviewEndReason.CLOSED);
        stops.push(stopCamera(camera));
      }
      await Promise.all(stops);
    },
  };
}
