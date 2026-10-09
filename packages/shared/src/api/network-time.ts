/**
 * Area 8 of the Core API: network and time (backend task: 2026-10-04 01_specs §7.12; plan row W27,
 * contract C).
 *
 * | # | operationId | Access | Audit | Simulator action |
 * |--:|-------------|--------|-------|------------------|
 * | 56 | `getNetworkStatus` | AUTHENTICATED | NONE-R | reads `network`, `tabletLink` |
 * | 57 | `getTimeStatus` | AUTHENTICATED | NONE-R | reads `time` |
 *
 * The area has no command: its values are simulated hardware signals of the engine, and their
 * faults are demo controls (01_specs §12). The `time` slice is the time service of the Core
 * device; it is not the server clock, which stamps every record (Q15).
 */
import { z } from 'zod';
import { AuditType } from '../sim/vocabulary';
import { API_BASE_PATH } from './constants';
import {
  AUTHENTICATED_ACCESS,
  CORE_SERVER_ONLY,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  type CoreApiRegistryOperation,
} from './contract-model';
import { BASIC_403_EXAMPLES, ERROR_EXAMPLES } from './example-parts';
import type { OperationExamples } from './examples';
import { NOT_SIGNED_IN, STATE_READ_NOTE, backendSource, forbidden } from './operation-parts';
import { epochMs, trimmedText } from './schema-parts';
import { EXAMPLE_SLICES } from './state-examples';
import { REPLICATED_SLICE_SCHEMAS } from './state-slices';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

export const NetworkStatusSchema = z
  .strictObject({
    network: REPLICATED_SLICE_SCHEMAS.network,
    tabletLink: REPLICATED_SLICE_SCHEMAS.tabletLink,
  })
  .describe('The network of the Core and the link of the tablet: two slices of the Core state, each in its wire form.');
export type NetworkStatus = z.output<typeof NetworkStatusSchema>;

export const TimeStatusSchema = z
  .strictObject({
    time: REPLICATED_SLICE_SCHEMAS.time,
    // Schema v2 (task 3 M2-W7; C3 §3 op 57; CS-11; NM-01; OD-05): per-camera NTP offset records,
    // fed through adapter telemetry (the real feed lands with the M4 adapters). Optional until then.
    cameraOffsets: z
      .array(
        z.strictObject({
          deviceId: trimmedText(64).describe('The camera device, e.g. CAM-01.'),
          offsetMs: z.number().describe('The camera clock minus the Core clock, as the telemetry reported it.'),
          measuredAt: epochMs().describe('Core instant of the measurement.'),
          source: trimmedText(64).describe('How it was measured (open code, e.g. NTP_ONVIF, RTCP_TELEMETRY).'),
        }),
      )
      .optional()
      .describe('Schema v2: camera clock offsets via telemetry; absent while no camera has reported one.'),
  })
  .describe('The time service of the Core device and, from schema v2, the camera clock offsets.');
export type TimeStatus = z.output<typeof TimeStatusSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const NETWORK_TIME_SCHEMAS = {
  NetworkStatus: NetworkStatusSchema,
  TimeStatus: TimeStatusSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.12';
const READ_AUDIT = { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED } as const;

export const NETWORK_TIME_OPERATIONS = [
  {
    operationId: 'getNetworkStatus',
    method: 'get',
    path: `${API_BASE_PATH}/network/status`,
    tag: CoreApiTag.NETWORK,
    mode: CoreApiMode.LIVE,
    summary: 'Network status',
    description: [
      'The address, the link, the PoE budget, the bandwidth and the network domains of the Core, and the link of the tablet. Slices `network` and `tabletLink`.',
      'The tablet link is set by the server from the real connections of the paired devices; no client can set it.',
      STATE_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 56),
    responses: {
      200: { description: 'The two slices.', schema: 'NetworkStatus' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
    },
    access: AUTHENTICATED_ACCESS,
    audit: READ_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getTimeStatus',
    method: 'get',
    path: `${API_BASE_PATH}/time/status`,
    tag: CoreApiTag.NETWORK,
    mode: CoreApiMode.LIVE,
    summary: 'Time status',
    description: [
      'The time service of the Core device: the active source (GNSS, then NTP, then RTC), the lock, the offset and its history. Slice `time`.',
      'Schema v2 (C3 §3 op 57; CS-11; NM-01; OD-05): per-camera NTP offset records via telemetry join the answer under `cameraOffsets` once the adapters report them (M4); absent until then.',
      'These are simulated signals of the device. Every timestamp of a record comes from the server clock, not from this slice.',
      STATE_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 57),
    responses: {
      200: { description: 'The slice, under its name.', schema: 'TimeStatus' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
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

export const NETWORK_TIME_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  getNetworkStatus: {
    responses: {
      200: {
        linked: {
          summary: 'Link up, tablet connected',
          value: { network: EXAMPLE_SLICES.network, tabletLink: EXAMPLE_SLICES.tabletLink } satisfies NetworkStatus,
        },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
    },
  },
  getTimeStatus: {
    responses: {
      200: { gnss: { summary: 'Locked to GNSS, offset 3 ms', value: { time: EXAMPLE_SLICES.time } satisfies TimeStatus } },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
    },
  },
};
