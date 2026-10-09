/**
 * The microphone helper (blueprint row 135; capture spec §A.7.1 ML-1..ML-8, §A.6.4 HL-2..HL-14,
 * §G.1 G-R12, G-R14; decisions D74, D76, D86 C-7).
 *
 * One FFmpeg child process per microphone writes 48 kHz mono float PCM into a named pipe that the
 * capture worker reads (`AudioStreamHandle.input`, kind `PCM_FIFO`). The worker is not changed: the
 * helper only produces the transport it already has. It shares the process door (`process-door.ts`),
 * the program path rule (`helper-program.ts`), the exact-name rule (`device-list.ts`), the five named
 * errors (`errors.ts`) and the classification of a helper's exit (`errorOfHelperExit` of
 * `camera-helper.ts`) with the camera helper: ONE door and ONE error mapping.
 *
 * LIFECYCLE
 *   prepare()  reads the device list, applies the exact-name rule, vouches for the program path and
 *              creates the pipe (`mic-pipe.ts`). It starts NO helper. This is what
 *              `AudioInputAdapter.open` does, because the plan needs the pipe path before the worker
 *              can open it.
 *   start()    launches the helper. Called when the worker has accepted the plan (ML-5): the helper
 *              opens its input first - the device, and with it the macOS permission question - and
 *              then waits at the pipe until the worker has it open for reading, so a microphone is
 *              not held open, and not buffering, longer than needed.
 *   close()    SIGTERM, then SIGKILL after the grace (a helper blocked at a pipe nobody reads ignores
 *              the first); removes the pipe. Safe to call twice and on every exit path. A helper
 *              never outlives its handle, and the door kills every child when the server exits.
 *
 * NAMED ERRORS (`LocalSourceError`; never text of the helper, a device name or a path):
 * `DEVICE_NOT_FOUND` is decided BEFORE any open, from the device list; `PERMISSION_DENIED` /
 * `DEVICE_BUSY` when the open failed and the output matches a pinned pattern (H-18: a HYPOTHESIS
 * until the user has chosen to deny once and the text is recorded); `OPEN_FAILED` when it failed and
 * nothing matches; `HELPER_EXITED` when it ended during the session. A local microphone that cannot
 * be used is NEVER replaced by a generated one: no code path of this folder builds a fake (G-R14).
 *
 * THE DEVICE IS OPENED BY `start()` AND `precheck()` ONLY, and only when a caller calls them. Listing
 * the devices opens none and asks for no permission.
 */
import { CaptureMicInputKind } from '@dems/capture-protocol';
import type { CaptureTimers } from '../../types';
import { MIC_TRANSPORTS } from '../mic-transport';
import type { AudioStreamHandle } from '../types';
import { deviceListArguments } from './camera-helper-args';
import { FIRST_DELIVERY_MS, createDeliveryWatch, errorOfHelperExit, errorOfNoDelivery } from './camera-helper';
import { parseDeviceList, selectLocalDevice } from './device-list';
import { LocalSourceError, LocalSourceErrorCode, LocalSourceErrorReason } from './errors';
import { helperProgramRefusal } from './helper-program';
import { micPrecheckArguments, micPushArguments, type MicSource } from './mic-helper-args';
import { preparePipe, removePipe, runBounded } from './mic-pipe';
import { createPipeFiles, type PipeFiles } from './pipe-files';
import { inspectProgram, startHelperProcess, type HelperDoor, type HelperProcess, type ProgramInspector } from './process-door';

export interface MicHelperLimits {
  /** SIGTERM, then SIGKILL after this long (HL-8). */
  readonly stopGraceMs: number;
  /** The device list call is bounded: one short call. */
  readonly listTimeoutMs: number;
  /** A helper that is still alive this long after it started has opened its input (ML-5). */
  readonly settleMs: number;
  /** The pre-check opens the device once for a fraction of a second; bounded (HL-12). */
  readonly precheckTimeoutMs: number;
  /**
   * From the start of the helper to its first written sample; past it the helper is stopped and the
   * microphone is reported lost with `NO_SAMPLE_WITHIN_8S` (pass C2, H-18). The helper waits at the pipe
   * until the worker reads it (ML-5), so `start()` is called when the worker is about to: a pipe nobody
   * opens within the bound is reported the same way, never waited for silently.
   */
  readonly firstSampleMs: number;
}

