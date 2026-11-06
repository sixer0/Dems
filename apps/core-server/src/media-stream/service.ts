/**
 * The handlers of the two media routes (blueprint row 90, M8-W1; C3 §2.2 operation 88, §2.4,
 * §5.1, §5.2; capture spec §D.4; UX flow 5; SEC35-12, SEC35-13, SEC35-16).
 *
 *   88  createEvidenceMediaSession   POST /api/v1/evidence/{id}/media-sessions   EVIDENCE_VIEW   201
 *       the media route              GET  /media/:token                          registry-external
 *
 * THIS FILE REGISTERS NO ROUTE. Routes are registered by modules only (static rule of the
 * permission guard): `src/modules/media-stream` registers the two routes and hands each request
 * to the handlers built here.
 *
 * OPERATION 88 issues one signed media session for ONE camera file of one evidence item. Method,
 * path and answer schema are the registry's. The body is optional: `{ "fileId": "VIDEO-01" }` or
 * `{ "fileId": "VIDEO-02" }`; without a body, or with `{}`, the session plays VIDEO-01 (row 92's request; the
 * shared contract gains the member through pass D1b). In order:
 *
 *   401 / 403   stage 6: not signed in; a role without EVIDENCE_VIEW, with its ACCESS_DENIED row
 *   422         a body with a member other than `fileId` and `seekIndex: true`, or another value of one
 *   404         no item of that ID
 *   409         MEDIA_NOT_AVAILABLE: the item has no sealed v2 package in this Core's store (every
 *               v1 demo package and simulated item: a client plays its bundled media for those). A
 *               demonstration item the SEED sealed here HAS one and is opened (decision D205)
 *   403         NOT_PERMITTED, `details.reason: EVIDENCE_CASE_SCOPE`, one ACCESS_DENIED row
 *               (SEC35-16, Q-SEC-1 (a)): the item is REAL and the caller neither holds the case
 *               nor is a SUPERVISOR
 *   503         NOT_READY, `details.reason: CREDENTIAL_STORE_NOT_READY`: no signing key store
 *   409         MEDIA_NOT_AVAILABLE with `details.reason`: the package cannot be played (folder or
 *               file missing, manifest not the sealed one, session key lost)
 *   201         the session; ONE `EVIDENCE_MEDIA_SERVED` row is committed BEFORE the answer
 *               (`fileId`, `bytesServed: 0`, `signed: true`, `expiresAt`): no token exists that the
 *               trail does not know of
 *
 * THE MEDIA ROUTE serves the decrypted camera file with HTTP Range support. The token is the last
 * path segment and nothing else of the request is read but the `Range` header. In order:
 *
 *   401   the caller is no operator (the token alone opens nothing: it is bound to a session)
 *   503   no signing key store
 *   403   NOT_PERMITTED `MEDIA_SESSION_INVALID`, one ACCESS_DENIED row: not a token, an altered
 *         token, a token of another operator or of another sign-in session - one answer for all
 *   403   NOT_PERMITTED `MEDIA_SESSION_EXPIRED`, no row: an authentic token past its lifetime
 *   403   the role lost EVIDENCE_VIEW since the session was issued; or the case scope, as above
 *   409   MEDIA_NOT_AVAILABLE: the item or its package is gone, or the FIRST fragment of the
 *         range does not authenticate (`FRAGMENT_NOT_AUTHENTIC`) - nothing was sent
 *   416   the range starts at or past the end of the file; `content-range: bytes * /size`
 *   200 / 206   the bytes, `content-type: video/mp4`, `accept-ranges: bytes`, `content-length`
 *
 * A FRAGMENT THAT FAILS LATER IN THE RANGE. The status line and the length are on the wire by
 * then, so the answer cannot be changed: the stream STOPS before the failed fragment and the
 * connection is destroyed. The client sees a body that is shorter than `content-length` on a
 * closed connection (a media element reports a network error); the same request made again from
 * that offset gets the clean `409` above. Bytes of a fragment that failed are never sent.
 *
 * AN ANSWER IN FLIGHT AND ITS SIGN-IN SESSION (review finding R93-08). Every NEW request dies with
 * the session: stage 4 reads the session from the database per request, so after a sign-out the
 * caller is anonymous and is refused before the token is looked at. An answer that is already
 * streaming is CUT: every `MEDIA_SESSION_CHECK_EVERY_PIECES` pieces the handler asks whether the
 * session it started in is still open (`parts().sessionOpen`, one row by its key), and stops the
 * stream when it is not - also when that read fails (fail closed). The exposure after a sign-out
 * is therefore bounded by that many pieces (a piece is one fragment or one clear chunk), not by
 * the length of the file. The EXPIRY of the token does not cut an answer in flight (decision
 * D-90-9 stands: a player reads one long range): the token gates the START of an answer.
 *
 * THE AUDIT TRAIL of serving (wave H C1; gate finding G94-06, ruling D200). A PLAYBACK IS AUDITED
 * ONCE PER MEDIA SESSION ISSUE: the row operation 88 commits before its answer says who opened
 * which file of which item, when, and until when the session lives (SEC35-12: "no token exists
 * that the trail does not know of"; SEC35-13 is the blanking of the token, unchanged). A RANGE
 * REQUEST IS NOT AN AUDIT ROW: a player reads the fragment index of an fMP4 by a hundred aborted
 * requests, and a row per request buried the trail (117 rows for one opening of a 134 s item).
 * An answered range is ONE LOG LINE (`debug`: the file, the positions the server computed, the
 * bytes handed on). ONE MORE ROW IS WRITTEN WHEN SERVING FAILS on the package: a fragment whose
 * tag did not verify (or that could not be opened or read) - `WARNING`, naming the fragment, the
 * range and the bytes that were handed on before it; that row is evidence about the package and
 * is never dropped. A stream cut because its sign-in session ended is a log line (the sign-out
 * itself is in the trail). Never the token, never the URL, never a byte of media (C3 §5.1).
 *
 * ONE STOP, ONE ROW (fix wave K Z1; gate finding G94b-10; erratum PE-WH-04 "ONE row when serving
 * stops"). A player that is refused a place asks for it again by itself: the Android player repeats
 * a failed load three times before it reports an error, a browser probes, an app renews its media
 * session once and goes back to the same position. Each of those requests is refused exactly as the
 * first (the same cut, the same `409`), but the WARNING row is written ONCE per (operator, sign-in session,
 * item as sealed, file, fragment, code) within one media-session lifetime
 * (`EVIDENCE_MEDIA_SESSION_TTL_MS` from the row): the later requests are log lines. The memory of
 * it holds IDs and a number, never a token; a Core that restarts forgets it and writes the row
 * again - never fewer rows than stops.
 *
 * THE INDEXED VIEW (fix wave K Z1; gate finding G94b-01; ruling D224 (1)). A body of operation 88
 * may ask `seekIndex: true`: the session then serves the INDEXED VIEW of the file - the same
 * decrypted bytes plus ONE segment index (`sidx`) between the init segment and the first fragment,
 * built from the signed manifest's fragment table (`seek-index.ts`) - and the answer states it
 * (`seekIndex: true`). A file whose table yields no exact index gets the plain session and the
 * answer states nothing. The view is a claim of the token (under its MAC): on such a session the
 * length, `content-range`, the Range offsets and the `416` are those of the VIEW; behind the index
 * every offset is the file's plus the length of the box. Fragments are opened and authenticated by
 * the same reader, so the stop before a failed fragment and the `409` of a range that starts in
 * one are at the same place of the recording. The audit row of a stop gives its range in FILE
 * offsets (the sealed file's own), `bytesServed` as sent. Nothing of the package is written.
 *
 * WHAT IS NEVER LOGGED: the token, the URL, the `Range` value. The request line of the server
 * holds the route PATTERN (`/media/:token`), never the path (`plugins/logger`); the lines of this
 * file hold codes, a file ID, an evidence ID and counts.
 */
