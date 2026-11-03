/**
 * Operation 114 `getPanelFirmware`: the firmware version the LCD front panel reports about ITSELF
 * (the LCD bridge task; the panel backend `apps/lcd-backend/app/dems_backend.py` holds the two words
 * this answer repeats, `panel_fw` and `verdict`).
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 114 | `getPanelFirmware` | PUBLIC | none (a read) |
 *
 * WHY PUBLIC, AND NOT AUTHENTICATED. The screen that shows this value is the sign-in screen, and a
 * sign-in screen has no session yet: an AUTHENTICATED read could never fill its cell. It therefore
 * follows the two public reads that are already in the registry — `getServiceHealth` (operation 1)
 * and `getSignInStatus` (operation 3): marker `PUBLIC`, a read, no audit row, no condition. No new
 * access kind is invented, and no grant moves (the RBAC table is final).
 *
 * WHAT THE ANSWER HOLDS, and nothing beside it: the version string the panel stated for itself over
 * USB, and the panel link word of the panel backend. NO evidence data, NO session data, no operator,
 * no channel list, no serial, port or path of the appliance. The trade is taken on purpose and is
 * written into the operation's own text: `GET /api/v1/health` already publishes the service name and
 * its version to whoever reaches the loopback port, so publishing the panel's firmware word extends
 * that existing disclosure by one short string. The alternative — keeping it behind a session — is a
 * login screen that cannot say which front panel is attached.
 *
 * WHERE THE VALUE COMES FROM. The Core asks its OWN panel backend (`GET /api/dems/status` on the
 * loopback URL of the bridge) and repeats what that backend holds. `panel_fw` is what the tool said
 * in a line of its own, never a version the Core guesses or reads off a chip. The read is cached for
 * five seconds and the backend call has a one-second timeout, so a screen that polls cannot flood
 * the panel backend. A backend that is not configured, unreachable, slow, or that answers something
 * other than its schema still gives `200` with empty strings: a missing front panel must not take the
 * sign-in screen down.
 *
 * THIS FILE IS THE CONTRACT. The Core's handler is `apps/core-server/src/lcd/panel-info.ts`; the
 * console's reader is `apps/core-web/src/lib/panel-firmware-query.ts`. The in-app simulator has no
 * panel, so the operation is `live`: it belongs to no offline scope and reaches no simulator action.
 */
import { z } from 'zod';
import { AuditType } from '../sim/vocabulary';
import { API_BASE_PATH, CORE_HTTP_ORIGIN } from './constants';
import {
  CORE_SERVER_ONLY,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  PUBLIC_ACCESS,
  type CoreApiRegistryOperation,
} from './contract-model';
import { BASIC_403_EXAMPLES } from './example-parts';
import type { OperationExamples } from './examples';
import { CORE_SERVER_NOTE, forbidden } from './operation-parts';

/** The route of operation 114, also the path the Core's own handler registers. */
export const PANEL_FIRMWARE_PATH = `${API_BASE_PATH}/lcd/panel-info`;

/** The longest version string the panel backend keeps (`panel_fw` is truncated to twelve characters). */
export const PANEL_FIRMWARE_MAX_LENGTH = 12;
/** The longest link word the panel backend makes. */
export const PANEL_VERDICT_MAX_LENGTH = 24;

/**
 * The two words of the panel. `verdict` is deliberately an OPEN set of bounded length, not an enum:
 * the four words the tool makes today (`OK`, `PANEL-DIAM`, `CORE-DIAM`, `PORT-TIDAK-ADA`) are the
 * backend's vocabulary, and a new word of the tool must stay readable instead of turning the answer
 * into a parse failure. An empty member says what it means: nothing is known.
 */
export const PanelFirmwareResponseSchema = z
  .strictObject({
    panelFirmware: z
      .string()
      .max(PANEL_FIRMWARE_MAX_LENGTH)
      .describe(
        'The firmware version the panel reported about itself (e.g. `v3.8`), as the panel backend holds it. Empty when nothing is known: no panel, no backend, or a backend that did not answer.',
      ),
    verdict: z
      .string()
      .max(PANEL_VERDICT_MAX_LENGTH)
      .describe(
        'The panel link word of the panel backend: `OK` when the panel is talking, `PANEL-DIAM`, `CORE-DIAM` or `PORT-TIDAK-ADA` when something between them is silent, and empty when the backend itself did not answer. An open set of bounded length.',
      ),
  })
  .describe('What the attached LCD front panel states about itself: its firmware version and the panel link word. No evidence data, no session data.');
