/**
 * The handlers of the live camera preview and of the idle microphone meters (decisions D51, D53).
 *
 *   112  createCameraPreviewSession   POST /api/v1/capture/devices/{id}/preview-sessions   ANY-OF(SESSION_START, CAPTURE_CONFIG, DEVICE_MANAGE)   201
 *        the preview route            GET  /preview/:token                                  the rule of 112 (registry-external)
 *   113  holdIdleMeters               POST /api/v1/capture/idle-meters/lease                ANY-OF(CAPTURE_CONFIG, DEVICE_MANAGE, SESSION_START)   200
 *
 * THIS FILE REGISTERS NO ROUTE. Routes are registered by modules only (static rule of the
 * permission guard): `src/modules/camera-preview` registers the three routes and hands each request
 * to the handlers built here. A module sets no header of an answer, and the preview route must set
 * `content-type` and `cache-control`: so the handlers live in this unit, as the media route's do.
 *
 * OPERATION 112 issues ONE preview token for ONE camera. In order:
 *
 *   401 / 403   stage 6: not signed in; a role with none of the three permissions, with its ACCESS_DENIED row
 *   422         a path parameter of another form (the schema)
 *   404         no registered device of that ID
 *   409         INVALID_STATE `PREVIEW_NOT_AVAILABLE`: this Core has no live preview (not production
 *               capture), the device is no camera of the production kind or is retired, or the camera
 *               refused the credential in the last minutes (`details.cause: AUTH_REFUSED`). No row
 *   429         RATE_LIMITED `PREVIEW_LIMIT`: a bound of the previews is reached. No row
 *   201         `{ url, expiresAt }`; ONE `CAMERA_PREVIEW_OPENED` row is committed BEFORE the answer:
 *               no token exists that the trail does not know of
 *
 * THE TOKEN is `cps_` and 32 random bytes (base64url): a bearer value kept in this process only,
 * bound to the operator, the sign-in session and the camera, and opened within
 * `CAMERA_PREVIEW_SESSION_TTL_MS` (60 s). A Core that restarts forgets every token. Kept at most
 * `PREVIEW_TOKENS_KEPT`; the oldest goes first.
 *
 * THE PREVIEW ROUTE streams `multipart/x-mixed-replace` (one JPEG per part, `Cache-Control:
 * no-store`). In order:
 *
 *   401   the caller is no operator (the token alone opens nothing)
 *   403   NOT_PERMITTED `PREVIEW_SESSION_INVALID`, one ACCESS_DENIED row: not a token of this Core, or
 *         one of another operator, sign-in session - one answer for all
 *   403   NOT_PERMITTED `PREVIEW_SESSION_EXPIRED`, no row: a token past its 60 s
 *   409   `PREVIEW_NOT_AVAILABLE`: no preview on this Core, or the camera refused the credential
 *   429   `PREVIEW_LIMIT`: a bound was reached since the token was issued
 *   200   the stream. It ENDS when the sign-in session ends (asked every `PREVIEW_SESSION_CHECK_MS`,
 *         10 s; a read that fails ends it too), when the viewer goes, or when the camera is lost for
 *         good. The expiry of the token does not cut a stream in flight: it gates its start
 *
 * OPERATION 113 takes or renews the lease of the idle meters for the operator: `{ expiresAt }`, or
 * `409 IDLE_METERS_NOT_AVAILABLE` on a Core without them. No row (a level is no fact of the trail).
 *
 * WHAT IS NEVER LOGGED: the token and the URL. The request line holds the route PATTERN
 * (`/preview/:token`), never the path (`plugins/logger`); the lines of this file hold codes and a
 * device ID.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { PassThrough } from 'node:stream';
import {
  ApiErrorCode,
  CAMERA_PREVIEW_LIMIT_REASON,
  CAMERA_PREVIEW_NOT_AVAILABLE_REASON,
  CAMERA_PREVIEW_SESSION_TTL_MS,
  CAMERA_PREVIEW_TOKEN_PREFIX,
  IDLE_METERS_NOT_AVAILABLE_REASON,
  findCoreApiOperation,
  type CameraPreviewSessionBody,
  type CoreApiRegistryOperation,
  type IdleMeterLeaseBody,
} from '@dems/shared/api';
import { AuditType, Permission, Severity } from '@dems/shared/sim';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuditEntry } from '../core';
import { notSignedIn, type Principal } from '../plugins/authenticate';
import { ApiFailure } from '../plugins/error-envelope';
import { describeError, principalReference } from '../plugins/logger';
import { CAMERA_PREVIEW_ROUTE_URL } from '../plugins/permission-guard';

/** The registry operations this unit answers. */
export const CAMERA_PREVIEW_OPERATIONS = ['createCameraPreviewSession', 'holdIdleMeters'] as const;
export type CameraPreviewOperation = (typeof CAMERA_PREVIEW_OPERATIONS)[number];
const SESSION_OPERATION: CameraPreviewOperation = 'createCameraPreviewSession';
const LEASE_OPERATION: CameraPreviewOperation = 'holdIdleMeters';

