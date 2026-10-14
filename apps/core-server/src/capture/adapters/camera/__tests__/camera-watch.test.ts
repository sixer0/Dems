// The camera watch (task 4 blueprint row 49, WP-06c): loss, presence and clock offset of a
// production camera by the unauthenticated ONVIF time read.
//
// THE DOUBLES. No process, no port, no socket, no clock: the time reader is a function of this
// file whose next answers the test writes; the timer and the Core's clock are manual ones; the
// fault sink records what it was asked. The camera of a test is a candidate at a documentation
// address that nothing contacts.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import type { CaptureTimers } from '../../../types';
import { CaptureAdapterKind } from '../../kinds';
import type { CameraCandidate } from '../../types';
import {
  CAMERA_CLOCK_BOUND_MS,
  CAMERA_PRESENCE_FAILURES,
  CAMERA_PRESENCE_INTERVAL_MS,
  CAMERA_TIME_READ_BOUND_MS,
  CameraPresence,
  createCameraWatch,
  type CameraLossFault,
  type CameraTimeAnswer,
  type CameraWatchChange,
  type CameraWatchDependencies,
  type CameraWatchReport,
} from '../camera-watch';
import type { StoredCameraAddressRule } from '../stored-address';
import { ADMITTED_HOST, REAL_RULE, REFUSED_STORED_ADDRESSES, storedCameraAt } from './stored-address-cases';

const CAMERA_HOST = '192.0.2.49';
/** Row 143: the rule the rig hands in for the cases about something else - it admits this file's ONE camera address and no other. */
/** Row 143c: the address the rule of the rig names as the one a read is made FROM (a documentation address; nothing binds it here). */
const CAMERA_INTERFACE = '192.0.2.1';
const ADMIT_THE_TEST_CAMERA: StoredCameraAddressRule = (host) => (host === CAMERA_HOST ? { allowed: true, destination: { address: host, sourceAddress: CAMERA_INTERFACE } } : { allowed: false, refusal: 'OUTSIDE_CAMERA_SUBNET' });
const CANDIDATE: CameraCandidate = { adapterKind: CaptureAdapterKind.ONVIF_RTSP, host: CAMERA_HOST, serviceAddress: `http://${CAMERA_HOST}/onvif/device_service`, endpointRef: null, vendor: null, model: null, name: null, testable: true, conflict: false };
const CORE_START = 1_800_000_000_000;

const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 30; turn += 1) await Promise.resolve();
};
const outcomeOf = async (pending: Promise<unknown>): Promise<unknown> => pending.then((value) => value, (error: unknown) => error);

interface ManualTimers extends CaptureTimers {
  readonly asked: number[];
  now(): number;
  advance(ms: number): void;
  pending(): number;
}
function manualTimers(): ManualTimers {
  let now = CORE_START;
  const entries: { at: number; callback: () => void; live: boolean }[] = [];
  const asked: number[] = [];
  return {
    asked,
    now: () => now,
    after(delayMs, callback) {
      asked.push(delayMs);
      const entry = { at: now + delayMs, callback, live: true };
      entries.push(entry);
      return () => {
        entry.live = false;
      };
    },
    advance(ms) {
      now += ms;
      for (const entry of entries.slice()) {
        if (entry.live && entry.at <= now) {
          entry.live = false;
          entry.callback();
        }
      }
    },
    pending: () => entries.filter((entry) => entry.live).length,
  };
}

type Script = CameraTimeAnswer | 'SILENT' | 'REFUSE';
interface Rig {
  readonly watch: ReturnType<typeof createCameraWatch>;
  readonly timers: ManualTimers;
  readonly reads: { candidate: CameraCandidate; signal: AbortSignal; from: unknown }[];
  readonly raised: CameraLossFault[];
  readonly cleared: CameraLossFault[];
  readonly changes: CameraWatchChange[];
  readonly reports: CameraWatchReport[];
  /** What the next reads answer, in order; the last entry repeats. */
  script: Script[];
}
const answers = (cameraUtcMs: number | null = null): CameraTimeAnswer => ({ answered: true, cameraUtcMs });
const NOT_ONVIF: CameraTimeAnswer = { answered: false, cameraUtcMs: null };

function rig(patch: Partial<CameraWatchDependencies> = {}): Rig {
  const timers = manualTimers();
  const out: Rig = { watch: undefined as never, timers, reads: [], raised: [], cleared: [], changes: [], reports: [], script: [answers()] };
  const watch = createCameraWatch({
    timers,
    now: () => timers.now(),
    reader: {
      read: (candidate, signal, from) => {
        out.reads.push({ candidate, signal, from });
        const next = out.script.length > 1 ? out.script.shift() : out.script[0];
        if (next === 'REFUSE') return Promise.reject(new Error('refused before any request'));
        if (next === 'SILENT' || next === undefined) return new Promise<CameraTimeAnswer>(() => {});
        return Promise.resolve(next);
      },
    },
    candidate: async (deviceId) => (deviceId === 'CAM-01' || deviceId === 'CAM-02' ? CANDIDATE : null),
    storedAddress: ADMIT_THE_TEST_CAMERA,
    faults: { raise: (fault) => void out.raised.push(fault), clear: (fault) => void out.cleared.push(fault) },
    onChange: (change) => out.changes.push(change),
    report: (report) => out.reports.push(report),
    ...patch,
  });
  return Object.assign(out, { watch });
}

/** One beat of the heartbeat: the interval, and the bound of a read that stays silent. */
async function beat(r: Rig, silent = false): Promise<void> {
  await flush();
  if (silent) {
    r.timers.advance(CAMERA_TIME_READ_BOUND_MS);
    await flush();
    r.timers.advance(CAMERA_PRESENCE_INTERVAL_MS);
  } else r.timers.advance(CAMERA_PRESENCE_INTERVAL_MS);
  await flush();
}

