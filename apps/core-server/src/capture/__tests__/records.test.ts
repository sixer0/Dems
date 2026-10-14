// Blueprint row 58 (M3-W2): the lossless record path, check M3-REC-1 (masterplan/10_test_strategy
// §A.3; capture spec §B.2 "REQUIRED WORK for row 58" R-1 to R-3; decision D67), and the three
// findings of the pair-57 re-check that ride with it: N-1 (a listener that calls back into the
// supervisor from one of its own events), N-2 (events of a session that is over), N-3 (warning
// subjects).
//
// Blueprint row 59 (M3-W3) adds, at the end of this file: the version gate of protocol 3 (decision
// D84 R-7), the once-per-camera rule of the KEYFRAME_INTERVAL record, and the two guards of the
// late-record path that no test pinned (pair-58 re-check R-5: navigator mutations NB and NC).
//
// On a FakeWorkerProcess with manual timers: nothing here starts a process or waits in real time.
// EVERY RULE HAS ITS CONTROL: the case in which the same measurement must read the opposite.
import { CAPTURE_IPC_DEFAULTS, CAPTURE_PROTOCOL_VERSION, CaptureWarningCode, WorkerMessageType, type CaptureIpcLimits, type CaptureRecord } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import { capturePlan, fakeLauncher, flush, manualCaptureTimers } from '../../../test/support/capture';
import { CapturePhase, WorkerDownCode, createCaptureSupervisor, type CaptureEvent, type CaptureReport, type WorkerChannelHandlers, type WorkerLauncher } from '../index';

const SESSION = 'S-TEST-0001';
const LIMITS = CAPTURE_IPC_DEFAULTS;
const never = (): Promise<void> => new Promise<void>(() => {});
const sha = (digit: string): string => digit.repeat(64);
const checkpoint = (index: number, deviceId = 'CAM-01'): CaptureRecord => ({
  kind: 'FRAGMENT_CHECKPOINT',
  deviceId,
  index,
  start: index * 1_000,
  len: 1_000,
  fragSha256: sha('a'),
  chainSha256: sha('b'),
  prefixSha256: sha('c'),
  plaintextSha256: sha('a'),
  plaintextChainSha256: sha('b'),
  mediaStartMs: (index - 1) * 2_000,
  mediaDurationMs: 2_000,
  keyframe: true,
  durableAt: 1_791_529_000_000 + index,
  gcmIv: null,
  gcmTag: null,
  keyId: null,
});

async function recording(limits: Partial<CaptureIpcLimits> = {}) {
  const clock = manualCaptureTimers();
  const fake = fakeLauncher();
  const reports: CaptureReport[] = [];
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits, report: (entry) => void reports.push(entry) });
  await supervisor.boot();
  await supervisor.start(SESSION, capturePlan(SESSION));
  return { clock, fake, supervisor, reports };
}