import { Readable } from 'node:stream';
import { ApiErrorCode, CaptureDiscoveryReason, EVIDENCE_MEDIA_SESSION_TTL_MS, findCoreApiOperation, type CoreApiRegistryOperation, type EvidenceMediaSessionBody } from '@dems/shared/api';
import { CAMERA_FILE_MEDIA_TYPE, VIDEO_TRACK_IDS, type PackageVideoTrackId } from '@dems/shared/evidence-package';
import type { FragmentOpener } from '@dems/shared/evidence-verify';
import { AuditType, OperatorRole, Permission, Severity } from '@dems/shared/sim';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuditEntry } from '../core';
import { createPackageReader } from '../evidence-verify';
import { notSignedIn, type Principal } from '../plugins/authenticate';
import { ApiFailure, invalidInput } from '../plugins/error-envelope';
import { describeError, principalReference } from '../plugins/logger';
import { EVIDENCE_MEDIA_ROUTE_URL } from '../plugins/permission-guard';
import type { MediaItem } from './items';
import { contentRangeOf, decideRange, unsatisfiedRangeOf } from './ranges';
import { fileOffsetOfViewOffset, indexedViewSize } from './seek-index';
import { MediaSourceError, MediaSourceFailure, planMediaFile, readIndexedView, readPlain, type MediaFilePlan, type MediaSourcePorts } from './source';
import { MEDIA_TOKEN_PATTERN, MediaTokenRefusal, issueMediaToken, readMediaToken, type MediaSessionMac } from './token';

