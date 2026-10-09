// The capture unit on the real app factory (blueprint row 57 / M3-W1; register CS-01; capture spec
// §B.1, §I): the `capture` seam, what the server does without a worker command, what it writes
// when capture fails, and what closing the app does. No database, no listener, no process.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, SEAM_PROVIDERS } from '../../app';
import { capturePlan, fakeLauncher, manualCaptureTimers } from '../../../test/support/capture';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { CapturePhase, CaptureRefusal, WorkerDownCode, createCaptureSupervisor } from '../index';

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
    expect(persisted[1]?.['context']).toEqual({ sessionId: SESSION, correlationId: `cap:${SESSION}:1` });

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
});
