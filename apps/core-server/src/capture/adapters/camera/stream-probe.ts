/**
 * THE STREAM-LEVEL HALF OF THE CONNECTION TEST (task 4 blueprint row 50, work package WP-05;
 * amendment AM-2; design addendum 7.2, 7.3; security AD-06 (1) to (3) and (5), S13-01 (b),
 * S13-04 (d); decisions C36, C38, C39).
 *
 * WHY. The bench cameras announce H264 over ONVIF and send HEVC. So the codec of a camera is
 * judged from its STREAM, never from the ONVIF answer: the ONVIF half (`onvif-session.ts`) says
 * that the camera answers, takes the credential and names its streams; this file then lets the
 * capture relay PROBE each of those streams and decides, in the Core, what it is.
 *
 * THE RELAY REPORTS FACTS, THE CORE DECIDES (AD-06). The relay is started in probe mode through
 * the production door, by the one caller of the injection point (`relay-start.ts`), and writes at
 * most ONE line of a fixed form (`implementation/042_relay_probe_mode.md` section 2). Of that line
 * this file trusts the SHAPE only (`probeReportOf`: one pattern, every number inside its bound,
 * the parameter-set bytes inside their stated maximum - a line outside it is counted and dropped):
 *
 *   the codec        is decided HERE, from the bytes of the parameter sets (`codecOfParameterSets`:
 *                    the unit types of the sets, a closed set of two). The relay's own word for the
 *                    codec is a hint that must agree; the stream description and the ONVIF answer
 *                    take no part at all;
 *   the rate         is what the parameter set states, read by the SEAL'S OWN reader
 *                    (`declaredRate`, handed in: `avcDeclaredFrameRate` of `capture/fragments.ts`).
 *                    For HEVC the seal's reader states none, so none is stated here (test/011);
 *                    the rate the stream description names (`rate_milli`) is not used;
 *   the code         is formed by the SEAL'S OWN function (`profileOf`, handed in:
 *                    `streamProfileOf` of the sealing host) from that codec, the bounded picture
 *                    size and that rate, and is held to the profile pattern BEFORE it leaves this
 *                    file. A code that fails the pattern is a named failure, and the test is not
 *                    passed (AD-06 (2)).
 *
 * So no text a camera chose - a codec name of its description, a profile name, a token - is ever
 * part of a code, an outcome, a reason or a note of this file. An ONVIF token travels beside its
 * code, in the bounded form the session file holds it to, for the stream row of an adoption.
 *
 * WHEN THE STREAM HALF RUNS: when the test has a credential AND a relay program is configured.
 * Then it runs for every stream the ONVIF half names, whichever codec the camera ANNOUNCED
 * (`REACHABLE`, and `NOT_H264` by the announcement): the announcement is advice only. Without a
 * credential, or on a Core without a relay program (a development Core), no stream is opened and
 * the answer is the ONVIF half's own, unchanged, with no stream and NO CODE: no default profile
 * stands in for the stream's statement (C36).
 *
 * THE OUTCOME (the five of the contract; row 38: no sixth member):
 *   REACHABLE              at least one stream was judged H.264 or HEVC and its code holds;
 *   NOT_H264               in its widened meaning: no usable stream, neither H.264 nor HEVC;
 *   AUTHENTICATION_FAILED  the camera refused the credential at the stream (counted for the
 *                          lock-out guard: one rejected request), or asks for a scheme the relay
 *                          never answers (`SCHEME_NOT_ALLOWED`: the credential was NOT sent, 0
 *                          counted). Nothing further is asked of the camera after either;
 *   WRONG_PROFILE          the camera names a stream that is not there, or one the relay refuses
 *                          (a redirect, a foreign control address, a description or a transport
 *                          outside the rules), or a report or a code that does not hold;
 *   UNREACHABLE            no answer at the stream, no picture inside the bound, the caller's
 *                          deadline, or the relay itself failed (said through `tell`, by a code).
 * With several streams the first one judged decides `REACHABLE`; with none, the first failure is
 * the outcome.
 *
 * BOUNDS. One probe is bounded at `STREAM_PROBE_BOUND_MS`; the whole test is bounded by the
 * caller's signal (`CAPTURE_CONNECTION_TEST_TIMEOUT_MS`, 15,000 ms). At either, a started relay is
 * killed and waited for before the test answers. At most `STREAM_TEST_MAX_STREAMS` streams are
 * probed, one after another: one relay, one connection to the camera at a time.
 *
 * WHAT IT KEEPS: nothing. The locator of a stream lives inside one probe and goes to the relay
 * start only; the credential is the opaque object of the call. It logs nothing (static rule G-R4).
 *
 * THE RELAY'S RTSP CLIENT IS A CANDIDATE (C38, C39). This file reads the relay's INTERFACE - the
 * start message, the one line, the exit codes - and nothing of its inside.
 */
