/**
 * Simulated REST handlers for the 44 simulated operations: the 9 §21.2 endpoints
 * (masterplan/01_specs.md §14.7 `api.ts`, §14.9 `simAwareFetch`; AC-58) plus the 13 capture,
 * audio-source, sealing and transcript operations of schema v2 (task 3 M2-W9b, blueprint row 51a;
 * OD-17 "the simulator emulates v2" supersedes the old "simulator untouched" rule, OD-23;
 * `masterplan/03_api_contract.md` (C3) §2) plus the 3 STT configuration operations 90-92 (task 3 M6,
 * blueprint row 113; C3 §2.5; R-8) plus the 5 camera-search, connection-test, adoption and
 * local-input operations 93-97 (task 3 R-9..R-11, blueprint row 132, decision D106; C3 §2.6
 * "Simulator") plus the 2 sound-card operations 98-99 (task 4, blueprint row 63; design addendum
 * 4.2): a fixed listing of two test cards, and a registration that registers nothing; plus the
 * confirmed re-address 100 (task 4, blueprint row 194), which refuses every call, and the 7
 * commissioning operations 101-107 (task 4, blueprint row 102): synthetic answers that change nothing;
 * plus the stored-credential connection test 108 (task 4, row V3): a synthetic result, nothing changed;
 * plus the installation acceptance and its revocation 109-110 (task 4, blueprint row 116): the
 * simulator keeps no installation record, so both answer a refusal that says so and change nothing;
 * plus the retirement of a registered camera or microphone 111 (task 4, row RD2; design 07): the
 * simulator retires a device it registered itself, in its own state, with its audit row.
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
import { CAPTURE_DISCOVERY_RESULT_TTL_MS, CAPTURE_CONNECTION_TEST_MAX_FAILURES, CAPTURE_CONNECTION_TEST_VALIDITY_MS } from '../api/capture';
import {
  CaptureAudioCardReason,
  CaptureAudioInputRegisterRequestSchema,
  simCaptureAudioCards,
  type CaptureAudioCardSearch,
} from '../api/capture-audio-cards';
import {
  CAPTURE_COMMISSIONING_REFUSAL_SENTENCES,
  CameraFactoryScanRequestSchema,
  CameraNetworkSetRequestSchema,
  CaptureCommissioningReason,
  CaptureNetworkConfigUpdateRequestSchema,
  simCameraFactoryScan,
  simCaptureNetworkConfig,
  type CameraFactoryScan,
  type CaptureNetworkConfig,
  type HostAliasState,
} from '../api/capture-commissioning';
import {
  CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE,
  CAPTURE_READDRESS_REFUSAL_SENTENCES,
  CaptureCandidateAdoptRequestSchema,
  CaptureCandidateStatus,
  CaptureConnectionOutcome,
  CaptureConnectionTestRequestSchema,
  CaptureDeviceAddressConfirmRequestSchema,
  CaptureDiscoveryReason,
  CaptureReaddressReason,
  CaptureDiscoveryScope,
  CaptureDiscoveryStartRequestSchema,
  CaptureDiscoveryTrigger,
  captureCandidateAdoptedDetails,
  captureConnectionTestedDetails,
  captureDiscoverySearchedDetails,
  simCaptureCandidates,
  simCaptureDiscoverySearch,
  simTypedAddressAllowed,
  simTypedAddressCandidate,
  type CaptureCandidate,
  type CaptureCandidateAdoption,
  type CaptureConnectionTest,
  type CaptureDiscoverySearch,
  type CaptureDiscoveryStateBody,
  type CaptureInputScan,
} from '../api/capture-discovery';
import { WEB_CONSOLE_ONLY_REASON } from '../api/contract-model';
import { CaptureCredentialWriteRequestSchema } from '../api/devices';
import {
  INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES,
  InstallationAcceptRequestSchema,
  InstallationAcceptanceReason,
  InstallationAcceptanceRevokeRequestSchema,
} from '../api/installation-acceptance';
import {
  CAPTURE_RETIRE_REFUSAL_SENTENCES,
  CaptureDeviceRetireRequestSchema,
  CaptureRetireRefusalReason,
  captureDeviceRetiredDetails,
  type CaptureDeviceRetirement,
  type CaptureRetireRefusal,
} from '../api/capture-retire';
import { EXPORT_JOB_ID_PATTERN, HARDWARE_DEVICE_ID_PATTERN, MIC_INPUT_ID_PATTERN, exportJobIdOf } from '../api/patterns';
import { CAPTURE_NOT_DURABLE_REASON } from '../api/sessions';
import {
  STT_CONFIG_CHANGED_MESSAGE,
  STT_CONFIG_DEFAULT,
  STT_REVISION_CONFLICT_REASON,
  SttAppliesFrom,
  SttConfigUpdateRequestSchema,
  SttConnectionDetailCode,
  planSttConfigUpdate,
  sttChangeInvalidatesLastTest,
  sttConfigChangedDetails,
  sttCredentialKindAfter,
  type SttConfig,
  type SttConfigUpdateResult,
  type SttConfigValues,
  type SttConnectionTest,
  type SttCredentialKind,
  type SttLastTest,
} from '../api/transcription';
import { FINALIZATION_STEPS_V2, MicRole, SessionState, TrackId, VIDEO_TRACK_IDS, type VideoTrackId, type MicInputId } from '../domain';
import { MIC_CHANNEL_IDS, PRIMARY_MIC_CHANNEL, type MicChannel } from './vocabulary'; // D61 (2026-11-04): the four microphone channels
import { captureMicLines, meterInputOfChannel } from './audio';
import { selectorOfSession } from './selector-in-force';
import { SEALING_ETA_STEP_MS, SEALING_FIRST_ATTEMPT } from './constants';
import { toWibIso } from './clock';
import { findOperatorById, operatorHas, roleHas } from './auth';
import { setCaptureConfigTransition } from './capture-config';
import { RETIRE_REFUSAL, nextCaptureCameraId, registerCaptureDeviceTransition, retireCaptureDeviceTransition, selectorSlotOfDevice } from './capture-registry';
import { describeError, SimErrorCode, SimNotFoundError, SimPermissionError, SimTransitionError } from './errors';
import { canonicalJSON, recordActivity, sha256Hex } from './events';
import { SIMULATED_SIGNING_KEY_ID } from './evidence';
import { noSignalFrame } from './initial-state';
import { isSessionActive, sendingDeviceOf, signedInOperatorId, switchAudioSourceTransition, validateSessionInput } from './session-machine';
import { selectElapsedMs, selectSystemState, storageSummary } from './selectors';
import type { SimStore } from './store';
import type {
  ActiveSession,
  CaptureConfigChange,
  CaptureConfigSlice,
  CaptureDevicesSlice,
  CaptureMicInputId,
  CaptureSelectorSlot,
  EpochMs,
  EvidenceItem,
  ExportResult,
  FinalizationStepState,
  SessionCreateInput,
  SimActions,
  SimApiRequest,
  SimApiResponse,
  SimClock,
  SimState,
  TranscriptRevisionChange,
  TranscriptRevisionRecord,
} from './types';
import { AuditType, CaptureStreamState, OperatorRole, Permission, StepStatus, type SystemState } from './vocabulary';

export const SIM_API_HEADERS = {
  'content-type': 'application/json',
  'x-dems-simulated': '1',
} as const;

/** One entry of `SIM_API_ROUTES`: the method, the OpenAPI path template and the operationId it answers. */
export interface SimApiRoute {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly operationId: string;
}

/**
 * The simulated operations (method, OpenAPI path template, operationId): the nine of book §21.2
 * followed by the thirteen of schema v2 (ops 76-87 and 89, C3 §2.2), the three of the STT
 * configuration (90-92), the five of the camera search (93-97) and the two of the sound cards
 * (98-99; task 4, blueprint row 63), in registry order. Op 88
 * (`createEvidenceMediaSession`) is LIVE-only and is deliberately absent: Simulated mode plays the
 * bundled demo media instead (C3 §2.4). The set is pinned against the registry's `mode: 'simulated'`
 * operations by `test/openapi.test.ts`.
 */
export const SIM_API_ROUTES: readonly SimApiRoute[] = [
  { method: 'POST', path: '/api/v1/session', operationId: 'createSession' },
  { method: 'POST', path: '/api/v1/session/{id}/start', operationId: 'startSession' },
  { method: 'POST', path: '/api/v1/session/{id}/stop', operationId: 'stopSession' },
  { method: 'GET', path: '/api/v1/session/current', operationId: 'getCurrentSession' },
  { method: 'GET', path: '/api/v1/device/health', operationId: 'getDeviceHealth' },
  { method: 'GET', path: '/api/v1/audio/status', operationId: 'getAudioStatus' },
  { method: 'GET', path: '/api/v1/video/status', operationId: 'getVideoStatus' },
  { method: 'GET', path: '/api/v1/storage/status', operationId: 'getStorageStatus' },
  { method: 'POST', path: '/api/v1/evidence/{id}/export', operationId: 'exportEvidence' },
  // ── Schema v2 (OD-17; C3 §2.2 ops 76-87, 89) ──
  { method: 'GET', path: '/api/v1/capture/config', operationId: 'getCaptureConfig' },
  { method: 'GET', path: '/api/v1/capture/devices', operationId: 'getCaptureDevices' },
  { method: 'POST', path: '/api/v1/capture/config', operationId: 'updateCaptureConfig' },
  { method: 'POST', path: '/api/v1/capture/cameras/{id}/source', operationId: 'setCaptureCameraSource' },
  { method: 'POST', path: '/api/v1/capture/mics/{id}/primary', operationId: 'setPrimaryMic' },
  { method: 'POST', path: '/api/v1/session/{id}/audio-source', operationId: 'switchAudioSource' },
  { method: 'GET', path: '/api/v1/session/{id}/audio-source', operationId: 'listAudioSourceIntervals' },
  { method: 'GET', path: '/api/v1/session/{id}/sealing', operationId: 'getSealingProgress' },
  { method: 'GET', path: '/api/v1/evidence/{id}/transcript', operationId: 'getTranscript' },
  { method: 'POST', path: '/api/v1/evidence/{id}/transcript/revisions', operationId: 'createTranscriptRevision' },
  { method: 'GET', path: '/api/v1/evidence/{id}/transcript/revisions', operationId: 'listTranscriptRevisions' },
  { method: 'GET', path: '/api/v1/evidence/exports/{id}', operationId: 'getEvidenceExportJob' },
  { method: 'POST', path: '/api/v1/capture/devices/{id}/credential', operationId: 'setCaptureDeviceCredential' },
  // ── STT configuration (task 3 M6, blueprint row 113; C3 §2.5 ops 90-92; R-8) ──
  { method: 'GET', path: '/api/v1/transcription/config', operationId: 'getSttConfig' },
  { method: 'POST', path: '/api/v1/transcription/config', operationId: 'updateSttConfig' },
  { method: 'POST', path: '/api/v1/transcription/config/test', operationId: 'testSttConnection' },
  // ── Camera search, connection test, adoption, local inputs (task 3 R-9..R-11, row 132; C3 §2.6 ops 93-97) ──
  { method: 'POST', path: '/api/v1/capture/discovery', operationId: 'startCaptureDiscovery' },
  { method: 'GET', path: '/api/v1/capture/discovery', operationId: 'getCaptureDiscovery' },
  { method: 'POST', path: '/api/v1/capture/discovery/candidates/{id}/test', operationId: 'testCaptureCandidateConnection' },
  { method: 'POST', path: '/api/v1/capture/discovery/candidates/{id}/adopt', operationId: 'adoptCaptureCandidate' },
  { method: 'POST', path: '/api/v1/capture/inputs/rescan', operationId: 'rescanCaptureInputs' },
  // ── Sound cards: the listing and the registration of an input (task 4, blueprint row 63; design addendum 4.2; ops 98-99) ──
  { method: 'POST', path: '/api/v1/capture/audio-cards/search', operationId: 'searchCaptureAudioCards' },
  { method: 'POST', path: '/api/v1/capture/audio-cards/inputs', operationId: 'registerCaptureAudioInput' },
  // ── The operator-confirmed re-address of a registered camera (task 4, blueprint row 194; WP-12; op 100) ──
  { method: 'POST', path: '/api/v1/capture/devices/address/confirm', operationId: 'confirmCaptureDeviceAddress' },
  // ── The commissioning functions of the camera network (task 4, blueprint row 102; WP-23b; ops 101-107) ──
  { method: 'GET', path: '/api/v1/capture/network/config', operationId: 'getCaptureNetworkConfig' },
  { method: 'POST', path: '/api/v1/capture/network/config', operationId: 'updateCaptureNetworkConfig' },
  { method: 'POST', path: '/api/v1/capture/network/scan', operationId: 'scanFactoryCameras' },
  { method: 'GET', path: '/api/v1/capture/network/alias', operationId: 'getHostAlias' },
  { method: 'POST', path: '/api/v1/capture/network/alias/remove', operationId: 'removeHostAlias' },
  { method: 'POST', path: '/api/v1/capture/network/cameras/address', operationId: 'setCameraNetwork' },
  { method: 'GET', path: '/api/v1/capture/network/jobs/{id}', operationId: 'getCameraNetworkJob' },
  // ── The connection test of a registered camera with its stored credential (task 4, row V3; blueprint row 146; op 108) ──
  { method: 'POST', path: '/api/v1/capture/devices/{id}/test', operationId: 'testCaptureDeviceConnection' },
  // ── The installation acceptance and its revocation (task 4, blueprint row 116; WP-26b; ops 109-110) ──
  { method: 'POST', path: '/api/v1/installation/acceptance', operationId: 'acceptInstallation' },
  { method: 'POST', path: '/api/v1/installation/acceptance/revoke', operationId: 'revokeInstallationAcceptance' },
  // ── The retirement of a registered camera or microphone (task 4, row RD2; design 07; op 111) ──
  { method: 'POST', path: '/api/v1/capture/devices/{id}/retire', operationId: 'retireCaptureDevice' },
];


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
  /** As the `session` slice says it: `false` while the cameras connect, `true` where a Core's real capture states it; absent reads as durable. */
  captureDurable?: boolean;
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
  /**
   * Schema v2 (SH-05; C3 §3 ops 44/46): the capture device the selector assigns to this track.
   * `null`: the track holds no source - its selector slot is unassigned (task 4 row 165; register E39).
   */
  sourceDeviceId: string | null;
  /** Schema v2 (C3 §3 ops 44/46; OD-22): LIVE or LOST. Null (row V7d; C126 (b)): NOT READ - the selector line says so, or the track has no line. */
  streamState: CaptureStreamState | null;
  name: string;
  lens: string;
  online: boolean;
  recState: string | null;
  /** Null (row V6, S-01): no stream statement is stored for the track. Never a default. */
  resolution: string | null;
  /** Null: the stream states no rate. */
  fps: number | null;
  /** Null (row V6, S-01): no stream statement is stored for the track. Never a default. */
  codec: string | null;
  /** Null (pass I-9b; row W4, R-01): no telemetry states a bitrate for the track. Never a default. */
  bitrateMbps: number | null;
}