describe('loss: a relay that ended by itself raises ONE fault, a returned push clears it (the row\'s cell)', () => {
  it('a killed fixture raises 1 fault and clears 1: the key is the worker\'s own for a camera that stopped delivering', () => {
    const r = rig();
    r.watch.relayEnded({ deviceId: 'CAM-01', code: 'CAPTURE_CAMERA_STREAM_LOST' });
    expect(r.raised).toEqual([{ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' }]);
    expect(r.cleared).toEqual([]);
    expect(r.watch.lost()).toEqual(['CAM-01']);
    r.watch.pushEstablished({ deviceId: 'CAM-01' });
    expect(r.raised).toHaveLength(1);
    expect(r.cleared).toEqual([{ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' }]);
    expect(r.watch.lost()).toEqual([]);
    expect(r.changes).toEqual([
      { deviceId: 'CAM-01', event: 'STREAM_LOST', cause: 'CAPTURE_CAMERA_STREAM_LOST' },
      { deviceId: 'CAM-01', event: 'STREAM_RETURNED', cause: null },
    ]);
  });

  it('a push of a camera that was never lost clears nothing; a second lost stream of one camera raises nothing more and the fault ends when both are back', () => {
    const r = rig();
    r.watch.pushEstablished({ deviceId: 'CAM-01' });
    expect([r.raised, r.cleared, r.changes]).toEqual([[], [], []]);
    r.watch.relayEnded({ deviceId: 'CAM-01', code: 'CAPTURE_CAMERA_STREAM_LOST' });
    r.watch.relayEnded({ deviceId: 'CAM-01', code: 'CAPTURE_CAMERA_INGEST_LOST' });
    r.watch.relayEnded({ deviceId: 'CAM-02', code: 'CAPTURE_CAMERA_RELAY_FAILED' });
    expect(r.raised.map((fault) => fault.subject)).toEqual(['CAM-01', 'CAM-02']);
    r.watch.pushEstablished({ deviceId: 'CAM-01' });
    expect(r.cleared).toEqual([]);
    r.watch.pushEstablished({ deviceId: 'CAM-01' });
    expect(r.cleared.map((fault) => fault.subject)).toEqual(['CAM-01']);
    expect(r.watch.lost()).toEqual(['CAM-02']);
  });

  it('a cause that is no code word is not passed on; a sink or an observer that throws stops nothing and is reported by a code', async () => {
    const r = rig({
      faults: {
        raise: () => {
          throw new Error('sink');
        },
        clear: () => Promise.reject(new Error('sink')),
      },
      onChange: () => {
        throw new Error('observer');
      },
    });
    r.watch.relayEnded({ deviceId: 'CAM-01', code: `http://${CAMERA_HOST}/` });
    r.watch.pushEstablished({ deviceId: 'CAM-01' });
    await flush();
    // Task 4 row 85c (decision C60 (2)) RE-STATED this line: until then a clear followed the raise that had failed, and its own
    // failure was the fourth report. A raise that failed raised nothing, so no clear is asked for and three reports are left.
    expect(r.reports.map((report) => report.code)).toEqual(['CAMERA_WATCH_SINK_FAILED', 'CAMERA_WATCH_OBSERVER_FAILED', 'CAMERA_WATCH_OBSERVER_FAILED']);
    // A clear that fails after a raise that succeeded is still reported by its code, and stops nothing.
    const clearing = rig({ faults: { raise: () => {}, clear: () => Promise.reject(new Error('sink')) } });
    clearing.watch.relayEnded({ deviceId: 'CAM-01', code: 'CAPTURE_CAMERA_STREAM_LOST' });
    clearing.watch.pushEstablished({ deviceId: 'CAM-01' });
    await flush();
    expect(clearing.reports.map((report) => report.code)).toEqual(['CAMERA_WATCH_SINK_FAILED']);
    expect(clearing.watch.lost()).toEqual([]);
    const plain = rig();
    plain.watch.relayEnded({ deviceId: 'CAM-01', code: `http://${CAMERA_HOST}/` });
    expect(plain.changes).toEqual([{ deviceId: 'CAM-01', event: 'STREAM_LOST', cause: null }]);
  });

  // Task 4 row 85c (decision C60 (2)): the watch clears ONLY the fault it raised itself, when it observes the source back.
  it('row 85c: a raise that FAILED raised nothing - the returned push sends no clear; the change is still told. A raise that succeeded is cleared once, and a second push clears nothing', async () => {
    const calls: string[] = [];
    const state = { failing: 'SYNC' as 'SYNC' | 'ASYNC' | 'NO' };
    const r = rig({
      faults: {
        raise: (fault) => {
          if (state.failing === 'SYNC') throw new Error('sink');
          if (state.failing === 'ASYNC') return Promise.reject(new Error('sink'));
          calls.push(`raise ${fault.subject}`);
        },
        clear: (fault) => void calls.push(`clear ${fault.subject}`),
      },
    });
    // The raise is refused in the turn it is asked: the fault of CAM-01 is not this watch's.
    r.watch.relayEnded({ deviceId: 'CAM-01', code: 'CAPTURE_CAMERA_STREAM_LOST' });
    r.watch.pushEstablished({ deviceId: 'CAM-01' });
    expect(calls).toEqual([]);
    // The raise is refused later (the engine answered no): the same.
    state.failing = 'ASYNC';
    r.watch.relayEnded({ deviceId: 'CAM-02', code: 'CAPTURE_CAMERA_STREAM_LOST' });
    await flush();
    r.watch.pushEstablished({ deviceId: 'CAM-02' });
    await flush();
    expect(calls).toEqual([]);
    expect(r.reports.map((report) => `${report.code} ${report.deviceId}`)).toEqual(['CAMERA_WATCH_SINK_FAILED CAM-01', 'CAMERA_WATCH_SINK_FAILED CAM-02']);
    // What the watch OBSERVED is told whatever the sink did: the loss and the return of both cameras.
    expect(r.changes.map((change) => `${change.event} ${change.deviceId}`)).toEqual(['STREAM_LOST CAM-01', 'STREAM_RETURNED CAM-01', 'STREAM_LOST CAM-02', 'STREAM_RETURNED CAM-02']);
    expect(r.watch.lost()).toEqual([]);
    // A raise that succeeded: ONE clear when the push returns, none for a push after it.
    state.failing = 'NO';
    r.watch.relayEnded({ deviceId: 'CAM-01', code: 'CAPTURE_CAMERA_STREAM_LOST' });
    r.watch.pushEstablished({ deviceId: 'CAM-01' });
    r.watch.pushEstablished({ deviceId: 'CAM-01' });
    expect(calls).toEqual(['raise CAM-01', 'clear CAM-01']);
  });

  it('row 85c: a clear names the camera and the cause the watch raised - never a fault without a cause, never another camera', () => {
    const r = rig();
    r.watch.relayEnded({ deviceId: 'CAM-01', code: 'CAPTURE_CAMERA_STREAM_LOST' });
    r.watch.relayEnded({ deviceId: 'CAM-02', code: 'CAPTURE_CAMERA_STREAM_LOST' });
    r.watch.pushEstablished({ deviceId: 'CAM-02' });
    expect(r.cleared).toEqual([{ code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' }]);
    expect(r.watch.lost()).toEqual(['CAM-01']);
    // `close` ends the heartbeats and clears nothing: a fault that is raised stays what it is.
    r.watch.close();
    expect(r.cleared).toHaveLength(1);
  });
});

// Finding F3-01 of the M3 review: the relay's word about its camera leg inside a session, as the adapter tells it on
// its report source (a report with the member `leg`).
describe('finding F3-01: a camera leg lost inside a session raises the fault at once; its re-open clears the watch\'s own raise', () => {
  const FAULT = { code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' };
  const lost = (deviceId: string, profile: string, attempt = 1, sessionId = 'SES-20261013-0001'): Parameters<Rig['watch']['pushEstablished']>[0] => ({ deviceId, sessionId, attempt, leg: { event: 'LOST', profile, cause: 'CAMERA_LOST' } });
  const back = (deviceId: string, profile: string, attempt = 1, sessionId = 'SES-20261013-0001'): Parameters<Rig['watch']['pushEstablished']>[0] => ({ deviceId, sessionId, attempt, leg: { event: 'REOPENED', profile } });

  it('LOST raises ONE fault of that camera with no timer and no read; REOPENED of that stream clears it; the cause is the relay\'s word', () => {
    const r = rig();
    r.watch.pushEstablished({ deviceId: 'CAM-01', sessionId: 'SES-20261013-0001', attempt: 1 });
    r.watch.pushEstablished(lost('CAM-01', 'HEVC_1080P'));
    expect(r.raised).toEqual([FAULT]);
    expect(r.cleared).toEqual([]);
    expect(r.watch.lost()).toEqual(['CAM-01']);
    expect([r.timers.asked, r.reads]).toEqual([[], []]);
    // Said again: nothing more.
    r.watch.pushEstablished(lost('CAM-01', 'HEVC_1080P'));
    expect(r.raised).toHaveLength(1);
    r.watch.pushEstablished(back('CAM-01', 'HEVC_1080P'));
    expect(r.cleared).toEqual([FAULT]);
    expect(r.watch.lost()).toEqual([]);
    // A second re-open ends nothing more.
    r.watch.pushEstablished(back('CAM-01', 'HEVC_1080P'));
    expect([r.raised.length, r.cleared.length]).toEqual([1, 1]);
    expect(r.changes).toEqual([
      { deviceId: 'CAM-01', event: 'STREAM_LOST', cause: 'CAMERA_LOST' },
      { deviceId: 'CAM-01', event: 'STREAM_RETURNED', cause: null },
    ]);
  });

  it('a leg report is never an established push: it clears no fault of an ended relay, and a re-open of a loss the watch was never told ends nothing', () => {
    const r = rig();
    // The relay of the camera ended by itself: the fault of row 49.
    r.watch.relayEnded({ deviceId: 'CAM-01', code: 'CAPTURE_CAMERA_STREAM_LOST', profile: 'HEVC_1080P' });
    expect(r.raised).toHaveLength(1);
    // A re-open of another stream of that camera, of a loss never told: it is not "a push was established".
    r.watch.pushEstablished(back('CAM-01', 'H264_720P'));
    expect(r.cleared).toEqual([]);
    expect(r.watch.lost()).toEqual(['CAM-01']);
    // A loss of the second stream while the camera is lost already: no second fault; its re-open leaves the first loss standing.
    r.watch.pushEstablished(lost('CAM-01', 'H264_720P'));
    r.watch.pushEstablished(back('CAM-01', 'H264_720P'));
    expect([r.raised.length, r.cleared.length]).toEqual([1, 0]);
    // Only an established push ends the loss of the ended relay.
    r.watch.pushEstablished({ deviceId: 'CAM-01', sessionId: 'SES-20261013-0001', attempt: 2 });
    expect(r.cleared).toEqual([FAULT]);
  });

  it('the relay gives up: its end after a told loss is the SAME absence - no second fault - and the loss then ends as an ended relay\'s does, by the next established push', () => {
    const r = rig();
    r.watch.pushEstablished(lost('CAM-01', 'HEVC_1080P'));
    r.watch.relayEnded({ deviceId: 'CAM-01', code: 'CAPTURE_CAMERA_UNREACHABLE', profile: 'HEVC_1080P' });
    expect([r.raised.length, r.cleared.length]).toEqual([1, 0]);
    // The relay is gone: a re-open in its name ends nothing.
    r.watch.pushEstablished(back('CAM-01', 'HEVC_1080P'));
    expect(r.cleared).toEqual([]);
    r.watch.pushEstablished({ deviceId: 'CAM-01', sessionId: 'SES-20261013-0001', attempt: 2 });
    expect(r.cleared).toEqual([FAULT]);
    expect(r.watch.lost()).toEqual([]);
    expect(r.changes.map((change) => change.event)).toEqual(['STREAM_LOST', 'STREAM_RETURNED']);
  });

  it('a re-open ends only the loss of ITS relay and stream; a relay that was closed with its loss open is ended by the push of a later relay, not by one of the same worker', () => {
    const r = rig();
    r.watch.pushEstablished(lost('CAM-01', 'HEVC_1080P', 1));
    // Another attempt's, another session's, another stream's re-open: nothing.
    r.watch.pushEstablished(back('CAM-01', 'HEVC_1080P', 2));
    r.watch.pushEstablished(back('CAM-01', 'HEVC_1080P', 1, 'SES-20261013-0002'));
    r.watch.pushEstablished(back('CAM-01', 'H264_720P', 1));
    r.watch.pushEstablished(back('CAM-02', 'HEVC_1080P', 1));
    expect(r.cleared).toEqual([]);
    // The second stream of the SAME worker is established while the first is away: the camera is still lost.
    r.watch.pushEstablished({ deviceId: 'CAM-01', sessionId: 'SES-20261013-0001', attempt: 1 });
    expect(r.cleared).toEqual([]);
    expect(r.watch.lost()).toEqual(['CAM-01']);
    // The session closed that relay (a worker restart) and the camera is opened for the next worker: back.
    r.watch.pushEstablished({ deviceId: 'CAM-01', sessionId: 'SES-20261013-0001', attempt: 2 });
    expect(r.cleared).toEqual([FAULT]);
    expect(r.watch.lost()).toEqual([]);
  });

  it('decision C60 (2): a raise that failed is no fault of this watch - the re-open sends no clear; words that are no leg report raise and clear nothing', async () => {
    const r = rig({ faults: { raise: () => Promise.reject(new Error('sink')), clear: (fault) => void r.cleared.push(fault) } });
    r.watch.pushEstablished(lost('CAM-01', 'HEVC_1080P'));
    await flush();
    r.watch.pushEstablished(back('CAM-01', 'HEVC_1080P'));
    expect(r.cleared).toEqual([]);
    expect(r.reports).toEqual([{ code: 'CAMERA_WATCH_SINK_FAILED', deviceId: 'CAM-01' }]);
    const other = rig();
    other.watch.pushEstablished({ deviceId: 'CAM-01', leg: { event: 'GONE', profile: 'HEVC_1080P' } });
    other.watch.pushEstablished({ deviceId: 'CAM-01', leg: { event: 'LOST', profile: 7 as never } });
    expect([other.raised, other.cleared, other.changes, other.watch.lost()]).toEqual([[], [], [], []]);
    // A cause that is no code word is not passed on.
    other.watch.pushEstablished({ deviceId: 'CAM-01', leg: { event: 'LOST', profile: 'HEVC_1080P', cause: 'rtsp://192.0.2.46/x' } });
    expect(other.changes).toEqual([{ deviceId: 'CAM-01', event: 'STREAM_LOST', cause: null }]);
  });
});

// Finding E-03 of the fifth review pass (decision C113). Before this row the watch kept `lostStreams`, `lostLegs` and its
// own raise marks across sessions: `close()` cleared the heartbeats only, and nothing said "the capture ended".
// MUTATIONS, each seen RED (the row record names the failing assertions):
//   M1  `captureEnded` forgets nothing (its body emptied): the first case;
//   M2  the boundary by itself removed (no `forgetLosses()` at the first established push of another session): the second case;
//   M3  the losses forgotten but the watch's own faults NOT asked away: both cases (the sink keeps a fault of a finished capture).
describe('finding E-03: a loss belongs to the capture it happened in - two sessions back to back, a loss in the first', () => {
  const FIRST = 'SES-20261014-0001';
  const SECOND = 'SES-20261014-0002';
  const fault = (subject: string) => ({ code: 'CAPTURE_FAULT', subject, reason: 'CAMERA_STREAM_ENDED' });
  const up = (deviceId: string, sessionId: string, attempt = 1): Parameters<Rig['watch']['pushEstablished']>[0] => ({ deviceId, sessionId, attempt });
  const legLost = (deviceId: string, sessionId: string): Parameters<Rig['watch']['pushEstablished']>[0] => ({ deviceId, sessionId, attempt: 1, leg: { event: 'LOST', profile: 'HEVC_1080P', cause: 'CAMERA_LOST' } });
  /** The first session: both cameras up; CAM-01's relay dies, CAM-02's leg is lost and never comes back. */
  const firstSession = (r: Rig): void => {
    r.watch.pushEstablished(up('CAM-01', FIRST));
    r.watch.pushEstablished(up('CAM-02', FIRST));
    r.watch.relayEnded({ deviceId: 'CAM-01', sessionId: FIRST, code: 'CAPTURE_CAMERA_STREAM_LOST', profile: 'HEVC_1080P' });
    r.watch.pushEstablished(legLost('CAM-02', FIRST));
    expect([r.raised, r.cleared, [...r.watch.lost()].sort()]).toEqual([[fault('CAM-01'), fault('CAM-02')], [], ['CAM-01', 'CAM-02']]);
  };

  it('`captureEnded`: nothing is lost any more, each fault the watch raised is asked away ONCE, and the next session starts clean - a camera lost in the first is not lost in the second, raises anew there, and gets no clear for the old loss', async () => {
    const r = rig();
    firstSession(r);
    r.watch.captureEnded();
    expect(r.watch.lost()).toEqual([]);
    expect(r.cleared).toEqual([fault('CAM-01'), fault('CAM-02')]);
    // No camera came back: no change is told for the boundary.
    expect(r.changes.map((change) => change.event)).toEqual(['STREAM_LOST', 'STREAM_LOST']);
    // Twice is once.
    r.watch.captureEnded();
    expect(r.cleared).toHaveLength(2);

    // THE SECOND SESSION, with the same cameras. Their pushes are no "return": nothing is cleared, nothing is told.
    r.watch.pushEstablished(up('CAM-01', SECOND));
    r.watch.pushEstablished(up('CAM-02', SECOND));
    expect([r.raised.length, r.cleared.length, r.watch.lost(), r.changes.length]).toEqual([2, 2, [], 2]);
    // A loss in the second session is a loss of the second session: raised anew, and ended by its own return.
    r.watch.relayEnded({ deviceId: 'CAM-02', sessionId: SECOND, code: 'CAPTURE_CAMERA_STREAM_LOST', profile: 'HEVC_1080P' });
    expect([r.raised.length, r.watch.lost()]).toEqual([3, ['CAM-02']]);
    r.watch.pushEstablished(up('CAM-02', SECOND, 2));
    expect([r.cleared.length, r.watch.lost()]).toEqual([3, []]);
    // ONE relay of CAM-01 ended in the first session; before this row that count was still held here, so that ONE new loss
    // of the camera needed TWO returns. Now one loss, one return.
    r.watch.relayEnded({ deviceId: 'CAM-01', sessionId: SECOND, code: 'CAPTURE_CAMERA_STREAM_LOST' });
    r.watch.pushEstablished(up('CAM-01', SECOND, 2));
    expect([r.raised.length, r.cleared.length, r.watch.lost()]).toEqual([4, 4, []]);
    // The heartbeats are not the boundary's: a watched camera stays watched.
    r.watch.watch('CAM-01');
    await beat(r);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.PRESENT);
    const reads = r.reads.length;
    r.watch.captureEnded();
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.PRESENT);
    await beat(r);
    expect(r.reads.length).toBeGreaterThan(reads);
    r.watch.close();
  });

  it('where nobody says the capture ended: the first established push that names ANOTHER session is the boundary - also when the camera of that push is not the one that was lost', () => {
    const r = rig();
    firstSession(r);
    // A later worker of the SAME session is no boundary: CAM-01 returns and ITS fault is cleared (row 49's rule); CAM-02 stays lost.
    const same = rig();
    firstSession(same);
    same.watch.pushEstablished(up('CAM-01', FIRST, 2));
    expect([same.cleared, same.watch.lost()]).toEqual([[fault('CAM-01')], ['CAM-02']]);
    // A leg report and an ended relay that name another session are no boundary either (only an established push is).
    r.watch.pushEstablished(legLost('CAM-02', SECOND));
    expect([...r.watch.lost()].sort()).toEqual(['CAM-01', 'CAM-02']);
    expect(r.cleared).toEqual([]);

    // The second session opens with CAM-02 only. CAM-01 - lost in the first, not in this plan - is no longer lost.
    r.watch.pushEstablished(up('CAM-02', SECOND));
    expect(r.watch.lost()).toEqual([]);
    expect(r.cleared).toEqual([fault('CAM-01'), fault('CAM-02')]);
    expect(r.changes.map((change) => change.event)).toEqual(['STREAM_LOST', 'STREAM_LOST']);
    // And the second session's own loss stands alone.
    r.watch.pushEstablished(legLost('CAM-02', SECOND));
    expect([r.raised.length, r.watch.lost()]).toEqual([3, ['CAM-02']]);
    r.watch.pushEstablished(up('CAM-01', SECOND));
    expect(r.watch.lost()).toEqual(['CAM-02']);
  });
});

describe('presence: the heartbeat of the tested scheme by the time read', () => {
  it(`one read every ${CAMERA_PRESENCE_INTERVAL_MS} ms; absent after ${CAMERA_PRESENCE_FAILURES} reads without an answer, told once; the first answer after it is told once`, async () => {
    const r = rig();
    r.watch.watch('CAM-01');
    r.watch.watch('CAM-01');
    await flush();
    expect(r.reads).toHaveLength(1);
    expect(r.reads[0]?.candidate).toBe(CANDIDATE);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.PRESENT);
    expect(r.changes).toEqual([]);
    // The fixture is killed: it answers nothing.
    r.script = ['SILENT'];
    await beat(r);
    expect(r.reads).toHaveLength(2);
    await beat(r, true);
    // One read without an answer is not an absence.
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.PRESENT);
    expect(r.changes).toEqual([]);
    await beat(r, true);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.ABSENT);
    expect(r.changes).toEqual([{ deviceId: 'CAM-01', event: 'UNREACHABLE', cause: null }]);
    await beat(r, true);
    await beat(r, true);
    expect(r.changes).toHaveLength(1);
    // The fixture is back.
    r.script = [answers()];
    r.timers.advance(CAMERA_TIME_READ_BOUND_MS);
    await beat(r);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.PRESENT);
    expect(r.changes).toEqual([
      { deviceId: 'CAM-01', event: 'UNREACHABLE', cause: null },
      { deviceId: 'CAM-01', event: 'REACHABLE', cause: null },
    ]);
    // Presence raises no fault (C35, C40: the absent camera of a start is the session's ONE notice).
    expect([r.raised, r.cleared]).toEqual([[], []]);
    // Every bound and interval was asked of the timer seam, with the two constants and nothing else.
    expect([...new Set(r.timers.asked)].sort()).toEqual([CAMERA_TIME_READ_BOUND_MS, CAMERA_PRESENCE_INTERVAL_MS].sort());
  });

  it('a device that answers and is no ONVIF device counts as no answer; a failure between two answers starts the count again', async () => {
    const r = rig();
    r.script = [NOT_ONVIF, answers(), NOT_ONVIF, NOT_ONVIF];
    r.watch.watch('CAM-01');
    await beat(r);
    await beat(r);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.PRESENT);
    await beat(r);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.ABSENT);
    expect(r.changes.map((change) => change.event)).toEqual(['UNREACHABLE']);
  });

  it('reads of one camera never overlap; a read cut at its bound has its signal aborted', async () => {
    const r = rig();
    r.script = ['SILENT'];
    r.watch.watch('CAM-01');
    await flush();
    r.timers.advance(CAMERA_TIME_READ_BOUND_MS - 1);
    await flush();
    expect(r.reads).toHaveLength(1);
    expect(r.reads[0]?.signal.aborted).toBe(false);
    r.timers.advance(1);
    await flush();
    expect(r.reads[0]?.signal.aborted).toBe(true);
    expect(r.reads).toHaveLength(1);
    r.timers.advance(CAMERA_PRESENCE_INTERVAL_MS);
    await flush();
    expect(r.reads).toHaveLength(2);
  });

  it('what is not an absence: a stored address that cannot be read and a reader that refuses before it asks are reported and counted as nothing', async () => {
    const r = rig();
    r.script = ['REFUSE'];
    r.watch.watch('CAM-01');
    for (let turn = 0; turn < 4; turn += 1) await beat(r);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.UNKNOWN);
    expect(r.changes).toEqual([]);
    expect(new Set(r.reports.map((report) => report.code))).toEqual(new Set(['CAMERA_WATCH_READ_REFUSED']));
    r.watch.watch('MIC-01');
    for (let turn = 0; turn < 3; turn += 1) await beat(r);
    expect(r.watch.presence('MIC-01')).toBe(CameraPresence.UNKNOWN);
    expect(r.reports.some((report) => report.code === 'CAMERA_WATCH_CANDIDATE_NOT_READ' && report.deviceId === 'MIC-01')).toBe(true);
    expect(r.reads.every((read) => read.candidate === CANDIDATE)).toBe(true);
  });

  it('`unwatch` and `close` stop the heartbeat: a running read is cut, no timer is left, nothing is told afterwards', async () => {
    const r = rig();
    r.script = ['SILENT'];
    r.watch.watch('CAM-01');
    r.watch.watch('CAM-02');
    await flush();
    expect(r.reads).toHaveLength(2);
    r.watch.unwatch('CAM-01');
    expect(r.reads[0]?.signal.aborted).toBe(true);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.UNKNOWN);
    r.watch.close();
    expect(r.reads[1]?.signal.aborted).toBe(true);
    await flush();
    r.timers.advance(60_000);
    await flush();
    expect(r.timers.pending()).toBe(0);
    expect(r.reads).toHaveLength(2);
    expect(r.changes).toEqual([]);
    r.watch.watch('CAM-01');
    await flush();
    expect(r.reads).toHaveLength(2);
  });
});