import type { CaptureTimers } from '../../types';
import type { SealedCredential } from '../credential';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import type { ProductionDoor, ProductionExit, ProductionProcess } from '../production-door';
import { ConnectionTestOutcome, type CameraCandidate, type ConnectionTestResult } from '../types';
import { OnvifTestReason, type OnvifConnectionTester, type OnvifStreamLocator, type OnvifStreamProfile } from './onvif-session';
import { RELAY_ATTEMPT_MAX, startCameraProbe } from './relay-start';
import { isSourceAddress } from './stored-address';

/** The bound of ONE probe: the relay must have reported, or ended, inside it. */
export const STREAM_PROBE_BOUND_MS = 8_000;
/** How long a killed relay is waited for. */
export const STREAM_PROBE_REAP_BOUND_MS = 2_000;
/** The streams of one camera a test probes at most: the lenses a stream row can name (`lens` 1 to 4). */
export const STREAM_TEST_MAX_STREAMS = 4;

/** The longest report line the relay makes (`RELAY_REPORT_MAX` of its header). A longer line is dropped whole. */
export const PROBE_REPORT_LINE_MAX_BYTES = 6_400;
/** The stated maximum of one parameter set in a report (`RELAY_PSET_MAX`). */
export const PROBE_PARAMETER_SET_MAX_BYTES = 1_024;
/** The largest side of a picture a report may state (the relay's own bound, and the stream table's). */
export const PROBE_PICTURE_SIDE_MAX = 16_384;
/** The largest stated rate of a report, in thousandths (`RELAY_RATE_MILLI_MAX`). */
export const PROBE_RATE_MILLI_MAX = 1_000_000;

/** The codecs a stream can be judged as: a CLOSED set (AD-06 (1)). The stored words of manifest field 43. */
export const STREAM_CODECS = ['H264', 'HEVC'] as const;
export type StreamCodec = (typeof STREAM_CODECS)[number];

/** The form of a profile code, as the selector, the stream table and the seal hold it. */
export const STREAM_PROFILE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

/** Why the stream half ended as it did: a closed list of codes. Never device text. */
export const StreamTestReason = {
  /** The camera asks for an authentication scheme the relay never answers: the credential was NOT sent. The word the contract tells a client. */
  SCHEME_NOT_ALLOWED: 'SCHEME_NOT_ALLOWED',
  /** The camera refused the credential at the stream. */
  STREAM_CREDENTIAL_REFUSED: 'STREAM_CREDENTIAL_REFUSED',
  /** No answer at the stream address. */
  STREAM_UNREACHABLE: 'STREAM_UNREACHABLE',
  /** The stream answered and no picture came inside the relay's bound, or it ended first. */
  STREAM_NO_PICTURE: 'STREAM_NO_PICTURE',
  /** The relay ended by its order to stop without a report. */
  STREAM_NO_ANSWER: 'STREAM_NO_ANSWER',
  /** The camera has no stream at the address it names. */
  STREAM_NOT_FOUND: 'STREAM_NOT_FOUND',
  /** What the camera sent is not a stream the relay takes: protocol, redirect, control address, description, transport, pictures. */
  STREAM_REFUSED: 'STREAM_REFUSED',
  /** The stream is neither H.264 nor HEVC: by the relay's refusal, or by the Core's own reading of the parameter sets. */
  STREAM_CODEC_NOT_USABLE: 'STREAM_CODEC_NOT_USABLE',
  /** The address the camera names is refused by the injection point. */
  STREAM_LOCATOR_REFUSED: 'STREAM_LOCATOR_REFUSED',
  /** The relay's line is not the fixed form, names another attempt, or its codec word is not what its bytes are. */
  PROBE_REPORT_INVALID: 'PROBE_REPORT_INVALID',
  /** The assembled code does not hold the profile pattern (AD-06 (2)). */
  PROFILE_CODE_INVALID: 'PROFILE_CODE_INVALID',
  /** One probe did not end inside `STREAM_PROBE_BOUND_MS`. The relay was killed. */
  STREAM_PROBE_TIMEOUT: 'STREAM_PROBE_TIMEOUT',
  /** The caller's deadline: the whole test. The relay was killed. */
  DEADLINE: 'DEADLINE',
  /** The door refused the start of the relay. A fault of the host. */
  RELAY_NOT_STARTED: 'RELAY_NOT_STARTED',
  /** The relay ended for a cause of its own. A fault of the host. */
  RELAY_FAILED: 'RELAY_FAILED',
} as const;
export type StreamTestReason = (typeof StreamTestReason)[keyof typeof StreamTestReason];

