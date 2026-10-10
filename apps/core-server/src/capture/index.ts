/**
 * Capture module (blueprint row 57 / M3-W1; register NM-03, CS-01, CS-03; capture spec §A.3, §B.1,
 * §B.2, §G, §I).
 *
 * WHAT THIS UNIT OWNS.
 *   - the `capture` SEAM (`app.capture`, a `CaptureSupervisor`): the one door between the Core
 *     server and the capture worker process. The sessions and devices modules reach capture
 *     through it; a test replaces it with `app.seams.replace('capture', fake)`;
 *   - the SUPERVISOR behind it (`supervisor.ts`): one worker process per session, heartbeat,
 *     restart with back-off, correlation IDs, back-pressure;
 *   - the PROCESS CHANNEL (`ipc.ts`): the only file of the server runtime that starts a process;
 *   - the persistence of what goes wrong: a worker that went down and a `CAPTURE_FAULT` are
 *     written to the log and to the persistent error log, with the session and correlation IDs.
 *
 * THE WORKER COMMAND (blueprint row 58; spec §I edits 7 to 10). In capture mode `real` with a
 * worker program configured (`config.captureWorkerPath`), the supervisor starts that program, one
 * process per session, with fixed arguments (where it logs, how often it beats) and an empty
 * environment. In every other case (mode `simulated`, the default; or `real` without a program)
 * the server is built with `unconfiguredLauncher`: every `start` fails at once and cleanly with
 * `CAPTURE_FAULT`, and no process is ever started. Whether a boot in `real` mode without a worker
 * is refused is the boot checks' decision (CS-22), not this unit's.
 *
 * THE ENGINE (row 58; register SH-18 / CS-04, telemetry part). `forwarder.ts` hands the
 * supervisor's telemetry and warnings to the engine's INTERNAL actions `applyCaptureTelemetry`
 * and `raiseCaptureWarning`, without ever holding the supervisor's queue.
 *
 * WHAT IT DOES NOT DO (stated so nobody reads more into it than is there; brought up to date by
 * fix pass F-M3, review R63-17).
 *   - Sealing progress and seal completion reach no engine action from here: the sealing units own
 *     them. The lossless records (`record` events) are handed to whoever subscribes; the
 *     capture-session unit (`src/capture-session`) persists them through the recorder of
 *     `modules/recording-fragments`. This file only LOGS one of them: the sync level of a camera file.
 *   - It builds no capture plan: the capture-session unit does, when it starts a real recording.
 *   - It registers no route.
 *
 * The plugin function starts no process and opens no connection: `buildApp()` works without a
 * worker and without PostgreSQL. The entry point boots the supervisor after the boot steps and
 * shuts it down before the app closes; the close hook below does the same for an app that is
 * closed without the entry point (every test).
 */
import type { FastifyPluginAsync } from 'fastify';
import { captureDoorsOf } from '../engine';
import { describeError } from '../plugins/logger';
import { CAPTURE_IPC_DEFAULTS, CAPTURE_WORKER_SETTING_DEFAULTS, CaptureRecordKind, CaptureSyncLevel, captureWorkerSettingArguments, type CaptureWorkerSettings } from '@dems/capture-protocol';
import { MIC_DISCONNECT_DEBOUNCE_MS, MIC_SILENCE_DBFS, MIC_SILENCE_DURATION_MS } from '@dems/shared/api';
import { VERIFY_MAX_OPEN_FRAGMENT_BYTES } from '@dems/shared/evidence-verify';
import { CaptureOperation } from './adapters';
import { mountCaptureBootChecks } from './boot';
import { captureOperationOf, mountCaptureFence } from './fence';
import { forwardCaptureEvents } from './forwarder';
import { createProcessLauncher, unconfiguredLauncher } from './ipc';
import { createCaptureSupervisor } from './supervisor';
import { createSystemTimers } from './timers';
import type { CaptureReport, CaptureSupervisor } from './types';