describe('M3-REC-1 (a): every record carries the next sequence number of its session', () => {
  it('records are handed on at once, in order, with their sequence number, and the session is durable from the first', async () => {
    const { supervisor, fake } = await recording();
    const seen: string[] = [];
    supervisor.on('record', (event) => void seen.push(`${event.seq} ${event.record.kind} ${event.sessionId}`));
    expect(supervisor.status()).toMatchObject({ durable: false, lastRecordSeq: 0 });
    fake.last().firstDurableFragment('CAM-01');
    // Synchronously: no queue, no turn of the event loop between the frame and the listener.
    expect(seen).toEqual([`1 FIRST_DURABLE_FRAGMENT ${SESSION}`]);
    fake.last().firstDurableFragment('CAM-02');
    fake.last().record(checkpoint(1));
    fake.last().record({ kind: 'SEAL_COMPLETE' });
    expect(seen.map((line) => line.split(' ').slice(0, 2).join(' '))).toEqual(['1 FIRST_DURABLE_FRAGMENT', '2 FIRST_DURABLE_FRAGMENT', '3 FRAGMENT_CHECKPOINT', '4 SEAL_COMPLETE']);
    expect(supervisor.status()).toMatchObject({ durable: true, lastRecordSeq: 4, phase: CapturePhase.RECORDING, lastCrash: null });
    expect(fake.last().kills).toEqual([]);
  });

  it('the first video sample is a record too, but no sign of durability: a session is durable from its first FRAGMENT record', async () => {
    const { supervisor, fake, clock } = await recording();
    const seen: string[] = [];
    supervisor.on('record', (event) => void seen.push(`${event.seq} ${event.record.kind}`));
    fake.last().record({ kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'CAM-01', pts: 526_386, timescale: 90_000, skipped: { noTimestamp: 0, beforeAudioStart: 0, noCameraClock: 0, beforeKeyframe: 0 }, skippedSpanMs: 0 });
    expect(supervisor.status()).toMatchObject({ durable: false, lastRecordSeq: 1 });
    // Not durable yet: a crash here is still restarted (CONTROL of the option-C sibling in liveness.test.ts).
    fake.last().exit(1);
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(fake.calls()).toBe(2);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2, durable: false, lastRecordSeq: 0 });
    // The new worker is a new process: it counts its own records from 1 (it cannot know the old one's).
    fake.last().record({ kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'CAM-01', pts: 90_000, timescale: 90_000, skipped: { noTimestamp: 0, beforeAudioStart: 0, noCameraClock: 0, beforeKeyframe: 0 }, skippedSpanMs: 0 });
    fake.last().record({ kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'CAM-01', bytes: 5_131 });
    expect(seen).toEqual(['1 FIRST_VIDEO_SAMPLE', '1 FIRST_VIDEO_SAMPLE', '2 FIRST_DURABLE_FRAGMENT']);
    expect(supervisor.status()).toMatchObject({ durable: true, lastRecordSeq: 2, lastCrash: { attempt: 1 } });
    // From here the session has one worker for good, and its fragment records are one sequence.
    fake.last().record({ kind: 'SEAL_COMPLETE' }, 2);
    expect(supervisor.status().lastCrash).toMatchObject({ detail: 'RECORD_SEQUENCE_GAP', attempt: 2 });
  });

  it.each([
    ['a gap (1, then 3)', [1, 3]],
    ['a repeat (1, then 1)', [1, 1]],
    ['a first record that is not 1', [2]],
    ['a step back (1, 2, then 1)', [1, 2, 1]],
  ])('%s is a PROTOCOL_VIOLATION: the worker is ended, the record is not handed on, and the session is FAULTED, not restarted', async (_label, sequence) => {
    const { supervisor, fake, clock } = await recording();
    const seen: number[] = [];
    supervisor.on('record', (event) => void seen.push(event.seq));
    for (const seq of sequence) fake.last().record(checkpoint(seq), seq);
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'RECORD_SEQUENCE_GAP' });
    expect(fake.last().kills).toEqual(['SIGKILL']);
    // Only the records before the break were handed on.
    expect(seen).toEqual(sequence.slice(0, -1).filter((seq, index) => seq === index + 1));
    // A worker that reported a fragment has written: option C, no restart, whatever the sequence said.
    clock.advance(LIMITS.backoffMaxMs * 10);
    await flush();
    expect(fake.calls()).toBe(1);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, durable: true });
  });

  it('CONTROL: the same four records numbered 1, 2, 3, 4 end nobody', async () => {
    const { supervisor, fake } = await recording();
    for (const seq of [1, 2, 3, 4]) fake.last().record(checkpoint(seq), seq);
    expect(supervisor.status()).toMatchObject({ lastCrash: null, lastRecordSeq: 4, phase: CapturePhase.RECORDING });
  });

  it('a record about a device that is no camera of the plan, and a record before START was acknowledged, are violations too', async () => {
    const foreign = await recording();
    foreign.fake.last().firstDurableFragment('MIC-01');
    expect(foreign.supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'RECORD_SUBJECT_UNKNOWN' });

    const clock = manualCaptureTimers();
    const fake = fakeLauncher({ ackStart: false });
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    await supervisor.boot();
    void supervisor.start(SESSION, capturePlan(SESSION)).catch(() => {});
    await flush();
    fake.last().firstDurableFragment('CAM-01');
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'RECORD_BEFORE_START' });
  });
});

describe('M3-REC-1 (b): no record is dropped or reordered under a flooded queue of levels', () => {
  it('with the queue at its bound, a stuck listener of levels and thousands of evictions, every record arrives, in order', async () => {
    const { supervisor, fake, reports, clock } = await recording({ eventQueueLimit: 8 });
    // The listeners of the levels never return: the queue fills and stays full.
    supervisor.on('telemetry', never);
    supervisor.on('progress', never);
    supervisor.on('warning', never);
    const seqs: number[] = [];
    supervisor.on('record', (event) => void seqs.push(event.seq));
    const worker = fake.last();
    let most = 0;
    let sent = 0;
    for (let round = 0; round < 500; round += 1) {
      worker.telemetry(round);
      for (let step = 0; step < 4; step += 1) worker.progress(`R${round}S${step}`, 0);
      if (round % 10 === 0) worker.warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
      // A record in the middle of every round of the flood.
      worker.record(round === 0 ? { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'CAM-01', bytes: 5_131 } : checkpoint(round));
      sent += 1;
      // Ten records a second: above the contract rate, far below the ceiling (fix round 1, A-5).
      clock.advance(100);
      worker.heartbeat();
      most = Math.max(most, supervisor.status().queuedEvents);
    }
    const status = supervisor.status();
    // The flood was real: the queue stood at its bound and levels were lost, counted and reported once.
    expect(most).toBe(8);
    expect(status.queuedEvents).toBe(8);
    expect(status.droppedEvents).toBeGreaterThan(1_900);
    expect(status.droppedTelemetry).toBeGreaterThan(400);
    expect(reports.filter((entry) => entry.code === 'CAPTURE_EVENT_OVERFLOW')).toHaveLength(1);
    // And not one record was: all 500, in their order, each handed on the moment it arrived.
    expect(sent).toBe(500);
    expect(seqs).toEqual(Array.from({ length: 500 }, (_unused, index) => index + 1));
    expect(status).toMatchObject({ lastRecordSeq: 500, lastCrash: null, phase: CapturePhase.RECORDING });
  });

  it('CONTROL: the SAME flood loses progress values that travel as levels, so the count above can read less than everything', async () => {
    const { supervisor, fake } = await recording({ eventQueueLimit: 8 });
    const steps: string[] = [];
    let release: () => void = () => {};
    supervisor.on('progress', (event) => {
      steps.push(event.frame.step);
      if (steps.length === 1) return new Promise<void>((resolve) => (release = resolve));
      return undefined;
    });
    for (let round = 0; round < 500; round += 1) fake.last().progress(`R${round}`, 0);
    release();
    await flush();
    expect(steps.length).toBeLessThan(500);
    expect(steps.length).toBe(1 + 8);
  });
});

