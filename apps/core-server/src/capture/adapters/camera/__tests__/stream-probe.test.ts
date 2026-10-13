// The stream-level half of the connection test, on doubles (task 4 blueprint row 50, WP-05;
// amendment AM-2; security AD-06 (1) to (3) and (5), S13-01 (b), S13-04 (d)).
//
// THE DOUBLES. No process, no port, no database, no clock: the door is an object that records what
// it was started with and whose child the test moves (takes the message, says a line, ends); the
// ONVIF half and the locator read are functions of this file; the timer is a manual one. The seal's
// two functions are the REAL ones (`streamProfileOf` of the sealing host, `avcDeclaredFrameRate` of
// the fragment reader), so a code this file expects is the code a sealed recording would state.
// The serialiser of the start message is the real one, called on the message the door was handed.
//
// The real relay binary, the test camera and a scripted ONVIF device are the database-project file
// `src/modules/capture-discovery/connect/__tests__/stream-test.db.test.ts`.
//
// The account and the locator are synthetic values of this file. Comparisons that could print one
// are asserted as booleans.
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { avcDeclaredFrameRate } from '../../../fragments';
import type { CaptureTimers } from '../../../types';
import { spsNal } from '../../../../sealing-host/__tests__/real-init-segments';
import { streamProfileOf } from '../../../../sealing-host';
import { sealCredential, startMessageBytes } from '../../credential';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../../errors';
import { CaptureAdapterKind } from '../../kinds';
import { ProductionDoorError, ProductionDoorRefusal, type ProductionDoor, type ProductionExit, type ProductionProcessOptions } from '../../production-door';
import { ConnectionTestOutcome, type CameraCandidate } from '../../types';
import { OnvifTestReason, type OnvifLocatorResult, type OnvifSessionResult, type OnvifStreamProfile } from '../onvif-session';
import {
  PROBE_PARAMETER_SET_MAX_BYTES,
  PROBE_REPORT_LINE_MAX_BYTES,
  STREAM_PROBE_BOUND_MS,
  STREAM_PROBE_REAP_BOUND_MS,
  STREAM_PROFILE_CODE,
  STREAM_TEST_MAX_STREAMS,
  StreamTestReason,
  codecOfParameterSets,
  createProbeReportReader,
  createStreamConnectionTester,
  probeReportOf,
  streamFactsOf,
  type StreamStatement,
  type StreamTestNote,
  type StreamTestResult,
} from '../stream-probe';

const ACCOUNT = { username: ['row50', 'unit', 'account'].join('-'), secret: ['row50', 'unit', 'placeholder', 'Vb4Kp9'].join('-') } as const;
const CAMERA_HOST = '192.0.2.50';
const SCHEME = ['rt', 'sp'].join('');
const LOCATOR = `${SCHEME}://${CAMERA_HOST}:554/stream/main?channel=1&subtype=0`;
const PROGRAM = '/opt/dems/bin/capture-relay';
const CANDIDATE: CameraCandidate = { adapterKind: CaptureAdapterKind.ONVIF_RTSP, host: CAMERA_HOST, serviceAddress: `http://${CAMERA_HOST}/onvif/device_service`, endpointRef: null, vendor: null, model: null, name: null, testable: true, conflict: false };
/** What a camera could choose and must be nowhere: a codec name of its description with markup, 300 characters. */
const HOSTILE = `h265<script>alert(1)</script>${'x'.repeat(300 - 29)}`;
const NEEDLES = [ACCOUNT.username, ACCOUNT.secret, LOCATOR, '/stream/main', CAMERA_HOST, HOSTILE, '<script>'];
const everything = (value: unknown): string => [String(value), JSON.stringify(value) ?? '', inspect(value, { depth: 8, showHidden: true, getters: true })].join('\n');
const leaks = (value: unknown): string[] => NEEDLES.filter((needle) => everything(value).includes(needle));

/** The seal's own two functions: what the composition hands in. */
const SEAL: StreamStatement = { profileOf: streamProfileOf, declaredRate: avcDeclaredFrameRate };

// ── Parameter sets ───────────────────────────────────────────────────────────────────────────
const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
/** An H.264 sequence set that states 1920 x 1088 macroblocks and 25 pictures a second, by the seal test's own builder. */
const AVC_SPS_25 = spsNal({ width: 1920, height: 1088, timing: { unitsInTick: 1, timeScale: 50 } });
const AVC_SPS_NO_RATE = spsNal({ width: 1280, height: 720, timing: null });
const AVC_PPS = Uint8Array.from([0x68, 0xce, 0x3c, 0x80]);
/** HEVC sets by their two header bytes (unit types 32, 33, 34; layer 0; temporal id 1) and a body this file does not read. */
const HEVC_VPS = Uint8Array.from([0x40, 0x01, 0x0c, 0x01, 0xff, 0xff, 0x01, 0x60]);
const HEVC_SPS = Uint8Array.from([0x42, 0x01, 0x01, 0x01, 0x60, 0x00, 0x00, 0x03]);
const HEVC_PPS = Uint8Array.from([0x44, 0x01, 0xc1, 0x72, 0xb4, 0x62]);

interface Line {
  readonly attempt?: number;
  readonly codec?: string;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly rate?: number | string;
  readonly vps?: string;
  readonly sps?: string;
  readonly pps?: string;
}
/** The probe line as the relay makes it (`relay_probe_line`, row 42): fixed order, no blank. */
const probeLine = (line: Line = {}): string =>
  `{"report":"probe","v":1,"attempt":${line.attempt ?? 1},"codec":"${line.codec ?? 'HEVC'}","width":${line.width ?? 1920},"height":${line.height ?? 1080},"rate_milli":${line.rate ?? 25000},` +
  `"sets_in_description":true,"sets_in_stream":false,"vps":"${line.vps ?? hex(HEVC_VPS)}","sps":"${line.sps ?? hex(HEVC_SPS)}","pps":"${line.pps ?? hex(HEVC_PPS)}"}`;
