/**
 * THE SET-NETWORK FILE: one camera's address is written by four ONVIF calls (task 4 blueprint row
 * 110, M10 / WP-22a; specification S2-5; amended static rules G-R10 and G-R11, decision text SR-3;
 * amended rulings AM-4 and AM-7; decisions C1 and C7; security findings S13-04, S13-11, S13-12).
 *
 * THE SECOND FILE that imports the `onvif` package, and it imports the client's own file, never
 * the package's main entry. The client object never leaves this file: what it exports is a FACADE
 * with one call, `setAddress`, whose calls on the client are exactly four -
 *
 *   `getNetworkInterfaces`      which interface the device has, and its hardware address;
 *   `setNetworkInterfaces`      that interface to ONE static IPv4 address with its prefix;
 *   `setNetworkDefaultGateway`  when the assignment names a gateway;
 *   `systemReboot`              when the device says the change needs one.
 *
 * No read of the connection file is made here (no clock, no services, no profiles, no stream
 * address) and that file keeps "no configuration call". NO DHCP MODE EXISTS: the request this file
 * builds says `DHCP: false` by a literal, and the type declaration of the client admits no other.
 *
 * WHERE A REQUEST GOES (S13-11). To ONE destination: the camera's current service address, and
 * only after the destination rule handed in (`decideDestination` of `capture/destination-rule.ts`,
 * bound by the caller to the host's facts) admitted it. The client is built with the address the
 * RULE returned, never the caller's text; every connection of the exchange is forced to that
 * address and port and is made from the source address the rule named, whatever the package asks
 * for. That matters once: after a successful set the package moves its own target to the NEW
 * address - this file puts the target back at once and holds the connection to the old one.
 * The address that is WRITTEN is an assignment the rule function `decideNewCameraAddress` made
 * (`NewCameraAddress`): three values, held once more here to the dotted-quad and prefix forms
 * before they reach a request. Only `http:` is spoken: an `https:` service address is refused
 * before any request, so the certificate exception of the connection file is not widened.
 *
 * HOW THE CREDENTIAL TRAVELS (C1, C7; S13-04). It is a PARAMETER of the one call: an opaque
 * `SealedCredential` the caller made from what the technician typed. This file imports neither the
 * credential reader nor the reveal module and has no way to a stored credential. The rule of the
 * connection file holds: never in clear, never as Basic; the device's challenge decides between an
 * HTTP Digest answer and a WS-Security `UsernameToken` (`PasswordDigest`); a refusal is final, so
 * a call holds AT MOST ONE rejected request that carried the credential. When the call ends the
 * two values are taken off the client object and nothing it returns holds them.
 *
 * ALL DEVICE TEXT IS UNTRUSTED (S13-12). The parse and exception guards are those of the
 * connection file: one agent per call, no keep-alive, watched sockets, a byte cap, a connection
 * limit, the caller's signal as the deadline; every callback of the package is taken once and
 * nothing it throws escapes. Whatever the package answers or throws is reduced to a code of the
 * closed lists below: no error object, no fault text and no envelope leaves this file. The
 * interface token is written back into a request, so it is held to the token form first; a token
 * outside it is refused and NO set request is made. The hardware address leaves as six upper-case
 * pairs or not at all.
 *
 * THE FIFTH REQUEST. The package's `setNetworkDefaultGateway` reads the gateway back by itself
 * (`GetNetworkDefaultGateway`) when it is given a callback, and without a callback it says neither
 * when it is done nor whether it failed. The callback form is used: the read-back is the package's
 * own request, not a fifth call of this file, and its answer is what `gateway: CONFIRMED` means.
 *
 * NOT HERE: the job (single flight, the unauthenticated poll, the wait by MAC, the lock-out guard,
 * the audit entries) is row 111. This file is called by nothing yet.
 *
 * It logs nothing, reads no clock and names no global timer: `timers` is the capture timer seam.
 */
import { Agent as HttpAgent } from 'node:http';
import cam from 'onvif/lib/cam.js';
import { CAMERA_SUBNET_MAX_PREFIX, CAMERA_SUBNET_MIN_PREFIX, type DestinationDecision, type NewCameraAddress } from '../../destination-rule';
import type { CaptureTimers } from '../../types';
import { usingCredential, type SealedCredential } from '../credential';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import type { CameraCandidate } from '../types';
import { targetOf, type ConnectionTarget } from './connection-target';