/**
 * One microphone INPUT of the v2 reads (SH-15/SH-17; C3 §3 op 45). The v1 entry named a channel
 * (`AUDIO-01`/`AUDIO-02`); v2 names the input (`MIC-NN`) and carries the selector CHANNEL it
 * stands on (D61 of 2026-11-04: four simultaneous channels; the OD-01 T1 role inside `AUDIO-01`
 * is superseded — channel 1 keeps the transcription duty). The meters slice is keyed the same way since SH-17.
 */
export interface ApiAudioChannel {
  inputId: CaptureMicInputId;
  deviceId: string;
  name: string;
  /** D61 (2026-11-04): the selector channel this input stands on; channel 1 feeds the transcribed AUDIO-01. */
  channel: MicChannel;
  state: string;
  recState: string | null;
  dbfs: number;
  peak: number;
  clip: boolean;
  noSignal: boolean;
  /** Fix wave J (JW-08): the level is not measured now (`AudioFrame.notMeasured`). */
  notMeasured?: true;
  gainDb: number;
  phantom: boolean;
}

/**
 * Response of `GET /api/v1/audio/status` (schema v2: the inputs plus the active one).
 * `channels`: one entry per meter channel that HAS an input - two on a complete selector, none
 * while the selector holds no complete microphone pair (an entry IS an input; register E40, D-2).
 * `activeInputId`: `null` when no microphone line in force is the active input.
 */
export interface ApiAudioStatus {
  channels: ApiAudioChannel[];
  activeInputId: CaptureMicInputId | null;
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
  /** Schema v2 (C3 §3 op 44): the input feeding `AUDIO-01` right now. `null`: no microphone line in force is the active input. */
  activeInputId: CaptureMicInputId | null;
  storage: ApiStorageStatus;
  time: { source: string; locked: boolean; stratum: number; offsetMs: number; lastSyncAt: string };
  security: { state: string; posture: string; tpmOk: boolean; secureBoot: boolean; tamper: boolean; platformNotReported?: true };
  services: { id: string; name: string; status: string }[];
  serverTime: string;
}

/**
 * Response of `POST /api/v1/evidence/{id}/export` (op 42). Schema v2 (C3 §3 op 42): the answer means
 * "the job is queued"; op 87 (`GET /api/v1/evidence/exports/{id}`) polls it to completion. The
 * evidence item's own status stays `EXPORTED` — that is the item lifecycle, not the job state.
 */
export interface ApiExportBody {
  exportId: string;
  evidenceId: string;
  status: 'QUEUED';
  /** The job op 87 polls: `EXPJ-` and the six digits of `exportId` (ruling D140). */
  jobId?: string;
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
    // Exactly as the replicated `session` slice says it (pass D11; decision D10-2): explicit `false`
    // while the cameras connect, explicit `true` where a Core's real capture states it, ABSENT
    // otherwise (absent reads as durable in the simulator's own capture). Never invented here.
    ...(session.captureDurable === undefined ? {} : { captureDurable: session.captureDurable }),
  };
}

function videoTracks(state: SimState): ApiVideoTrack[] {
  return state.cameras.map((camera) => {
    // Schema v2 (SH-05/SH-12): the selector names the device behind each track and carries its
    // stream state; a fault that drops the stream flips it to LOST (OD-22 makes op 48 legal then).
    // The line is found BY ITS TRACK. A track without a line has NO source (task 4 row 165; site
    // C23): `null`, never the built-in camera of that track.
    // Row V7d (C126 (b)): the stream state is the LINE's - null (NOT READ) included - and null for a
    // track without a line; never the hardware slice's `online` flag in its place.
    const slot = state.captureConfig.cameras.find((entry) => entry.trackId === camera.id);
    return {
      trackId: camera.id,
      deviceId: camera.deviceId,
      sourceDeviceId: slot?.deviceId ?? null,
      streamState: slot?.streamState ?? null,
      name: camera.name,
      lens: camera.lens,
      online: camera.online,
      recState: camera.recState,
      resolution: camera.resolution,
      fps: camera.fps,
      codec: camera.codec,
      bitrateMbps: camera.bitrateMbps,
    };
  });
}

function audioInputs(state: SimState): ApiAudioChannel[] {
  const lines = captureMicLines(state);
  return state.mics.flatMap((mic): ApiAudioChannel[] => {
    // Schema v2 (SH-15/SH-17): the read is keyed by the microphone INPUT, never by a track, and
    // names the selector CHANNEL the line holds (D61 of 2026-11-04: four simultaneous channels;
    // the PRIMARY/STANDBY role of OD-01 T1 is superseded). The input of a
    // meter channel is its microphone line of the capture configuration (ruling D137 generalized).
    // A channel WITHOUT an input gives NO entry (task 4 row 165; site C24; register E40, D-2): an
    // entry IS an input, so nothing states an input, a device or a channel for a channel without a
    // line - never a built-in input, never the channel of the hardware slice.
    const inputId = meterInputOfChannel(lines, mic.id);
    const line = inputId === null ? undefined : lines.find((entry) => entry.inputId === inputId);
    if (inputId === null || line === undefined) return [];
    // An input without a frame yet reads NO SIGNAL.
    const frame = state.audio.inputs[inputId] ?? noSignalFrame(0);
    return [{
      inputId,
      deviceId: line.deviceId,
      name: mic.name,
      channel: line.channel,
      state: mic.state,
      recState: mic.recState,
      dbfs: frame.dbfs,
      peak: frame.peak,
      clip: frame.clip,
      noSignal: frame.noSignal,
      ...(frame.notMeasured === true ? { notMeasured: true as const } : {}),
      gainDb: mic.gainDb,
      phantom: mic.phantom,
    }];
  });
}

/**
 * The input feeding `AUDIO-01`, as operations 44 and 45 answer it (task 4 row 165; seam readers 5
 * and 6 of row 28): the meters' active input while it IS a microphone line in force, else `null`.
 * An input no line holds is not answered as active; the state itself holds `null` once the
 * selector has lost its PRIMARY line (task 4 row 149).
 */