describe('the clock offset and the pre-check read', () => {
  it('the camera\'s clock minus the Core\'s, from ONE read, with the Core\'s instant at the middle of the read', async () => {
    const r = rig({
      reader: {
        read: async () => {
          // The read takes 400 ms of the Core's clock; the camera stands 1,500 ms ahead of its middle.
          r.timers.advance(400);
          return answers(CORE_START + 200 + 1_500);
        },
      },
    });
    expect(await r.watch.clockOffsetMs('CAM-01')).toBe(1_500);
  });

  it('a camera behind the Core is a negative number; the offset is a whole number', async () => {
    const r = rig();
    r.script = [answers(CORE_START - 730)];
    expect(await r.watch.clockOffsetMs('CAM-01')).toBe(-730);
  });

  it('named refusals: no answer inside the bound, an answer without a usable instant, a stored address that cannot be read, a device that is no stored camera', async () => {
    const r = rig();
    r.script = ['SILENT'];
    const silent = outcomeOf(r.watch.clockOffsetMs('CAM-01'));
    await flush();
    r.timers.advance(CAMERA_TIME_READ_BOUND_MS);
    expect(await silent).toMatchObject({ name: 'CameraClockError', code: 'CAPTURE_CAMERA_CLOCK_NOT_ANSWERED', deviceId: 'CAM-01' });
    for (const instant of [null, Number.NaN, -1, 0, 1.5, Number.MAX_SAFE_INTEGER + 2]) {
      r.script = [answers(instant)];
      expect(await outcomeOf(r.watch.clockOffsetMs('CAM-01'))).toMatchObject({ code: 'CAPTURE_CAMERA_CLOCK_NOT_STATED' });
    }
    r.script = [NOT_ONVIF];
    expect(await outcomeOf(r.watch.clockOffsetMs('CAM-01'))).toMatchObject({ code: 'CAPTURE_CAMERA_CLOCK_NOT_ANSWERED' });
    expect(await outcomeOf(r.watch.clockOffsetMs('MIC-01'))).toMatchObject({ code: 'CAPTURE_DEVICE_UNKNOWN' });
    const broken = rig({ candidate: () => Promise.reject(new Error('store')) });
    expect(await outcomeOf(broken.watch.clockOffsetMs('CAM-01'))).toMatchObject({ code: 'CAPTURE_CAMERA_CLOCK_ADDRESS_NOT_READ' });
    expect(broken.reads).toEqual([]);
  });

  it(`\`check\`: one read for the pre-check; the clock is inside the bound up to ${CAMERA_CLOCK_BOUND_MS} ms and outside beyond it`, async () => {
    const r = rig();
    r.script = [answers(CORE_START + CAMERA_CLOCK_BOUND_MS)];
    expect(await r.watch.check('CAM-01', new AbortController().signal)).toEqual({ present: true, clockOffsetMs: CAMERA_CLOCK_BOUND_MS, clockWithinBound: true });
    r.script = [answers(CORE_START - CAMERA_CLOCK_BOUND_MS - 1)];
    expect(await r.watch.check('CAM-01', new AbortController().signal)).toEqual({ present: true, clockOffsetMs: -CAMERA_CLOCK_BOUND_MS - 1, clockWithinBound: false });
    r.script = [answers(null)];
    expect(await r.watch.check('CAM-01', new AbortController().signal)).toEqual({ present: true, clockOffsetMs: null, clockWithinBound: false });
    r.script = ['SILENT'];
    const absent = r.watch.check('CAM-01', new AbortController().signal);
    await flush();
    r.timers.advance(CAMERA_TIME_READ_BOUND_MS);
    expect(await absent).toEqual({ present: false, clockOffsetMs: null, clockWithinBound: false });
    expect(r.reads).toHaveLength(4);
    // It is apart from the heartbeat: nothing was told and no presence is kept.
    expect(r.changes).toEqual([]);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.UNKNOWN);
  });

  it('`check` with an aborted signal asks nothing; aborted during the read it rejects as aborted and the read is cut', async () => {
    const r = rig();
    const gone = new AbortController();
    gone.abort();
    expect(await outcomeOf(r.watch.check('CAM-01', gone.signal))).toMatchObject({ code: 'CAPTURE_ADAPTER_ABORTED' });
    expect(r.reads).toEqual([]);
    r.script = ['SILENT'];
    const during = new AbortController();
    const pending = outcomeOf(r.watch.check('CAM-01', during.signal));
    await flush();
    during.abort();
    expect(await pending).toMatchObject({ code: 'CAPTURE_ADAPTER_ABORTED' });
    expect(r.reads[0]?.signal.aborted).toBe(true);
    expect(await outcomeOf(r.watch.check('MIC-01', new AbortController().signal))).toMatchObject({ code: 'CAPTURE_DEVICE_UNKNOWN' });
  });
});