/** The bounds of one call. The whole-call deadline is the caller's signal. */
export const ONVIF_NETWORK_LIMITS: OnvifNetworkLimits = Object.freeze({
  /** A connection that is not established within this is destroyed. */
  connectMs: 3_000,
  /** The idle limit of one request. */
  requestMs: 5_000,
  /** Received bytes of one call, all requests together. */
  maxReceivedBytes: 1_048_576,
});
export interface OnvifNetworkLimits {
  readonly connectMs: number;
  readonly requestMs: number;
  readonly maxReceivedBytes: number;
}

/** The four calls, by the name of the device operation, in the order they are made. */
export const ONVIF_NETWORK_CALLS = ['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway', 'SystemReboot'] as const;
export type OnvifNetworkCall = (typeof ONVIF_NETWORK_CALLS)[number];

/** What is known of the camera's address when the call ends. */
export const OnvifNetworkOutcome = {
  /** The device accepted the set. */
  SET: 'SET',
  /** No set was accepted: nothing was sent, or the device refused. */
  NOT_SET: 'NOT_SET',
  /** A set was sent and no valid answer came back: the camera may hold either address. */
  UNKNOWN: 'UNKNOWN',
} as const;
export type OnvifNetworkOutcome = (typeof OnvifNetworkOutcome)[keyof typeof OnvifNetworkOutcome];

/** Why a call ended as it did: a closed list of codes. Never device text. */
export const OnvifNetworkReason = {
  /** The destination rule refused the camera's current address (its own code is `destinationRefusal`). */
  DESTINATION_REFUSED: 'DESTINATION_REFUSED',
  /** The service address is not `http:`. */
  SERVICE_SCHEME_NOT_SUPPORTED: 'SERVICE_SCHEME_NOT_SUPPORTED',
  /** The assignment is not an address, prefix and gateway of the rule's form. */
  ASSIGNMENT_INVALID: 'ASSIGNMENT_INVALID',
  NO_ANSWER: 'NO_ANSWER',
  DEADLINE: 'DEADLINE',
  BYTE_CAP: 'BYTE_CAP',
  CREDENTIAL_REFUSED: 'CREDENTIAL_REFUSED',
  SCHEME_NOT_ALLOWED: 'SCHEME_NOT_ALLOWED',
  /** The interface list is not an answer this file can read. */
  INTERFACES_ANSWER_INVALID: 'INTERFACES_ANSWER_INVALID',
  /** The device names no interface. */
  NO_INTERFACE: 'NO_INTERFACE',
  /** The interface token is not of the token form: it is never written into a request. */
  INTERFACE_TOKEN_REFUSED: 'INTERFACE_TOKEN_REFUSED',
  /** The device answered the set with a fault. */
  SET_REFUSED: 'SET_REFUSED',
  /** The answer to the set is not one this file can read. */
  SET_ANSWER_INVALID: 'SET_ANSWER_INVALID',
  /** A step of this file failed. */
  FAULT: 'FAULT',
} as const;
export type OnvifNetworkReason = (typeof OnvifNetworkReason)[keyof typeof OnvifNetworkReason];

export const OnvifGatewayState = {
  /** The assignment names no gateway, or the call ended before the gateway step. */
  NOT_ASKED: 'NOT_ASKED',
  /** The device took the gateway and reads it back as written. */
  CONFIRMED: 'CONFIRMED',
  /** The set or its read-back failed, or the device reads back another value. A warning: the address stands. */
  NOT_CONFIRMED: 'NOT_CONFIRMED',
} as const;
export type OnvifGatewayState = (typeof OnvifGatewayState)[keyof typeof OnvifGatewayState];

export const OnvifRebootState = {
  /** The device asked for none, or the call ended before the reboot step. */
  NOT_ASKED: 'NOT_ASKED',
  /** The device answered the reboot. */
  ACCEPTED: 'ACCEPTED',
  /** The reboot was sent and the connection ended without an answer: a camera that goes down at once. */
  SENT_NO_ANSWER: 'SENT_NO_ANSWER',
  /** The device refused the reboot: the new address may not be in force until it restarts. */
  REFUSED: 'REFUSED',
} as const;
export type OnvifRebootState = (typeof OnvifRebootState)[keyof typeof OnvifRebootState];

