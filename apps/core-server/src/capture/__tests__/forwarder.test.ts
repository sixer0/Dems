// Blueprint row 58 (M3-W2; register SH-18 / CS-04, telemetry part; capture spec §B.1): the
// forwarder from the supervisor's events to the engine's INTERNAL actions, and the capture keys of
// the configuration (spec §I edits 7 to 10) as the capture unit reads them.
//
// The supervisor is the real one on a FakeWorkerProcess; the engine is a stand-in that records
// what it was called with. The real engine actions are tested where they live
// (`src/engine/__tests__/capture-actions.db.test.ts`, `packages/shared/test/sim-capture-telemetry.test.ts`).
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAPTURE_IPC_DEFAULTS, CaptureWarningCode, CaptureWarningReason, captureWorkerSettingArguments, type CaptureRecord } from '@dems/capture-protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app';
import { ConfigError, createConfig, parseCaptureMode, parseCapturePath, Secret } from '../../config';
import { STUB_WORKER, capturePlan, fakeLauncher, flush, manualCaptureTimers } from '../../../test/support/capture';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { CAPTURE_WARNING_CLEAR_HOLD_MS, CAPTURE_WORKER_PROCESS_SETTINGS, CAPTURE_WORKER_PRODUCTION_SETTINGS, CapturePhase, CaptureRefusal, ForwarderReportCode, PRODUCTION_INGEST_OPEN_WINDOW_MS, WorkerDownCode, createCaptureSupervisor, forwardCaptureEvents, type CaptureEngine, type CaptureReport } from '../index';

const SESSION = 'S-TEST-0001';
const scratch: string[] = [];
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** The three actions a case scripts; the fourth door (`clearCaptureFaults`, D84 R-4) is counted by the rig unless the case gives its own. */
type ScriptedEngine = Omit<CaptureEngine, 'clearCaptureFaults'> & Partial<Pick<CaptureEngine, 'clearCaptureFaults'>>;

interface Calls {
  staleClears: number;
  telemetry: Array<Parameters<CaptureEngine['applyCaptureTelemetry']>[0]>;
  warnings: Array<Parameters<CaptureEngine['raiseCaptureWarning']>[0]>;
  cleared: Array<Parameters<CaptureEngine['clearCaptureWarning']>[0]>;
}

async function forwarding(engine: (calls: Calls) => ScriptedEngine | null, limits = {}) {
  const clock = manualCaptureTimers();
  const fake = fakeLauncher();
  const reports: CaptureReport[] = [];
  const calls: Calls = { staleClears: 0, telemetry: [], warnings: [], cleared: [] };
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits });
  const scripted = engine(calls);
  const host: CaptureEngine | null = scripted === null ? null : { clearCaptureFaults: async () => void (calls.staleClears += 1), ...scripted };
  const stop = forwardCaptureEvents({ capture: supervisor, engine: () => host, report: (entry) => void reports.push(entry), now: clock.now });
  await supervisor.boot();
  await supervisor.start(SESSION, capturePlan(SESSION));
  return { clock, fake, supervisor, reports, calls, stop };
}

const recordingEngine = (calls: Calls): ScriptedEngine => ({
  applyCaptureTelemetry: async (telemetry) => void calls.telemetry.push(telemetry),
  raiseCaptureWarning: async (warning) => void calls.warnings.push(warning),
  clearCaptureWarning: async (warning) => void calls.cleared.push(warning),
});