describe('M3-REC-1 (c): completion of sealing is the seal-completion record, never a progress value', () => {
  it('the final PROGRESS (progress 1) is evicted by the flood and never delivered; SEAL_COMPLETE still arrives', async () => {
    const { supervisor, fake } = await recording({ eventQueueLimit: 4 });
    const progress: string[] = [];
    let release: () => void = () => {};
    supervisor.on('progress', (event) => {
      progress.push(`${event.frame.step}:${event.frame.progress}`);
      if (progress.length === 1) return new Promise<void>((resolve) => (release = resolve));
      return undefined;
    });
    const records: string[] = [];
    supervisor.on('record', (event) => void records.push(event.record.kind));
    const worker = fake.last();
    worker.progress('HOLD', 0); // with the listener, which holds it
    worker.progress('SEAL', 1); // the final value of sealing: waits in the queue
    for (let step = 0; step < 50; step += 1) worker.progress(`LATER${step}`, 0.5); // evicts it
    worker.record({ kind: 'SEAL_COMPLETE' });
    expect(records).toEqual(['SEAL_COMPLETE']);
    release();
    await flush();
    expect(progress).not.toContain('SEAL:1');
    expect(progress).toHaveLength(1 + 4);
    expect(records).toEqual(['SEAL_COMPLETE']);
  });

  it('a progress value of 1 raises no record: nothing in the supervisor reads completion from a level', async () => {
    const { supervisor, fake } = await recording();
    const events: Array<CaptureEvent['name']> = [];
    for (const name of ['record', 'progress'] as const) supervisor.on(name, (event) => void events.push(event.name));
    fake.last().progress('SEAL', 1);
    await flush();
    expect(events).toEqual(['progress']);
    expect(supervisor.status()).toMatchObject({ durable: false, lastRecordSeq: 0 });
  });
});

describe('N-1: a listener that calls back into the supervisor from one of its own events', () => {
  it('stop() from the CAPTURE_FAULT listener (what a sessions module does to seal the durable prefix) leaves IDLE, not FAULTED', async () => {
    const { supervisor, fake, clock } = await recording({ maxRestarts: 0 });
    const phases: string[] = [];
    supervisor.on('phase', (event) => void phases.push(`${event.previous}>${event.phase}`));
    let stopped: Promise<unknown> | null = null;
    supervisor.on('warning', (event) => {
      if (event.source === 'supervisor' && event.state === 'ACTIVE') stopped = supervisor.stop(SESSION, 'CRASH');
    });
    fake.last().exit(1);
    await stopped;
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, sessionId: null });
    // The phases are a chain: each event's `previous` is the phase of the event before it.
    expect(phases).toEqual(['RECORDING>FAULTED', 'FAULTED>STOPPING', 'STOPPING>IDLE']);
    expect(clock.armed()).toEqual([]);
    // The next session starts from IDLE.
    await supervisor.start(SESSION, capturePlan(SESSION));
    expect(phases.slice(3)).toEqual(['IDLE>STARTING', 'STARTING>RECORDING']);
  });

  it('stop() from the workerDown listener cancels the restart: IDLE, no timer armed, no second worker (it stood at RESTARTING for ever)', async () => {
    const { supervisor, fake, clock } = await recording();
    let stopped: Promise<unknown> | null = null;
    supervisor.on('workerDown', () => {
      stopped = supervisor.stop(SESSION, 'CRASH');
    });
    fake.last().exit(1);
    await stopped;
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, sessionId: null });
    expect(clock.armed()).toEqual([]);
    clock.advance(LIMITS.backoffMaxMs * 10);
    await flush();
    expect(fake.calls()).toBe(1);
  });

  it('a listener sees the supervisor AFTER the step that raised the event: the phase is already the new one, the session is still named', async () => {
    const { supervisor, fake } = await recording({ maxRestarts: 0 });
    const seen: string[] = [];
    supervisor.on('workerDown', () => void seen.push(`down:${supervisor.status().phase}`));
    supervisor.on('warning', () => void seen.push(`warning:${supervisor.status().phase}`));
    supervisor.on('phase', (event) => void seen.push(`phase ${event.phase}:${supervisor.status().phase}:${supervisor.status().sessionId}`));
    fake.last().exit(1);
    expect(seen).toEqual(['down:FAULTED', 'warning:FAULTED', `phase FAULTED:FAULTED:${SESSION}`]);
  });

  it('start() from the listener of the last phase of a session opens the next session at once, on a clean supervisor', async () => {
    const { supervisor, fake } = await recording();
    let next: Promise<void> | null = null;
    supervisor.on('phase', (event) => {
      if (event.phase === CapturePhase.IDLE && next === null) next = supervisor.start('S-TEST-0002', capturePlan('S-TEST-0002'));
    });
    await supervisor.stop(SESSION, 'STOPPED');
    await next;
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, sessionId: 'S-TEST-0002', attempt: 1 });
    expect(fake.workers).toHaveLength(2);
  });
});