/** The registry operation this unit answers. */
export const MEDIA_STREAM_OPERATIONS = ['createEvidenceMediaSession'] as const;
export type MediaStreamOperation = (typeof MEDIA_STREAM_OPERATIONS)[number];
const OPERATION_ID: MediaStreamOperation = 'createEvidenceMediaSession';

/** The media route as the router holds it. Registry-external, like the realtime channel (C3 §2.4). */
export const MEDIA_ROUTE_PREFIX = '/media';
/** The path the permission guard holds its fixed rule for (ruling D140): one constant, the guard's. */
export const MEDIA_ROUTE_URL = EVIDENCE_MEDIA_ROUTE_URL;

/** Labels of the units that write this unit's rows. They appear in the pipeline's log lines. */
export const MEDIA_SESSION_ISSUED_UNIT = 'mediaStream.sessionIssued';
export const MEDIA_SERVED_UNIT = 'mediaStream.served';
export const MEDIA_DENIED_UNIT = 'mediaStream.denied';

/** `details.reason` of the case-scope refusal (SEC35-16). */
export const EVIDENCE_CASE_SCOPE_REASON = 'EVIDENCE_CASE_SCOPE';
/** `details.reason` of a media answer that is not the token's (`MediaTokenRefusal`) nor the source's (`MediaSourceFailure`). */
export const NOT_A_SEALED_PACKAGE_REASON = 'NOT_A_SEALED_PACKAGE';
export const RANGE_NOT_SATISFIABLE_REASON = 'RANGE_NOT_SATISFIABLE';
/** `details.reason` of a session of the indexed view whose file has no index now (the token says a view this Core cannot build). */
export const SEEK_INDEX_NOT_AVAILABLE_REASON = 'SEEK_INDEX_NOT_AVAILABLE';
/** How many stops are remembered for the one-row rule (G94b-10). A stop is IDs and an instant. */
export const MEDIA_STOP_MEMORY_ENTRIES = 256;

/** `details`-free code of a stream that was cut because its sign-in session ended (R93-08). In the row's message and the log line. */
export const MEDIA_SESSION_ENDED_REASON = 'MEDIA_SESSION_ENDED';
/** After how many pieces of one answer the session is asked for again (R93-08). */
export const MEDIA_SESSION_CHECK_EVERY_PIECES = 8;

/** How many file plans are kept (a plan is the fragment table of one camera file: no key, no media). */
export const MEDIA_PLAN_CACHE_ENTRIES = 4;

const NOT_FOUND_TEXT = 'Evidence not found.';
const NOT_AVAILABLE_TEXT = 'No playback media is available for this evidence item.';
const NOT_AUTHENTIC_TEXT = 'This recording did not pass its integrity check and cannot be played. Verify the evidence item.';
const NOT_PERMITTED_TEXT = 'Your role does not allow this action. The attempt was audited.';
const SESSION_REFUSED_TEXT = 'This media session cannot be used. Open the recording again.';
const STORE_NOT_READY_TEXT = 'The server cannot open a media session yet. Try again shortly.';
const RANGE_TEXT = 'The requested range is outside the file.';
const SOURCE = 'mediaStream';
const STOPPED = 'Evidence media stream stopped on a fragment that did not open';
const STOPPED_AGAIN = 'Evidence media stream stopped again on a fragment whose stop is already in the audit trail';
const DENIED = 'Media session refused';
const SERVED_ROW_NOT_WRITTEN = 'the audit row of a served media range could not be written';