/** What one call answers. Codes, counts and one bounded hardware address: no free device text, no credential member. */
export interface OnvifNetworkSetResult {
  readonly outcome: OnvifNetworkOutcome;
  /** Null for `SET`. */
  readonly reason: OnvifNetworkReason | null;
  /** The code of the destination rule, only with `DESTINATION_REFUSED`. */
  readonly destinationRefusal: string | null;
  /** The hardware address the device reported BEFORE the set, as six upper-case pairs; null when it named none of that form. */
  readonly hwAddress: string | null;
  /** What the device said of a reboot; null unless `SET`. */
  readonly rebootNeeded: boolean | null;
  readonly gateway: OnvifGatewayState;
  readonly reboot: OnvifRebootState;
  /** The calls made, in order. */
  readonly calls: readonly OnvifNetworkCall[];
  /** Requests that carried the credential (a digest answer or a token). */
  readonly credentialRequests: number;
  /** Of those, how many the device refused: 0 or 1. What a camera's own lock-out counts. */
  readonly rejectedCredentialRequests: number;
}

export interface OnvifNetworkSetterOptions {
  /** The capture timer seam: the connection limit is one call of it. */
  readonly timers: CaptureTimers;
  /**
   * THE DESTINATION RULE for the camera's current address: `decideDestination` bound by the caller
   * to the purpose of the set-IP job and to the host's facts. No request is built before it
   * admitted the address, and the address dialled is the one IT returns.
   */
  readonly destination: (address: string, port: number) => DestinationDecision;
  /** A test passes smaller bounds. */
  readonly limits?: Partial<OnvifNetworkLimits>;
}

/** THE FACADE: one call, four calls on the client at most, nothing else reachable. */
export interface OnvifNetworkSetter {
  /**
   * Writes ONE static address into ONE camera. Rejects before any request with
   * `CAPTURE_ADAPTER_ABORTED` for a signal that is already aborted and with
   * `CAPTURE_LOCATOR_INVALID` for a candidate that may not be contacted. Otherwise it RESOLVES,
   * whatever the device does. The credential is used for this call and kept by nothing.
   */
  setAddress(candidate: CameraCandidate, assignment: NewCameraAddress, credential: SealedCredential, signal: AbortSignal): Promise<OnvifNetworkSetResult>;
}

/** The form of an interface token that may be written into a request (the token rule of the connection file). */
const INTERFACE_TOKEN = /^[A-Za-z0-9_.:-]{1,64}$/;
const DOTTED_QUAD = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HW_ADDRESS = /^[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}$/;
const REASON_WORD = /^[A-Z][A-Z0-9_]{0,63}$/;
/** The hash names of a Digest challenge this file answers. Anything else is not answered. */
const DIGEST_ALGORITHMS: readonly string[] = ['MD5', 'SHA-256'];
const NOT_AUTHORIZED = /not\s*authori[sz]ed|unauthori[sz]ed|failedauthentication|authentication\s+(?:failed|required)/i;

/** How a call of the package failed, as far as this file needs to know. */
type Failure = 'TRANSPORT' | 'CREDENTIAL_REFUSED' | 'NO_DIGEST_CHALLENGE' | 'SCHEME_NOT_ALLOWED' | 'CHALLENGED_UNARMED' | 'NOT_AUTHORIZED_FAULT' | 'OTHER_FAULT' | 'INVALID_ANSWER';
type Answer = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly failure: Failure };
type Cut = 'DEADLINE' | 'BYTE_CAP' | 'FAULT';
type Invoke = (callback: (error: unknown, value?: unknown) => void) => void;

/** What the digest wrapper throws inside the package, which hands it back through the call's callback. */
class Stop extends Error {
  readonly failure: Failure;
  constructor(failure: Failure) {
    super('the set-network call does not answer this challenge');
    this.name = 'OnvifNetworkStop';
    this.failure = failure;
  }
}

/** Reduces whatever a call of the package failed with to a `Failure`. The package's texts are compared with its fixed sentences and never passed on. */
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

function digestChallengeAllowed(challenge: unknown): boolean {
  if (typeof challenge !== 'string' || challenge.length > 2_048) return false;
  const named = /\balgorithm\s*=\s*"?([A-Za-z0-9-]+)"?/i.exec(challenge);
  return named === null || DIGEST_ALGORITHMS.includes((named[1] ?? '').toUpperCase());
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);
const member = (value: unknown, key: string): unknown => (isRecord(value) && Object.hasOwn(value, key) ? value[key] : undefined);

