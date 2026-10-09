/**
 * The life of one local camera helper (blueprint row 134; capture spec §A.6.4 HL-1, HL-5 to HL-12;
 * R-11 AC-4, AC-5).
 *
 * WHAT A HELPER IS. One process of the FFmpeg command-line program that opens this Mac's camera,
 * encodes H.264 and PUSHES it as RTSP over TCP to the worker's loopback listener. It binds no
 * port. The Core owns it: `open` starts it, the returned handle stops it, and a helper never
 * outlives the handle (the door kills every live helper when the server process exits).
 *
 * THE ORDER OF AN OPEN, each step able to end it with a named error and NO process started:
 *   1. the push target is the loopback listener of a plan;
 *   2. the helper program passes the path rule (`helper-program.ts`);
 *   3. the device list is read (it opens nothing) and exactly one entry equals the name;
 *   4. only then the helper is started, with `S` = the server clock at that instant.
 * A helper that ends while it starts is classified from its captured output by pinned patterns;
 * a listener that refused the connection is tried once more (2 attempts, 500 ms apart, HL-5),
 * and the device list is read again before the second start.
 *
 * HEALTH (HL-9). The helper has no telemetry of its own. What this file knows is whether the
 * process lives and why it ended; whether frames arrive is the worker's ingest state, which the
 * layer above reads. A helper that ends during a session is reported once through `onExit`: no
 * restart here, and never a fake source in its place (HL-11).
 *
 * NO SILENT WAIT (pass C2; D118). A helper that lives but has put out no frame `firstFrameMs` after
 * its start is stopped, and the loss is reported through `onExit` as `OPEN_FAILED` with the reason
 * `NO_FRAME_WITHIN_8S` - or as `PERMISSION_DENIED` when its own text matches the pinned pattern. The
 * signal is the program's progress report (`createDeliveryWatch` below).
 *
 * WHAT IS NOT KNOWN (hypothesis H-18). The texts macOS and the program print for a refused
 * permission or a busy camera were never observed: no agent opens the camera. The patterns below
 * are therefore narrow, and anything else is `OPEN_FAILED`, never a guess.
 */
import type { CaptureTimers } from '../../types';
import { CameraHelperEncoder, LOCAL_CAMERA_DEVICE_NAME, cameraPrecheckArguments, cameraPushArguments, deviceListArguments, isLoopbackIngest } from './camera-helper-args';
import { parseDeviceList, selectLocalDevice, type LocalDeviceList } from './device-list';
import { LocalSourceError, LocalSourceErrorCode, LocalSourceErrorReason } from './errors';
import { helperProgramRefusal } from './helper-program';
import { inspectProgram, startHelperProcess, type HelperDoor, type HelperExit, type HelperProcess, type ProgramInspector } from './process-door';

// ── No silent wait: has the helper delivered anything yet? (pass C2) ─────────────────────────
/**
 * "Has the helper delivered anything yet?" (integration pass C2; hypothesis H-18, decisions D118,
 * D119; capture spec §A.6.4 HL-9, HL-10).
 *
 * WHY. A helper that is alive says nothing about its device. Observed on this host (D118): started
 * from an app that macOS does not ask for the camera, the helper stayed alive, printed nothing and
 * pushed nothing - a silent wait with no end. A helper therefore gets a bound: `FIRST_DELIVERY_SECONDS`
 * after its start it must have encoded one frame (camera) or written one sample (microphone), or it is
 * stopped and the open is reported with a named error (`NO_FRAME_WITHIN_8S` / `NO_SAMPLE_WITHIN_8S`,
 * or `PERMISSION_DENIED` when the helper's own text matches the pinned pattern).
 *
 * THE SIGNAL. The helper is started with the program's machine-readable progress report on its
 * standard output (`-progress pipe:1`, a literal of the argument tables): blocks of `key=value`
 * lines, one block about every half second ONCE THE INPUT IS OPEN. Before that nothing is printed,
 * which is exactly the silent case. Read here are two keys and their numbers only:
 *   `frame=<n>`        frames the encoder has put out (camera),
 *   `total_size=<n>` / `out_time_us=<n>`   bytes written / time written (microphone).
 * No other text of the helper is kept, logged or handed on.
 *
 * WHY 8 SECONDS AND NOT 5. The one attended run with the real camera (`l134_cam_t1`, D119) stamped its
 * first frame 3.2 s after the helper's start; the report then comes up to half a second later. A bound
 * of 5 s would leave about one second. 8 s is more than twice the measured start and still well below
 * the worker's listen bound (15 s), so the named error comes first.
 */
