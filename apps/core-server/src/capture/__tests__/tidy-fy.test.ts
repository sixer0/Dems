// Tidy pass F-Y (the request lines fix pass F-M3 filed for the Core's capture side; ruling D179).
//
//   item 1  a worker the supervisor ENDED for telemetry outside the plan, or for a switch nobody
//           commanded, is said to the operator by NAME (the capture-wide fault carries the reason),
//           not as a bare crash; the fake worker and the stub worker say what the real worker says;
//   item 2  every start path of a worker passes `--max-fragment-bytes` = the seal's bound.
//
// The supervisor and the forwarder are the production ones; the worker is the fake (item 1) or a real
// child process that writes its arguments down (item 2). No device, no port, no camera file.
import { appendFileSync, chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPTURE_WORKER_SETTINGS, CaptureSyncLevel, CaptureWarningReason, LIBAVFORMAT_VERSION_MISMATCH, captureWorkerSettingArguments, type WorkerMessage } from '@dems/capture-protocol';
import { CAPTURE_REASON_SEVERITY, captureFaultSentence, isCaptureFaultReason } from '@dems/shared/sim';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STUB_WORKER, capturePlan, fakeLauncher, flush, manualCaptureTimers } from '../../../test/support/capture';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { buildApp } from '../../app';
import { SEALING_MAX_FRAGMENT_BYTES } from '../../sealing';
import { CAPTURE_WORKER_PROCESS_SETTINGS, CapturePhase, SUPERVISOR_REFUSAL_REASONS, captureWorkerArguments, createCaptureSupervisor, createProcessLauncher, createSystemTimers, forwardCaptureEvents, type CaptureEvent } from '../index';

const SESSION = 'S-TEST-0001';
const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER_SOURCES = resolve(HERE, '../../../../capture-worker/src');
/** The word the real worker's HELLO names, read from its header. */
const REAL_WORKER_VERSION = /^#define WORKER_VERSION +"([^"]+)"/m.exec(readFileSync(resolve(WORKER_SOURCES, 'worker.h'), 'utf8'))?.[1] ?? '';

const scratch: string[] = [];
const stubs: Array<{ shutdown(): Promise<void> }> = [];
afterEach(async () => {
  for (const supervisor of stubs.splice(0)) await supervisor.shutdown();
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function rig() {
  const clock = manualCaptureTimers();
  const fake = fakeLauncher({ ackSwitch: false });
  const raised: Array<Record<string, unknown>> = [];
  const events: CaptureEvent[] = [];
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits: {} });
  for (const name of ['workerDown', 'phase', 'record', 'warning'] as const) supervisor.on(name, (event) => void events.push(event));
  forwardCaptureEvents({
    capture: supervisor,
    engine: () => ({
      applyCaptureTelemetry: async () => {},
      raiseCaptureWarning: async (warning) => void raised.push({ ...warning }),
      clearCaptureWarning: async () => {},
      clearCaptureFaults: async () => {},
    }),
    report: () => {},
    now: clock.now,
  });
  await supervisor.boot();
  /** A session that holds a durable fragment: its worker is not restarted (option C). */
  const recording = async (): Promise<ReturnType<typeof fake.last>> => {
    await supervisor.start(SESSION, capturePlan(SESSION));
    const worker = fake.last();
    worker.firstDurableFragment('CAM-01');
    await flush();
    raised.length = 0;
    return worker;
  };
  const faults = (): Array<Record<string, unknown>> => raised.filter((warning) => warning['code'] === 'CAPTURE_FAULT' && warning['subject'] === null);
  return { supervisor, fake, raised, events, recording, faults };
}