const avcLine = (line: Line = {}): string => probeLine({ codec: 'H264', vps: '', sps: hex(AVC_SPS_25), pps: hex(AVC_PPS), ...line });
const bytes = (text: string): Buffer => Buffer.from(text, 'latin1');

// ── Doubles ──────────────────────────────────────────────────────────────────────────────────
const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
};

interface ManualTimers extends CaptureTimers {
  readonly asked: number[];
  advance(ms: number): void;
  now(): number;
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
      for (const entry of entries.slice()) {
        if (entry.live && entry.at <= now) {
          entry.live = false;
          entry.callback();
        }
      }
    },
    now: () => now,
  };
}

interface FakeChild {
  readonly options: ProductionProcessOptions;
  readonly signals: string[];
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
      diesOnKill: true,
      alive: true,
      take: () => resolveStarted(),
      refuse: (code) => rejectStarted(new ProductionDoorError(code)),
      say: (text) => options.onOutput?.(Buffer.from(text, 'latin1')),
      exit(exitCode, signal = null, spawnFailed = false) {
        if (!child.alive) return;
        child.alive = false;
        resolveEnded({ exitCode, signal, spawnFailed, diagnostics: '', output: '' });
      },
    };
    children.push(child);
    return {
      pid: 5_000 + children.length,
      started,
      ended,
      alive: () => child.alive,
      endInput: () => {},
      kill(signal) {
        child.signals.push(signal);
        if (child.diesOnKill) child.exit(null, signal);
      },
    };
  };
  return { door, children };
}

const MAIN: OnvifStreamProfile = { token: 'profile_1', videoSourceToken: 'vs_1', width: 1920, height: 1080 };
const SECOND: OnvifStreamProfile = { token: 'main.stream:1-b', videoSourceToken: 'vs_2', width: 1280, height: 720 };
const READS = Object.freeze(['GetSystemDateAndTime', 'GetServices', 'GetProfiles', 'GetStreamUri'] as const);

/** The ONVIF half's answer. `announced`: what the camera SAID its encoder is. */
function onvifAnswer(announced: 'H264' | 'H265', profiles: readonly OnvifStreamProfile[] = [MAIN], authenticated = true): OnvifSessionResult {
  const h264 = announced === 'H264';
  return Object.freeze({
    outcome: h264 ? ConnectionTestOutcome.REACHABLE : ConnectionTestOutcome.NOT_H264,
    authenticated,
    usableProfiles: h264 ? profiles.map((profile) => profile.token) : [],
    profiles,
    reason: h264 ? null : OnvifTestReason.NO_H264_PROFILE,
    warnings: [],
    reads: READS,
    credentialRequests: authenticated ? 2 : 0,
    rejectedCredentialRequests: 0,
  });
}
const onvifFailed = (outcome: ConnectionTestOutcome, reason: OnvifSessionResult['reason'], rejected = 0): OnvifSessionResult =>
  Object.freeze({ outcome, authenticated: true, usableProfiles: [], profiles: [], reason, warnings: [], reads: READS, credentialRequests: rejected, rejectedCredentialRequests: rejected });
const located = (outcome: ConnectionTestOutcome = ConnectionTestOutcome.REACHABLE, locator: string | null = LOCATOR, reason: OnvifLocatorResult['reason'] = null): OnvifLocatorResult =>
  Object.freeze({ outcome, reason, locator, reads: Object.freeze(['GetSystemDateAndTime', 'GetServices', 'GetStreamUri'] as const), credentialRequests: 1, rejectedCredentialRequests: outcome === ConnectionTestOutcome.AUTHENTICATION_FAILED ? 1 : 0 });

interface Rig {
  readonly timers: ManualTimers;
  readonly children: FakeChild[];
  readonly notes: StreamTestNote[];
  readonly locateTokens: string[];
  /** Row 143b: every dial of the ONVIF session the test asked for - which call, how many arguments it was handed, and the last one when it is the fourth or fifth. */
  readonly dials: { call: 'test' | 'locate'; given: number; sourceAddress: unknown }[];
  onvif: OnvifSessionResult;
  locate: (token: string, signal: AbortSignal) => Promise<OnvifLocatorResult>;
  test(credentialed?: boolean, signal?: AbortSignal, sourceAddress?: string): Promise<StreamTestResult>;
  /** Row 143c: the tester itself, for its member `boundTo`. */
  readonly tester: ReturnType<typeof createStreamConnectionTester>;
}
function rig(patch: { relayProgram?: string | null; statement?: StreamStatement } = {}): Rig {
  const timers = manualTimers();
  const { door, children } = fakeDoor();
  const notes: StreamTestNote[] = [];
  const locateTokens: string[] = [];
  const dials: Rig['dials'] = [];
  const state = { onvif: onvifAnswer('H264'), locate: async (): Promise<OnvifLocatorResult> => located() } as Pick<Rig, 'onvif' | 'locate'>;
  const tester = createStreamConnectionTester({
    onvif: {
      test: async (...given: unknown[]) => {
        dials.push({ call: 'test', given: given.length, sourceAddress: given[3] });
        return state.onvif;
      },
    },
    locator: {
      locate: (_candidate, _sealed, token, signal, ...more: unknown[]) => {
        dials.push({ call: 'locate', given: 4 + more.length, sourceAddress: more[0] });
        locateTokens.push(token);
        return state.locate(token, signal);
      },
    },
    door,
    relayProgram: patch.relayProgram === undefined ? PROGRAM : patch.relayProgram,
    timers,
    statement: patch.statement ?? SEAL,
    tell: (note) => notes.push(note),
  });
  return {
    tester,
    timers,
    children,
    notes,
    locateTokens,
    dials,
    get onvif() {
      return state.onvif;
    },
    set onvif(value) {
      state.onvif = value;
    },
    get locate() {
      return state.locate;
    },
    set locate(value) {
      state.locate = value;
    },
    test: (credentialed = true, signal = new AbortController().signal, sourceAddress?: string) =>
      sourceAddress === undefined ? tester.test(CANDIDATE, credentialed ? sealCredential(ACCOUNT) : null, signal) : tester.test(CANDIDATE, credentialed ? sealCredential(ACCOUNT) : null, signal, sourceAddress),
  };
}

