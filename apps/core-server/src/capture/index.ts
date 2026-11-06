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
 *     written to the log and to the persistent error log, with the session and correlation IDs;
 *   - the BOOT CLEAR of what a Core that went down left raised (decision D84 R-4: the capture
 *     faults; wave H driver F: the notices of a running capture, `stale-notices.ts`).
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
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { captureDoorsOf } from '../engine';
import { describeError } from '../plugins/logger';
import { CaptureRecordKind, CaptureSyncLevel, CaptureWarningState } from '@dems/capture-protocol';
import { CaptureOperation } from './adapters';
import { mountCaptureBootChecks } from './boot';
import { captureOperationOf, mountCaptureFence } from './fence';
import { forwardCaptureEvents } from './forwarder';
import { createProcessLauncher, unconfiguredLauncher } from './ipc';
import { staleCaptureNoticesOf } from './stale-notices';
import { createCaptureSupervisor } from './supervisor';
import { createSystemTimers } from './timers';
import type { CaptureReport, CaptureSupervisor } from './types';
import { WORKER_LOG_NAME, captureWorkerArguments } from './worker-arguments';

export { CAPTURE_MIC_RATE_LIMIT_PPM, CAPTURE_WARNING_CLEAR_HOLD_MS, CaptureNoticeCode, ForwarderReportCode, SUPERVISOR_REFUSAL_REASONS, forwardCaptureEvents, type CaptureEngine, type CaptureForwarderOptions, type CaptureNotice } from './forwarder';
// The ONE version of the worker this Core drives (gate 64 C7): the boot and every HELLO hold a worker to it.
export { CAPTURE_WORKER_VERSION } from './boot';
// The door of the host facts and their maker (task 4 row 85, decision C46): the entry point hands the facts of its own
// process to the boot checks through these two names. The two mount calls below keep their members (AD-08 (2)).
export { captureBootControl, captureHostOfProcess } from './boot';
// Task 4 row 106c (decision C82, named amendment SR-11): the entry point makes ONE more runner of the host's questions
// with the maker its host facts are made with, and hands it to the composition for the single purpose of reading the
// address helper's interface file by the FIXED row below. One export line: nothing is built here, the row itself stays
// in `boot/program-checks.ts`, and the door behind the runner does not leave the unit.
export { INTERFACE_FILE_COMMAND, captureHostRunnerOf, type HostCommandRunner } from './boot';
// Audit 2026-11-05 row 101 (DF-24, decision D23 (1)): the read-only source of the camera interface's carrier. A caller
// gets readings of ONE interface (named by the interface form), not the means to read a file; row 102 wires the sweep to it.
export { CameraLinkState, createCameraLinkSource, type CameraLinkReading, type CameraLinkSource } from './boot';
// Audit 2026-11-05 row 102: the stored camera interface (the boot's own one-row read) for the sweep's link watch. Read only.
export { storedCameraInterface } from './boot';
export { createProcessLauncher, unconfiguredLauncher, type ProcessLauncherOptions } from './ipc';
export { MAX_SESSION_ID_CHARS, OUTPUT_EXISTS, captureDownReasonOf, createCaptureSupervisor, restatePairedMics } from './supervisor'; // restatePairedMics: row W3I (the capture-session unit reads it through this index)
// The arguments of a worker process: one set for a session start and for the boot probe (wave H driver F; gate 64 C7).
export { CAPTURE_WORKER_PROCESS_SETTINGS, CAPTURE_WORKER_PRODUCTION_SETTINGS, PRODUCTION_INGEST_OPEN_WINDOW_MS, captureWorkerArguments } from './worker-arguments';
// Where a camera track pushes to (task 4 row 47; integration pass I-3): one function, in a file that imports nothing.
export * from './ingest-address';
export { createSystemTimers } from './timers';
// The evidence signer (row 83): reached through this index like the rest of the closed unit.
export * from './signer';
// The camera file read again (row 59): box walk, fragment chain, tail validation of RECOVERY.
export * from './fragments';
export {
  CAMERA_ABSENT_REASONS,
  CAMERA_END_REASONS,
  CAMERA_INTEGRITY_REASONS,
  isCameraAbsentReason,
  isCameraIntegrityReason,
  CaptureDownReason,
  CapturePhase,
  CaptureRefusal,
  CaptureSupervisorError,
  SupervisorRefusal,
  WorkerDownCode,
  WorkerLaunchError,
  type CaptureCameraEnd,
  type CaptureCameraEndReason,
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
const FAULT_OVER = 'the capture fault the supervisor held for an earlier session is over: a session records';
const FAILED = 'the capture supervisor could not finish a step';
const BOOTED = 'capture supervisor booted';
const STOPPED = 'capture supervisor stopped';
const RECOVERED = 'the capture supervisor finished a step that had failed';

const NOTICE = 'capture notice';
const STALE_FAULTS_CLEARED = 'capture faults of an earlier run cleared at boot';
const STALE_FAULTS_NOT_CLEARED = 'the capture faults of an earlier run could not be cleared at boot';
const STALE_NOTICES_CLEARED = 'capture notices of an earlier run resolved at boot: no capture is running, so their conditions are not being observed';
const STALE_NOTICES_NOT_CLEARED = 'a capture notice of an earlier run could not be resolved at boot';
const SYNC_LEVEL = 'the first fragment of a camera file is durable: the sync level the worker achieved';
const SYNC_LEVEL_NOT_FULL = 'a camera file is NOT synced through the drive cache: the evidence volume does not take the full sync';

/**
 * THE LINES OF THE SUPERVISOR'S OWN `CAPTURE_FAULT` (wave H driver F; fix wave M, re-check 75
 * finding G75e-03). The supervisor says its fault twice in the life of a failed session: ACTIVE
 * when the worker is down for good, and CLEARED when a LATER session reaches RECORDING (D84 R-3:
 * "a session records again: the fault of an earlier one is over"). Only the first is a fault.
 *
 *   ACTIVE    one error line and one entry of the persistent error log, with WHY (one code of the
 *             closed enumeration);
 *   CLEARED   one info line that names the earlier session as `faultOfSessionId` - never an error,
 *             never an entry of the error log, and no `sessionId` member: nothing failed, and the
 *             line is not a line of the session that records now.
 *
 * Before fix wave M the listener did not read `state`: the CLEARED event of a sealed, worker-killed
 * session was written as an error-level "capture fault" with `reason: null` a moment after the
 * healthy start of the next session. Exported for the test of this file (`module.test.ts`).
 */
export function writeSupervisorFaults(app: Pick<FastifyInstance, 'log' | 'errorLog'>, supervisor: Pick<CaptureSupervisor, 'on'>): () => void {
  return supervisor.on('warning', (event) => {
    if (event.source !== 'supervisor') return;
    if (event.state === CaptureWarningState.CLEARED) {
      app.log.info({ code: 'CAPTURE_SUPERVISOR_FAULT_OVER', faultOfSessionId: event.sessionId, faultOfCorrelationId: event.correlationId }, FAULT_OVER);
      return;
    }
    // WHY the worker is down for good, in the error log as well (wave H driver F): one code of the closed enumeration.
    const context = { sessionId: event.sessionId, correlationId: event.correlationId, reason: event.cause ?? null };
    app.log.error({ code: event.code, ...context }, FAULT);
    app.errorLog.append({ level: 'error', source: 'capture.supervisor', message: FAULT, code: event.code, context });
  });
}

export const captureModule: FastifyPluginAsync = async (app) => {
  const { captureMode, captureWorkerPath, dataDir } = app.config;
  // The ONE reader of the capture mode (static rule G-R16): a refused combination answers SIMULATED.
  const operation = captureOperationOf(app.config);
  const realOperation = operation !== CaptureOperation.SIMULATED;
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
      ? // AD-11 (task 4 row 47): the worker of REAL_PRODUCTION is started with that operation's ingest window; every other operation keeps today's.
        createProcessLauncher({ command: captureWorkerPath, args: captureWorkerArguments(`${dataDir}/${WORKER_LOG_NAME}`, operation === CaptureOperation.REAL_PRODUCTION) })
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
      downReason: event.down.reason ?? null,
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

  writeSupervisorFaults(app, supervisor);

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
        // THE SAME FOR THE NOTICES OF A RUNNING CAPTURE (wave H driver F; gate 64 C4, F-Y decision 8): the advice about a
        // camera or a microphone and the volume-durability notice are resolved from memory by the unit that raised them, so a
        // Core that died left them active - one of them can be CRITICAL - and a later raise for the same target wrote nothing.
        // No capture runs now: each is resolved, here, before a client connects (`stale-notices.ts` says which and why not the
        // no-device notices). A condition that is still true is said again by the first reading of the next recording. What
        // was done is written to the log AND to the persistent error log (the notices' own rule writes no audit row for a
        // clear): codes and a count only.
        try {
          const stale = staleCaptureNoticesOf(app.engine.state().alerts);
          const resolved: string[] = [];
          for (const notice of stale) {
            try {
              await app.engine.clearCaptureWarning(notice);
              resolved.push(notice.code);
            } catch (err) {
              const context = { reason: notice.code, deviceId: notice.subject };
              app.log.error({ err, code: 'CAPTURE_STALE_NOTICE_NOT_CLEARED', ...context }, STALE_NOTICES_NOT_CLEARED);
              app.errorLog.append({ level: 'error', source: 'capture.supervisor', message: STALE_NOTICES_NOT_CLEARED, ...describeError(err), code: 'CAPTURE_STALE_NOTICE_NOT_CLEARED', context });
            }
          }
          if (resolved.length > 0) {
            const context = { cleared: resolved.length, reasons: [...new Set(resolved)].sort().join(',') };
            app.log.info({ code: 'CAPTURE_STALE_NOTICES_CLEARED', ...context }, STALE_NOTICES_CLEARED);
            // The persistent error log has no level below `warn`: the end of an episode is written at that level.
            app.errorLog.append({ level: 'warn', source: 'capture.supervisor', message: STALE_NOTICES_CLEARED, code: 'CAPTURE_STALE_NOTICES_CLEARED', context });
          }
        } catch (err) {
          // The state could not be read: nothing is resolved from a guess, and the boot goes on.
          app.log.error({ err, code: 'CAPTURE_STALE_NOTICE_NOT_CLEARED' }, STALE_NOTICES_NOT_CLEARED);
          app.errorLog.append({ level: 'error', source: 'capture.supervisor', message: STALE_NOTICES_NOT_CLEARED, ...describeError(err), code: 'CAPTURE_STALE_NOTICE_NOT_CLEARED', context: {} });
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