describe('item 1: what the supervisor refused is said by name, not as a bare crash', () => {
  it('telemetry that names a device outside the plan: the capture-wide fault is raised with the reason TELEMETRY_SUBJECT_UNKNOWN', async () => {
    const h = await rig();
    const worker = await h.recording();
    worker.say({ type: 'TELEMETRY', levels: [], ingest: [{ deviceId: 'CAM-09', state: 'CONNECTED' }], fragments: [], clocks: [], tapActive: false });
    await flush();
    expect(h.supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, lastCrash: { code: 'PROTOCOL_VIOLATION', detail: 'TELEMETRY_SUBJECT_UNKNOWN' } });
    expect(h.faults()).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'TELEMETRY_SUBJECT_UNKNOWN' }]);
  });

  it('the record of a switch nobody commanded: the capture-wide fault is raised with the reason SWITCH_NOT_COMMANDED', async () => {
    const h = await rig();
    const worker = await h.recording();
    worker.record({ kind: 'AUDIO_SOURCE_INTERVAL', deviceId: 'MIC-02', role: 'STANDBY', index: 2, fromSample: 480, sampleRateHz: 48_000, capturedAtMs: 1, reason: 'OPERATOR_SWITCH', correlationId: 'cap:nobody:1', appliedDelayUs: 1 });
    await flush();
    expect(h.supervisor.status().lastCrash).toMatchObject({ code: 'PROTOCOL_VIOLATION', detail: 'SWITCH_NOT_COMMANDED' });
    expect(h.faults()).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'SWITCH_NOT_COMMANDED' }]);
  });

  // Pin by delta (wave H driver F; F-Y decision 6, gate 64 C4): until then these two raised the fault WITHOUT a reason. Every
  // end of a worker now has a reason of the closed enumeration `CaptureDownReason` - another one than the two named refusals above.
  it('CONTROL: a worker that simply dies, and a line that is no frame, raise the same fault with ANOTHER reason than the two refusals', async () => {
    const h = await rig();
    (await h.recording()).exit(70);
    await flush();
    expect(h.faults()).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'WORKER_EXIT_NONZERO' }]);
    const other = await rig();
    (await other.recording()).violate('FRAME_NOT_JSON');
    await flush();
    expect(other.supervisor.status().phase).toBe(CapturePhase.FAULTED);
    expect(other.faults()).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'WORKER_FRAME_INVALID' }]);
  });

  it('each named refusal has its own sentence for the operator, about the capture as a whole, and is critical', () => {
    // Pin by delta (wave H driver F): the list is every member of `SupervisorRefusal` now; the two of this pass are among them.
    // That EVERY reason has its sentence is `fault-wording.test.ts` (it enumerates `CaptureDownReason`).
    expect(SUPERVISOR_REFUSAL_REASONS).toEqual(expect.arrayContaining(['SWITCH_NOT_COMMANDED', 'TELEMETRY_SUBJECT_UNKNOWN']));
    for (const reason of ['SWITCH_NOT_COMMANDED', 'TELEMETRY_SUBJECT_UNKNOWN']) {
      expect(isCaptureFaultReason(reason), reason).toBe(true);
      const sentence = captureFaultSentence(reason, null);
      expect(sentence, reason).toMatch(/^The capture was stopped: /);
      expect(sentence).not.toContain(`(${reason})`);
      expect(CAPTURE_REASON_SEVERITY[reason as keyof typeof CAPTURE_REASON_SEVERITY]).toBe('CRITICAL');
    }
  });
});