describe('N-2: the worker events of a session that is over are not delivered into the next one', () => {
  it('what still waits when the session ends is dropped and counted; the next session receives only its own events', async () => {
    const { supervisor, fake } = await recording();
    const delivered: string[] = [];
    let release: () => void = () => {};
    supervisor.on('progress', (event) => {
      delivered.push(`${event.sessionId} ${event.frame.step}`);
      if (delivered.length === 1) return new Promise<void>((resolve) => (release = resolve));
      return undefined;
    });
    supervisor.on('warning', (event) => void delivered.push(`${event.sessionId} ${event.code}`));
    fake.last().progress('A', 0); // with the listener
    fake.last().progress('B', 0);
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    fake.last().telemetry(1);
    expect(supervisor.status()).toMatchObject({ queuedEvents: 3, droppedEvents: 0, droppedTelemetry: 0 });

    await supervisor.stop(SESSION, 'STOPPED');
    expect(supervisor.status()).toMatchObject({ queuedEvents: 0, droppedEvents: 2, droppedTelemetry: 1 });
    await supervisor.start('S-TEST-0002', capturePlan('S-TEST-0002'));
    fake.last().progress('C', 0);
    release();
    await flush();
    expect(delivered).toEqual([`${SESSION} A`, 'S-TEST-0002 C']);
  });

  it('CONTROL: without the end of the session the same three events ARE delivered', async () => {
    const { supervisor, fake } = await recording();
    const delivered: string[] = [];
    let release: () => void = () => {};
    supervisor.on('progress', (event) => {
      delivered.push(event.frame.step);
      if (delivered.length === 1) return new Promise<void>((resolve) => (release = resolve));
      return undefined;
    });
    supervisor.on('warning', (event) => void delivered.push(event.code));
    supervisor.on('telemetry', () => void delivered.push('T'));
    fake.last().progress('A', 0);
    fake.last().progress('B', 0);
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    fake.last().telemetry(1);
    release();
    await flush();
    expect(delivered).toEqual(['A', 'B', 'MIC_SILENT', 'T']);
  });
});

describe('N-3: a warning of the worker is about a device of the plan (protocol 4: never a mic role, never nothing; D84 R-1, R-2)', () => {
  it.each(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'])('the subject %s is handed on', async (subject) => {
    const { supervisor, fake } = await recording();
    const seen: Array<string | null> = [];
    supervisor.on('warning', (event) => void seen.push(event.subject));
    fake.last().warning(CaptureWarningCode.CAPTURE_FAULT, subject);
    await flush();
    expect(seen).toEqual([subject]);
    expect(supervisor.status().lastCrash).toBeNull();
  });

  it.each(['CAM-03', 'worker', 'primary', 'PRIMARY', 'STANDBY', 'rtsp', 'S-TEST-0001', ' '])('the subject %j is a PROTOCOL_VIOLATION: the worker is ended and nothing is queued', async (subject) => {
    const { supervisor, fake } = await recording();
    const seen: unknown[] = [];
    supervisor.on('warning', (event) => void seen.push(event.subject));
    fake.last().warning(CaptureWarningCode.MIC_SILENT, subject);
    await flush();
    expect(seen).toEqual([]);
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'WARNING_SUBJECT_UNKNOWN' });
    expect(fake.workers[0]?.kills).toEqual(['SIGKILL']);
  });

  it('a worker that invents subjects cannot fill the queue with warnings: 300 of them queue none (the limit is 256)', async () => {
    const { supervisor, fake } = await recording();
    supervisor.on('warning', never);
    for (let index = 0; index < 300; index += 1) fake.workers[0]?.warning(CaptureWarningCode.MIC_SILENT, `SUBJECT-${index}`);
    expect(supervisor.status().queuedEvents).toBe(0);
  });

  it('a role no mic of the plan holds is no subject either', async () => {
    const clock = manualCaptureTimers();
    const fake = fakeLauncher();
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    await supervisor.boot();
    const plan = capturePlan(SESSION);
    await supervisor.start(SESSION, { ...plan, mics: [plan.mics[0]!] });
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-02');
    expect(supervisor.status().lastCrash).toMatchObject({ detail: 'WARNING_SUBJECT_UNKNOWN' });
  });
});

