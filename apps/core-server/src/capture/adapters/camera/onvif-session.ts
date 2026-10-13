/**
 * The read-only connection test toward one camera candidate (blueprint row 142; capture spec
 * §A.6.2 CT-1 to CT-7, §A.6.3 CR-1 to CR-5, §G.1 G-R10 and G-R11; contract C3 §2.6 "Connection
 * test"; decisions D75, D76, D82, D86 C-2; SEC35-31, SEC35-32, SEC35-33, SEC35-34, SEC35-38).
 *
 * THE ONE FILE that imports the `onvif` package, and the one file under `src/capture/` that
 * imports an HTTP agent. The client object of the package never leaves this file: what it exports
 * is a FACADE with one call, `test`, that makes at most the five reads of rule CT-1
 * (`getSystemDateAndTime`, `getServices`, `getCapabilities`, `getProfiles`, `getStreamUri`).
 * No configuration call exists here: no clock, GOP, profile or network set, no reboot, no PTZ, no
 * PoE (class C). No RTSP connection is opened: the stream address a device names is COMPARED and
 * then dropped - never stored, never contacted (D82).
 *
 * WHERE A REQUEST GOES (CT-3; SEC35-32). To the candidate's own address only: the host of the
 * announced service address must be the address the probe answer came from (checked again here),
 * the client is built with `preserveAddress: true`, so a service address inside an answer cannot
 * move the next request, and the package follows no redirect.
 *
 * HOW A CREDENTIAL TRAVELS (CR-5; SEC35-31, SEC35-38). Never in clear and never as Basic: the
 * package has neither form. The first reads run on a client that holds NO credential. For the
 * first read that needs one, the two values are set on the client and the read is sent WITHOUT
 * them; the device's own challenge decides:
 *
 *   an HTTP Digest challenge (MD5 or SHA-256)   one request with the digest answer;
 *   a challenge that is not Digest (Basic)      nothing is sent: `SCHEME_NOT_ALLOWED`;
 *   a SOAP fault "not authorized", no challenge one request with a WS-Security `UsernameToken`
 *                                               (`PasswordDigest`).
 *
 * A refusal ends the test: nothing is retried, so a failed test holds AT MOST ONE rejected request
 * that carried the credential (the contract allows two). The account name travels in clear in both
 * forms, and the receiving device can test guesses against the digest: the test's result is not
 * evidence of the device's identity (CT-6).
 *
 * WHAT A HOSTILE DEVICE CAN DO (SEC35-33). One agent per test, no keep-alive, no proxy. Its
 * sockets count what they receive and the test ends above `maxReceivedBytes`; a connection that
 * is not established within `connectMs` is destroyed; the caller's signal (the whole-test
 * deadline, `CAPTURE_CONNECTION_TEST_TIMEOUT_MS`) destroys every socket at once. Every callback of
 * the package is wrapped (called once, never throwing), and whatever the package throws or answers
 * is reduced to an outcome and a reason of the closed list below (CT-7): no error object, no fault
 * text and no envelope leaves this file. No listener is attached to the client's raw events.
 *
 * WHAT IS NOT PROVEN HERE: TLS. An `https:` service address is used as announced with the
 * certificate NOT checked (CT-6; a camera's self-signed certificate cannot be validated) and TLS
 * 1.2 as the floor; the fake stub speaks no TLS, so that branch was never run.
 *
 * The credential cannot be erased from memory (CR-3: no zeroing is claimed). It is a parameter of
 * the one call; when the call ends the two values are taken off the client object, and nothing
 * the call returns holds them.
 *
 * TASK 4 ROW 26 (WP-04; design addendum 2.3, 4.1 a and e, 7.2; logic H-03, H-05, H-11 of the
 * input-av scheme, `nvr/onvif_client.py:232-256`). Two things were added, both reads:
 *
 *   WHICH PROFILE IS A CAMERA'S STREAM. A `REACHABLE` result also names, per video source (lens),
 *   the profile with the largest pixel area - "main stream" is that rule, not a profile name - with
 *   the larger picture first: the ONVIF profile token, the video-source token and the announced
 *   size. The announced ENCODING takes no part in the choice (the bench cameras announce H264 and
 *   deliver HEVC), and NO PROFILE CODE IS FORMED HERE: a code is the stream's own statement and is
 *   formed by the stream test from the stream (addendum 7.2; AD-06). A token is device text: it is
 *   held to one character rule and one length and is otherwise returned unchanged.
 *
 *   WHERE THAT STREAM IS. A second facade, `createOnvifStreamLocator`, has one call, `locate`: the
 *   clock read, the service read and ONE `GetStreamUri` for a named profile token. It answers the
 *   address the device names, only if it is the host-and-path form on the candidate's own host
 *   WITHOUT a user part (`credentialFreeLocator`, the rule of the injection point). It is resolved
 *   at each start of a source and stored nowhere (H-11); it holds no credential, and this file
 *   still OPENS NO STREAM. The connection test goes on comparing and dropping the address (D82).
 *
 * TASK 4 ROW 174 (decision C24). The locator `locate` answers MAY CARRY A QUERY, under the closed
 * rule stated at `queryAllowed`: bounded, of a closed character set, and with no parameter named
 * like a credential. A user part stays refused wherever an `@` stands, a fragment stays refused,
 * and the locator is still written to no log and stored nowhere by this file. Since row 46 the
 * rule itself stands in `../credential.ts`, inside `credentialFreeLocator`: the read of a locator
 * and the injection point judge a query by that ONE function.
 *
 * TASK 4 INTEGRATION PASS I-7 (row 49's request). A third facade, `createOnvifTimeReader`, has one
 * call, `read`: the clock read ALONE, without a credential, answering whether the device answered
 * and the instant it names. It is one of the five reads (no sixth call exists), it runs through
 * the same exchange, and it is wired nowhere by this file: the composition hands it to the camera
 * watch (row 85).
 */
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import cam from 'onvif/lib/cam.js';
import type { CaptureTimers } from '../../types';
import { credentialFreeLocator, usingCredential, type SealedCredential } from '../credential';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { ConnectionTestOutcome, type CameraCandidate, type ConnectionTestResult } from '../types';
// The target of a test is worked out in a sibling file that holds no client (pass F-Y): the
// confirmation text of the connect dialog is built there from the SAME function this file dials with.
import { targetOf, type ConnectionTarget } from './connection-target';

