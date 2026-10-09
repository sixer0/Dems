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
 * WHAT IT DOES NOT DO YET (stated so nobody reads more into it than is there).
 *   - It has NO WORKER COMMAND: the capture configuration keys are the next row's (spec §I edits
 *     7 to 10), so the server is built with `unconfiguredLauncher` and every `start` on it fails
 *     at once with `CAPTURE_FAULT`. The supervisor itself is complete and is exercised with a
 *     launcher by its tests.
 *   - It calls NO ENGINE ACTION. The supervisor's events name the INTERNAL action each is meant
 *     for (`applyCaptureTelemetry`, `applySealingProgress`, `raiseCaptureWarning`; spec §B.1), but
 *     the shared simulator and the engine host do not have those actions yet: the unit that adds
 *     them subscribes here with `app.capture.on(...)`.
 *   - It registers no route.
 *
 * The plugin function starts no process and opens no connection: `buildApp()` works without a
 * worker and without PostgreSQL. The entry point boots the supervisor after the boot steps and
 * shuts it down before the app closes; the close hook below does the same for an app that is
 * closed without the entry point (every test).
 */
import type { FastifyPluginAsync } from 'fastify';
import { describeError } from '../plugins/logger';
import { unconfiguredLauncher } from './ipc';
import { createCaptureSupervisor } from './supervisor';
import { createSystemTimers } from './timers';
import type { CaptureSupervisor } from './types';

export { createProcessLauncher, unconfiguredLauncher, type ProcessLauncherOptions } from './ipc';
export { MAX_SESSION_ID_CHARS, createCaptureSupervisor } from './supervisor';
export { createSystemTimers } from './timers';
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

export const captureModule: FastifyPluginAsync = async (app) => {
  const supervisor = createCaptureSupervisor({
    // Read at every call: the clock is a seam, and a test replaces it after `ready()`.
    now: () => app.clock.now(),
    timers: createSystemTimers(),
    launcher: unconfiguredLauncher,
    report(failure) {
      const context = { sessionId: failure.sessionId, correlationId: failure.correlationId };
      app.log.error({ err: failure.err, code: failure.code, ...context }, FAILED);
      app.errorLog.append({ level: 'error', source: failure.source, message: FAILED, ...describeError(failure.err), code: failure.code, context });
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
      app.log.info({ code: 'CAPTURE_SUPERVISOR_BOOTED', worker: 'not-configured' }, BOOTED);
    },
    async shutdown() {
      await supervisor.shutdown();
      if (!booted) return;
      booted = false;
      app.log.info({ code: 'CAPTURE_SUPERVISOR_STOPPED' }, STOPPED);
    },
  };
  app.seams.provide('capture', seam);

  app.addHook('onClose', async () => {
    await seam.shutdown();
  });
};