function activeInputOf(state: SimState): CaptureMicInputId | null {
  const active = state.audio.activeInputId;
  if (active === null) return null;
  return captureMicLines(state).some((line) => line.inputId === active) ? active : null;
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
    audio: audioInputs(state),
    activeInputId: activeInputOf(state),
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
      // Fix wave J (JW-04 / JT-03): the statement of the slice, on this answer too (absent on the simulated device).
      ...(state.security.platformNotReported === true ? { platformNotReported: true as const } : {}),
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
  /**
   * True when this simulator runs inside a tablet or phone app (`CreateSimOptions.deviceConsole`):
   * the operator's session is then "bound to a paired device", and the three operations that carry
   * a camera credential (89, 95, 96) answer `403 NOT_PERMITTED` with `details.reason:
   * WEB_CONSOLE_ONLY`, as the Core server does (C3 §2.6 "Simulator"; D80(3)). So do the two
   * sound-card operations (98, 99; task 4 row 63). Default false: the web console.
   */
  deviceConsole?: boolean;
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
    // Pass D6: a member of the union since the Core answers it; the simulator's own action never returns it.
    EXPORT_IN_PROGRESS: 'An export job is already running for this evidence item.',
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

// ── Schema v2: the simulated capture paths (task 3 M2-W9b, blueprint row 51a; OD-17; C3 §2) ─────
//
// OD-17 (D4) retires the old "simulator untouched" rule (OD-23): in Simulated mode the client calls
// these operations inside its own simulator, so the answers below are built from the same slices the
// Core server replicates (`captureConfig`, `captureDevices`, the session `finalization`, the evidence
// item) and never from invented data. Where the simulator has no data for an operation it answers the
// documented refusal (409 TRANSCRIPT_NOT_READY, 404) instead of fabricating a body (D-EV-1).

/** Ops 76/78/79/80/89 answer with the `captureConfig` slice in its wire form (API-6). */
export type ApiCaptureConfig = CaptureConfigSlice;

/** Op 77 answers with the `captureDevices` slice in its wire form (API-6; carries no credential, RK-12). */
export type ApiCaptureDevices = CaptureDevicesSlice;

/** Op 81 answer: the new active/standby pair (E-13: Core instants and media pts only). */
export interface ApiAudioSourceState {
  sessionId: string;
  activeInputId: CaptureMicInputId;
  standbyInputId: CaptureMicInputId;
  switchedAt: EpochMs;
  intervalFromMs: number;
}

/** One row of op 82's page (`session_audio_intervals`, `dbc-3 §B.5`). */
export interface ApiAudioSourceInterval {
  sessionId: string;
  seq: number;
  inputId: CaptureMicInputId;
  role: MicRole;
  fromMs: number;
  toMs: number | null;
  fromAt: EpochMs;
  toAt: EpochMs | null;
  switchedBy: string | null;
  reason: 'START' | 'MANUAL' | 'STOP';
}

/** Op 83 answer: one v2 sealing step as the progress read reports it. */
export interface ApiSealingStep {
  id: FinalizationStepState['id'];
  status: FinalizationStepState['status'];
  startedAt: EpochMs | null;
  completedAt: EpochMs | null;
  durationMs: number | null;
}

/** Op 83 answer: the v2 finalization progress of the session (E-13 forward-only). */
export interface ApiSealingProgress {
  sessionId: string;
  state: SessionState;
  steps: ApiSealingStep[];
  progressPct: number;
  etaMs: number | null;
  resumed: boolean;
  updatedAt: EpochMs;
}

/** Op 84 answer: the canonical transcript document view of a sealed item (`dems.transcript/1`). */
export interface ApiTranscriptDocument {
  documentVersion: 'dems.transcript/1';
  language: 'id';
  speakerState: 'LABELLED' | 'UNAVAILABLE';
  segments: { index: number; startMs: number; endMs: number; text: string; speaker: string | null }[];
  sha256: string;
  machineTranscriptHash: string;
  assembledAt: EpochMs;
  revision: number;
}

/** Op 85/86 answer: one appended, signed revision (append-only; OD-15). */
export type ApiTranscriptRevision = TranscriptRevisionRecord;

/** Op 87 answer: the background export job op 42 queued (NM-12). */
export interface ApiExportJob {
  jobId: string;
  evidenceId: string;
  kind: 'PACKAGE' | 'COMPOSITE';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETE' | 'FAILED';
  progressPct: number;
  etaMs: number | null;
  manifestHash?: string;
  signature?: string;
  derived: boolean;
  createdAt: EpochMs;
  completedAt?: EpochMs;
}

/** The signed-in operator of this request, or null when nobody is signed in. */
function operatorOf(state: SimState) {
  return findOperatorById(state.operators, signedInOperatorId(state));
}

/** 401 when no operator is signed in; every simulated read of C3 §2.2 needs one. */
function requireOperator(state: SimState): SimApiResponse | null {
  return operatorOf(state) ? null : fail(401, 'NOT_SIGNED_IN', 'Sign in first.');
}

/** 401 when no operator is signed in; 403 when the role lacks `permission`; null when both pass. */
function capabilityRefusal(state: SimState, permission: Permission, deniedMessage: string): SimApiResponse | null {
  const operator = operatorOf(state);
  if (!operator) return fail(401, 'NOT_SIGNED_IN', 'Sign in first.');
  // D55: the check is per ACCOUNT, not per role - the vendor root holds CAPTURE_CONFIG by identity.
  if (!operatorHas(operator, permission)) return fail(403, 'NOT_PERMITTED', deniedMessage);
  return null;
}

/** The slice of op 76: the selector with `locked` recomputed from the open session (OD-10). */
function captureConfigBody(state: SimState): ApiCaptureConfig {
  return { ...state.captureConfig, locked: hasActiveSession(state) };
}

/** 409 CAPTURE_CONFIG_LOCKED while a session is open. SEC35-19: this refusal writes NO audit row. */
function captureLockedRefusal(state: SimState): SimApiResponse | null {
  return hasActiveSession(state)
    ? fail(409, 'CAPTURE_CONFIG_LOCKED', 'The capture configuration cannot be changed while a session is open.')
    : null;
}

/** True for API-13 text: trimmed, non-empty, within `max` characters, no NUL. */
function isCode(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max && !value.includes('\u0000');
}

/** One camera line of the op 78 body. */
interface CaptureCameraLine {
  trackId: VideoTrackId;
  deviceId: string;
  profile?: string;
}

/** One mic line of the op 78 body. */
interface CaptureMicLine {
  inputId: string;
  deviceId: string;
  transport?: string;
  /** BY CHANNEL (D133 (1) generalized by D61 of 2026-11-04): present on every line or on none; the lines are the replacing set. */
  channel?: MicChannel;
}

type BodyCheck = { ok: true } | { ok: false; path: string; message: string };

/** The EIGHT slots `unassign` may name (D61, 2026-11-04): the four video tracks and the four microphone channels (the contract's `CAPTURE_SELECTOR_SLOTS`; held equal by a test). */
const UNASSIGNABLE_SLOTS: readonly CaptureSelectorSlot[] = [TrackId.VIDEO_01, TrackId.VIDEO_02, TrackId.VIDEO_03, TrackId.VIDEO_04, ...MIC_CHANNEL_IDS];

/**
 * Validates the op 78 body against `CaptureConfigUpdateRequest` (C3 §2.3): partial, strict, bounded.
 *
 * `unassign` (task 4 row 165; site C25 of row 27; names register N1 and section 4.3; AD-10 (3)):
 * the slots the edit clears - a list of one to EIGHT of the eight slot names (D61 of 2026-11-04:
 * the two microphone roles became the four numbered channels; was six, D60), no slot twice, and no
 * slot that the same body assigns (the `trackId` of a camera line, the `channel` of a mic line). Every
 * refusal of the member is on the path `unassign`, as the contract's schema has it.
 */
function checkCaptureConfigUpdate(body: Record<string, unknown>): BodyCheck & { cameras?: CaptureCameraLine[]; mics?: CaptureMicLine[]; unassign?: CaptureSelectorSlot[] } {
  const unknownKey = Object.keys(body).find((key) => key !== 'cameras' && key !== 'mics' && key !== 'unassign');
  if (unknownKey !== undefined) return { ok: false, path: unknownKey, message: 'Unknown member: only `cameras`, `mics` and `unassign` may be sent.' };
  const cameras: CaptureCameraLine[] = [];
  const mics: CaptureMicLine[] = [];
  const unassign: CaptureSelectorSlot[] = [];
  if (body.unassign !== undefined) {
    if (!Array.isArray(body.unassign) || body.unassign.length < 1 || body.unassign.length > UNASSIGNABLE_SLOTS.length) {
      // D61 (2026-11-04): one to EIGHT slots (the contract's `CaptureConfigUpdateRequest.unassign`, `.max(8)`); was six (D60), was four.
      return { ok: false, path: 'unassign', message: 'Expected 1 to 8 selector slots.' }; // D61
    }
    for (const entry of body.unassign) {
      const slot = UNASSIGNABLE_SLOTS.find((candidate) => candidate === entry);
      if (slot === undefined) return { ok: false, path: 'unassign', message: 'Expected VIDEO-01 to VIDEO-04 or MIC-01 to MIC-04.' }; // D61: the role words are no longer slots
      if (unassign.includes(slot)) return { ok: false, path: 'unassign', message: 'A slot is named at most once.' };
      unassign.push(slot);
    }
  }
  if (body.cameras !== undefined) {
    if (!Array.isArray(body.cameras) || body.cameras.length < 1 || body.cameras.length > VIDEO_TRACK_IDS.length) { // D60 (2026-11-04): four video tracks
      return { ok: false, path: 'cameras', message: 'Expected 1 to 4 camera lines.' }; // D60
    }
    for (const [index, line] of body.cameras.entries()) {
      const item = typeof line === 'object' && line !== null ? (line as Record<string, unknown>) : null;
      if (!item) return { ok: false, path: `cameras.${index}`, message: 'Expected an object.' };
      const extra = Object.keys(item).find((key) => key !== 'trackId' && key !== 'deviceId' && key !== 'profile');
      if (extra !== undefined) return { ok: false, path: `cameras.${index}.${extra}`, message: 'Unknown member.' };
      if (!VIDEO_TRACK_IDS.includes(item.trackId as VideoTrackId)) {
        return { ok: false, path: `cameras.${index}.trackId`, message: 'Expected a video track: VIDEO-01 to VIDEO-04.' };
      }
      if (!isCode(item.deviceId, 32) || !HARDWARE_DEVICE_ID_PATTERN.test(item.deviceId.trim())) {
        return { ok: false, path: `cameras.${index}.deviceId`, message: 'Expected a capture device id, e.g. CAM-01.' };
      }
      if (item.profile !== undefined && !isCode(item.profile, 64)) {
        return { ok: false, path: `cameras.${index}.profile`, message: 'Expected a media profile code.' };
      }
      cameras.push({ trackId: item.trackId as VideoTrackId, deviceId: item.deviceId.trim(), ...(item.profile === undefined ? {} : { profile: item.profile }) });
    }
  }
  if (body.mics !== undefined) {
    if (!Array.isArray(body.mics) || body.mics.length < 1 || body.mics.length > 4) { // D61 (2026-11-04): one to FOUR microphone lines
      return { ok: false, path: 'mics', message: 'Expected 1 to 4 mic lines.' }; // D61 (2026-11-04)
    }
    for (const [index, line] of body.mics.entries()) {
      const item = typeof line === 'object' && line !== null ? (line as Record<string, unknown>) : null;
      if (!item) return { ok: false, path: `mics.${index}`, message: 'Expected an object.' };
      // D61 (2026-11-04): the mic line states its `channel` (the contract's strict members); the old `role` word is no longer a member.
      const extra = Object.keys(item).find((key) => key !== 'inputId' && key !== 'deviceId' && key !== 'transport' && key !== 'channel');
      if (extra !== undefined) return { ok: false, path: `mics.${index}.${extra}`, message: 'Unknown member.' };
      if (typeof item.inputId !== 'string' || !MIC_INPUT_ID_PATTERN.test(item.inputId)) {
        return { ok: false, path: `mics.${index}.inputId`, message: 'Expected a mic input id, e.g. MIC-01.' };
      }
      if (!isCode(item.deviceId, 32) || !HARDWARE_DEVICE_ID_PATTERN.test(item.deviceId.trim())) {
        return { ok: false, path: `mics.${index}.deviceId`, message: 'Expected a capture device id, e.g. MIC-01.' };
      }
      if (item.transport !== undefined && !isCode(item.transport, 32)) {
        return { ok: false, path: `mics.${index}.transport`, message: 'Expected a transport code.' };
      }
      if (item.channel !== undefined && !(MIC_CHANNEL_IDS as readonly string[]).includes(String(item.channel))) {
        return { ok: false, path: `mics.${index}.channel`, message: 'Expected a microphone channel: MIC-01, MIC-02, MIC-03 or MIC-04.' }; // D61 (2026-11-04)
      }
      mics.push({
        inputId: item.inputId,
        deviceId: item.deviceId.trim(),
        ...(item.transport === undefined ? {} : { transport: item.transport }),
        ...(item.channel === undefined ? {} : { channel: item.channel as MicChannel }),
      });
    }
  }
  // AD-10 (3): a slot is not cleared and assigned by one body. (A mic line WITHOUT `role` names an
  // input, not a slot: which role holds it is the hosted action's to know, and it refuses it.)
  const assigned: readonly CaptureSelectorSlot[] = [...cameras.map((line) => line.trackId), ...mics.flatMap((line) => (line.channel === undefined ? [] : [line.channel]))];
  if (unassign.some((slot) => assigned.includes(slot))) {
    return { ok: false, path: 'unassign', message: 'A slot is not unassigned and assigned by the same request.' };
  }
  return { ok: true, ...(cameras.length > 0 ? { cameras } : {}), ...(mics.length > 0 ? { mics } : {}), ...(unassign.length > 0 ? { unassign } : {}) };
}

/** The telemetry of one capture device, or null when the registry does not hold it. */
function captureDevice(state: SimState, id: string) {
  return state.captureDevices.devices.find((device) => device.id === id) ?? null;
}

/** 404 of an operation whose `{id}` names a capture device of the registry (op 77's list). */
function unknownCaptureDevice(id: string): SimApiResponse {
  return fail(404, 'NOT_FOUND', `The capture registry has no device ${id}.`);
}

/**
 * One edit of the selector (ops 78, 79, 80) through the SAME transition the hosted action
 * `setCaptureConfig` runs (`capture-config.ts`; decision D106 (3)): the audit keys are exactly those
 * of C3 §5.2, a line that names no registered device of the right class is refused, and so is one
 * camera on both tracks with one profile. An edit that changes nothing writes no row.
 */
function editCaptureConfig({ store, clock, deviceConsole }: SimApiTarget, change: CaptureConfigChange): SimApiResponse {
  const state = store.getState();
  try {
    const next = setCaptureConfigTransition(state, clock.now(), change, sendingDeviceOf(state, deviceConsole === true));
    if (next !== state) store.setState(next);
    return respond(200, captureConfigBody(next));
  } catch (error) {
    // What the selector as a whole refuses (C3 §2.4): the Core server answers the same 422.
    if (error instanceof SimTransitionError && error.code === SimErrorCode.INVALID_INPUT) {
      return fail(422, 'INVALID_INPUT', 'The capture configuration is not accepted: a line names no registered device of its class, the selector would hold one source twice, or a replacing mic pair is not one PRIMARY and one STANDBY input.');
    }
    throw error;
  }
}

/**
 * `403 NOT_PERMITTED` of the three credential-carrying operations (89, 95, 96) - and of operation 91
 * when its body carries `credential` (S99-09) - inside a tablet or
 * phone app (C3 §2.6 "Simulator"; D80(3)): the same code and reason as the Core server's condition
 * `WEB_CONSOLE_SESSION`. Decided before the body is looked at. The two sound-card operations
 * (98, 99; task 4 row 63) carry the same condition and are refused the same way.
 */
function webConsoleOnlyRefusal(target: SimApiTarget): SimApiResponse | null {
  if (target.deviceConsole !== true) return null;
  return respond(403, {
    error: { code: 'NOT_PERMITTED', message: 'This action is available on the web console only.', details: { reason: WEB_CONSOLE_ONLY_REASON } },
  });
}

/**
 * The audio-source intervals of one session, newest first (op 82). Exported (integration pass D4):
 * a Core in capture mode `simulated` answers operation 82 with this same derivation of the state,
 * so the simulator and the hosted Core cannot answer two different lists for one state.
 */
export function audioSourceIntervalsOf(state: Pick<SimState, 'audit'> & { readonly audio?: Pick<SimState['audio'], 'activeInputId'> }, session: ActiveSession): ApiAudioSourceInterval[] {
  const startedAt = session.startedAt;
  if (startedAt === null) return [];
  const source = session.audioSource ?? null;
  // THE INTERVAL FACTS OF THE SESSION (review R74-02): every switch left one `AUDIO_SWITCH` item on
  // the session's timeline, with the two inputs and the media time of the boundary. The list is read
  // from ALL of them, oldest first, so the third switch is the fourth interval - not from the
  // current pair alone, which knows the last boundary only.
  interface Boundary {
    readonly from: CaptureMicInputId | null;
    readonly to: CaptureMicInputId;
    readonly atMs: number;
    readonly at: EpochMs;
  }
  const boundaries: Boundary[] = [];
  for (const item of session.timeline) {
    if (item.kind !== 'AUDIO_SWITCH') continue;
    const to = item.params?.['to'];
    if (typeof to !== 'string') continue;
    const from = item.params?.['from'];
    const atMs = item.params?.['atMs'];
    // An item written before the boundary rode its `params`: the simulator's media time is its clock.
    boundaries.push({ from: typeof from === 'string' ? (from as CaptureMicInputId) : null, to: to as CaptureMicInputId, atMs: typeof atMs === 'number' ? atMs : Math.max(0, item.at - startedAt), at: item.at });
  }
  // A session whose pair says "switched" and whose timeline holds no item of it (hand-built, or the
  // items left the timeline ring): the one boundary the pair knows.
  if (boundaries.length === 0 && source !== null && source.switchedAt !== null) boundaries.push({ from: source.standbyInputId, to: source.activeInputId, atMs: source.intervalFromMs, at: source.switchedAt });
  // The input of the FIRST interval: what the first switch left; before any switch the active input
  // of the session. A hand-built session without a pair falls back to the selector snapshot's
  // PRIMARY, then to the meters' active input (the Core's durable state holds no meters).
  // Decision C36 (2), task 4 row 149: where none of them names an input, NO input is in force and
  // the answer is absent - no built-in input is invented for an interval (AD-04, C18 (2)).
  const lines = session.captureConfig?.mics ?? [];
  const initialInputId: CaptureMicInputId | null = boundaries[0]?.from ?? source?.activeInputId ?? lines.find((mic) => mic.channel === PRIMARY_MIC_CHANNEL)?.inputId ?? state.audio?.activeInputId ?? null; // D61: channel 1 is the transcribed line
  if (initialInputId === null) return [];
  // The role is the one of the input's selector line (the Core's rows say STANDBY for the standby).
  // D61 (2026-11-04): the interval table keeps the transcription-pair word of the row — channel 1 reads PRIMARY, another channel STANDBY.
  const roleOf = (inputId: CaptureMicInputId): MicRole => ((lines.find((mic) => mic.inputId === inputId)?.channel ?? PRIMARY_MIC_CHANNEL) === PRIMARY_MIC_CHANNEL ? MicRole.PRIMARY : MicRole.STANDBY);
  const switchRows = state.audit.rows.filter((row) => row.type === AuditType.AUDIO_SOURCE_SWITCHED && row.sessionId === session.id);
  /** Who made the switch that opened an interval: the row of that boundary (C3 §5.2 `toMs`), else the newest row for a single switch. */
  const switchedByOf = (boundary: Boundary): string | null =>
    (switchRows.find((row) => row.details?.['toMs'] === boundary.atMs && row.details?.['toInput'] === boundary.to) ?? (boundaries.length === 1 ? switchRows.at(-1) : undefined))?.actorId ?? null;
  const intervals: ApiAudioSourceInterval[] = [];
  // Pass D6: numbered from 1, as the manifest and the table number them.
  intervals.push({ sessionId: session.id, seq: 1, inputId: initialInputId, role: roleOf(initialInputId), fromMs: 0, toMs: boundaries[0]?.atMs ?? null, fromAt: startedAt, toAt: boundaries[0]?.at ?? null, switchedBy: null, reason: 'START' });
  boundaries.forEach((boundary, index) => {
    const next = boundaries[index + 1];
    intervals.push({ sessionId: session.id, seq: index + 2, inputId: boundary.to, role: roleOf(boundary.to), fromMs: boundary.atMs, toMs: next?.atMs ?? null, fromAt: boundary.at, toAt: next?.at ?? null, switchedBy: switchedByOf(boundary), reason: 'MANUAL' });
  });
  return intervals.reverse();
}

/** The op 83 progress of one session's finalization slice (E-13: derived from Core instants only). */
function sealingProgress(_state: SimState, session: ActiveSession, now: EpochMs): ApiSealingProgress {
  const steps: ApiSealingStep[] = session.finalization.steps.map((step) => ({
    id: step.id,
    status: step.status,
    startedAt: step.startedAt,
    completedAt: step.completedAt,
    durationMs: step.durationMs,
  }));
  const total = FINALIZATION_STEPS_V2.length;
  const done = steps.reduce((sum, step) => sum + (step.status === StepStatus.done ? 1 : step.status === StepStatus.active ? (stepProgress(step) / 100) : 0), 0);
  const remaining = Math.max(0, total - done);
  return {
    sessionId: session.id,
    state: session.state,
    steps,
    progressPct: Math.min(100, Math.floor((done / total) * 100)),
    etaMs: remaining === 0 ? 0 : Math.round(remaining * SEALING_ETA_STEP_MS),
    // A resumed seal is one whose run re-entered a step (dbc-3 §B.4: the attempt counter grows).
    resumed: session.finalization.steps.some((step) => (step.attempt ?? SEALING_FIRST_ATTEMPT) > SEALING_FIRST_ATTEMPT),
    updatedAt: now,
  };
}

function stepProgress(step: FinalizationStepState): number {
  return typeof step.progress === 'number' ? Math.max(0, Math.min(100, step.progress)) : 0;
}

/** The transcript stub of one sealed item (op 84): the binding hashes, never invented segment text. */
function transcriptDocument(item: EvidenceItem): ApiTranscriptDocument {
  const hash = item.transcriptSha256 ?? '';
  return {
    documentVersion: 'dems.transcript/1',
    language: 'id',
    speakerState: 'UNAVAILABLE',
    // D-EV-1: the simulator never fabricates transcript text. The sealed hash binds the document;
    // corrections arrive as revisions (op 85), which carry their own `from`/`to` text.
    segments: [],
    sha256: hash,
    machineTranscriptHash: hash,
    assembledAt: item.sealedAt ?? item.recordedAt,
    revision: item.transcriptRevisions?.length ?? 0,
  };
}

function evidenceItem(state: SimState, id: string): EvidenceItem | null {
  return state.evidence.find((item) => item.id === id) ?? null;
}

/** Validates the op 85 body against `TranscriptRevisionRequest` (C3 §2.3, SEC35-21). */
function checkTranscriptRevisionRequest(body: Record<string, unknown>): { ok: true; baseRevision: number; changes: TranscriptRevisionChange[]; note?: string } | { ok: false; path: string; message: string } {
  const extra = Object.keys(body).find((key) => key !== 'baseRevision' && key !== 'changes' && key !== 'note');
  if (extra !== undefined) return { ok: false, path: extra, message: 'Unknown member.' };
  if (typeof body.baseRevision !== 'number' || !Number.isInteger(body.baseRevision) || body.baseRevision < 0) {
    return { ok: false, path: 'baseRevision', message: 'Expected the current revision number (0 or more).' };
  }
  if (!Array.isArray(body.changes) || body.changes.length < 1) {
    return { ok: false, path: 'changes', message: 'Expected at least one correction.' };
  }
  const changes: TranscriptRevisionChange[] = [];
  for (const [index, change] of body.changes.entries()) {
    const item = typeof change === 'object' && change !== null ? (change as Record<string, unknown>) : null;
    if (!item) return { ok: false, path: `changes.${index}`, message: 'Expected an object.' };
    const unknownKey = Object.keys(item).find((key) => key !== 'segmentIndex' && key !== 'from' && key !== 'to');
    if (unknownKey !== undefined) return { ok: false, path: `changes.${index}.${unknownKey}`, message: 'Unknown member.' };
    if (typeof item.segmentIndex !== 'number' || !Number.isInteger(item.segmentIndex) || item.segmentIndex < 0) {
      return { ok: false, path: `changes.${index}.segmentIndex`, message: 'Expected a segment index (0 or more).' };
    }
    if (typeof item.from !== 'string' || typeof item.to !== 'string') {
      return { ok: false, path: `changes.${index}.to`, message: 'Expected the replaced and the corrected text.' };
    }
    changes.push({ segmentIndex: item.segmentIndex, from: item.from, to: item.to });
  }
  // Pass D6: the note is REQUIRED, 5 to 500 characters after trimming (the contract's `note`; dbc-3 §B.9 `reason`).
  if (!isCode(body.note, 500) || body.note.trim().length < 5) return { ok: false, path: 'note', message: 'Expected a note of 5 to 500 characters that says why the revision was made.' };
  return { ok: true, baseRevision: body.baseRevision, changes, note: body.note.trim() };
}

/** Appends one signed revision to an item (op 85) and writes its TRANSCRIPT_REVISED row (C3 §5.2). */
function appendTranscriptRevision(
  state: SimState,
  now: EpochMs,
  item: EvidenceItem,
  request: { baseRevision: number; changes: TranscriptRevisionChange[]; note?: string },
  authorId: string,
): { state: SimState; revision: ApiTranscriptRevision } {
  const number = (item.transcriptRevisions?.length ?? 0) + 1;
  const unsigned = {
    revisionId: `TRV-${String(number).padStart(6, '0')}`,
    number,
    authorId,
    baseRevision: request.baseRevision,
    machineTranscriptHash: item.transcriptSha256 ?? '',
    signedBy: SIMULATED_SIGNING_KEY_ID,
    createdAt: now,
    changes: request.changes,
  };
  const revision: ApiTranscriptRevision = {
    ...unsigned,
    signature: {
      // A simulated signature over the revision (the same pattern as the evidence manifest): the
      // DEMS signing key is software-only in this phase (OD-04), so the algorithm says SIMULATED.
      value: sha256Hex(canonicalJSON(unsigned)),
      keyId: SIMULATED_SIGNING_KEY_ID,
      algorithm: 'SIMULATED-SHA256',
      simulated: true,
    },
  };
  const nextState: SimState = {
    ...state,
    evidence: state.evidence.map((candidate) =>
      candidate.id === item.id ? { ...candidate, transcriptRevisions: [...(candidate.transcriptRevisions ?? []), revision] } : candidate,
    ),
  };
  return {
    state: {
      ...nextState,
      ...recordActivity(nextState, now, {
        audit: {
          type: AuditType.TRANSCRIPT_REVISED,
          message: `Transcript of ${item.id} revised (revision ${number})`,
          actorId: authorId,
          evidenceId: item.id,
          details: {
            operationId: 'createTranscriptRevision',
            revisionId: revision.revisionId,
            authorId,
            number,
            baseRevision: request.baseRevision,
            changeCount: request.changes.length,
            machineTranscriptHash: revision.machineTranscriptHash,
            ...(request.note === undefined ? {} : { reason: request.note }),
          },
        },
      }),
    },
    revision,
  };
}

/** The export job op 87 polls, read back from the EVIDENCE_EXPORTED row op 42 wrote (NM-12). */
function exportJob(state: SimState, jobId: string): ApiExportJob | null {
  const exportId = `EXP-${jobId.slice('EXPJ-'.length).slice(-6)}`;
  const row = [...state.audit.rows]
    .reverse()
    .find((candidate) => candidate.type === AuditType.EVIDENCE_EXPORTED && candidate.details?.['exportId'] === exportId);
  if (!row?.evidenceId) return null;
  const item = evidenceItem(state, row.evidenceId);
  // The kind the request named (`details.kind` of the request row; absent = PACKAGE).
  const kind = row.details?.['kind'] === 'COMPOSITE' ? 'COMPOSITE' : 'PACKAGE';
  return {
    jobId,
    evidenceId: row.evidenceId,
    kind,
    // The simulated export completes inside the request that queued it, so the job is already done.
    status: 'COMPLETE',
    progressPct: 100,
    etaMs: 0,
    ...(item ? { manifestHash: item.manifestHash, signature: item.signature.value } : {}),
    // A COMPOSITE output is marked derived (OD-16).
    derived: kind === 'COMPOSITE',
    createdAt: row.at,
    completedAt: row.at,
  };
}

const CAPTURE_DENIED = 'Your role cannot change the capture configuration or its credentials (RBAC).';
const REVISE_DENIED = 'Your role cannot revise a transcript (RBAC).';
const EXPORT_JOB_DENIED = 'Your role cannot read export jobs (RBAC).';
const NOT_OPEN = 'This session is not the open session.';
const TRANSCRIPT_NOT_READY_BODY = () => fail(409, 'TRANSCRIPT_NOT_READY', 'The transcript of this item is not ready yet.');

// ── STT configuration (task 3 M6, blueprint row 113; C3 §2.5 ops 90-92; R-8, D20/D24) ──────────

/**
 * The simulator's STT configuration. C3 §2.5 fixes "no new realtime slice (keeps 30)", so this is
 * NOT a member of `SimState`: it is held beside the store that owns the simulated Core, starts at
 * the seeded default (Q-STT-CFG item 11) and lives as long as that store. It never holds a
 * credential — a `SECRET` or `REFERENCE` write leaves only the kind behind (E-30/E-31): the
 * simulator accepts the write opaquely, exactly as it does for op 89.
 */
interface SimSttConfig {
  values: SttConfigValues;
  credentialKind: SttCredentialKind | null;
  revision: number;
  updatedBy: string | null;
  updatedAt: EpochMs;
  /** The session that was open when the configuration last changed; null when it changed while idle. */
  changedDuringSessionId: string | null;
  lastTest: SttLastTest | null;
}

const SIM_STT_CONFIG = new WeakMap<SimStore, SimSttConfig>();
const STT_DENIED = 'Your role cannot change or test the transcription configuration (RBAC).';

function simSttConfig(store: SimStore, now: EpochMs): SimSttConfig {
  let held = SIM_STT_CONFIG.get(store);
  if (held === undefined) {
    held = { values: { ...STT_CONFIG_DEFAULT }, credentialKind: null, revision: 1, updatedBy: null, updatedAt: now, changedDuringSessionId: null, lastTest: null };
    SIM_STT_CONFIG.set(store, held);
  }
  return held;
}

/** The body of op 90: `credentialSet`/`credentialKind` only — the shape has no member for a credential. */
function sttConfigBody(state: SimState, held: SimSttConfig): SttConfig {
  const open = hasActiveSession(state) ? (state.session?.id ?? null) : null;
  return {
    enabled: held.values.enabled,
    backend: held.values.backend,
    ...(held.values.endpoint === null ? {} : { endpoint: held.values.endpoint }),
    model: held.values.model,
    language: 'id',
    diarization: held.values.diarization,
    credentialSet: held.credentialKind !== null,
    ...(held.credentialKind === null ? {} : { credentialKind: held.credentialKind }),
    revision: held.revision,
    ...(held.updatedBy === null ? {} : { updatedBy: held.updatedBy }),
    updatedAt: held.updatedAt,
    pendingForNextSession: open !== null && held.changedDuringSessionId === open,
    ...(held.lastTest === null ? {} : { lastTest: held.lastTest }),
  };
}

/** An error body with `details`: the named reasons of op 91 (C3 §2.5). Never a part of the input. */
function failWith(status: number, code: string, message: string, details: Record<string, string | number>): SimApiResponse {
  return respond(status, { error: { code, message, details } });
}

const STT_ROUTES: readonly Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/v1\/transcription\/config$/,
    handle: ({ store, clock }) => {
      const state = store.getState();
      const refused = requireOperator(state);
      if (refused) return refused;
      return respond(200, sttConfigBody(state, simSttConfig(store, clock.now())));
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/transcription\/config$/,
    handle: (target, _params, body) => {
      const { store, clock } = target;
      const state = store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, STT_DENIED);
      if (refused) return refused;
      const parsed = SttConfigUpdateRequestSchema.safeParse(body);
      // E-30: the refusal names where, never what — the body may hold a credential.
      if (!parsed.success) return failWith(422, 'INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' });
      // S99-09 (ruling D241): a body that carries `credential` is web console only, as on the Core server -
      // asked of the parsed body's member, before anything of it is used. A body without it is the tablet's to send.
      const webOnly = parsed.data.credential === undefined ? null : webConsoleOnlyRefusal(target);
      if (webOnly) return webOnly;
      const now = clock.now();
      const held = simSttConfig(store, now);
      const plan = planSttConfigUpdate({ ...held.values, credentialKind: held.credentialKind, revision: held.revision }, parsed.data);
      if (!plan.ok) {
        if (plan.status === 409) {
          return failWith(409, 'INVALID_STATE', 'The STT configuration changed since it was read. Read it again.', {
            reason: STT_REVISION_CONFLICT_REASON,
            currentRevision: plan.currentRevision,
          });
        }
        return failWith(422, 'INVALID_INPUT', 'The STT configuration value is not accepted.', {
          in: 'body',
          ...(plan.reason === null ? {} : { reason: plan.reason }),
        });
      }
      const open = hasActiveSession(state) ? (state.session?.id ?? null) : null;
      const appliesFrom = open === null ? SttAppliesFrom.NOW : SttAppliesFrom.NEXT_SESSION;
      if (plan.changedFields.length === 0) {
        // Nothing changed: no row, the revision stays (the precedent of `setStoragePolicy`).
        return respond(200, { ...sttConfigBody(state, held), appliesFrom } satisfies SttConfigUpdateResult);
      }
      const actorId = signedInOperatorId(state);
      const next: SimSttConfig = {
        values: plan.values,
        credentialKind: sttCredentialKindAfter(held.credentialKind, plan.credential),
        revision: held.revision + 1,
        updatedBy: actorId,
        updatedAt: now,
        changedDuringSessionId: open,
        // N-5: the outcome of a test of another backend, endpoint, model or credential is not this one's.
        lastTest: sttChangeInvalidatesLastTest(plan.changedFields) ? null : held.lastTest,
      };
      SIM_STT_CONFIG.set(store, next);
      const audited: SimState = {
        ...state,
        ...recordActivity(state, now, {
          audit: {
            type: AuditType.STT_CONFIG_CHANGED,
            message: STT_CONFIG_CHANGED_MESSAGE,
            actorId,
            // C3 §2.5: field NAMES and `credentialChanged` only — never the endpoint, the model, the
            // credential or its reference target.
            details: sttConfigChangedDetails({
              changedFields: plan.changedFields,
              enabled: next.values.enabled,
              backend: next.values.backend,
              credentialChanged: plan.credentialChanged,
              revision: next.revision,
            }),
          },
        }),
      };
      store.setState(audited);
      return respond(200, { ...sttConfigBody(audited, next), appliesFrom } satisfies SttConfigUpdateResult);
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/transcription\/config\/test$/,
    handle: ({ store, clock }) => {
      const state = store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, STT_DENIED);
      if (refused) return refused;
      const now = clock.now();
      const held = simSttConfig(store, now);
      // The simulator contacts nothing: an enabled configuration "answers", a disabled one does not.
      const result: SttConnectionTest = held.values.enabled
        ? { reachable: true, modelAvailable: true, backend: held.values.backend, detailCode: SttConnectionDetailCode.OK }
        : { reachable: false, modelAvailable: false, backend: held.values.backend, detailCode: SttConnectionDetailCode.DISABLED };
      SIM_STT_CONFIG.set(store, { ...held, lastTest: { reachable: result.reachable, modelAvailable: result.modelAvailable, testedAt: now } });
      return respond(200, result);
    },
  },
];