/** After this long without a first frame / sample the helper is stopped. The reason names carry the same figure. */
export const FIRST_DELIVERY_SECONDS = 8;
export const FIRST_DELIVERY_MS = FIRST_DELIVERY_SECONDS * 1000;

export type DeliveryKind = 'FRAME' | 'SAMPLE';

export const NO_DELIVERY_REASON: Readonly<Record<DeliveryKind, LocalSourceErrorReason>> = Object.freeze({
  FRAME: LocalSourceErrorReason.NO_FRAME_WITHIN_8S,
  SAMPLE: LocalSourceErrorReason.NO_SAMPLE_WITHIN_8S,
});

const KEYS: Readonly<Record<DeliveryKind, readonly string[]>> = Object.freeze({ FRAME: ['frame'], SAMPLE: ['total_size', 'out_time_us'] });
/** A line longer than this is not a line of the report: it is dropped, never kept. */
const LINE_CAP = 256;

export interface DeliveryWatch {
  /** Hands over what the helper wrote to standard output, in order. */
  push(chunk: Buffer): void;
  /** True once a report line said that at least one frame / sample went out. */
  delivered(): boolean;
}

export function createDeliveryWatch(kind: DeliveryKind): DeliveryWatch {
  const keys = KEYS[kind];
  let carry = '';
  let seen = false;
  const read = (line: string): void => {
    const at = line.indexOf('=');
    if (at <= 0 || !keys.includes(line.slice(0, at))) return;
    const value = line.slice(at + 1).trim();
    if (/^[0-9]{1,18}$/.test(value) && Number(value) > 0) seen = true;
  };
  return {
    push(chunk) {
      if (seen) return;
      const lines = (carry + chunk.toString('latin1')).split('\n');
      carry = lines.pop() ?? '';
      if (carry.length > LINE_CAP) carry = '';
      for (const line of lines) if (line.length <= LINE_CAP) read(line);
    },
    delivered: () => seen,
  };
}

export interface CameraHelperLimits {
  /** How long a started helper must live before the open is reported as done. */
  readonly settleMs: number;
  /** Starts per open when the listener refuses the connection (HL-5). */
  readonly connectAttempts: number;
  readonly retryDelayMs: number;
  /** From the stop request to the forced end (HL-8). */
  readonly stopGraceMs: number;
  readonly listTimeoutMs: number;
  /** The bound of the short open of the pre-check (HL-12). */
  readonly precheckTimeoutMs: number;
  /** From the start of the helper to its first encoded frame; past it the helper is stopped (`NO_FRAME_WITHIN_8S`). */
  readonly firstFrameMs: number;
}

export const CAMERA_HELPER_LIMITS: CameraHelperLimits = Object.freeze({ settleMs: 1_500, connectAttempts: 2, retryDelayMs: 500, stopGraceMs: 3_000, listTimeoutMs: 5_000, precheckTimeoutMs: 5_000, firstFrameMs: FIRST_DELIVERY_MS });

/**
 * The named error of a helper that was stopped because it delivered nothing in time: the platform's
 * own word when it gave one (the pinned permission pattern), else `OPEN_FAILED` with the bound's reason.
 */
export function errorOfNoDelivery(exit: HelperExit, kind: 'FRAME' | 'SAMPLE', deviceId: string): LocalSourceError {
  if (diagnoseHelperOutput(exit.diagnostics) === 'PERMISSION') return new LocalSourceError(LocalSourceErrorCode.PERMISSION_DENIED, LocalSourceErrorReason.PATTERN, deviceId);
  return new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, NO_DELIVERY_REASON[kind], deviceId);
}

