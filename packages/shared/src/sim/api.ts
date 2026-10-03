/**
 * Simulated REST handlers for the 9 §21.2 endpoints (masterplan/01_specs.md §14.7 `api.ts`,
 * §14.9 `simAwareFetch`; AC-58).
 *
 * `handleSimApiRequest(sim, { method, path, body })` → `{ status, headers, body }`:
 * - every response carries `x-dems-simulated: 1` and `content-type: application/json`;
 * - the signed-in operator is the caller (export follows the role: INVESTIGATOR 403 plus an
 *   EXPORT_DENIED audit row, SUPERVISOR 202 plus EVIDENCE_EXPORTED);
 * - times are ISO-8601 at UTC+07:00 (D28/Q2), plus epoch-ms `…Ms` fields where a client
 *   computes with them;
 * - errors use `{ error: { code, message } }`.
 *
 * `GET /api/v1/health` is LIVE (mock-core) and is not handled here (404).
 * The body types below are the contract for step 33's OpenAPI schemas.
 */
import { SessionState, type AudioTrackId, type VideoTrackId } from '../domain';
import { toWibIso } from './clock';
import { findOperatorById, roleHas } from './auth';
import { describeError, SimErrorCode, SimNotFoundError, SimPermissionError, SimTransitionError } from './errors';
import { isSessionActive, signedInOperatorId, validateSessionInput } from './session-machine';
import { selectElapsedMs, selectSystemState, storageSummary } from './selectors';
import type { SimStore } from './store';
import type {
  ActiveSession,
  EpochMs,
  ExportResult,
  SessionCreateInput,
  SimActions,
  SimApiRequest,
  SimApiResponse,
  SimClock,
  SimState,
} from './types';
import { Permission, type SystemState } from './vocabulary';

export const SIM_API_HEADERS = {
  'content-type': 'application/json',
  'x-dems-simulated': '1',
} as const;

/** The 9 simulated operations (method, OpenAPI path template, operationId). */
export const SIM_API_ROUTES = [
  { method: 'POST', path: '/api/v1/session', operationId: 'createSession' },
  { method: 'POST', path: '/api/v1/session/{id}/start', operationId: 'startSession' },
  { method: 'POST', path: '/api/v1/session/{id}/stop', operationId: 'stopSession' },
  { method: 'GET', path: '/api/v1/session/current', operationId: 'getCurrentSession' },
  { method: 'GET', path: '/api/v1/device/health', operationId: 'getDeviceHealth' },
  { method: 'GET', path: '/api/v1/audio/status', operationId: 'getAudioStatus' },
  { method: 'GET', path: '/api/v1/video/status', operationId: 'getVideoStatus' },
  { method: 'GET', path: '/api/v1/storage/status', operationId: 'getStorageStatus' },
  { method: 'POST', path: '/api/v1/evidence/{id}/export', operationId: 'exportEvidence' },
] as const;

// ── Response bodies (the contract for the OpenAPI schemas) ──────────────────────────────

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface ApiPrecheckItem {
  id: string;
  status: string;
  value: string | null;
  reason: string | null;
}

export interface ApiSession {
  id: string;
  state: SessionState;
  caseNumber: string;
  subjectType: string;
  subjectName: string;
  investigatorId: string;
  investigatorName: string;
  room: string;
  profileId: string;
  createdAt: string;
  startedAt: string | null;
  stoppedAt: string | null;
  sealedAt: string | null;
  /** Recording time so far (clock-derived, S4). */
  elapsedMs: number;
  bytesWritten: number;
  evidenceId: string | null;
  precheck: { outcome: string | null; items: ApiPrecheckItem[] } | null;
  fault: { kind: string; at: string; fromState: string } | null;
}

export interface ApiCurrentSessionBody {
  session: ApiSession | null;
  serverTime: string;
}

export interface ApiSessionCommandBody {
  sessionId: string;
  state: SessionState;
  created?: boolean;
}

export interface ApiVideoTrack {
  trackId: VideoTrackId;
  deviceId: string;
  name: string;
  lens: string;
  online: boolean;
  recState: string | null;
  resolution: string;
  fps: number;
  codec: string;
  bitrateMbps: number;
}

