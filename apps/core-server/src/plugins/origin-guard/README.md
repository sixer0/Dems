# `src/plugins/origin-guard`

Up: [`src/plugins`](../README.md)

## Purpose

The origin guard, stage 3 of the request pipeline: checks the `Origin` header, the session cookie and the `Authorization` header against a decision table and refuses with 403 `ORIGIN_NOT_ALLOWED` or lets the request through.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Origin guard: stage 3 of the request pipeline and the seam `originDecision`. |
| [`origin-decision.ts`](./origin-decision.ts) | The Origin decision of the Core server. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `originNotAllowed`, `originGuardPlugin`, `OriginCategory`, `OriginRequestKind`, `OriginVerdict`, `UNLOGGABLE_ORIGIN`, `classifyOrigin`, `decideOrigin`, `originForLog`, `requestKindOf`, `OriginFacts`, `OriginLists`.
- Types exported from `index.ts`: `OriginDecision`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`plugins/authenticate`](../authenticate/README.md): `index.ts`
- [`plugins/throttle`](../throttle/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`plugins/error-envelope`](../error-envelope/README.md)
- [`plugins/logger`](../logger/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 2 | 0 |

None of these tests needs a database window.

Tests elsewhere that import it (1 folders): `src/plugins/throttle/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