export interface CameraHelperOptions {
  /** The helper program: the absolute path of the configuration (`DEMS_CAPTURE_HELPER_FFMPEG`). Row 136 hands it over. */
  readonly program: string;
  /** The device name. Default: this Mac's camera. Held to the exact-name rule before every open. */
  readonly deviceName?: string;
  /**
   * `DEVICE` (the default): this Mac's camera. `GENERATED`: the generated test picture of the
   * development fake camera (spec §A.6.4 "Fake camera of slot 2"; row 136). A generated source has
   * no device: nothing is listed, nothing is opened, and no device name reaches an argument.
   */
  readonly source?: 'DEVICE' | 'GENERATED';
  readonly encoder?: CameraHelperEncoder;
  /** The server clock, in milliseconds: `S` of the helper. */
  readonly now: () => number;
  readonly timers: CaptureTimers;
  readonly limits?: Partial<CameraHelperLimits>;
  /** The process door. Default: the real one. A test passes one that starts nothing. */
  readonly door?: HelperDoor;
  readonly inspect?: ProgramInspector;
}

export interface OpenCameraHelper {
  readonly deviceId: string;
  readonly pid: number | null;
  /** True until the helper has ended. */
  alive(): boolean;
  /** Called once if the helper ends without `close` having been asked: the camera is lost. */
  onExit(listener: (error: LocalSourceError) => void): void;
  /** Stops the helper (`SIGTERM`, then `SIGKILL` after the grace) and resolves when it is gone. Safe to call twice. */
  close(): Promise<void>;
}

export interface CameraHelpers {
  /** The device list of this host. Opens no device, asks for no permission. */
  listDevices(): Promise<LocalDeviceList>;
  /** Null when exactly one listed entry equals the name; else the named error. Opens no device. */
  presence(deviceId: string): Promise<LocalSourceError | null>;
  /** Starts the helper toward `ingestUrl`. Rejects with a `LocalSourceError`. */
  open(deviceId: string, ingestUrl: string, signal: AbortSignal): Promise<OpenCameraHelper>;
  /** One short open of the device, nothing pushed (HL-12). Null when it worked. THE FIRST OPEN IS WHERE macOS ASKS. */
  precheck(deviceId: string, signal: AbortSignal): Promise<LocalSourceError | null>;
  /** How many helpers of this object live now. */
  liveCount(): number;
  /** Stops every live helper (the shutdown hook of the layer above). */
  closeAll(): Promise<void>;
}

/** Pinned patterns of the helper's diagnostics (H-18: not yet observed on a real refusal). */
const PERMISSION_PATTERN = /not authori[sz]ed|permission denied|access (?:is |was )?denied|operation not permitted/i;
const BUSY_PATTERN = /in use by another|device (?:is )?busy|resource busy/i;
const REFUSED_PATTERN = /connection refused/i;

type Diagnosis = 'PERMISSION' | 'BUSY' | 'REFUSED' | 'UNKNOWN';

export function diagnoseHelperOutput(diagnostics: string): Diagnosis {
  if (PERMISSION_PATTERN.test(diagnostics)) return 'PERMISSION';
  if (BUSY_PATTERN.test(diagnostics)) return 'BUSY';
  if (REFUSED_PATTERN.test(diagnostics)) return 'REFUSED';
  return 'UNKNOWN';
}

/** The named error of a helper that ended by itself. `started`: it had lived past the settle time. */
export function errorOfHelperExit(exit: HelperExit, started: boolean, deviceId: string): LocalSourceError {
  if (exit.spawnFailed) return new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.PROGRAM_REFUSED, deviceId);
  const diagnosis = diagnoseHelperOutput(exit.diagnostics);
  if (diagnosis === 'PERMISSION') return new LocalSourceError(LocalSourceErrorCode.PERMISSION_DENIED, LocalSourceErrorReason.PATTERN, deviceId);
  if (diagnosis === 'BUSY') return new LocalSourceError(LocalSourceErrorCode.DEVICE_BUSY, LocalSourceErrorReason.PATTERN, deviceId);
  if (diagnosis === 'REFUSED') return new LocalSourceError(LocalSourceErrorCode.HELPER_EXITED, LocalSourceErrorReason.INGEST_REFUSED, deviceId);
  return started
    ? new LocalSourceError(LocalSourceErrorCode.HELPER_EXITED, LocalSourceErrorReason.EXIT_IN_SESSION, deviceId)
    : new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.EXIT_AT_START, deviceId);
}