/** What one probe line says, after the shape check. Numbers and bytes: no text of the camera. */
export interface ProbeReport {
  readonly attempt: number;
  /** The relay's own word. A hint: the Core decides from the bytes. */
  readonly codecHint: StreamCodec;
  readonly width: number;
  readonly height: number;
  /** The rate the stream description states, in thousandths; 0: not stated. Not used for the code. */
  readonly rateMilli: number;
  readonly vps: Uint8Array;
  readonly sps: Uint8Array;
  readonly pps: Uint8Array;
}

/**
 * THE SCHEMA OF THE PROBE LINE (AD-06 (3)): the members of the relay's contract in their fixed
 * order and nothing else; version 1; every number a plain decimal inside its bound; each
 * parameter set lower-case hexadecimal of at most `PROBE_PARAMETER_SET_MAX_BYTES` bytes. The two
 * booleans of the line are read for their form and not kept: where the sets stood decides nothing.
 */
const PROBE_LINE = new RegExp(
  '^\\{"report":"probe","v":1,"attempt":(0|[1-9][0-9]{0,8}),"codec":"(H264|HEVC)","width":([1-9][0-9]{0,4}),"height":([1-9][0-9]{0,4}),"rate_milli":(0|[1-9][0-9]{0,6}),' +
    `"sets_in_description":(?:true|false),"sets_in_stream":(?:true|false),"vps":"((?:[0-9a-f]{2}){0,${PROBE_PARAMETER_SET_MAX_BYTES}})","sps":"((?:[0-9a-f]{2}){1,${PROBE_PARAMETER_SET_MAX_BYTES}})","pps":"((?:[0-9a-f]{2}){1,${PROBE_PARAMETER_SET_MAX_BYTES}})"\\}$`,
);

/** A probe line held to its schema, or null. `line` is the line without its line feed. */
export function probeReportOf(line: Uint8Array): ProbeReport | null {
  if (line.length === 0 || line.length > PROBE_REPORT_LINE_MAX_BYTES) return null;
  // The fixed form is ASCII; `latin1` maps every byte to one character, so no other byte can pass the pattern.
  const found = PROBE_LINE.exec(Buffer.from(line.buffer, line.byteOffset, line.byteLength).toString('latin1'));
  if (found === null) return null;
  const [, attempt, codec, width, height, rate, vps, sps, pps] = found;
  const report: ProbeReport = {
    attempt: Number(attempt),
    codecHint: codec === 'HEVC' ? 'HEVC' : 'H264',
    width: Number(width),
    height: Number(height),
    rateMilli: Number(rate),
    vps: Buffer.from(vps ?? '', 'hex'),
    sps: Buffer.from(sps ?? '', 'hex'),
    pps: Buffer.from(pps ?? '', 'hex'),
  };
  if (report.attempt > RELAY_ATTEMPT_MAX || report.width > PROBE_PICTURE_SIDE_MAX || report.height > PROBE_PICTURE_SIDE_MAX || report.rateMilli > PROBE_RATE_MILLI_MAX) return null;
  return report;
}

export interface ProbeReportReader {
  /** Takes a chunk of the relay's standard output; keeps the FIRST whole line that holds the schema. */
  push(chunk: Buffer): void;
  /** The report, or null while none came. */
  report(): ProbeReport | null;
  /** Lines that were not a probe report (too long, another form, a second line). A number, never a text. */
  rejected(): number;
}

const LINE_FEED = 0x0a;

/** A reader of the probe line. It keeps at most one unfinished line of the bound, and of the finished ones the first report only. */
export function createProbeReportReader(): ProbeReportReader {
  let pending = Buffer.alloc(0);
  let overflow = false;
  let rejected = 0;
  let report: ProbeReport | null = null;

  const line = (bytes: Buffer): void => {
    const read = report === null ? probeReportOf(bytes) : null;
    if (read === null) rejected += 1;
    else report = read;
  };

  return {
    push(chunk) {
      let from = 0;
      for (;;) {
        const end = chunk.indexOf(LINE_FEED, from);
        if (end === -1) break;
        const part = chunk.subarray(from, end);
        from = end + 1;
        if (overflow || pending.length + part.length > PROBE_REPORT_LINE_MAX_BYTES) rejected += 1;
        else line(pending.length === 0 ? part : Buffer.concat([pending, part]));
        pending = Buffer.alloc(0);
        overflow = false;
      }
      const rest = chunk.subarray(from);
      if (overflow || pending.length + rest.length > PROBE_REPORT_LINE_MAX_BYTES) {
        // An unfinished line beyond the bound is dropped to its line feed; nothing of it is kept.
        pending = Buffer.alloc(0);
        overflow = true;
      } else if (rest.length > 0) {
        pending = Buffer.concat([pending, rest]);
      }
    },
    report: () => report,
    rejected: () => rejected,
  };
}