/** Runs a test whose every probe is answered by `answer(child, index)` as soon as the relay took its message. */
async function run(r: Rig, answer: (child: FakeChild, index: number) => void, signal?: AbortSignal, sourceAddress?: string): Promise<StreamTestResult> {
  const pending = r.test(true, signal, sourceAddress);
  for (let index = 0; index < STREAM_TEST_MAX_STREAMS + 1; index += 1) {
    await flush();
    const child = r.children[index];
    if (child === undefined || !child.alive) continue;
    child.take();
    await flush();
    answer(child, index);
    await flush();
  }
  return pending;
}
const reportsAndEnds = (text: string) => (child: FakeChild): void => {
  child.say(`${text}\n`);
  child.exit(0);
};

describe('the schema of the probe line (AD-06 (3))', () => {
  it('takes the two lines of the relay, exactly: numbers and bytes, no text', () => {
    const hevc = probeReportOf(bytes(probeLine({ attempt: 7 })));
    expect(hevc).toMatchObject({ attempt: 7, codecHint: 'HEVC', width: 1920, height: 1080, rateMilli: 25000 });
    expect([hex(hevc!.vps), hex(hevc!.sps), hex(hevc!.pps)]).toEqual([hex(HEVC_VPS), hex(HEVC_SPS), hex(HEVC_PPS)]);
    const avc = probeReportOf(bytes(avcLine({ attempt: 0, rate: 0 })));
    expect(avc).toMatchObject({ attempt: 0, codecHint: 'H264', rateMilli: 0 });
    expect(avc!.vps.length).toBe(0);
    // The largest set the relay states, and the largest line there can be, are inside the bounds.
    const largest = probeLine({ attempt: 999_999_999, width: 16384, height: 16384, rate: 1_000_000, vps: 'ab'.repeat(PROBE_PARAMETER_SET_MAX_BYTES), sps: 'cd'.repeat(PROBE_PARAMETER_SET_MAX_BYTES), pps: 'ef'.repeat(PROBE_PARAMETER_SET_MAX_BYTES) });
    expect(largest.length).toBeLessThanOrEqual(PROBE_REPORT_LINE_MAX_BYTES);
    expect(probeReportOf(bytes(largest))?.sps.length).toBe(PROBE_PARAMETER_SET_MAX_BYTES);
  });

  it('refuses everything else: another member, order, number form or bound, a set beyond its maximum, any text of a camera', () => {
    const refused: readonly string[] = [
      '',
      '{}',
      probeLine().replace('"v":1', '"v":2'),
      probeLine().replace('"report":"probe"', '"report":"push_established"'),
      probeLine().replace('}', ',"extra":1}'),
      probeLine().replace('"codec":"HEVC","width":1920', '"width":1920,"codec":"HEVC"'),
      ` ${probeLine()}`,
      `${probeLine()} `,
      probeLine({ codec: 'hevc' }),
      probeLine({ codec: 'AV1' }),
      probeLine({ codec: HOSTILE }),
      probeLine({ width: 0 }),
      probeLine({ width: '01920' }),
      probeLine({ width: -1920 }),
      probeLine({ width: 16385 }),
      probeLine({ height: 16385 }),
      probeLine({ height: '1080.0' }),
      probeLine({ height: '1e3' }),
      probeLine({ rate: 1_000_001 }),
      probeLine({ rate: '25000x' }),
      probeLine({ attempt: 1_000_000_000 }),
      probeLine({ attempt: -1 }),
      probeLine({ sps: '' }),
      probeLine({ pps: '' }),
      probeLine({ sps: 'ABCD' }),
      probeLine({ sps: 'abc' }),
      probeLine({ sps: 'zz' }),
      probeLine({ sps: `"><${HOSTILE}` }),
      probeLine({ vps: 'ab'.repeat(PROBE_PARAMETER_SET_MAX_BYTES + 1) }),
      probeLine({ sps: 'ab'.repeat(PROBE_PARAMETER_SET_MAX_BYTES + 1) }),
      probeLine({ pps: 'ab'.repeat(PROBE_PARAMETER_SET_MAX_BYTES + 1) }),
      `${probeLine()}${probeLine()}`,
      probeLine().replace('true', '1'),
    ];
    expect(refused.map((line) => probeReportOf(bytes(line)))).toEqual(refused.map(() => null));
  });

  it('the reader: whole lines only, split chunks joined, the FIRST report kept; a line beyond the bound and every other line counted and dropped', () => {
    const reader = createProbeReportReader();
    const line = `${probeLine({ attempt: 3 })}\n`;
    reader.push(bytes(line.slice(0, 40)));
    expect(reader.report()).toBeNull();
    reader.push(bytes(line.slice(40, 200)));
    reader.push(bytes(line.slice(200)));
    expect(reader.report()).toMatchObject({ attempt: 3, codecHint: 'HEVC' });
    expect(reader.rejected()).toBe(0);
    // A second line, well formed or not, is not this probe's report.
    reader.push(bytes(`${avcLine({ attempt: 3 })}\nnoise\n`));
    expect(reader.report()).toMatchObject({ codecHint: 'HEVC' });
    expect(reader.rejected()).toBe(2);

    const flooded = createProbeReportReader();
    flooded.push(Buffer.alloc(PROBE_REPORT_LINE_MAX_BYTES + 1, 0x61));
    flooded.push(Buffer.alloc(70_000, 0x62));
    flooded.push(bytes(`tail\n${probeLine()}\n`));
    expect(flooded.rejected()).toBe(1);
    expect(flooded.report()).toMatchObject({ attempt: 1 });
  });
});

