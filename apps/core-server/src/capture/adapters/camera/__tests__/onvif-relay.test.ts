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
import { RELAY_COUNT_MAX, RELAY_LOSS_CAUSES, RELAY_REPORT_LINE_MAX_BYTES, RELAY_RETRY_TRIES, RelayReportKind, createRelayReportReader, type RelayReport } from '../relay-start';
import type { StoredCameraAddressRule } from '../stored-address';
import { ADMITTED_HOST, GATE_CLASSES, REAL_RULE, REFUSED_STORED_ADDRESSES, storedCameraAt } from './stored-address-cases';

const ACCOUNT = { username: ['row46', 'unit', 'account'].join('-'), secret: ['row46', 'unit', 'placeholder', 'Qx7Lm2'].join('-') } as const;
const CAMERA_HOST = '192.0.2.46';
/** Row 143b: the camera-interface address the rig's rule names as the source of every dial (a documentation address; nothing is dialled). */
const SOURCE_ADDRESS = '192.0.2.1';
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
/**
 * Row 143: the rule the rig hands in for the cases that are about something else. It admits the
 * ONE documentation address of this file's camera and refuses every other, so no case passes by a
 * rule that admits anything. The cases about the rule itself hand in the REAL one (`REAL_RULE`).
 */
const ADMIT_THE_TEST_CAMERA: StoredCameraAddressRule = (host) => (host === CAMERA_HOST ? { allowed: true, destination: { address: host, sourceAddress: SOURCE_ADDRESS } } : { allowed: false, refusal: 'OUTSIDE_CAMERA_SUBNET' });

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
  readonly locateCalls: { candidate: CameraCandidate; sealed: unknown; token: string; signal: AbortSignal; sourceAddress: string | undefined }[];
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
      locate: (candidate, sealed, token, signal, sourceAddress) => {
        calls.push('locate');
        locateCalls.push({ candidate, sealed, token, signal, sourceAddress });
        return state.locate(signal);
      },
    },
    stream: (deviceId, profile) => {
      calls.push(`stream ${deviceId} ${profile}`);
      return state.stream(deviceId, profile);
    },
    storedAddress: ADMIT_THE_TEST_CAMERA,
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
    expect(r.adapter.counts()).toEqual({ live: 1, droppedReports: 0, outOfOrderReports: 0 });
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
    // Row 143b: the member `source` - the camera-interface address the rule named - stands before the access.
    const expected = `{"type":"start","mode":"record","ingest":"${INGEST}","attempt":3,"source":"${SOURCE_ADDRESS}","access":{"locator":"${LOCATOR}","username":"${ACCOUNT.username}","secret":"${ACCOUNT.secret}"}}\n`;
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

