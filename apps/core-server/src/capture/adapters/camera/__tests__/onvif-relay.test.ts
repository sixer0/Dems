// The production camera adapter, T-1 and T-3 (task 4 blueprint row 46, WP-06b; design addendum 6.3:
// "T-1 unit: the adapter with a door double and a fake ONVIF session - the order of 2.3, the bounds
// of section 3, the codes"; "T-3 behind the rule: the built adapter handed to a real registry is
// refused"). T-2, with the real relay, the test camera and the release worker, is the database
// file `src/modules/capture-config/__tests__/camera-adapter-open.db.test.ts` (it builds the
// credential readers through their wiring, which only the tests of that folder may import).
//
// THE DOUBLES. No process, no port, no database, no clock: the door is an object that records what
// it was started with and whose child the test moves (takes the message, reports, ends); the ONVIF
// locator, the credential reader and the stored stream facts are functions of this file; the timer
// is a manual one. The serialiser of the start message is the REAL one, called by the test on the
// message the door double was handed, so that the form the relay reads is compared byte for byte.
//
// The account, the locator and the ingest address are synthetic values of this file. Comparisons
// that could print one are asserted as booleans.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import type { CaptureTimers } from '../../../types';
import { SealedCredential, sealCredential, startMessageBytes, usingCredential } from '../../credential';
import { CaptureAdapterError } from '../../errors';
import { CaptureAdapterKind, CaptureOperation } from '../../kinds';
import { ProductionDoorError, ProductionDoorRefusal, type ProductionDoor, type ProductionExit, type ProductionProcessOptions } from '../../production-door';
import { createCaptureDeviceRegistry } from '../../registry';
import { ConnectionTestOutcome, type CameraCandidate, type CameraSourceTarget, type CaptureDeviceEntry } from '../../types';
import { createCameraWatch } from '../camera-watch';
import {
  CAMERA_OPEN_BOUND_MS,
  CAMERA_RELAY_REAP_BOUND_MS,
  CAMERA_RELAY_STOP_BOUND_MS,
  CameraOpenError,
  CameraOpenRefusal,
  createOnvifRelayCameraAdapter,
  relayEndOf,
  type CameraRelayEnd,
  type CameraRelayNote,
  type CameraRelayReport,
  type OnvifRelayCameraDependencies,
  type StoredCameraStream,
} from '../onvif-relay';
import type { OnvifLocatorResult } from '../onvif-session';
import { RELAY_REPORT_LINE_MAX_BYTES, RelayReportKind, createRelayReportReader, type RelayReport } from '../relay-start';

const ACCOUNT = { username: ['row46', 'unit', 'account'].join('-'), secret: ['row46', 'unit', 'placeholder', 'Qx7Lm2'].join('-') } as const;
const CAMERA_HOST = '192.0.2.46';
const SCHEME = ['rt', 'sp'].join('');
const LOCATOR = `${SCHEME}://${CAMERA_HOST}:554/stream/main?channel=1&subtype=0`;
const SESSION = 'SES-20261013-0046';
/** The form of an ingest address (`capture/ingest-address.ts`), on a port no test listens on. */
const INGEST = `${SCHEME}://127.0.0.1:8559/${SESSION}/video-01/${'Zk3'.repeat(7)}a`;
const INGEST_ELEMENT = INGEST.slice(INGEST.lastIndexOf('/') + 1);
const NEEDLES = [ACCOUNT.username, ACCOUNT.secret, LOCATOR, '/stream/main', CAMERA_HOST, INGEST, INGEST_ELEMENT];
const leaks = (text: string): string[] => NEEDLES.filter((needle) => text.includes(needle));
const everything = (value: unknown): string => [String(value), JSON.stringify(value) ?? '', inspect(value, { depth: 8, showHidden: true, getters: true }), value instanceof Error ? `${value.message}\n${value.stack ?? ''}` : ''].join('\n');

const PROGRAM = '/opt/dems/bin/capture-relay';
const DEVICES: readonly CaptureDeviceEntry[] = [
  { id: 'CAM-01', deviceClass: 'CAMERA', label: 'Camera 1', capabilities: ['VIDEO', 'PULL'], profiles: ['HEVC_1080P', 'H264_720P'] },
  { id: 'CAM-02', deviceClass: 'CAMERA', label: 'Camera 2', capabilities: ['VIDEO', 'PULL'], profiles: ['H264_1080P'] },
];
const CANDIDATE: CameraCandidate = { adapterKind: CaptureAdapterKind.ONVIF_RTSP, host: CAMERA_HOST, serviceAddress: `http://${CAMERA_HOST}/onvif/device_service`, endpointRef: null, vendor: null, model: null, name: null, testable: true, conflict: false };
const TOKEN = 'Main.Stream:0-a';

const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 30; turn += 1) await Promise.resolve();
};
const outcomeOf = async (pending: Promise<unknown>): Promise<unknown> => pending.then((value) => value, (error: unknown) => error);

