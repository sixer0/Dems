// A hostile flood during RECORDING (blueprint row 131; check M4-SEC-DISC-3; security review
// SEC35-29; decision D86 C-4). With M4-SEC-DISC-1 this is one of the two results that row 132 needs
// before the 409 on a search during RECORDING may be lifted.
//
// The capture supervisor runs a session on a FakeWorkerProcess that keeps writing fragment
// checkpoints while searches are started THROUGH THE ADAPTER (the test harness; the API gate of
// M4-DISC-REC-1 (a) is row 132's and stays in force). The searches meet every hostile answer of
// the stub (ST-2) and a reader that throws on every datagram. Loopback only, behind the guard.
//
// It is the Core's half in ONE process: the supervisor and the search share this process, which is
// what a thrown exception would end. The real worker and the database are not part of it.
import { randomUUID } from 'node:crypto';
import { CaptureWarningCode, type CaptureRecord } from '@dems/capture-protocol';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { capturePlan, fakeLauncher, manualCaptureTimers } from '../../../../../test/support/capture';
import type { FakeOnvifDiscoveryMode, FakeOnvifStub } from '../../../../../test/support/fake-onvif-stub';
import { CapturePhase, createCaptureSupervisor, type CaptureEvent } from '../../../index';
import { createSystemTimers } from '../../../timers';
import { createOnvifDiscoveryAdapter } from '../onvif-discovery';
import type { WsDiscoveryOptions } from '../ws-discovery';
import { delay, installLoopbackGuard, startFakeOnvif, until, type LoopbackGuard } from './support';

const SESSION = 'S-TEST-0131';
const HOSTILE: readonly FakeOnvifDiscoveryMode[] = ['WRONG_RELATES_TO', 'FOREIGN_XADDR', 'NO_XADDRS', 'TWO_MATCHES_IN_ONE', 'EMPTY_MATCHES', 'OVERSIZED_BODY', 'ENTITY_EXPANSION', 'NOT_XML', 'FLOOD_300'];
/**
 * A fragment checkpoint as far as this check reads it: its kind, its camera and its index. The
 * other members of the record (hashes, media times) are the worker rows' and are changing in this
 * wave; the supervisor hands a record on by kind, camera and sequence number, which is all that is
 * measured here.
 */
const checkpoint = (index: number): CaptureRecord => ({ kind: 'FRAGMENT_CHECKPOINT', deviceId: 'CAM-01', index, start: index * 1_000, len: 1_000 }) as unknown as CaptureRecord;

/** The analyser: are the fragment indexes 1..n with none missing and none twice, and the record sequence numbers the same? */
function contiguous(records: readonly { readonly seq: number; readonly index: number }[]): boolean {
  return records.every((record, at) => record.index === at + 1) && records.every((record, at) => record.seq === (records[0]?.seq ?? 0) + at);
}

let guard: LoopbackGuard;
let stub: FakeOnvifStub | null = null;
let stopWriting: (() => void) | null = null;

beforeAll(() => {
  guard = installLoopbackGuard();
});
afterAll(() => {
  guard.restore();
});
afterEach(async () => {
  stopWriting?.();
  stopWriting = null;
  await stub?.stop();
  stub = null;
});

async function recordingSession() {
  const clock = manualCaptureTimers();
  const fake = fakeLauncher();
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
  const events: CaptureEvent[] = [];
  for (const name of ['warning', 'phase', 'workerDown'] as const) supervisor.on(name, (event) => void events.push(event));
  const fragments: { seq: number; index: number }[] = [];
  supervisor.on('record', (event) => {
    if (event.record.kind === 'FRAGMENT_CHECKPOINT') fragments.push({ seq: event.seq, index: event.record.index });
  });
  await supervisor.boot();
  await supervisor.start(SESSION, capturePlan(SESSION));
  const worker = fake.last();
  // Every 5 ms of real time the session's clock moves 100 ms and the fake worker says one heartbeat and one
  // fragment checkpoint, for as long as the test lets it (10 records per second of the session's clock: far
  // below the supervisor's record ceiling, which ends a worker that floods).
  let index = 0;
  const writer = setInterval(() => {
    index += 1;
    clock.advance(100);
    worker.heartbeat();
    worker.record(checkpoint(index));
  }, 5);
  stopWriting = () => clearInterval(writer);
  return { supervisor, worker, events, fragments };
}

