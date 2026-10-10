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
 */
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import cam from 'onvif/lib/cam.js';
import type { CaptureTimers } from '../../types';
import { usingCredential, type SealedCredential } from '../credential';
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
  NO_H264_PROFILE: 'NO_H264_PROFILE',
} as const;
export type OnvifTestReason = (typeof OnvifTestReason)[keyof typeof OnvifTestReason];

export const OnvifTestWarning = { GOP_ABOVE_BOUND: 'GOP_ABOVE_BOUND' } as const;
export type OnvifTestWarning = (typeof OnvifTestWarning)[keyof typeof OnvifTestWarning];

/** The five reads of rule CT-1, by the name of the device operation. */
export const ONVIF_SESSION_READS = ['GetSystemDateAndTime', 'GetServices', 'GetCapabilities', 'GetProfiles', 'GetStreamUri'] as const;
export type OnvifSessionRead = (typeof ONVIF_SESSION_READS)[number];

/** What one test answers. Codes and counts only: no device text, no locator, no credential member. */
export interface OnvifSessionResult extends ConnectionTestResult {
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

const PROFILE_TOKEN = /^[A-Za-z0-9_.:-]{1,64}$/;
const STREAM_SCHEME = 'rtsp:';
const STREAM_ADDRESS_MAX_CHARS = 512;
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
}

/**
 * The usable profiles of a `GetProfiles` answer, read by fixed paths (no recursive walk): a
 * profile with a token of the code form, a video source configuration and a video encoder
 * configuration. Everything else of the answer is dropped here.
 */
