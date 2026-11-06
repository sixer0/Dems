/**
 * Area 4 of the Core API: sessions and the recording lifecycle (backend task: 2026-10-04 01_specs
 * §7.8, §7.17, §7.18; plan row W27, contract C).
 *
 * Fifteen operations make up the area. Four of them are design-book operations and live in
 * `core-api.ts` (24 `createSession`, 25 `startSession`, 26 `stopSession`, 27 `getCurrentSession`);
 * the eleven below are answered by the Core server only. One session is open per Core, and any
 * operator holding SESSION_START may act on it (Q16). In every path with `{id}` the ID is a session
 * ID, and an ID that is not the open session answers `404`, as the existing three commands do.
 *
 * | # | operationId | Access | Audit on success | Simulator action |
 * |--:|-------------|--------|------------------|------------------|
 * | 28 | `beginPrecheck` | SESSION_START | NONE-P (event PRECHECK_STARTED) | `beginPrecheck` |
 * | 29 | `retryPrecheck` | SESSION_START | NONE-P (event PRECHECK_STARTED) | `retryPrecheck` |
 * | 30 | `acknowledgePrecheckWarnings` | SESSION_START | PRECHECK_PASSED | `acknowledgePrecheckWarnings` |
 * | 31 | `cancelSession` | SESSION_START | SESSION_CANCELLED | `cancel` |
 * | 32 | `scanCaseNumber` | SESSION_START | NONE-P (reserves a counter value) | `scanCaseNumber` |
 * | 33 | `recoverSession` | SESSION_START | RECOVERY_STARTED (after a power failure also SYSTEM_BOOT and FAULT_CLEARED) | `recover` |
 * | 34 | `addSessionMarker` | SESSION_NOTE | MARKER_ADDED | `addMarker` |
 * | 35 | `addSessionNote` | SESSION_NOTE | NOTE_ADDED | `addNote` |
 * | 36 | `takeSessionSnapshot` | SESSION_NOTE | SNAPSHOT_TAKEN | `snapshot` |
 * | 37 | `acknowledgeSessionSummary` | SESSION_START | SUMMARY_ACKNOWLEDGED (none for a repeat or another ID) | `acknowledgeSummary` |
 * | 38 | `listSessionHistory` | AUTHENTICATED | NONE-R | reads `sessionHistory` |
 *
 * `recover` and `acknowledgeSummary` check nothing in the simulator today and take SESSION_START
 * here; `addMarker`, `addNote` and `snapshot` take SESSION_NOTE (01_specs §7.8).
 */
