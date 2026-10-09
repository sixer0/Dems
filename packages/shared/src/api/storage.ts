/**
 * Area 7 of the Core API: storage (backend task: 2026-10-04 01_specs §7.11, §7.17; plan row W27,
 * contract C).
 *
 * Three operations make up the area. `getStorageStatus` (53) is a design-book operation and lives
 * in `core-api.ts`; the two below are answered by the Core server only.
 *
 * | # | operationId | Access | Audit on success | Simulator action |
 * |--:|-------------|--------|------------------|------------------|
 * | 54 | `getStorageDetail` | AUTHENTICATED | NONE-R | reads `storage`, `storagePolicy` |
 * | 55 | `setStoragePolicy` | ANY-OF(EVIDENCE_REVIEW, MAINTENANCE) | STORAGE_POLICY_CHANGED (none when unchanged) | `setStoragePolicy` |
 *
 * `setStoragePolicy` is the one operation of the registry whose access rule is an any-of: the
 * simulator lets a holder of either permission change the retention policy, and so does the server.
 */
import { z } from 'zod';
import { AuditType, Permission, RetentionPolicyId } from '../sim/vocabulary';
import { API_BASE_PATH } from './constants';
import {
  ANY_OF_DENIAL_SEPARATOR,
  AUTHENTICATED_ACCESS,
  CORE_SERVER_ONLY,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  anyOfAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import { BASIC_403_EXAMPLES, ERROR_EXAMPLES, apiErrorExample } from './example-parts';
import type { OperationExamples } from './examples';
import {
  INVALID_INPUT,
  INVALID_JSON,
  NOT_SIGNED_IN,
  STATE_READ_NOTE,
  backendSource,
  forbidden,
  hostedNote,
  notPermittedAnyOf,
} from './operation-parts';
import { EXAMPLE_SLICES } from './state-examples';
import { REPLICATED_SLICE_SCHEMAS, type StoragePolicySliceBody } from './state-slices';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The range of `retentionDays` (01_specs §7.11): the simulator refuses a value outside it. */
export const RETENTION_DAYS_RANGE = { min: 1, max: 3_650 } as const;

export const StorageDetailSchema = z
  .strictObject({
    storage: REPLICATED_SLICE_SCHEMAS.storage,
    storagePolicy: REPLICATED_SLICE_SCHEMAS.storagePolicy,
  })
  .describe('The storage of the Core and its retention policy: two slices of the Core state, each in its wire form.');
export type StorageDetail = z.output<typeof StorageDetailSchema>;

export const StoragePolicyRequestSchema = z
  .object({
    retentionPolicy: z
      .enum(RetentionPolicyId)
      .optional()
      .describe('The retention policy. Sent without `retentionDays`, it sets the days of that policy: 30, 90, 365 or 3,650.'),
    retentionDays: z
      .int()
      .min(RETENTION_DAYS_RANGE.min)
      .max(RETENTION_DAYS_RANGE.max)
      .optional()
      .describe(`Days an item is kept before it may be archived: a whole number from ${RETENTION_DAYS_RANGE.min} to 3,650.`),
    autoArchive: z.boolean().optional().describe('Whether an item is archived by itself when its retention ends.'),
  })
  .describe('Request body of `POST /api/v1/storage/policy`: the members to change. A member that is left out keeps its value.');
export type StoragePolicyRequest = z.output<typeof StoragePolicyRequestSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const STORAGE_SCHEMAS = {
  StorageDetail: StorageDetailSchema,
  StoragePolicyRequest: StoragePolicyRequestSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.11';
const STORAGE_PATH = `${API_BASE_PATH}/storage`;
const DENIED = { denial: AuditType.ACCESS_DENIED } as const;

export const STORAGE_OPERATIONS = [
  {
    operationId: 'getStorageDetail',
    method: 'get',
    path: `${STORAGE_PATH}/detail`,
    tag: CoreApiTag.STORAGE,
    mode: CoreApiMode.LIVE,
    summary: 'Storage detail',
    description: [
      'The volumes, the write rate, the usage history and the retention policy. Slices `storage` and `storagePolicy`.',
      'Schema v2 (C3 §3 op 54; CS-09; OD-25): the evidence-store figures become the real volumes and the write rate the real capture rate when the capture store lands (M3-W5); the shape does not change.',
      'Distinct from `GET /api/v1/storage/status`, the design-book summary.',
      STATE_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 54),
    responses: {
      200: { description: 'The two slices.', schema: 'StorageDetail' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'setStoragePolicy',
    method: 'post',
    path: `${STORAGE_PATH}/policy`,
    tag: CoreApiTag.STORAGE,
    mode: CoreApiMode.LIVE,
    summary: 'Change the retention policy',
    description: [
      'Changes the retention policy, the retention days or the automatic archive. The body names the members to change, and the answer is the policy after the change.',
      'Needs EVIDENCE_REVIEW **or** MAINTENANCE: a Supervisor and a Technician may both change it.',
      'Writes STORAGE_POLICY_CHANGED. A body that changes nothing writes nothing and still answers `200` with the policy.',
      hostedNote('setStoragePolicy'),
    ].join('\n\n'),
    source: backendSource(SECTION, 55),
    requestBody: { schema: 'StoragePolicyRequest', required: true },
    responses: {
      200: { description: 'The policy after the change: the `storagePolicy` slice.', schema: 'StoragePolicySlice' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermittedAnyOf(Permission.EVIDENCE_REVIEW, Permission.MAINTENANCE),
      422: INVALID_INPUT,
    },
    access: anyOfAccess(Permission.EVIDENCE_REVIEW, Permission.MAINTENANCE),
    audit: { success: AuditType.STORAGE_POLICY_CHANGED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;

export const STORAGE_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  getStorageDetail: {
    responses: {
      200: {
        atLoad: {
          summary: '804 GB of 4 TB used, retention 90 days',
          value: { storage: EXAMPLE_SLICES.storage, storagePolicy: EXAMPLE_SLICES.storagePolicy } satisfies StorageDetail,
        },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
    },
  },
  setStoragePolicy: {
    request: {
      oneYear: { summary: 'Keep evidence one year', value: { retentionPolicy: 'YEAR_1' } satisfies StoragePolicyRequest },
      noAutoArchive: { summary: 'Switch the automatic archive off', value: { autoArchive: false } satisfies StoragePolicyRequest },
    },
    responses: {
      200: {
        changed: {
          summary: 'One year, 365 days',
          value: { retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: true } satisfies StoragePolicySliceBody,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: {
        // RB-4 names `operationId`, `permission` and `role`; for the one any-of `permission` is the
        // alternatives joined with `_OR_`, as the Core server writes it (W83, gap 5 and finding F64).
        notPermitted: {
          summary: 'INVESTIGATOR holds neither EVIDENCE_REVIEW nor MAINTENANCE',
          value: apiErrorExample('NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', {
            operationId: 'setStoragePolicy',
            permission: `${Permission.EVIDENCE_REVIEW}${ANY_OF_DENIAL_SEPARATOR}${Permission.MAINTENANCE}`,
            role: 'INVESTIGATOR',
          }),
        },
        ...BASIC_403_EXAMPLES,
      },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
};