// ── Camera search, connection test, adoption, local inputs (task 3 R-9..R-11; blueprint row 132, ──
// ── decision D106; C3 §2.6 "Simulator" ops 93-97) ────────────────────────────────────────────────

/**
 * The simulator's camera search. Like the STT configuration it is NOT a member of `SimState`: C3
 * §2.6 "Why no slice" keeps the candidate list out of the replicated state, so it is held beside
 * the store, as data of the operator session that searched. It is gone when that session ends,
 * when its life is over, when a new search replaces it and when a demo reset or a scenario load
 * replaces the dataset. The simulator opens no socket and waits on no timer: a search is COMPLETE
 * when it is answered, with the two fixed candidates of `simCaptureCandidates`.
 *
 * It never holds a credential: the `credential` member of operations 95 and 96 is accepted
 * opaquely — its presence is the one fact read from it.
 */
interface SimDiscovery {
  /** The dataset the search belongs to (`meta.createdAt`): another one means a reset happened. */
  datasetCreatedAt: EpochMs;
  /** The operator session that owns the search: the operator and the instant of the sign-in. */
  ownerId: string;
  ownerSince: EpochMs | null;
  search: CaptureDiscoverySearch;
  candidates: CaptureCandidate[];
}

interface SimDiscoveryHolder {
  /** Counts the searches of this store: `DSC-000001`, `DSC-000002`, … (also the local-input re-reads). */
  searches: number;
  held: SimDiscovery | null;
  /** What the next connection test of the new candidate answers (`setSimConnectionTestOutcome`). */
  outcome: CaptureConnectionOutcome;
}