describe('the forwarder: telemetry and warnings reach the engine (SH-18 / CS-04, telemetry part)', () => {
  it('a telemetry frame becomes one applyCaptureTelemetry call with its levels, ingest states and fragment counters, and nothing of the envelope', async () => {
    const { fake, calls, reports } = await forwarding(recordingEngine);
    fake.last().telemetry(7);
    await flush();
    expect(calls.telemetry).toEqual([
      {
        levels: [{ deviceId: 'MIC-01', role: 'PRIMARY', dbfs: -20, clipped: false, ratePpm: 0, timelineSamples: 480_000, receivedSamples: 480_000, insertedSamples: 0, nonZero: true }],
        ingest: [{ deviceId: 'CAM-01', state: 'CONNECTED' }],
        fragments: [{ deviceId: 'CAM-01', count: 7, bytes: 7_000 }],
      },
    ]);
    expect(reports).toEqual([]);
  });

  it('a worker warning and the supervisor\'s own CAPTURE_FAULT both become raiseCaptureWarning; never a switch command (OD-11)', async () => {
    const { fake, calls, clock } = await forwarding(recordingEngine, { maxRestarts: 0 });
    const before = fake.last().received.length;
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    await flush();
    expect(fake.last().received).toHaveLength(before);
    fake.last().exit(1);
    clock.advance(1);
    await flush();
    expect(calls.warnings).toEqual([
      { code: 'MIC_SILENT', subject: 'MIC-01' },
      // Pin by delta (wave H driver F): the supervisor's own fault says WHY.
      { code: 'CAPTURE_FAULT', subject: null, reason: 'WORKER_EXIT_NONZERO' },
    ]);
  });

  it('CONTROL: after the forwarding is ended nothing reaches the engine, so the calls above are the forwarder\'s', async () => {
    const { fake, calls, stop } = await forwarding(recordingEngine);
    stop();
    fake.last().telemetry(1);
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    await flush();
    // (the one call before the stop: the stale faults cleared when the session reached RECORDING, D84 R-4)
    expect(calls).toEqual({ staleClears: 1, telemetry: [], warnings: [], cleared: [] });
  });

  it('no engine: nothing is forwarded and nothing is reported', async () => {
    const { fake, reports } = await forwarding(() => null);
    fake.last().telemetry(1);
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    await flush();
    expect(reports).toEqual([]);
  });
});

describe('the forwarder never holds the supervisor\'s queue', () => {
  it('an engine that never answers delays no later event: 50 frames and a warning are all handed over, the queue stays empty, the worker is not ended', async () => {
    const never = new Promise<never>(() => {});
    const seen: number[] = [];
    const warned: string[] = [];
    const { fake, supervisor, clock } = await forwarding(() => ({
      applyCaptureTelemetry: (telemetry) => {
        seen.push(telemetry.fragments[0]?.count ?? -1);
        return never;
      },
      raiseCaptureWarning: (warning) => {
        warned.push(warning.code);
        return never;
      },
      clearCaptureWarning: () => never,
    }));
    for (let frame = 1; frame <= 50; frame += 1) {
      fake.last().telemetry(frame);
      await flush();
    }
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    await flush();
    expect(seen).toEqual(Array.from({ length: 50 }, (_unused, index) => index + 1));
    expect(warned).toEqual(['MIC_SILENT']);
    expect(supervisor.status()).toMatchObject({ queuedEvents: 0, droppedTelemetry: 0, droppedEvents: 0, phase: CapturePhase.RECORDING });
    // The heartbeat still counts: a stuck engine costs the worker nothing.
    for (let beat = 0; beat < 10; beat += 1) {
      clock.advance(CAPTURE_IPC_DEFAULTS.heartbeatIntervalMs);
      fake.last().heartbeat();
    }
    expect(fake.last().kills).toEqual([]);
  });

  it('CONTROL: a listener that RETURNS its never-ending promise does hold the queue, so the test above measures the forwarder', async () => {
    const clock = manualCaptureTimers();
    const fake = fakeLauncher();
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    const seen: number[] = [];
    supervisor.on('telemetry', (event) => {
      seen.push(event.frame.fragments[0]?.count ?? -1);
      return new Promise<void>(() => {});
    });
    await supervisor.boot();
    await supervisor.start(SESSION, capturePlan(SESSION));
    for (let frame = 1; frame <= 50; frame += 1) {
      fake.last().telemetry(frame);
      await flush();
    }
    expect(seen).toEqual([1]);
    expect(supervisor.status().droppedTelemetry).toBe(48);
  });
});

