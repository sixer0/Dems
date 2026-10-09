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
 * WHAT IT DOES NOT DO YET (stated so nobody reads more into it than is there).
 *   - Sealing progress and seal completion reach no engine action: `applySealingProgress` and
 *     `completeSeal` are the sealing row's. The lossless records (`record` events) are handed to
 *     whoever subscribes; no unit persists them yet (the fMP4 writer row does).
 *   - It builds no capture plan: the sessions module does, when it starts a real recording.
 *   - It registers no route.
 *
 * The plugin function starts no process and opens no connection: `buildApp()` works without a
 * worker and without PostgreSQL. The entry point boots the supervisor after the boot steps and
 * shuts it down before the app closes; the close hook below does the same for an app that is
 * closed without the entry point (every test).
 */
import type { FastifyPluginAsync } from 'fastify';
import { describeError } from '../plugins/logger';
import { CAPTURE_IPC_DEFAULTS } from '@dems/capture-protocol';
import { mountCaptureFence } from './fence';
import { forwardCaptureEvents } from './forwarder';
import { createProcessLauncher, unconfiguredLauncher } from './ipc';
import { createCaptureSupervisor } from './supervisor';
import { createSystemTimers } from './timers';
import type { CaptureReport, CaptureSupervisor } from './types';

export { CAPTURE_WARNING_CLEAR_HOLD_MS, ForwarderReportCode, forwardCaptureEvents, type CaptureEngine, type CaptureForwarderOptions } from './forwarder';
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

export const captureModule: FastifyPluginAsync = async (app) => {
  const { captureMode, captureWorkerPath, dataDir } = app.config;
  const configured = captureMode === 'real' && captureWorkerPath !== null;
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
      ? createProcessLauncher({ command: captureWorkerPath, args: ['--log', `${dataDir}/${WORKER_LOG_NAME}`, '--heartbeat-ms', String(CAPTURE_IPC_DEFAULTS.heartbeatIntervalMs)] })
      : unconfiguredLauncher,
    report,
  });
  // The telemetry and the warnings of a recording go to the engine (SH-18 / CS-04, telemetry part).
  const stopForwarding = forwardCaptureEvents({ capture: supervisor, engine: () => (app.seams.has('engine') ? app.engine : null), report, now: () => app.clock.now() });

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

  app.addHook('onClose', async () => {
    await seam.shutdown();
    stopForwarding();
  });
};