describe('item 1: the fake worker and the stub worker say what the real worker says', () => {
  it('HELLO names the release word of the real worker (worker.h)', async () => {
    expect(REAL_WORKER_VERSION).toMatch(/^capture-worker\/\d+\.\d+\.\d+$/);
    const h = await rig();
    await h.supervisor.start(SESSION, capturePlan(SESSION));
    expect(h.fake.behaviour.workerVersion).toBe(REAL_WORKER_VERSION);
    expect(h.supervisor.status().phase).toBe(CapturePhase.RECORDING);
    expect(readFileSync(STUB_WORKER, 'utf8')).toContain(`workerVersion: '${REAL_WORKER_VERSION}'`);
  });

  it('the first durable fragment states the sync level it achieved: the full sync by default, plain fsync when the test says so', async () => {
    const h = await rig();
    await h.supervisor.start(SESSION, capturePlan(SESSION));
    h.fake.last().firstDurableFragment('CAM-01');
    h.fake.last().firstDurableFragment('CAM-02', 5_131, CaptureSyncLevel.FSYNC);
    await flush();
    const records = h.events.flatMap((event) => (event.name === 'record' && event.record.kind === 'FIRST_DURABLE_FRAGMENT' ? [[event.record.deviceId, event.record.syncLevel]] : []));
    expect(records).toEqual([['CAM-01', CaptureSyncLevel.FULL], ['CAM-02', CaptureSyncLevel.FSYNC]]);
    // The stub says it too, as the real worker does (ingest.c).
    expect(readFileSync(resolve(WORKER_SOURCES, 'ingest.c'), 'utf8')).toContain('syncLevel');
    expect(readFileSync(STUB_WORKER, 'utf8')).toMatch(/kind: 'FIRST_DURABLE_FRAGMENT'[^\n]*syncLevel: 'F_FULLFSYNC'/);
  });

  it('the fragment size bound: one ACTIVE advisory warning per camera, never CLEARED (the real worker raises it once)', async () => {
    const h = await rig();
    await h.supervisor.start(SESSION, capturePlan(SESSION));
    h.fake.last().fragmentSizeBound('CAM-02');
    h.fake.last().fragmentSizeBound('CAM-02');
    await flush();
    const warnings = h.events.flatMap((event) => (event.name === 'warning' && event.source === 'worker' ? [[event.code, event.reason, event.state, event.subject]] : []));
    expect(warnings).toEqual([['CAPTURE_FAULT', CaptureWarningReason.FRAGMENT_SIZE_BOUND_REACHED, 'ACTIVE', 'CAM-02']]);
    expect(h.raised).toEqual([{ code: 'FRAGMENT_SIZE_BOUND_REACHED', subject: 'CAM-02', sessionId: SESSION }]);
    expect(h.supervisor.status().phase).toBe(CapturePhase.RECORDING);
  });

  it('a crash is a CRASH frame, then exit 70; a worker on another libavformat says that CRASH INSTEAD of HELLO, with no session', async () => {
    const h = await rig();
    const worker = await h.recording();
    worker.crash('WRITER_SYNC_FAILED');
    await flush();
    expect(worker.exited).toBe(true);
    expect(h.supervisor.status().lastCrash).toMatchObject({ code: 'EXITED', detail: 'WRITER_SYNC_FAILED', exitCode: 70 });

    const said: WorkerMessage[] = [];
    const mismatch = fakeLauncher({ libavformatMismatch: true });
    const channel = mismatch.launcher({ sessionId: SESSION, correlationId: 'cap:test:1', attempt: 1 } as never, { message: (message) => void said.push(message), violation: () => {}, exit: (exit) => void said.push({ exit } as never) });
    await flush();
    expect(said).toEqual([{ v: 4, sessionId: null, type: 'CRASH', code: LIBAVFORMAT_VERSION_MISMATCH, signal: null, exitCode: 70 }, { exit: { exitCode: 70, signal: null, spawnFailed: false } }]);
    expect((channel as { exited?: boolean }).exited).toBe(true);
  });
});

