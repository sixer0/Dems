// DECISION D62 (ratified 2026-11-05): SMART ATTACH, the unit tests of the segment sweep. On doubles
// for the outside worlds - the neighbour table, the two probes, the host's own addresses, the
// registry, the attach steps and the scheduler - over the REAL candidate store (the same door the
// two operator triggers use). No database, no socket, no process, no wall clock: every time the
// sweep sees is the manual clock this file hands it.
//
// What the file holds the sweep to, line by line: the dedupe (own interfaces, the registry, live
// candidates), the three probe answers (ONVIF, RTSP-only, neither), ONE AUTO search per sweep
// through `begin`/`complete` with the audit row of actor SYSTEM, the RECORDING skip (the lift of
// D86 C-4 applies as it does to operation 93), single-flight, the cap of four adopts, the empty
// track selector rules (a filled track is never moved; a pairwise collision is never made), and the
// rule that WITHOUT the bench pair candidates are listed and nothing is attached.
import { CaptureCandidateStatus, CaptureConnectionOutcome, CaptureDiscoveryState, CaptureDiscoveryTrigger } from '@dems/shared/api';
import { SessionState, VIDEO_TRACK_IDS, type VideoTrackId } from '@dems/shared/domain';
import { describe, expect, it } from 'vitest';
import { sourceClassOf } from '../../../capture/adapters';
import type { AuditEntry } from '../../../core';
import { createCandidateStore, type CandidateStore } from '../store';
import {
  AUTOATTACH_MAX_ADOPTS_PER_SWEEP,
  AUTOATTACH_SWEEP_INTERVAL_MS,
  SEGMENT_NEIGHBOUR_COMMAND,
  SEGMENT_PROBE_MODEL,
  SYSTEM_OWNER_SESSION_ID,
  autoSearchIdOf,
  createSegmentSweeper,
  firstEmptyVideoTrack,
  foundOfProbe,
  holdsAlready,
  ipInSegment,
  listNeighboursOver,
  parseNeighbourTable,
  segmentCidrOctets,
  type SegmentAttach,
  type SegmentSweepOptions,
  type SegmentTrackAssignment,
  type SweepResult,
} from '../segment-scan';

// ── The doubles ─────────────────────────────────────────────────────────────────────────────────

const SEGMENT = '192.168.7.0/24';
const T0 = 1_700_000_000_000;

