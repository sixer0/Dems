/**
 * Origin guard: stage 3 of the request pipeline and the seam `originDecision` (plan row W23;
 * hand-built element HB-6; spec §2.3, §2.4, §14.2 OR-1 to OR-5; SR-04, SR-19, SR-20, SR-21,
 * SR-69, SR-70).
 *
 * What it does, for every request that matched a route, before the body is read:
 *   1. reads three facts: where the `Origin` header falls (absent, a web console origin, one of
 *      the instance's own origins, anything else), whether this instance's session cookie is
 *      present, and whether an `Authorization` header is present;
 *   2. applies the decision table of spec §14.2 (`decideOrigin`);
 *   3. refuses with 403 `ORIGIN_NOT_ALLOWED`, or lets the request through.
 *
 * The two lists come from the server configuration (`app.config.webConsoleOrigins`,
 * `app.config.ownOrigins`) and the cookie name from `app.config.sessionCookieName`; nothing
 * here names an origin.
 *
 * What it never does:
 *   - it sets no response header: no CORS plugin is registered and no `Access-Control-Allow-*`
 *     header is sent on any answer, a refusal included (OR-5, SR-04);
 *   - it never puts the request's `Origin` into an answer: the refusal has a fixed text;
 *   - it reads no body, no query string and no path (it runs in `onRequest`).
 *
 * Socket upgrades. The upgrade request of the realtime channel is dispatched through the router
 * and so passes this stage like any other request. A request with an `Upgrade` header is held to
 * the upgrade table (a cookie needs a web console origin, also on that GET), so the realtime
 * channel does not decide the Origin a second time; a refusal is the HTTP 403 of the handshake.
 *
 * A CORS preflight (`OPTIONS`) matches no route (API-2: GET and POST only). It is answered by
 * stage 1 with 405 `METHOD_NOT_ALLOWED` (404 for an unknown path), without any CORS header, and
 * never reaches this stage.
 *
 * CONTRACT with the scaffold (P25): the exports `originGuardPlugin`, `OriginDecision`,
 * `OriginFacts` and `OriginCategory` keep the shape the scaffold declared. The identity module
 * reads the facts for the console rule ID-1 (`category === 'WEB_CONSOLE' && !hasBearer`), the
 * throttle for its class key, the realtime channel for the upgrade.
 */
import { ApiErrorCode } from '@dems/shared/api';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { ApiFailure } from '../error-envelope';
import { routeOf } from '../logger';
import {
  OriginVerdict,
  classifyOrigin,
  decideOrigin,
  originForLog,
  requestKindOf,
  type OriginFacts,
  type OriginLists,
} from './origin-decision';

export {
  OriginCategory,
  OriginRequestKind,
  OriginVerdict,
  UNLOGGABLE_ORIGIN,
  classifyOrigin,
  decideOrigin,
  originForLog,
  requestKindOf,
  type OriginFacts,
  type OriginLists,
} from './origin-decision';

/** The seam `originDecision`: the same answer for the same request, however often it is asked. */
export type OriginDecision = (request: FastifyRequest) => OriginFacts;

/** The answer of a refusal. The text is fixed: it never repeats the `Origin` it refuses. */
export function originNotAllowed(): ApiFailure {
  return new ApiFailure(403, ApiErrorCode.ORIGIN_NOT_ALLOWED, 'This origin may not call the Core server.');
}

export const originGuardPlugin: FastifyPluginAsync = async (app) => {
  const lists: OriginLists = {
    webConsoleOrigins: app.config.webConsoleOrigins,
    ownOrigins: app.config.ownOrigins,
  };
  const cookieName = app.config.sessionCookieName;

  app.seams.provide('originDecision', (request) => ({
    category: classifyOrigin(request.headers.origin, lists),
    // Presence only. Another instance's cookie (a lane's, in the same browser profile) has
    // another name and is not this instance's cookie.
    hasCookie: request.cookies[cookieName] !== undefined,
    hasBearer: request.headers.authorization !== undefined,
  }));

  app.stages.provide('originGuard', (request) => {
    // Through the seam, so that every reader of the facts gets the same ones.
    const facts = app.originDecision(request);
    const kind = requestKindOf(request.method, request.headers.upgrade);
    if (decideOrigin(facts, kind) === OriginVerdict.ALLOW) return;

    // The request line carries the route pattern and the code; this line adds which cell of the
    // table refused. No header value is logged except the origin in its safe form.
    request.log.warn(
      {
        code: ApiErrorCode.ORIGIN_NOT_ALLOWED,
        route: routeOf(request),
        kind,
        category: facts.category,
        hasCookie: facts.hasCookie,
        hasBearer: facts.hasBearer,
        origin: originForLog(request.headers.origin),
      },
      'request refused by the Origin guard',
    );
    throw originNotAllowed();
  });
};