// Task 4 row 143 (AD-02 (1); GATE CONDITION AD-02): the stored address is untrusted - the runtime database role can
// write it - so the destination rule is asked at EVERY open, about what is stored then, before the reader.
describe('row 143: the destination rule on the STORED address, at every open, before the reveal (AD-02 (1))', () => {
  /** A rig whose rule is the REAL one on hand-written host facts, with the rule's place in the order of an open recorded. */
  const realRig = (): Rig & { readonly ruled: [string, number | undefined][] } => {
    const ruled: [string, number | undefined][] = [];
    const r = rig({
      storedAddress: (host, port) => {
        ruled.push([host, port]);
        r.calls.push('rule');
        return REAL_RULE(host, port);
      },
    });
    return Object.assign(r, { ruled });
  };

  it('each of the five refused classes of the gate condition, and the further ones: the named code, 0 reveals, 0 locator reads, 0 relay starts', async () => {
    for (const className of GATE_CLASSES) expect(REFUSED_STORED_ADDRESSES.some((entry) => entry.className === className), className).toBe(true);
    for (const entry of REFUSED_STORED_ADDRESSES) {
      const r = realRig();
      r.stream = async () => ({ candidate: entry.candidate, onvifProfileToken: TOKEN });
      const error = await outcomeOf(r.adapter.openSource('CAM-01', target(), never));
      expect(error, entry.className).toBeInstanceOf(CameraOpenError);
      expect(error, entry.className).toMatchObject({ code: 'CAPTURE_CAMERA_ADDRESS_REFUSED', deviceId: 'CAM-01', reason: entry.refusal });
      // Nothing after the stored facts: no reveal (so no audit entry), no request to the camera, no process.
      expect(r.calls.filter((call) => call !== 'rule'), entry.className).toEqual(['stream CAM-01 HEVC_1080P']);
      expect(r.readerCalls, entry.className).toEqual([]);
      expect(r.locateCalls, entry.className).toEqual([]);
      expect(r.children, entry.className).toEqual([]);
      expect(r.reports).toEqual([]);
      expect(r.adapter.counts().live).toBe(0);
      expect(r.timers.pending()).toBe(0);
      // The refusal names the class by its code; the address is in nothing it carries.
      if (entry.candidate.host !== '') expect(everything(error).includes(entry.candidate.host), entry.className).toBe(false);
    }
  });

  it('an admitted address: the rule is asked once, after the stored facts and BEFORE the reader, about the stored host and the port of its service address', async () => {
    const r = realRig();
    r.stream = async () => ({ candidate: storedCameraAt(ADMITTED_HOST), onvifProfileToken: TOKEN });
    const { handle } = await opened(r);
    expect(r.calls).toEqual(['stream CAM-01 HEVC_1080P', 'rule', 'reader', 'locate', 'door']);
    expect(r.ruled).toEqual([[ADMITTED_HOST, undefined]]);
    // What is dialled is the candidate that was judged: the locator read got the same object.
    expect(r.locateCalls[0]?.candidate.host).toBe(ADMITTED_HOST);
    await handle.close();
  });

  it('EVERY open is judged anew: a row moved to loopback between two opens refuses the second (a re-open, a new relay), with no reveal for it', async () => {
    const r = realRig();
    let stored = storedCameraAt(ADMITTED_HOST);
    r.stream = async () => ({ candidate: stored, onvifProfileToken: TOKEN });
    const first = await opened(r);
    await first.handle.close();
    expect(r.readerCalls).toHaveLength(1);
    // The runtime database role updates the address (the finding of the security check).
    stored = storedCameraAt('127.0.0.1');
    const second = await outcomeOf(r.adapter.openSource('CAM-01', target({ attempt: 2 }), never));
    expect(second).toMatchObject({ code: CameraOpenRefusal.ADDRESS_REFUSED, reason: 'LOOPBACK' });
    expect(r.readerCalls).toHaveLength(1);
    expect(r.children).toHaveLength(1);
    // And back: the third open is judged again and passes.
    stored = storedCameraAt(ADMITTED_HOST);
    const third = await opened(r, 'CAM-01', { attempt: 3 });
    expect(r.ruled.map(([host]) => host)).toEqual([ADMITTED_HOST, '127.0.0.1', ADMITTED_HOST]);
    expect(r.readerCalls).toHaveLength(2);
    await third.handle.close();
  });

  it('no rule handed in: every open is refused `STORED_ADDRESS_RULE_ABSENT`; a rule that throws or answers no decision is refused too - nothing here is permissive', async () => {
    const without = rig({ storedAddress: undefined });
    expect(await outcomeOf(without.adapter.openSource('CAM-01', target(), never))).toMatchObject({ code: CameraOpenRefusal.ADDRESS_REFUSED, reason: 'STORED_ADDRESS_RULE_ABSENT' });
    expect(without.calls).toEqual(['stream CAM-01 HEVC_1080P']);
    for (const broken of [
      (): never => {
        throw new Error(`rule failed at ${CAMERA_HOST}`);
      },
      () => ({ allowed: 'yes' }),
      () => ({ allowed: true, destination: { address: '127.0.0.1' } }),
    ]) {
      const r = rig({ storedAddress: broken as unknown as StoredCameraAddressRule });
      const error = await outcomeOf(r.adapter.openSource('CAM-01', target(), never));
      expect(error).toMatchObject({ code: CameraOpenRefusal.ADDRESS_REFUSED, reason: 'STORED_ADDRESS_RULE_FAILED' });
      expect(r.readerCalls).toEqual([]);
      expect(r.children).toEqual([]);
      expect(leaks(everything(error))).toEqual([]);
    }
  });

  // Task 4 row 143b (S13-11 point 2): the SOURCE half of the rule. The judgement names the camera-interface address a
  // connection must be made FROM; every dial of an open - the locator read and the relay - is handed it, and none is made without.
  it('row 143b: the source address the rule names goes to BOTH dials of the open - the locator read and the start message of the relay - and is asked anew at every open', async () => {
    const r = realRig();
    r.stream = async () => ({ candidate: storedCameraAt(ADMITTED_HOST), onvifProfileToken: TOKEN });
    const first = await opened(r, 'CAM-01', { attempt: 4 });
    // The hand-written host facts name ONE camera-interface address: that one, not the office interface's.
    expect(r.locateCalls.map((call) => call.sourceAddress)).toEqual(['192.168.50.1']);
    const bytes = startMessageBytes(first.child.options.message ?? {});
    expect(bytes.toString('utf8').startsWith(`{"type":"start","mode":"record","ingest":"${INGEST}","attempt":4,"source":"192.168.50.1","access":{`)).toBe(true);
    bytes.fill(0);
    expect(first.child.options.args).toEqual([]);
    expect(first.child.options.env).toEqual({});
    await first.handle.close();
    const second = await opened(r, 'CAM-01', { attempt: 5 });
    expect(r.ruled).toHaveLength(2);
    expect(r.locateCalls.map((call) => call.sourceAddress)).toEqual(['192.168.50.1', '192.168.50.1']);
    await second.handle.close();
  });

  it('row 143b: an admission that names NO source address, or one that is not the strict form, is refused `STORED_ADDRESS_SOURCE_ABSENT` before the reveal - no dial is made as the host routes', async () => {
    const admissions: unknown[] = [
      { allowed: true },
      { allowed: true, destination: { address: CAMERA_HOST } },
      { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: null } },
      { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: '' } },
      { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: '0.0.0.0' } },
      { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: 'camera-interface' } },
      { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: '192.168.050.1' } },
      { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: '192.168.50.1:0' } },
      { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: ' 192.168.50.1' } },
      { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: '224.0.0.1' } },
      { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: '255.255.255.255' } },
      { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: '::1' } },
      { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: 3232248321 } },
      { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: ['192.168.50.1'] } },
    ];
    for (const [index, admission] of admissions.entries()) {
      const r = rig({ storedAddress: (() => admission) as unknown as StoredCameraAddressRule });
      const error = await outcomeOf(r.adapter.openSource('CAM-01', target(), never));
      expect(error, `admission ${index}`).toMatchObject({ name: 'CameraOpenError', code: CameraOpenRefusal.ADDRESS_REFUSED, deviceId: 'CAM-01', reason: 'STORED_ADDRESS_SOURCE_ABSENT' });
      // Nothing after the stored facts: no reveal (so no audit entry), no request to the camera, no process.
      expect(r.calls, `admission ${index}`).toEqual(['stream CAM-01 HEVC_1080P']);
      expect(r.readerCalls, `admission ${index}`).toEqual([]);
      expect(r.locateCalls, `admission ${index}`).toEqual([]);
      expect(r.children, `admission ${index}`).toEqual([]);
      expect(r.adapter.counts().live).toBe(0);
      expect(r.timers.pending()).toBe(0);
      expect(leaks(everything(error))).toEqual([]);
    }
  });

  it('the sources: the judgement stands at ONE line of the adapter, between the stored facts and the one read of the credential; the adapter names no address class and no host fact', () => {
    const lines = readFileSync(resolve(__dirname, '../onvif-relay.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter((line) => line !== '');
    const judged = lines.findIndex((line) => line === 'const judged = judgeStoredCamera(stored.candidate, dependencies.storedAddress);');
    const facts = lines.findIndex((line) => line === 'stored = await until(stream(deviceId, profile));');
    const reveal = lines.findIndex((line) => line === 'sealed = await until(credentials.sessionOpen(deviceId, sessionId));');
    expect(lines.filter((line) => /\bjudgeStoredCamera\s*\(/.test(line))).toHaveLength(1);
    expect(facts).toBeGreaterThan(0);
    expect(judged).toBeGreaterThan(facts);
    expect(reveal).toBeGreaterThan(judged);
    expect(lines[judged + 1]).toBe('if (!judged.allowed) throw new CameraOpenError(CameraOpenRefusal.ADDRESS_REFUSED, deviceId, judged.refusal);');
    // The candidate the locator read is handed is the judged one, by name.
    expect(lines.filter((line) => /\bstored\.candidate\b/.test(line))).toEqual([lines[judged], 'const located = await until(locator.locate(stored.candidate, sealed, stored.onvifProfileToken, inner.signal, from.sourceAddress));']);
    // Row 143b: THE SOURCE HALF stands on the two lines after the refusal, before the reveal; it is taken from the judgement
    // and from nothing else, and it goes to the locator read (above) and to the relay start - the two dials of an open.
    expect(lines.slice(judged + 2, judged + 4)).toEqual(['const from = storedCameraSourceOf(judged);', "if ('refusal' in from) throw new CameraOpenError(CameraOpenRefusal.ADDRESS_REFUSED, deviceId, from.refusal);"]);
    expect(reveal).toBeGreaterThan(judged + 3);
    expect(lines.filter((line) => /\bfrom\.sourceAddress\b/.test(line))).toHaveLength(2);
    expect(lines.filter((line) => /\bstartCameraRelay\s*\(/.test(line))).toHaveLength(1);
    expect(lines.find((line) => /\bstartCameraRelay\s*\(/.test(line))).toContain('source: from.sourceAddress,');
    expect(lines.filter((line) => /\bsourceAddress\b/.test(line) && !/\bfrom\.sourceAddress\b/.test(line))).toEqual([]);
    // No rule of its own: no address literal, no range, no loopback word in the adapter or the judgement file.
    const own = [lines.join('\n'), readFileSync(resolve(__dirname, '../stored-address.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')].join('\n');
    expect(own).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\blocalhost\b|\bloopback\b|decideDestination|DestinationPurpose|networkInterfaces/i);
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
    expect(r.adapter.counts()).toEqual({ live: 0, droppedReports: 1, outOfOrderReports: 0 });
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

// Finding F3-01 of the M3 review (verification/060_m3_review.md): since row 43 the relay says the loss of its camera
// leg inside a session and its re-open; the reader dropped both lines, so the Core raised nothing until the relay had
// used up its six tries (62 s of waits) and ended.
const cameraLost = (attempt: number, loss: number, cause = 32): string => `{"report":"camera_lost","v":1,"attempt":${attempt},"loss":${loss},"cause":${cause}}\n`;
const cameraReopened = (attempt: number, loss: number, tries = 1, heldBack = 25, gapMs = 3_040): string => `{"report":"camera_reopened","v":1,"attempt":${attempt},"loss":${loss},"tries":${tries},"held_back":${heldBack},"gap_ms":${gapMs}}\n`;

describe('finding F3-01: the relay\'s `camera_lost` and `camera_reopened` (row 43) are read, and told at once', () => {
  it('the reader: each of the two lines in the relay\'s own form, whole and split; the bounds of every number are the relay\'s', () => {
    const seen: RelayReport[] = [];
    const reader = createRelayReportReader((report) => seen.push(report));
    reader.push(Buffer.from(cameraLost(7, 1)));
    const whole = cameraReopened(7, 1, 3, 25, 8_103);
    reader.push(Buffer.from(whole.slice(0, 31)));
    reader.push(Buffer.from(whole.slice(31)));
    for (const cause of RELAY_LOSS_CAUSES) reader.push(Buffer.from(cameraLost(RELAY_COUNT_MAX, RELAY_COUNT_MAX, cause)));
    reader.push(Buffer.from(cameraReopened(1, 1, RELAY_RETRY_TRIES, 0, 0) + cameraReopened(1, 2, 1, RELAY_COUNT_MAX, RELAY_COUNT_MAX)));
    expect(seen).toEqual([
      { kind: RelayReportKind.CAMERA_LOST, attempt: 7, loss: 1, cause: 32 },
      { kind: RelayReportKind.CAMERA_REOPENED, attempt: 7, loss: 1, tries: 3, heldBack: 25, gapMs: 8_103 },
      ...[20, 23, 31, 32].map((cause) => ({ kind: RelayReportKind.CAMERA_LOST, attempt: 999_999_999, loss: 999_999_999, cause })),
      { kind: RelayReportKind.CAMERA_REOPENED, attempt: 1, loss: 1, tries: 6, heldBack: 0, gapMs: 0 },
      { kind: RelayReportKind.CAMERA_REOPENED, attempt: 1, loss: 2, tries: 1, heldBack: 999_999_999, gapMs: 999_999_999 },
    ]);
    expect(reader.rejected()).toBe(0);
    expect(seen.every((report) => Object.isFrozen(report))).toBe(true);
    // The longest line the relay can make is far inside the bound of one line.
    expect(Buffer.byteLength(cameraReopened(RELAY_COUNT_MAX, RELAY_COUNT_MAX, 6, RELAY_COUNT_MAX, RELAY_COUNT_MAX))).toBeLessThan(RELAY_REPORT_LINE_MAX_BYTES / 2);
  });

  it('the reader: a line that differs from the form by a member, an order, a sign, a digit or a byte is counted and dropped - an unknown line is still refused', () => {
    const seen: RelayReport[] = [];
    const reader = createRelayReportReader((report) => seen.push(report));
    const refused = [
      // camera_lost: a member missing, one too many, another order, another version.
      '{"report":"camera_lost","v":1,"attempt":1,"loss":1}',
      '{"report":"camera_lost","v":1,"attempt":1,"cause":32}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":1,"cause":32,"more":1}',
      '{"report":"camera_lost","v":1,"loss":1,"attempt":1,"cause":32}',
      '{"report":"camera_lost","v":2,"attempt":1,"loss":1,"cause":32}',
      '{"report":"camera_lost","attempt":1,"loss":1,"cause":32}',
      // Numbers outside the relay's own: no attempt, no loss, a cause the relay never opens again (24 ends it), ten digits, a sign, a leading zero, a fraction, a text.
      '{"report":"camera_lost","v":1,"attempt":0,"loss":1,"cause":32}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":0,"cause":32}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":1,"cause":24}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":1,"cause":0}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":1,"cause":320}',
      '{"report":"camera_lost","v":1,"attempt":1234567890,"loss":1,"cause":32}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":1234567890,"cause":32}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":-1,"cause":32}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":01,"cause":32}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":1.5,"cause":32}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":"1","cause":32}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":1,"cause":"CAMERA_LOST"}',
      // A text where the relay has none: an address, a path.
      `{"report":"camera_lost","v":1,"attempt":1,"loss":1,"cause":32,"camera":"${CAMERA_HOST}"}`,
      // Spaces, another case, a second object on the line, a byte outside ASCII.
      '{"report": "camera_lost","v":1,"attempt":1,"loss":1,"cause":32}',
      '{"report":"CAMERA_LOST","v":1,"attempt":1,"loss":1,"cause":32}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":1,"cause":32}{"report":"camera_lost","v":1,"attempt":1,"loss":2,"cause":32}',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":1,"cause":32}\r',
      '{"report":"camera_lost","v":1,"attempt":1,"loss":1,"cause":32 }',
      // camera_reopened: the same, and its own bounds - 0 tries, 7 tries, a member missing, the members in another order.
      '{"report":"camera_reopened","v":1,"attempt":1,"loss":1,"tries":0,"held_back":0,"gap_ms":0}',
      '{"report":"camera_reopened","v":1,"attempt":1,"loss":1,"tries":7,"held_back":0,"gap_ms":0}',
      '{"report":"camera_reopened","v":1,"attempt":1,"loss":1,"tries":1,"held_back":0}',
      '{"report":"camera_reopened","v":1,"attempt":1,"loss":1,"tries":1,"gap_ms":0,"held_back":0}',
      '{"report":"camera_reopened","v":1,"attempt":1,"loss":1,"tries":1,"held_back":-1,"gap_ms":0}',
      '{"report":"camera_reopened","v":1,"attempt":1,"loss":1,"tries":1,"held_back":00,"gap_ms":0}',
      '{"report":"camera_reopened","v":1,"attempt":1,"loss":1,"tries":1,"held_back":0,"gap_ms":1234567890}',
      '{"report":"camera_reopened","v":1,"attempt":1,"loss":0,"tries":1,"held_back":0,"gap_ms":0}',
      '{"report":"camera_reopened","v":1,"attempt":0,"loss":1,"tries":1,"held_back":0,"gap_ms":0}',
      '{"report":"camera_reopened","v":1,"attempt":1,"loss":1,"tries":1,"held_back":0,"gap_ms":0,"cause":32}',
      // Words of the relay's STANDARD ERROR with the same names are no report, and a report word the Core does not know is none.
      '{"relay":"camera_lost","code":"CAMERA_LOST","rc":32}',
      '{"relay":"camera_reopened","code":"RUNNING","rc":0}',
      '{"report":"camera_gone","v":1,"attempt":1,"loss":1,"cause":32}',
      // Oversized: a line of the form's beginning that never ends inside the bound.
      `{"report":"camera_lost","v":1,"attempt":1,"loss":1,"cause":32${' '.repeat(RELAY_REPORT_LINE_MAX_BYTES)}}`,
    ];
    for (const text of refused) reader.push(Buffer.from(`${text}\n`, 'latin1'));
    expect(seen).toEqual([]);
    expect(reader.rejected()).toBe(refused.length);
    // An endless line that BEGINS as a loss is never kept and never a report; the line after it is read.
    reader.push(Buffer.from('{"report":"camera_lost","v":1,"attempt":1,"loss":'));
    for (let chunk = 0; chunk < 64; chunk += 1) reader.push(Buffer.alloc(1_024, 0x31));
    reader.push(Buffer.from(`,"cause":32}\n${cameraLost(1, 1)}`));
    expect(seen).toEqual([{ kind: RelayReportKind.CAMERA_LOST, attempt: 1, loss: 1, cause: 32 }]);
    expect(reader.rejected()).toBe(refused.length + 1);
  });

  it('the forms and the bounds are the relay\'s own: its two line makers, its tries, its largest number and the codes it opens again, read from its sources', () => {
    const core = readFileSync(resolve(__dirname, '../../../../../../capture-worker/src/relay/relay_core.c'), 'utf8');
    const header = readFileSync(resolve(__dirname, '../../../../../../capture-worker/src/relay/relay.h'), 'utf8');
    // The literal pieces of the two makers, in their order, are exactly the pieces of the lines this file writes.
    const pieces = (maker: string): string[] => {
      const body = core.slice(core.indexOf(`int ${maker}(`));
      return [...body.slice(0, body.indexOf('return put_end')).matchAll(/put\(&o, "((?:[^"\\]|\\.)*)"\);/g)].map((match) => (match[1] ?? '').replace(/\\"/g, '"'));
    };
    expect(pieces('relay_loss_line').join('N')).toBe(cameraLost(7, 7, 7).trim().replace(/7/g, 'N'));
    expect(pieces('relay_reopened_line').join('N')).toBe(cameraReopened(7, 7, 7, 7, 7).trim().replace(/7/g, 'N'));
    expect(Number(/#define RELAY_RETRY_TRIES (\d+)/.exec(header)?.[1])).toBe(RELAY_RETRY_TRIES);
    expect(Number(/#define RELAY_COUNT_MAX (\d+)L/.exec(header)?.[1])).toBe(RELAY_COUNT_MAX);
    // The causes: the codes `relay_loss_kind` names as retried or as a refusal, by their numbers in the header.
    const kinds = core.slice(core.indexOf('int relay_loss_kind('), core.indexOf('return RELAY_LOSS_ENDS;'));
    const numbers = [...kinds.matchAll(/code == (RELAY_[A-Z_]+)/g)].map((match) => Number(new RegExp(`${match[1]} = (\\d+)`).exec(header)?.[1]));
    expect(numbers.sort((a, b) => a - b)).toEqual([...RELAY_LOSS_CAUSES]);
  });

  it('a loss is told with the relay\'s FIRST line and a re-open with its line: on the report source, with the member `leg`, and the established push is told once only', async () => {
    const r = rig();
    const { handle, child } = await opened(r, 'CAM-02', { profile: 'H264_1080P', attempt: 7 });
    expect(r.reports).toEqual([{ sessionId: SESSION, deviceId: 'CAM-02', attempt: 7 }]);
    child.say(cameraLost(7, 1, 32));
    // In the same turn: no timer, no wait for the relay's tries.
    expect(r.reports).toHaveLength(2);
    expect(r.reports[1]).toEqual({ sessionId: SESSION, deviceId: 'CAM-02', attempt: 7, leg: { event: 'LOST', profile: 'H264_1080P', loss: 1, cause: 'CAMERA_LOST' } });
    child.say(cameraReopened(7, 1, 3, 25, 8_103));
    expect(r.reports[2]).toEqual({ sessionId: SESSION, deviceId: 'CAM-02', attempt: 7, leg: { event: 'REOPENED', profile: 'H264_1080P', loss: 1, tries: 3, heldBack: 25, gapMs: 8_103 } });
    // The second loss of the same relay, by each of its causes' words; the relay lives through all of it.
    child.say(cameraLost(7, 2, 31) + cameraReopened(7, 2) + cameraLost(7, 3, 20) + cameraReopened(7, 3) + cameraLost(7, 4, 23));
    expect(r.reports.slice(3).map((report) => [report.leg?.event, report.leg?.loss, report.leg?.event === 'LOST' ? report.leg.cause : null])).toEqual([
      ['LOST', 2, 'CAMERA_STALLED'],
      ['REOPENED', 2, null],
      ['LOST', 3, 'CAMERA_UNREACHABLE'],
      ['REOPENED', 3, null],
      ['LOST', 4, 'AUTH_REFUSED'],
    ]);
    expect(r.reports.filter((report) => report.leg === undefined)).toHaveLength(1);
    expect(r.adapter.counts()).toEqual({ live: 1, droppedReports: 0, outOfOrderReports: 0 });
    expect([r.ends, r.notes, r.timers.pending()]).toEqual([[], [], 0]);
    expect(leaks(everything(r.reports))).toEqual([]);
    // The relay gives up (its tries are used up, the code of its last try): the end is said once, as before.
    child.exit(20);
    await flush();
    expect(r.ends).toEqual([{ sessionId: SESSION, deviceId: 'CAM-02', attempt: 7, profile: 'H264_1080P', code: CameraOpenRefusal.UNREACHABLE, reason: 'CAMERA_UNREACHABLE' }]);
    await handle.close();
  });

  it('out of order: a loss before the push is established, a loss number said already, a re-open of no open loss or of another number - dropped, counted, noted, never told', async () => {
    const r = rig();
    // Before the established push no loss is a loss inside a session, and it does not bring the open up.
    const pendingOpen = await opening(r, 'CAM-01', { attempt: 3 });
    pendingOpen.child.say(cameraLost(3, 1) + cameraReopened(3, 1));
    await flush();
    expect(r.reports).toEqual([]);
    expect(r.adapter.counts().outOfOrderReports).toBe(2);
    pendingOpen.child.say(established(3));
    expect(await pendingOpen.pending).toMatchObject({ deviceId: 'CAM-01' });
    const child = pendingOpen.child;
    // A re-open with no loss open.
    child.say(cameraReopened(3, 1));
    expect(r.reports).toHaveLength(1);
    // The first loss; said again, and a lower number: one absence, told once.
    child.say(cameraLost(3, 1) + cameraLost(3, 1));
    expect(r.reports.map((report) => report.leg?.event ?? 'ESTABLISHED')).toEqual(['ESTABLISHED', 'LOST']);
    // A re-open of another number ends nothing: the loss that was told stays told.
    child.say(cameraReopened(3, 2));
    expect(r.reports).toHaveLength(2);
    // A HIGHER loss while one is open (the re-open line between them was never seen): the camera is away either way - nothing told twice, noted.
    child.say(cameraLost(3, 2));
    expect(r.reports).toHaveLength(2);
    // The re-open of the number that is open now ends the absence; the earlier number no longer does.
    child.say(cameraReopened(3, 1));
    expect(r.reports).toHaveLength(2);
    child.say(cameraReopened(3, 2));
    expect(r.reports.map((report) => report.leg?.event ?? 'ESTABLISHED')).toEqual(['ESTABLISHED', 'LOST', 'REOPENED']);
    expect(r.reports[2]?.leg).toMatchObject({ loss: 2 });
    // A loss that skips a number is taken (told) and noted.
    child.say(cameraLost(3, 5));
    expect(r.reports.at(-1)?.leg).toMatchObject({ event: 'LOST', loss: 5 });
    expect(r.adapter.counts()).toEqual({ live: 1, droppedReports: 0, outOfOrderReports: 8 });
    expect(new Set(r.notes.map((note) => note.code))).toEqual(new Set(['CAPTURE_RELAY_REPORT_OUT_OF_ORDER']));
    expect(r.notes).toHaveLength(8);
  });

  it('C37: a leg report of a superseded attempt, of a relay that is being ended, or one that names another attempt than the relay\'s own, is dropped and counted - it reaches nobody', async () => {
    const r = rig();
    // Attempt 1 is established; then the worker is replaced: attempt 2 of the same session is opened for the other camera.
    const old = await opened(r, 'CAM-01', { attempt: 1 });
    const fresh = await opened(r, 'CAM-02', { profile: 'H264_1080P', attempt: 2 });
    const before = r.reports.length;
    old.child.say(cameraLost(1, 1) + cameraReopened(1, 1));
    await flush();
    expect(r.reports).toHaveLength(before);
    expect(r.adapter.counts()).toEqual({ live: 2, droppedReports: 2, outOfOrderReports: 0 });
    expect(r.notes.map((note) => [note.code, note.deviceId, note.attempt])).toEqual([
      ['CAPTURE_RELAY_REPORT_SUPERSEDED', 'CAM-01', 1],
      ['CAPTURE_RELAY_REPORT_SUPERSEDED', 'CAM-01', 1],
    ]);
    // The relay of the attempt in force names another attempt than its own start message: not this relay's word.
    fresh.child.say(cameraLost(1, 1) + cameraLost(3, 1));
    expect(r.reports).toHaveLength(before);
    expect(r.notes.slice(2).map((note) => note.code)).toEqual(['CAPTURE_RELAY_REPORT_ATTEMPT_DIFFERS', 'CAPTURE_RELAY_REPORT_ATTEMPT_DIFFERS']);
    // Its own word is told.
    fresh.child.say(cameraLost(2, 1));
    expect(r.reports.at(-1)).toMatchObject({ deviceId: 'CAM-02', attempt: 2, leg: { event: 'LOST', loss: 1 } });
    // A source that is being closed: what its relay still says about its leg is dropped.
    fresh.child.endsOnInputEnd = false;
    const closing = fresh.handle.close();
    fresh.child.say(cameraReopened(2, 1));
    fresh.child.exit(0);
    await closing;
    expect(r.reports.at(-1)?.leg).toMatchObject({ event: 'LOST' });
    expect(r.adapter.counts().droppedReports).toBe(5);
    await old.handle.close();
  });

  it('with the camera watch as the composition wires it: the fault of THAT camera is raised by the first line of the loss and cleared by the re-open; the relay\'s later end adds no second fault', async () => {
    const raised: unknown[] = [];
    const cleared: unknown[] = [];
    const changes: unknown[] = [];
    const watch = createCameraWatch({
      timers: manualTimers(),
      now: () => 0,
      reader: { read: async () => ({ answered: false, cameraUtcMs: null }) },
      candidate: async () => CANDIDATE,
      faults: { raise: (fault) => void raised.push(fault), clear: (fault) => void cleared.push(fault) },
      onChange: (change) => changes.push(change),
    });
    const r = rig({ relayEnded: (end) => watch.relayEnded(end) });
    r.adapter.relayReports.subscribe((report) => watch.pushEstablished(report));
    const one = await opened(r, 'CAM-01', { attempt: 1 });
    const two = await opened(r, 'CAM-02', { profile: 'H264_1080P', attempt: 1 });
    expect([raised, cleared]).toEqual([[], []]);
    // The loss: raised in the turn of the line. BEFORE this row nothing was raised here - only at the relay's end.
    one.child.say(cameraLost(1, 1, 32));
    expect(raised).toEqual([{ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' }]);
    expect(watch.lost()).toEqual(['CAM-01']);
    expect(r.timers.pending()).toBe(0);
    // The re-open clears it - the watch's own raise, of that camera.
    one.child.say(cameraReopened(1, 1, 1, 25, 3_040));
    expect(cleared).toEqual([{ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' }]);
    expect(watch.lost()).toEqual([]);
    // A second absence that never ends: raised once; the relay's end (tries used up) is the same absence, not a second fault.
    one.child.say(cameraLost(1, 2, 32));
    one.child.exit(20);
    await flush();
    expect(raised).toHaveLength(2);
    expect(cleared).toHaveLength(1);
    expect(watch.lost()).toEqual(['CAM-01']);
    // The other camera was never touched by any of it.
    expect([...raised, ...cleared].every((fault) => (fault as { subject: string }).subject === 'CAM-01')).toBe(true);
    // The camera is back for a later worker: the established push of the new relay ends the loss (row 49's rule, unchanged).
    const again = await opened(r, 'CAM-01', { attempt: 2 });
    expect(cleared).toHaveLength(2);
    expect(watch.lost()).toEqual([]);
    expect(changes).toEqual([
      { deviceId: 'CAM-01', event: 'STREAM_LOST', cause: 'CAMERA_LOST' },
      { deviceId: 'CAM-01', event: 'STREAM_RETURNED', cause: null },
      { deviceId: 'CAM-01', event: 'STREAM_LOST', cause: 'CAMERA_LOST' },
      { deviceId: 'CAM-01', event: 'STREAM_RETURNED', cause: null },
    ]);
    await again.handle.close();
    await two.handle.close();
    await flush();
    expect([raised.length, cleared.length]).toEqual([2, 2]);
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
    expect(naming[0]).toMatch(/^const process = startCameraRelay\(\{ door, program: relayProgram, timers, locator: located\.locator, sealed, ingest: target\.ingestUrl, attempt, source: from\.sourceAddress, onOutput: \(chunk\) => reader\.push\(chunk\) \}\);$/);
    expect(adapter.filter((line) => /\btarget\b/.test(line) && !line.startsWith('async function openSource(') && line !== 'const { profile, sessionId, attempt } = target;')).toEqual(naming);
    // In the relay start it is a member of the message and of the options type, and nothing else.
    expect(relayStart.filter((line) => /\bingest\b/.test(line))).toEqual(['readonly ingest: string;', 'ingest: start.ingest,']);
    // The slot of a live relay holds identifiers, the process and (finding F3-01) one flag and two loss numbers of its camera leg: no locator, no address, no credential member.
    const slot = adapter.slice(adapter.indexOf('interface Slot {'), adapter.indexOf('}', adapter.indexOf('interface Slot {')) + 1).join(' ');
    expect(slot).toBe(
      'interface Slot { readonly deviceId: string; readonly profile: string; readonly sessionId: string; readonly attempt: number; process: ProductionProcess | null; ending: boolean; closed: Promise<void> | null; established: boolean; lastLoss: number; lossOpen: number | null; }',
    );
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

// Task 4 row 85d (decision C63 (g)): THE DOOR OF A LATER DEVICE. A camera adopted on a running production Core has its
// stored row and stream facts (the rig's `stream` answers for any id, as the composition's read does) and no place in
// the adapter's first list. `admitDevice` gives it one; from then on it is opened as any camera of that list.
describe('row 85d: `admitDevice` - a camera adopted after the build is served by the same adapter, under the same rules of an open', () => {
  const LATER: CaptureDeviceEntry = { id: 'CAM-03', deviceClass: 'CAMERA', label: 'Adopted later', capabilities: ['VIDEO'], profiles: ['HEVC_1080P'] };
  const codeOfThrow = (act: () => void): unknown => {
    try {
      act();
    } catch (error) {
      return error instanceof CaptureAdapterError ? error.code : error;
    }
    return 'ADMITTED';
  };

  it('before the admission the camera is unknown and nothing is asked; the admission itself reads no stored fact, reveals nothing, dials nothing and starts nothing', async () => {
    const r = rig({ clock: async () => 12 });
    expect(await outcomeOf(r.adapter.openSource('CAM-03', target(), never))).toMatchObject({ name: 'CaptureAdapterError', code: 'CAPTURE_DEVICE_UNKNOWN' });
    expect(await outcomeOf(r.adapter.ntpOffsetMs('CAM-03'))).toMatchObject({ code: 'CAPTURE_DEVICE_UNKNOWN' });
    expect(r.adapter.admittedDevices()).toEqual([]);
    r.adapter.admitDevice(LATER);
    expect([r.calls, r.readerCalls, r.locateCalls, r.children, r.timers.pending(), r.adapter.counts()]).toEqual([[], [], [], [], 0, { live: 0, droppedReports: 0, outOfOrderReports: 0 }]);
    expect(r.adapter.admittedDevices()).toEqual([LATER]);
    expect(Object.isFrozen(r.adapter.admittedDevices()[0])).toBe(true);
    // The first list is what it was: the registry takes the later camera as an entry of its own.
    expect(r.adapter.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02']);
    expect(await r.adapter.ntpOffsetMs('CAM-03')).toBe(12);
  });

  it('after it: the open of the admitted camera is the open of any camera - stored facts, the judgement of its STORED address, ONE reveal, the locator read and the relay FROM the rule\'s source address, the pairing report, the loss callback', async () => {
    const r = rig();
    r.adapter.admitDevice(LATER);
    const { handle, child } = await opened(r, 'CAM-03', { attempt: 2 });
    expect(r.calls).toEqual(['stream CAM-03 HEVC_1080P', 'reader', 'locate', 'door']);
    expect(r.readerCalls).toEqual([{ deviceId: 'CAM-03', sessionId: SESSION }]);
    expect(r.locateCalls[0]?.sourceAddress).toBe(SOURCE_ADDRESS);
    expect((JSON.parse(startMessageBytes(child.options.message ?? {}).toString('utf8')) as Record<string, unknown>)['source']).toBe(SOURCE_ADDRESS);
    expect(r.reports).toEqual([{ sessionId: SESSION, deviceId: 'CAM-03', attempt: 2 }]);
    expect(handle.deviceId).toBe('CAM-03');
    // It is keyed and counted like the others, beside a camera of the first list.
    const first = await opened(r, 'CAM-01', { attempt: 2 });
    expect(r.adapter.counts().live).toBe(2);
    expect(await outcomeOf(r.adapter.openSource('CAM-03', target({ attempt: 2 }), never))).toMatchObject({ code: CameraOpenRefusal.ALREADY_OPEN, deviceId: 'CAM-03' });
    // A relay of the admitted camera that ends by itself is told once, as any other.
    child.exit(32);
    await flush();
    expect(r.ends).toMatchObject([{ deviceId: 'CAM-03', profile: 'HEVC_1080P', code: CameraOpenRefusal.STREAM_LOST, reason: 'CAMERA_LOST' }]);
    await first.handle.close();
    expect(r.adapter.counts().live).toBe(0);
  });

  it('the stored-address rule stands before the reveal for it too: each refused class of stored address, an admission without a source address, no stored stream of the profile - nothing read, nothing dialled, no relay', async () => {
    for (const entry of REFUSED_STORED_ADDRESSES) {
      const r = rig({ storedAddress: REAL_RULE });
      r.stream = async () => ({ candidate: entry.candidate, onvifProfileToken: TOKEN });
      r.adapter.admitDevice(LATER);
      expect(await outcomeOf(r.adapter.openSource('CAM-03', target(), never)), entry.className).toMatchObject({ name: 'CameraOpenError', code: CameraOpenRefusal.ADDRESS_REFUSED, deviceId: 'CAM-03', reason: entry.refusal });
      expect([r.readerCalls, r.locateCalls, r.children], entry.className).toEqual([[], [], []]);
    }
    const sourceless = rig({ storedAddress: (host) => ({ allowed: true, destination: { address: host } }) });
    sourceless.adapter.admitDevice(LATER);
    expect(await outcomeOf(sourceless.adapter.openSource('CAM-03', target(), never))).toMatchObject({ code: CameraOpenRefusal.ADDRESS_REFUSED, reason: 'STORED_ADDRESS_SOURCE_ABSENT' });
    expect([sourceless.readerCalls, sourceless.children]).toEqual([[], []]);
    const noStream = rig();
    noStream.stream = async () => null;
    noStream.adapter.admitDevice(LATER);
    expect(await outcomeOf(noStream.adapter.openSource('CAM-03', target(), never))).toMatchObject({ name: 'CaptureAdapterError', code: 'CAPTURE_PROFILE_UNKNOWN' });
    expect([noStream.readerCalls, noStream.children]).toEqual([[], []]);
  });

  it('idempotent: a second admission, and the admission of a camera of the first list, change nothing - a live relay of it stays', async () => {
    const r = rig();
    r.adapter.admitDevice(LATER);
    const { handle, child } = await opened(r, 'CAM-03');
    r.adapter.admitDevice(LATER);
    r.adapter.admitDevice({ ...LATER, label: 'another label', profiles: [] });
    r.adapter.admitDevice(DEVICES[0]!);
    expect(r.adapter.admittedDevices()).toEqual([LATER]);
    expect(r.adapter.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02']);
    expect([child.alive, r.adapter.counts().live, r.children.length]).toEqual([true, 1, 1]);
    await handle.close();
  });

  it('refused, each by its name and with nothing changed: no entry, another class, an id of another class, another adapter kind, another source class, a capability or a profile list that is not a camera\'s', async () => {
    const r = rig();
    const cases: readonly [string, unknown, string][] = [
      ['null', null, 'CAPTURE_DEVICE_UNKNOWN'],
      ['a text', 'CAM-03', 'CAPTURE_DEVICE_UNKNOWN'],
      ['no id', { ...LATER, id: undefined }, 'CAPTURE_DEVICE_UNKNOWN'],
      ['a microphone', { id: 'MIC-03', deviceClass: 'MIC', label: 'Microphone', capabilities: ['AUDIO'], profiles: [] }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['a switch', { id: 'POE-01', deviceClass: 'POE', label: 'Switch', capabilities: [], profiles: [] }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['a microphone id under the class CAMERA', { ...LATER, id: 'MIC-03' }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['an id that is no registry id', { ...LATER, id: `http://${CAMERA_HOST}/` }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['a camera id under the class MIC', { ...LATER, deviceClass: 'MIC' }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['the fake kind', { ...LATER, adapterKind: CaptureAdapterKind.FAKE }, 'CAPTURE_ADAPTER_KIND_NOT_ALLOWED'],
      ['the development device kind', { ...LATER, adapterKind: CaptureAdapterKind.LOCAL_DEVICE }, 'CAPTURE_ADAPTER_KIND_NOT_ALLOWED'],
      ['the development source class', { ...LATER, adapterKind: CaptureAdapterKind.ONVIF_RTSP, sourceClass: 'DEVELOPMENT' }, 'DEVELOPMENT_SOURCE_NOT_ALLOWED'],
      ['an audio capability', { ...LATER, capabilities: ['VIDEO', 'AUDIO'] }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['no video capability', { ...LATER, capabilities: ['PULL'] }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['no label', { ...LATER, label: null }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['a profile that is no code', { ...LATER, profiles: ['main stream'] }, 'CAPTURE_PROFILE_UNKNOWN'],
      ['a profile named twice', { ...LATER, profiles: ['HEVC_1080P', 'HEVC_1080P'] }, 'CAPTURE_PROFILE_UNKNOWN'],
      ['17 profiles', { ...LATER, profiles: Array.from({ length: 17 }, (_unused, index) => `H264_${String(index)}`) }, 'CAPTURE_PROFILE_UNKNOWN'],
      ['profiles that are no list', { ...LATER, profiles: 'HEVC_1080P' }, 'CAPTURE_PROFILE_UNKNOWN'],
    ];
    for (const [label, entry, code] of cases) expect(codeOfThrow(() => r.adapter.admitDevice(entry as CaptureDeviceEntry)), label).toBe(code);
    expect(r.adapter.admittedDevices()).toEqual([]);
    expect(await outcomeOf(r.adapter.openSource('CAM-03', target(), never))).toMatchObject({ code: 'CAPTURE_DEVICE_UNKNOWN' });
    expect([r.calls, r.children]).toEqual([[], []]);
    // No text of a refused entry is in its refusal.
    const hostile = (() => {
      try {
        r.adapter.admitDevice({ ...LATER, id: `http://${CAMERA_HOST}/` });
      } catch (error) {
        return everything(error);
      }
      return '';
    })();
    expect(leaks(hostile)).toEqual([]);
    // CONTROLS: a descriptor that states THIS adapter's kind and the production class is taken; so is a camera whose stored profile list is empty (C36: none is assumed).
    expect(codeOfThrow(() => r.adapter.admitDevice({ ...LATER, adapterKind: CaptureAdapterKind.ONVIF_RTSP, sourceClass: 'PRODUCTION', hasOpener: true } as CaptureDeviceEntry))).toBe('ADMITTED');
    expect(codeOfThrow(() => r.adapter.admitDevice({ ...LATER, id: 'CAM-04', profiles: [] }))).toBe('ADMITTED');
    expect(r.adapter.admittedDevices().map((device) => [device.id, device.profiles])).toEqual([['CAM-03', ['HEVC_1080P']], ['CAM-04', []]]);
  });

  it('the fence\'s door finds the member, and its one-entry view of the adapter opens the later camera; BEFORE THE LIFT a registry still refuses that view (`CAPTURE_ADAPTER_INVALID`): the kind does not record', async () => {
    const r = rig();
    // What `buildProductionRegistryOf` does with a later device (`capture/fence/index.ts`, `lateDoorOf` and `admitLater`).
    const member = (r.adapter as unknown as Record<string, unknown>)['admitDevice'];
    expect(typeof member).toBe('function');
    (member as (entry: CaptureDeviceEntry) => void).call(r.adapter, LATER);
    const view = Object.freeze({ ...r.adapter, devices: Object.freeze([LATER]) });
    expect([view.kind, view.hasOpener, view.devices.map((device) => device.id)]).toEqual([CaptureAdapterKind.ONVIF_RTSP, true, ['CAM-03']]);
    const pending = outcomeOf(view.openSource('CAM-03', target(), never));
    await flush();
    r.children[0]?.take();
    await flush();
    r.children[0]?.say(established(1));
    expect(await pending).toMatchObject({ deviceId: 'CAM-03' });
    expect(r.adapter.counts().live).toBe(1);
    for (const operation of [CaptureOperation.REAL_PRODUCTION, CaptureOperation.REAL_DEVELOPMENT]) {
      const registry = createCaptureDeviceRegistry({ operation });
      expect(codeOfThrow(() => registry.register(view)), operation).toBe('CAPTURE_ADAPTER_INVALID');
      expect(registry.list()).toEqual([]);
    }
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