describe('M4-SEC-DISC-3: a hostile flood during RECORDING', () => {
  it('the session keeps recording: fragments advance contiguously, 0 CAPTURE_FAULT, no worker lost, the same process', async () => {
    const uncaught: unknown[] = [];
    const onUncaught = (error: unknown): void => void uncaught.push(error);
    process.on('uncaughtException', onUncaught);
    process.on('unhandledRejection', onUncaught);
    const pid = process.pid;
    try {
      const { supervisor, worker, events, fragments } = await recordingSession();
      expect(supervisor.status().phase).toBe(CapturePhase.RECORDING);
      await until(() => fragments.length >= 5);
      const running = await startFakeOnvif(1);
      stub = running;
      const search = (more: Partial<WsDiscoveryOptions> = {}) =>
        createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: randomUUID, loopbackFixture: running.addresses().discovery, ...more }).discover({ windowMs: 150, signal: new AbortController().signal });

      let datagrams = 0;
      let handlerErrors = 0;
      for (const mode of HOSTILE) {
        running.setDiscoveryMode(mode);
        const before = fragments.length;
        const result = await search();
        datagrams += result.counts.datagramsReceived;
        // The fragment counter advanced WHILE this search ran.
        expect(fragments.length, mode).toBeGreaterThan(before);
        expect(result.candidates.filter((candidate) => candidate.testable), mode).toEqual([]);
      }
      // The throwing-callback case, on the flood: every datagram's handling throws.
      for (const mode of ['FLOOD_300', 'NORMAL'] as const) {
        running.setDiscoveryMode(mode);
        const before = fragments.length;
        const result = await search({
          read: () => {
            throw new TypeError("Cannot read properties of undefined (reading 'address')");
          },
        });
        handlerErrors += result.counts.handlerErrors;
        expect(fragments.length, mode).toBeGreaterThan(before);
      }
      await delay(20);

      expect(datagrams).toBeGreaterThan(256);
      expect(handlerErrors).toBeGreaterThan(256);
      expect(uncaught).toEqual([]);
      expect(process.pid).toBe(pid);
      expect(contiguous(fragments)).toBe(true);
      expect(fragments.length).toBeGreaterThan(50);
      expect(events.filter((event) => event.name === 'warning' && event.code === CaptureWarningCode.CAPTURE_FAULT)).toEqual([]);
      expect(events.filter((event) => event.name === 'workerDown')).toEqual([]);
      expect(events.filter((event) => event.name === 'phase').map((event) => (event.name === 'phase' ? event.phase : ''))).toEqual([CapturePhase.STARTING, CapturePhase.RECORDING]);
      expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, sessionId: SESSION, workerPid: worker.pid, restarts: 0, lastCrash: null, lastRecordSeq: fragments.length });
      expect(worker.kills).toEqual([]);
      // The session stops cleanly.
      stopWriting?.();
      await supervisor.stop(SESSION, 'STOPPED');
      expect(supervisor.status().phase).toBe(CapturePhase.IDLE);
      expect(guard.refused()).toEqual([]);
      expect(new Set(guard.datagrams())).toEqual(new Set(['127.0.0.1']));
    } finally {
      process.off('uncaughtException', onUncaught);
      process.off('unhandledRejection', onUncaught);
    }
  }, 20_000);

  it('negative control: the same measurements read the opposite when a fragment is missing, when the worker is lost during a search, and when a fault is raised', async () => {
    expect(contiguous([{ seq: 1, index: 1 }, { seq: 2, index: 3 }])).toBe(false);
    expect(contiguous([{ seq: 1, index: 1 }, { seq: 3, index: 2 }])).toBe(false);
    expect(contiguous([{ seq: 1, index: 1 }, { seq: 2, index: 1 }])).toBe(false);
    expect(contiguous([{ seq: 4, index: 1 }, { seq: 5, index: 2 }])).toBe(true);

    const { supervisor, worker, events, fragments } = await recordingSession();
    await until(() => fragments.length >= 3);
    const running = await startFakeOnvif(1);
    stub = running;
    const pending = createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: randomUUID, loopbackFixture: running.addresses().discovery }).discover({ windowMs: 150, signal: new AbortController().signal });
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-01');
    stopWriting?.();
    worker.exit(1);
    await pending;
    // The worker's own fault, and the one the supervisor raises for the lost worker.
    expect(events.filter((event) => event.name === 'warning' && event.code === CaptureWarningCode.CAPTURE_FAULT).length).toBeGreaterThan(0);
    expect(events.filter((event) => event.name === 'workerDown').length).toBeGreaterThan(0);
    expect(supervisor.status().phase).not.toBe(CapturePhase.RECORDING);
    await supervisor.shutdown();
  }, 20_000);
});