// ── Fix round 1 (navigator findings A-5, A-6, A-7, A-8, A-10; decision D72) ────────────────────

describe('A-5: the record path has a ceiling, so a record flood cannot grow memory', () => {
  it('64 records inside one second are taken; the 65th is a PROTOCOL_VIOLATION: worker ended, session FAULTED, not one record more handed on', async () => {
    const { supervisor, fake, clock } = await recording();
    let handed = 0;
    supervisor.on('record', () => void (handed += 1));
    expect([LIMITS.recordBurstLimit, LIMITS.recordWindowMs]).toEqual([64, 1_000]);
    for (let index = 1; index <= 64; index += 1) fake.last().record(checkpoint(index));
    expect(supervisor.status()).toMatchObject({ lastCrash: null, lastRecordSeq: 64 });
    fake.last().record(checkpoint(65));
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'RECORD_RATE_EXCEEDED' });
    expect(fake.last().kills).toEqual(['SIGKILL']);
    // A worker that keeps writing after it was ended (its process has not exited yet) is not listened to.
    for (let index = 66; index <= 100_000; index += 1) fake.workers[0]?.record(checkpoint(index));
    expect(handed).toBe(64);
    clock.advance(LIMITS.backoffMaxMs * 10);
    await flush();
    expect(fake.calls()).toBe(1);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, durable: true });
  });

  it('CONTROL: the same 100 records at 10 a second (five times the contract rate) end nobody', async () => {
    const { supervisor, fake, clock } = await recording();
    for (let index = 1; index <= 100; index += 1) {
      fake.last().record(checkpoint(index));
      clock.advance(100);
      fake.last().heartbeat();
    }
    expect(supervisor.status()).toMatchObject({ lastCrash: null, lastRecordSeq: 100, phase: CapturePhase.RECORDING });
  });
});

describe('A-6: a record says which worker of the session wrote it', () => {
  it('the two first-video-sample records of a session whose worker was replaced carry attempt 1 and attempt 2', async () => {
    const { supervisor, fake, clock } = await recording();
    const seen: string[] = [];
    supervisor.on('record', (event) => void seen.push(`attempt ${event.attempt} seq ${event.seq} ${event.record.kind}`));
    fake.last().record({ kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'CAM-01', pts: 526_386, timescale: 90_000, skipped: { noTimestamp: 0, beforeAudioStart: 0, noCameraClock: 0, beforeKeyframe: 0 }, skippedSpanMs: 0 });
    fake.last().exit(1);
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    fake.last().record({ kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'CAM-01', pts: 90_000, timescale: 90_000, skipped: { noTimestamp: 0, beforeAudioStart: 0, noCameraClock: 0, beforeKeyframe: 0 }, skippedSpanMs: 0 });
    expect(seen).toEqual(['attempt 1 seq 1 FIRST_VIDEO_SAMPLE', 'attempt 2 seq 1 FIRST_VIDEO_SAMPLE']);
  });
});

describe('A-10: the content of a record is held to what a worker can truthfully say', () => {
  it.each([
    ['a second FIRST_DURABLE_FRAGMENT of the same camera', [{ kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'CAM-01', bytes: 1 }, { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'CAM-01', bytes: 2 }], 'RECORD_REPEATED'],
    ['a second FIRST_VIDEO_SAMPLE of the same camera', [{ kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'CAM-02', pts: 1, timescale: 90_000, skipped: { noTimestamp: 0, beforeAudioStart: 0, noCameraClock: 0, beforeKeyframe: 0 }, skippedSpanMs: 0 }, { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'CAM-02', pts: 2, timescale: 90_000, skipped: { noTimestamp: 0, beforeAudioStart: 0, noCameraClock: 0, beforeKeyframe: 0 }, skippedSpanMs: 0 }], 'RECORD_REPEATED'],
    ['a record after SEAL_COMPLETE', [{ kind: 'SEAL_COMPLETE' }, { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'CAM-01', bytes: 1 }], 'RECORD_AFTER_SEAL'],
    ['a second SEAL_COMPLETE', [{ kind: 'SEAL_COMPLETE' }, { kind: 'SEAL_COMPLETE' }], 'RECORD_AFTER_SEAL'],
  ] as const)('%s is a PROTOCOL_VIOLATION and is not handed on', async (_label, records, detail) => {
    const { supervisor, fake } = await recording();
    const seen: number[] = [];
    supervisor.on('record', (event) => void seen.push(event.seq));
    for (const record of records) fake.last().record(record as CaptureRecord);
    expect(seen).toEqual([1]);
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail });
  });

  it('CONTROL: the same first records for the two different cameras, then the seal, end nobody', async () => {
    const { supervisor, fake } = await recording();
    fake.last().firstDurableFragment('CAM-01');
    fake.last().firstDurableFragment('CAM-02');
    fake.last().record({ kind: 'SEAL_COMPLETE' });
    expect(supervisor.status()).toMatchObject({ lastCrash: null, lastRecordSeq: 3 });
  });
});

