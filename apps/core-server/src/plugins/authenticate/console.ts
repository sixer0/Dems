/**
 * The console rule ID-1, as stages 3 and 4 decide it (plan row W24; spec §5.2 ID-1, §6.9,
 * §14.2; SR-21, SR-69; decision D69).
 *
 * `signIn` is accepted from exactly two kinds of caller:
 *
 *   (a) a WEB CONSOLE   the `Origin` is one of the web console origins and the request carries
 *                       no `Authorization` header. The session is delivered only as the cookie;
 *   (b) a PAIRED DEVICE the request resolved to a paired device at stage 4: its device
 *                       credential, or a session that is bound to it. The session token is
 *                       returned in the body and bound to that device; no cookie is set.
 *
 * Everybody else has no console identity and gets 403 `DEVICE_NOT_PAIRED`: a caller with no
 * `Origin` and no device credential, and equally a caller whose `Origin` is one of the
 * instance's OWN origins, which never counts as a web console (the two lists of SD-02). That is
 * what keeps pairing mandatory for everything that is not a web console.
 *
 * The console is also the key of the sign-in lockout (ID-P3): `web`, or the device's ID.
 *
 * The facts come from stage 3 (`app.originDecision`) and stage 4 (`request.principal`). Nothing
 * here reads `Host` or `User-Agent`, and a device is never expected to send an `Origin`.
 *
 * WHY THIS FILE IS IN THE STAGE'S FOLDER (review finding CPB1-10; fix round B2b). These are
 * facts of stages 3 and 4, and three units read them: the access rule (stage 6, which decides
 * ID-1 before the body is read), the identity module (the console of a sign-in) and the pairing
 * module (the device a request speaks for). While they lived in the identity module, the access
 * rule imported a module, and the stage and the module imported each other. Here every user
 * imports downwards. The identity module re-exports them under the names it always had
 * (`modules/identity/console.ts`); what is the identity operations' own stays there.
 */
import { ApiErrorCode } from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiFailure } from '../error-envelope';
import { OriginCategory } from '../origin-guard';

/** ID-P3: the lockout key of the web console. A device's key is its registry ID (`DEV-NNNN`). */
export const WEB_CONSOLE_KEY = 'web';

export type ConsoleIdentity =
  | { readonly kind: 'WEB'; readonly lockoutKey: typeof WEB_CONSOLE_KEY; readonly deviceId: null }
  | { readonly kind: 'DEVICE'; readonly lockoutKey: string; readonly deviceId: string };

const WEB_CONSOLE: ConsoleIdentity = Object.freeze({ kind: 'WEB', lockoutKey: WEB_CONSOLE_KEY, deviceId: null });

/** The paired device a request speaks for: a DEVICE principal, or an OPERATOR bound to a device. */
export function pairedDeviceOf(request: FastifyRequest): string | null {
  const { principal } = request;
  if (principal.kind === 'DEVICE') return principal.deviceId;
  if (principal.kind === 'OPERATOR') return principal.deviceId;
  return null;
}

/** The console identity of a request under ID-1, or null when it has none. */
export function consoleIdentityOf(app: FastifyInstance, request: FastifyRequest): ConsoleIdentity | null {
  const deviceId = pairedDeviceOf(request);
  if (deviceId !== null) return { kind: 'DEVICE', lockoutKey: deviceId, deviceId };
  const facts = app.originDecision(request);
  if (facts.category === OriginCategory.WEB_CONSOLE && !facts.hasBearer) return WEB_CONSOLE;
  return null;
}

export function deviceNotPaired(): ApiFailure {
  return new ApiFailure(403, ApiErrorCode.DEVICE_NOT_PAIRED, 'Pair this device with the Core before signing in.');
}

/**
 * The answer for a retired device. The audited refusal of RB-6 (its `ACCESS_DENIED` row) is the
 * access rule's, at stage 6; this one is what the identity operations answer if a retired device
 * reaches them all the same.
 */
export function deviceRevoked(): ApiFailure {
  return new ApiFailure(403, ApiErrorCode.DEVICE_REVOKED, 'This device is no longer paired with the Core.', {
    details: { reason: ApiErrorCode.DEVICE_REVOKED },
  });
}
