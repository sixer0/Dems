/**
 * The `authenticate` stage: stage 4 of the request pipeline (plan row W24; hand-built element
 * HB-5; spec §2.3, §4.1, §5.2 ID-12 and ID-13, §5.3; SR-13, SR-73, SR-75; decision D69).
 *
 * For every request that matched a route and passed stages 2 and 3, before the throttle and
 * before the body is read, it reads AT MOST ONE credential and resolves it to a principal or to
 * none:
 *
 *   presented                          resolves to
 *   nothing                            ANONYMOUS
 *   this instance's cookie             OPERATOR, when it is the token of an open session WITHOUT
 *                                      a device (a web console session); else ANONYMOUS
 *   `Authorization: Bearer ses_…`      OPERATOR, when it is the token of an open session WITH a
 *                                      device and that device is PAIRED; ANONYMOUS with the
 *                                      device ID when the device is retired; else ANONYMOUS
 *   `Authorization: Bearer dvc_…`      DEVICE, when the device registry knows the credential and
 *                                      its device is PAIRED; ANONYMOUS with the device ID when it
 *                                      is retired; else ANONYMOUS
 *   any other `Authorization` header   ANONYMOUS
 *   the cookie AND an `Authorization`  refused: 401 `NOT_SIGNED_IN`, `details.reason:
 *   header                             CREDENTIAL_CONFLICT`. Nothing is resolved (ID-12)
 *
 * A session is bound to its transport (ID-13): the cookie finds only a session without a device,
 * a bearer value only one with a device. A token presented on the other transport is "unknown".
 *
 * A credential that does not resolve is NOT refused here: the request goes on as ANONYMOUS, is
 * counted by the throttle in its class bucket (never under a value the caller chose, SR-75), and
 * stage 6 answers 401, or 403 `DEVICE_REVOKED` for a retired device. The two-credential request
 * is the only refusal of this stage.
 *
 * ONLY THIS INSTANCE'S COOKIE NAME IS A CREDENTIAL (`app.config.sessionCookieName`,
 * `dems_session_<listen port>`). Another instance's cookie and a foreign cookie are neither a
 * credential nor a conflict: React Native's socket and a shared browser profile send whatever
 * they hold for 127.0.0.1 (decision D69). Nothing here reads `Host` or `User-Agent`, and nothing
 * expects an `Origin`.
 *
 * Nothing about privilege is stored in a session: the role and its permissions are read from
 * PostgreSQL with the lookup of this request (RB-3), so a committed role change applies to the
 * next request.
 *
 * ACTIVITY (ID-P9). A POST of an operator that reaches its handler is activity: a `preHandler`
 * hook records it on the session, at most once a second. GET requests and the socket upgrade
 * never do, so an open page cannot keep itself signed in. A session that ended between this
 * stage and the handler is refused there with 401.
 *
 * The socket upgrade passes this stage like any request, so the realtime channel reads
 * `request.principal`, and `authenticationOf(request)` for what was presented and why it did not
 * resolve. It never resolves a credential a second time.
 *
 * What this file never does: it logs no credential, no cookie value and no token (the request
 * line carries `operator:<id>` or `device:<id>`), and it sets no cookie.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `authenticatePlugin`, `Principal` and
 * `ANONYMOUS_PRINCIPAL` keep their names and shapes.
 */
import { ApiErrorCode, CREDENTIAL_CONFLICT_REASON } from '@dems/shared/api';
import { AUTH_TOUCH_MIN_INTERVAL_MS, type OperatorRole, type Permission } from '@dems/shared/sim';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
// Types only, through each module's index: what the seams `sessionRegistry` and `deviceResolver`
// hand to this stage. No value of a module is imported here (review finding CPB1-10).
import type { OpenSession, SessionResolution } from '../../modules/identity';
import type { ResolvedDevice } from '../../modules/pairing';
import type { RegistryOperationId } from '../../core';
import { ApiFailure, NOT_SIGNED_IN_TEXT } from '../error-envelope';
import { routeOf } from '../logger';
import { readCredential } from './credentials';