describe('the Core\'s own judgement (AD-06 (1), (2))', () => {
  it('the codec is what the parameter sets ARE, by their own unit types: a closed set of two', () => {
    expect(codecOfParameterSets({ vps: new Uint8Array(0), sps: AVC_SPS_25, pps: AVC_PPS })).toBe('H264');
    expect(codecOfParameterSets({ vps: HEVC_VPS, sps: HEVC_SPS, pps: HEVC_PPS })).toBe('HEVC');
    const none: readonly Parameters<typeof codecOfParameterSets>[0][] = [
      { vps: new Uint8Array(0), sps: HEVC_SPS, pps: HEVC_PPS },
      { vps: HEVC_VPS, sps: AVC_SPS_25, pps: AVC_PPS },
      { vps: HEVC_SPS, sps: HEVC_VPS, pps: HEVC_PPS },
      { vps: new Uint8Array(0), sps: AVC_PPS, pps: AVC_SPS_25 },
      // The forbidden bit, and a temporal id of 0.
      { vps: new Uint8Array(0), sps: Uint8Array.from([0xe7, 0x42, 0x00, 0x1f]), pps: AVC_PPS },
      { vps: Uint8Array.from([0x40, 0x00, 0x0c]), sps: HEVC_SPS, pps: HEVC_PPS },
      // Another kind of unit altogether, and sets too short to have a header.
      { vps: new Uint8Array(0), sps: Uint8Array.from([0x65, 0x88, 0x84, 0x00]), pps: AVC_PPS },
      { vps: new Uint8Array(0), sps: Uint8Array.from([0x67]), pps: AVC_PPS },
      { vps: Uint8Array.from([0x40, 0x01]), sps: HEVC_SPS, pps: HEVC_PPS },
    ];
    expect(none.map(codecOfParameterSets)).toEqual(none.map(() => null));
  });

  it('the code is the seal\'s: HEVC states no rate, H.264 the rate of its own parameter set; another picture states its width', () => {
    const facts = (line: string) => streamFactsOf(probeReportOf(bytes(line))!, SEAL);
    expect(facts(probeLine())).toEqual({ code: 'HEVC_1080P', codec: 'HEVC', width: 1920, height: 1080 });
    // The rate of the DESCRIPTION is not used: 30 fps said there, 25 in the parameter set.
    expect(facts(avcLine({ rate: 30000 }))).toEqual({ code: 'H264_1080P25', codec: 'H264', width: 1920, height: 1080 });
    expect(facts(avcLine({ width: 1280, height: 720, sps: hex(AVC_SPS_NO_RATE) }))).toEqual({ code: 'H264_720P', codec: 'H264', width: 1280, height: 720 });
    expect(facts(probeLine({ width: 2560, height: 1920 }))).toEqual({ code: 'HEVC_2560X1920P', codec: 'HEVC', width: 2560, height: 1920 });
    for (const line of [probeLine(), avcLine(), probeLine({ width: 16384, height: 16384 })]) {
      const made = facts(line);
      expect('code' in made && STREAM_PROFILE_CODE.test(made.code)).toBe(true);
    }
  });

  it('the relay\'s word is a hint that must agree; sets of neither kind are no codec; a code that fails the pattern is a named failure', () => {
    const report = (line: string) => probeReportOf(bytes(line))!;
    expect(streamFactsOf(report(probeLine({ codec: 'H264' })), SEAL)).toEqual({ reason: StreamTestReason.PROBE_REPORT_INVALID });
    expect(streamFactsOf(report(avcLine({ codec: 'HEVC', vps: '' })), SEAL)).toEqual({ reason: StreamTestReason.PROBE_REPORT_INVALID });
    expect(streamFactsOf(report(probeLine({ sps: hex(HEVC_VPS) })), SEAL)).toEqual({ reason: StreamTestReason.STREAM_CODEC_NOT_USABLE });
    const hostileStatement = (code: unknown): StreamStatement => ({ profileOf: () => code as string, declaredRate: () => null });
    for (const code of [`hevc_1080p`, `HEVC_${HOSTILE}`, `HEVC_${'9'.repeat(70)}`, '', 'H264_1080P', 'OTHER_1080P', 7, null]) {
      expect(streamFactsOf(report(probeLine()), hostileStatement(code))).toEqual({ reason: StreamTestReason.PROFILE_CODE_INVALID });
    }
    expect(
      streamFactsOf(report(probeLine()), {
        profileOf: () => {
          throw new Error(HOSTILE);
        },
        declaredRate: () => null,
      }),
    ).toEqual({ reason: StreamTestReason.PROFILE_CODE_INVALID });
  });
});

describe('when the stream half runs', () => {
  it('without a credential, or without a relay program, no stream is opened: the answer is the ONVIF half\'s own, with no stream and no code', async () => {
    const r = rig();
    const plain = await r.test(false);
    expect(plain).toMatchObject({ outcome: 'REACHABLE', usableProfiles: ['profile_1'], streams: [], streamTested: false, reason: null, rejectedCredentialRequests: 0 });
    r.onvif = onvifAnswer('H265');
    expect(await r.test(false)).toMatchObject({ outcome: 'NOT_H264', usableProfiles: [], streams: [], streamTested: false, reason: 'NO_H264_PROFILE' });
    expect([r.children.length, r.locateTokens.length]).toEqual([0, 0]);

    const noRelay = rig({ relayProgram: null });
    expect(await noRelay.test(true)).toMatchObject({ outcome: 'REACHABLE', usableProfiles: ['profile_1'], streams: [], streamTested: false });
    noRelay.onvif = onvifAnswer('H265');
    expect(await noRelay.test(true)).toMatchObject({ outcome: 'NOT_H264', streams: [], streamTested: false });
    expect([noRelay.children.length, noRelay.locateTokens.length]).toEqual([0, 0]);
  });

  it('an ONVIF half that did not pass ends the test: nothing is located, no relay is started', async () => {
    const r = rig();
    for (const [outcome, reason, rejected] of [
      ['AUTHENTICATION_FAILED', OnvifTestReason.CREDENTIAL_REFUSED, 1],
      ['AUTHENTICATION_FAILED', OnvifTestReason.SCHEME_NOT_ALLOWED, 0],
      ['WRONG_PROFILE', OnvifTestReason.NO_USABLE_PROFILE, 0],
      ['UNREACHABLE', OnvifTestReason.NO_ANSWER, 0],
    ] as const) {
      r.onvif = onvifFailed(outcome, reason, rejected);
      expect(await r.test()).toMatchObject({ outcome, reason, streams: [], usableProfiles: [], streamTested: false, rejectedCredentialRequests: rejected });
    }
    expect([r.children.length, r.locateTokens.length]).toEqual([0, 0]);
  });
});