import { z } from 'zod';
import { FinalizationStep, MicRole, SessionState } from '../domain/enums';
import { AuditType, Permission, StepStatus } from '../sim/vocabulary';
import { API_BASE_PATH, API_PAGE_LIMIT_DEFAULT } from './constants';
import {
  AUTHENTICATED_ACCESS,
  CORE_SERVER_ONLY,
  CoreApiAccessCondition,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import type { SessionCommandResponse } from './core-api';
import { BASIC_403_EXAMPLES, ERROR_EXAMPLES, apiErrorExample, deniedExamples, simRefusalExample } from './example-parts';
import type { OperationExamples } from './examples';
import {
  INVALID_INPUT,
  INVALID_JSON,
  INVALID_PATH_PARAMETER,
  INVALID_QUERY,
  LIST_READ_NOTE,
  NOT_SIGNED_IN,
  SIM_V2_NOTE,
  backendSource,
  forbidden,
  hostedNote,
  notPermitted,
} from './operation-parts';
import { CASE_NUMBER_PATTERN, MIC_INPUT_ID_PATTERN, SESSION_ID_PATTERN } from './patterns';
import { boundedText, count, epochMs, nextCursor, nullableEpochMs, operatorId, pageCursor, pageLimit, sessionId } from './schema-parts';
import { EXAMPLE_SESSION_HISTORY, STATE_EXAMPLE_IDS } from './state-examples';
import { SessionHistoryEntrySchema } from './state-slices';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Limits of the two texts an operator types during a recording, in UTF-16 code units, which is
 * what the simulator counts. The marker label is the simulator's own bound: it would cut a longer
 * label, so the contract refuses one instead and the engine never cuts (finding F-1 of contract B).
 * The note limit is the specification's (01_specs §7.8) and the simulator's.
 */
export const SESSION_TEXT_LIMITS = { markerLabelMax: 80, noteMax: 2_000 } as const;

export const SessionMarkerRequestSchema = z
  .object({
    label: boundedText(SESSION_TEXT_LIMITS.markerLabelMax, 0)
      .optional()
      .describe(
        `Label of the marker: at most ${SESSION_TEXT_LIMITS.markerLabelMax} UTF-16 code units after trimming. Omitted or empty: the Core names it "Marker n".`,
      ),
  })
  .describe('Optional request body of `POST /api/v1/session/{id}/markers`.');
export type SessionMarkerRequest = z.output<typeof SessionMarkerRequestSchema>;

export const SessionNoteRequestSchema = z
  .object({
    text: boundedText(SESSION_TEXT_LIMITS.noteMax).describe(
      'The note: 1 to 2,000 characters after trimming, and at most 2,000 UTF-16 code units. It stays in the session record; the audit row holds its ID and length only.',
    ),
  })
  .describe('Request body of `POST /api/v1/session/{id}/notes`.');
export type SessionNoteRequest = z.output<typeof SessionNoteRequestSchema>;

export const CaseNumberScanSchema = z
  .strictObject({
    caseNumber: z
      .string()
      .regex(CASE_NUMBER_PATTERN)
      .describe('The next case number `LP/{YYYY}/{MMDD}-NNNN`. It is reserved: the next scan offers another.'),
  })
  .describe('Result of the simulated case-number scanner.');
export type CaseNumberScan = z.output<typeof CaseNumberScanSchema>;

export const PageQuerySchema = z
  .object({
    cursor: pageCursor(),
    limit: pageLimit(),
  })
  .describe('Query of a list read that takes no filter: the paging members of API-9.');
export type PageQuery = z.output<typeof PageQuerySchema>;

export const SessionHistoryPageSchema = z
  .strictObject({
    items: z.array(SessionHistoryEntrySchema).describe('Finished sessions, newest first: the elements of the `sessionHistory` slice.'),
    nextCursor: nextCursor(),
  })
  .describe('One page of the session history.');
export type SessionHistoryPage = z.output<typeof SessionHistoryPageSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const SESSION_SCHEMAS = {
  SessionMarkerRequest: SessionMarkerRequestSchema,
  SessionNoteRequest: SessionNoteRequestSchema,
  CaseNumberScan: CaseNumberScanSchema,
  PageQuery: PageQuerySchema,
  SessionHistoryPage: SessionHistoryPageSchema,
} as const;

/**
 * Two `details.reason` values of the session operations on a Core in a real capture operation
 * (row 71b; ruling D144). Documented values of existing answers: no new status, no new code.
 *
 *   `CAPTURE_NOT_DURABLE`   `409 INVALID_STATE` of `stopSession`: the recording is still
 *                           "connecting cameras" - nothing durable has been written yet
 *                           (`captureDurable: false`), so there is nothing to stop and seal. Ask
 *                           again once the session reports `captureDurable: true`, or cancel.
 *   `CAPTURE_HELPERS_LEFT`  `503 NOT_READY` of `startSession` (envelope level): helper processes
 *                           of an earlier capture are still running; the start is refused until
 *                           they are gone, so that no device is opened twice.
 */
export const CAPTURE_NOT_DURABLE_REASON = 'CAPTURE_NOT_DURABLE';
export const CAPTURE_HELPERS_LEFT_REASON = 'CAPTURE_HELPERS_LEFT';

/**
 * Contract example of the `503 NOT_READY` of `startSession` that names a session-key refusal (fix
 * wave I, driver A1; `contract_wave_i.md` section 5): status, envelope code, details. The two
 * reason values and their reader are `START_REFUSED_REASONS` / `startRefusedReasonOf` of
 * `@dems/shared/sim` (closing pass J, item 7); a client test imports this example.
 */
export const START_REFUSED_SESSION_KEY_EXAMPLE = Object.freeze({
  status: 503,
  code: 'NOT_READY',
  details: Object.freeze({ reason: 'SESSION_KEY_NOT_OF_SESSION' }),
} as const);

// ── Operations 81-83: mic switch and sealing progress (task 3 M2-W7; register SH-13; C3 §2) ────

/**
 * Op 81 is retired in behaviour (D5; D28 DQ-2; register N-29/N-36 of masterplan/01_specs_d5.md):
 * the audio of each track is fixed by its camera-microphone pair (`CAPTURE_PAIRS`), so the route
 * answers `409` with this code for EVERY session, before any lookup, and writes no audit row.
 */
export const AUDIO_SOURCE_FIXED_BY_PAIRING_CODE = 'AUDIO_SOURCE_FIXED_BY_PAIRING';
/** The sentence of that refusal (register N-36), one text for the Core and the simulator. */
export const AUDIO_SOURCE_FIXED_BY_PAIRING_MESSAGE =
  'The audio of each track is fixed by its camera-microphone pair; there is no source to switch.';

/** Request body of op 81: the input to make active, with an optional operator reason. Still checked by the Core (422) before the retired operation's 409 (D28 DQ-2; audit row 149); the simulator does not check it. */
export const AudioSourceSwitchRequestSchema = z
  .strictObject({
    inputId: z.string().regex(MIC_INPUT_ID_PATTERN).describe('The mic input the caller asks to move behind AUDIO-01, `MIC-NN`. Since D5 (D28 DQ-2) no input is moved: each track carries the microphone of its own pair (`VIDEO-0N` <-> `MIC-0N`), and the operation answers `409 AUDIO_SOURCE_FIXED_BY_PAIRING`. To transcribe another microphone, put it in Pair 1 with operation 80 before the session.'),
    reason: boundedText(500).optional().describe('Why the operator switched; audited as text, never as a secret.'),
  })
  .describe('Request body of `POST /api/v1/session/{id}/audio-source` (C3 §2.3 op 81).');
export type AudioSourceSwitchRequest = z.output<typeof AudioSourceSwitchRequestSchema>;

/** Success of op 81: the new active/standby state, in Core instants and media pts (E-13). */
export const AudioSourceStateSchema = z
  .strictObject({
    sessionId: sessionId(),
    activeInputId: z.string().regex(MIC_INPUT_ID_PATTERN),
    standbyInputId: z.string().regex(MIC_INPUT_ID_PATTERN),
    switchedAt: epochMs().describe('Core instant the switch took effect (never the client clock, E-13).'),
    intervalFromMs: count().describe('Media-pts start of the interval the switch opened.'),
  })
  .describe('The active/standby pair after a switch (`C3 §2.3` op 81); mirrors the session slice member.');
export type AudioSourceStateBody = z.output<typeof AudioSourceStateSchema>;

/**
 * One audio-source interval of op 82's page. `fromMs`/`toMs` are **media pts** derived capture-side
 * (S2 §6 finding 3; capture-spec §E), so playback can draw the audio-source band (WB-04/MB-07);
 * `fromAt`/`toAt` are the UTC-ms record. The open interval has `toMs: null`.
 */
export const AudioSourceIntervalEntrySchema = z
  .strictObject({
    sessionId: sessionId(),
    seq: count().min(1).describe('Interval number within the session, from 1: the manifest\'s rule (ev §B.5) and the table\'s (`session_audio_intervals_seq_check`). Pass D6: the text said "from 0"; no Core ever answered 0 in real capture.'),
    inputId: z.string().regex(MIC_INPUT_ID_PATTERN).describe('The mic device of this interval, `MIC-NN`.'),
    role: z.enum(MicRole), // D61 (2026-11-04): the transcription-pair word of the interval (channel 1 = PRIMARY, channel 2 = STANDBY)
    fromMs: count().describe('Media-pts start (ms).'),
    toMs: nullableEpochMs().describe('Media-pts end (ms); null while the interval is open.'),
    fromAt: epochMs().describe('UTC-ms record of the start.'),
    toAt: nullableEpochMs().describe('UTC-ms record of the end; null while open.'),
    switchedBy: operatorId().nullable().describe('The operator of the manual toggle that opened it; null when the run opened it.'),
    reason: z.enum(['START', 'MANUAL', 'STOP']).describe('What opened the interval (OD-09/OD-11: every switch is operator-initiated).'),
  })
  .describe('One interval of one mic input inside AUDIO-01 (`session_audio_intervals`, `dbc-3 §B.5`).');
export type AudioSourceIntervalEntry = z.output<typeof AudioSourceIntervalEntrySchema>;

export const AudioSourceIntervalPageSchema = z
  .strictObject({
    items: z.array(AudioSourceIntervalEntrySchema),
    nextCursor: nextCursor(),
  })
  .describe('One page of audio-source intervals (op 82; API-9).');
export type AudioSourceIntervalPage = z.output<typeof AudioSourceIntervalPageSchema>;

/** One v2 sealing step as op 83 reports it. */
export const SealingProgressStepSchema = z
  .strictObject({
    id: z.enum(FinalizationStep).describe('v2 step names CLOSE_TRACKS .. STORE_SEALED_PACKAGE (SH-01; `ev §E`).'),
    status: z.enum(StepStatus),
    startedAt: nullableEpochMs(),
    completedAt: nullableEpochMs(),
    durationMs: nullableEpochMs(),
  })
  .describe('One sealing step of `SealingProgress.steps`.');
export type SealingProgressStep = z.output<typeof SealingProgressStepSchema>;

/**
 * Success of op 83. Progress is forward-only and derived from Core instants (`coreClockOf`;
 * register E-13; OD-08), never from the client clock; `resumed: true` marks a RECOVERY resume
 * (register MB-06). Recomputed at `SEALING_PROGRESS_INTERVAL_MS` (`@dems/shared/api` capture.ts).
 */
export const SealingProgressSchema = z
  .strictObject({
    sessionId: sessionId(),
    state: z.enum(SessionState).describe('The session state while sealing (FINALIZING, or SEALED/RECOVERY around it).'),
    steps: z.array(SealingProgressStepSchema),
    progressPct: z.int().min(0).max(100).describe('Whole-percent progress over the v2 steps, forward-only (E-13).'),
    etaMs: nullableEpochMs().describe('Estimated milliseconds left; null before the estimate holds.'),
    resumed: z.boolean().describe('True when this seal is a RECOVERY resume from a checkpoint (MB-06; OD-08). On a Core in real capture: a START of the Core ran the seal again - never an automatic retry of the same process, never the on-demand retry of operation 33.'),
    updatedAt: epochMs().describe('Core instant of the last recompute.'),
  })
  .describe('Sealing progress v2 (`C3 §2.3` op 83); mirrors the session `finalization` slice with the v2 steps.');
export type SealingProgressBody = z.output<typeof SealingProgressSchema>;

/** The schemas operations 81-83 add (merged into `CORE_API_SCHEMAS`). */
export const AUDIO_SOURCE_SCHEMAS = {
  AudioSourceSwitchRequest: AudioSourceSwitchRequestSchema,
  AudioSourceState: AudioSourceStateSchema,
  AudioSourceIntervalEntry: AudioSourceIntervalEntrySchema,
  AudioSourceIntervalPage: AudioSourceIntervalPageSchema,
  SealingProgressStep: SealingProgressStepSchema,
  SealingProgress: SealingProgressSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.8';
const SESSION_PATH = `${API_BASE_PATH}/session`;
const SESSION_START = permissionAccess(Permission.SESSION_START);
const SESSION_NOTE = permissionAccess(Permission.SESSION_NOTE);
const DENIED = { denial: AuditType.ACCESS_DENIED } as const;
const SESSION_PARAM = { name: 'id', description: 'Session ID of the open session.', pattern: SESSION_ID_PATTERN } as const;

const START_REFUSED = notPermitted(Permission.SESSION_START);
const NOTE_REFUSED = notPermitted(Permission.SESSION_NOTE);
const NOT_OPEN_SESSION = { description: 'This ID is not the open session (NOT_FOUND).', schema: 'ApiError' } as const;
const NOT_RECORDING = { description: 'The session is not RECORDING (INVALID_STATE).', schema: 'ApiError' } as const;
const COMMAND = 'SessionCommandResponse';

export const SESSION_OPERATIONS = [
  {
    operationId: 'beginPrecheck',
    method: 'post',
    path: `${SESSION_PATH}/{id}/precheck`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.LIVE,
    summary: 'Begin the pre-check',
    description: [
      'Starts the twelve pre-recording checks of a session in **CREATE** and answers `202` with state **PRECHECK**. The checks resolve on the Core over the next seconds; their progress and their outcome arrive in the `session` slice.',
      'Writes no audit row: the event PRECHECK_STARTED is emitted, and the outcome is audited when the checks end (PRECHECK_PASSED or PRECHECK_BLOCKED).',
      hostedNote('beginPrecheck'),
    ].join('\n\n'),
    source: backendSource(SECTION, 28),
    pathParam: SESSION_PARAM,
    responses: {
      202: { description: 'The checks are running (state PRECHECK).', schema: COMMAND },
      401: NOT_SIGNED_IN,
      403: START_REFUSED,
      404: NOT_OPEN_SESSION,
      409: { description: 'The session is not in CREATE (INVALID_STATE).', schema: 'ApiError' },
      422: INVALID_PATH_PARAMETER,
    },
    access: SESSION_START,
    audit: { success: CoreApiAuditNone.PARITY, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'retryPrecheck',
    method: 'post',
    path: `${SESSION_PATH}/{id}/precheck/retry`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.LIVE,
    summary: 'Run the pre-check again',
    description: [
      'Runs the checks again for a session whose pre-check ended with a warning or a block, and answers `202` with state **PRECHECK**.',
      'Writes no audit row: the event PRECHECK_STARTED is emitted, and the outcome is audited when the checks end.',
      hostedNote('retryPrecheck'),
    ].join('\n\n'),
    source: backendSource(SECTION, 29),
    pathParam: SESSION_PARAM,
    responses: {
      202: { description: 'The checks are running again (state PRECHECK).', schema: COMMAND },
      401: NOT_SIGNED_IN,
      403: START_REFUSED,
      404: NOT_OPEN_SESSION,
      409: {
        description: 'The session is not in PRECHECK (INVALID_STATE), or its checks are still running (PRECHECK_RUNNING).',
        schema: 'ApiError',
      },
      422: INVALID_PATH_PARAMETER,
    },
    access: SESSION_START,
    audit: { success: CoreApiAuditNone.PARITY, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'acknowledgePrecheckWarnings',
    method: 'post',
    path: `${SESSION_PATH}/{id}/precheck/acknowledge`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.LIVE,
    summary: 'Acknowledge the pre-check warnings',
    description: [
      'Acknowledges a pre-check that ended with **WARN** and arms the session: `200` with state **ARMED**. A pre-check with a block cannot be acknowledged.',
      'Writes PRECHECK_PASSED with the acknowledged warnings.',
      hostedNote('acknowledgePrecheckWarnings'),
    ].join('\n\n'),
    source: backendSource(SECTION, 30),
    pathParam: SESSION_PARAM,
    responses: {
      200: { description: 'The warnings are acknowledged (state ARMED).', schema: COMMAND },
      401: NOT_SIGNED_IN,
      403: START_REFUSED,
      404: NOT_OPEN_SESSION,
      409: {
        description:
          'The session is not in PRECHECK or its pre-check has no warning to acknowledge (INVALID_STATE), or its checks are still running (PRECHECK_RUNNING).',
        schema: 'ApiError',
      },
      422: INVALID_PATH_PARAMETER,
    },
    access: SESSION_START,
    audit: { success: AuditType.PRECHECK_PASSED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'cancelSession',
    method: 'post',
    path: `${SESSION_PATH}/{id}/cancel`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.LIVE,
    summary: 'Cancel the session',
    description: [
      'Cancels a session that has not started recording (CREATE, PRECHECK or ARMED). The Core is idle afterwards and no evidence item is created.',
      'Writes SESSION_CANCELLED.',
      hostedNote('cancel'),
    ].join('\n\n'),
    source: backendSource(SECTION, 31),
    pathParam: SESSION_PARAM,
    responses: {
      204: { description: 'The session is cancelled; no session is open.' },
      401: NOT_SIGNED_IN,
      403: START_REFUSED,
      404: NOT_OPEN_SESSION,
      409: { description: 'The session is recording or later: it can be stopped, not cancelled (INVALID_STATE).', schema: 'ApiError' },
      422: INVALID_PATH_PARAMETER,
    },
    access: SESSION_START,
    audit: { success: AuditType.SESSION_CANCELLED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'scanCaseNumber',
    method: 'post',
    path: `${SESSION_PATH}/case-number`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.LIVE,
    summary: 'Scan a case number',
    description: [
      'The simulated case-number scanner of the session form: returns the next case number and reserves it, so the next scan offers a fresh one. It is a POST because it advances a counter.',
      'Writes no audit row.',
      hostedNote('scanCaseNumber'),
    ].join('\n\n'),
    source: backendSource(SECTION, 32),
    responses: {
      200: { description: 'The reserved case number.', schema: 'CaseNumberScan' },
      401: NOT_SIGNED_IN,
      403: START_REFUSED,
    },
    access: SESSION_START,
    audit: { success: CoreApiAuditNone.PARITY, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'recoverSession',
    method: 'post',
    path: `${SESSION_PATH}/{id}/recover`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.LIVE,
    summary: 'Recover a faulted session',
    description: [
      'Starts the recovery of a session in **FAULT** and answers `202` with state **RECOVERY**. The Core closes what was recorded as an incomplete session with a RECORDED evidence item; the steps arrive in the `session` slice.',
      'Writes RECOVERY_STARTED. After a power failure the simulated boot is part of the recovery, so SYSTEM_BOOT and FAULT_CLEARED are written too.',
      'Core server in real capture operation (decision D186 (4)): when the open session is **FINALIZING** with a FAILED sealing step, the operation runs its seal again in the background and answers `202` with state **FINALIZING**; no recovery starts and RECOVERY_STARTED is not written.',
      hostedNote('recover'),
    ].join('\n\n'),
    source: backendSource(SECTION, 33),
    pathParam: SESSION_PARAM,
    responses: {
      202: { description: 'The recovery is running (state RECOVERY); or, on a Core in real capture operation, the failed seal of a FINALIZING session was queued again (state FINALIZING).', schema: COMMAND },
      401: NOT_SIGNED_IN,
      403: START_REFUSED,
      404: NOT_OPEN_SESSION,
      409: { description: 'The session is not in FAULT (INVALID_STATE).', schema: 'ApiError' },
      422: INVALID_PATH_PARAMETER,
    },
    access: SESSION_START,
    audit: { success: AuditType.RECOVERY_STARTED, ...DENIED, also: [AuditType.SYSTEM_BOOT, AuditType.FAULT_CLEARED] },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'addSessionMarker',
    method: 'post',
    path: `${SESSION_PATH}/{id}/markers`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.LIVE,
    summary: 'Add a marker',
    description: [
      'Adds a marker to the timeline of the recording, at the server time of the request. The label is optional.',
      'Writes MARKER_ADDED with the label and the marker number.',
      hostedNote('addMarker'),
    ].join('\n\n'),
    source: backendSource(SECTION, 34),
    pathParam: SESSION_PARAM,
    requestBody: { schema: 'SessionMarkerRequest', required: false },
    responses: {
      204: { description: 'The marker is on the timeline.' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: NOTE_REFUSED,
      404: NOT_OPEN_SESSION,
      409: NOT_RECORDING,
      422: INVALID_INPUT,
    },
    access: SESSION_NOTE,
    audit: { success: AuditType.MARKER_ADDED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'addSessionNote',
    method: 'post',
    path: `${SESSION_PATH}/{id}/notes`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.LIVE,
    summary: 'Add a note',
    description: [
      'Adds an investigator note to the recording. The note names its author and stays in the session record and in the sealed evidence item.',
      'Writes NOTE_ADDED with the note ID and its length; the text is not in the audit row.',
      hostedNote('addNote'),
    ].join('\n\n'),
    source: backendSource(SECTION, 35),
    pathParam: SESSION_PARAM,
    requestBody: { schema: 'SessionNoteRequest', required: true },
    responses: {
      204: { description: 'The note is recorded.' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: NOTE_REFUSED,
      404: NOT_OPEN_SESSION,
      409: NOT_RECORDING,
      422: INVALID_INPUT,
    },
    access: SESSION_NOTE,
    audit: { success: AuditType.NOTE_ADDED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'takeSessionSnapshot',
    method: 'post',
    path: `${SESSION_PATH}/{id}/snapshots`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.LIVE,
    summary: 'Take a snapshot',
    description: [
      'Records a snapshot of the active camera on the timeline of the recording. No image file is produced or served (01_specs §11).',
      'Writes SNAPSHOT_TAKEN.',
      hostedNote('snapshot'),
    ].join('\n\n'),
    source: backendSource(SECTION, 36),
    pathParam: SESSION_PARAM,
    responses: {
      204: { description: 'The snapshot is on the timeline.' },
      401: NOT_SIGNED_IN,
      403: NOTE_REFUSED,
      404: NOT_OPEN_SESSION,
      409: NOT_RECORDING,
      422: INVALID_PATH_PARAMETER,
    },
    access: SESSION_NOTE,
    audit: { success: AuditType.SNAPSHOT_TAKEN, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'acknowledgeSessionSummary',
    method: 'post',
    path: `${SESSION_PATH}/{id}/summary/acknowledge`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.LIVE,
    summary: 'Acknowledge the session summary',
    description: [
      'Acknowledges the summary of the session that was sealed last, so the clients stop showing it.',
      'Writes SUMMARY_ACKNOWLEDGED. A repeat, or the ID of another session, changes nothing, writes nothing and still answers `204`, as the simulator does: this is the one path of the area whose `{id}` never answers `404`.',
      hostedNote('acknowledgeSummary'),
    ].join('\n\n'),
    source: backendSource(SECTION, 37),
    pathParam: { name: 'id', description: 'Session ID of the session that was sealed last.', pattern: SESSION_ID_PATTERN },
    responses: {
      204: { description: 'The summary of that session is acknowledged, or nothing changed.' },
      401: NOT_SIGNED_IN,
      403: START_REFUSED,
      422: INVALID_PATH_PARAMETER,
    },
    access: SESSION_START,
    audit: { success: AuditType.SUMMARY_ACKNOWLEDGED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'listSessionHistory',
    method: 'get',
    path: `${SESSION_PATH}/history`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.LIVE,
    summary: 'Session history',
    description: [
      `The finished sessions, newest first, in pages of ${API_PAGE_LIMIT_DEFAULT} unless \`limit\` says otherwise. Every role sees the history, as every role sees the Sessions page.`,
      LIST_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 38),
    query: { schema: 'PageQuery' },
    responses: {
      200: { description: 'One page of finished sessions.', schema: 'SessionHistoryPage' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
      422: INVALID_QUERY,
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations 81-83: the in-session mic switch and sealing progress
// (task 3 M2-W7, blueprint row 48; register SH-13; C3 §2.2/§2.3/§2.4; OD-09/OD-11)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Op 81 needs SESSION_START **and** the `SESSION_HOLDER` condition (D4 OD-09; SEC35-18, materialised by this row). */
const SESSION_HOLDER_ACCESS = { ...SESSION_START, conditions: [CoreApiAccessCondition.SESSION_HOLDER] } as const;
const SESSION_HOLDER_REFUSED =
  'the caller holds SESSION_START but is neither the operator who created the open session nor a SUPERVISOR (NOT_PERMITTED; one ACCESS_DENIED row whose `details.reason` is `SESSION_HOLDER`; C3 §5.3)';

export const AUDIO_SOURCE_OPERATIONS = [
  {
    operationId: 'switchAudioSource',
    method: 'post',
    path: `${SESSION_PATH}/{id}/audio-source`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.SIMULATED,
    summary: 'Switch the active microphone (retired: the audio is fixed by the camera-microphone pair)',
    description: [
      '**Retired in behaviour by D5 (D28 DQ-2; audit row 149).** The audio of each track is fixed by its camera-microphone pair: Pair N is camera track `VIDEO-0N` with microphone channel `MIC-0N` (sealed as `AUDIO-0N`), and the transcription stays on Pair 1 (`AUDIO-01`). The route stays and answers `409 AUDIO_SOURCE_FIXED_BY_PAIRING` ("The audio of each track is fixed by its camera-microphone pair; there is no source to switch.") for every session, before any lookup of the session or the input, with no state change and **no audit row**. No call succeeds: the operation documents no success status. To transcribe another microphone, put it in Pair 1 with operation 80 (`setPrimaryMic`) before the session.',
      'What runs before the refusal is the request\'s own: the access rule — SESSION_START **and** the `SESSION_HOLDER` condition, the operator who created the open session or any SUPERVISOR (D4 OD-09; SEC35-18; a refusal writes its ACCESS_DENIED row) — and, on the Core server only, the request schema (`422 INVALID_INPUT` for an input ID that is not `MIC-NN`).',
      'Before D5 the in-session toggle moved the transcribed source behind AUDIO-01, recorded an audio-source interval and wrote AUDIO_SOURCE_SWITCHED (fromInput, toInput, the media-pts fromMs/toMs, and `sendingDeviceId` for a paired device). Stored rows of those sessions stay readable; operation 82 still lists the intervals (since D5: the one interval of the start). It never auto-switched (OD-11).',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 81; register SH-13/CS-07/NM-10 (not in the design book)',
    pathParam: SESSION_PARAM,
    requestBody: { schema: 'AudioSourceSwitchRequest', required: true },
    // Audit row 149 (D130; N-29, N-31, N-36): no success, no 404 (no lookup is made); 422 is the Core server's schema check only.
    responses: {
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.SESSION_START, SESSION_HOLDER_REFUSED),
      409: {
        description:
          'Every call that passes the access rule: the audio of each track is fixed by its camera-microphone pair (AUDIO_SOURCE_FIXED_BY_PAIRING; D5, D28 DQ-2). Nothing changes and no audit row is written.',
        schema: 'ApiError',
      },
      422: { ...INVALID_INPUT, services: CORE_SERVER_ONLY },
    },
    access: SESSION_HOLDER_ACCESS,
    // Audit row 149: no call succeeds and the refusal writes no row (N-29); `NONE-P` - the simulator writes none either.
    audit: { success: CoreApiAuditNone.PARITY, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'listAudioSourceIntervals',
    method: 'get',
    path: `${SESSION_PATH}/{id}/audio-source`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.SIMULATED,
    summary: 'Microphone intervals of a session',
    description: [
      'The audio-source intervals of the session, newest first, paged (API-9): which mic input fed AUDIO-01 between which media-pts marks, who switched it and why it changed. Playback draws the audio-source band from these rows (WB-04/MB-07).',
      '`fromMs`/`toMs` are media pts derived capture-side (S2 §6 finding 3; capture-spec §E), never operator wall clock.',
      'Needs a signed-in operator; every role may read it.',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 82; register SH-02/SH-05/NM-10 (not in the design book)',
    pathParam: SESSION_PARAM,
    query: { schema: 'PageQuery' },
    responses: {
      200: { description: 'One page of intervals.', schema: 'AudioSourceIntervalPage' },
      401: NOT_SIGNED_IN,
      // RECON-A (row 51a §5 B2b): every role may read these intervals, so no seeded role can be refused;
      // the 403 is the Origin / revoked-device guard only the Core server sends (01_specs §7.19). The
      // simulator ignores the query entirely, so the paged-read 422 is likewise Core-server-only (SR-64).
      403: { ...forbidden(), services: CORE_SERVER_ONLY },
      404: NOT_OPEN_SESSION,
      422: { ...INVALID_QUERY, services: CORE_SERVER_ONLY },
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getSealingProgress',
    method: 'get',
    path: `${SESSION_PATH}/{id}/sealing`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.SIMULATED,
    summary: 'Sealing progress',
    description: [
      'The v2 finalization steps of the session with per-step status, duration, a whole-percent progress and an etaMs, recomputed every SEALING_PROGRESS_INTERVAL_MS. Progress is forward-only and derived from Core instants only (register E-13; OD-08); `resumed: true` marks a seal that RECOVERY resumed from its last checkpoint (register MB-06).',
      'Reads the session slice `finalization`; refuses `409 INVALID_STATE` when sealing has not started (C3 §4).',
      'Needs a signed-in operator; every role may read it.',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 83; register SH-05/SH-06/CS-04/NM-07 (not in the design book)',
    pathParam: SESSION_PARAM,
    responses: {
      200: { description: 'The sealing progress.', schema: 'SealingProgress' },
      401: NOT_SIGNED_IN,
      // RECON-A (row 51a §5 B2b): every role may read the sealing progress, so no seeded role can be
      // refused; the 403 is the Origin / revoked-device guard only the Core server sends (01_specs §7.19).
      // The simulator answers an unknown `{id}` with 404 and does no path-parameter format check
      // (D-51a-6), so this 422 is produced only by the Core server's schema validation.
      403: { ...forbidden(), services: CORE_SERVER_ONLY },
      404: NOT_OPEN_SESSION,
      409: { description: 'Sealing has not started for this session (INVALID_STATE).', schema: 'ApiError' },
      422: { ...INVALID_PATH_PARAMETER, services: CORE_SERVER_ONLY },
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const OPEN = { id: STATE_EXAMPLE_IDS.openSessionId } as const;
const command = (state: SessionCommandResponse['state']): SessionCommandResponse => ({ sessionId: STATE_EXAMPLE_IDS.openSessionId, state });
const START_DENIED = (operationId: string) => deniedExamples(operationId, 'SESSION_START', 'TECHNICIAN');
const NOTE_DENIED = (operationId: string) => deniedExamples(operationId, 'SESSION_NOTE', 'TECHNICIAN');
const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;
const BAD_PATH = { invalidPathParameter: ERROR_EXAMPLES.invalidPathParameter } as const;
const NOT_OPEN = {
  // W83 (gap W34-3): the server's texts are fixed and quote no part of the request.
  notFound: simRefusalExample('Not the open session', 'NOT_FOUND', 'This session is not the open session.', 'NOT_FOUND'),
} as const;
/** `409 INVALID_STATE` as the engine's refusal maps: the state the session is in and the event that did not fit. */
const wrongState = (from: string, event: string) => ({
  invalidState: simRefusalExample(`The session is ${from}`, 'INVALID_STATE', 'The action is not allowed in the current state.', 'ILLEGAL_STATE', { from, event }),
});
const CHECKS_RUNNING = (event: string) => ({
  precheckRunning: simRefusalExample('Checks still running', 'PRECHECK_RUNNING', 'Pre-recording checks are still running.', 'CHECKS_RUNNING', {
    from: 'PRECHECK',
    event,
  }),
});

/**
 * An entry of operation 38 for a session that recorded and could not be sealed (fix wave J round two; JW-22
 * remainder): `unsealableCause` is `details.cause` of its `SESSION_INCOMPLETE` audit row.
 */
export const SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE = {
  id: 'SES-20261001-0024',
  outcome: 'INCOMPLETE',
  caseNumber: 'LP/2026/1001-0002',
  subjectName: 'Wahyu Saputra',
  subjectType: 'TERSANGKA',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
  createdAt: 1790820000000,
  startedAt: 1790820060000,
  endedAt: 1790820120000,
  durationMs: 60000,
  sizeBytes: 0,
  evidenceId: null,
  faultKind: null,
  unsealableCause: 'SIGNING_KEY_UNAVAILABLE',
} as const satisfies SessionHistoryPage['items'][number];

export const SESSION_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  beginPrecheck: {
    pathParams: OPEN,
    responses: {
      202: { precheck: { summary: 'CREATE to PRECHECK', value: command('PRECHECK') } },
      401: SIGNED_OUT,
      403: START_DENIED('beginPrecheck'),
      404: NOT_OPEN,
      409: wrongState('ARMED', 'beginPrecheck'),
      422: BAD_PATH,
    },
  },
  retryPrecheck: {
    pathParams: OPEN,
    responses: {
      202: { precheck: { summary: 'The checks run again', value: command('PRECHECK') } },
      401: SIGNED_OUT,
      403: START_DENIED('retryPrecheck'),
      404: NOT_OPEN,
      409: { ...CHECKS_RUNNING('retryPrecheck'), ...wrongState('CREATE', 'retryPrecheck') },
      422: BAD_PATH,
    },
  },
  acknowledgePrecheckWarnings: {
    pathParams: OPEN,
    responses: {
      200: { armed: { summary: 'PRECHECK with warnings to ARMED', value: command('ARMED') } },
      401: SIGNED_OUT,
      403: START_DENIED('acknowledgePrecheckWarnings'),
      404: NOT_OPEN,
      409: {
        noWarnings: simRefusalExample('Nothing to acknowledge', 'INVALID_STATE', 'The pre-check has no warning to acknowledge.', 'NO_WARNINGS', {
          from: 'PRECHECK',
          event: 'acknowledgePrecheckWarnings',
        }),
        ...CHECKS_RUNNING('acknowledgePrecheckWarnings'),
      },
      422: BAD_PATH,
    },
  },
  cancelSession: {
    pathParams: OPEN,
    responses: {
      401: SIGNED_OUT,
      403: START_DENIED('cancelSession'),
      404: NOT_OPEN,
      409: wrongState('RECORDING', 'cancel'),
      422: BAD_PATH,
    },
  },
  scanCaseNumber: {
    responses: {
      200: { next: { summary: 'The next case number of the day', value: { caseNumber: 'LP/2026/1001-0008' } satisfies CaseNumberScan } },
      401: SIGNED_OUT,
      403: START_DENIED('scanCaseNumber'),
    },
  },
  recoverSession: {
    pathParams: OPEN,
    responses: {
      202: { recovery: { summary: 'FAULT to RECOVERY', value: command('RECOVERY') } },
      401: SIGNED_OUT,
      403: START_DENIED('recoverSession'),
      404: NOT_OPEN,
      409: wrongState('RECORDING', 'recover'),
      422: BAD_PATH,
    },
  },
  addSessionMarker: {
    pathParams: OPEN,
    request: {
      labelled: { summary: 'A marker with a label', value: { label: 'Subject shown exhibit A' } satisfies SessionMarkerRequest },
      unlabelled: { summary: 'No label: the Core names it "Marker n"', value: {} satisfies SessionMarkerRequest },
    },
    responses: {
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: NOTE_DENIED('addSessionMarker'),
      404: NOT_OPEN,
      409: wrongState('ARMED', 'addMarker'),
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  addSessionNote: {
    pathParams: OPEN,
    request: {
      note: {
        summary: 'An investigator note',
        value: { text: 'Subject confirms the statement of 30 September.' } satisfies SessionNoteRequest,
      },
    },
    responses: {
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: NOTE_DENIED('addSessionNote'),
      404: NOT_OPEN,
      409: wrongState('STOPPING', 'addNote'),
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  takeSessionSnapshot: {
    pathParams: OPEN,
    responses: {
      401: SIGNED_OUT,
      403: NOTE_DENIED('takeSessionSnapshot'),
      404: NOT_OPEN,
      409: wrongState('ARMED', 'snapshot'),
      422: BAD_PATH,
    },
  },
  acknowledgeSessionSummary: {
    pathParams: { id: EXAMPLE_SESSION_HISTORY[0]?.id ?? STATE_EXAMPLE_IDS.openSessionId },
    responses: {
      401: SIGNED_OUT,
      403: START_DENIED('acknowledgeSessionSummary'),
      422: BAD_PATH,
    },
  },
  listSessionHistory: {
    responses: {
      200: {
        newest: {
          summary: 'The two newest sessions, with more to come',
          value: { items: EXAMPLE_SESSION_HISTORY, nextCursor: '1790819100000-SES-20261001-0022' } satisfies SessionHistoryPage,
        },
        last: { summary: 'The last page', value: { items: [], nextCursor: null } satisfies SessionHistoryPage },
        unsealable: {
          summary: 'A recorded session whose seal was given up: no evidence item, its recordings in the quarantine folder, and the cause the Core recorded',
          value: { items: [SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE], nextCursor: null } satisfies SessionHistoryPage,
        },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
      422: { invalidQuery: ERROR_EXAMPLES.invalidQuery },
    },
  },
  // ── Operations 81-83 (task 3 M2-W7; C3 §2.2) ────────────────────────────────────────────────
  switchAudioSource: {
    pathParams: OPEN,
    request: {
      standby: {
        summary: 'Move AUDIO-01 to MIC-02 (the phone-sent form carries no extra member; the row names the device)',
        value: { inputId: 'MIC-02', reason: 'Mic 1 cable suspected loose' } satisfies AudioSourceSwitchRequest,
      },
    },
    // Audit row 149 (D130): the pre-D5 200 / 404 examples and the AUDIO_SOURCE_CONFLICT / INVALID_STATE 409s are gone with them.
    responses: {
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: deniedExamples('switchAudioSource', 'SESSION_START', 'TECHNICIAN'),
      409: {
        // Audit row 143 (D5; D28 DQ-2; register N-36): the answer of every call since the pairing.
        fixedByPairing: {
          summary: 'Retired: the audio of each track is fixed by its camera-microphone pair (no audit row)',
          value: apiErrorExample(AUDIO_SOURCE_FIXED_BY_PAIRING_CODE, AUDIO_SOURCE_FIXED_BY_PAIRING_MESSAGE),
        },
      },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  listAudioSourceIntervals: {
    pathParams: OPEN,
    responses: {
      200: {
        one: {
          summary: 'Two intervals: the run opened the first, the toggle opened the second',
          value: {
            items: [
              {
                sessionId: STATE_EXAMPLE_IDS.openSessionId,
                seq: 2,
                inputId: 'MIC-02',
                role: 'PRIMARY',
                fromMs: 5_324,
                toMs: null,
                fromAt: 1_790_823_600_000,
                toAt: null,
                switchedBy: 'OPR-001',
                reason: 'MANUAL',
              },
              {
                sessionId: STATE_EXAMPLE_IDS.openSessionId,
                seq: 1,
                inputId: 'MIC-01',
                role: 'PRIMARY',
                fromMs: 0,
                toMs: 5_303,
                fromAt: 1_790_823_594_676,
                toAt: 1_790_823_600_000,
                switchedBy: null,
                reason: 'START',
              },
            ],
            nextCursor: null,
          } satisfies AudioSourceIntervalPage,
        },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
      404: NOT_OPEN,
      422: { invalidQuery: ERROR_EXAMPLES.invalidQuery },
    },
  },
  getSealingProgress: {
    pathParams: OPEN,
    responses: {
      200: {
        sealing: {
          summary: 'FINALIZING: building the manifest, not resumed',
          value: {
            sessionId: STATE_EXAMPLE_IDS.openSessionId,
            state: 'FINALIZING',
            steps: [
              { id: 'CLOSE_TRACKS', status: 'done', startedAt: 1_790_823_600_000, completedAt: 1_790_823_601_200, durationMs: 1_200 },
              { id: 'FINALIZE_HASHES', status: 'done', startedAt: 1_790_823_601_200, completedAt: 1_790_823_603_400, durationMs: 2_200 },
              { id: 'FINALIZE_TRANSCRIPT', status: 'done', startedAt: 1_790_823_603_400, completedAt: 1_790_823_604_100, durationMs: 700 },
              { id: 'BUILD_MANIFEST', status: 'active', startedAt: 1_790_823_604_100, completedAt: null, durationMs: null },
              { id: 'SIGN_MANIFEST', status: 'pending', startedAt: null, completedAt: null, durationMs: null },
              { id: 'STORE_SEALED_PACKAGE', status: 'pending', startedAt: null, completedAt: null, durationMs: null },
            ],
            progressPct: 62,
            etaMs: 4_000,
            resumed: false,
            updatedAt: 1_790_823_605_000,
          } satisfies SealingProgressBody,
        },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
      404: NOT_OPEN,
      409: wrongState('RECORDING', 'getSealingProgress'),
      422: BAD_PATH,
    },
  },
};
