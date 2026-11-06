/**
 * The console rule ID-1 (plan row W24; spec §5.2 ID-1, §6.9, §14.2; SR-21, SR-69; decision D69).
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
 * WHERE THE CODE IS (review finding CPB1-10; fix round B2b). What reads the facts of stages 3
 * and 4 lives with stage 4, in `plugins/authenticate/console.ts`: `pairedDeviceOf`,
 * `consoleIdentityOf`, the two refusals and the key of the web console. The access rule and the
 * pairing module import them there, so no stage imports this module. They are re-exported
 * below under the names they always had. What is the identity operations' own stays in this
 * file: the lockout key of a status read, and the two functions a handler calls.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { WEB_CONSOLE_KEY, consoleIdentityOf, deviceNotPaired, deviceRevoked, pairedDeviceOf, type ConsoleIdentity } from '../../plugins/authenticate';

export { consoleIdentityOf, deviceNotPaired, deviceRevoked, pairedDeviceOf, type ConsoleIdentity } from '../../plugins/authenticate';

/**
 * The console whose lock state `getSignInStatus` reads: the device's when the request speaks for
 * a paired device, and only the web console's otherwise (OP-1). It issues nothing, so it needs
 * no console identity: the web login page reads it with a same-origin GET, which has no `Origin`.
 */
export function statusConsoleKeyOf(request: FastifyRequest): string {
  return pairedDeviceOf(request) ?? WEB_CONSOLE_KEY;
}

/** Refuses a retired device; lets everybody else through. */
export function refuseRetiredDevice(request: FastifyRequest): void {
  const { principal } = request;
  if (principal.kind === 'ANONYMOUS' && principal.retiredDeviceId !== null) throw deviceRevoked();
}

/** The console of a sign-in, or the refusal of ID-1. */
export function requireConsoleIdentity(app: FastifyInstance, request: FastifyRequest): ConsoleIdentity {
  refuseRetiredDevice(request);
  const identity = consoleIdentityOf(app, request);
  if (identity === null) throw deviceNotPaired();
  return identity;
}
