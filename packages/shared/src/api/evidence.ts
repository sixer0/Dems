/**
 * Area 5 of the Core API: evidence (backend task: 2026-10-04 01_specs §7.9, §7.17, §7.18, §11; plan
 * row W27, contract C).
 *
 * Five operations make up the area. `exportEvidence` (42) is a design-book operation and lives in
 * `core-api.ts`; the four below are answered by the Core server only.
 *
 * | # | operationId | Access | Audit on success | Simulator action |
 * |--:|-------------|--------|------------------|------------------|
 * | 39 | `listEvidence` | EVIDENCE_VIEW | NONE-R | reads `evidence` |
 * | 40 | `getEvidence` | EVIDENCE_VIEW | NONE-R | reads `evidence` |
 * | 41 | `verifyEvidence` | EVIDENCE_VIEW | EVIDENCE_VERIFIED or EVIDENCE_VERIFY_FAILED, by the verdict | `verify` |
 * | 43 | `archiveEvidence` | EVIDENCE_REVIEW | EVIDENCE_ARCHIVED (none when already archived) | `archiveEvidence` |
 *
 * Domain rules (I11): no operation changes the tracks, the track hashes, the manifest hash or the
 * signature of an item; a status change adds a custody entry and an audit row; AUDIO-01 and
 * AUDIO-02 are separate tracks in every answer. No operation sets the status UNDER_REVIEW.
 *
 * Media is not served (01_specs §11, MS-1): the clients keep their bundled demo media, and
 * `getEvidence` says with `EvidenceMediaRef` whether a bundled package belongs to the item. There
 * is no operation that returns a file, and none that takes one.
 */