describe('the codec is judged from the stream, not from the ONVIF answer (amendment AM-2)', () => {
  it('a camera that ANNOUNCES H264 and DELIVERS HEVC is REACHABLE with the usable profile HEVC_1080P', async () => {
    const r = rig();
    const result = await run(r, reportsAndEnds(probeLine()));
    expect(result).toEqual({
      outcome: 'REACHABLE',
      authenticated: true,
      usableProfiles: ['HEVC_1080P'],
      streams: [{ code: 'HEVC_1080P', codec: 'HEVC', width: 1920, height: 1080, onvifProfileToken: 'profile_1', videoSourceToken: 'vs_1', lens: 1 }],
      streamTested: true,
      reason: null,
      rejectedCredentialRequests: 0,
      duplicateCodes: 0,
    });
    expect(r.locateTokens).toEqual(['profile_1']);
    expect(r.notes).toEqual([]);
  });

  it('a camera that ANNOUNCES H265 only is judged the same way: HEVC is usable, and so is an H.264 stream behind that announcement', async () => {
    const r = rig();
    r.onvif = onvifAnswer('H265');
    expect(await run(r, reportsAndEnds(probeLine()))).toMatchObject({ outcome: 'REACHABLE', usableProfiles: ['HEVC_1080P'], streamTested: true });
    const second = rig();
    second.onvif = onvifAnswer('H265');
    expect(await run(second, reportsAndEnds(avcLine()))).toMatchObject({ outcome: 'REACHABLE', usableProfiles: ['H264_1080P25'], streams: [{ codec: 'H264', onvifProfileToken: 'profile_1' }] });
  });

  it('an H.264 camera stays REACHABLE; its code states the rate of its parameter set', async () => {
    const r = rig();
    expect(await run(r, reportsAndEnds(avcLine()))).toMatchObject({ outcome: 'REACHABLE', usableProfiles: ['H264_1080P25'], reason: null });
  });

  it('a codec outside the closed set is NOT_H264 in its widened meaning: by the relay\'s refusal, and by the Core\'s own reading of the bytes', async () => {
    const refused = rig();
    expect(
      await run(refused, (child) => {
        child.exit(28);
      }),
    ).toMatchObject({ outcome: 'NOT_H264', reason: StreamTestReason.STREAM_CODEC_NOT_USABLE, usableProfiles: [], streams: [], streamTested: true });
    const bytesOfNeither = rig();
    expect(await run(bytesOfNeither, reportsAndEnds(probeLine({ sps: hex(HEVC_VPS) })))).toMatchObject({ outcome: 'NOT_H264', reason: StreamTestReason.STREAM_CODEC_NOT_USABLE, streams: [] });
  });

  it('the relay is started in probe mode with no argument, an empty environment and no ingest address; the attempt of its report must be its own', async () => {
    const r = rig();
    await run(r, reportsAndEnds(probeLine()));
    const child = r.children[0]!;
    expect([child.options.command, child.options.args, child.options.env]).toEqual([PROGRAM, [], {}]);
    const message = startMessageBytes(child.options.message!).toString('utf8');
    const parsed = JSON.parse(message) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['type', 'mode', 'attempt', 'access']);
    expect([parsed['type'], parsed['mode'], parsed['attempt']]).toEqual(['start', 'probe', 1]);
    expect(message.includes('ingest')).toBe(false);
    expect(message.endsWith('\n') && message.indexOf('\n') === message.length - 1).toBe(true);
    // The message object itself shows nothing of the account or the address.
    expect(leaks(child.options.message)).toEqual([]);

    const other = rig();
    expect(await run(other, reportsAndEnds(probeLine({ attempt: 2 })))).toMatchObject({ outcome: 'WRONG_PROFILE', reason: StreamTestReason.PROBE_REPORT_INVALID, streams: [] });
    expect(other.notes).toEqual([{ code: 'CAPTURE_STREAM_TEST_REPORT_INVALID', reason: 'ATTEMPT_DIFFERS' }]);
  });

  // Task 4 row 143b (S13-11 point 2): the stream-level connection test of a STORED camera is made FROM the camera-interface
  // address its judgement names. One source address for every dial of the test: the ONVIF half, each locator read, each probe.
  it('row 143b: a source address handed in goes to EVERY dial - the ONVIF test, each locator read and the member `source` of each probe message; without one nothing is bound and no member is written', async () => {
    const from = '192.168.50.1';
    const bound = rig();
    bound.onvif = onvifAnswer('H264', [MAIN, SECOND]);
    await run(bound, (child) => child.exit(24), undefined, from);
    expect(bound.dials).toEqual([
      { call: 'test', given: 4, sourceAddress: from },
      { call: 'locate', given: 5, sourceAddress: from },
      { call: 'locate', given: 5, sourceAddress: from },
    ]);
    expect(bound.children).toHaveLength(2);
    for (const [index, child] of bound.children.entries()) {
      expect([child.options.command, child.options.args, child.options.env]).toEqual([PROGRAM, [], {}]);
      const message = startMessageBytes(child.options.message!).toString('utf8');
      const parsed = JSON.parse(message) as Record<string, unknown>;
      expect(Object.keys(parsed)).toEqual(['type', 'mode', 'attempt', 'source', 'access']);
      expect([parsed['type'], parsed['mode'], parsed['attempt'], parsed['source']]).toEqual(['start', 'probe', index + 1, from]);
      expect(message.includes('ingest')).toBe(false);
    }

    // A camera that is not stored yet has no judged source: no trailing argument at all, and no member of the message.
    const unbound = rig();
    await run(unbound, reportsAndEnds(probeLine()));
    expect(unbound.dials).toEqual([
      { call: 'test', given: 3, sourceAddress: undefined },
      { call: 'locate', given: 4, sourceAddress: undefined },
    ]);
    expect(Object.keys(JSON.parse(startMessageBytes(unbound.children[0]!.options.message!).toString('utf8')) as Record<string, unknown>)).toEqual(['type', 'mode', 'attempt', 'access']);
  });

  it('row 143b: a source handed in that is no source address starts NO relay - it is refused where the message is made, never dropped', async () => {
    for (const notASource of ['0.0.0.0', '', 'camera-interface', '192.168.050.1', '192.168.50.1:0', '224.0.0.1']) {
      const r = rig();
      const result = await run(r, (child) => child.exit(0), undefined, notASource);
      expect(result, notASource).toMatchObject({ outcome: 'WRONG_PROFILE', reason: StreamTestReason.STREAM_LOCATOR_REFUSED, streams: [], streamTested: true });
      expect(r.children, notASource).toEqual([]);
    }
  });

  // Task 4 row 143c (decision C65): the test of a candidate that is not stored yet, on a production Core. Its caller has ONE
  // call of a tester with three arguments, so the tester is bound BEFORE that call.
  it('row 143c: `boundTo` answers the same test with the address at EVERY dial of both halves; a text that is no source address is refused when it is bound, before any test', async () => {
    const from = '192.168.50.1';
    const r = rig();
    r.onvif = onvifAnswer('H264', [MAIN, SECOND]);
    const bound = r.tester.boundTo(from);
    expect(Object.keys(bound)).toEqual(['test']);
    expect(Object.isFrozen(bound)).toBe(true);
    const pending = bound.test(CANDIDATE, sealCredential(ACCOUNT), new AbortController().signal);
    for (let index = 0; index < 2; index += 1) {
      await flush();
      r.children[index]?.take();
      await flush();
      r.children[index]?.exit(24);
      await flush();
    }
    await pending;
    expect(r.dials).toEqual([
      { call: 'test', given: 4, sourceAddress: from },
      { call: 'locate', given: 5, sourceAddress: from },
      { call: 'locate', given: 5, sourceAddress: from },
    ]);
    expect(r.children.map((child) => (JSON.parse(startMessageBytes(child.options.message!).toString('utf8')) as Record<string, unknown>)['source'])).toEqual([from, from]);
    // A test without a credential is bound as well: the ONVIF half is the only dial, and it carries the address.
    const plain = rig();
    await plain.tester.boundTo(from).test(CANDIDATE, null, new AbortController().signal);
    expect(plain.dials).toEqual([{ call: 'test', given: 4, sourceAddress: from }]);
    // No source address, no bound tester: nothing was asked of anything.
    for (const notASource of ['0.0.0.0', '', 'camera-interface', '192.168.050.1', '192.168.50.1:0', '224.0.0.1', '::1', undefined, null, 3232248321]) {
      const refusing = rig();
      let thrown: unknown = null;
      try {
        refusing.tester.boundTo(notASource as string);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, String(notASource)).toMatchObject({ name: 'CaptureAdapterError', code: 'CAPTURE_LOCATOR_INVALID' });
      expect([refusing.dials, refusing.children], String(notASource)).toEqual([[], []]);
    }
  });
});

