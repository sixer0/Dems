/**
 * Operations 115 and 116, the console module of the pre-delivery setup (decision D57, principal,
 * 03-11-2026): the two words the LCD front panel shows — `satker` and `client` — and the logo it
 * displays, read and changed FROM THE WEB CONSOLE by the vendor accounts `root` and `gsp.teknisi`.
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 115 | `getPanelSetup` | AUTHENTICATED + web console + vendor identity | none (a read) |
 * | 116 | `setPanelSetup` | AUTHENTICATED + web console + vendor identity | `PANEL_SETUP_CHANGED` |
 *
 * THE SECOND GATE IS AN IDENTITY, NOT A PERMISSION (D57, same semantics as RB-9 and D55). No role
 * of the matrix expresses it: `root` is a SUPERVISOR, `gsp.teknisi` is a TECHNICIAN, and a client's
 * operator holds either role too. The registry therefore carries the ordinary authenticated access
 * plus `WEB_CONSOLE_SESSION` (the module is a browser module by the principal's ruling), and the
 * username rule — exactly the two vendor accounts of `@dems/shared/sim` (`VENDOR_ACCOUNTS`) — is
 * applied by the Core's handler before anything reaches the panel backend. A refusal is 403
 * `NOT_PERMITTED` and writes no audit row, the RB-9 pattern.
 *
 * WHERE THE VALUES LIVE. The panel backend (`apps/lcd-backend`) holds them: identity in its state
 * file, logos in its queue, both pushed to the panel over USB. The Core does not store either value
 * — it forwards to the backend on the loopback bridge URL and repeats what the backend answers, so
 * the panel keeps ONE source of truth while the console is the only door. The backend proves every
 * forwarded request against the Core's own session endpoint (the caller's session credential rides
 * through unchanged): no new secret exists anywhere in this path, and a request whose session died
 * between the click and the push is refused by the backend itself.
 *
 * WHAT NEVER TRAVELS. The logo body is an image, not text with meaning: it is forwarded to the
 * backend, never written to a log or an audit row — the audit row names WHAT changed (which fields,
 * whether a logo was queued), never the bytes. The console's size bound below is NOT the backend's
 * own upload bound (6 MiB, which the panel's /setup page keeps using direct to the backend): it is
 * the contract's global API-4 body limit expressed as base64 characters, because a console body
 * over that limit answers 413 at the pipeline before this operation's handler ever runs.
 */
import { z } from 'zod';
import { AuditType } from '../sim/vocabulary';
import { apiText } from './text';
import { API_BASE_PATH } from './constants';
import {
  AUTHENTICATED_ACCESS,
  CORE_SERVER_ONLY,
  CoreApiAccessCondition,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  type CoreApiRegistryOperation,
} from './contract-model';
import { BASIC_403_EXAMPLES, ERROR_EXAMPLES, apiErrorExample } from './example-parts';
import { WEB_CONSOLE_ONLY_REASON } from './contract-model';
import type { OperationExamples } from './examples';
import { CORE_SERVER_NOTE, INVALID_INPUT, INVALID_JSON, NOT_SIGNED_IN, forbidden } from './operation-parts';

/** The route of operations 115 and 116, also the path the Core's handler registers. */
export const PANEL_SETUP_PATH = `${API_BASE_PATH}/lcd/setup`;

/** The backend truncates the satker word to this many characters when it paints the panel. */
export const PANEL_SATKER_MAX_LENGTH = 38;
/** The same bound for the client word. */
export const PANEL_CLIENT_MAX_LENGTH = 40;
/** The backend's upload bound (6 MiB, `DEMS_LOGO_MAX_BYTE`) applies to the panel's OWN /setup page.
 * The CONSOLE path is tighter by the contract's own pipeline: every body must fit the global
 * API-4 limit (`API_BODY_LIMIT_BYTES` = 65,536) or the Core answers 413 before any handler runs.
 * This cap is that limit minus the worst-case rest of the body: `apiText()` escapes a non-ASCII
 * character as six (`\uXXXX`), so the words and the reason can cost 38×6 + 40×6 + 500×6 plus the
 * key punctuation (~3.6 KB). Rounded down from 61,989 to 60,000 base64 characters — a 45,000-byte
 * PNG. `api-registry.test.ts` is the pin that keeps this arithmetic from rotting. */
export const PANEL_LOGO_BASE64_MAX_LENGTH = 60_000;
/** The same bound as a file size: the bytes one can base64 into `PANEL_LOGO_BASE64_MAX_LENGTH`. */
export const PANEL_LOGO_PNG_MAX_BYTES = (PANEL_LOGO_BASE64_MAX_LENGTH / 4) * 3;