const SIM_DISCOVERY = new WeakMap<SimStore, SimDiscoveryHolder>();
const DISCOVERY_DENIED = 'Your role cannot search for cameras or connect one (RBAC).';
const AUDIO_CARDS_DENIED = 'Your role cannot list the sound cards or register an input (RBAC).';
const COMMISSIONING_DENIED = 'Your role cannot set up the camera network (RBAC).';

/**
 * The refusals every commissioning operation (101-107; task 4 row 102) shares, in the Core
 * server's order: the role (CAPTURE_COMMISSION, TECHNICIAN only), the web-console condition and,
 * for a writing operation, the idle lock. Null: the caller may proceed.
 */
function commissioningRefusal(target: SimApiTarget, writes: boolean): SimApiResponse | null {
  const state = target.store.getState();
  return capabilityRefusal(state, Permission.CAPTURE_COMMISSION, COMMISSIONING_DENIED) ?? webConsoleOnlyRefusal(target) ?? (writes ? captureLockedRefusal(state) : null);
}

/** The simulator's answer to a commissioning write of the right form: it has no host to change. */
function commissioningNotAvailable(): SimApiResponse {
  const reason = CaptureCommissioningReason.COMMISSIONING_NOT_AVAILABLE;
  return failWith(409, 'INVALID_STATE', CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[reason], { reason });
}

function simDiscoveryHolder(store: SimStore): SimDiscoveryHolder {
  let holder = SIM_DISCOVERY.get(store);
  if (holder === undefined) {
    holder = { searches: 0, held: null, outcome: CaptureConnectionOutcome.REACHABLE };
    SIM_DISCOVERY.set(store, holder);
  }
  return holder;
}

/**
 * A FIXTURE of the simulator, for a client that shows every outcome of a connection test in
 * Simulated mode (C3 §2.6: "each is reachable on fixtures"): what the next tests of the simulator's
 * new candidate answer. The default, and the value after `null`, is `REACHABLE`. No request can
 * set it: the body of operation 95 has no such member.
 */
export function setSimConnectionTestOutcome(store: SimStore, outcome: CaptureConnectionOutcome | null): void {
  simDiscoveryHolder(store).outcome = outcome ?? CaptureConnectionOutcome.REACHABLE;
}

const nextSearchId = (holder: SimDiscoveryHolder): string => {
  holder.searches += 1;
  return `DSC-${String(holder.searches).padStart(6, '0')}`;
};

/** The live search of the calling operator session, or null: not the owner, expired, or another dataset. */
function liveDiscovery(store: SimStore, state: SimState, now: EpochMs): SimDiscovery | null {
  const holder = simDiscoveryHolder(store);
  const held = holder.held;
  if (held === null) return null;
  const sameOwner = state.auth.operatorId === held.ownerId && state.auth.issuedAt === held.ownerSince;
  if (!sameOwner || held.datasetCreatedAt !== state.meta.createdAt || now >= held.search.expiresAt) {
    holder.held = null;
    return null;
  }
  return held;
}

/** The candidate as operation 94 lists it now: `adoptable` follows the age of its passing test. */
function candidateView(candidate: CaptureCandidate, now: EpochMs): CaptureCandidate {
  const last = candidate.lastTest;
  const fresh = last !== null && last.outcome === CaptureConnectionOutcome.REACHABLE && now - last.testedAt < CAPTURE_CONNECTION_TEST_VALIDITY_MS;
  return { ...candidate, adoptable: candidate.status === CaptureCandidateStatus.NEW && fresh };
}

/** An error body of operations 95 and 96 with its named reason (C3 §4). Never a part of the input. */
function discoveryRefusal(status: number, code: string, message: string, reason: CaptureDiscoveryReason, extra: Record<string, string> = {}): SimApiResponse {
  return respond(status, { error: { code, message, details: { reason, ...extra } } });
}

/**
 * What operations 95 and 96 check before they look at a candidate, in the Core server's order:
 * the role, the web-console condition, the idle lock (no audit row), then the candidate of the
 * caller's own live search — one 404 for an unknown, an expired and a foreign id.
 */
function candidateOfRequest(target: SimApiTarget, id: string): { refused: SimApiResponse } | { held: SimDiscovery; candidate: CaptureCandidate } {
  const state = target.store.getState();
  const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, DISCOVERY_DENIED) ?? webConsoleOnlyRefusal(target) ?? captureLockedRefusal(state);
  if (refused) return { refused };
  const held = liveDiscovery(target.store, state, target.clock.now());
  const candidate = held?.candidates.find((entry) => entry.candidateId === id);
  if (!held || !candidate) return { refused: fail(404, 'NOT_FOUND', 'No candidate has this ID.') };
  if (candidate.status === CaptureCandidateStatus.REGISTERED) {
    return {
      refused: discoveryRefusal(
        409,
        'INVALID_STATE',
        'This camera is already a capture device.',
        CaptureDiscoveryReason.CANDIDATE_ALREADY_REGISTERED,
        candidate.deviceId === null ? {} : { deviceId: candidate.deviceId },
      ),
    };
  }
  return { held, candidate };
}