function usableProfilesOf(answer: unknown, limit: number): ReadProfile[] {
  const list: readonly unknown[] = Array.isArray(answer) ? answer : [];
  const usable: ReadProfile[] = [];
  for (const profile of list.slice(0, limit)) {
    const token = member(member(profile, '$'), 'token');
    const encoder = member(profile, 'videoEncoderConfiguration');
    if (typeof token !== 'string' || !PROFILE_TOKEN.test(token) || !isRecord(member(profile, 'videoSourceConfiguration')) || !isRecord(encoder)) continue;
    const frames = member(member(encoder, 'H264'), 'govLength') ?? member(encoder, 'govLength');
    const rate = member(member(encoder, 'rateControl'), 'frameRateLimit');
    const gopMs = typeof frames === 'number' && typeof rate === 'number' && frames > 0 && rate > 0 ? (frames / rate) * 1_000 : null;
    usable.push({ token, h264: member(encoder, 'encoding') === 'H264', gopMs });
  }
  return usable;
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

/** What the agent's sockets are to this file: a stream that can be watched and destroyed. No socket module is imported. */
interface WatchedSocket {
  readonly connecting?: boolean;
  on(event: 'data', listener: (chunk: { readonly length: number }) => void): unknown;
  once(event: 'close' | 'connect' | 'secureConnect', listener: () => void): unknown;
  destroy(): unknown;
}

type CreateConnection = (options: object, callback?: (error: Error | null, stream: never) => void) => unknown;

export function createOnvifConnectionTester(options: OnvifConnectionTesterOptions): OnvifConnectionTester {
  const limits: OnvifSessionLimits = { ...ONVIF_SESSION_LIMITS, ...options.limits };
  const { timers } = options;

  const test = (candidate: CameraCandidate, credential: SealedCredential | null, signal: AbortSignal): Promise<OnvifSessionResult> => {
    if (signal.aborted) return Promise.reject(new CaptureAdapterError(CaptureAdapterRefusal.ABORTED));
    let target: ConnectionTarget;
    try {
      target = targetOf(candidate);
    } catch (error) {
      return Promise.reject(error);
    }
    const authenticated = credential !== null;

    return new Promise<OnvifSessionResult>((resolveTest) => {
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
            if (received > limits.maxReceivedBytes) finish(ended(ConnectionTestOutcome.UNREACHABLE, OnvifTestReason.BYTE_CAP));
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

      const ended = (outcome: ConnectionTestOutcome, reason: OnvifTestReason | null, usable: readonly ReadProfile[] = []): OnvifSessionResult =>
        Object.freeze({
          outcome,
          authenticated,
          usableProfiles: Object.freeze(outcome === ConnectionTestOutcome.REACHABLE ? usable.map((profile) => profile.token) : []),
          reason,
          warnings: Object.freeze(outcome === ConnectionTestOutcome.REACHABLE && usable.some((profile) => profile.gopMs !== null && profile.gopMs > limits.gopBoundMs) ? [OnvifTestWarning.GOP_ABOVE_BOUND] : []),
          reads: Object.freeze([...reads]),
          credentialRequests,
          rejectedCredentialRequests,
        });

      const onAbort = (): void => finish(ended(ConnectionTestOutcome.UNREACHABLE, OnvifTestReason.DEADLINE));

      function finish(result: OnvifSessionResult): void {
        if (settled) return;
        settled = true;
        disarm();
        signal.removeEventListener('abort', onAbort);
        for (const cancel of cancels) cancel();
        cancels.clear();
        for (const socket of sockets) socket.destroy();
        sockets.clear();
        agent.destroy();
        resolveTest(result);
      }
      signal.addEventListener('abort', onAbort, { once: true });

      /** One read of the package: its callback is taken once, and nothing it throws escapes (SEC35-33 (3)). */
      const ask = (read: OnvifSessionRead, invoke: (callback: (error: unknown, value?: unknown) => void) => void): Promise<Answer> =>
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
      const authorizedAsk = async (read: OnvifSessionRead, invoke: (callback: (error: unknown, value?: unknown) => void) => void): Promise<Answer> => {
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

      const refusedAs = (failure: Failure): OnvifSessionResult =>
        ended(
          ConnectionTestOutcome.AUTHENTICATION_FAILED,
          failure === 'CREDENTIAL_REFUSED'
            ? OnvifTestReason.CREDENTIAL_REFUSED
            : failure === 'NO_DIGEST_CHALLENGE' || failure === 'SCHEME_NOT_ALLOWED'
              ? OnvifTestReason.SCHEME_NOT_ALLOWED
              : authenticated
                ? OnvifTestReason.CREDENTIAL_REFUSED
                : OnvifTestReason.CREDENTIAL_ABSENT,
        );
      const noAnswer = (): OnvifSessionResult => ended(ConnectionTestOutcome.UNREACHABLE, OnvifTestReason.NO_ANSWER);

      const steps = async (): Promise<OnvifSessionResult> => {
        // 1. The device's clock, without a credential (PRE_AUTH). A device that refuses it is asked no second time with one.
        const clock = await ask('GetSystemDateAndTime', (callback) => client.getSystemDateAndTime(callback));
        if (!clock.ok && clock.failure === 'TRANSPORT') return noAnswer();
        if (!clock.ok && !isAuthFailure(clock.failure)) return ended(ConnectionTestOutcome.UNREACHABLE, OnvifTestReason.NOT_ONVIF);

        // 2. The service addresses, without a credential; `GetCapabilities` only when `GetServices` is not answered.
        let services = await ask('GetServices', (callback) => client.getServices(false, callback));
        if (!services.ok && services.failure !== 'TRANSPORT') services = await ask('GetCapabilities', (callback) => client.getCapabilities(callback));
        // A device that keeps both behind authentication: the credential's one request is spent here.
        if (!services.ok && isAuthFailure(services.failure) && credential !== null) services = await authorizedAsk('GetServices', (callback) => client.getServices(false, callback));
        if (!services.ok) {
          if (services.failure === 'TRANSPORT') return noAnswer();
          if (isAuthFailure(services.failure)) return refusedAs(services.failure);
          return ended(ConnectionTestOutcome.UNREACHABLE, OnvifTestReason.NOT_ONVIF);
        }
        const addresses = Reflect.get(client, 'uri') as unknown;
        if (!isRecord(member(addresses, 'media')) && !isRecord(member(addresses, 'media2'))) return ended(ConnectionTestOutcome.WRONG_PROFILE, OnvifTestReason.NO_MEDIA_SERVICE);

        // 3. The media profiles: the read the credential is for.
        const listed = await authorizedAsk('GetProfiles', (callback) => client.getProfiles(callback));
        if (!listed.ok) {
          if (listed.failure === 'TRANSPORT') return noAnswer();
          if (isAuthFailure(listed.failure)) return refusedAs(listed.failure);
          return ended(ConnectionTestOutcome.WRONG_PROFILE, OnvifTestReason.PROFILE_ANSWER_INVALID);
        }
        const usable = usableProfilesOf(listed.value, limits.maxProfiles);
        if (usable.length === 0) return ended(ConnectionTestOutcome.WRONG_PROFILE, OnvifTestReason.NO_USABLE_PROFILE);
        const h264 = usable.filter((profile) => profile.h264);

        // 4. ONE stream address, compared with the candidate's own address and then dropped (D82).
        const checked = h264[0] ?? usable[0];
        if (checked === undefined) return ended(ConnectionTestOutcome.WRONG_PROFILE, OnvifTestReason.NO_USABLE_PROFILE);
        const stream = await authorizedAsk('GetStreamUri', (callback) => client.getStreamUri({ protocol: 'RTSP', profileToken: checked.token }, callback));
        if (!stream.ok) {
          if (stream.failure === 'TRANSPORT') return noAnswer();
          if (isAuthFailure(stream.failure)) return refusedAs(stream.failure);
          return ended(ConnectionTestOutcome.WRONG_PROFILE, OnvifTestReason.STREAM_ADDRESS_MISSING);
        }
        const fault = streamAddressFault(stream.value, target.host);
        if (fault !== null) return ended(ConnectionTestOutcome.WRONG_PROFILE, fault);

        if (h264.length === 0) return ended(ConnectionTestOutcome.NOT_H264, OnvifTestReason.NO_H264_PROFILE);
        return ended(ConnectionTestOutcome.REACHABLE, null, h264);
      };

      // Whatever goes wrong in this file's own steps is an answer too: the test never rejects once it started.
      steps().then(finish, () => finish(ended(ConnectionTestOutcome.UNREACHABLE, OnvifTestReason.NOT_ONVIF)));
    });
  };

  return Object.freeze({ test });
}