/** Which of the panel's two logo slots a queued logo goes to. */
export const PanelLogoTarget = z.enum(['client', 'splash', 'both']);
export type PanelLogoTarget = z.output<typeof PanelLogoTarget>;

/**
 * What the panel is set to right now. `satker` and `client` are the two words of the panel's
 * identity screen; the two booleans say whether a logo is stored for each slot (stored ≠ pushed:
 * a push needs the panel plugged in, which the panel's own link word already says).
 */
export const PanelSetupResponseSchema = z
  .strictObject({
    satker: apiText().max(PANEL_SATKER_MAX_LENGTH).describe('The unit word the panel shows. Empty when none was ever set.'),
    client: apiText().max(PANEL_CLIENT_MAX_LENGTH).describe('The client word the panel shows. Empty when none was ever set.'),
    clientLogoSaved: z.boolean().describe('Whether a logo is stored for the client slot.'),
    splashLogoSaved: z.boolean().describe('Whether a logo is stored for the splash slot.'),
  })
  .describe('The pre-delivery setup of the LCD front panel as its backend holds it: the two identity words and whether each logo slot holds an image.');
export type PanelSetupResponse = z.output<typeof PanelSetupResponseSchema>;

/**
 * The change request. Every member is optional and at least one must be present (the refine below);
 * absent members are left exactly as they are. `logoBase64` is the whole image file base64-encoded
 * (PNG; the backend converts it for the panel and rejects anything it cannot decode).
 */
export const SetPanelSetupRequestSchema = z
  .strictObject({
    satker: apiText().max(PANEL_SATKER_MAX_LENGTH).optional().describe('New unit word; absent leaves the current one.'),
    client: apiText().max(PANEL_CLIENT_MAX_LENGTH).optional().describe('New client word; absent leaves the current one.'),
    logoBase64: apiText()
      .max(PANEL_LOGO_BASE64_MAX_LENGTH)
      .optional()
      .describe('A PNG logo, base64-encoded, within the console path bound (the API-4 body limit); absent changes no logo.'),
    logoTarget: PanelLogoTarget.optional().describe('Which slot the logo goes to; default `client`.'),
    reason: apiText().max(500).optional().describe('Why the setup changes; free text of the audit row.'),
  })
  .refine(
    (body) => body.satker !== undefined || body.client !== undefined || body.logoBase64 !== undefined,
    'At least one of satker, client, logoBase64 must be present.',
  );
export type SetPanelSetupRequest = z.output<typeof SetPanelSetupRequestSchema>;

/** The setup as it stands after the change was applied (same shape as the read, one word shorter). */
export const SetPanelSetupResponseSchema = PanelSetupResponseSchema;
export type SetPanelSetupResponse = PanelSetupResponse;

/** The 403 text of the identity gate: stage 6 cannot refuse these operations, only D57 can. */
function vendorGate() {
  return forbidden(
    'the signed-in account is not one of the two vendor accounts, the identity gate of D57 (NOT_PERMITTED; no audit row), or the session is not a web console session (WEB_CONSOLE_ONLY; one ACCESS_DENIED row)',
  );
}