/**
 * THE CORE'S OWN JUDGEMENT OF THE CODEC (AD-06 (1)): what the parameter sets ARE, by the unit type
 * each of them states in its own header, or null when they are neither kind.
 *
 *   H.264 (ITU-T H.264 7.3.1)   one header byte: `forbidden_zero_bit` 0, `nal_unit_type` in the low
 *                               5 bits - 7 for the sequence set, 8 for the picture set; no video
 *                               parameter set exists;
 *   HEVC (its ITU-T text 7.3.1.2) two header bytes: `forbidden_zero_bit` 0, `nal_unit_type` in bits
 *                               1 to 6 of the first - 32, 33, 34 for the video, sequence and
 *                               picture set - and a `nuh_temporal_id_plus1` that is not 0.
 *
 * The two cannot be confused: an H.264 sequence set read as HEVC states type 51, an HEVC one read
 * as H.264 states type 2, and H.264 has no third set.
 */
export function codecOfParameterSets(sets: Pick<ProbeReport, 'vps' | 'sps' | 'pps'>): StreamCodec | null {
  const { vps, sps, pps } = sets;
  const avc = (nal: Uint8Array, type: number): boolean => nal.length >= 2 && ((nal[0] ?? 0) & 0x80) === 0 && ((nal[0] ?? 0) & 0x1f) === type;
  const hevc = (nal: Uint8Array, type: number): boolean => nal.length >= 3 && ((nal[0] ?? 0) & 0x80) === 0 && (((nal[0] ?? 0) >> 1) & 0x3f) === type && ((nal[1] ?? 0) & 0x07) !== 0;
  if (vps.length === 0) return avc(sps, 7) && avc(pps, 8) ? 'H264' : null;
  return hevc(vps, 32) && hevc(sps, 33) && hevc(pps, 34) ? 'HEVC' : null;
}

/** The seal's own two functions, handed in by the composition: this file imports neither the sealing host nor the fragment reader. */
export interface StreamStatement {
  /** `streamProfileOf` of the sealing host: the code of a stream from its codec, its picture and its declared rate. */
  readonly profileOf: (codec: string, format: { readonly width: number; readonly height: number; readonly frameRate: number | null }) => string;
  /** `avcDeclaredFrameRate` of `capture/fragments.ts`: the rate an H.264 sequence parameter set states, or null. */
  readonly declaredRate: (sequenceParameterSet: Uint8Array) => number | null;
}

/** What the Core says of one probed stream: a code of the closed vocabulary and the facts it was formed from. */
export interface StreamFacts {
  readonly code: string;
  readonly codec: StreamCodec;
  readonly width: number;
  readonly height: number;
}

/**
 * THE MINT (AD-06 (1), (2)): the codec from the bytes, the rate by the seal's reader (H.264 only:
 * for HEVC the seal states none), the code by the seal's function, held to the pattern. A failure
 * is a reason of the closed list; nothing of the report is in it.
 */
export function streamFactsOf(report: ProbeReport, statement: StreamStatement): StreamFacts | { readonly reason: StreamTestReason } {
  const codec = codecOfParameterSets(report);
  if (codec === null) return { reason: StreamTestReason.STREAM_CODEC_NOT_USABLE };
  // The relay's word must be what its bytes are: a line that says one codec over the sets of the other is not a report.
  if (codec !== report.codecHint) return { reason: StreamTestReason.PROBE_REPORT_INVALID };
  const sided = (value: number): boolean => Number.isInteger(value) && value >= 1 && value <= PROBE_PICTURE_SIDE_MAX;
  if (!sided(report.width) || !sided(report.height)) return { reason: StreamTestReason.PROBE_REPORT_INVALID };
  let code: unknown;
  try {
    code = statement.profileOf(codec, { width: report.width, height: report.height, frameRate: codec === 'H264' ? statement.declaredRate(report.sps) : null });
  } catch {
    return { reason: StreamTestReason.PROFILE_CODE_INVALID };
  }
  if (typeof code !== 'string' || !STREAM_PROFILE_CODE.test(code) || !code.startsWith(`${codec}_`)) return { reason: StreamTestReason.PROFILE_CODE_INVALID };
  return { code, codec, width: report.width, height: report.height };
}