/** The preview route as the router holds it. Registry-external; the guard holds its rule (the rule of operation 112). */
export const PREVIEW_ROUTE_PREFIX = '/preview';
export const PREVIEW_ROUTE_URL = CAMERA_PREVIEW_ROUTE_URL;

/** The boundary of the parts of the preview stream. A constant: it never stands in a JPEG's own bytes as a line. */
export const PREVIEW_BOUNDARY = 'demspreview';
/** How often a stream in flight asks whether its sign-in session is still open. */
export const PREVIEW_SESSION_CHECK_MS = 10_000;
/** How many tokens are kept at most. */
export const PREVIEW_TOKENS_KEPT = 256;
/** What the socket of one viewer may hold before the viewer skips pictures (bytes). */
export const PREVIEW_VIEWER_BUFFER_BYTES = 256 * 1024;
/** `cps_` and 32 random bytes as unpadded base64url. */
export const PREVIEW_TOKEN_PATTERN = new RegExp(`^${CAMERA_PREVIEW_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`);
const TOKEN_BYTES = 32;

/** `details.reason` of the two token refusals of the preview route. */
export const PreviewTokenRefusal = { INVALID: 'PREVIEW_SESSION_INVALID', EXPIRED: 'PREVIEW_SESSION_EXPIRED' } as const;
/** The code of a stream that was cut because its sign-in session ended. In the log line. */
export const PREVIEW_SESSION_ENDED_REASON = 'PREVIEW_SESSION_ENDED';

/** Labels of the units that write this unit's rows. */
export const PREVIEW_SESSION_ISSUED_UNIT = 'cameraPreview.sessionIssued';
export const PREVIEW_DENIED_UNIT = 'cameraPreview.denied';

const SOURCE = 'cameraPreview';
const NOT_FOUND_TEXT = 'The capture registry has no device with this ID.';
const NOT_AVAILABLE_TEXT = 'There is no live preview of this device on this Core.';
const LIMIT_TEXT = 'Too many live previews are open. Close one and try again.';
const NOT_PERMITTED_TEXT = 'Your role does not allow this action. The attempt was audited.';
const SESSION_REFUSED_TEXT = 'This preview session cannot be used. Open the preview again.';
const IDLE_NOT_AVAILABLE_TEXT = 'This Core shows no microphone level while it is idle.';
const DENIED = 'Preview session refused';
const STREAM_FAILED = 'the live preview stream of a camera failed';

// ── What the handlers are handed (the unit's index builds it; a test replaces it) ────────────────

/** A registered device as far as operation 112 reads it: its kind, its adapter kind, whether it is retired. */
export interface PreviewDevice {
  readonly kind: string;
  readonly adapterKind: string;
  readonly retired: boolean;
}

/** The viewer side of the preview manager of the capture unit, by shape (`PreviewManager`). */
export interface PreviewViewerPlace {
  leave(): void;
  drained(): void;
}
export interface PreviewSinkShape {
  frame(jpeg: Buffer): boolean;
  end(reason: string): void;
}
export interface CameraPreviewManagerShape {
  join(deviceId: string, operatorId: string, sink: PreviewSinkShape): { readonly joined: true; readonly viewer: PreviewViewerPlace } | { readonly joined: false; readonly reason: string };
  wouldRefuse(deviceId: string): string | null;
}