/** The same figures as the camera helper's. */
export const MIC_HELPER_LIMITS: MicHelperLimits = Object.freeze({ stopGraceMs: 3_000, listTimeoutMs: 5_000, settleMs: 1_500, precheckTimeoutMs: 5_000, firstSampleMs: FIRST_DELIVERY_MS });

export interface MicHelperOptions {
  /** The FFmpeg program: an absolute path (`DEMS_CAPTURE_HELPER_FFMPEG`, read by the boot step of row 136, never here). */
  readonly program: string;
  /** `<dataDir>/run/capture`: the directory the pipes of the sessions live under. */
  readonly runDir: string;
  readonly timers: CaptureTimers;
  readonly limits?: Partial<MicHelperLimits>;
  /** The process door. Default: the real one. A test passes one that starts nothing. */
  readonly door?: HelperDoor;
  readonly inspect?: ProgramInspector;
  readonly files?: PipeFiles;
  /** Default `/usr/bin/mkfifo`. */
  readonly mkfifoProgram?: string;
}

export interface MicPrepareRequest {
  /** The microphone's registry ID (`MIC-NN`). */
  readonly deviceId: string;
  readonly sessionId: string;
  readonly source: MicSource;
  readonly signal?: AbortSignal;
}

/** An opened microphone: the handle the plan builder takes `input` from, plus the start of the helper. */
export interface LocalMicStream extends AudioStreamHandle {
  /** Launches the helper. Resolves when it has stayed alive for the settle time; rejects with a `LocalSourceError`. Call `close()` after a failure. */
  start(signal?: AbortSignal): Promise<void>;
  /** True once `start` has launched the helper (also when it then failed). */
  started(): boolean;
  /** Calls the listener once if the helper ends during the session without a `close()`. Returns a function that removes it. */
  onLost(listener: (error: LocalSourceError) => void): () => void;
  /** The helper's process ID once started, for a socket snapshot (`lsof -nP -a -p <pid> -i`); null otherwise. Never logged. */
  helperPid(): number | null;
}

export interface MicHelper {
  /** The AUDIO entries of the device list. Opens no device and asks for no permission (ML-8). */
  listAudioDevices(): Promise<readonly string[]>;
  /** Null when exactly one listed AUDIO entry equals the name; else the named error. Opens no device. */
  presence(deviceId: string, deviceName: string): Promise<LocalSourceError | null>;
  /** Program path, device list, exact-name rule, pipe. Starts no helper. Rejects with a `LocalSourceError`. */
  prepare(request: MicPrepareRequest): Promise<LocalMicStream>;
  /** One short open of the device (HL-12). Null when it worked. THIS IS WHERE macOS ASKS FOR PERMISSION; the user answers. */
  precheck(deviceId: string, deviceName: string, signal?: AbortSignal): Promise<LocalSourceError | null>;
  /** The IDs of the microphones whose pipe is prepared or whose helper runs: the "is on" report (HL-14). */
  openIds(): readonly string[];
  /** The process IDs of the helpers that run now, so that the leftover check (`leftoverHelperPids`) does not count them. */
  livePids(): ReadonlySet<number>;
  /** Stops every helper and removes every pipe: the shutdown hook. */
  closeAll(): Promise<void>;
}

const failure = (code: LocalSourceErrorCode, reason: LocalSourceErrorReason, deviceId: string | null): LocalSourceError => new LocalSourceError(code, reason, deviceId);
const refused = (reason: LocalSourceErrorReason, deviceId: string | null): LocalSourceError => failure(LocalSourceErrorCode.OPEN_FAILED, reason, deviceId);
/** Read at the moment of the call: a signal can be aborted while an earlier step was awaited. */
const abortedNow = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