export { WEB_CONSOLE_KEY, consoleIdentityOf, deviceNotPaired, deviceRevoked, pairedDeviceOf, type ConsoleIdentity } from './console';
export { bearerValueOf, readCredential, type PresentedCredential } from './credentials';

/**
 * Activity is written at most this often per session (1 s, as the simulator's `touch`): a burst
 * of commands does not become a burst of writes. Read by the activity hook below; the identity
 * module lists it among its numbers (`modules/identity/limits.ts` re-exports it).
 */
export const SESSION_TOUCH_MIN_INTERVAL_MS = AUTH_TOUCH_MIN_INTERVAL_MS;

/** Who a request acts as, decided once per request at stage 4 (spec §4.1). */
export type Principal =
  | {
      readonly kind: 'ANONYMOUS';
      /**
       * Set only for a retired device credential or a session of a retired device: stage 6 then
       * answers 403 `DEVICE_REVOKED` with its audit row (RB-6). It is not a principal.
       */
      readonly retiredDeviceId: string | null;
    }
  | { readonly kind: 'DEVICE'; readonly deviceId: string }
  | {
      readonly kind: 'OPERATOR';
      readonly operatorId: string;
      /** ID of the auth-session row; safe to log, never the token. */
      readonly sessionId: string;
      /** The paired device a bearer session is bound to; null for a web console session. */
      readonly deviceId: string | null;
      /** Read from PostgreSQL for this request, never stored in the session (RB-3). */
      readonly role: OperatorRole;
      readonly permissions: readonly Permission[];
    };

export const ANONYMOUS_PRINCIPAL: Principal = Object.freeze({ kind: 'ANONYMOUS', retiredDeviceId: null });

/** Why a presented credential resolved to no principal. */
export type AuthenticationFailure =
  /** The value has not the form of its kind, or the header carries no bearer value of this server. */
  | 'MALFORMED'
  /** No session or device has it (also: a session token presented on the other transport). */
  | 'UNKNOWN'
  /** The session ended before this request, or was past a limit and is ended now. */
  | 'ENDED'
  /** The session's operator is disabled. */
  | 'OPERATOR_DISABLED'
  /** The session is bound to a device the registry does not know. */
  | 'DEVICE_UNKNOWN'
  /** The credential, or the session's device, is REVOKED or UNPAIRED. */
  | 'DEVICE_RETIRED';

/** What stage 4 found for one request. */
export interface Authentication {
  /** Which credential the request presented, by presence. Only this instance's cookie name is a cookie. */
  readonly presented: 'NONE' | 'COOKIE' | 'BEARER';
  /** Null when the credential resolved to a principal, or when none was presented. */
  readonly failure: AuthenticationFailure | null;
  /** The session of an OPERATOR principal, with its operator as read for this request. */
  readonly session: OpenSession | null;
}

const NOT_AUTHENTICATED: Authentication = Object.freeze({ presented: 'NONE', failure: null, session: null });
const authentications = new WeakMap<FastifyRequest, Authentication>();

/**
 * What stage 4 found for this request: for the handlers of the identity module, for the access
 * rule, and for the realtime channel at the upgrade (a cookie that no longer resolves is
 * `presented: 'COOKIE'` with a failure; a retired device is `DEVICE_RETIRED`).
 */
export function authenticationOf(request: FastifyRequest): Authentication {
  return authentications.get(request) ?? NOT_AUTHENTICATED;
}

/** The answer for a caller without a session. The text is fixed. */
export function notSignedIn(): ApiFailure {
  return new ApiFailure(401, ApiErrorCode.NOT_SIGNED_IN, NOT_SIGNED_IN_TEXT);
}

