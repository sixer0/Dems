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
import { AuditType, Permission } from '../sim/vocabulary';
import { API_BASE_PATH, API_PAGE_LIMIT_DEFAULT } from './constants';
import {
  AUTHENTICATED_ACCESS,
  CORE_SERVER_ONLY,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import type { SessionCommandResponse } from './core-api';
import { BASIC_403_EXAMPLES, ERROR_EXAMPLES, deniedExamples, simRefusalExample } from './example-parts';
import type { OperationExamples } from './examples';
import {
  INVALID_INPUT,
  INVALID_JSON,
  INVALID_PATH_PARAMETER,
  INVALID_QUERY,
  LIST_READ_NOTE,
  NOT_SIGNED_IN,
  backendSource,
  forbidden,
  hostedNote,
  notPermitted,
} from './operation-parts';
import { CASE_NUMBER_PATTERN, SESSION_ID_PATTERN } from './patterns';
import { boundedText, nextCursor, pageCursor, pageLimit } from './schema-parts';
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
      'Starts the eight pre-recording checks of a session in **CREATE** and answers `202` with state **PRECHECK**. The checks resolve on the Core over the next seconds; their progress and their outcome arrive in the `session` slice.',
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
      hostedNote('recover'),
    ].join('\n\n'),
    source: backendSource(SECTION, 33),
    pathParam: SESSION_PARAM,
    responses: {
      202: { description: 'The recovery is running (state RECOVERY).', schema: COMMAND },
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
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const OPEN = { id: STATE_EXAMPLE_IDS.openSessionId } as const;
const command = (state: SessionCommandResponse['state']): SessionCommandResponse => ({ sessionId: STATE_EXAMPLE_IDS.openSessionId, state });
const START_DENIED = (operationId: string) => deniedExamples(operationId, 'SESSION_START', 'TECHNICIAN');
const NOTE_DENIED = (operationId: string) => deniedExamples(operationId, 'SESSION_NOTE', 'TECHNICIAN');
const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;
const BAD_PATH = { invalidPathParameter: ERROR_EXAMPLES.invalidPathParameter } as const;
const NOT_OPEN = {
  notFound: simRefusalExample('Not the open session', 'NOT_FOUND', `Session ${STATE_EXAMPLE_IDS.otherSessionId} is not the current session.`, 'NOT_FOUND'),
} as const;
/** `409 INVALID_STATE` as the engine's refusal maps: the state the session is in and the event that did not fit. */
const wrongState = (from: string, event: string) => ({
  invalidState: simRefusalExample(`The session is ${from}`, 'INVALID_STATE', `Session ${STATE_EXAMPLE_IDS.openSessionId} is ${from}.`, 'ILLEGAL_STATE', { from, event }),
});
const CHECKS_RUNNING = (event: string) => ({
  precheckRunning: simRefusalExample('Checks still running', 'PRECHECK_RUNNING', 'Pre-recording checks are still running.', 'CHECKS_RUNNING', {
    from: 'PRECHECK',
    event,
  }),
});

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
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
      422: { invalidQuery: ERROR_EXAMPLES.invalidQuery },
    },
  },
};