export const PANEL_SETUP_OPERATIONS = [
  {
    operationId: 'getPanelSetup',
    method: 'get',
    path: PANEL_SETUP_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Read the pre-delivery panel setup',
    description: [
      'The two identity words of the LCD front panel and whether each logo slot holds a stored logo, as the panel backend holds them. The pre-delivery setup module of the console reads them here.',
      '**Vendor accounts only.** Any authenticated operator passes stage 6 (the access is the plain authenticated one), and the Core then requires the session username to be one of the two vendor accounts — `root` or `gsp.teknisi` — the identity rule of decision D57, the same semantics as the narrowed trio of RB-9. A refusal is 403 `NOT_PERMITTED` with no audit row.',
      '**Web console sessions only**: a tablet or phone session is refused before the body is used.',
      '**A missing panel backend answers the global 503** `NOT_READY` with `details.reason: LCD_BACKEND_UNREACHABLE`, never an empty lie: an answer claiming the panel holds nothing when nothing was asked would be a false statement about the device.',
      `${CORE_SERVER_NOTE}`,
    ].join('\n\n'),
    source: 'Decision D57 (principal, 2026-11-03): operation 118 and operation 119, the pre-delivery setup moved into the console, gated to the vendor identities',
    responses: {
      200: { description: 'The panel setup as its backend holds it.', schema: 'PanelSetupResponse' },
      401: NOT_SIGNED_IN,
      403: vendorGate(),
    },
    access: { ...AUTHENTICATED_ACCESS, conditions: [CoreApiAccessCondition.WEB_CONSOLE_SESSION, CoreApiAccessCondition.VENDOR_ACCOUNT] },
    audit: { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'setPanelSetup',
    method: 'post',
    path: PANEL_SETUP_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Change the pre-delivery panel setup',
    description: [
      'Sets the unit word, the client word, and queues a PNG logo (base64) for one or both logo slots of the LCD front panel. Absent members change nothing; the answer is the setup as it stands after the change. The values live in the panel backend — the Core forwards and repeats, it stores nothing.',
      'Writes PANEL_SETUP_CHANGED naming which fields changed and whether a logo was queued; the image bytes are never in the audit row.',
      '**Vendor accounts only** (D57): the session username must be `root` or `gsp.teknisi`; any other operator is 403 `NOT_PERMITTED` with no audit row and nothing forwarded. **Web console sessions only.**',
      'An empty request answers 422 INVALID_INPUT; a body the backend refuses (an image it cannot decode) answers 422 too, with the backend\'s reason carried in `details.reason`.',
      '**A missing panel backend answers the global 503** `NOT_READY` (`details.reason: LCD_BACKEND_UNREACHABLE`) and nothing is changed.',
      `${CORE_SERVER_NOTE}`,
    ].join('\n\n'),
    source: 'Decision D57 (principal, 2026-11-03): operation 118 and operation 119, the pre-delivery setup moved into the console, gated to the vendor identities',
    requestBody: { schema: 'SetPanelSetupRequest', required: true },
    responses: {
      200: { description: 'The setup after the change.', schema: 'PanelSetupResponse' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: vendorGate(),
      422: INVALID_INPUT,
    },
    access: { ...AUTHENTICATED_ACCESS, conditions: [CoreApiAccessCondition.WEB_CONSOLE_SESSION, CoreApiAccessCondition.VENDOR_ACCOUNT] },
    audit: { success: AuditType.PANEL_SETUP_CHANGED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

/** The schemas of operations 115–116, merged into `CORE_API_SCHEMAS`. */
export const PANEL_SETUP_SCHEMAS = {
  PanelSetupResponse: PanelSetupResponseSchema,
  SetPanelSetupRequest: SetPanelSetupRequestSchema,
} as const;

/** The two 403 refusals of the D57 gate, as named examples: the vendor identity and the session kind. */
function vendorDenied(operationId: string) {
  return {
    ...BASIC_403_EXAMPLES,
    notPermitted: {
      summary: 'A signed-in account that is not a vendor account',
      description: 'The identity gate of D57: only the two vendor accounts reach this module. No audit row is written.',
      value: apiErrorExample('NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', {
        operationId,
        reason: 'VENDOR_IDENTITY',
      }),
    },
    webConsoleOnly: {
      summary: 'A tablet or phone session on a web-console-only operation',
      description: 'The caller is a vendor account, but the session is bound to a paired device. One ACCESS_DENIED row is written; the body is not used.',
      value: apiErrorExample('NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', {
        operationId,
        reason: WEB_CONSOLE_ONLY_REASON,
      }),
    },
  };
}

/** The example bodies of operations 115–116. */
export const PANEL_SETUP_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  getPanelSetup: {
    responses: {
      200: {
        setUp: {
          summary: 'A configured unit',
          description: 'Both words are set and the client slot holds a logo.',
          value: { satker: 'DITRESKRIMUM POLDA METRO JAYA', client: 'PT GSP', clientLogoSaved: true, splashLogoSaved: false } satisfies PanelSetupResponse,
        },
        blank: {
          summary: 'Fresh from the factory seed',
          description: 'Nothing was ever set: the words are empty and no slot holds a logo.',
          value: { satker: '', client: '', clientLogoSaved: false, splashLogoSaved: false } satisfies PanelSetupResponse,
        },
      },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: vendorDenied('getPanelSetup'),
    },
  },
  setPanelSetup: {
    request: {
      identityOnly: {
        summary: 'Set the two words',
        description: 'No logo touched.',
        value: { satker: 'DITRESKRIMUM POLDA METRO JAYA', client: 'PT GSP', reason: 'Commissioning for handover' } satisfies SetPanelSetupRequest,
      },
      logoOnly: {
        summary: 'Queue a logo for both slots',
        description: 'The words stay. The base64 body is elided in this example; the real one is the whole PNG file, within the console path bound (a PNG of 45,000 bytes).',
        value: { logoBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', logoTarget: 'both', reason: 'Client branding approved' } satisfies SetPanelSetupRequest,
      },
    },
    responses: {
      200: {
        after: {
          summary: 'The setup after the change',
          description: 'Both words set, the client slot now holds a logo.',
          value: { satker: 'DITRESKRIMUM POLDA METRO JAYA', client: 'PT GSP', clientLogoSaved: true, splashLogoSaved: false } satisfies PanelSetupResponse,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: vendorDenied('setPanelSetup'),
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
};