describe('the forwarder reports what the engine refuses, without flooding the error log', () => {
  it('telemetry that fails 40 times in a row is reported ONCE; when it works again that is said once; a new failure is a new report', async () => {
    let failing = true;
    const { fake, reports } = await forwarding(() => ({
      applyCaptureTelemetry: async () => {
        if (failing) throw new Error('the engine is not running');
      },
      raiseCaptureWarning: async () => {},
      clearCaptureWarning: async () => {},
    }));
    const send = async (frames: number): Promise<void> => {
      for (let frame = 0; frame < frames; frame += 1) {
        fake.last().telemetry(frame);
        await flush();
      }
    };
    await send(40);
    expect(reports.map((entry) => entry.code)).toEqual([ForwarderReportCode.TELEMETRY_FAILED]);
    expect(reports[0]).toMatchObject({ source: 'capture.forwarder', sessionId: SESSION, correlationId: `cap:${SESSION}:1` });
    failing = false;
    await send(40);
    expect(reports.map((entry) => entry.code)).toEqual([ForwarderReportCode.TELEMETRY_FAILED, ForwarderReportCode.TELEMETRY_RECOVERED]);
    failing = true;
    await send(3);
    expect(reports.map((entry) => entry.code)).toEqual([ForwarderReportCode.TELEMETRY_FAILED, ForwarderReportCode.TELEMETRY_RECOVERED, ForwarderReportCode.TELEMETRY_FAILED]);
  });

  it('EVERY warning the engine refuses is reported, with the session and correlation IDs; an engine that throws at once is caught too', async () => {
    const { fake, reports } = await forwarding(() => ({
      applyCaptureTelemetry: async () => {},
      raiseCaptureWarning: () => {
        throw new Error('unknown subject');
      },
      clearCaptureWarning: async () => {},
    }));
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    await flush();
    fake.last().warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-01');
    await flush();
    expect(reports.map((entry) => [entry.code, entry.sessionId, entry.correlationId, (entry.err as Error).message])).toEqual([
      [ForwarderReportCode.WARNING_FAILED, SESSION, `cap:${SESSION}:1`, 'unknown subject'],
      [ForwarderReportCode.WARNING_FAILED, SESSION, `cap:${SESSION}:1`, 'unknown subject'],
    ]);
  });
});