export interface ApiAudioChannel {
  trackId: AudioTrackId;
  deviceId: string;
  name: string;
  state: string;
  recState: string | null;
  dbfs: number;
  peak: number;
  clip: boolean;
  noSignal: boolean;
  gainDb: number;
  phantom: boolean;
}

export interface ApiStorageStatus {
  state: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  estimatedRemainingMs: number;
  writeBytesPerSec: number;
  bitrateMbps: number;
  volumes: { id: string; kind: string; label: string; totalBytes: number; usedBytes: number }[];
  retention: { policy: string; days: number; autoArchive: boolean };
}

export interface ApiDeviceHealth {
  device: { id: string; name: string; softwareVersion: string };
  systemState: SystemState;
  flags: { id: string; severity: string; message: string }[];
  cameras: ApiVideoTrack[];
  audio: ApiAudioChannel[];
  storage: ApiStorageStatus;
  time: { source: string; locked: boolean; stratum: number; offsetMs: number; lastSyncAt: string };
  security: { state: string; posture: string; tpmOk: boolean; secureBoot: boolean; tamper: boolean };
  services: { id: string; name: string; status: string }[];
  serverTime: string;
}

export interface ApiExportBody {
  exportId: string;
  evidenceId: string;
  status: 'EXPORTED';
}

// ── Mapping helpers ──────────────────────────────────────────────────────────────────────

function iso(ms: EpochMs | null): string | null {
  return ms === null ? null : toWibIso(ms);
}

export function toApiSession(state: SimState, session: ActiveSession): ApiSession {
  return {
    id: session.id,
    state: session.state,
    caseNumber: session.input.caseNumber,
    subjectType: session.input.subjectType,
    subjectName: session.input.subjectName,
    investigatorId: session.input.investigatorId,
    investigatorName: findOperatorById(state.operators, session.input.investigatorId)?.displayName ?? '',
    room: session.input.room,
    profileId: session.input.profileId,
    createdAt: toWibIso(session.createdAt),
    startedAt: iso(session.startedAt),
    stoppedAt: iso(session.stoppedAt),
    sealedAt: iso(session.sealedAt),
    elapsedMs: selectElapsedMs({ ...state, session }),
    bytesWritten: session.bytesWritten,
    evidenceId: session.evidenceId,
    precheck:
      session.precheck.startedAt === null
        ? null
        : {
            outcome: session.precheck.outcome,
            items: session.precheck.items.map((item) => ({
              id: item.id,
              status: item.status,
              value: item.value,
              reason: item.reason,
            })),
          },
    fault: session.fault
      ? { kind: session.fault.kind, at: toWibIso(session.fault.at), fromState: session.fault.fromState }
      : null,
  };
}

function videoTracks(state: SimState): ApiVideoTrack[] {
  return state.cameras.map((camera) => ({
    trackId: camera.id,
    deviceId: camera.deviceId,
    name: camera.name,
    lens: camera.lens,
    online: camera.online,
    recState: camera.recState,
    resolution: camera.resolution,
    fps: camera.fps,
    codec: camera.codec,
    bitrateMbps: camera.bitrateMbps,
  }));
}

function audioChannels(state: SimState): ApiAudioChannel[] {
  return state.mics.map((mic) => {
    const frame = state.audio.channels[mic.id];
    return {
      trackId: mic.id,
      deviceId: mic.deviceId,
      name: mic.name,
      state: mic.state,
      recState: mic.recState,
      dbfs: frame.dbfs,
      peak: frame.peak,
      clip: frame.clip,
      noSignal: frame.noSignal,
      gainDb: mic.gainDb,
      phantom: mic.phantom,
    };
  });
}