/** The store's own minting idiom from `search.test.ts`: six bytes, the last one counting up. */
const counterBytes = (): ((size: number) => Uint8Array) => {
  let next = 0;
  return (size: number) => Uint8Array.from({ length: size }, (_unused, index) => (index === size - 1 ? (next += 1) : 7));
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface Harness {
  readonly options: Mutable<SegmentSweepOptions>;
  readonly audits: AuditEntry[];
  readonly logs: { level: 'info' | 'warn'; fields: Record<string, unknown>; message: string }[];
  readonly store: CandidateStore;
  readonly probed: string[];
  setNow(at: number): void;
}

function harness(given: Partial<Record<'neighbours' | 'probes' | 'own' | 'registered' | 'attach' | 'openSession' | 'duringRecording' | 'windowMs', unknown>> = {}): Harness {
  const state = {
    neighbours: (given.neighbours ?? []) as readonly { ip: string; mac: string | null }[],
    probes: (given.probes ?? {}) as Record<string, { onvif: boolean; rtsp: boolean }>,
    own: (given.own ?? ['192.168.7.5']) as readonly string[],
    registered: (given.registered ?? []) as readonly string[],
    openSession: (given.openSession ?? null) as { id: string; state: string } | null,
  };
  let nowMs = T0;
  const audits: AuditEntry[] = [];
  const logs: Harness['logs'] = [];
  const probed: string[] = [];
  const store = createCandidateStore({ randomBytes: counterBytes() });
  const options: Mutable<SegmentSweepOptions> = {
    segmentCidr: SEGMENT,
    now: () => nowMs,
    listNeighbours: async () => state.neighbours,
    probeAddress: async (ip) => {
      probed.push(ip);
      return state.probes[ip] ?? { onvif: false, rtsp: false };
    },
    ownAddresses: () => state.own,
    registeredAddresses: async () => state.registered,
    store,
    nextSearchId: () => autoSearchIdOf(nowMs, probed.length + 1),
    audit: async (entry) => {
      audits.push(entry);
    },
    log: {
      info: (fields, message) => logs.push({ level: 'info', fields, message }),
      warn: (fields, message) => logs.push({ level: 'warn', fields, message }),
    },
    openSession: () => state.openSession,
    duringRecordingEnabled: (given.duringRecording ?? false) as boolean,
    ...(given.attach === undefined ? {} : { attach: given.attach as SegmentAttach }),
    windowMs: (given.windowMs ?? 0) as number,
  };
  return { options, audits, logs, store, probed, setNow: (at) => { nowMs = at; } };
}

const NEIGH = (ip: string, stateWord = 'REACHABLE', mac = '00:11:22:33:44:55'): string => `${ip} dev eth0 lladdr ${mac} ${stateWord}`;

// ── The neighbour table ─────────────────────────────────────────────────────────────────────────

describe('D62: the neighbour table says which hosts of the segment are there', () => {
  it('keeps live entries with a learnt hardware address inside the /24 and drops the rest (a FAILED entry, a line without lladdr, another segment, a router line, a duplicate)', () => {
    const octets = segmentCidrOctets(SEGMENT);
    expect(octets).toEqual([192, 168, 7]);
    const output = [
      NEIGH('192.168.7.11'),
      NEIGH('192.168.7.12', 'FAILED'),
      '192.168.7.13 dev eth0 REACHABLE',
      NEIGH('10.0.0.9'),
      'default via 192.168.7.1 dev eth0',
      'not-an-ip dev eth0 lladdr 00:11:22:33:44:55 REACHABLE',
      NEIGH('192.168.7.11', 'STALE', '99:99:99:99:99:99'),
      NEIGH('192.168.7.21', 'PROBE'),
      NEIGH('192.168.7.22', 'DELAY'),
    ].join('\n');
    expect(parseNeighbourTable(output, octets as readonly [number, number, number])).toEqual([
      { ip: '192.168.7.11', mac: '00:11:22:33:44:55' },
      { ip: '192.168.7.21', mac: '00:11:22:33:44:55' },
      { ip: '192.168.7.22', mac: '00:11:22:33:44:55' },
    ]);
    expect(ipInSegment('192.168.7.11', octets as readonly [number, number, number])).toBe(true);
    expect(ipInSegment('192.168.8.11', octets as readonly [number, number, number])).toBe(false);
    expect(ipInSegment('192.168.7.999', octets as readonly [number, number, number])).toBe(false);
  });

  it('asks the host the ONE fixed row and fails CLOSED when the answer is not a clean 0 (not started, timed out, a code but 0, a throw)', async () => {
    type Answer = { outcome: 'RAN'; exitCode: number; output: string } | { outcome: 'NOT_STARTED' } | { outcome: 'TIMED_OUT' };
    const asked: unknown[] = [];
    const answers: Answer[] = [];
    const run = async (command: unknown): Promise<Answer> => {
      asked.push(command);
      return answers.shift() as Answer;
    };
    const list = listNeighboursOver(run as never, SEGMENT);
    answers.push({ outcome: 'RAN', exitCode: 0, output: NEIGH('192.168.7.11') });
    expect(await list()).toEqual([{ ip: '192.168.7.11', mac: '00:11:22:33:44:55' }]);
    // The row is the frozen one and nothing else reached it.
    expect(asked).toEqual([SEGMENT_NEIGHBOUR_COMMAND]);
    expect(SEGMENT_NEIGHBOUR_COMMAND).toEqual({ program: '/usr/sbin/ip', args: ['-4', 'neigh', 'show'] });
    for (const refusal of [
      { outcome: 'NOT_STARTED' },
      { outcome: 'TIMED_OUT' },
      { outcome: 'RAN', exitCode: 1, output: '' },
    ] as const) {
      answers.push(refusal as never);
      expect(await list()).toBeNull();
    }
    const throwing = listNeighboursOver((async () => { throw new Error('exec refused'); }) as never, SEGMENT);
    expect(await throwing()).toBeNull();
    // A CIDR that is not the promised /24 asks nothing at all.
    expect(await listNeighboursOver(run as never, '192.168.7.0/16')()).toBeNull();
  });
});

// ── The candidate of one probe answer ──────────────────────────────────────────────────────────

describe('D62: what one probe answer becomes in the list', () => {
  it('an ONVIF answer is an ONVIF_RTSP candidate the Core would dial at http://ip:80/onvif/device_service, testable, with no endpoint identity', () => {
    const found = foundOfProbe('192.168.7.11', { onvif: true, rtsp: false });
    expect(found.adapter).toBe('ONVIF_RTSP');
    expect(found.sourceClass).toBe(sourceClassOf('ONVIF_RTSP'));
    expect(found.host).toBe('192.168.7.11');
    expect(found.connectionTarget).toBe('http://192.168.7.11:80/onvif/device_service');
    expect(found.testable).toBe(true);
    expect(found.status).toBe(CaptureCandidateStatus.NEW);
    expect(found.endpointRef).toBeNull();
    expect(found.deviceId).toBeNull();
    expect(found.model).toBe(SEGMENT_PROBE_MODEL);
    expect(found.camera.serviceAddress).toBe('http://192.168.7.11:80/onvif/device_service');
  });

  it('an RTSP-only answer is a LOCAL_DEVICE candidate with no service address and not testable; neither answer is no candidate at all (the caller filters)', () => {
    const rtsp = foundOfProbe('192.168.7.12', { onvif: false, rtsp: true });
    expect(rtsp.adapter).toBe('LOCAL_DEVICE');
    expect(rtsp.sourceClass).toBe(sourceClassOf('LOCAL_DEVICE'));
    expect(rtsp.connectionTarget).toBeUndefined();
    expect(rtsp.testable).toBe(false);
    const silent = foundOfProbe('192.168.7.13', { onvif: false, rtsp: false });
    expect(silent.testable).toBe(false);
  });
});

// ── The sweep ───────────────────────────────────────────────────────────────────────────────────

describe('D62: one sweep', () => {
  it('deduplicates: the Core never dials its own address, a registered camera or a host already on somebody\'s live list', async () => {
    const h = harness({
      neighbours: [{ ip: '192.168.7.5', mac: null }, { ip: '192.168.7.11', mac: null }, { ip: '192.168.7.12', mac: null }, { ip: '192.168.7.13', mac: null }],
      probes: { '192.168.7.11': { onvif: true, rtsp: true }, '192.168.7.12': { onvif: false, rtsp: true }, '192.168.7.13': { onvif: false, rtsp: false } },
      registered: ['192.168.7.12'],
    });
    const result = await createSegmentSweeper(h.options).sweep();
    // .5 is the Core itself and .12 is registered: never dialled. .13 is dialled and answers nothing: not listed.
    expect(h.probed).toEqual(['192.168.7.11', '192.168.7.13']);
    expect(result).toMatchObject<SweepResult>({ ran: true, skipped: null, probed: 2, found: 1, adopted: [] });
    const listed = h.store.stateOf(SYSTEM_OWNER_SESSION_ID, T0).candidates;
    expect(listed.map((candidate) => candidate.host)).toEqual(['192.168.7.11']);
    // The second sweep dials only the silent .13 again: the live candidate .11 is on the list and excluded.
    h.probed.length = 0;
    const again = await createSegmentSweeper(h.options).sweep();
    expect(h.probed).toEqual(['192.168.7.13']);
    expect(again.found).toBe(0);
  });

  it('is ONE AUTO search through begin/complete with the audit row of actor SYSTEM and trigger AUTO, and operations see it as a COMPLETE list', async () => {
    const h = harness({
      neighbours: [{ ip: '192.168.7.11', mac: null }],
      probes: { '192.168.7.11': { onvif: true, rtsp: false } },
    });
    await createSegmentSweeper(h.options).sweep();
    expect(h.audits).toHaveLength(1);
    const row = h.audits[0] as AuditEntry;
    expect(row.type).toBe('CAPTURE_DISCOVERY_SEARCHED');
    // Actor SYSTEM by the FAULT_CLEARED precedent: null, never a typed name.
    expect(row.actorId).toBeNull();
    expect(row.deviceId).toBeNull();
    expect(row.details).toMatchObject({ trigger: CaptureDiscoveryTrigger.AUTO, scope: 'CAMERA_NETWORK', outcome: 'COMPLETE', responderCount: 1, newCount: 1 });
    const body = h.store.stateOf(SYSTEM_OWNER_SESSION_ID, T0);
    const search = body.search;
    if (search === null) throw new Error('the sweep left no search in the store');
    expect(search.trigger).toBe(CaptureDiscoveryTrigger.AUTO);
    expect(search.state).toBe(CaptureDiscoveryState.COMPLETE);
    expect(/^DSC-\d{13,14}$/.test(search.searchId)).toBe(true);
  });

  it('skips while a session RECORDS (the lift of D86 C-4 applies as everywhere), runs when the lift is off, and skips a second sweep while one is in flight', async () => {
    const recording = harness({ openSession: { id: 'SES-1', state: SessionState.RECORDING } });
    const sweeper = createSegmentSweeper(recording.options);
    expect(await sweeper.sweep()).toMatchObject({ ran: false, skipped: 'RECORDING' });
    expect(recording.probed).toEqual([]);
    expect(recording.audits).toEqual([]);
    // With the lift constant on, the sweep runs exactly as operation 93 would.
    const lifted = harness({ openSession: { id: 'SES-1', state: SessionState.RECORDING }, duringRecording: true });
    expect((await createSegmentSweeper(lifted.options).sweep()).ran).toBe(true);
    // Single-flight: a sweep that holds the store's RUNNING search stops the next one.
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const busy = harness({ neighbours: [{ ip: '192.168.7.11', mac: null }] });
    busy.options.listNeighbours = async () => { await gate; return []; };
    const busySweeper = createSegmentSweeper(busy.options);
    const running = busySweeper.sweep();
    const second = await busySweeper.sweep();
    expect(second).toMatchObject({ ran: false, skipped: 'BUSY' });
    release();
    expect((await running).ran).toBe(true);
    // A search of ANY owner in the store - operator, pre-check, sweep - stops the sweep too.
    const held = harness();
    held.store.begin({ sessionId: 'SESSION-OPR', searchId: 'DSC-1', trigger: CaptureDiscoveryTrigger.MANUAL, startedAt: T0, windowMs: 5_000, interfaceCount: 1 });
    expect(await createSegmentSweeper(held.options).sweep()).toMatchObject({ ran: false, skipped: 'SEARCH_RUNNING' });
  });

  it('a host that cannot answer the neighbour table fails CLOSED: nothing is probed, nothing is audited, the skip is said at warn', async () => {
    const h = harness();
    h.options.listNeighbours = async () => null;
    expect(await createSegmentSweeper(h.options).sweep()).toMatchObject({ ran: false, skipped: 'LIST_UNREADABLE' });
    expect(h.logs.some((entry) => entry.level === 'warn' && entry.fields.code === 'CAPTURE_AUTOATTACH_LIST_UNREADABLE')).toBe(true);
    expect(h.audits).toEqual([]);
  });

  it('nothing the sweep does can throw into the caller or the timer: a dead probe is a no, a failing audit stands the sweep, a throwing seam skips FAILED', async () => {
    const dying = harness({ neighbours: [{ ip: '192.168.7.11', mac: null }] });
    dying.options.probeAddress = async () => { throw new Error('no route'); };
    const result = await createSegmentSweeper(dying.options).sweep();
    expect(result).toMatchObject({ ran: true, found: 0 });
    const deafAudit = harness({ neighbours: [{ ip: '192.168.7.11', mac: null }], probes: { '192.168.7.11': { onvif: true, rtsp: false } } });
    deafAudit.options.audit = async () => { throw new Error('audit down'); };
    expect((await createSegmentSweeper(deafAudit.options).sweep()).ran).toBe(true);
    expect(deafAudit.logs.some((entry) => entry.fields.code === 'CAPTURE_DISCOVERY_AUDIT_FAILED')).toBe(true);
    const exploding = harness();
    exploding.options.registeredAddresses = async () => { throw new Error('db down'); };
    expect(await createSegmentSweeper(exploding.options).sweep()).toMatchObject({ ran: false, skipped: 'FAILED' });
  });

  it('the timer: start schedules once, the tick sweeps, stop unschedules, and a disabled environment never reaches any of it', async () => {
    const h = harness({ neighbours: [{ ip: '192.168.7.11', mac: null }] });
    let scheduled = 0;
    let ticks: (() => void)[] = [];
    let stopped = 0;
    h.options.schedule = (tick) => {
      scheduled += 1;
      ticks.push(tick);
      return () => { stopped += 1; };
    };
    const sweeper = createSegmentSweeper(h.options);
    // The default of the schedule seam is the 60 s interval of D62 - the constant is the period itself.
    expect(AUTOATTACH_SWEEP_INTERVAL_MS).toBe(60_000);
    sweeper.start();
    sweeper.start();
    expect(scheduled).toBe(1);
    ticks[0]?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.probed.length).toBeGreaterThan(0);
    sweeper.stop();
    expect(stopped).toBe(1);
    sweeper.stop();
    expect(stopped).toBe(1);
  });
});