describe('A-7: a refused START is asked again only when the answer can change', () => {
  it.each(['PLAN_INVALID', 'PLAN_UNSUPPORTED', 'OUTPUT_DIR_MISSING', 'MIC_INPUT_NOT_FIFO', 'TAP_PATH_OCCUPIED', 'SESSION_ALREADY_SERVED', 'OUTPUT_EXISTS'])('%s: one worker, no retry, the start is refused at once with CAPTURE_FAULT', async (code) => {
    const clock = manualCaptureTimers();
    const fake = fakeLauncher({ ackStart: code });
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    await supervisor.boot();
    await expect(supervisor.start(SESSION, capturePlan(SESSION))).rejects.toMatchObject({ code: 'CAPTURE_FAULT', detail: WorkerDownCode.START_REFUSED });
    expect(fake.calls()).toBe(1);
    expect(clock.armed()).toEqual([]);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, lastCrash: { detail: code } });
  });

  it('CONTROL: a refusal that can change (NO_DEVICE) is asked again, up to the limit', async () => {
    const clock = manualCaptureTimers();
    const fake = fakeLauncher({ ackStart: 'NO_DEVICE' });
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits: { maxRestarts: 2 } });
    await supervisor.boot();
    const starting = supervisor.start(SESSION, capturePlan(SESSION)).catch(() => 'refused');
    for (let turn = 0; turn < 3; turn += 1) {
      await flush();
      clock.advance(LIMITS.backoffMaxMs);
    }
    expect(await starting).toBe('refused');
    expect(fake.calls()).toBe(3);
  });

  it('a crash a new worker would repeat (NO_CAMERA_CONNECTED, decision D72(k)) is not retried: FAULTED, one CAPTURE_FAULT; CONTROL: any other crash code is', async () => {
    const final = await recording();
    const faults: string[] = [];
    final.supervisor.on('warning', (event) => void faults.push(`${event.code} ${event.state}`));
    final.fake.last().say({ type: 'CRASH', code: 'NO_CAMERA_CONNECTED', signal: null, exitCode: 70 });
    final.clock.advance(LIMITS.backoffMaxMs * 10);
    await flush();
    expect(final.fake.calls()).toBe(1);
    expect(final.supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, durable: false, lastCrash: { code: WorkerDownCode.EXITED, detail: 'NO_CAMERA_CONNECTED' } });
    expect(faults).toEqual(['CAPTURE_FAULT ACTIVE']);

    const other = await recording();
    other.fake.last().say({ type: 'CRASH', code: 'ENCODER_SEND_FAILED', signal: null, exitCode: 70 });
    other.clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(other.fake.calls()).toBe(2);
  });
});

describe('A-8: the lines of a worker the supervisor ended', () => {
  /** A worker that was ended by the heartbeat watchdog and whose process has not exited yet: its last lines still arrive. */
  async function ended() {
    const clock = manualCaptureTimers();
    const fake = fakeLauncher({ exitOnKill: false });
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    const seen: string[] = [];
    for (const name of ['telemetry', 'progress', 'warning', 'record'] as const) supervisor.on(name, (event) => void seen.push(event.name === 'warning' ? `warning ${event.source} ${event.state}` : event.name));
    await supervisor.boot();
    await supervisor.start(SESSION, capturePlan(SESSION));
    clock.advance(LIMITS.heartbeatTimeoutMs);
    expect(fake.last().kills).toEqual(['SIGKILL']);
    expect(supervisor.status().phase).toBe(CapturePhase.RESTARTING);
    return { clock, fake, supervisor, seen };
  }

  it('nothing of them is handed on and nothing of them counts: no telemetry, no warning, no record, no heartbeat, no second down', async () => {
    const { fake, supervisor, seen } = await ended();
    const late = fake.last();
    late.telemetry(1);
    late.progress('SEAL', 1);
    late.warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    late.record({ kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'CAM-01', pts: 1, timescale: 90_000, skipped: { noTimestamp: 0, beforeAudioStart: 0, noCameraClock: 0, beforeKeyframe: 0 }, skippedSpanMs: 0 });
    late.heartbeat();
    late.violate('FRAME_NOT_JSON');
    await flush();
    expect(seen).toEqual([]);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RESTARTING, durable: false, lastRecordSeq: 0, queuedEvents: 0, heartbeatAgeMs: null, lastCrash: { code: WorkerDownCode.HEARTBEAT_TIMEOUT } });
  });

  it('ONE fact is taken from them: a fragment record means bytes are on the disk, so the waiting restart is called off (FAULTED, one CAPTURE_FAULT, no second worker)', async () => {
    const { fake, supervisor, seen, clock } = await ended();
    fake.last().firstDurableFragment('CAM-01');
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, durable: true, lastRecordSeq: 0 });
    expect(clock.armed()).toEqual([]);
    fake.last().exit(null, 'SIGKILL');
    clock.advance(LIMITS.backoffMaxMs * 10);
    await flush();
    expect(fake.calls()).toBe(1);
    // The record itself is not handed on (its sequence was never checked); the fault is said once.
    expect(seen).toEqual(['warning supervisor ACTIVE']);
  });

  it('CONTROL: without that late record the same session IS given a second worker once the first has exited', async () => {
    const { fake, supervisor, clock } = await ended();
    fake.last().exit(null, 'SIGKILL');
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(fake.calls()).toBe(2);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2 });
  });
});