// Task 4 row 143 (AD-02 (1)): the presence read and the clock read are requests the Core sends to a STORED address.
describe('row 143: the destination rule stands before every presence read and every clock read (AD-02 (1))', () => {
  const realRig = (stored: () => CameraCandidate): Rig => rig({ storedAddress: REAL_RULE, candidate: async () => stored() });

  it('each refused class: `check` and `clockOffsetMs` refuse by the named code and NO time read is made', async () => {
    for (const entry of REFUSED_STORED_ADDRESSES) {
      const r = realRig(() => entry.candidate);
      const checked = await outcomeOf(r.watch.check('CAM-01', new AbortController().signal));
      expect(checked, entry.className).toMatchObject({ name: 'CameraClockError', code: 'CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED', deviceId: 'CAM-01' });
      expect(await outcomeOf(r.watch.clockOffsetMs('CAM-01')), entry.className).toMatchObject({ code: 'CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED' });
      expect(r.reads, entry.className).toEqual([]);
      expect(r.reports.map((report) => report.code)).toEqual(['CAMERA_WATCH_ADDRESS_REFUSED', 'CAMERA_WATCH_ADDRESS_REFUSED']);
      expect(r.timers.pending()).toBe(0);
      if (entry.candidate.host !== '') expect(`${JSON.stringify(r.reports)}${inspect(checked, { depth: 8 })}`.includes(entry.candidate.host), entry.className).toBe(false);
    }
  });

  it('the heartbeat of a refused address makes no read; the camera is not PRESENT and becomes ABSENT, told once; no fault is raised', async () => {
    const r = realRig(() => storedCameraAt('127.0.0.1', 8557));
    r.watch.watch('CAM-01');
    for (let turn = 0; turn < 4; turn += 1) await beat(r);
    expect(r.reads).toEqual([]);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.ABSENT);
    expect(r.changes.map((change) => change.event)).toEqual(['UNREACHABLE']);
    expect(r.raised).toEqual([]);
    expect(new Set(r.reports.map((report) => report.code))).toEqual(new Set(['CAMERA_WATCH_ADDRESS_REFUSED']));
    r.watch.close();
  });

  it('every read is judged anew: a PRESENT camera whose row is moved to a refused address is read no more; moved back, it is read again', async () => {
    let stored = storedCameraAt(ADMITTED_HOST);
    const r = realRig(() => stored);
    r.watch.watch('CAM-01');
    await beat(r);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.PRESENT);
    const before = r.reads.length;
    expect(before).toBeGreaterThan(0);
    expect(r.reads.every((read) => read.candidate.host === ADMITTED_HOST)).toBe(true);
    stored = storedCameraAt('169.254.10.20');
    for (let turn = 0; turn < 3; turn += 1) await beat(r);
    expect(r.reads.length).toBe(before);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.ABSENT);
    stored = storedCameraAt(ADMITTED_HOST);
    await beat(r);
    await beat(r);
    expect(r.reads.length).toBeGreaterThan(before);
    expect(r.watch.presence('CAM-01')).toBe(CameraPresence.PRESENT);
    r.watch.close();
  });

  it('no rule handed in: no read is ever made - the watch has no permissive value of its own', async () => {
    const r = rig({ storedAddress: undefined });
    expect(await outcomeOf(r.watch.clockOffsetMs('CAM-01'))).toMatchObject({ code: 'CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED' });
    r.watch.watch('CAM-01');
    for (let turn = 0; turn < 3; turn += 1) await beat(r);
    expect(r.reads).toEqual([]);
    expect(r.watch.presence('CAM-01')).not.toBe(CameraPresence.PRESENT);
    r.watch.close();
  });
});