/** The bounds of one test (capture spec §A.6.2 CT-4; SEC35-33). The whole-test deadline is the caller's signal. */
export const ONVIF_SESSION_LIMITS: OnvifSessionLimits = Object.freeze({
  /** A connection that is not established within this is destroyed. */
  connectMs: 3_000,
  /** The idle limit of one request. */
  requestMs: 5_000,
  /** Received bytes of one test, all requests together. */
  maxReceivedBytes: 1_048_576,
  /** Profiles read of one answer; a device that lists more is judged by the first ones. */
  maxProfiles: 16,
  /** A GOP announced longer than this gets the warning `GOP_ABOVE_BOUND` (changing it is class C). */
  gopBoundMs: 2_000,
});
export interface OnvifSessionLimits {
  readonly connectMs: number;
  readonly requestMs: number;
  readonly maxReceivedBytes: number;
  readonly maxProfiles: number;
  readonly gopBoundMs: number;
}

/** Why a test ended as it did: a closed list of codes. Never device text. */
export const OnvifTestReason = {
  NO_ANSWER: 'NO_ANSWER',
  DEADLINE: 'DEADLINE',
  BYTE_CAP: 'BYTE_CAP',
  NOT_ONVIF: 'NOT_ONVIF',
  NO_MEDIA_SERVICE: 'NO_MEDIA_SERVICE',
  CREDENTIAL_REFUSED: 'CREDENTIAL_REFUSED',
  CREDENTIAL_ABSENT: 'CREDENTIAL_ABSENT',
  SCHEME_NOT_ALLOWED: 'SCHEME_NOT_ALLOWED',
  NO_USABLE_PROFILE: 'NO_USABLE_PROFILE',
  PROFILE_ANSWER_INVALID: 'PROFILE_ANSWER_INVALID',
  STREAM_ADDRESS_MISSING: 'STREAM_ADDRESS_MISSING',
  STREAM_SCHEME: 'STREAM_SCHEME',
  STREAM_USER_PART: 'STREAM_USER_PART',
  STREAM_HOST_MISMATCH: 'STREAM_HOST_MISMATCH',
  /** Only from `locate`: an address on the right host that is not the host-and-path form with, at most, a query inside the query rule (a fragment, a character outside the rule, too long, a query the rule refuses). */
  STREAM_LOCATOR_FORM: 'STREAM_LOCATOR_FORM',
  NO_H264_PROFILE: 'NO_H264_PROFILE',
} as const;
export type OnvifTestReason = (typeof OnvifTestReason)[keyof typeof OnvifTestReason];

export const OnvifTestWarning = { GOP_ABOVE_BOUND: 'GOP_ABOVE_BOUND' } as const;
export type OnvifTestWarning = (typeof OnvifTestWarning)[keyof typeof OnvifTestWarning];

/** The five reads of rule CT-1, by the name of the device operation. */
export const ONVIF_SESSION_READS = ['GetSystemDateAndTime', 'GetServices', 'GetCapabilities', 'GetProfiles', 'GetStreamUri'] as const;
export type OnvifSessionRead = (typeof ONVIF_SESSION_READS)[number];

/**
 * The stream of one video source as the device announces it (task 4 row 26). The two tokens are
 * ONVIF tokens, not Core profile codes: 1 to 64 characters of `A-Z a-z 0-9 _ . : -`, unchanged.
 */
export interface OnvifStreamProfile {
  /** The ONVIF profile token: what `locate` is asked with. */
  readonly token: string;
  /** The video source (lens) the profile belongs to. Null when the device names none, or one the rule does not admit. */
  readonly videoSourceToken: string | null;
  /** The announced picture, whole pixels inside 1 to 16,384. Both null when either is absent or outside: such a profile counts as area 0. */
  readonly width: number | null;
  readonly height: number | null;
}

/** What one test answers. Codes, counts and bounded tokens only: no free device text, no locator, no credential member. */
export interface OnvifSessionResult extends ConnectionTestResult {
  /**
   * One entry per video source, the profile with the largest announced pixel area of that source,
   * the larger picture first (equal areas: the device's order). Read from EVERY usable profile,
   * whatever encoding the device announces; empty unless `REACHABLE`, or `NOT_H264` by the
   * announcement (`NO_H264_PROFILE`): the announced encoding is advice, and the stream test of
   * task 4 row 50 judges these streams whichever of the two the device said.
   */
  readonly profiles: readonly OnvifStreamProfile[];
  /** Null for `REACHABLE`. */
  readonly reason: OnvifTestReason | null;
  readonly warnings: readonly OnvifTestWarning[];
  /** The reads the test asked for, in order (a read may be more than one HTTP request). */
  readonly reads: readonly OnvifSessionRead[];
  /** Requests that carried the credential (a digest answer or a token). 0 without a credential. */
  readonly credentialRequests: number;
  /** Of those, how many the device refused: 0 or 1. What a camera's own lock-out counts. */
  readonly rejectedCredentialRequests: number;
}

export interface OnvifConnectionTesterOptions {
  /** The capture timer seam (DS-14): the connection limit is one call of it. */
  readonly timers: CaptureTimers;
  /** A test passes smaller bounds. */
  readonly limits?: Partial<OnvifSessionLimits>;
}