export type PanelFirmwareResponse = z.output<typeof PanelFirmwareResponseSchema>;

/** The answer of a Core that knows nothing: the same `200`, with both words empty. */
export const PANEL_FIRMWARE_UNKNOWN: PanelFirmwareResponse = { panelFirmware: '', verdict: '' };

/** TanStack Query key of the panel firmware read (the console's Login device strip). */
export const PANEL_FIRMWARE_QUERY_KEY = ['panel-firmware'] as const;

/**
 * `GET http://127.0.0.1:4400/api/v1/lcd/panel-info`, validated with `PanelFirmwareResponseSchema`.
 * The shape of `fetchHealth`: one schema check, and a caller that reaches another origin wraps this
 * fetch (`apps/core-web/src/lib/core-endpoint.ts`).
 */
export async function fetchPanelFirmware(fetchImpl: typeof fetch = fetch): Promise<PanelFirmwareResponse> {
  const response = await fetchImpl(`${CORE_HTTP_ORIGIN}${PANEL_FIRMWARE_PATH}`);
  if (!response.ok) throw new Error(`GET ${PANEL_FIRMWARE_PATH} -> HTTP ${response.status}`);
  return PanelFirmwareResponseSchema.parse(await response.json());
}

export const PANEL_FIRMWARE_OPERATIONS = [
  {
    operationId: 'getPanelFirmware',
    method: 'get',
    path: PANEL_FIRMWARE_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Panel firmware version',
    description: [
      'The firmware version the LCD front panel reported **about itself**, plus the panel link word of the panel backend. Distinct from `GET /api/v1/device/health`, which is the Core state and needs a signed-in operator.',
      '**Public: it answers a caller with no session.** The screen that shows it is the sign-in screen, which has no credential yet. It is the third public read, beside `getServiceHealth` and `getSignInStatus`.',
      '**What the answer holds, and nothing else:** two short strings — the version the panel stated in a line of its own over USB, and the backend\'s word for the panel link. No evidence data, no session data, no operator, no channel list, no serial, port or path. This extends the disclosure `GET /api/v1/health` already makes of the service name and version by one string; the extension is small and is taken on purpose, because the alternative is a sign-in screen that cannot say which front panel is attached.',
      '**An absent panel is a `200`, never a failure.** No bridge configured, no backend listening, a backend slower than one second, or a body that is not what the backend\'s schema says: all four answer `200` with both strings empty, so the sign-in screen keeps working while the front panel is not plugged in. The Core asks the backend at most once per five seconds and gives the call one second, so a polling screen cannot flood it.',
      `${CORE_SERVER_NOTE}`,
    ].join('\n\n'),
    source: 'LCD bridge task (apps/core-server/src/lcd; apps/lcd-backend), operation 114: the panel\'s own version word on the sign-in screen (not in the design book)',
    responses: {
      200: {
        description: 'The panel firmware word and the panel link word. Both are empty when nothing is known, and the status is still `200`.',
        schema: 'PanelFirmwareResponse',
      },
      403: forbidden(),
    },
    access: PUBLIC_ACCESS,
    audit: { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

/** The one schema of operation 114, merged into `CORE_API_SCHEMAS`. */
export const PANEL_SCHEMAS = { PanelFirmwareResponse: PanelFirmwareResponseSchema } as const;

/** The example bodies of operation 114. */
export const PANEL_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  getPanelFirmware: {
    responses: {
      200: {
        panelTalking: {
          summary: 'A panel that stated its own version',
          description: 'The panel is talking to the backend and said `v3.8` about itself.',
          value: { panelFirmware: 'v3.8', verdict: 'OK' } satisfies PanelFirmwareResponse,
        },
        panelAbsent: {
          summary: 'Nothing behind the answer',
          description: 'The backend holds no version word and says its port is not there. Still `200`: the sign-in screen shows the cell as unknown.',
          value: { panelFirmware: '', verdict: 'PORT-TIDAK-ADA' } satisfies PanelFirmwareResponse,
        },
      },
      403: BASIC_403_EXAMPLES,
    },
  },
};