/** The one refusal of stage 4 (ID-12). It says nothing about either credential. */
export function credentialConflict(): ApiFailure {
  return new ApiFailure(401, ApiErrorCode.NOT_SIGNED_IN, 'Send one credential per request.', {
    details: { reason: CREDENTIAL_CONFLICT_REASON },
  });
}

/** The session of the OPERATOR this request acts as. Refuses with 401 when there is none. */
export function operatorSessionOf(request: FastifyRequest): OpenSession {
  const { session } = authenticationOf(request);
  if (request.principal.kind !== 'OPERATOR' || session === null) throw notSignedIn();
  return session;
}

/**
 * Operations whose own unit of work settles the session, so the activity hook leaves it alone: a
 * password sign-in ends the session that was presented with it (rotation), and a sign-out ends its
 * own. Without the exemption the hook would record activity on a session a moment before that unit
 * ends it: one unit of work for nothing.
 *
 * A biometric sign-in is NOT listed (decision D126, ruling GD-2 / finding G-1): operation 8 carries
 * the condition DEVICE_CREDENTIAL, so stage 6 lets only a DEVICE principal reach it, and a DEVICE
 * principal presents no operator session — the hook returns at the session check before this list
 * is consulted. The entry had no effect once that condition landed; it is removed so the list says
 * what is true.
 *
 * The list is typed by the contract's operation IDs (review finding CPB1-18): a name that is no
 * operation of the registry does not compile.
 */
export const ACTIVITY_EXEMPT_OPERATIONS: readonly RegistryOperationId[] = ['signIn', 'signOut'];

/** The same list for a lookup by the operation ID of a route, which is a plain string. */
const ACTIVITY_EXEMPT: ReadonlySet<string> = new Set(ACTIVITY_EXEMPT_OPERATIONS);

const retired = (deviceId: string): Principal => ({ kind: 'ANONYMOUS', retiredDeviceId: deviceId });

/** A session token whose row was ended because its device was revoked or unpaired. */
function endedWithItsDevice(resolution: SessionResolution): boolean {
  return resolution.status === 'ENDED' && (resolution.endReason === 'DEVICE_REVOKED' || resolution.endReason === 'DEVICE_UNPAIRED');
}

function operatorPrincipal(session: OpenSession): Principal {
  return {
    kind: 'OPERATOR',
    operatorId: session.operatorId,
    sessionId: session.id,
    deviceId: session.deviceId,
    role: session.operator.role,
    permissions: session.permissions,
  };
}

/** A resolution that is not an open session names its own reason. */
const failureOf = (resolution: Exclude<SessionResolution, { status: 'OPEN' }>): AuthenticationFailure => resolution.status;

interface Resolved {
  readonly principal: Principal;
  readonly authentication: Authentication;
}

/** A cookie: only a session without a device (ID-13). */
async function resolveCookie(app: FastifyInstance, token: string | null): Promise<Resolved> {
  const unresolved = (failure: AuthenticationFailure): Resolved => ({
    principal: ANONYMOUS_PRINCIPAL,
    authentication: { presented: 'COOKIE', failure, session: null },
  });
  if (token === null) return unresolved('MALFORMED');
  const resolution = await app.sessionRegistry.resolve(token, 'COOKIE');
  if (resolution.status !== 'OPEN') return unresolved(failureOf(resolution));
  return {
    principal: operatorPrincipal(resolution.session),
    authentication: { presented: 'COOKIE', failure: null, session: resolution.session },
  };
}

function bearer(principal: Principal, failure: AuthenticationFailure | null, session: OpenSession | null = null): Resolved {
  return { principal, authentication: { presented: 'BEARER', failure, session } };
}