export function createMicHelper(options: MicHelperOptions): MicHelper {
  const limits: MicHelperLimits = { ...MIC_HELPER_LIMITS, ...options.limits };
  const door = options.door ?? startHelperProcess;
  const inspect = options.inspect ?? inspectProgram;
  const files = options.files ?? createPipeFiles();
  const timers = options.timers;
  /** The microphones whose pipe is prepared or whose helper runs. Claimed before the first await of `prepare`. */
  const held = new Map<string, LocalMicStream | null>();
  const processes = new Map<string, HelperProcess>();

  /** HL-2: the program path is vouched for before it is ever started. */
  function assertProgram(deviceId: string | null): void {
    if (helperProgramRefusal(inspect(options.program)) !== null) throw refused(LocalSourceErrorReason.PROGRAM_REFUSED, deviceId);
  }

  async function readAudioDevices(deviceId: string | null): Promise<readonly string[]> {
    assertProgram(deviceId);
    const run = await runBounded(door, timers, options.program, deviceListArguments(), limits.listTimeoutMs);
    if (run.exit.spawnFailed) throw refused(LocalSourceErrorReason.PROGRAM_REFUSED, deviceId);
    if (run.timedOut) throw refused(LocalSourceErrorReason.LIST_UNAVAILABLE, deviceId);
    // The list call always ends with an error status (it has no input to open): only its text counts.
    return parseDeviceList(run.exit.diagnostics).audio;
  }

  /** ML-1: throws `DEVICE_NOT_FOUND` unless exactly one listed AUDIO entry equals the name. Starts nothing but the list call. */
  async function requireDevice(deviceId: string, deviceName: string): Promise<void> {
    const selection = selectLocalDevice(await readAudioDevices(deviceId), deviceName);
    if (!selection.ok) throw failure(LocalSourceErrorCode.DEVICE_NOT_FOUND, LocalSourceErrorReason[selection.reason], deviceId);
  }

  async function prepare(request: MicPrepareRequest): Promise<LocalMicStream> {
    const { deviceId, sessionId, source } = request;
    if (request.signal?.aborted === true) throw refused(LocalSourceErrorReason.ABORTED, deviceId);
    if (held.has(deviceId)) throw failure(LocalSourceErrorCode.DEVICE_BUSY, LocalSourceErrorReason.ALREADY_OPEN, deviceId);
    held.set(deviceId, null);

    let path: string;
    try {
      if (source.kind === 'DEVICE') await requireDevice(deviceId, source.name);
      else assertProgram(deviceId);
      path = await preparePipe({ runDir: options.runDir, sessionId, deviceId, files, door, timers, inspector: inspect, ...(options.mkfifoProgram === undefined ? {} : { mkfifoProgram: options.mkfifoProgram }) });
    } catch (error) {
      held.delete(deviceId);
      throw error;
    }

    let helper: HelperProcess | null = null;
    let closing: Promise<void> | null = null;
    const listeners = new Set<(error: LocalSourceError) => void>();

    const stream: LocalMicStream = {
      deviceId,
      input: Object.freeze({ kind: CaptureMicInputKind.PCM_FIFO, path }),
      transport: MIC_TRANSPORTS.PCM_FIFO,

      started: () => helper !== null,
      helperPid: () => helper?.pid ?? null,
      onLost(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },

      async start(signal) {
        if (closing !== null || signal?.aborted === true) throw refused(LocalSourceErrorReason.ABORTED, deviceId);
        if (helper !== null) throw failure(LocalSourceErrorCode.DEVICE_BUSY, LocalSourceErrorReason.ALREADY_OPEN, deviceId);
        // The list is read again: time has passed since `prepare`, and every open follows a list (HL-10).
        if (source.kind === 'DEVICE') await requireDevice(deviceId, source.name);
        else assertProgram(deviceId);
        if (closing !== null || helper !== null || abortedNow(signal)) throw refused(LocalSourceErrorReason.ABORTED, deviceId);

        const watch = createDeliveryWatch('SAMPLE');
        const running = door({ command: options.program, args: micPushArguments({ source, pipePath: path }), env: {}, onOutput: (chunk) => watch.push(chunk) });
        helper = running;
        if (running.pid !== null) processes.set(deviceId, running);
        // The bound of the first sample runs from the start of the helper.
        let starved = false;
        const cancelFirstSample = timers.after(limits.firstSampleMs, () => {
          if (watch.delivered() || !running.alive()) return;
          starved = true;
          running.kill('SIGKILL');
        });
        void running.ended.then(() => cancelFirstSample());

        // Whichever comes first: the helper ended, the settle time passed, the caller gave up.
        const first = await new Promise<'ENDED' | 'SETTLED' | 'ABORTED'>((resolve) => {
          const cancel = timers.after(limits.settleMs, () => resolve('SETTLED'));
          const onAbort = (): void => resolve('ABORTED');
          signal?.addEventListener('abort', onAbort, { once: true });
          void running.ended.then(() => {
            cancel();
            signal?.removeEventListener('abort', onAbort);
            resolve('ENDED');
          });
        });

        if (first === 'ABORTED') {
          running.kill('SIGKILL');
          await running.ended;
          throw refused(LocalSourceErrorReason.ABORTED, deviceId);
        }
        if (first === 'ENDED') throw errorOfHelperExit(await running.ended, false, deviceId);

        // It lives: the input is open. From here an end that nobody asked for is a lost microphone (HL-9).
        void running.ended.then((exit) => {
          if (processes.get(deviceId) === running) processes.delete(deviceId);
          if (closing !== null) return;
          const lost = starved ? errorOfNoDelivery(exit, 'SAMPLE', deviceId) : errorOfHelperExit(exit, true, deviceId);
          for (const listener of listeners) listener(lost);
        });
      },

      close() {
        closing ??= (async () => {
          const running = helper;
          if (running !== null && running.alive()) {
            running.kill('SIGTERM');
            const cancel = timers.after(limits.stopGraceMs, () => running.kill('SIGKILL'));
            await running.ended;
            cancel();
          }
          processes.delete(deviceId);
          removePipe(files, path);
          held.delete(deviceId);
          listeners.clear();
        })();
        return closing;
      },
    };
    const frozen = Object.freeze(stream);
    held.set(deviceId, frozen);
    return frozen;
  }

  return {
    listAudioDevices: () => readAudioDevices(null),

    async presence(deviceId, deviceName) {
      try {
        await requireDevice(deviceId, deviceName);
        return null;
      } catch (error) {
        if (error instanceof LocalSourceError) return error;
        throw error;
      }
    },

    prepare,

    async precheck(deviceId, deviceName, signal) {
      try {
        if (signal?.aborted === true) return refused(LocalSourceErrorReason.ABORTED, deviceId);
        await requireDevice(deviceId, deviceName);
        const run = await runBounded(door, timers, options.program, micPrecheckArguments(deviceName), limits.precheckTimeoutMs, signal);
        if (run.aborted) return refused(LocalSourceErrorReason.ABORTED, deviceId);
        if (run.timedOut) return refused(LocalSourceErrorReason.PRECHECK_TIMEOUT, deviceId);
        if (!run.exit.spawnFailed && run.exit.exitCode === 0) return null;
        return errorOfHelperExit(run.exit, false, deviceId);
      } catch (error) {
        if (error instanceof LocalSourceError) return error;
        throw error;
      }
    },

    openIds: () => [...held.keys()].sort(),

    livePids: () => new Set([...processes.values()].map((running) => running.pid).filter((pid): pid is number => pid !== null)),

    async closeAll() {
      await Promise.all([...held.values()].map((stream) => stream?.close()));
    },
  };
}