/** THE FACADE (SEC35-33 (5)): one call, five reads at most, nothing else reachable. */
export interface OnvifConnectionTester {
  /**
   * One read-only attempt. Rejects before any request with `CAPTURE_ADAPTER_ABORTED` for a signal
   * that is already aborted and with `CAPTURE_LOCATOR_INVALID` for a candidate that may not be
   * contacted (not testable, or a service address that is not on the candidate's own address).
   * Otherwise it RESOLVES, whatever the device does.
   */
  test(candidate: CameraCandidate, credential: SealedCredential | null, signal: AbortSignal): Promise<OnvifSessionResult>;
}

/** What one `locate` answers. The locator is the one piece of device text: checked, bounded, without a credential. */
export interface OnvifLocatorResult {
  /** `REACHABLE`, `AUTHENTICATION_FAILED`, `WRONG_PROFILE` or `UNREACHABLE`. Never `NOT_H264`: no codec is judged here. */
  readonly outcome: ConnectionTestOutcome;
  /** Null for `REACHABLE`. */
  readonly reason: OnvifTestReason | null;
  /** The stream locator of the profile, on the candidate's own host, without a user part: host and path, and a query only inside the query rule (row 174). Null unless `REACHABLE`. */
  readonly locator: string | null;
  readonly reads: readonly OnvifSessionRead[];
  readonly credentialRequests: number;
  readonly rejectedCredentialRequests: number;
}

/** THE SECOND FACADE (task 4 row 26): one call, three reads at most (four when `GetServices` is not answered), nothing else reachable. */
export interface OnvifStreamLocator {
  /**
   * Reads where the stream of ONE profile is, now. Rejects before any request with
   * `CAPTURE_PROFILE_UNKNOWN` for a token that is not of the token form, and as `test` does for an
   * aborted signal and for a candidate that may not be contacted. Otherwise it RESOLVES. At most
   * one request carries the credential, and a refusal of it is final (the lock-out bound of `test`).
   * Nothing keeps the answer: a caller resolves again at each start of a source.
   */
  locate(candidate: CameraCandidate, credential: SealedCredential | null, profileToken: string, signal: AbortSignal): Promise<OnvifLocatorResult>;
}

const PROFILE_TOKEN = /^[A-Za-z0-9_.:-]{1,64}$/;
const STREAM_SCHEME = 'rtsp:';
const STREAM_ADDRESS_MAX_CHARS = 512;
/** A locator that leaves this file: visible ASCII only. */
const LOCATOR_CHARS = /^[\x21-\x7e]+$/;
/** The largest side of a picture this file believes a device (the syntax limit of both codecs' levels is below it). */
const PICTURE_SIDE_MAX = 16_384;
/** The hash names of a Digest challenge the test answers. Anything else is not answered (SEC35-31; P-5). */
const DIGEST_ALGORITHMS: readonly string[] = ['MD5', 'SHA-256'];
const NOT_AUTHORIZED = /not\s*authori[sz]ed|unauthori[sz]ed|failedauthentication|authentication\s+(?:failed|required)/i;

/** How a read of the package failed, as far as the test needs to know. */
type Failure =
  | 'TRANSPORT' //             no answer: refused, reset, timed out, destroyed
  | 'CREDENTIAL_REFUSED' //    the digest answer was refused
  | 'NO_DIGEST_CHALLENGE' //   a challenge that names no Digest scheme
  | 'SCHEME_NOT_ALLOWED' //    a Digest challenge with a hash the test does not answer
  | 'CHALLENGED_UNARMED' //    a Digest challenge while the client held no credential
  | 'NOT_AUTHORIZED_FAULT' //  a SOAP fault that says so, without a challenge
  | 'OTHER_FAULT'
  | 'INVALID_ANSWER'; //       not a SOAP answer, or one the package could not read

type Answer = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly failure: Failure };

/** What the digest wrapper throws inside the package, which hands it back through the read's callback. */
class Stop extends Error {
  readonly failure: Failure;
  constructor(failure: Failure) {
    super('the connection test does not answer this challenge');
    this.name = 'OnvifSessionStop';
    this.failure = failure;
  }
}

/**
 * Reduces whatever a read of the package failed with to a `Failure`. The package's texts are
 * compared with the fixed sentences of version 0.8.3 and never passed on (CT-7): the error object
 * can hold the request envelope.
 */
function failureOf(error: unknown): Failure {
  if (error instanceof Stop) return error.failure;
  if (!(error instanceof Error)) return 'INVALID_ANSWER';
  const text = error.message;
  if (text.startsWith('Digest authentication failed')) return 'CREDENTIAL_REFUSED';
  if (text.startsWith('Digest authentication headers not found')) return 'NO_DIGEST_CHALLENGE';
  if (text.startsWith('ONVIF SOAP Fault')) return NOT_AUTHORIZED.test(text) ? 'NOT_AUTHORIZED_FAULT' : 'OTHER_FAULT';
  if (text === 'Network timeout') return 'TRANSPORT';
  const code: unknown = Reflect.get(error, 'code');
  if (typeof code === 'string' && /^E[A-Z_]+$/.test(code)) return 'TRANSPORT';
  return 'INVALID_ANSWER';
}

const isAuthFailure = (failure: Failure): boolean =>
  failure === 'CREDENTIAL_REFUSED' || failure === 'NO_DIGEST_CHALLENGE' || failure === 'SCHEME_NOT_ALLOWED' || failure === 'CHALLENGED_UNARMED' || failure === 'NOT_AUTHORIZED_FAULT';

/** True for a Digest challenge whose hash is one the test answers; a challenge without a name is MD5 (RFC 7616). */
function digestChallengeAllowed(challenge: unknown): boolean {
  if (typeof challenge !== 'string' || challenge.length > 2_048) return false;
  const named = /\balgorithm\s*=\s*"?([A-Za-z0-9-]+)"?/i.exec(challenge);
  return named === null || DIGEST_ALGORITHMS.includes((named[1] ?? '').toUpperCase());
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);
const member = (value: unknown, key: string): unknown => (isRecord(value) && Object.hasOwn(value, key) ? value[key] : undefined);