/** The idle meters of the capture unit, by shape (`IdleMeters.hold`). */
export interface IdleMetersShape {
  hold(operatorId: string): { readonly expiresAt: number };
}

export interface CameraPreviewParts {
  /** The registered device of that ID, or null. Read per request on the pool. */
  device(request: FastifyRequest, deviceId: string): Promise<PreviewDevice | null>;
  /** True while the sign-in session of that ID is open. Asked while a stream is in flight. */
  sessionOpen(request: FastifyRequest, sessionId: string): Promise<boolean>;
  /** The preview manager of production capture, or null on a Core without a live preview. */
  manager(): CameraPreviewManagerShape | null;
  /** The idle meters of production capture, or null on a Core without them. */
  idleMeters(): IdleMetersShape | null;
  /** 32 random bytes. */
  tokenBytes(): Uint8Array;
}

/** The adapter kind a live preview is made of: the production camera adapter's. */
export const PREVIEW_ADAPTER_KIND = 'ONVIF_RTSP';

type Operator = Extract<Principal, { kind: 'OPERATOR' }>;

/** The claims of one token, kept in this process only. */
interface PreviewClaims {
  readonly operatorId: string;
  readonly sessionId: string;
  readonly deviceId: string;
  readonly expiresAt: number;
}

function operationOf(operationId: CameraPreviewOperation): CoreApiRegistryOperation {
  const operation = findCoreApiOperation(operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

const notAvailable = (cause?: string): ApiFailure =>
  new ApiFailure(409, ApiErrorCode.INVALID_STATE, NOT_AVAILABLE_TEXT, { details: { reason: CAMERA_PREVIEW_NOT_AVAILABLE_REASON, ...(cause === undefined ? {} : { cause }) } });
const limited = (): ApiFailure => new ApiFailure(429, ApiErrorCode.RATE_LIMITED, LIMIT_TEXT, { details: { reason: CAMERA_PREVIEW_LIMIT_REASON }, headers: { 'retry-after': '5' } });

/** The first of the three permissions the caller holds (the row names it). */
const VIEWER_PERMISSIONS: readonly Permission[] = [Permission.SESSION_START, Permission.CAPTURE_CONFIG, Permission.DEVICE_MANAGE];
const heldPermission = (principal: Operator): Permission | undefined => VIEWER_PERMISSIONS.find((permission) => principal.permissions.includes(permission));

/** Compares two tokens in constant time for their length. */
function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** One part of the stream: the boundary, the two headers, the picture, the line end. */
export function previewPartOf(jpeg: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`--${PREVIEW_BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${String(jpeg.length)}\r\n\r\n`, 'latin1'), jpeg, Buffer.from('\r\n')]);
}