describe('the named ends of a probe', () => {
  const ends = async (exitCode: number): Promise<{ result: StreamTestResult; r: Rig }> => {
    const r = rig();
    r.onvif = onvifAnswer('H264', [MAIN, SECOND]);
    const result = await run(r, (child) => child.exit(exitCode));
    return { result, r };
  };

  it('a Basic-only camera: AUTHENTICATION_FAILED with SCHEME_NOT_ALLOWED - the credential was not sent, 0 counted, nothing more asked', async () => {
    const { result, r } = await ends(22);
    expect(result).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', reason: 'SCHEME_NOT_ALLOWED', rejectedCredentialRequests: 0, streams: [], usableProfiles: [] });
    expect([r.children.length, r.locateTokens]).toEqual([1, ['profile_1']]);
  });

  it('a wrong password at the stream: AUTHENTICATION_FAILED, ONE rejected request for the lock-out guard, and the second stream is not tried (S13-04 (d))', async () => {
    const { result, r } = await ends(23);
    expect(result).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', reason: StreamTestReason.STREAM_CREDENTIAL_REFUSED, rejectedCredentialRequests: 1, streams: [] });
    expect([r.children.length, r.locateTokens]).toEqual([1, ['profile_1']]);
  });

  it('a refusal of the locator read counts as the session file counted it, and ends the test when it is the credential', async () => {
    const r = rig();
    r.onvif = onvifAnswer('H264', [MAIN, SECOND]);
    r.locate = async () => located(ConnectionTestOutcome.AUTHENTICATION_FAILED, null, OnvifTestReason.CREDENTIAL_REFUSED);
    expect(await r.test()).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', reason: 'CREDENTIAL_REFUSED', rejectedCredentialRequests: 1, streams: [] });
    expect([r.children.length, r.locateTokens]).toEqual([0, ['profile_1']]);
    const unusable = rig();
    unusable.locate = async () => located(ConnectionTestOutcome.WRONG_PROFILE, null, OnvifTestReason.STREAM_HOST_MISMATCH);
    expect(await unusable.test()).toMatchObject({ outcome: 'WRONG_PROFILE', reason: 'STREAM_HOST_MISMATCH', streams: [] });
    const rejects = rig();
    rejects.locate = async () => {
      throw new CaptureAdapterError(CaptureAdapterRefusal.LOCATOR_INVALID);
    };
    expect(await rejects.test()).toMatchObject({ outcome: 'UNREACHABLE', reason: 'NO_ANSWER', streams: [] });
    expect(unusable.children.length + rejects.children.length).toBe(0);
  });

  it('unreachable, no picture, a missing stream and every refusal of a hostile description: an outcome of the contract, nothing judged', async () => {
    const expected: readonly (readonly [number, string, string])[] = [
      [20, 'UNREACHABLE', StreamTestReason.STREAM_UNREACHABLE],
      [21, 'WRONG_PROFILE', StreamTestReason.STREAM_REFUSED],
      [24, 'WRONG_PROFILE', StreamTestReason.STREAM_NOT_FOUND],
      [25, 'WRONG_PROFILE', StreamTestReason.STREAM_REFUSED],
      [26, 'WRONG_PROFILE', StreamTestReason.STREAM_REFUSED],
      [27, 'WRONG_PROFILE', StreamTestReason.STREAM_REFUSED],
      [29, 'WRONG_PROFILE', StreamTestReason.STREAM_REFUSED],
      [30, 'UNREACHABLE', StreamTestReason.STREAM_NO_PICTURE],
      [31, 'UNREACHABLE', StreamTestReason.STREAM_NO_PICTURE],
      [32, 'UNREACHABLE', StreamTestReason.STREAM_NO_PICTURE],
      [33, 'WRONG_PROFILE', StreamTestReason.STREAM_REFUSED],
    ];
    for (const [exitCode, outcome, reason] of expected) {
      const { result, r } = await ends(exitCode);
      expect([exitCode, result.outcome, result.reason, result.streams.length, result.rejectedCredentialRequests]).toEqual([exitCode, outcome, reason, 0, 0]);
      // The second stream was tried: only a refused credential and the deadline end a test early.
      expect([exitCode, r.children.length]).toEqual([exitCode, 2]);
      expect(r.notes).toEqual([]);
    }
  });

  it('exit 0 without a line is "stopped before the answer", never "probed"; a line that is not the form is counted, not read', async () => {
    const silent = rig();
    expect(await run(silent, (child) => child.exit(0))).toMatchObject({ outcome: 'UNREACHABLE', reason: StreamTestReason.STREAM_NO_ANSWER, streams: [] });
    const hostile = rig();
    const result = await run(hostile, reportsAndEnds(probeLine({ codec: HOSTILE })));
    expect(result).toMatchObject({ outcome: 'WRONG_PROFILE', reason: StreamTestReason.PROBE_REPORT_INVALID, streams: [], usableProfiles: [] });
    expect(hostile.notes).toEqual([{ code: 'CAPTURE_STREAM_TEST_REPORT_INVALID', reason: 'LINE_NOT_THE_FORM' }]);
    expect(leaks(result).concat(leaks(hostile.notes))).toEqual([]);
  });

  it('a failure of the relay itself is UNREACHABLE for the operator and a named fault of the host for the log: its own exits, a signal, a refused start', async () => {
    for (const [exitCode, word] of [[10, 'START_MESSAGE_INVALID'], [12, 'LIBAVFORMAT_VERSION_MISMATCH'], [43, 'REPORT_NOT_WRITTEN'], [70, 'INTERNAL'], [99, 'EXIT_CODE_UNKNOWN']] as const) {
      const r = rig();
      expect(await run(r, (child) => child.exit(exitCode))).toMatchObject({ outcome: 'UNREACHABLE', reason: StreamTestReason.RELAY_FAILED, streams: [] });
      expect(r.notes).toEqual([{ code: 'CAPTURE_STREAM_TEST_RELAY_FAILED', reason: word }]);
    }
    const signalled = rig();
    expect(await run(signalled, (child) => child.exit(null, 'SIGSEGV'))).toMatchObject({ outcome: 'UNREACHABLE', reason: StreamTestReason.RELAY_FAILED });
    expect(signalled.notes).toEqual([{ code: 'CAPTURE_STREAM_TEST_RELAY_FAILED', reason: 'ENDED_BY_SIGNAL' }]);

    const refused = rig();
    const pending = refused.test();
    await flush();
    refused.children[0]!.refuse(ProductionDoorRefusal.CORE_FILE_LIMIT_NOT_ZERO);
    expect(await pending).toMatchObject({ outcome: 'UNREACHABLE', reason: StreamTestReason.RELAY_NOT_STARTED, streams: [] });
    // The child of a refused start is killed and waited for.
    expect(refused.children[0]!.signals).toEqual(['SIGKILL']);
    expect(refused.notes).toEqual([{ code: 'CAPTURE_STREAM_TEST_RELAY_FAILED', reason: 'NOT_STARTED' }]);

    const notSpawned = rig();
    expect(await run(notSpawned, (child) => child.exit(null, null, true))).toMatchObject({ outcome: 'UNREACHABLE', reason: StreamTestReason.RELAY_NOT_STARTED });
  });

  it('an address the injection point refuses starts no process', async () => {
    const r = rig();
    r.locate = async () => located(ConnectionTestOutcome.REACHABLE, `${SCHEME}://${ACCOUNT.username}@${CAMERA_HOST}/stream`);
    const result = await r.test();
    expect(result).toMatchObject({ outcome: 'WRONG_PROFILE', reason: StreamTestReason.STREAM_LOCATOR_REFUSED, streams: [] });
    expect(r.children.length).toBe(0);
    expect(leaks(result)).toEqual([]);
  });
});

