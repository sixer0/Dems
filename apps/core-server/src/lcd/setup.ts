/**
 * Operations 115–116 `getPanelSetup` / `setPanelSetup` (decision D57, principal, 03-11-2026): the
 * pre-delivery setup of the LCD front panel — its two identity words and its logos — read and
 * changed FROM THE WEB CONSOLE by the two vendor accounts only.
 *
 * THE CORE STORES NOTHING. The panel backend (`apps/lcd-backend`) is the single holder of these
 * values (identity file + logo queue, pushed to the panel over USB). This file is a proxy with a
 * gate in front of it: the route module checks the vendor identity of the session BEFORE anything
 * is forwarded (the second gate of D57, the RB-9 semantics — an identity, not a permission), and
 * the caller's own session credential rides through to the backend UNCHANGED, because the backend
 * proves every write against the Core's own session endpoint before applying it. No new secret
 * exists anywhere on this path; a session that died between the click and the push is refused by
 * the backend itself, and the refusal travels back as 401.
 *
 * WHAT FAILS AND HOW. A backend that is not configured, unreachable or silent answers 503
 * NOT_READY with `details.reason: LCD_BACKEND_UNREACHABLE` — never an empty lie about the panel
 * holding nothing (contrast operation 114, whose sign-in screen must survive a missing panel; this
 * module is an action, and an action that cannot see the panel must say so). The backend's own 422
 * (an image it cannot decode) comes back as 422 INVALID_INPUT with the backend's reason attached.
 *
 * THE AUDIT ROW is written by the route module AFTER the backend accepted the change (the precedent
 * is the camera credential store): it names which fields moved and whether a logo was queued —
 * never the words themselves, never the image bytes.
 */
import { ApiErrorCode } from '@dems/shared/api';
import { isVendorAccount } from '@dems/shared/sim';
import { ApiFailure } from '../plugins/error-envelope';
import {
  PANEL_SATKER_MAX_LENGTH,
  PANEL_CLIENT_MAX_LENGTH,
  type PanelLogoTarget,
  type PanelSetupResponse,
  type SetPanelSetupRequest,
} from '@dems/shared/api';
import { z } from 'zod';

/** The one refusal of the identity gate: stage 6 cannot express it, only D57 can. No audit row. */
export const VENDOR_GATE_TEXT = 'Only the vendor accounts root and gsp.teknisi may open the pre-delivery panel setup.';

/**
 * The identity gate of D57, as a function of the username behind the session: a vendor account
 * passes and its own cookie rides to the backend unchanged; any other account is refused 403
 * `NOT_PERMITTED` BEFORE a byte is forwarded (the RB-9 semantics - an identity, not a permission).
 * The refusal writes no audit row; the WEB_CONSOLE_ONLY refusal belongs to stage 6 and does.
 */
export function vendorGateOf(username: string, cookie: string | undefined): string | undefined {
  if (!isVendorAccount(username)) throw new ApiFailure(403, ApiErrorCode.NOT_PERMITTED, VENDOR_GATE_TEXT);
  return cookie;
}

/** How long the backend may take for one proxied call. Past it the answer is 503, not a hang. */
const TIMEOUT_MS = 4_000;
/** Identity + logo status are small; a megabyte of them is already a misbehaving service. */
const MAX_BODY_BYTES = 1_048_576;

export const PANEL_SETUP_OPERATION_IDS = ['getPanelSetup', 'setPanelSetup'] as const;

/** The reason word of the one failure mode this proxy owns. */
export const LCD_BACKEND_UNREACHABLE = 'LCD_BACKEND_UNREACHABLE';

const notReachable = (): ApiFailure =>
  new ApiFailure(503, ApiErrorCode.NOT_READY, 'The front panel service did not answer; nothing was read or changed.', {
    details: { reason: LCD_BACKEND_UNREACHABLE },
  });

/** GET /api/dems/identity as the backend makes it. */
const BackendIdentity = z.object({ satker: z.string().default(''), client: z.string().default('') });
/** GET /api/dems/logo: the per-slot status dictionaries; only `tersimpan` is read here. */
const BackendLogos = z.object({ logo: z.record(z.string(), z.object({ tersimpan: z.boolean().optional() })) });
/** POST /api/dems/setup as the backend answers a change it applied. */
const BackendSetupAnswer = z.object({
  ok: z.boolean(),
  satker: z.string().default(''),
  client: z.string().default(''),
  logo: z.record(z.string(), z.object({ tersimpan: z.boolean().optional() })).optional(),
  changed: z
    .object({ satker: z.boolean().optional(), client: z.boolean().optional(), logo: z.boolean().optional() })
    .optional(),
});