/** One stream of a tested camera: the Core's code and facts, and where it is on the camera (the bounded ONVIF tokens). */
export interface JudgedStream extends StreamFacts {
  /** The ONVIF profile token the locator of this stream is read with. Not a code: `A-Z a-z 0-9 _ . : -`, 1 to 64. */
  readonly onvifProfileToken: string;
  readonly videoSourceToken: string | null;
  /** The place of the stream's video source in the camera's answer, 1 to 4: the larger picture first. */
  readonly lens: number;
}

/** What one test answers. Codes, counts, bounded tokens: no free device text, no locator, no credential member. */
export interface StreamTestResult extends ConnectionTestResult {
  /** `usableProfiles` of the base type: the CODES of `streams` when the stream half ran, else the ONVIF half's own answer. */
  readonly usableProfiles: readonly string[];
  /** The judged streams; empty unless `REACHABLE` by the stream half. */
  readonly streams: readonly JudgedStream[];
  /** True when the stream half ran (a credential and a relay program). False: the answer is the ONVIF half's own. */
  readonly streamTested: boolean;
  /** A reason of `OnvifTestReason` or of `StreamTestReason`; null for `REACHABLE`. */
  readonly reason: string | null;
  /** Requests the camera refused that carried the credential, ONVIF and stream together: what the lock-out guard counts. */
  readonly rejectedCredentialRequests: number;
  /** Streams judged with a code an earlier stream of this camera already has: not kept (the stream table has one row per code). */
  readonly duplicateCodes: number;
}

/** A fact the composition may log and persist: a code and a reason word, never a value. */
export interface StreamTestNote {
  readonly code: 'CAPTURE_STREAM_TEST_RELAY_FAILED' | 'CAPTURE_STREAM_TEST_RELAY_NOT_REAPED' | 'CAPTURE_STREAM_TEST_REPORT_INVALID';
  readonly reason: string;
}

export interface StreamConnectionTesterOptions {
  /** The ONVIF half (`createOnvifConnectionTester`). */
  readonly onvif: OnvifConnectionTester;
  /** The locator read of a stream (`createOnvifStreamLocator`). */
  readonly locator: OnvifStreamLocator;
  /** The production process door (`startProductionProcess`). */
  readonly door: ProductionDoor;
  /** The relay program (`captureRelayPath`): an absolute path, or null when none is configured - then no stream half runs. */
  readonly relayProgram: string | null;
  readonly timers: CaptureTimers;
  /** The seal's own functions. */
  readonly statement: StreamStatement;
  /** Told the facts this file cannot log itself. Must not throw. */
  readonly tell?: (note: StreamTestNote) => void;
}

/** THE FACADE: one call. The ONVIF half, then the stream half when it applies. */
export interface StreamConnectionTester {
  /**
   * Rejects as the ONVIF half does, before any request. Otherwise it RESOLVES, whatever the camera or the relay does.
   *
   * `sourceAddress` (task 4 row 143b; S13-11 point 2): the address of this host every connection
   * of the test leaves from - for a STORED camera the camera-interface address its judgement
   * names. Handed in, it goes to BOTH halves and to every dial of them: the ONVIF test, each
   * locator read, and each probe (the member `source` of the relay's start message). Left out - a
   * camera that is not stored yet - nothing of the test is bound, as before.
   */
  test(candidate: CameraCandidate, credential: SealedCredential | null, signal: AbortSignal, sourceAddress?: string): Promise<StreamTestResult>;
  /**
   * THE SAME TESTER, BOUND TO ONE SOURCE ADDRESS (task 4 row 143c; decision C65): every test of the
   * answer is `test` with that address - both halves, every dial. For the test of a candidate that
   * is not stored yet on a production Core, whose caller has ONE call of a tester and binds it
   * before that call. Throws `CAPTURE_LOCATOR_INVALID` for a text that is no source address; it
   * contacts nothing.
   */
  boundTo(fromAddress: string): Pick<StreamConnectionTester, 'test'>;
}

interface Failure {
  readonly outcome: ConnectionTestOutcome;
  readonly reason: string;
}

