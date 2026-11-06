/**
 * Who a socket is: the decision table for the WebSocket upgrade (plan row W42; spec §9.2, §14.2;
 * SR-38, SR-40; decision D83 DN-3). Pure functions: no Fastify instance, no socket, no clock.
 *
 * The channel authenticates nothing. The upgrade request passed stages 3 to 6 like any request:
 * stage 3 refused a foreign `Origin` and a cookie without a web console origin with the HTTP 403
 * of the handshake, stage 4 refused two credentials with 401 and resolved the one credential (or
 * none) to a principal, stage 5 counted the upgrade. What reaches this file is that principal
 * and what stage 4 found (`authenticationOf(request)`); nothing here reads a header, a cookie, a
 * query string or a subprotocol.
 *
 *   stage 4 found                                   the socket is
 *   an OPERATOR (web cookie, or a device's bearer)  OPERATOR
 *   a DEVICE (a device credential)                  DEVICE
 *   no credential                                   ANONYMOUS
 *   the cookie, not resolving                       ANONYMOUS, `hello.reason: SESSION_INVALID`;
 *                                                   it stays open: the login page needs the heartbeat
 *   a bearer value of a retired device              `hello` with `DEVICE_REVOKED`, then close 4403
 *   any other bearer value that does not resolve    `hello` with `SESSION_INVALID`, then close 4401
 *
 * A bearer value is never left open as ANONYMOUS: a mobile client cannot read the HTTP status of
 * a refused upgrade, but it reads a close code, and it must learn that its credential is gone.
 */
import { RealtimeCloseCode, RealtimeHelloReason, RealtimePrincipal, RealtimeTopic, type RealtimeTopic as Topic } from '@dems/shared/api';
import { Permission, type OperatorRole } from '@dems/shared/sim';
import type { Authentication, Principal } from '../plugins/authenticate';

/** A socket that is opened and then closed at once: its bearer value did not resolve. */
export interface RefusedAdmission {
  readonly kind: typeof RealtimePrincipal.ANONYMOUS;
  readonly reason: RealtimeHelloReason;
  readonly closeCode: typeof RealtimeCloseCode.SESSION_ENDED | typeof RealtimeCloseCode.DEVICE_REVOKED;
}

export interface AnonymousAdmission {
  readonly kind: typeof RealtimePrincipal.ANONYMOUS;
  /** Set for a web console's cookie that no longer resolves. */
  readonly reason: typeof RealtimeHelloReason.SESSION_INVALID | null;
  readonly closeCode: null;
}

export interface DeviceAdmission {
  readonly kind: typeof RealtimePrincipal.DEVICE;
  readonly deviceId: string;
}

export interface OperatorAdmission {
  readonly kind: typeof RealtimePrincipal.OPERATOR;
  readonly operatorId: string;
  /** ID of the auth-session row: what `session.ended` names. Never the token. */
  readonly sessionId: string;
  /** The paired device of a bearer session; null for a web console session. */
  readonly deviceId: string | null;
  readonly role: OperatorRole;
  readonly permissions: readonly Permission[];
}

export type Admission = RefusedAdmission | AnonymousAdmission | DeviceAdmission | OperatorAdmission;

const OPEN_ANONYMOUS: AnonymousAdmission = Object.freeze({ kind: RealtimePrincipal.ANONYMOUS, reason: null, closeCode: null });

/** A credential that was valid for a socket and is not any more, or never was. */
export function sessionInvalid(transport: 'COOKIE' | 'BEARER'): AnonymousAdmission | RefusedAdmission {
  if (transport === 'COOKIE') {
    return { kind: RealtimePrincipal.ANONYMOUS, reason: RealtimeHelloReason.SESSION_INVALID, closeCode: null };
  }
  return { kind: RealtimePrincipal.ANONYMOUS, reason: RealtimeHelloReason.SESSION_INVALID, closeCode: RealtimeCloseCode.SESSION_ENDED };
}

/** The bearer value belongs to a device that was revoked or unpaired. */
export function deviceRetired(): RefusedAdmission {
  return { kind: RealtimePrincipal.ANONYMOUS, reason: RealtimeHelloReason.DEVICE_REVOKED, closeCode: RealtimeCloseCode.DEVICE_REVOKED };
}

/** The table above. */
export function admissionOf(principal: Principal, authentication: Authentication): Admission {
  if (principal.kind === 'OPERATOR') {
    return {
      kind: RealtimePrincipal.OPERATOR,
      operatorId: principal.operatorId,
      sessionId: principal.sessionId,
      deviceId: principal.deviceId,
      role: principal.role,
      permissions: principal.permissions,
    };
  }
  if (principal.kind === 'DEVICE') return { kind: RealtimePrincipal.DEVICE, deviceId: principal.deviceId };

  // ANONYMOUS from here on. What was presented decides whether the socket stays open.
  if (authentication.presented === 'BEARER') {
    const retired = principal.retiredDeviceId !== null || authentication.failure === 'DEVICE_RETIRED';
    return retired ? deviceRetired() : sessionInvalid('BEARER');
  }
  if (authentication.presented === 'COOKIE') return sessionInvalid('COOKIE');
  return OPEN_ANONYMOUS;
}