export { CAPTURE_MIC_RATE_LIMIT_PPM, CAPTURE_WARNING_CLEAR_HOLD_MS, CaptureNoticeCode, ForwarderReportCode, SUPERVISOR_REFUSAL_REASONS, forwardCaptureEvents, type CaptureEngine, type CaptureForwarderOptions, type CaptureNotice } from './forwarder';
export { createProcessLauncher, unconfiguredLauncher, type ProcessLauncherOptions } from './ipc';
export { MAX_SESSION_ID_CHARS, OUTPUT_EXISTS, createCaptureSupervisor } from './supervisor';
export { createSystemTimers } from './timers';
// The evidence signer (row 83): reached through this index like the rest of the closed unit.
export * from './signer';
// The camera file read again (row 59): box walk, fragment chain, tail validation of RECOVERY.
export * from './fragments';
export {
  CapturePhase,
  CaptureRefusal,
  CaptureSupervisorError,
  WorkerDownCode,
  WorkerLaunchError,
  type CaptureEvent,
  type CaptureEventName,
  type CaptureEventOf,
  type CaptureListener,
  type CaptureReport,
  type CaptureStatus,
  type CaptureStopOutcome,
  type CaptureSupervisor,
  type CaptureSupervisorOptions,
  type CaptureTimers,
  type WorkerChannel,
  type WorkerChannelHandlers,
  type WorkerDown,
  type WorkerExit,
  type WorkerLaunch,
  type WorkerLauncher,
} from './types';

const WORKER_DOWN = 'the capture worker went down';
const FAULT = 'capture fault: the capture worker cannot be kept running';
const FAILED = 'the capture supervisor could not finish a step';
const BOOTED = 'capture supervisor booted';
const STOPPED = 'capture supervisor stopped';
const RECOVERED = 'the capture supervisor finished a step that had failed';

/** The worker's own log: one JSON object per line, beside the connection files of the data directory. */
const WORKER_LOG_NAME = 'capture-worker.jsonl';
const NOTICE = 'capture notice';
const STALE_FAULTS_CLEARED = 'capture faults of an earlier run cleared at boot';
const STALE_FAULTS_NOT_CLEARED = 'the capture faults of an earlier run could not be cleared at boot';
const SYNC_LEVEL = 'the first fragment of a camera file is durable: the sync level the worker achieved';
const SYNC_LEVEL_NOT_FULL = 'a camera file is NOT synced through the drive cache: the evidence volume does not take the full sync';

/**
 * THE NAMED SETTINGS OF THE WORKER PROCESS (protocol 4; decisions D72(k), D84; capture spec §E.1).
 * The launcher passes every one of them to every worker; a worker's own default is never relied on.
 * `ingestOpenWindowMs`: how long a camera may take to connect before a session with no camera
 * FAULTS with `NO_CAMERA_CONNECTED` and nothing claims to record. The three microphone thresholds
 * are the contract's constants (`@dems/shared/api`, CS-25).
 * `maxFragmentBytes` (fix pass F-M3, review R63-02; ruling D179): THE bound of one fragment, ONE
 * number - the one the seal enforces (`SEALING_MAX_FRAGMENT_BYTES`, which IS the verifier's
 * `VERIFY_MAX_OPEN_FRAGMENT_BYTES`; named here by the verifier's constant because the sealing unit
 * imports this one). The worker makes no fragment durable above it, so a recording can no longer
 * be written whole and then fail at its seal. `protocol-pins.test.ts` holds the three equal.
 */
export const CAPTURE_WORKER_PROCESS_SETTINGS: CaptureWorkerSettings = Object.freeze({
  ingestOpenWindowMs: CAPTURE_WORKER_SETTING_DEFAULTS.ingestOpenWindowMs,
  micSilenceDbfs: MIC_SILENCE_DBFS,
  micSilenceDurationMs: MIC_SILENCE_DURATION_MS,
  micDisconnectDebounceMs: MIC_DISCONNECT_DEBOUNCE_MS,
  maxFragmentBytes: VERIFY_MAX_OPEN_FRAGMENT_BYTES,
});

