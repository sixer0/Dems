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

const CAMERA_HOST = '192.0.2.49';
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
  readonly reads: { candidate: CameraCandidate; signal: AbortSignal }[];
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
      read: (candidate, signal) => {
        out.reads.push({ candidate, signal });
        const next = out.script.length > 1 ? out.script.shift() : out.script[0];
        if (next === 'REFUSE') return Promise.reject(new Error('refused before any request'));
        if (next === 'SILENT' || next === undefined) return new Promise<CameraTimeAnswer>(() => {});
        return Promise.resolve(next);
      },
    },
    candidate: async (deviceId) => (deviceId === 'CAM-01' || deviceId === 'CAM-02' ? CANDIDATE : null),
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
    expect(r.reports.map((report) => report.code)).toEqual(['CAMERA_WATCH_SINK_FAILED', 'CAMERA_WATCH_OBSERVER_FAILED', 'CAMERA_WATCH_OBSERVER_FAILED', 'CAMERA_WATCH_SINK_FAILED']);
    const plain = rig();
    plain.watch.relayEnded({ deviceId: 'CAM-01', code: `http://${CAMERA_HOST}/` });
    expect(plain.changes).toEqual([{ deviceId: 'CAM-01', event: 'STREAM_LOST', cause: null }]);
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
    expect(source.match(/from\s+'[^']+'/g)).toEqual(["from '@dems/capture-protocol'", "from '../../types'", "from '../errors'", "from '../types'"]);
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