export interface CameraPreviewService {
  readonly sessionOperation: CoreApiRegistryOperation;
  readonly leaseOperation: CoreApiRegistryOperation;
  /** The path parameters of operation 112: `{ id }`, held to the registry's pattern. */
  readonly sessionParams: z.ZodObject<{ id: z.ZodString }>;
  /** Operation 112. Sets the status 201 and returns the body. */
  createSession(request: FastifyRequest, deviceId: string, reply: FastifyReply): Promise<CameraPreviewSessionBody>;
  /** Operation 113. */
  holdLease(request: FastifyRequest): Promise<IdleMeterLeaseBody>;
  /** The preview route: answers the stream, or throws the refusal. */
  serve(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply>;
  /** Ends every stream in flight (the app closes). */
  closeAll(): void;
}

/** Builds the handlers of operations 112, 113 and of the preview route for one app. */
export function createCameraPreviewService(app: FastifyInstance, parts: () => CameraPreviewParts): CameraPreviewService {
  const sessionOperation = operationOf(SESSION_OPERATION);
  const leaseOperation = operationOf(LEASE_OPERATION);
  const idPattern = sessionOperation.pathParam?.pattern;
  if (idPattern === undefined) throw new Error(`the registry gives ${SESSION_OPERATION} no path parameter`);

  /** The tokens of this process, in the order they were issued. */
  const tokens = new Map<string, PreviewClaims>();
  /** The streams in flight: each one's end. */
  const streams = new Set<() => void>();

  const append = (label: string, entry: AuditEntry): Promise<unknown> => app.pipeline.run(label, async (unit) => void (await unit.audit.append(entry)));

  /** An audited refusal of the preview route: the denial budget, then ONE `ACCESS_DENIED` row, before the answer. */
  async function refuse(request: FastifyRequest, principal: Operator, reason: string): Promise<never> {
    await app.denialBudget.consume(request);
    const named = { operationId: SESSION_OPERATION, role: principal.role, reason };
    await append(PREVIEW_DENIED_UNIT, {
      type: AuditType.ACCESS_DENIED,
      severity: Severity.WARNING,
      message: `Access denied: ${reason} (${SESSION_OPERATION})`,
      actorId: principal.operatorId,
      deviceId: principal.deviceId,
      details: named,
    });
    request.log.warn({ code: ApiErrorCode.NOT_PERMITTED, source: SOURCE, operationId: SESSION_OPERATION, principal: principalReference(principal), refusedBy: reason, audited: true }, DENIED);
    throw new ApiFailure(403, ApiErrorCode.NOT_PERMITTED, SESSION_REFUSED_TEXT, { details: named });
  }

  const sweep = (now: number): void => {
    for (const [token, claims] of tokens) if (claims.expiresAt <= now) tokens.delete(token);
    while (tokens.size >= PREVIEW_TOKENS_KEPT) {
      const oldest = tokens.keys().next().value;
      if (oldest === undefined) break;
      tokens.delete(oldest);
    }
  };

  // ── 112 createCameraPreviewSession ───────────────────────────────────────────────────────────

  const createSession = async (request: FastifyRequest, deviceId: string, reply: FastifyReply): Promise<CameraPreviewSessionBody> => {
    const principal = request.principal;
    // Stage 6 has refused every other caller; a token is bound to an operator all the same.
    if (principal.kind !== 'OPERATOR') throw notSignedIn();
    const device = await parts().device(request, deviceId);
    if (device === null) throw new ApiFailure(404, ApiErrorCode.NOT_FOUND, NOT_FOUND_TEXT, { details: { simCode: 'NOT_FOUND' } });
    const manager = parts().manager();
    if (manager === null || device.kind !== 'CAMERA' || device.adapterKind !== PREVIEW_ADAPTER_KIND || device.retired) throw notAvailable();
    const refused = manager.wouldRefuse(deviceId);
    if (refused === CAMERA_PREVIEW_LIMIT_REASON) throw limited();
    if (refused !== null) throw notAvailable(refused);

    const now = app.clock.now();
    sweep(now);
    const expiresAt = now + CAMERA_PREVIEW_SESSION_TTL_MS;
    const token = `${CAMERA_PREVIEW_TOKEN_PREFIX}${Buffer.from(parts().tokenBytes()).toString('base64url')}`;
    if (!PREVIEW_TOKEN_PATTERN.test(token)) throw new Error('the preview token is not of its form');
    const permission = heldPermission(principal);
    // The row first: no token exists that the trail does not know of.
    await append(PREVIEW_SESSION_ISSUED_UNIT, {
      type: AuditType.CAMERA_PREVIEW_OPENED,
      message: `Live camera preview opened for ${deviceId}`,
      actorId: principal.operatorId,
      deviceId,
      details: { deviceId, expiresAt, operationId: SESSION_OPERATION, ...(permission === undefined ? {} : { permission }) },
    });
    tokens.set(token, Object.freeze({ operatorId: principal.operatorId, sessionId: principal.sessionId, deviceId, expiresAt }));
    request.log.info({ code: AuditType.CAMERA_PREVIEW_OPENED, source: SOURCE, deviceId, expiresAt }, 'Live camera preview session opened');
    void reply.code(201);
    // Loopback only (C3 N-4): the listen host is a constant of the configuration, never a request value.
    return { url: `http://${app.config.host}:${String(app.config.port)}${PREVIEW_ROUTE_PREFIX}/${token}`, expiresAt };
  };

  // ── 113 holdIdleMeters ────────────────────────────────────────────────────────────────────────

  const holdLease = async (request: FastifyRequest): Promise<IdleMeterLeaseBody> => {
    const principal = request.principal;
    if (principal.kind !== 'OPERATOR') throw notSignedIn();
    const meters = parts().idleMeters();
    if (meters === null) throw new ApiFailure(409, ApiErrorCode.INVALID_STATE, IDLE_NOT_AVAILABLE_TEXT, { details: { reason: IDLE_METERS_NOT_AVAILABLE_REASON } });
    const { expiresAt } = meters.hold(principal.operatorId);
    return { expiresAt };
  };

  // ── The preview route ─────────────────────────────────────────────────────────────────────────

  const serve = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    if (request.principal.kind !== 'OPERATOR') throw notSignedIn();
    const principal: Operator = request.principal;
    const params: unknown = request.params;
    const given: unknown = typeof params === 'object' && params !== null && 'token' in params ? params.token : undefined;
    const now = app.clock.now();
    let claims: PreviewClaims | undefined;
    if (typeof given === 'string' && PREVIEW_TOKEN_PATTERN.test(given)) {
      for (const [token, held] of tokens) if (sameToken(token, given)) claims = held;
    }
    if (claims === undefined || claims.operatorId !== principal.operatorId || claims.sessionId !== principal.sessionId) return refuse(request, principal, PreviewTokenRefusal.INVALID);
    if (claims.expiresAt <= now) {
      throw new ApiFailure(403, ApiErrorCode.NOT_PERMITTED, SESSION_REFUSED_TEXT, { details: { operationId: SESSION_OPERATION, reason: PreviewTokenRefusal.EXPIRED } });
    }
    const { deviceId } = claims;
    const manager = parts().manager();
    if (manager === null) throw notAvailable();

    const body = new PassThrough({ highWaterMark: PREVIEW_VIEWER_BUFFER_BYTES });
    let ended = false;
    let place: PreviewViewerPlace | null = null;
    let cancelCheck: (() => void) | null = null;
    const finish = (): void => {
      if (ended) return;
      ended = true;
      streams.delete(finish);
      cancelCheck?.();
      place?.leave();
      body.end();
    };
    const joined = manager.join(deviceId, principal.operatorId, {
      frame(jpeg) {
        if (ended) return true;
        return body.write(previewPartOf(jpeg));
      },
      end(reason) {
        request.log.info({ code: reason, source: `${SOURCE}.serve`, deviceId }, 'Live camera preview stream ended');
        finish();
      },
    });
    if (!joined.joined) {
      body.destroy();
      if (joined.reason === CAMERA_PREVIEW_LIMIT_REASON) throw limited();
      throw notAvailable(joined.reason);
    }
    place = joined.viewer;
    // A stream the manager ended inside the join (the camera is gone already): the place is given back at once.
    if (ended) place.leave();
    body.on('drain', () => place?.drained());
    body.on('close', finish);
    request.raw.on('close', finish);
    streams.add(finish);

    // R93-08, the preview's way: a stream in flight ends with its sign-in session. A read that fails ends it too.
    const timer = setInterval(() => {
      void parts()
        .sessionOpen(request, principal.sessionId)
        .catch((error: unknown) => {
          app.errorLog.append({ level: 'warn', source: `${SOURCE}.sessionCheck`, message: STREAM_FAILED, ...describeError(error), context: { requestId: request.id, deviceId } });
          return false;
        })
        .then((open) => {
          if (open || ended) return;
          request.log.info({ code: PREVIEW_SESSION_ENDED_REASON, source: `${SOURCE}.serve`, deviceId }, 'Live camera preview stream stopped: its sign-in session ended');
          finish();
        });
    }, PREVIEW_SESSION_CHECK_MS);
    timer.unref();
    cancelCheck = () => clearInterval(timer);

    void reply.code(200);
    void reply.headers({
      'content-type': `multipart/x-mixed-replace; boundary=${PREVIEW_BOUNDARY}`,
      'cache-control': 'no-store',
    });
    return reply.send(body);
  };

  return {
    sessionOperation,
    leaseOperation,
    sessionParams: z.object({ id: z.string().regex(idPattern) }),
    createSession,
    holdLease,
    serve,
    closeAll() {
      for (const finish of [...streams]) finish();
      tokens.clear();
    },
  };
}

/** For the unit's index: 32 random bytes. */
export const previewTokenBytes = (): Uint8Array => randomBytes(TOKEN_BYTES);