describe('D72 (A-2): the supervisor\'s own CAPTURE_FAULT ends when a later session records', () => {
  it('the fault of a failed session is said CLEARED when the next session reaches RECORDING, once; a second failure is a new ACTIVE', async () => {
    const { supervisor, fake } = await recording({ maxRestarts: 0 });
    const said: string[] = [];
    supervisor.on('warning', (event) => void said.push(`${event.sessionId} ${event.code} ${event.state} ${event.source}`));
    fake.last().exit(1);
    await supervisor.stop(SESSION, 'CRASH');
    expect(said).toEqual([`${SESSION} CAPTURE_FAULT ACTIVE supervisor`]);
    await supervisor.start('S-TEST-0002', capturePlan('S-TEST-0002'));
    expect(said).toEqual([`${SESSION} CAPTURE_FAULT ACTIVE supervisor`, `${SESSION} CAPTURE_FAULT CLEARED supervisor`]);
    await supervisor.stop('S-TEST-0002', 'STOPPED');
    await supervisor.start('S-TEST-0003', capturePlan('S-TEST-0003'));
    expect(said).toHaveLength(2);
    fake.last().exit(1);
    expect(said.at(-1)).toBe('S-TEST-0003 CAPTURE_FAULT ACTIVE supervisor');
  });
});

// ── Blueprint row 59 ───────────────────────────────────────────────────────────────────────────

describe('row 59: protocol version 5 is a gate at HELLO (decision D84 R-7)', () => {
  it('the supervisor speaks version 5, and a worker that says 3 (the worker before the checkpoint content) is refused at HELLO and not started again', async () => {
    expect(CAPTURE_PROTOCOL_VERSION).toBe(5);
    const clock = manualCaptureTimers();
    const fake = fakeLauncher({ protocolVersion: 2 });
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    await supervisor.boot();
    await expect(supervisor.start(SESSION, capturePlan(SESSION))).rejects.toMatchObject({ code: 'CAPTURE_FAULT', detail: WorkerDownCode.PROTOCOL_MISMATCH });
    // Not one command was written to it (no plan reaches a worker of another version), and no second worker follows.
    expect(fake.last().received).toEqual([]);
    clock.advance(LIMITS.backoffMaxMs * 10);
    await flush();
    expect(fake.calls()).toBe(1);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, lastCrash: { code: WorkerDownCode.PROTOCOL_MISMATCH, detail: 'V2' } });
  });

  it('CONTROL: the same start with a worker that says 5 records, and its START carries version 5', async () => {
    const { supervisor, fake } = await recording();
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, lastCrash: null });
    expect(fake.last().commands('START')[0]).toMatchObject({ v: 5, attempt: 1 });
  });
});

describe('row 59: the observed keyframe interval is a record of its own, once per camera', () => {
  const interval = (deviceId: string, observedMs: number): CaptureRecord => ({ kind: 'KEYFRAME_INTERVAL', deviceId, observedMs, boundMs: 2_000, intervals: 1, complete: true, aboveBound: observedMs > 2_100 });

  it('it is handed on at once with its number, and it is no sign of durability: a crash after it is still restarted', async () => {
    const { supervisor, fake, clock } = await recording();
    const seen: CaptureRecord[] = [];
    supervisor.on('record', (event) => void seen.push(event.record));
    fake.last().record(interval('CAM-01', 5_000));
    fake.last().record(interval('CAM-02', 1_000));
    expect(seen).toEqual([interval('CAM-01', 5_000), interval('CAM-02', 1_000)]);
    expect(supervisor.status()).toMatchObject({ durable: false, lastRecordSeq: 2, lastCrash: null });
    fake.last().exit(1);
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(fake.calls()).toBe(2);
  });

  it('a second one of the same camera is a PROTOCOL_VIOLATION (RECORD_REPEATED); CONTROL: one for the other camera is not', async () => {
    const { supervisor, fake } = await recording();
    fake.last().record(interval('CAM-01', 5_000));
    fake.last().record(interval('CAM-02', 5_000));
    expect(supervisor.status().lastCrash).toBeNull();
    fake.last().record(interval('CAM-01', 5_100));
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'RECORD_REPEATED' });
  });

  it('a checkpoint is NOT once-only: fragment after fragment of one camera is taken', async () => {
    const { supervisor, fake } = await recording();
    for (let index = 1; index <= 5; index += 1) fake.last().record(checkpoint(index));
    expect(supervisor.status()).toMatchObject({ lastCrash: null, lastRecordSeq: 5, durable: true });
  });
});