/** The body of operation 88. Strict: a member this server does not know is refused, not ignored. */
export const MediaSessionRequestSchema = z.strictObject({ fileId: z.enum(VIDEO_TRACK_IDS).optional(), seekIndex: z.literal(true).optional() });
const DEFAULT_FILE: PackageVideoTrackId = 'VIDEO-01';

/** What the routes are handed (the unit's index builds it from the app; a test replaces members). */
export interface MediaStreamParts {
  /** The folder of a session's sealed package, or null when the session ID is no folder name. */
  packageDirOf(sessionId: string): string | null;
  /** The ONE fragment opener of the Core (`coreFragmentOpener`). */
  readonly opener: FragmentOpener;
  /** The MAC of the media-session signing key, or null while the Core has no credential store. */
  mac(): MediaSessionMac | null;
  /** The item of that ID from the database, or null. */
  readItem(request: FastifyRequest, evidenceId: string): Promise<MediaItem | null>;
  /** Eight random bytes. */
  nonce(): Uint8Array;
  /** R93-08: true while the sign-in session of that ID is open. Asked while a long answer is in flight. */
  sessionOpen(request: FastifyRequest, sessionId: string): Promise<boolean>;
}

type Operator = Extract<Principal, { kind: 'OPERATOR' }>;

/** Thrown inside an answer in flight whose sign-in session ended: the stream is destroyed. It carries nothing. */
class SessionEnded extends Error {
  constructor() {
    super(MEDIA_SESSION_ENDED_REASON);
    this.name = 'SessionEnded';
  }
}