// Task 4 row 143c (S13-11 point 2; decision C65): the time read is the THIRD dial of a stored camera. It is made FROM
// the camera-interface address the rule names in the judgement of THAT read, or it is not made.
describe('row 143c: every time read is made from the source address the rule names; an admission without one is a refused address', () => {
  /** A rule that admits the test camera and names `source` as given: no destination, no member, or a value that is no source address. */
  const admitNaming = (destination: unknown): StoredCameraAddressRule => ((host: string) => (host === CAMERA_HOST ? { allowed: true, ...(destination === undefined ? {} : { destination }) } : { allowed: false, refusal: 'OUTSIDE_CAMERA_SUBNET' })) as StoredCameraAddressRule;

  it('the heartbeat, `check` and `clockOffsetMs` each hand the rule\'s source address to the reader with the candidate; the real rule names the camera interface', async () => {
    const r = rig();
    r.script = [answers(CORE_START)];
    r.watch.watch('CAM-01');
    await flush();
    await r.watch.check('CAM-01', new AbortController().signal);
    await r.watch.clockOffsetMs('CAM-01');
    expect(r.reads.map((read) => read.from)).toEqual([CAMERA_INTERFACE, CAMERA_INTERFACE, CAMERA_INTERFACE]);
    expect(r.reads.every((read) => read.candidate === CANDIDATE)).toBe(true);
    r.watch.close();
    // The product's rule on hand-written host facts: the source is the camera interface of those facts, never the office one.
    const real = rig({ storedAddress: REAL_RULE, candidate: async () => storedCameraAt(ADMITTED_HOST) });
    await real.watch.check('CAM-01', new AbortController().signal);
    expect(real.reads.map((read) => read.from)).toEqual(['192.168.50.1']);
  });

  it('the source is the one of THAT read: a rule that names another address at the next judgement is followed at the next read', async () => {
    let source = '192.0.2.1';
    const r = rig({ storedAddress: (host) => (host === CAMERA_HOST ? { allowed: true, destination: { address: host, sourceAddress: source } } : { allowed: false, refusal: 'OUTSIDE_CAMERA_SUBNET' }) });
    await r.watch.check('CAM-01', new AbortController().signal);
    source = '192.0.2.2';
    await r.watch.check('CAM-01', new AbortController().signal);
    expect(r.reads.map((read) => read.from)).toEqual(['192.0.2.1', '192.0.2.2']);
  });

  it('an admission that names no source address, or one that is no source address: NO read - `check` and `clockOffsetMs` refuse by the existing code, the heartbeat counts no answer', async () => {
    const notASource: unknown[] = [undefined, {}, { address: CAMERA_HOST }, { address: CAMERA_HOST, sourceAddress: null }];
    for (const value of ['', '0.0.0.0', 'localhost', '192.0.2.01', '192.0.2.1:80', ' 192.0.2.1', '224.0.0.1', '255.255.255.255', '::1', 3221225985, ['192.0.2.1']]) notASource.push({ address: CAMERA_HOST, sourceAddress: value });
    for (const destination of notASource) {
      const r = rig({ storedAddress: admitNaming(destination) });
      const label = JSON.stringify(destination);
      expect(await outcomeOf(r.watch.check('CAM-01', new AbortController().signal)), label).toMatchObject({ name: 'CameraClockError', code: 'CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED', deviceId: 'CAM-01' });
      expect(await outcomeOf(r.watch.clockOffsetMs('CAM-01')), label).toMatchObject({ code: 'CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED' });
      r.watch.watch('CAM-01');
      for (let turn = 0; turn < 3; turn += 1) await beat(r);
      expect(r.reads, label).toEqual([]);
      expect(r.watch.presence('CAM-01'), label).toBe(CameraPresence.ABSENT);
      expect(new Set(r.reports.map((report) => report.code)), label).toEqual(new Set(['CAMERA_WATCH_ADDRESS_REFUSED']));
      expect(r.raised, label).toEqual([]);
      r.watch.close();
      expect(r.timers.pending(), label).toBe(0);
    }
  });

  it('the seam cannot be asked without a source: the one call of the file hands the judged candidate and its source, and the source is taken before it', () => {
    const text = readFileSync(resolve(__dirname, '../camera-watch.ts'), 'utf8');
    expect(text.match(/\breader\s*\.\s*read\s*\([^\n)]*\)/g)).toEqual(['reader.read(target.camera, bound.signal, target.from)']);
    expect(text).toContain('read(candidate: CameraCandidate, signal: AbortSignal, fromAddress: string): Promise<CameraTimeAnswer>;');
    expect(text.match(/\bstoredCameraSourceOf\s*\(/g)).toHaveLength(1);
    expect(text).toContain('return Object.freeze({ camera: target, from: from.sourceAddress });');
  });
});