/** The exit codes of the relay (its header `relay.h`) as ends of a PROBE: the relay's word, and what it means for the test. */
const PROBE_EXIT: Readonly<Record<number, { readonly word: string; readonly failure: Failure; readonly hostFault?: true }>> = Object.freeze({
  20: { word: 'CAMERA_UNREACHABLE', failure: { outcome: ConnectionTestOutcome.UNREACHABLE, reason: StreamTestReason.STREAM_UNREACHABLE } },
  21: { word: 'CAMERA_PROTOCOL', failure: { outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: StreamTestReason.STREAM_REFUSED } },
  22: { word: 'AUTH_SCHEME_NOT_ALLOWED', failure: { outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, reason: StreamTestReason.SCHEME_NOT_ALLOWED } },
  23: { word: 'AUTH_REFUSED', failure: { outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, reason: StreamTestReason.STREAM_CREDENTIAL_REFUSED } },
  24: { word: 'LOCATOR_NOT_FOUND', failure: { outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: StreamTestReason.STREAM_NOT_FOUND } },
  25: { word: 'REDIRECT_REFUSED', failure: { outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: StreamTestReason.STREAM_REFUSED } },
  26: { word: 'CONTROL_ADDRESS_REFUSED', failure: { outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: StreamTestReason.STREAM_REFUSED } },
  27: { word: 'DESCRIPTION_INVALID', failure: { outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: StreamTestReason.STREAM_REFUSED } },
  28: { word: 'CODEC_NOT_SUPPORTED', failure: { outcome: ConnectionTestOutcome.NOT_H264, reason: StreamTestReason.STREAM_CODEC_NOT_USABLE } },
  29: { word: 'TRANSPORT_REFUSED', failure: { outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: StreamTestReason.STREAM_REFUSED } },
  30: { word: 'KEYFRAME_TIMEOUT', failure: { outcome: ConnectionTestOutcome.UNREACHABLE, reason: StreamTestReason.STREAM_NO_PICTURE } },
  31: { word: 'CAMERA_STALLED', failure: { outcome: ConnectionTestOutcome.UNREACHABLE, reason: StreamTestReason.STREAM_NO_PICTURE } },
  32: { word: 'CAMERA_LOST', failure: { outcome: ConnectionTestOutcome.UNREACHABLE, reason: StreamTestReason.STREAM_NO_PICTURE } },
  33: { word: 'STREAM_INVALID', failure: { outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: StreamTestReason.STREAM_REFUSED } },
});

const RELAY_FAILED: Failure = Object.freeze({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: StreamTestReason.RELAY_FAILED });
/** The relay's exit codes that are its own failure: the word of each, for the note. Any other number is `EXIT_CODE_UNKNOWN`. */
const RELAY_OWN_EXIT: Readonly<Record<number, string>> = Object.freeze({
  2: 'USAGE',
  10: 'START_MESSAGE_INVALID',
  11: 'START_MESSAGE_TIMEOUT',
  12: 'LIBAVFORMAT_VERSION_MISMATCH',
  13: 'HYGIENE_FAILED',
  40: 'INGEST_REFUSED',
  41: 'INGEST_LOST',
  42: 'SOCKET_RULE',
  43: 'REPORT_NOT_WRITTEN',
  70: 'INTERNAL',
});

type Stop = 'ABORTED' | 'BOUND';
type Probed = { readonly report: ProbeReport } | { readonly failure: Failure; readonly rejected: number };