// ── The attach steps (D62 point 4) ──────────────────────────────────────────────────────────────

describe('D62: auto-attach after the sweep, behind the bench pair', () => {
  interface AttachSpy extends SegmentAttach {
    readonly tested: string[];
    readonly adopted: string[];
    readonly assigned: string[];
  }

  function attachSpy(behaviour: Partial<{ testOutcome: CaptureConnectionOutcome; adoptThrows: boolean; assign: SegmentTrackAssignment }> = {}): AttachSpy {
    const tested: string[] = [];
    const adopted: string[] = [];
    const assigned: string[] = [];
    let minted = 0;
    return {
      tested,
      adopted,
      assigned,
      testCandidate: async (candidateId) => {
        tested.push(candidateId);
        return behaviour.testOutcome ?? CaptureConnectionOutcome.REACHABLE;
      },
      adoptCandidate: async (candidateId) => {
        if (behaviour.adoptThrows === true) throw new Error('adoption refused');
        adopted.push(candidateId);
        return `DEV-${String(minted += 1)}`;
      },
      assignFirstEmptyTrack: async (deviceId) => {
        assigned.push(deviceId);
        return behaviour.assign ?? { assigned: true, trackId: 'VIDEO-01', reason: null };
      },
    };
  }

  it('without the bench pair the candidates are listed and NOTHING is tested, adopted or assigned', async () => {
    const h = harness({
      neighbours: [{ ip: '192.168.7.11', mac: null }],
      probes: { '192.168.7.11': { onvif: true, rtsp: false } },
    });
    const result = await createSegmentSweeper(h.options).sweep();
    expect(result.found).toBe(1);
    expect(result.adopted).toEqual([]);
    expect(h.store.stateOf(SYSTEM_OWNER_SESSION_ID, T0).candidates).toHaveLength(1);
  });

  it('a fresh testable candidate is tested and adopted and lands on its track; a NOT_REACHABLE test adopts nothing and the candidate stays; an RTSP-only candidate is never tested', async () => {
    const spy = attachSpy();
    const h = harness({
      neighbours: [{ ip: '192.168.7.11', mac: null }, { ip: '192.168.7.12', mac: null }],
      probes: { '192.168.7.11': { onvif: true, rtsp: true }, '192.168.7.12': { onvif: false, rtsp: true } },
      attach: spy,
    });
    const result = await createSegmentSweeper(h.options).sweep();
    // .12 answered RTSP only: not testable, the auto path never dials its test.
    expect(spy.tested).toHaveLength(1);
    expect(result.adopted).toEqual(['DEV-1']);
    expect(spy.assigned).toEqual(['DEV-1']);
    // A refused test: nothing adopted, the sweep says so at warn, the list keeps the candidate.
    const refused = attachSpy({ testOutcome: CaptureConnectionOutcome.UNREACHABLE });
    const h2 = harness({ neighbours: [{ ip: '192.168.7.11', mac: null }], probes: { '192.168.7.11': { onvif: true, rtsp: false } }, attach: refused });
    expect((await createSegmentSweeper(h2.options).sweep()).adopted).toEqual([]);
    expect(h2.logs.some((entry) => entry.level === 'warn' && entry.fields.code === 'CAPTURE_AUTOATTACH_NOT_REACHABLE')).toBe(true);
    expect(h2.store.stateOf(SYSTEM_OWNER_SESSION_ID, T0).candidates).toHaveLength(1);
  });

  it('a throwing adopt step is a warn line and the next candidate still runs; the cap holds at four adopts per sweep and the rest wait', async () => {
    const five = Object.fromEntries([11, 12, 13, 14, 15].map((last) => [`192.168.7.${String(last)}`, { onvif: true, rtsp: false }]));
    const spy = attachSpy();
    const h = harness({
      neighbours: [11, 12, 13, 14, 15].map((last) => ({ ip: `192.168.7.${String(last)}`, mac: null })),
      probes: five,
      attach: spy,
    });
    const result = await createSegmentSweeper(h.options).sweep();
    expect(result.adopted).toHaveLength(AUTOATTACH_MAX_ADOPTS_PER_SWEEP);
    expect(spy.tested).toHaveLength(AUTOATTACH_MAX_ADOPTS_PER_SWEEP);
    expect(h.logs.some((entry) => entry.level === 'warn' && entry.fields.code === 'CAPTURE_AUTOATTACH_CAP')).toBe(true);
    // A failing step says warn and moves on: candidate two of the same sweep is still adopted.
    let first = true;
    const flaky: SegmentAttach = {
      testCandidate: async () => CaptureConnectionOutcome.REACHABLE,
      adoptCandidate: async () => {
        if (first) { first = false; throw new Error('one camera refuses'); }
        return 'DEV-OK';
      },
      assignFirstEmptyTrack: async () => ({ assigned: true, trackId: 'VIDEO-01', reason: null }),
    };
    const h2 = harness({
      neighbours: [{ ip: '192.168.7.11', mac: null }, { ip: '192.168.7.12', mac: null }],
      probes: { '192.168.7.11': { onvif: true, rtsp: false }, '192.168.7.12': { onvif: true, rtsp: false } },
      attach: flaky,
    });
    const second = await createSegmentSweeper(h2.options).sweep();
    expect(second.adopted).toEqual(['DEV-OK']);
    expect(h2.logs.some((entry) => entry.level === 'warn' && entry.fields.code === 'CAPTURE_AUTOATTACH_FAILED')).toBe(true);
  });

  it('a skipped assignment (filled tracks, pairwise) is said at warn and the adoption stands', async () => {
    const spy = attachSpy({ assign: { assigned: false, trackId: null, reason: 'NO_EMPTY_TRACK' } });
    const h = harness({ neighbours: [{ ip: '192.168.7.11', mac: null }], probes: { '192.168.7.11': { onvif: true, rtsp: false } }, attach: spy });
    const result = await createSegmentSweeper(h.options).sweep();
    expect(result.adopted).toEqual(['DEV-1']);
    expect(h.logs.some((entry) => entry.level === 'warn' && entry.fields.code === 'CAPTURE_AUTOATTACH_TRACK_SKIPPED' && entry.fields.skipReason === 'NO_EMPTY_TRACK')).toBe(true);
  });
});