function storageStatus(state: SimState): ApiStorageStatus {
  const summary = storageSummary(state);
  return {
    state: summary.state,
    totalBytes: summary.totalBytes,
    usedBytes: summary.usedBytes,
    freeBytes: summary.freeBytes,
    usedPercent: summary.usedPercent,
    estimatedRemainingMs: Math.round(summary.estimatedRemainingMs),
    writeBytesPerSec: state.storage.writeBytesPerSec,
    bitrateMbps: state.storage.bitrateMbps,
    volumes: state.storage.volumes.map((volume) => ({
      id: volume.id,
      kind: volume.kind,
      label: volume.label,
      totalBytes: volume.totalBytes,
      usedBytes: volume.usedBytes,
    })),
    retention: {
      policy: state.storagePolicy.retentionPolicy,
      days: state.storagePolicy.retentionDays,
      autoArchive: state.storagePolicy.autoArchive,
    },
  };
}

function deviceHealth(state: SimState, now: EpochMs): ApiDeviceHealth {
  const system = selectSystemState(state);
  return {
    device: { id: state.device.id, name: state.device.name, softwareVersion: state.device.softwareVersion },
    systemState: system.state,
    flags: system.flags.map((flag) => ({ id: flag.id, severity: flag.severity, message: flag.message })),
    cameras: videoTracks(state),
    audio: audioChannels(state),
    storage: storageStatus(state),
    time: {
      source: state.time.source,
      locked: state.time.locked,
      stratum: state.time.stratum,
      offsetMs: state.time.offsetMs,
      lastSyncAt: toWibIso(state.time.lastSyncAt),
    },
    security: {
      state: state.security.state,
      posture: state.security.posture,
      tpmOk: state.security.tpm.ok,
      secureBoot: state.security.secureBoot,
      tamper: state.security.tamper,
    },
    services: state.services.map((service) => ({ id: service.id, name: service.name, status: service.status })),
    serverTime: toWibIso(now),
  };
}

// ── Request handling ─────────────────────────────────────────────────────────────────────

export interface SimApiTarget {
  store: SimStore;
  actions: SimActions;
  clock: SimClock;
}

function respond(status: number, body: unknown, extra: Record<string, string> = {}): SimApiResponse {
  return { status, headers: { ...SIM_API_HEADERS, ...extra }, body };
}

function fail(status: number, code: string, message: string, extra?: Record<string, string>): SimApiResponse {
  return respond(status, { error: { code, message } } satisfies ApiErrorBody, extra);
}

/** Strips an origin, a query string and a trailing slash: `/api/v1/session/current`. */
export function normalizeApiPath(path: string): string {
  let value = path.trim();
  const origin = /^[a-z][a-z0-9+.-]*:\/\/[^/]+/i.exec(value);
  if (origin) value = value.slice(origin[0].length);
  const cut = value.search(/[?#]/);
  if (cut >= 0) value = value.slice(0, cut);
  if (value.length > 1 && value.endsWith('/')) value = value.slice(0, -1);
  return value || '/';
}

function parseBody(body: unknown): { ok: true; value: Record<string, unknown> } | { ok: false } {
  if (body === undefined || body === null || body === '') return { ok: true, value: {} };
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? { ok: true, value: parsed as Record<string, unknown> }
        : { ok: false };
    } catch {
      return { ok: false };
    }
  }
  return typeof body === 'object' && !Array.isArray(body) ? { ok: true, value: body as Record<string, unknown> } : { ok: false };
}

function exportFailure(result: Extract<ExportResult, { ok: false }>): SimApiResponse {
  const messages: Record<typeof result.reason, string> = {
    NOT_SIGNED_IN: 'Sign in first.',
    FORBIDDEN: 'Your role cannot export evidence (RBAC). The attempt was audited.',
    NOT_FOUND: 'Evidence not found.',
    NOT_SEALED: 'Only sealed evidence can be exported.',
    SECURITY_FAULT: 'A security fault blocks export.',
    INVALID_REASON: 'An export reason of at least 5 characters is required.',
  };
  return fail(result.status, result.reason, messages[result.reason]);
}

function currentSession(state: SimState, id: string): ActiveSession | null {
  return state.session && state.session.id === id ? state.session : null;
}

type Route = { method: 'GET' | 'POST'; pattern: RegExp; handle: (target: SimApiTarget, params: string[], body: Record<string, unknown>) => SimApiResponse };