/** The backend's words are bounded by the contract; a longer answer is truncated, never refused. */
const fit = (value: string, max: number): string => value.trim().slice(0, max);

export type PanelSetupAuditFacts = { satkerChanged: boolean; clientChanged: boolean; logoQueued: boolean; logoTarget?: PanelLogoTarget };

/**
 * The proxy over the panel backend. `url` is `app.config.lcdBackendUrl`; an empty string means this
 * Core has no panel bridge at all, and every call then answers 503 without touching the network.
 */
export function createPanelSetupProxy(options: { url: string; fetch?: typeof globalThis.fetch }) {
  const fetcher = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));

  async function ask(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
    if (options.url === '') throw notReachable();
    let response: Response;
    try {
      response = await fetcher(`${options.url}${path}`, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw notReachable();
    }
    const text = await response.text().catch(() => '');
    if (text.length > MAX_BODY_BYTES) throw notReachable();
    try {
      return { status: response.status, body: text === '' ? null : (JSON.parse(text) as unknown) };
    } catch {
      throw notReachable();
    }
  }

  /** The session credential of the caller, forwarded verbatim so the backend can prove it to the Core. */
  const passThrough = (cookie: string | undefined): Record<string, string> =>
    cookie !== undefined && cookie !== '' ? { Cookie: cookie } : {};

  function readAnswer(id: string, client: string, logos: Record<string, { tersimpan?: boolean }>): PanelSetupResponse {
    return {
      satker: fit(String(id), PANEL_SATKER_MAX_LENGTH),
      client: fit(String(client), PANEL_CLIENT_MAX_LENGTH),
      clientLogoSaved: logos.client?.tersimpan === true,
      splashLogoSaved: logos.splash?.tersimpan === true,
    };
  }

  return {
    /** The panel setup as the backend holds it. 503 when the backend cannot be asked. */
    async read(cookie?: string): Promise<PanelSetupResponse> {
      const [identity, logos] = await Promise.all([ask('/api/dems/identity', { method: 'GET', headers: passThrough(cookie) }), ask('/api/dems/logo', { method: 'GET', headers: passThrough(cookie) })]);
      if (identity.status !== 200 || logos.status !== 200) throw notReachable();
      const parsedIdentity = BackendIdentity.safeParse(identity.body);
      const parsedLogos = BackendLogos.safeParse(logos.body);
      if (!parsedIdentity.success || !parsedLogos.success) throw notReachable();
      return readAnswer(parsedIdentity.data.satker, parsedIdentity.data.client, parsedLogos.data.logo);
    },

    /** Apply the change through the backend; returns the setup after it and the facts for the audit row. */
    async write(body: SetPanelSetupRequest, cookie?: string): Promise<{ after: PanelSetupResponse; facts: PanelSetupAuditFacts }> {
      const answer = await ask('/api/dems/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...passThrough(cookie) },
        body: JSON.stringify({
          ...(body.satker !== undefined ? { satker: body.satker } : {}),
          ...(body.client !== undefined ? { client: body.client } : {}),
          ...(body.logoBase64 !== undefined ? { logo_base64: body.logoBase64, logo_target: body.logoTarget ?? 'client' } : {}),
        }),
      });
      if (answer.status === 403) {
        // The backend could not prove the carried session to the Core: between click and push it died.
        throw new ApiFailure(401, ApiErrorCode.NOT_SIGNED_IN, 'The session behind this request is no longer valid at the panel service.');
      }
      if (answer.status === 422) {
        const why = typeof (answer.body as { alasan?: unknown } | null)?.alasan === 'string' ? String((answer.body as { alasan: string }).alasan) : 'the panel backend refused the image';
        throw new ApiFailure(422, ApiErrorCode.INVALID_INPUT, 'The panel backend did not accept the change.', { details: { reason: why.slice(0, 200) } });
      }
      if (answer.status !== 200) throw notReachable();
      const parsed = BackendSetupAnswer.safeParse(answer.body);
      if (!parsed.success || !parsed.data.ok) throw notReachable();
      const after = readAnswer(parsed.data.satker, parsed.data.client, parsed.data.logo ?? {});
      const changed = parsed.data.changed ?? {};
      return {
        after,
        facts: {
          satkerChanged: changed.satker === true,
          clientChanged: changed.client === true,
          logoQueued: changed.logo === true,
          ...(body.logoBase64 !== undefined ? { logoTarget: (body.logoTarget ?? 'client') as PanelLogoTarget } : {}),
        },
      };
    },
  };
}