export function createStreamConnectionTester(options: StreamConnectionTesterOptions): StreamConnectionTester {
  const { onvif, locator, door, relayProgram, timers, statement } = options;
  /** The attempt a probe names in its start message and must find again in its report: a number of this object, of no session. */
  let attempts = 0;

  const tell = (code: StreamTestNote['code'], reason: string): void => {
    try {
      options.tell?.({ code, reason });
    } catch {
      // A sink never stops the test.
    }
  };

  /** Resolves true when the relay ended inside the bound. */
  const endedWithin = (process: ProductionProcess, boundMs: number): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      const cancel = timers.after(boundMs, () => resolve(false));
      void process.ended.then(() => {
        cancel();
        resolve(true);
      });
    });

  /** ONE probe of one stream: the relay start, its one line or its end, inside the bound and the caller's signal. */
  async function probe(program: string, address: string, sealed: SealedCredential, signal: AbortSignal, sourceAddress?: string): Promise<Probed> {
    const failed = (failure: Failure, rejected = 0): Probed => ({ failure, rejected });
    if (signal.aborted) return failed({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: StreamTestReason.DEADLINE });
    attempts = attempts >= RELAY_ATTEMPT_MAX ? 1 : attempts + 1;
    const attempt = attempts;
    const reader = createProbeReportReader();
    let process: ProductionProcess;
    try {
      // Row 143b: the source address of the test, when it has one, is the relay's too (the member `source` of its start message).
      process = startCameraProbe({ door, program, timers, locator: address, sealed, attempt, ...(sourceAddress === undefined ? {} : { source: sourceAddress }), onOutput: (chunk) => reader.push(chunk) });
    } catch (error) {
      // The injection point refused the address before anything was started. Nothing of what it threw travels on.
      if (error instanceof CaptureAdapterError) return failed({ outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: StreamTestReason.STREAM_LOCATOR_REFUSED });
      tell('CAPTURE_STREAM_TEST_RELAY_FAILED', 'START_FAILED');
      return failed({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: StreamTestReason.RELAY_NOT_STARTED });
    }

    let stopNow: (why: Stop) => void = () => {};
    const stopped = new Promise<Stop>((resolve) => {
      stopNow = resolve;
    });
    const onAbort = (): void => stopNow('ABORTED');
    signal.addEventListener('abort', onAbort, { once: true });
    const cancelBound = timers.after(STREAM_PROBE_BOUND_MS, () => stopNow('BOUND'));

    let end: ProductionExit | Stop | 'NOT_STARTED';
    try {
      const startedOrStopped = await Promise.race([process.started.then((): 'STARTED' => 'STARTED', (): 'NOT_STARTED' => 'NOT_STARTED'), stopped]);
      end = startedOrStopped === 'STARTED' ? await Promise.race([process.ended, stopped]) : startedOrStopped;
    } finally {
      cancelBound();
      signal.removeEventListener('abort', onAbort);
    }

    if (end === 'ABORTED' || end === 'BOUND' || end === 'NOT_STARTED') {
      // Whatever stopped the probe: a started relay is killed and waited for before the test answers (AD-09 (3)).
      process.kill('SIGKILL');
      if (!(await endedWithin(process, STREAM_PROBE_REAP_BOUND_MS))) tell('CAPTURE_STREAM_TEST_RELAY_NOT_REAPED', end);
      if (end === 'NOT_STARTED') {
        tell('CAPTURE_STREAM_TEST_RELAY_FAILED', 'NOT_STARTED');
        return failed({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: StreamTestReason.RELAY_NOT_STARTED });
      }
      return failed({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: end === 'ABORTED' ? StreamTestReason.DEADLINE : StreamTestReason.STREAM_PROBE_TIMEOUT });
    }

    if (end.spawnFailed) {
      tell('CAPTURE_STREAM_TEST_RELAY_FAILED', 'NOT_STARTED');
      return failed({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: StreamTestReason.RELAY_NOT_STARTED });
    }
    if (end.exitCode === 0) {
      const report = reader.report();
      // Exit 0 without a line means "stopped before the answer", never "probed" (the relay's contract).
      if (report === null) {
        if (reader.rejected() > 0) {
          tell('CAPTURE_STREAM_TEST_REPORT_INVALID', 'LINE_NOT_THE_FORM');
          return failed({ outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: StreamTestReason.PROBE_REPORT_INVALID });
        }
        return failed({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: StreamTestReason.STREAM_NO_ANSWER });
      }
      // The relay names the attempt of its own start message; another number is not this probe's word.
      if (report.attempt !== attempt) {
        tell('CAPTURE_STREAM_TEST_REPORT_INVALID', 'ATTEMPT_DIFFERS');
        return failed({ outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: StreamTestReason.PROBE_REPORT_INVALID });
      }
      return { report };
    }
    const known = end.exitCode !== null && Object.hasOwn(PROBE_EXIT, end.exitCode) ? PROBE_EXIT[end.exitCode] : undefined;
    if (known === undefined) {
      tell('CAPTURE_STREAM_TEST_RELAY_FAILED', end.exitCode === null ? 'ENDED_BY_SIGNAL' : Object.hasOwn(RELAY_OWN_EXIT, end.exitCode) ? (RELAY_OWN_EXIT[end.exitCode] ?? 'EXIT_CODE_UNKNOWN') : 'EXIT_CODE_UNKNOWN');
      return failed(RELAY_FAILED);
    }
    // A refused credential at the stream is ONE rejected request that carried it (the relay ends at the first refusal).
    return failed(known.failure, known.failure.reason === StreamTestReason.STREAM_CREDENTIAL_REFUSED ? 1 : 0);
  }

  async function test(candidate: CameraCandidate, credential: SealedCredential | null, signal: AbortSignal, sourceAddress?: string): Promise<StreamTestResult> {
    // Row 143b: ONE source address for every dial of the test. Finding E-02: the two ONVIF facades REQUIRE the argument, so a
    // test without one STATES `undefined` to them (the host routes) - it is handed on as it came, never left out.
    const from: readonly [string | undefined] = [sourceAddress];
    const first = await onvif.test(candidate, credential, signal, ...from);
    let rejected = first.rejectedCredentialRequests;
    const answered = (outcome: ConnectionTestOutcome, reason: string | null, streamTested: boolean, streams: readonly JudgedStream[] = [], duplicateCodes = 0): StreamTestResult =>
      Object.freeze({
        outcome,
        authenticated: first.authenticated,
        usableProfiles: Object.freeze(streamTested ? streams.map((stream) => stream.code) : [...first.usableProfiles]),
        streams: Object.freeze([...streams]),
        streamTested,
        reason,
        rejectedCredentialRequests: rejected,
        duplicateCodes,
      });

    // The announcement is advice: the streams the ONVIF half names are judged whichever codec the camera said.
    const named = first.outcome === ConnectionTestOutcome.REACHABLE || (first.outcome === ConnectionTestOutcome.NOT_H264 && first.reason === OnvifTestReason.NO_H264_PROFILE);
    if (credential === null || relayProgram === null || !named) return answered(first.outcome, first.reason, false);

    const streams: JudgedStream[] = [];
    /** The failures in the order they came: the first one is the outcome of a test that judged no stream. */
    const failures: Failure[] = [];
    let duplicateCodes = 0;
    const fail = (failure: Failure): void => {
      failures.push(failure);
    };
    const profiles: readonly OnvifStreamProfile[] = first.profiles.slice(0, STREAM_TEST_MAX_STREAMS);
    for (const [index, profile] of profiles.entries()) {
      if (signal.aborted) {
        fail({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: StreamTestReason.DEADLINE });
        break;
      }
      // Where the stream is, now: one authenticated read. The address lives inside this turn of the loop.
      let address: string;
      try {
        const located = await locator.locate(candidate, credential, profile.token, signal, ...from);
        rejected += located.rejectedCredentialRequests;
        if (located.outcome !== ConnectionTestOutcome.REACHABLE || located.locator === null) {
          fail({ outcome: located.outcome === ConnectionTestOutcome.REACHABLE ? ConnectionTestOutcome.WRONG_PROFILE : located.outcome, reason: located.reason ?? OnvifTestReason.STREAM_ADDRESS_MISSING });
          // A refused credential is final: nothing more is asked of the camera with it.
          if (located.outcome === ConnectionTestOutcome.AUTHENTICATION_FAILED) break;
          continue;
        }
        address = located.locator;
      } catch (error) {
        if (!(error instanceof CaptureAdapterError)) throw error;
        fail({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: signal.aborted ? StreamTestReason.DEADLINE : OnvifTestReason.NO_ANSWER });
        continue;
      }

      const probed = await probe(relayProgram, address, credential, signal, sourceAddress);
      if ('failure' in probed) {
        rejected += probed.rejected;
        fail(probed.failure);
        if (probed.failure.outcome === ConnectionTestOutcome.AUTHENTICATION_FAILED || probed.failure.reason === StreamTestReason.DEADLINE) break;
        continue;
      }
      const facts = streamFactsOf(probed.report, statement);
      if ('reason' in facts) {
        if (facts.reason !== StreamTestReason.STREAM_CODEC_NOT_USABLE) tell('CAPTURE_STREAM_TEST_REPORT_INVALID', facts.reason);
        fail({ outcome: facts.reason === StreamTestReason.STREAM_CODEC_NOT_USABLE ? ConnectionTestOutcome.NOT_H264 : ConnectionTestOutcome.WRONG_PROFILE, reason: facts.reason });
        continue;
      }
      if (streams.some((stream) => stream.code === facts.code)) {
        duplicateCodes += 1;
        continue;
      }
      streams.push(Object.freeze({ ...facts, onvifProfileToken: profile.token, videoSourceToken: profile.videoSourceToken, lens: index + 1 }));
    }

    if (streams.length > 0) return answered(ConnectionTestOutcome.REACHABLE, null, true, streams, duplicateCodes);
    const failure: Failure = failures[0] ?? { outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: OnvifTestReason.NO_USABLE_PROFILE };
    return answered(failure.outcome, failure.reason, true, [], duplicateCodes);
  }

  /**
   * Row 143c (decision C65): the same test, BOUND. The address is held to the form of a source address here, once,
   * before any test; every test of the answer then hands it to both halves, as a stored camera's test does.
   */
  const boundTo = (fromAddress: string): Pick<StreamConnectionTester, 'test'> => {
    if (!isSourceAddress(fromAddress)) throw new CaptureAdapterError(CaptureAdapterRefusal.LOCATOR_INVALID);
    return Object.freeze({ test: (candidate: CameraCandidate, credential: SealedCredential | null, signal: AbortSignal) => test(candidate, credential, signal, fromAddress) });
  };

  return Object.freeze({ test, boundTo });
}