/**
 * The session endpoints need a signed-in operator with SESSION_START (step 54, review 40 M5/M6):
 * 401 NOT_SIGNED_IN, 403 NOT_PERMITTED, else null. Runs before any other check, so a signed-out
 * caller learns nothing about the current session.
 */
function sessionAccess(state: SimState): SimApiResponse | null {
  const operator = findOperatorById(state.operators, signedInOperatorId(state));
  if (!operator) return fail(401, 'NOT_SIGNED_IN', 'Sign in first.');
  if (!roleHas(operator.role, Permission.SESSION_START)) {
    return fail(403, 'NOT_PERMITTED', 'Your role cannot control sessions (RBAC).');
  }
  return null;
}

const ROUTES: readonly Route[] = [
  {
    method: 'POST',
    pattern: /^\/api\/v1\/session$/,
    handle: ({ store, actions }, _params, body) => {
      // D62 (step 54): 401 → 403 → 422 with the documented schema → create (201 / 200 / 409).
      const denied = sessionAccess(store.getState());
      if (denied) return denied;
      const validation = validateSessionInput(body);
      if (!validation.ok) return fail(422, 'INVALID_INPUT', `${validation.path}: ${validation.message}`);
      const result = actions.createSession(body as unknown as SessionCreateInput);
      if (!result.ok) {
        const status = { SESSION_ACTIVE: 409, NOT_SIGNED_IN: 401, NOT_PERMITTED: 403, INVALID_INPUT: 422 }[result.reason];
        return fail(status, result.reason, result.sessionId ? `Session ${result.sessionId} is active.` : 'Session not created.');
      }
      const session = store.getState().session;
      return respond(result.created ? 201 : 200, {
        sessionId: result.sessionId,
        state: session?.state ?? SessionState.CREATE,
        created: result.created,
      } satisfies ApiSessionCommandBody);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/session\/current$/,
    handle: ({ store, clock }) => {
      const state = store.getState();
      return respond(200, {
        session: state.session ? toApiSession(state, state.session) : null,
        serverTime: toWibIso(clock.now()),
      } satisfies ApiCurrentSessionBody);
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/session\/([^/]+)\/start$/,
    handle: ({ store, actions }, [id = ''], body) => {
      const denied = sessionAccess(store.getState());
      if (denied) return denied;
      const session = currentSession(store.getState(), id);
      if (!session) return fail(404, 'NOT_FOUND', `Session ${id} is not the current session.`);
      switch (session.state) {
        case SessionState.CREATE:
          // "Runs Core pre-check" (§21.2): the checks resolve over the next seconds.
          actions.beginPrecheck();
          return respond(202, { sessionId: id, state: SessionState.PRECHECK } satisfies ApiSessionCommandBody);
        case SessionState.ARMED:
          actions.startRecording();
          return respond(200, { sessionId: id, state: SessionState.RECORDING } satisfies ApiSessionCommandBody);
        case SessionState.PRECHECK:
          if (session.precheck.outcome === 'WARN' && body.acknowledgeWarnings === true) {
            actions.acknowledgePrecheckWarnings();
            actions.startRecording();
            return respond(200, { sessionId: id, state: SessionState.RECORDING } satisfies ApiSessionCommandBody);
          }
          if (session.precheck.outcome === 'BLOCK') {
            const reasons = session.precheck.items.filter((item) => item.status === 'BLOCK').map((item) => item.reason ?? item.id);
            return fail(409, 'PRECHECK_BLOCKED', `Start blocked: ${reasons.join('; ')}`);
          }
          if (session.precheck.outcome === 'WARN') {
            return fail(409, 'PRECHECK_WARNINGS', 'Acknowledge the warnings: send {"acknowledgeWarnings": true}.');
          }
          return fail(409, 'PRECHECK_RUNNING', 'Pre-recording checks are still running.');
        default:
          return fail(409, 'INVALID_STATE', `Session ${id} is ${session.state}.`);
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/session\/([^/]+)\/stop$/,
    handle: ({ store, actions }, [id = ''], body) => {
      const denied = sessionAccess(store.getState());
      if (denied) return denied;
      const session = currentSession(store.getState(), id);
      if (!session) return fail(404, 'NOT_FOUND', `Session ${id} is not the current session.`);
      if (session.state !== SessionState.RECORDING) return fail(409, 'INVALID_STATE', `Session ${id} is ${session.state}.`);
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (reason.length < 5) return fail(422, 'INVALID_REASON', 'A stop reason of at least 5 characters is required.');
      actions.stopRecording(reason);
      return respond(202, { sessionId: id, state: SessionState.STOPPING } satisfies ApiSessionCommandBody);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/device\/health$/,
    handle: ({ store, clock }) => respond(200, deviceHealth(store.getState(), clock.now())),
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/audio\/status$/,
    handle: ({ store }) => respond(200, { channels: audioChannels(store.getState()) }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/video\/status$/,
    handle: ({ store }) => respond(200, { tracks: videoTracks(store.getState()) }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/storage\/status$/,
    handle: ({ store }) => respond(200, storageStatus(store.getState())),
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/evidence\/([^/]+)\/export$/,
    handle: ({ actions }, [id = ''], body) => {
      const result = actions.exportEvidence(id, {
        reason: typeof body.reason === 'string' ? body.reason : '',
        destination: typeof body.destination === 'string' ? body.destination : '',
      });
      if (!result.ok) return exportFailure(result);
      return respond(202, { exportId: result.exportId, evidenceId: id, status: 'EXPORTED' } satisfies ApiExportBody);
    },
  },
];

/** Maps a thrown simulator error to its response (step 54: machine-readable codes). */
function errorResponse(error: unknown): SimApiResponse {
  if (error instanceof SimPermissionError) {
    return error.code === SimErrorCode.NOT_SIGNED_IN
      ? fail(401, 'NOT_SIGNED_IN', 'Sign in first.')
      : fail(403, 'NOT_PERMITTED', 'Your role cannot perform this action (RBAC).');
  }
  if (error instanceof SimTransitionError) {
    if (error.code === SimErrorCode.REASON_TOO_SHORT) return fail(422, 'INVALID_REASON', error.message);
    return fail(409, 'INVALID_STATE', error.message);
  }
  if (error instanceof SimNotFoundError) return fail(404, 'NOT_FOUND', error.message);
  if (error instanceof URIError) return fail(400, 'INVALID_PATH', 'The request path is not valid percent-encoding.');
  return fail(500, 'SIMULATOR_ERROR', describeError(error).message);
}

/**
 * Answers one simulated request. Never throws (step 54, review 40 m6): a malformed path or
 * percent-encoding answers 400 INVALID_PATH, a method other than GET or POST 405 (or 404), and
 * an unexpected error a 500 (the caller, `Sim.request`, also reports it).
 */
export function handleSimApiRequest(target: SimApiTarget, request: SimApiRequest): SimApiResponse {
  try {
    if (typeof request?.path !== 'string') return fail(400, 'INVALID_PATH', 'The request path must be a string.');
    const path = normalizeApiPath(request.path);
    const method = String(request.method ?? '').toUpperCase();
    const matching = ROUTES.map((route) => ({ route, match: route.pattern.exec(path) })).filter((entry) => entry.match);
    if (matching.length === 0) return fail(404, 'NOT_FOUND', `No simulated endpoint for ${path}.`);
    const hit = matching.find((entry) => entry.route.method === method);
    if (!hit || !hit.match) {
      return fail(405, 'METHOD_NOT_ALLOWED', `${method} is not allowed on ${path}.`, {
        allow: [...new Set(matching.map((entry) => entry.route.method))].join(', '),
      });
    }
    const parsed = parseBody(request.body);
    if (!parsed.ok) return fail(400, 'INVALID_JSON', 'The request body must be a JSON object.');
    const params = hit.match.slice(1).map((value) => decodeURIComponent(value));
    return hit.route.handle(target, params, parsed.value);
  } catch (error) {
    return errorResponse(error);
  }
}

/** True while a session blocks `POST /api/v1/session` (exported for the API Reference page). */
export function hasActiveSession(state: SimState): boolean {
  return isSessionActive(state.session);
}