/** One CAPTURE_CONNECTION_TESTED row (C3 §5.2). The simulator's candidates are DEVELOPMENT: no `host`, no `endpointRef`. */
function auditConnectionTest(
  state: SimState,
  now: EpochMs,
  held: SimDiscovery,
  candidate: CaptureCandidate,
  outcome: CaptureConnectionOutcome,
  authenticated: boolean,
  operationId: 'testCaptureCandidateConnection' | 'adoptCaptureCandidate',
): SimState {
  return {
    ...state,
    ...recordActivity(state, now, {
      audit: {
        type: AuditType.CAPTURE_CONNECTION_TESTED,
        message: `Camera connection tested (${outcome})`,
        actorId: signedInOperatorId(state),
        details: captureConnectionTestedDetails({
          candidateId: candidate.candidateId,
          searchId: held.search.searchId,
          outcome,
          authenticated,
          adapter: candidate.adapter,
          sourceClass: candidate.sourceClass,
          operationId,
          permission: Permission.CAPTURE_CONFIG,
        }),
      },
    }),
  };
}

const DISCOVERY_ROUTES: readonly Route[] = [
  {
    // 93 startCaptureDiscovery
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/discovery$/,
    handle: (target, _params, body) => {
      const { store, clock } = target;
      const state = store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, DISCOVERY_DENIED);
      if (refused) return refused;
      // Task 4 row 94 (AM-3; decision C10): the optional typed address. A body without the member
      // passes every line of this block untouched: the search below is the search as it was.
      // The typed address is web console only, and a 403 wins over the body: it is decided on the
      // presence of the member, before its value is read. The search itself stays open to a device.
      if ('address' in body) {
        const webOnly = webConsoleOnlyRefusal(target);
        if (webOnly) return webOnly;
      }
      const parsed = CaptureDiscoveryStartRequestSchema.safeParse(body);
      // The refusal names where, never what: the input is not quoted.
      if (!parsed.success) return failWith(422, 'INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' });
      const typedAddress = parsed.data.address;
      // The stand-in of the Core's destination rule. Nothing was stored, counted or audited before it.
      if (typedAddress !== undefined && !simTypedAddressAllowed(typedAddress)) {
        return failWith(422, 'INVALID_INPUT', 'A camera search cannot use this address.', { in: 'body', reason: CaptureDiscoveryReason.DISCOVERY_ADDRESS_NOT_ALLOWED });
      }
      const now = clock.now();
      const holder = simDiscoveryHolder(store);
      // A candidate reads REGISTERED when the registry holds its device: the built-in camera always,
      // the new one once it was adopted (until a demo reset takes the device away again). "Its
      // device" is the camera of the registry with the candidate's whole address: the adopted fixture
      // (`CAM-03` in a store that adopted nothing else) keeps the address of its candidate. Row 94
      // made this a match by address, where it was the fixed id: a typed-address candidate that was
      // adopted first takes `CAM-03`, and the fixture candidate must not read REGISTERED for it.
      const adoptedAt = (host: string) => state.captureDevices.devices.find((device) => device.kind === 'CAMERA' && device.host === host);
      const asRegistryReadsIt = (candidate: CaptureCandidate): CaptureCandidate => {
        if (candidate.status === CaptureCandidateStatus.REGISTERED) return candidate;
        const known = adoptedAt(candidate.host);
        return known === undefined ? candidate : { ...candidate, status: CaptureCandidateStatus.REGISTERED, deviceId: known.id };
      };
      const candidates = simCaptureCandidates().map(asRegistryReadsIt);
      // One synthetic candidate, last in the list: nothing was probed.
      if (typedAddress !== undefined) candidates.push(asRegistryReadsIt(simTypedAddressCandidate(typedAddress)));
      const registeredCount = candidates.filter((candidate) => candidate.status === CaptureCandidateStatus.REGISTERED).length;
      const search: CaptureDiscoverySearch = {
        ...simCaptureDiscoverySearch(nextSearchId(holder), now, now + CAPTURE_DISCOVERY_RESULT_TTL_MS, true),
        responderCount: candidates.length,
        newCount: candidates.length - registeredCount,
        registeredCount,
      };
      // The new list replaces the old one: its candidate ids die with their test results.
      holder.held = { datasetCreatedAt: state.meta.createdAt, ownerId: state.auth.operatorId ?? '', ownerSince: state.auth.issuedAt, search, candidates };
      const open = hasActiveSession(state) ? (state.session?.id ?? null) : null;
      store.setState({
        ...state,
        ...recordActivity(state, now, {
          audit: {
            type: AuditType.CAPTURE_DISCOVERY_SEARCHED,
            message: `Camera search performed (${search.responderCount} answered)`,
            actorId: signedInOperatorId(state),
            // C3 §5.2: ids, the trigger, the outcome and four counts. Never an address or a device text.
            details: captureDiscoverySearchedDetails({
              searchId: search.searchId,
              scope: CaptureDiscoveryScope.CAMERA_NETWORK,
              trigger: CaptureDiscoveryTrigger.MANUAL,
              outcome: 'COMPLETE',
              responderCount: search.responderCount,
              newCount: search.newCount,
              registeredCount: search.registeredCount,
              interfaceCount: search.interfaceCount,
              sessionId: open,
              operationId: 'startCaptureDiscovery',
              permission: Permission.CAPTURE_CONFIG,
            }),
          },
        }),
      });
      return respond(202, search);
    },
  },
  {
    // 94 getCaptureDiscovery
    method: 'GET',
    pattern: /^\/api\/v1\/capture\/discovery$/,
    handle: ({ store, clock }) => {
      const state = store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, DISCOVERY_DENIED);
      if (refused) return refused;
      const now = clock.now();
      const held = liveDiscovery(store, state, now);
      if (held === null) return respond(200, { search: null, candidates: [], truncated: false } satisfies CaptureDiscoveryStateBody);
      return respond(200, {
        search: { ...held.search, created: false },
        candidates: held.candidates.map((candidate) => candidateView(candidate, now)),
        truncated: false,
      } satisfies CaptureDiscoveryStateBody);
    },
  },
  {
    // 95 testCaptureCandidateConnection
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/discovery\/candidates\/([^/]+)\/test$/,
    handle: (target, [id = ''], body) => {
      const found = candidateOfRequest(target, id);
      if ('refused' in found) return found.refused;
      const parsed = CaptureConnectionTestRequestSchema.safeParse(body);
      // E-30: the refusal names where, never what — the body may hold a credential.
      if (!parsed.success) return failWith(422, 'INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' });
      const { store, clock } = target;
      const now = clock.now();
      // The one fact read from the body: whether a credential was sent. The pair itself is dropped here.
      const authenticated = parsed.data.credential !== undefined;
      const outcome = simDiscoveryHolder(store).outcome;
      const reachable = outcome === CaptureConnectionOutcome.REACHABLE;
      found.candidate.lastTest = { outcome, authenticated, testedAt: now };
      store.setState(auditConnectionTest(store.getState(), now, found.held, found.candidate, outcome, authenticated, 'testCaptureCandidateConnection'));
      return respond(200, {
        candidateId: found.candidate.candidateId,
        outcome,
        authenticated,
        testedAt: now,
        usableProfileCount: reachable ? 1 : 0,
        // The simulator keeps no lock-out guard: the bound of the contract, every time.
        failedAttemptsRemaining: CAPTURE_CONNECTION_TEST_MAX_FAILURES,
      } satisfies CaptureConnectionTest);
    },
  },
  {
    // 96 adoptCaptureCandidate
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/discovery\/candidates\/([^/]+)\/adopt$/,
    handle: (target, [id = ''], body) => {
      const found = candidateOfRequest(target, id);
      if ('refused' in found) return found.refused;
      const { store, clock } = target;
      const now = clock.now();
      const { held, candidate } = found;
      if (!candidateView(candidate, now).adoptable) {
        return discoveryRefusal(409, 'INVALID_STATE', 'Test the connection to this camera first.', CaptureDiscoveryReason.CANDIDATE_NOT_TESTED);
      }
      const parsed = CaptureCandidateAdoptRequestSchema.safeParse(body);
      if (!parsed.success) return failWith(422, 'INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' });
      // The simulator has no credential store (as for operation 89): nothing of the pair is kept.
      const credentialSet = parsed.data.credential !== undefined;
      const actorId = signedInOperatorId(store.getState());
      // The Core server's rows, in its order: the verification, the adoption, the credential fact.
      let next = auditConnectionTest(store.getState(), now, held, candidate, CaptureConnectionOutcome.REACHABLE, credentialSet, 'adoptCaptureCandidate');
      // The device joins the registry through the transition of the INTERNAL action the Core runs
      // inside operation 96 (`registerCaptureDevice`): the next free CAM-NN, never a reused id.
      const registered = registerCaptureDeviceTransition(next, {
        id: nextCaptureCameraId(next.captureDevices.devices),
        model: candidate.model,
        host: candidate.host,
        adapter: candidate.adapter,
      });
      next = registered.state;
      const device = registered.result;
      next = {
        ...next,
        ...recordActivity(next, now, [
          {
            audit: {
              type: AuditType.CAPTURE_CANDIDATE_ADOPTED,
              message: `Camera added as ${device.id}`,
              actorId,
              deviceId: device.id,
              details: captureCandidateAdoptedDetails({
                deviceId: device.id,
                candidateId: candidate.candidateId,
                searchId: held.search.searchId,
                adapter: candidate.adapter,
                sourceClass: candidate.sourceClass,
                credentialSet,
                permission: Permission.CAPTURE_CONFIG,
              }),
            },
          },
          ...(credentialSet
            ? [
                {
                  audit: {
                    type: AuditType.CAPTURE_CREDENTIAL_SET,
                    message: `Credential stored for ${device.id}`,
                    actorId,
                    deviceId: device.id,
                    details: { operationId: 'adoptCaptureCandidate', deviceId: device.id, permission: Permission.CAPTURE_CONFIG },
                  },
                },
              ]
            : []),
        ]),
      };
      store.setState(next);
      // At most one device per candidate: a repeat answers 409 CANDIDATE_ALREADY_REGISTERED.
      candidate.status = CaptureCandidateStatus.REGISTERED;
      candidate.deviceId = device.id;
      return respond(201, { deviceId: device.id, device, credentialSet } satisfies CaptureCandidateAdoption);
    },
  },
  {
    // 97 rescanCaptureInputs
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/inputs\/rescan$/,
    handle: ({ store, clock }) => {
      const state = store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, DISCOVERY_DENIED);
      if (refused) return refused;
      const now = clock.now();
      // One entry per REGISTERED microphone, `present` from the simulator's device state.
      const inputs = state.captureDevices.devices
        .filter((device) => device.kind === 'MIC')
        .map((device) => ({
          deviceId: device.id,
          inputId: state.captureConfig.mics.find((mic) => mic.deviceId === device.id)?.inputId ?? null,
          present: device.online,
          // No `adapter`, no `sourceClass` (wave H closing pass Z1, ruling D206 (2); C3 §2.6 erratum PE-WH-01):
          // simulated capture states no source class on any operation. The two members are a real Core's.
          errorCode: null,
        }));
      const open = hasActiveSession(state) ? (state.session?.id ?? null) : null;
      store.setState({
        ...state,
        ...recordActivity(state, now, {
          audit: {
            type: AuditType.CAPTURE_DISCOVERY_SEARCHED,
            message: 'Microphone inputs read again',
            actorId: signedInOperatorId(state),
            details: captureDiscoverySearchedDetails({
              searchId: nextSearchId(simDiscoveryHolder(store)),
              scope: CaptureDiscoveryScope.MIC_LOCAL,
              trigger: CaptureDiscoveryTrigger.MANUAL,
              outcome: 'COMPLETE',
              responderCount: inputs.filter((input) => input.present).length,
              newCount: 0,
              registeredCount: inputs.length,
              interfaceCount: 0,
              sessionId: open,
              operationId: 'rescanCaptureInputs',
              permission: Permission.CAPTURE_CONFIG,
            }),
          },
        }),
      });
      return respond(200, { scannedAt: now, inputs, unregisteredCount: 0 } satisfies CaptureInputScan);
    },
  },
  {
    // 98 searchCaptureAudioCards (task 4, blueprint row 63; design addendum 4.2). The simulator reads
    // no host: the answer is the fixed listing of two test cards, none of whose inputs is registered.
    // The Core server's order: the role, the web-console condition, the idle lock (no audit row).
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/audio-cards\/search$/,
    handle: (target) => {
      const { store, clock } = target;
      const state = store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, AUDIO_CARDS_DENIED) ?? webConsoleOnlyRefusal(target) ?? captureLockedRefusal(state);
      if (refused) return refused;
      const now = clock.now();
      const cards = simCaptureAudioCards();
      store.setState({
        ...state,
        ...recordActivity(state, now, {
          audit: {
            type: AuditType.CAPTURE_DISCOVERY_SEARCHED,
            message: 'Sound cards listed',
            actorId: signedInOperatorId(state),
            // Counts and codes only: no product name, no USB id and no card id.
            details: captureDiscoverySearchedDetails({
              searchId: nextSearchId(simDiscoveryHolder(store)),
              scope: CaptureDiscoveryScope.AUDIO_CARDS,
              trigger: CaptureDiscoveryTrigger.MANUAL,
              outcome: 'COMPLETE',
              responderCount: cards.length,
              newCount: cards.filter((card) => card.registered.length === 0).length,
              registeredCount: cards.filter((card) => card.registered.length > 0).length,
              interfaceCount: 0,
              operationId: 'searchCaptureAudioCards',
              permission: Permission.CAPTURE_CONFIG,
            }),
          },
        }),
      });
      return respond(200, { searchedAt: now, cards, truncated: false } satisfies CaptureAudioCardSearch);
    },
  },
  {
    // 99 registerCaptureAudioInput. The simulator captures from no sound card, so it registers
    // nothing, writes no audit row and changes no state: every answer is a refusal the contract
    // names. A card of the fixed listing: 409 (the input is beyond the card, or the simulator
    // registers none); any other card: 404.
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/audio-cards\/inputs$/,
    handle: (target, _params, body) => {
      const state = target.store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, AUDIO_CARDS_DENIED) ?? webConsoleOnlyRefusal(target) ?? captureLockedRefusal(state);
      if (refused) return refused;
      const parsed = CaptureAudioInputRegisterRequestSchema.safeParse(body);
      // The refusal names where, never what.
      if (!parsed.success) return failWith(422, 'INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' });
      const card = simCaptureAudioCards().find((entry) => entry.cardId === parsed.data.cardId && entry.deviceIndex === parsed.data.deviceIndex);
      if (!card) return fail(404, 'NOT_FOUND', 'No sound card has this ID.');
      if (parsed.data.inputNumber > card.channelCount) {
        return failWith(409, 'INVALID_STATE', 'The sound card has no such input.', { reason: CaptureAudioCardReason.AUDIO_INPUT_BEYOND_CARD });
      }
      return failWith(409, 'INVALID_STATE', 'A sound-card input can be registered on a production Core only.', {
        reason: CaptureAudioCardReason.AUDIO_INPUT_NOT_REGISTRABLE,
      });
    },
  },
  {
    // 100 confirmCaptureDeviceAddress (task 4, blueprint row 194; WP-12). The simulator's cameras
    // never move: no candidate of its fixed search has a changed address. So it stores nothing,
    // writes no audit row and changes no state: every answer is a refusal the contract names. The
    // Core server's order: the role, the web-console condition, the idle lock, the body, then the
    // device and the candidate (404, one answer), then "not this camera at a new address" (409).
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/devices\/address\/confirm$/,
    handle: (target, _params, body) => {
      const state = target.store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, DISCOVERY_DENIED) ?? webConsoleOnlyRefusal(target) ?? captureLockedRefusal(state);
      if (refused) return refused;
      const parsed = CaptureDeviceAddressConfirmRequestSchema.safeParse(body);
      // The refusal names where, never what.
      if (!parsed.success) return failWith(422, 'INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' });
      const camera = state.captureDevices.devices.some((device) => device.id === parsed.data.deviceId && device.kind === 'CAMERA');
      const candidate = liveDiscovery(target.store, state, target.clock.now())?.candidates.some((entry) => entry.candidateId === parsed.data.candidateId) ?? false;
      if (!camera || !candidate) return fail(404, 'NOT_FOUND', 'No camera or candidate has this ID.');
      const reason = CaptureReaddressReason.READDRESS_NOT_THE_REGISTERED_CAMERA;
      return failWith(409, 'INVALID_STATE', CAPTURE_READDRESS_REFUSAL_SENTENCES[reason], { reason });
    },
  },
  // ── The commissioning functions of the camera network (task 4, blueprint row 102; WP-23b; ops ──
  // ── 101-107). The simulator has no host, no interface and no address helper: its answers are ──
  // ── SYNTHETIC and say so, and NONE of them stores anything, writes an audit row or changes the ──
  // ── state. The Core server's order is kept: the role (TECHNICIAN only), the web-console ───────
  // ── condition, then for a write the idle lock and the body. ──────────────────────────────────
  {
    // 101 getCaptureNetworkConfig: the fixed configuration, whose interface is named as simulated.
    method: 'GET',
    pattern: /^\/api\/v1\/capture\/network\/config$/,
    handle: (target) => commissioningRefusal(target, false) ?? respond(200, simCaptureNetworkConfig() satisfies CaptureNetworkConfig),
  },
  {
    // 102 updateCaptureNetworkConfig: nothing is stored. A body of the right form: "not available".
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/network\/config$/,
    handle: (target, _params, body) => {
      const refused = commissioningRefusal(target, true);
      if (refused) return refused;
      if (!CaptureNetworkConfigUpdateRequestSchema.safeParse(body).success) return failWith(422, 'INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' });
      return commissioningNotAvailable();
    },
  },
  {
    // 103 scanFactoryCameras: nothing is asked of any address. ONE synthetic device, `synthetic: true`,
    // no temporary address, no audit row.
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/network\/scan$/,
    handle: (target, _params, body) => {
      const refused = commissioningRefusal(target, true);
      if (refused) return refused;
      const parsed = CameraFactoryScanRequestSchema.safeParse(body);
      if (!parsed.success) return failWith(422, 'INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' });
      return respond(200, simCameraFactoryScan(target.clock.now(), parsed.data.address) satisfies CameraFactoryScan);
    },
  },
  {
    // 104 getHostAlias: the simulator never holds a temporary address.
    method: 'GET',
    pattern: /^\/api\/v1\/capture\/network\/alias$/,
    handle: (target) => commissioningRefusal(target, false) ?? respond(200, { alias: null } satisfies HostAliasState),
  },
  {
    // 105 removeHostAlias: none is in place, so nothing can be removed.
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/network\/alias\/remove$/,
    handle: (target) => {
      const refused = commissioningRefusal(target, true);
      if (refused) return refused;
      const reason = CaptureCommissioningReason.HOST_ALIAS_NOT_PRESENT;
      return failWith(409, 'INVALID_STATE', CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[reason], { reason });
    },
  },
  {
    // 106 setCameraNetwork: no camera is changed and no job starts. The one fact read from the body
    // is whether it has the form of the request; the credential pair is dropped unread.
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/network\/cameras\/address$/,
    handle: (target, _params, body) => {
      const refused = commissioningRefusal(target, true);
      if (refused) return refused;
      // E-30: the refusal names where, never what - the body holds a credential.
      if (!CameraNetworkSetRequestSchema.safeParse(body).success) return failWith(422, 'INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' });
      return commissioningNotAvailable();
    },
  },
  {
    // 107 getCameraNetworkJob: the simulator starts no job, so every id is unknown.
    method: 'GET',
    pattern: /^\/api\/v1\/capture\/network\/jobs\/([^/]+)$/,
    handle: (target) => commissioningRefusal(target, false) ?? fail(404, 'NOT_FOUND', 'No job has this ID.'),
  },
  {
    // 108 testCaptureDeviceConnection (task 4, row V3; blueprint row 146; ROW V4, decision C75 (2)).
    // The simulator contacts nothing and holds no credential, so NOTHING CAN BE TESTED: it answers
    // what a Core server in simulated capture answers - `503 NOT_READY` with `details.reason:
    // DISCOVERY_NOT_READY` - and never a synthetic REACHABLE: a simulator that asked no camera does
    // not say a camera answered. NOTHING CHANGES: no audit row, no event, no state. The Core
    // server's order: the role, the web-console condition, the idle lock, then "not ready" - BEFORE
    // the device is looked up, so an unknown id gets the same 503. A body is not read.
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/devices\/([^/]+)\/test$/,
    handle: (target) => {
      const state = target.store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, DISCOVERY_DENIED) ?? webConsoleOnlyRefusal(target) ?? captureLockedRefusal(state);
      if (refused) return refused;
      return failWith(503, 'NOT_READY', CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE, { reason: CaptureDiscoveryReason.DISCOVERY_NOT_READY });
    },
  },
  // ── The installation acceptance and its revocation (task 4, blueprint row 116; WP-26b; ops ──
  // ── 109-110). The simulator keeps NO installation record: both answers are refusals that say ──
  // ── so, and NOTHING CHANGES - no audit row, no event, no state. The Core server's order: the ──
  // ── role (CAPTURE_COMMISSION), the web-console condition, the idle lock, then the body. ──────
  {
    // 109 acceptInstallation: a body of the right form answers "not available"; nothing is stored.
    method: 'POST',
    pattern: /^\/api\/v1\/installation\/acceptance$/,
    handle: (target, _params, body) => {
      const refused = commissioningRefusal(target, true);
      if (refused) return refused;
      if (!InstallationAcceptRequestSchema.safeParse(body).success) return failWith(422, 'INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' });
      const reason = InstallationAcceptanceReason.INSTALLATION_ACCEPTANCE_NOT_AVAILABLE;
      return failWith(409, 'INVALID_STATE', INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES[reason], { reason });
    },
  },
  {
    // 110 revokeInstallationAcceptance: the simulator never holds an acceptance, so none is in force.
    method: 'POST',
    pattern: /^\/api\/v1\/installation\/acceptance\/revoke$/,
    handle: (target, _params, body) => {
      const refused = commissioningRefusal(target, true);
      if (refused) return refused;
      if (!InstallationAcceptanceRevokeRequestSchema.safeParse(body).success) return failWith(422, 'INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' });
      const reason = InstallationAcceptanceReason.INSTALLATION_ACCEPTANCE_NOT_IN_FORCE;
      return failWith(409, 'INVALID_STATE', INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES[reason], { reason });
    },
  },
  {
    // 111 retireCaptureDevice (task 4, row RD2; design 07 sections 4.2-4.4; decision C147). The
    // simulator retires a device IT registered (an adopted camera) in its own state, through the
    // transition of the INTERNAL action the Core runs inside operation 111's unit, and writes the
    // same CAPTURE_DEVICE_RETIRED row. It holds no credential: `credentialDestroyed: false`, and no
    // stream row: `streamRowsKept: 0`. The Core server's order: the role (CAPTURE_COMMISSION), the
    // web-console condition, the idle lock, the body, the device (404), then the transition's own
    // refusals - built-in, retired already, assigned to a slot. A refusal changes nothing.
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/devices\/([^/]+)\/retire$/,
    handle: (target, [id = ''], body) => {
      const refused = commissioningRefusal(target, true);
      if (refused) return refused;
      const parsed = CaptureDeviceRetireRequestSchema.safeParse(body);
      if (!parsed.success) return failWith(422, 'INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' });
      const { store, clock } = target;
      const state = store.getState();
      const actorId = signedInOperatorId(state);
      const now = clock.now();
      let retired: ReturnType<typeof retireCaptureDeviceTransition>;
      try {
        retired = retireCaptureDeviceTransition(state, { deviceId: id, retiredAt: now, retiredBy: actorId ?? '' });
      } catch (error) {
        if (!(error instanceof SimTransitionError)) throw error;
        if (error.reason === RETIRE_REFUSAL.NOT_FOUND) return fail(404, 'NOT_FOUND', 'The capture registry has no such device.');
        const reason = error.reason as CaptureRetireRefusal | null;
        if (reason === null || !(reason in CAPTURE_RETIRE_REFUSAL_SENTENCES)) throw error;
        const slot = reason === CaptureRetireRefusalReason.CAPTURE_DEVICE_ASSIGNED ? selectorSlotOfDevice(state, id) : null;
        return failWith(409, 'INVALID_STATE', CAPTURE_RETIRE_REFUSAL_SENTENCES[reason], { reason, ...(slot === null ? {} : { slot }) });
      }
      const device = retired.result;
      const kind = device.kind === 'MIC' ? 'MIC' : 'CAMERA';
      store.setState({
        ...retired.state,
        ...recordActivity(retired.state, now, [
          {
            audit: {
              type: AuditType.CAPTURE_DEVICE_RETIRED,
              message: `Device retired: ${device.id}`,
              actorId,
              deviceId: device.id,
              details: captureDeviceRetiredDetails({ deviceId: device.id, kind, reason: parsed.data.reason, credentialDestroyed: false, streamRowsKept: 0, permission: Permission.CAPTURE_COMMISSION }),
            },
          },
        ]),
      });
      return respond(200, { deviceId: device.id, device, reason: parsed.data.reason, credentialDestroyed: false } satisfies CaptureDeviceRetirement);
    },
  },
];

