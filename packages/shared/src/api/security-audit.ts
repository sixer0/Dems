/**
 * Area 9 of the Core API: security and audit (backend task: 2026-10-04 01_specs §7.13, §7.17,
 * §7.18; plan row W27, contract C).
 *
 * Six operations, answered by the Core server only.
 *
 * | # | operationId | Access | Audit on success | Simulator action |
 * |--:|-------------|--------|------------------|------------------|
 * | 58 | `getSecurityStatus` | AUTHENTICATED | NONE-R | reads `security`, and the head and total of `audit` |
 * | 59 | `listAuditRows` | AUTHENTICATED | NONE-R | reads `audit` |
 * | 60 | `verifyAuditChain` | AUTHENTICATED | NONE-R | `verifyAuditChain` |
 * | 61 | `exportAudit` | AUDIT_EXPORT | AUDIT_EXPORTED; denial EXPORT_DENIED | `exportAudit` |
 * | 62 | `exportLogs` | AUDIT_EXPORT | AUDIT_EXPORTED (`details.scope: LOGS`); denial EXPORT_DENIED | `exportLogs` |
 * | 63 | `listEvents` | AUTHENTICATED | NONE-R | reads `events` |
 *
 * Every signed-in role reads the audit log, the events and the chain status, as every role opens
 * the Security & Audit page today (GS-02). The two exports keep today's denial type EXPORT_DENIED
 * (RB-5); their refusal code is NOT_PERMITTED, and FORBIDDEN stays the code of `exportEvidence`.
 *
 * An audit row is delivered with `seq`, `prevHash`, `hash` and its full hashed body, so a client
 * can verify the chain itself. Neither export returns a file: a client builds the file from the
 * pages of `listAuditRows` and `listEvents` after the server accepted the export (01_specs §11).
 */
