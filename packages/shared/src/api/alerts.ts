/**
 * Area 11 of the Core API: alerts (backend task: 2026-10-04 01_specs §7.15, §7.17; plan row W27,
 * contract C).
 *
 * | # | operationId | Access | Audit on success | Simulator action |
 * |--:|-------------|--------|------------------|------------------|
 * | 69 | `listAlerts` | AUTHENTICATED | NONE-R | reads `alerts` |
 * | 70 | `acknowledgeAlert` | AUTHENTICATED | NONE-P (a no-op for an unknown or acknowledged alert) | `acknowledgeAlert` |
 *
 * The rest of the area is the realtime channel `WS /ws` (`realtime-messages.ts`): heartbeat, state
 * changes, alerts, audio levels, reconnect and resync. Every alert of a fault kind has an audit
 * entry: raising one writes FAULT_RAISED (AUDIT_CHAIN_DISCONTINUITY for the kind AUDIT_TAMPER).
 * Acknowledging one writes no audit row and one log line (SR-82).
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
import { INVALID_PATH_PARAMETER, NOT_SIGNED_IN, STATE_READ_NOTE, backendSource, forbidden, hostedNote } from './operation-parts';
import { ALERT_ID_PATTERN } from './patterns';
import { EXAMPLE_ALERT, STATE_EXAMPLE_IDS } from './state-examples';
import { REPLICATED_SLICE_SCHEMAS } from './state-slices';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

export const AlertListSchema = z
  .strictObject({
    alerts: REPLICATED_SLICE_SCHEMAS.alerts,
  })
  .describe('The alerts of the Core: one slice of the Core state in its wire form, under its slice name.');
export type AlertList = z.output<typeof AlertListSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const ALERT_SCHEMAS = {
  AlertList: AlertListSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.15';
const ALERTS_PATH = `${API_BASE_PATH}/alerts`;
const DENIED = { denial: AuditType.ACCESS_DENIED } as const;

export const ALERT_OPERATIONS = [
  {
    operationId: 'listAlerts',
    method: 'get',
    path: ALERTS_PATH,
    tag: CoreApiTag.ALERTS,
    mode: CoreApiMode.LIVE,
    summary: 'Alerts',
    description: [
      'The newest alerts of the Core, active and resolved, with their acknowledgement. Slice `alerts`. Every alert of a fault kind was raised by a fault, and raising it wrote a FAULT_RAISED audit row (AUDIT_CHAIN_DISCONTINUITY for the kind AUDIT_TAMPER).',
      STATE_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 69),
    responses: {
      200: { description: 'The slice, under its name.', schema: 'AlertList' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'acknowledgeAlert',
    method: 'post',
    path: `${ALERTS_PATH}/{id}/acknowledge`,
    tag: CoreApiTag.ALERTS,
    mode: CoreApiMode.LIVE,
    summary: 'Acknowledge an alert',
    description: [
      'Marks an alert as acknowledged for every console of this Core. The fault behind it is not cleared.',
      'Every signed-in role may call it: the bell is on every page. Writes no audit row. An unknown alert, or one that is already acknowledged, changes nothing and still answers `204`, as the simulator does.',
      hostedNote('acknowledgeAlert'),
    ].join('\n\n'),
    source: backendSource(SECTION, 70),
    pathParam: { name: 'id', description: 'Alert ID `ALR-NNNNNN`.', pattern: ALERT_ID_PATTERN },
    responses: {
      204: { description: 'The alert is acknowledged, or nothing changed.' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
      422: INVALID_PATH_PARAMETER,
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.PARITY, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;

export const ALERT_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  listAlerts: {
    responses: {
      200: {
        oneActive: { summary: 'One active alert: no signal on MIC 2', value: { alerts: [EXAMPLE_ALERT] } satisfies AlertList },
        none: { summary: 'No alert', value: { alerts: [] } satisfies AlertList },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
    },
  },
  acknowledgeAlert: {
    pathParams: { id: STATE_EXAMPLE_IDS.alertId },
    responses: {
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
      422: { invalidPathParameter: ERROR_EXAMPLES.invalidPathParameter },
    },
  },
};