describe('D72 (A-2): a fault a capture warning raised is cleared by the capture side', () => {
  it('CLEARED from the worker clears the fault once it stayed cleared for the hold (2 s), on the next telemetry; a later ACTIVE is a NEW raise', async () => {
    const { fake, calls, clock } = await forwarding(recordingEngine);
    expect(CAPTURE_WARNING_CLEAR_HOLD_MS).toBe(2_000);
    const worker = fake.last();
    const tick = async (ms: number): Promise<void> => {
      clock.advance(ms);
      worker.heartbeat();
      worker.telemetry(1);
      await flush();
    };
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02');
    await flush();
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'CLEARED');
    await tick(1_999);
    expect(calls.cleared).toEqual([]);
    await tick(1);
    // The fault is raised and cleared under the worker's reason: the engine's key is (kind, reason, device) (D146).
    expect(calls.cleared).toEqual([{ code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' }]);
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02');
    await flush();
    expect(calls.warnings).toEqual([{ code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' }, { code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' }]);
  });

  it('ruling D146: two reasons on ONE camera are two raises; the CLEARED of one clears that one alone after the hold, the other stays raised', async () => {
    const { fake, calls, clock } = await forwarding(recordingEngine);
    const worker = fake.last();
    const tick = async (ms: number): Promise<void> => {
      clock.advance(ms);
      worker.heartbeat();
      worker.telemetry(1);
      await flush();
    };
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await flush();
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_CLOCK_OUT_OF_BOUND);
    await flush();
    // The same reason again while it is active writes nothing.
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await flush();
    expect(calls.warnings).toEqual([
      { code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' },
      { code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' },
    ]);
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'CLEARED', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await tick(CAPTURE_WARNING_CLEAR_HOLD_MS);
    expect(calls.cleared).toEqual([{ code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' }]);
    // The other cause is still active however long the first stays cleared.
    for (let second = 0; second < 6; second += 1) await tick(1_000);
    expect(calls.cleared).toHaveLength(1);
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'CLEARED', CaptureWarningReason.CAMERA_CLOCK_OUT_OF_BOUND);
    await tick(CAPTURE_WARNING_CLEAR_HOLD_MS);
    expect(calls.cleared).toEqual([
      { code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' },
      { code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' },
    ]);
  });

  it('a condition that flaps 50 times inside the hold raises ONCE and clears nothing: one audit row, not one per flap', async () => {
    const { fake, calls, clock } = await forwarding(recordingEngine);
    const worker = fake.last();
    for (let flap = 0; flap < 50; flap += 1) {
      worker.warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
      await flush();
      worker.warning(CaptureWarningCode.MIC_SILENT, 'MIC-01', 'CLEARED');
      await flush();
      clock.advance(100);
      worker.heartbeat();
      worker.telemetry(flap);
      await flush();
    }
    expect(calls.warnings).toEqual([{ code: 'MIC_SILENT', subject: 'MIC-01' }]);
    expect(calls.cleared).toEqual([]);
  });

  it('a CLEARED for a fault this forwarder never raised clears nothing; a warning the engine refused is not cleared later', async () => {
    const refused: Calls = { staleClears: 0, telemetry: [], warnings: [], cleared: [] };
    const { fake, clock } = await forwarding(() => ({
      applyCaptureTelemetry: async () => {},
      raiseCaptureWarning: async () => {
        throw new Error('unknown subject');
      },
      clearCaptureWarning: async (warning) => void refused.cleared.push(warning),
    }));
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-02', 'CLEARED');
    fake.last().warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-01');
    await flush();
    fake.last().warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-01', 'CLEARED');
    clock.advance(5_000);
    fake.last().heartbeat();
    fake.last().telemetry(1);
    await flush();
    expect(refused.cleared).toEqual([]);
  });

  it('when a later session reaches RECORDING, every fault of the sessions before it is cleared: the worker\'s and the supervisor\'s own', async () => {
    const { fake, calls, supervisor } = await forwarding(recordingEngine, { maxRestarts: 0 });
    fake.last().warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02');
    await flush();
    fake.last().exit(1);
    await flush();
    // Pin by delta (wave H driver F): the supervisor's own fault says WHY (the process left with a code other than 0).
    expect(calls.warnings).toEqual([{ code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' }, { code: 'CAPTURE_FAULT', subject: null, reason: 'WORKER_EXIT_NONZERO' }]);
    await supervisor.stop(SESSION, 'CRASH');
    expect(calls.cleared).toEqual([]);
    await supervisor.start('S-TEST-0002', capturePlan('S-TEST-0002'));
    await flush();
    // D84 R-4: ONE call clears every capture fault of the engine, whoever raised it (this table's two among them); the supervisor's own CLEARED finds nothing left to clear.
    expect(calls.staleClears).toBe(2);
    expect(calls.cleared).toEqual([]);
  });

  it('A-13: a report that throws does not become an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => void unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const clock = manualCaptureTimers();
      const fake = fakeLauncher();
      const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
      forwardCaptureEvents({
        capture: supervisor,
        engine: () => ({ applyCaptureTelemetry: async () => Promise.reject(new Error('down')), raiseCaptureWarning: async () => Promise.reject(new Error('down')), clearCaptureWarning: async () => {}, clearCaptureFaults: async () => {} }),
        report: () => {
          throw new Error('the error log is not writable');
        },
        now: clock.now,
      });
      await supervisor.boot();
      await supervisor.start(SESSION, capturePlan(SESSION));
      fake.last().telemetry(1);
      fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
      await flush();
      await flush();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('the two keys of a failed start are on the RAISE of its fault (integration pass D8; C3 §5.3, §5.4 row C; D156)', () => {
  const crash = (code: string) => ({ type: 'CRASH' as const, code, signal: null, exitCode: 70 });

  it('the worker ends for good with NO_CAMERA_CONNECTED and nothing is durable: the supervisor fault is raised with reason NO_CAMERA_CONNECTED and evidenceFiles 0', async () => {
    const { fake, calls, clock } = await forwarding(recordingEngine);
    fake.last().say(crash('NO_CAMERA_CONNECTED'));
    clock.advance(1);
    await flush();
    expect(calls.warnings).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 }]);
  });

  it('CONTROL: a crash code that is not a final one raises the fault WITHOUT the keys - the reason is the worker\'s enumerated code or nothing', async () => {
    const { fake, calls, clock } = await forwarding(recordingEngine, { maxRestarts: 0 });
    fake.last().say(crash('SOME_OTHER_END'));
    clock.advance(1);
    await flush();
    // Pin by delta (wave H driver F): never the worker's own text - the supervisor's closed reason for "it said CRASH"; still no keys.
    expect(calls.warnings).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'WORKER_CRASHED' }]);
  });

  it('CONTROL: a session that holds a durable fragment is not a failed start, whatever its worker says at its end - no keys, no count of 0', async () => {
    const { fake, calls, clock } = await forwarding(recordingEngine);
    fake.last().firstDurableFragment();
    await flush();
    fake.last().say(crash('NO_CAMERA_CONNECTED'));
    clock.advance(1);
    await flush();
    // Pin by delta (wave H driver F): the fault says the worker crashed - NOT "no camera connected, nothing was recorded".
    expect(calls.warnings).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'WORKER_CRASHED' }]);
  });

  it('row D2C (D150 (2), F-C1D-2): a session whose only durable fragments are of CHANNEL files (row 148) is still a failed start - reason NO_CAMERA_CONNECTED, evidenceFiles 0', async () => {
    const { fake, calls, clock } = await forwarding(recordingEngine);
    const sha = (digit: string): string => digit.repeat(64);
    fake.last().record({ kind: 'FRAGMENT_CHECKPOINT', deviceId: 'MIC-01', index: 1, start: 700, len: 1_000, fragSha256: sha('a'), chainSha256: sha('b'), prefixSha256: sha('c'), plaintextSha256: sha('a'), plaintextChainSha256: sha('b'), mediaStartMs: 0, mediaDurationMs: 2_000, keyframe: false, durableAt: 1_791_529_000_001, gcmIv: null, gcmTag: null, keyId: null } as CaptureRecord);
    await flush();
    fake.last().say(crash('NO_CAMERA_CONNECTED'));
    clock.advance(1);
    await flush();
    expect(calls.warnings).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 }]);
  });
});

describe('the capture keys of the configuration (spec §I edits 7 to 10)', () => {
  const input = { port: 4420 as const, demoControls: false, logLevel: 'silent' as const, dataDir: '/data/dems', database: { host: '127.0.0.1', port: 4432, database: 'd', user: 'dems_app', password: new Secret('x') } };

  it('defaults: mode simulated, no worker program, the media root below the data directory (capture spec §H)', () => {
    expect(createConfig(input)).toMatchObject({ captureMode: 'simulated', captureWorkerPath: null, mediaStoreDir: '/data/dems/media/sessions' });
    expect(createConfig({ ...input, captureMode: 'real', captureWorkerPath: '/opt/dems/capture-worker', mediaStoreDir: '/mnt/evidence' })).toMatchObject({
      captureMode: 'real',
      captureWorkerPath: '/opt/dems/capture-worker',
      mediaStoreDir: '/mnt/evidence',
    });
    expect(Object.isFrozen(createConfig(input))).toBe(true);
  });

  it('the mode is one of two words; a path is absolute; the refusal never repeats the value', () => {
    expect([parseCaptureMode(undefined), parseCaptureMode(''), parseCaptureMode('simulated'), parseCaptureMode('real')]).toEqual(['simulated', 'simulated', 'simulated', 'real']);
    for (const bad of ['REAL', 'true', '1', 'live']) expect(() => parseCaptureMode(bad), bad).toThrow(ConfigError);
    expect([parseCapturePath('X', undefined), parseCapturePath('X', ''), parseCapturePath('X', '/a/b')]).toEqual([null, null, '/a/b']);
    for (const bad of ['relative/worker', './worker', 'C:\\worker', '~/worker', '/a\0b']) {
      let message = '';
      try {
        parseCapturePath('DEMS_CAPTURE_WORKER', bad);
      } catch (error) {
        message = (error as ConfigError).message;
        expect((error as ConfigError).code).toBe('CAPTURE_PATH_NOT_ABSOLUTE');
      }
      expect(message, bad).toBe('DEMS_CAPTURE_WORKER must be an absolute path.');
    }
    expect(() => createConfig({ ...input, captureWorkerPath: 'worker' })).toThrow(ConfigError);
    expect(() => createConfig({ ...input, mediaStoreDir: 'media' })).toThrow(ConfigError);
  });
});

describe('which launcher the capture unit is built with', () => {
  /** A program at an absolute path that ignores the worker's arguments, writes them down, and becomes the stub worker. */
  function workerProgram(): { command: string; argsFile: string; dataDir: string } {
    const directory = mkdtempSync(join(tmpdir(), 'dems-row58-'));
    scratch.push(directory);
    const argsFile = join(directory, 'args.txt');
    const command = join(directory, 'worker.sh');
    writeFileSync(command, `#!/bin/sh\nprintf '%s\\n' "$@" > '${argsFile}'\nenv > '${argsFile}.env'\nexec '${process.execPath}' '${STUB_WORKER}' --heartbeat-ms=50\n`);
    chmodSync(command, 0o700);
    return { command, argsFile, dataDir: directory };
  }

  it('mode real with a worker program: the supervisor starts THAT program, with fixed arguments and an empty environment', async () => {
    const { command, argsFile, dataDir } = workerProgram();
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'info', dataDir, captureMode: 'real', captureWorkerPath: command }), logStream: log.stream });
    await app.ready();
    await app.capture.boot();
    await app.capture.start(SESSION, capturePlan(SESSION));
    expect(app.capture.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 1 });
    expect(app.capture.status().workerPid).toBeGreaterThan(0);
    await vi.waitFor(() => expect(existsSync(argsFile)).toBe(true));
    // Nothing of the session is an argument: where the worker logs, and how often it beats.
    // Mode real with the development-sources flag unset IS the production operation: its worker gets
    // the ingest window of that operation (AD-11; task 4 row 47, integration pass I-3 item 2).
    const words = readFileSync(argsFile, 'utf8').trim().split('\n');
    expect(words).toEqual(['--log', `${dataDir}/capture-worker.jsonl`, '--heartbeat-ms', String(CAPTURE_IPC_DEFAULTS.heartbeatIntervalMs), ...captureWorkerSettingArguments(CAPTURE_WORKER_PRODUCTION_SETTINGS)]);
    expect(words[words.indexOf('--ingest-open-window-ms') + 1]).toBe(String(PRODUCTION_INGEST_OPEN_WINDOW_MS));
    // The server's environment did not reach it (the shell itself adds PWD, SHLVL and _).
    expect(readFileSync(`${argsFile}.env`, 'utf8').split('\n').map((line) => line.split('=')[0]).filter((name) => name !== '' && !['PWD', 'SHLVL', '_', 'OLDPWD'].includes(name ?? ''))).toEqual([]);
    expect(log.lines().find((line) => line['code'] === 'CAPTURE_SUPERVISOR_BOOTED')).toMatchObject({ mode: 'real', worker: 'configured' });
    await app.capture.stop(SESSION, 'STOPPED');
    await app.close();
  });

  it('mode real with the development-sources flag set: the worker of the development operation keeps the window every other operation has (AD-11)', async () => {
    const { command, argsFile, dataDir } = workerProgram();
    const app = buildApp({ config: unitTestConfig({ dataDir, captureMode: 'real', captureDevSources: true, captureWorkerPath: command }) });
    await app.ready();
    await app.capture.boot();
    await app.capture.start(SESSION, capturePlan(SESSION));
    await vi.waitFor(() => expect(existsSync(argsFile)).toBe(true));
    const words = readFileSync(argsFile, 'utf8').trim().split('\n');
    expect(words).toEqual(['--log', `${dataDir}/capture-worker.jsonl`, '--heartbeat-ms', String(CAPTURE_IPC_DEFAULTS.heartbeatIntervalMs), ...captureWorkerSettingArguments(CAPTURE_WORKER_PROCESS_SETTINGS)]);
    expect(words[words.indexOf('--ingest-open-window-ms') + 1]).toBe(String(CAPTURE_WORKER_PROCESS_SETTINGS.ingestOpenWindowMs));
    expect(CAPTURE_WORKER_PROCESS_SETTINGS.ingestOpenWindowMs).not.toBe(PRODUCTION_INGEST_OPEN_WINDOW_MS);
    await app.capture.stop(SESSION, 'STOPPED');
    await app.close();
  });

  it.each([
    ['simulated (the default), although a program is configured', { captureWorkerPath: 'WORKER' }, 'simulated'],
    ['real, with no program', { captureMode: 'real' as const }, 'real'],
  ])('CONTROL: mode %s: no process is started; a start fails at once with CAPTURE_FAULT', async (_label, overrides, mode) => {
    const { command, argsFile, dataDir } = workerProgram();
    const log = captureLog();
    const config = unitTestConfig({ logLevel: 'info', dataDir, ...overrides, ...('captureWorkerPath' in overrides ? { captureWorkerPath: command } : {}) });
    const app = buildApp({ config, logStream: log.stream });
    await app.ready();
    await app.capture.boot();
    await expect(app.capture.start(SESSION, capturePlan(SESSION))).rejects.toMatchObject({ code: CaptureRefusal.FAULT, detail: WorkerDownCode.NOT_CONFIGURED });
    expect(existsSync(argsFile)).toBe(false);
    expect(log.lines().find((line) => line['code'] === 'CAPTURE_SUPERVISOR_BOOTED')).toMatchObject({ mode, worker: 'not-configured' });
    await app.close();
  });
});