export const captureModule: FastifyPluginAsync = async (app) => {
  const { captureMode, captureWorkerPath, dataDir } = app.config;
  // The ONE reader of the capture mode (static rule G-R16): a refused combination answers SIMULATED.
  const realOperation = captureOperationOf(app.config) !== CaptureOperation.SIMULATED;
  const configured = realOperation && captureWorkerPath !== null;
  const report = (failure: CaptureReport): void => {
    const context = { sessionId: failure.sessionId, correlationId: failure.correlationId };
    if (failure.err === null) {
      // Something that had failed works again: said once, so the error log shows the end of the episode.
      app.log.info({ code: failure.code, ...context }, RECOVERED);
      // The persistent error log has no level below `warn`: the end of an episode is written at that level.
      app.errorLog.append({ level: 'warn', source: failure.source, message: RECOVERED, code: failure.code, context });
      return;
    }
    app.log.error({ err: failure.err, code: failure.code, ...context }, FAILED);
    app.errorLog.append({ level: 'error', source: failure.source, message: FAILED, ...describeError(failure.err), code: failure.code, context });
  };
  const supervisor = createCaptureSupervisor({
    // Read at every call: the clock is a seam, and a test replaces it after `ready()`.
    now: () => app.clock.now(),
    timers: createSystemTimers(),
    launcher: configured
      ? createProcessLauncher({ command: captureWorkerPath, args: ['--log', `${dataDir}/${WORKER_LOG_NAME}`, '--heartbeat-ms', String(CAPTURE_IPC_DEFAULTS.heartbeatIntervalMs), ...captureWorkerSettingArguments(CAPTURE_WORKER_PROCESS_SETTINGS)] })
      : unconfiguredLauncher,
    report,
  });
  // The telemetry and the warnings of a recording go to the engine (SH-18 / CS-04, telemetry part).
  const stopForwarding = forwardCaptureEvents({
    capture: supervisor,
    // The engine behind the seam, with the capture door of the host beside it (D84 R-4).
    engine: () => {
      if (!app.seams.has('engine')) return null;
      const host = app.engine;
      return {
        applyCaptureTelemetry: (telemetry) => host.applyCaptureTelemetry(telemetry),
        raiseCaptureWarning: (warning) => host.raiseCaptureWarning(warning),
        clearCaptureWarning: (warning) => host.clearCaptureWarning(warning),
        clearCaptureFaults: () => captureDoorsOf(host).clearCaptureFaults(),
      };
    },
    report,
    now: () => app.clock.now(),
    // Something the operator should know that is no failure (a long keyframe interval, D127; a camera
    // clock near the bound, D58-7; a microphone at its rate limit, D85): level `warn`, in the log and in the error log.
    notice(entry) {
      const context = { sessionId: entry.sessionId, correlationId: entry.correlationId, deviceId: entry.deviceId, value: entry.value, bound: entry.bound };
      app.log.warn({ code: entry.code, ...context }, NOTICE);
      app.errorLog.append({ level: 'warn', source: 'capture.forwarder', message: NOTICE, code: entry.code, context });
    },
  });

  supervisor.on('workerDown', (event) => {
    const context = {
      sessionId: event.sessionId,
      correlationId: event.correlationId,
      attempt: event.down.attempt,
      downCode: event.down.code,
      downDetail: event.down.detail,
      exitCode: event.down.exitCode,
      signal: event.down.signal,
      restartInMs: event.restartInMs,
    };
    app.log.warn({ code: 'CAPTURE_WORKER_DOWN', ...context }, WORKER_DOWN);
    app.errorLog.append({ level: 'warn', source: 'capture.supervisor', message: WORKER_DOWN, code: 'CAPTURE_WORKER_DOWN', context });
  });

  // HOW A CAMERA FILE IS REALLY MADE DURABLE (fix pass F-M3, review R63-09; ruling D179). The worker
  // states, with the first durable fragment of each camera file, the sync level it ACHIEVED - never
  // the one its build would like. Written to the log for every file; a file that is not synced
  // through the drive cache (`FSYNC`), or a worker that does not say, also goes to the persistent
  // error log: after a power loss such a file may miss what its checkpoints claimed.
  supervisor.on('record', (event) => {
    if (event.record.kind !== CaptureRecordKind.FIRST_DURABLE_FRAGMENT) return;
    const syncLevel = event.record.syncLevel ?? 'NOT_STATED';
    const context = { sessionId: event.sessionId, correlationId: event.correlationId, deviceId: event.record.deviceId, syncLevel };
    if (syncLevel === CaptureSyncLevel.FULL) {
      app.log.info({ code: 'CAPTURE_SYNC_LEVEL', ...context }, SYNC_LEVEL);
      return;
    }
    app.log.warn({ code: 'CAPTURE_SYNC_LEVEL_NOT_FULL', ...context }, SYNC_LEVEL_NOT_FULL);
    app.errorLog.append({ level: 'warn', source: 'capture.supervisor', message: SYNC_LEVEL_NOT_FULL, code: 'CAPTURE_SYNC_LEVEL_NOT_FULL', context });
  });

  supervisor.on('warning', (event) => {
    if (event.source !== 'supervisor') return;
    const context = { sessionId: event.sessionId, correlationId: event.correlationId };
    app.log.error({ code: event.code, ...context }, FAULT);
    app.errorLog.append({ level: 'error', source: 'capture.supervisor', message: FAULT, code: event.code, context });
  });

  // The seam is the supervisor with its two lifecycle calls written to the log: the lines by which
  // an operator sees that the entry point booted it after the boot steps and stopped it at shutdown.
  let booted = false;
  const seam: CaptureSupervisor = {
    ...supervisor,
    async boot() {
      await supervisor.boot();
      if (booted) return;
      booted = true;
      // D84 R-4: no worker runs at boot, so a capture fault a Core that went down left raised is
      // over. Cleared once, by the capture side, each with its FAULT_CLEARED row. Mode `real`
      // only: a simulated Core raises these faults through its demo controls and keeps them.
      if (realOperation && app.seams.has('engine') && app.engine.running) {
        try {
          const cleared = (await captureDoorsOf(app.engine).clearCaptureFaults()).value;
          if (cleared > 0) app.log.info({ code: 'CAPTURE_STALE_FAULTS_CLEARED', cleared }, STALE_FAULTS_CLEARED);
        } catch (err) {
          app.log.error({ err, code: 'CAPTURE_STALE_FAULTS_NOT_CLEARED' }, STALE_FAULTS_NOT_CLEARED);
          app.errorLog.append({ level: 'error', source: 'capture.supervisor', message: STALE_FAULTS_NOT_CLEARED, ...describeError(err), code: 'CAPTURE_STALE_FAULTS_NOT_CLEARED', context: {} });
        }
      }
      app.log.info({ code: 'CAPTURE_SUPERVISOR_BOOTED', mode: captureMode, worker: configured ? 'configured' : 'not-configured' }, BOOTED);
    },
    async shutdown() {
      await supervisor.shutdown();
      if (!booted) return;
      booted = false;
      app.log.info({ code: 'CAPTURE_SUPERVISOR_STOPPED' }, STOPPED);
    },
  };
  app.seams.provide('capture', seam);

  // The capture fence (blueprint row 136; capture spec §A.1.2): the boot step that refuses an
  // unsafe combination of capture mode, demo controls, development flag and stored sources, and
  // the device registry of the running capture operation. Its lines are written here: this is
  // the one file of the folder that logs.
  mountCaptureFence(app, {
    timers: createSystemTimers(),
    sinks: {
      info: (fields, message) => app.log.info(fields, message),
      warn: (fields, message) => app.log.warn(fields, message),
      error: (fields, message) => app.log.error(fields, message),
      persist: (entry) => app.errorLog.append(entry),
    },
    // A device row the boot registered is read by the engine at its next start: started again here, once.
    async reloadState() {
      if (!app.seams.has('engine')) return;
      await app.engine.stop();
      await app.engine.start('resync');
    },
  });

  // The CS-22 boot checks (blueprint row 61; controller ruling D138): boot step `capture.boot`, after
  // `capture.fence`. Inert in SIMULATED (no file, no process).
  mountCaptureBootChecks(app, {
    timers: createSystemTimers(),
    sinks: {
      info: (fields, message) => app.log.info(fields, message),
      warn: (fields, message) => app.log.warn(fields, message),
      error: (fields, message) => app.log.error(fields, message),
      persist: (entry) => app.errorLog.append(entry),
    },
  });

  app.addHook('onClose', async () => {
    await seam.shutdown();
    stopForwarding();
  });
};
