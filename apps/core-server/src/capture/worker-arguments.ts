/**
 * THE ARGUMENTS OF A CAPTURE WORKER PROCESS: ONE SET FOR EVERY START (wave H driver F; gate 64
 * condition C7, ruling D194; before it: capture spec §E.1, decisions D72(k), D84, D179).
 *
 * The Core starts the worker program in two places: the supervisor, once per session, and the boot
 * check, once for its `HELLO`. Until this file each built its own list, and the boot probe passed
 * only `--log` and `--heartbeat-ms`: a worker binary that does not know an argument the session
 * start passes (`--max-fragment-bytes`, added with worker 0.5.0) answered `HELLO` at boot and ended
 * with its usage text at the first session start. Now both lists come from `captureWorkerArguments`,
 * so a worker that does not accept an argument of a session start is refused AT BOOT.
 *
 * The two starts differ in ONE value, never in a name: where the worker logs (`logPath`). The boot
 * probe writes beside the session log, never into it.
 *
 * THE INGEST WINDOW OF PRODUCTION (task 4 row 47; design addendum section 3; security addendum
 * AD-11). A real camera needs longer than a local helper before its first keyframe is pushed
 * (reveal, `GetStreamUri`, the relay's start, the RTSP set-up), so the worker of the operation
 * `REAL_PRODUCTION` is started with a window of 30,000 ms. That figure is A CONSTANT OF THE
 * OPERATION, IN THIS FILE: the caller says whether that operation runs and nothing else; no environment
 * variable, no configuration key and no other operation changes it. Every other operation keeps
 * the protocol's default (15,000 ms), exactly as before. The names of the arguments are the same
 * in every operation, so the boot probe still refuses a worker that does not know one of them.
 *
 * WHAT IS NEVER IN THIS LIST: the ingest address of a camera. It carries the per-track random
 * element of the session (branch B, BR-07) and travels in the plan of `START`, on the worker's
 * standard input, and nowhere else. This file builds no address and takes none.
 *
 * This file names no process and no file of its own, and logs nothing: it builds a list of words.
 */
import { CAPTURE_IPC_DEFAULTS, CAPTURE_WORKER_SETTING_DEFAULTS, captureWorkerSettingArguments, type CaptureWorkerSettings } from '@dems/capture-protocol';
import { MIC_DISCONNECT_DEBOUNCE_MS, MIC_SILENCE_DBFS, MIC_SILENCE_DURATION_MS } from '@dems/shared/api';
import { VERIFY_MAX_OPEN_FRAGMENT_BYTES } from '@dems/shared/evidence-verify';

/**
 * THE NAMED SETTINGS OF THE WORKER PROCESS (protocol 4; decisions D72(k), D84; capture spec §E.1).
 * The launcher passes every one of them to every worker; a worker's own default is never relied on.
 * `ingestOpenWindowMs`: how long a camera may take to connect before a session with no camera
 * FAULTS with `NO_CAMERA_CONNECTED` and nothing claims to record. The three microphone thresholds
 * are the contract's constants (`@dems/shared/api`, CS-25).
 * `maxFragmentBytes` (fix pass F-M3, review R63-02; ruling D179): THE bound of one fragment, ONE
 * number - the one the seal enforces (`SEALING_MAX_FRAGMENT_BYTES`, which IS the verifier's
 * `VERIFY_MAX_OPEN_FRAGMENT_BYTES`; named here by the verifier's constant because the sealing unit
 * imports the capture unit). The worker makes no fragment durable above it, so a recording can no
 * longer be written whole and then fail at its seal. `protocol-pins.test.ts` holds the three equal.
 */
export const CAPTURE_WORKER_PROCESS_SETTINGS: CaptureWorkerSettings = Object.freeze({
  ingestOpenWindowMs: CAPTURE_WORKER_SETTING_DEFAULTS.ingestOpenWindowMs,
  micSilenceDbfs: MIC_SILENCE_DBFS,
  micSilenceDurationMs: MIC_SILENCE_DURATION_MS,
  micDisconnectDebounceMs: MIC_DISCONNECT_DEBOUNCE_MS,
  maxFragmentBytes: VERIFY_MAX_OPEN_FRAGMENT_BYTES,
});

/** The worker's own log of a session: one JSON object per line, beside the connection files of the data directory. */
export const WORKER_LOG_NAME = 'capture-worker.jsonl';
/** The log of a worker the boot check started: beside the worker's own log, never the same file. */
export const BOOT_PROBE_LOG_NAME = 'capture-worker-boot.jsonl';

/**
 * THE INGEST WINDOW OF `REAL_PRODUCTION`, in ms (design addendum section 3; AD-11): a constant of
 * the operation, written here and read from nowhere. Hypothesis HA-8 of the addendum (enough for a
 * real camera); the measured figure is the hardware package's (`9A/H-21`).
 */
export const PRODUCTION_INGEST_OPEN_WINDOW_MS = 30_000;

/** The named settings of the worker of `REAL_PRODUCTION`: the settings of every worker, with the window of that operation. */
export const CAPTURE_WORKER_PRODUCTION_SETTINGS: CaptureWorkerSettings = Object.freeze({
  ...CAPTURE_WORKER_PROCESS_SETTINGS,
  ingestOpenWindowMs: PRODUCTION_INGEST_OPEN_WINDOW_MS,
});

/**
 * The arguments every worker process of this Core is started with. `logPath`: where that process
 * logs. `production`: true exactly when the capture operation that runs is `REAL_PRODUCTION` (the
 * caller compares the operation; this file does not import the adapter layer, static rule A-5).
 * Only the value of the ingest window differs. A caller that says nothing gets the settings of
 * every other operation.
 */
export function captureWorkerArguments(logPath: string, production = false): string[] {
  const head = ['--log', logPath, '--heartbeat-ms', String(CAPTURE_IPC_DEFAULTS.heartbeatIntervalMs)];
  if (production === true) return [...head, ...captureWorkerSettingArguments(CAPTURE_WORKER_PRODUCTION_SETTINGS)];
  return [...head, ...captureWorkerSettingArguments(CAPTURE_WORKER_PROCESS_SETTINGS)];
}