interface ManualTimers extends CaptureTimers {
  readonly asked: number[];
  advance(ms: number): void;
  pending(): number;
}
function manualTimers(): ManualTimers {
  let now = 0;
  const entries: { at: number; callback: () => void; live: boolean }[] = [];
  const asked: number[] = [];
  return {
    asked,
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
      // A copy: a callback may ask for a new timer, which belongs to a later advance.
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

interface FakeChild {
  readonly options: ProductionProcessOptions;
  readonly signals: string[];
  inputEnded: number;
  /** What the child does when its standard input ends, and when it is killed. */
  endsOnInputEnd: boolean;
  diesOnKill: boolean;
  alive: boolean;
  take(): void;
  refuse(code: ProductionDoorRefusal): void;
  say(text: string): void;
  exit(exitCode: number | null, signal?: string | null, spawnFailed?: boolean): void;
}
function fakeDoor(): { readonly door: ProductionDoor; readonly children: FakeChild[] } {
  const children: FakeChild[] = [];
  const door: ProductionDoor = (options) => {
    let resolveStarted: () => void = () => {};
    let rejectStarted: (error: Error) => void = () => {};
    const started = new Promise<void>((done, fail) => {
      resolveStarted = done;
      rejectStarted = fail;
    });
    started.catch(() => {});
    let resolveEnded: (exit: ProductionExit) => void = () => {};
    const ended = new Promise<ProductionExit>((done) => {
      resolveEnded = done;
    });
    const child: FakeChild = {
      options,
      signals: [],
      inputEnded: 0,
      endsOnInputEnd: true,
      diesOnKill: true,
      alive: true,
      take: () => resolveStarted(),
      refuse(code) {
        rejectStarted(new ProductionDoorError(code));
        child.exit(null, 'SIGKILL');
      },
      say: (text) => options.onOutput?.(Buffer.from(text, 'utf8')),
      exit(exitCode, signal = null, spawnFailed = false) {
        if (!child.alive) return;
        child.alive = false;
        resolveEnded({ exitCode, signal, spawnFailed, diagnostics: '', output: '' });
      },
    };
    children.push(child);
    return {
      pid: 4_600 + children.length,
      started,
      ended,
      alive: () => child.alive,
      endInput() {
        child.inputEnded += 1;
        if (child.endsOnInputEnd) child.exit(0);
      },
      kill(signal) {
        child.signals.push(signal);
        if (child.diesOnKill) child.exit(null, signal);
      },
    };
  };
  return { door, children };
}

const located = (outcome: ConnectionTestOutcome, locator: string | null, reason: OnvifLocatorResult['reason'] = null): OnvifLocatorResult =>
  Object.freeze({ outcome, reason, locator, reads: Object.freeze(['GetSystemDateAndTime', 'GetServices', 'GetStreamUri'] as const), credentialRequests: 1, rejectedCredentialRequests: outcome === ConnectionTestOutcome.AUTHENTICATION_FAILED ? 1 : 0 });

interface Rig {
  readonly adapter: ReturnType<typeof createOnvifRelayCameraAdapter>;
  readonly timers: ManualTimers;
  readonly children: FakeChild[];
  readonly calls: string[];
  readonly reports: CameraRelayReport[];
  readonly ends: CameraRelayEnd[];
  readonly notes: CameraRelayNote[];
  readonly locateCalls: { candidate: CameraCandidate; sealed: unknown; token: string; signal: AbortSignal }[];
  readonly readerCalls: { deviceId: string; sessionId: string }[];
  /** Replace a step of the next open. */
  stream: OnvifRelayCameraDependencies['stream'];
  reader: (deviceId: string, sessionId: string) => Promise<SealedCredential>;
  locate: (signal: AbortSignal) => Promise<OnvifLocatorResult>;
}
function rig(patch: Partial<OnvifRelayCameraDependencies> = {}): Rig {
  const timers = manualTimers();
  const { door, children } = fakeDoor();
  const calls: string[] = [];
  const reports: CameraRelayReport[] = [];
  const ends: CameraRelayEnd[] = [];
  const notes: CameraRelayNote[] = [];
  const locateCalls: Rig['locateCalls'] = [];
  const readerCalls: Rig['readerCalls'] = [];
  const state: Pick<Rig, 'stream' | 'reader' | 'locate'> = {
    stream: async (): Promise<StoredCameraStream | null> => ({ candidate: CANDIDATE, onvifProfileToken: TOKEN }),
    reader: async () => sealCredential(ACCOUNT),
    locate: async () => located(ConnectionTestOutcome.REACHABLE, LOCATOR),
  };
  const adapter = createOnvifRelayCameraAdapter(DEVICES, {
    door: (options) => {
      calls.push('door');
      return door(options);
    },
    relayProgram: PROGRAM,
    timers,
    credentials: {
      sessionOpen: (deviceId, sessionId) => {
        calls.push('reader');
        readerCalls.push({ deviceId, sessionId });
        return state.reader(deviceId, sessionId);
      },
    },
    locator: {
      locate: (candidate, sealed, token, signal) => {
        calls.push('locate');
        locateCalls.push({ candidate, sealed, token, signal });
        return state.locate(signal);
      },
    },
    stream: (deviceId, profile) => {
      calls.push(`stream ${deviceId} ${profile}`);
      return state.stream(deviceId, profile);
    },
    relayEnded: (end) => ends.push(end),
    tell: (note) => notes.push(note),
    ...patch,
  });
  adapter.relayReports.subscribe((report) => reports.push(report));
  const out: Rig = {
    adapter,
    timers,
    children,
    calls,
    reports,
    ends,
    notes,
    locateCalls,
    readerCalls,
    get stream() {
      return state.stream;
    },
    set stream(value) {
      state.stream = value;
    },
    get reader() {
      return state.reader;
    },
    set reader(value) {
      state.reader = value;
    },
    get locate() {
      return state.locate;
    },
    set locate(value) {
      state.locate = value;
    },
  };
  return out;
}

const target = (patch: Partial<CameraSourceTarget> = {}): CameraSourceTarget => ({ ingestUrl: INGEST, profile: 'HEVC_1080P', sessionId: SESSION, attempt: 1, ...patch });
/** The record-mode report line as the relay makes it (`relay_established_line`, row 42). */
const established = (attempt: number): string => `{"report":"push_established","v":1,"attempt":${attempt}}\n`;
const never = new AbortController().signal;

/** Opens a camera up to the started relay and returns the pending open with its child. */
async function opening(r: Rig, deviceId = 'CAM-01', patch: Partial<CameraSourceTarget> = {}, signal: AbortSignal = never): Promise<{ pending: Promise<unknown>; child: FakeChild }> {
  const before = r.children.length;
  const pending = outcomeOf(r.adapter.openSource(deviceId, target(patch), signal));
  await flush();
  const child = r.children[before];
  if (child === undefined) throw new Error('the relay was not started');
  child.take();
  await flush();
  return { pending, child };
}
async function opened(r: Rig, deviceId = 'CAM-01', patch: Partial<CameraSourceTarget> = {}, signal: AbortSignal = never): Promise<{ handle: { deviceId: string; close(): Promise<void> }; child: FakeChild }> {
  const { pending, child } = await opening(r, deviceId, patch, signal);
  child.say(established(patch.attempt ?? 1));
  const handle = (await pending) as { deviceId: string; close(): Promise<void> };
  expect(handle).not.toBeInstanceOf(Error);
  return { handle, child };
}

describe('T-1: the order of an open (addendum 2.3 step 3)', () => {
  it('stored facts, ONE read of the credential, ONE locator read, the relay start; the open resolves at the relay\'s report and not before', async () => {
    const r = rig();
    const { pending, child } = await opening(r);
    expect(r.calls).toEqual(['stream CAM-01 HEVC_1080P', 'reader', 'locate', 'door']);
    expect(r.readerCalls).toEqual([{ deviceId: 'CAM-01', sessionId: SESSION }]);
    expect(r.locateCalls).toHaveLength(1);
    expect(r.locateCalls[0]?.candidate).toBe(CANDIDATE);
    expect(r.locateCalls[0]?.token).toBe(TOKEN);
    // The credential the locator read was handed is the reader's own opaque object.
    expect(r.locateCalls[0]?.sealed).toBeInstanceOf(SealedCredential);
    // Not open yet: the message was taken, the relay has not said that the worker took its push.
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await flush();
    expect(settled).toBe(false);
    expect(r.reports).toEqual([]);
    child.say(established(1));
    const handle = (await pending) as { deviceId: string };
    expect(handle.deviceId).toBe('CAM-01');
    // The relay's side of the pairing: session, device and attempt, once, before the open resolved.
    expect(r.reports).toEqual([{ sessionId: SESSION, deviceId: 'CAM-01', attempt: 1 }]);
    expect(r.adapter.counts()).toEqual({ live: 1, droppedReports: 0 });
    // The bound of the open was asked for once, 25,000 ms, and is cancelled.
    expect(CAMERA_OPEN_BOUND_MS).toBe(25_000);
    expect(r.timers.asked).toEqual([25_000]);
    expect(r.timers.pending()).toBe(0);
  });

  it('the relay is started with no argument, an empty environment and the start message of its contract, byte for byte', async () => {
    const r = rig();
    const { child } = await opened(r, 'CAM-01', { attempt: 3 });
    expect(child.options.command).toBe(PROGRAM);
    expect(child.options.args).toEqual([]);
    expect(child.options.env).toEqual({});
    expect(child.options.message).not.toBeNull();
    // The stream access of the message prints as the mark: the account and the locator can be read by the serialiser only.
    expect(leaks(everything(child.options.message)).filter((needle) => needle !== INGEST && needle !== INGEST_ELEMENT)).toEqual([]);
    const bytes = startMessageBytes(child.options.message ?? {});
    const expected = `{"type":"start","mode":"record","ingest":"${INGEST}","attempt":3,"access":{"locator":"${LOCATOR}","username":"${ACCOUNT.username}","secret":"${ACCOUNT.secret}"}}\n`;
    expect(bytes.equals(Buffer.from(expected, 'utf8'))).toBe(true);
    bytes.fill(0);
  });

  it('keyed by device AND profile: a second profile of the same camera opens beside the first; the same pair is refused while its relay lives', async () => {
    const r = rig();
    const first = await opened(r, 'CAM-01', { profile: 'HEVC_1080P' });
    const second = await opened(r, 'CAM-01', { profile: 'H264_720P' });
    expect(r.children).toHaveLength(2);
    expect(r.adapter.counts().live).toBe(2);
    const again = await outcomeOf(r.adapter.openSource('CAM-01', target({ profile: 'HEVC_1080P' }), never));
    expect(again).toMatchObject({ name: 'CameraOpenError', code: CameraOpenRefusal.ALREADY_OPEN, deviceId: 'CAM-01' });
    expect(r.children).toHaveLength(2);
    // The refused open did not end the live source.
    expect(first.child.alive).toBe(true);
    await first.handle.close();
    await second.handle.close();
    expect(r.adapter.counts().live).toBe(0);
    // After its close the pair can be opened again: a second reveal, a second locator read.
    await opened(r, 'CAM-01', { profile: 'HEVC_1080P' });
    expect(r.readerCalls).toHaveLength(3);
    expect(r.locateCalls).toHaveLength(3);
  });
});

describe('T-1: refusals before anything is asked', () => {
  it('an aborted signal, an unknown device, no profile (C36), a profile that is no code, no session, no attempt, no relay program', async () => {
    const r = rig();
    const aborted = new AbortController();
    aborted.abort();
    const cases: [unknown, string][] = [
      [await outcomeOf(r.adapter.openSource('CAM-01', target(), aborted.signal)), 'CAPTURE_ADAPTER_ABORTED'],
      [await outcomeOf(r.adapter.openSource('CAM-09', target(), never)), 'CAPTURE_DEVICE_UNKNOWN'],
      [await outcomeOf(r.adapter.openSource('CAM-01', { ingestUrl: INGEST, sessionId: SESSION, attempt: 1 }, never)), 'CAPTURE_PROFILE_UNKNOWN'],
      [await outcomeOf(r.adapter.openSource('CAM-01', target({ profile: 'main stream' }), never)), 'CAPTURE_PROFILE_UNKNOWN'],
      [await outcomeOf(r.adapter.openSource('CAM-01', { ingestUrl: INGEST, profile: 'HEVC_1080P', attempt: 1 }, never)), 'CAPTURE_CAMERA_SESSION_UNKNOWN'],
      [await outcomeOf(r.adapter.openSource('CAM-01', { ingestUrl: INGEST, profile: 'HEVC_1080P', sessionId: SESSION }, never)), 'CAPTURE_CAMERA_SESSION_UNKNOWN'],
      [await outcomeOf(r.adapter.openSource('CAM-01', target({ attempt: 0 }), never)), 'CAPTURE_CAMERA_SESSION_UNKNOWN'],
      [await outcomeOf(r.adapter.openSource('CAM-01', target({ attempt: 1.5 }), never)), 'CAPTURE_CAMERA_SESSION_UNKNOWN'],
      // Beyond the largest attempt the relay takes in its start message.
      [await outcomeOf(r.adapter.openSource('CAM-01', target({ attempt: 1_000_000_000 }), never)), 'CAPTURE_CAMERA_SESSION_UNKNOWN'],
    ];
    for (const [error, code] of cases) {
      expect(error).toBeInstanceOf(Error);
      expect((error as { code?: string }).code).toBe(code);
      expect(leaks(everything(error))).toEqual([]);
    }
    // Nothing was asked: no stored fact, no reveal, no request to a camera, no process.
    expect(r.calls).toEqual([]);
    expect(r.adapter.counts().live).toBe(0);
    expect(r.timers.asked).toEqual([]);

    const unconfigured = rig({ relayProgram: null });
    expect(await outcomeOf(unconfigured.adapter.openSource('CAM-01', target(), never))).toMatchObject({ code: CameraOpenRefusal.RELAY_NOT_CONFIGURED });
    expect(unconfigured.calls).toEqual([]);
  });

  it('no stored stream of the profile: refused `CAPTURE_PROFILE_UNKNOWN` with 0 reveals; no default profile is tried', async () => {
    const r = rig();
    r.stream = async () => null;
    const error = await outcomeOf(r.adapter.openSource('CAM-02', target({ profile: 'H264_1080P' }), never));
    expect(error).toBeInstanceOf(CaptureAdapterError);
    expect(error).toMatchObject({ code: 'CAPTURE_PROFILE_UNKNOWN', deviceId: 'CAM-02' });
    // One question, for the profile the plan stated, and nothing after it.
    expect(r.calls).toEqual(['stream CAM-02 H264_1080P']);
    expect(r.adapter.counts().live).toBe(0);
    expect(r.timers.pending()).toBe(0);
    r.stream = async () => {
      throw new Error(`read failed at ${CAMERA_HOST}`);
    };
    const failed = await outcomeOf(r.adapter.openSource('CAM-02', target({ profile: 'H264_1080P' }), never));
    expect(failed).toMatchObject({ code: CameraOpenRefusal.STREAM_FACTS_NOT_READ });
    expect(leaks(everything(failed))).toEqual([]);
  });
});

describe('T-1: the named refusals of the camera path', () => {
  it('the reader answers no credential: its code is the reason; no request to the camera, no process', async () => {
    for (const code of ['CAPTURE_CREDENTIAL_ADDRESS_REFUSED', 'CAPTURE_CREDENTIAL_DEVICE_REFUSED', 'CAPTURE_CREDENTIAL_NOT_STORED', 'CAPTURE_CREDENTIAL_REVEAL_FAILED', 'CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED']) {
      const r = rig();
      r.reader = async () => {
        throw Object.assign(new Error(`not read for ${ACCOUNT.username}`), { code });
      };
      const error = await outcomeOf(r.adapter.openSource('CAM-01', target(), never));
      expect(error).toBeInstanceOf(CameraOpenError);
      expect(error).toMatchObject({ code: CameraOpenRefusal.CREDENTIAL_NOT_READ, deviceId: 'CAM-01', reason: code });
      expect((error as Error).cause).toBeUndefined();
      expect(leaks(everything(error))).toEqual([]);
      expect(r.calls).toEqual(['stream CAM-01 HEVC_1080P', 'reader']);
      expect(r.adapter.counts().live).toBe(0);
    }
    // A reason that is not a code word is not carried.
    const r = rig();
    r.reader = async () => {
      throw Object.assign(new Error('x'), { code: `secret is ${ACCOUNT.secret}` });
    };
    expect(await outcomeOf(r.adapter.openSource('CAM-01', target(), never))).toMatchObject({ code: CameraOpenRefusal.CREDENTIAL_NOT_READ, reason: null });
  });

  it('the locator read: a refused credential, an absent camera and an unusable address are three codes; no process is started', async () => {
    const cases: [OnvifLocatorResult, CameraOpenRefusal, string][] = [
      [located(ConnectionTestOutcome.AUTHENTICATION_FAILED, null, 'CREDENTIAL_REJECTED' as OnvifLocatorResult['reason']), CameraOpenRefusal.AUTHENTICATION_REFUSED, 'CREDENTIAL_REJECTED'],
      [located(ConnectionTestOutcome.UNREACHABLE, null, 'NO_ANSWER' as OnvifLocatorResult['reason']), CameraOpenRefusal.UNREACHABLE, 'NO_ANSWER'],
      [located(ConnectionTestOutcome.WRONG_PROFILE, null, 'STREAM_HOST_MISMATCH' as OnvifLocatorResult['reason']), CameraOpenRefusal.LOCATOR_REFUSED, 'STREAM_HOST_MISMATCH'],
      [located(ConnectionTestOutcome.WRONG_PROFILE, null, 'STREAM_LOCATOR_FORM' as OnvifLocatorResult['reason']), CameraOpenRefusal.LOCATOR_REFUSED, 'STREAM_LOCATOR_FORM'],
    ];
    for (const [answer, code, reason] of cases) {
      const r = rig();
      r.locate = async () => answer;
      const error = await outcomeOf(r.adapter.openSource('CAM-01', target(), never));
      expect(error).toMatchObject({ name: 'CameraOpenError', code, deviceId: 'CAM-01', reason });
      expect(r.calls).toEqual(['stream CAM-01 HEVC_1080P', 'reader', 'locate']);
      expect(r.children).toEqual([]);
      expect(r.adapter.counts().live).toBe(0);
    }
    // A refusal of the locator read before any request is the layer's own error and stays one.
    const r = rig();
    r.locate = async () => {
      throw new CaptureAdapterError('CAPTURE_LOCATOR_INVALID');
    };
    expect(await outcomeOf(r.adapter.openSource('CAM-01', target(), never))).toMatchObject({ name: 'CaptureAdapterError', code: 'CAPTURE_LOCATOR_INVALID' });
  });

  it('a locator the injection point refuses starts no process; a locator with a query inside the rule is injected', async () => {
    const r = rig();
    r.locate = async () => located(ConnectionTestOutcome.REACHABLE, `${SCHEME}://${ACCOUNT.username}@${CAMERA_HOST}/stream`);
    const error = await outcomeOf(r.adapter.openSource('CAM-01', target(), never));
    expect(error).toMatchObject({ name: 'CaptureAdapterError', code: 'CAPTURE_LOCATOR_INVALID' });
    expect(leaks(everything(error))).toEqual([]);
    expect(r.children).toEqual([]);
    expect(r.adapter.counts().live).toBe(0);
    // The default locator of this file carries a query (row 174): the relay was started with it (the byte comparison above).
    expect(LOCATOR.includes('?')).toBe(true);
  });

  it('the door refuses the start: `CAPTURE_CAMERA_RELAY_NOT_STARTED` with the door\'s code', async () => {
    for (const refusal of [ProductionDoorRefusal.CORE_FILE_LIMIT_NOT_ZERO, ProductionDoorRefusal.PROGRAM_NOT_STARTED, ProductionDoorRefusal.START_MESSAGE_TIMEOUT]) {
      const r = rig();
      const pending = outcomeOf(r.adapter.openSource('CAM-01', target(), never));
      await flush();
      r.children[0]?.refuse(refusal);
      const error = await pending;
      expect(error).toMatchObject({ name: 'CameraOpenError', code: CameraOpenRefusal.RELAY_NOT_STARTED, reason: refusal });
      expect(r.adapter.counts().live).toBe(0);
      expect(r.reports).toEqual([]);
    }
  });

  it('every exit code of the relay is a named refusal: wrong password, Basic-only, absent camera, a refused push and the rest; nothing is reported to the pairing', async () => {
    const table: [number, CameraOpenRefusal, string][] = [
      [0, CameraOpenRefusal.RELAY_STOPPED, 'STOPPED'],
      [2, CameraOpenRefusal.RELAY_FAILED, 'USAGE'],
      [10, CameraOpenRefusal.RELAY_FAILED, 'START_MESSAGE_INVALID'],
      [11, CameraOpenRefusal.RELAY_FAILED, 'START_MESSAGE_TIMEOUT'],
      [12, CameraOpenRefusal.RELAY_FAILED, 'LIBAVFORMAT_VERSION_MISMATCH'],
      [13, CameraOpenRefusal.RELAY_FAILED, 'HYGIENE_FAILED'],
      [20, CameraOpenRefusal.UNREACHABLE, 'CAMERA_UNREACHABLE'],
      [21, CameraOpenRefusal.STREAM_REFUSED, 'CAMERA_PROTOCOL'],
      [22, CameraOpenRefusal.AUTH_SCHEME_REFUSED, 'AUTH_SCHEME_NOT_ALLOWED'],
      [23, CameraOpenRefusal.AUTHENTICATION_REFUSED, 'AUTH_REFUSED'],
      [24, CameraOpenRefusal.LOCATOR_REFUSED, 'LOCATOR_NOT_FOUND'],
      [25, CameraOpenRefusal.STREAM_REFUSED, 'REDIRECT_REFUSED'],
      [26, CameraOpenRefusal.STREAM_REFUSED, 'CONTROL_ADDRESS_REFUSED'],
      [27, CameraOpenRefusal.STREAM_REFUSED, 'DESCRIPTION_INVALID'],
      [28, CameraOpenRefusal.STREAM_REFUSED, 'CODEC_NOT_SUPPORTED'],
      [29, CameraOpenRefusal.STREAM_REFUSED, 'TRANSPORT_REFUSED'],
      [30, CameraOpenRefusal.STREAM_REFUSED, 'KEYFRAME_TIMEOUT'],
      [31, CameraOpenRefusal.STREAM_LOST, 'CAMERA_STALLED'],
      [32, CameraOpenRefusal.STREAM_LOST, 'CAMERA_LOST'],
      [33, CameraOpenRefusal.STREAM_REFUSED, 'STREAM_INVALID'],
      [40, CameraOpenRefusal.INGEST_REFUSED, 'INGEST_REFUSED'],
      [41, CameraOpenRefusal.INGEST_LOST, 'INGEST_LOST'],
      [42, CameraOpenRefusal.RELAY_FAILED, 'SOCKET_RULE'],
      [43, CameraOpenRefusal.RELAY_FAILED, 'REPORT_NOT_WRITTEN'],
      [70, CameraOpenRefusal.RELAY_FAILED, 'INTERNAL'],
      [99, CameraOpenRefusal.RELAY_FAILED, 'EXIT_CODE_UNKNOWN'],
    ];
    // The table is the relay's own list (`apps/capture-worker/src/relay/relay.h`): every code the header names, with its word.
    const header = readFileSync(resolve(__dirname, '../../../../../../capture-worker/src/relay/relay.h'), 'utf8');
    const named = [...header.matchAll(/^\s+RELAY_([A-Z0-9_]+) = (\d+),?/gm)].map((match) => [Number(match[2]), match[1]] as const).filter(([code]) => code !== 1);
    expect(named.length).toBeGreaterThanOrEqual(24);
    for (const [code, word] of named) expect(relayEndOf({ exitCode: code, signal: null, spawnFailed: false }).reason, `exit ${code}`).toBe(word);
    expect(table.filter(([code]) => code !== 99).map(([code]) => code).sort((a, b) => a - b)).toEqual(named.map(([code]) => code).sort((a, b) => a - b));

    for (const [exitCode, code, reason] of table) {
      const r = rig();
      const { pending, child } = await opening(r);
      child.exit(exitCode);
      const error = await pending;
      expect(error, `exit ${exitCode}`).toMatchObject({ name: 'CameraOpenError', code, deviceId: 'CAM-01', reason });
      expect(leaks(everything(error))).toEqual([]);
      expect(r.reports).toEqual([]);
      expect(r.ends).toEqual([]);
      expect(r.adapter.counts().live).toBe(0);
      expect(r.timers.pending()).toBe(0);
    }
    expect(relayEndOf({ exitCode: null, signal: 'SIGSEGV', spawnFailed: false })).toEqual({ refusal: CameraOpenRefusal.RELAY_FAILED, reason: 'ENDED_BY_SIGNAL' });
    expect(relayEndOf({ exitCode: null, signal: null, spawnFailed: true })).toEqual({ refusal: CameraOpenRefusal.RELAY_NOT_STARTED, reason: 'NOT_STARTED' });
    // C35 (a) against C40 (2): an absent camera and a push the worker refused are two codes.
    expect(CameraOpenRefusal.UNREACHABLE).not.toBe(CameraOpenRefusal.INGEST_REFUSED);
  });
});

describe('T-1: the bound of an open and an aborted open (addendum 3.2; AD-09 (3))', () => {
  it('at 25,000 ms the open is refused `CAPTURE_CAMERA_OPEN_TIMEOUT`, at whichever step it stands; a started relay is killed and waited for first', async () => {
    // The reader does not answer.
    const slowReader = rig();
    slowReader.reader = () => new Promise(() => {});
    const first = outcomeOf(slowReader.adapter.openSource('CAM-01', target(), never));
    await flush();
    slowReader.timers.advance(24_999);
    await flush();
    expect(slowReader.adapter.counts().live).toBe(1);
    slowReader.timers.advance(1);
    expect(await first).toMatchObject({ name: 'CameraOpenError', code: CameraOpenRefusal.OPEN_TIMEOUT, deviceId: 'CAM-01' });
    expect(slowReader.calls).toEqual(['stream CAM-01 HEVC_1080P', 'reader']);
    expect(slowReader.adapter.counts().live).toBe(0);

    // The camera does not answer the locator read: the read's own signal is aborted at the bound.
    const slowCamera = rig();
    slowCamera.locate = () => new Promise(() => {});
    const second = outcomeOf(slowCamera.adapter.openSource('CAM-01', target(), never));
    await flush();
    expect(slowCamera.locateCalls[0]?.signal.aborted).toBe(false);
    slowCamera.timers.advance(25_000);
    expect(await second).toMatchObject({ code: CameraOpenRefusal.OPEN_TIMEOUT });
    expect(slowCamera.locateCalls[0]?.signal.aborted).toBe(true);
    expect(slowCamera.children).toEqual([]);

    // The relay was started and never reports: killed, and the open rejects only when it has ended.
    const silent = rig();
    const { pending, child } = await opening(silent);
    child.diesOnKill = false;
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    silent.timers.advance(25_000);
    await flush();
    expect(child.signals).toEqual(['SIGKILL']);
    expect(settled).toBe(false);
    child.exit(null, 'SIGKILL');
    expect(await pending).toMatchObject({ code: CameraOpenRefusal.OPEN_TIMEOUT });
    expect(silent.adapter.counts().live).toBe(0);
    expect(silent.reports).toEqual([]);
    expect(silent.timers.pending()).toBe(0);
  });

  it('a relay that was started but had not taken its message at the bound is killed too', async () => {
    const r = rig();
    const pending = outcomeOf(r.adapter.openSource('CAM-01', target(), never));
    await flush();
    r.timers.advance(25_000);
    expect(await pending).toMatchObject({ code: CameraOpenRefusal.OPEN_TIMEOUT });
    expect(r.children[0]?.signals).toEqual(['SIGKILL']);
    expect(r.adapter.counts().live).toBe(0);
  });

  it('an open aborted by its signal: `CAPTURE_ADAPTER_ABORTED`; the relay is killed and waited for; a report it still made is dropped', async () => {
    const r = rig();
    const abort = new AbortController();
    const { pending, child } = await opening(r, 'CAM-01', {}, abort.signal);
    child.diesOnKill = false;
    abort.abort();
    await flush();
    expect(child.signals).toEqual(['SIGKILL']);
    // The relay says its word in the instant after: it is being ended, the word reaches nobody (C37).
    child.say(established(1));
    child.exit(null, 'SIGKILL');
    expect(await pending).toMatchObject({ name: 'CaptureAdapterError', code: 'CAPTURE_ADAPTER_ABORTED', deviceId: 'CAM-01' });
    expect(r.reports).toEqual([]);
    expect(r.adapter.counts()).toEqual({ live: 0, droppedReports: 1 });
    expect(r.notes.map((note) => note.code)).toEqual(['CAPTURE_RELAY_REPORT_SUPERSEDED']);
    expect(r.ends).toEqual([]);
  });

  it('a killed relay that does not end inside 2,000 ms is said by a note, and forgotten only when it ends', async () => {
    const r = rig();
    const { pending, child } = await opening(r);
    child.diesOnKill = false;
    r.timers.advance(25_000);
    await flush();
    r.timers.advance(CAMERA_RELAY_REAP_BOUND_MS);
    expect(await pending).toMatchObject({ code: CameraOpenRefusal.OPEN_TIMEOUT });
    expect(r.notes.map((note) => note.code)).toEqual(['CAPTURE_RELAY_NOT_REAPED']);
    expect(r.adapter.counts().live).toBe(1);
    child.exit(null, 'SIGKILL');
    await flush();
    expect(r.adapter.counts().live).toBe(0);
  });
});

describe('T-1: the handle', () => {
  it('`close()` ends the relay by the end of its standard input and resolves when it has ended; twice is one close', async () => {
    const r = rig();
    const { handle, child } = await opened(r);
    child.endsOnInputEnd = false;
    let closed = false;
    const closing = handle.close().then(() => {
      closed = true;
    });
    const again = handle.close();
    await flush();
    expect(child.inputEnded).toBe(1);
    expect(child.signals).toEqual([]);
    expect(closed).toBe(false);
    child.exit(0);
    await closing;
    await again;
    expect(child.inputEnded).toBe(1);
    expect(r.adapter.counts().live).toBe(0);
    // A relay that was asked to end is no loss.
    expect(r.ends).toEqual([]);
    expect(r.timers.pending()).toBe(0);
  });

  it('a relay that does not end inside 3,000 ms of its order to stop is killed; one that still does not end is a named failure of the close', async () => {
    expect(CAMERA_RELAY_STOP_BOUND_MS).toBe(3_000);
    const r = rig();
    const { handle, child } = await opened(r);
    child.endsOnInputEnd = false;
    const closing = handle.close();
    await flush();
    r.timers.advance(2_999);
    await flush();
    expect(child.signals).toEqual([]);
    r.timers.advance(1);
    await flush();
    expect(child.signals).toEqual(['SIGKILL']);
    await closing;
    expect(r.adapter.counts().live).toBe(0);

    const stuck = rig();
    const other = await opened(stuck);
    other.child.endsOnInputEnd = false;
    other.child.diesOnKill = false;
    const failing = outcomeOf(other.handle.close());
    await flush();
    stuck.timers.advance(3_000);
    await flush();
    stuck.timers.advance(2_000);
    expect(await failing).toMatchObject({ name: 'CameraOpenError', code: CameraOpenRefusal.RELAY_NOT_REAPED, deviceId: 'CAM-01' });
    expect(stuck.notes.map((note) => note.code)).toEqual(['CAPTURE_RELAY_NOT_REAPED']);
  });

  it('a relay that dies after its open is reported ONCE with its named cause; a second end, a close after it and a late report say nothing more', async () => {
    const r = rig();
    const { handle, child } = await opened(r, 'CAM-02', { profile: 'H264_1080P', attempt: 2 });
    child.exit(32);
    await flush();
    expect(r.ends).toEqual([{ sessionId: SESSION, deviceId: 'CAM-02', attempt: 2, profile: 'H264_1080P', code: CameraOpenRefusal.STREAM_LOST, reason: 'CAMERA_LOST' }]);
    expect(r.adapter.counts().live).toBe(0);
    child.exit(41);
    await handle.close();
    await handle.close();
    await flush();
    expect(r.ends).toHaveLength(1);
    expect(leaks(everything(r.ends))).toEqual([]);
    // The worker going away under the push is its own cause.
    const lost = rig();
    const second = await opened(lost);
    second.child.exit(41);
    await flush();
    expect(lost.ends.map((end) => [end.code, end.reason])).toEqual([[CameraOpenRefusal.INGEST_LOST, 'INGEST_LOST']]);
  });

  // Task 4 row 49 (WP-06c): the loss callback behind `relayEnded`, wired as the composition of row 85 wires it.
  it('row 49: a killed fixture raises 1 fault and clears 1 - the relay that dies is the camera watch\'s loss, the next established push of that camera ends it; a closed source raises nothing', async () => {
    const raised: unknown[] = [];
    const cleared: unknown[] = [];
    const changes: unknown[] = [];
    const watchTimers = manualTimers();
    const watch = createCameraWatch({
      timers: watchTimers,
      now: () => 0,
      reader: { read: async () => ({ answered: false, cameraUtcMs: null }) },
      candidate: async () => CANDIDATE,
      faults: { raise: (fault) => void raised.push(fault), clear: (fault) => void cleared.push(fault) },
      onChange: (change) => changes.push(change),
    });
    const r = rig({ relayEnded: (end) => watch.relayEnded(end) });
    r.adapter.relayReports.subscribe((report) => watch.pushEstablished(report));
    const first = await opened(r);
    expect([raised, cleared]).toEqual([[], []]);
    // The camera fixture is killed: its relay ends with the code of a lost camera.
    first.child.exit(32);
    await flush();
    expect(raised).toEqual([{ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' }]);
    expect(cleared).toEqual([]);
    expect(watch.lost()).toEqual(['CAM-01']);
    // A push that is refused clears nothing: the open fails and no report reaches the watch.
    const refused = await opening(r, 'CAM-01', { attempt: 2 });
    refused.child.exit(20);
    expect(await refused.pending).toMatchObject({ code: CameraOpenRefusal.UNREACHABLE });
    expect(cleared).toEqual([]);
    // The fixture is back: the next open of the camera is established.
    const second = await opened(r, 'CAM-01', { attempt: 3 });
    expect(raised).toHaveLength(1);
    expect(cleared).toEqual([{ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' }]);
    expect(watch.lost()).toEqual([]);
    expect(changes).toEqual([
      { deviceId: 'CAM-01', event: 'STREAM_LOST', cause: CameraOpenRefusal.STREAM_LOST },
      { deviceId: 'CAM-01', event: 'STREAM_RETURNED', cause: null },
    ]);
    // A source the session closes is no loss.
    await second.handle.close();
    await flush();
    expect([raised.length, cleared.length]).toEqual([1, 1]);
    expect(leaks(everything([raised, cleared, changes]))).toEqual([]);
    expect(watchTimers.asked).toEqual([]);
  });

  it('row 49: `ntpOffsetMs` is the clock read handed in, for a served camera only; without it the member refuses as class C', async () => {
    const asked: string[] = [];
    const r = rig({
      clock: async (deviceId) => {
        asked.push(deviceId);
        return -412;
      },
    });
    expect(await r.adapter.ntpOffsetMs('CAM-02')).toBe(-412);
    expect(await outcomeOf(r.adapter.ntpOffsetMs('CAM-09'))).toMatchObject({ code: 'CAPTURE_DEVICE_UNKNOWN' });
    expect(asked).toEqual(['CAM-02']);
    // The read is no open: no credential read, no locator read, no process.
    expect(r.calls).toEqual([]);
    expect(await outcomeOf(rig().adapter.ntpOffsetMs('CAM-01'))).toMatchObject({ code: 'CAPTURE_ADAPTER_CLASS_C' });
  });

  it('the signal of the open stays the relay\'s: aborted after the open, the source is closed by its order to stop', async () => {
    const r = rig();
    const abort = new AbortController();
    const { child } = await opened(r, 'CAM-01', {}, abort.signal);
    abort.abort();
    await flush();
    expect(child.inputEnded).toBe(1);
    expect(child.alive).toBe(false);
    expect(r.adapter.counts().live).toBe(0);
    expect(r.ends).toEqual([]);
  });
});

describe('T-1: the relay\'s reports (RC-3 (i); C37)', () => {
  it('a report of an attempt a later open of the session superseded is dropped and counted; the attempt in force is reported', async () => {
    const r = rig();
    // Attempt 1: its relay is started and has not reported when the worker is restarted.
    const old = await opening(r, 'CAM-01', { attempt: 1 });
    // Attempt 2 of the same session, the other camera: opened and reported.
    const fresh = await opened(r, 'CAM-02', { profile: 'H264_1080P', attempt: 2 });
    expect(r.reports).toEqual([{ sessionId: SESSION, deviceId: 'CAM-02', attempt: 2 }]);
    // The relay of attempt 1 says its word now: superseded, dropped, counted, noted - never handed to the pairing.
    old.child.say(established(1));
    await flush();
    expect(r.reports).toHaveLength(1);
    expect(r.adapter.counts().droppedReports).toBe(1);
    expect(r.notes).toEqual([{ code: 'CAPTURE_RELAY_REPORT_SUPERSEDED', sessionId: SESSION, deviceId: 'CAM-01', attempt: 1 }]);
    // Its open does not come up on that word either: it ends at its bound, killed.
    r.timers.advance(25_000);
    expect(await old.pending).toMatchObject({ code: CameraOpenRefusal.OPEN_TIMEOUT });
    await fresh.handle.close();
  });

  it('a report after the close began is dropped; a report that names another attempt than the relay\'s own is not this relay\'s word', async () => {
    const r = rig();
    const { handle, child } = await opened(r);
    child.endsOnInputEnd = false;
    const closing = handle.close();
    child.say(established(1));
    child.exit(0);
    await closing;
    expect(r.reports).toHaveLength(1);
    expect(r.adapter.counts().droppedReports).toBe(1);

    const other = rig();
    const pendingOpen = await opening(other, 'CAM-01', { attempt: 4 });
    pendingOpen.child.say(established(5));
    await flush();
    expect(other.reports).toEqual([]);
    expect(other.notes.map((note) => note.code)).toEqual(['CAPTURE_RELAY_REPORT_ATTEMPT_DIFFERS']);
    pendingOpen.child.say(established(4));
    expect(await pendingOpen.pending).toMatchObject({ deviceId: 'CAM-01' });
    expect(other.reports).toEqual([{ sessionId: SESSION, deviceId: 'CAM-01', attempt: 4 }]);
  });

  it('a second report of a live relay is handed on as it came (the pairing judges it); a listener that throws stops nothing', async () => {
    const r = rig();
    r.adapter.relayReports.subscribe(() => {
      throw new Error('listener');
    });
    const { child } = await opened(r);
    child.say(established(1));
    await flush();
    expect(r.reports).toHaveLength(2);
    expect(r.notes.map((note) => note.code)).toEqual(['CAPTURE_RELAY_LISTENER_FAILED', 'CAPTURE_RELAY_LISTENER_FAILED']);
    // Unsubscribed: no further word.
    const seen: CameraRelayReport[] = [];
    const off = r.adapter.relayReports.subscribe((report) => seen.push(report));
    off();
    child.say(established(1));
    expect(seen).toEqual([]);
  });

  it('the report reader: whole lines of the fixed form only; split chunks are joined; anything else is counted and dropped', () => {
    const seen: RelayReport[] = [];
    const reader = createRelayReportReader((report) => seen.push(report));
    reader.push(Buffer.from('{"report":"push_estab'));
    reader.push(Buffer.from(`lished","v":1,"attempt":7}\n${established(8)}`));
    expect(seen).toEqual([
      { kind: RelayReportKind.PUSH_ESTABLISHED, attempt: 7 },
      { kind: RelayReportKind.PUSH_ESTABLISHED, attempt: 8 },
    ]);
    expect(reader.rejected()).toBe(0);
    const refused = [
      // The relay's word for "the start message stated no attempt": the Core always states one.
      '{"report":"push_established","v":1,"attempt":0}',
      '{"report":"push_established","v":1,"attempt":"1"}',
      '{"report":"push_established","v":1,"attempt":1234567890}',
      '{"report":"push_established","v":2,"attempt":1}',
      '{"report":"push_established","attempt":1}',
      '{"report":"push_established","v":1,"attempt":1,"more":1}',
      ' {"report":"push_established","v":1,"attempt":1}',
      // The probe's line is no report of a record-mode relay, and the mark of standard error is none either.
      '{"report":"probe","v":1,"attempt":1,"codec":"HEVC","width":1920,"height":1080}',
      '{"relay":"push_open","code":"RUNNING","rc":0}',
      `{"report":"push_established","v":1,"attempt":1,"ingest":"${INGEST}"}`,
      'x'.repeat(RELAY_REPORT_LINE_MAX_BYTES + 1),
      '',
    ];
    for (const text of refused) reader.push(Buffer.from(`${text}\n`));
    expect(seen).toHaveLength(2);
    expect(reader.rejected()).toBe(refused.length);
    // An endless line is never kept: it is dropped to its line feed, and the next line is read again.
    for (let chunk = 0; chunk < 64; chunk += 1) reader.push(Buffer.alloc(1_024, 0x41));
    reader.push(Buffer.from(`tail\n${established(9)}`));
    expect(seen.at(-1)).toEqual({ kind: RelayReportKind.PUSH_ESTABLISHED, attempt: 9 });
    expect(reader.rejected()).toBe(refused.length + 1);
  });
});

describe('T-1: what the adapter is and is not', () => {
  it('`pullUrl` refuses by a named code; the members of other rows refuse as class C; the adapter states an opener of the production kind', async () => {
    const { adapter } = rig();
    expect(adapter.seam).toBe('CAMERA');
    expect(adapter.kind).toBe(CaptureAdapterKind.ONVIF_RTSP);
    expect(adapter.hasOpener).toBe(true);
    expect(adapter.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02']);
    let thrown: unknown = null;
    try {
      adapter.pullUrl('CAM-01', 'HEVC_1080P');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ name: 'CameraOpenError', code: 'CAPTURE_CAMERA_LOCATOR_RESOLVED_AT_OPEN', deviceId: 'CAM-01' });
    const signal = never;
    for (const pending of [adapter.discover({ windowMs: 1, signal }), adapter.testConnection(CANDIDATE, null, signal), adapter.profiles('CAM-01'), adapter.ntpOffsetMs('CAM-01')]) {
      expect(await outcomeOf(pending)).toMatchObject({ code: 'CAPTURE_ADAPTER_CLASS_C' });
    }
  });

  it('no credential, locator or address element is in any error, report, note or end of a whole life of a source', async () => {
    const r = rig();
    const texts: string[] = [];
    const { handle, child } = await opened(r);
    texts.push(everything(handle), everything(r.adapter), everything(r.reports), everything(r.adapter.counts()));
    child.exit(23);
    await flush();
    texts.push(everything(r.ends), everything(r.notes));
    r.locate = async () => located(ConnectionTestOutcome.AUTHENTICATION_FAILED, null);
    texts.push(everything(await outcomeOf(r.adapter.openSource('CAM-01', target(), never))));
    expect(leaks(texts.join('\n'))).toEqual([]);
    // The credential itself was never copied out of its object by the adapter: the double still reads the same two values.
    expect(usingCredential(r.locateCalls[0]?.sealed as SealedCredential, (inner) => inner.username === ACCOUNT.username && inner.secret === ACCOUNT.secret)).toBe(true);
  });

  it('the sources: the ingest address is named at one line and goes to the relay start only; nothing is kept per device; no unit of work, no log, no clock', () => {
    const strip = (text: string): string[] =>
      text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, '').trim())
        .filter((line) => line !== '');
    const adapter = strip(readFileSync(resolve(__dirname, '../onvif-relay.ts'), 'utf8'));
    const relayStart = strip(readFileSync(resolve(__dirname, '../relay-start.ts'), 'utf8'));
    // AD-05 (1), BR-07 (4): the address of the target stands at ONE line, as an argument of the relay start.
    const naming = adapter.filter((line) => /\bingestUrl\b/.test(line));
    expect(naming).toHaveLength(1);
    expect(naming[0]).toMatch(/^const process = startCameraRelay\(\{ door, program: relayProgram, timers, locator: located\.locator, sealed, ingest: target\.ingestUrl, attempt, onOutput: \(chunk\) => reader\.push\(chunk\) \}\);$/);
    expect(adapter.filter((line) => /\btarget\b/.test(line) && !line.startsWith('async function openSource(') && line !== 'const { profile, sessionId, attempt } = target;')).toEqual(naming);
    // In the relay start it is a member of the message and of the options type, and nothing else.
    expect(relayStart.filter((line) => /\bingest\b/.test(line))).toEqual(['readonly ingest: string;', 'ingest: start.ingest,']);
    // The slot of a live relay holds identifiers and the process: no locator, no address, no credential member.
    const slot = adapter.slice(adapter.indexOf('interface Slot {'), adapter.indexOf('}', adapter.indexOf('interface Slot {')) + 1).join(' ');
    expect(slot).toBe('interface Slot { readonly deviceId: string; readonly profile: string; readonly sessionId: string; readonly attempt: number; process: ProductionProcess | null; ending: boolean; closed: Promise<void> | null; }');
    // The locator and the credential are locals of the open: named in `openSource` only, never assigned to a slot or a map.
    for (const line of adapter.filter((text) => /\b(?:sealed|located)\b/.test(text))) expect(line, line).not.toMatch(/\bslot\.|\.set\(|\blive\b|\bthis\./);
    // The adapter opens no unit of work, so a read can never be moved inside one here; it logs nothing and reads no clock.
    for (const source of [adapter, relayStart]) {
      const text = source.join('\n');
      expect(text).not.toMatch(/\bpipeline\b|\bunit\s*\(|\bafterCommit\b|\.run\s*\(/);
      expect(text).not.toMatch(/\bconsole\b|\blog\s*\.|errorLog|\.(?:warn|info|error|debug)\s*\(/);
      expect(text).not.toMatch(/\bDate\b|\bsetTimeout\b|\bsetInterval\b|process\s*\.\s*env/);
      expect(text).not.toMatch(/\.\s*(?:secret|username)\b/);
    }
    // One read of the credential per open, by the one method of the session's reason.
    expect(adapter.filter((line) => /\bcredentials\.\w+\(/.test(line))).toEqual(['sealed = await until(credentials.sessionOpen(deviceId, sessionId));']);
    // C36: no profile constant stands in for the plan's statement.
    expect(adapter.join('\n')).not.toMatch(/EMPTY_SLOT_PROFILE|H264_1080P25|DEFAULT_PROFILE/);
  });
});

describe('T-3: behind the rule (addendum 6.3; registry fact 1)', () => {
  it('the built adapter handed to a real registry is refused `CAPTURE_ADAPTER_INVALID`, in production and in development; nothing of it is registered', () => {
    for (const operation of [CaptureOperation.REAL_PRODUCTION, CaptureOperation.REAL_DEVELOPMENT]) {
      const registry = createCaptureDeviceRegistry({ operation });
      const { adapter } = rig();
      let thrown: unknown = null;
      try {
        registry.register(adapter);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, operation).toBeInstanceOf(CaptureAdapterError);
      expect(thrown, operation).toMatchObject({ code: 'CAPTURE_ADAPTER_INVALID' });
      expect(registry.list()).toEqual([]);
      expect(registry.openerKinds()).toEqual([]);
      expect(registry.cameraAdapters()).toEqual([]);
    }
    // The operation that records nothing registers no kind at all.
    let simulated: unknown = null;
    try {
      createCaptureDeviceRegistry({ operation: CaptureOperation.SIMULATED }).register(rig().adapter);
    } catch (error) {
      simulated = error;
    }
    expect(simulated).toMatchObject({ code: 'CAPTURE_ADAPTER_KIND_NOT_ALLOWED' });
  });
});