import { z } from 'zod';
import { EXPORT_REASON_MIN_LENGTH } from '../sim/constants';
import {
  AuditCategory,
  AuditType,
  Permission,
  ScenarioName,
  Severity,
  SimEventCategory,
  SimEventType,
} from '../sim/vocabulary';
import { API_BASE_PATH, API_PAGE_LIMIT_DEFAULT, EXPORT_REASON_MAX_LENGTH } from './constants';
import {
  AUTHENTICATED_ACCESS,
  CORE_SERVER_ONLY,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import { BASIC_403_EXAMPLES, ERROR_EXAMPLES, deniedExamples, exampleTime, simRefusalExample } from './example-parts';
import type { OperationExamples } from './examples';
import {
  INVALID_JSON,
  INVALID_QUERY,
  LIST_READ_NOTE,
  NOT_SIGNED_IN,
  STATE_READ_NOTE,
  backendSource,
  exportNotPermitted,
  forbidden,
  hostedNote,
} from './operation-parts';
import { EXPORT_ID_PATTERN } from './patterns';
import {
  boundedText,
  count,
  epochMs,
  evidenceId,
  nextCursor,
  operatorId,
  pageCursor,
  pageLimit,
  sessionId,
  sha256Hex,
} from './schema-parts';
import { EXAMPLE_AUDIT, EXAMPLE_EVENTS, EXAMPLE_SLICES } from './state-examples';
import { AuditRowSchema, REPLICATED_SLICE_SCHEMAS, SimEventSchema } from './state-slices';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

export const SecurityStatusSchema = z
  .strictObject({
    security: REPLICATED_SLICE_SCHEMAS.security,
    auditHead: sha256Hex().describe('Hash of the newest audit row of the stored chain; 64 zeros when the chain is empty.'),
    auditTotal: count().describe('Rows of the stored chain: the `seq` of its newest row.'),
  })
  .describe('The `security` slice in its wire form, with the head and the row count of the audit chain.');
export type SecurityStatus = z.output<typeof SecurityStatusSchema>;

/** Order of `listAuditRows` by `seq`. */
export const ListOrder = { ASC: 'ASC', DESC: 'DESC' } as const;
export type ListOrder = (typeof ListOrder)[keyof typeof ListOrder];

export const AuditListQuerySchema = z
  .object({
    category: z.enum(AuditCategory).optional().describe('Only rows of this category.'),
    type: z.enum(AuditType).optional().describe('Only rows of this audit type.'),
    actorId: operatorId().optional().describe('Only rows whose actor is this operator (`OPR-NNN`).'),
    sessionId: sessionId().optional().describe('Only rows of this session.'),
    evidenceId: evidenceId().optional().describe('Only rows of this evidence item.'),
    order: z
      .enum(ListOrder)
      .optional()
      .describe('By `seq`: ASC is the order of the chain, oldest first, and is used when omitted; DESC is newest first.'),
    cursor: pageCursor(),
    limit: pageLimit(),
  })
  .describe('Query of `GET /api/v1/audit`: filters, the order and the paging members of API-9.');
export type AuditListQuery = z.output<typeof AuditListQuerySchema>;

export const AuditPageSchema = z
  .strictObject({
    rows: z.array(AuditRowSchema).describe('Audit rows in the order asked for, each with its full hashed body.'),
    head: sha256Hex().describe('Hash of the newest row of the stored chain at the time of the read.'),
    total: count().describe('Rows of the stored chain at the time of the read, whatever the filters.'),
    nextCursor: nextCursor(),
  })
  .describe('One page of audit rows. Rows are ordered by `seq`, so paging stays stable while rows are appended.');
export type AuditPage = z.output<typeof AuditPageSchema>;

/** Why the check of a chain stopped at a row (the simulator's `ChainVerifyResult`). */
export const ChainBreakReason = {
  HASH_MISMATCH: 'HASH_MISMATCH',
  PREV_LINK_BROKEN: 'PREV_LINK_BROKEN',
  SEQ_GAP: 'SEQ_GAP',
} as const;
export type ChainBreakReason = (typeof ChainBreakReason)[keyof typeof ChainBreakReason];

export const ChainVerifyResultSchema = z
  .discriminatedUnion('ok', [
    z.strictObject({
      ok: z.literal(true),
      checked: count().describe('Rows checked: every row of the view.'),
      head: sha256Hex(),
    }),
    z.strictObject({
      ok: z.literal(false),
      checked: count().describe('Rows that verified before the first bad one.'),
      index: count().describe('Position of the first bad row in the view (`audit.rows`).'),
      seq: count().describe('`seq` of the first bad row.'),
      reason: z.enum(ChainBreakReason),
    }),
  ])
  .describe('Result of the shared chain check over the audit view: the simulator\'s `ChainVerifyResult`.');
export type ChainVerifyResultBody = z.output<typeof ChainVerifyResultSchema>;

/** Why a chain was discarded (03_database_contract `CHAIN_DISCARD_REASON`). */
export const ChainDiscardReason = { RESET: 'RESET', SCENARIO_LOAD: 'SCENARIO_LOAD' } as const;
export type ChainDiscardReason = (typeof ChainDiscardReason)[keyof typeof ChainDiscardReason];

/** `lineage` of `AuditChainStatus` holds at most this many entries, the newest ones. */
export const AUDIT_CHAIN_LINEAGE_MAX = 20;

export const AuditChainLineageEntrySchema = z
  .strictObject({
    epoch: count().describe('The epoch the discarded chain ended in.'),
    rows: count().describe('Rows of the discarded chain.'),
    head: sha256Hex().describe('Head hash of the discarded chain.'),
    resetAt: epochMs().describe('When the reset ran, on the server clock.'),
    actorId: operatorId().nullable().describe('The operator who ran it; null for a reset from the command line.'),
    scenario: z.enum(ScenarioName).describe('The scenario the reset loaded (`idle` for a reset to the seed state).'),
    reason: z.enum(ChainDiscardReason),
  })
  .describe('One audit chain that a demo reset or a scenario load discarded.');
export type AuditChainLineageEntry = z.output<typeof AuditChainLineageEntrySchema>;

export const AuditChainStatusSchema = z
  .strictObject({
    view: ChainVerifyResultSchema.describe(
      'The shared check over the audit view the engine holds: what the screens show, and what the demo fault AUDIT_TAMPER breaks.',
    ),
    stored: z
      .strictObject({
        ok: z.boolean(),
        checked: count().describe('The `seq` the stored chain has been verified through.'),
        head: sha256Hex().describe('Head hash of the stored chain.'),
        firstBadSeq: count().nullable().describe('`seq` of the first stored row that does not verify; null while the chain verifies.'),
      })
      .describe('The check over the stored table, which no demo fault can break. It is incremental: a call verifies only the rows above the last verified one.'),
    lineage: z
      .array(AuditChainLineageEntrySchema)
      .max(AUDIT_CHAIN_LINEAGE_MAX)
      .describe(`The chains that earlier resets discarded, newest first, at most ${AUDIT_CHAIN_LINEAGE_MAX}.`),
    lineageTotal: count().describe('How many chains were discarded in all.'),
  })
  .describe('Status of the audit chain: the view, the stored table, and the lineage of discarded chains.');
export type AuditChainStatus = z.output<typeof AuditChainStatusSchema>;

/**
 * Limits of the texts of an audit or log export. The reason is mandatory in Live mode (01_specs
 * §7.13): the body is required and so is the reason, so the export record and its audit row always
 * hold one (the simulator's form without a request, which records none, cannot be reached through
 * the contract). The destination bound is the simulator's cut length in UTF-16 code units: the
 * contract refuses a longer one, so the engine never cuts it (finding F-1 of contract B). The
 * reason has no upper bound in the specification; `EXPORT_REASON_MAX_LENGTH` caps it for all
 * three exports.
 */
export const AUDIT_EXPORT_LIMITS = { reasonMin: EXPORT_REASON_MIN_LENGTH, reasonMax: EXPORT_REASON_MAX_LENGTH, destinationMax: 120 } as const;

export const AuditExportRequestSchema = z
  .object({
    reason: boundedText(AUDIT_EXPORT_LIMITS.reasonMax, AUDIT_EXPORT_LIMITS.reasonMin).describe(
      `Purpose of the export: ${AUDIT_EXPORT_LIMITS.reasonMin} to ${AUDIT_EXPORT_LIMITS.reasonMax} characters after trimming. It is recorded in the AUDIT_EXPORTED row.`,
    ),
    destination: boundedText(AUDIT_EXPORT_LIMITS.destinationMax, 0)
      .optional()
      .describe(
        `Destination or approved media identifier: at most ${AUDIT_EXPORT_LIMITS.destinationMax} UTF-16 code units after trimming. Omitted or empty means "Audit archive (simulated)".`,
      ),
  })
  .describe('Request body of `POST /api/v1/audit/export` and `POST /api/v1/logs/export`.');
export type AuditExportRequestBody = z.output<typeof AuditExportRequestSchema>;

/** What an accepted export covers: the audit chain, or the log bundle (the chain and the events). */
export const AuditExportScope = { AUDIT: 'AUDIT', LOGS: 'LOGS' } as const;
export type AuditExportScope = (typeof AuditExportScope)[keyof typeof AuditExportScope];

export const AuditExportAcceptedSchema = z
  .strictObject({
    exportId: z.string().regex(EXPORT_ID_PATTERN),
    scope: z.enum(AuditExportScope),
    rows: count().describe('Audit rows the export covers.'),
    head: sha256Hex().describe('Head hash of the chain the export covers.'),
  })
  .describe('Export accepted. The ExportEvent is the AUDIT_EXPORTED audit row it wrote; the client builds the file.');
export type AuditExportAccepted = z.output<typeof AuditExportAcceptedSchema>;

export const EventListQuerySchema = z
  .object({
    category: z.enum(SimEventCategory).optional().describe('Only events of this category.'),
    type: z.enum(SimEventType).optional().describe('Only events of this type.'),
    severity: z.enum(Severity).optional().describe('Only events of this severity.'),
    cursor: pageCursor(),
    limit: pageLimit(),
  })
  .describe('Query of `GET /api/v1/events`: filters and the paging members of API-9.');
export type EventListQuery = z.output<typeof EventListQuerySchema>;

export const EventPageSchema = z
  .strictObject({
    events: z.array(SimEventSchema).describe('Operational events by `seq`, oldest first.'),
    nextCursor: nextCursor(),
  })
  .describe('One page of operational events. Events are ordered by `seq`, so paging stays stable while events are appended.');
export type EventPage = z.output<typeof EventPageSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const SECURITY_AUDIT_SCHEMAS = {
  SecurityStatus: SecurityStatusSchema,
  AuditListQuery: AuditListQuerySchema,
  AuditPage: AuditPageSchema,
  ChainVerifyResult: ChainVerifyResultSchema,
  AuditChainLineageEntry: AuditChainLineageEntrySchema,
  AuditChainStatus: AuditChainStatusSchema,
  AuditExportRequest: AuditExportRequestSchema,
  AuditExportAccepted: AuditExportAcceptedSchema,
  EventListQuery: EventListQuerySchema,
  EventPage: EventPageSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.13';
const AUDIT_PATH = `${API_BASE_PATH}/audit`;
const READ_AUDIT = { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED } as const;
const AUDIT_EXPORT = permissionAccess(Permission.AUDIT_EXPORT);
/** RB-5: the audit export and the log export keep today's denial type. */
const EXPORT_AUDIT = { success: AuditType.AUDIT_EXPORTED, denial: AuditType.EXPORT_DENIED } as const;
const EXPORT_REFUSED = exportNotPermitted(Permission.AUDIT_EXPORT);
const INVALID_EXPORT = {
  description: `The reason is shorter than ${AUDIT_EXPORT_LIMITS.reasonMin} characters (INVALID_REASON), or the body does not match its schema (INVALID_INPUT): a text that is too long, or one that holds U+0000 or an unpaired surrogate (API-13).`,
  schema: 'ApiError',
} as const;
const NO_FILE =
  'The answer holds no file. The client builds it from the pages of `GET /api/v1/audit` (and of `GET /api/v1/events` for the log bundle) once the export is accepted.';

export const SECURITY_AUDIT_OPERATIONS = [
  {
    operationId: 'getSecurityStatus',
    method: 'get',
    path: `${API_BASE_PATH}/security/status`,
    tag: CoreApiTag.SECURITY,
    mode: CoreApiMode.LIVE,
    summary: 'Security status',
    description: [
      'The security state of the Core device: the posture, the TPM, secure boot, the tamper switch, the controls and the records of the simulated keys. Slice `security`, with the head hash and the row count of the audit chain.',
      'A key record holds an identifier, an algorithm, a fingerprint and an expiry. No operation returns key material: the demo has none.',
      STATE_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 58),
    responses: {
      200: { description: 'The slice, and the head and total of the audit chain.', schema: 'SecurityStatus' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
    },
    access: AUTHENTICATED_ACCESS,
    audit: READ_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'listAuditRows',
    method: 'get',
    path: AUDIT_PATH,
    tag: CoreApiTag.SECURITY,
    mode: CoreApiMode.LIVE,
    summary: 'Audit log',
    description: [
      `The rows of the audit chain in pages of ${API_PAGE_LIMIT_DEFAULT} unless \`limit\` says otherwise, ordered by \`seq\`: oldest first, or newest first with \`order=DESC\`. Five filters narrow the list.`,
      'Each row carries `seq`, `prevHash`, `hash` and its full hashed body, so a client can verify the chain over the rows it received. Every signed-in role may read the audit log.',
      LIST_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 59),
    query: { schema: 'AuditListQuery' },
    responses: {
      200: { description: 'One page of audit rows, with the head and the total of the chain.', schema: 'AuditPage' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
      422: INVALID_QUERY,
    },
    access: AUTHENTICATED_ACCESS,
    audit: READ_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'verifyAuditChain',
    method: 'get',
    path: `${AUDIT_PATH}/chain`,
    tag: CoreApiTag.SECURITY,
    mode: CoreApiMode.LIVE,
    summary: 'Verify the audit chain',
    description: [
      'Reports three things about the audit chain.',
      [
        '- `view`: the shared chain check over the audit view the engine holds. It is what the screens show, and what the demo fault AUDIT_TAMPER breaks.',
        '- `stored`: the check over the stored table, which no demo fault can break. It is incremental: the server remembers the row it verified through, so a call reads only the rows above it, and calls that arrive together share one run.',
        `- \`lineage\`: the chains that earlier demo resets and scenario loads discarded, newest first, at most ${AUDIT_CHAIN_LINEAGE_MAX}, with \`lineageTotal\`. It keeps every reset traceable after more than one reset.`,
      ].join('\n'),
      'A GET: it writes no row and changes nothing. Every signed-in role may call it.',
      hostedNote('verifyAuditChain'),
    ].join('\n\n'),
    source: backendSource(SECTION, 60),
    responses: {
      200: { description: 'The status of the view, of the stored chain, and the lineage.', schema: 'AuditChainStatus' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
    },
    access: AUTHENTICATED_ACCESS,
    audit: READ_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'exportAudit',
    method: 'post',
    path: `${AUDIT_PATH}/export`,
    tag: CoreApiTag.SECURITY,
    mode: CoreApiMode.LIVE,
    summary: 'Export the audit log',
    description: [
      'Accepts an export of the audit log with a mandatory reason and records it. **RBAC + audit**: a role without AUDIT_EXPORT is refused with `403` and one EXPORT_DENIED row.',
      'Writes AUDIT_EXPORTED with the export ID, the row count, the head hash, the reason and the destination.',
      NO_FILE,
      hostedNote('exportAudit'),
    ].join('\n\n'),
    source: backendSource(SECTION, 61),
    requestBody: { schema: 'AuditExportRequest', required: true },
    responses: {
      202: { description: 'Export accepted and audited.', schema: 'AuditExportAccepted' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: EXPORT_REFUSED,
      422: INVALID_EXPORT,
    },
    access: AUDIT_EXPORT,
    audit: EXPORT_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'exportLogs',
    method: 'post',
    path: `${API_BASE_PATH}/logs/export`,
    tag: CoreApiTag.SECURITY,
    mode: CoreApiMode.LIVE,
    summary: 'Export the log bundle',
    description: [
      'Accepts an export of the log bundle, which is the audit chain and the operational events, with a mandatory reason and records it. **RBAC + audit**: a role without AUDIT_EXPORT is refused with `403` and one EXPORT_DENIED row.',
      'Writes AUDIT_EXPORTED with `details.scope: LOGS`, the export ID, the counts, the head hash, the reason and the destination.',
      NO_FILE,
      hostedNote('exportLogs'),
    ].join('\n\n'),
    source: backendSource(SECTION, 62),
    requestBody: { schema: 'AuditExportRequest', required: true },
    responses: {
      202: { description: 'Export accepted and audited.', schema: 'AuditExportAccepted' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: EXPORT_REFUSED,
      422: INVALID_EXPORT,
    },
    access: AUDIT_EXPORT,
    audit: EXPORT_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'listEvents',
    method: 'get',
    path: `${API_BASE_PATH}/events`,
    tag: CoreApiTag.SECURITY,
    mode: CoreApiMode.LIVE,
    summary: 'Operational events',
    description: [
      `The operational events in pages of ${API_PAGE_LIMIT_DEFAULT} unless \`limit\` says otherwise, by \`seq\`, oldest first. Three filters narrow the list.`,
      'An event never holds a password, a token, a code or a credential. Every signed-in role may read the events.',
      LIST_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 63),
    query: { schema: 'EventListQuery' },
    responses: {
      200: { description: 'One page of events.', schema: 'EventPage' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
      422: INVALID_QUERY,
    },
    access: AUTHENTICATED_ACCESS,
    audit: READ_AUDIT,
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;
const { head: HEAD, total: TOTAL } = EXAMPLE_AUDIT;

const EXPORT_REQUEST = {
  reason: 'Quarterly audit review by the supervisor',
  destination: 'Audit archive (simulated)',
} satisfies AuditExportRequestBody;

const EXPORT_422 = {
  invalidReason: simRefusalExample(
    'Reason too short',
    'INVALID_REASON',
    `An export reason of at least ${AUDIT_EXPORT_LIMITS.reasonMin} characters is required.`,
    'REASON_TOO_SHORT',
  ),
  invalidInput: ERROR_EXAMPLES.invalidInput,
} as const;

const exportExamples = (operationId: string, exportId: string, scope: AuditExportScope): OperationExamples => ({
  request: { review: { summary: 'Export for an audit review', value: EXPORT_REQUEST } },
  responses: {
    202: {
      accepted: {
        summary: 'SUPERVISOR: accepted and audited',
        value: { exportId, scope, rows: TOTAL, head: HEAD } satisfies AuditExportAccepted,
      },
    },
    400: { invalidJson: ERROR_EXAMPLES.invalidJson },
    401: SIGNED_OUT,
    403: deniedExamples(operationId, 'AUDIT_EXPORT', 'INVESTIGATOR'),
    422: EXPORT_422,
  },
});

/** The chain of the idle state at the example instant: 82 rows, all of them verified. */
const CHAIN_INTACT: AuditChainStatus = {
  view: { ok: true, checked: TOTAL, head: HEAD },
  stored: { ok: true, checked: TOTAL, head: HEAD, firstBadSeq: null },
  lineage: [],
  lineageTotal: 0,
};

/**
 * The same chain while the demo fault AUDIT_TAMPER is active (the simulator's own result at the
 * example instant: the row with `seq` 78 no longer hashes to its value), after one earlier reset.
 * The stored chain is intact. The lineage entry is an illustration: the dataset has none.
 */
const CHAIN_VIEW_TAMPERED: AuditChainStatus = {
  view: { ok: false, checked: 77, index: 77, seq: 78, reason: 'HASH_MISMATCH' },
  stored: { ok: true, checked: TOTAL, head: HEAD, firstBadSeq: null },
  lineage: [
    {
      epoch: 0,
      rows: 97,
      head: 'ecdc0f0506619fcc18bb6f9d7ace1d8b2d733c4ea0fd79891bac322553c7fbe8',
      resetAt: exampleTime(-45),
      actorId: 'OPR-002',
      scenario: 'idle',
      reason: 'RESET',
    },
  ],
  lineageTotal: 1,
};

export const SECURITY_AUDIT_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  getSecurityStatus: {
    responses: {
      200: {
        secure: {
          summary: 'Posture SECURE, 82 audit rows',
          value: { security: EXAMPLE_SLICES.security, auditHead: HEAD, auditTotal: TOTAL } satisfies SecurityStatus,
        },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
    },
  },
  listAuditRows: {
    responses: {
      200: {
        newest: {
          summary: 'The last page in chain order: the two newest rows',
          value: { rows: EXAMPLE_AUDIT.rows, head: HEAD, total: TOTAL, nextCursor: null } satisfies AuditPage,
        },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
      422: { invalidQuery: ERROR_EXAMPLES.invalidQuery },
    },
  },
  verifyAuditChain: {
    responses: {
      200: {
        intact: { summary: 'View and stored chain verify; no reset yet', value: CHAIN_INTACT },
        viewTampered: { summary: 'AUDIT_TAMPER active: the view is broken, the stored chain is intact', value: CHAIN_VIEW_TAMPERED },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
    },
  },
  exportAudit: exportExamples('exportAudit', 'EXP-000032', AuditExportScope.AUDIT),
  exportLogs: exportExamples('exportLogs', 'EXP-000033', AuditExportScope.LOGS),
  listEvents: {
    responses: {
      200: {
        newest: {
          summary: 'The last page: the two newest events',
          value: { events: EXAMPLE_EVENTS, nextCursor: null } satisfies EventPage,
        },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
      422: { invalidQuery: ERROR_EXAMPLES.invalidQuery },
    },
  },
};