describe('what the file is and is not', () => {
  const strip = (text: string): string =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter((line) => line !== '')
      .join('\n');
  const source = strip(readFileSync(resolve(__dirname, '../camera-watch.ts'), 'utf8'));

  it('reveal entries for presence: 0 by construction - the file imports no credential, no reader, no ONVIF package, no socket and no module of the host', () => {
    // Row 143 added the fifth: the judgement of the stored address, a pure file that imports one type of the layer.
    expect(source.match(/from\s+'[^']+'/g)).toEqual(["from '@dems/capture-protocol'", "from '../../types'", "from '../errors'", "from '../types'", "from './stored-address'"]);
    expect(strip(readFileSync(resolve(__dirname, '../stored-address.ts'), 'utf8')).match(/from\s+'[^']+'/g)).toEqual(["from '../types'"]);
    expect(source).not.toMatch(/credential|sealed|reveal|password|secret|username/i);
    expect(source).not.toMatch(/['"](?:node:)?(?:net|dgram|tls|http|https|http2|child_process|fs)['"]/);
    // No stream port, no ping, no sweep: the one question is the seam's read.
    expect(source.match(/\breader\s*\.\s*\w+\s*\(/g)).toEqual(['reader.read(']);
    expect(source).not.toMatch(/\b554\b|\bping\b|\barp\b|\bconnect\s*\(/i);
  });

  it('it reads no clock, names no global timer, logs nothing and opens no unit of work', () => {
    expect(source).not.toMatch(/\bDate\b|\bsetTimeout\b|\bsetInterval\b|\bperformance\b|process\s*\.\s*env/);
    expect(source).not.toMatch(/\bconsole\b|\blog\s*\.|errorLog|\.(?:warn|info|error|debug)\s*\(/);
    expect(source).not.toMatch(/\bpipeline\b|\bafterCommit\b|\.run\s*\(/);
  });

  it('no address is in a change, a report, a fault or an error of a whole life of a watch', async () => {
    const r = rig();
    r.script = ['SILENT', answers(CORE_START + 5)];
    r.watch.watch('CAM-01');
    await beat(r, true);
    await beat(r, true);
    await beat(r);
    r.watch.relayEnded({ deviceId: 'CAM-01', code: 'CAPTURE_CAMERA_STREAM_LOST' });
    r.watch.pushEstablished({ deviceId: 'CAM-01' });
    r.script = [answers(null)];
    const error = await outcomeOf(r.watch.clockOffsetMs('CAM-01'));
    const text = [r.changes, r.reports, r.raised, r.cleared, error].map((value) => `${JSON.stringify(value)}\n${inspect(value, { depth: 8, showHidden: true })}\n${value instanceof Error ? value.stack : ''}`).join('\n');
    expect(text.includes(CAMERA_HOST)).toBe(false);
    expect(text.includes('onvif')).toBe(false);
    r.watch.close();
  });
});