describe('row 59 (pair-58 re-check R-5): the two guards of the late-record path', () => {
  /** A launcher that also keeps what each worker reports through, so that a line can arrive after the fake's own exit. */
  function tapped() {
    const clock = manualCaptureTimers();
    const fake = fakeLauncher();
    const lines: WorkerChannelHandlers[] = [];
    const launcher: WorkerLauncher = (launch, handlers) => {
      lines.push(handlers);
      return fake.launcher(launch, handlers);
    };
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher });
    return { clock, fake, lines, supervisor };
  }
  const durableLine = (sessionId: string) => ({ v: CAPTURE_PROTOCOL_VERSION, type: WorkerMessageType.RECORD, sessionId, seq: 1, record: { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'CAM-01', bytes: 5_131 } }) as const;

  it('guard 1 (NB): a durable record from the dying worker of ANOTHER session does not mark this session durable and does not call its restart off', async () => {
    const { clock, fake, lines, supervisor } = tapped();
    await supervisor.boot();
    await supervisor.start(SESSION, capturePlan(SESSION));
    await supervisor.stop(SESSION, 'STOPPED');
    await supervisor.start('S-TEST-0002', capturePlan('S-TEST-0002'));
    // The second session's worker goes down before any fragment: a restart is waiting.
    fake.last().exit(1);
    expect(supervisor.status()).toMatchObject({ sessionId: 'S-TEST-0002', phase: CapturePhase.RESTARTING, durable: false });
    // A last line of the FIRST session's worker arrives now (it was started and acknowledged, in its own session).
    lines[0]?.message(durableLine(SESSION));
    expect(supervisor.status()).toMatchObject({ sessionId: 'S-TEST-0002', phase: CapturePhase.RESTARTING, durable: false });
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(fake.calls()).toBe(3);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2, durable: false });
  });

  it('CONTROL for guard 1: the same line from the session\'s OWN ended worker does call the restart off (FAULTED, durable)', async () => {
    const { clock, fake, lines, supervisor } = tapped();
    await supervisor.boot();
    await supervisor.start(SESSION, capturePlan(SESSION));
    await supervisor.stop(SESSION, 'STOPPED');
    await supervisor.start('S-TEST-0002', capturePlan('S-TEST-0002'));
    fake.last().exit(1);
    lines[1]?.message(durableLine('S-TEST-0002'));
    expect(supervisor.status()).toMatchObject({ sessionId: 'S-TEST-0002', phase: CapturePhase.FAULTED, durable: true });
    clock.advance(LIMITS.backoffMaxMs * 10);
    await flush();
    expect(fake.calls()).toBe(2);
  });

  it('guard 2 (NC): a durable record from a worker whose START was never acknowledged marks nothing durable; the session is still restarted after a later crash', async () => {
    const clock = manualCaptureTimers();
    const fake = fakeLauncher({ ackStart: false, exitOnKill: false });
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    await supervisor.boot();
    const starting = supervisor.start(SESSION, capturePlan(SESSION));
    await flush();
    // START is never answered (and no heartbeat follows): the worker is ended before it ever started
    // (its process has not exited yet) and a restart waits.
    clock.advance(LIMITS.heartbeatTimeoutMs);
    expect(fake.last().kills).toEqual(['SIGKILL']);
    expect(fake.last().commands('START')).toHaveLength(1);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.STARTING, durable: false, lastCrash: { code: WorkerDownCode.HEARTBEAT_TIMEOUT, attempt: 1 } });
    // Its last line claims a fragment. It never started: it wrote nothing.
    fake.last().firstDurableFragment('CAM-01');
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.STARTING, durable: false });
    // The next worker starts and records; when IT goes down before a fragment, the session is restarted again
    // (a session marked durable by the line above would go to FAULTED here).
    fake.behaviour.ackStart = true;
    fake.behaviour.exitOnKill = true;
    fake.last().exit(null, 'SIGKILL');
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    await starting;
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2, durable: false });
    fake.last().exit(1);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RESTARTING, durable: false });
    clock.advance(LIMITS.backoffBaseMs * LIMITS.backoffFactor);       // the second restart of the row
    await flush();
    expect(fake.calls()).toBe(3);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 3, durable: false });
  });

  it('CONTROL for guard 2: the same line from a worker that WAS started and then ended is taken (A-8)', async () => {
    const clock = manualCaptureTimers();
    const fake = fakeLauncher({ exitOnKill: false });
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    await supervisor.boot();
    await supervisor.start(SESSION, capturePlan(SESSION));
    clock.advance(LIMITS.heartbeatTimeoutMs);
    fake.last().firstDurableFragment('CAM-01');
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, durable: true });
  });
});