describe('the bounds (the whole test inside 15,000 ms on a fake clock)', () => {
  it('a probe that neither reports nor ends is killed at its own bound, waited for, and answered STREAM_PROBE_TIMEOUT', async () => {
    const r = rig();
    const pending = r.test();
    await flush();
    r.children[0]!.take();
    await flush();
    r.timers.advance(STREAM_PROBE_BOUND_MS - 1);
    await flush();
    expect(r.children[0]!.signals).toEqual([]);
    r.timers.advance(1);
    expect(await pending).toMatchObject({ outcome: 'UNREACHABLE', reason: StreamTestReason.STREAM_PROBE_TIMEOUT, streams: [] });
    expect([r.children[0]!.signals, r.children[0]!.alive]).toEqual([['SIGKILL'], false]);
    expect(r.timers.now()).toBeLessThan(15_000);
  });

  it('the caller\'s deadline during a probe: the relay is killed and waited for, the answer is DEADLINE, and no further stream is tried', async () => {
    const r = rig();
    r.onvif = onvifAnswer('H264', [MAIN, SECOND]);
    const deadline = new AbortController();
    const pending = r.test(true, deadline.signal);
    await flush();
    r.children[0]!.take();
    await flush();
    r.timers.advance(5_000);
    deadline.abort();
    expect(await pending).toMatchObject({ outcome: 'UNREACHABLE', reason: StreamTestReason.DEADLINE, streams: [] });
    expect([r.children.length, r.children[0]!.signals, r.locateTokens]).toEqual([1, ['SIGKILL'], ['profile_1']]);
    // A line the killed relay still made is nobody's.
    r.children[0]!.say(`${probeLine()}\n`);
    await flush();
    expect(r.notes).toEqual([]);
  });

  it('a killed relay that does not end inside its reap bound is said by a note; the test still answers', async () => {
    const r = rig();
    const pending = r.test();
    await flush();
    const child = r.children[0]!;
    child.diesOnKill = false;
    child.take();
    await flush();
    r.timers.advance(STREAM_PROBE_BOUND_MS);
    await flush();
    r.timers.advance(STREAM_PROBE_REAP_BOUND_MS);
    expect(await pending).toMatchObject({ outcome: 'UNREACHABLE', reason: StreamTestReason.STREAM_PROBE_TIMEOUT });
    expect(r.notes).toEqual([{ code: 'CAPTURE_STREAM_TEST_RELAY_NOT_REAPED', reason: 'BOUND' }]);
    expect(STREAM_PROBE_BOUND_MS + STREAM_PROBE_REAP_BOUND_MS).toBeLessThan(15_000);
  });

  it('a signal that is aborted before the stream half starts no relay', async () => {
    const r = rig();
    const deadline = new AbortController();
    deadline.abort();
    expect(await r.test(true, deadline.signal)).toMatchObject({ outcome: 'UNREACHABLE', reason: StreamTestReason.DEADLINE, streams: [] });
    expect([r.children.length, r.locateTokens.length]).toEqual([0, 0]);
  });
});