function operationOf(operationId: MediaStreamOperation): CoreApiRegistryOperation {
  const operation = findCoreApiOperation(operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

const evidenceNotFound = (): ApiFailure => new ApiFailure(404, ApiErrorCode.NOT_FOUND, NOT_FOUND_TEXT, { details: { simCode: 'NOT_FOUND' } });
const storeNotReady = (): ApiFailure => new ApiFailure(503, ApiErrorCode.NOT_READY, STORE_NOT_READY_TEXT, { details: { reason: CaptureDiscoveryReason.CREDENTIAL_STORE_NOT_READY } });

/** `409 MEDIA_NOT_AVAILABLE`, with why in a code; the track and the fragment when a fragment is why. */
function mediaUnavailable(reason: string, where: { readonly fileId?: string | null; readonly seq?: number | null } = {}): ApiFailure {
  const notAuthentic = reason === MediaSourceFailure.FRAGMENT_NOT_AUTHENTIC;
  return new ApiFailure(409, ApiErrorCode.MEDIA_NOT_AVAILABLE, notAuthentic ? NOT_AUTHENTIC_TEXT : NOT_AVAILABLE_TEXT, {
    details: {
      simCode: ApiErrorCode.MEDIA_NOT_AVAILABLE,
      reason,
      ...(where.fileId === undefined || where.fileId === null ? {} : { fileId: where.fileId }),
      ...(where.seq === undefined || where.seq === null ? {} : { seq: where.seq }),
    },
  });
}

/**
 * An item operation 88 opens: a REAL sealed v2 package, or (decision D205) a demonstration item the
 * seed sealed on this Core. Every other item has no sealed package here.
 */
const hasSealedPackage = (item: MediaItem): boolean => item.real || item.seedSealedDemo === true;

/** SEC35-16 (Q-SEC-1 (a)): REAL evidence is for the operator who holds the case, and for a SUPERVISOR. */
export function holdsCase(principal: Pick<Operator, 'operatorId' | 'role'>, item: Pick<MediaItem, 'investigatorId'>): boolean {
  return principal.role === OperatorRole.SUPERVISOR || (item.investigatorId !== '' && principal.operatorId === item.investigatorId);
}

/** The file a body of operation 88 asks for, and whether it asks for the indexed view (`seekIndex: true`). */
function askOfBody(body: unknown): { readonly fileId: PackageVideoTrackId; readonly seekIndex: boolean } {
  // An empty body counts as `{}` on this server (`plugins/error-envelope`): both are "no file named".
  if (body === undefined || body === null) return { fileId: DEFAULT_FILE, seekIndex: false };
  const parsed = MediaSessionRequestSchema.safeParse(body);
  if (!parsed.success) throw invalidInput('body');
  return { fileId: parsed.data.fileId ?? DEFAULT_FILE, seekIndex: parsed.data.seekIndex === true };
}

/** What the module registers its two routes with. */
export interface MediaStreamService {
  /** The registry entry of operation 88. */
  readonly operation: CoreApiRegistryOperation;
  /** The path parameters of operation 88: `{ id }`, held to the registry's pattern. */
  readonly sessionParams: z.ZodObject<{ id: z.ZodString }>;
  /** Operation 88. Sets the status 201 and returns the body. */
  createSession(request: FastifyRequest, evidenceId: string, reply: FastifyReply): Promise<EvidenceMediaSessionBody>;
  /** The media route: answers the range as a stream, or throws the refusal. */
  serve(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply>;
}

/** Builds the handlers of operation 88 and of the media route for one app. */
export function createMediaStreamService(app: FastifyInstance, parts: () => MediaStreamParts): MediaStreamService {
  const operation = operationOf(OPERATION_ID);
  const idPattern = operation.pathParam?.pattern;
  if (idPattern === undefined) throw new Error(`the registry gives ${OPERATION_ID} no path parameter`);

  // ── What both routes share ───────────────────────────────────────────────────────────────────

  /** One row in a unit of its own, committed when this resolves. */
  const append = (label: string, entry: AuditEntry): Promise<unknown> => app.pipeline.run(label, async (unit) => void (await unit.audit.append(entry)));

  /**
   * An audited refusal: a place in the denial budget first (from the 21st refusal of the caller in
   * 60 s it answers 429 and writes nothing), then ONE `ACCESS_DENIED` row, committed before the
   * answer. `evidenceId` only where it is a fact of the server (never a claim of an unverified token).
   */
  async function refuse(request: FastifyRequest, principal: Operator, why: { readonly reason?: string; readonly permission?: Permission; readonly evidenceId?: string }): Promise<never> {
    await app.denialBudget.consume(request);
    const named = {
      operationId: OPERATION_ID,
      ...(why.permission === undefined ? {} : { permission: why.permission }),
      role: principal.role,
      ...(why.reason === undefined ? {} : { reason: why.reason }),
    };
    await append(MEDIA_DENIED_UNIT, {
      type: AuditType.ACCESS_DENIED,
      severity: Severity.WARNING,
      message: `Access denied: ${why.reason ?? `role ${principal.role} lacks ${why.permission ?? Permission.EVIDENCE_VIEW}`} (${OPERATION_ID})`,
      actorId: principal.operatorId,
      deviceId: principal.deviceId,
      ...(why.evidenceId === undefined ? {} : { evidenceId: why.evidenceId }),
      details: named,
    });
    request.log.warn({ code: ApiErrorCode.NOT_PERMITTED, source: SOURCE, operationId: OPERATION_ID, principal: principalReference(principal), refusedBy: why.reason ?? Permission.EVIDENCE_VIEW, audited: true }, DENIED);
    throw new ApiFailure(403, ApiErrorCode.NOT_PERMITTED, why.reason === MediaTokenRefusal.INVALID ? SESSION_REFUSED_TEXT : NOT_PERMITTED_TEXT, { details: named });
  }

  /** The case scope of REAL evidence. Resolves for a caller inside it; refuses, audited, otherwise. */
  async function holdScope(request: FastifyRequest, principal: Operator, item: MediaItem): Promise<void> {
    // Decision D205: the scope is REAL evidence's (03_api_contract.md 2.4: "For an item whose integrity_source='REAL'").
    // A seed-sealed demonstration item is a generated test picture: every holder of EVIDENCE_VIEW may play it.
    if (!item.real || holdsCase(principal, item)) return;
    await refuse(request, principal, { reason: EVIDENCE_CASE_SCOPE_REASON, permission: Permission.EVIDENCE_VIEW, evidenceId: item.evidenceId });
  }

  const plans = new Map<string, MediaFilePlan>();
  /** G94b-10: the stops whose row is written, each until the instant it counts as the same stop. IDs and codes only. */
  const stops = new Map<string, number>();
  const portsOf = (dir: string): MediaSourcePorts => ({ reader: createPackageReader(dir), opener: parts().opener });

  /** The plan of one camera file and the ports to read it with; a `409` for a package that cannot be played. */
  async function sourceOf(item: MediaItem, fileId: PackageVideoTrackId): Promise<{ readonly ports: MediaSourcePorts; readonly plan: MediaFilePlan }> {
    const dir = parts().packageDirOf(item.sessionId);
    if (dir === null) throw mediaUnavailable(MediaSourceFailure.PACKAGE_MISSING, { fileId });
    const ports = portsOf(dir);
    // Keyed by the digest of record: an item that was sealed anew is read anew.
    const key = `${item.evidenceId}|${item.manifestSha256}|${fileId}|${dir}`;
    const known = plans.get(key);
    if (known !== undefined) return { ports, plan: known };
    let plan: MediaFilePlan;
    try {
      plan = await planMediaFile(ports, item, fileId);
    } catch (error) {
      if (error instanceof MediaSourceError) throw mediaUnavailable(error.code, { fileId });
      throw error;
    }
    if (plans.size >= MEDIA_PLAN_CACHE_ENTRIES) {
      const oldest = plans.keys().next().value;
      if (oldest !== undefined) plans.delete(oldest);
    }
    plans.set(key, plan);
    return { ports, plan };
  }

  // ── 88 createEvidenceMediaSession ────────────────────────────────────────────────────────────

  const createSession = async (request: FastifyRequest, evidenceId: string, reply: FastifyReply): Promise<EvidenceMediaSessionBody> => {
    {
      const principal = request.principal;
      // Stage 6 has refused every other caller; a session is bound to an operator all the same.
      if (principal.kind !== 'OPERATOR') throw notSignedIn();
      const { fileId, seekIndex: asksIndex } = askOfBody(request.body);
      const item = await parts().readItem(request, evidenceId);
      if (item === null) throw evidenceNotFound();
      if (!hasSealedPackage(item)) throw mediaUnavailable(NOT_A_SEALED_PACKAGE_REASON, { fileId });
      await holdScope(request, principal, item);
      const mac = parts().mac();
      if (mac === null) throw storeNotReady();
      const { plan } = await sourceOf(item, fileId);
      // The indexed view only when it was asked for AND the signed table yields an exact index.
      const indexed = asksIndex && plan.seekIndex !== null;
      if (asksIndex && !indexed) request.log.info({ code: plan.seekIndexRefusal, source: SOURCE, evidenceId: item.evidenceId, fileId }, 'No indexed view for this file: its fragment table yields no exact index');

      const expiresAt = app.clock.now() + EVIDENCE_MEDIA_SESSION_TTL_MS;
      const token = issueMediaToken({ evidenceId: item.evidenceId, fileId, expiresAt, ...(indexed ? { indexed } : {}) }, { operatorId: principal.operatorId, sessionId: principal.sessionId }, parts().nonce(), mac);
      await append(MEDIA_SESSION_ISSUED_UNIT, {
        type: AuditType.EVIDENCE_MEDIA_SERVED,
        message: `Media session opened for ${fileId}`,
        actorId: principal.operatorId,
        deviceId: principal.deviceId,
        sessionId: item.sessionId,
        evidenceId: item.evidenceId,
        details: { fileId, bytesServed: 0, signed: true, expiresAt },
      });
      request.log.info({ code: AuditType.EVIDENCE_MEDIA_SERVED, source: SOURCE, evidenceId: item.evidenceId, fileId, expiresAt, indexedView: indexed }, 'Media session opened');
      void reply.code(201);
      // Loopback only (C3 N-4): the listen host is a constant of the configuration, never a request value.
      return { evidenceId: item.evidenceId, fileId, url: `http://${app.config.host}:${app.config.port}${MEDIA_ROUTE_PREFIX}/${token}`, expiresAt, ranges: true, ...(indexed ? { seekIndex: true as const } : {}) };
    }
  };

  // ── The media route ──────────────────────────────────────────────────────────────────────────

  /**
   * The record of one answered range, made when the answer has ended (G94-06): a LOG LINE for a
   * range that was served or cut by the end of its sign-in session, and ONE AUDIT ROW only when
   * the stream stopped on the package itself (`stopped`). It cannot change the answer: a row that
   * could not be written is logged and persisted.
   */
  async function recordServed(request: FastifyRequest, principal: Operator, item: MediaItem, fileId: PackageVideoTrackId, range: { readonly start: number; readonly end: number }, served: number, stopped: MediaSourceError | null, sessionEnded = false): Promise<void> {
    if (stopped === null) {
      if (sessionEnded) request.log.info({ code: MEDIA_SESSION_ENDED_REASON, source: `${SOURCE}.serve`, evidenceId: item.evidenceId, fileId, bytesServed: served }, 'Evidence media stream stopped: its sign-in session ended');
      else request.log.debug({ code: AuditType.EVIDENCE_MEDIA_SERVED, source: `${SOURCE}.serve`, evidenceId: item.evidenceId, fileId, rangeStart: range.start, rangeEnd: range.end - 1, bytesServed: served }, 'Evidence media range served');
      return;
    }
    // G94b-10: the same stop asked for again (a player's own retries, a renewal at the same place) is a log line.
    const stopKey = [principal.operatorId, principal.sessionId, item.evidenceId, item.manifestSha256, fileId, stopped.seq ?? '?', stopped.code].join('|');
    const now = app.clock.now();
    const knownUntil = stops.get(stopKey);
    if (knownUntil !== undefined && now < knownUntil) {
      request.log.warn({ code: stopped.code, source: `${SOURCE}.serve`, evidenceId: item.evidenceId, fileId, seq: stopped.seq, bytesServed: served, repeated: true }, STOPPED_AGAIN);
      return;
    }
    // ONE STOP = ONE ROW, ALSO FOR REQUESTS THAT ARE CUT AT THE SAME MOMENT (fix wave M, re-check 94 finding G94d-02). A media
    // element asks for two ranges of one file at once; both are cut on the same fragment a few milliseconds apart. The stop is
    // therefore remembered HERE, before the write is awaited - in the same turn as the test above, so that no other request can
    // pass that test in between - and forgotten again when its row could not be written (the next request then tries again).
    for (const [key, until] of stops) if (until <= now) stops.delete(key);
    if (stops.size >= MEDIA_STOP_MEMORY_ENTRIES) {
      const oldest = stops.keys().next().value;
      if (oldest !== undefined) stops.delete(oldest);
    }
    const until = now + EVIDENCE_MEDIA_SESSION_TTL_MS;
    stops.set(stopKey, until);
    try {
      await append(MEDIA_SERVED_UNIT, {
        type: AuditType.EVIDENCE_MEDIA_SERVED,
        severity: Severity.WARNING,
        message: `Media stream stopped: ${fileId} fragment ${stopped.seq ?? '?'} (${stopped.code})`,
        actorId: principal.operatorId,
        deviceId: principal.deviceId,
        sessionId: item.sessionId,
        evidenceId: item.evidenceId,
        details: { fileId, bytesServed: served, rangeStart: range.start, rangeEnd: range.end - 1, signed: true },
      });
    } catch (error) {
      // Not in the trail: the stop is not known after all (only this request's own mark is taken back).
      if (stops.get(stopKey) === until) stops.delete(stopKey);
      request.log.error({ err: error, source: `${SOURCE}.recordServed`, evidenceId: item.evidenceId, fileId }, SERVED_ROW_NOT_WRITTEN);
      app.errorLog.append({ level: 'error', source: `${SOURCE}.recordServed`, message: SERVED_ROW_NOT_WRITTEN, ...describeError(error), context: { requestId: request.id, evidenceId: item.evidenceId, fileId } });
    }
    request.log.error({ code: stopped.code, source: `${SOURCE}.serve`, evidenceId: item.evidenceId, fileId, seq: stopped.seq, bytesServed: served }, STOPPED);
    app.errorLog.append({ level: 'error', source: `${SOURCE}.serve`, message: STOPPED, code: stopped.code, context: { requestId: request.id, evidenceId: item.evidenceId, fileId, seq: stopped.seq } });
  }

  const serve = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    {
      if (request.principal.kind !== 'OPERATOR') throw notSignedIn();
      const principal: Operator = request.principal;
      const mac = parts().mac();
      if (mac === null) throw storeNotReady();

      const params: unknown = request.params;
      const token: unknown = typeof params === 'object' && params !== null && 'token' in params ? params.token : undefined;
      const reading = typeof token === 'string' && MEDIA_TOKEN_PATTERN.test(token) ? readMediaToken(token, { operatorId: principal.operatorId, sessionId: principal.sessionId }, app.clock.now(), mac) : ({ ok: false, refusal: MediaTokenRefusal.INVALID } as const);
      if (!reading.ok) {
        if (reading.refusal === MediaTokenRefusal.EXPIRED) {
          throw new ApiFailure(403, ApiErrorCode.NOT_PERMITTED, SESSION_REFUSED_TEXT, { details: { operationId: OPERATION_ID, reason: MediaTokenRefusal.EXPIRED } });
        }
        return refuse(request, principal, { reason: MediaTokenRefusal.INVALID });
      }
      const { evidenceId, fileId } = reading.claims;

      // The role is read from the database for THIS request (stage 4): a permission taken away
      // since the session was issued is gone here too.
      if (!principal.permissions.includes(Permission.EVIDENCE_VIEW)) return refuse(request, principal, { permission: Permission.EVIDENCE_VIEW, evidenceId });
      const found = await parts().readItem(request, evidenceId);
      if (found === null || !hasSealedPackage(found)) throw mediaUnavailable(NOT_A_SEALED_PACKAGE_REASON, { fileId });
      const item: MediaItem = found;
      await holdScope(request, principal, item);
      const { ports, plan } = await sourceOf(item, fileId);

      // Z1: the view is the token's claim. A session of the indexed view is never answered with
      // the plain file (its offsets are others): no index now = no media for this session.
      const index = reading.claims.indexed === true ? plan.seekIndex : null;
      if (reading.claims.indexed === true && index === null) throw mediaUnavailable(SEEK_INDEX_NOT_AVAILABLE_REASON, { fileId });
      const size = index === null ? plan.size : indexedViewSize(plan.size, index);

      const decision = decideRange(request.headers.range, size);
      if (decision.kind === 'UNSATISFIABLE') {
        throw new ApiFailure(416, ApiErrorCode.INVALID_INPUT, RANGE_TEXT, { details: { reason: RANGE_NOT_SATISFIABLE_REASON }, headers: { 'accept-ranges': 'bytes', 'content-range': unsatisfiedRangeOf(size) } });
      }
      /** What is sent, in the offsets of what this session serves (the view's on an indexed session). */
      const wire = { start: decision.start, end: decision.end };
      /** The same stretch in the offsets of the SEALED FILE: what a log line and an audit row name. */
      const range = index === null ? wire : { start: fileOffsetOfViewOffset(index, wire.start), end: fileOffsetOfViewOffset(index, wire.end) };

      // The first piece BEFORE the status line: a range whose first fragment does not authenticate
      // gets a clean refusal, with its row, and not one byte.
      const pieces = index === null ? readPlain(ports, plan, wire) : readIndexedView(ports, plan, index, wire);
      let first: IteratorResult<Buffer, void>;
      try {
        first = await pieces.next();
      } catch (error) {
        if (!(error instanceof MediaSourceError)) throw error;
        await recordServed(request, principal, item, fileId, range, 0, error);
        throw mediaUnavailable(error.code, { fileId, seq: error.seq });
      }

      async function* body(): AsyncGenerator<Buffer, void, undefined> {
        let served = 0;
        let stopped: MediaSourceError | null = null;
        let sessionEnded = false;
        try {
          if (first.done !== true) {
            served += first.value.byteLength;
            yield first.value;
            let sent = 1;
            for await (const piece of pieces) {
              // R93-08: an answer in flight ends with its sign-in session. A read that fails cuts too.
              if (sent % MEDIA_SESSION_CHECK_EVERY_PIECES === 0 && !(await parts().sessionOpen(request, principal.sessionId).catch(() => false))) {
                sessionEnded = true;
                throw new SessionEnded();
              }
              served += piece.byteLength;
              yield piece;
              sent += 1;
            }
          }
        } catch (error) {
          if (error instanceof SessionEnded) throw error;
          // The stream ends here: the connection is destroyed by the server's stream handling, and
          // the client holds fewer bytes than the length it was told.
          stopped = error instanceof MediaSourceError ? error : new MediaSourceError(MediaSourceFailure.FRAGMENT_NOT_OPENED, { trackId: fileId });
          throw stopped;
        } finally {
          await recordServed(request, principal, item, fileId, range, served, stopped, sessionEnded);
        }
      }

      void reply.code(decision.kind === 'PARTIAL' ? 206 : 200);
      void reply.headers({
        'content-type': CAMERA_FILE_MEDIA_TYPE,
        'accept-ranges': 'bytes',
        'content-length': String(wire.end - wire.start),
        ...(decision.kind === 'PARTIAL' ? { 'content-range': contentRangeOf(wire, size) } : {}),
      });
      return reply.send(Readable.from(body(), { objectMode: false }));
    }
  };

  return { operation, sessionParams: z.object({ id: z.string().regex(idPattern) }), createSession, serve };
}
