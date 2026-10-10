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

/** The arguments every worker process of this Core is started with. `logPath`: where that process logs. */
export function captureWorkerArguments(logPath: string): string[] {
  return ['--log', logPath, '--heartbeat-ms', String(CAPTURE_IPC_DEFAULTS.heartbeatIntervalMs), ...captureWorkerSettingArguments(CAPTURE_WORKER_PROCESS_SETTINGS)];
}