/** True for a socket that gets `hello` and is then closed. */
export function isRefused(admission: Admission): admission is RefusedAdmission {
  return admission.kind === RealtimePrincipal.ANONYMOUS && admission.closeCode !== null;
}

// ── The connection caps (RT-P6) ────────────────────────────────────────────────────────────────

export interface OpenCounts {
  /** Connections that are open and not being closed. */
  readonly total: number;
  /** Those of them without a principal. */
  readonly anonymous: number;
}

export interface ConnectionCaps {
  readonly maxConnections: number;
  readonly maxAnonymous: number;
}

/**
 * True when a new connection of this kind is beyond a cap and is closed with 1013: the 17th of
 * any kind, and the seventh without a principal while a device's and an operator's upgrade are
 * still accepted (AC-B-85).
 */
export function beyondCap(admission: Admission, open: OpenCounts, caps: ConnectionCaps): boolean {
  if (open.total >= caps.maxConnections) return true;
  return admission.kind === RealtimePrincipal.ANONYMOUS && open.anonymous >= caps.maxAnonymous;
}

// ── The cap of one principal (review finding CPS1-5) ───────────────────────────────────────────
//
// The two caps above are shared by everybody: without one of its own, a single web session or a
// single paired device could take all ten places of the principals and every other operator's
// upgrade would be closed with 1013. So each principal has a small cap of its own, and the rule
// at that cap is DISPLACEMENT: the newest socket is admitted and the OLDEST socket of the same
// principal is closed with 1013. A client that reconnects is therefore never refused because of
// its own earlier sockets, whether they are still being closed, were leaked by a defect, or are
// half-open: a reconnect storm of one client costs that client its own oldest sockets and nobody
// else anything. (Refusing the newest instead would lock a client out behind its own stale
// sockets until the ping ends them, up to a minute.) What a principal with more live clients
// than its cap gets is a rotation: each displaced client reconnects and displaces the next.

/**
 * What the cap of a principal is counted under: the credential the socket was opened with.
 *   `session:<auth-session row ID>`  an OPERATOR socket: one session, on the web console (the
 *                                    tabs of one browser profile share its cookie) or on a
 *                                    device (its bearer token lives in one app);
 *   `device:<device ID>`             a DEVICE socket: the device credential of a paired device
 *                                    with nobody signed in.
 * A session on a device is counted under the session, not under the device: the server lets a
 * device hold several sessions (a password session and a biometric one of the same operator),
 * each a credential of its own that ends on its own.
 * Row IDs that stage 4 resolved, never a value the caller chose.
 */
export type PrincipalKey = `session:${string}` | `device:${string}`;

/** The key of a socket's principal; null for a socket without one (the anonymous cap covers those). */
export function principalKeyOf(admission: Admission): PrincipalKey | null {
  if (admission.kind === RealtimePrincipal.ANONYMOUS) return null;
  if (admission.kind === RealtimePrincipal.DEVICE) return `device:${admission.deviceId}`;
  return `session:${admission.sessionId}`;
}

export interface PrincipalCaps {
  readonly maxPerSession: number;
  readonly maxPerDevice: number;
}

/** How many sockets one principal may hold. */
export function principalCapOf(key: PrincipalKey, caps: PrincipalCaps): number {
  return key.startsWith('device:') ? caps.maxPerDevice : caps.maxPerSession;
}

/**
 * How many of a principal's open sockets, oldest first, are closed so that one more fits its
 * cap: none below the cap, one at the cap.
 */
export function displacedBy(open: number, cap: number): number {
  return Math.max(0, open + 1 - cap);
}

// ── Topics (spec §9.2 "What each principal receives") ──────────────────────────────────────────

/** The two permissions that make an OPERATOR a receiver of `admin.changed`. */
const ADMIN_TOPIC_PERMISSIONS: readonly Permission[] = [Permission.USER_ADMIN, Permission.PAIRING_MANAGE];

/**
 * The topics `hello` names. ANONYMOUS: the heartbeat and nothing else (SR-40). DEVICE: also
 * `control`, of which it is sent `device.revoked` only. OPERATOR: `control` and `state`;
 * `meters`, which it gets after `subscribe`; and `admin` while it holds `USER_ADMIN` or
 * `PAIRING_MANAGE`.
 */
export function topicsOf(admission: Admission): Topic[] {
  if (admission.kind === RealtimePrincipal.ANONYMOUS) return [RealtimeTopic.HEARTBEAT];
  if (admission.kind === RealtimePrincipal.DEVICE) return [RealtimeTopic.HEARTBEAT, RealtimeTopic.CONTROL];
  const topics: Topic[] = [RealtimeTopic.HEARTBEAT, RealtimeTopic.CONTROL, RealtimeTopic.STATE, RealtimeTopic.METERS];
  if (admission.permissions.some((permission) => ADMIN_TOPIC_PERMISSIONS.includes(permission))) topics.push(RealtimeTopic.ADMIN);
  return topics;
}