const CAPTURE_ROUTES: readonly Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/v1\/capture\/config$/,
    handle: ({ store }) => {
      const state = store.getState();
      const refused = requireOperator(state);
      if (refused) return refused;
      return respond(200, captureConfigBody(state));
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/capture\/devices$/,
    handle: ({ store }) => {
      const state = store.getState();
      const refused = requireOperator(state);
      if (refused) return refused;
      return respond(200, state.captureDevices satisfies ApiCaptureDevices);
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/config$/,
    handle: (target, _params, body) => {
      const state = target.store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, CAPTURE_DENIED);
      if (refused) return refused;
      const locked = captureLockedRefusal(state);
      if (locked) return locked;
      const update = checkCaptureConfigUpdate(body);
      if (!update.ok) return fail(422, 'INVALID_INPUT', `${update.path}: ${update.message}`);
      return editCaptureConfig(target, {
        kind: 'UPDATE',
        ...(update.cameras === undefined ? {} : { cameras: update.cameras }),
        ...(update.mics === undefined ? {} : { mics: update.mics }),
        ...(update.unassign === undefined ? {} : { unassign: update.unassign }),
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/cameras\/([^/]+)\/source$/,
    handle: (target, [id = ''], body) => {
      const state = target.store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, CAPTURE_DENIED);
      if (refused) return refused;
      const device = captureDevice(state, id);
      if (!device || device.kind !== 'CAMERA') return unknownCaptureDevice(id);
      const locked = captureLockedRefusal(state);
      if (locked) return locked;
      const extra = Object.keys(body).find((key) => key !== 'trackId');
      if (extra !== undefined || !VIDEO_TRACK_IDS.includes(body.trackId as VideoTrackId)) {
        return fail(422, 'INVALID_INPUT', 'trackId: Expected a video track, VIDEO-01 to VIDEO-04.');
      }
      return editCaptureConfig(target, { kind: 'CAMERA_SOURCE', deviceId: device.id, trackId: body.trackId as VideoTrackId });
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/mics\/([^/]+)\/primary$/,
    handle: (target, [id = '']) => {
      const state = target.store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, CAPTURE_DENIED);
      if (refused) return refused;
      const slot = state.captureConfig.mics.find((entry) => entry.inputId === id);
      if (!slot) return unknownCaptureDevice(id);
      const locked = captureLockedRefusal(state);
      if (locked) return locked;
      return editCaptureConfig(target, { kind: 'PRIMARY_MIC', inputId: slot.inputId });
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/capture\/devices\/([^/]+)\/credential$/,
    handle: (target, [id = ''], body) => {
      const { store, clock } = target;
      const state = store.getState();
      const refused = capabilityRefusal(state, Permission.CAPTURE_CONFIG, CAPTURE_DENIED);
      if (refused) return refused;
      // C3 §3.1 (erratum PE-121-05): web console only, decided before the body is looked at.
      const webOnly = webConsoleOnlyRefusal(target);
      if (webOnly) return webOnly;
      const device = captureDevice(state, id);
      if (!device || device.kind !== 'CAMERA') return unknownCaptureDevice(id);
      const locked = captureLockedRefusal(state);
      if (locked) return locked;
      // The contract's own schema (printable ASCII, erratum PE-128-27). Its outcome is all that is
      // read: the pair is never stored, never inspected further and never echoed.
      if (!CaptureCredentialWriteRequestSchema.safeParse(body).success) {
        // RK-12: the refusal names the field, never its content.
        return fail(422, 'INVALID_INPUT', 'username/secret: Both members are required and are never echoed back.');
      }
      const next: SimState = {
        ...state,
        ...recordActivity(state, clock.now(), {
          audit: {
            type: AuditType.CAPTURE_CREDENTIAL_SET,
            message: `Credential stored for ${id}`,
            actorId: signedInOperatorId(state),
            deviceId: id,
            // C3 §5.2 / RK-12: the row names the device only — no username, secret, ciphertext or key.
            details: { operationId: 'setCaptureDeviceCredential', deviceId: id, permission: Permission.CAPTURE_CONFIG },
          },
        }),
      };
      store.setState(next);
      return respond(200, captureConfigBody(next));
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/session\/([^/]+)\/audio-source$/,
    handle: ({ store, clock, deviceConsole }, [id = ''], body) => {
      const state = store.getState();
      const denied = sessionAccess(state);
      if (denied) return denied;
      const session = currentSession(state, id);
      if (!session) return fail(404, 'NOT_FOUND', NOT_OPEN);
      const operator = operatorOf(state);
      // C3 §2.2 op 81: SESSION_START plus the SESSION_HOLDER condition (SEC35-18).
      if (operator && operator.role !== OperatorRole.SUPERVISOR && session.createdBy !== operator.id) {
        return fail(403, 'NOT_PERMITTED', 'Only the operator who opened this session or a supervisor may switch the microphone (RBAC).');
      }
      if (session.state !== SessionState.RECORDING) return fail(409, 'INVALID_STATE', `Session ${id} is ${session.state}.`);
      const extra = Object.keys(body).find((key) => key !== 'inputId' && key !== 'reason');
      const inputId = body.inputId;
      if (extra !== undefined || typeof inputId !== 'string' || !MIC_INPUT_ID_PATTERN.test(inputId)) {
        return fail(422, 'INVALID_INPUT', 'inputId: Expected a mic input id, e.g. MIC-01.');
      }
      if (body.reason !== undefined && !isCode(body.reason, 500)) return fail(422, 'INVALID_INPUT', 'reason: At most 500 characters.');
      // D133 (1): any `MIC-NN` is a well-formed input; only one of the two inputs of this session's
      // selector can become the active source (C3 §4 `AUDIO_SOURCE_CONFLICT`).
      const selectorInputs = selectorOfSession(session, state.captureConfig).mics;
      if (!selectorInputs.some((mic) => mic.inputId === inputId)) {
        return fail(409, 'AUDIO_SOURCE_CONFLICT', 'The requested microphone cannot become the active source.');
      }
      // The transition's parameter type still names the built-in pair (`session-machine.ts`); it reads the selector.
      const next = switchAudioSourceTransition(state, clock.now(), inputId as MicInputId, sendingDeviceOf(state, deviceConsole === true));
      if (next !== state) store.setState(next);
      const source = next.session?.audioSource;
      if (!source) return fail(409, 'AUDIO_SOURCE_CONFLICT', 'The requested microphone cannot become the active source.');
      return respond(200, {
        sessionId: session.id,
        activeInputId: source.activeInputId,
        standbyInputId: source.standbyInputId,
        switchedAt: source.switchedAt ?? clock.now(),
        intervalFromMs: source.intervalFromMs,
      } satisfies ApiAudioSourceState);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/session\/([^/]+)\/audio-source$/,
    handle: ({ store }, [id = '']) => {
      const state = store.getState();
      const refused = requireOperator(state);
      if (refused) return refused;
      const session = currentSession(state, id);
      if (!session) return fail(404, 'NOT_FOUND', NOT_OPEN);
      return respond(200, { items: audioSourceIntervalsOf(state, session), nextCursor: null });
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/session\/([^/]+)\/sealing$/,
    handle: ({ store, clock }, [id = '']) => {
      const state = store.getState();
      const refused = requireOperator(state);
      if (refused) return refused;
      const session = currentSession(state, id);
      if (!session) return fail(404, 'NOT_FOUND', NOT_OPEN);
      if (session.finalization.startedAt === null) {
        return fail(409, 'INVALID_STATE', `Sealing has not started for session ${id}.`);
      }
      return respond(200, sealingProgress(state, session, clock.now()));
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/evidence\/exports\/([^/]+)$/,
    handle: ({ store }, [id = '']) => {
      const state = store.getState();
      const refused = capabilityRefusal(state, Permission.EVIDENCE_EXPORT, EXPORT_JOB_DENIED);
      if (refused) return refused;
      if (!EXPORT_JOB_ID_PATTERN.test(id)) return fail(422, 'INVALID_INPUT', 'id: Expected EXPJ-NNNNNN.');
      const job = exportJob(state, id);
      if (!job) return fail(404, 'NOT_FOUND', 'No export job has this ID.');
      return respond(200, job);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/evidence\/([^/]+)\/transcript$/,
    handle: ({ store }, [id = '']) => {
      const state = store.getState();
      const refused = capabilityRefusal(state, Permission.EVIDENCE_VIEW, 'Your role cannot read evidence (RBAC).');
      if (refused) return refused;
      const item = evidenceItem(state, id);
      if (!item) return fail(404, 'NOT_FOUND', 'Evidence not found.');
      if (!item.transcriptSha256) return TRANSCRIPT_NOT_READY_BODY();
      return respond(200, transcriptDocument(item));
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/evidence\/([^/]+)\/transcript\/revisions$/,
    handle: ({ store, clock }, [id = ''], body) => {
      const state = store.getState();
      const refused = capabilityRefusal(state, Permission.TRANSCRIPT_REVISE, REVISE_DENIED);
      if (refused) return refused;
      const item = evidenceItem(state, id);
      if (!item) return fail(404, 'NOT_FOUND', 'Evidence not found.');
      if (!item.transcriptSha256) return TRANSCRIPT_NOT_READY_BODY();
      const request = checkTranscriptRevisionRequest(body);
      if (!request.ok) return fail(422, 'INVALID_INPUT', `${request.path}: ${request.message}`);
      const current = item.transcriptRevisions?.length ?? 0;
      if (request.baseRevision !== current) {
        // SEC35-21: the caller must re-read op 84 and re-apply on top of the new head.
        return fail(409, 'TRANSCRIPT_REVISION_CONFLICT', `The current revision is ${current}; re-read the transcript and retry.`);
      }
      const authorId = signedInOperatorId(state);
      const appended = appendTranscriptRevision(state, clock.now(), item, request, authorId ?? '');
      store.setState(appended.state);
      return respond(201, appended.revision);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/evidence\/([^/]+)\/transcript\/revisions$/,
    handle: ({ store }, [id = '']) => {
      const state = store.getState();
      const refused = capabilityRefusal(state, Permission.EVIDENCE_VIEW, 'Your role cannot read evidence (RBAC).');
      if (refused) return refused;
      const item = evidenceItem(state, id);
      if (!item) return fail(404, 'NOT_FOUND', 'Evidence not found.');
      if (!item.transcriptSha256) return TRANSCRIPT_NOT_READY_BODY();
      return respond(200, { items: [...(item.transcriptRevisions ?? [])].reverse(), nextCursor: null });
    },
  },
];

const ROUTES: readonly Route[] = [
  ...CAPTURE_ROUTES,
  ...STT_ROUTES,
  ...DISCOVERY_ROUTES,
  {
    method: 'POST',
    pattern: /^\/api\/v1\/session$/,    handle: ({ store, actions }, _params, body) => {
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
      // Still connecting its cameras: nothing durable to stop and seal (D84; C3 §3.1; pass D10). A 409, so before the 422.
      if (session.captureDurable === false) {
        return failWith(409, 'INVALID_STATE', `Session ${id} is still connecting its cameras: nothing is recorded yet.`, { reason: CAPTURE_NOT_DURABLE_REASON });
      }
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
    handle: ({ store }) => {
      const state = store.getState();
      return respond(200, {
        channels: audioInputs(state),
        activeInputId: activeInputOf(state),
      } satisfies ApiAudioStatus);
    },
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
      let result: ExportResult;
      try {
        result = actions.exportEvidence(id, {
          reason: typeof body.reason === 'string' ? body.reason : '',
          destination: typeof body.destination === 'string' ? body.destination : '',
          ...(body.kind === 'PACKAGE' || body.kind === 'COMPOSITE' ? { kind: body.kind } : {}),
        });
      } catch (error) {
        // Fix wave J (truth rule 3d; JA2-03 / JW-03): a COMPOSITE is an output this build cannot produce - refused as the
        // Core refuses it (`409 COMMAND_UNSUPPORTED`), and nothing was recorded.
        if (error instanceof SimTransitionError && error.code === SimErrorCode.COMMAND_UNSUPPORTED) return fail(409, 'COMMAND_UNSUPPORTED', 'Composite video is not available in this build.');
        throw error;
      }
      if (!result.ok) return exportFailure(result);
      // Schema v2 (C3 §3 op 42): the answer is the queue receipt; op 87 polls the job to completion.
      return respond(202, { exportId: result.exportId, evidenceId: id, status: 'QUEUED', jobId: exportJobIdOf(result.exportId) ?? undefined } satisfies ApiExportBody);
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
    // A refusal that names its reason (`CAPTURE_NOT_DURABLE`) says so in `details.reason`, as the Core does.
    if (error.reason !== null) return failWith(409, 'INVALID_STATE', error.message, { reason: error.reason });
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