describe('several streams of one camera', () => {
  it('each named stream is located and probed in turn, one relay at a time; the lens is its place in the answer', async () => {
    const r = rig();
    r.onvif = onvifAnswer('H264', [MAIN, SECOND]);
    const result = await run(r, (child, index) => reportsAndEnds(index === 0 ? probeLine({ attempt: 1 }) : avcLine({ attempt: 2, width: 1280, height: 720, sps: hex(AVC_SPS_NO_RATE) }))(child));
    expect(result).toMatchObject({ outcome: 'REACHABLE', usableProfiles: ['HEVC_1080P', 'H264_720P'], duplicateCodes: 0 });
    expect(result.streams).toEqual([
      { code: 'HEVC_1080P', codec: 'HEVC', width: 1920, height: 1080, onvifProfileToken: 'profile_1', videoSourceToken: 'vs_1', lens: 1 },
      { code: 'H264_720P', codec: 'H264', width: 1280, height: 720, onvifProfileToken: 'main.stream:1-b', videoSourceToken: 'vs_2', lens: 2 },
    ]);
    expect(r.locateTokens).toEqual(['profile_1', 'main.stream:1-b']);
  });

  it('one usable stream is enough: a second one that fails does not take the first away', async () => {
    const r = rig();
    r.onvif = onvifAnswer('H264', [MAIN, SECOND]);
    expect(await run(r, (child, index) => (index === 0 ? reportsAndEnds(probeLine())(child) : child.exit(24)))).toMatchObject({ outcome: 'REACHABLE', usableProfiles: ['HEVC_1080P'], reason: null });
  });

  it('two streams that state the same code: the first is kept, the second is counted (the stream table has one row per code)', async () => {
    const r = rig();
    r.onvif = onvifAnswer('H264', [MAIN, { ...SECOND, width: 1920, height: 1080 }]);
    const result = await run(r, (child, index) => reportsAndEnds(probeLine({ attempt: index + 1 }))(child));
    expect(result).toMatchObject({ outcome: 'REACHABLE', usableProfiles: ['HEVC_1080P'], duplicateCodes: 1 });
    expect(result.streams.map((stream) => stream.onvifProfileToken)).toEqual(['profile_1']);
  });

  it('at most four streams are probed', async () => {
    const r = rig();
    r.onvif = onvifAnswer('H264', Array.from({ length: 6 }, (_unused, index) => ({ ...MAIN, token: `lens_${index}` })));
    await run(r, (child) => child.exit(24));
    expect([r.children.length, r.locateTokens.length]).toEqual([STREAM_TEST_MAX_STREAMS, STREAM_TEST_MAX_STREAMS]);
  });
});

describe('nothing a camera chose reaches a result (AD-06 (5))', () => {
  it('no account, address or camera text is in any result or note of every case above', async () => {
    const kept: unknown[] = [];
    for (const answer of [reportsAndEnds(probeLine()), reportsAndEnds(probeLine({ codec: HOSTILE })), reportsAndEnds(`{"report":"probe","codec":"${HOSTILE}"}`), (child: FakeChild) => child.exit(27), (child: FakeChild) => child.exit(23)]) {
      const r = rig();
      kept.push(await run(r, answer), r.notes);
    }
    expect(kept.flatMap(leaks)).toEqual([]);
    // Every reason is a code word.
    for (const value of kept) if (value !== null && typeof value === 'object' && 'reason' in value && value.reason !== null) expect(String(value.reason)).toMatch(/^[A-Z][A-Z0-9_]{0,63}$/);
  });
});
