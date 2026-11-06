# `src/plugins/response-headers`

Up: [`src/plugins`](../README.md)

## Purpose

Adds the fixed security headers (Cache-Control, X-Content-Type-Options, Content-Security-Policy, Cross-Origin-Resource-Policy, Referrer-Policy) and the request ID header to every answer.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Response headers of the Core server. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `CONTENT_SECURITY_POLICY_DIRECTIVES`, `RESPONSE_HEADERS`, `FORBIDDEN_RESPONSE_HEADERS`, `HELMET_OPTIONS`, `applyResponseHeaders`, `responseHeadersPlugin`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`plugins/error-envelope`](../error-envelope/README.md): `index.ts`

Outbound: imports nothing else inside `src`.

- Workspace packages: `@dems/shared`
- npm packages: `@fastify/helmet`, `fastify`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 1 | 0 |

None of these tests needs a database window.

Tests elsewhere that import it (2 folders): `src/plugins/authenticate/__tests__`, `src/plugins/origin-guard/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