import { z } from 'zod';
import { TrackId } from '../domain/enums';
import { AuditType, CaseType, EvidenceStatus, Permission } from '../sim/vocabulary';
import { API_BASE_PATH, API_PAGE_LIMIT_DEFAULT } from './constants';
import {
  CORE_SERVER_ONLY,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import { BASIC_403_EXAMPLES, ERROR_EXAMPLES, deniedExamples, simRefusalExample } from './example-parts';
import type { OperationExamples } from './examples';
import {
  INVALID_PATH_PARAMETER,
  INVALID_QUERY,
  LIST_READ_NOTE,
  NOT_SIGNED_IN,
  backendSource,
  hostedNote,
  notPermitted,
} from './operation-parts';
import { DEMO_PACKAGE_SUFFIX_PATTERN, EVIDENCE_ID_PATTERN } from './patterns';
import { boundedText, epochMs, evidenceId, nextCursor, pageCursor, pageLimit, sha256Hex } from './schema-parts';
import { EXAMPLE_EVIDENCE_ITEM, STATE_EXAMPLE_IDS } from './state-examples';
import { EvidenceItemSchema } from './state-slices';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Longest search text of `listEvidence`, in characters and in UTF-16 code units. */
export const EVIDENCE_SEARCH_MAX_LENGTH = 100;

export const EvidenceListQuerySchema = z
  .object({
    status: z.enum(EvidenceStatus).optional().describe('Only items with this status.'),
    caseType: z.enum(CaseType).optional().describe('Only items of this case type (the subject type of the session).'),
    q: boundedText(EVIDENCE_SEARCH_MAX_LENGTH)
      .optional()
      .describe(
        `Search text, 1 to ${EVIDENCE_SEARCH_MAX_LENGTH} characters after trimming: matched without regard to case against the evidence ID, the session ID, the case number and the subject name.`,
      ),
    cursor: pageCursor(),
    limit: pageLimit(),
  })
  .describe('Query of `GET /api/v1/evidence`: filters, a search text and the paging members of API-9.');
export type EvidenceListQuery = z.output<typeof EvidenceListQuerySchema>;

export const EvidencePageSchema = z
  .strictObject({
    items: z.array(EvidenceItemSchema).describe('Evidence items, newest recording first: the elements of the `evidence` slice.'),
    nextCursor: nextCursor(),
  })
  .describe('One page of evidence items.');
export type EvidencePage = z.output<typeof EvidencePageSchema>;

/** Where the media of an evidence item comes from (01_specs §11, MS-2). */
export const EvidenceMediaSource = { DEMO_PACKAGE: 'DEMO_PACKAGE', NONE: 'NONE' } as const;
export type EvidenceMediaSource = (typeof EvidenceMediaSource)[keyof typeof EvidenceMediaSource];

export const EvidenceMediaRefSchema = z
  .strictObject({
    source: z
      .enum(EvidenceMediaSource)
      .describe('DEMO_PACKAGE: the demo package a client bundles belongs to this item. NONE: no media exists for it (a session recorded in Live mode).'),
    packageSuffix: z
      .string()
      .regex(DEMO_PACKAGE_SUFFIX_PATTERN)
      .nullable()
      .describe('The join key of the bundled package, e.g. `0004`; null when the source is NONE.'),
  })
  .refine((ref) => (ref.source === EvidenceMediaSource.DEMO_PACKAGE) === (ref.packageSuffix !== null), {
    error: 'packageSuffix is set exactly when the source is DEMO_PACKAGE.',
    path: ['packageSuffix'],
  })
  .describe('Which bundled media belongs to an evidence item. It names no file and no path: the server serves no media (MS-1, MS-3).');
export type EvidenceMediaRef = z.output<typeof EvidenceMediaRefSchema>;

export const EvidenceDetailSchema = z
  .strictObject({
    evidence: EvidenceItemSchema,
    media: EvidenceMediaRefSchema,
  })
  .describe('One evidence item and the reference to its media.');
export type EvidenceDetail = z.output<typeof EvidenceDetailSchema>;

export const EvidenceVerifyResultSchema = z
  .strictObject({
    evidenceId: evidenceId(),
    ok: z.boolean().describe('True when every track, the manifest and the signature verify.'),
    at: epochMs().describe('When the verification ran, on the server clock.'),
    tracks: z
      .array(
        z.strictObject({
          trackId: z.enum(TrackId),
          expected: sha256Hex().describe('The sealed hash of the track.'),
          actual: sha256Hex().describe('The hash the verification computed.'),
          ok: z.boolean(),
        }),
      )
      .describe('One result per track: VIDEO-01, VIDEO-02, AUDIO-01 and AUDIO-02, each on its own.'),
    manifestOk: z.boolean(),
    signatureOk: z.boolean(),
  })
  .describe('The verdict of record of an integrity verification: the simulator\'s `EvidenceVerifyResult`.');
export type EvidenceVerifyResultBody = z.output<typeof EvidenceVerifyResultSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const EVIDENCE_SCHEMAS = {
  EvidenceListQuery: EvidenceListQuerySchema,
  EvidencePage: EvidencePageSchema,
  EvidenceMediaRef: EvidenceMediaRefSchema,
  EvidenceDetail: EvidenceDetailSchema,
  EvidenceVerifyResult: EvidenceVerifyResultSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.9';
const EVIDENCE_PATH = `${API_BASE_PATH}/evidence`;
const EVIDENCE_VIEW = permissionAccess(Permission.EVIDENCE_VIEW);
const DENIED = { denial: AuditType.ACCESS_DENIED } as const;
const EVIDENCE_PARAM = { name: 'id', description: 'Evidence ID `EV-{YYYYMMDD}-NNNN`.', pattern: EVIDENCE_ID_PATTERN } as const;
const VIEW_REFUSED = notPermitted(Permission.EVIDENCE_VIEW);
const UNKNOWN_EVIDENCE = { description: 'No evidence item has this ID (NOT_FOUND).', schema: 'ApiError' } as const;
const NO_MEDIA = 'The answer never holds a file or a path: media and package files are not served (01_specs §11).';

export const EVIDENCE_OPERATIONS = [
  {
    operationId: 'listEvidence',
    method: 'get',
    path: EVIDENCE_PATH,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.LIVE,
    summary: 'Evidence list',
    description: [
      `The evidence items, newest recording first, in pages of ${API_PAGE_LIMIT_DEFAULT} unless \`limit\` says otherwise. \`status\` and \`caseType\` filter; \`q\` searches the evidence ID, the session ID, the case number and the subject name.`,
      'Each item carries its four tracks with their own hashes, the manifest hash, the simulated signature and the custody chain.',
      LIST_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 39),
    query: { schema: 'EvidenceListQuery' },
    responses: {
      200: { description: 'One page of evidence items.', schema: 'EvidencePage' },
      401: NOT_SIGNED_IN,
      403: VIEW_REFUSED,
      422: INVALID_QUERY,
    },
    access: EVIDENCE_VIEW,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getEvidence',
    method: 'get',
    path: `${EVIDENCE_PATH}/{id}`,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.LIVE,
    summary: 'Evidence item',
    description: [
      'One evidence item, and the reference to its media: whether the demo package a client bundles belongs to the item, and under which suffix. A client shows bundled media for an item only when the source is DEMO_PACKAGE.',
      NO_MEDIA,
      LIST_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 40),
    pathParam: EVIDENCE_PARAM,
    responses: {
      200: { description: 'The item and its media reference.', schema: 'EvidenceDetail' },
      401: NOT_SIGNED_IN,
      403: VIEW_REFUSED,
      404: UNKNOWN_EVIDENCE,
      422: INVALID_PATH_PARAMETER,
    },
    access: EVIDENCE_VIEW,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'verifyEvidence',
    method: 'post',
    path: `${EVIDENCE_PATH}/{id}/verify`,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.LIVE,
    summary: 'Verify integrity',
    description: [
      'Runs the integrity verification of an item and returns the verdict of record: one result per track, the manifest and the signature. A failed verification is an answer, not an error: `200` with `ok: false`.',
      'Writes EVIDENCE_VERIFIED or EVIDENCE_VERIFY_FAILED, by the verdict, and adds a custody entry. The tracks, the hashes, the manifest hash and the signature are not changed.',
      hostedNote('verify'),
    ].join('\n\n'),
    source: backendSource(SECTION, 41),
    pathParam: EVIDENCE_PARAM,
    responses: {
      200: { description: 'The verdict, passed or failed.', schema: 'EvidenceVerifyResult' },
      401: NOT_SIGNED_IN,
      403: VIEW_REFUSED,
      404: UNKNOWN_EVIDENCE,
      422: INVALID_PATH_PARAMETER,
    },
    access: EVIDENCE_VIEW,
    audit: { success: AuditType.EVIDENCE_VERIFIED, ...DENIED, also: [AuditType.EVIDENCE_VERIFY_FAILED] },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'archiveEvidence',
    method: 'post',
    path: `${EVIDENCE_PATH}/{id}/archive`,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.LIVE,
    summary: 'Archive evidence',
    description: [
      'Moves a sealed item to ARCHIVED and adds a custody entry. The sealed content is not changed.',
      'Writes EVIDENCE_ARCHIVED. An item that is already archived changes nothing, writes nothing and still answers `204`.',
      hostedNote('archiveEvidence'),
    ].join('\n\n'),
    source: backendSource(SECTION, 43),
    pathParam: EVIDENCE_PARAM,
    responses: {
      204: { description: 'The item is archived.' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.EVIDENCE_REVIEW),
      404: UNKNOWN_EVIDENCE,
      409: { description: 'The item is RECORDED: it was never sealed (NOT_SEALED).', schema: 'ApiError' },
      422: INVALID_PATH_PARAMETER,
    },
    access: permissionAccess(Permission.EVIDENCE_REVIEW),
    audit: { success: AuditType.EVIDENCE_ARCHIVED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const ITEM = { id: STATE_EXAMPLE_IDS.evidenceId } as const;
const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;
const BAD_PATH = { invalidPathParameter: ERROR_EXAMPLES.invalidPathParameter } as const;
const NOT_FOUND = { notFound: simRefusalExample('Unknown evidence ID', 'NOT_FOUND', 'Evidence not found.', 'NOT_FOUND') } as const;
/**
 * Every seeded role holds EVIDENCE_VIEW and the matrix is read-only, so no seeded operator can be
 * shown as refused for the permission: the 403 examples of the three operations are the two
 * refusals every operation shares.
 */
const VIEW_DENIED = BASIC_403_EXAMPLES;

/** The verdict of the simulator for `EV-20260930-0004` at the example instant: every track verifies. */
const VERIFY_PASSED: EvidenceVerifyResultBody = {
  evidenceId: STATE_EXAMPLE_IDS.evidenceId,
  ok: true,
  at: 1_790_823_600_000,
  tracks: EXAMPLE_EVIDENCE_ITEM.tracks.map((track) => ({ trackId: track.trackId, expected: track.sha256, actual: track.sha256, ok: true })),
  manifestOk: true,
  signatureOk: true,
};

/** The verdict of the simulator for `EV-20260930-0005`, whose AUDIO-02 track was altered. */
const VERIFY_FAILED: EvidenceVerifyResultBody = {
  evidenceId: STATE_EXAMPLE_IDS.tamperedEvidenceId,
  ok: false,
  at: 1_790_823_600_000,
  tracks: [
    {
      trackId: 'VIDEO-01',
      expected: '3c36139fc5d946d2290bd89d12e2a657a46a01a628ae0cb7776cd619794da903',
      actual: '3c36139fc5d946d2290bd89d12e2a657a46a01a628ae0cb7776cd619794da903',
      ok: true,
    },
    {
      trackId: 'VIDEO-02',
      expected: '91da7d0ea99c345ec08e57b645b9931c3fb9e0d97ab4d08a30b057230a8d9a70',
      actual: '91da7d0ea99c345ec08e57b645b9931c3fb9e0d97ab4d08a30b057230a8d9a70',
      ok: true,
    },
    {
      trackId: 'AUDIO-01',
      expected: 'd7e83d202d1fbb8652f1266461523488ee39f66237d268ba2b8e105a4fff5f2e',
      actual: 'd7e83d202d1fbb8652f1266461523488ee39f66237d268ba2b8e105a4fff5f2e',
      ok: true,
    },
    {
      trackId: 'AUDIO-02',
      expected: 'bb3af24347c7a036a7263bd660b1a37cd53bae699d885c3527eeac4394cd0d0c',
      actual: '6fdd78d18e15ca1cd7515332af712c2385164ae9cb6a0e0164ba23a49e5e91c8',
      ok: false,
    },
  ],
  manifestOk: true,
  signatureOk: true,
};

export const EVIDENCE_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  listEvidence: {
    responses: {
      200: {
        exported: {
          summary: 'Filtered by status EXPORTED: one item, the last page',
          value: { items: [EXAMPLE_EVIDENCE_ITEM], nextCursor: null } satisfies EvidencePage,
        },
        empty: { summary: 'Nothing matches', value: { items: [], nextCursor: null } satisfies EvidencePage },
      },
      401: SIGNED_OUT,
      403: VIEW_DENIED,
      422: { invalidQuery: ERROR_EXAMPLES.invalidQuery },
    },
  },
  getEvidence: {
    pathParams: ITEM,
    responses: {
      200: {
        withPackage: {
          summary: 'A dataset item: the bundled demo package 0004 belongs to it',
          value: {
            evidence: EXAMPLE_EVIDENCE_ITEM,
            media: { source: 'DEMO_PACKAGE', packageSuffix: '0004' },
          } satisfies EvidenceDetail,
        },
      },
      401: SIGNED_OUT,
      403: VIEW_DENIED,
      404: NOT_FOUND,
      422: BAD_PATH,
    },
  },
  verifyEvidence: {
    pathParams: ITEM,
    responses: {
      200: {
        passed: { summary: 'Every track, the manifest and the signature verify', value: VERIFY_PASSED },
        failed: { summary: `${STATE_EXAMPLE_IDS.tamperedEvidenceId}: AUDIO-02 does not match its sealed hash`, value: VERIFY_FAILED },
      },
      401: SIGNED_OUT,
      403: VIEW_DENIED,
      404: NOT_FOUND,
      422: BAD_PATH,
    },
  },
  archiveEvidence: {
    pathParams: ITEM,
    responses: {
      401: SIGNED_OUT,
      403: deniedExamples('archiveEvidence', 'EVIDENCE_REVIEW', 'INVESTIGATOR'),
      404: NOT_FOUND,
      409: {
        notSealed: simRefusalExample(
          `${STATE_EXAMPLE_IDS.recordedEvidenceId}: incomplete session, never sealed`,
          'NOT_SEALED',
          'Unsealed evidence cannot be archived.',
          'UNSEALED_EVIDENCE',
        ),
      },
      422: BAD_PATH,
    },
  },
};