/** What the agent's sockets are to this file: a stream that can be watched and destroyed. No socket module is imported. */
interface WatchedSocket {
  readonly connecting?: boolean;
  on(event: 'data', listener: (chunk: { readonly length: number }) => void): unknown;
  once(event: 'close' | 'connect', listener: () => void): unknown;
  destroy(): unknown;
}
type CreateConnection = (options: object, callback?: (error: Error | null, stream: never) => void) => unknown;

/** The first interface of a `GetNetworkInterfaces` answer, read by fixed paths: its token as it stands, its hardware address in one form. */
function firstInterfaceOf(answer: unknown): { readonly token: unknown; readonly hwAddress: string | null } | null {
  if (!Array.isArray(answer) || answer.length === 0) return null;
  const first: unknown = answer[0];
  if (!isRecord(first)) return null;
  const reported = member(member(first, 'info'), 'hwAddress');
  const hwAddress = typeof reported === 'string' && HW_ADDRESS.test(reported.trim()) ? reported.trim().toUpperCase().replaceAll('-', ':') : null;
  return { token: member(member(first, '$'), 'token'), hwAddress };
}

/** True when a gateway read-back names the gateway that was written. */
function gatewayReadBack(answer: unknown, gateway: string): boolean {
  const named = member(answer, 'IPv4Address');
  return named === gateway || (Array.isArray(named) && named.length <= 8 && named.includes(gateway));
}

const assignmentValid = (assignment: NewCameraAddress): boolean =>
  isRecord(assignment) &&
  typeof assignment.address === 'string' &&
  DOTTED_QUAD.test(assignment.address) &&
  Number.isInteger(assignment.prefixLength) &&
  assignment.prefixLength >= CAMERA_SUBNET_MIN_PREFIX &&
  assignment.prefixLength <= CAMERA_SUBNET_MAX_PREFIX &&
  (assignment.gateway === null || (typeof assignment.gateway === 'string' && DOTTED_QUAD.test(assignment.gateway)));