export function createCameraHelpers(options: CameraHelperOptions): CameraHelpers {
  const limits: CameraHelperLimits = { ...CAMERA_HELPER_LIMITS, ...options.limits };
  const door = options.door ?? startHelperProcess;
  const inspect = options.inspect ?? inspectProgram;
  const deviceName = options.deviceName ?? LOCAL_CAMERA_DEVICE_NAME;
  const generated = options.source === 'GENERATED';
  // The generated picture is encoded in software, the shape the worker's fixtures feed it with (spec §A.6.4).
  const encoder = options.encoder ?? (generated ? CameraHelperEncoder.X264 : CameraHelperEncoder.VIDEOTOOLBOX);
  const live = new Map<string, { process: HelperProcess; close(): Promise<void> }>();

  const pause = (delayMs: number): Promise<void> => new Promise((resolve) => options.timers.after(delayMs, resolve));

  /** The program may be started: null, or the error that says it may not. */
  const programError = (deviceId: string | null): LocalSourceError | null =>
    helperProgramRefusal(inspect(options.program)) === null ? null : new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.PROGRAM_REFUSED, deviceId);

  /** Runs a short call of the program to its end, or kills it at the bound. */
  async function runToEnd(args: readonly string[], timeoutMs: number, signal?: AbortSignal): Promise<{ exit: HelperExit; timedOut: boolean; aborted: boolean }> {
    const child = door({ command: options.program, args });
    let timedOut = false;
    let aborted = false;
    const cancel = options.timers.after(timeoutMs, () => {
      timedOut = true;
      child.kill('SIGKILL');
    });
    const onAbort = (): void => {
      aborted = true;
      child.kill('SIGKILL');
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const exit = await child.ended;
    cancel();
    signal?.removeEventListener('abort', onAbort);
    return { exit, timedOut, aborted };
  }

  async function readList(deviceId: string | null): Promise<LocalDeviceList> {
    const refused = programError(deviceId);
    if (refused !== null) throw refused;
    const { exit, timedOut } = await runToEnd(deviceListArguments(), limits.listTimeoutMs);
    if (exit.spawnFailed) throw new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.PROGRAM_REFUSED, deviceId);
    if (timedOut) throw new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.LIST_UNAVAILABLE, deviceId);
    // The list call always ends with an error code (it has no input to open): only its text counts.
    return parseDeviceList(exit.diagnostics);
  }

  /** Throws `DEVICE_NOT_FOUND` unless exactly one listed entry equals the name. Starts nothing but the list call. */
  async function requireDevice(deviceId: string): Promise<string> {
    if (generated) {
      // No device and no list: the program rule alone decides.
      const refused = programError(deviceId);
      if (refused !== null) throw refused;
      return '';
    }
    const selection = selectLocalDevice((await readList(deviceId)).video, deviceName);
    if (!selection.ok) throw new LocalSourceError(LocalSourceErrorCode.DEVICE_NOT_FOUND, LocalSourceErrorReason[selection.reason], deviceId);
    return selection.name;
  }

  return {
    listDevices: () => readList(null),

    async presence(deviceId) {
      try {
        await requireDevice(deviceId);
        return null;
      } catch (error) {
        if (error instanceof LocalSourceError) return error;
        throw error;
      }
    },

    async open(deviceId, ingestUrl, signal) {
      if (signal.aborted) throw new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.ABORTED, deviceId);
      if (!isLoopbackIngest(ingestUrl)) throw new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.TARGET_REFUSED, deviceId);
      if (live.has(deviceId)) throw new LocalSourceError(LocalSourceErrorCode.DEVICE_BUSY, LocalSourceErrorReason.ALREADY_OPEN, deviceId);

      for (let attempt = 1; ; attempt += 1) {
        const name = await requireDevice(deviceId);
        if (signal.aborted) throw new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.ABORTED, deviceId);
        const watch = createDeliveryWatch('FRAME');
        const child = door({
          command: options.program,
          args: cameraPushArguments(generated ? { source: 'GENERATED', encoder, ingestUrl, startMs: Math.floor(options.now()) } : { source: 'DEVICE', deviceName: name, encoder, ingestUrl, startMs: Math.floor(options.now()) }),
          onOutput: (chunk) => watch.push(chunk),
        });
        // The bound of the first frame runs from the start of the helper, not from the settle time.
        let starved = false;
        const cancelFirstFrame = options.timers.after(limits.firstFrameMs, () => {
          if (watch.delivered() || !child.alive()) return;
          starved = true;
          child.kill('SIGKILL');
        });
        void child.ended.then(() => cancelFirstFrame());

        // Whichever comes first: the helper ended, the settle time passed, the caller gave up.
        const first = await new Promise<'ENDED' | 'SETTLED' | 'ABORTED'>((resolve) => {
          const cancel = options.timers.after(limits.settleMs, () => resolve('SETTLED'));
          const onAbort = (): void => resolve('ABORTED');
          signal.addEventListener('abort', onAbort, { once: true });
          void child.ended.then(() => resolve('ENDED'));
          void child.ended.then(() => {
            cancel();
            signal.removeEventListener('abort', onAbort);
          });
        });

        if (first === 'ABORTED') {
          child.kill('SIGKILL');
          await child.ended;
          throw new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.ABORTED, deviceId);
        }
        if (first === 'ENDED') {
          const error = errorOfHelperExit(await child.ended, false, deviceId);
          if (error.reason === LocalSourceErrorReason.INGEST_REFUSED && attempt < limits.connectAttempts) {
            await pause(limits.retryDelayMs);
            continue;
          }
          throw error;
        }

        // It lives: the handle.
        let closing: Promise<void> | null = null;
        let lost: LocalSourceError | null = null;
        const listeners: Array<(error: LocalSourceError) => void> = [];
        void child.ended.then((exit) => {
          if (live.get(deviceId)?.process === child) live.delete(deviceId);
          if (closing !== null) return;
          lost = starved ? errorOfNoDelivery(exit, 'FRAME', deviceId) : errorOfHelperExit(exit, true, deviceId);
          for (const listener of listeners.splice(0)) listener(lost);
        });
        const close = (): Promise<void> => {
          closing ??= (async () => {
            if (!child.alive()) return;
            child.kill('SIGTERM');
            const cancel = options.timers.after(limits.stopGraceMs, () => child.kill('SIGKILL'));
            await child.ended;
            cancel();
          })();
          return closing;
        };
        live.set(deviceId, { process: child, close });
        return {
          deviceId,
          get pid() {
            return child.pid;
          },
          alive: () => child.alive(),
          onExit(listener) {
            if (lost !== null) listener(lost);
            else if (closing === null) listeners.push(listener);
          },
          close,
        };
      }
    },

    async precheck(deviceId, signal) {
      try {
        const name = await requireDevice(deviceId);
        // A generated source has nothing to open: its pre-check is the program rule, passed above.
        if (generated) return null;
        const { exit, timedOut, aborted } = await runToEnd(cameraPrecheckArguments(name), limits.precheckTimeoutMs, signal);
        if (aborted) return new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.ABORTED, deviceId);
        if (timedOut) return new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.PRECHECK_TIMEOUT, deviceId);
        if (!exit.spawnFailed && exit.exitCode === 0) return null;
        return errorOfHelperExit(exit, false, deviceId);
      } catch (error) {
        if (error instanceof LocalSourceError) return error;
        throw error;
      }
    },

    liveCount: () => live.size,

    async closeAll() {
      await Promise.all([...live.values()].map((entry) => entry.close()));
    },
  };
}