describe('item 1: the stub worker (a real process) says the same things over real pipes', () => {
  async function stub(...options: string[]) {
    const supervisor = createCaptureSupervisor({ now: () => Date.now(), timers: createSystemTimers(), launcher: createProcessLauncher({ command: process.execPath, args: [STUB_WORKER, '--heartbeat-ms=50', ...options] }), limits: {} });
    stubs.push(supervisor);
    const events: CaptureEvent[] = [];
    for (const name of ['workerDown', 'record', 'warning'] as const) supervisor.on(name, (event) => void events.push(event));
    await supervisor.boot();
    return { supervisor, events };
  }

  it('--durable --size-bound: the first durable fragment states F_FULLFSYNC and the size-bound warning is one ACTIVE advisory of the first camera; --crash: one CRASH frame, exit 70', async () => {
    const h = await stub('--durable', '--size-bound');
    await h.supervisor.start(SESSION, capturePlan(SESSION));
    await vi.waitFor(() => expect(h.events.filter((event) => event.name === 'warning')).toHaveLength(1));
    expect(h.events.flatMap((event) => (event.name === 'record' && event.record.kind === 'FIRST_DURABLE_FRAGMENT' ? [event.record] : []))).toEqual([{ kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'CAM-01', bytes: 1, syncLevel: CaptureSyncLevel.FULL }]);
    expect(h.events.flatMap((event) => (event.name === 'warning' ? [[event.source, event.reason, event.state, event.subject]] : []))).toEqual([['worker', CaptureWarningReason.FRAGMENT_SIZE_BOUND_REACHED, 'ACTIVE', 'CAM-01']]);
    expect((await h.supervisor.stop(SESSION, 'STOPPED')).clean).toBe(true);

    const crashing = await stub('--durable', '--crash=WRITER_SYNC_FAILED');
    await crashing.supervisor.start(SESSION, capturePlan(SESSION)).catch(() => undefined);
    await vi.waitFor(() => expect(crashing.supervisor.status().lastCrash).toMatchObject({ code: 'EXITED', detail: 'WRITER_SYNC_FAILED', exitCode: 70 }));
  });

  it('--lavf-mismatch: CRASH LIBAVFORMAT_VERSION_MISMATCH instead of HELLO - the start is refused by that name and the worker was sent nothing', async () => {
    const h = await stub('--lavf-mismatch');
    await expect(h.supervisor.start(SESSION, capturePlan(SESSION))).rejects.toMatchObject({ code: 'CAPTURE_FAULT' });
    expect(h.supervisor.status().lastCrash).toMatchObject({ code: 'EXITED', detail: LIBAVFORMAT_VERSION_MISMATCH, exitCode: 70 });
    expect(h.events.filter((event) => event.name === 'workerDown')).toHaveLength(1);
  });
});