interface ReadProfile {
  readonly token: string;
  readonly h264: boolean;
  readonly gopMs: number | null;
  /** What the profiles of one video source have in common. Never leaves this file: it may be device text outside the token rule. */
  readonly sourceKey: string;
  readonly videoSourceToken: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

const isPictureSide = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= PICTURE_SIDE_MAX;

/**
 * The usable profiles of a `GetProfiles` answer, read by fixed paths (no recursive walk): a
 * profile with a token of the code form, a video source configuration and a video encoder
 * configuration. Everything else of the answer is dropped here.
 *
 * The video source and the size (task 4 row 26) never make a profile unusable: a source token
 * outside the token rule still groups its profiles and is answered as null; a size that is absent,
 * not whole or outside the bound is answered as null and counts as area 0.
 */
function usableProfilesOf(answer: unknown, limit: number): ReadProfile[] {
  const list: readonly unknown[] = Array.isArray(answer) ? answer : [];
  const usable: ReadProfile[] = [];
  for (const profile of list.slice(0, limit)) {
    const token = member(member(profile, '$'), 'token');
    const encoder = member(profile, 'videoEncoderConfiguration');
    const source = member(profile, 'videoSourceConfiguration');
    if (typeof token !== 'string' || !PROFILE_TOKEN.test(token) || !isRecord(source) || !isRecord(encoder)) continue;
    const frames = member(member(encoder, 'H264'), 'govLength') ?? member(encoder, 'govLength');
    const rate = member(member(encoder, 'rateControl'), 'frameRateLimit');
    const gopMs = typeof frames === 'number' && typeof rate === 'number' && frames > 0 && rate > 0 ? (frames / rate) * 1_000 : null;
    // The package turns an all-digit text into a number: such a source still groups, under its own kind of key.
    const named = member(source, 'sourceToken');
    const sourceKey = typeof named === 'string' ? `text:${named}` : typeof named === 'number' ? `number:${named}` : 'none';
    const width = member(member(encoder, 'resolution'), 'width');
    const height = member(member(encoder, 'resolution'), 'height');
    const sized = isPictureSide(width) && isPictureSide(height);
    usable.push({
      token,
      h264: member(encoder, 'encoding') === 'H264',
      gopMs,
      sourceKey,
      videoSourceToken: typeof named === 'string' && PROFILE_TOKEN.test(named) ? named : null,
      width: sized ? width : null,
      height: sized ? height : null,
    });
  }
  return usable;
}

const areaOf = (profile: { readonly width: number | null; readonly height: number | null }): number => (profile.width ?? 0) * (profile.height ?? 0);

/**
 * The stream of each video source (H-03; `nvr/onvif_client.py:243-249` of the input-av scheme):
 * the profiles are grouped by their video source, of each group the one with the largest pixel
 * area is taken (the first of equals), and the groups are answered with the larger picture first
 * (equal areas keep the device's order). The announced encoding is not looked at.
 */
function mainProfilesOf(usable: readonly ReadProfile[]): OnvifStreamProfile[] {
  const largest = new Map<string, ReadProfile>();
  for (const profile of usable) {
    const held = largest.get(profile.sourceKey);
    if (held === undefined || areaOf(profile) > areaOf(held)) largest.set(profile.sourceKey, profile);
  }
  // A Map keeps the place of a key's first entry, and the sort is stable: equals stay in the device's order.
  return [...largest.values()]
    .sort((a, b) => areaOf(b) - areaOf(a))
    .map((profile) => Object.freeze({ token: profile.token, videoSourceToken: profile.videoSourceToken, width: profile.width, height: profile.height }));
}

/** Null when the stream address of a profile is the candidate's own; else the reason. The address itself is dropped. */
function streamAddressFault(answer: unknown, host: string): OnvifTestReason | null {
  const address = member(answer, 'uri');
  if (typeof address !== 'string' || address.length === 0 || address.length > STREAM_ADDRESS_MAX_CHARS) return OnvifTestReason.STREAM_ADDRESS_MISSING;
  let parsed: URL;
  try {
    parsed = new URL(address);
  } catch {
    return OnvifTestReason.STREAM_ADDRESS_MISSING;
  }
  if (parsed.protocol !== STREAM_SCHEME) return OnvifTestReason.STREAM_SCHEME;
  if (address.includes('@')) return OnvifTestReason.STREAM_USER_PART;
  return parsed.hostname === host ? null : OnvifTestReason.STREAM_HOST_MISMATCH;
}

/** The length bound of a locator, as the injection point holds it (`../credential.ts`). */
const LOCATOR_MAX_CHARS = 256;

/**
 * The stream address of a profile as a locator that may leave this file (task 4 row 26; H-05):
 * first the comparison of the test (scheme, NO USER PART anywhere in the text, the candidate's own
 * host), then visible ASCII only, no fragment mark and the length bound; then the WHOLE text is
 * held to the rule of the injection point (`credentialFreeLocator`: host and path, and a query
 * only inside the query rule of row 174, which stands there since row 46 - one function for the
 * read and for the injection). The text is the device's, unchanged; a refusal names no part of
 * it, and nothing here writes it anywhere.
 */
function locatorOf(answer: unknown, host: string): { readonly locator: string } | { readonly reason: OnvifTestReason } {
  const fault = streamAddressFault(answer, host);
  if (fault !== null) return { reason: fault };
  const address = member(answer, 'uri');
  if (typeof address !== 'string' || address.length > LOCATOR_MAX_CHARS || !LOCATOR_CHARS.test(address) || address.includes('#')) return { reason: OnvifTestReason.STREAM_LOCATOR_FORM };
  try {
    credentialFreeLocator(address);
  } catch {
    return { reason: OnvifTestReason.STREAM_LOCATOR_FORM };
  }
  return { locator: address };
}

/** What the agent's sockets are to this file: a stream that can be watched and destroyed. No socket module is imported. */
interface WatchedSocket {
  readonly connecting?: boolean;
  on(event: 'data', listener: (chunk: { readonly length: number }) => void): unknown;
  once(event: 'close' | 'connect' | 'secureConnect', listener: () => void): unknown;
  destroy(): unknown;
}

type CreateConnection = (options: object, callback?: (error: Error | null, stream: never) => void) => unknown;

type Invoke = (callback: (error: unknown, value?: unknown) => void) => void;

/** Why an exchange ended before its steps did: the caller's deadline, the byte cap, or a fault of this file's own steps. */
type Cut = 'DEADLINE' | 'BYTE_CAP' | 'FAULT';

/**
 * What the steps of one exchange with a device work with (task 4 row 26: the test and the locator
 * read are two courses of the same exchange). The client is a member HERE and of nothing a course
 * answers: it does not leave the file.
 */
interface Exchange {
  readonly client: InstanceType<typeof cam.Cam>;
  readonly target: ConnectionTarget;
  /** Whether a credential was supplied. */
  readonly authenticated: boolean;
  readonly reads: readonly OnvifSessionRead[];
  credentialRequests(): number;
  rejectedCredentialRequests(): number;
  ask(read: OnvifSessionRead, invoke: Invoke): Promise<Answer>;
  authorizedAsk(read: OnvifSessionRead, invoke: Invoke): Promise<Answer>;
}

interface Course<Result> {
  steps(session: Exchange): Promise<Result>;
  /** The answer of an exchange that was cut. */
  cut(session: Exchange, cause: Cut): Result;
}

/** An outcome that ends a course, with its reason. */
interface Halt {
  readonly outcome: ConnectionTestOutcome;
  readonly reason: OnvifTestReason;
}
const NO_ANSWER: Halt = Object.freeze({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NO_ANSWER });
const NOT_ONVIF: Halt = Object.freeze({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NOT_ONVIF });
const cutReason = (cause: Cut): OnvifTestReason => (cause === 'DEADLINE' ? OnvifTestReason.DEADLINE : cause === 'BYTE_CAP' ? OnvifTestReason.BYTE_CAP : OnvifTestReason.NOT_ONVIF);

const refusalOf = (failure: Failure, authenticated: boolean): Halt => ({
  outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED,
  reason:
    failure === 'CREDENTIAL_REFUSED'
      ? OnvifTestReason.CREDENTIAL_REFUSED
      : failure === 'NO_DIGEST_CHALLENGE' || failure === 'SCHEME_NOT_ALLOWED'
        ? OnvifTestReason.SCHEME_NOT_ALLOWED
        : authenticated
          ? OnvifTestReason.CREDENTIAL_REFUSED
          : OnvifTestReason.CREDENTIAL_ABSENT,
});

/**
 * Steps 1 and 2 of both courses: the device's clock and its service addresses, without a
 * credential. Null when the device named a media service; else where the course ends.
 */
async function mediaServiceOf({ client, ask, authorizedAsk, authenticated }: Exchange): Promise<Halt | null> {
  // 1. The device's clock, without a credential (PRE_AUTH). A device that refuses it is asked no second time with one.
  const clock = await ask('GetSystemDateAndTime', (callback) => client.getSystemDateAndTime(callback));
  if (!clock.ok && clock.failure === 'TRANSPORT') return NO_ANSWER;
  if (!clock.ok && !isAuthFailure(clock.failure)) return NOT_ONVIF;

  // 2. The service addresses, without a credential; `GetCapabilities` only when `GetServices` is not answered.
  let services = await ask('GetServices', (callback) => client.getServices(false, callback));
  if (!services.ok && services.failure !== 'TRANSPORT') services = await ask('GetCapabilities', (callback) => client.getCapabilities(callback));
  // A device that keeps both behind authentication: the credential's one request is spent here.
  if (!services.ok && isAuthFailure(services.failure) && authenticated) services = await authorizedAsk('GetServices', (callback) => client.getServices(false, callback));
  if (!services.ok) {
    if (services.failure === 'TRANSPORT') return NO_ANSWER;
    if (isAuthFailure(services.failure)) return refusalOf(services.failure, authenticated);
    return NOT_ONVIF;
  }
  const addresses = Reflect.get(client, 'uri') as unknown;
  if (!isRecord(member(addresses, 'media')) && !isRecord(member(addresses, 'media2'))) return { outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: OnvifTestReason.NO_MEDIA_SERVICE };
  return null;
}

/** ONE `GetStreamUri` for a profile token: the answer as the package read it, or where the course ends. */
async function streamAnswerOf({ client, authorizedAsk, authenticated }: Exchange, profileToken: string): Promise<{ readonly halt: Halt } | { readonly halt: null; readonly value: unknown }> {
  const stream = await authorizedAsk('GetStreamUri', (callback) => client.getStreamUri({ protocol: 'RTSP', profileToken }, callback));
  if (stream.ok) return { halt: null, value: stream.value };
  if (stream.failure === 'TRANSPORT') return { halt: NO_ANSWER };
  if (isAuthFailure(stream.failure)) return { halt: refusalOf(stream.failure, authenticated) };
  return { halt: { outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: OnvifTestReason.STREAM_ADDRESS_MISSING } };
}

/**
 * ONE exchange with one device: its agent, its client, its bounds, and the rule of how a
 * credential travels. Both facades run their course through it, so neither has a second way out.
 */
function exchange<Result>(
  limits: OnvifSessionLimits,
  timers: CaptureTimers,
  candidate: CameraCandidate,
  credential: SealedCredential | null,
  signal: AbortSignal,
  course: Course<Result>,
): Promise<Result> {
    if (signal.aborted) return Promise.reject(new CaptureAdapterError(CaptureAdapterRefusal.ABORTED));
    let target: ConnectionTarget;
    try {
      target = targetOf(candidate);
    } catch (error) {
      return Promise.reject(error);
    }
    const authenticated = credential !== null;

    return new Promise<Result>((resolveExchange) => {
      const reads: OnvifSessionRead[] = [];
      const sockets = new Set<WatchedSocket>();
      const cancels = new Set<() => void>();
      let settled = false;
      let received = 0;
      let armed = false;
      let digestAllowed = true;
      let credentialRequests = 0;
      let rejectedCredentialRequests = 0;

      // ── One agent for this test: no keep-alive, no proxy, watched sockets (SEC35-32 (3), SEC35-33 (1), (2)) ──
      const agent = target.secure
        ? new HttpsAgent({ keepAlive: false, maxSockets: 1, rejectUnauthorized: false, minVersion: 'TLSv1.2' })
        : new HttpAgent({ keepAlive: false, maxSockets: 1 });
      const connect = Reflect.get(agent, 'createConnection') as CreateConnection;
      Object.assign(agent, {
        createConnection(connectionOptions: object, callback?: (error: Error | null, stream: never) => void): unknown {
          const socket = connect.call(agent, connectionOptions, callback) as WatchedSocket | null | undefined;
          if (socket === null || socket === undefined) return socket;
          if (settled) {
            socket.destroy();
            return socket;
          }
          sockets.add(socket);
          const cancel = timers.after(limits.connectMs, () => {
            cancels.delete(cancel);
            if (socket.connecting === true) socket.destroy();
          });
          cancels.add(cancel);
          const established = (): void => {
            cancels.delete(cancel);
            cancel();
          };
          socket.once(target.secure ? 'secureConnect' : 'connect', established);
          socket.once('close', () => {
            established();
            sockets.delete(socket);
          });
          socket.on('data', (chunk) => {
            received += chunk.length;
            if (received > limits.maxReceivedBytes) cut('BYTE_CAP');
          });
          return socket;
        },
      });

      // ── The client of the package. It never leaves this function. ──
      const client = new cam.Cam({
        hostname: target.host,
        port: target.port,
        path: target.path,
        useSecure: target.secure,
        secureOpts: target.secure ? { rejectUnauthorized: false, minVersion: 'TLSv1.2' } : {},
        timeout: limits.requestMs,
        agent,
        autoconnect: false,
        preserveAddress: true,
        useWSSecurity: false,
      });

      /**
       * The package answers an HTTP Digest challenge by itself. This wrapper is where the test
       * decides whether it may: never while the client holds no credential, never for a hash
       * outside the list, never after the token form was chosen. Each call that passes is one
       * request that carries the credential.
       */
      const packageDigest = Reflect.get(cam.Cam.prototype, 'digestAuth') as (this: unknown, challenges: readonly unknown[], request: unknown) => string;
      Object.assign(client, {
        digestAuth(challenges: unknown, request: unknown): string {
          if (!armed || !digestAllowed) throw new Stop('CHALLENGED_UNARMED');
          const allowed = (Array.isArray(challenges) ? challenges : []).filter(digestChallengeAllowed);
          if (allowed.length === 0) throw new Stop('SCHEME_NOT_ALLOWED');
          credentialRequests += 1;
          return packageDigest.call(client, allowed, request);
        },
      });

      const arm = (form: 'HTTP_DIGEST' | 'TOKEN'): void => {
        if (credential === null) return;
        usingCredential(credential, ({ username, secret }) => {
          Object.assign(client, { username, password: secret, useWSSecurity: form === 'TOKEN' });
        });
        armed = true;
        digestAllowed = form === 'HTTP_DIGEST';
      };
      const disarm = (): void => {
        armed = false;
        Object.assign(client, { username: undefined, password: undefined, useWSSecurity: false });
      };

      const onAbort = (): void => cut('DEADLINE');

      function finish(result: Result): void {
        if (settled) return;
        settled = true;
        disarm();
        signal.removeEventListener('abort', onAbort);
        for (const cancel of cancels) cancel();
        cancels.clear();
        for (const socket of sockets) socket.destroy();
        sockets.clear();
        agent.destroy();
        resolveExchange(result);
      }
      /** Ends the exchange with the course's own answer for a cut. Nothing is asked of the course once it has ended. */
      function cut(cause: Cut): void {
        if (!settled) finish(course.cut(session, cause));
      }
      signal.addEventListener('abort', onAbort, { once: true });

      /** One read of the package: its callback is taken once, and nothing it throws escapes (SEC35-33 (3)). */
      const ask = (read: OnvifSessionRead, invoke: Invoke): Promise<Answer> =>
        new Promise<Answer>((resolveRead) => {
          let called = false;
          const once = (error: unknown, value?: unknown): void => {
            if (called) return;
            called = true;
            resolveRead(error === null || error === undefined || error === false ? { ok: true, value } : { ok: false, failure: failureOf(error) });
          };
          if (settled) {
            once(new Stop('TRANSPORT'));
            return;
          }
          reads.push(read);
          try {
            invoke(once);
          } catch (error) {
            once(error);
          }
        });

      /**
       * A read that may need the credential (see the file comment). At most one request of it
       * carries the credential, and a refusal of that request is final.
       */
      const authorizedAsk = async (read: OnvifSessionRead, invoke: Invoke): Promise<Answer> => {
        if (credential === null) return ask(read, invoke);
        if (!armed) arm('HTTP_DIGEST');
        const before = credentialRequests;
        if (!digestAllowed) credentialRequests += 1; // the token form: this request carries it
        const first = await ask(read, invoke);
        if (first.ok) return first;
        const carried = credentialRequests > before;
        if (first.failure === 'NOT_AUTHORIZED_FAULT' && !carried && digestAllowed) {
          // No challenge, a fault that asks for authentication: the device wants the token form.
          arm('TOKEN');
          credentialRequests += 1;
          const second = await ask(read, invoke);
          if (!second.ok && isAuthFailure(second.failure)) {
            rejectedCredentialRequests += 1;
            return { ok: false, failure: 'CREDENTIAL_REFUSED' };
          }
          return second;
        }
        if (carried && isAuthFailure(first.failure)) {
          rejectedCredentialRequests += 1;
          return { ok: false, failure: 'CREDENTIAL_REFUSED' };
        }
        return first;
      };

      const session: Exchange = Object.freeze({
        client,
        target,
        authenticated,
        reads,
        credentialRequests: () => credentialRequests,
        rejectedCredentialRequests: () => rejectedCredentialRequests,
        ask,
        authorizedAsk,
      });

      // Whatever goes wrong in this file's own steps is an answer too: an exchange never rejects once it started.
      course.steps(session).then(finish, () => cut('FAULT'));
    });
}

export function createOnvifConnectionTester(options: OnvifConnectionTesterOptions): OnvifConnectionTester {
  const limits: OnvifSessionLimits = { ...ONVIF_SESSION_LIMITS, ...options.limits };
  const { timers } = options;

  const ended = (session: Exchange, outcome: ConnectionTestOutcome, reason: OnvifTestReason | null, usable: readonly ReadProfile[] = [], main: readonly OnvifStreamProfile[] = []): OnvifSessionResult =>
    Object.freeze({
      outcome,
      authenticated: session.authenticated,
      usableProfiles: Object.freeze(outcome === ConnectionTestOutcome.REACHABLE ? usable.map((profile) => profile.token) : []),
      // Task 4 row 50: named for the announcement verdict too. The announced encoding is ADVICE, and the stream test judges those streams.
      profiles: Object.freeze(outcome === ConnectionTestOutcome.REACHABLE || reason === OnvifTestReason.NO_H264_PROFILE ? [...main] : []),
      reason,
      warnings: Object.freeze(outcome === ConnectionTestOutcome.REACHABLE && usable.some((profile) => profile.gopMs !== null && profile.gopMs > limits.gopBoundMs) ? [OnvifTestWarning.GOP_ABOVE_BOUND] : []),
      reads: Object.freeze([...session.reads]),
      credentialRequests: session.credentialRequests(),
      rejectedCredentialRequests: session.rejectedCredentialRequests(),
    });

  const test = (candidate: CameraCandidate, credential: SealedCredential | null, signal: AbortSignal): Promise<OnvifSessionResult> =>
    exchange<OnvifSessionResult>(limits, timers, candidate, credential, signal, {
      cut: (session, cause) => ended(session, ConnectionTestOutcome.UNREACHABLE, cutReason(cause)),
      steps: async (session) => {
        const { client, authorizedAsk } = session;
        // 1, 2. The clock and the service addresses.
        const stopped = await mediaServiceOf(session);
        if (stopped !== null) return ended(session, stopped.outcome, stopped.reason);

        // 3. The media profiles: the read the credential is for.
        const listed = await authorizedAsk('GetProfiles', (callback) => client.getProfiles(callback));
        if (!listed.ok) {
          if (listed.failure === 'TRANSPORT') return ended(session, NO_ANSWER.outcome, NO_ANSWER.reason);
          if (isAuthFailure(listed.failure)) {
            const refused = refusalOf(listed.failure, session.authenticated);
            return ended(session, refused.outcome, refused.reason);
          }
          return ended(session, ConnectionTestOutcome.WRONG_PROFILE, OnvifTestReason.PROFILE_ANSWER_INVALID);
        }
        const usable = usableProfilesOf(listed.value, limits.maxProfiles);
        if (usable.length === 0) return ended(session, ConnectionTestOutcome.WRONG_PROFILE, OnvifTestReason.NO_USABLE_PROFILE);
        const h264 = usable.filter((profile) => profile.h264);

        // 4. ONE stream address, compared with the candidate's own address and then dropped (D82).
        const checked = h264[0] ?? usable[0];
        if (checked === undefined) return ended(session, ConnectionTestOutcome.WRONG_PROFILE, OnvifTestReason.NO_USABLE_PROFILE);
        const stream = await streamAnswerOf(session, checked.token);
        if (stream.halt !== null) return ended(session, stream.halt.outcome, stream.halt.reason);
        const fault = streamAddressFault(stream.value, session.target.host);
        if (fault !== null) return ended(session, ConnectionTestOutcome.WRONG_PROFILE, fault);

        // THE ANNOUNCEMENT VERDICT (task 3), now ADVICE ONLY (task 4 row 50; amendment AM-2; AD-06 (1)): the bench
        // cameras announce H264 and deliver HEVC, so the codec of a camera is judged from its STREAM, by
        // `stream-probe.ts`, which takes the streams named here for either answer. This verdict stands
        // only for a test that has no stream half (no credential, or no relay program: a development Core).
        if (h264.length === 0) return ended(session, ConnectionTestOutcome.NOT_H264, OnvifTestReason.NO_H264_PROFILE, [], mainProfilesOf(usable));
        // Task 4 row 26: the stream of each video source, from every usable profile, the larger picture first.
        return ended(session, ConnectionTestOutcome.REACHABLE, null, h264, mainProfilesOf(usable));
      },
    });

  return Object.freeze({ test });
}

/**
 * The locator read of a profile (task 4 row 26; design addendum 2.3 step 3, 4.1 a; H-05, H-11).
 * The same exchange as the test - the same agent, bounds, address rule and credential rule - with
 * another course: the clock, the service addresses, ONE `GetStreamUri`. No profile is listed and
 * none is chosen here: the caller names the token it was configured with.
 */
export function createOnvifStreamLocator(options: OnvifConnectionTesterOptions): OnvifStreamLocator {
  const limits: OnvifSessionLimits = { ...ONVIF_SESSION_LIMITS, ...options.limits };
  const { timers } = options;

  const answered = (session: Exchange, outcome: ConnectionTestOutcome, reason: OnvifTestReason | null, locator: string | null = null): OnvifLocatorResult =>
    Object.freeze({
      outcome,
      reason,
      locator: outcome === ConnectionTestOutcome.REACHABLE ? locator : null,
      reads: Object.freeze([...session.reads]),
      credentialRequests: session.credentialRequests(),
      rejectedCredentialRequests: session.rejectedCredentialRequests(),
    });

  const locate = (candidate: CameraCandidate, credential: SealedCredential | null, profileToken: string, signal: AbortSignal): Promise<OnvifLocatorResult> => {
    // The token goes into a request body as it is: nothing but the token form is ever sent.
    if (typeof profileToken !== 'string' || !PROFILE_TOKEN.test(profileToken)) return Promise.reject(new CaptureAdapterError(CaptureAdapterRefusal.PROFILE_UNKNOWN));
    return exchange<OnvifLocatorResult>(limits, timers, candidate, credential, signal, {
      cut: (session, cause) => answered(session, ConnectionTestOutcome.UNREACHABLE, cutReason(cause)),
      steps: async (session) => {
        const stopped = await mediaServiceOf(session);
        if (stopped !== null) return answered(session, stopped.outcome, stopped.reason);
        const stream = await streamAnswerOf(session, profileToken);
        if (stream.halt !== null) return answered(session, stream.halt.outcome, stream.halt.reason);
        const read = locatorOf(stream.value, session.target.host);
        if ('reason' in read) return answered(session, ConnectionTestOutcome.WRONG_PROFILE, read.reason);
        return answered(session, ConnectionTestOutcome.REACHABLE, null, read.locator);
      },
    });
  };

  return Object.freeze({ locate });
}

/**
 * THE THIRD FACADE (task 4 integration pass I-7, on the request of row 49): one call, ONE read,
 * no credential. It is the production value of the seam `CameraTimeReader` of `camera-watch.ts`
 * (presence and clock offset of a camera); the answer has that seam's shape, restated here
 * because this file imports nothing of the watch.
 */
export interface OnvifTimeReader {
  /**
   * Asks the device its clock (`GetSystemDateAndTime`), once. Rejects before any request, as
   * `test` does: `CAPTURE_ADAPTER_ABORTED` for a signal already aborted, `CAPTURE_LOCATOR_INVALID`
   * for a candidate that may not be contacted. Otherwise it RESOLVES, whatever the device does.
   *
   * `answered`: the device answered the ONVIF read itself - with its clock, or by keeping the
   * clock behind authentication. No answer, a cut (deadline, byte cap) and an answer that is no
   * ONVIF answer are `false`.
   * `cameraUtcMs`: the instant the answer names as UTC, in milliseconds, or null. The ONVIF
   * answer carries whole seconds, so the value is exact to one second and no finer.
   */
  read(candidate: CameraCandidate, signal: AbortSignal): Promise<{ readonly answered: boolean; readonly cameraUtcMs: number | null }>;
}

/** The element of the answer that states the instant as UTC, with whatever namespace prefix the device writes. */
const UTC_INSTANT_ELEMENT = /<(?:[A-Za-z_][A-Za-z0-9_.-]{0,31}:)?UTCDateTime[\s/>]/;
const TIME_NOT_ANSWERED = Object.freeze({ answered: false, cameraUtcMs: null });

/**
 * The time read of a camera (row 49: presence and clock offset; design addendum WP-06c). The same
 * exchange as the test - the same agent, bounds and address rule (`targetOf`: the candidate's own
 * address only) - with the shortest course: the clock read and nothing after it. The credential
 * of the exchange is `null` by a literal: no parameter, no option and no dependency of this
 * function can carry one, so a time read reveals nothing and counts 0 credential requests by
 * construction. A device that refuses the read is asked no second time (the package's own repeat
 * of a refused clock read goes out on a client that holds no credential, as in the test).
 *
 * WHAT THE DEVICE SAYS IS UNTRUSTED. The package answers the Core's OWN clock for an answer that
 * names no instant, and reads a local time as if it were UTC when no UTC element stands in the
 * answer: either would state a false offset. So an instant is handed out only when the raw answer
 * holds a `UTCDateTime` element AND the package read a valid date from it; the raw answer is
 * tested for that one element name and dropped - no part of it is returned, logged or kept.
 */
export function createOnvifTimeReader(options: OnvifConnectionTesterOptions): OnvifTimeReader {
  const limits: OnvifSessionLimits = { ...ONVIF_SESSION_LIMITS, ...options.limits };
  const { timers } = options;

  const read = (candidate: CameraCandidate, signal: AbortSignal): Promise<{ readonly answered: boolean; readonly cameraUtcMs: number | null }> =>
    exchange<{ readonly answered: boolean; readonly cameraUtcMs: number | null }>(limits, timers, candidate, null, signal, {
      cut: () => TIME_NOT_ANSWERED,
      steps: async ({ client, ask }) => {
        const clock = await ask('GetSystemDateAndTime', (callback) =>
          client.getSystemDateAndTime((error: unknown, instant?: unknown, raw?: unknown) => {
            const text = typeof raw === 'string' ? raw : '';
            const failed = error !== null && error !== undefined && error !== false;
            // The package asks a refused clock read once more by itself and then reports an error of its own, in which the
            // device's refusal is lost: the refusal is read from the answer, by the fixed words `failureOf` reads a fault by.
            if (failed && NOT_AUTHORIZED.test(text)) callback(new Stop('NOT_AUTHORIZED_FAULT'));
            else callback(error, { instant, statesUtc: UTC_INSTANT_ELEMENT.test(text) });
          }),
        );
        if (!clock.ok) return isAuthFailure(clock.failure) ? Object.freeze({ answered: true, cameraUtcMs: null }) : TIME_NOT_ANSWERED;
        const instant = member(clock.value, 'instant');
        const utcMs = member(clock.value, 'statesUtc') === true && instant instanceof Date ? instant.getTime() : Number.NaN;
        return Object.freeze({ answered: true, cameraUtcMs: Number.isSafeInteger(utcMs) ? utcMs : null });
      },
    });

  return Object.freeze({ read });
}
