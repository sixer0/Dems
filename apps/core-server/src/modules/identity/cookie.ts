/**
 * The session cookie of a web console (plan row W24; spec §5.1 ID-P7, §5.2 ID-9, §14.2 OR-8;
 * SR-16, SR-18; AC-B-23, AC-B-90; decision D69).
 *
 *   name        `dems_session_<listen port>` (`app.config.sessionCookieName`): cookies ignore
 *               the port, so a name per instance keeps the main console and the lanes from
 *               replacing each other's cookie in one browser profile;
 *   attributes  exactly `HttpOnly`, `SameSite=Strict`, `Path=/`. No `Domain`. No `Max-Age` and
 *               no `Expires`: a browser-session cookie, because a session secret should not be
 *               persistent. No `Secure` and no `__Host-` prefix: the transport is loopback HTTP
 *               (the accepted deviation of OR-8; it lapses if a listener ever leaves loopback
 *               or TLS is added).
 *
 * WHO GETS ONE. Only the answer to a web console's sign-in sets it, and only the answer to a web
 * session's sign-out clears it (the same name and attributes with `Max-Age=0`). An answer to a
 * request that came with a bearer credential, or to any device, never carries `Set-Cookie`: a
 * mobile app's socket would send such a cookie back on its next upgrade.
 *
 * The plugin `@fastify/cookie` writes the header; the scaffold registers it. The value is the
 * session token: never logged (`set-cookie` is a redacted header), never in a body.
 */
import type { FastifyReply } from 'fastify';

/** The attributes of the session cookie: these three and nothing else. */
export const SESSION_COOKIE_ATTRIBUTES = Object.freeze({ httpOnly: true, sameSite: 'strict', path: '/' } as const);

/** Sets this instance's session cookie on the answer to a web console's sign-in. */
export function setSessionCookie(reply: FastifyReply, name: string, token: string): void {
  void reply.setCookie(name, token, SESSION_COOKIE_ATTRIBUTES);
}

/** Clears this instance's session cookie: the same name and attributes, sent with `Max-Age=0` (ID-9). */
export function clearSessionCookie(reply: FastifyReply, name: string): void {
  void reply.setCookie(name, '', { ...SESSION_COOKIE_ATTRIBUTES, maxAge: 0 });
}