describe('item 5: the target of a connection test lives in a file that holds no client', () => {
  it('`connection-target.ts` imports the adapter errors and types only, keeps no state, and the ONVIF session dials with ITS function', () => {
    // The code of the file, without its comments (the header names the client it does not hold).
    const target = readFileSync(resolve(HERE, '../adapters/camera/connection-target.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect([...target.matchAll(/^import .* from '([^']+)';$/gm)].map((match) => match[1])).toEqual(['../errors', '../types']);
    expect(target).not.toMatch(/^(?:let|var) |\bnew cam\b|onvif|credential|\bawait\b|\bfetch\b/im);
    expect([...target.matchAll(/^export (?:function|interface|const) (\w+)/gm)].map((match) => match[1])).toEqual(['ConnectionTarget', 'targetOf', 'connectionTargetOf']);
    const session = readFileSync(resolve(HERE, '../adapters/camera/onvif-session.ts'), 'utf8');
    expect(session).toContain("import { targetOf, type ConnectionTarget } from './connection-target';");
    expect(session).not.toMatch(/function targetOf|connectionTargetOf/);
  });
});

describe('item 2: every start path of a worker passes the fragment bound of the seal', () => {
  /** A program that writes down the arguments of EVERY launch (one line each) and becomes the stub worker. */
  function workerProgram(): { command: string; argsFile: string; dataDir: string } {
    const directory = mkdtempSync(join(tmpdir(), 'dems-fy-'));
    scratch.push(directory);
    const argsFile = join(directory, 'launches.txt');
    const command = join(directory, 'worker.sh');
    writeFileSync(command, `#!/bin/sh\nprintf '%s\\n' "$*" >> '${argsFile}'\nexec '${process.execPath}' '${STUB_WORKER}' --heartbeat-ms=50\n`);
    chmodSync(command, 0o700);
    appendFileSync(argsFile, '');
    return { command, argsFile, dataDir: directory };
  }
  const launches = (argsFile: string): string[] => (existsSync(argsFile) ? readFileSync(argsFile, 'utf8').split('\n').filter((line) => line !== '') : []);
  const BOUND = `--max-fragment-bytes ${SEALING_MAX_FRAGMENT_BYTES}`;

  it('the first start, the restart of a worker inside a session (option C) and the start after a restart of the Core (RECOVERY) pass the SAME number: the seal\'s', async () => {
    const { command, argsFile, dataDir } = workerProgram();
    const core = (): ReturnType<typeof buildApp> => buildApp({ config: unitTestConfig({ logLevel: 'info', dataDir, captureMode: 'real', captureWorkerPath: command }), logStream: captureLog().stream });

    // 1. The first start.
    const first = core();
    await first.ready();
    await first.capture.boot();
    await first.capture.start(SESSION, capturePlan(SESSION));
    await vi.waitFor(() => expect(launches(argsFile)).toHaveLength(1));
    // 2. The worker of a session that holds nothing durable dies: the supervisor starts another one.
    process.kill(first.capture.status().workerPid ?? -1, 'SIGKILL');
    await vi.waitFor(() => expect(first.capture.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2 }), { timeout: 10_000 });
    expect(launches(argsFile)).toHaveLength(2);
    await first.capture.stop(SESSION, 'STOPPED');
    await first.close();
    // 3. The Core starts again on the same data directory (the boot of a RECOVERY starts no worker): its next start.
    const second = core();
    await second.ready();
    await second.capture.boot();
    expect(launches(argsFile)).toHaveLength(2);
    await second.capture.start('S-TEST-0002', capturePlan('S-TEST-0002'));
    await vi.waitFor(() => expect(launches(argsFile)).toHaveLength(3));
    await second.capture.stop('S-TEST-0002', 'STOPPED');
    await second.close();

    const said = launches(argsFile);
    for (const line of said) expect(line).toContain(BOUND);
    expect(new Set(said).size).toBe(1);
    expect(said[0]?.match(/--max-fragment-bytes/g)).toHaveLength(1);
  }, 30_000);

  it('a start without the bound is impossible: the launcher\'s settings name it, the argument list of ANY settings holds it, and a number outside the worker\'s range is refused before a process starts', () => {
    expect(CAPTURE_WORKER_PROCESS_SETTINGS.maxFragmentBytes).toBe(SEALING_MAX_FRAGMENT_BYTES);
    const position = (args: string[]): string | undefined => args[args.indexOf('--max-fragment-bytes') + 1];
    expect(position(captureWorkerSettingArguments(CAPTURE_WORKER_PROCESS_SETTINGS))).toBe(String(SEALING_MAX_FRAGMENT_BYTES));
    // Left out of the settings: the argument is still written, with the package's default - the same number.
    expect(position(captureWorkerSettingArguments({}))).toBe(String(SEALING_MAX_FRAGMENT_BYTES));
    expect(position(captureWorkerSettingArguments({ ingestOpenWindowMs: CAPTURE_WORKER_SETTINGS.ingestOpenWindowMs.default }))).toBe(String(SEALING_MAX_FRAGMENT_BYTES));
    expect(() => captureWorkerSettingArguments({ maxFragmentBytes: 0 })).toThrow(RangeError);
    expect(() => captureWorkerSettingArguments({ maxFragmentBytes: Number.NaN })).toThrow(RangeError);
    // ONE launcher of session workers in the production sources, built from those settings; the boot probe's launcher sends no START.
    const index = readFileSync(resolve(HERE, '../index.ts'), 'utf8');
    expect(index.match(/createProcessLauncher\(/g)).toHaveLength(1);
    // Pin by delta (wave H driver F, gate 64 C7): the list is built by ONE function, `captureWorkerArguments` (`worker-arguments.ts`),
    // which the boot probe uses too - so the probe passes the bound as well, and a worker that does not take it is refused at boot.
    expect(index).toMatch(/createProcessLauncher\(\{[^\n]*args: captureWorkerArguments\(/);
    const builder = readFileSync(resolve(HERE, '../worker-arguments.ts'), 'utf8');
    expect(builder).toMatch(/\.\.\.captureWorkerSettingArguments\(CAPTURE_WORKER_PROCESS_SETTINGS\)\]/);
    expect(position(captureWorkerArguments('/x/worker.jsonl'))).toBe(String(SEALING_MAX_FRAGMENT_BYTES));
    expect(readFileSync(resolve(HERE, '../boot/index.ts'), 'utf8')).toMatch(/createProcessLauncher\(\{[^\n]*args: captureWorkerArguments\(/);
    expect(readFileSync(resolve(HERE, '../supervisor.ts'), 'utf8')).not.toMatch(/createProcessLauncher|spawn\(/);
  });
});