/** A bearer session token: only a session with a device, and only while that device is PAIRED. */
async function resolveBearerSession(app: FastifyInstance, token: string): Promise<Resolved> {
  const resolution = await app.sessionRegistry.resolve(token, 'BEARER');
  if (resolution.status === 'UNKNOWN') return bearer(ANONYMOUS_PRINCIPAL, 'UNKNOWN');
  const deviceId = resolution.status === 'OPEN' ? resolution.session.deviceId : resolution.deviceId;
  // The lookup found a session with a device; a row without one cannot come back from it.
  if (deviceId === null) return bearer(ANONYMOUS_PRINCIPAL, 'UNKNOWN');
  const device: ResolvedDevice | null = await app.deviceResolver.resolveDevice(deviceId);
  if (device?.status === 'RETIRED' || endedWithItsDevice(resolution)) return bearer(retired(deviceId), 'DEVICE_RETIRED');
  if (resolution.status !== 'OPEN') return bearer(ANONYMOUS_PRINCIPAL, failureOf(resolution));
  // No registry entry: the session cannot be shown to belong to a paired device, so it resolves to nothing.
  if (device === null) return bearer(ANONYMOUS_PRINCIPAL, 'DEVICE_UNKNOWN');
  return bearer(operatorPrincipal(resolution.session), null, resolution.session);
}

/** A device credential: the device registry decides (the seam `deviceResolver`, plan row W32). */
async function resolveDeviceCredential(app: FastifyInstance, credential: string): Promise<Resolved> {
  const device = await app.deviceResolver.resolveCredential(credential);
  if (device === null) return bearer(ANONYMOUS_PRINCIPAL, 'UNKNOWN');
  if (device.status === 'RETIRED') return bearer(retired(device.deviceId), 'DEVICE_RETIRED');
  return bearer({ kind: 'DEVICE', deviceId: device.deviceId }, null);
}

export const authenticatePlugin: FastifyPluginAsync = async (app) => {
  const cookieName = app.config.sessionCookieName;

  app.stages.provide('authenticate', async (request) => {
    const presented = readCredential(request.cookies, request.headers.authorization, cookieName);
    let resolved: Resolved;
    switch (presented.kind) {
      case 'NONE':
        return;
      case 'CONFLICT':
        // One line beside the request line, which cannot say why a 401 was a conflict. Presence
        // only: neither value is read.
        request.log.warn(
          { code: ApiErrorCode.NOT_SIGNED_IN, reason: CREDENTIAL_CONFLICT_REASON, route: routeOf(request) },
          'request refused: two credentials',
        );
        throw credentialConflict();
      case 'COOKIE':
        resolved = await resolveCookie(app, presented.token);
        break;
      case 'BEARER_SESSION':
        resolved = await resolveBearerSession(app, presented.token);
        break;
      case 'BEARER_DEVICE':
        resolved = await resolveDeviceCredential(app, presented.credential);
        break;
      case 'BEARER_OTHER':
        resolved = bearer(ANONYMOUS_PRINCIPAL, 'MALFORMED');
        break;
    }
    request.principal = resolved.principal;
    authentications.set(request, resolved.authentication);
  });

  // Activity (ID-P9). `preHandler` runs after the access rule and the validation, so a POST that
  // was refused or malformed is not activity.
  app.addHook('preHandler', async (request) => {
    if (request.method !== 'POST') return;
    const authentication = authentications.get(request);
    const session = authentication?.session;
    if (authentication === undefined || session === null || session === undefined) return;
    const operationId = request.routeOptions.config.operationId;
    if (operationId !== undefined && ACTIVITY_EXEMPT.has(operationId)) return;
    if (app.clock.now() - session.lastSeenAt < SESSION_TOUCH_MIN_INTERVAL_MS) return;

    const outcome = await app.sessionRegistry.touch(session.id);
    if (outcome.status === 'ENDED') {
      // Signed out, expired or disabled between stage 4 and here: the command does not run.
      request.principal = ANONYMOUS_PRINCIPAL;
      authentications.set(request, { ...authentication, failure: 'ENDED', session: null });
      throw notSignedIn();
    }
    authentications.set(request, { ...authentication, session: { ...session, lastSeenAt: outcome.lastSeenAt } });
  });
};