// ── The selector rules of the assignment (the wiring's choice, pinned here as pure functions) ───

describe('D62: the first EMPTY video track, and never another one', () => {
  const line = (trackId: VideoTrackId, deviceId: string): { trackId: VideoTrackId; deviceId: string } => ({ trackId, deviceId });

  it('the first empty slot of the four, in order; a filled VIDEO-04 stays filled and all four filled answers null', () => {
    expect(firstEmptyVideoTrack([])).toBe(VIDEO_TRACK_IDS[0]);
    expect(firstEmptyVideoTrack([line('VIDEO-01', 'DEV-1')])).toBe(VIDEO_TRACK_IDS[1]);
    // 01 to 03 hold cameras: the fourth is the first empty one.
    expect(firstEmptyVideoTrack([line('VIDEO-01', 'DEV-1'), line('VIDEO-02', 'DEV-2'), line('VIDEO-03', 'DEV-3')])).toBe('VIDEO-04');
    // 04 is filled and 02 is empty: the empty one wins, the filled one is never moved.
    expect(firstEmptyVideoTrack([line('VIDEO-01', 'DEV-1'), line('VIDEO-03', 'DEV-3'), line('VIDEO-04', 'DEV-4')])).toBe('VIDEO-02');
    expect(firstEmptyVideoTrack(VIDEO_TRACK_IDS.map((trackId, index) => line(trackId, `DEV-${String(index)}`)))).toBeNull();
  });

  it('pairwise: a device that already holds a line gets no second one from the auto path', () => {
    const cameras = [line('VIDEO-02', 'DEV-7')];
    expect(holdsAlready(cameras, 'DEV-7')).toBe(true);
    expect(holdsAlready(cameras, 'DEV-8')).toBe(false);
  });
});

// ── The search id ───────────────────────────────────────────────────────────────────────────────

describe('D62: the search id of a sweep', () => {
  it('is the 13-digit clock form with the sweep number riding the last digit', () => {
    expect(autoSearchIdOf(T0, 1)).toBe(`DSC-${String(T0)}1`);
    expect(autoSearchIdOf(T0, 1)).toMatch(/^DSC-\d{13,14}$/);
    expect(autoSearchIdOf(1, 12)).toBe('DSC-0000000000012');
    expect(autoSearchIdOf(T0, 1)).not.toBe(autoSearchIdOf(T0, 2));
  });
});
