// The capture unit on the real app factory (blueprint row 57 / M3-W1; register CS-01; capture spec
// §B.1, §I): the `capture` seam, what the server does without a worker command, what it writes
// when capture fails, and what closing the app does. No database, no listener, no process.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, SEAM_PROVIDERS } from '../../app';
import { capturePlan, fakeLauncher, flush, manualCaptureTimers } from '../../../test/support/capture';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { CAPTURE_WORKER_SETTINGS } from '@dems/capture-protocol';
import { CaptureOperation } from '../adapters';
import { CAPTURE_WORKER_PRODUCTION_SETTINGS, CapturePhase, CaptureRefusal, PRODUCTION_INGEST_OPEN_WINDOW_MS, WorkerDownCode, captureWorkerArguments, createCaptureSupervisor, forwardCaptureEvents, writeSupervisorFaults } from '../index';

const SESSION = 'S-TEST-0001';
const scratch: string[] = [];
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('the capture seam', () => {
  it('is provided by the capture unit, named in the scaffold, and closed until the entry point boots it', async () => {
    const app = buildApp({ config: unitTestConfig() });
    await app.ready();
    expect(SEAM_PROVIDERS.capture).toBe('src/capture (capture module)');
    expect(app.seams.has('capture')).toBe(true);
    expect(app.capture).toBe(app.seams.get('capture'));
    expect(app.capture.status()).toMatchObject({ phase: CapturePhase.CLOSED, sessionId: null, workerPid: null });
    await expect(app.capture.start(SESSION, capturePlan())).rejects.toMatchObject({ code: CaptureRefusal.CLOSED });
    await app.close();
  });

  it('a test replaces it with a supervisor on a fake worker (spec §B.1 test hook)', async () => {
    const app = buildApp({ config: unitTestConfig() });
    await app.ready();
    const clock = manualCaptureTimers();
    const fake = fakeLauncher();
    const replacement = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    app.seams.replace('capture', replacement);
    expect(app.capture).toBe(replacement);
    await app.capture.boot();
    await app.capture.start(SESSION, capturePlan());
    expect(app.capture.status()).toMatchObject({ phase: CapturePhase.RECORDING, workerPid: fake.last().pid });
    await app.capture.shutdown();
    await app.close();
  });

  it('capture mode simulated (the default) has no worker command: a start fails at once with CAPTURE_FAULT, is not retried, and both logs say so without the plan', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dems-row57-'));
    scratch.push(directory);
    const errorLogFile = join(directory, 'errors.log');
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), logStream: log.stream, errorLogFile });
    await app.ready();
    await app.capture.boot();

    await expect(app.capture.start(SESSION, capturePlan())).rejects.toMatchObject({ code: CaptureRefusal.FAULT, detail: WorkerDownCode.NOT_CONFIGURED });
    expect(app.capture.status()).toMatchObject({ phase: CapturePhase.IDLE, sessionId: null, attempt: 0 });

    const lines = log.lines().filter((line) => line['sessionId'] === SESSION);
    expect(lines.map((line) => [line['level'], line['code'], line['sessionId'], line['correlationId']])).toEqual([
      [40, 'CAPTURE_WORKER_DOWN', SESSION, `cap:${SESSION}:1`],
      [50, 'CAPTURE_FAULT', SESSION, `cap:${SESSION}:1`],
      // Row 58: the fault is handed to the engine (`raiseCaptureWarning`). This app has no running
      // engine (no database), so the engine refuses, and THAT is written down too: never silent.
      [50, 'CAPTURE_WARNING_NOT_RAISED', SESSION, `cap:${SESSION}:1`],
    ]);
    expect(lines[0]).toMatchObject({ downCode: WorkerDownCode.NOT_CONFIGURED, attempt: 1, restartInMs: null });

    // The persistent error log holds the same two entries: found the next morning.
    const persisted = readFileSync(errorLogFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(persisted.map((entry) => [entry['level'], entry['source'], entry['code']])).toEqual([
      ['warn', 'capture.supervisor', 'CAPTURE_WORKER_DOWN'],
      ['error', 'capture.supervisor', 'CAPTURE_FAULT'],
      ['error', 'capture.forwarder', 'CAPTURE_WARNING_NOT_RAISED'],
    ]);
    // Pin by delta (wave H driver F): the persisted fault says WHY, as one code of the closed enumeration.
    expect(persisted[1]?.['context']).toEqual({ sessionId: SESSION, correlationId: `cap:${SESSION}:1`, reason: 'WORKER_NOT_CONFIGURED' });

    // Nothing of the plan (an address, a path) is in either.
    expect(`${log.text()}${readFileSync(errorLogFile, 'utf8')}`).not.toMatch(/rtsp|8554|\.mp4|media\/sessions/);
    await app.close();
  });

  it('closing the app shuts the supervisor down: it takes no session afterwards, and the log holds one line for the boot and one for the stop', async () => {
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), logStream: log.stream });
    await app.ready();
    const supervisor = app.capture;
    const codes = (): unknown[] => log.lines().map((line) => line['code']).filter((code) => String(code).startsWith('CAPTURE_SUPERVISOR'));
    expect(codes()).toEqual([]);
    await supervisor.boot();
    await supervisor.boot();
    expect(supervisor.status().phase).toBe(CapturePhase.IDLE);
    expect(codes()).toEqual(['CAPTURE_SUPERVISOR_BOOTED']);
    await app.close();
    expect(supervisor.status().phase).toBe(CapturePhase.CLOSED);
    expect(codes()).toEqual(['CAPTURE_SUPERVISOR_BOOTED', 'CAPTURE_SUPERVISOR_STOPPED']);
    await expect(supervisor.start(SESSION, capturePlan())).rejects.toMatchObject({ code: CaptureRefusal.CLOSED });
  });

  it('an app that is closed without ever being booted writes no line about the supervisor', async () => {
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), logStream: log.stream });
    await app.ready();
    await app.close();
    expect(log.lines().filter((line) => String(line['code']).startsWith('CAPTURE_SUPERVISOR'))).toEqual([]);
  });

  // Fix wave M (re-check 75 finding G75e-03): the lines of the supervisor's own fault, the REAL listener of this unit
  // (`writeSupervisorFaults`) on a supervisor with a fake worker, beside the real forwarder with an engine that records its calls.
  it('G75e-03: a worker-killed session writes ONE error line with its reason; the healthy start of the NEXT session writes no error line, names no fault of the earlier one and sends the engine nothing but the one clear of a new recording', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dems-wave-m-'));
    scratch.push(directory);
    const errorLogFile = join(directory, 'errors.log');
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), logStream: log.stream, errorLogFile });
    await app.ready();
    const clock = manualCaptureTimers();
    const fake = fakeLauncher();
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    const states: string[] = [];
    supervisor.on('warning', (event) => void (event.source === 'supervisor' ? states.push(`${event.state} ${event.sessionId}`) : undefined));
    const calls: string[] = [];
    forwardCaptureEvents({
      capture: supervisor,
      engine: () => ({
        applyCaptureTelemetry: async () => {},
        raiseCaptureWarning: async (warning) => void calls.push(`raise ${warning.code}:${String(warning.subject)}`),
        clearCaptureWarning: async (warning) => void calls.push(`clear ${warning.code}:${String(warning.subject)}`),
        clearCaptureFaults: async () => void calls.push('clear every capture fault'),
      }),
      report: () => {},
      now: clock.now,
    });
    const stopWriting = writeSupervisorFaults(app, supervisor);
    await supervisor.boot();

    // The first session records, holds a durable fragment, and its worker is killed: down for good (option C, D67).
    const FIRST = 'S-TEST-0001';
    const SECOND = 'S-TEST-0002';
    await supervisor.start(FIRST, capturePlan(FIRST));
    fake.last().firstDurableFragment('CAM-01');
    await flush();
    fake.last().exit(null, 'SIGKILL');
    await flush();
    expect(supervisor.status().phase).toBe(CapturePhase.FAULTED);
    const faultLines = (): Record<string, unknown>[] => log.lines().filter((line) => line['msg'] === 'capture fault: the capture worker cannot be kept running');
    expect(faultLines().map((line) => [line['level'], line['code'], line['sessionId'], line['reason']])).toEqual([[50, 'CAPTURE_FAULT', FIRST, 'WORKER_KILLED']]);
    // The session is stopped (its durable prefix is sealed as interrupted): the supervisor is free.
    await supervisor.stop(FIRST, 'STOPPED');
    await flush();
    const linesBefore = log.lines().length;
    const persistedBefore = readFileSync(errorLogFile, 'utf8');
    calls.length = 0;

    // The next session starts and records. CONTROL (the finding): the supervisor DOES say its CLEARED for the earlier session here.
    await supervisor.start(SECOND, capturePlan(SECOND));
    await flush();
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, sessionId: SECOND });
    expect(states).toEqual([`ACTIVE ${FIRST}`, `CLEARED ${FIRST}`]);
    const after = log.lines().slice(linesBefore);
    // No error-level line at all at a healthy start, and no line that carries the earlier session as `sessionId`.
    expect(after.filter((line) => Number(line['level']) >= 40)).toEqual([]);
    expect(after.filter((line) => line['sessionId'] === FIRST)).toEqual([]);
    expect(faultLines()).toHaveLength(1);
    expect(after.filter((line) => line['code'] === 'CAPTURE_SUPERVISOR_FAULT_OVER').map((line) => [line['level'], line['faultOfSessionId'], line['reason']])).toEqual([[30, FIRST, undefined]]);
    // The persistent error log got nothing: nothing failed.
    expect(readFileSync(errorLogFile, 'utf8')).toBe(persistedBefore);
    // The engine: the ONE clear a new recording always makes (D84 R-4) - the late event raises and clears nothing of its own.
    expect(calls).toEqual(['clear every capture fault']);

    stopWriting();
    await supervisor.shutdown();
    await app.close();
  });

  // Task 4, integration pass I-3 (request of row 47; AD-11): the session worker of REAL_PRODUCTION gets that operation's ingest window.
  it('the session worker is started with the ingest window of its operation: 30,000 ms for REAL_PRODUCTION and for no other operation', () => {
    const index = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    // The unit asks the one function for the operation ONCE, and the launcher of session workers is told whether it is production.
    expect(index.match(/captureOperationOf\(app\.config\)/g)).toHaveLength(1);
    expect(index).toContain('const operation = captureOperationOf(app.config);');
    expect(index.split('\n').filter((line) => line.includes('createProcessLauncher({')).map((line) => line.trim())).toEqual([
      'createProcessLauncher({ command: captureWorkerPath, args: captureWorkerArguments(`${dataDir}/${WORKER_LOG_NAME}`, operation === CaptureOperation.REAL_PRODUCTION) })',
    ]);
    // What that comparison gives the worker, operation by operation: the window is the one word that differs.
    const at = (list: readonly string[]): string | undefined => list[list.indexOf(CAPTURE_WORKER_SETTINGS.ingestOpenWindowMs.argument) + 1];
    const windows = Object.values(CaptureOperation).map((operation) => [operation, at(captureWorkerArguments('/x/worker.jsonl', operation === CaptureOperation.REAL_PRODUCTION))]);
    expect(windows).toEqual([
      ['SIMULATED', String(CAPTURE_WORKER_SETTINGS.ingestOpenWindowMs.default)],
      ['REAL_PRODUCTION', String(PRODUCTION_INGEST_OPEN_WINDOW_MS)],
      ['REAL_DEVELOPMENT', String(CAPTURE_WORKER_SETTINGS.ingestOpenWindowMs.default)],
    ]);
    expect(PRODUCTION_INGEST_OPEN_WINDOW_MS).toBe(30_000);
    expect(CAPTURE_WORKER_PRODUCTION_SETTINGS.ingestOpenWindowMs).toBe(PRODUCTION_INGEST_OPEN_WINDOW_MS);
  });
});