export function createOnvifNetworkSetter(options: OnvifNetworkSetterOptions): OnvifNetworkSetter {
  const limits: OnvifNetworkLimits = { ...ONVIF_NETWORK_LIMITS, ...options.limits };
  const { timers } = options;

  const setAddress = (candidate: CameraCandidate, assignment: NewCameraAddress, credential: SealedCredential, signal: AbortSignal): Promise<OnvifNetworkSetResult> => {
    if (signal.aborted) return Promise.reject(new CaptureAdapterError(CaptureAdapterRefusal.ABORTED));
    let target: ConnectionTarget;
    try {
      target = targetOf(candidate);
    } catch (error) {
      return Promise.reject(error);
    }

    const calls: OnvifNetworkCall[] = [];
    let credentialRequests = 0;
    let rejectedCredentialRequests = 0;
    /** What the steps have established so far: a cut answers from it. */
    const known = {
      outcome: OnvifNetworkOutcome.NOT_SET as OnvifNetworkOutcome,
      hwAddress: null as string | null,
      rebootNeeded: null as boolean | null,
      gateway: OnvifGatewayState.NOT_ASKED as OnvifGatewayState,
      reboot: OnvifRebootState.NOT_ASKED as OnvifRebootState,
    };
    const ended = (reason: OnvifNetworkReason | null, destinationRefusal: string | null = null): OnvifNetworkSetResult =>
      Object.freeze({
        outcome: known.outcome,
        reason: known.outcome === OnvifNetworkOutcome.SET ? null : reason,
        destinationRefusal,
        hwAddress: known.hwAddress,
        rebootNeeded: known.outcome === OnvifNetworkOutcome.SET ? known.rebootNeeded : null,
        gateway: known.gateway,
        reboot: known.reboot,
        calls: Object.freeze([...calls]),
        credentialRequests,
        rejectedCredentialRequests,
      });

    // ── Before any request: the scheme, the assignment, the destination rule. ──
    if (target.secure) return Promise.resolve(ended(OnvifNetworkReason.SERVICE_SCHEME_NOT_SUPPORTED));
    if (!assignmentValid(assignment)) return Promise.resolve(ended(OnvifNetworkReason.ASSIGNMENT_INVALID));
    let decision: DestinationDecision;
    try {
      decision = options.destination(target.host, target.port);
    } catch {
      return Promise.resolve(ended(OnvifNetworkReason.DESTINATION_REFUSED));
    }
    if (decision.allowed !== true) {
      const word: unknown = decision.refusal;
      return Promise.resolve(ended(OnvifNetworkReason.DESTINATION_REFUSED, typeof word === 'string' && REASON_WORD.test(word) ? word : null));
    }
    /** THE destination of every request of this call: the value the rule returned. */
    const destination = decision.destination;
    if (!DOTTED_QUAD.test(destination.address) || !DOTTED_QUAD.test(destination.sourceAddress) || !Number.isInteger(destination.port) || destination.port < 1 || destination.port > 65_535) {
      return Promise.resolve(ended(OnvifNetworkReason.DESTINATION_REFUSED));
    }

    return new Promise<OnvifNetworkSetResult>((resolveCall) => {
      const sockets = new Set<WatchedSocket>();
      const cancels = new Set<() => void>();
      let settled = false;
      let received = 0;
      let armed = false;
      let digestAllowed = true;

      // ── One agent for this call: no keep-alive, no proxy, watched sockets, ONE place it can connect to. ──
      const agent = new HttpAgent({ keepAlive: false, maxSockets: 1 });
      const connect = Reflect.get(agent, 'createConnection') as CreateConnection;
      Object.assign(agent, {
        createConnection(connectionOptions: object, callback?: (error: Error | null, stream: never) => void): unknown {
          // Whatever the package asks for, the connection goes to the destination the rule returned, from the source it named.
          const strayed = member(connectionOptions, 'host') !== destination.address || Number(member(connectionOptions, 'port')) !== destination.port;
          const socket = connect.call(agent, { ...connectionOptions, host: destination.address, port: destination.port, localAddress: destination.sourceAddress, family: 4 }, callback) as WatchedSocket | null | undefined;
          if (socket === null || socket === undefined) return socket;
          if (settled || strayed) {
            socket.destroy();
            if (strayed) cut('FAULT');
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
          socket.once('connect', established);
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
        hostname: destination.address,
        port: destination.port,
        path: target.path,
        useSecure: false,
        secureOpts: {},
        timeout: limits.requestMs,
        agent,
        autoconnect: false,
        preserveAddress: true,
        useWSSecurity: false,
      });
      /** The package's own target and service paths, as this call fixed them. Put back after every answer: a set moves the target. */
      const holdTarget = (): void => {
        Object.assign(client, { hostname: destination.address, port: destination.port, uri: { device: { path: target.path }, deviceIO: { path: target.path } } });
      };
      holdTarget();

      /** Where this file decides whether the package may answer an HTTP Digest challenge. Each call that passes is one request that carries the credential. */
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

      function finish(result: OnvifNetworkSetResult): void {
        if (settled) return;
        settled = true;
        disarm();
        signal.removeEventListener('abort', onAbort);
        for (const cancel of cancels) cancel();
        cancels.clear();
        for (const socket of sockets) socket.destroy();
        sockets.clear();
        agent.destroy();
        resolveCall(result);
      }
      /** Ends the call with what is known. A set that was sent and not answered leaves the address unknown. */
      function cut(cause: Cut): void {
        if (settled) return;
        finish(ended(cause === 'DEADLINE' ? OnvifNetworkReason.DEADLINE : cause === 'BYTE_CAP' ? OnvifNetworkReason.BYTE_CAP : OnvifNetworkReason.FAULT));
      }
      signal.addEventListener('abort', onAbort, { once: true });

      /** One call of the package: its callback is taken once, and nothing it throws escapes. */
      const ask = (call: OnvifNetworkCall, invoke: Invoke): Promise<Answer> =>
        new Promise<Answer>((resolveAsk) => {
          let called = false;
          const once = (error: unknown, value?: unknown): void => {
            if (called) return;
            called = true;
            holdTarget();
            resolveAsk(error === null || error === undefined || error === false ? { ok: true, value } : { ok: false, failure: failureOf(error) });
          };
          if (settled) {
            once(new Stop('TRANSPORT'));
            return;
          }
          calls.push(call);
          try {
            holdTarget();
            invoke(once);
          } catch (error) {
            once(error);
          }
        });

      /** A call with the credential. At most one request of it is refused, and a refusal is final. */
      const authorizedAsk = async (call: OnvifNetworkCall, invoke: Invoke): Promise<Answer> => {
        if (!armed) arm('HTTP_DIGEST');
        const before = credentialRequests;
        if (!digestAllowed) credentialRequests += 1; // the token form: this request carries it
        const first = await ask(call, invoke);
        if (first.ok) return first;
        const carried = credentialRequests > before;
        if (first.failure === 'NOT_AUTHORIZED_FAULT' && !carried && digestAllowed) {
          // No challenge, a fault that asks for authentication: the device wants the token form.
          arm('TOKEN');
          credentialRequests += 1;
          calls.pop();
          const second = await ask(call, invoke);
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

      const refusalOf = (failure: Failure): OnvifNetworkReason =>
        failure === 'CREDENTIAL_REFUSED' || failure === 'NOT_AUTHORIZED_FAULT' || failure === 'CHALLENGED_UNARMED' ? OnvifNetworkReason.CREDENTIAL_REFUSED : OnvifNetworkReason.SCHEME_NOT_ALLOWED;

      const steps = async (): Promise<OnvifNetworkSetResult> => {
        // 1. Which interface, and the hardware address BEFORE anything is changed.
        const listed = await authorizedAsk('GetNetworkInterfaces', (callback) => client.getNetworkInterfaces(callback));
        if (!listed.ok) {
          if (listed.failure === 'TRANSPORT') return ended(OnvifNetworkReason.NO_ANSWER);
          if (isAuthFailure(listed.failure)) return ended(refusalOf(listed.failure));
          return ended(OnvifNetworkReason.INTERFACES_ANSWER_INVALID);
        }
        const first = firstInterfaceOf(listed.value);
        if (first === null) return ended(Array.isArray(listed.value) || listed.value === undefined ? OnvifNetworkReason.NO_INTERFACE : OnvifNetworkReason.INTERFACES_ANSWER_INVALID);
        known.hwAddress = first.hwAddress;
        // The token goes into a request body as it is: nothing but the token form is ever sent.
        const interfaceToken = first.token;
        if (typeof interfaceToken !== 'string' || !INTERFACE_TOKEN.test(interfaceToken)) return ended(OnvifNetworkReason.INTERFACE_TOKEN_REFUSED);

        // 2. ONE static address with its prefix. From here on the camera may have moved.
        known.outcome = OnvifNetworkOutcome.UNKNOWN;
        const set = await authorizedAsk('SetNetworkInterfaces', (callback) =>
          client.setNetworkInterfaces({ interfaceToken, networkInterface: { enabled: true, IPv4: { enabled: true, manual: { address: assignment.address, prefixLength: assignment.prefixLength }, DHCP: false } } }, callback),
        );
        if (!set.ok) {
          if (set.failure === 'TRANSPORT') return ended(OnvifNetworkReason.NO_ANSWER);
          // A refusal the device stated is a set that did not happen.
          if (isAuthFailure(set.failure) || set.failure === 'OTHER_FAULT') known.outcome = OnvifNetworkOutcome.NOT_SET;
          if (isAuthFailure(set.failure)) return ended(refusalOf(set.failure));
          return ended(set.failure === 'OTHER_FAULT' ? OnvifNetworkReason.SET_REFUSED : OnvifNetworkReason.SET_ANSWER_INVALID);
        }
        const rebootNeeded = member(set.value, 'rebootNeeded');
        if (typeof rebootNeeded !== 'boolean') return ended(OnvifNetworkReason.SET_ANSWER_INVALID);
        known.outcome = OnvifNetworkOutcome.SET;
        known.rebootNeeded = rebootNeeded;

        // 3. The gateway, when the assignment names one. A failure is a warning: the address stands.
        const gateway = assignment.gateway;
        if (gateway !== null) {
          const routed = await authorizedAsk('SetNetworkDefaultGateway', (callback) => client.setNetworkDefaultGateway({ IPv4Address: gateway }, callback));
          known.gateway = routed.ok && gatewayReadBack(routed.value, gateway) ? OnvifGatewayState.CONFIRMED : OnvifGatewayState.NOT_CONFIRMED;
          // A refused credential ends the call: nothing more is sent with it.
          if (!routed.ok && routed.failure === 'CREDENTIAL_REFUSED') return ended(null);
        }

        // 4. The reboot, when the device asked for one. A camera that goes down at once answers nothing.
        if (rebootNeeded) {
          const restarted = await authorizedAsk('SystemReboot', (callback) => client.systemReboot(callback));
          known.reboot = restarted.ok ? OnvifRebootState.ACCEPTED : restarted.failure === 'TRANSPORT' || restarted.failure === 'INVALID_ANSWER' ? OnvifRebootState.SENT_NO_ANSWER : OnvifRebootState.REFUSED;
        }
        return ended(null);
      };

      // Whatever goes wrong in this file's own steps is an answer too: a call never rejects once it started.
      steps().then(finish, () => cut('FAULT'));
    });
  };

  return Object.freeze({ setAddress });
}
